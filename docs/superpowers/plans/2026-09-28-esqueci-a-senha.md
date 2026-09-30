# Esqueci a senha no Stronilead: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para seguir este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** quem esqueceu a senha pede um código de 6 números por e-mail na tela de login e cria a senha nova sozinho, no padrão do Stronizap.

**Arquitetura:** duas ações POST novas no `api/tenant-resolve.js`, para a Vercel continuar com 11 funções. A rota (`api/_passwordResetRoute.js`) responde e entrega o pedido ao `waitUntil`. O fluxo (`api/_passwordResetFlow.js`) recebe de fora, por `deps`, tudo que toca o mundo. As contas puras moram em `api/_passwordReset.js`, e as operações de verdade (Firebase Auth e transações no Firestore) em `api/_passwordResetRepo.js`. O e-mail sai pelo Resend (`api/_mail.js`). Na tela, `/recuperar-senha` (`ForgotPasswordScreen.jsx`) divide com o login a moldura (`AuthLayout.jsx`) e o campo (`AuthField.jsx`), e o que a tela e o servidor dividem mora em `src/lib/passwordReset.js`.

**Stack:** React 19, React Router 7 (pacote `react-router`), Firebase Admin 13 (Auth e Firestore), funções Node da Vercel, `@vercel/functions` (novo), Resend por `fetch`, vitest (node e jsdom).

**Spec:** `docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md`. Na dúvida, a spec manda.

---

## Antes de começar

- Branch `claude/stornilead-password-reset-3a5056`, na worktree `great-keller-18b985`. A linha de base medida em 28/09/2026 é de 120 arquivos e 2412 testes verdes, e o lint tem 0 erros e 1 aviso (o `exhaustive-deps` de `loadPlans` e `loadTenants`, que já existia).
- Rode os comandos na pasta da worktree. Para um arquivo de teste, use `npx vitest run <caminho>`. Para a suíte inteira, `npx vitest run`. Para o lint, `npm run lint`.
- Todo texto que alguém lê (tela, e-mail, comentário, commit) segue o tom da STRONIX: direto, sem travessão no meio da frase e sem frase de efeito.
- Não use senha real em teste, comentário, commit ou PR. Nos testes, as senhas são inventadas, como `Nova@Senha1`.
- Os commits são em português, no formato `tipo: descrição`, e terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/lib/passwordReset.js` (novo) | O que a tela e o servidor dividem: prazos, limites, nomes das ações, frases, normalização, memória da aba, leitura da resposta, ida e volta com o login e o `fetch` da tela |
| `api/_passwordReset.js` (novo) | Contas puras do servidor: sorteio, HMAC, quem pode receber e os planejadores das transações (`planIssue`, `planReserve`, `planKill`, `marksChanged`) |
| `api/_passwordResetEmail.js` (novo) | O e-mail: assunto, HTML e texto |
| `api/_mail.js` (novo) | Envio pelo Resend e o `mailStatus` |
| `api/_passwordResetFlow.js` (novo) | O fluxo do pedido e da troca, com tudo que toca o mundo em `deps` |
| `api/_passwordResetRepo.js` (novo) | As operações de verdade (Firebase Auth, Firestore e auditoria) e o `realResetDeps()` |
| `api/_passwordResetRoute.js` (novo) | As duas ações: limites por IP, validação, respostas e `waitUntil` |
| `api/_sentry.js` | Ganha o `captureError`, para erro que acontece depois da resposta |
| `api/tenant-resolve.js` | O POST olha a ação antes de seguir para a página de indicação |
| `src/lib/superadmin.js` | Rótulo do `password.reset` na atividade recente do super-admin |
| `src/views/auth/AuthLayout.jsx` (novo) | Moldura das telas de entrada e a etiqueta da academia |
| `src/views/auth/AuthField.jsx` (novo) | O campo das telas de entrada (`AuthField` e `AuthInput`) |
| `src/views/auth/LoginScreen.jsx` | Usa a moldura e o campo, leva ao `/recuperar-senha` e mostra o aviso da volta |
| `src/views/auth/ForgotPasswordScreen.jsx` (novo) | Os dois passos |
| `src/App.jsx` | Sem sessão e em `/recuperar-senha`, desenha a tela nova |
| `CLAUDE.md`, `.env.example` | Documentação |

Testes novos: `src/lib/__tests__/passwordReset.test.js`, `src/lib/__tests__/superadminAudit.test.js`, `src/lib/__tests__/authLayout.test.js`, `src/lib/__tests__/forgotPasswordScreen.test.js`, `src/lib/__tests__/loginScreen.test.js`, `api/__tests__/passwordReset.test.js`, `api/__tests__/passwordResetEmail.test.js`, `api/__tests__/mail.test.js`, `api/__tests__/passwordResetFlow.test.js`, `api/__tests__/passwordResetRepo.test.js`, `api/__tests__/sentryCaptureError.test.js` e `api/__tests__/passwordResetRoute.test.js`.

---

### Task 0: dependências e linha de base

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: conferir a branch contra a main**

Run: `git status --short && git log --oneline -1 && git fetch origin main -q && git rev-list --count HEAD..origin/main`
Expected: nada pendente, o último commit é o do plano ou o da spec, e `0` commits atrás. Se estiver atrás, rode `git merge --ff-only origin/main`. Se o merge não for fast-forward, pare e avise.

- [ ] **Step 2: acertar o `node_modules` da worktree**

Run: `npm install --no-audit --no-fund && git diff --quiet package-lock.json && echo lock-igual`
Expected: `lock-igual`. A worktree costuma ficar com o `node_modules` atrás do lock.

- [ ] **Step 3: medir a linha de base**

Run: `npx vitest run 2>&1 | tail -4 && npm run lint 2>&1 | tail -2`
Expected: `Test Files  120 passed (120)`, `Tests  2412 passed (2412)` e `✖ 1 problem (0 errors, 1 warning)`. Se os números forem outros, anote: eles passam a ser a linha de base desta execução.

- [ ] **Step 4: instalar o `@vercel/functions`**

Run: `npm install @vercel/functions@^3.9.9 --no-audit --no-fund && git diff --stat`
Expected: mudam só o `package.json` (uma linha nova em `dependencies`) e o `package-lock.json` (o pacote e o `@vercel/oidc`).

- [ ] **Step 5: conferir que o import funciona**

Run: `node --input-type=module -e "import { waitUntil } from '@vercel/functions'; console.log(typeof waitUntil)"`
Expected: `function`

- [ ] **Step 6: commit**

```bash
git add package.json package-lock.json
git commit -m "chore: @vercel/functions para o waitUntil do esqueci a senha" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: o que a tela e o servidor dividem (`src/lib/passwordReset.js`)

**Files:**
- Create: `src/lib/passwordReset.js`
- Test: `src/lib/__tests__/passwordReset.test.js`

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect, vi } from 'vitest';
import {
  RESET_PATH, RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, RESET_CODE_TTL_MS, MAX_EMAIL_LENGTH,
  normalizeEmail, isEmailFormat, normalizeResetCode, isResetCodeFormat, resendWaitSeconds,
  isPasswordResetPath, readResetMemory, writeResetMemory, clearResetMemory, readResetApiError,
  resetLinkState, readResetEntry, loginPathFor, readLoginArrival, postResetAction,
} from '../passwordReset.js';

// Um sessionStorage de mentira, para a memória da aba rodar em node.
function armazenamento() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(k, String(v)); },
    removeItem: (k) => { dados.delete(k); },
  };
}

describe('e-mail', () => {
  it('normaliza como o login: sem espaço nas pontas e em minúsculas', () => {
    expect(normalizeEmail('  Ana@Academia.COM ')).toBe('ana@academia.com');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('aceita texto com @ e até 254 caracteres', () => {
    expect(isEmailFormat('ana@academia.com')).toBe(true);
    expect(isEmailFormat('ana.academia.com')).toBe(false);
    expect(isEmailFormat(`${'a'.repeat(MAX_EMAIL_LENGTH)}@x.com`)).toBe(false);
    expect(isEmailFormat(42)).toBe(false);
  });
});

describe('código', () => {
  it('fica só com os números, até 6', () => {
    expect(normalizeResetCode('123 456')).toBe('123456');
    expect(normalizeResetCode('123-456')).toBe('123456');
    expect(normalizeResetCode('12a3b4')).toBe('1234');
    expect(normalizeResetCode('1234567')).toBe('123456');
    expect(normalizeResetCode(null)).toBe('');
  });

  it('o formato certo é texto com exatamente 6 números', () => {
    expect(isResetCodeFormat('012345')).toBe(true);
    expect(isResetCodeFormat('12345')).toBe(false);
    expect(isResetCodeFormat('12a456')).toBe(false);
    expect(isResetCodeFormat(123456)).toBe(false);
  });
});

describe('resendWaitSeconds', () => {
  it('conta 60 segundos a partir do envio e para no zero', () => {
    expect(resendWaitSeconds(0, 0)).toBe(60);
    expect(resendWaitSeconds(0, 59_001)).toBe(1);
    expect(resendWaitSeconds(0, 60_000)).toBe(0);
    expect(resendWaitSeconds(0, 90_000)).toBe(0);
  });
});

describe('isPasswordResetPath', () => {
  it('reconhece /recuperar-senha, com barra no fim e em maiúsculas', () => {
    expect(isPasswordResetPath(RESET_PATH)).toBe(true);
    expect(isPasswordResetPath('/recuperar-senha/')).toBe(true);
    expect(isPasswordResetPath('/Recuperar-Senha')).toBe(true);
  });

  it('não confunde com outras telas', () => {
    expect(isPasswordResetPath('/')).toBe(false);
    expect(isPasswordResetPath('/academia/recuperar-senha')).toBe(false);
    expect(isPasswordResetPath(undefined)).toBe(false);
  });
});

describe('memória da aba', () => {
  it('guarda o e-mail e a hora do envio, e vence junto com o código', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000 }, s);
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS - 1, s)).toEqual({ email: 'ana@academia.com', sentAt: 1000 });
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS, s)).toBeNull();
  });

  it('nunca guarda código nem senha', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000, code: '123456', password: 'x' }, s);
    expect(s.getItem('stronilead:recuperar-senha')).toBe('{"email":"ana@academia.com","sentAt":1000}');
  });

  it('apaga a memória', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000 }, s);
    clearResetMemory(s);
    expect(readResetMemory(1000, s)).toBeNull();
  });

  it('não quebra sem sessionStorage, com armazenamento que lança ou com lixo guardado', () => {
    expect(readResetMemory(0, null)).toBeNull();
    const quebrado = {
      getItem: () => { throw new Error('x'); },
      setItem: () => { throw new Error('x'); },
      removeItem: () => { throw new Error('x'); },
    };
    expect(readResetMemory(0, quebrado)).toBeNull();
    expect(() => writeResetMemory({ email: 'a@b.c', sentAt: 0 }, quebrado)).not.toThrow();
    expect(() => clearResetMemory(quebrado)).not.toThrow();
    const lixo = armazenamento();
    lixo.setItem('stronilead:recuperar-senha', '{nao-e-json');
    expect(readResetMemory(0, lixo)).toBeNull();
  });

  it('em node, sem window, lê como vazia', () => {
    expect(readResetMemory()).toBeNull();
  });
});

describe('readResetApiError', () => {
  it('sem resposta, o status é nulo', () => {
    expect(readResetApiError(null, null)).toEqual({ status: null, message: null, passwordIssue: null });
  });

  it('a frase do campo da senha só vem com field newPassword', () => {
    expect(readResetApiError(400, { error: 'A senha precisa ter número.', field: 'newPassword' }))
      .toEqual({ status: 400, message: 'A senha precisa ter número.', passwordIssue: 'A senha precisa ter número.' });
    expect(readResetApiError(400, { error: 'Código errado ou vencido.' }))
      .toEqual({ status: 400, message: 'Código errado ou vencido.', passwordIssue: null });
    expect(readResetApiError(500, null)).toEqual({ status: 500, message: null, passwordIssue: null });
  });
});

