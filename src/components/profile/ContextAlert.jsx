import { AlertTriangle, PauseCircle, Ban } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Btn } from '../ui/Btn.jsx';
import { getTone } from '../../lib/leadState.js';

// Faixa de alerta contextual abaixo do header (ref README "2b. Alerta
// contextual"). Recebe o objeto de deriveContextAlert(state) e renderiza null
// quando não há alerta (lead / cliente ativo / vazio).
//
// alert = { tone, icon, title, desc, cta, action, ctaTone }
//  - icon: 'alert' → AlertTriangle · 'pause' → PauseCircle · 'ban' → Ban
//  - ctaTone: 'accent' → laranja · 'brand' → azul

const ICONS = {
  alert: AlertTriangle,
  pause: PauseCircle,
  ban: Ban
};

function ContextAlert({ alert, onAction }) {
  if (!alert) return null;

  const tone = getTone(alert.tone);
  const Icon = ICONS[alert.icon] || AlertTriangle;
  const isAccent = alert.ctaTone === 'accent';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center',
        tone.soft,
        tone.darkSoft
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          tone.text,
          tone.darkText,
          'bg-white/70 dark:bg-white/[0.06]'
        )}
      >
        <Icon size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <div className={cn('text-[13.5px] font-semibold', tone.text, tone.darkText)}>
          {alert.title}
        </div>
        <div className="mt-0.5 text-[12.5px] text-slate-600 dark:text-slate-400">
          {alert.desc}
        </div>
      </div>

      {alert.cta && (
        <Btn
          kind="brand"
          size="sm"
          onClick={() => onAction?.(alert.action)}
          className={cn(
            'shrink-0 self-start sm:self-auto',
            // App Btn não tem kind "accent"; mapeia ctaTone:'accent' → laranja
            // por className. ctaTone:'brand' usa o azul nativo do kind brand.
            isAccent && 'bg-accent-500 hover:bg-accent-600'
          )}
        >
          {alert.cta}
        </Btn>
      )}
    </div>
  );
}

export { ContextAlert };
