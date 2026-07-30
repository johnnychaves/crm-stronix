# Agenda de hoje — presença compartilhada na Meta Diária

status: revisão
data: 2026-07-30

## Problema

A presença de visitas e aulas experimentais de um consultor só chega em outro
por uma regra de turno (`computeDelegatedPresenceSlots`, em `src/lib/dailyGoal.js`).
A regra exige que o dono do lead tenha turno cadastrado **e** esteja fora dele no
horário do agendamento. Na prática isso fecha a porta nos casos mais comuns da
operação:

- Agendamento feito pelo gestor, que não tem turno cadastrado. Nunca delega.
- Lead sem consultor atribuído. Nunca delega.
- Agendamento feito em cliente já matriculado. Não aparece na Meta de ninguém,
  nem na do dono, porque cliente sai do balde `ativo` e é excluído das duas
  rotas da Meta. A ficha do cliente deixa agendar sem avisar nada, então o
  agendamento some em silêncio.

Um teste de 2026-07-30 confirmou o sintoma: aula experimental marcada para as
19h não apareceu para a consultora com expediente das 14h às 22h. A conta do
turno estava certa, o que barrou foi uma das portas acima.

## Decisão

Sai a regra de turno, entra uma **agenda do dia compartilhada**: um painel na
Meta Diária que lista todas as visitas e aulas experimentais agendadas para hoje
na academia, visível para qualquer consultor, com registro de presença aberto a
qualquer um. Sem regra de horário, sem delegação condicional.

Escopo definido com o Johnny:

- Mostra **todos** os agendamentos do dia, inclusive os do próprio consultor.
- Inclui **cliente matriculado**. Exclui lead perdido.
- Só **presença**, veio ou não veio. Sem remarcar, sem Perda, sem mudar etapa.
- **Não conta na meta de ninguém.** É painel operacional.
- O **crédito continua no dono do lead**, como já acontece hoje.

## O que sai

De `src/lib/dailyGoal.js`: `computeDelegatedPresenceSlots`, `isTimeWithinShift`
e `shiftMinutes`, com os 10 testes correspondentes em
`src/lib/__tests__/dailyGoal.test.js`.

De `src/views/DailyGoalView.jsx`: o componente `DelegatedPresenceCard`, o
handler `markDelegated`, o estado `savingDelegatedId` e o memo
`delegatedPresence`. O memo `usersById` **fica**, a agenda usa para resolver
nome do dono e de quem confirmou.

Os campos `shiftStart` e `shiftEnd` continuam em Configurações → Equipe &
acessos como informação de escala do time. Nenhuma lógica passa a depender
deles.

As abas Aulas e Visitas (`AppointmentTrackingView`) não mudam.

## Fonte de dados

Arquivo novo: `src/hooks/useDayAgenda.js`.

Listener ao vivo em `stronix_leads` com range em um campo só:

```
where('appointmentScheduledFor', '>=', inicioDeHoje)
where('appointmentScheduledFor', '<=', fimDeHoje)
```

Range em campo único usa índice automático do Firestore. **Nada para publicar na
mão no console.** É o mesmo recurso que a PR #144 já usa na janela mensal de
interações (`src/App.jsx`, comentário do `interactionsSource`).

Assinatura: `useDayAgenda({ db, enabled, dayKey })`, devolvendo
`{ items, loading }` com os docs passados por `normalizeLeadDoc`, o mesmo shape
do resto do app.

Dois pontos que não podem ser esquecidos na implementação:

1. **`enabled` recebe o `listenersActive`** do portão de atividade, propagado de
   `App.jsx` até a `DailyGoalView` como prop. Sem isso a agenda mantém um
   listener aberto numa aba ociosa a noite toda e desfaz o ganho da PR #164.
2. **`dayKey` entra nas dependências** para recriar a janela na virada da
   meia-noite. A `DailyGoalView` já calcula `todayKey`.

O listener vive na `DailyGoalView`, que só monta na aba da Meta. Fora dela não
existe listener.

## Regra pura

Arquivo novo: `src/lib/dayAgenda.js`. Não entra no `dailyGoal.js`, que já tem
513 linhas e trata de outro assunto (tarefas e meta pessoal).

```
computeDayAgenda({ liveLeads, agendaLeads, usersById, viewerId, now }) → {
  rows,      // linhas ordenadas por horário, crescente
  pending,   // quantas sem desfecho de hoje
  nextIndex  // índice da próxima linha a partir de `now`, ou -1
}
```

Comportamento:

- **Une as duas fontes por id.** `liveLeads` é a assinatura viva já em memória
  e cobre registro antigo que só tem `nextFollowUp` sem `appointmentScheduledFor`
  (`getLeadAppointmentDate` faz o fallback). `agendaLeads` é a consulta e cobre
  cliente e qualquer coisa fora do balde `ativo`. Dedupe por id, a fonte viva
  vence.
- Mantém só tipo `visita` ou `aula_experimental` com data de hoje.
- Inclui `lifecycleStage === 'cliente'`. Exclui `status === 'Perda'`.
- Cada linha carrega: `id`, `name`, `at` (Date), `categorySlug`, `ownerId`,
  `ownerName`, `isMine`, `modality`, `professorName`, `unit`, `outcome`,
  `outcomeByName`, `isClient`.

**O desfecho só vale se for de hoje.** `outcome` é preenchido a partir de
`appointmentOutcome` **somente quando `appointmentOutcomeAt` cai dentro de hoje**.
Sem essa trava a agenda mente: comparecimento preserva o agendamento
(`src/lib/appointmentOutcome.js`) e o wizard de agendamento não limpa
`appointmentOutcome` ao remarcar (`src/views/LeadProfileView.jsx`,
`handleWizardConfirm`). Um lead que veio semana passada e tem aula nova hoje
apareceria já resolvido, e ninguém confirmaria a presença dele.

