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
  COLOR_TONES,
  tomorrowAppointmentsOf,
  leadsByGoalOwner
} from '../dailyGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';
import { contactDone, contactReschedule } from '../contactGoal.js';

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

// A marca de feito do contato fica com quem tinha a tarefa na hora da marcação
// (goalOwnerId, com o contactOwnerId do lead), como a da visita e a da aula. O
// "Contato feito" limpa o próximo contato e o Reagendar o leva para outro dia,
// então o contato sai da condição viva, e o feito de hoje só era procurado nos
// leads do dono do lead: o feito sumia da Meta de quem recebeu o contato e
// aparecia na Meta do dono, que não o fez.
describe('o contato feito fica com quem tinha a tarefa na marcação', () => {
  const CONTATO = DAILY_GOAL_CATEGORIES.CONTATO_HOJE;
  const ANA = 'u-ana'; // dona do lead
  const BRUNO = 'u-bruno'; // recebeu o contato
  const slotsDe = (consultantId, leads, interactions = []) =>
    computeDailyGoalSlots(leads, buildInteractionsByLead(interactions), consultantId);
  const marcaDe = (leadId, goalOwnerId) => ({ ...goalDone(leadId, CONTATO), goalOwnerId });
  const delegadoAoBruno = (over = {}) =>
    lead({ consultantId: ANA, nextFollowUpOwnerId: BRUNO, nextFollowUpOwnerName: 'Bruno', ...over });

  it('o "Contato feito" de quem recebeu fica na Meta dele e não aparece na da dona', () => {
    // Depois do ContactOutcomeModal: o próximo contato limpo e a marca do Bruno.
    const l = delegadoAoBruno({ nextFollowUp: null, nextFollowUpType: null });
    const feito = [marcaDe(l.id, BRUNO)];
    const doBruno = byId(slotsDe(BRUNO, [l], feito), l.id);
    expect(doBruno?.categorySlugs).toEqual([CONTATO]);
    expect(doBruno?.categoryStatus[CONTATO]).toBe(true);
    // A Ana não fez o contato. Sem outras tarefas, a Meta dela fica vazia, e
    // não com 1 de 1, que o App gravaria como dia batido.
    const daAna = slotsDe(ANA, [l], feito);
    expect(daAna).toEqual([]);
    expect(slotTotals(daAna).totalSlots).toBe(0);
  });

  it('o contato reagendado para outro dia também fica feito só na Meta de quem recebeu', () => {
    const l = delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Mensagem' });
    const feito = [marcaDe(l.id, BRUNO)];
    expect(byId(slotsDe(BRUNO, [l], feito), l.id)?.categoryStatus[CONTATO]).toBe(true);
    expect(slotsDe(ANA, [l], feito)).toEqual([]);
  });

  it('o contato reagendado para mais tarde hoje continua feito só na Meta de quem recebeu', () => {
    const l = delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 15, 17, 0), nextFollowUpType: 'Mensagem' });
    const feito = [marcaDe(l.id, BRUNO)];
    expect(byId(slotsDe(BRUNO, [l], feito), l.id)?.categoryStatus[CONTATO]).toBe(true);
    expect(slotsDe(ANA, [l], feito)).toEqual([]);
  });

  it('o contato que a dona marca para ela depois do feito nasce pendente, e o feito continua do Bruno', () => {
    // O Agendar da ficha grava nextFollowUpOwnerId null quando o contato é do
    // dono do lead.
    const l = lead({ consultantId: ANA, nextFollowUpOwnerId: null, nextFollowUp: new Date(2026, 6, 15, 17, 0), nextFollowUpType: 'Ligação' });
    const feito = [marcaDe(l.id, BRUNO)];
    const daAna = byId(slotsDe(ANA, [l], feito), l.id);
    expect(daAna.categorySlugs).toEqual([CONTATO]);
    expect(daAna.categoryStatus[CONTATO]).toBe(false);
    const doBruno = byId(slotsDe(BRUNO, [l], feito), l.id);
    expect(doBruno?.categorySlugs).toEqual([CONTATO]);
    expect(doBruno?.categoryStatus[CONTATO]).toBe(true);
  });

  it('o contato da própria dona continua com ela, pendente e feito', () => {
    const pendente = lead({ consultantId: ANA, nextFollowUp: new Date(2026, 6, 15, 11, 0), nextFollowUpType: 'Mensagem' });
    const feito = lead({ consultantId: ANA, nextFollowUp: null, nextFollowUpType: null });
    const marcas = [marcaDe(feito.id, ANA)];
    const daAna = slotsDe(ANA, [pendente, feito], marcas);
    expect(byId(daAna, pendente.id).categoryStatus[CONTATO]).toBe(false);
    expect(byId(daAna, feito.id).categoryStatus[CONTATO]).toBe(true);
    expect(slotsDe(BRUNO, [pendente, feito], marcas)).toEqual([]);
  });

  it('a marca sem o campo e sem o autor vale para quem tem o contato agora', () => {
    const l = delegadoAoBruno({ nextFollowUp: null, nextFollowUpType: null });
    const antiga = [goalDone(l.id, CONTATO)];
    expect(byId(slotsDe(BRUNO, [l], antiga), l.id)?.categoryStatus[CONTATO]).toBe(true);
    expect(slotsDe(ANA, [l], antiga)).toEqual([]);
  });

  // A marca de antes do campo (a do dia do deploy e a de uma aba aberta com o
  // código antigo, que não recarrega sozinha) vale para quem a gravou
  // (actorId): só quem tem o contato o vê na Meta e o conclui. Sem isso, o
  // feito da Ana iria para o Bruno quando ela passasse a ele o próximo contato.
  describe('a marca de antes do campo vale para quem a gravou', () => {
    const marcaAntigaDe = (leadId, actorId) => ({ ...goalDone(leadId, CONTATO), actorId });

    it('a Ana conclui o próprio contato e passa o próximo ao Bruno para amanhã: o feito continua na Meta dela', () => {
      const l = delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Mensagem' });
      const marcas = [marcaAntigaDe(l.id, ANA)];
      const daAna = slotsDe(ANA, [l], marcas);
      expect(byId(daAna, l.id)?.categoryStatus).toEqual({ [CONTATO]: true });
      expect(slotTotals(daAna)).toMatchObject({ totalSlots: 1, doneSlots: 1 });
      expect(slotsDe(BRUNO, [l], marcas)).toEqual([]);
    });

    it('a Ana conclui o próprio contato e passa o próximo ao Bruno para hoje: o contato do Bruno nasce pendente', () => {
      const l = delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 15, 17, 0), nextFollowUpType: 'Mensagem' });
      const marcas = [marcaAntigaDe(l.id, ANA)];
      expect(slotTotals(slotsDe(ANA, [l], marcas))).toMatchObject({ totalSlots: 1, doneSlots: 1 });
      const doBruno = slotsDe(BRUNO, [l], marcas);
      expect(byId(doBruno, l.id)?.categoryStatus).toEqual({ [CONTATO]: false });
      expect(slotTotals(doBruno)).toMatchObject({ totalSlots: 1, doneSlots: 0 });
    });

    it('o Bruno conclui o contato que recebeu e a Ana pega o próximo para hoje: o feito fica com ele e o contato dela nasce pendente', () => {
      const l = lead({ consultantId: ANA, nextFollowUpOwnerId: null, nextFollowUp: new Date(2026, 6, 15, 17, 0), nextFollowUpType: 'Mensagem' });
      const marcas = [marcaAntigaDe(l.id, BRUNO)];
      expect(byId(slotsDe(BRUNO, [l], marcas), l.id)?.categoryStatus).toEqual({ [CONTATO]: true });
      expect(byId(slotsDe(ANA, [l], marcas), l.id)?.categoryStatus).toEqual({ [CONTATO]: false });
    });
  });

  // O "Contato feito" tira o dono do contato (contactDone). O próximo contato
  // que nasce por um caminho que não escolhe dono, como o "Próximo contato?"
  // depois do Compareceu, que grava só a data e o tipo, fica com o dono do
  // lead, e não com o antigo delegado. O Reagendar leva o mesmo contato para
  // outro dia, e ele continua com quem o tinha.
  describe('o próximo contato depois do "Contato feito"', () => {
    const concluidoPeloBruno = () => ({
      ...delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 15, 9, 0), nextFollowUpType: 'Mensagem' }),
      ...contactDone(),
    });
    const proximoSemDono = (l, when) => ({ ...l, nextFollowUp: when, nextFollowUpType: 'Mensagem' });
    const amanha = new Date(2026, 6, 16, 9, 0);

    it('o próximo contato de hoje criado sem dono vai para a Ana, e o feito continua do Bruno', () => {
      const l = proximoSemDono(concluidoPeloBruno(), new Date(2026, 6, 15, 17, 0));
      const feito = [marcaDe(l.id, BRUNO)];
      expect(byId(slotsDe(ANA, [l], feito), l.id)?.categoryStatus).toEqual({ [CONTATO]: false });
      expect(byId(slotsDe(BRUNO, [l], feito), l.id)?.categoryStatus).toEqual({ [CONTATO]: true });
    });

    it('o próximo contato de amanhã criado sem dono entra na prévia da Ana, e não na do Bruno', () => {
      const l = proximoSemDono(concluidoPeloBruno(), amanha);
      expect(tomorrowAppointmentsOf([l], ANA)).toEqual([{ lead: l, when: amanha }]);
      expect(tomorrowAppointmentsOf([l], BRUNO)).toEqual([]);
    });

    it('o contato que o Bruno reagenda para amanhã continua com ele, na prévia de amanhã', () => {
      const delegado = delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 15, 9, 0), nextFollowUpType: 'Mensagem' });
      const l = { ...delegado, ...contactReschedule(delegado, amanha) };
      expect(tomorrowAppointmentsOf([l], BRUNO)).toEqual([{ lead: l, when: amanha }]);
      expect(tomorrowAppointmentsOf([l], ANA)).toEqual([]);
    });
  });

  it('o cliente com o contato de renovação delegado entra como hoje, na Meta de quem recebeu', () => {
    const cliente = delegadoAoBruno({
      status: 'Venda', lifecycleStage: 'cliente', nextFollowUp: new Date(2026, 6, 15, 17, 0), nextFollowUpType: 'Mensagem',
    });
    expect(byId(slotsDe(BRUNO, [cliente]), cliente.id).categoryStatus[CONTATO]).toBe(false);
    const feito = [marcaDe(cliente.id, BRUNO)];
    expect(byId(slotsDe(BRUNO, [cliente], feito), cliente.id).categoryStatus[CONTATO]).toBe(true);
    expect(slotsDe(ANA, [cliente], feito)).toEqual([]);
  });

  it('lead em Perda continua fora, com ou sem a marca', () => {
    const perdido = delegadoAoBruno({ status: 'Perda', nextFollowUp: new Date(2026, 6, 15, 17, 0), nextFollowUpType: 'Mensagem' });
    const feito = [marcaDe(perdido.id, BRUNO)];
    expect(slotsDe(BRUNO, [perdido], feito)).toEqual([]);
    expect(slotsDe(ANA, [perdido], feito)).toEqual([]);
  });

  it('o Atrasado do lead continua com a dona, mesmo com o contato delegado', () => {
    const l = delegadoAoBruno({ nextFollowUp: new Date(2026, 6, 13, 9, 0), nextFollowUpType: 'Mensagem' });
    expect(byId(slotsDe(ANA, [l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.ATRASADO]);
    expect(slotsDe(BRUNO, [l])).toEqual([]);
    // A Ana conclui o Atrasado: o "Contato feito" limpa o próximo contato.
    const concluido = { ...l, nextFollowUp: null, nextFollowUpType: null };
    const feito = [goalDone(l.id, DAILY_GOAL_CATEGORIES.ATRASADO)];
    expect(byId(slotsDe(ANA, [concluido], feito), l.id).categoryStatus[DAILY_GOAL_CATEGORIES.ATRASADO]).toBe(true);
    expect(slotsDe(BRUNO, [concluido], feito)).toEqual([]);
  });
});

