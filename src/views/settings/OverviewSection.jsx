import { useMemo } from 'react';
import {
  AlertCircle, Check, ChevronRight, DollarSign, Dumbbell, Filter,
  Kanban, Tag, ThumbsDown, UserPlus, UserX, ZapOff
} from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { roleOf, ROLES } from '../../lib/acesso.js';
import { useSeatLimits } from '../../hooks/useSeatLimits.js';
import { SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { SettingsBtn } from './settingsBits.jsx';

// Visão geral: responde "o que falta configurar".
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
      className="text-left p-4 rounded-[14px] border border-border bg-card shadow-card transition hover:border-brand-600 hover:shadow-card-lg focus-visible:outline-none focus-visible:anel-foco"
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
    // Só consultor ocupa assento de consultor, a mesma conta do api/_plans.js:
    // o gestor tem vaga própria e o professor não ocupa nenhuma.
    const consultants = (usersList || []).filter(u => roleOf(u) === ROLES.CONSULTOR).length;
    if (!seats || seats.maxConsultants == null) {
      return `${consultants} ${consultants === 1 ? 'consultor cadastrado' : 'consultores cadastrados'}`;
    }
    return `${Math.min(consultants, seats.maxConsultants)} de ${seats.maxConsultants} assentos usados${seats.planName ? ` no plano ${seats.planName}` : ''}`;
  }, [seats, usersList]);

  const doneSteps = setup.steps.filter(st => st.done);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Visão geral"
        hint="O que falta para a operação rodar sem buraco."
      />

      {/* Card de progresso */}
      {/* O ponto de quebra é o do espaço do cartão, e não o da janela: com o trilho ao lado, uma janela de 1100px deixa o cartão com menos de 500px. */}
      <section className="@container rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-7 px-6 py-[22px] flex-wrap @[730px]:flex-nowrap">
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[40px] font-bold tracking-tight leading-none num">{setup.percent}%</span>
              <span className="text-[15px] font-semibold">da operação configurada</span>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-brand-600 to-brand-500"
                style={{ width: `${setup.percent}%` }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground mt-2.5">
              {setup.doneCount} de {setup.total} passos concluídos.
            </p>
          </div>

          <div className="hidden @[730px]:block w-px self-stretch bg-border" />

          <div className="grid grid-cols-3 gap-[22px] w-full @[730px]:w-[340px] shrink-0">
            <Stat value={(usersList || []).length} label="na equipe" />
            <Stat value={(funnels || []).length} label="funis ativos" />
            <Stat value={(leads || []).length} label="leads na base" />
          </div>
        </div>
      </section>

      {/* O que falta */}
      {setup.pendings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display text-[17px] font-bold tracking-tight">O que falta</h3>
            <span className="num text-[12px] font-bold px-2 py-0.5 rounded-full bg-amber-500/[0.14] text-amber-700 dark:text-amber-300">
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

      {/* O que já está pronto e os valores de agora */}
      <section className="rounded-2xl border border-border bg-card shadow-card px-[18px] pt-1.5 pb-2">
        {doneSteps.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-3 text-[13.5px] font-semibold text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:anel-foco [&::-webkit-details-marker]:hidden">
              <Check size={15} className="text-emerald-500" aria-hidden="true" />
              {doneSteps.length === 1 ? '1 passo pronto' : `${doneSteps.length} passos prontos`}
              <ChevronRight size={14} aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            </summary>
            <ul className="flex flex-wrap gap-x-[18px] gap-y-1.5 px-1 pb-3">
              {doneSteps.map(st => (
                <li key={st.id} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-300">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  {st.label}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className={cn('pb-1', doneSteps.length > 0 && 'border-t border-border pt-3')}>
          <h3 className="px-1 pb-1.5 text-[12px] text-muted-foreground">Valores atuais</h3>
          <div className="flex flex-col gap-0.5">
            {setup.values.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => onNavigate(v.section)}
                className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:anel-foco motion-reduce:transition-none"
              >
                <span>{v.label}</span>
                <em className="not-italic text-muted-foreground">{v.value}</em>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Atalhos */}
      <section>
        <h3 className="font-display text-[17px] font-bold tracking-tight mb-3">Atalhos</h3>
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
