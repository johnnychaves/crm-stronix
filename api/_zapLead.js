// Regras puras do cadastro de lead pelo Stronizap (ações lead-options e
// create-lead de api/zap.js). Sem Firestore: a rota lê, chama estas funções e
// grava. O firebase-admin passa por cima das regras do Firestore, então o que
// as regras e a tela do Novo lead garantem é refeito aqui.
//
// Toda recusa de regra leva `message`, um texto pronto para a tela: o
// Stronizap mostra como veio, sem recalcular regra nenhuma. Nada daqui vai
// para o log.
//
// Spec: docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md
import { GUARDIAN_RELATIONSHIPS, guardianIssue } from '../src/lib/guardian.js';
import { sameContactPhone } from '../src/lib/leadDerived.js';
import { getInteractionSecurityFields, ZAP_SIGNUP_TYPE } from '../src/lib/leads.js';
import { formatPhone } from '../src/lib/masks.js';
import { normalize } from '../src/lib/globalSearch.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { buildNewLeadDoc, leadEntryFunnels } from '../src/lib/newLead.js';
import { pickDefaultFunnel } from './_referral.js';
import { nationalPhoneDigits, zapMatchKey } from './_zapPhone.js';

const MINUTE_MS = 60000;
const DAY_MS = 86400000;
const NAME_MAX = 120;
const CHANNEL_MAX = 80;
// Observação do cadastro, o mesmo campo do Novo lead.
const NOTE_MAX = 1000;
// Cadastro mais novo que isto aparece como "cadastrado há pouco".
const RECENT_MS = 10 * MINUTE_MS;

// No máximo 60 cadastros por hora por academia (api/_rateLimit.js).
export const LEAD_CREATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60 * MINUTE_MS });

export const ZAP_LEAD_MESSAGES = Object.freeze({
  blocked: 'O Stronilead desta academia está bloqueado. Fale com o gestor.',
  notInTeam: (email) => `Seu e-mail do Stronizap, ${email}, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.`,
  rateLimited: 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.',
  phone: 'O número desta conversa não é um WhatsApp com DDD.',
  actor: 'Não deu para saber quem está cadastrando.',
  channelName: 'O nome do canal veio num formato que o Stronilead não aceita.',
  lead: 'Faltaram os dados do cadastro.',
  nameShort: 'Informe o nome, com 2 letras ou mais.',
  nameLong: `Nome longo demais. Use até ${NAME_MAX} letras.`,
  noteLong: `Observação longa demais. Use até ${NOTE_MAX} caracteres.`,
  wrongType: 'Esse campo veio num formato que o Stronilead não aceita.',
  minor: 'Os dados do menor vieram num formato que o Stronilead não aceita.',
  pick: Object.freeze({
    source: 'Escolha a origem.',
    dor: 'Escolha a dor ou necessidade.',
    funnelId: 'Escolha o funil.',
    stage: 'Escolha a etapa.'
  }),
  gone: Object.freeze({
    source: 'Essa origem não existe mais no Stronilead. Escolha de novo.',
    dor: 'Essa dor não existe mais no Stronilead. Escolha de novo.',
    modalidade: 'Essa modalidade não existe mais no Stronilead. Escolha de novo.',
    funnelId: 'Esse funil não existe mais no Stronilead. Escolha de novo.',
    stage: 'Essa etapa não existe mais no Stronilead. Escolha de novo.'
  }),
  noDor: 'Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores.',
  onlyManagerPicks: 'Só o gestor escolhe outra pessoa como consultor responsável.',
  ownerGone: 'Essa pessoa não está mais na equipe do Stronilead.',
  relationship: 'Escolha o parentesco da lista.',
  studentIncomplete: 'Número incompleto. Inclua DDD + 9 dígitos.',
  studentIsGuardian: 'Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.',
  studentTaken: 'Esse WhatsApp já está em outro cadastro do Stronilead.'
});

// Recusa pronta para responder: { status, body }. A de campo leva `field`.
export const refusal = (status, error, message, extra = {}) => ({ status, body: { error, ...extra, message } });
export const invalidData = (field, message) => refusal(400, 'dados_invalidos', message, { field });

// ---------------------------------------------------------------------------
// Academia ativa
// ---------------------------------------------------------------------------

// Instante de um Timestamp do firebase-admin (toMillis/toDate) ou de um Date.
// Qualquer outra coisa não é timestamp e volta null, como o `is timestamp` das
// regras.
const millisOf = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  return null;
};

