// @vitest-environment jsdom
// O papel Professor em Equipe & acessos. Só aparece com o módulo Professor e
// faltosos ligado (appUser.tenantModules, lido no login), pede o professor do
// cadastro (só os ativos e sem login), mostra o selo e o professor ligado na
// lista e troca o papel pelo servidor (set-role do /api/admin-users) antes de
// gravar o resto do cadastro. Sem Firebase de verdade.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { updateDoc, deleteDoc } from 'firebase/firestore';
import { TeamAccessSection } from '../../views/settings/TeamAccessSection.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { MODULES } from '../modules.js';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
// O que a tela fez, na ordem: chamadas à API e gravações do cadastro.
const ordem = vi.hoisted(() => []);

vi.mock('../firebase.js', () => ({
  auth: { currentUser: { getIdToken: async () => 'token-do-gestor' } },
  appId: 'academia-teste',
  LEADS_PATH: 'stronix_leads',
  PROFESSORS_PATH: 'stronix_professores',
  USERS_PATH: 'stronix_users',
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  query: (ref, ...filtros) => ({ ref, filtros }),
  where: (...args) => args,
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  updateDoc: vi.fn(async (ref) => { ordem.push(['cadastro', ref.caminho]); }),
  addDoc: vi.fn(async () => {}),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  deleteField: () => 'apagar',
  serverTimestamp: () => 'agora',
  writeBatch: vi.fn(),
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
// A faixa de assentos busca o plano na API. Fora do teste.
vi.mock('../../hooks/useSeatLimits.js', () => ({ useSeatLimits: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GESTOR = { id: 'gestor-1', authUid: 'gestor-1', name: 'Gestor', email: 'gestor@academia.com', role: 'admin' };
const ANA = { id: 'uid-ana', authUid: 'uid-ana', name: 'Ana', email: 'ana@academia.com', role: 'consultant', dailyVolumeTarget: 20 };
const RAFA = { id: 'uid-rafa', authUid: 'uid-rafa', name: 'Rafa', email: 'rafa@academia.com', role: 'professor', professorId: 'prof-rafa' };
const EQUIPE = [GESTOR, ANA, RAFA];

const PROFESSORES = [
  { id: 'prof-rafa', nome: 'Rafael Menezes', ativo: true, modalidadeIds: [] },
  { id: 'prof-lu', nome: 'Luana Prado', modalidadeIds: [] },
  { id: 'prof-velho', nome: 'Carlos Antigo', ativo: false, modalidadeIds: [] },
];

let root = null;
let respostas = [];

beforeEach(() => {
  ordem.length = 0;
  updateDoc.mockClear();
  deleteDoc.mockClear();
  for (const fn of Object.values(toast)) fn.mockClear();
  respostas = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    ordem.push(['api', url, JSON.parse(init.body)]);
    const r = respostas.shift() ?? { status: 200, body: { ok: true, changed: true, token: 'convite-1', tenantId: 'academia-teste' } };
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  }));
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.unstubAllGlobals();
});

// Os módulos chegam no appUser, como o App.jsx guarda no login.
async function montar({ modules = [MODULES.FALTOSOS] } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(
      GeneralConfigContext.Provider,
      { value: { modalities: [], professores: PROFESSORES } },
      h(TeamAccessSection, { db: {}, appUser: { ...GESTOR, tenantModules: modules }, usersList: EQUIPE, leads: [] })
    ));
  });
}

async function escrever(el, valor) {
  const ehSelect = el instanceof window.HTMLSelectElement;
  const proto = ehSelect ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event(ehSelect ? 'change' : 'input', { bubbles: true }));
  });
}

