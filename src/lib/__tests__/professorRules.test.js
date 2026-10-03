// As travas do professor moram no firestore.rules, que o Johnny publica à mão
// no console (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "As regras do Firestore"). O professor só altera no lead os campos que o
// Agendar e o composer da ficha gravam, sempre com o desfecho vazio, só cria
// interação dos tipos que essas ações gravam, e com o módulo desligado não
// grava lead nem interação. No registro da aula (stronix_aulas) ele grava como
// os outros membros, inclusive o status e o desfecho, com o módulo ligado ou
// desligado: as travas valem só para o espelho do lead e para as interações.
// Este teste lê o texto da regra e cobra três coisas:
//   1. as listas da regra (professorLeadFields, professorOutcomeFields e
//      professorInteractionTypes) são iguais às de src/lib/professorWrites.js;
//   2. as listas de professorWrites.js são as que os montadores de verdade
//      produzem (buildSchedulePatch, logInteraction e os handlers da ficha);
//   3. as travas continuam ligadas em lead, contrato, interação e equipe.
// Mudou o Agendar ou o composer, o teste quebra até a regra acompanhar. Aí é
// mudar a regra, publicar no console e só depois fazer o merge.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSchedulePatch } from '../schedulePatch.js';
import { planProfileNote } from '../profileNote.js';
import {
  SCHEDULE_TYPE_LABELS,
  LEAD_BUMP_FIELDS,
  SCHEDULE_PATCH_FIELDS,
  PROFESSOR_LEAD_FIELDS,
  PROFESSOR_OUTCOME_FIELDS,
  PROFESSOR_INTERACTION_TYPES,
} from '../professorWrites.js';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const RULES = ler('../../../firestore.rules');
const ordenado = (xs) => [...xs].sort();

