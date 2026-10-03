import { describe, it, expect, vi, afterAll } from 'vitest';

// O professor na ponte com o Stronizap (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md). Ele fala
// com os alunos pelo canal dos professores do Stronizap, com o mesmo e-mail do
// Stronilead. A ponte grava pelo Admin SDK, que passa por cima do
// firestore.rules, então as travas do professor moram aqui também: ele não
// cadastra lead, não vira dono, não aparece na equipe do cadastro e não conta
// na Meta. Agenda, como no Agendar da ficha, e só com o módulo ligado. O papel
// que vai para o Stronizap continua 'consultor', porque o Stronizap só conhece
// gestor e consultor.
//
// Como nos outros testes da ponte, o processo vai para UTC antes de importar
// as regras: a função da Vercel roda em UTC.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { ZAP_LEAD_MESSAGES, refusal, teamRole, buildLeadOptions, resolveOwner, signupRefusal } from '../_zapLead.js';
import { ZAP_SCHEDULE_MESSAGES, countsForMeta, buildScheduleOptions, scheduleRefusal } from '../_zapSchedule.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Equipe como mora em stronix_users. O cadastro do professor nasce pelo
// servidor, com o id igual ao uid da conta.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };
const CAIO = {
  id: 'auth-caio', name: 'Caio Prof', email: 'caio@stronix.com.br', authUid: 'auth-caio', role: 'professor', professorId: 'p1'
};
const EQUIPE = [JOHNNY, CAIO, ANA];

// Terça, 29/09/2026, às 15:40 de Brasília.
const AGORA = new Date('2026-09-29T18:40:00.000Z');
const SEG_A_SEX = [1, 2, 3, 4, 5];
const COM_MODULO = { modules: ['faltosos'] };
const SEM_MODULO = { modules: [] };
const PROFESSOR_DESLIGADO = 'O acesso de professor está desligado nesta academia. Fale com o gestor.';

describe('o papel que vai para o Stronizap', () => {
  it('o professor responde consultor, e o gestor continua gestor', () => {
    expect(teamRole(CAIO)).toBe('consultor');
    expect(teamRole(ANA)).toBe('consultor');
    expect(teamRole(JOHNNY)).toBe('gestor');
  });
});

describe('signupRefusal: quem cadastra lead pelo Stronizap', () => {
  it('consultora e gestor cadastram', () => {
    expect(signupRefusal(ANA, ANA.email)).toBeNull();
    expect(signupRefusal(JOHNNY, JOHNNY.email)).toBeNull();
  });

  it('o professor recebe a recusa com o texto pronto para a tela', () => {
    expect(signupRefusal(CAIO, CAIO.email)).toEqual(refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.professorNoLead));
    expect(ZAP_LEAD_MESSAGES.professorNoLead)
      .toBe('Seu acesso de professor no Stronilead não cadastra lead. Peça a um consultor ou ao gestor.');
  });

  it('quem não está na equipe continua com o aviso do e-mail', () => {
    expect(signupRefusal(null, 'carla@stronix.com.br'))
      .toEqual(refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam('carla@stronix.com.br')));
  });
});

describe('o professor fora da equipe do cadastro', () => {
  it('não aparece na lista de consultor responsável que o gestor vê', () => {
    const opcoes = buildLeadOptions({ actor: JOHNNY, team: EQUIPE, catalogs: {} });
    expect(opcoes.team).toEqual([{ id: 'u-ana', name: 'Ana Souza' }, { id: 'u-johnny', name: 'Johnny' }]);
  });

  it('não pode ser escolhido como dono do lead', () => {
    expect(resolveOwner({ actor: JOHNNY, ownerId: CAIO.id, team: EQUIPE }))
      .toEqual({ refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.ownerGone) });
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-ana', team: EQUIPE })).toEqual({ owner: ANA });
  });
});

describe('o professor no agendamento', () => {
  it('agendar não conta na Meta do professor nem na do gestor', () => {
    expect(countsForMeta({ member: CAIO, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(false);
    expect(countsForMeta({ member: JOHNNY, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(false);
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(true);
  });

  it('as opções do balão saem com o papel consultor e fora da Meta', () => {
    const opcoes = buildScheduleOptions({ member: CAIO, catalogs: {}, now: AGORA });
    expect(opcoes.actor).toEqual({ id: CAIO.id, name: 'Caio Prof', role: 'consultor', countsForMeta: false });
  });

  it('com o módulo ligado, o professor agenda', () => {
    expect(scheduleRefusal(CAIO, CAIO.email, COM_MODULO)).toBeNull();
  });

  it('com o módulo desligado, ou sem a lista na academia, a recusa diz que o acesso está desligado', () => {
    for (const tenant of [SEM_MODULO, {}, { modules: 'faltosos' }, null]) {
      expect(scheduleRefusal(CAIO, CAIO.email, tenant), JSON.stringify(tenant))
        .toEqual(refusal(403, 'fora_da_equipe', PROFESSOR_DESLIGADO));
    }
    expect(ZAP_SCHEDULE_MESSAGES.professorOff).toBe(PROFESSOR_DESLIGADO);
  });

  it('consultora e gestor agendam com ou sem o módulo', () => {
    for (const tenant of [COM_MODULO, SEM_MODULO, null]) {
      expect(scheduleRefusal(ANA, ANA.email, tenant)).toBeNull();
      expect(scheduleRefusal(JOHNNY, JOHNNY.email, tenant)).toBeNull();
    }
  });

  it('quem não está na equipe recebe o aviso do e-mail', () => {
    expect(scheduleRefusal(null, 'carla@stronix.com.br', COM_MODULO))
      .toEqual(refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam('carla@stronix.com.br')));
  });
});

describe('textos novos da ponte', () => {
  it('nenhum tem travessão, meia-risca nem aspas curvas', () => {
    for (const texto of [ZAP_LEAD_MESSAGES.professorNoLead, ZAP_SCHEDULE_MESSAGES.professorOff]) {
      expect(typeof texto).toBe('string');
      expect(texto).not.toMatch(/[—–“”‘’]/);
    }
  });
});
