# Visitante, entrega 1: a base — Plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para seguir o plano tarefa por tarefa. Os passos usam caixa de marcar (`- [ ]`).

**Objetivo:** a equipe configura os tipos de freepass, lança o freepass pela aba Contratos e enxerga o Visitante na ficha, com a etiqueta, a cor e o cartão do freepass.

**Arquitetura:** a regra mora num módulo puro novo, `src/lib/visitante.js` (tipos, andamento, quem é Visitante, resumo no lead, textos). A gravação fica em `src/lib/freepassWrites.js`, num lote só com a interação da linha do tempo e o resumo no lead (`logInteractions` ganha um gancho para gravar o documento do freepass no mesmo lote). O fim pela matrícula e pela perda sai da leitura, então nenhum caminho de matrícula ou de perda muda.

**Stack:** React 19 + Vite + Tailwind v4 + shadcn/ui, Firestore (SDK do navegador), Vitest (node e jsdom; os testes de tela usam `createRoot` e `act`, sem Testing Library).

**Spec:** `docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md` (entrega 1 da parte 4).

---

## Antes de começar

- Rode `git rev-list --count HEAD..origin/main`. Se não der 0, traga a main antes (`git merge origin/main`).
- Rode `npm ci` na worktree e confira que o `package-lock.json` não mudou (`git status`).
- Linha de base: `npm run lint && npm test && npm run build`. Anote quantos testes passam.

## Mapa dos arquivos

| Arquivo | O quê |
|---|---|
| Criar `src/lib/visitante.js` | regra pura: tipos, andamento, quem é Visitante, resumo no lead, textos |
| Criar `src/lib/__tests__/visitante.test.js` | testes da regra |
| Criar `src/lib/freepassWrites.js` | lançar e encerrar, num lote só |
| Criar `src/lib/__tests__/freepassWrites.test.js` | o lote grava o que deve |
| Criar `src/lib/__tests__/freepassRules.test.js` | a regra do Firestore da coleção nova |
| Criar `src/hooks/useLeadFreepasses.js` | os freepass da pessoa, ao vivo, com o portão de ociosidade |
| Criar `src/views/settings/FreepassTypesPanel.jsx` | painel "Tipos de freepass" em Configurações → Agendamento |
| Criar `src/modals/FreepassLaunchModal.jsx` | a janela de lançar |
| Criar `src/components/profile/contracts/FreepassCard.jsx` | o cartão do freepass na aba Contratos |
| Modificar `src/lib/interactions.js` | `logInteractions` aceita `extra(batch)` |
| Modificar `src/lib/firebase.js` | `FREEPASS_PATH` |
| Modificar `firestore.rules` | bloco de `stronix_freepass` |
| Modificar `src/lib/acesso.js` | `ACTIONS.FREEPASS_LANCAR` |
| Modificar `src/lib/timeline.js` | a interação `freepass` cai em Agendamentos |
| Modificar `src/App.jsx` e `src/contexts/GeneralConfigContext.jsx` | lê `freepassTypes` da configuração |
| Modificar `src/views/settings/SchedulingSection.jsx` e `SettingsView.jsx` | monta o painel novo |
| Modificar `src/components/ui/Btn.jsx` | `kind="visit"` (verde-água) |
| Modificar `src/components/profile/contracts/ContractsTab.jsx` | "Lançar freepass" e o cartão |
| Modificar `src/views/LeadProfileView.jsx` | etiqueta Visitante, a janela e o encerrar |
| Modificar `CLAUDE.md` | seção "Visitante e freepass" |

---

### Tarefa 1: Mockups e a escolha do Johnny

Regra do projeto: tela nova começa por 2 ou 3 mockups. O código das tarefas 7, 9, 10 e 11 segue a opção A abaixo, que é a recomendada. Se o Johnny escolher outra, mude as classes e a disposição nessas tarefas. A lógica, as gravações e os testes não mudam.

**Arquivos:** criar `docs/superpowers/specs/mockups/2026-11-26-visitante-a.html`, `-b.html` e `-c.html`.

- [ ] **Passo 1: Montar os três mockups** com a skill `frontend-design`. Cada HTML tem botões de estado no topo e `location.hash` para abrir um estado direto:
  1. o cabeçalho da ficha com "Lead" e "Visitante · faltam 3 dias", e "Inativo" e "Visitante · 1 de 2 aulas";
  2. a aba Contratos do lead sem contrato, com o "Lançar freepass";
  3. a aba Contratos com o cartão do freepass correndo (por dias, com régua; por aulas, com "0 de 2 aulas agendadas") e o "Encerrar freepass";
  4. a janela de lançar, com os tipos agrupados por modalidade, o início (por dias) e a frase de confirmação;
  5. o painel "Tipos de freepass" em Configurações → Agendamento.

  - **A (recomendada):** verde-água (`teal`), etiqueta em pílula ao lado do estado; cartão do freepass acima do vazio de contrato; janela com cartões de tipo.
  - **B:** verde-água com a etiqueta em contorno e o freepass dentro do cartão vazio de contrato.
  - **C:** rosa (`pink`) no lugar do verde-água, com a disposição da A.

- [ ] **Passo 2: Mostrar ao Johnny** pela memória `mostrar-mockup-ao-johnny`: servidor estático pelo `preview_start` numa porta livre (5231 ou 5233; o `.claude/launch.json` fica fora do git), uma aba por mockup e o painel de preview no mesmo turno em que pede a escolha. Avise que o servidor cai no fim do turno.

- [ ] **Passo 3: Anotar a escolha no topo de cada arquivo e commitar.**

```bash
git add docs/superpowers/specs/mockups/2026-11-26-visitante-*.html
git commit -m "docs: mockups do Visitante (entrega 1)"
```

---

### Tarefa 2: Tipos de freepass (regra pura)

**Arquivos:**
- Criar: `src/lib/visitante.js`
- Teste: `src/lib/__tests__/visitante.test.js`

- [ ] **Passo 1: Escrever os testes que falham**

```js
// src/lib/__tests__/visitante.test.js
import { describe, it, expect } from 'vitest';
import {
  normalizeFreepassTypes, freepassTypeProblem, saveFreepassType, freepassQuantityText
} from '../visitante.js';

const tipo = (over = {}) => ({ id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: false, ativo: true, ...over });

describe('normalizeFreepassTypes', () => {
  it('devolve lista vazia para o que não é lista', () => {
    expect(normalizeFreepassTypes(undefined)).toEqual([]);
    expect(normalizeFreepassTypes({})).toEqual([]);
  });
  it('descarta tipo sem id, nome, modalidade, tipo de contagem ou quantidade válida', () => {
    const out = normalizeFreepassTypes([
      tipo(), tipo({ id: '' }), tipo({ id: 'x', name: '  ' }), tipo({ id: 'y', modalidadeId: '' }),
      tipo({ id: 'z', kind: 'semanas' }), tipo({ id: 'w', quantity: 0 }), tipo({ id: 'v', quantity: 100 })
    ]);
    expect(out.map(t => t.id)).toEqual(['t1']);
  });
  it('apara o nome, arredonda a quantidade e lê ativo ausente como ativo', () => {
    const [t] = normalizeFreepassTypes([{ id: 'a', name: ' Muscu 7 ', modalidadeId: 'm', kind: 'dias', quantity: '7.9' }]);
    expect(t).toEqual({ id: 'a', name: 'Muscu 7', modalidadeId: 'm', kind: 'dias', quantity: 7, padrao: false, ativo: true });
  });
  it('deixa um padrão só por modalidade, o primeiro ativo', () => {
    const out = normalizeFreepassTypes([
      tipo({ id: 'a', padrao: true, ativo: false }), tipo({ id: 'b', padrao: true }), tipo({ id: 'c', padrao: true }),
      tipo({ id: 'd', modalidadeId: 'm2', padrao: true })
    ]);
    expect(out.filter(t => t.padrao).map(t => t.id)).toEqual(['b', 'd']);
  });
});

describe('freepassTypeProblem', () => {
  const types = [tipo()];
  it('aceita um tipo completo', () => {
    expect(freepassTypeProblem(tipo({ id: 't2', name: 'Pilates 1 aula', quantity: 1 }), types)).toBeNull();
  });
  it('pede nome, modalidade, contagem e quantidade, nessa ordem', () => {
    expect(freepassTypeProblem(tipo({ id: 'n', name: '' }), types).field).toBe('name');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', modalidadeId: '' }), types).field).toBe('modalidadeId');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', kind: '' }), types).field).toBe('kind');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', quantity: 0 }), types).field).toBe('quantity');
  });
  it('recusa nome repetido sem contar maiúscula, mas aceita o próprio tipo', () => {
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'pilates 2 AULAS' }), types).message).toBe('Já existe um freepass com esse nome.');
    expect(freepassTypeProblem(tipo(), types)).toBeNull();
  });
});

describe('saveFreepassType', () => {
  it('acrescenta o tipo novo e troca o que já existe', () => {
    const a = saveFreepassType([tipo()], tipo({ id: 't2', name: 'Outro' }));
    expect(a.map(t => t.id)).toEqual(['t1', 't2']);
    const b = saveFreepassType(a, tipo({ name: 'Pilates 3 aulas', quantity: 3 }));
    expect(b[0].quantity).toBe(3);
    expect(b).toHaveLength(2);
  });
  it('o padrão novo tira o padrão dos outros da mesma modalidade', () => {
    const lista = [tipo({ padrao: true }), tipo({ id: 'm2', modalidadeId: 'm2', padrao: true })];
    const out = saveFreepassType(lista, tipo({ id: 't9', name: 'Novo', padrao: true }));
    expect(out.find(t => t.id === 't1').padrao).toBe(false);
    expect(out.find(t => t.id === 'm2').padrao).toBe(true);
    expect(out.find(t => t.id === 't9').padrao).toBe(true);
  });
});

describe('freepassQuantityText', () => {
  it('escreve no singular e no plural', () => {
    expect(freepassQuantityText({ kind: 'dias', quantity: 1 })).toBe('1 dia');
    expect(freepassQuantityText({ kind: 'dias', quantity: 7 })).toBe('7 dias');
    expect(freepassQuantityText({ kind: 'aulas', quantity: 1 })).toBe('1 aula');
    expect(freepassQuantityText({ kind: 'aulas', quantity: 2 })).toBe('2 aulas');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/visitante.test.js`
Esperado: FAIL, "Failed to resolve import ../visitante.js".

- [ ] **Passo 3: Escrever o mínimo**