describe('ida e volta entre o login e a tela', () => {
  it('o login manda o e-mail e a academia, e o nome só quando já achou a academia', () => {
    expect(resetLinkState(' ana@academia.com ', { slug: 'academia-teste', found: true, displayName: 'Academia Teste' }))
      .toEqual({ email: 'ana@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } });
    expect(resetLinkState('', { slug: 'academia-teste', loading: true }))
      .toEqual({ email: '', tenant: { slug: 'academia-teste', displayName: null } });
    expect(resetLinkState('', { slug: 'nao-existe', found: false })).toEqual({ email: '', tenant: null });
    expect(resetLinkState('', null)).toEqual({ email: '', tenant: null });
  });

  it('a tela lê o estado da navegação sem confiar no formato', () => {
    expect(readResetEntry({ email: 'ana@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } }))
      .toEqual({ email: 'ana@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } });
    expect(readResetEntry(null)).toEqual({ email: '', tenant: null });
    expect(readResetEntry({ email: 7, tenant: { slug: 3 } })).toEqual({ email: '', tenant: null });
  });

  it('a volta cai no login da academia, ou no login geral sem academia', () => {
    expect(loginPathFor({ slug: 'academia-teste' })).toBe('/academia-teste');
    expect(loginPathFor(null)).toBe('/');
  });

  it('o login só mostra o aviso quando chega da troca de senha', () => {
    expect(readLoginArrival({ email: 'ana@academia.com', passwordReset: true }))
      .toEqual({ passwordReset: true, email: 'ana@academia.com' });
    expect(readLoginArrival({ email: 'ana@academia.com' })).toEqual({ passwordReset: false, email: '' });
    expect(readLoginArrival(null)).toEqual({ passwordReset: false, email: '' });
  });
});

describe('postResetAction', () => {
  it('manda JSON para o tenant-resolve e devolve o status e o corpo', async () => {
    const f = vi.fn(async () => ({ status: 200, json: async () => ({ ok: true }) }));
    const r = await postResetAction({ action: RESET_ACTION_REQUEST, email: 'ana@academia.com' }, f);
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(f).toHaveBeenCalledWith('/api/tenant-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: RESET_ACTION_REQUEST, email: 'ana@academia.com' }),
    });
  });

  it('corpo sem JSON vira nulo, e rede fora vira status nulo', async () => {
    expect(await postResetAction({ action: RESET_ACTION_CONFIRM }, async () => ({ status: 502, json: async () => { throw new Error('html'); } })))
      .toEqual({ status: 502, body: null });
    expect(await postResetAction({ action: RESET_ACTION_CONFIRM }, async () => { throw new Error('offline'); }))
      .toEqual({ status: null, body: null });
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/passwordReset.test.js`
Expected: FAIL, porque `../passwordReset.js` ainda não existe.

- [ ] **Step 3: escrever o módulo**

```js
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
export async function postResetAction(body, fetchImpl = globalThis.fetch) {
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
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/passwordReset.test.js`
Expected: PASS, com todos os testes do arquivo verdes.

- [ ] **Step 5: commit**

```bash
git add src/lib/passwordReset.js src/lib/__tests__/passwordReset.test.js
git commit -m "feat: regras do esqueci a senha que a tela e o servidor dividem" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: regras puras do servidor (`api/_passwordReset.js`)

**Files:**
- Create: `api/_passwordReset.js`
- Test: `api/__tests__/passwordReset.test.js`

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect } from 'vitest';
import {
  generateResetCode, hashResetCode, resetCodeMatches, accountRefusal, maskEmail,
  planIssue, planReserve, planKill, marksChanged,
} from '../_passwordReset.js';
import { RESET_CODE_TTL_MS, RESET_WINDOW_MS } from '../../src/lib/passwordReset.js';

const SEGREDO = 'segredo-de-teste';
const AGORA = 1_790_000_000_000;

const conta = (extra = {}) => ({
  uid: 'u-ana', tenantId: 'academia-teste', superAdmin: false, disabled: false,
  isMember: true, organizationActive: true, ...extra,
});

describe('generateResetCode', () => {
  it('sempre 6 números, com zero à esquerda', () => {
    expect(generateResetCode(() => 42)).toBe('000042');
    expect(generateResetCode(() => 999_999)).toBe('999999');
    for (let i = 0; i < 50; i += 1) expect(generateResetCode()).toMatch(/^\d{6}$/);
  });

  it('sorteia entre 1 milhão de combinações', () => {
    let pedido = null;
    generateResetCode((max) => { pedido = max; return 0; });
    expect(pedido).toBe(1_000_000);
  });
});

describe('impressão do código', () => {
  const hash = hashResetCode(SEGREDO, 'u-ana', '123456');

  it('é HMAC em hex e não contém o código', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('123456');
  });

  it('confere o código certo e recusa o errado', () => {
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', hash)).toBe(true);
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123457', hash)).toBe(false);
  });

  it('o mesmo código de outra conta ou com outro segredo não confere', () => {
    expect(resetCodeMatches(SEGREDO, 'u-bia', '123456', hash)).toBe(false);
    expect(resetCodeMatches('outro-segredo', 'u-ana', '123456', hash)).toBe(false);
  });

  it('impressão de outro formato nunca confere', () => {
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', 'abc')).toBe(false);
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', null)).toBe(false);
  });
});

describe('accountRefusal', () => {
  it('libera quem passaria no login', () => {
    expect(accountRefusal(conta())).toBeNull();
  });

  it('diz o motivo de cada recusa', () => {
    expect(accountRefusal(null)).toBe('unknown_email');
    expect(accountRefusal(conta({ superAdmin: true }))).toBe('superadmin');
    expect(accountRefusal(conta({ disabled: true }))).toBe('account_disabled');
    expect(accountRefusal(conta({ tenantId: null }))).toBe('no_tenant');
    expect(accountRefusal(conta({ isMember: false }))).toBe('not_member');
    expect(accountRefusal(conta({ organizationActive: false }))).toBe('organization_inactive');
  });
});

describe('maskEmail', () => {
  it('mostra só o começo e o domínio', () => {
    expect(maskEmail('ana@academia.com')).toBe('an***@academia.com');
    expect(maskEmail('a@x.com')).toBe('a***@x.com');
    expect(maskEmail('')).toBe('***');
    expect(maskEmail('sem-arroba')).toBe('***');
  });
});

describe('planIssue', () => {
  const entrada = { now: AGORA, codeHash: 'h1', tenantId: 'academia-teste', signInMark: 's1', tokensMark: 't1' };

  it('o primeiro pedido cria o código com a validade, as marcas e a hora do pedido', () => {
    expect(planIssue(null, entrada)).toEqual({
      ok: true,
      doc: {
        tenantId: 'academia-teste', codeHash: 'h1', expiresAtMs: AGORA + RESET_CODE_TTL_MS,
        attempts: 0, usedAtMs: null, signInMark: 's1', tokensMark: 't1', requestsMs: [AGORA],
      },
    });
  });

  it('o pedido novo escreve por cima do anterior e esquece os pedidos de mais de 24 horas', () => {
    const atual = { codeHash: 'h0', attempts: 3, usedAtMs: null, requestsMs: [AGORA - RESET_WINDOW_MS, AGORA - 1000] };
    const plano = planIssue(atual, entrada);
    expect(plano.ok).toBe(true);
    expect(plano.doc.codeHash).toBe('h1');
    expect(plano.doc.attempts).toBe(0);
    expect(plano.doc.requestsMs).toEqual([AGORA - 1000, AGORA]);
  });

  it('com 5 pedidos nas últimas 24 horas, recusa', () => {
    const atual = { requestsMs: [1, 2, 3, 4, 5].map((i) => AGORA - i * 1000) };
    expect(planIssue(atual, entrada)).toEqual({ ok: false, reason: 'daily_limit' });
  });
});

describe('planReserve', () => {
  const vivo = { codeHash: 'h1', expiresAtMs: AGORA + 1000, attempts: 2, usedAtMs: null, signInMark: 's1', tokensMark: 't1' };

  it('reserva a próxima tentativa e devolve o que a conferência precisa', () => {
    expect(planReserve(vivo, AGORA)).toEqual({
      ok: true, attempt: 3, patch: { attempts: 3 },
      code: { codeHash: 'h1', signInMark: 's1', tokensMark: 't1' },
    });
  });

  it('recusa sem documento e com código usado, vencido, sem impressão ou com 5 tentativas', () => {
    expect(planReserve(null, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, usedAtMs: AGORA - 1 }, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, expiresAtMs: AGORA }, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, codeHash: null }, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, attempts: 5 }, AGORA)).toEqual({ ok: false });
  });
});

describe('planKill', () => {
  it('mata só se o documento ainda tiver aquele código vivo', () => {
    expect(planKill({ codeHash: 'h1', usedAtMs: null }, 'h1', AGORA)).toEqual({ usedAtMs: AGORA });
    expect(planKill({ codeHash: 'h2', usedAtMs: null }, 'h1', AGORA)).toBeNull();
    expect(planKill({ codeHash: 'h1', usedAtMs: 5 }, 'h1', AGORA)).toBeNull();
    expect(planKill(null, 'h1', AGORA)).toBeNull();
  });
});

describe('marksChanged', () => {
  it('compara as duas marcas guardadas com as da conta', () => {
    const guardado = { signInMark: 's1', tokensMark: 't1' };
    expect(marksChanged(guardado, { signInMark: 's1', tokensMark: 't1' })).toBe(false);
    expect(marksChanged(guardado, { signInMark: 's2', tokensMark: 't1' })).toBe(true);
    expect(marksChanged(guardado, { signInMark: 's1', tokensMark: 't2' })).toBe(true);
    expect(marksChanged({ signInMark: null, tokensMark: null }, { signInMark: undefined, tokensMark: null })).toBe(false);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/passwordReset.test.js`
Expected: FAIL, porque `../_passwordReset.js` ainda não existe.

- [ ] **Step 3: escrever o módulo**

```js
import crypto from 'node:crypto';
import {
  RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS, RESET_CODES_PER_DAY, RESET_WINDOW_MS,
} from '../src/lib/passwordReset.js';

// Regras do "Esqueci a senha" que só o servidor usa: o sorteio, a impressão
// do código, quem pode receber e as contas que rodam dentro das transações.
// Sem banco e sem rede. Quem usa é o _passwordResetFlow.js e o
// _passwordResetRepo.js. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

// 6 números com zero à esquerda. O sorteio entra por parâmetro para o teste
// escolher o número.
export function generateResetCode(randomInt = (max) => crypto.randomInt(0, max)) {
  return String(randomInt(1_000_000)).padStart(6, '0');
}

// Chave só deste uso, derivada da chave privada do Admin, que já é
// obrigatória. Trocar a chave privada só mata os códigos pendentes.
function resetKey(secret) {
  return crypto.createHmac('sha256', String(secret)).update('stronilead:password-reset-code').digest();
}

// A impressão que vai para o banco. HMAC com chave do servidor, e não sha256
// puro: 6 números são só 1 milhão de combinações, e quem lesse o banco
// desfaria um sha256 em segundos. O uid na mensagem faz o mesmo código de
// duas contas dar impressões diferentes.
export function hashResetCode(secret, uid, code) {
  return crypto.createHmac('sha256', resetKey(secret)).update(`${uid}:${code}`).digest('hex');
}

export function resetCodeMatches(secret, uid, code, codeHash) {
  if (typeof codeHash !== 'string') return false;
  const esperado = Buffer.from(hashResetCode(secret, uid, code), 'hex');
  const guardado = Buffer.from(codeHash, 'hex');
  // timingSafeEqual exige o mesmo tamanho. Impressão de outro formato nunca confere.
  if (esperado.length !== guardado.length) return false;
  return crypto.timingSafeEqual(esperado, guardado);
}

// Por que esta conta não recebe código nem troca a senha, ou null quando pode.
// É o que o login deixaria entrar. O super-admin fica de fora e troca a senha
// pelo scripts/create-super-admin.js.
export function accountRefusal(account) {
  if (!account) return 'unknown_email';
  if (account.superAdmin) return 'superadmin';
  if (account.disabled) return 'account_disabled';
  if (!account.tenantId) return 'no_tenant';
  if (!account.isMember) return 'not_member';
  if (!account.organizationActive) return 'organization_inactive';
  return null;
}

// E-mail sem conta vai para o log assim, nunca inteiro.
export function maskEmail(email) {
  const s = String(email ?? '');
  const at = s.lastIndexOf('@');
  if (at < 1) return '***';
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
}

// Pedido: com 5 códigos nas últimas 24 horas, recusa. Senão devolve o
// documento novo, que escreve por cima do anterior: só o último código vale.
export function planIssue(current, { now, codeHash, tenantId, signInMark, tokensMark }) {
  const recent = (Array.isArray(current?.requestsMs) ? current.requestsMs : [])
    .filter((t) => typeof t === 'number' && now - t < RESET_WINDOW_MS);
  if (recent.length >= RESET_CODES_PER_DAY) return { ok: false, reason: 'daily_limit' };
  return {
    ok: true,
    doc: {
      tenantId,
      codeHash,
      expiresAtMs: now + RESET_CODE_TTL_MS,
      attempts: 0,
      usedAtMs: null,
      signInMark: signInMark ?? null,
      tokensMark: tokensMark ?? null,
      requestsMs: [...recent, now],
    },
  };
}

// Troca: reserva uma tentativa do código vivo e devolve o número dela. É essa
// reserva que garante no máximo 5 comparações por código.
export function planReserve(current, now) {
  if (!current || typeof current.codeHash !== 'string' || current.usedAtMs != null) return { ok: false };
  if (typeof current.expiresAtMs !== 'number' || current.expiresAtMs <= now) return { ok: false };
  const attempts = Number(current.attempts) || 0;
  if (attempts >= RESET_CODE_MAX_ATTEMPTS) return { ok: false };
  return {
    ok: true,
    attempt: attempts + 1,
    patch: { attempts: attempts + 1 },
    code: { codeHash: current.codeHash, signInMark: current.signInMark ?? null, tokensMark: current.tokensMark ?? null },
  };
}

// Mata o código só se o documento ainda tiver aquele código vivo. Assim um
// caminho atrasado nunca mata o código novo de um pedido que chegou depois.
export function planKill(current, codeHash, now) {
  if (!current || current.codeHash !== codeHash || current.usedAtMs != null) return null;
  return { usedAtMs: now };
}

// A conta mudou desde o pedido? Login novo ou sessões revogadas (troca de
// senha, suspensão da academia) mudam uma das duas marcas.
export function marksChanged(code, account) {
  return (code.signInMark ?? null) !== (account.signInMark ?? null)
    || (code.tokensMark ?? null) !== (account.tokensMark ?? null);
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run api/__tests__/passwordReset.test.js`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add api/_passwordReset.js api/__tests__/passwordReset.test.js
git commit -m "feat: regras puras do esqueci a senha no servidor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: o e-mail (`api/_passwordResetEmail.js`)

**Files:**
- Create: `api/_passwordResetEmail.js`
- Test: `api/__tests__/passwordResetEmail.test.js`

O desenho é o da prévia aprovada em 28/09/2026: fundo `#F5F7FB`, cartão branco, a marca em texto ("STRONI" e "LEAD" em `#2B59FF`), o código num quadro azul-claro (`#EAF0FF`, texto `#1C3FC4`) e o rodapé fora do cartão.

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect } from 'vitest';
import { buildResetEmail, escapeHtml } from '../_passwordResetEmail.js';

describe('buildResetEmail', () => {
  const email = buildResetEmail('Ana Souza', '048213');

  it('o código fica fora do assunto', () => {
    expect(email.subject).toBe('Seu código para criar uma senha nova no Stronilead');
    expect(email.subject).not.toMatch(/\d/);
  });

  it('o HTML e o texto levam o código, o primeiro nome, a validade e o rodapé', () => {
    for (const corpo of [email.html, email.text]) {
      expect(corpo).toContain('048213');
      expect(corpo).toContain('Olá, Ana.');
      expect(corpo).toContain('Ele vale por 15 minutos.');
      expect(corpo).toContain('Stronilead · Gestão de leads para academias');
    }
    expect(email.html).toContain('STRONI<span');
    expect(email.html).toContain('#2B59FF');
    expect(email.html).toContain('#EAF0FF');
  });

  it('nome com < ou & não quebra o HTML', () => {
    const { html } = buildResetEmail('<b>Ana</b> & Cia', '000001');
    expect(html).toContain('Olá, &lt;b&gt;Ana&lt;/b&gt;.');
    expect(html).not.toContain('<b>Ana');
  });

  it('sem nome, cumprimenta sem nome', () => {
    expect(buildResetEmail('', '000001').text.startsWith('Olá.')).toBe(true);
    expect(buildResetEmail(undefined, '000001').html).toContain('>Olá.<');
  });

  it('não tem travessão', () => {
    expect(email.html + email.text).not.toMatch(/[—–]/);
  });
});

describe('escapeHtml', () => {
  it('troca os cinco caracteres do HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/passwordResetEmail.test.js`
Expected: FAIL, porque `../_passwordResetEmail.js` ainda não existe.

- [ ] **Step 3: escrever o módulo**

```js
import { RESET_CODE_TTL_MS } from '../src/lib/passwordReset.js';

// O e-mail com o código do "Esqueci a senha". Função pura: quem manda é o
// _mail.js. O HTML vai em tabela e com o estilo no próprio elemento, porque
// cliente de e-mail não lê CSS de fora e o Outlook ignora largura em div. Por
// isso as cores aparecem em hex: são o paper-50, o brand-600, o brand-50 e o
// brand-700 do src/index.css. A marca vai em texto porque cliente de e-mail
// costuma bloquear imagem.

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || '';

export function buildResetEmail(name, code) {
  const minutos = Math.round(RESET_CODE_TTL_MS / 60_000);
  const primeiro = firstName(name);
  // O código fica fora do assunto para não aparecer na tela bloqueada do celular.
  const subject = 'Seu código para criar uma senha nova no Stronilead';
  const intro = 'Use este código para criar uma senha nova no Stronilead:';
  const aviso = `Ele vale por ${minutos} minutos. Se não foi você que pediu, ignore este e-mail. Sua senha atual continua valendo.`;
  const rodape = 'Stronilead · Gestão de leads para academias';

  const text = [
    primeiro ? `Olá, ${primeiro}.` : 'Olá.',
    '',
    intro,
    '',
    code,
    '',
    aviso,
    '',
    rodape,
  ].join('\n');

  const saudacao = primeiro ? `Olá, ${escapeHtml(primeiro)}.` : 'Olá.';
  const html = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<body style="margin:0;padding:0;background:#F5F7FB;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F7FB;">',
    '<tr><td align="center" style="padding:32px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E3E6EE;border-radius:12px;">',
    '<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0E1A40;">',
    '<p style="margin:0 0 24px;font-size:20px;letter-spacing:-0.3px;">STRONI<span style="font-weight:700;color:#2B59FF;">LEAD</span></p>',
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${saudacao}</p>`,
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${intro}</p>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">',
    `<tr><td align="center" style="background:#EAF0FF;border-radius:10px;padding:16px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#1C3FC4;">${escapeHtml(code)}</td></tr>`,
    '</table>',
    `<p style="margin:0;font-size:14px;line-height:1.6;color:#5B6477;">${aviso}</p>`,
    '</td></tr>',
    '</table>',
    `<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8A93A6;">${rodape}</p>`,
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');

  return { subject, html, text };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run api/__tests__/passwordResetEmail.test.js`
Expected: PASS

- [ ] **Step 5: conferir o visual do e-mail**

Gere o HTML num arquivo e abra no navegador do app (`mcp__Claude_Browser__preview_start` com a `url` do arquivo, ou `open` no macOS):

Run: `node --input-type=module -e "import { buildResetEmail } from './api/_passwordResetEmail.js'; import { writeFileSync } from 'node:fs'; writeFileSync('/tmp/email-codigo.html', buildResetEmail('Mariana Costa', '482913').html)" && open /tmp/email-codigo.html`
Expected: o cartão igual ao da prévia aprovada, com o código `482913` no quadro azul-claro. Apague o arquivo depois (`rm /tmp/email-codigo.html`).

- [ ] **Step 6: commit**

```bash
git add api/_passwordResetEmail.js api/__tests__/passwordResetEmail.test.js
git commit -m "feat: e-mail com o código do esqueci a senha" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: envio pelo Resend (`api/_mail.js`)

**Files:**
- Create: `api/_mail.js`
- Test: `api/__tests__/mail.test.js`

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect, vi } from 'vitest';
import { sendMail, mailStatus, MAIL_FROM_PADRAO } from '../_mail.js';

const MSG = { to: 'ana@academia.com', subject: 'Assunto', html: '<p>oi</p>', text: 'oi 123456' };
const log = () => ({ info: vi.fn() });

describe('mailStatus', () => {
  it('com a chave manda; sem a chave, desliga em produção e vai para o log fora dela', () => {
    expect(mailStatus({ apiKey: 're_x', vercelEnv: 'production' })).toBe('resend');
    expect(mailStatus({ apiKey: '', vercelEnv: 'production' })).toBe('off');
    expect(mailStatus({ apiKey: '', vercelEnv: 'preview' })).toBe('log');
    expect(mailStatus({ apiKey: '', vercelEnv: '' })).toBe('log');
  });
});

describe('sendMail', () => {
  it('monta o pedido do Resend e registra o id aceito', async () => {
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'email-1' }) }));
    const l = log();
    await sendMail(MSG, { apiKey: 're_x', from: '', vercelEnv: 'production', httpFetch, log: l });
    const [url, init] = httpFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer re_x', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      from: MAIL_FROM_PADRAO, to: ['ana@academia.com'], subject: 'Assunto', html: '<p>oi</p>', text: 'oi 123456',
    });
    expect(l.info).toHaveBeenCalledWith('E-mail aceito pelo Resend', { resendId: 'email-1' });
  });

  it('usa o MAIL_FROM quando vem preenchido', async () => {
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    await sendMail(MSG, { apiKey: 're_x', from: 'Outro <x@stronilead.com.br>', vercelEnv: 'production', httpFetch, log: log() });
    expect(JSON.parse(httpFetch.mock.calls[0][1].body).from).toBe('Outro <x@stronilead.com.br>');
  });

  it('recusa do Resend vira erro com o status e a mensagem', async () => {
    const httpFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: 'domínio não verificado' }) });
    await expect(sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log() }))
      .rejects.toThrow('O Resend recusou o e-mail (422): domínio não verificado');
  });

  it('demora vira erro com o tempo limite', async () => {
    const httpFetch = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('abortado')));
    });
    await expect(sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log(), timeoutMs: 20 }))
      .rejects.toThrow('O Resend não respondeu em 20 ms');
  });

  it('desligado, lança sem chamar o Resend', async () => {
    const httpFetch = vi.fn();
    await expect(sendMail(MSG, { apiKey: '', vercelEnv: 'production', httpFetch, log: log() }))
      .rejects.toThrow('Envio de e-mail desligado');
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('no modo log, escreve o e-mail no log e não chama o Resend', async () => {
    const httpFetch = vi.fn();
    const l = log();
    await sendMail(MSG, { apiKey: '', vercelEnv: 'preview', httpFetch, log: l });
    expect(httpFetch).not.toHaveBeenCalled();
    expect(l.info.mock.calls[0][1]).toEqual({ para: 'ana@academia.com', assunto: 'Assunto', texto: 'oi 123456' });
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/mail.test.js`
Expected: FAIL, porque `../_mail.js` ainda não existe.

- [ ] **Step 3: escrever o módulo**

```js
// Envio de e-mail transacional pela API HTTP do Resend. Hoje só o código do
// "Esqueci a senha" usa. Sem biblioteca: é um POST com JSON e tempo limite por
// AbortController. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

const RESEND_URL = 'https://api.resend.com/emails';

// Remetente quando o MAIL_FROM não vem, ou vem vazio.
export const MAIL_FROM_PADRAO = 'Stronilead <nao-responda@stronilead.com.br>';

// Como o envio está nesta função:
// - resend: tem a chave e manda de verdade.
// - off: sem a chave em produção. Quem depende de e-mail fica desligado.
// - log: sem a chave fora de produção (Preview e vercel dev). O e-mail vai
//   inteiro para o log, código incluso, para testar sem mandar nada. O
//   Preview usa o Firebase de produção: teste só com conta de academia de teste.
export function mailStatus({ apiKey = process.env.RESEND_API_KEY, vercelEnv = process.env.VERCEL_ENV } = {}) {
  if (apiKey) return 'resend';
  return vercelEnv === 'production' ? 'off' : 'log';
}

// Manda o e-mail. Lança quando o Resend recusa, demora ou a rede cai: quem
// chama decide o que fazer. Tudo que vem de fora entra por deps, com o valor
// de verdade como padrão, para o teste não sair para a rede. Os 8 segundos
// cabem no tempo máximo da função.
export async function sendMail(msg, deps = {}) {
  const {
    apiKey = process.env.RESEND_API_KEY,
    from = process.env.MAIL_FROM,
    vercelEnv = process.env.VERCEL_ENV,
    timeoutMs = 8000,
    httpFetch = (...args) => fetch(...args),
    log = console,
  } = deps;
  const status = mailStatus({ apiKey, vercelEnv });

  if (status === 'off') throw new Error('Envio de e-mail desligado: falta RESEND_API_KEY');
  if (status === 'log') {
    log.info('E-mail não enviado (sem RESEND_API_KEY). O conteúdo vai aqui no log', {
      para: msg.to, assunto: msg.subject, texto: msg.text,
    });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let resp;
  try {
    resp = await httpFetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from?.trim() || MAIL_FROM_PADRAO,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error(`O Resend não respondeu em ${timeoutMs} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    let detalhe = '';
    try {
      const corpo = await resp.json();
      if (typeof corpo?.message === 'string') detalhe = `: ${corpo.message}`;
    } catch {
      // Corpo sem JSON: fica só o status.
    }
    throw new Error(`O Resend recusou o e-mail (${resp.status})${detalhe}`);
  }

  // O id acha o e-mail no painel do Resend quando alguém disser que o código
  // não chegou.
  try {
    const corpo = await resp.json();
    if (typeof corpo?.id === 'string') log.info('E-mail aceito pelo Resend', { resendId: corpo.id });
  } catch {
    // Corpo sem JSON: o Resend já aceitou o e-mail.
  }
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run api/__tests__/mail.test.js`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add api/_mail.js api/__tests__/mail.test.js
git commit -m "feat: envio de e-mail pelo Resend" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: o fluxo do pedido e da troca (`api/_passwordResetFlow.js`)

**Files:**
- Create: `api/_passwordResetFlow.js`
- Test: `api/__tests__/passwordResetFlow.test.js`

O teste monta um banco falso em memória que usa os mesmos planejadores do repositório de verdade (Task 2), então as contas do limite diário e da reserva de tentativa rodam de verdade aqui.

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect } from 'vitest';
import { requestPasswordReset, confirmPasswordReset } from '../_passwordResetFlow.js';
import { planIssue, planReserve, planKill, hashResetCode } from '../_passwordReset.js';
import { RESET_CODE_TTL_MS, RESET_WINDOW_MS } from '../../src/lib/passwordReset.js';
import { recusaDaPolitica } from './_recusaDaPolitica.js';

const SEGREDO = 'segredo-de-teste';
const EMAIL = 'ana@academia.com';
const SENHA = 'Nova@Senha1';
const IP = '203.0.113.7';

const conta = (extra = {}) => ({
  uid: 'u-ana', tenantId: 'academia-teste', superAdmin: false, disabled: false,
  isMember: true, organizationActive: true, name: 'Ana Souza',
  signInMark: 'Sun, 28 Sep 2026 10:00:00 GMT', tokensMark: 'Sun, 28 Sep 2026 09:00:00 GMT',
  ...extra,
});

// Banco, conta, envio, relógio e sorteio falsos. As transações usam os mesmos
// planejadores do repositório de verdade, sobre um Map.
function montar(contaInicial = conta()) {
  const docs = new Map();
  const s = {
    conta: contaInicial, agora: 1_790_000_000_000, sorteios: [123456],
    enviados: [], senhas: [], revogadas: [], auditoria: [], logs: [],
    falharEnvio: false, falharSenha: null,
  };
  const deps = {
    findAccount: async (email) => (email === EMAIL ? s.conta : null),
    issueCode: async (uid, input) => {
      const plano = planIssue(docs.get(uid) ?? null, input);
      if (!plano.ok) return plano;
      docs.set(uid, plano.doc);
      return { ok: true };
    },
    reserveAttempt: async (uid, now) => {
      const atual = docs.get(uid) ?? null;
      const plano = planReserve(atual, now);
      if (!plano.ok) return { ok: false };
      docs.set(uid, { ...atual, ...plano.patch });
      return { ok: true, attempt: plano.attempt, code: plano.code };
    },
    killCode: async (uid, codeHash, now) => {
      const atual = docs.get(uid) ?? null;
      const patch = planKill(atual, codeHash, now);
      if (patch) docs.set(uid, { ...atual, ...patch });
    },
    setPassword: async (uid, senha) => {
      if (s.falharSenha) throw s.falharSenha;
      s.senhas.push({ uid, senha });
    },
    revokeSessions: async (uid) => { s.revogadas.push(uid); },
    audit: async (e) => { s.auditoria.push(e); },
    sendMail: async (msg) => {
      if (s.falharEnvio) throw new Error('Resend fora do ar');
      s.enviados.push(msg);
    },
    now: () => s.agora,
    randomInt: () => s.sorteios.shift() ?? 0,
    secret: SEGREDO,
    log: { info: (...a) => s.logs.push(a), error: (...a) => s.logs.push(a) },
  };
  return { deps, docs, s };
}

const trocar = (deps, code, extra = {}) =>
  confirmPasswordReset({ email: EMAIL, code, newPassword: SENHA, ip: IP, ...extra }, deps);

describe('pedido', () => {
  it('cria o código e manda o e-mail com o código sorteado', async () => {
    const { deps, docs, s } = montar();
    expect(await requestPasswordReset('  Ana@Academia.com ', IP, deps)).toEqual({ sent: true });
    expect(s.enviados).toHaveLength(1);
    expect(s.enviados[0].to).toBe(EMAIL);
    expect(s.enviados[0].text).toContain('123456');
    expect(s.enviados[0].text).toContain('Olá, Ana.');
    const doc = docs.get('u-ana');
    expect(doc.codeHash).toBe(hashResetCode(SEGREDO, 'u-ana', '123456'));
    expect(JSON.stringify(doc)).not.toContain('123456');
  });

  it('pedir de novo mata o anterior: só o último vale', async () => {
    const { deps, s } = montar();
    s.sorteios = [111111, 222222];
    await requestPasswordReset(EMAIL, IP, deps);
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '111111')).toEqual({ ok: false, reason: 'wrong_code' });
    expect(await trocar(deps, '222222')).toEqual({ ok: true });
  });

  it('não manda nada para quem não pode receber', async () => {
    const casos = [
      [null, 'unknown_email'],
      [conta({ superAdmin: true }), 'superadmin'],
      [conta({ disabled: true }), 'account_disabled'],
      [conta({ tenantId: null }), 'no_tenant'],
      [conta({ isMember: false }), 'not_member'],
      [conta({ organizationActive: false }), 'organization_inactive'],
    ];
    for (const [c, motivo] of casos) {
      const { deps, docs, s } = montar(c);
      expect(await requestPasswordReset(EMAIL, IP, deps), motivo).toEqual({ sent: false, reason: motivo });
      expect(s.enviados, motivo).toEqual([]);
      expect(docs.size, motivo).toBe(0);
    }
  });

  it('e-mail sem conta vai mascarado para o log', async () => {
    const { deps, s } = montar(null);
    await requestPasswordReset(EMAIL, IP, deps);
    expect(JSON.stringify(s.logs)).toContain('an***@academia.com');
    expect(JSON.stringify(s.logs)).not.toContain(EMAIL);
  });

  it('o sexto pedido do dia não manda e-mail, e depois de 24 horas libera', async () => {
    const { deps, s } = montar();
    s.sorteios = [1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < 5; i += 1) {
      expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: true });
      s.agora += 60_000;
    }
    expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: false, reason: 'daily_limit' });
    expect(s.enviados).toHaveLength(5);
    s.agora += RESET_WINDOW_MS;
    expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: true });
  });

  it('falha no envio não derruba o pedido, mata o código e continua contando no dia', async () => {
    const { deps, docs, s } = montar();
    s.falharEnvio = true;
    expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: false, reason: 'send_failed' });
    expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
    expect(docs.get('u-ana').requestsMs).toHaveLength(1);
  });
});

