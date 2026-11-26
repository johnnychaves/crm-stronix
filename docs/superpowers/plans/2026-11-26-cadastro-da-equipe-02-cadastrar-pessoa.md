# Cadastro da equipe, PR 2: cadastrar pessoa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O "Cadastrar pessoa" vira uma gaveta passo a passo (função, quem é, modalidades, vínculo e admissão, acesso), e o "Dar acesso" da ficha usa o mesmo passo de acesso. O convite liga o login à ficha quando é aceito.

**Architecture:** A gaveta grava, nesta ordem, o professor (quando é professor), a ficha e o acesso. Com senha temporária, o app grava o `userId` na ficha com o `authUid` que o `create` devolve. Com convite, o `invite-create` guarda o `fichaId` no convite e o `convite` na ficha, e o `invite-accept` liga o login à ficha. Os diálogos antigos de cadastro, convite e professor saem.

**Tech Stack:** React 19, shadcn/ui (`Sheet`, `Dialog`, `RadioGroup`), Firestore, funções da Vercel, Vitest.

Depende do PR 1 na main. Plano mestre: `docs/superpowers/plans/2026-11-26-cadastro-da-equipe-00-visao-geral.md`.

---

## Antes de começar

- [ ] Branch nova a partir da main com o PR 1 (`git fetch origin && git switch -c claude/equipe-cadastrar-pessoa origin/main`).
- [ ] `npm ci` e a linha de base do plano mestre.
- [ ] Ler `src/views/AddLeadModal.jsx` (a gaveta do Novo lead), que é o desenho a seguir: o passo aberto mostra as opções, o feito vira resumo com Editar, passo de texto só fecha no Continuar e o rodapé diz o que falta.

---

### Task 1: Regras da gaveta, em `src/lib/equipe/cadastro.js`

**Files:**
- Create: `src/lib/equipe/cadastro.js`
- Test: `src/lib/__tests__/equipeCadastro.test.js`

- [ ] **Step 1: Escrever os testes**

```js
// src/lib/__tests__/equipeCadastro.test.js
import { describe, it, expect } from 'vitest';
import { formVazio, passosDe, modosDeAcesso, faltaNoPasso, fichaNova } from '../equipe/cadastro.js';

const AGORA = new Date(2026, 10, 26, 10, 0);
const ctx = { professorEnabled: true, agora: AGORA };
const professor = { ...formVazio(AGORA), funcao: 'professor', nome: 'Paula Martins', celular: '(51) 99510-6624', email: 'paula@gmail.com', modalidadeIds: ['m-func'], vinculo: 'estagio', acesso: 'sem' };

describe('passos', () => {
  it('modalidades só para professor', () => {
    expect(passosDe({ funcao: 'professor' })).toEqual(['funcao', 'quem', 'modalidades', 'vinculo', 'acesso']);
    expect(passosDe({ funcao: 'consultor' })).toEqual(['funcao', 'quem', 'vinculo', 'acesso']);
  });
  it('a admissão já vem com hoje', () => {
    expect(formVazio(AGORA).admissao).toBe('2026-11-26');
  });
});

describe('acesso', () => {
  it('gestor só por convite, consultor convite ou senha, professor sem acesso sem o módulo', () => {
    expect(modosDeAcesso('gestor', true)).toEqual(['convite']);
    expect(modosDeAcesso('consultor', true)).toEqual(['convite', 'senha']);
    expect(modosDeAcesso('professor', true)).toEqual(['convite', 'senha', 'sem']);
    expect(modosDeAcesso('professor', false)).toEqual(['sem']);
  });
});

describe('o que falta', () => {
  it('cada passo diz o que falta', () => {
    expect(faltaNoPasso('funcao', formVazio(AGORA), ctx)).toBe('Escolha a função.');
    expect(faltaNoPasso('quem', { ...professor, nome: ' ' }, ctx)).toBe('Escreva o nome completo.');
    expect(faltaNoPasso('quem', { ...professor, celular: '999' }, ctx)).toBe('Celular com DDD, 10 ou 11 números.');
    expect(faltaNoPasso('quem', { ...professor, funcao: 'consultor', email: '' }, ctx)).toBe('Escreva o e-mail, que vira o login.');
    expect(faltaNoPasso('quem', { ...professor, email: '' }, ctx)).toBeNull();
    expect(faltaNoPasso('modalidades', { ...professor, modalidadeIds: [] }, ctx)).toBe('Escolha pelo menos uma modalidade.');
    expect(faltaNoPasso('vinculo', { ...professor, vinculo: '' }, ctx)).toBe('Escolha o vínculo.');
    expect(faltaNoPasso('vinculo', { ...professor, admissao: '2026-12-01' }, ctx)).toBe('A admissão precisa ser hoje ou antes.');
    expect(faltaNoPasso('acesso', { ...professor, acesso: '' }, ctx)).toBe('Escolha como a pessoa entra.');
    expect(faltaNoPasso('acesso', { ...professor, acesso: 'convite', email: '' }, ctx)).toBe('Para o acesso, volte ao passo Quem é e escreva o e-mail.');
    expect(faltaNoPasso('acesso', { ...professor, acesso: 'sem' }, { ...ctx, professorEnabled: false })).toBeNull();
  });
});

describe('a ficha nova', () => {
  it('nasce com a admissão, o vínculo e o professor', () => {
    const f = fichaNova(professor, { autor: { id: 'g1', nome: 'Johnny' }, agora: AGORA, professorId: 'p-novo' });
    expect(f).toEqual({
      nome: 'Paula Martins', celular: '51995106624', emailPessoal: 'paula@gmail.com', funcao: 'professor',
      vinculo: 'estagio', cref: null, status: 'ativo', userId: null, professorId: 'p-novo',
      movimentacoes: [{ tipo: 'admissao', data: '2026-11-26', vinculo: 'estagio', tipoDesligamento: null, motivo: '', registradoPor: { id: 'g1', nome: 'Johnny' }, registradoEm: AGORA.toISOString() }],
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeCadastro.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/equipe/cadastro.js`**

