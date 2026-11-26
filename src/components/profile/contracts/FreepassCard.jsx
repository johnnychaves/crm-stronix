// O freepass que corre, na aba Contratos (spec 2026-11-26). Por dias, a régua
// do que já passou; por aulas, quantas já foram agendadas. O "Encerrar
// freepass" é o único fim gravado: o fim pelo prazo, pela matrícula e pela
// perda sai da leitura (activeFreepassesOf, em src/lib/visitante.js).
import { Ticket } from 'lucide-react';
import { calendarDaysBetween } from '../../../lib/dates.js';
import { freepassLongText, FREEPASS_KINDS } from '../../../lib/visitante.js';
import { Btn } from '../../ui/Btn.jsx';

function elapsedPct(fp, now) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return Math.round(((fp.aulas || 0) / fp.total) * 100);
  const passed = calendarDaysBetween(fp.startsAt, now) + 1;
  return Math.max(0, Math.min(100, Math.round((passed / fp.total) * 100)));
}

export function FreepassCard({ freepass, now, canFreepass, loading, onEnd }) {
  const pct = elapsedPct(freepass, now);
  return (
    <section className="rounded-2xl border border-teal-200 bg-card shadow-card overflow-hidden dark:border-teal-500/30">
      <div className="flex items-start gap-3.5 px-5 pt-[18px] pb-4">
        <span className="size-[38px] flex-none rounded-xl grid place-items-center bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"><Ticket size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-[17px] font-bold tracking-tight">{freepass.typeName}</h3>
            <span className="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">Freepass</span>
          </div>
          <div className="text-[12.5px] text-muted-foreground mt-1">{freepass.modalidadeName}</div>
          <div className="num text-[13px] font-semibold mt-1.5">{freepassLongText(freepass, now)}</div>
        </div>
      </div>
      <div className="flex h-1 bg-slate-100 dark:bg-white/[0.06]">
        <span className="h-full bg-teal-500" style={{ width: `${pct}%` }}></span>
      </div>
      {canFreepass && (
        <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-slate-50 dark:bg-white/[0.03]">
          <Btn kind="secondary" onClick={() => onEnd(freepass)} disabled={loading}>Encerrar freepass</Btn>
          <span className="text-[12.5px] text-muted-foreground">A matrícula é pelo Marcar venda.</span>
        </div>
      )}
    </section>
  );
}
