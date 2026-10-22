// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { WizardStepper, WizardProgress, WizardOption } from '../../components/profile/WizardLayout.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TOM = { strong: 'bg-brand-600', ring: 'ring-brand-500', text: 'text-brand-700', darkText: 'dark:text-brand-300', soft: 'bg-brand-50', darkSoft: 'dark:bg-brand-500/10' };

let root = null;
async function montar(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('WizardStepper', () => {
  const passos = (onEdit) => [
    { key: 'tipo', title: 'Tipo', value: 'Visita', state: 'done', onEdit: () => onEdit('tipo') },
    { key: 'unidade', title: 'Unidade', value: '', state: 'active', onEdit: () => onEdit('unidade') },
    { key: 'datahora', title: 'Dia e horário', value: '', state: 'locked', onEdit: () => onEdit('datahora') },
  ];

  it('marca o passo atual, resume o concluído e deixa o bloqueado só com o nome', async () => {
    await montar(h(WizardStepper, { steps: passos(() => {}), label: 'Passos do agendamento', tone: TOM }));
    const itens = [...document.querySelectorAll('li')];
    expect(itens).toHaveLength(3);
    expect(itens[1].getAttribute('aria-current')).toBe('step');
    expect(itens[0].getAttribute('aria-current')).toBeNull();
    expect(itens[0].textContent).toContain('Tipo');
    expect(itens[0].textContent).toContain('Visita');
    expect(itens[2].textContent).toBe('3Dia e horário');
    expect(document.querySelector('ol').getAttribute('aria-label')).toBe('Passos do agendamento');
  });

  it('só o passo concluído é botão, e o clique chama o onEdit dele', async () => {
    const onEdit = vi.fn();
    await montar(h(WizardStepper, { steps: passos(onEdit), label: 'Passos', tone: TOM }));
    const botoes = [...document.querySelectorAll('li button')];
    expect(botoes).toHaveLength(1);
    expect(botoes[0].getAttribute('title')).toBe('Editar tipo');
    await act(async () => { botoes[0].click(); });
    expect(onEdit).toHaveBeenCalledWith('tipo');
  });
});

describe('WizardProgress', () => {
  it('mostra feitos sobre o total e a largura da barra', async () => {
    await montar(h(WizardProgress, { done: 2, total: 4, tone: TOM }));
    expect(document.body.textContent).toContain('2/4');
    const barra = document.querySelector('[role="progressbar"]');
    expect(barra.getAttribute('aria-valuenow')).toBe('2');
    expect(barra.getAttribute('aria-valuemax')).toBe('4');
    expect(barra.firstElementChild.style.width).toBe('50%');
  });
});

describe('WizardOption', () => {
  it('opção escolhida fica pressionada, e a fase atual fica desligada', async () => {
    const onClick = vi.fn();
    await montar(h('div', null,
      h(WizardOption, { tone: TOM, label: 'Negociação', hint: 'Avança 1 etapa', selected: true, onClick }),
      h(WizardOption, { tone: TOM, label: 'Em contato', hint: 'Fase atual', current: true, onClick })));
    const [escolhida, atual] = [...document.querySelectorAll('button')];
    expect(escolhida.getAttribute('aria-pressed')).toBe('true');
    expect(atual.disabled).toBe(true);
    await act(async () => { escolhida.click(); });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
