// @vitest-environment jsdom
// O ContractModal numa tela só: plano, início e valor com desconto à vista. O
// modal é montado em jsdom e clicado; o commitMatricula, aqui um dublê, recebe o
// que o modal gravaria.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
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
async function renderizar(arvore, agora, falsos = ['Date']) {
  vi.useFakeTimers({ toFake: falsos });
  vi.setSystemTime(agora);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast }, arvore));
  });
}
const modal = (props) => h(ContractModal, { appUser, db: {}, onClose: () => {}, onDone: () => {}, ...props });
async function montar(props, contratos = [], agora = D(2026, 10, 16, 10, 20), catalogo = planos, falsos = ['Date']) {
  await renderizar(h(GeneralConfigContext.Provider, { value: { planos: catalogo, contratos } }, modal(props)), agora, falsos);
}
const anunciador = () => document.body.querySelector('[data-slot="contract-announcer"]');
const FALSOS = ['Date', 'setTimeout', 'clearTimeout'];
// Toda região viva do diálogo. Só valem o anunciador, a linha de apoio do Plano e,
// depois de uma falha ao gravar, o alerta do rodapé.
// Inclui o que é vivo por padrão: role log, marquee, timer e status (e o <output>).
const SELETOR_VIVAS = ['[aria-live]', '[role="status"]', '[role="alert"]', '[role="log"]', '[role="marquee"]', '[role="timer"]', 'output']
  .map((q) => `[role="dialog"] ${q}`).join(', ');
const regioesVivas = () => [...document.body.querySelectorAll(SELETOR_VIVAS)];
const regioesVivasAlemDasPermitidas = () => {
  const apoioDoPlano = [...document.body.querySelectorAll('[role="dialog"] p[aria-live="polite"]')]
    .find((el) => /mais vendidos|no catálogo ativo/.test(el.textContent));
  const permitidas = [anunciador(), apoioDoPlano, document.body.querySelector('[role="dialog"] [role="alert"]')].filter(Boolean);
  return regioesVivas().filter((el) => !permitidas.includes(el));
};
// O jsdom não implementa o inert (o clique passa por cima). Este dublê faz o que o
// navegador faz: descarta clique, digitação e teclas dentro de um [inert].
function emularInert() {
  const tipos = ['click', 'input', 'change', 'keydown', 'pointerdown'];
  const barrar = (e) => {
    if (e.target instanceof Element && e.target.closest('[inert]')) { e.stopPropagation(); e.preventDefault(); }
  };
  tipos.forEach((t) => document.addEventListener(t, barrar, true));
  return () => tipos.forEach((t) => document.removeEventListener(t, barrar, true));
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
const tecla = async (el, key, init = {}) => {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  await act(async () => { el.dispatchEvent(evento); });
  return evento;
};
const radios = (grupo) => [...document.body.querySelectorAll(`[role="radiogroup"][aria-label="${grupo}"] [role="radio"]`)];
const marcado = (grupo) => radios(grupo).find((r) => r.getAttribute('aria-checked') === 'true');
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

  // O leitor de tela lê a cópia do anunciador, uma vez só: o texto visível da faixa
  // e do rodapé fica escondido dele e não é região viva.
  it('a faixa e o texto do rodapé visíveis ficam escondidos do leitor de tela, e só há uma região viva', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    expect(rodape().textContent).toContain('Escolha o motivo do desconto.');

    expect(document.body.querySelector('[data-slot="start-status"]').getAttribute('aria-hidden')).toBe('true');
    const visivel = rodape().querySelector('span[aria-hidden="true"]');
    expect(visivel.textContent).toContain('Escolha o motivo do desconto.');
    expect(visivel.getAttribute('role')).toBeNull();
    expect(regioesVivasAlemDasPermitidas()).toEqual([]);
    expect(regioesVivas().length).toBe(2);
    expect(document.body.querySelectorAll('[role="status"]').length).toBe(1);
    expect(document.body.querySelector('[role="status"]')).toBe(anunciador());
  });

  // O guarda de regiões vivas precisa reprovar quem acrescentar uma: aqui, a pílula do desconto.
  it('um aria-live novo na pílula do desconto reprova o guarda de regiões vivas', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    const pilula = [...document.body.querySelectorAll('span')].find((el) => el.textContent.includes('(10%)'));
    expect(pilula).toBeTruthy();
    expect(regioesVivasAlemDasPermitidas()).toEqual([]);
    pilula.setAttribute('aria-live', 'polite');
    expect(regioesVivasAlemDasPermitidas()).toEqual([pilula]);
  });

  it('um role="log" (vivo por padrão) no "Valor do contrato" também reprova o guarda', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const valor = [...document.querySelectorAll('aside[aria-label="Recibo"] span')].find((el) => el.textContent === 'Valor do contrato').nextElementSibling;
    expect(valor).toBeTruthy();
    expect(regioesVivasAlemDasPermitidas()).toEqual([]);
    for (const papel of ['log', 'marquee', 'timer']) {
      valor.setAttribute('role', papel);
      expect(regioesVivasAlemDasPermitidas()).toEqual([valor]);
    }
    valor.removeAttribute('role');
    expect(regioesVivasAlemDasPermitidas()).toEqual([]);
  });

  it('o alerta da falha ao gravar é a única região viva a mais, e só depois da falha', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    commitMatricula.mockRejectedValueOnce(new Error('sem rede'));
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    await clicar(botao('Confirmar matrícula'));
    expect(document.body.querySelector('[role="alert"]')).not.toBeNull();
    expect(regioesVivasAlemDasPermitidas()).toEqual([]);
    expect(regioesVivas().length).toBe(3);
    erro.mockRestore();
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

    // Ligando o desconto de novo, o motivo de antes não volta marcado.
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('false');
    expect(rodape().textContent).toContain('Escolha o motivo do desconto.');
  });

  it('trocar o tipo de desconto solta o motivo: ele não volta marcado quando o novo valor é digitado', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('true');

    await clicar(botao('R$'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '50');

    expect(motivos().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(rodape().textContent).toContain('Escolha o motivo do desconto.');
    expect(botao('Confirmar matrícula').disabled).toBe(true);
  });

  it('clicar no plano que já está marcado mantém o desconto e o motivo', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));

    await clicar(opcao('Musculação Trimestral'));

    expect(document.body.textContent).toContain('R$ 51,00 (10%)');
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Confirmar matrícula').disabled).toBe(false);
  });

  it('apagar o valor do desconto solta o motivo, e outro valor pede o motivo de novo', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    const campo = document.body.querySelector('input[aria-label="Valor do desconto"]');
    await digitar(campo, '10');
    await clicar(botao('Campanha'));

    await digitar(campo, '');
    await digitar(campo, '20');

    expect(motivos().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(rodape().textContent).toContain('Escolha o motivo do desconto.');
    expect(botao('Confirmar matrícula').disabled).toBe(true);
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

  it('outra data amanhã, à tarde, já avisa que a vigência só começa amanhã', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 15, 40));
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-17');
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('A vigência só começa em 17/10/2026. Até lá');
  });

  it('outra data ontem avisa que a matrícula é retroativa em 1 dia, no singular', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 15, 40));
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-15');
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Matrícula retroativa. A vigência começa em 15/10/2026, então 1 dia já terá passado quando o contrato for criado.');
  });

  it('outra data no passado avisa que a matrícula é retroativa', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-14');
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Matrícula retroativa. A vigência começa em 14/10/2026, então 2 dias já terão passado');
    expect(faixa.textContent).not.toContain('—');
  });

  it('a faixa de vigência reserva três linhas, quatro quando fica estreita, e troca de texto e de tom no mesmo nó', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.className).toContain('min-h-[79px]');
    expect(faixa.className).toContain('@max-md:min-h-[98px]');
    // A consulta é ao tamanho da própria seção, não da tela.
    expect(faixa.parentElement.tagName).toBe('SECTION');
    expect(faixa.parentElement.className).toContain('@container');
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-20');
    expect(document.body.querySelector('[data-slot="start-status"]')).toBe(faixa);
  });

  // Digitando a data, cada pedaço é uma data válida e a faixa muda a cada tecla; um
  // leitor de tela leria "25/12/202, então 666134 dias". A faixa visível atualiza na
  // hora e deixa de ser região viva; quem anuncia é um elemento só para leitor de
  // tela, que recebe o mesmo texto depois de uma pausa.
  it('a faixa visível não é região viva; o anunciador repete o texto só depois de uma pausa', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 10, 20), planos, ['Date', 'setTimeout', 'clearTimeout']);
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    const voz = anunciador();
    expect(faixa.getAttribute('role')).toBeNull();
    expect(faixa.getAttribute('aria-live')).toBeNull();
    expect(faixa.getAttribute('aria-hidden')).toBe('true');
    expect(voz.getAttribute('role')).toBe('status');
    expect(voz.className).toContain('sr-only');
    const inicial = faixa.textContent;
    expect(inicial).toContain('Vigência de 16/10/2026');
    // Na abertura, o texto que já estava lá não é um anúncio novo.
    expect(voz.textContent).toBe(inicial);

    const ditos = new Set([voz.textContent]);
    const passar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); ditos.add(anunciador().textContent); };

    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-20');
    expect(faixa.textContent).toContain('A vigência só começa em 20/10/2026');
    await passar(400);
    await digitar(document.body.querySelector('input[type="date"]'), '2026-10-14');
    expect(faixa.textContent).toContain('Matrícula retroativa');
    // A faixa já mostra o texto novo; o anunciador ainda tem o antigo.
    expect(voz.textContent).toBe(inicial);
    await passar(400);
    expect(voz.textContent).toBe(inicial);
    await passar(299);
    expect(voz.textContent).toBe(inicial);
    await passar(1);

    expect(voz.textContent).toBe(faixa.textContent);
    expect(voz.textContent).toContain('Matrícula retroativa');
    // O texto do meio do caminho nunca foi anunciado, e o nó é o mesmo o tempo todo.
    expect([...ditos].some((t) => t.includes('20/10/2026'))).toBe(false);
    expect(anunciador()).toBe(voz);
  });
});

