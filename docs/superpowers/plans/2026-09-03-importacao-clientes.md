| `src/lib/clientImportWrites.js` (novo) | `lookupExisting` (consultas `in` por `cpfDigits` e `whatsappDigits`, `array-contains-any` em `nameTokens` para os homônimos)  const wanted = new Set(unmatched.map((c) => c.nameLower).filter(Boolean));
  const firstTokens = [...new Set(unmatched.map((c) => c.nameLower.split(' ')[0]).filter(Boolean))];
  for (const part of chunk(firstTokens, IN_LIMIT)) {
    const snap = await getDocs(query(leadsCol(db), where('nameTokens', 'array-contains-any', part)));
    snap.docs.forEach((d) => {
      const l = normalizeLeadDoc(d);
      const key = normalizeName(l.name);
      if (!wanted.has(key)) return;
      const list = byName.get(key) || [];
      if (!list.some((x) => x.id === l.id)) list.push(l);
      byName.set(key, list);
    });
  }
  return { byCpf, byPhone, byName };# Importação de clientes de outros sistemas: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar, por planilha, os clientes ativos de outro sistema de gestão para dentro do tenant de uma academia, produzindo o mesmo par lead + contrato da matrícula pela tela, sem duplicar quem já existe e sem inventar vigência.

**Architecture:** Regra pura em `src/lib/clientImport.js` e `src/lib/importPresets.js` (testadas no vitest), gravação em `src/lib/clientImportWrites.js` (consultas em lote + batches), leitura do arquivo em `src/lib/spreadsheetRead.js` (SheetJS sob demanda) e um assistente de quatro passos em `src/views/settings/ImportClientsSection.jsx`, visível só na sessão assumida do super console. Nenhuma função nova na Vercel, nenhuma regra nova no Firestore, nenhum índice novo.

**Tech Stack:** React 19 (JS/JSX, sem TS), Firebase Firestore SDK (client), SheetJS `xlsx` 0.20.3 (CDN oficial), vitest, Tailwind v4 + shadcn (`select.jsx`).

**Spec:** `docs/superpowers/specs/2026-09-03-importacao-clientes-design.md`

---

## Antes de começar

- Branch de trabalho: `claude/stronilead-customer-import-dadc92` (worktree `confident-ramanujan-6812a9`). Nunca commitar na `main`.
- Rodar `npm install` uma vez no worktree (memória do repo: `tw-animate-css` e `eslint-plugin-react` costumam faltar em worktree novo).
- Comandos de verificação: `npm test` (vitest), `npm run lint` (eslint 9, react-hooks v7), `npm run build`.
- Commits em português, formato `tipo: descrição`, sempre terminando com a linha `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Todo texto de interface em pt-BR, sem travessão no meio de frase.
- Datas no código sempre em horário LOCAL (`new Date(y, m - 1, d)`), como o app grava.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Nova dependência `xlsx` (tarball oficial do SheetJS, versão pinada). |
| `src/lib/spreadsheetRead.js` (novo) | Lê `.xlsx`/`.csv` do `File` do navegador e devolve `{ headers, rows }`. Único lugar que importa `xlsx`, por `import()` dinâmico. |
| `src/lib/importPresets.js` (novo) | Campos-alvo, presets por sistema (NextFit pronto), detecção pela assinatura dos cabeçalhos e chute por sinônimo para o mapeamento manual. |
| `src/lib/clientImport.js` (novo) | Normalizadores (telefone, CPF, nome, data, sexo, VIP, situações), `parseRow`, dedupe no arquivo, enriquecimento (consultor, professor, plano), escopo, casamento, classificação, `buildImportedClientWrites`, contadores e CSV do relatório. Puro. |
| `src/lib/clientImportWrites.js` (novo) | `lookupExisting` (consultas `in` por `cpfDigits`, `whatsappDigits`, `nameLower`) e `runImport` (batches de até 450 operações, progresso, falha por lote). |
| `src/lib/timeline.js` | `type: 'import'` classifica como Sistema. |
| `src/views/settings/ImportClientsSection.jsx` (novo) | O assistente: Arquivo → Mapeamento → Revisão → Importar. |
| `src/views/settings/SettingsView.jsx` | Item "Importar clientes" no grupo Pessoas, só com `appUser.impersonating` (ou dev local). |
| `src/lib/__tests__/importPresets.test.js` (novo) | Detecção e mapeamento. |
| `src/lib/__tests__/clientImport.test.js` (novo) | Normalizadores, parse, dedupe, escopo, casamento, classificação, escritas, paridade com `buildMatriculaWrites`. |
| `src/lib/__tests__/timeline.test.js` | Um caso novo: evento `import` é Sistema. |
| `docs/superpowers/fixtures/2026-09-03-nextfit-cadastro-exemplo.csv` (novo) | Planilha de cadastro fictícia para o teste real (rodada 1). |
| `docs/superpowers/fixtures/2026-09-03-nextfit-contratos-exemplo.csv` (novo) | Relatório de contratos fictício (rodada 2). |

## Formas de dado compartilhadas

**Mapeamento** (`mapping`): objeto `{ [campoAlvo]: cabeçalhoExatoDoArquivo | null }`. Os campos-alvo são os `id` de `TARGET_FIELDS` em `importPresets.js`.

**Candidato** (saída de `parseRow`): `{ rowNumber, name, nameLower, email, whatsappRaw, whatsappDigits, cpfDigits, cpfInvalid, rg, birthDate, registeredAt, sexo, dor, vip, address, consultantName, professorName, planName, contractSituation, clientSituation, startsAt, endsAt, value, warnings }`. Depois de `dedupeInFile` pode ter `duplicateOf` (número da linha que ficou). Depois de `enrichCandidate` ganha `consultant` (doc de `stronix_users` ou null), `professorId`, `plan` (doc de `stronix_planos` ou null).

**Casamento** (saída de `resolveMatch`): `{ kind: 'cpf' | 'phone' | 'name' | 'none', lead, homonyms }`.

**Classificação** (saída de `classifyCandidate`): `{ outcome, reason, lead, fill, createContract, homonyms }`. `outcome` é um dos `OUTCOME.*`.

**Escritas** (saída de `buildImportedClientWrites`): `{ isNew, leadId, leadName, leadData, contract, interactionText, owner, warnings }`.

---

### Task 1: Dependência SheetJS e leitor de planilha

**Files:**
- Modify: `package.json`
- Create: `src/lib/spreadsheetRead.js`

Não há teste unitário: o módulo depende do `File` do navegador. A verificação é o lint, o build e o teste real da Task 11.

- [ ] **Step 1: Instalar o SheetJS pelo tarball oficial (o pacote `xlsx` do npm parou em 0.18.5 e tem CVE aberta)**

Run:
```bash
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```
Expected: `package.json` ganha `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` em `dependencies` e o `package-lock.json` registra a URL com `integrity`.

- [ ] **Step 2: Escrever o leitor**

Create `src/lib/spreadsheetRead.js`:

```js
// Leitura da planilha de importação (.xlsx ou .csv) no navegador. Único lugar
// que toca o SheetJS, e por import() dinâmico: quem nunca importa nada não paga
// o peso da biblioteca no bundle. Devolve cabeçalhos e linhas como objetos
// chaveados pelo cabeçalho, mais `__row` (número da linha na planilha, base 1)
// para o relatório apontar a linha certa.
//
// `cellDates: true` faz célula de data virar Date; `raw: true` preserva número
// e Date em vez de texto formatado. Texto de data em CSV chega como string e o
// parseImportDate (clientImport.js) resolve.

const loadXlsx = async () => {
  const mod = await import('xlsx');
  return typeof mod.read === 'function' ? mod : mod.default;
};

