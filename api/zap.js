// Ponte com o Stronizap. O Zap pergunta quem é a pessoa por trás de um
// telefone e recebe o cartão de contexto. Desde o cadastro pelo Stronizap, ele
// também pede as listas do formulário (lead-options) e cadastra o lead de
// dentro da conversa (create-lead).
//
// O GET procura também os menores que têm aquele telefone como responsável
// (`guardianZapMatchKey`), e o `match` conta o número do responsável como
// cadastro enquanto ele é o contato do menor.
//
// Autenticação por chave emitida no Stronilead (Configurações → Integrações),
// guardada aqui só como hash em tenants/{id}.integrations.zap.keyHash.
//
// O POST tem dois donos. `generate` e `revoke` são do admin da academia, logado
// no CRM, e autenticam por verifyRequest (ID token). `match`, `lead-options` e
// `create-lead` são do próprio Stronizap e autenticam pela chave, igual ao GET.
// O desvio fica no começo de handlePost, e os dois caminhos nunca se misturam.
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { withSentry } from './_sentry.js';
import { isTenantAdmin } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';
import { generateZapKey, verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard, buildGuardianCard, buildZapWards } from './_zapCard.js';
import {
  LEAD_CREATE_LIMIT, ZAP_LEAD_MESSAGES, refusal, invalidData, tenantBlocked, emailFromActor, findTeamMember,
  buildLeadOptions, readCreateLeadBody, checkMinor, checkCatalog, resolveOwner, sameStudentName, studentKey,
  buildZapLead, buildZapSignupInteraction, buildRegistrationNote, alreadyRegisteredBody, scrubbedError
} from './_zapLead.js';
import {
  SCHEDULE_LIMIT, ZAP_SCHEDULE_MESSAGES, unitsView, readScheduleOptionsBody, buildScheduleOptions, isDocId,
  readScheduleBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  isOpenAulaRecord, pickOpenVisitaId, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
} from './_zapSchedule.js';
import { contactOf } from '../src/lib/guardian.js';

const LEADS_PATH = 'stronix_leads';
// Config geral da academia (mesmo doc que PaceSection.jsx grava em
// Configurações → Metas & ritmo). Não importar src/lib/firebase.js aqui pelo
// mesmo motivo do zapStrip com dailyGoal.js: aquele módulo inicializa o SDK
// CLIENTE do Firebase (App Check, IndexedDB) e quebra em runtime de servidor.
const CONFIG_PATH = 'stronix_config';
const CONFIG_GENERAL_ID = 'general';
const USERS_PATH = 'stronix_users';
const INTERACTIONS_PATH = 'stronix_interactions';
// Listas e registro do agendamento pelo Stronizap.
const UNITS_PATH = 'stronix_units';
const MODALITIES_PATH = 'stronix_modalities';
const PROFESSORS_PATH = 'stronix_professores';
const AULAS_PATH = 'stronix_aulas';
// Catálogos do formulário do cadastro, na ordem em que readCatalogs devolve.
const CATALOG_PATHS = ['stronix_sources', 'stronix_dores', 'stronix_modalities', 'stronix_funnels', 'stronix_statuses'];

const MATCH_MAX = 30; // teto do operador `in` do Firestore

// Menores por responsável lidos por consulta. Irmãos de verdade passam longe
// disso; o teto só impede um número muito compartilhado de pesar a rota.
const WARDS_MAX = 10;

// Menores lidos por responsável na conferência de duplicado do cadastro. Só
// um teto contra número compartilhado demais: irmãos passam longe disso.
const MINORS_SCAN_MAX = 100;

// Campos de data que os módulos puros esperam como Date. O Firestore devolve
// Timestamp.
const DATE_FIELDS = [
  'currentContractStartsAt', 'currentContractEndsAt',
  'appointmentScheduledFor', 'nextFollowUp', 'lastInteractionAt',
  'birthDate', 'createdAt'
];

const leadDoDoc = (doc) => {
  const lead = { id: doc.id, ...doc.data() };
  for (const campo of DATE_FIELDS) {
    if (lead[campo]?.toDate) lead[campo] = lead[campo].toDate();
  }
  return lead;
};

// Mesmo formato de identificador que tenant-resolve.js aceita. Validar antes de
// ir ao Firestore impede que "a/b" vire caminho aninhado e que um objeto no
// lugar do texto derrube a função antes da autenticação.
const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Coleção da academia em artifacts/{academia}/public/data/{nome}.
const academyCollection = (tenantId, nome) =>
  adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(nome);

