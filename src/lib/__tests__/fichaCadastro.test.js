// @vitest-environment jsdom
// A aba Cadastro dentro da ficha montada: trocar de aba não perde o que foi
// digitado (a aba fica montada e escondida), e os caminhos do cabeçalho levam
// ao lugar certo. A gravação (saveCadastroSection) e os avisos de telefone são
// dublês; a conferência do WhatsApp duplicado tem o próprio teste.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.mock('../../hooks/useDuplicateLead.js', () => ({
  useDuplicateLead: () => ({ duplicate: null }),
  findDuplicateLeadRemote: vi.fn(async () => null),
}));
vi.mock('../../hooks/useGuardianMatches.js', () => ({
  useGuardianMatches: () => ({ owner: null, wards: [], pending: false }),
}));
const gravar = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('../cadastroWrites.js', () => ({ saveCadastroSection: gravar }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'u1', name: 'Bruno Prado', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const PROFESSOR = { id: 'u3', name: 'Rafa', role: 'professor', professorId: 'p1', tenantId: 'acad', authUid: 'auth-3' };
const SEM_LOGIN = { id: 'u4', name: 'Legado', role: 'consultant', tenantId: 'acad', authUid: null };
const CPF = '529.982.247-25';
const LEAD = {
  id: 'l1', name: 'Marina Alves', whatsapp: '(51) 99530-4633', status: 'Novo', createdAt: new Date(2026, 8, 1),
  consultantId: 'u1', consultantName: 'Bruno Prado', tags: [], cpf: '52998224725',
  address: { street: 'Rua Ramiro Barcelos', number: '1200', city: 'Porto Alegre' },
};
// Fez 18 anos há 20 dias, sem WhatsApp próprio: o contato continua a mãe.
const nascimento = new Date();
nascimento.setDate(nascimento.getDate() - 20);
nascimento.setFullYear(nascimento.getFullYear() - 18);
const FEZ_18 = {
  ...LEAD, id: 'l2', name: 'Lucas Almeida', whatsapp: '', isMinor: true, birthDate: nascimento,
  guardian: { name: 'Sandra Almeida', phone: '(51) 99333-2211', relationship: 'Mãe' },
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: [],
};

let root = null;
let abaAtual = null;
function Ficha({ lead, appUser, aba }) {
  const [tab, setTab] = useState(aba);
  abaAtual = tab;
  return h(LeadProfileView, {
    lead, tab, onTab: setTab, onBack: () => {}, appUser,
    statuses: [], tags: [], lossReasons: [], usersList: [GESTOR], db: {}, funnels: [],
  });
}
async function montar({ lead = LEAD, appUser = GESTOR, aba = 'timeline' } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [`/acad/ficha/${lead.id}`] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG }, h(Ficha, { lead, appUser, aba }))))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const porLabel = (texto) => document.body.querySelector(`[aria-label="${texto}"]`);
const campo = (nome) => document.body.querySelector(`[name="${nome}"]`);
const botoes = (texto) => [...document.body.querySelectorAll('button')].filter((b) => b.textContent.trim() === texto);
const clicar = async (el) => { await act(async () => { el.click(); }); };
// O Radix troca de aba no mousedown do botão esquerdo, e não no click.
const aba = (valor) => document.body.querySelector(`[role="tab"][id$="-trigger-${valor}"]`);
const irPara = async (valor) => {
  await act(async () => { aba(valor).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const painelCadastro = () => document.body.querySelector('[role="tabpanel"][id$="-content-cadastro"]');
async function digitar(el, valor) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('aba Cadastro montada na ficha: troca de aba', () => {
  it('trocar de aba e voltar devolve a seção aberta com o que foi digitado', async () => {
    await montar({ aba: 'cadastro' });
    await clicar(porLabel('Editar endereço'));
    await digitar(campo('city'), 'Canoas');
    await irPara('timeline');
    expect(abaAtual).toBe('timeline');
    await irPara('cadastro');
    expect(campo('city').value).toBe('Canoas');
    expect(gravar).not.toHaveBeenCalled();
  });

  it('escondida, a aba fica fora da tela e do Tab', async () => {
    await montar({ aba: 'cadastro' });
    await clicar(porLabel('Editar endereço'));
    await irPara('timeline');
    expect(painelCadastro().hidden).toBe(true);
    expect(campo('city').closest('[hidden]')).toBe(painelCadastro());
    await irPara('cadastro');
    expect(painelCadastro().hidden).toBe(false);
  });

  it('o "Fez 18 anos" com a aba escondida abre a Identidade com o cursor no WhatsApp', async () => {
    await montar({ lead: FEZ_18 });
    expect(painelCadastro().hidden).toBe(true);
    const editar = botoes('Editar cadastro').find((b) => !b.title);
    await clicar(editar);
    expect(abaAtual).toBe('cadastro');
    expect(document.activeElement).toBe(campo('whatsapp'));
  });

  it('o "Fez 18 anos" com outra seção aberta não descarta o que foi digitado', async () => {
    await montar({ lead: FEZ_18, aba: 'cadastro' });
    await clicar(porLabel('Editar endereço'));
    await digitar(campo('city'), 'Canoas');
    await irPara('timeline');
    await clicar(botoes('Editar cadastro').find((b) => !b.title));
    expect(abaAtual).toBe('cadastro');
    expect(campo('city').value).toBe('Canoas');
    expect(campo('whatsapp')).toBeNull();
    expect(porLabel('Endereço').contains(document.activeElement)).toBe(true);
  });
});

describe('caminhos do cabeçalho até o Cadastro', () => {
  // O lápis ao lado do nome saiu (pedido do Johnny, 22/10/2026): o caminho é a
  // aba Cadastro. O único "Editar cadastro" do cabeçalho é o do "Fez 18 anos".
  it('o cabeçalho não tem mais o lápis de editar o cadastro', async () => {
    await montar();
    expect(botoes('').find((b) => b.title === 'Editar cadastro')).toBeUndefined();
    expect(botoes('Editar cadastro')).toEqual([]);
  });

  // O "Adicionar etiqueta" saiu do cabeçalho (pedido do Johnny, 22/10/2026):
  // as etiquetas se editam no Contexto comercial da Linha do tempo.
  it('o cabeçalho não tem o "Adicionar etiqueta"', async () => {
    await montar();
    expect(botoes('Adicionar etiqueta')).toEqual([]);
  });
});

describe('quem não edita cadastro', () => {
  // O CPF não pode aparecer nem por um instante: o observador olha cada mudança
  // do documento desde antes da montagem.
  for (const [quem, appUser] of [['o professor', PROFESSOR], ['quem está sem login vinculado', SEM_LOGIN]]) {
    it(`${quem}, com /cadastro no endereço, abre a Linha do tempo e nunca vê o CPF`, async () => {
      let viu = false;
      const olhar = () => { if (/529\.982\.247-25|52998224725/.test(document.body.textContent)) viu = true; };
      const observador = new MutationObserver(olhar);
      observador.observe(document.body, { childList: true, subtree: true, characterData: true });
      try {
        await montar({ appUser, aba: 'cadastro' });
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        olhar();
      } finally {
        observador.disconnect();
      }
      expect(viu).toBe(false);
      expect(aba('cadastro')).toBeNull();
      expect(painelCadastro()).toBeNull();
      expect(document.body.querySelector('[role="tab"][data-state="active"]').id).toMatch(/-trigger-timeline$/);
      expect(gravar).not.toHaveBeenCalled();
    });
  }

  it('o gravador da ficha recusa sem permissão antes de gravar', async () => {
    // A aba some para quem não edita cadastro, então o gravador não tem como ser
    // chamado pela tela: a trava dele é a última defesa, e aqui se confere que
    // ela vem antes da gravação. O mesmo molde da trava da foto e do contexto.
    // Caminho de texto: no jsdom o URL é o do navegador, e o fs não o aceita.
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const fonte = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../views/LeadProfileView.jsx'), 'utf8');
    const inicio = fonte.indexOf('const handleCadastroSave = async');
    expect(inicio).toBeGreaterThan(-1);
    const corpo = fonte.slice(inicio, fonte.indexOf('saveCadastroSection(', inicio));
    expect(corpo).toMatch(/if \(isReadOnly\) \{[^}]*return false; \}/);
    expect(corpo).toMatch(/if \(!canEditCadastro\) \{ negarAcesso\(\); return false; \}/);
    expect(fonte).toMatch(/const canEditCadastro = !isReadOnly && can\(appUser, ACTIONS\.CADASTRO_EDITAR\);/);
  });
});
