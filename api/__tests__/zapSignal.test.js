import { describe, it, expect } from 'vitest';
import {
  readSignalBody, signalLineId, signalText, buildSignalInteraction, signalLeadPatch, signalEligibility,
  PREVIEW_MAX, ZAP_SIGNAL_MESSAGES
} from '../_zapSignal.js';
import { zapMatchKey } from '../_zapPhone.js';
import { NAME_MAX } from '../_zapLead.js';

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

  it('tira os caracteres de direção do trecho, para o lead não inverter o texto na ficha', () => {
    expect(readSignalBody(corpo({ preview: 'oi \u202Eabc\u2066d\u2069' }), AGORA).value.preview).toBe('oi abcd');
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

  it('nome do autor passa pela mesma limpeza do trecho', () => {
    const lido = (name) => readSignalBody(corpo({ kind: 'pessoa_enviou', answering: true, actor: { name } }), AGORA).value.actorName;

    expect(lido('Ana\n\u0007X')).toBe('Ana X');
    expect(lido('\u202EAna')).toBe('Ana');
    expect(lido('   ')).toBeNull();
    expect(lido(42)).toBeNull();
  });

  it('nome do autor é cortado em NAME_MAX caracteres sem partir emoji', () => {
    const { value } = readSignalBody(corpo({ kind: 'pessoa_enviou', answering: true, actor: { name: '😀'.repeat(200) } }), AGORA);

    expect(Array.from(value.actorName)).toHaveLength(NAME_MAX);
    expect(value.actorName).toBe('😀'.repeat(NAME_MAX));
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

  it('aceita ISO com fuso: Z ou deslocamento, com ou sem fração de segundo', () => {
    expect(readSignalBody(corpo({ occurredAt: '2026-11-09T17:32:00.000Z' }), AGORA).value.at)
      .toEqual(new Date('2026-11-09T17:32:00.000Z'));
    expect(readSignalBody(corpo({ occurredAt: '2026-11-09T14:32:00-03:00' }), AGORA).value.at)
      .toEqual(new Date('2026-11-09T17:32:00.000Z'));
    expect(readSignalBody(corpo({ occurredAt: '2026-11-09T17:32:00Z' }), AGORA).value.at)
      .toEqual(new Date('2026-11-09T17:32:00.000Z'));
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
    ['occurredAt', { occurredAt: '2026-11-09T18:11:00.000Z' }],
    ['occurredAt', { occurredAt: '2026-11-09T17:32:00' }],
    ['occurredAt', { occurredAt: '2026-11-09' }],
    ['occurredAt', { occurredAt: '2026-11-09 17:32' }]
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

  it('lança com data inválida, tipo desconhecido ou lead vazio, em vez de gravar um id torto', () => {
    const at = new Date('2026-11-09T17:32:00.000Z');

    expect(() => signalLineId('L1', new Date('x'), 'lead_escreveu')).toThrow();
    expect(() => signalLineId('L1', at, 'outro')).toThrow();
    expect(() => signalLineId('', at, 'lead_escreveu')).toThrow();
    expect(() => signalLineId(undefined, at, 'lead_escreveu')).toThrow();
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
    kind: 'pessoa_enviou', conversationId: 'conv-1', messageId: 'MSG-1', at: new Date('2026-11-09T17:40:00.000Z'),
    answering: true, preview: null, ...extra
  });

  it('pessoa da equipe: leva o autor, o texto e a hora da mensagem', () => {
    expect(buildSignalInteraction({ lead, actor: ANA, signal: sinal() })).toEqual({
      leadId: 'L1', leadName: 'Mariana Souza', consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana', actorAuthUid: 'auth-ana',
      type: 'zap_signal', signal: 'pessoa_enviou', answering: true, text: 'Resposta de Ana Souza.',
      via: 'stronizap', zapConversationId: 'conv-1', zapMessageId: 'MSG-1', createdAt: new Date('2026-11-09T17:40:00.000Z')
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

describe('signalLeadPatch', () => {
  const AT = new Date('2026-11-09T17:32:00.000Z');
  const sinal = (extra = {}) => ({ kind: 'lead_escreveu', at: AT, answering: false, ...extra });
  const esperando = { awaitingReplySince: new Date('2026-11-09T17:00:00.000Z') };

  it('o lead escreveu e ninguém esperava: liga a marca', () => {
    expect(signalLeadPatch({}, sinal())).toEqual({ awaitingReplySince: AT, zapSignalAt: AT });
  });

  it('o lead escreveu de novo enquanto esperava: nada muda', () => {
    expect(signalLeadPatch(esperando, sinal())).toBeNull();
  });

  it.each(['pessoa_enviou', 'ia_enviou'])('%s respondeu quem esperava: limpa a marca', (kind) => {
    expect(signalLeadPatch(esperando, sinal({ kind, answering: true }))).toEqual({ awaitingReplySince: null, zapSignalAt: AT });
  });

  it('mensagem da equipe por iniciativa (ninguém esperava): nada muda', () => {
    expect(signalLeadPatch({}, sinal({ kind: 'pessoa_enviou', answering: false }))).toBeNull();
  });

  it('mensagem da equipe que não responde a ninguém, com o lead esperando: a marca continua', () => {
    expect(signalLeadPatch(esperando, sinal({ kind: 'pessoa_enviou', answering: false }))).toBeNull();
  });

  it('resposta quando ninguém esperava: só avança a régua, sem mexer na marca', () => {
    expect(signalLeadPatch({}, sinal({ kind: 'pessoa_enviou', answering: true }))).toEqual({ zapSignalAt: AT });
  });

  it('evento mais antigo que o último aplicado é ignorado, para a marca não voltar atrás', () => {
    const lead = { zapSignalAt: new Date('2026-11-09T17:40:00.000Z') };

    expect(signalLeadPatch(lead, sinal())).toBeNull();
  });

  it('entende o Timestamp do Firestore nos dois campos', () => {
    const lead = {
      awaitingReplySince: { toMillis: () => new Date('2026-11-09T17:00:00.000Z').getTime() },
      zapSignalAt: { toDate: () => new Date('2026-11-09T17:00:00.000Z') }
    };

    expect(signalLeadPatch(lead, sinal({ kind: 'pessoa_enviou', answering: true }))).toEqual({
      awaitingReplySince: null, zapSignalAt: AT
    });
  });

  it('resposta mais antiga que o último sinal aplicado é ignorada', () => {
    const lead = { zapSignalAt: new Date('2026-11-09T17:10:00Z'), awaitingReplySince: new Date('2026-11-09T17:10:00Z') };

    expect(signalLeadPatch(lead, R('2026-11-09T17:05:00Z'))).toBeNull();
  });

  // Aplica os patches em ordem, como a rota faz, e devolve o lead que sobra.
  const aplica = (eventos) => eventos.reduce((l, e) => ({ ...l, ...(signalLeadPatch(l, e) ?? {}) }), {});
  const L = (iso) => ({ kind: 'lead_escreveu', at: new Date(iso), answering: false });
  const R = (iso) => ({ kind: 'pessoa_enviou', at: new Date(iso), answering: true });

  it('resposta que chega antes do lead_escreveu que ela responde não deixa a marca ligada', () => {
    expect(aplica([R('2026-11-09T17:00:02Z'), L('2026-11-09T17:00:01Z')]).awaitingReplySince ?? null).toBeNull();
  });

  it('reenvio do lead_escreveu no mesmo segundo da resposta não religa a marca', () => {
    const t = '2026-11-09T17:00:01Z';

    expect(aplica([L(t), R(t), L(t)]).awaitingReplySince).toBeNull();
  });

  it('lead_escreveu reenviado depois da resposta é ignorado', () => {
    expect(aplica([L('2026-11-09T17:00:01Z'), R('2026-11-09T17:00:02Z'), L('2026-11-09T17:00:01Z')]).awaitingReplySince).toBeNull();
  });
});

describe('signalEligibility', () => {
  it('lead entra sempre, e cadastro antigo sem lifecycleStage conta como lead', () => {
    expect(signalEligibility({ lifecycleStage: 'lead' }, null)).toBe(true);
    expect(signalEligibility({}, null)).toBe(true);
  });

  it('cliente só entra quando o cartão mostra faixa de prazo', () => {
    expect(signalEligibility({ lifecycleStage: 'cliente' }, null)).toBe(false);
    expect(signalEligibility({ lifecycleStage: 'cliente' }, { kind: 'renovacao' })).toBe(true);
  });
});