const leadsCollection = (tenantId) => academyCollection(tenantId, LEADS_PATH);

// A academia e a integração dela, ou null quando a academia não existe, nunca
// gerou chave (sem keyHash) ou teve a chave revogada. O cadastro pelo Stronizap
// precisa do documento inteiro para conferir se a academia está ativa.
async function loadZapTenant(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  const tenant = tenantSnap.exists ? tenantSnap.data() : null;
  const zap = tenant?.integrations?.zap;
  if (!zap?.keyHash || zap.revokedAt) return null;
  return { tenant, zap };
}

// Integração do tenant, ou null quando o tenant não existe, nunca gerou chave
// (sem keyHash) ou teve a chave revogada.
async function loadZapIntegration(tenantId) {
  return (await loadZapTenant(tenantId))?.zap ?? null;
}

// O dono do número e os menores que o têm como responsável, juntos: a mesma
// seleção serve o cartão e o "Para quem?" do agendamento pelo Stronizap. A
// busca dos menores não pode derrubar o dono: se ela falhar (índice desligado
// no console, por exemplo), sai só o dono. O log leva só o código do erro: a
// mensagem do Firestore pode trazer o valor da consulta, que é o telefone.
async function numberPeople(tenantId, matchKey, agora) {
  const [achados, menoresSnap] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get(),
    leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(WARDS_MAX).get()
      .catch((e) => {
        console.error('zap: busca dos menores falhou', e?.code ?? 'sem código');
        return null;
      })
  ]);
  const menoresDocs = menoresSnap ? menoresSnap.docs : [];
  const dono = achados.empty ? null : leadDoDoc(achados.docs[0]);
  // Só quem ainda tem o responsável como contato (menor, ou que fez 18 sem
  // WhatsApp próprio), e nunca o próprio dono do número.
  const menores = menoresDocs
    .map(leadDoDoc)
    .filter((m) => m.id !== dono?.id && contactOf(m, agora).viaGuardian);
  return { dono, menores };
}

// O cartão que o GET devolve para esta chave de telefone: o dono do número e
// os menores que o têm como responsável, ou { found: false } quando ninguém
// casa. O cadastro e o agendamento pelo Stronizap respondem com este mesmo
// cartão.
async function cardFor(tenantId, matchKey) {
  const agora = new Date();
  const { dono, menores } = await numberPeople(tenantId, matchKey, agora);
  if (!dono && menores.length === 0) return { found: false };

  // Marcos de renovação da academia. Só lê depois de achar alguém: em
  // 'found: false' não há faixa pra montar, então não vale o custo da
  // consulta. Doc inexistente (academia nunca abriu Configurações → Metas &
  // ritmo) ou campo ausente/malformado: buildZapCard/buildZapStrip caem no
  // padrão 90/60/30 sozinhos, não precisa validar aqui.
  const configSnap = await academyCollection(tenantId, CONFIG_PATH).doc(CONFIG_GENERAL_ID).get();
  const renewalCheckpoints = configSnap.exists ? configSnap.data()?.renewalCheckpoints : undefined;

  if (!dono) return buildGuardianCard(menores, agora, renewalCheckpoints);
  const card = buildZapCard(dono, agora, renewalCheckpoints);
  if (menores.length > 0) card.wards = buildZapWards(menores, agora, renewalCheckpoints);
  return card;
}