```js
// Regras da gaveta "Cadastrar pessoa" (spec 2026-11-26-cadastro-da-equipe,
// "Cadastrar pessoa, na gaveta"). Puro.
import { FUNCOES, MOV, hojeIso, isDia, isVinculo, novaMovimentacao } from './ficha.js';

export const PASSOS = Object.freeze(['funcao', 'quem', 'modalidades', 'vinculo', 'acesso']);
export const passosDe = (form) => PASSOS.filter((p) => p !== 'modalidades' || form?.funcao === 'professor');

export const formVazio = (agora = new Date()) => ({
  funcao: '', nome: '', celular: '', email: '', modalidadeIds: [], vinculo: '', admissao: hojeIso(agora), acesso: '',
});

// Gestor entra só por convite, para a senha ser dele desde o começo. Consultor
// trabalha no app, então precisa de acesso. Professor pode ficar sem acesso, e
// sem o módulo Stronix 2.0 ele só existe sem acesso, como antes.
export function modosDeAcesso(funcao, professorEnabled) {
  if (funcao === 'gestor') return ['convite'];
  if (funcao === 'professor') return professorEnabled ? ['convite', 'senha', 'sem'] : ['sem'];
  return ['convite', 'senha'];
}

const so = (v) => String(v ?? '').trim();
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// O que falta no passo, em uma frase, ou null.
export function faltaNoPasso(passo, form, { professorEnabled = false, agora = new Date() } = {}) {
  if (passo === 'funcao') return FUNCOES.includes(form.funcao) ? null : 'Escolha a função.';
  if (passo === 'quem') {
    if (!so(form.nome)) return 'Escreva o nome completo.';
    const cel = digitos(form.celular);
    if (cel && (cel.length < 10 || cel.length > 11)) return 'Celular com DDD, 10 ou 11 números.';
    const email = so(form.email);
    if (!email && form.funcao !== 'professor') return 'Escreva o e-mail, que vira o login.';
    if (email && !EMAIL_RE.test(email)) return 'E-mail inválido.';
    return null;
  }
  if (passo === 'modalidades') return (form.modalidadeIds || []).length ? null : 'Escolha pelo menos uma modalidade.';
  if (passo === 'vinculo') {
    if (!isVinculo(form.vinculo)) return 'Escolha o vínculo.';
    if (!isDia(form.admissao) || form.admissao > hojeIso(agora)) return 'A admissão precisa ser hoje ou antes.';
    return null;
  }
  if (passo === 'acesso') {
    if (!modosDeAcesso(form.funcao, professorEnabled).includes(form.acesso)) return 'Escolha como a pessoa entra.';
    if (form.acesso !== 'sem' && !so(form.email)) return 'Para o acesso, volte ao passo Quem é e escreva o e-mail.';
    return null;
  }
  return null;
}

// O documento da ficha nova. O e-mail digitado é o pessoal e também o do login.
export function fichaNova(form, { autor = null, agora = new Date(), professorId = null } = {}) {
  return {
    nome: so(form.nome).replace(/\s+/g, ' '),
    celular: digitos(form.celular),
    emailPessoal: so(form.email).toLowerCase(),
    funcao: form.funcao,
    vinculo: form.vinculo,
    cref: null,
    status: 'ativo',
    userId: null,
    professorId: professorId ?? null,
    movimentacoes: [novaMovimentacao({ tipo: MOV.ADMISSAO, data: form.admissao, vinculo: form.vinculo, autor, agora })],
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeCadastro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/equipe/cadastro.js src/lib/__tests__/equipeCadastro.test.js
git commit -m "feat: regras da gaveta de cadastrar pessoa"
```

---

### Task 2: O convite liga o login à ficha

**Files:**
- Create: `api/_equipe.js`
- Modify: `api/invite-create.js` (corpo, linha ~45; `add`, linha ~84)
- Modify: `api/invite-accept.js` (depois do `usersCollection(slug).doc(userRecord.uid).set(...)`, linha ~133)
- Test: `api/__tests__/equipeConvite.test.js`

- [ ] **Step 1: Escrever o teste**

Crie `api/__tests__/equipeConvite.test.js` copiando de `api/__tests__/professorAccess.test.js` tudo do começo até o fim do `afterEach` (linha ~196: o banco falso do `_firebaseAdmin.js`, os mocks de `_rateLimit.js`, `_asaas.js` e `@sentry/node`, as constantes, `semear`, `resposta`, `chamar`, o `beforeEach` e o `afterEach`), mais os helpers `convidar` e `aceitar` (linhas ~267 e ~268). Tire o import do `adminUsers` e o `criar`/`trocarPapel` se não forem usados. Depois, os casos:

```js
const FICHAS = `artifacts/${T}/public/data/stronix_equipe`;
const ficha = (id) => banco.docs.get(`${FICHAS}/${id}`);

describe('convite com a ficha da equipe', () => {
  it('guarda o fichaId no convite e o convite na ficha', async () => {
    semear();
    banco.docs.set(`${FICHAS}/f-lu`, { nome: 'Luana', status: 'ativo' });
    const res = await convidar({ fichaId: 'f-lu' });
    expect(res.statusCode).toBe(200);
    expect(convites().at(-1)).toMatchObject({ fichaId: 'f-lu', email: 'lu@academia.com' });
    expect(ficha('f-lu').convite).toMatchObject({ email: 'lu@academia.com', papel: 'professor' });
    expect(typeof ficha('f-lu').convite.expiraEm).toBe('string');
  });

  it('ficha que não existe na academia: 422 e nenhum convite', async () => {
    semear();
    const antes = convites().length;
    const res = await convidar({ fichaId: 'f-sumiu' });
    expect(res.statusCode).toBe(422);
    expect(convites()).toHaveLength(antes);
  });

  it('fichaId fora do formato: 400', async () => {
    semear();
    expect((await convidar({ fichaId: 'a/b' })).statusCode).toBe(400);
  });

  it('o aceite liga o login à ficha e tira o convite', async () => {
    semear();
    banco.docs.set(`${FICHAS}/f-lu`, { nome: 'Luana', status: 'ativo' });
    const { body } = await convidar({ fichaId: 'f-lu' });
    const res = await aceitar(body.token);
    expect(res.statusCode).toBe(200);
    expect(ficha('f-lu').userId).toBe('uid-lu');
    expect(ficha('f-lu').convite).toBeUndefined();
  });

  it('convite sem ficha continua como antes', async () => {
    semear();
    const { body } = await convidar({});
    expect((await aceitar(body.token)).statusCode).toBe(200);
    expect([...banco.docs.keys()].some((k) => k.startsWith(`${FICHAS}/`))).toBe(false);
  });
});
```

Confira no `beforeEach` copiado que o `createUser` falso devolve o uid `uid-lu` para `lu@academia.com` (é o que os testes de convite de hoje usam); se for outro, ajuste o `uid-lu` acima.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/equipeConvite.test.js`
Expected: FAIL nos casos com `fichaId`.

- [ ] **Step 3: Criar `api/_equipe.js`**

```js
import { admin } from './_firebaseAdmin.js';
import { dataCollection } from './_auth.js';

// A ficha da equipe (stronix_equipe) pelo Admin SDK. Spec
// docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md. Arquivo com
// prefixo `_`: utilitário, não conta no limite de funções da Vercel.
export const EQUIPE_PATH = 'stronix_equipe';
export const fichaRef = (tenantId, fichaId) => dataCollection(tenantId, EQUIPE_PATH).doc(fichaId);

// A ficha, quando existe nesta academia, ou null.
export async function fichaDaAcademia(tenantId, fichaId) {
  const snap = await fichaRef(tenantId, fichaId).get();
  return snap.exists ? { id: fichaId, ...(snap.data() || {}) } : null;
}

