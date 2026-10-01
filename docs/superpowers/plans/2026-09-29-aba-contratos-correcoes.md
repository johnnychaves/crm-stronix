# Aba Contratos: correções da auditoria. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os itens 1 a 7 da auditoria da aba Contratos da ficha, em dois PRs: primeiro as telas (Trancado amarelo, porcentagem do cancelado, linha do tempo, desconto e origem do contrato), depois a vigência (emendado, sobreposição, cancelar e corrigir renovação que ainda não começou, bloqueio de renovar trancado e o script das renovações antigas).

**Architecture:** Toda regra nova é função pura em `src/lib/` (`contracts.js`, `renewal.js`, `timeline.js`, `leadState.js`, `dates.js` e o módulo novo `contractHistory.js`), testada em node com vitest. As telas (`LeadProfileView.jsx`, `ClientsView.jsx` e os três modais de contrato) só chamam essas funções. A gravação continua em `contractsWrites.js`, num batch por ação. Não muda regra do Firestore, consulta nem índice.

**Tech Stack:** React 19 + Vite, Tailwind v4, Firebase (Firestore), vitest 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-28-aba-contratos-correcoes-design.md`.

**Três ajustes em relação à spec, decididos ao escrever o plano:**
- `isSeamlessStart` e `renewalJoinOf` moram em `src/lib/contracts.js`, não em `renewal.js`. `renewal.js` já importa (via `renewalGoal.js`) `contracts.js`, e o caminho contrário fecharia um ciclo de import.
- O `computeSeam` de `renewal.js` passa a contar dias do calendário (Task 17). Hoje ele trata "começar no próprio dia do fim" como emenda perfeita e conta a sobreposição com um dia a menos, o que brigaria com a gravação nova. Três testes existentes mudam de 25 para 26 dias de sobreposição, de propósito.
- O script recebe os ids das academias soltos na linha de comando, como `scripts/fix-clients-unsold-by-stage-move.js`, e não `--tenant=`.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/leadState.js` | tom `yellow`, estado `trancado`, rótulo "CONTRATO AGENDADO" |
| `src/lib/renewal.js` | `vigenciaRefDate`; `computeSeam` por dia do calendário; texto do `seamWarning` |
| `src/lib/timeline.js` | `contractEventOf`; reativado, trancado e corrigido no balde de contrato |
| `src/lib/contracts.js` | `contractDiscountOf`; desconto no `buildContractEdit`; `renewalJoinOf`, `isSeamlessStart`, agendado com a marca, `buildMatriculaWrites` com marca e encurtamento, `renewalStartProblem`, `isRenewalNotStarted`, `buildRenewalCancel`, `buildContractEdit` com o contrato anterior |
| `src/lib/contractHistory.js` (novo) | `contractOriginOf`, `contractEndOf`, `CONTRACT_ORIGIN`; `historyStatusOf`, `runningPredecessorOf`, `HISTORY_STATUS` |
| `src/lib/dates.js` | `startOfLocalDay`, `calendarDaysBetween` |
| `src/lib/contractsWrites.js` | segundo contrato no batch de `commitMatricula` e de `commitContractPatch` |
| `src/lib/seamlessBackfill.js` (novo) | `planSeamlessBackfill`, a decisão pura do script |
| `scripts/backfill-contract-seamless.js` (novo) | o script das renovações antigas |
| `src/views/LeadProfileView.jsx` | card, régua, célula de origem, Histórico e faixa da linha do tempo |
| `src/views/ClientsView.jsx` | filtro e anel do trancado, cores de vencido e cancelado |
| `src/modals/ContractModal.jsx` | dica do "Começar hoje", linha do "Ao confirmar", bloqueios |
| `src/modals/ContractEditModal.jsx` | motivo do desconto; contrato anterior na correção |
| `src/modals/ContractOutcomeModal.jsx` | trancar em amarelo; cancelar renovação que não começou |
| `CLAUDE.md` (do Stronilead) | seção "Aba Contratos da ficha" |
| Testes | `leadState`, `renewal`, `timeline`, `contracts`, `dates`, `contractHistory` (novo), `contractsWrites` (novo), `seamlessBackfill` (novo) |

Comandos usados em todo o plano, rodados na raiz do worktree:
- um arquivo de teste: `npx vitest run src/lib/__tests__/<arquivo>.test.js`
- tudo: `npm test`, `npm run lint`, `npm run build`

---

## Task 0: Linha de base

**Files:** nenhum.

- [ ] **Step 1: Conferir que o branch está em dia com a main**

Run: `git fetch origin main --quiet && git rev-list --count HEAD..origin/main`
Expected: `0`. Se der mais que zero, trazer a main pela ferramenta `sync_with_base_branch` do app antes de seguir.

- [ ] **Step 2: Dependências**

Run: `npm install` e depois `git status --short package-lock.json`
Expected: nenhuma mudança no `package-lock.json`. Se mudou, descartar a mudança do lock e avisar o Johnny.

- [ ] **Step 3: Rodar a suíte inteira e anotar o número de testes**

Run: `npm test`
Expected: tudo verde. Anotar o total de testes para comparar no fim de cada PR.

---

# PR 1: as telas (itens 2, 4, 5, 6 e 7)

Branch: `claude/contracts-tab-improvements-aa6212` (o desta sessão).

## Task 1: Tom amarelo e estado Trancado em `leadState.js`

**Files:**
- Modify: `src/lib/leadState.js`
- Test: `src/lib/__tests__/leadState.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/leadState.test.js`, trocar a linha de import por:

```js
import { deriveLeadState, getTone, phaseToneName, TONES } from '../leadState.js';
```

E acrescentar, dentro do `describe('deriveLeadState', ...)`, antes do `});` final:

```js
  it('contrato trancado mostra TRANCADO em amarelo, não CLIENTE ATIVO', () => {
    const state = deriveLeadState(cliente({ currentContractStatus: 'trancado' }), NOW);
    expect(state.key).toBe('trancado');
    expect(state.label).toBe('TRANCADO');
    expect(state.tone).toBe('yellow');
    expect(state.hint).toBe('Vigência congelada');
  });

  it('trancado ganha de vencido: parado, o contrato não corre', () => {
    const state = deriveLeadState(cliente({
      currentContractStatus: 'trancado',
      currentContractStartsAt: vencido.startsAt,
      currentContractEndsAt: vencido.endsAt
    }), NOW);
    expect(state.key).toBe('trancado');
  });
```

E, depois do `describe` existente, um bloco novo:

```js
describe('TONES: o amarelo do Trancado', () => {
  it('existe e não cai no cinza', () => {
    expect(getTone('yellow')).toBe(TONES.yellow);
    expect(TONES.yellow.strong).toBe('bg-yellow-500');
    expect(TONES.yellow.hex).toBe('#EAB308');
  });

  it('etapa de funil pintada de amarelo passa a sair amarela na ficha', () => {
    expect(phaseToneName('Proposta', [{ name: 'Proposta', color: 'yellow' }])).toBe('yellow');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leadState.test.js`
Expected: FAIL. `state.key` vem `cliente_ativo` e `TONES.yellow` é `undefined`.

- [ ] **Step 3: Implementar**

Em `src/lib/leadState.js`, dentro de `TONES`, depois da linha do `amber`, acrescentar:

```js
  yellow:  { soft: 'bg-yellow-50',  text: 'text-yellow-700',  strong: 'bg-yellow-500',  dot: 'bg-yellow-500',  ring: 'ring-yellow-500',  darkText: 'dark:text-yellow-300',  darkSoft: 'dark:bg-yellow-500/10',  hex: '#EAB308' },
```

Trocar o comentário:

```js
// Estado de ciclo de vida da pessoa. Retorna { key, tone, label, hint }.
// key: lead | cliente_ativo | a_vencer | inativo | cancelado | perdido
```

por:

```js
// Estado de ciclo de vida da pessoa. Retorna { key, tone, label, hint }.
// key: lead | cliente_ativo | a_vencer | agendado | trancado | inativo |
// cancelado | perdido
```

E, dentro de `if (isClient) {`, logo depois de `const cs = deriveLeadContractStatus(lead, refDate, thresholdDays);`, acrescentar:

```js
    // Trancado tem estado próprio, em amarelo (decisão do Johnny, 28/09/2026).
    // Antes caía no fim da lista e o topo da ficha dizia CLIENTE ATIVO.
    if (cs === CONTRACT_STATUS.TRANCADO) return { key: 'trancado', tone: 'yellow', label: 'TRANCADO', hint: 'Vigência congelada' };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leadState.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadState.js src/lib/__tests__/leadState.test.js
git commit -m "feat: estado Trancado em amarelo no cabeçalho da ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: Trancado amarelo na aba Contratos e contagem de dias igual à reativação

**Files:**
- Modify: `src/views/LeadProfileView.jsx`
- Modify: `src/modals/ContractOutcomeModal.jsx`

Sem teste unitário: é só tela. A contagem passa a usar `daysBetween`, que já tem teste.

- [ ] **Step 1: Ícone de pausa no import**

Em `src/views/LeadProfileView.jsx`, trocar a linha de import do `lucide-react`:

```js
import { ArrowLeft, ArrowRight, Ban, BookOpen, Building2, Calendar, Check, CheckCircle, Clock, Copy, CreditCard, FileText, GraduationCap, Handshake, Link2, MessageCircle, Pencil, Phone, PlayCircle, Plus, RefreshCw, Search, Tag, Target, ThumbsDown, Trash, TrendingUp, User, UserPlus, Users } from 'lucide-react';
```

por:

```js
import { ArrowLeft, ArrowRight, Ban, BookOpen, Building2, Calendar, Check, CheckCircle, Clock, Copy, CreditCard, FileText, GraduationCap, Handshake, Link2, MessageCircle, PauseCircle, Pencil, Phone, PlayCircle, Plus, RefreshCw, Search, Tag, Target, ThumbsDown, Trash, TrendingUp, User, UserPlus, Users } from 'lucide-react';
```

- [ ] **Step 2: Tom do trancado**

No `CONTRACT_TONE`, trocar:

```js
  [CONTRACT_STATUS.TRANCADO]: { block: 'bg-brand-500/10 dark:bg-brand-500/15', fg: 'text-brand-700 dark:text-brand-300', fill: 'bg-brand-600' },
```

por:

```js
  [CONTRACT_STATUS.TRANCADO]: { block: 'bg-yellow-500/15 dark:bg-yellow-500/15', fg: 'text-yellow-700 dark:text-yellow-300', fill: 'bg-yellow-500' },
```

- [ ] **Step 3: Contagem de dias do trancado**

Trocar:

```js
                const pausedDays = paused && curPausedAt
                  ? Math.max(0, Math.ceil((Date.now() - curPausedAt.getTime()) / 86400000))
                  : 0;
```

por:

```js
                // Mesma conta da reativação (buildContractResume). Com o
                // arredondamento para cima, o card dizia 11 dias e o modal, 10.
                const pausedDays = paused && curPausedAt
                  ? Math.max(0, daysBetween(curPausedAt, new Date()) || 0)
                  : 0;
```

- [ ] **Step 4: Ícone no rótulo "Trancado há"**

Trocar:

```jsx
                        <div className={cn('text-[9.5px] font-bold uppercase tracking-[.08em]', tone.fg)}>
                          {scheduled ? 'Começa em' : paused ? 'Trancado há' : 'Restam'}
                        </div>
```

por:

```jsx
                        <div className={cn('flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[.08em]', tone.fg)}>
                          {paused && <PauseCircle size={11} aria-hidden="true" />}
                          {scheduled ? 'Começa em' : paused ? 'Trancado há' : 'Restam'}
                        </div>
```

- [ ] **Step 5: Modal de trancar em amarelo**

Em `src/modals/ContractOutcomeModal.jsx`, em `ACTIONS.trancar`, trocar `tone: 'brand',` por `tone: 'yellow',`. Em `TONE_CLASS`, acrescentar depois da linha `brand`:

```js
  // Só o ícone fica amarelo. O botão segue azul: texto branco em amarelo não tem contraste.
  yellow: { chip: 'bg-yellow-500/15 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300', btn: 'bg-brand-600 hover:bg-brand-700' },
```

- [ ] **Step 6: Lint e build**

Run: `npx eslint src/views/LeadProfileView.jsx src/modals/ContractOutcomeModal.jsx && npm run build`
Expected: sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/views/LeadProfileView.jsx src/modals/ContractOutcomeModal.jsx
git commit -m "feat: trancado em amarelo na aba Contratos, com a contagem de dias da reativação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: Clientes com filtro e anel do trancado, e cores de vencido e cancelado

**Files:**
- Modify: `src/views/ClientsView.jsx`

Sem teste unitário: tabelas de cor da tela. O filtro no endereço já valida pela lista que a tela repassa (`situacoes: STATUS_OPTIONS`).

- [ ] **Step 1: Tons e ordem do filtro**

Trocar o bloco `STATUS_TONE` inteiro por:

```js
const STATUS_TONE = {
  [CONTRACT_STATUS.AGENDADO]: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  [CONTRACT_STATUS.ATIVO]:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  [CONTRACT_STATUS.A_VENCER]: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  [CONTRACT_STATUS.TRANCADO]: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300',
  // Vencido cinza e cancelado vermelho, como na ficha e no cabeçalho. Antes
  // os dois estavam trocados só aqui.
  [CONTRACT_STATUS.VENCIDO]:  'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
  [CONTRACT_STATUS.CANCELADO]:'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  [SEM_CONTRATO]:             'bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500'
};
```

E o `STATUS_OPTIONS` por:

```js
const STATUS_OPTIONS = [
  CONTRACT_STATUS.AGENDADO,
  CONTRACT_STATUS.ATIVO,
  CONTRACT_STATUS.A_VENCER,
  CONTRACT_STATUS.TRANCADO,
  CONTRACT_STATUS.VENCIDO,
  CONTRACT_STATUS.CANCELADO,
  SEM_CONTRATO
];
```

- [ ] **Step 2: Anel amarelo**

Trocar o comentário e o bloco do anel:

```js
// Anel de situação do contrato em volta do avatar — mesmo padrão do perfil do
// aluno (RingAvatar): 100% verde = Ativo · metade âmbar / metade verde = A
// vencer · cinza = Inativo (vencido/cancelado/sem contrato). Hexes de getTone.
const RING_GREEN = '#10B981'; // emerald
const RING_AMBER = '#F59E0B'; // amber
const RING_GRAY = '#64748B';  // slate
const RING_VIOLET = '#8B5CF6'; // violet — matrícula agendada, vigência à frente
const contractRing = (status) =>
  status === CONTRACT_STATUS.ATIVO
    ? RING_GREEN
    : status === CONTRACT_STATUS.AGENDADO
      ? RING_VIOLET
      : status === CONTRACT_STATUS.A_VENCER
        ? `conic-gradient(${RING_AMBER} 0deg 180deg, ${RING_GREEN} 180deg 360deg)`
        : RING_GRAY;
```

por:

```js
// Anel de situação do contrato em volta do avatar, mesmo padrão do perfil do
// aluno (RingAvatar): verde = Ativo, metade âmbar e metade verde = A vencer,
// amarelo = Trancado, roxo = Agendado e cinza = Inativo (vencido, cancelado ou
// sem contrato). Hexes de getTone.
const RING_GREEN = '#10B981'; // emerald
const RING_AMBER = '#F59E0B'; // amber
const RING_YELLOW = '#EAB308'; // yellow, contrato trancado
const RING_GRAY = '#64748B';  // slate
const RING_VIOLET = '#8B5CF6'; // violet, contrato agendado
const contractRing = (status) =>
  status === CONTRACT_STATUS.ATIVO
    ? RING_GREEN
    : status === CONTRACT_STATUS.AGENDADO
      ? RING_VIOLET
      : status === CONTRACT_STATUS.TRANCADO
        ? RING_YELLOW
        : status === CONTRACT_STATUS.A_VENCER
          ? `conic-gradient(${RING_AMBER} 0deg 180deg, ${RING_GREEN} 180deg 360deg)`
          : RING_GRAY;
```

- [ ] **Step 3: Lint, testes do filtro no endereço e build**

Run: `npx eslint src/views/ClientsView.jsx && npx vitest run src/lib/__tests__/screenParams.test.js && npm run build`
Expected: sem erro, testes verdes.

- [ ] **Step 4: Commit**

```bash
git add src/views/ClientsView.jsx
git commit -m "feat: trancado no filtro e no anel de Clientes, com as cores de vencido e cancelado da ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: Porcentagem do cancelado pela data do cancelamento