export default withSentry(async function handler(req, res) {
  if (req.method === 'POST') return handlePost(req, res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const chave = req.headers['x-stronizap-key'];
  const tenantId = req.query.tenant;
  const matchKey = zapMatchKey(req.query.phone);

  if (!chave || !tenantId) {
    res.status(401).json({ error: 'Credencial ausente' });
    return;
  }
  // Mesmo formato do match. Fora dele responde igual a chave errada, e nunca
  // chega ao Firestore: "a/b" viraria caminho aninhado e lançaria erro antes
  // da autenticação.
  if (typeof tenantId !== 'string' || !TENANT_RE.test(tenantId)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }
  if (!matchKey) {
    res.status(400).json({ error: 'Telefone inválido' });
    return;
  }

  // Tenant inexistente responde igual a chave errada: não confirmamos quais
  // academias existem para quem não tem credencial.
  const zap = await loadZapIntegration(tenantId);
  if (!zap || !verifyZapKey(chave, zap.keyHash)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }

  const card = await cardFor(tenantId, matchKey);
  if (!card.found) {
    res.status(200).json({ found: false });
    return;
  }

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(card);
});

// Gera e revoga a chave de conexão do Stronizap (ação do admin da academia, pela
// tela de Configurações → Integrações) e atende as ações do próprio Stronizap,
// autenticadas pela chave: o match em lote, as opções e o cadastro de lead.
// Ver o desvio logo abaixo.
async function handlePost(req, res) {
  // match, lead-options e create-lead são do próprio Stronizap e autenticam
  // pela chave do Zap. generate e revoke são do admin logado e seguem exigindo
  // ID token. Ação desconhecida cai no caminho do login e é recusada lá.
  const action = req.body?.action;
  if (action === 'match') return handleMatch(req, res);
  if (action === 'lead-options') return handleLeadOptions(req, res);
  if (action === 'create-lead') return handleCreateLead(req, res);
  if (action === 'schedule-options') return handleScheduleOptions(req, res);
  if (action === 'schedule') return handleSchedule(req, res);

  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Só o admin da academia pode alterar a integração' });
    }

    const tenantRef = adminDb.collection('tenants').doc(auth.tenantId);

    if (action === 'generate') {
      const { key, keyPrefix, keyHash } = generateZapKey();
      await tenantRef.set({
        integrations: {
          zap: {
            keyHash,
            keyPrefix,
            revokedAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.uid
          }
        }
      }, { merge: true });
      // Única vez que a chave em claro sai do servidor: quem perder isto tem
      // que gerar outra.
      return res.status(200).json({ key, keyPrefix });
    }

    if (action === 'revoke') {
      await tenantRef.set({
        integrations: {
          zap: { revokedAt: admin.firestore.FieldValue.serverTimestamp() }
        }
      }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error) {
    console.error('zap POST', error);
    return res.status(500).json({ error: 'Erro interno ao alterar a integração.' });
  }
}

// Diz quais dos telefones recebidos têm cadastro nesta academia. Devolve os
// telefones NA FORMA EM QUE CHEGARAM, para o Stronizap não precisar recalcular
// a chave de casamento. Nada além disso sai daqui: nem nome, nem id, nem plano.
async function handleMatch(req, res) {
  const chave = req.headers['x-stronizap-key'];
  const tenantId = req.body?.tenant;
  const phones = req.body?.phones;

  if (!chave || !tenantId) {
    return res.status(401).json({ error: 'Credencial ausente' });
  }
  // Identificador fora do formato responde igual a chave errada: não dá pista
  // de quais academias existem.
  if (typeof tenantId !== 'string' || !TENANT_RE.test(tenantId)) {
    return res.status(401).json({ error: 'Credencial inválida' });
  }
  if (!Array.isArray(phones)) {
    return res.status(400).json({ error: 'Envie a lista de telefones em phones.' });
  }
  if (phones.length > MATCH_MAX) {
    return res.status(400).json({ error: `No máximo ${MATCH_MAX} telefones por chamada.` });
  }

  const zap = await loadZapIntegration(tenantId);
  if (!zap || !verifyZapKey(chave, zap.keyHash)) {
    return res.status(401).json({ error: 'Credencial inválida' });
  }

  // Telefone que não vira chave válida (menos de 10 dígitos) fica fora da
  // consulta e volta como não encontrado, sem derrubar o lote. Dois telefones
  // podem cair na mesma chave (com e sem o nono dígito), e os dois voltam.
  const porMatchKey = new Map();
  for (const phone of phones) {
    if (typeof phone !== 'string') continue;
    const matchKey = zapMatchKey(phone);
    if (!matchKey) continue;
    const lista = porMatchKey.get(matchKey) || [];
    lista.push(phone);
    porMatchKey.set(matchKey, lista);
  }
  if (porMatchKey.size === 0) {
    return res.status(200).json({ found: [] });
  }

  // A busca dos responsáveis não pode derrubar o lote inteiro: se ela falhar
  // (índice desligado no console, por exemplo), o match segue só com os donos.
  // O log leva só o código do erro, nunca telefone nem mensagem do Firestore.
  const chaves = [...porMatchKey.keys()];
  const [snap, snapMenores] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', 'in', chaves).select('zapMatchKey').get(),
    leadsCollection(tenantId)
      .where('guardianZapMatchKey', 'in', chaves)
      .select('guardianZapMatchKey', 'isMinor', 'guardian', 'birthDate', 'whatsapp')
      .get()
      .catch((e) => {
        console.error('zap: busca dos responsáveis no match falhou', e?.code ?? 'sem código');
        return null;
      })
  ]);
  const found = new Set();
  for (const doc of snap.docs) {
    for (const phone of porMatchKey.get(doc.data()?.zapMatchKey) || []) found.add(phone);
  }
  // Responsável conta como cadastro enquanto é o contato do menor.
  const agora = new Date();
  for (const doc of snapMenores ? snapMenores.docs : []) {
    const menor = leadDoDoc(doc);
    if (!contactOf(menor, agora).viaGuardian) continue;
    for (const phone of porMatchKey.get(menor.guardianZapMatchKey) || []) found.add(phone);
  }
  return res.status(200).json({ found: [...found] });
}

