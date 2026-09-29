import { describe, it, expect, vi, afterAll } from 'vitest';

// O cadastro pelo Stronizap roda numa função da Vercel, com o processo em UTC
// (lá o TZ é variável reservada). Como em zapFuso.test.js (PR #227), o
// processo vai para UTC antes de importar as regras, e o primeiro teste
// confere que a troca pegou.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  ZAP_LEAD_MESSAGES, LEAD_CREATE_LIMIT, refusal, invalidData, tenantBlocked, nationalDigits, whatsappFromZap,
  emailFromActor, findTeamMember, teamRole, catalogView, buildLeadOptions,
  readCreateLeadBody, checkMinor, checkCatalog, resolveOwner, sameStudentName, studentKey,
  zapSignupText, buildZapLead, buildZapSignupInteraction, alreadyRegisteredBody, scrubbedError
} from '../_zapLead.js';
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
// A máscara do Novo lead. O fixo sai dela, e não de um texto fixo aqui: a PR
// #232 corrige a máscara de 10 dígitos, e este teste vale antes e depois dela.
import { formatPhone } from '../../src/lib/masks.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

const HOJE = new Date('2026-09-29T13:00:00Z');
const DIA = 86400000;
const ts = (d) => ({ toDate: () => d });
const antes = (dias) => new Date(HOJE.getTime() - dias * DIA);

// Equipe como mora em stronix_users. O id é o do documento.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', email: 'bruno@stronix.com.br', authUid: 'auth-bruno', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };
// Convidada que nunca entrou: está na equipe, mas sem authUid.
const BIA = { id: 'u-bia', name: 'Bia Rocha', email: 'bia@stronix.com.br', role: 'consultant' };

const CATALOGOS = {
  sources: [{ id: 's1', name: 'WhatsApp' }, { id: 's2', name: 'Instagram' }, { id: 's3', name: '' }, { id: 's4', name: 'Instagram' }],
  dores: [{ id: 'd1', name: 'Postura' }, { id: 'd2', name: 'Emagrecimento' }],
  modalities: [{ id: 'm2', name: 'Pilates', order: 2 }, { id: 'm1', name: 'Musculação', order: 1 }],
  funnels: [
    { id: 'f-kids', name: 'Kids', order: 2 },
    { id: 'f-com', name: 'Comercial', order: 1, isDefault: true },
    { id: 'f-ind', name: 'Indicações', order: 97, systemKind: 'referral' },
    { id: 'f-vazio', name: 'Sem etapas', order: 3 }
  ],
  statuses: [
    { id: 'a', funnelId: 'f-com', name: 'Primeiro contato', order: 2 },
    { id: 'b', funnelId: 'f-com', name: 'Novo lead', order: 1 },
    { id: 'c', funnelId: 'f-kids', name: 'Interesse', order: 1 },
    { id: 'd', funnelId: 'f-ind', name: 'Aguardando ação', order: 1 }
  ]
};

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

describe('recusas', () => {
  it('toda recusa leva error e message; a de campo leva field', () => {
    expect(refusal(403, 'academia_bloqueada', 'x')).toEqual({ status: 403, body: { error: 'academia_bloqueada', message: 'x' } });
    expect(invalidData('name', 'y')).toEqual({ status: 400, body: { error: 'dados_invalidos', field: 'name', message: 'y' } });
  });

  it('o limite é de 60 cadastros por hora', () => {
    expect(LEAD_CREATE_LIMIT).toEqual({ limit: 60, windowMs: 3600000 });
  });

  it('o texto de quem está fora da equipe cita o e-mail', () => {
    expect(ZAP_LEAD_MESSAGES.notInTeam('bia@stronix.com.br')).toContain('bia@stronix.com.br');
  });
});

