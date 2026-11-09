import { describe, it, expect } from 'vitest';
import {
  readSignalBody, signalLineId, signalText, buildSignalInteraction, PREVIEW_MAX, ZAP_SIGNAL_MESSAGES
} from '../_zapSignal.js';
import { zapMatchKey } from '../_zapPhone.js';

const AGORA = new Date('2026-11-09T18:00:00.000Z');
const FONE = '5551998124471';

// Corpo de um "lead escreveu", como o Stronizap manda.
const corpo = (extra = {}) => ({
  kind: 'lead_escreveu', phone: FONE, conversationId: 'conv-1', messageId: '3EB0A1B2C3',
  occurredAt: '2026-11-09T17:32:00.000Z', preview: 'Oi, queria saber o valor da musculação', ...extra
});

describe('readSignalBody', () => {
  it('lead_escreveu: devolve só o que a rota usa, com o trecho limpo', () => {
    const lido = readSignalBody(corpo({ preview: '  Oi,\n queria   saber o valor ' }), AGORA);

    expect(lido).toEqual({
      value: {
        kind: 'lead_escreveu', matchKey: zapMatchKey(FONE), conversationId: 'conv-1', messageId: '3EB0A1B2C3',
        at: new Date('2026-11-09T17:32:00.000Z'), answering: false, email: null, actorName: null,
        preview: 'Oi, queria saber o valor'
      }
    });
  });

  it('corta o trecho em 120 caracteres sem partir um emoji', () => {
    const { value } = readSignalBody(corpo({ preview: '😀'.repeat(200) }), AGORA);

    expect(Array.from(value.preview)).toHaveLength(PREVIEW_MAX);
    expect(value.preview).toBe('😀'.repeat(PREVIEW_MAX));
  });

  it.each([['só espaços', '   '], ['número', 42], ['ausente', undefined]])('trecho %s vira null', (_nome, preview) => {
    expect(readSignalBody(corpo({ preview }), AGORA).value.preview).toBeNull();
  });

  it('pessoa_enviou: lê o e-mail e o nome de quem enviou, e ignora o trecho', () => {
    const { value } = readSignalBody(
      corpo({ kind: 'pessoa_enviou', answering: true, actor: { email: ' Ana@Stronix.com.br ', name: ' Ana ' }, preview: 'ignorado' }),
      AGORA
    );

    expect(value).toMatchObject({
      kind: 'pessoa_enviou', answering: true, email: 'ana@stronix.com.br', actorName: 'Ana', preview: null
    });
  });

  it('pessoa_enviou sem actor (enviada pelo celular da academia) vale, sem e-mail nem nome', () => {
    const { value } = readSignalBody(corpo({ kind: 'pessoa_enviou', answering: false }), AGORA);

    expect(value).toMatchObject({ kind: 'pessoa_enviou', answering: false, email: null, actorName: null });
  });

  it('ia_enviou não leva autor, mesmo que o corpo traga', () => {
    const { value } = readSignalBody(corpo({ kind: 'ia_enviou', answering: true, actor: { email: 'a@b.com', name: 'A' } }), AGORA);

    expect(value).toMatchObject({ kind: 'ia_enviou', answering: true, email: null, actorName: null });
  });

  it('lead_escreveu ignora answering e actor', () => {
    const { value } = readSignalBody(corpo({ answering: true, actor: { email: 'a@b.com', name: 'A' } }), AGORA);

    expect(value).toMatchObject({ answering: false, email: null, actorName: null });
  });

  it('aceita 9 minutos no futuro (relógio um pouco adiantado) e data antiga (fila que esperou)', () => {
    expect(readSignalBody(corpo({ occurredAt: '2026-11-09T18:09:00.000Z' }), AGORA).value).toBeDefined();
    expect(readSignalBody(corpo({ occurredAt: '2026-10-01T10:00:00.000Z' }), AGORA).value).toBeDefined();
  });

  it.each([
    ['kind', { kind: 'outro' }],
    ['kind', { kind: undefined }],
    ['phone', { phone: '123' }],
    ['phone', { phone: 5551998124471 }],
    ['conversationId', { conversationId: '' }],
    ['messageId', { messageId: 'x'.repeat(201) }],
    ['messageId', { messageId: undefined }],
    ['occurredAt', { occurredAt: 'ontem' }],
    ['occurredAt', { occurredAt: 1730000000000 }],
    ['occurredAt', { occurredAt: '2026-11-09T18:11:00.000Z' }]
  ])('recusa %s inválido com 400 no campo certo', (field, extra) => {
    expect(readSignalBody(corpo(extra), AGORA)).toEqual({
      refusal: { status: 400, body: { error: 'dados_invalidos', field, message: ZAP_SIGNAL_MESSAGES[field] } }
    });
  });

  it.each([
    ['pessoa_enviou', undefined], ['pessoa_enviou', 'true'], ['ia_enviou', undefined], ['ia_enviou', 1]
  ])('%s com answering %s recusa: tem de ser true ou false', (kind, answering) => {
    expect(readSignalBody(corpo({ kind, answering }), AGORA).refusal.body.field).toBe('answering');
  });

  it('corpo ausente recusa o tipo', () => {
    expect(readSignalBody(undefined, AGORA).refusal.body.field).toBe('kind');
  });
});

