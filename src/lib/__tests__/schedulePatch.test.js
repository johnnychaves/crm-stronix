import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSchedulePatch, appointmentTaskOwnerFor, taskOwnerText } from '../schedulePatch.js';

// O patch é aplicado com set(merge:true): o que ele NÃO menciona sobrevive,
// e null MENCIONADO sobrescreve. Os testes checam as duas coisas.
const aplicar = (lead, patch) => ({ ...lead, ...patch });

const AULA = new Date(2026, 7, 20, 18, 0);
const MSG = new Date(2026, 7, 19, 9, 0);

const leadComAula = {
  appointmentType: 'aula_experimental',
  appointmentScheduledFor: AULA,
  appointmentModality: 'Musculação',
  appointmentProfessorId: 'p1',
  currentAulaId: 'aula123',
};

describe('buildSchedulePatch — o bug relatado em 18/08/2026', () => {
  it('MENSAGEM não apaga a aula marcada', () => {
    const patch = buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG });
    const depois = aplicar(leadComAula, patch);

    expect(depois.appointmentType).toBe('aula_experimental');
    expect(depois.appointmentScheduledFor).toBe(AULA);
    expect(depois.appointmentModality).toBe('Musculação');
    expect(depois.currentAulaId).toBe('aula123');
    // e o contato foi agendado
    expect(depois.nextFollowUp).toBe(MSG);
    expect(depois.nextFollowUpType).toBe('Mensagem');
  });

  it('LIGAÇÃO não apaga a aula marcada', () => {
    const depois = aplicar(leadComAula, buildSchedulePatch({ typeLabel: 'Ligação', date: MSG }));
    expect(depois.appointmentType).toBe('aula_experimental');
    expect(depois.appointmentScheduledFor).toBe(AULA);
  });

  it('MENSAGEM não apaga a visita marcada', () => {
    const visita = new Date(2026, 7, 21, 10, 0);
    const lead = { appointmentType: 'visita', appointmentScheduledFor: visita, appointmentUnit: 'Centro' };
    const depois = aplicar(lead, buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG }));
    expect(depois.appointmentType).toBe('visita');
    expect(depois.appointmentScheduledFor).toBe(visita);
    expect(depois.appointmentUnit).toBe('Centro');
  });

  it('mensagem/ligação NÃO mencionam nenhum campo de compromisso', () => {
    for (const typeLabel of ['Mensagem', 'Ligação']) {
      const patch = buildSchedulePatch({ typeLabel, date: MSG });
      const tocados = Object.keys(patch).filter((k) => k.startsWith('appointment') || k === 'currentAulaId' || k === 'trialClassesPlanned');
      expect(tocados).toEqual([]);
    }
  });
});

describe('buildSchedulePatch — compromisso formal', () => {
  it('AULA grava o compromisso e os extras do tipo', () => {
    const patch = buildSchedulePatch({
      typeLabel: 'Aula Experimental', date: AULA,
      modalidade: 'Jiu-Jitsu', professorId: 'p9', professorName: 'Ana', quantidade: 3,
      currentAulaId: 'nova',
    });
    expect(patch).toMatchObject({
      appointmentType: 'aula_experimental',
      appointmentScheduledFor: AULA,
      appointmentModality: 'Jiu-Jitsu',
      appointmentProfessorId: 'p9',
      appointmentProfessorName: 'Ana',
      trialClassesPlanned: 3,
      appointmentUnit: null,
      currentAulaId: 'nova',
    });
  });

  it('VISITA grava a unidade e limpa os extras de aula', () => {
    const patch = buildSchedulePatch({ typeLabel: 'Visita', date: AULA, unidade: 'Centro' });
    expect(patch).toMatchObject({
      appointmentType: 'visita',
      appointmentUnit: 'Centro',
      appointmentModality: null,
      appointmentProfessorId: null,
      appointmentSoloTraining: false,
      trialClassesPlanned: null,
    });
  });

  it('compromisso novo nasce sem desfecho colado do anterior', () => {
    const lead = { appointmentOutcome: 'no_show', appointmentOutcomeAt: new Date(2026, 6, 1) };
    const depois = aplicar(lead, buildSchedulePatch({ typeLabel: 'Visita', date: AULA }));
    expect(depois.appointmentOutcome).toBeNull();
    expect(depois.appointmentOutcomeAt).toBeNull();
  });

  it('trocar aula por visita não deixa professor para trás', () => {
    const depois = aplicar(leadComAula, buildSchedulePatch({ typeLabel: 'Visita', date: AULA, unidade: 'Centro' }));
    expect(depois.appointmentProfessorId).toBeNull();
    expect(depois.appointmentModality).toBeNull();
  });
});