describe('tenantBlocked: a mesma conta do tenantActive de firestore.rules', () => {
  it('academia sem documento, sem status ou ativa: libera', () => {
    expect(tenantBlocked(null, HOJE)).toBe(false);
    expect(tenantBlocked({}, HOJE)).toBe(false);
    expect(tenantBlocked({ status: 'active' }, HOJE)).toBe(false);
  });

  it('suspensa: bloqueia', () => {
    expect(tenantBlocked({ status: 'suspended' }, HOJE)).toBe(true);
  });

  it('teste vencido: bloqueia, mesmo com pagamento marcado (as regras não têm essa exceção)', () => {
    const vencido = { status: 'trial', trialEndsAt: ts(antes(1)) };
    expect(tenantBlocked(vencido, HOJE)).toBe(true);
    expect(tenantBlocked({ ...vencido, paymentStatus: 'paid' }, HOJE)).toBe(true);
  });

  it('teste vigente, ou com data que não é timestamp: libera', () => {
    expect(tenantBlocked({ status: 'trial', trialEndsAt: ts(antes(-1)) }, HOJE)).toBe(false);
    expect(tenantBlocked({ status: 'trial', trialEndsAt: '2026-01-01' }, HOJE)).toBe(false);
  });

  it('mensalidade atrasada: bloqueia só depois de 3 dias', () => {
    const atraso = (dias) => ({ paymentStatus: 'overdue', paymentOverdueSince: ts(antes(dias)) });
    expect(tenantBlocked(atraso(3), HOJE)).toBe(false);
    expect(tenantBlocked(atraso(3.01), HOJE)).toBe(true);
    expect(tenantBlocked({ paymentStatus: 'overdue' }, HOJE)).toBe(false);
  });

  it('aceita o Timestamp do firebase-admin (toMillis) e Date', () => {
    expect(tenantBlocked({ status: 'trial', trialEndsAt: { toMillis: () => HOJE.getTime() - 1 } }, HOJE)).toBe(true);
    expect(tenantBlocked({ status: 'trial', trialEndsAt: new Date(HOJE.getTime() - 1) }, HOJE)).toBe(true);
  });
});

describe('telefone da conversa no formato do Novo lead', () => {
  it('tira o 55 pela regra do zapMatchKey e formata como o Novo lead', () => {
    expect(whatsappFromZap('5551998124471')).toBe('(51) 9 9812-4471');
    expect(whatsappFromZap('51998124471')).toBe('(51) 9 9812-4471');
    expect(whatsappFromZap('5555999998888')).toBe('(55) 9 9999-8888');
  });

  it('celular antigo, sem o nono dígito, ganha o 9 antes da máscara', () => {
    expect(nationalDigits('555181244710')).toBe('51981244710');
    expect(whatsappFromZap('555181244710')).toBe('(51) 9 8124-4710');
  });

  it('fixo fica com 10 dígitos, na máscara do Novo lead', () => {
    expect(nationalDigits('555133334444')).toBe('5133334444');
    expect(whatsappFromZap('555133334444')).toBe(formatPhone('5133334444'));
  });

  it('o que não é número brasileiro com DDD volta null', () => {
    expect(nationalDigits('123')).toBeNull();
    expect(nationalDigits('')).toBeNull();
    expect(nationalDigits('14155552671999')).toBeNull();
    expect(nationalDigits(5551998124471)).toBeNull();
    expect(whatsappFromZap(null)).toBeNull();
  });
});

describe('quem cadastra é achado pelo e-mail', () => {
  const EQUIPE = [
    { id: 'legado', name: 'Ana (antiga)', email: 'ana@stronix.com.br', role: 'consultant' },
    ANA,
    BIA
  ];

  it('e-mail em minúsculas e sem espaço; o que não parece e-mail volta null', () => {
    expect(emailFromActor({ email: '  ANA@Stronix.com.br ' })).toBe('ana@stronix.com.br');
    expect(emailFromActor({ email: 'ana' })).toBeNull();
    expect(emailFromActor({ email: 42 })).toBeNull();
    expect(emailFromActor(null)).toBeNull();
  });

  it('só vale quem tem authUid; com dois cadastros do mesmo e-mail, fica o que tem', () => {
    expect(findTeamMember(EQUIPE, 'ana@stronix.com.br')).toBe(ANA);
    expect(findTeamMember(EQUIPE, 'bia@stronix.com.br')).toBeNull();
    expect(findTeamMember(EQUIPE, 'carla@stronix.com.br')).toBeNull();
    expect(findTeamMember(EQUIPE, null)).toBeNull();
  });

  it('gestor é o role admin', () => {
    expect(teamRole(JOHNNY)).toBe('gestor');
    expect(teamRole(ANA)).toBe('consultor');
  });
});

