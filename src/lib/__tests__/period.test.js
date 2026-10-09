// Período dos Relatórios e da Visão geral (src/lib/period.js): atalhos, semana
// de segunda a domingo, intervalo e recusas, período anterior com o corte e
// textos do botão.
import { describe, it, expect } from 'vitest';
import {
  PERIOD_SHORTCUTS, periodFromParams, previousPeriod, monthsCovering, intervalRefusal, oldestDayKey,
  dateFromDayKey, rangeLabel, crossesMonths, dayLabelOf
} from '../period.js';

// 25/09/2026, sexta, 14h30. A semana dele vai de 21 (segunda) a 27 (domingo).
const NOW = new Date(2026, 8, 25, 14, 30);
const D = (m, d, h = 0, min = 0) => new Date(2026, m - 1, d, h, min);

describe('atalhos', () => {
  it('são quatro, e nenhum é o mês ou o intervalo', () => {
    expect(PERIOD_SHORTCUTS).toEqual(['hoje', 'ontem', 'semana', 'semana-passada']);
  });

  it('hoje vai da meia-noite até agora, em andamento', () => {
    const p = periodFromParams({ periodo: 'hoje' }, NOW);
    expect(p).toMatchObject({ kind: 'hoje', start: D(9, 25), fullEnd: D(9, 26), end: NOW, running: true, monthKey: null, days: 1 });
    expect(p.label).toBe('Hoje · 25 set');
  });

  it('ontem é o dia inteiro, fechado', () => {
    const p = periodFromParams({ periodo: 'ontem' }, NOW);
    expect(p).toMatchObject({ kind: 'ontem', start: D(9, 24), fullEnd: D(9, 25), end: D(9, 25), running: false, days: 1 });
    expect(p.label).toBe('Ontem · 24 set');
  });

  it('esta semana vai de segunda até agora, com a régua até domingo', () => {
    const p = periodFromParams({ periodo: 'semana' }, NOW);
    expect(p).toMatchObject({ kind: 'semana', start: D(9, 21), fullEnd: D(9, 28), end: NOW, running: true, days: 7 });
    expect(p.label).toBe('Esta semana · 21 a 25 set');
  });

  it('semana passada é a semana anterior inteira, de segunda a domingo', () => {
    const p = periodFromParams({ periodo: 'semana-passada' }, NOW);
    expect(p).toMatchObject({ kind: 'semana-passada', start: D(9, 14), fullEnd: D(9, 21), end: D(9, 21), running: false, days: 7 });
    expect(p.label).toBe('Semana passada · 14 a 20 set');
  });

  it('no domingo a semana ainda é a que começou na segunda', () => {
    const domingo = new Date(2026, 8, 27, 10);
    expect(periodFromParams({ periodo: 'semana' }, domingo)).toMatchObject({ start: D(9, 21), fullEnd: D(9, 28), label: 'Esta semana · 21 a 27 set' });
    expect(periodFromParams({ periodo: 'semana-passada' }, domingo)).toMatchObject({ start: D(9, 14), label: 'Semana passada · 14 a 20 set' });
  });

  it('na segunda a semana tem um dia só', () => {
    const segunda = new Date(2026, 8, 28, 9);
    expect(periodFromParams({ periodo: 'semana' }, segunda)).toMatchObject({ start: D(9, 28), fullEnd: D(10, 5), label: 'Esta semana · 28 set' });
    expect(periodFromParams({ periodo: 'semana-passada' }, segunda)).toMatchObject({ start: D(9, 21), label: 'Semana passada · 21 a 27 set' });
  });

  it('semana que cruza meses leva os dois meses no texto', () => {
    const quinta = new Date(2026, 9, 1, 11);
    const p = periodFromParams({ periodo: 'semana' }, quinta);
    expect(p).toMatchObject({ start: D(9, 28), fullEnd: D(10, 5), end: quinta, label: 'Esta semana · 28 set a 1 out' });
    expect(crossesMonths(p)).toBe(true);
    expect(monthsCovering(p.start, p.end)).toEqual(['2026-09', '2026-10']);
  });

  it('atalho desconhecido cai no mês', () => {
    expect(periodFromParams({ periodo: 'amanha' }, NOW).kind).toBe('mes');
  });
});

