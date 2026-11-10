// O cartão do dia do Stronizap na ficha (Parte B, PR 3, desenho B). As linhas
// zap_signal de um dia viram um bloco só, só na tela: o dado continua sendo
// uma linha por tipo. Aqui ficam as funções puras de lib/timeline.js.
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { TimelineEvent } from '../../components/profile/TimelineEvent.jsx';
import {
  classifyInteraction, groupZapSignalDays, zapDayRows, zapSignalDayOf, zapReplyDelayText, zapSignalLabel,
} from '../timeline.js';
import { lastRecordOf } from '../lastRecord.js';

const at = (d, hh, mm = 0, ss = 0) => new Date(2026, 10, d, hh, mm, ss);
const zap = (dia, tipo, signal, createdAt, extra = {}) => ({
  id: `zap-abc-2026-11-${String(dia).padStart(2, '0')}-${tipo}`, leadId: 'abc', type: 'zap_signal', signal, via: 'stronizap', createdAt, ...extra,
});
const LEAD = zap(9, 'lead', 'lead_escreveu', at(9, 14, 32), { answering: false, consultantName: null, text: 'Lead escreveu: “Oi, queria saber o valor da musculação”' });
const IA = zap(9, 'ia', 'ia_enviou', at(9, 14, 33), { answering: true, byAi: true, consultantName: null, text: 'Resposta da IA.' });
const EQUIPE = zap(9, 'equipe', 'pessoa_enviou', at(9, 14, 40), { answering: true, consultantName: 'Ana Souza', actorId: 'u-ana', text: 'Resposta de Ana Souza.' });
const NOTA = { id: 'n1', leadId: 'abc', type: 'note', text: 'Pediu valores', consultantName: 'Ana Souza', createdAt: at(9, 14, 50) };
const classificar = (list) => list.map((i) => ({ ...i, _kind: classifyInteraction(i) }));

describe('zapSignalDayOf', () => {
  it.each([
    ['o dia do id, que é o de Brasília, vence a hora local', { id: 'zap-abc-2026-11-09-lead', createdAt: at(10, 0, 30) }, '2026-11-09'],
    ['id de lead com hífen', { id: 'zap-a-b-c-2026-11-08-equipe' }, '2026-11-08'],
    ['id fora do padrão cai no dia local da hora', { id: 'x1', createdAt: at(9, 23, 50) }, '2026-11-09'],
    ['sem id padrão e sem hora', { id: 'x1' }, null],
  ])('%s', (_, i, esperado) => {
    expect(zapSignalDayOf(i)).toBe(esperado);
  });
});

describe('zapReplyDelayText', () => {
  it.each([
    [0, 'menos de 1 min depois'],
    [29_000, 'menos de 1 min depois'],
    [8 * 60_000, '8 min depois'],
    [60 * 60_000, '1h depois'],
    [125 * 60_000, '2h05 depois'],
  ])('%i ms vira "%s"', (ms, esperado) => {
    expect(zapReplyDelayText(ms)).toBe(esperado);
  });
});

describe('zapSignalLabel: o rótulo sai dos campos, não do texto gravado', () => {
  it.each([
    ['lead', { signal: 'lead_escreveu', answering: false, text: 'Lead escreveu: “oi”' }, 'Lead escreveu'],
    ['pessoa respondendo', { signal: 'pessoa_enviou', answering: true, consultantName: 'Ana Souza' }, 'Resposta de Ana Souza'],
    ['pessoa puxando a conversa', { signal: 'pessoa_enviou', answering: false, consultantName: 'Ana Souza' }, 'Mensagem de Ana Souza'],
    ['equipe sem autor respondendo', { signal: 'pessoa_enviou', answering: true, consultantName: null }, 'Resposta da equipe'],
    ['equipe sem autor puxando', { signal: 'pessoa_enviou', answering: false, consultantName: '  ' }, 'Mensagem da equipe'],
    ['IA respondendo', { signal: 'ia_enviou', answering: true, byAi: true }, 'Resposta da IA'],
    ['IA sem espera', { signal: 'ia_enviou', answering: false, byAi: true }, 'Mensagem da IA'],
  ])('%s', (_, i, esperado) => {
    expect(zapSignalLabel(i)).toBe(esperado);
  });
});

describe('zapDayRows', () => {
  it('três linhas do dia, da mais nova para a mais antiga, com o tempo e o trecho', () => {
    expect(zapDayRows([LEAD, EQUIPE, IA])).toEqual([
      { id: EQUIPE.id, time: '14:40', label: 'Resposta de Ana Souza', extra: '8 min depois' },
      { id: IA.id, time: '14:33', label: 'Resposta da IA', extra: null },
      { id: LEAD.id, time: '14:32', label: 'Lead escreveu', extra: '“Oi, queria saber o valor da musculação”' },
    ]);
  });

  it('uma linha só da equipe não diz tempo', () => {
    expect(zapDayRows([EQUIPE])).toEqual([{ id: EQUIPE.id, time: '14:40', label: 'Resposta de Ana Souza', extra: null }]);
  });

  it('a mensagem que puxou a conversa não diz tempo', () => {
    const puxou = { ...EQUIPE, answering: false, text: 'Mensagem de Ana Souza.' };
    expect(zapDayRows([puxou, LEAD])[0]).toEqual({ id: EQUIPE.id, time: '14:40', label: 'Mensagem de Ana Souza', extra: null });
  });

  it('lead sem trecho e lead com mídia', () => {
    expect(zapDayRows([{ ...LEAD, text: 'Lead escreveu.' }])[0].extra).toBeNull();
    expect(zapDayRows([{ ...LEAD, text: 'Lead escreveu: “[áudio]”' }])[0].extra).toBe('“[áudio]”');
  });

  it('resposta antes da linha do lead não diz tempo, e menos de um minuto diz', () => {
    expect(zapDayRows([{ ...EQUIPE, createdAt: at(9, 14, 0) }, LEAD])[1].extra).toBeNull();
    expect(zapDayRows([{ ...EQUIPE, createdAt: at(9, 14, 32, 20) }, LEAD])[0].extra).toBe('menos de 1 min depois');
  });

  it('nenhuma linha tem travessão', () => {
    zapDayRows([LEAD, EQUIPE, IA]).forEach((r) => expect(`${r.label} ${r.extra || ''}`).not.toMatch(/[—–]/));
  });
});

