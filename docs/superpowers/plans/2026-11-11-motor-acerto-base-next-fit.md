# Motor de acerto da base com a Next Fit: plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`). Commit e push só quando o Johnny pedir: os passos de commit abaixo são pontos de parada para pedir.

**Meta:** um script local que compara a base de clientes da Next Fit (duas planilhas) com a STRONIX no Stronilead, completa CPF e nascimento (etapa 1) e cria as matrículas que faltam (etapa 2), sempre começando por relatório.

**Arquitetura:** as regras puras ficam em `src/lib/nextFitSync.js` (testadas em Vitest, sem Firestore). O script `scripts/sync-clientes-next-fit.js` lê as planilhas e o Firestore com a credencial de administrador, chama as regras, escreve relatório e só grava com `--apply --etapa=N`. Reaproveita `parseRow`, `enrichCandidate` e `buildImportedClientWrites` de `src/lib/clientImport.js`, que importam em Node puro, e o molde de gravação de `scripts/backfill-contract-seamless.js` (precondição `lastUpdateTime`, lotes, tenant obrigatório).

**Stack:** Node 22, `firebase-admin`, `xlsx` (SheetJS, já é dependência), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md`

**Decisões tomadas ao ler o código (valem para o plano):**

- O contrato criado na etapa 2 não leva `renewedFromId`. O encadeamento com o contrato vencido fica de fora; os painéis já ignoram contrato importado.
- Lead de cadastro novo nasce com os dados que a Next Fit tem. Cadastro que já existe só ganha CPF e nascimento.
- Dono do cadastro novo: o consultor da lista de clientes, ou o do relatório de contratos. Sem nenhum, nasce sem dono e entra no relatório.
- As planilhas são lidas sem `cellDates`: a data vem como número serial do Excel, que o `parseImportDate` converte sem erro de fuso (com `cellDates` o SheetJS desloca datas antigas em fuso de São Paulo).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/nextFitSync.js` (novo) | Regra pura: ler pessoas e contratos das linhas, casar, planejar etapa 1 e 2, montar as gravações da etapa 2 |
| `src/lib/__tests__/nextFitSync.test.js` (novo) | Testes das regras, só com pessoas inventadas |
| `scripts/sync-clientes-next-fit.js` (novo) | Lê planilhas e Firestore, escreve relatório, grava com `--apply` |
| `CLAUDE.md` do Stronilead (editar) | Seção curta sobre o motor |
| spec (editar uma linha) | Dados do cadastro novo |

---

### Tarefa 0: Preparar a worktree

A worktree não tem `node_modules`. Sem isso nem os testes rodam.

- [ ] **Passo 1: instalar sem mexer no lock**

```bash
cd /Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.claude/worktrees/lead-duplication-function-f6c11c && npm ci && git status --short package-lock.json package.json
```

Esperado: `npm ci` termina sem erro e o `git status` não lista `package.json` nem `package-lock.json`.

- [ ] **Passo 2: linha de base**

```bash
npx vitest run src/lib/__tests__/clientImport.test.js src/lib/__tests__/seamlessBackfill.test.js
```

Esperado: todos passam.

---

### Tarefa 1: Ler pessoas e contratos das planilhas

**Arquivos:**
- Criar: `src/lib/nextFitSync.js`
- Criar: `src/lib/__tests__/nextFitSync.test.js`

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/lib/__tests__/nextFitSync.test.js`:

```js
// Regras do scripts/sync-clientes-next-fit.js. Só pessoas inventadas: nada de
// dado real da Next Fit entra no repositório.

import { describe, it, expect } from 'vitest';
import { parsePeople, parseContracts } from '../nextFitSync.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 11, 11);

// Linha da lista de clientes da Next Fit, com os cabeçalhos reais.
const nfRow = (o = {}) => ({
  Nome: 'Fulano de Tal',
  'E-mail': null,
  Contrato: 'Clube + Start (12 meses)',
  Telefone: null,
  'Situação do contrato': 'Ativo',
  'Situação do cliente': 'Ativo',
  CPF: null,
  'Data de nascimento': null,
  'Data de cadastro': 45000,
  Sexo: null,
  VIP: 'Não',
  Consultor: null,
  Professor: null,
  ...o
});

// Linha do relatório de contratos a vencer.
const ctRow = (o = {}) => ({
  Cliente: 'Fulano de Tal',
  'Descrição do contrato': 'Clube + Start (12 meses)',
  Início: '01/06/2026',
  Encerramento: '01/06/2027',
  Professor: null,
  Consultor: null,
  FoneCliente: null,
  ...o
});

describe('parsePeople', () => {
  it('lê CPF numérico, telefone com 55 e data em serial do Excel', () => {
    const [p] = parsePeople([nfRow({
      Nome: 'Ana  Souza',
      CPF: 52998224725,
      Telefone: '+55 (51) 99999-1234',
      'Data de nascimento': 36526
    })], NOW);
    expect(p.name).toBe('Ana Souza');
    expect(p.nameLower).toBe('ana souza');
    expect(p.cpfDigits).toBe('52998224725');
    expect(p.whatsappDigits).toBe('51999991234');
    expect(p.phoneKey).toBe('5199991234');
    expect(p.birthDate).toEqual(D(2000, 1, 1));
    expect(p.nf).toBe('ativo');
  });

  it('guarda a situação do cliente da Next Fit sem o acento nem a caixa', () => {
    const rows = [
      nfRow({ 'Situação do cliente': 'Suspenso', 'Situação do contrato': 'Suspenso' }),
      nfRow({ 'Situação do cliente': 'Bloqueado', 'Situação do contrato': 'Cancelado' }),
      nfRow({ 'Situação do cliente': 'Inativo', 'Situação do contrato': 'Encerrado' })
    ];
    expect(parsePeople(rows, NOW).map((p) => p.nf)).toEqual(['suspenso', 'bloqueado', 'inativo']);
  });

  it('CPF inválido e telefone curto não viram chave', () => {
    const [p] = parsePeople([nfRow({ CPF: '111.111.111-11', Telefone: '9999' })], NOW);
    expect(p.cpfDigits).toBeNull();
    expect(p.phoneKey).toBeNull();
  });
});

