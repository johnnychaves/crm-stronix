import { DAILY_GOAL_CATEGORIES as C, getLeadAppointmentDate } from './leads.js';
import { overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS } from './dailyGoal.js';
import { daysToExpiryOf } from './renewalGoal.js';
import { expiredSortKey } from './expiredGoal.js';
import { getSafeDateOrNull } from './dates.js';

// ============================================================================
// Lógica do "Foco agora" da Meta Diária. Pura: recebe as tarefas pendentes e o
// relógio e devolve a ordem da fila, o que é urgente e o que a tela deve
// avisar. A regra da conta de "tarefa feita" continua em dailyGoal.js; aqui só
// se decide o que fazer primeiro. Spec e desenho: .claude/plan/meta-diaria-foco-agora.md
// e o mockup B (docs/superpowers/specs/mockups/2026-10-16-meta-diaria-b-foco-agora.html).
//
// Uma "entrada" é uma tarefa pendente: { key, slug, lead }. Um lead com duas
// categorias pendentes vira duas entradas, como na tela de hoje.
// ============================================================================

const MIN_MS = 60 * 1000;

// Até quantos minutos antes do prazo uma tarefa já conta como urgente.
export const URGENT_WINDOW_MIN = 90;

// Os grupos da barra "Foco em", na ordem em que aparecem. 'all' é a barra
// inteira. Os valores são os mesmos do `cat` do endereço (screenParams.js).
export const FOCO_COMPROMISSOS = 'compromissos';
export const FOCO_ORDER = Object.freeze([
  'all', FOCO_COMPROMISSOS, C.CONTATO_HOJE, C.NOVO_24H, C.ATRASADO, C.RENOVACAO, C.VENCIDO,
]);

const GRUPOS = Object.freeze({
  [FOCO_COMPROMISSOS]: [C.VISITA_HOJE, C.AULA_HOJE],
});

// A categoria entra no foco escolhido? 'all' aceita tudo.
export function inFoco(slug, foco) {
  if (!foco || foco === 'all') return true;
  return GRUPOS[foco] ? GRUPOS[foco].includes(slug) : slug === foco;
}

export const taskKey = (lead, slug) => `${lead.id}:${slug}`;

// As tarefas que ainda faltam, a partir do que o computeDailyGoalSlots devolve.
export function pendingEntries(processedLeads) {
  const out = [];
  for (const lead of processedLeads || []) {
    for (const slug of lead.categorySlugs || []) {
      if (!lead.categoryStatus?.[slug]) out.push({ key: taskKey(lead, slug), slug, lead });
    }
  }
  return out;
}

const isAppt = (slug) => slug === C.VISITA_HOJE || slug === C.AULA_HOJE;

// Milissegundos até o prazo da tarefa (negativo = já passou), ou null quando a
// tarefa não tem prazo: atrasado, renovação e vencido não têm hora.
// O lead novo só entra na Meta no dia seguinte ao cadastro e sai 24h depois do
// cadastro (dailyGoal.js, categoria 1), então esse é o prazo dele.
function deadlineMs(entry, now) {
  const { slug, lead } = entry;
  let at = null;
  if (isAppt(slug)) at = getLeadAppointmentDate(lead);
  else if (slug === C.CONTATO_HOJE) at = getSafeDateOrNull(lead.nextFollowUp);
  else if (slug === C.NOVO_24H) {
    const created = getSafeDateOrNull(lead.createdAt);
    at = created ? new Date(created.getTime() + 24 * 60 * MIN_MS) : null;
  }
  return at ? at.getTime() - now.getTime() : null;
}

// 0 desfecho de visita ou aula que já passou do horário
// 1 vence em até 90 minutos
// 2 atrasado crítico (a partir do SLA da academia)
// 3 o resto do que tem horário
// 4 atrasado
// 5 renovação
// 6 vencido
export function klassOf(entry, now, { sla = DEFAULT_SLA_OVERDUE_DAYS } = {}) {
  const d = deadlineMs(entry, now);
  if (isAppt(entry.slug) && d != null && d < 0) return 0;
  if (d != null && d <= URGENT_WINDOW_MIN * MIN_MS) return 1;
  if (entry.slug === C.ATRASADO && overdueDaysOf(entry.lead, now) >= sla) return 2;
  if (d != null) return 3;
  if (entry.slug === C.ATRASADO) return 4;
  if (entry.slug === C.RENOVACAO) return 5;
  return 6;
}

// Desempate dentro da classe, do que vem primeiro para o que vem depois.
function tieOf(entry, klass, now, ms) {
  if (klass === 0 || klass === 1 || klass === 3) return ms;
  if (klass === 2 || klass === 4) return -overdueDaysOf(entry.lead, now);
  if (klass === 5) return daysToExpiryOf(entry.lead.currentContractEndsAt, now) ?? Infinity;
  return -expiredSortKey(entry.lead); // vencido: o vencimento mais recente primeiro
}

// A ordem da fila. Devolve entradas novas com a classe e os minutos até o prazo
// (arredondados, ou null quando não há prazo). Não muda a lista recebida.
export function rankFoco(entries, now, opts = {}) {
  return (entries || [])
    .map((e) => {
      const ms = deadlineMs(e, now);
      const klass = klassOf(e, now, opts);
      return { item: { ...e, klass, minutes: ms == null ? null : Math.round(ms / MIN_MS) }, tie: tieOf(e, klass, now, ms) };
    })
    .sort((a, b) => a.item.klass - b.item.klass || a.tie - b.tie || (a.item.key < b.item.key ? -1 : a.item.key > b.item.key ? 1 : 0))
    .map((x) => x.item);
}

// Quantas tarefas estão urgentes (classes 0 e 1). É o número do título da aba.
export function urgentCount(entries, now, opts = {}) {
  return (entries || []).filter((e) => klassOf(e, now, opts) <= 1).length;
}

// Pular manda a tarefa para o fim, na ordem em que foi pulada. Só vale nesta
// sessão e não grava nada. Chave que já saiu da lista é ignorada.
export function withSkipped(ranked, skippedKeys) {
  const pulou = new Set(skippedKeys || []);
  const fim = (skippedKeys || []).map((k) => ranked.find((e) => e.key === k)).filter(Boolean);
  return [...ranked.filter((e) => !pulou.has(e.key)), ...fim];
}

// O Agora fica parado: é a tarefa escolhida pela última ação enquanto ela
// continua pendente. O relógio nunca troca isso. Só quando ela some da lista
// (concluída, remarcada, removida por dado novo) vale o primeiro da ordem.
export function pickAgora(ranked, agoraKey) {
  if (!ranked || !ranked.length) return null;
  return (agoraKey && ranked.find((e) => e.key === agoraKey)) || ranked[0];
}

// A faixa de aviso: há algo mais urgente que o Agora, e é de verdade urgente
// (classe 0 ou 1)? Devolve a tarefa a avisar, ou null. Não interrompe quando o
// Agora já é da mesma classe, nem por atrasado crítico, para não virar ruído.
// `dispensadas` é um Map(chave -> classe em que foi dispensada): "Agora não"
// esconde a tarefa, e ela volta se a classe mudar.
export function faixaFor(ranked, agora, dispensadas) {
  if (!ranked || !ranked.length || !agora) return null;
  const alvo = ranked.find((e) => !(dispensadas && dispensadas.get(e.key) === e.klass));
  if (!alvo || alvo.key === agora.key) return null;
  return alvo.klass <= 1 && alvo.klass < agora.klass ? alvo : null;
}
