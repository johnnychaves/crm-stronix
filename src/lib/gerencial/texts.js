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
