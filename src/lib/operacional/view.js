// O que a tela Operacional (mockup D, "Duas metas") desenha a partir das
// métricas prontas de metricsOf: as linhas por pessoa do topo, o balanço da
// base, o marco mais esquecido e as cores dos motivos. Puro e sem import de
// pacote; as contas de verdade continuam em metrics.js e companhia.

import { CONTRACT_CANCEL_REASONS } from '../contracts.js';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const orderOf = (weekday) => DAY_ORDER.indexOf(weekday);

// Nome curto de cada pessoa para as linhas do topo: o primeiro nome; com o
// primeiro nome repetido na equipe, a inicial do sobrenome ("Ana R." e
// "Ana S."); e, se a inicial também repete, o sobrenome inteiro ("Ana
// Ribeiro" e "Ana Rocha").
export function shortNames(users) {
  const parts = (users || []).map((u) => {
    const words = String(u?.name || '').trim().split(/\s+/).filter(Boolean);
    const first = words[0] || 'Sem nome';
    const last = words.length > 1 ? words[words.length - 1] : '';
    return { id: u?.id, first, last, initial: last ? `${first} ${last[0].toUpperCase()}.` : first };
  });
  const countOf = (pick) => {
    const m = new Map();
    parts.forEach((p) => m.set(pick(p).toLowerCase(), (m.get(pick(p).toLowerCase()) || 0) + 1));
    return (p) => m.get(pick(p).toLowerCase());
  };
  const firsts = countOf((p) => p.first);
  const initials = countOf((p) => p.initial);
  return new Map(parts.map((p) => {
    if (firsts(p) < 2 || !p.last) return [p.id, p.first];
    return [p.id, initials(p) < 2 ? p.initial : `${p.first} ${p.last}`];
  }));
}

// Os dias de meta do mês na régua do topo, com a marca do primeiro dia de cada
// semana (o rótulo dele fica forte) e do dia de hoje.
export function goalAxis(metaDays) {
  return (metaDays || []).map((d, i, list) => ({
    key: d.key,
    day: d.day,
    state: d.state,
    weekStart: i === 0 || orderOf(d.weekday) <= orderOf(list[i - 1].weekday)
  }));
}

// Uma linha por pessoa nas duas metas do topo. `rows` é [{ user, m }], com m o
// metricsOf daquela pessoa. A meta sai do calendário dela (bateu ou não em
// cada dia) e a prospecção, das ações de cada dia contra o alvo diário dela.
// Sem número de meta (histórico carregando ou indisponível), a linha fica sem
// pontos e sem porcentagem; alvo 0 é prospecção desligada.
export function goalRows({ rows, metaDays }) {
  const names = shortNames((rows || []).map((r) => r.user));
  return (rows || []).map(({ user, m }) => {
    const hitByKey = new Map((m?.calendar || []).map((c) => [c.key, Boolean(c.me)]));
    const prosp = m?.prosp || null;
    const valueByKey = new Map((prosp?.days || []).map((d, i) => [d.key, prosp.perDay?.[i] ?? 0]));
    return {
      id: user.id,
      name: user.name || 'Sem nome',
      short: names.get(user.id),
      meta: m?.meta
        ? {
          pct: m.meta.pct,
          done: m.meta.done,
          total: m.meta.total,
          cells: (metaDays || []).map((d) => ({ key: d.key, day: d.day, state: d.state, hit: d.state === 'future' ? null : Boolean(hitByKey.get(d.key)) }))
        }
        : null,
      prosp: prosp
        ? {
          on: prosp.on,
          pct: prosp.pct,
          dailyTarget: prosp.dailyTarget,
          cells: (metaDays || []).map((d) => ({ key: d.key, day: d.day, state: d.state, value: d.state === 'future' ? null : (valueByKey.get(d.key) ?? 0) }))
        }
        : null
    };
  });
}

// O balanço do mês na base: quem entrou e quem saiu, pelos passos da ponte
// (base.js). O passo de trancamentos é um saldo: negativo é saída, positivo é
// entrada. Passo zerado não aparece.
export function baseBalance(movement) {
  const s = movement?.steps || {};
  const lock = s.trancamentos || 0;
  const entries = [
    { key: 'entraram', label: 'Matrículas', n: s.entraram || 0 },
    { key: 'voltaram', label: 'Voltaram', n: s.voltaram || 0 },
    { key: 'importados', label: 'Importados', n: s.importados || 0 },
    { key: 'destrancaram', label: 'Destrancaram', n: lock > 0 ? lock : 0 }
  ].filter((e) => e.n > 0);
  const exits = [
    { key: 'cancelaram', label: 'Cancelaram', n: s.cancelaram || 0 },
    { key: 'venceram', label: 'Venceram sem renovar', n: s.venceram || 0 },
    { key: 'trancaram', label: 'Trancaram', n: lock < 0 ? -lock : 0 }
  ].filter((e) => e.n > 0);
  const sum = (list) => list.reduce((a, e) => a + e.n, 0);
  return {
    start: movement?.startCount ?? null,
    end: movement?.endCount ?? null,
    net: movement ? (movement.endCount ?? 0) - (movement.startCount ?? 0) : null,
    entries,
    exits,
    entered: sum(entries),
    left: sum(exits)
  };
}

// O marco de renovação mais esquecido: o de menor taxa entre os que tiveram
// cliente, quando ela fica abaixo de 70% (o mesmo corte das barras antigas).
export function forgottenMilestone(items) {
  const list = (items || []).filter((m) => m.pct != null && m.total > 0 && m.pct < 70);
  if (!list.length) return null;
  const worst = list.reduce((a, b) => (b.pct < a.pct || (b.pct === a.pct && b.total - b.done > a.total - a.done) ? b : a));
  return { days: worst.days, missed: worst.total - worst.done, pct: worst.pct };
}

// Cor de cada motivo de saída. Segue o motivo, nunca a posição na lista: o
// mesmo motivo tem a mesma cor nas duas roscas. Paleta validada no dataviz
// (daltonismo e contraste); "Outro" e motivo fora da lista ficam em cinza.
const REASON_PALETTE = ['#2B59FF', '#E8692E', '#0E9F9A', '#9B5CF6', '#C2409A'];
export const OTHER_REASON_COLOR = '#94A3B8';

export function reasonColor(name) {
  const i = CONTRACT_CANCEL_REASONS.indexOf(name);
  return i >= 0 && i < REASON_PALETTE.length ? REASON_PALETTE[i] : OTHER_REASON_COLOR;
}

// Colunas da grade de contratos que vencem no mês, um quadrado por contrato:
// 16 até 64 contratos, depois mais colunas para a grade não ficar alta demais.
// Acima de 300, a tela troca a grade por uma barra.
export const UNITS_MAX = 300;
export function unitColumns(n) {
  if (n <= 64) return 16;
  if (n <= 160) return 20;
  return 30;
}
