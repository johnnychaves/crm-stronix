# Contrato em uso e Histórico detalhado — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba Contratos da ficha, o destaque passa a ser o contrato que o cliente usa hoje, a renovação que ainda não começou vira a faixa "Próximo contrato" (com Ativar agora), o Histórico vira uma tabela com os detalhes de cada contrato, e o resumo do lead ganha o bloco "em uso" para as listas, a Meta Diária e o cartão do Stronizap dizerem o estado certo enquanto a renovação não começa. Tudo num PR só, empilhado no #235.

**Architecture:** Toda regra nova é função pura em `src/lib/` (`contracts.js`, `contractHistory.js`, `timeline.js` e o módulo novo `contractsTab.js`), testada em node com vitest. A aba sai de dentro do `LeadProfileView.jsx` para `src/components/profile/contracts/` (cinco componentes mais um arquivo de peças compartilhadas) e só chama essas funções. A gravação continua em `contractsWrites.js`, num batch por ação; o segundo contrato do batch passa a se chamar "ligado" porque às vezes é o próximo e não o anterior. O modal novo `ContractActivateModal.jsx` segue o molde dos outros três modais de contrato. Não muda regra do Firestore, consulta nem índice.

**Tech Stack:** React 19 + Vite, Tailwind v4, Firebase (Firestore), vitest 4, lucide-react, `react-dom/server` nos testes de render.

**Spec:** `docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md`. Mockup aprovado (opção C): `docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html`.

**Ajustes decididos ao escrever o plano** (o dono precisa saber; nenhum contraria a spec, todos preenchem um vazio dela):

1. `deriveLeadContractStatus` com o bloco "em uso" e o fim do contrato em uso já passado: a renovação emendada (`currentContractSeamless`) continua ativa pela marca, como antes desta entrega. Sem isso, o dia inteiro entre o fim do contrato em uso (meia-noite de 11/10) e o início da emendada (meia-noite de 12/10) apareceria como "CONTRATO AGENDADO", que é o defeito que o PR #235 tirou. Cancelado, ou fim passado sem a marca, dá agendado, como a spec pede.
2. `buildContractEdit` (corrigir a renovação que ainda não começou) grava o bloco do contrato anterior quando ele já começou, com o status dele (trancado vira trancado no bloco, cancelado vira cancelado), e não só quando ele está "em vigor". A tabela de estados da spec precisa do trancado no bloco.
3. A regra "quem está em uso" vira `isInUseAt`, exportada de `contractHistory.js`, usada por `runningPredecessorOf` e por `contractsTabModel`, para a aba e o card não se separarem.
4. Ordem das tasks de tela: o componente do Histórico (tabela) entra antes do card e da faixa, para o `ContractsTab.jsx` final ser escrito uma vez só, com as quatro peças prontas. O teste de render das cinco situações entra na mesma task que liga a tela nova, porque o teste antigo (`profileContractActions.test.js`) descreve a tela velha e é substituído por `profileContractsTab.test.js`.
5. Último contrato sem documento na lista (lead com `currentContractId` apontando para um doc que não chegou) cai no resumo do lead (`summaryContractOf`), para a aba não dizer "Ainda não é cliente" com contrato gravado, como hoje.
6. `historySuccessorOf` e `inUseNoteOf` saem de `contractHistory.js`, com os testes: só a aba velha usava (a lacuna "N dias sem contrato" virou o texto da origem na tabela, e a nota da faixa virou o encaixe do próximo).
7. `buildContractActivate` começa "agora" com a hora (`new Date()`), como o "Começar hoje" do `ContractModal`, e devolve `daysLost` e `scheduledFor` para o modal não refazer a conta.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/contracts.js` | `CLEAR_IN_USE_BLOCK`, `inUseBlockOf`, `deriveLeadContractStatus` com o bloco; bloco em `buildMatriculaWrites`, `buildRenewalCancel`, `buildContractEdit`; `role` em `buildContractPause`/`Resume`/`Cancel`; `originalEndsAt` anda na reativação; `buildContractActivate`; `closedPausesOf` exportada |
| `src/lib/contractsWrites.js` | `commitContractPatch` com `linkedContractId`/`linkedContractPatch` |
| `src/lib/clientImport.js` | o resumo importado limpa o bloco |
| `src/lib/contractHistory.js` | `isInUseAt`; `runningPredecessorOf` aceita trancado; `historyStatusOf` trancado com renovação começada; saem `historySuccessorOf` e `inUseNoteOf` |
| `src/lib/timeline.js` | tipo `ativacao` |
| `src/lib/contractsTab.js` (novo) | `contractsTabModel`, `contractFactsOf`, `contractTimelineOf`, `heroCountdownOf`, `heroActionsOf`, `joinTextOf`, `originTextOf`, `gapText`, `shortContractId`, `summaryContractOf`, `contractStartOf` |
| `src/components/profile/contracts/` (novo) | `shared.jsx`, `ContractTimeline.jsx`, `ContractHistoryTable.jsx`, `ContractHeroCard.jsx`, `NextContractStrip.jsx`, `ContractsTab.jsx` |
| `src/views/LeadProfileView.jsx` | monta o `ContractsTab`; ações por contrato; monta o `ContractActivateModal` |
| `src/modals/ContractActivateModal.jsx` (novo) | o modal do Ativar agora |
| `src/modals/ContractOutcomeModal.jsx` | papel do contrato, avisos, patch do próximo |
| `src/modals/ContractEditModal.jsx` | só o nome dos parâmetros do batch |
| `CLAUDE.md` (do Stronilead) | seção "Aba Contratos da ficha" |
| Testes | `contracts`, `contractsWrites`, `clientImport`, `contractHistory`, `timeline`, `leadState`, `api/zapFuso`, `contractsTab` (novo), `contractsTabComponents` (novo), `profileContractsTab` (novo, substitui `profileContractActions`) |

Comandos usados em todo o plano, rodados na raiz do worktree:
- um arquivo de teste: `npx vitest run src/lib/__tests__/<arquivo>.test.js` (ou `api/__tests__/...`)
- tudo: `npm test`, `npm run lint`, `npm run build`, `npm run verificar:sentry`

Datas dos exemplos: hoje é 30/09/2026; o contrato em uso vai de 11/10/2025 a 11/10/2026; o próximo, de 12/10/2026 a 12/10/2027.

---

## Task 0: Linha de base

**Files:** nenhum.

- [ ] **Step 1: Conferir que o branch está em dia com a main**

Run: `git fetch origin main --quiet && git rev-list --count HEAD..origin/main`
Expected: `0`. Se der mais que zero, trazer a main pela ferramenta `sync_with_base_branch` do app antes de seguir.

- [ ] **Step 2: Dependências**

Run: `npm install && git status --short package-lock.json`
Expected: nenhuma mudança no `package-lock.json`. Se mudou, descartar a mudança do lock e avisar o Johnny.

- [ ] **Step 3: Rodar a suíte inteira e anotar o número de testes**

Run: `npm test`
Expected: tudo verde. Anotar o total de testes para comparar no fim.

---

## Task 1: Bloco "em uso" no resumo do lead e `deriveLeadContractStatus`

**Files:**
- Modify: `src/lib/contracts.js`
- Test: `src/lib/__tests__/contracts.test.js`, `src/lib/__tests__/leadState.test.js`, `api/__tests__/zapFuso.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/contracts.test.js`, no import de `../contracts.js`, acrescentar `CLEAR_IN_USE_BLOCK,` logo depois de `CONTRACT_STATUS_LABEL,` e `inUseBlockOf,` logo depois de `hasLiveContract,`. No fim do arquivo, acrescentar:

```js
describe('bloco "em uso" do resumo do lead', () => {
  const emUso = { id: 'k1', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };

  it('inUseBlockOf copia id, status e fim do contrato, com o status normalizado', () => {
    expect(inUseBlockOf(emUso)).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 11) });
    expect(inUseBlockOf({ ...emUso, status: 'trancado' }).inUseContractStatus).toBe('trancado');
    expect(inUseBlockOf({ ...emUso, status: 'cancelado' }).inUseContractStatus).toBe('cancelado');
    // Importado sem status gravado conta como ativo, e a data crua vira Date.
    expect(inUseBlockOf({ id: 'k1', endsAt: { toDate: () => D(2026, 10, 11) } }))
      .toEqual({ inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 11) });
  });

  it('inUseBlockOf aceita sobrescrever o status e o fim', () => {
    expect(inUseBlockOf(emUso, { inUseContractStatus: 'trancado', inUseContractEndsAt: D(2026, 10, 20) }))
      .toEqual({ inUseContractId: 'k1', inUseContractStatus: 'trancado', inUseContractEndsAt: D(2026, 10, 20) });
  });

  it('CLEAR_IN_USE_BLOCK zera os três campos', () => {
    expect(CLEAR_IN_USE_BLOCK).toEqual({ inUseContractId: null, inUseContractStatus: null, inUseContractEndsAt: null });
  });
});

describe('deriveLeadContractStatus com o bloco "em uso"', () => {
  // A renovação (12/10/2026 a 12/10/2027) ainda não começou e o contrato em
  // uso vai até 11/10/2026. Hoje é 30/09/2026.
  const AGORA = new Date(2026, 8, 30, 10, 0);
  const lead = (extra = {}) => ({
    currentContractId: 'k2', currentContractStatus: 'ativo', currentContractSeamless: false,
    currentContractStartsAt: D(2026, 10, 12), currentContractEndsAt: D(2027, 10, 12),
    inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 11),
    ...extra
  });

  it('contrato em uso valendo: ativo, e nunca a vencer, porque o cliente já renovou', () => {
    expect(deriveLeadContractStatus(lead(), AGORA)).toBe(CONTRACT_STATUS.ATIVO);
    // Faltam 11 dias: sem o bloco seria "a vencer"; com ele não.
    expect(deriveLeadContractStatus(lead(), AGORA, 30)).toBe(CONTRACT_STATUS.ATIVO);
  });

  it('contrato em uso trancado: trancado', () => {
    expect(deriveLeadContractStatus(lead({ inUseContractStatus: 'trancado' }), AGORA)).toBe(CONTRACT_STATUS.TRANCADO);
  });

  it('contrato em uso cancelado: agendado, até a renovação começar', () => {
    expect(deriveLeadContractStatus(lead({ inUseContractStatus: 'cancelado' }), AGORA)).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('fim do contrato em uso já passado: agendado no intervalo, e ativo quando a renovação começa', () => {
    expect(deriveLeadContractStatus(lead(), new Date(2026, 9, 11, 0, 1))).toBe(CONTRACT_STATUS.AGENDADO);
    expect(deriveLeadContractStatus(lead(), new Date(2026, 9, 12, 0, 1))).toBe(CONTRACT_STATUS.ATIVO);
  });

  // A comparação é por instante, como o resto de deriveContractStatus: o
  // cartão do Stronizap roda em UTC e não pode ler dia do calendário local.
  it('compara por instante, não por dia', () => {
    const fim = new Date(2026, 8, 30, 18, 0);
    expect(deriveLeadContractStatus(lead({ inUseContractEndsAt: fim }), new Date(2026, 8, 30, 17, 59))).toBe(CONTRACT_STATUS.ATIVO);
    expect(deriveLeadContractStatus(lead({ inUseContractEndsAt: fim }), new Date(2026, 8, 30, 18, 1))).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('a emendada continua ativa pela marca no dia entre o fim do em uso e o início dela', () => {
    // O contrato em uso terminou à meia-noite de 11/10 e a emendada começa à
    // meia-noite de 12/10: o dia 11 é do cliente, como antes desta entrega.
    expect(deriveLeadContractStatus(lead({ currentContractSeamless: true }), new Date(2026, 9, 11, 10, 0))).toBe(CONTRACT_STATUS.ATIVO);
  });

  it('o bloco só vale enquanto o último contrato não começou', () => {
    // Renovação já começada: o bloco é ignorado, mesmo que ninguém o tenha limpado.
    expect(deriveLeadContractStatus(lead({ inUseContractStatus: 'trancado' }), D(2026, 11, 1))).toBe(CONTRACT_STATUS.ATIVO);
  });

  it('último contrato cancelado: o bloco é ignorado e vale o cancelamento', () => {
    expect(deriveLeadContractStatus(lead({ currentContractStatus: 'cancelado' }), AGORA)).toBe(CONTRACT_STATUS.CANCELADO);
  });

  it('sem o bloco, vale a regra de hoje', () => {
    expect(deriveLeadContractStatus(lead(CLEAR_IN_USE_BLOCK), AGORA)).toBe(CONTRACT_STATUS.AGENDADO);
    expect(deriveLeadContractStatus(lead({ ...CLEAR_IN_USE_BLOCK, currentContractSeamless: true }), AGORA)).toBe(CONTRACT_STATUS.ATIVO);
  });

  it('bloco sem fim gravado não diz que o contrato vale: agendado', () => {
    expect(deriveLeadContractStatus(lead({ inUseContractEndsAt: null }), AGORA)).toBe(CONTRACT_STATUS.AGENDADO);
  });
});
```

Em `src/lib/__tests__/leadState.test.js`, dentro do `describe('deriveLeadState', ...)`, antes do `});` que o fecha:

```js
  // Renovação marcada (12/10/2026) com o contrato em uso valendo até 11/10:
  // o cliente está ativo, não "agendado". O bloco "em uso" do resumo decide.
  it('renovação marcada com o contrato em uso valendo é CLIENTE ATIVO, e não CONTRATO AGENDADO', () => {
    const state = deriveLeadState(cliente({
      currentContractStartsAt: D(2026, 10, 12), currentContractEndsAt: D(2027, 10, 12),
      inUseContractId: 'k0', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 11)
    }), NOW);
    expect(state.key).toBe('cliente_ativo');
  });

  it('renovação marcada com o contrato em uso trancado é TRANCADO', () => {
    const state = deriveLeadState(cliente({
      currentContractStartsAt: D(2026, 10, 12), currentContractEndsAt: D(2027, 10, 12),
      inUseContractId: 'k0', inUseContractStatus: 'trancado', inUseContractEndsAt: D(2026, 10, 11)
    }), NOW);
    expect(state.key).toBe('trancado');
  });

  it('renovação marcada com o contrato em uso cancelado é CONTRATO AGENDADO', () => {
    const state = deriveLeadState(cliente({
      currentContractStartsAt: D(2026, 10, 12), currentContractEndsAt: D(2027, 10, 12),
      inUseContractId: 'k0', inUseContractStatus: 'cancelado', inUseContractEndsAt: D(2026, 10, 11)
    }), NOW);
    expect(state.key).toBe('agendado');
  });
