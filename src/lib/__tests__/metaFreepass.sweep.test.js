// A Meta Diária segue o freepass no Remarcar e no Cancelou, só com o módulo
// Stronix 2.0. A regra e a gravação estão testadas em freepassMetaWrites.test.js;
// esta varredura confere que a view as chama no lugar certo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const META = readFileSync(fileURLToPath(new URL('../../views/DailyGoalView.jsx', import.meta.url)), 'utf8');
const corpoDe = (nome) => {
  const inicio = META.indexOf(`const ${nome} = async`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return META.slice(inicio, META.indexOf('\n  };\n', inicio));
};

describe('a Meta segue o freepass', () => {
  it('o módulo decide', () => {
    expect(META).toContain('const freepassOn = hasModule(appUser?.tenantModules, MODULES.FALTOSOS);');
    expect(META).toContain('freepassOn={freepassOn}');
  });

  it('o Remarcar decide antes do registro, grava o freepassId nele e grava o freepass no mesmo lote', () => {
    const corpo = corpoDe('handleReschedule');
    const plano = corpo.indexOf('await metaFreepassPlan(');
    const registro = corpo.indexOf('upsertScheduledAula(');
    const lado = corpo.indexOf('await freepassScheduleWrites(');
    expect(plano).toBeGreaterThan(-1);
    expect(plano).toBeLessThan(registro);
    expect(registro).toBeLessThan(lado);
    expect(corpo).toContain('freepassOn && (isAula || lead.currentAulaId)');
    expect(corpo).toContain('...(fp && { freepassId: fp.targetId })');
    expect(corpo).toContain('...fpSide?.leadPatch');
    expect(corpo).toContain('logInteractions(db, lead, appUser, [interactionPayload, ...(fpSide?.notes || [])], leadUpdate, fpSide?.extra || null)');
  });

  it('o Cancelou de aula devolve a vaga depois de fechar o registro', () => {
    const corpo = corpoDe('handleOutcome');
    const fecha = corpo.indexOf('applyOutcomeToAula({ db, lead, outcome })');
    const devolve = corpo.indexOf('await writeFreepassAfterCancel({ db, lead })');
    expect(fecha).toBeGreaterThan(-1);
    expect(fecha).toBeLessThan(devolve);
    expect(corpo).toContain("freepassOn && outcome === 'cancelled' && outcomeAppliesToAula(categorySlug)");
  });
});
