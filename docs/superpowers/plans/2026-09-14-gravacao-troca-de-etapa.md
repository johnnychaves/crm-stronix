# Gravação da troca de etapa: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar cada troca de etapa de lead de funil com a etapa de origem, a de destino, o funil e a data de entrada na etapa, para o dashboard CRM medir a passagem entre etapas.

**Architecture:** Duas funções puras novas entram em `src/lib/stageMove.js`, `stageChangeFields` e `withStageEntered`, e `planStageMove` e `planLoss` passam a devolver `stageChange`. Os seis pontos que mudam a etapa espalham esses campos na interação `status_change` e carimbam `statusEnteredAt` no lead, com o horário do servidor. O cadastro carimba `statusEnteredAt` junto do `createdAt`. Não há regra nova no Firestore nem leitura a mais.

**Tech Stack:** React 19, Firebase Firestore (SDK web), Vitest. JS/JSX sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-14-dashboard-crm-design.md`, §5.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/stageMove.js` | `stageChangeFields` e `withStageEntered`; `planStageMove` e `planLoss` devolvem `stageChange` |
| `src/lib/__tests__/stageMove.test.js` | testes das duas funções e dos retornos novos; ajuste do teste de `planLoss` que compara o objeto inteiro |
| `src/views/KanbanView.jsx` | `applyMoveToStage` (arrasto e menu Mover) e `confirmKanbanLoss` |
| `src/views/LeadProfileView.jsx` | `confirmLoss` (perda de lead) e `handlePhaseConfirm` (Mudar fase) |
| `src/lib/appointmentOutcome.js` | promoção para Negociação no desfecho de agendamento |
| `src/views/DailyGoalView.jsx` | promoção para Negociação no desfecho da Meta (`handleOutcome`) |
| `src/lib/contractsWrites.js` | `commitMatricula`, quando a etapa vira Venda |
| `src/modals/AddLeadModal.jsx` | `statusEnteredAt` no cadastro |

Ficam de fora de propósito:
- o funil Upgrade (`planUpgradeMove` e `planUpgradeDecline`), que é funil de cliente;
- `commitContractPatch` (cancelar, trancar, reativar e corrigir contrato), porque não muda a etapa;
- a nota de troca de responsável (`src/modals/ClientRegistrationModal.jsx:78`), que só usa o mesmo tipo de interação;
- a importação e os funis Renovações e Vencidos.

Lead criado por outro caminho (importação ou a página pública de indicação) fica sem `statusEnteredAt`. O CRM usa o `createdAt` como entrada na primeira etapa (spec, §4).

## Contexto para quem implementa

- `lead.status` guarda o NOME da etapa, e `lead.funnelId` guarda o funil. As etapas ficam em `stronix_statuses`, com `funnelId`, `name` e `order`.
- `logInteraction(db, lead, appUser, payload, leadPatch)`, em `src/lib/interactions.js`, grava a interação com `...payload` no fim e o `leadPatch` no lead, no mesmo batch. Os campos extras do payload chegam à interação sem mexer nessa função.
- `serverTimestamp()` é do SDK, e a regra pura (`stageMove.js`) não importa o SDK. Por isso quem chama passa o carimbo, como já acontece com `convertedAt` e `upgradeEnteredAt`.
- Espalhar `null` num objeto não quebra: `{ ...null }` vale `{}`. Por isso `...plan.stageChange` funciona mesmo quando não há troca.
- As regras do Firestore já aceitam os campos novos: interações com campos livres e alteração de lead sem lista fechada. Não publique nada.
- Commits em português, no formato `tipo: descrição`, terminando com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Campos da troca na regra única

**Files:**
- Modify: `src/lib/stageMove.js`
- Test: `src/lib/__tests__/stageMove.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/stageMove.test.js`, troque o import da linha 9 por:

```js
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, STAGE_MOVE_BLOCK, stageChangeFields, withStageEntered } from '../stageMove.js';
```

Troque o teste das linhas 97 a 99 (`lead em etapa comum pode ser marcado como Perda`) por:

```js
  it('lead em etapa comum pode ser marcado como Perda, com a troca para Perda', () => {
    expect(planLoss(leadEmEtapa)).toEqual({
      ok: true,
      kind: 'lead',
      stageChange: { fromStatus: 'Em contato', toStatus: 'Perda', funnelId: 'f1' }
    });
  });
```

No fim do arquivo, acrescente:

```js
describe('stageChangeFields: campos da troca de etapa', () => {
  it('grava origem, destino e funil quando a etapa muda', () => {
    expect(stageChangeFields(leadEmEtapa, 'Negociação'))
      .toEqual({ fromStatus: 'Em contato', toStatus: 'Negociação', funnelId: 'f1' });
  });

  it('traz o funil de origem quando o lead troca de funil', () => {
    expect(stageChangeFields(leadEmEtapa, 'Novo', { toFunnelId: 'f2' }))
      .toEqual({ fromStatus: 'Em contato', toStatus: 'Novo', funnelId: 'f2', fromFunnelId: 'f1' });
  });

  it('mesma etapa no mesmo funil: nada a gravar', () => {
    expect(stageChangeFields(leadEmEtapa, 'Em contato')).toBeNull();
    expect(stageChangeFields(leadEmEtapa, 'Em contato', { toFunnelId: 'f1' })).toBeNull();
  });

  it('mesma etapa em outro funil conta como troca', () => {
    expect(stageChangeFields(leadEmEtapa, 'Em contato', { toFunnelId: 'f2' }))
      .toEqual({ fromStatus: 'Em contato', toStatus: 'Em contato', funnelId: 'f2', fromFunnelId: 'f1' });
  });

  it('sem destino: nada a gravar', () => {
    expect(stageChangeFields(leadEmEtapa, '')).toBeNull();
    expect(stageChangeFields(leadEmEtapa, null)).toBeNull();
  });

  it('lead ainda sem etapa e sem funil: origem nula', () => {
    expect(stageChangeFields({ id: 'novo' }, 'Novo', { toFunnelId: 'f1' }))
      .toEqual({ fromStatus: null, toStatus: 'Novo', funnelId: 'f1', fromFunnelId: null });
  });
});

describe('withStageEntered: data de entrada na etapa', () => {
  const carimbo = { carimbo: true };

  it('carimba statusEnteredAt quando há troca', () => {
    const troca = { fromStatus: 'Em contato', toStatus: 'Negociação', funnelId: 'f1' };
    expect(withStageEntered({ status: 'Negociação' }, troca, carimbo))
      .toEqual({ status: 'Negociação', statusEnteredAt: carimbo });
  });

  it('sem troca devolve o patch como veio', () => {
    const patch = { status: 'Em contato' };
    expect(withStageEntered(patch, null, carimbo)).toBe(patch);
  });
});

describe('planStageMove devolve a troca', () => {
  it('traz stageChange com o funil do lead ou com o funil novo', () => {
    expect(planStageMove(leadEmEtapa, 'Negociação').stageChange)
      .toEqual({ fromStatus: 'Em contato', toStatus: 'Negociação', funnelId: 'f1' });
    expect(planStageMove(leadEmEtapa, 'Novo', { funnelId: 'f2' }).stageChange)
      .toEqual({ fromStatus: 'Em contato', toStatus: 'Novo', funnelId: 'f2', fromFunnelId: 'f1' });
  });

  it('mesma etapa: stageChange nulo', () => {
    expect(planStageMove(leadEmEtapa, 'Em contato').stageChange).toBeNull();
    expect(planStageMove(clienteComContrato, 'Venda').stageChange).toBeNull();
  });

  it('movimento bloqueado não traz stageChange', () => {
    expect(planStageMove(clienteComContrato, 'Em contato'))
      .toEqual({ ok: false, reason: STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD });
  });
});
```

- [ ] **Step 2: Rodar os testes e ver que falham**