describe('buildSchedulePatch — dono da tarefa', () => {
  it('mensagem grava o dono escolhido', () => {
    const p = buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG, contactOwnerId: 'u2', contactOwnerName: 'Maria' });
    expect(p.nextFollowUpOwnerId).toBe('u2');
    expect(p.nextFollowUpOwnerName).toBe('Maria');
  });

  it('ligação grava o dono escolhido', () => {
    const p = buildSchedulePatch({ typeLabel: 'Ligação', date: MSG, contactOwnerId: 'u2', contactOwnerName: 'Maria' });
    expect(p.nextFollowUpOwnerId).toBe('u2');
  });

  // Explicitamente null, não ausente: agendamento novo não pode herdar o
  // delegado do agendamento anterior.
  it('sem escolha, grava null e a tarefa volta para o dono do lead', () => {
    const antes = { nextFollowUpOwnerId: 'u9', nextFollowUpOwnerName: 'Antigo' };
    const p = buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG });
    expect(p.nextFollowUpOwnerId).toBeNull();
    expect(p.nextFollowUpOwnerName).toBeNull();
    expect({ ...antes, ...p }.nextFollowUpOwnerId).toBeNull();
  });

  it('visita e aula NÃO mexem no dono da tarefa de contato', () => {
    for (const typeLabel of ['Visita', 'Aula Experimental']) {
      const p = buildSchedulePatch({ typeLabel, date: AULA, contactOwnerId: 'u2', contactOwnerName: 'Maria' });
      expect(p).not.toHaveProperty('nextFollowUpOwnerId');
      expect(p).not.toHaveProperty('nextFollowUpOwnerName');
    }
  });
});

describe('buildSchedulePatch — dono da tarefa do agendamento (visita e aula)', () => {
  it('visita grava quem ficou com a tarefa', () => {
    const p = buildSchedulePatch({ typeLabel: 'Visita', date: AULA, unidade: 'Centro', appointmentOwnerId: 'u3', appointmentOwnerName: 'Caio' });
    expect(p.appointmentOwnerId).toBe('u3');
    expect(p.appointmentOwnerName).toBe('Caio');
  });

  it('aula grava quem ficou com a tarefa', () => {
    const p = buildSchedulePatch({ typeLabel: 'Aula Experimental', date: AULA, appointmentOwnerId: 'u3', appointmentOwnerName: 'Caio' });
    expect(p.appointmentOwnerId).toBe('u3');
    expect(p.appointmentOwnerName).toBe('Caio');
  });

  // Explicitamente null, não ausente: o agendamento novo que fica com o dono do
  // lead não pode herdar quem recebeu a tarefa do agendamento anterior.
  it('sem dono da tarefa, visita e aula gravam null e não herdam o anterior', () => {
    const antes = { appointmentOwnerId: 'u9', appointmentOwnerName: 'Antigo' };
    for (const typeLabel of ['Visita', 'Aula Experimental']) {
      const p = buildSchedulePatch({ typeLabel, date: AULA });
      expect(p).toHaveProperty('appointmentOwnerId', null);
      expect(p).toHaveProperty('appointmentOwnerName', null);
      expect(aplicar(antes, p)).toMatchObject({ appointmentOwnerId: null, appointmentOwnerName: null });
    }
  });

  it('nome sem id não é gravado', () => {
    const p = buildSchedulePatch({ typeLabel: 'Visita', date: AULA, appointmentOwnerName: 'Caio' });
    expect(p.appointmentOwnerId).toBeNull();
    expect(p.appointmentOwnerName).toBeNull();
  });

  it('id sem nome grava o id e o nome vazio', () => {
    const p = buildSchedulePatch({ typeLabel: 'Visita', date: AULA, appointmentOwnerId: 'u3' });
    expect(p.appointmentOwnerId).toBe('u3');
    expect(p.appointmentOwnerName).toBeNull();
  });

  it('mensagem e ligação não mexem no dono da tarefa do agendamento', () => {
    const antes = { ...leadComAula, appointmentOwnerId: 'u3', appointmentOwnerName: 'Caio' };
    for (const typeLabel of ['Mensagem', 'Ligação']) {
      const p = buildSchedulePatch({ typeLabel, date: MSG, appointmentOwnerId: 'u4', appointmentOwnerName: 'Dani' });
      expect(p).not.toHaveProperty('appointmentOwnerId');
      expect(p).not.toHaveProperty('appointmentOwnerName');
      expect(aplicar(antes, p)).toMatchObject({ appointmentOwnerId: 'u3', appointmentOwnerName: 'Caio' });
    }
  });
});

