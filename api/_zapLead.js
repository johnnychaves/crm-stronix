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
import { GUARDIAN_RELATIONSHIPS } from '../src/lib/guardian.js';
import { formatPhone } from '../src/lib/masks.js';
import { leadEntryFunnels } from '../src/lib/newLead.js';
import { pickDefaultFunnel } from './_referral.js';
import { nationalPhoneDigits } from './_zapPhone.js';

const MINUTE_MS = 60000;
const DAY_MS = 86400000;
const NAME_MAX = 120;

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
