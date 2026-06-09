import { useId } from 'react';

// Mini gráfico de linha + área (SVG puro) para os cards de KPI.
// `data` = array de números. A cor vem de `currentColor` (defina text-* no pai).
function Sparkline({ data = [], width = 100, height = 30, fill = true, strokeWidth = 2 }) {
  const id = useId();
  const vals = (data || []).map(Number).filter(Number.isFinite);
  if (vals.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = width / (vals.length - 1);
  const yOf = (v) => height - 2 - ((v - min) / range) * (height - 4);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${(i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {fill && (
        <>
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#sp-${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export { Sparkline };