describe('troca', () => {
  it('código certo troca a senha, revoga as sessões, mata o código e grava a auditoria', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
    expect(s.senhas).toEqual([{ uid: 'u-ana', senha: SENHA }]);
    expect(s.revogadas).toEqual(['u-ana']);
    expect(s.auditoria).toEqual([{ uid: 'u-ana', tenantId: 'academia-teste' }]);
    expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'no_live_code' });
  });

  it('a quinta tentativa errada mata o código, e a sexta recusa até o código certo', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    for (let i = 1; i <= 4; i += 1) {
      expect(await trocar(deps, '000000')).toEqual({ ok: false, reason: 'wrong_code' });
      expect(docs.get('u-ana').usedAtMs).toBeNull();
    }
    expect(await trocar(deps, '000000')).toEqual({ ok: false, reason: 'wrong_code' });
    expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'no_live_code' });
    expect(s.senhas).toEqual([]);
  });

  it('código vencido é recusado', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.agora += RESET_CODE_TTL_MS;
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'no_live_code' });
  });

  it('login com a senha antiga ou sessões revogadas depois do pedido matam o código', async () => {
    for (const mudanca of [{ signInMark: 'Sun, 28 Sep 2026 11:00:00 GMT' }, { tokensMark: 'Sun, 28 Sep 2026 11:00:00 GMT' }]) {
      const { deps, docs, s } = montar();
      await requestPasswordReset(EMAIL, IP, deps);
      s.conta = { ...s.conta, ...mudanca };
      expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'account_changed' });
      expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
      expect(s.senhas).toEqual([]);
    }
  });

  it('código com letra ou com 5 números é recusado sem gastar tentativa', async () => {
    const { deps, docs } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '12345')).toEqual({ ok: false, reason: 'bad_format' });
    expect(await trocar(deps, '12a456')).toEqual({ ok: false, reason: 'bad_format' });
    expect(docs.get('u-ana').attempts).toBe(0);
  });

  it('conta que deixou de poder é recusada sem gastar tentativa', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.conta = { ...s.conta, organizationActive: false };
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'organization_inactive' });
    expect(docs.get('u-ana').attempts).toBe(0);
  });

  it('recusa do Firebase à senha devolve password_rejected e deixa o código vivo', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.falharSenha = recusaDaPolitica();
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'password_rejected' });
    expect(docs.get('u-ana').usedAtMs).toBeNull();
    s.falharSenha = null;
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
  });

  it('outro erro do Firebase sobe', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.falharSenha = new Error('Firebase fora do ar');
    await expect(trocar(deps, '123456')).rejects.toThrow('Firebase fora do ar');
  });

  it('falha ao marcar o código depois da troca não desfaz a troca', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    deps.killCode = async () => { throw new Error('Firestore fora do ar'); };
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
    expect(s.senhas).toHaveLength(1);
    expect(s.revogadas).toEqual(['u-ana']);
  });

  it('o código nunca vai para o log', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    await trocar(deps, '000000');
    await trocar(deps, '123456');
    expect(JSON.stringify(s.logs)).not.toContain('123456');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/passwordResetFlow.test.js`
Expected: FAIL, porque `../_passwordResetFlow.js` ainda não existe.

- [ ] **Step 3: escrever o módulo**

```js
import { normalizeEmail, isResetCodeFormat, RESET_CODE_MAX_ATTEMPTS } from '../src/lib/passwordReset.js';
import { passwordRejectedByFirebase } from '../src/lib/passwordPolicy.js';
import {
  generateResetCode, hashResetCode, resetCodeMatches, accountRefusal, maskEmail, marksChanged,
} from './_passwordReset.js';
import { buildResetEmail } from './_passwordResetEmail.js';

// O fluxo do "Esqueci a senha" (docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md).
// Tudo que toca o mundo entra por `deps`. As ações usam o realResetDeps() do
// _passwordResetRepo.js, e o teste passa versões falsas:
//   findAccount(email) → conta ou null
//   issueCode(uid, { now, codeHash, tenantId, signInMark, tokensMark }) → { ok, reason? }
//   reserveAttempt(uid, now) → { ok, attempt?, code? }
//   killCode(uid, codeHash, now)
//   setPassword(uid, password), revokeSessions(uid), audit({ uid, tenantId })
//   sendMail({ to, subject, html, text })
//   now(), randomInt(max), secret, log
// Os motivos de recusa vão para o log e nunca para a tela. O código nunca vai
// para o log.

// Quem aparece no log: o uid quando há conta, o e-mail mascarado quando não há.
const who = (account, email) => account?.uid || maskEmail(email);

export async function requestPasswordReset(email, ip, deps) {
  const target = normalizeEmail(email);
  const account = await deps.findAccount(target);
  const refusal = accountRefusal(account);
  if (refusal) {
    deps.log.info('esqueci-a-senha: pedido sem envio', { motivo: refusal, conta: who(account, target), ip });
    return { sent: false, reason: refusal };
  }

  const code = generateResetCode(deps.randomInt);
  const codeHash = hashResetCode(deps.secret, account.uid, code);
  const issued = await deps.issueCode(account.uid, {
    now: deps.now(),
    codeHash,
    tenantId: account.tenantId,
    signInMark: account.signInMark,
    tokensMark: account.tokensMark,
  });
  if (!issued.ok) {
    deps.log.info('esqueci-a-senha: pedido sem envio', { motivo: issued.reason, conta: account.uid, academia: account.tenantId, ip });
    return { sent: false, reason: issued.reason };
  }

  try {
    await deps.sendMail({ to: target, ...buildResetEmail(account.name, code) });
  } catch (err) {
    // A pessoa dona da conta não ficou sabendo do pedido: o código morre na
    // hora, e o pedido continua contando no limite do dia.
    await deps.killCode(account.uid, codeHash, deps.now());
    deps.log.error('esqueci-a-senha: envio falhou, código morto', { conta: account.uid, erro: err?.message || String(err) });
    return { sent: false, reason: 'send_failed' };
  }
  deps.log.info('esqueci-a-senha: código enviado', { conta: account.uid, academia: account.tenantId, ip });
  return { sent: true };
}

export async function confirmPasswordReset({ email, code, newPassword, ip }, deps) {
  // Código fora do formato não gasta tentativa.
  if (!isResetCodeFormat(code)) return { ok: false, reason: 'bad_format' };
  const target = normalizeEmail(email);
  const account = await deps.findAccount(target);
  const refusal = accountRefusal(account);
  if (refusal) return refuse(deps, refusal, who(account, target), ip);

  // A tentativa é reservada antes de comparar: no máximo 5 comparações por
  // código, mesmo com pedidos ao mesmo tempo. O número vem da reserva, e não
  // de uma leitura anterior, que já pode estar velha.
  const reserved = await deps.reserveAttempt(account.uid, deps.now());
  if (!reserved.ok) return refuse(deps, 'no_live_code', account.uid, ip);
  const { codeHash } = reserved.code;

  if (marksChanged(reserved.code, account)) {
    await deps.killCode(account.uid, codeHash, deps.now());
    return refuse(deps, 'account_changed', account.uid, ip);
  }
  if (!resetCodeMatches(deps.secret, account.uid, code, codeHash)) {
    if (reserved.attempt >= RESET_CODE_MAX_ATTEMPTS) await deps.killCode(account.uid, codeHash, deps.now());
    return refuse(deps, 'wrong_code', account.uid, ip);
  }

  try {
    await deps.setPassword(account.uid, newPassword);
  } catch (err) {
    // Mesma conferência do passwordRejection (api/_auth.js): o SDK entrega a
    // recusa da política como auth/internal-error. O código continua vivo.
    if (!passwordRejectedByFirebase(err)) throw err;
    deps.log.error('esqueci-a-senha: o Firebase recusou uma senha que passou em src/lib/passwordPolicy.js. Alinhe o arquivo com a política do console.', { conta: account.uid });
    return { ok: false, reason: 'password_rejected' };
  }

  // A senha já mudou. Daqui em diante, falha só vai para o log: se o código
  // não for marcado, ele morre do mesmo jeito, porque a troca muda a marca
  // tokensValidAfterTime da conta.
  await deps.killCode(account.uid, codeHash, deps.now()).catch((err) =>
    deps.log.error('esqueci-a-senha: não marcou o código como usado', { conta: account.uid, erro: err?.message || String(err) }));
  await deps.revokeSessions(account.uid).catch((err) =>
    deps.log.error('esqueci-a-senha: não revogou as sessões', { conta: account.uid, erro: err?.message || String(err) }));
  await deps.audit({ uid: account.uid, tenantId: account.tenantId });
  deps.log.info('esqueci-a-senha: senha trocada', { conta: account.uid, academia: account.tenantId, ip });
  return { ok: true };
}

function refuse(deps, reason, conta, ip) {
  deps.log.info('esqueci-a-senha: troca recusada', { motivo: reason, conta, ip });
  return { ok: false, reason };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run api/__tests__/passwordResetFlow.test.js`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add api/_passwordResetFlow.js api/__tests__/passwordResetFlow.test.js
git commit -m "feat: fluxo do pedido e da troca do esqueci a senha" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: as operações de verdade (`api/_passwordResetRepo.js`)

**Files:**
- Create: `api/_passwordResetRepo.js`
- Test: `api/__tests__/passwordResetRepo.test.js`

O teste troca o `_firebaseAdmin.js` por um banco falso com `runTransaction`, no molde do `inviteAccept.test.js`. O caminho dos cadastros da equipe é `artifacts/<academia>/public/data/stronix_users`, que o `usersCollection` de `api/_auth.js` monta.

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findAccount, issueCode, reserveAttempt, killCode, audit } from '../_passwordResetRepo.js';

const h = vi.hoisted(() => ({ usuarios: {}, tenants: {}, membros: {}, resets: {}, escritas: [], auditoria: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const ler = (caminho) => {
    if (caminho[0] === 'tenants') return h.tenants[caminho[1]];
    if (caminho[0] === '_password_reset') return h.resets[caminho[1]];
    return undefined;
  };
  const ref = (caminho, filtro = null) => ({
    caminho: caminho.join('/'),
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    limit: () => ref(caminho, filtro),
    get: async () => {
      if (filtro) {
        const lista = (h.membros[caminho[1]] || []).filter((m) => m[filtro.campo] === filtro.valor);
        return { empty: lista.length === 0, docs: lista.map((m) => ({ data: () => m })) };
      }
      const dados = ler(caminho);
      return { exists: dados != null, data: () => dados };
    },
  });
  const adminDb = {
    collection: (nome) => ref([nome]),
    runTransaction: async (fn) => fn({
      get: (r) => r.get(),
      set: (r, dados) => { h.escritas.push({ tipo: 'set', caminho: r.caminho, dados }); },
      update: (r, dados) => { h.escritas.push({ tipo: 'update', caminho: r.caminho, dados }); },
    }),
  };
  const adminAuth = {
    getUserByEmail: async (email) => {
      if (email === 'invalido') throw Object.assign(new Error('inválido'), { code: 'auth/invalid-email' });
      if (email === 'quebra@academia.com') throw new Error('Firebase fora do ar');
      if (h.usuarios[email]) return h.usuarios[email];
      throw Object.assign(new Error('não achou'), { code: 'auth/user-not-found' });
    },
  };
  return { adminDb, adminAuth, admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } } };
});
vi.mock('../_audit.js', () => ({ logAudit: async (e) => { h.auditoria.push(e); } }));
vi.mock('../_mail.js', () => ({ sendMail: async () => {} }));

const usuario = (extra = {}) => ({
  uid: 'u-ana', email: 'ana@academia.com', displayName: 'Ana do Firebase', disabled: false,
  customClaims: { tenantId: 'academia-teste' },
  metadata: { lastSignInTime: 'Sun, 28 Sep 2026 10:00:00 GMT' },
  tokensValidAfterTime: 'Sun, 28 Sep 2026 09:00:00 GMT',
  ...extra,
});

beforeEach(() => {
  h.usuarios = { 'ana@academia.com': usuario() };
  h.tenants = { 'academia-teste': { displayName: 'Academia Teste', status: 'active' } };
  h.membros = { 'academia-teste': [{ authUid: 'u-ana', email: 'ana@academia.com', name: 'Ana Souza' }] };
  h.resets = {};
  h.escritas = [];
  h.auditoria = [];
});

describe('findAccount', () => {
  it('e-mail sem conta devolve null', async () => {
    expect(await findAccount('bia@academia.com')).toBeNull();
  });

  it('monta a conta com o nome do cadastro e as duas marcas do Firebase', async () => {
    expect(await findAccount('ana@academia.com')).toEqual({
      uid: 'u-ana', tenantId: 'academia-teste', superAdmin: false, disabled: false,
      isMember: true, organizationActive: true, name: 'Ana Souza',
      signInMark: 'Sun, 28 Sep 2026 10:00:00 GMT', tokensMark: 'Sun, 28 Sep 2026 09:00:00 GMT',
    });
  });

  it('acha o cadastro pelo e-mail quando falta o authUid, como o login', async () => {
    h.membros['academia-teste'] = [{ email: 'ana@academia.com', name: 'Ana Legada' }];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(true);
    expect(c.name).toBe('Ana Legada');
  });

  it('sem cadastro na equipe, não é da equipe e fica com o nome do Firebase', async () => {
    h.membros['academia-teste'] = [];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(false);
    expect(c.name).toBe('Ana do Firebase');
  });

  it('academia suspensa ou arquivada não está ativa; teste vencido e sem documento estão', async () => {
    h.tenants['academia-teste'] = { status: 'suspended' };
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(false);
    h.tenants['academia-teste'] = { status: 'active', archived: true };
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(false);
    h.tenants['academia-teste'] = { status: 'trial' };
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(true);
    delete h.tenants['academia-teste'];
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(true);
  });

  it('super-admin e conta desativada saem com a marca certa', async () => {
    h.usuarios['ana@academia.com'] = usuario({ customClaims: { superAdmin: true } });
    expect(await findAccount('ana@academia.com')).toMatchObject({ superAdmin: true, tenantId: null });
    h.usuarios['ana@academia.com'] = usuario({ disabled: true });
    expect(await findAccount('ana@academia.com')).toMatchObject({ disabled: true });
  });

  it('e-mail que o Firebase não aceita vira null, e outro erro sobe', async () => {
    expect(await findAccount('invalido')).toBeNull();
    await expect(findAccount('quebra@academia.com')).rejects.toThrow('Firebase fora do ar');
  });
});

describe('transações no documento da conta', () => {
  const entrada = { now: 1_790_000_000_000, codeHash: 'h1', tenantId: 'academia-teste', signInMark: 's1', tokensMark: 't1' };

  it('issueCode grava o código em _password_reset/<uid>', async () => {
    expect(await issueCode('u-ana', entrada)).toEqual({ ok: true });
    expect(h.escritas).toHaveLength(1);
    expect(h.escritas[0]).toMatchObject({ tipo: 'set', caminho: '_password_reset/u-ana' });
    expect(h.escritas[0].dados).toMatchObject({ codeHash: 'h1', attempts: 0, usedAtMs: null, updatedAt: 'agora' });
  });

  it('issueCode no limite do dia não grava nada', async () => {
    h.resets['u-ana'] = { requestsMs: [1, 2, 3, 4, 5].map((i) => entrada.now - i) };
    expect(await issueCode('u-ana', entrada)).toEqual({ ok: false, reason: 'daily_limit' });
    expect(h.escritas).toEqual([]);
  });

  it('reserveAttempt soma a tentativa no código vivo', async () => {
    h.resets['u-ana'] = { codeHash: 'h1', expiresAtMs: entrada.now + 1000, attempts: 1, usedAtMs: null, signInMark: 's1', tokensMark: 't1' };
    expect(await reserveAttempt('u-ana', entrada.now))
      .toEqual({ ok: true, attempt: 2, code: { codeHash: 'h1', signInMark: 's1', tokensMark: 't1' } });
    expect(h.escritas).toEqual([{ tipo: 'update', caminho: '_password_reset/u-ana', dados: { attempts: 2, updatedAt: 'agora' } }]);
  });

  it('reserveAttempt sem código não grava nada', async () => {
    expect(await reserveAttempt('u-ana', entrada.now)).toEqual({ ok: false });
    expect(h.escritas).toEqual([]);
  });

  it('killCode só mata o código que ainda está lá', async () => {
    h.resets['u-ana'] = { codeHash: 'h1', usedAtMs: null };
    await killCode('u-ana', 'h2', entrada.now);
    expect(h.escritas).toEqual([]);
    await killCode('u-ana', 'h1', entrada.now);
    expect(h.escritas).toEqual([{ tipo: 'update', caminho: '_password_reset/u-ana', dados: { usedAtMs: entrada.now, updatedAt: 'agora' } }]);
  });

  it('audit grava password.reset com a academia e a conta', async () => {
    await audit({ uid: 'u-ana', tenantId: 'academia-teste' });
    expect(h.auditoria).toEqual([{ action: 'password.reset', tenantId: 'academia-teste', actorUid: 'u-ana', details: { via: 'codigo-por-email' } }]);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/passwordResetRepo.test.js`
Expected: FAIL, porque `../_passwordResetRepo.js` ainda não existe.

- [ ] **Step 3: escrever o módulo**

```js
import crypto from 'node:crypto';
import { adminAuth, adminDb, admin } from './_firebaseAdmin.js';
import { usersCollection } from './_auth.js';
import { logAudit } from './_audit.js';
import { sendMail } from './_mail.js';
import { planIssue, planReserve, planKill } from './_passwordReset.js';

// As operações de verdade do "Esqueci a senha": leituras, chamadas ao Firebase
// Auth e transações no documento da conta. Sem regra de negócio: as contas
// moram nos planejadores de _passwordReset.js. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

// Um documento por conta, com o uid como id: garante um código vivo só. O
// sublinhado segue o _ratelimit, que também é coleção só do servidor. As rules
// negam qualquer caminho sem regra, e esta coleção não ganha regra.
const resetDoc = (uid) => adminDb.collection('_password_reset').doc(uid);
const stamp = () => admin.firestore.FieldValue.serverTimestamp();

// A conta como a regra enxerga, ou null quando o e-mail não tem conta.
export async function findAccount(email) {
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-email') return null;
    throw err;
  }
  const claims = user.customClaims || {};
  const account = {
    uid: user.uid,
    tenantId: typeof claims.tenantId === 'string' && claims.tenantId ? claims.tenantId : null,
    superAdmin: claims.superAdmin === true,
    disabled: user.disabled === true,
    isMember: false,
    organizationActive: false,
    name: user.displayName || '',
    signInMark: user.metadata?.lastSignInTime || null,
    tokensMark: user.tokensValidAfterTime || null,
  };
  if (!account.tenantId || account.superAdmin || account.disabled) return account;

  const [tenantSnap, member] = await Promise.all([
    adminDb.collection('tenants').doc(account.tenantId).get(),
    findMember(account.tenantId, user.uid, email),
  ]);
  const tenant = tenantSnap.exists ? tenantSnap.data() || {} : null;
  // Academia sem documento (legado): o login libera, e aqui também. O par de
  // checagens é o do invite-accept e da página de indicação.
  account.organizationActive = !tenant || !(tenant.status === 'suspended' || tenant.archived === true);
  account.isMember = Boolean(member);
  if (member?.name) account.name = member.name;
  return account;
}

// O cadastro na equipe, pelos mesmos dois caminhos do login (App.jsx): o
// authUid e, no legado, o e-mail.
async function findMember(tenantId, uid, email) {
  const byUid = await usersCollection(tenantId).where('authUid', '==', uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0].data() || {};
  const byEmail = await usersCollection(tenantId).where('email', '==', email).limit(1).get();
  return byEmail.empty ? null : byEmail.docs[0].data() || {};
}

// A transação faz pedidos ao mesmo tempo da mesma conta esperarem a vez, e
// nenhum passa do limite do dia.
export async function issueCode(uid, input) {
  const ref = resetDoc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const plano = planIssue(snap.exists ? snap.data() : null, input);
    if (!plano.ok) return plano;
    tx.set(ref, { ...plano.doc, updatedAt: stamp() });
    return { ok: true };
  });
}

export async function reserveAttempt(uid, now) {
  const ref = resetDoc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const plano = planReserve(snap.exists ? snap.data() : null, now);
    if (!plano.ok) return { ok: false };
    tx.update(ref, { ...plano.patch, updatedAt: stamp() });
    return { ok: true, attempt: plano.attempt, code: plano.code };
  });
}

export async function killCode(uid, codeHash, now) {
  const ref = resetDoc(uid);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const patch = planKill(snap.exists ? snap.data() : null, codeHash, now);
    if (patch) tx.update(ref, { ...patch, updatedAt: stamp() });
  });
}

// A política de senha do console vale no updateUser. A recusa sobe para o
// fluxo, que a traduz.
export const setPassword = (uid, password) => adminAuth.updateUser(uid, { password });

// A troca de senha já revoga as sessões no Firebase. A chamada explícita deixa
// isso escrito e vale também se o Firebase mudar esse comportamento.
export const revokeSessions = (uid) => adminAuth.revokeRefreshTokens(uid);

// O log da Vercel some em 1 hora. A auditoria fica para o super-admin.
export const audit = ({ uid, tenantId }) =>
  logAudit({ action: 'password.reset', tenantId, actorUid: uid, details: { via: 'codigo-por-email' } });

// O que as ações do tenant-resolve passam para o fluxo.
export function realResetDeps() {
  return {
    findAccount,
    issueCode,
    reserveAttempt,
    killCode,
    setPassword,
    revokeSessions,
    audit,
    sendMail: (msg) => sendMail(msg),
    now: () => Date.now(),
    randomInt: (max) => crypto.randomInt(0, max),
    // A chave do HMAC sai da chave privada do Admin, que o _firebaseAdmin.js
    // já exige para subir.
    secret: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    log: console,
  };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run api/__tests__/passwordResetRepo.test.js`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add api/_passwordResetRepo.js api/__tests__/passwordResetRepo.test.js
git commit -m "feat: operações do esqueci a senha no Firebase" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sentry para erro depois da resposta (`api/_sentry.js`)

**Files:**
- Modify: `api/_sentry.js` (novo export no fim do arquivo)
- Test: `api/__tests__/sentryCaptureError.test.js`

O `withSentry` só pega o erro que sobe antes da resposta. O pedido de código roda no `waitUntil`, depois dela, e precisa de captura própria.

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), flush: vi.fn(async () => true) }));

