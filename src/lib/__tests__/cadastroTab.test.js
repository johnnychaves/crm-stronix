// @vitest-environment jsdom
// A aba Cadastro montada em jsdom: leitura primeiro, atalhos do que falta, uma
// seção aberta por vez e o que o Salvar manda. A gravação (onSave) é um dublê; os
// hooks de telefone são trocados por respostas vazias, e a conferência do
// WhatsApp duplicado tem o próprio teste (edicaoWhatsappDuplicado.test.js).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useDuplicateLead.js', () => ({
  useDuplicateLead: () => ({ duplicate: null }),
  findDuplicateLeadRemote: vi.fn(async () => null),
}));
vi.mock('../../hooks/useGuardianMatches.js', () => ({
  useGuardianMatches: () => ({ owner: null, wards: [], pending: false }),
}));

const { CadastroTab } = await import('../../components/profile/cadastro/CadastroTab.jsx');
const { readSectionForm } = await import('../cadastroSections.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const LEAD = {
  id: 'l1', name: 'Marina Alves', whatsapp: '(51) 9 9530-4633', cpf: '03456789012',
  email: 'marina@email.com', birthDate: new Date(1994, 2, 12, 12),
  address: { cep: '90035-190', street: 'Rua Ramiro Barcelos', number: '1200', complement: 'Apto 502', neighborhood: 'Santana', city: 'Porto Alegre', state: 'RS' },
  emergencyContact: { name: 'Rafael', phone: '(51) 9 8811-2200', relationship: 'Cônjuge' },
  profession: 'Fisioterapeuta',
};

