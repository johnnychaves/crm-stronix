// Safra e eventos de lead do CRM (spec §4): leads novos, matrículas, perdas
// por motivo, desfecho da safra num instante, canais e dias até a matrícula.
// Puro. As listas chegam com a versão mais nova de cada lead.

import { getSafeDateOrNull } from '../dates.js';
import { deriveLeadBucket } from '../leadDerived.js';
import { isImportCreatedLead } from '../operacional/routine.js';
import { median, countBy, rankCounts } from './stats.js';

const DAY_MS = 86400000;

const inWindow = (d, start, end) => d instanceof Date && d >= start && d < end;

// Só o carimbo real da matrícula e da perda: nunca cai no cadastro.
export const convertedAtOf = (l) => getSafeDateOrNull(l?.convertedAt);
export const lostAtOf = (l) => getSafeDateOrNull(l?.lostAt);

// Primeira matrícula. O clienteSince é carimbado uma vez só, na primeira
// matrícula (contractsWrites.js), e o convertedAt é regravado a cada matrícula
// nova, inclusive a de quem volta. A mais antiga das duas é a primeira conversão.
export const clienteSinceOf = (l) => getSafeDateOrNull(l?.clienteSince);
export function firstEnrolledAtOf(l) {
  const conv = convertedAtOf(l);
  const since = clienteSinceOf(l);
  if (conv && since) return conv < since ? conv : since;
  return conv || since || null;
}

// Matrícula importada nunca é matrícula (spec §4; o Operacional também não
// conta contrato importado, isImportedContract). O lead criado pela importação
// já sai por isImportCreatedLead. Sobra o lead que já existia no CRM e que a
// importação promoveu a cliente: ela grava nele o clienteSince (e o
// convertedAt) com a data da planilha, ou com a hora dela quando a linha não
// tem data (clientImport.js). Os carimbos da importação (importBatchId,
// importSource e importedBy, mais o importedAt) também vão para o cliente que
// já tinha matrícula de verdade, então sozinhos não decidem. Conta como
// importada a primeira matrícula de lead carimbado que ficou antes do cadastro
// no CRM (a data da planilha; sem data de cadastro real, esse teste não vale)
// ou a até uma hora do importedAt (a hora da importação, na linha sem data).
// Limites: a data da planilha depois do cadastro no CRM segue contando como
// matrícula no mês dela, porque nenhum campo a separa de uma matrícula feita
// no app; e a hora da linha sem data é a da revisão da importação, então a
// revisão que ficou aberta mais de uma hora antes de gravar escapa da regra.
const IMPORT_TIME_SLACK_MS = 60 * 60 * 1000;
export function isImportedEnrollment(l) {
  if (!(l?.importBatchId || l?.importSource || l?.importedBy)) return false;
  const first = firstEnrolledAtOf(l);
  if (!first) return false;
  const created = l.createdAtMissing ? null : getSafeDateOrNull(l.createdAt);
  if (created && first < created) return true;
  const importedAt = getSafeDateOrNull(l.importedAt);
  return Boolean(importedAt) && Math.abs(first.getTime() - importedAt.getTime()) <= IMPORT_TIME_SLACK_MS;
}

// Tira repetido por id, mantendo o primeiro.
function unique(list) {
  const seen = new Set();
  return (list || []).filter((l) => {
    if (!l?.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

// Leads novos: cadastrados em [start, end), sem os criados pela importação e
// sem os de data de cadastro ausente (createdAtMissing, o normalizeLeadDoc põe
// "agora" neles).
export const newLeadsOf = (leads, { start, end, inScope }) => unique(leads).filter((l) =>
  !l.createdAtMissing && inWindow(l.createdAt, start, end) && !isImportCreatedLead(l) && inScope(l));

// Matrículas: a primeira matrícula (firstEnrolledAtOf) em [start, end), sem o
// lead criado pela importação e sem a matrícula importada
// (isImportedEnrollment). O retorno de ex-cliente regrava o convertedAt, mas
// não é matrícula nova e não conta no mês dele. A primeira segue no mês dela,
// que a carga acha pelo clienteSince (useCrmSources). É o mesmo corte do
// "entraram" do Operacional, que ignora quem tem contrato anterior (salesInWindow).
export const enrollmentsOf = (leads, { start, end, inScope }) => unique(leads).filter((l) =>
  inWindow(firstEnrolledAtOf(l), start, end) && !isImportCreatedLead(l) && !isImportedEnrollment(l) && inScope(l));

// Perdas: quem está em Perda hoje e não é cliente, com lostAt em [start, end),
// por motivo. Perda sem motivo entra em "Sem motivo". A lista vai junto, para a
// etapa da perda sair dos mesmos leads (lossStagesOf).
export function lossesOf(leads, { start, end, inScope }) {
  const list = unique(leads).filter((l) =>
    deriveLeadBucket(l) === 'perda' && inWindow(lostAtOf(l), start, end) && inScope(l));
  return {
    total: list.length,
    reasons: rankCounts(countBy(list, (l) => String(l.lossReason || '').trim() || 'Sem motivo')),
    leads: list
  };
}

// Desfecho de um lead da safra no instante asOf. Vale a primeira matrícula: o
// retorno de quem já foi cliente não empurra a conversão para depois.
export function outcomeAt(lead, asOf) {
  const conv = firstEnrolledAtOf(lead);
  if (conv && conv <= asOf) return 'enrolled';
  const lost = lostAtOf(lead);
  if (deriveLeadBucket(lead) === 'perda' && lost && lost <= asOf) return 'lost';
  return 'open';
}

// Canais: a origem do cadastro dos leads novos e quantos deles matricularam
// até asOf. Do maior volume para o menor.
export function channelsOf(cohort, asOf) {
  const map = new Map();
  (cohort || []).forEach((l) => {
    const name = String(l.source || '').trim() || 'Sem origem';
    const row = map.get(name) || { name, leads: 0, enrolled: 0 };
    row.leads += 1;
    if (outcomeAt(l, asOf) === 'enrolled') row.enrolled += 1;
    map.set(name, row);
  });
  return [...map.values()].sort((a, b) =>
    b.leads - a.leads || b.enrolled - a.enrolled || a.name.localeCompare(b.name, 'pt-BR'));
}

// Faixas do histograma de dias até a matrícula (handoff, linha 1351).
export const DAYS_BUCKETS = [
  { name: '0 a 1', min: 0, max: 1 },
  { name: '2 a 3', min: 2, max: 3 },
  { name: '4 a 7', min: 4, max: 7 },
  { name: '8 a 14', min: 8, max: 14 },
  { name: '15 a 30', min: 15, max: 30 },
  { name: '31+', min: 31, max: Infinity }
];

// Dias inteiros do cadastro à primeira matrícula das matrículas do mês. O
// retorno regrava o convertedAt e esticaria a conta até a volta. A matrícula
// importada fica fora, como em enrollmentsOf: a data da planilha antes do
// cadastro daria 0 dias.
export function daysToEnrollOf(enrollments) {
  const days = (enrollments || [])
    .filter((l) => !l.createdAtMissing && l.createdAt instanceof Date && firstEnrolledAtOf(l) && !isImportedEnrollment(l))
    .map((l) => Math.max(0, Math.floor((firstEnrolledAtOf(l) - l.createdAt) / DAY_MS)));
  return {
    total: days.length,
    median: median(days),
    buckets: DAYS_BUCKETS.map((b) => days.filter((d) => d >= b.min && d <= b.max).length)
  };
}