// A mesma conta do tenantActive de firestore.rules: academia suspensa, teste
// vencido e mensalidade atrasada há mais de 3 dias ficam de fora. Documento
// ausente libera, como nas regras. As regras não têm a exceção de "teste
// vencido, mas pago" da tela de login: quem paga no teste vira 'active' pelo
// webhook do Asaas.
export function tenantBlocked(tenant, now = new Date()) {
  if (!tenant) return false;
  const nowMs = now.getTime();
  if (tenant.status === 'suspended') return true;
  const trialEnd = millisOf(tenant.trialEndsAt);
  if (tenant.status === 'trial' && trialEnd != null && trialEnd < nowMs) return true;
  const overdueSince = millisOf(tenant.paymentOverdueSince);
  return tenant.paymentStatus === 'overdue' && overdueSince != null && nowMs - overdueSince > 3 * DAY_MS;
}

// ---------------------------------------------------------------------------
// Telefone e equipe
// ---------------------------------------------------------------------------

// Dígitos nacionais do número, sem o 55 e com o nono dígito do celular antigo
// (nationalPhoneDigits, em api/_zapPhone.js). Só aceita texto: número no lugar
// de texto é pedido malformado.
export function nationalDigits(raw) {
  return typeof raw === 'string' ? nationalPhoneDigits(raw) : null;
}

// O número no formato que o Novo lead grava em `whatsapp`: "(51) 9 9812-4471".
// Celular antigo já sai com o 9: "555181244710" vira "(51) 9 8124-4710".
export function whatsappFromZap(raw) {
  const d = nationalDigits(raw);
  return d ? formatPhone(d) : null;
}

// E-mail de quem cadastra, como o Stronilead guarda: minúsculas e sem espaço.
// Sai da sessão do Stronizap, nunca do navegador.
export function emailFromActor(actor) {
  const email = typeof actor?.email === 'string' ? actor.email.trim().toLowerCase() : '';
  return email.includes('@') && email.length <= 254 ? email : null;
}

// A pessoa da equipe com esse e-mail e com login (authUid). Cadastro legado
// repetido, um com e outro sem authUid, fica com o que tem.
export function findTeamMember(team, email) {
  if (!email) return null;
  return (team || []).find((u) => u.authUid && String(u.email ?? '').trim().toLowerCase() === email) ?? null;
}

// Gestor no Stronilead é o role 'admin'.
export const teamRole = (member) => (member?.role === 'admin' ? 'gestor' : 'consultor');

// ---------------------------------------------------------------------------
// Catálogos e opções do formulário
// ---------------------------------------------------------------------------

const byName = (a, b) => a.localeCompare(b, 'pt-BR');
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const hasName = (d) => typeof d?.name === 'string' && d.name.trim() !== '';
const uniqueNames = (docs) => [...new Set(docs.filter(hasName).map((d) => d.name))];

// Os catálogos no formato do formulário, na ordem das telas do Stronilead:
// origens e dores em ordem alfabética, modalidades, funis e etapas pela ordem
// configurada. Os nomes vão como estão gravados, porque é o nome que o lead
// guarda. Funil sem etapa fica de fora: no Stronizap a etapa é obrigatória.
export function catalogView({ sources = [], dores = [], modalities = [], funnels = [], statuses = [] } = {}) {
  const stagesOf = (funnelId) => uniqueNames(statuses.filter((s) => s.funnelId === funnelId).sort(byOrder));
  return {
    sources: uniqueNames(sources).sort(byName),
    dores: uniqueNames(dores).sort(byName),
    modalities: uniqueNames([...modalities].sort(byOrder)),
    funnels: leadEntryFunnels([...funnels].sort(byOrder))
      .filter(hasName)
      .map((f) => ({ id: f.id, name: f.name, stages: stagesOf(f.id), isDefault: f.isDefault === true }))
      .filter((f) => f.stages.length > 0)
  };
}

// Resposta do lead-options. O padrão é o do Novo lead: a origem com "whats"
// no nome (senão a primeira em ordem alfabética), o funil padrão da academia
// e a primeira etapa dele. A equipe só vai para o gestor, com id e nome.
export function buildLeadOptions({ actor, team, catalogs }) {
  const view = catalogView(catalogs);
  const funil = pickDefaultFunnel(view.funnels);
  const options = {
    actor: { id: actor.id, name: actor.name ?? null, role: teamRole(actor) },
    sources: view.sources.map((name) => ({ name })),
    dores: view.dores.map((name) => ({ name })),
    modalities: view.modalities.map((name) => ({ name })),
    funnels: view.funnels.map((f) => ({ id: f.id, name: f.name, stages: f.stages.map((name) => ({ name })) })),
    relationships: [...GUARDIAN_RELATIONSHIPS],
    defaults: {
      source: view.sources.find((n) => /whats/i.test(n)) ?? view.sources[0] ?? null,
      funnelId: funil?.id ?? null,
      stage: funil?.stages[0] ?? null
    }
  };
  if (teamRole(actor) === 'gestor') {
    options.team = (team || [])
      .filter((u) => u.authUid && hasName(u))
      .map((u) => ({ id: u.id, name: u.name }))
      .sort((a, b) => byName(a.name, b.name));
  }
  return options;
}

