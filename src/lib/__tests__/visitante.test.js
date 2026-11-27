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
    // Pelo Agendar, as aulas já nascem marcadas.
    expect(freepassLaunchText({ typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', kind: 'aulas', total: 2, aulas: 2 }))
      .toBe('Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas marcadas.');
    expect(freepassLaunchText({ typeName: 'Pilates 1 aula', modalidadeName: 'Pilates', kind: 'aulas', total: 1, aulas: 1 }))
      .toBe('Freepass lançado: Pilates 1 aula (Pilates), 1 aula marcada.');
    // Pelo Stronizap, nasce só a aula pedida.
    expect(freepassLaunchText({ typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', kind: 'aulas', total: 2, aulas: 1 }))
      .toBe('Freepass lançado: Pilates 2 aulas (Pilates), 1 aula marcada, 1 para agendar.');
    expect(freepassLaunchText({ typeName: 'Pilates 3 aulas', modalidadeName: 'Pilates', kind: 'aulas', total: 3, aulas: 2 }))
      .toBe('Freepass lançado: Pilates 3 aulas (Pilates), 2 aulas marcadas, 1 para agendar.');
    expect(freepassEndText({ typeName: 'Pilates 2 aulas' })).toBe('Freepass encerrado: Pilates 2 aulas.');
    expect(FREEPASS_INTERACTION_TYPE).toBe('freepass');
  });
});

describe('linha do tempo', () => {
  it('o freepass cai em Agendamentos', () => {
    expect(classifyInteraction({ type: 'freepass', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas para agendar.' })).toBe('appointment');
  });
});

describe('chip a partir dos docs', () => {
  it('com um por dias já terminado e um por aulas correndo, o chip é o das aulas', () => {
    const now = new Date('2026-11-26T10:00:00');
    const lead = { id: 'L', status: 'Novo', currentContractId: null };
    const docs = [
      { id: 'a', kind: 'dias', total: 3, typeName: 'Muscu 3 dias', status: 'correndo', startsAt: new Date('2026-11-01T00:00:00'), endsAt: new Date('2026-11-03T00:00:00'), contractAtStart: null },
      { id: 'b', kind: 'aulas', total: 2, aulas: 1, typeName: 'Pilates 2 aulas', status: 'correndo', startsAt: new Date('2026-11-20T00:00:00'), endsAt: null, contractAtStart: null }
    ];
    const v = visitorOf({ ...lead, ...freepassSummaryPatch(activeFreepassesOf(lead, docs, now), now) }, now);
    expect(v.id).toBe('b');
  });
});

import {
  freepassChoiceFor, autoFreepassFor, freepassChoiceText, freepassAulasPatch,
  currentAulaToAdvance, freepassTagOf, nextFreepassAula
} from '../visitante.js';

describe('freepassChoiceFor', () => {
  const now = dia('2026-11-23');
  const lead = { status: 'Novo', currentContractId: null };
  const tp = (over = {}) => tipo({ id: 'x', modalidadeId: 'm1', ...over });
  const base = { lead, freepasses: [], types: [tp({ padrao: true })], modalidadeId: 'm1', modalidadeName: 'Pilates', canLaunch: true, now };
  const fpM = (over = {}) => fpAulas({ modalidadeId: 'm1', ...over });

  it('usa o freepass que corre na modalidade, com as aulas que sobram', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [fpM()] });
    expect(c).toMatchObject({ kind: 'use', aulasLeft: 1 });
    expect(c.freepass.id).toBe('f2');
  });
  it('por dias, aulasLeft é null', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [fpDias({ modalidadeId: 'm1' })] });
    expect(c).toMatchObject({ kind: 'use', aulasLeft: null });
  });
  it('freepass por aulas cheio vira avulsa full', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [fpM({ aulas: 2 })] });
    expect(c).toMatchObject({ kind: 'avulsa', reason: 'full' });
    expect(c.freepass.id).toBe('f2');
  });
  it('ignora o freepass de outra modalidade', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [fpM({ modalidadeId: 'm9' })] });
    expect(c.kind).toBe('launch');
  });
  it('já teve e nenhum corre: avulsa repeated com a data do início', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [fpM({ status: 'encerrado', startsAt: dia('2026-11-10') })] });
    expect(c).toMatchObject({ kind: 'avulsa', reason: 'repeated' });
    expect(c.since.getDate()).toBe(10);
  });
  it('repeated usa o mais recente', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [
      fpM({ id: 'a', status: 'encerrado', startsAt: dia('2026-10-01') }),
      fpM({ id: 'b', status: 'encerrado', startsAt: dia('2026-11-10') })
    ] });
    expect(c.since.getMonth()).toBe(10);
  });
  it('sem tipo ativo na modalidade: noType', () => {
    expect(freepassChoiceFor({ ...base, types: [tp({ ativo: false }), tp({ modalidadeId: 'm2' })] }))
      .toEqual({ kind: 'avulsa', reason: 'noType' });
  });
  it('sem permissão de lançar: noLaunch', () => {
    expect(freepassChoiceFor({ ...base, canLaunch: false })).toEqual({ kind: 'avulsa', reason: 'noLaunch' });
  });
  it('nunca teve: launch com o padrão primeiro e o inativo de fora', () => {
    const types = [tp({ id: 'a' }), tp({ id: 'b', padrao: true }), tp({ id: 'c', ativo: false }), tp({ id: 'd' })];
    const c = freepassChoiceFor({ ...base, types });
    expect(c.kind).toBe('launch');
    expect(c.types.map(t => t.id)).toEqual(['b', 'a', 'd']);
  });
  it('noType vem antes de noLaunch', () => {
    expect(freepassChoiceFor({ ...base, types: [], canLaunch: false }).reason).toBe('noType');
  });
});

