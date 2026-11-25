# PR 1: histórico de troca de professor. Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** todo lead passa a guardar quem foi o professor dele e desde quando, para a renovação da carteira saber quem era o professor no dia do vencimento.

**Arquitetura:** um módulo puro, `src/lib/professorHistory.js`, monta o patch da troca (`professorChangePatch`) e lê o professor numa data (`professorAt`). Os três caminhos que gravam o professor do lead passam a usar o montador. Uma varredura reprova arquivo novo que grave `professorId` sem revisão. Não muda regra do Firestore: o consultor e o gestor já gravam qualquer campo do lead, e o professor não grava `professorId` (fica fora da `professorLeadFields()`).

**Stack:** JavaScript, Vitest, Firebase JS SDK (só nos arquivos `*Writes.js`).

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`, seção "Histórico de troca de professor, no lead". Plano mestre: `docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md`.

---

## O formato do histórico

```js
lead.professorHistory = [
  { professorId: 'p1', since: null },                 // desde antes do histórico
  { professorId: 'p2', since: Timestamp(2026-12-01) }, // troca registrada
  { professorId: null, since: Timestamp(2027-03-10) }, // professor tirado
]
```

- Lead sem `professorHistory` vale o `professorId` atual para qualquer data.
- O primeiro professor de um lead que não tinha professor nem histórico não grava histórico: vale "desde sempre", a mesma leitura do lead sem histórico. Assim, matrícula e importação não criam troca falsa.
- A primeira troca de verdade grava duas entradas: quem era antes, com `since: null`, e o novo, com a data.
- Escolher o mesmo professor não grava nada novo.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/professorHistory.js` | Novo. `professorChangePatch` e `professorAt`. Importa só `./dates.js`. |
| `src/lib/__tests__/professorHistory.test.js` | Novo. Testes do módulo. |
| `src/lib/contextPatch.js` | O caso `professorId` passa pelo montador. Recebe `lead` e `now`. |
| `src/lib/contextWrites.js` | Passa o `lead` ao `buildContextPatch`. |
| `src/lib/__tests__/contextPatch.test.js` | Dois testes novos. |
| `src/lib/aulasWrites.js` | `markConvertingAula` lê o lead e passa pelo montador. |
| `src/lib/__tests__/aulasWrites.test.js` | Dois testes novos. |
| `src/lib/clientImport.js` | `buildFillPatch` passa pelo montador. |
| `src/lib/__tests__/clientImport.test.js` | Dois testes novos. |
| `src/lib/__tests__/historicoDoProfessor.sweep.test.js` | Novo. A varredura. |
| `CLAUDE.md` | Seção nova "Perfil do professor", só com a regra do histórico. |

---

### Tarefa 0: preparar a branch

- [ ] **Passo 1: partir do `origin/main` do dia**

A spec e os planos estão na branch `claude/perfil-professor-nps-67a885`. O PR 1 sai dela, depois de trazer o `origin/main` do dia:

```bash
git fetch
git checkout claude/perfil-professor-nps-67a885
git rebase origin/main
npm ci
git status --short package-lock.json
```

Esperado: o rebase termina sem conflito (a branch só tem arquivos novos em `docs/`), e o `git status` não lista o `package-lock.json`.

- [ ] **Passo 2: linha de base**

```bash
npm run lint && npm test
```

Esperado: tudo passa. Se algo já falha antes de mexer, anote o nome do teste e não siga sem avisar o Johnny.

---

### Tarefa 1: o módulo do histórico

**Arquivos:**
- Criar: `src/lib/professorHistory.js`
- Criar: `src/lib/__tests__/professorHistory.test.js`

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professorHistory.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { professorChangePatch, professorAt } from '../professorHistory.js';

const t = (iso) => new Date(iso);
// O Firestore devolve Timestamp, com toDate(). O teste usa um igual.
const ts = (iso) => ({ toDate: () => new Date(iso) });

