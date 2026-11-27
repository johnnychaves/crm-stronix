import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estadoTexto, metaTexto, pedacoTexto, proximaTexto, valorTexto } from '../../views/professores/criterios.js';
import { PlacarDaCarreira } from '../../views/professores/PlacarDaCarreira.jsx';
import { AderenciaTab } from '../../views/professores/AderenciaTab.jsx';
import { trilhasDe } from '../carreira/trilhas.js';
import { periodoDe } from '../carreira/periodo.js';

describe('textos do placar', () => {
  it('o valor de cada número', () => {
    expect(valorTexto('renovacao', 47)).toBe('47%');
    expect(valorTexto('nps', 9.2)).toBe('9,20');
    expect(valorTexto('conversao', 30)).toBe('30%');
    expect(valorTexto('aderencia', null)).toBeNull();
  });

  it('a meta, e a da conversão contra a academia', () => {
    expect(metaTexto('renovacao', 50)).toBe('50%');
    expect(metaTexto('nps', 9)).toBe('9,00');
    expect(metaTexto('conversao', 3, 27)).toBe('3 pontos acima da academia, 30%');
    expect(metaTexto('conversao', 0, 27)).toBe('acima da academia, 27%');
    expect(metaTexto('conversao', -3, 27)).toBe('até 3 pontos abaixo da academia, 24%');
    expect(metaTexto('conversao', 3, null)).toBe('3 pontos acima da academia');
    expect(metaTexto('renovacao', null)).toBeNull();
  });

  it('o estado e a linha do próximo nível', () => {
    expect(estadoTexto({ estado: 'ok' }, { nome: 'Júnior' })).toBe('Na meta do Júnior');
    expect(estadoTexto({ estado: 'baixo' }, { nome: 'Júnior' })).toBe('Abaixo da meta do Júnior');
    expect(estadoTexto({ estado: 'semMeta' }, { nome: 'Júnior' })).toBe('Sem meta definida.');
    expect(estadoTexto({ estado: 'semMeta' }, null)).toBe('Sem nível: defina a trilha e o nível.');
    expect(estadoTexto({ estado: 'sem' }, { nome: 'Júnior' })).toBeNull();
    expect(proximaTexto({ id: 'renovacao', metaProxima: 55 }, { nome: 'Pleno' })).toBe('Para Pleno: 55%');
    expect(proximaTexto({ id: 'conversao', metaProxima: 3, academia: 27 }, { nome: 'Pleno' })).toBe('Para Pleno: 3 pontos acima da academia, 30%');
    expect(proximaTexto({ id: 'renovacao', metaProxima: null }, { nome: 'Pleno' })).toBeNull();
    expect(proximaTexto({ id: 'renovacao', metaProxima: 55 }, null)).toBeNull();
  });
});

describe('o rótulo de cada pedaço da aderência', () => {
  it('sai das datas do próprio pedaço', () => {
    expect(pedacoTexto({ inicio: new Date(2027, 0, 1), fim: new Date(2027, 5, 1) })).toBe('janeiro a maio de 2027');
    expect(pedacoTexto({ inicio: new Date(2027, 5, 1), fim: new Date(2027, 6, 1) })).toBe('junho de 2027');
    expect(pedacoTexto({ inicio: new Date(2026, 11, 1), fim: new Date(2027, 2, 1) })).toBe('dezembro de 2026 a fevereiro de 2027');
  });
});

describe('a régua do NPS sem meta', () => {
  const trilha = trilhasDe(null).find((t) => t.id === 'professor');
  const periodo = periodoDe(trilha, new Date(2027, 1, 10));
  const desenhar = (valor) => renderToStaticMarkup(h(PlacarDaCarreira, {
    titulo: 'x', trilha, periodo, agora: new Date(2027, 1, 10), onChave: () => {},
    placar: { nivel: { id: 'junior', nome: 'Júnior' }, proximo: null, itens: [{ id: 'nps', nome: 'Nota dos alunos', valor, meta: null, metaProxima: null, academia: null, estado: valor == null ? 'sem' : 'semMeta' }] },
    detalhes: { nps: { itens: [{}], promotores: 100, pesquisas: 1 } },
  }));
  it('com nota 10, não divide por zero', () => {
    const html = desenhar(10);
    expect(html).not.toContain('NaN');
    expect(html).toContain('>9<');
  });
  it('sem nota, as pontas não são iguais', () => {
    expect(desenhar(null)).toContain('>9<');
  });
});

describe('a aderência no semestral', () => {
  const pedacos = [{ inicio: new Date(2027, 5, 1), fim: new Date(2027, 6, 1), fechado: false, taxa: 40, aderentes: 2, contam: 5 }];
  const desenhar = (resumo) => renderToStaticMarkup(h(AderenciaTab, {
    linhas: [{ semana: '2027-06-07', taxa: 40, aderentes: 2, contam: 5, umaPresenca: 1, nenhuma: 2, umaIds: [], nenhumaIds: [] }],
    resumo, barra: 2, meta: 50, faixaMax: 70, semestral: true, leadsById: new Map(), professorLogado: false, primeiroNome: 'Ana',
  }));
  it('o pedaço tem o rótulo das datas e o número grande é a taxa em andamento', () => {
    const html = desenhar({ semestres: pedacos, nota: null, taxa: 40, emAndamento: true });
    expect(html).toContain('junho de 2027, em andamento');
    expect(html).not.toContain('1º semestre, janeiro a junho, em andamento');
    expect(html).toContain('40%');
    expect(html).not.toContain('Sem semestre fechado');
  });
});

describe('as semanas da aba Aderência', () => {
  const lin = (semana) => ({ semana, taxa: 50, aderentes: 1, contam: 2, umaPresenca: 0, nenhuma: 1, umaIds: [], nenhumaIds: [] });
  const pecas = [
    { inicio: new Date(2027, 5, 1), fim: new Date(2027, 6, 1), fechado: true, taxa: 50, aderentes: 1, contam: 2 },
    { inicio: new Date(2027, 6, 1), fim: new Date(2027, 11, 1), fechado: false, taxa: 50, aderentes: 1, contam: 2 },
  ];
  const html = renderToStaticMarkup(h(AderenciaTab, {
    linhas: [lin('2027-06-07'), lin('2027-07-05'), lin('2027-12-06')],
    resumo: { semestres: pecas, nota: null, taxa: 50, emAndamento: true },
    barra: 2, meta: 50, faixaMax: 70, semestral: true, leadsById: new Map(), professorLogado: false, primeiroNome: 'Ana',
  }));
  it('agrupa pelos pedaços do período, e dezembro fica à parte, fora da conta', () => {
    const titulos = [...html.matchAll(/<b class="text-\[14\.5px\]">([^<]*)<\/b>/g)].map((m) => m[1]);
    expect(titulos).toEqual(['julho a novembro de 2027', 'junho de 2027', 'Fora da conta, dezembro']);
  });
});