vi.mock('@sentry/node', () => ({
  init: h.init,
  captureException: h.capture,
  flush: h.flush,
  httpIntegration: () => ({ name: 'Http' }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  h.init.mockClear();
  h.capture.mockClear();
  h.flush.mockClear();
});

describe('captureError', () => {
  it('sem DSN, não manda nada', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    const { captureError } = await import('../_sentry.js');
    await captureError(new Error('x'), { url: '/api/tenant-resolve' });
    expect(h.capture).not.toHaveBeenCalled();
  });

  it('com DSN, captura com o endpoint sem a query e espera o envio', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://chave@o1.ingest.sentry.io/1');
    const { captureError } = await import('../_sentry.js');
    const erro = new Error('Resend fora do ar');
    await captureError(erro, { url: '/api/tenant-resolve?slug=academia-teste' });
    expect(h.init).toHaveBeenCalledTimes(1);
    expect(h.capture).toHaveBeenCalledWith(erro, { tags: { endpoint: '/api/tenant-resolve' } });
    expect(h.flush).toHaveBeenCalledWith(2000);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/sentryCaptureError.test.js`
Expected: FAIL com `captureError is not a function`.

- [ ] **Step 3: acrescentar o `captureError` no fim de `api/_sentry.js`**

```js

// Captura um erro que aconteceu depois da resposta, no waitUntil, onde o
// withSentry não alcança. Sem DSN não faz nada. O flush espera o envio porque
// a função congela quando o trabalho termina.
export async function captureError(err, req) {
  start();
  if (!DSN) return;
  Sentry.captureException(err, { tags: { endpoint: endpointTag(req) } });
  await Sentry.flush(2000).catch(() => {});
}
```

- [ ] **Step 4: rodar este teste e o do Sentry que já existe**

Run: `npx vitest run api/__tests__/sentryCaptureError.test.js api/__tests__/sentry.test.js`
Expected: PASS nos dois arquivos.

- [ ] **Step 5: commit**

```bash
git add api/_sentry.js api/__tests__/sentryCaptureError.test.js
git commit -m "feat: Sentry recebe erro que acontece depois da resposta" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: as duas ações no `tenant-resolve` (`api/_passwordResetRoute.js`)

**Files:**
- Create: `api/_passwordResetRoute.js`
- Modify: `api/tenant-resolve.js` (import, comentário do topo e as linhas 40 e 41, onde o POST vai para a indicação)
- Test: `api/__tests__/passwordResetRoute.test.js`

- [ ] **Step 1: escrever o teste**

O teste chama o `handler` do `tenant-resolve` de verdade e troca o fluxo, o repositório, o envio, o limitador e o `waitUntil` por versões falsas. O fluxo já foi testado na Task 5; aqui vale o que a rota responde e quando.

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-resolve.js';
import { PASSWORD_REJECTED_ERROR } from '../../src/lib/passwordPolicy.js';
import {
  CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, TOO_MANY_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE,
} from '../../src/lib/passwordReset.js';

const h = vi.hoisted(() => ({
  limiteOk: true, chaves: [], status: 'resend', adiados: [], capturados: [],
  pedido: vi.fn(), troca: vi.fn(),
}));

vi.mock('../_firebaseAdmin.js', () => ({ adminDb: {}, adminAuth: {}, admin: {} }));
vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async (chave) => { h.chaves.push(chave); return { ok: h.limiteOk }; },
  clientIp: () => '203.0.113.7',
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => { h.adiados.push(p); } }));
vi.mock('../_mail.js', () => ({ mailStatus: () => h.status, sendMail: async () => {} }));
vi.mock('../_passwordResetFlow.js', () => ({ requestPasswordReset: h.pedido, confirmPasswordReset: h.troca }));
vi.mock('../_passwordResetRepo.js', () => ({ realResetDeps: () => ({ deps: 'de verdade' }) }));
vi.mock('../_sentry.js', async (importOriginal) => ({
  ...(await importOriginal()),
  captureError: async (err) => { h.capturados.push(err); },
}));

const post = (body) => ({ method: 'POST', headers: {}, body });
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const pedirCodigo = (email = 'ana@academia.com') => post({ action: 'password-reset-request', email });
const trocarSenha = (extra = {}) => post({
  action: 'password-reset-confirm', email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1', ...extra,
});

beforeEach(() => {
  h.limiteOk = true;
  h.chaves = [];
  h.status = 'resend';
  h.adiados = [];
  h.capturados = [];
  h.pedido.mockReset();
  h.troca.mockReset();
});

describe('POST password-reset-request', () => {
  it('responde 200 antes de o pedido terminar e entrega o trabalho ao waitUntil', async () => {
    let terminar;
    h.pedido.mockReturnValue(new Promise((r) => { terminar = r; }));
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.adiados).toHaveLength(1);
    expect(h.pedido).toHaveBeenCalledWith('ana@academia.com', '203.0.113.7', { deps: 'de verdade' });
    terminar({ sent: true });
    await h.adiados[0];
  });

  it('responde igual exista a conta ou não', async () => {
    h.pedido.mockResolvedValueOnce({ sent: true }).mockResolvedValueOnce({ sent: false, reason: 'unknown_email' });
    const a = resposta();
    const b = resposta();
    await handler(pedirCodigo('ana@academia.com'), a);
    await handler(pedirCodigo('ninguem@academia.com'), b);
    expect([a.statusCode, a.body]).toEqual([b.statusCode, b.body]);
  });

  it('erro depois da resposta vai para o Sentry e não chega à tela', async () => {
    const erro = new Error('Firestore fora do ar');
    h.pedido.mockRejectedValue(erro);
    const res = resposta();
    await handler(pedirCodigo(), res);
    await h.adiados[0];
    expect(res.statusCode).toBe(200);
    expect(h.capturados).toEqual([erro]);
  });

  it('503 com o envio desligado, sem pedir nada', async () => {
    h.status = 'off';
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: MAIL_OFF_MESSAGE });
    expect(h.pedido).not.toHaveBeenCalled();
  });

  it('429 no limite por IP, com chave própria', async () => {
    h.limiteOk = false;
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: TOO_MANY_MESSAGE });
    expect(h.chaves).toEqual(['pw-reset-request:203.0.113.7']);
  });

  it('400 para e-mail fora do formato', async () => {
    const res = resposta();
    await handler(pedirCodigo('sem-arroba'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: EMAIL_INVALID_MESSAGE });
    expect(h.pedido).not.toHaveBeenCalled();
  });
});

