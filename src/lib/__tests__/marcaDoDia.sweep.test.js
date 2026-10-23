// Toda marca do dia (daily_goal_done) que a Meta Diária grava com a categoria
// da tarefa leva o dono da tarefa da visita, da aula e do contato
// (goalOwnerFields, em src/lib/leads.js). O crédito dessas três categorias
// segue esse campo. Sem ele, a visita e a aula valem para o dono da tarefa de
// agora, que muda a cada agendamento novo, e aí a tarefa feita muda de Meta
// junto. No contato, a marca sem o campo vale para quem a gravou, que é a saída
// para as marcas de antes do campo, e não a regra. Esta varredura lê o código
// da Meta e do ContactOutcomeModal, que grava a marca do contato, e reprova
// quem gravar a marca sem o campo. A Agenda de hoje e a correção do desfecho
// gravam pelo writeAppointmentOutcome, que o appointmentOutcome.test.js cobre.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const META = ler('../../views/DailyGoalView.jsx');
const MODAL_DO_CONTATO = ler('../../modals/ContactOutcomeModal.jsx');
const REGRA_DO_DESFECHO = ler('../fichaOutcome.js');

// Os handlers `const nome = async (...) => { ... };` da view, cada um até a
// primeira linha que só fecha a função com dois espaços de recuo (o mesmo
// recorte do registroDoAgendamento.sweep.test.js).
const HANDLERS = [...META.matchAll(/\n {2}const (\w+) = async /g)].map((m) => ({
  nome: m[1],
  corpo: META.slice(m.index, META.indexOf('\n  };\n', m.index)),
}));
const corpoDe = (nome) => HANDLERS.find((h) => h.nome === nome)?.corpo || '';