describe('catalogView e buildLeadOptions', () => {
  it('nomes vazios e repetidos saem; origem e dor em ordem alfabética; o resto pela ordem configurada', () => {
    expect(catalogView(CATALOGOS)).toEqual({
      sources: ['Instagram', 'WhatsApp'],
      dores: ['Emagrecimento', 'Postura'],
      modalities: ['Musculação', 'Pilates'],
      funnels: [
        { id: 'f-com', name: 'Comercial', stages: ['Novo lead', 'Primeiro contato'], isDefault: true },
        { id: 'f-kids', name: 'Kids', stages: ['Interesse'], isDefault: false }
      ]
    });
  });

  it('catálogo ausente vira lista vazia', () => {
    expect(catalogView({})).toEqual({ sources: [], dores: [], modalities: [], funnels: [] });
  });

  it('consultor: quem é, as listas e o padrão do Novo lead, sem a equipe', () => {
    const opcoes = buildLeadOptions({ actor: ANA, team: [ANA, JOHNNY], catalogs: CATALOGOS });
    expect(opcoes).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
      sources: [{ name: 'Instagram' }, { name: 'WhatsApp' }],
      dores: [{ name: 'Emagrecimento' }, { name: 'Postura' }],
      modalities: [{ name: 'Musculação' }, { name: 'Pilates' }],
      funnels: [
        { id: 'f-com', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] },
        { id: 'f-kids', name: 'Kids', stages: [{ name: 'Interesse' }] }
      ],
      relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
      defaults: { source: 'WhatsApp', funnelId: 'f-com', stage: 'Novo lead' }
    });
    expect('team' in opcoes).toBe(false);
  });

  it('gestor: a equipe com login, só id e nome, em ordem alfabética', () => {
    const opcoes = buildLeadOptions({ actor: JOHNNY, team: [JOHNNY, BRUNO, BIA, ANA], catalogs: CATALOGOS });
    expect(opcoes.actor.role).toBe('gestor');
    expect(opcoes.team).toEqual([
      { id: 'u-ana', name: 'Ana Souza' },
      { id: 'u-bruno', name: 'Bruno Lima' },
      { id: 'u-johnny', name: 'Johnny' }
    ]);
    expect(JSON.stringify(opcoes)).not.toContain('@');
  });

  it('sem origem com "whats", o padrão é a primeira em ordem alfabética; sem nada, null', () => {
    const semWhats = { ...CATALOGOS, sources: [{ id: 'x', name: 'Site' }, { id: 'y', name: 'Instagram' }] };
    expect(buildLeadOptions({ actor: ANA, catalogs: semWhats }).defaults.source).toBe('Instagram');
    expect(buildLeadOptions({ actor: ANA, catalogs: {} }).defaults).toEqual({ source: null, funnelId: null, stage: null });
  });

  it('sem funil marcado como padrão, vale o primeiro pela ordem', () => {
    const semPadrao = { ...CATALOGOS, funnels: CATALOGOS.funnels.map((f) => ({ ...f, isDefault: false })) };
    expect(buildLeadOptions({ actor: ANA, catalogs: semPadrao }).defaults).toMatchObject({ funnelId: 'f-com', stage: 'Novo lead' });
  });
});

