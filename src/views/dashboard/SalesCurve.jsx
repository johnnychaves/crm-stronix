// Curva de venda acumulada do topo da tela Gerencial: o mês exibido em linha
// cheia, até o dia em que está, e o mês comparado em pontilhado, inteiro.
// Desenhada para o fundo escuro do herói, então as cores são fixas. Dois
// marcadores no mesmo dia dizem quanto cada mês tinha vendido até ali.
//
// SVG puro, sem biblioteca, e com texto equivalente em aria-label.
import { fmtMoney, fmtMoneyShort } from './dashTokens.js';

const W = 590;
const H = 226;
const L = 46;
const R = 566;
const TOP = 28;
const BOTTOM = 196;

// Teto do eixo: o maior valor, arredondado para cima em degraus de 50 mil.
function niceMax(max) {
  const step = max > 200000 ? 100000 : 50000;
  return Math.max(step, Math.ceil(max / step) * step);
}

// Props:
//   days     quantos dias tem o mês exibido
//   cur      [valor | null] por dia, null depois do último dia coberto
//   prev     [valor | null] do mês comparado inteiro, ou null sem comparação
//   cutDay   o último dia coberto do mês exibido
//   prevName nome do mês comparado, para a legenda
//   curName  nome do mês exibido
export function SalesCurve({ days, cur, prev, cutDay, curName, prevName }) {
  const curVals = cur || [];
  const prevVals = prev || [];
  const top = niceMax(Math.max(1, ...curVals.filter((v) => v != null), ...prevVals.filter((v) => v != null)));
  const x = (d) => L + ((d - 1) / Math.max(1, days - 1)) * (R - L);
  const y = (v) => BOTTOM - (v / top) * (BOTTOM - TOP);
  const line = (vals) => vals
    .map((v, i) => (v == null ? null : `${i === 0 || vals[i - 1] == null ? 'M' : 'L'}${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  const lastCur = curVals[cutDay - 1] ?? 0;
  const lastPrev = prev ? prevVals[cutDay - 1] : null;
  const area = `${line(curVals)} L${x(cutDay).toFixed(1)} ${y(0)} L${x(1).toFixed(1)} ${y(0)} Z`;
  const ticks = [0, top / 2, top];
  const dayTicks = [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= days);
  const closed = cutDay >= days;
  const upTo = closed ? 'no mês' : `até o dia ${cutDay}`;
  const summary = `Venda acumulada em ${curName}: ${fmtMoney(lastCur)} ${upTo}.${prev ? ` ${prevName}: ${fmtMoney(lastPrev ?? 0)} ${closed ? 'no mês' : 'no mesmo dia'}.` : ''}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} className="block overflow-visible">
        <defs>
          <linearGradient id="curva-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5A7FFF" stopOpacity="0.45" />
            <stop offset="1" stopColor="#5A7FFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.12)" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">{v === 0 ? '0' : `${v / 1000}k`}</text>
          </g>
        ))}
        {dayTicks.map((d) => (
          <text key={d} x={x(d)} y={216} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11">{d}</text>
        ))}
        {prev && <path d={line(prevVals)} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeDasharray="5 5" />}
        <path d={area} fill="url(#curva-area)" />
        <path d={line(curVals)} fill="none" stroke="#7FA0FF" strokeWidth="3.2" strokeLinejoin="round" />
        {!closed && <line x1={x(cutDay)} x2={x(cutDay)} y1={14} y2={BOTTOM} stroke="rgba(255,255,255,0.25)" />}
        {prev && lastPrev != null && <circle cx={x(cutDay)} cy={y(lastPrev)} r="5" fill="#0E1A40" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />}
        <circle cx={x(cutDay)} cy={y(lastCur)} r="6" fill="#fff" stroke="#5A7FFF" strokeWidth="3" />
        <text x={x(cutDay) + (cutDay > days * 0.8 ? -12 : 12)} y={y(lastCur) - 8} textAnchor={cutDay > days * 0.8 ? 'end' : 'start'} fill="#fff" fontSize="13" fontWeight="700">{fmtMoneyShort(lastCur)}</text>
        {prev && lastPrev != null && (
          <text x={x(cutDay) + (cutDay > days * 0.8 ? -12 : 12)} y={y(lastPrev) + 18} textAnchor={cutDay > days * 0.8 ? 'end' : 'start'} fill="rgba(255,255,255,0.7)" fontSize="12">
            {`${fmtMoneyShort(lastPrev)} em ${prevName}`}
          </text>
        )}
      </svg>
      <div className="mt-1.5 flex gap-[18px] text-[12px] text-white/70">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block w-[18px] border-t-[3px] border-[#7FA0FF]" />{curName}</span>
        {prev && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-[18px] border-t-2 border-dashed border-white/60" />{prevName}</span>}
      </div>
    </div>
  );
}
