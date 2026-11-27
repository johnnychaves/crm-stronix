// O placar da pessoa na trilha (spec 2026-11-26-plano-de-carreira-
// configuravel, "Menu Carreira"): para cada número ligado, o resultado, a meta
// do nível de agora, a do próximo nível e o estado; e o tempo no nível contra o
// mínimo. O sistema não diz se a pessoa está pronta para subir (decisão 7):
// só mostra. Puro e sem pacote (carreiraImports.test.js).
import { getSafeDateOrNull } from '../dates.js';
import { metaBatida, NUMEROS } from './numeros.js';
import { nivelDaPessoa, proximoNivel } from './trilhas.js';

// A meta em valor absoluto: no número contra a academia, a academia mais os
// pontos; sem a academia, não há alvo.
export function alvoDe(id, meta, academia = null) {
  if (meta == null) return null;
  if (!NUMEROS[id]?.contraAcademia) return meta;
  return academia == null ? null : academia + meta;
}

// 'sem' (sem resultado ou sem a academia para comparar), 'semMeta' (meta em
// branco ou sem nível), 'ok' ou 'baixo'.
export function estadoDe(id, { valor, meta, academia = null }) {
  if (valor == null) return 'sem';
  if (meta == null) return 'semMeta';
  const bateu = metaBatida(id, { valor, meta, academia });
  if (bateu == null) return 'sem';
  return bateu ? 'ok' : 'baixo';
}

// `resultados` é { [numeroId]: { valor, academia? } }. Número sem resultado
// entra como 'sem'. `naMeta` e `comMeta` dão o "3 de 4 na meta do Júnior".
export function placarDe(trilha, nivelId, resultados = {}) {
  const nivel = (trilha?.niveis || []).find((n) => n.id === nivelId) ?? null;
  const proximo = nivel ? proximoNivel(trilha, nivel.id) : null;
  const itens = Object.keys(NUMEROS)
    .filter((id) => trilha?.numeros?.[id]?.ligado === true)
    .map((id) => {
      const { valor = null, academia = null } = resultados[id] || {};
      const metas = trilha.numeros[id].metas || {};
      const meta = nivel ? metas[nivel.id] ?? null : null;
      const metaProxima = proximo ? metas[proximo.id] ?? null : null;
      return { id, nome: NUMEROS[id].nome, valor, academia, meta, metaProxima, estado: estadoDe(id, { valor, meta, academia }) };
    });
  return {
    nivel,
    proximo,
    itens,
    naMeta: itens.filter((i) => i.estado === 'ok').length,
    comMeta: itens.filter((i) => i.meta != null).length,
  };
}

// Meses inteiros de `de` até `ate`, nunca abaixo de zero. O dia que não existe
// no mês final (31/01 → 28/02) fecha no último dia dele.
export function mesesEntre(de, ate) {
  let m = (ate.getFullYear() - de.getFullYear()) * 12 + (ate.getMonth() - de.getMonth());
  const ultimoDia = new Date(ate.getFullYear(), ate.getMonth() + 1, 0).getDate();
  if (ate.getDate() < Math.min(de.getDate(), ultimoDia)) m -= 1;
  return Math.max(0, m);
}

export function duracaoTexto(meses) {
  if (meses < 1) return 'menos de 1 mês';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '';
  const m = resto ? `${resto} ${resto === 1 ? 'mês' : 'meses'}` : '';
  return [a, m].filter(Boolean).join(' e ');
}

// O tempo no nível contra o mínimo, ou null sem nível ou sem a data. No
// último nível não há mínimo: só o tempo.
export function tempoNoNivel(trilha, pessoa, agora = new Date()) {
  const nivel = nivelDaPessoa(pessoa, trilha);
  const desde = getSafeDateOrNull(pessoa?.nivelDesde);
  if (!nivel || !desde) return null;
  const meses = mesesEntre(desde, agora);
  const proximo = proximoNivel(trilha, nivel.id);
  if (!proximo || nivel.mesesMinimos == null) {
    return { meses, minimo: null, pct: null, texto: `${duracaoTexto(meses)} no nível`, falta: null };
  }
  const minimo = nivel.mesesMinimos;
  if (meses >= minimo) return { meses, minimo, pct: 100, texto: 'Tempo mínimo cumprido', falta: null };
  const resta = minimo - meses;
  // "Falta 1 ano", "Falta 1 mês"; "Faltam 4 meses", "Faltam 1 ano e 7 meses".
  const verbo = resta === 1 || resta === 12 ? 'Falta' : 'Faltam';
  return {
    meses,
    minimo,
    pct: Math.round((meses / minimo) * 100),
    texto: `${duracaoTexto(meses)} de ${duracaoTexto(minimo)}`,
    falta: `${verbo} ${duracaoTexto(resta)} para ${proximo.nome}`,
  };
}
