// @vitest-environment jsdom
// O ContractModal numa tela só: plano, início e valor com desconto à vista. O
// modal é montado em jsdom e clicado; o commitMatricula, aqui um dublê, recebe o
// que o modal gravaria.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

vi.mock('../contractsWrites.js', () => ({ commitMatricula: vi.fn(async () => {}) }));
const { commitMatricula } = await import('../contractsWrites.js');
const { ContractModal } = await import('../../modals/ContractModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const D = (y, m, d, hh = 0, mi = 0) => new Date(y, m - 1, d, hh, mi);
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const appUser = { id: 'u1', name: 'Bruno', authUid: 'auth-1' };

const planos = [
  { id: 'p1', name: 'Musculação Trimestral', value: 510, durationMonths: 3, active: true, order: 1 },
  { id: 'p2', name: 'Musculação Semestral', value: 960, durationMonths: 6, active: true, order: 2 },
  { id: 'p3', name: 'Pilates Trimestral', value: 990, durationMonths: 3, active: true, order: 3 },
  { id: 'p4', name: 'Pilates Mensal', value: 349, durationMonths: 1, active: true, order: 4 }
];

let root = null;
async function montar(props, contratos = [], agora = D(2026, 10, 16, 10, 20), catalogo = planos) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(agora);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(GeneralConfigContext.Provider, { value: { planos: catalogo, contratos } },
        h(ContractModal, { appUser, db: {}, onClose: () => {}, onDone: () => {}, ...props }))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.clearAllMocks();
});

const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const opcao = (texto) => [...document.body.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes(texto)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
async function digitar(el, valor) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const rodape = () => document.body.querySelector('[data-slot="contract-footer"]');
const motivos = () => ['Fidelidade', 'Indicação', 'Campanha', 'Retorno', 'Outro'].map(botao);

const leadNovo = { id: 'l1', name: 'Rafael Moreira', status: 'Negociação' };

describe('ContractModal, matrícula', () => {
  it('mostra plano, início e valor na mesma tela, sem número de passo', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const texto = document.body.textContent;
    expect(texto).toContain('Plano');
    expect(texto).toContain('Início da vigência');
    expect(texto).toContain('Valor e desconto');
    // 3 planos + 2 inícios (matrícula não tem "Emendar").
    expect(document.body.querySelectorAll('[role="radio"]').length).toBe(5);
  });

  it('os motivos do desconto estão na tela e desligados até haver desconto', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(motivos().every(Boolean)).toBe(true);
    expect(motivos().every((b) => b.disabled)).toBe(true);
    expect(document.body.textContent).toContain('escolha quando houver desconto');
    expect(rodape().textContent).not.toContain('motivo');
    expect(motivos().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('a região viva do rodapé existe mesmo quando não falta nada, para o leitor de tela anunciar o que entra', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const regiao = rodape().querySelector('[role="status"]');
    expect(regiao).not.toBeNull();
    expect(regiao.textContent.trim()).toBe('');
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    expect(rodape().querySelector('[role="status"]')).toBe(regiao);
    expect(regiao.textContent).toContain('Escolha o motivo do desconto.');
  });

  // WCAG 2.5.3: o nome acessível começa pelo texto visível, para o comando de voz.
  it('os botões do tipo de desconto têm nome que contém o texto visível', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(document.body.querySelector('button[aria-label="% de desconto"]')).not.toBeNull();
    expect(document.body.querySelector('button[aria-label="R$ de desconto"]')).not.toBeNull();
  });

  it('o motivo escolhido não fica pressionado quando o desconto some', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    const campo = document.body.querySelector('input[aria-label="Valor do desconto"]');
    await digitar(campo, '10');
    await clicar(botao('Campanha'));
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Campanha').className).toContain('border-brand-600');

    await digitar(campo, '');
    expect(botao('Campanha').disabled).toBe(true);
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('false');
    expect(botao('Campanha').className).not.toContain('border-brand-600');
    expect(botao('Campanha').className).not.toContain('text-brand-700');
  });

  it('aplicar desconto liga os motivos e o rodapé pede o motivo até ele ser escolhido', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');

    expect(motivos().every((b) => !b.disabled)).toBe(true);
    expect(document.body.textContent).toContain('R$ 51,00 (10%)');
    expect(document.body.textContent).toContain('obrigatório');
    expect(rodape().textContent).toContain('Escolha o motivo do desconto.');
    expect(botao('Confirmar matrícula').disabled).toBe(true);

    await clicar(botao('Campanha'));
    expect(rodape().textContent).not.toContain('Escolha o motivo');
    expect(botao('Confirmar matrícula').disabled).toBe(false);
  });

  it('confirmar com desconto grava o valor final e o motivo', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));
    await clicar(botao('Confirmar matrícula'));

    expect(commitMatricula).toHaveBeenCalledTimes(1);
    const arg = commitMatricula.mock.calls[0][0];
    expect(arg.value).toBe(459);
    expect(arg.contractExtra).toEqual({ discountMode: 'percent', discountValue: 51, discountReason: 'Campanha' });
  });

  it('trocar de plano zera o desconto e o motivo', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));

    await clicar(opcao('Musculação Semestral'));

    expect(document.body.textContent).not.toContain('− R$');
    expect(motivos().every((b) => b.disabled)).toBe(true);
    expect(botao('Confirmar matrícula').disabled).toBe(false);
  });

  it('a busca troca a lista pelos planos achados, e escolher um limpa a busca', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'mensal');
    const linhas = [...document.body.querySelectorAll('[role="radiogroup"][aria-label="Plano"] [role="radio"]')];
    expect(linhas.length).toBe(1);
    expect(linhas[0].textContent).toContain('Pilates Mensal');

    await clicar(linhas[0]);
    expect(document.body.querySelector('input[placeholder="Buscar outro plano"]').value).toBe('');
    // Fora dos 3 mais vendidos, o plano escolhido entra como quarta linha, "Buscado".
    expect(document.body.textContent).toContain('Buscado');
  });

  it('outra data mostra o campo de data no título do início', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(document.body.querySelector('input[type="date"]')).toBeNull();
    await clicar(opcao('Outra data'));
    expect(document.body.querySelector('input[type="date"]')).not.toBeNull();
  });

  it('outra data no futuro avisa que o cliente só conta como ativo a partir dela', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-20');
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('A vigência só começa em 20/10/2026. Até lá');
    expect(faixa.textContent).not.toContain('—');
    expect(faixa.className).toContain('amber');
  });

  it('outra data no passado avisa que a matrícula é retroativa', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-14');
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Matrícula retroativa. A vigência começa em 14/10/2026, então 2 dias já terão passado');
    expect(faixa.textContent).not.toContain('—');
  });

  it('a faixa de vigência é uma região viva sempre montada e reserva três linhas', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.getAttribute('role')).toBe('status');
    expect(faixa.className).toContain('min-h-[78px]');
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-20');
    // O mesmo nó troca de texto e de tom, sem desmontar.
    expect(document.body.querySelector('[data-slot="start-status"]')).toBe(faixa);
    expect(faixa.getAttribute('role')).toBe('status');
  });
});

