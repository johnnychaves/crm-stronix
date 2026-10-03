// @vitest-environment jsdom
// Professor numa academia com o módulo "Professor e faltosos" desligado: o
// login vale, mas ele não tem tela nenhuma. A tela mostra só o aviso e o Sair
// (professorAccessOff, em src/lib/sidebarNav.js, decide quando ela aparece).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProfessorAccessOffScreen } from '../../views/auth/ProfessorAccessOffScreen.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AVISO = 'O acesso de professor está desligado nesta academia. Fale com o gestor.';

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(ProfessorAccessOffScreen, props)); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

describe('ProfessorAccessOffScreen', () => {
  it('mostra o título, o aviso e nenhum link', async () => {
    await montar({ onLogout: () => {} });
    expect(document.querySelector('h1')?.textContent).toBe('Acesso desligado');
    expect(document.querySelector('p')?.textContent).toBe(AVISO);
    expect(document.querySelector('a')).toBeNull();
    expect(AVISO).not.toMatch(/[—–]/);
  });

  it('o único botão é o Sair, e ele chama o onLogout', async () => {
    const onLogout = vi.fn();
    await montar({ onLogout });
    const botoes = [...document.querySelectorAll('button')];
    expect(botoes.map((b) => b.textContent.trim())).toEqual(['Sair']);
    await act(async () => { botoes[0].click(); });
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