describe('readCreateLeadBody: só o formato do pedido', () => {
  const corpo = (lead = {}, extra = {}) => ({
    phone: '5551998124471',
    actor: { email: ' Ana@Stronix.com.br ', name: ' Ana ' },
    channelName: ' Recepção ',
    lead: {
      name: '  Mariana Souza ', source: 'WhatsApp', dor: 'Postura', modalidade: null,
      funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null, ...lead
    },
    ...extra
  });

  it('pedido certo: telefone com a chave, e-mail em minúsculas, nome aparado e catálogo como veio', () => {
    expect(readCreateLeadBody(corpo())).toEqual({
      value: {
        phone: '51998124471',
        matchKey: '5198124471',
        email: 'ana@stronix.com.br',
        actorName: 'Ana',
        channelName: 'Recepção',
        lead: {
          name: 'Mariana Souza', source: 'WhatsApp', dor: 'Postura', modalidade: null,
          funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null
        }
      }
    });
  });

  it('número antigo: o telefone sai com o nono dígito, e a chave é a mesma', () => {
    const { value } = readCreateLeadBody(corpo({}, { phone: '555181244710' }));
    expect(value.phone).toBe('51981244710');
    expect(value.matchKey).toBe('5181244710');
  });

  it('menor: o bloco aparado, com parentesco e WhatsApp do aluno opcionais', () => {
    const { value } = readCreateLeadBody(corpo({ minor: { guardianName: ' Maria ', relationship: '', studentWhatsapp: ' ' } }));
    expect(value.lead.minor).toEqual({ guardianName: 'Maria', relationship: null, studentWhatsapp: null });
  });

  it('modalidade em branco vira null, e minor falso é adulto', () => {
    const { value } = readCreateLeadBody(corpo({ modalidade: '  ', minor: false }));
    expect(value.lead.modalidade).toBeNull();
    expect(value.lead.minor).toBeNull();
  });

  it.each([
    ['phone', { phone: '123' }],
    ['phone', { phone: 5551998124471 }],
    ['actor', { actor: { name: 'Ana' } }],
    ['actor', { actor: null }],
    ['channelName', { channelName: 42 }],
    ['lead', { lead: 'Mariana' }],
    ['lead', { lead: null }]
  ])('formato errado em %s é dados_invalidos no campo', (field, extra) => {
    expect(readCreateLeadBody(corpo({}, extra)).refusal).toEqual(invalidData(field, expect.any(String)));
  });

  it.each([
    ['name', { name: ' A ' }, ZAP_LEAD_MESSAGES.nameShort],
    ['name', { name: 'x'.repeat(121) }, ZAP_LEAD_MESSAGES.nameLong],
    ['source', { source: 1 }, ZAP_LEAD_MESSAGES.wrongType],
    ['ownerId', { ownerId: {} }, ZAP_LEAD_MESSAGES.wrongType],
    ['minor', { minor: 'sim' }, ZAP_LEAD_MESSAGES.minor],
    ['studentWhatsapp', { minor: { guardianName: 'Maria', studentWhatsapp: 51999 } }, ZAP_LEAD_MESSAGES.wrongType]
  ])('campo do lead errado (%s) é recusado com a mensagem certa', (field, lead, message) => {
    expect(readCreateLeadBody(corpo(lead)).refusal).toEqual(invalidData(field, message));
  });
});

describe('checkMinor: as regras do guardian.js e do sameContactPhone', () => {
  const FONE = '5511912345678';
  const menor = (extra = {}) => ({ guardianName: 'Maria Souza', relationship: 'Mãe', studentWhatsapp: null, ...extra });

  it('adulto não tem o que conferir; menor certo passa', () => {
    expect(checkMinor({ minor: null, phone: FONE })).toBeNull();
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 9 5555-4444' }), phone: FONE })).toBeNull();
  });

  it('responsável sem nome', () => {
    expect(checkMinor({ minor: menor({ guardianName: 'M' }), phone: FONE }))
      .toEqual(refusal(422, 'menor_invalido', 'Informe o nome do responsável.', { field: 'guardianName' }));
  });

  it('parentesco fora da lista do Stronilead', () => {
    expect(checkMinor({ minor: menor({ relationship: 'Madrasta' }), phone: FONE }))
      .toEqual(refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.relationship, { field: 'relationship' }));
  });

  it('WhatsApp do aluno incompleto', () => {
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 9 123' }), phone: FONE }))
      .toEqual(refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIncomplete, { field: 'studentWhatsapp' }));
  });

  it('WhatsApp do aluno igual ao da conversa, com ou sem o nono dígito', () => {
    const recusa = refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIsGuardian, { field: 'studentWhatsapp' });
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 9 1234-5678' }), phone: FONE })).toEqual(recusa);
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 1234-5678' }), phone: FONE })).toEqual(recusa);
  });
});

