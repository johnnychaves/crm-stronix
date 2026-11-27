// O freepass que corre, na aba Contratos (spec 2026-11-26). Por dias, a régua
// do que já passou; por aulas, quantas já foram agendadas. O "Encerrar
// freepass" é o único fim gravado: o fim pelo prazo, pela matrícula e pela
// perda sai da leitura (activeFreepassesOf, em src/lib/visitante.js).
// Embaixo, as aulas do freepass (mockup A, #cartao), cada uma com a situação e,
// a agendada, o Remarcar; no por aulas com vaga, "N aulas a agendar" e Agendar.
import { CalendarPlus, Ticket } from 'lucide-react';
import { calendarDaysBetween, getSafeDateOrNull } from '../../../lib/dates.js';
import { freepassShortText, FREEPASS_KINDS } from '../../../lib/visitante.js';
import { AULA_STATUS } from '../../../lib/aulas.js';
import { aulasCountText, shortDay } from '../../../lib/aulasPlan.js';
import { SOLO_TRAINING_LABEL } from '../../../lib/professores.js';
import { cn } from '../../../lib/utils.js';
import { Btn } from '../../ui/Btn.jsx';

function elapsedPct(fp, now) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return Math.round(((fp.aulas || 0) / fp.total) * 100);
  const passed = calendarDaysBetween(fp.startsAt, now) + 1;
  return Math.max(0, Math.min(100, Math.round((passed / fp.total) * 100)));
}

const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const cap = (t) => t.charAt(0).toLocaleUpperCase() + t.slice(1);

// A direita do card: o andamento em verde-água e, embaixo, o fim ou o que
// falta. No por aulas com vaga, o que falta agendar vem em cima (mockup A, #cartao).
function progressOf(fp, now) {
  if (fp.kind === FREEPASS_KINDS.AULAS) {
    const aulas = fp.aulas || 0;
    const free = Math.max(0, fp.total - aulas);
    if (free) return { main: `${aulasCountText(free)} a agendar`, sub: `${aulas} de ${fp.total} agendadas` };
    const end = getSafeDateOrNull(fp.endsAt);
    return { main: `${aulas} de ${fp.total} aulas agendadas`, sub: end ? `até ${ddmm(end)}` : '' };
  }
  const end = getSafeDateOrNull(fp.endsAt);
  return { main: cap(freepassShortText(fp, now)), sub: end ? `até ${ddmm(end)}` : '' };
}

const PILL = 'inline-flex h-6 flex-none items-center rounded-full px-2.5 text-[12px] font-semibold';
const SITUACAO = {
  [AULA_STATUS.AGENDADA]: ['Agendada', 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-200'],
  [AULA_STATUS.ATTENDED]: ['Compareceu', 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'],
  [AULA_STATUS.NO_SHOW]: ['Não veio', 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'],
  [AULA_STATUS.CANCELLED]: ['Cancelada', 'bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400'],
};
const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function aulaText(a) {
  const at = getSafeDateOrNull(a.scheduledFor);
  const who = a.soloTraining ? SOLO_TRAINING_LABEL : a.professorName ? `Prof. ${a.professorName}` : '';
  return [at ? `${shortDay(at)} às ${hhmm(at)}` : 'Sem dia', who].filter(Boolean).join(' · ');
}

// aulas: os registros da pessoa com o freepassId deste freepass, em ordem de
// data. A cancelada fica riscada e sem número, porque devolveu a vaga.
// canSchedule: quem agenda na ficha; Remarcar e Agendar são dele.
export function FreepassCard({ freepass, now, canFreepass, loading, onEnd, aulas = [], canSchedule = false, onRemarcar, onAgendar }) {
  const pct = elapsedPct(freepass, now);
  const { main, sub } = progressOf(freepass, now);
  let n = 0;
  const rows = aulas.map((a) => ({ a, number: a.status === AULA_STATUS.CANCELLED ? null : ++n }));
  // Os dias das outras aulas do freepass, que o Remarcar não pode repetir.
  const takenBut = (id) => rows.filter((r) => r.number && r.a.id !== id).map((r) => getSafeDateOrNull(r.a.scheduledFor)).filter(Boolean);
  const free = freepass.kind === FREEPASS_KINDS.AULAS ? Math.max(0, freepass.total - (freepass.aulas ?? 0)) : 0;
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
        </div>
        <div className="flex-none text-right">
          <div className="num text-[14px] font-semibold text-teal-700 dark:text-teal-300">{main}</div>
          {sub && <div className="num text-[12px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </div>
      <div className="flex h-1 bg-teal-100 dark:bg-teal-500/15">
        <span className="h-full bg-teal-500" style={{ width: `${pct}%` }}></span>
      </div>
      {(rows.length > 0 || free > 0) && (
        <ul aria-label={`Aulas do freepass ${freepass.typeName}`} className="divide-y divide-border">
          {rows.map(({ a, number }) => {
            const [label, tone] = SITUACAO[a.status] || SITUACAO[AULA_STATUS.AGENDADA];
            const cancelled = !number;
            return (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span aria-hidden="true" className={cn('grid size-6 flex-none place-items-center rounded-full text-[12px] font-bold',
                  cancelled ? 'bg-slate-100 text-slate-400 dark:bg-white/[0.05]' : 'bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300')}>
                  {cancelled ? '–' : number}
                </span>
                <span className={cn('min-w-0 flex-1 text-[13.5px] num', cancelled && 'text-muted-foreground line-through')}>
                  {!cancelled && <b className="font-semibold">Aula {number} · </b>}{aulaText(a)}
                </span>
                <span className={cn(PILL, tone)}>{label}</span>
                {canSchedule && a.status === AULA_STATUS.AGENDADA && (
                  <button type="button" onClick={() => onRemarcar(a, { number, taken: takenBut(a.id) })} disabled={loading}
                    aria-label={`Remarcar a aula ${number}`}
                    className="flex-none rounded-md px-1 text-[12.5px] font-semibold text-brand-700 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:anel-foco dark:text-brand-300">
                    Remarcar
                  </button>
                )}
              </li>
            );
          })}
          {Array.from({ length: free }, (_, k) => n + k + 1).map((number) => (
            <li key={`vaga-${number}`} className="flex items-center gap-3 px-5 py-3">
              <span aria-hidden="true" className="grid size-6 flex-none place-items-center rounded-full bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300 text-[12px] font-bold">{number}</span>
              <span className="min-w-0 flex-1 text-[13.5px]"><b className="font-semibold">Aula {number} · </b>ainda sem dia</span>
              <span className={cn(PILL, 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300')}>A agendar</span>
              {canSchedule && (
                <Btn kind="visit" icon={<CalendarPlus size={14} />} onClick={() => onAgendar(freepass)} disabled={loading}>
                  Agendar<span className="sr-only"> a aula {number}</span>
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}
      {canFreepass && (
        <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-slate-50 dark:bg-white/[0.03]">
          <span className="flex-1 text-[12.5px] text-muted-foreground">A matrícula é pelo Marcar venda.</span>
          <Btn kind="secondary" onClick={() => onEnd(freepass)} disabled={loading}>Encerrar freepass</Btn>
        </div>
      )}
    </section>
  );
}
