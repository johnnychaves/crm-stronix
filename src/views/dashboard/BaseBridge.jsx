// Ponte (waterfall) do movimento da base: do início ao fim do mês, cada passo
// que mudou alguém de lado. Handoff linhas 338 a 362; lógica de exemplo 1334 a
// 1349 e 1593 a 1614.
//
// Diferença em relação ao plano original: existe um passo a mais, "Importados"
// (kind 'in', logo depois de "Voltaram"), só quando steps.importados > 0 —
// contrato trazido de planilha soma na base mas não é matrícula nem retorno
// (base.js / README §8), por isso ganha nome e dica própria em vez de cair no
// balde de "Entraram".
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';

export function BaseBridge({ startCount, endCount, steps }) {
  const s = steps || {};
  const items = [
    { name: 'Início', kind: 'level', v: startCount },
    { name: 'Entraram', kind: 'in', v: s.entraram || 0 },
    { name: 'Voltaram', kind: 'in', v: s.voltaram || 0 },
    ...(s.importados > 0 ? [{ name: 'Importados', kind: 'in', v: s.importados, imported: true }] : []),
    { name: 'Cancelaram', kind: 'out', v: -(s.cancelaram || 0) },
    { name: 'Venceram', kind: 'out', v: -(s.venceram || 0) },
    { name: 'Trancamentos', kind: (s.trancamentos || 0) >= 0 ? 'in' : 'out', v: s.trancamentos || 0 },
    { name: 'Fim', kind: 'level', v: endCount }
  ];

  // Passo zero é "0", não "−0": o sinal só faz sentido quando há variação.
  const signed = (v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${fmtNum(Math.abs(v))}`);

  let run = startCount;
  const spans = items.map((b) => {
    if (b.kind === 'level') return { from: b.v, to: b.v, val: b.v };
    const from = run;
    run += b.v;
    return { from: Math.min(from, run), to: Math.max(from, run), val: run };
  });
  const all = spans.flatMap((sp) => [sp.from, sp.to]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = Math.max(Math.round((hi - lo) * 0.35), 3);
  const floor = lo - pad;
  const ceil = hi + pad;
  const H = 144;
  const y = (v) => ((v - floor) / (ceil - floor)) * H;

  const bars = items.map((b, i) => {
    const isLevel = b.kind === 'level';
    const span = spans[i];
    const bottom = isLevel ? 0 : y(span.from);
    const h = isLevel ? y(span.val) : Math.max(y(span.to) - y(span.from), 3);
    const bg = isLevel ? 'bg-muted' : b.kind === 'in' ? 'bg-brand-600' : 'bg-danger dark:bg-[#E11D48]';
    const labelFg = isLevel ? 'text-foreground' : b.kind === 'in' ? 'text-brand-700 dark:text-brand-300' : 'text-rose-700 dark:text-rose-300';
    const label = isLevel ? fmtNum(b.v) : signed(b.v);
    const tip = b.imported
      ? `Importados: +${fmtNum(b.v)} · clientes vindos da planilha`
      : isLevel
        ? `${b.name}: ${fmtNum(b.v)} clientes ativos`
        : `${b.name}: ${signed(b.v)} · base em ${fmtNum(span.val)}`;
    return {
      name: b.name, label, labelFg, bg, tip,
      bottom: Math.round(bottom), height: Math.round(h),
      nameFg: isLevel ? 'text-foreground/80' : 'text-muted-foreground',
      nameWeight: isLevel ? 'font-bold' : 'font-medium'
    };
  });

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card px-[18px] pt-4 pb-3.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold">Movimento da base</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
          <span className="size-[9px] rounded-[3px] bg-brand-600" />
          entrou
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
          <span className="size-[9px] rounded-[3px] bg-danger dark:bg-[#E11D48]" />
          saiu
        </span>
      </div>

      <div className="relative mt-[18px] flex h-36 items-end gap-2">
        {bars.map((b) => (
          <div key={b.name} className="relative h-full min-w-0 flex-1">
            <span
              className={cn('num absolute inset-x-0 text-center text-[11px] font-bold', b.labelFg)}
              style={{ bottom: `${b.bottom + b.height + 6}px` }}
            >
              {b.label}
            </span>
            <ChartMark
              tip={b.tip}
              className={cn('absolute left-1/2 w-full max-w-6 -translate-x-1/2 rounded', b.bg)}
              style={{ bottom: `${b.bottom}px`, height: `${b.height}px` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]">
        {bars.map((b) => (
          <span key={b.name} className={cn('min-w-0 flex-1 truncate text-center text-[10px]', b.nameFg, b.nameWeight)}>
            {b.name}
          </span>
        ))}
      </div>
      <div className="mt-[9px] text-[10.5px] leading-normal text-muted-foreground">
        A escala não começa em zero: a base é grande e o movimento é pequeno. O número está escrito em cada nível.
      </div>
    </div>
  );
}
