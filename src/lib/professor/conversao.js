// Conversão das aulas experimentais no ciclo: pessoas que vieram e quantas
// delas se matricularam. Freepass e aula experimental são o mesmo registro em
// stronix_aulas, então entram juntos. Cada lead conta uma vez por professor
// (o professorRowsOf dos Relatórios conta registros, e por isso não serve).
// A matrícula é o `converted` que o markConvertingAula grava na última aula
// com "Compareceu" do lead, e só vale com contrato pago: valor acima de zero,
// não importado e que chegou a valer. Treino sozinho e visita não entram, e a
// aula dos últimos `janelaDias` fica fora, porque ainda não teve tempo de
// virar matrícula. A mesma conta sobre a academia inteira, pelo total de
// pessoas, dá a referência. O professor passa quando fica acima da academia
// menos a tolerância; empate não passa. Não há mínimo de pessoas.
import { AULA_STATUS, isAulaRecord, isSoloTrainingRecord } from '../aulas.js';
import { isImportedContract, neverTookEffect } from '../contracts.js';
import { pct } from '../crm/stats.js';
import { getSafeDateOrNull } from '../dates.js';
import { monthKeyOf } from '../operacional/month.js';
import { limitesDoCiclo } from './ciclo.js';

const DAY_MS = 86400000;

// Cópia do APPTS_COMPLETE_MONTH de crm/scope.js, que este arquivo não pode
// importar (scope.js chega ao firebase e ao dailyGoal.js). O teste confere as duas.
export const APPTS_COMPLETE_MONTH = '2026-09';

const contratoPago = (c) => Number(c?.value) > 0 && !isImportedContract(c) && !neverTookEffect(c);

function contaPessoas(registros, comContratoPago) {
  const porLead = new Map();
  registros.forEach((r) => {
    porLead.set(r.leadId, porLead.get(r.leadId) || (r.converted === true && comContratoPago.has(r.leadId)));
  });
  let matricularam = 0;
  porLead.forEach((m) => { if (m) matricularam += 1; });
  return { vieram: porLead.size, matricularam, taxa: pct(matricularam, porLead.size) };
}

// { professor, academia, passa, incompleto }. `passa` é null sem pessoas de
// um dos lados. A comparação usa as porcentagens inteiras que a tela mostra.
// `incompleto` diz que o ciclo pega o trecho antes de setembro de 2026, com
// os agendamentos incompletos.
export function conversaoDoCiclo({ aulas, contratos, professorId, ciclo, asOf = new Date(), janelaDias = 30, tolerancia = 0 }) {
  const { inicio, fim } = limitesDoCiclo(ciclo);
  const corte = asOf.getTime() - janelaDias * DAY_MS;
  const vieram = (aulas || []).filter((r) => {
    const at = getSafeDateOrNull(r?.scheduledFor);
    return Boolean(r?.leadId) && isAulaRecord(r) && r.status === AULA_STATUS.ATTENDED && !isSoloTrainingRecord(r)
      && Boolean(at) && at >= inicio && at < fim && at.getTime() < corte;
  });
  const comContratoPago = new Set((contratos || []).filter(contratoPago).map((c) => c.leadId));
  const professor = contaPessoas(vieram.filter((r) => r.professorId === professorId), comContratoPago);
  const academia = contaPessoas(vieram, comContratoPago);
  const passa = professor.taxa == null || academia.taxa == null ? null : professor.taxa > academia.taxa - tolerancia;
  return { professor, academia, passa, incompleto: monthKeyOf(inicio) < APPTS_COMPLETE_MONTH };
}