// A lista que uma função da regra devolve: `function nome() { return [ ... ]; }`.
// Só os textos entre aspas simples contam, então a regra não pode ter
// comentário dentro da lista.
function listaDaRegra(nome) {
  const m = new RegExp(`function ${nome}\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\];\\s*\\}`).exec(RULES);
  expect(m, `function ${nome}() no firestore.rules`).not.toBeNull();
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// O corpo de uma função da regra, até a chave que a fecha (quatro espaços).
function funcaoDaRegra(assinatura) {
  const inicio = RULES.indexOf(`function ${assinatura} {`);
  expect(inicio, `function ${assinatura}`).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// O bloco `match` de uma coleção da academia, até a chave que o fecha.
function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// Uma linha `allow` do bloco (com as linhas de continuação), até a próxima
// `allow` ou o fim do bloco. `allow update, delete:` serve aos dois.
function regraDe(bloco, op) {
  const m = new RegExp(`allow [\\w, ]*\\b${op}\\b[\\w, ]*:([\\s\\S]*?)(?=\\n\\s*allow |$)`).exec(bloco);
  expect(m, `allow ${op}`).not.toBeNull();
  return m[1];
}

// O corpo de um handler `const nome = async (...) => { ... };` da ficha, até a
// primeira linha que só fecha a função com dois espaços de recuo (o mesmo
// recorte do registroDoAgendamento.sweep.test.js).
function corpoDe(fonte, nome) {
  const inicio = fonte.indexOf(`const ${nome} = async`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf('\n  };\n', inicio));
}

describe('a regra do professor tem as listas do professorWrites', () => {
  it('campos do lead: professorLeadFields() é PROFESSOR_LEAD_FIELDS, sem repetir', () => {
    const regra = listaDaRegra('professorLeadFields');
    expect(new Set(regra).size).toBe(regra.length);
    expect(ordenado(regra)).toEqual(ordenado(PROFESSOR_LEAD_FIELDS));
  });

  it('desfecho: professorOutcomeFields() é PROFESSOR_OUTCOME_FIELDS', () => {
    expect(ordenado(listaDaRegra('professorOutcomeFields'))).toEqual(ordenado(PROFESSOR_OUTCOME_FIELDS));
  });

  it('tipos de interação: professorInteractionTypes() é PROFESSOR_INTERACTION_TYPES, sem repetir', () => {
    const regra = listaDaRegra('professorInteractionTypes');
    expect(new Set(regra).size).toBe(regra.length);
    expect(ordenado(regra)).toEqual(ordenado(PROFESSOR_INTERACTION_TYPES));
  });

  it('o professor nunca troca o dono, a fase, o funil nem o cadastro do lead', () => {
    const regra = listaDaRegra('professorLeadFields');
    for (const campo of [
      'consultantId', 'consultantAuthUid', 'consultantName', 'status', 'funnelId',
      'lifecycleStage', 'lifecycleBucket', 'isConverted', 'name', 'whatsapp', 'cpf',
      'isMinor', 'guardian', 'currentContractId', 'currentContractStatus', 'photoUrl', 'referredById',
    ]) {
      expect(regra, campo).not.toContain(campo);
    }
  });
});

describe('as listas do professorWrites saem dos montadores de verdade', () => {
  it('os rótulos são os followUpLabel do ScheduleWizard', () => {
    const wizard = ler('../../components/profile/ScheduleWizard.jsx');
    const rotulos = [...wizard.matchAll(/followUpLabel:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(rotulos.length).toBeGreaterThan(0);
    expect(ordenado(SCHEDULE_TYPE_LABELS)).toEqual(ordenado(rotulos));
  });

  it('o patch do Agendar, com todos os campos preenchidos, tem as chaves de SCHEDULE_PATCH_FIELDS', () => {
    const cheio = {
      date: new Date(2026, 9, 2, 18, 0),
      modalidade: 'Musculação',
      professorId: 'p1',
      professorName: 'Ana',
      soloTraining: true,
      quantidade: 2,
      unidade: 'Centro',
      note: 'Traz a toalha',
      currentAulaId: 'aula1',
      contactOwnerId: 'u2',
      contactOwnerName: 'Bia',
    };
    const chaves = new Set(
      SCHEDULE_TYPE_LABELS.flatMap((typeLabel) => Object.keys(buildSchedulePatch({ ...cheio, typeLabel })))
    );
    expect(ordenado(SCHEDULE_PATCH_FIELDS)).toEqual(ordenado(chaves));
    expect(ordenado(PROFESSOR_LEAD_FIELDS)).toEqual(ordenado(new Set([...chaves, ...LEAD_BUMP_FIELDS])));
  });

  it('o desfecho são os três campos appointmentOutcome*, e o Agendar sempre os grava vazios', () => {
    expect(ordenado(PROFESSOR_OUTCOME_FIELDS))
      .toEqual(['appointmentOutcome', 'appointmentOutcomeAt', 'appointmentOutcomeBy']);
    for (const typeLabel of ['Visita', 'Aula Experimental']) {
      const patch = buildSchedulePatch({ typeLabel, date: new Date(2026, 9, 2, 18, 0) });
      for (const campo of PROFESSOR_OUTCOME_FIELDS) expect(patch[campo], `${typeLabel}: ${campo}`).toBeNull();
    }
    for (const typeLabel of ['Mensagem', 'Ligação']) {
      const patch = buildSchedulePatch({ typeLabel, date: new Date(2026, 9, 2, 18, 0) });
      for (const campo of PROFESSOR_OUTCOME_FIELDS) expect(campo in patch, `${typeLabel}: ${campo}`).toBe(false);
    }
  });

  it('o logInteraction soma no lead só os campos de LEAD_BUMP_FIELDS, mais o patch', () => {
    const fonte = ler('../interactions.js');
    const escrita = /LEADS_PATH, lead\.id\),\s*\{([\s\S]*?)\},\s*\{ merge: true \}/.exec(fonte);
    expect(escrita).not.toBeNull();
    const chaves = [...escrita[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]);
    expect(ordenado(chaves)).toEqual(ordenado(LEAD_BUMP_FIELDS));
    expect(escrita[1]).toContain('...(leadPatch || {})');
  });

  it('o logInteraction grava o actorAuthUid de quem fez a ação', () => {
    expect(ler('../interactions.js')).toContain('actorAuthUid: appUser?.authUid || null,');
  });

  it('a Anotação do composer grava um tipo da lista', () => {
    expect(PROFESSOR_INTERACTION_TYPES).toContain(planProfileNote('Ligou de volta').type);
  });
});

describe('as ações do professor na ficha passam pelo logInteraction', () => {
  const ficha = ler('../../views/LeadProfileView.jsx');
  const HANDLERS = ['saveInteraction', 'handleSendWhatsAppMessage', 'handleLogCall', 'handleWizardConfirm'];

  it.each(HANDLERS)('%s grava só pelo logInteraction, com tipo da lista', (nome) => {
    const corpo = corpoDe(ficha, nome);
    expect(corpo).toContain('logInteraction(db, lead, appUser');
    expect(corpo.match(/logInteraction\(/g)).toHaveLength(1);
    expect(corpo).not.toMatch(/\b(updateDoc|setDoc|addDoc|writeBatch|runTransaction|commit[A-Z]\w*)\(/);
    for (const [, tipo] of corpo.matchAll(/\btype: '([^']+)'/g)) {
      expect(PROFESSOR_INTERACTION_TYPES, `${nome}: type '${tipo}'`).toContain(tipo);
    }
  });

  it('Anotação, WhatsApp e Ligação não mandam patch para o lead', () => {
    for (const nome of ['saveInteraction', 'handleSendWhatsAppMessage', 'handleLogCall']) {
      expect(corpoDe(ficha, nome), nome)
        .toMatch(/logInteraction\(db, lead, appUser, (payload|\{[\s\S]*?\n\s*\})\);/);
    }
  });

  it('o Agendar manda para o lead só o patch do buildSchedulePatch', () => {
    const corpo = corpoDe(ficha, 'handleWizardConfirm');
    expect(corpo).toContain('const up = buildSchedulePatch({');
    expect(corpo).toMatch(/\},\s*up\s*\);/);
  });
});

describe('as travas do professor continuam no firestore.rules', () => {
  it('isProfessor confere o cadastro antes de ler o papel (conta antiga tem id diferente do uid)', () => {
    const f = funcaoDaRegra('isProfessor(appId)');
    expect(f).toContain('exists(/databases/$(database)/documents/artifacts/$(appId)/public/data/stronix_users/$(request.auth.uid))');
    expect(f).toContain(".data.get('role', null) == 'professor'");
  });

  it('lead: o professor não cria, não exclui e altera só os campos da lista, com o desfecho vazio', () => {
    const leads = blocoDe('stronix_leads');
    expect(regraDe(leads, 'create')).toContain('!isProfessor(appId)');
    expect(regraDe(leads, 'delete')).toContain('!isProfessor(appId)');
    expect(regraDe(leads, 'update')).toContain('(!isProfessor(appId) || professorLeadUpdateOk(appId))');
    const ok = funcaoDaRegra('professorLeadUpdateOk(appId)');
    expect(ok).toMatch(/let changed = request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\);/);
    expect(ok).toContain('changed.hasOnly(professorLeadFields())');
    expect(ok).toContain('(!changed.hasAny(professorOutcomeFields()) || professorOutcomeCleared())');
    const vazio = funcaoDaRegra('professorOutcomeCleared()');
    for (const campo of PROFESSOR_OUTCOME_FIELDS) {
      expect(vazio, campo).toContain(`request.resource.data.get('${campo}', null) == null`);
    }
  });

  it('contrato: o professor não cria nem altera', () => {
    const contratos = blocoDe('stronix_contratos');
    expect(regraDe(contratos, 'create')).toContain('!isProfessor(appId)');
    expect(regraDe(contratos, 'update')).toContain('!isProfessor(appId)');
  });

  it('interação: o professor cria só os tipos da lista, no próprio nome, e não edita nem apaga', () => {
    const interacoes = blocoDe('stronix_interactions');
    expect(regraDe(interacoes, 'create')).toContain('(!isProfessor(appId) || professorInteractionOk(appId))');
    expect(regraDe(interacoes, 'update')).toContain('!isProfessor(appId)');
    expect(regraDe(interacoes, 'delete')).toContain('!isProfessor(appId)');
    const ok = funcaoDaRegra('professorInteractionOk(appId)');
    expect(ok).toContain("request.resource.data.get('type', null) in professorInteractionTypes()");
    expect(ok).toContain("request.resource.data.get('actorAuthUid', null) == request.auth.uid");
  });

  it('com o módulo desligado, o professor não altera lead nem registra interação', () => {
    for (const f of ['professorLeadUpdateOk(appId)', 'professorInteractionOk(appId)']) {
      expect(funcaoDaRegra(f), f).toContain("hasModule(appId, 'faltosos')");
    }
  });

  it('o módulo é lido como lista no documento da academia', () => {
    const f = funcaoDaRegra('hasModule(appId, key)');
    expect(f).toContain('exists(/databases/$(database)/documents/tenants/$(appId))');
    expect(f).toContain("data.get('modules', []) is list");
    expect(f).toContain("key in get(/databases/$(database)/documents/tenants/$(appId)).data.get('modules', [])");
  });

  it('equipe: papel e professor ligado só mudam pelo servidor', () => {
    const equipe = blocoDe('stronix_users');
    expect(regraDe(equipe, 'update')).toContain('roleAndProfessorKept()');
    const mantidos = funcaoDaRegra('roleAndProfessorKept()');
    expect(mantidos).toContain("request.resource.data.get('role', null) == resource.data.get('role', null)");
    expect(mantidos).toContain("request.resource.data.get('professorId', null) == resource.data.get('professorId', null)");
    const criar = regraDe(equipe, 'create');
    expect(criar).toContain("request.resource.data.get('role', 'consultant') in ['admin', 'consultant']");
    expect(criar).toContain("request.resource.data.get('professorId', null) == null");
    expect(regraDe(equipe, 'delete')).toContain('isAdmin(appId)');
  });

  it('nenhum caminho do cliente faz alguém virar professor', () => {
    expect(RULES).not.toMatch(/professorRoleAllowed|professorCreateAllowed|professorAllowed/);
    expect(RULES).not.toMatch(/'professor'\s*\]/);
  });

  // O que fica aberto de propósito, pela spec ("Aulas: o professor grava como
  // os outros membros"). Pelo SDK o professor muda o status de um registro
  // para attended ou no_show, troca o professorId e cria registro, mesmo com o
  // módulo desligado, e é desse registro que sai a conversão por professor.
  // Se o Johnny decidir travar (por exemplo, o módulo ligado no create e no
  // update), este teste muda junto com a regra e com o Playground.
  it('aulas: o professor grava como os outros membros, inclusive status e desfecho, sem trava de módulo', () => {
    const aulas = blocoDe('stronix_aulas');
    expect(aulas).not.toContain('isProfessor');
    expect(aulas).not.toContain('hasModule');
    expect(regraDe(aulas, 'create').trim()).toBe('if inTenant(appId) && tenantActive(appId);');
    expect(regraDe(aulas, 'update')).toContain(
      'request.resource.data.consultantAuthUid == resource.data.consultantAuthUid;'
    );
    expect(regraDe(aulas, 'update')).not.toMatch(/status|professorId/);
  });
});