describe('ContractModal, sem plano ativo no catálogo', () => {
  it('o corpo avisa e o rodapé não pede um plano que não existe', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 10, 20), []);
    expect(document.body.textContent).toContain('Nenhum plano ativo no catálogo.');
    expect(rodape().textContent).not.toContain('Escolha um plano.');
    expect(botao('Confirmar matrícula').disabled).toBe(true);
  });
});

describe('ContractModal, início "Hoje"', () => {
  // O modal pôs `startsAt = new Date()` com a hora, e contava os dias de desvio
  // com daysBetween, que arredonda: depois do meio-dia "hoje" virava 1 dia à
  // frente e a faixa dizia que a vigência só começava amanhã. O teste roda às
  // 15h40 de propósito, porque às 10h20 o defeito não aparece.
  it('começar hoje à tarde continua sendo hoje, sem o aviso de vigência futura', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 15, 40));
    await clicar(opcao('Hoje'));
    const texto = document.body.textContent;
    expect(texto).not.toContain('A vigência só começa em');
    expect(texto).not.toContain('Matrícula retroativa');
  });
});

describe('ContractModal, renovação', () => {
  const inicio = D(2026, 9, 12);
  const fim = D(2026, 12, 12);
  const atual = { id: 'c1abcdef', leadId: 'l2', planId: 'p3', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
  const leadCliente = {
    id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentPlanName: 'Pilates Trimestral',
    currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo'
  };
  const props = { lead: leadCliente, mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef' };

  it('abre emendando, e a faixa de vigência diz que a emenda é perfeita', async () => {
    await montar(props, [atual]);
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Emenda perfeita, nenhum dia sem contrato.');
    expect(faixa.getAttribute('role')).toBe('status');
    expect(document.body.textContent).toContain('Renovar contrato');
    expect(botao('Confirmar renovação').disabled).toBe(false);
  });

  it('começar hoje, com o atual ainda vigente, avisa que o atual passa a terminar antes', async () => {
    await montar(props, [atual]);
    await clicar(opcao('Hoje'));
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('antes do previsto');
    expect(faixa.className).toContain('rose');
  });
});