describe('professorChangePatch', () => {
  it('não grava nada quando o professor é o mesmo', () => {
    expect(professorChangePatch({ professorId: 'p1' }, 'p1', 'Bruno')).toBeNull();
    expect(professorChangePatch({ professorId: null }, '', null)).toBeNull();
    expect(professorChangePatch({}, null, null)).toBeNull();
  });

  it('o primeiro professor de um lead sem professor e sem histórico não grava histórico', () => {
    expect(professorChangePatch({}, 'p1', 'Bruno', t('2026-12-01T12:00:00Z')))
      .toEqual({ professorId: 'p1', professorName: 'Bruno' });
  });

  it('a primeira troca grava quem era antes, desde sempre, e o novo com a data', () => {
    const at = t('2026-12-01T12:00:00Z');
    expect(professorChangePatch({ professorId: 'p1', professorName: 'Bruno' }, 'p2', 'Heloísa', at)).toEqual({
      professorId: 'p2',
      professorName: 'Heloísa',
      professorHistory: [{ professorId: 'p1', since: null }, { professorId: 'p2', since: at }],
    });
  });

  it('a troca seguinte só acrescenta', () => {
    const a = ts('2026-12-01T12:00:00Z');
    const b = t('2027-02-10T12:00:00Z');
    const lead = { professorId: 'p2', professorHistory: [{ professorId: 'p1', since: null }, { professorId: 'p2', since: a }] };
    expect(professorChangePatch(lead, 'p3', 'Carla', b).professorHistory).toEqual([
      { professorId: 'p1', since: null },
      { professorId: 'p2', since: a },
      { professorId: 'p3', since: b },
    ]);
  });

  it('tirar o professor grava null no histórico e limpa o nome', () => {
    const at = t('2026-12-01T12:00:00Z');
    expect(professorChangePatch({ professorId: 'p1', professorName: 'Bruno' }, null, 'Bruno', at)).toEqual({
      professorId: null,
      professorName: null,
      professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: at }],
    });
  });

  it('o lead que perdeu o professor e ganha outro acrescenta, porque já tem histórico', () => {
    const a = ts('2026-12-01T12:00:00Z');
    const b = t('2027-01-05T12:00:00Z');
    const lead = { professorId: null, professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: a }] };
    expect(professorChangePatch(lead, 'p2', 'Heloísa', b)).toEqual({
      professorId: 'p2',
      professorName: 'Heloísa',
      professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: a }, { professorId: 'p2', since: b }],
    });
  });

  it('sem nome, grava o nome como null', () => {
    expect(professorChangePatch({}, 'p1')).toEqual({ professorId: 'p1', professorName: null });
  });
});

