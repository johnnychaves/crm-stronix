// @vitest-environment jsdom
// src/lib/__tests__/equipeFicha.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

const gravacoes = vi.hoisted(() => ({ blocos: [], nomes: [], profs: [], falhaBloco: false }));
vi.mock('../equipe/equipeWrites.js', () => ({
  gravarBloco: async (_db, pessoa, campos) => { if (gravacoes.falhaBloco) throw new Error('offline'); gravacoes.blocos.push({ id: pessoa.id, campos }); },
  renomearPessoa: async (_db, _p, nome) => { gravacoes.nomes.push(nome); return false; },
  gravarProfessor: async (_db, id, campos) => { gravacoes.profs.push({ id, campos }); },
  subirFotoDaEquipe: async () => ({ url: 'u', path: 'p' }),
  apagarFotoDaEquipe: async () => {},
}));
vi.mock('../firebase.js', () => ({ appId: 'acad', storage: {}, PROFESSORS_PATH: 'stronix_professores' }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }) }));

const { EquipeFicha } = await import('../../views/settings/equipe/EquipeFicha.jsx');
const { montarEquipe } = await import('../equipe/equipe.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; gravacoes.blocos = []; gravacoes.nomes = []; gravacoes.falhaBloco = false; });

const [marina] = montarEquipe({
  fichas: [], users: [], agora: new Date(2026, 10, 26),
  professores: [{ id: 'p-marina', nome: 'Marina Prado', modalidadeIds: ['m-func'] }],
});

async function montar(aba = 'dados', extra = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, null, h(EquipeFicha, {
      db: {}, appUser: { id: 'g1', name: 'Johnny', role: 'admin' }, pessoa: marina, aba, onAba: () => {},
      voltarHref: '/acad/configuracoes/equipe', modalities: [{ id: 'm-func', name: 'Funcional' }], professores: [{ id: 'p-marina', nome: 'Marina Prado' }],
      leads: [], professorEnabled: true, agora: new Date(2026, 10, 26), onEditarAcesso: () => {}, onTirarAcesso: () => {}, onDarAcesso: () => {}, onLeadsChanged: () => {}, ...extra,
    })));
  });
}

const botao = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const clicar = async (el) => act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });
const editar = (bloco) => clicar(document.querySelector(`[data-bloco="${bloco}"] button[data-editar]`));

describe('ficha da equipe', () => {
  it('o cabeçalho diz quem é, e a linha "Falta:" lista o que falta', async () => {
    await montar();
    expect(document.querySelector('h1').textContent).toBe('Marina Prado');
    expect(document.body.textContent).toContain('Falta:');
    expect(document.body.textContent).toContain('CPF');
    expect(document.body.textContent).toContain('CREF');
  });
  it('editar a Identidade grava só o bloco, com o id da pessoa', async () => {
    await montar();
    await editar('identidade');
    await escrever(document.querySelector('input[name="cpf"]'), '529.982.247-25');
    await clicar(botao('Salvar identidade'));
    expect(gravacoes.blocos).toEqual([{ id: 'p-marina', campos: { nome: 'Marina Prado', cpf: '52998224725', rg: '', nascimento: '' } }]);
    expect(gravacoes.nomes).toEqual([]);
  });
  it('CPF inválido não grava e diz o porquê', async () => {
    await montar();
    await editar('identidade');
    await escrever(document.querySelector('input[name="cpf"]'), '111.111.111-11');
    await clicar(botao('Salvar identidade'));
    expect(gravacoes.blocos).toEqual([]);
    expect(document.querySelector('[role="alert"]').textContent).toBe('CPF inválido.');
  });
  it('uma seção aberta por vez', async () => {
    await montar();
    await editar('identidade');
    expect(document.querySelector('[data-bloco="contato"] button[data-editar]').disabled).toBe(true);
  });
  it('o atalho da linha "Falta:" abre o bloco do item', async () => {
    await montar();
    await clicar(botao('CREF'));
    expect(document.querySelector('[data-bloco="trabalho"] input[name="cref"]')).toBeTruthy();
  });
  it('sem acesso, a aba Acesso oferece dar acesso', async () => {
    await montar('acesso');
    expect(botao('Dar acesso')).toBeTruthy();
  });
  it('se o salvar da Identidade falha depois de trocar o nome, avisa que os leads podem ter mudado', async () => {
    const avisos = [];
    await montar('dados', { onLeadsChanged: () => avisos.push(1) });
    gravacoes.falhaBloco = true;
    await editar('identidade');
    await escrever(document.querySelector('input[name="nome"]'), 'Marina Prado Souza');
    await clicar(botao('Salvar identidade'));
    expect(gravacoes.nomes).toEqual(['Marina Prado Souza']);
    expect(avisos.length).toBe(1);
    expect(document.querySelector('[role="alert"]').textContent).toContain('Não deu para salvar');
  });
});
