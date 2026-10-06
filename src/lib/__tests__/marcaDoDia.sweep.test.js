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
      ['commitNextContact', 'commitNoNextContact', 'handleGoalDone', 'handleOutcome', 'handleReschedule']
    );
  });

  it.each(comMarca)('%s grava o goalOwnerFields junto da categoria', (nome) => {
    expect(corpoDe(nome)).toContain('goalOwnerFields(lead, categorySlug)');
  });

  // O "Contato feito" e o Reagendar do contato gravam a marca dentro do modal,
  // cada um numa chamada do logInteraction.
  it('o ContactOutcomeModal grava o goalOwnerFields em toda marca', () => {
    const chamadas = [...MODAL_DO_CONTATO.matchAll(/logInteraction\(([\s\S]*?)\);\n/g)].map((m) => m[1]);
    const comMarcaNoModal = chamadas.filter((c) => c.includes("type: 'daily_goal_done'"));
    expect(comMarcaNoModal).toHaveLength(2);
    comMarcaNoModal.forEach((c) => expect(c).toContain('goalOwnerFields(lead, categorySlug)'));
  });

  // Dois cliques na mesma linha da Agenda não repetem a marca. A conferência é
  // pela marca do dono da tarefa de agora: a marca da visita que outra pessoa
  // fez de manhã no mesmo lead não pode impedir a marca da visita de agora.
  it('a Agenda de hoje confere a marca do dono da tarefa antes de gravar outra', () => {
    const agenda = corpoDe('markAgendaPresence');
    expect(agenda).toContain('hasGoalDoneTodayFor(');
    expect(agenda).toContain('appointmentTaskOwnerId(row)');
    expect(agenda).not.toMatch(/hasGoalDoneToday\(/);
  });
});