// Quem fica com a tarefa da visita ou da aula. Regra do dono (decisão de
// 05/10/2026): quem agenda no lead de outro consultor e participa da Meta
// Diária (é consultor) fica com a tarefa. Dono do lead, gestor e professor
// deixam a tarefa com o dono do lead, e a função devolve null.
describe('appointmentTaskOwnerFor', () => {
  const ANA = { id: 'u-ana', name: 'Ana Souza', role: 'consultant' };
  const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', role: 'consultant' };
  const JOHNNY = { id: 'u-johnny', name: 'Johnny', role: 'admin' };
  const CAIO = { id: 'u-caio', name: 'Caio Prof', role: 'professor', professorId: 'p1' };
  const leadDaAna = { id: 'L1', consultantId: 'u-ana', consultantName: 'Ana Souza' };

  it('consultor que não é dono do lead fica com a tarefa', () => {
    expect(appointmentTaskOwnerFor({ scheduler: BRUNO, lead: leadDaAna })).toEqual({ id: 'u-bruno', name: 'Bruno Lima' });
  });

  it('cadastro sem papel e cadastro antigo valem consultor', () => {
    expect(appointmentTaskOwnerFor({ scheduler: { id: 'u-x', name: 'X' }, lead: leadDaAna })).toEqual({ id: 'u-x', name: 'X' });
    expect(appointmentTaskOwnerFor({ scheduler: { id: 'u-y', name: 'Y', role: 'consultor' }, lead: leadDaAna })).toEqual({ id: 'u-y', name: 'Y' });
  });

  it('o dono do lead deixa a tarefa com ele mesmo', () => {
    expect(appointmentTaskOwnerFor({ scheduler: ANA, lead: leadDaAna })).toBeNull();
  });

  it('gestor e professor não participam da Meta: a tarefa fica com o dono do lead', () => {
    expect(appointmentTaskOwnerFor({ scheduler: JOHNNY, lead: leadDaAna })).toBeNull();
    expect(appointmentTaskOwnerFor({ scheduler: CAIO, lead: leadDaAna })).toBeNull();
  });

  it('o gestor que é dono do lead também fica com a tarefa, como hoje', () => {
    expect(appointmentTaskOwnerFor({ scheduler: JOHNNY, lead: { id: 'L2', consultantId: 'u-johnny' } })).toBeNull();
  });

  it('consultor desligado não tem Meta: a tarefa fica com o dono do lead', () => {
    expect(appointmentTaskOwnerFor({ scheduler: { ...BRUNO, active: false }, lead: leadDaAna })).toBeNull();
  });

  it('lead sem dono: a tarefa fica com o consultor que agendou', () => {
    expect(appointmentTaskOwnerFor({ scheduler: BRUNO, lead: { id: 'L3', consultantId: null } })).toEqual({ id: 'u-bruno', name: 'Bruno Lima' });
    expect(appointmentTaskOwnerFor({ scheduler: BRUNO, lead: { id: 'L4' } })).toEqual({ id: 'u-bruno', name: 'Bruno Lima' });
  });

  it('sem nome, devolve o id e o nome vazio', () => {
    expect(appointmentTaskOwnerFor({ scheduler: { id: 'u-bruno', role: 'consultant' }, lead: leadDaAna })).toEqual({ id: 'u-bruno', name: null });
  });

  it('sem quem agenda, ou sem id, nada muda', () => {
    expect(appointmentTaskOwnerFor({ scheduler: null, lead: leadDaAna })).toBeNull();
    expect(appointmentTaskOwnerFor({ scheduler: { name: 'Sem id', role: 'consultant' }, lead: leadDaAna })).toBeNull();
    expect(appointmentTaskOwnerFor({ lead: leadDaAna })).toBeNull();
    expect(appointmentTaskOwnerFor()).toBeNull();
  });

  it('o que devolve entra direto no buildSchedulePatch', () => {
    const dono = appointmentTaskOwnerFor({ scheduler: BRUNO, lead: leadDaAna });
    const p = buildSchedulePatch({ typeLabel: 'Visita', date: AULA, appointmentOwnerId: dono?.id, appointmentOwnerName: dono?.name });
    expect(p).toMatchObject({ appointmentOwnerId: 'u-bruno', appointmentOwnerName: 'Bruno Lima' });
    const doDono = appointmentTaskOwnerFor({ scheduler: ANA, lead: leadDaAna });
    expect(buildSchedulePatch({ typeLabel: 'Visita', date: AULA, appointmentOwnerId: doDono?.id, appointmentOwnerName: doDono?.name }))
      .toMatchObject({ appointmentOwnerId: null, appointmentOwnerName: null });
  });
});

