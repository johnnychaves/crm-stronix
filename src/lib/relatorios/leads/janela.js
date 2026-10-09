// Carga dos Relatórios de Leads (spec 2026-10-09, "A carga" e "As contas").
// Puro. A carga é a do painel CRM (useCrmSources), por mês e com a mesma
// memória de sessão: aqui se decide quais meses pedir e como juntar os baldes
// deles, do mesmo jeito que o painel faz (cacheOf, em src/lib/crm/metrics.js).

import { addMonthsToKey, monthKeyOf } from '../../operacional/month.js';
import { contactTimesByLead } from '../../crm/contact.js';
import { recordsByLeadOf, visitOutcomesByLead } from '../../crm/appointments.js';

// O mesmo teto do painel (crmMonthKeys): uma data torta não prende o laço.
const MAX_SPAN_MONTHS = 36;

// Meses que a tela pede, em ordem: do mês do início mais antigo (o período ou
// o comparado) até o mês atual. A safra da Conversão é acompanhada até agora,
// e o primeiro contato olha o mês seguinte ao do cadastro, então os meses
// depois do período também entram.
export function reportMonthKeys(period, cmp, currentKey) {
  const starts = [period?.start, cmp?.start].filter((d) => d instanceof Date).map((d) => d.getTime());
  if (!starts.length) return [currentKey];
  const keys = [];
  let k = monthKeyOf(new Date(Math.min(...starts)));
  for (let i = 0; i < MAX_SPAN_MONTHS && k <= currentKey; i++, k = addMonthsToKey(k, 1)) keys.push(k);
  return keys.length ? keys : [currentKey];
}

// Um balde (leadsCreated, converted, lost, aulas ou interactions) de todos os
// meses carregados, sem repetir id, com a cópia do mês mais novo: o registro
// remarcado de agosto para setembro continua na lista de agosto e contaria
// duas vezes (o newestRecordsOf do painel faz o mesmo com os registros).
export function bucketOf(months, bucket) {
  const seen = new Set();
  const out = [];
  Object.keys(months || {}).sort().reverse().forEach((key) => {
    (months[key]?.[bucket] || []).forEach((x) => {
      if (!x?.id || seen.has(x.id)) return;
      seen.add(x.id);
      out.push(x);
    });
  });
  return out;
}

// Índices de toda a carga, os mesmos do painel: registros de agendamento por
// lead, instantes de contato e desfechos de visita pela linha do tempo. Os
// registros vão sem repetir id, com a cópia do mês mais novo. As interações
// entram como no cacheOf do painel, sem tirar repetidos aqui: as duas funções
// do painel (contactTimesByLead e visitOutcomesByLead) já tiram pelo id, e a
// interação que veio sem id continua contando.
export function reportIndex(months) {
  const interactions = Object.values(months || {}).flatMap((m) => m.interactions || []);
  const records = bucketOf(months, 'aulas');
  return {
    records,
    recordsByLead: recordsByLeadOf(records),
    contactTimes: contactTimesByLead(interactions),
    visitOutcomes: visitOutcomesByLead(interactions),
  };
}

// Estado da carga dos meses pedidos: pronta quando todos chegaram; com falha
// quando algum falhou, e aí a tela mostra o aviso e nenhum número.
export function loadState(months, keys) {
  const entries = (keys || []).map((k) => months?.[k] || null);
  return { ready: entries.every(Boolean), failed: entries.some((e) => Boolean(e?.failed)) };
}