// Visita e aula experimental que um consultor agendou no lead de outro
// (decisão do dono, em 05/10/2026): a tarefa do dia vai para quem agendou
// (appointmentOwnerId, lido por appointmentTaskOwnerId em leads.js). Quem
// recebeu vê só a visita ou a aula daquele lead; o dono do lead fica com o
// resto (Novo 24h, Atrasado, contato) e deixa de ver o agendamento.
describe('visita e aula agendadas por outro consultor', () => {
  const as16 = new Date(2026, 6, 15, 16, 0);
  const visitaDeHoje = (over = {}) => lead({
    appointmentType: 'visita', appointmentScheduledFor: as16, nextFollowUp: as16, nextFollowUpType: 'Visita', ...over
  });
  const aulaDeHoje = (over = {}) => lead({
    appointmentType: 'aula_experimental', appointmentScheduledFor: as16, nextFollowUp: as16, nextFollowUpType: 'Aula Experimental', ...over
  });
  const slotsDe = (consultantId, leads, interactions = []) =>
    computeDailyGoalSlots(leads, buildInteractionsByLead(interactions), consultantId);

  it('a visita aparece na Meta de quem agendou, mesmo não sendo dono do lead', () => {
    const l = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', appointmentOwnerName: 'Ana' });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
    expect(byId(slots([l]), l.id).categoryStatus[DAILY_GOAL_CATEGORIES.VISITA_HOJE]).toBe(false);
  });

  it('a aula aparece em Aulas exp. de quem agendou', () => {
    const l = aulaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1' });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.AULA_HOJE]);
  });

  it('some da Meta do dono do lead', () => {
    const visita = visitaDeHoje({ consultantId: 'u1', appointmentOwnerId: 'outro' });
    const aula = aulaDeHoje({ consultantId: 'u1', appointmentOwnerId: 'outro' });
    expect(slots([visita, aula])).toEqual([]);
  });

  it('o dono do lead continua com o Novo 24h, o Atrasado e o contato do lead', () => {
    const novo = visitaDeHoje({ consultantId: 'u1', appointmentOwnerId: 'outro', createdAt: new Date(2026, 6, 14, 12, 0) });
    const atrasado = visitaDeHoje({ consultantId: 'u1', appointmentOwnerId: 'outro', nextFollowUp: new Date(2026, 6, 13, 9, 0), nextFollowUpType: 'Mensagem' });
    const contato = visitaDeHoje({ consultantId: 'u1', appointmentOwnerId: 'outro', nextFollowUp: new Date(2026, 6, 15, 11, 0), nextFollowUpType: 'Mensagem' });
    const result = slots([novo, atrasado, contato]);
    expect(byId(result, novo.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.NOVO_24H]);
    expect(byId(result, atrasado.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.ATRASADO]);
    expect(byId(result, contato.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('quem recebeu não ganha o Novo 24h, o Atrasado nem o contato daquele lead', () => {
    const novo = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', createdAt: new Date(2026, 6, 14, 12, 0) });
    const atrasado = aulaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', nextFollowUp: new Date(2026, 6, 13, 9, 0), nextFollowUpType: 'Mensagem' });
    const contato = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', nextFollowUp: new Date(2026, 6, 15, 11, 0), nextFollowUpType: 'Ligação' });
    const result = slots([novo, atrasado, contato]);
    expect(byId(result, novo.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
    expect(byId(result, atrasado.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.AULA_HOJE]);
    expect(byId(result, contato.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
  });

  it('a mesma pessoa pode receber o contato e o agendamento do lead: as duas tarefas', () => {
    const l = visitaDeHoje({
      consultantId: 'outro', appointmentOwnerId: 'u1',
      nextFollowUp: new Date(2026, 6, 15, 11, 0), nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1'
    });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE, DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
    expect(slotsDe('outro', [l])).toEqual([]);
  });

  it('lead em Venda ou em Perda continua fora', () => {
    const vendido = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', status: 'Venda', lifecycleStage: 'cliente' });
    const perdido = aulaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', status: 'Perda' });
    expect(slots([vendido, perdido])).toEqual([]);
  });

  it('agendamento de outro dia não vira tarefa de hoje para ninguém', () => {
    const amanha = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', appointmentScheduledFor: new Date(2026, 6, 16, 16, 0), nextFollowUp: new Date(2026, 6, 16, 16, 0) });
    expect(slots([amanha])).toEqual([]);
    expect(slotsDe('outro', [amanha])).toEqual([]);
  });

  it('agendamento sem delegado volta para o dono do lead', () => {
    const l = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: null, appointmentOwnerName: null });
    expect(slots([l])).toEqual([]);
    expect(byId(slotsDe('outro', [l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
  });

  it('o desfecho marcado hoje conclui a tarefa na Meta de quem recebeu, e não na do dono', () => {
    const l = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', appointmentOutcome: 'attended' });
    const feito = [goalDone(l.id, DAILY_GOAL_CATEGORIES.VISITA_HOJE)];
    expect(byId(slots([l], feito), l.id).categoryStatus[DAILY_GOAL_CATEGORIES.VISITA_HOJE]).toBe(true);
    expect(slotsDe('outro', [l], feito)).toEqual([]);
  });

  it('feita hoje e fora da condição viva (cancelada ou remarcada), continua visível só para quem recebeu', () => {
    const cancelada = lead({ consultantId: 'outro', appointmentOwnerId: 'u1', appointmentType: null, appointmentScheduledFor: null });
    const remarcada = aulaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', appointmentScheduledFor: new Date(2026, 6, 17, 16, 0), nextFollowUp: new Date(2026, 6, 17, 16, 0) });
    const feitos = [goalDone(cancelada.id, DAILY_GOAL_CATEGORIES.VISITA_HOJE), goalDone(remarcada.id, DAILY_GOAL_CATEGORIES.AULA_HOJE)];
    const result = slots([cancelada, remarcada], feitos);
    expect(byId(result, cancelada.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
    expect(byId(result, cancelada.id).categoryStatus[DAILY_GOAL_CATEGORIES.VISITA_HOJE]).toBe(true);
    expect(byId(result, remarcada.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.AULA_HOJE]);
    expect(slotsDe('outro', [cancelada, remarcada], feitos)).toEqual([]);
  });

  it('a marca de outra categoria do mesmo lead continua com o dono', () => {
    const l = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Mensagem' });
    const feitos = [goalDone(l.id, DAILY_GOAL_CATEGORIES.CONTATO_HOJE)];
    expect(byId(slots([l], feitos), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.VISITA_HOJE]);
    expect(byId(slotsDe('outro', [l], feitos), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('cliente com a visita de outra pessoa não ganha a tarefa feita de visita', () => {
    const cliente = visitaDeHoje({ consultantId: 'outro', appointmentOwnerId: 'u1', status: 'Venda', lifecycleStage: 'cliente' });
    expect(slots([cliente], [goalDone(cliente.id, DAILY_GOAL_CATEGORIES.VISITA_HOJE)])).toEqual([]);
  });
});

// A marca de feito da visita e da aula fica com quem tinha a tarefa na hora da
// marcação (goalOwnerId, gravado pelo goalOwnerFields de leads.js). O dono da
// tarefa muda a cada agendamento novo, e sem o campo a visita feita mudava de
// Meta junto: saía do "Feitos hoje" de quem a fez e aparecia feita na Meta de
// quem agendou o passo seguinte.
describe('a visita e a aula feitas ficam com quem tinha a tarefa na marcação', () => {
  const VISITA = DAILY_GOAL_CATEGORIES.VISITA_HOJE;
  const AULA = DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const ANA = 'u-ana';
  const BRUNO = 'u-bruno';
  const amanha16 = new Date(2026, 6, 16, 16, 0);
  const hoje18 = new Date(2026, 6, 15, 18, 0);
  const slotsDe = (consultantId, leads, interactions = []) =>
    computeDailyGoalSlots(leads, buildInteractionsByLead(interactions), consultantId);
  const marcaDe = (leadId, category, goalOwnerId) => ({ ...goalDone(leadId, category), goalOwnerId });
  const aulaDeAmanha = (over = {}) => lead({
    appointmentType: 'aula_experimental', appointmentScheduledFor: amanha16, nextFollowUp: amanha16, nextFollowUpType: 'Aula Experimental', ...over
  });

  it('o passo seguinte agendado por outra pessoa não tira a visita feita de quem a fez', () => {
    // A visita da Ana (dona do lead) de hoje está como Compareceu. À tarde o
    // Bruno agenda pelo Stronizap a aula de amanhã no mesmo lead.
    const l = aulaDeAmanha({ consultantId: ANA, appointmentOwnerId: BRUNO, appointmentOwnerName: 'Bruno' });
    const feita = [marcaDe(l.id, VISITA, ANA)];
    const daAna = byId(slotsDe(ANA, [l], feita), l.id);
    expect(daAna.categorySlugs).toEqual([VISITA]);
    expect(daAna.categoryStatus[VISITA]).toBe(true);
    // O Bruno não ganha a visita feita. Sem outras tarefas, a Meta dele fica
    // vazia, e não com 1 de 1, que o App gravaria como dia batido.
    const doBruno = slotsDe(BRUNO, [l], feita);
    expect(doBruno).toEqual([]);
    expect(slotTotals(doBruno).totalSlots).toBe(0);
  });

  it('a Ana ou o gestor agendam o passo seguinte de uma visita que o Bruno fez: ela continua do Bruno', () => {
    // A visita que o Bruno agendou no lead da Ana está como Compareceu. Depois a
    // Ana, ou o gestor, agenda a aula de amanhã, e a tarefa do agendamento
    // volta para a dona do lead (appointmentOwnerId null).
    const l = aulaDeAmanha({ consultantId: ANA, appointmentOwnerId: null, appointmentOwnerName: null });
    const feita = [marcaDe(l.id, VISITA, BRUNO)];
    const doBruno = byId(slotsDe(BRUNO, [l], feita), l.id);
    expect(doBruno.categorySlugs).toEqual([VISITA]);
    expect(doBruno.categoryStatus[VISITA]).toBe(true);
    expect(slotsDe(ANA, [l], feita)).toEqual([]);
  });

  it('uma visita nova do Bruno, mais tarde no mesmo dia, nasce pendente mesmo com a da Ana marcada', () => {
    const l = lead({
      consultantId: ANA, appointmentOwnerId: BRUNO, appointmentOwnerName: 'Bruno',
      appointmentType: 'visita', appointmentScheduledFor: hoje18, nextFollowUp: hoje18, nextFollowUpType: 'Visita'
    });
    const feita = [marcaDe(l.id, VISITA, ANA)];
    const doBruno = byId(slotsDe(BRUNO, [l], feita), l.id);
    expect(doBruno.categorySlugs).toEqual([VISITA]);
    expect(doBruno.categoryStatus[VISITA]).toBe(false);
    expect(byId(slotsDe(ANA, [l], feita), l.id).categoryStatus[VISITA]).toBe(true);
    // Quando a visita do Bruno é marcada, cada um fica com a sua.
    const asDuas = [...feita, marcaDe(l.id, VISITA, BRUNO)];
    expect(byId(slotsDe(BRUNO, [l], asDuas), l.id).categoryStatus[VISITA]).toBe(true);
    expect(byId(slotsDe(ANA, [l], asDuas), l.id).categoryStatus[VISITA]).toBe(true);
  });

  it('a aula feita segue a mesma regra', () => {
    const l = lead({
      consultantId: ANA, appointmentOwnerId: null,
      appointmentType: 'visita', appointmentScheduledFor: amanha16, nextFollowUp: amanha16, nextFollowUpType: 'Visita'
    });
    const feita = [marcaDe(l.id, AULA, BRUNO)];
    expect(byId(slotsDe(BRUNO, [l], feita), l.id).categorySlugs).toEqual([AULA]);
    expect(slotsDe(ANA, [l], feita)).toEqual([]);
  });

  it('a marca de antes do campo continua com o dono da tarefa de agora', () => {
    const l = aulaDeAmanha({ consultantId: ANA, appointmentOwnerId: BRUNO });
    const antiga = [goalDone(l.id, VISITA)];
    expect(byId(slotsDe(BRUNO, [l], antiga), l.id).categoryStatus[VISITA]).toBe(true);
    expect(slotsDe(ANA, [l], antiga)).toEqual([]);
  });

  it('cliente, Venda e Perda continuam sem visita e aula feitas, mesmo com a marca de quem fez', () => {
    const cliente = aulaDeAmanha({ consultantId: ANA, status: 'Venda', lifecycleStage: 'cliente' });
    const vendido = aulaDeAmanha({ consultantId: ANA, status: 'Venda' });
    const perdido = aulaDeAmanha({ consultantId: ANA, status: 'Perda' });
    const feitas = [cliente, vendido, perdido].map((l) => marcaDe(l.id, VISITA, BRUNO));
    expect(slotsDe(BRUNO, [cliente, vendido, perdido], feitas)).toEqual([]);
  });
});

// Prévia de AMANHÃ da Meta (o chip "Amanhã" do DailyGoalView): não conta na
// meta de hoje. A visita e a aula seguem o dono da tarefa do agendamento, e o
// contato segue quem tem o contato (contactOwnerId), como na Meta de hoje.
describe('tomorrowAppointmentsOf', () => {
  const amanha16 = new Date(2026, 6, 16, 16, 0);
  const visitaDeAmanha = (over = {}) => lead({
    appointmentType: 'visita', appointmentScheduledFor: amanha16, nextFollowUp: amanha16, nextFollowUpType: 'Visita', ...over
  });
  const ids = (out) => out.map((x) => x.lead.id);

  it('a visita de amanhã sem delegado é do dono do lead', () => {
    const l = visitaDeAmanha({ consultantId: 'u1' });
    expect(tomorrowAppointmentsOf([l], 'u1')).toEqual([{ lead: l, when: amanha16 }]);
    expect(tomorrowAppointmentsOf([l], 'outro')).toEqual([]);
  });

  it('a visita ou a aula delegada aparece para quem agendou e some do dono', () => {
    const visita = visitaDeAmanha({ consultantId: 'outro', appointmentOwnerId: 'u1' });
    const aula = visitaDeAmanha({ consultantId: 'outro', appointmentOwnerId: 'u1', appointmentType: 'aula_experimental', nextFollowUpType: 'Aula Experimental' });
    expect(ids(tomorrowAppointmentsOf([visita, aula], 'u1'))).toEqual([visita.id, aula.id]);
    expect(tomorrowAppointmentsOf([visita, aula], 'outro')).toEqual([]);
  });

  it('o contato de amanhã sem delegado continua com o dono do lead, mesmo com a visita de outra pessoa', () => {
    const l = lead({ consultantId: 'outro', nextFollowUp: amanha16, nextFollowUpType: 'Mensagem', appointmentOwnerId: 'u1' });
    expect(ids(tomorrowAppointmentsOf([l], 'outro'))).toEqual([l.id]);
    expect(tomorrowAppointmentsOf([l], 'u1')).toEqual([]);
  });

  it('o contato delegado de amanhã aparece na prévia de quem recebeu e sai da do dono', () => {
    const mensagem = lead({ consultantId: 'outro', nextFollowUp: amanha16, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1' });
    const ligacao = lead({ consultantId: 'outro', nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Ligação', nextFollowUpOwnerId: 'u1' });
    expect(tomorrowAppointmentsOf([mensagem, ligacao], 'u1')).toEqual([
      { lead: ligacao, when: new Date(2026, 6, 16, 9, 0) },
      { lead: mensagem, when: amanha16 },
    ]);
    expect(tomorrowAppointmentsOf([mensagem, ligacao], 'outro')).toEqual([]);
  });

  it('a visita de amanhã fica com o dono da tarefa da visita, mesmo com o contato do lead com outra pessoa', () => {
    const l = visitaDeAmanha({ consultantId: 'outro', nextFollowUpOwnerId: 'u1' });
    expect(ids(tomorrowAppointmentsOf([l], 'outro'))).toEqual([l.id]);
    expect(tomorrowAppointmentsOf([l], 'u1')).toEqual([]);
  });

  it('o contato delegado de amanhã num lead em Perda fica de fora', () => {
    const l = lead({ consultantId: 'outro', status: 'Perda', nextFollowUp: amanha16, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1' });
    expect(tomorrowAppointmentsOf([l], 'u1')).toEqual([]);
    expect(tomorrowAppointmentsOf([l], 'outro')).toEqual([]);
  });

  it('lead em Venda ou em Perda fica de fora', () => {
    const vendido = visitaDeAmanha({ consultantId: 'outro', appointmentOwnerId: 'u1', status: 'Venda' });
    const perdido = visitaDeAmanha({ consultantId: 'outro', appointmentOwnerId: 'u1', status: 'Perda' });
    expect(tomorrowAppointmentsOf([vendido, perdido], 'u1')).toEqual([]);
  });

  it('hoje e depois de amanhã ficam de fora, e a lista sai por horário', () => {
    const hoje = visitaDeAmanha({ appointmentScheduledFor: new Date(2026, 6, 15, 18, 0) });
    const depois = visitaDeAmanha({ appointmentScheduledFor: new Date(2026, 6, 17, 9, 0) });
    const tarde = visitaDeAmanha({ appointmentScheduledFor: new Date(2026, 6, 16, 19, 0) });
    const cedo = visitaDeAmanha({ appointmentScheduledFor: new Date(2026, 6, 16, 8, 0) });
    expect(ids(tomorrowAppointmentsOf([hoje, depois, tarde, cedo], 'u1'))).toEqual([cedo.id, tarde.id]);
  });

  it('aceita a data de referência', () => {
    const l = visitaDeAmanha({ appointmentScheduledFor: new Date(2026, 6, 20, 10, 0) });
    expect(ids(tomorrowAppointmentsOf([l], 'u1', new Date(2026, 6, 19, 23, 0)))).toEqual([l.id]);
  });
});

// A Meta da equipe monta a Meta de cada pessoa com uma fatia dos leads, para
// não varrer a base inteira por pessoa. A fatia precisa ter todo lead em que a
// pessoa tem tarefa, senão a visita que um consultor agendou no lead de outro,
// ou o contato que ele recebeu de um colega, some da linha dele no painel do
// gestor.
describe('leadsByGoalOwner', () => {
  const as16 = new Date(2026, 6, 15, 16, 0);

  it('cada lead entra na fatia do dono', () => {
    const a = lead({ consultantId: 'u1' });
    const b = lead({ consultantId: 'u2' });
    const fatias = leadsByGoalOwner([a, b]);
    expect(fatias.get('u1')).toEqual([a]);
    expect(fatias.get('u2')).toEqual([b]);
  });

  it('o lead com a visita ou a aula de outra pessoa entra também na fatia dela', () => {
    const l = lead({ consultantId: 'u2', appointmentOwnerId: 'u1' });
    const fatias = leadsByGoalOwner([l]);
    expect(fatias.get('u2')).toEqual([l]);
    expect(fatias.get('u1')).toEqual([l]);
  });

  it('dono da tarefa igual ao dono do lead não duplica', () => {
    const l = lead({ consultantId: 'u1', appointmentOwnerId: 'u1' });
    expect(leadsByGoalOwner([l]).get('u1')).toEqual([l]);
  });

  it('o lead com o contato delegado entra também na fatia de quem recebeu', () => {
    const l = lead({ consultantId: 'u2', nextFollowUpOwnerId: 'u1' });
    const fatias = leadsByGoalOwner([l]);
    expect(fatias.get('u2')).toEqual([l]);
    expect(fatias.get('u1')).toEqual([l]);
  });

  it('a mesma pessoa com o contato e a visita do lead não repete o lead', () => {
    const l = lead({ consultantId: 'u2', nextFollowUpOwnerId: 'u1', appointmentOwnerId: 'u1' });
    expect(leadsByGoalOwner([l]).get('u1')).toEqual([l]);
  });

  it('lista vazia ou ausente dá mapa vazio', () => {
    expect(leadsByGoalOwner([]).size).toBe(0);
    expect(leadsByGoalOwner(null).size).toBe(0);
  });

  it('a Meta de cada pessoa pela fatia é a mesma da base inteira', () => {
    const leads = [
      lead({ consultantId: 'u1', appointmentType: 'visita', appointmentScheduledFor: as16, appointmentOwnerId: 'u2' }),
      lead({ consultantId: 'u2', appointmentType: 'aula_experimental', appointmentScheduledFor: as16 }),
      lead({ consultantId: 'u2', appointmentType: 'visita', appointmentScheduledFor: as16, appointmentOwnerId: 'u1', createdAt: new Date(2026, 6, 14, 12, 0) }),
      lead({ consultantId: 'u1', nextFollowUp: new Date(2026, 6, 13, 9, 0) }),
      lead({ consultantId: 'u2', nextFollowUp: as16, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1' }),
      lead({ consultantId: 'u1', nextFollowUp: as16, nextFollowUpType: 'Ligação', nextFollowUpOwnerId: 'u2', createdAt: new Date(2026, 6, 14, 12, 0) }),
    ];
    const byLead = buildInteractionsByLead([]);
    const fatias = leadsByGoalOwner(leads);
    for (const u of ['u1', 'u2']) {
      const pelaFatia = computeDailyGoalSlots(fatias.get(u) || [], byLead, u);
      const pelaBase = computeDailyGoalSlots(leads, byLead, u);
      expect(pelaFatia.map((l) => [l.id, l.categorySlugs]), u).toEqual(pelaBase.map((l) => [l.id, l.categorySlugs]));
    }
  });

  // A visita feita fica com quem tinha a tarefa na marcação (goalOwnerId), que
  // pode não ser mais nem o dono do lead nem o dono da tarefa de agora.
  describe('com a marca de feito da visita ou da aula', () => {
    const marcaDe = (leadId, goalOwnerId, category = DAILY_GOAL_CATEGORIES.VISITA_HOJE) =>
      ({ ...goalDone(leadId, category), goalOwnerId });

    it('o lead entra também na fatia de quem fez a visita', () => {
      const l = lead({ consultantId: 'u1', appointmentOwnerId: null });
      const fatias = leadsByGoalOwner([l], [marcaDe(l.id, 'u2')]);
      expect(fatias.get('u1')).toEqual([l]);
      expect(fatias.get('u2')).toEqual([l]);
    });

    it('várias marcas da mesma pessoa no mesmo lead não repetem o lead', () => {
      const l = lead({ consultantId: 'u1', appointmentOwnerId: 'u2' });
      const marcas = [marcaDe(l.id, 'u2'), marcaDe(l.id, 'u2', DAILY_GOAL_CATEGORIES.AULA_HOJE), marcaDe(l.id, 'u1')];
      const fatias = leadsByGoalOwner([l], marcas);
      expect(fatias.get('u1')).toEqual([l]);
      expect(fatias.get('u2')).toEqual([l]);
    });

    it('marca sem dono, de lead fora da base ou que não é de feito não muda as fatias', () => {
      const l = lead({ consultantId: 'u1' });
      const fatias = leadsByGoalOwner([l], [
        goalDone(l.id, DAILY_GOAL_CATEGORIES.VISITA_HOJE),
        marcaDe('fora-da-base', 'u2'),
        { leadId: l.id, type: 'note', goalOwnerId: 'u3' },
      ]);
      expect([...fatias.keys()]).toEqual(['u1']);
    });

    it('a Meta de cada pessoa pela fatia continua a mesma da base inteira', () => {
      const leads = [
        lead({ consultantId: 'u1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 16, 16, 0) }),
        lead({ consultantId: 'u2', appointmentType: 'visita', appointmentScheduledFor: as16, appointmentOwnerId: 'u3' }),
      ];
      const marcas = [marcaDe(leads[0].id, 'u2'), marcaDe(leads[1].id, 'u1')];
      const byLead = buildInteractionsByLead(marcas);
      const fatias = leadsByGoalOwner(leads, marcas);
      for (const u of ['u1', 'u2', 'u3']) {
        const pelaFatia = computeDailyGoalSlots(fatias.get(u) || [], byLead, u);
        const pelaBase = computeDailyGoalSlots(leads, byLead, u);
        expect(pelaFatia.map((l) => [l.id, l.categorySlugs, l.categoryStatus]), u)
          .toEqual(pelaBase.map((l) => [l.id, l.categorySlugs, l.categoryStatus]));
      }
      expect(computeDailyGoalSlots(fatias.get('u2'), byLead, 'u2').map((l) => l.id)).toEqual([leads[0].id]);
    });

    it('o contato feito entra na fatia de quem o fez, mesmo depois de voltar para o dono do lead', () => {
      // O u2 fez o contato que recebeu, e depois o u1 marcou o próximo contato
      // para ele mesmo (nextFollowUpOwnerId null).
      const l = lead({ consultantId: 'u1', nextFollowUpOwnerId: null, nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Mensagem' });
      const marcas = [marcaDe(l.id, 'u2', DAILY_GOAL_CATEGORIES.CONTATO_HOJE)];
      const byLead = buildInteractionsByLead(marcas);
      const fatias = leadsByGoalOwner([l], marcas);
      expect(fatias.get('u2')).toEqual([l]);
      const doU2 = computeDailyGoalSlots(fatias.get('u2'), byLead, 'u2');
      expect(doU2.map((x) => [x.id, x.categorySlugs, x.categoryStatus])).toEqual([[l.id, [DAILY_GOAL_CATEGORIES.CONTATO_HOJE], { [DAILY_GOAL_CATEGORIES.CONTATO_HOJE]: true }]]);
      expect(computeDailyGoalSlots(fatias.get('u1'), byLead, 'u1')).toEqual([]);
    });

    it('a marca de contato de antes do campo entra na fatia de quem a gravou, e a Meta pela fatia é a da base inteira', () => {
      // O u2 concluiu, numa aba com o código antigo, o contato que tinha
      // recebido, e depois o u1 pegou o próximo contato para ele, para hoje.
      const l = lead({ consultantId: 'u1', nextFollowUpOwnerId: null, nextFollowUp: as16, nextFollowUpType: 'Mensagem' });
      const marcas = [{ ...goalDone(l.id, DAILY_GOAL_CATEGORIES.CONTATO_HOJE), actorId: 'u2' }];
      const byLead = buildInteractionsByLead(marcas);
      const fatias = leadsByGoalOwner([l], marcas);
      expect(fatias.get('u2')).toEqual([l]);
      for (const u of ['u1', 'u2']) {
        const pelaFatia = computeDailyGoalSlots(fatias.get(u) || [], byLead, u);
        const pelaBase = computeDailyGoalSlots([l], byLead, u);
        expect(pelaFatia.map((x) => [x.id, x.categoryStatus]), u).toEqual(pelaBase.map((x) => [x.id, x.categoryStatus]));
      }
      expect(computeDailyGoalSlots(fatias.get('u2'), byLead, 'u2').map((x) => x.categoryStatus))
        .toEqual([{ [DAILY_GOAL_CATEGORIES.CONTATO_HOJE]: true }]);
    });
  });
});
