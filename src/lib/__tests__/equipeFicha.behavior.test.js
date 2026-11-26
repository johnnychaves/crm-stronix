// @vitest-environment jsdom
// src/lib/__tests__/equipeFicha.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

const gravacoes = vi.hoisted(() => ({ blocos: [], nomes: [], profs: [], falhaBloco: false, avisos: [], cep: null }));
vi.mock('../brazilLookups.js', async (orig) => ({ ...(await orig()), lookupCep: () => new Promise((r) => { gravacoes.cep = r; }) }));
vi.mock('../equipe/equipeWrites.js', () => ({
  gravarBloco: async (_db, pessoa, campos) => { if (gravacoes.falhaBloco) throw new Error('offline'); gravacoes.blocos.push({ id: pessoa.id, campos }); },
  renomearPessoa: async (_db, _p, nome) => { gravacoes.nomes.push(nome); return false; },
  gravarProfessor: async (_db, id, campos) => { gravacoes.profs.push({ id, campos }); },
  subirFotoDaEquipe: async () => ({ url: 'u', path: 'p' }),
  apagarFotoDaEquipe: async () => {},
}));
vi.mock('../firebase.js', () => ({ appId: 'acad', storage: {}, PROFESSORS_PATH: 'stronix_professores' }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: (m) => gravacoes.avisos.push(m), error: () => {}, warning: () => {}, info: () => {} }) }));

const { EquipeFicha } = await import('../../views/settings/equipe/EquipeFicha.jsx');
const { montarEquipe } = await import('../equipe/equipe.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; gravacoes.blocos = []; gravacoes.nomes = []; gravacoes.falhaBloco = false; gravacoes.avisos = []; });

const [marina] = montarEquipe({
  fichas: [], users: [], agora: new Date(2026, 10, 26),
  professores: [{ id: 'p-marina', nome: 'Marina Prado', modalidadeIds: ['m-func'] }],
});

async function montar(aba = 'dados', extra = {}, pessoa = marina) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, null, h(EquipeFicha, {
      db: {}, appUser: { id: 'g1', name: 'Johnny', role: 'admin' }, pessoa, aba, tenantId: 'acad', onAba: () => {},
      voltarHref: '/acad/configuracoes/equipe', modalities: [{ id: 'm-func', name: 'Funcional' }], professores: [{ id: 'p-marina', nome: 'Marina Prado' }],
      leads: [], professorEnabled: true, agora: new Date(2026, 10, 26), onEditarAcesso: () => {}, onTirarAcesso: () => {}, onDarAcesso: () => {}, onLeadsChanged: () => {}, ...extra,
    })));
  });
}

