// src/lib/__tests__/visitante.test.js
import { describe, it, expect } from 'vitest';
import { classifyInteraction } from '../timeline.js';
import {
  normalizeFreepassTypes, freepassTypeProblem, saveFreepassType, freepassQuantityText
} from '../visitante.js';

const tipo = (over = {}) => ({ id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: false, ativo: true, ...over });

describe('normalizeFreepassTypes', () => {
  it('devolve lista vazia para o que não é lista', () => {
    expect(normalizeFreepassTypes(undefined)).toEqual([]);
    expect(normalizeFreepassTypes({})).toEqual([]);
  });
  it('descarta tipo sem id, nome, modalidade, tipo de contagem ou quantidade válida', () => {
    const out = normalizeFreepassTypes([
      tipo(), tipo({ id: '' }), tipo({ id: 'x', name: '  ' }), tipo({ id: 'y', modalidadeId: '' }),
      tipo({ id: 'z', kind: 'semanas' }), tipo({ id: 'w', quantity: 0 }), tipo({ id: 'v', quantity: 100 })
    ]);
    expect(out.map(t => t.id)).toEqual(['t1']);
  });
  it('apara o nome, arredonda a quantidade e lê ativo ausente como ativo', () => {
    const [t] = normalizeFreepassTypes([{ id: 'a', name: ' Muscu 7 ', modalidadeId: 'm', kind: 'dias', quantity: '7.9' }]);
    expect(t).toEqual({ id: 'a', name: 'Muscu 7', modalidadeId: 'm', kind: 'dias', quantity: 7, padrao: false, ativo: true });
  });
  it('deixa um padrão só por modalidade, o primeiro ativo', () => {
    const out = normalizeFreepassTypes([
      tipo({ id: 'a', padrao: true, ativo: false }), tipo({ id: 'b', padrao: true }), tipo({ id: 'c', padrao: true }),
      tipo({ id: 'd', modalidadeId: 'm2', padrao: true })
    ]);
    expect(out.filter(t => t.padrao).map(t => t.id)).toEqual(['b', 'd']);
  });
});

describe('freepassTypeProblem', () => {
  const types = [tipo()];
  it('aceita um tipo completo', () => {
    expect(freepassTypeProblem(tipo({ id: 't2', name: 'Pilates 1 aula', quantity: 1 }), types)).toBeNull();
  });
  it('pede nome, modalidade, contagem e quantidade, nessa ordem', () => {
    expect(freepassTypeProblem(tipo({ id: 'n', name: '' }), types).field).toBe('name');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', modalidadeId: '' }), types).field).toBe('modalidadeId');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', kind: '' }), types).field).toBe('kind');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', quantity: 0 }), types).field).toBe('quantity');
  });
  it('recusa nome repetido sem contar maiúscula, mas aceita o próprio tipo', () => {
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'pilates 2 AULAS' }), types).message).toBe('Já existe um freepass com esse nome.');
    expect(freepassTypeProblem(tipo(), types)).toBeNull();
  });
});

describe('saveFreepassType', () => {
  it('acrescenta o tipo novo e troca o que já existe', () => {
    const a = saveFreepassType([tipo()], tipo({ id: 't2', name: 'Outro' }));
    expect(a.map(t => t.id)).toEqual(['t1', 't2']);
    const b = saveFreepassType(a, tipo({ name: 'Pilates 3 aulas', quantity: 3 }));
    expect(b[0].quantity).toBe(3);
    expect(b).toHaveLength(2);
  });
  it('o padrão novo tira o padrão dos outros da mesma modalidade', () => {
    const lista = [tipo({ padrao: true }), tipo({ id: 'm2', modalidadeId: 'm2', padrao: true })];
    const out = saveFreepassType(lista, tipo({ id: 't9', name: 'Novo', padrao: true }));
    expect(out.find(t => t.id === 't1').padrao).toBe(false);
    expect(out.find(t => t.id === 'm2').padrao).toBe(true);
    expect(out.find(t => t.id === 't9').padrao).toBe(true);
  });
});

describe('freepassQuantityText', () => {
  it('escreve no singular e no plural', () => {
    expect(freepassQuantityText({ kind: 'dias', quantity: 1 })).toBe('1 dia');
    expect(freepassQuantityText({ kind: 'dias', quantity: 7 })).toBe('7 dias');
    expect(freepassQuantityText({ kind: 'aulas', quantity: 1 })).toBe('1 aula');
    expect(freepassQuantityText({ kind: 'aulas', quantity: 2 })).toBe('2 aulas');
  });
});

import {
  isFreepassRunning, activeFreepassesOf, freepassSummaryPatch, visitorOf,
  freepassShortText, freepassLongText, FREEPASS_SUMMARY_EMPTY
} from '../visitante.js';

