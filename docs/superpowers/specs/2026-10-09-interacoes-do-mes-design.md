---
status: revisão
---

# Interações do mês sem reler o mês inteiro

Hoje o Stronilead relê todas as interações do mês, da academia inteira, toda vez que alguém abre o app ou volta depois de mais de meia hora parado. Esta spec troca a forma de montar essa lista: o dia de hoje continua ao vivo, e os dias anteriores do mês saem do que o aparelho já guardou, conferidos por uma contagem no servidor. As telas não mudam e nenhum número muda.

Levantamento feito em 09/10/2026, depois da medição de leituras do mesmo dia. É o item 1 da medição. O item 3, as listas inteiras de leads de Todos os leads e Configurações, está na PR #255. O item 2, os contratos, terá spec própria.

---

## O problema, medido

O `App.jsx` mantém ao vivo uma consulta em `stronix_interactions` com `createdAt >= início do mês`, sem limite, para a academia inteira e para todo mundo que entra. Uma consulta ao vivo que fica mais de 30 minutos desligada é cobrada inteira quando religa. Ela desliga quando a aba fecha e quando a pausa por inatividade de 15 minutos fecha o portão. Na prática, cada pessoa paga o mês inteiro algumas vezes por dia: quando chega, depois do almoço e depois de cada intervalo maior.

| | STRONIX | Shape One |
|---|---|---|
| Interações do mês em 09/10 | 379 | 715 |
| Interações de setembro inteiro | 1.657 | 1.419 |
| Interações por dia, perto de hoje | ~40 | ~50 |

Estimativa com a frequência de uso do Sentry: umas 14 mil leituras por dia agora e até 45 mil no fim de um mês cheio. O gráfico mostra o efeito: de 96 mil leituras em 30/09 para 40 mil em 01/10, quando a lista do mês voltou a ficar vazia.

---

## Quem usa a lista do mês

A lista chega a cinco telas e a um cálculo do próprio App. Nenhum outro lugar a lê: nem o sino, nem o título da aba, nem as Rotinas, nem a ficha, que tem a consulta própria por lead (`useLeadTimeline`).

| Quem usa | O que lê | Período que precisa |
|---|---|---|
| Selo da Meta no menu e registro do dia batido (`App.jsx`, `computeDailyGoalSlots`) | marcas `daily_goal_done` de hoje, inclusive as de colegas que ficam com a pessoa pelo `goalOwnerId` | hoje |
| Meta diária (`DailyGoalView.jsx`) | marcas de hoje, "já interagiu hoje", prospecção de hoje | hoje |
| Meta diária, "Prospecção do mês" (`volumeMonth`) | `volumeKind` da pessoa nos dias de meta | o mês inteiro |
| Operacional (`useOperacionalSources.js`, `src/lib/operacional/`) | prospecção por dia, tarefas feitas, marcos de renovação | o mês inteiro; o mês atual também é o "mês seguinte" dos meses fechados |
| CRM (`useCrmSources.js`, `src/lib/crm/`) | troca de etapa, primeiro contato, desfecho de visita, leads citados | o mês inteiro; o mês atual também acompanha a safra do mês passado |
| Pipeline (`KanbanView.jsx`) | última interação de cada lead, para o "sem contato há N dias" | o que houver no mês |
| Todos os leads (`LeadsView.jsx`) | interação nas últimas 24 horas, para o lead quente | 24 horas, que entram no dia de ontem |

Ou seja, três telas precisam do mês inteiro. Por isso a lista que o App entrega continua sendo o mês inteiro.

---

## O que o levantamento garantiu