// ---------------------------------------------------------------------------
// Pedido de cadastro e conferências
// ---------------------------------------------------------------------------

const textOrEmpty = (v) => (typeof v === 'string' ? v : '');
const isBlank = (v) => !v || !v.trim();

// Lê o corpo do create-lead. Só o formato: o que depende da academia (equipe,
// catálogos, duplicado) é conferido depois. Devolve { value } ou { refusal }.
// O telefone sai normalizado (sem o 55 e com o nono dígito), e é dele que sai
// a chave do duplicado. Os nomes de catálogo vão como vieram, porque são
// comparados com o gravado.
export function readCreateLeadBody(body) {
  const phone = nationalDigits(body?.phone);
  if (!phone) return { refusal: invalidData('phone', ZAP_LEAD_MESSAGES.phone) };
  const email = emailFromActor(body?.actor);
  if (!email) return { refusal: invalidData('actor', ZAP_LEAD_MESSAGES.actor) };
  const channel = body.channelName;
  if (channel != null && typeof channel !== 'string') {
    return { refusal: invalidData('channelName', ZAP_LEAD_MESSAGES.channelName) };
  }
  const lead = body.lead;
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) {
    return { refusal: invalidData('lead', ZAP_LEAD_MESSAGES.lead) };
  }
  const name = textOrEmpty(lead.name).trim();
  if (name.length < 2) return { refusal: invalidData('name', ZAP_LEAD_MESSAGES.nameShort) };
  if (name.length > NAME_MAX) return { refusal: invalidData('name', ZAP_LEAD_MESSAGES.nameLong) };
  for (const field of ['source', 'dor', 'modalidade', 'funnelId', 'stage', 'ownerId', 'observacao']) {
    if (lead[field] != null && typeof lead[field] !== 'string') {
      return { refusal: invalidData(field, ZAP_LEAD_MESSAGES.wrongType) };
    }
  }
  const observacao = textOrEmpty(lead.observacao).trim();
  if (observacao.length > NOTE_MAX) return { refusal: invalidData('observacao', ZAP_LEAD_MESSAGES.noteLong) };
  let minor = null;
  if (lead.minor) {
    const m = lead.minor;
    if (typeof m !== 'object' || Array.isArray(m)) return { refusal: invalidData('minor', ZAP_LEAD_MESSAGES.minor) };
    for (const field of ['guardianName', 'relationship', 'studentWhatsapp']) {
      if (m[field] != null && typeof m[field] !== 'string') {
        return { refusal: invalidData(field, ZAP_LEAD_MESSAGES.wrongType) };
      }
    }
    minor = {
      guardianName: textOrEmpty(m.guardianName).trim(),
      relationship: textOrEmpty(m.relationship).trim() || null,
      studentWhatsapp: textOrEmpty(m.studentWhatsapp).trim() || null
    };
  }
  const actorName = textOrEmpty(body.actor.name).trim().slice(0, NAME_MAX);
  return {
    value: {
      phone,
      matchKey: zapMatchKey(phone),
      email,
      actorName: actorName || null,
      channelName: textOrEmpty(channel).trim().slice(0, CHANNEL_MAX) || null,
      lead: {
        name,
        source: textOrEmpty(lead.source),
        dor: textOrEmpty(lead.dor),
        modalidade: isBlank(lead.modalidade) ? null : lead.modalidade,
        funnelId: textOrEmpty(lead.funnelId),
        stage: textOrEmpty(lead.stage),
        ownerId: textOrEmpty(lead.ownerId).trim() || null,
        minor,
        observacao: observacao || null
      }
    }
  };
}

