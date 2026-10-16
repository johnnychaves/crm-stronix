// Os casos do porDia, rodados em dois fusos: o de Brasília (o da academia) e o
// UTC (o da Vercel e de muita máquina de CI). Cada arquivo de teste põe o fuso
// no processo antes de importar e chama casosPorDia. Não é arquivo de teste.
import { describe, it, expect } from 'vitest';
import { porDia } from '../relatorios/leads/porDia.js';
import { monthPeriod, periodFromParams } from '../period.js';

const soma = (dias) => dias.reduce((s, d) => s + d.count, 0);
const at = (d) => d.when;

export function casosPorDia(fuso) {
  describe(`porDia (${fuso})`, () => {
    it('o fuso pegou', () => {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(fuso);
    });

    it('sem linhas, um dia zerado para cada dia do mês fechado', () => {
      const now = new Date(2026, 9, 15, 14, 30);
      const dias = porDia([], monthPeriod('2026-09', now), at, now);
      expect(dias).toHaveLength(30);
      expect(dias[0].key).toBe('2026-09-01');
      expect(dias[29].key).toBe('2026-09-30');
      expect(soma(dias)).toBe(0);
      expect(dias.some((d) => d.today)).toBe(false);
      for (const d of dias) {
        expect(d.date.getHours()).toBe(0);
        expect(d.count).toBe(0);
      }
    });

    it('no mês em andamento, vai até hoje, marca hoje e a soma é o total', () => {
      const now = new Date(2026, 9, 15, 14, 30);
      const rows = [
        { when: new Date(2026, 9, 1, 8) },
        { when: new Date(2026, 9, 1, 19) },
        { when: new Date(2026, 9, 7, 12) },
        { when: new Date(2026, 9, 15, 9) },
      ];
      const dias = porDia(rows, monthPeriod('2026-10', now), at, now);
      expect(dias).toHaveLength(15);
      expect(dias.at(-1)).toMatchObject({ key: '2026-10-15', count: 1, today: true });
      expect(dias.filter((d) => d.today)).toHaveLength(1);
      expect(dias[0].count).toBe(2);
      expect(dias[6].count).toBe(1);
      expect(soma(dias)).toBe(rows.length);
    });

    it('a linha à meia-noite em ponto cai no dia que começa, e um milissegundo antes no anterior', () => {
      const now = new Date(2026, 9, 15, 14, 30);
      const rows = [{ when: new Date(2026, 9, 3, 0, 0, 0, 0) }, { when: new Date(2026, 9, 2, 23, 59, 59, 999) }];
      const dias = porDia(rows, monthPeriod('2026-10', now), at, now);
      expect(dias.find((d) => d.key === '2026-10-03').count).toBe(1);
      expect(dias.find((d) => d.key === '2026-10-02').count).toBe(1);
      expect(soma(dias)).toBe(2);
    });

    it('os dias seguem o calendário mesmo na virada do horário de verão', () => {
      // Em Brasília, 04/11/2018 não teve meia-noite (o relógio pulou para 1h) e
      // 16/02/2019 teve a hora das 23h duas vezes. Somar 24 horas pularia ou repetiria um dia.
      const inicio = { start: new Date(2018, 10, 1), fullEnd: new Date(2018, 10, 8) };
      const fim = { start: new Date(2019, 1, 14), fullEnd: new Date(2019, 1, 20) };
      const now = new Date(2026, 9, 15);
      const chaves = (p) => porDia([], p, at, now).map((d) => d.key);
      expect(chaves(inicio)).toEqual(['01', '02', '03', '04', '05', '06', '07'].map((d) => `2018-11-${d}`));
      expect(chaves(fim)).toEqual(['14', '15', '16', '17', '18', '19'].map((d) => `2019-02-${d}`));
      const rows = [{ when: new Date(2018, 10, 4, 1, 30) }, { when: new Date(2018, 10, 3, 23, 30) }];
      expect(porDia(rows, inicio, at, now).map((d) => d.count)).toEqual([0, 0, 1, 1, 0, 0, 0]);
    });

    it('Hoje é um dia só, e a semana em andamento para em hoje', () => {
      const now = new Date(2026, 9, 15, 14, 30); // quinta-feira
      const hoje = porDia([{ when: new Date(2026, 9, 15, 7) }], periodFromParams({ periodo: 'hoje' }, now), at, now);
      expect(hoje).toEqual([{ key: '2026-10-15', date: new Date(2026, 9, 15), count: 1, today: true }]);
      const semana = porDia([], periodFromParams({ periodo: 'semana' }, now), at, now);
      expect(semana.map((d) => d.key)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    });

    it('linha sem data ou fora dos dias não conta', () => {
      const now = new Date(2026, 9, 15, 14, 30);
      const rows = [{ when: null }, { when: new Date('x') }, { when: new Date(2026, 8, 30, 23) }, { when: new Date(2026, 9, 16, 1) }, { when: new Date(2026, 9, 5) }];
      expect(soma(porDia(rows, monthPeriod('2026-10', now), at, now))).toBe(1);
    });
  });
}
