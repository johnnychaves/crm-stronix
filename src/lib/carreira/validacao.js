// O que o sistema recusa numa trilha do plano de carreira (spec
// 2026-11-26-plano-de-carreira-configuravel, "O que o sistema recusa"). A tela
// usa o primeiro problema para dizer o que falta e roda de novo antes de
// gravar. Meta em branco não é problema: o placar mostra o número sem dizer se
// bateu.
import { AJUSTES, metaValida, NUMEROS, numerosDaBase, VENDAS_EM } from './numeros.js';
import { MAX_NIVEIS, MESES_MAX } from './trilhas.js';

const igual = (a, b) => String(a || '').trim().toLocaleLowerCase('pt-BR') === String(b || '').trim().toLocaleLowerCase('pt-BR');
const nomeDaBase = (base) => (base === 'consultor' ? 'consultores' : 'professores');
const numeroEntre = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// { campo, texto } do primeiro problema da trilha que o gestor quer gravar, ou
// null. `gravada` é a trilha como está no banco (null na trilha nova), `outras`
// são as demais trilhas da academia e `pessoasPorNivel` conta quem está em
// cada nível da gravada ({ [nivelId]: número }).
export function problemaDaTrilha(t, { gravada = null, outras = [], pessoasPorNivel = {} } = {}) {
  if (!String(t?.nome || '').trim()) return { campo: 'nome', texto: 'Dê um nome à trilha.' };
  if (outras.some((o) => !o.arquivada && o.id !== t.id && igual(o.nome, t.nome))) {
    return { campo: 'nome', texto: 'Já existe uma trilha com esse nome.' };
  }
  const niveis = t.niveis || [];
  if (niveis.length < 1 || niveis.length > MAX_NIVEIS) return { campo: 'niveis', texto: `A trilha tem de 1 a ${MAX_NIVEIS} níveis.` };
  for (let i = 0; i < niveis.length; i += 1) {
    if (!String(niveis[i].nome || '').trim()) return { campo: `nivel-${i}`, texto: `Dê um nome ao nível ${i + 1}.` };
    if (niveis.some((n, j) => j < i && igual(n.nome, niveis[i].nome))) return { campo: `nivel-${i}`, texto: 'Dois níveis têm o mesmo nome.' };
    const m = niveis[i].mesesMinimos;
    if (i < niveis.length - 1 && !(Number.isInteger(m) && m >= 1 && m <= MESES_MAX)) {
      return { campo: `meses-${i}`, texto: `Use um número de meses de 1 a ${MESES_MAX}.` };
    }
  }
  for (const id of numerosDaBase(t.base)) {
    const n = t.numeros?.[id];
    if (!n?.ligado) continue;
    for (const nivel of niveis) {
      const v = n.metas?.[nivel.id];
      if (v != null && !metaValida(id, v)) return { campo: `meta-${id}-${nivel.id}`, texto: `Use um número de ${NUMEROS[id].min} a ${NUMEROS[id].max}.` };
    }
  }
  for (const [k, a] of Object.entries(AJUSTES)) {
    if (NUMEROS[a.numero].base !== t.base || !t.numeros?.[a.numero]?.ligado) continue;
    if (!numeroEntre(t.ajustes?.[k], a.min, a.max)) return { campo: `ajuste-${k}`, texto: `Use um número de ${a.min} a ${a.max}.` };
  }
  if (t.base === 'professor' && t.numeros?.aderencia?.ligado) {
    const alta = niveis.find((nv) => (t.numeros.aderencia.metas?.[nv.id] ?? -Infinity) >= t.ajustes.faixaMax);
    if (alta) return { campo: `meta-aderencia-${alta.id}`, texto: 'A meta precisa ficar abaixo do fim da faixa.' };
  }
  if (t.base === 'consultor' && t.numeros?.vendas?.ligado && !VENDAS_EM.includes(t.ajustes?.vendasEm)) {
    return { campo: 'ajuste-vendasEm', texto: 'Escolha se as vendas contam em reais ou em quantidade.' };
  }
  const total = Object.values(pessoasPorNivel || {}).reduce((s, x) => s + (Number(x) || 0), 0);
  if (gravada && total > 0 && t.base !== gravada.base) {
    return { campo: 'base', texto: `Com gente na trilha, ela continua sendo de ${nomeDaBase(gravada.base)}.` };
  }
  const apagado = (gravada?.niveis || []).find((n) => (Number(pessoasPorNivel?.[n.id]) || 0) > 0 && !niveis.some((x) => x.id === n.id));
  if (apagado) return { campo: 'niveis', texto: `${apagado.nome} tem gente. Passe as pessoas para outro nível antes de apagar.` };
  return null;
}

// Só a trilha sem ninguém se arquiva.
export const podeArquivar = (pessoasPorNivel) => Object.values(pessoasPorNivel || {}).every((x) => !(Number(x) > 0));
