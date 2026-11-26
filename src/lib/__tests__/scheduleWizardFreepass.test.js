// @vitest-environment jsdom
// O passo Freepass do Agendar (mockup A, #passo-freepass e #marcar-aulas). Com o
// módulo Stronix 2.0 a aula perde o "Quantas aulas" e ganha o passo Freepass,
// que mostra a escolha que a ficha calcula. Sem o módulo, nada muda.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { ScheduleWizard } from '../../components/profile/ScheduleWizard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CONFIG = {
  modalities: [{ id: 'm1', name: 'Pilates' }],
  trialClassOptions: [1, 2],
  units: [],
  professores: [{ id: 'p1', nome: 'Leonardo', modalidadeIds: ['m1'] }],
  metaWeekdays: [1, 2, 3, 4, 5],
};

const FP = { id: 'f1', kind: 'aulas', total: 2, aulas: 1, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', status: 'correndo', endsAt: null };
const T_DIAS = { id: 't1', name: 'Pilates 7 dias', modalidadeId: 'm1', kind: 'dias', quantity: 7, padrao: false, ativo: true };
const T_AULAS = { id: 't2', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };

let root = null;
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onConfirm = vi.fn();
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: CONFIG },
      h(ScheduleWizard, { onConfirm, onCancel: vi.fn(), usersList: [], initialTypeId: 'aula', leadFirstName: 'Rafaela', ...props })));
  });
  return onConfirm;
}
beforeEach(() => {
  // Sexta, 16/10/2026, 10h.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const botao = (prefixo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(prefixo)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const passos = () => [...document.body.querySelectorAll('ol[aria-label="Passos do agendamento"] > li')].map((li) => li.textContent.replace(/^\d+/, ''));
const titulo = () => document.body.querySelector('h3').textContent;
const mudarSelect = async (el, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
// Professor e dia, para fechar o fluxo de sempre.
async function professorEDia() {
  await clicar(botao('Leonardo'));
  await clicar(botao('Hoje'));
}

describe('sem o módulo', () => {
  it('a aula continua com "Quantas aulas" e o freepass vai null', async () => {
    const onConfirm = await montar();
    await clicar(botao('Pilates'));
    expect(passos()).toEqual(['TipoAula experimental', 'ModalidadePilates', 'Professor', 'Quantas aulas', 'Dia e horário']);
    await clicar(botao('Leonardo'));
    await clicar(botao('2 aulas'));
    await clicar(botao('Hoje'));
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ quantidade: 2, freepass: null });
  });
});

describe('com o módulo', () => {
  it('lead em Perda (sem escolha): sem passo Freepass e sem quantidade, a aula é avulsa', async () => {
    const onConfirm = await montar({ freepassOn: true, freepassChoice: null });
    await clicar(botao('Pilates'));
    expect(passos()).toEqual(['TipoAula experimental', 'ModalidadePilates', 'Professor', 'Dia e horário']);
    await professorEDia();
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ quantidade: null, freepass: { kind: 'avulsa' } });
  });

  it('carregando: o passo espera', async () => {
    await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'loading' }) });
    await clicar(botao('Pilates'));
    expect(passos()).toEqual(['TipoAula experimental', 'ModalidadePilates', 'Freepass', 'Professor', 'Dia e horário']);
    expect(document.body.textContent).toContain('Carregando os freepass');
  });

  it('freepass correndo: o cartão diz onde a aula entra, e a aula leva o freepass', async () => {
    const escolha = vi.fn(() => ({ kind: 'use', freepass: FP, aulasLeft: 1 }));
    const onConfirm = await montar({ freepassOn: true, freepassChoice: escolha });
    await clicar(botao('Pilates'));
    expect(escolha).toHaveBeenCalledWith('Pilates');
    expect(titulo()).toBe('A aula entra no freepass de Rafaela');
    expect(botao('Usar o freepass Pilates 2 aulas').textContent).toContain('1 de 2 agendadas');
    expect(botao('Aula avulsa').textContent).toContain('Não conta nas 2 aulas');
    await clicar(botao('Usar o freepass'));
    expect(passos()[2]).toBe('FreepassPilates 2 aulas');
    await professorEDia();
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ quantidade: null, freepass: { kind: 'use', freepassId: 'f1', moving: false } });
  });

  it('remarcando a aula do freepass: "Continuar no freepass"', async () => {
    const onConfirm = await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'use', freepass: { ...FP, aulas: 2 }, aulasLeft: 1, moving: true }) });
    await clicar(botao('Pilates'));
    expect(titulo()).toBe('A aula continua no freepass de Rafaela');
    await clicar(botao('Continuar no freepass Pilates 2 aulas'));
    await professorEDia();
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0].freepass).toEqual({ kind: 'use', freepassId: 'f1', moving: true });
  });

  it('já teve freepass: só a aula avulsa, com o aviso', async () => {
    const onConfirm = await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'avulsa', reason: 'repeated', since: new Date(2026, 9, 10) }) });
    await clicar(botao('Pilates'));
    expect(titulo()).toBe('Essa aula fica avulsa');
    expect(document.body.textContent).toContain('Aula avulsa: já teve freepass de Pilates em 10/10');
    await clicar(botao('Aula avulsa'));
    expect(passos()[2]).toBe('FreepassAvulsa');
    await professorEDia();
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0].freepass).toEqual({ kind: 'avulsa' });
  });

  it('primeira vez: um cartão por tipo, o padrão primeiro, e o por dias segue professor e dia', async () => {
    const onConfirm = await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'launch', types: [T_AULAS, T_DIAS] }) });
    await clicar(botao('Pilates'));
    expect(titulo()).toBe('Qual freepass de Pilates?');
    const cartoes = [...document.body.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent);
    expect(cartoes[0]).toContain('Pilates 2 aulas Padrão');
    expect(cartoes[1]).toContain('Pilates 7 dias');
    expect(cartoes[2]).toContain('Aula avulsa');
    await clicar(botao('Pilates 7 dias'));
    expect(passos()).toEqual(['TipoAula experimental', 'ModalidadePilates', 'FreepassPilates 7 dias', 'Professor', 'Dia e horário']);
    await professorEDia();
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0].freepass).toEqual({ kind: 'launch', typeId: 't1' });
  });

  it('primeira vez, tipo por aulas: "Marcar as aulas" no lugar de professor e dia, e todas vão no onConfirm', async () => {
    const onConfirm = await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'launch', types: [T_AULAS, T_DIAS] }) });
    await clicar(botao('Pilates'));
    await clicar(botao('Pilates 2 aulas'));
    expect(passos()).toEqual(['TipoAula experimental', 'ModalidadePilates', 'FreepassPilates 2 aulas', 'Marcar as aulas']);
    expect(titulo()).toBe('Marque as 2 aulas de Rafaela');
    expect(botao('Complete os passos').disabled).toBe(true);

    const aula1 = document.body.querySelectorAll('fieldset')[0];
    await clicar([...aula1.querySelectorAll('button')].find((b) => b.textContent === 'Hoje'));
    await mudarSelect(aula1.querySelector('select'), 'p1');
    expect(document.body.textContent).toContain('Rafaela vira Visitante com 2 aulas: sex 16/10 e sex 23/10.');
    expect(document.body.textContent).toContain('2 aulas, de sex 16/10 a sex 23/10');

    await clicar(botao('Agendar 2 aulas'));
    const arg = onConfirm.mock.calls[0][0];
    expect(arg).toMatchObject({ date: new Date(2026, 9, 16, 18, 0), professorId: 'p1', soloTraining: false, modalidade: 'Pilates', quantidade: null });
    expect(arg.freepass).toEqual({
      kind: 'launch', typeId: 't2',
      aulas: [
        { date: new Date(2026, 9, 16, 18, 0), professorId: 'p1', soloTraining: false },
        { date: new Date(2026, 9, 23, 18, 0), professorId: 'p1', soloTraining: false },
      ],
    });
  });

  it('o horário é conferido de novo ao agendar: a aula que passou com a tela aberta é recusada', async () => {
    const onConfirm = await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'launch', types: [T_AULAS] }) });
    await clicar(botao('Pilates'));
    await clicar(botao('Pilates 2 aulas'));
    const aula1 = document.body.querySelectorAll('fieldset')[0];
    await clicar([...aula1.querySelectorAll('button')].find((b) => b.textContent === 'Hoje'));
    await mudarSelect(aula1.querySelector('select'), 'p1');
    const agendar = botao('Agendar 2 aulas');
    // A aula 1 é hoje às 18h; o relógio anda até 18h30 com a tela aberta.
    vi.setSystemTime(new Date(2026, 9, 16, 18, 30));
    await clicar(agendar);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('A aula 1 já passou. Escolha outro dia ou horário.');
    expect(botao('Complete os passos').disabled).toBe(true);
  });

  it('a ficha que recusa (false) deixa o assistente como está', async () => {
    const onConfirm = vi.fn(async () => false);
    await montar({ onConfirm, freepassOn: true, freepassChoice: () => ({ kind: 'use', freepass: FP, aulasLeft: 1 }) });
    await clicar(botao('Pilates'));
    await clicar(botao('Usar o freepass'));
    await professorEDia();
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(passos()[2]).toBe('FreepassPilates 2 aulas');
    expect(botao('Confirmar agendamento')).not.toBeNull();
  });

  it('o texto "igual à aula 1" chega ao leitor de tela', async () => {
    await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'launch', types: [T_AULAS] }) });
    await clicar(botao('Pilates'));
    await clicar(botao('Pilates 2 aulas'));
    expect(document.body.querySelectorAll('fieldset')[1].querySelector('legend').textContent).toBe('Aula 2, igual à aula 1, uma semana depois');
  });

  it('trocar o freepass escolhido apaga o que vinha depois', async () => {
    await montar({ freepassOn: true, freepassChoice: () => ({ kind: 'launch', types: [T_AULAS, T_DIAS] }) });
    await clicar(botao('Pilates'));
    await clicar(botao('Pilates 7 dias'));
    await professorEDia();
    await clicar(document.body.querySelector('button[title="Editar freepass"]'));
    await clicar(botao('Pilates 2 aulas'));
    expect(passos()).toEqual(['TipoAula experimental', 'ModalidadePilates', 'FreepassPilates 2 aulas', 'Marcar as aulas']);
    // As aulas começam do zero: o professor e o dia do por dias não vêm junto.
    expect(document.body.textContent).toContain('Escolha o dia da aula 1.');
    expect(document.body.querySelector('fieldset select').value).toBe('');
  });
});
