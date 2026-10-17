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

    // Ligando o desconto de novo, o motivo de antes não volta marcado.
    await clicar(botao('%'));
    await digitar(document.body.querySelector('input[aria-label="Valor do desconto"]'), '10');
    expect(botao('Campanha').getAttribute('aria-pressed')).toBe('false');
    expect(rodape().textContent).toContain('Escolha o motivo do desconto.');
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

describe('ContractModal, durante o envio', () => {
  it('o Confirmar não perde o foco, um segundo clique não grava de novo e o X do cabeçalho fica desligado', async () => {
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
    expect(document.body.querySelector('button[aria-label="Fechar"]').disabled).toBe(true);
    expect(botao('Cancelar').disabled).toBe(true);

    await clicar(confirmar);
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
});
