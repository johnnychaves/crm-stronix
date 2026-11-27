// Dias dos faltosos como texto AAAA-MM-DD (src/lib/faltosos/dias.js): a conta
// entre dias não depende do fuso, e "hoje" e o fim do contrato saem do
// calendário de Brasília.
import { describe, it, expect } from 'vitest';
import {
  numeroDoDia, diaValido, somarDias, diasEntre, maiorDia, mesDoDia, ddmm, ddmmaaaa, dataCurta,
  hojeEmBrasilia, diaEmBrasilia,
} from '../faltosos/dias.js';

describe('dias como texto', () => {
  it('reconhece só AAAA-MM-DD de um dia que existe', () => {
    expect(diaValido('2026-10-06')).toBe(true);
    expect(diaValido('2028-02-29')).toBe(true);
    expect(diaValido('2026-02-29')).toBe(false);
    expect(diaValido('2026-02-31')).toBe(false);
    expect(diaValido('06/10/2026')).toBe(false);
    expect(diaValido('2026-10-6')).toBe(false);
    expect(diaValido(null)).toBe(false);
    expect(Number.isNaN(numeroDoDia('2026-13-01'))).toBe(true);
  });

  it('o número do dia conta dias desde 01/01/1970', () => {
    expect(numeroDoDia('1970-01-02')).toBe(1);
    expect(numeroDoDia('2026-09-25')).toBe(20721);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-09-29', 7)).toBe('2026-10-06');
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(somarDias('2026-10-06', -7)).toBe('2026-09-29');
    expect(somarDias('2026-10-06', 1.5)).toBeNull();
    expect(somarDias('lixo', 1)).toBeNull();
  });

  it('conta os dias entre dois dias, e null com dia inválido', () => {
    expect(diasEntre('2026-09-25', '2026-10-06')).toBe(11);
    expect(diasEntre('2026-10-06', '2026-09-25')).toBe(-11);
    expect(diasEntre('2026-10-06', '2026-10-06')).toBe(0);
    expect(diasEntre('2026-10-06', null)).toBeNull();
  });

  it('o maior dia ignora o que não é dia', () => {
    expect(maiorDia('2026-09-25', null, '2026-10-02', 'x')).toBe('2026-10-02');
    expect(maiorDia(null, undefined)).toBeNull();
    expect(maiorDia()).toBeNull();
  });

  it('mês e textos curtos', () => {
    expect(mesDoDia('2026-10-06')).toBe('2026-10');
    expect(mesDoDia('x')).toBeNull();
    expect(ddmm('2026-10-03')).toBe('03/10');
    expect(ddmmaaaa('2026-10-03')).toBe('03/10/2026');
    expect(ddmm(null)).toBe('');
    expect(ddmmaaaa('2026-02-30')).toBe('');
  });
});

describe('dataCurta', () => {
  it('põe o ano só quando ele é outro', () => {
    expect(dataCurta('2026-10-02', '2026-10-05')).toBe('02/10');
    expect(dataCurta('2025-12-15', '2026-01-10')).toBe('15/12/2025');
    expect(dataCurta('2027-01-02', '2026-10-05')).toBe('02/01/2027');
  });

  it('sem o dia de hoje, fica sem o ano', () => {
    expect(dataCurta('2026-10-02')).toBe('02/10');
    expect(dataCurta('2026-10-02', 'x')).toBe('02/10');
  });

  it('o que não é dia vira texto vazio', () => {
    expect(dataCurta('2026-02-30', '2026-10-05')).toBe('');
    expect(dataCurta(null)).toBe('');
  });
});

describe('calendário de Brasília', () => {
  it('hoje é o dia de Brasília, mesmo quando o UTC já virou', () => {
    expect(hojeEmBrasilia(new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05');
    expect(hojeEmBrasilia(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-06');
    expect(hojeEmBrasilia(new Date('x'))).toBeNull();
  });

  it('o fim do contrato, gravado à meia-noite de Brasília, cai no próprio dia', () => {
    expect(diaEmBrasilia(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01');
    expect(diaEmBrasilia({ toDate: () => new Date('2026-12-01T03:00:00Z') })).toBe('2026-12-01');
    expect(diaEmBrasilia({ seconds: Date.parse('2026-12-01T03:00:00Z') / 1000 })).toBe('2026-12-01');
    expect(diaEmBrasilia(null)).toBeNull();
    expect(diaEmBrasilia('lixo')).toBeNull();
  });
});
