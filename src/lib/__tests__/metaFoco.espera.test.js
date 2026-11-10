// A espera ("Respondeu, aguardando você") na ordem do Foco agora: classe 5,
// depois dos atrasados e antes das renovações, do mais antigo para o mais
// novo. As classes 0 a 4 não mudam. Instantes em ISO com Z: a urgência da
// espera é de Brasília e o CI roda em UTC.
import { describe, it, expect } from 'vitest';
import { FOCO_ESPERA, klassOf, rankFoco, taskKey, urgentCount, faixaFor, faixaEspera, esperaDispensaKey, inFoco } from '../metaFoco.js';
import { DAILY_GOAL_CATEGORIES as C } from '../leads.js';

const NOW = new Date('2026-11-09T17:32:00.000Z'); // 14:32 de Brasília
const MIN = 60 * 1000;
const antes = (min) => new Date(NOW.getTime() - min * MIN);
const depois = (min) => new Date(NOW.getTime() + min * MIN);
const entry = (lead, slug) => ({ key: taskKey(lead, slug), slug, lead });
const espera = (id, min, extra = {}) => entry({ id, consultantId: 'eu', awaitingReplySince: antes(min), ...extra }, FOCO_ESPERA);
const contato = (id, emMin) => entry({ id, nextFollowUp: depois(emMin) }, C.CONTATO_HOJE);
const atrasado = (id) => entry({ id, nextFollowUp: new Date('2026-11-08T12:00:00.000Z') }, C.ATRASADO);
const renovacao = (id) => entry({ id, currentContractEndsAt: new Date('2026-12-20T12:00:00.000Z') }, C.RENOVACAO);
const vencido = (id) => entry({ id, currentContractEndsAt: new Date('2026-10-20T12:00:00.000Z') }, C.VENCIDO);
const ids = (l) => l.map((e) => e.lead.id);

describe('a espera na ordem', () => {
  it('é a classe 5, renovação é a 6 e vencido é a 7', () => {
    expect(klassOf(espera('e', 42), NOW)).toBe(5);
    expect(klassOf(renovacao('r'), NOW)).toBe(6);
    expect(klassOf(vencido('v'), NOW)).toBe(7);
  });

  it('nunca vira classe 1, nem com a marca de agora', () => {
    expect(klassOf(espera('e', 0), NOW)).toBe(5);
    expect(klassOf(espera('e', -5), NOW)).toBe(5);
  });

  it('vem depois do atrasado e antes da renovação, do mais antigo para o mais novo', () => {
    const lista = [renovacao('r'), espera('nova', 10), vencido('v'), atrasado('a'), espera('velha', 90), contato('c', 30)];
    expect(ids(rankFoco(lista, NOW))).toEqual(['c', 'a', 'velha', 'nova', 'r', 'v']);
  });

  it('não tem minutos até o prazo', () => {
    expect(rankFoco([espera('e', 42)], NOW)[0].minutes).toBeNull();
  });

  it('não conta como urgente no título', () => {
    expect(urgentCount([espera('e', 300), espera('f', 42)], NOW)).toBe(0);
  });

  it('a faixa de sempre não avisa da espera', () => {
    // O Agora é uma renovação (classe 6) e a espera vem antes dela na fila.
    const ranked = rankFoco([renovacao('r'), espera('e', 300)], NOW);
    expect(faixaFor(ranked, ranked.find((e) => e.lead.id === 'r'), null)).toBeNull();
  });
});

describe('faixaEspera', () => {
  // O Agora é um atrasado (classe 4) e a espera vem logo depois.
  const cenario = (esp, now = NOW) => {
    const ranked = rankFoco([atrasado('a'), esp], now);
    return { ranked, agora: ranked[0] };
  };

  it('avisa com 30 minutos dentro da faixa', () => {
    const { ranked, agora } = cenario(espera('e', 30));
    expect(faixaEspera(ranked, agora, null, NOW)?.lead.id).toBe('e');
  });

  it('29 minutos ainda não', () => {
    const { ranked, agora } = cenario(espera('e', 29));
    expect(faixaEspera(ranked, agora, null, NOW)).toBeNull();
  });

  it('fora da faixa os minutos não contam', () => {
    // Escreveu às 21:10 e são 23:00 de Brasília.
    const now = new Date('2026-11-10T02:00:00.000Z');
    const esp = entry({ id: 'e', awaitingReplySince: new Date('2026-11-10T00:10:00.000Z') }, FOCO_ESPERA);
    const { ranked, agora } = cenario(esp, now);
    expect(faixaEspera(ranked, agora, null, now)).toBeNull();
  });

  it('a noite não conta: escreveu às 20:50 e às 08:20 do dia seguinte avisa', () => {
    const now = new Date('2026-11-10T11:20:00.000Z');
    const esp = entry({ id: 'e', awaitingReplySince: new Date('2026-11-09T23:50:00.000Z') }, FOCO_ESPERA);
    const { ranked, agora } = cenario(esp, now);
    expect(faixaEspera(ranked, agora, null, now)?.lead.id).toBe('e');
  });

  it('não avisa quando o Agora é uma espera', () => {
    const ranked = rankFoco([espera('e', 60), espera('f', 40)], NOW);
    expect(faixaEspera(ranked, ranked[0], null, NOW)).toBeNull();
    expect(faixaEspera(ranked, ranked[1], null, NOW)).toBeNull();
  });

  it('não interrompe um Agora urgente', () => {
    const ranked = rankFoco([contato('c', 30), espera('e', 60)], NOW);
    expect(ranked[0].klass).toBe(1);
    expect(faixaEspera(ranked, ranked[0], null, NOW)).toBeNull();
  });

  it('"Agora não" esconde a espera, e uma espera nova do mesmo lead volta a avisar', () => {
    const { ranked, agora } = cenario(espera('e', 60));
    const dispensadas = new Map([[esperaDispensaKey(ranked[1]), 'espera']]);
    expect(faixaEspera(ranked, agora, dispensadas, NOW)).toBeNull();
    const nova = cenario(espera('e', 40));
    expect(faixaEspera(nova.ranked, nova.agora, dispensadas, NOW)?.lead.id).toBe('e');
  });

  it('a chave da dispensa leva o instante da marca', () => {
    const e = espera('e', 60);
    expect(esperaDispensaKey(e)).toBe(`e:${FOCO_ESPERA}@${antes(60).getTime()}`);
  });

  it('respeita o "Foco em": sem a espera na lista visível, não avisa', () => {
    const ranked = rankFoco([atrasado('a'), espera('e', 60)].filter((x) => inFoco(x.slug, C.ATRASADO)), NOW);
    expect(faixaEspera(ranked, ranked[0], null, NOW)).toBeNull();
  });

  it('sem espera na lista, nada muda', () => {
    const ranked = rankFoco([atrasado('a'), renovacao('r')], NOW);
    expect(faixaEspera(ranked, ranked[0], null, NOW)).toBeNull();
    expect(faixaEspera([], null, null, NOW)).toBeNull();
  });
});