describe('ContractModal, teclado e foco', () => {
  it('só um rádio de cada grupo fica no Tab, o marcado', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    for (const grupo of ['Plano', 'Início da vigência']) {
      const noTab = radios(grupo).filter((r) => r.getAttribute('tabindex') === '0');
      expect(noTab).toEqual([marcado(grupo)]);
      expect(radios(grupo).filter((r) => r !== marcado(grupo)).every((r) => r.getAttribute('tabindex') === '-1')).toBe(true);
    }
  });

  it('com a busca aberta e o plano marcado fora dos achados, o primeiro achado fica no Tab', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'pilates');
    const achados = radios('Plano');
    expect(achados.length).toBe(2);
    expect(achados.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1']);
  });

  it('seta para a direita no Início marca e foca o próximo cartão', async () => {
    const inicio = D(2026, 9, 12);
    const fim = D(2026, 12, 12);
    const atual = { id: 'c1abcdef', leadId: 'l2', planId: 'p3', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
    const lead = { id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentPlanName: 'Pilates Trimestral', currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo' };
    await montar({ lead, mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef' }, [atual]);
    expect(marcado('Início da vigência').textContent).toContain('Emendar');
    opcao('Emendar').focus();
    await tecla(opcao('Emendar'), 'ArrowRight');
    expect(opcao('Hoje').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(opcao('Hoje'));
    expect(opcao('Hoje').getAttribute('tabindex')).toBe('0');
    expect(opcao('Emendar').getAttribute('tabindex')).toBe('-1');
  });

  it('as setas dão a volta, e Home e End vão às pontas', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const [primeiro, , ultimo] = radios('Plano');
    primeiro.focus();
    await tecla(primeiro, 'ArrowUp');
    expect(document.activeElement).toBe(ultimo);
    await tecla(ultimo, 'ArrowDown');
    expect(document.activeElement).toBe(primeiro);
    await tecla(primeiro, 'End');
    expect(document.activeElement).toBe(ultimo);
    await tecla(ultimo, 'Home');
    expect(document.activeElement).toBe(primeiro);
  });

  // Escolher plano zera o desconto e limpa a busca, então no Plano a seta só move o
  // foco; Enter, Espaço (o botão nativo clica) e o clique escolhem.
  it('no Plano a seta só move o foco: não escolhe, não limpa a busca e não zera o desconto', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'tral');
    const achados = radios('Plano');
    expect(achados.length).toBe(3);
    const marcadoAntes = marcado('Plano');

    achados[0].focus();
    const evento = await tecla(achados[0], 'ArrowDown');

    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(achados[1]);
    expect(marcado('Plano')).toBe(marcadoAntes);
    expect(document.body.querySelector('input[placeholder="Buscar outro plano"]').value).toBe('tral');
    expect(radios('Plano').length).toBe(3);
    expect(document.body.textContent).toContain('R$ 51,00 (10%)');
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('true');
    // O Tab itinerante acompanha o foco: um único tabindex 0, no rádio focado.
    expect(radios('Plano').filter((r) => r.getAttribute('tabindex') === '0')).toEqual([achados[1]]);
  });

  it('no Plano, Enter ou Espaço no rádio focado escolhem, pelo mesmo caminho do clique', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'tral');
    const achados = radios('Plano');
    achados[0].focus();
    await tecla(achados[0], 'ArrowDown');

    // No navegador, Enter e Espaço num botão disparam o clique; o jsdom não faz isso sozinho.
    await clicar(document.activeElement);

    expect(marcado('Plano').textContent).toContain('Musculação Semestral');
    expect(document.body.querySelector('input[placeholder="Buscar outro plano"]').value).toBe('');
    expect(document.body.textContent).not.toContain('− R$');
    expect(motivos().every((b) => b.disabled)).toBe(true);
    expect(radios('Plano').filter((r) => r.getAttribute('tabindex') === '0')).toEqual([marcado('Plano')]);
  });

  it('o Tab itinerante volta ao marcado quando o foco sai do grupo de planos', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const marcadoAntes = marcado('Plano');
    const outro = radios('Plano').find((r) => r !== marcadoAntes);
    outro.focus();
    await act(async () => {});
    expect(outro.getAttribute('tabindex')).toBe('0');
    document.body.querySelector('input[placeholder="Buscar outro plano"]').focus();
    await act(async () => {});
    expect(radios('Plano').filter((r) => r.getAttribute('tabindex') === '0')).toEqual([marcadoAntes]);
  });

  it('com Shift, Ctrl, Alt ou Meta as setas, Home e End não fazem nada nos dois grupos', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    for (const grupo of ['Plano', 'Início da vigência']) {
      const lista = radios(grupo);
      const atual = marcado(grupo);
      atual.focus();
      for (const init of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
        for (const key of ['ArrowDown', 'ArrowRight', 'Home', 'End']) {
          const evento = await tecla(atual, key, init);
          expect(evento.defaultPrevented).toBe(false);
        }
      }
      expect(document.activeElement).toBe(atual);
      expect(marcado(grupo)).toBe(atual);
      expect(radios(grupo)).toEqual(lista);
    }
  });

  it('a seta tratada chama preventDefault nos dois grupos', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    for (const grupo of ['Plano', 'Início da vigência']) {
      const atual = marcado(grupo);
      atual.focus();
      expect((await tecla(atual, 'ArrowDown')).defaultPrevented).toBe(true);
    }
  });

  it('clicar em "Outra data" leva o foco para o campo de data', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(opcao('Outra data'));
    const campo = document.body.querySelector('input[type="date"]');
    expect(document.activeElement).toBe(campo);
    expect(campo.getAttribute('aria-label')).toBe('Data de início');
    expect(campo.className).toContain('dark:[color-scheme:dark]');
  });

  // A seta seguinte, com o foco no campo de data, soma ou tira um dia: numa renovação
  // isso encurtaria o contrato atual sem a pessoa perceber.
  it('escolher "Outra data" pela seta marca o cartão e deixa o foco nele, não no campo de data', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    opcao('Hoje').focus();
    await tecla(opcao('Hoje'), 'ArrowRight');
    expect(opcao('Outra data').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(opcao('Outra data'));
    expect(document.body.querySelector('input[type="date"]')).not.toBeNull();
    expect(document.activeElement).not.toBe(document.body.querySelector('input[type="date"]'));
  });

  it('ativar o cartão "Outra data" já marcado leva o foco ao campo de data', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    opcao('Hoje').focus();
    await tecla(opcao('Hoje'), 'ArrowRight');
    await clicar(opcao('Outra data'));
    expect(document.activeElement).toBe(document.body.querySelector('input[type="date"]'));
  });

  it('limpar a busca devolve o foco ao campo de busca, com alvo de 24 px', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const busca = document.body.querySelector('input[placeholder="Buscar outro plano"]');
    await digitar(busca, 'mensal');
    const limpar = document.body.querySelector('button[aria-label="Limpar busca"]');
    expect(limpar.className).toContain('size-6');
    limpar.focus();
    await clicar(limpar);
    expect(busca.value).toBe('');
    expect(document.activeElement).toBe(busca);
  });
});

