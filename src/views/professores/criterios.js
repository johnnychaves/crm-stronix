// Os textos do placar e da lista de Carreira (plano de carreira, PR 3). As
// contas moram em src/lib/carreira/placar.js; aqui só se decide o texto.
import { alvoDe } from '../../lib/carreira/placar.js';
import { NUMEROS } from '../../lib/carreira/numeros.js';

export const notaTexto = (n) => n.toFixed(2).replace('.', ',');

const umaCasa = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const reaisTexto = (v) => (v >= 1000 ? `R$ ${umaCasa(v / 1000)} mil` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`);

// `vendasEm` vem dos ajustes da trilha (reais ou quantidade).
export function valorTexto(id, v, { vendasEm = 'reais' } = {}) {
  if (v == null) return null;
  if (id === 'nps') return notaTexto(v);
  if (id === 'vendas') return vendasEm === 'quantidade' ? `${umaCasa(v)} ${v === 1 ? 'venda' : 'vendas'}` : reaisTexto(v);
  return `${v}%`;
}

// A meta para ler: no número contra a academia, os pontos em relação à
// academia e, com a academia, o alvo em porcentagem. A regra é passar da
// academia mais os pontos (empate não passa): 0 é "acima da academia". A meta
// de vendas é por mês.
export function metaTexto(id, meta, academia = null, opts = {}) {
  if (meta == null) return null;
  if (id === 'vendas') return `${valorTexto(id, meta, opts)} por mês`;
  if (!NUMEROS[id]?.contraAcademia) return valorTexto(id, meta, opts);
  const pontos = Math.abs(meta);
  const regra = meta === 0 ? 'acima da academia'
    : meta > 0 ? `${pontos} ${pontos === 1 ? 'ponto' : 'pontos'} acima da academia`
      : `até ${pontos} ${pontos === 1 ? 'ponto' : 'pontos'} abaixo da academia`;
  const alvo = alvoDe(id, meta, academia);
  return alvo == null ? regra : `${regra}, ${alvo}%`;
}

export function estadoTexto(item, nivel) {
  if (item.estado === 'ok') return `Na meta do ${nivel.nome}`;
  if (item.estado === 'baixo') return `Abaixo da meta do ${nivel.nome}`;
  if (item.estado === 'semMeta') return nivel ? 'Sem meta definida.' : 'Sem nível: defina a trilha e o nível.';
  return null;
}

export function proximaTexto(item, proximo, opts = {}) {
  if (!proximo || item.metaProxima == null) return null;
  return `Para ${proximo.nome}: ${metaTexto(item.id, item.metaProxima, item.academia, opts)}`;
}

// Escala da régua da renovação: as metas e o resultado com folga dos dois
// lados, em dezenas, dentro de 0 a 100.
export function escalaDaRenovacao(valores) {
  const vs = valores.filter((v) => v != null);
  if (!vs.length) return [0, 100];
  const lo = Math.max(0, Math.floor((Math.min(...vs) - 15) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vs) + 15) / 10) * 10);
  return [lo, hi];
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// O rótulo de um pedaço da aderência pelas datas dele (o fim fica fora):
// "junho de 2027", "janeiro a maio de 2027" ou "dezembro de 2026 a fevereiro
// de 2027".
export function pedacoTexto({ inicio, fim }) {
  const ult = new Date(fim.getFullYear(), fim.getMonth() - 1, 1);
  const de = MESES[inicio.getMonth()];
  const ate = MESES[ult.getMonth()];
  if (inicio.getFullYear() !== ult.getFullYear()) return `${de} de ${inicio.getFullYear()} a ${ate} de ${ult.getFullYear()}`;
  return de === ate ? `${de} de ${ult.getFullYear()}` : `${de} a ${ate} de ${ult.getFullYear()}`;
}
