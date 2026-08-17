# Funil VENCIDOS na Meta Diária — design

status: ativo
data: 2026-08-17
autor: Johnny + Claude

## O problema

A Meta Diária cobra o consultor em seis funis: novos leads, visitas, aulas
experimentais, contatos, atrasados e renovações. O funil de Renovações cobra o
cliente **antes** de o contrato vencer, em marcos configuráveis (90/60/30 dias).

Depois que o contrato vence, ninguém cobra. O cliente que saiu ontem, que é
exatamente quem tem a maior chance de voltar, não aparece em lugar nenhum da
rotina do consultor. Ele só vira um número na aba Clientes com o anel cinza de
INATIVO.

Este spec cria o sétimo funil: **Vencidos**.

### O furo que apareceu na exploração

Existe hoje um campo "Tolerância depois do vencimento" (`renewalGraceDays`,
padrão 15) que, no texto da tela, mantém o cliente vencido sendo cobrado como
renovação. Ele não funciona.

Depois do flip do PR #144, a Meta carrega cliente por uma query cuja janela de
vencimento começa em `hoje - 1 dia` (`src/hooks/useRenewalClients.js`). Cliente
vencido há mais de um dia não é carregado, então a tolerância de 15 dias nunca
chega a ser avaliada. O campo promete uma cobrança que não acontece.

O funil Vencidos assume esse campo e o faz valer.

## Decisões (Johnny, 2026-08-17)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Convivência com Renovações | **Corte limpo no vencimento.** Renovações cobre só antes de vencer; a partir do vencimento é Vencidos. Ninguém aparece nos dois. |
| 2 | Período | O campo `renewalGraceDays` que já existe passa a governar o Vencidos. Sem campo novo, sem migração: o número que cada academia escolheu continua valendo. |
| 3 | Cadência | **Todo dia programado**, como Atrasados, enquanto o período durar. |
| 4 | Quem já disse "não vai renovar" antes de vencer | **Fica fora.** Respeita o que o cliente disse (`renewalDeclined`). |
| 5 | Desfechos | Três, no padrão da Renovação: Reativou, Não vai voltar, Reagendar contato. |
| 6 | Tom visual | Cinza-chumbo (slate), o mesmo do estado INATIVO na ficha. Ícone `UserX`. |
| 7 | Saída no reagendamento | Pelo `nextFollowUp` que já existe, sem campo novo de supressão. |

## Regra pura — `src/lib/expiredGoal.js` (arquivo novo)

Arquivo novo em vez de engordar `renewalGoal.js`: são duas políticas com donos
diferentes (antes e depois do vencimento), e o `renewalGoal.js` já carrega
marcos, decline e reschedule.

`shouldPromptExpired(lead, now, windowDays)` retorna `true` quando **todas**
valem:

| # | Condição | Por quê |
|---|---|---|
| 1 | `lead.lifecycleStage === 'cliente'` | funil de cliente, não de lead |
| 2 | `lead.renewalDeclined !== true` | decisão 4 |
| 3 | `deriveLeadContractStatus(lead, now) === CONTRACT_STATUS.VENCIDO` | fonte única do "venceu"; de graça exclui cancelado, trancado, agendado, ativo e a vencer, e trata legado sem vigência (retorna `null`) |
| 4 | `daysToExpiryOf(...) >= -normalizeExpiredWindowDays(windowDays)` | dentro do período |
| 5 | não existe `nextFollowUp` de hoje nem do futuro | quem tem toque marcado vive em Contatos naquele dia |

Notas de fronteira, travadas em teste:

- `endsAt` fica na meia-noite do dia final (`fromDateInputValue` devolve
  meia-noite local e `addMonths` preserva a hora), e `deriveContractStatus` vira
  VENCIDO quando `now > endsAt`. Logo o cliente entra em Vencidos às 00:00 do dia
  do `endsAt`, e o último dia de vigência é o anterior.
- `daysToExpiryOf` usa `ceil` sobre instantes, então "venceu hoje" dá `0`. A
  comparação `>= -N` cobre do dia 0 ao dia N, a mesma semântica que a tolerância
  antiga usava.
- `nextFollowUp` no **passado** não exclui: o cliente volta a Vencidos, e não
  duplica em Atrasados porque Atrasados exige `status !== 'Venda'` e cliente é
  sempre `'Venda'`.
- O rótulo da pílula usa `daysBetween` (arredonda o pulo do horário de verão):
  dia 0 = "Venceu hoje", depois "Venceu há N dias".

`normalizeExpiredWindowDays` é o `normalizeRenewalGraceDays` que já existe
(0–90, padrão 15), reexportado com o nome do novo dono.

### Corte limpo na Renovação

`shouldPromptRenewal` ganha um guard, depois dos guards de declined/cancelado/
trancado:

```
if (deriveLeadContractStatus(lead, ref) === CONTRACT_STATUS.VENCIDO) return false;
```

A comparação de `graceDays` que existe hoje na função vira código morto e sai.

### O parâmetro troca de dono, não de nome