describe('ContractModal, nomes e leitura', () => {
  it('o campo do valor se chama pelo que é em cada tipo de desconto', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    expect(document.body.querySelector('input[aria-label="Valor do desconto"]')).not.toBeNull();
    await clicar(botao('Valor final'));
    expect(document.body.querySelector('input[aria-label="Valor final do contrato"]')).not.toBeNull();
    expect(document.body.querySelector('input[aria-label="Valor do desconto"]')).toBeNull();
  });

  it('a linha de apoio do plano avisa o leitor de tela quando a lista filtra', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const apoio = () => [...document.body.querySelectorAll('[aria-live="polite"]')].find((el) => /mais vendidos|no catálogo ativo/.test(el.textContent));
    const antes = apoio();
    expect(antes.textContent).toContain('Os 3 mais vendidos.');
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'mensal');
    expect(apoio()).toBe(antes);
    expect(antes.textContent).toContain('1 plano no catálogo ativo');
  });

  it('o diálogo não declara uma descrição que não existe, sem o aviso do Radix', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(document.body.querySelector('[role="dialog"]').hasAttribute('aria-describedby')).toBe(false);
    expect(aviso.mock.calls.filter((c) => String(c[0]).includes('Description'))).toEqual([]);
    aviso.mockRestore();
  });

  it('o recibo não escreve travessão no meio da frase quando falta plano ou data', async () => {
    const inicio = D(2026, 9, 12);
    const fim = D(2026, 12, 12);
    const atual = { id: 'c1abcdef', leadId: 'l2', planId: 'p3', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
    const lead = { id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo' };
    await montar({ lead, mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef' }, [atual]);
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '');
    const recibo = document.body.querySelector('aside[aria-label="Recibo"]').textContent;
    expect(recibo).toContain('Atual, sem plano');
    expect(recibo).toContain('sem data');
    expect(recibo).not.toMatch(/—\s*a\s*—|até\s*—|,\s*—/);
  });

  it('o texto de apoio da linha e do cartão marcados usa o tom que passa no contraste', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const linha = marcado('Plano');
    expect([...linha.querySelectorAll('span')].some((el) => el.className.includes('text-slate-600'))).toBe(true);
    expect(marcado('Início da vigência').querySelector('.num').className).toContain('text-slate-600');
    expect(botao('Sem desconto').className).not.toContain('text-slate-600');
    expect(botao('%').className).toContain('text-slate-600');
    expect(botao('Sem desconto').className).toContain('dark:bg-white/[0.14]');
    expect(document.body.querySelector('input[placeholder="Buscar outro plano"]').className).toContain('placeholder:text-slate-500');
    expect(linha.querySelector('span').className).toContain('border-brand-600');
    const naoMarcada = radios('Plano').find((r) => r !== linha);
    expect(naoMarcada.querySelector('span').className).toContain('border-slate-500');
  });
});