describe('autoFreepassFor', () => {
  const now = dia('2026-11-23');
  const base = { lead: { status: 'Novo' }, freepasses: [], modalidadeId: 'm1', modalidadeName: 'Pilates', canLaunch: true, now };
  it('lança o tipo padrão', () => {
    const c = autoFreepassFor({ ...base, types: [tipo({ id: 'a' }), tipo({ id: 'b', padrao: true })] });
    expect(c.kind).toBe('launch');
    expect(c.type.id).toBe('b');
  });
  it('sem padrão, noType', () => {
    expect(autoFreepassFor({ ...base, types: [tipo()] })).toEqual({ kind: 'avulsa', reason: 'noType' });
  });
  it('mantém as outras escolhas', () => {
    expect(autoFreepassFor({ ...base, types: [tipo({ padrao: true })], canLaunch: false }).reason).toBe('noLaunch');
  });
});

describe('freepassChoiceText', () => {
  const fp = { typeName: 'Pilates 2 aulas', kind: 'aulas', total: 2, aulas: 1 };
  it('use por aulas e por dias', () => {
    expect(freepassChoiceText({ kind: 'use', freepass: fp }, 'Pilates')).toBe('Entra no freepass Pilates 2 aulas (2 de 2)');
    expect(freepassChoiceText({ kind: 'use', freepass: { typeName: 'Muscu 7', kind: 'dias' } }, 'Musculação')).toBe('Entra no freepass Muscu 7');
  });
  it('launch com type ou com types', () => {
    expect(freepassChoiceText({ kind: 'launch', type: { name: 'Pilates 2 aulas' } }, 'Pilates')).toBe('Nasce o freepass Pilates 2 aulas');
    expect(freepassChoiceText({ kind: 'launch', types: [{ name: 'A' }, { name: 'B' }] }, 'Pilates')).toBe('Nasce o freepass A');
  });
  it('avulsas', () => {
    expect(freepassChoiceText({ kind: 'avulsa', reason: 'repeated', since: dia('2026-11-10') }, 'Pilates'))
      .toBe('Aula avulsa: já teve freepass de Pilates em 10/11');
    expect(freepassChoiceText({ kind: 'avulsa', reason: 'full', freepass: { total: 2 } }, 'Pilates'))
      .toBe('Aula avulsa: o freepass já tem as 2 aulas');
    expect(freepassChoiceText({ kind: 'avulsa', reason: 'full', freepass: { total: 1 } }, 'Pilates'))
      .toBe('Aula avulsa: o freepass já tem a 1 aula');
    expect(freepassChoiceText({ kind: 'avulsa', reason: 'noType' }, 'Pilates')).toBe('Aula avulsa: Pilates não tem freepass cadastrado');
    expect(freepassChoiceText({ kind: 'avulsa', reason: 'noLaunch' }, 'Pilates')).toBe('Aula avulsa: só o consultor lança freepass');
  });
});