```

Em `api/__tests__/zapFuso.test.js` (é ele que põe o processo em UTC), no fim do arquivo:

```js
// O bloco "em uso" do resumo do lead (contracts.js): enquanto a renovação
// marcada não começa, o cartão diz o estado do contrato que o cliente usa.
// A comparação é por instante, então o processo em UTC não muda o resultado.
describe('cartão com o bloco "em uso" do lead, no processo em UTC', () => {
  // A renovação começa em 12/10/2026 e o contrato em uso vai até a meia-noite
  // de 11/10, em Brasília.
  const renovado = (extra = {}) => cliente({
    currentContractStartsAt: brt('2026-10-12T00:00'), currentContractEndsAt: brt('2027-10-12T00:00'),
    inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: brt('2026-10-11T00:00'),
    ...extra
  });

  it('contrato em uso valendo: ativo, sem faixa de marco', () => {
    const card = buildZapCard(renovado(), brt('2026-09-30T22:00'));
    expect(card.contractStatus).toBe('ativo');
    expect(card.strip).toBeNull();
  });

  it('às 22:00 de Brasília do dia seguinte ao fim, sem a marca de emendada, já é o intervalo: agendado', () => {
    expect(buildZapCard(renovado(), brt('2026-10-11T22:00')).contractStatus).toBe('agendado');
    // Com a marca, o dia 11 continua do cliente.
    expect(buildZapCard(renovado({ currentContractSeamless: true }), brt('2026-10-11T22:00')).contractStatus).toBe('ativo');
  });

  it('em uso trancado: trancado, e a faixa fica em silêncio', () => {
    const card = buildZapCard(renovado({ inUseContractStatus: 'trancado' }), brt('2026-09-30T22:00'));
    expect(card.contractStatus).toBe('trancado');
    expect(card.strip).toBeNull();
  });

  it('em uso cancelado: agendado', () => {
    expect(buildZapCard(renovado({ inUseContractStatus: 'cancelado' }), brt('2026-09-30T22:00')).contractStatus).toBe('agendado');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/leadState.test.js api/__tests__/zapFuso.test.js`
Expected: FAIL. `inUseBlockOf is not a function`, `CLEAR_IN_USE_BLOCK` undefined, e os casos com o bloco devolvem `agendado` no lugar de `ativo`/`trancado`.

- [ ] **Step 3: Implementar**

Em `src/lib/contracts.js`, trocar o bloco inteiro de `deriveLeadContractStatus` (do comentário `// Conveniência: deriva o status a partir do resumo denormalizado gravado` até o `);` que fecha a função) por:

```js
// ---------------------------------------------------------------------------
// Bloco "em uso" do resumo do lead
// ---------------------------------------------------------------------------
// Enquanto o último contrato (currentContractId) ainda não começou, o resumo
// guarda também o contrato que o cliente usa hoje: id, status gravado (ativo,
// trancado ou cancelado) e fim. É uma cópia: quem grava é a renovação, o
// trancar, o reativar e o cancelar do contrato em uso e o corrigir da
// renovação; matrícula, importação, cancelar a renovação e Ativar agora limpam.
// A ficha não lê o bloco, porque lê os contratos; as listas, a Meta Diária e o
// cartão do Stronizap leem, por deriveLeadContractStatus.
export const CLEAR_IN_USE_BLOCK = Object.freeze({ inUseContractId: null, inUseContractStatus: null, inUseContractEndsAt: null });

const storedStatusOf = (status) => (
  status === CONTRACT_STATUS.TRANCADO || status === CONTRACT_STATUS.CANCELADO ? status : CONTRACT_STATUS.ATIVO
);

// O bloco a partir do documento do contrato em uso. `overrides` troca o status
// ou o fim quando a gravação os muda no mesmo lote (trancar, reativar,
// cancelar, encurtar).
export const inUseBlockOf = (contract, overrides = {}) => ({
  inUseContractId: contract?.id || null,
  inUseContractStatus: storedStatusOf(contract?.status),
  inUseContractEndsAt: getSafeDateOrNull(contract?.endsAt),
  ...overrides
});

// O estado do cliente pelo bloco, ou null quando o bloco não decide. Vale só
// com o último contrato ainda por começar (por instante), o bloco apontando um
// contrato e o último não cancelado. Trancado dá trancado. Cancelado dá
// agendado: o cliente fica sem contrato até a renovação começar. Valendo, dá
// ativo, e nunca "a vencer", porque o cliente já renovou. Com o fim já passado,
// a emendada continua com a marca (currentContractSeamless) decidindo, como
// antes desta entrega, senão o dia entre o fim do contrato em uso e o início
// dela apareceria como agendado; sem a marca, é o intervalo: agendado.
// Comparação por instante, nunca por dia do calendário: o cartão do Stronizap
// roda em UTC.
const inUseStatusOf = (lead, refDate) => {
  if (!lead?.inUseContractId || lead.currentContractStatus === CONTRACT_STATUS.CANCELADO) return null;
  const start = getSafeDateOrNull(lead.currentContractStartsAt);
  const now = getSafeDateOrNull(refDate) || new Date();
  if (!start || start.getTime() <= now.getTime()) return null;
  if (lead.inUseContractStatus === CONTRACT_STATUS.TRANCADO) return CONTRACT_STATUS.TRANCADO;
  if (lead.inUseContractStatus === CONTRACT_STATUS.CANCELADO) return CONTRACT_STATUS.AGENDADO;
  const end = getSafeDateOrNull(lead.inUseContractEndsAt);
  if (end && now.getTime() <= end.getTime()) return CONTRACT_STATUS.ATIVO;
  return lead.currentContractSeamless ? null : CONTRACT_STATUS.AGENDADO;
};

// Conveniência: deriva o status a partir do resumo denormalizado gravado no
// doc do lead. O bloco "em uso" decide primeiro (inUseStatusOf); sem ele, o
// último contrato (currentContractStatus / currentContractEndsAt).
export const deriveLeadContractStatus = (lead, refDate, thresholdDays) =>
  inUseStatusOf(lead, refDate) || deriveContractStatus(
    {
      status: lead?.currentContractStatus,
      startsAt: lead?.currentContractStartsAt,
      endsAt: lead?.currentContractEndsAt,
      seamless: lead?.currentContractSeamless
    },
    refDate,
    thresholdDays
  );
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/leadState.test.js api/__tests__/zapFuso.test.js api/__tests__/zapStrip.test.js api/__tests__/zapRoute.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js src/lib/__tests__/leadState.test.js api/__tests__/zapFuso.test.js
git commit -m "feat: bloco \"em uso\" no resumo do lead e estado do cliente com renovação marcada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Quem grava o bloco: renovação, matrícula, importação, desfazer e correção

**Files:**
- Modify: `src/lib/contracts.js`, `src/lib/clientImport.js`
- Test: `src/lib/__tests__/contracts.test.js`, `src/lib/__tests__/clientImport.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/contracts.test.js`, no fim do arquivo:

```js
describe('o bloco "em uso" nas gravações', () => {
  const plan = { id: 'p2', name: 'Flow', value: 1788, durationMonths: 12 };
  const lead = {
    id: 'l1', name: 'Ana', consultantId: 'c1', consultantAuthUid: 'u1',
    currentContractId: 'k1', currentContractStatus: 'ativo', currentContractStartsAt: D(2025, 10, 11), currentContractEndsAt: D(2026, 10, 11)
  };
  const atual = { id: 'k1', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const bloco = (fim) => ({ inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: fim });
  const renovar = (startsAt, extra = {}) => buildMatriculaWrites({
    lead, plan, value: 1788, startsAt, mode: 'renovacao', renewedFromId: 'k1', previousContract: atual, now: HOJE, ...extra
  });

  it('renovação que começa depois: o resumo ganha o contrato renovado como em uso', () => {
    expect(renovar(D(2026, 10, 12)).leadPatch).toMatchObject(bloco(D(2026, 10, 11)));
    expect(renovar(D(2026, 10, 20)).leadPatch).toMatchObject(bloco(D(2026, 10, 11)));
  });

  it('renovação sobreposta com início no futuro: o fim do bloco é o encurtado', () => {
    const r = renovar(D(2026, 10, 5));
    expect(r.previousPatch.endsAt).toEqual(D(2026, 10, 4));
    expect(r.leadPatch).toMatchObject(bloco(D(2026, 10, 4)));
  });

  it('sem o documento do atual, o bloco sai do resumo do lead', () => {
    expect(renovar(D(2026, 10, 12), { previousContract: null }).leadPatch).toMatchObject(bloco(D(2026, 10, 11)));
  });

  it('renovação que já começa valendo limpa o bloco', () => {
    expect(renovar(D(2026, 9, 28)).leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
    expect(renovar(HOJE).leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
  });

  it('contrato renovado fora de vigor (trancado, cancelado, ainda por começar) não entra no bloco', () => {
    [
      { ...atual, status: 'trancado', pausedAt: D(2026, 9, 1) },
      { ...atual, status: 'cancelado', cancelledAt: D(2026, 9, 1) },
      { ...atual, startsAt: D(2026, 10, 1) }
    ].forEach((doc) => {
      expect(renovar(D(2026, 10, 12), { previousContract: doc }).leadPatch, doc.status).toMatchObject(CLEAR_IN_USE_BLOCK);
    });
  });

  it('matrícula limpa o bloco', () => {
    expect(buildMatriculaWrites({ lead, plan, value: 1788, startsAt: D(2026, 10, 12) }).leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
  });

  it('cancelar a renovação limpa o bloco', () => {
    const renewal = { id: 'k2', planName: 'Flow', renewedFromId: 'k1', status: 'ativo', startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };
    expect(buildRenewalCancel({ contract: renewal, previous: atual, cancelledAt: D(2026, 9, 30) }).leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
  });

  describe('corrigir a renovação que ainda não começou', () => {
    const renovacao = {
      id: 'k2', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12,
      renewedFromId: 'k1', startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), seamless: true
    };
    const corrigir = (startsAt, previous = atual, contract = renovacao) =>
      buildContractEdit({ contract, plan, value: 1788, startsAt, previous, now: HOJE });
    const CAMPOS = ['inUseContractId', 'inUseContractStatus', 'inUseContractEndsAt'];

    it('início novo ainda no futuro: o bloco leva o fim do contrato em uso depois da correção', () => {
      expect(corrigir(D(2026, 10, 20)).leadPatch).toMatchObject(bloco(D(2026, 10, 11)));
      // Passa a sobrepor: o em uso termina na véspera, e o bloco acompanha.
      expect(corrigir(D(2026, 10, 5)).leadPatch).toMatchObject(bloco(D(2026, 10, 4)));
    });

    it('anterior trancado ou cancelado continua no bloco com o status dele', () => {
      expect(corrigir(D(2026, 10, 20), { ...atual, status: 'trancado', pausedAt: D(2026, 9, 1) }).leadPatch)
        .toMatchObject({ inUseContractId: 'k1', inUseContractStatus: 'trancado', inUseContractEndsAt: D(2026, 10, 11) });
      expect(corrigir(D(2026, 10, 20), { ...atual, status: 'cancelado', cancelledAt: D(2026, 9, 25) }).leadPatch)
        .toMatchObject({ inUseContractId: 'k1', inUseContractStatus: 'cancelado', inUseContractEndsAt: D(2026, 10, 11) });
    });

    it('anterior que ainda não começou não entra no bloco', () => {
      const agendado = { ...atual, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
      const depois = { ...renovacao, startsAt: D(2027, 10, 25), endsAt: D(2028, 10, 25), seamless: false };
      expect(corrigir(D(2027, 11, 1), agendado, depois).leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
    });

    it('início novo já chegado limpa o bloco', () => {
      expect(corrigir(D(2026, 9, 28)).leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
    });

    it('corrigir só o valor, ou uma renovação sem o anterior ligado, não toca no bloco', () => {
      const soValor = buildContractEdit({ contract: renovacao, plan, value: 1700, startsAt: D(2026, 10, 12), previous: atual, now: HOJE });
      CAMPOS.forEach((k) => expect(soValor.leadPatch, k).not.toHaveProperty(k));
      const solta = buildContractEdit({ contract: { ...renovacao, renewedFromId: null }, plan, value: 1788, startsAt: D(2026, 10, 20), previous: null, now: HOJE });
      CAMPOS.forEach((k) => expect(solta.leadPatch, k).not.toHaveProperty(k));
    });
  });
});
```

No mesmo arquivo, dois testes existentes passam a esperar o bloco limpo. Em `describe('buildRenewalCancel', ...)`, no teste `'devolve o fim de antes ao contrato encurtado e o resumo do lead a ele'`, trocar:

```js
        currentContractStatus: 'ativo',
        currentContractSeamless: false
      });
```

por:

```js
        currentContractStatus: 'ativo',
        currentContractSeamless: false,
        ...CLEAR_IN_USE_BLOCK
      });
```

E no teste `'renovar encurtando e desfazer devolve o contrato e o lead como estavam'`, trocar `expect(r.leadPatch).toEqual(resumo);` por `expect(r.leadPatch).toEqual({ ...resumo, ...CLEAR_IN_USE_BLOCK });`.

Em `src/lib/__tests__/clientImport.test.js`, no teste `'PARIDADE com buildMatriculaWrites: mesmo leadPatch e mesmo contrato nos campos comuns'`, na lista de campos do lead, trocar `'reactivationStageId']` por `'reactivationStageId', 'inUseContractId', 'inUseContractStatus', 'inUseContractEndsAt']`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/clientImport.test.js`
Expected: FAIL nos testes novos (o `leadPatch` não tem `inUseContractId`) e nos dois `toEqual` ajustados.

- [ ] **Step 3: Implementar em `contracts.js`**

Em `buildMatriculaWrites`, logo depois de `const seamless = inForce && (join.seamless || canShorten);`, acrescentar:

```js
  // O bloco "em uso" do resumo (inUseBlockOf): com a renovação começando depois
  // de agora e o contrato renovado em vigor, o cliente segue usando o renovado
  // até ela começar, com o fim encurtado quando a gravação encurta. Sem o
  // documento, o id e o fim saem do resumo do lead, como a marca. Renovação
  // que já começa valendo, e matrícula, limpam o bloco.
  const ref = getSafeDateOrNull(now) || new Date();
  const inUseBlock = inForce && start.getTime() > ref.getTime()
    ? inUseBlockOf({ id: lead.currentContractId, status: CONTRACT_STATUS.ATIVO, endsAt: canShorten ? join.previousEndsAt : currentEnd })
    : CLEAR_IN_USE_BLOCK;
```

E no `leadPatch` da mesma função, logo depois de `currentContractSeamless: seamless,`, acrescentar a linha `...inUseBlock,`.

Em `buildRenewalCancel`, no `leadPatch`, logo depois de `currentContractSeamless: Boolean(previous?.seamless)` acrescentar `,` e a linha:

```js
      // O resumo volta ao contrato renovado, que passa a ser o último: sem bloco.
      ...CLEAR_IN_USE_BLOCK
```

Em `buildContractEdit`, trocar a linha `let previousPatch = null;` por:

```js
  let previousPatch = null;
  // O bloco "em uso" do resumo: null é "não mexer".
  let inUseBlock = null;
```

Dentro do `if (startChanged && contract?.renewedFromId && previous?.id === contract.renewedFromId) {`, logo depois de `previousPatch = patch && changesPrevious(previous, patch) ? patch : null;`, acrescentar:

```js
    // Com o início novo ainda no futuro e o anterior já começado, o bloco
    // aponta o anterior com o status dele (trancado e cancelado inclusive) e o
    // fim depois desta correção: o encurtado, o devolvido ou o de sempre. Com
    // o início novo já chegado, o último contrato passou a valer: bloco limpo.
    const ref = getSafeDateOrNull(now) || new Date();
    const started = Boolean(prevStart && prevStart.getTime() <= ref.getTime());
    inUseBlock = start.getTime() > ref.getTime() && started
      ? inUseBlockOf(previous, { inUseContractEndsAt: patch ? patch.endsAt : refEnd })
      : CLEAR_IN_USE_BLOCK;
```

E no `leadPatch` do retorno de `buildContractEdit`, logo depois de `currentContractSeamless: seamless`, acrescentar `,` e a linha `...(inUseBlock || {})`.

- [ ] **Step 4: Implementar em `clientImport.js`**

Trocar o import `import { CONTRACT_STATUS, deriveContractStatus } from './contracts.js';` por `import { CLEAR_IN_USE_BLOCK, CONTRACT_STATUS, deriveContractStatus } from './contracts.js';` e, em `contractSummary`, trocar `  currentContractSeamless: false` por:

```js
  currentContractSeamless: false,
  // O contrato da planilha passa a ser o último, e não há renovação marcada.
  ...CLEAR_IN_USE_BLOCK
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/clientImport.test.js src/lib/__tests__/contractsWrites.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts.js src/lib/clientImport.js src/lib/__tests__/contracts.test.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: renovação, matrícula, importação, correção e desfazer gravam o bloco \"em uso\"

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Trancar, reativar e cancelar o contrato em uso (`role`) e o contrato ligado no batch

**Files:**
- Modify: `src/lib/contracts.js`, `src/lib/contractsWrites.js`, `src/modals/ContractOutcomeModal.jsx`, `src/modals/ContractEditModal.jsx`
- Test: `src/lib/__tests__/contracts.test.js`, `src/lib/__tests__/contractsWrites.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/contracts.test.js`, no fim do arquivo:

```js
describe('trancar, reativar e cancelar o contrato em uso (role inUse)', () => {
  const emUso = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const proximo = { id: 'k2', planName: 'Flow', renewedFromId: 'k1', status: 'ativo', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };

  it('trancar: só o bloco no lead, com trancado, e o contrato como sempre', () => {
    const r = buildContractPause({ planName: 'Start', pausedAt: D(2026, 9, 30), reason: 'Viagem', role: 'inUse', contract: emUso });
    expect(r.contractPatch).toEqual({ status: 'trancado', pausedAt: D(2026, 9, 30), pauseReason: 'Viagem' });
    expect(r.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'trancado', inUseContractEndsAt: D(2026, 10, 11) });
  });

  it('reativar: o bloco volta a ativo com o fim novo', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) };
    const r = buildContractResume({ contract: trancado, resumedAt: D(2026, 9, 30), role: 'inUse' });
    expect(r.newEndsAt).toEqual(D(2026, 10, 21));
    expect(r.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 21) });
    expect(r.contractPatch).not.toHaveProperty('originalEndsAt');
  });

  it('reativar o contrato que uma renovação encurtou anda o fim original junto', () => {
    const encurtado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20), endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const r = buildContractResume({ contract: encurtado, resumedAt: D(2026, 9, 30) });
    expect(r.contractPatch.endsAt).toEqual(D(2026, 10, 14));
    expect(r.contractPatch.originalEndsAt).toEqual(D(2026, 10, 21));
    // Sem dia parado, nada anda.
    expect(buildContractResume({ contract: encurtado, resumedAt: D(2026, 9, 20) }).contractPatch).not.toHaveProperty('originalEndsAt');
  });

  it('cancelar: o bloco com cancelado, a renovação continua e a marca de emendada sai', () => {
    const r = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30), reason: 'Financeiro', role: 'inUse', contract: emUso, next: proximo });
    expect(r.contractPatch).toEqual({ status: 'cancelado', cancelledAt: D(2026, 9, 30), cancelReason: 'Financeiro', cancelNote: null });
    expect(r.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'cancelado', inUseContractEndsAt: D(2026, 10, 11), currentContractSeamless: false });
    expect(r.nextPatch).toEqual({ seamless: false });
    expect(r.interactionText).toBe('Contrato cancelado — Plano Start — Financeiro. Encerrado em 30/09/2026. A renovação continua marcada para 12/10/2026.');
  });

  it('cancelar com a renovação que não era emendada: sem patch nela e sem mexer na marca', () => {
    const depois = { ...proximo, seamless: false, startsAt: D(2026, 10, 20) };
    const r = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30), reason: 'Financeiro', role: 'inUse', contract: emUso, next: depois });
    expect(r.nextPatch).toBeNull();
    expect(r.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'cancelado', inUseContractEndsAt: D(2026, 10, 11) });
    expect(r.interactionText).toBe('Contrato cancelado — Plano Start — Financeiro. Encerrado em 30/09/2026. A renovação continua marcada para 20/10/2026.');
  });

  it('o papel padrão continua gravando currentContract*, como sempre', () => {
    expect(buildContractPause({ planName: 'Start', pausedAt: D(2026, 9, 30), reason: 'Viagem' }).leadPatch).toEqual({ currentContractStatus: 'trancado' });
    const cancel = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30) });
    expect(cancel.leadPatch).toEqual({ currentContractStatus: 'cancelado' });
    expect(cancel.nextPatch).toBeNull();
    expect(cancel.interactionText).toBe('Contrato cancelado — Plano Start. Encerrado em 30/09/2026.');
    expect(buildContractResume({ contract: { ...emUso, pausedAt: D(2026, 9, 20) }, resumedAt: D(2026, 9, 30) }).leadPatch)
      .toEqual({ currentContractStatus: 'ativo', currentContractEndsAt: D(2026, 10, 21) });
  });
});
```

Em `src/lib/__tests__/contractsWrites.test.js`, no `describe('commitContractPatch: o contrato renovado no mesmo batch', ...)`:
- renomear o describe para `'commitContractPatch: o contrato ligado no mesmo batch'`;
- no teste `'só o id ou só o patch não grava o contrato renovado'`, trocar `previousContractId: 'k1'` por `linkedContractId: 'k1'` e `previousContractPatch: { endsAt: D(2026, 10, 11) }` por `linkedContractPatch: { endsAt: D(2026, 10, 11) }`;
- no teste `'com o patch, atualiza o contrato renovado no mesmo batch'`, trocar `previousContractId: 'k1', previousContractPatch: { endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null }` por `linkedContractId: 'k1', linkedContractPatch: { endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null }`;
- acrescentar, no fim desse describe:

```js
  // O contrato ligado também pode ser o PRÓXIMO: cancelar o contrato em uso
  // tira a marca de emendada da renovação marcada.
  it('o cancelamento do contrato em uso tira a marca de emendada da renovação, no mesmo batch', async () => {
    await commitContractPatch({
      ...base, contractId: 'k1', leadPatch: { inUseContractStatus: 'cancelado', currentContractSeamless: false },
      linkedContractId: 'k2', linkedContractPatch: { seamless: false }
    });
    expect(m.writes.find((w) => w.path === `${CONTRATOS}/k2`)).toEqual({
      path: `${CONTRATOS}/k2`, data: { seamless: false, updatedAt: 'TS' }, op: 'update'
    });
    expect(m.batches).toBe(1);
    expect(m.commits).toBe(1);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsWrites.test.js`
Expected: FAIL. O `leadPatch` do trancar vem `{ currentContractStatus: 'trancado' }`, `nextPatch` é `undefined`, e o batch não grava `k1`/`k2` com os nomes novos.

- [ ] **Step 3: Implementar os construtores em `contracts.js`**

Trocar `buildContractCancel` inteira (do comentário `// Cancelamento. O motivo era gravado como null desde sempre; sem ele a ficha` até o `};` que fecha a função) por:

```js
// Cancelamento. O motivo era gravado como null desde sempre; sem ele a ficha
// mostrava "Cancelado em 14/05" e ninguém sabia por quê.
// `role`: 'current' (padrão) grava o resumo do último contrato, como sempre;
// 'inUse' cancela o contrato em uso com a renovação marcada (`next`): grava só
// o bloco "em uso" do resumo, e precisa do `contract` para montá-lo. A
// renovação continua marcada; a emendada perde a marca, no contrato
// (`nextPatch`) e no resumo, porque passa a existir um intervalo até ela
// começar. O texto ganha a frase da renovação, lida por contractEventOf.
export const buildContractCancel = ({ planName, cancelledAt, reason, note, role = 'current', contract = null, next = null } = {}) => {
  const when = getSafeDateOrNull(cancelledAt) || new Date();
  const motivo = reason ? ` — ${reason}` : '';
  const inUse = role === 'inUse';
  const nextStart = inUse ? getSafeDateOrNull(next?.startsAt) : null;
  const dropSeam = Boolean(inUse && next?.seamless);
  return {
    contractPatch: {
      status: CONTRACT_STATUS.CANCELADO,
      cancelledAt: when,
      cancelReason: reason || null,
      cancelNote: note || null
    },
    leadPatch: inUse
      ? { ...inUseBlockOf(contract, { inUseContractStatus: CONTRACT_STATUS.CANCELADO }), ...(dropSeam ? { currentContractSeamless: false } : {}) }
      : { currentContractStatus: CONTRACT_STATUS.CANCELADO },
    nextPatch: dropSeam ? { seamless: false } : null,
    interactionText: `Contrato cancelado${planName ? ` — Plano ${planName}` : ''}${motivo}. Encerrado em ${fmtDia(when)}.${nextStart ? ` A renovação continua marcada para ${fmtDia(nextStart)}.` : ''}`
  };
};
```

Trocar `buildContractPause` inteira (do comentário `// Trancamento. Congela a vigência: enquanto está parado o contrato não corre,` até o `};`) por:

```js
// Trancamento. Congela a vigência: enquanto está parado o contrato não corre,
// e o término é empurrado na reativação pelos dias efetivamente parados.
// `role` 'inUse' (o contrato em uso, com renovação marcada) grava só o bloco
// "em uso" do resumo, montado do `contract`.
export const buildContractPause = ({ planName, pausedAt, reason, role = 'current', contract = null } = {}) => {
  const when = getSafeDateOrNull(pausedAt) || new Date();
  const motivo = reason ? ` — ${reason}` : '';
  return {
    contractPatch: {
      status: CONTRACT_STATUS.TRANCADO,
      pausedAt: when,
      pauseReason: reason || null
    },
    leadPatch: role === 'inUse'
      ? inUseBlockOf(contract, { inUseContractStatus: CONTRACT_STATUS.TRANCADO })
      : { currentContractStatus: CONTRACT_STATUS.TRANCADO },
    interactionText: `Contrato trancado a partir de ${fmtDia(when)}${planName ? ` — Plano ${planName}` : ''}${motivo}.`
  };
};
```

Em `buildContractResume`, trocar a assinatura `export const buildContractResume = ({ contract, resumedAt } = {}) => {` por `export const buildContractResume = ({ contract, resumedAt, role = 'current' } = {}) => {`, e o comentário acima dela por:

```js
// Reativação. O cliente pagou por N meses de treino, não por N meses de
// calendário: o término anda para frente pelos dias parados. `pausedDaysTotal`
// acumula porque o contrato pode ser trancado mais de uma vez. O contrato que
// uma renovação encurtou (originalEndsAt) anda o fim original pelos mesmos
// dias, para o "Cancelar renovação" devolver a data certa depois. `role`
// 'inUse' grava só o bloco "em uso" do resumo, com o fim novo.
```

Logo depois de `const fromImport = isImportPause(contract, pausedAt);`, acrescentar:

```js
  const original = getSafeDateOrNull(contract?.originalEndsAt);
```

No `contractPatch` do retorno, logo depois de `...(newEndsAt ? { endsAt: newEndsAt } : {}),`, acrescentar:

```js
      ...(original && pausedDays > 0 ? { originalEndsAt: addDays(original, pausedDays) } : {}),
```

E trocar o `leadPatch` do retorno:

```js
    leadPatch: {
      currentContractStatus: CONTRACT_STATUS.ATIVO,
      ...(newEndsAt ? { currentContractEndsAt: newEndsAt } : {})
    },
```

por:

```js
    leadPatch: role === 'inUse'
      ? inUseBlockOf(contract, { inUseContractStatus: CONTRACT_STATUS.ATIVO, inUseContractEndsAt: newEndsAt || endsAt })
      : {
        currentContractStatus: CONTRACT_STATUS.ATIVO,
        ...(newEndsAt ? { currentContractEndsAt: newEndsAt } : {})
      },
```

- [ ] **Step 4: Renomear o segundo contrato do batch**

Em `src/lib/contractsWrites.js`, em `commitContractPatch`, trocar `previousContractId = null,` por `linkedContractId = null,` e `previousContractPatch = null` por `linkedContractPatch = null`; trocar o comentário e o `if`:

```js
  // Segundo contrato, quando o desfecho mexe no contrato renovado (cancelar a
  // renovação que não começou, corrigir o início de uma renovação). update, e
  // não set com merge: se o contrato não existir mais, o batch inteiro falha em
  // vez de criar um contrato fantasma só com datas.
  if (previousContractId && previousContractPatch) {
    batch.update(
      doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, previousContractId),
      { ...previousContractPatch, updatedAt: serverTimestamp() }
    );
  }
```

por:

```js
  // Contrato ligado, quando o desfecho mexe em outro contrato: o renovado
  // (cancelar a renovação que não começou, corrigir o início de uma renovação,
  // Ativar agora) ou o próximo (cancelar o contrato em uso tira a marca de
  // emendada da renovação marcada). update, e não set com merge: se o contrato
  // não existir mais, o batch inteiro falha em vez de criar um contrato
  // fantasma só com datas.
  if (linkedContractId && linkedContractPatch) {
    batch.update(
      doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, linkedContractId),
      { ...linkedContractPatch, updatedAt: serverTimestamp() }
    );
  }
```

Em `src/modals/ContractOutcomeModal.jsx`, trocar:

```js
        previousContractId: undo?.previousPatch ? previous.id : null,
        previousContractPatch: undo?.previousPatch || null
```

por:

```js
        linkedContractId: undo?.previousPatch ? previous.id : null,
        linkedContractPatch: undo?.previousPatch || null
```

Em `src/modals/ContractEditModal.jsx`, trocar:

```js
        previousContractId: built.previousPatch ? previous.id : null,
        previousContractPatch: built.previousPatch || null
```

por:

```js
        linkedContractId: built.previousPatch ? previous.id : null,
        linkedContractPatch: built.previousPatch || null
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsWrites.test.js src/lib/__tests__/timeline.test.js && grep -rn "previousContractId\|previousContractPatch" src/modals src/lib/contractsWrites.js`
Expected: PASS, e o grep só acha as duas linhas de `commitMatricula` em `contractsWrites.js` (`previousContractId` de `buildMatriculaWrites`, que não muda).

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts.js src/lib/contractsWrites.js src/modals/ContractOutcomeModal.jsx src/modals/ContractEditModal.jsx src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsWrites.test.js
git commit -m "feat: trancar, reativar e cancelar o contrato em uso gravam só o bloco do resumo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: `buildContractActivate` e o tipo `ativacao` na linha do tempo

**Files:**
- Modify: `src/lib/contracts.js`, `src/lib/timeline.js`
- Test: `src/lib/__tests__/contracts.test.js`, `src/lib/__tests__/timeline.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/contracts.test.js`, acrescentar `buildContractActivate,` ao import (logo depois de `buildContractCancel,`) e, no fim do arquivo:

```js
describe('buildContractActivate: o contrato agendado passa a começar agora', () => {
  const AGORA = new Date(2026, 8, 30, 10, 0);
  const emUso = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const proximo = {
    id: 'k2', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1908, durationMonths: 12,
    discountMode: 'reais', discountValue: 120, discountReason: 'Fidelidade',
    renewedFromId: 'k1', status: 'ativo', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12)
  };

  it('começa agora com a duração vendida, e o em uso termina ontem, com a marca de emendado', () => {
    const r = buildContractActivate({ contract: proximo, previous: emUso, now: AGORA });
    expect(r.contractPatch).toEqual({
      planId: 'p2', planName: 'Flow', value: 1788, listValue: 1908, durationMonths: 12,
      startsAt: AGORA, endsAt: new Date(2027, 8, 30, 10, 0), seamless: true,
      discountMode: 'reais', discountValue: 120, discountReason: 'Fidelidade'
    });
    expect(r.previousPatch).toEqual({ endsAt: new Date(2026, 8, 29, 10, 0), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
    expect(r.daysLost).toBe(12);
    expect(r.scheduledFor).toEqual(D(2026, 10, 12));
    expect(r.leadPatch).toEqual({
      currentPlanName: 'Flow', currentContractValue: 1788, currentContractStartsAt: AGORA,
      currentContractEndsAt: new Date(2027, 8, 30, 10, 0), currentContractSeamless: true,
      ...CLEAR_IN_USE_BLOCK
    });
    expect(r.interactionText).toBe('Contrato ativado antes da data marcada — Plano Flow (R$ 1.788,00), vigência 30/09/2026 → 30/09/2027.');
  });

  it('em uso trancado ou cancelado: nada é encurtado e o ativado não leva a marca', () => {
    [
      { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) },
      { ...emUso, status: 'cancelado', cancelledAt: D(2026, 9, 20) }
    ].forEach((previous) => {
      const r = buildContractActivate({ contract: proximo, previous, now: AGORA });
      expect(r.previousPatch, previous.status).toBeNull();
      expect(r.contractPatch.seamless, previous.status).toBe(false);
      expect(r.daysLost, previous.status).toBe(0);
      expect(r.leadPatch, previous.status).toMatchObject(CLEAR_IN_USE_BLOCK);
    });
  });

  it('matrícula agendada sem contrato em uso: só as datas mudam, e o bloco fica limpo', () => {
    const agendada = { ...proximo, renewedFromId: null, seamless: false };
    const r = buildContractActivate({ contract: agendada, previous: null, now: AGORA });
    expect(r.previousPatch).toBeNull();
    expect(r.contractPatch.seamless).toBe(false);
    expect(r.contractPatch.startsAt).toEqual(AGORA);
    expect(r.daysLost).toBe(0);
    expect(r.leadPatch).toMatchObject(CLEAR_IN_USE_BLOCK);
  });

  it('preserva os dias já trancados e o desconto sem motivo', () => {
    const r = buildContractActivate({ contract: { ...proximo, pausedDaysTotal: 5, discountReason: null }, previous: null, now: AGORA });
    expect(r.contractPatch.endsAt).toEqual(new Date(2027, 9, 5, 10, 0));
    expect(r.contractPatch.discountValue).toBe(120);
    expect(r.contractPatch.discountReason).toBeNull();
  });

  it('o em uso encurtado por esta renovação encurta de novo a partir do fim original', () => {
    const encurtado = { ...emUso, endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const antecipada = { ...proximo, startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5) };
    const r = buildContractActivate({ contract: antecipada, previous: encurtado, now: AGORA });
    expect(r.previousPatch).toEqual({ endsAt: new Date(2026, 8, 29, 10, 0), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
    expect(r.daysLost).toBe(12);
  });
});
```

Em `src/lib/__tests__/timeline.test.js`, no import de `../contracts.js`, acrescentar `buildContractActivate,` logo depois de `buildContractCancel,`. Dentro do `describe('contractEventOf: o tipo, o plano e o valor do próprio evento', ...)`, logo depois do teste `'correção'`, acrescentar:

```js
  it('ativação antes da data marcada: linha comum do tipo Contrato, com o plano e o valor', () => {
    const { interactionText } = buildContractActivate({
      contract: { id: 'k2', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) },
      previous: null,
      now: D(2026, 9, 30)
    });
    expect(interactionText).toBe('Contrato ativado antes da data marcada — Plano Flow (R$ 1.788,00), vigência 30/09/2026 → 30/09/2027.');
    expect(classifyInteraction({ type: 'status_change', text: interactionText })).toBe('contract');
    expect(contractEventOf(interactionText)).toEqual({ kind: 'ativacao', planName: 'Flow', value: 1788 });
  });

  it('cancelamento do contrato em uso com a renovação marcada: cancelamento, com o plano do contrato cancelado', () => {
    const emUso = { id: 'k1', status: 'ativo', endsAt: D(2026, 10, 11) };
    const proximo = { id: 'k2', planName: 'Flow', startsAt: D(2026, 10, 12), seamless: true };
    const comMotivo = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30), reason: 'Financeiro', role: 'inUse', contract: emUso, next: proximo }).interactionText;
    expect(comMotivo).toBe('Contrato cancelado — Plano Start — Financeiro. Encerrado em 30/09/2026. A renovação continua marcada para 12/10/2026.');
    expect(contractEventOf(comMotivo)).toEqual({ kind: 'cancelamento', planName: 'Start', value: null });
    // Sem motivo, o plano para no ponto.
    const semMotivo = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30), role: 'inUse', contract: emUso, next: proximo }).interactionText;
    expect(contractEventOf(semMotivo)).toEqual({ kind: 'cancelamento', planName: 'Start', value: null });
  });
```

E no teste `'todo texto de contrato gravado pelo app cai no balde de contrato e é lido'`, na lista `textos`, acrescentar depois do último item (o `buildRenewalCancel` sem plano), com a vírgula:

```js
      buildContractActivate({ contract: { id: 'k2', planName: 'Flow', value: 1788, durationMonths: 12, startsAt: D(2026, 10, 12) }, previous: null, now: D(2026, 9, 30) }).interactionText,
      buildContractCancel({ planName: 'Anual', cancelledAt: D(2026, 5, 14), reason: 'Financeiro', role: 'inUse', contract: { id: 'k1' }, next: { id: 'k2', startsAt: D(2026, 6, 1) } }).interactionText,
      buildContractCancel({ cancelledAt: D(2026, 5, 14), role: 'inUse', contract: { id: 'k1' }, next: { id: 'k2', startsAt: D(2026, 6, 1) } }).interactionText
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/timeline.test.js`
Expected: FAIL. `buildContractActivate is not a function`; depois de existir, `contractEventOf` do texto de ativação devolve `null`.

- [ ] **Step 3: Implementar em `contracts.js`**

No fim de `src/lib/contracts.js`, depois de `buildContractEdit`:

```js
// Ativar agora: o contrato que ainda não começou passa a começar agora, com a
// duração vendida; plano, valor e desconto não mudam. É a correção do início
// (buildContractEdit), com as mesmas regras do contrato em uso (`previous`, o
// que este contrato renova): em vigor, ele passa a terminar ontem, com
// originalEndsAt e shortenedById, e o ativado leva a marca de emendado;
// trancado ou cancelado, nada é encurtado. O bloco "em uso" do lead é limpo,
// porque o último contrato passou a valer. Começa "agora" com a hora, como o
// "Começar hoje" do ContractModal. `daysLost`: os dias do contrato em uso que
// se perdem no encurtamento, para o modal; `scheduledFor`: a data que estava
// marcada. O texto da linha do tempo é lido por contractEventOf (tipo
// `ativacao`): mudou aqui, mude lá e no timeline.test.js.
export function buildContractActivate({ contract, previous = null, now = new Date() } = {}) {
  const at = getSafeDateOrNull(now) || new Date();
  const edit = buildContractEdit({
    contract, plan: null, value: contract?.value, startsAt: at,
    discountReason: contract?.discountReason ?? null, previous, now: at
  });
  const shortened = Boolean(edit.previousPatch?.shortenedById);
  const original = getSafeDateOrNull(previous?.originalEndsAt);
  const plannedEnd = original && previous?.shortenedById === contract?.id ? original : getSafeDateOrNull(previous?.endsAt);
  const daysLost = shortened ? Math.max(0, calendarDaysBetween(edit.previousPatch.endsAt, plannedEnd) || 0) : 0;
  const { planName, value, endsAt } = edit.contractPatch;
  return {
    ...edit,
    scheduledFor: getSafeDateOrNull(contract?.startsAt),
    daysLost,
    leadPatch: { ...edit.leadPatch, ...CLEAR_IN_USE_BLOCK },
    interactionText: `Contrato ativado antes da data marcada — Plano ${planName ?? '—'} (${fmtBRL(value)}), vigência ${fmtDia(at)} → ${fmtDia(endsAt)}.`
  };
}
```

`buildContractEdit` com `plan: null` já funciona como o Ativar agora precisa: a duração vem do contrato (`Number(plan?.durationMonths) || Number(contract?.durationMonths)`), o plano e o nome ficam os do contrato (`plan?.id ?? contract?.planId`), a tabela é a gravada (`editListValueOf(contract, null)` devolve `contract.listValue`), o desconto é recalculado igual e `sameDeal` mantém o `discountMode` de antes. Nada a corrigir nela.

- [ ] **Step 4: Implementar em `timeline.js`**

Trocar:

```js
const CONTRACT_RE = /matrícula|matricula|renova(ç|c)ão|contrato (cancelado|trancado|reativado|corrigido)|plano /i;
```

por:

```js
const CONTRACT_RE = /matrícula|matricula|renova(ç|c)ão|contrato (cancelado|trancado|reativado|corrigido|ativado)|plano /i;
```

No comentário acima de `CONTRACT_RE`, trocar `// Detecta eventos de CONTRATO (matrícula, renovação, cancelamento, trancamento,` / `// reativação e correção) pelo texto da interaction.` por `// Detecta eventos de CONTRATO (matrícula, renovação, cancelamento, trancamento,` / `// reativação, correção e ativação antes da data) pelo texto da interaction.`.

Em `CONTRACT_EVENT_RULES`, logo depois de `{ kind: 'correcao', re: /^contrato corrigido/i },`, acrescentar:

```js
  { kind: 'ativacao', re: /^contrato ativado/i },
```

O `CONTRACT_MILESTONE_KINDS` do `LeadProfileView.jsx` (`matricula`, `renovacao`, `cancelamento`) não muda: a ativação é linha comum do tipo "Contrato", sem faixa.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/timeline.test.js src/lib/__tests__/profileTimeline.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts.js src/lib/timeline.js src/lib/__tests__/contracts.test.js src/lib/__tests__/timeline.test.js
git commit -m "feat: Ativar agora, a correção do início para hoje, e o tipo ativacao na linha do tempo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: `isInUseAt`, trancado em uso e trancado renovado em `contractHistory.js`

**Files:**
- Modify: `src/lib/contractHistory.js`
- Test: `src/lib/__tests__/contractHistory.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/contractHistory.test.js`, no import de `../contractHistory.js`, acrescentar `isInUseAt,` logo depois de `inUseNoteOf,`. No `describe('historyStatusOf e runningPredecessorOf', ...)`, trocar o teste `'trancado continua trancado, mesmo com renovação ligada'` (com o comentário de três linhas acima dele) por:

```js
  // Trancado com renovação ligada: trancado até ela começar. Depois, renovado,
  // a mesma leitura do Operacional, que encerra a pausa no início do sucessor.
  it('trancado continua trancado até a renovação começar, e vira renovado depois', () => {
    const trancado = { ...atual, status: 'trancado', pausedAt: D(2026, 9, 1) };
    expect(historyStatusOf(trancado, [trancado, renovacao], HOJE)).toBe(CONTRACT_STATUS.TRANCADO);
    expect(historyStatusOf(trancado, [trancado, renovacao], D(2026, 10, 12))).toBe(HISTORY_STATUS.RENOVADO);
    // A renovação desfeita não conta.
    const desistiu = { ...renovacao, status: 'cancelado', cancelledAt: D(2026, 9, 20) };
    expect(historyStatusOf(trancado, [trancado, desistiu], D(2026, 10, 12))).toBe(CONTRACT_STATUS.TRANCADO);
  });
```

E trocar o teste `'runningPredecessorOf ignora o anterior trancado'` (com o comentário `// Contrato parado não está em uso.`) por:

```js
  // O contrato parado também está em uso: o fim dele não corre, e é ele que o
  // cliente tem enquanto a renovação não começa.
  it('runningPredecessorOf aceita o anterior trancado, mesmo com o fim gravado já passado', () => {
    const trancado = { ...atual, status: 'trancado', pausedAt: D(2026, 9, 1) };
    expect(runningPredecessorOf(renovacao, [trancado, renovacao], HOJE)).toBe(trancado);
    const depois = { ...renovacao, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    expect(runningPredecessorOf(depois, [trancado, depois], D(2026, 10, 15))).toBe(trancado);
  });
```

No fim do arquivo:

```js
describe('isInUseAt: o contrato que o cliente usa num instante', () => {
  const HOJE = D(2026, 9, 30);
  const c = { id: 'k1', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };

  it('vale do início ao último dia do fim efetivo, por dia do calendário', () => {
    expect(isInUseAt(c, HOJE)).toBe(true);
    expect(isInUseAt(c, new Date(2026, 9, 11, 18, 0))).toBe(true);
    expect(isInUseAt(c, D(2026, 10, 12))).toBe(false);
    expect(isInUseAt(c, D(2025, 10, 10))).toBe(false);
  });

  it('cancelado não está em uso, nem depois do cancelamento; trancado está, mesmo com o fim gravado passado', () => {
    expect(isInUseAt({ ...c, status: 'cancelado', cancelledAt: D(2026, 9, 1) }, HOJE)).toBe(false);
    expect(isInUseAt({ ...c, status: 'trancado', pausedAt: D(2026, 9, 1) }, D(2026, 10, 20))).toBe(true);
  });

  it('importado sem início vale pela criação; sem fim, ou sem contrato, não vale', () => {
    expect(isInUseAt({ id: 'k1', createdAt: D(2026, 9, 4), endsAt: D(2026, 10, 11) }, HOJE)).toBe(true);
    expect(isInUseAt({ id: 'k1', startsAt: D(2025, 10, 11) }, HOJE)).toBe(false);
    expect(isInUseAt(null, HOJE)).toBe(false);
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    expect(isInUseAt({ ...c, startsAt: ts(c.startsAt), endsAt: ts(c.endsAt) }, HOJE)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractHistory.test.js`
Expected: FAIL. `isInUseAt is not a function`, `runningPredecessorOf` devolve `null` para o trancado e `historyStatusOf` devolve `trancado` em 12/10.

- [ ] **Step 3: Implementar**

Em `src/lib/contractHistory.js`, trocar `historyStatusOf` inteira (do comentário `// Status do contrato na lista do Histórico. Com renovação ligada, "Em uso"` até o `}` que fecha a função) por:

```js
// Status do contrato na lista do Histórico. Com renovação ligada, "Em uso"
// enquanto ele vale e "Renovado" depois do fim dele ou quando a renovação
// começa. Antes, o contrato em uso aparecia "A vencer" com o aluno já
// renovado. A renovação que nunca valeu (neverTookEffect) não conta. O
// contrato que ainda não começou é "Agendado", mesmo o emendado: no Histórico
// ele nunca está em uso nem renovado. O trancado segue "Trancado" até a
// renovação ligada começar, e "Renovado" depois: a mesma leitura do
// Operacional, que encerra a pausa no início do sucessor (closeOpenPause).
export function historyStatusOf(contract, leadContracts, now = new Date(), thresholdDays) {
  const base = deriveContractStatus(contract, now, thresholdDays) || CONTRACT_STATUS.VENCIDO;
  if (base === CONTRACT_STATUS.CANCELADO || base === CONTRACT_STATUS.AGENDADO) return base;
  const ref = getSafeDateOrNull(now) || new Date();
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const renewals = list.filter((o) => o?.renewedFromId && o.renewedFromId === contract?.id && !neverTookEffect(o));
  const renewalStarted = renewals.some((r) => {
    const s = getSafeDateOrNull(r.startsAt);
    return Boolean(s && s.getTime() <= ref.getTime());
  });
  if (base === CONTRACT_STATUS.TRANCADO) return renewalStarted ? HISTORY_STATUS.RENOVADO : base;
  const start = getSafeDateOrNull(contract?.startsAt);
  if (start && start.getTime() > ref.getTime()) return CONTRACT_STATUS.AGENDADO;
  if (!renewals.length) return base;
  const end = contractEndOf(contract);
  const ended = Boolean(end && calendarDaysBetween(ref, end) < 0);
  return renewalStarted || ended ? HISTORY_STATUS.RENOVADO : HISTORY_STATUS.EM_USO;
}

// O contrato está em uso em `now`: já começou (importado sem início vale pela
// criação), não foi cancelado e ainda vale, com o fim efetivo hoje ou depois
// por dia do calendário, ou está trancado, que congela o fim. É a regra do
// destaque da aba Contratos (contractsTab.js) e do contrato em uso da
// renovação (runningPredecessorOf).
export function isInUseAt(contract, now = new Date()) {
  if (!contract || contract.status === CONTRACT_STATUS.CANCELADO) return false;
  const ref = getSafeDateOrNull(now) || new Date();
  const start = getSafeDateOrNull(contract.startsAt) || getSafeDateOrNull(contract.createdAt);
  if (start && start.getTime() > ref.getTime()) return false;
  if (contract.status === CONTRACT_STATUS.TRANCADO) return true;
  const end = contractEndOf(contract);
  return Boolean(end && calendarDaysBetween(ref, end) >= 0);
}
```

E trocar `runningPredecessorOf` inteira (do comentário `// O contrato que esta renovação continua, enquanto ele ainda vale: já começou,` até o `}` que fecha a função) por:

```js
// O contrato que esta renovação continua, enquanto ele está em uso
// (isInUseAt). Null quando ela já começou, ou sem o contrato ligado na lista.
export function runningPredecessorOf(contract, leadContracts, now = new Date()) {
  if (!contract?.renewedFromId) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  const start = getSafeDateOrNull(contract.startsAt);
  if (start && start.getTime() <= ref.getTime()) return null;
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const prev = list.find((c) => c?.id === contract.renewedFromId);
  return prev && isInUseAt(prev, ref) ? prev : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractHistory.test.js src/lib/__tests__/profileContractActions.test.js`
Expected: PASS (o teste de render continua verde: a aba velha só muda de texto na faixa quando o anterior é trancado, e o teste não cobre esse caso).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractHistory.js src/lib/__tests__/contractHistory.test.js
git commit -m "feat: trancado conta como em uso, e vira renovado quando a renovação começa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: `contractsTab.js`: destaque, próximo, fatos, contagem, botões e linha do tempo

**Files:**
- Create: `src/lib/contractsTab.js`
- Modify: `src/lib/contracts.js` (só exporta `closedPausesOf`)
- Test: `src/lib/__tests__/contractsTab.test.js` (novo)

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/contractsTab.test.js`:

```js
// O modelo puro da aba Contratos (src/lib/contractsTab.js): quem é o destaque
// e o próximo, os fatos de cada contrato e a geometria da linha do tempo.
// Hoje é 30/09/2026, às 10h, como no mockup aprovado.
import { describe, it, expect } from 'vitest';
import {
  contractFactsOf, contractTimelineOf, contractsTabModel, gapText, heroActionsOf, heroCountdownOf, joinTextOf,
  originTextOf, shortContractId, summaryContractOf
} from '../contractsTab.js';
import { CONTRACT_STATUS } from '../contracts.js';
import { HISTORY_STATUS } from '../contractHistory.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const HOJE = new Date(2026, 8, 30, 10, 0);
const L = 'l1';
const K = (id, extra) => ({
  id, leadId: L, planName: `Plano ${id}`, value: 1200, listValue: 1200, durationMonths: 12, status: 'ativo', consultantName: 'Ana', ...extra
});

// O Trimestral, cancelado em 22/06/2024; o Start de 2024, trancado 20 dias e
// esticado até 10/10/2025; o Start em uso, com desconto; o Flow marcado.
const trimestral = K('t1', {
  planName: 'Trimestral', value: 447, listValue: 447, durationMonths: 3, status: 'cancelado',
  startsAt: D(2024, 5, 6), endsAt: D(2024, 8, 6), cancelledAt: D(2024, 6, 22), cancelReason: 'Financeiro', createdAt: D(2024, 5, 6)
});
const start24 = K('s1', {
  planName: 'Start', value: 1188, listValue: 1188, startsAt: D(2024, 9, 20), endsAt: D(2025, 10, 10), createdAt: D(2024, 9, 20),
  pausedDaysTotal: 20, resumedAt: D(2025, 1, 25), pauseHistory: [{ pausedAt: D(2025, 1, 5), resumedAt: D(2025, 1, 25) }]
});
const emUso = K('k1', {
  planName: 'Start', value: 1308, listValue: 1428, discountReason: 'Fidelidade', renewedFromId: 's1',
  startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9)
});
const proximo = K('k2', {
  planName: 'Flow', value: 1788, listValue: 1788, renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28)
});
const lead = (currentContractId, extra = {}) => ({ id: L, currentContractId, ...extra });