let root = null;
async function montar({ lead = LEAD, request = null, onSave = vi.fn(async () => true) } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(CadastroTab, { lead, db: {}, request, onSave })));
  });
  return onSave;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const porLabel = (texto) => document.body.querySelector(`[aria-label="${texto}"]`);
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const campo = (nome) => document.body.querySelector(`[name="${nome}"]`);
const clicar = async (el) => { await act(async () => { el.click(); }); };
async function digitar(el, valor) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('CadastroTab', () => {
  it('abre na leitura: porcentagem, o que falta e o estado de cada seção', async () => {
    await montar();
    expect(document.body.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Cadastro 73% completo');
    expect(document.body.textContent).toContain('Faltam 3 dados para completar o cadastro');
    ['RG', 'Sexo', 'Estado civil'].forEach((rotulo) => expect(botao(rotulo), rotulo).toBeTruthy());
    expect(porLabel('Identidade').textContent).toContain('Falta RG e sexo');
    expect(porLabel('Endereço').textContent).toContain('Completo');
    expect(porLabel('Contato de emergência').textContent).toContain('Completo');
    expect(porLabel('Dados pessoais').textContent).toContain('Falta estado civil');
    // A leitura mostra o que está gravado, sem nenhum campo aberto.
    expect(document.body.textContent).toContain('Rua Ramiro Barcelos, 1200, Apto 502');
    expect(document.body.textContent).toContain('12/03/1994 (32 anos)');
    expect(document.body.querySelector('input')).toBeNull();
  });

  it('cadastro completo troca o título e o texto de apoio', async () => {
    await montar({ lead: { ...LEAD, rg: '6098765431', sexo: 'Feminino', maritalStatus: 'Casado(a)' } });
    expect(document.body.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Cadastro 100% completo');
    expect(document.body.textContent).toContain('Cadastro completo');
    expect(document.body.textContent).toContain('Marina tem todos os dados que a academia pede.');
    expect(document.body.querySelector('[role="group"][aria-label="Dados que faltam"]')).toBeNull();
  });

  it('menor de idade sem WhatsApp próprio, com o resto preenchido, não aparece como completo', async () => {
    await montar({ lead: { ...LEAD, whatsapp: '', rg: '6098765431', sexo: 'Feminino', maritalStatus: 'Casado(a)' } });
    expect(document.body.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Cadastro 91% completo');
    expect(document.body.textContent).toContain('Falta o WhatsApp para completar o cadastro');
    expect(document.body.textContent).not.toContain('tem todos os dados que a academia pede');
  });

  it('um item que falta abre a seção dele com o cursor no campo', async () => {
    await montar();
    await clicar(botao('RG'));
    expect(campo('rg')).toBeTruthy();
    expect(document.activeElement).toBe(campo('rg'));
    // As outras seções continuam na leitura.
    expect(campo('street')).toBeNull();
  });

  it('o atalho do endereço leva o cursor ao primeiro campo vazio, e não sempre à rua', async () => {
    await montar({ lead: { ...LEAD, address: { street: 'Rua A', number: '10' }, emergencyContact: { name: 'Rafael' } } });
    await clicar(botao('Endereço'));
    expect(document.activeElement).toBe(campo('city'));
    await clicar(botao('Cancelar'));
    await clicar(botao('Contato de emergência'));
    expect(document.activeElement).toBe(campo('emgPhone'));
  });

  it('o "Adicionar" de uma linha vazia abre a seção no campo certo', async () => {
    await montar();
    const adicionar = [...porLabel('Dados pessoais').querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar'));
    await clicar(adicionar);
    expect(document.activeElement).toBe(campo('maritalStatus'));
  });

  it('com uma seção aberta, o Editar das outras e os atalhos ficam desligados', async () => {
    await montar();
    await clicar(porLabel('Editar identidade'));
    expect(porLabel('Editar endereço').disabled).toBe(true);
    expect(porLabel('Editar endereço').title).toBe('Salve ou cancele a seção que está aberta');
    expect(botao('Estado civil').disabled).toBe(true);
    expect(porLabel('Editar identidade')).toBeNull();
  });

  it('Salvar manda a seção e o formulário dela, e fecha quando grava', async () => {
    const onSave = await montar();
    await clicar(botao('RG'));
    await digitar(campo('rg'), '1234567');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [secao, form] = onSave.mock.calls[0];
    expect(secao).toBe('identidade');
    expect(form.rg).toBe('1234567');
    expect(Object.keys(form).sort()).toEqual(Object.keys(readSectionForm(LEAD, 'identidade')).sort());
    expect(campo('rg')).toBeNull();
  });

  it('se a gravação falha, a seção continua aberta com o que foi digitado', async () => {
    const onSave = vi.fn(async () => false);
    await montar({ onSave });
    await clicar(botao('RG'));
    await digitar(campo('rg'), '7654321');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(campo('rg').value).toBe('7654321');
  });

  it('Cancelar descarta o que foi digitado e não grava', async () => {
    const onSave = await montar();
    await clicar(botao('RG'));
    await digitar(campo('rg'), '999');
    await clicar(botao('Cancelar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(campo('rg')).toBeNull();
    expect(porLabel('Identidade').textContent).toContain('Falta RG e sexo');
  });

  it('sem nome, o Salvar da identidade fica desligado', async () => {
    await montar();
    await clicar(botao('RG'));
    await digitar(campo('name'), '   ');
    expect(botao('Salvar').disabled).toBe(true);
  });

  it('menor sem responsável não grava e explica', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar identidade'));
    await clicar(document.body.querySelector('[role="switch"]'));
    await clicar(botao('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('o pedido do cabeçalho abre a seção e o campo pedidos', async () => {
    await montar({ request: { sectionId: 'identidade', field: 'whatsapp', at: 1 } });
    expect(campo('whatsapp')).toBeTruthy();
    expect(document.activeElement).toBe(campo('whatsapp'));
  });
});

describe('CadastroTab: foco', () => {
  it('o Editar sem atalho leva o foco ao primeiro campo da seção', async () => {
    await montar();
    await clicar(porLabel('Editar endereço'));
    expect(document.activeElement).toBe(campo('cep'));
  });

  it('Cancelar devolve o foco ao Editar da seção, e não ao body', async () => {
    await montar();
    await clicar(botao('RG'));
    await clicar(botao('Cancelar'));
    expect(document.activeElement).toBe(porLabel('Editar identidade'));
  });

  it('Salvar devolve o foco ao Editar da seção', async () => {
    await montar();
    await clicar(porLabel('Editar dados pessoais'));
    await digitar(campo('profession'), 'Médica');
    await clicar(botao('Salvar'));
    expect(document.activeElement).toBe(porLabel('Editar dados pessoais'));
  });

  it('se a gravação falha, o foco volta ao formulário aberto', async () => {
    await montar({ onSave: vi.fn(async () => false) });
    await clicar(porLabel('Editar dados pessoais'));
    await clicar(botao('Salvar'));
    expect(porLabel('Dados pessoais').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('CadastroTab: menor de idade', () => {
  const MENOR = {
    id: 'l2', name: 'Pedro Costa', whatsapp: '', isMinor: true, birthDate: new Date(2016, 0, 10, 12),
    guardian: { name: 'Ana Costa', phone: '(11) 9 5555-4444', relationship: 'Mãe' },
  };

  it('a leitura mostra o responsável com parentesco e telefone', async () => {
    await montar({ lead: MENOR });
    expect(porLabel('Identidade').textContent).toContain('Ana Costa (Mãe) · (11) 9 5555-4444');
    expect(porLabel('Identidade').textContent).toContain('WhatsApp do aluno');
  });

  it('desligar a chave sem o WhatsApp do lead não grava e explica', async () => {
    const onSave = await montar({ lead: MENOR });
    await clicar(porLabel('Editar identidade'));
    await clicar(document.body.querySelector('[role="switch"]'));
    await clicar(botao('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Para desligar Menor de idade, informe o WhatsApp do lead.');
  });

  it('o WhatsApp do aluno igual ao do responsável não grava', async () => {
    const onSave = await montar({ lead: MENOR });
    await clicar(porLabel('Editar identidade'));
    await digitar(campo('whatsapp'), '(11) 9 5555-4444');
    expect(document.body.textContent).toContain('Esse é o telefone do responsável');
    await clicar(botao('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('telefone do responsável'));
  });

  it('com o responsável preenchido, grava a chave e o responsável junto com a identidade', async () => {
    // Sem data de nascimento: com a de 1994, a regra recusa a chave ("já tem 18 anos").
    const onSave = await montar({ lead: { ...LEAD, birthDate: null } });
    await clicar(porLabel('Editar identidade'));
    await clicar(document.body.querySelector('[role="switch"]'));
    await digitar(campo('guardianName'), 'Carla Alves');
    await digitar(campo('guardianPhone'), '(51) 9 7777-6666');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [, form] = onSave.mock.calls[0];
    expect(form).toMatchObject({ isMinor: true, guardianName: 'Carla Alves', guardianPhone: '(51) 9 7777-6666' });
  });
});

// Sem internet, com o cache persistente do Firestore, o updateDoc só resolve
// quando o servidor confirma. A seção não pode ficar presa em "Salvando…".
describe('CadastroTab: gravação que demora', () => {
  const pendente = () => {
    const g = {};
    const promessa = new Promise((resolve, reject) => { g.resolve = resolve; g.reject = reject; });
    g.onSave = vi.fn(() => promessa);
    return g;
  };
  async function salvarProfissao(g) {
    await montar({ onSave: g.onSave });
    await clicar(porLabel('Editar dados pessoais'));
    await digitar(campo('profession'), 'Médica');
    await clicar(botao('Salvar'));
  }

  it('durante o envio, o Fechar continua ligado e fecha a seção sem desfazer a gravação', async () => {
    const g = pendente();
    await salvarProfissao(g);
    expect(botao('Salvando…').disabled).toBe(true);
    expect(botao('Fechar').disabled).toBe(false);
    await clicar(botao('Fechar'));
    expect(campo('profession')).toBeNull();
    expect(document.activeElement).toBe(porLabel('Editar dados pessoais'));
    expect(g.onSave).toHaveBeenCalledTimes(1);
    expect(g.onSave.mock.calls[0][1].profession).toBe('Médica');
  });

  it('a resposta que chega depois não mexe na seção aberta agora', async () => {
    const g = pendente();
    await salvarProfissao(g);
    await clicar(botao('Fechar'));
    await clicar(porLabel('Editar endereço'));
    await digitar(campo('city'), 'Canoas');
    const foco = document.activeElement;
    await act(async () => { g.resolve(false); });
    expect(campo('city').value).toBe('Canoas');
    expect(botao('Salvar').disabled).toBe(false);
    expect(botao('Salvando…')).toBeNull();
    expect(document.activeElement).toBe(foco);
  });

  it('a gravação que termina bem depois de fechar não reabre nem rouba o foco', async () => {
    const g = pendente();
    await salvarProfissao(g);
    await clicar(botao('Fechar'));
    await act(async () => { g.resolve(true); });
    expect(campo('profession')).toBeNull();
    expect(document.activeElement).toBe(porLabel('Editar dados pessoais'));
  });

  it('a gravação que falha depois mostra o erro sem reabrir a seção', async () => {
    const g = pendente();
    await salvarProfissao(g);
    await clicar(botao('Fechar'));
    await act(async () => { g.reject(new Error('unavailable')); });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(campo('profession')).toBeNull();
  });
});

describe('CadastroTab: acessibilidade', () => {
  it('o "Adicionar" de cada linha vazia diz o que adiciona', async () => {
    await montar();
    const rg = porLabel('Adicionar RG');
    expect(rg).toBeTruthy();
    expect(porLabel('Identidade').contains(rg)).toBe(true);
    expect(porLabel('Adicionar Estado civil')).toBeTruthy();
  });

  it('o "CPF inválido" fica ligado ao campo', async () => {
    await montar();
    await clicar(porLabel('Editar identidade'));
    await digitar(campo('cpf'), '123.456.789-00');
    const ids = campo('cpf').getAttribute('aria-describedby');
    expect(ids).toBeTruthy();
    expect(document.getElementById(ids).textContent).toBe('CPF inválido');
    expect(campo('cpf').getAttribute('aria-invalid')).toBe('true');
  });

  it('a seção aberta diz, à vista, que as outras esperam', async () => {
    await montar();
    await clicar(porLabel('Editar identidade'));
    expect(porLabel('Identidade').textContent).toContain('As outras seções esperam você salvar ou cancelar esta.');
  });

  it('nenhum campo do cadastro deixa o navegador preencher com os dados de quem está logado', async () => {
    const menor = { ...LEAD, birthDate: null, isMinor: true, guardian: { name: 'Ana', phone: '(51) 9 9555-4444', relationship: 'Mãe' } };
    await montar({ lead: menor });
    for (const rotulo of ['Editar identidade', 'Editar endereço', 'Editar contato de emergência', 'Editar dados pessoais']) {
      await clicar(porLabel(rotulo));
      const campos = [...document.body.querySelectorAll('input:not([type="hidden"]), select')];
      expect(campos.length, rotulo).toBeGreaterThan(0);
      campos.forEach((c) => expect(c.getAttribute('autocomplete'), `${rotulo}: ${c.name}`).toBe('off'));
      await clicar(botao('Cancelar'));
    }
  });
});