**Files:**
- Modify: `src/lib/renewal.js`
- Modify: `src/views/LeadProfileView.jsx`
- Test: `src/lib/__tests__/renewal.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No import de `src/lib/__tests__/renewal.test.js`, acrescentar `vigenciaRefDate` depois de `missedCheckpointsLabel`. No fim do arquivo:

```js
describe('vigenciaRefDate', () => {
  const NOW = D(2026, 9, 28);

  it('cancelado para na data do cancelamento', () => {
    expect(vigenciaRefDate({ status: 'cancelado', cancelledAt: D(2026, 3, 1) }, NOW)).toEqual(D(2026, 3, 1));
  });

  it('cancelamento com data futura (aviso prévio) usa hoje', () => {
    expect(vigenciaRefDate({ status: 'cancelado', cancelledAt: D(2026, 10, 28) }, NOW)).toEqual(NOW);
  });

  it('trancado congela na data do trancamento', () => {
    expect(vigenciaRefDate({ status: 'trancado', pausedAt: D(2026, 9, 10) }, NOW)).toEqual(D(2026, 9, 10));
  });

  it('nos outros casos é hoje', () => {
    expect(vigenciaRefDate({ status: 'ativo' }, NOW)).toEqual(NOW);
    expect(vigenciaRefDate({ status: 'cancelado' }, NOW)).toEqual(NOW);
  });

  it('a porcentagem do cancelado não sobe com o tempo', () => {
    const c = { startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1) };
    const cancelado = { status: 'cancelado', cancelledAt: D(2026, 3, 1) };
    const antes = contractVigencia({ ...c, now: vigenciaRefDate(cancelado, D(2026, 6, 1)) }).elapsedPct;
    const depois = contractVigencia({ ...c, now: vigenciaRefDate(cancelado, D(2026, 12, 1)) }).elapsedPct;
    expect(antes).toBe(16);
    expect(depois).toBe(16);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/renewal.test.js`
Expected: FAIL com "vigenciaRefDate is not a function".

- [ ] **Step 3: Implementar**

Em `src/lib/renewal.js`, acrescentar no bloco de imports:

```js
import { CONTRACT_STATUS } from './contracts.js';
```

E, antes de `export function contractVigencia`, acrescentar:

```js
// A data que a régua de vigência trata como "hoje". Trancado congela na data
// do trancamento. Cancelado para na data do cancelamento quando ela já passou:
// sem isso a porcentagem de um contrato encerrado subia todo dia.
export function vigenciaRefDate({ status, pausedAt, cancelledAt } = {}, now = new Date()) {
  const ref = getSafeDateOrNull(now) || new Date();
  if (status === CONTRACT_STATUS.TRANCADO) return getSafeDateOrNull(pausedAt) || ref;
  if (status === CONTRACT_STATUS.CANCELADO) {
    const at = getSafeDateOrNull(cancelledAt);
    if (at && at.getTime() < ref.getTime()) return at;
  }
  return ref;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/renewal.test.js`
Expected: PASS.

- [ ] **Step 5: Usar na ficha**

Em `src/views/LeadProfileView.jsx`, trocar o import:

```js
import { contractVigencia, daysBetween, missedCheckpointsLabel } from '../lib/renewal.js';
```

por:

```js
import { contractVigencia, daysBetween, missedCheckpointsLabel, vigenciaRefDate } from '../lib/renewal.js';
```

E trocar:

```js
  // Trancado congela a régua na data em que parou: o contrato não corre.
  const curPaused = curStatus === CONTRACT_STATUS.TRANCADO;
  const curPausedAt = getSafeDateOrNull(currentContract?.pausedAt);
  const vigencia = hasCurrentContract
    ? contractVigencia({
      startsAt: curStartsAt,
      endsAt: curEndsAt,
      checkpoints: renewalCheckpoints,
      handled: lead.renewalHandledCheckpoints,
      now: curPaused && curPausedAt ? curPausedAt : new Date()
    })
    : null;
```

por:

```js
  // Trancado congela a régua na data em que parou, e cancelado para na data do
  // cancelamento (vigenciaRefDate). Sem isso a porcentagem do cancelado subia
  // todo dia.
  const curPaused = curStatus === CONTRACT_STATUS.TRANCADO;
  const curPausedAt = getSafeDateOrNull(currentContract?.pausedAt);
  const curCancelledAt = getSafeDateOrNull(currentContract?.cancelledAt);
  const vigencia = hasCurrentContract
    ? contractVigencia({
      startsAt: curStartsAt,
      endsAt: curEndsAt,
      checkpoints: renewalCheckpoints,
      handled: lead.renewalHandledCheckpoints,
      now: vigenciaRefDate({ status: curStatus, pausedAt: curPausedAt, cancelledAt: curCancelledAt }, new Date())
    })
    : null;
```

- [ ] **Step 6: Lint e build**

Run: `npx eslint src/lib/renewal.js src/views/LeadProfileView.jsx && npm run build`
Expected: sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/lib/renewal.js src/lib/__tests__/renewal.test.js src/views/LeadProfileView.jsx
git commit -m "fix: porcentagem do contrato cancelado pela data do cancelamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: Ler o evento de contrato pelo próprio texto

**Files:**
- Modify: `src/lib/timeline.js`
- Test: `src/lib/__tests__/timeline.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No import de `src/lib/__tests__/timeline.test.js`, acrescentar `contractEventOf` depois de `classifyInteraction`, e logo abaixo do import:

```js
import {
  buildContractCancel,
  buildContractEdit,
  buildContractPause,
  buildContractResume,
  buildMatriculaInteractionText
} from '../contracts.js';

const D = (y, m, d) => new Date(y, m - 1, d);
```

O arquivo ainda não declara `D`. No fim do arquivo:

```js
describe('contractEventOf: o tipo, o plano e o valor do próprio evento', () => {
  it('matrícula, com o valor gravado no texto', () => {
    const text = buildMatriculaInteractionText({ planName: 'Clube + Start', value: 1308, endsAt: D(2027, 9, 1), isRenewal: false });
    expect(contractEventOf(text)).toEqual({ kind: 'matricula', planName: 'Clube + Start', value: 1308 });
  });

  it('renovação', () => {
    const text = buildMatriculaInteractionText({ planName: 'Anual', value: 1177.2, endsAt: D(2027, 9, 1), isRenewal: true });
    expect(contractEventOf(text)).toEqual({ kind: 'renovacao', planName: 'Anual', value: 1177.2 });
  });

  it('matrícula antiga, com o valor sem centavos', () => {
    expect(contractEventOf('Matrícula realizada — Plano Mensal (R$ 149). Vigência até 01/08/2026.'))
      .toEqual({ kind: 'matricula', planName: 'Mensal', value: 149 });
  });

  it('plano com parênteses no nome', () => {
    expect(contractEventOf('Matrícula realizada — Plano Anual (12m) (R$ 1.308,00). Vigência até 01/09/2027.'))
      .toEqual({ kind: 'matricula', planName: 'Anual (12m)', value: 1308 });
  });

  it('cancelamento', () => {
    const { interactionText } = buildContractCancel({ planName: 'Anual', cancelledAt: D(2026, 5, 14), reason: 'Mudou de cidade' });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'cancelamento', planName: 'Anual', value: null });
  });

  it('trancamento', () => {
    const { interactionText } = buildContractPause({ planName: 'Clube + Start', pausedAt: D(2026, 9, 10), reason: 'Viagem' });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'trancamento', planName: 'Clube + Start', value: null });
  });

  it('reativação', () => {
    const { interactionText } = buildContractResume({
      contract: { pausedAt: D(2026, 9, 1), endsAt: D(2027, 1, 1) },
      resumedAt: D(2026, 9, 13)
    });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'reativacao', planName: null, value: null });
  });

  it('correção', () => {
    const { interactionText } = buildContractEdit({
      contract: { planId: 'p1', planName: 'Mensal', value: 149, durationMonths: 1, startsAt: D(2026, 7, 1), endsAt: D(2026, 8, 1) },
      plan: { id: 'p2', name: 'Anual', value: 1390, durationMonths: 12 },
      value: 1240,
      startsAt: D(2026, 7, 1)
    });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'correcao', planName: 'Anual', value: 1240 });
  });

  it('renovação cancelada antes de começar é cancelamento, não renovação', () => {
    expect(contractEventOf('Renovação cancelada antes de começar: Plano Clube + Flow, motivo Financeiro. O contrato Plano Clube + Start volta a valer até 11/10/2026.'))
      .toEqual({ kind: 'cancelamento', planName: 'Clube + Flow', value: null });
  });

  it('texto que não é de contrato devolve null', () => {
    expect(contractEventOf('Fase alterada para [Plano apresentado].')).toBeNull();
    expect(contractEventOf('')).toBeNull();
  });
});

describe('classifyInteraction: todo evento de contrato vai para o balde de contrato', () => {
  it('reativação', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Contrato reativado após 12 dias trancado. Vigência estendida até 13/09/2027.' }))
      .toBe('contract');
  });

  it('trancamento sem plano no texto', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Contrato trancado a partir de 10/09/2026 — Viagem.' }))
      .toBe('contract');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js`
Expected: FAIL com "contractEventOf is not a function" e a reativação classificada como `status`.

- [ ] **Step 3: Implementar**

Em `src/lib/timeline.js`, acrescentar no topo, junto dos imports:

```js
import { parseValorBRL } from './format.js';
```

Trocar:

```js
const CONTRACT_RE = /matrícula|matricula|renova(ç|c)ão|contrato cancelado|plano /i;
```

por:

```js
const CONTRACT_RE = /matrícula|matricula|renova(ç|c)ão|contrato (cancelado|trancado|reativado|corrigido)|plano /i;
```

E, logo depois de `const UPGRADE_EVENT_RE = /^Upgrade: /;`, acrescentar:

```js
// Tipo do evento de contrato pelo começo do texto que o próprio app grava
// (src/lib/contracts.js). A ordem importa: "Renovação cancelada" é
// cancelamento, não renovação.
const CONTRACT_EVENT_RULES = [
  { kind: 'cancelamento', re: /^(contrato cancelado|renova(ç|c)ão cancelada)/i },
  { kind: 'trancamento', re: /^contrato trancado/i },
  { kind: 'reativacao', re: /^contrato reativado/i },
  { kind: 'correcao', re: /^contrato corrigido/i },
  { kind: 'renovacao', re: /^renova(ç|c)ão registrada/i },
  { kind: 'matricula', re: /^matr(í|i)cula realizada/i }
];

// Lê um evento de contrato: o tipo, o plano e o valor DELE. A ficha mostrava o
// plano e o valor do contrato de hoje em todo evento, então a matrícula de
// junho aparecia com o valor da renovação de setembro. Aceita os textos com
// travessão (os de hoje) e com vírgula (o da renovação cancelada). Sem tipo
// reconhecido devolve null. Mudou um texto em contracts.js, mude aqui e no
// timeline.test.js junto.
export function contractEventOf(text) {
  const t = String(text || '').trim();
  const rule = CONTRACT_EVENT_RULES.find((r) => r.re.test(t));
  if (!rule) return null;
  const plan = t.match(/Plano (.+?)(?= \(R\$|, | — |\. |\.$|$)/);
  const money = t.match(/\((R\$\s?[\d.,]+)\)/);
  const value = money ? parseValorBRL(money[1]) : null;
  return {
    kind: rule.kind,
    planName: plan ? plan[1].trim() : null,
    value: Number.isFinite(value) ? value : null
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js src/lib/__tests__/profileTimeline.test.js`
Expected: PASS nos dois. Se o `fmtBRL` gravar o valor com espaço duro (U+00A0), o `\s` do regex já cobre.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.js src/lib/__tests__/timeline.test.js
git commit -m "feat: evento de contrato lido do próprio texto (tipo, plano e valor)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: Faixa da linha do tempo pelo evento

**Files:**
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Import**

No bloco `import { ... } from '../lib/timeline.js';`, acrescentar `contractEventOf,` depois de `classifyInteraction,`.

- [ ] **Step 2: Constante dos marcos**

Logo depois do `CONTRACT_TONE` (depois do `};` dele), acrescentar:

```js
// Eventos de contrato que ganham faixa de destaque na linha do tempo: os que
// mudam a situação do cliente. Trancamento, reativação e correção seguem como
// linha comum do tipo "Contrato".
const CONTRACT_MILESTONE_KINDS = new Set(['matricula', 'renovacao', 'cancelamento']);
```

- [ ] **Step 3: Evento lido do texto**

Trocar:

```js
    const isContract = i._kind === 'contract';
    const contractCancel = isContract && /cancel/i.test(i.text || '');
```

por:

```js
    // O evento de contrato vem do próprio texto: tipo, plano e valor dele, e não
    // os do contrato de hoje (contractEventOf, em lib/timeline.js).
    const contractEvent = i._kind === 'contract' ? contractEventOf(i.text) : null;
    const isContract = Boolean(contractEvent && CONTRACT_MILESTONE_KINDS.has(contractEvent.kind));
    const contractCancel = contractEvent?.kind === 'cancelamento';
```

- [ ] **Step 4: Título e valor do evento**

Trocar:

```js
          : contractCancel ? 'Contrato cancelado'
            : /renova/i.test(i.text || '') ? 'Contrato renovado'
              : (lead.currentPlanName || 'Matrícula fechada');
```

por:

```js
          : contractCancel
            ? (/^renova/i.test(cleanBody) ? 'Renovação cancelada' : 'Contrato cancelado')
            : contractEvent?.kind === 'renovacao' ? 'Contrato renovado'
              : (contractEvent?.planName || 'Matrícula fechada');
```

Trocar:

```js
      // Valor só na matrícula, e só se o contrato realmente tiver valor.
      const showValue = isContract && !contractCancel && lead.currentContractValue != null
        && Number.isFinite(Number(lead.currentContractValue));
```

por:

```js
      // Valor só na matrícula e na renovação, e o do próprio evento.
      const eventValue = isContract && !contractCancel ? contractEvent.value : null;
      const showValue = eventValue != null;
```

E trocar, logo abaixo, dentro do `{showValue && (...)}`:

```jsx
              {fmtBRL(lead.currentContractValue)}
```

por:

```jsx
              {fmtBRL(eventValue)}
```

- [ ] **Step 5: Lint, testes da linha do tempo e build**

Run: `npx eslint src/views/LeadProfileView.jsx && npx vitest run src/lib/__tests__/profileTimeline.test.js src/lib/__tests__/timeline.test.js && npm run build`
Expected: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "fix: linha do tempo mostra o plano e o valor de cada evento de contrato

Trancamento, reativação e correção deixam a faixa verde de matrícula.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: Desconto como tabela menos valor, e a correção recalcula

**Files:**
- Modify: `src/lib/contracts.js`
- Test: `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No import de `src/lib/__tests__/contracts.test.js`, acrescentar `contractDiscountOf,` depois de `buildMatriculaWrites,`. Logo abaixo do import:

```js
import { DISCOUNT_MODES } from '../renewal.js';
```

No fim do arquivo:

```js
describe('contractDiscountOf: tabela menos valor, como no Gerencial', () => {
  it('é a diferença entre a tabela e o valor fechado', () => {
    expect(contractDiscountOf({ value: 1177.2, listValue: 1308 })).toBe(130.8);
  });

  it('ignora o discountValue gravado', () => {
    expect(contractDiscountOf({ value: 1308, listValue: 1308, discountValue: 130.8 })).toBe(0);
  });

  it('sem tabela, ou acima dela, não tem desconto', () => {
    expect(contractDiscountOf({ value: 100 })).toBe(0);
    expect(contractDiscountOf({ value: 1400, listValue: 1308 })).toBe(0);
  });
});

describe('buildContractEdit: desconto recalculado', () => {
  const base = {
    planId: 'p1', planName: 'Start', value: 1177.2, listValue: 1308, durationMonths: 12,
    startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1),
    discountMode: 'percent', discountValue: 130.8, discountReason: 'Fidelidade'
  };
  const plano = { id: 'p1', name: 'Start', value: 1308, durationMonths: 12 };

  it('corrigir para o valor cheio apaga desconto e motivo', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1308, startsAt: D(2026, 9, 1) });
    expect(r.contractPatch).toMatchObject({ discountMode: 'nenhum', discountValue: 0, discountReason: null });
  });

  it('valor abaixo da tabela grava a diferença e o motivo escolhido', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1200, startsAt: D(2026, 9, 1), discountReason: 'Campanha' });
    expect(r.contractPatch).toMatchObject({ discountMode: 'final', discountValue: 108, discountReason: 'Campanha' });
  });

  it('só a data mudou: mantém o modo e o motivo', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1177.2, startsAt: D(2026, 9, 5) });
    expect(r.contractPatch).toMatchObject({ discountMode: 'percent', discountValue: 130.8, discountReason: 'Fidelidade' });
  });

  it('valor acima da tabela não vira desconto negativo', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1400, startsAt: D(2026, 9, 1) });
    expect(r.contractPatch).toMatchObject({ discountMode: 'nenhum', discountValue: 0, discountReason: null });
  });

  it('grava os mesmos modos de DISCOUNT_MODES', () => {
    expect(DISCOUNT_MODES.NENHUM).toBe('nenhum');
    expect(DISCOUNT_MODES.FINAL).toBe('final');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: FAIL com "contractDiscountOf is not a function" e sem os campos de desconto no patch.

- [ ] **Step 3: Implementar**

Em `src/lib/contracts.js`, antes do bloco de comentário "Desfechos do contrato vigente", acrescentar:

```js
// Desconto de um contrato: tabela menos o valor fechado, a mesma conta do
// Gerencial (gerencial/sales.js). O discountValue gravado não é lido: depois
// de uma correção ele podia guardar o desconto antigo. Sem tabela, zero.
export const contractDiscountOf = (contract) => {
  const value = Number(contract?.value) || 0;
  const list = Number(contract?.listValue) || value;
  return Math.max(Math.round((list - value) * 100) / 100, 0);
};
```

E trocar a função `buildContractEdit` inteira por:

```js
// Correção de um contrato já gravado (erro de digitação em plano, valor ou
// início). NÃO é renovação: não cria contrato novo, não mexe em marcos de
// renovação e não recarimba conversão. Preserva os dias já trancados.
// O desconto é recalculado junto (tabela menos o valor corrigido). 'nenhum' e
// 'final' são os valores de DISCOUNT_MODES (renewal.js), escritos aqui porque
// importar renewal.js fecharia um ciclo.
export const buildContractEdit = ({ contract, plan, value, startsAt, discountReason } = {}) => {
  const start = getSafeDateOrNull(startsAt) || getSafeDateOrNull(contract?.startsAt) || new Date();
  const durationMonths = Number(plan?.durationMonths) || Number(contract?.durationMonths) || 0;
  const base = computeEndsAt(start, durationMonths);
  const pausedDaysTotal = Number(contract?.pausedDaysTotal) || 0;
  const endsAt = base && pausedDaysTotal > 0 ? addDays(base, pausedDaysTotal) : base;
  const finalValue = Number.isFinite(Number(value)) ? Number(value) : (Number(contract?.value) || 0);
  const listValue = Number(plan?.value) || Number(contract?.listValue) || 0;
  const discountValue = contractDiscountOf({ value: finalValue, listValue });
  const hasDiscount = discountValue > 0.005;
  const sameDeal = finalValue === (Number(contract?.value) || 0) && listValue === (Number(contract?.listValue) || 0);
  const priorMode = contract?.discountMode && contract.discountMode !== 'nenhum' ? contract.discountMode : null;

  return {
    contractPatch: {
      planId: plan?.id ?? contract?.planId ?? null,
      planName: plan?.name ?? contract?.planName ?? null,
      value: finalValue,
      listValue,
      durationMonths,
      startsAt: start,
      endsAt,
      discountMode: hasDiscount ? ((sameDeal && priorMode) || 'final') : 'nenhum',
      discountValue: hasDiscount ? discountValue : 0,
      discountReason: hasDiscount ? (discountReason ?? contract?.discountReason ?? null) : null
    },
    leadPatch: {
      currentPlanName: plan?.name ?? contract?.planName ?? null,
      currentContractValue: finalValue,
      currentContractStartsAt: start,
      currentContractEndsAt: endsAt
    },
    interactionText: `Contrato corrigido — Plano ${plan?.name ?? contract?.planName ?? '—'} (${fmtBRL(finalValue)}), vigência ${fmtDia(start)} → ${fmtDia(endsAt)}.`
  };
};
```

O texto da linha do tempo não muda: o leitor da Task 5 depende dele.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/timeline.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js
git commit -m "fix: correção de contrato recalcula o desconto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: Card lê o desconto pela tabela, e o modal de correção pede o motivo

**Files:**
- Modify: `src/views/LeadProfileView.jsx`
- Modify: `src/modals/ContractEditModal.jsx`

- [ ] **Step 1: Card**

Em `src/views/LeadProfileView.jsx`, trocar o import de `contracts.js`:

```js
import { deriveContractStatus, deriveLeadContractStatus, hasLiveContract, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
```

por:

```js
import { contractDiscountOf, deriveContractStatus, deriveLeadContractStatus, hasLiveContract, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
```

E trocar:

```js
                // Desconto do contrato. Contrato antigo não tem discountValue:
                // aí a diferença para a tabela é o que sobrou de registro.
                const listValue = Number(currentContract?.listValue) || 0;
                const discount = Number(currentContract?.discountValue)
                  || Math.max(listValue - (Number(lead.currentContractValue) || 0), 0);
                const discountReason = currentContract?.discountReason || null;
```

por:

```js
                // Desconto = tabela menos o valor fechado, a mesma conta do
                // Gerencial (contractDiscountOf). O discountValue gravado não é
                // lido: depois de uma correção ele mostrava o desconto antigo.
                const listValue = Number(currentContract?.listValue) || 0;
                const discount = currentContract ? contractDiscountOf(currentContract) : 0;
                const discountReason = currentContract?.discountReason || null;
```

- [ ] **Step 2: Modal de correção**

Substituir o conteúdo de `src/modals/ContractEditModal.jsx` por:

```jsx
import { useMemo, useState } from 'react';
import { Calendar, DollarSign, Pencil } from 'lucide-react';
import { buildContractEdit } from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { fmtBRL, parseValorBRL, valorToInput } from '../lib/format.js';
import { DISCOUNT_REASONS } from '../lib/renewal.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Correção de um contrato já gravado. Existe porque errar o valor ou a data
// era irreversível: a única saída era cancelar e refazer, o que sujava a
// corrente do histórico e contava uma renovação a mais.
//
// NÃO é renovação nem matrícula: não cria contrato, não mexe nos marcos de
// renovação e não recarimba a conversão. Só conserta o registro. O desconto é
// recalculado junto, e valor abaixo da tabela pede o motivo, como na matrícula.

function ContractEditModal({ lead, appUser, db, contract, onClose, onDone }) {
  const toast = useToast();
  const { planos } = useGeneralConfig();

  // O plano do contrato pode ter saído do catálogo: ele continua na lista
  // para a correção não trocar o plano sem querer.
  const options = useMemo(() => {
    const ativos = (planos || [])
      .filter(p => p.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (contract?.planId && !ativos.some(p => p.id === contract.planId)) {
      return [...ativos, {
        id: contract.planId,
        name: `${contract.planName || 'Plano'} (fora do catálogo)`,
        value: contract.listValue || contract.value,
        durationMonths: contract.durationMonths
      }];
    }
    return ativos;
  }, [planos, contract]);

  const [planId, setPlanId] = useState(contract?.planId || options[0]?.id || '');
  const [value, setValue] = useState(valorToInput(contract?.value));
  const [startStr, setStartStr] = useState(toDateInputValue(getSafeDateOrNull(contract?.startsAt) || new Date()));
  const [reason, setReason] = useState(contract?.discountReason || null);
  const [submitting, setSubmitting] = useState(false);

  const plan = options.find(p => p.id === planId) || null;
  const startsAt = fromDateInputValue(startStr);
  const numericValue = parseValorBRL(value);
  const listValue = Number(plan?.value) || 0;
  // Valor abaixo da tabela é desconto e pede motivo.
  const hasDiscount = listValue > 0 && Number.isFinite(numericValue) && listValue - numericValue > 0.005;
  const discountReason = hasDiscount ? reason : null;

  const preview = plan && startsAt
    ? buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason })
    : null;
  const novoFim = getSafeDateOrNull(preview?.contractPatch?.endsAt);
  const fimAtual = getSafeDateOrNull(contract?.endsAt);
  const pausedDaysTotal = Number(contract?.pausedDaysTotal) || 0;

  const onChangePlan = (id) => {
    setPlanId(id);
    const p = options.find(x => x.id === id);
    if (p) setValue(valorToInput(p.value));
  };

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!plan) { toast.warning('Selecione um plano.'); return; }
    if (!startsAt) { toast.warning('Informe a data de início.'); return; }
    if (!Number.isFinite(numericValue) || numericValue < 0) { toast.warning('Informe um valor válido.'); return; }
    if (hasDiscount && !reason) { toast.warning('Escolha o motivo do desconto.'); return; }

    setSubmitting(true);
    try {
      const built = buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason });
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText
      });
      toast.success('Contrato corrigido.');
      onDone && onDone();
    } catch (e) {
      console.error('Erro ao corrigir contrato:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[210] max-w-[520px] gap-0 p-0 block overflow-hidden rounded-2xl border-border"
      >
        <div className="flex items-start gap-3.5 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <span className="size-10 flex-none rounded-xl grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
            <Pencil size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Corrigir contrato</DialogTitle>
            <div className="num text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {lead?.name || 'Cliente'} · #{String(contract?.id || lead?.currentContractId || '').slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3.5">
          <Field label="Plano">
            <StyledSelect value={planId} onChange={e => onChangePlan(e.target.value)}>
              {options.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · {fmtBRL(p.value)} · {Number(p.durationMonths) || 0}m
                </option>
              ))}
            </StyledSelect>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)" hint={plan && Number(plan.value) !== numericValue ? `Tabela: ${fmtBRL(plan.value)}` : undefined}>
              <StyledInput
                type="text"
                inputMode="decimal"
                icon={<DollarSign size={14} />}
                value={value}
                onChange={e => setValue(e.target.value)}
              />
            </Field>
            <Field label="Início">
              <StyledInput
                type="date"
                icon={<Calendar size={14} />}
                value={startStr}
                onChange={e => setStartStr(e.target.value)}
              />
            </Field>
          </div>

          {hasDiscount && (
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 mb-2">
                Motivo do desconto
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      'h-[29px] px-[11px] rounded-lg border-[1.5px] text-[12px] font-semibold whitespace-nowrap transition',
                      r === reason
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'border-border bg-card text-slate-600 dark:text-slate-300 hover:border-brand-200 dark:hover:border-brand-500/45'
                    )}
                  >{r}</button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[10px] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
            {novoFim ? (
              <>
                A vigência passa a terminar em <span className="num font-semibold text-slate-900 dark:text-white">{novoFim.toLocaleDateString('pt-BR')}</span>
                {fimAtual && novoFim.getTime() !== fimAtual.getTime() && (
                  <span className="num"> (era {fimAtual.toLocaleDateString('pt-BR')})</span>
                )}.
                {pausedDaysTotal > 0 && <> Os {pausedDaysTotal} dias já trancados seguem contados.</>}
                {' '}Isto corrige o registro. Não cria contrato novo nem mexe nos marcos de renovação.
              </>
            ) : 'Escolha plano e data de início para ver a nova vigência.'}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-100 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            className="h-[38px] px-4 rounded-[10px] text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white transition disabled:opacity-50"
          >Voltar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-semibold whitespace-nowrap transition disabled:opacity-50"
          >
            <Pencil size={14} />
            {submitting ? 'Salvando...' : 'Salvar correção'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractEditModal };
```

- [ ] **Step 3: Lint e build**

Run: `npx eslint src/views/LeadProfileView.jsx src/modals/ContractEditModal.jsx && npm run build`
Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/views/LeadProfileView.jsx src/modals/ContractEditModal.jsx
git commit -m "fix: card lê o desconto pela tabela e a correção pede o motivo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 9: Origem do contrato, com a regra do Gerencial

**Files:**
- Create: `src/lib/contractHistory.js`
- Test: `src/lib/__tests__/contractHistory.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/contractHistory.test.js`:

```js
// Origem de cada contrato de uma pessoa, na aba Contratos da ficha. A ordem é
// a do Gerencial (saleTypeOf): renovação, upgrade, retorno e primeira. O último
// bloco compara as duas, para a ficha e o Gerencial não se separarem.

import { describe, it, expect } from 'vitest';
import { CONTRACT_ORIGIN, contractEndOf, contractOriginOf } from '../contractHistory.js';
import { daysBetween } from '../dates.js';
import { normalizeContracts, indexContracts } from '../operacional/base.js';
import { saleTypeOf, SALE_TYPES } from '../gerencial/scope.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const ts = (date) => ({ toDate: () => date });
const L = 'lead-1';
const K = (id, extra) => ({ id, leadId: L, planName: `Plano ${id}`, value: 100, durationMonths: 1, ...extra });

const a = K('a', { startsAt: D(2025, 1, 10), endsAt: D(2025, 2, 10), createdAt: D(2025, 1, 10) });
const b = K('b', { renewedFromId: 'a', startsAt: D(2025, 2, 11), endsAt: D(2025, 5, 11), createdAt: D(2025, 2, 5) });
const c = K('c', { renewedFromId: 'b', startsAt: D(2025, 5, 12), endsAt: D(2026, 5, 12), createdAt: D(2025, 5, 1) });
const d = K('d', { startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1), createdAt: D(2026, 9, 1) });
const e = K('e', { renewedFromId: 'd', startsAt: D(2027, 9, 2), endsAt: D(2028, 9, 2), createdAt: D(2027, 8, 1) });
const todos = [a, b, c, d, e];

describe('contractOriginOf', () => {
  it('primeiro contrato da pessoa', () => {
    expect(contractOriginOf(a, todos)).toEqual({ kind: CONTRACT_ORIGIN.PRIMEIRA, previous: null, ordinal: 0, gapDays: null });
  });

  it('renovação conta só a sequência ligada', () => {
    const o = contractOriginOf(c, todos);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RENOVACAO);
    expect(o.previous).toBe(b);
    expect(o.ordinal).toBe(2);
    expect(o.gapDays).toBeNull();
  });

  it('contrato sem ligação depois de um tempo sem contrato é retorno', () => {
    const o = contractOriginOf(d, todos);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.previous).toBe(c);
    expect(o.gapDays).toBe(daysBetween(D(2026, 5, 12), D(2026, 9, 1)) - 1);
  });

  it('a contagem de renovações recomeça depois de um retorno', () => {
    expect(contractOriginOf(e, todos).ordinal).toBe(1);
  });

  it('retorno depois de cancelamento conta o intervalo desde o cancelamento', () => {
    const cancelado = { ...c, status: 'cancelado', cancelledAt: D(2025, 8, 1) };
    const o = contractOriginOf(d, [a, b, cancelado, d]);
    expect(o.gapDays).toBe(daysBetween(D(2025, 8, 1), D(2026, 9, 1)) - 1);
  });

  it('contrato fechado pelo funil Upgrade, sem ligação, é upgrade', () => {
    const up = K('up', { closedFromUpgrade: true, startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1), createdAt: D(2026, 9, 1) });
    expect(contractOriginOf(up, [a, b, c, up]).kind).toBe(CONTRACT_ORIGIN.UPGRADE);
  });

  it('contrato sem ligação que encosta no anterior é retorno sem intervalo', () => {
    const colado = K('colado', { startsAt: D(2026, 5, 13), endsAt: D(2027, 5, 13), createdAt: D(2026, 5, 10) });
    const o = contractOriginOf(colado, [a, b, c, colado]);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.gapDays).toBeNull();
  });

  it('renovação cujo contrato ligado não está na lista continua renovação', () => {
    const solta = K('solta', { renewedFromId: 'sumiu', startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), createdAt: D(2026, 1, 1) });
    expect(contractOriginOf(solta, [solta])).toEqual({ kind: CONTRACT_ORIGIN.RENOVACAO, previous: null, ordinal: 1, gapDays: null });
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    const t1 = K('t1', { startsAt: ts(D(2025, 1, 1)), endsAt: ts(D(2025, 2, 1)), createdAt: ts(D(2025, 1, 1)) });
    const t2 = K('t2', { startsAt: ts(D(2025, 6, 1)), endsAt: ts(D(2025, 7, 1)), createdAt: ts(D(2025, 6, 1)) });
    expect(contractOriginOf(t2, [t1, t2]).kind).toBe(CONTRACT_ORIGIN.RETORNO);
  });
});

describe('contractEndOf', () => {
  it('é o fim, ou o cancelamento quando ele veio antes', () => {
    expect(contractEndOf(a)).toEqual(D(2025, 2, 10));
    expect(contractEndOf({ ...a, cancelledAt: D(2025, 1, 20) })).toEqual(D(2025, 1, 20));
    expect(contractEndOf(null)).toBeNull();
  });
});

describe('contractOriginOf dá o mesmo tipo que o Gerencial', () => {
  it('em todos os casos da lista', () => {
    const up = K('up', { renewedFromId: 'd', closedFromUpgrade: true, startsAt: D(2027, 9, 2), endsAt: D(2028, 9, 2), createdAt: D(2027, 8, 2) });
    const up2 = K('up2', { closedFromUpgrade: true, startsAt: D(2029, 1, 1), endsAt: D(2030, 1, 1), createdAt: D(2029, 1, 1) });
    const raw = [...todos, up, up2];
    const norm = normalizeContracts(raw);
    const { byPerson } = indexContracts(norm);
    const TO_SALE = {
      [CONTRACT_ORIGIN.RENOVACAO]: SALE_TYPES.RENOVACAO,
      [CONTRACT_ORIGIN.UPGRADE]: SALE_TYPES.UPGRADE,
      [CONTRACT_ORIGIN.RETORNO]: SALE_TYPES.RETORNO,
      [CONTRACT_ORIGIN.PRIMEIRA]: SALE_TYPES.NOVA
    };
    norm.forEach((n, i) => {
      expect(TO_SALE[contractOriginOf(raw[i], raw).kind], raw[i].id).toBe(saleTypeOf(n, byPerson));
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractHistory.test.js`
Expected: FAIL, o módulo não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/contractHistory.js`:

```js
// Leitura do histórico de contratos de UMA pessoa, para a aba Contratos da
// ficha. Puro: recebe os docs do lead como chegam do Firestore (Timestamp ou
// Date) e não grava nada.
//
// A origem de cada contrato segue a mesma ordem do Gerencial (saleTypeOf, em
// gerencial/scope.js): renovação, upgrade, retorno e primeira matrícula.
// Renovação é só o contrato ligado ao anterior (renewedFromId). Contrato sem
// ligação é retorno, inclusive o paralelo, como no Gerencial. O
// contractHistory.test.js compara as duas regras.

import { daysBetween, getSafeDateOrNull } from './dates.js';

export const CONTRACT_ORIGIN = {
  RENOVACAO: 'renovacao',
  UPGRADE: 'upgrade',
  RETORNO: 'retorno',
  PRIMEIRA: 'primeira'
};

// O instante da venda, com a mesma troca do Gerencial (saleMoment): sem
// createdAt, vale o início.
const saleMomentOf = (c) => getSafeDateOrNull(c?.createdAt) || getSafeDateOrNull(c?.startsAt);

// Fim efetivo: a data do cancelamento, quando ele veio antes do fim.
export function contractEndOf(contract) {
  if (!contract) return null;
  const end = getSafeDateOrNull(contract.endsAt);
  const cancelled = getSafeDateOrNull(contract.cancelledAt);
  if (cancelled && (!end || cancelled.getTime() < end.getTime())) return cancelled;
  return end;
}

// Quantas renovações em sequência levam até este contrato: 1 na primeira
// renovação. Para no contrato sem ligação, então recomeça depois de um
// retorno. O limite protege contra ligação circular num doc corrompido.
function renewalOrdinalOf(contract, byId) {
  let n = 0;
  let cur = contract;
  const seen = new Set();
  while (cur?.renewedFromId && !seen.has(cur.id) && n < 100) {
    seen.add(cur.id);
    n += 1;
    cur = byId.get(cur.renewedFromId);
  }
  return n;
}

// De onde veio o contrato: { kind, previous, ordinal, gapDays }.
// previous: o contrato ligado (renovação) ou o anterior mais recente pela data
// da venda (retorno e upgrade). gapDays: dias sem contrato entre o fim efetivo
// do anterior e o início deste, ou null quando não houve intervalo.
export function contractOriginOf(contract, leadContracts) {
  const list = Array.isArray(leadContracts) ? leadContracts.filter(Boolean) : [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const moment = saleMomentOf(contract);
  const earlier = list
    .filter((o) => o.id !== contract?.id)
    .filter((o) => {
      const m = saleMomentOf(o);
      return Boolean(m && moment && m.getTime() < moment.getTime());
    })
    .sort((x, y) => saleMomentOf(y).getTime() - saleMomentOf(x).getTime());

  let kind;
  let previous;
  if (contract?.renewedFromId) {
    kind = CONTRACT_ORIGIN.RENOVACAO;
    previous = byId.get(contract.renewedFromId) || null;
  } else {
    previous = earlier[0] || null;
    kind = contract?.closedFromUpgrade
      ? CONTRACT_ORIGIN.UPGRADE
      : previous ? CONTRACT_ORIGIN.RETORNO : CONTRACT_ORIGIN.PRIMEIRA;
  }

  const prevEnd = contractEndOf(previous);
  const start = getSafeDateOrNull(contract?.startsAt);
  const raw = prevEnd && start ? daysBetween(prevEnd, start) : null;
  // Emendar (início no dia seguinte ao fim) é zero dia sem contrato.
  const gapDays = raw != null && raw > 1 ? raw - 1 : null;

  return {
    kind,
    previous,
    ordinal: kind === CONTRACT_ORIGIN.RENOVACAO ? renewalOrdinalOf(contract, byId) : 0,
    gapDays
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractHistory.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractHistory.js src/lib/__tests__/contractHistory.test.js
git commit -m "feat: origem do contrato com a regra do Gerencial (renovação, upgrade, retorno, primeira)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 10: Célula de origem e ícones do Histórico

**Files:**
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Imports**

Na linha do `lucide-react` (já com `PauseCircle` da Task 2), acrescentar `LogIn,` depois de `Link2,`. Logo depois do import de `renewal.js`, acrescentar:

```js
import { CONTRACT_ORIGIN, contractEndOf, contractOriginOf } from '../lib/contractHistory.js';
```

- [ ] **Step 2: Número curto, célula e ícone**

Logo depois da função `gapLabel` (depois do `};` dela), acrescentar:

```jsx
// Número curto do contrato, igual em todo o card.
const shortContractId = (id) => String(id || '').slice(0, 8).toUpperCase();

// De onde veio o contrato vigente. Renovação só quando está ligada ao contrato
// anterior (renewedFromId). Contrato sem ligação é retorno, como no Gerencial.
function OriginCell({ origin }) {
  const kind = origin?.kind || CONTRACT_ORIGIN.PRIMEIRA;
  const prev = origin?.previous || null;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) {
    return (
      <>
        <CapsLabel>Renovado de</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate">{prev?.planName || '—'}</div>
        <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">
          {prev ? `#${shortContractId(prev.id)} · ` : ''}{origin.ordinal}ª renovação
        </div>
      </>
    );
  }
  if (kind === CONTRACT_ORIGIN.RETORNO || kind === CONTRACT_ORIGIN.UPGRADE) {
    const prevEnd = contractEndOf(prev);
    const detail = [
      prevEnd ? `até ${prevEnd.toLocaleDateString('pt-BR')}` : null,
      origin.gapDays ? gapLabel(origin.gapDays) : null
    ].filter(Boolean).join(' · ');
    const main = prev?.planName
      ? `último: ${prev.planName}`
      : kind === CONTRACT_ORIGIN.UPGRADE ? 'pelo funil Upgrade' : '—';
    return (
      <>
        <CapsLabel>{kind === CONTRACT_ORIGIN.UPGRADE ? 'Upgrade' : 'Retorno'}</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate" title={main}>{main}</div>
        {detail && (
          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px] truncate" title={detail}>{detail}</div>
        )}
      </>
    );
  }
  return (
    <>
      <CapsLabel>Renovado de</CapsLabel>
      <div className="text-[13px] font-semibold mt-[7px]">Matrícula inicial</div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">primeiro contrato</div>
    </>
  );
}

// Ícone do nó do Histórico pela origem do contrato.
function OriginIcon({ kind }) {
  if (kind === CONTRACT_ORIGIN.RETORNO) return <LogIn size={14} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.UPGRADE) return <TrendingUp size={14} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) return <RefreshCw size={14} aria-hidden="true" />;
  return <GraduationCap size={14} aria-hidden="true" />;
}
```

- [ ] **Step 3: Origem calculada**

Trocar:

```js
  // "3ª renovação": quantos contratos vieram antes do vigente.
  const renewalOrdinal = pastContracts.length;
  const renewedFrom = currentContract?.renewedFromId
    ? leadContracts.find(c => c.id === currentContract.renewedFromId) || null
    : null;
