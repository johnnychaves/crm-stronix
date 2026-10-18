// @vitest-environment jsdom
// A Agenda de hoje da Meta nova (mockup B). Ela mostra o mesmo dia do card da
// tela de hoje e mantém o que ele faz: marcar o desfecho de qualquer linha e
// corrigir ou desfazer o que já foi marcado. O que muda é o desenho: a sua que
// passou da hora tem os botões de Compareceu e Não compareceu, a de um colega
// tem "Sem desfecho", o que já tem desfecho mostra a etiqueta, e o que ainda
// vai acontecer não tem ação. O cenário é 16/10/2026, 14:32.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O balão (Radix) mede o gatilho, e o jsdom não tem ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {} }));

const { AgendaHoje } = await import('../../components/dailygoal/foco/AgendaHoje.jsx');

const at = (hh, mm = 0) => new Date(2026, 9, 16, hh, mm);
const NOW = at(14, 32);
const row = (id, name, hora, extra = {}) => ({
  id, name, scheduledAt: hora, categorySlug: 'visita_hoje', appointmentUnit: 'Moinhos',
  isMine: true, ownerName: 'Ana', outcome: null, ...extra,
});
const MINHA_PASSOU = row('a', 'Ana Passou', at(13, 30));
const DO_COLEGA = row('b', 'Bruno Colega', at(14, 0), { isMine: false, ownerName: 'Carla' });
const VEIO = row('c', 'Clara Veio', at(12, 0), { outcome: 'attended', outcomeByName: 'Ana' });
const PROXIMA = row('d', 'Davi Próximo', at(15, 0));
const DEPOIS = row('e', 'Eva Depois', at(17, 0));
const ROWS = [VEIO, MINHA_PASSOU, DO_COLEGA, PROXIMA, DEPOIS];

let root, host, onMark;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  onMark = vi.fn();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (rows = ROWS) => act(() => root.render(h(AgendaHoje, { rows, now: NOW, savingId: null, onMark })));
const linha = (nome) => [...host.querySelectorAll('li')].find((li) => li.textContent.includes(nome));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const itemDoBalao = (id) => document.querySelector(`[data-outcome-item="${id}"]`);

describe('Agenda de hoje da Meta nova', () => {
  it('pinta cada linha pelo estado e marca a próxima', () => {
    render();
    expect(linha('Clara Veio').dataset.estado).toBe('ok');
    expect(linha('Ana Passou').dataset.estado).toBe('pend');
    expect(linha('Bruno Colega').dataset.estado).toBe('pend');
    expect(linha('Davi Próximo').dataset.estado).toBe('next');
    expect(linha('Eva Depois').dataset.estado).toBe('later');
    expect(linha('Ana Passou').textContent).toContain('Visita · Moinhos · sua');
    expect(linha('Bruno Colega').textContent).toContain('de Carla');
  });

  it('a sua que passou da hora marca direto pelos botões', () => {
    render();
    const botoes = linha('Ana Passou').querySelectorAll('button');
    expect([...botoes].map((b) => b.getAttribute('aria-label'))).toEqual(['Compareceu: Ana Passou', 'Não compareceu: Ana Passou']);
    click(botoes[0]);
    expect(onMark).toHaveBeenCalledWith(MINHA_PASSOU, 'attended');
    click(botoes[1]);
    expect(onMark).toHaveBeenLastCalledWith(MINHA_PASSOU, 'no_show');
  });

  it('a de um colega mostra "Sem desfecho" e marca pelo balão, porque a agenda é de todos', () => {
    render();
    const gatilho = linha('Bruno Colega').querySelector('button');
    expect(gatilho.textContent).toBe('Sem desfecho');
    click(gatilho);
    click(itemDoBalao('attended'));
    expect(onMark).toHaveBeenCalledWith(DO_COLEGA, 'attended');
  });

  it('o que já tem desfecho mostra a etiqueta e o balão corrige ou desfaz', () => {
    render();
    const etiqueta = linha('Clara Veio').querySelector('button');
    expect(etiqueta.textContent).toBe('Compareceu');
    expect(etiqueta.getAttribute('aria-label')).toContain('Abrir para corrigir');
    click(etiqueta);
    expect(itemDoBalao('no_show')).not.toBeNull();
    click(itemDoBalao('undo'));
    expect(onMark).toHaveBeenCalledWith(VEIO, 'undo');
  });

  it('o que ainda vai acontecer não tem ação', () => {
    render();
    expect(linha('Davi Próximo').querySelector('button')).toBeNull();
    expect(linha('Eva Depois').querySelector('button')).toBeNull();
  });

  it('sem agendamento no dia, a Agenda não aparece', () => {
    render([]);
    expect(host.innerHTML).toBe('');
  });
});