// ---------------------------------------------------------------------------
// Cadastro de lead pelo Stronizap. As regras moram em api/_zapLead.js; aqui
// ficam a leitura e a gravação. Spec em
// docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md
// ---------------------------------------------------------------------------

const responder = (res, { status, body }) => res.status(status).json(body);

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Autenticação das ações do Stronizap no POST: identificador no formato da
// casa, chave da academia e academia ativa. Devolve { tenantId } ou
// { refusal }. Academia inexistente responde igual a chave errada, como no GET.
async function openByKey(req) {
  const chave = req.headers['x-stronizap-key'];
  const tenantId = req.body?.tenant;
  if (!chave || !tenantId) return { refusal: { status: 401, body: { error: 'Credencial ausente' } } };
  if (typeof tenantId !== 'string' || !TENANT_RE.test(tenantId)) {
    return { refusal: { status: 401, body: { error: 'Credencial inválida' } } };
  }
  const loaded = await loadZapTenant(tenantId);
  if (!loaded || !verifyZapKey(chave, loaded.zap.keyHash)) {
    return { refusal: { status: 401, body: { error: 'Credencial inválida' } } };
  }
  // O firebase-admin passa por cima das regras do Firestore, então a conta do
  // tenantActive (firestore.rules) é refeita aqui. Vale também para as
  // opções: o formulário nem abre.
  if (tenantBlocked(loaded.tenant, new Date())) {
    return { refusal: refusal(403, 'academia_bloqueada', ZAP_LEAD_MESSAGES.blocked) };
  }
  return { tenantId };
}

// A equipe inteira da academia: quem cadastra (pelo e-mail), o dono que o
// gestor escolhe e a lista de Consultor responsável. Equipe cabe numa leitura.
async function readTeam(tenantId) {
  return docsOf(await academyCollection(tenantId, USERS_PATH).get());
}

// Os catálogos do formulário, lidos a cada pedido: item novo no Stronilead
// aparece na próxima abertura, e item apagado é recusado no cadastro.
async function readCatalogs(tenantId) {
  const [sources, dores, modalities, funnels, statuses] = await Promise.all(
    CATALOG_PATHS.map((nome) => academyCollection(tenantId, nome).get())
  );
  return {
    sources: docsOf(sources),
    dores: docsOf(dores),
    modalities: docsOf(modalities),
    funnels: docsOf(funnels),
    statuses: docsOf(statuses)
  };
}

// Opções do formulário: quem pede (achado pelo e-mail da sessão do Stronizap)
// e as listas da academia. Só lê.
async function handleLeadOptions(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);

    const email = emailFromActor(req.body?.actor);
    if (!email) return responder(res, invalidData('actor', ZAP_LEAD_MESSAGES.actor));

    const [team, catalogs] = await Promise.all([readTeam(access.tenantId), readCatalogs(access.tenantId)]);
    const actor = findTeamMember(team, email);
    if (!actor) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));

    return res.status(200).json(buildLeadOptions({ actor, team, catalogs }));
  } catch (e) {
    throw scrubbedError('lead-options', e);
  }
}