// Liga o login recém-criado à ficha e tira o convite pendente. Não derruba o
// aceite: a conta já existe, a lista junta o professor pelo professorId, e o
// gestor vê a pessoa sem acesso na ficha.
export async function ligarFichaAoLogin(tenantId, fichaId, userId) {
  try {
    if (!(await fichaDaAcademia(tenantId, fichaId))) return false;
    await fichaRef(tenantId, fichaId).set({
      userId,
      convite: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (e) {
    console.error('equipe: ligar a ficha ao login', e?.message || e);
    return false;
  }
}
```

- [ ] **Step 4: Mudar `api/invite-create.js`**

Imports no topo: `import { fichaDaAcademia, fichaRef } from './_equipe.js';` e troque `import { professorIdProblem } from '../src/lib/teamRoles.js';` por `import { isDocId, professorIdProblem } from '../src/lib/teamRoles.js';`.

Troque a leitura do corpo por `const { email, role, allowExtra, professorId, fichaId } = req.body || {};` e, logo depois da conferência do e-mail:

```js
    // Convite do "Cadastrar pessoa" ou do "Dar acesso": a ficha precisa ser
    // desta academia. Sem fichaId, o convite é o de antes.
    const comFicha = fichaId !== undefined && fichaId !== null && fichaId !== '';
    if (comFicha && !isDocId(fichaId)) return res.status(400).json({ error: 'Ficha inválida.' });
    if (comFicha && !(await fichaDaAcademia(auth.tenantId, fichaId))) {
      return res.status(422).json({ error: 'Essa pessoa não está mais na equipe. Atualize a tela.' });
    }
```

No `add` do convite, acrescente `...(comFicha ? { fichaId } : {}),`. Depois do `add`:

```js
    if (comFicha) {
      await fichaRef(auth.tenantId, fichaId).set({
        convite: { email: normalizedEmail, papel: normalizedRole, expiraEm: new Date(expiresAt.toMillis()).toISOString() },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
```

- [ ] **Step 5: Mudar `api/invite-accept.js`**

Import: `import { ligarFichaAoLogin } from './_equipe.js';`. Logo depois do `await usersCollection(slug).doc(userRecord.uid).set({ ... });`:

```js
    if (typeof invite.fichaId === 'string' && invite.fichaId) await ligarFichaAoLogin(slug, invite.fichaId, userRecord.uid);
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run api/__tests__/equipeConvite.test.js api/__tests__/professorAccess.test.js api/__tests__/inviteAccept.test.js`
Expected: PASS. O `inviteAccept.test.js` não usa `fichaId`, então não muda.

- [ ] **Step 7: Commit**

```bash
git add api/_equipe.js api/invite-create.js api/invite-accept.js api/__tests__/equipeConvite.test.js
git commit -m "feat: convite liga o login à ficha da equipe"
```

---

### Task 3: Criar a pessoa e dar acesso, no app

**Files:**
- Modify: `src/lib/equipe/equipeWrites.js` (acrescenta `criarPessoa` e `ligarLogin`)
- Create: `src/lib/equipe/acessoApi.js`
- Test: `src/lib/__tests__/equipeWrites.test.js` (casos novos), `src/lib/__tests__/equipeAcessoApi.test.js`

- [ ] **Step 1: Escrever os testes**

No `src/lib/__tests__/equipeWrites.test.js`, acrescente `add: []` ao `chamadas` (e ao `beforeEach`), um `addDoc` ao mock de `firebase/firestore`:

```js
  addDoc: async (col, dados) => { chamadas.add.push({ caminho: col.caminho, dados }); return { id: col.caminho.endsWith('stronix_professores') ? 'p-novo' : 'f-nova' }; },
```

troque o import por `const { gravarBloco, renomearPessoa, criarPessoa, ligarLogin } = await import('../equipe/equipeWrites.js');` e acrescente:

```js
describe('criarPessoa', () => {
  const AGORA = new Date(2026, 10, 26, 10, 0);
  it('professor: cria o professor e depois a ficha ligada a ele', async () => {
    const form = { funcao: 'professor', nome: 'Paula Martins', celular: '51995106624', email: 'p@x.com', modalidadeIds: ['m'], vinculo: 'estagio', admissao: '2026-11-26', acesso: 'sem' };
    const r = await criarPessoa({}, form, { id: 'g1', nome: 'Johnny' }, AGORA, 3);
    expect(r).toEqual({ fichaId: 'f-nova', professorId: 'p-novo' });
    expect(chamadas.add[0]).toMatchObject({ caminho: 'artifacts/acad/public/data/stronix_professores', dados: { nome: 'Paula Martins', modalidadeIds: ['m'], ativo: true, order: 3 } });
    expect(chamadas.add[1]).toMatchObject({ caminho: 'artifacts/acad/public/data/stronix_equipe', dados: { professorId: 'p-novo', funcao: 'professor', createdAt: 'agora' } });
  });
  it('consultor: só a ficha', async () => {
    const form = { funcao: 'consultor', nome: 'Bruna', celular: '', email: 'b@x.com', modalidadeIds: [], vinculo: 'pj', admissao: '2026-11-24', acesso: 'convite' };
    expect(await criarPessoa({}, form, { id: 'g1' }, AGORA, 0)).toEqual({ fichaId: 'f-nova', professorId: null });
    expect(chamadas.add).toHaveLength(1);
  });
});

describe('ligarLogin', () => {
  it('grava o userId na ficha', async () => {
    await ligarLogin({}, 'f-nova', 'uid-1');
    expect(chamadas.set[0]).toMatchObject({ caminho: 'artifacts/acad/public/data/stronix_equipe/f-nova', dados: { userId: 'uid-1' }, opcoes: { merge: true } });
  });
});
```

Crie `src/lib/__tests__/equipeAcessoApi.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../firebase.js', () => ({ auth: { currentUser: { getIdToken: async () => 'tok' } } }));
vi.mock('../passwordPolicy.js', () => ({ generateTemporaryPassword: () => 'Senha@2026x' }));
const pedidos = [];
let respostas = [];
beforeEach(() => {
  pedidos.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    pedidos.push([url, JSON.parse(init.body)]);
    const r = respostas.shift();
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  }));
  vi.stubGlobal('window', { location: { origin: 'https://app' } });
});
const { darAcesso } = await import('../equipe/acessoApi.js');

describe('darAcesso', () => {
  it('senha temporária: cria pelo admin-users, com o papel só para professor', async () => {
    respostas = [{ status: 200, body: { ok: true, authUid: 'uid-1', isExtra: false } }];
    const r = await darAcesso({ fichaId: 'f1', nome: 'Paula', email: 'p@x.com', funcao: 'professor', professorId: 'p1', modo: 'senha' });
    expect(r).toEqual({ ok: true, authUid: 'uid-1', senha: 'Senha@2026x', isExtra: false });
    expect(pedidos[0]).toEqual(['/api/admin-users', { action: 'create', name: 'Paula', email: 'p@x.com', password: 'Senha@2026x', allowExtra: false, role: 'professor', professorId: 'p1' }]);
  });
  it('convite: manda a ficha e devolve o link', async () => {
    respostas = [{ status: 200, body: { token: 't0', tenantId: 'acad' } }];
    const r = await darAcesso({ fichaId: 'f1', nome: 'Bruna', email: 'b@x.com', funcao: 'consultor', modo: 'convite' });
    expect(r).toEqual({ ok: true, link: 'https://app/?invite=t0&t=acad' });
    expect(pedidos[0]).toEqual(['/api/invite-create', { email: 'b@x.com', role: 'consultant', allowExtra: false, fichaId: 'f1' }]);
  });
  it('vaga extra e erro do servidor', async () => {
    respostas = [{ status: 409, body: { requiresExtraConfirmation: true, extraUserPrice: 49 } }, { status: 403, body: { error: 'Sem vaga.' } }];
    expect(await darAcesso({ fichaId: 'f1', nome: 'B', email: 'b@x.com', funcao: 'consultor', modo: 'senha' })).toEqual({ extra: 49 });
    expect(await darAcesso({ fichaId: 'f1', nome: 'B', email: 'b@x.com', funcao: 'consultor', modo: 'convite' })).toEqual({ erro: 'Sem vaga.' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeWrites.test.js src/lib/__tests__/equipeAcessoApi.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `src/lib/equipe/equipeWrites.js`, acrescente `addDoc` ao import do `firebase/firestore`, `import { fichaNova } from './cadastro.js';` e:

```js
// A pessoa nova da gaveta: o professor (quando é professor), depois a ficha.
// Devolve os ids. `ordem` é a posição do professor no catálogo (o tamanho da
// lista de hoje), como o "Cadastrar professor" de antes.
export async function criarPessoa(db, form, autor, agora, ordem) {
  let professorId = null;
  if (form.funcao === 'professor') {
    const p = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH), {
      nome: String(form.nome).trim().replace(/\s+/g, ' '), modalidadeIds: [...form.modalidadeIds], ativo: true,
      order: ordem, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    professorId = p.id;
  }
  const f = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', EQUIPE_PATH), {
    ...fichaNova(form, { autor, agora, professorId }),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: autor?.id ?? null,
  });
  return { fichaId: f.id, professorId };
}

// O login que acabou de nascer pela senha temporária (o create devolve o
// authUid, que é o id do cadastro de login).
export async function ligarLogin(db, fichaId, userId) {
  await setDoc(docDe(db, EQUIPE_PATH, fichaId), { userId, updatedAt: serverTimestamp() }, { merge: true });
}
```

Crie `src/lib/equipe/acessoApi.js`:

```js
import { auth } from '../firebase.js';
import { ROLES } from '../acesso.js';
import { generateTemporaryPassword } from '../passwordPolicy.js';

const PAPEL = Object.freeze({ consultor: ROLES.CONSULTOR, gestor: ROLES.GESTOR, professor: ROLES.PROFESSOR });

async function enviar(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

// O acesso da pessoa: senha temporária pelo /api/admin-users (create) ou
// convite pelo /api/invite-create, com a ficha. Devolve { ok, ... }, { extra }
// quando a vaga de consultor pede a confirmação do extra pago, ou { erro }.
export async function darAcesso({ fichaId, nome, email, funcao, professorId = null, modo, allowExtra = false }) {
  const role = PAPEL[funcao];
  const prof = role === ROLES.PROFESSOR ? { role, professorId } : {};
  if (modo === 'senha') {
    const password = generateTemporaryPassword();
    const { res, data } = await enviar('/api/admin-users', { action: 'create', name: nome, email, password, allowExtra, ...prof });
    if (res.status === 409 && data?.requiresExtraConfirmation) return { extra: data.extraUserPrice };
    if (!res.ok) return { erro: data.error || 'Não deu para criar o acesso.' };
    return { ok: true, authUid: data.authUid, senha: password, isExtra: data.isExtra === true };
  }
  const { res, data } = await enviar('/api/invite-create', {
    email, role, allowExtra, fichaId, ...(role === ROLES.PROFESSOR ? { professorId } : {}),
  });
  if (res.status === 409 && data?.requiresExtraConfirmation) return { extra: data.extraUserPrice };
  if (!res.ok) return { erro: data.error || 'Não deu para gerar o convite.' };
  return { ok: true, link: `${window.location.origin}/?invite=${encodeURIComponent(data.token)}&t=${encodeURIComponent(data.tenantId)}` };
}
```

Se a varredura do histórico do professor apontar `src/lib/equipe/cadastro.js` ou `src/lib/equipe/acessoApi.js`, acrescente-os ao `REVISADOS` com o motivo "ficha da equipe".

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeWrites.test.js src/lib/__tests__/equipeAcessoApi.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/equipe/equipeWrites.js src/lib/equipe/acessoApi.js src/lib/__tests__/equipeWrites.test.js src/lib/__tests__/equipeAcessoApi.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git commit -m "feat: criar pessoa e dar acesso pela ficha da equipe"
```

---

### Task 4: A gaveta e o "Dar acesso"

**Files:**
- Create: `src/views/settings/equipe/PassoAcesso.jsx`
- Create: `src/views/settings/equipe/CadastrarPessoa.jsx`
- Create: `src/views/settings/equipe/DarAcessoDialog.jsx`
- Test: `src/lib/__tests__/cadastrarPessoa.behavior.test.js`

- [ ] **Step 1: Escrever o teste de comportamento**

```js
// @vitest-environment jsdom
// src/lib/__tests__/cadastrarPessoa.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const feito = vi.hoisted(() => ({ criadas: [], acessos: [], ligados: [] }));
vi.mock('../equipe/equipeWrites.js', () => ({
  criarPessoa: async (_db, form) => { feito.criadas.push(form); return { fichaId: 'f-nova', professorId: form.funcao === 'professor' ? 'p-novo' : null }; },
  ligarLogin: async (_db, fichaId, userId) => { feito.ligados.push([fichaId, userId]); },
}));
vi.mock('../equipe/acessoApi.js', () => ({
  darAcesso: async (args) => { feito.acessos.push(args); return args.modo === 'senha' ? { ok: true, authUid: 'uid-1', senha: 'Senha@2026x' } : { ok: true, link: 'https://app/?invite=t' }; },
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }) }));

const { CadastrarPessoa } = await import('../../views/settings/equipe/CadastrarPessoa.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; feito.criadas = []; feito.acessos = []; feito.ligados = []; });

async function montar(props = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(CadastrarPessoa, {
      open: true, onOpenChange: () => {}, db: {}, appUser: { id: 'g1', name: 'Johnny' }, professorEnabled: true,
      modalities: [{ id: 'm-func', name: 'Funcional' }], professores: [], seats: null, consultantCount: 0, onAbrirFicha: () => {},
      agora: new Date(2026, 10, 26, 10), ...props,
    }));
  });
}
const botao = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
const clicar = async (el) => act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });
async function escrever(nome, valor) {
  const el = document.querySelector(`input[name="${nome}"]`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('Cadastrar pessoa', () => {
  it('o passo de texto não fecha enquanto se digita', async () => {
    await montar();
    await clicar(botao('Professor'));
    await escrever('nome', 'P');
    expect(document.querySelector('input[name="nome"]')).toBeTruthy();
  });

  it('professor estagiário sem acesso: grava a pessoa e não chama o acesso', async () => {
    await montar();
    await clicar(botao('Professor'));
    await escrever('nome', 'Paula Martins');
    await clicar(botao('Continuar'));
    await clicar(botao('Funcional'));
    await clicar(botao('Continuar'));
    await clicar(botao('Estágio'));
    await clicar(botao('Continuar'));
    await clicar(botao('Sem acesso por enquanto'));
    await clicar(botao('Cadastrar'));
    expect(feito.criadas).toHaveLength(1);
    expect(feito.criadas[0]).toMatchObject({ funcao: 'professor', nome: 'Paula Martins', modalidadeIds: ['m-func'], vinculo: 'estagio', acesso: 'sem' });
    expect(feito.acessos).toEqual([]);
    expect(document.body.textContent).toContain('Paula Martins entrou na equipe');
  });

  it('consultor com senha temporária: cria o acesso e liga o login à ficha', async () => {
    await montar();
    await clicar(botao('Consultor'));
    await escrever('nome', 'Bruna Lopes');
    await escrever('email', 'bruna@x.com');
    await clicar(botao('Continuar'));
    await clicar(botao('PJ'));
    await clicar(botao('Continuar'));
    await clicar(botao('Criar com senha temporária'));
    await clicar(botao('Cadastrar'));
    expect(feito.acessos[0]).toMatchObject({ fichaId: 'f-nova', funcao: 'consultor', modo: 'senha', email: 'bruna@x.com' });
    expect(feito.ligados).toEqual([['f-nova', 'uid-1']]);
    expect(document.body.textContent).toContain('Senha@2026x');
  });

  it('sem o módulo, o professor só pode ficar sem acesso', async () => {
    await montar({ professorEnabled: false });
    await clicar(botao('Professor'));
    await escrever('nome', 'Paula');
    await clicar(botao('Continuar'));
    await clicar(botao('Funcional'));
    await clicar(botao('Continuar'));
    await clicar(botao('CLT'));
    await clicar(botao('Continuar'));
    expect(botao('Mandar convite')).toBeUndefined();
    expect(botao('Sem acesso por enquanto')).toBeTruthy();
  });

  it('o rodapé diz o que falta', async () => {
    await montar();
    expect(document.querySelector('[role="status"]').textContent).toBe('Escolha a função.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/cadastrarPessoa.behavior.test.js`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Criar `src/views/settings/equipe/PassoAcesso.jsx`**

```jsx
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { cn } from '../../../lib/utils.js';
import { modosDeAcesso } from '../../../lib/equipe/cadastro.js';

const TEXTOS = {
  convite: ['Mandar convite', (email) => `A pessoa cria a própria senha pelo link, que vale 7 dias${email ? `. Vai para ${email}` : ''}.`],
  senha: ['Criar com senha temporária', () => 'Você entrega a senha e a pessoa troca depois.'],
  sem: ['Sem acesso por enquanto', () => 'Aparece na agenda e no NPS. Dá para dar acesso depois, na ficha.'],
};

// O passo de acesso, dividido pela gaveta e pelo "Dar acesso" da ficha.
// `modos` restringe as opções (o "Dar acesso" tira o "sem"); `extra` é o preço
// do consultor extra, quando as vagas do plano estão cheias.
export function PassoAcesso({ funcao, email, professorEnabled, value, onChange, extra = null, modos = null }) {
  const lista = modos ?? modosDeAcesso(funcao, professorEnabled);
  return (
    <div className="flex flex-col gap-3">
      <RadioGroup aria-label="Acesso ao app" value={value} onValueChange={onChange} className="flex flex-col gap-2">
        {lista.map((m) => {
          const [titulo, desc] = TEXTOS[m];
          return (
            <RadioGroupOption key={m} value={m}
              className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left outline-none focus-visible:anel-foco',
                value === m ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/15' : 'border-border bg-card')}>
              <span aria-hidden="true" className={cn('mt-0.5 size-[18px] flex-none rounded-full border-2', value === m ? 'border-[5px] border-brand-600' : 'border-slate-300')} />
              <span><span className="block text-[14px] font-semibold">{titulo}</span><span className="block text-[12.5px] text-muted-foreground">{desc(email)}</span></span>
            </RadioGroupOption>
          );
        })}
      </RadioGroup>
      {funcao === 'gestor' && <p className="rounded-xl bg-brand-50 p-3 text-[13px] text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Gestor entra só por convite, para a senha ser dele desde o começo.</p>}
      {extra != null && funcao === 'consultor' && value !== 'sem' && (
        <p className="rounded-xl bg-amber-500/[0.14] p-3 text-[13px] text-amber-800 dark:text-amber-300">
          Os consultores do plano já estão em uso. Este entra como extra: mais R$ {Number(extra).toLocaleString('pt-BR')} por mês, a partir da próxima fatura.
        </p>
      )}
    </div>
  );
}
```

Confira o nome do componente de opção em `src/components/ui/radio-group.jsx` (`RadioGroupOption`, citado no `CLAUDE.md`).

- [ ] **Step 4: Criar `src/views/settings/equipe/CadastrarPessoa.jsx`**

```jsx
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { VINCULOS, dataBR, vinculoTexto } from '../../../lib/equipe/ficha.js';
import { faltaNoPasso, formVazio, passosDe } from '../../../lib/equipe/cadastro.js';
import { criarPessoa, ligarLogin } from '../../../lib/equipe/equipeWrites.js';
import { darAcesso } from '../../../lib/equipe/acessoApi.js';
import { DialogField, FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';
import { FUNCAO_TEXTO } from './equipeVisual.jsx';
import { PassoAcesso } from './PassoAcesso.jsx';

const TITULOS = { funcao: 'Função', quem: 'Quem é', modalidades: 'Modalidades em que dá aula', vinculo: 'Vínculo e admissão', acesso: 'Acesso ao app' };
const FUNCOES = [
  ['consultor', 'Atende os leads e tem Meta diária. Ocupa uma vaga do plano.'],
  ['professor', 'Dá aula e tem carteira de alunos. Não ocupa vaga do plano.'],
  ['gestor', 'Configura a academia e vê a equipe toda. Entra por convite.'],
];
const ACESSO_TEXTO = { convite: 'Convite por link', senha: 'Senha temporária', sem: 'Sem acesso por enquanto' };
const PILULA = (on) => cn('h-9 rounded-full border px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco',
  on ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground');

// A gaveta "Cadastrar pessoa" (mockup A), no desenho do Novo lead. Um passo só
// fica feito depois de confirmado: a Função no clique, os outros no Continuar,
// para o "Quem é" não fechar na primeira letra. Grava o professor, a ficha e o
// acesso, nesta ordem; se o acesso falhar, a pessoa já está na lista e a
// gaveta oferece tentar de novo.
export function CadastrarPessoa({ open, onOpenChange, db, appUser, professorEnabled, modalities, professores, seats, consultantCount, onAbrirFicha, agora = new Date() }) {
  const toast = useToast();
  const [form, setForm] = useState(() => formVazio(agora));
  const [confirmados, setConfirmados] = useState(() => new Set());
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [criada, setCriada] = useState(null); // { fichaId, professorId }
  const [fim, setFim] = useState(null); // { senha?, link?, erroAcesso? }
  const [extraAceito, setExtraAceito] = useState(false);
  const ctx = { professorEnabled, agora };
  const passos = passosDe(form);
  const feito = (p) => confirmados.has(p) && !faltaNoPasso(p, form, ctx);
  const primeiro = passos.findIndex((p) => p !== 'acesso' && !feito(p));
  const aberto = editando ?? (primeiro === -1 ? passos.indexOf('acesso') : primeiro);
  const passoAberto = passos[aberto];
  const falta = faltaNoPasso(passoAberto, form, ctx);
  const vagasCheias = seats?.maxConsultants != null && consultantCount >= seats.maxConsultants;
  const extra = form.funcao === 'consultor' && vagasCheias ? seats.extraUserPrice ?? null : null;
  const autor = { id: appUser?.id ?? null, nome: appUser?.name ?? null };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === 'funcao' ? { acesso: '' } : {}) }));
  const confirmar = (p) => { setConfirmados((s) => new Set(s).add(p)); setEditando(null); };
  const recomecar = () => { setForm(formVazio(agora)); setConfirmados(new Set()); setEditando(null); setCriada(null); setFim(null); setExtraAceito(false); };
  const fechar = (v) => { if (!v) recomecar(); onOpenChange(v); };

  const pedirAcesso = async (ids) => {
    const r = await darAcesso({
      fichaId: ids.fichaId, nome: form.nome.trim(), email: form.email.trim().toLowerCase(), funcao: form.funcao,
      professorId: ids.professorId, modo: form.acesso, allowExtra: extra != null || extraAceito,
    });
    if (r.extra != null) {
      setExtraAceito(true);
      return { erroAcesso: `Este consultor entra como extra: mais R$ ${Number(r.extra).toLocaleString('pt-BR')} por mês. Clique em Tentar de novo para confirmar.` };
    }
    if (r.erro) return { erroAcesso: r.erro };
    if (r.authUid) await ligarLogin(db, ids.fichaId, r.authUid);
    return { senha: r.senha, link: r.link };
  };

  const cadastrar = async () => {
    setSalvando(true);
    try {
      const ids = criada ?? await criarPessoa(db, form, autor, agora, (professores || []).length);
      setCriada(ids);
      setFim(form.acesso === 'sem' ? {} : await pedirAcesso(ids));
    } catch (e) {
      console.error('Erro ao cadastrar a pessoa:', e?.code || e);
      toast.error('Não deu para cadastrar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };
  const tentarDeNovo = async () => { setSalvando(true); try { setFim(await pedirAcesso(criada)); } finally { setSalvando(false); } };

  const resumo = (p) => ({
    funcao: FUNCAO_TEXTO[form.funcao],
    quem: [form.nome, form.celular, form.email].filter(Boolean).join(', '),
    modalidades: (modalities || []).filter((m) => form.modalidadeIds.includes(m.id)).map((m) => m.name).join(' e '),
    vinculo: `${vinculoTexto(form.vinculo)}, admissão em ${dataBR(form.admissao)}`,
    acesso: ACESSO_TEXTO[form.acesso],
  }[p]);

  const corpo = (p) => {
    if (p === 'funcao') {
      return (
        <div role="radiogroup" aria-label="Função" className="flex flex-col gap-2">
          {FUNCOES.map(([id, desc]) => (
            <button key={id} type="button" role="radio" aria-checked={form.funcao === id} onClick={() => { set('funcao', id); confirmar('funcao'); }}
              className={cn('flex w-full flex-col rounded-xl border p-3 text-left outline-none focus-visible:anel-foco', form.funcao === id ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/15' : 'border-border bg-card')}>
              <span className="text-[14px] font-semibold">{FUNCAO_TEXTO[id]}</span><span className="text-[12.5px] text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      );
    }
    if (p === 'quem') {
      return (
        <>
          <DialogField label="Nome completo"><input name="nome" className={FIELD_INPUT} autoComplete="off" autoFocus value={form.nome} onChange={(e) => set('nome', e.target.value)} /></DialogField>
          <div className="grid gap-3 sm:grid-cols-2">
            <DialogField label="Celular"><input name="celular" className={FIELD_INPUT} inputMode="tel" autoComplete="off" value={form.celular} onChange={(e) => set('celular', e.target.value)} /></DialogField>
            <DialogField label="E-mail"><input name="email" type="email" className={FIELD_INPUT} autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} /></DialogField>
          </div>
        </>
      );
    }
    if (p === 'modalidades') {
      return (
        <div className="flex flex-wrap gap-2">
          {(modalities || []).map((m) => {
            const on = form.modalidadeIds.includes(m.id);
            return <button key={m.id} type="button" aria-pressed={on} className={PILULA(on)} onClick={() => set('modalidadeIds', on ? form.modalidadeIds.filter((x) => x !== m.id) : [...form.modalidadeIds, m.id])}>{m.name}</button>;
          })}
        </div>
      );
    }
    if (p === 'vinculo') {
      return (
        <>
          <div role="radiogroup" aria-label="Vínculo" className="flex flex-wrap gap-2">
            {VINCULOS.map((v) => <button key={v.id} type="button" role="radio" aria-checked={form.vinculo === v.id} className={PILULA(form.vinculo === v.id)} onClick={() => set('vinculo', v.id)}>{v.label}</button>)}
          </div>
          <div className="max-w-[220px]"><DialogField label="Admissão"><input name="admissao" type="date" className={FIELD_INPUT} value={form.admissao} onChange={(e) => set('admissao', e.target.value)} /></DialogField></div>
        </>
      );
    }
    return <PassoAcesso funcao={form.funcao} email={form.email} professorEnabled={professorEnabled} value={form.acesso} onChange={(v) => set('acesso', v)} extra={extra} />;
  };

  return (
    <Sheet open={open} onOpenChange={fechar}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-[19px]">Cadastrar pessoa</SheetTitle>
          <SheetDescription>O resto da ficha (CPF, endereço, foto) fica para depois.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-6 py-2" inert={salvando || undefined}>
          {fim ? (
            <div className="flex flex-col gap-4 py-4">
              <h3 className="font-display text-[20px] font-bold">{form.nome.trim()} entrou na equipe</h3>
              {fim.senha && <p className="text-[13.5px]">Senha temporária: <b className="font-semibold tabular-nums">{fim.senha}</b>. Entregue à pessoa, que troca depois.</p>}
              {fim.link && <p className="text-[13.5px] [overflow-wrap:anywhere]">Link do convite: <span className="font-semibold">{fim.link}</span></p>}
              {fim.erroAcesso && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-[13px] text-rose-700 dark:text-rose-300">{fim.erroAcesso} A pessoa já está na lista, sem acesso.</p>}
              <p className="text-[13px] text-muted-foreground">Falta na ficha: foto, CPF, RG, nascimento e endereço.</p>
            </div>
          ) : passos.map((p, i) => {
            const estado = i === aberto ? 'aberto' : feito(p) ? 'feito' : 'espera';
            return (
              <div key={p} className="border-t border-border py-4 first:border-t-0">
                <div className="flex items-center gap-2.5">
                  <span className={cn('grid size-6 place-items-center rounded-full text-[12px] font-bold',
                    estado === 'feito' ? 'bg-emerald-500 text-white' : estado === 'aberto' ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground')}>
                    {estado === 'feito' ? <Check size={13} aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={cn('flex-1 text-[14px] font-semibold', estado === 'espera' && 'text-muted-foreground')}>{TITULOS[p]}</span>
                  {estado === 'feito' && <button type="button" className="rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300" onClick={() => setEditando(i)}>Editar</button>}
                </div>
                {estado === 'feito' && <p className="ml-[34px] mt-0.5 text-[13px] text-muted-foreground">{resumo(p)}</p>}
                {estado === 'aberto' && (
                  <div className="ml-[34px] mt-3 flex flex-col gap-3">
                    {corpo(p)}
                    {p !== 'acesso' && p !== 'funcao' && (
                      <div><SettingsBtn size={38} kind="primary" disabled={!!falta} onClick={() => confirmar(p)}>Continuar</SettingsBtn></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4">
          <p role="status" className="min-w-0 flex-1 text-[13px]">{fim ? 'Salvo.' : falta || ''}</p>
          {fim ? (
            <>
              {fim.erroAcesso && <SettingsBtn size={38} onClick={tentarDeNovo}>Tentar de novo</SettingsBtn>}
              <SettingsBtn size={38} onClick={recomecar}>Cadastrar outra pessoa</SettingsBtn>
              <SettingsBtn size={38} kind="primary" onClick={() => { onAbrirFicha(criada.fichaId); fechar(false); }}>Completar a ficha</SettingsBtn>
            </>
          ) : (
            <>
              <SettingsBtn size={38} onClick={() => fechar(false)}>Cancelar</SettingsBtn>
              {passoAberto === 'acesso' && (
                <SettingsBtn size={38} kind="primary" disabled={!!falta || salvando} onClick={cadastrar}>
                  {salvando ? 'Cadastrando…' : extra != null && form.acesso !== 'sem' ? 'Cadastrar como extra' : 'Cadastrar'}
                </SettingsBtn>
              )}
            </>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}
```

Confira os nomes de `src/components/ui/sheet.jsx` (`Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`) e se o `SheetContent` aceita `side`. Como a gaveta do Novo lead, ela usa `z-[130]`: passe `overlayClassName` e a classe de camada que o `AddLeadModal` usa.

- [ ] **Step 5: Criar `src/views/settings/equipe/DarAcessoDialog.jsx`**

```jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { modosDeAcesso } from '../../../lib/equipe/cadastro.js';
import { darAcesso } from '../../../lib/equipe/acessoApi.js';
import { gravarBloco, ligarLogin } from '../../../lib/equipe/equipeWrites.js';
import { DialogField, FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';
import { PassoAcesso } from './PassoAcesso.jsx';

// "Dar acesso" da ficha: o passo de acesso da gaveta, para quem já está na
// equipe. A ficha nasce antes (com o id da pessoa), porque o convite leva o
// fichaId e o login novo é ligado a ela.
export function DarAcessoDialog({ open, onOpenChange, db, appUser, pessoa, professorEnabled, extra }) {
  const toast = useToast();
  const modos = modosDeAcesso(pessoa.funcao, professorEnabled).filter((m) => m !== 'sem');
  const [modo, setModo] = useState(modos[0] ?? '');
  const [email, setEmail] = useState(pessoa.ficha?.emailPessoal || '');
  const [fim, setFim] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [extraAceito, setExtraAceito] = useState(false);

  const enviar = async () => {
    setSalvando(true);
    try {
      if (!pessoa.ficha) await gravarBloco(db, pessoa, {}, { id: appUser?.id ?? null });
      const r = await darAcesso({
        fichaId: pessoa.id, nome: pessoa.nome, email: email.trim().toLowerCase(), funcao: pessoa.funcao,
        professorId: pessoa.professor?.id ?? null, modo, allowExtra: extra != null || extraAceito,
      });
      if (r.extra != null) { setExtraAceito(true); setFim({ erro: `Entra como extra: mais R$ ${Number(r.extra).toLocaleString('pt-BR')} por mês. Envie de novo para confirmar.` }); return; }
      if (r.erro) { setFim({ erro: r.erro }); return; }
      if (r.authUid) await ligarLogin(db, pessoa.id, r.authUid);
      setFim(r);
    } catch (e) {
      console.error('Erro ao dar acesso:', e?.code || e);
      toast.error('Não deu para dar acesso. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>Dar acesso a {pessoa.nome}</DialogTitle>
        <DialogDescription>Convite por link ou senha temporária.</DialogDescription>
        {fim?.ok ? (
          <p className="text-[13.5px] [overflow-wrap:anywhere]">{fim.senha ? <>Senha temporária: <b className="font-semibold">{fim.senha}</b></> : <>Link do convite: <b className="font-semibold">{fim.link}</b></>}</p>
        ) : (
          <div className="flex flex-col gap-3" inert={salvando || undefined}>
            <DialogField label="E-mail de login"><input type="email" className={FIELD_INPUT} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></DialogField>
            <PassoAcesso funcao={pessoa.funcao} email={email} professorEnabled={professorEnabled} value={modo} onChange={setModo} extra={extra} modos={modos} />
            {fim?.erro && <p role="alert" className="text-[13px] font-semibold text-rose-700 dark:text-rose-400">{fim.erro}</p>}
            <div className="flex justify-end gap-2">
              <SettingsBtn size={38} onClick={() => onOpenChange(false)}>Cancelar</SettingsBtn>
              <SettingsBtn size={38} kind="primary" disabled={!email.trim() || !modo || salvando} onClick={enviar}>{salvando ? 'Enviando…' : 'Dar acesso'}</SettingsBtn>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/cadastrarPessoa.behavior.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/bordaDosPrimitivos.test.js`
Expected: PASS. Se o `RadioGroupOption` do Radix não marcar com `click` no jsdom, dispare `mousedown` antes do `click` no helper `clicar`, como os testes de aba fazem.

- [ ] **Step 7: Commit**

```bash
git add src/views/settings/equipe/PassoAcesso.jsx src/views/settings/equipe/CadastrarPessoa.jsx src/views/settings/equipe/DarAcessoDialog.jsx src/lib/__tests__/cadastrarPessoa.behavior.test.js
git commit -m "feat: gaveta de cadastrar pessoa e dar acesso pela ficha"
```

---

### Task 5: Trocar os diálogos antigos

**Files:**
- Modify: `src/views/settings/TeamAccessSection.jsx`
- Modify: `src/lib/__tests__/teamAccessProfessor.test.js`, `src/lib/__tests__/equipeTela.behavior.test.js`

- [ ] **Step 1: No `TeamAccessSection.jsx`**

1. Saem o diálogo de cadastro (`memberDialog` em modo `create`, `form`, `emptyForm`, `createMember`, `openCreate`), o de convite (`inviteOpen`, `inviteEmail`, `inviteRole`, `inviteProfessorId`, `inviteLink`, `createInvite`, `copyInviteLink`) e o de professor novo (`profDialog`, `profName`, `profMods`, `saveProfessor`, `toggleProfMod`), e os botões "Convidar por e-mail" e "Cadastrar professor" do cabeçalho.
2. O cabeçalho fica com um botão só, `Cadastrar pessoa` (ícone `Plus`), que abre a gaveta: `const [cadastrando, setCadastrando] = useState(false);`.
3. O atalho da Visão geral (`focusId === 'new'`) abre a gaveta (`setCadastrando(true)`) em vez do diálogo.
4. A ficha passa a abrir o `DarAcessoDialog` no "Dar acesso": `const [dandoAcesso, setDandoAcesso] = useState(false);` e `onDarAcesso={() => setDandoAcesso(true)}`.
5. Nos dois retornos, no lugar dos diálogos antigos:

```jsx
      <CadastrarPessoa
        open={cadastrando} onOpenChange={setCadastrando} db={db} appUser={appUser} professorEnabled={professorEnabled}
        modalities={modalities} professores={professores} seats={seats} consultantCount={consultantCount} agora={agora}
        onAbrirFicha={(id) => navigate(hrefDe(id))}
      />
```

e, só com a ficha aberta:

```jsx
      {pessoa && !pessoa.user && !pessoa.desligada && (
        <DarAcessoDialog
          key={pessoa.id} open={dandoAcesso} onOpenChange={setDandoAcesso} db={db} appUser={appUser} pessoa={pessoa}
          professorEnabled={professorEnabled}
          extra={pessoa.funcao === 'consultor' && seats?.maxConsultants != null && consultantCount >= seats.maxConsultants ? seats.extraUserPrice ?? null : null}
        />
      )}
```

6. O `ProfessorPicker` deixa de ser usado aqui; continua no `EditarAcessoDialog`. Tire os imports sem uso.

- [ ] **Step 2: Testes**

Em `src/lib/__tests__/teamAccessProfessor.test.js`, saem os testes de cadastro e convite pelo diálogo antigo ("fica como sempre: Cadastrar consultor e cadastro sem papel", "cadastrar consultor mostra a frase de sempre", "o convite não oferece Professor", "o convite de professor só oferece professor ativo e sem login, e manda o id", "cadastrar pessoa como professor manda papel e professor ao /api/admin-users", "cadastrar pessoa como consultor manda o pedido de sempre, sem papel"): a gaveta, o `PassoAcesso` e o `darAcesso` cobrem o mesmo (`cadastrarPessoa.behavior.test.js`, `equipeAcessoApi.test.js`), e o professor do convite agora é o da própria pessoa. Os testes da faixa de vagas e da edição ficam.

Em `src/lib/__tests__/equipeTela.behavior.test.js`, acrescente:

```js
  it('o cabeçalho tem só o Cadastrar pessoa', async () => {
    await montar('/acad/configuracoes/equipe');
    const rotulos = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(rotulos).toContain('Cadastrar pessoa');
    expect(rotulos).not.toContain('Convidar por e-mail');
    expect(rotulos).not.toContain('Cadastrar professor');
  });
```

- [ ] **Step 3: Rodar**

Run: `npx vitest run src/lib/__tests__/equipe src/lib/__tests__/teamAccess src/lib/__tests__/cadastrarPessoa.behavior.test.js src/lib/__tests__/acessoSweep.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/TeamAccessSection.jsx src/lib/__tests__/teamAccessProfessor.test.js src/lib/__tests__/equipeTela.behavior.test.js
git commit -m "feat: Cadastrar pessoa no lugar dos diálogos de cadastro, convite e professor"
```

---

### Task 6: Documentação e verificação

- [ ] **Step 1: `CLAUDE.md`, seção "Equipe & acessos"**

Acrescente:

```markdown
- **Cadastrar pessoa** é uma gaveta passo a passo (`CadastrarPessoa.jsx`, regras em `src/lib/equipe/cadastro.js`): função, quem é, modalidades (só professor), vínculo e admissão, acesso. Um passo só fica feito depois de confirmado (a Função no clique, os outros no Continuar). Grava o professor, a ficha e o acesso, nesta ordem. Gestor só por convite; consultor convite ou senha; professor também "sem acesso", e só "sem acesso" sem o módulo. Com senha temporária, o app grava o `userId` na ficha com o `authUid` do `create`. Com convite, o `invite-create` guarda o `fichaId` no convite e o `convite` na ficha, e o `invite-accept` liga o login (`api/_equipe.js`). Se o acesso falhar, a pessoa já está na lista e a gaveta oferece tentar de novo.
- O "Dar acesso" da ficha (`DarAcessoDialog`) usa o mesmo passo (`PassoAcesso`) e cria a ficha antes, quando a pessoa ainda não tinha.
```

- [ ] **Step 2: Verificação completa**

Run: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Expected: verde.

- [ ] **Step 3: Conferir no navegador**

Com o harness: os três caminhos da gaveta (consultor com senha, consultor por convite com a vaga extra, professor estagiário sem acesso), o "Editar" de um passo feito, o "Dar acesso" de um professor, a 1280 px e a 375 px, claro e escuro. Apague o harness antes do commit.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: cadastrar pessoa no CLAUDE.md"
```

## Herdado do PR 1

- **Ficha fantasma na troca de papel.** Um consultor com ficha que vira professor pelo `set-role`, ligado a um professor que já tem ficha própria, deixa duas fichas apontando para a mesma pessoa: o `montarEquipe` dá o login e o professor à primeira ficha (pela ordem dos ids) e a outra fica sem nada, na lista como uma pessoa a mais. Com o `fichaId` deste PR, decidir qual ficha fica (a do login) e juntar a outra, ou recusar a troca enquanto houver duas fichas.
- **"Dar acesso" da ficha de quem não é professor.** No PR 1 o botão some quando a pessoa tem ficha e não é professor, porque o login novo não teria como se ligar a ela (`shortcut:` no `FichaAcesso.jsx`). Este PR, com o `fichaId` no `create` e no convite, devolve o botão e tira o comentário.