const dia = (s) => new Date(`${s}T12:00:00`);
const fpDias = (over = {}) => ({
  id: 'f1', kind: 'dias', total: 7, typeName: 'Muscu 7 dias', modalidadeName: 'Musculação',
  startsAt: dia('2026-11-20'), endsAt: dia('2026-11-26'), aulas: 0, status: 'correndo', contractAtStart: null, ...over
});
const fpAulas = (over = {}) => ({
  id: 'f2', kind: 'aulas', total: 2, typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates',
  startsAt: dia('2026-11-20'), endsAt: null, aulas: 1, status: 'correndo', contractAtStart: null, ...over
});

describe('isFreepassRunning', () => {
  it('por dias, vale até o fim do último dia', () => {
    expect(isFreepassRunning(fpDias(), new Date('2026-11-26T23:59:00'))).toBe(true);
    expect(isFreepassRunning(fpDias(), new Date('2026-11-27T00:01:00'))).toBe(false);
  });
  it('por aulas sem fim marcado continua correndo', () => {
    expect(isFreepassRunning(fpAulas(), dia('2027-03-01'))).toBe(true);
  });
  it('por dias sem fim válido não corre', () => {
    expect(isFreepassRunning(fpDias({ endsAt: null }), dia('2026-11-21'))).toBe(false);
    expect(isFreepassRunning(fpDias({ endsAt: 'lixo' }), dia('2026-11-21'))).toBe(false);
  });
  it('encerrado à mão não corre', () => {
    expect(isFreepassRunning(fpDias({ status: 'encerrado' }), dia('2026-11-21'))).toBe(false);
  });
});

describe('activeFreepassesOf', () => {
  const lead = { status: 'Novo', currentContractId: null };
  it('deixa de fora o lead em Perda', () => {
    expect(activeFreepassesOf({ ...lead, status: 'Perda' }, [fpDias()], dia('2026-11-21'))).toEqual([]);
  });
  it('deixa de fora o freepass de antes de um contrato novo', () => {
    expect(activeFreepassesOf({ ...lead, currentContractId: 'c9' }, [fpDias()], dia('2026-11-21'))).toEqual([]);
  });
  it('o ex-aluno continua Visitante enquanto o contrato atual é o do lançamento', () => {
    const ex = { status: 'Venda', currentContractId: 'c1' };
    expect(activeFreepassesOf(ex, [fpDias({ contractAtStart: 'c1' })], dia('2026-11-21'))).toHaveLength(1);
  });
  it('lê campo ausente como null', () => {
    expect(activeFreepassesOf({ status: 'Novo' }, [fpDias({ contractAtStart: undefined })], dia('2026-11-21'))).toHaveLength(1);
  });
});

describe('freepassSummaryPatch', () => {
  it('sem freepass correndo, limpa o resumo inteiro', () => {
    expect(freepassSummaryPatch([], dia('2026-11-21'))).toEqual(FREEPASS_SUMMARY_EMPTY);
  });
  it('com dois correndo, fica o que termina primeiro, e o por aulas sem fim vai por último', () => {
    const p = freepassSummaryPatch([fpAulas(), fpDias()], dia('2026-11-21'));
    expect(p.freepassId).toBe('f1');
    expect(p.freepassKind).toBe('dias');
    expect(p.freepassTotal).toBe(7);
    expect(p.freepassContractAtStart).toBeNull();
  });
});

describe('visitorOf', () => {
  const now = dia('2026-11-23');
  const lead = { status: 'Novo', currentContractId: null, ...freepassSummaryPatch([fpDias()], now) };
  it('lê o resumo do lead', () => {
    const v = visitorOf(lead, now);
    expect(v.id).toBe('f1');
    expect(v.shortText).toBe('faltam 3 dias');
  });
  it('some sem resumo, na Perda, com contrato novo e depois do fim', () => {
    expect(visitorOf({ status: 'Novo' }, now)).toBeNull();
    expect(visitorOf({ ...lead, status: 'Perda' }, now)).toBeNull();
    expect(visitorOf({ ...lead, currentContractId: 'c1' }, now)).toBeNull();
    expect(visitorOf(lead, dia('2026-11-27'))).toBeNull();
  });
});

describe('textos do andamento', () => {
  it('por dias', () => {
    expect(freepassShortText(fpDias(), dia('2026-11-26'))).toBe('termina hoje');
    expect(freepassShortText(fpDias(), dia('2026-11-25'))).toBe('falta 1 dia');
    expect(freepassLongText(fpDias(), dia('2026-11-23'))).toBe('Faltam 3 dias, até 26/11');
    expect(freepassLongText(fpDias(), dia('2026-11-26'))).toBe('Termina hoje, 26/11');
  });
  it('por dias, antes de começar', () => {
    expect(freepassShortText(fpDias(), dia('2026-11-18'))).toBe('começa em 20/11');
    expect(freepassLongText(fpDias(), dia('2026-11-18'))).toBe('Começa em 20/11 e vai até 26/11');
  });
  it('por dias sem fim válido, texto vazio', () => {
    expect(freepassShortText(fpDias({ endsAt: null }), dia('2026-11-23'))).toBe('');
    expect(freepassLongText(fpDias({ endsAt: 'lixo' }), dia('2026-11-23'))).toBe('');
  });
  it('por aulas', () => {
    expect(freepassShortText(fpAulas(), dia('2026-11-23'))).toBe('1 de 2 aulas');
    expect(freepassLongText(fpAulas({ aulas: 0 }), dia('2026-11-23'))).toBe('0 de 2 aulas agendadas');
  });
});

