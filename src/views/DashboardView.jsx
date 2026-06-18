import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Activity, BarChart3, Bell, Calendar, CheckCircle, Clock, Dumbbell, Filter, HelpCircle, Kanban, LayoutDashboard, Phone, Zap } from 'lucide-react';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { getLeadAppointmentType, getLeadAppointmentDate, getLeadConversionDate, isLeadAttended, isLeadConverted, isAdminUser, isRegistrationNote } from '../lib/leads.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeDailyVolume, computeVolumeInRange, countMetaDaysInMonth, volumeTargetFor, dgDateKey } from '../lib/dailyGoal.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { getDefaultFunnel, isItemInFunnel, isAllFunnels } from '../lib/funnels.js';
import { formatHourLabel, humanizeAge } from '../lib/format.js';
import { cn } from '../lib/utils.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { FunnelSelector } from '../components/ui/FunnelSelector.jsx';
import { FunnelDetailModal } from '../modals/FunnelDetailModal.jsx';
import { LeadDetailsModal } from '../modals/LeadDetailsModal.jsx';

// ==========================================
// VISÃO GERAL (DASHBOARD) - PATCH 1 (AULA E VISITA)
// ==========================================
// ==========================================
// DASHBOARD — DESIGN PRIMITIVES
// ==========================================
// Extended color tones for dashboard (adds brand/emerald/slate vs Meta Diária's set).
// Uses `text-*` for stroke so SVG `stroke="currentColor"` resolves cleanly.
const DASH_TONES = {
  brand:   { dot: 'bg-brand-600',   strong: 'bg-brand-600',   stroke: 'text-brand-600',   text: 'text-brand-700',   soft: 'bg-brand-50',   darkText: 'dark:text-brand-300',   darkSoft: 'dark:bg-brand-500/10' },
  amber:   { dot: 'bg-amber-500',   strong: 'bg-amber-500',   stroke: 'text-amber-500',   text: 'text-amber-700',   soft: 'bg-amber-50',   darkText: 'dark:text-amber-300',   darkSoft: 'dark:bg-amber-500/10' },
  violet:  { dot: 'bg-violet-500',  strong: 'bg-violet-500',  stroke: 'text-violet-500',  text: 'text-violet-700',  soft: 'bg-violet-50',  darkText: 'dark:text-violet-300',  darkSoft: 'dark:bg-violet-500/10' },
  emerald: { dot: 'bg-emerald-500', strong: 'bg-emerald-500', stroke: 'text-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', darkText: 'dark:text-emerald-300', darkSoft: 'dark:bg-emerald-500/10' },
  rose:    { dot: 'bg-rose-500',    strong: 'bg-rose-500',    stroke: 'text-rose-500',    text: 'text-rose-700',    soft: 'bg-rose-50',    darkText: 'dark:text-rose-300',    darkSoft: 'dark:bg-rose-500/10' },
  teal:    { dot: 'bg-teal-500',    strong: 'bg-teal-500',    stroke: 'text-teal-500',    text: 'text-teal-700',    soft: 'bg-teal-50',    darkText: 'dark:text-teal-300',    darkSoft: 'dark:bg-teal-500/10' },
  slate:   { dot: 'bg-slate-400',   strong: 'bg-slate-400',   stroke: 'text-slate-400',   text: 'text-slate-700',   soft: 'bg-slate-100',  darkText: 'dark:text-slate-300',   darkSoft: 'dark:bg-white/[0.05]' }
};

function DashCard({ title, hint, icon, action, children, padded = true }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      {title && (
        <header className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="w-7 h-7 rounded-md grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold whitespace-nowrap">{title}</h3>
              {hint && <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{hint}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

function DashSparkline({ data, accent = 'brand', height = 42 }) {
  const w = 120;
  const h = height;
  const p = 3;
  const safeData = (data && data.length > 0) ? data : [0];
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const stepX = safeData.length > 1 ? (w - p * 2) / (safeData.length - 1) : 0;
  const pts = safeData.map((v, i) => [p + i * stepX, h - p - ((v - min) / range) * (h - p * 2)]);
  const path = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join(' ');
  const area = path + ` L${(w - p).toFixed(1)},${(h - p).toFixed(1)} L${p.toFixed(1)},${(h - p).toFixed(1)} Z`;
  const t = DASH_TONES[accent] || DASH_TONES.brand;
  const gradId = useMemo(() => `g-${accent}-${Math.random().toString(36).slice(2, 7)}`, [accent]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${t.stroke}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" stroke="currentColor" strokeWidth="1.5" fill="white" />
      )}
    </svg>
  );
}

// Ícone "?" com tooltip on hover/focus. Acessível via teclado (Tab),
// fecha ao tirar o foco. Tooltip aparece acima do ícone, alinhado ao
// canto esquerdo do próprio ícone para evitar sair do viewport quando
// o card está colado na borda direita. Largura fixa para texto longo
// quebrar bonito.
function DashHelpTip({ text, label = 'O que isso significa?' }) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={label}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition cursor-help peer"
      >
        <HelpCircle size={12} strokeWidth={2.2} />
      </button>
      <span
        role="tooltip"
        // whitespace-normal/break-words: o pai do tooltip tem
        // whitespace-nowrap (label do KPI não pode quebrar). Como
        // white-space é HERDADO, sem override o texto do balão sai
        // numa linha só e o bg fica preso aos 280px declarados,
        // vazando o texto.
        className="pointer-events-none absolute left-0 bottom-full mb-2 z-40 w-72 p-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11.5px] leading-relaxed font-normal whitespace-normal break-words shadow-xl opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 peer-focus-visible:opacity-100 peer-focus-visible:translate-y-0 transition duration-150"
      >
        {text}
        <span className="absolute top-full left-3 w-0 h-0 border-[5px] border-transparent border-t-slate-900 dark:border-t-slate-100" />
      </span>
    </span>
  );
}