describe('freepassAulasPatch', () => {
  const fp = { id: 'f', kind: 'aulas', total: 2, endsAt: null };
  const r = (over = {}) => ({ freepassId: 'f', status: 'agendada', scheduledFor: new Date('2026-11-25T18:30:00'), ...over });
  it('ignora cancelados e de outro freepass, e não marca fim sem completar', () => {
    const p = freepassAulasPatch({ freepass: fp, records: [r(), r({ status: 'cancelled' }), r({ freepassId: 'g' })] });
    expect(p).toEqual({ aulas: 1, endsAt: null });
  });
  it('completo: o fim é o começo do dia da última aula', () => {
    const p = freepassAulasPatch({ freepass: fp, records: [r(), r({ scheduledFor: new Date('2026-11-28T09:00:00') })] });
    expect(p.aulas).toBe(2);
    expect(p.endsAt.getDate()).toBe(28);
    expect(p.endsAt.getHours()).toBe(0);
  });
  it('por dias devolve o fim como está', () => {
    const endsAt = dia('2026-11-26');
    expect(freepassAulasPatch({ freepass: fpDias({ endsAt }), records: [r({ freepassId: 'f1' })] })).toEqual({ aulas: 1, endsAt });
  });
});

describe('currentAulaToAdvance', () => {
  const now = new Date('2026-11-26T10:00:00');
  const rec = (id, h, over = {}) => ({ id, freepassId: 'f', status: 'agendada', scheduledFor: new Date(`2026-11-26T${h}:00:00`), ...over });
  const ontem = new Date('2026-11-25T18:00:00');
  it('lead com aula de ontem: anda para a aula de hoje', () => {
    const lead = { currentAulaId: 'old', appointmentScheduledFor: ontem };
    expect(currentAulaToAdvance({ lead, records: [rec('a', '18')], now }).id).toBe('a');
  });
  it('lead sem agendamento anda', () => {
    expect(currentAulaToAdvance({ lead: {}, records: [rec('a', '18')], now }).id).toBe('a');
  });
  it('desfecho hoje: anda para a de hoje que não é a atual, a mais cedo', () => {
    const lead = { currentAulaId: 'a', appointmentScheduledFor: new Date('2026-11-26T08:00:00'), appointmentOutcome: 'attended' };
    expect(currentAulaToAdvance({ lead, records: [rec('a', '08'), rec('c', '19'), rec('b', '14')], now }).id).toBe('b');
  });
  it('já na aula de hoje: null', () => {
    const lead = { currentAulaId: 'a', appointmentScheduledFor: ontem };
    expect(currentAulaToAdvance({ lead, records: [rec('a', '18')], now })).toBeNull();
  });
  it('aula de hoje ainda sem desfecho: não mexe', () => {
    const lead = { currentAulaId: 'x', appointmentScheduledFor: new Date('2026-11-26T15:00:00') };
    expect(currentAulaToAdvance({ lead, records: [rec('a', '18')], now })).toBeNull();
  });
  it('sem aula de freepass hoje, cancelada ou sem freepassId: null', () => {
    const lead = { appointmentScheduledFor: ontem };
    expect(currentAulaToAdvance({ lead, records: [], now })).toBeNull();
    expect(currentAulaToAdvance({ lead, records: [rec('a', '18', { status: 'cancelled' }), rec('b', '18', { freepassId: undefined })], now })).toBeNull();
  });
  it('lê scheduledFor como Timestamp do Firestore', () => {
    const ts = { toDate: () => new Date('2026-11-26T18:00:00') };
    expect(currentAulaToAdvance({ lead: {}, records: [rec('a', '18', { scheduledFor: ts })], now }).id).toBe('a');
  });
});

