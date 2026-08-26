// Regras puras do funil de sistema RENOVAÇÕES no board (pipeline): discriminador,
// colunas derivadas dos marcos, projeção dos cards e o plano idempotente do
// provisionamento. Sem React e sem Firestore — o COMO gravar fica nos callers.
//
// Espelha src/lib/expiredFunnel.js, o irmão que cobre o outro lado do corte.
// A diferença que simplifica tudo: aqui NINGUÉM arrasta entre colunas, então
// não existe campo de etapa gravada (o Vencidos precisa de reactivationStageId
// e de zerá-lo em buildMatriculaWrites). A coluna é 100% derivada, sempre.
//
// NÃO confundir com src/lib/renewalGoal.js: lá é a TAREFA diária da Meta, que
// cobra o cliente uma vez em cada marco e solta. Aqui é a COLUNA do board, onde
// ele fica parado até renovar ou vencer.

import { normalizeRenewalCheckpoints } from './leadStatus.js';
import { CONTRACT_STATUS } from './contracts.js';

// Discriminador. NUNCA casar por nome: a academia pode ter um funil "Renovações"
// próprio — os dois convivem e só este flag diferencia.
export const RENEWAL_FUNNEL_KIND = 'renewal';
export const RENEWAL_FUNNEL_NAME = 'Renovações';
// Entre Indicações e Vencidos (order 99) na barra de funis: é a ordem da esteira.
export const RENEWAL_FUNNEL_ORDER = 98;

// Teto de colunas. Os marcos são configuráveis e normalizeRenewalCheckpoints
// (src/lib/leadStatus.js) limita o VALOR de cada um (1..365) mas não QUANTOS —
// inofensivo enquanto eles só alimentavam a Meta, caro agora que cada marco vira
// uma query. Corta-se por CIMA: a menor coluna que sobra cobre [0, C_min] e
// absorve todo mundo abaixo dela, então nenhum card fica órfão. Cortar os
// maiores encolheria a janela do board e deixaria cliente sem lugar nenhum.
export const RENEWAL_MAX_COLUMNS = 6;

// Do mais frio ao mais quente. Só chaves que existem em KANBAN_COLUMN_ACCENT
// (src/lib/kanban.js) — nome fora da paleta cai no fallback cinza em silêncio.
const COLUMN_COLORS = ['gray', 'blue', 'teal', 'yellow', 'orange', 'red'];

export const isRenewalFunnel = (f) => f?.systemKind === RENEWAL_FUNNEL_KIND;

// createdAt em ms aceitando Timestamp ({toMillis}/{seconds}), Date ou número.
const createdAtMs = (f) => {
  const v = f?.createdAt;
  if (!v) return Infinity;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return Infinity;
};