describe('a marca do dia da Meta leva o dono da tarefa', () => {
  const comMarca = HANDLERS.filter(({ corpo }) => corpo.includes('dailyGoalCategory')).map((h) => h.nome);

  // Se o recorte parar de achar os handlers, a varredura passaria sem olhar
  // nada. A lista é a de hoje: handler novo que grave a marca entra aqui.
  it('acha os handlers que gravam a marca com a categoria', () => {
    expect([...comMarca].sort()).toEqual(
      ['commitNextContact', 'commitNoNextContact', 'concludeTask', 'handleOutcome', 'handleReschedule']
    );
  });

  it.each(comMarca)('%s grava o goalOwnerFields junto da categoria', (nome) => {
    expect(corpoDe(nome)).toContain('goalOwnerFields(lead, categorySlug)');
  });

  // O "Contato feito" e o Reagendar do contato gravam a marca dentro do modal:
  // o primeiro pelo logInteraction, o segundo pelo logInteractions, junto da
  // nota do motivo.
  it('o ContactOutcomeModal grava o goalOwnerFields em toda marca', () => {
    const chamadas = [...MODAL_DO_CONTATO.matchAll(/logInteractions?\(([\s\S]*?)\);\n/g)].map((m) => m[1]);
    const comMarcaNoModal = chamadas.filter((c) => c.includes("type: 'daily_goal_done'"));
    expect(comMarcaNoModal).toHaveLength(2);
    comMarcaNoModal.forEach((c) => expect(c).toContain('goalOwnerFields(lead, categorySlug)'));
  });

  // Dois cliques na mesma linha da Agenda não repetem a marca. A conferência é
  // pela marca do dono da tarefa de agora: a marca da visita que outra pessoa
  // fez de manhã no mesmo lead não pode impedir a marca da visita de agora. A
  // regra mora no outcomeRuleFor (src/lib/fichaOutcome.js), que a Agenda e o A
  // seguir da ficha chamam; o fichaOutcome.test.js a compara com a regra que a
  // Agenda tinha escrita à mão.
  it('a Agenda de hoje confere a marca do dono da tarefa antes de gravar outra', () => {
    const agenda = corpoDe('markAgendaPresence');
    expect(agenda).toContain('outcomeRuleFor(row, row.categorySlug');
    expect(agenda).toContain('writeGoalDone,');
    expect(REGRA_DO_DESFECHO).toContain('hasGoalDoneTodayFor(');
    expect(REGRA_DO_DESFECHO).toContain('appointmentTaskOwnerId(lead)');
    expect(REGRA_DO_DESFECHO).not.toMatch(/hasGoalDoneToday\(/);
  });
});

// Dois cliques antes de o card sumir gravavam a marca duas vezes. O desfecho de
// visita ou aula e o Concluir seguram a tarefa enquanto gravam. A gravação do
// Concluir mora no concludeTask, que o Desfazer da tela chama depois do prazo.
describe('a marca do dia não repete no clique duplo', () => {
  it.each(['handleOutcome', 'concludeTask'])('%s segura a tarefa enquanto grava', (nome) => {
    const corpo = corpoDe(nome);
    expect(corpo).toContain('claimTask(taskKey)');
    expect(corpo).toContain('releaseTask(taskKey)');
  });

  // Colada ao try: o finally sempre a solta. Antes dele, uma conta que falhasse
  // deixava a tarefa presa e o card sem responder.
  it.each(['handleOutcome', 'concludeTask'])('%s pega a trava logo antes do try', (nome) => {
    expect(corpoDe(nome)).toMatch(/if \(!claimTask\(taskKey\)\) return;\n {4}try \{/);
  });
});

// O card da Meta tira do lead o que a Agenda de hoje tira: o eco do
// agendamento (consumedFields). A exceção de cliente saiu em 17/10/2026.
describe('o desfecho do card segue a regra do eco do agendamento', () => {
  it('handleOutcome usa o consumedFields com o lead', () => {
    expect(corpoDe('handleOutcome')).toContain('consumedFields(outcome, lead)');
  });

  it('não sobrou a exceção de cliente nem a flag antiga', () => {
    expect(META).not.toContain('consumeAppointment');
    expect(META).not.toMatch(/consumedFields\([^)]*client/);
  });
});

// O botão de reagendar do card (o antigo "Adiar p/ amanhã") só abre o pop-up de
// desfecho no Reagendar, que pede o motivo e grava a marca. Até 17/10/2026 ele
// gravava o próximo contato direto: a tarefa saía da Meta sem marca e sem
// motivo, o atrasado de uma visita perdida virava visita falsa no dia seguinte
// e o agendamento do aluno era apagado.
describe('o Reagendar do card só abre o pop-up', () => {
  const inicio = META.indexOf('const handleRescheduleTask = ');
  const corpo = META.slice(inicio, META.indexOf('\n  };\n', inicio));

  it('abre o pop-up de desfecho no Reagendar', () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).toContain("openOutcomePopup(lead, categorySlug, 'reagendar')");
  });

  it('não grava nada sozinho', () => {
    expect(corpo).not.toMatch(/logInteraction|updateDoc|nextFollowUp|appointmentScheduledFor/);
  });

  it('o bloco Agora passa a categoria e a tela liga o botão a ele', () => {
    expect(ler('../../components/dailygoal/foco/AgoraCard.jsx')).toContain('onPostpone(lead, slug)');
    expect(META).toContain('onPostpone={handleRescheduleTask}');
    expect(META).not.toContain('handleSnooze');
  });
});

// O Concluir do Novo lead trata o lead: sem o newLeadHandledAt, ele voltava
// como Atrasado quando a janela de 24h fechasse (newLeadDueOf).
describe('o Concluir do Novo lead marca o lead como tratado', () => {
  // A regra de qual categoria grava o campo mora no newLeadHandledPatch, com
  // teste próprio (dailyGoal.test.js). Aqui só se confere que o Concluir passa
  // o patch dele, com a categoria da tarefa.
  it('concludeTask grava o newLeadHandledPatch da categoria', () => {
    expect(corpoDe('concludeTask')).toContain('newLeadHandledPatch(categorySlug)');
  });
});