describe('checkCatalog: o que existe no Stronilead na hora do cadastro', () => {
  const lead = (extra = {}) => ({
    name: 'Mariana', source: 'WhatsApp', dor: 'Postura', modalidade: 'Pilates', funnelId: 'f-com', stage: 'Novo lead', ...extra
  });

  it('tudo no catálogo: null; modalidade é opcional', () => {
    expect(checkCatalog(lead(), CATALOGOS)).toBeNull();
    expect(checkCatalog(lead({ modalidade: null }), CATALOGOS)).toBeNull();
  });

  it('academia sem dor: sem_dor_cadastrada antes de qualquer campo', () => {
    expect(checkCatalog(lead({ source: '' }), { ...CATALOGOS, dores: [] }))
      .toEqual(refusal(422, 'sem_dor_cadastrada', ZAP_LEAD_MESSAGES.noDor));
  });

  it.each([
    ['source', 'Escolha a origem.'],
    ['dor', 'Escolha a dor ou necessidade.'],
    ['funnelId', 'Escolha o funil.'],
    ['stage', 'Escolha a etapa.']
  ])('%s em branco é campo a preencher', (field, message) => {
    expect(checkCatalog(lead({ [field]: ' ' }), CATALOGOS)).toEqual(invalidData(field, message));
  });

  it.each([
    ['source', { source: 'Facebook' }],
    ['dor', { dor: 'Ansiedade' }],
    ['modalidade', { modalidade: 'Crossfit' }],
    ['funnelId', { funnelId: 'f-ind' }],
    ['funnelId', { funnelId: 'f-vazio' }],
    ['stage', { stage: 'Interesse' }]
  ])('%s que sumiu, ou que não serve para lead novo, é catalogo_mudou', (field, extra) => {
    expect(checkCatalog(lead(extra), CATALOGOS))
      .toEqual(refusal(422, 'catalogo_mudou', ZAP_LEAD_MESSAGES.gone[field], { field }));
  });

  it('o nome vale como está gravado: com espaço a mais é outro item', () => {
    expect(checkCatalog(lead({ source: 'WhatsApp ' }), CATALOGOS))
      .toEqual(refusal(422, 'catalogo_mudou', ZAP_LEAD_MESSAGES.gone.source, { field: 'source' }));
  });
});

describe('resolveOwner: o dono do lead', () => {
  const EQUIPE = [ANA, BRUNO, JOHNNY, BIA];

  it('sem escolha, ou escolhendo a si mesmo: quem cadastra', () => {
    expect(resolveOwner({ actor: ANA, ownerId: null, team: EQUIPE })).toEqual({ owner: ANA });
    expect(resolveOwner({ actor: ANA, ownerId: 'u-ana', team: EQUIPE })).toEqual({ owner: ANA });
  });

  it('consultor não passa o lead para outra pessoa', () => {
    expect(resolveOwner({ actor: ANA, ownerId: 'u-bruno', team: EQUIPE }))
      .toEqual({ refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.onlyManagerPicks) });
  });

  it('gestor escolhe alguém da equipe com login', () => {
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-bruno', team: EQUIPE })).toEqual({ owner: BRUNO });
  });

  it('quem saiu da equipe, ou nunca entrou, não pode ser dono', () => {
    const recusa = { refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.ownerGone) };
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-saiu', team: EQUIPE })).toEqual(recusa);
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-bia', team: EQUIPE })).toEqual(recusa);
  });
});

describe('mesmo aluno e chave do WhatsApp do aluno', () => {
  it('mesmo nome sem acento, sem caixa e sem espaço a mais', () => {
    expect(sameStudentName('Pedro Souza', '  pedro   SOUZA ')).toBe(true);
    expect(sameStudentName('Pédro Souza', 'Pedro Souza')).toBe(true);
    expect(sameStudentName('Pedro Souza', 'Ana Souza')).toBe(false);
    expect(sameStudentName('', '')).toBe(false);
  });

  it('studentKey: a chave do Zap do WhatsApp do aluno, ou null', () => {
    expect(studentKey({ studentWhatsapp: '(11) 9 5555-4444' })).toBe('1155554444');
    expect(studentKey({ studentWhatsapp: '(11) 8555-4444' })).toBe('1185554444');
    expect(studentKey({ studentWhatsapp: null })).toBeNull();
    expect(studentKey(null)).toBeNull();
  });
});

