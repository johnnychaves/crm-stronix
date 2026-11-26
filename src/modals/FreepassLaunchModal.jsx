// Lançar freepass pela aba Contratos (spec 2026-11-26, parte 1). Escolhe o
// tipo (só os ativos, agrupados por modalidade) e, no por dias, o início. A
// regra de um por modalidade é o launchCheck: o consultor é barrado, o gestor
// confirma. Quem grava é a ficha (onConfirm), pelo writeFreepassLaunch.
import { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { Btn } from '../components/ui/Btn.jsx';
import { cn } from '../lib/utils.js';
import { addDays, fromDateInputValue, startOfLocalDay, toDateInputValue } from '../lib/dates.js';
import { freepassQuantityText, launchCheck, launchStartRange, FREEPASS_KINDS } from '../lib/visitante.js';

const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function FreepassLaunchModal({ open, onOpenChange, firstName, types, modalities, freepasses, gestor, loading, onConfirm, now = new Date() }) {
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(() => toDateInputValue(now));
  const range = launchStartRange(now);

  const groups = useMemo(() => (modalities || [])
    .map(m => ({ m, list: (types || []).filter(t => t.ativo && t.modalidadeId === m.id) }))
    .filter(g => g.list.length), [modalities, types]);
  const type = (types || []).find(t => t.id === typeId) || null;
  const modalidadeName = type ? (modalities || []).find(m => m.id === type.modalidadeId)?.name || '' : '';
  const check = type ? launchCheck({ type, freepasses, modalidadeName, gestor }) : null;
  const startDate = fromDateInputValue(start);
  const startOk = Boolean(startDate) && startDate >= range.min && startDate <= range.max;
  const porDias = type?.kind === FREEPASS_KINDS.DIAS;

  let status;
  if (!type) status = 'Escolha o freepass.';
  else if (check?.block) status = check.block;
  else if (porDias && !startOk) status = `O início vai de ${ddmm(range.min)} a ${ddmm(range.max)}.`;
  else if (check?.confirm) status = check.confirm;
  else if (porDias) status = `${firstName} vira Visitante de ${ddmm(startDate)} a ${ddmm(addDays(startDate, type.quantity - 1))}.`;
  else status = `${firstName} vira Visitante agora, com ${freepassQuantityText(type)} para agendar.`;
  const blocked = !type || Boolean(check?.block) || (porDias && !startOk);

  const submit = () => {
    if (blocked || loading) return;
    onConfirm({ type, modalidadeName, startsAt: porDias ? startDate : startOfLocalDay(now) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Lançar freepass</DialogTitle>
          <DialogDescription>{firstName} passa a aparecer como Visitante enquanto o freepass corre.</DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhum freepass cadastrado. O gestor cadastra em Configurações → Agendamento.</p>
        ) : (
          <RadioGroup value={typeId} onValueChange={setTypeId} aria-label="Freepass" className="flex flex-col gap-3">
            {groups.map(({ m, list }) => (
              <div key={m.id} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted-foreground">{m.name}</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map(t => (
                    <RadioGroupOption
                      key={t.id} value={t.id} aria-label={`${t.name}, ${freepassQuantityText(t)}`}
                      className={cn('flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition',
                        typeId === t.id ? 'border-teal-700 bg-teal-50 dark:bg-teal-500/10' : 'border-border hover:bg-muted/50')}
                    >
                      <span className="text-[13.5px] font-semibold">{t.name}</span>
                      <span className="text-[12px] text-muted-foreground">{freepassQuantityText(t)}</span>
                    </RadioGroupOption>
                  ))}
                </div>
              </div>
            ))}
          </RadioGroup>
        )}

        {porDias && (
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Começa em
            <input
              type="date" className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] num"
              value={start} min={toDateInputValue(range.min)} max={toDateInputValue(range.max)}
              onChange={e => setStart(e.target.value)}
            />
          </label>
        )}

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <p role="status" className={cn('flex-1 text-[12.5px]', check?.block ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
            {status}
          </p>
          <Btn kind="secondary" onClick={() => onOpenChange(false)}>Cancelar</Btn>
          <Btn kind="visit" icon={<Ticket size={14} />} onClick={submit} disabled={blocked || loading}>
            {check?.confirm ? 'Lançar mesmo assim' : 'Lançar freepass'}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