// Os dois caminhos que agendam decidem o dono da tarefa pela mesma regra: o
// assistente da ficha com quem está logado (aqui) e a ponte com o actor (o
// buildScheduleWrites, testado em api/__tests__/zapSchedule.test.js). O
// handler da ficha só roda com a tela inteira, então esta varredura lê o
// código dele, como a do registro do agendamento
// (registroDoAgendamento.sweep.test.js), e reprova quem voltar a decidir o dono
// da tarefa na mão.
describe('o assistente da ficha usa a regra do dono da tarefa', () => {
  const ficha = readFileSync(fileURLToPath(new URL('../../views/LeadProfileView.jsx', import.meta.url)), 'utf8');
  const inicio = ficha.indexOf('const handleWizardConfirm = async');
  const corpo = ficha.slice(inicio, ficha.indexOf('\n  };\n', inicio));

  it('decide com quem está logado, só na visita e na aula', () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).toContain('appointmentType ? appointmentTaskOwnerFor({ scheduler: appUser, lead }) : null');
  });

  it('grava o dono da tarefa no patch do lead', () => {
    const patch = corpo.slice(corpo.indexOf('const up = buildSchedulePatch({'), corpo.indexOf('});', corpo.indexOf('const up = buildSchedulePatch({')));
    expect(patch).toContain('appointmentOwnerId: apptOwner?.id || null');
    expect(patch).toContain('appointmentOwnerName: apptOwner?.name || null');
  });

  it('o texto diz de quem é a tarefa pelo mesmo aviso da ponte', () => {
    expect(corpo).toContain('taskOwnerText(apptOwner.name)');
    expect(corpo).toContain('taskOwnerText(wizOwnerName)');
    expect(corpo).not.toContain('· tarefa de');
  });
});

// O aviso que a ficha do dono mostra quando a tarefa vai para outra pessoa, no
// texto da interação do agendamento. O mesmo do contato delegado.
describe('taskOwnerText', () => {
  it('diz de quem é a tarefa', () => {
    expect(taskOwnerText('Bruno Lima')).toBe(' · tarefa de Bruno Lima');
  });

  it('sem nome, diz outro consultor', () => {
    expect(taskOwnerText(null)).toBe(' · tarefa de outro consultor');
    expect(taskOwnerText('')).toBe(' · tarefa de outro consultor');
    expect(taskOwnerText()).toBe(' · tarefa de outro consultor');
  });
});
