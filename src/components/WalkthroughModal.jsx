import { useMemo, useState } from 'react';
import { Dialog, DialogContent } from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { RingAvatar } from './profile/RingAvatar.jsx';
import { getTone } from '../lib/leadState.js';
import { cn } from '../lib/utils.js';
import {
  WALKTHROUGH_STEPS, walkthroughSeen, markWalkthroughSeen,
} from '../lib/walkthrough.js';
import {
  GraduationCap, ArrowRight, ArrowLeft, Check, HeartPulse, AlertTriangle, Sparkles,
} from 'lucide-react';

// Cartão neutro usado dentro das ilustrações (claro/escuro via tokens).
function MiniCard({ children, className }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card/80 px-3.5 py-3 text-left shadow-sm', className)}>
      {children}
    </div>
  );
}

function SoftChip({ icon, children, toneName }) {
  const t = getTone(toneName);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', t.soft, t.text, t.darkSoft, t.darkText)}>
      {icon} {children}
    </span>
  );
}

// Uma coluna do mini-Kanban (passo "pipeline").
function KanbanCol({ title, hl, cards }) {
  return (
    <div className={cn('flex-1 rounded-lg border p-2', hl ? 'border-brand-500/40 bg-brand-50 dark:bg-brand-500/10' : 'border-border bg-muted/50')}>
      <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className={cn('mb-1 h-4 rounded', hl && i === 0 ? 'bg-brand-500/80' : 'bg-slate-200 dark:bg-white/10')} />
      ))}
    </div>
  );
}

// Ilustração on-brand por passo. O anel de estado (RingAvatar) reaparece com a
// cor do ciclo de vida — azul (lead) → verde (cliente) → âmbar (a vencer).
function StepIllustration({ stepKey }) {
  if (stepKey === 'lead') {
    return (
      <div className="flex flex-col items-center gap-3.5">
        <RingAvatar name="Mariana Alves" size={72} toneName="brand" />
        <MiniCard className="w-[230px]">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">Mariana Alves</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SoftChip icon={<HeartPulse className="size-3" />} toneName="amber">Dor: dores nas costas</SoftChip>
            <SoftChip toneName="brand">Indicação</SoftChip>
          </div>
        </MiniCard>
      </div>
    );
  }

  if (stepKey === 'pipeline') {
    return (
      <div className="flex w-[280px] gap-2">
        <KanbanCol title="Novo" cards={2} />
        <KanbanCol title="Contato" cards={1} hl />
        <KanbanCol title="Visita" cards={1} />
      </div>
    );
  }

  if (stepKey === 'venda') {
    const hex = getTone('emerald').hex;
    return (
      <div className="flex flex-col items-center gap-3.5">
        <div className="relative" style={{ padding: 4 }}>
          <div
            className="flex items-center justify-center rounded-full ring-[2.5px] ring-offset-[3px] ring-offset-white dark:ring-offset-[#0e1326]"
            style={{ '--tw-ring-color': hex, boxShadow: `0 0 0 6px ${hex}66`, width: 72, height: 72, background: `${hex}1a` }}
          >
            <Check className="size-8" style={{ color: hex }} strokeWidth={3} />
          </div>
        </div>
        <MiniCard className="w-[240px]">
          {[['Plano', 'Trimestral'], ['Valor', 'R$ 270,00'], ['Vigência', '3 meses']].map(([k, v], i) => (
            <div key={k} className={cn('flex justify-between text-[12px]', i < 2 && 'mb-2')}>
              <span className="text-muted-foreground">{k}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{v}</span>
            </div>
          ))}
        </MiniCard>
      </div>
    );
  }

  if (stepKey === 'cliente') {
    return (
      <div className="flex flex-col items-center gap-3.5">
        <RingAvatar name="Mariana Alves" size={72} toneName="emerald" />
        <MiniCard className="flex w-[250px] items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white">Mariana Alves</div>
            <div className="text-[11px] text-muted-foreground">Trimestral · vence em 12/09</div>
          </div>
          <SoftChip toneName="emerald">Ativo</SoftChip>
        </MiniCard>
      </div>
    );
  }

  // renovar
  return (
    <div className="flex flex-col items-center gap-3.5">
      <RingAvatar name="Mariana Alves" size={72} toneName="amber" />
      <MiniCard className="w-[255px]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          <div className="text-[12px] text-slate-900 dark:text-white"><span className="font-semibold">Contrato a vencer</span> em 6 dias</div>
        </div>
        <div className="mt-2.5 flex gap-2">
          <span className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-center text-[12px] font-semibold text-white">Renovar</span>
          <span className="flex-1 rounded-lg bg-muted py-1.5 text-center text-[12px] font-semibold text-muted-foreground">Cancelar</span>
        </div>
      </MiniCard>
    </div>
  );
}