// O Salvar espera o token, a API e o Firestore, então o clique deixa o relógio
// dar uma volta antes de o act fechar.
async function clicar(el) {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
// O campo do diálogo pelo rótulo do DialogField.
const campo = (rotulo) => [...document.querySelectorAll('label')]
  .find((l) => l.firstElementChild?.textContent === rotulo)
  ?.querySelector('input, select') ?? null;
const opcoes = (select) => [...select.options].filter((o) => !o.disabled).map((o) => o.textContent);
const editar = (i) => clicar(document.querySelectorAll('button[title="Editar membro"]')[i]);
const linhas = () => [...document.querySelectorAll('button[title="Editar membro"]')].map((b) => b.parentElement.parentElement);
const chamadasDaApi = () => ordem.filter(([tipo]) => tipo === 'api');

describe('Equipe & acessos sem o módulo', () => {
  it('fica como sempre: Cadastrar consultor e cadastro sem papel', async () => {
    await montar({ modules: [] });
    expect(botao('Cadastrar consultor')).toBeTruthy();
    await clicar(botao('Cadastrar consultor'));
    expect(campo('Papel')).toBeNull();
  });

  it('o convite não oferece Professor', async () => {
    await montar({ modules: [] });
    await clicar(botao('Convidar por e-mail'));
    expect(opcoes(campo('Papel'))).toEqual(['Consultor', 'Gestor (admin)']);
  });

  it('quem já é professor continua com o selo, e o professor ligado não troca', async () => {
    await montar({ modules: [] });
    expect(linhas()[2].textContent).toContain('Professor');
    await editar(2);
    expect(campo('Papel').value).toBe('professor');
    expect(campo('Professor do cadastro').disabled).toBe(true);
  });
});

describe('Equipe & acessos com o módulo', () => {
  it('a lista mostra o papel de cada um e o professor ligado, sem meta de prospecção para o professor', async () => {
    await montar();
    const [gestor, ana, rafa] = linhas();
    expect(gestor.textContent).toContain('Gestor');
    expect(ana.textContent).toContain('Consultor');
    expect(ana.textContent).toContain('20/dia');
    expect(rafa.textContent).toContain('Professor');
    expect(rafa.textContent).toContain('Rafael Menezes');
    expect(rafa.textContent).not.toContain('sem meta');
  });

  it('o convite de professor só oferece professor ativo e sem login, e manda o id', async () => {
    await montar();
    await clicar(botao('Convidar por e-mail'));
    expect(opcoes(campo('Papel'))).toEqual(['Consultor', 'Gestor (admin)', 'Professor']);
    await escrever(campo('E-mail do convidado'), 'lu@academia.com');
    await escrever(campo('Papel'), 'professor');
    // Rafael já tem login e Carlos está inativo: sobra a Luana.
    expect(opcoes(campo('Professor do cadastro'))).toEqual(['Luana Prado']);
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Gerar convite'));
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/invite-create', { email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', allowExtra: false }],
    ]);
  });

  it('cadastrar pessoa como professor manda papel e professor ao /api/admin-users', async () => {
    await montar();
    await clicar(botao('Cadastrar pessoa'));
    await escrever(campo('Nome'), 'Luana');
    await escrever(campo('E-mail de login'), 'lu@academia.com');
    await escrever(campo('Papel'), 'professor');
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Cadastrar'));
    const [[, url, corpo]] = chamadasDaApi();
    expect(url).toBe('/api/admin-users');
    expect(corpo).toMatchObject({
      action: 'create', name: 'Luana', email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', allowExtra: false,
    });
    expect(toast.success.mock.calls[0][0]).toMatch(/^Professor Luana cadastrado\./);
  });

  it('cadastrar pessoa como consultor manda o pedido de sempre, sem papel', async () => {
    await montar();
    await clicar(botao('Cadastrar pessoa'));
    await escrever(campo('Nome'), 'Bia');
    await escrever(campo('E-mail de login'), 'bia@academia.com');
    await clicar(botao('Cadastrar'));
    const [[, , corpo]] = chamadasDaApi();
    expect(corpo).toMatchObject({ action: 'create', name: 'Bia', email: 'bia@academia.com' });
    expect(corpo).not.toHaveProperty('role');
    expect(corpo).not.toHaveProperty('professorId');
    expect(toast.success.mock.calls[0][0]).toMatch(/^Consultor Bia cadastrado\./);
  });

  it('editar: professor que volta a consultor passa pelo set-role antes de gravar o cadastro', async () => {
    await montar();
    await editar(2);
    expect(campo('Papel').value).toBe('professor');
    expect(campo('Professor do cadastro').value).toBe('prof-rafa');
    expect(opcoes(campo('Professor do cadastro'))).toEqual(['Rafael Menezes', 'Luana Prado']);
    await escrever(campo('Papel'), 'consultant');
    await clicar(botao('Salvar alterações'));

    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-rafa', role: 'consultant', allowExtra: false }],
    ]);
    expect(ordem.map(([tipo]) => tipo)).toEqual(['api', 'cadastro']);
    const [, dados] = updateDoc.mock.calls[0];
    expect(dados).not.toHaveProperty('role');
    expect(dados).not.toHaveProperty('professorId');
    expect(toast.success).toHaveBeenCalledWith('Cadastro atualizado.');
  });

  it('set-role recusado mostra o erro do servidor e não grava o cadastro', async () => {
    const erro = 'Ana ainda tem leads na carteira. Passe os leads em Configurações → Migrar leads antes de mudar o papel para Professor.';
    respostas = [{ status: 409, body: { error: erro } }];
    await montar();
    await editar(1);
    await escrever(campo('Papel'), 'professor');
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Salvar alterações'));
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu', allowExtra: false }],
    ]);
    expect(toast.error).toHaveBeenCalledWith(erro);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  // Professor que volta a consultor ocupa vaga do plano. Com as vagas cheias,
  // o servidor pede a confirmação do extra, e nada é cobrado sem o gestor ver
  // o preço e aceitar.
  it('vagas cheias: recusar o extra não salva nada nem pede de novo ao servidor', async () => {
    respostas = [{ status: 409, body: { requiresExtraConfirmation: true, extraUserPrice: 50 } }];
    vi.stubGlobal('confirm', vi.fn(() => false));
    await montar();
    await editar(2);
    await escrever(campo('Papel'), 'consultant');
    await clicar(botao('Salvar alterações'));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('+R$ 50/mês');
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-rafa', role: 'consultant', allowExtra: false }],
    ]);
    expect(updateDoc).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // O formulário continua aberto com o que foi escolhido.
    expect(campo('Papel').value).toBe('consultant');
  });

  it('vagas cheias: aceitar o extra repete o set-role com allowExtra antes de gravar o cadastro', async () => {
    respostas = [
      { status: 409, body: { requiresExtraConfirmation: true, extraUserPrice: 50 } },
      { status: 200, body: { ok: true, changed: true, isExtra: true } },
    ];
    await montar();
    await editar(2);
    await escrever(campo('Papel'), 'consultant');
    await clicar(botao('Salvar alterações'));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('+R$ 50/mês');
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-rafa', role: 'consultant', allowExtra: false }],
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-rafa', role: 'consultant', allowExtra: true }],
    ]);
    expect(ordem.map(([tipo]) => tipo)).toEqual(['api', 'api', 'cadastro']);
    expect(toast.info).toHaveBeenCalledWith(
      'Este consultor entrou como extra. A mensalidade foi ajustada a partir da próxima fatura.',
      { duration: 8000 }
    );
    expect(toast.success).toHaveBeenCalledWith('Rafa passa a ser consultor. O acesso novo vale quando a pessoa entrar de novo.');
    expect(toast.success).toHaveBeenCalledWith('Cadastro atualizado.');
  });

  it('editar: consultor que vira professor manda o professor ao set-role e apaga a meta de prospecção', async () => {
    await montar();
    await editar(1);
    expect(campo('Meta de prospecção (ações/dia)').value).toBe('20');
    await escrever(campo('Papel'), 'professor');
    // O professor não prospecta: o campo da meta some do diálogo.
    expect(campo('Meta de prospecção (ações/dia)')).toBeNull();
    // Rafael já tem login com o Rafa: sobra a Luana.
    expect(opcoes(campo('Professor do cadastro'))).toEqual(['Luana Prado']);
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Salvar alterações'));

    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu', allowExtra: false }],
    ]);
    expect(confirm).not.toHaveBeenCalled();
    expect(ordem.map(([tipo]) => tipo)).toEqual(['api', 'cadastro']);
    const [ref, dados] = updateDoc.mock.calls[0];
    expect(ref.caminho).toBe('artifacts/academia-teste/public/data/stronix_users/uid-ana');
    expect(dados.dailyVolumeTarget).toBe('apagar');
    expect(dados).not.toHaveProperty('role');
    expect(dados).not.toHaveProperty('professorId');
    expect(toast.success).toHaveBeenCalledWith('Ana passa a ser professor. O acesso novo vale quando a pessoa entrar de novo.');
    expect(toast.success).toHaveBeenCalledWith('Cadastro atualizado.');
  });

  it('o gestor não tem campo de papel', async () => {
    await montar();
    await editar(0);
    expect(campo('Papel')).toBeNull();
  });

  it('professor do cadastro com login não pode ser excluído', async () => {
    await montar();
    await clicar(document.querySelector('button[title="Excluir Rafael Menezes"]'));
    expect(toast.warning.mock.calls[0][0]).toContain('tem acesso ao app');
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
