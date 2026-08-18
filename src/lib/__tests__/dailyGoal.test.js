// Testes de CARACTERIZAÇÃO da Meta Diária (dailyGoal.js). Cada caso congela o
// comportamento ATUAL das funções puras — inclusive comportamentos estranhos,
// que ficam documentados em comentário (não "corrigidos" aqui). Datas sempre
// construídas em horário LOCAL, como o app faz. O relógio é falso e fixado em
// quarta-feira 15/07/2026 10:00 (funções que leem `new Date()` dependem disso).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeDailyGoalSlots,
  computeVolumeInRange,
  computeDailyVolume,
  listVolumeActionsInRange,
  interactionOwnerAuthUid,
  buildInteractionsByLead,
  countMetaDaysInMonth,
  countClosedMetaDaysInMonth,
  countMetaDaysInMonthAll,
  countMetaDaysInRange,
  countHitsInRange,
  volumeTargetFor,
  overdueDaysOf,
  computeRitmo,
  slotTotals,
  dgDateKey,
  DG_CATEGORY_ORDER,
  DG_CATEGORY_META,
  COLOR_TONES
} from '../dailyGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

// Quarta-feira, 15 de julho de 2026, 10:00 local — "agora" de referência.
const NOW = new Date(2026, 6, 15, 10, 0, 0);

let seq = 0;
const lead = (over = {}) => ({
  id: over.id || `l${++seq}`,
  name: 'Lead Teste',
  status: 'Contato',
  consultantId: 'u1',
  createdAt: new Date(2026, 6, 10),
  nextFollowUp: null,
  ...over
});

// Interações mínimas com os campos que as funções leem.
const goalDone = (leadId, category, createdAt = new Date(2026, 6, 15, 9, 0)) => ({
  leadId,
  type: 'daily_goal_done',
  dailyGoalCategory: category,
  createdAt
});

// computeDailyGoalSlots exige o Map de interações por lead (não aceita array).
// O 4º argumento agora são os MARCOS de renovação (renewalCheckpoints), não
// mais um threshold único — ver src/lib/renewalGoal.js.
const slots = (leads, interactions = [], renewalCheckpoints = undefined) =>
  computeDailyGoalSlots(leads, buildInteractionsByLead(interactions), 'u1', renewalCheckpoints);