function DashKpiCard({ label, value, delta, accent = 'brand', series, sub, help }) {
  const up = delta == null ? null : delta >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span>{label}</span>
          {help && <DashHelpTip text={help} label={`O que é "${label}"?`} />}
        </div>
        {delta != null && (
          <span className={`inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-semibold num whitespace-nowrap ${
            up
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          }`}>
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-[32px] font-semibold tracking-tight leading-none">{value}</span>
      </div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap truncate">
        {sub || 'vs. período anterior'}
      </div>
      {series && series.length > 0 && (
        <div className="mt-3 -mx-1">
          <DashSparkline data={series} accent={accent} height={42} />
        </div>
      )}
    </div>
  );
}

function DashPeriodTabs({ value, onChange }) {
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
          className={`h-8 px-3.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition ${
            value === o.id
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DashFunnel({ steps, onStepClick }) {
  if (!steps || steps.length === 0) return null;
  const max = Math.max(...steps.map((s) => s.count), 1);
  const top = steps[0].count || 0;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const t = DASH_TONES[s.color] || DASH_TONES.brand;
        const widthPct = Math.max(2, (s.count / max) * 100);
        const prev = i > 0 ? steps[i - 1].count : null;
        const conv = prev ? Math.round((s.count / prev) * 100) : 100;
        const drop = prev != null ? prev - s.count : 0;
        const topPct = top > 0 ? Math.round((s.count / top) * 100) : 0;
        const clickable = Boolean(onStepClick);
        return (
          <div
            key={s.id}
            onClick={clickable ? () => onStepClick(s) : undefined}
            className={clickable ? 'cursor-pointer hover:opacity-90 transition' : ''}
          >
            <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.label}</span>
                {s.hint && <span className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate">· {s.hint}</span>}
              </div>
              <div className="flex items-center gap-3 text-[12px] num whitespace-nowrap">
                {i > 0 && drop > 0 && (
                  <span className="text-slate-400 dark:text-slate-500">
                    <span className={conv >= 60 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>{conv}%</span>
                    <span className="mx-1">·</span>
                    <span>−{drop}</span>
                  </span>
                )}
                <span className="font-semibold text-slate-900 dark:text-white">{s.count}</span>
              </div>
            </div>
            <div className="h-9 rounded-lg bg-slate-100 dark:bg-white/[0.04] overflow-hidden flex items-center px-1">
              <div
                className={`h-7 rounded-md ${t.strong} flex items-center px-2.5 text-white text-[12px] font-semibold num`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="opacity-90 whitespace-nowrap">{topPct}% do topo</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function DashRingStat({ value, accent = 'brand', size = 80 }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const t = DASH_TONES[accent] || DASH_TONES.brand;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} stroke="currentColor" className="text-slate-100 dark:text-white/[0.06]" strokeWidth="7" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={R}
          stroke="currentColor"
          className={t.stroke}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * pct) / 100}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="num text-[14px] font-semibold">{pct}%</span>
      </div>
    </div>
  );
}



function DashTeamRow({ row, maxLeads }) {
  return (
    <tr className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{row.name}</span>
              {row.isYou && (
                <span className="text-[10px] font-semibold px-1.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">você</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <span className="num text-[13px] font-semibold text-slate-700 dark:text-slate-200 w-7 text-right">{row.total}</span>
          <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: `${maxLeads > 0 ? (row.total / maxLeads) * 100 : 0}%` }}></div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.agendadosVisita}</td>
      <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.agendadosAula}</td>
      <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{row.convertidos}</td>
      {/* Execução: Meta Diária e prospecção — HOJE em cima, MÊS embaixo.
          Mesma régua da tela Meta/painel da Equipe. "—" = sem tarefas/régua off. */}
      <td className="py-3 px-3 text-center">
        {!row.today || row.today.goalTotal === 0 ? (
          <span className="text-[12px] text-muted-foreground" title="Sem tarefas na meta de hoje">—</span>
        ) : row.today.goalDone >= row.today.goalTotal ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle size={11} /> Batida</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 num">{row.today.goalDone} de {row.today.goalTotal}</span>
        )}
        {row.today && row.today.monthDays > 0 && (
          <div className={cn('mt-1 text-[10.5px] num', row.today.monthHits >= row.today.monthDays ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} title="Dias com a meta batida neste mês">
            mês: {row.today.monthHits} de {row.today.monthDays} dias
          </div>
        )}
      </td>
      <td className="py-3 px-3 text-center">
        {!row.today || row.today.volTarget === 0 ? (
          <span className="text-[12px] text-muted-foreground" title="Meta de prospecção desligada para este usuário">—</span>
        ) : (
          <>
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold num', row.today.volTotal >= row.today.volTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
              <Zap size={11} /> {row.today.volTotal} de {row.today.volTarget}
            </span>
            <div className={cn('mt-1 text-[10.5px] num', row.today.monthVol >= row.today.monthVolTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} title="Ações de prospecção acumuladas no mês vs alvo (alvo diário × dias de meta)">
              mês: {row.today.monthVol} de {row.today.monthVolTarget}
            </div>
          </>
        )}
      </td>
      <td className="py-3 pr-5 pl-3 num text-[13px] text-right font-semibold text-slate-900 dark:text-white">
        {row.txConversaoGlobal == null ? (
          <span className="text-slate-400 dark:text-slate-500" title="Sem leads captados no período">—</span>
        ) : `${row.txConversaoGlobal}%`}
      </td>
    </tr>
  );
}

function DashTeamTable({ rows, appUser, goals }) {
  const maxLeads = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full text-left min-w-[780px]">
        <thead>
          <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <th className="py-2.5 pl-5 pr-3 font-semibold">Consultor</th>
            <th className="py-2.5 px-3 font-semibold">Leads</th>
            <th className="py-2.5 px-3 font-semibold text-center">Visitas</th>
            <th className="py-2.5 px-3 font-semibold text-center">Aulas</th>
            <th className="py-2.5 px-3 font-semibold text-center">Matr.</th>
            <th className="py-2.5 px-3 font-semibold text-center" title="Meta Diária: hoje e dias batidos no mês">Meta diária</th>
            <th className="py-2.5 px-3 font-semibold text-center" title="Meta de prospecção: ações de hoje e acumulado do mês">Prospecção</th>
            <th className="py-2.5 pr-5 pl-3 font-semibold text-right">Conv. global</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <DashTeamRow key={r.name + i} row={{ ...r, isYou: r.name === appUser?.name, today: goals?.[r.consultantId] || null }} maxLeads={maxLeads} />
          ))}
        </tbody>
      </table>
    </div>
  );
}


function DashSourceList({ items }) {
  const total = items.reduce((s, x) => s + x.count, 0);
  const palette = ['brand', 'rose', 'emerald', 'teal', 'amber', 'slate'];
  return (
    <div className="space-y-3">
      {items.map((s, i) => {
        const t = DASH_TONES[s.color || palette[i % palette.length]] || DASH_TONES.slate;
        const pct = total ? Math.round((s.count / total) * 100) : 0;
        return (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200 whitespace-nowrap">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                <span className="font-medium truncate max-w-[140px]">{s.name}</span>
              </div>
              <div className="num text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span className="font-semibold text-slate-900 dark:text-white">{s.count}</span>
                <span className="mx-1 opacity-50">·</span>
                <span>{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
              <div className={`h-full ${t.strong}`} style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-[12px] text-slate-400 dark:text-slate-500 italic py-2">Nenhum dado captado no período.</p>
      )}
    </div>
  );
}

function DashTaskItem({ lead, onClick }) {
  const apptDate = getLeadAppointmentDate(lead) || lead.nextFollowUp;
  const apptType = getLeadAppointmentType(lead);
  const isOverdue = apptDate && apptDate < new Date();
  const when = apptDate ? `${apptDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${formatHourLabel(apptDate)}` : '';
  const TypeIcon = apptType === 'visita' || apptType === 'aula_experimental' ? Calendar : Phone;
  return (
    <div
      onClick={() => onClick && onClick(lead)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-slate-200/70 dark:border-white/[0.05] hover:border-slate-300 dark:hover:border-white/10 transition cursor-pointer"
    >
      <Avatar name={lead.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[13px] truncate">{lead.name}</span>
          {isOverdue && (
            <span className="text-[10px] font-semibold px-1.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 whitespace-nowrap">atrasado</span>
          )}
        </div>
        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num">{lead.whatsapp}</div>
      </div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap inline-flex items-center gap-1 shrink-0">
        <TypeIcon size={12} />
        {when}
      </div>
    </div>
  );
}

function DashActivityRow({ item }) {
  const t = DASH_TONES[item.tone] || DASH_TONES.slate;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`mt-0.5 w-2 h-2 rounded-full ${t.dot} ring-4 ring-white dark:ring-ink-900 shrink-0`}></div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-slate-700 dark:text-slate-200 leading-snug">
          <span className="font-semibold text-slate-900 dark:text-white">{item.who}</span>
          <span className="text-slate-500 dark:text-slate-400"> {item.what} </span>
          <span className="font-medium">{item.who2}</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 num mt-0.5">{item.when}</div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
function DashboardView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const [periodPreset, setPeriodPreset] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [funnelDetail, setFunnelDetail] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const hasFunnels = (funnels || []).length > 0;
  const currentFunnel = useMemo(
    () => (funnels || []).find(f => f.id === selectedFunnelId) || null,
    [funnels, selectedFunnelId]
  );
  const funnelLeads = useMemo(() => {
    if (isAllFunnels(selectedFunnelId)) return leads || [];
    return (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId));
  }, [leads, selectedFunnelId, defaultFunnelId]);

 const periodRange = useMemo(() => {
  const now = new Date();

  if (periodPreset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (periodPreset === 'weekly') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // semana iniciando na segunda
    start.setDate(start.getDate() + diff);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (periodPreset === 'custom') {
    if (!customStartDate || !customEndDate) return null;

    const start = new Date(`${customStartDate}T00:00:00`);
    const end = new Date(`${customEndDate}T23:59:59.999`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    return { start, end };
  }

  if (periodPreset === 'monthlyPrev') {
    // Mês civil anterior completo (jan → dez do ano anterior auto-rola
    // pelo construtor Date).
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  // Default: 'monthly' (mês atual).
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}, [periodPreset, customStartDate, customEndDate]);

  const isWithinSelectedRange = (date) => {
    const safeDate = getSafeDateOrNull(date);
    if (!periodRange || !safeDate) return false;
    return safeDate >= periodRange.start && safeDate <= periodRange.end;
  };

  const capturedLeads = useMemo(() => {
    return funnelLeads.filter(l => isWithinSelectedRange(l.createdAt));
  }, [funnelLeads, periodRange]);

  const scheduledLeads = useMemo(() => {
    return funnelLeads.filter(l => {
      const appointmentType = getLeadAppointmentType(l);
      const appointmentDate = getLeadAppointmentDate(l);

      return Boolean(appointmentType && appointmentDate && isWithinSelectedRange(appointmentDate));
    });
  }, [funnelLeads, periodRange]);

  const convertedLeads = useMemo(() => {
    return funnelLeads.filter(l => {
      return isLeadConverted(l) && isWithinSelectedRange(getLeadConversionDate(l));
    });
  }, [funnelLeads, periodRange]);

  // Breakdown de aulas experimentais agendadas por modalidade (no período/funil).
  const aulasPorModalidade = useMemo(() => {
    const map = new Map();
    scheduledLeads.forEach(l => {
      if (getLeadAppointmentType(l) !== 'aula_experimental') return;
      const key = (l.appointmentModality || '').trim() || 'Sem modalidade';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [scheduledLeads]);

  const stats = useMemo(() => {
    const total = capturedLeads.length;

    // Contadores operacionais (eventos cuja DATA caiu no período).
    // Usados como números absolutos nos KPIs e no funil.
    const agendadosVisita = scheduledLeads.filter(
      l => getLeadAppointmentType(l) === 'visita'
    ).length;

    const agendadosAula = scheduledLeads.filter(
      l => getLeadAppointmentType(l) === 'aula_experimental'
    ).length;

    const convertidos = convertedLeads.length;

    const convertidosVisita = convertedLeads.filter(
      l => getLeadAppointmentType(l) === 'visita'
    ).length;

    const convertidosAula = convertedLeads.filter(
      l => getLeadAppointmentType(l) === 'aula_experimental'
    ).length;

    // Taxas calculadas SOBRE A COORTE de captação do período (mesmo
    // denominador e numerador). Evita o paradoxo de mostrar "150% de
    // conversão" quando o numerador vem de uma coorte e o denominador
    // de outra (leads captados em meses anteriores que matricularam
    // agora, etc.).
    const coorteVisita = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'visita' && getLeadAppointmentDate(l)
    ).length;
    const coorteAula = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'aula_experimental' && getLeadAppointmentDate(l)
    ).length;
    const coorteConvertidos = capturedLeads.filter(isLeadConverted).length;
    const coorteConvVisita = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'visita' && isLeadConverted(l)
    ).length;
    const coorteConvAula = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'aula_experimental' && isLeadConverted(l)
    ).length;

    const txAgVisita = total > 0 ? Math.round((coorteVisita / total) * 100) : 0;
    const txAgAula = total > 0 ? Math.round((coorteAula / total) * 100) : 0;
    const txConv = total > 0 ? Math.round((coorteConvertidos / total) * 100) : 0;

    const txConvVisita = coorteVisita > 0 ? Math.round((coorteConvVisita / coorteVisita) * 100) : 0;
    const txConvAula = coorteAula > 0 ? Math.round((coorteConvAula / coorteAula) * 100) : 0;

    return {
      total,
      agendadosVisita,
      agendadosAula,
      convertidos,
      convertidosVisita,
      convertidosAula,
      coorteVisita,
      coorteAula,
      coorteConvertidos,
      txAgVisita,
      txAgAula,
      txConv,
      txConvVisita,
      txConvAula
    };
  }, [capturedLeads, scheduledLeads, convertedLeads]);

  const pendingFollowUps = useMemo(() => {
    return funnelLeads
      .filter(
        l =>
          l.status !== 'Venda' &&
          l.status !== 'Perda' &&
          l.nextFollowUp instanceof Date &&
          !isNaN(l.nextFollowUp.getTime())
      )
      .sort((a, b) => a.nextFollowUp.getTime() - b.nextFollowUp.getTime());
  }, [funnelLeads]);

const teamMetrics = useMemo(() => {
  const metrics = {};

  const ensureConsultant = (lead) => {
    const cId = lead.consultantId || 'unassigned';

    if (!metrics[cId]) {
      metrics[cId] = {
        consultantId: cId, // p/ cruzar com a meta/volume de HOJE no card
        name: lead.consultantName || 'Desconhecido',
        total: 0,
        agendadosVisita: 0,
        agendadosAula: 0,
        convertidos: 0,
        convertidosVisita: 0,
        convertidosAula: 0,
        txVisita: 0,
        txAula: 0,
        txConvVisita: 0,
        txConvAula: 0,
        txConversaoGlobal: 0
      };
    }

    return cId;
  };

  [...capturedLeads, ...scheduledLeads, ...convertedLeads].forEach(ensureConsultant);

  capturedLeads.forEach(l => {
    const cId = ensureConsultant(l);
    metrics[cId].total += 1;
  });

  scheduledLeads.forEach(l => {
    const cId = ensureConsultant(l);
    const type = getLeadAppointmentType(l);

    if (type === 'visita') metrics[cId].agendadosVisita += 1;
    if (type === 'aula_experimental') metrics[cId].agendadosAula += 1;
  });

  convertedLeads.forEach(l => {
    const cId = ensureConsultant(l);
    const type = getLeadAppointmentType(l);

    metrics[cId].convertidos += 1;

    if (type === 'visita') metrics[cId].convertidosVisita += 1;
    if (type === 'aula_experimental') metrics[cId].convertidosAula += 1;
  });

  Object.values(metrics).forEach(m => {
    // null quando não há coorte de captação no período — evita
    // mostrar "0%" para consultor que fechou leads captados antes.
    m.txVisita = m.total > 0 ? Math.round((m.agendadosVisita / m.total) * 100) : null;
    m.txAula = m.total > 0 ? Math.round((m.agendadosAula / m.total) * 100) : null;
    m.txConvVisita = m.agendadosVisita > 0 ? Math.round((m.convertidosVisita / m.agendadosVisita) * 100) : null;
    m.txConvAula = m.agendadosAula > 0 ? Math.round((m.convertidosAula / m.agendadosAula) * 100) : null;
    m.txConversaoGlobal = m.total > 0 ? Math.round((m.convertidos / m.total) * 100) : null;
  });

  return Object.values(metrics).sort(
    (a, b) => b.convertidos - a.convertidos || b.total - a.total
  );
}, [capturedLeads, scheduledLeads, convertedLeads]);
  // Meta de HOJE + prospecção (dia e MÊS) por consultor — mesma régua da Meta
  // Diária e do painel da Equipe (lib compartilhada). Usa a base CRUA (não a
  // janela de período do dashboard): a leitura de cobrança é do dia/mês corrente.
  const { metaWeekdays = [1, 2, 3, 4, 5], dailyVolumeTarget = 0 } = useGeneralConfig();

  // Histórico de metas batidas da equipe (admin lê todos — mesma regra usada
  // pelo painel da Equipe) p/ o "X de Y dias" do mês.
  const [teamHistory, setTeamHistory] = useState([]);
  useEffect(() => {
    if (!isAdminUser(appUser)) return undefined;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH),
      (snap) => setTeamHistory(snap.docs.map((d) => d.data())),
      (e) => console.error('dash team history', e)
    );
    return () => unsub();
  }, [db, appUser]);

  const goalByConsultant = useMemo(() => {
    if (!isAdminUser(appUser)) return {};
    const byLead = buildInteractionsByLead(interactions);
    const monthDays = countMetaDaysInMonth(metaWeekdays);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthPrefix = dgDateKey(new Date()).slice(0, 7); // 'YYYY-MM'
    const map = {};
    (usersList || []).forEach((u) => {
      const { totalSlots, doneSlots } = slotTotals(computeDailyGoalSlots(leads, byLead, u.id));
      const volTarget = volumeTargetFor(u, dailyVolumeTarget);
      const vol = volTarget > 0 ? computeDailyVolume(leads, interactions, u.id, u.authUid) : null;
      const monthVol = volTarget > 0 ? computeVolumeInRange(leads, interactions, u.id, u.authUid, monthStart, null, metaWeekdays) : null;
      // Só dias PROGRAMADOS da meta contam no "X de Y dias" do mês (mesma régua
      // do alvo monthDays) — meta batida em dia fora da meta (ex.: sábado) não entra.
      const monthHits = teamHistory.filter((h) => {
        if (h.consultantId !== u.id) return false;
        const ds = String(h.date || '');
        if (!ds.startsWith(monthPrefix)) return false;
        const [yy, mm, dd] = ds.split('-').map(Number);
        return Boolean(yy && mm && dd) && (metaWeekdays || []).includes(new Date(yy, mm - 1, dd).getDay());
      }).length;
      map[u.id] = {
        goalDone: doneSlots, goalTotal: totalSlots,
        volTotal: vol?.total || 0, volTarget,
        monthHits, monthDays,
        monthVol: monthVol?.total || 0, monthVolTarget: volTarget * monthDays,
      };
    });
    return map;
  }, [appUser, usersList, leads, interactions, metaWeekdays, dailyVolumeTarget, teamHistory]);

  const sourceMetrics = useMemo(() => {
    const metrics = {};
    capturedLeads.forEach(l => {
      const src = l.source || 'Desconhecida';
      metrics[src] = (metrics[src] || 0) + 1;
    });

    return Object.entries(metrics)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [capturedLeads]);

  // --- TABELA "MÉTRICAS POR FUNIL" (modo Geral) ---
  // Agnóstica de etapas: cada linha agrega leads/visitas/aulas/matrículas/taxa
  // usando os mesmos campos usados pelos KPIs globais. Funcione para qualquer
  // funil criado pelo usuário (ou por tenants futuros).
  const funnelComparisonRows = useMemo(() => {
    if (!isAllFunnels(selectedFunnelId)) return [];
    if (!Array.isArray(funnels) || funnels.length === 0) return [];

    const rows = funnels.map(funnel => {
      const scope = (leads || []).filter(l => isItemInFunnel(l, funnel.id, defaultFunnelId));
      const captured = scope.filter(l => isWithinSelectedRange(l.createdAt));
      const visits = scope.filter(l => {
        const t = getLeadAppointmentType(l);
        const d = getLeadAppointmentDate(l);
        return t === 'visita' && d && isWithinSelectedRange(d);
      });
      const classes = scope.filter(l => {
        const t = getLeadAppointmentType(l);
        const d = getLeadAppointmentDate(l);
        return t === 'aula_experimental' && d && isWithinSelectedRange(d);
      });
      const converted = scope.filter(l => isLeadConverted(l) && isWithinSelectedRange(getLeadConversionDate(l)));
      const rate = captured.length > 0 ? Math.round((converted.length / captured.length) * 100) : 0;
      return {
        funnel,
        captured: captured.length,
        visits: visits.length,
        classes: classes.length,
        converted: converted.length,
        rate
      };
    });

    // Ordenação: matrículas DESC → leads DESC → ordem de criação ASC (tie-break)
    rows.sort((a, b) => {
      if (b.converted !== a.converted) return b.converted - a.converted;
      if (b.captured !== a.captured) return b.captured - a.captured;
      return (a.funnel.order || 0) - (b.funnel.order || 0);
    });

    return rows;
  }, [selectedFunnelId, leads, funnels, defaultFunnelId, periodRange]);

  // Totais da tabela. Taxa é recalculada do agregado (não média de rates) — Simpson's paradox.
  const funnelComparisonTotals = useMemo(() => {
    if (funnelComparisonRows.length === 0) return null;
    const sum = funnelComparisonRows.reduce((acc, r) => ({
      captured: acc.captured + r.captured,
      visits: acc.visits + r.visits,
      classes: acc.classes + r.classes,
      converted: acc.converted + r.converted
    }), { captured: 0, visits: 0, classes: 0, converted: 0 });
    const rate = sum.captured > 0 ? Math.round((sum.converted / sum.captured) * 100) : 0;
    return { ...sum, rate };
  }, [funnelComparisonRows]);

  // --- NEW DASHBOARD COMPUTATIONS ---

  // Taxa de comparecimento: numerador e denominador SAEM DA MESMA BASE
  // — apenas agendamentos cuja data já passou. Contar comparecimento
  // sobre todos os agendados (incluindo futuros já marcados como
  // atendidos, ex.: lead que virou Venda antes da aula marcada) inflava
  // o numerador e a taxa podia passar de 100% ("2 compareceram / 1
  // realizado"). Agendamentos futuros entram só como "+N futuros".
  const { compareceram, apptPassados } = useMemo(() => {
    const now = new Date();
    const passados = scheduledLeads.filter(l => {
      const t = getLeadAppointmentType(l);
      const d = getLeadAppointmentDate(l);
      return (t === 'visita' || t === 'aula_experimental') && d && d <= now;
    });
    return {
      compareceram: passados.filter(isLeadAttended).length,
      apptPassados: passados.length
    };
  }, [scheduledLeads]);
  const totalAppt = stats.agendadosVisita + stats.agendadosAula;
  const taxaComp = apptPassados > 0 ? Math.round((compareceram / apptPassados) * 100) : 0;

  // Série diária dos sparklines. Quando o período já TERMINOU (ex.: "Mês
  // anterior"), o gráfico acompanha o próprio período — mostra a
  // distribuição dia a dia do que compõe cada KPI naquele intervalo.
  // Quando o período inclui hoje (Hoje/Semana/Mês atual), mostra os
  // últimos 14 dias até hoje: tendência recente "cheia", sem a zona
  // morta dos dias que ainda não chegaram.
  const sparklines = useMemo(() => {
    const DAY = 86400000;
    let firstDay, nDays;
    if (periodRange && periodRange.end < new Date()) {
      const start = new Date(periodRange.start); start.setHours(0, 0, 0, 0);
      const end = new Date(periodRange.end); end.setHours(0, 0, 0, 0);
      nDays = Math.round((end - start) / DAY) + 1;
      firstDay = start;
    } else {
      firstDay = new Date(); firstDay.setHours(0, 0, 0, 0);
      firstDay.setDate(firstDay.getDate() - 13);
      nDays = 14;
    }

    const series = { leads: [], visitas: [], aulas: [], matriculas: [] };
    for (let i = 0; i < nDays; i++) {
      const dayStart = new Date(firstDay);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const inDay = (d) => d && d >= dayStart && d <= dayEnd;

      series.leads.push(funnelLeads.filter((l) => inDay(l.createdAt)).length);
      series.visitas.push(funnelLeads.filter((l) => getLeadAppointmentType(l) === 'visita' && inDay(getLeadAppointmentDate(l))).length);
      series.aulas.push(funnelLeads.filter((l) => getLeadAppointmentType(l) === 'aula_experimental' && inDay(getLeadAppointmentDate(l))).length);
      series.matriculas.push(funnelLeads.filter((l) => isLeadConverted(l) && inDay(getLeadConversionDate(l))).length);
    }
    return series;
  }, [funnelLeads, periodRange]);

  // Período equivalente anterior usado nos deltas (▲▼ dos KPIs).
  // Calculado por PRESET (não por span em ms) para casar com o
  // calendário civil: "Mês" vira mês civil anterior completo, etc.
  // — assim a comparação não desliza pelos meses de 28/30/31 dias.
  const previousRange = useMemo(() => {
    if (!periodRange) return null;

    if (periodPreset === 'today') {
      // Ontem inteiro.
      const start = new Date(periodRange.start);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (periodPreset === 'weekly') {
      // Semana anterior (seg-dom).
      const start = new Date(periodRange.start);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (periodPreset === 'monthly' || periodPreset === 'monthlyPrev') {
      // Sempre o mês civil completo IMEDIATAMENTE ANTES do mês exibido:
      // - 'monthly'     (mês atual)    → previous = mês passado
      // - 'monthlyPrev' (mês passado)  → previous = mês retrasado
      // jan→dez do ano anterior auto-rola pelo construtor Date.
      const y = periodRange.start.getFullYear();
      const m = periodRange.start.getMonth();
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      return { start, end };
    }

    // 'custom' — janela de mesma duração imediatamente antes (sem
    // alternativa civil razoável quando o usuário escolheu datas
    // arbitrárias).
    const span = periodRange.end - periodRange.start;
    const start = new Date(periodRange.start.getTime() - span - 1);
    const end = new Date(periodRange.start.getTime() - 1);
    return { start, end };
  }, [periodPreset, periodRange]);

  // Delta % vs período anterior equivalente.
  const deltas = useMemo(() => {
    if (!previousRange) return { leads: null, visitas: null, aulas: null, matriculas: null };
    const within = (d) => d && d >= previousRange.start && d <= previousRange.end;

    const prevLeads = funnelLeads.filter((l) => within(l.createdAt)).length;
    const prevVisitas = funnelLeads.filter((l) => getLeadAppointmentType(l) === 'visita' && within(getLeadAppointmentDate(l))).length;
    const prevAulas = funnelLeads.filter((l) => getLeadAppointmentType(l) === 'aula_experimental' && within(getLeadAppointmentDate(l))).length;
    const prevMatriculas = funnelLeads.filter((l) => isLeadConverted(l) && within(getLeadConversionDate(l))).length;

    const pct = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : null));
    return {
      leads: pct(stats.total, prevLeads),
      visitas: pct(stats.agendadosVisita, prevVisitas),
      aulas: pct(stats.agendadosAula, prevAulas),
      matriculas: pct(stats.convertidos, prevMatriculas)
    };
  }, [funnelLeads, previousRange, stats]);

  // Activity feed: last 5 interactions in period, mapped to a UI shape.
  // Filtra por funnelLeads para respeitar o filtro de funil selecionado
  // — o restante do Dashboard já filtra; o feed precisa acompanhar.
  const activityFeed = useMemo(() => {
    if (!periodRange) return [];
    const leadById = new Map(funnelLeads.map((l) => [l.id, l]));
    const myAuthUid = appUser?.authUid || appUser?.id || null;
    return (interactions || [])
      .filter((i) => leadById.has(i.leadId))
      .filter((i) => i.createdAt instanceof Date && i.createdAt >= periodRange.start && i.createdAt <= periodRange.end)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
      .map((i) => {
        const lead = leadById.get(i.leadId);
        const isYou =
          myAuthUid &&
          (i.consultantAuthUid === myAuthUid || i.leadConsultantAuthUid === myAuthUid || i.consultantName === appUser?.name);
        const who = isYou ? 'Você' : (i.consultantName || 'Sistema');
        let what = 'registrou atividade em';
        let tone = 'slate';
        const txt = String(i.text || '');
        if (i.type === 'daily_goal_done') {
          if (i.appointmentOutcome === 'attended' || /compareceu/i.test(txt)) {
            what = 'marcou comparecimento de'; tone = 'emerald';
          } else if (i.appointmentOutcome === 'no_show' || /não veio/i.test(txt)) {
            what = 'marcou Não veio de'; tone = 'rose';
          } else if (i.appointmentOutcome === 'rescheduled' || /remarc/i.test(txt)) {
            what = 'remarcou'; tone = 'amber';
          } else if (i.appointmentOutcome === 'cancelled' || /cancelou/i.test(txt)) {
            what = 'cancelou agendamento de'; tone = 'slate';
          } else {
            what = 'concluiu tarefa de'; tone = 'brand';
          }
        } else if (i.type === 'status_change') {
          if (lead?.status === 'Venda' || /matrícul/i.test(txt)) {
            what = 'fechou matrícula de'; tone = 'emerald';
          } else if (lead?.status === 'Perda' || /perd/i.test(txt)) {
            what = 'registrou perda de'; tone = 'rose';
          } else if (/agendou|retorno agendado/i.test(txt)) {
            what = 'agendou retorno para'; tone = 'violet';
          } else {
            what = 'atualizou fase de'; tone = 'amber';
          }
        } else if (i.type === 'note') {
          if (isRegistrationNote(txt)) {
            what = 'cadastrou'; tone = 'brand';
          } else {
            what = 'anotou em'; tone = 'slate';
          }
        }
        return {
          id: i.id,
          who,
          what,
          who2: lead?.name || 'lead',
          when: humanizeAge(i.createdAt, new Date()),
          tone
        };
      });
  }, [interactions, funnelLeads, periodRange, appUser]);

  // Human-friendly period label for the hero.
  const periodLabel = useMemo(() => {
    if (!periodRange) return '—';
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const sameDay = periodRange.start.toDateString() === periodRange.end.toDateString();
    if (sameDay) return periodRange.start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    return `${fmt(periodRange.start)} – ${fmt(periodRange.end)}`;
  }, [periodRange]);

  const firstName = (appUser?.name || '').split(' ')[0] || 'consultor';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // Listas da COORTE de captação (mesma base das taxas e do funil).
  // O funil exibe a jornada dos leads que CAPTAMOS no período — então
  // cada etapa filtra capturedLeads, garantindo monotonicidade
  // (etapa N ≤ etapa N-1) e taxas entre etapas ≤ 100%.
  const coorteAgendamentoLeads = useMemo(
    () => capturedLeads.filter(l => {
      const t = getLeadAppointmentType(l);
      return (t === 'visita' || t === 'aula_experimental') && getLeadAppointmentDate(l);
    }),
    [capturedLeads]
  );
  const coorteCompareceramLeads = useMemo(
    () => coorteAgendamentoLeads.filter(l => isLeadAttended(l)),
    [coorteAgendamentoLeads]
  );
  const coorteMatriculaLeads = useMemo(
    () => capturedLeads.filter(isLeadConverted),
    [capturedLeads]
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ---- Hero ---- */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <LayoutDashboard size={13} className="text-brand-600" /> Dashboard
          </div>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-tight leading-tight">
            {greeting}, {firstName}. <span className="text-slate-500 dark:text-slate-400 font-medium">Aqui está o panorama do período.</span>
          </h2>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            Período: <span className="font-medium text-slate-700 dark:text-slate-200">{periodLabel}</span> · <span className="num">{stats.total}</span> {stats.total === 1 ? 'lead' : 'leads'} · taxa de conversão global <span className="font-medium text-emerald-600 dark:text-emerald-400 num">{stats.txConv}%</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasFunnels && (
            <FunnelSelector
              funnels={funnels}
              value={selectedFunnelId}
              onChange={setSelectedFunnelId}
              allowAll={true}
              className="w-full sm:w-[220px]"
            />
          )}
          <DashPeriodTabs value={periodPreset} onChange={setPeriodPreset} />
        </div>
      </section>

      {periodPreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-card">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Período personalizado</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[13px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <span className="text-slate-400 text-[12.5px] font-medium">até</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[13px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          {!periodRange && (
            <span className="text-[11.5px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
              Preencha início e fim para ver os resultados.
            </span>
          )}
        </div>
      )}

      {/* ---- Primary KPIs ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashKpiCard
          label="Leads captados"
          value={stats.total}
          delta={deltas.leads}
          accent="brand"
          series={sparklines.leads}
          help="Leads novos que chegaram no período, contados pelo dia em que foram cadastrados. O gráfico mostra a evolução dia a dia."
        />
        <DashKpiCard
          label="Visitas agendadas"
          value={stats.agendadosVisita}
          delta={deltas.visitas}
          accent="amber"
          series={sparklines.visitas}
          sub={`${stats.txAgVisita}% dos leads · ${stats.txConvVisita}% conv.`}
          help="Visitas marcadas para o período — inclui leads que chegaram antes. Abaixo: de cada 100 leads que chegaram no período, quantos marcaram visita e, desses, quantos viraram matrícula."
        />
        <DashKpiCard
          label="Aulas experimentais"
          value={stats.agendadosAula}
          delta={deltas.aulas}
          accent="violet"
          series={sparklines.aulas}
          sub={`${stats.txAgAula}% dos leads · ${stats.txConvAula}% conv.`}
          help="Aulas experimentais marcadas para o período — inclui leads que chegaram antes. Abaixo: de cada 100 leads que chegaram no período, quantos marcaram aula e, desses, quantos viraram matrícula."
        />
        <DashKpiCard
          label="Matrículas"
          value={stats.convertidos}
          delta={deltas.matriculas}
          accent="emerald"
          series={sparklines.matriculas}
          sub={`${stats.txConv}% fechamento geral`}
          help="Leads que fecharam matrícula no período — inclui quem chegou em meses anteriores e fechou agora. Abaixo: dos leads que chegaram neste período, quantos por cento já se matricularam."
        />
      </div>

      {/* ---- Secondary KPIs ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span>Taxa de comparecimento</span>
                <DashHelpTip
                  label="O que é Taxa de comparecimento?"
                  text="Das visitas e aulas cuja data já passou, em quantas o lead realmente apareceu. Os agendamentos que ainda vão acontecer aparecem como 'futuros' e não entram na conta — assim a taxa não fica baixa à toa no começo do período."
                />
              </div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{taxaComp}%</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span className="num font-medium text-slate-700 dark:text-slate-200">{compareceram}</span> {compareceram === 1 ? 'compareceu' : 'compareceram'} / <span className="num">{apptPassados}</span> {apptPassados === 1 ? 'já realizado' : 'já realizados'}
                {totalAppt > apptPassados && (
                  <> · <span className="num text-slate-400">+{totalAppt - apptPassados} {(totalAppt - apptPassados) === 1 ? 'futuro' : 'futuros'}</span></>
                )}
              </div>
            </div>
            <DashRingStat value={taxaComp} accent="teal" />
          </div>
        </DashCard>

        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span>Conversão global</span>
                <DashHelpTip
                  label="O que é Conversão global?"
                  text="Dos leads que chegaram no período, quantos por cento já viraram matrícula. Esse número costuma começar baixo e ir subindo conforme você trabalha cada lead."
                />
              </div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{stats.txConv}%</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                lead → matrícula · <span className="num">{stats.coorteConvertidos}</span> de <span className="num">{stats.total}</span> {stats.total === 1 ? 'captado' : 'captados'}
              </div>
            </div>
            <DashRingStat value={stats.txConv} accent="emerald" />
          </div>
        </DashCard>
      </div>

      {/* ---- Main grid ---- */}
      <div className="grid grid-cols-12 gap-4">

        {/* LEFT — funnel + tables */}
        <div className="col-span-12 xl:col-span-8 space-y-4">

          <DashCard
            title={isAllFunnels(selectedFunnelId)
              ? 'Funil comercial · todos os funis'
              : currentFunnel?.name ? `Funil · ${currentFunnel.name}` : 'Funil comercial'}
            hint="Jornada dos leads captados no período · clique para ver os leads"
            icon={<Filter size={14} />}
          >
            <DashFunnel
              steps={[
                { id: 'leads',  label: 'Leads recebidos', count: stats.total, color: 'brand' },
                { id: 'agend',  label: 'Agendamentos',    count: stats.coorteVisita + stats.coorteAula, color: 'amber',  hint: `${stats.coorteVisita} ${stats.coorteVisita === 1 ? 'visita' : 'visitas'} · ${stats.coorteAula} ${stats.coorteAula === 1 ? 'aula exp.' : 'aulas exp.'}` },
                { id: 'comp',   label: 'Compareceram',    count: coorteCompareceramLeads.length, color: 'teal' },
                { id: 'matric', label: 'Matrículas',      count: stats.coorteConvertidos, color: 'emerald' }
              ]}
              onStepClick={(s) => {
                if (s.id === 'leads')  setFunnelDetail({ title: 'Leads Recebidos', data: capturedLeads });
                if (s.id === 'agend')  setFunnelDetail({ title: 'Agendamentos',    data: coorteAgendamentoLeads });
                if (s.id === 'comp')   setFunnelDetail({ title: 'Compareceram',    data: coorteCompareceramLeads });
                if (s.id === 'matric') setFunnelDetail({ title: 'Matrículas',      data: coorteMatriculaLeads });
              }}
            />
          </DashCard>

          {aulasPorModalidade.length > 0 && (
            <DashCard
              title="Aulas experimentais por modalidade"
              hint="Distribuição das aulas agendadas no período"
              icon={<Dumbbell size={14} />}
            >
              <div className="space-y-2.5">
                {(() => {
                  const max = aulasPorModalidade.reduce((m, x) => Math.max(m, x.count), 0) || 1;
                  const total = aulasPorModalidade.reduce((s, x) => s + x.count, 0) || 1;
                  return aulasPorModalidade.map(({ name, count }) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 w-32 shrink-0 truncate">{name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${max > 0 ? Math.round((count / max) * 100) : 0}%` }} />
                      </div>
                      <span className="num text-[12px] text-slate-500 dark:text-slate-400 w-9 text-right whitespace-nowrap">{total > 0 ? Math.round((count / total) * 100) : 0}%</span>
                      <span className="num text-[13px] font-semibold text-slate-800 dark:text-slate-100 w-7 text-right">{count}</span>
                    </div>
                  ));
                })()}
              </div>
            </DashCard>
          )}

          {isAllFunnels(selectedFunnelId) && funnels.length > 1 && (
            <DashCard
              title="Métricas por funil"
              hint="Comparativo no período selecionado"
              icon={<Kanban size={14} />}
              padded={false}
            >
              <div className="overflow-x-auto thin-scroll">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="py-2.5 pl-5 pr-3 font-semibold">Funil</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Leads</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Visitas</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Aulas</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Matr.</th>
                      <th className="py-2.5 pr-5 pl-3 font-semibold text-right">Tx. Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelComparisonRows.map((row) => {
                      const rateTone = row.rate >= 20 ? 'text-emerald-600 dark:text-emerald-400' : row.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
                      return (
                        <tr key={row.funnel.id} className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                          <td className="py-3 pl-5 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelectedFunnelId(row.funnel.id)}
                              className="text-[13px] font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition flex items-center gap-1.5 text-left whitespace-nowrap"
                              title={`Ver Dashboard apenas do funil ${row.funnel.name}`}
                            >
                              {row.funnel.name}
                              {row.funnel.isDefault && (
                                <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Padrão</span>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.captured}</td>
                          <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.visits}</td>
                          <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.classes}</td>
                          <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{row.converted}</td>
                          <td className={`py-3 pr-5 pl-3 num text-[13px] text-right font-semibold ${rateTone}`}>{row.rate}%</td>
                        </tr>
                      );
                    })}
                    {funnelComparisonRows.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-[12px] text-slate-400 italic">Sem dados no período</td>
                      </tr>
                    )}
                  </tbody>
                  {funnelComparisonTotals && funnelComparisonRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td className="py-3 pl-5 pr-3 text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Total</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.captured}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.visits}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.classes}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{funnelComparisonTotals.converted}</td>
                        <td className="py-3 pr-5 pl-3 num text-[13px] text-right font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.rate}%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </DashCard>
          )}

          {isAdminUser(appUser) && (
            <DashCard
              title="Desempenho da equipe"
              hint="Resultados do período · meta e volume de hoje"
              icon={<BarChart3 size={14} />}
              padded={false}
            >
              {teamMetrics.length > 0 ? (
                <DashTeamTable rows={teamMetrics} appUser={appUser} goals={goalByConsultant} />
              ) : (
                <div className="px-5 py-8 text-center text-[12px] text-slate-400 italic">Sem dados no período</div>
              )}
            </DashCard>
          )}

        </div>

        {/* RIGHT — widgets */}
        <div className="col-span-12 xl:col-span-4 space-y-4">

          <DashCard
            title="Canais de aquisição"
            hint={`${stats.total} ${stats.total === 1 ? 'lead' : 'leads'} · top ${Math.min(sourceMetrics.length, 6)}`}
            icon={<Zap size={14} />}
          >
            <DashSourceList items={sourceMetrics.slice(0, 6)} />
          </DashCard>

          <DashCard
            title="Próximos follow-ups"
            hint="Tarefas pendentes"
            icon={<Bell size={14} />}
            action={
              <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 num whitespace-nowrap">{pendingFollowUps.length}</span>
            }
          >
            <div className="space-y-2 max-h-[360px] overflow-y-auto thin-scroll -mx-1 px-1">
              {pendingFollowUps.length === 0 ? (
                <div className="py-8 text-center text-[12.5px] text-slate-400 italic">Tudo em dia.</div>
              ) : (
                pendingFollowUps.map((lead) => (
                  <DashTaskItem key={lead.id} lead={lead} onClick={setSelectedLead} />
                ))
              )}
            </div>
          </DashCard>

          <DashCard
            title="Atividade recente"
            hint="Últimas ações no período"
            icon={<Clock size={14} />}
          >
            {activityFeed.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-slate-400 italic">Sem atividade no período.</div>
            ) : (
              <div className="-my-1">
                {activityFeed.map((a) => <DashActivityRow key={a.id} item={a} />)}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      <footer className="pt-2 pb-2 text-center text-[11.5px] text-slate-400 whitespace-nowrap">
        Atualizado agora · Período: {periodLabel}
      </footer>

      {funnelDetail && <FunnelDetailModal detail={funnelDetail} onClose={() => setFunnelDetail(null)} onLeadClick={(lead) => { setSelectedLead(lead); setFunnelDetail(null); }} />}

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={interactions.filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          usersList={usersList}
          db={db}
          funnels={funnels}
        />
      )}

    </div>
  );
}