```

por:

```js
  // De onde veio o contrato vigente: renovação, upgrade, retorno ou primeira
  // matrícula, na ordem do Gerencial (lib/contractHistory.js). Antes contava
  // qualquer contrato anterior como renovação.
  const origin = currentContract ? contractOriginOf(currentContract, leadContracts) : null;
```

- [ ] **Step 4: Célula no card**

Trocar a célula inteira:

```jsx
                        <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <CapsLabel>Renovado de</CapsLabel>
                          {renewalOrdinal > 0 ? (
                            <>
                              <div className="text-[13px] font-semibold mt-[7px] truncate">{renewedFrom?.planName || pastContracts[0]?.planName || '—'}</div>
                              <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">
                                {renewedFrom ? `#${String(renewedFrom.id).slice(0, 4).toUpperCase()} · ` : ''}{renewalOrdinal}ª renovação
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-[13px] font-semibold mt-[7px]">Matrícula inicial</div>
                              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">primeiro contrato</div>
                            </>
                          )}
                        </div>
```

por:

```jsx
                        <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <OriginCell origin={origin} />
                        </div>
```

E, na célula do plano, trocar:

```jsx
                            #{String(lead.currentContractId).slice(0, 8).toUpperCase()}{months ? ` · ${months === 1 ? '1 mês' : `${months} meses`}` : ''}
