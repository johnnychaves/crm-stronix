// Testes de CARACTERIZAÇÃO de src/lib/leads.js — congelam o comportamento
// ATUAL dos helpers puros de lead (conversão, meta diária, comparecimento,
// campos de segurança). Cada caso asserta o que o código FAZ hoje; onde o
// comportamento é surpreendente, o teste documenta em comentário em vez de
// "corrigir". Datas construídas em horário LOCAL, como o app faz.

import { describe, it, expect } from 'vitest';
import {
  isConvertedStatusName,
  isLeadConverted,
  isClientLead,
  findLeadByPhoneDigits,
  hasGoalDoneToday,
  isLeadResolvedToday,
  isRegistrationNote,
  hasActiveInteractionToday,
  isLeadAttended,
  getLeadAttendanceDate,
  getLeadOwnershipFields,
  getInteractionSecurityFields,
  getLeadConversionDate,
  getLeadConversionDateStrict
} from '../leads.js';

// 15 de julho de 2026 — dia de referência dos testes.
const TODAY_START = new Date(2026, 6, 15, 0, 0, 0, 0);
const TODAY_10H = new Date(2026, 6, 15, 10, 0);
const YESTERDAY_10H = new Date(2026, 6, 14, 10, 0);

// Timestamp "à la Firestore": objeto com toDate(), como chega cru do snapshot.
const ts = (date) => ({ toDate: () => date });

describe('isConvertedStatusName', () => {
  it("aceita o sentinel exato 'Venda' (case-sensitive)", () => {
    expect(isConvertedStatusName('Venda')).toBe(true);
    // 'venda' minúsculo NÃO é sentinel e não contém convertid/matricul.
    expect(isConvertedStatusName('venda')).toBe(false);
  });

  it("casa etapas customizadas por substring 'convertid'/'matricul', case-insensitive", () => {
    expect(isConvertedStatusName('Convertido')).toBe(true);
    expect(isConvertedStatusName('CONVERTIDA')).toBe(true);
    expect(isConvertedStatusName('Lead convertido em cliente')).toBe(true);
    expect(isConvertedStatusName('Matriculado')).toBe(true);
    expect(isConvertedStatusName('MATRICULADOS')).toBe(true);
  });

  it("NÃO casa 'Matrícula' acentuado — o í quebra a substring 'matricul' (comportamento atual)", () => {
    expect(isConvertedStatusName('Matrícula')).toBe(false);
    expect(isConvertedStatusName('Matrícula feita')).toBe(false);
  });

  it('retorna false para status comuns, vazio, null e undefined', () => {
    expect(isConvertedStatusName('Novo')).toBe(false);
    expect(isConvertedStatusName('Contato')).toBe(false);
    expect(isConvertedStatusName('')).toBe(false);
    expect(isConvertedStatusName(null)).toBe(false);
    expect(isConvertedStatusName(undefined)).toBe(false);
  });
});

describe('isLeadConverted', () => {
  it('true quando isConverted é true, mesmo com status não convertido', () => {
    expect(isLeadConverted({ id: 'l1', isConverted: true, status: 'Contato' })).toBe(true);
  });

  it('true quando o status é de matrícula (Venda ou variante)', () => {
    expect(isLeadConverted({ id: 'l1', status: 'Venda' })).toBe(true);
    expect(isLeadConverted({ id: 'l1', status: 'Matriculado' })).toBe(true);
  });

  it('false para lead em prospecção, null e undefined', () => {
    expect(isLeadConverted({ id: 'l1', status: 'Contato' })).toBe(false);
    expect(isLeadConverted(null)).toBe(false);
    expect(isLeadConverted(undefined)).toBe(false);
  });
});