describe('aula movida pelo Agendar', () => {
  const now = dia('2026-11-23');
  const lead = { status: 'Novo', currentContractId: null };
  const base = { lead, freepasses: [], types: [], modalidadeId: 'm1', modalidadeName: 'Pilates', canLaunch: true, now };
  const cheio = fpAulas({ modalidadeId: 'm1', aulas: 2 });
  it('moving na mesma modalidade com o freepass cheio vira use', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [cheio], movingFreepassId: 'f2' });
    expect(c).toMatchObject({ kind: 'use', aulasLeft: 1, moving: true });
    expect(freepassChoiceFor({ ...base, freepasses: [cheio] })).toMatchObject({ reason: 'full' });
  });
  it('por dias, aulasLeft é null', () => {
    const c = freepassChoiceFor({ ...base, freepasses: [fpDias({ modalidadeId: 'm1' })], movingFreepassId: 'f1' });
    expect(c).toMatchObject({ kind: 'use', aulasLeft: null, moving: true });
  });
  it('moving de outra modalidade ou de freepass que não corre é ignorado', () => {
    expect(freepassChoiceFor({ ...base, modalidadeId: 'm9', freepasses: [cheio], movingFreepassId: 'f2' }).reason).toBe('noType');
    const enc = fpAulas({ modalidadeId: 'm1', status: 'encerrado' });
    expect(freepassChoiceFor({ ...base, freepasses: [enc], movingFreepassId: 'f2' }).reason).toBe('repeated');
  });
  it('autoFreepassFor repassa o moving', () => {
    expect(autoFreepassFor({ ...base, freepasses: [cheio], movingFreepassId: 'f2' }).moving).toBe(true);
  });
  it('texto do moving', () => {
    expect(freepassChoiceText({ kind: 'use', moving: true, freepass: { typeName: 'Pilates 2 aulas', kind: 'aulas', total: 2, aulas: 2 } }, 'Pilates'))
      .toBe('Continua no freepass Pilates 2 aulas');
  });
});

describe('nextFreepassAula', () => {
  const now = new Date('2026-11-26T10:00:00');
  const rec = (id, d, over = {}) => ({ id, freepassId: 'f', status: 'agendada', scheduledFor: new Date(`${d}T18:00:00`), ...over });
  it('escolhe a mais cedo de hoje em diante, ignorando passado, cancelado e outro freepass', () => {
    const records = [
      rec('velha', '2026-11-20'), rec('canc', '2026-11-26', { status: 'cancelled' }),
      rec('outro', '2026-11-26', { freepassId: 'g' }), rec('b', '2026-11-30'), rec('a', '2026-11-26')
    ];
    expect(nextFreepassAula({ records, freepassId: 'f', now }).id).toBe('a');
  });
  it('null sem aula futura', () => {
    expect(nextFreepassAula({ records: [rec('velha', '2026-11-20')], freepassId: 'f', now })).toBeNull();
  });
});