describe('professorAt', () => {
  it('lead sem histórico vale o professor atual em qualquer data', () => {
    expect(professorAt({ professorId: 'p1' }, t('2020-01-01T00:00:00Z'))).toBe('p1');
    expect(professorAt({}, t('2026-01-01T00:00:00Z'))).toBeNull();
  });

  const lead = {
    professorId: 'p3',
    professorHistory: [
      { professorId: 'p1', since: null },
      { professorId: 'p2', since: ts('2026-12-01T12:00:00Z') },
      { professorId: 'p3', since: ts('2027-02-10T12:00:00Z') },
    ],
  };

  it('lê o professor da data pelo histórico', () => {
    expect(professorAt(lead, t('2026-06-01T00:00:00Z'))).toBe('p1');
    expect(professorAt(lead, t('2027-01-15T00:00:00Z'))).toBe('p2');
    expect(professorAt(lead, t('2027-05-01T00:00:00Z'))).toBe('p3');
  });

  it('no instante da troca já vale o novo professor', () => {
    expect(professorAt(lead, t('2026-12-01T12:00:00Z'))).toBe('p2');
  });

  it('o período sem professor devolve null', () => {
    const semProf = { professorId: null, professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: ts('2026-12-01T12:00:00Z') }] };
    expect(professorAt(semProf, t('2027-01-01T00:00:00Z'))).toBeNull();
    expect(professorAt(semProf, t('2026-11-01T00:00:00Z'))).toBe('p1');
  });

  it('data inválida devolve o professor atual', () => {
    expect(professorAt(lead, 'não é data')).toBe('p3');
    expect(professorAt(lead, null)).toBe('p3');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professorHistory.test.js
```

Esperado: FAIL, porque `../professorHistory.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professorHistory.js`:

```js
// Histórico de troca de professor no lead (spec
// docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md). O lead
// guarda o professor atual em professorId e, desde a primeira troca, a lista
// professorHistory: { professorId, since }, na ordem, com since null na
// primeira entrada (o professor de antes do histórico). Sem a lista, a
// renovação da carteira não sabe quem era o professor no dia do vencimento.
//
// Toda gravação do professor do lead passa por professorChangePatch, e a
// varredura historicoDoProfessor.sweep.test.js cobra isso. Puro, e só importa
// ./dates.js, porque a api/ do perfil vai ler a carteira por aqui.
import { getSafeDateOrNull } from './dates.js';

const idOf = (v) => (typeof v === 'string' && v.trim() ? v : null);
const historyOf = (lead) => (Array.isArray(lead?.professorHistory) ? lead.professorHistory : []);

// O patch da troca de professor, ou null quando nada muda.
// O primeiro professor de um lead sem professor e sem histórico não grava
// histórico: vale desde sempre, a mesma leitura do lead sem histórico. A
// primeira troca de verdade grava também quem era antes, com since null.
// shortcut: grava a lista inteira a partir do lead em mãos, então duas abas
// trocando o professor do mesmo lead no mesmo instante podem perder uma
// entrada. Trocar por arrayUnion se isso aparecer.
export function professorChangePatch(lead, nextId, nextName = null, at = new Date()) {
  const prev = idOf(lead?.professorId);
  const next = idOf(nextId);
  if (prev === next) return null;
  const patch = { professorId: next, professorName: next ? (nextName || null) : null };
  const history = historyOf(lead);
  if (!history.length && !prev) return patch;
  const before = history.length ? history : [{ professorId: prev, since: null }];
  return { ...patch, professorHistory: [...before, { professorId: next, since: at }] };
}

// Quem era o professor do lead num instante. Lead sem histórico, ou data
// inválida, devolve o professor atual. No instante da troca já vale o novo.
export function professorAt(lead, date) {
  const history = historyOf(lead);
  const when = getSafeDateOrNull(date)?.getTime();
  if (!history.length || when == null) return idOf(lead?.professorId);
  let current = null;
  for (const entry of history) {
    if (entry?.since == null) {
      current = idOf(entry?.professorId);
      continue;
    }
    const since = getSafeDateOrNull(entry.since)?.getTime();
    if (since != null && since <= when) current = idOf(entry.professorId);
  }
  return current;
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professorHistory.test.js
```

Esperado: PASS, 12 testes.

- [ ] **Passo 5: commit**

```bash
git add src/lib/professorHistory.js src/lib/__tests__/professorHistory.test.js
git commit -m "feat: histórico de troca de professor no lead (montador e leitura)"
```

---

### Tarefa 2: o Contexto comercial da ficha

**Arquivos:**
- Modificar: `src/lib/contextPatch.js` (o caso `professorId` e a assinatura de `buildContextPatch`)
- Modificar: `src/lib/contextWrites.js` (a chamada de `buildContextPatch`)
- Testar: `src/lib/__tests__/contextPatch.test.js`

- [ ] **Passo 1: escrever os testes**

Acrescente no `describe('buildContextPatch')` de `src/lib/__tests__/contextPatch.test.js`, logo depois do teste que já confere o professor (o que espera `{ professorId: 'p1', professorName: 'Marcos Vieira' }`):

```js
  it('professor: com o lead, a troca leva o histórico', () => {
    const at = new Date('2026-12-01T12:00:00Z');
    expect(buildContextPatch('professorId', 'p1', { professores, lead: { professorId: 'p0' }, now: at })).toEqual({
      professorId: 'p1',
      professorName: 'Marcos Vieira',
      professorHistory: [{ professorId: 'p0', since: null }, { professorId: 'p1', since: at }],
    });
  });

  it('professor: escolher o mesmo grava só o professor, sem histórico', () => {
    expect(buildContextPatch('professorId', 'p1', { professores, lead: { professorId: 'p1' } }))
      .toEqual({ professorId: 'p1', professorName: 'Marcos Vieira' });
  });
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/contextPatch.test.js
```

Esperado: FAIL no teste "a troca leva o histórico" (falta `professorHistory`). Os testes antigos continuam passando.

- [ ] **Passo 3: mudar o `contextPatch.js`**

No topo, acrescente o import:

```js
import { professorChangePatch } from './professorHistory.js';
```

Troque a assinatura:

```js
export function buildContextPatch(field, value, { usersList = [], professores = [], lead = null, now = new Date() } = {}) {
```

Troque o caso `professorId` por:

```js
    case 'professorId': {
      // A troca passa pelo montador do histórico. Escolher o mesmo professor
      // regrava os dois campos como antes, sem histórico.
      const id = value || null;
      const name = id ? professorNameById(professores, id) : null;
      return professorChangePatch(lead, id, name, now) || { professorId: id, professorName: name };
    }
```

- [ ] **Passo 4: passar o lead na gravação**

Em `src/lib/contextWrites.js`, dentro de `saveContextField`, troque:

```js
  const patch = buildContextPatch(field, value, { usersList, professores });
```

por:

```js
  const patch = buildContextPatch(field, value, { usersList, professores, lead });
```

- [ ] **Passo 5: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/contextPatch.test.js
```

Esperado: PASS, com os testes antigos e os dois novos.

- [ ] **Passo 6: commit**

```bash
git add src/lib/contextPatch.js src/lib/contextWrites.js src/lib/__tests__/contextPatch.test.js
git commit -m "feat: troca de professor pela ficha grava o histórico"
```

---

### Tarefa 3: o carimbo do professor na matrícula

`markConvertingAula` (`src/lib/aulasWrites.js`) grava no lead o professor da aula que converteu. Hoje ele sobrescreve o `professorId` sem ler o lead. Passa a ler o lead e a usar o montador.

**Arquivos:**
- Modificar: `src/lib/aulasWrites.js` (fim de `markConvertingAula`)
- Testar: `src/lib/__tests__/aulasWrites.test.js`

- [ ] **Passo 1: escrever os testes**

Em `src/lib/__tests__/aulasWrites.test.js`, acrescente `markConvertingAula` ao import de `'../aulasWrites.js'` e, no fim do arquivo, o bloco abaixo. O falso do Firestore do arquivo guarda todo documento no `m.docs` pelo id (inclusive no `getDoc`), e o `beforeEach` de topo já limpa o `m`, então o lead e a aula convivem no mesmo `Map`.

```js
describe('markConvertingAula grava o professor do lead pelo histórico', () => {
  it('troca de professor grava o histórico no lead', async () => {
    m.docs.set('lead-1', { name: 'Ana', professorId: 'p0', professorName: 'Bruno' });
    m.docs.set('aula-1', { leadId: 'lead-1', type: 'aula', status: 'attended', professorId: 'p1', professorName: 'Heloísa', scheduledFor: new Date('2026-12-01T18:00:00Z') });

    await markConvertingAula({ db: {}, leadId: 'lead-1' });

    const doLead = m.updates.find((u) => u.id === 'lead-1');
    expect(doLead.patch).toEqual({
      professorId: 'p1',
      professorName: 'Heloísa',
      professorHistory: [{ professorId: 'p0', since: null }, { professorId: 'p1', since: expect.any(Date) }],
    });
  });

  it('o mesmo professor não regrava o lead', async () => {
    m.docs.set('lead-1', { name: 'Ana', professorId: 'p1', professorName: 'Heloísa' });
    m.docs.set('aula-1', { leadId: 'lead-1', type: 'aula', status: 'attended', professorId: 'p1', professorName: 'Heloísa', scheduledFor: new Date('2026-12-01T18:00:00Z') });

    await markConvertingAula({ db: {}, leadId: 'lead-1' });

    expect(m.updates.find((u) => u.id === 'lead-1')).toBeUndefined();
    expect(m.updates.find((u) => u.id === 'aula-1').patch).toMatchObject({ converted: true });
  });
});
```

Antes de rodar, abra o `beforeEach` de topo do arquivo e confira que ele esvazia `m.docs`, `m.updates` e `m.adds`. Se não esvaziar algum, acrescente a limpeza que falta dentro deste `describe`, num `beforeEach` próprio.

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/aulasWrites.test.js
```

Esperado: FAIL nos dois testes novos. No primeiro falta `professorHistory`. No segundo, o lead é regravado.

- [ ] **Passo 3: mudar o `markConvertingAula`**

Em `src/lib/aulasWrites.js`, acrescente o import:

```js
import { professorChangePatch } from './professorHistory.js';
```

No fim de `markConvertingAula`, troque:

```js
  if (chosen.professorId && !chosen.soloTraining) {
    await updateDoc(
      doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId),
      { professorId: chosen.professorId, professorName: chosen.professorName || null }
    );
  }
```

por:

```js
  if (chosen.professorId && !chosen.soloTraining) {
    // Lê o lead para a troca entrar no histórico (professorHistory.js). O
    // mesmo professor não regrava nada.
    const leadRef = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId);
    const leadSnap = await getDoc(leadRef);
    const patch = professorChangePatch(leadSnap.exists() ? leadSnap.data() : {}, chosen.professorId, chosen.professorName || null);
    if (patch) await updateDoc(leadRef, patch);
  }
```

O `getDoc` já está no import de `firebase/firestore` do arquivo.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/aulasWrites.test.js
```

Esperado: PASS, com os testes antigos e os dois novos.

- [ ] **Passo 5: commit**

```bash
git add src/lib/aulasWrites.js src/lib/__tests__/aulasWrites.test.js
git commit -m "feat: professor carimbado na matrícula entra no histórico"
```

---

### Tarefa 4: o preenchimento da importação de clientes

`buildFillPatch` (`src/lib/clientImport.js`) preenche o professor de um lead que não tem. Num lead sem professor e sem histórico, o montador devolve só os dois campos, como hoje. Num lead que já teve professor e ficou sem, ele acrescenta a entrada no histórico.

O lead criado pela importação (`professorId: c.professorId || null` no `leadData`) continua igual: ele nasce com o professor, e lead sem histórico vale o professor atual.

**Arquivos:**
- Modificar: `src/lib/clientImport.js` (`buildFillPatch`)
- Testar: `src/lib/__tests__/clientImport.test.js`

- [ ] **Passo 1: escrever os testes**

No `describe('buildFillPatch')` de `src/lib/__tests__/clientImport.test.js`, acrescente:

```js
  it('preencher o professor de um lead que já teve um acrescenta ao histórico', () => {
    const since = new Date('2026-10-01T12:00:00Z');
    const lead = { name: 'Ana', professorId: null, professorHistory: [{ professorId: 'p0', since: null }, { professorId: null, since }] };
    const patch = buildFillPatch({ ...VALID, professorId: 'p1', professorName: 'Carlos' }, lead);
    expect(patch.professorId).toBe('p1');
    expect(patch.professorName).toBe('Carlos');
    expect(patch.professorHistory).toEqual([
      { professorId: 'p0', since: null },
      { professorId: null, since },
      { professorId: 'p1', since: expect.any(Date) },
    ]);
  });

  it('preencher o professor de um lead que nunca teve não cria histórico', () => {
    const patch = buildFillPatch({ ...VALID, professorId: 'p1', professorName: 'Carlos' }, { name: 'Ana' });
    expect(patch.professorId).toBe('p1');
    expect(patch).not.toHaveProperty('professorHistory');
  });
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/clientImport.test.js
```

Esperado: FAIL no primeiro teste novo (falta `professorHistory`). O segundo já passa.

- [ ] **Passo 3: mudar o `buildFillPatch`**

Em `src/lib/clientImport.js`, acrescente o import:

```js
import { professorChangePatch } from './professorHistory.js';
```

Troque:

```js
  if (blank(lead.professorId) && c.professorId) {
    patch.professorId = c.professorId;
    patch.professorName = c.professorName;
  }
```

por:

```js
  if (blank(lead.professorId) && c.professorId) {
    Object.assign(patch, professorChangePatch(lead, c.professorId, c.professorName));
  }
```

O resumo do que a planilha preencheu (`fillSummary`) ignora chave sem rótulo, então o `professorHistory` não aparece na revisão.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/clientImport.test.js
```

Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: professor preenchido pela importação entra no histórico"
```

---

### Tarefa 5: a varredura

Reprova arquivo novo que grave `professorId` sem passar pela revisão, e cobra que os três caminhos do lead usem o montador.

**Arquivos:**
- Criar: `src/lib/__tests__/historicoDoProfessor.sweep.test.js`

- [ ] **Passo 1: escrever a varredura**

```js
// Toda troca do professor do lead passa por professorChangePatch
// (src/lib/professorHistory.js), para entrar no histórico que a renovação da
// carteira lê (spec 2026-11-24-perfil-do-professor-design.md). Esta varredura
// lista os arquivos de src/ e api/ que têm professorId como chave de objeto.
// Arquivo novo na lista reprova até alguém conferir se ele grava o professor
// do lead e, se gravar, fazê-lo passar pelo montador.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSectionPatch, CADASTRO_SECTIONS } from '../cadastroSections.js';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));

function arquivosDeCodigo(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') out.push(...arquivosDeCodigo(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const CHAVE = /\bprofessorId\s*:|[{,]\s*professorId\s*[,}]/;

// Cada arquivo com o motivo de estar aqui.
const REVISADOS = {
  // Gravam o professor do lead, pelo montador.
  'src/lib/professorHistory.js': 'o montador',
  'src/lib/contextPatch.js': 'Contexto comercial da ficha, pelo montador',
  'src/lib/aulasWrites.js': 'registro da aula e carimbo da matrícula, pelo montador',
  'src/lib/clientImport.js': 'candidato da planilha, lead novo (nasce com o professor) e preenchimento pelo montador',
  // O cadastro completo monta o professor, mas nenhuma seção da aba Cadastro grava (teste abaixo).
  'src/lib/clientRegistration.js': 'formulário do cadastro completo',
  // Registro da aula em stronix_aulas, não o professor do lead.
  'src/lib/aulas.js': 'registro da aula',
  'src/components/profile/ScheduleWizard.jsx': 'escolha do professor da aula',
  'src/views/LeadProfileView.jsx': 'registro da aula do assistente',
  'src/views/DailyGoalView.jsx': 'registro da aula do Remarcar',
  'api/_zapSchedule.js': 'registro da aula do agendamento pelo Stronizap',
  // Só mostram ou contam.
  'src/components/profile/ContextCard.jsx': 'opções e valores da tela',
  'src/modals/RescheduleModal.jsx': 'id do campo no JSX',
  'src/lib/dashboardMetrics.js': 'contagem por professor',
  // Cadastro da equipe (stronix_users), não o lead.
  'src/lib/teamRoles.js': 'papel da equipe',
  'src/views/settings/TeamAccessSection.jsx': 'papel da equipe',
  'api/_professorLink.js': 'vínculo do login com o professor',
  'api/admin-users.js': 'papel da equipe',
  'api/invite-accept.js': 'convite de professor',
  'api/invite-create.js': 'convite de professor',
};

const comChave = [...arquivosDeCodigo(join(RAIZ, 'src')), ...arquivosDeCodigo(join(RAIZ, 'api'))]
  .filter((f) => CHAVE.test(readFileSync(f, 'utf8')))
  .map((f) => relative(RAIZ, f).split('\\').join('/'))
  .sort();

describe('gravação do professor do lead', () => {
  it('todo arquivo com professorId como chave foi revisado', () => {
    expect(comChave.filter((f) => !(f in REVISADOS))).toEqual([]);
  });

  it('a lista de revisados não tem arquivo que saiu', () => {
    expect(Object.keys(REVISADOS).filter((f) => !comChave.includes(f))).toEqual([]);
  });

  it('os três caminhos que trocam o professor do lead usam o montador', () => {
    for (const f of ['src/lib/contextPatch.js', 'src/lib/aulasWrites.js', 'src/lib/clientImport.js']) {
      expect(readFileSync(join(RAIZ, f), 'utf8'), f).toMatch(/professorChangePatch\(/);
    }
  });

  it('nenhuma seção da aba Cadastro grava o professor', () => {
    const lead = { name: 'Ana', professorId: 'p1', professorName: 'Bruno' };
    for (const { id } of CADASTRO_SECTIONS) {
      expect(buildSectionPatch(id, { professorId: 'p2' }, lead), id).not.toHaveProperty('professorId');
    }
  });
});
```

- [ ] **Passo 2: rodar**

```bash
npx vitest run src/lib/__tests__/historicoDoProfessor.sweep.test.js
```

Esperado: PASS. A lista de `REVISADOS` foi tirada da busca feita em 24/11/2026. Se o primeiro teste listar um arquivo que entrou na main depois disso, abra o arquivo: se ele grava o `professorId` do lead, faça-o passar pelo `professorChangePatch`; se não grava, acrescente-o em `REVISADOS` com o motivo.

- [ ] **Passo 3: conferir que a varredura pega o erro**

Em `src/lib/contextPatch.js`, apague por um momento o trecho `professorChangePatch(lead, id, name, now) || ` (deixe só o objeto de reserva) e rode a varredura de novo.

```bash
npx vitest run src/lib/__tests__/historicoDoProfessor.sweep.test.js
```

Esperado: FAIL em "os três caminhos que trocam o professor do lead usam o montador". Desfaça a mudança (`git checkout src/lib/contextPatch.js`) e rode de novo para voltar a PASS.

- [ ] **Passo 4: commit**

```bash
git add src/lib/__tests__/historicoDoProfessor.sweep.test.js
git commit -m "test: varredura de quem grava o professor do lead"
```

---

### Tarefa 6: documentação e conferência final

**Arquivos:**
- Modificar: `CLAUDE.md` (seção nova, logo depois de "Rotinas dos consultores")

- [ ] **Passo 1: escrever a seção no `CLAUDE.md`**

Acrescente, depois da seção "Rotinas dos consultores" e antes de "Responsável do menor de idade":

```markdown
## Perfil do professor

O perfil do professor, com os critérios do plano de carreira (renovação da carteira, NPS, conversão e aderência), está em construção atrás do módulo `faltosos`, o "Stronix 2.0". Spec em `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md` e plano mestre em `docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md`.

- **Histórico de troca de professor** (PR 1). O lead guarda `professorHistory`, a lista `{ professorId, since }` na ordem, com `since` null na primeira entrada (o professor de antes do histórico). Toda troca do professor do lead passa por `professorChangePatch` (`src/lib/professorHistory.js`), e a leitura de quem era o professor numa data é o `professorAt`. Lead sem histórico vale o professor atual em qualquer data, e o primeiro professor de um lead que não tinha nenhum não grava histórico, para matrícula e importação não criarem troca falsa. Gravam o professor do lead o Contexto comercial (`contextPatch.js`), o carimbo da matrícula (`markConvertingAula`) e o preenchimento da importação (`buildFillPatch`). O `historicoDoProfessor.sweep.test.js` reprova arquivo novo com `professorId` como chave até alguém conferir se ele grava o lead. O histórico grava em toda academia, sem tela, e não mudou regra do Firestore: o consultor e o gestor já gravam qualquer campo do lead, e o professor não grava `professorId`. O histórico começa no deploy deste PR, então trocas anteriores não aparecem.
```

- [ ] **Passo 2: conferência completa**

```bash
npm run lint && npm test && npm run verificar:sentry && npm run build
```

Esperado: tudo passa.

- [ ] **Passo 3: commit**

```bash
git add CLAUDE.md
git commit -m "docs: regra do histórico de troca de professor no CLAUDE.md"
```

- [ ] **Passo 4: parar e avisar o Johnny**

Não faça push nem abra PR sem o pedido dele. Diga o que entrou e sugira as rodadas de code review:

1. **Correção da troca:** os três caminhos gravam o histórico certo, inclusive o lead com histórico e sem professor.
2. **Leituras de data:** `professorAt` com Timestamp, Date e o instante exato da troca.
3. **Concorrência:** duas abas trocando o professor ao mesmo tempo (o atalho anotado no módulo).
4. **Varredura:** se o padrão pega `professorId` em todas as formas de escrita usadas no código.

Quando o Johnny pedir o PR: `git push -u origin claude/perfil-professor-nps-67a885` e `gh pr create` com o título "feat: histórico de troca de professor no lead" e uma descrição que diga que o PR leva junto a spec e os planos do perfil do professor, terminando com a linha de atribuição do Claude Code.
