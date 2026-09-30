// Quem agenda visita ou aula grava o registro em stronix_aulas pela regra
// única de src/lib/aulas.js (recordPlanFor). Sem ela, agendar de novo depois de
// um "Compareceu" ou de um "Não veio" move o registro para a data nova, e o
// Dashboard CRM perde o desfecho no mês original. Esta varredura lê o código e
// reprova quem voltar a gravar o registro por conta própria.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

// O corpo de um handler `const nome = async (...) => { ... };` da view, até a
// primeira linha que só fecha a função com dois espaços de recuo.
function corpoDe(fonte, nome) {
  const inicio = fonte.indexOf(`const ${nome} = async`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf('\n  };\n', inicio));
}

describe('o registro do agendamento passa pela regra única', () => {
  it('o assistente da ficha grava pelo recordNewAppointment, e não chama os upserts direto', () => {
    const corpo = corpoDe(ler('../../views/LeadProfileView.jsx'), 'handleWizardConfirm');
    expect(corpo).toContain('recordNewAppointment({');
    expect(corpo).not.toMatch(/upsertScheduledAula|upsertScheduledAppointment|closeOpenAppointment/);
  });
});
