// Leads parados (spec 2026-10-09, submenu 5): retrato de agora dos leads em
// aberto (o balde ativo, que o app já tem na memória) que estão sem próximo
// passo, com contato atrasado ou sem nada registrado na ficha há mais de N dias.
// Sem período e sem comparação. As regras são as do app:
// - em aberto e sem próximo passo são os da carteira de agora do painel CRM
//   (openLeadsOf e noNextStepOf, as contas do pipelineNowOf);
// - o atraso é o do Atrasado da Meta (overdueDaysOf), e fica com o dono do lead
//   mesmo quando o contato foi delegado, como lá;
// - os dias sem registro são os do selo "N dias sem contato" do Pipeline
//   (getDaysSinceFromDate, com a última interação pelo lastInteractionDateOf,
//   que junta o campo do lead e as interações do mês que chegam ao vivo).
// O consultor é o dono do lead hoje. Puro.
//
// O dailyGoal.js importa o lucide-react. Aqui não faz mal, porque os Relatórios
// só rodam no navegador, mas nenhuma função de api/ pode importar este arquivo.

import { getSafeDateOrNull, calendarDaysBetween } from '../../dates.js';
import { STAGE_TRACKING_SINCE } from '../../crm/scope.js';
import { openLeadsOf, noNextStepOf } from '../../crm/stages.js';
import { buildInteractionIndex, lastInteractionDateOf, getDaysSinceFromDate } from '../../leadStatus.js';
import { overdueDaysOf } from '../../dailyGoal.js';
import { DIAS_PARADOS_PADRAO } from '../../screenParams.js';
import {
  reportScope, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate, STAGE_SINCE_TEXT,
} from './base.js';

const SITUACAO = Object.freeze({
  semProximoPasso: 'situacao:sem-proximo-passo',
  atrasado: 'situacao:atrasado',
  semRegistro: 'situacao:sem-registro',
});

export const PARADOS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'etapa', label: 'Etapa' }),
  Object.freeze({ key: 'diasNaEtapa', label: 'Dias na etapa' }),
  Object.freeze({ key: 'ultimoRegistro', label: 'Último registro' }),
  Object.freeze({ key: 'diasSemRegistro', label: 'Dias sem registro' }),
  Object.freeze({ key: 'proximoContato', label: 'Próximo contato' }),
  Object.freeze({ key: 'diasAtraso', label: 'Dias de atraso' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
]);

// Desde quando o lead está na etapa de hoje. Toda troca de etapa grava a
// entrada (statusEnteredAt) desde 14/09/2026, e o lead novo também, menos o da
// indicação pelo link público (api/tenant-resolve.js): para ele, o cadastro.
// Lead que não troca de etapa desde antes disso não tem como saber: null.
export function stageSinceOf(lead) {
  const entered = getSafeDateOrNull(lead?.statusEnteredAt);
  if (entered) return entered;
  const created = lead?.createdAtMissing ? null : getSafeDateOrNull(lead?.createdAt);
  return created && created >= STAGE_TRACKING_SINCE ? created : null;
}

// Ordem da lista: quem está há mais dias sem registro primeiro, depois o nome e o id.
const byQuietest = (a, b) => (b.quiet ?? -1) - (a.quiet ?? -1)
  || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);

export function paradosReport(ctx, { userIds = [], funnelId = null, origem = null, recorte = null, dias = DIAS_PARADOS_PADRAO }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = buildInteractionIndex(ctx.interactions);
  // O funnelOk do reportScope já leva a origem, como o painel entrega ao pipelineNowOf.
  const open = openLeadsOf(ctx.liveLeads, { ownerOk: scope.ownerOk, funnelOk: scope.funnelOk }).map((l) => {
    const lastAt = lastInteractionDateOf(l, index);
    const quiet = getDaysSinceFromDate(l, lastAt, ctx.now.getTime());
    return {
      lead: l,
      lastAt,
      quiet,
      late: overdueDaysOf(l, ctx.now),
      noNext: noNextStepOf(l, ctx.now),
      stale: quiet != null && quiet > dias,
    };
  });
  // Um lead pode estar em mais de um número; na lista ele aparece uma vez.
  const stuck = open.filter((x) => x.noNext || x.late > 0 || x.stale);

  const tiles = [
    { key: SITUACAO.semProximoPasso, name: 'Sem próximo passo', value: open.filter((x) => x.noNext).length },
    { key: SITUACAO.atrasado, name: 'Contato atrasado', value: open.filter((x) => x.late > 0).length },
    { key: SITUACAO.semRegistro, name: `Sem registro há mais de ${dias} dias`, value: open.filter((x) => x.stale).length },
  ];
  const byOwner = countRows(stuck, (x) => names.ownerKey(x.lead), names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));

  const rows = stuck.map((x) => {
    const l = x.lead;
    const stageSince = stageSinceOf(l);
    const cuts = [cutCode('consultor', names.ownerKey(l))];
    if (x.noNext) cuts.push(SITUACAO.semProximoPasso);
    if (x.late > 0) cuts.push(SITUACAO.atrasado);
    if (x.stale) cuts.push(SITUACAO.semRegistro);
    return {
      id: l.id,
      lead: l,
      name: l.name || 'Sem nome',
      stage: l.status || '',
      stageDays: stageSince ? calendarDaysBetween(stageSince, ctx.now) : null,
      lastAt: x.lastAt,
      quiet: x.quiet,
      next: getSafeDateOrNull(l.nextFollowUp),
      late: x.late,
      owner: names.ownerLabel(l),
      cuts,
    };
  }).sort(byQuietest);

  const items = [...tiles, ...byOwner];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    open: open.length,
    total: stuck.length,
    dias,
    tiles,
    byOwner,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: PARADOS_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      etapa: r.stage,
      diasNaEtapa: r.stageDays ?? `antes de ${STAGE_SINCE_TEXT}`,
      ultimoRegistro: fmtDate(r.lastAt) || 'Nenhum',
      diasSemRegistro: r.quiet ?? '',
      proximoContato: fmtDate(r.next),
      diasAtraso: r.late || '',
      consultor: r.owner,
    })),
  };
}
