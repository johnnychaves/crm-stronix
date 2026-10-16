// @vitest-environment jsdom
// Seletor de período em uso (jsdom): o que o periodControl.test.js, que só lê o
// HTML, não alcança. Atalho, Personalizado, recusa do intervalo, Enter, Escape e
// o que o leitor de tela encontra no botão e no balão.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { periodFromParams, intervalRefusal } from '../period.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { PeriodControl } = await import('../../components/period/PeriodControl.jsx');

const NOW = new Date(2026, 8, 25, 14, 30);
const TODAY = '2026-09-25';
const period = (params) => periodFromParams(params, NOW);

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(PeriodControl, { todayKey: TODAY, onPeriod: () => {}, onRange: () => {}, ...props }));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

const gatilho = () => document.querySelector('[data-slot="popover-trigger"]');
const balao = () => document.querySelector('[data-slot="popover-content"]');
const item = (texto) => [...balao().querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const campos = () => [...balao().querySelectorAll('input[type="date"]')];
const aviso = () => balao().querySelector('[role="alert"]');
const clicar = async (el) => { await act(async () => { el.click(); }); };
// O React só enxerga o valor novo pelo setter nativo; `input.value = ...` direto passa batido.
const digitar = async (el, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const apertarEscape = async () => {
  await act(async () => {
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
};
// O Radix devolve o foco ao botão num setTimeout(0): passa esse ciclo antes de conferir o foco.
const esperarFoco = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('seletor de período em uso', () => {
  it('um atalho chama onPeriod com o id e fecha o balão', async () => {
    const onPeriod = vi.fn();
    await montar({ period: period({ periodo: 'hoje' }), onPeriod });
    await clicar(gatilho());
    await clicar(item('Ontem'));
    expect(onPeriod).toHaveBeenCalledTimes(1);
    expect(onPeriod).toHaveBeenCalledWith('ontem');
    expect(balao()).toBeNull();
    // O Mês, vindo de outro período, também é uma escolha.
    await clicar(gatilho());
    await clicar(item('Mês'));
    expect(onPeriod).toHaveBeenLastCalledWith('mes');
    expect(balao()).toBeNull();
  });

  it('Personalizado abre os campos no mesmo balão, sem chamar onPeriod', async () => {
    const onPeriod = vi.fn();
    await montar({ period: period({ periodo: 'hoje' }), onPeriod });
    await clicar(gatilho());
    expect(campos()).toHaveLength(0);
    await clicar(item('Personalizado'));
    expect(onPeriod).not.toHaveBeenCalled();
    expect(balao()).not.toBeNull();
    expect(campos().map((c) => c.labels[0].textContent.trim())).toEqual(['De', 'Até']);
    expect(campos().map((c) => c.value)).toEqual(['', '']);
  });

  it('um intervalo recusado mostra o motivo sem aplicar, e mexer num campo apaga o motivo', async () => {
    const onRange = vi.fn();
    await montar({ period: period({ periodo: 'hoje' }), onRange });
    await clicar(gatilho());
    await clicar(item('Personalizado'));
    const [de, ate] = campos();
    const recusados = [
      ['', ''], // as duas datas em branco
      ['2026-09-10', '2026-09-01'], // fim antes do início
      ['2025-09-30', '2026-09-03'] // antes da janela de 12 meses
    ];
    for (const [d, a] of recusados) {
      await digitar(de, d);
      await digitar(ate, a);
      await clicar(item('Aplicar'));
      const motivo = intervalRefusal(d, a, TODAY);
      expect(motivo, `${d} ${a}`).toBeTruthy();
      expect(aviso()?.textContent, `${d} ${a}`).toBe(motivo);
      expect(onRange).not.toHaveBeenCalled();
      expect(balao()).not.toBeNull();
      // O motivo fica ligado aos dois campos para o leitor de tela.
      expect(de.getAttribute('aria-invalid')).toBe('true');
      expect(de.getAttribute('aria-describedby')).toBe(aviso().id);
      expect(ate.getAttribute('aria-describedby')).toBe(aviso().id);
    }
    await digitar(ate, '2026-09-12');
    expect(aviso()).toBeNull();
    expect(de.getAttribute('aria-invalid')).toBe('false');
    expect(de.hasAttribute('aria-describedby')).toBe(false);
    expect(ate.hasAttribute('aria-describedby')).toBe(false);
  });

  it('um intervalo válido chama onRange(de, ate) e fecha o balão', async () => {
    const onRange = vi.fn();
    await montar({ period: period({ periodo: 'hoje' }), onRange });
    await clicar(gatilho());
    await clicar(item('Personalizado'));
    const [de, ate] = campos();
    await digitar(de, '2026-09-01');
    await digitar(ate, '2026-09-05');
    await clicar(item('Aplicar'));
    expect(onRange).toHaveBeenCalledTimes(1);
    expect(onRange).toHaveBeenCalledWith('2026-09-01', '2026-09-05');
    expect(balao()).toBeNull();
  });

  it('enviar o formulário, que é o que o Enter num campo faz, aplica o intervalo', async () => {
    const onRange = vi.fn();
    await montar({ period: period({ periodo: 'hoje' }), onRange });
    await clicar(gatilho());
    await clicar(item('Personalizado'));
    const [de, ate] = campos();
    await digitar(de, '2026-09-01');
    await digitar(ate, '2026-09-05');
    // O navegador leva o Enter de um campo ao botão de envio do formulário dele.
    expect(de.form).not.toBeNull();
    expect(ate.form).toBe(de.form);
    expect(item('Aplicar').type).toBe('submit');
    expect(item('Aplicar').form).toBe(de.form);
    await act(async () => { de.form.requestSubmit(); });
    expect(onRange).toHaveBeenCalledWith('2026-09-01', '2026-09-05');
    expect(balao()).toBeNull();
  });

  it('escolher o que já vale fecha o balão sem chamar onPeriod', async () => {
    const onPeriod = vi.fn();
    await montar({ period: period({ monthKey: '2026-08' }), onPeriod });
    await clicar(gatilho());
    await clicar(item('Mês'));
    expect(onPeriod).not.toHaveBeenCalled();
    expect(balao()).toBeNull();
  });

  it('Escape fecha o balão e devolve o foco; a próxima abertura volta ao período do endereço', async () => {
    await montar({ period: period({ de: '2026-08-28', ate: '2026-09-03' }) });
    await clicar(gatilho());
    await digitar(campos()[0], '2026-09-01');
    expect(campos()[0].value).toBe('2026-09-01');
    await apertarEscape();
    expect(balao()).toBeNull();
    await esperarFoco();
    expect(document.activeElement).toBe(gatilho());
    await clicar(gatilho());
    expect(campos().map((c) => c.value)).toEqual(['2026-08-28', '2026-09-03']);
  });

  it('o botão se chama Período e é descrito pelo texto do período; o balão tem nome e borda própria', async () => {
    await montar({ period: period({ periodo: 'hoje' }) });
    expect(gatilho().getAttribute('aria-label')).toBe('Período');
    const ligacao = gatilho().getAttribute('aria-describedby');
    expect(ligacao).toBeTruthy();
    const valor = document.getElementById(ligacao);
    expect(gatilho().contains(valor)).toBe(true);
    expect(valor.textContent).toBe('Hoje · 25 set');
    await clicar(gatilho());
    expect(balao().getAttribute('role')).toBe('dialog');
    expect(balao().getAttribute('aria-label')).toBe('Escolher período');
    // Sem a cor, o `border` do shadcn sai na cor do texto.
    expect(balao().className).toContain('border-border');
  });
});
