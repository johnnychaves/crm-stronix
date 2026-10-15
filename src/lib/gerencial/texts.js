// Frases da tela Gerencial (handoff v2, docs/superpowers/specs/handoff-gerencial/
// README.md), cada uma numa função pura. Para mudar uma frase, muda o handoff
// primeiro e só depois este arquivo.

import { monthLabel } from '../operacional/month.js';

// Linha de apoio do cabeçalho (handoff v2, §4). Mês em andamento compara os
// mesmos dias do mês comparado (pró-rata); mês fechado compara o mês inteiro.
export function monthSubline({ running, elapsed, monthKey, compareOn, cmpKey }) {
  const mes = monthLabel(monthKey, { capitalized: false, withYear: false });
  const comparing = Boolean(compareOn && cmpKey);
  const cmpMes = comparing ? monthLabel(cmpKey, { capitalized: false, withYear: false }) : '';
  if (running) {
    const range = `1 a ${elapsed} de ${mes}`;
    return comparing ? `${range} · vs. mesmos dias de ${cmpMes}` : `${range} · em andamento`;
  }
  return comparing ? `${mes} inteiro · vs. ${cmpMes}` : `${mes} inteiro`;
}

// Vazios (§4). gymEmpty substitui a tela inteira; monthNoSales só o que
// descreve a venda do mês.
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

// Dicas do "?" de cada card. Em linguagem de quem usa a tela, sem termo
// técnico: o que o número é, de onde vem e o que ele não é.
export const HELP = {
  sold: 'Soma do valor dos contratos fechados no mês: matrículas novas, renovações, upgrades e retornos. Conta no mês em que o contrato foi fechado, mesmo que comece depois. É valor de contrato, não dinheiro que já entrou no caixa.',
  wallet: 'Quanto os contratos ativos hoje valem por mês. Cada contrato entra pelo valor dividido pelos meses do plano. Os trancados entram, porque voltam a valer. Não muda com o mês escolhido.',
  ticket: 'Valor médio por mês de cada contrato ativo hoje: o valor por mês da carteira dividido pelos contratos. Não muda com o mês escolhido.',
  lapsed: 'Contratos que já passaram do fim e não têm renovação nem outro contrato depois. Já saíram da carteira. É a lista de quem vale recuperar.',
  mix: 'Cada contrato fechado no mês entra em um tipo só: matrícula nova, renovação, upgrade ou retorno de ex-cliente. O desconto é quanto os contratos saíram abaixo do preço de tabela. Com a comparação ligada, a seta mostra a variação contra o mês comparado.',
  sellers: 'O consultor dono do lead na hora da venda. Vendas é a quantidade de contratos. Ticket/mês é o valor médio por mês de cada venda, e mostra quem vende planos mais longos ou mais caros, não só quem vende mais.',
  expiry: 'Contratos ativos que terminam em 30, 60 e 90 dias e ainda não têm renovação, com o valor por mês de cada faixa. Contrato trancado não vence.',
  churn: 'De cada 100 clientes ativos no começo do mês, quantos saíram de vez. Sai de vez quem cancelou e não ficou com outro contrato, ou cujo contrato venceu, passou da tolerância e não voltou. Trancado não conta como saída. Cancelamentos e trancamentos em valor estão em Saídas do mês.',
  exits: 'Contratos cancelados e trancados no mês, com o valor por mês que cada um leva embora. Trancamento é reversível e o contrato continua na carteira. Cancelamento sai dela.',
  plans: 'Planos vendidos no mês, por valor. Combinação de modalidades é um plano próprio: Musculação + Pilates não entra em Musculação nem em Pilates.',
  sources: 'De onde veio o lead que virou contrato no mês. Não é o volume de leads de cada canal, que fica no painel CRM.'
};
