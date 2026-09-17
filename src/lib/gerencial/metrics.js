// Uma função calcula o mês inteiro do Gerencial (molde de src/lib/crm/metrics.js):
// vendido, carteira, risco, saídas e os três rankings. ctx = { now, contracts,
// leadsById }. Carteira e risco são retrato de hoje: olham sempre ctx.now, nunca
// o mês escolhido. Só a venda, as saídas e os rankings usam a janela do mês.

import { monthRange, effectiveEnd, isCurrentMonthKey } from '../operacional/month.js';
import { salesOf } from './sales.js';
import { walletAt } from './wallet.js';
import { expiryHorizons, expiredWithoutSuccessor, exitsInWindow } from './risk.js';
import { sellersOf, plansOf, sourcesOf } from './people.js';

// Cache por ctx (WeakMap: ctx novo, cache novo). Um desenho da tela chama
// metricsOf várias vezes (mês exibido, mês comparado, cada ponto de
// tendência). O resultado de cada mês fica guardado por mês e corte; a
// carteira e o risco, que não dependem do mês, ficam guardados uma vez só e
// reaproveitados em toda chamada. Trocar um insumo no mesmo objeto de ctx
// (nova referência de contracts ou leadsById) zera os dois.
const caches = new WeakMap();

function cacheOf(ctx) {
  const sig = [ctx.now?.getTime(), ctx.contracts, ctx.leadsById];
  let cache = caches.get(ctx);
  if (!cache || cache.sig.some((v, i) => v !== sig[i])) {
    cache = { sig, results: new Map(), snapshot: null };
    caches.set(ctx, cache);
  }
  return cache;
}

// Retrato de hoje: carteira e risco, iguais para qualquer mês escolhido.
function snapshotOf(ctx, cache) {
  if (!cache.snapshot) {
    const contracts = ctx.contracts || [];
    const wallet = walletAt(contracts, ctx.now);
    const horizon = expiryHorizons(contracts, ctx.now);
    const expired = expiredWithoutSuccessor(contracts, ctx.now);
    const horizonSum = horizon.reduce((s, h) => s + h.v, 0);
    cache.snapshot = {
      wallet,
      risk: {
        horizon,
        expired,
        // Nunca gravado (§8 do handoff): sai da conta a cada leitura, e quem
        // arredonda pra exibir é a view.
        share: wallet.monthly > 0 ? (horizonSum / wallet.monthly) * 100 : 0
      }
    };
  }
  return cache.snapshot;
}

export function metricsOf(ctx, { monthKey, cutEnd = null }) {
  const cache = cacheOf(ctx);
  const key = `${monthKey}|${cutEnd?.getTime() ?? ''}`;
  const hit = cache.results.get(key);
  if (hit) return hit;
  const value = computeMetrics(ctx, cache, { monthKey, cutEnd });
  cache.results.set(key, value);
  return value;
}

function computeMetrics(ctx, cache, { monthKey, cutEnd }) {
  const contracts = ctx.contracts || [];
  const { start } = monthRange(monthKey);
  // No mês em andamento, sem corte explícito, o fim é agora; no mês fechado,
  // o fim do próprio mês. Um corte explícito (o mês comparado em pró-rata)
  // sempre ganha dos dois.
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  const running = isCurrentMonthKey(monthKey, ctx.now);
  const { wallet, risk } = snapshotOf(ctx, cache);

  const sold = salesOf(contracts, { start, end });
  const exits = exitsInWindow(contracts, { start, end });
  const sellers = sellersOf(sold.rows, sold.sold);
  const plans = plansOf(sold.rows, sold.sold);
  const sources = sourcesOf(sold.rows, sold.sold, ctx.leadsById);

  return {
    monthKey,
    running,
    start,
    end,
    sold,
    wallet,
    risk,
    exits,
    sellers,
    plans,
    sources,
    flags: {
      gymEmpty: contracts.length === 0,
      monthNoSales: sold.count === 0
    }
  };
}

const ppText = (v) => `${String(v).replace('.', ',')} p.p.`;

// Pílula de variação, no molde de src/lib/operacional/metrics.js: sem base de
// um dos lados, "sem base"; diferença nula, "igual"; senão, o sinal e o valor
// formatado.
export function deltaOf(cur, prev, { kind = 'count' } = {}) {
  if (cur == null || prev == null) return { none: true, text: 'sem base' };
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return { flat: true, value: 0, text: 'igual' };
  const abs = Math.abs(d);
  const num = kind === 'pp' ? ppText(abs) : abs.toLocaleString('pt-BR');
  return { up: d > 0, value: d, text: `${d > 0 ? '+' : '−'}${num}` };
}