```js
// src/lib/visitante.js
// Visitante e freepass (spec docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md).
// Regra pura e sem pacote: a api/ vai ler este arquivo na entrega 2 (cartão do
// Stronizap e agendamento pela ponte). O nome não é freepass.js porque no APFS,
// que não diferencia maiúscula, ele colidiria com o freePass.js que já existe.
import { addDays, calendarDaysBetween, getSafeDateOrNull, startOfLocalDay } from './dates.js';

export const FREEPASS_KINDS = Object.freeze({ DIAS: 'dias', AULAS: 'aulas' });
export const FREEPASS_STATUS = Object.freeze({ CORRENDO: 'correndo', ENCERRADO: 'encerrado' });
export const FREEPASS_MAX = 99;

const kindOf = (k) => (k === FREEPASS_KINDS.DIAS || k === FREEPASS_KINDS.AULAS ? k : null);
const qtyOf = (n) => {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) && q >= 1 && q <= FREEPASS_MAX ? q : null;
};
const fold = (s) => String(s || '').trim().toLocaleLowerCase('pt-BR');
const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Os tipos que o gestor cadastra em Configurações → Agendamento, gravados em
// stronix_config/general.freepassTypes. Descarta o que não fecha e deixa um
// padrão só por modalidade (o primeiro ativo), que é o que a ponte do Stronizap
// usa na entrega 2.
export function normalizeFreepassTypes(raw) {
  if (!Array.isArray(raw)) return [];
  const padroes = new Set();
  const out = [];
  for (const t of raw) {
    const id = typeof t?.id === 'string' ? t.id : '';
    const name = typeof t?.name === 'string' ? t.name.trim() : '';
    const modalidadeId = typeof t?.modalidadeId === 'string' ? t.modalidadeId : '';
    const kind = kindOf(t?.kind);
    const quantity = qtyOf(t?.quantity);
    if (!id || !name || !modalidadeId || !kind || !quantity) continue;
    const ativo = t.ativo !== false;
    const padrao = Boolean(t.padrao) && ativo && !padroes.has(modalidadeId);
    if (padrao) padroes.add(modalidadeId);
    out.push({ id, name, modalidadeId, kind, quantity, padrao, ativo });
  }
  return out;
}

// O que falta no formulário do tipo, um problema por vez, na ordem dos campos.
export function freepassTypeProblem(draft, types) {
  const name = String(draft?.name || '').trim();
  if (!name) return { field: 'name', message: 'Dê um nome ao freepass.' };
  if ((types || []).some(t => t.id !== draft.id && fold(t.name) === fold(name))) {
    return { field: 'name', message: 'Já existe um freepass com esse nome.' };
  }
  if (!draft?.modalidadeId) return { field: 'modalidadeId', message: 'Escolha a modalidade.' };
  if (!kindOf(draft?.kind)) return { field: 'kind', message: 'Diga se vale por dias ou por aulas.' };
  if (!qtyOf(draft?.quantity)) return { field: 'quantity', message: 'A quantidade vai de 1 a 99.' };
  return null;
}

// A lista nova depois de salvar um tipo: troca pelo id ou acrescenta no fim. O
// padrão novo tira o padrão dos outros tipos da mesma modalidade.
export function saveFreepassType(types, draft) {
  const clean = {
    id: draft.id, name: String(draft.name).trim(), modalidadeId: draft.modalidadeId,
    kind: draft.kind, quantity: qtyOf(draft.quantity), padrao: Boolean(draft.padrao), ativo: draft.ativo !== false
  };
  const base = (types || []).map(t => (
    clean.padrao && t.id !== clean.id && t.modalidadeId === clean.modalidadeId ? { ...t, padrao: false } : t
  ));
  const i = base.findIndex(t => t.id === clean.id);
  if (i === -1) return [...base, clean];
  const out = base.slice();
  out[i] = clean;
  return out;
}

export function freepassQuantityText({ kind, quantity }) {
  const n = Number(quantity) || 0;
  if (kind === FREEPASS_KINDS.DIAS) return `${n} ${n === 1 ? 'dia' : 'dias'}`;
  return `${n} ${n === 1 ? 'aula' : 'aulas'}`;
}
```

As importações de `dates.js` e o `ddmm` são usados nas tarefas 3 e 4. O lint vai reclamar deles até lá; as três tarefas entram no mesmo PR, então siga sem apagar.

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/visitante.test.js`
Esperado: PASS.

- [ ] **Passo 5: Commitar**

```bash
git add src/lib/visitante.js src/lib/__tests__/visitante.test.js
git commit -m "feat: tipos de freepass (regra pura)"
```

---

### Tarefa 3: Quem é Visitante, o andamento e o resumo no lead

**Arquivos:**
- Modificar: `src/lib/visitante.js`
- Teste: `src/lib/__tests__/visitante.test.js`

O documento do freepass e o resumo no lead são lidos na mesma forma: `{ id, kind, total, typeName, modalidadeName, startsAt, endsAt, aulas, status, contractAtStart }`. O fim é `endsAt` nos dois tipos: por dias, o lançamento grava o último dia; por aulas, ele fica null até a entrega 2 gravar o dia da última aula.

- [ ] **Passo 1: Escrever os testes que falham** (acrescentar ao arquivo; junte os nomes novos ao `import` do topo)

```js
import {
  isFreepassRunning, activeFreepassesOf, freepassSummaryPatch, visitorOf,
  freepassShortText, freepassLongText, FREEPASS_SUMMARY_EMPTY
} from '../visitante.js';

const dia = (s) => new Date(`${s}T12:00:00`);
const fpDias = (over = {}) => ({
  id: 'f1', kind: 'dias', total: 7, typeName: 'Muscu 7 dias', modalidadeName: 'Musculação',
  startsAt: dia('2026-11-20'), endsAt: dia('2026-11-26'), aulas: 0, status: 'correndo', contractAtStart: null, ...over
});
const fpAulas = (over = {}) => ({
  id: 'f2', kind: 'aulas', total: 2, typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates',
  startsAt: dia('2026-11-20'), endsAt: null, aulas: 1, status: 'correndo', contractAtStart: null, ...over
});

describe('isFreepassRunning', () => {
  it('por dias, vale até o fim do último dia', () => {
    expect(isFreepassRunning(fpDias(), new Date('2026-11-26T23:59:00'))).toBe(true);
    expect(isFreepassRunning(fpDias(), new Date('2026-11-27T00:01:00'))).toBe(false);
  });
  it('por aulas sem fim marcado continua correndo', () => {
    expect(isFreepassRunning(fpAulas(), dia('2027-03-01'))).toBe(true);
  });
  it('encerrado à mão não corre', () => {
    expect(isFreepassRunning(fpDias({ status: 'encerrado' }), dia('2026-11-21'))).toBe(false);
  });
});

describe('activeFreepassesOf', () => {
  const lead = { status: 'Novo', currentContractId: null };
  it('deixa de fora o lead em Perda', () => {
    expect(activeFreepassesOf({ ...lead, status: 'Perda' }, [fpDias()], dia('2026-11-21'))).toEqual([]);
  });
  it('deixa de fora o freepass de antes de um contrato novo', () => {
    expect(activeFreepassesOf({ ...lead, currentContractId: 'c9' }, [fpDias()], dia('2026-11-21'))).toEqual([]);
  });
  it('o ex-aluno continua Visitante enquanto o contrato atual é o do lançamento', () => {
    const ex = { status: 'Venda', currentContractId: 'c1' };
    expect(activeFreepassesOf(ex, [fpDias({ contractAtStart: 'c1' })], dia('2026-11-21'))).toHaveLength(1);
  });
  it('lê campo ausente como null', () => {
    expect(activeFreepassesOf({ status: 'Novo' }, [fpDias({ contractAtStart: undefined })], dia('2026-11-21'))).toHaveLength(1);
  });
});

describe('freepassSummaryPatch', () => {
  it('sem freepass correndo, limpa o resumo inteiro', () => {
    expect(freepassSummaryPatch([], dia('2026-11-21'))).toEqual(FREEPASS_SUMMARY_EMPTY);
  });
  it('com dois correndo, fica o que termina primeiro, e o por aulas sem fim vai por último', () => {
    const p = freepassSummaryPatch([fpAulas(), fpDias()], dia('2026-11-21'));
    expect(p.freepassId).toBe('f1');
    expect(p.freepassKind).toBe('dias');
    expect(p.freepassTotal).toBe(7);
    expect(p.freepassContractAtStart).toBeNull();
  });
});

describe('visitorOf', () => {
  const now = dia('2026-11-23');
  const lead = { status: 'Novo', currentContractId: null, ...freepassSummaryPatch([fpDias()], now) };
  it('lê o resumo do lead', () => {
    const v = visitorOf(lead, now);
    expect(v.id).toBe('f1');
    expect(v.shortText).toBe('faltam 3 dias');
  });
  it('some sem resumo, na Perda, com contrato novo e depois do fim', () => {
    expect(visitorOf({ status: 'Novo' }, now)).toBeNull();
    expect(visitorOf({ ...lead, status: 'Perda' }, now)).toBeNull();
    expect(visitorOf({ ...lead, currentContractId: 'c1' }, now)).toBeNull();
    expect(visitorOf(lead, dia('2026-11-27'))).toBeNull();
  });
});

