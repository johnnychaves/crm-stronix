import { describe, it, expect } from 'vitest';
import { readSignalBody, PREVIEW_MAX, ZAP_SIGNAL_MESSAGES } from '../_zapSignal.js';
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
