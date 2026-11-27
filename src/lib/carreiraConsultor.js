// Os números do consultor no plano de carreira (spec 2026-11-26-plano-de-
// carreira-configuravel, "Trilhas de consultor"). Cada conta chama a do painel
// de origem (CRM, Gerencial e Operacional), sem copiar regra. Mora fora de
// src/lib/carreira/ de propósito: as contas dos painéis chegam a dailyGoal.js
// (lucide-react) e a funnels.js, e a pasta da carreira tem de caber na api/
// (carreiraImports.test.js). O perfil do consultor nunca é lido pela api/.
import { isGestor, isSeller } from './acesso.js';
import { newLeadsOf, outcomeAt } from './crm/cohort.js';
import { makeScope } from './crm/scope.js';
import { pct } from './crm/stats.js';
import { soldContracts } from './gerencial/sales.js';
import { saleMoment, saleTypeOf } from './gerencial/scope.js';
import { daysInMonthOf } from './gerencial/series.js';
import { indexContracts } from './operacional/base.js';
import { addMonthsToKey, metaDaysOfMonth, monthKeyOf, monthRange } from './operacional/month.js';
import { renewalCohort, summarizeCohort } from './operacional/renewal.js';

// Quem aparece na Carreira como consultor: quem vende e não é gestor (a conta
// do isMetaParticipant), na forma que as telas de Carreira leem.
export function consultoresDaCarreira(users) {
  return (users || [])
    .filter((u) => u?.id && isSeller(u) && !isGestor(u))
    .map((u) => ({
      id: u.id,
      nome: u.name || '',
      photoUrl: u.photoUrl || null,
      trilhaId: u.trilhaId ?? null,
      nivel: u.nivel ?? null,
      nivelDesde: u.nivelDesde ?? null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Os meses do período ('AAAA-MM') que já começaram: do início até o mês de
// agora, sem passar do fim (que fica fora).
export function mesesDoPeriodo(periodo, agora) {
  const out = [];
  if (!periodo) return out;
  for (let key = monthKeyOf(periodo.inicio); ; key = addMonthsToKey(key, 1)) {
    const { start } = monthRange(key);
    if (start >= periodo.fim || start > agora) break;
    out.push(key);
  }
  return out;
}

// Quantos meses do período já correram: o mês fechado vale 1, e o mês em
// andamento vale o dia de hoje dividido pelos dias dele.
export function mesesCorridos(periodo, agora) {
  return mesesDoPeriodo(periodo, agora).reduce((soma, key) => {
    const { start, end } = monthRange(key);
    return soma + (end <= agora ? 1 : agora.getDate() / daysInMonthOf(start));
  }, 0);
}

// Conversão em matrícula: dos leads de que o consultor é dono, cadastrados no
// período, quantos se matricularam até agora, contra a mesma conta na academia
// inteira. É a safra por pessoa do painel CRM (crm/metrics.js), mês a mês, em
// Todos os funis, com o desfecho de agora. A lista do CRM vem com a cópia mais
// nova de cada lead (leadsById), como no painel.
export function conversaoDoConsultor({ months, leadsById, users, funnels, consultantId, periodo, agora }) {
  const fresco = (lista) => (lista || []).map((l) => leadsById?.get(l.id) || l);
  const equipe = makeScope({ users, funnels });
  const dono = makeScope({ users, funnels, userId: consultantId });
  const linhas = [];
  let leadsAcad = 0;
  let matAcad = 0;
  let incompleto = false;
  for (const key of mesesDoPeriodo(periodo, agora)) {
    const src = months?.[key];
    if (!src || src.failed) { incompleto = true; continue; }
    const { start, end: fimDoMes } = monthRange(key);
    const end = fimDoMes < agora ? fimDoMes : agora;
    const safra = newLeadsOf(fresco(src.leadsCreated), { start, end, inScope: equipe.inScope });
    leadsAcad += safra.length;
    safra.forEach((lead) => {
      const desfecho = outcomeAt(lead, agora);
      if (desfecho === 'enrolled') matAcad += 1;
      if (dono.ownerOk(lead)) linhas.push({ lead, mes: key, desfecho });
    });
  }
  const matriculas = linhas.filter((l) => l.desfecho === 'enrolled').length;
  linhas.sort((a, b) => b.lead.createdAt - a.lead.createdAt);
  return {
    consultor: { leads: linhas.length, matriculas, taxa: pct(matriculas, linhas.length) },
    academia: { leads: leadsAcad, matriculas: matAcad, taxa: pct(matAcad, leadsAcad) },
    linhas,
    incompleto,
  };
}

// Vendas: o que o consultor fechou no período, pela data do fechamento e pelo
// vendedor do contrato, como o Gerencial (soldContracts, sem o importado). O
// valor é o do contrato, não o caixa. O placar lê por mês, em reais ou em
// quantidade (ajustes.vendasEm), com o mês em andamento pelos dias corridos.
export function vendasDoConsultor({ contratos, consultantId, periodo, agora, vendasEm = 'reais' }) {
  const end = periodo.fim < agora ? periodo.fim : agora;
  const { byPerson } = indexContracts(contratos || []);
  const linhas = soldContracts(contratos, { start: periodo.inicio, end })
    .filter((c) => c.consultantId === consultantId)
    .map((c) => ({ contrato: c, quando: saleMoment(c), tipo: saleTypeOf(c, byPerson), valor: Number(c.value) || 0 }))
    .sort((a, b) => b.quando - a.quando);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const quantidade = linhas.length;
  const renovacoes = linhas.filter((l) => l.tipo === 'renovacao').length;
  const meses = mesesCorridos(periodo, agora);
  const porMes = meses > 0 ? { valor: total / meses, quantidade: quantidade / meses } : { valor: null, quantidade: null };
  return {
    linhas,
    total,
    quantidade,
    renovacoes,
    matriculas: quantidade - renovacoes,
    meses,
    porMes,
    valor: vendasEm === 'quantidade' ? porMes.quantidade : porMes.valor,
  };
}

// Renovação da carteira: dos clientes de que o consultor é dono hoje, cujo
// contrato venceu no período, quantos renovaram. É a coorte do Operacional
// (renewalCohort e summarizeCohort) na janela do período, com o dono tirado dos
// clientes da academia e, sem o lead, o consultor do contrato. A taxa conta só
// o que já se decidiu: quem está na tolerância fica fora.
export function renovacaoDoConsultor({ contratos, clientesPorId, graceDays, consultantId, periodo, agora }) {
  const rows = renewalCohort(contratos, { start: periodo.inicio, end: periodo.fim, asOf: agora, graceDays, leadsById: clientesPorId });
  const resumo = summarizeCohort(rows, { owner: consultantId });
  const linhas = rows
    .filter((r) => r.owner === consultantId)
    .sort((a, b) => b.contract.plannedEndsAt - a.contract.plannedEndsAt);
  return { linhas, taxa: resumo.rate, renovados: resumo.counts.renew, decididos: resumo.decided, resumo };
}

// Meta diária batida: dos dias de meta do período que já acabaram (os dias da
// semana da Meta, até ontem), em quantos o consultor tem o dia batido gravado
// (stronix_daily_goal_history). A mesma conta do metaDaysSummary do
// Operacional, juntando os meses do período.
export function metaDiariaDoConsultor({ history, metaWeekdays, consultantId, periodo, agora }) {
  const batidos = new Set((history || []).filter((h) => h?.consultantId === consultantId).map((h) => h.date));
  const dias = mesesDoPeriodo(periodo, agora)
    .flatMap((key) => metaDaysOfMonth(key, metaWeekdays, agora))
    .filter((d) => d.state === 'closed' && d.start >= periodo.inicio && d.start < periodo.fim)
    .map((d) => ({ key: d.key, inicio: d.start, bateu: batidos.has(d.key) }))
    .reverse();
  const bateram = dias.filter((d) => d.bateu).length;
  return { dias, bateram, total: dias.length, taxa: pct(bateram, dias.length) };
}

// Tudo o que a lista e o perfil mostram de um consultor no período, mais os
// `resultados` que o placarDe recebe. As vendas no placar são por mês, em reais
// arredondados ou em quantidade com uma casa.
export function contasDoConsultor({ trilha, periodo, pessoa, crm, users, funnels, contratos, clientesPorId, graceDays, metaWeekdays, history, agora = new Date() }) {
  const id = pessoa.id;
  const conversao = conversaoDoConsultor({ months: crm?.months, leadsById: crm?.leadsById, users, funnels, consultantId: id, periodo, agora });
  const vendasEm = trilha?.ajustes?.vendasEm === 'quantidade' ? 'quantidade' : 'reais';
  const vendas = vendasDoConsultor({ contratos, consultantId: id, periodo, agora, vendasEm });
  const renovacao = renovacaoDoConsultor({ contratos, clientesPorId, graceDays, consultantId: id, periodo, agora });
  const metaDiaria = metaDiariaDoConsultor({ history, metaWeekdays, consultantId: id, periodo, agora });
  const porMes = vendas.valor == null ? null
    : vendasEm === 'quantidade' ? Math.round(vendas.valor * 10) / 10 : Math.round(vendas.valor);
  return {
    conversao,
    vendas,
    vendasEm,
    renovacao,
    metaDiaria,
    resultados: {
      consultorConversao: { valor: conversao.consultor.taxa, academia: conversao.academia.taxa },
      vendas: { valor: porMes },
      consultorRenovacao: { valor: renovacao.taxa },
      metaDiaria: { valor: metaDiaria.taxa },
    },
  };
}