// Cadastro do lead de dentro da conversa. Só cadastra quem está na equipe, com
// as regras do Stronilead, e responde 201 com o mesmo cartão que o GET devolve
// para o número.
async function handleCreateLead(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readCreateLeadBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { phone, matchKey, email, actorName, channelName, lead } = read.value;

    const limit = await checkRateLimit(`zap-create-lead:${tenantId}`, LEAD_CREATE_LIMIT);
    if (!limit.ok) return responder(res, refusal(429, 'limite', ZAP_LEAD_MESSAGES.rateLimited));

    const [team, catalogs] = await Promise.all([readTeam(tenantId), readCatalogs(tenantId)]);
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
    // O nome do autor é o do Stronilead, como em toda interação do app. O que
    // o Stronizap manda só entra se o cadastro da equipe não tiver nome.
    const actor = { ...member, name: member.name || actorName };

    const problem = checkMinor({ minor: lead.minor, phone }) || checkCatalog(lead, catalogs);
    if (problem) return responder(res, problem);
    const ownership = resolveOwner({ actor, ownerId: lead.ownerId, team });
    if (ownership.refusal) return responder(res, ownership.refusal);

    const serverTime = admin.firestore.FieldValue.serverTimestamp();
    const leadRef = leadsCollection(tenantId).doc();
    const markRef = academyCollection(tenantId, INTERACTIONS_PATH).doc();
    const newLead = buildZapLead({ lead, phone, actor, owner: ownership.owner, serverTime });
    const mark = buildZapSignupInteraction({
      leadId: leadRef.id, leadName: newLead.name, actor, owner: ownership.owner, channelName, serverTime
    });
    // A observação do cadastro, como no Novo lead, na mesma gravação: ou entra
    // tudo, ou nada, e o "Tentar de novo" não deixa lead sem a nota.
    const noteRef = lead.observacao ? academyCollection(tenantId, INTERACTIONS_PATH).doc() : null;
    const note = noteRef
      ? buildRegistrationNote({
          leadId: leadRef.id, leadName: newLead.name, actor, owner: ownership.owner, observacao: lead.observacao, serverTime
        })
      : null;
    const studentMatch = studentKey(lead.minor);

    // Conferência de duplicado e gravação na MESMA transação: dois cliques,
    // duas pessoas ou o "Tentar de novo" depois de uma resposta perdida caem
    // num lead só.
    const outcome = await adminDb.runTransaction(async (tx) => {
      if (!lead.minor) {
        const owners = await tx.get(leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1));
        if (!owners.empty) return { repeated: leadDoDoc(owners.docs[0]) };
      } else {
        // O telefone do responsável não barra: irmãos dividem o número. Barra
        // o mesmo aluno com o mesmo responsável.
        const wards = await tx.get(
          leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(MINORS_SCAN_MAX)
        );
        const same = wards.docs.map(leadDoDoc).find((m) => sameStudentName(m.name, lead.name));
        if (same) return { repeated: same };
        if (studentMatch) {
          const student = await tx.get(leadsCollection(tenantId).where('zapMatchKey', '==', studentMatch).limit(1));
          if (!student.empty) return { studentTaken: true };
        }
      }
      tx.create(leadRef, newLead);
      tx.create(markRef, mark);
      if (noteRef) tx.create(noteRef, note);
      return { created: true };
    });

    if (outcome.studentTaken) {
      return responder(res, refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentTaken, { field: 'studentWhatsapp' }));
    }
    const card = await cardFor(tenantId, matchKey);
    if (outcome.repeated) {
      return res.status(409).json(alreadyRegisteredBody({ repeated: outcome.repeated, card, minor: Boolean(lead.minor) }));
    }
    return res.status(201).json({ card });
  } catch (e) {
    throw scrubbedError('create-lead', e);
  }
}

// ---------------------------------------------------------------------------
// Agendamento pelo Stronizap. As regras moram em api/_zapSchedule.js; aqui
// ficam a leitura e a gravação. Spec em
// docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md
// ---------------------------------------------------------------------------

// As listas do agendamento, lidas a cada pedido, como as do cadastro: item
// novo no Stronilead aparece na próxima abertura do balão, e item apagado é
// recusado na gravação.
async function readScheduleCatalogs(tenantId) {
  const [units, modalities, professors, configSnap] = await Promise.all([
    academyCollection(tenantId, UNITS_PATH).get(),
    academyCollection(tenantId, MODALITIES_PATH).get(),
    academyCollection(tenantId, PROFESSORS_PATH).get(),
    academyCollection(tenantId, CONFIG_PATH).doc(CONFIG_GENERAL_ID).get()
  ]);
  return {
    units: docsOf(units),
    modalities: docsOf(modalities),
    professors: docsOf(professors),
    config: configSnap.exists ? configSnap.data() : null
  };
}

