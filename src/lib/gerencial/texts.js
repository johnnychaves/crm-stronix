// Frases do parágrafo 6 do handoff
// (docs/superpowers/specs/handoff-gerencial/README.md), cada uma numa função
// pura. Copiadas literais: para mudar uma frase, muda o handoff primeiro e
// só depois este arquivo.

import { monthLabel } from '../operacional/month.js';
import { fmtMoney as money } from '../format.js';

// Barra e cabeçalho (§6). Sem mês comparado (nenhum mês anterior com venda),
// o controle de comparação nem existe na barra: nada de pró-rata nem de mês
// fechado faz sentido aqui.
export function monthSubline({ running, elapsed, monthKey, compareOn, cmpKey }) {
  if (!cmpKey) return 'Não há mês anterior com venda para comparar';
  const mes = monthLabel(monthKey, { capitalized: false, withYear: false });
  const cmpMes = monthLabel(cmpKey, { capitalized: false, withYear: false });
  if (running) {
    return compareOn
      ? `1 a ${elapsed} de ${mes} comparado com os ${elapsed} primeiros dias de ${cmpMes}. O mês está em andamento, então a comparação é pró-rata.`
      : `1 a ${elapsed} de ${mes}. O mês está em andamento e ainda vai receber vendas.`;
  }
  return compareOn
    ? `${mes} inteiro comparado com ${cmpMes}. Mês fechado.`
    : `${mes} inteiro. Mês fechado.`;
}

// Notas de rodapé de card (§6). Cada uma some (null) quando a contagem é
// zero: sem clawback, sem sobreposição, sem importado ou sem vencido não há
// nada para a nota explicar.
export function clawbackNote({ count, value }) {
  if (!count) return null;
  const venda = count === 1 ? 'venda' : 'vendas';
  const foi = count === 1 ? 'já foi cancelada' : 'já foram canceladas';
  return `${count} ${venda} deste mês ${foi}, somando ${money(value)}. O valor continua no total do mês, porque o contrato foi fechado aqui.`;
}

export function overlapNote({ count }) {
  if (!count) return null;
  const pessoa = count === 1 ? 'pessoa tem' : 'pessoas têm';
  return `A carteira soma contrato, não pessoa: ${count} ${pessoa} dois contratos vigentes ao mesmo tempo, então o número de contratos é maior que o de gente.`;
}

export function blindNote({ count }) {
  if (!count) return null;
  const contrato = count === 1 ? 'contrato veio' : 'contratos vieram';
  const entram = count === 1 ? 'Entra' : 'Entram';
  const somam = count === 1 ? 'soma' : 'somam';
  const dele = count === 1 ? 'dele' : 'deles';
  return `${count} ${contrato} de um sistema antigo sem o valor. ${entram} na contagem de contratos e no risco, e nunca ${somam} no valor por mês. Preencher o valor ${dele} em Contratos corrige a carteira.`;
}

export function expiredNote({ count } = {}) {
  if (!count) return null;
  return 'Já saíram da carteira, então o valor por mês deles não aparece aqui. É a fila de recuperação.';
}

export function exitsNote() {
  return 'Trancamento é reversível e continua contando na carteira. Cancelamento sai.';
}

export function plansNote() {
  return "Combinação de modalidades é um grupo próprio, não a soma das partes: 'Musculação + Pilates' não entra em nenhum dos dois isolados.";
}

export function sourcesNote() {
  return 'É a origem do lead que virou contrato, não o volume de leads do canal. Quanto cada canal gera em leads fica no painel CRM.';
}

// Vazios (§5). gymEmpty substitui a tela inteira; monthNoSales só o que
// descreve a venda do mês; emptyRanking é a nota que troca a tabela de quem
// vendeu.
export function emptyGym() {
  return {
    title: 'Ainda não há contratos',
    body: 'Esta tela ganha vida na primeira matrícula registrada. Enquanto isso, o funil de leads continua no painel CRM.',
    cta: 'Ir para o pipeline'
  };
}

export function emptyMonth() {
  return {
    title: 'Nenhum contrato fechado neste mês',
    body: 'Os contratos existem no sistema desde junho de 2026, então este mês não tem venda registrada. A carteira e o risco abaixo continuam valendo: eles olham os contratos vigentes, não as vendas do mês.'
  };
}

export function emptyRanking() {
  return {
    title: 'Sem vendas no mês, não há ranking',
    body: 'Consultor, plano e origem descrevem as vendas do mês escolhido. Troque o mês para ver o ranking.'
  };
}