// Medido no Chromium com a Geist: a linha do plano media 55,25 px (58 com o chip, que tem 24 px
// e deixava o nome com a altura de linha herdada), e a lista reservava 156 a 208 px pensando
// em linhas de 52. A 4ª linha ("Buscado") saía cortada, com rolagem por dentro. Agora toda
// linha tem 56 px, com ou sem chip, e a lista reserva 3 linhas (170 px) a 4 (226 px).
describe('ContractModal, lista de planos', () => {
  const lista = () => document.body.querySelector('[role="radiogroup"][aria-label="Plano"]');

  it('toda linha tem a mesma altura fixa, com ou sem chip, e a lista reserva 3 a 4 linhas sem rolar por dentro', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(lista().className).toContain('min-h-[170px]');
    expect(lista().className).toContain('max-h-[226px]');
    for (const linha of radios('Plano')) {
      expect(linha.className).toContain('h-14');
      // O nome tem altura de linha explícita (20 px) numa faixa de 24 px, a mesma do chip.
      expect(linha.querySelector('span.truncate').className).toContain('leading-5');
      expect(linha.querySelector('span.truncate').parentElement.className).toContain('h-6');
    }
    // Buscando e escolhendo um plano fora dos 3 mais vendidos: a 4ª linha ("Buscado") tem o mesmo tamanho.
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'mensal');
    await clicar(radios('Plano')[0]);
    const linhas = radios('Plano');
    expect(linhas.length).toBe(4);
    expect(document.body.textContent).toContain('Buscado');
    for (const linha of linhas) expect(linha.className).toContain('h-14');
  });

  it('o nome do plano leva o nome inteiro no title, para o corte com reticências não esconder qual é', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    for (const linha of radios('Plano')) {
      const nome = linha.querySelector('span.truncate');
      expect(nome.getAttribute('title')).toBe(nome.textContent);
    }
  });

  // Entre 768 e cerca de 845 px a seção tem uns 370 a 445 px: o chip dividia o nome com 130 px
  // e a busca por "musc" mostrava "Mu…" duas vezes. Na seção estreita (menos de 32rem) o chip
  // sai e o "3 meses" desce para a linha do valor mensal, devolvendo ao nome a largura de uma coluna.
  it('na seção estreita o chip sai e os meses descem para a linha do valor mensal', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(lista().closest('section').className).toContain('@container');
    await digitar(document.body.querySelector('input[placeholder="Buscar outro plano"]'), 'musc');
    const linha = radios('Plano')[0];
    const chip = [...linha.querySelectorAll('span')].find((el) => el.textContent === 'Mais vendido');
    expect(chip.className).toContain('@max-lg:hidden');
    expect(linha.className).toContain('@max-lg:grid-cols-[18px_minmax(0,1fr)_88px]');
    const colunaMeses = [...linha.children].find((el) => el.className.includes('@max-lg:hidden'));
    expect(colunaMeses.textContent).toBe('3 meses');
    const sublinha = linha.querySelector('span.num.block');
    expect(sublinha.querySelector('.\\@lg\\:hidden').textContent).toContain('3 meses');
  });
});

// Na main a linha do contrato atual quebrava (flex-wrap). Com o texto em `truncate`, a 768 px
// sobrava "…vence em 12/12/2…" e o valor do contrato (R$ 897,00), que não aparece em outro
// lugar do modal, ficava escondido.
describe('ContractModal, subtítulo do cabeçalho', () => {
  it('a linha do contrato atual quebra de linha em vez de cortar o valor e o vencimento', async () => {
    const inicio = D(2026, 9, 12);
    const fim = D(2026, 12, 12);
    const atual = { id: 'c1abcdef', leadId: 'l2', planId: 'p3', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
    const lead = { id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentPlanName: 'Pilates Trimestral', currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo' };
    await montar({ lead, mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef' }, [atual]);
    const sub = [...document.body.querySelectorAll('[role="dialog"] span')].find((el) => el.textContent.startsWith('Contrato atual'));
    expect(sub.textContent).toContain('R$ 897,00');
    expect(sub.textContent).toContain('vence em 12/12/2026');
    expect(sub.className).not.toContain('truncate');
    expect(sub.className).toContain('min-w-0');
    expect(sub.parentElement.className).toContain('flex-wrap');
    // O nome também pode quebrar se for longo, em vez de empurrar o resto para fora.
    expect(sub.previousElementSibling.className).not.toContain('flex-none');
    expect(sub.previousElementSibling.className).toContain('min-w-0');
  });
});

describe('ContractModal, o que se grava sem desconto', () => {
  const nenhum ={ discountMode: 'nenhum', discountValue: 0, discountReason: null };
  const gravado = () => commitMatricula.mock.calls[0][0];

  it.each([['vazio', null], ['zero', '0']])('"%" com o campo %s grava como sem desconto', async (_nome, valor) => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    if (valor !== null) await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), valor);
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula).toHaveBeenCalledTimes(1);
    expect(gravado().contractExtra).toEqual(nenhum);
    expect(gravado().value).toBe(510);
  });

  it('"Valor final" acima da tabela não é desconto: grava como sem desconto, pelo valor digitado', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('Valor final'));
    await digitar(document.body.querySelector('input[aria-label="Valor final do contrato"]'), '600');
    await clicar(botao('Confirmar matrícula'));
    expect(gravado().contractExtra).toEqual(nenhum);
    expect(gravado().value).toBe(600);
  });

  // A tabela pode ser reajustada para baixo com o modal aberto. O desconto some e o motivo
  // escolhido antes fica no estado: o que se grava não pode levá-lo.
  it('se a tabela cai e o desconto some, o motivo de antes não é gravado', async () => {
    let mudarCatalogo;
    function Casca() {
      const [lista, setLista] = useState(planos);
      mudarCatalogo = setLista;
      return h(GeneralConfigContext.Provider, { value: { planos: lista, contratos: [] } }, modal({ lead: leadNovo, mode: 'matricula' }));
    }
    await renderizar(h(Casca), D(2026, 10, 16, 10, 20));
    await clicar(botao('Valor final'));
    await digitar(document.body.querySelector('input[aria-label="Valor final do contrato"]'), '400');
    await clicar(botao('Campanha'));
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('true');

    await act(async () => { mudarCatalogo(planos.map((p) => (p.id === 'p1' ? { ...p, value: 300 } : p))); });
    expect(botao('Campanha').disabled).toBe(true);
    // O motivo ficou no estado, mas sem desconto nenhum chip aparece como marcado.
    expect(motivos().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    await clicar(botao('Confirmar matrícula'));

    expect(gravado().contractExtra).toEqual(nenhum);
    expect(gravado().value).toBe(400);
  });
});

