---
status: revisão
data: 2026-10-06
---

# Relatórios, entrega A: gravar o que falta

Escrita em 06/10/2026 sobre a main de hoje (commit `3885009`, merge da PR #245). Parte da [auditoria para a tela de Relatórios](../../auditoria-relatorios-2026-09-24.md) (seções 1.5, 1.7 e 6.3, com os ids R### do catálogo) e de duas leituras do código: o mapeamento de 30/09, feito sobre a main `c26832f`, e a revisão de 06/10, feita sobre a main `3885009`. O PR 0 já está aberto: [#246](https://github.com/johnnychaves/crm-stronix/pull/246), branch `claude/migracao-preserva-dono-da-epoca`, commit `7b3eb1e`.

A entrega A não cria tela. Ela faz o sistema passar a gravar, em campos opcionais e no formato que o código já usa, o que a tela de Relatórios vai ler e que hoje se perde ou é sobrescrito. Toda citação `caminho:linha` vale para a main `3885009`.

---

## 1. Objetivo e por que agora

O histórico de um dado começa no dia em que o sistema passa a gravá-lo. Quase nada do que falta se reconstrói para trás com segurança: a etapa e o dono do lead são sobrescritos, a perda some quando o lead volta, o desfecho da visita fica num espelho que o agendamento seguinte zera, a correção de contrato apaga o valor de antes. Cada semana sem gravar é uma semana a menos de série no primeiro relatório que sair.

O módulo do professor tornou isso urgente. Desde 05/10 o `set-role` recusa transformar em professor quem tem qualquer lead (`api/admin-users.js:369-375`), e o gestor passa a carteira pelo Migrar leads. Até o PR 0, cada migração relia a coleção inteira de interações e trocava o dono em todas as interações dos leads movidos, de qualquer data (`src/views/settings/TransferLeadsTab.jsx:155-168`). Com o módulo ligado na STRONIX, a primeira migração feita para trocar alguém de papel apagaria quem era o responsável na época de todo o histórico da pessoa, sem volta.

O que a entrega A faz:

- grava campos novos em escritas que já existem, sem mudar texto gravado nem leitor, salvo as proteções escritas em cada PR;
- cria só duas coleções, a da foto diária e a do registro de exclusão e exportação, com regra publicada antes do deploy;
- não cria função na Vercel (seguem 11 das 12) e não pede deploy no Stronizap;
- não preenche o passado. Todo leitor trata campo ausente como "sem registro".

## 2. Decisões que esta spec segue

Decisões do Johnny, todas fechadas. As de 21 a 24 vieram em 06/10, nas respostas aos quatro pontos que a primeira versão desta spec deixava em aberto.

| # | Decisão | O que muda no que é gravado |
|---|---|---|
| 1 | Relatórios abertos para todos os papéis, e todos exportam | A foto diária é legível por qualquer membro (PR 8). Toda exportação, de qualquer papel, deixa registro sem travar o download (PR 10). |
| 2 | Matrícula oficial é o contrato criado. Crédito por pessoa é do dono do lead no dia do fato | O `leadConsultantId` da interação deixa de ser regravado (PR 0) e ganha o nome ao lado (PR 1b). Documento de estado grava o dono do dia em `<fato>ConsultantId/Name`. O contrato já grava o dono do lead na venda (`src/lib/contracts.js:442-444`). |
| 3 | Toda perda do período conta, mesmo que o lead volte. Marcar perda de novo só para trocar o motivo é correção da primeira | A perda vira evento com `lossReason` e `lossReasonId` (PR 4). Num lead que já está em Perda, o evento leva `lossCorrection: true`, o leitor futuro conta só a primeira e o lead mantém o `lostAt` dela (decisão 22). |
| 4 | Tipo da venda sai do fato, e nenhum campo de tipo entra no contrato | O PR 6 grava fatos (etapa do Upgrade, modalidades, professor) e nenhum campo de tipo de venda. O leitor decide renovação, retorno, upgrade ou matrícula nova. |
| 5 | Contato é só conversa registrada. Evento novo de quadro não mexe em `lastInteractionAt` nem em `interactionsCount`. Upgrade e contrato ficam como estão | Os eventos de quadro de Renovações e Vencidos gravam sem a soma no lead (PR 5). Pela mesma regra, a troca de professor também não soma (PR 1). Os leitores de contato ignoram esses eventos. |
| 6 | Mês fechado recalcula sempre. A correção de contrato guarda o valor anterior | `editHistory` no contrato, com o que havia antes em cada campo (PR 6). Nada é congelado. |
| 7 | Meta de mês passado é a que valia na época. Histórico do turno fica fora | `rulesHistory` na configuração e `dailyVolumeTargetHistory` no cadastro de cada pessoa (PR 7). Turno não entra. |
| 8 | Passe livre em dias ou em aulas conforme a modalidade é a entrega D | O PR 3a só copia `trialClassesPlanned` para o registro do agendamento. |
| 9 | Arquivar em vez de excluir é a entrega E | O PR 10 registra a exclusão. A exclusão continua apagando as interações do lead. |
| 10 | A migração para de regravar o dono nas interações antigas. Ninguém foi migrado nem virou professor desde 30/09 | PR 0 (#246). Não há histórico a reparar. O PR 1 passa a gravar um registro por lote. |
| 11 | Foto diária é "como a academia amanheceu", tirada pelo navegador no primeiro acesso do dia. Domingo sem foto é aceito. Rotina noturna fica para depois | Um documento por dia, criado uma vez, em `stronix_daily_snapshots` (PR 9). |
| 12 | Marca "feito pelo suporte" quando a sessão é do Acessar como (`appUser.impersonating`), gravada só quando for true | `impersonated: true` em evento e `<fato>ByImpersonated: true` em documento de estado, sempre junto de um autor. Gravação sem autor (a marca da Agenda de hoje) não leva a marca. Ausente quer dizer sessão comum. |
| 13 | O contrato congela o professor do dia da venda, e cada troca de professor no cadastro do cliente deixa registro com de/para | `professorId` e `professorName` no contrato (PR 6). Interação com `professorChange: true` e de/para a cada troca no cadastro completo (PR 1), que aparece na linha do tempo da ficha (decisão 23). "Cadastro" é o cadastro completo da ficha: o carimbo do professor da aula que converteu num lead sem professor (`src/lib/aulasWrites.js:188-193`) e o preenchimento pela importação são a primeira atribuição e não contam como troca; o carimbo que troca um professor por outro conta (decisão 24). |
| 14 | A ficha do cliente passa a mostrar os movimentos no quadro de Vencidos e as recusas (e voltas) feitas nos quadros | Os eventos do PR 5 são interações e entram na linha do tempo. Com a troca de professor (decisão 23, PR 1), são as linhas novas da ficha nesta entrega. |
| 15 | Motivo da recusa do Upgrade continua na lista de motivos de perda, com id e nome | `upgradeDeclineReason` e `upgradeDeclineReasonId`, do mesmo modal da perda (PR 5, com o id que o PR 4 faz o modal devolver). |
| 16 | Visita remarcada guarda quem agendou da primeira vez e quem remarcou por último | `scheduledBy*` na criação do registro e `rescheduledBy*` a cada vez que ele é movido para outro instante (PR 3a). |
| 17 | Visita sem desfecho adiada continua sendo remarcação: o próximo agendamento move o registro | O reaproveitamento do registro aberto fica como está. O movimento grava `rescheduledBy*`. |
| 18 | Desfecho marcado e reagendado no mesmo dia e horário faz nascer registro novo | O PR 3b tira a exceção de mesmo instante de `rescheduleRecordPlan` (`src/lib/aulas.js:72` e `75`). |
| 19 | O registro de quem excluiu lead ou exportou lista é lido só pelo gestor e pelo super-admin | Regra de leitura de `stronix_audit_log` (PR 8). |
| 20 | O passado não é preenchido nesta entrega. Scripts de acerto, em modo de conferência e com o ok do Johnny, ficam fora | Cada dado ganha uma constante de início em `src/lib/crm/scope.js`. Nenhum PR traz script. |
| 21 | Visita cancelada que não gerou novo agendamento fica como cancelada | O Cancelou de visita fecha o registro em `stronix_aulas` na hora, com `status: 'cancelled'`, `outcomeAt`, `outcomeBy*` e `outcomeConsultant*`, pelas regras de desempate do PR 3b. O Remarcou continua movendo o registro. O agendamento feito depois de um Cancelou abre registro novo. |
| 22 | Perda marcada de novo pode ser corrigida, e a correção fica no mês da primeira perda | Num lead que já está em Perda, o patch do lead não regrava `lostAt`. O motivo novo é gravado e o evento leva `lossCorrection: true` (PR 4). |
| 23 | A troca de professor aparece na linha do tempo da ficha, como a troca de responsável | `professorChange` cai no balde `'status'`, o mesmo da troca de responsável: entra em Marcos, aparece com o interruptor de Sistema desligado, leva o tipo Professor (a troca de responsável leva o tipo Responsável desde o PR #248) e nunca vira evento de contrato pelo `CONTRACT_RE` (PR 1). Continua sem somar `lastInteractionAt` nem `interactionsCount` e fora de contato. |
| 24 | A primeira atribuição de professor não conta como troca | O carimbo do professor da aula que converteu (`src/lib/aulasWrites.js:188-193`) num lead sem professor, ou com o mesmo, e o preenchimento pela importação (`src/lib/clientImport.js:419-421` e `661`) não gravam `professorChange`. Quando o carimbo troca um professor por outro (lead que ganhou professor no cadastro completo antes da matrícula, ou ex-cliente que volta e cuja última aula atendida é antiga), é troca pela decisão 13 e grava `professorChange` com `via: 'conversion'` (PR 1). O contrato congela o professor de cada venda (PR 6). |

## 3. Convenção de nomes e formato de evento

### Quem é quem

Depois da #243 existem três pessoas possíveis para o mesmo fato. Cada uma tem nome próprio, e o relatório nunca soma uma pelo campo da outra.

| Papel | Em interação | Em documento de estado | Quem soma por ele |
|---|---|---|---|
| Dono do lead no dia do fato | `leadConsultantId` (existe) e `leadConsultantName` (novo, PR 1b) | `<fato>ConsultantId` e `<fato>ConsultantName` | Perda, cadastro, venda, comparecimento por pessoa (decisão 2) |
| Dono da tarefa da Meta | `goalOwnerId` (existe, #243 e #245) e `goalOwnerName` (novo, PR 1b) | `appointmentOwnerId` e `appointmentOwnerName` | A Meta Diária e a tarefa feita |
| Autor, quem clicou | `actorId`, `actorAuthUid` e o nome em `consultantName` (como hoje) | `<fato>ById`, `<fato>ByAuthUid` e `<fato>ByName` | Produção por pessoa, quem marcou, quem remarcou |

O contrato e o registro de `stronix_aulas` continuam com `consultantId`, que já é o dono do lead de quando eles nasceram. No registro, o `appointmentOwnerId` é sempre o dono efetivo da tarefa (o consultor que recebeu a delegação ou, sem ela, o dono do lead naquele instante), e não segue o sentido do lead, em que null quer dizer "o dono do lead".

Lead sem dono é caso à parte. A função central põe no `leadConsultantId` o id de quem clicou (`src/lib/leads.js:351-354`), e essa reserva fica (seção 6). Para o relatório não creditar o autor como dono, a interação desse lead leva `leadUnowned: true`, só quando for true, e `leadConsultantName` null. Sem a marca, `leadConsultantName` null quer dizer só que o lead tinha dono sem nome gravado, e o relatório resolve o nome pelo id.

### Regras de formato

1. Campos e valores em inglês, no vocabulário que o código já usa. Texto de interação em português. Nenhum texto que já existe muda, porque a ficha e o CRM leem alguns pelo começo da frase.
2. Todo id de pessoa novo leva o nome da época ao lado. O relatório junta por id e usa o nome gravado só quando a pessoa saiu da equipe. Interação com `leadUnowned: true` não dá crédito de dono a ninguém, mesmo com `leadConsultantId` preenchido.
3. Mudança de A para B usa `from` e `to`. Etapa de lead continua com `fromStatus`, `toStatus` e `funnelId`, que é o que o CRM lê. Funil de cliente usa `clientFunnel`, `clientFunnelEvent`, `fromStageId`, `fromStageName`, `toStageId` e `toStageName`, e nunca `fromStatus`, `toStatus` nem `funnelId`. Dono usa `fromConsultantId/Name` e `toConsultantId/Name`. Professor usa `fromProfessorId/Name` e `toProfessorId/Name`.
4. Motivo: `<x>Reason` é o nome como estava na hora. Quando o catálogo é editável, vai junto `<x>ReasonId`, null para o item `default` do catálogo vazio (`src/modals/LossReasonModal.jsx:8`). Lista fixa do código fica só com o nome.
5. Caminho de entrada: `<fato>Via`, com valores curtos. No lead, `createdVia`: `'manual'`, `'referral_manual'`, `'referral_link'`, `'stronizap'`, `'import'`. Na interação, `via`: `'stronizap'` (já existe, `ZAP_VIA` em `src/lib/leads.js:222`), `'board'`, `'daily_goal'` e `'profile'`.
6. Referência a contrato em interação: `contractId`. Lote: `<coisa>BatchId`, como `importBatchId` e o novo `transferBatchId`.
7. Data do evento: `createdAt` com `serverTimestamp()`. Item de lista não aceita `serverTimestamp()`, então leva `changedAt` com a hora do aparelho, e o `updatedAt` do servidor continua no documento.
8. Item de lista de histórico: `{ changedAt, actorId, actorAuthUid, actorName, from, to }`, mais o que identifica a coisa (`rule` no `rulesHistory`, `kind` no `editHistory`). Nome da lista: `<coisa>History`.
9. Suporte: `impersonated: true` em evento (interação, item de lista, foto, registro) e `<fato>ByImpersonated: true` em documento de estado. Só quando for true, e só ao lado de um autor: a marca da Agenda de hoje, gravada sem `actorId`, não leva.
10. Campo novo é opcional para quem lê. Ausente quer dizer "sem registro", nunca zero nem falso. Nada vai como `undefined`, que o Firestore recusa: o que não existe vira null, lista vazia ou chave omitida.
11. Evento novo se reconhece por um campo próprio (`toConsultantId`, `transferBatchId`, `professorChange`, `lossReason`, `clientFunnel`, `contractEvent`), nunca pelo texto nem só pelo `type`. O `type` continua o de hoje (`status_change` ou `note`). O campo diz o que o evento é, não se ele é contato: dos eventos novos, só a troca de professor e o `status_change` com `clientFunnel` igual a `'renewal'` ou `'expired'` ficam fora de contato (`isNonContactEvent`, PRs 1 e 5). A nota da Meta Diária com `clientFunnel` continua sendo contato e somando no lead, como hoje.
12. Uma função pura por tipo de evento, no molde de `stageChangeFields` (`src/lib/stageMove.js:51-60`), com teste em node e uma varredura por chamada no CI.

### Exemplos

Valores sintéticos.

Perda de lead, depois dos PRs 1b e 4, em `stronix_interactions`:

```js
{
  leadId: 'L7', leadName: 'Paula Reis',
  type: 'status_change', text: 'Lead perdido. Motivo: Preço',
  fromStatus: 'Negociação', toStatus: 'Perda', funnelId: 'f-com',
  lossReason: 'Preço', lossReasonId: 'lr-03',
  consultantName: 'Bruno Lima', actorId: 'u-bruno', actorAuthUid: 'auth-bruno',
  leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana', leadConsultantName: 'Ana Souza',
  createdAt: serverTimestamp()
}
```

Troca de responsável pela ficha (PR 1). O texto é o de hoje:

```js
{
  leadId: 'L7', type: 'status_change',
  text: 'Responsável alterado de [Ana Souza] para [Bruno Lima].',
  fromConsultantId: 'u-ana', fromConsultantName: 'Ana Souza',
  toConsultantId: 'u-bruno', toConsultantName: 'Bruno Lima',
  consultantName: 'Carla Dias', actorId: 'u-carla', actorAuthUid: 'auth-carla',
  leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana',
  createdAt: serverTimestamp()
}
```

Registro de um lote da migração (PR 1), sem `leadId`:

```js
{
  type: 'note',
  text: 'MIGRAÇÃO: 400 lead(s) de [Ana Souza] para [Bruno Lima] (leads em aberto, clientes ativos).',
  transferBatchId: 'tb-5f2c9a',
  fromConsultantId: 'u-ana', fromConsultantName: 'Ana Souza',
  toConsultantId: 'u-bruno', toConsultantName: 'Bruno Lima',
  leadIds: ['L1', 'L2', 'L3'],
  consultantName: 'Carla Dias', actorId: 'u-carla', actorAuthUid: 'auth-carla',
  createdAt: serverTimestamp()
}
```

Campos de criação no lead (PR 2), num cadastro pelo Stronizap em que o gestor escolheu outra consultora:

```js
{
  createdById: 'u-carla', createdByAuthUid: 'auth-carla', createdByName: 'Carla Dias',
  createdVia: 'stronizap',
  createdConsultantId: 'u-ana', createdConsultantName: 'Ana Souza'
}
```

Registro de visita em `stronix_aulas`, depois dos PRs 3a e 3b. O `scheduledFor` é data (vira `Timestamp`, como hoje), e `rescheduledAt` e `outcomeAt` são a hora do servidor:

```js
{
  type: 'visita', leadId: 'L7', status: 'attended', scheduledFor: new Date('2026-10-30T18:00:00-03:00'),
  consultantId: 'u-ana', consultantAuthUid: 'auth-ana', consultantName: 'Ana Souza',
  scheduledById: 'u-bruno', scheduledByAuthUid: 'auth-bruno', scheduledByName: 'Bruno Lima',
  rescheduledById: 'u-carla', rescheduledByAuthUid: 'auth-carla', rescheduledByName: 'Carla Dias',
  rescheduledAt: serverTimestamp(),
  appointmentOwnerId: 'u-bruno', appointmentOwnerName: 'Bruno Lima',
  trialClassesPlanned: null,
  outcomeAt: serverTimestamp(),
  outcomeById: 'u-dani', outcomeByAuthUid: 'auth-dani', outcomeByName: 'Dani Rocha',
  outcomeConsultantId: 'u-ana', outcomeConsultantName: 'Ana Souza'
}
```

Movimento no quadro de Vencidos (PR 5):

```js
{
  leadId: 'L9', type: 'status_change',
  text: 'Vencidos: movido para a etapa Proposta enviada.',
  clientFunnel: 'expired', clientFunnelEvent: 'move',
  fromStageId: 'st-entrada', fromStageName: 'Primeiro contato',
  toStageId: 'st-proposta', toStageName: 'Proposta enviada',
  renewalCheckpoint: null, contractId: 'k-118', via: 'board',
  consultantName: 'Bruno Lima', actorId: 'u-bruno', actorAuthUid: 'auth-bruno',
  leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana', leadConsultantName: 'Ana Souza',
  createdAt: serverTimestamp()
}
```

Item de `editHistory` no contrato (PR 6), feito pelo suporte:

```js
{
  changedAt: new Date('2026-10-20T13:05:00-03:00'),
  actorId: 'u-gestor', actorAuthUid: 'auth-gestor', actorName: 'Marcos Prado',
  impersonated: true,
  kind: 'correcao',
  from: { value: 1788, planName: 'Flow' },
  to: { value: 1908, planName: 'Flow Plus' }
}
```

### Data de início de cada dado

Cada PR acrescenta a sua constante em `src/lib/crm/scope.js`, no molde de `STAGE_TRACKING_SINCE` (`src/lib/crm/scope.js:17`). É por ela que o leitor futuro sabe de quando em diante o campo existe e mostra "sem base" antes disso. Esse arquivo importa `src/lib/operacional/routine.js`, que chega a `src/lib/dailyGoal.js`, então só o navegador lê as constantes.

A hora do deploy só existe depois do merge, e nada vai direto para a main. A regra é uma só:

- a constante entra no próprio PR com a meia-noite de Brasília do dia seguinte ao merge previsto. A folga de um dia cobre o deploy e as abas abertas com o código antigo;
- se o merge escorregar, o PR seguinte da entrega acerta a data. Nesta entrega ninguém lê as constantes, então dá tempo de acertar todas antes da tela de Relatórios;
- antes da constante, o leitor mostra "sem base". Depois dela, campo ausente num documento quer dizer "sem registro" naquele documento.

A marca do suporte segue a mesma regra campo a campo: cada `impersonated` e cada `<fato>ByImpersonated` vale desde a constante do PR que o grava. O PR 0 já está aberto e só tira código. A constante dele entra no PR 1 com a data real do deploy do PR 0, que é a regra do "PR seguinte acerta".

| Constante | Dado | Entra no |
|---|---|---|
| `LEAD_OWNER_KEPT_SINCE` | `leadConsultantId` deixa de ser regravado pela migração | PR 1, com a data do deploy do PR 0 |
| `OWNER_CHANGE_TRACKING_SINCE` | de/para de dono e de professor, registro de lote | PR 1 |
| `OWNER_NAMES_TRACKING_SINCE` | `leadConsultantName`, `leadUnowned`, `goalOwnerName` e `impersonated` nas interações da função central | PR 1b |
| `LEAD_CREATION_TRACKING_SINCE` | `created*` no lead (o corte é pela presença dos campos, não pelo `createdAt` do lead; ver PR 2) | PR 2 |
| `APPT_BOOKING_TRACKING_SINCE` | `scheduledBy*`, `rescheduledBy*`, `appointmentOwner*` e `trialClassesPlanned` no registro | PR 3a |
| `VISIT_OUTCOME_ON_RECORD_SINCE` | desfecho gravado na hora no registro, inclusive o Cancelou de visita | PR 3b |
| `LOSS_EVENT_TRACKING_SINCE` | `lossReason`, `lossReasonId` e `lossCorrection` no evento, e o `lostAt` mantido na correção | PR 4 |
| `CLIENT_FUNNEL_EVENTS_SINCE` | eventos dos funis de cliente | PR 5 |
| `CONTRACT_HISTORY_SINCE` | campos novos do contrato | PR 6 |
| `RULES_HISTORY_SINCE` | histórico das réguas | PR 7 |
| `DAILY_SNAPSHOT_SINCE` | foto diária | PR 9 |
| `AUDIT_LOG_SINCE` | registro de exclusão e exportação | PR 10 |

---

## 4. Os PRs

### PR 0 (#246, aberto). A migração deixa de regravar o dono

#### O que passa a ser gravado

Nada novo. A migração de carteira para de reler a coleção inteira de interações e de trocar `leadConsultantId` e `leadConsultantAuthUid` nas interações antigas dos leads movidos. O dono gravado em cada interação passa a ser, para sempre, o do dia do fato.

#### Caminhos que gravam esse fato hoje

- Configurações → Migrar leads: `src/views/settings/TransferLeadsTab.jsx:155-168` relê a coleção e regrava os dois campos. É o único lugar que regrava o dono numa interação já criada.

#### Arquivos

O commit `7b3eb1e` muda `src/views/settings/TransferLeadsTab.jsx` (apaga 155-168 e troca o texto da confirmação), cria `src/lib/__tests__/donoDaEpoca.sweep.test.js` e acrescenta uma linha às convenções do `CLAUDE.md`.

#### O que muda e o que não muda na tela

A confirmação da migração deixa de dizer "com as interações vinculadas" e passa a dizer que o histórico continua na ficha e que o que já foi feito continua com quem era o responsável na época. A ficha não muda, porque lê a linha do tempo pelo id do lead. O Operacional muda num caso só, já aprovado: a marca da Agenda de hoje, gravada sem autor (`src/lib/appointmentOutcome.js:120-133`), conta para quem era o dono quando foi marcada, e não para quem recebeu a carteira depois. O único leitor do campo é a reserva de autor `interactionOwnerAuthUid` (`src/lib/dailyGoal.js:101-102`).

#### Testes

A varredura nova confere que a tela não cita os dois campos nem relê a coleção, e que só `src/lib/leads.js`, `src/lib/clientImportWrites.js` e `api/tenant-resolve.js` gravam essas chaves. Nada quebra.

#### Regra e índice

Nenhum. A migração deixa até de depender da regra de atualização de interação (`firestore.rules:240-242`).

#### Dependências e ordem

Nenhuma. Entra primeiro. Quem for migrar carteira ou transformar alguém em professor recarrega a página antes, porque aba aberta com o código antigo continua regravando.

#### Riscos

Aba antiga, já dito. A divergência entre a Meta e o Operacional na visita delegada marcada pela Agenda (a Meta credita pelo `goalOwnerId`, `src/lib/leads.js:175-178`; o Operacional, pelo dono do lead) já existe e não muda.

#### Relatórios que destrava

É a base do crédito pelo dono no dia (decisão 2) em todo relatório por pessoa: R006, R021, R022, R099, R100, R117, R119, R133 e os outros listados no PR 1.

---

### PR 1. Trocas com de/para

#### O que passa a ser gravado

Três fatos, todos em `stronix_interactions`.

1. Migração de carteira, um registro por lote. Cada lote de até 400 leads ganha uma interação no mesmo `writeBatch` que troca o dono deles: `type: 'note'`, o texto de hoje (`MIGRAÇÃO: N lead(s) de [X] para [Y] (escopos).`, com N do lote), `consultantName`, `actorId`, `actorAuthUid`, `createdAt`, mais `transferBatchId` (um id por migração, igual em todos os lotes, no molde do `importBatchId` de `src/views/settings/ImportClientsSection.jsx:41` e `279`), `fromConsultantId`, `fromConsultantName`, `toConsultantId`, `toConsultantName`, `leadIds` (os ids do lote) e `impersonated: true` quando for o caso. Sem `leadId`, sem `volumeKind` e sem `dailyGoalCategory`, para ficar fora da Meta, do volume, das tarefas do Operacional, do primeiro contato do CRM e da linha do tempo. O `fromConsultantName` de consultor excluído é o `consultantName` gravado nos leads, sem o sufixo "(excluído)" que a tela acrescenta (`src/views/settings/TransferLeadsTab.jsx:78`). O registro só no fim (`TransferLeadsTab.jsx:170-177`) sai.
2. Troca de responsável pela ficha. A interação `status_change` que já existe ganha `fromConsultantId`, `fromConsultantName`, `toConsultantId` e `toConsultantName`. O "de" é null quando o lead não tinha dono, e nunca o rótulo `'sem responsável'` de `src/lib/clientRegistration.js:147`. O texto não muda: o CRM reconhece a troca pelo começo dele (`src/lib/crm/contact.js:11-12`).
3. Troca de professor no cadastro completo (decisões 13 e 23). Interação `status_change` nova, no mesmo lote que grava o cadastro: `professorChange: true`, `fromProfessorId`, `fromProfessorName`, `toProfessorId`, `toProfessorName`, com um texto sem colchetes e sem as palavras que a ficha lê ("Professor alterado de Carla Mendes para Diego Alves.", "Professor definido: Diego Alves." ou "Professor removido, era Carla Mendes."). Ela aparece na linha do tempo da ficha, no mesmo balde da troca de responsável (ver `src/lib/timeline.js` em Arquivos). Ela não soma `lastInteractionAt` nem `interactionsCount` no lead e não conta como contato (decisão 5). Se o mesmo salvar trocar dono e professor, saem as duas interações, e só a do dono soma, como hoje. A primeira atribuição de professor não é troca e não grava interação (decisão 24).

#### Caminhos que gravam esse fato hoje

- Migrar leads: `src/views/settings/TransferLeadsTab.jsx:120-189`. Busca os leads pelo `consultantId` (133-139), troca os três campos de dono em lotes de 400 pelo `commitOpsInChunks` (146-153, que só faz `update`, `src/lib/funnels.js:42-52`), regrava as interações antigas (155-168, que o PR 0 tira) e grava a nota sem `leadId` (170-177). Não carimba `consultantChangedAt` nem mexe nos donos de tarefa.
- Ficha, campo Responsável do cadastro: `src/modals/ClientRegistrationModal.jsx:125-160`, com o patch em `src/lib/clientRegistration.js:103-113` e a troca em `142-156`. Com troca, grava pelo `logInteraction` (`ClientRegistrationModal.jsx:137-146`), com o lead de antes, então o `leadConsultantId` da interação já é o dono anterior.
- Ficha, professor do cadastro: `src/lib/clientRegistration.js:75-77` põe `professorId` e `professorName` no patch, que vai pelo `updateDoc` sem rastro (`ClientRegistrationModal.jsx:148`) ou junto com a troca de dono.
- Ficam fora deste PR, por não serem troca no cadastro: o Stronizap que faz nascer o lead com outro dono (`api/_zapLead.js:354-361` e `389-421`, que é nascimento), a importação que dá dono a lead sem dono (`src/lib/clientImport.js:624-626`), o carimbo do professor da aula que converteu num lead sem professor ou com o mesmo (`src/lib/aulasWrites.js:188-193`, que o PR 6 passa a gravar no contrato) e o preenchimento de professor pela importação (`src/lib/clientImport.js:661` no lead novo e `419-421` no lead sem professor), que são a primeira atribuição e não contam como troca (decisão 24), e o script `scripts/fix-consultant-ownership.js`.
- Carimbo da matrícula que troca um professor por outro (decisão 24): o `markConvertingAula` (`src/lib/aulasWrites.js:188-193`) regrava o professor do lead mesmo quando ele já tem outro. Nesse caso, e só nesse, ele grava a mesma interação da troca pelo cadastro, montada pela mesma função pura, com `via: 'conversion'` e `{ bump: false }`.

#### Arquivos

- `src/lib/walletTransfer.js` (novo, puro): corta os ids em lotes de 400 e monta o registro de cada lote.
- `src/views/settings/TransferLeadsTab.jsx`: um `writeBatch` por lote, com os updates dos leads e o `set` do registro (401 operações no máximo, abaixo das 500 do Firestore). `SCOPES` e o filtro `isSeller` continuam no arquivo, porque `src/lib/__tests__/teamRoles.test.js:149-157` e `src/lib/__tests__/acessoSweep.test.js:66` leem a tela.
- `src/lib/clientRegistration.js`: `ownerChangeFields(lead, patch)`, com os valores crus do lead, e `professorChangeFor(lead, patch)`, `professorChangeFields(change)` e `professorChangeNote(change)`.
- `src/lib/interactions.js`: o corpo da interação (`interactions.js:30-43`) vira uma função exportada, e a soma no lead (`lastInteractionAt` e `interactionsCount`, 45-53) sai de um helper com a opção `{ bump: false }`. O `logInteraction` ganha já aqui um sexto parâmetro de opções com esse `bump`. É o único jeito de gravar interação sem somar no lead: o gravador do cadastro usa os dois e o PR 5 só reaproveita.
- `src/lib/clientRegistrationWrites.js` (novo): um `writeBatch` com o lead, a interação da troca de dono (com a soma no lead, como hoje) e a da troca de professor (com `{ bump: false }`).
- `src/modals/ClientRegistrationModal.jsx`: o `handleSave` passa a chamar o gravador novo.
- `src/lib/aulasWrites.js`: o `markConvertingAula` compara o professor do lead com o da aula que converteu e, quando são pessoas diferentes e o lead já tinha professor, grava a troca com `professorChangeFor` e `via: 'conversion'`.
- `src/lib/leads.js`: `isNonContactEvent(i)`, que começa reconhecendo `professorChange` e é usado em `hasActiveInteractionToday` (`src/lib/leads.js:234-247`). O PR 5 acrescenta os eventos de quadro.
- `src/lib/crm/contact.js`: `isContactInteraction` (`contact.js:18-23`) ignora o que `isNonContactEvent` reconhece.
- `src/lib/leadStatus.js`: `buildInteractionIndex` (71-82) pula o que `isNonContactEvent` reconhece. É dele a data de último contato que o selo de dias sem contato do card do Pipeline e o filtro "Apenas quentes" da lista de Leads usam, pelo máximo com o `lastInteractionAt` do lead (`lastInteractionDateOf`, 94-100; `src/views/KanbanView.jsx:429` e `613`, `src/views/LeadsView.jsx:90`, `100` e `357`). Sem isso, a interação que não soma no lead entraria pelo índice. O arquivo já importa `src/lib/leads.js`.
- `src/lib/timeline.js`: em `classifyInteraction` (`timeline.js:177-215`), `status_change` com `professorChange` devolve `'status'` antes do `CONTRACT_RE` (linha 199), por uma regra pelo campo, como a do `'import'` (linha 190). `'status'` é o balde em que a troca de responsável já cai (linha 205), e a regra própria antes do `CONTRACT_RE` garante que um nome de professor que case com ele nunca vire evento de contrato (decisão 23). O balde entra no filtro Marcos (`TIMELINE_FILTERS`, 221-227) e aparece com o interruptor de Sistema desligado. O `timelineTypeLabel` (242-254) devolve "Professor" para o `status_change` com `professorChange`, no molde do "Responsável" que o PR #248 deu à troca de responsável (`isOwnerChangeText`).
- `src/views/LeadProfileView.jsx:1002`: o `isLoss` ignora `professorChange`, para um nome de professor não pintar a faixa de perda.
- `src/lib/crm/scope.js`: `LEAD_OWNER_KEPT_SINCE` e `OWNER_CHANGE_TRACKING_SINCE`.

#### O que muda e o que não muda na tela

Muda, pela decisão 23: a troca de professor ganha uma linha na linha do tempo da ficha, no mesmo balde e filtro da troca de responsável, com o tipo Professor. Ela aparece em Tudo e em Marcos com o interruptor de Sistema desligado. Como o texto não tem colchetes, a ficha a desenha como linha simples, sem chip de etapa (`src/views/LeadProfileView.jsx:991` e `1066`), e ela não muda a origem nem a duração da mudança de fase seguinte (`buildStageTransitions`, `src/lib/timeline.js:269-290`, que só segue evento com etapa entre colchetes). A troca de responsável já aparece assim desde o PR #248, em produção desde 06/10/2026: linha própria com o tipo Responsável, sem chip e fora da cadeia de fases.

Não muda: a tela de Migrar leads, a confirmação (já trocada no PR 0), a linha da troca de responsável na ficha, o "último contato" e o selo de dias sem contato.

#### Testes

- Rodam sem edição: `teamRoles.test.js`, `acessoSweep.test.js` e `donoDaEpoca.sweep.test.js`. O registro de lote não usa `leadConsultantId`, então a varredura do PR 0 segue certa.
- `walletTransfer.test.js` (novo): zero ids não gera lote; 401 ids viram lotes de 400 e de 1; cada registro leva só os ids do seu lote, o mesmo `transferBatchId`, de/para com id e nome e o autor; nunca `leadId`, `volumeKind` nem `dailyGoalCategory`; consultor excluído sai sem "(excluído)"; `impersonated` só quando for true; nada `undefined`.
- `clientRegistration.test.js`: `ownerChangeFields` com e sem dono anterior; `professorChangeFor` de nenhum para um, de um para outro, de um para nenhum, e null sem troca; os textos de hoje iguais.
- `clientRegistrationWrites.test.js` (novo, com o Firestore falso de `contractsWrites.test.js`): de uma a três gravações no lote; soma no lead só com troca de dono.
- `interactions.test.js` (novo, com o mesmo Firestore falso): o `logInteraction` sem opções soma como hoje, e com `{ bump: false }` grava o patch sem `lastInteractionAt` nem `interactionsCount`.
- `leads.test.js`, `crm.contact.test.js`, `leadStatus.test.js` e `timeline.test.js`: a troca de professor não é contato, não acende "Já interagido hoje", não entra no índice de último contato e cai em `'status'`, como a troca de responsável, mesmo com um nome que case com o `CONTRACT_RE`; leva o tipo Professor; o filtro Marcos a aceita; ela não muda a origem da mudança de fase seguinte em `buildStageTransitions`.
- Varredura por chamada: todo arquivo que chama `ownerChangeFor` espalha `ownerChangeFields`, e todo que monta o patch do cadastro chama `professorChangeFor` (hoje, só `ClientRegistrationModal.jsx`). A chave `professorChange` só é montada em `src/lib/clientRegistration.js` (`professorChangeFor`), que o cadastro completo e o `markConvertingAula` chamam; a importação nunca a grava (decisão 24).
- `aulasWrites.test.js`: o `markConvertingAula` grava a troca com `via: 'conversion'` quando o lead tinha outro professor, e não grava nada quando o lead estava sem professor ou já tinha o mesmo. A tela de Migrar leads chama a função do lote e não tem `addDoc` solto.
- `operacional.routine.test.js`, no bloco de 127-158: o caso "o lead já é de outro consultor, e a marca da Agenda, sem autor, fica na linha do dono antigo", que documenta o efeito aprovado no PR 0.
- Na mão, numa academia de teste: migrar 2 leads e conferir o registro de lote; trocar responsável e professor pela ficha e ver a linha da troca de professor em Marcos, com o interruptor de Sistema desligado.

#### Regra e índice

Nenhum. A criação de interação aceita qualquer campo de membro que não seja professor (`firestore.rules:238-239`). A atualização do lead segue o `ownerFieldsMoveTogether` (`firestore.rules:209-212` e `223-225`), que os dois caminhos já respeitam. Leitura futura por `toConsultantId` ou `leadIds` (`array-contains`) usa o índice automático. O índice de `leadConsultantAuthUid` com `createdAt` (`firestore.indexes.json:128`) fica.

#### Dependências e ordem

Depois do merge do PR 0. Corre junto com 2, 3a, 4, 6 e 7.

#### Riscos

- A migração não mexe nos donos de tarefa: visita e contato que a pessoa de origem pegou em leads de colegas continuam com ela até ela ser excluída ou virar professor (`api/admin-users.js:57-76`).
- A exclusão de lead apaga as trocas junto com as interações (`src/views/LeadProfileView.jsx:238-249`). O PR 10 registra a exclusão; arquivar é a entrega E.
- O registro de lote leva até 400 ids, uns 8 KB, e entra na assinatura das interações do mês (`src/App.jsx:720`), que todo logado recebe.
- Lote que falha no meio deixa a migração parcial, mas cada lote gravado tem o seu registro, e o `transferBatchId` mostra onde parou.

#### Relatórios que destrava

Troca de responsável: R006, R021, R022, R069, R099, R100, R101, R117, R119, R120, R133, R138 e R157. Troca de professor: parte de R076.

---

### PR 1b. Nome do dono da época e marca do suporte

#### O que passa a ser gravado

Em `stronix_interactions`:

- `leadConsultantName` em toda interação: o `consultantName` do lead quando ele tem `consultantId` (null se o lead não tiver o nome gravado), e null quando não tem dono. Nunca o nome de quem clicou, mesmo quando o `leadConsultantId` cai no autor por falta de dono (`src/lib/leads.js:352-353`). É o campo oficial do dono no dia. O `ownerName` do `zap_signup` (`api/_zapLead.js:439`) continua só para desenhar o marco na ficha.
- `leadUnowned: true` quando o lead não tem `consultantId`, só nesse caso (seção 3). É o que separa o `leadConsultantId` reserva, que é de quem clicou, do dono de verdade.
- `goalOwnerName` ao lado do `goalOwnerId` na marca do dia de visita, aula e contato. Na visita e na aula, `appointmentOwnerName` quando há `appointmentOwnerId`, senão o `consultantName` do lead. No contato, `nextFollowUpOwnerName` quando há `nextFollowUpOwnerId`, senão o `consultantName`. Nunca o `ownerName` da linha da Agenda, que é texto de tela e pode ser `'sem consultor'` (`src/lib/dayAgenda.js:84`).
- `impersonated: true` quando quem grava está no Acessar como (`appUser.impersonating`, montado em `src/App.jsx:583` e `613` a partir do claim `impersonatedBy` de `api/impersonate.js:63`). Vai na função central, que já recebe quem grava e por onde passam os gravadores do navegador, menos três montados à mão: a migração de carteira (`src/views/settings/TransferLeadsTab.jsx:170-177`, que o PR 1 refaz com a marca), a importação (`src/lib/clientImportWrites.js:119-133`) e a nota de migração de funil da indicação (`src/views/settings/ReferralOwnersSection.jsx:140-149`). Os dois últimos põem a marca à mão neste PR. A função central ganha a opção `{ actorless: true }`, que as duas gravações sem autor de `src/lib/appointmentOutcome.js` (120-133 e 137-147) passam: sem autor, sem marca (decisão 12). No servidor o `actor` nunca tem a marca.

#### Caminhos que gravam esse fato hoje

- A função central `getInteractionSecurityFields` (`src/lib/leads.js:351-354`), usada por `src/lib/interactions.js:38` (`logInteraction`), `src/lib/contractsWrites.js:64`, `161` e `181`, `src/lib/referralsWrites.js:16`, `src/lib/appointmentOutcome.js:123` e `140`, `api/_zapSchedule.js:601` e `api/_zapLead.js:434` e `455`.
- Os dois objetos montados à mão na ponte (`api/_zapLead.js:434` e `455`) passam `{ consultantId, consultantAuthUid }` sem nome. Sem acrescentar `consultantName: owner.name`, o cadastro pelo Stronizap gravaria `leadConsultantName` null calado.
- Os gravadores à mão: `api/tenant-resolve.js:241-252` (tentativa repetida pelo link) e `309-312` (lead novo do link e evento no indicador), `src/lib/clientImportWrites.js:119-133` e `src/views/settings/ReferralOwnersSection.jsx:140-149` (sem `leadId`, só recebe a marca do suporte).
- `goalOwnerFields` (`src/lib/leads.js:160-163`), chamado em `src/views/DailyGoalView.jsx:1291`, `1411`, `1458`, `1490` e `1636`, `src/modals/ContactOutcomeModal.jsx:98` e `115` e `src/lib/appointmentOutcome.js:129`.

#### Arquivos

`src/lib/leads.js` (as duas funções), `src/lib/appointmentOutcome.js` (a opção `actorless` nas duas gravações sem autor), `api/_zapLead.js` (o nome nos dois objetos), `api/tenant-resolve.js` e `src/lib/clientImportWrites.js` (o nome e, na importação, que só existe na sessão assumida, a marca do suporte à mão), `src/views/settings/ReferralOwnersSection.jsx` (a marca à mão), `src/lib/crm/scope.js` (`OWNER_NAMES_TRACKING_SINCE`) e o `CLAUDE.md`.

#### O que muda e o que não muda na tela

Nada muda na tela.

#### Testes

- Quebram de propósito, por comparar a interação inteira: `src/lib/__tests__/leads.test.js:350-378` (o "shape exato") e `480-498` (`goalOwnerFields`), `api/__tests__/zapLead.test.js:556` e `589`, `api/__tests__/zapRoute.test.js:1282-1295`, `1326-1338` e `2031-2047`, `api/__tests__/zapSchedule.test.js:1016-1030` e `src/lib/__tests__/contractsWrites.test.js:124-144`. O `appointmentOutcome.test.js` usa `toMatchObject` e não quebra. O `zapRoute.test.js:1369-1373` também usa `toMatchObject`: ali entra a asserção do `leadConsultantName` do dono escolhido pelo gestor.
- Novos: lead sem dono grava `leadConsultantName` null e `leadUnowned: true` com o `leadConsultantId` do autor; lead com dono nunca leva `leadUnowned`; o `zap_signup` e a nota do cadastro levam o nome do dono escolhido pelo gestor; a marca da Agenda leva o nome de quem tem a tarefa e nunca `'sem consultor'`; `impersonated` só aparece com `impersonating` true, e nunca nas duas gravações sem autor da Agenda.
- A varredura do PR 0 estende a lista: `leadConsultantName` como chave só aparece nos mesmos três arquivos.

#### Regra e índice

Nenhum. A interação do professor só confere o `type` e o `actorAuthUid` (`firestore.rules:188-193`), sem lista de campos.

#### Dependências e ordem

Depois do PR 0, que é o que faz o `leadConsultantId` valer como dono no dia. Mexe nas linhas vizinhas do PR 2 em `src/lib/leads.js` (345-354) e em `api/_zapLead.js` (409, 434 e 455), e nos mesmos testes de igualdade exata do PR 3a (`api/__tests__/zapSchedule.test.js:987-1066` e `api/__tests__/zapRoute.test.js:2025-2047`) e do PR 6 (`src/lib/__tests__/contractsWrites.test.js:124-144`): sai depois de cada um deles que estiver em andamento, trazendo a main e rodando a suíte inteira.

#### Riscos

- O evento de conversão gravado na linha do tempo do indicador recebe o lead do indicado (`src/lib/contractsWrites.js:181`), então o `leadConsultantId` e o `leadConsultantName` desse evento são do dono do indicado. Já é assim hoje e fica anotado para o leitor.
- O plano do PR 2 do professor (branch `claude/professor-pr2-importacoes`) grava a interação `presence_return` pela função central. Se este PR entrar antes, os testes daquele plano que comparam o objeto pedem o campo novo.
- Abas antigas gravam sem o nome por alguns dias.

#### Relatórios que destrava

Deixa legíveis, depois que a pessoa sai da equipe, os relatórios do PR 1 e R099, R100, R103, R116, R117 e R133. A marca do suporte serve a R127 e R168.

---

### PR 2. Quem cadastrou e por onde

#### O que passa a ser gravado

Em `stronix_leads`, só na criação, nunca depois:

| Campo | Valor |
|---|---|
| `createdById`, `createdByAuthUid`, `createdByName` | Quem cadastrou: `appUser` no Novo lead e no pop-up de indicação, o `actor` no Stronizap, quem roda a importação. null no link público. |
| `createdVia` | `'manual'` (Novo lead), `'referral_manual'` (Novo lead com indicação e Cadastrar indicação), `'referral_link'` (link público), `'stronizap'` (pela constante `ZAP_VIA`), `'import'` (planilha). A lista mora em `src/lib/leads.js`, ao lado de `ZAP_VIA`. |
| `createdConsultantId`, `createdConsultantName` | O dono no nascimento: quem cadastra no manual, o escolhido pelo gestor no Stronizap, o consultor do cliente que indicou no link, o dono resolvido na importação. |
| `createdByImpersonated` | true quando quem cadastrou estava no Acessar como. Toda importação leva, porque ela só existe na sessão assumida. |

Tudo sai de uma função pura nova, `getLeadCreationFields({ creator, owner, via })`, ao lado de `getLeadOwnershipFields` (`src/lib/leads.js:345-349`).

#### Caminhos que gravam esse fato hoje

- Novo lead: `src/modals/AddLeadModal.jsx:480-490`, com `buildNewLeadDoc` na 486. Com indicação, o mesmo e o `commitReferralLink` em 495-506.
- Cadastrar indicação: `src/modals/QuickReferralModal.jsx:84-88`.
- Stronizap: `api/zap.js:435-513` (`resolveOwner` na 460, `buildZapLead` na 466, `tx.create` em 500-502), com o montador em `api/_zapLead.js:389-421` (`buildNewLeadDoc` na 409).
- Link público: `api/tenant-resolve.js:276-307`, montado à mão.
- Importação: só o ramo do lead novo, `src/lib/clientImport.js:643-679`. O lead que já existe (680-695) não recebe nenhum `created*`. O `importMeta` nasce em `src/views/settings/ImportClientsSection.jsx:276-280`.

#### Arquivos

- `src/lib/leads.js`: `getLeadCreationFields` e a lista de `createdVia`.
- `src/lib/newLead.js:25-59`: `buildNewLeadDoc` aceita `creator` (padrão: o `owner`) e `via` (padrão: `'referral_manual'` com `referrer`, senão `'manual'`). `AddLeadModal.jsx` e `QuickReferralModal.jsx` não mudam.
- `api/_zapLead.js:409`: `buildNewLeadDoc(form, { owner, creator: actor, via: ZAP_VIA })`.
- `api/tenant-resolve.js`: espalha `getLeadCreationFields` com autor nulo, dono herdado do indicador e `'referral_link'`.
- `src/lib/clientImport.js`: espalha no ramo do lead novo. `ImportClientsSection.jsx` passa no `importMeta` quem roda a importação (id, nome, `authUid` e a marca), para o `clientImport.js` continuar puro.
- `src/lib/crm/scope.js`: `LEAD_CREATION_TRACKING_SINCE`.

#### O que muda e o que não muda na tela

Nada muda na tela. O corpo do `create-lead` e o cartão do Stronizap (lista fechada em `api/_zapCard.js`) não mudam.

#### Testes

- Quebram de propósito: `src/lib/__tests__/newLead.test.js:31-138` (`toEqual` na 33), `api/__tests__/zapLead.test.js:481-550` (`toEqual` na 489, e o caso do gestor que entrega a outro confere `createdBy*` do gestor e `createdConsultant*` do escolhido) e `api/__tests__/zapRoute.test.js:1299-1311`.
- Novos: o primeiro teste de rota do `referral-signup` em `api/__tests__/tenantResolve.test.js`, que hoje não tem caso de indicação (`createdVia: 'referral_link'`, autor nulo, dono do indicador); `getLeadCreationFields` sem `undefined`.
- Estendido: `src/lib/__tests__/clientImport.test.js`. Ele confere chave por chave numa lista fixa (801-811) e o teste de `undefined` (813-820) passa com null, então campo novo não quebra nada ali. Entram os casos: o lead novo ganha os `created*` com `createdVia: 'import'` e `createdByImpersonated: true`; o lead existente não ganha nenhum.
- Varredura: as chaves novas (`createdById`, `createdByAuthUid`, `createdByName`, `createdByImpersonated`, `createdVia`, `createdConsultantId` e `createdConsultantName`) só aparecem em `src/lib/leads.js`, e todo lead novo passa por `buildNewLeadDoc` ou por `getLeadCreationFields`. A varredura procura essas chaves exatas: `createdBy` sozinho já existe em outros documentos (`src/modals/SupportCenterModal.jsx:87`, `api/zap.js:254`, `api/invite-create.js:95`, `api/provision-tenant.js:160`, `284` e `343`). O `newLeadSweep.test.js` e o `newLeadImports.test.js` seguem passando.

#### Regra e índice

Nenhum. A criação de lead confere só o `consultantAuthUid` e o papel (`firestore.rules:220-222`). O Stronizap e o link gravam pelo Admin SDK. A trava de imutabilidade dos `created*` nas regras fica fora.

#### Dependências e ordem

Nenhuma. Sai antes do PR 1b, que mexe nas linhas vizinhas.

#### Riscos

- Os `created*` são rastro, não prova: qualquer membro reescreve campo de lead pelo SDK.
- `createdBy*` nunca é professor, porque ele não cria lead (`firestore.rules:222`, `api/_zapLead.js:150-155`).
- Abas antigas criam lead sem os campos por alguns dias.
- O lead novo da importação nasce com o `createdAt` da planilha (`src/lib/clientImport.js:670`), que pode ser de anos atrás. O leitor não decide pelo `createdAt` do lead se ele já devia ter os `created*`: quem decide é a presença dos campos (ou o `importBatchId`). A `LEAD_CREATION_TRACKING_SINCE` só diz desde quando o campo ausente quer dizer "sem registro" num lead criado no app.

#### Relatórios que destrava

R001, R099, R101, R131, R133 e R157.

---

### PR 3a. Registro do agendamento

#### O que passa a ser gravado

Em `stronix_aulas`:

| Campo | Quando | Valor |
|---|---|---|
| `scheduledById`, `scheduledByAuthUid`, `scheduledByName` (e `scheduledByImpersonated`) | só na criação do registro | Quem agendou da primeira vez (decisão 16). |
| `rescheduledById`, `rescheduledByAuthUid`, `rescheduledByName` (e `rescheduledByImpersonated`) e `rescheduledAt` | a cada vez que o registro em aberto é movido para outro instante | Quem remarcou por último e a hora do servidor. Vale também para a visita adiada que o próximo agendamento move (decisão 17). Hoje o registro aberto recebe o patch em toda gravação de agendamento, mesmo quando só troca professor, modalidade ou unidade, ou quando o horário é o mesmo (`src/lib/aulasWrites.js:20-36`, `api/_zapSchedule.js:569-577`). Por isso a função pura do movimento recebe o `scheduledFor` que o registro tinha e só carimba quando ele muda. O navegador já lê o registro ao achá-lo, e o Stronizap já tem a lista dos registros do lead. |
| `appointmentOwnerId`, `appointmentOwnerName` | na criação e ao mover pela ficha e pelo Stronizap | O dono efetivo da tarefa: o que o `appointmentTaskOwnerFor` devolve (`src/lib/schedulePatch.js:30-34`) e, quando ele devolve null, o dono do lead naquele instante (`consultantId` e `consultantName`). null só quando não há dono nenhum (lead sem dono agendado por gestor). No lead o null continua querendo dizer "o dono do lead" (`src/lib/schedulePatch.js:106-107`); no registro, não. O Remarcar da Meta não troca o do lead (`src/views/DailyGoalView.jsx:1595-1611`); quando ele cria o registro, grava o dono efetivo pelo lead (o `appointmentOwnerId` dele ou, sem ele, o dono do lead), e quando move, não mexe. |
| `trialClassesPlanned` | só em aula, na criação e ao mover, quando o pedido traz | O número do pacote (decisão 8). A unidade, dias ou aulas, sai da modalidade na entrega D. |

`aulaRecordFields` (`src/lib/aulas.js:171-199`) ganha os campos com null por padrão. Duas funções puras novas em `src/lib/aulas.js` montam o autor da criação e o do movimento, usadas pelo navegador e pela `api/`, que já importa esse arquivo (`api/_zapSchedule.js:32`).

#### Caminhos que gravam esse fato hoje

- Ficha, assistente: `handleWizardConfirm` (`src/views/LeadProfileView.jsx:536-622`) chama `recordNewAppointment` (578-589), que chama `upsertScheduledAppointment` (`src/lib/aulasWrites.js:16-50`: move em 33-36, cria em 38-49). O dono da tarefa já está calculado na 563.
- Meta Diária, Remarcar, Remarcou, Remarcar depois do Não veio e Remarcar agendamento: `handleReschedule` (`src/views/DailyGoalView.jsx:1518-1653`), com a aula em 1562-1577 e a visita em 1579-1593. O pacote é o `finalQty` da 1537.
- Stronizap, ação `schedule`: `buildScheduleWrites` (`api/_zapSchedule.js:562-631`), com o patch de mover em 569-577, a criação em 581-596, o dono da tarefa na 568 e o pacote na 621. O `actor` sai de `api/zap.js:597`.
- Os scripts `scripts/backfill-appointments.js` e `scripts/backfill-aulas.js` espelham `aulaRecordFields` à mão e só precisam acompanhar se forem rodar de novo.

#### Arquivos

`src/lib/aulas.js`, `src/lib/aulasWrites.js` (`upsertScheduledAppointment` e `recordNewAppointment` recebem quem grava, o dono da tarefa e o pacote), `src/views/LeadProfileView.jsx`, `src/views/DailyGoalView.jsx`, `api/_zapSchedule.js`, `src/lib/crm/scope.js` (`APPT_BOOKING_TRACKING_SINCE`) e o `CLAUDE.md`. O `registroDoAgendamento.sweep.test.js` lê dois trechos pelo texto: o assistente continua chamando `recordNewAppointment({` e o Remarcar continua com `recordPlanFor(lead, { type: finalApptType, at: newDate, afterNoShow: isAfterNoShow })`.

#### O que muda e o que não muda na tela

Nada muda na tela.

#### Testes

- Quebram de propósito: `src/lib/__tests__/aulas.test.js` (`aulaRecordFields`), `src/lib/__tests__/aulasWrites.test.js` (`recordNewAppointment`, 136-247), `api/__tests__/zapSchedule.test.js` (`buildScheduleWrites`, 987-1066) e `api/__tests__/zapRoute.test.js`, que compara a visita nova inteira com `toEqual` em 2025-2030. É esse `toEqual` que impede o caminho do Stronizap de ficar para trás. A fixture `registro` do mesmo arquivo (1967-1972) é dado de entrada e não quebra sozinha; ganha os campos novos só nos casos que testam o movimento.
- Novos: a criação grava `scheduledBy*`; mover para outro instante preserva `scheduledBy*` e grava `rescheduledBy*`; mover sem trocar o instante (só professor, modalidade ou unidade, ou o mesmo horário regravado) não carimba `rescheduledBy*`; o Bruno agendando no lead da Ana gera `scheduledById` e `appointmentOwnerId` do Bruno e `consultantId` da Ana; o gestor agendando no lead da Ana gera `appointmentOwnerId` da Ana; aula com quantidade 2 gera `trialClassesPlanned: 2`; o Remarcar da Meta que cria a visita grava o dono efetivo pelo lead; nada `undefined`.

#### Regra e índice

Nenhum. `stronix_aulas` não tem lista de campos, e o update só exige o `consultantAuthUid` igual (`firestore.rules:455-461`). Nenhum patch leva `consultantId`, `consultantAuthUid` nem `consultantName`. O Stronizap grava pelo Admin SDK, por isso os campos saem das mesmas funções puras.

#### Dependências e ordem

Nenhuma. Corre junto com 1 e 2. O 3b sai depois, porque os dois mexem em `aulasWrites.js` e nos mesmos testes.

#### Riscos

- `api/_zapSchedule.js` é um dos arquivos do contrato com o Stronizap. A resposta do `schedule` não muda (`api/zap.js:653-658` devolve o cartão e o agendamento, lidos do lead), o smoke não muda e o Stronizap não precisa de deploy.
- O reaproveitamento não tem trava de data (`src/lib/aulasWrites.js:128-134`, `api/_zapSchedule.js:487-490`): um registro aberto antigo é movido e mantém o `scheduledBy*` de quando nasceu. É o que a decisão 17 pede.
- O professor grava qualquer campo de `stronix_aulas` pelo SDK (comentário em `firestore.rules:436-454`). Os campos são rastro, como o `status` já é.

#### Relatórios que destrava

R030, R057 e R120. Parte de R036 (quem remarca; a data anterior e a contagem ficam fora) e de R041 e R043 (o pacote; a unidade vem com a entrega D).

---

### PR 3b. Desfecho da visita no registro

#### O que passa a ser gravado

Em `stronix_aulas`, para visita e aula:

- `status` na hora da marcação e da correção, pelo mesmo mapa `outcomeToAulaStatus` (`src/lib/aulas.js:21-26`), que já leva o Cancelou a `'cancelled'`. Na aula, `'attended'`, `'no_show'` ou `'cancelled'`, como já é hoje. Na visita passa a ser igual: `'cancelled'` no Cancelou (decisão 21, abaixo). `'agendada'` no desfazer.
- `outcomeAt`: hora do servidor na marcação e na correção, null no desfazer. No fechamento tardio, que fica como rede de segurança, vale o `appointmentOutcomeAt` do lead quando existir, e só sem ele a hora do servidor.
- `outcomeById`, `outcomeByAuthUid`, `outcomeByName` (e `outcomeByImpersonated`): quem marcou ou corrigiu. null no desfazer. O fechamento tardio não põe essas chaves no patch, porque quem remarca não é quem marcou: o registro fechado assim fica sem autor, que é "sem registro".
- `outcomeConsultantId`, `outcomeConsultantName`: o dono do lead no instante do desfecho (decisão 2). null no desfazer. Também ficam fora do patch do fechamento tardio.

A visita é achada pelo `leadId` e pelo `scheduledFor` igual ao `appointmentScheduledFor` do lead antes da gravação. Com a decisão 18, o mesmo lead pode ter dois registros de visita no mesmo instante: o primeiro, fechado na marcação, e o do agendamento refeito no mesmo horário. O desempate é este:

- na marcação, o Cancelou incluído, o registro `'agendada'` daquele instante;
- na correção e no desfazer, o registro fechado daquele instante com o `createdAt` mais recente. O Cancelou não tem correção nem desfazer: o `correctableOutcome` só aceita Compareceu e Não compareceu (`src/lib/outcomeCorrection.js:75-81`);
- sem registro que caiba, nada é gravado e o aviso vai ao console, como na guarda da aula.

A aula continua pelo `currentAulaId`, com a guarda de mesma data do agendamento do lead: o `scheduledFor` do registro igual ao `appointmentScheduledFor` (`src/lib/aulasWrites.js:152-169`, comparação em 159-166).

Duas regras mudam com isso:

- Decisão 18: `rescheduleRecordPlan` deixa de abrir a exceção de mesmo tipo e mesmo instante (`src/lib/aulas.js:72` e `75`). Com desfecho, o registro fecha com ele, e o agendamento novo no mesmo horário nasce em registro próprio, como a aula já faz. Quando a gravação na hora deu certo, o fechamento não acha nada aberto e só cria; quando falhou, fecha com o desfecho do lead.
- Decisão 21: o Cancelou de visita fecha o registro na hora como `'cancelled'`. Hoje ele tira o compromisso do lead (`appointmentScheduledFor` e `appointmentType` vão a null, `src/views/DailyGoalView.jsx:1273-1278`, e `src/lib/appointmentOutcome.js:105-111` no mesmo molde), abre o "Próximo contato?" (`DailyGoalView.jsx:1319-1324`), que é contato e não agendamento, e deixa o registro `'agendada'` até o agendamento seguinte movê-lo. Com a gravação na hora, o agendamento seguinte, pela ficha, pela Meta ou pelo Stronizap, não acha registro aberto e cria outro (`findOpenVisitaId`, `src/lib/aulasWrites.js:128-134`, e `pickOpenVisitaId`, `api/_zapSchedule.js:487-490`). O `closingStatusOf` (`src/lib/aulas.js:36-40`) não muda: depois do Cancelou o lead fica sem tipo e sem data de agendamento, e o `rescheduleRecordPlan` não tem registro anterior a fechar. Quem fecha a visita cancelada é a marcação, não o agendamento seguinte.

A decisão 17 fica como está: visita sem desfecho, adiada, continua sendo movida. O Remarcou do balão é outra opção, vai para o `handleReschedule` (`src/views/DailyGoalView.jsx:1518-1653`) e continua movendo o registro, o que conta como remarcação.

O leitor do Dashboard CRM não muda. O `effectiveStatus` (`src/lib/crm/appointments.js:94-107`) continua devolvendo o status de todo registro que não está mais `'agendada'`. Dar razão ao espelho do lead quando ele discorda de um registro fechado é mudança de leitura e de número, e com a decisão 18 teria de escolher o registro mais recente do instante; fica para um PR de leitura (seção 6).

#### Caminhos que gravam esse fato hoje

- Agenda de hoje: `markAgendaPresence` (`src/views/DailyGoalView.jsx:1091-1159`) chama `writeAppointmentOutcome` (`src/lib/appointmentOutcome.js:69-149`). A guarda que deixa passar só aula está em 115-117 (`outcomeAppliesToAula`, `src/lib/leads.js:310-311`).
- Card "A fazer" e Próximo compromisso: `handleOutcome` (`src/views/DailyGoalView.jsx:1246-1329`), com a mesma guarda em 1299-1301. É o único caminho do Cancelou, que só existe nesses dois lugares (`withMore`, 260 e 510).
- Correção do mesmo dia, pela Agenda (1107) e pelo Feitos hoje (1342): `correctAppointmentOutcome` (`src/lib/appointmentOutcome.js:164-207`).
- Desfazer na Agenda: `clearAppointmentOutcome` (`src/lib/appointmentOutcome.js:56-67`, guarda em 64-66).
- Fechamento tardio da #241: `closeOpenAppointment` (`src/lib/aulasWrites.js:63-77`, hora na 75) e o `closed` do Stronizap (`api/_zapSchedule.js:629`).

#### Arquivos

- `src/lib/aulas.js`: funções puras do patch de desfecho e do de reabrir; a exceção de mesmo instante sai; o comentário de 48-66 é reescrito, e o de 36-38 passa a dizer que a visita cancelada fecha na marcação. O `outcomeToAulaStatus` e o `closingStatusOf` não mudam.
- `src/lib/aulasWrites.js`: `applyOutcomeToAula` e `clearAulaOutcome` viram uma função para visita e aula, com o desempate acima; `closeOpenAppointment` usa o `appointmentOutcomeAt` do lead e não grava autor.
- `src/lib/leads.js`: `outcomeAppliesToAula` dá lugar a um mapa de categoria para tipo de registro (`visita_hoje` para visita, `aula_hoje` para aula).
- `src/lib/appointmentOutcome.js` (64-66 e 115-117) e `src/views/DailyGoalView.jsx` (1299-1301) chamam a função nova com quem grava. As marcas de 120-145 continuam sem `actorId` e sem `actorAuthUid`.
- `api/_zapSchedule.js:629`: o `closed` leva o `appointmentOutcomeAt` do lead, sem chave de autor.
- `src/lib/crm/appointments.js`: só os comentários de 1-6, 27-34, 54-61 e 84-93, que dizem que o app não grava o desfecho no registro e que o cancelamento segue pela linha do tempo. O código não muda. `src/lib/crm/scope.js`: `VISIT_OUTCOME_ON_RECORD_SINCE`.

#### O que muda e o que não muda na tela

Nenhuma tela muda de forma. O Dashboard CRM muda em dois casos, aprovados pelas decisões 18 e 21:

- o desfecho marcado e reagendado no mesmo horário passa a contar como dois agendamentos, cada um com o seu desfecho;
- a visita cancelada passa a aparecer como cancelada no mês dela, no próprio registro, em vez de ser levada para a data do agendamento seguinte. A conta de agendamentos do mês já deixa as canceladas de fora (`appointmentsOf`, `src/lib/crm/appointments.js:130`, com o texto de `src/lib/crm/texts.js:16`), então o total não muda. Sem agendamento novo, o Cancelou já é lido hoje como cancelado pela linha do tempo (`effectiveStatus`, 94-107), porque ele sempre é marcado no dia da visita: o card "A fazer" e o Próximo compromisso só mostram a visita de hoje (`src/lib/dailyGoal.js:410-418`, `src/views/DailyGoalView.jsx:1703-1716`). Com agendamento novo, hoje o registro movido conta uma vez, no mês da data nova; com o PR, o cancelado fica fora da conta no mês dele e o registro novo conta no mês da data nova. O que muda em número é a safra cortada num instante (`cohortMilestones`, 178-195): o marco Agendou desse lead passa a sair do agendamento novo, e não do primeiro, que foi cancelado.

No resto, a visita marcada passa a sair do status do registro em vez do espelho do lead ou da linha do tempo, e o resultado é o mesmo de hoje, porque o desfecho só é marcado e corrigido no dia.

#### Testes

- Quebram de propósito: `src/lib/__tests__/appointmentOutcome.test.js` (o mock de `aulasWrites` em 22-26 e a correção de visita que hoje não toca o registro, 145); `src/lib/__tests__/aulasWrites.test.js` (o caso de mesmo horário, 178); `src/lib/__tests__/aulas.test.js:262-266` (mesmo instante); `api/__tests__/zapSchedule.test.js` (o mesmo instante em 928); `api/__tests__/zapRoute.test.js:2116` (o lead tem `appointmentOutcomeAt`, e o `outcomeAt` deixa de ser a hora da remarcação).
- Rodam sem edição: o `closeOpenAppointment` de `aulasWrites.test.js` (89-134) e o `closed` exato de `zapSchedule.test.js` (1063-1064). Os leads desses casos não têm `appointmentOutcomeAt` (`zapSchedule.test.js:991-994`), e o fechamento tardio não ganha chave nova. O `crm.appointments.test.js` também não muda, porque o leitor não muda. O caso do Cancelou em `src/lib/__tests__/aulas.test.js:285-291` (ele não fecha pelo desfecho no `rescheduleRecordPlan`) segue certo, porque o `closingStatusOf` não muda.
- Novos: Compareceu e Não compareceu de visita fecham o registro do mesmo instante com os quatro grupos de campos e não tocam a aula do lead nem visita de outra data; o Cancelou de visita fecha como `'cancelled'` o registro `'agendada'` daquele instante, com os quatro grupos de campos; o Cancelou seguido de outra visita, pela ficha, pela Meta e pelo Stronizap, deixa o cancelado como está e cria registro novo; o Remarcou continua movendo o registro; o Cancelou que falhou no registro deixa o registro `'agendada'`, e o agendamento seguinte o move, como hoje; a correção regrava o mesmo registro; o desfazer reabre; o fechamento tardio, no navegador e no Stronizap, usa o `appointmentOutcomeAt` do lead quando ele existe e não grava autor nem dono; depois de uma visita fechada na marcação, o agendamento seguinte, inclusive no mesmo horário, cria registro novo; Compareceu às 18h, reagendada para as mesmas 18h e Não veio no segundo: o primeiro registro continua `'attended'`, o segundo fica `'no_show'`, e a correção do segundo não toca o primeiro; o Remarcar aberto logo depois do Não veio, com o lead de antes da gravação (`src/views/DailyGoalView.jsx:1117`, `1151`, `1320` e `1350`), cria registro novo quando a gravação deu certo e fecha como falta quando falhou; a marca da Agenda continua sem autor e com `goalOwnerId`.
- Na mão, no preview, numa academia de teste: visita marcada por colega na Agenda, correção, desfazer, Cancelou sem outro agendamento (o registro fica `'cancelled'`), Cancelou seguido de outra visita (o cancelado fica no mês dele e nasce registro novo), Remarcou (o registro é movido) e desfecho seguido de agendamento no mesmo horário, conferindo `stronix_aulas` e o Dashboard CRM.

#### Regra e índice

Nenhum. O patch nunca leva `consultantAuthUid`. A regra compara esse campo por acesso direto (`firestore.rules:458-459`), e registro sem o campo recusaria qualquer update; os registros nascem de `aulaRecordFields`, que sempre grava o campo, e os scripts de carga também gravam (null incluso). Nenhum índice: a busca é por `leadId`.

#### Dependências e ordem

Depois do 3a.

#### Riscos

- Dois sentidos de `outcomeAt`: os registros fechados pela #241 desde 01/10 têm a hora da remarcação e nenhum autor. O relatório separa pela `VISIT_OUTCOME_ON_RECORD_SINCE`.
- Escrita dupla: o navegador grava o registro depois do lead, num `try/catch` que só avisa no console. Se a marcação falha no registro, ele fica `'agendada'` e o `effectiveStatus` de hoje já usa o espelho do lead. Se a correção ou o desfazer falham, o registro fica com o desfecho velho, e o CRM conta o velho até o PR de leitura da seção 6.
- Dois registros no mesmo instante (decisão 18): o segundo, enquanto `'agendada'` e com o lead já em outro agendamento, cai na busca pela linha do tempo do `effectiveStatus` e pode herdar o desfecho do primeiro. Vale o mesmo para a visita reagendada no mesmo dia depois de um Cancelou (decisão 21), que pode herdar o cancelamento. O desfecho gravado na hora no segundo registro cobre o caso comum.
- Cancelou que falha no registro: o lead já ficou sem agendamento, então nem o fechamento tardio nem o `rescheduleRecordPlan` têm o que fechar, e o agendamento seguinte move o registro, como hoje. O CRM conta a visita como hoje nesse caso.
- Leitura nova: uma consulta por `leadId` a cada desfecho de visita e outra na correção e no desfazer.
- Três pessoas para o mesmo comparecimento (dono do lead, dono da tarefa, quem marcou). O registro guarda as três. Pôr autor na marca da Agenda continua proibido, porque o Operacional passaria a creditar quem clicou.

#### Relatórios que destrava

R025, R027, R028, R033, R034, R037, R039, R042, R045 e R142. Adianta R006, R015 e R157. Parte de R038 (a aula e a visita canceladas ganham hora, autor e dono no registro; o motivo do cancelamento fica fora) e de R048 (a confirmação da véspera fica fora).

---

### PR 4. Perda com motivo no evento

#### O que passa a ser gravado

Na interação `status_change` da perda de lead, a mesma de hoje:

- `lossReason`: o nome do motivo como estava na hora.
- `lossReasonId`: o id em `stronix_loss_reasons`, null para o item `default` do catálogo vazio.
- `lossCorrection: true` quando o lead já estava em Perda (decisões 3 e 22). O leitor futuro conta a primeira perda e trata esta como troca de motivo. O `stageChangeFields` já devolve null, porque etapa e funil não mudam (`src/lib/stageMove.js:56`).

No lead, a correção mantém o `lostAt` da primeira perda (decisão 22). Hoje os dois gravadores escrevem `lostAt: serverTimestamp()` sempre (`src/views/KanbanView.jsx:1193` e `src/views/LeadProfileView.jsx:342`), e a perda marcada de novo passa para o mês da correção no Dashboard CRM, que lê esse campo. Com o PR, o lead que já está em Perda recebe o motivo novo em `lossReason` e fica com o `lostAt` que tinha, então a perda continua no mês da primeira. O lead em Perda sem `lostAt` (perda de antes de o campo existir, que o backfill não preencheu, ver `src/views/KanbanView.jsx:618-619`) continua sem ele: a primeira perda não tinha mês, e a correção não dá um a ela. O resto do patch não muda: `status`, `nextFollowUp`, `isConverted` e `convertedAt` vão como hoje, e o `statusEnteredAt` já não é tocado na correção, porque o `withStageEntered` só o grava com troca de etapa.

Os campos do evento saem de `lossEventFields(lead, { reason, reasonId })` e o `lostAt` sai de `lossLeadFields(lead, stamp)`, que devolve `{ lostAt: stamp }` na primeira perda e `{}` na correção. As duas são puras, ficam em `src/lib/stageMove.js` e decidem a correção pela mesma regra, `isLossCorrection(lead)` (o lead que a tela tem está em Perda), então o `lossCorrection: true` aparece no evento exatamente quando o `lostAt` fica fora do patch. `planLoss` (108-112) não muda. Um botão de trocar motivo seria tela nova e fica fora (seção 6).

#### Caminhos que gravam esse fato hoje

- Pipeline: `confirmKanbanLoss` (`src/views/KanbanView.jsx:1163-1213`, `status: 'Perda'` na 1190), aberto pelo menu Mover (1066-1077) e pelo arrasto (`handleLossDrop`, 1125-1161).
- Ficha: `confirmLoss` (`src/views/LeadProfileView.jsx:306-362`, `status: 'Perda'` na 339), aberto pelo botão Marcar perda (1355-1364) e pelo Mudar fase (378-382).
- Modal: `src/modals/LossReasonModal.jsx`, que usa o nome como `value` (9 e 20) e devolve só o nome (24).
- Hoje o motivo some do lead na reabertura (`src/lib/stageMove.js:89-92`), na matrícula (`src/lib/contractsWrites.js:145-146`) e na importação (`src/lib/clientImport.js:579`). O evento passa a guardá-lo.
- Perda marcada de novo: hoje só um caminho de tela chega lá. Recusam o botão da ficha (`LeadProfileView.jsx:1360`), o arrasto (`KanbanView.jsx:1143`), o menu Mover (`KanbanView.jsx:1031`, que sai quando o status já é o destino) e o Mudar fase no mesmo funil (`src/components/profile/PhaseChanger.jsx:155` e `344`). Sobra o Mudar fase da ficha com outro funil escolhido: o `handlePhaseConfirm` abre o modal sem olhar o funil (`LeadProfileView.jsx:378-382`), e o `confirmLoss` (306-362) ignora o funil escolhido, troca o `lossReason` e regrava o `lostAt` (342). É esse caminho que passa a corrigir sem mexer no `lostAt`. O Pipeline não corrige: o `confirmKanbanLoss` (`KanbanView.jsx:1163-1213`, `lostAt` na 1193) só é aberto para card fora de Perda.

#### Arquivos

`src/lib/stageMove.js` (`isLossCorrection`, `lossEventFields` e `lossLeadFields`), `src/modals/LossReasonModal.jsx` (o `value` passa a ser o id, e `onConfirm(reason, reasonId)` devolve o nome do item achado pelo id), `src/views/KanbanView.jsx` e `src/views/LeadProfileView.jsx` (recebem o id, espalham os campos do evento só no ramo de lead e trocam o `lostAt: serverTimestamp()` por `lossLeadFields(lead, serverTimestamp())`; o ramo do Upgrade recebe o id e o usa no PR 5), `src/lib/crm/scope.js` (`LOSS_EVENT_TRACKING_SINCE`) e o `CLAUDE.md`.

#### O que muda e o que não muda na tela

Muda num caso, pela decisão 22: a perda corrigida fica no mês da primeira perda no Dashboard CRM (`lostAtOf`, `src/lib/crm/cohort.js:16` e `80-85`, e a consulta por `lostAt`, `src/lib/crm/queries.js:18`), com o motivo novo, em vez de passar para o mês da correção. O caminho é raro, só o Mudar fase da ficha com outro funil (acima). Não muda: o modal mostra os mesmos nomes e a linha do tempo continua tirando o motivo do texto (`src/views/LeadProfileView.jsx:1019-1021`).

#### Testes

- Rodam sem edição: `planLoss` com `toEqual` em `src/lib/__tests__/stageMove.test.js:96-112`. A função central não muda neste PR.
- Novos: `lossEventFields` com id, com `default` e sem id, com e sem `lossCorrection`; `lossLeadFields` devolve o `lostAt` na primeira perda e nada num lead que já está em Perda, com ou sem `lostAt` gravado; as duas concordam (o evento leva `lossCorrection: true` exatamente quando o patch fica sem `lostAt`); teste em jsdom do modal (o `value` é o id, dois motivos que só diferem por espaço continuam distintos, `onConfirm` recebe nome e id).
- Varredura: todo arquivo de `src/views` e `src/modals` que grava `status: 'Perda'` chama `lossEventFields` e `lossLeadFields` (hoje, `KanbanView.jsx:1190` e `LeadProfileView.jsx:339`), e nenhum deles escreve `lostAt: serverTimestamp()` solto. Ela não olha `src/lib`, onde o mesmo texto aparece em projeções de card que não gravam nada (`src/lib/expiredFunnel.js:169`, `src/lib/renewalFunnel.js:150`) e num comentário (`src/lib/leadDerived.js:70`).

#### Regra e índice

Nenhum.

#### Dependências e ordem

Nenhuma. Não espera o 1b: até ele entrar, o evento sai sem `leadConsultantName`, que é "sem registro" pela regra 10, e o `leadConsultantId` já vale desde o PR 0. Sai cedo porque o motivo some do lead na reabertura, na matrícula e na importação. O PR 4 e o PR 5 mexem no modal de perda e no Kanban: quem sair depois traz a main. A recusa do Upgrade só ganha o id do motivo quando os dois estiverem na main.

#### Riscos

- A #244 achou catálogo com nomes que só diferem pelo espaço do fim. Achar o id pelo nome juntaria motivos diferentes; por isso o `value` vira o id.
- O professor não marca perda (`LeadProfileView.jsx:308`, e o Pipeline não está nas telas dele).
- A correção é decidida pelo lead que a tela tem. Um lead perdido noutra aba e ainda fora de Perda na memória grava como primeira perda e regrava o `lostAt`, como hoje.
- A exclusão do lead apaga o evento.

#### Relatórios que destrava

R006, R007, R021, R022, R023, R024, R025, R026, R099, R141 e R157.

---

### PR 5. Eventos dos funis de cliente

#### O que passa a ser gravado

Em `stronix_interactions`, montados por `clientFunnelEventFields`, puro, em `src/lib/stageMove.js`:

| Campo | Valor |
|---|---|
| `clientFunnel` | `'renewal'`, `'expired'` ou `'upgrade'` |
| `clientFunnelEvent` | `'enter'` (só Upgrade), `'move'`, `'decline'`, `'undo_decline'` e `'reschedule'` (só a nota de reagendamento da Meta) |
| `fromStageId`, `fromStageName`, `toStageId`, `toStageName` | Vencidos: `expiredStageIdOf` (`src/lib/expiredFunnel.js:122-125`) e o nome na hora. Upgrade: `upgradeStageId` e o nome. Renovações: o id e o nome da coluna (`ck:60` e `60 dias`, `src/lib/renewalFunnel.js:77-78`). Perda: id null e nome `'Perda'`. |
| `renewalCheckpoint` | O marco do card (`_renewalDays`) no quadro e o marco ativo na Meta. null fora de Renovações. |
| `contractId` | O `currentContractId` do lead no instante do evento. |
| `via` | `'board'`, `'daily_goal'` ou `'profile'`. |
| `renewalOutcome`, `renewalDeclineReason` | `'declined'` e `'Outro'` nas recusas pelo quadro, que não perguntam o motivo (`src/lib/renewalGoal.js:110-118`). `'rescheduled'` no reagendamento da Meta. |
| `upgradeDeclineReason`, `upgradeDeclineReasonId`, `upgradeEnteredAt` | Na recusa do Upgrade: o motivo do modal de perda com o id (decisão 15) e a cópia do `upgradeEnteredAt` antes de `planUpgradeDecline` apagá-lo (`src/lib/stageMove.js:136-142`). |

Os quatro caminhos de quadro de Renovações e Vencidos, que hoje só fazem `updateDoc` no lead, passam a gravar a interação e o patch no mesmo lote, sem somar `lastInteractionAt` nem `interactionsCount` (decisão 5). Usam o `logInteraction` (`src/lib/interactions.js:26-57`) com a opção `{ bump: false }`, que o PR 1 criou. O Upgrade e a Meta continuam somando, como hoje.

As duas notas da Meta Diária (`src/modals/RenewalOutcomeModal.jsx:151-157` e `167-171`) ganham `clientFunnel` e `clientFunnelEvent` (`'decline'` e `'reschedule'`), mas seguem `type: 'note'`, somando no lead e contando como contato. O `clientFunnel` não decide se o evento é contato: só o `status_change` com `clientFunnel` igual a `'renewal'` ou `'expired'` fica fora (seção 3, regra 11).

Os textos novos não usam colchetes, "perda", "perdid", "renovação", "matrícula" nem "plano ": "Vencidos: movido para a etapa X.", "Vencidos: não vai voltar.", "Vencidos: recusa desfeita, voltou para a etapa X.", "Renovações: não vai renovar, marco de 60 dias.", "Renovações: recusa desfeita.". Os textos do Upgrade e da Meta não mudam.

#### Caminhos que gravam esse fato hoje

- Renovações, recusa no quadro: `declineRenewal` (`src/views/KanbanView.jsx:991-1009`, `updateDoc` na 1002), chamado pelo menu Mover (1041) e pelo arrasto (1136).
- Renovações, volta da recusa: `undoRenewalDecline` (1014-1025, `updateDoc` na 1020), chamado em 1045 e 1101.
- Vencidos, movimento e saída da Perda: `moveExpiredToStage` (906-923, `updateDoc` na 918), chamado em 1056 e 1108. Com `renewalDeclined` no lead, o evento é `'undo_decline'`.
- Vencidos, recusa: `declineExpired` (926-939, `updateDoc` na 934), chamado em 1055 e 1142.
- Upgrade no quadro: `moveUpgradeToStage` (946-963, `logInteraction` na 957), chamado pelo menu Mover (1063) e pelo arrasto (1109), e `declineUpgrade` (967-984, `logInteraction` na 974), chamado pelo `confirmKanbanLoss` na 1175.
- Upgrade na ficha: recusa em `confirmLoss` (`src/views/LeadProfileView.jsx:315-331`) e entrada ou movimento em `handlePhaseConfirm` (384-397).
- Meta Diária, "não vai renovar ou voltar" e reagendar: `src/modals/RenewalOutcomeModal.jsx:149-177`, com a nota da recusa em 151-157 (já grava `renewalOutcome` e `renewalDeclineReason`) e a do reagendamento em 167-171.

#### Leitores que ganham proteção

O evento novo cai em regras de texto que já existem. Cada uma passa a olhar o campo antes do texto:

- `classifyInteraction` (`src/lib/timeline.js:199`) manda para `'contract'` todo `status_change` com "plano ", "renovação" ou "matrícula", menos o prefixo `Upgrade: `. `status_change` com `clientFunnel` passa a cair em `'status'` antes. Nota (`type: 'note'`) da Meta não muda de balde.
- O `isLoss` da ficha (`src/views/LeadProfileView.jsx:1002`) pinta "Oportunidade encerrada" em todo `status_change` sem colchetes com "perda" ou "perdid". Ganha `!i.clientFunnel`.
- `isNonContactEvent` (criado no PR 1) passa a reconhecer `status_change` com `clientFunnel` igual a `'renewal'` ou `'expired'`. Com isso esses eventos ficam fora do primeiro contato do CRM (`src/lib/crm/contact.js:18-23`), do "Já interagido hoje" (`src/lib/leads.js:234-247`) e do índice de último contato (`buildInteractionIndex`, `src/lib/leadStatus.js:71-82`, que o PR 1 já liga à mesma função). O Upgrade fica como está nos três.

#### Arquivos

`src/lib/stageMove.js` (`clientFunnelEventFields`; `planUpgradeMove` e `planUpgradeDecline` devolvem também `interactionFields`, com o `patch` igual), `src/views/KanbanView.jsx` (os quatro `updateDoc` viram `logInteraction` sem soma; o Upgrade espalha os campos; o import de `updateDoc` sai, `KanbanView.jsx:2`), `src/views/LeadProfileView.jsx` (Upgrade e `isLoss`), `src/modals/RenewalOutcomeModal.jsx` e `src/views/DailyGoalView.jsx` (os campos na nota e a etapa passada ao modal), `src/lib/timeline.js`, `src/lib/leads.js`, `src/lib/crm/scope.js` (`CLIENT_FUNNEL_EVENTS_SINCE`) e o `CLAUDE.md`.

#### O que muda e o que não muda na tela

Muda, pela decisão 14: a linha do tempo do cliente ganha uma linha para cada movimento no quadro de Vencidos e para cada recusa ou volta da recusa nos quadros de Renovações e Vencidos. Não muda: o "último contato" da ficha e do cartão do Stronizap (`api/_zapCard.js:60`) e o selo de dias sem contato do card para esses eventos, os quadros, a Meta e o Upgrade.

#### Testes

- Rodam sem edição: os testes de `planUpgradeMove` e `planUpgradeDecline` comparam só o `patch` (`src/lib/__tests__/stageMove.test.js:149`, `157`, `163` e `181`).
- Novos: `clientFunnelEventFields` por funil e evento, sem `toStatus`, `fromStatus` nem `funnelId` e sem `undefined`; `timeline.test.js` (evento com `clientFunnel` cai em `'status'` mesmo com etapa "Plano apresentado"); `crm.contact.test.js`, `leads.test.js` e `leadStatus.test.js` (o evento de quadro não é contato, não acende o aviso e não entra no índice de último contato; a nota da Meta com `clientFunnel` continua contato; o Upgrade continua como hoje); um teste de texto que reprova "perda", "perdid", colchetes e "renovação" nos textos novos.
- Varreduras: `KanbanView.jsx` não importa `updateDoc`; toda chamada de `planUpgradeMove` e `planUpgradeDecline` em `src/views` espalha `interactionFields`.
- Na mão, no preview: arrasto e menu Mover nos três quadros, inclusive sair da Perda; recusa e reagendamento da Meta nas variantes renovação e vencido; Upgrade pela ficha. Os handlers do Kanban não têm teste unitário.

#### Regra e índice

Nenhum. A criação de interação não tem lista de campos para quem não é professor (`firestore.rules:238-239`), e o patch não toca no dono. O professor não alcança esses caminhos, e a regra recusa `status_change` para ele (`firestore.rules:180-191`).

#### Dependências e ordem

Depois do PR 1 (o `isNonContactEvent` e a opção `{ bump: false }`). Não espera o PR 4: os quadros de Renovações e Vencidos não usam o modal de perda. Só a recusa do Upgrade precisa do id que o PR 4 faz o modal devolver; se o PR 5 sair antes, ela grava `upgradeDeclineReason` sem o id, e o id entra quando o PR 4 chegar. Os dois mexem no modal e no Kanban, e quem sair depois traz a main. Não toca em `src/lib/contracts.js`, que é do PR 6.

Não convém deixá-lo para o fim. Toda matrícula ou renovação zera no lead `renewalDeclined`, `renewalDeclinedAt`, `renewalDeclineReason`, `renewalHandledCheckpoints` e `reactivationStageId` (`src/lib/contracts.js:460-467`), e o desfazer da renovação não as devolve (617, pelo `leadSummaryOf` de 521-533). Até este PR entrar, a recusa de quem depois renova ou volta só fica no lead até o contrato novo.

#### Riscos

- O card de Renovações, Vencidos e Upgrade vem de listas carregadas uma vez, e o card projetado traz o nome da coluna em `status`. A etapa do evento sai dos campos de verdade (`reactivationStageId`, `_renewalDays`, `upgradeStageId`), nunca do `status` do card.
- Cada movimento de quadro passa a gravar dois documentos em vez de um.
- O dono e a etapa copiados são os que a tela tinha, que podem estar defasados.

#### Relatórios que destrava

R086, R089, R090, R091, R094, R096, R097 e R110.

---

### PR 6. Contrato que não perde histórico

#### O que passa a ser gravado

Em `stronix_contratos`:

| Campo | Valor |
|---|---|
| `pauseHistory[].reason` | O `pauseReason` do contrato na hora da reativação, copiado só para o item novo em `buildContractResume` (`src/lib/contracts.js:712-750`, item em 734-738). Omitido quando não há motivo. Nunca entra no item refeito (`reconstructed`). |
| `modalityIds`, `modalityNames` | Listas alinhadas por posição, do plano escolhido, por um helper novo em `src/lib/planos.js` que devolve null para id órfão. O `planModalityNames` de hoje filtra os órfãos (`src/lib/planos.js:13-16`) e desalinharia as duas listas. Na correção que troca o plano, regravadas. Lista vazia quando o plano não tem modalidade. |
| `professorId`, `professorName` | O professor do lead no fechamento (decisão 13). Na primeira matrícula, `markConvertingAula` recebe o id do contrato e regrava os dois com o professor da aula que converteu, o mesmo que ele já carimba no lead (`src/lib/aulasWrites.js:188-193`). |
| `upgradeStageId`, `upgradeStageName`, `upgradeEnteredAt` | Copiados do lead antes de `buildMatriculaWrites` zerá-los (`src/lib/contracts.js:471-472`). É a etapa em que o contrato fechou, e o literal diz isso em comentário. O nome sai do catálogo de etapas, que o `ContractModal` passa a receber. O contrato já grava `closedFromUpgrade: Boolean(lead?.upgradeStageId)` (`src/lib/contracts.js:437`), e a importação grava `false` explícito (`src/lib/clientImport.js:559`). É esse booleano, que existe desde antes, que diz "fechou dentro do funil Upgrade"; os campos novos completam com a etapa e a entrada. `upgradeStageId` não nulo implica `closedFromUpgrade` true. |
| `editHistory` | Item `{ changedAt, actorId, actorAuthUid, actorName, kind: 'correcao' \| 'ativacao', from, to }`, mais `impersonated` quando for o caso, só com os campos que mudaram entre `planId`, `planName`, `value`, `listValue`, `durationMonths`, `startsAt`, `endsAt`, `seamless`, `originalEndsAt`, `shortenedById`, `discountMode`, `discountValue`, `discountReason`, `modalityIds` e `modalityNames`. Gravado com `arrayUnion`, fora do `contractPatch`. |

Em `stronix_interactions`, nas interações de contrato:

- `contractEvent`, no vocabulário de `contractEventOf` (`src/lib/timeline.js:142-150`): `'matricula'`, `'renovacao'`, `'cancelamento'`, `'trancamento'`, `'reativacao'`, `'correcao'`, `'ativacao'`. Cada construtor devolve o seu. É o tipo do evento como o texto gravado já diz, e não o tipo da venda: `'matricula'` e `'renovacao'` saem do modo do modal. O leitor de venda aplica a regra da decisão 4 (renovação dentro da tolerância da academia, retorno depois, upgrade pelo funil, matrícula nova sem contrato anterior), como o Gerencial, e nunca usa o `contractEvent` como tipo de venda.
- `contractId`, o id do contrato do fato, e `linkedContractId` quando há contrato ligado (desfazer renovação, correção de renovação, Ativar agora, cancelar o em uso).

Nenhum campo de tipo de venda (decisão 4). Nenhum texto muda.

#### Caminhos que gravam esse fato hoje

- Matrícula e renovação: `ContractModal` (`src/modals/ContractModal.jsx:274`) chama `commitMatricula` (`src/lib/contractsWrites.js:83-199`) e `buildMatriculaWrites` (`src/lib/contracts.js:341-497`, literal em 419-445). Abrem o modal: a ficha (`src/views/LeadProfileView.jsx:1830`), o Kanban (`src/views/KanbanView.jsx:1577`) e a Meta (`src/views/DailyGoalView.jsx:1983`).
- Professor da primeira matrícula: `markConvertingAula`, chamado depois do lote (`src/lib/contractsWrites.js:194-196`).
- Correção: `src/modals/ContractEditModal.jsx:113` com `buildContractEdit` (`src/lib/contracts.js:803-931`) e `commitContractPatch` (`src/lib/contractsWrites.js:20-74`, interação em 59-71).
- Ativar agora: `src/modals/ContractActivateModal.jsx:58` com `buildContractActivate` (`src/lib/contracts.js:944-962`).
- Trancar, reativar, cancelar e cancelar renovação que não começou: `src/modals/ContractOutcomeModal.jsx:199`, com `buildContractPause` (626-640), `buildContractResume` (712-750), `buildContractCancel` (550-571) e `buildRenewalCancel` (591-620).
- Importação: `buildImportedContract` (`src/lib/clientImport.js:529-567`), com os campos novos em null ou lista vazia.

#### Arquivos

`src/lib/contracts.js`, `src/lib/planos.js`, `src/lib/contractsWrites.js` (`contractId`, `linkedContractId` e `contractEvent` nas duas interações; `editHistory` com `arrayUnion`; o id do contrato para `markConvertingAula`), `src/lib/aulasWrites.js` (`markConvertingAula` com `contractId` opcional), os três modais de contrato e os três chamadores do `ContractModal` (a lista de etapas), `src/lib/clientImport.js`, `src/views/settings/ImportClientsSection.jsx`, `src/lib/crm/scope.js` (`CONTRACT_HISTORY_SINCE`) e o `CLAUDE.md`. O `contracts.js` roda no servidor pelo cartão do Stronizap (`api/_zapCard.js:7`, `api/_zapStrip.js:11`), então só importa módulo puro, e o `planos.js` é.

#### O que muda e o que não muda na tela

Nada muda. A aba Contratos já lê pausas, origem e fim de fato dos campos do contrato (`src/lib/contractHistory.js:76-126`, `src/lib/contractsTab.js:155-212`) e pode mostrar o motivo da pausa depois, sem leitura nova.

#### Testes

- Quebram de propósito: `src/lib/__tests__/contracts.test.js:268-284` (o segundo item passa a ter `reason: 'Viagem'`) e `src/lib/__tests__/contractsWrites.test.js:124-144` (a interação ganha `contractId` e `contractEvent`).
- Estendido: `src/lib/__tests__/clientImport.test.js`. A paridade (801-811) confere chave por chave numa lista fixa e o teste de `undefined` (813-820) passa com null, então nada quebra sozinho. A lista de paridade ganha `modalityIds` e `professorId`, e entra o caso dos campos novos em null ou lista vazia.
- Rodam sem edição: `contracts.test.js:1900-1904`, que compara o `contractPatch` da ativação inteiro, porque o histórico vai em `historyEntry`, fora do patch; `contractEditModal.test.js`, `contractActivateModal.test.js`, `contractOutcomeModal.test.js` e `api/__tests__/zapCard.test.js`, que prova que `contracts.js` continua carregando no servidor.
- Novos: modalidades alinhadas (formato novo, `modalityId` legado, plano sem modalidade, id órfão com nome null); professor do lead ou null; etapa do Upgrade dentro e fora do funil, com `closedFromUpgrade` coerente (`upgradeStageId` preenchido só com `closedFromUpgrade` true); `historyEntry` só com o que mudou, `kind` certo e null sem mudança; coerência entre `contractEventOf(interactionText).kind` e o `contractEvent` de cada construtor; `markConvertingAula` com e sem `contractId`; o mock de `arrayUnion`.

#### Regra e índice

Nenhum. O contrato não tem lista de campos, e o update só guarda o `consultantAuthUid` (`firestore.rules:420-430`). O professor não cria nem altera contrato.

#### Dependências e ordem

Nenhuma. Pode sair já, em paralelo aos PRs 1 a 3. Encosta no PR 3 só em `src/lib/aulasWrites.js`, em funções diferentes, e no PR 1b no mesmo `toEqual` de `src/lib/__tests__/contractsWrites.test.js:124-144`. Quem entrar depois traz a main e reescreve o teste.

#### Riscos

- Desde a #234 a ficha tira tipo, plano e valor do evento de contrato do texto (`src/lib/timeline.js:158-173`). O PR só acrescenta campos, e o teste de coerência trava a divergência.
- `buildContractActivate` reaproveita `buildContractEdit`. Sem o `kind`, a ativação apareceria como correção.
- O `editHistory` cobre só o contrato corrigido. O fim do contrato anterior, mudado pelo `previousPatch`, segue reconstruível pelo `originalEndsAt` e pelo `shortenedById`.
- O professor do aluno tem hoje duas fontes que podem discordar: o lead e o registro da aula. O `stronix_faltosos` da Next Fit vira a terceira quando o PR 2 do professor entrar; na main de hoje a coleção não existe em `src`, `api`, `scripts` nem `firestore.rules`. O contrato congela o do lead no dia da venda, e o relatório diz qual usou.
- O `changedAt` é a hora do aparelho, porque `arrayUnion` não aceita `serverTimestamp()` dentro do item. O `updatedAt` do servidor fica no documento.
- A coleção inteira de contratos chega pela assinatura que todo logado tem, e cresce com o `editHistory` e as listas.

#### Relatórios que destrava

R052, R061, R072 e R076. Adianta R049, R054, R056, R057, R070, R084, R148 e R159 (`contractId` e `editHistory`) e R055, R067, R069, R079 e R081 (modalidade e professor congelados). R004 e R065 dependem da origem do contrato, que fica fora.

---

### PR 7. Histórico das réguas

#### O que passa a ser gravado

- `rulesHistory` em `stronix_config/general`: um item por régua alterada, `{ rule, from, to, changedAt, actorId, actorAuthUid, actorName }`, mais `impersonated` quando for o caso. `rule` é `'metaWeekdays'`, `'renewalCheckpoints'`, `'renewalGraceDays'` ou `'slaOverdueDays'`, este de carona, porque passa pela mesma gravação. Entra por `arrayUnion` no mesmo `setDoc` com merge que grava a régua. Não grava item quando o valor normalizado não mudou.
- `dailyVolumeTargetHistory` no cadastro de cada pessoa em `stronix_users`: `{ from, to, changedAt, actorId, actorAuthUid, actorName }`, mais `impersonated` quando for o caso, com null para prospecção desligada, no mesmo `updateDoc` do alvo e só quando ele muda. O alvo é justamente o que o suporte costuma ajustar dentro do Acessar como.

O turno fica fora (decisão 7). O primeiro item responde o que valia antes da primeira mudança registrada, então não precisa de carga inicial.

#### Caminhos que gravam esse fato hoje

- Configurações → Metas & ritmo: `saveConfig` (`src/views/settings/PaceSection.jsx:88-92`), usado pelos dias de meta (95-109), pelo SLA (111-119), pelo período dos vencidos (140-148) e pelos marcos (150-178).
- Alvo individual na mesma tela: `saveUserTarget` (`PaceSection.jsx:122-138`).
- Alvo no cadastro do membro: `updateMember` (`src/views/settings/TeamAccessSection.jsx:366`, gravação em 424-441), que regrava o alvo em todo salvar.
- A `PaceSection` não recebe `appUser` (`src/views/settings/SettingsView.jsx:173`).

#### Arquivos

`src/lib/rulesHistory.js` (novo, puro: `ruleChange` e, para o leitor futuro, `ruleValueAt`), `src/views/settings/PaceSection.jsx`, `src/views/settings/SettingsView.jsx` (passa `appUser`), `src/views/settings/TeamAccessSection.jsx` (compara com o valor de antes antes de juntar o item), `src/lib/crm/scope.js` (`RULES_HISTORY_SINCE`) e o `CLAUDE.md`.

#### O que muda e o que não muda na tela

Nada muda. A configuração é lida campo a campo (`src/App.jsx:847-866`), e a lista nova só viaja junto.

#### Testes

- Não existe teste das gravações da `PaceSection` nem do alvo na `TeamAccessSection`. Os testes do Operacional rodam sem edição.
- Novos: `rulesHistory.test.js` (null quando nada mudou, inclusive lista com os mesmos itens; nunca `undefined`; `ruleValueAt` antes, entre e depois das mudanças, várias no mesmo dia, item malformado ignorado, `changedAt` como `Date` ou `Timestamp`; `impersonated` só quando for true, no item da régua e no do alvo); o patch com duas réguas gera dois itens, e o dos pacotes de aula não gera nenhum.
- Varredura: só a `PaceSection` grava as quatro réguas, só ela e a `TeamAccessSection` gravam `dailyVolumeTarget` pelo navegador, e todas passam por `ruleChange`.

#### Regra e índice

Nenhum. A configuração libera a escrita ao gestor sem lista de campos (`firestore.rules:359-362`), e o cadastro libera ao gestor tudo menos `authUid`, papel e professor ligado (`firestore.rules:282-304`).

#### Dependências e ordem

Nenhuma. Pode subir a qualquer momento. Régua muda pouco, então a perda por atraso é pequena.

#### Riscos

- O documento `general` é assinado por todo logado e cresce a cada clique num dia da semana. Se a lista passar de algumas centenas de itens, vai para um documento separado na mesma coleção.
- O `from` vem do que a tela tinha em memória. Dois gestores ao mesmo tempo podem gravar um `from` defasado; o leitor usa quase sempre o `to`.
- Excluir membro apaga o cadastro e o histórico do alvo junto (`api/admin-users.js`). Só melhora quando o membro passar a ser desligado.
- O próprio consultor pode gravar no próprio cadastro pelo SDK (`firestore.rules:291-304`), como já pode com o alvo hoje.

#### Relatórios que destrava

R069, R086, R087, R089, R101 e R102. Parte de R065 e de R146 (catálogos e funis ficam fora).

---

### PR 8. Regras das duas coleções novas

#### O que passa a ser gravado

Nada no app. Este PR muda o `firestore.rules`, que é publicado à mão no console (ou pelo Firebase CLI com o ok do Johnny, como na #243) antes dos PRs 9 e 10. O arquivo não tem regra genérica, então coleção sem `match` é negada.

```
match /artifacts/{appId}/public/data/stronix_daily_snapshots/{day} {
  allow read: if inTenant(appId) && tenantActive(appId);
  allow create: if inTenant(appId) && tenantActive(appId)
    && day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    && request.resource.data.date == day
    && request.resource.data.actorAuthUid == request.auth.uid
    && request.resource.data.takenAt == request.time
    && request.resource.data.leads is list
    && request.resource.data.keys().hasOnly(['date', 'takenAt', 'version', 'actorId', 'actorAuthUid', 'actorName', 'impersonated', 'leads'])
    && !isProfessor(appId);
  allow update, delete: if false;
}

match /artifacts/{appId}/public/data/stronix_audit_log/{id} {
  allow read: if isSuperAdmin() || (isAdmin(appId) && inTenant(appId));
  allow create: if inTenant(appId) && tenantActive(appId)
    && request.resource.data.actorAuthUid == request.auth.uid
    && request.resource.data.createdAt == request.time
    && request.resource.data.action in ['export', 'lead_delete']
    && request.resource.data.rows is int
    && request.resource.data.keys().hasOnly(['action', 'screen', 'format', 'rows', 'actorId', 'actorAuthUid', 'actorName', 'impersonated', 'createdAt', 'details']);
  allow update, delete: if false;
}
```

A foto é legível por todos (decisão 1) e criada uma vez por dia, por quem vende, como o dia batido (`firestore.rules:383-396`). O registro é lido só pelo gestor e pelo super-admin (decisão 19).

#### Arquivos

`firestore.rules`, as duas listas de chaves como constantes (`src/lib/dailySnapshot.js` e `src/lib/auditLog.js`, que os PRs 9 e 10 completam) e um teste de texto novo.

#### O que muda e o que não muda na tela

Nada. As duas regras são só de acréscimo.

#### Testes

Teste de texto do `firestore.rules`, no molde do `professorRules.test.js`: os dois `match` existem, os dois têm `allow update, delete: if false`, e cada `hasOnly` é igual à lista do código.

#### Regra e índice

É o próprio PR. Nenhum índice: a série da foto é lida por faixa em `date` e o registro por faixa em `createdAt`, com o índice automático.

#### Dependências e ordem

Nenhuma. Publicar no primeiro dia, em paralelo a tudo. Antes de publicar, conferir que o ruleset ativo é o do arquivo, porque o de 06/10 subiu pelo CLI. Depois, testar uma criação e uma alteração no simulador do console ou numa academia de teste.

#### Riscos

- O repositório não tem teste de regra nem emulador. Um erro de digitação só aparece em produção, e é por isso que o teste manual vem antes do deploy dos PRs 9 e 10.
- O `isAdmin` lê o cadastro pelo uid (`firestore.rules:67-71`). Gestor de conta antiga, com o cadastro num id diferente do uid (o caso que o comentário do `isProfessor` descreve em 73-78), não lê o registro, embora a decisão 19 diga que o gestor lê. Antes de publicar, conferir se alguma academia tem gestor assim; se tiver, o vínculo do login legado acerta o cadastro dele, ou o limite fica anotado para o leitor.

#### Relatórios que destrava

Nenhum sozinho. Destrava os PRs 9 e 10.

---

### PR 9. Foto diária dos leads ativos

#### O que passa a ser gravado

Um documento por dia em `stronix_daily_snapshots`, com id `AAAA-MM-DD` (pelo `dgDateKey`, `src/lib/dailyGoal.js:61`), criado uma vez, no primeiro acesso do dia de quem vende (decisão 11):

```js
// stronix_daily_snapshots/2026-10-07
{
  date: '2026-10-07', takenAt: serverTimestamp(), version: 1,
  actorId: 'u-ana', actorAuthUid: 'auth-ana', actorName: 'Ana Souza',
  leads: [
    { funnelId: 'f-com', status: 'Negociação', statusId: 'st-neg',
      consultantId: 'u-ana', consultantName: 'Ana Souza',
      count: 14, overdue: 3, critical: 1 }
  ]
}
```

Só as linhas de leads ativos: uma por combinação de funil, etapa e consultor com pelo menos um lead. O funil sem `funnelId` cai no padrão (`isItemInFunnel`, `src/lib/funnels.js:34`). `overdue` é a condição de `overdueNow` (`src/lib/operacional/routine.js:180`); `critical` é `overdueDaysOf` (`src/lib/dailyGoal.js:263`) maior ou igual ao `slaOverdueDays`, como em `src/views/team/useTeamBoard.js:112`. O agrupamento é pelo `consultantId` cru do lead. Sem percentual e sem total. Clientes, carteira, tarefas e réguas ficam fora: saem dos contratos em qualquer data ou do `rulesHistory`.

A foto leva `impersonated: true` quando quem a tira está no Acessar como. A regra do PR 8 aceita a chave, e um super-admin no Acessar como passa pelo filtro de quem vende (`isSeller`, `src/lib/acesso.js:39`, é quem não é professor). Os números são os mesmos de qualquer outra sessão; a marca só diz quem tirou.

#### Caminhos que gravam esse fato hoje

Nenhum. Etapa, dono e `nextFollowUp` só existem ao vivo. A única foto diária de hoje é o dia batido, gravado pelo navegador (`src/App.jsx:1466-1485`).

#### Arquivos

- `src/lib/dailySnapshot.js` (puro): monta a foto e decide se grava, no molde do `goalHitKeyToRecord`.
- `src/lib/dailySnapshotWrites.js`: confere a contagem de ativos no servidor e grava por transação que só cria, no molde de `src/lib/funnelSetupWrites.js:24-31`, com a academia congelada (`src/lib/setupRun.js`).
- `src/App.jsx`: um efeito ao lado do dia batido (1466-1485). Só com a base carregada, as assinaturas ativas, o papel que vende e uma tentativa por dia e academia, marcada no `localStorage` dentro de `try/catch`.
- `src/lib/firebase.js`: `DAILY_SNAPSHOTS_PATH`, ao lado de `DAILY_GOAL_HISTORY_PATH` (171).
- `src/lib/crm/scope.js`: `DAILY_SNAPSHOT_SINCE`.

#### O que muda e o que não muda na tela

Nada muda.

#### Testes

- Rodam sem edição, e precisam continuar passando: `protecaoDeErro.sweep.test.js` e `filtrosNoEndereco.sweep.test.js`, que leem o `App.jsx`.
- Novos: `dailySnapshot.test.js` (agrupamento, funil padrão, dono fora da equipe com a chave crua, soma de `overdue` igual a `overdueNow`, `critical` pelo SLA, id igual ao `dgDateKey`, `impersonated` só com `impersonating` true; não grava sem base pronta, com assinaturas paradas, com erro de carga, com academia trocada no meio ou com o dia já marcado) e `dailySnapshotWrites.test.js` (só cria; dia existente não é tocado; contagem diferente da memória não grava; sem internet não entra em fila).

#### Regra e índice

A do PR 8, publicada e conferida antes. Nenhum índice.

#### Dependências e ordem

Depois do PR 8 publicado. Cada dia sem este PR é um dia de foto que não volta.

#### Riscos

- A primeira resposta do `onSnapshot` pode vir do cache do aparelho, e depois da pausa por ociosidade o `loadingData` não volta a true (`src/App.jsx:678-685`). Sem espera depois de religar e sem a conferência por contagem, o computador da recepção que dormiu ligado grava o estado de ontem com a data de hoje. A contagem igual reduz o risco, não prova que cada lead está atualizado.
- A hora da foto varia com o primeiro acesso. O `takenAt` fica gravado para o relatório mostrar e descartar foto incoerente com a data.
- Dia sem ninguém fica sem foto, e não volta (aceito pela decisão 11).
- Renomear etapa parte a série pelo nome. O `statusId` resolve daqui para frente.

#### Relatórios que destrava

R012 e R106. Parte de R119 (a carteira de leads; a de clientes sai dos contratos) e de R157.

---

### PR 10. Registro de exclusão de lead e de exportação

#### O que passa a ser gravado

Um documento por ação em `stronix_audit_log`, sem dado pessoal:

```js
{
  action: 'export', screen: 'leads', format: 'csv', rows: 212,
  actorId: 'u-ana', actorAuthUid: 'auth-ana', actorName: 'Ana Souza',
  createdAt: serverTimestamp(),
  details: { funnelId: 'f-com', stageCount: 3, responsibles: [{ id: 'u-ana', name: 'Ana Souza' }] }
}
```

O filtro de responsável vai como lista de `{ id, name }`, pela regra 2 da seção 3: o registro dura mais que a equipe, e o id sozinho fica ilegível quando a pessoa sai. Nome de membro da equipe não é dado de cliente.

- `action`: `'export'` ou `'lead_delete'`. `screen`: o id da tela em `SCREENS` (`src/lib/routes.js:51-67`): `'leads'`, `'aulas'`, `'visitas'`, `'ficha'`, `'settings'`. `format`: `'csv'` ou `'print'`, null na exclusão. `rows`: linhas do arquivo, 1 na exclusão.
- Na exclusão, `details` leva `leadId`, `interactionsDeleted`, `lifecycleBucket`, `funnelId`, `status`, `consultantId`, `consultantName` e `leadCreatedAt`, para o mês fechado que mudar ter explicação. Nunca nome do lead, telefone, CPF, observação nem texto de busca.
- `impersonated: true` quando for o caso.

#### Caminhos que gravam esse fato hoje

- Exportar Todos os leads: `exportToCSV` (`src/views/LeadsView.jsx:130-167`).
- Aulas e Visitas, CSV e Imprimir: `handleDownloadCsv` (`src/modals/AppointmentExportModal.jsx:167-189`) e `handlePrint` (140-165). O modal não recebe `appUser`; `src/views/AppointmentTrackingView.jsx:819-828` passa a repassar.
- CSV de resultado da importação: `downloadReport` (`src/views/settings/ImportClientsSection.jsx:317-328`). O modelo de planilha (`src/lib/importTemplateWrite.js:77-89`) não tem dado de cliente e fica fora.
- Excluir lead: `handleDelete` (`src/views/LeadProfileView.jsx:229-257`). Apaga as interações em lotes de 450 (238-248) e depois o lead num `deleteDoc` solto (249).

#### Arquivos

`src/lib/auditLog.js` (`buildAuditEntry` puro, `logAuditEvent` e a exclusão em lotes, que sai do `handleDelete` para poder ser testada com o Firestore falso), `src/lib/firebase.js` (`AUDIT_LOG_PATH`), as três telas de exportação, `src/views/AppointmentTrackingView.jsx`, `src/views/LeadProfileView.jsx`, `src/lib/crm/scope.js` (`AUDIT_LOG_SINCE`) e o `CLAUDE.md`.

Na exclusão, o registro vai no primeiro lote, junto com as primeiras 449 interações. Se a regra recusar, nada foi apagado. A ordem de hoje fica: as interações saem nos lotes seguintes e o lead por último (`src/views/LeadProfileView.jsx:238-249`), então uma falha no meio deixa a ficha de pé para tentar de novo. A nova tentativa grava outro registro, e o leitor junta os dois pelo `leadId`. Na exportação, o registro é tentado sem esperar e nunca trava o download; a falha vai ao console e ao Sentry sem linha da lista.

#### O que muda e o que não muda na tela

Nada muda. A exclusão passa a falhar com o aviso de hoje se a regra não estiver publicada.

#### Testes

- Novos: `auditLog.test.js` (só as chaves permitidas, que o teste do PR 8 compara com a regra; `rows` inteiro; `details` sem nome de lead, telefone, CPF nem texto; todo id de pessoa em `details` com o nome ao lado; `impersonated` só quando for true). Na exclusão, com o Firestore falso: o registro vai no primeiro lote, o lead sai no último, e a falha no segundo lote deixa o lead gravado.
- Varredura: todo arquivo de `src/views` e `src/modals` com `new Blob`, atributo `download` ou `print()` chama o registro, e todo `deleteDoc` ou `batch.delete` do lead também, com exceção escrita para o modelo de planilha.

#### Regra e índice

A do PR 8, publicada antes. Nenhum índice.

#### Dependências e ordem

Depois do PR 8 publicado. É o último: não alimenta a tela de Relatórios, é controle de acesso a dado pessoal e explicação de mês fechado.

#### Riscos

- O registro mostra o uso do botão, não prova ausência de vazamento: qualquer membro lê a base inteira pelo SDK (`firestore.rules:219`).
- O `leadId` no registro liga aos contratos e aulas que ficam órfãos com `leadName`. Ponto de LGPD que vai junto com arquivar (entrega E).

#### Relatórios que destrava

R147.

---

## 5. Ordem de entrega e dependências

| Onda | PR | Depende de | Corre junto com | Regra à mão antes do deploy | Stronizap | Esforço |
|---|---|---|---|---|---|---|
| 1 | 0 (#246) | nada | 8 | não | não | baixo |
| 1 | 8 | nada | 0, 1, 2, 3a, 4, 6 | é o próprio PR | não | baixo |
| 2 | 1 | 0 | 2, 3a, 4, 6, 7 | não | não | médio |
| 2 | 2 | nada | 1, 3a, 4, 6, 7 | não | não | baixo |
| 2 | 3a | nada | 1, 2, 4, 6, 7 | não | não | baixo |
| 2 | 4 | nada | 1, 2, 3a, 6, 7 | não | não | baixo |
| 2 | 6 | nada | 1, 2, 3a, 4, 7 | não | não | médio |
| 3 | 1b | 0; sai depois do 2, do 3a e do 6 | 3b, 5, 7, 9 | não | não | baixo |
| 3 | 3b | 3a | 1b, 5, 7, 9 | não | não | médio |
| 3 | 5 | 1 (o id da recusa do Upgrade espera o 4) | 1b, 3b, 7, 9 | não | não | médio |
| 3 | 9 | 8 publicado e conferido | 1b, 3b, 5, 7 | sim, a do 8 | não | médio |
| qualquer | 7 | nada | todos | não | não | baixo |
| 4 | 10 | 8 publicado | 7 | sim, a do 8 | não | baixo |

Como fazer o deploy:

- Só o PR 8 pede regra. Ela é publicada antes do merge dos PRs 9 e 10, depois de conferir o ruleset ativo contra o arquivo. Sem a regra, a foto falha calada e a exclusão de lead para de funcionar.
- Nenhum PR pede deploy no Stronizap. Os PRs 1b e 2 mexem em `api/_zapLead.js` e em `api/tenant-resolve.js`, e os PRs 3a e 3b em `api/_zapSchedule.js`, que é um dos arquivos do contrato com o Stronizap. As respostas não mudam, o cartão não muda e o smoke não muda. A Vercel publica `api/` e navegador juntos no merge.
- Nenhum PR cria função na Vercel: seguem 11 das 12.
- Cada PR sai da main. O que depende de outro espera o merge dele, sem PR empilhada: apagar a branch base no merge fecha as PRs filhas.
- Quem trabalha em linhas vizinhas sai um depois do outro, trazendo a main e rodando a suíte inteira: 2 e 1b em `src/lib/leads.js` e `api/_zapLead.js`; 3a e 1b no mesmo trecho de `api/__tests__/zapSchedule.test.js` (987-1066) e em linhas vizinhas de `api/__tests__/zapRoute.test.js` (2025-2047); 6 e 1b no mesmo `toEqual` de `src/lib/__tests__/contractsWrites.test.js:124-144`; 3a, 3b e 6 em `src/lib/aulasWrites.js`; 4 e 5 no modal de perda e no Kanban.
- Depois do PR 0 e do PR 1, avisar o gestor de que a migração de carteira e a troca para professor pedem a página recarregada.
- Se o prazo apertar, os PRs 0, 1, 2, 3a, 4 e 5, mais a publicação do 8 e o 9, seguram a maior parte do que se perde por semana. O 1b vem logo depois: enquanto a pessoa está na equipe, o nome se resolve pelo id.

## 6. O que fica fora e por quê

| Item | Por quê |
|---|---|
| Operacional creditando as marcas de visita, aula e contato pelo `goalOwnerId`, como a Meta | É mudança de leitura e de número em tela. PR à parte, com o ok do Johnny. |
| Autor na marca da Agenda de hoje | Faria o Operacional creditar quem clicou. |
| Passar ou devolver, na migração, as tarefas delegadas de quem sai | Pede decisão sobre para quem vão. Hoje voltam ao dono do lead só no `set-role` e na exclusão (`api/admin-users.js:57-76`). |
| Aviso no sino na migração | Muda o que a pessoa vê. |
| `transferScopes` e motivo da troca de responsável | O escopo já está no texto. O motivo pede campo novo na tela. |
| `toConsultantId` no `zap_signup` e na importação que dá dono | São nascimento ou atribuição, reconhecíveis pelo `type` e pelo `leadConsultantId`. |
| Dono da tarefa como campo na interação do agendamento | Hoje está no texto " · tarefa de" (`src/lib/schedulePatch.js:41`) e no registro, depois do 3a. |
| Corrigir a reserva de `getInteractionSecurityFields` para lead sem dono | Muda o `leadConsultantId` de interações novas, que a Meta lê. A marca `leadUnowned` do PR 1b separa o caso sem mexer na reserva. |
| `lastInteractionAt` no desfecho da Agenda e `outcomeBy*` dentro das interações | Contato é só conversa registrada (decisão 5). O autor do desfecho mora no registro. |
| Fechar o registro aberto na perda, na matrícula e no Adiar | Decisão de negócio no meio. A decisão 17 mantém o Adiar como remarcação. |
| O espelho do lead ganhando do registro de visita fechado no Dashboard CRM | Muda leitor e número em tela. Com a decisão 18, teria de valer só contra o registro mais recente do instante, nunca contra o anterior do mesmo horário. PR de leitura, com o ok do Johnny. Até lá, a correção que falha no registro deixa o desfecho velho no CRM. |
| Botão de trocar o motivo da perda | Tela nova. A correção que existe hoje passa pelo Mudar fase da ficha com outro funil, e com a decisão 22 ela fica no mês da primeira perda (PR 4). |
| De/para na primeira atribuição de professor, pelo carimbo da aula que converteu num lead sem professor (`src/lib/aulasWrites.js:188-193`) e pela importação (`src/lib/clientImport.js:419-421` e `661`) | Decisão 24: a primeira atribuição não é troca. O contrato congela o professor de cada venda (PR 6). O carimbo que troca um professor por outro grava a troca (PR 1). Fica fora, como pergunta para depois, se o carimbo deve mesmo regravar o professor do ex-cliente que volta: o `pickConvertingAula` (`src/lib/aulas.js:108-120`) pega a última aula atendida, que pode ser antiga, e desfaz uma troca feita depois dela. Com o PR 1 essa regravação deixa rastro. |
| Registro da migração de funil da indicação (`src/views/settings/ReferralOwnersSection.jsx:131-149`) | Move funil e etapa de leads em lote sem gravar a troca de etapa por lead (`stageChangeFields`, `src/lib/stageMove.js:51-60`) nem registro de lote. A passagem entre etapas do CRM perde esses movimentos. Entra depois, no molde do registro de lote do PR 1. Nesta entrega, só a nota de hoje ganha a marca do suporte (PR 1b). |
| Marcar desfecho de dia anterior | A correção só vale no dia. Pede tela. |
| Data anterior e contagem de remarcações, confirmação da véspera, motivo do cancelamento de agendamento | Pedem campo e botão novos. |
| Tentativa de cadastro repetido (`attempt*`) | Pede botão no aviso de duplicado. |
| Trava de imutabilidade dos `created*` nas regras e `createdConsultantAuthUid` | Regra em cima da gravação mais frequente do sistema, sem teste de regra. A varredura basta agora. |
| Linha do tempo lendo `lossReason` e `contractEvent` dos campos | É leitura e muda a tela. Fica para a tela de Relatórios. |
| Perguntar o motivo da recusa no quadro e tirar o motivo pré-marcado do modal | Tela nova. Até lá, a recusa pelo quadro nasce "Outro", separada pelo `via`. |
| Evento de entrada em Renovações e Vencidos | É derivado do vencimento do contrato. |
| Etapa do Vencidos no contrato | Sai do último evento do PR 5. |
| Item de histórico no contrato ligado (`previousPatch`) | O fim de antes se reconstrói pelo `originalEndsAt` e pelo `shortenedById`. |
| Saída do Upgrade pela importação sem evento (`src/lib/clientImport.js:689`) | Caso raro. |
| Origem e canal do contrato, `cancelledBy` e `pausedBy` no contrato | A origem pede decisão. O autor do cancelamento e da pausa fica na interação, ligada pelo `contractId`. |
| Histórico do turno | Decisão 7. |
| Meta tirada pelo `set-role` de quem vira professor (`api/admin-users.js:398-400`) | É gravação do servidor sem o cadastro de quem pede à mão. A troca de papel com data é da frente de equipe. |
| Clientes, carteira, tarefas e réguas na foto, e a rotina noturna | Clientes e carteira saem dos contratos. Tarefas pedem os portões do dia batido. Réguas estão no `rulesHistory`. A rotina vem depois, para tapar dia vazio. |
| Exclusão de catálogo e de membro no registro | Entram depois, com a mesma função. A de membro muda com o desligar em vez de apagar. |
| Passe em dias ou aulas | Entrega D. |
| Arquivar lead e desligar membro | Entrega E. |
| Scripts de acerto do passado | Decisão 20. Modo de conferência primeiro, com o ok do Johnny. |
| Ids de etapa e de unidade junto do nome no lead e no registro, marca de dado inferido, canal e resultado do contato, equipe com entrada e saída, indicação com histórico, super-admin | Linhas da seção 6.3 da auditoria que não entraram no plano desta entrega. |
| Trilha à prova de fraude | As regras deixam qualquer membro reescrever lead, interação e contrato. Os campos são para relatório. |

## 7. Atualizações de CLAUDE.md

Cada PR atualiza o `CLAUDE.md` do Stronilead no mesmo PR. Quando entra em produção, ganha uma linha na tabela de últimas atualizações do `CLAUDE.md` da raiz. Os que mexem na ponte (1b, 2, 3a e 3b) acrescentam uma frase na seção da ponte do `06-sistemas/CLAUDE.md`, dizendo que o contrato não mudou.

| PR | O que entra no `CLAUDE.md` do Stronilead |
|---|---|
| 0 | A linha que o commit `7b3eb1e` já traz: o dono na interação é o do dia do fato e nunca é regravado. |
| 1 | Troca de dono grava `ownerChangeFields`; a migração grava um registro por lote com `transferBatchId` e não toca nas interações; troca de professor grava `professorChange` sem somar no lead e aparece na linha do tempo da ficha no balde da troca de responsável (`'status'`, decidido antes do `CONTRACT_RE`), com o tipo Professor, e a primeira atribuição de professor (carimbo da aula que converteu num lead sem professor e importação) não é troca, mas o carimbo que troca um professor por outro grava a troca com `via: 'conversion'`; o `{ bump: false }` do `logInteraction` é o único jeito de gravar interação sem somar no lead; o que `isNonContactEvent` reconhece e os três leitores que o respeitam (`hasActiveInteractionToday`, `isContactInteraction` e `buildInteractionIndex`). |
| 1b | `leadConsultantName` é o dono do lead no dia, o campo oficial (o `ownerName` do `zap_signup` só desenha o marco), e `goalOwnerName` o dono da tarefa; `leadUnowned: true` quer dizer que o `leadConsultantId` é de quem clicou e não dá crédito de dono; qual somar para cada relatório; a marca `impersonated` sai da função central, menos nas gravações sem autor (`actorless`), e os três gravadores à mão a põem sozinhos. |
| 2 | `created*` só na criação, por `getLeadCreationFields`; a lista de `createdVia`; a varredura. Na seção da ponte: o lead do Stronizap nasce com `createdVia: 'stronizap'`. |
| 3a | No item "O registro acompanha o agendamento novo" (`CLAUDE.md:350`): `scheduledBy*` na criação, `rescheduledBy*` só quando o movimento troca o instante, `appointmentOwner*` com o dono efetivo da tarefa (no registro o null não quer dizer "o dono do lead") e `trialClassesPlanned` no registro. |
| 3b | O item "Desfecho da visita" (`CLAUDE.md:349`) é reescrito: o desfecho vai para o registro na hora, o desempate entre dois registros do mesmo instante, o fechamento tardio como rede de segurança e sem autor, o Cancelou de visita fechando o registro como cancelado na hora e o agendamento seguinte abrindo outro (decisão 21), o Remarcou movendo o registro, o leitor do CRM sem mudança, e a exceção de mesmo instante saiu (decisão 18). |
| 4 | Caminho novo de perda usa `lossEventFields` e `lossLeadFields`; o modal devolve nome e id; perda marcada de novo num lead em Perda é correção: o evento leva `lossCorrection` e o lead mantém o `lostAt` da primeira, com o motivo novo (decisão 22). |
| 5 | Evento de funil de cliente se reconhece por `clientFunnel`, e o `contractId` desse evento não o torna evento de contrato; só o `status_change` com `clientFunnel` de Renovações ou Vencidos fica fora de contato, e a nota da Meta continua contato; `logInteraction` com `{ bump: false }` nos eventos de quadro; os textos novos sem colchetes, "perda" e "renovação". |
| 6 | Os campos novos do contrato na seção "Aba Contratos da ficha"; `editHistory` fora do `contractPatch`; evento de contrato se reconhece por `contractEvent`, coerente com o texto, e ele é o tipo do evento, não o tipo da venda (decisão 4); `closedFromUpgrade` e `upgradeStageId` concordam. |
| 7 | Caminho novo que grave régua ou alvo passa por `src/lib/rulesHistory.js`. |
| 8 | As duas coleções, quem lê cada uma e a ordem: regra publicada e conferida antes do deploy. |
| 9 | A foto diária: quando é tirada, o que leva, o que não leva e por quê. |
| 10 | O registro de exclusão e exportação, sem dado pessoal, e a varredura. |

Todos acrescentam a sua constante à tabela de datas de início, numa linha que aponta para `src/lib/crm/scope.js`. O PR 1 escreve ali a regra da data (meia-noite de Brasília do dia seguinte ao merge previsto, acertada pelo PR seguinte se o merge escorregar) e que a marca do suporte vale campo a campo.

## 8. Riscos do conjunto

- Testes de igualdade exata em série. A função central quebra cinco arquivos de teste no 1b; o montador do lead quebra três no 2; `aulaRecordFields` quebra quatro no 3a; o desfecho na hora quebra cinco no 3b; o contrato quebra dois no 6. Seis desses arquivos são quebrados por mais de um PR (`zapRoute.test.js`, `zapSchedule.test.js`, `zapLead.test.js`, `contractsWrites.test.js`, `aulas.test.js` e `aulasWrites.test.js`). Quando é o mesmo trecho, a seção 5 põe os PRs um depois do outro; quando é outro trecho do arquivo, quem sai depois traz a main. Cada PR atualiza os seus e roda a suíte inteira antes do ok.
- Abas abertas com código antigo. O deploy é por merge e ninguém é forçado a recarregar. Por dias haverá lead sem `created*`, perda sem `lossReason` e migração regravando, se feita numa aba antiga. O leitor trata ausência como "sem registro", e as constantes de início dizem desde quando confiar.
- Custo de escrita. Quase tudo vai em gravações que já existem. Crescem: os quatro caminhos de quadro (de um para dois documentos), a troca de professor (uma interação), o lote da migração (um documento a cada 400 leads), a foto (uma por dia por academia) e o registro (um por exportação e por exclusão).
- Custo de leitura. O PR 3b soma uma consulta por desfecho de visita. A foto soma uma contagem e a leitura da transação por dia. A assinatura das interações do mês recebe os eventos de quadro e os lotes. O `general` cresce com o `rulesHistory` e os contratos com o `editHistory`. Nenhum dos três tem teto; a saída é documento separado.
- Regras. Só o PR 8, publicado à mão, sem teste de regra nem emulador. Publicar antes, conferir o ruleset ativo, testar no simulador.
- Histórico reescrevível. Nenhuma regra limita os campos de lead, interação, contrato ou do próprio cadastro. Os campos são para relatório. Se algum virar base de comissão, a regra aperta em outra entrega.
- Excluir lead apaga as interações dele: perda, trocas e eventos de funil somem e mudam mês fechado. Sobrevive o que vai no contrato, no registro de agenda, na foto e no `stronix_audit_log`. A solução é arquivar (entrega E).
- Excluir membro apaga o cadastro e o `dailyVolumeTargetHistory`. É por isso que todo id de pessoa leva o nome ao lado.
- Três pessoas para o mesmo fato (dono do lead no dia, dono da tarefa, autor). O `CLAUDE.md` diz qual somar em cada relatório, e a convenção da seção 3 não deixa um nome valer pelo outro.
- Escrita dupla sem garantia. O registro de agenda e o professor no contrato são gravados depois do lote principal, em `try/catch` que só avisa no console. Na marcação que falha, o CRM de hoje já usa o espelho do lead. Na correção que falha, o CRM conta o desfecho velho até o PR de leitura da seção 6.
- Relógio do aparelho. O `changedAt` das listas e o id da foto usam a hora do computador. O relatório usa a do servidor sempre que existir (`createdAt`, `takenAt`, `updatedAt`).
- Lead em memória defasado. Os cards dos quadros de cliente e a linha da Agenda vêm de listas carregadas antes. Dono, etapa e professor copiados no evento são os que a tela tinha.
- Professor. A atualização de lead pelo professor tem lista fechada (`firestore.rules:166-176`, cobrada pelo `professorRules.test.js`). Nenhum PR desta entrega grava campo de lead que ele alcance. Se um dia o desfecho ou a perda forem abertos a ele, o campo novo entra na lista e em `src/lib/professorWrites.js` juntos.
- Tamanho. São 13 PRs. O que mais perde histórico por semana está nas ondas 1 a 3.
