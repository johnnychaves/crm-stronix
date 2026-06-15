// Saneamento do "Perfil da academia" (campos de TEXTO). Fonte ÚNICA de validação
// para os DOIS caminhos de edição, para nunca divergirem:
//   • super-admin  → tenant-status.js (PATCH do tenant)
//   • self-service → asaas.js handleTenantSelf (action:'updateProfile')
//
// Os campos vivem em `tenant.profile`. NÃO duplicamos fontes já existentes:
// cidade/UF continuam em `tenant.settings` e o WhatsApp do responsável em
// `tenant.responsiblePhone`. Logo ADIADA: sem campo de imagem nesta versão.
//
// Arquivo com prefixo `_` → utilitário, NÃO conta no limite de 12 Serverless
// Functions do Vercel Hobby.

// Limite de caracteres por campo (defesa contra payload abusivo).
const PROFILE_MAX = {
  cnpjCpf: 20,        // identidade & fiscal (CNPJ da empresa)
  legalName: 140,     // razão social
  tradeName: 140,     // nome fantasia (opcional)
  cep: 12,            // endereço (city/state ficam em settings)
  street: 140,
  number: 16,
  complement: 80,
  neighborhood: 100,
  responsibleName: 120, // contato & responsável (whatsapp = responsiblePhone)
  email: 140,
  phone: 30,
  responsibleCpf: 20,   // CPF do responsável
  responsibleBirth: 10, // data de nascimento (YYYY-MM-DD)
};

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Recebe um `profile` cru e devolve só os campos conhecidos, saneados.
// Retorna null se não houver nada utilizável (sinaliza "não mexer no profile").
export function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [k, max] of Object.entries(PROFILE_MAX)) {
    if (raw[k] !== undefined) out[k] = clean(raw[k], max);
  }
  return Object.keys(out).length ? out : null;
}

export const PROFILE_KEYS = Object.keys(PROFILE_MAX);