describe('ContractModal, fechar', () => {
  const esc = async () => {
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  };

  it('Esc fecha o modal quando nada está sendo enviado', async () => {
    const onClose = vi.fn();
    await montar({ lead: leadNovo, mode: 'matricula', onClose });
    await esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc durante o envio não fecha o modal', async () => {
    const onClose = vi.fn();
    commitMatricula.mockImplementationOnce(() => new Promise(() => {}));
    await montar({ lead: leadNovo, mode: 'matricula', onClose });
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula).toHaveBeenCalledTimes(1);
    await esc();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicar fora durante o envio não fecha o modal, e fora do envio fecha', async () => {
    const fora = async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
      await act(async () => {
        document.body.querySelector('[data-slot="dialog-overlay"]').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      });
    };
    const onClose = vi.fn();
    commitMatricula.mockImplementationOnce(() => new Promise(() => {}));
    await montar({ lead: leadNovo, mode: 'matricula', onClose });
    await fora();
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await clicar(botao('Confirmar matrícula'));
    await fora();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ContractModal, durante o envio o formulário', () => {
  it('fica travado: o recibo, a faixa, o anunciador e a gravação não mudam; depois de uma falha volta a editar', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejeitar;
    commitMatricula.mockImplementationOnce(() => new Promise((_, rej) => { rejeitar = rej; }));
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 10, 20), planos, FALSOS);
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));
    const recibo = () => document.body.querySelector('aside[aria-label="Recibo"]').textContent;
    const faixa = () => document.body.querySelector('[data-slot="start-status"]').textContent;
    const confirmar = botao('Confirmar matrícula');
    confirmar.focus();
    expect(document.body.querySelector('[inert]')).toBeNull();

    await clicar(confirmar);

    // A coluna de decisões inteira fica inert; o Confirmar, o Cancelar e o X ficam de fora.
    const travado = document.body.querySelector('[inert]');
    expect(travado).not.toBeNull();
    for (const dentro of [opcao('Musculação Semestral'), opcao('Hoje'), botao('%'), botao('Campanha'),
      document.body.querySelector('input[placeholder="Buscar outro plano"]'), document.body.querySelector('input[aria-label="Valor do desconto"]')]) {
      expect(travado.contains(dentro)).toBe(true);
    }
    for (const fora of [confirmar, botao('Cancelar'), document.body.querySelector('button[aria-label="Fechar"]')]) {
      expect(travado.contains(fora)).toBe(false);
    }
    expect(document.activeElement).toBe(confirmar);

    const reciboAntes = recibo();
    const faixaAntes = faixa();
    const vozAntes = anunciador().textContent;
    expect(reciboAntes).toContain('Musculação Trimestral');
    expect(reciboAntes).toContain('R$ 459,00');

    const desfazer = emularInert();
    try {
      await clicar(opcao('Musculação Semestral'));
      await clicar(botao('R$'));
      await clicar(botao('Sem desconto'));
      await clicar(botao('Indicação'));
      await clicar(opcao('Outra data'));
      await act(async () => { vi.advanceTimersByTime(800); });

      expect(recibo()).toBe(reciboAntes);
      expect(faixa()).toBe(faixaAntes);
      expect(anunciador().textContent).toBe(vozAntes);
      expect(anunciador().textContent).not.toContain('6 meses');
      expect(commitMatricula).toHaveBeenCalledTimes(1);
      const arg = commitMatricula.mock.calls[0][0];
      expect(arg.plan.id).toBe('p1');
      expect(arg.value).toBe(459);
      expect(arg.contractExtra).toEqual({ discountMode: 'percent', discountValue: 51, discountReason: 'Campanha' });

      // Falhou: o formulário volta a ser editável.
      await act(async () => { rejeitar(new Error('sem rede')); });
      expect(document.body.querySelector('[inert]')).toBeNull();
      await clicar(opcao('Musculação Semestral'));
      expect(recibo()).toContain('Musculação Semestral');
      expect(recibo()).toContain('R$ 960,00');
    } finally {
      desfazer();
      erro.mockRestore();
    }
  });
});

