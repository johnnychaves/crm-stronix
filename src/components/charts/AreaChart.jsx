import { useId, useRef, useState } from 'react';

// Gráfico de área responsivo (SVG puro, sem libs). `data` = [{ label, value }].
// Cor via currentColor (defina text-* no pai). `fmt` formata o valor no tooltip.
// width:100% + height:auto preserva o aspecto do viewBox (sem distorção).
function AreaChart({ data = [], fmt = (v) => String(v) }) {
  const id = useId();
  const wrapRef = useRef(null);
  const [hi, setHi] = useState(null);
  const pts = (data || []).map((d) => ({ label: String(d.label ?? ''), value: Number(d.value) || 0 }));
  if (pts.length < 2) {
    return <div className="grid place-items-center h-44 text-[12px] text-slate-400 italic">Dados insuficientes para o gráfico.</div>;
  }

  const W = 640, H = 210, padX = 8, padTop = 20, padBottom = 28;
  const max = Math.max(1, ...pts.map((p) => p.value));
  const stepX = (W - padX * 2) / (pts.length - 1);
  const X = (i) => padX + i * stepX;
  const Y = (v) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${X(pts.length - 1).toFixed(1)},${(H - padBottom).toFixed(1)} L${X(0).toFixed(1)},${(H - padBottom).toFixed(1)} Z`;

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(pts.length - 1, Math.round((vx - padX) / stepX)));
    setHi(idx);
  };

  return (
    <div ref={wrapRef} className="relative w-full text-brand-600 dark:text-brand-400" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
        <defs>
          <linearGradient id={`ac-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={padX} x2={W - padX}
            y1={padTop + f * (H - padTop - padBottom)} y2={padTop + f * (H - padTop - padBottom)}
            className="stroke-slate-100 dark:stroke-white/[0.05]" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#ac-${id})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hi != null && (
          <line x1={X(hi)} x2={X(hi)} y1={padTop} y2={H - padBottom} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" vectorEffect="non-scaling-stroke" />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={X(i)} cy={Y(p.value)} r={hi === i ? 4.5 : 2.5} fill="currentColor"
            className="stroke-white dark:stroke-ink-900" strokeWidth={hi === i ? 2 : 0} />
        ))}
        {pts.map((p, i) => (
          <text key={i} x={X(i)} y={H - 9} textAnchor="middle" className="fill-slate-400 capitalize" style={{ fontSize: 11 }}>
            {p.label.replace('.', '')}
          </text>
        ))}
      </svg>
      {hi != null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] px-2 py-1 rounded-lg bg-ink-900 text-white text-[11px] num font-semibold shadow-lg whitespace-nowrap"
          style={{ left: `${(X(hi) / W) * 100}%`, top: `${(Y(pts[hi].value) / H) * 100}%` }}>
          {fmt(pts[hi].value)}
        </div>
      )}
    </div>
  );
}

export { AreaChart };