// Regras do menor: as do guardian.js, com o número da conversa como telefone
// do responsável, mais o sameContactPhone no WhatsApp do aluno.
export function checkMinor({ minor, phone }) {
  if (!minor) return null;
  const problem = guardianIssue({ isMinor: true, name: minor.guardianName, phone, birthDate: null });
  if (problem) return refusal(422, 'menor_invalido', problem, { field: 'guardianName' });
  if (minor.relationship && !GUARDIAN_RELATIONSHIPS.includes(minor.relationship)) {
    return refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.relationship, { field: 'relationship' });
  }
  if (minor.studentWhatsapp) {
    if (!nationalDigits(minor.studentWhatsapp)) {
      return refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIncomplete, { field: 'studentWhatsapp' });
    }
    if (sameContactPhone(minor.studentWhatsapp, phone)) {
      return refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIsGuardian, { field: 'studentWhatsapp' });
    }
  }
  return null;
}

// Origem, dor, modalidade, funil e etapa conferidos contra o que existe agora.
// Academia sem dor não cadastra, a mesma trava do Novo lead.
export function checkCatalog(lead, catalogs) {
  const view = catalogView(catalogs);
  if (view.dores.length === 0) return refusal(422, 'sem_dor_cadastrada', ZAP_LEAD_MESSAGES.noDor);
  const gone = (field) => refusal(422, 'catalogo_mudou', ZAP_LEAD_MESSAGES.gone[field], { field });
  if (isBlank(lead.source)) return invalidData('source', ZAP_LEAD_MESSAGES.pick.source);
  if (!view.sources.includes(lead.source)) return gone('source');
  if (isBlank(lead.dor)) return invalidData('dor', ZAP_LEAD_MESSAGES.pick.dor);
  if (!view.dores.includes(lead.dor)) return gone('dor');
  if (lead.modalidade && !view.modalities.includes(lead.modalidade)) return gone('modalidade');
  if (isBlank(lead.funnelId)) return invalidData('funnelId', ZAP_LEAD_MESSAGES.pick.funnelId);
  const funnel = view.funnels.find((f) => f.id === lead.funnelId);
  if (!funnel) return gone('funnelId');
  if (isBlank(lead.stage)) return invalidData('stage', ZAP_LEAD_MESSAGES.pick.stage);
  if (!funnel.stages.includes(lead.stage)) return gone('stage');
  return null;
}

// Dono do lead: quem cadastra, ou quem o gestor escolheu. Consultor não passa
// o lead para outra pessoa, e o escolhido precisa estar na equipe com login.
export function resolveOwner({ actor, ownerId, team }) {
  if (!ownerId || ownerId === actor.id) return { owner: actor };
  if (teamRole(actor) !== 'gestor') {
    return { refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.onlyManagerPicks) };
  }
  const owner = (team || []).find((u) => u.id === ownerId && u.authUid);
  return owner ? { owner } : { refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.ownerGone) };
}

// O mesmo aluno: nome sem acento, sem caixa e sem espaço a mais.
const nameKey = (name) => normalize(name).trim().replace(/\s+/g, ' ');
export const sameStudentName = (a, b) => nameKey(a) !== '' && nameKey(a) === nameKey(b);

// Chave do Zap do WhatsApp do aluno, quando ele tem um, tirada do número já
// normalizado, como a do número da conversa.
export const studentKey = (minor) => (minor?.studentWhatsapp ? zapMatchKey(nationalDigits(minor.studentWhatsapp)) : null);

// ---------------------------------------------------------------------------
// O que é gravado e o que é respondido
// ---------------------------------------------------------------------------

// O `text` do marco, para qualquer tela que ainda não conheça o tipo.
export function zapSignupText({ actorName, ownerName = null, channelName = null }) {
  return [
    actorName ? `Cadastrado pelo Stronizap por ${actorName}.` : 'Cadastrado pelo Stronizap.',
    ownerName ? `Consultor responsável: ${ownerName}.` : null,
    channelName ? `Canal ${channelName}.` : null
  ].filter(Boolean).join(' ');
}

