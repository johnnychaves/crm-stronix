# Match em lote no /api/zap — Plano de Implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam caixinha (`- [ ]`) para acompanhamento.

**Objetivo:** o Stronizap perguntar, num lote só, quais de até 30 telefones têm cadastro nesta academia, recebendo de volta apenas a lista dos que existem.

**Arquitetura:** entra como uma ação nova (`action: 'match'`) no `POST /api/zap`, que já existe, sem gastar função nova na Vercel (11 de 12 no plano Hobby). Diferente de `generate` e `revoke`, que exigem o admin logado, o `match` autentica pela chave do Zap, igual ao `GET`. A consulta usa o campo indexado `zapMatchKey` com o operador `in` do Firestore, cujo teto é 30 valores.

**Stack:** JavaScript (sem TypeScript), Firebase Admin SDK, funções serverless da Vercel, vitest.

**Spec:** `stronizap/docs/superpowers/specs/2026-09-16-painel-de-cobertura-do-crm-design.md`

---

## Convenções para todas as tarefas

- Branch: `feat/match-em-lote-no-zap`. **Nunca commitar na `main`.**
- Testes: `npx vitest run --exclude '.claude/**'`. A linha de base em 16/09/2026 é 61 arquivos e 1.303 testes passando. O `--exclude` tira as cópias do projeto em `.claude/worktrees`, que inflam a contagem.
- Lint: `npm run lint`. Existe 1 aviso antigo no `SuperAdminView`, que não é desta mudança.
- Commits em português, formato `tipo: descrição curta`, terminando com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- O hook GateGuard desta máquina pode bloquear o primeiro Bash da sessão e a primeira criação ou edição de cada arquivo, pedindo "fatos" (o pedido do usuário, o que o comando faz, quem usa o arquivo). Responda os fatos em texto e repita a mesma operação.
- **Em `api/`, `snap.exists` é propriedade, não função.** É o SDK de servidor. Em `src/` é o do navegador, onde `exists()` é função. Trocar um pelo outro já derrubou a rota em produção.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `api/zap.js` (modificar) | Ganha `handleMatch` e dois helpers extraídos do `GET`: `loadZapIntegration` e `leadsCollection` |
| `api/__tests__/zapRoute.test.js` (modificar) | O banco falso passa a entender `where(..., 'in', [...])` e `get()` sem `limit()`; testes novos da ação |
| `CLAUDE.md` (modificar) | Registra que o `POST` passou a ter dois caminhos de autenticação |

Nenhum arquivo novo. O casamento de telefone continua em `api/_zapPhone.js`, intocado.

---

### Tarefa 1: O banco falso entende `in` e `get()` sem `limit()`

Hoje o fake de `api/__tests__/zapRoute.test.js` só responde `where(campo, '==', valor).limit(n).get()`. A ação nova consulta `where('zapMatchKey', 'in', [...]).get()`, sem `limit`. Sem este passo, o teste da tarefa 2 falharia por falta de função no fake, e não pela funcionalidade faltando.

**Arquivos:**
- Modificar: `api/__tests__/zapRoute.test.js`

- [ ] **Passo 1: trocar o `where` do banco falso**

Dentro de `vi.mock('../_firebaseAdmin.js', ...)`, substitua o bloco `where: (campo, _op, valor) => ({ ... })` inteiro por:

```js
    where: (campo, op, valor) => {
      const filtra = () =>
        banco.leads.filter((l) => (op === 'in' ? valor.includes(l[campo]) : l[campo] === valor));
      const paraDocs = (linhas) => linhas.map(({ id, ...dados }) => ({ id, data: () => dados }));
      const resposta = (linhas) => {
        const docs = paraDocs(linhas);
        return { empty: docs.length === 0, docs };
      };
      return {
        limit: (n) => ({ get: async () => resposta(filtra().slice(0, n)) }),
        get: async () => resposta(filtra())
      };
    },
```

- [ ] **Passo 2: rodar os testes que já existem**

```bash
cd ~/STRONIX-FIRMA/06-sistemas/stronilead
npx vitest run api/__tests__/zapRoute.test.js --exclude '.claude/**'
```

Esperado: `Tests 3 passed (3)`. O fake mudou de forma e o comportamento do `GET` continua o mesmo.

- [ ] **Passo 3: commit**

