// Testes de CARACTERIZAÇÃO de leadStatus.js — congelam o comportamento ATUAL
// dos helpers de temperatura/recência do lead. Se um caso parecer estranho,
// ele documenta o que o código FAZ hoje (com comentário), não o que deveria
// fazer. Datas sempre construídas em horário LOCAL; o relógio é fixado com
// vi.useFakeTimers porque as funções leem Date.now().

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HOUR_MS,
  DAY_MS,
  LIST_PAGE_SIZE,
  buildInteractionIndex,
  isLeadActive,
  getDaysSinceFromDate,
  isHotLeadFromDate,
  isColdLeadFromDate
} from '../leadStatus.js';

// 15 de julho de 2026, 12:00 local — "agora" de referência dos testes.
const NOW = new Date(2026, 6, 15, 12, 0, 0);
const ago = (ms) => new Date(NOW.getTime() - ms);
const ahead = (ms) => new Date(NOW.getTime() + ms);

let seq = 0;
const lead = (over = {}) => ({
  id: over.id || `l${++seq}`,
  name: 'Lead Teste',
  status: 'Contato',
  consultantId: 'u1',
  createdAt: new Date(2026, 5, 1, 10, 0), // antigo por padrão (não dispara critério 1)
  nextFollowUp: null,
  ...over
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LIST_PAGE_SIZE (guarda de regressão do "Carregar mais")', () => {
  it('vale 50', () => {
    expect(LIST_PAGE_SIZE).toBe(50);
  });
});

