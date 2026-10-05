// @vitest-environment jsdom
// A Meta diária do professor antes da Meta dos faltosos (PR 3): o título e uma
// frase, que muda quando o login ainda não foi ligado a um professor do
// cadastro (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "A Meta do professor").
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProfessorGoalPlaceholder } from '../../views/ProfessorGoalPlaceholder.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SEM_IMPORTACAO = 'Sua lista de faltosos aparece aqui depois da primeira importação.';
const SEM_PROFESSOR = 'Seu acesso ainda não está ligado a um professor. Fale com o gestor.';
const professor = { id: 'u7', role: 'professor', professorId: 'prof-1', tenantId: 'stronix-crm-app' };

let root = null;
async function montar(appUser) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(ProfessorGoalPlaceholder, { appUser })); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

const titulo = () => document.querySelector('h2')?.textContent;
const texto = () => document.querySelector('p')?.textContent;

describe('ProfessorGoalPlaceholder', () => {
  it('com professor ligado, diz que a lista chega com a primeira importação', async () => {
    await montar(professor);
    expect(titulo()).toBe('Meta diária');
    expect(texto()).toBe(SEM_IMPORTACAO);
  });

  it.each([
    ['sem o campo', { ...professor, professorId: undefined }],
    ['vazio', { ...professor, professorId: '' }],
    ['só com espaço', { ...professor, professorId: '   ' }],
    ['que não é texto', { ...professor, professorId: 42 }],
    ['nulo', { ...professor, professorId: null }],
  ])('com professorId %s, pede para falar com o gestor', async (_caso, appUser) => {
    await montar(appUser);
    expect(titulo()).toBe('Meta diária');
    expect(texto()).toBe(SEM_PROFESSOR);
  });

  it('sem appUser não quebra e pede o gestor', async () => {
    await montar(null);
    expect(titulo()).toBe('Meta diária');
    expect(texto()).toBe(SEM_PROFESSOR);
  });

  it('o ícone fica fora do leitor de tela e os textos não têm travessão', async () => {
    await montar(professor);
    expect(document.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    for (const t of [SEM_IMPORTACAO, SEM_PROFESSOR]) expect(t).not.toMatch(/[—–]/);
  });

  it('não oferece botão nem link nesta entrega', async () => {
    await montar(professor);
    expect(document.querySelector('a, button')).toBeNull();
  });
});