```bash
git add api/__tests__/zapRoute.test.js
git commit -m "test(zap): banco falso entende consulta in e get sem limit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 2: A ação `match` responde quem existe

**Arquivos:**
- Modificar: `api/__tests__/zapRoute.test.js`
- Modificar: `api/zap.js`

- [ ] **Passo 1: escrever o teste que falha**

Acrescente ao fim de `api/__tests__/zapRoute.test.js`:

```js
describe('POST /api/zap com action match', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    const gerada = generateZapKey();
    chave = gerada.key;
    banco.tenant = {
      integrations: { zap: { keyHash: gerada.keyHash, keyPrefix: gerada.keyPrefix, revokedAt: null } }
    };
    banco.leads = [];
    banco.config = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const pedidoMatch = (phones) => ({
    method: 'POST',
    headers: { 'x-stronizap-key': chave },
    body: { action: 'match', tenant: TENANT, phones }
  });

  it('devolve só os telefones que têm cadastro', async () => {
    banco.leads = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['5511987654321', '5511900000000']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: ['5511987654321'] });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run api/__tests__/zapRoute.test.js --exclude '.claude/**'
```

Esperado: FALHA. A ação cai no caminho do admin e responde 401 "Não autenticado", porque `verifyRequest` devolve `null` no mock.

- [ ] **Passo 3: extrair os dois helpers do `GET`**

Em `api/zap.js`, logo abaixo das constantes do topo (`CONFIG_GENERAL_ID`), acrescente:

```js
const MATCH_MAX = 30; // teto do operador `in` do Firestore

const leadsCollection = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(LEADS_PATH);

/** Integração do tenant, ou null quando o tenant não existe ou a chave foi revogada. */
async function loadZapIntegration(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  const zap = tenantSnap.exists ? tenantSnap.data()?.integrations?.zap : null;
  if (!zap?.keyHash || zap.revokedAt) return null;
  return zap;
}
```

No `GET`, troque o bloco que carrega o tenant e monta a coleção de leads por:

```js
  const zap = await loadZapIntegration(tenantId);
  if (!zap || !verifyZapKey(chave, zap.keyHash)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }

  const achados = await leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get();
```

- [ ] **Passo 4: implementar a ação**

Em `api/zap.js`, na primeira linha de `handlePost`, antes do `try`:

```js
  // A ação match é a única do POST que autentica pela chave do Zap. As outras
  // duas (generate e revoke) são do admin logado e seguem exigindo ID token.
  if (req.body?.action === 'match') return handleMatch(req, res);
```

E acrescente a função logo depois de `handlePost`:

```js
// Diz quais dos telefones recebidos têm cadastro nesta academia. Devolve os
// telefones NA FORMA EM QUE CHEGARAM, para o Stronizap não precisar recalcular
// a chave de casamento. Nada além disso sai daqui: nem nome, nem id, nem plano.
async function handleMatch(req, res) {
  const chave = req.headers['x-stronizap-key'];
  const tenantId = String(req.body?.tenant ?? '').trim();
  const phones = req.body?.phones;

  if (!chave || !tenantId) {
    return res.status(401).json({ error: 'Credencial ausente' });
  }
  if (!Array.isArray(phones)) {
    return res.status(400).json({ error: 'Envie a lista de telefones em phones.' });
  }
  if (phones.length > MATCH_MAX) {
    return res.status(400).json({ error: `No máximo ${MATCH_MAX} telefones por chamada.` });
  }

  const zap = await loadZapIntegration(tenantId);
  if (!zap || !verifyZapKey(chave, zap.keyHash)) {
    return res.status(401).json({ error: 'Credencial inválida' });
  }

  // Telefone que não vira chave válida (menos de 10 dígitos) fica fora da
  // consulta e volta como não encontrado, sem derrubar o lote. Dois telefones
  // podem cair na mesma chave (com e sem o nono dígito), e os dois voltam.
  const porChave = new Map();
  for (const phone of phones) {
    const chaveTelefone = zapMatchKey(phone);
    if (!chaveTelefone) continue;
    const lista = porChave.get(chaveTelefone) || [];
    lista.push(String(phone));
    porChave.set(chaveTelefone, lista);
  }
  if (porChave.size === 0) {
    return res.status(200).json({ found: [] });
  }

  const snap = await leadsCollection(tenantId).where('zapMatchKey', 'in', [...porChave.keys()]).get();
  const found = new Set();
  for (const doc of snap.docs) {
    for (const phone of porChave.get(doc.data()?.zapMatchKey) || []) found.add(phone);
  }
  return res.status(200).json({ found: [...found] });
}
```

- [ ] **Passo 5: rodar e ver passar**

```bash
npx vitest run api/__tests__/zapRoute.test.js --exclude '.claude/**'
```

Esperado: `Tests 4 passed (4)`.

- [ ] **Passo 6: commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat(zap): ação match responde quais telefones têm cadastro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 3: As recusas e as bordas

**Arquivos:**
- Modificar: `api/__tests__/zapRoute.test.js`

- [ ] **Passo 1: escrever os testes**

Dentro do `describe('POST /api/zap com action match', ...)`, acrescente:

```js
  it('casa com e sem o nono dígito, e devolve as duas formas', async () => {
    banco.leads = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['5511987654321', '551187654321']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.found.sort()).toEqual(['551187654321', '5511987654321']);
  });

  it('telefone curto demais volta como não encontrado, sem derrubar o lote', async () => {
    banco.leads = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['123', '5511987654321']), res);

    expect(res.body).toEqual({ found: ['5511987654321'] });
  });

  it('lote acima de 30 é recusado', async () => {
    const res = resposta();
    const muitos = Array.from({ length: 31 }, (_, i) => `55119876543${String(i).padStart(2, '0')}`);

    await handler(pedidoMatch(muitos), res);

    expect(res.statusCode).toBe(400);
  });

  it('phones que não é lista é recusado', async () => {
    const res = resposta();

    await handler(pedidoMatch('5511987654321'), res);

    expect(res.statusCode).toBe(400);
  });

  it('chave errada responde 401 e não devolve lista', async () => {
    banco.leads = [clienteAVencer];
    const res = resposta();
    const pedido = pedidoMatch(['5511987654321']);
    pedido.headers['x-stronizap-key'] = 'szk_chave_que_nao_existe';

    await handler(pedido, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.found).toBeUndefined();
  });

  it('chave revogada responde 401', async () => {
    banco.tenant.integrations.zap.revokedAt = new Date();
    const res = resposta();

    await handler(pedidoMatch(['5511987654321']), res);

    expect(res.statusCode).toBe(401);
  });

  it('a resposta tem só a lista, sem nenhum outro campo', async () => {
    banco.leads = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['5511987654321']), res);

    expect(Object.keys(res.body)).toEqual(['found']);
  });
