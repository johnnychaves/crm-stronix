# Modelo de planilha da importação de clientes: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A importação de clientes do super console passa a aceitar um formato só, o modelo de planilha do Stronilead, que o próprio super console baixa já com os planos, a equipe e os professores da academia.

**Architecture:** Uma tabela pura (`TEMPLATE_COLUMNS`, em `src/lib/importTemplate.js`) é a fonte única do cabeçalho. Dela saem a descrição do arquivo (`buildTemplateSpec`), a conferência do cabeçalho na hora de subir (`checkTemplateHeaders`) e o mapeamento que `parseRow` já recebe (`templateMapping`). Um módulo à parte (`src/lib/importTemplateWrite.js`) é o único que toca o ExcelJS, por `import()` dinâmico, num pedaço próprio do build. A tela perde o mapeamento manual, o reconhecimento do NextFit e a rodada dupla. As regras de gravação não mudam.

**Tech Stack:** React 19 + Vite (rolldown) + Vitest 4 (ambiente node) + ExcelJS 4.4 (novo, só gera o arquivo) + SheetJS 0.20.3 (já instalado, só lê).

**Spec:** `docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md`

---

## Antes de começar

- Trabalhe na worktree `wizardly-hawking-1be445`, branch `claude/manual-cadastro-contrato-retroativo-68c320`.
- As dependências da worktree foram reinstaladas com `npm ci` em 24/09/2026. Se `npx vitest run` reclamar de `xlsx` ou `react-router`, rode `npm ci` de novo.
- Linha de base em 24/09/2026: `npx vitest run` com 2231 testes verdes e `npx eslint .` com 0 erros e 1 aviso. Nenhuma tarefa pode deixar erro de lint nem teste vermelho.
- Commits em português, no formato `tipo: descrição curta`, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Os textos de tela e do modelo vão exatamente como estão aqui. Eles já passaram pelo humanizer (sem travessão no meio da frase).

## Ajustes feitos durante a execução

As revisões de código mudaram alguns pontos depois que o plano foi escrito. O código commitado é o que vale; os blocos das tarefas abaixo mostram a versão original.

- **Task 2:** a lista `PARSE_ROW_FIELDS` do teste passou a sair do próprio `parseRow` (um mapeamento espião com `Proxy`), e entraram dois testes de `templateMapping` (o primeiro cabeçalho repetido vale; o `"Plano * (2)"` do leitor nunca toma o lugar da coluna certa).
- **Task 3, erro crítico corrigido:** os limites da validação de data iam como os números `1` e `73415`, e o ExcelJS lê número como milissegundos desde 1970. No arquivo isso virava 01/01/1970 00:00 a 00:01, e o Excel recusaria qualquer data real em Início, Data de nascimento e Cliente desde. Agora vão como `new Date(Date.UTC(1899, 11, 31))` e `new Date(Date.UTC(2100, 11, 31))`, que chegam ao XML como `1` e `73415`. Ler de volta com o ExcelJS não mostrava o erro, porque ele desfaz a mesma conversão.
- **Task 3, ajustes menores:** a fórmula do Fim também confere o intervalo (`AND(ISNUMBER(F2),F2>=1,F2<=73415,OR(E2="",F2>=E2))`); o nome da aba vai entre aspas na lista (`'Listas'!$A$2:$A$3`); o exemplo da aba "Como preencher" usa a duração do plano mostrado, com seis meses de reserva; e entraram testes para nome que só difere no acento e para a duração do exemplo.
- **Task 4:** a lista esperada no teste passa a ser `"'Listas'!$A$2:$A$3"`, e entra um teste que abre o XML do arquivo (`XLSX.CFB`, do SheetJS) e confere `<formula1>1</formula1><formula2>73415</formula2>` na validação de data. São 9 testes nesse arquivo.
- **Task 9:** o item do CLAUDE.md sobre as datas diz que o limite vai como `Date` em meia-noite UTC, e que só o teste do XML prova isso.

## Mapa de arquivos

| Arquivo | O que acontece |
|---|---|
| `package.json`, `package-lock.json` | `exceljs` entra como dependência. |
| `vite.config.js` | `exceljs` ganha um pedaço próprio no build, como o `xlsx`. |
| `src/lib/importTemplate.js` (novo) | Tabela de colunas, `normalizeHeader`, conferência do cabeçalho, mapeamento e descrição do arquivo. Puro. |
| `src/lib/__tests__/importTemplate.test.js` (novo) | Testes da tabela, da conferência, do mapeamento e da descrição. |
| `src/lib/importTemplateWrite.js` (novo) | Único lugar que toca o ExcelJS: descrição → `.xlsx` → download. |
| `src/lib/__tests__/importTemplateWrite.test.js` (novo) | Volta completa: ExcelJS gera, SheetJS lê, `parseRow` interpreta. |
| `src/lib/clientImport.js` | Três avisos novos em `parseRow`; origem única (`IMPORT_SOURCE_ID`, `IMPORT_LEAD_SOURCE`). |
| `src/lib/__tests__/clientImport.test.js` | Testes dos avisos; asserções de origem trocadas. |
| `src/views/settings/ImportClientsSection.jsx` | Botão Baixar modelo, recusa de arquivo, passo Ajustes. |
| `src/lib/importPresets.js`, `src/lib/__tests__/importPresets.test.js` | Apagados. |
| `docs/superpowers/fixtures/2026-09-03-nextfit-*.csv` | Apagados. |
| `docs/superpowers/fixtures/2026-09-24-modelo-exemplo.csv` (novo) | Linhas fictícias para o teste de verdade. |
| `CLAUDE.md` | Seção nova "Importação de clientes (super console)". |
| `docs/superpowers/specs/2026-09-03-importacao-clientes-design.md` | Aviso no topo apontando para a spec nova. |

---

### Task 1: ExcelJS instalado e num pedaço próprio do build

**Files:**
- Modify: `package.json`, `package-lock.json` (pelo npm)
- Modify: `vite.config.js:67-70`

- [ ] **Step 1: Instalar**

Run: `npm install exceljs@^4.4.0 --no-audit --no-fund`
Expected: `package.json` ganha `"exceljs": "^4.4.0"` em `dependencies`.

- [ ] **Step 2: Separar o pedaço no build**

Em `vite.config.js`, dentro de `manualChunks`, troque:

```js
          // SheetJS só entra pelo import() da importação de clientes: chunk
          // próprio, baixado sob demanda. No 'vendor' ele iria para todo mundo.
          if (id.includes('/xlsx/')) return 'xlsx';
          return 'vendor';
```

por:

```js
          // SheetJS só entra pelo import() da importação de clientes: chunk
          // próprio, baixado sob demanda. No 'vendor' ele iria para todo mundo.
          if (id.includes('/xlsx/')) return 'xlsx';
          // ExcelJS só entra pelo import() do "Baixar modelo" do super console
          // (src/lib/importTemplateWrite.js). São 930 kB: no 'vendor' iria para
          // todo mundo.
          if (id.includes('/exceljs/')) return 'exceljs';
          return 'vendor';
```

- [ ] **Step 3: Conferir que nada quebrou**

Run: `npx vitest run 2>&1 | tail -3`
Expected: `Tests  2231 passed (2231)`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "chore: exceljs num pedaço próprio do build para o modelo de importação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tabela do modelo, conferência do cabeçalho e mapeamento

**Files:**
- Create: `src/lib/importTemplate.js`
- Create: `src/lib/__tests__/importTemplate.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/lib/__tests__/importTemplate.test.js`:

```js
// Modelo de planilha do Stronilead: a tabela de colunas é a fonte única do
// cabeçalho, e a conferência decide se o arquivo que subiu é o modelo.

import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_COLUMNS,
  NOT_TEMPLATE_MESSAGE,
  normalizeHeader,
  templateHeaderLabel,
  checkTemplateHeaders,
  templateMapping
} from '../importTemplate.js';
import { parseRow } from '../clientImport.js';

const LABELS = TEMPLATE_COLUMNS.map(templateHeaderLabel);

// Campos que parseRow (clientImport.js) lê de uma linha.
const PARSE_ROW_FIELDS = [
  'name', 'whatsapp', 'cpf', 'email', 'rg', 'birthDate', 'sexo', 'dor', 'vip', 'registeredAt',
  'consultantName', 'professorName', 'addrStreet', 'addrNumber', 'addrComplement', 'addrNeighborhood',
  'addrCep', 'addrCity', 'planName', 'contractSituation', 'clientSituation', 'contractStartsAt',
  'contractEndsAt', 'contractValue'
];

// Cabeçalho da exportação de cadastro do NextFit: divide só Nome e CPF com as
// obrigatórias do modelo.
const NEXTFIT_HEADERS = [
  'Nome', 'E-mail', 'Contrato', 'Telefone', 'Situação do contrato', 'Situação do cliente',
  'CPF', 'RG', 'Data de nascimento', 'Data de cadastro', 'Objetivo', 'Sexo', 'VIP',
  'Endereco', 'Número', 'Bairro', 'Cep', 'Cidade', 'Complemento', 'Consultor', 'Professor'
];

describe('normalizeHeader', () => {
  it('tira acento, caixa, pontuação e o asterisco', () => {
    expect(normalizeHeader('Início da vigência *')).toBe('inicio da vigencia');
    expect(normalizeHeader('  Situação  do_Contrato ')).toBe('situacao do contrato');
    expect(normalizeHeader('E-mail')).toBe('e mail');
  });
});

describe('TEMPLATE_COLUMNS', () => {
  it('traz todos os campos que parseRow lê, menos a situação do cliente, sem repetir', () => {
    const fields = TEMPLATE_COLUMNS.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect([...fields].sort()).toEqual(PARSE_ROW_FIELDS.filter((f) => f !== 'clientSituation').sort());
  });

  it('as obrigatórias são Nome, CPF, WhatsApp, Plano, Início e Fim, e vêm primeiro', () => {
    expect(TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.header))
      .toEqual(['Nome', 'CPF', 'WhatsApp', 'Plano', 'Início da vigência', 'Fim da vigência']);
    expect(TEMPLATE_COLUMNS.slice(0, 6).every((c) => c.required)).toBe(true);
  });

  it('o rótulo da obrigatória leva asterisco', () => {
    expect(LABELS[0]).toBe('Nome *');
    expect(LABELS[6]).toBe('Valor total do contrato');
  });

  it('nenhum cabeçalho colide com outro depois de normalizado', () => {
    const keys = TEMPLATE_COLUMNS.map((c) => normalizeHeader(c.header));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('checkTemplateHeaders', () => {
  it('aceita o modelo como sai do gerador', () => {
    expect(checkTemplateHeaders(LABELS)).toEqual({ ok: true, missing: [], message: null });
  });

  it('aceita outra ordem, sem asterisco, com caixa e acento trocados', () => {
    const headers = [...TEMPLATE_COLUMNS].reverse()
      .map((c) => c.header.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    expect(checkTemplateHeaders(headers).ok).toBe(true);
  });

  it('aceita o modelo sem as colunas opcionais', () => {
    expect(checkTemplateHeaders(TEMPLATE_COLUMNS.filter((c) => c.required).map(templateHeaderLabel)).ok).toBe(true);
  });

  it('recusa a exportação do NextFit como "não é o modelo"', () => {
    expect(checkTemplateHeaders(NEXTFIT_HEADERS)).toMatchObject({ ok: false, message: NOT_TEMPLATE_MESSAGE });
  });

  it('recusa arquivo sem cabeçalho', () => {
    expect(checkTemplateHeaders([])).toMatchObject({ ok: false, message: NOT_TEMPLATE_MESSAGE });
  });

  it('nomeia a obrigatória que falta', () => {
    const headers = LABELS.filter((h) => h !== 'Fim da vigência *');
    expect(checkTemplateHeaders(headers))
      .toEqual({ ok: false, missing: ['Fim da vigência'], message: 'Falta a coluna Fim da vigência.' });
  });

  it('nomeia todas quando faltam duas', () => {
    const headers = LABELS.filter((h) => h !== 'Plano *' && h !== 'Fim da vigência *');
    expect(checkTemplateHeaders(headers))
      .toMatchObject({ ok: false, message: 'Faltam as colunas Plano e Fim da vigência.' });
  });

  it('com três obrigatórias faltando deixa de reconhecer o arquivo', () => {
    const gone = ['Plano *', 'Início da vigência *', 'Fim da vigência *'];
    expect(checkTemplateHeaders(LABELS.filter((h) => !gone.includes(h))).message).toBe(NOT_TEMPLATE_MESSAGE);
  });
});

describe('templateMapping', () => {
  it('devolve o cabeçalho REAL do arquivo para cada campo', () => {
    const m = templateMapping(LABELS.map((h) => h.toUpperCase()));
    expect(m.name).toBe('NOME *');
    expect(m.contractEndsAt).toBe('FIM DA VIGÊNCIA *');
    expect(m.contractValue).toBe('VALOR TOTAL DO CONTRATO');
  });

  it('coluna opcional apagada fica nula', () => {
    expect(templateMapping(LABELS.filter((h) => h !== 'Cidade')).addrCity).toBeNull();
  });

  it('alimenta parseRow sem ajuste nenhum', () => {
    const row = {
      __row: 2,
      'Nome *': 'Ana Teste',
      'CPF *': '012.345.678-90',
      'WhatsApp *': '(71) 99999-0001',
      'Plano *': 'Trimestral',
      'Início da vigência *': '12/08/2026',
      'Fim da vigência *': '12/11/2026',
      'Valor total do contrato': '1.200,50',
      'Situação do contrato': 'Trancado',
      'Consultor': 'Bia',
      'VIP': 'Sim'
    };
    const c = parseRow(row, templateMapping(LABELS), 2, new Date(2026, 8, 24));
    expect(c).toMatchObject({
      name: 'Ana Teste',
      cpfDigits: '01234567890',
      whatsappDigits: '71999990001',
      planName: 'Trimestral',
      value: 1200.5,
      contractSituation: 'trancado',
      consultantName: 'Bia',
      vip: true
    });
    expect(c.startsAt).toEqual(new Date(2026, 7, 12));
    expect(c.endsAt).toEqual(new Date(2026, 10, 12));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/importTemplate.test.js 2>&1 | tail -5`
Expected: FAIL, com `Failed to resolve import "../importTemplate.js"` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar**

Crie `src/lib/importTemplate.js`:

```js
// Modelo de planilha do Stronilead: o único formato que a importação de
// clientes aceita. TEMPLATE_COLUMNS é a fonte única do cabeçalho: o arquivo
// gerado (importTemplateWrite.js), a conferência do cabeçalho na hora de subir
// e o mapeamento campo → cabeçalho que parseRow recebe saem dela, então o
// modelo e a importação não se desencontram. Puro: sem React, sem Firestore e
// sem ExcelJS.
// Spec: docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md

import { normalize } from './globalSearch.js';

// Cabeçalho normalizado: minúsculas, sem acento, só letras e números, espaços
// únicos. "Início da vigência *" e "INICIO_DA_VIGENCIA" viram a mesma chave, e
// o asterisco das colunas obrigatórias some.
export const normalizeHeader = (h) =>
  normalize(h).replace(/[^a-z0-9]+/g, ' ').trim();

// kind: 'text' (formato @, o Excel não converte em número), 'date', 'endDate'
// (data igual ou depois do início da mesma linha), 'money' e 'list'. Lista com
// `options` é fixa e travada. Lista com `list` sai do cadastro da academia e
// só avisa, porque aluno antigo pode estar num plano que não se vende mais, e
// a importação acerta o nome na revisão.
export const TEMPLATE_COLUMNS = [
  { field: 'name', header: 'Nome', required: true, kind: 'text', width: 32, note: 'Nome completo do cliente.' },
  { field: 'cpf', header: 'CPF', required: true, kind: 'text', width: 16, note: 'Com ou sem pontos. Preencha o CPF ou o WhatsApp: pelo menos um dos dois é obrigatório.' },
  { field: 'whatsapp', header: 'WhatsApp', required: true, kind: 'text', width: 18, note: 'Com DDD. Preencha o CPF ou o WhatsApp: pelo menos um dos dois é obrigatório.' },
  { field: 'planName', header: 'Plano', required: true, kind: 'list', list: 'planos', width: 26, note: 'Escolha na lista. São os planos cadastrados no Stronilead.' },
  { field: 'contractStartsAt', header: 'Início da vigência', required: true, kind: 'date', width: 16, note: 'Dia em que o contrato atual começou.' },
  { field: 'contractEndsAt', header: 'Fim da vigência', required: true, kind: 'endDate', width: 16, note: 'Dia em que o contrato atual termina.' },
  { field: 'contractValue', header: 'Valor total do contrato', kind: 'money', width: 18, note: 'Valor do contrato inteiro, não da mensalidade. Em branco, vale o valor do plano.' },
  { field: 'contractSituation', header: 'Situação do contrato', kind: 'list', options: ['Ativo', 'Trancado'], width: 18, note: 'Em branco conta como Ativo. Contrato vencido não precisa de marca: a data de fim decide.' },
  { field: 'consultantName', header: 'Consultor', kind: 'list', list: 'equipe', width: 24, note: 'Dono do cliente no Stronilead. Em branco, vai para o consultor padrão escolhido na importação.' },
  { field: 'professorName', header: 'Professor', kind: 'list', list: 'professores', width: 24, note: 'Professor responsável, se houver.' },
  { field: 'email', header: 'E-mail', kind: 'text', width: 28 },
  { field: 'birthDate', header: 'Data de nascimento', kind: 'date', width: 16 },
  { field: 'sexo', header: 'Sexo', kind: 'list', options: ['Masculino', 'Feminino', 'Outro'], width: 12 },
  { field: 'registeredAt', header: 'Cliente desde', kind: 'date', width: 16, note: 'Quando a pessoa entrou na academia pela primeira vez. Pode ficar em branco.' },
  { field: 'dor', header: 'Objetivo', kind: 'text', width: 24 },
  { field: 'vip', header: 'VIP', kind: 'list', options: ['Sim', 'Não'], width: 8 },
  { field: 'rg', header: 'RG', kind: 'text', width: 14 },
  { field: 'addrCep', header: 'CEP', kind: 'text', width: 11 },
  { field: 'addrStreet', header: 'Endereço', kind: 'text', width: 30 },
  { field: 'addrNumber', header: 'Número', kind: 'text', width: 9 },
  { field: 'addrComplement', header: 'Complemento', kind: 'text', width: 16 },
  { field: 'addrNeighborhood', header: 'Bairro', kind: 'text', width: 18 },
  { field: 'addrCity', header: 'Cidade', kind: 'text', width: 18 }
];

// Cabeçalho como sai no arquivo: a obrigatória leva asterisco.
export const templateHeaderLabel = (col) => (col.required ? `${col.header} *` : col.header);

export const NOT_TEMPLATE_MESSAGE = 'Esse arquivo não é o modelo do Stronilead. Baixe o modelo e peça para a academia preencher.';

// O arquivo conta como o modelo com pelo menos 4 das 6 colunas obrigatórias.
// A exportação de outro sistema divide só Nome e CPF com elas e cai em "não é
// o modelo"; o modelo com uma ou duas obrigatórias apagadas ou renomeadas
// ouve qual coluna falta.
const REQUIRED_TO_RECOGNIZE = 4;

const joinList = (items) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(items);

const missingMessage = (missing) => (missing.length === 1
  ? `Falta a coluna ${missing[0]}.`
  : `Faltam as colunas ${joinList(missing)}.`);

// { ok, missing, message }. Ordem, caixa, acento e asterisco não importam;
// coluna opcional apagada não atrapalha.
export const checkTemplateHeaders = (headers) => {
  const present = new Set((headers || []).map(normalizeHeader));
  const required = TEMPLATE_COLUMNS.filter((col) => col.required);
  const missing = required.filter((col) => !present.has(normalizeHeader(col.header))).map((col) => col.header);
  if (required.length - missing.length < REQUIRED_TO_RECOGNIZE) return { ok: false, missing, message: NOT_TEMPLATE_MESSAGE };
  if (missing.length) return { ok: false, missing, message: missingMessage(missing) };
  return { ok: true, missing: [], message: null };
};

// Campo → cabeçalho REAL do arquivo (string exata), ou null. É o formato que
// parseRow (clientImport.js) recebe. Nada é adivinhado: só a tabela vale.
export const templateMapping = (headers) => {
  const byNorm = new Map();
  (headers || []).forEach((h) => {
    const k = normalizeHeader(h);
    if (k && !byNorm.has(k)) byNorm.set(k, h);
  });
  return Object.fromEntries(TEMPLATE_COLUMNS.map((col) => [col.field, byNorm.get(normalizeHeader(col.header)) ?? null]));
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/importTemplate.test.js 2>&1 | tail -4`
Expected: PASS, `Tests  16 passed (16)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/importTemplate.js src/lib/__tests__/importTemplate.test.js
git commit -m "feat: tabela do modelo de importação e conferência do cabeçalho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Descrição do arquivo do modelo (`buildTemplateSpec`)

**Files:**
- Modify: `src/lib/importTemplate.js` (acrescentar no fim, e um import no topo)
- Modify: `src/lib/__tests__/importTemplate.test.js` (acrescentar no fim, e um import)

- [ ] **Step 1: Escrever os testes que falham**

No topo de `src/lib/__tests__/importTemplate.test.js`, troque o import de `../importTemplate.js` por:

```js
import {
  TEMPLATE_COLUMNS,
  NOT_TEMPLATE_MESSAGE,
  normalizeHeader,
  templateHeaderLabel,
  checkTemplateHeaders,
  templateMapping,
  buildTemplateSpec,
  uniqueSortedNames
} from '../importTemplate.js';
```

E acrescente no fim do arquivo:

```js
describe('uniqueSortedNames', () => {
  it('tira repetido pelo nome normalizado, apara espaço e ordena em pt-BR', () => {
    expect(uniqueSortedNames([{ name: 'Trimestral' }, { name: 'Ágil' }, { name: '  trimestral ' }, { name: 'Anual' }, { name: '' }, null]))
      .toEqual(['Ágil', 'Anual', 'Trimestral']);
  });
});