const byId = (arr, id) => arr.find((l) => l.id === id);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeDailyGoalSlots — categorias', () => {
  it('novo_24h: só lead criado ANTES de hoje e dentro das últimas 24h', () => {
    const dentro = lead({ createdAt: new Date(2026, 6, 14, 15, 0) }); // ontem 15:00
    const criadoHoje = lead({ createdAt: new Date(2026, 6, 15, 9, 0) }); // hoje não entra
    const result = slots([dentro, criadoHoje]);
    expect(byId(result, dentro.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.NOVO_24H]);
    expect(byId(result, criadoHoje.id)).toBeUndefined();
  });

  it('novo_24h EXPIRA 24h após o cadastro, não no fim do dia seguinte (janela [agora-24h, 00:00 de hoje))', () => {
    // Caracterização: às 10:00 de hoje, um lead criado ontem às 08:00 já saiu
    // da categoria (mais de 24h atrás) — a tarefa "some" no meio do dia.
    const expirado = lead({ createdAt: new Date(2026, 6, 14, 8, 0) });
    expect(slots([expirado])).toEqual([]);
  });

  it('atrasado: nextFollowUp vencido antes de hoje; follow-up de hoje NÃO é atraso', () => {
    const atrasado = lead({ nextFollowUp: new Date(2026, 6, 13, 9, 0) });
    const deHoje = lead({ nextFollowUp: new Date(2026, 6, 15, 9, 0) });
    const result = slots([atrasado, deHoje]);
    expect(byId(result, atrasado.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.ATRASADO]);
    // O follow-up de hoje (mesmo com hora já passada) cai em contato_hoje.
    expect(byId(result, deHoje.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('visita_hoje: agendamento tipo visita com data dentro de hoje', () => {
    const hoje = lead({ appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 15, 14, 0) });
    const amanha = lead({ appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 16, 14, 0) });
    const result = slots([hoje, amanha]);
    expect(byId(result, hoje.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
    expect(byId(result, amanha.id)).toBeUndefined();
  });

  it('campos legados (nextFollowUpType) normalizam pra visita/aula e NÃO caem em contato_hoje', () => {
    const visitaLegada = lead({ nextFollowUpType: 'Visita', nextFollowUp: new Date(2026, 6, 15, 14, 0) });
    const aulaLegada = lead({ nextFollowUpType: 'Aula Experimental', nextFollowUp: new Date(2026, 6, 15, 11, 0) });
    const result = slots([visitaLegada, aulaLegada]);
    expect(byId(result, visitaLegada.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
    expect(byId(result, aulaLegada.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.AULA_HOJE]);
  });

  it('aula_hoje: agendamento aula_experimental hoje', () => {
    const l = lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 15, 18, 0) });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.AULA_HOJE]);
  });

  it('contato_hoje: nextFollowUp hoje sem tipo de agendamento', () => {
    const l = lead({ nextFollowUp: new Date(2026, 6, 15, 16, 0) });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  // Regressão do bug relatado em 18/08/2026: agendar mensagem depois de uma aula
  // apagava a aula. Com o compromisso PRESERVADO, a categoria 5 não pode mais se
  // esconder pelo TIPO do agendamento, senão a mensagem some da Meta e o
  // consultor perde a tarefa. O critério passa a ser a DATA.
  it('contato_hoje: aparece mesmo com aula FUTURA marcada no lead', () => {
    const l = lead({
      appointmentType: 'aula_experimental',
      appointmentScheduledFor: new Date(2026, 6, 20, 18, 0), // semana que vem
      nextFollowUp: new Date(2026, 6, 15, 16, 0),            // mensagem de hoje
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('contato_hoje: aparece mesmo com visita FUTURA marcada no lead', () => {
    const l = lead({
      appointmentType: 'visita',
      appointmentScheduledFor: new Date(2026, 6, 22, 9, 0),
      nextFollowUp: new Date(2026, 6, 15, 16, 0),
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  // A supressão existe porque agendar uma AULA também grava nextFollowUp: sem
  // ela, todo lead com aula hoje apareceria como Contato Hoje por tabela. O
  // critério é o CANAL do follow-up, não a data: 'Aula Experimental' no
  // nextFollowUpType é só o eco do compromisso.
  it('contato_hoje NÃO duplica com o eco da própria aula', () => {
    const l = lead({
      appointmentType: 'aula_experimental',
      appointmentScheduledFor: new Date(2026, 6, 15, 18, 0),
      nextFollowUp: new Date(2026, 6, 15, 18, 0),
      nextFollowUpType: 'Aula Experimental',
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.AULA_HOJE]);
  });

  // Cenário que o Johnny testou ao vivo em 18/08/2026: aula marcada para hoje
  // E mensagem de confirmação marcada para hoje. São DUAS tarefas reais — a
  // aula para atender e a mensagem para mandar — e as duas têm que aparecer.
  it('aula hoje + mensagem hoje geram as DUAS tarefas', () => {
    const l = lead({
      appointmentType: 'aula_experimental',
      appointmentScheduledFor: new Date(2026, 6, 15, 18, 0),
      nextFollowUp: new Date(2026, 6, 15, 18, 0),
      nextFollowUpType: 'Mensagem',
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([
      DAILY_GOAL_CATEGORIES.AULA_HOJE,
      DAILY_GOAL_CATEGORIES.CONTATO_HOJE,
    ]);
  });

  it('visita hoje + ligação hoje geram as DUAS tarefas', () => {
    const l = lead({
      appointmentType: 'visita',
      appointmentScheduledFor: new Date(2026, 6, 15, 9, 0),
      nextFollowUp: new Date(2026, 6, 15, 15, 0),
      nextFollowUpType: 'Ligação',
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([
      DAILY_GOAL_CATEGORIES.VISITA_HOJE,
      DAILY_GOAL_CATEGORIES.CONTATO_HOJE,
    ]);
  });

  it('contato_hoje: aparece mesmo com aula FUTURA marcada no lead', () => {
    const l = lead({
      appointmentType: 'aula_experimental',
      appointmentScheduledFor: new Date(2026, 6, 20, 18, 0), // semana que vem
      nextFollowUp: new Date(2026, 6, 15, 16, 0),            // mensagem de hoje
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('contato_hoje: aparece mesmo com visita FUTURA marcada no lead', () => {
    const l = lead({
      appointmentType: 'visita',
      appointmentScheduledFor: new Date(2026, 6, 22, 9, 0),
      nextFollowUp: new Date(2026, 6, 15, 16, 0),
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });


  it('um lead pode ocupar mais de uma categoria (uma entrada, vários slugs)', () => {
    // Criado ontem 20:00 (dentro da janela 24h) E com follow-up vencido.
    const l = lead({ createdAt: new Date(2026, 6, 14, 20, 0), nextFollowUp: new Date(2026, 6, 13, 9, 0) });
    const result = slots([l]);
    expect(result.length).toBe(1);
    expect(result[0].categorySlugs.sort()).toEqual(
      [DAILY_GOAL_CATEGORIES.NOVO_24H, DAILY_GOAL_CATEGORIES.ATRASADO].sort()
    );
  });

  it('filtra por consultantId: lead de outro consultor não gera slot', () => {
    const outro = lead({ consultantId: 'u2', nextFollowUp: new Date(2026, 6, 13) });
    expect(slots([outro])).toEqual([]);
  });

  it('ordena por createdAt decrescente (mais novo primeiro)', () => {
    const antigo = lead({ createdAt: new Date(2026, 6, 10), nextFollowUp: new Date(2026, 6, 13) });
    const novo = lead({ createdAt: new Date(2026, 6, 14, 20, 0) });
    const result = slots([antigo, novo]);
    expect(result.map((l) => l.id)).toEqual([novo.id, antigo.id]);
  });
});

describe('computeDailyGoalSlots — renovação (marcos configuráveis, renewalGoal.js)', () => {
  const cliente = (over = {}) =>
    lead({
      lifecycleStage: 'cliente',
      status: 'Venda',
      convertedAt: new Date(2026, 5, 1),
      currentContractStatus: 'ativo',
      renewalHandledCheckpoints: [],
      renewalDeclined: false,
      ...over
    });

  it('cliente com marco ativo (default [90,60,30]) entra em renovacao mesmo sendo status Venda', () => {
    const c = cliente({ currentContractEndsAt: new Date(2026, 6, 30) }); // vence em 15 dias → marco 30
    const result = slots([c]);
    expect(byId(result, c.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.RENOVACAO]);
    expect(byId(result, c.id).categoryStatus[DAILY_GOAL_CATEGORIES.RENOVACAO]).toBe(false);
  });

  it('os marcos SUBSTITUEM o threshold único: 40 dias fora já entra no marco 60 (default), sem marco nenhum com [30] só', () => {
    const c = cliente({ currentContractEndsAt: new Date(2026, 7, 24) }); // +40 dias
    // Default [90,60,30]: 40 dias cai no marco 60 (menor marco >= 40).
    expect(byId(slots([c]), c.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.RENOVACAO]);
    // Com um único marco de 30, 40 dias ainda não alcançou nenhum marco.
    expect(slots([c], [], [30])).toEqual([]);
  });

  it('marco já tratado (renewalHandledCheckpoints) some da meta; outro marco ainda não tratado volta a entrar', () => {
    const tratado = cliente({ currentContractEndsAt: new Date(2026, 6, 30), renewalHandledCheckpoints: [30] }); // marco ativo = 30, já tratado
    expect(slots([tratado])).toEqual([]);
    const outroMarco = cliente({ currentContractEndsAt: new Date(2026, 7, 9), renewalHandledCheckpoints: [90] }); // +25 dias → marco 30, 90 é outro marco
    expect(byId(slots([outroMarco]), outroMarco.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.RENOVACAO]);
  });

  it('renewalDeclined=true nunca entra, mesmo com marco ativo não tratado', () => {
    const c = cliente({ currentContractEndsAt: new Date(2026, 6, 30), renewalDeclined: true });
    expect(slots([c])).toEqual([]);
  });

  it('cliente REAGENDADO (marco em handled + nextFollowUp hoje) sai de Renovações e vira Contato', () => {
    // Efeito do desfecho "Reagendar": marca o marco atual como tratado e grava
    // um nextFollowUp de contato. O cliente (status Venda) passa a aparecer em
    // Contatos — não mais em Renovações (regra em src/lib/renewalGoal.js +
    // exceção de cliente na categoria Contato).
    const c = cliente({
      currentContractEndsAt: new Date(2026, 6, 30), // marco ativo era 30
      renewalHandledCheckpoints: [30],
      nextFollowUp: new Date(2026, 6, 15, 14, 0),   // hoje
      nextFollowUpType: 'Mensagem'
    });
    expect(byId(slots([c]), c.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('cliente REAGENDADO volta a Renovações quando chega o PRÓXIMO marco', () => {
    // handled=[90] (reagendou no marco 90). Quando o prazo cai pra faixa do 60,
    // o marco ativo (60) não está em handled → reaparece em Renovações. Sem
    // nextFollowUp de hoje aqui (a data do contato anterior já passou).
    const c = cliente({ currentContractEndsAt: new Date(2026, 7, 29), renewalHandledCheckpoints: [90] }); // +45 dias → marco 60
    expect(byId(slots([c]), c.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.RENOVACAO]);
  });

  it('contrato vencido não entra mais em Renovações — vira tarefa do funil Vencidos', () => {
    // Comportamento MUDOU de propósito: antes esse cliente ainda entrava aqui,
    // dentro da tolerância de 15 dias depois do vencimento. Agora a Renovação
    // para no dia do vencimento (corte limpo, src/lib/renewalGoal.js) e quem
    // venceu vira tarefa do funil Vencidos (src/lib/expiredGoal.js) — a
    // categoria já está ligada em computeDailyGoalSlots (Task 3).
    const vencido = cliente({ currentContractEndsAt: new Date(2026, 6, 14) }); // ontem
    const result = slots([vencido]);
    expect(byId(result, vencido.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VENCIDO]);
  });

  it('contrato cancelado, sem endsAt ou sem lifecycleStage cliente não entram', () => {
    const cancelado = cliente({ currentContractEndsAt: new Date(2026, 6, 30), currentContractStatus: 'cancelado' });
    const semVigencia = cliente({ currentContractEndsAt: null }); // legado
    const semStage = lead({ status: 'Venda', currentContractStatus: 'ativo', currentContractEndsAt: new Date(2026, 6, 20) });
    expect(slots([cancelado, semVigencia, semStage])).toEqual([]);
  });

  it('renovacao fecha por daily_goal_done da categoria', () => {
    const c = cliente({ currentContractEndsAt: new Date(2026, 6, 30) });
    const result = slots([c], [goalDone(c.id, DAILY_GOAL_CATEGORIES.RENOVACAO)]);
    expect(byId(result, c.id).categoryStatus[DAILY_GOAL_CATEGORIES.RENOVACAO]).toBe(true);
  });

  it('cliente convertido HOJE com marco ativo nasce com renovacao já concluída (isLeadResolvedToday)', () => {
    // Caracterização: convertedAt >= 00:00 de hoje + status Venda auto-conclui
    // a categoria — única categoria em que esse auto-done é observável, porque
    // as demais excluem status Venda antes de olhar a conclusão.
    const c = cliente({ convertedAt: new Date(2026, 6, 15, 9, 0), currentContractEndsAt: new Date(2026, 6, 30) });
    const result = slots([c]);
    expect(byId(result, c.id).categoryStatus[DAILY_GOAL_CATEGORIES.RENOVACAO]).toBe(true);
  });
});

describe('computeDailyGoalSlots — conclusão e guards de Venda/Perda', () => {
  it('daily_goal_done de hoje marca a categoria como feita; de ontem não', () => {
    const l = lead({ nextFollowUp: new Date(2026, 6, 13) });
    const feito = slots([l], [goalDone(l.id, DAILY_GOAL_CATEGORIES.ATRASADO)]);
    expect(byId(feito, l.id).categoryStatus[DAILY_GOAL_CATEGORIES.ATRASADO]).toBe(true);

    const ontem = slots([l], [goalDone(l.id, DAILY_GOAL_CATEGORIES.ATRASADO, new Date(2026, 6, 14, 18, 0))]);
    expect(byId(ontem, l.id).categoryStatus[DAILY_GOAL_CATEGORIES.ATRASADO]).toBe(false);
  });

  it('aceita a categoria também em metadata.category (formato antigo)', () => {
    const l = lead({ nextFollowUp: new Date(2026, 6, 13) });
    const interaction = {
      leadId: l.id,
      type: 'daily_goal_done',
      metadata: { category: DAILY_GOAL_CATEGORIES.ATRASADO },
      createdAt: new Date(2026, 6, 15, 9, 0)
    };
    const result = slots([l], [interaction]);
    expect(byId(result, l.id).categoryStatus[DAILY_GOAL_CATEGORIES.ATRASADO]).toBe(true);
  });

  it('tarefa concluída hoje continua visível como FEITA mesmo saindo da condição viva', () => {
    // Concluir um Contato agenda o próximo toque (nextFollowUp amanhã) — o lead
    // sai da categoria viva, mas o passe de "concluídas hoje" readiciona o slot.
    const l = lead({ nextFollowUp: new Date(2026, 6, 16, 9, 0) });
    const result = slots([l], [goalDone(l.id, DAILY_GOAL_CATEGORIES.CONTATO_HOJE)]);
    expect(byId(result, l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
    expect(byId(result, l.id).categoryStatus[DAILY_GOAL_CATEGORIES.CONTATO_HOJE]).toBe(true);
  });

  it('lead vendido HOJE some dos slots MESMO com tarefa concluída hoje', () => {
    // Caracterização: o guard status==='Venda' vale nas condições vivas E no
    // passe de concluídas — vender o lead apaga o slot (feito) do dia, então o
    // total de tarefas do consultor DIMINUI em vez de contar como concluído.
    const vendido = lead({
      status: 'Venda',
      convertedAt: new Date(2026, 6, 15, 9, 30),
      nextFollowUp: new Date(2026, 6, 13)
    });
    const result = slots([vendido], [goalDone(vendido.id, DAILY_GOAL_CATEGORIES.ATRASADO, new Date(2026, 6, 15, 8, 0))]);
    expect(result).toEqual([]);
  });

  it('lead perdido hoje também some dos slots', () => {
    const perdido = lead({ status: 'Perda', lostAt: new Date(2026, 6, 15, 9, 0), nextFollowUp: new Date(2026, 6, 13) });
    expect(slots([perdido])).toEqual([]);
  });

  it('hasOtherActivityToday: nota de hoje liga o badge; observação de cadastro e daily_goal_done não', () => {
    const comNota = lead({ nextFollowUp: new Date(2026, 6, 13) });
    const comCadastro = lead({ nextFollowUp: new Date(2026, 6, 13) });
    const interactions = [
      { leadId: comNota.id, type: 'note', text: 'liguei e combinei visita', createdAt: new Date(2026, 6, 15, 9, 0) },
      { leadId: comCadastro.id, type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: veio do insta', createdAt: new Date(2026, 6, 15, 9, 0) }
    ];
    const result = slots([comNota, comCadastro], interactions);
    expect(byId(result, comNota.id).hasOtherActivityToday).toBe(true);
    expect(byId(result, comCadastro.id).hasOtherActivityToday).toBe(false);
  });
});

describe('slotTotals', () => {
  it('soma slots por lead×categoria e arredonda o progresso', () => {
    const processed = [
      { categorySlugs: ['a', 'b', 'c'], categoryStatus: { a: true, b: false, c: false } }
    ];
    expect(slotTotals(processed)).toEqual({ totalSlots: 3, doneSlots: 1, progress: 33 });
  });

  it('meta vazia = 100%', () => {
    expect(slotTotals([])).toEqual({ totalSlots: 0, doneSlots: 0, progress: 100 });
  });
});

describe('computeVolumeInRange', () => {
  const FROM = new Date(2026, 6, 13, 0, 0, 0, 0);
  const TO = new Date(2026, 6, 15, 0, 0, 0, 0);

  it('leads novos: createdAt em [from, to) do consultor certo', () => {
    const leads = [
      lead({ createdAt: new Date(2026, 6, 13, 0, 0) }), // exatamente em from → conta
      lead({ createdAt: new Date(2026, 6, 14, 23, 0) }),
      lead({ createdAt: new Date(2026, 6, 12, 23, 59) }), // antes → não
      lead({ createdAt: new Date(2026, 6, 15, 0, 0) }), // exatamente em to → não (exclusivo)
      lead({ consultantId: 'u2', createdAt: new Date(2026, 6, 14) }) // outro consultor
    ];
    const v = computeVolumeInRange(leads, [], 'u1', 'a1', FROM, TO);
    expect(v).toEqual({ total: 2, agendamentos: 0, leadsNovos: 2 });
  });

  it('agendamentos: interações com volumeKind cujo actorAuthUid é o consultor', () => {
    const interactions = [
      { actorAuthUid: 'a1', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 10, 0) },
      { actorAuthUid: 'a1', volumeKind: 'mensagem', createdAt: new Date(2026, 6, 14, 11, 0) },
      { actorAuthUid: 'a1', type: 'note', createdAt: new Date(2026, 6, 14, 12, 0) }, // sem volumeKind → não
      { actorAuthUid: 'a2', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 13, 0) } // outro autor → não
    ];
    const v = computeVolumeInRange([], interactions, 'u1', 'a1', FROM, TO);
    expect(v).toEqual({ total: 2, agendamentos: 2, leadsNovos: 0 });
  });

  it('PR C: interação só com leadConsultantAuthUid (sem actor/consultant) AGORA conta (fallback)', () => {
    // Antes da PR C o filtro olhava direto i.consultantAuthUid (sempre ausente),
    // então interações antigas/importadas que só carregam leadConsultantAuthUid
    // eram ignoradas e "agendamentos" ficava subcontado. Com interactionOwnerAuthUid
    // o dono cai no dono do LEAD quando não há autor da ação — passa a contar.
    const interactions = [
      { leadConsultantAuthUid: 'a1', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 10, 0) }
    ];
    const v = computeVolumeInRange([], interactions, 'u1', 'a1', FROM, TO);
    expect(v).toEqual({ total: 1, agendamentos: 1, leadsNovos: 0 });
  });

  it('precedência do autor: actorAuthUid de OUTRO usuário não conta, mesmo com leadConsultantAuthUid do consultor', () => {
    // A ação foi FEITA por a2 (actor) sobre um lead cujo dono é a1. Volume é
    // esforço de quem AGIU: actorAuthUid tem precedência, então não entra no
    // volume de a1 (nem seria contado como se a1 tivesse trabalhado).
    const interactions = [
      { actorAuthUid: 'a2', leadConsultantAuthUid: 'a1', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 10, 0) }
    ];
    const v = computeVolumeInRange([], interactions, 'u1', 'a1', FROM, TO);
    expect(v).toEqual({ total: 0, agendamentos: 0, leadsNovos: 0 });
    // ...e conta pro autor real (a2), pela mesma régua.
    const vAutor = computeVolumeInRange([], interactions, 'u1', 'a2', FROM, TO);
    expect(vAutor.agendamentos).toBe(1);
  });

  it('metaWeekdays: ação em dia fora da meta não entra (lead nem interação)', () => {
    const segASex = [1, 2, 3, 4, 5];
    const leads = [
      lead({ createdAt: new Date(2026, 6, 15, 8, 0) }), // quarta → conta
      lead({ createdAt: new Date(2026, 6, 18, 8, 0) }) // sábado → não
    ];
    const interactions = [
      { actorAuthUid: 'a1', volumeKind: 'ligacao', createdAt: new Date(2026, 6, 14, 10, 0) }, // terça → conta
      { actorAuthUid: 'a1', volumeKind: 'ligacao', createdAt: new Date(2026, 6, 18, 10, 0) } // sábado → não
    ];
    const v = computeVolumeInRange(leads, interactions, 'u1', 'a1', FROM, new Date(2026, 6, 20), segASex);
    expect(v).toEqual({ total: 2, agendamentos: 1, leadsNovos: 1 });
  });

  it('createdAt que não é Date (ex.: Timestamp cru) é ignorado', () => {
    const leads = [lead({ createdAt: { seconds: new Date(2026, 6, 14).getTime() / 1000 } })];
    const v = computeVolumeInRange(leads, [], 'u1', 'a1', FROM, TO);
    expect(v.leadsNovos).toBe(0);
  });
});

describe('computeDailyVolume (janela = hoje, relógio falso)', () => {
  it('conta lead criado hoje e interação de hoje; ontem fica fora', () => {
    const leads = [
      lead({ createdAt: new Date(2026, 6, 15, 8, 0) }),
      lead({ createdAt: new Date(2026, 6, 14, 23, 0) })
    ];
    const interactions = [
      { actorAuthUid: 'a1', volumeKind: 'visita', createdAt: new Date(2026, 6, 15, 9, 0) },
      { actorAuthUid: 'a1', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 9, 0) }
    ];
    const v = computeDailyVolume(leads, interactions, 'u1', 'a1');
    expect(v).toEqual({ total: 2, agendamentos: 1, leadsNovos: 1 });
  });

  it('a janela de hoje é ABERTA no fim: ação datada de amanhã também conta', () => {
    // Caracterização: computeDailyVolume passa só o início do dia (to = null),
    // então qualquer createdAt futuro entra na conta de hoje.
    const interactions = [
      { consultantAuthUid: 'a1', volumeKind: 'mensagem', createdAt: new Date(2026, 6, 16, 9, 0) }
    ];
    const v = computeDailyVolume([], interactions, 'u1', 'a1');
    expect(v.agendamentos).toBe(1);
  });
});

describe('interactionOwnerAuthUid (dono da ação p/ volume — PR C)', () => {
  it('precedência: actorAuthUid > consultantAuthUid > leadConsultantAuthUid', () => {
    expect(interactionOwnerAuthUid({ actorAuthUid: 'a', consultantAuthUid: 'b', leadConsultantAuthUid: 'c' })).toBe('a');
    expect(interactionOwnerAuthUid({ consultantAuthUid: 'b', leadConsultantAuthUid: 'c' })).toBe('b');
    expect(interactionOwnerAuthUid({ leadConsultantAuthUid: 'c' })).toBe('c');
  });
  it('sem nenhum dono → null; usa ?? (string vazia é valor válido, não cai)', () => {
    expect(interactionOwnerAuthUid({})).toBe(null);
    expect(interactionOwnerAuthUid(null)).toBe(null);
    expect(interactionOwnerAuthUid({ actorAuthUid: '' })).toBe('');
  });
});

describe('listVolumeActionsInRange (extrato do volume — mesma régua do contador)', () => {
  const FROM = new Date(2026, 6, 13, 0, 0, 0, 0);
  const TO = new Date(2026, 6, 15, 0, 0, 0, 0);
  it('lista leads novos + agendamentos do dono resolvido, mais recente primeiro', () => {
    const leads = [lead({ id: 'l1', name: 'Ana', createdAt: new Date(2026, 6, 14, 8, 0) })];
    const interactions = [
      { leadId: 'l1', actorAuthUid: 'a1', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 10, 0) },
      { leadId: 'l1', leadConsultantAuthUid: 'a1', volumeKind: 'ligacao', createdAt: new Date(2026, 6, 14, 12, 0) }, // fallback conta
      { leadId: 'l1', actorAuthUid: 'a2', volumeKind: 'visita', createdAt: new Date(2026, 6, 14, 13, 0) }, // outro autor → fora
      { leadId: 'l1', actorAuthUid: 'a1', type: 'note', createdAt: new Date(2026, 6, 14, 14, 0) } // sem volumeKind → fora
    ];
    const out = listVolumeActionsInRange(leads, interactions, 'u1', 'a1', FROM, TO);
    expect(out).toHaveLength(3); // 1 lead novo + 2 agendamentos (visita + ligacao via fallback)
    expect(out[0].at.getTime()).toBeGreaterThanOrEqual(out[1].at.getTime()); // ordem desc
    expect(out.map(o => o.label)).toContain('Lead cadastrado');
  });
});

describe('buildInteractionsByLead', () => {
  it('agrupa por leadId preservando a ordem de chegada', () => {
    const i1 = { leadId: 'l1', type: 'note', createdAt: new Date(2026, 6, 14) };
    const i2 = { leadId: 'l2', type: 'note', createdAt: new Date(2026, 6, 14) };
    const i3 = { leadId: 'l1', type: 'daily_goal_done', createdAt: new Date(2026, 6, 15) };
    const map = buildInteractionsByLead([i1, i2, i3]);
    expect(map.size).toBe(2);
    expect(map.get('l1')).toEqual([i1, i3]);
    expect(map.get('l2')).toEqual([i2]);
  });

  it('entrada nula vira Map vazio', () => {
    expect(buildInteractionsByLead(null).size).toBe(0);
  });
});

describe('countMetaDaysInMonth / countMetaDaysInRange / countHitsInRange', () => {
  const SEG_A_SEX = [1, 2, 3, 4, 5];

  it('conta dias programados de 1º até a data de referência', () => {
    // Julho/2026 até dia 15: úteis = 1,2,3,6,7,8,9,10,13,14,15 → 11.
    expect(countMetaDaysInMonth(SEG_A_SEX, new Date(2026, 6, 15, 10, 0))).toBe(11);
    // Só sábados: 4 e 11 → 2.
    expect(countMetaDaysInMonth([6], new Date(2026, 6, 15, 10, 0))).toBe(2);
  });

  it('metaWeekdays null é seguro: nenhum dia conta', () => {
    expect(countMetaDaysInMonth(null, new Date(2026, 6, 15))).toBe(0);
    expect(countMetaDaysInRange(null, new Date(2026, 6, 13), new Date(2026, 6, 20))).toBe(0);
    expect(countHitsInRange([{ date: '2026-07-14' }], null, new Date(2026, 6, 13), new Date(2026, 6, 20))).toBe(0);
  });

  it('countMetaDaysInRange usa intervalo [from, to) — o dia de `to` fica fora', () => {
    // Seg 13/07 → dom 19/07 (to = 20/07 exclusivo): 13,14,15,16,17 → 5 úteis.
    expect(countMetaDaysInRange(SEG_A_SEX, new Date(2026, 6, 13), new Date(2026, 6, 20))).toBe(5);
    expect(countMetaDaysInRange(SEG_A_SEX, new Date(2026, 6, 13), new Date(2026, 6, 14))).toBe(1);
  });

  it('countHitsInRange: só hits dentro do intervalo E em dia programado', () => {
    const history = [
      { date: '2026-07-06' }, // segunda, dentro → conta
      { date: '2026-07-11' }, // sábado, dentro → dia fora da meta, não conta
      { date: '2026-07-13' }, // fora do intervalo (to exclusivo)
      { date: null }, // doc sem data → ignorado
      {}
    ];
    const n = countHitsInRange(history, SEG_A_SEX, new Date(2026, 6, 6), new Date(2026, 6, 13));
    expect(n).toBe(1);
  });
});

describe('volumeTargetFor (100% individual, sem padrão de academia)', () => {
  it('sem usuário → 0; alvo próprio vence e é capado em 500 (com floor)', () => {
    expect(volumeTargetFor(null)).toBe(0);
    expect(volumeTargetFor({ dailyVolumeTarget: 7 })).toBe(7);
    expect(volumeTargetFor({ dailyVolumeTarget: 7.9 })).toBe(7);
    expect(volumeTargetFor({ dailyVolumeTarget: 900 })).toBe(500);
  });

  it('0, vazio ou inválido = prospecção DESABILITADA', () => {
    expect(volumeTargetFor({ dailyVolumeTarget: 0 })).toBe(0);
    expect(volumeTargetFor({ dailyVolumeTarget: '' })).toBe(0);
    expect(volumeTargetFor({ dailyVolumeTarget: 'abc' })).toBe(0);
    expect(volumeTargetFor({ role: 'consultant' })).toBe(0); // sem alvo → sem meta
  });

  it('vale igual para consultor e gestor: só o alvo individual conta', () => {
    expect(volumeTargetFor({ role: 'admin', dailyVolumeTarget: 12 })).toBe(12);
    expect(volumeTargetFor({ role: 'consultant', dailyVolumeTarget: 10 })).toBe(10);
    // 2º argumento antigo (academyDefault) é ignorado — não existe mais padrão.
    expect(volumeTargetFor({ role: 'consultant' }, 10)).toBe(0);
  });
});

describe('overdueDaysOf', () => {
  const REF = new Date(2026, 6, 15, 10, 0);

  it('sem follow-up, follow-up de hoje ou futuro → 0', () => {
    expect(overdueDaysOf(lead({ nextFollowUp: null }), REF)).toBe(0);
    expect(overdueDaysOf(lead({ nextFollowUp: new Date(2026, 6, 15, 9, 0) }), REF)).toBe(0); // dia parcial não conta
    expect(overdueDaysOf(lead({ nextFollowUp: new Date(2026, 6, 20) }), REF)).toBe(0);
  });

  it('vencido: mínimo 1 (ontem à noite) e ceil de dias cheios', () => {
    expect(overdueDaysOf(lead({ nextFollowUp: new Date(2026, 6, 14, 23, 0) }), REF)).toBe(1);
    // 13/07 12:00 → 1,5 dia até 15/07 00:00 → arredonda pra cima: 2.
    expect(overdueDaysOf(lead({ nextFollowUp: new Date(2026, 6, 13, 12, 0) }), REF)).toBe(2);
  });
});

describe('dgDateKey', () => {
  it('gera YYYY-MM-DD em hora local com zero à esquerda', () => {
    expect(dgDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dgDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('computeRitmo (só com metaWeekdays válido — array)', () => {
  // NÃO testar metaWeekdays undefined: computeRitmo chama .includes direto
  // (crash conhecido/latente, fora do escopo desta caracterização).
  const SEG_A_SEX = [1, 2, 3, 4, 5];

  it('monthTarget conta TODOS os dias ativos do mês; hits fora de dia ativo não pontuam', () => {
    const history = [
      { date: '2026-07-13' },
      { date: '2026-07-14' },
      { date: '2026-07-11' } // sábado: dia inativo, não entra em monthHits
    ];
    const r = computeRitmo(history, SEG_A_SEX);
    // O mês INTEIRO: julho/2026 tem 23 dias úteis. A régua enche até o alvo do
    // mês, e a leitura de ritmo vem da marca de posição esperada na barra.
    expect(r.monthTarget).toBe(23);
    expect(r.monthHits).toBe(2);
  });

  it('sequência: hoje sem hit não quebra; dia ativo sem hit quebra; inativos são pulados', () => {
    // Hits em seg 13 e ter 14; hoje (qua 15) ainda sem hit; sex 10 sem hit.
    // Caminhada: 15 (hoje, pula) → 14 ✓ → 13 ✓ → 12/11 (inativos) → 10 ✗ quebra.
    const r = computeRitmo([{ date: '2026-07-13' }, { date: '2026-07-14' }], SEG_A_SEX);
    expect(r.streak).toBe(2);

    const comHoje = computeRitmo(
      [{ date: '2026-07-13' }, { date: '2026-07-14' }, { date: '2026-07-15' }],
      SEG_A_SEX
    );
    expect(comHoje.streak).toBe(3);

    const soHoje = computeRitmo([{ date: '2026-07-15' }], SEG_A_SEX);
    expect(soHoje.streak).toBe(1); // ontem (ter 14) ativo sem hit quebra depois de contar hoje
  });

  it('history14 tem 14 dias, o último é hoje, e marca hit/active por dia', () => {
    const r = computeRitmo([{ date: '2026-07-14' }], SEG_A_SEX);
    expect(r.history14.length).toBe(14);
    expect(r.history14[13].isToday).toBe(true);
    expect(r.history14[13].active).toBe(true); // quarta
    expect(r.history14[12].hit).toBe(true); // ontem (14/07) tem hit
    expect(r.history14[9].active).toBe(false); // 11/07, sábado
  });
});

describe('computeRitmo — o mês inteiro é o denominador', () => {
  const WEEKDAYS = [1, 2, 3, 4, 5];

  it('conta todos os dias programados do mês, inclusive os que não chegaram', () => {
    const { monthTarget } = computeRitmo([], WEEKDAYS);
    expect(monthTarget).toBe(23);
  });

  it('conta a meta batida hoje no numerador', () => {
    const history = [{ date: '2026-07-14' }, { date: '2026-07-15' }];
    const { monthHits, monthTarget } = computeRitmo(history, WEEKDAYS);
    expect(monthHits).toBe(2);
    expect(monthTarget).toBe(23);
  });

  it('nunca passa de 100%: numerador e denominador são da mesma escala', () => {
    // Todos os dias úteis de julho batidos.
    const todos = [];
    for (let d = 1; d <= 31; d++) {
      const dia = new Date(2026, 6, d);
      if (WEEKDAYS.includes(dia.getDay())) todos.push({ date: dgDateKey(dia) });
    }
    const { monthHits, monthTarget } = computeRitmo(todos, WEEKDAYS);
    expect(monthHits).toBe(monthTarget);
  });

  it('mantém hoje na sequência e na régua de 14 dias', () => {
    const history = [{ date: '2026-07-14' }, { date: '2026-07-15' }];
    const { streak, history14 } = computeRitmo(history, WEEKDAYS);
    expect(streak).toBe(2);
    expect(history14[13]).toMatchObject({ isToday: true, hit: true });
  });
});

describe('countMetaDaysInMonthAll', () => {
  it('conta o mês inteiro, não só os dias decorridos', () => {
    expect(countMetaDaysInMonthAll([1, 2, 3, 4, 5])).toBe(23);
  });

  it('respeita a política de dias da academia', () => {
    // Só quarta: 1, 8, 15, 22, 29 em julho/2026.
    expect(countMetaDaysInMonthAll([3])).toBe(5);
  });

  it('devolve 0 quando nenhum dia da semana vale', () => {
    expect(countMetaDaysInMonthAll([])).toBe(0);
  });

  it('é sempre maior ou igual ao total de dias já encerrados', () => {
    expect(countMetaDaysInMonthAll([1, 2, 3, 4, 5]))
      .toBeGreaterThanOrEqual(countClosedMetaDaysInMonth([1, 2, 3, 4, 5]));
  });
});

// ── A configuração de marcos precisa CHEGAR até computeDailyGoalSlots ───────
// A função respeita o 4º argumento; quem chamava sem ele (a Meta do gestor)
// caía no padrão e divergia da tela do consultor.
describe('computeDailyGoalSlots — marcos de renovação vêm da configuração', () => {
  const cliente = (endsAt) => lead({
    id: 'c1',
    status: 'Venda',
    lifecycleStage: 'cliente',
    createdAt: new Date(2026, 0, 10),
    currentContractEndsAt: endsAt,
  });

  it('não surfa o cliente quando o marco configurado ainda não chegou', () => {
    // Vence em 13/09/2026, 60 dias depois de hoje (15/07). Só o marco de 30
    // está configurado, então ainda não é hora de falar com ele.
    const leads = [cliente(new Date(2026, 8, 13))];
    expect(computeDailyGoalSlots(leads, new Map(), 'u1', [30])).toHaveLength(0);
  });

  it('surfa o cliente quando o marco configurado é o de 60 dias', () => {
    const leads = [cliente(new Date(2026, 8, 13))];
    const slots = computeDailyGoalSlots(leads, new Map(), 'u1', [60]);
    expect(slots).toHaveLength(1);
    expect(slots[0].categorySlugs).toContain(DAILY_GOAL_CATEGORIES.RENOVACAO);
  });
});

// ── Nome do lead no extrato de prospecção ───────────────────────────────────
// A base em memória só traz os leads ATIVOS, então ação em cliente (mensagem
// de renovação, p.ex.) não resolvia nome. A interação passou a gravar leadName.
describe('listVolumeActionsInRange — nome do lead fora da base ativa', () => {
  const from = new Date(2026, 6, 15);
  const acao = (over = {}) => ({
    leadId: 'x1',
    actorAuthUid: 'auth1',
    volumeKind: 'mensagem',
    createdAt: new Date(2026, 6, 15, 9, 0),
    ...over
  });

  it('usa o nome em memória quando o lead está carregado', () => {
    const leads = [lead({ id: 'x1', name: 'Ana Ativa' })];
    const [a] = listVolumeActionsInRange(leads, [acao()], 'u1', 'auth1', from);
    expect(a.leadName).toBe('Ana Ativa');
  });

  it('cai pro nome gravado na interação quando o lead saiu da base', () => {
    const [a] = listVolumeActionsInRange([], [acao({ leadName: 'Cliente Renovando' })], 'u1', 'auth1', from);
    expect(a.leadName).toBe('Cliente Renovando');
  });

  it('prefere o nome em memória ao gravado, que pode estar desatualizado', () => {
    const leads = [lead({ id: 'x1', name: 'Nome Corrigido' })];
    const [a] = listVolumeActionsInRange(leads, [acao({ leadName: 'Nome Antigo' })], 'u1', 'auth1', from);
    expect(a.leadName).toBe('Nome Corrigido');
  });

  it('devolve o travessão quando não há nome em lugar nenhum', () => {
    const [a] = listVolumeActionsInRange([], [acao()], 'u1', 'auth1', from);
    expect(a.leadName).toBe('—');
  });
});

describe('countClosedMetaDaysInMonth', () => {
  it('conta só dias programados anteriores a hoje', () => {
    expect(countClosedMetaDaysInMonth([1, 2, 3, 4, 5])).toBe(10);
  });

  it('ignora hoje mesmo quando hoje é dia programado', () => {
    // Só quarta é dia de meta; 1 e 8 encerraram, 15 é hoje.
    expect(countClosedMetaDaysInMonth([3])).toBe(2);
  });

  it('devolve 0 quando a lista de dias está vazia', () => {
    expect(countClosedMetaDaysInMonth([])).toBe(0);
  });
});

describe('computeDailyGoalSlots — funil Vencidos', () => {
  const CONSULTOR = 'u1';

  const clienteVencido = (over = {}) => {
    const endsAt = new Date();
    endsAt.setHours(0, 0, 0, 0);
    endsAt.setDate(endsAt.getDate() - 3);
    return {
      id: 'v1',
      name: 'Cliente Vencido',
      consultantId: CONSULTOR,
      status: 'Venda',
      lifecycleStage: 'cliente',
      createdAt: new Date(2025, 0, 10),
      currentContractStartsAt: new Date(2025, 0, 10),
      currentContractEndsAt: endsAt,
      ...over
    };
  };

  const slugsOf = (leads, id) => {
    const found = leads.find((l) => l.id === id);
    return found ? found.categorySlugs : [];
  };

  it('cliente vencido aparece em Vencidos e não em Renovações', () => {
    const out = computeDailyGoalSlots([clienteVencido()], new Map(), CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
    expect(slugsOf(out, 'v1')).not.toContain(DAILY_GOAL_CATEGORIES.RENOVACAO);
  });

  it('fora do período não aparece em nenhum dos dois', () => {
    const endsAt = new Date();
    endsAt.setHours(0, 0, 0, 0);
    endsAt.setDate(endsAt.getDate() - 40);
    const out = computeDailyGoalSlots([clienteVencido({ currentContractEndsAt: endsAt })], new Map(), CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toEqual([]);
  });

  it('cliente vencido com contato marcado para hoje aparece só em Contatos', () => {
    const hoje = new Date();
    hoje.setHours(9, 0, 0, 0);
    const out = computeDailyGoalSlots([clienteVencido({ nextFollowUp: hoje, nextFollowUpType: 'Mensagem' })], new Map(), CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toContain(DAILY_GOAL_CATEGORIES.CONTATO_HOJE);
    expect(slugsOf(out, 'v1')).not.toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
  });

  it('a categoria entra na ordem e nos metadados visuais', () => {
    expect(DG_CATEGORY_ORDER).toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
    const meta = DG_CATEGORY_META[DAILY_GOAL_CATEGORIES.VENCIDO];
    expect(meta.short).toBe('Vencidos');
    expect(COLOR_TONES[meta.color]).toBeTruthy();
  });

  it('tarefa de cliente concluída hoje continua visível como feita', () => {
    const hoje = new Date();
    hoje.setHours(11, 0, 0, 0);
    const endsAt = new Date();
    endsAt.setHours(0, 0, 0, 0);
    endsAt.setDate(endsAt.getDate() - 3);
    // O desfecho "não vai voltar" grava renewalDeclined (tira da condição viva)
    // e a marca daily_goal_done. Sem o conserto, o cartão sumia da tela.
    const lead = clienteVencido({ renewalDeclined: true, currentContractEndsAt: endsAt });
    const byLead = new Map([[lead.id, [{
      leadId: lead.id,
      type: 'daily_goal_done',
      dailyGoalCategory: DAILY_GOAL_CATEGORIES.VENCIDO,
      createdAt: hoje
    }]]]);
    const out = computeDailyGoalSlots([lead], byLead, CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
    const found = out.find((l) => l.id === 'v1');
    expect(found.categoryStatus[DAILY_GOAL_CATEGORIES.VENCIDO]).toBe(true);
  });
});

describe('contato delegado a outro consultor', () => {
  const hoje = new Date(2026, 6, 15, 16, 0);

  it('aparece na Meta de quem RECEBEU, mesmo não sendo dono do lead', () => {
    const l = lead({ consultantId: 'outro', nextFollowUp: hoje, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1' });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('SOME da Meta do dono do lead quando delegado', () => {
    const l = lead({ consultantId: 'u1', nextFollowUp: hoje, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'outro' });
    expect(byId(slots([l]), l.id)).toBeUndefined();
  });

  it('delegação NÃO arrasta as outras tarefas do lead para quem recebeu', () => {
    const l = lead({
      consultantId: 'outro', nextFollowUp: hoje, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1',
      appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 15, 18, 0),
      createdAt: new Date(2026, 6, 14, 12, 0),
    });
    // A aula de hoje e o novo 24h continuam sendo do dono do lead.
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('sem o campo, a tarefa continua indo para o dono do lead', () => {
    const l = lead({ consultantId: 'u1', nextFollowUp: hoje, nextFollowUpType: 'Mensagem' });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('delegar não cria tarefa quando o contato não é de hoje', () => {
    const l = lead({ consultantId: 'outro', nextFollowUp: new Date(2026, 6, 20, 10, 0), nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1' });
    expect(byId(slots([l]), l.id)).toBeUndefined();
  });
});
