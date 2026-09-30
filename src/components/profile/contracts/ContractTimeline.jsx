// A linha do tempo da aba Contratos: todos os contratos do cliente num eixo
// só. Verde é o contrato em uso, roxo hachurado é o próximo, cinza é o
// encerrado e vermelho é o cancelado, até o cancelamento. Os trancamentos
// ficam em amarelo por cima, os marcos de renovação da academia viram
// tracinhos no contrato em uso, e há marcas de ano e o marcador de hoje. A
// geometria vem pronta de contractTimelineOf (lib/contractsTab.js); aqui só
// há tela. Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { cn } from '../../../lib/utils.js';

// A hachura roxa do próximo contrato, como no mockup. Vai como estilo porque
// é um gradiente repetido, que não existe na paleta.
export const HATCH_VIOLET = 'repeating-linear-gradient(135deg, rgba(139,92,246,.55) 0 3px, rgba(139,92,246,.18) 3px 7px)';

const SEGMENT_CLASS = {
  em_uso: 'bg-emerald-500',
  proximo: '',
  encerrado: 'bg-slate-300 dark:bg-slate-600',
  cancelado: 'bg-rose-400'
};

const LEGEND = [
  { label: 'em uso', className: 'bg-emerald-500' },
  { label: 'próximo', className: null },
  { label: 'encerrado', className: 'bg-slate-300 dark:bg-slate-600' },
  { label: 'cancelado', className: 'bg-rose-400' },
  { label: 'trancado', className: 'bg-yellow-400' }
];

// Altura de cada trilha, em px. Contratos que se cruzam ganham uma segunda.
const LANE_HEIGHT = 16;

export function ContractTimeline({ timeline }) {
  if (!timeline) return null;
  const { years, lanes, heroLane, marks, todayPct } = timeline;
  const tracksHeight = 9 + lanes.length * LANE_HEIGHT;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card px-[22px] pt-4 pb-5">
      <div className="flex items-center gap-4 flex-wrap">
        <h3 className="text-[14.5px] font-semibold tracking-tight">Vigência</h3>
        <div className="flex items-center gap-3.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
          {LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className={cn('w-3.5 h-1.5 rounded-full', item.className)}
                style={item.className ? undefined : { backgroundImage: HATCH_VIOLET }}
              ></span>
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {/* 21px a mais embaixo, para os anos. */}
      <div className="relative mt-7" style={{ height: tracksHeight + 21 }}>
        {years.map((y) => (
          <span key={y.year} className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-white/[0.06]" style={{ left: `${y.pct}%` }}></span>
        ))}
        {years.map((y) => (
          <span key={`ano-${y.year}`} className="num absolute bottom-0 text-[10.5px] text-slate-400 dark:text-slate-500 pl-1.5" style={{ left: `${y.pct}%` }}>
            {y.year}
          </span>
        ))}
        {lanes.map((lane, i) => (
          <div key={i} className="absolute left-0 right-0 h-2.5" style={{ top: 9 + i * LANE_HEIGHT }}>
            <span className="absolute inset-0 rounded-full bg-slate-100 dark:bg-white/[0.06]"></span>
            {lane.map((s) => (
              <span
                key={s.id}
                title={s.title}
                className={cn('absolute top-0 h-2.5', SEGMENT_CLASS[s.kind], !s.joinsPrev && 'rounded-l-full', !s.joinsNext && 'rounded-r-full')}
                style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%`, ...(s.kind === 'proximo' ? { backgroundImage: HATCH_VIOLET } : {}) }}
              ></span>
            ))}
            {/* As pausas vêm depois dos segmentos, para ficarem por cima. */}
            {lane.flatMap((s) => s.pauses.map((p, j) => (
              <span key={`${s.id}-pausa-${j}`} title={p.title} className="absolute top-0 h-2.5 bg-yellow-400" style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}></span>
            )))}
            {i === heroLane && marks.map((m) => (
              <span
                key={m.days}
                title={m.title}
                className={cn('absolute -top-[3px] w-0.5 h-4 -translate-x-1/2 rounded-[1px]', m.active ? 'bg-amber-500' : 'bg-slate-400 dark:bg-white/40')}
                style={{ left: `${m.pct}%` }}
              ></span>
            ))}
          </div>
        ))}
        <span className="absolute w-[3px] -translate-x-1/2 rounded-sm bg-slate-900 dark:bg-white" style={{ left: `${todayPct}%`, top: 3, height: tracksHeight - 3 }}></span>
        <span className="num absolute -top-4 -translate-x-1/2 text-[10.5px] font-semibold text-slate-900 dark:text-white" style={{ left: `${todayPct}%` }}>hoje</span>
      </div>
    </section>
  );
}