Run: `npx vitest run src/lib/__tests__/stageMove.test.js`
Expected: FAIL. `stageChangeFields` e `withStageEntered` ainda não existem, e o teste de `planLoss` recebe o objeto sem `stageChange`.

- [ ] **Step 3: Implementar em `src/lib/stageMove.js`**

Troque o bloco de comentário das linhas 26 a 31 por:

```js
// Retorno de planStageMove:
//   { ok: true, patch, stampConvertedAt, stageChange } — patch já com
//     lifecycleBucket (withBucket); convertedAt NÃO vem no patch quando
//     stampConvertedAt é true: é serverTimestamp() do SDK, o caller injeta.
//     stageChange são os campos da troca (stageChangeFields), ou null.
//   { ok: false, reason }                 — nada a gravar.
// planLoss devolve { ok: true, kind: 'lead', stageChange },
// { ok: true, kind: 'upgrade' } ou { ok: false, reason }.
```

Logo depois do `STAGE_MOVE_BLOCK` (antes de `export function planStageMove`), acrescente:

```js
// Campos da troca de etapa, gravados na interação status_change. São a base do
// dashboard CRM: passagem entre etapas, tempo em cada etapa e etapa da perda.
// O nome da etapa vai como estava na hora da troca. null quando nada muda.
export function stageChangeFields(lead, toStatus, { toFunnelId = null } = {}) {
  if (!toStatus) return null;
  const fromStatus = lead?.status ?? null;
  const fromFunnelId = lead?.funnelId ?? null;
  const funnelId = toFunnelId || fromFunnelId;
  if (toStatus === fromStatus && funnelId === fromFunnelId) return null;
  const fields = { fromStatus, toStatus, funnelId };
  if (funnelId !== fromFunnelId) fields.fromFunnelId = fromFunnelId;
  return fields;
}

// Data de entrada na etapa atual (statusEnteredAt). É serverTimestamp() do SDK,
// então quem chama passa o carimbo, como no convertedAt e no upgradeEnteredAt.
export function withStageEntered(patch, stageChange, stamp) {
  return stageChange ? { ...patch, statusEnteredAt: stamp } : patch;
}
```

Em `planStageMove`, troque a última linha (`return { ok: true, patch: withBucket(patch, lead), stampConvertedAt };`) por:

```js
  return {
    ok: true,
    patch: withBucket(patch, lead),
    stampConvertedAt,
    stageChange: stageChangeFields(lead, targetStatus, { toFunnelId: funnelId })
  };
```

Em `planLoss`, troque a primeira linha (`if (!isClientLead(lead)) return { ok: true, kind: 'lead' };`) por:

```js
  if (!isClientLead(lead)) return { ok: true, kind: 'lead', stageChange: stageChangeFields(lead, 'Perda') };
```

- [ ] **Step 4: Rodar os testes e ver que passam**

Run: `npx vitest run src/lib/__tests__/stageMove.test.js`
Expected: PASS, com todos os testes do arquivo, os antigos e os novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stageMove.js src/lib/__tests__/stageMove.test.js
git commit -m "feat: regra de troca de etapa devolve origem, destino e funil" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Pipeline (arrasto, menu Mover e Perda)

**Files:**
- Modify: `src/views/KanbanView.jsx` (import da linha 6, `applyMoveToStage` perto da linha 794, `confirmKanbanLoss` perto da linha 1121)

- [ ] **Step 1: Import**

Troque a linha 6 por:

```js
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, STAGE_MOVE_BLOCK, withStageEntered } from '../lib/stageMove.js';
```

- [ ] **Step 2: Arrasto e menu Mover (`applyMoveToStage`)**

Troque este trecho:

```js
      const leadPatch = plan.stampConvertedAt
        ? { ...plan.patch, convertedAt: serverTimestamp() }
        : plan.patch;

      await logInteraction(
        db, lead, appUser,
        { text: `Movido para a etapa [${newStatus}] via Kanban.`, type: 'status_change' },
        leadPatch
      );
```

por:

```js
      const leadPatch = withStageEntered(
        plan.stampConvertedAt ? { ...plan.patch, convertedAt: serverTimestamp() } : plan.patch,
        plan.stageChange,
        serverTimestamp()
      );

      await logInteraction(
        db, lead, appUser,
        { text: `Movido para a etapa [${newStatus}] via Kanban.`, type: 'status_change', ...plan.stageChange },
        leadPatch
      );
```

- [ ] **Step 3: Perda (`confirmKanbanLoss`)**

Troque este trecho:

```js
      await logInteraction(
        db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change' },
        withBucket(
          {
            status: 'Perda',
            lossReason: reason,
            nextFollowUp: null,
            lostAt: serverTimestamp(),
            // Limpa resquício caso o lead viesse da coluna Venda.
            isConverted: false,
            convertedAt: null
          },
          lead
        )
      );
```

por:

```js
      await logInteraction(
        db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change', ...loss.stageChange },
        withStageEntered(
          withBucket(
            {
              status: 'Perda',
              lossReason: reason,
              nextFollowUp: null,
              lostAt: serverTimestamp(),
              // Limpa resquício caso o lead viesse da coluna Venda.
              isConverted: false,
              convertedAt: null
            },
            lead
          ),
          loss.stageChange,
          serverTimestamp()
        )
      );
```

- [ ] **Step 4: Lint e testes**

Run: `npx eslint src/views/KanbanView.jsx && npx vitest run`
Expected: nenhum erro de lint no arquivo e todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/views/KanbanView.jsx
git commit -m "feat: Pipeline grava origem e destino na troca de etapa e na perda" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Ficha (Mudar fase e Perda)

**Files:**
- Modify: `src/views/LeadProfileView.jsx` (import da linha 9, `confirmLoss` perto da linha 300, `handlePhaseConfirm` perto da linha 389)

- [ ] **Step 1: Import**

Troque a linha 9 por:

```js
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, withStageEntered } from '../lib/stageMove.js';
```

- [ ] **Step 2: Perda de lead (`confirmLoss`)**

Troque este trecho:

```js
      await logInteraction(db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change' },
        withBucket({
          status: 'Perda',
          lossReason: reason,
          nextFollowUp: null,
          lostAt: serverTimestamp(),
          // Limpa resquício caso o lead viesse de Venda.
          isConverted: false,
          convertedAt: null
        }, lead)
      );
```

por:

```js
      await logInteraction(db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change', ...loss.stageChange },
        withStageEntered(
          withBucket({
            status: 'Perda',
            lossReason: reason,
            nextFollowUp: null,
            lostAt: serverTimestamp(),
            // Limpa resquício caso o lead viesse de Venda.
            isConverted: false,
            convertedAt: null
          }, lead),
          loss.stageChange,
          serverTimestamp()
        )
      );
```

- [ ] **Step 3: Mudar fase (`handlePhaseConfirm`)**

Troque este trecho:

```js
      const up = plan.stampConvertedAt
        ? { ...plan.patch, convertedAt: serverTimestamp() }
        : plan.patch;
      await logInteraction(db, lead, appUser,
        { text: `Fase alterada para [${targetStatus}]${phaseNote ? ' — ' + phaseNote : ''}.`, type: 'status_change' },
        up
      );
```

por:

```js
      const up = withStageEntered(
        plan.stampConvertedAt ? { ...plan.patch, convertedAt: serverTimestamp() } : plan.patch,
        plan.stageChange,
        serverTimestamp()
      );
      await logInteraction(db, lead, appUser,
        { text: `Fase alterada para [${targetStatus}]${phaseNote ? ' — ' + phaseNote : ''}.`, type: 'status_change', ...plan.stageChange },
        up
      );
```

O texto da timeline continua igual. Esta PR não mexe em texto visível.

- [ ] **Step 4: Lint e testes**

Run: `npx eslint src/views/LeadProfileView.jsx && npx vitest run`
Expected: nenhum erro de lint no arquivo e todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "feat: ficha grava origem e destino na troca de etapa e na perda" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Desfecho de agendamento que promove para Negociação

