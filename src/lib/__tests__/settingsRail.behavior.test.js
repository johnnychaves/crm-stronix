// @vitest-environment jsdom
// O trilho das Configurações em uso (jsdom), sem Firebase: o SettingsRail.jsx
// não importa a view. Cada item é um link de verdade com o endereço certo, o
// aceso leva aria-current, o grupo recolhe com aria-expanded e inert, o número
// só aparece onde há o que fazer (e com nome acessível), o clique simples chama
// onSection e o Ctrl+clique fica com o navegador, e Rotinas troca de tela pelo
// roteador sem passar por onSection. O seletor do celular abre pelo teclado
// (Enter no botão): o mouse usa APIs de ponteiro que o jsdom não tem.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { SETTINGS_SECTIONS } from '../routes.js';
import { SETTINGS_RAIL_GROUPS, settingsRailGroups } from '../settingsRail.js';
import { buildSetupState, railCounts, railSummaries } from '../settingsSetup.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, e a lista do Select leva
// a opção marcada para a vista com scrollIntoView. O jsdom não tem nenhum dos dois.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const { SettingsRail } = await import('../../views/settings/SettingsRail.jsx');

const hrefOf = (item) => (item.screen ? `/acad/${item.screen}` : `/acad/configuracoes/${SETTINGS_SECTIONS[item.id]}`);
const academia = {
  funnels: ['A', 'B'].map((name, i) => ({ id: `f${i}`, name })),
  statuses: [],
  sources: [{ id: 'o1' }], modalities: [{ id: 'm1' }], planos: [{ id: 'p1' }], lossReasons: [{ id: 'l1' }],
  metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  usersList: [
    { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1' },
    { id: 'u2', name: 'Ana', role: 'consultant', authUid: 'uid-2' },
    { id: 'u3', name: 'Davi', role: 'consultant', authUid: '' },
  ],
};
const setup = buildSetupState(academia);
const counts = railCounts(setup, 10);
const summaries = railSummaries(setup, { teamSize: 3, funnelCount: 2, catalogTotal: 4, pendingOwners: 10 });
const groups = settingsRailGroups(true);

let root = null;
let container = null;
let avisos = [];
let local = '';
function Local() { local = useLocation().pathname; return null; }
async function montar(section, onSection, extra = {}) {
  const el = h(MemoryRouter, { initialEntries: ['/acad/configuracoes/equipe'] },
    h(SettingsRail, { groups, section, summaries, counts, hrefOf, onSection, ...extra }), h(Local));
  if (!root) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => { root.render(el); });
}
// Aviso do React (key repetida, aninhamento inválido, act) ou do Radix é defeito: derruba o teste.
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.restoreAllMocks();
  expect(avisos).toEqual([]);
});

const clicar = async (el) => { await act(async () => { el.click(); }); };
const item = (texto) => [...container.querySelectorAll('nav a')].find((a) => a.textContent.includes(texto));
const cabecalho = (nome) => [...container.querySelectorAll('nav button[aria-expanded]')].find((b) => b.textContent.includes(nome));
const painelDe = (cab) => document.getElementById(cab.getAttribute('aria-controls'));
const classes = (el) => el.className.split(/\s+/);
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
};

