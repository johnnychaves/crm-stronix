// Tempo até a primeira resposta do dia (PR 4 da Parte B), a partir das linhas
// zap_signal do PR 1: uma por tipo, por lead e por dia de Brasília. Só vale o
// par do mesmo dia em que a primeira mensagem da equipe veio depois da do lead,
// respondendo (answering), com autor e sem a IA ter respondido no meio.
// Instantes em ISO com Z: o dia é o de Brasília e o CI roda em UTC.
import { describe, it, expect } from 'vitest';
import { firstReplyPairsOf, firstReplyOf } from '../crm/firstReply.js';

const START = new Date('2026-11-01T03:00:00.000Z');
const END = new Date('2026-12-01T03:00:00.000Z');
const sig = (id, leadId, signal, iso, extra = {}) => ({
  id, leadId, type: 'zap_signal', signal, createdAt: new Date(iso), answering: false, ...extra,
});
const L = (lead, iso) => sig(`zap-${lead}-lead-${iso}`, lead, 'lead_escreveu', iso);
const E = (lead, iso, extra = {}) => sig(`zap-${lead}-equipe-${iso}`, lead, 'pessoa_enviou', iso, { answering: true, actorId: 'ana', consultantName: 'Ana', ...extra });
const I = (lead, iso, answering = true) => sig(`zap-${lead}-ia-${iso}`, lead, 'ia_enviou', iso, { answering, byAi: true });
const minutos = (list) => firstReplyPairsOf(list, { start: START, end: END }).map((p) => p.minutes);

describe('firstReplyPairsOf', () => {
  it('o par do mesmo dia vale, em minutos', () => {
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), E('a', '2026-11-09T12:20:00Z')])).toEqual([20]);
  });

  it('o dia é o de Brasília: 19h e 23h30 de Brasília são o mesmo dia', () => {
    expect(minutos([L('a', '2026-11-09T22:00:00Z'), E('a', '2026-11-10T02:30:00Z')])).toEqual([270]);
  });

  it('a resposta do dia seguinte fica de fora', () => {
    expect(minutos([L('a', '2026-11-09T23:00:00Z'), E('a', '2026-11-10T12:00:00Z')])).toEqual([]);
  });

  it('a IA respondendo no meio tira o par', () => {
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), I('a', '2026-11-09T12:05:00Z'), E('a', '2026-11-09T12:30:00Z')])).toEqual([]);
  });

  it('a IA depois da pessoa, ou sem responder ninguém, não atrapalha', () => {
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), E('a', '2026-11-09T12:10:00Z'), I('a', '2026-11-09T12:30:00Z')])).toEqual([10]);
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), I('a', '2026-11-09T12:05:00Z', false), E('a', '2026-11-09T12:10:00Z')])).toEqual([10]);
  });

  it('mensagem da equipe que não responde, sem autor ou antes do lead fica de fora', () => {
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), E('a', '2026-11-09T12:20:00Z', { answering: false })])).toEqual([]);
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), E('a', '2026-11-09T12:20:00Z', { actorId: null })])).toEqual([]);
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), E('a', '2026-11-09T11:00:00Z')])).toEqual([]);
  });

  it('o lead sem resposta e a resposta sem lead ficam de fora', () => {
    expect(minutos([L('a', '2026-11-09T12:00:00Z'), E('b', '2026-11-09T12:20:00Z')])).toEqual([]);
  });

  it('só conta a mensagem do lead dentro do período', () => {
    expect(minutos([L('a', '2026-10-31T12:00:00Z'), E('a', '2026-10-31T12:20:00Z')])).toEqual([]);
  });

  it('a mesma linha duas vezes conta uma', () => {
    const l = L('a', '2026-11-09T12:00:00Z');
    expect(minutos([l, l, E('a', '2026-11-09T12:20:00Z')])).toEqual([20]);
  });

  it('ignora o que não é linha de sinal', () => {
    expect(minutos([{ id: 'x', leadId: 'a', type: 'note', createdAt: new Date('2026-11-09T12:00:00Z') }])).toEqual([]);
  });
});

