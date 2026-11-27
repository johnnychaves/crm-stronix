# Cadastro da equipe, PR 3: desligar e readmitir

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O gestor desliga uma pessoa pela ficha (data, tipo e motivo): o consultor passa a carteira antes, os alunos do professor vão para o substituto da modalidade, o login sai e a ficha vai para Desligados. Readmitir devolve a pessoa à equipe.

**Architecture:** Ação nova `desligar` no `api/admin-users.js` (sem função nova na Vercel), que reaproveita o caminho do `delete` numa função só (`excluirAcesso`). A modalidade de cada aluno e o substituto saem de um módulo puro, `src/lib/equipe/desligamento.js`, com a regra de plano do perfil do professor. Readmitir é gravação do app (o gestor grava a ficha e o professor pelas regras).

**Tech Stack:** Funções da Vercel com o Admin SDK, React 19, shadcn/ui (`Dialog`), Vitest.

Depende do PR 1 na main e usa o `api/_equipe.js` e o `src/lib/equipe/acessoApi.js` do PR 2. Se o PR 3 vier antes do PR 2, crie o `api/_equipe.js` como está na Task 2, Step 3, do plano do PR 2, e o `acessoApi.js` só com o `enviar` e o `desligarPessoa` daqui. Plano mestre: `docs/superpowers/plans/2026-11-26-cadastro-da-equipe-00-visao-geral.md`.

---

## Antes de começar

- [ ] Branch nova a partir da main (`git fetch origin && git switch -c claude/equipe-desligar origin/main`), `npm ci` e a linha de base do plano mestre.
- [ ] Ler `handleDelete` (`api/admin-users.js`, linha ~654), `returnDelegatedTasks` e `leaveRoutineModels` (linhas ~64 e ~97) e o `professorChangePatch` (`src/lib/professorHistory.js`).

---

### Task 1: Modalidade do aluno e substituto, em `src/lib/equipe/desligamento.js`

**Files:**
- Create: `src/lib/equipe/desligamento.js`
- Test: `src/lib/__tests__/equipeDesligamento.test.js`

- [ ] **Step 1: Escrever os testes**

```js
// src/lib/__tests__/equipeDesligamento.test.js
import { describe, it, expect } from 'vitest';
import { substitutosPossiveis, problemaDosSubstitutos, modalidadeDoAluno, substitutoDe } from '../equipe/desligamento.js';

const MODS = [{ id: 'm-musc', name: 'Musculação' }, { id: 'm-func', name: 'Funcional' }, { id: 'm-pil', name: 'Pilates' }];
const PLANOS = [
  { id: 'start', modalityIds: ['m-musc'] },
  { id: 'move', modalityIds: ['m-musc', 'm-func'] }, // o Move leva musculação junto e conta como funcional
];
const fernanda = { id: 'p-fe', modalidadeIds: ['m-musc', 'm-func'] };
const professores = [
  fernanda,
  { id: 'p-di', nome: 'Diego', modalidadeIds: ['m-musc'] },
  { id: 'p-ti', nome: 'Tiago', modalidadeIds: ['m-func'] },
  { id: 'p-velho', nome: 'Rui', modalidadeIds: ['m-func'], ativo: false },
];

describe('substitutos', () => {
  it('por modalidade, só ativos que dão a modalidade e não são quem sai', () => {
    expect(substitutosPossiveis(fernanda, professores).map((s) => [s.modalidadeId, s.opcoes.map((p) => p.id)]))
      .toEqual([['m-musc', ['p-di']], ['m-func', ['p-ti']]]);
  });
  it('confere a escolha', () => {
    expect(problemaDosSubstitutos({ professor: fernanda, substitutos: { 'm-musc': 'p-di' }, professores })).toBe('Escolha quem fica com os alunos de cada modalidade.');
    expect(problemaDosSubstitutos({ professor: fernanda, substitutos: { 'm-musc': 'p-di', 'm-func': 'p-velho' }, professores })).toBe('O professor escolhido não está ativo ou não dá essa modalidade.');
    expect(problemaDosSubstitutos({ professor: fernanda, substitutos: { 'm-musc': 'p-di', 'm-func': 'p-ti' }, professores })).toBeNull();
    expect(problemaDosSubstitutos({ professor: { id: 'x', modalidadeIds: [] }, substitutos: {}, professores }))
      .toBe('Este professor não tem modalidade no cadastro. Escolha as modalidades na ficha antes de desligar.');
  });
});

describe('modalidade do aluno', () => {
  it('professor de uma modalidade: sempre ela', () => {
    expect(modalidadeDoAluno({ professor: { modalidadeIds: ['m-pil'] }, contrato: null, planos: PLANOS, modalidades: MODS })).toBe('m-pil');
  });
  it('duas modalidades: a do plano do contrato, com o Move contando como funcional', () => {
    const ctx = { professor: fernanda, planos: PLANOS, modalidades: MODS };
    expect(modalidadeDoAluno({ ...ctx, contrato: { planId: 'start' } })).toBe('m-musc');
    expect(modalidadeDoAluno({ ...ctx, contrato: { planId: 'move' } })).toBe('m-func');
    expect(modalidadeDoAluno({ ...ctx, contrato: null })).toBe('m-musc');
  });
  it('o substituto do aluno', () => {
    expect(substitutoDe({ professor: fernanda, planos: PLANOS, modalidades: MODS, contrato: { planId: 'move' }, substitutos: { 'm-musc': 'p-di', 'm-func': 'p-ti' } })).toBe('p-ti');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeDesligamento.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/equipe/desligamento.js`**

