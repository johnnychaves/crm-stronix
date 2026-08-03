# App Check em modo monitoramento — Plano de Implementação (PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir o Firebase App Check com reCAPTCHA Enterprise carimbando toda requisição ao Firebase, **sem bloquear nada**, para que o painel acumule a métrica que vai sustentar a decisão de ligar o bloqueio depois.

**Architecture:** Um módulo `src/lib/appCheck.js` que inicializa o App Check e devolve `null` em silêncio quando falta o site key ou quando a inicialização falha. Ele é chamado por `src/lib/firebase.js` imediatamente depois do `initializeApp` e **antes** de `getAuth` e do Firestore, porque requisição que sai antes do App Check subir entra na métrica como não verificada e envenenaria a decisão de bloqueio.

**Tech Stack:** Firebase JS SDK v12 (`firebase/app-check`), reCAPTCHA Enterprise, Vite 8.

**Spec:** `docs/superpowers/specs/2026-08-03-seguranca-appcheck-sentry-design.md`

**Pré-requisito:** o PR 1 (Sentry) deve estar em produção e assentado. Se algo neste PR degradar o boot, o Sentry é quem vai contar.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/appCheck.js` | **Novo.** Inicializa o App Check; degrada em silêncio quando não configurado. |
| `src/lib/__tests__/appCheck.test.js` | **Novo.** Garante a degradação silenciosa e os argumentos do provider. |
| `src/lib/firebase.js` | Chama `initAppCheck(app)` entre `initializeApp` e `getAuth`. |
| `.env.example` | Site key e token de debug. |
| `docs/APPCHECK_SETUP.md` | **Novo.** Roteiro dos passos de console e do rollout do bloqueio. |

---

## Task 1: Módulo do App Check

**Files:**
- Create: `src/lib/appCheck.js`
- Test: `src/lib/__tests__/appCheck.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/appCheck.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O SDK do Firebase é mockado: o que interessa testar é a nossa decisão de
// inicializar ou não, e com quais argumentos. A implementação do Google não.
const initializeAppCheck = vi.fn(() => ({ fake: 'appcheck' }));
class ReCaptchaEnterpriseProvider {
  constructor(key) { this.key = key; }
}

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args) => initializeAppCheck(...args),
  ReCaptchaEnterpriseProvider,
}));

const FAKE_APP = { name: 'fake' };