describe('contractsTabModel: destaque, próximo e Histórico', () => {
  it('sem próximo: o último contrato é o destaque', () => {
    const m = contractsTabModel({ lead: lead('k1'), contracts: [trimestral, start24, emUso], now: HOJE });
    expect(m.latest).toBe(emUso);
    expect(m.hero).toBe(emUso);
    expect(m.next).toBeNull();
    expect(m.join).toBeNull();
    expect(m.history.map((c) => c.id)).toEqual(['s1', 't1']);
  });

  it('renovação emendada que ainda não começou: o em uso é o destaque, a renovação é o próximo, sem intervalo', () => {
    const m = contractsTabModel({ lead: lead('k2'), contracts: [trimestral, start24, emUso, proximo], now: HOJE });
    expect(m.latest).toBe(proximo);
    expect(m.hero).toBe(emUso);
    expect(m.next).toBe(proximo);
    expect(m.history.map((c) => c.id)).toEqual(['s1', 't1']);
    expect(joinTextOf(m.join)).toBe('sem intervalo');
  });

  it('renovação com intervalo: o encaixe diz os dias sem contrato', () => {
    const depois = { ...proximo, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, depois], now: HOJE });
    expect(m.hero).toBe(emUso);
    expect(joinTextOf(m.join)).toBe('8 dias sem contrato antes');
  });

  it('em uso trancado continua o destaque, e reativado com o fim depois do início do próximo os dois se cruzam', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) };
    expect(contractsTabModel({ lead: lead('k2'), contracts: [trancado, proximo], now: HOJE }).hero).toBe(trancado);
    const reativado = { ...emUso, endsAt: D(2026, 10, 21), pausedDaysTotal: 10 };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [reativado, proximo], now: HOJE });
    expect(m.hero).toBe(reativado);
    expect(joinTextOf(m.join)).toBe('10 dias junto com o atual');
  });

  it('em uso cancelado: o último contrato é o destaque, como agendado, e o cancelado vai para o Histórico', () => {
    const cancelado = { ...emUso, status: 'cancelado', cancelledAt: D(2026, 9, 25) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [cancelado, proximo], now: HOJE });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history).toEqual([cancelado]);
  });

  it('agendado sem nenhum contrato em uso', () => {
    const vencido = { ...emUso, endsAt: D(2026, 9, 10) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [vencido, proximo], now: HOJE });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history).toEqual([vencido]);
  });

  it('sem ligação, vale outro contrato em uso do lead, o de início mais recente', () => {
    const solto = { ...proximo, renewedFromId: null, seamless: false };
    const paralelo = K('p1', { planName: 'Pilates', startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 3, 1) });
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, paralelo, solto], now: HOJE });
    expect(m.hero).toBe(paralelo);
    expect(m.next).toBe(solto);
    expect(m.history).toEqual([emUso]);
  });

  it('no dia em que o próximo começa, ele assume o destaque', () => {
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, proximo], now: D(2026, 10, 12) });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history).toEqual([emUso]);
  });

  it('último contrato sem documento na lista sai do resumo do lead', () => {
    const resumo = lead('k9', {
      currentPlanName: 'Start', currentContractValue: 1308, currentContractStartsAt: D(2025, 10, 11),
      currentContractEndsAt: D(2026, 10, 11), currentContractStatus: 'ativo'
    });
    const m = contractsTabModel({ lead: resumo, contracts: [trimestral], now: HOJE });
    expect(m.hero).toEqual(summaryContractOf(resumo));
    expect(m.hero.fromSummary).toBe(true);
    expect(m.hero.planName).toBe('Start');
    expect(m.history).toEqual([trimestral]);
  });

  it('sem contrato nenhum', () => {
    expect(contractsTabModel({ lead: { id: L }, contracts: [], now: HOJE })).toEqual({ latest: null, hero: null, next: null, history: [], join: null });
  });
});