```

por:

```jsx
                            #{shortContractId(lead.currentContractId)}{months ? ` · ${months === 1 ? '1 mês' : `${months} meses`}` : ''}
```

- [ ] **Step 5: Ícone do nó do Histórico**

Trocar:

```jsx
                          {isFirstEver ? <GraduationCap size={14} /> : <RefreshCw size={14} />}
```

por:

```jsx
                          <OriginIcon kind={contractOriginOf(c, leadContracts).kind} />
```

O `isFirstEver` continua em uso na linha vertical do Histórico.

- [ ] **Step 6: Lint e build**

Run: `npx eslint src/views/LeadProfileView.jsx && npm run build`
Expected: sem erro. Se o lint acusar `renewalOrdinal` ou `renewedFrom` sem uso em outro ponto, procurar com `grep -n "renewalOrdinal\|renewedFrom\b" src/views/LeadProfileView.jsx` e trocar pelo `origin`.

- [ ] **Step 7: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "fix: aba Contratos chama de retorno o contrato sem ligação com o anterior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: Documentação, verificação e PR 1

**Files:**
- Modify: `CLAUDE.md` (do Stronilead, na raiz do worktree)

- [ ] **Step 1: Seção nova no CLAUDE.md**

Inserir, logo antes da linha `## Importação de clientes (super console)`:

```markdown
## Aba Contratos da ficha

Regras da aba Contratos e do que ela divide com a linha do tempo e com Clientes. Spec em `docs/superpowers/specs/2026-09-28-aba-contratos-correcoes-design.md`.

- **Trancado é estado próprio, em amarelo.** `deriveLeadState` devolve `trancado` com o tom `yellow` (`TONES`, em `src/lib/leadState.js`), e Clientes tem filtro e anel amarelos. O "A vencer" continua âmbar. Vencido é cinza e cancelado é vermelho, na ficha e em Clientes.
- **A régua usa uma data de referência** (`vigenciaRefDate`, em `src/lib/renewal.js`). O trancado congela na data do trancamento e o cancelado para na data do cancelamento. Sem isso, a porcentagem do cancelado subia todo dia.
- **O evento de contrato da linha do tempo é lido do próprio texto** (`contractEventOf`, em `src/lib/timeline.js`): o tipo, o plano e o valor daquele evento, nunca os do contrato atual. A faixa de destaque fica só para matrícula, renovação e cancelamento. Quem mudar um texto de evento em `src/lib/contracts.js` precisa mudar o leitor e o `timeline.test.js` junto.
- **Desconto é tabela menos valor** (`contractDiscountOf`, em `src/lib/contracts.js`), a mesma conta do Gerencial. A tela não lê o `discountValue` gravado, e a correção (`buildContractEdit`) recalcula os três campos de desconto.
- **A origem do contrato segue o Gerencial** (`contractOriginOf`, em `src/lib/contractHistory.js`): renovação só com `renewedFromId`, depois upgrade, retorno e primeira matrícula. Contrato sem ligação com o anterior é retorno, o paralelo também. O `contractHistory.test.js` compara o resultado com o `saleTypeOf`.
```

- [ ] **Step 2: Verificação completa**

Run: `npm test && npm run lint && npm run build`
Expected: tudo verde, com mais testes que a linha de base da Task 0 e nenhum a menos.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: regras da aba Contratos no CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push e PR (com o ok do Johnny)**

```bash
git push -u origin claude/contracts-tab-improvements-aa6212
```

Abrir o PR com `gh pr create --base main`. Título: `Aba Contratos: trancado amarelo, linha do tempo, desconto e retorno`. Corpo em português, passado pelo humanizer, com: o que muda para quem usa (itens 2, 4, 5, 6 e 7), que não muda regra do Firestore, os testes novos e a lista de conferência abaixo. Terminar com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Depois de abrir, chamar `get_status` do ccd_pr e, se o PR não aparecer, `bind_pr`.

Conferência no preview da Vercel, no lead de teste:
- cliente trancado: selo TRANCADO amarelo no topo, quadro de dias amarelo com ícone de pausa e o mesmo número de dias do modal Reativar;
- Clientes: filtro Trancado, anel amarelo, vencido cinza e cancelado vermelho nos filtros;
- cliente cancelado: "Interrompido a X%" coerente com a data do cancelamento;
- linha do tempo com trancamento e correção: esses eventos viram linha comum "Contrato", e a matrícula antiga mostra o valor dela;
- corrigir um contrato com desconto para o valor cheio: o desconto some do card;
- cliente que voltou depois de um tempo sem contrato: célula "Retorno".

---

# PR 2: a vigência (itens 1 e 3)

Branch novo: `git switch -c claude/contratos-vigencia` a partir do branch do PR 1. Se o PR 1 já estiver na main, partir da main atualizada. Enquanto o PR 1 não entra, o PR 2 abre com base no branch do PR 1; quando o PR 1 for mesclado, o GitHub troca a base para a main.

**O que a execução do PR 1 mudou e que o PR 2 precisa saber (29/09/2026):**
- A Task 12 já foi feita no PR 1 (commit `f73da98`): `startOfLocalDay` e `calendarDaysBetween` estão em `src/lib/dates.js`, com teste. Pular a Task 12 e só conferir.
- `src/lib/contractHistory.js` já importa `CONTRACT_STATUS` (de `contracts.js`) e `calendarDaysBetween`, e já tem `neverStarted` (cancelado antes de começar) e `coverageOf`. Na Task 19, acrescentar só `deriveContractStatus` ao import e reaproveitar `neverStarted` no lugar de criar `cancelledBeforeStart`, se a regra servir (a do plano compara por dia do calendário; conferir e escolher uma só).
- `contractOriginOf` devolve também `coverageEnd`, e o `previous` de retorno e upgrade é o contrato que cobria o aluno por último, não o vendido por último.
- Na ficha, a origem do contrato vigente se chama `contractOrigin` (não `origin`), e a linha de intervalo do Histórico já usa `contractOriginOf` (`newerOrigin`). As âncoras da Task 20 no `LeadProfileView.jsx` mudaram: reler o arquivo antes de editar.
- `vigenciaRefDate` já trata o cancelado ainda trancado (para no trancamento).
- `buildContractEdit` usa `editListValueOf` para a tabela, e o modal de correção usa `editListValueOf` e `correctionNeedsReason`. Nas Tasks 23 e 24, somar a lógica do contrato anterior a essa versão, sem voltar ao `plan.value`.
- O Gerencial já pinta trancados de amarelo (`WalletBand`, `ExitsCard`).

## Task 12: Dias do calendário em `dates.js`

**Files:**
- Modify: `src/lib/dates.js`
- Test: `src/lib/__tests__/dates.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Trocar o import de `src/lib/__tests__/dates.test.js` por:

```js
import { calendarDaysBetween, fromDateTimeInputValue, startOfLocalDay, toDateTimeInputValue } from '../dates.js';
```

No fim do arquivo:

```js
// Dias do calendário no horário local. A emenda da renovação é "o dia
// seguinte ao fim", não "24 horas depois do fim".
describe('calendarDaysBetween', () => {
  it('conta dias do calendário, não períodos de 24 horas', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 11, 23, 0), new Date(2026, 9, 12, 1, 0))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 9, 11, 1, 0), new Date(2026, 9, 11, 23, 0))).toBe(0);
  });

  it('vira o mês e o ano', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 31), new Date(2026, 10, 1))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 11, 31), new Date(2027, 0, 1))).toBe(1);
  });

  it('negativo quando a segunda data vem antes', () => {
    expect(calendarDaysBetween(new Date(2026, 7, 21), new Date(2026, 6, 27))).toBe(-25);
  });

  it('null com data ausente', () => {
    expect(calendarDaysBetween(null, new Date())).toBeNull();
  });
});