import {
  launchCheck, buildFreepassDoc, freepassLaunchText, freepassEndText, launchStartRange, FREEPASS_INTERACTION_TYPE
} from '../visitante.js';

describe('launchCheck', () => {
  const tipoP = { id: 't1', modalidadeId: 'm1' };
  const ja = [{ modalidadeId: 'm1', status: 'encerrado' }];
  it('libera a primeira vez na modalidade', () => {
    expect(launchCheck({ type: tipoP, freepasses: [{ modalidadeId: 'm2' }], modalidadeName: 'Pilates', gestor: false })).toBeNull();
  });
  it('barra o consultor na mesma modalidade, mesmo com o outro encerrado', () => {
    expect(launchCheck({ type: tipoP, freepasses: ja, modalidadeName: 'Pilates', gestor: false }))
      .toEqual({ block: 'Essa pessoa já teve um freepass de Pilates. Só o gestor libera outro.' });
  });
  it('pede confirmação ao gestor', () => {
    expect(launchCheck({ type: tipoP, freepasses: ja, modalidadeName: 'Pilates', gestor: true }))
      .toEqual({ confirm: 'Essa pessoa já teve um freepass de Pilates. Lançar outro mesmo assim?' });
  });
});

describe('launchStartRange', () => {
  it('vai de 7 dias atrás a 30 dias à frente', () => {
    const { min, max } = launchStartRange(dia('2026-11-26'));
    expect(min.getDate()).toBe(19);
    expect(max.getMonth()).toBe(11);
    expect(max.getDate()).toBe(26);
  });
});

describe('buildFreepassDoc', () => {
  const lead = { id: 'L1', consultantId: 'u1', consultantName: 'Ana', currentContractId: undefined };
  const user = { id: 'u2', name: 'Bruno', authUid: 'a2' };
  it('por dias grava o último dia, início + (N-1)', () => {
    const d = buildFreepassDoc({
      lead, appUser: user, via: 'contratos', modalidadeName: 'Musculação', startsAt: dia('2026-11-20'),
      type: { id: 't', name: 'Muscu 7 dias', modalidadeId: 'm', kind: 'dias', quantity: 7 }
    });
    expect(d.startsAt.getDate()).toBe(20);
    expect(d.startsAt.getHours()).toBe(0);
    expect(d.endsAt.getDate()).toBe(26);
    expect(d).toMatchObject({
      leadId: 'L1', typeId: 't', typeName: 'Muscu 7 dias', modalidadeId: 'm', modalidadeName: 'Musculação',
      kind: 'dias', total: 7, aulas: 0, status: 'correndo', contractAtStart: null,
      consultantId: 'u1', consultantName: 'Ana', createdById: 'u2', createdByName: 'Bruno', createdByAuthUid: 'a2', via: 'contratos'
    });
  });
  it('por aulas nasce sem fim', () => {
    const d = buildFreepassDoc({
      lead, appUser: user, via: 'contratos', modalidadeName: 'Pilates', startsAt: dia('2026-11-20'),
      type: { id: 't', name: 'Pilates 2 aulas', modalidadeId: 'm', kind: 'aulas', quantity: 2 }
    });
    expect(d.endsAt).toBeNull();
  });
});

describe('textos da linha do tempo', () => {
  it('lançamento e encerramento', () => {
    expect(freepassLaunchText({ typeName: 'Muscu 7 dias', modalidadeName: 'Musculação', kind: 'dias', total: 7, startsAt: dia('2026-11-20'), endsAt: dia('2026-11-26') }))
      .toBe('Freepass lançado: Muscu 7 dias (Musculação), de 20/11 a 26/11.');
    expect(freepassLaunchText({ typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', kind: 'aulas', total: 2 }))
      .toBe('Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas para agendar.');
    expect(freepassEndText({ typeName: 'Pilates 2 aulas' })).toBe('Freepass encerrado: Pilates 2 aulas.');
    expect(FREEPASS_INTERACTION_TYPE).toBe('freepass');
  });
});

describe('linha do tempo', () => {
  it('o freepass cai em Agendamentos', () => {
    expect(classifyInteraction({ type: 'freepass', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas para agendar.' })).toBe('appointment');
  });
});