describe('initAppCheck', () => {
  beforeEach(() => {
    initializeAppCheck.mockClear();
    delete globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('nao inicializa quando falta o site key', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', '');
    vi.resetModules();
    const { initAppCheck } = await import('../appCheck.js');

    expect(initAppCheck(FAKE_APP)).toBe(null);
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });

  it('inicializa com o provider Enterprise quando o site key existe', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'chave-de-teste');
    vi.resetModules();
    const { initAppCheck } = await import('../appCheck.js');

    expect(initAppCheck(FAKE_APP)).toEqual({ fake: 'appcheck' });
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);

    const [appArg, options] = initializeAppCheck.mock.calls[0];
    expect(appArg).toBe(FAKE_APP);
    expect(options.provider.key).toBe('chave-de-teste');
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
  });

  it('devolve null e nao derruba o boot quando a inicializacao falha', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'chave-de-teste');
    vi.resetModules();
    initializeAppCheck.mockImplementationOnce(() => { throw new Error('boom'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { initAppCheck } = await import('../appCheck.js');
    expect(initAppCheck(FAKE_APP)).toBe(null);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/appCheck.test.js`
Expected: FAIL, `Failed to resolve import "../appCheck.js"`

- [ ] **Step 3: Implementar**

Criar `src/lib/appCheck.js`:

```js
// Firebase App Check: carimba toda requisição ao Firebase provando que ela
// nasceu no app legítimo. Cobre o Auth e o Firestore, inclusive a chamada
// direta à API de login, que é o furo que um CAPTCHA no formulário não fecha.
//
// Este módulo sobe o App Check em MODO MONITORAMENTO. Ele não bloqueia nada:
// quem decide bloquear é o enforcement no console do Firebase, ligado depois,
// com métrica na mão. Ver docs/APPCHECK_SETUP.md.

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const env = import.meta.env || {};
const SITE_KEY = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';
const DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || '';

export function initAppCheck(app) {
  // Sem site key o App Check não sobe e o app funciona igual a hoje. É o botão
  // de desligar: basta remover a variável na Vercel e redeployar.
  if (!SITE_KEY) return null;

  // O token de debug PRECISA ser setado antes do initializeAppCheck, senão o
  // SDK já tentou atestar e falhou. Sem isso, no dia em que o bloqueio for
  // ligado, o `npm run dev` para de conversar com o Firebase.
  if (env.DEV) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN || true;
  }

  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Falha aqui não pode derrubar o boot. Em modo monitoramento o custo é só
    // aparecer como não verificado na métrica.
    console.warn('App Check: falhou ao inicializar, seguindo sem atestação.', err);
    return null;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/appCheck.test.js`
Expected: PASS, 3 testes

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: `Tests  585 passed (585)` (582 após o PR 1, mais 3)

- [ ] **Step 6: Commit**

```bash
git add src/lib/appCheck.js src/lib/__tests__/appCheck.test.js && git commit -m "feat: modulo do App Check com degradacao silenciosa"
```

---

## Task 2: Ligar o App Check no boot do Firebase

A ordem é o ponto crítico do PR inteiro.

**Files:**
- Modify: `src/lib/firebase.js`

- [ ] **Step 1: Acrescentar o import**

No topo de `src/lib/firebase.js`, junto dos outros imports:

```js
import { initAppCheck } from './appCheck.js';
```

- [ ] **Step 2: Chamar entre o initializeApp e o getAuth**

Antes:

```js
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
```

Depois:

```js
const app = initializeApp(firebaseConfig);

// ANTES do getAuth e do Firestore, de propósito. Requisição que sai antes do
// App Check subir vai para a métrica como NÃO verificada, e é justamente essa
// métrica que decide se dá para ligar o bloqueio. Ordem errada aqui produz um
// número falso na decisão mais perigosa do projeto.
initAppCheck(app);

export const auth = getAuth(app);
```

- [ ] **Step 3: Conferir build e testes**

Run: `npm run build && npm test`
Expected: build conclui; `Tests  585 passed (585)`

- [ ] **Step 4: Conferir que o app sobe sem site key**

Run: `npm run dev`
Expected: o app carrega e loga normalmente, sem erro novo no console. Sem `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` no `.env.local`, o App Check nem tenta subir.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase.js && git commit -m "feat: liga o App Check antes do Auth e do Firestore"
```

---

## Task 3: Variáveis de ambiente

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Acrescentar ao final do `.env.example`**

```
# ---- Firebase App Check (atestação do app) -------------------------
# Site key do reCAPTCHA Enterprise, criada no Google Cloud e registrada no
# console do Firebase. Valor PÚBLICO (embarca no bundle).
# Sem esta chave o App Check NÃO sobe e o app funciona igual a hoje.
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=

# Só para ambiente local. Gere o token pelo console do navegador na primeira
# execução em dev e registre-o no console do Firebase, em App Check → Apps →
# Manage debug tokens. Sem isso, no dia em que o bloqueio for ligado, o
# `npm run dev` para de conversar com o Firebase.
VITE_APPCHECK_DEBUG_TOKEN=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example && git commit -m "docs: variaveis de ambiente do App Check"
```

---

## Task 4: Roteiro de console

O código é a menor parte deste PR. O que fecha a brecha de verdade são os passos abaixo, e eles só o Johnny pode dar.

**Files:**
- Create: `docs/APPCHECK_SETUP.md`

- [ ] **Step 1: Criar o documento**

Criar `docs/APPCHECK_SETUP.md` com o conteúdo abaixo:

````markdown
# App Check — configuração e rollout do bloqueio

O código sobe o App Check em **modo monitoramento**: ele carimba as requisições
e não bloqueia nada. Bloquear é decisão de console, tomada depois, com métrica.

## 1. Criar a chave do reCAPTCHA Enterprise

1. Google Cloud Console, projeto `crm-stronix`
2. Habilitar a API **reCAPTCHA Enterprise**
3. Criar uma chave **baseada em score, para sites**
4. Cadastrar os domínios: o de produção e o de preview da Vercel
5. Copiar o site key

**Se pedir para habilitar faturamento:** o reCAPTCHA Enterprise é produto pago
do Google Cloud e pode exigir plano Blaze. Duas saídas:

- Habilitar o Blaze. A cota gratuita é de 10.000 verificações por mês, e o token
  renova a cada 12h, ou seja, cerca de 2 verificações por usuário por dia. Com
  50 usuários ativos dá cerca de 3.000 por mês, folgado dentro do gratuito.
- Ou trocar para o reCAPTCHA v3 comum, que é grátis e não exige faturamento. A
  troca é de uma linha em `src/lib/appCheck.js`: importar `ReCaptchaV3Provider`
  no lugar de `ReCaptchaEnterpriseProvider` e usar a site key do v3. Nada mais
  no desenho muda.

## 2. Registrar no Firebase

1. Console do Firebase, App Check, aba Apps
2. Registrar o app web com o provider reCAPTCHA Enterprise e colar o site key
3. **Deixar o enforcement DESLIGADO** em todos os produtos

## 3. Configurar a Vercel

Cadastrar `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` em Production e Preview, e
redeployar.

## 4. Token de debug para o ambiente local

Na primeira execução do `npm run dev` depois disso, o console do navegador
imprime um token de debug. Registrar em App Check, Apps, Manage debug tokens, e
guardar em `.env.local` como `VITE_APPCHECK_DEBUG_TOKEN`.

Sem esse passo, no dia em que o bloqueio for ligado o ambiente local para de
conversar com o Firebase.

## 5. Rollout do bloqueio

```
deploy  →  monitorar 3 a 7 dias  →  bloquear Firestore  →  observar  →  bloquear Auth
```

Cada degrau só avança com o painel do App Check mostrando praticamente 100% de
requisições verificadas.

**Fatia teimosa de não verificadas significa usuário real falhando a atestação.**
Nesse caso parar e investigar, não bloquear. O enforcement sobre o Firebase Auth
ainda está marcado como *preview* pelo Google, então esse é o degrau que merece
mais paciência.

**Reversão, em qualquer ponto:** desligar o enforcement no console. Sem deploy.
Se for preciso desligar o App Check inteiro, remover a variável de ambiente na
Vercel e redeployar.

## 6. Ganhos de console independentes deste PR

Grátis, um clique cada, no console do Firebase, em Authentication, Settings:

- **Proteção contra enumeração de e-mail.** Hoje dá para descobrir quais e-mails
  têm conta no sistema testando o formulário de recuperação de senha.
- **Política de senha mínima.**
````

- [ ] **Step 2: Commit**

```bash
git add docs/APPCHECK_SETUP.md && git commit -m "docs: roteiro de console e rollout do App Check"
```

---

## Task 5: Verificação ao vivo

- [ ] **Step 1: Confirmar que as requisições estão sendo carimbadas**

No deploy de preview, com o site key configurado, navegar pelo app logado. No
console do Firebase, App Check, o painel precisa mostrar requisições chegando na
coluna de **verificadas**.

- [ ] **Step 2: Cobrir os três caminhos que costumam escapar**

- Desktop, sessão normal
- Mobile
- **Impersonação do superadmin.** Esse caminho troca de identidade em tempo de
  execução e é o mais provável de se comportar diferente. Entrar "como" uma
  academia pelo SuperConsole e confirmar que as requisições seguem verificadas.

- [ ] **Step 3: Confirmar que o ambiente local continua funcionando**

Run: `npm run dev`
Expected: app carrega, login funciona, sem erro novo no console

- [ ] **Step 4: Abrir o PR**

O PR sobe o código em monitoramento. Ligar o bloqueio é passo separado, feito no
console depois de alguns dias de métrica, seguindo `docs/APPCHECK_SETUP.md`.

---

## Self-review deste plano

**Cobertura do spec:** as três peças do PR 2 no spec (`src/lib/appCheck.js`,
`src/lib/firebase.js`, `docs/APPCHECK_SETUP.md`) têm task correspondente. Os
cinco passos de console do spec estão na Task 4, incluindo os dois ganhos de
console soltos. O rollout em degraus está na Task 4. Os três caminhos de teste
que o spec pede, incluindo a impersonação, estão na Task 5.

**Adição em relação ao spec:** o spec não previa teste automatizado para o PR 2.
A Task 1 acrescenta três, cobrindo exatamente a promessa que sustenta o risco
deste PR: que a ausência de configuração e a falha de inicialização degradam em
silêncio, sem derrubar o boot.

**Consistência de nomes:** `initAppCheck` é definido na Task 1 e usado na Task 2.
`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` e `VITE_APPCHECK_DEBUG_TOKEN` aparecem com
o mesmo nome nas Tasks 1, 3 e 4.

**Contagem de testes:** 582 ao fim do PR 1, mais 3 na Task 1, dá 585. Esse número
aparece nas Tasks 1 e 2.
