// Os textos da espera no Foco agora: o motivo com o tempo real, os fatos do
// Agora, a frase da faixa, a regra da ordem e a aba, que só aparecem com espera.
import { describe, it, expect } from 'vitest';
import { whyOf, factsOf, urgentText, focoRules, focoTabs, CATEGORY_ONE, FOCO_LABEL } from '../metaFocoTexts.js';
import { FOCO_ESPERA, taskKey } from '../metaFoco.js';
import { DAILY_GOAL_CATEGORIES as C } from '../leads.js';

const NOW = new Date('2026-11-09T17:32:00.000Z');
const antes = (min) => new Date(NOW.getTime() - min * 60 * 1000);
const entry = (lead, slug) => ({ key: taskKey(lead, slug), slug, lead });
const espera = (min, extra = {}) => entry({ id: 'b', name: 'Bruna Costa', awaitingReplySince: antes(min), ...extra }, FOCO_ESPERA);

describe('textos da espera', () => {
  it('nome da tarefa e da aba', () => {
    expect(CATEGORY_ONE[FOCO_ESPERA]).toBe('Respondeu, aguardando você');
    expect(FOCO_LABEL[FOCO_ESPERA]).toBe('Aguardando você');
  });

  it('o motivo é o tempo real, em âmbar', () => {
    expect(whyOf(espera(42), NOW)).toEqual({ text: 'Esperando há 42 min', tone: 'warn' });
    expect(whyOf(espera(90), NOW)).toEqual({ text: 'Esperando há 1h30', tone: 'warn' });
    expect(whyOf(espera(-3), NOW)).toEqual({ text: 'Esperando há 0 min', tone: 'warn' });
    expect(whyOf(entry({ id: 'x' }, FOCO_ESPERA), NOW)).toEqual({ text: 'Esperando resposta', tone: 'warn' });
  });

  it('os fatos do Agora trazem a mensagem e a origem', () => {
    const fatos = factsOf(espera(42, { awaitingReplyPreview: 'Oi, ainda tem vaga às 19h?', source: 'Instagram' }), NOW);
    expect(fatos[0][0]).toBe('Escreveu');
    expect(fatos[1]).toEqual(['Mensagem', '“Oi, ainda tem vaga às 19h?”']);
    expect(fatos[2]).toEqual(['Origem', 'Instagram']);
    expect(factsOf(espera(42), NOW).map(([k]) => k)).toEqual(['Escreveu']);
  });

  it('a faixa diz quem escreveu, há quanto tempo, sem travessão', () => {
    expect(urgentText(espera(42), NOW)).toBe('Bruna escreveu há 42 min e ninguém respondeu');
    expect(urgentText(espera(42, { name: '' }), NOW)).toBe('O lead escreveu há 42 min e ninguém respondeu');
  });

  it('a regra da ordem só fala da espera quando há espera', () => {
    expect(focoRules(3)).toHaveLength(7);
    const com = focoRules(3, { espera: true });
    expect(com).toHaveLength(8);
    expect(com[5]).toBe('Quem escreveu e espera resposta, do mais antigo');
    expect(com[6]).toBe('Renovações, do vencimento mais próximo');
  });

  it('a aba só aparece com espera', () => {
    const contato = entry({ id: 'c', nextFollowUp: new Date('2026-11-09T21:00:00.000Z') }, C.CONTATO_HOJE);
    expect(focoTabs([contato], NOW).map((t) => t.id)).not.toContain(FOCO_ESPERA);
    const tabs = focoTabs([contato, espera(42)], NOW);
    expect(tabs.map((t) => t.label)).toEqual(['Todos', 'Visitas e aulas', 'Contatos', 'Novos leads', 'Atrasados', 'Aguardando você', 'Renovações', 'Vencidos']);
    expect(tabs.find((t) => t.id === FOCO_ESPERA)).toMatchObject({ pending: 1, why: 'Esperando há 42 min', dot: null });
    expect(tabs[0].pending).toBe(2);
  });

  it('nenhuma frase nova tem travessão', () => {
    const frases = [
      CATEGORY_ONE[FOCO_ESPERA], FOCO_LABEL[FOCO_ESPERA], whyOf(espera(42), NOW).text,
      urgentText(espera(42), NOW), focoRules(3, { espera: true })[5],
    ];
    frases.forEach((f) => expect(f).not.toMatch(/[—–]/));
  });
});