describe('heroCountdownOf: o bloco de contagem do card', () => {
  it('em uso: restam N dias; com próximo, o rótulo diz em uso', () => {
    expect(heroCountdownOf({ contract: emUso, status: CONTRACT_STATUS.A_VENCER, now: HOJE })).toEqual({ label: 'Restam', days: 11, note: 'vence 11/10/2026' });
    expect(heroCountdownOf({ contract: emUso, status: CONTRACT_STATUS.ATIVO, hasNext: true, now: HOJE }).label).toBe('Em uso · restam');
  });

  it('trancado: há N dias, até o início de hoje', () => {
    expect(heroCountdownOf({ contract: { ...emUso, pausedAt: D(2026, 9, 20) }, status: CONTRACT_STATUS.TRANCADO, now: HOJE }))
      .toEqual({ label: 'Trancado há', days: 10, note: 'desde 20/09/2026' });
  });

  it('agendado: começa em N dias', () => {
    expect(heroCountdownOf({ contract: proximo, status: CONTRACT_STATUS.AGENDADO, now: HOJE })).toEqual({ label: 'Começa em', days: 12, note: 'início 12/10/2026' });
  });
});

describe('heroActionsOf: os botões em cada situação', () => {
  it('em uso sem próximo: Renovar, e Corrigir, Trancar, Cancelar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.ATIVO })).toEqual({ primary: 'renovar', actions: ['corrigir', 'trancar', 'cancelar'] });
    expect(heroActionsOf({ status: CONTRACT_STATUS.A_VENCER })).toEqual({ primary: 'renovar', actions: ['corrigir', 'trancar', 'cancelar'] });
  });
  it('em uso trancado sem próximo: Reativar, e Corrigir, Cancelar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.TRANCADO })).toEqual({ primary: 'reativar', actions: ['corrigir', 'cancelar'] });
  });
  it('em uso com próximo: só Trancar (ou Reativar) e Cancelar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.ATIVO, hasNext: true })).toEqual({ primary: null, actions: ['trancar', 'cancelar'] });
    expect(heroActionsOf({ status: CONTRACT_STATUS.TRANCADO, hasNext: true })).toEqual({ primary: null, actions: ['reativar', 'cancelar'] });
  });
  it('agendado sem contrato em uso: Ativar agora, e Corrigir, Cancelar, sem Trancar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.AGENDADO })).toEqual({ primary: 'ativar', actions: ['corrigir', 'cancelar'] });
  });
});

describe('contractFactsOf: os fatos de cada contrato', () => {
  const todos = [trimestral, start24, emUso, proximo];

  it('contrato esticado pelo trancamento: fim previsto pela duração, fim de fato depois, com o motivo', () => {
    const f = contractFactsOf(start24, todos, HOJE, 30);
    expect(f).toMatchObject({
      id: 's1', shortId: 'S1', planName: 'Start', months: 12, start: D(2024, 9, 20), plannedEnd: D(2025, 9, 20), actualEnd: D(2025, 10, 10),
      pausedDays: 20, pauseCount: 1, value: 1188, monthly: 99, listValue: 1188, discount: 0, discountReason: null,
      closedBy: 'Ana', closedAt: D(2024, 9, 20), cancelledAt: null, cancelReason: null, cancelNote: null,
      status: HISTORY_STATUS.RENOVADO, lockedAtRenewalStart: false
    });
    expect(f.endReason).toEqual({ kind: 'trancamento', days: 20, text: '20 dias depois, pelo trancamento' });
    expect(f.pauses).toEqual([{ from: D(2025, 1, 5), to: D(2025, 1, 25), fromImport: false, reconstructed: false }]);
    // Do dia seguinte ao cancelamento (22/06) à véspera do início (20/09): 89 dias
    // sem contrato (contractOriginOf conta assim; o "90" do mockup é dado de exemplo).
    expect(originTextOf(f.origin)).toBe('retorno, 89 dias depois');
  });

  it('cancelado: fim de fato no cancelamento, com o motivo, e sem trancamento', () => {
    const f = contractFactsOf(trimestral, todos, HOJE, 30);
    expect(f).toMatchObject({
      plannedEnd: D(2024, 8, 6), actualEnd: D(2024, 6, 22), pausedDays: 0, pauseCount: 0, pauses: [], monthly: 149,
      status: CONTRACT_STATUS.CANCELADO, cancelledAt: D(2024, 6, 22), cancelReason: 'Financeiro'
    });
    expect(f.endReason).toEqual({ kind: 'cancelado', days: 45, text: 'cancelado · Financeiro' });
    expect(originTextOf(f.origin)).toBe('primeira matrícula');
  });

  it('encurtado pela renovação: N dias antes, e a origem conta a renovação', () => {
    const encurtado = { ...emUso, endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const antecipada = { ...proximo, startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5) };
    const f = contractFactsOf(encurtado, [start24, encurtado, antecipada], D(2026, 11, 1), 30);
    expect(f.plannedEnd).toEqual(D(2026, 10, 11));
    expect(f.endReason).toEqual({ kind: 'renovacao', days: 7, text: '7 dias antes, pela renovação' });
    expect(f.status).toBe(HISTORY_STATUS.RENOVADO);
    expect(originTextOf(f.origin)).toBe('1ª renovação');
  });

  it('desconto: tabela menos valor, com o motivo', () => {
    expect(contractFactsOf(emUso, todos, HOJE, 30)).toMatchObject({ discount: 120, listValue: 1428, discountReason: 'Fidelidade', monthly: 109 });
  });

  it('trancado agora: a pausa aberta conta até o início de hoje; ainda trancado quando a renovação começou, vira renovado com a nota', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20), pausedDaysTotal: 5, pauseHistory: [{ pausedAt: D(2026, 3, 1), resumedAt: D(2026, 3, 6) }] };
    const f = contractFactsOf(trancado, [trancado, proximo], HOJE, 30);
    expect(f).toMatchObject({ pausedDays: 15, pauseCount: 2, status: CONTRACT_STATUS.TRANCADO, lockedAtRenewalStart: false });
    expect(f.pauses[1]).toEqual({ from: D(2026, 9, 20), to: null, fromImport: false, reconstructed: false });
    expect(f.endReason.kind).toBeNull();
    expect(contractFactsOf(trancado, [trancado, proximo], D(2026, 10, 15), 30)).toMatchObject({ status: HISTORY_STATUS.RENOVADO, lockedAtRenewalStart: true });
  });

  it('cancelado ainda trancado: a pausa aberta vai até o cancelamento', () => {
    const c = { ...emUso, status: 'cancelado', pausedAt: D(2026, 9, 20), cancelledAt: D(2026, 9, 25), cancelReason: 'Saúde ou lesão' };
    const f = contractFactsOf(c, [c], HOJE, 30);
    expect(f.pauses).toEqual([{ from: D(2026, 9, 20), to: D(2026, 9, 25), fromImport: false, reconstructed: false }]);
    expect(f.pausedDays).toBe(5);
    expect(f.actualEnd).toEqual(D(2026, 9, 25));
  });

  it('importado sem valor, sem plano e sem duração: valor e média nulos, fim previsto pelo fim gravado', () => {
    const importado = { id: 'i1', leadId: L, planName: null, value: null, durationMonths: null, status: 'ativo', createdAt: D(2026, 9, 4), endsAt: D(2026, 12, 31), importBatchId: 'lote' };
    const f = contractFactsOf(importado, [importado], HOJE, 30);
    expect(f).toMatchObject({ planName: null, months: 0, value: null, monthly: null, start: D(2026, 9, 4), plannedEnd: D(2026, 12, 31), actualEnd: D(2026, 12, 31), pausedDays: 0 });
    expect(f.endReason.kind).toBeNull();
  });

  it('pausa antiga sem histórico entra refeita pelo total, como no Operacional', () => {
    const antigo = { ...start24, pauseHistory: undefined };
    expect(contractFactsOf(antigo, todos, HOJE, 30).pauses).toEqual([{ from: D(2025, 1, 5), to: D(2025, 1, 25), fromImport: false, reconstructed: true }]);
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    const ts = (d) => ({ toDate: () => d });
    const cru = { ...start24, startsAt: ts(start24.startsAt), endsAt: ts(start24.endsAt), createdAt: ts(start24.createdAt) };
    expect(contractFactsOf(cru, [cru], HOJE, 30)).toMatchObject({ start: D(2024, 9, 20), plannedEnd: D(2025, 9, 20), actualEnd: D(2025, 10, 10) });
  });
});

describe('textos curtos', () => {
  it('gapText: dias até quatro meses, meses depois', () => {
    expect(gapText(1)).toBe('1 dia');
    expect(gapText(90)).toBe('90 dias');
    expect(gapText(120)).toBe('4 meses');
    expect(gapText(400)).toBe('13 meses');
  });
  it('shortContractId', () => {
    expect(shortContractId('k3f9a2qdx7')).toBe('K3F9A2QD');
    expect(shortContractId(null)).toBe('');
  });
  it('originTextOf: upgrade com o intervalo, e sem origem é primeira matrícula', () => {
    expect(originTextOf({ kind: 'upgrade', gapDays: 3 })).toBe('upgrade, 3 dias depois');
    expect(originTextOf({ kind: 'upgrade', gapDays: null })).toBe('upgrade');
    expect(originTextOf(null)).toBe('primeira matrícula');
  });
});