- **Interação não é editada.** Toda gravação cria um documento novo: `logInteraction`, o desfecho de agendamento, contratos, indicações, importação, as ações do Stronizap e a indicação pública. As gravações com `merge` desses arquivos são todas no lead. A correção de desfecho grava uma marca nova (`outcomeCorrection: true`).
- **A hora é sempre do servidor.** Todos os que criam interação usam `serverTimestamp()`. Nenhuma interação nasce com data no passado, nem a da importação, nem a gravada offline, que recebe a hora em que chega ao servidor.
- **A única exclusão é o "Excluir lead"** do gestor (`LeadProfileView.jsx`), que apaga todas as interações daquele lead, de qualquer data. A migração de carteira não mexe em interação (`donoDaEpoca.sweep.test.js`).

Juntando as três coisas: no período antes de hoje, nenhum documento entra e nenhum muda. Só pode sumir, quando um lead é excluído.

---

## O desenho

As telas continuam recebendo a mesma lista, `interactions`, com o mês inteiro. O App passa a montá-la em duas partes.

### 1. Hoje, ao vivo

A consulta ao vivo passa a ser `createdAt >= meia-noite de hoje`, no relógio do aparelho, que é o mesmo corte que a Meta usa para "hoje". Ela continua da academia inteira, sem filtro de pessoa: a Meta precisa das marcas dos colegas, e a marca da Agenda não leva `actorAuthUid`.

Na virada do dia, a consulta troca sozinha para o dia novo. A consulta do mês de hoje só é refeita quando o portão religa, nunca à meia-noite. Com a consulta do dia isso não serve, porque a aba aberta atravessaria a meia-noite presa à véspera.

### 2. Os dias anteriores do mês, guardados no aparelho

O período é de `início do mês` até `meia-noite de hoje`. No dia 1º ele é vazio e não lê nada. Fora isso, é montado em três passos:

1. **O que o aparelho já tem.** Leitura no cache persistente do Firestore (`getDocsFromCache`), que não custa nada.
2. **O que entrou desde a última vez.** Cada aparelho guarda, por academia e por mês, até quando ele viu as interações completas: o instante da última resposta do servidor da consulta de hoje, ou o fim do período quando ele foi lido inteiro. Essa marca fica no `localStorage`, que o navegador limpa junto com o cache quando alguém apaga os dados do site. O app busca no servidor só o intervalo da marca, menos 5 minutos de folga, até a meia-noite de hoje. É o mesmo desenho dos leads do mês corrente no Operacional, que já buscam só desde a âncora, com folga (`currentMonthLeadsWindow`). Na prática é a noite de ontem, depois que a pessoa foi embora.
3. **A conferência.** Uma contagem no servidor do período inteiro (`getCountFromServer`, 1 leitura a cada mil documentos). Se o que o aparelho juntou tem o mesmo número de documentos do servidor, a lista está certa. Se não tem, o app lê o período inteiro do servidor, como faz hoje.

A contagem é suficiente porque, nesse período, só pode sumir documento. Se falta algo no aparelho, ou se algo foi apagado no servidor, os números não batem e o app relê tudo. O único caso que passa é o aparelho ter perdido exatamente tantos documentos quantos foram apagados no servidor, no mesmo período. Para isso é preciso juntar um cache incompleto com uma exclusão de lead. O resultado seria um painel com números errados até a próxima conferência.

### 3. A lista do mês

O App junta as duas partes, sem repetir id, normaliza como hoje (`createdAt` pelo `getSafeDate`) e entrega a mesma lista às mesmas cinco telas. Nenhuma tela muda.

### Quando conferir de novo

- **Ao abrir o app:** os três passos.
- **Na volta da pausa por inatividade:** a lacuna e a contagem. A consulta de hoje religa como já religa hoje, mas agora só com o dia.
- **Na virada do dia:** o dia que acabou passa para o período anterior. Ele já está no aparelho, porque a consulta de hoje o recebeu, então custa só a contagem.
- **Na virada do mês:** o período anterior começa vazio e a marca do mês passado deixa de valer.

### Exclusão de lead