describe('parseContracts', () => {
  it('lê datas dd/mm/aaaa, a chave do telefone e a descrição', () => {
    const [c] = parseContracts([ctRow({ FoneCliente: '(51) 99999-1234' })], NOW);
    expect(c.nameLower).toBe('fulano de tal');
    expect(c.phoneKey).toBe('5199991234');
    expect(c.description).toBe('Clube + Start (12 meses)');
    expect(c.startsAt).toEqual(D(2026, 6, 1));
    expect(c.endsAt).toEqual(D(2027, 6, 1));
  });

  it('data ilegível vira null, sem derrubar a leitura', () => {
    const [c] = parseContracts([ctRow({ Encerramento: 'sem data' })], NOW);
    expect(c.endsAt).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: FAIL, "Failed to resolve import ../nextFitSync.js".

- [ ] **Passo 3: implementar**

Criar `src/lib/nextFitSync.js`:

```js
// Acerto da base de clientes com a Next Fit. Regra pura, sem Firestore e sem
// leitura de arquivo: o scripts/sync-clientes-next-fit.js lê as planilhas e o
// banco e chama estas funções. Reaproveita a regra da importação de clientes
// (clientImport.js), que importa em Node puro.
// Spec: docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md

import {
  PLAN_AS_TEXT,
  buildImportedClientWrites,
  enrichCandidate,
  normalizeName,
  normalizePhoneDigits,
  parseImportDate,
  parseRow
} from './clientImport.js';
import { onlyDigits } from './globalSearch.js';
import { isClientLead } from './leads.js';
import { deriveLeadContractStatus } from './contracts.js';
import { formatCPF } from './masks.js';
import { buildLeadSearchFields } from './leadDerived.js';
import { zapMatchKey } from '../../api/_zapPhone.js';

// Campo do parseRow → cabeçalho da lista de clientes da Next Fit.
export const NF_CLIENT_MAPPING = {
  name: 'Nome',
  email: 'E-mail',
  whatsapp: 'Telefone',
  cpf: 'CPF',
  rg: 'RG',
  birthDate: 'Data de nascimento',
  registeredAt: 'Data de cadastro',
  sexo: 'Sexo',
  dor: 'Objetivo',
  vip: 'VIP',
  consultantName: 'Consultor',
  professorName: 'Professor',
  addrCep: 'Cep',
  addrStreet: 'Endereco',
  addrNumber: 'Número',
  addrComplement: 'Complemento',
  addrNeighborhood: 'Bairro',
  addrCity: 'Cidade',
  contractSituation: 'Situação do contrato',
  clientSituation: 'Situação do cliente'
};

// "Situação do cliente" da Next Fit, normalizada, que conta como aluno ativo.
export const NF_ACTIVE = new Set(['ativo', 'suspenso']);

// Situações de contrato do Stronilead que contam como cliente ativo.
export const ACTIVE_CONTRACT = new Set(['ativo', 'a_vencer', 'trancado']);

// Valor da tabela de planos: não criar contrato para essa descrição.
export const PLAN_SKIP = '__skip__';

export const GROUPS = {
  SEM_CADASTRO: 'sem_cadastro',
  SO_LEAD: 'so_lead',
  CONTRATO_NAO_ATIVO: 'contrato_nao_ativo'
};

// ---------------------------------------------------------------------------
// Leitura das planilhas
// ---------------------------------------------------------------------------

// Lista de clientes: uma pessoa por linha, de qualquer situação. O filtro dos
// ativos fica com quem chama (NF_ACTIVE).
export function parsePeople(rows, now = new Date()) {
  return (rows || []).map((row, i) => {
    const c = parseRow(row, NF_CLIENT_MAPPING, i + 2, now);
    return {
      ...c,
      nf: normalizeName(row['Situação do cliente']),
      phoneKey: zapMatchKey(c.whatsappDigits)
    };
  });
}

// Relatório de contratos a vencer: um contrato por linha.
export function parseContracts(rows, now = new Date()) {
  const text = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  return (rows || []).map((r, i) => {
    const name = text(r['Cliente']);
    return {
      rowNumber: i + 2,
      name,
      nameLower: normalizeName(name),
      phoneKey: zapMatchKey(normalizePhoneDigits(r['FoneCliente'])),
      description: text(r['Descrição do contrato']),
      startsAt: parseImportDate(r['Início'], now),
      endsAt: parseImportDate(r['Encerramento'], now),
      professorName: text(r['Professor']) || null,
      consultantName: text(r['Consultor']) || null
    };
  });
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: 5 testes passam. Se `zapMatchKey` não resolver, confira o caminho `../../api/_zapPhone.js` (é o mesmo do `leadDerived.js`).

- [ ] **Passo 5: commit (só se o Johnny pedir)**

```bash
git add src/lib/nextFitSync.js src/lib/__tests__/nextFitSync.test.js
git commit -m "feat: leitura das planilhas da Next Fit para o motor de acerto"
```

---

### Tarefa 2: Casamento

**Arquivos:**
- Modificar: `src/lib/nextFitSync.js` (acrescentar ao fim)
- Modificar: `src/lib/__tests__/nextFitSync.test.js`

- [ ] **Passo 1: escrever os testes que falham**

Trocar a linha de import do topo do teste por:

```js
import {
  parsePeople, parseContracts, buildIndex, matchOne, leadItem, attachContracts, matchPeopleToLeads
} from '../nextFitSync.js';
```

E acrescentar ao fim do arquivo de teste:

```js
const item = (o = {}) => ({ id: 'x', cpfDigits: null, phoneKey: null, nameLower: '', isClient: false, ...o });
const probe = (o = {}) => ({ cpfDigits: null, phoneKey: null, nameLower: '', ...o });
const prefer = (it) => it.isClient;

describe('matchOne', () => {
  it('casa pelo CPF', () => {
    const a = item({ id: 'a', cpfDigits: '52998224725', nameLower: 'ana souza' });
    const r = matchOne(probe({ cpfDigits: '52998224725', nameLower: 'ana s' }), buildIndex([a]));
    expect(r.kind).toBe('cpf');
    expect(r.item).toBe(a);
  });

  it('casa pelo telefone só quando o primeiro nome é o mesmo', () => {
    const a = item({ id: 'a', phoneKey: '5199991234', nameLower: 'ana souza' });
    const index = buildIndex([a]);
    expect(matchOne(probe({ phoneKey: '5199991234', nameLower: 'ana s souza' }), index).kind).toBe('phone');
    // Mãe e filho no mesmo telefone: não casa por telefone nem por nome.
    expect(matchOne(probe({ phoneKey: '5199991234', nameLower: 'pedro souza' }), index).kind).toBe('none');
  });

  it('casa pelo nome completo quando só um cadastro tem esse nome', () => {
    const a = item({ id: 'a', nameLower: 'ana souza' });
    expect(matchOne(probe({ nameLower: 'ana souza' }), buildIndex([a])).kind).toBe('name');
  });

  it('homônimos viram ambíguos, a não ser que só um seja cliente', () => {
    const a = item({ id: 'a', nameLower: 'ana souza' });
    const b = item({ id: 'b', nameLower: 'ana souza' });
    const r = matchOne(probe({ nameLower: 'ana souza' }), buildIndex([a, b]), { prefer });
    expect(r.kind).toBe('ambiguous');
    expect(r.candidates).toHaveLength(2);
    const cliente = item({ id: 'c', nameLower: 'ana souza', isClient: true });
    const r2 = matchOne(probe({ nameLower: 'ana souza' }), buildIndex([a, cliente]), { prefer });
    expect(r2.kind).toBe('name');
    expect(r2.item).toBe(cliente);
  });

  it('sem nenhum sinal devolve none', () => {
    expect(matchOne(probe({ nameLower: 'ninguem' }), buildIndex([item()])).kind).toBe('none');
  });
});

describe('leadItem', () => {
  it('usa a chave de telefone gravada, ou calcula pelo whatsapp', () => {
    expect(leadItem({ id: 'l1', name: 'Ana Souza', zapMatchKey: '5199991234' }).phoneKey).toBe('5199991234');
    expect(leadItem({ id: 'l2', name: 'Ana Souza', whatsapp: '(51) 99999-1234' }).phoneKey).toBe('5199991234');
  });

  it('marca cliente pelo lifecycleStage', () => {
    expect(leadItem({ id: 'l1', name: 'A', lifecycleStage: 'cliente' }).isClient).toBe(true);
    expect(leadItem({ id: 'l2', name: 'A' }).isClient).toBe(false);
  });
});

describe('attachContracts', () => {
  const ana = { name: 'Ana Souza', nameLower: 'ana souza', cpfDigits: null, phoneKey: '5199991234', nf: 'ativo' };
  const bia = { name: 'Bia Lima', nameLower: 'bia lima', cpfDigits: null, phoneKey: '5188887777', nf: 'bloqueado' };
  const contrato = (o) => ({ name: 'x', nameLower: '', phoneKey: null, description: 'Plano', startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), ...o });

  it('liga o contrato à pessoa e fica com o de fim mais distante', () => {
    const { people } = attachContracts([ana, bia], [
      contrato({ phoneKey: '5199991234', nameLower: 'ana souza', endsAt: D(2026, 12, 1) }),
      contrato({ phoneKey: '5199991234', nameLower: 'ana souza', endsAt: D(2027, 6, 1) })
    ]);
    expect(people[0].contract.endsAt).toEqual(D(2027, 6, 1));
    expect(people[0].contractCount).toBe(2);
    expect(people[1].contract).toBeNull();
  });

  it('separa o contrato sem pessoa e o contrato de quem não é ativo', () => {
    const { orphans, onInactive } = attachContracts([ana, bia], [
      contrato({ nameLower: 'bia lima', phoneKey: '5188887777' }),
      contrato({ nameLower: 'desconhecido', phoneKey: null })
    ]);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].contract.nameLower).toBe('desconhecido');
    expect(onInactive.map((p) => p.name)).toEqual(['Bia Lima']);
  });
});

describe('matchPeopleToLeads', () => {
  it('casa cada pessoa com a ficha e prefere o cliente entre homônimos', () => {
    const pessoa = { name: 'Ana Souza', nameLower: 'ana souza', cpfDigits: null, phoneKey: null, nf: 'ativo' };
    const matched = matchPeopleToLeads([pessoa], [
      { id: 'l1', name: 'Ana Souza' },
      { id: 'l2', name: 'Ana Souza', lifecycleStage: 'cliente' }
    ]);
    expect(matched[0].kind).toBe('name');
    expect(matched[0].item.id).toBe('l2');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: FAIL, `buildIndex` não existe.

- [ ] **Passo 3: implementar**

Acrescentar ao fim de `src/lib/nextFitSync.js`:

```js
// ---------------------------------------------------------------------------
// Casamento
// ---------------------------------------------------------------------------

const firstNameOf = (nameLower) => String(nameLower || '').split(' ')[0];

// Itens precisam de cpfDigits, phoneKey e nameLower.
export function buildIndex(items) {
  const byCpf = new Map();
  const byPhone = new Map();
  const byName = new Map();
  const push = (map, key, it) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  };
  for (const it of items || []) {
    push(byCpf, it.cpfDigits, it);
    push(byPhone, it.phoneKey, it);
    push(byName, it.nameLower, it);
  }
  return { byCpf, byPhone, byName };
}

const pickOne = (list, prefer) => {
  if (list.length === 1) return { item: list[0] };
  const preferred = prefer ? list.filter(prefer) : [];
  if (preferred.length === 1) return { item: preferred[0] };
  return { ambiguous: list };
};

// Ordem do spec: CPF, telefone com o mesmo primeiro nome, nome completo. O
// primeiro critério que acha alguém decide; com mais de um candidato (e sem um
// único preferido) a pessoa é ambígua e nada é gravado nela.
export function matchOne(probe, index, { prefer } = {}) {
  const tries = [
    ['cpf', probe.cpfDigits ? index.byCpf.get(probe.cpfDigits) || [] : []],
    ['phone', (probe.phoneKey ? index.byPhone.get(probe.phoneKey) || [] : [])
      .filter((it) => firstNameOf(it.nameLower) === firstNameOf(probe.nameLower))],
    ['name', probe.nameLower ? index.byName.get(probe.nameLower) || [] : []]
  ];
  for (const [kind, list] of tries) {
    if (!list.length) continue;
    const r = pickOne(list, prefer);
    return r.item
      ? { kind, item: r.item, candidates: [] }
      : { kind: 'ambiguous', item: null, candidates: r.ambiguous };
  }
  return { kind: 'none', item: null, candidates: [] };
}

// Ficha do Stronilead no formato do índice.
export function leadItem(lead) {
  return {
    id: lead.id,
    lead,
    nameLower: normalizeName(lead.name),
    cpfDigits: onlyDigits(lead.cpfDigits || lead.cpf) || null,
    phoneKey: lead.zapMatchKey || zapMatchKey(lead.whatsapp) || null,
    isClient: isClientLead(lead)
  };
}

// Liga cada contrato do relatório a uma pessoa da lista (de qualquer situação)
// por telefone e nome. A pessoa fica com o contrato de fim mais distante.
// `orphans`: contrato sem pessoa. `onInactive`: contrato de quem não é ativo
// na Next Fit (os bloqueados com contrato vigente).
export function attachContracts(people, contracts) {
  const index = buildIndex(people);
  const contractsOf = new Map();
  const orphans = [];
  for (const contract of contracts || []) {
    const r = matchOne({ cpfDigits: null, phoneKey: contract.phoneKey, nameLower: contract.nameLower }, index);
    if (!r.item) { orphans.push({ contract, kind: r.kind }); continue; }
    if (!contractsOf.has(r.item)) contractsOf.set(r.item, []);
    contractsOf.get(r.item).push(contract);
  }
  const end = (c) => (c.endsAt ? c.endsAt.getTime() : -Infinity);
  const latest = (list) => list.reduce((a, b) => (end(b) > end(a) ? b : a));
  const withContracts = (people || []).map((p) => {
    const list = contractsOf.get(p) || [];
    return { ...p, contract: list.length ? latest(list) : null, contractCount: list.length };
  });
  return {
    people: withContracts,
    orphans,
    onInactive: withContracts.filter((p) => p.contract && !NF_ACTIVE.has(p.nf))
  };
}

// Casa as pessoas com as fichas do Stronilead. Entre homônimos, vale o cliente.
export function matchPeopleToLeads(people, leads) {
  const index = buildIndex((leads || []).map(leadItem));
  return (people || []).map((person) => ({
    person,
    ...matchOne(person, index, { prefer: (it) => it.isClient })
  }));
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: todos passam.

- [ ] **Passo 5: commit (só se o Johnny pedir)**

```bash
git add src/lib/nextFitSync.js src/lib/__tests__/nextFitSync.test.js
git commit -m "feat: casamento entre a Next Fit e o Stronilead no motor de acerto"
```

---

### Tarefa 3: Etapa 1, CPF e nascimento

**Arquivos:**
- Modificar: `src/lib/nextFitSync.js`
- Modificar: `src/lib/__tests__/nextFitSync.test.js`

- [ ] **Passo 1: escrever os testes que falham**

Trocar a linha de import do topo do teste por:

```js
import {
  parsePeople, parseContracts, buildIndex, matchOne, leadItem, attachContracts, matchPeopleToLeads,
  etapa1Patch, planEtapa1
} from '../nextFitSync.js';
```

E acrescentar ao fim do arquivo de teste:

```js
describe('etapa1Patch', () => {
  const pessoa = { cpfDigits: '52998224725', birthDate: D(1990, 5, 20) };

  it('preenche CPF e nascimento vazios, com os campos de busca', () => {
    const { patch, conflict } = etapa1Patch(pessoa, { name: 'Ana Souza', whatsapp: '(51) 99999-1234' });
    expect(conflict).toBe(false);
    expect(patch.cpf).toBe('529.982.247-25');
    expect(patch.cpfDigits).toBe('52998224725');
    expect(patch.birthDate).toEqual(D(1990, 5, 20));
    expect(patch.zapMatchKey).toBe('5199991234');
  });

  it('nunca sobrescreve o que já está preenchido', () => {
    const lead = { name: 'Ana', cpf: '529.982.247-25', cpfDigits: '52998224725', birthDate: D(1980, 1, 1) };
    const { patch } = etapa1Patch(pessoa, lead);
    expect(patch).toEqual({});
  });

  it('só o nascimento vazio: grava o nascimento e não mexe nos campos de busca', () => {
    const lead = { name: 'Ana', cpfDigits: '52998224725' };
    const { patch } = etapa1Patch(pessoa, lead);
    expect(Object.keys(patch)).toEqual(['birthDate']);
  });

  it('CPF diferente do da Next Fit vira conflito e não grava nada', () => {
    const r = etapa1Patch(pessoa, { name: 'Ana', cpfDigits: '11144477735' });
    expect(r.conflict).toBe(true);
    expect(r.patch).toEqual({});
  });
});

describe('planEtapa1', () => {
  const cliente = (o) => ({ id: 'l1', name: 'Ana Souza', lifecycleStage: 'cliente', ...o });
  const ana = { name: 'Ana Souza', nameLower: 'ana souza', cpfDigits: '52998224725', phoneKey: null, birthDate: D(1990, 5, 20), nf: 'ativo' };

  it('separa o que grava, os conflitos e os ambíguos', () => {
    const grava = matchPeopleToLeads([ana], [cliente()]);
    expect(planEtapa1(grava).writes).toHaveLength(1);
    expect(planEtapa1(grava).writes[0].leadId).toBe('l1');
    expect(planEtapa1(grava).writes[0].fills).toEqual(['CPF', 'nascimento']);

    const conflito = matchPeopleToLeads([{ ...ana, cpfDigits: '11144477735' }], [cliente({ cpfDigits: '52998224725' })]);
    expect(planEtapa1(conflito).conflicts).toHaveLength(1);
    expect(planEtapa1(conflito).writes).toHaveLength(0);

    const ambiguo = matchPeopleToLeads([{ ...ana, cpfDigits: null }], [cliente({ id: 'a' }), cliente({ id: 'b' })]);
    expect(planEtapa1(ambiguo).ambiguous).toHaveLength(1);
  });

  it('lead que ainda não é cliente fica para a etapa 2', () => {
    const lead = matchPeopleToLeads([ana], [{ id: 'l9', name: 'Ana Souza' }]);
    expect(planEtapa1(lead).writes).toHaveLength(0);
  });

  it('rodar de novo, com os campos já preenchidos, não grava nada', () => {
    const jaPreenchido = cliente({ cpf: '529.982.247-25', cpfDigits: '52998224725', birthDate: D(1990, 5, 20) });
    expect(planEtapa1(matchPeopleToLeads([ana], [jaPreenchido])).writes).toHaveLength(0);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: FAIL, `etapa1Patch` não existe.

- [ ] **Passo 3: implementar**

Acrescentar ao fim de `src/lib/nextFitSync.js`:

```js
// ---------------------------------------------------------------------------
// Etapa 1: CPF e nascimento
// ---------------------------------------------------------------------------

const blank = (v) => v == null || v === '';

// Só o campo vazio recebe a Next Fit. CPF diferente do da ficha é conflito:
// nada é gravado e a pessoa vai para o relatório. Quando o CPF entra, os
// campos de busca são recalculados com o que fica gravado, como o
// buildFillPatch da importação.
export function etapa1Patch(person, lead) {
  const cpfOnLead = onlyDigits(lead.cpfDigits || lead.cpf);
  if (person.cpfDigits && cpfOnLead && cpfOnLead !== person.cpfDigits) {
    return { patch: {}, conflict: true };
  }
  const patch = {};
  if (!cpfOnLead && person.cpfDigits) patch.cpf = formatCPF(person.cpfDigits);
  if (blank(lead.birthDate) && person.birthDate) patch.birthDate = person.birthDate;
  if (patch.cpf) {
    Object.assign(patch, buildLeadSearchFields({ name: lead.name, whatsapp: lead.whatsapp, cpf: patch.cpf }));
  }
  return { patch, conflict: false };
}

// `matched` vem de matchPeopleToLeads, só com pessoas ativas na Next Fit.
// A etapa 1 mexe só em quem já é cliente: lead e quem não tem ficha são da
// etapa 2.
export function planEtapa1(matched) {
  const writes = [];
  const conflicts = [];
  const ambiguous = [];
  for (const m of matched) {
    if (m.kind === 'ambiguous') { ambiguous.push(m); continue; }
    if (m.kind === 'none' || !m.item.isClient) continue;
    const { patch, conflict } = etapa1Patch(m.person, m.item.lead);
    if (conflict) { conflicts.push(m); continue; }
    if (!Object.keys(patch).length) continue;
    writes.push({
      leadId: m.item.id,
      patch,
      fills: [patch.cpf && 'CPF', patch.birthDate && 'nascimento'].filter(Boolean),
      m
    });
  }
  return { writes, conflicts, ambiguous };
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: todos passam.

- [ ] **Passo 5: commit (só se o Johnny pedir)**

```bash
git add src/lib/nextFitSync.js src/lib/__tests__/nextFitSync.test.js
git commit -m "feat: etapa 1 do motor de acerto, CPF e nascimento"
```

---

### Tarefa 4: Etapa 2, matrículas que faltam

**Arquivos:**
- Modificar: `src/lib/nextFitSync.js`
- Modificar: `src/lib/__tests__/nextFitSync.test.js`

- [ ] **Passo 1: escrever os testes que falham**

Trocar a linha de import do topo do teste por:

```js
import {
  parsePeople, parseContracts, buildIndex, matchOne, leadItem, attachContracts, matchPeopleToLeads,
  etapa1Patch, planEtapa1,
  planEtapa2, extrasInStronilead, buildEtapa2Items, findUndefined, PLAN_SKIP
} from '../nextFitSync.js';
```

E acrescentar ao fim do arquivo de teste:

```js
const FUTURO = D(2027, 6, 1);
const PASSADO = D(2026, 1, 1);
const contratoNF = { description: 'Clube + Start (12 meses)', startsAt: D(2026, 6, 1), endsAt: FUTURO, consultantName: null, professorName: null };
const ativo = (o = {}) => ({
  name: 'Fulano', nameLower: 'fulano', cpfDigits: null, phoneKey: null, birthDate: null, nf: 'ativo',
  email: null, whatsappRaw: '', whatsappDigits: null, rg: null, sexo: null, dor: null, vip: false,
  address: null, registeredAt: null, rowNumber: 2, contractSituation: 'ativo', warnings: [],
  consultantName: null, professorName: null, contract: contratoNF, ...o
});
const clienteAtivo = (o) => ({ id: 'c1', name: 'Fulano', lifecycleStage: 'cliente', currentContractId: 'k1', currentContractStatus: 'ativo', currentContractEndsAt: FUTURO, ...o });
const NOW2 = D(2026, 11, 11);

describe('planEtapa2', () => {
  it('manda cada pessoa para o grupo certo', () => {
    const pessoas = [
      ativo({ name: 'Ja Ativo', nameLower: 'ja ativo' }),
      ativo({ name: 'Venceu', nameLower: 'venceu' }),
      ativo({ name: 'So Lead', nameLower: 'so lead' }),
      ativo({ name: 'Sem Ficha', nameLower: 'sem ficha' }),
      ativo({ name: 'Sem Contrato', nameLower: 'sem contrato', contract: null })
    ];
    const leads = [
      clienteAtivo({ id: 'a', name: 'Ja Ativo' }),
      clienteAtivo({ id: 'b', name: 'Venceu', currentContractStatus: 'ativo', currentContractEndsAt: PASSADO }),
      { id: 'c', name: 'So Lead' },
      clienteAtivo({ id: 'd', name: 'Sem Contrato', currentContractEndsAt: PASSADO })
    ];
    const r = planEtapa2(matchPeopleToLeads(pessoas, leads), NOW2);
    expect(r.jaAtivos).toBe(1);
    expect(r.groups.contrato_nao_ativo.map((m) => m.person.name)).toEqual(['Venceu']);
    expect(r.groups.so_lead.map((m) => m.person.name)).toEqual(['So Lead']);
    expect(r.groups.sem_cadastro.map((m) => m.person.name)).toEqual(['Sem Ficha']);
    expect(r.semContrato.map((m) => m.person.name)).toEqual(['Sem Contrato']);
  });

  it('ambíguo, CPF divergente e contrato inválido ficam fora dos grupos', () => {
    const pessoas = [
      ativo({ name: 'Homonimo', nameLower: 'homonimo' }),
      ativo({ name: 'Divergente', nameLower: 'divergente', cpfDigits: '52998224725' }),
      ativo({ name: 'Datas Ruins', nameLower: 'datas ruins', contract: { ...contratoNF, endsAt: PASSADO, startsAt: FUTURO } })
    ];
    const leads = [
      { id: 'h1', name: 'Homonimo' }, { id: 'h2', name: 'Homonimo' },
      clienteAtivo({ id: 'dv', name: 'Divergente', cpfDigits: '11144477735', currentContractEndsAt: PASSADO }),
      { id: 'dr', name: 'Datas Ruins' }
    ];
    const r = planEtapa2(matchPeopleToLeads(pessoas, leads), NOW2);
    expect(r.ambiguous).toHaveLength(1);
    expect(r.conflicts).toHaveLength(1);
    expect(r.contratoInvalido).toHaveLength(1);
    expect(Object.values(r.groups).flat()).toHaveLength(0);
  });

  it('ignora quem não é ativo na Next Fit', () => {
    const r = planEtapa2(matchPeopleToLeads([ativo({ nf: 'bloqueado' })], []), NOW2);
    expect(Object.values(r.groups).flat()).toHaveLength(0);
    expect(r.semContrato).toHaveLength(0);
  });
});

describe('extrasInStronilead', () => {
  it('lista o cliente ativo que nenhuma pessoa ativa da Next Fit explica', () => {
    const leads = [
      clienteAtivo({ id: 'a', name: 'Fulano' }),
      clienteAtivo({ id: 'b', name: 'Outro' }),
      clienteAtivo({ id: 'c', name: 'Vencido', currentContractEndsAt: PASSADO })
    ];
    const matched = matchPeopleToLeads([ativo()], leads);
    expect(extrasInStronilead(matched, leads, NOW2).map((l) => l.id)).toEqual(['b']);
  });
});

describe('buildEtapa2Items', () => {
  const planos = [{ id: 'pl1', name: 'Clube + Start (12 meses)', value: 1308, durationMonths: 12 }];
  const usersList = [{ id: 'u1', name: 'Ana Consultora', authUid: 'auth-1' }];
  const importMeta = { importedBy: 'script:sync-clientes-next-fit', importSource: 'nextfit', importBatchId: 'lote-1', now: NOW2 };
  const grupos = (m) => ({ sem_cadastro: m, so_lead: [], contrato_nao_ativo: [] });
  const semFicha = (o) => ({ person: ativo(o), kind: 'none', item: null, candidates: [] });

  it('cria cadastro e contrato marcados como importados, com as datas do relatório', () => {
    const { items, unmapped } = buildEtapa2Items(
      grupos([semFicha({ consultantName: 'Ana Consultora' })]),
      { usersList, planos, funnelId: 'f1', importMeta, now: NOW2 }
    );
    expect(unmapped).toEqual([]);
    expect(items).toHaveLength(1);
    const it = items[0];
    expect(it.isNew).toBe(true);
    expect(it.contract.planId).toBe('pl1');
    expect(it.contract.startsAt).toEqual(D(2026, 6, 1));
    expect(it.contract.endsAt).toEqual(FUTURO);
    expect(it.contract.importBatchId).toBe('lote-1');
    expect(it.leadData.importBatchId).toBe('lote-1');
    expect(it.leadData.lifecycleStage).toBe('cliente');
    expect(it.leadData.consultantId).toBe('u1');
    expect(findUndefined(it.leadData)).toBeNull();
    expect(findUndefined(it.contract)).toBeNull();
  });

  it('descrição sem plano ligado não vira contrato e aparece na lista', () => {
    const p = semFicha({ contract: { ...contratoNF, description: 'Freepass 15 dias' } });
    const { items, unmapped } = buildEtapa2Items(grupos([p]), { planos, importMeta, now: NOW2 });
    expect(items).toHaveLength(0);
    expect(unmapped).toEqual([{ key: 'freepass 15 dias', label: 'Freepass 15 dias', count: 1 }]);
  });

  it('descrição marcada para pular não vira contrato nem pendência', () => {
    const p = semFicha({ contract: { ...contratoNF, description: 'Freepass 15 dias' } });
    const { items, unmapped, skipped } = buildEtapa2Items(grupos([p]), {
      planos, planMap: { 'freepass 15 dias': PLAN_SKIP }, importMeta, now: NOW2
    });
    expect(items).toHaveLength(0);
    expect(unmapped).toEqual([]);
    expect(skipped).toHaveLength(1);
  });

  it('lead existente: reaproveita a ficha e só completa CPF e nascimento', () => {
    const lead = { id: 'l9', name: 'Fulano', whatsapp: '(51) 99999-1234' };
    const m = { person: ativo({ cpfDigits: '52998224725', birthDate: D(1990, 5, 20) }), kind: 'name', item: leadItem(lead), candidates: [] };
    const { items } = buildEtapa2Items({ sem_cadastro: [], so_lead: [m], contrato_nao_ativo: [] }, { planos, importMeta, now: NOW2 });
    expect(items[0].isNew).toBe(false);
    expect(items[0].leadId).toBe('l9');
    expect(items[0].leadData.cpf).toBe('529.982.247-25');
    expect(items[0].leadData.birthDate).toEqual(D(1990, 5, 20));
    expect(items[0].leadData.lifecycleStage).toBe('cliente');
  });
});

describe('findUndefined', () => {
  it('acha o caminho do primeiro undefined, ignorando datas', () => {
    expect(findUndefined({ a: 1, b: { c: undefined } })).toBe('b.c');
    expect(findUndefined({ a: new Date(), b: null, c: [1, 2] })).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: FAIL, `planEtapa2` não existe.

- [ ] **Passo 3: implementar**

Acrescentar ao fim de `src/lib/nextFitSync.js`:

```js
// ---------------------------------------------------------------------------
// Etapa 2: matrículas que faltam
// ---------------------------------------------------------------------------

// Separa as pessoas ativas na Next Fit em três grupos de gravação e nas listas
// que ficam para decisão humana. Quem já é cliente ativo no Stronilead não
// entra em nada: só conta em jaAtivos.
export function planEtapa2(matched, now = new Date()) {
  const out = {
    groups: { [GROUPS.SEM_CADASTRO]: [], [GROUPS.SO_LEAD]: [], [GROUPS.CONTRATO_NAO_ATIVO]: [] },
    jaAtivos: 0,
    ambiguous: [],
    conflicts: [],
    semContrato: [],
    contratoInvalido: []
  };
  for (const m of matched) {
    if (!NF_ACTIVE.has(m.person.nf)) continue;
    if (m.kind === 'ambiguous') { out.ambiguous.push(m); continue; }
    const lead = m.item?.lead || null;
    if (lead && etapa1Patch(m.person, lead).conflict) { out.conflicts.push(m); continue; }
    if (lead && m.item.isClient && ACTIVE_CONTRACT.has(deriveLeadContractStatus(lead, now))) {
      out.jaAtivos += 1;
      continue;
    }
    const ct = m.person.contract;
    if (!ct) { out.semContrato.push(m); continue; }
    if (!ct.startsAt || !ct.endsAt || ct.endsAt.getTime() < ct.startsAt.getTime()) {
      out.contratoInvalido.push(m);
      continue;
    }
    const group = !lead ? GROUPS.SEM_CADASTRO : !m.item.isClient ? GROUPS.SO_LEAD : GROUPS.CONTRATO_NAO_ATIVO;
    out.groups[group].push(m);
  }
  return out;
}

// Cliente ativo no Stronilead que nenhuma pessoa ativa da Next Fit explica.
// Candidatos de um casamento ambíguo contam como explicados.
export function extrasInStronilead(matched, leads, now = new Date()) {
  const seen = new Set();
  for (const m of matched) {
    if (m.item) seen.add(m.item.id);
    for (const c of m.candidates) seen.add(c.id);
  }
  return (leads || []).filter((l) =>
    isClientLead(l) && ACTIVE_CONTRACT.has(deriveLeadContractStatus(l, now)) && !seen.has(l.id));
}

// A pessoa + o contrato do relatório, no formato de candidato da importação.
const toCandidate = (person) => ({
  ...person,
  planName: person.contract.description,
  startsAt: person.contract.startsAt,
  endsAt: person.contract.endsAt,
  consultantName: person.consultantName || person.contract.consultantName,
  professorName: person.professorName || person.contract.professorName
});

// Monta as gravações da etapa 2 com o mesmo construtor da importação de
// clientes (contrato e ficha marcados como importados). `planMap` liga a
// descrição normalizada a um id de plano, a PLAN_AS_TEXT ou a PLAN_SKIP.
// Descrição sem plano do catálogo e sem ligação entra em `unmapped` e não gera
// gravação: o script recusa o --apply enquanto a lista não estiver vazia.
export function buildEtapa2Items(groups, {
  usersList = [], professores = [], planos = [], planMap = {},
  funnelId = null, importMeta, now = new Date()
}) {
  const items = [];
  const skipped = [];
  const unmapped = new Map();
  for (const group of Object.values(GROUPS)) {
    for (const m of groups[group] || []) {
      const c = enrichCandidate(toCandidate(m.person), { usersList, professores, planos, planMap });
      const key = normalizeName(c.planName);
      if (planMap[key] === PLAN_SKIP) { skipped.push({ group, m }); continue; }
      if (!c.plan && planMap[key] !== PLAN_AS_TEXT) {
        const cur = unmapped.get(key) || { key, label: c.planName, count: 0 };
        cur.count += 1;
        unmapped.set(key, cur);
        continue;
      }
      const lead = m.item?.lead || null;
      const fill = lead ? etapa1Patch(c, lead).patch : null;
      const consultant = c.consultant
        ? { id: c.consultant.id, name: c.consultant.name, authUid: c.consultant.authUid ?? null }
        : null;
      const w = buildImportedClientWrites({
        c, cls: { lead, fill, createContract: true }, consultant, funnelId, importMeta, now
      });
      items.push({ ...w, group, rowNumber: c.rowNumber });
    }
  }
  return { items, skipped, unmapped: [...unmapped.values()] };
}

// O Firestore de servidor recusa undefined. O dry-run chama isto em cada
// gravação para o problema aparecer antes do --apply.
export function findUndefined(value, path = '') {
  if (value === undefined) return path || '(raiz)';
  if (value === null || typeof value !== 'object' || value instanceof Date) return null;
  for (const [k, v] of Object.entries(value)) {
    const p = findUndefined(v, path ? `${path}.${k}` : k);
    if (p) return p;
  }
  return null;
}
```

Atenção: o teste "lead existente" depende de `buildImportedClientWrites` devolver `leadData.cpf` vindo do `fill`. Se falhar, confira em `clientImport.js` (linha ~682) que `leadData = { ...(cls.fill || {}), ... }`.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js
```

Esperado: todos passam. Se o teste do cadastro novo acusar `undefined` em `leadData`, anote o campo pelo caminho que `findUndefined` devolve e troque por `null` no `toCandidate`, não no `clientImport.js`.

- [ ] **Passo 5: lint**

```bash
npx eslint src/lib/nextFitSync.js src/lib/__tests__/nextFitSync.test.js
```

Esperado: sem erros.

- [ ] **Passo 6: commit (só se o Johnny pedir)**

```bash
git add src/lib/nextFitSync.js src/lib/__tests__/nextFitSync.test.js
git commit -m "feat: etapa 2 do motor de acerto, matrículas que faltam"
```

---

### Tarefa 5: Script, parte 1 (relatório, sem gravar)

**Arquivos:**
- Criar: `scripts/sync-clientes-next-fit.js`

- [ ] **Passo 1: escrever o script**

```js
// Acerto da base de clientes do Stronilead com a Next Fit.
//
// Lê duas exportações da Next Fit (lista de clientes e relatório de contratos
// a vencer), compara com os leads de UMA academia e gera um relatório. Só grava
// com --apply --etapa=N, depois do OK do Johnny sobre o relatório.
//   Etapa 1: completa CPF e nascimento vazios de quem já é cliente.
//   Etapa 2: cria as matrículas que faltam (contrato e, se preciso, cadastro),
//            marcadas como importadas para não entrarem como venda nos painéis.
// As regras moram em src/lib/nextFitSync.js, com teste.
// Spec: docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md
//
// Uso (a credencial de administrador vem do .env.local do checkout principal):
//   node --env-file=/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.env.local \
//     scripts/sync-clientes-next-fit.js <tenantId> \
//     --clientes=<lista.xlsx> --contratos=<relatorio.xlsx> \
//     [--planos=<plano-next-fit.json>] [--etapa=1|2 --apply]
//
//   - Sem --apply: DRY-RUN. Lê e escreve só o relatório. (padrão)
//   - --apply exige --etapa. A etapa 2 exige --planos sem pendência.
//   - tenantId: obrigatório, sem padrão (a STRONIX é stronix-crm-app).
//
// O relatório, o esqueleto da tabela de planos e a cópia de segurança saem em
// ~/Backups/next-fit-sync/<tenant>-<data>/, fora do repositório, porque levam
// nome e telefone de pessoas. O console mostra só contagens.

import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import { toCsv } from '../src/lib/csvExport.js';
import { pickDefaultFunnel } from '../api/_referral.js';
import { distinctPlanNames, normalizeName } from '../src/lib/clientImport.js';
import {
  NF_ACTIVE, GROUPS, parsePeople, parseContracts, attachContracts, matchPeopleToLeads,
  planEtapa1, planEtapa2, buildEtapa2Items, extrasInStronilead, findUndefined
} from '../src/lib/nextFitSync.js';

// Datas das planilhas são dias do calendário das academias.
process.env.TZ = 'America/Sao_Paulo';

const USO = 'Uso: node --env-file=<.env.local> scripts/sync-clientes-next-fit.js <tenantId> --clientes=<xlsx> --contratos=<xlsx> [--planos=<json>] [--etapa=1|2 --apply]';
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = args.includes('--apply');
const ETAPA = flag('etapa');
const TENANT = args.find((a) => !a.startsWith('--'));
const CLIENTES = flag('clientes');
const CONTRATOS = flag('contratos');
const PLANOS = flag('planos');

const desconhecidas = args.filter((a) => a.startsWith('--') && a !== '--apply' && !/^--(clientes|contratos|planos|etapa)=/.test(a));
if (desconhecidas.length) {
  console.error(`Opção desconhecida: ${desconhecidas.join(', ')}\n${USO}`);
  process.exit(1);
}
if (!TENANT || !CLIENTES || !CONTRATOS) {
  console.error(`${USO}\nO tenant é obrigatório. Não existe padrão: errar o alvo aqui varre a academia errada.`);
  process.exit(1);
}
if (APPLY && !['1', '2'].includes(ETAPA)) {
  console.error('--apply exige --etapa=1 ou --etapa=2.');
  process.exit(1);
}
if (ETAPA && !['1', '2'].includes(ETAPA)) {
  console.error('--etapa só aceita 1 ou 2.');
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('Faltam env vars: FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const db = admin.firestore();

const LEADS = 'stronix_leads';
const CONTRACTS = 'stronix_contratos';
const INTERACTIONS = 'stronix_interactions';
const col = (name) => db.collection('artifacts').doc(TENANT).collection('public').doc('data').collection(name);
const readAll = async (name) => (await col(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

// Datas das planilhas chegam como número serial do Excel (sem cellDates): o
// parseImportDate converte sem erro de fuso.
const readSheet = (file) => {
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
};

const fmt = (d) => (d ? d.toLocaleDateString('pt-BR') : '');

async function run() {
  // Tenant inexistente varre um caminho vazio e conclui "0 a gravar" como se
  // tivesse dado certo (já aconteceu no backfill-zap-match-key.js).
  if (!(await db.collection('tenants').doc(TENANT).get()).exists) {
    console.error(`Tenant "${TENANT}" não existe na coleção 'tenants'.`);
    process.exit(1);
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const outDir = path.join(os.homedir(), 'Backups', 'next-fit-sync', `${TENANT}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });

  // --- leitura -------------------------------------------------------------
  const leadsSnap = await col(LEADS).get();
  const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lidoEm = new Map(leadsSnap.docs.map((d) => [d.id, d.updateTime]));
  const [planos, usersList, professores, funnels] = await Promise.all([
    readAll('stronix_planos'), readAll('stronix_users'), readAll('stronix_professores'), readAll('stronix_funnels')
  ]);
  const planMap = PLANOS ? JSON.parse(fs.readFileSync(PLANOS, 'utf8')) : {};

  // --- cálculo -------------------------------------------------------------
  const allPeople = parsePeople(readSheet(CLIENTES), now);
  const { people, orphans, onInactive } = attachContracts(allPeople, parseContracts(readSheet(CONTRATOS), now));
  const active = people.filter((p) => NF_ACTIVE.has(p.nf));
  const matched = matchPeopleToLeads(active, leads);
  const e1 = planEtapa1(matched);
  const e2 = planEtapa2(matched, now);
  const importMeta = {
    importedBy: 'script:sync-clientes-next-fit',
    importSource: 'nextfit',
    importBatchId: `nextfit-${stamp}`,
    now
  };
  const funnelId = pickDefaultFunnel(funnels)?.id ?? null;
  const built = buildEtapa2Items(e2.groups, { usersList, professores, planos, planMap, funnelId, importMeta, now });
  const extras = extrasInStronilead(matched, leads, now);

  const problemas = built.items
    .map((it) => findUndefined(it.leadData) || findUndefined(it.contract))
    .filter(Boolean);
  if (problemas.length) {
    console.error(`Gravação com campo undefined (${problemas[0]}). Nada será gravado até corrigir.`);
    process.exit(1);
  }

  // --- relatório (arquivos com nome e telefone, fora do repositório) -------
  const ambiguos = [...new Map([...e1.ambiguous, ...e2.ambiguous].map((m) => [m.person.rowNumber, m])).values()];
  const sheets = {
    'etapa1-a-gravar': [
      ['nome', 'preenche', 'lead'],
      e1.writes.map((w) => ({ nome: w.m.person.name, preenche: w.fills.join(' e '), lead: w.leadId }))
    ],
    'cpf-divergente': [
      ['nome', 'lead'],
      [...e1.conflicts, ...e2.conflicts].map((m) => ({ nome: m.person.name, lead: m.item.id }))
    ],
    ambiguos: [
      ['nome', 'candidatos'],
      ambiguos.map((m) => ({ nome: m.person.name, candidatos: m.candidates.map((c) => c.id).join(' ') }))
    ],
    'etapa2-a-criar': [
      ['grupo', 'nome', 'plano', 'inicio', 'fim', 'consultor'],
      built.items.map((it) => ({
        grupo: it.group, nome: it.leadName, plano: it.contract.planName,
        inicio: fmt(it.contract.startsAt), fim: fmt(it.contract.endsAt), consultor: it.owner.consultantName || 'sem dono'
      }))
    ],
    'sem-contrato-no-relatorio': [
      ['nome', 'situacao'],
      e2.semContrato.map((m) => ({ nome: m.person.name, situacao: m.person.nf }))
    ],
    'contrato-invalido': [
      ['nome', 'inicio', 'fim'],
      e2.contratoInvalido.map((m) => ({ nome: m.person.name, inicio: fmt(m.person.contract.startsAt), fim: fmt(m.person.contract.endsAt) }))
    ],
    'contrato-vigente-em-cliente-inativo': [
      ['nome', 'situacao', 'plano', 'fim'],
      onInactive.map((p) => ({ nome: p.name, situacao: p.nf, plano: p.contract.description, fim: fmt(p.contract.endsAt) }))
    ],
    'contrato-sem-pessoa': [
      ['nome', 'plano', 'fim'],
      orphans.map((o) => ({ nome: o.contract.name, plano: o.contract.description, fim: fmt(o.contract.endsAt) }))
    ],
    'clientes-a-mais-no-stronilead': [
      ['nome', 'lead'],
      extras.map((l) => ({ nome: l.name, lead: l.id }))
    ]
  };
  for (const [file, [labels, rows]] of Object.entries(sheets)) {
    const columns = labels.map((label) => ({ key: label, label }));
    fs.writeFileSync(path.join(outDir, `${file}.csv`), `﻿${toCsv(rows, columns)}`, { mode: 0o600 });
  }

  // Tabela de planos: esqueleto com o que o nome já resolve sozinho.
  const descricoes = distinctPlanNames(active.filter((p) => p.contract).map((p) => ({ planName: p.contract.description })));
  const esqueleto = Object.fromEntries(descricoes.map((d) => [
    d.key, planMap[d.key] ?? planos.find((p) => normalizeName(p.name) === d.key)?.id ?? null
  ]));
  fs.writeFileSync(path.join(outDir, 'plano-next-fit.json'), `${JSON.stringify(esqueleto, null, 2)}\n`, { mode: 0o600 });

  // --- resumo (só contagens) ----------------------------------------------
  const g = e2.groups;
  console.log(`\nAcerto com a Next Fit · tenant "${TENANT}" · ${APPLY ? `GRAVAR etapa ${ETAPA}` : 'DRY-RUN'}`);
  console.log(`Next Fit: ${allPeople.length} clientes, ${active.length} ativos ou suspensos. Stronilead: ${leads.length} fichas.`);
  console.log(`Etapa 1: ${e1.writes.length} fichas a completar. CPF divergente: ${e1.conflicts.length + e2.conflicts.length}. Ambíguas: ${ambiguos.length}.`);
  console.log(`Etapa 2: ${g[GROUPS.CONTRATO_NAO_ATIVO].length} clientes com contrato não ativo, ${g[GROUPS.SO_LEAD].length} só leads, ${g[GROUPS.SEM_CADASTRO].length} sem cadastro. Já ativos: ${e2.jaAtivos}.`);
  console.log(`  Gravações montadas: ${built.items.length}. Puladas pela tabela: ${built.skipped.length}. Sem contrato no relatório: ${e2.semContrato.length}. Contrato inválido: ${e2.contratoInvalido.length}.`);
  console.log(`Fora do motor: ${extras.length} clientes a mais no Stronilead, ${onInactive.length} contratos vigentes em cliente inativo, ${orphans.length} contratos sem pessoa.`);
  if (built.unmapped.length) {
    console.log(`\nDescrições de contrato sem plano ligado (${built.unmapped.length}). Preencha ${path.join(outDir, 'plano-next-fit.json')} com o id do plano, "__skip__" ou "__text__":`);
    for (const u of built.unmapped) console.log(`  ${u.count}x ${u.label}`);
    console.log('Planos do catálogo:');
    for (const p of planos) console.log(`  ${p.id}  ${p.name}`);
  }
  console.log(`\nRelatório em ${outDir}`);

  if (!APPLY) {
    console.log('DRY-RUN: nada foi gravado. Revise o relatório e rode de novo com --apply --etapa=N para gravar.');
    return;
  }
  await aplicar({ e1, built, leads, lidoEm, outDir, importMeta });
}

// Preenchido na tarefa 6.
async function aplicar() {
  throw new Error('Gravação ainda não implementada.');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Passo 2: lint**

```bash
npx eslint scripts/sync-clientes-next-fit.js
```

Esperado: sem erros. Se o lint reclamar de `aplicar` sem parâmetros, ignore até a tarefa 6.

- [ ] **Passo 3: ensaio de leitura na STRONIX (somente leitura)**

```bash
node --env-file=/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.env.local scripts/sync-clientes-next-fit.js stronix-crm-app --clientes="/Users/johnnybittencourt/Downloads/clientes-11_11_2026.xlsx" --contratos="/Users/johnnybittencourt/Downloads/Relatório de contratos a vencer-11-11-2026-16-52.xlsx"
```

Esperado: imprime o resumo, termina com "DRY-RUN: nada foi gravado" e cria a pasta em `~/Backups/next-fit-sync/`. Compare com a tabela do spec (522 já ativos, 20 com contrato não ativo, 8 só leads, 20 sem cadastro, 7 ambíguas, 71 sem CPF, 3 divergentes, 63 a mais). Diferenças pequenas são esperadas, porque o casamento do motor é mais conservador que a medição de 11/11. Anote cada diferença e a causa antes de seguir.

- [ ] **Passo 4: commit (só se o Johnny pedir)**

```bash
git add scripts/sync-clientes-next-fit.js
git commit -m "feat: script do motor de acerto com a Next Fit, modo relatório"
```

---

### Tarefa 6: Script, parte 2 (gravação)

**Arquivos:**
- Modificar: `scripts/sync-clientes-next-fit.js` (trocar a função `aplicar` provisória e o final do arquivo)

- [ ] **Passo 1: implementar a gravação**

Trocar o bloco `// Preenchido na tarefa 6.` e a função `aplicar` por:

```js
// Lote recusado pela precondição (o documento mudou depois da leitura).
class LoteRecusado extends Error {}
const PRECONDICAO_FALHOU = new Set([9, 5]);
const BATCH_UPDATES = 400;
const BATCH_ITEMS = 130; // 3 gravações por item da etapa 2, abaixo do teto de 500

function guardarCopia(outDir, nome, conteudo) {
  const file = path.join(outDir, nome);
  fs.writeFileSync(file, JSON.stringify(conteudo, null, 2), { mode: 0o600 });
  console.log(`Cópia de segurança em ${file}`);
}

async function commitOuRecusa(batch, lote, lotes, feitos) {
  try {
    await batch.commit();
  } catch (err) {
    if (!PRECONDICAO_FALHOU.has(err?.code)) throw err;
    throw new LoteRecusado([
      `O lote ${lote} de ${lotes} foi recusado: uma ficha mudou, ou foi apagada, depois da leitura. Nada desse lote foi gravado.`,
      feitos ? `Os ${feitos} lotes anteriores já estão gravados.` : null,
      'Rode de novo, primeiro sem --apply, para conferir a lista atualizada. Quem já foi acertado não entra de novo.',
      `Detalhe do Firestore: ${err.message}`
    ].filter(Boolean).join('\n'));
  }
}

async function aplicar({ e1, built, leads, lidoEm, outDir, importMeta }) {
  const byId = new Map(leads.map((l) => [l.id, l]));
  // Sem a hora da leitura o script para: precondição vazia tiraria até a
  // exigência de o documento existir.
  const precondicao = (id) => {
    const lastUpdateTime = lidoEm.get(id);
    if (!lastUpdateTime) throw new Error(`Sem a hora da leitura da ficha ${id}. Nada foi gravado.`);
    return { lastUpdateTime };
  };
  const ts = admin.firestore.FieldValue.serverTimestamp();

  if (ETAPA === '1') {
    const antes = Object.fromEntries(e1.writes.map((w) => [
      w.leadId, Object.fromEntries(Object.keys(w.patch).map((k) => [k, byId.get(w.leadId)[k] ?? null]))
    ]));
    guardarCopia(outDir, 'copia-etapa1.json', antes);
    const lotes = Math.ceil(e1.writes.length / BATCH_UPDATES);
    for (let i = 0; i < e1.writes.length; i += BATCH_UPDATES) {
      const batch = db.batch();
      for (const w of e1.writes.slice(i, i + BATCH_UPDATES)) {
        batch.update(col(LEADS).doc(w.leadId), w.patch, precondicao(w.leadId));
      }
      await commitOuRecusa(batch, i / BATCH_UPDATES + 1, lotes, i / BATCH_UPDATES);
    }
    console.log(`Concluído: ${e1.writes.length} fichas completadas.`);
    return;
  }

  if (built.unmapped.length) {
    throw new Error(`Há ${built.unmapped.length} descrição(ões) de contrato sem plano ligado. Preencha a tabela de planos e rode de novo.`);
  }
  const prepared = built.items.map((it) => ({
    it,
    leadRef: it.leadId ? col(LEADS).doc(it.leadId) : col(LEADS).doc(),
    contractRef: col(CONTRACTS).doc()
  }));
  guardarCopia(outDir, 'copia-etapa2.json', {
    lote: importMeta.importBatchId,
    criados: prepared.filter((p) => p.it.isNew).map((p) => ({ lead: p.leadRef.id, contrato: p.contractRef.id })),
    contratosNovosEmFichasExistentes: prepared.filter((p) => !p.it.isNew).map((p) => ({ lead: p.leadRef.id, contrato: p.contractRef.id })),
    antes: Object.fromEntries(prepared.filter((p) => !p.it.isNew).map((p) => [
      p.leadRef.id,
      Object.fromEntries([...Object.keys(p.it.leadData), 'currentContractId'].map((k) => [k, byId.get(p.leadRef.id)[k] ?? null]))
    ]))
  });
  const lotes = Math.ceil(prepared.length / BATCH_ITEMS);
  for (let i = 0; i < prepared.length; i += BATCH_ITEMS) {
    const batch = db.batch();
    for (const { it, leadRef, contractRef } of prepared.slice(i, i + BATCH_ITEMS)) {
      const leadData = { ...it.leadData, importedAt: ts, currentContractId: contractRef.id };
      batch.set(contractRef, { ...it.contract, leadId: leadRef.id, createdAt: ts, importedAt: ts });
      if (it.isNew) batch.create(leadRef, leadData);
      else batch.update(leadRef, leadData, precondicao(it.leadId));
      // Evento de sistema, sem bump de lastInteractionAt: acerto de base não é contato.
      batch.set(col(INTERACTIONS).doc(), {
        leadId: leadRef.id,
        leadName: it.leadName || null,
        consultantName: 'Acerto da base com a Next Fit',
        leadConsultantId: it.owner?.consultantId ?? null,
        leadConsultantAuthUid: it.owner?.consultantAuthUid ?? null,
        actorId: null,
        actorAuthUid: null,
        text: it.interactionText,
        type: 'import',
        importedBy: importMeta.importedBy,
        importSource: importMeta.importSource,
        importBatchId: importMeta.importBatchId,
        importedAt: ts,
        createdAt: ts
      });
    }
    await commitOuRecusa(batch, i / BATCH_ITEMS + 1, lotes, i / BATCH_ITEMS);
  }
  console.log(`Concluído: ${prepared.length} matrículas registradas (${prepared.filter((p) => p.it.isNew).length} cadastros novos).`);
}
```

E trocar o final do arquivo (o `run().then(...)`) por:

```js
run().then(() => process.exit(0)).catch((err) => {
  if (err instanceof LoteRecusado) console.error(`\n${err.message}`);
  else console.error(err);
  process.exit(1);
});
```

(`LoteRecusado` é declarada acima de `aplicar`; como `run()` só roda depois do módulo carregar, a ordem não causa erro.)

- [ ] **Passo 2: lint e recusa sem etapa**

```bash
npx eslint scripts/sync-clientes-next-fit.js && node --env-file=/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.env.local scripts/sync-clientes-next-fit.js stronix-crm-app --clientes="/Users/johnnybittencourt/Downloads/clientes-11_11_2026.xlsx" --contratos="/Users/johnnybittencourt/Downloads/Relatório de contratos a vencer-11-11-2026-16-52.xlsx" --apply
```

Esperado: lint limpo e o segundo comando falha na hora com "--apply exige --etapa=1 ou --etapa=2." Nada é gravado.

- [ ] **Passo 3: commit (só se o Johnny pedir)**

```bash
git add scripts/sync-clientes-next-fit.js
git commit -m "feat: gravação das etapas 1 e 2 do motor de acerto com a Next Fit"
```

---

### Tarefa 7: Rodar na STRONIX (com o OK do Johnny em cada porta)

Nada desta tarefa grava sem o OK explícito do Johnny no passo marcado.

- [ ] **Passo 1: relatório e conferência**

Rodar o comando do passo 3 da Tarefa 5. Abrir a pasta de saída e conferir com o Johnny: `etapa1-a-gravar.csv`, `cpf-divergente.csv`, `ambiguos.csv`. Resolver na mão o que for ambíguo ou divergente, direto nas fichas.

- [ ] **Passo 2: OK do Johnny, depois etapa 1**

Com o OK:

```bash
node --env-file=/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.env.local scripts/sync-clientes-next-fit.js stronix-crm-app --clientes="/Users/johnnybittencourt/Downloads/clientes-11_11_2026.xlsx" --contratos="/Users/johnnybittencourt/Downloads/Relatório de contratos a vencer-11-11-2026-16-52.xlsx" --etapa=1 --apply
```

Esperado: "Concluído: N fichas completadas" e a cópia de segurança em `copia-etapa1.json`.

- [ ] **Passo 3: provar a idempotência**

Repetir o relatório (sem `--apply`). Esperado: "Etapa 1: 0 fichas a completar". Se sobrar alguma, é divergente ou ambígua listada.

- [ ] **Passo 4: tabela de planos**

Abrir `plano-next-fit.json` da última execução. Mostrar ao Johnny as descrições do relatório e o catálogo impresso no console, e preencher cada uma com o id do plano, `"__skip__"` (Freepass, Experience, contratos marcados "não usar") ou `"__text__"`. Guardar o arquivo preenchido fora do repositório.

- [ ] **Passo 5: relatório da etapa 2 com a tabela**

Repetir o relatório com `--planos=<arquivo preenchido>`. Esperado: nenhuma descrição pendente. Conferir `etapa2-a-criar.csv` com o Johnny.

- [ ] **Passo 6: OK do Johnny, depois etapa 2**

Com o OK:

```bash
node --env-file=/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.env.local scripts/sync-clientes-next-fit.js stronix-crm-app --clientes="/Users/johnnybittencourt/Downloads/clientes-11_11_2026.xlsx" --contratos="/Users/johnnybittencourt/Downloads/Relatório de contratos a vencer-11-11-2026-16-52.xlsx" --planos=<arquivo preenchido> --etapa=2 --apply
```

Esperado: "Concluído: N matrículas registradas".

- [ ] **Passo 7: conferir os painéis**

Abrir o Gerencial e o Operacional da STRONIX e confirmar que as vendas e matrículas de novembro não mudaram por causa dos contratos criados (eles são importados). Repetir o relatório: etapa 2 deve mostrar 0 gravações montadas.

---

### Tarefa 8: Documentar

**Arquivos:**
- Modificar: `docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md`
- Modificar: `CLAUDE.md` do Stronilead

- [ ] **Passo 1: acertar a linha do spec sobre o cadastro novo**

Em `docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md`, trocar:

```
- Endereço, e-mail, sexo e demais dados cadastrais. O motor só completa CPF e nascimento.
```

por:

```
- Endereço, e-mail, sexo e demais dados cadastrais de quem já tem ficha. O motor só completa CPF e nascimento nelas. O cadastro novo, criado na etapa 2, nasce com os dados que a Next Fit tem.
```

E mudar `status: revisão` do topo para `status: ativo`.

- [ ] **Passo 2: seção no CLAUDE.md do Stronilead**

Em `CLAUDE.md`, inserir antes da linha `## Proteção de erro fora do conteúdo`:

```markdown
## Acerto da base com a Next Fit

`scripts/sync-clientes-next-fit.js` compara duas exportações da Next Fit (lista de clientes e relatório de contratos a vencer) com os leads de uma academia. Spec em `docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md`, plano em `docs/superpowers/plans/2026-11-11-motor-acerto-base-next-fit.md`. As regras moram em `src/lib/nextFitSync.js`, com teste.

- **Só grava com `--apply --etapa=N`.** Sem isso é relatório. Etapa 1 completa CPF e nascimento vazios de quem já é cliente. Etapa 2 cria as matrículas que faltam.
- **Casamento:** CPF, depois telefone (`zapMatchKey`) com o mesmo primeiro nome, depois nome completo único. Homônimo vira ambíguo e nada é gravado nele. CPF diferente do da ficha é conflito e também não grava.
- **O contrato da etapa 2 nasce marcado como importado** (`importSource` e `importBatchId`), como na importação de clientes, para não entrar como venda nos painéis. Não leva `renewedFromId`.
- **Planilha e relatório levam nome e telefone.** Ficam em `~/Backups/next-fit-sync/`, fora do repositório, assim como a cópia de segurança de cada etapa. Nunca versionar.
- **As planilhas são lidas sem `cellDates`.** Com `cellDates` o SheetJS desloca datas antigas no fuso de São Paulo. A data chega como número serial e o `parseImportDate` a converte.
```

- [ ] **Passo 3: checagem final**

```bash
npx vitest run src/lib/__tests__/nextFitSync.test.js src/lib/__tests__/clientImport.test.js && npm run lint
```

Esperado: tudo passa.

- [ ] **Passo 4: commit (só se o Johnny pedir)**

```bash
git add docs/superpowers CLAUDE.md
git commit -m "docs: motor de acerto da base com a Next Fit"
```

---

## Autoavaliação contra o spec

- **Casamento** (CPF, telefone com primeiro nome, nome completo, ambíguos): Tarefa 2.
- **Etapa 1** (só vazio, sem sobrescrever, divergente e ambíguo no relatório): Tarefa 3.
- **Etapa 2**, três grupos: Tarefa 4. O spec fala em "chave de gravação por grupo"; o plano simplifica para uma chave por etapa, porque os grupos usam o mesmo construtor e o relatório já os separa.
- **Contrato importado, tabela de planos com pulo, bloqueados fora:** Tarefa 4 (`buildEtapa2Items`, `NF_ACTIVE`).
- **Relatório, cópia de segurança, lotes com precondição, tenant obrigatório, dry-run padrão:** Tarefas 5 e 6.
- **Testes e ensaio na STRONIX:** Tarefas 1 a 4 e 7.
- **Critério de pronto** (idempotência, painéis sem mudança): Tarefa 7, passos 3 e 7.

## Limites conhecidos

- A gravação nunca foi exercitada contra o Firestore antes do passo 2 da Tarefa 7. Os testes cobrem as regras, não o `batch.create` e o `update` com precondição.
- O `deriveLeadContractStatus` define quem é "ativo". Trancado conta como ativo; se o Johnny quiser tirar, é a constante `ACTIVE_CONTRACT`.
- Sem consultor na planilha, o cadastro novo nasce sem dono e aparece no relatório como "sem dono".
