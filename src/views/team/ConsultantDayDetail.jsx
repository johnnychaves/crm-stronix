import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { DG_CATEGORY_ORDER, DG_CATEGORY_META, overdueDaysOf } from '../../lib/dailyGoal.js';
import { DAILY_GOAL_CATEGORIES, getLeadAppointmentDate, getLeadAppointmentType } from '../../lib/leads.js';
import { cn } from '../../lib/utils.js';

const fmtHora = (d) => d instanceof Date
  ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  : '';

// O que vai à direita de cada lead: hora do compromisso, dias de atraso ou a
// hora em que o lead entrou. É o que diz ao gestor se aquilo já queimou.
function metaDoLead(lead, slug, slaOverdueDays) {
  if (slug === DAILY_GOAL_CATEGORIES.ATRASADO) {
    const dias = overdueDaysOf(lead);
    return { text: dias > 0 ? `atrasado ${dias}d` : 'vence hoje', critical: dias >= slaOverdueDays };
  }
  if (slug === DAILY_GOAL_CATEGORIES.NOVO_24H) {
    return { text: `entrou ${fmtHora(lead.createdAt)}`, critical: false };
  }
  if (slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE) {
    const hora = fmtHora(getLeadAppointmentDate(lead));
    const tipo = getLeadAppointmentType(lead);
    return {
      text: tipo === 'aula_experimental' && lead.modalidade ? `${hora} · ${lead.modalidade}` : hora,
      critical: false
    };
  }
  if (slug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE) {
    // Follow-up marcado só com data cai à meia-noite. "00:00" não informa
    // nada e ainda parece hora de verdade, então some.
    const d = lead.nextFollowUp;
    const semHora = d instanceof Date && d.getHours() === 0 && d.getMinutes() === 0;
    return { text: semHora ? 'sem hora' : fmtHora(d), critical: false };
  }
  return { text: '', critical: false };
}

// A linha aberta: à esquerda a carteira do dia em 6 categorias, à direita o
// extrato de prospecção. Os dois lados são NOMINAIS e clicáveis — o handoff
// supõe que a prospecção não tem nome de lead, mas tem:
// listVolumeActionsInRange devolve leadId e leadName desde a PR C.
function ConsultantDayDetail({ row, slaOverdueDays }) {
  const { openProfile } = useLeadProfile();

  const porCategoria = DG_CATEGORY_ORDER.map((slug) => {
    const itens = (row.processed || [])
      .filter((l) => l.categorySlugs.includes(slug))
      .map((l) => ({ lead: l, done: Boolean(l.categoryStatus?.[slug]), ...metaDoLead(l, slug, slaOverdueDays) }));
    return { slug, meta: DG_CATEGORY_META[slug], itens, done: itens.filter((i) => i.done).length };
  }).filter((c) => c.itens.length > 0);

  const faltam = Math.max(0, row.cota - row.prospDone);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_314px] gap-6 bg-paper-50 dark:bg-white/[0.02] px-5 py-4 border-t border-border">
      <div>
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-3">
          Meta diária · {row.isPast ? 'sem detalhe em dia passado' : 'carteira do dia'}
        </div>
        {row.isPast ? (
          // Limitação de GRAVAÇÃO, não de tela: só o resultado foi escrito.
          <p className="text-[12px] leading-relaxed">
            <span className={row.hitMeta ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300 font-semibold'}>
              {row.hitMeta ? 'A meta foi batida neste dia.' : 'A meta não foi batida neste dia.'}
            </span>{' '}
            <span className="text-slate-400 dark:text-slate-500">
              O sistema guarda o resultado, não quais tarefas existiam, então a carteira não pode ser reconstruída. A prospecção ao lado é recalculada e está completa.
            </span>
          </p>
        ) : porCategoria.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic">Nenhuma tarefa na meta de hoje.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[22px] gap-y-[14px]">
            {porCategoria.map((c) => (
              <div key={c.slug}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{c.meta.label}</span>
                  <span className={cn('text-[11px] num font-semibold', c.done === c.itens.length ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400')}>
                    {c.done}/{c.itens.length}
                  </span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-white/[0.08] my-1.5" />
                <ul className="space-y-1">
                  {c.itens.map(({ lead, done, text, critical }) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => openProfile(lead.id)}
                        className="w-full flex items-center gap-2 text-left group"
                      >
                        <i
                          className={cn('size-[7px] rounded-full shrink-0', done ? 'bg-success' : critical ? 'bg-danger' : 'bg-brand-200 dark:bg-brand-500/50')}
                          aria-hidden="true"
                        />
                        {/* Concluído recua: é lista de trabalho, não relatório —
                            o olho tem que cair no que falta. */}
                        <span className={cn(
                          'flex-1 min-w-0 truncate text-[12px] transition group-hover:text-brand-600 dark:group-hover:text-brand-400',
                          done && 'line-through opacity-55'
                        )}>
                          {lead.name || 'Sem nome'}
                        </span>
                        <span className={cn('shrink-0 text-[10.5px] num', critical ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-slate-400 dark:text-slate-500')}>
                          {text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:border-l lg:border-slate-200 dark:lg:border-white/[0.06] lg:pl-6">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-3">
          Prospecção · ações do dia
        </div>
        {!row.hasCota ? (
          <p className="text-[12px] text-slate-400 italic">Sem cota de prospecção.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[30px] font-bold leading-none num">{row.prospDone}</span>
              <span className="text-[12px] text-slate-400 num">de {row.cota}</span>
            </div>
            <div className={cn('text-[11.5px] font-semibold mt-1', faltam > 0 ? 'text-accent-600 dark:text-accent-400' : 'text-emerald-700 dark:text-emerald-400')}>
              {faltam > 0
                ? `${row.isPast ? 'faltaram' : 'faltam'} ${faltam} ${faltam === 1 ? 'ação' : 'ações'}`
                : `cota do dia ${row.isPast ? 'foi cumprida' : 'cumprida'}`}
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden mt-2">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.min(100, Math.round((row.prospDone / row.cota) * 100))}%` }} />
            </div>

            <ul className="mt-3 space-y-1.5">
              {(row.prospAcoes || []).map((a, i) => {
                // Lead que já saiu da base ativa não resolve nome: mostra o
                // tipo da ação, que é o que o sistema tem.
                const temNome = Boolean(a.leadName) && a.leadName !== '—';
                return (
                  <li key={`${a.leadId || 'sem'}-${i}`}>
                    <button
                      type="button"
                      disabled={!a.leadId}
                      onClick={() => a.leadId && openProfile(a.leadId)}
                      className="w-full flex items-center gap-2 text-left group disabled:cursor-default"
                    >
                      <i className="size-[7px] rounded-full bg-accent-500 shrink-0" aria-hidden="true" />
                      <span className={cn(
                        'flex-1 min-w-0 truncate text-[12px] transition group-enabled:group-hover:text-brand-600 dark:group-enabled:group-hover:text-brand-400',
                        !temNome && 'text-slate-500 dark:text-slate-400'
                      )}>
                        {temNome ? a.leadName : a.label}
                      </span>
                      <span className="shrink-0 text-[10.5px] num text-slate-400 dark:text-slate-500">{fmtHora(a.at)}</span>
                    </button>
                    <span className="block pl-[15px] text-[10.5px] text-slate-400 dark:text-slate-500">
                      {temNome ? a.label : 'lead fora da base ativa'}
                    </span>
                  </li>
                );
              })}
              {(row.prospAcoes || []).length === 0 && (
                <li className="text-[12px] text-slate-400 italic">Nenhuma ação registrada hoje.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export { ConsultantDayDetail };