describe('isClientLead', () => {
  it("true para cliente puro (lifecycleStage === 'cliente') mesmo sem status de venda", () => {
    expect(isClientLead({ id: 'l1', lifecycleStage: 'cliente', status: 'Contato' })).toBe(true);
  });

  it("true para lead 'Venda' legado sem lifecycleStage", () => {
    expect(isClientLead({ id: 'l1', status: 'Venda' })).toBe(true);
  });

  it('false para lead ativo em prospecção', () => {
    expect(isClientLead({ id: 'l1', status: 'Contato', lifecycleStage: undefined })).toBe(false);
  });

  it('false para null e undefined', () => {
    expect(isClientLead(null)).toBe(false);
    expect(isClientLead(undefined)).toBe(false);
  });
});

describe('findLeadByPhoneDigits', () => {
  const leads = [
    { id: 'l1', whatsapp: '(11) 98888-7777' },
    { id: 'l2', whatsapp: '21977776666' }
  ];

  it('acha lead comparando só os dígitos do whatsapp formatado', () => {
    expect(findLeadByPhoneDigits(leads, '11988887777')).toBe(leads[0]);
    expect(findLeadByPhoneDigits(leads, '21977776666')).toBe(leads[1]);
  });

  it('retorna undefined quando nenhum lead casa', () => {
    expect(findLeadByPhoneDigits(leads, '11900000000')).toBeUndefined();
  });

  it('é null-safe na lista', () => {
    expect(findLeadByPhoneDigits(null, '11988887777')).toBeUndefined();
    expect(findLeadByPhoneDigits(undefined, '11988887777')).toBeUndefined();
  });

  it("busca por '' casa o primeiro lead sem whatsapp — a guarda de tamanho mínimo fica no caller", () => {
    const comVazio = [{ id: 'l1', whatsapp: '(11) 98888-7777' }, { id: 'l2', whatsapp: null }];
    expect(findLeadByPhoneDigits(comVazio, '')).toBe(comVazio[1]);
  });
});

describe('hasGoalDoneToday', () => {
  const lead = { id: 'l1', status: 'Contato' };

  it('true com daily_goal_done de hoje via dailyGoalCategory', () => {
    const interactions = [
      { leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'atrasado', createdAt: TODAY_10H }
    ];
    expect(hasGoalDoneToday(lead, 'atrasado', interactions, TODAY_START)).toBe(true);
  });

  it('true via metadata.category (formato legado)', () => {
    const interactions = [
      { leadId: 'l1', type: 'daily_goal_done', metadata: { category: 'novo_24h' }, createdAt: TODAY_10H }
    ];
    expect(hasGoalDoneToday(lead, 'novo_24h', interactions, TODAY_START)).toBe(true);
  });

  it('false para categoria diferente, lead diferente ou tipo diferente', () => {
    const base = { leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'atrasado', createdAt: TODAY_10H };
    expect(hasGoalDoneToday(lead, 'visita_hoje', [base], TODAY_START)).toBe(false);
    expect(hasGoalDoneToday(lead, 'atrasado', [{ ...base, leadId: 'l2' }], TODAY_START)).toBe(false);
    expect(hasGoalDoneToday(lead, 'atrasado', [{ ...base, type: 'note' }], TODAY_START)).toBe(false);
  });

  it('false quando a interaction é de ontem', () => {
    const interactions = [
      { leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'atrasado', createdAt: YESTERDAY_10H }
    ];
    expect(hasGoalDoneToday(lead, 'atrasado', interactions, TODAY_START)).toBe(false);
  });

  it('exige createdAt Date real: Timestamp-like {toDate} NÃO conta (instanceof Date)', () => {
    const interactions = [
      { leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'atrasado', createdAt: ts(TODAY_10H) }
    ];
    expect(hasGoalDoneToday(lead, 'atrasado', interactions, TODAY_START)).toBe(false);
  });

  it('false quando falta lead, categoria, todayStart ou interactions', () => {
    const interactions = [
      { leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'atrasado', createdAt: TODAY_10H }
    ];
    expect(hasGoalDoneToday(null, 'atrasado', interactions, TODAY_START)).toBe(false);
    expect(hasGoalDoneToday(lead, null, interactions, TODAY_START)).toBe(false);
    expect(hasGoalDoneToday(lead, 'atrasado', interactions, null)).toBe(false);
    expect(hasGoalDoneToday(lead, 'atrasado', null, TODAY_START)).toBe(false);
  });
});

