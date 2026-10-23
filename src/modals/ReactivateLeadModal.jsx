import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { RadioGroup, RadioGroupOption } from '../components/ui/radio-group.jsx';
import { reactivationStages } from '../lib/stageMove.js';
import { getSafeDateOrNull } from '../lib/dates.js';

// Reativar lead: o lead em Perda volta a uma fase aberta de um funil. O
// consultor escolhe o funil e a fase, e a ficha grava pelo mesmo caminho do
// "Mudar fase" (handlePhaseConfirm, com o planStageMove), que limpa o motivo e
// a data da perda. As opções saem de reactivationFunnels e reactivationStages
// (src/lib/stageMove.js). Pedido do Johnny em 21/10/2026: o lead perdido pode
// voltar.

const pill = 'h-8 px-3 rounded-lg text-[12.5px] font-semibold border transition';
const pillOff = 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-slate-300 dark:hover:border-white/15';
const pillOn = 'bg-brand-600 text-white border-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function ReactivateLeadModal({ lead, funnels, statuses, onClose, onConfirm }) {
  const firstFunnel = (funnels || []).find((f) => f.id === lead?.funnelId) || (funnels || [])[0] || null;
  const [funnelId, setFunnelId] = useState(firstFunnel?.id || '');
  const [stage, setStage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const stages = reactivationStages(statuses, funnelId);
  const lostAt = getSafeDateOrNull(lead?.lostAt);
  const lostText = [
    lostAt ? `perdido em ${lostAt.toLocaleDateString('pt-BR')}` : 'perdido',
    lead?.lossReason ? `motivo: ${lead.lossReason}` : null
  ].filter(Boolean).join(' · ');

  const chooseFunnel = (id) => { setFunnelId(id); setStage(''); };
  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };
  const handleConfirm = async () => {
    if (!stage || submitting) return;
    setSubmitting(true);
    const ok = await onConfirm({ funnelId, targetStatus: stage });
    setSubmitting(false);
    if (ok) onClose && onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[210] max-w-[480px] gap-0 p-0 block overflow-hidden rounded-2xl"
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="size-9 flex-none rounded-xl grid place-items-center bg-brand-600/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <RotateCcw size={16} />
            </span>
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Reativar lead</DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px] text-muted-foreground mt-1.5">
            {lead?.name || 'Lead'} · {lostText}. Escolha a fase em que ele volta ao funil.
          </DialogDescription>

          {(funnels || []).length > 1 && (
            <div className="mt-4">
              <p id="reativar-funil" className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Funil</p>
              <RadioGroup
                aria-labelledby="reativar-funil"
                value={funnelId}
                onValueChange={chooseFunnel}
                className="flex flex-wrap gap-2"
              >
                {funnels.map((f) => (
                  <RadioGroupOption key={f.id} value={f.id} className={cn(pill, f.id === funnelId ? pillOn : pillOff)}>
                    {f.name}
                  </RadioGroupOption>
                ))}
              </RadioGroup>
            </div>
          )}

          <div className="mt-4">
            <p id="reativar-fase" className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fase</p>
            {stages.length > 0 ? (
              <RadioGroup
                aria-labelledby="reativar-fase"
                value={stage}
                onValueChange={setStage}
                className="flex flex-wrap gap-2"
              >
                {stages.map((s) => (
                  <RadioGroupOption
                    key={s.id || s.name}
                    value={s.name}
                    className={cn(pill, s.name === stage ? pillOn : pillOff)}
                  >
                    {s.name}
                  </RadioGroupOption>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">Este funil não tem fase aberta.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/40">
          <p role="status" className="text-[12px] text-muted-foreground">
            {stage ? `Volta para ${stage}.` : 'Escolha a fase.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onClose && onClose()}
              disabled={submitting}
              className="h-9 px-3.5 rounded-[10px] text-[13px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition disabled:opacity-50 outline-none focus-visible:anel-foco"
            >Voltar</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!stage || submitting}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50 outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RotateCcw size={13} />
              {submitting ? 'Reativando...' : 'Reativar lead'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ReactivateLeadModal };