describe('trilho das Configurações', () => {
  it('a navegação tem nome, os sete blocos aparecem e os itens são links com o endereço certo', async () => {
    await montar('team', vi.fn());
    const nav = container.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Seções das Configurações');
    expect(item('Visão geral').getAttribute('href')).toBe('/acad/configuracoes/visao-geral');
    expect([...nav.querySelectorAll('button[aria-expanded]')].map((b) => b.querySelector('span span').textContent))
      .toEqual(['Academia', 'Equipe', 'Dia a dia', 'Funil', 'Conexões', 'Manutenção da base']);
    expect(item('Perfil da academia').getAttribute('href')).toBe('/acad/configuracoes/perfil-da-academia');
    expect(item('Plano & faturas').getAttribute('href')).toBe('/acad/configuracoes/plano-e-faturas');
    expect(item('Metas & ritmo').getAttribute('href')).toBe('/acad/configuracoes/ritmo');
    expect(item('Importar clientes').getAttribute('href')).toBe('/acad/configuracoes/importacao');
    // Todos os itens do trilho são âncoras de verdade, 13 com o Importar clientes.
    expect(nav.querySelectorAll('a')).toHaveLength(SETTINGS_RAIL_GROUPS.flatMap((g) => g.items).length);
  });

  it('só o item aceso leva aria-current e o traço azul', async () => {
    await montar('pace', vi.fn());
    expect(item('Metas & ritmo').getAttribute('aria-current')).toBe('page');
    expect(classes(item('Metas & ritmo'))).toContain('before:bg-brand-600');
    expect(item('Agendamento').hasAttribute('aria-current')).toBe(false);
    expect(item('Visão geral').hasAttribute('aria-current')).toBe(false);
    await montar('overview', vi.fn());
    expect(item('Visão geral').getAttribute('aria-current')).toBe('page');
  });

  it('o número só aparece onde há o que fazer, e diz isso a quem usa leitor de tela', async () => {
    await montar('overview', vi.fn());
    const numero = (texto) => item(texto).querySelector('em');
    expect(numero('Equipe & acessos').textContent).toBe('1');
    expect(numero('Equipe & acessos').getAttribute('aria-label')).toBe('1 pede ação');
    expect(numero('Metas & ritmo').textContent).toBe('2');
    expect(numero('Funis & etapas').textContent).toBe('2');
    expect(numero('Funis & etapas').getAttribute('aria-label')).toBe('2 pedem ação');
    expect(numero('Indicações sem dono').getAttribute('aria-label')).toBe('10 pedem ação');
    // Sem pendência, sem número: nada de contagem de pessoas, funis ou catálogos.
    for (const nome of ['Perfil da academia', 'Plano & faturas', 'Agendamento', 'Rotinas', 'Catálogos', 'Stronizap', 'Migrar leads', 'Visão geral']) {
      expect(numero(nome), nome).toBeNull();
    }
    // O ponto âmbar de antes (7px, com título) não existe mais.
    expect(container.querySelector('[class*="size-[7px]"]')).toBeNull();
  });

  it('cada grupo diz o que há nele, e em âmbar e semibold quando pede ação', async () => {
    await montar('overview', vi.fn());
    const resumo = (nome) => cabecalho(nome).querySelector('span span:last-child');
    expect(resumo('Academia').textContent).toBe('Perfil e plano');
    expect(resumo('Equipe').textContent).toBe('3 pessoas, 1 sem acesso');
    expect(resumo('Dia a dia').textContent).toBe('2 consultores sem meta');
    expect(resumo('Funil').textContent).toBe('2 funis sem etapa');
    expect(resumo('Manutenção da base').textContent).toBe('10 indicações sem dono');
    expect(classes(resumo('Equipe'))).toEqual(expect.arrayContaining(['font-semibold', 'text-amber-700']));
    expect(classes(resumo('Academia'))).toContain('text-muted-foreground');
    expect(classes(resumo('Academia'))).not.toContain('font-semibold');
  });

  it('o grupo entra aberto, fecha e abre dizendo o que está aceso, e fechado sai do Tab e da leitura', async () => {
    await montar('pace', vi.fn());
    const cab = cabecalho('Dia a dia');
    const painel = painelDe(cab);
    expect(cab.getAttribute('aria-expanded')).toBe('true');
    expect(painel.querySelector('[inert]')).toBeNull();
    expect(classes(painel)).toContain('grid-rows-[1fr]');
    // Com movimento reduzido nada anima.
    expect(classes(painel)).toContain('motion-reduce:transition-none');
    await clicar(cab);
    expect(cab.getAttribute('aria-expanded')).toBe('false');
    expect(painel.querySelector('[inert]')).not.toBeNull();
    expect(classes(painel)).toContain('grid-rows-[0fr]');
    expect(cab.textContent).toContain('Aberto: Metas & ritmo');
    // Outro grupo continua como estava.
    expect(cabecalho('Equipe').getAttribute('aria-expanded')).toBe('true');
    await clicar(cab);
    expect(cab.getAttribute('aria-expanded')).toBe('true');
    expect(cab.textContent).toContain('2 consultores sem meta');
  });

  it('Enter e Espaço recolhem o grupo (é um botão)', async () => {
    await montar('team', vi.fn());
    const cab = cabecalho('Funil');
    expect(cab.tagName).toBe('BUTTON');
    expect(cab.getAttribute('type')).toBe('button');
    await clicar(cab);
    expect(cab.getAttribute('aria-expanded')).toBe('false');
  });

  it('chegar a um item de um grupo fechado abre o grupo', async () => {
    await montar('team', vi.fn());
    await clicar(cabecalho('Funil'));
    expect(cabecalho('Funil').getAttribute('aria-expanded')).toBe('false');
    // Trocar para um item de OUTRO grupo não mexe no fechado.
    await montar('pace', vi.fn());
    expect(cabecalho('Funil').getAttribute('aria-expanded')).toBe('false');
    // Chegar ao item do grupo fechado (link ou "Resolver" da Visão geral) abre.
    await montar('funnels', vi.fn());
    expect(cabecalho('Funil').getAttribute('aria-expanded')).toBe('true');
    expect(painelDe(cabecalho('Funil')).querySelector('[inert]')).toBeNull();
  });

  it('o clique simples chama onSection com o id, sem navegar pelo link, e o aceso é o que a tela devolve', async () => {
    const onSection = vi.fn();
    await montar('team', onSection);
    await clicar(item('Metas & ritmo'));
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('pace');
    expect(local).toBe('/acad/configuracoes/equipe');
    expect(item('Equipe & acessos').getAttribute('aria-current')).toBe('page');
    await clicar(item('Visão geral'));
    expect(onSection).toHaveBeenLastCalledWith('overview');
  });

  it('Ctrl+clique fica com o navegador, para abrir a seção em outra aba', async () => {
    const onSection = vi.fn();
    await montar('team', onSection);
    // Depois do React, o teste segura a navegação que o jsdom não sabe fazer e anota se alguém já a tinha segurado.
    let seguradoPeloApp = null;
    const segurar = (e) => { seguradoPeloApp = e.defaultPrevented; e.preventDefault(); };
    document.addEventListener('click', segurar);
    await act(async () => { item('Catálogos').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })); });
    document.removeEventListener('click', segurar);
    expect(seguradoPeloApp).toBe(false);
    expect(onSection).not.toHaveBeenCalled();
  });

  it('Rotinas é um link para a outra tela, com a seta de fora, e o clique troca de tela pelo roteador', async () => {
    const onSection = vi.fn();
    await montar('pace', onSection);
    expect(item('Rotinas').getAttribute('href')).toBe('/acad/rotinas');
    expect(item('Rotinas').querySelector('svg:last-child, svg.lucide-arrow-up-right')).not.toBeNull();
    expect(item('Metas & ritmo').querySelector('svg.lucide-arrow-up-right')).toBeNull();
    await clicar(item('Rotinas'));
    expect(onSection).not.toHaveBeenCalled();
    expect(local).toBe('/acad/rotinas');
  });

  it('sem a sessão assumida, Importar clientes não aparece e o grupo segue com os outros dois', async () => {
    await montar('team', vi.fn(), { groups: settingsRailGroups(false) });
    expect(item('Importar clientes')).toBeUndefined();
    expect(item('Migrar leads')).toBeTruthy();
    expect(item('Indicações sem dono')).toBeTruthy();
  });

  it('no celular, o seletor agrupa as seções e chama onSection, e Rotinas leva à outra tela', async () => {
    const onSection = vi.fn();
    await montar('team', onSection);
    const gatilho = container.querySelector('button[aria-label="Seção das Configurações"]');
    expect(gatilho.className).toContain('data-[size=default]:h-10');
    const abrir = async () => { gatilho.focus(); await tecla(gatilho, 'Enter'); };
    const opcao = (texto) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === texto);
    await abrir();
    expect(document.querySelector('[data-slot="select-content"]').className).toContain('border-border');
    expect([...document.querySelectorAll('[data-slot="select-label"]')].map((l) => l.textContent))
      .toEqual(['Academia', 'Equipe', 'Dia a dia', 'Funil', 'Conexões', 'Manutenção da base']);
    await tecla(opcao('Catálogos'), 'Enter');
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('catalogs');
    await abrir();
    await tecla(opcao('Rotinas'), 'Enter');
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(local).toBe('/acad/rotinas');
  });
});