describe('isLeadResolvedToday', () => {
  it('true para Venda com convertedAt hoje (Date)', () => {
    expect(isLeadResolvedToday({ id: 'l1', status: 'Venda', convertedAt: TODAY_10H }, TODAY_START)).toBe(true);
  });

  it('true para Venda com convertedAt Timestamp-like {toDate()}', () => {
    expect(isLeadResolvedToday({ id: 'l1', status: 'Venda', convertedAt: ts(TODAY_10H) }, TODAY_START)).toBe(true);
  });

  it('true para Perda com lostAt hoje (Date e Timestamp-like)', () => {
    expect(isLeadResolvedToday({ id: 'l1', status: 'Perda', lostAt: TODAY_10H }, TODAY_START)).toBe(true);
    expect(isLeadResolvedToday({ id: 'l1', status: 'Perda', lostAt: ts(TODAY_10H) }, TODAY_START)).toBe(true);
  });

  it('false quando o carimbo é de ontem', () => {
    expect(isLeadResolvedToday({ id: 'l1', status: 'Venda', convertedAt: YESTERDAY_10H }, TODAY_START)).toBe(false);
    expect(isLeadResolvedToday({ id: 'l1', status: 'Perda', lostAt: YESTERDAY_10H }, TODAY_START)).toBe(false);
  });

  it('exige o PAR status+carimbo: convertedAt hoje sem status Venda não resolve', () => {
    expect(isLeadResolvedToday({ id: 'l1', status: 'Contato', convertedAt: TODAY_10H }, TODAY_START)).toBe(false);
    // status Venda sem carimbo também não.
    expect(isLeadResolvedToday({ id: 'l1', status: 'Venda' }, TODAY_START)).toBe(false);
  });

  it('false quando falta lead ou todayStart', () => {
    expect(isLeadResolvedToday(null, TODAY_START)).toBe(false);
    expect(isLeadResolvedToday({ id: 'l1', status: 'Venda', convertedAt: TODAY_10H }, null)).toBe(false);
  });
});

describe('isRegistrationNote', () => {
  it('true só quando o texto COMEÇA com o prefixo literal', () => {
    expect(isRegistrationNote('OBSERVAÇÃO DO CADASTRO: veio da bio do Instagram')).toBe(true);
    expect(isRegistrationNote('OBSERVAÇÃO DO CADASTRO:')).toBe(true);
  });

  it('false para prefixo no meio do texto, minúsculas ou texto comum', () => {
    expect(isRegistrationNote('Nota: OBSERVAÇÃO DO CADASTRO: x')).toBe(false);
    expect(isRegistrationNote('observação do cadastro: x')).toBe(false);
    expect(isRegistrationNote('Ligou pedindo horário')).toBe(false);
  });

  it('false para não-string', () => {
    expect(isRegistrationNote(null)).toBe(false);
    expect(isRegistrationNote(undefined)).toBe(false);
    expect(isRegistrationNote(123)).toBe(false);
  });
});

