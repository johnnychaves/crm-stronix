// @vitest-environment jsdom
// "Marcar as aulas" do Agendar (AulasPlanner): a linha seguinte segue a
// anterior (mesmo horário, mesmo professor, uma semana depois) até a pessoa
// mexer nela, e o passo recusa dia repetido e horário que já passou.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AulasPlanner } from '../../components/profile/AulasPlanner.jsx';
import { emptyAulaRows, resolveAulaRows, aulasProblem, aulasForConfirm, aulasSentence, aulasRangeText } from '../aulasPlan.js';
import { SOLO_TRAINING } from '../professores.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TOM = { soft: 'bg-teal-50', darkSoft: '', text: 'text-teal-700', darkText: '', ring: 'ring-teal-300', strong: 'bg-teal-500' };
const dia = (d, mes = 10) => new Date(2026, mes, d);
// Sexta, 27/11/2026, 10h.
const NOW = new Date(2026, 10, 27, 10, 0);
const DAYS = [0, 1, 2, 3, 4].map((off) => ({ off, date: dia(27 + off) }));
const PROFS = [{ id: 'p1', nome: 'Leonardo' }, { id: 'p2', nome: 'Matheus' }];

describe('regras do AulasPlanner', () => {
  it('a linha automática segue a anterior, uma semana depois', () => {
    const r = resolveAulaRows([{ date: dia(27), time: '18:00', professor: 'p1' }, { auto: true }, { auto: true }]);
    expect(r[1]).toEqual({ auto: true, date: dia(4, 11), time: '18:00', professor: 'p1' });
    expect(r[2].date).toEqual(dia(11, 11));
  });
  it('a linha mexida fica com o que tem e a seguinte segue ela', () => {
    const r = resolveAulaRows([{ date: dia(27), time: '18:00', professor: 'p1' }, { date: dia(30), time: '07:00', professor: 'p2' }, { auto: true }]);
    expect(r[2]).toEqual({ auto: true, date: dia(7, 11), time: '07:00', professor: 'p2' });
  });
  it('recusa o que falta, dia repetido e horário que já passou', () => {
    expect(aulasProblem(resolveAulaRows(emptyAulaRows(2)), NOW)).toBe('Escolha o dia da aula 1.');
    expect(aulasProblem([{ date: dia(28), time: '18:00', professor: '' }], NOW)).toBe('Escolha o professor da aula 1.');
    expect(aulasProblem([
      { date: dia(28), time: '18:00', professor: 'p1' }, { date: dia(28), time: '19:00', professor: 'p1' },
    ], NOW)).toBe('A aula 2 está no mesmo dia da aula 1. Escolha outro dia.');
    expect(aulasProblem([{ date: dia(27), time: '09:00', professor: 'p1' }], NOW)).toBe('A aula 1 já passou. Escolha outro dia ou horário.');
    expect(aulasProblem(resolveAulaRows([{ date: dia(27), time: '18:00', professor: SOLO_TRAINING }, { auto: true }]), NOW)).toBeNull();
  });
  it('o onConfirm leva as aulas em ordem de data, com Treina sozinho sem professor', () => {
    const a = aulasForConfirm([
      { date: dia(4, 11), time: '18:00', professor: 'p1' }, { date: dia(28), time: '09:30', professor: SOLO_TRAINING },
    ]);
    expect(a).toEqual([
      { date: new Date(2026, 10, 28, 9, 30), professorId: null, soloTraining: true },
      { date: new Date(2026, 11, 4, 18, 0), professorId: 'p1', soloTraining: false },
    ]);
    expect(aulasSentence('Rafaela', a)).toBe('Rafaela vira Visitante com 2 aulas: sáb 28/11 e sex 04/12.');
    expect(aulasRangeText(a)).toBe('2 aulas, de sáb 28/11 a sex 04/12');
  });
});

let root = null;
function Harness({ n }) {
  const [rows, setRows] = useState(() => emptyAulaRows(n));
  return h(AulasPlanner, { rows, onChange: setRows, days: DAYS, professors: PROFS, tone: TOM, firstName: 'Rafaela', now: NOW });
}
async function montar(n = 2) {
  const c = document.createElement('div');
  document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => { root.render(h(Harness, { n })); });
}
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const linhas = () => [...document.querySelectorAll('fieldset')];
const chip = (linha, texto) => [...linha.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const mudar = async (el, valor) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};
const status = () => document.querySelector('[role="status"]').textContent;

describe('AulasPlanner na tela', () => {
  it('uma linha por aula, a segunda avisa que segue a primeira', async () => {
    await montar(2);
    expect(linhas()).toHaveLength(2);
    expect(linhas()[1].textContent).toContain('igual à aula 1, uma semana depois');
    expect(status()).toBe('Escolha o dia da aula 1.');
  });

  it('escolher dia e professor na aula 1 leva a aula 2 para a semana seguinte, com o mesmo professor e horário', async () => {
    await montar(2);
    await clicar(chip(linhas()[0], 'Amanhã'));
    await mudar(linhas()[0].querySelector('select'), 'p2');
    await mudar(linhas()[0].querySelector('input[type="time"]'), '19:30');
    const segunda = linhas()[1];
    expect(chip(segunda, 'sáb 05/12').getAttribute('aria-pressed')).toBe('true');
    expect(segunda.querySelector('select').value).toBe('p2');
    expect(segunda.querySelector('input[type="time"]').value).toBe('19:30');
    expect(status()).toBe('Rafaela vira Visitante com 2 aulas: sáb 28/11 e sáb 05/12.');
  });

  it('a aula 2 no mesmo dia da aula 1 é recusada', async () => {
    await montar(2);
    await clicar(chip(linhas()[0], 'Amanhã'));
    await mudar(linhas()[0].querySelector('select'), 'p1');
    await clicar(chip(linhas()[1], 'Amanhã'));
    expect(linhas()[1].textContent).not.toContain('igual à aula 1');
    expect(status()).toBe('A aula 2 está no mesmo dia da aula 1. Escolha outro dia.');
  });

  it('horário que já passou hoje é recusado', async () => {
    await montar(1);
    await clicar(chip(linhas()[0], 'Hoje'));
    await mudar(linhas()[0].querySelector('select'), 'p1');
    await mudar(linhas()[0].querySelector('input[type="time"]'), '08:00');
    expect(status()).toBe('A aula 1 já passou. Escolha outro dia ou horário.');
  });

  it('Outro dia abre o campo de data', async () => {
    await montar(1);
    await clicar(chip(linhas()[0], 'Outro dia'));
    const campo = linhas()[0].querySelector('input[type="date"]');
    await mudar(campo, '2026-12-10');
    expect(chip(linhas()[0], 'qui 10/12').getAttribute('aria-pressed')).toBe('true');
  });
});
