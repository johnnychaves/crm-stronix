import { DAILY_GOAL_CATEGORIES as C, getLeadAppointmentDate } from './leads.js';
import { overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS } from './dailyGoal.js';
import { daysToExpiryOf } from './renewalGoal.js';
import { expiredSortKey } from './expiredGoal.js';
import { getSafeDateOrNull } from './dates.js';
import { FOCO_COMPROMISSOS, FOCO_ORDER, FOCO_GRUPOS } from './metaFocoCodes.js';

// ============================================================================
// Lógica do "Foco agora" da Meta Diária. Pura: recebe as tarefas pendentes e o
// relógio e devolve a ordem da fila, o que é urgente e o que a tela deve
// avisar. A regra da conta de "tarefa feita" continua em dailyGoal.js; aqui só
// se decide o que fazer primeiro.
//
// A ordem da fila, do que vem primeiro para o que vem depois:
//   1. visita ou aula que já passou do horário e está sem desfecho
//   2. o que vence em até 90 minutos: visita, aula, contato marcado ou o fim da
//      janela de 24h de um lead novo
//   3. atrasado crítico, a partir do SLA da academia
//   4. o resto do que tem horário, pela hora
//   5. atrasado, do mais antigo
//   6. renovação, do vencimento mais próximo
//   7. vencido, do vencimento mais recente
// Dentro de cada classe vale o critério dela; empate resolve pela chave.
//
// O Agora (a tarefa em destaque) não muda sozinho com o relógio: só a ação do
// consultor o troca. Quando algo fica mais urgente, a tela mostra uma faixa de
// aviso (faixaFor) e quem decide é ele. As classes 1 e 2 acima, que o código
// chama de 0 e 1, são as "urgentes" que o título da aba conta.
//
// Uma "entrada" é uma tarefa pendente: { key, slug, lead }. Um lead com duas
// categorias pendentes vira duas entradas, como na tela de hoje.
// ============================================================================

const MIN_MS = 60 * 1000;

// Até quantos minutos antes do prazo uma tarefa já conta como urgente.
export const URGENT_WINDOW_MIN = 90;

// Os grupos da barra "Foco em" moram em metaFocoCodes.js, que o screenParams.js
// também lê. Aqui só se usa e se reexporta.
export { FOCO_COMPROMISSOS, FOCO_ORDER };

// A categoria entra no foco escolhido? 'all' aceita tudo, e foco desconhecido
// não aceita nada (a busca é pela própria chave, não pela herança do objeto).
export function inFoco(slug, foco) {
  if (!foco || foco === 'all') return true;
  const grupo = Object.hasOwn(FOCO_GRUPOS, foco) ? FOCO_GRUPOS[foco] : null;
  return grupo ? grupo.includes(slug) : slug === foco;
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

export const isAppt = (slug) => slug === C.VISITA_HOJE || slug === C.AULA_HOJE;

// Milissegundos até o prazo da tarefa (negativo = já passou), ou null quando a
// tarefa não tem prazo: atrasado, renovação e vencido não têm hora.
// O lead novo só entra na Meta no dia seguinte ao cadastro e sai 24h depois do
// cadastro (dailyGoal.js, categoria 1), então esse é o prazo dele. Passada a
// janela sem próximo passo, ele volta como Atrasado sem nextFollowUp
// (newLeadDueOf), e os dias de atraso saem do overdueDaysOf, desse prazo.
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

const COM_HORARIO = [C.VISITA_HOJE, C.AULA_HOJE, C.CONTATO_HOJE, C.NOVO_24H];

// O SLA vem da configuração da academia. O que não é um número positivo usa o
// padrão: com null ou 0, todo atrasado viraria crítico.
const slaValido = (sla) => (Number.isFinite(sla) && sla > 0 ? sla : DEFAULT_SLA_OVERDUE_DAYS);

// As classes, de 0 a 6, na ordem da lista do topo do arquivo:
// 0 desfecho de visita ou aula que já passou do horário
// 1 vence em até 90 minutos
// 2 atrasado crítico (a partir do SLA da academia)
// 3 o resto do que tem horário (inclusive o que tem horário e perdeu a data)
// 4 atrasado
// 5 renovação
// 6 vencido
function classOf(slug, ms, days, sla) {
  if (isAppt(slug) && ms != null && ms < 0) return 0;
  if (ms != null && ms <= URGENT_WINDOW_MIN * MIN_MS) return 1;
  if (slug === C.ATRASADO && days >= sla) return 2;
  if (ms != null) return 3;
  if (slug === C.ATRASADO) return 4;
  if (slug === C.RENOVACAO) return 5;
  return COM_HORARIO.includes(slug) ? 3 : 6;
}

// Mede a tarefa uma vez só: o prazo, os dias de atraso e a classe.
function measure(entry, now, opts) {
  const ms = deadlineMs(entry, now);
  const days = entry.slug === C.ATRASADO ? overdueDaysOf(entry.lead, now) : 0;
  return { ms, days, klass: classOf(entry.slug, ms, days, slaValido(opts?.sla)) };
}

export const klassOf = (entry, now, opts) => measure(entry, now, opts).klass;

// Desempate dentro da classe, do que vem primeiro para o que vem depois.
function tieOf(entry, { ms, days, klass }, now) {
  if (klass === 0 || klass === 1 || klass === 3) return ms ?? Infinity; // sem data, depois das que têm
  if (klass === 2 || klass === 4) return -days;
  if (klass === 5) return daysToExpiryOf(entry.lead.currentContractEndsAt, now) ?? Infinity;
  return -expiredSortKey(entry.lead); // vencido: o vencimento mais recente primeiro
}

// A ordem da fila. Devolve entradas novas com a classe e os minutos até o prazo
// (arredondados, ou null quando não há prazo). Não muda a lista recebida.
export function rankFoco(entries, now, opts = {}) {
  return (entries || [])
    .map((e) => {
      const m = measure(e, now, opts);
      return { item: { ...e, klass: m.klass, minutes: m.ms == null ? null : Math.round(m.ms / MIN_MS) }, tie: tieOf(e, m, now) };
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
  const pulou = new Set(skippedKeys || []); // o Set tira a chave repetida, na ordem da primeira vez
  const fim = [...pulou].map((k) => ranked.find((e) => e.key === k)).filter(Boolean);
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