describe('freepassTagOf', () => {
  const now = dia('2026-11-23');
  const lead = { status: 'Novo', currentContractId: null, ...freepassSummaryPatch([fpDias()], now) };
  it('lead e ex-aluno sem contrato ativo são Visitante', () => {
    expect(freepassTagOf({ lead, contractActive: false, now })).toEqual({ label: 'Visitante', text: 'faltam 3 dias' });
  });
  it('aluno ativo é Upgrade, com a modalidade', () => {
    expect(freepassTagOf({ lead, contractActive: true, now })).toEqual({ label: 'Upgrade', text: 'Musculação, faltam 3 dias' });
  });
  it('sem freepass, null', () => {
    expect(freepassTagOf({ lead: { status: 'Novo' }, contractActive: true, now })).toBeNull();
  });
});

import { freepassAulaDaVez, freepassPickMatches } from '../visitante.js';

describe('freepassPickMatches', () => {
  const use = { kind: 'use', freepass: { id: 'f1' }, aulasLeft: 1 };
  const launch = { kind: 'launch', types: [{ id: 't1' }, { id: 't2' }] };
  it('a escolha feita ainda vale', () => {
    expect(freepassPickMatches({ kind: 'use', freepassId: 'f1' }, use)).toBe(true);
    expect(freepassPickMatches({ kind: 'launch', typeId: 't2' }, launch)).toBe(true);
  });
  it('a aula avulsa vale em qualquer situação', () => {
    for (const c of [use, launch, { kind: 'avulsa', reason: 'repeated' }]) expect(freepassPickMatches({ kind: 'avulsa' }, c)).toBe(true);
  });
  it('a situação mudou: outro freepass, freepass cheio ou encerrado, tipo que saiu, lançado em outra aba', () => {
    expect(freepassPickMatches({ kind: 'use', freepassId: 'f1' }, { ...use, freepass: { id: 'f9' } })).toBe(false);
    expect(freepassPickMatches({ kind: 'use', freepassId: 'f1' }, { kind: 'avulsa', reason: 'full', freepass: { id: 'f1' } })).toBe(false);
    expect(freepassPickMatches({ kind: 'launch', typeId: 't3' }, launch)).toBe(false);
    expect(freepassPickMatches({ kind: 'launch', typeId: 't1' }, use)).toBe(false);
  });
});

describe('freepassAulaDaVez', () => {
  const now = new Date('2026-11-26T10:00:00');
  const rec = (id, d, over = {}) => ({ id, freepassId: 'f', status: 'agendada', scheduledFor: new Date(`${d}T18:00:00`), ...over });
  it('a aula gravada é a mais cedo do freepass: fica nela (null)', () => {
    const records = [rec('nova', '2026-11-27'), rec('b', '2026-12-04')];
    expect(freepassAulaDaVez({ records, freepassId: 'f', currentAulaId: 'nova', now })).toBeNull();
  });
  it('outra aula do freepass vem antes: o agendamento do lead aponta para ela', () => {
    const records = [rec('nova', '2026-12-04'), rec('antes', '2026-11-28')];
    expect(freepassAulaDaVez({ records, freepassId: 'f', currentAulaId: 'nova', now }).id).toBe('antes');
  });
  it('a aula atual do lead é pendente e mais cedo, mesmo fora do freepass: fica nela', () => {
    const records = [rec('atual', '2026-11-27', { freepassId: null }), rec('b', '2026-11-28')];
    expect(freepassAulaDaVez({ records, freepassId: 'f', currentAulaId: 'atual', now })).toBeNull();
  });
  it('a aula atual já tem desfecho: vale a mais cedo do freepass', () => {
    const records = [rec('atual', '2026-11-26', { status: 'attended' }), rec('b', '2026-11-28')];
    expect(freepassAulaDaVez({ records, freepassId: 'f', currentAulaId: 'atual', now }).id).toBe('b');
  });
  it('sem aula pendente no freepass: null', () => {
    expect(freepassAulaDaVez({ records: [rec('velha', '2026-11-20')], freepassId: 'f', currentAulaId: 'x', now })).toBeNull();
  });
});
