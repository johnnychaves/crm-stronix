// Regras do "Esqueci a senha" que a tela e o servidor dividem. Módulo puro e
// sem dependências, no molde do passwordPolicy.js: as telas importam daqui e
// as funções em api/ também. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

// Endereço da tela. A palavra já é reservada em src/lib/tenantSlug.js.
export const RESET_PATH = '/recuperar-senha';

// As duas ações do POST /api/tenant-resolve.
export const RESET_ACTION_REQUEST = 'password-reset-request';
export const RESET_ACTION_CONFIRM = 'password-reset-confirm';

// O código vale 15 minutos e a quinta tentativa errada mata. Cada conta pede
// no máximo 5 códigos em 24 horas corridas. "Mandar outro código" espera 1
// minuto, e essa espera é só da tela.
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 5;
export const RESET_CODES_PER_DAY = 5;
export const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_EMAIL_LENGTH = 254;

// Frases das duas ações. O servidor manda e a tela mostra.
export const CODE_REFUSED_MESSAGE = 'Código errado ou vencido. Confira o último e-mail ou peça outro código.';
export const MAIL_OFF_MESSAGE = 'A redefinição de senha por e-mail ainda não está ligada. Peça uma senha nova ao administrador da sua academia ou ao suporte do Stronilead.';
export const TOO_MANY_MESSAGE = 'Muitas tentativas. Espere alguns minutos e tente de novo.';
export const EMAIL_INVALID_MESSAGE = 'Confira o e-mail digitado.';
export const SEND_FAILED_MESSAGE = 'Não deu para enviar agora. Tente de novo.';
export const SAVE_FAILED_MESSAGE = 'Não deu para salvar agora. Tente de novo.';
export const PASSWORD_SAVED_MESSAGE = 'Senha nova salva. Entre com ela.';

const MEMORY_KEY = 'stronilead:recuperar-senha';

// Mesma normalização do login: sem espaço nas pontas e em minúsculas.
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

// O mínimo que o pedido aceita. Quem diz se a conta existe é o Firebase.
export function isEmailFormat(email) {
  if (typeof email !== 'string') return false;
  const s = email.trim();
  return s.includes('@') && s.length <= MAX_EMAIL_LENGTH;
}

// Fica só com os números, até 6: "123 456" e "123-456" viram "123456".
export function normalizeResetCode(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 6);
}

export function isResetCodeFormat(code) {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

// Segundos até liberar "Mandar outro código". Zero quando já pode.
export function resendWaitSeconds(lastSentAt, now) {
  return Math.max(0, Math.ceil((lastSentAt + RESEND_COOLDOWN_MS - now) / 1000));
}

export function isPasswordResetPath(pathname) {
  return String(pathname ?? '').toLowerCase().replace(/\/+$/, '') === RESET_PATH;
}

function sessionStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// O que a aba lembra entre um F5 e outro: o e-mail e a hora do último envio.
// Código e senha nunca entram aqui. Sem sessionStorage, a tela só perde a memória.
export function readResetMemory(now = Date.now(), storage = sessionStore()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    if (!m || typeof m.email !== 'string' || typeof m.sentAt !== 'number') return null;
    if (now - m.sentAt >= RESET_CODE_TTL_MS) return null;
    return { email: m.email, sentAt: m.sentAt };
  } catch {
    return null;
  }
}

export function writeResetMemory(memory, storage = sessionStore()) {
  try {
    storage?.setItem(MEMORY_KEY, JSON.stringify({ email: memory.email, sentAt: memory.sentAt }));
  } catch {
    // Sem memória a tela segue funcionando: só perde o passo 2 num F5.
  }
}

export function clearResetMemory(storage = sessionStore()) {
  try {
    storage?.removeItem(MEMORY_KEY);
  } catch {
    // Idem.
  }
}

// O que interessa da resposta das duas ações. O status é nulo quando nem
// chegou resposta. passwordIssue é a frase que vai embaixo do campo da senha.
export function readResetApiError(status, body) {
  if (typeof status !== 'number') return { status: null, message: null, passwordIssue: null };
  const data = body && typeof body === 'object' ? body : {};
  const message = typeof data.error === 'string' ? data.error : null;
  return { status, message, passwordIssue: data.field === 'newPassword' ? message : null };
}

// O que o login manda no estado da navegação para o "Esqueci a senha": o
// e-mail digitado e a academia do endereço. O nome da academia só vai quando
// o login já achou a academia, e academia que não existe não vai.
export function resetLinkState(email, urlTenant) {
  const slug = urlTenant && urlTenant.found !== false && typeof urlTenant.slug === 'string' ? urlTenant.slug : '';
  return {
    email: String(email ?? '').trim(),
    tenant: slug ? { slug, displayName: urlTenant.found ? urlTenant.displayName || slug : null } : null,
  };
}

// O mesmo estado, lido pela tela sem confiar no formato.
export function readResetEntry(state) {
  const s = state && typeof state === 'object' ? state : {};
  const t = s.tenant && typeof s.tenant === 'object' ? s.tenant : null;
  const slug = t && typeof t.slug === 'string' ? t.slug : '';
  return {
    email: typeof s.email === 'string' ? s.email : '',
    tenant: slug ? { slug, displayName: typeof t.displayName === 'string' && t.displayName ? t.displayName : null } : null,
  };
}

// Para onde a tela volta: o login da academia, ou o login geral sem academia.
export function loginPathFor(tenant) {
  return tenant && tenant.slug ? `/${encodeURIComponent(tenant.slug)}` : '/';
}

// O que o login recebe de quem acabou de trocar a senha: o e-mail e o aviso.
export function readLoginArrival(state) {
  const passwordReset = !!state && typeof state === 'object' && state.passwordReset === true;
  return { passwordReset, email: passwordReset && typeof state.email === 'string' ? state.email : '' };
}

// O fetch das duas ações, sem lançar: rede fora devolve status nulo.
export async function postResetAction(body, fetchImpl = (...args) => fetch(...args)) {
  try {
    const r = await fetchImpl('/api/tenant-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    return { status: r.status, body: data };
  } catch {
    return { status: null, body: null };
  }
}