describe('POST password-reset-confirm', () => {
  it('200 quando troca', async () => {
    h.troca.mockResolvedValue({ ok: true });
    const res = resposta();
    await handler(trocarSenha(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.troca).toHaveBeenCalledWith(
      { email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1', ip: '203.0.113.7' },
      { deps: 'de verdade' },
    );
    expect(h.chaves).toEqual(['pw-reset-confirm:203.0.113.7']);
  });

  it('qualquer recusa de conta ou de código dá a mesma frase', async () => {
    for (const reason of ['unknown_email', 'wrong_code', 'no_live_code', 'account_changed', 'bad_format']) {
      h.troca.mockResolvedValueOnce({ ok: false, reason });
      const res = resposta();
      await handler(trocarSenha(), res);
      expect(res.statusCode, reason).toBe(400);
      expect(res.body, reason).toEqual({ error: CODE_REFUSED_MESSAGE });
    }
  });

  it('senha fora da regra volta com o campo, sem chamar o fluxo', async () => {
    const res = resposta();
    await handler(trocarSenha({ newPassword: 'fraca' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('newPassword');
    expect(res.body.error).toMatch(/^A senha precisa ter/);
    expect(h.troca).not.toHaveBeenCalled();
  });

  it('recusa do Firebase à senha volta com o campo', async () => {
    h.troca.mockResolvedValue({ ok: false, reason: 'password_rejected' });
    const res = resposta();
    await handler(trocarSenha(), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: PASSWORD_REJECTED_ERROR, field: 'newPassword' });
  });

  it('código que não é texto dá a frase única sem chamar o fluxo', async () => {
    const res = resposta();
    await handler(trocarSenha({ code: 123456 }), res);
    expect(res.body).toEqual({ error: CODE_REFUSED_MESSAGE });
    expect(h.troca).not.toHaveBeenCalled();
  });

  it('erro inesperado dá 500 com frase e vai para o Sentry', async () => {
    const erro = new Error('Firebase fora do ar');
    h.troca.mockRejectedValue(erro);
    const res = resposta();
    await handler(trocarSenha(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: SAVE_FAILED_MESSAGE });
    expect(h.capturados).toEqual([erro]);
  });

  it('429 no limite por IP', async () => {
    h.limiteOk = false;
    const res = resposta();
    await handler(trocarSenha(), res);
    expect(res.statusCode).toBe(429);
    expect(h.troca).not.toHaveBeenCalled();
  });
});

describe('o resto do POST do tenant-resolve', () => {
  it('ação desconhecida continua 405', async () => {
    const res = resposta();
    await handler(post({ action: 'outra-coisa' }), res);
    expect(res.statusCode).toBe(405);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run api/__tests__/passwordResetRoute.test.js`
Expected: FAIL. O `tenant-resolve` ainda não conhece as ações novas, então elas caem no `handleReferral` e respondem 405.

- [ ] **Step 3: escrever a rota**

`api/_passwordResetRoute.js`:

```js
import { waitUntil } from '@vercel/functions';
import { checkRateLimit, clientIp } from './_rateLimit.js';
import { mailStatus } from './_mail.js';
import { captureError } from './_sentry.js';
import { requestPasswordReset, confirmPasswordReset } from './_passwordResetFlow.js';
import { realResetDeps } from './_passwordResetRepo.js';
import { passwordPolicyError, PASSWORD_REJECTED_ERROR } from '../src/lib/passwordPolicy.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, isEmailFormat,
  CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, TOO_MANY_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE,
} from '../src/lib/passwordReset.js';

// As duas ações públicas do "Esqueci a senha", servidas pelo tenant-resolve
// para a Vercel continuar com 11 funções (o plano Hobby para em 12). Desenho
// em docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

const WINDOW_MS = 15 * 60 * 1000;

export function isPasswordResetAction(action) {
  return action === RESET_ACTION_REQUEST || action === RESET_ACTION_CONFIRM;
}

export function handlePasswordReset(req, res) {
  return req.body?.action === RESET_ACTION_REQUEST ? handleRequest(req, res) : handleConfirm(req, res);
}

async function handleRequest(req, res) {
  const ip = clientIp(req);
  // Contagem própria: não gasta a cota da marca do login nem a da indicação.
  const rl = await checkRateLimit(`pw-reset-request:${ip}`, { limit: 5, windowMs: WINDOW_MS });
  if (!rl.ok) return res.status(429).json({ error: TOO_MANY_MESSAGE });
  const email = req.body?.email;
  if (!isEmailFormat(email)) return res.status(400).json({ error: EMAIL_INVALID_MESSAGE });
  if (mailStatus() === 'off') return res.status(503).json({ error: MAIL_OFF_MESSAGE });

  // A resposta sai antes do trabalho, igual exista a conta ou não: nada que
  // dependa da conta pode vir antes desta linha, senão o tempo da resposta
  // entrega quem tem conta. O waitUntil segura a função viva até o pedido
  // terminar, e erro dali em diante vai para o log e para o Sentry.
  res.status(200).json({ ok: true });
  waitUntil(
    requestPasswordReset(email, ip, realResetDeps()).catch(async (err) => {
      console.error('esqueci-a-senha: pedido falhou', err?.message || err);
      await captureError(err, req);
    }),
  );
  return undefined;
}

async function handleConfirm(req, res) {
  const ip = clientIp(req);
  const rl = await checkRateLimit(`pw-reset-confirm:${ip}`, { limit: 10, windowMs: WINDOW_MS });
  if (!rl.ok) return res.status(429).json({ error: TOO_MANY_MESSAGE });
  const { email, code, newPassword } = req.body || {};
  // A regra da senha vem antes de tudo e não gasta tentativa.
  const problem = passwordPolicyError(newPassword);
  if (problem) return res.status(400).json({ error: problem, field: 'newPassword' });
  if (typeof email !== 'string' || typeof code !== 'string') return res.status(400).json({ error: CODE_REFUSED_MESSAGE });

  try {
    const result = await confirmPasswordReset({ email, code, newPassword, ip }, realResetDeps());
    if (result.ok) return res.status(200).json({ ok: true });
    if (result.reason === 'password_rejected') {
      return res.status(400).json({ error: PASSWORD_REJECTED_ERROR, field: 'newPassword' });
    }
    // Uma frase só para qualquer falha de conta ou de código.
    return res.status(400).json({ error: CODE_REFUSED_MESSAGE });
  } catch (err) {
    console.error('esqueci-a-senha: troca falhou', err?.message || err);
    await captureError(err, req);
    return res.status(500).json({ error: SAVE_FAILED_MESSAGE });
  }
}
```

- [ ] **Step 4: ligar as ações no `api/tenant-resolve.js`**

Acrescente o import, depois do import do `_referral.js` (linha 16):

```js
import { isPasswordResetAction, handlePasswordReset } from './_passwordResetRoute.js';
```

Troque as linhas 40 e 41:

```js
export default withSentry(async function handler(req, res) {
  if (req.method === 'POST') return handleReferral(req, res);
```

por:

```js
export default withSentry(async function handler(req, res) {
  if (req.method === 'POST') {
    // "Esqueci a senha": as duas ações públicas moram aqui, e não numa função
    // nova (docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md).
    if (isPasswordResetAction(req.body?.action)) return handlePasswordReset(req, res);
    return handleReferral(req, res);
  }
```

E no comentário do topo, logo depois do bloco que descreve a `referral-signup` (a linha que termina em "consultor herdado do CLIENTE dono do link."), acrescente:

```js
//
// ESQUECI A SENHA (docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md):
// mais duas actions POST públicas, pelo mesmo motivo do limite de funções:
//   { action:'password-reset-request', email } → sempre 200 antes do trabalho
//   { action:'password-reset-confirm', email, code, newPassword }
// Tudo mora em _passwordResetRoute.js e nos arquivos _passwordReset*.js.
```

- [ ] **Step 5: rodar os testes da rota e do GET que já existia**

Run: `npx vitest run api/__tests__/passwordResetRoute.test.js api/__tests__/tenantResolve.test.js`
Expected: PASS nos dois arquivos.

- [ ] **Step 6: conferir a conta de funções da Vercel**

Run: `ls api/*.js | grep -v '/_' | wc -l`
Expected: `11`

- [ ] **Step 7: commit**

```bash
git add api/_passwordResetRoute.js api/tenant-resolve.js api/__tests__/passwordResetRoute.test.js
git commit -m "feat: ações do esqueci a senha no tenant-resolve" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: rótulo da troca na atividade do super-admin (`src/lib/superadmin.js`)

**Files:**
- Modify: `src/lib/superadmin.js` (função `auditActionLabel`, perto da linha 50)
- Test: `src/lib/__tests__/superadminAudit.test.js`

- [ ] **Step 1: escrever o teste**

```js
import { describe, it, expect } from 'vitest';
import { auditActionLabel } from '../superadmin.js';

describe('auditActionLabel', () => {
  it('troca de senha pelo código de e-mail', () => {
    expect(auditActionLabel({ action: 'password.reset', tenantId: 'academia-teste', details: { via: 'codigo-por-email' } }))
      .toBe('Trocou a senha pelo código · academia-teste');
  });

  it('ação desconhecida continua mostrando o nome cru', () => {
    expect(auditActionLabel({ action: 'outra.coisa', tenantId: 'academia-teste' })).toBe('outra.coisa · academia-teste');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/superadminAudit.test.js`
Expected: FAIL no primeiro teste, que recebe `password.reset · academia-teste`.

- [ ] **Step 3: acrescentar o `case` antes do `default`**

Em `auditActionLabel`, troque:

```js
    default: return `${e.action} · ${t}`;
```

por:

```js
    case 'password.reset': return `Trocou a senha pelo código · ${t}`;
    default: return `${e.action} · ${t}`;
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/superadminAudit.test.js`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/superadmin.js src/lib/__tests__/superadminAudit.test.js
git commit -m "feat: atividade do super-admin mostra a troca de senha pelo código" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: moldura e campo das telas de entrada (`AuthLayout.jsx` e `AuthField.jsx`)

**Files:**
- Create: `src/views/auth/AuthLayout.jsx`, `src/views/auth/AuthField.jsx`
- Modify: `src/views/auth/LoginScreen.jsx` (reescrito com a moldura e o campo, sem mudar comportamento)
- Test: `src/lib/__tests__/authLayout.test.js`

Esta tarefa só reorganiza o login. O visual fica igual, com uma exceção: saem os dois travessões dos textos ("num só lugar. Sua equipe..." e "não encontrada. Confira o link."). O "Esqueci a senha" ainda chama o `handleForgotPassword` do Firebase; ele sai na Task 12.

- [ ] **Step 1: tirar o print de antes**

Crie `.claude/launch.json` na worktree (o arquivo já está no `.gitignore`):

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "stronilead-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--", "--port", "5199", "--strictPort"],
      "port": 5199
    }
  ]
}
```

Suba com `mcp__Claude_Browser__preview_start` (`name: "stronilead-dev"`), abra `http://localhost:5199/academia-teste` e tire três prints: desktop no tema claro, desktop no tema escuro (rode `localStorage.setItem('theme', 'dark')` pelo `javascript_tool` e recarregue) e celular (`resize_window` com `preset: "mobile"`). No `vite dev` o `/api/tenant-resolve` responde 404, então o login mostra o aviso de academia não encontrada; é esperado. Não entre com conta nenhuma: o `vite dev` fala com o Firebase de produção. Volte o tema para claro e o tamanho para `desktop` no fim.

- [ ] **Step 2: escrever o teste**

```js
// @vitest-environment jsdom
// A moldura e o campo das telas de entrada (login e "Esqueci a senha").
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { Mail } from 'lucide-react';
import { AuthLayout, AuthTenantChip } from '../../views/auth/AuthLayout.jsx';
import { AuthField, AuthInput } from '../../views/auth/AuthField.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;

async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(elemento); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

describe('AuthLayout', () => {
  it('desenha o painel, o formulário e o rodapé', async () => {
    await montar(h(AuthLayout, null, h('form', { id: 'formulario' })));
    expect(document.getElementById('formulario')).not.toBeNull();
    expect(document.body.textContent).toContain('Transforme cada lead em matrícula.');
    expect(document.body.textContent).toContain('Conexão segura · STRONILEAD © 2026');
  });

  it('o texto do painel não tem travessão', async () => {
    await montar(h(AuthLayout, null, null));
    expect(document.body.textContent).toContain('Pipeline, meta diária e agendamentos num só lugar. Sua equipe focada no que importa: fechar.');
    expect(document.body.textContent).not.toMatch(/[—–]/);
  });

  it('a etiqueta mostra o nome da academia', async () => {
    await montar(h(AuthTenantChip, { name: 'Academia Teste' }));
    expect(document.body.textContent).toContain('Academia Teste');
  });
});

describe('AuthField', () => {
  it('mostra a dica e o erro com os ids que a tela liga no input', async () => {
    await montar(h(AuthField, { label: 'E-mail', icon: Mail, hint: 'Uma dica', hintId: 'dica', error: 'Um erro', errorId: 'erro' },
      h(AuthInput, { name: 'email', 'aria-describedby': 'dica erro' })));
    expect(document.getElementById('dica').textContent).toBe('Uma dica');
    expect(document.getElementById('erro').textContent).toBe('Um erro');
    expect(document.querySelector('label').textContent).toContain('E-mail');
    expect(document.querySelector('input[name="email"]').getAttribute('aria-describedby')).toBe('dica erro');
  });

  it('sem erro nem dica, não desenha os parágrafos', async () => {
    await montar(h(AuthField, { label: 'Senha', icon: Mail }, h(AuthInput, { name: 'senha' })));
    expect(document.querySelectorAll('p')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/authLayout.test.js`
Expected: FAIL, porque os dois arquivos ainda não existem.

- [ ] **Step 4: criar `src/views/auth/AuthField.jsx`**

```jsx
import { cn } from '@/lib/utils';

// O campo das telas de entrada (login e "Esqueci a senha"): rótulo, ícone e o
// input, que vem como children, com a dica e o aviso de erro embaixo. Quem
// liga o input à dica e ao aviso é a tela, pelo aria-describedby com os ids
// hintId e errorId.
function AuthField({ label, icon: Icon, hint, hintId, error, errorId, children }) {
  return (
    <div>
      <label className="block">
        <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">{label}</span>
        <div
          className={cn(
            'mt-1.5 relative flex items-center rounded-xl border bg-white dark:bg-white/[0.03] transition border-gray-200 dark:border-white/[0.08] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15',
            error && 'border-rose-300 dark:border-rose-500/40',
          )}
        >
          <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><Icon className="size-[17px]" /></span>
          {children}
        </div>
      </label>
      {hint && <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-gray-500 dark:text-neutral-400">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-[12px] font-medium leading-snug text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

// O input das telas de entrada, com a mesma classe que o login usava.
function AuthInput({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full h-12 bg-transparent outline-none text-[14px] px-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500',
        className,
      )}
      {...props}
    />
  );
}

export { AuthField, AuthInput };
```

- [ ] **Step 5: criar `src/views/auth/AuthLayout.jsx`**

O painel é o do `LoginScreen.jsx` de hoje (linhas 84 a 153), copiado sem mudança fora a frase do travessão.

```jsx
import { Building2, Calendar, Check, Shield, TrendingUp, Zap } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Moldura das telas de entrada (login e "Esqueci a senha"): o painel azul da
// esquerda, a marca no celular e o rodapé. O formulário entra como children.
// Saiu do LoginScreen sem mudar o visual.
function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper-50 dark:bg-ink-950 text-gray-900 dark:text-white">
      {/* ===== Painel de marca (esquerda) ===== */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-950 text-white p-10 xl:p-12">
        <div className="absolute inset-0 brandgrid opacity-60" aria-hidden="true"></div>
        <div className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-brand-600/40 glow" aria-hidden="true"></div>
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-accent-500/20 glow" aria-hidden="true"></div>

        {/* topo: wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-white/10 ring-1 ring-white/15">
            <SurgeMark size={26} tone="onDark" />
          </span>
          <div>
            <StronileadWordmark className="text-[18px] text-white" leadOnDark />
            <div className="text-[11.5px] text-white/55 -mt-0.5">Gestão de leads para academias</div>
          </div>
        </div>

        {/* centro: cards flutuantes de preview */}
        <div className="relative z-10 my-8 h-[300px]">
          <div className="floaty absolute left-2 top-4 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 p-4 w-[200px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">Leads no mês</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white">1.284</span>
              <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 num inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+12%</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: '72%' }}></div>
            </div>
          </div>

          <div className="floaty2 absolute right-0 top-24 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 p-3.5 w-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">Meta diária</span>
              <span className="num text-[11px] font-bold text-brand-600 dark:text-brand-300">86%</span>
            </div>
            <div className="mt-2.5 space-y-2">
              {[['Mariana Costa', 'bg-emerald-500'], ['Bruno Tavares', 'bg-brand-500'], ['Júlia Pacheco', 'bg-accent-500']].map(([n, c], i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full grid place-items-center text-white ${c}`}><Check className="w-3 h-3" /></span>
                  <span className="text-[12px] text-slate-700 dark:text-slate-200 font-medium">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute left-6 bottom-2 floaty2 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 px-4 py-3 w-[210px]">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-accent-500/15 text-accent-500 grid place-items-center"><Calendar className="w-4 h-4" /></span>
              <div>
                <div className="num text-[18px] font-semibold text-slate-900 dark:text-white leading-none">7 visitas</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">agendadas hoje</div>
              </div>
            </div>
          </div>
        </div>

        {/* base: headline */}
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-[26px] xl:text-[30px] font-semibold leading-tight tracking-tight">
            Transforme cada lead em matrícula.
          </h2>
          <p className="mt-3 text-[14px] text-white/60 leading-relaxed">
            Pipeline, meta diária e agendamentos num só lugar. Sua equipe focada no que importa: fechar.
          </p>
          <div className="mt-6 flex items-center gap-5 text-[12px] text-white/50">
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Dados criptografados</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Pipeline em tempo real</span>
          </div>
        </div>
      </div>

      {/* ===== Formulário (direita) ===== */}
      <div className="relative flex flex-col min-h-screen lg:min-h-0 px-6 py-8 sm:px-10 bg-paper-50 dark:bg-ink-950">
        {/* wordmark mobile */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <SurgeMark size={22} />
          <StronileadWordmark className="text-[16px]" />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[380px] mx-auto rise">
            {children}
          </div>
        </div>

        <div className="pt-8 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400 dark:text-neutral-500">
          <Shield className="w-3.5 h-3.5" /> Conexão segura · STRONILEAD © 2026
        </div>
      </div>
    </div>
  );
}

// A etiqueta com o nome da academia, no topo do formulário.
function AuthTenantChip({ name }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08] px-2.5 py-1 text-[12px] font-semibold text-brand-700 dark:text-brand-300">
      <Building2 className="w-3.5 h-3.5" /> {name}
    </div>
  );
}

export { AuthLayout, AuthTenantChip };
```

- [ ] **Step 6: reescrever `src/views/auth/LoginScreen.jsx` com a moldura e o campo**

O comportamento não muda: o `handleLogin` e o `handleForgotPassword` continuam iguais. Arquivo inteiro:

```jsx
import { useState, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence } from 'firebase/auth';
import { auth, persistenceFor } from '../../lib/firebase.js';
import { AlertTriangle, ArrowRight, Check, CheckCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthLayout, AuthTenantChip } from './AuthLayout.jsx';
import { AuthField, AuthInput } from './AuthField.jsx';

function LoginScreen({ authSetupError, urlTenant }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const formRef = useRef(null);

  // Dispara a animação de shake no card do formulário ao falhar.
  const triggerShake = () => {
    const el = formRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // reflow para reiniciar a animação
    el.classList.add('shake');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setLoading(true);

    try {
      // "Manter conectado" grava no mesmo lugar que o getAuth vigia (IndexedDB),
      // senão abrir outra aba derruba esta. Desmarcado, a sessão fica só nesta
      // aba. Falha aqui não bloqueia o login.
      await persistenceFor(remember).then((p) => setPersistence(auth, p)).catch(() => {});
      const normalizedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      console.error(err);

      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('E-mail ou senha inválidos.');
      } else {
        setError('Erro ao autenticar. Verifique a configuração do Firebase Auth.');
      }
      triggerShake();
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError('');
    setResetMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Informe o e-mail antes de solicitar redefinição.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetMessage('Enviamos um link de redefinição para o e-mail informado.');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('Não há conta cadastrada para esse e-mail.');
      } else {
        setError('Não foi possível enviar o e-mail de redefinição.');
      }
    }
  };

  return (
    <AuthLayout>
      <div className="mb-7">
        {urlTenant?.found && <AuthTenantChip name={urlTenant.displayName} />}
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="text-[14px] text-gray-500 dark:text-neutral-400 mt-1.5">
          {urlTenant?.found
            ? <>Entre para acessar o painel da <span className="font-semibold text-gray-700 dark:text-neutral-200">{urlTenant.displayName}</span>.</>
            : 'Entre para acessar seu painel de vendas.'}
        </p>
        {urlTenant && urlTenant.found === false && (
          <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400">
            Academia “{urlTenant.slug}” não encontrada. Confira o link. Você ainda pode entrar normalmente.
          </p>
        )}
      </div>

      {authSetupError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-[15px] h-[15px] mt-px shrink-0" />
          <span>{authSetupError}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-[15px] h-[15px] mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {resetMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-[15px] h-[15px] mt-px shrink-0" />
          <span>{resetMessage}</span>
        </div>
      )}

      <form ref={formRef} onSubmit={handleLogin} className="space-y-4">
        <AuthField label="E-mail" icon={Mail}>
          <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@stronilead.com.br" autoComplete="username" required />
        </AuthField>

        <div>
          <AuthField label="Senha" icon={Lock}>
            <AuthInput type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            <span className="pr-2">
              <button type="button" onClick={() => setShowPass(s => !s)} title={showPass ? 'Ocultar' : 'Mostrar'} className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                {showPass ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
              </button>
            </span>
          </AuthField>
          <div className="mt-2.5 flex items-center justify-between">
            <button type="button" onClick={() => setRemember(r => !r)} className="inline-flex items-center gap-2 group">
              <span className={`w-[18px] h-[18px] rounded-[6px] grid place-items-center border transition ${remember ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-white/20 text-transparent group-hover:border-gray-400'}`}>
                <Check className="w-3 h-3" />
              </span>
              <span className="text-[12.5px] text-gray-600 dark:text-neutral-300 font-medium">Manter conectado</span>
            </button>
            <button type="button" onClick={handleForgotPassword} className="text-[12.5px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 hover:underline">
              Esqueci a senha
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] shadow-sm shadow-brand-600/20 disabled:opacity-90 disabled:cursor-default">
          {loading
            ? (<><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white spin"></span> Entrando…</>)
            : (<>Entrar <ArrowRight className="w-4 h-4" /></>)}
        </button>
      </form>

      <p className="mt-7 text-center text-[12.5px] text-gray-500 dark:text-neutral-400">
        Problemas para acessar?{' '}
        <button type="button" onClick={handleForgotPassword} className="font-semibold text-gray-700 dark:text-neutral-200 hover:underline">Recuperar acesso</button>
      </p>
    </AuthLayout>
  );
}
export { LoginScreen };
```

- [ ] **Step 7: rodar o teste e o lint dos arquivos**

Run: `npx vitest run src/lib/__tests__/authLayout.test.js && npx eslint src/views/auth/AuthLayout.jsx src/views/auth/AuthField.jsx src/views/auth/LoginScreen.jsx`
Expected: PASS e nenhum problema no lint.

- [ ] **Step 8: tirar o print de depois e comparar**

Recarregue `http://localhost:5199/academia-teste` e tire os mesmos três prints do Step 1. Eles precisam sair iguais aos de antes, fora as duas frases sem travessão. Se algo mudar de lugar, de cor ou de tamanho, compare as classes com o `LoginScreen.jsx` da main (`git show origin/main:src/views/auth/LoginScreen.jsx`) antes de seguir.

- [ ] **Step 9: commit**

```bash
git add src/views/auth/AuthLayout.jsx src/views/auth/AuthField.jsx src/views/auth/LoginScreen.jsx src/lib/__tests__/authLayout.test.js
git commit -m "refactor: moldura e campo do login saem para AuthLayout e AuthField" -m "O visual fica igual, fora os dois travessões que saem dos textos." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: a tela do "Esqueci a senha" (`ForgotPasswordScreen.jsx`)

**Files:**
- Create: `src/views/auth/ForgotPasswordScreen.jsx`
- Test: `src/lib/__tests__/forgotPasswordScreen.test.js`

Antes de escrever, invoque a skill `frontend-design`, como o `CLAUDE.md` pede para UI nova. O desenho já está decidido: a tela é igual ao login, na mesma moldura e com o mesmo campo.

- [ ] **Step 1: escrever o teste**

```js
// @vitest-environment jsdom
// A tela do "Esqueci a senha" (src/views/auth/ForgotPasswordScreen.jsx), num
// MemoryRouter e com o fetch trocado por respostas prontas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { ForgotPasswordScreen } from '../../views/auth/ForgotPasswordScreen.jsx';
import { passwordPolicyError } from '../passwordPolicy.js';
import { CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, RESET_PATH } from '../passwordReset.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MEMORIA = 'stronilead:recuperar-senha';
const ACADEMIA = { slug: 'academia-teste', displayName: 'Academia Teste' };

let root = null;
let respostas = [];
let chamadas = [];

// Fora de /recuperar-senha, mostra para onde a tela mandou e com que estado.
function Palco() {
  const loc = useLocation();
  if (loc.pathname === RESET_PATH) return h(ForgotPasswordScreen);
  return h('pre', { id: 'fora' }, JSON.stringify({ path: loc.pathname, state: loc.state ?? null }));
}

async function montar(state = null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [{ pathname: RESET_PATH, state }] }, h(Palco)));
  });
}

const lembrar = (email = 'ana@academia.com') =>
  sessionStorage.setItem(MEMORIA, JSON.stringify({ email, sentAt: Date.now() }));
const texto = () => document.body.textContent;
const campo = (nome) => document.querySelector(`input[name="${nome}"]`);
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const fora = () => JSON.parse(document.getElementById('fora').textContent);

// O React só vê a digitação pelo setter nativo mais o evento de input.
async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clicar(el) {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function preencherPasso2(code = '123456', senha = 'Nova@Senha1', repetir = senha) {
  await escrever(campo('code'), code);
  await escrever(campo('newPassword'), senha);
  await escrever(campo('confirmPassword'), repetir);
}

beforeEach(() => {
  sessionStorage.clear();
  respostas = [];
  chamadas = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    chamadas.push({ url, corpo: JSON.parse(init.body) });
    const [status, corpo] = respostas.shift() ?? [500, null];
    return { status, json: async () => corpo };
  }));
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.unstubAllGlobals();
});

describe('passo 1', () => {
  it('vem com o e-mail e a academia do login, manda o pedido e abre o passo 2', async () => {
    respostas = [[200, { ok: true }]];
    await montar({ email: 'ana@academia.com', tenant: ACADEMIA });
    expect(campo('email').value).toBe('ana@academia.com');
    expect(texto()).toContain('Academia Teste');
    await clicar(botao('Enviar código'));
    expect(chamadas).toEqual([{ url: '/api/tenant-resolve', corpo: { action: 'password-reset-request', email: 'ana@academia.com' } }]);
    expect(texto()).toContain('Criar senha nova');
    expect(texto()).toContain('Mandar outro código em 60s');
    expect(JSON.parse(sessionStorage.getItem(MEMORIA)).email).toBe('ana@academia.com');
  });

  it('sem @, avisa embaixo do campo e não manda nada', async () => {
    await montar();
    await escrever(campo('email'), 'ana');
    await clicar(botao('Enviar código'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('Digite o e-mail que você usa para entrar.');
    expect(campo('email').getAttribute('aria-describedby')).toBe('esqueci-email-erro');
  });

  it('o 503 mostra o aviso de função desligada', async () => {
    respostas = [[503, { error: MAIL_OFF_MESSAGE }]];
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(texto()).toContain(MAIL_OFF_MESSAGE);
    expect(texto()).toContain('Esqueci a senha');
  });

  it('o link de voltar leva ao login da academia', async () => {
    await montar({ email: '', tenant: ACADEMIA });
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Voltar para o login'));
    expect(link.getAttribute('href')).toBe('/academia-teste');
  });
});

describe('passo 2', () => {
  it('com a memória da aba, abre direto no passo 2', async () => {
    lembrar();
    await montar();
    expect(texto()).toContain('Criar senha nova');
    expect(texto()).toContain('ana@academia.com');
  });

  it('o código aceita colar com espaço e hífen', async () => {
    lembrar();
    await montar();
    await escrever(campo('code'), '123 45-6');
    expect(campo('code').value).toBe('123456');
  });

  it('confere o código e a senha antes de mandar', async () => {
    lembrar();
    await montar();
    await preencherPasso2('12', 'fraca');
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('Digite os 6 números do código.');
    expect(texto()).toContain(passwordPolicyError('fraca'));
  });

  it('as duas senhas precisam ser iguais', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'Nova@Senha1', 'Nova@Senha2');
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('As duas senhas não são iguais.');
  });

  it('código errado mostra a frase embaixo do campo do código e mantém a senha', async () => {
    lembrar();
    respostas = [[400, { error: CODE_REFUSED_MESSAGE }]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(chamadas[0].corpo).toEqual({ action: 'password-reset-confirm', email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1' });
    expect(document.getElementById('esqueci-codigo-erro').textContent).toBe(CODE_REFUSED_MESSAGE);
    expect(campo('code').getAttribute('aria-describedby')).toBe('esqueci-codigo-intro esqueci-codigo-erro');
    expect(campo('newPassword').value).toBe('Nova@Senha1');
  });

  it('senha recusada pelo servidor mostra a frase embaixo do campo da senha', async () => {
    lembrar();
    respostas = [[400, { error: 'O sistema recusou essa senha. Tente uma senha mais longa.', field: 'newPassword' }]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('esqueci-senha-erro').textContent).toBe('O sistema recusou essa senha. Tente uma senha mais longa.');
  });

  it('o sucesso volta para o login da academia com o e-mail e o aviso', async () => {
    lembrar();
    respostas = [[200, { ok: true }]];
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(fora()).toEqual({ path: '/academia-teste', state: { email: 'ana@academia.com', passwordReset: true } });
    expect(sessionStorage.getItem(MEMORIA)).toBeNull();
  });

  it('"Usar outro e-mail" volta ao passo 1 e apaga a memória', async () => {
    lembrar();
    await montar();
    await clicar(botao('Usar outro e-mail'));
    expect(texto()).toContain('Esqueci a senha');
    expect(sessionStorage.getItem(MEMORIA)).toBeNull();
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/forgotPasswordScreen.test.js`
Expected: FAIL, porque `ForgotPasswordScreen.jsx` ainda não existe.

- [ ] **Step 3: escrever a tela**

```jsx
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthLayout, AuthTenantChip } from './AuthLayout.jsx';
import { AuthField, AuthInput } from './AuthField.jsx';
import { PASSWORD_RULE_TEXT, passwordPolicyError } from '../../lib/passwordPolicy.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM,
  CODE_REFUSED_MESSAGE, EMAIL_INVALID_MESSAGE, MAIL_OFF_MESSAGE, SAVE_FAILED_MESSAGE, SEND_FAILED_MESSAGE, TOO_MANY_MESSAGE,
  normalizeResetCode, resendWaitSeconds, readResetEntry, readResetMemory, writeResetMemory, clearResetMemory,
  readResetApiError, postResetAction, loginPathFor,
} from '../../lib/passwordReset.js';

const TITLE = 'font-display text-[26px] font-semibold tracking-tight';
const LEAD = 'text-[14px] text-gray-500 dark:text-neutral-400 mt-1.5';
const PRIMARY = 'w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] shadow-sm shadow-brand-600/20 disabled:opacity-90 disabled:cursor-default';

// Junta os ids do aria-describedby, sem os vazios.
const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

// "Esqueci a senha". O passo 1 pede o código por e-mail e o passo 2 troca a
// senha com ele. Desenho em docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.
function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  // O login manda o e-mail digitado e a academia no estado da navegação, que
  // sobrevive ao F5. Com um envio de menos de 15 minutos nesta aba, a tela
  // volta direto ao passo 2.
  const [entry] = useState(() => readResetEntry(location.state));
  const [memory] = useState(() => readResetMemory());
  const [step, setStep] = useState(memory ? 'code' : 'email');
  const [email, setEmail] = useState(memory ? memory.email : entry.email);
  const [sentAt, setSentAt] = useState(memory ? memory.sentAt : null);
  const [now, setNow] = useState(Date.now);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const loginPath = loginPathFor(entry.tenant);
  const tenantName = entry.tenant?.displayName;

  // Relógio da contagem de "Mandar outro código". Só anda no passo 2.
  useEffect(() => {
    if (step !== 'code') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const waitSeconds = sentAt === null ? 0 : resendWaitSeconds(sentAt, now);

  // Pede o código. Serve ao passo 1 e ao "Mandar outro código".
  async function sendCode(target) {
    const r = await postResetAction({ action: RESET_ACTION_REQUEST, email: target });
    if (r.status === 200) {
      const at = Date.now();
      writeResetMemory({ email: target, sentAt: at });
      setSentAt(at);
      setNow(at);
      return true;
    }
    const err = readResetApiError(r.status, r.body);
    // No passo 2 não tem campo de e-mail para mostrar o aviso embaixo.
    if (err.status === 400 && step === 'email') setFieldErrors({ email: EMAIL_INVALID_MESSAGE });
    else if (err.status === 400) setFormError(EMAIL_INVALID_MESSAGE);
    else if (err.status === 429) setFormError(err.message || TOO_MANY_MESSAGE);
    else if (err.status === 503) setFormError(err.message || MAIL_OFF_MESSAGE);
    else setFormError(SEND_FAILED_MESSAGE);
    return false;
  }

  async function onRequest(e) {
    e.preventDefault();
    const target = email.trim();
    setFormError('');
    if (!target.includes('@')) {
      setFieldErrors({ email: 'Digite o e-mail que você usa para entrar.' });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    const ok = await sendCode(target);
    setBusy(false);
    if (!ok) return;
    setEmail(target);
    setCode('');
    setInfo('');
    setStep('code');
  }

  async function onResend() {
    setFormError('');
    setInfo('');
    setBusy(true);
    const ok = await sendCode(email);
    setBusy(false);
    if (!ok) return;
    setCode('');
    setFieldErrors({});
    setInfo('Mandamos outro código. Só o último vale.');
  }

  async function onConfirm(e) {
    e.preventDefault();
    const errors = {};
    if (code.length !== 6) errors.code = 'Digite os 6 números do código.';
    const problem = passwordPolicyError(password);
    if (problem) errors.password = problem;
    else if (confirm !== password) errors.confirm = 'As duas senhas não são iguais.';
    setFieldErrors(errors);
    setFormError('');
    setInfo('');
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    const r = await postResetAction({ action: RESET_ACTION_CONFIRM, email, code, newPassword: password });
    if (r.status === 200) {
      clearResetMemory();
      navigate(loginPath, { replace: true, state: { email, passwordReset: true } });
      return;
    }
    const err = readResetApiError(r.status, r.body);
    if (err.status === 400 && err.passwordIssue) setFieldErrors({ password: err.passwordIssue });
    else if (err.status === 400) setFieldErrors({ code: CODE_REFUSED_MESSAGE });
    else if (err.status === 429) setFormError(err.message || TOO_MANY_MESSAGE);
    else setFormError(SAVE_FAILED_MESSAGE);
    setBusy(false);
  }

  function onOtherEmail() {
    clearResetMemory();
    setStep('email');
    setSentAt(null);
    setCode('');
    setPassword('');
    setConfirm('');
    setFieldErrors({});
    setFormError('');
    setInfo('');
  }

  const header = (title, children) => (
    <div className="mb-7">
      {tenantName && <AuthTenantChip name={tenantName} />}
      <h1 className={TITLE}>{title}</h1>
      {children}
    </div>
  );

  return (
    <AuthLayout>
      {/* As keys separam os dois passos: sem elas o React reaproveitaria o
          input do e-mail no lugar do código, e o autoFocus não rodaria. */}
      {step === 'email' ? (
        <form key="email" onSubmit={onRequest} noValidate>
          {header('Esqueci a senha', (
            <p className={LEAD}>Digite o e-mail que você usa para entrar. Vamos mandar um código para você criar uma senha nova.</p>
          ))}
          <div className="flex flex-col gap-4">
            <AuthField label="E-mail" icon={Mail} error={fieldErrors.email} errorId="esqueci-email-erro">
              <AuthInput
                name="email"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@academia.com.br"
                autoComplete="username"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={describedBy(fieldErrors.email && 'esqueci-email-erro')}
              />
            </AuthField>
            <FormAlert message={formError} />
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? <><Spinner /> Enviando…</> : 'Enviar código'}
            </button>
          </div>
          <p className="mt-7 text-center text-[12.5px]">
            <Link to={loginPath} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              <ArrowLeft className="size-3.5" /> Voltar para o login
            </Link>
          </p>
        </form>
      ) : (
        <form key="code" onSubmit={onConfirm} noValidate>
          {header('Criar senha nova', (
            <>
              <p id="esqueci-codigo-intro" className={LEAD}>
                Digite o código que mandamos para <strong className="font-semibold text-gray-700 dark:text-neutral-200">{email}</strong>. Ele vale por 15 minutos e aceita até 5 tentativas.
              </p>
              <p className="mt-2 text-[12.5px] text-gray-500 dark:text-neutral-400">
                Se esse e-mail tiver conta no Stronilead, o código chega em alguns minutos. Confira também o spam.
              </p>
            </>
          ))}
          <div className="flex flex-col gap-4">
            <AuthField label="Código" icon={KeyRound} error={fieldErrors.code} errorId="esqueci-codigo-erro">
              <AuthInput
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(normalizeResetCode(e.target.value))}
                placeholder="000000"
                className="font-mono tracking-[0.3em]"
                aria-invalid={fieldErrors.code ? true : undefined}
                aria-describedby={describedBy('esqueci-codigo-intro', fieldErrors.code && 'esqueci-codigo-erro')}
              />
            </AuthField>
            <AuthField
              label="Senha nova"
              icon={Lock}
              hint={PASSWORD_RULE_TEXT}
              hintId="esqueci-senha-regra"
              error={fieldErrors.password}
              errorId="esqueci-senha-erro"
            >
              <AuthInput
                name="newPassword"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={describedBy('esqueci-senha-regra', fieldErrors.password && 'esqueci-senha-erro')}
              />
              <span className="pr-2">
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPass ? 'Ocultar' : 'Mostrar'}
                  className="size-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
                >
                  {showPass ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                </button>
              </span>
            </AuthField>
            <AuthField label="Repetir senha nova" icon={Lock} error={fieldErrors.confirm} errorId="esqueci-confirma-erro">
              <AuthInput
                name="confirmPassword"
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={fieldErrors.confirm ? true : undefined}
                aria-describedby={describedBy(fieldErrors.confirm && 'esqueci-confirma-erro')}
              />
            </AuthField>
            <FormStatus message={info} />
            <FormAlert message={formError} />
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? <><Spinner /> Salvando…</> : 'Salvar senha nova'}
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12.5px] font-semibold">
            <button
              type="button"
              onClick={onResend}
              disabled={busy || waitSeconds > 0}
              className={cn(
                'hover:underline disabled:cursor-default disabled:no-underline',
                waitSeconds > 0 ? 'text-gray-400 dark:text-neutral-500' : 'text-brand-600 dark:text-brand-400',
              )}
            >
              {waitSeconds > 0 ? `Mandar outro código em ${waitSeconds}s` : 'Mandar outro código'}
            </button>
            <button
              type="button"
              onClick={onOtherEmail}
              disabled={busy}
              className="text-gray-700 dark:text-neutral-200 hover:underline disabled:cursor-default disabled:no-underline"
            >
              Usar outro e-mail
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

// Erro que não é de um campo só. Fica sempre montado para o leitor de tela
// anunciar a troca.
function FormAlert({ message }) {
  return (
    <div
      role="alert"
      className={cn(message
        ? 'flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300'
        : 'sr-only')}
    >
      {message && <AlertTriangle className="size-[15px] mt-px shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// Aviso que não é erro, como o de código reenviado. Fica montado pelo mesmo motivo.
function FormStatus({ message }) {
  return (
    <div
      role="status"
      className={cn(message
        ? 'flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300'
        : 'sr-only')}
    >
      {message && <CheckCircle className="size-[15px] mt-px shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function Spinner() {
  return <span className="size-4 rounded-full border-2 border-white/40 border-t-white spin" />;
}

export { ForgotPasswordScreen };
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/forgotPasswordScreen.test.js`
Expected: PASS

- [ ] **Step 5: lint do arquivo**

Run: `npx eslint src/views/auth/ForgotPasswordScreen.jsx`
Expected: nenhum problema. Se o `react-hooks/purity` reclamar do `useState(Date.now)`, é o mesmo formato do `Banners.jsx`, que passa hoje: confira a versão do plugin antes de mudar o código.

- [ ] **Step 6: commit**

```bash
git add src/views/auth/ForgotPasswordScreen.jsx src/lib/__tests__/forgotPasswordScreen.test.js
git commit -m "feat: tela do esqueci a senha com os dois passos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: o login leva ao `/recuperar-senha` e o App desenha a tela

**Files:**
- Modify: `src/views/auth/LoginScreen.jsx`, `src/App.jsx` (import perto da linha 89 e o `if (!appUser)` perto da linha 1469)
- Test: `src/lib/__tests__/loginScreen.test.js`

- [ ] **Step 1: escrever o teste**

```js
// @vitest-environment jsdom
// O login leva o e-mail e a academia ao "Esqueci a senha" e mostra o aviso de
// quem volta de lá com a senha trocada. Sem Firebase de verdade.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { readFileSync } from 'node:fs';
import { LoginScreen } from '../../views/auth/LoginScreen.jsx';

vi.mock('../firebase.js', () => ({ auth: {}, persistenceFor: async () => 'local' }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn(), setPersistence: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;

// Mostra o endereço e o estado de agora, e o login fora do /recuperar-senha.
function Palco({ urlTenant }) {
  const loc = useLocation();
  return h('div', null,
    loc.pathname === '/recuperar-senha' ? null : h(LoginScreen, { urlTenant }),
    h('pre', { id: 'rota' }, JSON.stringify({ path: loc.pathname, state: loc.state ?? null })));
}

async function montar({ path = '/academia-teste', state = null, urlTenant = null } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [{ pathname: path, state }] }, h(Palco, { urlTenant })));
  });
}

const rota = () => JSON.parse(document.getElementById('rota').textContent);
const campoEmail = () => document.querySelector('input[type="email"]');
const link = (rotulo) => [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === rotulo);

async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clicar(el) {
  await act(async () => { el.click(); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

describe('volta do "Esqueci a senha"', () => {
  it('mostra o aviso, preenche o e-mail e limpa o estado da navegação', async () => {
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    expect(document.body.textContent).toContain('Senha nova salva. Entre com ela.');
    expect(document.querySelector('[role="status"]').textContent).toContain('Senha nova salva.');
    expect(campoEmail().value).toBe('ana@academia.com');
    expect(rota()).toEqual({ path: '/academia-teste', state: null });
  });

  it('sem a volta, não mostra aviso', async () => {
    await montar();
    expect(document.body.textContent).not.toContain('Senha nova salva');
  });
});

describe('links para o "Esqueci a senha"', () => {
  it('"Esqueci a senha" leva o e-mail digitado e a academia achada', async () => {
    await montar({ urlTenant: { slug: 'academia-teste', found: true, displayName: 'Academia Teste' } });
    await escrever(campoEmail(), 'bia@academia.com');
    await clicar(link('Esqueci a senha'));
    expect(rota()).toEqual({
      path: '/recuperar-senha',
      state: { email: 'bia@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } },
    });
  });

  it('"Recuperar acesso" sem academia no endereço vai sem academia', async () => {
    await montar({ path: '/' });
    await clicar(link('Recuperar acesso'));
    expect(rota()).toEqual({ path: '/recuperar-senha', state: { email: '', tenant: null } });
  });
});

describe('o login de hoje', () => {
  it('não usa mais o link de redefinição do Firebase', () => {
    const fonte = readFileSync(new URL('../../views/auth/LoginScreen.jsx', import.meta.url), 'utf8');
    expect(fonte).not.toContain('sendPasswordResetEmail');
  });

  it('não tem travessão nos textos', async () => {
    await montar({ urlTenant: { slug: 'nao-existe', found: false } });
    expect(document.body.textContent).toContain('Academia “nao-existe” não encontrada. Confira o link.');
    expect(document.body.textContent).not.toMatch(/[—–]/);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/loginScreen.test.js`
Expected: FAIL. Não há aviso de volta, os links ainda são botões e o arquivo ainda usa o `sendPasswordResetEmail`.

- [ ] **Step 3: trocar os imports do `LoginScreen.jsx`**

Troque:

```jsx
import { useState, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence } from 'firebase/auth';
```

por:

```jsx
import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { signInWithEmailAndPassword, setPersistence } from 'firebase/auth';
```

E, logo depois do import do `AuthField.jsx`, acrescente:

```jsx
import { RESET_PATH, PASSWORD_SAVED_MESSAGE, readLoginArrival, resetLinkState } from '../../lib/passwordReset.js';
```

- [ ] **Step 4: trocar o estado do aviso**

Troque:

```jsx
function LoginScreen({ authSetupError, urlTenant }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const formRef = useRef(null);
```

por:

```jsx
function LoginScreen({ authSetupError, urlTenant }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Quem volta do "Esqueci a senha" chega com o e-mail e o aviso no estado da
  // navegação. O aviso vale uma vez: o estado é limpo logo depois, para o F5
  // não repetir.
  const [arrival] = useState(() => readLoginArrival(location.state));
  const [email, setEmail] = useState(arrival.email);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(arrival.passwordReset ? PASSWORD_SAVED_MESSAGE : '');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const formRef = useRef(null);
  const arrivalCleared = useRef(false);

  useEffect(() => {
    if (!arrival.passwordReset || arrivalCleared.current) return;
    arrivalCleared.current = true;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [arrival.passwordReset, navigate, location.pathname, location.search]);
```

- [ ] **Step 5: tirar o envio de link do Firebase**

No `handleLogin`, troque `setResetMessage('');` por `setNotice('');`.

Apague a função `handleForgotPassword` inteira (do `const handleForgotPassword = async () => {` até o `};` que a fecha).

Antes do `return (`, acrescente:

```jsx
  // O "Esqueci a senha" recebe o e-mail digitado e a academia do endereço.
  const resetState = resetLinkState(email, urlTenant);
```

- [ ] **Step 6: trocar o aviso verde**

Troque:

```jsx
      {resetMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-[15px] h-[15px] mt-px shrink-0" />
          <span>{resetMessage}</span>
        </div>
      )}
```

por:

```jsx
      {notice && (
        <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-[15px] h-[15px] mt-px shrink-0" />
          <span>{notice}</span>
        </div>
      )}
```

- [ ] **Step 7: os dois botões viram links**

Troque:

```jsx
            <button type="button" onClick={handleForgotPassword} className="text-[12.5px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 hover:underline">
              Esqueci a senha
            </button>
```

por:

```jsx
            <Link to={RESET_PATH} state={resetState} className="text-[12.5px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 hover:underline">
              Esqueci a senha
            </Link>
```

E troque:

```jsx
        <button type="button" onClick={handleForgotPassword} className="font-semibold text-gray-700 dark:text-neutral-200 hover:underline">Recuperar acesso</button>
```

por:

```jsx
        <Link to={RESET_PATH} state={resetState} className="font-semibold text-gray-700 dark:text-neutral-200 hover:underline">Recuperar acesso</Link>
```

- [ ] **Step 8: o App desenha a tela nova sem sessão**

Em `src/App.jsx`, logo depois de `import { LoginScreen } from './views/auth/LoginScreen.jsx';`, acrescente:

```jsx
import { ForgotPasswordScreen } from './views/auth/ForgotPasswordScreen.jsx';
import { isPasswordResetPath } from './lib/passwordReset.js';
```

E troque:

```jsx
  if (!appUser) return <LoginScreen setAppUser={setAppUser} firebaseUser={firebaseUser} db={db} authSetupError={authSetupError} urlTenant={urlTenant} />;
```

por:

```jsx
  if (!appUser) {
    // Sem sessão, /recuperar-senha desenha o "Esqueci a senha" no lugar do
    // login (docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md). Com
    // sessão, o routeDecision já leva esse endereço para a tela inicial.
    if (isPasswordResetPath(location.pathname)) return <ForgotPasswordScreen />;
    return <LoginScreen setAppUser={setAppUser} firebaseUser={firebaseUser} db={db} authSetupError={authSetupError} urlTenant={urlTenant} />;
  }
```

O `/recuperar-senha` já é palavra reservada: o `loginTenantSlug` devolve `null` para ele, então a tela não chama o `/api/tenant-resolve` para buscar marca, e quem está logado vai para a própria tela inicial sem aviso (conferido em 28/09/2026 com o `parseAppPath` e o `routeDecision`).

- [ ] **Step 9: rodar os testes das telas e as varreduras que olham o `App.jsx`**

Run: `npx vitest run src/lib/__tests__/loginScreen.test.js src/lib/__tests__/forgotPasswordScreen.test.js src/lib/__tests__/authLayout.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/tenantSlug.test.js src/lib/__tests__/routes.test.js`
Expected: PASS em todos.

- [ ] **Step 10: lint dos arquivos**

Run: `npx eslint src/views/auth/LoginScreen.jsx src/App.jsx`
Expected: nenhum problema novo. O aviso de `exhaustive-deps` que já existia fica onde está.

- [ ] **Step 11: conferir no navegador**

Com o `stronilead-dev` no ar (Task 10), abra `http://localhost:5199/academia-teste`, clique em "Esqueci a senha" e confira o passo 1 com o e-mail que você digitou no login. O "Enviar código" mostra "Não deu para enviar agora. Tente de novo.", porque o `vite dev` responde 404 no `/api`. Para ver o passo 2, rode pelo `javascript_tool`:

```js
sessionStorage.setItem('stronilead:recuperar-senha', JSON.stringify({ email: 'ana@academia.com', sentAt: Date.now() })); location.reload();
```

Confira nos temas claro e escuro, e no celular (`preset: "mobile"`): a regra da senha embaixo do campo, a contagem do "Mandar outro código", o "Usar outro e-mail" e o botão de mostrar a senha. Volte o tema e o tamanho no fim.

- [ ] **Step 12: commit**

```bash
git add src/views/auth/LoginScreen.jsx src/App.jsx src/lib/__tests__/loginScreen.test.js
git commit -m "feat: login leva ao esqueci a senha e mostra o aviso da senha nova" -m "Sai o link de redefinição do Firebase." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: documentação (`CLAUDE.md` e `.env.example`)

**Files:**
- Modify: `CLAUDE.md` (linha da regra de senha em "Convenções gerais" e uma seção nova no fim), `.env.example` (seção nova no fim)

- [ ] **Step 1: a regra de senha ganha o quinto caminho**

Em "Convenções gerais" do `CLAUDE.md`, troque:

```
os quatro caminhos que gravam senha pelo servidor conferem antes e traduzem a recusa (`passwordRejection`, em `api/_auth.js`), e o `scripts/create-super-admin.js` confere com a mesma regra.
```

por:

```
os quatro caminhos que gravam senha pelo servidor conferem antes e traduzem a recusa (`passwordRejection`, em `api/_auth.js`), o "Esqueci a senha" faz o mesmo no fluxo dele (`passwordRejectedByFirebase`, em `api/_passwordResetFlow.js`), e o `scripts/create-super-admin.js` confere com a mesma regra.
```

- [ ] **Step 2: seção nova no fim do `CLAUDE.md`**

```markdown

## Esqueci a senha

Quem esquece a senha pede um código de 6 números por e-mail na tela de login e cria a senha nova sem depender do gestor. Spec em `docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md`, no padrão do "Esqueci a senha" do Stronizap.

- **A tela mora em `/recuperar-senha`** (`src/views/auth/ForgotPasswordScreen.jsx`), palavra já reservada em `RESERVED_TENANT_SLUGS`. Sem sessão, o `AppInner` desenha a tela no lugar do login (`isPasswordResetPath`). O login leva o e-mail e a academia no estado da navegação, e a volta traz o aviso "Senha nova salva. Entre com ela.", que o login mostra uma vez e limpa. O login e a tela dividem a moldura (`AuthLayout.jsx`) e o campo (`AuthField.jsx`).
- **O servidor são duas ações do `api/tenant-resolve.js`** (`password-reset-request` e `password-reset-confirm`), para a Vercel continuar com 11 funções. A rota fica em `api/_passwordResetRoute.js`; o fluxo, em `api/_passwordResetFlow.js`, com tudo que toca o mundo em `deps`; as contas puras, em `api/_passwordReset.js`; as operações de verdade, em `api/_passwordResetRepo.js`; o envio, em `api/_mail.js`; e o e-mail, em `api/_passwordResetEmail.js`. O que a tela e o servidor dividem mora em `src/lib/passwordReset.js`.
- **Regras que não se afrouxam:**
  - o pedido responde 200 igual para todo mundo, e a resposta sai antes do trabalho, pelo `waitUntil` do `@vercel/functions`. Nada que dependa da conta pode vir antes da resposta, senão o tempo dela entrega quem tem conta;
  - o super-admin não recebe código. Ele troca a senha pelo `scripts/create-super-admin.js`;
  - o banco guarda só o HMAC do código, em `_password_reset/{uid}`, com a chave derivada da `FIREBASE_ADMIN_PRIVATE_KEY`. A coleção não tem regra nas rules, então o navegador não lê nem escreve nela;
  - a tentativa é reservada em transação antes de comparar, e a quinta errada mata o código;
  - a troca tem uma frase só para qualquer falha de conta ou de código.
- **O código morre sozinho** quando o `lastSignInTime` ou o `tokensValidAfterTime` da conta mudam depois do pedido: login com a senha antiga, senha trocada pelo gestor, sessões revogadas. O "Acessar como" do super-admin entra na conta do gestor e também mata o código.
- **O e-mail sai pelo Resend**, de `nao-responda@stronilead.com.br`. O DNS do `stronilead.com.br` é o da Vercel, não o da Hostinger, e os registros do Resend moram lá: DKIM em `resend._domainkey`, MX e SPF em `send` e DMARC em `_dmarc`. A `RESEND_API_KEY` fica só em Production. Sem ela em produção, a ação responde 503 e a tela avisa que a função está desligada. No Preview, sem a chave, o e-mail inteiro vai para o log da Vercel, código incluso, para testar. O Preview usa o Firebase de produção: teste só com conta de academia de teste.
- **As sessões abertas caem em até 1 hora.** A troca revoga as sessões, as chamadas ao `api/` param na hora, porque o `verifyRequest` confere a revogação, e as telas abertas voltam ao login quando o token vence.
```

- [ ] **Step 3: seção nova no fim do `.env.example`**

```bash

# ---- E-mail transacional (Resend) ----------------------------------
# Código do "Esqueci a senha". SEGREDO, só no backend. Na Vercel fica só em
# Production. Sem ela em produção a redefinição por e-mail fica desligada (a
# tela avisa); no Preview, o e-mail inteiro vai para o log, para testar.
RESEND_API_KEY=

# Opcional. Sem valor, o remetente é Stronilead <nao-responda@stronilead.com.br>.
MAIL_FROM=
```

- [ ] **Step 4: conferir que não entrou travessão**

Run: `git diff CLAUDE.md .env.example | grep '^+' | grep -c '[—–]'`
Expected: `0`

- [ ] **Step 5: commit**

```bash
git add CLAUDE.md .env.example
git commit -m "docs: esqueci a senha no CLAUDE.md e no .env.example" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: verificação final

**Files:** nenhum, a não ser que algo falhe.

- [ ] **Step 1: suíte inteira**

Run: `npx vitest run 2>&1 | tail -4`
Expected: tudo verde, com os 12 arquivos novos somados à linha de base (132 arquivos, se a base era 120).

- [ ] **Step 2: lint**

Run: `npm run lint 2>&1 | tail -2`
Expected: `✖ 1 problem (0 errors, 1 warning)`, o mesmo aviso da linha de base.

- [ ] **Step 3: build**

Run: `npm run build 2>&1 | tail -5`
Expected: build sem erro.

- [ ] **Step 4: vazamento no Sentry**

Run: `npm run verificar:sentry`
Expected: passa, como na main.

- [ ] **Step 5: conta de funções da Vercel**

Run: `ls api/*.js | grep -v '/_' | wc -l`
Expected: `11`

- [ ] **Step 6: nenhum travessão nos textos novos**

Run: `git diff origin/main --unified=0 -- src api | grep '^+' | grep -c '[—–]'`
Expected: `0`

- [ ] **Step 7: revisão do código**

Rode a skill `superpowers:requesting-code-review` sobre a branch. Corrija o que for de verdade e rode de novo os passos 1 e 2.

---

### Task 15: PR, teste no Preview e produção

**Files:** nenhum no código. No fim, o `CLAUDE.md` da raiz da STRONIX-FIRMA e a memória.

- [ ] **Step 1: pedir o ok do Johnny para subir a branch**

Suba só com o ok:

```bash
git push -u origin claude/stornilead-password-reset-3a5056
```

- [ ] **Step 2: abrir o PR**

Escreva o corpo em `/tmp/pr-esqueci-a-senha.md`, trocando `<N>` pelo número de testes da Task 14. Sem senha nem código de verdade no texto.

```markdown
## O que muda

- "Esqueci a senha" e "Recuperar acesso", no login, abrem a tela nova `/recuperar-senha`. A pessoa pede um código de 6 números por e-mail, digita o código com a senha nova e volta para o login com o e-mail preenchido e o aviso "Senha nova salva. Entre com ela.".
- O código vale 15 minutos e aceita 5 tentativas. Cada conta recebe no máximo 5 códigos por dia, e só o último vale.
- O e-mail sai de `nao-responda@stronilead.com.br`, pelo Resend. O link de redefinição do Firebase sai do app.
- O super-admin não recebe código e continua com o `scripts/create-super-admin.js`.
- As duas ações moram no `api/tenant-resolve.js`, então a Vercel continua com 11 funções.

Spec em `docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md` e plano em `docs/superpowers/plans/2026-09-28-esqueci-a-senha.md`.

## Antes do merge

- [ ] Domínio `stronilead.com.br` verificado no Resend (registros publicados no DNS da Vercel em 28/09/2026)
- [x] `RESEND_API_KEY` na Vercel, só em Production (cadastrada em 28/09/2026)
- [ ] Testes no Preview, na lista abaixo

## Testes

- Suíte com <N> testes verdes, lint sem erro novo, build e `verificar:sentry` passando.
- No Preview, com conta de academia de teste e o código lido no log da Vercel:
  - [ ] pedir o código, trocar a senha e entrar com ela
  - [ ] a quinta tentativa errada mata o código
  - [ ] o sexto pedido do dia não manda e-mail
  - [ ] entrar com a senha antiga depois do pedido mata o código
  - [ ] a troca de senha pelo gestor depois do pedido mata o código
  - [ ] F5 no passo 2
  - [ ] a outra aba aberta perde o acesso ao `api/` depois da troca
  - [ ] o pedido termina depois da resposta (o `waitUntil` segura a função)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

```bash
gh pr create --base main --title "Esqueci a senha por código no e-mail" --body-file /tmp/pr-esqueci-a-senha.md
```

Depois de abrir, ligue o PR a esta sessão com as ferramentas `ccd_pr` (`get_status` e, se ele não aparecer, `bind_pr`).

- [ ] **Step 3: testar no Preview, sem a chave (modo `log`)**

Use uma conta de academia de teste, nunca de cliente: o Preview fala com o Firebase de produção. Para ler o código, rode no checkout principal (`/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead`):

```bash
vercel logs --environment preview --since 30m --query "E-mail não enviado" --expand
```

Confira, marcando cada um:
- pedir o código, pegar no log, trocar a senha e entrar com ela;
- errar o código 5 vezes e ver a sexta recusar até o código certo;
- pedir 6 códigos para a mesma conta e ver que o sexto não sai (a linha `daily_limit` no log);
- pedir o código, entrar pelo login com a senha antiga e ver o código recusado;
- pedir o código, o gestor trocar a senha em Equipe & acessos e ver o código recusado;
- F5 no passo 2;
- com uma sessão aberta em outra aba, trocar a senha e ver uma chamada ao `api/` dessa aba ser recusada;
- no log, a linha "código enviado" aparece depois da resposta do pedido: é o `waitUntil` segurando a função.

- [ ] **Step 4: antes do merge**

Confirme com o Johnny que o domínio `stronilead.com.br` aparece como verificado no painel do Resend. Sem isso, o Resend recusa o envio e o código morre a cada pedido.

- [ ] **Step 5: merge**

Só o Johnny aprova o merge. A Vercel publica sozinha. Nada vai para o console do Firebase, as rules ou os índices.

- [ ] **Step 6: conferir em produção**

Peça um código para uma conta de gestor, não do super-admin, e confira que o e-mail chega na caixa de entrada, não no spam. O id do envio aparece no log de produção (`vercel logs --environment production --since 30m --query "Resend" --expand`) e no painel do Resend.

- [ ] **Step 7: registrar**

- No `CLAUDE.md` da raiz da STRONIX-FIRMA, uma linha em "Últimas Atualizações" com a data, o PR e o que mudou para quem usa.
- Uma memória do projeto (`esqueci-a-senha-stronilead.md`) com o estado, os PRs e o que ficou de fora, e a linha no `MEMORY.md`.
