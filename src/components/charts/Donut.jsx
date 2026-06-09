// Donut chart (SVG puro). `segments` = [{ label, value, color }]. Mostra um
// rótulo central opcional (centerTop / centerBottom).
function Donut({ segments = [], size = 132, thickness = 16, centerTop, centerBottom }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const arcs = total > 0
    ? segments.filter((s) => Number(s.value) > 0).map((s) => {
        const frac = Number(s.value) / total;
        const arc = { color: s.color, dash: `${(frac * circ).toFixed(2)} ${(circ - frac * circ).toFixed(2)}`, offset: (-acc * circ).toFixed(2) };
        acc += frac;
        return arc;
      })
    : [];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={c} cy={c} r={r} fill="none" strokeWidth={thickness} className="stroke-slate-100 dark:stroke-white/[0.06]" />
      {arcs.map((a, i) => (
        <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={a.color} strokeWidth={thickness}
          strokeDasharray={a.dash} strokeDashoffset={a.offset} transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dasharray .5s ease' }} />
      ))}
      {(centerTop != null || centerBottom != null) && (
        <text textAnchor="middle">
          <tspan x={c} y={c} dy="-0.05em" className="fill-slate-900 dark:fill-white" style={{ fontSize: 23, fontWeight: 700 }}>{centerTop}</tspan>
          {centerBottom != null && <tspan x={c} y={c} dy="1.35em" className="fill-slate-400" style={{ fontSize: 10.5 }}>{centerBottom}</tspan>}
        </text>
      )}
    </svg>
  );
}

export { Donut };
