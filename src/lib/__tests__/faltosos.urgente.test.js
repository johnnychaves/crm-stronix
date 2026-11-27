// O urgente e o contrato ativo do aluno faltando (src/lib/faltosos/urgente.js).
// O urgente conta dias no calendário de Brasília. Na máquina de
// desenvolvimento, que fica em Brasília, um erro de fuso não aparece, então
// este arquivo põe o processo em UTC antes de importar, como o zapFuso.test.js,
// e o primeiro teste confere que a troca pegou.

/* global process -- o lint de src/ é o do navegador, e este teste troca o fuso do processo do Node */
import { describe, it, expect, vi, afterAll } from 'vitest';

const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { situacaoDoContrato, fimDoContrato, urgenteDe } from '../faltosos/urgente.js';
import { deriveLeadContractStatus } from '../contracts.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Instante escrito no horário de Brasília: brt('2026-10-06T10:00').
const brt = (s) => new Date(`${s}:00-03:00`);
// Fim de contrato como o app grava: meia-noite de Brasília do dia.
const fim = (dia) => brt(`${dia}T00:00`);

const AGORA = brt('2026-10-06T10:00');
const cliente = (extra = {}) => ({
  lifecycleBucket: 'cliente',
  currentContractId: 'c1',
  currentContractStatus: 'ativo',
  currentContractStartsAt: fim('2026-01-01'),
  currentContractEndsAt: fim('2027-01-01'),
  ...extra,
});

// Renovação marcada para 21/10, com o contrato em uso até 20/10: o resumo do
// lead já aponta a renovação, e o bloco "em uso" guarda o contrato de hoje.
const renovou = (extra = {}) => cliente({
  currentContractId: 'c2',
  currentContractStartsAt: fim('2026-10-21'),
  currentContractEndsAt: fim('2027-10-21'),
  inUseContractId: 'c1',
  inUseContractStatus: 'ativo',
  inUseContractEndsAt: fim('2026-10-20'),
  ...extra,
});

describe('processo em UTC', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

describe('situacaoDoContrato', () => {
  it('ativo e a vencer contam como contrato ativo', () => {
    expect(situacaoDoContrato(cliente(), AGORA)).toBe('ativo');
    expect(situacaoDoContrato(cliente({ currentContractEndsAt: fim('2026-10-20') }), AGORA)).toBe('ativo');
  });

  it('trancado é trancado; vencido, cancelado, agendado e sem contrato não são ativos', () => {
    expect(situacaoDoContrato(cliente({ currentContractStatus: 'trancado' }), AGORA)).toBe('trancado');
    expect(situacaoDoContrato(cliente({ currentContractEndsAt: fim('2026-10-01') }), AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato(cliente({ currentContractStatus: 'cancelado' }), AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato(cliente({ currentContractStartsAt: fim('2026-11-01') }), AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato({ lifecycleBucket: 'cliente' }, AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato(null, AGORA)).toBe('sem_contrato_ativo');
  });

  it('no último dia, com o fim gravado à meia-noite, já está vencido, como em Clientes', () => {
    const lead = cliente({ currentContractEndsAt: fim('2026-10-06') });
    expect(deriveLeadContractStatus(lead, AGORA)).toBe('vencido');
    expect(situacaoDoContrato(lead, AGORA)).toBe('sem_contrato_ativo');
  });

  it('com a renovação marcada, vale o contrato em uso: ativo, ou trancado quando ele está trancado', () => {
    expect(situacaoDoContrato(renovou(), AGORA)).toBe('ativo');
    expect(situacaoDoContrato(renovou({ inUseContractStatus: 'trancado' }), AGORA)).toBe('trancado');
  });
});

describe('o fim que vale para o urgente', () => {
  it('é o do último contrato', () => {
    expect(fimDoContrato(cliente())).toEqual(fim('2027-01-01'));
    expect(fimDoContrato({ lifecycleBucket: 'cliente' })).toBeNull();
    expect(fimDoContrato(null)).toBeNull();
  });

  it('com a renovação marcada, é o fim da renovação: quem já renovou não fica urgente', () => {
    expect(fimDoContrato(renovou())).toEqual(fim('2027-10-21'));
    expect(urgenteDe(renovou(), AGORA, 90)).toEqual({ urgente: false, contratoTerminaEm: '2027-10-21' });
  });

  it('a renovação curta, que também termina dentro da janela, deixa o aluno urgente', () => {
    const curta = renovou({ currentContractEndsAt: fim('2026-11-21') });
    expect(urgenteDe(curta, AGORA, 90)).toEqual({ urgente: true, contratoTerminaEm: '2026-11-21' });
  });

  it('o bloco "em uso" que ficou no lead depois de a renovação começar não muda nada', () => {
    const depois = brt('2026-10-22T10:00');
    const semBloco = renovou({ inUseContractId: null, inUseContractStatus: null, inUseContractEndsAt: null });
    expect(urgenteDe(renovou(), depois, 90)).toEqual({ urgente: false, contratoTerminaEm: '2027-10-21' });
    expect(urgenteDe(renovou(), depois, 90)).toEqual(urgenteDe(semBloco, depois, 90));
  });

  it('contrato em uso trancado, com a renovação marcada: não é urgente', () => {
    expect(urgenteDe(renovou({ inUseContractStatus: 'trancado' }), AGORA, 90).urgente).toBe(false);
  });
});

describe('urgenteDe', () => {
  it('contrato que termina em até 90 dias é urgente', () => {
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-12-01') }), AGORA, 90)).toEqual({ urgente: true, contratoTerminaEm: '2026-12-01' });
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-04') }), AGORA, 90)).toEqual({ urgente: true, contratoTerminaEm: '2027-01-04' });
  });

  it('91 dias não é urgente, e a janela é da academia', () => {
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-05') }), AGORA, 90).urgente).toBe(false);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-12-01') }), AGORA, 30).urgente).toBe(false);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-12-01') }), AGORA, '60').urgente).toBe(true);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-04') }), AGORA, 'x').urgente).toBe(true);
  });

  it('o dia conta pelo calendário de Brasília, não pelo UTC', () => {
    // 23h30 de 05/10 em Brasília já é 06/10 em UTC.
    const noite = brt('2026-10-05T23:30');
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-03') }), noite, 90).urgente).toBe(true);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-04') }), noite, 90).urgente).toBe(false);
  });

  it('trancado e vencido não são urgentes, mas dizem quando o contrato termina', () => {
    expect(urgenteDe(cliente({ currentContractStatus: 'trancado', currentContractEndsAt: fim('2026-11-01') }), AGORA, 90))
      .toEqual({ urgente: false, contratoTerminaEm: '2026-11-01' });
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-10-01') }), AGORA, 90))
      .toEqual({ urgente: false, contratoTerminaEm: '2026-10-01' });
  });

  it('sem contrato, nada', () => {
    expect(urgenteDe({ lifecycleBucket: 'cliente' }, AGORA, 90)).toEqual({ urgente: false, contratoTerminaEm: null });
    expect(urgenteDe(null, AGORA, 90)).toEqual({ urgente: false, contratoTerminaEm: null });
  });
});
