// Montador do lead novo. É o documento que o Novo lead (AddLeadModal.jsx)
// grava e o mesmo que o cadastro pelo Stronizap grava (api/_zapLead.js): um
// campo novo entra aqui e chega aos dois cadastros de uma vez.
//
// Puro: sem React e sem Firebase, porque roda também na api/ (SDK de
// servidor). Nada no caminho deste arquivo pode importar firebase.js,
// dailyGoal.js ou funnels.js; newLeadImports.test.js trava isso. As datas do
// servidor (createdAt, statusEnteredAt) ficam com quem grava, porque cada lado
// usa um SDK diferente.
//
// Spec: docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md
import { getLeadOwnershipFields } from './leads.js';
import { buildLeadSearchFields, buildGuardianPatch, deriveLeadBucket } from './leadDerived.js';
import { fromDateInputValue } from './dates.js';
import { isReferralFunnel } from './referrals.js';
import { isRenewalFunnel } from './renewalFunnel.js';
import { isExpiredFunnel } from './expiredFunnel.js';
import { isUpgradeFunnel } from './upgradeFunnel.js';

// `form` tem o formato do estado do Novo lead: nascimento como o texto do
// <input type="date">, e o responsável em guardianName, guardianPhone e
// guardianRelation. Campo que não veio ganha o valor vazio do Novo lead.
// `owner` é quem fica dono do lead ({ id, name, authUid }, como o appUser), e
// `referrer`, o cliente que indicou, ou null.
export function buildNewLeadDoc(form = {}, { owner = null, referrer = null } = {}) {
  const {
    name = '', whatsapp = '', source = '', funnelId = null, status = '', tags = [],
    birthDate = '', cpf = '', email = '', sexo = '', dor = '', modalidade = '',
    isMinor = false, guardianName = '', guardianPhone = '', guardianRelation = '',
  } = form;
  return {
    name: String(name).trim(),
    whatsapp,
    source,
    funnelId,
    status,
    tags,
    birthDate: fromDateInputValue(birthDate),
    cpf: (cpf || '').trim() || null,
    email: (email || '').trim() || null,
    sexo: sexo || null,
    dor: (dor || '').trim() || null,
    modalidade: modalidade || null,
    // Vínculo de indicação no PRÓPRIO doc: a feature funciona mesmo se o
    // batch de eventos (commitReferralLink) falhar depois.
    referredById: referrer ? referrer.id : null,
    referredByName: referrer ? (referrer.name || null) : null,
    ...getLeadOwnershipFields(owner),
    ...buildLeadSearchFields({ name, whatsapp, cpf }),
    ...buildGuardianPatch({ isMinor, name: guardianName, phone: guardianPhone, relationship: guardianRelation }),
    lifecycleBucket: deriveLeadBucket({ status }),
    lastInteractionAt: null,
    interactionsCount: 0,
    nextFollowUp: null,
    nextFollowUpType: null,
    appointmentType: null,
    appointmentScheduledFor: null,
  };
}

// Funis em que um lead novo pode nascer pela escolha de funil. Ficam de fora o
// de Indicações (no Novo lead ele tem o interruptor próprio) e os três que
// projetam clientes (Renovações, Vencidos e Upgrade), onde o lead nasceria sem
// etapa ou sumiria de todo board. O discriminador é o systemKind, nunca o nome.
export const leadEntryFunnels = (funnels) =>
  (Array.isArray(funnels) ? funnels : []).filter(
    (f) => !isReferralFunnel(f) && !isRenewalFunnel(f) && !isExpiredFunnel(f) && !isUpgradeFunnel(f)
  );