describe('startOfLocalDay', () => {
  it('é a meia-noite local do mesmo dia', () => {
    expect(startOfLocalDay(new Date(2026, 8, 28, 15, 32))).toEqual(new Date(2026, 8, 28));
  });

  it('null com data inválida', () => {
    expect(startOfLocalDay(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/dates.test.js`
Expected: FAIL, funções não existem.

- [ ] **Step 3: Implementar**

Em `src/lib/dates.js`, logo depois de `daysBetween`, acrescentar:

```js
// Meia-noite local do dia de `date`. null se a data for inválida.
export const startOfLocalDay = (date) => {
  const d = getSafeDateOrNull(date);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
};

// Diferença em dias do calendário (b - a), pelo horário local. Diferente de
// daysBetween, que conta períodos de 24 horas e arredonda: aqui 23h de um dia
// e 1h do seguinte dão 1. É a conta da emenda e da sobreposição da renovação.
export const calendarDaysBetween = (a, b) => {
  const from = startOfLocalDay(a);
  const to = startOfLocalDay(b);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/dates.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.js src/lib/__tests__/dates.test.js
git commit -m "feat: diferença em dias do calendário

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 13: Emendado não é agendado

**Files:**
- Modify: `src/lib/contracts.js`
- Test: `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No import de `contracts.test.js`, acrescentar `isSeamlessStart,` e `renewalJoinOf,` (em ordem alfabética na lista). No fim do arquivo:

```js
describe('emendado: começa no dia seguinte ao fim do contrato renovado', () => {
  it('renewalJoinOf lê emenda, intervalo e sobreposição por dia do calendário', () => {
    const end = new Date(2026, 9, 11, 15, 32);
    expect(renewalJoinOf(end, new Date(2026, 9, 12, 0, 0))).toEqual({ seamless: true, overlaps: false, previousEndsAt: null });
    expect(renewalJoinOf(end, D(2026, 10, 20))).toEqual({ seamless: false, overlaps: false, previousEndsAt: null });
    expect(renewalJoinOf(end, D(2026, 10, 11))).toEqual({ seamless: false, overlaps: true, previousEndsAt: D(2026, 10, 10) });
    expect(renewalJoinOf(null, D(2026, 10, 11))).toEqual({ seamless: false, overlaps: false, previousEndsAt: null });
  });

  it('isSeamlessStart', () => {
    expect(isSeamlessStart(D(2026, 10, 31), D(2026, 11, 1))).toBe(true);
    expect(isSeamlessStart(D(2026, 12, 31), D(2027, 1, 1))).toBe(true);
    expect(isSeamlessStart(D(2026, 10, 11), D(2026, 10, 11))).toBe(false);
    expect(isSeamlessStart(D(2026, 10, 11), D(2026, 10, 13))).toBe(false);
  });

  it('emendado com início no futuro é ativo; sem a marca, agendado', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 8, 20), endsAt: D(2027, 8, 20), seamless: true }, NOW)).toBe(CONTRACT_STATUS.ATIVO);
    expect(deriveContractStatus({ startsAt: D(2026, 8, 20), endsAt: D(2027, 8, 20) }, NOW)).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('emendado curto que acaba dentro da janela de aviso é a vencer', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 8, 1), endsAt: D(2026, 8, 20), seamless: true }, NOW)).toBe(CONTRACT_STATUS.A_VENCER);
  });

  it('o resumo do lead leva a marca', () => {
    expect(deriveLeadContractStatus({
      currentContractStatus: 'ativo',
      currentContractStartsAt: D(2026, 8, 20),
      currentContractEndsAt: D(2027, 8, 20),
      currentContractSeamless: true
    }, NOW)).toBe(CONTRACT_STATUS.ATIVO);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `src/lib/contracts.js`, trocar o import de `dates.js` por:

```js
import { addDays, addMonths, calendarDaysBetween, daysBetween, getSafeDateOrNull } from './dates.js';
```

Logo depois de `computeEndsAt`, acrescentar:

```js
// Como a renovação encosta no contrato que ela renova, em dias do calendário.
// Emendada: começa no dia seguinte ao fim, e não é agendada (decisão do
// Johnny, 28/09/2026). Sobreposta: começa no dia do fim ou antes, e o contrato
// renovado passa a terminar na véspera do novo. Regra única do modal e da
// gravação. Mora aqui, e não em renewal.js, porque contracts.js não pode
// importar renewal.js (ciclo).
export function renewalJoinOf(prevEndsAt, startsAt) {
  const diff = calendarDaysBetween(prevEndsAt, startsAt);
  if (diff == null) return { seamless: false, overlaps: false, previousEndsAt: null };
  return {
    seamless: diff === 1,
    overlaps: diff <= 0,
    previousEndsAt: diff <= 0 ? addDays(startsAt, -1) : null
  };
}

export const isSeamlessStart = (prevEndsAt, startsAt) => renewalJoinOf(prevEndsAt, startsAt).seamless;
```

Em `deriveContractStatus`, trocar:

```js
  const startsAt = getSafeDateOrNull(contractLike.startsAt);
  if (startsAt && now.getTime() < startsAt.getTime()) return CONTRACT_STATUS.AGENDADO;
```

por:

```js
  // O emendado (seamless) não é agendado: o cliente não fica um dia sem
  // contrato, então segue para as regras de "A vencer" e "Ativo" pelo fim dele.
  const startsAt = getSafeDateOrNull(contractLike.startsAt);
  if (startsAt && now.getTime() < startsAt.getTime() && !contractLike.seamless) return CONTRACT_STATUS.AGENDADO;
```

E em `deriveLeadContractStatus`, trocar:

```js
    {
      status: lead?.currentContractStatus,
      startsAt: lead?.currentContractStartsAt,
      endsAt: lead?.currentContractEndsAt
    },
```

por:

```js
    {
      status: lead?.currentContractStatus,
      startsAt: lead?.currentContractStartsAt,
      endsAt: lead?.currentContractEndsAt,
      seamless: lead?.currentContractSeamless
    },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js
git commit -m "feat: renovação emendada conta como ativa, não agendada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 14: "CONTRATO AGENDADO" no cabeçalho e emendado como cliente ativo

**Files:**
- Modify: `src/lib/leadState.js`
- Test: `src/lib/__tests__/leadState.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Dentro do `describe('deriveLeadState', ...)`:

```js
  it('contrato com início no futuro é CONTRATO AGENDADO', () => {
    const state = deriveLeadState(cliente({ currentContractStartsAt: D(2026, 10, 1), currentContractEndsAt: D(2027, 10, 1) }), NOW);
    expect(state.key).toBe('agendado');
    expect(state.label).toBe('CONTRATO AGENDADO');
  });

  it('renovação emendada que ainda não começou é CLIENTE ATIVO', () => {
    const state = deriveLeadState(cliente({
      currentContractStartsAt: D(2026, 10, 1),
      currentContractEndsAt: D(2027, 10, 1),
      currentContractSeamless: true
    }), NOW);
    expect(state.key).toBe('cliente_ativo');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leadState.test.js`
Expected: FAIL no rótulo.

- [ ] **Step 3: Implementar**

Em `src/lib/leadState.js`, trocar:

```js
    if (cs === CONTRACT_STATUS.AGENDADO) return { key: 'agendado', tone: 'violet', label: 'MATRÍCULA AGENDADA', hint: 'A vigência ainda não começou' };
```

por:

```js
    // "CONTRATO AGENDADO", e não "MATRÍCULA": vale também para a renovação que
    // começa depois de um intervalo. A emendada não chega aqui (seamless).
    if (cs === CONTRACT_STATUS.AGENDADO) return { key: 'agendado', tone: 'violet', label: 'CONTRATO AGENDADO', hint: 'A vigência ainda não começou' };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leadState.test.js`
Expected: PASS. Depois, `grep -rn "MATRÍCULA AGENDADA" src` deve voltar vazio.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadState.js src/lib/__tests__/leadState.test.js
git commit -m "feat: selo CONTRATO AGENDADO no cabeçalho da ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 15: A renovação grava a marca e o encurtamento

**Files:**
- Modify: `src/lib/contracts.js`
- Test: `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No fim de `contracts.test.js`:

```js
describe('buildMatriculaWrites: renovação emendada e sobreposta', () => {
  const plan = { id: 'p1', name: 'Anual', value: 1308, durationMonths: 12 };
  const lead = {
    id: 'l1', name: 'Ana', consultantId: 'c1', consultantAuthUid: 'u1',
    currentContractId: 'k1', currentContractStartsAt: D(2025, 10, 11), currentContractEndsAt: D(2026, 10, 11)
  };
  const renovar = (startsAt) => buildMatriculaWrites({ lead, plan, value: 1308, startsAt, mode: 'renovacao', renewedFromId: 'k1' });

  it('começa no dia seguinte ao fim: emendada, sem encurtar o atual', () => {
    const r = renovar(D(2026, 10, 12));
    expect(r.contract.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
  });

  it('começa depois de um intervalo: não é emendada', () => {
    const r = renovar(D(2026, 10, 20));
    expect(r.contract.seamless).toBe(false);
    expect(r.previousPatch).toBeNull();
  });

  it('começa antes do fim: o atual termina na véspera do novo', () => {
    const r = renovar(D(2026, 9, 28));
    expect(r.contract.seamless).toBe(false);
    expect(r.previousContractId).toBe('k1');
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11) });
  });

  it('começa no próprio dia do fim também encurta', () => {
    expect(renovar(D(2026, 10, 11)).previousPatch).toEqual({ endsAt: D(2026, 10, 10), originalEndsAt: D(2026, 10, 11) });
  });

  it('matrícula nunca é emendada nem encurta nada', () => {
    const r = buildMatriculaWrites({ lead, plan, value: 1308, startsAt: D(2026, 10, 12) });
    expect(r.contract.seamless).toBe(false);
    expect(r.leadPatch.currentContractSeamless).toBe(false);
    expect(r.previousPatch).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `buildMatriculaWrites`, logo depois de `const listValue = Number(plan?.value) || 0;`, acrescentar:

```js
  // Renovação: como o contrato novo encosta no atual (renewalJoinOf). A
  // emendada conta como ativa desde já. A sobreposta encurta o atual para a
  // véspera do novo, e o fim de antes fica guardado para a renovação poder ser
  // desfeita (buildRenewalCancel).
  const currentEnd = isRenewal && lead?.currentContractId ? getSafeDateOrNull(lead?.currentContractEndsAt) : null;
  const join = currentEnd ? renewalJoinOf(currentEnd, start) : { seamless: false, overlaps: false, previousEndsAt: null };
```

No objeto `contract`, logo depois de `renewedFromId: renewedFromId || null,`, acrescentar:

```js
    seamless: join.seamless,
```

No `leadPatch`, logo depois de `currentContractStatus: CONTRACT_STATUS.ATIVO,`, acrescentar:

```js
    currentContractSeamless: join.seamless,
```

E no objeto devolvido, logo depois de `referrerInteractionText: referralConvertedText(lead?.name)`, acrescentar (com a vírgula na linha de cima):

```js
    // Sobreposição: o contrato atual a encurtar. O caller grava no mesmo batch
    // e acrescenta shortenedById com o id do contrato novo.
    previousContractId: join.overlaps ? lead.currentContractId : null,
    previousPatch: join.overlaps ? { endsAt: join.previousEndsAt, originalEndsAt: currentEnd } : null
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/clientImport.test.js`
Expected: PASS nos dois. O teste de paridade da importação compara uma lista fechada de campos e não inclui os novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js
git commit -m "feat: renovação grava se é emendada e encurta o contrato que sobrepõe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 16: O batch da matrícula grava o encurtamento

**Files:**
- Modify: `src/lib/contractsWrites.js`
- Create: `src/lib/__tests__/contractsWrites.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/contractsWrites.test.js`:

```js
// A gravação de contrato num batch só. Sem Firebase de verdade:
// firebase/firestore, ../firebase.js e ../aulasWrites.js são falsos.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ sets: [], seq: 0 }));

vi.mock('../firebase.js', () => ({
  appId: 'acad',
  LEADS_PATH: 'stronix_leads',
  INTERACTIONS_PATH: 'stronix_interactions',
  CONTRACTS_PATH: 'stronix_contratos'
}));
vi.mock('../aulasWrites.js', () => ({ markConvertingAula: vi.fn(async () => {}) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (parent, ...p) => {
    if (p.length === 0) {
      m.seq += 1;
      const id = `novo${m.seq}`;
      return { id, path: `${parent.path}/${id}` };
    }
    return { id: p[p.length - 1], path: p.join('/') };
  },
  increment: (n) => ({ increment: n }),
  serverTimestamp: () => 'TS',
  writeBatch: () => ({
    set: (ref, data, opts) => { m.sets.push({ path: ref.path, data, opts }); },
    commit: async () => {}
  })
}));

const { commitMatricula } = await import('../contractsWrites.js');

const D = (y, mo, d) => new Date(y, mo - 1, d);
const CONTRATOS = 'artifacts/acad/public/data/stronix_contratos';
const appUser = { id: 'c1', name: 'Bia', authUid: 'u1' };
const plan = { id: 'p1', name: 'Anual', value: 1308, durationMonths: 12 };
const lead = {
  id: 'l1', name: 'Ana', consultantId: 'c1', consultantName: 'Bia', consultantAuthUid: 'u1',
  lifecycleStage: 'cliente', isConverted: true, status: 'Venda', clienteSince: D(2025, 10, 11),
  currentContractId: 'k1', currentContractStartsAt: D(2025, 10, 11), currentContractEndsAt: D(2026, 10, 11)
};

beforeEach(() => { m.sets.length = 0; m.seq = 0; });

describe('commitMatricula: renovação e o contrato atual', () => {
  it('sobreposta: encurta o atual no mesmo batch e guarda quem encurtou', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1' });
    const atual = m.sets.find((s) => s.path === `${CONTRATOS}/k1`);
    expect(atual.data).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: contractId, updatedAt: 'TS' });
    expect(atual.opts).toEqual({ merge: true });
  });

  it('emendada: não toca no atual e o contrato novo leva a marca', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 10, 12), mode: 'renovacao', renewedFromId: 'k1' });
    expect(m.sets.some((s) => s.path === `${CONTRATOS}/k1`)).toBe(false);
    const novo = m.sets.find((s) => s.path === `${CONTRATOS}/${contractId}`);
    expect(novo.data.seamless).toBe(true);
    const leadDoc = m.sets.find((s) => s.path === 'artifacts/acad/public/data/stronix_leads/l1');
    expect(leadDoc.data.currentContractSeamless).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractsWrites.test.js`
Expected: FAIL no primeiro teste (`atual` é `undefined`). O segundo já pode passar, pela Task 15.

- [ ] **Step 3: Implementar**

Em `src/lib/contractsWrites.js`, no `commitMatricula`, trocar a desestruturação:

```js
  const {
    contract,
    leadPatch,
    interactionText,
    stampConvertedAt,
    setStatusVenda,
    stampClienteSince,
    notifyReferrerId,
    referrerInteractionText
  } = buildMatriculaWrites({ lead, plan, value, startsAt, appUser, mode, renewedFromId });
```

por:

```js
  const {
    contract,
    leadPatch,
    interactionText,
    stampConvertedAt,
    setStatusVenda,
    stampClienteSince,
    notifyReferrerId,
    referrerInteractionText,
    previousContractId,
    previousPatch
  } = buildMatriculaWrites({ lead, plan, value, startsAt, appUser, mode, renewedFromId });
```

E, logo depois de `batch.set(contractRef, { ...contract, ...(contractExtra || {}), createdAt: serverTimestamp() });`, acrescentar:

```js
  // (1b) Renovação que começa antes do fim do atual: o atual passa a terminar
  //      na véspera do novo, no mesmo batch, e guarda quem o encurtou.
  if (previousContractId && previousPatch) {
    batch.set(
      doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, previousContractId),
      { ...previousPatch, shortenedById: contractRef.id, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractsWrites.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractsWrites.js src/lib/__tests__/contractsWrites.test.js
git commit -m "feat: renovação sobreposta encerra o contrato atual na véspera do novo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 17: `computeSeam` por dia do calendário e aviso sem travessão

**Files:**
- Modify: `src/lib/renewal.js`
- Test: `src/lib/__tests__/renewal.test.js`

A conta atual trata "começar no próprio dia do fim" como emenda perfeita e conta a sobreposição com um dia a menos. Com a gravação da Task 15, o modal passaria a dizer uma coisa e o sistema a fazer outra. Os testes existentes mudam de 25 para 26 dias, de propósito.

- [ ] **Step 1: Ajustar e acrescentar testes**

Em `renewal.test.js`, no `describe('computeSeam', ...)`, trocar o teste:

```js
  it('começar hoje, 25 dias antes do vencimento, sobrepõe 25 dias', () => {
    const seam = computeSeam(end, D(2026, 7, 27));
    expect(seam.kind).toBe(SEAM_KIND.SOBREPOSICAO);
    expect(seam.gapDays).toBe(-25);
    expect(seam.overlapDays).toBe(25);
  });
```

por:

```js
  it('começar 25 dias antes do fim sobrepõe 26: o dia do fim entra nos dois', () => {
    const seam = computeSeam(end, D(2026, 7, 27));
    expect(seam.kind).toBe(SEAM_KIND.SOBREPOSICAO);
    expect(seam.gapDays).toBe(-26);
    expect(seam.overlapDays).toBe(26);
  });

  it('começar no próprio dia do fim sobrepõe um dia, não é emenda', () => {
    const seam = computeSeam(end, D(2026, 8, 21));
    expect(seam.kind).toBe(SEAM_KIND.SOBREPOSICAO);
    expect(seam.overlapDays).toBe(1);
  });

  it('conta dias do calendário: o horário não muda o encaixe', () => {
    expect(computeSeam(new Date(2026, 7, 21, 23, 0), new Date(2026, 7, 22, 1, 0)).kind).toBe(SEAM_KIND.EMENDA);
    expect(computeSeam(new Date(2026, 7, 21, 1, 0), new Date(2026, 7, 21, 23, 0)).kind).toBe(SEAM_KIND.SOBREPOSICAO);
  });
```

No `describe('seamLabel', ...)`, trocar `'Sobreposição de 25 dias com o contrato atual.'` por `'Sobreposição de 26 dias com o contrato atual.'`.

No `describe('seamWarning', ...)`, trocar o teste da sobreposição por:

```js
  it('na sobreposição diz a data em que o contrato atual passa a terminar', () => {
    const warn = seamWarning(computeSeam(end, D(2026, 7, 27)), D(2026, 7, 27));
    expect(warn).toMatch(/26\/07\/2026/);
    expect(warn).toMatch(/26 dias antes/);
    expect(warn).not.toMatch(/—/);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/renewal.test.js`
Expected: FAIL nos testes alterados.

- [ ] **Step 3: Implementar**

Em `src/lib/renewal.js`, trocar o import de `dates.js` por:

```js
import { addDays, calendarDaysBetween, daysBetween, getSafeDateOrNull } from './dates.js';
```

Trocar `computeSeam` inteira por:

```js
// Encaixe da vigência nova na atual, em dias do calendário (a mesma conta de
// renewalJoinOf, em contracts.js, que decide o que a gravação faz). Emendar
// (início no dia seguinte ao fim) é lacuna zero. Começar no próprio dia do fim
// já sobrepõe um dia: o fim entra na vigência dos dois.
export function computeSeam(currentEndsAt, startsAt) {
  const diff = calendarDaysBetween(currentEndsAt, startsAt);
  if (diff == null) return null;
  const gapDays = diff - 1;
  return {
    gapDays,
    overlapDays: gapDays < 0 ? Math.abs(gapDays) : 0,
    kind: gapDays === 0
      ? SEAM_KIND.EMENDA
      : gapDays > 0 ? SEAM_KIND.LACUNA : SEAM_KIND.SOBREPOSICAO
  };
}
```

E, em `seamWarning`, trocar o `return` da sobreposição por:

```js
    const n = seam.overlapDays;
    return `O contrato atual passa a terminar em ${lastDay}, ${n} ${n === 1 ? 'dia' : 'dias'} antes do previsto, e os dias já pagos se perdem. Para não perder, emende no fim do atual ou dê o período como desconto.`;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/renewal.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/renewal.js src/lib/__tests__/renewal.test.js
git commit -m "fix: encaixe da renovação conta dias do calendário

Começar no próprio dia do fim deixa de contar como emenda perfeita.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 18: Modal de renovação: bloqueios, dica e o que será gravado

**Files:**
- Modify: `src/lib/contracts.js`
- Modify: `src/modals/ContractModal.jsx`
- Test: `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No import de `contracts.test.js`, acrescentar `renewalStartProblem,`. No fim:

```js
describe('renewalStartProblem', () => {
  it('contrato trancado não renova', () => {
    expect(renewalStartProblem({ status: 'trancado', startsAt: D(2025, 10, 11) }, D(2026, 10, 12)))
      .toBe('Este contrato está trancado. Reative o contrato antes de renovar.');
  });

  it('renovação não começa no dia do início do contrato renovado, nem antes', () => {
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2025, 10, 11)))
      .toBe('A renovação precisa começar depois do início do contrato renovado (11/10/2025).');
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2025, 10, 1))).not.toBeNull();
  });

  it('sem problema devolve null', () => {
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2026, 10, 12))).toBeNull();
    expect(renewalStartProblem({}, D(2026, 10, 12))).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar a regra**

Em `src/lib/contracts.js`, logo depois de `isSeamlessStart`, acrescentar:

```js
// Por que uma renovação não pode ser gravada, ou null. Contrato trancado: o
// fim dele ainda anda na reativação, então emendar ou encurtar daria conta
// errada. Início no dia do início do contrato renovado, ou antes, encurtaria
// esse contrato para antes de ele começar.
export function renewalStartProblem({ status, startsAt: prevStartsAt } = {}, startsAt) {
  if (status === CONTRACT_STATUS.TRANCADO) return 'Este contrato está trancado. Reative o contrato antes de renovar.';
  const prevStart = getSafeDateOrNull(prevStartsAt);
  const diff = calendarDaysBetween(prevStart, startsAt);
  if (diff != null && diff <= 0) return `A renovação precisa começar depois do início do contrato renovado (${fmtDia(prevStart)}).`;
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: PASS.

- [ ] **Step 5: Modal**

Em `src/modals/ContractModal.jsx`, trocar:

```js
import { computeEndsAt } from '../lib/contracts.js';
```

por:

```js
import { computeEndsAt, renewalJoinOf, renewalStartProblem } from '../lib/contracts.js';
```

Logo depois de `const warningIsSevere = isRenewal && seam?.kind === SEAM_KIND.SOBREPOSICAO;`, acrescentar:

```js
  // Renovação que não pode ser gravada (contrato trancado, ou início antes do
  // contrato atual começar).
  const startProblem = isRenewal
    ? renewalStartProblem({ status: lead?.currentContractStatus, startsAt: lead?.currentContractStartsAt }, startsAt)
    : null;
  // O que a gravação faz com o contrato atual: a mesma regra de commitMatricula.
  const join = isRenewal && refEnd && startsAt ? renewalJoinOf(refEnd, startsAt) : null;
  // Quantos dias o "Começar hoje" tira do contrato atual, em dias do calendário.
  const todaySeam = isRenewal && refEnd ? computeSeam(refEnd, new Date()) : null;
```

No `handleConfirm`, logo depois de `if (!startsAt) { toast.warning('Informe a data de início.'); return; }`, acrescentar:

```js
    if (startProblem) { toast.warning(startProblem); return; }
```

Na opção `hoje` de `startOptions`, trocar:

```js
      hint: isRenewal && refDaysLeft != null && refDaysLeft > 0
        ? `${fmtDate(new Date())} · encerra o atual ${refDaysLeft} dias antes`
        : fmtDate(new Date()),
```

por:

```js
      hint: todaySeam?.kind === SEAM_KIND.SOBREPOSICAO
        ? `${fmtDate(new Date())} · encerra o atual ${todaySeam.overlapDays} ${todaySeam.overlapDays === 1 ? 'dia' : 'dias'} antes`
        : fmtDate(new Date()),
```

No `writes` da renovação, trocar:

```js
    ? [
      `Contrato novo, ligado ao ${lead?.currentContractId ? `#${shortId(lead.currentContractId)}` : 'contrato atual'}`,
      'Resumo no cliente: plano, valor e vigência',
```

por:

```js
    ? [
      `Contrato novo, ligado ao ${lead?.currentContractId ? `#${shortId(lead.currentContractId)}` : 'contrato atual'}`,
      ...(join?.overlaps ? [`O contrato atual passa a terminar em ${fmtDate(join.previousEndsAt)}`] : []),
      'Resumo no cliente: plano, valor e vigência',
```

E, logo antes de `{warning && (`, acrescentar:

```jsx
                {startProblem && (
                  <div className="flex items-start gap-2.5 mt-2.5 px-3 py-2.5 rounded-[11px] border border-rose-300/60 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/10">
                    <p className="min-w-0 flex-1 text-[12px] leading-[1.5] font-semibold text-rose-700 dark:text-rose-300 text-pretty">{startProblem}</p>
                  </div>
                )}
```

O `refDaysLeft` continua em uso no chip do cabeçalho do modal.

- [ ] **Step 6: Lint e build**

Run: `npx eslint src/modals/ContractModal.jsx src/lib/contracts.js && npm run build`
Expected: sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js src/modals/ContractModal.jsx
git commit -m "feat: modal de renovação bloqueia trancado e mostra quando o contrato atual é encurtado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 19: "Em uso" e "Renovado" no Histórico

**Files:**
- Modify: `src/lib/contractHistory.js`
- Test: `src/lib/__tests__/contractHistory.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No import de `contractHistory.test.js`, trocar a linha do `contractHistory.js` por:

```js
import {
  CONTRACT_ORIGIN, HISTORY_STATUS, contractEndOf, contractOriginOf, historyStatusOf, runningPredecessorOf
} from '../contractHistory.js';
```

No fim:

```js
describe('historyStatusOf e runningPredecessorOf', () => {
  const HOJE = D(2026, 9, 28);
  const atual = { id: 'k1', leadId: L, planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const renovacao = { id: 'k2', leadId: L, planName: 'Flow', status: 'ativo', renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };

  it('contrato com renovação que ainda não começou está em uso', () => {
    expect(historyStatusOf(atual, [atual, renovacao], HOJE)).toBe(HISTORY_STATUS.EM_USO);
  });

  it('depois que a renovação começa, vira renovado', () => {
    expect(historyStatusOf(atual, [atual, renovacao], D(2026, 10, 12))).toBe(HISTORY_STATUS.RENOVADO);
  });

  it('renovação cancelada antes de começar não conta', () => {
    const desistiu = { ...renovacao, status: 'cancelado', cancelledAt: D(2026, 9, 20) };
    expect(historyStatusOf(atual, [atual, desistiu], HOJE)).toBe('a_vencer');
  });

  it('cancelado continua cancelado, e sem renovação vale o status comum', () => {
    expect(historyStatusOf({ ...atual, status: 'cancelado', cancelledAt: D(2026, 5, 1) }, [atual, renovacao], HOJE)).toBe('cancelado');
    expect(historyStatusOf(atual, [atual], HOJE)).toBe('a_vencer');
  });

  it('runningPredecessorOf acha o contrato em uso da renovação', () => {
    expect(runningPredecessorOf(renovacao, [atual, renovacao], HOJE)).toBe(atual);
    expect(runningPredecessorOf(renovacao, [atual, renovacao], D(2026, 10, 12))).toBeNull();
    expect(runningPredecessorOf(atual, [atual, renovacao], HOJE)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractHistory.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `src/lib/contractHistory.js`, trocar os imports por:

```js
import { CONTRACT_STATUS, deriveContractStatus } from './contracts.js';
import { calendarDaysBetween, daysBetween, getSafeDateOrNull } from './dates.js';
```

E acrescentar no fim do arquivo:

```js
// Selos do Histórico que não são status do contrato: dizem que ele já tem
// renovação ligada.
export const HISTORY_STATUS = { EM_USO: 'em_uso', RENOVADO: 'renovado' };
export const HISTORY_STATUS_LABEL = { em_uso: 'Em uso', renovado: 'Renovado' };

// Cancelado antes do dia de início: nunca valeu.
const cancelledBeforeStart = (c) => {
  if (c?.status !== CONTRACT_STATUS.CANCELADO) return false;
  const diff = calendarDaysBetween(c.cancelledAt, c.startsAt);
  return diff != null && diff > 0;
};

// Status do contrato na lista do Histórico. Com renovação ligada, "Em uso"
// enquanto já começou e o fim não chegou, e "Renovado" depois do fim ou quando
// a renovação começa. Antes, o contrato em uso aparecia "A vencer" com o aluno
// já renovado. A renovação cancelada antes de começar não conta.
export function historyStatusOf(contract, leadContracts, now = new Date(), thresholdDays) {
  const base = deriveContractStatus(contract, now, thresholdDays) || CONTRACT_STATUS.VENCIDO;
  if (base === CONTRACT_STATUS.CANCELADO || base === CONTRACT_STATUS.AGENDADO) return base;
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const renewals = list.filter((o) => o?.renewedFromId === contract?.id && !cancelledBeforeStart(o));
  if (!renewals.length) return base;
  const ref = getSafeDateOrNull(now) || new Date();
  const renewalStarted = renewals.some((r) => {
    const s = getSafeDateOrNull(r.startsAt);
    return Boolean(s && s.getTime() <= ref.getTime());
  });
  const end = contractEndOf(contract);
  const ended = end ? calendarDaysBetween(ref, end) < 0 : false;
  return renewalStarted || ended ? HISTORY_STATUS.RENOVADO : HISTORY_STATUS.EM_USO;
}

// O contrato que a renovação continua, quando ele ainda vale: já começou, não
// foi cancelado e o fim não passou. É o que o card mostra como "em uso"
// enquanto a renovação não começa.
export function runningPredecessorOf(contract, leadContracts, now = new Date()) {
  if (!contract?.renewedFromId) return null;
  const prev = (leadContracts || []).find((c) => c?.id === contract.renewedFromId);
  if (!prev || prev.status === CONTRACT_STATUS.CANCELADO) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  const start = getSafeDateOrNull(prev.startsAt);
  if (start && start.getTime() > ref.getTime()) return null;
  const nextStart = getSafeDateOrNull(contract.startsAt);
  if (nextStart && nextStart.getTime() <= ref.getTime()) return null;
  const end = contractEndOf(prev);
  if (!end || calendarDaysBetween(ref, end) < 0) return null;
  return prev;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractHistory.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractHistory.js src/lib/__tests__/contractHistory.test.js
git commit -m "feat: selos Em uso e Renovado para o contrato que já tem renovação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 20: Card e Histórico com a renovação que ainda não começou

**Files:**
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Imports**

Trocar:

```js
import { contractVigencia, daysBetween, missedCheckpointsLabel, vigenciaRefDate } from '../lib/renewal.js';
import { CONTRACT_ORIGIN, contractEndOf, contractOriginOf } from '../lib/contractHistory.js';
```

por:

```js
import { SEAM_KIND, computeSeam, contractVigencia, daysBetween, missedCheckpointsLabel, vigenciaRefDate } from '../lib/renewal.js';
import {
  CONTRACT_ORIGIN, HISTORY_STATUS, HISTORY_STATUS_LABEL, contractEndOf, contractOriginOf, historyStatusOf, runningPredecessorOf
} from '../lib/contractHistory.js';
```

- [ ] **Step 2: Tons dos selos novos**

No `CONTRACT_TONE`, depois da linha do `CANCELADO`, acrescentar (vírgula na linha anterior):

```js
  // Selos do Histórico (lib/contractHistory.js).
  [HISTORY_STATUS.EM_USO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [HISTORY_STATUS.RENOVADO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' }
```

- [ ] **Step 3: Contrato em uso no card**

No bloco do contrato vivo, logo depois de `const value = lead.currentContractValue;`, acrescentar:

```js
                // Contrato que ainda não começou, com o anterior em uso: a
                // régua não marca hoje e a faixa diz qual contrato vale agora.
                const notStarted = Boolean(curStartsAt && curStartsAt.getTime() > Date.now());
                const inUse = notStarted ? runningPredecessorOf(currentContract, leadContracts, new Date()) : null;
                const inUseEnd = contractEndOf(inUse);
                const seamlessNow = Boolean(currentContract?.seamless || lead.currentContractSeamless);
                const inUseGap = inUse && inUseEnd && curStartsAt ? computeSeam(inUseEnd, curStartsAt) : null;
                const inUseNote = inUse && inUseEnd
                  ? seamlessNow
                    ? `Continua o contrato em uso (${inUse.planName || 'Plano'}, até ${inUseEnd.toLocaleDateString('pt-BR')})`
                    : `Contrato em uso: ${inUse.planName || 'Plano'}, até ${inUseEnd.toLocaleDateString('pt-BR')}${inUseGap?.kind === SEAM_KIND.LACUNA ? ` · ${inUseGap.gapDays} ${inUseGap.gapDays === 1 ? 'dia' : 'dias'} sem contrato entre os dois` : ''}`
                  : null;
```

Trocar o marcador de hoje:

```jsx
                        {!scheduled && (
```

por:

```jsx
                        {!notStarted && (
```

E trocar:

```jsx
                      {scheduled && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className={cn('text-[11.5px] font-semibold flex-none', tone.fg)}>A vigência ainda não começou</span>
                        </>
                      )}
```

por:

```jsx
                      {(scheduled || inUseNote) && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className={cn('text-[11.5px] font-semibold', tone.fg)}>{inUseNote || 'A vigência ainda não começou'}</span>
                        </>
                      )}
```

- [ ] **Step 4: Selos do Histórico**

Trocar:

```js
                  const hStatus = deriveContractStatus(c, new Date(), contractThresholdDays) || CONTRACT_STATUS.VENCIDO;
```

por:

```js
                  // "Em uso" e "Renovado" no contrato que já tem renovação
                  // ligada. Antes ele aparecia "A vencer" com o aluno renovado.
                  const hStatus = historyStatusOf(c, leadContracts, new Date(), contractThresholdDays);
```

E trocar o rótulo do chip do Histórico:

```jsx
                            {CONTRACT_STATUS_LABEL[hStatus]}
                          </span>
                        </span>
```

por:

```jsx
                            {CONTRACT_STATUS_LABEL[hStatus] || HISTORY_STATUS_LABEL[hStatus]}
                          </span>
                        </span>
```

Conferir com `grep -n "CONTRACT_STATUS_LABEL\[hStatus\]" src/views/LeadProfileView.jsx` que só o chip do Histórico mudou. Se `deriveContractStatus` ficar sem uso no arquivo, tirar do import de `contracts.js`.

- [ ] **Step 5: Lint e build**

Run: `npx eslint src/views/LeadProfileView.jsx && npm run build`
Expected: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "feat: aba Contratos mostra o contrato em uso enquanto a renovação não começa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 21: Cancelar renovação que ainda não começou

**Files:**
- Modify: `src/lib/contracts.js`
- Modify: `src/lib/contractsWrites.js`
- Test: `src/lib/__tests__/contracts.test.js`
- Test: `src/lib/__tests__/contractsWrites.test.js`

- [ ] **Step 1: Escrever os testes da regra**

No import de `contracts.test.js`, acrescentar `buildRenewalCancel,` e `isRenewalNotStarted,`. No fim:

```js
describe('renovação cancelada antes de começar', () => {
  const previous = {
    id: 'k1', planName: 'Start', value: 1308, status: 'ativo', seamless: false,
    startsAt: D(2025, 10, 11), endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2'
  };
  const renewal = { id: 'k2', planName: 'Flow', renewedFromId: 'k1', status: 'ativo', startsAt: D(2026, 9, 28), endsAt: D(2027, 9, 28) };

  it('vale quando o cancelamento vem antes do dia de início', () => {
    expect(isRenewalNotStarted(renewal, previous, D(2026, 9, 27))).toBe(true);
    expect(isRenewalNotStarted(renewal, previous, D(2026, 9, 28))).toBe(false);
  });

  it('não vale sem o contrato renovado, com ele cancelado ou sem ligação', () => {
    expect(isRenewalNotStarted(renewal, null, D(2026, 9, 20))).toBe(false);
    expect(isRenewalNotStarted(renewal, { ...previous, status: 'cancelado' }, D(2026, 9, 20))).toBe(false);
    expect(isRenewalNotStarted({ ...renewal, renewedFromId: null }, previous, D(2026, 9, 20))).toBe(false);
  });

  it('restaura o fim encurtado e devolve o resumo ao contrato anterior', () => {
    const r = buildRenewalCancel({ contract: renewal, previous, cancelledAt: D(2026, 9, 20), reason: 'Financeiro' });
    expect(r.contractPatch).toMatchObject({ status: 'cancelado', cancelledAt: D(2026, 9, 20), cancelReason: 'Financeiro', cancelNote: null });
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
    expect(r.leadPatch).toEqual({
      currentContractId: 'k1',
      currentPlanName: 'Start',
      currentContractValue: 1308,
      currentContractStartsAt: D(2025, 10, 11),
      currentContractEndsAt: D(2026, 10, 11),
      currentContractStatus: 'ativo',
      currentContractSeamless: false
    });
    expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow, motivo Financeiro. O contrato Plano Start volta a valer até 11/10/2026.');
  });

  it('renovação emendada: o anterior não foi encurtado e fica como está', () => {
    const r = buildRenewalCancel({
      contract: { ...renewal, startsAt: D(2026, 10, 12), seamless: true },
      previous: { ...previous, endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null },
      cancelledAt: D(2026, 9, 20)
    });
    expect(r.previousPatch).toBeNull();
    expect(r.leadPatch.currentContractEndsAt).toEqual(D(2026, 10, 11));
  });
});
```

- [ ] **Step 2: Escrever o teste da gravação**

Em `contractsWrites.test.js`, trocar `const { commitMatricula } = await import('../contractsWrites.js');` por:

```js
const { commitContractPatch, commitMatricula } = await import('../contractsWrites.js');
```

No fim:

```js
describe('commitContractPatch: contrato anterior no mesmo batch', () => {
  const base = {
    db: {}, lead, appUser, contractId: 'k2',
    contractPatch: { status: 'cancelado' }, leadPatch: { currentContractId: 'k1' }, interactionText: 'Renovação cancelada antes de começar.'
  };

  it('grava o anterior quando vem o patch dele', async () => {
    await commitContractPatch({ ...base, previousContractId: 'k1', previousContractPatch: { endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null } });
    const anterior = m.sets.find((s) => s.path === `${CONTRATOS}/k1`);
    expect(anterior.data).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null, updatedAt: 'TS' });
  });

  it('sem patch do anterior, grava só contrato, lead e linha do tempo', async () => {
    await commitContractPatch(base);
    expect(m.sets).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsWrites.test.js`
Expected: FAIL.

- [ ] **Step 4: Implementar a regra**

Em `src/lib/contracts.js`, logo depois de `buildContractCancel`, acrescentar:

```js
// Renovação cancelada antes do dia de início: nunca valeu, e o cliente volta
// ao contrato que ela renovava. Vale quando o contrato renovado existe, é o
// ligado e não foi cancelado.
export function isRenewalNotStarted(contract, previous, at) {
  if (!contract?.renewedFromId || !previous || previous.id !== contract.renewedFromId) return false;
  if (previous.status === CONTRACT_STATUS.CANCELADO) return false;
  const diff = calendarDaysBetween(at, contract.startsAt);
  return diff != null && diff > 0;
}

// Desfaz a renovação que ainda não começou. O fim do contrato renovado volta
// ao original, se foi esta renovação que o encurtou, e o resumo do lead volta
// para ele. Os marcos de renovação seguem zerados, como a renovação deixou: se
// o contrato renovado estiver perto do fim, a Meta Diária volta a cobrar.
export function buildRenewalCancel({ contract, previous, cancelledAt, reason, note } = {}) {
  const when = getSafeDateOrNull(cancelledAt) || new Date();
  const original = getSafeDateOrNull(previous?.originalEndsAt);
  const shortenedByThis = Boolean(previous?.shortenedById && previous.shortenedById === contract?.id && original);
  const restoredEnd = shortenedByThis ? original : getSafeDateOrNull(previous?.endsAt);
  const planName = contract?.planName || null;
  const prevPlan = previous?.planName || null;
  const prevValue = Number(previous?.value);
  return {
    contractPatch: {
      status: CONTRACT_STATUS.CANCELADO,
      cancelledAt: when,
      cancelReason: reason || null,
      cancelNote: note || null
    },
    previousPatch: shortenedByThis ? { endsAt: restoredEnd, originalEndsAt: null, shortenedById: null } : null,
    leadPatch: {
      currentContractId: previous?.id || null,
      currentPlanName: prevPlan,
      currentContractValue: Number.isFinite(prevValue) ? prevValue : null,
      currentContractStartsAt: getSafeDateOrNull(previous?.startsAt),
      currentContractEndsAt: restoredEnd,
      currentContractStatus: previous?.status || CONTRACT_STATUS.ATIVO,
      currentContractSeamless: Boolean(previous?.seamless)
    },
    interactionText: `Renovação cancelada antes de começar: ${planName ? `Plano ${planName}` : 'renovação'}${reason ? `, motivo ${reason}` : ''}. O contrato ${prevPlan ? `Plano ${prevPlan}` : 'anterior'} volta a valer até ${fmtDia(restoredEnd)}.`
  };
}
```

- [ ] **Step 5: Implementar a gravação**

Em `src/lib/contractsWrites.js`, trocar a assinatura de `commitContractPatch`:

```js
export async function commitContractPatch({
  db,
  lead,
  appUser,
  contractId,
  contractPatch,
  leadPatch,
  interactionText
}) {
```

por:

```js
export async function commitContractPatch({
  db,
  lead,
  appUser,
  contractId,
  contractPatch,
  leadPatch,
  interactionText,
  previousContractId = null,
  previousContractPatch = null
}) {
```

E, logo depois do primeiro `batch.set` (o do contrato), acrescentar:

```js
  // Segundo contrato, quando o desfecho mexe no contrato renovado (cancelar a
  // renovação que não começou, corrigir o início de uma renovação).
  if (previousContractId && previousContractPatch) {
    batch.set(
      doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, previousContractId),
      { ...previousContractPatch, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsWrites.test.js src/lib/__tests__/timeline.test.js`
Expected: PASS. O `contractEventOf` já lê o texto novo (teste da Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/lib/contracts.js src/lib/contractsWrites.js src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsWrites.test.js
git commit -m "feat: cancelar renovação que não começou devolve o cliente ao contrato em uso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 22: Modal de cancelar reconhece a renovação que não começou

**Files:**
- Modify: `src/modals/ContractOutcomeModal.jsx`

- [ ] **Step 1: Imports**

Trocar:

```js
import {
  CONTRACT_CANCEL_REASONS,
  CONTRACT_PAUSE_REASONS,
  buildContractCancel,
  buildContractPause,
  buildContractResume
} from '../lib/contracts.js';
```

por:

```js
import {
  CONTRACT_CANCEL_REASONS,
  CONTRACT_PAUSE_REASONS,
  buildContractCancel,
  buildContractPause,
  buildContractResume,
  buildRenewalCancel,
  isRenewalNotStarted
} from '../lib/contracts.js';
```

E acrescentar, junto do import de `ToastContext`:

```js
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
```

- [ ] **Step 2: Renovação desfeita**

Logo depois de `const endsAt = getSafeDateOrNull(contract?.endsAt);`, acrescentar:

```js
  // Cancelar uma renovação que ainda não começou desfaz a renovação: o cliente
  // volta ao contrato que ela renovava (buildRenewalCancel).
  const { contratos } = useGeneralConfig();
  const previous = contract?.renewedFromId
    ? (contratos || []).find(c => c.id === contract.renewedFromId) || null
    : null;
  const undo = action === 'cancelar' && when && isRenewalNotStarted(contract, previous, when)
    ? buildRenewalCancel({ contract, previous, cancelledAt: when, reason, note: note.trim() || null })
    : null;
  const primeiro = (lead?.name || '').trim().split(/\s+/)[0] || 'o cliente';
```

No `preview`, trocar o começo da função:

```js
  const preview = (() => {
    if (action === 'reativar') {
```

por:

```js
  const preview = (() => {
    if (undo) {
      const volta = getSafeDateOrNull(undo.leadPatch.currentContractEndsAt);
      return `A renovação é desfeita e ${primeiro} volta ao contrato em uso (${previous?.planName || 'Plano'}, até ${fmtDate(volta)}).`;
    }
    if (action === 'reativar') {
```

E, no fim do mesmo `preview`, trocar:

```js
    const primeiro = (lead?.name || '').trim().split(/\s+/)[0] || 'o cliente';
    return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''} e ${primeiro} passa a contar como inativo. O histórico fica registrado.`;
```

por:

```js
    return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''} e ${primeiro} passa a contar como inativo. O histórico fica registrado.`;
```

- [ ] **Step 3: Gravação**

No `handleConfirm`, trocar:

```js
      const built = action === 'cancelar'
        ? buildContractCancel({ planName, cancelledAt: when, reason, note: note.trim() || null })
        : action === 'trancar'
          ? buildContractPause({ planName, pausedAt: when, reason })
          : buildContractResume({ contract, resumedAt: when });

      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText
      });

      toast.success(
        action === 'cancelar' ? 'Contrato cancelado.'
          : action === 'trancar' ? 'Contrato trancado.'
            : 'Contrato reativado.'
      );
```

por:

```js
      const built = undo
        ? undo
        : action === 'cancelar'
          ? buildContractCancel({ planName, cancelledAt: when, reason, note: note.trim() || null })
          : action === 'trancar'
            ? buildContractPause({ planName, pausedAt: when, reason })
            : buildContractResume({ contract, resumedAt: when });

      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        previousContractId: undo?.previousPatch ? previous.id : null,
        previousContractPatch: undo?.previousPatch || null
      });

      toast.success(
        undo ? 'Renovação cancelada.'
          : action === 'cancelar' ? 'Contrato cancelado.'
            : action === 'trancar' ? 'Contrato trancado.'
              : 'Contrato reativado.'
      );
```

- [ ] **Step 4: Título e botão**

Trocar `<DialogTitle className="font-display text-[18px] font-bold tracking-tight">{cfg.title}</DialogTitle>` por:

```jsx
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">{undo ? 'Cancelar renovação' : cfg.title}</DialogTitle>
```

E trocar `{submitting ? cfg.saving : cfg.confirm}` por:

```jsx
            {submitting ? cfg.saving : undo ? 'Cancelar renovação' : cfg.confirm}
```

- [ ] **Step 5: Lint e build**

Run: `npx eslint src/modals/ContractOutcomeModal.jsx && npm run build`
Expected: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/modals/ContractOutcomeModal.jsx
git commit -m "feat: modal de cancelar desfaz a renovação que ainda não começou

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 23: Corrigir a renovação recalcula a emenda e o encurtamento

**Files:**
- Modify: `src/lib/contracts.js`
- Test: `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No fim de `contracts.test.js`:

```js
describe('buildContractEdit: renovação com o contrato anterior', () => {
  const plano = { id: 'p1', name: 'Flow', value: 1308, durationMonths: 12 };
  const anterior = { id: 'k1', planName: 'Start', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const renovacao = { id: 'k2', planId: 'p1', planName: 'Flow', value: 1308, listValue: 1308, durationMonths: 12, renewedFromId: 'k1', startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), seamless: true };
  const corrigir = (startsAt, previous = anterior, contract = renovacao) =>
    buildContractEdit({ contract, plan: plano, value: 1308, startsAt, previous });

  it('continua emendada: nada muda no anterior', () => {
    const r = corrigir(D(2026, 10, 12));
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toBeNull();
  });

  it('passa a sobrepor: encurta o anterior', () => {
    const r = corrigir(D(2026, 9, 28));
    expect(r.contractPatch.seamless).toBe(false);
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
  });

  it('deixa de sobrepor: o anterior volta ao fim original', () => {
    const encurtado = { ...anterior, endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const r = corrigir(D(2026, 10, 12), encurtado, { ...renovacao, seamless: false, startsAt: D(2026, 9, 28) });
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
  });

  it('contrato sem ligação não mexe em anterior nenhum', () => {
    const r = buildContractEdit({ contract: { ...renovacao, renewedFromId: null, seamless: false }, plan: plano, value: 1308, startsAt: D(2026, 10, 12) });
    expect(r.previousPatch).toBeNull();
    expect(r.contractPatch.seamless).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `buildContractEdit` (versão da Task 7), trocar a assinatura:

```js
export const buildContractEdit = ({ contract, plan, value, startsAt, discountReason } = {}) => {
```

por:

```js
export const buildContractEdit = ({ contract, plan, value, startsAt, discountReason, previous = null } = {}) => {
```

Logo antes do `return {`, acrescentar:

```js
  // Renovação corrigida: a marca de emendado e o fim do contrato renovado
  // acompanham o início novo. O fim de referência é o original quando foi
  // esta renovação que encurtou o anterior.
  let seamless = Boolean(contract?.seamless);
  let previousPatch = null;
  if (contract?.renewedFromId && previous && previous.id === contract.renewedFromId) {
    const original = getSafeDateOrNull(previous.originalEndsAt);
    const shortenedByThis = Boolean(previous.shortenedById && previous.shortenedById === contract.id && original);
    const refEnd = shortenedByThis ? original : getSafeDateOrNull(previous.endsAt);
    const join = renewalJoinOf(refEnd, start);
    seamless = join.seamless;
    if (join.overlaps) previousPatch = { endsAt: join.previousEndsAt, originalEndsAt: refEnd, shortenedById: contract.id };
    else if (shortenedByThis) previousPatch = { endsAt: refEnd, originalEndsAt: null, shortenedById: null };
  }
```

No `contractPatch` devolvido, acrescentar `seamless,` depois de `endsAt,`. No `leadPatch`, acrescentar `currentContractSeamless: seamless,` depois de `currentContractEndsAt: endsAt,` (com a vírgula). E no objeto devolvido, depois de `leadPatch: {...},`, acrescentar:

```js
    previousPatch,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: PASS, inclusive os testes de desconto da Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js
git commit -m "feat: corrigir o início da renovação recalcula a emenda e o fim do contrato anterior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 24: Modal de correção com o contrato anterior

**Files:**
- Modify: `src/modals/ContractEditModal.jsx`

- [ ] **Step 1: Import e contrato anterior**

Trocar `import { buildContractEdit } from '../lib/contracts.js';` por:

```js
import { buildContractEdit, renewalStartProblem } from '../lib/contracts.js';
```

Trocar `const { planos } = useGeneralConfig();` por:

```js
  const { planos, contratos } = useGeneralConfig();
  // Contrato que esta renovação continua: corrigir a data mexe no fim dele.
  const previous = contract?.renewedFromId
    ? (contratos || []).find(c => c.id === contract.renewedFromId) || null
    : null;
```

- [ ] **Step 2: Prévia com o anterior**

Trocar:

```js
  const preview = plan && startsAt
    ? buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason })
    : null;
```

por:

```js
  const startProblem = previous && startsAt ? renewalStartProblem({ startsAt: previous.startsAt }, startsAt) : null;
  const preview = plan && startsAt
    ? buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason, previous })
    : null;
  const anteriorFim = getSafeDateOrNull(preview?.previousPatch?.endsAt);
```

- [ ] **Step 3: Gravação**

No `handleConfirm`, logo depois da checagem do motivo do desconto, acrescentar:

```js
    if (startProblem) { toast.warning(startProblem); return; }
```

E trocar:

```js
      const built = buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason });
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText
      });
```

por:

```js
      const built = buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason, previous });
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        previousContractId: built.previousPatch ? previous.id : null,
        previousContractPatch: built.previousPatch
      });