```js
// Para onde vão os alunos do professor que sai (spec
// 2026-11-26-cadastro-da-equipe, "Desligar"). Puro: a api/ (desligar) lê, como
// já lê o carteira.js pelo _npsPublico.
import { planModalityIds } from '../planos.js';
import { planosDoProfessor } from '../professor/carteira.js';

const ativo = (p) => !!p && p.ativo !== false;

// Cada modalidade do professor e quem pode ficar com os alunos dela: os
// professores ativos que dão a modalidade, fora quem sai.
export function substitutosPossiveis(professor, professores) {
  return (professor?.modalidadeIds || []).map((modalidadeId) => ({
    modalidadeId,
    opcoes: (professores || []).filter((p) => p?.id !== professor.id && ativo(p) && (p.modalidadeIds || []).includes(modalidadeId)),
  }));
}

export function problemaDosSubstitutos({ professor, substitutos, professores }) {
  if (!(professor?.modalidadeIds || []).length) {
    return 'Este professor não tem modalidade no cadastro. Escolha as modalidades na ficha antes de desligar.';
  }
  for (const { modalidadeId, opcoes } of substitutosPossiveis(professor, professores)) {
    const escolhido = substitutos?.[modalidadeId];
    if (!escolhido) return 'Escolha quem fica com os alunos de cada modalidade.';
    if (!opcoes.some((p) => p.id === escolhido)) return 'O professor escolhido não está ativo ou não dá essa modalidade.';
  }
  return null;
}

// A modalidade do aluno é a do plano do contrato atual, pela regra do perfil
// do professor (o plano de musculação com outra modalidade, como o Flow e o
// Move, conta como a outra). Sem contrato de nenhuma das modalidades, vale a
// primeira do professor.
export function modalidadeDoAluno({ contrato, planos, modalidades, professor }) {
  const mods = professor?.modalidadeIds || [];
  if (mods.length <= 1) return mods[0] ?? null;
  const plano = planosDoProfessor(planos, modalidades).find((p) => p.id === contrato?.planId);
  const ids = planModalityIds(plano);
  return mods.find((id) => ids.includes(id)) ?? mods[0];
}

export const substitutoDe = (ctx) => ctx.substitutos?.[modalidadeDoAluno(ctx)] ?? null;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeDesligamento.test.js`
Expected: PASS. Se o Move cair em musculação, confira o `MUSCULACAO_RE` de `src/lib/professor/carteira.js` contra o nome da modalidade do teste.

- [ ] **Step 5: Commit**

```bash
git add src/lib/equipe/desligamento.js src/lib/__tests__/equipeDesligamento.test.js
git commit -m "feat: substituto dos alunos no desligamento do professor"
```

---

### Task 2: A ação `desligar`

**Files:**
- Modify: `api/admin-users.js` (imports; `handleDelete`, linha ~654; o `switch`, linha ~137)
- Modify: `src/lib/__tests__/historicoDoProfessor.sweep.test.js`
- Test: `api/__tests__/equipeDesligar.test.js`

- [ ] **Step 1: Escrever o teste**

Crie `api/__tests__/equipeDesligar.test.js` copiando de `api/__tests__/professorAccess.test.js` tudo do começo até o fim do `afterEach` (linha ~196), com o import do `adminUsers`. Depois:

```js
const FICHAS = `artifacts/${T}/public/data/stronix_equipe`;
const LEADS = `artifacts/${T}/public/data/stronix_leads`;
const ficha = (id) => banco.docs.get(`${FICHAS}/${id}`);
const desligar = (extra) => chamar(adminUsers, { action: 'desligar', data: '2026-11-20', tipoDesligamento: 'pedido_demissao', motivo: 'Mudou de cidade', ...extra });

function semearDesligamento() {
  semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
  banco.docs.set(`${CATALOGO}/prof-rafa`, { nome: 'Rafael Menezes', ativo: true, modalidadeIds: ['m-func'] });
  banco.docs.set(`${CATALOGO}/prof-lu`, { nome: 'Luana Prado', ativo: true, modalidadeIds: ['m-func'] });
  banco.docs.set(`${FICHAS}/f-ana`, { nome: 'Ana', userId: 'uid-ana', funcao: 'consultor', status: 'ativo', movimentacoes: [{ tipo: 'admissao', data: '2025-01-02' }] });
  banco.docs.set(`${FICHAS}/f-rafa`, { nome: 'Rafael', userId: 'uid-rafa', professorId: 'prof-rafa', funcao: 'professor', status: 'ativo', movimentacoes: [] });
  banco.docs.set(`${LEADS}/aluno-1`, { name: 'Aluno 1', professorId: 'prof-rafa', professorName: 'Rafael Menezes' });
  banco.docs.set(`${LEADS}/aluno-2`, { name: 'Aluno 2', professorId: 'prof-rafa', professorName: 'Rafael Menezes' });
}

describe('desligar', () => {
  beforeEach(() => {
    semearDesligamento();
    contas.getUser.mockResolvedValue({ customClaims: { tenantId: T } });
  });

  it('consultor sem carteira: a conta sai, a ficha guarda o desligamento', async () => {
    const res = await desligar({ fichaId: 'f-ana' });
    expect(res.statusCode).toBe(200);
    expect(contas.deleteUser).toHaveBeenCalledWith('uid-ana');
    expect(cadastro('uid-ana')).toBeUndefined();
    expect(ficha('f-ana')).toMatchObject({ status: 'desligado', userId: null });
    expect(ficha('f-ana').movimentacoes.at(-1)).toMatchObject({ tipo: 'desligamento', data: '2026-11-20', tipoDesligamento: 'pedido_demissao', motivo: 'Mudou de cidade' });
  });

  it('consultor com lead: 409, com o texto do Migrar leads, e nada muda', async () => {
    banco.docs.set(`${LEADS}/lead-x`, { consultantId: 'uid-ana' });
    const res = await desligar({ fichaId: 'f-ana' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('Migrar leads');
    expect(contas.deleteUser).not.toHaveBeenCalled();
    expect(ficha('f-ana').status).toBe('ativo');
  });

  it('professor: os alunos vão ao substituto com o histórico, e o professor fica inativo', async () => {
    const res = await desligar({ fichaId: 'f-rafa', substitutos: { 'm-func': 'prof-lu' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.alunosPassados).toBe(2);
    const aluno = banco.docs.get(`${LEADS}/aluno-1`);
    expect(aluno).toMatchObject({ professorId: 'prof-lu', professorName: 'Luana Prado' });
    expect(aluno.professorHistory.map((h) => h.professorId)).toEqual(['prof-rafa', 'prof-lu']);
    expect(banco.docs.get(`${CATALOGO}/prof-rafa`).ativo).toBe(false);
    expect(ficha('f-rafa').status).toBe('desligado');
  });

  it('professor com alunos e sem substituto: 422, e ninguém muda', async () => {
    const res = await desligar({ fichaId: 'f-rafa', substitutos: {} });
    expect(res.statusCode).toBe(422);
    expect(banco.docs.get(`${LEADS}/aluno-1`).professorId).toBe('prof-rafa');
    expect(contas.deleteUser).not.toHaveBeenCalled();
  });

  it('repetir depois de uma queda no meio não estraga', async () => {
    banco.docs.delete(`${EQUIPE}/uid-rafa`); // a conta já tinha saído
    banco.docs.set(`${LEADS}/aluno-1`, { name: 'Aluno 1', professorId: 'prof-lu' }); // e um aluno já tinha passado
    const res = await desligar({ fichaId: 'f-rafa', substitutos: { 'm-func': 'prof-lu' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.alunosPassados).toBe(1);
    expect(ficha('f-rafa').status).toBe('desligado');
  });

  it('recusas: gestor, já desligada, data no futuro, tipo desconhecido, ficha que não existe', async () => {
    banco.docs.set(`${FICHAS}/f-gestor`, { nome: 'Gestor', userId: 'gestor-1', funcao: 'gestor', status: 'ativo' });
    expect((await desligar({ fichaId: 'f-gestor' })).statusCode).toBe(403);
    banco.docs.set(`${FICHAS}/f-ana`, { ...ficha('f-ana'), status: 'desligado' });
    expect((await desligar({ fichaId: 'f-ana' })).statusCode).toBe(409);
    expect((await desligar({ fichaId: 'f-rafa', data: '2999-01-01' })).statusCode).toBe(400);
    expect((await desligar({ fichaId: 'f-rafa', tipoDesligamento: 'xyz' })).statusCode).toBe(400);
    expect((await desligar({ fichaId: 'f-nao-existe' })).statusCode).toBe(404);
  });
});
```

Confira no `beforeEach` copiado como a sessão do gestor (`banco.sessao`) é montada (deve ser `{ uid: 'gestor-1', tenantId: T }`); o `cadastro()`, o `professorDe()`, o `EQUIPE` e o `CATALOGO` vêm do cabeçalho copiado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/equipeDesligar.test.js`
Expected: FAIL (ação inválida, 400).

- [ ] **Step 3: Separar o caminho de excluir o acesso**

Em `api/admin-users.js`, tire do `handleDelete` o trecho que vem depois de ler o cadastro (do `const resolvedAuthUid = ...` até o `if (hadExtras) await syncSubscriptionValue(...)`) para uma função, com os comentários que estavam nele (o do IDOR, o das tarefas e o das vagas):

```js
// Apaga a conta e o cadastro de login, depois de devolver as tarefas delegadas
// e tirar a pessoa das rotinas. É o "Tirar acesso" e o passo do desligamento.
// Devolve { erro: { status, error } } quando a conta é de outra academia ou do
// dono da plataforma, ou { returnedTasks, leftRoutines }.
async function excluirAcesso({ tenantId, actorUid, docRef, data }) {
  const resolvedAuthUid = data?.authUid || null;
  const deletedRole = roleOf(data);
  const verdict = await resolveTargetVerdict(resolvedAuthUid, tenantId);
  if (verdict === TARGET_FOREIGN || verdict === TARGET_SUPERADMIN) return { erro: targetVerdictError(verdict) };
  const returnedTasks = await returnDelegatedTasks(tenantId, docRef.id);
  const leftRoutines = await leaveRoutineModels(tenantId, docRef.id, actorUid);
  let hadExtras = false;
  if (deletedRole === ROLES.CONSULTOR) {
    try { hadExtras = (await getSeatUsage(tenantId)).extraConsultants > 0; }
    catch (e) { console.error('seat check (delete)', e?.message || e); }
  }
  if (verdict === TARGET_OK) {
    try {
      await adminAuth.deleteUser(resolvedAuthUid);
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') throw err;
    }
  }
  await docRef.delete();
  if (hadExtras) await syncSubscriptionValue(tenantId, { actorUid });
  return { returnedTasks, leftRoutines };
}
```

No `handleDelete`, no lugar do trecho:

```js
    const r = await excluirAcesso({ tenantId: auth.tenantId, actorUid: auth.uid, docRef, data: docSnap.data() });
    if (r.erro) return res.status(r.erro.status).json({ error: r.erro.error });
    console.info('admin-delete-user', { academia: auth.tenantId, cadastro: userDocId, por: auth.uid, tarefasDevolvidas: r.returnedTasks, rotinasDeixadas: r.leftRoutines });
    return res.status(200).json({ ok: true });