No aparelho do gestor que excluiu, as interações do lead saem da lista na hora. Nos outros aparelhos, a parte de hoje sai na hora, como já sai hoje. A parte dos dias anteriores sai na próxima conferência: a volta da pausa, um F5 ou a virada do dia. Hoje ela sai na hora em todos os aparelhos.

### Professor

O professor deixa de assinar as interações do mês. A Meta dele é o `ProfessorGoalPlaceholder` e ele não abre Pipeline, Todos os leads nem os painéis. A ficha dele continua com a consulta própria por lead.

---

## Quanto deve economizar

Hoje, cada sincronização cobra o mês até agora: 379 a 1.657 leituras na STRONIX e 715 a 2.400 na Shape One, conforme o dia do mês. Depois, cada sincronização cobra as interações de hoje (40 a 50), mais 1 leitura de contagem, mais a lacuna desde a última vez daquele aparelho. O mês inteiro só é lido na primeira vez em cada aparelho, quando o cache foi apagado, ou quando a contagem não bate.

Estimativa: de umas 14 mil leituras por dia hoje, e 45 mil no fim do mês, para 2 a 4 mil por dia.

---

## Como provar que nenhum número muda

- **Teste de equivalência.** Para um mês sintético com interações de vários dias, a lista montada (hoje mais dias anteriores) tem que ser igual à lista da consulta do mês. Com as duas, o `computeDailyGoalSlots`, o `metricsOf` do Operacional e o `metricsOf` do CRM têm que dar o mesmo resultado.
- **Testes da montagem**, em node e sem tela: o período e a lacuna em cada dia do mês, inclusive no dia 1º, na virada do dia e na virada do mês; a junção sem repetir id; a decisão da contagem (bateu, faltou, sobrou).
- **Teste do hook** com o Firestore simulado: cache cheio e contagem certa não leem o período no servidor; cache vazio lê; contagem diferente lê; a consulta de hoje troca na virada do dia; o portão desliga e religa a consulta de hoje.
- **Varredura:** as cinco telas continuam recebendo a lista do mesmo lugar. O professor não assina.
- **Medição depois do deploy**, pelo mesmo gráfico de 10 em 10 minutos do Cloud Monitoring.

---

## Cuidados

- **Um corte de dia só.** As duas partes usam a mesma meia-noite, a do aparelho. Se uma usasse a hora do servidor e a outra a do aparelho, uma interação perto da meia-noite cairia nas duas ou em nenhuma.
- **O cache pode descartar documentos.** O cache persistente usa o descarte padrão do Firestore, que só age quando o cache passa de 40 MB. Um mês de interações tem uns 2 MB. Se descartar, a contagem não bate e o app relê.
- **O cache pode ter só parte do período.** A consulta por lead da ficha guarda interações de dias anteriores. Esse cache parcial faz a contagem não bater, e o app relê o período inteiro uma vez.
- **Sem cache persistente** (aba anônima, IndexedDB bloqueado), o passo 1 volta vazio, a contagem não bate e o app lê o período inteiro, que é o custo de hoje.
- **O registro do dia batido** continua como está. Ele não espera as interações carregarem, o que já é assim hoje e não piora.

---

## Fora desta spec

- **Os contratos** (o item 2 da medição), que vão ter spec própria.
- **A linha do tempo da ficha**, que já tem consulta própria por lead.
- **A diferença na importação.** O `clientImportWrites.js` diz que a interação de importação não conta no "já interagiu hoje", mas o `hasActiveInteractionToday` não a exclui. Isso não muda aqui.

---

## Decisões para o Johnny

1. **Exclusão de lead em outros aparelhos.** As interações dos dias anteriores do lead excluído saem dos painéis na próxima conferência (volta da pausa, F5 ou virada do dia), e não na hora. Os leads excluídos são poucos, e só o gestor exclui. Pode ser assim?
2. **Professor sem a lista do mês.** Ele não usa a lista, e deixar de assinar economiza o mês inteiro por sincronização de cada professor. Pode ser assim?
