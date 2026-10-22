// O que a faixa de baixo do cabeçalho da ficha mostra: o próximo passo, a etapa
// (lead) ou o contrato (cliente), e a equipe. Puro, e reaproveita as contas que
// a ficha e o resto do app já têm, para o topo nunca dizer um número diferente:
// o "A seguir" (upNextOf), o destaque da aba Contratos (contractHeroOf e
// heroCountdownOf), a entrada na etapa do relatório de Leads parados
// (stageSinceOf), o silêncio do card do Pipeline (silenceDaysOf) e o professor
// do cabeçalho (profileProfessorOf).
import { CONTRACT_STATUS } from './contracts.js';
import { contractHeroOf, contractStartOf, heroCountdownOf } from './contractsTab.js';
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';
import { getDefaultFunnel, isItemInFunnel } from './funnels.js';
import { firstName } from './guardian.js';
import { silenceDaysOf } from './kanban.js';
import { profileProfessorOf } from './professores.js';
import { stageSinceOf } from './relatorios/leads/parados.js';
import { upNextOf } from './upNext.js';

// A partir de quantos dias sem registro o cabeçalho avisa.
export const SILENCE_NOTICE_DAYS = 7;

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n) => String(n).padStart(2, '0');
const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const fmtDia = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : '—';
};

// "CLIENTE ATIVO" -> "Cliente ativo". O rótulo do estado vem em caixa alta de
// deriveLeadState (fonte única, usada também por outras telas).
export function stateChipText(label) {
  const text = String(label || '').toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

// "Chegou por Instagram em 05/10." O ano só aparece quando não é o de agora.
// Lead sem data de cadastro de verdade (createdAtMissing: o app monta a data
// com a hora da carga) não tem o que dizer.
export function arrivedText(lead, now = new Date()) {
  if (!lead || lead.createdAtMissing) return null;
  const created = getSafeDateOrNull(lead.createdAt);
  if (!created) return null;
  const when = created.getFullYear() === now.getFullYear() ? dm(created) : `${dm(created)}/${created.getFullYear()}`;
  return lead.source ? `Chegou por ${lead.source} em ${when}.` : `Cadastrado em ${when}.`;
}

// Próximo passo: o primeiro item do "A seguir" (upNextOf já vem em ordem).
export function nextStepCell(lead, now = new Date()) {
  const [item] = upNextOf(lead, now);
  if (!item) {
    return { item: null, title: 'Sem próximo passo', detail: `Defina quando falar com ${firstName(lead?.name) || 'a pessoa'} de novo.` };
  }
  return {
    item,
    title: `${item.title} ${WEEKDAYS[item.when.getDay()]}, ${dm(item.when)} às ${hm(item.when)}`,
    detail: item.detail || '',
    overdue: Boolean(item.overdue),
  };
}

// Etapa do lead: a posição no funil dele, há quantos dias está nela e há
// quantos dias não tem registro. O funil é o do lead e, sem ele, o padrão, como
// no Mudar fase. Os dias na etapa são os do relatório de Leads parados (null
// quando a entrada não foi gravada), e o silêncio é o do card do Pipeline, que
// conta do cadastro quando não há registro nenhum.
export function stageCell({ lead, statuses = [], funnels = [], now = new Date() }) {
  const defaultId = getDefaultFunnel(funnels)?.id;
  const funnelId = lead?.funnelId || defaultId;
  const stages = (statuses || [])
    .filter((s) => isItemInFunnel(s, funnelId, defaultId))
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const since = stageSinceOf(lead);
  const gap = since ? calendarDaysBetween(since, now) : null;
  const lastDate = getSafeDateOrNull(lead?.lastInteractionAt) || (lead?.createdAtMissing ? null : getSafeDateOrNull(lead?.createdAt));
  const silence = silenceDaysOf(lastDate, now);
  return {
    name: lead?.status || '—',
    index: stages.findIndex((s) => s.name === lead?.status),
    total: stages.length,
    days: gap == null ? null : Math.max(0, gap),
    silence,
    silent: silence != null && silence >= SILENCE_NOTICE_DAYS,
  };
}

export function stageText({ days, silence, silent }) {
  const parts = [];
  if (days != null) parts.push(days === 0 ? 'Entrou nesta etapa hoje.' : `${dias(days)} nesta etapa.`);
  if (silent) parts.push(`${dias(silence)} sem registro.`);
  return parts.join(' ');
}

// Contrato do cliente: o destaque da aba Contratos, com as mesmas palavras do
// card. A régua (pct) só existe com o contrato correndo (ativo ou a vencer).
export function contractCell({ lead, contracts = [], now = new Date(), thresholdDays } = {}) {
  const { hero, hasContract, closed, status, heroStatus, likeNext } = contractHeroOf({ lead, contracts, now, thresholdDays });
  if (!hasContract) return null;
  const start = contractStartOf(hero);
  const end = getSafeDateOrNull(hero.endsAt);
  let text;
  if (closed) {
    text = status === CONTRACT_STATUS.VENCIDO ? `Venceu em ${fmtDia(end)}` : 'Contrato cancelado';
  } else {
    const c = heroCountdownOf({ contract: hero, status: heroStatus, hasNext: likeNext, now });
    text = `${c.label} ${dias(c.days)}, ${c.note}`;
  }
  const running = !closed && (heroStatus === CONTRACT_STATUS.ATIVO || heroStatus === CONTRACT_STATUS.A_VENCER);
  let pct = null;
  if (running && start && end && end.getTime() > start.getTime()) {
    const ratio = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
    pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  }
  return { planName: hero.planName || 'Plano', status: closed ? status : heroStatus, pct, text };
}

// Equipe: o consultor responsável e o professor do cabeçalho
// (profileProfessorOf: o do cadastro e, sem ele, o da aula). A modalidade só
// vem quando o professor mostrado é o da aula, e vira o papel.
export function teamCell(lead) {
  const prof = profileProfessorOf(lead);
  return {
    consultant: lead?.consultantName || null,
    professor: prof?.name || null,
    professorRole: prof?.modality ? `professor de ${prof.modality}` : 'professor',
  };
}
