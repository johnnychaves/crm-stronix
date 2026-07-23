# Meta Diária: renovação por marcos + popup de desfecho

status: ativo
data: 2026-07-23

## Problema

Hoje a categoria **Renovação** da Meta Diária (`src/lib/dailyGoal.js`) usa um
threshold único (`contractThresholdDays`, default 30): o cliente aparece enquanto
o contrato está "A vencer" dentro da janela. A ÚNICA forma de "concluir" é renovar
o contrato de fato. Se o consultor só ligou (sem renovar ainda), a tarefa **não
conclui** e o cliente **reaparece todo dia**. Bug.

## Decisões (com o Johnny)

- **Marcos configuráveis** substituem o threshold único como GATILHO da Meta
  (ex.: 90 / 60 / 30 dias antes de vencer). O cliente aparece UMA vez em cada
  marco, não todo dia.
- O status **"A vencer"** do sistema (badge/anel em ClientsView, ficha, etc.)
  continua no threshold de **30 dias** (default), separado dos marcos. Não muda.
- **Popup de desfecho** ao concluir a tarefa: Renovou / Não vai renovar /
  Reagendar (motivo obrigatório). Design = **opção 8b** do handoff
  (`scratchpad/mockup-zip/.../README-modal-renovacao.md` — seletor segmentado).
- **Perda de venda ≠ Perda do funil.** Marcar "Não vai renovar" NÃO mexe em
  `status`/estágio do funil. O cliente continua cliente até o contrato vencer;
  só sai das próximas cobranças de renovação deste contrato.

## Config (Regras gerais)

- Novo `renewalCheckpoints: number[]` no GeneralConfig (fonte junto dos outros
  settings gerais). Default `[90, 60, 30]`. UI em Regras gerais: adicionar /
  editar / remover marcos (números de dias), validando > 0 e ordenando desc.

## Modelo de dados (no doc do lead, resetam quando renova)

- `renewalHandledCheckpoints: number[]` — marcos já tratados no ciclo atual.
- `renewalDeclined: boolean` — "não renova neste ciclo".
- Reset (para `[]` / `false`) quando um novo contrato é criado — fazer em
  `buildMatriculaWrites` (lib/contracts.js) no caminho matrícula E renovação
  (novo ciclo = marcos zerados).

> **Revisão 2026-07-23 (Johnny):** o campo `renewalRescheduleAt` e o modelo de
> "suprime e reaparece em Renovações na data" foram DESCARTADOS. Reagendar
> agora manda o contato para a categoria **Contatos** (via `nextFollowUp`) e
> marca o marco atual como tratado — ver a seção Reagendar abaixo.

## Lógica da Meta (dailyGoal.js — categoria RENOVACAO)

Para cada cliente com `currentContractEndsAt`:
- `daysToExpiry = ceil((endsAt - now) / dia)`.
- Se `renewalDeclined` → não entra.
- `activeCheckpoint = min{ C ∈ renewalCheckpoints : C >= daysToExpiry }`. Se não
  existir (ainda antes do maior marco) → não entra.
- Entra na Meta se `activeCheckpoint` existe **e não está** em
  `renewalHandledCheckpoints`.
- Rótulo do marco exibido no popup = `activeCheckpoint` ("Marco de N dias").

Isso corrige o bug: concluir a tarefa muda o estado (abaixo) e ela sai da Meta,
sem reaparecer no dia seguinte; só volta no próximo marco.

## Popup (RenewalOutcomeModal) — visual = handoff 8b

Seguir `README-modal-renovacao.md` (hi-fi): cabeçalho + faixa de contexto (plano,
valor, vencimento, badge do marco), seletor segmentado (Renovou/Não vai renovar/
Reagendar), formulário condicional, rodapé com botão colorido pelo desfecho.
Grava (via lib pura, com `daily_goal_done` da categoria renovação para "concluir
hoje"):
- **Renovou** → fecha e abre a renovação existente (MatriculaModal modo
  renovação) → novo contrato reseta os campos de renovação.
- **Não vai renovar** → `renewalDeclined = true` + registra o **motivo** (texto
  livre) na timeline; **não** toca status/funil. Some dos próximos marcos.
  Adiciona `activeCheckpoint` a `renewalHandledCheckpoints`.
- **Reagendar** → grava `nextFollowUp = data escolhida` + `nextFollowUpType`
  genérico de contato (Mensagem) → o contato passa a aparecer em **Contatos**
  na Meta (não em Renovações). Marca o marco atual como tratado
  (`renewalHandledCheckpoints += activeCheckpoint`) + registra o **motivo**
  (texto livre) na timeline. **NÃO** toca status/funil. Volta a Renovações só
  no PRÓXIMO marco (ex.: 90 → 60). Como Contatos exclui `status === 'Venda'`,
  a categoria Contato passou a abrir exceção para `lifecycleStage === 'cliente'`
  (dailyGoal.js) — senão o contato reagendado do cliente sumiria.

## Arquitetura

- Regra pura e testada em `src/lib/renewalGoal.js`: `activeRenewalCheckpoint`,
  `shouldPromptRenewal(lead, now, checkpoints)`, e o builder do patch de cada
  desfecho. Testes unitários (marcos, handled, reschedule, declined, reset).
- Integração em `dailyGoal.js` (categoria RENOVACAO usa a regra nova).
- `RenewalOutcomeModal.jsx` (novo) — fino, visual do handoff 8b, usa `Dialog`/
  componentes do app.
- Config em Regras gerais (tab de Configurações Gerais) + `GeneralConfigContext`
  expõe `renewalCheckpoints`.
- `useRenewalClients`/janela: estender a janela ao maior marco (não só 30d).

## Fora de escopo

- As OUTRAS telas do handoff (Kanban 2a/2b, Aulas 4a, Visitas 5a, Todos os Leads
  6a, Clientes 7a) — pacote separado, não entram nesta entrega.

## Entrega

- 1 PR. Verificação no preview + merge com aprovação do Johnny.