describe('groupZapSignalDays', () => {
  it('lista sem linha do Stronizap volta a mesma (quem não usa o Stronizap)', () => {
    const lista = classificar([NOTA]);
    expect(groupZapSignalDays(lista)).toBe(lista);
    expect(groupZapSignalDays([])).toEqual([]);
  });

  it('as três linhas do dia viram um cartão no lugar da mais nova', () => {
    const lista = classificar([NOTA, EQUIPE, IA, LEAD]);
    const out = groupZapSignalDays(lista);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(lista[0]);
    expect(out[1]).toMatchObject({ id: 'zapdia-2026-11-09', type: 'zap_signal', _kind: 'conversation', _zapDay: true, createdAt: EQUIPE.createdAt });
    expect(out[1].rows.map((r) => r.id)).toEqual([EQUIPE.id, IA.id, LEAD.id]);
  });

  it('uma nota entre as linhas do dia fica no lugar dela', () => {
    const meio = { ...NOTA, id: 'n2', createdAt: at(9, 14, 35) };
    const out = groupZapSignalDays(classificar([EQUIPE, meio, LEAD]));
    expect(out.map((i) => i.id)).toEqual(['zapdia-2026-11-09', 'n2']);
  });

  it('dois dias, dois cartões', () => {
    const ontem = zap(8, 'lead', 'lead_escreveu', at(8, 20, 0), { answering: false, text: 'Lead escreveu.' });
    const out = groupZapSignalDays(classificar([EQUIPE, LEAD, ontem]));
    expect(out.map((i) => i.id)).toEqual(['zapdia-2026-11-09', 'zapdia-2026-11-08']);
  });

  it('linha sem o id padrão entra no dia local', () => {
    const solta = { ...LEAD, id: 'teste-1' };
    const out = groupZapSignalDays(classificar([EQUIPE, solta]));
    expect(out).toHaveLength(1);
    expect(out[0].rows.map((r) => r.id)).toEqual([EQUIPE.id, 'teste-1']);
  });

  it('não mexe na lista recebida', () => {
    const lista = classificar([EQUIPE, LEAD]);
    const copia = [...lista];
    groupZapSignalDays(lista);
    expect(lista).toEqual(copia);
  });

  it('o cartão nunca vira o último registro do compositor', () => {
    const cedo = { ...NOTA, id: 'n0', createdAt: at(9, 10, 0) };
    const lista = classificar([EQUIPE, LEAD, cedo]);
    expect(lastRecordOf(lista)?.id).toBe('n0');
    expect(lastRecordOf(groupZapSignalDays(lista))?.id).toBe('n0');
  });
});

describe('TimelineEvent: o cartão do dia', () => {
  const cartao = () => groupZapSignalDays(classificar([EQUIPE, IA, LEAD]))[0];
  const desenhar = (i) => renderToString(h(TimelineEvent, { i, statuses: [], stageTransitions: {}, outcomeOrigin: {} }));

  it('régua, nó de conversa e o carimbo da linha mais nova, com id para o histórico', () => {
    const out = desenhar(cartao());
    expect(out).toContain('id="ev-zapdia-2026-11-09"');
    expect(out).toContain('tabindex="-1"');
    expect(out).toContain('>09/11 14:40<');
    expect(out).toContain('border-emerald-300');
  });

  it('título com a marca e as linhas, sem o cabeçalho de tipo e autor', () => {
    const out = desenhar(cartao());
    expect(out).toContain('Conversa no Stronizap');
    expect(out).toContain('<b class="font-semibold">Resposta de Ana Souza</b> · 8 min depois');
    expect(out).toContain('<b class="font-semibold">Resposta da IA</b>');
    expect(out).toContain('<b class="font-semibold">Lead escreveu</b> · “Oi, queria saber o valor da musculação”');
    expect(out).not.toContain('>WhatsApp<');
    expect(out).not.toContain('Ver no Stronizap');
    expect(out).not.toMatch(/[—–]/);
  });

  it('a linha solta de um sinal, fora do cartão, segue como no PR 1', () => {
    const out = desenhar({ ...EQUIPE, _kind: classifyInteraction(EQUIPE) });
    expect(out).toContain('>WhatsApp<');
    expect(out).toContain('Resposta de Ana Souza.');
  });
});