`computeDailyGoalSlots(leads, byLead, consultantId, renewalCheckpoints, renewalGraceDays)`
mantém a assinatura. O quinto argumento passa a alimentar `shouldPromptExpired`
em vez de `shouldPromptRenewal`. Os seis lugares que chamam essa função não
mudam. No Firestore o campo segue `renewalGraceDays`.

## Fonte de dados — alargar a janela

`useRenewalClients` passa a receber o período de vencidos e a buscar
`currentContractEndsAt ∈ [hoje − (período + 1 dia), hoje + maior marco + 1 dia]`.

- O índice #4 (`lifecycleBucket ASC, currentContractEndsAt ASC`) já cobre.
  **Nada de índice novo, nada de republicar rules no console.**
- O `specKey` do hook inclui o período, para o refetch acontecer quando o gestor
  mudar o número.
- Leitura extra: só os clientes que venceram nos últimos N dias. Dezenas de
  docs, uma vez por sessão, com refetch na virada do dia.
- O cálculo da janela sai de dentro do `useMemo` e vira função pura testável. É
  exatamente ali que o furo de hoje nasceu, escondido no hook.
- `clients` (o badge âmbar "a vencer" de Clientes) não muda: filtra por
  `A_VENCER` exato, que já descarta vencido.

## UI na Meta Diária

Categoria nova:

- slug `vencido` (contrato estável, vai gravado nas interactions)
- `DAILY_GOAL_CATEGORY_LABEL.vencido = 'Contrato vencido'` (timeline e toast)
- `DG_CATEGORY_META`: `short: 'Vencidos'`, cor `slate`, ícone `UserX`
- `DG_CATEGORY_ORDER`: última posição, depois de Renovações
- `COLOR_TONES` ganha a entrada `slate`, espelhando o slate de `leadState.TONES`

Entra sem código novo, porque já é dirigido por `DG_CATEGORY_ORDER`/`_META`: aba
no cabeçalho de funis, anel segmentado de progresso, agrupamento
`pendingBySlug`, contadores, cartão com botão Concluir, e o detalhamento por
categoria no painel da Equipe (`ConsultantDayDetail`).

Precisa de código:

1. Pílula no card: **"Venceu há N dias"** em slate, na mesma linha onde os
   Atrasados mostram os dias de atraso, com o nome do plano vencido ao lado
   quando houver.
2. Ordenação do grupo: **vencido mais recente primeiro**. É o inverso dos
   Atrasados, de propósito: a chance de reativação cai a cada dia fora.
3. `handleGoalDone` roteia o slug `vencido` para o popup de desfecho.

### Popup de desfecho — variante, não arquivo novo

O `RenewalOutcomeModal` ganha `variant: 'renovacao' | 'vencido'`. A mecânica dos
três desfechos é idêntica; muda o vocabulário.

| | Renovação | Vencidos |
|---|---|---|
| Título | Renovação de contrato | Contrato vencido |
| Selo | Marco de N dias | Venceu há N dias |
| Desfecho 1 | Renovou | **Reativou** → abre o fluxo de matrícula (`mode='renovacao'`) |
| Desfecho 2 | Não vai renovar | **Não vai voltar** (motivo obrigatório) |
| Desfecho 3 | Reagendar contato | Reagendar contato (data futura + motivo) |
| categoria gravada | `renovacao` | `vencido` |

Economia de código: "Não vai voltar" grava `renewalDeclined = true`, o mesmo
campo da condição 2 da regra, que `buildMatriculaWrites` já reseta na
matrícula/reativação. E como a saída do funil vem do `nextFollowUp`, a variante
chama `renewalDecline`/`renewalReschedule` com marco `null`. Nenhum construtor
novo, nenhum campo novo no Firestore.

## Configuração

O controle do período sai de dentro do painel "Marcos de renovação"
(`src/views/settings/PaceSection.jsx:326`) e vira painel próprio em Metas &
ritmo:

> **Funil de vencidos** · ícone `UserX`
> Por quantos dias o cliente com contrato vencido continua sendo cobrado, todo
> dia, na Meta Diária. Passando disso ele sai da meta: a conversa deixa de ser
> renovação e vira reativação.
> `7 dias` · `15 dias` · `30 dias`

O painel de marcos passa a dizer que cobre só o período **antes** do
vencimento, apontando para o funil Vencidos depois disso. Sem isso fica um vão
na leitura de quem configura.

## Dois consertos incluídos no escopo (Johnny, 2026-08-17)

### 1. Tarefa de cliente concluída fica marcada como feita

Hoje o laço que mantém tarefas concluídas visíveis (`src/lib/dailyGoal.js:403`)
pula quem tem `status: 'Venda'`, ou seja, todo cliente. Resultado: o cartão de
uma renovação concluída some da tela em vez de ficar marcado, e o consultor não
vê o próprio trabalho no placar do dia.

Correção, com escopo travado nas duas categorias de cliente (`renovacao` e
`vencido`) para não tocar em nada de lead: o cliente também mantém visível a
tarefa que ele concluiu hoje.