describe('signalLineId', () => {
  it('é o mesmo ao longo do dia de Brasília e muda na virada', () => {
    // 23:50 de 09/11 em Brasília é 02:50 de 10/11 em UTC; 00:10 de 10/11 é 03:10.
    expect(signalLineId('L1', new Date('2026-11-10T02:50:00.000Z'), 'lead_escreveu')).toBe('zap-L1-2026-11-09-lead');
    expect(signalLineId('L1', new Date('2026-11-10T03:10:00.000Z'), 'lead_escreveu')).toBe('zap-L1-2026-11-10-lead');
  });

  it('separa lead, equipe e IA no mesmo dia, e um lead do outro', () => {
    const at = new Date('2026-11-09T17:32:00.000Z');

    expect(signalLineId('L1', at, 'pessoa_enviou')).toBe('zap-L1-2026-11-09-equipe');
    expect(signalLineId('L1', at, 'ia_enviou')).toBe('zap-L1-2026-11-09-ia');
    expect(signalLineId('L2', at, 'lead_escreveu')).toBe('zap-L2-2026-11-09-lead');
  });
});

describe('signalText', () => {
  it('lead: leva o trecho entre aspas, ou só o fato quando não há trecho', () => {
    expect(signalText({ kind: 'lead_escreveu', preview: 'Oi, queria saber o valor' })).toBe('Lead escreveu: “Oi, queria saber o valor”');
    expect(signalText({ kind: 'lead_escreveu', preview: null })).toBe('Lead escreveu.');
  });

  it.each([
    [true, 'Ana Souza', 'Resposta de Ana Souza.'],
    [false, 'Ana Souza', 'Mensagem de Ana Souza.'],
    [true, null, 'Resposta da equipe.'],
    [false, null, 'Mensagem da equipe.']
  ])('pessoa (resposta: %s, nome: %s): %s', (answering, actorName, esperado) => {
    expect(signalText({ kind: 'pessoa_enviou', answering, actorName })).toBe(esperado);
  });

  it('IA', () => {
    expect(signalText({ kind: 'ia_enviou', answering: true })).toBe('Resposta da IA.');
    expect(signalText({ kind: 'ia_enviou', answering: false })).toBe('Mensagem da IA.');
  });
});

describe('buildSignalInteraction', () => {
  const lead = { id: 'L1', name: 'Mariana Souza', consultantId: 'u-ana', consultantAuthUid: 'auth-ana' };
  const ANA = { id: 'u-ana', name: 'Ana Souza', authUid: 'auth-ana' };
  const sinal = (extra = {}) => ({
    kind: 'pessoa_enviou', conversationId: 'conv-1', at: new Date('2026-11-09T17:40:00.000Z'),
    answering: true, preview: null, ...extra
  });

  it('pessoa da equipe: leva o autor, o texto e a hora da mensagem', () => {
    expect(buildSignalInteraction({ lead, actor: ANA, signal: sinal() })).toEqual({
      leadId: 'L1', leadName: 'Mariana Souza', consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana', actorAuthUid: 'auth-ana',
      type: 'zap_signal', signal: 'pessoa_enviou', answering: true, text: 'Resposta de Ana Souza.',
      via: 'stronizap', zapConversationId: 'conv-1', createdAt: new Date('2026-11-09T17:40:00.000Z')
    });
  });

  it('sem autor (celular da academia): tudo do autor vai null e o dono do lead se mantém', () => {
    expect(buildSignalInteraction({ lead, actor: null, signal: sinal() })).toMatchObject({
      consultantName: null, actorId: null, actorAuthUid: null,
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana', text: 'Resposta da equipe.'
    });
  });

  it('IA: leva a marca byAi', () => {
    expect(buildSignalInteraction({ lead, actor: null, signal: sinal({ kind: 'ia_enviou' }) })).toMatchObject({
      signal: 'ia_enviou', byAi: true, text: 'Resposta da IA.'
    });
  });

  it('lead: a linha leva o trecho e a hora em que ele escreveu', () => {
    const linha = buildSignalInteraction({
      lead, actor: null,
      signal: sinal({ kind: 'lead_escreveu', answering: false, preview: 'Oi', at: new Date('2026-11-09T17:32:00.000Z') })
    });

    expect(linha).toMatchObject({ signal: 'lead_escreveu', text: 'Lead escreveu: “Oi”', createdAt: new Date('2026-11-09T17:32:00.000Z') });
    expect(linha).not.toHaveProperty('byAi');
  });

  it('nunca grava volumeKind (contato puro não é prospecção) nem valor undefined', () => {
    const linha = buildSignalInteraction({ lead, actor: ANA, signal: sinal() });

    expect(linha).not.toHaveProperty('volumeKind');
    expect(Object.values(linha).every((v) => v !== undefined)).toBe(true);
  });
});