describe('firstReplyOf', () => {
  const linhas = [
    L('a', '2026-11-09T12:00:00Z'), E('a', '2026-11-09T12:10:00Z'),
    L('b', '2026-11-09T13:00:00Z'), E('b', '2026-11-09T13:20:00Z'),
    L('c', '2026-11-09T14:00:00Z'), E('c', '2026-11-09T15:00:00Z', { actorId: 'bia', consultantName: 'Bia' }),
  ];
  const users = [{ id: 'ana', name: 'Ana Ribeiro' }];

  it('mediana, quantidade e por pessoa, do mais rápido para o mais lento', () => {
    expect(firstReplyOf(linhas, { start: START, end: END, users })).toEqual({
      pairs: 3,
      median: 20,
      people: [
        { id: 'ana', name: 'Ana Ribeiro', pairs: 2, median: 15 },
        { id: 'bia', name: 'Bia', pairs: 1, median: 60 },
      ],
    });
  });

  it('com uma pessoa escolhida, só as respostas dela', () => {
    expect(firstReplyOf(linhas, { start: START, end: END, users, userId: 'bia' })).toMatchObject({ pairs: 1, median: 60 });
  });

  it('sem par, null (o card some, nunca mostra zero)', () => {
    expect(firstReplyOf([], { start: START, end: END })).toBeNull();
    expect(firstReplyOf(linhas, { start: START, end: END, userId: 'cris' })).toBeNull();
  });
});

describe('a mesma conversa com dois leads (a mãe de dois menores)', () => {
  // A mensagem da mãe marca cada menor, e cada um ganha as suas linhas do dia,
  // com o mesmo zapConversationId. É uma conversa só.
  const conv = (lead, id, signal, iso, extra = {}) => sig(id, lead, signal, iso, { zapConversationId: 'conv-mae', ...extra });
  const dois = [
    conv('a', 'zap-a-lead', 'lead_escreveu', '2026-11-09T12:00:00Z'),
    conv('b', 'zap-b-lead', 'lead_escreveu', '2026-11-09T12:00:00Z'),
    conv('a', 'zap-a-equipe', 'pessoa_enviou', '2026-11-09T12:20:00Z', { answering: true, actorId: 'ana', consultantName: 'Ana' }),
    conv('b', 'zap-b-equipe', 'pessoa_enviou', '2026-11-09T12:20:00Z', { answering: true, actorId: 'ana', consultantName: 'Ana' }),
  ];

  it('conta um par só, na lista e na mediana', () => {
    expect(minutos(dois)).toEqual([20]);
    expect(firstReplyOf(dois, { start: START, end: END })).toMatchObject({ pairs: 1, median: 20 });
  });

  it('no dia seguinte, a mesma conversa conta de novo', () => {
    const amanha = [
      conv('a', 'zap-a-lead-2', 'lead_escreveu', '2026-11-10T12:00:00Z'),
      conv('a', 'zap-a-equipe-2', 'pessoa_enviou', '2026-11-10T12:10:00Z', { answering: true, actorId: 'ana' }),
    ];
    expect(minutos([...dois, ...amanha])).toEqual([20, 10]);
  });

  it('conversas diferentes do mesmo dia contam cada uma', () => {
    const outra = [
      sig('zap-c-lead', 'c', 'lead_escreveu', '2026-11-09T13:00:00Z', { zapConversationId: 'conv-outra' }),
      sig('zap-c-equipe', 'c', 'pessoa_enviou', '2026-11-09T13:30:00Z', { zapConversationId: 'conv-outra', answering: true, actorId: 'ana' }),
    ];
    expect(minutos([...dois, ...outra])).toEqual([20, 30]);
  });

  it('sem zapConversationId na linha, cada lead conta o seu', () => {
    const sem = dois.map((i) => ({ ...i, zapConversationId: undefined }));
    expect(minutos(sem)).toEqual([20, 20]);
  });
});