describe('hasActiveInteractionToday', () => {
  const lead = { id: 'l1', status: 'Contato' };

  it('true para nota comum criada hoje', () => {
    const interactions = [{ leadId: 'l1', type: 'note', text: 'Ligou', createdAt: TODAY_10H }];
    expect(hasActiveInteractionToday(lead, interactions, TODAY_START)).toBe(true);
  });

  it('exclui daily_goal_done e a observação automática do cadastro', () => {
    const interactions = [
      { leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'atrasado', createdAt: TODAY_10H },
      { leadId: 'l1', type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: veio do site', createdAt: TODAY_10H }
    ];
    expect(hasActiveInteractionToday(lead, interactions, TODAY_START)).toBe(false);
  });

  it('false para interaction de ontem ou de outro lead', () => {
    expect(hasActiveInteractionToday(lead, [{ leadId: 'l1', type: 'note', createdAt: YESTERDAY_10H }], TODAY_START)).toBe(false);
    expect(hasActiveInteractionToday(lead, [{ leadId: 'l2', type: 'note', createdAt: TODAY_10H }], TODAY_START)).toBe(false);
  });

  it('exige createdAt Date real: Timestamp-like {toDate} NÃO conta (instanceof Date)', () => {
    const interactions = [{ leadId: 'l1', type: 'note', text: 'Ligou', createdAt: ts(TODAY_10H) }];
    expect(hasActiveInteractionToday(lead, interactions, TODAY_START)).toBe(false);
  });

  it('false quando falta lead, todayStart ou interactions', () => {
    expect(hasActiveInteractionToday(null, [], TODAY_START)).toBe(false);
    expect(hasActiveInteractionToday(lead, [], null)).toBe(false);
    expect(hasActiveInteractionToday(lead, null, TODAY_START)).toBe(false);
  });
});

describe('isLeadAttended', () => {
  it("true com appointmentOutcome 'attended'", () => {
    expect(isLeadAttended({ id: 'l1', status: 'Contato', appointmentOutcome: 'attended' })).toBe(true);
  });

  it('true para lead convertido, mesmo sem outcome', () => {
    expect(isLeadAttended({ id: 'l1', status: 'Venda' })).toBe(true);
    expect(isLeadAttended({ id: 'l1', status: 'Contato', isConverted: true })).toBe(true);
  });

  it('true para hasAttended === true legado; truthy não estrito NÃO conta', () => {
    expect(isLeadAttended({ id: 'l1', status: 'Contato', hasAttended: true })).toBe(true);
    expect(isLeadAttended({ id: 'l1', status: 'Contato', hasAttended: 'sim' })).toBe(false);
  });

  it("false para outros outcomes, lead comum e null", () => {
    expect(isLeadAttended({ id: 'l1', status: 'Contato', appointmentOutcome: 'no_show' })).toBe(false);
    expect(isLeadAttended({ id: 'l1', status: 'Contato' })).toBe(false);
    expect(isLeadAttended(null)).toBe(false);
  });
});

describe('getLeadAttendanceDate', () => {
  const OUTCOME_AT = new Date(2026, 6, 12, 9, 0);
  const ATTENDED_AT = new Date(2026, 6, 11, 18, 0);
  const CONVERTED_AT = new Date(2026, 6, 10, 14, 0);
  const CREATED_AT = new Date(2026, 6, 1, 8, 0);

  it('prioriza appointmentOutcomeAt sobre attendedAt legado', () => {
    const d = getLeadAttendanceDate({ appointmentOutcomeAt: OUTCOME_AT, attendedAt: ATTENDED_AT });
    expect(d.getTime()).toBe(OUTCOME_AT.getTime());
  });

  it('usa attendedAt legado quando não há appointmentOutcomeAt', () => {
    const d = getLeadAttendanceDate({ attendedAt: ATTENDED_AT });
    expect(d.getTime()).toBe(ATTENDED_AT.getTime());
  });

  it('para convertido sem carimbo de presença, cai na data de conversão (com fallback createdAt)', () => {
    const comCarimbo = getLeadAttendanceDate({ status: 'Venda', convertedAt: CONVERTED_AT, createdAt: CREATED_AT });
    expect(comCarimbo.getTime()).toBe(CONVERTED_AT.getTime());
    const semCarimbo = getLeadAttendanceDate({ status: 'Venda', createdAt: CREATED_AT });
    expect(semCarimbo.getTime()).toBe(CREATED_AT.getTime());
  });

  it('null para lead não convertido e sem carimbos, e para null', () => {
    expect(getLeadAttendanceDate({ status: 'Contato', createdAt: CREATED_AT })).toBeNull();
    expect(getLeadAttendanceDate(null)).toBeNull();
  });
});

describe('getLeadOwnershipFields', () => {
  it('shape exato: consultantId/consultantName/consultantAuthUid do user', () => {
    const user = { id: 'u1', name: 'Ana', authUid: 'auth-1', role: 'consultor' };
    expect(getLeadOwnershipFields(user)).toEqual({
      consultantId: 'u1',
      consultantName: 'Ana',
      consultantAuthUid: 'auth-1'
    });
  });

  it('user null/parcial vira nulls (nunca undefined)', () => {
    expect(getLeadOwnershipFields(null)).toEqual({
      consultantId: null,
      consultantName: null,
      consultantAuthUid: null
    });
    expect(getLeadOwnershipFields({ id: 'u1' })).toEqual({
      consultantId: 'u1',
      consultantName: null,
      consultantAuthUid: null
    });
  });
});

describe('getInteractionSecurityFields', () => {
  const user = { id: 'u9', name: 'Ana', authUid: 'auth-9' };

  it('shape exato: só leadConsultantId/leadConsultantAuthUid — consultantAuthUid NÃO é gravado na interação', () => {
    const lead = { id: 'l1', consultantId: 'u1', consultantAuthUid: 'auth-1' };
    expect(getInteractionSecurityFields(lead, user)).toEqual({
      leadConsultantId: 'u1',
      leadConsultantAuthUid: 'auth-1'
    });
  });

  it('cai no user campo a campo quando o lead não tem dono', () => {
    expect(getInteractionSecurityFields({ id: 'l1' }, user)).toEqual({
      leadConsultantId: 'u9',
      leadConsultantAuthUid: 'auth-9'
    });
    // fallback é independente por campo: lead com id mas sem authUid mistura.
    expect(getInteractionSecurityFields({ id: 'l1', consultantId: 'u1' }, user)).toEqual({
      leadConsultantId: 'u1',
      leadConsultantAuthUid: 'auth-9'
    });
  });

  it('sem lead e sem user, tudo null', () => {
    expect(getInteractionSecurityFields(null, null)).toEqual({
      leadConsultantId: null,
      leadConsultantAuthUid: null
    });
  });
});

describe('getLeadConversionDate vs getLeadConversionDateStrict', () => {
  const CONVERTED_AT = new Date(2026, 6, 10, 14, 0);
  const CREATED_AT = new Date(2026, 6, 1, 8, 0);

  it('ambas retornam convertedAt quando presente (Date ou Timestamp-like)', () => {
    const lead = { convertedAt: CONVERTED_AT, createdAt: CREATED_AT };
    expect(getLeadConversionDate(lead).getTime()).toBe(CONVERTED_AT.getTime());
    expect(getLeadConversionDateStrict(lead).getTime()).toBe(CONVERTED_AT.getTime());
    const comTs = { convertedAt: ts(CONVERTED_AT), createdAt: CREATED_AT };
    expect(getLeadConversionDate(comTs).getTime()).toBe(CONVERTED_AT.getTime());
    expect(getLeadConversionDateStrict(comTs).getTime()).toBe(CONVERTED_AT.getTime());
  });

  it('sem convertedAt: a padrão cai no createdAt, a strict retorna null', () => {
    const lead = { createdAt: CREATED_AT };
    expect(getLeadConversionDate(lead).getTime()).toBe(CREATED_AT.getTime());
    expect(getLeadConversionDateStrict(lead)).toBeNull();
  });

  it('sem nenhuma data (ou lead null), ambas retornam null', () => {
    expect(getLeadConversionDate({})).toBeNull();
    expect(getLeadConversionDate(null)).toBeNull();
    expect(getLeadConversionDateStrict(null)).toBeNull();
  });
});