```

- [ ] **Step 4: Aviso na tela**

Trocar:

```jsx
                {pausedDaysTotal > 0 && <> Os {pausedDaysTotal} dias já trancados seguem contados.</>}
```

por:

```jsx
                {pausedDaysTotal > 0 && <> Os {pausedDaysTotal} dias já trancados seguem contados.</>}
                {anteriorFim && <> O contrato anterior ({previous?.planName || 'Plano'}) passa a terminar em <span className="num font-semibold">{anteriorFim.toLocaleDateString('pt-BR')}</span>.</>}
```

E, logo antes da `<div className="rounded-[10px] bg-slate-50 ...">` da prévia, acrescentar:

```jsx
          {startProblem && (
            <p className="rounded-[10px] border border-rose-300/60 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/10 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:text-rose-300 text-pretty">
              {startProblem}
            </p>
          )}
```

- [ ] **Step 5: Lint e build**

Run: `npx eslint src/modals/ContractEditModal.jsx && npm run build`
Expected: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/modals/ContractEditModal.jsx
git commit -m "feat: correção da renovação mostra e grava o novo fim do contrato anterior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 25: Script das renovações emendadas antigas

**Files:**
- Create: `src/lib/seamlessBackfill.js`
- Create: `scripts/backfill-contract-seamless.js`
- Test: `src/lib/__tests__/seamlessBackfill.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/seamlessBackfill.test.js`:

```js
// Decisão do scripts/backfill-contract-seamless.js: quais contratos e leads
// ganham a marca de emendado. Só marca true, e nunca repete quem já tem.

