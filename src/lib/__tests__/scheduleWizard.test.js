// @vitest-environment jsdom
// O Agendar (ScheduleWizard) em passos horizontais: a linha de passos no topo e só
// o passo atual embaixo. O contrato de onConfirm (typeLabel, date, unidade...) não
// muda: é o que o handleWizardConfirm da ficha consome.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { ScheduleWizard } from '../../components/profile/ScheduleWizard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CONFIG = {
  modalities: [{ id: 'm1', name: 'Musculação' }],
  trialClassOptions: [1, 2],
  units: [{ id: 'u1', name: 'Centro', address: 'Rua dos Andradas, 1234' }],
  professores: [],
  metaWeekdays: [1, 2, 3, 4, 5],
};

let root = null;
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onConfirm = props.onConfirm || vi.fn();
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: CONFIG },
      h(ScheduleWizard, { onConfirm, onCancel: vi.fn(), usersList: [], ...props })));
  });
  return onConfirm;
}
beforeEach(() => {
  // Sexta, 10h: o primeiro cartão de dia é "Hoje", às 18h.
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
const passos = () => [...document.body.querySelectorAll('ol[aria-label="Passos do agendamento"] > li')];

describe('ScheduleWizard em passos horizontais', () => {
  it('começa só com o passo Tipo e os quatro tipos embaixo', async () => {
    await montar();
    expect(passos()).toHaveLength(1);
    expect(passos()[0].getAttribute('aria-current')).toBe('step');
    expect(document.body.textContent).toContain('O que você quer agendar?');
    ['Mensagem', 'Ligação', 'Visita', 'Aula experimental'].forEach((t) => expect(botao(t), t).not.toBeNull());
  });

  it('escolher Visita faz a linha ganhar os passos e abrir o passo Unidade', async () => {
    await montar();
    await clicar(botao('Visita'));
    expect(passos().map((li) => li.textContent.replace(/^\d+/, ''))).toEqual(['TipoVisita', 'Unidade', 'Dia e horário']);
    expect(passos()[1].getAttribute('aria-current')).toBe('step');
    expect(botao('Centro')).not.toBeNull();
  });

  it('escolher a unidade resume o passo na linha e abre Dia e horário', async () => {
    await montar();
    await clicar(botao('Visita'));
    await clicar(botao('Centro'));
    // Na linha de passos, o título "Unidade" em cima e só o nome embaixo.
    expect(passos()[1].textContent).toBe('UnidadeCentro');
    expect(passos()[2].getAttribute('aria-current')).toBe('step');
    expect(botao('Hoje')).not.toBeNull();
  });

  it('o botão só liga com tudo escolhido e confirma com o que foi escolhido', async () => {
    const onConfirm = await montar();
    await clicar(botao('Visita'));
    await clicar(botao('Centro'));
    expect(botao('Complete os passos').disabled).toBe(true);

    await clicar(botao('Hoje'));
    const confirmar = botao('Confirmar agendamento');
    expect(confirmar.disabled).toBe(false);
    await clicar(confirmar);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0];
    expect(arg).toMatchObject({ typeId: 'visita', typeLabel: 'Visita', unidade: 'Centro', modalidade: null, quantidade: null });
    expect(arg.date).toBeInstanceOf(Date);
    expect(arg.date.getHours()).toBe(18);
  });

  it('clicar num passo concluído volta a ele e apaga o que veio depois', async () => {
    await montar();
    await clicar(botao('Visita'));
    await clicar(botao('Centro'));
    await clicar(botao('Hoje'));
    expect(passos()[2].textContent).toContain('18:00');

    await clicar(document.body.querySelector('button[title="Editar unidade"]'));
    expect(passos()[1].getAttribute('aria-current')).toBe('step');
    await clicar(botao('Centro'));
    // Escolher de novo a unidade zera o dia e o horário.
    expect(passos()[2].textContent).toBe('3Dia e horário');
  });

  it('clicar em Tipo, depois de escolhido, volta à escolha do tipo e zera tudo', async () => {
    await montar();
    await clicar(botao('Visita'));
    await clicar(document.body.querySelector('button[title="Editar tipo"]'));
    expect(passos()).toHaveLength(1);
    expect(document.body.textContent).toContain('O que você quer agendar?');
  });

  it('initialTypeId abre já com o tipo escolhido', async () => {
    await montar({ initialTypeId: 'ligacao' });
    expect(document.body.textContent).not.toContain('O que você quer agendar?');
    expect(passos()[0].textContent).toContain('Ligação');
    expect(passos()[1].getAttribute('aria-current')).toBe('step');
  });

  it('initialTypeId inválido é ignorado', async () => {
    await montar({ initialTypeId: 'xyz' });
    expect(document.body.textContent).toContain('O que você quer agendar?');
  });

  it('a anotação do passo vai junto no onConfirm', async () => {
    const onConfirm = await montar({ initialTypeId: 'ligacao' });
    await clicar(botao('Hoje'));
    const campo = document.body.querySelector('#wz-note');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { set.call(campo, 'Fechar o plano'); campo.dispatchEvent(new Event('input', { bubbles: true })); });
    await clicar(botao('Confirmar agendamento'));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ typeLabel: 'Ligação', note: 'Fechar o plano' });
  });

  it('abre com o foco no cabeçalho do passo quando o foco estava solto', async () => {
    await montar();
    expect(document.activeElement.textContent).toBe('O que você quer agendar?');
  });

  it('não tira o foco de quem o tem ao abrir', async () => {
    const fora = document.createElement('button');
    document.body.appendChild(fora);
    fora.focus();
    await montar();
    expect(document.activeElement).toBe(fora);
  });

  it('trocar de passo leva o foco ao cabeçalho do passo novo', async () => {
    await montar();
    await clicar(botao('Visita'));
    expect(document.activeElement.textContent).toBe('Unidade');
    await clicar(botao('Centro'));
    expect(document.activeElement.textContent).toBe('Dia e horário');
    await clicar(document.body.querySelector('button[title="Editar unidade"]'));
    expect(document.activeElement.textContent).toBe('Unidade');
    await clicar(document.body.querySelector('button[title="Editar tipo"]'));
    expect(document.activeElement.textContent).toBe('O que você quer agendar?');
  });
});