describe('buildInteractionIndex', () => {
  it('agrupa por leadId com count e lastDate = max(createdAt)', () => {
    const idx = buildInteractionIndex([
      { leadId: 'l1', type: 'note', createdAt: new Date(2026, 6, 10, 9, 0) },
      { leadId: 'l1', type: 'call', createdAt: new Date(2026, 6, 12, 14, 0) },
      { leadId: 'l1', type: 'note', createdAt: new Date(2026, 6, 11, 8, 0) },
      { leadId: 'l2', type: 'note', createdAt: new Date(2026, 6, 5, 10, 0) }
    ]);
    expect(idx.size).toBe(2);
    expect(idx.get('l1').count).toBe(3);
    expect(idx.get('l1').lastDate.getTime()).toBe(new Date(2026, 6, 12, 14, 0).getTime());
    expect(idx.get('l2').count).toBe(1);
    expect(idx.get('l2').lastDate.getTime()).toBe(new Date(2026, 6, 5, 10, 0).getTime());
    expect(idx.get('l3')).toBeUndefined();
  });

  it('lista nula/indefinida/vazia vira Map vazio', () => {
    expect(buildInteractionIndex(null).size).toBe(0);
    expect(buildInteractionIndex(undefined).size).toBe(0);
    expect(buildInteractionIndex([]).size).toBe(0);
  });

  it('createdAt que não é Date conta no count mas NÃO entra no lastDate', () => {
    // Timestamp do Firestore ({seconds}) e string NÃO são convertidos aqui —
    // o índice só reconhece instâncias de Date.
    const idx = buildInteractionIndex([
      { leadId: 'l1', type: 'note', createdAt: { seconds: 1780000000 } },
      { leadId: 'l1', type: 'note', createdAt: '2026-07-10' },
      { leadId: 'l1', type: 'note' } // sem createdAt
    ]);
    expect(idx.get('l1').count).toBe(3);
    expect(idx.get('l1').lastDate).toBeNull();
  });

  it('interações sem leadId são agrupadas sob a chave undefined (comportamento atual)', () => {
    // Não há guarda para leadId ausente: idx.get(undefined) vira uma entrada real.
    const idx = buildInteractionIndex([
      { type: 'note', createdAt: new Date(2026, 6, 10) },
      { type: 'note', createdAt: new Date(2026, 6, 11) }
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get(undefined).count).toBe(2);
    expect(idx.get(undefined).lastDate.getTime()).toBe(new Date(2026, 6, 11).getTime());
  });

  it('SURPRESA caracterizada: Invalid Date na 1ª interação "envenena" o lastDate', () => {
    // Invalid Date passa no instanceof Date e é gravado quando lastDate ainda é
    // null; depois, qualquer comparação `data > InvalidDate` é false (NaN), então
    // datas válidas posteriores NÃO substituem o Invalid Date. lastDate fica
    // inválido para sempre nesse lead.
    const idx = buildInteractionIndex([
      { leadId: 'l1', type: 'note', createdAt: new Date('data-invalida') },
      { leadId: 'l1', type: 'note', createdAt: new Date(2026, 6, 12) }
    ]);
    expect(idx.get('l1').count).toBe(2);
    expect(idx.get('l1').lastDate).toBeInstanceOf(Date);
    expect(isNaN(idx.get('l1').lastDate.getTime())).toBe(true);

    // Na ordem inversa (válida primeiro), a inválida não sobrescreve.
    const idx2 = buildInteractionIndex([
      { leadId: 'l1', type: 'note', createdAt: new Date(2026, 6, 12) },
      { leadId: 'l1', type: 'note', createdAt: new Date('data-invalida') }
    ]);
    expect(idx2.get('l1').lastDate.getTime()).toBe(new Date(2026, 6, 12).getTime());
  });
});

describe('isLeadActive', () => {
  it('ativo = qualquer status que não seja Venda nem Perda', () => {
    expect(isLeadActive(lead({ status: 'Novo' }))).toBe(true);
    expect(isLeadActive(lead({ status: 'Contato' }))).toBe(true);
    expect(isLeadActive(lead({ status: 'Negociação' }))).toBe(true);
    expect(isLeadActive(lead({ status: 'Venda' }))).toBe(false);
    expect(isLeadActive(lead({ status: 'Perda' }))).toBe(false);
  });

  it('lead nulo/indefinido retorna o próprio valor falsy (não false)', () => {
    // `lead && ...` propaga o operando esquerdo — comportamento atual.
    expect(isLeadActive(null)).toBe(null);
    expect(isLeadActive(undefined)).toBe(undefined);
  });

  it('lead sem status conta como ativo', () => {
    expect(isLeadActive({ id: 'l1' })).toBe(true);
  });
});

describe('getDaysSinceFromDate', () => {
  it('usa a última interação quando ela é Date; arredonda pra baixo (floor)', () => {
    const l = lead({ createdAt: ago(30 * DAY_MS) });
    expect(getDaysSinceFromDate(l, ago(3 * DAY_MS))).toBe(3);
    expect(getDaysSinceFromDate(l, ago(3 * DAY_MS + 23 * HOUR_MS))).toBe(3); // 3d23h → 3
    expect(getDaysSinceFromDate(l, ago(0))).toBe(0);
  });

  it('sem interação, cai no createdAt do lead', () => {
    expect(getDaysSinceFromDate(lead({ createdAt: ago(10 * DAY_MS) }), null)).toBe(10);
    expect(getDaysSinceFromDate(lead({ createdAt: ago(10 * DAY_MS) }), undefined)).toBe(10);
  });

  it('interação que não é Date (string/Timestamp) é ignorada e cai no createdAt', () => {
    const l = lead({ createdAt: ago(5 * DAY_MS) });
    expect(getDaysSinceFromDate(l, '2026-07-14')).toBe(5);
    expect(getDaysSinceFromDate(l, { seconds: 1780000000 })).toBe(5);
  });

  it('retorna null sem nenhuma data utilizável', () => {
    expect(getDaysSinceFromDate(lead({ createdAt: undefined }), null)).toBeNull();
    expect(getDaysSinceFromDate(lead({ createdAt: 'não é Date' }), null)).toBeNull();
    expect(getDaysSinceFromDate(null, null)).toBeNull();
  });

  it('SURPRESA caracterizada: Invalid Date como interação BLOQUEIA o fallback pro createdAt', () => {
    // Invalid Date passa no instanceof (é truthy), então o `||` não cai no
    // createdAt; o isNaN em seguida devolve null — mesmo com createdAt válido.
    const l = lead({ createdAt: ago(10 * DAY_MS) });
    expect(getDaysSinceFromDate(l, new Date('data-invalida'))).toBeNull();
  });

  it('data no futuro clampa em 0 (Math.max)', () => {
    expect(getDaysSinceFromDate(lead(), ahead(2 * DAY_MS))).toBe(0);
    expect(getDaysSinceFromDate(lead({ createdAt: ahead(5 * DAY_MS) }), null)).toBe(0);
  });
});

describe('isHotLeadFromDate', () => {
  it('critério 1: lead criado nas últimas 6 horas (limite inclusivo)', () => {
    expect(isHotLeadFromDate(lead({ createdAt: ago(1 * HOUR_MS) }), null)).toBe(true);
    expect(isHotLeadFromDate(lead({ createdAt: ago(6 * HOUR_MS) }), null)).toBe(true); // exatamente 6h
    expect(isHotLeadFromDate(lead({ createdAt: ago(6 * HOUR_MS + 1) }), null)).toBe(false); // 6h + 1ms
  });

  it('critério 1 exige ageMs >= 0: createdAt no futuro NÃO deixa o lead quente', () => {
    expect(isHotLeadFromDate(lead({ createdAt: ahead(1 * HOUR_MS) }), null)).toBe(false);
  });

  it('critério 1 ignora createdAt que não é Date', () => {
    expect(isHotLeadFromDate(lead({ createdAt: { seconds: NOW.getTime() / 1000 } }), null)).toBe(false);
  });

  it('critério 2: interação nas últimas 24 horas (limite inclusivo)', () => {
    expect(isHotLeadFromDate(lead(), ago(23 * HOUR_MS))).toBe(true);
    expect(isHotLeadFromDate(lead(), ago(24 * HOUR_MS))).toBe(true); // exatamente 24h
    expect(isHotLeadFromDate(lead(), ago(24 * HOUR_MS + 1))).toBe(false); // 24h + 1ms
  });

  it('critério 2 exige sinceMs >= 0: interação com data futura não conta', () => {
    expect(isHotLeadFromDate(lead(), ahead(1 * HOUR_MS))).toBe(false);
  });

  it('critério 3: visita/aula agendada nas próximas 48 horas (limites inclusivos)', () => {
    const hot = lead({ appointmentType: 'visita', appointmentScheduledFor: ahead(24 * HOUR_MS) });
    expect(isHotLeadFromDate(hot, null)).toBe(true);

    const exact = lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: ahead(48 * HOUR_MS) });
    expect(isHotLeadFromDate(exact, null)).toBe(true); // exatamente 48h

    const tooFar = lead({ appointmentType: 'visita', appointmentScheduledFor: ahead(48 * HOUR_MS + 1) });
    expect(isHotLeadFromDate(tooFar, null)).toBe(false); // 48h + 1ms

    const past = lead({ appointmentType: 'visita', appointmentScheduledFor: ago(1 * HOUR_MS) });
    expect(isHotLeadFromDate(past, null)).toBe(false); // agendamento no passado não conta
  });

  it('critério 3 exige TIPO e DATA: data sem tipo não conta', () => {
    const noType = lead({ appointmentScheduledFor: ahead(2 * HOUR_MS) });
    expect(isHotLeadFromDate(noType, null)).toBe(false);
  });

  it('critério 3 aceita o formato legado nextFollowUpType + nextFollowUp', () => {
    // getLeadAppointmentType normaliza texto livre ("Visita" → 'visita') e
    // getLeadAppointmentDate cai no nextFollowUp quando há tipo.
    const legacy = lead({ nextFollowUpType: 'Visita', nextFollowUp: ahead(3 * HOUR_MS) });
    expect(isHotLeadFromDate(legacy, null)).toBe(true);
  });

  it('lead Venda/Perda nunca é quente, mesmo recém-criado', () => {
    expect(isHotLeadFromDate(lead({ status: 'Venda', createdAt: ago(1 * HOUR_MS) }), ago(1 * HOUR_MS))).toBe(false);
    expect(isHotLeadFromDate(lead({ status: 'Perda', createdAt: ago(1 * HOUR_MS) }), ago(1 * HOUR_MS))).toBe(false);
  });

  it('nenhum critério satisfeito → false', () => {
    expect(isHotLeadFromDate(lead(), ago(3 * DAY_MS))).toBe(false);
  });
});