**Files:**
- Modify: `src/lib/appointmentOutcome.js` (imports perto da linha 24, promoção nas linhas 89 e 121 a 130)
- Modify: `src/views/DailyGoalView.jsx` (imports do topo, `handleOutcome` nas linhas 1148 a 1150 e 1183 a 1188)

- [ ] **Step 1: Import em `appointmentOutcome.js`**

Logo abaixo da linha 24 (`import { doc, collection, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';`), acrescente:

```js
import { stageChangeFields } from './stageMove.js';
```

- [ ] **Step 2: Carimbo no lead (`appointmentOutcome.js`)**

Troque a linha 89 (`if (shouldPromote) leadUpdate.status = negStatus.name;`) por:

```js
  if (shouldPromote) {
    leadUpdate.status = negStatus.name;
    leadUpdate.statusEnteredAt = serverTimestamp();
  }
```

- [ ] **Step 3: Campos na interação (`appointmentOutcome.js`)**

Troque o bloco da promoção:

```js
  if (shouldPromote) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: `Fase alterada para [${negStatus.name}] após comparecimento em ${categoryLabel}.`,
      type: 'status_change',
      createdAt: serverTimestamp()
    });
  }
```

por:

```js
  if (shouldPromote) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: `Fase alterada para [${negStatus.name}] após comparecimento em ${categoryLabel}.`,
      type: 'status_change',
      ...stageChangeFields(lead, negStatus.name),
      createdAt: serverTimestamp()
    });
  }
```

O `lead` aqui é o objeto de antes da promoção, então `fromStatus` sai com a etapa antiga.

- [ ] **Step 4: Import em `DailyGoalView.jsx`**

No bloco de imports do topo, junto dos imports de `../lib/`, acrescente:

```js
import { stageChangeFields } from '../lib/stageMove.js';
```

- [ ] **Step 5: Carimbo e campos em `handleOutcome` (`DailyGoalView.jsx`)**

Troque:

```js
      if (shouldPromoteToNegociacao) {
        leadUpdate.status = negStatus.name; // 'Negociação'
      }
```

por:

```js
      if (shouldPromoteToNegociacao) {
        leadUpdate.status = negStatus.name; // 'Negociação'
        leadUpdate.statusEnteredAt = serverTimestamp();
      }
```

E troque:

```js
      if (shouldPromoteToNegociacao) {
        await logInteraction(db, lead, appUser, {
          text: `Fase alterada para [${negStatus.name}] após comparecimento em ${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug}.`,
          type: 'status_change'
        });
      }
```

por:

```js
      if (shouldPromoteToNegociacao) {
        await logInteraction(db, lead, appUser, {
          text: `Fase alterada para [${negStatus.name}] após comparecimento em ${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug}.`,
          type: 'status_change',
          ...stageChangeFields(lead, negStatus.name)
        });
      }
```

- [ ] **Step 6: Lint e testes**

Run: `npx eslint src/lib/appointmentOutcome.js src/views/DailyGoalView.jsx && npx vitest run`
Expected: nenhum erro de lint nos dois arquivos e todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/lib/appointmentOutcome.js src/views/DailyGoalView.jsx
git commit -m "feat: promoção para Negociação grava origem, destino e entrada na etapa" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Matrícula e cadastro

**Files:**
- Modify: `src/lib/contractsWrites.js` (imports perto da linha 14, `commitMatricula` nas linhas 83 a 125)
- Modify: `src/modals/AddLeadModal.jsx` (linha 476)

- [ ] **Step 1: Import em `contractsWrites.js`**

Logo abaixo da linha 14 (`import { withBucket } from './leadDerived.js';`), acrescente:

```js
import { stageChangeFields } from './stageMove.js';
```

- [ ] **Step 2: Troca para Venda em `commitMatricula`**

Logo depois da desestruturação do `buildMatriculaWrites(...)` (a linha que termina com `} = buildMatriculaWrites({ lead, plan, value, startsAt, appUser, mode, renewedFromId });`), acrescente:

```js
  // Troca de etapa para Venda (base do CRM). null na renovação, quando o
  // lead já está em Venda.
  const stageChange = setStatusVenda ? stageChangeFields(lead, 'Venda') : null;
```

Logo depois da linha `if (stampClienteSince) leadUpdate.clienteSince = serverTimestamp();`, acrescente:

```js
  if (stageChange) leadUpdate.statusEnteredAt = serverTimestamp();
```

No `batch.set(interactionRef, { ... })` da timeline (o que tem `text: interactionText, type: 'status_change'`), troque:

```js
    text: interactionText,
    type: 'status_change',
    createdAt: serverTimestamp()
  });
```

por:

```js
    text: interactionText,
    type: 'status_change',
    ...stageChange,
    createdAt: serverTimestamp()
  });
```

Atenção: há dois `type: 'status_change'` neste arquivo. O primeiro, perto da linha 52, é de `commitContractPatch` e NÃO muda. Só o de `commitMatricula`, perto da linha 123, ganha `...stageChange`.

- [ ] **Step 3: Cadastro em `AddLeadModal.jsx`**

Logo depois da linha `createdAt: serverTimestamp(),` do `addDoc` do lead (perto da linha 476), acrescente:

```js
          statusEnteredAt: serverTimestamp(),
```

- [ ] **Step 4: Lint e testes**

Run: `npx eslint src/lib/contractsWrites.js src/modals/AddLeadModal.jsx && npx vitest run`
Expected: nenhum erro de lint nos dois arquivos e todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contractsWrites.js src/modals/AddLeadModal.jsx
git commit -m "feat: matrícula e cadastro gravam a entrada na etapa" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Verificação e PR

- [ ] **Step 1: Suíte, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: todos os testes passando, lint com 0 erros (existe 1 aviso antigo no `SuperAdminView`) e build ok.

- [ ] **Step 2: Conferir que nenhum ponto ficou sem os campos**

Run: `grep -rn "type: 'status_change'" src --include='*.js' --include='*.jsx' --exclude-dir=__tests__`
Expected: nas linhas de troca de etapa de lead de funil (Pipeline, ficha, perda, promoção e matrícula), o objeto da interação tem `...plan.stageChange`, `...loss.stageChange`, `...stageChange` ou `...stageChangeFields(...)`. As linhas de Upgrade, de `commitContractPatch` e da troca de responsável ficam como estavam.

- [ ] **Step 3: Enviar e abrir a PR, sem merge**

```bash
git push -u origin claude/dashboard-crm
gh pr create --title "Gravação da troca de etapa, base do dashboard CRM" --body "$(cat <<'EOF'
Cada troca de etapa de lead de funil passa a gravar na timeline a etapa de origem, a de destino e o funil, e o lead passa a guardar quando entrou na etapa atual (`statusEnteredAt`). É a base da passagem entre etapas, do tempo em cada etapa e da etapa da perda no dashboard CRM. O histórico conta a partir do deploy.

## Onde grava

- Pipeline: arrasto, menu Mover e Perda.
- Ficha: Mudar fase e Perda.
- Desfecho de agendamento que promove para Negociação (tela de Aulas e Visitas e Meta Diária).
- Matrícula, quando a etapa vira Venda.
- Cadastro: `statusEnteredAt` junto do `createdAt`.

Ficam de fora: o funil Upgrade, os desfechos de contrato (cancelar, trancar, reativar e corrigir), a troca de responsável, a importação e os funis Renovações e Vencidos.

## O que não muda

- Regras do Firestore: nada a publicar. As interações aceitam campos livres, e a alteração de lead não tem lista fechada de campos.
- Leituras: nenhuma a mais. É um campo a mais por gravação.
- Texto da timeline: continua igual.

A regra fica numa função pura só (`stageChangeFields`, em `src/lib/stageMove.js`), com testes.

A PR também leva a spec do dashboard CRM e o prompt para o Claude Design, em `docs/superpowers/specs/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR aberta contra a `main`. O merge só acontece com a aprovação do Johnny.
