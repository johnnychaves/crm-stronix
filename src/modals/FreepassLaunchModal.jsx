// Lançar freepass pela aba Contratos (spec 2026-11-26, parte 1). Escolhe o
// tipo (só os ativos, agrupados por modalidade) e, no por dias, o início. No
// por aulas, marca as N aulas (AulasPlanner, mockup A, #marcar-aulas), e o
// início é a primeira. A regra de um por modalidade é o launchCheck: o
// consultor é barrado, o gestor confirma. Quem grava é a ficha (onConfirm): o
// por dias pelo writeFreepassLaunch, o por aulas pelo gravador do Agendar.
import { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { Btn } from '../components/ui/Btn.jsx';
import { AulasPlanner } from '../components/profile/AulasPlanner.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { cn } from '../lib/utils.js';
import { addDays, fromDateInputValue, getSafeDateOrNull, startOfLocalDay, toDateInputValue } from '../lib/dates.js';
import { professorsForModality } from '../lib/professores.js';
import { aulaRowOf, aulasForConfirm, aulasProblem, dayOptions, emptyAulaRows, resolveAulaRows, shortDay } from '../lib/aulasPlan.js';
import { freepassQuantityText, launchCheck, launchStartRange, FREEPASS_KINDS } from '../lib/visitante.js';

const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// reusableFor(modalidade): a aula experimental pendente do lead que o lançamento
// por aulas reaproveita como a aula 1 (mesma modalidade, fora de freepass e sem
// desfecho), ou null. Ela nasce na linha 1, e a data pode ser trocada ali.
export function FreepassLaunchModal({ open, onOpenChange, firstName, types, modalities, freepasses, gestor, loading, onConfirm, reusableFor = () => null, now = new Date() }) {
  const { professores, metaWeekdays } = useGeneralConfig();
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(() => toDateInputValue(now));
  // As linhas do "Marcar as aulas" valem para o tipo em que foram marcadas.
  const [plan, setPlan] = useState({ typeId: '', rows: null });
  // Só redesenha: o Lançar que achou aula no passado mostra o aviso do planner.
  const [, setRecheck] = useState(0);
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
  const porAulas = type?.kind === FREEPASS_KINDS.AULAS;
  const endsBeforeToday = porDias && startOk && addDays(startDate, type.quantity - 1) < startOfLocalDay(now);
  const reuse = porAulas ? reusableFor(modalidadeName) : null;
  const startRows = () => {
    const r = emptyAulaRows(type.quantity);
    return reuse ? [aulaRowOf(reuse), ...r.slice(1)] : r;
  };
  const rows = porAulas ? (plan.typeId === type.id && plan.rows) || startRows() : null;
  const resolved = rows ? resolveAulaRows(rows) : null;
  const aulasIssue = resolved ? aulasProblem(resolved, now) : null;
  const pendingAt = getSafeDateOrNull(reuse?.scheduledFor);

  let status;
  if (!type) status = 'Escolha o freepass.';
  else if (check?.block) status = check.block;
  // O "Marcar as aulas" tem o próprio aviso, logo acima.
  else if (porAulas) status = check?.confirm || '';
  else if (porDias && !startOk) status = `O início vai de ${ddmm(range.min)} a ${ddmm(range.max)}.`;
  else if (endsBeforeToday) status = 'Esse freepass terminaria antes de hoje. Escolha um início mais recente.';
  else if (check?.confirm) status = check.confirm;
  else if (porDias) status = `${firstName} vira Visitante de ${ddmm(startDate)} a ${ddmm(addDays(startDate, type.quantity - 1))}.`;
  else status = `${firstName} vira Visitante agora, com ${freepassQuantityText(type)} para agendar.`;
  const blocked = !type || Boolean(check?.block) || (porDias && !startOk) || endsBeforeToday || Boolean(aulasIssue);

  const submit = () => {
    if (blocked || loading) return;
    if (porAulas) {
      // A tela pode ter ficado aberta até a aula passar: confere no relógio de agora.
      if (aulasProblem(resolved, new Date())) { setRecheck((n) => n + 1); return; }
      onConfirm({ type, modalidadeName, aulas: aulasForConfirm(resolved) });
      return;
    }
    onConfirm({ type, modalidadeName, startsAt: porDias ? startDate : startOfLocalDay(now) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90dvh] overflow-y-auto">
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
                        typeId === t.id ? 'border-teal-700 bg-teal-50 dark:bg-teal-500/10' : 'border-border hover:bg-muted/50',
                        'data-[state=checked]:border-teal-700')}
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
              type="date" className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] num dark:[color-scheme:dark]"
              value={start} min={toDateInputValue(range.min)} max={toDateInputValue(range.max)}
              onChange={e => setStart(e.target.value)}
            />
          </label>
        )}

        {porAulas && (
          <div className="flex flex-col gap-2">
            <AulasPlanner
              rows={rows} onChange={(next) => setPlan({ typeId: type.id, rows: next })}
              days={dayOptions(5, metaWeekdays)} professors={professorsForModality(professores, modalities, modalidadeName)}
              firstName={firstName} now={now}
            />
            {pendingAt && (
              <p className="text-[12.5px] text-muted-foreground">
                A aula experimental de {modalidadeName} marcada para {shortDay(pendingAt)} às {hhmm(pendingAt)} vira a aula 1 deste freepass. Dá para trocar a data dela aqui.
              </p>
            )}
          </div>
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
