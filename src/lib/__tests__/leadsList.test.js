import { describe, it, expect } from 'vitest';
import { nextActionOf, createdAgoOf, trailOf, sortLeads } from '../leadsList.js';

// Meio-dia de 16/10/2026.
const NOW = new Date(2026, 9, 16, 12);
const at = (m, d, h = 18, min = 0) => new Date(2026, m - 1, d, h, min);

describe('nextActionOf', () => {
  it('sem data não há próxima ação', () => {
    expect(nextActionOf({ nextFollowUp: null }, NOW, false)).toEqual({ text: 'Sem agendamento', sub: '', tone: 'none' });
    expect(nextActionOf({}, NOW, false).tone).toBe('none');
  });

  it('hoje, amanhã e daqui a alguns dias', () => {
    expect(nextActionOf({ nextFollowUp: at(10, 16, 17, 30) }, NOW, false)).toEqual({ text: 'Hoje às 17:30', sub: '', tone: 'today' });
    expect(nextActionOf({ nextFollowUp: at(10, 17, 9) }, NOW, false)).toEqual({ text: 'Amanhã às 09:00', sub: '17/10', tone: 'soon' });
    expect(nextActionOf({ nextFollowUp: at(10, 20) }, NOW, false)).toEqual({ text: 'Em 4 dias', sub: '20/10 às 18:00', tone: 'soon' });
    expect(nextActionOf({ nextFollowUp: at(10, 30, 14) }, NOW, false)).toMatchObject({ text: 'Em 14 dias', tone: 'later' });
  });

  it('atrasado diz há quantos dias, e no mesmo dia diz que era hoje', () => {
    expect(nextActionOf({ nextFollowUp: at(10, 15, 16) }, NOW, true)).toEqual({ text: 'Atrasado há 1 dia', sub: '15/10 às 16:00', tone: 'late' });
    expect(nextActionOf({ nextFollowUp: at(10, 12, 9) }, NOW, true).text).toBe('Atrasado há 4 dias');
    expect(nextActionOf({ nextFollowUp: at(10, 16, 10, 30) }, NOW, true)).toEqual({ text: 'Atrasado', sub: 'era hoje às 10:30', tone: 'late' });
  });
});

describe('createdAgoOf', () => {
  it('conta em dias do calendário', () => {
    expect(createdAgoOf(at(10, 16, 8), NOW)).toBe('hoje');
    expect(createdAgoOf(at(10, 15, 23), NOW)).toBe('ontem');
    expect(createdAgoOf(at(10, 9, 9), NOW)).toBe('há 7 dias');
    expect(createdAgoOf(undefined, NOW)).toBe('');
  });
});

describe('sortLeads', () => {
  const lead = (id, status, extra = {}) => ({ id, status, createdAt: at(10, 1), nextFollowUp: null, ...extra });
  const ids = (list) => list.map((l) => l.id);
  const LEADS = [
    lead('semData', 'Novo lead', { createdAt: at(10, 15) }),
    lead('amanha', 'Contato feito', { createdAt: at(10, 2), nextFollowUp: at(10, 17) }),
    lead('venda', 'Venda', { createdAt: at(10, 16), nextFollowUp: at(10, 10) }),
    lead('atrasado', 'Negociação', { createdAt: at(10, 3), nextFollowUp: at(10, 12) }),
    lead('hoje', 'Visita agendada', { createdAt: at(10, 4), nextFollowUp: at(10, 16) }),
  ];

  it('por cadastro, o mais novo primeiro, sem mexer na lista de entrada', () => {
    const copia = [...LEADS];
    expect(ids(sortLeads(LEADS, 'cadastro'))).toEqual(['venda', 'semData', 'hoje', 'atrasado', 'amanha']);
    expect(LEADS).toEqual(copia);
  });

  it('por próxima ação, o atrasado na frente, depois quem não tem data e por fim os encerrados', () => {
    expect(ids(sortLeads(LEADS, 'acao'))).toEqual(['atrasado', 'hoje', 'amanha', 'semData', 'venda']);
  });

  it('por tempo sem contato, quem está parado há mais tempo vem primeiro, e o encerrado fica no fim', () => {
    const ultimo = { amanha: at(10, 14), hoje: at(10, 5) };
    const out = sortLeads(LEADS, 'contato', (l) => ultimo[l.id] || null);
    // atrasado (cadastro 03/10) < hoje (contato 05/10) < amanha (contato 14/10) < semData (cadastro 15/10)
    expect(ids(out)).toEqual(['atrasado', 'hoje', 'amanha', 'semData', 'venda']);
  });

  it('lead sem nenhuma data vai para o fim dos abertos, não para o começo', () => {
    const sem = [lead('sem', 'Novo lead', { createdAt: undefined }), lead('com', 'Novo lead', { createdAt: at(10, 3) })];
    expect(ids(sortLeads(sem, 'contato'))).toEqual(['com', 'sem']);
  });
});

describe('trailOf', () => {
  const STAGES = ['Novo lead', 'Contato feito', 'Visita agendada', 'Aula experimental', 'Negociação'];

  it('a barra enche até a fase do lead', () => {
    expect(trailOf('Novo lead', STAGES)).toEqual({ kind: 'open', filled: 1, total: 5, position: 1 });
    expect(trailOf('Visita agendada', STAGES)).toEqual({ kind: 'open', filled: 3, total: 5, position: 3 });
  });

  it('venda e perda enchem todas, e a perda é marcada à parte', () => {
    expect(trailOf('Venda', STAGES)).toEqual({ kind: 'venda', filled: 5, total: 5, position: null });
    expect(trailOf('Perda', STAGES)).toEqual({ kind: 'perda', filled: 5, total: 5, position: null });
  });

  it('fase que saiu do funil fica sem barra cheia e sem posição', () => {
    expect(trailOf('Etapa antiga', STAGES)).toEqual({ kind: 'open', filled: 0, total: 5, position: null });
  });
});