describe('mês', () => {
  it('sem período é o mês do endereço, com o texto de sempre', () => {
    const atual = periodFromParams({ monthKey: '2026-09' }, NOW);
    expect(atual).toMatchObject({ kind: 'mes', start: D(9, 1), fullEnd: D(10, 1), end: NOW, running: true, monthKey: '2026-09', days: 30 });
    expect(atual.label).toBe('Setembro 2026 · em andamento');
    const fechado = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(fechado).toMatchObject({ end: D(9, 1), running: false, label: 'Agosto 2026', days: 31 });
    expect(crossesMonths(fechado)).toBe(false);
  });

  it('sem mês nenhum é o mês de agora', () => {
    expect(periodFromParams({}, NOW).monthKey).toBe('2026-09');
  });
});

describe('intervalo', () => {
  it('de e até incluídos: o fim nominal é o dia seguinte ao até', () => {
    const p = periodFromParams({ de: '2026-09-01', ate: '2026-09-10' }, NOW);
    expect(p).toMatchObject({ kind: 'intervalo', start: D(9, 1), fullEnd: D(9, 11), end: D(9, 11), running: false, days: 10, de: '2026-09-01', ate: '2026-09-10' });
    expect(p.label).toBe('1 a 10 set');
  });

  it('intervalo que cruza meses e intervalo que termina hoje', () => {
    expect(periodFromParams({ de: '2026-08-28', ate: '2026-09-03' }, NOW).label).toBe('28 ago a 3 set');
    const ateHoje = periodFromParams({ de: '2026-09-20', ate: '2026-09-25' }, NOW);
    expect(ateHoje).toMatchObject({ end: NOW, running: true, fullEnd: D(9, 26), label: '20 a 25 set' });
  });

  it('ganha do atalho e do mês', () => {
    expect(periodFromParams({ de: '2026-09-01', ate: '2026-09-10', periodo: 'hoje', monthKey: '2026-07' }, NOW).kind).toBe('intervalo');
    expect(periodFromParams({ periodo: 'ontem', monthKey: '2026-07' }, NOW).kind).toBe('ontem');
  });

  it('intervalo recusado cai no mês atual, mesmo com atalho ou mês junto', () => {
    for (const [de, ate] of [
      ['2026-09-31', '2026-10-01'], ['2026-09-10', '2026-09-01'], ['2025-09-30', '2026-09-01'],
      ['2026-09-01', '2026-09-26'], ['2026-09-01', null], [null, '2026-09-10'], ['banana', '2026-09-10']
    ]) {
      const p = periodFromParams({ de, ate, periodo: 'hoje', monthKey: '2026-07' }, NOW);
      expect(p.kind, `${de} ${ate}`).toBe('mes');
      expect(p.monthKey, `${de} ${ate}`).toBe('2026-09');
    }
  });

  it('texto de trecho em outro ano', () => {
    const now = new Date(2027, 0, 10, 12);
    expect(periodFromParams({ de: '2026-12-28', ate: '2027-01-03' }, now).label).toBe('28 dez 2026 a 3 jan 2027');
    expect(periodFromParams({ de: '2026-11-02', ate: '2026-11-06' }, now).label).toBe('2 a 6 nov 2026');
    expect(rangeLabel(new Date(2026, 10, 2), new Date(2026, 10, 2), now)).toBe('2 nov 2026');
  });
});