```

- [ ] **Passo 2: rodar**

```bash
npx vitest run api/__tests__/zapRoute.test.js --exclude '.claude/**'
```

Esperado: `Tests 11 passed (11)`. Todos passam de primeira, porque a tarefa 2 já implementou as recusas. São testes de guarda: travam o comportamento para quem mexer aqui depois.

- [ ] **Passo 3: commit**

```bash
git add api/__tests__/zapRoute.test.js
git commit -m "test(zap): recusas e bordas da ação match

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Suíte, lint, documentação e PR

**Arquivos:**
- Modificar: `CLAUDE.md`

- [ ] **Passo 1: rodar tudo**

```bash
npx vitest run --exclude '.claude/**'
npm run lint
```

Esperado: 1.311 testes passando (1.303 da linha de base mais 8 novos) e o lint com o aviso antigo do `SuperAdminView`, sem erro novo.

- [ ] **Passo 2: registrar no CLAUDE.md**

Na seção "Ponte com o Stronizap", logo depois do parágrafo que começa com `**A chave é emitida aqui.**`, acrescente:

```markdown
**O `POST` tem dois donos.** `generate` e `revoke` são do admin logado e autenticam por ID token. `match` é do próprio Stronizap e autentica pela chave, igual ao `GET`: recebe até 30 telefones e responde só quais existem, sem nome, id ou plano. O teto de 30 é do operador `in` do Firestore.
```

- [ ] **Passo 3: commit, push e PR**

```bash
git add CLAUDE.md
git commit -m "docs: o POST do zap tem dois caminhos de autenticação

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin HEAD
gh pr create --title "feat(zap): ação match em lote para o painel de cobertura" --body "$(cat <<'CORPO'
Primeira metade do painel de cobertura do CRM. A outra metade é o PR do Stronizap.

A ação `match` recebe até 30 telefones e responde só quais têm cadastro nesta academia. Sem nome, sem id, sem plano.

Autentica pela chave do Zap, igual ao `GET`. As ações `generate` e `revoke` continuam exigindo o admin logado.

Spec: `stronizap/docs/superpowers/specs/2026-09-16-painel-de-cobertura-do-crm-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
CORPO
)"
```

---

## Critérios de pronto

- [ ] `npx vitest run --exclude '.claude/**'` passa inteiro
- [ ] `npm run lint` sem erro novo
- [ ] A ação responde 401 para chave ausente, inválida e revogada
- [ ] A ação responde 400 para lote acima de 30 e para `phones` que não é lista
- [ ] A resposta tem só o campo `found`
- [ ] O `GET` continua com o mesmo comportamento, provado pelos 3 testes que já existiam