// Cabeçalho repetido ganha sufixo " (2)", " (3)"... para o mapeamento por
// nome não ambiguar.
const uniqueHeaders = (raw) => {
  const seen = new Map();
  return raw.map((h) => {
    const base = String(h ?? '').trim();
    if (!base) return '';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
};

export async function readSpreadsheetFile(file) {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Planilha sem aba.');
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const headerIdx = matrix.findIndex((r) => r.some((v) => String(v ?? '').trim() !== ''));
  if (headerIdx < 0) throw new Error('Planilha vazia.');
  const headers = uniqueHeaders(matrix[headerIdx]);
  const rows = matrix
    .slice(headerIdx + 1)
    .map((r, i) => ({ cells: r, row: headerIdx + 2 + i }))
    .filter(({ cells }) => cells.some((v) => v !== '' && v != null))
    .map(({ cells, row }) => {
      const obj = { __row: row };
      headers.forEach((h, j) => { if (h) obj[h] = cells[j]; });
      return obj;
    });
  return { headers: headers.filter(Boolean), rows, sheetName };
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erro novo (os 15 erros conhecidos de react-hooks v7 em telas antigas continuam; nenhum em `spreadsheetRead.js`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/spreadsheetRead.js
git commit -m "feat: leitor de planilha da importação de clientes (SheetJS sob demanda)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Presets e mapeamento de colunas

**Files:**
- Create: `src/lib/importPresets.js`
- Test: `src/lib/__tests__/importPresets.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/__tests__/importPresets.test.js`:

```js
// Presets de importação: a assinatura reconhece o sistema, o mapeamento casa o
// cabeçalho real do arquivo (com acento, caixa e pontuação diferentes) e o que
// nenhum preset conhece cai no chute por sinônimo.

import { describe, it, expect } from 'vitest';
import {
  normalizeHeader,
  detectPreset,
  buildMapping,
  importSourceLabel,
  IMPORT_PRESETS,
  TARGET_FIELDS
} from '../importPresets.js';

const NEXTFIT_HEADERS = [
  'Nome', 'E-mail', 'Contrato', 'Telefone', 'Situação do contrato', 'Situação do cliente',
  'CPF', 'RG', 'Data de nascimento', 'Data de cadastro', 'Objetivo', 'Sexo', 'VIP',
  'Endereco', 'Número', 'Bairro', 'Cep', 'Cidade', 'Complemento', 'Consultor', 'Professor'
];

describe('normalizeHeader', () => {
  it('tira acento, caixa e pontuação e colapsa espaços', () => {
    expect(normalizeHeader('  Situação  do_Contrato ')).toBe('situacao do contrato');
    expect(normalizeHeader('E-mail')).toBe('e mail');
    expect(normalizeHeader('DATA DE NASCIMENTO')).toBe('data de nascimento');
  });
});

describe('detectPreset', () => {
  it('reconhece o NextFit pelos cabeçalhos da exportação de cadastro', () => {
    expect(detectPreset(NEXTFIT_HEADERS)?.id).toBe('nextfit');
  });

  it('reconhece mesmo com caixa e acento diferentes', () => {
    const headers = NEXTFIT_HEADERS.map((h) => h.toUpperCase().replace('Ç', 'C'));
    expect(detectPreset(headers)?.id).toBe('nextfit');
  });

  it('não reconhece um relatório de contratos (falta a assinatura)', () => {
    expect(detectPreset(['Nome', 'CPF', 'Contrato', 'Data de início', 'Data de fim', 'Valor'])).toBeNull();
  });

  it('todo preset tem id, label, assinatura e colunas', () => {
    IMPORT_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.signature.length).toBeGreaterThan(0);
      Object.keys(p.columns).forEach((field) => {
        expect(TARGET_FIELDS.some((f) => f.id === field)).toBe(true);
      });
    });
  });
});

describe('buildMapping', () => {
  it('com o preset do NextFit mapeia os 21 cabeçalhos para os campos certos', () => {
    const m = buildMapping(NEXTFIT_HEADERS, detectPreset(NEXTFIT_HEADERS));
    expect(m.name).toBe('Nome');
    expect(m.whatsapp).toBe('Telefone');
    expect(m.planName).toBe('Contrato');
    expect(m.contractSituation).toBe('Situação do contrato');
    expect(m.clientSituation).toBe('Situação do cliente');
    expect(m.registeredAt).toBe('Data de cadastro');
    expect(m.dor).toBe('Objetivo');
    expect(m.addrStreet).toBe('Endereco');
    expect(m.addrNumber).toBe('Número');
    expect(m.addrCep).toBe('Cep');
    expect(m.consultantName).toBe('Consultor');
    expect(m.professorName).toBe('Professor');
    expect(m.contractEndsAt).toBeNull();
    expect(m.contractStartsAt).toBeNull();
    expect(m.contractValue).toBeNull();
  });

  it('devolve o cabeçalho REAL do arquivo, não o do preset', () => {
    const headers = NEXTFIT_HEADERS.map((h) => h.toUpperCase());
    const m = buildMapping(headers, detectPreset(headers));
    expect(m.name).toBe('NOME');
    expect(m.contractSituation).toBe('SITUAÇÃO DO CONTRATO');
  });

  it('sem preset chuta por sinônimo (relatório de contratos)', () => {
    const headers = ['Nome', 'CPF', 'Contrato', 'Data de início', 'Data de fim', 'Valor', 'Situação do contrato'];
    const m = buildMapping(headers, null);
    expect(m.name).toBe('Nome');
    expect(m.cpf).toBe('CPF');
    expect(m.planName).toBe('Contrato');
    expect(m.contractStartsAt).toBe('Data de início');
    expect(m.contractEndsAt).toBe('Data de fim');
    expect(m.contractValue).toBe('Valor');
    expect(m.contractSituation).toBe('Situação do contrato');
    expect(m.whatsapp).toBeNull();
  });

  it('um cabeçalho nunca alimenta dois campos', () => {
    const m = buildMapping(['Vencimento'], null);
    const used = Object.values(m).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
    expect(m.contractEndsAt).toBe('Vencimento');
  });

  it('todo campo-alvo aparece no mapeamento, mesmo que nulo', () => {
    const m = buildMapping(['Qualquer coisa'], null);
    TARGET_FIELDS.forEach((f) => expect(f.id in m).toBe(true));
  });
});

describe('importSourceLabel', () => {
  it('usa o rótulo do preset ou "planilha" sem preset', () => {
    expect(importSourceLabel(IMPORT_PRESETS[0])).toBe('NextFit');
    expect(importSourceLabel(null)).toBe('planilha');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/importPresets.test.js`
Expected: FAIL (módulo `../importPresets.js` não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/importPresets.js`:

```js
// Presets de importação por sistema de origem (NextFit hoje; Pacto, Evo, SCA e
// Tecnofit entram conforme a primeira exportação de cada um chegar) e o chute
// inicial do mapeamento manual. Puro: sem React, sem Firestore.
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md
//
// Um preset é assinatura + colunas. A assinatura é o conjunto mínimo de
// cabeçalhos (normalizados) que identifica o sistema; as colunas dizem qual
// cabeçalho alimenta cada campo do Stronilead. O que nenhum preset reconhece
// cai no chute por sinônimo, e o que sobrar o gestor mapeia na tela.

import { normalize } from './globalSearch.js';

// Cabeçalho normalizado: minúsculas, sem acento, só letras e números, espaços
// únicos. "Situação do contrato" e "SITUACAO_DO_CONTRATO" viram a mesma chave.
export const normalizeHeader = (h) =>
  normalize(h).replace(/[^a-z0-9]+/g, ' ').trim();

// Campos-alvo do importador. `group` só organiza a tela de mapeamento.
export const TARGET_FIELDS = [
  { id: 'name', label: 'Nome', group: 'pessoa', required: true },
  { id: 'whatsapp', label: 'Telefone / WhatsApp', group: 'pessoa' },
  { id: 'cpf', label: 'CPF', group: 'pessoa' },
  { id: 'email', label: 'E-mail', group: 'pessoa' },
  { id: 'rg', label: 'RG', group: 'pessoa' },
  { id: 'birthDate', label: 'Data de nascimento', group: 'pessoa' },
  { id: 'sexo', label: 'Sexo', group: 'pessoa' },
  { id: 'dor', label: 'Objetivo', group: 'pessoa' },
  { id: 'vip', label: 'VIP', group: 'pessoa' },
  { id: 'registeredAt', label: 'Data de cadastro', group: 'pessoa' },
  { id: 'consultantName', label: 'Consultor', group: 'pessoa' },
  { id: 'professorName', label: 'Professor', group: 'pessoa' },
  { id: 'addrStreet', label: 'Endereço (rua)', group: 'endereco' },
  { id: 'addrNumber', label: 'Número', group: 'endereco' },
  { id: 'addrComplement', label: 'Complemento', group: 'endereco' },
  { id: 'addrNeighborhood', label: 'Bairro', group: 'endereco' },
  { id: 'addrCep', label: 'CEP', group: 'endereco' },
  { id: 'addrCity', label: 'Cidade', group: 'endereco' },
  { id: 'planName', label: 'Plano / contrato', group: 'contrato' },
  { id: 'contractSituation', label: 'Situação do contrato', group: 'contrato' },
  { id: 'clientSituation', label: 'Situação do cliente', group: 'contrato' },
  { id: 'contractStartsAt', label: 'Início da vigência', group: 'contrato' },
  { id: 'contractEndsAt', label: 'Fim da vigência', group: 'contrato' },
  { id: 'contractValue', label: 'Valor', group: 'contrato' }
];

export const TARGET_GROUP_LABEL = { pessoa: 'Pessoa', endereco: 'Endereço', contrato: 'Contrato' };

// Sinônimos (já normalizados) por campo. Alimentam o chute do mapeamento manual
// e cobrem coluna faltando num preset. A ordem dentro de cada lista é a
// preferência.
const ALIASES = {
  name: ['nome', 'nome completo', 'aluno', 'cliente', 'nome do aluno', 'nome do cliente'],
  whatsapp: ['telefone', 'celular', 'whatsapp', 'fone', 'telefone celular', 'tel'],
  cpf: ['cpf', 'cpf cnpj', 'documento'],
  email: ['e mail', 'email'],
  rg: ['rg', 'identidade'],
  birthDate: ['data de nascimento', 'nascimento', 'dt nascimento', 'data nascimento', 'aniversario'],
  sexo: ['sexo', 'genero'],
  dor: ['objetivo', 'objetivos', 'dor', 'meta'],
  vip: ['vip'],
  registeredAt: ['data de cadastro', 'cadastro', 'dt cadastro', 'data cadastro', 'cadastrado em', 'data de entrada'],
  consultantName: ['consultor', 'vendedor', 'consultor responsavel', 'responsavel'],
  professorName: ['professor', 'instrutor', 'personal', 'treinador'],
  addrStreet: ['endereco', 'logradouro', 'rua', 'endereco rua'],
  addrNumber: ['numero', 'num', 'n'],
  addrComplement: ['complemento'],
  addrNeighborhood: ['bairro'],
  addrCep: ['cep'],
  addrCity: ['cidade', 'municipio'],
  planName: ['contrato', 'plano', 'nome do plano', 'nome do contrato', 'produto'],
  contractSituation: ['situacao do contrato', 'status do contrato', 'situacao contrato', 'status contrato', 'situacao'],
  clientSituation: ['situacao do cliente', 'status do cliente', 'situacao cliente', 'status cliente', 'status do aluno', 'situacao do aluno'],
  contractStartsAt: ['data de inicio', 'inicio', 'data inicio', 'inicio do contrato', 'inicio da vigencia', 'vigencia inicio', 'data inicial', 'dt inicio'],
  contractEndsAt: ['data de fim', 'fim', 'data fim', 'vencimento', 'data de vencimento', 'termino', 'data de termino', 'fim do contrato', 'fim da vigencia', 'vigencia fim', 'validade', 'data final', 'dt fim', 'dt vencimento'],
  contractValue: ['valor', 'valor do contrato', 'valor pago', 'mensalidade', 'valor total', 'preco']
};

export const IMPORT_PRESETS = [
  {
    id: 'nextfit',
    label: 'NextFit',
    // Cinco cabeçalhos que, juntos, só a exportação de cadastro do NextFit tem.
    signature: ['nome', 'cpf', 'situacao do contrato', 'situacao do cliente', 'data de cadastro'],
    columns: {
      name: 'Nome',
      email: 'E-mail',
      planName: 'Contrato',
      whatsapp: 'Telefone',
      contractSituation: 'Situação do contrato',
      clientSituation: 'Situação do cliente',
      cpf: 'CPF',
      rg: 'RG',
      birthDate: 'Data de nascimento',
      registeredAt: 'Data de cadastro',
      dor: 'Objetivo',
      sexo: 'Sexo',
      vip: 'VIP',
      addrStreet: 'Endereco',
      addrNumber: 'Número',
      addrNeighborhood: 'Bairro',
      addrCep: 'Cep',
      addrCity: 'Cidade',
      addrComplement: 'Complemento',
      consultantName: 'Consultor',
      professorName: 'Professor'
    }
  }
];

export const detectPreset = (headers) => {
  const set = new Set((headers || []).map(normalizeHeader));
  return IMPORT_PRESETS.find((p) => p.signature.every((s) => set.has(s))) || null;
};

// Mapa campo-alvo → cabeçalho REAL do arquivo (string exata), ou null. Primeiro
// as colunas do preset, depois o chute por sinônimo para o que ficou vazio. Um
// cabeçalho nunca alimenta dois campos.
export const buildMapping = (headers, preset) => {
  const byNorm = new Map();
  (headers || []).forEach((h) => { const k = normalizeHeader(h); if (k && !byNorm.has(k)) byNorm.set(k, h); });
  const used = new Set();
  const out = {};
  TARGET_FIELDS.forEach((f) => { out[f.id] = null; });
  const assign = (field, header) => {
    if (!header || used.has(header) || out[field]) return;
    out[field] = header;
    used.add(header);
  };
  if (preset) {
    Object.entries(preset.columns).forEach(([field, col]) => assign(field, byNorm.get(normalizeHeader(col))));
  }
  TARGET_FIELDS.forEach((f) => {
    if (out[f.id]) return;
    const hit = (ALIASES[f.id] || []).find((a) => byNorm.has(a) && !used.has(byNorm.get(a)));
    if (hit) assign(f.id, byNorm.get(hit));
  });
  return out;
};

// Rótulo humano da origem, para o campo `source` do lead e o texto da timeline.
export const importSourceLabel = (preset) => preset?.label || 'planilha';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/importPresets.test.js`
Expected: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importPresets.js src/lib/__tests__/importPresets.test.js
git commit -m "feat: presets de importação (NextFit) e mapeamento de colunas

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Normalizadores (telefone, CPF, nome, data, sexo, VIP, situações)

**Files:**
- Create: `src/lib/clientImport.js`
- Test: `src/lib/__tests__/clientImport.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/__tests__/clientImport.test.js` (as próximas tasks acrescentam `describe`s a este mesmo arquivo):

```js
// Regra pura da importação de clientes. Datas sempre em horário LOCAL.

import { describe, it, expect } from 'vitest';
import {
  normalizePhoneDigits,
  isValidCpf,
  normalizeCpfDigits,
  normalizeName,
  parseImportDate,
  normalizeSexo,
  isTruthyCell,
  contractSituationFromText,
  clientSituationFromText,
  CONTRACT_SITUATION
} from '../clientImport.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 9, 3);

describe('normalizePhoneDigits', () => {
  it('tira o 55 do país e fica com DDD + número', () => {
    expect(normalizePhoneDigits('5571999998888')).toBe('71999998888');
    expect(normalizePhoneDigits('+55 (71) 99999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('557133334444')).toBe('7133334444');
  });

  it('aceita máscara, espaço e fixo de 10 dígitos', () => {
    expect(normalizePhoneDigits('(71) 9 9999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('71 3333-4444')).toBe('7133334444');
  });

  it('fora de 10 ou 11 dígitos não casa', () => {
    expect(normalizePhoneDigits('99998888')).toBeNull();
    expect(normalizePhoneDigits('')).toBeNull();
    expect(normalizePhoneDigits(null)).toBeNull();
    expect(normalizePhoneDigits('123456789012345')).toBeNull();
  });
});

describe('isValidCpf / normalizeCpfDigits', () => {
  it('valida pelo dígito verificador', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('12345678909')).toBe(true);
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('rejeita sequência repetida e tamanho errado', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
  });

  it('normaliza com máscara e sinaliza inválido sem barrar', () => {
    expect(normalizeCpfDigits('529.982.247-25')).toEqual({ digits: '52998224725', invalid: false });
    expect(normalizeCpfDigits('000.000.000-00')).toEqual({ digits: null, invalid: true });
    expect(normalizeCpfDigits('')).toEqual({ digits: null, invalid: false });
    expect(normalizeCpfDigits(undefined)).toEqual({ digits: null, invalid: false });
  });
});

describe('normalizeName', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizeName('  João   da SILVA ')).toBe('joao da silva');
    expect(normalizeName(null)).toBe('');
  });
});

describe('parseImportDate', () => {
  it('dd/mm/aaaa, com e sem hora', () => {
    expect(parseImportDate('12/11/2026', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('12/11/2026 00:00:00', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('5/3/1985', NOW)).toEqual(D(1985, 3, 5));
  });

  it('dd/mm/aa com pivô: até ano atual + 10 é 20xx, acima é 19xx', () => {
    expect(parseImportDate('12/11/26', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('01/01/36', NOW)).toEqual(D(2036, 1, 1));
    expect(parseImportDate('05/03/85', NOW)).toEqual(D(1985, 3, 5));
    expect(parseImportDate('01/01/37', NOW)).toEqual(D(1937, 1, 1));
  });

  it('aaaa-mm-dd, com e sem hora', () => {
    expect(parseImportDate('2026-11-12', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('2026-11-12T00:00:00', NOW)).toEqual(D(2026, 11, 12));
  });

  it('serial do Excel e Date do SheetJS viram meia-noite local', () => {
    expect(parseImportDate(46338, NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate(new Date(2026, 10, 12, 15, 30), NOW)).toEqual(D(2026, 11, 12));
  });

  it('vazio, ambíguo ou impossível é null', () => {
    expect(parseImportDate('', NOW)).toBeNull();
    expect(parseImportDate(null, NOW)).toBeNull();
    expect(parseImportDate('novembro', NOW)).toBeNull();
    expect(parseImportDate('31/02/2026', NOW)).toBeNull();
    expect(parseImportDate('12-11-2026', NOW)).toBeNull();
    expect(parseImportDate(0, NOW)).toBeNull();
    expect(parseImportDate(new Date('x'), NOW)).toBeNull();
  });
});

describe('normalizeSexo', () => {
  it('mapeia para os valores do app', () => {
    expect(normalizeSexo('M')).toBe('Masculino');
    expect(normalizeSexo('masculino')).toBe('Masculino');
    expect(normalizeSexo('F')).toBe('Feminino');
    expect(normalizeSexo('FEMININO')).toBe('Feminino');
    expect(normalizeSexo('Outro')).toBe('Outro');
    expect(normalizeSexo('')).toBeNull();
    expect(normalizeSexo('Não informado')).toBe('Não informado');
  });
});

describe('isTruthyCell', () => {
  it('reconhece sim/x/1/true/vip', () => {
    ['Sim', 'S', 'x', 'X', '1', 'true', 'VIP', 'yes'].forEach((v) => expect(isTruthyCell(v)).toBe(true));
    expect(isTruthyCell(1)).toBe(true);
    expect(isTruthyCell(true)).toBe(true);
  });
  it('não/vazio/0 é falso', () => {
    ['Não', 'N', '', '0', 'false'].forEach((v) => expect(isTruthyCell(v)).toBe(false));
    expect(isTruthyCell(0)).toBe(false);
    expect(isTruthyCell(undefined)).toBe(false);
  });
});

describe('contractSituationFromText', () => {
  it('mapeia os textos usuais', () => {
    expect(contractSituationFromText('Ativo')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('ATIVO')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('Vencido')).toBe(CONTRACT_SITUATION.VENCIDO);
    expect(contractSituationFromText('Inativo')).toBe(CONTRACT_SITUATION.VENCIDO);
    expect(contractSituationFromText('A vencer')).toBe(CONTRACT_SITUATION.A_VENCER);
    expect(contractSituationFromText('Cancelado')).toBe(CONTRACT_SITUATION.CANCELADO);
    expect(contractSituationFromText('Trancado')).toBe(CONTRACT_SITUATION.TRANCADO);
  });
  it('vazio é null e texto estranho é desconhecido', () => {
    expect(contractSituationFromText('')).toBeNull();
    expect(contractSituationFromText(undefined)).toBeNull();
    expect(contractSituationFromText('Xyz')).toBe(CONTRACT_SITUATION.DESCONHECIDO);
  });
});

describe('clientSituationFromText', () => {
  it('ativo / inativo / null', () => {
    expect(clientSituationFromText('Ativo')).toBe('ativo');
    expect(clientSituationFromText('Inativo')).toBe('inativo');
    expect(clientSituationFromText('Bloqueado')).toBe('inativo');
    expect(clientSituationFromText('')).toBeNull();
    expect(clientSituationFromText('Xyz')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: FAIL (módulo `../clientImport.js` não existe).

- [ ] **Step 3: Implementar os normalizadores**

Create `src/lib/clientImport.js`:

```js
// Regra pura da IMPORTAÇÃO DE CLIENTES de outros sistemas (NextFit, Pacto,
// Evo, SCA, Tecnofit): normalizadores, linha → candidato, dedupe no arquivo,
// escopo, casamento com a base, classificação e o construtor das escritas.
// Sem React e sem Firestore: o COMO gravar fica em clientImportWrites.js
// (padrão contracts.js / contractsWrites.js).
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md

import { normalize, onlyDigits } from './globalSearch.js';
import { addMonths, daysBetween, getSafeDateOrNull } from './dates.js';
import { formatCPF, formatPhone } from './masks.js';
import { parseValorBRL } from './format.js';
import { buildLeadSearchFields, deriveLeadBucket } from './leadDerived.js';
import { isClientLead } from './leads.js';
import { CONTRACT_STATUS, deriveContractStatus } from './contracts.js';

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

// Telefone como o app grava: DDD + número, 10 ou 11 dígitos, sem o 55 do país
// (formatPhone, em masks.js, corta em 11; exportação com 5571... nunca
// casaria). Fora disso devolve null: a linha guarda o bruto e não casa.
export const normalizePhoneDigits = (raw) => {
  let d = onlyDigits(raw);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
};

// Dígito verificador do CPF. Sequência de um só algarismo é inválida (é o que
// sistema antigo grava quando ninguém informou, e amarraria dez pessoas numa).
export const isValidCpf = (digits) => {
  const d = String(digits || '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
};

// { digits, invalid }: digits só quando válido; invalid marca CPF preenchido
// mas errado (vira aviso na linha, sem barrar).
export const normalizeCpfDigits = (raw) => {
  const d = onlyDigits(raw);
  if (!d) return { digits: null, invalid: false };
  return isValidCpf(d) ? { digits: d, invalid: false } : { digits: null, invalid: true };
};

// Igual ao nameLower que buildLeadSearchFields grava, com espaços colapsados.
export const normalizeName = (raw) => normalize(String(raw ?? '').replace(/\s+/g, ' ').trim());

const localDate = (y, m, d) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};

// Data de célula → meia-noite LOCAL (igual ao fromDateInputValue do modal de
// matrícula). Aceita Date (SheetJS com cellDates), serial do Excel (número),
// 'dd/mm/aaaa', 'dd/mm/aa' e 'aaaa-mm-dd', com ou sem hora atrás. Ano de dois
// dígitos: até (ano atual + 10) é 20xx, acima é 19xx: contrato vence daqui a
// poucos anos, nascimento é décadas atrás.
export const parseImportDate = (raw, now = new Date()) => {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // 25569 = dias entre 30/12/1899 (época do Excel) e 01/01/1970.
    const utc = new Date(Math.round((raw - 25569) * 86400000));
    return localDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\D.*)?$/);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += y <= (now.getFullYear() % 100) + 10 ? 2000 : 1900;
    return localDate(y, Number(m[2]), Number(m[1]));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\D.*)?$/);
  if (m) return localDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
};

// Valores que o select de sexo do app conhece (AddLeadModal /
// ClientRegistrationModal). Texto desconhecido passa como veio.
export const normalizeSexo = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (s === 'm' || s.startsWith('masc')) return 'Masculino';
  if (s === 'f' || s.startsWith('fem')) return 'Feminino';
  if (s === 'o' || s.startsWith('outro')) return 'Outro';
  return String(raw).trim();
};

export const isTruthyCell = (raw) => {
  if (raw === true) return true;
  if (typeof raw === 'number') return raw > 0;
  return /^(sim|s|x|true|1|vip|yes|y)$/i.test(String(raw ?? '').trim());
};

export const CONTRACT_SITUATION = {
  ATIVO: 'ativo',
  A_VENCER: 'a_vencer',
  VENCIDO: 'vencido',
  CANCELADO: 'cancelado',
  TRANCADO: 'trancado',
  DESCONHECIDO: 'desconhecido'
};

// Texto livre da coluna "Situação do contrato" → slug. A ordem importa:
// "a vencer" contém "vencer" e "inativo" contém "ativ".
export const contractSituationFromText = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (/cancel/.test(s)) return CONTRACT_SITUATION.CANCELADO;
  if (/tranc|pausa|suspens|congel/.test(s)) return CONTRACT_SITUATION.TRANCADO;
  if (/a vencer|vencendo|renov/.test(s)) return CONTRACT_SITUATION.A_VENCER;
  if (/venc|expir|inativ|encerr|finaliz/.test(s)) return CONTRACT_SITUATION.VENCIDO;
  if (/ativ|vigente|em dia|normal|regular/.test(s)) return CONTRACT_SITUATION.ATIVO;
  return CONTRACT_SITUATION.DESCONHECIDO;
};

// "Situação do cliente" → 'ativo' | 'inativo' | null (desconhecido conta como
// não-inativo no escopo).
export const clientSituationFromText = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (/inativ|cancel|bloque|desativ/.test(s)) return 'inativo';
  if (/ativ/.test(s)) return 'ativo';
  return null;
};

const fmtDia = (d) => {
  const x = getSafeDateOrNull(d);
  return x ? x.toLocaleDateString('pt-BR') : '';
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const earliest = (...dates) => {
  const list = dates.map(getSafeDateOrNull).filter(Boolean);
  if (!list.length) return null;
  return list.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
};

// Mantém os imports usados pelas próximas tasks referenciados desde já (o
// lint acusa import sem uso). Cada task abaixo substitui o uso de verdade.
export const __IMPORT_INTERNALS = { addMonths, daysBetween, formatCPF, formatPhone, parseValorBRL, buildLeadSearchFields, deriveLeadBucket, isClientLead, CONTRACT_STATUS, deriveContractStatus, fmtDia, sameDay, earliest };
```

A linha `__IMPORT_INTERNALS` existe só para o lint passar entre uma task e outra; a Task 7 a remove.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: PASS, 18 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: normalizadores da importação de clientes (telefone, CPF, datas, situações)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Linha → candidato, validação e dedupe dentro do arquivo

**Files:**
- Modify: `src/lib/clientImport.js`
- Test: `src/lib/__tests__/clientImport.test.js`

- [ ] **Step 1: Acrescentar os testes que falham**

Append em `src/lib/__tests__/clientImport.test.js` (e acrescente `parseRow, isCandidateValid, dedupeInFile, distinctPlanNames` ao `import` do topo):

```js
const NEXTFIT_MAPPING = {
  name: 'Nome', email: 'E-mail', planName: 'Contrato', whatsapp: 'Telefone',
  contractSituation: 'Situação do contrato', clientSituation: 'Situação do cliente',
  cpf: 'CPF', rg: 'RG', birthDate: 'Data de nascimento', registeredAt: 'Data de cadastro',
  dor: 'Objetivo', sexo: 'Sexo', vip: 'VIP', addrStreet: 'Endereco', addrNumber: 'Número',
  addrNeighborhood: 'Bairro', addrCep: 'Cep', addrCity: 'Cidade', addrComplement: 'Complemento',
  consultantName: 'Consultor', professorName: 'Professor',
  contractStartsAt: null, contractEndsAt: null, contractValue: null
};

const nextfitRow = (over = {}) => ({
  __row: 2,
  'Nome': ' Ana  Teste ', 'E-mail': 'ana@example.com', 'Contrato': 'Trimestral', 'Telefone': '(71) 99999-0001',
  'Situação do contrato': 'Ativo', 'Situação do cliente': 'Ativo', 'CPF': '529.982.247-25', 'RG': '123',
  'Data de nascimento': '05/03/1985', 'Data de cadastro': '10/01/2026', 'Objetivo': 'Emagrecer', 'Sexo': 'F',
  'VIP': 'Não', 'Endereco': 'Rua A', 'Número': '10', 'Bairro': 'Centro', 'Cep': '40000-000', 'Cidade': 'Salvador',
  'Complemento': '', 'Consultor': 'Bia', 'Professor': 'Carlos',
  ...over
});

describe('parseRow', () => {
  it('monta o candidato a partir do mapeamento', () => {
    const c = parseRow(nextfitRow(), NEXTFIT_MAPPING, 2, NOW);
    expect(c.rowNumber).toBe(2);
    expect(c.name).toBe('Ana Teste');
    expect(c.nameLower).toBe('ana teste');
    expect(c.email).toBe('ana@example.com');
    expect(c.whatsappRaw).toBe('(71) 99999-0001');
    expect(c.whatsappDigits).toBe('71999990001');
    expect(c.cpfDigits).toBe('52998224725');
    expect(c.cpfInvalid).toBe(false);
    expect(c.rg).toBe('123');
    expect(c.birthDate).toEqual(D(1985, 3, 5));
    expect(c.registeredAt).toEqual(D(2026, 1, 10));
    expect(c.sexo).toBe('Feminino');
    expect(c.dor).toBe('Emagrecer');
    expect(c.vip).toBe(false);
    expect(c.address).toEqual({ cep: '40000-000', street: 'Rua A', number: '10', complement: '', neighborhood: 'Centro', city: 'Salvador', state: '' });
    expect(c.consultantName).toBe('Bia');
    expect(c.professorName).toBe('Carlos');
    expect(c.planName).toBe('Trimestral');
    expect(c.contractSituation).toBe('ativo');
    expect(c.clientSituation).toBe('ativo');
    expect(c.startsAt).toBeNull();
    expect(c.endsAt).toBeNull();
    expect(c.value).toBeNull();
    expect(c.warnings).toEqual([]);
  });

  it('campo sem coluna mapeada fica nulo; endereço todo vazio é null', () => {
    const c = parseRow({ __row: 5, 'Nome': 'Bruno', 'CPF': '111.444.777-35' }, { ...NEXTFIT_MAPPING, addrStreet: null, addrNumber: null, addrNeighborhood: null, addrCep: null, addrCity: null, addrComplement: null }, 5, NOW);
    expect(c.email).toBeNull();
    expect(c.whatsappDigits).toBeNull();
    expect(c.address).toBeNull();
    expect(c.contractSituation).toBeNull();
    expect(c.clientSituation).toBeNull();
  });

  it('CPF inválido vira aviso e não trava; data de fim ilegível vira aviso', () => {
    const c = parseRow(nextfitRow({ 'CPF': '000.000.000-00', 'Fim': 'amanhã' }), { ...NEXTFIT_MAPPING, contractEndsAt: 'Fim' }, 2, NOW);
    expect(c.cpfDigits).toBeNull();
    expect(c.cpfInvalid).toBe(true);
    expect(c.endsAt).toBeNull();
    expect(c.warnings).toEqual(['CPF inválido', 'Data de fim ilegível']);
  });

  it('lê datas e valor do contrato quando mapeados', () => {
    const c = parseRow(
      { __row: 3, 'Nome': 'Ana', 'CPF': '529.982.247-25', 'Início': '12/08/2026', 'Fim': '12/11/2026', 'Valor': 'R$ 450,00' },
      { ...NEXTFIT_MAPPING, contractStartsAt: 'Início', contractEndsAt: 'Fim', contractValue: 'Valor' }, 3, NOW
    );
    expect(c.startsAt).toEqual(D(2026, 8, 12));
    expect(c.endsAt).toEqual(D(2026, 11, 12));
    expect(c.value).toBe(450);
  });
});

describe('isCandidateValid', () => {
  it('precisa de nome e de CPF válido ou telefone válido', () => {
    expect(isCandidateValid({ name: 'Ana', cpfDigits: '52998224725', whatsappDigits: null })).toBe(true);
    expect(isCandidateValid({ name: 'Ana', cpfDigits: null, whatsappDigits: '71999990001' })).toBe(true);
    expect(isCandidateValid({ name: 'Ana', cpfDigits: null, whatsappDigits: null })).toBe(false);
    expect(isCandidateValid({ name: 'A', cpfDigits: '52998224725', whatsappDigits: null })).toBe(false);
    expect(isCandidateValid({ name: '', cpfDigits: '52998224725', whatsappDigits: '71999990001' })).toBe(false);
  });
});

describe('dedupeInFile', () => {
  const base = { name: 'Ana', cpfDigits: '52998224725', whatsappDigits: '71999990001', endsAt: null };
  it('mesmo CPF: fica a de fim mais recente, a outra recebe duplicateOf', () => {
    const { kept, duplicates } = dedupeInFile([
      { ...base, rowNumber: 2, endsAt: D(2026, 10, 1) },
      { ...base, rowNumber: 3, endsAt: D(2026, 11, 12) },
      { ...base, rowNumber: 4, endsAt: null }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([3]);
    expect(duplicates.map((c) => [c.rowNumber, c.duplicateOf])).toEqual([[2, 3], [4, 3]]);
  });

  it('sem CPF casa pelo telefone; sem os dois nunca é duplicata', () => {
    const { kept, duplicates } = dedupeInFile([
      { name: 'Bruno', rowNumber: 2, cpfDigits: null, whatsappDigits: '71999990002', endsAt: null },
      { name: 'Bruno', rowNumber: 3, cpfDigits: null, whatsappDigits: '71999990002', endsAt: null },
      { name: 'Sem nada', rowNumber: 4, cpfDigits: null, whatsappDigits: null, endsAt: null },
      { name: 'Sem nada', rowNumber: 5, cpfDigits: null, whatsappDigits: null, endsAt: null }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([2, 4, 5]);
    expect(duplicates.map((c) => c.rowNumber)).toEqual([3]);
  });

  it('empate de fim fica com a primeira linha', () => {
    const { kept } = dedupeInFile([
      { ...base, rowNumber: 2, endsAt: D(2026, 11, 12) },
      { ...base, rowNumber: 3, endsAt: D(2026, 11, 12) }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([2]);
  });
});

describe('distinctPlanNames', () => {
  it('agrupa por nome normalizado com contagem, na ordem de frequência', () => {
    const out = distinctPlanNames([
      { planName: 'Trimestral' }, { planName: 'TRIMESTRAL ' }, { planName: 'Mensal' }, { planName: null }, { planName: '' }
    ]);
    expect(out).toEqual([{ key: 'trimestral', label: 'Trimestral', count: 2 }, { key: 'mensal', label: 'Mensal', count: 1 }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: FAIL (`parseRow is not a function` e afins).

- [ ] **Step 3: Implementar**

Append em `src/lib/clientImport.js`, antes da linha `export const __IMPORT_INTERNALS`:

```js
// ---------------------------------------------------------------------------
// Linha → candidato
// ---------------------------------------------------------------------------

const cell = (row, mapping, field) => {
  const header = mapping?.[field];
  return header ? row?.[header] : undefined;
};
const str = (v) => (v == null ? '' : String(v).trim());
const nullify = (v) => (str(v) ? str(v) : null);

export const parseRow = (row, mapping, rowNumber, now = new Date()) => {
  const get = (field) => cell(row, mapping, field);
  const name = str(get('name')).replace(/\s+/g, ' ');
  const cpf = normalizeCpfDigits(get('cpf'));
  const whatsappRaw = str(get('whatsapp'));
  const address = {
    cep: str(get('addrCep')), street: str(get('addrStreet')), number: str(get('addrNumber')),
    complement: str(get('addrComplement')), neighborhood: str(get('addrNeighborhood')),
    city: str(get('addrCity')), state: ''
  };
  const hasAddress = Object.values(address).some(Boolean);
  const warnings = [];
  if (cpf.invalid) warnings.push('CPF inválido');
  const endsRaw = get('contractEndsAt');
  const endsAt = parseImportDate(endsRaw, now);
  if (str(endsRaw) && !endsAt) warnings.push('Data de fim ilegível');
  const value = parseValorBRL(get('contractValue'));
  return {
    rowNumber,
    name,
    nameLower: normalizeName(name),
    email: nullify(get('email')),
    whatsappRaw,
    whatsappDigits: normalizePhoneDigits(whatsappRaw),
    cpfDigits: cpf.digits,
    cpfInvalid: cpf.invalid,
    rg: nullify(get('rg')),
    birthDate: parseImportDate(get('birthDate'), now),
    registeredAt: parseImportDate(get('registeredAt'), now),
    sexo: normalizeSexo(get('sexo')),
    dor: nullify(get('dor')),
    vip: isTruthyCell(get('vip')),
    address: hasAddress ? address : null,
    consultantName: nullify(get('consultantName')),
    professorName: nullify(get('professorName')),
    planName: nullify(get('planName')),
    contractSituation: contractSituationFromText(get('contractSituation')),
    clientSituation: clientSituationFromText(get('clientSituation')),
    startsAt: parseImportDate(get('contractStartsAt'), now),
    endsAt,
    value: Number.isFinite(value) ? value : null,
    warnings
  };
};

// Sem nome, ou sem CPF válido e sem telefone válido, a linha não casa nem nasce.
export const isCandidateValid = (c) =>
  String(c?.name || '').length > 1 && Boolean(c?.cpfDigits || c?.whatsappDigits);

// Duplicata dentro do arquivo: mesmo CPF (ou, sem CPF, mesmo telefone) vira
// uma só antes de qualquer consulta. Fica a de fim mais recente (null perde;
// empate fica com a primeira). As outras saem com `duplicateOf` = linha que
// ficou, para o relatório.
export const dedupeInFile = (candidates) => {
  const keyOf = (c) => (c.cpfDigits ? `cpf:${c.cpfDigits}` : c.whatsappDigits ? `tel:${c.whatsappDigits}` : null);
  const groups = new Map();
  const kept = [];
  const duplicates = [];
  (candidates || []).forEach((c) => {
    const key = keyOf(c);
    if (!key) { kept.push(c); return; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  groups.forEach((list) => {
    const winner = list.reduce((best, c) => {
      const a = best.endsAt ? best.endsAt.getTime() : -Infinity;
      const b = c.endsAt ? c.endsAt.getTime() : -Infinity;
      return b > a ? c : best;
    });
    kept.push(winner);
    list.forEach((c) => { if (c !== winner) duplicates.push({ ...c, duplicateOf: winner.rowNumber }); });
  });
  kept.sort((a, b) => a.rowNumber - b.rowNumber);
  duplicates.sort((a, b) => a.rowNumber - b.rowNumber);
  return { kept, duplicates };
};

// Nomes de plano distintos da planilha, para a tabela de mapeamento de planos.
export const distinctPlanNames = (candidates) => {
  const map = new Map();
  (candidates || []).forEach((c) => {
    const key = normalizeName(c.planName);
    if (!key) return;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else map.set(key, { key, label: str(c.planName), count: 1 });
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: PASS, 27 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: parse de linha, validação e dedupe no arquivo da importação

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Enriquecimento (consultor, professor, plano), escopo e casamento com a base

**Files:**
- Modify: `src/lib/clientImport.js`
- Test: `src/lib/__tests__/clientImport.test.js`

- [ ] **Step 1: Acrescentar os testes que falham**

Append em `src/lib/__tests__/clientImport.test.js` (acrescente `enrichCandidate, isInScope, resolveMatch, SCOPE` ao `import` do topo):

```js
const USERS = [{ id: 'u1', name: 'Bia Souza', authUid: 'a1' }, { id: 'u2', name: 'Caio', authUid: 'a2' }];
const PROFS = [{ id: 'p1', name: 'Carlos Lima' }];
const PLANOS = [
  { id: 'pl1', name: 'Trimestral', durationMonths: 3, value: 450 },
  { id: 'pl2', name: 'Mensal', durationMonths: 1, value: 150 }
];

describe('enrichCandidate', () => {
  it('casa consultor, professor e plano por nome normalizado', () => {
    const c = enrichCandidate({ consultantName: 'bia souza', professorName: 'CARLOS LIMA', planName: 'trimestral' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: {} });
    expect(c.consultant).toBe(USERS[0]);
    expect(c.professorId).toBe('p1');
    expect(c.professorName).toBe('Carlos Lima');
    expect(c.plan).toBe(PLANOS[0]);
  });

  it('sem correspondência: consultor null, professorId null (mantém o texto), plano null', () => {
    const c = enrichCandidate({ consultantName: 'Zé', professorName: 'Ninguém', planName: 'Plano Ouro' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: {} });
    expect(c.consultant).toBeNull();
    expect(c.professorId).toBeNull();
    expect(c.professorName).toBe('Ninguém');
    expect(c.plan).toBeNull();
  });

  it('o mapeamento manual de plano vence o nome; __text__ força texto', () => {
    const byMap = enrichCandidate({ planName: 'Plano Ouro' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: { 'plano ouro': 'pl2' } });
    expect(byMap.plan).toBe(PLANOS[1]);
    const forcedText = enrichCandidate({ planName: 'Trimestral' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: { trimestral: '__text__' } });
    expect(forcedText.plan).toBeNull();
  });
});

describe('isInScope', () => {
  const W = 15;
  const c = (over) => ({ contractSituation: 'ativo', clientSituation: 'ativo', startsAt: null, endsAt: null, ...over });

  it('com data de fim o relógio decide: vigente entra, vencido só dentro da janela', () => {
    expect(isInScope(c({ endsAt: D(2026, 11, 12) }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 25), contractSituation: 'vencido' }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 19) }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 18) }), SCOPE.PADRAO, NOW, W)).toBe(false);
    expect(isInScope(c({ endsAt: D(2026, 7, 1), contractSituation: 'ativo' }), SCOPE.PADRAO, NOW, W)).toBe(false);
  });

  it('cancelado fica fora; trancado entra mesmo com fim no passado', () => {
    expect(isInScope(c({ endsAt: D(2027, 1, 1), contractSituation: 'cancelado' }), SCOPE.PADRAO, NOW, W)).toBe(false);
    expect(isInScope(c({ endsAt: D(2026, 1, 1), contractSituation: 'trancado' }), SCOPE.PADRAO, NOW, W)).toBe(true);
  });

  it('sem data de fim manda a situação do cliente', () => {
    expect(isInScope(c({ clientSituation: 'ativo' }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ clientSituation: null }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ clientSituation: 'inativo' }), SCOPE.PADRAO, NOW, W)).toBe(false);
  });

  it('escopo "todos" aceita tudo', () => {
    expect(isInScope(c({ endsAt: D(2020, 1, 1) }), SCOPE.TODOS, NOW, W)).toBe(true);
    expect(isInScope(c({ contractSituation: 'cancelado' }), SCOPE.TODOS, NOW, W)).toBe(true);
    expect(isInScope(c({ clientSituation: 'inativo' }), SCOPE.TODOS, NOW, W)).toBe(true);
  });
});

describe('resolveMatch', () => {
  const ana = { id: 'L1', name: 'Ana', cpfDigits: '52998224725', whatsappDigits: '71999990001' };
  const bruno = { id: 'L2', name: 'Bruno', cpfDigits: '', whatsappDigits: '71999990002' };
  const homonimo = { id: 'L3', name: 'Ana', cpfDigits: '', whatsappDigits: '' };
  const index = { byCpf: new Map([['52998224725', ana]]), byPhone: new Map([['71999990002', bruno]]), byName: new Map([['ana', [homonimo]]]) };

  it('CPF antes de telefone, telefone antes de nome', () => {
    expect(resolveMatch({ cpfDigits: '52998224725', whatsappDigits: '71999990002', nameLower: 'ana' }, index)).toEqual({ kind: 'cpf', lead: ana, homonyms: [] });
    expect(resolveMatch({ cpfDigits: null, whatsappDigits: '71999990002', nameLower: 'ana' }, index)).toEqual({ kind: 'phone', lead: bruno, homonyms: [] });
    expect(resolveMatch({ cpfDigits: '11144477735', whatsappDigits: '71999990009', nameLower: 'ana' }, index)).toEqual({ kind: 'name', lead: null, homonyms: [homonimo] });
    expect(resolveMatch({ cpfDigits: null, whatsappDigits: null, nameLower: 'ninguem' }, index)).toEqual({ kind: 'none', lead: null, homonyms: [] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: FAIL (`enrichCandidate is not a function` e afins).

- [ ] **Step 3: Implementar**

Append em `src/lib/clientImport.js`, antes da linha `export const __IMPORT_INTERNALS`:

```js
// ---------------------------------------------------------------------------
// Enriquecimento: consultor, professor e plano por nome normalizado
// ---------------------------------------------------------------------------

const findByName = (list, name) => {
  const key = normalizeName(name);
  if (!key) return null;
  return (list || []).find((x) => normalizeName(x?.name) === key) || null;
};

// Valor especial do mapeamento de planos: "manter como texto" (não casa com o
// catálogo mesmo que o nome bata).
export const PLAN_AS_TEXT = '__text__';

export const enrichCandidate = (c, { usersList, professores, planos, planMap } = {}) => {
  const consultant = findByName(usersList, c.consultantName);
  const professor = findByName(professores, c.professorName);
  const planKey = normalizeName(c.planName);
  let plan = null;
  if (planKey) {
    const mapped = planMap?.[planKey];
    if (mapped === PLAN_AS_TEXT) plan = null;
    else if (mapped) plan = (planos || []).find((p) => p.id === mapped) || null;
    else plan = (planos || []).find((p) => normalizeName(p.name) === planKey) || null;
  }
  return {
    ...c,
    consultant,
    professorId: professor?.id || null,
    professorName: professor ? professor.name : c.professorName,
    plan
  };
};

// ---------------------------------------------------------------------------
// Escopo
// ---------------------------------------------------------------------------

export const SCOPE = { PADRAO: 'padrao', TODOS: 'todos' };

// Padrão = ativos e vencidos recentes. Com data de fim, o relógio decide (é a
// mesma deriveContractStatus do app): vigente entra, vencido só se venceu há
// no máximo `windowDays` (janela de Vencidos da academia). Trancado entra
// sempre, cancelado nunca. Sem data de fim, manda a situação do cliente
// (desconhecida conta como ativa).
export const isInScope = (c, scope, now, windowDays) => {
  if (scope === SCOPE.TODOS) return true;
  if (c.contractSituation === CONTRACT_SITUATION.CANCELADO) return false;
  if (c.contractSituation === CONTRACT_SITUATION.TRANCADO) return true;
  const endsAt = getSafeDateOrNull(c.endsAt);
  if (!endsAt) return c.clientSituation !== 'inativo';
  const derived = deriveContractStatus({ status: CONTRACT_STATUS.ATIVO, startsAt: c.startsAt, endsAt }, now);
  if (derived !== CONTRACT_STATUS.VENCIDO) return true;
  return daysBetween(endsAt, now) <= Number(windowDays);
};

// ---------------------------------------------------------------------------
// Casamento com a base
// ---------------------------------------------------------------------------

// `index` vem de lookupExisting (clientImportWrites.js): três Maps, chaveados
// por cpfDigits, whatsappDigits e nameLower (este com lista de homônimos).
export const resolveMatch = (c, index) => {
  const byCpf = c.cpfDigits ? index?.byCpf?.get(c.cpfDigits) : null;
  if (byCpf) return { kind: 'cpf', lead: byCpf, homonyms: [] };
  const byPhone = c.whatsappDigits ? index?.byPhone?.get(c.whatsappDigits) : null;
  if (byPhone) return { kind: 'phone', lead: byPhone, homonyms: [] };
  const homonyms = c.nameLower ? (index?.byName?.get(c.nameLower) || []) : [];
  if (homonyms.length) return { kind: 'name', lead: null, homonyms };
  return { kind: 'none', lead: null, homonyms: [] };
};
```

Nota sobre a janela: `daysBetween(endsAt, now)` arredonda para o dia inteiro. Com `NOW` = 03/09 e janela 15, fim em 19/08 dá 15 (entra) e 18/08 dá 16 (sai), como os testes afirmam.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: PASS, 35 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: enriquecimento, escopo e casamento com a base na importação

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Preenchimento de vazios e classificação da linha

**Files:**
- Modify: `src/lib/clientImport.js`
- Test: `src/lib/__tests__/clientImport.test.js`

- [ ] **Step 1: Acrescentar os testes que falham**

Append em `src/lib/__tests__/clientImport.test.js` (acrescente `buildFillPatch, classifyCandidate, OUTCOME` ao `import` do topo):

```js
const VALID = { name: 'Ana Teste', nameLower: 'ana teste', cpfDigits: '52998224725', whatsappDigits: '71999990001', email: 'ana@example.com', rg: null, birthDate: null, sexo: null, dor: null, vip: false, address: null, professorId: null, professorName: null, contractSituation: 'ativo', clientSituation: 'ativo', startsAt: null, endsAt: null, warnings: [] };
const OPTS = { decision: undefined, scope: SCOPE.PADRAO, now: NOW, windowDays: 15 };
const NONE = { kind: 'none', lead: null, homonyms: [] };

describe('buildFillPatch', () => {
  it('preenche só o que está vazio e recomputa os campos de busca quando toca telefone ou CPF', () => {
    const lead = { name: 'Ana', whatsapp: '', email: 'ja@tem.com', cpf: null, tags: [] };
    const patch = buildFillPatch({ ...VALID, vip: true, rg: '12', sexo: 'Feminino', dor: 'Emagrecer', address: { street: 'Rua A' }, professorId: 'p1', professorName: 'Carlos' }, lead);
    expect(patch.whatsapp).toBe('(71) 9 9999-0001');
    expect(patch.email).toBeUndefined();
    expect(patch.cpf).toBe('529.982.247-25');
    expect(patch.rg).toBe('12');
    expect(patch.sexo).toBe('Feminino');
    expect(patch.dor).toBe('Emagrecer');
    expect(patch.address).toEqual({ street: 'Rua A' });
    expect(patch.professorId).toBe('p1');
    expect(patch.professorName).toBe('Carlos');
    expect(patch.tags).toEqual(['VIP']);
    expect(patch.whatsappDigits).toBe('71999990001');
    expect(patch.cpfDigits).toBe('52998224725');
    expect(patch.nameLower).toBe('ana');
  });

  it('nada vazio, nada no patch; VIP já presente não repete', () => {
    const lead = { name: 'Ana', whatsapp: '(71) 9 9999-0001', email: 'x@y.com', cpf: '529.982.247-25', rg: '1', birthDate: D(1985, 3, 5), sexo: 'Feminino', dor: 'x', address: { street: 'r' }, professorId: 'p9', tags: ['VIP'] };
    expect(buildFillPatch({ ...VALID, vip: true, rg: '2', professorId: 'p1' }, lead)).toEqual({});
  });
});

describe('classifyCandidate', () => {
  it('duplicada no arquivo, inválida e fora do escopo, nessa ordem', () => {
    expect(classifyCandidate({ ...VALID, duplicateOf: 2 }, NONE, OPTS).outcome).toBe(OUTCOME.DUPLICADA);
    expect(classifyCandidate({ ...VALID, cpfDigits: null, whatsappDigits: null }, NONE, OPTS).outcome).toBe(OUTCOME.INVALIDA);
    expect(classifyCandidate({ ...VALID, name: '' }, NONE, OPTS).reason).toBe('Sem nome');
    expect(classifyCandidate({ ...VALID, clientSituation: 'inativo' }, NONE, OPTS).outcome).toBe(OUTCOME.FORA_DO_ESCOPO);
  });

  it('sem casamento cria; com fim cria com contrato', () => {
    const semFim = classifyCandidate(VALID, NONE, OPTS);
    expect(semFim.outcome).toBe(OUTCOME.CRIAR);
    expect(semFim.createContract).toBe(false);
    const comFim = classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, NONE, OPTS);
    expect(comFim.createContract).toBe(true);
  });

  it('suspeita por nome espera decisão; "create" cria; id de homônimo usa o existente', () => {
    const homonimo = { id: 'L3', name: 'Ana Teste', status: 'Novo', cpfDigits: '', whatsappDigits: '' };
    const match = { kind: 'name', lead: null, homonyms: [homonimo] };
    expect(classifyCandidate(VALID, match, OPTS).outcome).toBe(OUTCOME.SUSPEITA);
    expect(classifyCandidate(VALID, match, { ...OPTS, decision: 'create' }).outcome).toBe(OUTCOME.CRIAR);
    const usa = classifyCandidate(VALID, match, { ...OPTS, decision: 'L3' });
    expect(usa.outcome).toBe(OUTCOME.PROMOVER);
    expect(usa.lead).toBe(homonimo);
  });

  it('casado por telefone com CPF diferente é conflito', () => {
    const lead = { id: 'L2', name: 'Bruno', cpfDigits: '11144477735', whatsappDigits: '71999990001', status: 'Novo' };
    const r = classifyCandidate(VALID, { kind: 'phone', lead, homonyms: [] }, OPTS);
    expect(r.outcome).toBe(OUTCOME.CONFLITO);
    expect(r.reason).toMatch(/CPF diferente/);
  });

  it('já tem contrato com fim diferente é conflito; com o mesmo dia não é', () => {
    const cliente = { id: 'L1', name: 'Ana', lifecycleStage: 'cliente', status: 'Venda', isConverted: true, currentContractId: 'C1', currentContractEndsAt: D(2026, 10, 1), cpfDigits: '52998224725' };
    const m = { kind: 'cpf', lead: cliente, homonyms: [] };
    expect(classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, m, OPTS).outcome).toBe(OUTCOME.CONFLITO);
    const mesmo = classifyCandidate({ ...VALID, endsAt: new Date(2026, 9, 1, 15, 0) }, m, OPTS);
    expect(mesmo.outcome).not.toBe(OUTCOME.CONFLITO);
    expect(mesmo.createContract).toBe(false);
  });

  it('lead em prospecção ou em perda vira promover (com ou sem contrato)', () => {
    const lead = { id: 'L1', name: 'Ana', status: 'Negociando', cpfDigits: '52998224725', email: 'ana@example.com' };
    const semFim = classifyCandidate(VALID, { kind: 'cpf', lead, homonyms: [] }, OPTS);
    expect(semFim.outcome).toBe(OUTCOME.PROMOVER);
    expect(semFim.createContract).toBe(false);
    const perda = classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, { kind: 'cpf', lead: { ...lead, status: 'Perda' }, homonyms: [] }, OPTS);
    expect(perda.outcome).toBe(OUTCOME.PROMOVER);
    expect(perda.createContract).toBe(true);
  });

  it('cliente sem contrato + fim = registrar contrato; cliente completo = atualizar ou sem alteração', () => {
    const cliente = { id: 'L1', name: 'Ana', lifecycleStage: 'cliente', status: 'Venda', isConverted: true, cpfDigits: '52998224725', email: null, whatsapp: '(71) 9 9999-0001', cpf: '529.982.247-25' };
    const m = { kind: 'cpf', lead: cliente, homonyms: [] };
    expect(classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, m, OPTS).outcome).toBe(OUTCOME.REGISTRAR_CONTRATO);
    const atualiza = classifyCandidate(VALID, m, OPTS);
    expect(atualiza.outcome).toBe(OUTCOME.ATUALIZAR);
    expect(atualiza.fill).toEqual({ email: 'ana@example.com' });
    const completo = { ...cliente, email: 'ana@example.com', currentContractId: 'C1', currentContractEndsAt: D(2026, 11, 12) };
    expect(classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, { kind: 'cpf', lead: completo, homonyms: [] }, OPTS).outcome).toBe(OUTCOME.SEM_ALTERACAO);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: FAIL (`buildFillPatch is not a function` e afins).

- [ ] **Step 3: Implementar**

Append em `src/lib/clientImport.js`, antes da linha `export const __IMPORT_INTERNALS`:

```js
// ---------------------------------------------------------------------------
// Promover o existente: a planilha só preenche o que está vazio
// ---------------------------------------------------------------------------

const blank = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// Nome e consultor dono NUNCA entram aqui (decisão do spec). Telefone e CPF
// entram só se vazios, e quando entram os campos de busca são recomputados
// com o que vai ficar gravado (dual-write, como o cadastro faz).
export const buildFillPatch = (c, lead) => {
  const patch = {};
  if (blank(lead.whatsapp) && c.whatsappDigits) patch.whatsapp = formatPhone(c.whatsappDigits);
  if (blank(lead.email) && c.email) patch.email = c.email;
  if (blank(lead.cpf) && c.cpfDigits) patch.cpf = formatCPF(c.cpfDigits);
  if (blank(lead.rg) && c.rg) patch.rg = c.rg;
  if (blank(lead.birthDate) && c.birthDate) patch.birthDate = c.birthDate;
  if (blank(lead.sexo) && c.sexo) patch.sexo = c.sexo;
  if (blank(lead.dor) && c.dor) patch.dor = c.dor;
  if (blank(lead.address) && c.address) patch.address = c.address;
  if (blank(lead.professorId) && c.professorId) {
    patch.professorId = c.professorId;
    patch.professorName = c.professorName;
  }
  if (c.vip && !(lead.tags || []).includes('VIP')) patch.tags = [...(lead.tags || []), 'VIP'];
  if (patch.whatsapp || patch.cpf) {
    Object.assign(patch, buildLeadSearchFields({
      name: lead.name,
      whatsapp: patch.whatsapp || lead.whatsapp,
      cpf: patch.cpf || lead.cpf
    }));
  }
  return patch;
};

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

export const OUTCOME = {
  CRIAR: 'criar',
  PROMOVER: 'promover',
  REGISTRAR_CONTRATO: 'registrar_contrato',
  ATUALIZAR: 'atualizar',
  SEM_ALTERACAO: 'sem_alteracao',
  CONFLITO: 'conflito',
  SUSPEITA: 'suspeita',
  INVALIDA: 'invalida',
  FORA_DO_ESCOPO: 'fora_do_escopo',
  DUPLICADA: 'duplicada_no_arquivo',
  ERRO: 'erro'
};

export const OUTCOME_LABEL = {
  criar: 'Criado',
  promover: 'Promovido a cliente',
  registrar_contrato: 'Contrato registrado',
  atualizar: 'Dados preenchidos',
  sem_alteracao: 'Sem alteração',
  conflito: 'Conflito (pulada)',
  suspeita: 'Suspeita por nome',
  invalida: 'Inválida',
  fora_do_escopo: 'Fora do escopo',
  duplicada_no_arquivo: 'Duplicada no arquivo',
  erro: 'Erro na gravação'
};

// Só estes chegam ao Firestore.
export const WRITABLE_OUTCOMES = [OUTCOME.CRIAR, OUTCOME.PROMOVER, OUTCOME.REGISTRAR_CONTRATO, OUTCOME.ATUALIZAR];

// `decision` (suspeita por nome): undefined = ainda sem decisão; 'create' =
// cadastro novo; qualquer outro valor = id do homônimo a usar.
export const classifyCandidate = (c, match, { decision, scope, now, windowDays }) => {
  if (c.duplicateOf) return { outcome: OUTCOME.DUPLICADA, reason: `Repetida da linha ${c.duplicateOf}`, lead: null, fill: null, createContract: false, homonyms: [] };
  if (!isCandidateValid(c)) {
    return { outcome: OUTCOME.INVALIDA, reason: String(c.name || '').length > 1 ? 'Sem CPF válido nem telefone válido' : 'Sem nome', lead: null, fill: null, createContract: false, homonyms: [] };
  }
  if (!isInScope(c, scope, now, windowDays)) {
    const reason = c.contractSituation === CONTRACT_SITUATION.CANCELADO ? 'Contrato cancelado'
      : c.endsAt ? `Venceu em ${fmtDia(c.endsAt)}, fora da janela`
        : 'Cliente inativo sem vigência';
    return { outcome: OUTCOME.FORA_DO_ESCOPO, reason, lead: null, fill: null, createContract: false, homonyms: [] };
  }
  let lead = match?.lead || null;
  const homonyms = match?.homonyms || [];
  if (match?.kind === 'name') {
    if (!decision) return { outcome: OUTCOME.SUSPEITA, reason: `Já existe "${homonyms[0]?.name}" na base`, lead: null, fill: null, createContract: false, homonyms };
    lead = decision === 'create' ? null : (homonyms.find((h) => h.id === decision) || null);
  }
  if (!lead) {
    return { outcome: OUTCOME.CRIAR, reason: c.endsAt ? 'Cadastro novo com contrato' : 'Cadastro novo sem vigência', lead: null, fill: null, createContract: Boolean(c.endsAt), homonyms: [] };
  }
  if (match?.kind === 'phone' && c.cpfDigits && lead.cpfDigits && lead.cpfDigits !== c.cpfDigits) {
    return { outcome: OUTCOME.CONFLITO, reason: 'CPF diferente do cadastro com este telefone', lead, fill: null, createContract: false, homonyms: [] };
  }
  const existingEnds = getSafeDateOrNull(lead.currentContractEndsAt);
  if (c.endsAt && lead.currentContractId && existingEnds && !sameDay(existingEnds, c.endsAt)) {
    return { outcome: OUTCOME.CONFLITO, reason: `Já tem contrato até ${fmtDia(existingEnds)}`, lead, fill: null, createContract: false, homonyms: [] };
  }
  const fill = buildFillPatch(c, lead);
  const createContract = Boolean(c.endsAt) && !lead.currentContractId;
  if (!isClientLead(lead)) {
    return { outcome: OUTCOME.PROMOVER, reason: createContract ? 'Lead vira cliente com contrato' : 'Lead vira cliente sem vigência', lead, fill, createContract, homonyms: [] };
  }
  if (createContract) return { outcome: OUTCOME.REGISTRAR_CONTRATO, reason: `Vigência até ${fmtDia(c.endsAt)}`, lead, fill, createContract, homonyms: [] };
  if (Object.keys(fill).length) return { outcome: OUTCOME.ATUALIZAR, reason: `Preenche ${Object.keys(fill).filter((k) => !/Digits|Lower|Tokens/.test(k)).join(', ')}`, lead, fill, createContract: false, homonyms: [] };
  return { outcome: OUTCOME.SEM_ALTERACAO, reason: 'Já está igual', lead, fill: null, createContract: false, homonyms: [] };
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: PASS, 44 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: classificação das linhas da importação (criar, promover, conflito, suspeita)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Contrato importado, escritas do lead, contadores e CSV do relatório

**Files:**
- Modify: `src/lib/clientImport.js`
- Test: `src/lib/__tests__/clientImport.test.js`

- [ ] **Step 1: Acrescentar os testes que falham**

Append em `src/lib/__tests__/clientImport.test.js` (acrescente `buildImportedContract, buildImportedClientWrites, summarizeOutcomes, buildReportCsv, OUTCOME_LABEL` ao `import` de `../clientImport.js`, e adicione no topo `import { buildMatriculaWrites, computeEndsAt, CONTRACT_STATUS } from '../contracts.js';`):

```js
const META = { importedBy: 'adminUid', importSource: 'nextfit', sourceLabel: 'NextFit', importBatchId: 'b1', now: NOW };
const OWNER = { consultantId: 'u1', consultantName: 'Bia Souza', consultantAuthUid: 'a1' };
const APP_USER = { id: 'u1', name: 'Bia Souza', authUid: 'a1' };

describe('buildImportedContract', () => {
  it('início real, plano do catálogo, valor da planilha', () => {
    const k = buildImportedContract({ ...VALID, startsAt: D(2026, 8, 12), endsAt: D(2026, 11, 12), value: 450, plan: PLANOS[0], planName: 'Trimestral', contractSituation: 'ativo' }, { owner: OWNER, leadName: 'Ana', importMeta: META });
    expect(k.planId).toBe('pl1');
    expect(k.planName).toBe('Trimestral');
    expect(k.value).toBe(450);
    expect(k.listValue).toBe(450);
    expect(k.durationMonths).toBe(3);
    expect(k.startsAt).toEqual(D(2026, 8, 12));
    expect(k.startsAtInferred).toBe(false);
    expect(k.endsAt).toEqual(D(2026, 11, 12));
    expect(k.status).toBe(CONTRACT_STATUS.ATIVO);
    expect(k.cancelledAt).toBeNull();
    expect(k.pausedAt).toBeNull();
    expect(k.renewedFromId).toBeNull();
    expect(k.consultantId).toBe('u1');
    expect(k.importBatchId).toBe('b1');
  });

  it('sem início: infere fim menos a duração do plano e marca; sem plano fica nulo', () => {
    const comPlano = buildImportedContract({ ...VALID, endsAt: D(2026, 11, 12), plan: PLANOS[0], value: null }, { owner: OWNER, leadName: 'Ana', importMeta: META });
    expect(comPlano.startsAt).toEqual(D(2026, 8, 12));
    expect(comPlano.startsAtInferred).toBe(true);
    expect(comPlano.value).toBe(450);
    const semPlano = buildImportedContract({ ...VALID, endsAt: D(2026, 11, 12), plan: null, planName: 'Plano Ouro', value: null }, { owner: OWNER, leadName: 'Ana', importMeta: META });
    expect(semPlano.startsAt).toBeNull();
    expect(semPlano.startsAtInferred).toBe(false);
    expect(semPlano.planId).toBeNull();
    expect(semPlano.planName).toBe('Plano Ouro');
    expect(semPlano.durationMonths).toBeNull();
    expect(semPlano.value).toBe(0);
  });

  it('sem plano mas com início: duração em meses inteiros', () => {
    const k = buildImportedContract({ ...VALID, startsAt: D(2026, 8, 12), endsAt: D(2026, 11, 12), plan: null, planName: 'X' }, { owner: OWNER, leadName: 'Ana', importMeta: META });
    expect(k.durationMonths).toBe(3);
  });

  it('cancelado leva cancelledAt no fim; trancado leva pausedAt na importação', () => {
    const c = buildImportedContract({ ...VALID, endsAt: D(2026, 11, 12), contractSituation: 'cancelado', plan: null }, { owner: OWNER, leadName: 'Ana', importMeta: META });
    expect(c.status).toBe(CONTRACT_STATUS.CANCELADO);
    expect(c.cancelledAt).toEqual(D(2026, 11, 12));
    const t = buildImportedContract({ ...VALID, endsAt: D(2026, 11, 12), contractSituation: 'trancado', plan: null }, { owner: OWNER, leadName: 'Ana', importMeta: META });
    expect(t.status).toBe(CONTRACT_STATUS.TRANCADO);
    expect(t.pausedAt).toBe(NOW);
  });
});

describe('buildImportedClientWrites', () => {
  const newCandidate = { ...VALID, rg: '12', birthDate: D(1985, 3, 5), sexo: 'Feminino', dor: 'Emagrecer', vip: true, address: { street: 'Rua A' }, registeredAt: D(2026, 1, 10), startsAt: D(2026, 8, 12), endsAt: D(2026, 11, 12), value: 450, plan: PLANOS[0], planName: 'Trimestral', consultant: null, professorId: 'p1', professorName: 'Carlos Lima' };

  it('cadastro novo nasce cliente, com contrato, carimbos históricos e campos de busca', () => {
    const w = buildImportedClientWrites({ c: newCandidate, cls: { lead: null, fill: null, createContract: true }, consultant: USERS[0], funnelId: 'f1', appUser: APP_USER, importMeta: META, now: NOW });
    expect(w.isNew).toBe(true);
    expect(w.leadId).toBeNull();
    expect(w.leadName).toBe('Ana Teste');
    const d = w.leadData;
    expect(d.name).toBe('Ana Teste');
    expect(d.whatsapp).toBe('(71) 9 9999-0001');
    expect(d.cpf).toBe('529.982.247-25');
    expect(d.status).toBe('Venda');
    expect(d.isConverted).toBe(true);
    expect(d.lifecycleStage).toBe('cliente');
    expect(d.lifecycleBucket).toBe('cliente');
    expect(d.funnelId).toBe('f1');
    expect(d.source).toBe('Importação NextFit');
    expect(d.tags).toEqual(['VIP']);
    expect(d.consultantId).toBe('u1');
    expect(d.consultantAuthUid).toBe('a1');
    expect(d.professorId).toBe('p1');
    expect(d.createdAt).toEqual(D(2026, 1, 10));
    expect(d.convertedAt).toEqual(D(2026, 8, 12));
    expect(d.clienteSince).toEqual(D(2026, 1, 10));
    expect(d.currentContractEndsAt).toEqual(D(2026, 11, 12));
    expect(d.currentContractStatus).toBe(CONTRACT_STATUS.ATIVO);
    expect(d.currentPlanName).toBe('Trimestral');
    expect(d.renewalHandledCheckpoints).toEqual([]);
    expect(d.reactivationStageId).toBeNull();
    expect(d.whatsappDigits).toBe('71999990001');
    expect(d.cpfDigits).toBe('52998224725');
    expect(d.nameTokens).toEqual(['ana', 'teste']);
    expect(d.lastInteractionAt).toBeNull();
    expect(d.interactionsCount).toBe(0);
    expect(d.importBatchId).toBe('b1');
    expect(d.importedBy).toBe('adminUid');
    expect(w.contract.endsAt).toEqual(D(2026, 11, 12));
    expect(w.owner).toEqual(OWNER);
    expect(w.interactionText).toBe('Cadastro importado do NextFit. Plano Trimestral, vigência até 12/11/2026.');
    expect(w.warnings).toEqual([]);
  });

  it('professor não reconhecido não vaza nome; sem data histórica avisa e usa a importação', () => {
    const w = buildImportedClientWrites({ c: { ...VALID, professorId: null, professorName: 'Ninguém', consultant: null }, cls: { lead: null, fill: null, createContract: false }, consultant: USERS[0], funnelId: 'f1', appUser: APP_USER, importMeta: META, now: NOW });
    expect(w.leadData.professorId).toBeNull();
    expect(w.leadData.professorName).toBeNull();
    expect(w.leadData.createdAt).toBe(NOW);
    expect(w.leadData.convertedAt).toBe(NOW);
    expect(w.contract).toBeNull();
    expect(w.interactionText).toBe('Cadastro importado do NextFit. Sem vigência registrada.');
    expect(w.warnings).toEqual(['Sem data histórica: conta como venda de hoje']);
  });

  it('promover lead existente: patch de matrícula + preenchimentos, sem tocar nome nem consultor', () => {
    const lead = { id: 'L1', name: 'Ana', status: 'Negociando', consultantId: 'u2', consultantName: 'Caio', consultantAuthUid: 'a2', email: null, whatsapp: '(71) 9 9999-0001', cpf: '529.982.247-25', tags: [], createdAt: D(2026, 5, 1) };
    const fill = buildFillPatch(newCandidate, lead);
    const w = buildImportedClientWrites({ c: newCandidate, cls: { lead, fill, createContract: true }, consultant: USERS[0], funnelId: 'f1', appUser: APP_USER, importMeta: META, now: NOW });
    expect(w.isNew).toBe(false);
    expect(w.leadId).toBe('L1');
    const d = w.leadData;
    expect(d.name).toBeUndefined();
    expect(d.consultantId).toBeUndefined();
    expect(d.email).toBe('ana@example.com');
    expect(d.status).toBe('Venda');
    expect(d.isConverted).toBe(true);
    expect(d.lifecycleStage).toBe('cliente');
    expect(d.lifecycleBucket).toBe('cliente');
    expect(d.nextFollowUp).toBeNull();
    expect(d.lostAt).toBeNull();
    expect(d.convertedAt).toEqual(D(2026, 8, 12));
    expect(d.clienteSince).toEqual(D(2026, 1, 10));
    expect(d.currentContractEndsAt).toEqual(D(2026, 11, 12));
    expect(d.createdAt).toBeUndefined();
    expect(w.owner).toEqual({ consultantId: 'u2', consultantName: 'Caio', consultantAuthUid: 'a2' });
    expect(w.contract.consultantId).toBe('u2');
  });

  it('cliente existente só recebendo contrato não muda status nem convertedAt', () => {
    const lead = { id: 'L1', name: 'Ana', lifecycleStage: 'cliente', status: 'Venda', isConverted: true, convertedAt: D(2025, 1, 1), clienteSince: D(2025, 1, 1), consultantId: 'u2', consultantName: 'Caio', consultantAuthUid: 'a2' };
    const w = buildImportedClientWrites({ c: newCandidate, cls: { lead, fill: {}, createContract: true }, consultant: USERS[0], funnelId: 'f1', appUser: APP_USER, importMeta: META, now: NOW });
    expect(w.leadData.status).toBeUndefined();
    expect(w.leadData.convertedAt).toBeUndefined();
    expect(w.leadData.clienteSince).toBeUndefined();
    expect(w.leadData.currentContractStatus).toBe(CONTRACT_STATUS.ATIVO);
    expect(w.leadData.lifecycleBucket).toBe('cliente');
  });

  it('lead existente sem dono ganha o consultor padrão (preencher vazio, não trocar)', () => {
    const lead = { id: 'L1', name: 'Ana', status: 'Novo' };
    const w = buildImportedClientWrites({ c: VALID, cls: { lead, fill: {}, createContract: false }, consultant: USERS[0], funnelId: 'f1', appUser: APP_USER, importMeta: META, now: NOW });
    expect(w.leadData.consultantId).toBe('u1');
    expect(w.leadData.consultantAuthUid).toBe('a1');
  });

  it('PARIDADE com buildMatriculaWrites: mesmo leadPatch e mesmo contrato nos campos comuns', () => {
    const lead = { id: 'L1', name: 'Ana Teste', consultantId: 'u1', consultantName: 'Bia Souza', consultantAuthUid: 'a1' };
    const start = D(2026, 8, 12);
    const ref = buildMatriculaWrites({ lead, plan: PLANOS[0], value: 450, startsAt: start, appUser: APP_USER });
    const c = { ...newCandidate, startsAt: start, endsAt: computeEndsAt(start, 3), value: 450, plan: PLANOS[0] };
    const w = buildImportedClientWrites({ c, cls: { lead: null, fill: null, createContract: true }, consultant: USERS[0], funnelId: 'f1', appUser: APP_USER, importMeta: META, now: NOW });
    ['lifecycleStage', 'currentPlanName', 'currentContractValue', 'currentContractStartsAt', 'currentContractEndsAt', 'currentContractStatus', 'renewalHandledCheckpoints', 'renewalDeclined', 'reactivationStageId']
      .forEach((k) => expect(w.leadData[k], k).toEqual(ref.leadPatch[k]));
    ['planId', 'planName', 'value', 'listValue', 'durationMonths', 'startsAt', 'endsAt', 'status', 'cancelledAt', 'cancelReason', 'renewedFromId', 'consultantId', 'consultantName', 'consultantAuthUid']
      .forEach((k) => expect(w.contract[k], k).toEqual(ref.contract[k]));
  });
});

describe('summarizeOutcomes / buildReportCsv', () => {
  const results = [
    { c: { ...VALID, rowNumber: 2, endsAt: D(2026, 11, 12), plan: PLANOS[0] }, cls: { outcome: OUTCOME.CRIAR, reason: 'x', createContract: true } },
    { c: { ...VALID, rowNumber: 3, endsAt: null, plan: null, consultant: null, consultantName: 'Zé' }, cls: { outcome: OUTCOME.PROMOVER, reason: 'y', createContract: false } },
    { c: { ...VALID, rowNumber: 4, endsAt: D(2026, 11, 12), plan: null, planName: 'Plano Ouro' }, cls: { outcome: OUTCOME.REGISTRAR_CONTRATO, reason: 'z', createContract: true } },
    { c: { ...VALID, rowNumber: 5, warnings: ['CPF inválido'] }, cls: { outcome: OUTCOME.CONFLITO, reason: 'w', createContract: false } }
  ];

  it('conta por resultado, sem vigência, planos fora do catálogo, consultores não reconhecidos e avisos', () => {
    const s = summarizeOutcomes(results);
    expect(s.criar).toBe(1);
    expect(s.promover).toBe(1);
    expect(s.registrar_contrato).toBe(1);
    expect(s.conflito).toBe(1);
    expect(s.sem_alteracao).toBe(0);
    expect(s.semVigencia).toBe(1);
    expect(s.planosForaDoCatalogo).toEqual(['Plano Ouro']);
    expect(s.consultoresNaoReconhecidos).toEqual(['Zé']);
    expect(s.avisos).toBe(1);
    expect(s.gravaveis).toBe(3);
  });

  it('CSV com BOM, ponto e vírgula e aspas escapadas', () => {
    const csv = buildReportCsv([{ c: { rowNumber: 2, name: 'Ana "Teste"', warnings: ['CPF inválido'] }, cls: { outcome: OUTCOME.CRIAR, reason: 'Cadastro novo' } }]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('"linha";"nome";"resultado";"motivo";"avisos"');
    expect(lines[1]).toBe(`"2";"Ana ""Teste""";"${OUTCOME_LABEL.criar}";"Cadastro novo";"CPF inválido"`);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js`
Expected: FAIL (`buildImportedContract is not a function` e afins).

- [ ] **Step 3: Implementar e remover o `__IMPORT_INTERNALS`**

Em `src/lib/clientImport.js`, apague a linha `export const __IMPORT_INTERNALS = { ... };` e o comentário acima dela, e acrescente no fim do arquivo:

```js
// ---------------------------------------------------------------------------
// Contrato importado
// ---------------------------------------------------------------------------

// Meses inteiros entre duas datas (mínimo 1), ou null.
const monthsBetween = (a, b) => {
  const days = daysBetween(a, b);
  if (days == null) return null;
  const m = Math.round(days / 30.4375);
  return m >= 1 ? m : null;
};

// Mesmo shape do `contract` de buildMatriculaWrites (contracts.js), com
// startsAt/endsAt vindos da planilha. A importação NUNCA inventa data: fim é
// obrigatório (o caller só chama com c.endsAt); início real se veio, inferido
// (fim menos a duração do plano do catálogo, marcado) se der, senão nulo.
export const buildImportedContract = (c, { owner, leadName, importMeta }) => {
  const plan = c.plan || null;
  const planMonths = Number(plan?.durationMonths) || 0;
  const startsAt = c.startsAt || (planMonths > 0 ? addMonths(c.endsAt, -planMonths) : null);
  const startsAtInferred = !c.startsAt && Boolean(startsAt);
  const durationMonths = planMonths > 0 ? planMonths : (c.startsAt ? monthsBetween(c.startsAt, c.endsAt) : null);
  const status = c.contractSituation === CONTRACT_SITUATION.CANCELADO ? CONTRACT_STATUS.CANCELADO
    : c.contractSituation === CONTRACT_SITUATION.TRANCADO ? CONTRACT_STATUS.TRANCADO
      : CONTRACT_STATUS.ATIVO;
  const listValue = Number(plan?.value) || 0;
  const value = Number.isFinite(Number(c.value)) && c.value != null ? Number(c.value) : listValue;
  return {
    leadId: null,
    leadName: leadName || null,
    planId: plan?.id || null,
    planName: plan?.name || c.planName || null,
    value,
    listValue,
    durationMonths,
    startsAt,
    endsAt: c.endsAt,
    status,
    cancelledAt: status === CONTRACT_STATUS.CANCELADO ? c.endsAt : null,
    cancelReason: null,
    // Trancado sem data de pausa na planilha: a importação é o melhor dado
    // que existe; a reativação pela ficha empurra o fim a partir daí.
    pausedAt: status === CONTRACT_STATUS.TRANCADO ? importMeta.now : null,
    renewedFromId: null,
    startsAtInferred,
    consultantId: owner.consultantId,
    consultantName: owner.consultantName,
    consultantAuthUid: owner.consultantAuthUid,
    importedBy: importMeta.importedBy,
    importSource: importMeta.importSource,
    importBatchId: importMeta.importBatchId
  };
};

// ---------------------------------------------------------------------------
// Escritas do lead (o QUE gravar; o COMO fica em clientImportWrites.js)
// ---------------------------------------------------------------------------

// Espelho do patch que commitMatricula grava (contractsWrites.js).
const CLIENT_MARKS = {
  status: 'Venda',
  isConverted: true,
  lifecycleStage: 'cliente',
  lossReason: null,
  lostAt: null,
  nextFollowUp: null,
  renewalHandledCheckpoints: [],
  renewalDeclined: false,
  reactivationStageId: null
};

const contractSummary = (contract) => (contract ? {
  currentPlanName: contract.planName,
  currentContractValue: contract.value,
  currentContractStartsAt: contract.startsAt,
  currentContractEndsAt: contract.endsAt,
  currentContractStatus: contract.status
} : {});

export const buildImportInteractionText = ({ sourceLabel, contract }) =>
  `Cadastro importado do ${sourceLabel}. ${contract
    ? `Plano ${contract.planName || 'sem nome'}, vigência até ${fmtDia(contract.endsAt)}.`
    : 'Sem vigência registrada.'}`;

// `consultant` é o dono para cadastro NOVO (ou para lead existente sem dono):
// o consultor da linha quando casou, senão o padrão escolhido no assistente.
// Lead existente com dono mantém o dono, sempre.
export const buildImportedClientWrites = ({ c, cls, consultant, funnelId, appUser, importMeta, now }) => {
  const lead = cls?.lead || null;
  const isNew = !lead;
  const historical = c.startsAt || c.registeredAt || null;
  const convertedAt = historical || now;
  const warnings = [...(c.warnings || [])];
  if (!historical) warnings.push('Sem data histórica: conta como venda de hoje');

  const owner = lead?.consultantId
    ? { consultantId: lead.consultantId, consultantName: lead.consultantName ?? null, consultantAuthUid: lead.consultantAuthUid ?? null }
    : { consultantId: consultant?.id ?? null, consultantName: consultant?.name ?? null, consultantAuthUid: consultant?.authUid ?? null };

  const leadName = lead?.name || c.name;
  const contract = cls?.createContract && c.endsAt
    ? buildImportedContract(c, { owner, leadName, importMeta })
    : null;
  const stamps = { importedBy: importMeta.importedBy, importSource: importMeta.importSource, importBatchId: importMeta.importBatchId };

  let leadData;
  if (isNew) {
    const whatsapp = c.whatsappDigits ? formatPhone(c.whatsappDigits) : c.whatsappRaw;
    const cpf = c.cpfDigits ? formatCPF(c.cpfDigits) : null;
    leadData = {
      name: c.name,
      whatsapp,
      email: c.email,
      cpf,
      rg: c.rg,
      birthDate: c.birthDate,
      sexo: c.sexo,
      dor: c.dor,
      modalidade: null,
      address: c.address,
      tags: c.vip ? ['VIP'] : [],
      source: `Importação ${importMeta.sourceLabel}`,
      observation: '',
      funnelId,
      professorId: c.professorId || null,
      professorName: c.professorId ? c.professorName : null,
      referredById: null,
      referredByName: null,
      ...owner,
      ...CLIENT_MARKS,
      ...contractSummary(contract),
      ...buildLeadSearchFields({ name: c.name, whatsapp, cpf }),
      createdAt: c.registeredAt || now,
      convertedAt,
      clienteSince: earliest(c.registeredAt, c.startsAt) || now,
      lastInteractionAt: null,
      interactionsCount: 0,
      nextFollowUpType: null,
      appointmentType: null,
      appointmentScheduledFor: null,
      ...stamps
    };
    leadData.lifecycleBucket = deriveLeadBucket(leadData);
  } else {
    const promote = !isClientLead(lead);
    leadData = {
      ...(cls.fill || {}),
      ...(lead.consultantId ? {} : owner),
      ...(promote ? CLIENT_MARKS : {}),
      ...contractSummary(contract),
      ...(promote ? { convertedAt: getSafeDateOrNull(lead.convertedAt) || convertedAt } : {}),
      ...(lead.clienteSince ? {} : { clienteSince: earliest(c.registeredAt, c.startsAt) || now }),
      ...stamps
    };
    leadData.lifecycleBucket = deriveLeadBucket({ ...lead, ...leadData });
  }

  return {
    isNew,
    leadId: lead?.id || null,
    leadName,
    leadData,
    contract,
    interactionText: buildImportInteractionText({ sourceLabel: importMeta.sourceLabel, contract }),
    owner,
    warnings
  };
};

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

export const summarizeOutcomes = (results) => {
  const s = Object.fromEntries(Object.values(OUTCOME).map((k) => [k, 0]));
  s.semVigencia = 0;
  s.avisos = 0;
  s.gravaveis = 0;
  const planos = new Set();
  const consultores = new Set();
  (results || []).forEach(({ c, cls }) => {
    s[cls.outcome] = (s[cls.outcome] || 0) + 1;
    if ((c.warnings || []).length) s.avisos += 1;
    if (!WRITABLE_OUTCOMES.includes(cls.outcome)) return;
    s.gravaveis += 1;
    if ((cls.outcome === OUTCOME.CRIAR || cls.outcome === OUTCOME.PROMOVER) && !c.endsAt) s.semVigencia += 1;
    if (cls.createContract && c.planName && !c.plan) planos.add(c.planName);
    if (c.consultantName && !c.consultant && !cls.lead?.consultantId) consultores.add(c.consultantName);
  });
  s.planosForaDoCatalogo = [...planos];
  s.consultoresNaoReconhecidos = [...consultores];
  return s;
};

// CSV para o Excel em pt-BR: BOM, ponto e vírgula, tudo entre aspas.
export const buildReportCsv = (results) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['linha', 'nome', 'resultado', 'motivo', 'avisos'].map(esc).join(';')];
  (results || []).forEach(({ c, cls }) => {
    lines.push([c.rowNumber, c.name, OUTCOME_LABEL[cls.outcome] || cls.outcome, cls.reason || '', (c.warnings || []).join(' | ')].map(esc).join(';'));
  });
  return `﻿${lines.join('\r\n')}`;
};
```

- [ ] **Step 4: Rodar tudo e ver passar**

Run: `npm test`
Expected: PASS em todos os arquivos; `clientImport.test.js` com 56 testes. Se o teste de paridade falhar num campo, o campo divergente aparece no nome da asserção: corrija o importador, nunca o `buildMatriculaWrites`.

- [ ] **Step 5: Lint e commit**

Run: `npm run lint` (nenhum erro em `src/lib/clientImport.js`).

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: contrato importado, escritas do lead e relatório da importação

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Evento `import` na timeline é Sistema

**Files:**
- Modify: `src/lib/timeline.js` (função `classifyInteraction`)
- Test: `src/lib/__tests__/timeline.test.js`

Hoje um `type: 'import'` já cai no `return 'system'` final por exclusão. A linha explícita existe para o evento não mudar de balde quando alguém reordenar as regras; por isso o teste passa antes da mudança e não há passo "ver falhar".

- [ ] **Step 1: Acrescentar o teste**

Append em `src/lib/__tests__/timeline.test.js`:

```js
describe('classifyInteraction: cadastro importado', () => {
  // O texto cita "Plano ..." e cairia no regex de contrato se o gate por type
  // não existisse. É evento de sistema: fica atrás do interruptor.
  it('type import é sistema mesmo mencionando plano e vigência', () => {
    expect(classifyInteraction({
      type: 'import',
      text: 'Cadastro importado do NextFit. Plano Trimestral, vigência até 12/11/2026.'
    })).toBe('system');
  });
});
```

- [ ] **Step 2: Implementar**

Em `src/lib/timeline.js`, dentro de `classifyInteraction`, logo depois de `if (i.type === 'referral') return 'referral';`, acrescente:

```js
  // Cadastro importado de outro sistema (clientImportWrites.js): evento de
  // sistema, atrás do interruptor. Vem antes do regex de contrato porque o
  // texto cita o plano e a vigência.
  if (i.type === 'import') return 'system';
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/timeline.js src/lib/__tests__/timeline.test.js
git commit -m "feat: evento de cadastro importado classificado como sistema na timeline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Gravação (consultas em lote e batches)

**Files:**
- Create: `src/lib/clientImportWrites.js`

Sem teste unitário (Firestore). Verificação: lint agora, teste real na Task 11.

- [ ] **Step 1: Escrever o módulo**

Create `src/lib/clientImportWrites.js`:

```js
// Gravação da importação de clientes no Firestore. O QUE gravar vem de
// clientImport.js (puro); aqui fica o COMO: as consultas em lote que casam a
// planilha com a base e os batches que gravam lead + contrato + evento.
//
// Sem função na Vercel: a sessão assumida é o uid do admin da academia
// (api/impersonate.js), então a criação de lead passa pelo isAdmin das regras
// e a de contrato/interação é aberta a qualquer membro. Nenhuma regra muda.

import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, LEADS_PATH, CONTRACTS_PATH, INTERACTIONS_PATH } from './firebase.js';
import { normalizeLeadDoc } from './leads.js';
import { normalizeName } from './clientImport.js';

// Limite do operador `in` do Firestore.
const IN_LIMIT = 30;
// Teto de operações por batch (o Firestore aceita 500; margem para o carimbo).
const OPS_PER_BATCH = 450;

const leadsCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// Uma consulta de igualdade por lote de até 30 valores num campo materializado
// (cpfDigits, whatsappDigits, nameLower): índice automático, sem composto.
const queryIn = async (db, field, values) => {
  const uniq = [...new Set((values || []).filter(Boolean))];
  const found = [];
  for (const part of chunk(uniq, IN_LIMIT)) {
    const snap = await getDocs(query(leadsCol(db), where(field, 'in', part)));
    snap.docs.forEach((d) => found.push(normalizeLeadDoc(d)));
  }
  return found;
};

// Índice da base para resolveMatch (clientImport.js): CPF e telefone por
// igualdade em duas passadas; nome só para quem não casou por nenhum dos dois
// (é o único uso do nome, que nunca casa sozinho). O nome NÃO consulta
// nameLower por igualdade: o cadastro grava nameLower sem colapsar espaços,
// então "Ana  Silva" digitada com dois espaços nunca casaria com a planilha.
// Consulta nameTokens (array de palavras, sem espaço) pelo primeiro token e
// recompõe a chave a partir do `name` gravado com a mesma normalizeName da
// planilha. Dedupe por id: um doc pode voltar em mais de um lote.
export async function lookupExisting({ db, candidates }) {
  const byCpf = new Map();
  const byPhone = new Map();
  const byName = new Map();
  (await queryIn(db, 'cpfDigits', candidates.map((c) => c.cpfDigits))).forEach((l) => {
    if (l.cpfDigits && !byCpf.has(l.cpfDigits)) byCpf.set(l.cpfDigits, l);
  });
  (await queryIn(db, 'whatsappDigits', candidates.map((c) => c.whatsappDigits))).forEach((l) => {
    if (l.whatsappDigits && !byPhone.has(l.whatsappDigits)) byPhone.set(l.whatsappDigits, l);
  });
  const unmatched = candidates.filter((c) =>
    !(c.cpfDigits && byCpf.has(c.cpfDigits)) && !(c.whatsappDigits && byPhone.has(c.whatsappDigits)));
  (await queryIn(db, 'nameLower', unmatched.map((c) => c.nameLower))).forEach((l) => {
    if (!l.nameLower) return;
    const list = byName.get(l.nameLower) || [];
    list.push(l);
    byName.set(l.nameLower, list);
  });
  return { byCpf, byPhone, byName };
}

// Grava os itens preparados por buildImportedClientWrites. Cada linha fica
// inteira num só batch (lead, contrato e evento nascem juntos ou não nascem).
// Falhou um batch: devolve quantas linhas entraram e de qual linha em diante
// faltou; a recuperação é rodar o mesmo arquivo de novo (idempotente).
export async function runImport({ db, appUser, items, importMeta, onProgress }) {
  const groups = [];
  let cur = [];
  let curOps = 0;
  for (const it of items) {
    const ops = it.contract ? 3 : 2;
    if (curOps + ops > OPS_PER_BATCH) { groups.push(cur); cur = []; curOps = 0; }
    cur.push(it);
    curOps += ops;
  }
  if (cur.length) groups.push(cur);

  let done = 0;
  for (const group of groups) {
    const batch = writeBatch(db);
    for (const it of group) {
      const leadRef = it.leadId ? doc(leadsCol(db), it.leadId) : doc(leadsCol(db));
      const leadData = { ...it.leadData, importedAt: serverTimestamp() };
      if (it.contract) {
        const contractRef = doc(collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH));
        batch.set(contractRef, {
          ...it.contract,
          leadId: leadRef.id,
          createdAt: serverTimestamp(),
          importedAt: serverTimestamp()
        });
        leadData.currentContractId = contractRef.id;
      }
      batch.set(leadRef, leadData, { merge: true });
      // Evento de sistema: sem bump de lastInteractionAt/interactionsCount:
      // importação não é contato (ver hasActiveInteractionToday).
      batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)), {
        leadId: leadRef.id,
        leadName: it.leadName || null,
        consultantName: appUser?.name || null,
        leadConsultantId: it.owner?.consultantId ?? null,
        leadConsultantAuthUid: it.owner?.consultantAuthUid ?? null,
        actorId: appUser?.id || null,
        actorAuthUid: appUser?.authUid || null,
        text: it.interactionText,
        type: 'import',
        importedBy: importMeta.importedBy,
        importSource: importMeta.importSource,
        importBatchId: importMeta.importBatchId,
        importedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      return { done, failedFromRow: group[0].rowNumber, error };
    }
    done += group.length;
    if (onProgress) onProgress(done, items.length);
  }
  return { done, failedFromRow: null, error: null };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: nenhum erro em `src/lib/clientImportWrites.js`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/clientImportWrites.js
git commit -m "feat: consultas em lote e batches da importação de clientes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: O assistente (ImportClientsSection)

**Files:**
- Create: `src/views/settings/ImportClientsSection.jsx`

Sem teste unitário de componente (o repo não testa telas); a regra toda já está coberta nas libs. Regras de lint que mordem aqui: `react-hooks/set-state-in-effect` (não há `useEffect` neste componente, todo trabalho assíncrono roda em handler) e `react-hooks/purity` (`new Date()` só dentro de handler, nunca no render). O `Select` é o shadcn já instalado em `src/components/ui/select.jsx`; item com `value` vazio quebra o Radix, por isso os sentinelas `__none__` e `__auto__`.

- [ ] **Step 1: Criar o componente**

Create `src/views/settings/ImportClientsSection.jsx`:

```jsx
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { SettingsSectionHeader, SettingsPanel } from '../../components/ui/SettingsCard.jsx';
import { SettingsBtn, PanelNote, EmptyState } from './settingsBits.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { cn } from '../../lib/utils.js';
import { readSpreadsheetFile } from '../../lib/spreadsheetRead.js';
import { TARGET_FIELDS, TARGET_GROUP_LABEL, detectPreset, buildMapping, importSourceLabel } from '../../lib/importPresets.js';
import {
  parseRow, dedupeInFile, enrichCandidate, distinctPlanNames, resolveMatch, classifyCandidate,
  buildImportedClientWrites, summarizeOutcomes, buildReportCsv,
  OUTCOME, OUTCOME_LABEL, WRITABLE_OUTCOMES, SCOPE, PLAN_AS_TEXT
} from '../../lib/clientImport.js';
import { lookupExisting, runImport } from '../../lib/clientImportWrites.js';
import { getDefaultFunnel, isSystemFunnel } from '../../lib/funnels.js';
import { normalizeExpiredWindowDays } from '../../lib/expiredGoal.js';
import { deriveLeadState, getTone } from '../../lib/leadState.js';

// ==========================================
// IMPORTAR CLIENTES: quatro passos, só na sessão assumida do super console.
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md
//
// Arquivo → Mapeamento → Revisão (ensaio completo, sem gravar) → Importar.
// Toda regra mora em src/lib/clientImport.js; aqui é só estado, handlers e
// tela. Nada de useEffect: leitura do arquivo, consultas e gravação rodam nos
// handlers dos botões, e o que é derivado sai de useMemo.
// ==========================================

const STEPS = ['Arquivo', 'Mapeamento', 'Revisão', 'Importar'];
const NONE = '__none__';
const AUTO = '__auto__';

const COUNTER_TONE = {
  criar: 'emerald', promover: 'emerald', registrar_contrato: 'brand', atualizar: 'teal',
  sem_alteracao: 'slate', conflito: 'rose', suspeita: 'amber', invalida: 'rose',
  fora_do_escopo: 'slate', duplicada_no_arquivo: 'slate', erro: 'rose'
};

const COUNTER_ORDER = [
  OUTCOME.CRIAR, OUTCOME.PROMOVER, OUTCOME.REGISTRAR_CONTRATO, OUTCOME.ATUALIZAR, OUTCOME.SEM_ALTERACAO,
  OUTCOME.SUSPEITA, OUTCOME.CONFLITO, OUTCOME.INVALIDA, OUTCOME.DUPLICADA, OUTCOME.FORA_DO_ESCOPO, OUTCOME.ERRO
];

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[12px]">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              'size-6 rounded-full grid place-items-center text-[11px] font-bold',
              state === 'current' && 'bg-brand-600 text-white',
              state === 'done' && 'bg-emerald-500 text-white',
              state === 'todo' && 'bg-muted text-muted-foreground'
            )}>
              {state === 'done' ? <CheckCircle2 size={13} /> : n}
            </span>
            <span className={cn('font-semibold', state === 'todo' && 'text-muted-foreground')}>{label}</span>
            {n < STEPS.length && <span className="w-6 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Counter({ label, value, tone }) {
  const t = getTone(tone);
  return (
    <div className={cn('rounded-xl border border-border px-3 py-2.5 min-w-0', value > 0 ? t.soft : 'bg-card', value > 0 && t.darkSoft)}>
      <div className={cn('text-[22px] font-display font-bold leading-none num', value > 0 ? cn(t.text, t.darkText) : 'text-muted-foreground')}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
    </div>
  );
}

const leadStateLabel = (lead) => deriveLeadState(lead).label;

function ImportClientsSection({ db, appUser, usersList, funnels, planos }) {
  const toast = useToast();
  const { professores, renewalGraceDays } = useGeneralConfig();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);            // { name, headers, rows, preset }
  const [mapping, setMapping] = useState({});
  const [planMap, setPlanMap] = useState({});        // { [nomeNormalizado]: planId | PLAN_AS_TEXT }
  const [defaultConsultantId, setDefaultConsultantId] = useState('');
  const [scope, setScope] = useState(SCOPE.PADRAO);
  const [review, setReview] = useState(null);        // { base: [{ c, match }], now }
  const [decisions, setDecisions] = useState({});    // { [rowNumber]: 'create' | leadId }
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState(null);        // { results, summary, failedFromRow, error, batchId }

  const consultants = usersList || [];
  const defaultConsultant = consultants.find((u) => u.id === defaultConsultantId) || null;
  const windowDays = normalizeExpiredWindowDays(renewalGraceDays);
  const funnelId = getDefaultFunnel((funnels || []).filter((f) => !isSystemFunnel(f)))?.id || null;
  const sourceLabel = importSourceLabel(file?.preset);

  // Nomes de plano da planilha, para a tabela de mapeamento de planos.
  const planNames = useMemo(
    () => (file ? distinctPlanNames(file.rows.map((r) => parseRow(r, mapping, r.__row))) : []),
    [file, mapping]
  );

  // Classificação reativa às decisões de suspeita (a revisão em si, com as
  // consultas, só roda no botão).
  const results = useMemo(() => {
    if (!review) return [];
    return review.base.map(({ c, match }) => ({
      c, match,
      cls: classifyCandidate(c, match, { decision: decisions[c.rowNumber], scope, now: review.now, windowDays })
    }));
  }, [review, decisions, scope, windowDays]);
  const summary = useMemo(() => summarizeOutcomes(results), [results]);
  const suspects = results.filter((r) => r.cls.outcome === OUTCOME.SUSPEITA || (r.match.kind === 'name' && decisions[r.c.rowNumber]));
  const conflicts = results.filter((r) => r.cls.outcome === OUTCOME.CONFLITO);
  const invalids = results.filter((r) => r.cls.outcome === OUTCOME.INVALIDA);

  const resetAll = () => {
    setStep(1); setFile(null); setMapping({}); setPlanMap({}); setReview(null);
    setDecisions({}); setReport(null); setProgress({ done: 0, total: 0 });
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const { headers, rows } = await readSpreadsheetFile(f);
      if (!headers.length || !rows.length) { toast.error('A planilha não tem cabeçalho ou não tem linhas.'); return; }
      const preset = detectPreset(headers);
      setFile({ name: f.name, headers, rows, preset });
      setMapping(buildMapping(headers, preset));
      setPlanMap({}); setReview(null); setDecisions({}); setReport(null);
      setStep(2);
      toast.success(preset ? `${preset.label} detectado: ${rows.length} linhas.` : `${rows.length} linhas lidas. Confira o mapeamento.`);
    } catch (err) {
      console.error('readSpreadsheetFile', err);
      toast.error('Não consegui ler o arquivo. Use .xlsx ou .csv exportado do sistema.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const runReview = async () => {
    if (!mapping.name) { toast.warning('Mapeie ao menos a coluna do nome.'); return; }
    if (!defaultConsultant) { toast.warning('Escolha o consultor padrão.'); return; }
    if (!funnelId) { toast.warning('A academia não tem funil. Crie um em Funis & etapas.'); return; }
    setBusy(true);
    try {
      const now = new Date();
      const parsed = file.rows.map((r) => parseRow(r, mapping, r.__row, now));
      const { kept, duplicates } = dedupeInFile(parsed);
      const enrich = (c) => enrichCandidate(c, { usersList: consultants, professores, planos, planMap });
      const keptEnriched = kept.map(enrich);
      const index = await lookupExisting({ db, candidates: keptEnriched });
      const base = [...keptEnriched, ...duplicates.map(enrich)]
        .map((c) => ({ c, match: resolveMatch(c, index) }))
        .sort((a, b) => a.c.rowNumber - b.c.rowNumber);
      setReview({ base, now });
      setDecisions({});
      setReport(null);
      setStep(3);
    } catch (err) {
      console.error('runReview', err);
      toast.error(err?.code === 'permission-denied'
        ? 'Sem permissão para ler a base desta academia.'
        : 'Falha ao preparar a revisão. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const runImportNow = async () => {
    const writable = results.filter((r) => WRITABLE_OUTCOMES.includes(r.cls.outcome));
    if (!writable.length) { toast.info('Nada para gravar.'); return; }
    if (summary.suspeita > 0) { toast.warning('Decida as suspeitas por nome antes de importar.'); return; }
    if (!window.confirm(`Gravar ${writable.length} cadastro(s) na base desta academia?\n\nO que já existe é promovido, não recriado. Esta ação não pode ser desfeita.`)) return;

    setBusy(true);
    const importMeta = {
      importedBy: appUser?.authUid || appUser?.id || null,
      importSource: file.preset?.id || 'manual',
      sourceLabel,
      importBatchId: crypto.randomUUID(),
      now: review.now
    };
    const items = writable.map(({ c, cls }) => ({
      rowNumber: c.rowNumber,
      ...buildImportedClientWrites({ c, cls, consultant: c.consultant || defaultConsultant, funnelId, appUser, importMeta, now: review.now })
    }));
    setProgress({ done: 0, total: items.length });
    setStep(4);

    const res = await runImport({ db, appUser, items, importMeta, onProgress: (done, total) => setProgress({ done, total }) });

    const writtenRows = new Set(items.slice(0, res.done).map((i) => i.rowNumber));
    const finalResults = results.map((r) => {
      if (!WRITABLE_OUTCOMES.includes(r.cls.outcome)) return r;
      if (writtenRows.has(r.c.rowNumber)) return { ...r, written: true };
      return { ...r, cls: { ...r.cls, outcome: OUTCOME.ERRO, reason: res.failedFromRow ? `Não gravada (falha a partir da linha ${res.failedFromRow})` : 'Não gravada' } };
    });
    setReport({ results: finalResults, summary: summarizeOutcomes(finalResults), failedFromRow: res.failedFromRow, error: res.error, batchId: importMeta.importBatchId });
    setBusy(false);

    if (res.error) {
      console.error('runImport', res.error);
      toast.error(res.error?.code === 'permission-denied'
        ? 'Gravação negada pelo Firestore. Confira se a academia está ativa e se a sessão é de admin.'
        : 'A gravação parou no meio. Rode o mesmo arquivo de novo: o que já entrou conta como sem alteração.');
    } else {
      toast.success(`${res.done} cadastro(s) gravado(s).`);
    }
  };

  const downloadReport = () => {
    const csv = buildReportCsv(report.results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `importacao-${file.name.replace(/\.[^.]+$/, '')}-${review.now.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setMappingField = (field, header) => setMapping((m) => ({ ...m, [field]: header === NONE ? null : header }));
  const setPlanMapKey = (key, value) => setPlanMap((m) => {
    const next = { ...m };
    if (value === AUTO) delete next[key];
    else next[key] = value;
    return next;
  });
  const setDecision = (rowNumber, value) => setDecisions((d) => ({ ...d, [rowNumber]: value }));

  const groupedFields = ['pessoa', 'endereco', 'contrato'].map((g) => ({ id: g, label: TARGET_GROUP_LABEL[g], fields: TARGET_FIELDS.filter((f) => f.group === g) }));

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Importar clientes"
        hint="Traga os alunos ativos de outro sistema de gestão. Quem já existe é promovido, não duplicado."
      >
        {step > 1 && !busy && <SettingsBtn kind="soft" onClick={resetAll}>Recomeçar</SettingsBtn>}
      </SettingsSectionHeader>

      <Stepper step={step} />

      {step === 1 && (
        <SettingsPanel icon={<FileSpreadsheet size={16} />} iconTone="brand" title="1. Arquivo" hint="Exportação de clientes ou de contratos, em .xlsx ou .csv.">
          <div className="px-5 pb-5">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[14px] border border-dashed border-border p-8 text-center transition hover:border-brand-600 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 disabled:opacity-50"
            >
              {busy ? <Loader2 size={22} className="mx-auto animate-spin text-brand-600" /> : <Upload size={22} className="mx-auto text-brand-600" />}
              <div className="mt-2 text-[13.5px] font-semibold">{busy ? 'Lendo a planilha…' : 'Escolher arquivo'}</div>
              <div className="text-[12px] text-muted-foreground mt-1">NextFit é reconhecido sozinho. Outros sistemas passam pelo mapeamento manual.</div>
            </button>
          </div>
          <PanelNote>A vigência (início, fim e valor) costuma vir no relatório de contratos, separado do cadastro. Suba os dois, um de cada vez: o segundo casa por CPF e só pendura o contrato.</PanelNote>
        </SettingsPanel>
      )}

      {step === 2 && file && (
        <>
          <SettingsPanel icon={<FileSpreadsheet size={16} />} iconTone="brand" title="2. Mapeamento" hint={`${file.name} · ${file.rows.length} linhas · ${file.preset ? `preset ${file.preset.label}` : 'sem preset, mapeamento manual'}`}>
            <div className="px-5 pb-4 flex flex-col gap-4">
              {groupedFields.map((g) => (
                <div key={g.id}>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground mb-2">{g.label}</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.fields.map((f) => (
                      <label key={f.id} className="flex flex-col gap-1 min-w-0">
                        <span className={cn('text-[11.5px] font-semibold truncate', f.required && !mapping[f.id] && 'text-rose-600')}>
                          {f.label}{f.required ? ' *' : ''}
                        </span>
                        <Select value={mapping[f.id] || NONE} onValueChange={(v) => setMappingField(f.id, v)}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Sem coluna" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Sem coluna</SelectItem>
                            {file.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SettingsPanel>

          <SettingsPanel title="Planos da planilha" hint="Casa cada nome com um plano do catálogo. Sem correspondência, o nome fica como texto e o contrato nasce sem plano.">
            {planNames.length === 0
              ? <EmptyState>Nenhuma coluna de plano mapeada, ou a planilha não traz plano.</EmptyState>
              : (
                <div className="px-5 pb-4 flex flex-col gap-2">
                  {planNames.map((p) => (
                    <div key={p.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{p.label}</div><div className="text-[11px] text-muted-foreground num">{p.count} {p.count === 1 ? 'linha' : 'linhas'}</div></div>
                      <span className="text-muted-foreground text-[12px]">→</span>
                      <Select value={planMap[p.key] || AUTO} onValueChange={(v) => setPlanMapKey(p.key, v)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO}>Automático (mesmo nome)</SelectItem>
                          <SelectItem value={PLAN_AS_TEXT}>Manter como texto</SelectItem>
                          {(planos || []).map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name} · {pl.durationMonths} {Number(pl.durationMonths) === 1 ? 'mês' : 'meses'}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
          </SettingsPanel>

          <SettingsPanel title="Consultor padrão e escopo">
            <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold">Consultor padrão *</span>
                <Select value={defaultConsultantId || NONE} onValueChange={(v) => setDefaultConsultantId(v === NONE ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Selecione</SelectItem>
                    {consultants.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">Recebe as linhas cujo consultor não bate com ninguém da equipe.</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold">O que entra</span>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SCOPE.PADRAO}>Ativos e vencidos há até {windowDays} dias</SelectItem>
                    <SelectItem value={SCOPE.TODOS}>Todos (inclui cancelados e inativos antigos)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">O padrão é quem os funis de Renovações e Vencidos querem no dia um.</span>
              </label>
            </div>
            <div className="px-5 pb-5 flex justify-end">
              <SettingsBtn kind="primary" disabled={busy || !mapping.name || !defaultConsultant} onClick={runReview} icon={busy ? <Loader2 size={14} className="animate-spin" /> : null}>
                {busy ? 'Consultando a base…' : 'Revisar antes de gravar'}
              </SettingsBtn>
            </div>
          </SettingsPanel>
        </>
      )}

      {step === 3 && review && (
        <>
          <SettingsPanel title="3. Revisão" hint="Ensaio completo. Nada foi gravado ainda.">
            <div className="px-5 pb-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {COUNTER_ORDER.filter((k) => k !== OUTCOME.ERRO).map((k) => <Counter key={k} label={OUTCOME_LABEL[k]} value={summary[k] || 0} tone={COUNTER_TONE[k]} />)}
              <Counter label="Sem vigência" value={summary.semVigencia} tone="amber" />
            </div>
            {(summary.semVigencia > 0 || summary.planosForaDoCatalogo.length > 0 || summary.consultoresNaoReconhecidos.length > 0 || summary.avisos > 0) && (
              <div className="px-5 pb-4 flex flex-col gap-1.5 text-[12px]">
                {summary.semVigencia > 0 && <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle size={14} className="shrink-0 mt-px" /><span>{summary.semVigencia} cliente(s) sem vigência: não entram em Renovações nem em Vencidos até alguém registrar o contrato.</span></div>}
                {summary.planosForaDoCatalogo.length > 0 && <div className="text-muted-foreground">{summary.planosForaDoCatalogo.length} plano(s) fora do catálogo: {summary.planosForaDoCatalogo.join(', ')}.</div>}
                {summary.consultoresNaoReconhecidos.length > 0 && <div className="text-muted-foreground">Consultor não reconhecido (vai para {defaultConsultant?.name}): {summary.consultoresNaoReconhecidos.join(', ')}.</div>}
                {summary.avisos > 0 && <div className="text-muted-foreground">{summary.avisos} linha(s) com aviso (CPF inválido, data ilegível, sem data histórica). Aparecem no relatório.</div>}
              </div>
            )}
          </SettingsPanel>

          {suspects.length > 0 && (
            <SettingsPanel title="Suspeitas por nome" hint="Sem CPF nem telefone em comum, mas o nome já existe na base. Decida linha a linha.">
              <div className="px-5 pb-4 flex flex-col gap-2">
                {suspects.map(({ c, match }) => (
                  <div key={c.rowNumber} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 text-[12.5px]">
                    <span className="num text-muted-foreground">L{c.rowNumber}</span>
                    <span className="font-semibold truncate">{c.name}</span>
                    <Select value={decisions[c.rowNumber] || 'create'} onValueChange={(v) => setDecision(c.rowNumber, v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create">Criar cadastro novo</SelectItem>
                        {match.homonyms.map((h) => (
                          <SelectItem key={h.id} value={h.id}>Usar: {h.name} · {leadStateLabel(h)}{h.consultantName ? ` · ${h.consultantName}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <PanelNote>Nada aqui é gravado até você confirmar. Quem ficar sem decisão é tratado como cadastro novo.</PanelNote>
            </SettingsPanel>
          )}

          {conflicts.length > 0 && (
            <SettingsPanel title="Conflitos (pulados)" hint="Contrato com vigência diferente, ou CPF divergente no mesmo telefone. Resolva na ficha e rode de novo.">
              <div className="px-5 pb-4 flex flex-col gap-1 text-[12.5px]">
                {conflicts.map(({ c, cls }) => (
                  <div key={c.rowNumber} className="grid grid-cols-[auto_1fr_1fr] gap-3"><span className="num text-muted-foreground">L{c.rowNumber}</span><span className="font-semibold truncate">{c.name}</span><span className="text-muted-foreground truncate">{cls.reason}</span></div>
                ))}
              </div>
            </SettingsPanel>
          )}

          {invalids.length > 0 && (
            <SettingsPanel title="Linhas inválidas" hint="Sem nome, ou sem CPF válido e sem telefone válido. Não casam nem nascem.">
              <div className="px-5 pb-4 flex flex-col gap-1 text-[12.5px]">
                {invalids.map(({ c, cls }) => (
                  <div key={c.rowNumber} className="grid grid-cols-[auto_1fr_1fr] gap-3"><span className="num text-muted-foreground">L{c.rowNumber}</span><span className="font-semibold truncate">{c.name || '(sem nome)'}</span><span className="text-muted-foreground truncate">{cls.reason}</span></div>
                ))}
              </div>
            </SettingsPanel>
          )}

          <div className="flex items-center justify-between gap-3">
            <SettingsBtn kind="soft" disabled={busy} onClick={() => { setReview(null); setDecisions({}); setStep(2); }}>Voltar ao mapeamento</SettingsBtn>
            <SettingsBtn kind="primary" disabled={busy || summary.gravaveis === 0} onClick={runImportNow}>
              Importar {summary.gravaveis} cadastro(s)
            </SettingsBtn>
          </div>
        </>
      )}

      {step === 4 && (
        <SettingsPanel title="4. Importar" hint={report ? (report.error ? 'A gravação parou no meio.' : 'Concluído.') : 'Gravando…'}>
          <div className="px-5 pb-4">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full transition-all', report?.error ? 'bg-rose-500' : 'bg-brand-600')} style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
            </div>
            <div className="text-[12px] text-muted-foreground mt-2 num">{progress.done} de {progress.total} linha(s) gravada(s)</div>
          </div>
          {report && (
            <>
              <div className="px-5 pb-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {COUNTER_ORDER.map((k) => <Counter key={k} label={OUTCOME_LABEL[k]} value={report.summary[k] || 0} tone={COUNTER_TONE[k]} />)}
              </div>
              <div className="px-5 pb-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground num">Lote {report.batchId}</span>
                <div className="flex gap-2">
                  <SettingsBtn kind="secondary" icon={<Download size={14} />} onClick={downloadReport}>Baixar relatório (CSV)</SettingsBtn>
                  <SettingsBtn kind="primary" onClick={resetAll}>Importar outro arquivo</SettingsBtn>
                </div>
              </div>
              <PanelNote>{report.error ? 'Rode o mesmo arquivo de novo: o que já entrou conta como "sem alteração" e só o que faltou é gravado.' : 'Confira Clientes, os funis Renovações e Vencidos e a coluna Venda do mês. O evento "Cadastro importado" fica atrás do interruptor Sistema na timeline.'}</PanelNote>
            </>
          )}
        </SettingsPanel>
      )}
    </div>
  );
}

export { ImportClientsSection };
```

- [ ] **Step 2: Lint e build**

Run: `npm run lint && npm run build`
Expected: nenhum erro em `ImportClientsSection.jsx`; o build gera um chunk separado para o `xlsx` (aparece em `dist/assets/xlsx-*.js`), prova de que o `import()` dinâmico funcionou.

- [ ] **Step 3: Commit**

```bash
git add src/views/settings/ImportClientsSection.jsx
git commit -m "feat: assistente de importação de clientes em quatro passos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Entrada nas Configurações, fixtures e teste real

**Files:**
- Modify: `src/views/settings/SettingsView.jsx`
- Create: `docs/superpowers/fixtures/2026-09-03-nextfit-cadastro-exemplo.csv`
- Create: `docs/superpowers/fixtures/2026-09-03-nextfit-contratos-exemplo.csv`

- [ ] **Step 1: Ligar a seção ao trilho, só na sessão assumida**

Em `src/views/settings/SettingsView.jsx`:

1. Na linha de import do lucide, acrescente `FileSpreadsheet`:
```js
import { ArrowRightLeft, CalendarClock, FileSpreadsheet, Gauge, Handshake, Kanban, Library, Target, Users } from 'lucide-react';
```
2. Depois de `import { CatalogsSection } from './CatalogsSection.jsx';`:
```js
import { ImportClientsSection } from './ImportClientsSection.jsx';
```
3. Dentro de `SettingsView`, logo depois de `const pendingOwnersCount = ...;`:
```js
  // Importação de clientes: só na sessão assumida do super console (spec
  // 2026-09-03). Em dev local não existe "Entrar como" (a /api dá 404 no
  // vite), então o admin vê a seção para conseguir testar; em produção a
  // condição é só o claim. É trava de tela, não de permissão: as regras já
  // deixam o admin criar lead e contrato um a um.
  const canImport = Boolean(appUser?.impersonating) || import.meta.env.DEV;
```
4. No grupo `'Pessoas'`, troque o array `items` por:
```js
      items: [
        { id: 'team', label: 'Equipe & acessos', icon: <Users size={15} />, count: (usersList || []).length },
        { id: 'transfer', label: 'Migrar leads', icon: <ArrowRightLeft size={15} /> },
        { id: 'referral-owners', label: 'Indicações sem dono', icon: <Handshake size={15} />, count: pendingOwnersCount || undefined },
        ...(canImport ? [{ id: 'import', label: 'Importar clientes', icon: <FileSpreadsheet size={15} /> }] : [])
      ]
```
5. Depois do bloco `{section === 'referral-owners' && (...)}`:
```jsx
        {section === 'import' && canImport && (
          <ImportClientsSection db={db} appUser={appUser} usersList={usersList} funnels={funnels} planos={planos} />
        )}
```

- [ ] **Step 2: Criar as fixtures (dados fictícios; CPFs válidos de teste)**

Create `docs/superpowers/fixtures/2026-09-03-nextfit-cadastro-exemplo.csv`:
```csv
Nome;E-mail;Contrato;Telefone;Situação do contrato;Situação do cliente;CPF;RG;Data de nascimento;Data de cadastro;Objetivo;Sexo;VIP;Endereco;Número;Bairro;Cep;Cidade;Complemento;Consultor;Professor
Ana Teste Importacao;ana.teste@example.com;Trimestral;(71) 99999-0001;Ativo;Ativo;529.982.247-25;123456;05/03/1985;10/01/2026;Emagrecer;F;Não;Rua A;10;Centro;40000-000;Salvador;;;
Bruno Teste Importacao;;Mensal;5571999990002;Ativo;Ativo;111.444.777-35;;20/07/1990;15/02/2026;Hipertrofia;M;Sim;;;;;;;;
Carla Teste Importacao;carla.teste@example.com;Anual;71 99999-0003;Vencido;Inativo;123.456.789-09;;;01/06/2024;;F;Não;;;;;;;;
Diego Teste Importacao;;Trimestral;;Ativo;Ativo;000.000.000-00;;;03/03/2026;;M;Não;;;;;;;;
Ana Teste Importacao;ana2@example.com;Trimestral;(71) 99999-0001;Ativo;Ativo;529.982.247-25;;;10/01/2026;;F;Não;;;;;;;;
```

Create `docs/superpowers/fixtures/2026-09-03-nextfit-contratos-exemplo.csv`:
```csv
Nome;CPF;Contrato;Data de início;Data de fim;Valor;Situação do contrato
Ana Teste Importacao;529.982.247-25;Trimestral;12/08/2026;12/11/2026;R$ 450,00;Ativo
Bruno Teste Importacao;111.444.777-35;Mensal;;25/08/2026;150,00;Vencido
```

O que cada linha prova, na rodada 1 (cadastro): Ana cria; Bruno cria (telefone com 55 normalizado, VIP vira etiqueta); Carla fica fora do escopo (inativa sem vigência); Diego é inválido (CPF fictício e sem telefone); a segunda Ana é duplicada no arquivo. Na rodada 2 (contratos): Ana recebe contrato com início real; Bruno recebe contrato vencido há 9 dias (na janela) com início inferido pelo plano Mensal. Rodar a rodada 2 de novo tem de dar "sem alteração" nas duas.

- [ ] **Step 3: Lint, testes e build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 4: Commit e push**

```bash
git add src/views/settings/SettingsView.jsx docs/superpowers/fixtures/
git commit -m "feat: seção Importar clientes nas Configurações (sessão assumida) e fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin claude/stronilead-customer-import-dadc92
```

- [ ] **Step 5: Teste real no preview da Vercel (gate de merge do spec)**

Só em ACADEMIA DE TESTE. Nunca numa academia real.

1. Abrir o preview deploy da branch (a Vercel comenta o link na PR da Task 12; pode abrir a PR como rascunho antes deste passo).
2. Entrar no super console e "Entrar como" a academia de teste. Conferir que a academia tem ao menos um funil comum, o plano "Trimestral" (3 meses) e o plano "Mensal" (1 mês) no catálogo.
3. Configurações → Pessoas → Importar clientes. Subir `2026-09-03-nextfit-cadastro-exemplo.csv`. Esperado no passo 1: "NextFit detectado: 5 linhas". No passo 2: nome, telefone, CPF etc. já mapeados; "Trimestral", "Mensal" e "Anual" na tabela de planos (os dois primeiros casam sozinhos). Escolher o consultor padrão; escopo padrão.
4. Revisão esperada: criar 2 (Ana, Bruno), fora do escopo 1 (Carla), inválida 1 (Diego), duplicada no arquivo 1 (linha 6), sem vigência 2.
5. Importar. Relatório: 2 gravadas. Conferir na aba Clientes: Ana e Bruno como CLIENTE ATIVO, sem contrato; Bruno com etiqueta VIP e telefone (71) 9 9999-0002; ficha de cada um com o evento "Cadastro importado do NextFit. Sem vigência registrada." visível só com o interruptor Sistema ligado; coluna Venda do mês do pipeline SEM os dois (convertedAt é a data de cadastro).
6. Subir `2026-09-03-nextfit-contratos-exemplo.csv`. Esperado: sem preset, mapeamento por sinônimo já preenchido (nome, CPF, plano, início, fim, valor, situação). Revisão: contrato registrado 2. Importar.
7. Conferir: Ana com vigência 12/08/2026 a 12/11/2026, plano Trimestral, R$ 450,00, estado A VENCER ou CLIENTE ATIVO conforme o threshold da academia; funil Renovações do board mostra Ana na coluna do marco correspondente. Bruno vencido em 25/08/2026: aparece no funil Vencidos do board e na Meta Diária (categoria Vencido) do consultor padrão; contrato com `startsAtInferred` (início 25/07/2026).
8. Subir o mesmo arquivo de contratos de novo. Esperado: sem alteração 2, gravadas 0.
9. Sair da sessão assumida e entrar como o gestor da academia de teste: a seção "Importar clientes" NÃO aparece.
10. Registrar na PR o resultado dos passos 4, 5, 7, 8 e 9 (uma linha cada).

---

### Task 12: Pull request

- [ ] **Step 1: Abrir a PR**

```bash
gh pr create --base main --head claude/stronilead-customer-import-dadc92 --title "feat: importação de clientes ativos de outros sistemas" --body "$(cat <<'EOF'
## O que muda

Importação por planilha (.xlsx/.csv) dos clientes ativos de outro sistema de gestão (NextFit reconhecido sozinho; outros pelo mapeamento manual), visível só na sessão assumida do super console, em Configurações → Pessoas → Importar clientes.

- Produz o mesmo par lead + contrato da matrícula pela tela (`buildImportedClientWrites`, com teste de paridade contra `buildMatriculaWrites`).
- Não duplica: CPF primeiro, WhatsApp depois; quem já existe é promovido a cliente (a planilha só preenche vazio, nunca troca o consultor); homônimo só levanta suspeita.
- Nunca inventa vigência: sem data de fim a pessoa entra sem contrato e o relatório avisa.
- Carimbos históricos (`convertedAt`, `createdAt`, `clienteSince`): ninguém entra na Venda do mês nem fecha a Meta Diária de hoje.
- Idempotente: rodar o mesmo arquivo de novo dá "sem alteração". Cadastro do NextFit numa rodada, relatório de contratos na outra.
- Zero função nova na Vercel, zero regra nova, zero índice novo.

Spec: `docs/superpowers/specs/2026-09-03-importacao-clientes-design.md`
Plano: `docs/superpowers/plans/2026-09-03-importacao-clientes.md`

## Teste real (academia de teste, sessão assumida)

- [ ] Rodada 1 (cadastro): criar 2, fora do escopo 1, inválida 1, duplicada 1
- [ ] Clientes sem contrato, VIP, timeline atrás do Sistema, Venda do mês vazia
- [ ] Rodada 2 (contratos): Ana em Renovações, Bruno em Vencidos (board + Meta)
- [ ] Rodada 2 repetida: sem alteração 2
- [ ] Gestor não vê a seção

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Acompanhar os checks (Lint · Testes · Build, Vercel) e completar o teste real da Task 11 no preview**

Merge só com aprovação do Johnny.

---

## Fora deste plano

Reimportação como renovação (fim maior que o contrato vigente), integração por API, histórico de contratos anteriores, importação pelo gestor sem sessão assumida e persistência do mapeamento de planos entre rodadas. Estão listados como "Fora da v1" no spec.