describe('recusas do intervalo', () => {
  const HOJE = '2026-09-25';

  it('o mais antigo é o dia 1 do mês de 11 meses atrás', () => {
    expect(oldestDayKey(HOJE)).toBe('2025-10-01');
    expect(oldestDayKey('2026-01-15')).toBe('2025-02-01');
  });

  it('cada recusa com o motivo que o balão mostra', () => {
    expect(intervalRefusal('2026-09-01', null, HOJE)).toBe('Escolha as duas datas.');
    expect(intervalRefusal('', '2026-09-01', HOJE)).toBe('Escolha as duas datas.');
    expect(intervalRefusal('2026-02-30', '2026-03-01', HOJE)).toBe('Essa data não existe.');
    expect(intervalRefusal('banana', '2026-03-01', HOJE)).toBe('Essa data não existe.');
    expect(intervalRefusal('2026-09-10', '2026-09-01', HOJE)).toBe('A data final vem antes da inicial.');
    expect(intervalRefusal('2025-09-30', '2026-09-01', HOJE)).toBe('O período cabe nos últimos 12 meses: comece em 01/10/2025 ou depois.');
    expect(intervalRefusal('2026-09-01', '2026-09-26', HOJE)).toBe('A data final não pode passar de hoje.');
  });

  it('valem: o primeiro dia aceito, um dia só, até hoje', () => {
    expect(intervalRefusal('2025-10-01', '2026-09-25', HOJE)).toBeNull();
    expect(intervalRefusal('2026-09-25', '2026-09-25', HOJE)).toBeNull();
  });

  it('data que existe vira a meia-noite local; a que não existe, null', () => {
    expect(dateFromDayKey('2026-09-01')).toEqual(D(9, 1));
    expect(dateFromDayKey('2026-09-31')).toBeNull();
    expect(dateFromDayKey('2026-9-1')).toBeNull();
    expect(dateFromDayKey(null)).toBeNull();
  });
});

describe('período anterior', () => {
  it('hoje compara com ontem, da meia-noite até a mesma hora', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'hoje' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 24), fullEnd: D(9, 25), end: D(9, 24, 14, 30), running: false, label: '24 set' });
  });

  it('ontem compara com anteontem inteiro', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'ontem' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 23), fullEnd: D(9, 24), end: D(9, 24), label: '23 set' });
  });

  it('esta semana compara com a passada até o mesmo dia da semana e a mesma hora', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'semana' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 14), fullEnd: D(9, 21), end: D(9, 18, 14, 30), label: '14 a 18 set' });
  });

  it('semana passada compara com a anterior inteira', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'semana-passada' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 7), fullEnd: D(9, 14), end: D(9, 14), label: '7 a 13 set' });
  });

  it('intervalo de N dias compara com os N dias logo antes, e corta no mesmo ponto quando inclui hoje', () => {
    const fechado = previousPeriod(periodFromParams({ de: '2026-09-01', ate: '2026-09-10' }, NOW), NOW);
    expect(fechado).toMatchObject({ start: D(8, 22), fullEnd: D(9, 1), end: D(9, 1), days: 10, label: '22 a 31 ago' });
    const aberto = previousPeriod(periodFromParams({ de: '2026-09-20', ate: '2026-09-25' }, NOW), NOW);
    expect(aberto).toMatchObject({ start: D(9, 14), fullEnd: D(9, 20), end: D(9, 19, 14, 30), label: '14 a 19 set' });
  });

  it('mês: o mês anterior, ou o escolhido, com o corte pró-rata no mês em andamento', () => {
    const atual = periodFromParams({ monthKey: '2026-09' }, NOW);
    expect(previousPeriod(atual, NOW)).toMatchObject({ kind: 'mes', monthKey: '2026-08', start: D(8, 1), fullEnd: D(9, 1), end: D(8, 25, 14, 30), label: 'Agosto 2026' });
    expect(previousPeriod(atual, NOW, { compareKey: '2026-06' })).toMatchObject({ monthKey: '2026-06', end: D(6, 25, 14, 30) });
    const fechado = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(previousPeriod(fechado, NOW)).toMatchObject({ monthKey: '2026-07', end: D(8, 1) });
  });
});

describe('meses da janela', () => {
  it('toca os meses do início ao último instante, e janela vazia fica no mês do início', () => {
    expect(monthsCovering(D(8, 28), D(9, 4))).toEqual(['2026-08', '2026-09']);
    expect(monthsCovering(D(9, 30), D(10, 1))).toEqual(['2026-09']);
    expect(monthsCovering(D(9, 1), D(9, 1))).toEqual(['2026-09']);
    expect(monthsCovering(new Date(2025, 10, 5), D(1, 10))).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('rótulo curto do dia, com o mês quando pedido', () => {
    expect(dayLabelOf('2026-10-03')).toBe('3');
    expect(dayLabelOf('2026-10-03', true)).toBe('3/10');
  });
});
