// Testes da regra pura do funil VENCIDOS (expiredGoal.js). Datas sempre em
// horário LOCAL, como o app faz. A fronteira do dia do vencimento é o ponto
// que mais erra, então ela está travada aqui.

import { describe, it, expect } from 'vitest';
import { shouldPromptExpired, expiredLabel, expiredSortKey, isExpiredClient } from '../expiredGoal.js';

const NOW = new Date(2026, 6, 15, 10, 0, 0); // quarta, 15/07/2026 10:00

// Meia-noite do dia (hoje + offset). É assim que o app grava vigência:
// fromDateInputValue devolve meia-noite local e addMonths preserva a hora.
const dayAt = (offsetDays) => {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};

const cliente = (over = {}) => ({
  id: 'c1',
  name: 'Cliente Teste',
  status: 'Venda',
  lifecycleStage: 'cliente',
  currentContractStartsAt: dayAt(-200),
  currentContractEndsAt: dayAt(-4),
  ...over
});

describe('shouldPromptExpired — quem entra no funil Vencidos', () => {
  it('entra: venceu hoje (vigência terminou à meia-noite de hoje)', () => {
    const l = cliente({ currentContractEndsAt: dayAt(0) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('entra: venceu há 1 dia', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-1) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('entra: no último dia do período', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-15) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('sai: um dia depois do período', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-16) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('a academia manda no período: 7 derruba o que 30 mantém', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-10) });
    expect(shouldPromptExpired(l, NOW, 7)).toBe(false);
    expect(shouldPromptExpired(l, NOW, 30)).toBe(true);
  });

  it('sem informar o período, vale o padrão de 15 dias', () => {
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(-10) }), NOW)).toBe(true);
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(-40) }), NOW)).toBe(false);
  });

  it('sai: contrato ainda vigente', () => {
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(90) }), NOW, 15)).toBe(false);
  });

  it('sai: contrato a vencer (ainda não venceu)', () => {
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(10) }), NOW, 15)).toBe(false);
  });

  it('sai: matrícula agendada para o futuro', () => {
    const l = cliente({ currentContractStartsAt: dayAt(5), currentContractEndsAt: dayAt(370) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: contrato cancelado (cancelar não é vencer)', () => {
    const l = cliente({ currentContractStatus: 'cancelado' });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: contrato trancado (a vigência está congelada)', () => {
    const l = cliente({ currentContractStatus: 'trancado' });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: cliente legado sem vigência gravada', () => {
    const l = cliente({ currentContractEndsAt: null });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: não é cliente (lead em prospecção)', () => {
    const l = cliente({ lifecycleStage: undefined, status: 'Novo' });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: já disse que não vai renovar', () => {
    const l = cliente({ renewalDeclined: true });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: tem contato marcado para hoje (vive em Contatos)', () => {
    const l = cliente({ nextFollowUp: new Date(2026, 6, 15, 9, 0, 0) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: tem contato marcado para o futuro', () => {
    const l = cliente({ nextFollowUp: dayAt(3) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('entra: contato marcado passou sem desfecho', () => {
    const l = cliente({ nextFollowUp: dayAt(-2) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('lead nulo não quebra', () => {
    expect(shouldPromptExpired(null, NOW, 15)).toBe(false);
  });
});

describe('expiredLabel', () => {
  it('dia do vencimento fala "Venceu hoje"', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: dayAt(0) }), NOW)).toBe('Venceu hoje');
  });

  it('singular no primeiro dia', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: dayAt(-1) }), NOW)).toBe('Venceu há 1 dia');
  });

  it('plural depois disso', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: dayAt(-7) }), NOW)).toBe('Venceu há 7 dias');
  });

  it('sem vigência gravada não inventa rótulo', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: null }), NOW)).toBeNull();
  });
});

describe('expiredSortKey', () => {
  it('ordena o vencimento mais recente primeiro', () => {
    const antigo = cliente({ id: 'a', currentContractEndsAt: dayAt(-12) });
    const recente = cliente({ id: 'b', currentContractEndsAt: dayAt(-1) });
    const ordenado = [antigo, recente].sort((x, y) => expiredSortKey(y) - expiredSortKey(x));
    expect(ordenado.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('sem vigência vai para o fim', () => {
    expect(expiredSortKey(cliente({ currentContractEndsAt: null }))).toBe(0);
  });
});

describe('isExpiredClient — a base que o funil do board consome', () => {
  const AGORA = new Date(2026, 7, 18, 10, 0);
  const venceuOntem = {
    lifecycleStage: 'cliente',
    currentContractEndsAt: new Date(2026, 7, 17),
    currentContractStatus: 'ativo',
  };

  it('cliente com contrato vencido conta, SEM janela de tempo', () => {
    expect(isExpiredClient(venceuOntem, AGORA)).toBe(true);
    // Um ano depois continua contando: o funil do board é permanente. É a Meta
    // que cobra por N dias e solta.
    expect(isExpiredClient(venceuOntem, new Date(2027, 7, 18))).toBe(true);
  });

  it('quem não é cliente fica de fora', () => {
    expect(isExpiredClient({ ...venceuOntem, lifecycleStage: null }, AGORA)).toBe(false);
    expect(isExpiredClient(null, AGORA)).toBe(false);
  });

  // A diferença central entre a base e a regra da Meta.
  it('renewalDeclined NÃO exclui do funil, mas exclui da cobrança diária', () => {
    const recusou = { ...venceuOntem, renewalDeclined: true };
    expect(isExpiredClient(recusou, AGORA)).toBe(true);
    expect(shouldPromptExpired(recusou, AGORA, 15)).toBe(false);
  });
});
