/* eslint-disable react-refresh/only-export-components -- tokens de cor (OUTCOME_TONE/outcomeButtonClass) moram junto do seletor que os usa; ambos raramente mudam */
import { cn } from '../../lib/utils.js';

// Shell visual compartilhado dos popups de desfecho (design "8b" do handoff):
// o seletor segmentado + os tokens de cor por desfecho. Usado pelo
// RenewalOutcomeModal e pelo ContactOutcomeModal — cada modal mantém seu
// próprio cabeçalho/formulário/rodapé, só o miolo segmentado e as cores são
// compartilhados aqui.

// Tokens por tom de desfecho: cor do segmento ativo, do painel de aviso e do
// botão de ação do rodapé (bg sólido + glow suave). Espelham as cores do
// protótipo 8b (emerald = positivo, rose = negativo, amber = adiar).
export const OUTCOME_TONE = {
  emerald: {
    segmentActive: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    panel: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    button: 'bg-[#059669] hover:bg-emerald-700 text-white shadow-[0_4px_14px_-4px_rgba(5,150,105,0.6)]'
  },
  rose: {
    segmentActive: 'bg-rose-100 text-rose-700 ring-1 ring-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    panel: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    button: 'bg-[#e11d48] hover:bg-rose-700 text-white shadow-[0_4px_14px_-4px_rgba(225,29,72,0.6)]'
  },
  amber: {
    segmentActive: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    panel: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    button: 'bg-[#d97706] hover:bg-amber-700 text-white shadow-[0_4px_14px_-4px_rgba(217,119,6,0.6)]'
  }
};

// Classe do botão de ação do rodapé para o desfecho selecionado.
export const outcomeButtonClass = (tone) => (OUTCOME_TONE[tone] || OUTCOME_TONE.emerald).button;

// Pergunta + seletor segmentado. Presentational puro: o estado (qual desfecho)
// e a validação ficam no modal dono. `segments`: [{ key, label, Icon, tone }].
export function SegmentedOutcome({ question, segments, value, onChange, className }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1 text-[13.5px] font-semibold text-foreground">
        {question}
        <span className="text-accent-500 text-[12px] leading-none">*</span>
      </label>

      <div className="mt-2.5 flex items-center gap-1 p-1 rounded-xl bg-slate-50 dark:bg-white/5 border border-border">
        {segments.map(({ key, label, Icon, tone }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={cn(
                'flex-1 h-9 rounded-lg text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 transition',
                active ? OUTCOME_TONE[tone].segmentActive : 'text-muted-foreground hover:bg-white/60 dark:hover:bg-white/[0.04]'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
