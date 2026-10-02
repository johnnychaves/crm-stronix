// @vitest-environment jsdom
// A chave "Professor e faltosos" na página da academia do super console
// (TenantModulesCard). Ligar manda a lista com o módulo, desligar manda sem
// ele, desligar com professor de login pede confirmação, enquanto grava a
// chave fica travada, e a recusa da api aparece no cartão. Quem grava de
// verdade é o `save` que o Detail passa, pela api/tenant-status.js; aqui ele
// é um dublê.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { TenantModulesCard } from '../../views/console/TenantModulesCard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Lê o SuperConsole.jsx pelo caminho relativo a este teste. No jsdom o new URL
// resolve contra a base http do jsdom, então o caminho sai do import.meta.url
// como texto.
const AQUI = dirname(fileURLToPath(import.meta.url));

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(TenantModulesCard, props)); });
}
beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn(() => true));
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.unstubAllGlobals();
});
const chave = () => document.querySelector('[role="switch"]');
const clicar = async () => { await act(async () => { chave().click(); }); };

describe('TenantModulesCard', () => {
  it('academia sem o campo: a chave aparece desligada, com o nome do módulo', async () => {
    await montar({ tenant: { id: 'shape-one' }, save: vi.fn() });
    expect(document.body.textContent).toContain('Professor e faltosos');
    expect(chave().getAttribute('aria-checked')).toBe('false');
    expect(chave().getAttribute('aria-label')).toBe('Professor e faltosos');
  });

  it('ligar manda a lista com o faltosos, sem pedir confirmação', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: [] }, save });
    await clicar();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(['faltosos']);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('desligar sem professor de login manda a lista sem ele, sem pedir confirmação', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['faltosos'] }, save, professores: 0 });
    expect(chave().getAttribute('aria-checked')).toBe('true');
    await clicar();
    expect(save).toHaveBeenCalledWith([]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('desligar com professor de login pede confirmação, e o não deixa tudo como está', async () => {
    const save = vi.fn(async () => {});
    confirm.mockReturnValue(false);
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['faltosos'] }, save, professores: 3 });
    await clicar();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toBe('Desligar Professor e faltosos? Os 3 professores com login passam a ver só o aviso de acesso desligado, a partir do próximo login ou F5.');
    expect(save).not.toHaveBeenCalled();
    expect(chave().getAttribute('aria-checked')).toBe('true');
  });

  it('desligar com um professor só: a frase no singular, e o sim grava', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['faltosos'] }, save, professores: 1 });
    await clicar();
    expect(confirm.mock.calls[0][0]).toBe('Desligar Professor e faltosos? O professor com login passa a ver só o aviso de acesso desligado, a partir do próximo login ou F5.');
    expect(save).toHaveBeenCalledWith([]);
  });

  it('o que não é módulo conhecido não vai junto para a api', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['catraca', 7] }, save });
    expect(chave().getAttribute('aria-checked')).toBe('false');
    await clicar();
    expect(save).toHaveBeenCalledWith(['faltosos']);
  });

  it('enquanto grava, a chave fica travada e o segundo clique não grava de novo', async () => {
    let soltar;
    const save = vi.fn(() => new Promise((resolve) => { soltar = resolve; }));
    await montar({ tenant: { id: 'stronix-crm-app' }, save });
    await clicar();
    expect(chave().disabled).toBe(true);
    expect(document.body.textContent).toContain('salvando');
    await clicar();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { soltar(); });
    expect(chave().disabled).toBe(false);
    expect(document.body.textContent).not.toContain('salvando');
  });

  it('a recusa da api aparece no cartão e a chave volta a funcionar', async () => {
    const save = vi.fn(async () => { throw new Error('Módulo inválido. Os módulos que existem são: faltosos.'); });
    await montar({ tenant: { id: 'stronix-crm-app' }, save });
    await clicar();
    expect(document.querySelector('[role="alert"]').textContent).toBe('Módulo inválido. Os módulos que existem são: faltosos.');
    expect(chave().disabled).toBe(false);
  });
});

describe('o cartão na página da academia (SuperConsole.jsx)', () => {
  const fonte = readFileSync(join(AQUI, '../../views/console/SuperConsole.jsx'), 'utf8');

  it('o Detail monta o cartão com a gravação e os professores da academia', () => {
    expect(fonte).toMatch(/<TenantModulesCard tenant=\{t\} save=\{saveModules\} professores=\{stats\?\.professors \|\| 0\} \/>/);
  });

  it('a gravação vai para a api/tenant-status.js com a lista inteira e relê a lista do console', () => {
    const inicio = fonte.indexOf('const saveModules = async');
    expect(inicio).toBeGreaterThan(-1);
    const corpo = fonte.slice(inicio, fonte.indexOf('const [bg, fg] = tone(t.id);', inicio));
    expect(corpo).toContain("fetch('/api/tenant-status'");
    expect(corpo).toContain('JSON.stringify({ tenantId: t.id, modules })');
    expect(corpo).toMatch(/await reload\?\.\(\);/);
  });
});