## O card

Arquivo novo: `src/components/dailygoal/DayAgendaCard.jsx`. Vive na coluna da
direita da Meta, entre o "Próximo" e o "Ritmo do mês". Layout escolhido: trilho
do dia (variante 3 dos mockups).

- **Trilho de ~44px à esquerda** com a hora e uma bolinha por linha. A hora fica
  no trilho, não dentro da linha, então o conteúdo recupera a largura e
  modalidade e professor cabem inteiros.
- Bolinha cinza para pendente, verde para resolvido, laranja na próxima linha a
  partir de agora. A linha da próxima também ganha borda laranja.
- Conteúdo: nome em 12,5px, e abaixo tipo, modalidade, professor e dono em
  10,5px truncado. Cliente ganha um chip discreto.
- Suas linhas ganham um acento laranja na borda esquerda.
- Cabeçalho com contador de quantas linhas ainda não têm desfecho. **Sem
  filtro**: a agenda mostra o dia inteiro, resolvidos junto com pendentes
  (decisão do Johnny, 2026-07-30). Quem abre a agenda quer o movimento do dia,
  não a fila de tarefa, que já é a lista da Meta ao lado. Isso dispensa o
  `toggle-group` do shadcn, que chegou a ser adicionado e saiu junto com o
  filtro.
- Lista com altura máxima e scroll fino, mesmo padrão do "Feitos hoje".
- Dia sem agendamento não renderiza o card.

`PresenceSwitch` (`src/components/ui/PresenceSwitch.jsx`) é reaproveitado como
está. Ele aceita trocar de lado depois de gravado, então clique errado no lead
de um colega é corrigível.

Antes de escrever o componente, invocar a skill `frontend-design` e apresentar o
card renderizado no app para o Johnny aprovar.

## Escrita e crédito

Reusa `writeAppointmentOutcome` com `sourceLabel: 'Agenda do dia'` e
`categorySlug` derivado do tipo da linha. Nenhum caminho de escrita novo.

**Nenhuma mudança nas regras do Firestore.** As regras atuais já permitem que
qualquer membro do tenant leia todos os leads, atualize lead de colega desde que
não troque o dono, e crie interação em lead alheio (`firestore.rules`, blocos de
`stronix_leads` e `stronix_interactions`). Como as regras são publicadas na mão
no console, isso elimina o passo manual.

O crédito vai para o dono do lead, via `daily_goal_done` gravado no lead dele. O
toast nomeia o dono quando a linha não é sua. Quem confirma fica registrado em
`appointmentOutcomeBy` e aparece na linha.

## Casos de borda

- **Cliente.** Confirmar registra desfecho e timeline, mas não cria tarefa em
  meta nenhuma, porque cliente não gera tarefa de aula. A promoção automática
  para "Negociação" já é bloqueada quando o status é `Venda`
  (`src/lib/appointmentOutcome.js`), então o contrato dele não é afetado.
- **Dois consultores confirmando junto.** Último write vence. A linha mostra
  quem ficou registrado. Aceito, o risco real é baixo e o dado é auditável.
- **Virada da meia-noite com a aba aberta.** `dayKey` recria a janela da consulta
  e o recorte da regra pura.
- **Registro sem `appointmentScheduledFor`.** Entra pela fonte viva, desde que
  esteja no balde `ativo`. Registro antigo que seja cliente e só tenha
  `nextFollowUp` fica de fora. É resíduo de dado pré-wizard, sem valor
  operacional hoje.

## Testes

Arquivo novo: `src/lib/__tests__/dayAgenda.test.js`.

1. Une e desduplica as duas fontes por id.
2. Registro só com `nextFollowUp` entra pela fonte viva.
3. Cliente entra, Perda fica fora.
4. Ordena por horário crescente.
5. Desfecho de outro dia não marca a linha de hoje como resolvida (o caso da
   remarcação depois de um comparecimento).
6. Tipo mensagem ou ligação fica fora.
7. Agendamento de ontem ou de amanhã fica fora.
8. `isMine` marca só as linhas do `viewerId`.
9. `nextIndex` aponta a primeira linha a partir de `now`, e devolve -1 quando o
   dia já acabou.

Mais a remoção dos 10 testes de presença cruzada em `dailyGoal.test.js`.

## Arquivos

Novos: `src/lib/dayAgenda.js`, `src/hooks/useDayAgenda.js`,
`src/components/dailygoal/DayAgendaCard.jsx`,
`src/lib/__tests__/dayAgenda.test.js`.

Editados: `src/App.jsx` (propaga `listenersActive`), `src/views/DailyGoalView.jsx`
(troca o card, monta o hook), `src/lib/dailyGoal.js` e
`src/lib/__tests__/dailyGoal.test.js` (remoções).

## Fora de escopo

- Remarcar, cancelar ou mudar etapa a partir da agenda.
- Notificação, som ou badge fora da tela da Meta. Quem não abrir a Meta não vê a
  agenda, igual ao comportamento de hoje.
- Agenda de dias que não sejam hoje. Para período existe a aba Aulas.
- Mexer nos campos de turno ou na tela de Equipe & acessos.

## Riscos

- **Listener sem o portão.** É o risco principal e o mais fácil de cometer. Se
  `enabled` não receber `listenersActive`, a economia da PR #164 volta atrás numa
  aba esquecida aberta. Verificar no code review.
- **Desfecho antigo marcando linha nova.** Coberto pelo teste 5.
- **Presença registrada por engano no lead de um colega.** Mitigado por o
  interruptor ser reversível e por a linha mostrar quem registrou.