// O lead novo do Stronizap. O corpo sai do mesmo montador do Novo lead; aqui
// entram só as diferenças da ponte: as datas do servidor, o marco de início
// já contado (lastInteractionAt e interactionsCount: 1, como no cadastro com
// observação e no link de indicação) e o aviso de troca de dono quando o
// gestor escolheu outra pessoa, que acende o "passado para você" no sino.
export function buildZapLead({ lead, phone, actor, owner, serverTime }) {
  const conversa = whatsappFromZap(phone);
  const form = {
    name: lead.name,
    source: lead.source,
    funnelId: lead.funnelId,
    status: lead.stage,
    dor: lead.dor,
    modalidade: lead.modalidade || '',
    ...(lead.minor
      ? {
          whatsapp: lead.minor.studentWhatsapp ? whatsappFromZap(lead.minor.studentWhatsapp) : '',
          isMinor: true,
          guardianName: lead.minor.guardianName,
          guardianPhone: conversa,
          guardianRelation: lead.minor.relationship || ''
        }
      : { whatsapp: conversa })
  };
  const doc = {
    ...buildNewLeadDoc(form, { owner }),
    createdAt: serverTime,
    statusEnteredAt: serverTime,
    lastInteractionAt: serverTime,
    // O marco de início e, quando vem, a observação do cadastro.
    interactionsCount: lead.observacao ? 2 : 1
  };
  if (owner.id !== actor.id) {
    doc.consultantChangedAt = serverTime;
    doc.consultantChangedByName = actor.name ?? null;
    doc.consultantChangedByAuthUid = actor.authUid ?? null;
  }
  return doc;
}

// O marco de início (type zap_signup). O autor na linha do tempo é quem
// cadastrou (consultantName); o dono do lead vai nos campos de segurança de
// sempre, e o ownerName só quando é outra pessoa. Sem volumeKind: o lead conta
// na prospecção do dono pelo próprio lead, como no Novo lead.
export function buildZapSignupInteraction({ leadId, leadName, actor, owner, channelName = null, serverTime }) {
  const otherOwner = owner.id !== actor.id;
  return {
    leadId,
    leadName: leadName || null,
    consultantName: actor.name ?? null,
    ...getInteractionSecurityFields({ consultantId: owner.id, consultantAuthUid: owner.authUid }, actor),
    actorId: actor.id,
    actorAuthUid: actor.authUid ?? null,
    type: ZAP_SIGNUP_TYPE,
    text: zapSignupText({ actorName: actor.name, ownerName: otherOwner ? owner.name : null, channelName }),
    ...(otherOwner ? { ownerName: owner.name ?? null } : {}),
    zapChannelName: channelName || null,
    createdAt: serverTime
  };
}

// A observação do cadastro, com a mesma forma que o Novo lead grava pelo
// logInteraction: nota com o prefixo que a linha do tempo reconhece
// (isRegistrationNote), no dono do lead e em nome de quem cadastrou. Vai na
// mesma transação do lead e do marco; a ficha põe o marco embaixo dela quando
// os horários empatam (originLastOnTies).
export function buildRegistrationNote({ leadId, leadName, actor, owner, observacao, serverTime }) {
  return {
    leadId,
    leadName: leadName || null,
    consultantName: actor.name ?? null,
    ...getInteractionSecurityFields({ consultantId: owner.id, consultantAuthUid: owner.authUid }, actor),
    actorId: actor.id,
    actorAuthUid: actor.authUid ?? null,
    createdAt: serverTime,
    text: `OBSERVAÇÃO DO CADASTRO: ${observacao}`,
    type: 'note'
  };
}

// Resposta 409: o cartão do número, a data do cadastro que já existia e o
// texto da tela. "Há pouco" é menos de 10 minutos: foi outra pessoa, ou o
// mesmo cadastro que teve a resposta perdida.
export function alreadyRegisteredBody({ repeated, card, minor = false, now = new Date() }) {
  const created = getSafeDateOrNull(repeated?.createdAt);
  const recent = Boolean(created) && now.getTime() - created.getTime() < RECENT_MS;
  const who = repeated?.consultantName ? ` Quem cuida é ${repeated.consultantName}.` : '';
  const student = repeated?.name || 'Esse aluno';
  let message;
  if (minor) {
    message = recent
      ? `O cadastro de ${student} com esse responsável foi feito há pouco.${who}`
      : `${student} já tem cadastro no Stronilead com esse responsável.`;
  } else {
    message = recent ? `Esse número foi cadastrado há pouco.${who}` : 'Esse número já estava no Stronilead.';
  }
  return { error: 'ja_cadastrado', card, createdAt: created ? created.toISOString() : null, message };
}

// Erro inesperado sem dado pessoal. A mensagem do Firestore pode trazer o
// valor da consulta (o telefone), então ela não sobe: vai o código, ou o nome
// do erro. A pilha fica, porque aponta arquivo e linha sem carregar dado.
export function scrubbedError(action, err) {
  const code = err?.code ?? err?.name ?? 'sem código';
  const clean = new Error(`zap ${action} falhou (${code})`);
  const frames = String(err?.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line));
  if (frames.length > 0) clean.stack = [`Error: ${clean.message}`, ...frames].join('\n');
  return clean;
}