import { describe, it, expect } from 'vitest';
import { planSeamlessBackfill } from '../seamlessBackfill.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const ts = (date) => ({ toDate: () => date });
const anterior = { id: 'k1', startsAt: ts(D(2025, 10, 11)), endsAt: ts(D(2026, 10, 11)) };

describe('planSeamlessBackfill', () => {
  it('marca a renovação que começa no dia seguinte ao fim do contrato renovado', () => {
    const r = planSeamlessBackfill([anterior, { id: 'k2', renewedFromId: 'k1', startsAt: ts(D(2026, 10, 12)) }], []);
    expect(r.contractIds).toEqual(['k2']);
  });

  it('não marca intervalo, sobreposição nem contrato sem ligação', () => {
    const r = planSeamlessBackfill([
      anterior,
      { id: 'intervalo', renewedFromId: 'k1', startsAt: ts(D(2026, 10, 20)) },
      { id: 'sobrepoe', renewedFromId: 'k1', startsAt: ts(D(2026, 9, 28)) },
      { id: 'solto', startsAt: ts(D(2026, 10, 12)) }
    ], []);
    expect(r.contractIds).toEqual([]);
  });

  it('usa o fim original quando a renovação encurtou o contrato anterior', () => {
    const encurtado = { ...anterior, endsAt: ts(D(2026, 9, 27)), originalEndsAt: ts(D(2026, 10, 11)), shortenedById: 'k2' };
    const r = planSeamlessBackfill([encurtado, { id: 'k2', renewedFromId: 'k1', startsAt: ts(D(2026, 9, 28)) }], []);
    expect(r.contractIds).toEqual([]);
  });

  it('não repete o contrato que já tem a marca', () => {
    const r = planSeamlessBackfill([anterior, { id: 'k2', renewedFromId: 'k1', startsAt: ts(D(2026, 10, 12)), seamless: true }], []);
    expect(r.contractIds).toEqual([]);
  });

  it('marca o lead cujo contrato atual é emendado, e só uma vez', () => {
    const r = planSeamlessBackfill(
      [
        anterior,
        { id: 'k2', renewedFromId: 'k1', startsAt: ts(D(2026, 10, 12)) },
        { id: 'k3', renewedFromId: 'k9', startsAt: ts(D(2026, 1, 1)), seamless: true }
      ],
      [
        { id: 'l1', currentContractId: 'k2' },
        { id: 'l2', currentContractId: 'k3' },
        { id: 'l3', currentContractId: 'k3', currentContractSeamless: true },
        { id: 'l4', currentContractId: 'k1' }
      ]
    );
    expect(r.leadIds).toEqual(['l1', 'l2']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/seamlessBackfill.test.js`
Expected: FAIL, o módulo não existe.

- [ ] **Step 3: Implementar a decisão**

Criar `src/lib/seamlessBackfill.js`:

```js
// Plano do scripts/backfill-contract-seamless.js: quais contratos e quais
// leads ganham a marca de emendado (seamless). Puro, para caber em teste.
// Só marca true: ausente já quer dizer "não emendado". Não encurta
// sobreposição antiga (decisão do Johnny, 28/09/2026).

import { isSeamlessStart } from './contracts.js';

export function planSeamlessBackfill(contracts, leads) {
  const list = (contracts || []).filter(Boolean);
  const byId = new Map(list.map((c) => [c.id, c]));
  const contractIds = [];
  list.forEach((c) => {
    if (c.seamless === true || !c.renewedFromId) return;
    const prev = byId.get(c.renewedFromId);
    if (!prev) return;
    // Encurtado por uma renovação: vale o fim de antes. Com o fim encurtado,
    // toda renovação sobreposta pareceria emendada.
    const prevEnd = prev.originalEndsAt || prev.endsAt;
    if (isSeamlessStart(prevEnd, c.startsAt)) contractIds.push(c.id);
  });
  const marked = new Set(contractIds);
  const isMarked = (id) => marked.has(id) || byId.get(id)?.seamless === true;
  const leadIds = (leads || [])
    .filter((l) => l?.currentContractId && isMarked(l.currentContractId) && l.currentContractSeamless !== true)
    .map((l) => l.id);
  return { contractIds, leadIds };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/seamlessBackfill.test.js`
Expected: PASS.

- [ ] **Step 5: Script**

Criar `scripts/backfill-contract-seamless.js`:

```js
// Marca as renovações emendadas gravadas antes da regra de 28/09/2026.
//
// CONTEXTO: a renovação que começa no dia seguinte ao fim do contrato renovado
// passou a gravar seamless: true no contrato e currentContractSeamless: true
// no lead, e deixou de aparecer como agendada (spec em
// docs/superpowers/specs/2026-09-28-aba-contratos-correcoes-design.md). As
// renovações gravadas antes não têm a marca: até a data de início, o cliente
// aparece como "CONTRATO AGENDADO" e com anel roxo em Clientes. Este script
// grava a marca nelas. Não grava false em ninguém e não encurta sobreposição
// antiga. A decisão mora em src/lib/seamlessBackfill.js, com teste.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-contract-seamless.js [tenantId ...] [--apply]
//
//   - Sem --apply: DRY-RUN, só lista o que mudaria. (padrão)
//   - --apply:     grava as marcas. Só com o ok do Johnny.
//   - tenantId:    um ou mais; padrão "stronix-crm-app".

import process from 'node:process';
import admin from 'firebase-admin';
import { planSeamlessBackfill } from '../src/lib/seamlessBackfill.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const TENANTS = args.filter((a) => !a.startsWith('--'));
if (TENANTS.length === 0) TENANTS.push('stronix-crm-app');

const LEADS_PATH = 'stronix_leads';
const CONTRACTS_PATH = 'stronix_contratos';

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

const dataCol = (tenantId, path) =>
  db.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(path);

const withId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function sweep(tenantId) {
  const [contractsSnap, leadsSnap] = await Promise.all([
    dataCol(tenantId, CONTRACTS_PATH).get(),
    dataCol(tenantId, LEADS_PATH).where('currentContractId', '!=', null).get()
  ]);
  const contracts = withId(contractsSnap);
  const leads = withId(leadsSnap);
  const plan = planSeamlessBackfill(contracts, leads);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const tag = APPLY ? 'FIX' : 'DRY';

  plan.contractIds.forEach((id) => {
    const c = byId.get(id);
    console.log(`  [${tag}] contrato ${id} (${c?.leadName || '—'}, ${c?.planName || '—'}): seamless=true`);
  });
  plan.leadIds.forEach((id) => console.log(`  [${tag}] lead ${id}: currentContractSeamless=true`));

  if (APPLY) {
    const writes = [
      ...plan.contractIds.map((id) => ({ ref: dataCol(tenantId, CONTRACTS_PATH).doc(id), data: { seamless: true } })),
      ...plan.leadIds.map((id) => ({ ref: dataCol(tenantId, LEADS_PATH).doc(id), data: { currentContractSeamless: true } }))
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      writes.slice(i, i + 400).forEach((w) => batch.set(w.ref, w.data, { merge: true }));
      await batch.commit();
    }
  }
  return { scanned: contracts.length, contracts: plan.contractIds.length, leads: plan.leadIds.length };
}

async function run() {
  console.log(`\nMarca de renovação emendada. Modo=${APPLY ? 'APLICAR' : 'DRY-RUN'}\n`);
  for (const tenantId of TENANTS) {
    console.log(`— tenant "${tenantId}" —`);
    const r = await sweep(tenantId);
    console.log(`  ${r.scanned} contratos varridos | ${r.contracts} contratos e ${r.leads} leads a marcar.\n`);
  }
  if (!APPLY) console.log('DRY-RUN: nada foi gravado. Revise a lista e rode de novo com --apply.');
  else console.log('Concluído.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 6: Lint**

Run: `npx eslint scripts/backfill-contract-seamless.js src/lib/seamlessBackfill.js`
Expected: sem erro. Não rodar o script aqui: rodar em produção é decisão do Johnny, primeiro em DRY-RUN.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seamlessBackfill.js src/lib/__tests__/seamlessBackfill.test.js scripts/backfill-contract-seamless.js
git commit -m "feat: script que marca as renovações emendadas antigas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 26: Documentação, verificação e PR 2

**Files:**
- Modify: `CLAUDE.md` (do Stronilead)
- Modify: `docs/superpowers/specs/2026-09-28-aba-contratos-correcoes-design.md`

- [ ] **Step 1: CLAUDE.md**

Na seção "## Aba Contratos da ficha" (criada na Task 11), acrescentar no fim:

```markdown
- **Emendado não é agendado.** A renovação que começa no dia seguinte ao fim do contrato renovado grava `seamless: true` no contrato e `currentContractSeamless: true` no lead, e `deriveContractStatus` trata esse contrato como ativo antes de ele começar. Qualquer outro início futuro é agendado ("CONTRATO AGENDADO", roxo). A conta é por dia do calendário (`renewalJoinOf`, em `src/lib/contracts.js`, sobre `calendarDaysBetween`), e o `computeSeam` do modal usa a mesma conta. `renewalJoinOf` mora em `contracts.js` porque `contracts.js` não pode importar `renewal.js`.
- **Renovação sobreposta encurta o contrato renovado.** Quando o novo começa no dia do fim do atual ou antes, o mesmo batch de `commitMatricula` grava no atual o fim na véspera do novo, o fim de antes em `originalEndsAt` e o id do novo em `shortenedById`.
- **Cancelar uma renovação que ainda não começou desfaz a renovação** (`buildRenewalCancel`): o fim encurtado volta e o resumo do lead volta para o contrato renovado. Corrigir o início de uma renovação recalcula a marca e o encurtamento (`buildContractEdit` com `previous`).
- **Não se renova contrato trancado** (`renewalStartProblem`): o fim dele ainda anda na reativação. A renovação também não pode começar no dia do início do contrato renovado, nem antes.
- **No Histórico**, o contrato que tem renovação ligada aparece "Em uso" enquanto vale e "Renovado" depois (`historyStatusOf`). A renovação cancelada antes de começar não conta.
- **As renovações emendadas de antes de 28/09/2026** recebem a marca pelo `scripts/backfill-contract-seamless.js` (dry-run por padrão, `--apply` só com o Johnny).
```

- [ ] **Step 2: Ajustar a spec aos três desvios do plano**

Na spec, trocar o trecho de `isSeamlessStart` para dizer que ele mora em `src/lib/contracts.js` (motivo: ciclo de import). Trocar "Roda por academia (`--tenant=<id>`)" por "Roda por academia, com os ids na linha de comando". Acrescentar em "Sobreposição (item 3)" que o `computeSeam` passou a contar dias do calendário. Mudar o `status:` do topo para `ativo`.

- [ ] **Step 3: Verificação completa**

Run: `npm test && npm run lint && npm run build`
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-28-aba-contratos-correcoes-design.md
git commit -m "docs: regras da vigência na aba Contratos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push e PR (com o ok do Johnny)**

```bash
git push -u origin claude/contratos-vigencia
```

Abrir o PR com `gh pr create` (base: a main, se o PR 1 já entrou, ou o branch do PR 1). Título: `Aba Contratos: renovação emendada é ativa e a sobreposta encerra o contrato atual`. Corpo em português, passado pelo humanizer, com o que muda, o script e a ordem sugerida (merge, depois o script em DRY-RUN, depois `--apply` com o ok). Terminar com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Depois, `get_status` do ccd_pr e `bind_pr` se preciso.

Conferência no preview da Vercel, no lead de teste:
- renovar antes do vencimento com "Emendar": o topo continua CLIENTE ATIVO, o card diz "Continua o contrato em uso (...)" e o Histórico mostra "Em uso";
- renovar com "Começar hoje": a lista "Ao confirmar" avisa o novo fim, e depois o contrato anterior aparece "Renovado" com o fim de ontem;
- cancelar essa renovação antes de começar: o título do modal é "Cancelar renovação" e o cliente volta ao contrato anterior, com o fim original;
- funil Upgrade com contrato trancado: o modal de renovação mostra o bloqueio.

- [ ] **Step 6: Depois do merge**

Atualizar a tabela "Últimas Atualizações" do `CLAUDE.md` da raiz do STRONIX-FIRMA (outro repositório, fora deste worktree) com uma linha de cada PR, e a memória `auditoria-aba-contratos-2026-09.md`.