```

Run: `npx vitest run api/__tests__/professorAccess.test.js api/__tests__/adminUsers.test.js`
Expected: PASS, igual a antes (a exclusão não mudou).

- [ ] **Step 4: Implementar a ação**

Imports no topo do `api/admin-users.js`:

```js
import { fichaRef } from './_equipe.js';
import { professorChangePatch } from '../src/lib/professorHistory.js';
import { MOV, isDia, isTipoDesligamento, novaMovimentacao } from '../src/lib/equipe/ficha.js';
import { problemaDosSubstitutos, substitutoDe } from '../src/lib/equipe/desligamento.js';
```

Acrescente `instanteDeBrasilia` ao import de `./_horarioDeBrasilia.js` e, junto das constantes:

```js
const PROFESSORS_PATH = 'stronix_professores';
const CONTRACTS_PATH = 'stronix_contratos';
const PLANS_PATH = 'stronix_planos';
const MODALITIES_PATH = 'stronix_modalities';
```

No `switch`, `case 'desligar': return handleDesligar(req, res);`. A função:

```js
// ---- desligar (spec 2026-11-26-cadastro-da-equipe) ----
// Na ordem: recusas, carteira do consultor, alunos do professor para o
// substituto, professor inativo, conta pelo excluirAcesso e a ficha por último.
// Cada passo pode rodar de novo sem estrago: se algo cair no meio, o gestor
// desliga de novo. Nada de motivo no log.
async function handleDesligar(req, res) {
  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) return res.status(401).json({ error: 'Não autenticado.' });
    const { fichaId, data, tipoDesligamento, motivo = '', substitutos = {} } = req.body || {};
    if (!isDocId(fichaId)) return res.status(400).json({ error: 'Campo obrigatório: fichaId.' });
    if (!isDia(data) || data > isoDoDia(diaDeBrasilia(new Date()))) {
      return res.status(400).json({ error: 'A data do desligamento precisa ser hoje ou antes.' });
    }
    if (!isTipoDesligamento(tipoDesligamento)) return res.status(400).json({ error: 'Escolha o tipo do desligamento.' });
    if (!(await isTenantAdmin(auth.tenantId, auth.uid))) {
      return res.status(403).json({ error: 'Apenas o gestor desliga pessoas da equipe.' });
    }

    const fRef = fichaRef(auth.tenantId, fichaId);
    const fSnap = await fRef.get();
    if (!fSnap.exists) return res.status(404).json({ error: 'Essa pessoa não está na equipe.' });
    const ficha = fSnap.data() || {};
    if (ficha.status === 'desligado') return res.status(409).json({ error: 'Essa pessoa já está desligada.' });

    // O login ligado à ficha. O userId vem do documento, então é conferido
    // como no delete: cadastro desta academia, e a conta pelo claim.
    const userRef = isDocId(ficha.userId) ? usersCollection(auth.tenantId).doc(ficha.userId) : null;
    const userSnap = userRef ? await userRef.get() : null;
    const user = userSnap?.exists ? userSnap.data() || {} : null;
    if (user && roleOf(user) === ROLES.GESTOR) return res.status(403).json({ error: 'O gestor não é desligado por aqui.' });
    if (user && (ficha.userId === auth.uid || user.authUid === auth.uid)) {
      return res.status(400).json({ error: 'Você não pode desligar a si mesmo.' });
    }
    if (user) {
      const owned = await dataCollection(auth.tenantId, LEADS_PATH).where('consultantId', '==', ficha.userId).limit(1).get();
      if (!owned.empty) return res.status(409).json({ error: PROFESSOR_LINK_MESSAGES.ownsLeads(user.name || ficha.nome) });
    }

    // Os alunos passam ao substituto da modalidade, com o histórico, a partir
    // da data do desligamento. Ex-alunos também (decisão do Johnny, 26/11/2026).
    let alunosPassados = 0;
    const profId = ficha.professorId || user?.professorId || null;
    if (isDocId(profId)) {
      const profRef = dataCollection(auth.tenantId, PROFESSORS_PATH).doc(profId);
      const profSnap = await profRef.get();
      if (profSnap.exists) {
        const professor = { id: profId, ...profSnap.data() };
        const leadsSnap = await dataCollection(auth.tenantId, LEADS_PATH).where('professorId', '==', profId).get();
        if (!leadsSnap.empty) {
          const professores = (await dataCollection(auth.tenantId, PROFESSORS_PATH).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
          const problema = problemaDosSubstitutos({ professor, substitutos, professores });
          if (problema) return res.status(422).json({ error: problema });
          let planos = [];
          let modalidades = [];
          const contratos = new Map();
          if ((professor.modalidadeIds || []).length > 1) {
            planos = (await dataCollection(auth.tenantId, PLANS_PATH).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
            modalidades = (await dataCollection(auth.tenantId, MODALITIES_PATH).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
            await Promise.all(leadsSnap.docs.map(async (d) => {
              const cid = d.data()?.currentContractId;
              if (!isDocId(cid)) return;
              const c = await dataCollection(auth.tenantId, CONTRACTS_PATH).doc(cid).get();
              if (c.exists) contratos.set(cid, c.data());
            }));
          }
          const desde = instanteDeBrasilia(data, '00:00');
          const ops = [];
          for (const d of leadsSnap.docs) {
            const lead = { id: d.id, ...d.data() };
            const subId = substitutoDe({ lead, contrato: contratos.get(lead.currentContractId) ?? null, planos, modalidades, professor, substitutos });
            const sub = professores.find((p) => p.id === subId);
            const patch = professorChangePatch(lead, subId, sub?.nome ?? null, desde);
            if (patch) ops.push([d.ref, patch]);
          }
          for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
            const batch = adminDb.batch();
            ops.slice(i, i + BATCH_LIMIT).forEach(([ref, patch]) => batch.update(ref, patch));
            await batch.commit();
          }
          alunosPassados = ops.length;
        }
        await profRef.set({ ativo: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    if (user) {
      const r = await excluirAcesso({ tenantId: auth.tenantId, actorUid: auth.uid, docRef: userRef, data: user });
      if (r.erro) return res.status(r.erro.status).json({ error: r.erro.error });
    }

    const autor = (await usersCollection(auth.tenantId).doc(auth.uid).get()).data() || {};
    const mov = novaMovimentacao({ tipo: MOV.DESLIGAMENTO, data, tipoDesligamento, motivo, autor: { id: auth.uid, nome: autor.name ?? null }, agora: new Date() });
    await fRef.set({
      status: 'desligado',
      userId: null,
      convite: admin.firestore.FieldValue.delete(),
      movimentacoes: [...(Array.isArray(ficha.movimentacoes) ? ficha.movimentacoes : []), mov],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.uid,
    }, { merge: true });

    console.info('equipe-desligar', { academia: auth.tenantId, ficha: fichaId, por: auth.uid, alunos: alunosPassados });
    return res.status(200).json({ ok: true, alunosPassados });
  } catch (error) {
    console.error('equipe-desligar', error?.message || error);
    return res.status(500).json({ error: 'Erro interno ao desligar.' });
  }
}
```

Confira o fim do `instanteDeBrasilia` (`api/_horarioDeBrasilia.js`, linha ~97): se ele devolve número (ms) e não `Date`, passe `new Date(desde)` ao `professorChangePatch`, para o Admin SDK gravar como data; o `professorAt` lê com o `getSafeDateOrNull`.

- [ ] **Step 5: A varredura do histórico do professor**

Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, troque o motivo de `'api/admin-users.js'` no `REVISADOS` para `'papel da equipe e desligamento (alunos pelo professorChangePatch)'`, acrescente `'src/lib/equipe/desligamento.js': 'substituto do desligamento, não grava lead'` se a varredura o apontar, e ponha `'api/admin-users.js'` na lista do teste "os três caminhos que trocam o professor do lead usam o montador" (o nome do teste passa a dizer "os caminhos").

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run api/__tests__/equipeDesligar.test.js api/__tests__/professorAccess.test.js api/__tests__/adminUsers.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js`
Expected: PASS. O banco falso copiado tem `batch().update`, `delete` e o `FieldValue.delete()` (o `APAGAR` do `aplicar`).

- [ ] **Step 7: Commit**

```bash
git add api/admin-users.js api/__tests__/equipeDesligar.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git commit -m "feat: ação de desligar da equipe, com a carteira e os alunos"
```

---

### Task 3: Os diálogos de desligar e readmitir

**Files:**
- Modify: `src/lib/equipe/acessoApi.js` (acrescenta `desligarPessoa`)
- Modify: `src/lib/equipe/equipeWrites.js` (acrescenta `readmitir`)
- Create: `src/views/settings/equipe/DesligarDialog.jsx`
- Create: `src/views/settings/equipe/ReadmitirDialog.jsx`
- Modify: `src/views/settings/TeamAccessSection.jsx` (botões na ficha)
- Test: `src/lib/__tests__/desligarDialog.behavior.test.js`, `src/lib/__tests__/equipeWrites.test.js`

- [ ] **Step 1: Escrever os testes**

```js
// @vitest-environment jsdom
// src/lib/__tests__/desligarDialog.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const feito = vi.hoisted(() => ({ pedidos: [], leads: { consultantId: [], professorId: [] } }));
vi.mock('../equipe/acessoApi.js', () => ({ desligarPessoa: async (args) => { feito.pedidos.push(args); return { ok: true, alunosPassados: 2 }; } }));
vi.mock('../equipe/equipeWrites.js', () => ({ gravarBloco: async () => {} }));
vi.mock('../settingsLeads.js', () => ({ leadsWhere: async (_db, campo) => feito.leads[campo] }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }) }));

const { DesligarDialog } = await import('../../views/settings/equipe/DesligarDialog.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; feito.pedidos = []; feito.leads = { consultantId: [], professorId: [] }; });

const professores = [
  { id: 'p-ma', nome: 'Marina', modalidadeIds: ['m-func'] },
  { id: 'p-ti', nome: 'Tiago', modalidadeIds: ['m-func'] },
];
const marina = { id: 'p-ma', nome: 'Marina', funcao: 'professor', ficha: { id: 'p-ma' }, user: null, professor: professores[0], acesso: 'sem' };
const ana = { id: 'f-ana', nome: 'Ana', funcao: 'consultor', ficha: { id: 'f-ana' }, user: { id: 'uid-ana', name: 'Ana' }, professor: null, acesso: 'com' };

async function montar(pessoa) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(DesligarDialog, { open: true, onOpenChange: () => {}, db: {}, appUser: { id: 'g1' }, pessoa, professores, modalities: [{ id: 'm-func', name: 'Funcional' }], agora: new Date(2026, 10, 26), onDesligada: () => {} }));
    await new Promise((r) => setTimeout(r, 0));
  });
}
const botao = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
const clicar = async (el) => act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });

describe('Desligar', () => {
  it('consultor com leads: não deixa desligar e leva a Migrar leads', async () => {
    feito.leads.consultantId = [{ id: 'l1' }, { id: 'l2' }];
    await montar(ana);
    expect(document.body.textContent).toContain('2 leads');
    expect(document.body.textContent).toContain('Migrar leads');
    expect(botao('Desligar Ana').disabled).toBe(true);
  });
  it('professor com alunos: pede o substituto e manda o pedido', async () => {
    feito.leads.professorId = [{ id: 'a1', lifecycleStage: 'cliente' }, { id: 'a2' }];
    await montar(marina);
    expect(botao('Desligar Marina').disabled).toBe(true);
    const select = document.querySelector('select[name="sub-m-func"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    await act(async () => { setter.call(select, 'p-ti'); select.dispatchEvent(new Event('change', { bubbles: true })); });
    await clicar(botao('Desligar Marina'));
    expect(feito.pedidos[0]).toMatchObject({ fichaId: 'p-ma', data: '2026-11-26', tipoDesligamento: 'pedido_demissao', substitutos: { 'm-func': 'p-ti' } });
  });
});
```

No `src/lib/__tests__/equipeWrites.test.js`, troque o import por `const { gravarBloco, renomearPessoa, criarPessoa, ligarLogin, readmitir } = await import('../equipe/equipeWrites.js');` (só os nomes que existirem na branch) e acrescente:

```js
describe('readmitir', () => {
  it('grava a readmissão e reativa o professor', async () => {
    const pessoa = { id: 'p1', ficha: { id: 'p1', movimentacoes: [{ tipo: 'admissao', data: '2022-02-07' }, { tipo: 'desligamento', data: '2023-12-15' }] }, professor: { id: 'p1' }, funcao: 'professor', nome: 'M' };
    await readmitir({}, pessoa, { data: '2024-03-12', vinculo: 'clt' }, { id: 'g1', nome: 'J' }, new Date(2026, 10, 26));
    expect(chamadas.set[0].dados).toMatchObject({ status: 'ativo', vinculo: 'clt' });
    expect(chamadas.set[0].dados.movimentacoes.at(-1)).toMatchObject({ tipo: 'readmissao', data: '2024-03-12', vinculo: 'clt' });
    expect(chamadas.set[1]).toMatchObject({ caminho: 'artifacts/acad/public/data/stronix_professores/p1', dados: { ativo: true } });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/desligarDialog.behavior.test.js src/lib/__tests__/equipeWrites.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar as chamadas**

Em `src/lib/equipe/acessoApi.js`:

```js
// O desligamento pelo /api/admin-users (ação desligar). Devolve { ok,
// alunosPassados } ou { erro }.
export async function desligarPessoa({ fichaId, data, tipoDesligamento, motivo, substitutos }) {
  const { res, data: corpo } = await enviar('/api/admin-users', { action: 'desligar', fichaId, data, tipoDesligamento, motivo, substitutos });
  if (!res.ok) return { erro: corpo.error || 'Não deu para desligar. Tente de novo.' };
  return { ok: true, alunosPassados: corpo.alunosPassados ?? 0 };
}
```

Em `src/lib/equipe/equipeWrites.js`, com `import { MOV, novaMovimentacao } from './ficha.js';`:

```js
// Readmitir: a ficha volta a ativa, com a readmissão na lista, e o professor
// volta à agenda. O acesso volta pelo "Dar acesso", com um login novo.
export async function readmitir(db, pessoa, { data, vinculo }, autor, agora = new Date()) {
  const movs = Array.isArray(pessoa.ficha?.movimentacoes) ? pessoa.ficha.movimentacoes : [];
  await gravarBloco(db, pessoa, {
    status: 'ativo', vinculo,
    movimentacoes: [...movs, novaMovimentacao({ tipo: MOV.READMISSAO, data, vinculo, autor, agora })],
  }, autor);
  if (pessoa.professor) await gravarProfessor(db, pessoa.professor.id, { ativo: true });
}
```

- [ ] **Step 4: Criar `src/views/settings/equipe/DesligarDialog.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { isClientLead } from '../../../lib/leads.js';
import { leadsWhere } from '../../../lib/settingsLeads.js';
import { TIPOS_DESLIGAMENTO, hojeIso } from '../../../lib/equipe/ficha.js';
import { substitutosPossiveis } from '../../../lib/equipe/desligamento.js';
import { desligarPessoa } from '../../../lib/equipe/acessoApi.js';
import { gravarBloco } from '../../../lib/equipe/equipeWrites.js';
import { DialogField, FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';

const PILULA = (on) => cn('h-9 rounded-full border px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco',
  on ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground');

// O desligamento (spec "Desligar"). Conta, ao abrir, os leads do consultor e
// os alunos do professor, lidos na hora. O servidor confere tudo de novo.
export function DesligarDialog({ open, onOpenChange, db, appUser, pessoa, professores, modalities, agora = new Date(), onDesligada }) {
  const toast = useToast();
  const primeiro = pessoa.nome.split(' ')[0];
  const [data, setData] = useState(hojeIso(agora));
  const [tipo, setTipo] = useState('pedido_demissao');
  const [motivo, setMotivo] = useState('');
  const [subs, setSubs] = useState({});
  const [contagem, setContagem] = useState(null); // { leads, alunos, ativos }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let vivo = true;
    Promise.all([
      pessoa.user ? leadsWhere(db, 'consultantId', '==', pessoa.user.id) : [],
      pessoa.professor ? leadsWhere(db, 'professorId', '==', pessoa.professor.id) : [],
    ]).then(([leads, alunos]) => { if (vivo) setContagem({ leads: leads.length, alunos: alunos.length, ativos: alunos.filter(isClientLead).length }); })
      .catch((e) => { console.error('Erro ao contar a carteira:', e?.code || e); if (vivo) setContagem({ leads: 0, alunos: 0, ativos: 0 }); });
    return () => { vivo = false; };
  }, [open, db, pessoa]);

  const modsNome = new Map((modalities || []).map((m) => [m.id, m.name]));
  const possiveis = pessoa.professor ? substitutosPossiveis(pessoa.professor, professores) : [];
  const bloqueado = contagem?.leads > 0;
  const precisaSub = contagem?.alunos > 0;
  const faltaSub = precisaSub && possiveis.some((s) => !subs[s.modalidadeId]);
  const falta = !contagem ? 'Conferindo a carteira…'
    : bloqueado ? `Passe os leads de ${primeiro} antes`
      : faltaSub ? 'Escolha quem fica com os alunos'
        : data > hojeIso(agora) ? 'A data precisa ser hoje ou antes' : null;

  const desligar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      if (!pessoa.ficha) await gravarBloco(db, pessoa, {}, { id: appUser?.id ?? null });
      const r = await desligarPessoa({ fichaId: pessoa.id, data, tipoDesligamento: tipo, motivo, substitutos: precisaSub ? subs : {} });
      if (r.erro) { setErro(r.erro); return; }
      toast.success(`${pessoa.nome} saiu da equipe.`);
      onOpenChange(false);
      onDesligada?.();
    } catch (e) {
      console.error('Erro ao desligar:', e?.code || e);
      setErro('Não deu para desligar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogTitle>Desligar {pessoa.nome}</DialogTitle>
        <DialogDescription>O acesso sai na hora. A ficha e o histórico ficam guardados em Desligados.</DialogDescription>
        <div className="flex flex-col gap-4" inert={salvando || undefined}>
          {bloqueado && (
            <p className="rounded-xl bg-rose-500/10 p-3 text-[13px] text-rose-700 dark:text-rose-300">
              {primeiro} ainda é dono de {contagem.leads} {contagem.leads === 1 ? 'lead' : 'leads'}, contando clientes e perdas. Passe a carteira em Configurações → Migrar leads, marcando Leads em aberto, Clientes ativos e Perdas, e volte aqui.
            </p>
          )}
          <div className="max-w-[220px]"><DialogField label="Data do desligamento"><input type="date" max={hojeIso(agora)} className={FIELD_INPUT} value={data} onChange={(e) => setData(e.target.value)} /></DialogField></div>
          <DialogField label="Tipo">
            <div role="radiogroup" aria-label="Tipo de desligamento" className="flex flex-wrap gap-2">
              {TIPOS_DESLIGAMENTO.map((t) => <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} className={PILULA(tipo === t.id)} onClick={() => setTipo(t.id)}>{t.label}</button>)}
            </div>
          </DialogField>
          <DialogField label="Motivo (opcional, só o gestor vê)">
            <textarea rows={2} className={cn(FIELD_INPUT, 'h-auto py-2')} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: mudou de cidade" />
          </DialogField>
          {precisaSub && (
            <div className="flex flex-col gap-2 rounded-xl bg-brand-50 p-3 text-[13px] dark:bg-brand-500/15">
              <p>{primeiro} tem {contagem.ativos} {contagem.ativos === 1 ? 'aluno ativo' : 'alunos ativos'} na carteira ({contagem.alunos} contando ex-alunos). Quem fica com eles?</p>
              {possiveis.map(({ modalidadeId, opcoes }) => (
                <DialogField key={modalidadeId} label={modsNome.get(modalidadeId) || 'Modalidade'}>
                  <select name={`sub-${modalidadeId}`} className={FIELD_INPUT} value={subs[modalidadeId] || ''} onChange={(e) => setSubs((s) => ({ ...s, [modalidadeId]: e.target.value }))}>
                    <option value="">Escolha o professor</option>
                    {opcoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </DialogField>
              ))}
              <p className="text-[12.5px] text-muted-foreground">A troca entra no histórico de cada aluno, e a renovação de antes do desligamento continua contando para {primeiro}.</p>
            </div>
          )}
          {erro && <p role="alert" className="text-[13px] font-semibold text-rose-700 dark:text-rose-400">{erro}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="min-w-0 flex-1 text-[13px] text-muted-foreground">{falta || 'Pronto para desligar.'}</p>
            <SettingsBtn size={38} onClick={() => onOpenChange(false)}>Cancelar</SettingsBtn>
            <SettingsBtn size={38} kind="danger" disabled={!!falta || salvando} onClick={desligar}>{salvando ? 'Desligando…' : `Desligar ${primeiro}`}</SettingsBtn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Se o `SettingsBtn` não tiver o tom `danger` no `BTN_KINDS`, acrescente-o com o vermelho cheio (`bg-rose-600 text-white hover:bg-rose-700`) e a folga do anel de foco do fundo sólido (`focus-visible:ring-offset-2 focus-visible:ring-offset-background`), que o `anelDeFoco.test.js` cobra.

- [ ] **Step 5: Criar `src/views/settings/equipe/ReadmitirDialog.jsx`**

```jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { VINCULOS, hojeIso, isVinculo } from '../../../lib/equipe/ficha.js';
import { readmitir } from '../../../lib/equipe/equipeWrites.js';
import { DialogField, FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';

const PILULA = (on) => cn('h-9 rounded-full border px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco',
  on ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground');

// Readmitir: data e vínculo. O acesso volta depois, pelo "Dar acesso".
export function ReadmitirDialog({ open, onOpenChange, db, appUser, pessoa, agora = new Date() }) {
  const toast = useToast();
  const [data, setData] = useState(hojeIso(agora));
  const [vinculo, setVinculo] = useState(pessoa.ficha?.vinculo || '');
  const [salvando, setSalvando] = useState(false);
  const falta = !isVinculo(vinculo) ? 'Escolha o vínculo' : data > hojeIso(agora) ? 'A data precisa ser hoje ou antes' : null;

  const salvar = async () => {
    setSalvando(true);
    try {
      await readmitir(db, pessoa, { data, vinculo }, { id: appUser?.id ?? null, nome: appUser?.name ?? null }, agora);
      toast.success(`${pessoa.nome} voltou para a equipe. Dê acesso na aba Acesso ao app, se precisar.`);
      onOpenChange(false);
    } catch (e) {
      console.error('Erro ao readmitir:', e?.code || e);
      toast.error('Não deu para readmitir. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>Readmitir {pessoa.nome}</DialogTitle>
        <DialogDescription>A pessoa volta para a lista de ativos. O acesso ao app é dado depois, na ficha.</DialogDescription>
        <div className="flex flex-col gap-4" inert={salvando || undefined}>
          <div className="max-w-[220px]"><DialogField label="Data da readmissão"><input type="date" max={hojeIso(agora)} className={FIELD_INPUT} value={data} onChange={(e) => setData(e.target.value)} /></DialogField></div>
          <DialogField label="Vínculo">
            <div role="radiogroup" aria-label="Vínculo" className="flex flex-wrap gap-2">
              {VINCULOS.map((v) => <button key={v.id} type="button" role="radio" aria-checked={vinculo === v.id} className={PILULA(vinculo === v.id)} onClick={() => setVinculo(v.id)}>{v.label}</button>)}
            </div>
          </DialogField>
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="min-w-0 flex-1 text-[13px] text-muted-foreground">{falta || ''}</p>
            <SettingsBtn size={38} onClick={() => onOpenChange(false)}>Cancelar</SettingsBtn>
            <SettingsBtn size={38} kind="primary" disabled={!!falta || salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Readmitir'}</SettingsBtn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Ligar na ficha**

Em `src/views/settings/TeamAccessSection.jsx`, no topo do componente (antes dos `return`):

```jsx
  const [desligando, setDesligando] = useState(false);
  const [readmitindo, setReadmitindo] = useState(false);
  const podeDesligar = !!pessoa && !pessoa.desligada
    && !(pessoa.user && (isGestor(pessoa.user) || pessoa.user.id === appUser?.id || pessoa.user.authUid === appUser?.authUid));
  const botaoMov = pessoa?.desligada
    ? <SettingsBtn size={36} onClick={() => setReadmitindo(true)}>Readmitir</SettingsBtn>
    : podeDesligar ? <SettingsBtn size={36} kind="danger" onClick={() => setDesligando(true)}>Desligar</SettingsBtn> : null;
```

Passe `acoesDaFicha={botaoMov}` e `acoesDasMovimentacoes={botaoMov}` ao `EquipeFicha` e monte, no ramo da ficha:

```jsx
        {pessoa && !pessoa.desligada && (
          <DesligarDialog key={`d-${pessoa.id}`} open={desligando} onOpenChange={setDesligando} db={db} appUser={appUser} pessoa={pessoa}
            professores={professores} modalities={modalities} agora={agora} onDesligada={onLeadsChanged} />
        )}
        {pessoa?.desligada && (
          <ReadmitirDialog key={`r-${pessoa.id}`} open={readmitindo} onOpenChange={setReadmitindo} db={db} appUser={appUser} pessoa={pessoa} agora={agora} />
        )}
```

- [ ] **Step 7: Rodar**

Run: `npx vitest run src/lib/__tests__/desligarDialog.behavior.test.js src/lib/__tests__/equipeWrites.test.js src/lib/__tests__/equipe src/lib/__tests__/focusRing.test.js src/lib/__tests__/anelDeFoco.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/equipe/acessoApi.js src/lib/equipe/equipeWrites.js src/views/settings/equipe/DesligarDialog.jsx src/views/settings/equipe/ReadmitirDialog.jsx src/views/settings/TeamAccessSection.jsx src/lib/__tests__/desligarDialog.behavior.test.js src/lib/__tests__/equipeWrites.test.js
git commit -m "feat: desligar e readmitir pela ficha da equipe"
```

---

### Task 4: Documentação e verificação

- [ ] **Step 1: `CLAUDE.md`, seção "Equipe & acessos"**

Acrescente:

```markdown
- **Desligar** é a ação `desligar` do `api/admin-users.js`: recusa o gestor, a si mesmo e o consultor que ainda é dono de lead (com o texto do Migrar leads); passa todo lead com o professor que sai (ex-alunos inclusive) ao substituto da modalidade, pelo `professorChangePatch` com a data do desligamento (`src/lib/equipe/desligamento.js`, regra de plano do perfil do professor); grava `ativo: false` no professor; apaga a conta pelo `excluirAcesso`, o mesmo caminho do `delete`; e só então grava a ficha como desligada, com a movimentação. Cada passo pode rodar de novo sem estrago. O motivo não vai para o log.
- **Readmitir** é gravação do app (`readmitir`, em `equipeWrites.js`): a ficha volta a ativa com a readmissão e o professor volta à agenda. O acesso volta pelo "Dar acesso", com um login novo.
```

- [ ] **Step 2: Verificação completa**

Run: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Expected: verde.

- [ ] **Step 3: Conferir no navegador**

Com o harness: desligar um consultor com leads (bloqueado), um consultor sem leads, um professor com alunos (o botão só acende com o substituto), a ficha em Desligados e o readmitir, a 1280 px e a 375 px, claro e escuro. Apague o harness antes do commit.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: desligar e readmitir no CLAUDE.md"
```

---

## Depois dos três PRs

- Atualizar a linha do Stronilead em "Sistemas Ativos" e a tabela "Últimas Atualizações" do `CLAUDE.md` da raiz da STRONIX-FIRMA com o que entrou em produção.
- O plano de carreira configurável (trilhas Consultor, Professor e Estagiário) é a próxima spec: a trilha sai da função e do vínculo da ficha.