describe('isColdLeadFromDate', () => {
  it('frio = ativo, não-quente, com 7+ dias sem interação (limite inclusivo)', () => {
    expect(isColdLeadFromDate(lead(), ago(7 * DAY_MS))).toBe(true); // exatamente 7 dias
    expect(isColdLeadFromDate(lead(), ago(10 * DAY_MS))).toBe(true);
    expect(isColdLeadFromDate(lead(), ago(6 * DAY_MS + 23 * HOUR_MS))).toBe(false); // 6d23h → 6 dias
  });

  it('sem interação, os dias contam a partir do createdAt', () => {
    expect(isColdLeadFromDate(lead({ createdAt: ago(8 * DAY_MS) }), null)).toBe(true);
    expect(isColdLeadFromDate(lead({ createdAt: ago(2 * DAY_MS) }), null)).toBe(false);
  });

  it('quente tem prioridade: agendamento próximo zera o frio mesmo com 10 dias parado', () => {
    const l = lead({ appointmentType: 'visita', appointmentScheduledFor: ahead(24 * HOUR_MS) });
    expect(isHotLeadFromDate(l, ago(10 * DAY_MS))).toBe(true);
    expect(isColdLeadFromDate(l, ago(10 * DAY_MS))).toBe(false);
  });

  it('lead Venda/Perda nunca é frio', () => {
    expect(isColdLeadFromDate(lead({ status: 'Venda', createdAt: ago(30 * DAY_MS) }), null)).toBe(false);
    expect(isColdLeadFromDate(lead({ status: 'Perda', createdAt: ago(30 * DAY_MS) }), null)).toBe(false);
  });

  it('sem nenhuma data (days null) não é frio', () => {
    expect(isColdLeadFromDate(lead({ createdAt: undefined }), null)).toBe(false);
  });
});
