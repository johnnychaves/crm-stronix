// Renovação da carteira no ciclo: renovados ÷ contratos que venceram, pela
// conta do período inteiro, sem amostra mínima e sem recuo para anos
// anteriores. Entram os contratos da modalidade do professor com o fim
// previsto (plannedEndsAt) no ciclo e até o corte (asOf). A carteira vale no
// dia do vencimento (professorAt), e o contrato com troca de professor nos 90
// dias antes do vencimento sai da conta. Renovado é quem tem renovação ligada
// e não cancelada (liveRenewalOf).
// O cancelado antes do fim e o trancado seguem o renewalCohort do Operacional
// (operacional/renewal.js): o contrato cancelado enquanto ainda valia sai da
// conta, sem entrar como vencido, e o trancado não vence. O contrato que nunca
// valeu (neverTookEffect) cai na mesma regra, porque foi cancelado antes do fim.
import { liveRenewalOf } from '../contracts.js';
import { pct } from '../crm/stats.js';
import { getSafeDateOrNull } from '../dates.js';
import { hasOpenPause } from '../operacional/base.js';
import { professorAt } from '../professorHistory.js';
import { carteiraAt, contratosDaModalidade, estadoEm } from './carteira.js';
import { limitesDoCiclo } from './ciclo.js';

const DAY_MS = 86400000;
export const DIAS_SEM_TROCA = 90;

// Houve troca de professor nos 90 dias antes do vencimento: alguma entrada do
// histórico com a data em (vencimento − 90 dias, vencimento].
function trocouAntesDoFim(lead, vence) {
  const ate = vence.getTime();
  const desde = ate - DIAS_SEM_TROCA * DAY_MS;
  return (lead?.professorHistory || []).some((e) => {
    const t = getSafeDateOrNull(e?.since)?.getTime();
    return t != null && t > desde && t <= ate;
  });
}

// { venceram, renovados, taxa, linhas: [{ contrato, lead, renovou }] }.
export function renovacaoDoCiclo({ leads, contratos, planos, professor, ciclo, asOf = new Date() }) {
  const { inicio, fim } = limitesDoCiclo(ciclo);
  const leadsById = new Map((leads || []).map((l) => [l.id, l]));
  const linhas = [];
  contratosDaModalidade(contratos, professor, planos).forEach((lista, leadId) => {
    const lead = leadsById.get(leadId);
    if (!lead) return;
    lista.forEach((c) => {
      const vence = c.plannedEndsAt;
      if (!vence || vence < inicio || vence >= fim || vence > asOf) return;
      // Mesma conta do renewalCohort, sobre o mesmo contrato normalizado.
      if (c.cancelledAt && c.cancelledAt < c.endsAt) return;
      if (hasOpenPause(c)) return;
      if (professorAt(lead, vence) !== professor?.id || trocouAntesDoFim(lead, vence)) return;
      linhas.push({ contrato: c, lead, renovou: Boolean(liveRenewalOf(c.id, contratos)) });
    });
  });
  const renovados = linhas.filter((l) => l.renovou).length;
  return { venceram: linhas.length, renovados, taxa: pct(renovados, linhas.length), linhas };
}

const ORDEM_SITUACAO = { vencer: 0, renovou: 1, nao: 2 };

// A aba Carteira do perfil: uma linha por aluno, com a situação no ciclo.
// Renovou ou não renovou: o aluno tem linha na renovação do ciclo, e vale a do
// vencimento mais recente. A vencer: sem linha de renovação, mas na carteira
// agora (carteiraAt em asOf), com o contrato em vigor de fim previsto mais
// distante. Mora aqui, e não em carteira.js, porque usa a renovação, e este
// arquivo já importa carteira.js.
// [{ lead, contrato, situacao: 'vencer' | 'renovou' | 'nao', vence, estado, semCpf }],
// a vencer primeiro (do vencimento mais perto), depois os que venceram (do
// mais recente).
export function carteiraDoCiclo({ leads, contratos, planos, professor, ciclo, asOf = new Date() }) {
  const porLead = new Map();
  renovacaoDoCiclo({ leads, contratos, planos, professor, ciclo, asOf }).linhas.forEach((l) => {
    const atual = porLead.get(l.lead.id);
    if (!atual || l.contrato.plannedEndsAt > atual.vence) {
      porLead.set(l.lead.id, { lead: l.lead, contrato: l.contrato, situacao: l.renovou ? 'renovou' : 'nao', vence: l.contrato.plannedEndsAt, estado: null });
    }
  });
  const daModalidade = contratosDaModalidade(contratos, professor, planos);
  carteiraAt({ leads, contratos, planos, professor, data: asOf }).forEach(({ lead, estado }) => {
    if (porLead.has(lead.id)) return;
    const contrato = (daModalidade.get(lead.id) || [])
      .filter((c) => estadoEm([c], asOf))
      .reduce((a, c) => (!a || c.plannedEndsAt > a.plannedEndsAt ? c : a), null);
    porLead.set(lead.id, { lead, contrato, situacao: 'vencer', vence: contrato?.plannedEndsAt ?? null, estado });
  });
  return [...porLead.values()]
    .map((l) => ({ ...l, semCpf: !String(l.lead.cpfDigits || '').trim() }))
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
      || (a.situacao === 'vencer' ? a.vence - b.vence : b.vence - a.vence));
}