// Duplicata (corrida do provisionamento em duas abas de admin) resolve
// determinístico: vence o createdAt mais antigo.
export const getRenewalFunnel = (funnels) => {
  const list = (funnels || []).filter(isRenewalFunnel);
  if (!list.length) return null;
  return list.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

// As COLUNAS do board, derivadas dos marcos. Nenhum documento em
// stronix_statuses: mudou a config, muda o board no render seguinte.
//
// Cada coluna carrega a faixa que ela cobre: (prevDays, days]. A menor tem
// prevDays 0, então ela pega todo mundo entre hoje e o menor marco.
//
// Essa faixa é a tradução fiel de activeRenewalCheckpoint (src/lib/renewalGoal.js),
// a função que a Meta Diária usa para decidir o marco. NÃO existe função de ponte
// aqui de propósito: recalcular a coluna do card com um "agora" diferente do corte
// da query discordaria na borda. Quem garante que board e Meta concordam é o teste
// "as faixas das colunas traduzem activeRenewalCheckpoint".
export const renewalColumnsFromCheckpoints = (checkpoints) => {
  // A normalização é a MESMA das Configurações (normalizeRenewalCheckpoints, em
  // leadStatus.js): inteiros de 1 a 365, sem repetição, do maior para o menor, e
  // nunca vazia — sem marco válido ela cai no padrão 90/60/30. Reescrever a regra
  // aqui faria o board e o campo que grava o valor discordarem com o tempo.
  const usados = normalizeRenewalCheckpoints(checkpoints).slice(0, RENEWAL_MAX_COLUMNS);

  return usados.map((days, i) => ({
    // id sintético: as colunas não existem no banco, mas o React precisa de key.
    id: `ck:${days}`,
    name: `${days} ${days === 1 ? 'dia' : 'dias'}`,
    days,
    // Piso EXCLUSIVO da faixa. A última coluna desce até 0 e absorve o resto.
    prevDays: i === usados.length - 1 ? 0 : usados[i + 1],
    // A cor sai do FIM da lista: a coluna que vence primeiro é sempre a mais
    // quente, tenha o board três colunas ou seis. Indexar do começo daria os
    // tons mais frios para um board de 3 colunas, e a mais urgente delas
    // apareceria fria.
    color: COLUMN_COLORS[COLUMN_COLORS.length - (usados.length - i)] || COLUMN_COLORS[0],
    order: i,
  }));
};

// Cliente que não tem o que renovar some do board inteiro. Espelha o que
// shouldPromptRenewal (renewalGoal.js) já exclui da Meta: contrato cancelado
// pelo próprio consultor, ou trancado (a vigência está congelada e volta a
// correr na reativação).
// A TERCEIRA exclusão de shouldPromptRenewal não está aqui: contrato já VENCIDO
// (que passa a ser cobrado pelo funil Vencidos) é cortado pela FAIXA DA QUERY de
// cada coluna, que só alcança contrato vencendo daqui para a frente. Não adianta
// procurar por ela neste arquivo.
export const isRenewalEligible = (lead) =>
  lead?.currentContractStatus !== CONTRACT_STATUS.CANCELADO &&
  lead?.currentContractStatus !== CONTRACT_STATUS.TRANCADO;

// Projeta os clientes como cards do board, coluna a coluna.
//
// `pagesByDays` é { [days]: lead[] } — a página que a query daquela coluna
// trouxe. A coluna NÃO é recalculada aqui: a faixa da query já garante o
// pertencimento, e recalcular com um "agora" diferente do corte da query
// discordaria na borda.
//
// As colunas do Kanban casam por NOME e os cards são agrupados por `lead.status`
// (ver partitionLeadsByStatus). Cliente é `status: 'Venda'`, então sem projeção
// todos cairiam na coluna Venda. Aqui o status EXIBIDO vira o nome da coluna.
//
// A projeção é SÓ EM MEMÓRIA: o `status` real do documento continua 'Venda', e é
// o que preserva o estado de cliente e a aba Clientes.
//
// `_renewalCard` marca o card projetado e `_renewalDays` carrega o marco ativo —
// o handler de drop precisa dele para gravar renewalDecline.
//
// ORDEM: o Map já sai ordenado por vencimento, quem vence primeiro no topo,
// porque a query de cada coluna ordena por currentContractEndsAt ASC. Este
// resultado NÃO pode passar por partitionLeadsByStatus (kanban.js), que é como o
// funil Vencidos monta as colunas dele: aquela função reordena cada coluna por
// prioridade de nextFollowUp, e cliente de renovação PODE ter esse campo —
// renewalReschedule grava um ao reagendar. Passando por lá, quem tem contato
// marcado sobe na frente de quem vence antes: o board fica plausível, fica
// errado, e nenhum teste pega.
export const splitRenewalForBoard = (pagesByDays, columns) => {
  const cols = Array.isArray(columns) ? columns : [];
  const cardsByColumn = new Map();
  const declined = [];

  cols.forEach((col) => {
    const page = (pagesByDays?.[col.days] || []).filter(isRenewalEligible);
    const cards = [];
    page.forEach((lead) => {
      const marcado = { ...lead, _renewalCard: true, _renewalDays: col.days };
      // Quem recusou sai das colunas e vai para a Perda, que o board já
      // renderiza em todo funil. Ele continua CLIENTE — muda só onde o card
      // aparece, nunca o lifecycleBucket.
      //
      // O status EXIBIDO dele é 'Perda' pela MESMA regra dos outros: é o nome da
      // coluna onde o card está. Mantendo o 'Venda' do documento, os guards de
      // "já está aí" tratavam o recusado como venda fechada e fechavam a única
      // saída que importa: handleWinDrop tem `if (lead.status === 'Venda')
      // return`, então arrastar da Perda para Venda era no-op silencioso, e o
      // MoveLeadModal filtra `t.name !== lead.status`, então nem oferecia Venda
      // no celular — da Perda não dava para renovar. De quebra o card saía no
      // tom verde de ganho, com o valor do plano no rodapé.
      if (lead?.renewalDeclined) declined.push({ ...marcado, status: 'Perda' });
      else cards.push({ ...marcado, status: col.name });
    });
    cardsByColumn.set(col.name, cards);
  });

  return { cardsByColumn, declined };
};

// Plano idempotente do provisionamento. Só o FUNIL — as colunas são virtuais,
// então não há etapa nenhuma para criar.
export const planRenewalSetupOps = ({ funnels } = {}) => {
  if (getRenewalFunnel(funnels)) return { createFunnel: null };
  return {
    createFunnel: {
      name: RENEWAL_FUNNEL_NAME,
      systemKind: RENEWAL_FUNNEL_KIND,
      order: RENEWAL_FUNNEL_ORDER,
    },
  };
};
