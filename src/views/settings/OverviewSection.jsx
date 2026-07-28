import { useMemo } from 'react';
import {
  AlertCircle, Check, CircleDashed, DollarSign, Dumbbell, Filter,
  Kanban, Tag, ThumbsDown, UserPlus, UserX, ZapOff
} from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { useSeatLimits } from '../../hooks/useSeatLimits.js';
import { SettingsBtn } from './settingsBits.jsx';

// Visão geral: responde "o que falta configurar e o que está pedindo atenção".
// Tudo aqui é derivado (src/lib/settingsSetup.js) — nada é armazenado, então a
// tela nunca fica dessincronizada do estado real da academia.

const PENDING_ICONS = {
  'user-x': UserX,
  'zap-off': ZapOff,
  kanban: Kanban,
  filter: Filter,
  'thumbs-down': ThumbsDown,
  dumbbell: Dumbbell,
  'dollar-sign': DollarSign
};

function StepChip({ label, done }) {
  const Icon = done ? Check : CircleDashed;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px]',
      done ? 'text-muted-foreground' : 'font-semibold text-slate-700 dark:text-slate-200'
    )}>
      <Icon size={13} className={done ? 'text-emerald-500' : 'text-amber-500'} />
      {label}
    </span>
  );
}

function Stat({ value, label }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-[22px] font-bold tracking-tight leading-none num">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1.5 truncate">{label}</div>
    </div>
  );
}

function PendingRow({ pending, onAction }) {
  const Icon = PENDING_ICONS[pending.icon] || AlertCircle;
  const amber = pending.tone === 'amber';
  return (
    <div className="flex items-center gap-3 px-[18px] py-3.5 rounded-[14px] border border-border bg-card shadow-card">
      <span className={cn(
        'size-[34px] rounded-[10px] grid place-items-center shrink-0',
        amber
          ? 'bg-amber-500/[0.14] text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
      )}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold leading-tight">{pending.title}</div>
        <div className="text-[12px] text-muted-foreground leading-snug mt-1">{pending.description}</div>
      </div>
      <SettingsBtn
        kind={pending.actionKind === 'primary' ? 'primary' : 'secondary'}
        size={34}
        onClick={() => onAction(pending.section, pending.focusId)}
      >
        {pending.actionLabel}
      </SettingsBtn>
    </div>
  );
}

function ShortcutCard({ icon, title, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-4 rounded-[14px] border border-border bg-card shadow-card transition hover:border-brand-600 hover:shadow-card-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="text-brand-600 dark:text-brand-300 block">{icon}</span>
      <div className="text-[13.5px] font-semibold mt-2.5">{title}</div>
      <div className="text-[11.5px] text-muted-foreground mt-1">{hint}</div>
    </button>
  );
}

function OverviewSection({
  setup, leads, usersList, funnels, tags, sources, slaOverdueDays, onNavigate
}) {
  const seats = useSeatLimits();

  const seatHint = useMemo(() => {
    const consultants = (usersList || []).filter(u => u.role !== 'admin').length;
    if (!seats || seats.maxConsultants == null) {
      return `${consultants} ${consultants === 1 ? 'consultor cadastrado' : 'consultores cadastrados'}`;
    }
    return `${Math.min(consultants, seats.maxConsultants)} de ${seats.maxConsultants} assentos usados${seats.planName ? ` no plano ${seats.planName}` : ''}`;
  }, [seats, usersList]);

  const missing = setup.total - setup.doneCount;

  return (
    <div className="flex flex-col gap-5">
      {/* Card de progresso */}
      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-7 px-6 py-[22px] flex-wrap lg:flex-nowrap">
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[30px] font-bold tracking-tight leading-none num">{setup.percent}%</span>
              <span className="text-[13.5px] font-semibold">da operação configurada</span>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-brand-600 to-brand-500"
                style={{ width: `${setup.percent}%` }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground mt-2.5">
              {setup.doneCount} de {setup.total} passos concluídos
              {missing > 0 && ` · ${missing === 1 ? 'falta 1' : `faltam ${missing}`} para o funil rodar sem buraco.`}
            </p>
          </div>

          <div className="hidden lg:block w-px self-stretch bg-border" />

          <div className="grid grid-cols-3 gap-[22px] lg:w-[340px] shrink-0">
            <Stat value={(usersList || []).length} label="na equipe" />
            <Stat value={(funnels || []).length} label="funis ativos" />
            <Stat value={(leads || []).length} label="leads na base" />
          </div>
        </div>

        <div className="border-t border-border bg-muted/60 px-2.5 py-1.5 flex flex-wrap gap-1">
          {setup.steps.map(s => <StepChip key={s.id} label={s.label} done={s.done} />)}
        </div>
      </section>

      {/* Pedindo atenção */}
      {setup.pendings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Pedindo atenção</h3>
            <span className="num text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/[0.14] text-amber-700 dark:text-amber-300">
              {setup.pendings.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {setup.pendings.map(p => (
              <PendingRow key={p.id} pending={p} onAction={onNavigate} />
            ))}
          </div>
        </section>
      )}

      {/* Ajustes mais mexidos */}
      <section>
        <h3 className="font-display text-[15px] font-bold tracking-tight mb-3">Ajustes mais mexidos</h3>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          <ShortcutCard
            icon={<UserPlus size={17} />}
            title="Cadastrar consultor"
            hint={seatHint}
            onClick={() => onNavigate('team', 'new')}
          />
          <ShortcutCard
            icon={<AlertCircle size={17} />}
            title="Alerta de lead crítico"
            hint={`Hoje: ${slaOverdueDays} ${slaOverdueDays === 1 ? 'dia' : 'dias'} de atraso`}
            onClick={() => onNavigate('pace')}
          />
          <ShortcutCard
            icon={<Tag size={17} />}
            title="Etiquetas e origens"
            hint={`${(tags || []).length} ${(tags || []).length === 1 ? 'etiqueta' : 'etiquetas'} · ${(sources || []).length} ${(sources || []).length === 1 ? 'origem' : 'origens'}`}
            onClick={() => onNavigate('catalogs', 'tags')}
          />
        </div>
      </section>
    </div>
  );
}

export { OverviewSection };