describe('ContractModal, durante o envio', () => {
  it('o Confirmar não perde o foco e um segundo clique não grava de novo; o Cancelar fica desligado', async () => {
    commitMatricula.mockImplementationOnce(() => new Promise(() => {}));
    await montar({ lead: leadNovo, mode: 'matricula' });
    const confirmar = botao('Confirmar matrícula');
    confirmar.focus();
    await clicar(confirmar);

    expect(commitMatricula).toHaveBeenCalledTimes(1);
    expect(confirmar.textContent).toContain('Salvando');
    expect(confirmar.disabled).toBe(false);
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(confirmar);
    expect(botao('Cancelar').disabled).toBe(true);

    await clicar(confirmar);
    expect(commitMatricula).toHaveBeenCalledTimes(1);
  });

  // Como na main: com o cache persistente do Firestore e a internet fora, o batch.commit()
  // fica pendente até a rede voltar, e o X é a única saída. A gravação segue na fila, e
  // se falhar o toast de erro aparece fora do modal. Esc, clique fora e Cancelar seguem travados.
  it('o X do cabeçalho continua ligado durante o envio e fecha o modal, sem mudar o nome nem o foco', async () => {
    const onClose = vi.fn();
    commitMatricula.mockImplementationOnce(() => new Promise(() => {}));
    await montar({ lead: leadNovo, mode: 'matricula', onClose });
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula).toHaveBeenCalledTimes(1);

    const x = document.body.querySelector('button[aria-label="Fechar"]');
    expect(x.disabled).toBe(false);
    expect(x.getAttribute('title')).toBe('Fechar');
    x.focus();
    expect(document.activeElement).toBe(x);

    await clicar(x);
    expect(onClose).toHaveBeenCalledTimes(1);
    // A gravação em andamento não é cancelada nem repetida.
    expect(commitMatricula).toHaveBeenCalledTimes(1);
  });

  it('uma trava continua desligando o botão de verdade', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    const confirmar = botao('Confirmar matrícula');
    expect(confirmar.disabled).toBe(true);
    expect(confirmar.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('ContractModal, anunciador único', () => {
  const passar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
  const vezes = (texto, trecho) => texto.split(trecho).length - 1;

  it('com a data apagada, "Escolha a data de início." é anunciada uma vez só', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 10, 20), planos, FALSOS);
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '');
    expect(document.body.querySelector('[data-slot="start-status"]').textContent).toContain('Escolha a data de início.');
    expect(rodape().textContent).toContain('Escolha a data de início.');

    await passar(700);

    expect(vezes(anunciador().textContent, 'Escolha a data de início.')).toBe(1);
  });

  it('com a trava e o motivo diferentes, o anunciador traz a frase da faixa e a do rodapé', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 10, 20), planos, FALSOS);
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    const faixa = document.body.querySelector('[data-slot="start-status"]').textContent;
    expect(faixa).toContain('Vigência de 16/10/2026');
    // Na hora, o anunciador ainda tem só a faixa de antes; depois da pausa, as duas frases.
    expect(anunciador().textContent).not.toContain('Escolha o motivo do desconto.');

    await passar(700);

    expect(anunciador().textContent).toBe(`${faixa} Escolha o motivo do desconto.`);
  });

  it('sem plano ativo no catálogo, o anunciador fica em silêncio', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' }, [], D(2026, 10, 16, 10, 20), [], FALSOS);
    await passar(700);
    expect(anunciador().textContent).toBe('');
  });

  // Numa renovação, as datas parciais do ano (0002, 0020, 0202) caem na regra dos dois
  // dias e o rodapé diz "Veja o aviso da vigência." no meio da digitação. Isso não vale
  // para a data final e não pode ser lido.
  it('digitar o ano da "Outra data" numa renovação anuncia só o resultado final', async () => {
    const inicio = D(2026, 9, 12);
    const fim = D(2026, 12, 12);
    const atual = { id: 'c1abcdef', leadId: 'l2', planId: 'p3', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
    const lead = { id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentPlanName: 'Pilates Trimestral', currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo' };
    await montar({ lead, mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef' }, [atual], D(2026, 10, 16, 10, 20), planos, FALSOS);
    const inicial = anunciador().textContent;
    expect(inicial).toContain('Emenda perfeita');

    await clicar(opcao('Outra data'));
    const ditos = new Set([anunciador().textContent]);
    const campo = () => document.body.querySelector('input[type="date"]');
    for (const parcial of ['0002-12-20', '0020-12-20', '0202-12-20']) {
      await digitar(campo(), parcial);
      await passar(100);
      ditos.add(anunciador().textContent);
    }
    // No meio da digitação o rodapé visível já manda ver o aviso...
    expect(rodape().textContent).toContain('Veja o aviso da vigência.');
    await digitar(campo(), '2026-12-20');
    await passar(100);
    ditos.add(anunciador().textContent);
    expect(rodape().textContent).not.toContain('Veja o aviso da vigência.');

    await passar(700);

    // ...mas o anunciador nunca o disse, e o final é o aviso da data certa (7 dias de lacuna).
    expect([...ditos].every((t) => !t.includes('Veja o aviso da vigência.') && !t.includes('precisa começar a partir de'))).toBe(true);
    expect(anunciador().textContent).toContain('Ficam 7 dias sem contrato ativo');
    expect(anunciador().textContent).toBe(document.body.querySelector('[data-slot="start-status"]').textContent);
  });
});

describe('ContractModal, gravação bem-sucedida', () => {
  // Sem o onDone o modal não fecha e um segundo clique grava de novo.
  it('na matrícula, o commit resolve, o onDone é chamado uma vez e o toast diz "Matrícula realizada!"', async () => {
    const onDone = vi.fn();
    await montar({ lead: leadNovo, mode: 'matricula', onDone });
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Matrícula realizada!');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('na renovação, o commit resolve, o onDone é chamado uma vez e o toast diz "Renovação registrada!"', async () => {
    const inicio = D(2026, 9, 12);
    const fim = D(2026, 12, 12);
    const atual = { id: 'c1abcdef', leadId: 'l2', planId: 'p3', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
    const lead = { id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentPlanName: 'Pilates Trimestral', currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo' };
    const onDone = vi.fn();
    await montar({ lead, mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef', onDone }, [atual]);
    await clicar(botao('Confirmar renovação'));
    expect(commitMatricula).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Renovação registrada!');
  });

  it('se a gravação falha, o onDone não é chamado e não há toast de sucesso', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    commitMatricula.mockRejectedValueOnce(new Error('sem rede'));
    const onDone = vi.fn();
    await montar({ lead: leadNovo, mode: 'matricula', onDone });
    await clicar(botao('Confirmar matrícula'));
    expect(onDone).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    erro.mockRestore();
  });
});

describe('ContractModal, falha ao gravar', () => {
  // Com o modal aberto o Radix põe aria-hidden no #root, e o toast fica fora do que o leitor de tela ouve.
  it('mostra o aviso dentro do modal, num alerta, além do toast', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    commitMatricula.mockRejectedValueOnce(new Error('sem rede'));
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(rodape().querySelector('[role="alert"]')).toBeNull();

    await clicar(botao('Confirmar matrícula'));

    const alerta = rodape().querySelector('[role="alert"]');
    expect(alerta).not.toBeNull();
    expect(alerta.textContent).toContain('Não foi possível salvar. Tente de novo.');
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(botao('Confirmar matrícula').getAttribute('aria-disabled')).toBeNull();
    erro.mockRestore();
  });

  it('o aviso sai quando a pessoa mexe no plano, no início, no desconto ou no motivo', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const falhar = async () => {
      commitMatricula.mockRejectedValueOnce(new Error('sem rede'));
      await clicar(botao('Confirmar matrícula'));
      expect(rodape().querySelector('[role="alert"]')).not.toBeNull();
    };
    await montar({ lead: leadNovo, mode: 'matricula' });

    await falhar();
    await clicar(opcao('Musculação Semestral'));
    expect(rodape().querySelector('[role="alert"]')).toBeNull();

    await falhar();
    await clicar(opcao('Outra data'));
    expect(rodape().querySelector('[role="alert"]')).toBeNull();

    await falhar();
    await clicar(botao('%'));
    expect(rodape().querySelector('[role="alert"]')).toBeNull();

    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    await clicar(botao('Campanha'));
    await falhar();
    await clicar(botao('Indicação'));
    expect(rodape().querySelector('[role="alert"]')).toBeNull();
    erro.mockRestore();
  });

  it('uma nova tentativa limpa o aviso antes de gravar', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    commitMatricula.mockRejectedValueOnce(new Error('sem rede'));
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(botao('Confirmar matrícula'));
    expect(rodape().querySelector('[role="alert"]')).not.toBeNull();

    commitMatricula.mockImplementationOnce(() => new Promise(() => {}));
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula).toHaveBeenCalledTimes(2);
    expect(rodape().querySelector('[role="alert"]')).toBeNull();
    erro.mockRestore();
  });
});

describe('ContractModal, contraste, concordância e largura', () => {
  it('o tipo de desconto marcado se distingue pelo anel e pela cor da marca', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const marcadoBtn = botao('Sem desconto');
    expect(marcadoBtn.getAttribute('aria-pressed')).toBe('true');
    for (const token of ['ring-1', 'ring-inset', 'ring-brand-600', 'dark:ring-brand-400', 'text-brand-700', 'dark:text-brand-300']) {
      expect(marcadoBtn.className).toContain(token);
    }
    expect(botao('%').className).not.toContain('ring-brand-600');
  });

  it('o Cancelar usa um tom que passa no contraste', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(botao('Cancelar').className).toContain('text-slate-600');
  });

  it('o diálogo nunca passa da largura da tela, nem entre 640 e 950 px', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const classes = document.body.querySelector('[data-slot="dialog-content"]').className;
    expect(classes).toContain('w-[920px]');
    expect(classes).toContain('sm:max-w-[calc(100vw-2rem)]');
    expect(classes).not.toContain('sm:max-w-[920px]');
  });

  it('o exemplo do campo do valor não se confunde com um valor digitado', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    const exemplo = async (rotulo) => {
      await clicar(botao(rotulo));
      return document.body.querySelector('input[inputmode="decimal"]').getAttribute('placeholder');
    };
    expect(await exemplo('%')).toBe('ex.: 10');
    expect(await exemplo('R$')).toBe('ex.: 150');
    expect(await exemplo('Valor final')).toBe('ex.: 1.240');
  });

  const inicio = D(2026, 9, 12);
  const leadCom = (fim) => ({
    id: 'l2', name: 'Camila Rezende', lifecycleStage: 'cliente', currentContractId: 'c1abcdef', currentPlanName: 'Pilates Trimestral',
    currentContractValue: 897, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'ativo'
  });

  it('o cabeçalho concorda no singular: "restam 1 dia"', async () => {
    const fim = D(2026, 10, 17, 10, 20);
    const atual = { id: 'c1abcdef', leadId: 'l2', planName: 'Pilates Trimestral', value: 897, durationMonths: 3, status: 'ativo', startsAt: inicio, endsAt: fim, createdAt: inicio };
    await montar({ lead: leadCom(fim), mode: 'renovacao', currentContract: atual, renewedFromId: 'c1abcdef' }, [atual]);
    expect(document.body.textContent).toContain('restam 1 dia');
    expect(document.body.textContent).not.toContain('restam 1 dias');
  });

  it('o cabeçalho concorda no singular: "sem contrato há 1 dia", e no plural com 2', async () => {
    await montar({ lead: leadCom(D(2026, 10, 15, 10, 20)), mode: 'matricula' });
    expect(document.body.textContent).toContain('sem contrato há 1 dia');
    expect(document.body.textContent).not.toContain('sem contrato há 1 dias');
    await act(async () => { root.unmount(); });
    await montar({ lead: leadCom(D(2026, 10, 14, 10, 20)), mode: 'matricula' });
    expect(document.body.textContent).toContain('sem contrato há 2 dias');
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

describe('ContractModal, matrícula de quem já foi cliente', () => {
  const inicio = D(2026, 3, 1);
  const fim = D(2026, 4, 1);
  const vencido = { id: 'c0velho', leadId: 'l3', planId: 'p4', planName: 'Pilates Mensal', value: 349, durationMonths: 1, status: 'vencido', startsAt: inicio, endsAt: fim, createdAt: inicio };
  const leadVolta = {
    id: 'l3', name: 'Paulo Antunes', lifecycleStage: 'cliente', currentContractId: 'c0velho', currentPlanName: 'Pilates Mensal',
    currentContractValue: 349, currentContractStartsAt: inicio, currentContractEndsAt: fim, currentContractStatus: 'vencido'
  };

  it('grava como matrícula nova, sem ligar ao contrato vencido', async () => {
    await montar({ lead: leadVolta, mode: 'matricula' }, [vencido]);
    // O cabeçalho mostra o contrato que se encerrou, como contexto de quem volta.
    expect(document.body.textContent).toContain('Último contrato');
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula).toHaveBeenCalledTimes(1);
    const arg = commitMatricula.mock.calls[0][0];
    expect(arg.mode).toBe('matricula');
    expect(arg.renewedFromId).toBeNull();
    expect(arg.previousContract).toBeNull();
  });

  it('com "Hoje", o início é o instante de agora, com a hora', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    await clicar(opcao('Hoje'));
    await clicar(botao('Confirmar matrícula'));
    expect(commitMatricula.mock.calls[0][0].startsAt.getTime()).toBe(D(2026, 10, 16, 10, 20).getTime());
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
    expect(anunciador().getAttribute('role')).toBe('status');
    expect(anunciador().textContent).toContain('Emenda perfeita, nenhum dia sem contrato.');
    expect(document.body.textContent).toContain('Renovar contrato');
    expect(botao('Confirmar renovação').disabled).toBe(false);
  });

  it('contrato atual trancado: a faixa mostra a trava, o rodapé manda ver o aviso e o botão fica desligado', async () => {
    const trancado = { ...atual, status: 'trancado' };
    await montar({ ...props, lead: { ...leadCliente, currentContractStatus: 'trancado' }, currentContract: trancado }, [trancado]);
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Este contrato está trancado');
    expect(faixa.className).toContain('rose');
    expect(rodape().textContent).toContain('Veja o aviso da vigência.');
    expect(botao('Confirmar renovação').disabled).toBe(true);
  });

  it('trancado com "Outra data" vazia: o rodapé manda ver o aviso, e não pedir uma data que não libera nada', async () => {
    const trancado = { ...atual, status: 'trancado' };
    await montar({ ...props, lead: { ...leadCliente, currentContractStatus: 'trancado' }, currentContract: trancado }, [trancado]);
    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '');
    expect(document.body.querySelector('[data-slot="start-status"]').textContent).toContain('Este contrato está trancado');
    expect(rodape().textContent).toContain('Veja o aviso da vigência.');
    expect(rodape().textContent).not.toContain('Escolha a data de início.');
  });

  it('contrato que já tem renovação de pé: a faixa avisa e o botão fica desligado', async () => {
    const renovacao = { id: 'c2xyz', leadId: 'l2', renewedFromId: 'c1abcdef', planName: 'Pilates Semestral', status: 'ativo', startsAt: D(2026, 12, 13), endsAt: D(2027, 6, 13) };
    await montar(props, [atual, renovacao]);
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Este contrato já foi renovado');
    expect(faixa.className).toContain('rose');
    expect(botao('Confirmar renovação').disabled).toBe(true);
  });

  it('começar hoje, com o atual ainda vigente, avisa que o atual passa a terminar antes', async () => {
    await montar(props, [atual]);
    await clicar(opcao('Hoje'));
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('antes do previsto');
    expect(faixa.className).toContain('rose');
  });

  // Medido no Chromium: entre 768 e cerca de 845 px (duas colunas) a regra dos dois dias e o
  // aviso de sobreposição quebram em quatro linhas (97,4 px), e os tons de aviso tinham uma
  // borda de 1 px que o tom ok não tinha (79 px contra 78). Todos os tons têm a mesma caixa.
  // Medido no Chromium: a 768 px cada cartão tem cerca de 115 px e, com o ícone de 30 px,
  // sobram 51 px de texto, que cortava "Emendar", "Outra data" e a data ("13/12/…").
  // Na seção estreita (a mesma consulta da faixa) o ícone sai e o texto completo cabe.
  it('os cartões do início escondem o ícone quando a seção fica estreita, para o texto e a data caberem', async () => {
    await montar(props, [atual]);
    const grupo = document.body.querySelector('[role="radiogroup"][aria-label="Início da vigência"]');
    expect(grupo.parentElement.className).toContain('@container');
    for (const cartao of radios('Início da vigência')) {
      const icone = cartao.firstElementChild;
      expect(icone.className).toContain('@max-md:hidden');
      // O texto continua truncável (largura grande demais continua com reticências, não vaza)
      // e o nome, o papel e a dica do cartão não mudam.
      expect(cartao.getAttribute('role')).toBe('radio');
      expect(cartao.querySelectorAll('span.truncate').length).toBe(2);
    }
    expect(opcao('Emendar').textContent).toContain('13/12/2026');
    expect(opcao('Hoje').getAttribute('title')).toContain('Começa hoje');
  });

  it('com só dois cartões (matrícula) há largura de sobra, e o ícone fica mesmo na seção estreita', async () => {
    await montar({ lead: leadNovo, mode: 'matricula' });
    expect(radios('Início da vigência').length).toBe(2);
    for (const cartao of radios('Início da vigência')) {
      expect(cartao.firstElementChild.className).not.toContain('@max-md:hidden');
    }
  });

  // A 768 px a linha de apoio do cabeçalho de Início dividia a largura com o campo de data
  // de "Outra data" e quebrava em duas linhas: o diálogo crescia 18,7 px ao trocar de
  // opção. A frase mais curta cabe na mesma linha.
  it('a linha de apoio do início cabe ao lado do campo de data, sem quebrar a 768 px', async () => {
    await montar(props, [atual]);
    expect(document.body.textContent).toContain('Quando o contrato começa a valer?');
    expect(document.body.textContent).not.toContain('Quando o contrato novo começa a valer?');
  });

  it('os três tons da faixa têm a mesma caixa: borda (transparente no ok) e as mesmas alturas reservadas', async () => {
    await montar(props, [atual]);
    const faixa = () => document.body.querySelector('[data-slot="start-status"]');
    const temBorda = (el) => el.className.split(/\s+/).includes('border');
    expect(faixa().textContent).toContain('Emenda perfeita');
    expect(faixa().className).toContain('bg-emerald');
    expect(faixa().className).toContain('border-transparent');
    expect(temBorda(faixa())).toBe(true);
    expect(faixa().className).toContain('min-h-[79px] @max-md:min-h-[98px]');

    await clicar(opcao('Hoje'));
    expect(faixa().className).toContain('border-rose');
    expect(temBorda(faixa())).toBe(true);
    expect(faixa().className).toContain('min-h-[79px] @max-md:min-h-[98px]');

    await clicar(opcao('Outra data'));
    await digitar(document.body.querySelector('input[type="date"]'), '2026-12-20');
    expect(faixa().className).toContain('border-amber');
    expect(temBorda(faixa())).toBe(true);
    expect(faixa().className).toContain('min-h-[79px] @max-md:min-h-[98px]');
  });

  describe('o que a renovação grava', () => {
    const dia = (d) => d.toLocaleDateString('pt-BR');

    it('emendando: grava como renovação do contrato atual, começando no dia seguinte ao fim', async () => {
      // O plano mais vendido é outro (Musculação Trimestral): a renovação tem de oferecer o do cliente.
      const vendas = ['v1', 'v2'].map((id) => ({ id, leadId: id, planId: 'p1', planName: 'Musculação Trimestral', status: 'vencido', startsAt: D(2026, 1, 5), endsAt: D(2026, 4, 5) }));
      await montar(props, [atual, ...vendas]);
      await clicar(botao('Confirmar renovação'));
      expect(commitMatricula).toHaveBeenCalledTimes(1);
      const arg = commitMatricula.mock.calls[0][0];
      expect(arg).toMatchObject({ mode: 'renovacao', renewedFromId: 'c1abcdef', previousContract: atual });
      expect(dia(arg.startsAt)).toBe('13/12/2026');
      // A renovação oferece o plano que o cliente já tem (Pilates Trimestral), pelo valor de tabela.
      expect(arg.plan.id).toBe('p3');
      expect(arg.value).toBe(990);
    });

    it('começando hoje: o mesmo contrato renovado, com o início em hoje', async () => {
      await montar(props, [atual]);
      await clicar(opcao('Hoje'));
      await clicar(botao('Confirmar renovação'));
      expect(commitMatricula).toHaveBeenCalledTimes(1);
      const arg = commitMatricula.mock.calls[0][0];
      expect(arg).toMatchObject({ mode: 'renovacao', renewedFromId: 'c1abcdef', previousContract: atual });
      expect(dia(arg.startsAt)).toBe('16/10/2026');
      // "Hoje" grava o instante de agora, com a hora, e não a meia-noite.
      expect(arg.startsAt.getTime()).toBe(D(2026, 10, 16, 10, 20).getTime());
    });

    it('como o Kanban monta (só lead e contratos, sem renewedFromId nem currentContract): o contrato atual vem da lista', async () => {
      await montar({ lead: leadCliente, mode: 'renovacao' }, [atual]);
      await clicar(botao('Confirmar renovação'));
      expect(commitMatricula).toHaveBeenCalledTimes(1);
      const arg = commitMatricula.mock.calls[0][0];
      expect(arg).toMatchObject({ mode: 'renovacao', renewedFromId: 'c1abcdef', previousContract: atual });
      expect(dia(arg.startsAt)).toBe('13/12/2026');
    });
  });

  it('a dica do cartão "Hoje" vem da prévia: encerra o atual quando a gravação encurta', async () => {
    await montar(props, [atual]);
    expect(opcao('Hoje').getAttribute('title')).toBe('Começa hoje. Encerra o atual 58 dias antes.');
    expect(opcao('Emendar').getAttribute('title')).toContain('sem lacuna');
  });

  it('atual já encurtado por outra renovação: "Hoje" não encurta, e a faixa e a dica dizem que os dois valem juntos', async () => {
    const encurtado = { ...atual, shortenedById: 'c0outra', originalEndsAt: D(2027, 1, 12) };
    await montar({ ...props, currentContract: encurtado }, [encurtado]);
    await clicar(opcao('Hoje'));
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('O contrato atual continua até 12/12/2026, e os dois valem juntos por 58 dias.');
    expect(faixa.textContent).not.toContain('passa a terminar');
    expect(faixa.className).toContain('rose');
    expect(opcao('Hoje').getAttribute('title')).toBe('Começa hoje. Os dois valem juntos por 58 dias.');
    expect(document.body.querySelector('aside[aria-label="Recibo"]').textContent).not.toContain('passa a terminar em');
  });

  // Se a gravação falha, o modal volta a seguir os dados de agora. Sem isso a tela
  // ficaria presa nos dados de quando a pessoa clicou em Confirmar.
  it('depois de uma falha ao gravar, a tela volta a seguir os dados ao vivo', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    let empurrar;
    function Casca() {
      const [contratos, setContratos] = useState([atual]);
      empurrar = (novo) => setContratos((lista) => [...lista, novo]);
      return h(GeneralConfigContext.Provider, { value: { planos, contratos } }, modal(props));
    }
    commitMatricula.mockRejectedValueOnce(new Error('sem rede'));
    await renderizar(h(Casca), D(2026, 10, 16, 10, 20));
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    expect(faixa.textContent).toContain('Emenda perfeita');

    await clicar(botao('Confirmar renovação'));
    expect(rodape().querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => {
      empurrar({ id: 'c2xyz', leadId: 'l2', renewedFromId: 'c1abcdef', planName: 'Pilates Trimestral', status: 'ativo', startsAt: D(2026, 12, 13), endsAt: D(2027, 3, 13) });
    });

    expect(faixa.textContent).toContain('Este contrato já foi renovado');
    expect(botao('Confirmar renovação').disabled).toBe(true);
    erro.mockRestore();
  });

  it('a prévia do encurtamento segue o início escolhido: emendar não encurta, hoje encurta até ontem', async () => {
    await montar(props, [atual]);
    const recibo = () => document.body.querySelector('aside[aria-label="Recibo"]').textContent;
    expect(recibo()).toContain('até 12/12/2026');
    expect(recibo()).not.toContain('passa a terminar em');

    await clicar(opcao('Hoje'));
    expect(recibo()).toContain('O contrato atual passa a terminar em 15/10/2026');
    expect(recibo()).toContain('até 15/10/2026');
  });

  // No Kanban e na Meta Diária a escrita local do Firestore põe a renovação nova na
  // lista de contratos antes de o servidor confirmar. O modal congela o que mostra
  // ao confirmar: sem isso, a faixa passaria a dizer "já foi renovado" e o botão
  // ganharia disabled de verdade, tirando o foco dele no meio do envio.
  it('depois de Confirmar, a renovação que a escrita local põe na lista não muda a faixa, o botão nem o foco', async () => {
    let empurrar;
    function Casca() {
      const [contratos, setContratos] = useState([atual]);
      empurrar = (novo) => setContratos((lista) => [...lista, novo]);
      return h(GeneralConfigContext.Provider, { value: { planos, contratos } }, modal(props));
    }
    commitMatricula.mockImplementationOnce(() => new Promise(() => {}));
    await renderizar(h(Casca), D(2026, 10, 16, 10, 20));
    const faixa = document.body.querySelector('[data-slot="start-status"]');
    const antes = faixa.textContent;
    expect(antes).toContain('Emenda perfeita');
    const confirmar = botao('Confirmar renovação');
    confirmar.focus();
    await clicar(confirmar);

    await act(async () => {
      empurrar({ id: 'c2xyz', leadId: 'l2', renewedFromId: 'c1abcdef', planName: 'Pilates Trimestral', status: 'ativo', startsAt: D(2026, 12, 13), endsAt: D(2027, 3, 13) });
    });

    expect(faixa.textContent).toBe(antes);
    expect(faixa.textContent).not.toContain('já foi renovado');
    expect(confirmar.disabled).toBe(false);
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(confirmar);
  });
});