describe('zapSignupText: o texto que qualquer tela entende', () => {
  it('com consultor responsável e canal', () => {
    expect(zapSignupText({ actorName: 'Johnny', ownerName: 'Ana Souza', channelName: 'Recepção' }))
      .toBe('Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.');
  });

  it('quem cadastrou ficou com o lead: sem a parte do consultor responsável', () => {
    expect(zapSignupText({ actorName: 'Ana Souza', channelName: 'Recepção' }))
      .toBe('Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.');
  });

  it('sem canal e sem nome', () => {
    expect(zapSignupText({ actorName: null })).toBe('Cadastrado pelo Stronizap.');
  });
});

describe('buildZapLead: o montador do Novo lead mais as diferenças da ponte', () => {
  const HORA = { horaDoServidor: true };
  const LEAD = {
    name: 'Mariana Souza', source: 'WhatsApp', dor: 'Postura', modalidade: 'Pilates',
    funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null
  };

  it('adulto: o número da conversa no formato do Novo lead e o marco já contado', () => {
    expect(buildZapLead({ lead: LEAD, phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA })).toEqual({
      ...buildNewLeadDoc(
        { name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', source: 'WhatsApp', funnelId: 'f-com', status: 'Novo lead', dor: 'Postura', modalidade: 'Pilates' },
        { owner: ANA }
      ),
      createdAt: HORA,
      statusEnteredAt: HORA,
      lastInteractionAt: HORA,
      interactionsCount: 1
    });
  });

  it('dono escolhido pelo gestor: o aviso de troca que acende o sino', () => {
    expect(buildZapLead({ lead: LEAD, phone: '5551998124471', actor: JOHNNY, owner: BRUNO, serverTime: HORA })).toMatchObject({
      consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno',
      consultantChangedAt: HORA, consultantChangedByName: 'Johnny', consultantChangedByAuthUid: 'auth-johnny'
    });
  });

  it('quem cadastrou ficou com o lead: sem aviso de troca', () => {
    const doc = buildZapLead({ lead: LEAD, phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA });
    expect('consultantChangedAt' in doc).toBe(false);
  });

  it('menor: o número da conversa vira o telefone do responsável', () => {
    const doc = buildZapLead({
      lead: { ...LEAD, name: 'Pedro Souza', minor: { guardianName: 'Mariana Souza', relationship: 'Mãe', studentWhatsapp: null } },
      phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA
    });
    expect(doc).toMatchObject({
      name: 'Pedro Souza', whatsapp: '', zapMatchKey: null, isMinor: true,
      guardian: { name: 'Mariana Souza', phone: '(51) 9 9812-4471', relationship: 'Mãe' },
      guardianZapMatchKey: '5198124471'
    });
  });

  it('número antigo, sem o nono dígito: o lead e o responsável ganham o 9', () => {
    expect(buildZapLead({ lead: LEAD, phone: '555181244710', actor: ANA, owner: ANA, serverTime: HORA }))
      .toMatchObject({ whatsapp: '(51) 9 8124-4710', whatsappDigits: '51981244710', zapMatchKey: '5181244710' });
    const menor = buildZapLead({
      lead: { ...LEAD, name: 'Pedro Souza', minor: { guardianName: 'Mariana Souza', relationship: null, studentWhatsapp: '(51) 8555-4444' } },
      phone: '555181244710', actor: ANA, owner: ANA, serverTime: HORA
    });
    expect(menor.guardian.phone).toBe('(51) 9 8124-4710');
    expect(menor.guardianZapMatchKey).toBe('5181244710');
    expect(menor.whatsapp).toBe('(51) 9 8555-4444');
  });

  it('menor com WhatsApp próprio: o número do aluno vai para o lead', () => {
    const doc = buildZapLead({
      lead: { ...LEAD, name: 'Pedro Souza', minor: { guardianName: 'Mariana Souza', relationship: null, studentWhatsapp: '11955554444' } },
      phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA
    });
    expect(doc).toMatchObject({ whatsapp: '(11) 9 5555-4444', zapMatchKey: '1155554444', guardian: { relationship: null } });
  });
});

describe('buildZapSignupInteraction: o marco de início', () => {
  const HORA = { horaDoServidor: true };

  it('quem cadastrou ficou com o lead', () => {
    expect(buildZapSignupInteraction({ leadId: 'L1', leadName: 'Mariana Souza', actor: ANA, owner: ANA, channelName: 'Recepção', serverTime: HORA })).toEqual({
      leadId: 'L1',
      leadName: 'Mariana Souza',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      type: 'zap_signup',
      text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.',
      zapChannelName: 'Recepção',
      createdAt: HORA
    });
  });

  it('gestor passou para outra pessoa: o dono nos campos de segurança e no ownerName', () => {
    const marco = buildZapSignupInteraction({ leadId: 'L1', leadName: 'Mariana Souza', actor: JOHNNY, owner: BRUNO, channelName: null, serverTime: HORA });
    expect(marco).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny',
      leadConsultantId: 'u-bruno', leadConsultantAuthUid: 'auth-bruno', ownerName: 'Bruno Lima',
      zapChannelName: null, text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Bruno Lima.'
    });
    expect('volumeKind' in marco).toBe(false);
  });
});