// Pop-up de TUTORIAL — carrossel da jornada lead → cliente. Auto-exibido UMA vez
// por usuário (rastreado no localStorage), igual ao "Novidades" (WhatsNewModal).
// Não é reabrível: o ícone do topo abre a central de Tutoriais (TutorialsHubModal).
function WalkthroughModal({ appUser }) {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const autoShow = useMemo(() => {
    if (!appUser?.id || appUser.superAdminOnly) return false;
    return !walkthroughSeen(appUser);
  }, [appUser]);

  const open = autoShow && !dismissed;
  if (!open) return null;

  const total = WALKTHROUGH_STEPS.length;
  const s = WALKTHROUGH_STEPS[step];
  const last = step === total - 1;

  const close = () => {
    markWalkthroughSeen(appUser);
    setDismissed(true);
    setStep(0);
  };
  const next = () => (last ? close() : setStep((v) => v + 1));
  const back = () => setStep((v) => Math.max(0, v - 1));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]" overlayClassName="z-[200]">
        {/* Cabeçalho: eyebrow + contador */}
        <div className="flex items-center justify-between px-6 pt-6">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-600 dark:text-accent-400">
            <GraduationCap size={14} /> {s.eyebrow}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground">{step + 1} de {total}</span>
        </div>

        {/* Palco da ilustração */}
        <div className="mx-6 mt-3 flex min-h-[210px] items-center justify-center rounded-2xl border border-border bg-muted/40 px-4 py-6">
          <StepIllustration stepKey={s.key} />
        </div>

        {/* Texto */}
        <div className="px-7 pt-5 text-center">
          <h3 className="font-display text-[21px] font-bold tracking-tight text-slate-900 dark:text-white">{s.title}</h3>
          <p className="mx-auto mt-2 max-w-[400px] text-[13.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
          {s.tip && (
            <p className="mx-auto mt-3 flex max-w-[420px] items-start gap-1.5 rounded-xl bg-accent-50 px-3 py-2 text-left text-[12px] leading-relaxed text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
              <Sparkles size={13} className="mt-0.5 shrink-0" /> <span>{s.tip}</span>
            </p>
          )}
        </div>

        {/* Trilha clicável (rail) — dobra de barra de progresso */}
        <div className="flex gap-2 px-7 pt-5">
          {WALKTHROUGH_STEPS.map((st, idx) => {
            const on = idx <= step;
            const c = getTone(st.tone).hex;
            return (
              <button
                key={st.key}
                onClick={() => setStep(idx)}
                aria-label={`Ir ao ${st.eyebrow}`}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <span className="h-[5px] w-full rounded-full transition-colors" style={{ background: on ? c : 'rgba(100,116,139,0.25)' }} />
                <span className={cn('text-[10px]', idx === step ? 'font-semibold' : 'text-muted-foreground')} style={idx === step ? { color: c } : undefined}>
                  {st.title.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 px-7 pb-6 pt-5">
          <button onClick={close} className="text-[13px] font-medium text-muted-foreground transition hover:text-slate-700 dark:hover:text-slate-200">
            {last ? 'Fechar' : 'Pular tutorial'}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={back}><ArrowLeft size={15} /> Voltar</Button>
            )}
            <Button onClick={next} className={cn(last && 'bg-emerald-600 hover:bg-emerald-700')}>
              {last ? <>Concluir <Check size={15} /></> : <>Próximo <ArrowRight size={15} /></>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { WalkthroughModal };
