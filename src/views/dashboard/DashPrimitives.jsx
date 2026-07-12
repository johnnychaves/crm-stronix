// Primitivos visuais compartilhados pelas telas Operacional e Gerencial do
// dashboard. Visual portado dos mockups v2 aprovados (Fase 2): cores do
// mockup mapeadas 1:1 nos tokens do app (ink-900/paper-50/brand-600/
// accent-500/success/danger) e dark mode resolvido pelos tokens semânticos.
// Toda a matemática vem de lib/dashboardMetrics.js — aqui é só apresentação.

import { ArrowRight, HelpCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.jsx';
import { Sparkline } from '../../components/charts/Sparkline.jsx';
import { getLeadAppointmentType, getLeadAppointmentDate, getAppointmentOutcomeMeta } from '../../lib/leads.js';
import { formatHourLabel } from '../../lib/format.js';
import { DASH_TONES, BREAKDOWN_PALETTE } from './dashTokens.js';

export function DashCard({ title, hint, icon, action, children, padded = true, className }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card shadow-card', className)}>
      {title && (
        <header className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="size-7 rounded-md grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold whitespace-nowrap">{title}</h3>
              {hint && <p className="text-[11.5px] text-muted-foreground truncate">{hint}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

// "?" com tooltip (shadcn) — substitui o balão artesanal do dashboard antigo.
export function DashHelpTip({ text, label = 'O que isso significa?' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex items-center justify-center size-4 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition cursor-help shrink-0"
        >
          <HelpCircle size={12} strokeWidth={2.2} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 whitespace-normal text-[11.5px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function DashPeriodTabs({ value, onChange }) {
  const opts = [
    { id: 'today',       label: 'Hoje' },
    { id: 'weekly',      label: 'Semana' },
    { id: 'monthly',     label: 'Mês atual' },
    { id: 'monthlyPrev', label: 'Mês anterior' },
    { id: 'custom',      label: 'Personalizado' }
  ];
  return (
    <div className="inline-flex p-1 rounded-xl bg-white dark:bg-white/[0.03] border border-border">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'h-8 px-3.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition',
            value === o.id
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DashKpiCard({ label, value, delta, accent = 'brand', series, sub, help }) {
  const up = delta == null ? null : delta >= 0;
  const t = DASH_TONES[accent] || DASH_TONES.brand;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground whitespace-nowrap">
          <span>{label}</span>
          {help && <DashHelpTip text={help} label={`O que é "${label}"?`} />}
        </div>
        {delta != null && (
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-semibold num whitespace-nowrap',
            up
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          )}>
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-[32px] font-semibold tracking-tight leading-none">{value}</span>
      </div>
      <div className="text-[11.5px] text-muted-foreground mt-1 whitespace-nowrap truncate">
        {sub || 'vs. período anterior'}
      </div>
      {series && series.length > 1 && (
        <div className={cn('mt-3 -mx-1 [&_svg]:w-full [&_svg]:h-[42px]', t.stroke)}>
          <Sparkline data={series} width={120} height={42} strokeWidth={1.75} />
        </div>
      )}
    </div>
  );
}

// ---- Linha do dia (Operacional) --------------------------------------------
// Trilho vertical com horários; bolinha colorida pelo desfecho; marcador
// tracejado laranja de "agora" entre o que já passou e o que ainda vem.

const TL_DOT = {
  attended: 'border-emerald-500',
  no_show: 'border-rose-500',
  rescheduled: 'border-amber-500',
  cancelled: 'border-slate-400',
  pending: 'border-brand-500'
};

function timelineBadge(lead, isPast) {
  const meta = getAppointmentOutcomeMeta(lead.appointmentOutcome);
  if (meta) return { label: meta.label, className: meta.badgeClass };
  if (isPast) return { label: 'marcar desfecho', className: 'bg-accent-500/12 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400' };
  return { label: 'confirmar presença', className: 'bg-muted text-muted-foreground' };
}

function timelineSub(lead, showConsultant) {
  const type = getLeadAppointmentType(lead);
  const parts = [];
  if (type === 'aula_experimental') {
    parts.push(lead.appointmentModality || 'Aula experimental');
    if (lead.appointmentProfessorName) parts.push(`Prof. ${lead.appointmentProfessorName.split(' ')[0]}`);
    else if (lead.appointmentSoloTraining) parts.push('treina sozinho');
  } else if (lead.source) {
    parts.push(`origem ${lead.source}`);
  }
  if (showConsultant && lead.consultantName) {
    parts.push(`consultor ${lead.consultantName.split(' ')[0]}`);
  }
  return parts.join(' · ');
}

export function DashTimeline({ events, now = new Date(), onEventClick, showConsultant = false }) {
  if (!events || events.length === 0) {
    return (
      <div className="py-10 text-center text-[12.5px] text-slate-400 italic">
        Nenhuma visita ou aula marcada para hoje.
      </div>
    );
  }

  const nowMs = now.getTime();
  const rows = [];
  let agoraInserted = false;
  events.forEach((lead) => {
    const date = getLeadAppointmentDate(lead);
    if (!agoraInserted && date.getTime() > nowMs) {
      rows.push({ kind: 'agora', key: 'agora' });
      agoraInserted = true;
    }
    rows.push({ kind: 'ev', key: lead.id, lead, date, isPast: date.getTime() <= nowMs });
  });
  if (!agoraInserted) rows.push({ kind: 'agora', key: 'agora' });

  return (
    <div className="relative pl-14 sm:pl-16">
      <span aria-hidden="true" className="absolute left-10 sm:left-11 top-1 bottom-1 w-0.5 rounded bg-slate-200 dark:bg-white/[0.08]" />
      {rows.map((row) => {
        if (row.kind === 'agora') {
          return (
            <div key={row.key} className="relative my-2.5 h-0 border-t-2 border-dashed border-accent-500/70">
              <span className="absolute right-0 -top-2.5 rounded-md bg-accent-500 px-2 py-0.5 text-[9.5px] font-bold text-white num">
                agora · {formatHourLabel(now)}
              </span>
            </div>
          );
        }
        const { lead, date, isPast } = row;
        const type = getLeadAppointmentType(lead);
        const outcomeKey = lead.appointmentOutcome || 'pending';
        const badge = timelineBadge(lead, isPast);
        const sub = timelineSub(lead, showConsultant);
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => onEventClick && onEventClick(lead)}
            className="relative mb-2 flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 text-left transition hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-white/[0.02] dark:hover:border-brand-500/40"
          >
            <span className="num absolute -left-14 sm:-left-16 w-9 text-right text-[10.5px] font-semibold text-muted-foreground">
              {formatHourLabel(date)}
            </span>
            <span
              aria-hidden="true"
              className={cn('absolute -left-[19px] sm:-left-[23px] size-2.5 rounded-full border-[2.5px] bg-card', TL_DOT[outcomeKey] || TL_DOT.pending)}
            />
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                type === 'visita'
                  ? 'bg-accent-500/12 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400'
                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              )}
            >
              {type === 'visita' ? 'Visita' : 'Aula'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{lead.name}</span>
              {sub && <span className="block truncate text-[10.5px] text-muted-foreground">{sub}</span>}
            </span>
            <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap', badge.className)}>
              {badge.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Card de conversão GÊMEO (consultor / professor) -----------------------
// Mesmo formato e peso de propósito ("a atenção deve ser a mesma para ambos"):
// faixa com os números GERAIS no topo, resultado por pessoa abaixo — barra
// segmentada proporcional ao volume, conversão à direita.

const CONV_SEG = {
  accent: 'bg-accent-500',
  brand: 'bg-brand-600 dark:bg-brand-500',
  slate: 'bg-slate-300 dark:bg-white/20'
};
const CONV_DOT = {
  accent: 'bg-accent-500',
  brand: 'bg-brand-600 dark:bg-brand-500',
  slate: 'bg-slate-300 dark:bg-white/25'
};

function ConversionRow({ row }) {
  return (
    <li className="flex items-center gap-3.5 px-2 py-3.5 border-b border-slate-100 dark:border-white/[0.05] last:border-b-0">
      <span
        className={cn(
          'shrink-0 size-6 rounded-lg flex items-center justify-center font-display text-[12.5px] font-bold num',
          row.reference
            ? 'bg-card border-[1.5px] border-dashed border-slate-300 dark:border-white/20'
            : row.rank === 1
              ? 'bg-accent-50 text-accent-500 dark:bg-accent-500/15 dark:text-accent-400'
              : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
        )}
      >
        {row.reference ? '' : row.rank}
      </span>
      <span
        className={cn(
          'shrink-0 w-[38px] h-[38px] rounded-[11px] flex items-center justify-center font-display text-[13px] font-semibold tracking-wide',
          row.muted
            ? 'bg-slate-100 text-slate-400 border border-dashed border-slate-300 dark:bg-white/[0.04] dark:text-slate-500 dark:border-white/15'
            : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
        )}
      >
        {row.initials}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-[14px] font-semibold', row.muted ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white')}>{row.name}</span>
          {row.hot && <span className="text-[12px] leading-none" aria-label="líder">🔥</span>}
          {(row.tags || []).map((tag) => (
            <span key={tag} className="text-[9.5px] font-semibold text-slate-400 bg-slate-100 dark:bg-white/[0.06] dark:text-slate-400 rounded-md px-1.5 py-0.5 uppercase tracking-wide">
              {tag}
            </span>
          ))}
        </div>
        <div className="w-full h-[13px] rounded-[7px] bg-slate-100 dark:bg-white/[0.06] overflow-hidden my-1.5" title={row.trackTitle}>
          <div className="flex h-full" style={{ width: `${Math.max(2, Math.round((row.barScale || 0) * 100))}%` }}>
            {(row.segments || []).filter(s => s.frac > 0).map((s, i) => (
              <span
                key={i}
                className={cn('h-full border-r-2 border-white dark:border-ink-800 last:border-r-0', CONV_SEG[s.tone] || CONV_SEG.slate)}
                style={{ width: `${s.frac * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="text-[11.5px] text-slate-400 dark:text-slate-500 num">{row.stats}</div>
      </div>
      <div className="shrink-0 w-24 text-right">
        <span className={cn('block font-display text-[25px] font-bold leading-none tracking-tight num', row.zero || row.muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white')}>
          {row.pct}
        </span>
        <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1 num">{row.den}</span>
        {row.delta && <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 num">{row.delta}</span>}
        {row.refLabel && <span className="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{row.refLabel}</span>}
      </div>
    </li>
  );
}

export function ConversionCard({
  title,
  subtitle,
  windowLabel,
  general,
  sectionLabel,
  legend,
  rows,
  reference,
  referenceLabel,
  footnote,
  emptyText
}) {
  const hasRows = (rows || []).length > 0 || reference;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] font-bold tracking-tight">{title}</h3>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <span className="shrink-0 text-[11.5px] font-semibold text-brand-600 bg-brand-50 border border-brand-100 dark:text-brand-300 dark:bg-brand-500/15 dark:border-brand-500/20 px-2.5 py-1 rounded-full whitespace-nowrap">
          {windowLabel}
        </span>
      </div>

      <div className="flex mt-4 mb-1.5 rounded-xl overflow-hidden bg-paper-50 border border-slate-100 dark:bg-white/[0.03] dark:border-white/[0.06]">
        {(general || []).map((g, i) => (
          <div key={g.label} className={cn('flex-1 px-4 py-3', i > 0 && 'border-l border-slate-200 dark:border-white/[0.08]')}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.label}</div>
            <div className={cn('font-display text-[30px] font-bold tracking-tight leading-none mt-1.5 num', g.accent ? 'text-accent-500' : 'text-slate-900 dark:text-white')}>
              {g.value}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 num">{g.den}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{sectionLabel}</span>
        <span className="flex gap-3.5">
          {(legend || []).map((lg) => (
            <span key={lg.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <i className={cn('size-[9px] rounded-[3px]', CONV_DOT[lg.tone] || CONV_DOT.slate)} />
              {lg.label}
            </span>
          ))}
        </span>
      </div>

      {hasRows ? (
        <ul className="-mx-2">
          {(rows || []).map((row) => <ConversionRow key={row.key} row={row} />)}
          {reference && (
            <>
              <li className="px-2 pt-3 pb-0.5 mt-1 border-t border-dashed border-slate-200 dark:border-white/[0.08] text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {referenceLabel}
              </li>
              <ConversionRow row={reference} />
            </>
          )}
        </ul>
      ) : (
        <div className="py-8 text-center text-[12.5px] text-slate-400 italic">{emptyText}</div>
      )}

      <div className="flex items-start gap-2 mt-3.5 pt-3 border-t border-slate-100 dark:border-white/[0.06] text-[11.5px] text-slate-400 dark:text-slate-500 leading-relaxed">
        <Info size={14} className="shrink-0 mt-0.5 text-slate-300 dark:text-slate-600" />
        <span>{footnote}</span>
      </div>
    </section>
  );
}

// ---- Card de quebra (Motivos de perda · Canais · Aulas por modalidade) -----
// 3 cards IRMÃOS: header com badge, herói (líder em destaque), cápsula
// segmentada de 42px por proporção (líder rotulado por dentro quando ≥20%) e
// legenda ranqueada. Rodapé com leitura derivada + ação opcional.

export function BreakdownCard({ icon: Icon, title, sub, help, eyebrow, items, total, footText, ctaLabel, onCta, emptyText }) {
  const rows = (items || []).map((it, i) => ({
    ...it,
    pct: total > 0 ? Math.round((it.count / total) * 100) : 0,
    color: BREAKDOWN_PALETTE[i % BREAKDOWN_PALETTE.length]
  }));
  const leader = rows[0] || null;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card p-[18px] flex flex-col">
      <div className="flex items-center gap-2.5">
        <span className="size-7 rounded-lg bg-accent-50 dark:bg-accent-500/15 grid place-items-center shrink-0">
          {Icon && <Icon size={15} className="text-accent-500" strokeWidth={2.2} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[15px] font-semibold leading-tight tracking-tight">{title}</div>
          <div className="text-[12px] text-slate-400 dark:text-slate-500 truncate num">{sub}</div>
        </div>
        {help && <DashHelpTip text={help} label={`Como ler "${title}"?`} />}
      </div>

      {leader ? (
        <>
          <div className="mt-4 font-display text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400 dark:text-slate-500">{eyebrow}</div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="font-display text-[34px] font-bold leading-[0.9] tracking-tight text-accent-500 num shrink-0">{leader.count}</span>
            <div className="min-w-0">
              <div className="font-display text-[15px] font-semibold leading-tight truncate">{leader.name}</div>
              <div className="text-[12px] text-slate-400 dark:text-slate-500 num">
                {leader.count} de {total} · {leader.pct}%
              </div>
            </div>
          </div>

          <div
            className="flex h-[42px] mt-3.5 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/[0.06]"
            role="img"
            aria-label={`Participação: ${rows.map(r => `${r.name} ${r.pct}%`).join(', ')}`}
          >
            {rows.map((r) => (
              <div
                key={r.name}
                className={cn('h-full flex items-center px-2 min-w-[7px] border-l-2 border-white dark:border-ink-800 first:border-l-0', r.color)}
                style={{
                  width: `${r.pct}%`,
                  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,0) 60%)'
                }}
              >
                {r.pct >= 20 && (
                  <span className="font-display text-[11.5px] font-bold text-white num whitespace-nowrap">{r.pct}%</span>
                )}
              </div>
            ))}
          </div>

          <ul className="mt-3.5 space-y-2">
            {rows.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2">
                <span className={cn('size-[9px] rounded-full shrink-0', r.color)} />
                <span className={cn('flex-1 min-w-0 truncate text-[13px]', i === 0 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>
                  {r.name}
                </span>
                <span className="font-display text-[13px] font-bold num">{r.count}</span>
                <span className="font-display text-[12px] text-slate-400 dark:text-slate-500 num w-8 text-right">{r.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="py-8 text-center text-[12.5px] text-slate-400 italic">{emptyText}</div>
      )}

      {(footText || (ctaLabel && onCta)) && leader && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          {footText && <div className="text-[12px] text-muted-foreground leading-snug">{footText}</div>}
          {ctaLabel && onCta && (
            <button
              type="button"
              onClick={onCta}
              className="inline-flex items-center gap-1.5 mt-2 font-display text-[12px] font-semibold text-accent-500 hover:text-accent-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 rounded-sm transition"
            >
              {ctaLabel}
              <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