describe('alreadyRegisteredBody: a resposta 409', () => {
  const CARD = { found: true, leadId: 'x' };
  const cincoMinutos = new Date(HOJE.getTime() - 5 * 60000);

  it('cadastro antigo', () => {
    expect(alreadyRegisteredBody({ repeated: { name: 'Mariana', consultantName: 'Bruno Lima', createdAt: antes(2) }, card: CARD, now: HOJE })).toEqual({
      error: 'ja_cadastrado', card: CARD, createdAt: antes(2).toISOString(), message: 'Esse número já estava no Stronilead.'
    });
  });

  it('menos de 10 minutos: diz quem cuida, quando tem dono', () => {
    expect(alreadyRegisteredBody({ repeated: { consultantName: 'Bruno Lima', createdAt: ts(cincoMinutos) }, card: CARD, now: HOJE }).message)
      .toBe('Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.');
    expect(alreadyRegisteredBody({ repeated: { createdAt: cincoMinutos }, card: CARD, now: HOJE }).message)
      .toBe('Esse número foi cadastrado há pouco.');
  });

  it('menor: fala do aluno com esse responsável', () => {
    expect(alreadyRegisteredBody({ repeated: { name: 'Pedro Souza', consultantName: 'Bruno Lima', createdAt: cincoMinutos }, card: CARD, minor: true, now: HOJE }).message)
      .toBe('O cadastro de Pedro Souza com esse responsável foi feito há pouco. Quem cuida é Bruno Lima.');
    expect(alreadyRegisteredBody({ repeated: { name: 'Pedro Souza', createdAt: antes(30) }, card: CARD, minor: true, now: HOJE }).message)
      .toBe('Pedro Souza já tem cadastro no Stronilead com esse responsável.');
  });

  it('sem data de cadastro: createdAt null e o texto de cadastro antigo', () => {
    expect(alreadyRegisteredBody({ repeated: {}, card: CARD, now: HOJE }))
      .toMatchObject({ createdAt: null, message: 'Esse número já estava no Stronilead.' });
  });
});

describe('scrubbedError: erro inesperado sem dado pessoal', () => {
  it('troca a mensagem pelo código e guarda a pilha', () => {
    const original = Object.assign(new Error('9 FAILED_PRECONDITION: zapMatchKey == 5198124471'), { code: 9 });
    const limpo = scrubbedError('create-lead', original);
    expect(limpo.message).toBe('zap create-lead falhou (9)');
    expect(limpo.stack).not.toContain('5198124471');
    expect(limpo.stack).toMatch(/\n\s+at /);
  });

  it('erro sem código leva o nome do erro', () => {
    expect(scrubbedError('lead-options', new TypeError('x is not a function')).message)
      .toBe('zap lead-options falhou (TypeError)');
  });
});

describe('textos da tela', () => {
  it('nenhum texto tem travessão', () => {
    const textos = [];
    const coletar = (v) => {
      if (typeof v === 'string') textos.push(v);
      else if (typeof v === 'function') textos.push(v('pessoa@exemplo.com'));
      else if (v && typeof v === 'object') Object.values(v).forEach(coletar);
    };
    coletar(ZAP_LEAD_MESSAGES);
    expect(textos.length).toBeGreaterThan(20);
    expect(textos.filter((t) => t.includes('—'))).toEqual([]);
  });
});