// Opções do balão: quem pede (achado pelo e-mail da sessão do Stronizap), os
// cadastros do número, as listas e os dias sugeridos. Só lê.
async function handleScheduleOptions(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readScheduleOptionsBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { matchKey, email } = read.value;

    const agora = new Date();
    const [team, catalogs, people] = await Promise.all([
      readTeam(tenantId), readScheduleCatalogs(tenantId), numberPeople(tenantId, matchKey, agora)
    ]);
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));

    return res.status(200).json(
      buildScheduleOptions({ member, catalogs, owner: people.dono, wards: people.menores, now: agora })
    );
  } catch (e) {
    throw scrubbedError('schedule-options', e);
  }
}

// Agenda a visita ou a aula experimental, gravando o que o assistente da
// ficha grava, numa transação só. Responde 201 com o cartão do número já
// atualizado e o agendamento.
async function handleSchedule(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readScheduleBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { matchKey, email, actorName, channelName, at, schedule } = read.value;

    const limit = await checkRateLimit(`zap-schedule:${tenantId}`, SCHEDULE_LIMIT);
    if (!limit.ok) return responder(res, refusal(429, 'limite', ZAP_SCHEDULE_MESSAGES.rateLimited));

    const [team, catalogs] = await Promise.all([readTeam(tenantId), readScheduleCatalogs(tenantId)]);
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
    // O nome de quem agendou é o do Stronilead, como no cadastro. O que o
    // Stronizap manda só entra se o cadastro da equipe não tiver nome.
    const actor = { ...member, name: member.name || actorName };

    const agora = new Date();
    const problem = checkScheduleCatalog(schedule, catalogs) || checkFuture(at, agora);
    if (problem) return responder(res, problem);

    const serverTime = admin.firestore.FieldValue.serverTimestamp();
    const increment = admin.firestore.FieldValue.increment(1);
    const leadRef = leadsCollection(tenantId).doc(schedule.leadId);
    const aulas = academyCollection(tenantId, AULAS_PATH);
    const interactionRef = academyCollection(tenantId, INTERACTIONS_PATH).doc();

    // Conferência do lead, do pedido repetido e gravação na MESMA transação:
    // dois cliques, duas pessoas ou o "Tentar de novo" depois de uma resposta
    // perdida gravam uma vez só e dão um ponto só na Meta. Só o pedido idêntico
    // é o repetido: mudar unidade, professor, modalidade, quantidade ou
    // anotação no mesmo horário é remarcação e grava (hasSameAppointment).
    const outcome = await adminDb.runTransaction(async (tx) => {
      const leadSnap = await tx.get(leadRef);
      const lead = leadSnap.exists ? leadDoDoc(leadSnap) : null;
      if (!leadBelongsToNumber(lead, matchKey, agora)) return { notTheLead: true };
      if (hasSameAppointment(lead, { type: schedule.type, at, schedule })) return { repeated: lead };

      // O registro em aberto que o assistente reaproveitaria: a aula do
      // currentAulaId ainda agendada, ou a visita agendada do lead.
      let openRecordId = null;
      if (schedule.type === 'aula_experimental') {
        if (isDocId(lead.currentAulaId)) {
          const aulaSnap = await tx.get(aulas.doc(lead.currentAulaId));
          if (aulaSnap.exists && isOpenAulaRecord(aulaSnap.data())) openRecordId = lead.currentAulaId;
        }
      } else {
        openRecordId = pickOpenVisitaId(docsOf(await tx.get(aulas.where('leadId', '==', lead.id))));
      }
      const newRecordRef = openRecordId ? null : aulas.doc();
      const writes = buildScheduleWrites({
        lead, actor, schedule, at, professors: catalogs.professors, channelName,
        openRecordId, newRecordId: newRecordRef ? newRecordRef.id : null, serverTime, increment
      });
      if (openRecordId) tx.update(aulas.doc(openRecordId), writes.record.update);
      else tx.create(newRecordRef, writes.record.create);
      tx.create(interactionRef, writes.interaction);
      tx.update(leadRef, writes.leadPatch);
      return { scheduled: { ...lead, ...writes.leadPatch } };
    });

    if (outcome.notTheLead) {
      return responder(res, refusal(422, 'lead_nao_confere', ZAP_SCHEDULE_MESSAGES.notTheLead));
    }
    const units = unitsView(catalogs.units);
    const card = await cardFor(tenantId, matchKey);
    if (outcome.repeated) {
      return res.status(409).json(alreadyScheduledBody({ card, appointment: appointmentDetailOf(outcome.repeated, units) }));
    }
    return res.status(201).json({ card, appointment: appointmentDetailOf(outcome.scheduled, units) });
  } catch (e) {
    throw scrubbedError('schedule', e);
  }
}