describe('textos do andamento', () => {
  it('por dias', () => {
    expect(freepassShortText(fpDias(), dia('2026-11-26'))).toBe('termina hoje');
    expect(freepassShortText(fpDias(), dia('2026-11-25'))).toBe('falta 1 dia');
    expect(freepassLongText(fpDias(), dia('2026-11-23'))).toBe('Faltam 3 dias, até 26/11');
    expect(freepassLongText(fpDias(), dia('2026-11-26'))).toBe('Termina hoje, 26/11');
  });
  it('por dias, antes de começar', () => {
    expect(freepassShortText(fpDias(), dia('2026-11-18'))).toBe('começa em 20/11');
    expect(freepassLongText(fpDias(), dia('2026-11-18'))).toBe('Começa em 20/11 e vai até 26/11');
  });
  it('por aulas', () => {
    expect(freepassShortText(fpAulas(), dia('2026-11-23'))).toBe('1 de 2 aulas');
    expect(freepassLongText(fpAulas({ aulas: 0 }), dia('2026-11-23'))).toBe('0 de 2 aulas agendadas');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/visitante.test.js`
Esperado: FAIL, as funções novas não existem.

- [ ] **Passo 3: Escrever o mínimo** (acrescentar a `src/lib/visitante.js`)

```js
const endDayOf = (fp) => startOfLocalDay(fp?.endsAt);
const nul = (v) => (v === undefined ? null : v);

// Corre enquanto não foi encerrado à mão e o último dia não passou. Por aulas
// sem o fim marcado (a entrega 2 grava o dia da última aula), corre sempre.
export function isFreepassRunning(fp, now = new Date()) {
  if (!fp || fp.status !== FREEPASS_STATUS.CORRENDO) return false;
  const end = endDayOf(fp);
  return !end || calendarDaysBetween(now, end) >= 0;
}

// Os freepass que fazem da pessoa um Visitante agora. A perda e a matrícula
// não gravam nada no freepass: o lead em Perda não é Visitante, e um contrato
// atual diferente do que a pessoa tinha no lançamento quer dizer que houve
// matrícula ou renovação. Assim todo caminho que matricula ou marca perda
// encerra o freepass sem mexer em nenhum deles. Limite aceito: o lead
// reativado da Perda dentro do prazo volta a aparecer como Visitante.
export function activeFreepassesOf(lead, freepasses, now = new Date()) {
  if (!lead || lead.status === 'Perda') return [];
  const contract = lead.currentContractId || null;
  return (freepasses || []).filter(fp => (fp.contractAtStart || null) === contract && isFreepassRunning(fp, now));
}

export const FREEPASS_SUMMARY_EMPTY = Object.freeze({
  freepassId: null, freepassKind: null, freepassTotal: null, freepassTypeName: null,
  freepassModalidadeName: null, freepassStartsAt: null, freepassEndsAt: null,
  freepassAulas: null, freepassStatus: null, freepassContractAtStart: null
});

// O resumo que vai para o lead, para as listas e o cabeçalho saberem quem é
// Visitante sem ler a coleção. Com mais de um correndo, o que termina
// primeiro; o por aulas sem fim marcado fica por último.
export function freepassSummaryPatch(freepasses, now = new Date()) {
  const running = (freepasses || []).filter(fp => isFreepassRunning(fp, now));
  if (!running.length) return { ...FREEPASS_SUMMARY_EMPTY };
  const endMs = (fp) => endDayOf(fp)?.getTime() ?? Infinity;
  const fp = running.slice().sort((a, b) => endMs(a) - endMs(b))[0];
  return {
    freepassId: fp.id, freepassKind: fp.kind, freepassTotal: fp.total, freepassTypeName: nul(fp.typeName),
    freepassModalidadeName: nul(fp.modalidadeName), freepassStartsAt: nul(fp.startsAt), freepassEndsAt: nul(fp.endsAt),
    freepassAulas: fp.aulas ?? 0, freepassStatus: fp.status, freepassContractAtStart: fp.contractAtStart || null
  };
}

const summaryOf = (lead) => ({
  id: lead.freepassId, kind: lead.freepassKind, total: lead.freepassTotal, typeName: lead.freepassTypeName,
  modalidadeName: lead.freepassModalidadeName, startsAt: lead.freepassStartsAt, endsAt: lead.freepassEndsAt,
  aulas: lead.freepassAulas, status: lead.freepassStatus, contractAtStart: lead.freepassContractAtStart
});

// Quem é Visitante agora, pelo resumo do lead. null quando não é.
export function visitorOf(lead, now = new Date()) {
  if (!lead?.freepassId) return null;
  const fp = summaryOf(lead);
  if (!activeFreepassesOf(lead, [fp], now).length) return null;
  return { ...fp, shortText: freepassShortText(fp, now), longText: freepassLongText(fp, now) };
}

// O andamento para a etiqueta: "faltam 3 dias", "termina hoje", "1 de 2 aulas".
export function freepassShortText(fp, now = new Date()) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return `${fp.aulas ?? 0} de ${fp.total} aulas`;
  const start = startOfLocalDay(fp.startsAt);
  if (start && calendarDaysBetween(now, start) > 0) return `começa em ${ddmm(start)}`;
  const d = calendarDaysBetween(now, endDayOf(fp));
  if (d === 0) return 'termina hoje';
  return d === 1 ? 'falta 1 dia' : `faltam ${d} dias`;
}

// O andamento para o cartão da aba Contratos.
export function freepassLongText(fp, now = new Date()) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return `${fp.aulas ?? 0} de ${fp.total} aulas agendadas`;
  const start = startOfLocalDay(fp.startsAt);
  const end = endDayOf(fp);
  if (start && calendarDaysBetween(now, start) > 0) return `Começa em ${ddmm(start)} e vai até ${ddmm(end)}`;
  const d = calendarDaysBetween(now, end);
  if (d === 0) return `Termina hoje, ${ddmm(end)}`;
  return `${d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`}, até ${ddmm(end)}`;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/visitante.test.js`
Esperado: PASS.

- [ ] **Passo 5: Commitar**

```bash
git add src/lib/visitante.js src/lib/__tests__/visitante.test.js
git commit -m "feat: quem é Visitante, andamento e resumo do freepass no lead"
```

---

### Tarefa 4: Lançar e encerrar (montadores puros)

**Arquivos:**
- Modificar: `src/lib/visitante.js`
- Teste: `src/lib/__tests__/visitante.test.js`

- [ ] **Passo 1: Escrever os testes que falham** (acrescentar; junte os nomes ao `import`)

```js
import {
  launchCheck, buildFreepassDoc, freepassLaunchText, freepassEndText, launchStartRange, FREEPASS_INTERACTION_TYPE
} from '../visitante.js';

describe('launchCheck', () => {
  const tipoP = { id: 't1', modalidadeId: 'm1' };
  const ja = [{ modalidadeId: 'm1', status: 'encerrado' }];
  it('libera a primeira vez na modalidade', () => {
    expect(launchCheck({ type: tipoP, freepasses: [{ modalidadeId: 'm2' }], modalidadeName: 'Pilates', gestor: false })).toBeNull();
  });
  it('barra o consultor na mesma modalidade, mesmo com o outro encerrado', () => {
    expect(launchCheck({ type: tipoP, freepasses: ja, modalidadeName: 'Pilates', gestor: false }))
      .toEqual({ block: 'Essa pessoa já teve um freepass de Pilates. Só o gestor libera outro.' });
  });
  it('pede confirmação ao gestor', () => {
    expect(launchCheck({ type: tipoP, freepasses: ja, modalidadeName: 'Pilates', gestor: true }))
      .toEqual({ confirm: 'Essa pessoa já teve um freepass de Pilates. Lançar outro mesmo assim?' });
  });
});

describe('launchStartRange', () => {
  it('vai de 7 dias atrás a 30 dias à frente', () => {
    const { min, max } = launchStartRange(dia('2026-11-26'));
    expect(min.getDate()).toBe(19);
    expect(max.getMonth()).toBe(11);
    expect(max.getDate()).toBe(26);
  });
});

describe('buildFreepassDoc', () => {
  const lead = { id: 'L1', consultantId: 'u1', consultantName: 'Ana', currentContractId: undefined };
  const user = { id: 'u2', name: 'Bruno', authUid: 'a2' };
  it('por dias grava o último dia, início + (N-1)', () => {
    const d = buildFreepassDoc({
      lead, appUser: user, via: 'contratos', modalidadeName: 'Musculação', startsAt: dia('2026-11-20'),
      type: { id: 't', name: 'Muscu 7 dias', modalidadeId: 'm', kind: 'dias', quantity: 7 }
    });
    expect(d.startsAt.getDate()).toBe(20);
    expect(d.startsAt.getHours()).toBe(0);
    expect(d.endsAt.getDate()).toBe(26);
    expect(d).toMatchObject({
      leadId: 'L1', typeId: 't', typeName: 'Muscu 7 dias', modalidadeId: 'm', modalidadeName: 'Musculação',
      kind: 'dias', total: 7, aulas: 0, status: 'correndo', contractAtStart: null,
      consultantId: 'u1', consultantName: 'Ana', createdById: 'u2', createdByName: 'Bruno', createdByAuthUid: 'a2', via: 'contratos'
    });
  });
  it('por aulas nasce sem fim', () => {
    const d = buildFreepassDoc({
      lead, appUser: user, via: 'contratos', modalidadeName: 'Pilates', startsAt: dia('2026-11-20'),
      type: { id: 't', name: 'Pilates 2 aulas', modalidadeId: 'm', kind: 'aulas', quantity: 2 }
    });
    expect(d.endsAt).toBeNull();
  });
});

describe('textos da linha do tempo', () => {
  it('lançamento e encerramento', () => {
    expect(freepassLaunchText({ typeName: 'Muscu 7 dias', modalidadeName: 'Musculação', kind: 'dias', total: 7, startsAt: dia('2026-11-20'), endsAt: dia('2026-11-26') }))
      .toBe('Freepass lançado: Muscu 7 dias (Musculação), de 20/11 a 26/11.');
    expect(freepassLaunchText({ typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', kind: 'aulas', total: 2 }))
      .toBe('Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas para agendar.');
    expect(freepassEndText({ typeName: 'Pilates 2 aulas' })).toBe('Freepass encerrado: Pilates 2 aulas.');
    expect(FREEPASS_INTERACTION_TYPE).toBe('freepass');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/visitante.test.js`
Esperado: FAIL nos quatro `describe` novos.

- [ ] **Passo 3: Escrever o mínimo** (acrescentar a `src/lib/visitante.js`)

```js
export const FREEPASS_INTERACTION_TYPE = 'freepass';

// Um freepass por modalidade (decisão do Johnny, 26/11/2026). Conta qualquer
// freepass da pessoa na modalidade, correndo ou encerrado. O gestor libera
// com uma confirmação.
export function launchCheck({ type, freepasses, modalidadeName, gestor }) {
  const repeated = (freepasses || []).some(fp => fp.modalidadeId === type?.modalidadeId);
  if (!repeated) return null;
  const why = `Essa pessoa já teve um freepass de ${modalidadeName}.`;
  return gestor ? { confirm: `${why} Lançar outro mesmo assim?` } : { block: `${why} Só o gestor libera outro.` };
}

// O início que a janela aceita: de 7 dias atrás (lançamento atrasado) a 30 dias
// à frente.
export function launchStartRange(now = new Date()) {
  const today = startOfLocalDay(now);
  return { min: addDays(today, -7), max: addDays(today, 30) };
}

// O documento de stronix_freepass, sem a hora do servidor (quem grava põe o
// createdAt). Por aulas, o início é o dia do lançamento e o fim fica null até
// a entrega 2 gravar o dia da última aula.
export function buildFreepassDoc({ lead, type, modalidadeName, startsAt, appUser, via }) {
  const start = startOfLocalDay(getSafeDateOrNull(startsAt) || new Date());
  return {
    leadId: lead.id,
    typeId: type.id, typeName: type.name,
    modalidadeId: type.modalidadeId, modalidadeName: modalidadeName || null,
    kind: type.kind, total: type.quantity,
    startsAt: start,
    endsAt: type.kind === FREEPASS_KINDS.DIAS ? addDays(start, type.quantity - 1) : null,
    aulas: 0,
    status: FREEPASS_STATUS.CORRENDO,
    contractAtStart: lead.currentContractId || null,
    consultantId: lead.consultantId || null, consultantName: lead.consultantName || null,
    createdById: appUser?.id || null, createdByName: appUser?.name || null, createdByAuthUid: appUser?.authUid || null,
    via
  };
}

export function freepassLaunchText(fp) {
  const head = `Freepass lançado: ${fp.typeName} (${fp.modalidadeName})`;
  if (fp.kind === FREEPASS_KINDS.AULAS) return `${head}, ${freepassQuantityText({ kind: fp.kind, quantity: fp.total })} para agendar.`;
  return `${head}, de ${ddmm(getSafeDateOrNull(fp.startsAt))} a ${ddmm(getSafeDateOrNull(fp.endsAt))}.`;
}

export const freepassEndText = (fp) => `Freepass encerrado: ${fp.typeName}.`;
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/visitante.test.js && npx eslint src/lib/visitante.js`
Esperado: PASS e lint limpo.

- [ ] **Passo 5: Commitar**

```bash
git add src/lib/visitante.js src/lib/__tests__/visitante.test.js
git commit -m "feat: montadores de lançar e encerrar o freepass"
```

---

### Tarefa 5: Gravar (lote, caminho, regra, ação e linha do tempo)

**Arquivos:**
- Modificar: `src/lib/interactions.js:35-74`
- Modificar: `src/lib/firebase.js` (depois de `AULAS_PATH`)
- Criar: `src/lib/freepassWrites.js`
- Teste: `src/lib/__tests__/freepassWrites.test.js`
- Modificar: `firestore.rules` (depois do bloco de `stronix_aulas`)
- Teste: `src/lib/__tests__/freepassRules.test.js`
- Modificar: `src/lib/acesso.js` (`ACTIONS`)
- Modificar: `src/lib/timeline.js` (`classifyInteraction`, linha ~304)

- [ ] **Passo 1: Escrever os testes que falham**

```js
// src/lib/__tests__/freepassWrites.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
vi.mock('../firebase.js', () => ({ appId: 'acad', FREEPASS_PATH: 'stronix_freepass', INTERACTIONS_PATH: 'stronix_interactions', LEADS_PATH: 'stronix_leads' }));
vi.mock('firebase/firestore', () => {
  let n = 0;
  return {
    collection: (...p) => ({ path: p.slice(1).join('/') }),
    doc: (col, ...rest) => {
      const id = rest.length ? rest[rest.length - 1] : `auto${++n}`;
      const base = rest.length > 1 ? rest.slice(0, -1).join('/') : col.path;
      return { id, path: `${base}/${id}` };
    },
    serverTimestamp: () => 'TS',
    increment: (k) => ({ inc: k }),
    writeBatch: () => ({
      set: (ref, data, opts) => calls.push(['set', ref.path, data, opts]),
      update: (ref, data) => calls.push(['update', ref.path, data]),
      commit: async () => calls.push(['commit'])
    })
  };
});

const { writeFreepassLaunch, writeFreepassEnd } = await import('../freepassWrites.js');

const lead = { id: 'L1', name: 'Rafa', status: 'Novo', consultantId: 'u1', consultantName: 'Ana', consultantAuthUid: 'a1' };
const user = { id: 'u2', name: 'Bruno', authUid: 'a2' };
const tipo = { id: 't1', name: 'Muscu 7 dias', modalidadeId: 'm1', kind: 'dias', quantity: 7 };

beforeEach(() => { calls.length = 0; });

describe('writeFreepassLaunch', () => {
  it('grava o freepass, a interação e o resumo num commit só', async () => {
    const id = await writeFreepassLaunch({
      db: {}, lead, appUser: user, type: tipo, modalidadeName: 'Musculação',
      startsAt: new Date('2026-11-26T12:00:00'), existing: [], now: new Date('2026-11-26T12:00:00')
    });
    expect(calls.filter(c => c[0] === 'commit')).toHaveLength(1);
    const fp = calls.find(c => c[1].includes('stronix_freepass'));
    expect(fp[0]).toBe('set');
    expect(fp[2]).toMatchObject({ leadId: 'L1', status: 'correndo', createdAt: 'TS' });
    const inter = calls.find(c => c[1].includes('stronix_interactions'));
    expect(inter[2]).toMatchObject({ type: 'freepass', freepassId: id, text: 'Freepass lançado: Muscu 7 dias (Musculação), de 26/11 a 02/12.' });
    const leadSet = calls.find(c => c[1].includes('stronix_leads'));
    expect(leadSet[2]).toMatchObject({ freepassId: id, freepassKind: 'dias', freepassStatus: 'correndo' });
  });
});

describe('writeFreepassEnd', () => {
  it('encerra o freepass e passa o resumo para o próximo que ainda corre', async () => {
    const outro = { id: 'f2', kind: 'aulas', total: 2, status: 'correndo', endsAt: null, startsAt: new Date('2026-11-20'), typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', aulas: 0, contractAtStart: null };
    const fim = { id: 'f1', typeName: 'Muscu 7 dias' };
    await writeFreepassEnd({ db: {}, lead, appUser: user, freepass: fim, existing: [fim, outro], now: new Date('2026-11-26T12:00:00') });
    const up = calls.find(c => c[0] === 'update');
    expect(up[1]).toContain('stronix_freepass/f1');
    expect(up[2]).toMatchObject({ status: 'encerrado', endedAt: 'TS', endedById: 'u2', endedByName: 'Bruno' });
    const leadSet = calls.find(c => c[1].includes('stronix_leads'));
    expect(leadSet[2].freepassId).toBe('f2');
    const inter = calls.find(c => c[1].includes('stronix_interactions'));
    expect(inter[2].text).toBe('Freepass encerrado: Muscu 7 dias.');
  });
});
```

Antes de rodar, confira como `interactions.js` monta o `doc` do lead (`doc(db, 'artifacts', appId, ..., LEADS_PATH, lead.id)`, com vários segmentos) e o da interação (`doc(collection(...))`): o `doc` falso acima cobre as duas formas. Se o `getInteractionSecurityFields` de `leads.js` importar algo que quebre em node, mocke `../leads.js` com `{ getInteractionSecurityFields: () => ({}) }`.

```js
// src/lib/__tests__/freepassRules.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8');
const bloco = (() => {
  const i = rules.indexOf('match /artifacts/{appId}/public/data/stronix_freepass/{id}');
  return i === -1 ? '' : rules.slice(i, rules.indexOf('\n    }', i));
})();

describe('regra de stronix_freepass', () => {
  it('existe', () => { expect(bloco).not.toBe(''); });
  it('lê quem é da academia e o professor não grava', () => {
    expect(bloco).toMatch(/allow read: if inTenant\(appId\) && tenantActive\(appId\);/);
    expect(bloco).toMatch(/allow create: if inTenant\(appId\) && tenantActive\(appId\)\s*&& !isProfessor\(appId\);/);
    expect(bloco).toMatch(/allow update: if inTenant\(appId\) && tenantActive\(appId\)\s*&& !isProfessor\(appId\);/);
    expect(bloco).toMatch(/allow delete: if false;/);
  });
});
```

Acrescente ao `src/lib/__tests__/visitante.test.js`:

```js
import { classifyInteraction } from '../timeline.js';
describe('linha do tempo', () => {
  it('o freepass cai em Agendamentos', () => {
    expect(classifyInteraction({ type: 'freepass', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas para agendar.' })).toBe('appointment');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/freepassWrites.test.js src/lib/__tests__/freepassRules.test.js src/lib/__tests__/visitante.test.js`
Esperado: FAIL (módulo `freepassWrites.js` não existe, bloco não existe, o freepass cai em `system`).

- [ ] **Passo 3: `logInteractions` aceita um gancho no lote** (`src/lib/interactions.js`)

Troque a assinatura:

```js
// extra (opcional): (batch) => void, para gravar outro documento no MESMO lote,
// como o freepass (src/lib/freepassWrites.js). Tudo grava ou nada grava.
export async function logInteractions(db, lead, appUser, interactionPayloads, leadPatch = null, extra = null) {
```

e, logo antes de `await batch.commit();`:

```js
  if (extra) extra(batch);
```

- [ ] **Passo 4: O caminho da coleção** (`src/lib/firebase.js`, depois de `export const AULAS_PATH = 'stronix_aulas';`)

```js
// Freepass das aulas experimentais (spec docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md).
// 1 doc por freepass, ligado à pessoa por leadId.
export const FREEPASS_PATH = 'stronix_freepass';
```

- [ ] **Passo 5: As gravações** (`src/lib/freepassWrites.js`)

```js
// Lançar e encerrar o freepass. Cada um grava, num lote só, o documento do
// freepass, a interação da linha do tempo e o resumo no lead (logInteractions
// com o gancho extra). `existing` são os freepass da pessoa que ainda fazem
// dela Visitante (activeFreepassesOf), para o resumo sair certo com mais de um.
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { appId, FREEPASS_PATH } from './firebase.js';
import { logInteractions } from './interactions.js';
import {
  buildFreepassDoc, freepassSummaryPatch, freepassLaunchText, freepassEndText,
  FREEPASS_STATUS, FREEPASS_INTERACTION_TYPE
} from './visitante.js';

const freepassCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', FREEPASS_PATH);

export async function writeFreepassLaunch({ db, lead, appUser, type, modalidadeName, startsAt, existing = [], via = 'contratos', now = new Date() }) {
  const ref = doc(freepassCol(db));
  const data = buildFreepassDoc({ lead, type, modalidadeName, startsAt, appUser, via });
  await logInteractions(
    db, lead, appUser,
    [{ type: FREEPASS_INTERACTION_TYPE, text: freepassLaunchText(data), freepassId: ref.id }],
    freepassSummaryPatch([...existing, { id: ref.id, ...data }], now),
    (batch) => batch.set(ref, { ...data, createdAt: serverTimestamp() })
  );
  return ref.id;
}

export async function writeFreepassEnd({ db, lead, appUser, freepass, existing = [], now = new Date() }) {
  const ref = doc(freepassCol(db), freepass.id);
  await logInteractions(
    db, lead, appUser,
    [{ type: FREEPASS_INTERACTION_TYPE, text: freepassEndText(freepass), freepassId: freepass.id }],
    freepassSummaryPatch(existing.filter(fp => fp.id !== freepass.id), now),
    (batch) => batch.update(ref, {
      status: FREEPASS_STATUS.ENCERRADO, endedAt: serverTimestamp(),
      endedById: appUser?.id || null, endedByName: appUser?.name || null
    })
  );
}
```

- [ ] **Passo 6: A regra do Firestore** (`firestore.rules`, logo depois do bloco de `stronix_aulas`)

```
    // Freepass das aulas experimentais (spec
    // docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md). Lê
    // quem é da academia. Consultor e gestor lançam e encerram, inclusive no
    // lead de outro consultor, como o contrato. O professor não lança nem
    // encerra. Não se apaga: o histórico conta nos painéis. O
    // src/lib/__tests__/freepassRules.test.js lê este bloco.
    match /artifacts/{appId}/public/data/stronix_freepass/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId)
        && !isProfessor(appId);
      allow update: if inTenant(appId) && tenantActive(appId)
        && !isProfessor(appId);
      allow delete: if false;
    }
```

Os campos do resumo no lead não pedem regra nova: consultor e gestor já gravam qualquer campo do lead, e o professor não lança freepass nesta entrega.

- [ ] **Passo 7: A ação** (`src/lib/acesso.js`, dentro de `ACTIONS`, depois de `CONTRATO_EDITAR`)

```js
  // Lançar e encerrar freepass (spec 2026-11-26). Gestor e consultor; o
  // professor não.
  FREEPASS_LANCAR: 'freepass.lancar',
```

Gestor e consultor recebem a ação pelo `TODAS`; o professor fica com a lista vazia.

- [ ] **Passo 8: A linha do tempo** (`src/lib/timeline.js`, em `classifyInteraction`, logo depois da linha do `ZAP_SIGNAL_TYPE`)

```js
  // Lançamento e encerramento do freepass: bucket de Agendamentos, decidido
  // pelo type, porque o texto cita "aulas" e o nome do tipo é livre.
  if (i.type === 'freepass') return 'appointment';
```

- [ ] **Passo 9: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/freepassWrites.test.js src/lib/__tests__/freepassRules.test.js src/lib/__tests__/visitante.test.js src/lib/__tests__/acessoActionsRef.test.js src/lib/__tests__/professorRules.test.js`
Esperado: PASS.

- [ ] **Passo 10: Commitar**

```bash
git add src/lib/interactions.js src/lib/firebase.js src/lib/freepassWrites.js firestore.rules src/lib/acesso.js src/lib/timeline.js src/lib/__tests__/freepassWrites.test.js src/lib/__tests__/freepassRules.test.js src/lib/__tests__/visitante.test.js
git commit -m "feat: gravar o freepass num lote só, com regra e linha do tempo"
```

---

### Tarefa 6: Ler os tipos da configuração

**Arquivos:**
- Modificar: `src/App.jsx` (estado perto da linha 356, `generalConfigValue` perto da 380, `onSnapshot` do config perto da 874, `<SettingsView` perto da 1968)
- Modificar: `src/contexts/GeneralConfigContext.jsx`

- [ ] **Passo 1: Estado e leitura** (`src/App.jsx`)

Junto de `const [trialClassOptions, setTrialClassOptions] = useState([1, 2, 3]);`:

```js
  // Tipos de freepass (spec 2026-11-26), em stronix_config/general.freepassTypes.
  const [freepassTypes, setFreepassTypes] = useState([]);
```

No `onSnapshot` do config, depois de `setTrialClassOptions(...)`:

```js
      setFreepassTypes(normalizeFreepassTypes(data?.freepassTypes));
```

No callback de erro do mesmo `onSnapshot`, acrescente `setFreepassTypes([]);`. Importe `normalizeFreepassTypes` de `./lib/visitante.js`.

No `generalConfigValue`, acrescente `freepassTypes` no objeto e na lista de dependências do `useMemo`. No `<SettingsView ... />`, passe `freepassTypes={freepassTypes}`.

- [ ] **Passo 2: O padrão do contexto** (`src/contexts/GeneralConfigContext.jsx`): acrescente `freepassTypes: []` nos dois objetos padrão.

- [ ] **Passo 3: Rodar a suíte e o build**

Rode: `npm test && npm run build`
Esperado: PASS e build sem erro.

- [ ] **Passo 4: Commitar**

```bash
git add src/App.jsx src/contexts/GeneralConfigContext.jsx
git commit -m "feat: o app lê os tipos de freepass da configuração"
```

---

### Tarefa 7: Painel "Tipos de freepass" em Configurações → Agendamento

**Arquivos:**
- Criar: `src/views/settings/FreepassTypesPanel.jsx`
- Modificar: `src/views/settings/SchedulingSection.jsx`
- Modificar: `src/views/settings/SettingsView.jsx` (repassar `freepassTypes`)
- Teste: `src/lib/__tests__/freepassTypesPanel.test.js`

O painel de quantidades ("Aulas experimentais") continua na tela até a entrega 2, porque o Agendar ainda usa as quantidades. O painel novo entra logo abaixo dele.

- [ ] **Passo 1: Escrever o teste que falha** (jsdom com `createRoot` e `act`, como o `contractOutcomeModal.test.js`)

```js
// @vitest-environment jsdom
// src/lib/__tests__/freepassTypesPanel.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../firebase.js', () => ({ appId: 'acad', CONFIG_PATH: 'stronix_config', CONFIG_GENERAL_ID: 'general' }));
const setDoc = vi.fn(async () => {});
vi.mock('firebase/firestore', () => ({ doc: (...p) => ({ path: p.join('/') }), setDoc: (...a) => setDoc(...a), serverTimestamp: () => 'TS' }));
const { FreepassTypesPanel } = await import('../../views/settings/FreepassTypesPanel.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const modalities = [{ id: 'm1', name: 'Pilates' }, { id: 'm2', name: 'Musculação' }];

let root = null;
async function montar(freepassTypes) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast }, h(FreepassTypesPanel, { db: {}, modalities, freepassTypes })));
  });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; vi.clearAllMocks(); });