describe('buildTemplateSpec', () => {
  const NOW = new Date(2026, 8, 24, 15, 30);
  const spec = buildTemplateSpec({
    planos: [{ id: 'p2', name: 'Trimestral' }, { id: 'p1', name: 'Anual' }, { id: 'p3', name: ' trimestral ' }],
    users: [{ id: 'u2', name: 'Bia' }, { id: 'u1', name: 'Ana' }],
    professores: [],
    windowDays: 15,
    tenantId: 'Academia Teste',
    now: NOW
  });
  const col = (field) => spec.columns.find((c) => c.field === field);

  it('nome do arquivo com a academia e o dia', () => {
    expect(spec.fileName).toBe('modelo-stronilead-academia-teste-2026-09-24.xlsx');
  });

  it('a aba Clientes é a primeira', () => {
    expect(spec.sheets).toEqual({ CLIENTES: 'Clientes', AJUDA: 'Como preencher', LISTAS: 'Listas' });
    expect(Object.values(spec.sheets)[0]).toBe('Clientes');
  });

  it('listas sem nome repetido e em ordem alfabética', () => {
    const byTitle = Object.fromEntries(spec.lists.map((l) => [l.title, l]));
    expect(byTitle.Planos).toEqual({ letter: 'A', title: 'Planos', names: ['Anual', 'Trimestral'] });
    expect(byTitle.Equipe.names).toEqual(['Ana', 'Bia']);
    expect(byTitle.Professores.names).toEqual([]);
  });

  it('colunas na ordem da tabela, com letra, rótulo e intervalo até a linha 5001', () => {
    expect(spec.columns.map((c) => c.field)).toEqual(TEMPLATE_COLUMNS.map((c) => c.field));
    expect(spec.columns.slice(0, 3).map((c) => c.letter)).toEqual(['A', 'B', 'C']);
    expect(col('addrCity').letter).toBe('W');
    expect(col('name').label).toBe('Nome *');
    expect(col('cpf').range).toBe('B2:B5001');
  });

  it('texto fica como texto, data como data e valor em reais', () => {
    expect(col('cpf').numFmt).toBe('@');
    expect(col('whatsapp').numFmt).toBe('@');
    expect(col('addrCep').numFmt).toBe('@');
    expect(col('addrNumber').numFmt).toBe('@');
    expect(col('contractStartsAt').numFmt).toBe('dd/mm/yyyy');
    expect(col('contractEndsAt').numFmt).toBe('dd/mm/yyyy');
    expect(col('contractValue').numFmt).toBe('"R$" #,##0.00');
  });

  it('plano e consultor apontam para a aba Listas e só avisam', () => {
    expect(col('planName').validation).toMatchObject({ type: 'list', formulae: ['Listas!$A$2:$A$3'], errorStyle: 'warning', allowBlank: true, showErrorMessage: true });
    expect(col('consultantName').validation).toMatchObject({ type: 'list', formulae: ['Listas!$B$2:$B$3'], errorStyle: 'warning' });
    expect(col('planName').validation.error).toBe('Esse nome não está na lista. Se continuar, ele é acertado na importação.');
  });

  it('lista vazia fica sem validação', () => {
    expect(col('professorName').validation).toBeNull();
  });

  it('situação, sexo e VIP são listas fixas e travadas', () => {
    expect(col('contractSituation').validation).toMatchObject({ type: 'list', formulae: ['"Ativo,Trancado"'], errorStyle: 'stop' });
    expect(col('sexo').validation.formulae).toEqual(['"Masculino,Feminino,Outro"']);
    expect(col('vip').validation.formulae).toEqual(['"Sim,Não"']);
  });

  it('datas travadas entre 1900 e 2100, em número serial do Excel', () => {
    expect(col('contractStartsAt').validation).toMatchObject({ type: 'date', operator: 'between', formulae: [1, 73415], errorStyle: 'stop', error: 'Digite uma data, como 15/03/2026.' });
    expect(col('birthDate').validation.type).toBe('date');
  });

  it('o fim exige data igual ou depois do início da mesma linha', () => {
    expect(col('contractEndsAt').validation).toMatchObject({
      type: 'custom',
      formulae: ['AND(ISNUMBER(F2),OR(E2="",F2>=E2))'],
      errorStyle: 'stop',
      error: 'O fim precisa ser uma data igual ou depois do início, como 15/03/2026.'
    });
  });

  it('valor aceita só número maior ou igual a zero', () => {
    expect(col('contractValue').validation).toMatchObject({ type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], errorStyle: 'stop' });
  });

  it('texto livre fica sem validação', () => {
    expect(col('name').validation).toBeNull();
    expect(col('email').validation).toBeNull();
  });

  it('"Como preencher" traz a academia, o dia e a janela de Vencidos', () => {
    const text = spec.help.lines.map((l) => l.text).join('\n');
    expect(text).toContain('Gerado para Academia Teste em 24/09/2026.');
    expect(text).toContain('venceu há no máximo 15 dias');
    expect(text).not.toMatch(/[—–]/);
  });

  it('o exemplo usa as nove primeiras colunas e o primeiro plano da lista', () => {
    expect(spec.help.example.headers).toEqual(spec.columns.slice(0, 9).map((c) => c.label));
    expect(spec.help.example.rows).toHaveLength(2);
    expect(spec.help.example.rows.every((r) => r.length === 9)).toBe(true);
    expect(spec.help.example.rows[0][3]).toBe('Anual');
    expect(spec.help.example.rows[0][8]).toBe('Ana');
  });

  it('sem academia no claim o arquivo e o texto não quebram', () => {
    const s = buildTemplateSpec({ planos: [{ name: 'Mensal' }], users: [], professores: [], windowDays: 15, tenantId: null, now: NOW });
    expect(s.fileName).toBe('modelo-stronilead-academia-2026-09-24.xlsx');
    expect(s.help.lines[1].text).toBe('Gerado para a academia em 24/09/2026.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/importTemplate.test.js 2>&1 | tail -5`
Expected: FAIL, com `buildTemplateSpec is not a function` (ou `uniqueSortedNames is not a function`).

- [ ] **Step 3: Implementar**

No topo de `src/lib/importTemplate.js`, logo abaixo de `import { normalize } from './globalSearch.js';`, acrescente:

```js
import { addMonths } from './dates.js';
import { normalizeName } from './clientImport.js';
```

E acrescente no fim do arquivo:

```js
// ---------------------------------------------------------------------------
// Descrição do arquivo: o que importTemplateWrite.js transforma em .xlsx
// ---------------------------------------------------------------------------

export const TEMPLATE_SHEETS = { CLIENTES: 'Clientes', AJUDA: 'Como preencher', LISTAS: 'Listas' };

// Última linha com formato e validação na aba Clientes (a 1 é o cabeçalho).
// Fica acima da maior academia: o teto de escala é de 2 a 3 mil clientes.
export const TEMPLATE_LAST_ROW = 5001;

// Listas que saem do cadastro da academia e a coluna de cada uma na aba Listas.
const LISTS = {
  planos: { letter: 'A', title: 'Planos' },
  equipe: { letter: 'B', title: 'Equipe' },
  professores: { letter: 'C', title: 'Professores' }
};

const NUMFMT = { text: '@', list: '@', date: 'dd/mm/yyyy', endDate: 'dd/mm/yyyy', money: '"R$" #,##0.00' };

// Limites da data em número serial do Excel (1 = 01/01/1900, 73415 =
// 31/12/2100). Um Date do JavaScript sai deslocado pelo fuso no ExcelJS.
const EXCEL_DAY_MIN = 1;
const EXCEL_DAY_MAX = 73415;

const ERRORS = {
  date: 'Digite uma data, como 15/03/2026.',
  endDate: 'O fim precisa ser uma data igual ou depois do início, como 15/03/2026.',
  money: 'Digite o valor em número, como 1200,00.',
  fixed: 'Escolha uma opção da lista.',
  loose: 'Esse nome não está na lista. Se continuar, ele é acertado na importação.'
};

// 0 → A, 25 → Z, 26 → AA.
const columnLetter = (i) => (i < 26
  ? String.fromCharCode(65 + i)
  : columnLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

// Nomes para a lista suspensa: sem vazio, sem repetido pelo nome normalizado
// (a mesma chave com que enrichCandidate casa), aparados e em ordem pt-BR.
// Fica o primeiro que aparecer.
export const uniqueSortedNames = (items) => {
  const seen = new Map();
  (items || []).forEach((x) => {
    const name = String(x?.name ?? '').replace(/\s+/g, ' ').trim();
    const key = normalizeName(name);
    if (key && !seen.has(key)) seen.set(key, name);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

// Validação de dados de uma coluna, no formato do ExcelJS, ou null.
function validationOf(col, letter, startLetter, lists) {
  const base = { allowBlank: true, showErrorMessage: true };
  if (col.kind === 'date') {
    return { ...base, type: 'date', operator: 'between', formulae: [EXCEL_DAY_MIN, EXCEL_DAY_MAX], errorStyle: 'stop', error: ERRORS.date };
  }
  if (col.kind === 'endDate') {
    // Referência relativa à linha 2: o Excel desloca para cada linha do intervalo.
    return { ...base, type: 'custom', formulae: [`AND(ISNUMBER(${letter}2),OR(${startLetter}2="",${letter}2>=${startLetter}2))`], errorStyle: 'stop', error: ERRORS.endDate };
  }
  if (col.kind === 'money') {
    return { ...base, type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], errorStyle: 'stop', error: ERRORS.money };
  }
  if (col.kind === 'list' && col.options) {
    return { ...base, type: 'list', formulae: [`"${col.options.join(',')}"`], errorStyle: 'stop', error: ERRORS.fixed };
  }
  if (col.kind === 'list' && col.list) {
    const { letter: listLetter, names } = lists[col.list];
    if (!names.length) return null;
    // Aponta para o intervalo da aba Listas: lista escrita dentro da validação
    // tem limite de 255 caracteres no Excel.
    return { ...base, type: 'list', formulae: [`${TEMPLATE_SHEETS.LISTAS}!$${listLetter}$2:$${listLetter}$${names.length + 1}`], errorStyle: 'warning', error: ERRORS.loose };
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDia = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fileSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'academia';

// Aba "Como preencher": linhas de texto e um exemplo com as nove primeiras
// colunas. O exemplo mora nesta aba de propósito: na aba Clientes ele seria
// importado como aluno.
function helpOf({ tenantId, windowDays, now, lists }) {
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const end = addMonths(start, 6);
  const plan = lists.planos.names[0] || 'Plano Semestral';
  const consultant = lists.equipe.names[0] || '';
  return {
    lines: [
      { text: 'Modelo de importação de clientes do Stronilead', bold: true },
      { text: `Gerado para ${tenantId || 'a academia'} em ${fmtDia(now)}.` },
      { text: '' },
      { text: 'Quem entra na lista', bold: true },
      { text: `Clientes com contrato ativo, trancados e quem venceu há no máximo ${windowDays} dias. Cancelados e vencidos há mais tempo ficam de fora.` },
      { text: 'Uma linha por cliente, com o contrato atual. Quem tem dois contratos ao mesmo tempo entra com o que termina por último, e o outro é lançado depois na ficha.' },
      { text: '' },
      { text: 'Como preencher', bold: true },
      { text: 'As colunas com cabeçalho laranja são obrigatórias. De CPF e WhatsApp, basta um dos dois.' },
      { text: 'Datas no formato dia/mês/ano, como 15/03/2026.' },
      { text: 'O valor é o total do contrato, não a mensalidade. Em branco, vale o valor do plano no Stronilead.' },
      { text: 'Plano, consultor e professor têm lista. Se o nome não estiver nela, pode digitar: o Excel avisa e o nome é acertado na importação.' },
      { text: 'Pare o mouse sobre o cabeçalho de cada coluna para ver o que vai nela.' },
      { text: 'Não mude o nome das colunas nem a ordem das abas. A aba Clientes precisa continuar sendo a primeira.' },
      { text: '' },
      { text: 'Exemplo (não copie para a aba Clientes)', bold: true }
    ],
    example: {
      headers: TEMPLATE_COLUMNS.slice(0, 9).map(templateHeaderLabel),
      rows: [
        ['Maria Souza', '123.456.789-09', '(71) 99999-0000', plan, fmtDia(start), fmtDia(end), '1.200,00', 'Ativo', consultant],
        ['João Pereira', '', '(71) 98888-1234', plan, fmtDia(start), fmtDia(end), '', 'Trancado', '']
      ]
    }
  };
}

// Tudo que importTemplateWrite.js precisa para montar o .xlsx, a partir do
// que a tela de importação já tem carregado. `now` vem de quem chama.
export function buildTemplateSpec({ planos, users, professores, windowDays, tenantId, now }) {
  const sources = { planos, equipe: users, professores };
  const lists = Object.fromEntries(Object.entries(LISTS).map(([id, meta]) => [id, { ...meta, names: uniqueSortedNames(sources[id]) }]));
  const startLetter = columnLetter(TEMPLATE_COLUMNS.findIndex((c) => c.field === 'contractStartsAt'));
  const columns = TEMPLATE_COLUMNS.map((col, i) => {
    const letter = columnLetter(i);
    return {
      ...col,
      letter,
      label: templateHeaderLabel(col),
      numFmt: NUMFMT[col.kind],
      range: `${letter}2:${letter}${TEMPLATE_LAST_ROW}`,
      validation: validationOf(col, letter, startLetter, lists)
    };
  });
  return {
    fileName: `modelo-stronilead-${fileSlug(tenantId)}-${dayKey(now)}.xlsx`,
    sheets: TEMPLATE_SHEETS,
    columns,
    lists: Object.values(lists),
    help: helpOf({ tenantId, windowDays, now, lists })
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/importTemplate.test.js 2>&1 | tail -4`
Expected: PASS, `Tests  32 passed (32)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/importTemplate.js src/lib/__tests__/importTemplate.test.js
git commit -m "feat: descrição do arquivo do modelo de importação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gerador com ExcelJS e volta completa

**Files:**
- Create: `src/lib/importTemplateWrite.js`
- Create: `src/lib/__tests__/importTemplateWrite.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/lib/__tests__/importTemplateWrite.test.js`:

```js
// Volta completa do modelo: o ExcelJS gera, o SheetJS lê pelo mesmo caminho da
// importação (readSpreadsheetFile) e parseRow interpreta. Datas em horário LOCAL.

import { describe, it, expect } from 'vitest';
import ExcelJSmod from 'exceljs';
import { buildTemplateBuffer } from '../importTemplateWrite.js';
import { buildTemplateSpec, checkTemplateHeaders, templateMapping } from '../importTemplate.js';
import { readSpreadsheetFile } from '../spreadsheetRead.js';
import { parseRow } from '../clientImport.js';

const ExcelJS = ExcelJSmod.default ?? ExcelJSmod;
const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 9, 24);

const SPEC = buildTemplateSpec({
  planos: [{ id: 'p1', name: 'Trimestral' }, { id: 'p2', name: 'Anual' }],
  users: [{ id: 'u1', name: 'Bia' }],
  professores: [{ id: 'pr1', name: 'Carlos' }],
  windowDays: 15,
  tenantId: 'academia-teste',
  now: NOW
});

const asFile = (buf) => new File([buf], SPEC.fileName);
const loadWorkbook = async (buf) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
};

describe('buildTemplateBuffer', () => {
  it('abre com Clientes primeiro e Listas oculta', async () => {
    const wb = await loadWorkbook(await buildTemplateBuffer(SPEC));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Clientes', 'Como preencher', 'Listas']);
    expect(wb.getWorksheet('Listas').state).toBe('hidden');
  });

  it('o arquivo vazio passa na conferência e não traz linha de dado', async () => {
    const { headers, rows, sheetName } = await readSpreadsheetFile(asFile(await buildTemplateBuffer(SPEC)));
    expect(sheetName).toBe('Clientes');
    expect(checkTemplateHeaders(headers).ok).toBe(true);
    expect(rows).toEqual([]);
  });

  it('cabeçalho congelado, laranja na obrigatória, cinza na opcional, com nota', async () => {
    const ws = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Clientes');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.getCell('A1').value).toBe('Nome *');
    expect(ws.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFFF6A2B' } });
    expect(ws.getCell('G1').fill).toMatchObject({ fgColor: { argb: 'FFE5E7EB' } });
    expect(ws.getCell('A1').note).toBe('Nome completo do cliente.');
  });

  it('formato de texto, data e valor nas colunas', async () => {
    const ws = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Clientes');
    expect(ws.getCell('B2').numFmt).toBe('@');
    expect(ws.getCell('E2').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell('G2').numFmt).toBe('"R$" #,##0.00');
  });

  it('listas suspensas gravadas até a linha 5001', async () => {
    const ws = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Clientes');
    const dv = ws.dataValidations.model;
    expect(dv.D2).toMatchObject({ type: 'list', formulae: ['Listas!$A$2:$A$3'], errorStyle: 'warning' });
    expect(dv.D5001).toMatchObject({ type: 'list' });
    expect(dv.H2).toMatchObject({ type: 'list', formulae: ['"Ativo,Trancado"'], errorStyle: 'stop' });
    expect(dv.E2).toMatchObject({ type: 'date', operator: 'between' });
    expect(dv.F2).toMatchObject({ type: 'custom' });
    expect(dv.A2).toBeUndefined();
  });

  it('a aba Listas guarda os nomes em ordem', async () => {
    const lists = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Listas');
    expect([lists.getCell('A1').value, lists.getCell('A2').value, lists.getCell('A3').value]).toEqual(['Planos', 'Anual', 'Trimestral']);
    expect(lists.getCell('B2').value).toBe('Bia');
    expect(lists.getCell('C2').value).toBe('Carlos');
  });

  it('a aba Como preencher traz o texto e o exemplo depois dele', async () => {
    const help = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Como preencher');
    expect(help.getCell('A1').value).toBe('Modelo de importação de clientes do Stronilead');
    const headerRow = SPEC.help.lines.length + 1;
    expect(help.getCell(`A${headerRow}`).value).toBe('Nome *');
    expect(help.getCell(`A${headerRow + 1}`).value).toBe('Maria Souza');
    expect(help.getCell(`A${headerRow + 2}`).value).toBe('João Pereira');
  });

  it('preenchido e lido pela importação: CPF com zero, datas e valor voltam certos', async () => {
    const wb = await loadWorkbook(await buildTemplateBuffer(SPEC));
    const ws = wb.getWorksheet('Clientes');
    ws.getCell('A2').value = 'Ana Teste';
    ws.getCell('B2').value = '01234567890';
    ws.getCell('C2').value = '71999990001';
    ws.getCell('D2').value = 'Trimestral';
    // O ExcelJS grava Date pelo dia em UTC; o SheetJS devolve meia-noite local.
    ws.getCell('E2').value = new Date(Date.UTC(2026, 7, 12));
    ws.getCell('F2').value = new Date(Date.UTC(2026, 10, 12));
    ws.getCell('G2').value = 1200.5;
    ws.getCell('H2').value = 'Trancado';
    ws.getCell('I2').value = 'Bia';
    ws.getCell('R2').value = '04567000';
    const { headers, rows } = await readSpreadsheetFile(asFile(await wb.xlsx.writeBuffer()));
    expect(rows).toHaveLength(1);
    const c = parseRow(rows[0], templateMapping(headers), rows[0].__row, NOW);
    expect(c).toMatchObject({
      rowNumber: 2,
      name: 'Ana Teste',
      cpfDigits: '01234567890',
      whatsappDigits: '71999990001',
      planName: 'Trimestral',
      value: 1200.5,
      contractSituation: 'trancado',
      consultantName: 'Bia',
      warnings: []
    });
    expect(c.startsAt).toEqual(D(2026, 8, 12));
    expect(c.endsAt).toEqual(D(2026, 11, 12));
    expect(c.address.cep).toBe('04567000');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/importTemplateWrite.test.js 2>&1 | tail -5`
Expected: FAIL, com `Failed to resolve import "../importTemplateWrite.js"`.

- [ ] **Step 3: Implementar**

Crie `src/lib/importTemplateWrite.js`:

```js
// Único lugar que toca o ExcelJS: transforma a descrição do modelo
// (buildTemplateSpec, em importTemplate.js) no .xlsx. Entra por import()
// dinâmico e mora no pedaço 'exceljs' do build (vite.config.js), então só quem
// clica em "Baixar modelo" no super console baixa a biblioteca. A leitura do
// arquivo preenchido continua com o SheetJS (spreadsheetRead.js).
// Spec: docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md

const loadExcel = async () => {
  const mod = await import('exceljs');
  return mod.default ?? mod;
};

const REQUIRED_FILL = 'FFFF6A2B'; // laranja da marca
const OPTIONAL_FILL = 'FFE5E7EB';
const REQUIRED_FONT = 'FFFFFFFF';
const OPTIONAL_FONT = 'FF1F2937';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function buildTemplateBuffer(spec) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Stronilead';

  // A ordem das abas importa: a importação lê a primeira.
  const ws = wb.addWorksheet(spec.sheets.CLIENTES, { views: [{ state: 'frozen', ySplit: 1 }] });
  const help = wb.addWorksheet(spec.sheets.AJUDA);
  const lists = wb.addWorksheet(spec.sheets.LISTAS, { state: 'hidden' });

  // O formato vai na coluna inteira: o que for digitado depois já nasce texto,
  // data ou dinheiro.
  ws.columns = spec.columns.map((col) => ({ header: col.label, key: col.field, width: col.width, style: { numFmt: col.numFmt } }));
  const head = ws.getRow(1);
  head.height = 22;
  spec.columns.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.font = { bold: true, color: { argb: col.required ? REQUIRED_FONT : OPTIONAL_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.required ? REQUIRED_FILL : OPTIONAL_FILL } };
    cell.alignment = { vertical: 'middle' };
    if (col.note) cell.note = col.note;
    if (col.validation) ws.dataValidations.add(col.range, col.validation);
  });

  spec.lists.forEach(({ letter, title, names }) => {
    const titleCell = lists.getCell(`${letter}1`);
    titleCell.value = title;
    titleCell.font = { bold: true };
    names.forEach((name, i) => { lists.getCell(`${letter}${i + 2}`).value = name; });
    lists.getColumn(letter).width = 32;
  });

  // Texto na coluna A (transborda para as vizinhas vazias) e o exemplo logo
  // abaixo, com uma coluna por campo.
  spec.help.example.headers.forEach((_, i) => { help.getColumn(i + 1).width = 20; });
  let r = 1;
  spec.help.lines.forEach(({ text, bold }) => {
    const cell = help.getCell(`A${r}`);
    cell.value = text;
    if (bold) cell.font = { bold: true };
    r += 1;
  });
  spec.help.example.headers.forEach((label, i) => {
    const cell = help.getRow(r).getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true };
  });
  spec.help.example.rows.forEach((values) => {
    r += 1;
    values.forEach((v, i) => { help.getRow(r).getCell(i + 1).value = v; });
  });

  return wb.xlsx.writeBuffer();
}

export async function downloadTemplate(spec) {
  const buf = await buildTemplateBuffer(spec);
  const blob = new Blob([buf], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = spec.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/importTemplateWrite.test.js 2>&1 | tail -4`
Expected: PASS, `Tests  8 passed (8)`

Se o teste da nota falhar porque `note` volta como objeto (`{ texts: [...] }`), troque a asserção por `expect(JSON.stringify(ws.getCell('A1').note)).toContain('Nome completo do cliente.')`. Em 24/09/2026, com o ExcelJS 4.4.0, ela voltou como texto.

- [ ] **Step 5: Conferir o pedaço no build**

Run: `npm run build 2>&1 | grep -E "exceljs|xlsx|error" | head`
Expected: uma linha `dist/assets/exceljs-<hash>.js` com cerca de 930 kB e nenhuma linha de erro. O aviso de pedaço maior que 500 kB é esperado: ele só baixa no clique.

Run: `grep -l "xl/sharedStrings.xml" dist/assets/*.js`
Expected: um arquivo só, `exceljs-<hash>.js`. Esse texto existe dentro do ExcelJS e em nenhum código do app (nem no SheetJS, conferido em 24/09/2026), então achar ele no `vendor` ou no pedaço de entrada quer dizer que o ExcelJS vazou para lá. (Procurar pela palavra `exceljs` não serve: ela aparece no pedaço do app como o nome do arquivo que o `import()` busca.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/importTemplateWrite.js src/lib/__tests__/importTemplateWrite.test.js
git commit -m "feat: gerador do modelo de importação com ExcelJS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Avisos novos de vigência em `parseRow`

**Files:**
- Modify: `src/lib/clientImport.js:176-221` (`parseRow`)
- Modify: `src/lib/__tests__/clientImport.test.js` (dentro de `describe('parseRow')`, antes do `});` que o fecha, na linha 269)

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/clientImport.test.js`, dentro de `describe('parseRow', ...)`, logo depois do teste `'situação do contrato desconhecida vira aviso'`, acrescente:

```js
  const VIGENCIA = { ...NEXTFIT_MAPPING, contractStartsAt: 'Início', contractEndsAt: 'Fim' };
  const vigRow = (inicio, fim) => ({ __row: 3, 'Nome': 'Ana', 'CPF': '529.982.247-25', 'Início': inicio, 'Fim': fim });

  it('fim antes do início vira aviso e a linha fica sem vigência', () => {
    const c = parseRow(vigRow('12/11/2026', '12/08/2026'), VIGENCIA, 3, NOW);
    expect(c.startsAt).toEqual(D(2026, 11, 12));
    expect(c.endsAt).toBeNull();
    expect(c.warnings).toEqual(['Fim antes do início']);
  });

  it('fim no mesmo dia do início é vigência válida', () => {
    const c = parseRow(vigRow('12/08/2026', '12/08/2026'), VIGENCIA, 3, NOW);
    expect(c.endsAt).toEqual(D(2026, 8, 12));
    expect(c.warnings).toEqual([]);
  });

  it('coluna de início mapeada e vazia, com fim, avisa "Sem data de início"', () => {
    const c = parseRow(vigRow('', '12/11/2026'), VIGENCIA, 3, NOW);
    expect(c.startsAt).toBeNull();
    expect(c.endsAt).toEqual(D(2026, 11, 12));
    expect(c.warnings).toEqual(['Sem data de início']);
  });

  it('sem fim não cobra o início, porque não nasce contrato', () => {
    const c = parseRow(vigRow('', ''), VIGENCIA, 3, NOW);
    expect(c.warnings).toEqual([]);
  });

  it('data de início ilegível vira aviso e o fim continua valendo', () => {
    const c = parseRow(vigRow('ontem', '12/11/2026'), VIGENCIA, 3, NOW);
    expect(c.startsAt).toBeNull();
    expect(c.endsAt).toEqual(D(2026, 11, 12));
    expect(c.warnings).toEqual(['Data de início ilegível']);
  });

  it('fim antes do início deixa a linha como cadastro sem vigência na classificação', () => {
    const c = { ...parseRow(vigRow('12/11/2026', '12/08/2026'), VIGENCIA, 3, NOW), consultant: null, plan: null };
    const cls = classifyCandidate(c, { kind: 'none', lead: null, homonyms: [] }, { scope: 'padrao', now: NOW, windowDays: 15 });
    expect(cls).toMatchObject({ outcome: 'criar', createContract: false, reason: 'Cadastro novo sem vigência' });
  });
```

Confira que `classifyCandidate` já está no import do topo do arquivo de teste. Se não estiver, acrescente-o à lista que vem de `'../clientImport.js'`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js 2>&1 | tail -6`
Expected: FAIL em 4 testes: fim antes do início, sem data de início, início ilegível e a classificação (que ainda recebe o fim e sai "Cadastro novo com contrato"). Os de "mesmo dia" e "sem fim" já passam.

- [ ] **Step 3: Implementar**

Em `src/lib/clientImport.js`, dentro de `parseRow`, troque:

```js
  const endsRaw = get('contractEndsAt');
  const endsAt = parseImportDate(endsRaw, now);
  if (str(endsRaw) && !endsAt) warnings.push('Data de fim ilegível');
  const value = parseValorBRL(get('contractValue'));
```

por:

```js
  const endsRaw = get('contractEndsAt');
  const parsedEnd = parseImportDate(endsRaw, now);
  if (str(endsRaw) && !parsedEnd) warnings.push('Data de fim ilegível');
  const startsRaw = get('contractStartsAt');
  const startsAt = parseImportDate(startsRaw, now);
  // Sem início, o contrato nasce com o início calculado pelo plano
  // (buildImportedContract). Só avisa quando a coluna existe e há fim: sem
  // fim não nasce contrato, e o início não faz falta.
  if (str(startsRaw) && !startsAt) warnings.push('Data de início ilegível');
  else if (mapping?.contractStartsAt && !startsAt && parsedEnd) warnings.push('Sem data de início');
  // Vigência invertida quebraria Renovações e Vencidos: a linha segue como a
  // de quem não tem data de fim (cliente sem contrato, em "sem vigência").
  const inverted = Boolean(startsAt && parsedEnd && parsedEnd.getTime() < startsAt.getTime());
  if (inverted) warnings.push('Fim antes do início');
  const endsAt = inverted ? null : parsedEnd;
  const value = parseValorBRL(get('contractValue'));
```

E, no objeto devolvido por `parseRow`, troque:

```js
    startsAt: parseImportDate(get('contractStartsAt'), now),
```

por:

```js
    startsAt,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js src/lib/__tests__/importTemplate.test.js src/lib/__tests__/importTemplateWrite.test.js 2>&1 | tail -4`
Expected: PASS em tudo. Os testes antigos de `parseRow` continuam verdes porque o mapeamento deles não tem coluna de início.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: avisos de vigência invertida e sem início na importação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Origem única da importação

**Files:**
- Modify: `src/lib/clientImport.js:1-6` (comentário do topo) e o trecho de `sourcePhrase`/`sourceField`, a linha `source:` e a linha `interactionText:` de `buildImportedClientWrites`
- Modify: `src/lib/__tests__/clientImport.test.js` (as linhas com `META`, `'Importação NextFit'`, `'Cadastro importado do NextFit...'` e o teste `'sem preset o texto é "de planilha"...'`)

As linhas de teste citadas abaixo são as de 24/09/2026, antes da Task 5. Depois da Task 5 elas descem umas 40 linhas; ache cada uma pelo texto.

- [ ] **Step 1: Trocar as asserções nos testes (elas passam a falhar)**

Em `src/lib/__tests__/clientImport.test.js`:

Troque:

```js
const META = { importedBy: 'adminUid', importSource: 'nextfit', sourceLabel: 'NextFit', importBatchId: 'b1', now: NOW };
```

por:

```js
const META = { importedBy: 'adminUid', importSource: 'modelo', importBatchId: 'b1', now: NOW };
```

Troque `expect(d.source).toBe('Importação NextFit');` por:

```js
    expect(d.source).toBe('Importação por planilha modelo');
```

Troque `expect(w.interactionText).toBe('Cadastro importado do NextFit. Plano Trimestral, vigência até 12/11/2026.');` por:

```js
    expect(w.interactionText).toBe('Cadastro importado da planilha modelo. Plano Trimestral, vigência até 12/11/2026.');
```

Troque `expect(w.interactionText).toBe('Cadastro importado do NextFit. Sem vigência registrada.');` por:

```js
    expect(w.interactionText).toBe('Cadastro importado da planilha modelo. Sem vigência registrada.');
```

Troque o teste inteiro:

```js
  it('sem preset o texto é "de planilha" e a origem "Importação por planilha"', () => {
    const w = buildImportedClientWrites({ c: VALID, cls: { lead: null, fill: null, createContract: false }, consultant: USERS[0], funnelId: 'f1', importMeta: { ...META, sourceLabel: 'planilha', importSource: 'manual' }, now: NOW });
    expect(w.interactionText).toBe('Cadastro importado de planilha. Sem vigência registrada.');
    expect(w.leadData.source).toBe('Importação por planilha');
  });
```

por:

```js
  it('a origem gravada é a planilha modelo, e começa com "Importação"', () => {
    const w = buildImportedClientWrites({ c: VALID, cls: { lead: null, fill: null, createContract: false }, consultant: USERS[0], funnelId: 'f1', importMeta: META, now: NOW });
    expect(w.leadData.source).toBe(IMPORT_LEAD_SOURCE);
    expect(w.leadData.source.startsWith('Importação')).toBe(true);
    expect(w.leadData.importSource).toBe(IMPORT_SOURCE_ID);
  });
```

E acrescente `IMPORT_LEAD_SOURCE` e `IMPORT_SOURCE_ID` à lista de nomes importados de `'../clientImport.js'` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js 2>&1 | tail -6`
Expected: FAIL nos testes de origem e de texto (`Importação NextFit` recebido no lugar de `Importação por planilha modelo`, ou `IMPORT_LEAD_SOURCE` indefinido).

- [ ] **Step 3: Implementar**

Em `src/lib/clientImport.js`, troque o comentário das linhas 1 a 6:

```js
// Regra pura da IMPORTAÇÃO DE CLIENTES de outros sistemas (NextFit, Pacto,
// Evo, SCA, Tecnofit): normalizadores, linha → candidato, dedupe no arquivo,
// escopo, casamento com a base, classificação e o construtor das escritas.
// Sem React e sem Firestore: o COMO gravar fica em clientImportWrites.js
// (padrão contracts.js / contractsWrites.js).
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md
```

por:

```js
// Regra pura da IMPORTAÇÃO DE CLIENTES pela planilha modelo do Stronilead
// (importTemplate.js): normalizadores, linha → candidato, dedupe no arquivo,
// escopo, casamento com a base, classificação e o construtor das escritas.
// Sem React e sem Firestore: o COMO gravar fica em clientImportWrites.js
// (padrão contracts.js / contractsWrites.js).
// Specs: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md e
// docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md
```

Troque:

```js
// "do NextFit" / "de planilha": a origem sem preset não leva artigo.
const sourcePhrase = (label) => (label === 'planilha' ? 'de planilha' : `do ${label}`);
const sourceField = (label) => (label === 'planilha' ? 'Importação por planilha' : `Importação ${label}`);

export const buildImportInteractionText = ({ sourceLabel, contract }) =>
  `Cadastro importado ${sourcePhrase(sourceLabel)}. ${contract
    ? `Plano ${contract.planName || 'sem nome'}, vigência até ${fmtDia(contract.endsAt)}.`
    : 'Sem vigência registrada.'}`;
```

por:

```js
// Toda importação vem da planilha modelo do Stronilead. Lote antigo guarda
// 'nextfit' ou 'manual' em importSource e continua valendo: os painéis leem só
// a presença das marcas (importBatchId, importSource, importedBy), nunca o valor.
export const IMPORT_SOURCE_ID = 'modelo';
// Começa com "Importação": é o que isImportCreatedLead (operacional/routine.js) procura.
export const IMPORT_LEAD_SOURCE = 'Importação por planilha modelo';

export const buildImportInteractionText = ({ contract }) =>
  `Cadastro importado da planilha modelo. ${contract
    ? `Plano ${contract.planName || 'sem nome'}, vigência até ${fmtDia(contract.endsAt)}.`
    : 'Sem vigência registrada.'}`;
```

Em `buildImportedClientWrites`, troque `source: sourceField(importMeta.sourceLabel),` por:

```js
      source: IMPORT_LEAD_SOURCE,
```

E troque `interactionText: buildImportInteractionText({ sourceLabel: importMeta.sourceLabel, contract }),` por:

```js
    interactionText: buildImportInteractionText({ contract }),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientImport.test.js 2>&1 | tail -4`
Expected: PASS em todos.

Run: `grep -n "sourceLabel\|sourcePhrase\|sourceField" src/lib/clientImport.js`
Expected: nenhuma linha. (Não rode esse grep em `src/lib` inteiro: `appointmentOutcome.js` tem um `sourceLabel` que não tem nada a ver com a importação. A tela ainda usa o `sourceLabel` da importação e muda na Task 7.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientImport.js src/lib/__tests__/clientImport.test.js
git commit -m "refactor: origem única da importação, a planilha modelo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tela da importação só com o modelo

**Files:**
- Modify: `src/views/settings/ImportClientsSection.jsx`

Esta tarefa não tem teste automático de tela (o arquivo não tem teste hoje e a regra toda está nas Tasks 2 a 6). A conferência é lint, build e a revisão do diff contra a lista abaixo.

- [ ] **Step 1: Imports**

Troque:

```js
import { SettingsBtn, PanelNote, EmptyState } from './settingsBits.jsx';
```

por:

```js
import { SettingsBtn, PanelNote } from './settingsBits.jsx';
```

E troque:

```js
import { TARGET_FIELDS, TARGET_GROUP_LABEL, detectPreset, buildMapping, importSourceLabel, IMPORT_PRESETS } from '../../lib/importPresets.js';
import {
  parseRow, dedupeInFile, enrichCandidate, distinctPlanNames, resolveMatch, classifyCandidate,
  buildImportedClientWrites, summarizeOutcomes, buildReportCsv,
  OUTCOME, OUTCOME_LABEL, WRITABLE_OUTCOMES, SCOPE, PLAN_AS_TEXT
} from '../../lib/clientImport.js';
```

por:

```js
import { checkTemplateHeaders, templateMapping, buildTemplateSpec } from '../../lib/importTemplate.js';
import { downloadTemplate } from '../../lib/importTemplateWrite.js';
import {
  parseRow, dedupeInFile, enrichCandidate, distinctPlanNames, resolveMatch, classifyCandidate,
  buildImportedClientWrites, summarizeOutcomes, buildReportCsv, normalizeName,
  OUTCOME, OUTCOME_LABEL, WRITABLE_OUTCOMES, SCOPE, IMPORT_SOURCE_ID
} from '../../lib/clientImport.js';
```

- [ ] **Step 2: Comentário do topo e passos**

Troque:

```js
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
```

por:

```js
// ==========================================
// IMPORTAR CLIENTES: quatro passos, só na sessão assumida do super console.
// Specs: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md e
// docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md
//
// Arquivo (só o modelo do Stronilead) → Ajustes → Revisão (ensaio completo,
// sem gravar) → Importar. Toda regra mora em src/lib/clientImport.js e em
// src/lib/importTemplate.js; aqui é só estado, handlers e tela. Nada de
// useEffect: leitura do arquivo, geração do modelo, consultas e gravação rodam
// nos handlers dos botões, e o que é derivado sai de useMemo.
// ==========================================

const STEPS = ['Arquivo', 'Ajustes', 'Revisão', 'Importar'];
```

- [ ] **Step 3: Estado e derivados**

Troque:

```js
  const [file, setFile] = useState(null);            // { name, headers, rows, preset }
```

por:

```js
  const [file, setFile] = useState(null);            // { name, headers, rows }
```

Troque:

```js
  const [sourceId, setSourceId] = useState('manual');
```

por:

```js
  const [generating, setGenerating] = useState(false);
```

Apague estas linhas (a origem agora é única):

```js
  // Origem escolhida no passo 2 (pré-preenchida pelo preset detectado). Vale
  // para o carimbo importSource e para o texto da timeline: a rodada 2
  // (relatório de contratos, sem preset) continua registrada como NextFit.
  const sourcePreset = IMPORT_PRESETS.find((p) => p.id === sourceId) || null;
  const sourceLabel = importSourceLabel(sourcePreset);
```

Troque:

```js
  // Nomes de plano da planilha, para a tabela de mapeamento de planos. Lê só
  // a coluna mapeada: não precisa do parse completo da linha.
  const planNames = useMemo(
    () => (file && mapping.planName ? distinctPlanNames(file.rows.map((r) => ({ planName: r[mapping.planName] }))) : []),
    [file, mapping.planName]
  );
```

por:

```js
  // Nomes de plano da planilha que não batem com nenhum plano do catálogo, pela
  // mesma chave de enrichCandidate. Quem escolheu da lista do modelo casa
  // sozinho e não aparece aqui. Lê só a coluna do plano.
  const planNames = useMemo(() => {
    if (!file || !mapping.planName) return [];
    const known = new Set((planos || []).map((p) => normalizeName(p.name)));
    return distinctPlanNames(file.rows.map((r) => ({ planName: r[mapping.planName] }))).filter((p) => !known.has(p.key));
  }, [file, mapping.planName, planos]);
```

Troque o comentário de `resetAll`:

```js
  // Mantém consultor padrão e escopo de propósito: a rodada 2 (contratos) usa os mesmos.
```

por:

```js
  // Mantém consultor padrão e escopo de propósito: um segundo arquivo da mesma academia usa os mesmos.
```

- [ ] **Step 4: Subir o arquivo e baixar o modelo**

Troque a função `handleFile` inteira por:

```js
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const { headers, rows } = await readSpreadsheetFile(f);
      const check = checkTemplateHeaders(headers);
      if (!check.ok) { toast.error(check.message); return; }
      if (!rows.length) { toast.error('O modelo chegou sem nenhum cliente na aba Clientes.'); return; }
      setFile({ name: f.name, headers, rows });
      setMapping(templateMapping(headers));
      setPlanMap({}); setReview(null); setDecisions({}); setReport(null);
      setStep(2);
      toast.success(`Modelo do Stronilead: ${rows.length} ${rows.length === 1 ? 'linha' : 'linhas'}.`);
    } catch (err) {
      console.error('readSpreadsheetFile', err);
      toast.error('Não consegui ler o arquivo. Suba o modelo do Stronilead, em .xlsx.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  // O modelo sai com os planos, a equipe e os professores que a tela já tem.
  const downloadTemplateNow = async () => {
    setGenerating(true);
    try {
      const spec = buildTemplateSpec({ planos, users: consultants, professores, windowDays, tenantId: appUser?.tenantId, now: new Date() });
      await downloadTemplate(spec);
    } catch (err) {
      console.error('downloadTemplate', err);
      toast.error('Não deu para gerar o modelo. Tente de novo.');
    } finally {
      setGenerating(false);
    }
  };
```

- [ ] **Step 5: Revisão e gravação**

Em `runReview`, apague a linha:

```js
    if (!mapping.name) { toast.warning('Mapeie ao menos a coluna do nome.'); return; }
```

Em `runImportNow`, troque:

```js
      const importMeta = {
        importedBy: appUser?.authUid || appUser?.id || null,
        importSource: sourceId,
        sourceLabel,
        importBatchId: newBatchId(),
        now: review.now
      };
```

por:

```js
      const importMeta = {
        importedBy: appUser?.authUid || appUser?.id || null,
        importSource: IMPORT_SOURCE_ID,
        importBatchId: newBatchId(),
        now: review.now
      };
```

Apague estas duas linhas (mapeamento manual e grupos de campos):

```js
  const setMappingField = (field, header) => setMapping((m) => ({ ...m, [field]: header === NONE ? null : header }));
```

```js
  const groupedFields = ['pessoa', 'endereco', 'contrato'].map((g) => ({ id: g, label: TARGET_GROUP_LABEL[g], fields: TARGET_FIELDS.filter((f) => f.group === g) }));
```

- [ ] **Step 6: Cabeçalho da seção e passo 1**

Troque:

```jsx
        hint="Traga os alunos ativos de outro sistema de gestão. Quem já existe é promovido, não duplicado."
```

por:

```jsx
        hint="Traga os alunos ativos da academia pelo modelo de planilha do Stronilead. Quem já existe é promovido, não duplicado."
```

Troque o bloco `{step === 1 && ( ... )}` inteiro por:

```jsx
      {step === 1 && (
        <SettingsPanel icon={<FileSpreadsheet size={16} />} iconTone="brand" title="1. Arquivo" hint="O modelo do Stronilead preenchido pela academia.">
          <div className="px-5 pb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12.5px] text-muted-foreground min-w-0 flex-1">
              {(planos || []).length
                ? 'Baixe o modelo, mande para a academia e importe aqui quando ele voltar preenchido.'
                : 'Cadastre os planos da academia antes de baixar o modelo.'}
            </div>
            <SettingsBtn
              kind="secondary"
              disabled={generating || !(planos || []).length}
              onClick={downloadTemplateNow}
              icon={generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            >
              {generating ? 'Gerando...' : 'Baixar modelo'}
            </SettingsBtn>
          </div>
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
              <div className="text-[12px] text-muted-foreground mt-1">Só o modelo do Stronilead é aceito.</div>
            </button>
          </div>
          <PanelNote>O modelo sai com os planos, a equipe e os professores desta academia. Cadastre o que faltar antes de baixar, senão a lista suspensa sai incompleta.</PanelNote>
        </SettingsPanel>
      )}
```

- [ ] **Step 7: Passo 2, Ajustes**

Troque o bloco `{step === 2 && file && ( ... )}` inteiro (do `<SettingsPanel ... title="2. Mapeamento"` até o `</>` que fecha o passo) por:

```jsx
      {step === 2 && file && (
        <>
          <SettingsPanel icon={<FileSpreadsheet size={16} />} iconTone="brand" title="2. Ajustes" hint={`${file.name} · ${file.rows.length} ${file.rows.length === 1 ? 'linha' : 'linhas'}`}>
            <div className="px-5 pb-2 text-[11.5px] font-semibold">Planos fora do catálogo</div>
            {planNames.length === 0
              ? <div className="px-5 pb-5 text-[12.5px] text-muted-foreground">Todos os planos da planilha estão no catálogo.</div>
              : (
                <div className="px-5 pb-4 flex flex-col gap-2">
                  <div className="text-[11.5px] text-muted-foreground">Nomes que a academia digitou fora da lista. Escolha o plano certo ou deixe como texto, e o contrato nasce sem plano.</div>
                  {planNames.map((p) => (
                    <div key={p.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{p.label}</div><div className="text-[11px] text-muted-foreground num">{p.count} {p.count === 1 ? 'linha' : 'linhas'}</div></div>
                      <span className="text-muted-foreground text-[12px]">→</span>
                      <Select value={planMap[p.key] || AUTO} onValueChange={(v) => setPlanMapKey(p.key, v)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO}>Manter como texto</SelectItem>
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
                <span className="text-[11px] text-muted-foreground">Recebe as linhas sem consultor ou com consultor que não bate com ninguém da equipe.</span>
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
              <SettingsBtn kind="primary" disabled={busy || !defaultConsultant} onClick={runReview} icon={busy ? <Loader2 size={14} className="animate-spin" /> : null}>
                {busy ? 'Consultando a base…' : 'Revisar antes de gravar'}
              </SettingsBtn>
            </div>
          </SettingsPanel>
        </>
      )}
```

A constante `PLAN_AS_TEXT` sai da tela: para um nome que não casa, "Automático" e "Manter como texto" dão o mesmo resultado em `enrichCandidate` (plano nulo, nome guardado como texto).

- [ ] **Step 8: Passo 3**

Troque:

```jsx
                {summary.avisos > 0 && <div className="text-muted-foreground">{summary.avisos} linha(s) com aviso (CPF inválido, data ilegível, sem data histórica). Aparecem no relatório.</div>}
```

por:

```jsx
                {summary.avisos > 0 && <div className="text-muted-foreground">{summary.avisos} linha(s) com aviso (CPF inválido, data ilegível, fim antes do início, sem data de início, sem data histórica). Aparecem no relatório.</div>}
```

E troque o texto do botão `Voltar ao mapeamento` por `Voltar aos ajustes`.

- [ ] **Step 9: Conferir**

Run: `grep -n "importPresets\|sourceId\|sourceLabel\|TARGET_\|groupedFields\|setMappingField\|PLAN_AS_TEXT\|EmptyState\|Mapeamento\|mapeamento" src/views/settings/ImportClientsSection.jsx`
Expected: nenhuma linha.

Run: `npx eslint src/views/settings/ImportClientsSection.jsx src/lib/importTemplate.js src/lib/importTemplateWrite.js src/lib/clientImport.js`
Expected: sem erros e sem avisos.

Run: `npx vitest run 2>&1 | tail -3`
Expected: todos verdes (o `importPresets.test.js` ainda existe e passa até a Task 8).

- [ ] **Step 10: Commit**

```bash
git add src/views/settings/ImportClientsSection.jsx
git commit -m "feat: importação aceita só o modelo do Stronilead, com Baixar modelo no super console

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tirar o NextFit e deixar uma planilha de exemplo do modelo

**Files:**
- Delete: `src/lib/importPresets.js`, `src/lib/__tests__/importPresets.test.js`
- Delete: `docs/superpowers/fixtures/2026-09-03-nextfit-cadastro-exemplo.csv`, `docs/superpowers/fixtures/2026-09-03-nextfit-contratos-exemplo.csv`
- Create: `docs/superpowers/fixtures/2026-09-24-modelo-exemplo.csv`

- [ ] **Step 1: Conferir que ninguém mais usa os presets**

Run: `grep -rn "importPresets" src api scripts`
Expected: só `src/lib/__tests__/importPresets.test.js`.

- [ ] **Step 2: Apagar**

```bash
git rm src/lib/importPresets.js src/lib/__tests__/importPresets.test.js docs/superpowers/fixtures/2026-09-03-nextfit-cadastro-exemplo.csv docs/superpowers/fixtures/2026-09-03-nextfit-contratos-exemplo.csv
```

- [ ] **Step 3: Criar a planilha de exemplo**

Crie `docs/superpowers/fixtures/2026-09-24-modelo-exemplo.csv` (separado por ponto e vírgula, como a exportação que o Excel em português gera):

```csv
Nome *;CPF *;WhatsApp *;Plano *;Início da vigência *;Fim da vigência *;Valor total do contrato;Situação do contrato;Consultor;Professor;E-mail;Data de nascimento;Sexo;Cliente desde;Objetivo;VIP;RG;CEP;Endereço;Número;Complemento;Bairro;Cidade
Ana Teste Modelo;529.982.247-25;(71) 99999-0101;Trimestral;01/08/2026;01/11/2026;450,00;Ativo;TROCAR_CONSULTOR;;ana.modelo@example.com;05/03/1985;Feminino;10/01/2024;Emagrecer;Não;;40000-000;Rua A;10;;Centro;Salvador
Bruno Teste Modelo;111.444.777-35;(71) 99999-0102;Plano Antigo 2019;15/07/2026;15/01/2027;900,00;Ativo;;;;;;;;;;;;;;;
Carla Teste Modelo;987.654.321-00;(71) 99999-0103;Trimestral;01/07/2026;01/10/2026;;Trancado;TROCAR_CONSULTOR;;;;;;;;;;;;;;
Diego Teste Modelo;456.123.789-55;(71) 99999-0104;Trimestral;15/06/2026;15/09/2026;450,00;Ativo;TROCAR_CONSULTOR;;;;;;;;;;;;;;
Elisa Teste Modelo;321.654.987-91;TROCAR_WHATSAPP_DE_UM_LEAD;Trimestral;01/09/2026;01/12/2026;450,00;Ativo;;;;;;;;;;;;;;;
```

Antes do teste de verdade (Task 10), quem testa troca `TROCAR_CONSULTOR` pelo nome de alguém da equipe da academia de teste, `TROCAR_WHATSAPP_DE_UM_LEAD` pelo WhatsApp de um lead que já existe nela, e `Trimestral` por um plano do catálogo dela. A linha do Diego precisa ter vencido dentro da janela de Vencidos no dia do teste: se já passou de 30/09/2026, ajuste o fim para uns dez dias antes do teste.

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run 2>&1 | tail -3`
Expected: todos verdes. O total é 2231 menos os testes de `importPresets.test.js`, mais os novos das Tasks 2 a 6.

Run: `npx eslint . 2>&1 | tail -3`
Expected: 0 erros (o aviso da linha de base pode continuar).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/fixtures/2026-09-24-modelo-exemplo.csv
git commit -m "refactor: tira o reconhecimento do NextFit e deixa uma planilha de exemplo do modelo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentação

**Files:**
- Modify: `CLAUDE.md` (seção nova, logo antes de `## Ponte com o Stronizap`)
- Modify: `docs/superpowers/specs/2026-09-03-importacao-clientes-design.md` (aviso logo abaixo de `data: 2026-09-03`)

- [ ] **Step 1: Seção no CLAUDE.md**

Em `CLAUDE.md`, logo antes da linha `## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09`, acrescente:

```markdown
## Importação de clientes (super console)

Traz a base de uma academia que chega ao Stronilead. Só aparece na sessão assumida, em Configurações → Importar clientes. As regras de gravação estão em `docs/superpowers/specs/2026-09-03-importacao-clientes-design.md` e o modelo, em `docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md`.

- **Um formato só: o modelo do Stronilead.** O botão "Baixar modelo" gera um `.xlsx` com os planos, a equipe e os professores da academia em lista suspensa. A importação recusa qualquer outro arquivo: com menos de 4 das 6 colunas obrigatórias o arquivo "não é o modelo", e com 4 ou 5 ela diz qual coluna falta.
- **`TEMPLATE_COLUMNS` (`src/lib/importTemplate.js`) é a fonte única do cabeçalho.** O arquivo gerado, a conferência do cabeçalho e o mapeamento que `parseRow` recebe saem dela. Coluna nova entra ali e em `parseRow`, nunca só num dos lados, senão o `importTemplate.test.js` quebra.
- **A aba Clientes tem que ser a primeira**, porque `readSpreadsheetFile` lê a primeira aba. O exemplo mora na aba "Como preencher" para não ser importado como aluno.
- **O ExcelJS só entra por `import()` em `src/lib/importTemplateWrite.js`** e fica no pedaço `exceljs` do build. São 930 kB, e no `vendor` iriam para todo mundo. A leitura continua com o SheetJS, no pedaço `xlsx`.
- **Data de validação vai como número serial do Excel** (1 e 73415). Um `Date` do JavaScript sai deslocado pelo fuso no ExcelJS.
- **Importado não conta como lead novo, matrícula nem venda** nos três painéis (`isImportedContract`, `isImportedEnrollment`, `isImportCreatedLead`). Os painéis leem só a presença das marcas (`importBatchId`, `importSource`, `importedBy`), então lote antigo com `importSource: 'nextfit'` continua valendo.
```

- [ ] **Step 2: Aviso na spec antiga**

Em `docs/superpowers/specs/2026-09-03-importacao-clientes-design.md`, logo abaixo da linha `data: 2026-09-03`, acrescente uma linha em branco e:

```markdown
> A entrada desta importação mudou em 2026-09-24: o modelo de planilha do Stronilead é o único formato aceito, e o reconhecimento do NextFit, o mapeamento manual de colunas e a rodada dupla saíram. Ver `2026-09-24-modelo-planilha-importacao-design.md`. As regras de gravação abaixo continuam valendo.
```

- [ ] **Step 3: Conferir travessões nos textos novos**

Run: `grep -n "—\|–" docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md src/lib/importTemplate.js src/lib/importTemplateWrite.js`
Expected: nenhuma linha.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-03-importacao-clientes-design.md
git commit -m "docs: importação de clientes pelo modelo do Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Testes, lint e build**

Run: `npx vitest run 2>&1 | tail -3`
Expected: todos verdes.

Run: `npx eslint . 2>&1 | tail -3`
Expected: 0 erros.

Run: `npm run build 2>&1 | grep -E "exceljs|error"`
Expected: a linha do pedaço `exceljs-<hash>.js` e nenhum erro.

Run: `grep -l "xl/sharedStrings.xml" dist/assets/*.js`
Expected: um arquivo só, `exceljs-<hash>.js`.

- [ ] **Step 2: Gerar um modelo de verdade para abrir nos programas**

Crie um teste temporário, fora do commit, em `src/lib/__tests__/tmp-gerar-modelo.test.js`:

```js
import { it } from 'vitest';
import fs from 'fs';
import { buildTemplateSpec } from '../importTemplate.js';
import { buildTemplateBuffer } from '../importTemplateWrite.js';

it('gera o modelo de exemplo', async () => {
  const spec = buildTemplateSpec({
    planos: [{ name: 'Mensal' }, { name: 'Trimestral' }, { name: 'Anual' }],
    users: [{ name: 'Bia' }, { name: 'Carlos' }],
    professores: [{ name: 'Duda' }],
    windowDays: 15,
    tenantId: 'academia-teste',
    now: new Date()
  });
  fs.writeFileSync(`${process.env.OUT_DIR}/${spec.fileName}`, Buffer.from(await buildTemplateBuffer(spec)));
});
```

Run: `OUT_DIR=<pasta de scratchpad da sessão> npx vitest run src/lib/__tests__/tmp-gerar-modelo.test.js`
Depois: `rm src/lib/__tests__/tmp-gerar-modelo.test.js` e confira com `git status` que ele não ficou no repositório.

Mande o `.xlsx` gerado para o Johnny com `SendUserFile`, para ele abrir no Excel e no Google Planilhas.

- [ ] **Step 3: Checklist de verdade, com o Johnny (antes do merge)**

Não dá para rodar sem o login dele. Passe esta lista:

1. Abrir o arquivo do Step 2 no Excel, no Google Planilhas e no LibreOffice. Conferir se a lista suspensa aparece em Plano, Consultor, Professor, Situação, Sexo e VIP; se o CPF digitado com zero na frente fica com o zero; se a coluna de data recusa texto; se o fim antes do início é recusado; e se as notas aparecem no cabeçalho.
2. Numa academia de teste, na sessão assumida, clicar em Baixar modelo e ver o arquivo sair com os planos e a equipe dela.
3. Preencher com as cinco linhas de `docs/superpowers/fixtures/2026-09-24-modelo-exemplo.csv` (com as trocas indicadas na Task 8) e importar. A revisão deve mostrar: Bruno com "Plano Antigo 2019" em Planos fora do catálogo e o consultor padrão; Carla trancada; Diego vencido dentro da janela; Elisa promovida, por ser um lead que já existe.
4. Conferir Clientes, Renovações e Vencidos. Conferir que CRM, Operacional e Gerencial do mês não mudaram.
5. Importar o mesmo arquivo de novo: tudo em "Sem alteração".
6. Subir uma exportação do NextFit, ou qualquer outra planilha: recusada com "Esse arquivo não é o modelo do Stronilead...".

- [ ] **Step 4: Abrir o PR (só com o aval do Johnny)**

O PR vai para a `main` do `crm-stronix`. O merge é do Johnny, depois do checklist do Step 3.
