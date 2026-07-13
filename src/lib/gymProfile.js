// Fonte única do formulário "Perfil da academia" no front. Espelha os campos
// de api/_profile.js (PROFILE_MAX) e o mapeamento tenant↔form usado por TODOS
// os caminhos de escrita (criação no superadmin, edição no superadmin, self-
// service do cliente), pra nunca divergirem.

// Form PLANO (16 campos). city/state e whatsapp são "planos" na UI, mas gravam
// em lugares próprios do tenant (settings / responsiblePhone).
export const EMPTY_PROFILE = {
  cnpjCpf: '', legalName: '', tradeName: '',
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  responsibleName: '', whatsapp: '', email: '', phone: '', responsibleCpf: '', responsibleBirth: '',
};

// Campos que vivem em tenant.profile (13 — sem city/state/whatsapp).
const PROFILE_FIELDS = [
  'cnpjCpf', 'legalName', 'tradeName',
  'cep', 'street', 'number', 'complement', 'neighborhood',
  'responsibleName', 'email', 'phone', 'responsibleCpf', 'responsibleBirth',
];

// form plano → { profile, settings:{city,state}, responsiblePhone }
export function buildTenantProfilePayload(form = {}) {
  const profile = {};
  for (const k of PROFILE_FIELDS) profile[k] = String(form[k] ?? '');
  return {
    profile,
    settings: { city: String(form.city ?? ''), state: String(form.state ?? '') },
    responsiblePhone: String(form.whatsapp ?? ''),
  };
}

// tenant ({profile, settings, responsiblePhone}) → form plano
export function readTenantProfile(tenant = {}) {
  const p = tenant.profile || {};
  return {
    ...EMPTY_PROFILE,
    ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, String(p[k] ?? '')])),
    city: String(tenant.settings?.city ?? ''),
    state: String(tenant.settings?.state ?? ''),
    whatsapp: String(tenant.responsiblePhone ?? ''),
  };
}
