// Contas pequenas do CRM. Mediana nunca soma: vem sempre da lista (README do
// handoff §6).

export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// Mediana de números. Lista vazia: null.
export function median(values) {
  const v = (values || []).filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Mediana com os que não têm valor (null) no fim da fila, a censura à direita
// do card de primeiro contato: se o meio da fila cai num sem valor, não existe
// mediana.
export function medianWithMissing(values) {
  const list = values || [];
  const n = list.length;
  if (!n) return null;
  const rank = (x) => (x == null ? Infinity : x);
  const sorted = [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra === rb ? 0 : ra - rb;
  });
  const lo = sorted[Math.ceil(n / 2) - 1];
  const hi = sorted[n % 2 ? Math.ceil(n / 2) - 1 : n / 2];
  if (lo == null || hi == null) return null;
  return (lo + hi) / 2;
}

export function countBy(list, keyOf) {
  const map = new Map();
  (list || []).forEach((x) => {
    const k = keyOf(x);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

// Mapa nome → contagem em lista, do maior para o menor, empate pelo nome.
export function rankCounts(map) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}