const comFicha = (fichas, users = []) => montarEquipe({ fichas, users, professores: [], agora: new Date(2026, 10, 26) })[0];
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
    // A troca de nome roda sempre e só grava o que estiver diferente.
    expect(gravacoes.nomes).toEqual(['Marina Prado']);
  });
  it('login e professor com nomes diferentes: salvar a Identidade leva o nome aos dois', async () => {
    const ana = montarEquipe({
      fichas: [], agora: new Date(2026, 10, 26),
      users: [{ id: 'u-ana', authUid: 'u-ana', name: 'Ana Duarte', role: 'professor', professorId: 'p-ana' }],
      professores: [{ id: 'p-ana', nome: 'Ana', modalidadeIds: [] }],
    })[0];
    await montar('dados', {}, ana);
    await editar('identidade');
    await clicar(botao('Salvar identidade'));
    expect(gravacoes.nomes).toEqual(['Ana Duarte']);
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

  it('abrir o bloco leva o foco ao primeiro campo, e o atalho leva ao campo dele', async () => {
    await montar();
    await editar('identidade');
    expect(document.activeElement.name).toBe('nome');
    await clicar(botao('Cancelar'));
    await clicar(botao('CPF'));
    expect(document.activeElement.name).toBe('cpf');
  });
  it('o atalho Endereço foca o CEP, e o Vínculo foca a primeira opção', async () => {
    await montar();
    await clicar(botao('Endereço'));
    expect(document.activeElement.name).toBe('cep');
    await clicar(botao('Cancelar'));
    await clicar(botao('Vínculo'));
    expect(document.activeElement.getAttribute('role')).toBe('radio');
    expect(document.activeElement.textContent).toBe('CLT');
  });
  it('erro ao salvar leva o foco ao campo do erro, com aria-invalid e aria-describedby', async () => {
    await montar();
    await editar('identidade');
    await escrever(document.querySelector('input[name="cpf"]'), '111.111.111-11');
    await clicar(botao('Salvar identidade'));
    const cpf = document.querySelector('input[name="cpf"]');
    expect(document.activeElement).toBe(cpf);
    expect(cpf.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(cpf.getAttribute('aria-describedby')).getAttribute('role')).toBe('alert');
  });
  it('salvar e cancelar devolvem o foco ao Editar do bloco', async () => {
    await montar();
    await editar('identidade');
    await clicar(botao('Cancelar'));
    expect(document.activeElement).toBe(document.querySelector('[data-bloco="identidade"] [data-editar]'));
    await editar('identidade');
    await clicar(botao('Salvar identidade'));
    expect(document.activeElement).toBe(document.querySelector('[data-bloco="identidade"] [data-editar]'));
    expect(gravacoes.avisos).toEqual(['Identidade salva.']);
  });
  it('as mensagens de sucesso concordam com o bloco', async () => {
    await montar();
    await editar('contato');
    await clicar(botao('Salvar contato'));
    await editar('trabalho');
    await clicar(botao('Salvar trabalho'));
    expect(gravacoes.avisos).toEqual(['Contato salvo.', 'Trabalho salvo.']);
  });
  it('a busca do CEP que volta com o bloco fechado não quebra', async () => {
    await montar();
    await editar('contato');
    await escrever(document.querySelector('input[name="cep"]'), '90010-000');
    await act(async () => { document.querySelector('input[name="cep"]').dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    await clicar(botao('Cancelar'));
    await act(async () => { gravacoes.cep({ street: 'Rua A', city: 'Porto Alegre', state: 'RS' }); });
    expect(document.querySelector('[data-bloco="contato"] input[name="cep"]')).toBeNull();
  });
  it('Vínculo é um grupo de rádio e Modalidades um grupo, nenhum dentro de label', async () => {
    await montar();
    await editar('trabalho');
    const radios = document.querySelector('[role="radiogroup"]');
    expect(radios.closest('label')).toBeNull();
    expect(document.getElementById(radios.getAttribute('aria-labelledby')).textContent).toBe('Vínculo');
    const mods = document.querySelector('[role="group"][aria-labelledby]');
    expect(mods.closest('label')).toBeNull();
    expect(document.getElementById(mods.getAttribute('aria-labelledby')).textContent).toBe('Modalidades em que dá aula');
    await clicar([...radios.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'PJ'));
    expect(radios.querySelector('[aria-checked="true"]').textContent).toBe('PJ');
  });
  it('rótulos em frase normal, formulário com @container e frase do rodapé', async () => {
    await montar();
    await editar('identidade');
    const rotulo = document.querySelector('[data-bloco="identidade"] form label span');
    expect(rotulo.className).not.toContain('uppercase');
    expect(document.querySelector('[data-bloco="identidade"] form').className).toContain('@container');
    expect(document.querySelector('[data-bloco="identidade"]').textContent).toContain('Os outros blocos esperam você salvar ou cancelar este.');
  });
  it('a linha "Falta" mantém as siglas em maiúsculas', async () => {
    await montar();
    const t = document.querySelector('[data-bloco="identidade"] header').textContent;
    expect(t).toContain('CPF');
    expect(t).toContain('RG');
    expect(document.querySelector('[data-bloco="trabalho"] header').textContent).toContain('CREF');
  });
  it('celular e CPF aparecem com a máscara na leitura', async () => {
    const p = comFicha([{ id: 'u1', nome: 'Ana Lima', funcao: 'consultor', cpf: '52998224725', celular: '51981244710' }]);
    await montar('dados', {}, p);
    const t = document.body.textContent;
    expect(t).toContain('529.982.247-25');
    expect(t).toContain('(51) 9 8124-4710');
  });
  it('alunos na carteira contam só clientes', async () => {
    const cliente = { professorId: 'p-marina', lifecycleStage: 'cliente' };
    await montar('dados', { leads: [cliente, { professorId: 'p-marina', lifecycleStage: 'lead' }] });
    const linha = [...document.querySelectorAll('dt')].find((d) => d.textContent === 'Alunos na carteira');
    expect(linha.nextSibling.textContent).toBe('1');
  });
  it('consultor com login mostra os leads na carteira', async () => {
    const p = comFicha([], [{ id: 'u-camila', name: 'Camila Torres', role: 'consultant', email: 'c@x.com' }]);
    await montar('dados', { leads: [{ consultantId: 'u-camila' }, { consultantId: 'u-camila' }, { consultantId: 'outro' }] }, p);
    const linha = [...document.querySelectorAll('dt')].find((d) => d.textContent === 'Leads na carteira');
    expect(linha.nextSibling.textContent).toBe('2');
  });
  it('admissão sem vínculo diz "Sem vínculo informado" nas movimentações', async () => {
    const p = comFicha([{ id: 'u1', nome: 'Ana Lima', funcao: 'consultor', movimentacoes: [{ tipo: 'admissao', data: '2026-02-02' }] }]);
    await montar('movimentacoes', {}, p);
    expect(document.body.textContent).toContain('Sem vínculo informado');
    expect(document.body.textContent).not.toContain('Vínculo Sem vínculo');
  });
  it('admissão de hoje diz "Na equipe desde hoje" no cabeçalho', async () => {
    const p = comFicha([{ id: 'u1', nome: 'Ana Lima', funcao: 'consultor', movimentacoes: [{ tipo: 'admissao', data: '2026-11-26' }] }]);
    await montar('dados', {}, p);
    expect(document.querySelector('header p').textContent).toBe('Na equipe desde hoje');
  });
  it('desligado: o cabeçalho diz o período e o selo a data', async () => {
    const p = comFicha([{ id: 'u1', nome: 'Ana Lima', funcao: 'consultor', status: 'desligado', movimentacoes: [{ tipo: 'admissao', data: '2025-01-02' }, { tipo: 'desligamento', data: '2026-11-10' }] }]);
    await montar('dados', {}, p);
    expect(document.querySelector('header').textContent).toContain('Esteve na equipe de 02/01/2025 a 10/11/2026');
    expect(document.querySelector('header').textContent).toContain('Desligado em 10/11/2026');
  });
  it('a câmera do cabeçalho abre o menu de foto, um só na tela', async () => {
    await montar();
    await clicar(document.querySelector('header [aria-label="Adicionar foto"]'));
    expect(document.querySelectorAll('h3').length && [...document.querySelectorAll('h3')].filter((h3) => h3.textContent === 'Foto do cliente').length).toBe(1);
  });
  it('professor com o módulo tem o link Ver perfil', async () => {
    await montar();
    const a = [...document.querySelectorAll('a')].find((x) => x.textContent === 'Ver perfil');
    expect(a.getAttribute('href')).toBe('/acad/professores/perfil/p-marina');
  });
  it('convite pendente mostra o e-mail e a validade, sem Dar acesso', async () => {
    const p = comFicha([{ id: 'c1', nome: 'Convidada', funcao: 'consultor', convite: { email: 'conv@x.com', expiraEm: '2026-12-01T12:00:00.000Z' } }]);
    expect(p.acesso).toBe('convite');
    await montar('acesso', {}, p);
    expect(document.body.textContent).toContain('conv@x.com');
    expect(document.body.textContent).toContain('01/12/2026');
    expect(botao('Dar acesso')).toBeUndefined();
  });
});