const texto = () => document.body.textContent;
const clicar = async (rotulo) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(rotulo));
  expect(b, `botão "${rotulo}"`).toBeTruthy();
  await act(async () => { b.click(); });
};

describe('FreepassTypesPanel', () => {
  it('mostra os tipos com a modalidade, a quantidade e o selo de padrão', async () => {
    await montar([{ id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true }]);
    expect(texto()).toContain('Pilates 2 aulas');
    expect(texto()).toContain('Pilates · 2 aulas');
    expect(texto()).toContain('Padrão');
  });
  it('não salva sem nome e diz o que falta', async () => {
    await montar([]);
    await clicar('Novo freepass');
    await clicar('Criar freepass');
    expect(texto()).toContain('Dê um nome ao freepass.');
    expect(setDoc).not.toHaveBeenCalled();
  });
});
```

Confira o nome do Provider em `src/contexts/ToastContext.jsx` (o teste do `ContractOutcomeModal` usa `ToastContext.Provider`).

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/freepassTypesPanel.test.js`
Esperado: FAIL, módulo não encontrado.

- [ ] **Passo 3: O painel** (`src/views/settings/FreepassTypesPanel.jsx`)

```jsx
// Tipos de freepass (spec docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md).
// Grava a lista inteira em stronix_config/general.freepassTypes, que só o
// gestor grava (regra de stronix_config). A conferência e a troca do padrão
// moram em src/lib/visitante.js.
import { useState } from 'react';
import { Pencil, Ticket } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appId, CONFIG_PATH, CONFIG_GENERAL_ID } from '../../lib/firebase.js';
import { freepassQuantityText, freepassTypeProblem, saveFreepassType, FREEPASS_KINDS } from '../../lib/visitante.js';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsPanel } from '../../components/ui/SettingsCard.jsx';
import { DialogField, EmptyState, FIELD_INPUT, FormDialog, RowAction, SettingsAddBtn } from './settingsBits.jsx';

const EMPTY = { id: '', name: '', modalidadeId: '', kind: FREEPASS_KINDS.DIAS, quantity: '', padrao: false, ativo: true };
const newId = () => `fp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function FreepassTypesPanel({ db, modalities, freepassTypes }) {
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const types = freepassTypes || [];
  const modName = (id) => (modalities || []).find(m => m.id === id)?.name || 'Modalidade excluída';

  const open = (t) => { setProblem(null); setDraft(t ? { ...t } : { ...EMPTY, id: newId() }); };
  const set = (k, v) => { setProblem(null); setDraft(d => ({ ...d, [k]: v })); };

  const save = async () => {
    const p = freepassTypeProblem(draft, types);
    if (p) { setProblem(p); return; }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { freepassTypes: saveFreepassType(types, draft), updatedAt: serverTimestamp() },
        { merge: true }
      );
      setDraft(null);
      toast.success('Freepass salvo.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o freepass.');
    }
    setSaving(false);
  };

  const isNew = draft && !types.some(t => t.id === draft.id);
  return (
    <>
      <SettingsPanel
        icon={<Ticket size={16} />}
        title="Tipos de freepass"
        hint="O que o consultor lança quando a pessoa aceita experimentar a academia."
        action={<SettingsAddBtn label="Novo freepass" onClick={() => open(null)} />}
      >
        <div className="border-t border-border">
          {types.length === 0 ? (
            <EmptyState>Nenhum freepass ainda. Sem ele, o consultor não consegue lançar o freepass na ficha.</EmptyState>
          ) : types.map((t, i) => (
            <div key={t.id} className={cn('flex items-center gap-3 px-5 py-3', i < types.length - 1 && 'border-b border-border', !t.ativo && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] truncate">{t.name}</div>
                <div className="text-[11.5px] text-muted-foreground">{modName(t.modalidadeId)} · {freepassQuantityText(t)}</div>
              </div>
              {t.padrao && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11.5px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">Padrão</span>}
              {!t.ativo && <span className="text-[11.5px] text-muted-foreground">Desligado</span>}
              <RowAction ghost size={28} icon={<Pencil size={13} />} title={`Editar ${t.name}`} onClick={() => open(t)} />
            </div>
          ))}
        </div>
      </SettingsPanel>

      <FormDialog
        open={Boolean(draft)}
        onOpenChange={(v) => !v && setDraft(null)}
        title={isNew ? 'Novo freepass' : `Editar ${draft?.name || ''}`}
        description="O freepass vale por dias de acesso ou por um número de aulas."
        submitLabel={isNew ? 'Criar freepass' : 'Salvar'}
        submitting={saving}
        onSubmit={save}
      >
        {draft && (
          <>
            <DialogField label="Nome">
              <input className={FIELD_INPUT} value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Pilates 2 aulas" aria-invalid={problem?.field === 'name'} />
            </DialogField>
            <DialogField label="Modalidade">
              <select className={FIELD_INPUT} value={draft.modalidadeId} onChange={e => set('modalidadeId', e.target.value)} aria-invalid={problem?.field === 'modalidadeId'}>
                <option value="">Escolha</option>
                {(modalities || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </DialogField>
            <DialogField label="Vale por">
              <div className="flex gap-2" role="radiogroup" aria-label="Vale por">
                {[[FREEPASS_KINDS.DIAS, 'Dias'], [FREEPASS_KINDS.AULAS, 'Aulas']].map(([k, label]) => (
                  <button
                    key={k} type="button" role="radio" aria-checked={draft.kind === k}
                    onClick={() => set('kind', k)}
                    className={cn('h-9 flex-1 rounded-lg border text-[13px] font-semibold focus-visible:outline-none focus-visible:anel-foco',
                      draft.kind === k ? 'border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200' : 'border-border text-muted-foreground')}
                  >{label}</button>
                ))}
              </div>
            </DialogField>
            <DialogField label={draft.kind === FREEPASS_KINDS.AULAS ? 'Quantas aulas' : 'Quantos dias'} hint="De 1 a 99.">
              <input className={cn(FIELD_INPUT, 'num')} type="number" min={1} max={99} value={draft.quantity} onChange={e => set('quantity', e.target.value)} aria-invalid={problem?.field === 'quantity'} />
            </DialogField>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={draft.padrao} onChange={e => set('padrao', e.target.checked)} />
              Padrão da modalidade (o que o Stronizap e a IA usam)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={draft.ativo} onChange={e => set('ativo', e.target.checked)} />
              Ativo (aparece para lançar)
            </label>
            <p role="status" className="min-h-[18px] text-[12.5px] font-semibold text-rose-600 dark:text-rose-400">{problem?.message || ''}</p>
          </>
        )}
      </FormDialog>
    </>
  );
}
```

O `FormDialog` (`settingsBits.jsx`) envolve os campos num `<form>` que chama o `onSubmit` no envio. Não ponha `required` nos campos: quem confere é o `freepassTypeProblem`, que diz o que falta.

- [ ] **Passo 4: Montar no Agendamento** (`src/views/settings/SchedulingSection.jsx`)

Acrescente `freepassTypes` às props de `SchedulingSection` e, logo depois do `SettingsPanel` de "Aulas experimentais":

```jsx
      <FreepassTypesPanel db={db} modalities={modalities} freepassTypes={freepassTypes} />
```

com `import { FreepassTypesPanel } from './FreepassTypesPanel.jsx';`. No `SettingsView.jsx`, receba `freepassTypes` nas props e repasse ao `SchedulingSection`, junto de `trialClassOptions` (linha ~191).

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/freepassTypesPanel.test.js && npm run lint`
Esperado: PASS e lint limpo.

- [ ] **Passo 6: Commitar**

```bash
git add src/views/settings/FreepassTypesPanel.jsx src/views/settings/SchedulingSection.jsx src/views/settings/SettingsView.jsx src/lib/__tests__/freepassTypesPanel.test.js
git commit -m "feat: tipos de freepass em Configurações → Agendamento"
```

---

### Tarefa 8: Os freepass da pessoa, ao vivo

**Arquivos:**
- Criar: `src/hooks/useLeadFreepasses.js`

- [ ] **Passo 1: O hook** (no molde do `useLeadTimeline`; consulta de campo único, sem índice novo)

```js
// Os freepass da pessoa, ao vivo, para a ficha (aba Contratos e a janela de
// lançar). `active` é o portão de ociosidade do App, como no useLeadTimeline.
// A ficha remonta por lead, então o hook não reseta entre leads.
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, FREEPASS_PATH } from '../lib/firebase.js';
import { getSafeDateOrNull } from '../lib/dates.js';

export function useLeadFreepasses({ db, leadId, active = true }) {
  const [freepasses, setFreepasses] = useState([]);
  useEffect(() => {
    if (!db || !leadId || !active) return undefined;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', FREEPASS_PATH), where('leadId', '==', leadId));
    return onSnapshot(
      q,
      (snap) => setFreepasses(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (getSafeDateOrNull(b.startsAt)?.getTime() || 0) - (getSafeDateOrNull(a.startsAt)?.getTime() || 0))
      ),
      (e) => { console.error('useLeadFreepasses', e); setFreepasses([]); }
    );
  }, [db, leadId, active]);
  return freepasses;
}
```

- [ ] **Passo 2: Lint**

Rode: `npx eslint src/hooks/useLeadFreepasses.js`
Esperado: limpo.

- [ ] **Passo 3: Commitar**

```bash
git add src/hooks/useLeadFreepasses.js
git commit -m "feat: hook dos freepass da pessoa"
```

---

### Tarefa 9: A janela de lançar

**Arquivos:**
- Criar: `src/modals/FreepassLaunchModal.jsx`
- Modificar: `src/components/ui/Btn.jsx` (`kind="visit"`)
- Teste: `src/lib/__tests__/freepassLaunchModal.test.js`

- [ ] **Passo 1: O botão verde-água** (`src/components/ui/Btn.jsx`, no objeto `styles`, depois de `enroll`)

```js
    // Visitante (freepass). teal-700: o 600 dá 3,7:1 com texto branco, abaixo dos 4,5:1.
    visit:     'bg-teal-700 text-white hover:bg-teal-600 shadow-sm',
```

- [ ] **Passo 2: Escrever o teste que falha**

```js
// @vitest-environment jsdom
// src/lib/__tests__/freepassLaunchModal.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { FreepassLaunchModal } = await import('../../modals/FreepassLaunchModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const types = [
  { id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true },
  { id: 't2', name: 'Muscu 7 dias', modalidadeId: 'm2', kind: 'dias', quantity: 7, padrao: true, ativo: true },
  { id: 't3', name: 'Desligado', modalidadeId: 'm2', kind: 'dias', quantity: 3, padrao: false, ativo: false }
];
const modalities = [{ id: 'm1', name: 'Pilates' }, { id: 'm2', name: 'Musculação' }];
const base = { open: true, onOpenChange: () => {}, firstName: 'Rafa', types, modalities, loading: false, now: new Date('2026-11-26T10:00:00') };

let root = null;
async function montar(props) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(h(FreepassLaunchModal, { ...base, ...props })); });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; });
const texto = () => document.body.textContent;
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const escolher = async (nome) => {
  const r = document.querySelector(`[role="radio"][aria-label^="${nome}"]`);
  expect(r, `opção "${nome}"`).toBeTruthy();
  await act(async () => { r.click(); });
};

describe('FreepassLaunchModal', () => {
  it('lista só os tipos ativos e não deixa lançar sem escolher', async () => {
    await montar({ freepasses: [], gestor: false, onConfirm: vi.fn() });
    expect(texto()).not.toContain('Desligado');
    expect(botao('Lançar freepass').disabled).toBe(true);
  });
  it('por dias, diz até quando vale e lança com o início', async () => {
    const onConfirm = vi.fn();
    await montar({ freepasses: [], gestor: false, onConfirm });
    await escolher('Muscu 7 dias');
    expect(texto()).toContain('Rafa vira Visitante de 26/11 a 02/12.');
    await act(async () => { botao('Lançar freepass').click(); });
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ type: expect.objectContaining({ id: 't2' }), modalidadeName: 'Musculação' }));
  });
  it('barra o consultor na modalidade repetida', async () => {
    await montar({ freepasses: [{ modalidadeId: 'm1', status: 'encerrado' }], gestor: false, onConfirm: vi.fn() });
    await escolher('Pilates 2 aulas');
    expect(texto()).toContain('Essa pessoa já teve um freepass de Pilates. Só o gestor libera outro.');
    expect(botao('Lançar freepass').disabled).toBe(true);
  });
  it('o gestor lança mesmo assim', async () => {
    const onConfirm = vi.fn();
    await montar({ freepasses: [{ modalidadeId: 'm1', status: 'encerrado' }], gestor: true, onConfirm });
    await escolher('Pilates 2 aulas');
    await act(async () => { botao('Lançar mesmo assim').click(); });
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

Se o `click()` não escolher a opção do Radix em jsdom, dispare antes `pointerdown`/`mousedown` na opção, ou foque nela e mande `keydown` de espaço, como nos testes dos pop-ups da Meta (`src/lib/__tests__/` com `RadioGroup`).

- [ ] **Passo 3: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/freepassLaunchModal.test.js`
Esperado: FAIL, módulo não encontrado.

- [ ] **Passo 4: A janela** (`src/modals/FreepassLaunchModal.jsx`)

```jsx
// Lançar freepass pela aba Contratos (spec 2026-11-26, parte 1). Escolhe o
// tipo (só os ativos, agrupados por modalidade) e, no por dias, o início. A
// regra de um por modalidade é o launchCheck: o consultor é barrado, o gestor
// confirma. Quem grava é a ficha (onConfirm), pelo writeFreepassLaunch.
import { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { Btn } from '../components/ui/Btn.jsx';
import { cn } from '../lib/utils.js';
import { addDays, fromDateInputValue, startOfLocalDay, toDateInputValue } from '../lib/dates.js';
import { freepassQuantityText, launchCheck, launchStartRange, FREEPASS_KINDS } from '../lib/visitante.js';

const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function FreepassLaunchModal({ open, onOpenChange, firstName, types, modalities, freepasses, gestor, loading, onConfirm, now = new Date() }) {
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(() => toDateInputValue(now));
  const range = launchStartRange(now);

  const groups = useMemo(() => (modalities || [])
    .map(m => ({ m, list: (types || []).filter(t => t.ativo && t.modalidadeId === m.id) }))
    .filter(g => g.list.length), [modalities, types]);
  const type = (types || []).find(t => t.id === typeId) || null;
  const modalidadeName = type ? (modalities || []).find(m => m.id === type.modalidadeId)?.name || '' : '';
  const check = type ? launchCheck({ type, freepasses, modalidadeName, gestor }) : null;
  const startDate = fromDateInputValue(start);
  const startOk = Boolean(startDate) && startDate >= range.min && startDate <= range.max;
  const porDias = type?.kind === FREEPASS_KINDS.DIAS;

  let status;
  if (!type) status = 'Escolha o freepass.';
  else if (check?.block) status = check.block;
  else if (porDias && !startOk) status = `O início vai de ${ddmm(range.min)} a ${ddmm(range.max)}.`;
  else if (check?.confirm) status = check.confirm;
  else if (porDias) status = `${firstName} vira Visitante de ${ddmm(startDate)} a ${ddmm(addDays(startDate, type.quantity - 1))}.`;
  else status = `${firstName} vira Visitante agora, com ${freepassQuantityText(type)} para agendar.`;
  const blocked = !type || Boolean(check?.block) || (porDias && !startOk);

  const submit = () => {
    if (blocked || loading) return;
    onConfirm({ type, modalidadeName, startsAt: porDias ? startDate : startOfLocalDay(now) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Lançar freepass</DialogTitle>
          <DialogDescription>{firstName} passa a aparecer como Visitante enquanto o freepass corre.</DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhum freepass cadastrado. O gestor cadastra em Configurações → Agendamento.</p>
        ) : (
          <RadioGroup value={typeId} onValueChange={setTypeId} aria-label="Freepass" className="flex flex-col gap-3">
            {groups.map(({ m, list }) => (
              <div key={m.id} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted-foreground">{m.name}</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map(t => (
                    <RadioGroupOption
                      key={t.id} value={t.id} aria-label={`${t.name}, ${freepassQuantityText(t)}`}
                      className={cn('flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition',
                        typeId === t.id ? 'border-teal-700 bg-teal-50 dark:bg-teal-500/10' : 'border-border hover:bg-muted/50')}
                    >
                      <span className="text-[13.5px] font-semibold">{t.name}</span>
                      <span className="text-[12px] text-muted-foreground">{freepassQuantityText(t)}</span>
                    </RadioGroupOption>
                  ))}
                </div>
              </div>
            ))}
          </RadioGroup>
        )}

        {porDias && (
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Começa em
            <input
              type="date" className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] num"
              value={start} min={toDateInputValue(range.min)} max={toDateInputValue(range.max)}
              onChange={e => setStart(e.target.value)}
            />
          </label>
        )}

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <p role="status" className={cn('flex-1 text-[12.5px]', check?.block ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
            {status}
          </p>
          <Btn kind="secondary" onClick={() => onOpenChange(false)}>Cancelar</Btn>
          <Btn kind="visit" icon={<Ticket size={14} />} onClick={submit} disabled={blocked || loading}>
            {check?.confirm ? 'Lançar mesmo assim' : 'Lançar freepass'}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Com o mockup escolhido na tarefa 1, ajuste as classes dos cartões e do rodapé.

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/freepassLaunchModal.test.js && npm run lint`
Esperado: PASS e lint limpo.

- [ ] **Passo 6: Commitar**

```bash
git add src/modals/FreepassLaunchModal.jsx src/components/ui/Btn.jsx src/lib/__tests__/freepassLaunchModal.test.js
git commit -m "feat: janela de lançar o freepass"
```

---

### Tarefa 10: O cartão do freepass e o "Lançar freepass" na aba Contratos

**Arquivos:**
- Criar: `src/components/profile/contracts/FreepassCard.jsx`
- Modificar: `src/components/profile/contracts/ContractsTab.jsx`
- Teste: `src/lib/__tests__/contractsTabFreepass.test.js`

- [ ] **Passo 1: Escrever o teste que falha**

```js
// @vitest-environment jsdom
// src/lib/__tests__/contractsTabFreepass.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { ContractsTab } = await import('../../components/profile/contracts/ContractsTab.jsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const props = {
  leadContracts: [], firstName: 'Rafa', isReadOnly: false, loading: false, contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  onEnroll: vi.fn(), onRenew: vi.fn(), onEditContract: vi.fn(), onContractAction: vi.fn(), onActivate: vi.fn(),
  onLaunchFreepass: vi.fn(), onEndFreepass: vi.fn()
};
const fp = { id: 'f1', kind: 'aulas', total: 2, aulas: 0, typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', status: 'correndo', startsAt: new Date(), endsAt: null, contractAtStart: null };

let root = null;
async function montar(extra) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(h(ContractsTab, { ...props, ...extra })); });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; vi.clearAllMocks(); });
const texto = () => document.body.textContent;
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);

describe('aba Contratos com freepass', () => {
  it('o lead sem contrato tem Lançar freepass no lugar de Matricular agora', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [], canFreepass: true });
    expect(botao('Matricular agora')).toBeUndefined();
    await act(async () => { botao('Lançar freepass').click(); });
    expect(props.onLaunchFreepass).toHaveBeenCalled();
  });
  it('o cliente sem contrato continua com Matricular agora', async () => {
    await montar({ lead: { id: 'L', lifecycleStage: 'cliente' }, isClient: true, freepasses: [], canFreepass: true });
    expect(botao('Matricular agora')).toBeTruthy();
  });
  it('mostra o freepass que corre, com Encerrar', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp], canFreepass: true });
    expect(texto()).toContain('Pilates 2 aulas');
    expect(texto()).toContain('0 de 2 aulas agendadas');
    await act(async () => { botao('Encerrar freepass').click(); });
    expect(props.onEndFreepass).toHaveBeenCalledWith(fp);
  });
  it('sem a ação, nenhum botão de freepass', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp], canFreepass: false });
    expect(botao('Lançar freepass')).toBeUndefined();
    expect(botao('Encerrar freepass')).toBeUndefined();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/contractsTabFreepass.test.js`
Esperado: FAIL.

- [ ] **Passo 3: O cartão** (`src/components/profile/contracts/FreepassCard.jsx`)

```jsx
// O freepass que corre, na aba Contratos (spec 2026-11-26). Por dias, a régua
// do que já passou; por aulas, quantas já foram agendadas. O "Encerrar
// freepass" é o único fim gravado: o fim pelo prazo, pela matrícula e pela
// perda sai da leitura (activeFreepassesOf, em src/lib/visitante.js).
import { Ticket } from 'lucide-react';
import { calendarDaysBetween } from '../../../lib/dates.js';
import { freepassLongText, FREEPASS_KINDS } from '../../../lib/visitante.js';
import { Btn } from '../../ui/Btn.jsx';

function elapsedPct(fp, now) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return Math.round(((fp.aulas || 0) / fp.total) * 100);
  const passed = calendarDaysBetween(fp.startsAt, now) + 1;
  return Math.max(0, Math.min(100, Math.round((passed / fp.total) * 100)));
}

export function FreepassCard({ freepass, now, canFreepass, loading, onEnd }) {
  const pct = elapsedPct(freepass, now);
  return (
    <section className="rounded-2xl border border-teal-200 bg-card shadow-card overflow-hidden dark:border-teal-500/30">
      <div className="flex items-start gap-3.5 px-5 pt-[18px] pb-4">
        <span className="size-[38px] flex-none rounded-xl grid place-items-center bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"><Ticket size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-[17px] font-bold tracking-tight">{freepass.typeName}</h3>
            <span className="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">Freepass</span>
          </div>
          <div className="text-[12.5px] text-muted-foreground mt-1">{freepass.modalidadeName}</div>
          <div className="num text-[13px] font-semibold mt-1.5">{freepassLongText(freepass, now)}</div>
        </div>
      </div>
      <div className="flex h-1 bg-slate-100 dark:bg-white/[0.06]">
        <span className="h-full bg-teal-500" style={{ width: `${pct}%` }}></span>
      </div>
      {canFreepass && (
        <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-slate-50 dark:bg-white/[0.03]">
          <Btn kind="secondary" onClick={() => onEnd(freepass)} disabled={loading}>Encerrar freepass</Btn>
          <span className="text-[12.5px] text-muted-foreground">A matrícula é pelo Marcar venda.</span>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Passo 4: A aba** (`src/components/profile/contracts/ContractsTab.jsx`)

1. Acrescente `Ticket` ao import de `lucide-react`, e importe `FreepassCard` de `./FreepassCard.jsx` e `activeFreepassesOf` de `../../../lib/visitante.js`.
2. Troque o `EmptyState` inteiro:

```jsx
// Lead ou cliente sem contrato vigente. O lead lança o freepass aqui e se
// matricula pelo Marcar venda do cabeçalho (spec 2026-11-26). O cliente sem
// contrato não tem Marcar venda, então continua com Matricular agora.
function EmptyState({ firstName, isReadOnly, loading, onEnroll, isClient, canFreepass, onLaunchFreepass }) {
  const freepass = !isClient;
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-card p-8 text-center">
      <div className="size-[46px] rounded-[14px] grid place-items-center mx-auto mb-3 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={20} /></div>
      <h3 className="font-display text-[16px] font-bold tracking-tight">Ainda não é cliente</h3>
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground mt-1.5 max-w-[320px] mx-auto text-pretty">
        {freepass
          ? `Quando ${firstName} aceitar experimentar a academia, lance o freepass aqui. A matrícula é pelo Marcar venda, no alto da ficha.`
          : `Quando ${firstName} fechar, registre plano, valor e vigência. A renovação passa a ser acompanhada por aqui.`}
      </p>
      {!isReadOnly && (
        <div className="mt-4 flex items-center justify-center">
          {freepass
            ? canFreepass && <Btn kind="visit" icon={<Ticket size={15} />} onClick={onLaunchFreepass} disabled={loading}>Lançar freepass</Btn>
            : <Btn kind="enroll" icon={<UserPlus size={15} />} onClick={onEnroll} disabled={loading}>Matricular agora</Btn>}
        </div>
      )}
    </section>
  );
}
```

3. No `ClosedCard`, receba `canFreepass` e `onLaunchFreepass` e ponha, logo depois do botão "Nova matrícula":

```jsx
        {!isReadOnly && canFreepass && <Btn kind="visit" icon={<Ticket size={14} />} onClick={onLaunchFreepass} disabled={loading}>Lançar freepass</Btn>}
```

4. `ContractsTab` passa a receber `isClient`, `freepasses = []`, `canFreepass = false`, `onLaunchFreepass` e `onEndFreepass`. Logo depois de `const now = new Date();`:

```js
  const running = activeFreepassesOf(lead, freepasses, now);
```

No JSX, entre `<ContractTimeline timeline={timeline} />` e o bloco do contrato:

```jsx
      {running.map(fp => (
        <FreepassCard key={fp.id} freepass={fp} now={now} canFreepass={canFreepass && !isReadOnly} loading={loading} onEnd={onEndFreepass} />
      ))}
```

e repasse `isClient`, `canFreepass` e `onLaunchFreepass` ao `EmptyState` e ao `ClosedCard`.

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/contractsTabFreepass.test.js && npm test`
Esperado: PASS. Algum teste antigo que espera "Matricular agora" no lead sem contrato vai falhar: é a mudança pedida. Troque nele para `isClient: true` se o caso for de cliente, ou para o "Lançar freepass" se for de lead.

- [ ] **Passo 6: Commitar**

```bash
git add src/components/profile/contracts/FreepassCard.jsx src/components/profile/contracts/ContractsTab.jsx src/lib/__tests__/contractsTabFreepass.test.js
git commit -m "feat: Lançar freepass e o cartão do freepass na aba Contratos"
```

---

### Tarefa 11: A ficha (etiqueta Visitante, lançar e encerrar)

**Arquivos:**
- Modificar: `src/views/LeadProfileView.jsx`
- Teste: `src/lib/__tests__/fichaVisitante.sweep.test.js`

- [ ] **Passo 1: Escrever o teste que falha** (varredura do texto da ficha, no molde dos outros `*.sweep.test.js`)

```js
// src/lib/__tests__/fichaVisitante.sweep.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../views/LeadProfileView.jsx', import.meta.url), 'utf8');

describe('ficha e Visitante', () => {
  it('a etiqueta sai do visitorOf', () => {
    expect(src).toMatch(/visitorOf\(lead, bandNow\)/);
    expect(src).toMatch(/Visitante · \{visitor\.shortText\}/);
  });
  it('lançar e encerrar passam pela ação e pelas gravações do freepass', () => {
    expect(src).toMatch(/can\(appUser, ACTIONS\.FREEPASS_LANCAR\)/);
    expect(src).toMatch(/writeFreepassLaunch\(/);
    expect(src).toMatch(/writeFreepassEnd\(/);
  });
  it('a aba Contratos recebe os freepass da pessoa', () => {
    expect(src).toMatch(/useLeadFreepasses\(\{ db, leadId: lead\?\.id, active: listenersActive \}\)/);
    expect(src).toMatch(/freepasses=\{freepasses\}/);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/lib/__tests__/fichaVisitante.sweep.test.js`
Esperado: FAIL.

- [ ] **Passo 3: Ligar na ficha** (`src/views/LeadProfileView.jsx`)

1. Imports:

```js
import { FreepassLaunchModal } from '../modals/FreepassLaunchModal.jsx';
import { useLeadFreepasses } from '../hooks/useLeadFreepasses.js';
import { activeFreepassesOf, visitorOf } from '../lib/visitante.js';
import { writeFreepassEnd, writeFreepassLaunch } from '../lib/freepassWrites.js';
```

Confira se `isGestor` já vem de `../lib/acesso.js`; se não, acrescente ao import.

2. Logo depois do `useLeadTimeline` (linha 103):

```js
  const freepasses = useLeadFreepasses({ db, leadId: lead?.id, active: listenersActive });
```

3. Junto do `canContrato` (linha 120):

```js
  const canFreepass = can(appUser, ACTIONS.FREEPASS_LANCAR);
  const [freepassOpen, setFreepassOpen] = useState(false);
```

4. `freepassTypes` e `modalities` vêm do `useGeneralConfig()` que a ficha já chama: acrescente os dois ao desestruturado, se faltarem.

5. Os gravadores, logo depois do `handleRenew`:

```js
  // Freepass (spec 2026-11-26). Lança pela janela e encerra à mão. O fim pela
  // matrícula e pela perda sai da leitura (visitante.js), então os caminhos de
  // venda e de perda não mudam.
  const openFreepass = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canFreepass) { negarAcesso(); return; }
    setFreepassOpen(true);
  };
  const confirmFreepass = async ({ type, modalidadeName, startsAt }) => {
    if (!canFreepass) { negarAcesso(); return; }
    setLoading(true);
    try {
      await writeFreepassLaunch({ db, lead, appUser, type, modalidadeName, startsAt, existing: activeFreepassesOf(lead, freepasses, new Date()) });
      setFreepassOpen(false);
      toast.success('Freepass lançado.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível lançar o freepass.');
    } finally {
      setLoading(false);
    }
  };
  const endFreepass = async (fp) => {
    if (!canFreepass) { negarAcesso(); return; }
    const nome = String(lead.name || '').split(' ')[0];
    if (!window.confirm(`Encerrar o freepass ${fp.typeName}? ${nome} deixa de aparecer como Visitante.`)) return;
    setLoading(true);
    try {
      await writeFreepassEnd({ db, lead, appUser, freepass: fp, existing: activeFreepassesOf(lead, freepasses, new Date()) });
      toast.success('Freepass encerrado.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível encerrar o freepass.');
    } finally {
      setLoading(false);
    }
  };
```

6. A etiqueta. Logo depois de `const bandNow = new Date();` (linha ~989):

```js
  const visitor = visitorOf(lead, bandNow);
```

No JSX do topo (linha ~1082), logo depois do `</span>` da pílula do estado (a que mostra `{stateChipText(profileState.label)}`):

```jsx
                {visitor && (
                  <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-teal-50 px-2.5 text-[12.5px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                    <span className="size-1.5 rounded-full bg-teal-500" aria-hidden="true" />Visitante · {visitor.shortText}
                  </span>
                )}
```

7. A aba Contratos (linha ~1472), acrescente ao `<ContractsTab`:

```jsx
            isClient={isClient}
            freepasses={freepasses}
            canFreepass={canFreepass}
            onLaunchFreepass={openFreepass}
            onEndFreepass={endFreepass}
```

8. A janela, junto do `<ContractModal` (linha ~1591):

```jsx
        <FreepassLaunchModal
          open={freepassOpen}
          onOpenChange={setFreepassOpen}
          firstName={firstName}
          types={freepassTypes}
          modalities={modalities}
          freepasses={freepasses}
          gestor={isGestor(appUser)}
          loading={loading}
          onConfirm={confirmFreepass}
        />
```

Monte a janela só quando aberta (`{freepassOpen && <FreepassLaunchModal ... />}`), para a escolha e o início voltarem ao padrão a cada abertura.

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/lib/__tests__/fichaVisitante.sweep.test.js && npm test && npm run lint`
Esperado: PASS, a suíte inteira verde e lint limpo.

- [ ] **Passo 5: Commitar**

```bash
git add src/views/LeadProfileView.jsx src/lib/__tests__/fichaVisitante.sweep.test.js
git commit -m "feat: Visitante na ficha, com lançar e encerrar o freepass"
```

---

### Tarefa 12: Documentação, verificação e PR

**Arquivos:**
- Modificar: `CLAUDE.md` (seção nova, depois de "Aba Contratos da ficha")

- [ ] **Passo 1: Seção no `CLAUDE.md`**

```markdown
## Visitante e freepass

Quem aceita um freepass vira Visitante, uma etiqueta verde-água por cima do estado de sempre (Lead, Inativo, Cancelado). Spec em `docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md`, entrega 1 em `docs/superpowers/plans/2026-11-26-visitante-01-base.md`.

- **A regra mora em `src/lib/visitante.js`**, pura e sem pacote (a `api/` vai lê-la na entrega 2). O nome não é `freepass.js` porque colidiria com o `freePass.js` no APFS.
- **Tipos de freepass** em `stronix_config/general.freepassTypes` (Configurações → Agendamento, `FreepassTypesPanel`), um padrão por modalidade. O painel de quantidades antigo continua até a entrega 2, porque o Agendar ainda o usa.
- **Cada freepass é um documento em `stronix_freepass`**, e o lead guarda o resumo do que corre (`freepass*`, `freepassSummaryPatch`). Lançar e encerrar gravam num lote só, com a interação `type: 'freepass'` (bucket Agendamentos) e o resumo (`src/lib/freepassWrites.js`, pelo gancho `extra` do `logInteractions`).
- **Só o "Encerrar freepass" grava o fim.** O prazo, a matrícula e a perda saem da leitura (`activeFreepassesOf` e `visitorOf`): lead em Perda não é Visitante, e um contrato atual diferente do que a pessoa tinha no lançamento (`contractAtStart`) quer dizer matrícula ou renovação. Por isso nenhum caminho de venda ou de perda grava no freepass. Limite aceito: o lead reativado da Perda dentro do prazo volta a aparecer como Visitante.
- **Um por modalidade** (`launchCheck`): o consultor é barrado, o gestor confirma.
- **Quem lança e encerra** pergunta a `ACTIONS.FREEPASS_LANCAR`; o professor não tem. A regra do Firestore da coleção recusa o professor (`freepassRules.test.js`).
- **Na ficha:** a etiqueta "Visitante · faltam 3 dias" sai do resumo; a aba Contratos tem "Lançar freepass" no lugar do "Matricular agora" para o lead (o cliente sem contrato continua com "Matricular agora") e ao lado do "Nova matrícula" no ex-aluno, e um cartão por freepass que corre, com o "Encerrar freepass".
```

- [ ] **Passo 2: A verificação inteira, igual ao CI**

Rode: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Esperado: tudo verde, com o número de testes da linha de base mais os novos.

- [ ] **Passo 3: Conferir no navegador.** Use o harness local com Firebase falso (memória `harness-navegador-sem-login`), nunca o banco de produção com conta real. Confira:
  1. cadastrar dois tipos em Configurações → Agendamento (um por dias, um por aulas, um padrão);
  2. na ficha de um lead, aba Contratos: "Lançar freepass", escolher o por dias, ver a etiqueta "Visitante · …" no topo e o cartão;
  3. tentar um segundo freepass da mesma modalidade como consultor (barrado) e como gestor (confirma);
  4. "Encerrar freepass": a etiqueta some e a linha do tempo mostra o lançamento e o encerramento em Agendamentos, com o texto da interação como título (`TimelineEvent.jsx:228`); se aparecer outra coisa, ajuste no `TimelineEvent` só o título do `type === 'freepass'`;
  5. "Marcar venda" com freepass correndo: depois da matrícula, a etiqueta some;
  6. um ex-aluno (contrato vencido): "Lançar freepass" ao lado do "Nova matrícula", e a etiqueta "Inativo" mais "Visitante".

- [ ] **Passo 4: Commitar a documentação**

```bash
git add CLAUDE.md
git commit -m "docs: Visitante e freepass no CLAUDE.md"
```

- [ ] **Passo 5: Avisar das regras.** Antes do merge, o Johnny publica no console do Firebase o bloco novo de `stronix_freepass` do `firestore.rules`. Sem ele, lançar dá permission-denied.

- [ ] **Passo 6: PR.** Só com o pedido do Johnny: push da branch e PR para a `main`, com a lista do passo 3 e o aviso das regras.
