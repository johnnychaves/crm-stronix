// @vitest-environment jsdom
// src/lib/__tests__/equipeLista.behavior.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { EquipeLista } from '../../views/settings/equipe/EquipeLista.jsx';
import { montarEquipe } from '../equipe/equipe.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; });

const pessoas = montarEquipe({
  fichas: [{ id: 'p-otavio', professorId: 'p-otavio', vinculo: 'estagio', status: 'ativo', movimentacoes: [{ tipo: 'admissao', data: '2026-02-02' }] }],
  users: [{ id: 'u-camila', name: 'Camila Torres', role: 'consultant', email: 'camila@x.com' }],
  professores: [{ id: 'p-otavio', nome: 'Otávio Costa', modalidadeIds: ['m-pil'] }],
  agora: new Date(2026, 10, 26),
});

async function montar(props = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, null, h(EquipeLista, {
      pessoas, filtros: { situacao: 'ativos', funcao: null, vinculo: null, acesso: null }, setFiltros: () => {},
      busca: '', setBusca: () => {}, hrefDe: (id) => `/acad/configuracoes/equipe/${id}`,
      modalities: [{ id: 'm-pil', name: 'Pilates' }], leads: [], agora: new Date(2026, 10, 26), ...props,
    })));
  });
}

describe('lista da equipe', () => {
  it('uma linha por pessoa, com link para a ficha', async () => {
    await montar();
    const links = [...document.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-label')]);
    expect(links).toEqual([
      ['/acad/configuracoes/equipe/u-camila', 'Abrir a ficha de Camila Torres'],
      ['/acad/configuracoes/equipe/p-otavio', 'Abrir a ficha de Otávio Costa'],
    ]);
  });
  it('estagiário aparece como Estagiário, com a modalidade e o tempo de casa', async () => {
    await montar();
    const texto = document.body.textContent;
    expect(texto).toContain('Estagiário');
    expect(texto).toContain('Pilates');
    expect(texto).toContain('9 meses');
    expect(texto).toContain('Sem acesso');
  });
  it('lista vazia diz isso', async () => {
    await montar({ pessoas: [] });
    expect(document.body.textContent).toContain('Ninguém neste filtro.');
  });
});