describe('contractTimelineOf: a linha do tempo, em porcentagem', () => {
  it('um segmento por contrato que valeu, com o tipo, a trilha, os cantos e o title', () => {
    const t = contractTimelineOf({ contracts: [trimestral, start24, emUso, proximo], heroId: 'k1', nextId: 'k2', now: HOJE, checkpoints: [90, 60, 30] });
    expect(t.start).toEqual(D(2024, 5, 6));
    expect(t.end).toEqual(D(2027, 10, 12));
    expect(t.lanes).toHaveLength(1);
    expect(t.lanes[0].map((s) => [s.id, s.kind])).toEqual([['t1', 'cancelado'], ['s1', 'encerrado'], ['k1', 'em_uso'], ['k2', 'proximo']]);
    const [t1, s1, k1, k2] = t.lanes[0];
    expect(t1.title).toBe('Trimestral · cancelado em 22/06/2024');
    expect(s1.title).toBe('Start · 20/09/2024 a 10/10/2025');
    expect(k1.title).toBe('Start · em uso até 11/10/2026');
    expect(k2.title).toBe('Flow · começa em 12/10/2026');
    expect(t1.leftPct).toBe(0);
    expect(k2.leftPct + k2.widthPct).toBeCloseTo(100, 0);
    // Segmentos em ordem, sem se cruzar, e os cantos só onde um não encosta no outro.
    expect(s1.leftPct).toBeGreaterThan(t1.leftPct + t1.widthPct);
    expect(k1.leftPct).toBeGreaterThanOrEqual(s1.leftPct + s1.widthPct);
    expect([t1.joinsPrev, t1.joinsNext, s1.joinsPrev, s1.joinsNext, k1.joinsPrev, k1.joinsNext, k2.joinsPrev, k2.joinsNext])
      .toEqual([false, false, false, true, true, true, true, false]);
    expect(t.todayPct).toBeGreaterThan(k1.leftPct);
    expect(t.todayPct).toBeLessThan(k2.leftPct);
    expect(t.years.map((y) => y.year)).toEqual([2025, 2026, 2027]);
    expect(s1.pauses).toHaveLength(1);
    expect(s1.pauses[0].title).toBe('Trancado de 05/01/2025 a 25/01/2025');
    expect(s1.pauses[0].leftPct).toBeGreaterThan(s1.leftPct);
    expect(t.heroLane).toBe(0);
    expect(t.marks.map((m) => m.days)).toEqual([90, 60, 30]);
    expect(t.marks[2].title).toBe('Marco de 30 dias · 11/09/2026 · passou sem contato');
    expect(t.marks[2].pct).toBeGreaterThan(k1.leftPct);
    expect(t.marks[2].pct).toBeLessThan(t.todayPct);
  });

  it('contratos que se cruzam vão para a segunda trilha', () => {
    const paralelo = K('p1', { planName: 'Pilates', startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1) });
    const t = contractTimelineOf({ contracts: [emUso, paralelo], heroId: 'k1', now: HOJE });
    expect(t.lanes).toHaveLength(2);
    expect(t.lanes[0].map((s) => s.id)).toEqual(['k1']);
    expect(t.lanes[1].map((s) => s.id)).toEqual(['p1']);
    expect(t.heroLane).toBe(0);
  });

  it('renovação desfeita fica de fora, e sem contrato que valeu não há linha', () => {
    const desfeita = { ...proximo, status: 'cancelado', cancelledAt: D(2026, 9, 29) };
    const t = contractTimelineOf({ contracts: [emUso, desfeita], heroId: 'k1', now: HOJE });
    expect(t.lanes.flat().map((s) => s.id)).toEqual(['k1']);
    expect(contractTimelineOf({ contracts: [desfeita], now: HOJE })).toBeNull();
    expect(contractTimelineOf({ contracts: [], now: HOJE })).toBeNull();
  });

  it('o eixo vai até hoje quando hoje passa do fim mais distante, e o trancado em uso projeta o fim pelos dias parados', () => {
    const vencido = { ...emUso, endsAt: D(2026, 9, 10) };
    const t = contractTimelineOf({ contracts: [vencido], now: HOJE });
    expect(t.end).toEqual(HOJE);
    expect(t.todayPct).toBe(100);
    expect(t.heroLane).toBeNull();
    expect(t.marks).toEqual([]);
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) };
    const tt = contractTimelineOf({ contracts: [trancado], heroId: 'k1', now: HOJE });
    const seg = tt.lanes[0][0];
    expect(seg.kind).toBe('em_uso');
    expect(seg.pauses[0].title).toBe('Trancado desde 20/09/2026');
    expect(tt.end).toEqual(D(2026, 10, 21));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractsTab.test.js`
Expected: FAIL. O módulo `../contractsTab.js` não existe.

- [ ] **Step 3: Exportar `closedPausesOf` em `contracts.js`**

Em `src/lib/contracts.js`, trocar `const closedPausesOf = (contract) => {` por `export const closedPausesOf = (contract) => {`, e o comentário acima por:

```js
// Pausas já encerradas, para o Operacional e a aba Contratos saberem quando o
// cliente esteve trancado. Contrato de antes do histórico começa com UM item
// refeito.
```

- [ ] **Step 4: Criar `src/lib/contractsTab.js`**

```js
// A aba Contratos da ficha: quem é o destaque, o próximo e o Histórico, o
// encaixe entre os dois, a contagem e os botões do card, os fatos de cada
// contrato e a geometria da linha do tempo, já em porcentagem. Puro: sem React
// e sem SDK, e recebe os docs como chegam do Firestore (Timestamp ou Date).
// Spec: docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md

import { CONTRACT_STATUS, closedPausesOf, contractDiscountOf, isImportPause, neverTookEffect } from './contracts.js';
import {
  CONTRACT_ORIGIN, HISTORY_STATUS, contractEndOf, contractOriginOf, historyStatusOf, isInUseAt, runningPredecessorOf
} from './contractHistory.js';
import { addDays, addMonths, calendarDaysBetween, daysBetween, getSafeDateOrNull, startOfLocalDay } from './dates.js';
import { SEAM_KIND, computeSeam, contractVigencia, vigenciaRefDate } from './renewal.js';
import { DEFAULT_RENEWAL_CHECKPOINTS } from './renewalGoal.js';

const DAY_MS = 86400000;
const fmtDia = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : '—';
};
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const round1 = (n) => Math.round(n * 10) / 10;

// Início do contrato: o gravado, ou a criação no importado sem início, como
// no Operacional.
export const contractStartOf = (c) => getSafeDateOrNull(c?.startsAt) || getSafeDateOrNull(c?.createdAt);

// Número curto do contrato, o mesmo em toda a aba.
export const shortContractId = (id) => String(id || '').slice(0, 8).toUpperCase();

const byStartDesc = (a, b) => (contractStartOf(b)?.getTime() || 0) - (contractStartOf(a)?.getTime() || 0);

// O último contrato quando o documento dele não está na lista: o resumo do
// lead vira um contrato, para a aba não dizer "Ainda não é cliente" com um
// contrato gravado. Leva a marca `fromSummary`.
export const summaryContractOf = (lead) => (lead?.currentContractId ? {
  id: lead.currentContractId,
  leadId: lead.id ?? null,
  planName: lead.currentPlanName ?? null,
  value: lead.currentContractValue ?? null,
  startsAt: lead.currentContractStartsAt ?? null,
  endsAt: lead.currentContractEndsAt ?? null,
  status: lead.currentContractStatus ?? CONTRACT_STATUS.ATIVO,
  seamless: Boolean(lead.currentContractSeamless),
  fromSummary: true
} : null);

// Quem é o destaque (hero), o próximo e o Histórico. O último contrato é o de
// lead.currentContractId. Se ele já começou, é o destaque e não há próximo. Se
// ainda não começou, o destaque é o contrato em uso: o que ele renova
// (runningPredecessorOf) ou, sem ligação, outro contrato do lead em uso
// (isInUseAt), o de início mais recente; aí o último contrato é o próximo. Sem
// contrato em uso, o último é o destaque, como agendado. O Histórico é o resto,
// do início mais recente ao mais antigo, com as renovações desfeitas dentro.
// `join`: o encaixe do próximo com o em uso (computeSeam), ou null.
export function contractsTabModel({ lead, contracts, now = new Date() } = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const list = (Array.isArray(contracts) ? contracts : []).filter(Boolean);
  const latest = list.find((c) => c.id === lead?.currentContractId) || summaryContractOf(lead);
  const latestStart = contractStartOf(latest);
  const notStarted = Boolean(latest && latestStart && latestStart.getTime() > ref.getTime());
  let hero = latest;
  let next = null;
  if (notStarted) {
    const inUse = runningPredecessorOf(latest, list, ref)
      || list.filter((c) => c.id !== latest.id && isInUseAt(c, ref)).sort(byStartDesc)[0]
      || null;
    if (inUse) {
      hero = inUse;
      next = latest;
    }
  }
  const history = list.filter((c) => c.id !== hero?.id && c.id !== next?.id).sort(byStartDesc);
  const join = next ? computeSeam(contractEndOf(hero), contractStartOf(next)) : null;
  return { latest, hero, next, history, join };
}

// O encaixe do próximo com o contrato em uso, na faixa do próximo.
export function joinTextOf(join) {
  if (!join) return null;
  if (join.kind === SEAM_KIND.EMENDA) return 'sem intervalo';
  if (join.kind === SEAM_KIND.LACUNA) return `${dias(join.gapDays)} sem contrato antes`;
  return `${dias(join.overlapDays)} junto com o atual`;
}

// O bloco de contagem do card: o rótulo, o número e a linha de baixo. Agendado
// conta até começar; trancado conta os dias parados até o início de hoje, a
// conta da reativação (buildContractResume), senão à tarde o card dizia um dia
// a mais que o modal; em uso conta até vencer, e com próximo o rótulo diz que
// está em uso, porque o selo do plano também diz.
export function heroCountdownOf({ contract, status, hasNext = false, now = new Date() } = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const start = contractStartOf(contract);
  const end = getSafeDateOrNull(contract?.endsAt);
  if (status === CONTRACT_STATUS.AGENDADO) {
    const days = start ? Math.max(0, Math.ceil((start.getTime() - ref.getTime()) / DAY_MS)) : 0;
    return { label: 'Começa em', days, note: `início ${fmtDia(start)}` };
  }
  if (status === CONTRACT_STATUS.TRANCADO) {
    const pausedAt = getSafeDateOrNull(contract?.pausedAt);
    const days = pausedAt ? Math.max(0, daysBetween(pausedAt, startOfLocalDay(ref)) || 0) : 0;
    return { label: 'Trancado há', days, note: `desde ${fmtDia(pausedAt)}` };
  }
  const days = end ? Math.max(0, Math.ceil((end.getTime() - ref.getTime()) / DAY_MS)) : 0;
  return { label: hasNext ? 'Em uso · restam' : 'Restam', days, note: `vence ${fmtDia(end)}` };
}

// Os botões do card em cada situação (tabela "Botões em cada situação" da
// spec). `primary` é o botão grande; `actions` são os pequenos, na ordem.
export function heroActionsOf({ status, hasNext = false } = {}) {
  const paused = status === CONTRACT_STATUS.TRANCADO;
  if (hasNext) return { primary: null, actions: [paused ? 'reativar' : 'trancar', 'cancelar'] };
  if (status === CONTRACT_STATUS.AGENDADO) return { primary: 'ativar', actions: ['corrigir', 'cancelar'] };
  if (paused) return { primary: 'reativar', actions: ['corrigir', 'cancelar'] };
  return { primary: 'renovar', actions: ['corrigir', 'trancar', 'cancelar'] };
}

// Os períodos de trancamento: os encerrados (pauseHistory, ou um refeito pelo
// total, como o Operacional) e o aberto, do trancado e do cancelado ainda
// trancado, que vai até hoje ou até o cancelamento. `days` é o total gravado
// mais a pausa aberta, até o início de hoje; `openDays`, só a pausa aberta.
function pausesOf(contract, ref) {
  const closed = closedPausesOf(contract)
    .map((p) => ({
      from: getSafeDateOrNull(p?.pausedAt), to: getSafeDateOrNull(p?.resumedAt),
      fromImport: Boolean(p?.fromImport), reconstructed: Boolean(p?.reconstructed)
    }))
    .filter((p) => p.from && p.to);
  const status = contract?.status;
  const openAt = status === CONTRACT_STATUS.TRANCADO || (status === CONTRACT_STATUS.CANCELADO && contract?.pausedAt)
    ? getSafeDateOrNull(contract.pausedAt) : null;
  const openTo = openAt && status === CONTRACT_STATUS.CANCELADO ? contractEndOf(contract) : null;
  const pauses = openAt
    ? [...closed, { from: openAt, to: openTo, fromImport: isImportPause(contract, openAt), reconstructed: false }]
    : closed;
  const openDays = openAt ? Math.max(0, daysBetween(openAt, openTo || startOfLocalDay(ref)) || 0) : 0;
  return { days: (Number(contract?.pausedDaysTotal) || 0) + openDays, openDays, count: pauses.length, pauses };
}

// Por que o fim de fato difere do previsto, nesta ordem: cancelado (com o
// motivo), encerrado antes pela renovação (tem originalEndsAt e terminou antes
// dele), esticado pelo trancamento. `days` conta contra o fim previsto.
function endReasonOf({ contract, actualEnd, plannedEnd }) {
  const diff = actualEnd && plannedEnd ? calendarDaysBetween(actualEnd, plannedEnd) : 0;
  if (contract?.status === CONTRACT_STATUS.CANCELADO) {
    return { kind: 'cancelado', days: diff, text: contract.cancelReason ? `cancelado · ${contract.cancelReason}` : 'cancelado' };
  }
  const original = getSafeDateOrNull(contract?.originalEndsAt);
  if (original && actualEnd && calendarDaysBetween(actualEnd, original) > 0 && diff > 0) {
    return { kind: 'renovacao', days: diff, text: `${dias(diff)} antes, pela renovação` };
  }
  if (diff < 0) return { kind: 'trancamento', days: -diff, text: `${dias(-diff)} depois, pelo trancamento` };
  return { kind: null, days: 0, text: null };
}

// Intervalo sem contrato, em dias até quatro meses e em meses depois.
export const gapText = (days) => {
  if (days < 120) return dias(days);
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? 'mês' : 'meses'}`;
};

// A origem por extenso, na coluna Contrato do Histórico: renovação com a
// ordem, retorno e upgrade com os dias sem contrato antes, ou primeira
// matrícula.
export function originTextOf(origin) {
  const gap = origin?.gapDays ? `, ${gapText(origin.gapDays)} depois` : '';
  if (origin?.kind === CONTRACT_ORIGIN.RENOVACAO) return `${origin.ordinal}ª renovação`;
  if (origin?.kind === CONTRACT_ORIGIN.UPGRADE) return `upgrade${gap}`;
  if (origin?.kind === CONTRACT_ORIGIN.RETORNO) return `retorno${gap}`;
  return 'primeira matrícula';
}

// Os fatos de um contrato, para a tabela do Histórico, a linha aberta, o card
// e a faixa do próximo (seção "Detalhes de cada contrato" da spec).
export function contractFactsOf(contract, leadContracts, now = new Date(), thresholdDays) {
  const ref = getSafeDateOrNull(now) || new Date();
  const start = contractStartOf(contract);
  const months = Number(contract?.durationMonths) || 0;
  const recordedEnd = getSafeDateOrNull(contract?.endsAt);
  const actualEnd = contractEndOf(contract);
  const { days: pausedDays, count: pauseCount, pauses } = pausesOf(contract, ref);
  // Fim previsto: início mais a duração vendida. Sem duração gravada, o fim
  // gravado menos os dias trancados, que o esticaram.
  const plannedEnd = start && months > 0
    ? addMonths(start, months)
    : (recordedEnd && pausedDays > 0 ? addDays(recordedEnd, -pausedDays) : recordedEnd);
  const status = historyStatusOf(contract, leadContracts, ref, thresholdDays);
  const value = contract?.value == null ? null : Number(contract.value);
  return {
    id: contract?.id ?? null,
    shortId: shortContractId(contract?.id),
    planName: contract?.planName || null,
    months,
    start,
    plannedEnd,
    actualEnd,
    endReason: endReasonOf({ contract, actualEnd, plannedEnd }),
    pausedDays,
    pauseCount,
    pauses,
    value,
    monthly: value != null && months > 0 ? value / months : null,
    listValue: Number(contract?.listValue) || 0,
    discount: contractDiscountOf(contract),
    discountReason: contract?.discountReason || null,
    closedBy: contract?.consultantName || null,
    closedAt: getSafeDateOrNull(contract?.createdAt),
    cancelledAt: getSafeDateOrNull(contract?.cancelledAt),
    cancelReason: contract?.cancelReason || null,
    cancelNote: contract?.cancelNote || null,
    origin: contractOriginOf(contract, leadContracts),
    status,
    // Ainda estava trancado quando a renovação começou (historyStatusOf).
    lockedAtRenewalStart: contract?.status === CONTRACT_STATUS.TRANCADO && status === HISTORY_STATUS.RENOVADO
  };
}

// A linha do tempo de todos os contratos do cliente, num eixo do início mais
// antigo até o fim mais distante ou até hoje. Um segmento por contrato que
// chegou a valer (a renovação desfeita fica de fora): em uso, próximo,
// encerrado ou cancelado (até o cancelamento). O trancado em uso projeta o fim
// pelos dias parados. Contratos que se cruzam vão para a primeira trilha em
// que cabem. Os trancamentos, as marcas de ano, os marcos de renovação do em
// uso (contractVigencia) e o marcador de hoje saem em porcentagem do eixo.
// `joinsPrev`/`joinsNext` dizem se o segmento encosta no vizinho da trilha
// (até um dia do calendário), para o canto não ser arredondado ali. Null sem
// contrato que valeu.
export function contractTimelineOf({
  contracts, heroId = null, nextId = null, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS, handled = []
} = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const items = (Array.isArray(contracts) ? contracts : [])
    .filter((c) => c && !neverTookEffect(c))
    .map((c) => {
      const start = contractStartOf(c);
      const recorded = getSafeDateOrNull(c.endsAt);
      const end = c.id === nextId ? recorded
        : c.status === CONTRACT_STATUS.TRANCADO && recorded ? addDays(recorded, pausesOf(c, ref).openDays)
          : contractEndOf(c);
      return { contract: c, start, end };
    })
    .filter((it) => it.start && it.end && it.end.getTime() >= it.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!items.length) return null;

  const t0 = items[0].start.getTime();
  const t1 = Math.max(ref.getTime(), ...items.map((it) => it.end.getTime()));
  const span = Math.max(t1 - t0, 1);
  const pct = (t) => Math.max(0, Math.min(100, ((t - t0) / span) * 100));

  const lanes = [];
  const laneLast = [];
  let heroLane = null;
  items.forEach((it) => {
    const c = it.contract;
    const kind = c.id === heroId ? 'em_uso'
      : c.id === nextId ? 'proximo'
        : c.status === CONTRACT_STATUS.CANCELADO ? 'cancelado' : 'encerrado';
    let lane = laneLast.findIndex((last) => last.end.getTime() < it.start.getTime());
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
      laneLast.push(null);
    }
    const prev = laneLast[lane];
    const joinsPrev = Boolean(prev && calendarDaysBetween(prev.end, it.start) <= 1);
    if (joinsPrev) prev.segment.joinsNext = true;
    const plano = c.planName || 'Contrato';
    const title = kind === 'em_uso' ? `${plano} · em uso até ${fmtDia(it.end)}`
      : kind === 'proximo' ? `${plano} · começa em ${fmtDia(it.start)}`
        : kind === 'cancelado' ? `${plano} · cancelado em ${fmtDia(it.end)}`
          : `${plano} · ${fmtDia(it.start)} a ${fmtDia(it.end)}`;
    const left = pct(it.start.getTime());
    const right = pct(it.end.getTime());
    const pauses = pausesOf(c, ref).pauses.map((p) => {
      const from = Math.max(p.from.getTime(), it.start.getTime());
      const to = Math.min((p.to || ref).getTime(), it.end.getTime());
      if (to <= from) return null;
      return {
        leftPct: round1(pct(from)),
        widthPct: round1(pct(to) - pct(from)),
        title: p.to ? `Trancado de ${fmtDia(p.from)} a ${fmtDia(p.to)}` : `Trancado desde ${fmtDia(p.from)}`
      };
    }).filter(Boolean);
    const segment = { id: c.id, kind, leftPct: round1(left), widthPct: round1(right - left), title, joinsPrev, joinsNext: false, pauses };
    lanes[lane].push(segment);
    laneLast[lane] = { end: it.end, segment };
    if (kind === 'em_uso') heroLane = lane;
  });

  const years = [];
  for (let y = new Date(t0).getFullYear() + 1; y <= new Date(t1).getFullYear(); y += 1) {
    const jan = new Date(y, 0, 1).getTime();
    if (jan > t0 && jan < t1) years.push({ year: y, pct: round1(pct(jan)) });
  }

  // Os marcos de renovação da academia, só no contrato em uso, com o mesmo
  // title da régua de antes. A régua congela no trancamento (vigenciaRefDate).
  const heroItem = heroId ? items.find((it) => it.contract.id === heroId) : null;
  const vig = heroItem
    ? contractVigencia({ startsAt: heroItem.start, endsAt: heroItem.contract.endsAt, checkpoints, handled, now: vigenciaRefDate(heroItem.contract, ref) })
    : null;
  const marks = (vig?.marks || []).map((m) => ({
    days: m.days,
    pct: round1(pct(m.date.getTime())),
    date: m.date,
    active: m.active,
    passed: m.passed,
    handled: m.handled,
    title: `Marco de ${m.days} dias · ${fmtDia(m.date)}${m.handled ? ' · contato feito' : m.passed ? ' · passou sem contato' : ''}`
  }));

  return { start: new Date(t0), end: new Date(t1), todayPct: round1(pct(ref.getTime())), years, lanes, heroLane, marks };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractsTab.test.js src/lib/__tests__/contracts.test.js src/lib/__tests__/operacional`
Expected: PASS. Se o teste `'um segmento por contrato...'` reclamar de `t.end`: `Math.max` com o `ref` de 30/09/2026 e o fim de 12/10/2027 dá o fim; conferir que `proximo.endsAt` chegou como `Date` (`D(2027, 10, 12)`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/contractsTab.js src/lib/contracts.js src/lib/__tests__/contractsTab.test.js
git commit -m "feat: modelo puro da aba Contratos: destaque, próximo, fatos, contagem e linha do tempo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: A aba sai do `LeadProfileView.jsx` sem mudar de comportamento

**Files:**
- Create: `src/components/profile/contracts/ContractsTab.jsx`
- Modify: `src/views/LeadProfileView.jsx`
- Test: os existentes `src/lib/__tests__/profileContractActions.test.js` e `src/lib/__tests__/profileTimeline.test.js` continuam passando sem mudar.

É uma mudança só de lugar: os três blocos abaixo saem do `LeadProfileView.jsx` e entram no componente sem uma linha alterada, fora as quatro trocas de nome listadas no Step 2. Por isso o JSX não é reproduzido aqui: ele é o que está no arquivo hoje, e a Task 10 o substitui pela tela nova.

- [ ] **Step 1: Rodar os testes de render antes, para ter a referência**

Run: `npx vitest run src/lib/__tests__/profileContractActions.test.js src/lib/__tests__/profileTimeline.test.js`
Expected: PASS.

- [ ] **Step 2: Criar `src/components/profile/contracts/ContractsTab.jsx`**

Com este conteúdo, onde `[BLOCO A]`, `[BLOCO B]` e `[BLOCO C]` são trechos recortados do `LeadProfileView.jsx` de hoje:

```jsx
// A aba Contratos da ficha. Saiu de dentro do LeadProfileView.jsx sem mudar de
// comportamento; a tela nova (linha do tempo, contrato em uso, próximo
// contrato e Histórico em tabela) entra nas tasks seguintes do plano
// docs/superpowers/plans/2026-09-30-contrato-em-uso-e-historico.md.
import { Ban, FileText, GraduationCap, LogIn, PauseCircle, PlayCircle, RefreshCw, TrendingUp, UserPlus } from 'lucide-react';
import { getSafeDateOrNull } from '../../../lib/dates.js';
import { fmtBRL } from '../../../lib/format.js';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL, contractDiscountOf, deriveLeadContractStatus } from '../../../lib/contracts.js';
import { SEAM_KIND, computeSeam, contractVigencia, daysBetween, missedCheckpointsLabel, vigenciaRefDate } from '../../../lib/renewal.js';
import {
  CONTRACT_ORIGIN, HISTORY_STATUS, HISTORY_STATUS_LABEL, contractEndOf, contractOriginOf, historyStatusOf, historySuccessorOf, inUseNoteOf, runningPredecessorOf
} from '../../../lib/contractHistory.js';
import { cn } from '../../../lib/utils.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Btn } from '../../ui/Btn.jsx';

[BLOCO A]

export function ContractsTab({
  lead, leadContracts, currentContract, firstName, isReadOnly, loading, contractThresholdDays, renewalCheckpoints,
  onEnroll, onRenew, onContractAction, onEditContract
}) {
[BLOCO B]

  return (
[BLOCO C]
  );
}
```

- `[BLOCO A]`: as linhas de `// Tom do bloco de contagem, do chip e do preenchimento da régua — o estado do` até o `};` que fecha `const ORIGIN_LABEL = {` (hoje, linhas 68 a 162: `CONTRACT_TONE`, `CapsLabel`, `gapLabel`, `shortContractId`, `OriginCell`, `OriginIcon`, `ORIGIN_LABEL`). Atenção: `CONTRACT_MILESTONE_KINDS` (linhas 82 a 85) é da linha do tempo e FICA no `LeadProfileView.jsx`; ao recortar o bloco, devolver essas quatro linhas para o lugar de onde saíram.
- `[BLOCO B]`: da linha `  const pastContracts = leadContracts.filter(c => c.id !== lead.currentContractId);` (hoje, 868) até a linha `    : null;` que fecha `const vigencia = hasCurrentContract` (hoje, 902). `leadContracts` (861 a 863) e `currentContract` (865 a 867, com o comentário) FICAM no `LeadProfileView.jsx`: a aba recebe os dois por prop, e os modais do fim da view usam o `currentContract`.
- `[BLOCO C]`: da linha `          <div className="space-y-4">` (hoje, 1778) até o `          </div>` que a fecha (hoje, 2151), ou seja, tudo o que está dentro de `<TabsContent value="contratos" className="pt-2">`. Dentro dele, e só dentro dele, fazer estas trocas:
  - `onClick={handleWin}` vira `onClick={onEnroll}` (dois lugares, "Matricular agora" e "Nova matrícula"; conferir com `grep -c "onClick={onEnroll}"`, esperado 2, e `grep -c handleWin`, esperado 0, no arquivo novo);
  - `onClick={handleRenew}` vira `onClick={onRenew}` (um lugar);
  - `openContractAction(` vira `onContractAction(` (três lugares: `'reativar'`, `'trancar'`, `'cancelar'`);
  - o `onClick` do botão Corrigir, `onClick={() => { if (!isReadOnly) setEditingContract(true); }}`, vira `onClick={onEditContract}`.

- [ ] **Step 3: Ligar o componente no `LeadProfileView.jsx`**

Depois de recortar os três blocos:

1. Logo depois de `import { ZapSignupMarker } from '../components/profile/ZapSignupMarker.jsx';`, acrescentar `import { ContractsTab } from '../components/profile/contracts/ContractsTab.jsx';`.
2. Trocar `import { contractDiscountOf, deriveLeadContractStatus, hasLiveContract, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';` por `import { hasLiveContract } from '../lib/contracts.js';`.
3. Apagar a linha `import { SEAM_KIND, computeSeam, contractVigencia, daysBetween, missedCheckpointsLabel, vigenciaRefDate } from '../lib/renewal.js';` e o import de três linhas de `'../lib/contractHistory.js'`.
4. Na linha do `lucide-react`, tirar `LogIn, `, `PauseCircle, ` e `PlayCircle, ` (os outros ícones continuam em uso na view). `getSafeDateOrNull` continua importado: o `leadContracts` usa.
5. Logo depois de `openContractAction`, acrescentar:

```js
  // Corrigir o contrato vigente (ContractEditModal). A trava de leitura fica
  // aqui, como nas outras ações da aba.
  const openContractEdit = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setEditingContract(true);
  };
```

6. O `<TabsContent value="contratos" className="pt-2">` passa a ter só isto dentro:

```jsx
          <ContractsTab
            lead={lead}
            leadContracts={leadContracts}
            currentContract={currentContract}
            firstName={firstName}
            isReadOnly={isReadOnly}
            loading={loading}
            contractThresholdDays={contractThresholdDays}
            renewalCheckpoints={renewalCheckpoints}
            onEnroll={handleWin}
            onRenew={handleRenew}
            onContractAction={openContractAction}
            onEditContract={openContractEdit}
          />
```

- [ ] **Step 4: Lint, testes de render e build**

Run: `npx eslint src/views/LeadProfileView.jsx src/components/profile/contracts/ContractsTab.jsx && npx vitest run src/lib/__tests__/profileContractActions.test.js src/lib/__tests__/profileTimeline.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/overscrollGuard.test.js && npm run build`
Expected: lint sem erro (import não usado é erro aqui, então a lista de imports precisa ficar exata), os testes PASS sem nenhuma mudança neles, build ok.

- [ ] **Step 5: Commit**

```bash
git add src/views/LeadProfileView.jsx src/components/profile/contracts/ContractsTab.jsx
git commit -m "refactor: aba Contratos sai do LeadProfileView para um componente próprio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Peças compartilhadas e a linha do tempo (`ContractTimeline.jsx`)

**Files:**
- Create: `src/components/profile/contracts/tone.js`, `src/components/profile/contracts/shared.jsx`, `src/components/profile/contracts/ContractTimeline.jsx`
- Test: `src/lib/__tests__/contractsTabComponents.test.js` (novo)

As constantes (tons, rótulos, classes de botão) ficam num `.js` e os componentes num `.jsx`, para a regra `react-refresh/only-export-components` do lint não reclamar de arquivo que exporta os dois.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/contractsTabComponents.test.js`:

```js
// As peças da aba Contratos renderizadas sozinhas, em node (renderToString),
// com a geometria e os fatos vindos das funções puras de lib/contractsTab.js.
// Nenhuma delas tem link nem lê contexto, então não precisam de Router.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ContractTimeline, HATCH_VIOLET } from '../../components/profile/contracts/ContractTimeline.jsx';
import { contractTimelineOf } from '../contractsTab.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const HOJE = new Date(2026, 8, 30, 10, 0);
const K = (id, extra) => ({
  id, leadId: 'l1', planName: `Plano ${id}`, value: 1200, listValue: 1200, durationMonths: 12, status: 'ativo', consultantName: 'Ana', ...extra
});
const trimestral = K('t1', {
  planName: 'Trimestral', value: 447, listValue: 447, durationMonths: 3, status: 'cancelado',
  startsAt: D(2024, 5, 6), endsAt: D(2024, 8, 6), cancelledAt: D(2024, 6, 22), cancelReason: 'Financeiro', createdAt: D(2024, 5, 6)
});
const start24 = K('s1', {
  planName: 'Start', value: 1188, listValue: 1188, startsAt: D(2024, 9, 20), endsAt: D(2025, 10, 10), createdAt: D(2024, 9, 20),
  pausedDaysTotal: 20, resumedAt: D(2025, 1, 25), pauseHistory: [{ pausedAt: D(2025, 1, 5), resumedAt: D(2025, 1, 25) }]
});
const emUso = K('k1', {
  planName: 'Start', value: 1308, listValue: 1428, discountReason: 'Fidelidade', renewedFromId: 's1',
  startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9)
});
const proximo = K('k2', {
  planName: 'Flow', value: 1788, listValue: 1788, renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28)
});

describe('ContractTimeline', () => {
  it('desenha os segmentos com title, a hachura do próximo, a pausa, os marcos e o hoje', () => {
    const timeline = contractTimelineOf({ contracts: [trimestral, start24, emUso, proximo], heroId: 'k1', nextId: 'k2', now: HOJE, checkpoints: [90, 60, 30] });
    const html = renderToString(createElement(ContractTimeline, { timeline }));
    expect(html).toContain('>Vigência<');
    expect(html).toContain('title="Trimestral · cancelado em 22/06/2024"');
    expect(html).toContain('title="Start · 20/09/2024 a 10/10/2025"');
    expect(html).toContain('title="Start · em uso até 11/10/2026"');
    expect(html).toContain('title="Flow · começa em 12/10/2026"');
    expect(html).toContain('title="Trancado de 05/01/2025 a 25/01/2025"');
    expect(html).toContain('title="Marco de 30 dias · 11/09/2026 · passou sem contato"');
    expect(html).toContain('>hoje<');
    expect(html).toContain('>2026<');
    expect(html).toContain(`background-image:${HATCH_VIOLET}`);
    // O em uso encosta nos dois vizinhos: sem canto arredondado nas pontas.
    expect(html).toMatch(/class="absolute top-0 h-2\.5 bg-emerald-500" style="left:[\d.]+%;width:[\d.]+%"/);
    // O cancelado, solto, tem os dois cantos.
    expect(html).toMatch(/class="absolute top-0 h-2\.5 bg-rose-400 rounded-l-full rounded-r-full"/);
  });

  it('sem linha do tempo, não desenha nada', () => {
    expect(renderToString(createElement(ContractTimeline, { timeline: null }))).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractsTabComponents.test.js`
Expected: FAIL. O módulo `ContractTimeline.jsx` não existe.

- [ ] **Step 3: Criar `src/components/profile/contracts/tone.js`**

```js
// Constantes que a aba Contratos divide entre o card, a faixa do próximo, a
// tabela do Histórico e a linha do tempo. Só valores: os componentes ficam em
// shared.jsx, para o lint de react-refresh não reclamar de arquivo misto.
import { CONTRACT_STATUS } from '../../../lib/contracts.js';
import { CONTRACT_ORIGIN, HISTORY_STATUS } from '../../../lib/contractHistory.js';

// Tom do bloco de contagem, do selo e do preenchimento: a situação do contrato
// manda na cor da aba inteira.
export const CONTRACT_TONE = {
  [CONTRACT_STATUS.AGENDADO]: { block: 'bg-violet-500/10 dark:bg-violet-500/15', fg: 'text-violet-700 dark:text-violet-300', fill: 'bg-violet-500' },
  [CONTRACT_STATUS.TRANCADO]: { block: 'bg-yellow-500/15', fg: 'text-yellow-800 dark:text-yellow-300', fill: 'bg-yellow-500' },
  [CONTRACT_STATUS.ATIVO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [CONTRACT_STATUS.A_VENCER]: { block: 'bg-amber-500/12 dark:bg-amber-500/16', fg: 'text-amber-700 dark:text-amber-400', fill: 'bg-amber-500' },
  [CONTRACT_STATUS.VENCIDO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' },
  [CONTRACT_STATUS.CANCELADO]: { block: 'bg-rose-500/10 dark:bg-rose-500/15', fg: 'text-rose-700 dark:text-rose-400', fill: 'bg-rose-500' },
  // Selos do Histórico (lib/contractHistory.js).
  [HISTORY_STATUS.EM_USO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [HISTORY_STATUS.RENOVADO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' }
};

// Nome da origem, para o title e o leitor de tela do ícone.
export const ORIGIN_LABEL = {
  [CONTRACT_ORIGIN.RENOVACAO]: 'Renovação',
  [CONTRACT_ORIGIN.UPGRADE]: 'Upgrade',
  [CONTRACT_ORIGIN.RETORNO]: 'Retorno',
  [CONTRACT_ORIGIN.PRIMEIRA]: 'Primeira matrícula'
};

// Botões pequenos do card e da faixa do próximo (o mockup chama de lnk e
// lnk-danger), e o traço entre eles.
export const LINK_BTN = 'h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition disabled:opacity-50';
export const LINK_BTN_DANGER = 'h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 whitespace-nowrap transition disabled:opacity-50';
export const DIVIDER = 'w-px h-[18px] flex-none bg-slate-100 dark:bg-white/[0.06]';
```

- [ ] **Step 4: Criar `src/components/profile/contracts/shared.jsx`**

```jsx
// Componentes pequenos que a aba Contratos divide entre o card, a faixa do
// próximo e a tabela do Histórico.
import { GraduationCap, LogIn, RefreshCw, TrendingUp } from 'lucide-react';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../../../lib/contracts.js';
import { CONTRACT_ORIGIN, HISTORY_STATUS_LABEL } from '../../../lib/contractHistory.js';
import { cn } from '../../../lib/utils.js';
import { CONTRACT_TONE } from './tone.js';

// Rótulo em versalete das células. Sempre no tom `muted`: a 9.5px ele faz
// trabalho estrutural, é o que faz a faixa ler como células.
export const CapsLabel = ({ children }) => (
  <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 whitespace-nowrap">
    {children}
  </div>
);

// Selo de situação: o status do contrato ou o selo do Histórico (Em uso,
// Renovado), no tom da situação.
export function StatusChip({ status, className }) {
  const tone = CONTRACT_TONE[status] || CONTRACT_TONE[CONTRACT_STATUS.VENCIDO];
  return (
    <span className={cn('inline-flex items-center h-5 px-2 rounded-md text-[10px] font-bold uppercase tracking-[.05em] whitespace-nowrap', tone.block, tone.fg, className)}>
      {CONTRACT_STATUS_LABEL[status] || HISTORY_STATUS_LABEL[status]}
    </span>
  );
}

// Ícone da origem do contrato.
export function OriginIcon({ kind, size = 14 }) {
  if (kind === CONTRACT_ORIGIN.RETORNO) return <LogIn size={size} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.UPGRADE) return <TrendingUp size={size} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) return <RefreshCw size={size} aria-hidden="true" />;
  return <GraduationCap size={size} aria-hidden="true" />;
}
```

- [ ] **Step 5: Criar `src/components/profile/contracts/ContractTimeline.jsx`**

```jsx
// A linha do tempo da aba Contratos: todos os contratos do cliente num eixo
// só. Verde é o contrato em uso, roxo hachurado é o próximo, cinza é o
// encerrado e vermelho é o cancelado, até o cancelamento. Os trancamentos
// ficam em amarelo por cima, os marcos de renovação da academia viram
// tracinhos no contrato em uso, e há marcas de ano e o marcador de hoje. A
// geometria vem pronta de contractTimelineOf (lib/contractsTab.js); aqui só
// há tela. Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { cn } from '../../../lib/utils.js';

// A hachura roxa do próximo contrato, como no mockup. Vai como estilo porque
// é um gradiente repetido, que não existe na paleta.
export const HATCH_VIOLET = 'repeating-linear-gradient(135deg, rgba(139,92,246,.55) 0 3px, rgba(139,92,246,.18) 3px 7px)';

const SEGMENT_CLASS = {
  em_uso: 'bg-emerald-500',
  proximo: '',
  encerrado: 'bg-slate-300 dark:bg-slate-600',
  cancelado: 'bg-rose-400'
};

const LEGEND = [
  { label: 'em uso', className: 'bg-emerald-500' },
  { label: 'próximo', className: null },
  { label: 'encerrado', className: 'bg-slate-300 dark:bg-slate-600' },
  { label: 'cancelado', className: 'bg-rose-400' },
  { label: 'trancado', className: 'bg-yellow-400' }
];

// Altura de cada trilha, em px. Contratos que se cruzam ganham uma segunda.
const LANE_HEIGHT = 16;

export function ContractTimeline({ timeline }) {
  if (!timeline) return null;
  const { years, lanes, heroLane, marks, todayPct } = timeline;
  const tracksHeight = 9 + lanes.length * LANE_HEIGHT;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card px-[22px] pt-4 pb-5">
      <div className="flex items-center gap-4 flex-wrap">
        <h3 className="text-[14.5px] font-semibold tracking-tight">Vigência</h3>
        <div className="flex items-center gap-3.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
          {LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className={cn('w-3.5 h-1.5 rounded-full', item.className)}
                style={item.className ? undefined : { backgroundImage: HATCH_VIOLET }}
              ></span>
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {/* 21px a mais embaixo, para os anos. */}
      <div className="relative mt-7" style={{ height: tracksHeight + 21 }}>
        {years.map((y) => (
          <span key={y.year} className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-white/[0.06]" style={{ left: `${y.pct}%` }}></span>
        ))}
        {years.map((y) => (
          <span key={`ano-${y.year}`} className="num absolute bottom-0 text-[10.5px] text-slate-400 dark:text-slate-500 pl-1.5" style={{ left: `${y.pct}%` }}>
            {y.year}
          </span>
        ))}
        {lanes.map((lane, i) => (
          <div key={i} className="absolute left-0 right-0 h-2.5" style={{ top: 9 + i * LANE_HEIGHT }}>
            <span className="absolute inset-0 rounded-full bg-slate-100 dark:bg-white/[0.06]"></span>
            {lane.map((s) => (
              <span
                key={s.id}
                title={s.title}
                className={cn('absolute top-0 h-2.5', SEGMENT_CLASS[s.kind], !s.joinsPrev && 'rounded-l-full', !s.joinsNext && 'rounded-r-full')}
                style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%`, ...(s.kind === 'proximo' ? { backgroundImage: HATCH_VIOLET } : {}) }}
              ></span>
            ))}
            {/* As pausas vêm depois dos segmentos, para ficarem por cima. */}
            {lane.flatMap((s) => s.pauses.map((p, j) => (
              <span key={`${s.id}-pausa-${j}`} title={p.title} className="absolute top-0 h-2.5 bg-yellow-400" style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}></span>
            )))}
            {i === heroLane && marks.map((m) => (
              <span
                key={m.days}
                title={m.title}
                className={cn('absolute -top-[3px] w-0.5 h-4 -translate-x-1/2 rounded-[1px]', m.active ? 'bg-amber-500' : 'bg-slate-400 dark:bg-white/40')}
                style={{ left: `${m.pct}%` }}
              ></span>
            ))}
          </div>
        ))}
        <span className="absolute w-[3px] -translate-x-1/2 rounded-sm bg-slate-900 dark:bg-white" style={{ left: `${todayPct}%`, top: 3, height: tracksHeight - 3 }}></span>
        <span className="num absolute -top-4 -translate-x-1/2 text-[10.5px] font-semibold text-slate-900 dark:text-white" style={{ left: `${todayPct}%` }}>hoje</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractsTabComponents.test.js && npx eslint src/components/profile/contracts`
Expected: PASS e lint sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/components/profile/contracts/tone.js src/components/profile/contracts/shared.jsx src/components/profile/contracts/ContractTimeline.jsx src/lib/__tests__/contractsTabComponents.test.js
git commit -m "feat: linha do tempo dos contratos e peças compartilhadas da aba

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: O Histórico em tabela (`ContractHistoryTable.jsx`)

**Files:**
- Create: `src/components/profile/contracts/ContractHistoryTable.jsx`
- Test: `src/lib/__tests__/contractsTabComponents.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/lib/__tests__/contractsTabComponents.test.js`, trocar a linha `import { contractTimelineOf } from '../contractsTab.js';` por `import { contractFactsOf, contractTimelineOf } from '../contractsTab.js';`, acrescentar logo abaixo dela `import { ContractHistoryTable } from '../../components/profile/contracts/ContractHistoryTable.jsx';`, e no fim do arquivo:

```js
describe('ContractHistoryTable', () => {
  const todos = [trimestral, start24, emUso, proximo];

  it('uma linha por contrato, com origem, datas, motivo, trancamento, valores e situação', () => {
    const rows = [start24, trimestral].map((c) => contractFactsOf(c, todos, HOJE, 30));
    const html = renderToString(createElement(ContractHistoryTable, { rows, firstName: 'Ana', hasContract: true }));
    expect(html).toContain('>Histórico<');
    expect(html).toContain('>2 anteriores<');
    ['>Contrato<', '>Início<', '>Fim previsto<', '>Fim de fato<', '>Trancado<', '>Valor<', '>Média/mês<', '>Situação<'].forEach((th) => expect(html).toContain(th));
    expect(html).toContain('retorno, 89 dias depois');
    expect(html).toContain('>20/09/2024<');
    expect(html).toContain('>20/09/2025<');
    expect(html).toContain('>10/10/2025<');
    expect(html).toContain('20 dias depois, pelo trancamento');
    expect(html).toContain('>20 dias<');
    expect(html).toContain('>1 vez<');
    expect(html).toContain('R$ 1.188,00');
    expect(html).toContain('R$ 99,00');
    expect(html).toContain('>Renovado<');
    expect(html).toContain('primeira matrícula');
    expect(html).toContain('cancelado · Financeiro');
    expect(html).toContain('>Nunca<');
    expect(html).toContain('>Cancelado<');
    expect(html).toContain('overflow-x-auto overscroll-x-contain');
    // Fechada, a linha não mostra os detalhes.
    expect(html).not.toContain('>Fechado por<');
  });

  it('a linha aberta mostra desconto, quem fechou, código, cancelamento e trancamentos', () => {
    const cancelado = { ...emUso, status: 'cancelado', cancelledAt: D(2026, 9, 25), cancelReason: 'Financeiro', cancelNote: 'Vai voltar em janeiro' };
    const rows = [contractFactsOf(cancelado, [start24, cancelado], HOJE, 30)];
    const html = renderToString(createElement(ContractHistoryTable, { rows, firstName: 'Ana', hasContract: false, defaultOpenId: 'k1' }));
    expect(html).toContain('>Desconto<');
    expect(html).toContain('−R$ 120,00');
    expect(html).toContain('fidelidade');
    expect(html).toContain('tabela R$ 1.428,00');
    expect(html).toContain('>Fechado por<');
    expect(html).toContain('>Ana<');
    expect(html).toContain('em 09/10/2025');
    expect(html).toContain('>Código<');
    expect(html).toContain('#K1');
    expect(html).toContain('12 meses');
    expect(html).toContain('>Cancelamento<');
    expect(html).toContain('25/09/2026');
    expect(html).toContain('Vai voltar em janeiro');
    expect(html).toContain('>Trancamentos<');
    expect(html).toContain('Nunca trancado');
    expect(html).toContain('aria-expanded="true"');
  });

  it('trancado quando a renovação começou: renovado, com a nota na linha aberta e os períodos', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20), pausedDaysTotal: 5, pauseHistory: [{ pausedAt: D(2026, 3, 1), resumedAt: D(2026, 3, 6) }] };
    const rows = [contractFactsOf(trancado, [trancado, proximo], D(2026, 10, 15), 30)];
    const html = renderToString(createElement(ContractHistoryTable, { rows, firstName: 'Ana', hasContract: true, defaultOpenId: 'k1' }));
    expect(html).toContain('>Renovado<');
    expect(html).toContain('Estava trancado quando a renovação começou.');
    expect(html).toContain('01/03/2026 a 06/03/2026');
    expect(html).toContain('desde 20/09/2026');
    expect(html).toContain('>2 vezes<');
  });

  it('sem contrato anterior', () => {
    const comContrato = renderToString(createElement(ContractHistoryTable, { rows: [], firstName: 'Ana', hasContract: true }));
    expect(comContrato).toContain('Nenhum contrato anterior');
    expect(comContrato).toContain('Este é o primeiro contrato de Ana.');
    const semContrato = renderToString(createElement(ContractHistoryTable, { rows: [], firstName: 'Ana', hasContract: false }));
    expect(semContrato).toContain('O histórico de planos aparecerá aqui.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contractsTabComponents.test.js`
Expected: FAIL. O módulo `ContractHistoryTable.jsx` não existe.

- [ ] **Step 3: Criar `src/components/profile/contracts/ContractHistoryTable.jsx`**

```jsx
// O Histórico da aba Contratos: uma tabela com os contratos que não são o
// destaque nem o próximo, do mais novo para o mais antigo, e a linha que abre
// no clique com o resto dos detalhes. Sem botões nas linhas (decisão do
// Johnny, 30/09/2026). Os fatos vêm de contractFactsOf (lib/contractsTab.js).
// `defaultOpenId` existe para o teste de render, que não clica.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmtBRL } from '../../../lib/format.js';
import { originTextOf } from '../../../lib/contractsTab.js';
import { CONTRACT_STATUS } from '../../../lib/contracts.js';
import { cn } from '../../../lib/utils.js';
import { CONTRACT_TONE, ORIGIN_LABEL } from './tone.js';
import { OriginIcon, StatusChip } from './shared.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const TH = 'font-bold px-3 py-2.5';
const MUTED = 'text-[11.5px] text-slate-500 dark:text-slate-400';

// Um período de trancamento: "05/01/2025 a 25/01/2025", "desde 20/09/2026",
// com a marca da pausa que veio da importação ou refeita pelo total de dias.
const pauseText = (p) => `${p.to ? `${fmtDia(p.from)} a ${fmtDia(p.to)}` : `desde ${fmtDia(p.from)}`}${
  p.fromImport ? ' (da importação)' : p.reconstructed ? ' (refeito pelo total de dias)' : ''
}`;

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</dt>
      <dd className="mt-1 text-[12.5px] text-slate-700 dark:text-slate-200">{children}</dd>
    </div>
  );
}

function HistoryRow({ facts: f, open, onToggle }) {
  const tone = CONTRACT_TONE[f.status] || CONTRACT_TONE[CONTRACT_STATUS.VENCIDO];
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'border-t border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition',
          open && 'bg-slate-50 dark:bg-white/[0.03]'
        )}
      >
        <td className="pl-[22px] pr-3 py-3">
          <div className="flex items-center gap-2.5">
            <span className={cn('size-7 flex-none rounded-full grid place-items-center', tone.block, tone.fg)} title={ORIGIN_LABEL[f.origin.kind]}>
              <OriginIcon kind={f.origin.kind} size={12} />
              <span className="sr-only">{ORIGIN_LABEL[f.origin.kind]}</span>
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{f.planName || '—'}</div>
              <div className={MUTED}>{originTextOf(f.origin)}</div>
            </div>
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? 'Fechar os detalhes do contrato' : 'Abrir os detalhes do contrato'}
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="ml-1 size-6 flex-none grid place-items-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition"
            >
              <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </button>
          </div>
        </td>
        <td className="num px-3 py-3">{fmtDia(f.start)}</td>
        <td className="num px-3 py-3">{fmtDia(f.plannedEnd)}</td>
        <td className="px-3 py-3">
          <div className="num">{fmtDia(f.actualEnd)}</div>
          {f.endReason.text && <div className={MUTED}>{f.endReason.text}</div>}
        </td>
        <td className="px-3 py-3">
          {f.pauseCount ? (
            <>
              <div className="num">{dias(f.pausedDays)}</div>
              <div className={MUTED}>{f.pauseCount === 1 ? '1 vez' : `${f.pauseCount} vezes`}</div>
            </>
          ) : <span className="text-slate-400 dark:text-slate-500">Nunca</span>}
        </td>
        <td className="num px-3 py-3 text-right font-semibold">{f.value != null ? fmtBRL(f.value) : '—'}</td>
        <td className="num px-3 py-3 text-right">{f.monthly != null ? fmtBRL(f.monthly) : '—'}</td>
        <td className="pl-3 pr-[22px] py-3 text-right"><StatusChip status={f.status} /></td>
      </tr>
      {open && (
        <tr className="bg-slate-50 dark:bg-white/[0.03]">
          <td colSpan={8} className="px-[22px] pb-4 pt-1">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
              <Detail label="Desconto">
                {f.discount > 0.005 ? (
                  <>
                    <span className="num">−{fmtBRL(f.discount)}</span>{f.discountReason ? ` · ${f.discountReason.toLowerCase()}` : ''}
                    {f.listValue > 0 && <div className={cn('num', MUTED)}>tabela {fmtBRL(f.listValue)}</div>}
                  </>
                ) : 'Sem desconto'}
              </Detail>
              <Detail label="Fechado por">
                {f.closedBy ? <span className="font-semibold">{f.closedBy}</span> : '—'}
                {f.closedAt && <div className={cn('num', MUTED)}>em {fmtDia(f.closedAt)}</div>}
              </Detail>
              <Detail label="Código">
                <span className="num">#{f.shortId}</span>{f.months ? ` · ${f.months === 1 ? '1 mês' : `${f.months} meses`}` : ''}
              </Detail>
              {f.cancelledAt && (
                <Detail label="Cancelamento">
                  <span className="num">{fmtDia(f.cancelledAt)}</span>{f.cancelReason ? ` · ${f.cancelReason}` : ''}
                  {f.cancelNote && <div className={MUTED}>{f.cancelNote}</div>}
                </Detail>
              )}
              <Detail label="Trancamentos">
                {f.pauses.length ? f.pauses.map((p, i) => <div key={i} className="num">{pauseText(p)}</div>) : 'Nunca trancado'}
                {f.lockedAtRenewalStart && <div className={MUTED}>Estava trancado quando a renovação começou.</div>}
              </Detail>
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

export function ContractHistoryTable({ rows, firstName, hasContract, defaultOpenId = null }) {
  const [openId, setOpenId] = useState(defaultOpenId);
  const count = rows.length;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-[22px] py-4 border-b border-slate-100 dark:border-white/[0.06]">
        <h3 className="text-[14.5px] font-semibold tracking-tight">Histórico</h3>
        <span className="num text-[10.5px] font-bold px-[7px] py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
          {count === 1 ? '1 anterior' : `${count} anteriores`}
        </span>
        <div className="flex-1"></div>
        <span className={cn(MUTED, 'hidden sm:inline')}>A linha abre o desconto, quem fechou e o motivo</span>
      </div>
      {count === 0 ? (
        <div className="py-7 text-center">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Nenhum contrato anterior</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {hasContract ? `Este é o primeiro contrato de ${firstName}.` : 'O histórico de planos aparecerá aqui.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-400 dark:text-slate-500">
                <th className="font-bold pl-[22px] pr-3 py-2.5">Contrato</th>
                <th className={TH}>Início</th>
                <th className={TH}>Fim previsto</th>
                <th className={TH}>Fim de fato</th>
                <th className={TH}>Trancado</th>
                <th className={cn(TH, 'text-right')}>Valor</th>
                <th className={cn(TH, 'text-right')}>Média/mês</th>
                <th className="font-bold pl-3 pr-[22px] py-2.5 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {rows.map((f) => (
                <HistoryRow key={f.id} facts={f} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contractsTabComponents.test.js src/lib/__tests__/overscrollGuard.test.js && npx eslint src/components/profile/contracts`
Expected: PASS e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/contracts/ContractHistoryTable.jsx src/lib/__tests__/contractsTabComponents.test.js
git commit -m "feat: Histórico da aba Contratos em tabela, com a linha que abre os detalhes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: O modal do Ativar agora (`ContractActivateModal.jsx`)

**Files:**
- Create: `src/modals/ContractActivateModal.jsx`

O modal entra antes da tela que o abre (Task 11) para cada commit passar no lint: o botão "Ativar agora" da tela importa o modal. Sem teste de render, como os outros três modais de contrato: tudo o que ele decide vem de `buildContractActivate` (Task 4) e a gravação é o `commitContractPatch` (Task 3), os dois testados. A conferência manual está na Task 14.

- [ ] **Step 1: Criar `src/modals/ContractActivateModal.jsx`**

```jsx
import { useState } from 'react';
import { Play } from 'lucide-react';
import { buildContractActivate } from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Ativar agora: o contrato que ainda não começou passa a começar hoje, com a
// duração vendida (buildContractActivate). Com o contrato em uso em vigor, ele
// passa a terminar ontem, e o modal mostra a data nova dele e os dias que se
// perdem. Vale para renovação marcada e para matrícula agendada.
//
// O que gravar vive em lib/contracts.js; o como, em lib/contractsWrites.js.
// Segue o molde do ContractEditModal: o contrato renovado sai da coleção
// assinada (contratos), e o que a tela mostra congela ao confirmar (`sent`),
// porque a escrita local chega à ficha antes de o servidor responder e o
// contrato passaria a "já começou" ao lado de "Ativando...".
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html

const fmtDate = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

function ContractActivateModal({ lead, appUser, db, contract, onClose, onDone }) {
  const toast = useToast();
  const { contratos } = useGeneralConfig();
  const previous = contract?.renewedFromId
    ? (contratos || []).find((c) => c.id === contract.renewedFromId) || null
    : null;
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);
  const built = sent || buildContractActivate({ contract, previous, now: new Date() });
  const inicio = getSafeDateOrNull(built.contractPatch.startsAt);
  const fim = getSafeDateOrNull(built.contractPatch.endsAt);
  const anteriorFim = getSafeDateOrNull(built.previousPatch?.endsAt);
  const encurta = Boolean(anteriorFim && built.previousPatch?.shortenedById);
  const plano = contract?.planName || 'Plano';
  const planoAnterior = previous?.planName || 'O contrato em uso';

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    setSubmitting(true);
    setSent(built);
    try {
      // O fim novo do contrato em uso vai no mesmo batch.
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract.id,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        linkedContractId: built.previousPatch ? previous.id : null,
        linkedContractPatch: built.previousPatch || null
      });
      toast.success('Contrato ativado.');
      onDone && onDone();
    } catch (e) {
      console.error('Erro ao ativar o contrato:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
      setSent(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[210] max-w-[460px] gap-0 p-0 block overflow-hidden rounded-2xl border-border"
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="size-9 flex-none rounded-xl grid place-items-center bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <Play size={16} />
            </span>
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Ativar agora</DialogTitle>
          </div>
          <p className="num text-[12.5px] text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {lead?.name || 'Cliente'} · {plano} · marcado para {fmtDate(built.scheduledFor)}
          </p>

          <div className="mt-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] divide-y divide-slate-100 dark:divide-white/[0.06]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[12.5px] text-slate-600 dark:text-slate-300">{plano} passa a valer</span>
              <span className="num text-[13px] font-semibold">{fmtDate(inicio)} → {fmtDate(fim)}</span>
            </div>
            {encurta && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[12.5px] text-slate-600 dark:text-slate-300">{planoAnterior} termina em</span>
                <span className="num text-[13px] font-semibold">{fmtDate(anteriorFim)}</span>
              </div>
            )}
          </div>

          {encurta ? (
            <p className="mt-3 px-3 py-2.5 rounded-[11px] border border-rose-300/60 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/10 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
              O contrato em uso termina {built.daysLost} {built.daysLost === 1 ? 'dia' : 'dias'} antes do previsto, e os dias já pagos se perdem. O valor e a duração do plano novo não mudam.
            </p>
          ) : (
            <p className="mt-3 px-3 py-2.5 rounded-[11px] bg-slate-50 dark:bg-white/[0.03] text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
              O valor e a duração do plano não mudam. Só o início vem para hoje, e o fim anda junto.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            className="h-9 px-3.5 rounded-[10px] text-[13px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06] transition disabled:opacity-50"
          >Voltar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50"
          >
            <Play size={13} />
            {submitting ? 'Ativando...' : 'Ativar agora'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractActivateModal };
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/modals/ContractActivateModal.jsx`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/modals/ContractActivateModal.jsx
git commit -m "feat: modal do Ativar agora

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Card do contrato em uso, faixa do próximo, a aba nova e as ações por contrato

**Files:**
- Create: `src/components/profile/contracts/ContractHeroCard.jsx`, `src/components/profile/contracts/NextContractStrip.jsx`
- Modify: `src/components/profile/contracts/ContractsTab.jsx` (reescrito), `src/views/LeadProfileView.jsx`
- Test: `src/lib/__tests__/profileContractsTab.test.js` (novo); `src/lib/__tests__/profileContractActions.test.js` sai (descrevia a tela velha)

- [ ] **Step 1: Escrever o teste de render das cinco situações**

Apagar o teste antigo: `git rm src/lib/__tests__/profileContractActions.test.js`. Criar `src/lib/__tests__/profileContractsTab.test.js`:

```js
// A aba Contratos da ficha nas situações da tabela "Botões em cada situação"
// da spec, renderizada pelo LeadProfileView inteiro (renderToString). Hoje é
// 30/09/2026, o Start está em uso até 11/10 e o Flow começa em 12/10, como no
// mockup aprovado. O LeadProfileView lê window.location.origin no render
// (link de indicação), por isso o window falso, como em profileTimeline.test.js.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const D = (y, m, d) => new Date(y, m - 1, d);
const ADMIN = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
// Sem authUid não pode editar (canEditLead): a aba não mostra botão.
const SEM_VINCULO = { id: 'u2', name: 'Visita', role: 'consultor', tenantId: 'acad' };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

// O Start, de 11/10/2025 a 11/10/2026, em uso hoje.
const start = {
  id: 'k1', leadId: 'l1', planId: 'p1', planName: 'Start', value: 1200, listValue: 1200, durationMonths: 12,
  status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 11), consultantName: 'Ana'
};
// A renovação emendada, de 12/10/2026 a 12/10/2027.
const flow = {
  id: 'k2', leadId: 'l1', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12,
  status: 'ativo', renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28), consultantName: 'Ana'
};
// A mesma renovação, depois de um intervalo de 8 dias.
const flowDepois = { ...flow, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
const trancado = { ...start, status: 'trancado', pausedAt: D(2026, 9, 20), pauseReason: 'Viagem' };
const cancelado = { ...start, status: 'cancelado', cancelledAt: D(2026, 9, 25), cancelReason: 'Financeiro' };

// A ficha com o contrato `atual` no resumo do lead, aberta na aba Contratos.
// Devolve o painel em três pedaços: a linha do tempo mais o card (`hero`), a
// faixa do próximo (`strip`, vazia quando não há) e o Histórico.
const aba = (atual, contratos, appUser = ADMIN) => {
  const lead = {
    id: 'l1', name: 'Ana Lima', whatsapp: '11999990000', status: 'Venda', lifecycleStage: 'cliente', isConverted: true,
    clienteSince: D(2025, 10, 11), createdAt: D(2025, 9, 1), consultantName: 'Ana',
    currentContractId: atual.id, currentPlanName: atual.planName, currentContractValue: atual.value,
    currentContractStartsAt: atual.startsAt, currentContractEndsAt: atual.endsAt,
    currentContractStatus: atual.status, currentContractSeamless: Boolean(atual.seamless)
  };
  const html = renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/ficha/l1/contratos'] },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(GeneralConfigContext.Provider, { value: { ...CONFIG, contratos } },
          createElement(LeadProfileView, {
            lead, tab: 'contratos', onTab: () => {}, onBack: () => {}, appUser,
            statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
          })))));
  const inicio = html.indexOf('role="tabpanel"');
  const historico = html.indexOf('>Histórico<');
  expect(inicio).toBeGreaterThan(-1);
  expect(historico).toBeGreaterThan(inicio);
  const painel = html.slice(inicio, historico);
  const faixa = painel.indexOf('border-l-violet-500');
  return {
    hero: faixa === -1 ? painel : painel.slice(0, faixa),
    strip: faixa === -1 ? '' : painel.slice(faixa),
    historico: html.slice(historico)
  };
};

describe('aba Contratos: os botões em cada situação', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('contrato em uso, sem próximo: Renovar contrato, Corrigir, Trancar e Cancelar', () => {
    const { hero, strip, historico } = aba(start, [start]);
    expect(hero).toContain('>Renovar contrato<');
    ['>Corrigir<', '>Trancar<', '>Cancelar<'].forEach((acao) => expect(hero).toContain(acao));
    expect(hero).not.toContain('Ativar agora');
    expect(hero).toContain('>Restam<');
    expect(hero).toContain('>A vencer<');
    expect(hero).toContain('>Vigência<');
    expect(strip).toBe('');
    expect(historico).toContain('Este é o primeiro contrato de Ana.');
  });

  it('contrato em uso trancado, sem próximo: Reativar contrato, Corrigir e Cancelar', () => {
    const { hero, strip } = aba(trancado, [trancado]);
    expect(hero).toContain('>Reativar contrato<');
    expect(hero).toContain('>Corrigir<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Trancar<');
    expect(hero).not.toContain('Renovar contrato');
    expect(hero).toContain('Trancado há');
    expect(strip).toBe('');
  });

  it('contrato em uso com próximo marcado: o card só tranca e cancela; a faixa ativa, corrige e cancela a renovação', () => {
    const { hero, strip, historico } = aba(flow, [start, flow]);
    expect(hero).toContain('>Trancar<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Corrigir<');
    expect(hero).not.toContain('Renovar contrato');
    expect(hero).not.toContain('Ativar agora');
    expect(hero).toContain('>Em uso<');
    expect(hero).toContain('Em uso · restam');
    expect(hero).toContain('>Start<');
    expect(strip).toContain('>Próximo<');
    expect(strip).toContain('>Flow<');
    expect(strip).toContain('Ativar agora');
    expect(strip).toContain('>Corrigir<');
    expect(strip).toContain('>Cancelar renovação<');
    expect(strip).toContain('>12/10/2026<');
    expect(strip).toContain('daqui a 12 dias');
    expect(strip).toContain('até 12/10/2027');
    expect(strip).toContain('R$ 1.788,00');
    expect(strip).toContain('R$ 149,00/mês');
    expect(strip).toContain('sem intervalo');
    // O contrato em uso não vai para o Histórico.
    expect(historico).toContain('Nenhum contrato anterior');
  });

  it('com intervalo até o próximo, a faixa diz os dias sem contrato; trancado, o card reativa', () => {
    expect(aba(flowDepois, [start, flowDepois]).strip).toContain('8 dias sem contrato antes');
    const { hero } = aba(flow, [trancado, flow]);
    expect(hero).toContain('>Reativar<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Trancar<');
    expect(hero).toContain('Trancado há');
  });

  it('contrato agendado sem nenhum em uso: Ativar agora, Corrigir e Cancelar, sem Trancar', () => {
    const { hero, strip, historico } = aba(flow, [cancelado, flow]);
    expect(hero).toContain('Ativar agora');
    expect(hero).toContain('>Corrigir<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Trancar<');
    expect(hero).not.toContain('Renovar contrato');
    expect(hero).toContain('Começa em');
    expect(hero).toContain('>Agendado<');
    expect(strip).toBe('');
    expect(historico).toContain('>Cancelado<');
  });

  it('vencido ou cancelado, sem próximo: Nova matrícula', () => {
    const vencido = { ...start, endsAt: D(2026, 9, 10) };
    expect(aba(vencido, [vencido]).hero).toContain('>Nova matrícula<');
    const { hero, strip } = aba(cancelado, [cancelado]);
    expect(hero).toContain('>Nova matrícula<');
    expect(hero).toContain('>Cancelado<');
    expect(strip).toBe('');
  });

  it('quem não pode editar não vê botão nenhum', () => {
    const { hero, strip } = aba(flow, [start, flow], SEM_VINCULO);
    expect(hero).not.toContain('>Trancar<');
    expect(hero).not.toContain('>Cancelar<');
    expect(strip).not.toContain('Ativar agora');
    expect(strip).not.toContain('>Corrigir<');
    expect(strip).toContain('>Próximo<');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/profileContractsTab.test.js`
Expected: FAIL. A tela velha não tem `>Vigência<`, `>Em uso<` nem `border-l-violet-500`.

- [ ] **Step 3: Criar `src/components/profile/contracts/ContractHeroCard.jsx`**

```jsx
// O card do contrato em destaque na aba Contratos: a contagem, o plano, o
// valor, a origem, quem fechou e os botões da situação (heroActionsOf, em
// lib/contractsTab.js). Com próximo contrato marcado, o selo diz "Em uso" e o
// card só tranca (ou reativa) e cancela; agendado sem contrato em uso, ele
// ativa agora. O aviso dos marcos que passaram sem contato fica no rodapé e
// some com próximo, porque o cliente já renovou. A régua de vigência que
// ficava no rodapé virou a linha do tempo, acima do card.
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { Fragment } from 'react';
import { PauseCircle, Play, PlayCircle, RefreshCw } from 'lucide-react';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../../../lib/contracts.js';
import { CONTRACT_ORIGIN, HISTORY_STATUS } from '../../../lib/contractHistory.js';
import { gapText, shortContractId } from '../../../lib/contractsTab.js';
import { fmtBRL } from '../../../lib/format.js';
import { cn } from '../../../lib/utils.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Btn } from '../../ui/Btn.jsx';
import { CONTRACT_TONE, DIVIDER, LINK_BTN, LINK_BTN_DANGER } from './tone.js';
import { CapsLabel } from './shared.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

// De onde veio o contrato. Renovação só quando está ligada ao contrato
// anterior (renewedFromId). Contrato sem ligação é retorno, como no Gerencial.
function OriginCell({ origin }) {
  const kind = origin?.kind || CONTRACT_ORIGIN.PRIMEIRA;
  const prev = origin?.previous || null;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) {
    return (
      <>
        <CapsLabel>Renovado de</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate" title={prev?.planName || undefined}>{prev?.planName || '—'}</div>
        <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">
          {prev ? `#${shortContractId(prev.id)} · ` : ''}<span className="whitespace-nowrap">{origin.ordinal}ª renovação</span>
        </div>
      </>
    );
  }
  if (kind === CONTRACT_ORIGIN.RETORNO || kind === CONTRACT_ORIGIN.UPGRADE) {
    // Três linhas curtas: a célula é estreita, e numa linha só o intervalo sem
    // contrato ficava cortado. A data é o fim da cobertura anterior, a mesma de
    // onde o intervalo é medido.
    const coverageEnd = origin?.coverageEnd || null;
    const main = prev?.planName || (kind === CONTRACT_ORIGIN.UPGRADE ? 'pelo funil Upgrade' : '—');
    const endText = coverageEnd ? `até ${fmtDia(coverageEnd)}` : null;
    const gap = origin?.gapDays ? `${gapText(origin.gapDays)} sem contrato` : null;
    const detail = [endText, gap].filter(Boolean).join(' · ');
    return (
      <>
        <CapsLabel>{kind === CONTRACT_ORIGIN.UPGRADE ? 'Upgrade' : 'Retorno'}</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate" title={detail ? `${main} · ${detail}` : main}>{main}</div>
        {endText && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">{endText}</div>}
        {gap && <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{gap}</div>}
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

// Os botões pequenos, pelo nome que heroActionsOf devolve.
const ACTION = {
  corrigir: { label: 'Corrigir', danger: false },
  trancar: { label: 'Trancar', danger: false },
  reativar: { label: 'Reativar', danger: false },
  cancelar: { label: 'Cancelar', danger: true }
};

function ActionButton({ action, hero, loading, onEditContract, onContractAction, className }) {
  const cfg = ACTION[action];
  const onClick = action === 'corrigir' ? () => onEditContract(hero) : () => onContractAction(action, hero);
  return (
    <button type="button" onClick={onClick} disabled={loading} className={cn(cfg.danger ? LINK_BTN_DANGER : LINK_BTN, className)}>
      {cfg.label}
    </button>
  );
}

export function ContractHeroCard({
  lead, hero, status, hasNext, countdown, facts, missed, actions, isReadOnly, loading,
  onRenew, onEditContract, onContractAction, onActivate
}) {
  const tone = CONTRACT_TONE[status] || CONTRACT_TONE[CONTRACT_STATUS.ATIVO];
  const paused = status === CONTRACT_STATUS.TRANCADO;
  // Com próximo, o selo do plano diz "Em uso", em verde, seja qual for a
  // situação de hoje. Sem próximo, o selo é a situação (Ativo, A vencer...).
  const chipTone = hasNext ? CONTRACT_TONE[HISTORY_STATUS.EM_USO] : tone;
  const closedBy = facts.closedBy || lead.consultantName;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-stretch flex-wrap">
        {/* A contagem é o que importa */}
        <div className={cn('w-[186px] flex-none px-[22px] py-5', tone.block)}>
          <div className={cn('flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[.08em]', tone.fg)}>
            {paused && <PauseCircle size={11} aria-hidden="true" />}
            {countdown.label}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-.03em]', tone.fg)}>{countdown.days}</span>
            <span className={cn('text-[13px] font-semibold', tone.fg)}>{countdown.days === 1 ? 'dia' : 'dias'}</span>
          </div>
          <div className="num text-[11.5px] text-slate-600 dark:text-slate-300 mt-[7px]">{countdown.note}</div>
        </div>

        {/* Quatro células divididas por régua */}
        <div className="flex-1 min-w-0 flex items-stretch flex-wrap">
          <div className="flex-[1.2] min-w-[160px] px-[22px] py-5">
            <CapsLabel>Plano</CapsLabel>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="font-display text-[18px] font-bold tracking-tight">{facts.planName || 'Plano'}</span>
              <span className={cn('inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em]', chipTone.block, chipTone.fg)}>
                {hasNext ? 'Em uso' : CONTRACT_STATUS_LABEL[status]}
              </span>
            </div>
            <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
              #{facts.shortId}{facts.months ? ` · ${facts.months === 1 ? '1 mês' : `${facts.months} meses`}` : ''}
            </div>
          </div>

          <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
            <CapsLabel>Valor</CapsLabel>
            <div className="num font-display text-[18px] font-bold tracking-tight mt-1.5">{facts.value != null ? fmtBRL(facts.value) : '—'}</div>
            <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
              {facts.monthly != null ? `${fmtBRL(facts.monthly)}/mês` : '—'}
            </div>
            {/* Só o desconto e o motivo: a célula não comporta o valor de
                tabela junto sem truncar. Ele fica no title. */}
            {facts.discount > 0.005 && facts.listValue > 0 && (
              <div
                className="text-[11.5px] text-emerald-700 dark:text-emerald-400 mt-[3px] truncate"
                title={`Tabela ${fmtBRL(facts.listValue)} · desconto de ${fmtBRL(facts.discount)}`}
              >
                <span className="num">−{fmtBRL(facts.discount)}</span>
                {facts.discountReason ? ` · ${facts.discountReason.toLowerCase()}` : ' de desconto'}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
            <OriginCell origin={facts.origin} />
          </div>

          <div className="flex-1 min-w-[140px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
            <CapsLabel>Fechado por</CapsLabel>
            <div className="flex items-center gap-[7px] mt-[7px] min-w-0">
              {closedBy ? (
                <>
                  <Avatar name={closedBy} size={19} />
                  <span className="text-[13px] font-semibold truncate">{closedBy}</span>
                </>
              ) : <span className="text-[13px] text-slate-400 dark:text-slate-500">—</span>}
            </div>
            {facts.closedAt && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">em {fmtDia(facts.closedAt)}</div>}
          </div>
        </div>

        {/* As ações da situação. Com próximo, só os botões pequenos, em
            coluna, como no mockup. */}
        {!isReadOnly && (
          <div className="flex-none flex flex-col justify-center gap-2 px-[22px] py-[18px] border-l border-slate-100 dark:border-white/[0.06]">
            {actions.primary === 'renovar' && (
              <Btn kind="brand" icon={<RefreshCw size={14} />} onClick={onRenew} disabled={loading}>Renovar contrato</Btn>
            )}
            {actions.primary === 'reativar' && (
              <Btn kind="success" icon={<PlayCircle size={14} />} onClick={() => onContractAction('reativar', hero)} disabled={loading}>Reativar contrato</Btn>
            )}
            {actions.primary === 'ativar' && (
              <Btn kind="brand" icon={<Play size={13} />} onClick={() => onActivate(hero)} disabled={loading}>Ativar agora</Btn>
            )}
            <div className={cn('flex gap-0.5', hasNext ? 'flex-col items-stretch' : 'items-center')}>
              {actions.actions.map((action, i) => (
                <Fragment key={action}>
                  {i > 0 && !hasNext && <span className={DIVIDER}></span>}
                  <ActionButton
                    action={action}
                    hero={hero}
                    loading={loading}
                    onEditContract={onEditContract}
                    onContractAction={onContractAction}
                    className={hasNext ? 'text-left' : 'flex-1'}
                  />
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {missed && (
        <div className="flex items-center gap-2.5 px-[22px] py-[9px] border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{missed}</span>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Criar `src/components/profile/contracts/NextContractStrip.jsx`**

```jsx
// A faixa fina do próximo contrato: só quando existe um contrato que ainda não
// começou e outro em uso. Plano, quando começa, até quando, valor e média, o
// encaixe com o contrato em uso (joinTextOf) e os botões Ativar agora,
// Corrigir e Cancelar renovação. O último vira "Cancelar" quando a renovação
// não pode ser desfeita, porque o contrato renovado foi cancelado
// (isRenewalNotStarted, decidido pela aba).
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { Play } from 'lucide-react';
import { calendarDaysBetween, getSafeDateOrNull } from '../../../lib/dates.js';
import { fmtBRL } from '../../../lib/format.js';
import { Btn } from '../../ui/Btn.jsx';
import { LINK_BTN, LINK_BTN_DANGER } from './tone.js';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const NUM = 'num text-[12px] text-slate-600 dark:text-slate-300';
const STRONG = 'font-semibold text-slate-900 dark:text-white';

export function NextContractStrip({ next, facts, joinText, now, canUndo, isReadOnly, loading, onActivate, onEditContract, onContractAction }) {
  const start = getSafeDateOrNull(next.startsAt);
  const end = getSafeDateOrNull(next.endsAt);
  const daysToStart = start ? Math.max(0, calendarDaysBetween(now, start) || 0) : 0;
  return (
    <section className="rounded-2xl border border-border border-l-[3px] border-l-violet-500 bg-card shadow-card flex items-center gap-4 flex-wrap px-[22px] py-3.5">
      <div className="min-w-0 flex-1 flex items-center gap-x-4 gap-y-1.5 flex-wrap">
        <span className="inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Próximo</span>
        <span className="font-display text-[15px] font-bold tracking-tight">{facts.planName || '—'}</span>
        <span className={NUM}>começa em <b className={STRONG}>{fmtDia(start)}</b>, daqui a {dias(daysToStart)}</span>
        <span className={NUM}>até {fmtDia(end)}</span>
        <span className={NUM}>
          <b className={STRONG}>{facts.value != null ? fmtBRL(facts.value) : '—'}</b>
          {facts.monthly != null ? ` · ${fmtBRL(facts.monthly)}/mês` : ''}
        </span>
        {joinText && <span className="text-[12px] text-slate-500 dark:text-slate-400">{joinText}</span>}
      </div>
      {!isReadOnly && (
        <div className="flex items-center gap-1 flex-none">
          <Btn kind="brand" icon={<Play size={12} />} onClick={() => onActivate(next)} disabled={loading}>Ativar agora</Btn>
          <button type="button" onClick={() => onEditContract(next)} disabled={loading} className={LINK_BTN}>Corrigir</button>
          <button type="button" onClick={() => onContractAction('cancelar', next)} disabled={loading} className={LINK_BTN_DANGER}>
            {canUndo ? 'Cancelar renovação' : 'Cancelar'}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Reescrever `src/components/profile/contracts/ContractsTab.jsx`**

Trocar o arquivo inteiro por:

```jsx
// A aba Contratos da ficha: a linha do tempo, o card do contrato em destaque,
// a faixa do próximo contrato e o Histórico em tabela. Quem é o destaque e o
// próximo, os fatos e a geometria vêm de lib/contractsTab.js; aqui só há tela.
// As ações recebem o CONTRATO em que agem, porque com renovação marcada o
// card é o contrato em uso, e não o último.
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { Ban, FileText, UserPlus } from 'lucide-react';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL, deriveContractStatus, isRenewalNotStarted } from '../../../lib/contracts.js';
import { contractFactsOf, contractTimelineOf, contractsTabModel, heroActionsOf, heroCountdownOf, joinTextOf } from '../../../lib/contractsTab.js';
import { contractVigencia, missedCheckpointsLabel, vigenciaRefDate } from '../../../lib/renewal.js';
import { getSafeDateOrNull } from '../../../lib/dates.js';
import { fmtBRL } from '../../../lib/format.js';
import { cn } from '../../../lib/utils.js';
import { Btn } from '../../ui/Btn.jsx';
import { CONTRACT_TONE } from './tone.js';
import { ContractTimeline } from './ContractTimeline.jsx';
import { ContractHeroCard } from './ContractHeroCard.jsx';
import { NextContractStrip } from './NextContractStrip.jsx';
import { ContractHistoryTable } from './ContractHistoryTable.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

// Lead ou cliente sem contrato vigente: matrícula.
function EmptyState({ firstName, isReadOnly, loading, onEnroll }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-card p-8 text-center">
      <div className="size-[46px] rounded-[14px] grid place-items-center mx-auto mb-3 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={20} /></div>
      <h3 className="font-display text-[16px] font-bold tracking-tight">Ainda não é cliente</h3>
      <p className="text-[12.5px] leading-[1.5] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[300px] mx-auto text-pretty">
        Quando {firstName} fechar, registre plano, valor e vigência. A renovação passa a ser acompanhada por aqui.
      </p>
      {!isReadOnly && (
        <div className="mt-4 flex items-center justify-center">
          <Btn kind="enroll" icon={<UserPlus size={15} />} onClick={onEnroll} disabled={loading}>Matricular agora</Btn>
        </div>
      )}
    </section>
  );
}

// Vencido ou cancelado, sem próximo: o card encolhe e a ação vira nova matrícula.
function ClosedCard({ hero, facts, status, vigencia, isReadOnly, loading, onEnroll }) {
  const cancelled = status === CONTRACT_STATUS.CANCELADO;
  const tone = CONTRACT_TONE[status];
  const pct = vigencia ? vigencia.elapsedPct : 100;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-start gap-3.5 px-5 pt-[18px] pb-4">
        <span className={cn('size-[38px] flex-none rounded-xl grid place-items-center', tone.block, tone.fg)}>
          {cancelled ? <Ban size={17} /> : <FileText size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-[17px] font-bold tracking-tight">{facts.planName || 'Plano'}</h3>
            <span className={cn('inline-flex items-center h-5 px-[7px] rounded-md text-[9.5px] font-bold uppercase tracking-[.05em]', tone.block, tone.fg)}>
              {CONTRACT_STATUS_LABEL[status]}
            </span>
          </div>
          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
            {cancelled
              ? `Cancelado${facts.cancelledAt ? ` em ${fmtDia(facts.cancelledAt)}` : ''}${facts.cancelReason ? ` · ${facts.cancelReason}` : ''}`
              : `Venceu há ${Math.abs(vigencia?.daysLeft ?? 0)} dias · ${fmtDia(getSafeDateOrNull(hero.endsAt))}`}
          </div>
        </div>
        <span className={cn('num flex-none font-display text-[19px] font-bold text-slate-500 dark:text-slate-400', cancelled && 'line-through')}>
          {facts.value != null ? fmtBRL(facts.value) : '—'}
        </span>
      </div>
      <div className="flex h-1 bg-slate-100 dark:bg-white/[0.06]">
        <span className={cn('h-full', cancelled ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600')} style={{ width: `${pct}%` }}></span>
      </div>
      <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-slate-50 dark:bg-white/[0.03]">
        {!isReadOnly && <Btn kind="enroll" icon={<UserPlus size={14} />} onClick={onEnroll} disabled={loading}>Nova matrícula</Btn>}
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {cancelled ? `Interrompido a ${pct}% da vigência.` : 'O cliente conta como inativo até renovar.'}
        </span>
      </div>
    </section>
  );
}

export function ContractsTab({
  lead, leadContracts, firstName, isReadOnly, loading, contractThresholdDays, renewalCheckpoints,
  onEnroll, onRenew, onEditContract, onContractAction, onActivate
}) {
  const now = new Date();
  const { hero, next, history, join } = contractsTabModel({ lead, contracts: leadContracts, now });
  // A aba lê o CONTRATO, não as marcas de cliente: quando as marcas estavam
  // erradas, a aba dizia "Ainda não é cliente" com o contrato gravado.
  const hasContract = Boolean(hero && getSafeDateOrNull(hero.endsAt));
  const status = hasContract ? (deriveContractStatus(hero, now, contractThresholdDays) || CONTRACT_STATUS.ATIVO) : null;
  const closed = status === CONTRACT_STATUS.VENCIDO || status === CONTRACT_STATUS.CANCELADO;
  const heroFacts = hasContract ? contractFactsOf(hero, leadContracts, now, contractThresholdDays) : null;
  // A régua do destaque, congelada no trancamento e no cancelamento
  // (vigenciaRefDate): dá os dias e os marcos que passaram sem contato.
  const vigencia = hasContract
    ? contractVigencia({
      startsAt: heroFacts.start, endsAt: hero.endsAt, checkpoints: renewalCheckpoints,
      handled: lead.renewalHandledCheckpoints, now: vigenciaRefDate(hero, now)
    })
    : null;
  const timeline = contractTimelineOf({
    contracts: leadContracts,
    heroId: hasContract && !closed ? hero.id : null,
    nextId: next?.id || null,
    now,
    checkpoints: renewalCheckpoints,
    handled: lead.renewalHandledCheckpoints
  });
  const rows = history.map((c) => contractFactsOf(c, leadContracts, now, contractThresholdDays));
  // "Cancelar renovação" só quando o desfazer existe (isRenewalNotStarted):
  // com o contrato renovado cancelado, é o cancelamento comum.
  const linked = next?.renewedFromId ? leadContracts.find((c) => c.id === next.renewedFromId) || null : null;
  // O aviso dos marcos some com próximo (o cliente já renovou), no agendado e
  // no trancado, como antes.
  const missed = !next && status !== CONTRACT_STATUS.AGENDADO && status !== CONTRACT_STATUS.TRANCADO
    ? missedCheckpointsLabel(vigencia?.missedCount)
    : null;

  return (
    <div className="space-y-4">
      <ContractTimeline timeline={timeline} />
      {!hasContract ? (
        <EmptyState firstName={firstName} isReadOnly={isReadOnly} loading={loading} onEnroll={onEnroll} />
      ) : closed ? (
        <ClosedCard hero={hero} facts={heroFacts} status={status} vigencia={vigencia} isReadOnly={isReadOnly} loading={loading} onEnroll={onEnroll} />
      ) : (
        <ContractHeroCard
          lead={lead}
          hero={hero}
          status={status}
          hasNext={Boolean(next)}
          countdown={heroCountdownOf({ contract: hero, status, hasNext: Boolean(next), now })}
          facts={heroFacts}
          missed={missed}
          actions={heroActionsOf({ status, hasNext: Boolean(next) })}
          isReadOnly={isReadOnly}
          loading={loading}
          onRenew={onRenew}
          onEditContract={onEditContract}
          onContractAction={onContractAction}
          onActivate={onActivate}
        />
      )}
      {next && (
        <NextContractStrip
          next={next}
          facts={contractFactsOf(next, leadContracts, now, contractThresholdDays)}
          joinText={joinTextOf(join)}
          now={now}
          canUndo={isRenewalNotStarted(next, linked, now)}
          isReadOnly={isReadOnly}
          loading={loading}
          onActivate={onActivate}
          onEditContract={onEditContract}
          onContractAction={onContractAction}
        />
      )}
      <ContractHistoryTable rows={rows} firstName={firstName} hasContract={hasContract} />
    </div>
  );
}
```

- [ ] **Step 6: As ações por contrato no `LeadProfileView.jsx`**

1. Logo depois de `import { ContractEditModal } from '../modals/ContractEditModal.jsx';`, acrescentar `import { ContractActivateModal } from '../modals/ContractActivateModal.jsx';`.

2. Trocar:

```js
  // Desfecho do contrato vigente: 'cancelar' | 'trancar' | 'reativar'.
  const [contractAction, setContractAction] = useState(null);
  const [editingContract, setEditingContract] = useState(false);
```

por:

```js
  // Desfecho de um contrato da aba: { action: 'cancelar' | 'trancar' |
  // 'reativar', contractId }. Com renovação marcada, o contrato pode ser o em
  // uso, e não o último.
  const [contractAction, setContractAction] = useState(null);
  // O contrato a corrigir e o contrato a ativar agora, pelo id: o documento
  // vem vivo da coleção assinada (contractById), como antes.
  const [editingContractId, setEditingContractId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
```

3. Trocar `openContractAction` e o `openContractEdit` da Task 7 por:

```js
  // Cancelar, trancar e reativar passam pelo ContractOutcomeModal: os três
  // pedem data e os dois primeiros pedem motivo. Recebem o CONTRATO em que
  // agem: com renovação marcada, o card da aba é o contrato em uso.
  const openContractAction = (action, contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!contract?.id) { toast.warning('Não há contrato vigente.'); return; }
    setContractAction({ action, contractId: contract.id });
  };

  // Corrigir (ContractEditModal) e Ativar agora (ContractActivateModal) de um
  // contrato da aba. A trava de leitura fica aqui, como nas outras ações.
  const openContractEdit = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (contract?.id) setEditingContractId(contract.id);
  };
  const openActivate = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (contract?.id) setActivatingId(contract.id);
  };
  // O documento de um contrato da aba, vivo; o do resumo do lead como reserva.
  const contractById = (id) => leadContracts.find((c) => c.id === id) || currentContract;
```

4. No `<ContractsTab ... />`, tirar a linha `currentContract={currentContract}` e acrescentar `onActivate={openActivate}` depois de `onEditContract={openContractEdit}`.

5. No fim da view, trocar os blocos `{contractAction && (...)}` e `{editingContract && (...)}` por:

```jsx
      {contractAction && (
        <ContractOutcomeModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={contractById(contractAction.contractId)}
          action={contractAction.action}
          onClose={() => setContractAction(null)}
          onDone={() => setContractAction(null)}
        />
      )}
      {editingContractId && (
        <ContractEditModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={contractById(editingContractId)}
          onClose={() => setEditingContractId(null)}
          onDone={() => setEditingContractId(null)}
        />
      )}
      {activatingId && (
        <ContractActivateModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={contractById(activatingId)}
          onClose={() => setActivatingId(null)}
          onDone={() => setActivatingId(null)}
        />
      )}
```

O `<ContractModal ... currentContract={currentContract} renewedFromId={...lead.currentContractId...} />` não muda: "Renovar contrato" só existe no card sem próximo, e aí o card é o último contrato. A `protecaoDeErro.sweep.test.js` cobra proteção só dos modais montados no `App.jsx`, depois do `AppErrorBoundary`; os modais da ficha ficam dentro do conteúdo protegido, então o modal novo entra aqui como os outros três.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/profileContractsTab.test.js src/lib/__tests__/profileTimeline.test.js src/lib/__tests__/contractsTabComponents.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/overscrollGuard.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js && npx eslint src/views/LeadProfileView.jsx src/components/profile/contracts src/modals && npm run build`
Expected: PASS, lint sem erro (o lint apanha import que sobrou na view), build ok.

- [ ] **Step 8: Commit**

```bash
git add src/components/profile/contracts src/views/LeadProfileView.jsx src/lib/__tests__/profileContractsTab.test.js
# O git rm do Step 1 já deixou a exclusão do teste antigo no índice.
git commit -m "feat: aba Contratos com o contrato em uso no destaque, o próximo contrato e o Histórico em tabela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: `ContractOutcomeModal.jsx` sabe em que contrato age

**Files:**
- Modify: `src/modals/ContractOutcomeModal.jsx`

Sem teste novo: o que muda de regra está nos construtores com `role` (Task 3) e o modal só escolhe o papel, os textos e o contrato ligado do batch. O `sentUndo` continua congelando a renovação desfeita.

- [ ] **Step 1: O papel, a renovação marcada e os textos**

Em `src/modals/ContractOutcomeModal.jsx`, trocar:

```js
  const { contratos } = useGeneralConfig();
  const previous = contract?.renewedFromId
    ? (contratos || []).find(c => c.id === contract.renewedFromId) || null
    : null;
```

por:

```js
  const { contratos } = useGeneralConfig();
  const previous = contract?.renewedFromId
    ? (contratos || []).find(c => c.id === contract.renewedFromId) || null
    : null;
  // Em que contrato o desfecho age. O último (currentContractId) grava o resumo
  // do lead como sempre; o contrato em uso, com renovação marcada, grava só o
  // bloco "em uso" (role 'inUse' dos construtores de contracts.js), e `next` é
  // a renovação marcada: o cancelamento tira dela a marca de emendada, e o
  // trancamento avisa que ela começa do mesmo jeito.
  const isCurrent = !contract?.id || contract.id === lead?.currentContractId;
  const role = isCurrent ? 'current' : 'inUse';
  const next = isCurrent ? null : (contratos || []).find(c => c.id === lead?.currentContractId) || null;
  const nextStart = getSafeDateOrNull(next?.startsAt);
  const renovacao = next?.planName ? `A renovação (Plano ${next.planName})` : 'A renovação';
```

Na prévia, trocar:

```js
    if (action === 'reativar') {
      const novo = buildContractResume({ contract, resumedAt: when || new Date() });
      return pausedDays > 0
        ? `${pausedDays} ${pausedDays === 1 ? 'dia parado' : 'dias parados'} — o término vai de ${fmtDate(endsAt)} para ${fmtDate(novo.newEndsAt)}.`
        : 'Nenhum dia parado — a vigência segue igual.';
    }
    if (action === 'trancar') {
      return 'A vigência congela nesta data. Quando reativar, o término anda para frente pelos dias parados — o cliente não perde o que pagou.';
    }
    return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''} e ${primeiro} passa a contar como inativo. O histórico fica registrado.`;
```

por:

```js
    if (action === 'reativar') {
      const novo = buildContractResume({ contract, resumedAt: when || new Date(), role });
      const base = pausedDays > 0
        ? `${pausedDays} ${pausedDays === 1 ? 'dia parado' : 'dias parados'} — o término vai de ${fmtDate(endsAt)} para ${fmtDate(novo.newEndsAt)}.`
        : 'Nenhum dia parado — a vigência segue igual.';
      // O fim novo passa do início da renovação: os dois valem juntos nesse trecho.
      const cruza = nextStart && novo.newEndsAt && novo.newEndsAt.getTime() >= nextStart.getTime();
      return cruza ? `${base} ${renovacao} começa em ${fmtDate(nextStart)} do mesmo jeito, e os dois contratos valem juntos até ${fmtDate(novo.newEndsAt)}.` : base;
    }
    if (action === 'trancar') {
      const base = 'A vigência congela nesta data. Quando reativar, o término anda para frente pelos dias parados — o cliente não perde o que pagou.';
      return nextStart
        ? `${base} ${renovacao} continua marcada para ${fmtDate(nextStart)}. Se o contrato ainda estiver trancado nesse dia, ela começa do mesmo jeito.`
        : base;
    }
    if (nextStart) {
      return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''}. ${renovacao} continua marcada para ${fmtDate(nextStart)}, e até lá ${primeiro} fica sem contrato.`;
    }
    return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''} e ${primeiro} passa a contar como inativo. O histórico fica registrado.`;
```

- [ ] **Step 2: A gravação com o papel e o contrato ligado**

Trocar:

```js
      const built = undo || (action === 'cancelar'
        ? buildContractCancel({ planName, cancelledAt: when, reason, note: note.trim() || null })
        : action === 'trancar'
          ? buildContractPause({ planName, pausedAt: when, reason })
          : buildContractResume({ contract, resumedAt: when }));

      // Desfeita a renovação que encurtou o contrato renovado, o fim de antes
      // volta a ele no mesmo batch.
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        linkedContractId: undo?.previousPatch ? previous.id : null,
        linkedContractPatch: undo?.previousPatch || null
      });
```

por:

```js
      const built = undo || (action === 'cancelar'
        ? buildContractCancel({ planName, cancelledAt: when, reason, note: note.trim() || null, role, contract, next })
        : action === 'trancar'
          ? buildContractPause({ planName, pausedAt: when, reason, role, contract })
          : buildContractResume({ contract, resumedAt: when, role }));

      // O contrato ligado do batch: desfeita a renovação que encurtou o
      // contrato renovado, o fim de antes volta a ele; cancelado o contrato em
      // uso, a renovação marcada perde a marca de emendada (nextPatch).
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        linkedContractId: undo?.previousPatch ? previous.id : (built.nextPatch ? next.id : null),
        linkedContractPatch: undo?.previousPatch || built.nextPatch || null
      });
```

- [ ] **Step 3: Lint, testes de render e build**

Run: `npx eslint src/modals/ContractOutcomeModal.jsx && npx vitest run src/lib/__tests__/profileContractsTab.test.js src/lib/__tests__/contracts.test.js && npm run build`
Expected: sem erro, PASS, build ok.

- [ ] **Step 4: Commit**

```bash
git add src/modals/ContractOutcomeModal.jsx
git commit -m "feat: trancar, reativar e cancelar o contrato em uso pelo modal, com a renovação marcada nos avisos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 13: O Histórico na ficha inteira e a limpeza do que a aba velha usava

**Files:**
- Modify: `src/lib/contractHistory.js`
- Test: `src/lib/__tests__/profileContractsTab.test.js`, `src/lib/__tests__/contractHistory.test.js`

- [ ] **Step 1: O teste da tabela dentro da ficha**

Em `src/lib/__tests__/profileContractsTab.test.js`, logo depois de `const cancelado = ...`, acrescentar:

```js
// O Mensal de 2024, trancado 20 dias e renovado pelo Start.
const anterior = {
  id: 'k0', leadId: 'l1', planId: 'p0', planName: 'Mensal', value: 1188, listValue: 1188, durationMonths: 12,
  status: 'ativo', startsAt: D(2024, 9, 20), endsAt: D(2025, 10, 10), createdAt: D(2024, 9, 20), consultantName: 'Ana',
  pausedDaysTotal: 20, resumedAt: D(2025, 1, 25), pauseHistory: [{ pausedAt: D(2025, 1, 5), resumedAt: D(2025, 1, 25) }]
};
const startRenovado = { ...start, renewedFromId: 'k0' };
```

E, dentro do `describe`, no fim:

```js
  it('o Histórico é a tabela com os contratos que não são o destaque nem o próximo', () => {
    const { hero, historico } = aba(startRenovado, [anterior, startRenovado]);
    expect(hero).toContain('>Renovado de<');
    expect(hero).toContain('>Mensal<');
    expect(historico).toContain('>1 anterior<');
    expect(historico).toContain('>Fim previsto<');
    expect(historico).toContain('>Mensal<');
    expect(historico).toContain('primeira matrícula');
    expect(historico).toContain('>20/09/2025<');
    expect(historico).toContain('20 dias depois, pelo trancamento');
    expect(historico).toContain('>Renovado<');
    expect(historico).toContain('overflow-x-auto overscroll-x-contain');
    // A linha aberta (desconto, quem fechou, código, trancamentos) é coberta
    // pelo teste do componente, em contractsTabComponents.test.js, que abre
    // por defaultOpenId: o renderToString não clica.
  });
```

Run: `npx vitest run src/lib/__tests__/profileContractsTab.test.js`
Expected: PASS (a tela já está pronta; o teste só fecha a cobertura da ficha inteira).

- [ ] **Step 2: Apagar o que só a aba velha usava**

Em `src/lib/contractHistory.js`, apagar `historySuccessorOf` inteira (do comentário `// O contrato que veio depois deste de verdade, de onde sai a linha de intervalo` até o `}` que a fecha) e `inUseNoteOf` inteira (do comentário `// A linha da faixa do card quando o contrato atual ainda não começou e o` até o `}` final do arquivo). A lacuna "N dias sem contrato" virou o texto da origem na tabela (`originTextOf`), e a nota da faixa virou o encaixe do próximo (`joinTextOf`).

Em `src/lib/__tests__/contractHistory.test.js`, tirar `historySuccessorOf, inUseNoteOf,` do import e apagar os dois `describe` inteiros: `describe('historySuccessorOf', ...)` e `describe('inUseNoteOf: a linha do contrato em uso no card', ...)`.

Run: `grep -rn "historySuccessorOf\|inUseNoteOf\|gapLabel" src api; npx vitest run src/lib/__tests__/contractHistory.test.js && npx eslint src/lib/contractHistory.js`
Expected: o grep não acha nada, PASS, lint sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/lib/contractHistory.js src/lib/__tests__/contractHistory.test.js src/lib/__tests__/profileContractsTab.test.js
git commit -m "test: Histórico em tabela na ficha inteira, e limpeza do que só a aba velha usava

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Documentação e verificação completa

**Files:**
- Modify: `CLAUDE.md` (do Stronilead), `docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md`

- [ ] **Step 1: `CLAUDE.md`, seção "Aba Contratos da ficha"**

No parágrafo de abertura da seção, trocar `Spec em ... e plano em \`docs/superpowers/plans/2026-09-29-aba-contratos-correcoes.md\`.` por `Specs em \`docs/superpowers/specs/2026-09-28-aba-contratos-correcoes-design.md\` e \`docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md\`, e planos em \`docs/superpowers/plans/2026-09-29-aba-contratos-correcoes.md\` e \`docs/superpowers/plans/2026-09-30-contrato-em-uso-e-historico.md\`.`

Trocar o item que começa com `- **No Histórico**, o contrato que tem renovação ligada aparece "Em uso"` inteiro por:

```markdown
- **O destaque da aba é o contrato em uso** (`contractsTabModel`, em `src/lib/contractsTab.js`, puro e testado em node): o último contrato (`currentContractId`) quando ele já começou; senão, o contrato que ele renova enquanto está em uso (`isInUseAt`, em `contractHistory.js`: começou, não foi cancelado e vale até hoje por dia do calendário, ou está trancado, porque o fim do trancado não corre) ou, sem ligação, outro contrato do lead em uso, o de início mais recente. Nesse caso o último contrato é o "Próximo contrato", uma faixa fina com Ativar agora, Corrigir e Cancelar renovação (ou Cancelar, quando o contrato renovado foi cancelado e o desfazer não existe). Sem contrato em uso, o último é o destaque como agendado, com Ativar agora, Corrigir e Cancelar. O Histórico é o resto, em tabela (`contractFactsOf`: fim previsto, fim de fato com o motivo, trancado, valor, média e situação), sem botões, com a linha que abre desconto, quem fechou, código, cancelamento e trancamentos. A linha do tempo de todos os contratos (`contractTimelineOf`) substituiu a régua do rodapé do card. A tela mora em `src/components/profile/contracts/`, e o `LeadProfileView.jsx` só monta o `ContractsTab` e os modais; toda ação recebe o contrato em que age. O último contrato sem documento na lista cai no resumo do lead (`summaryContractOf`).
- **O bloco "em uso" do resumo do lead** (`inUseContractId`, `inUseContractStatus`, `inUseContractEndsAt`) existe enquanto o último contrato não começou. `deriveLeadContractStatus` o lê primeiro: trancado dá trancado; cancelado, ou fim já passado sem a marca de emendada, dá agendado; valendo dá ativo, nunca a vencer, porque o cliente já renovou. Com a marca, a emendada continua ativa no dia entre o fim do em uso e o início dela, como antes. Vale nas listas, na Meta Diária e no cartão do Stronizap, sempre por instante. Quem grava: a renovação (`buildMatriculaWrites`, com o fim encurtado quando encurta), o corrigir da renovação (`buildContractEdit`, com o início novo ainda no futuro e o anterior já começado, com o status dele), e trancar, reativar e cancelar com `role: 'inUse'`. Quem limpa (`CLEAR_IN_USE_BLOCK`): matrícula, importação, cancelar a renovação (`buildRenewalCancel`) e Ativar agora. É uma cópia: mudança no contrato em uso por outro caminho deixa as listas erradas até a próxima gravação; a ficha lê os contratos e não erra. Lead com renovação marcada antes de 30/09/2026 não tem o bloco, e a primeira ação no contrato em uso grava o bloco inteiro.
- **Papel do contrato nos desfechos.** `buildContractPause`, `buildContractResume` e `buildContractCancel` recebem `role`: `'current'` (padrão) grava `currentContract*`, como sempre; `'inUse'` grava só o bloco, e precisa do `contract`. O `ContractOutcomeModal` decide pelo id: contrato diferente de `currentContractId` é o em uso. Cancelar o em uso com renovação marcada tira a marca de emendada da renovação (`nextPatch`, gravado como contrato ligado do batch) e de `currentContractSeamless`, e a linha do tempo termina com "A renovação continua marcada para DD/MM/AAAA.", que o `contractEventOf` lê. Trancar o em uso não mexe na renovação: reativado com o fim depois do início dela, os dois valem juntos. Reativar um contrato encurtado por renovação (`originalEndsAt`) anda o fim original pelos mesmos dias, para o desfazer devolver a data certa. O segundo contrato do `commitContractPatch` chama-se `linkedContractId`/`linkedContractPatch`, porque às vezes é o próximo.
- **Ativar agora** (`buildContractActivate`, modal em `src/modals/ContractActivateModal.jsx`) é a correção do início para agora, com a hora, pelas regras do `buildContractEdit`: plano, valor e desconto não mudam; o em uso em vigor termina ontem, com `originalEndsAt` e `shortenedById`, e o ativado leva a marca de emendado; trancado ou cancelado, nada é encurtado; o bloco é limpo. Texto da linha do tempo "Contrato ativado antes da data marcada — Plano X (R$ Y), vigência DD/MM/AAAA → DD/MM/AAAA.", tipo `ativacao` no `contractEventOf`, linha comum do tipo "Contrato", sem faixa.
- **Trancado com renovação ligada** conta como em uso (`runningPredecessorOf`) e, no Histórico, vira "Renovado" quando a renovação começa (`historyStatusOf`), com a nota "Estava trancado quando a renovação começou." na linha aberta, a mesma leitura do Operacional, que encerra a pausa no início do sucessor. O contrato que ainda não começou é "Agendado", mesmo emendado.
- **Fora do escopo desta entrega:** as colunas de Clientes continuam mostrando o último contrato; corrigir o contrato em uso com renovação marcada; botões nas linhas do Histórico; o contrato cujo fim gravado à meia-noite aparece vencido no último dia.
```

- [ ] **Step 2: Status da spec**

Em `docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md`, trocar `status: revisão` por `status: ativo`.

- [ ] **Step 3: Verificação completa**

Run: `npm test && npm run lint && npm run build && npm run verificar:sentry`
Expected: tudo verde, com mais testes que a linha de base da Task 0; lint sem erro; build ok; o verificador do Sentry passa nas duas rodadas.

- [ ] **Step 4: Conferência manual no preview (antes de pedir o merge)**

Numa academia de teste, com a ficha aberta na aba Contratos: (1) renovar antes do vencimento e conferir que o card fica com o contrato em uso e a faixa mostra o próximo; (2) trancar e reativar o contrato em uso e conferir o estado no topo da ficha e em Clientes; (3) cancelar o contrato em uso e conferir "CONTRATO AGENDADO" no topo, a frase da renovação na linha do tempo e a marca de emendada tirada; (4) Ativar agora na faixa e conferir as datas, o encurtamento e o estado ativo; (5) abrir uma linha do Histórico. O que sair diferente da spec volta para o plano antes do merge.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md
git commit -m "docs: aba Contratos com o contrato em uso, o bloco do resumo e o Ativar agora

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Conferência do plano contra a spec

| Seção da spec | Onde está no plano |
|---|---|
| A tela: Vigência (linha do tempo) | Task 6 (`contractTimelineOf`), Task 8 (`ContractTimeline.jsx`) |
| A tela: Contrato em uso (card, selo "Em uso", trancado, aviso dos marcos) | Task 6 (`heroCountdownOf`, `heroActionsOf`), Task 11 (`ContractHeroCard.jsx`, `ContractsTab.jsx`) |
| A tela: Próximo contrato (faixa, encaixe) | Task 6 (`joinTextOf`), Task 11 (`NextContractStrip.jsx`) |
| A tela: Histórico (tabela, linha aberta, sem botões, "—" sem valor e sem plano) | Task 6 (`contractFactsOf`, `originTextOf`), Task 9 (`ContractHistoryTable.jsx`) |
| Botões em cada situação | Task 6 (`heroActionsOf`), Task 11 (teste de render das situações) |
| Modal do Ativar agora | Task 10 |
| Quem é o contrato em uso | Task 5 (`isInUseAt`), Task 6 (`contractsTabModel`) |
| Detalhes de cada contrato | Task 6 (`contractFactsOf`), Task 5 (`historyStatusOf` do trancado) |
| O alvo é o contrato certo | Task 3 (`role`), Task 11 (ações por contrato), Task 12 (modal) |
| Trancar e reativar o contrato em uso | Task 3 (`originalEndsAt` na reativação), Task 12 (aviso do trancar) |
| Cancelar o contrato em uso | Task 3 (`nextPatch`, marca, frase), Task 12 (prévia) |
| Ativar agora (gravação e texto) | Task 4 |
| Quem mais grava o bloco | Task 2 |
| Estado do cliente nas listas | Task 1 |
| Painéis (sem mudança de código) | conferência na verificação da Task 14: `npm test` roda a bateria do Operacional e do Gerencial |
| Arquivos | mapa de arquivos, no topo |
| Testes | Tasks 1 a 6, 8, 9, 11 e 13 |
| `CLAUDE.md` | Task 14 |