function StatCard({ title, value, subtitle, icon }) {
  return <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group hover:border-gray-300 dark:border-neutral-700 transition-all"><div><p className="text-gray-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-widest">{title}</p><p className="text-4xl font-bold text-gray-900 dark:text-white mt-1">{value}</p><p className="text-[10px] text-gray-600 dark:text-neutral-400 font-bold mt-2 uppercase tracking-tighter">{subtitle}</p></div><div className="bg-paper-50 dark:bg-neutral-800 p-5 rounded-2xl border border-gray-200 dark:border-neutral-700 group-hover:scale-110 transition-transform">{icon}</div></div>;
}

function FunnelBar({ label, count, max, color, onClick }) {
  const p = max > 0 ? (count / max) * 100 : 0;
  return <div onClick={onClick} className={onClick ? "cursor-pointer hover:opacity-80 transition-opacity active:scale-95" : ""}><div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-3"><span className="text-gray-500 dark:text-neutral-400">{label}</span><span className="text-gray-900 dark:text-white">{count} ({Math.round(p)}%)</span></div><div className="w-full bg-paper-50 dark:bg-neutral-950 rounded-full h-4 overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-inner"><div className={`h-full rounded-full ${color} transition-all duration-1000 shadow-lg`} style={{ width: `${p}%` }} /></div></div>;
}
export { DashboardView };