Efeito nos números: `totalSlots` e `doneSlots` sobem juntos, então o percentual
de um dia inteiro concluído não muda e quem zerava as pendências continua
zerando. Muda o que aparece contabilizado na tela.

**Ressalva aceita:** no desfecho **Reativou** o cartão continua saindo da tela
em vez de ficar marcado, porque quem grava é o fluxo de matrícula
(`ContractModal`) e ele não sabe que foi chamado a partir da tarefa. Prender os
dois exigiria mexer no fluxo de contrato para resolver um detalhe visual. Nos
outros dois desfechos o cartão fica marcado.

### 2. Card de pendências do gestor conta as tarefas de cliente

O card de pendências de hoje na Visão Geral, para o gestor, é calculado a partir
da fatia que só tem quem está em prospecção, então as tarefas de cliente
(Renovação hoje, Vencidos depois) não entram naquele número.

Correção **cirúrgica**: só o componente do card recebe a base completa, que já
está carregada na memória para a Meta (`metaLeads` no `App.jsx`). Custo zero de
leitura no banco. Nenhum outro número daquela tela é tocado, de propósito, pelo
motivo do achado abaixo.

## Achado registrado, fora deste escopo

**Matrículas do dia podem estar zeradas na Visão Geral do gestor.** Naquele mesmo
dashboard, `computeDayFunnel` conta `matriculas` a partir da lista de leads
recebida pela tela, e para o gestor essa lista é a fatia `lifecycleBucket ==
'ativo'`. Quem matricula passa para o balde `cliente` no mesmo write, então sai
da fatia. O mesmo vale para o contador de matrículas por consultor no "Time
agora". O caminho do consultor usa `consultantLeads` (todos os próprios leads,
sem filtro de balde) e não tem o problema.

Isto é o que a leitura do código implica; **não foi confirmado ao vivo na
produção**. É o motivo de o conserto do card de pendências ficar cirúrgico:
alargar a base da tela inteira mexeria nesses números, e eles precisam de
auditoria própria com o Johnny olhando, não de uma emenda de carona.

## Testes

`src/lib/__tests__/expiredGoal.test.js` (novo). A fronteira é onde esse tipo de
regra erra, então ela fica travada:

- entra: venceu hoje; venceu há 1 dia; venceu no último dia do período
- não entra: venceu 1 dia depois do período; contrato ativo; a vencer; agendado;
  cancelado; trancado; cliente legado sem vigência gravada; lead que não é
  cliente
- não entra: `renewalDeclined === true`
- não entra: `nextFollowUp` hoje; `nextFollowUp` no futuro
- entra: `nextFollowUp` no passado
- rótulo: "Venceu hoje" no dia 0; "Venceu há N dias" depois

`src/lib/__tests__/dailyGoal.test.js` (existente):

- corte limpo: o mesmo cliente vencido sai de Renovações e aparece em Vencidos
- cliente vencido com contato marcado para hoje aparece **só** em Contatos
- conclusão carimba a interaction com a categoria `vencido`
- tarefa de cliente concluída hoje continua visível como feita (conserto 1),
  para `renovacao` e `vencido`

Janela da query: a função pura extraída do hook, testada direto.

## Riscos e rollout

**A estreia vem cheia.** No dia em que subir, todo cliente vencido nos últimos N
dias aparece de uma vez. Se a base tem meses de vencidos parados, o consultor
abre a Meta e leva um susto. O corte por período limita o estrago e quem já foi
declinado fica fora. Se o acúmulo for grande, subir com o período em **7 dias** e
aumentar depois de a lista secar.

**Cobrança diária cansa.** 30 dias × todo dia no mesmo cliente vira ruído. Os
três desfechos são a válvula: quem não volta sai com um clique e um motivo
registrado.

**Sem trabalho manual no Firebase.** Nenhum índice novo, nenhuma regra nova para
publicar no console.

## Arquivos afetados

| Arquivo | O que muda |
|---|---|
| `src/lib/expiredGoal.js` | novo — a regra pura |
| `src/lib/renewalGoal.js` | guard do corte limpo; sai o `graceDays` morto |
| `src/lib/leads.js` | categoria `VENCIDO` + label |
| `src/lib/dailyGoal.js` | meta/ordem/tom da categoria; slot de Vencidos; conserto 1 |
| `src/hooks/useRenewalClients.js` | janela alargada; cálculo puro extraído |
| `src/App.jsx` | passa o período ao hook; base do card de pendências |
| `src/views/DailyGoalView.jsx` | pílula, ordenação, roteamento do desfecho |
| `src/modals/RenewalOutcomeModal.jsx` | variante `vencido` |
| `src/views/settings/PaceSection.jsx` | painel próprio do período |
| `src/views/dashboard/DashboardOperacionalView.jsx` | base do card de pendências |
| `src/lib/__tests__/expiredGoal.test.js` | novo |
| `src/lib/__tests__/dailyGoal.test.js` | casos do corte limpo e do conserto 1 |
