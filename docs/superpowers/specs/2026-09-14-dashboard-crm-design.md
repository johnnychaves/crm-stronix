---
status: aprovada
---

# Dashboard CRM

Data: 14/09/2026. Branch: `claude/dashboard-crm`.

## 1. Para que serve

O CRM responde se os leads estão virando matrícula: de onde vêm, onde se perdem e quem converte. O Operacional mede o trabalho feito e a saúde da base de clientes. O CRM mede o funil, do lead até a matrícula. A matrícula aparece nos dois com o mesmo número.

A aba já existe no menu (Visão geral → CRM) com a página "Em breve" (`DashboardComingSoonView`, aba `dashCrm`). Esta spec troca essa página pela tela de verdade.

## 2. Decisões do Johnny (14/09/2026)

- Formato igual ao Operacional: mês de competência, comparação com outro mês (pró-rata no mês em andamento), a mesma tela para todos os papéis e filtro de pessoa, em que todos veem todos. A mais: um filtro de funil, com a opção "Todos os funis".
- A troca de etapa passa a ser gravada daqui para frente, com a etapa de origem, a de destino, o funil e a data. Os meses anteriores ficam "sem base". O passado não é recuperado pelo texto da timeline.
- Construção no molde do Operacional: uma função de métricas por mês, com a mesma barra, faixa, destaques e tabela da equipe.
- O visitante (passe livre como categoria própria) fica fora. Volta num projeto próprio das aulas experimentais.
- Ordem das entregas: primeiro a gravação da troca de etapa (PR pequena), depois o prompt para o Claude Design, depois a PR do CRM.

## 3. A tela

**Topo.** O mesmo do Operacional: título, subtítulo e a barra fixa com mês, Comparar e pessoa, mais o seletor de funil. No mês em andamento a comparação é pró-rata. Os três destaques do mês aparecem com Comparar ligado.

**Faixa**, com comparação e tendência de 6 meses:
1. Leads novos
2. Agendamentos (visitas e aulas experimentais)
3. Comparecimento
4. Matrículas
5. Conversão dos leads do mês

**Bloco 1. Funil: onde o lead se perde?**
- Funil por marcos: leads, agendaram, compareceram, matricularam, com os perdidos e os que seguem em jogo.
- Passagem entre etapas: para cada etapa, quantos entraram, quantos avançaram, quantos foram perdidos a partir dela e o tempo mediano na etapa. Só aparece com um funil escolhido, porque cada funil tem etapas próprias.

**Bloco 2. Origem: de onde vêm os leads?**
- Canais, com os leads que cada um trouxe e a conversão.
- Indicação: leads indicados e matrículas vindas de indicação.

**Bloco 3. Quem converte?**
- Tabela da equipe, uma linha por pessoa. Clicar na linha filtra a tela.
- Professores: aulas experimentais realizadas, faltas, matrículas e conversão, com a divisão por modalidade.

**Bloco 4. Perdas**
- Motivos de perda do mês.
- Etapa em que o lead foi perdido.

**Bloco 5. Velocidade**
- Tempo até o primeiro contato: a mediana e as faixas "até 1 hora", "até 24 horas", "mais de 24 horas" e "sem contato".
- Dias do cadastro até a matrícula.

**Bloco 6. Agora**, só no mês em andamento. No mês fechado vira o cartão tracejado, como no Operacional.
- Leads em jogo por etapa.
- Leads sem próximo contato marcado. Eles não aparecem na Meta Diária de ninguém.

**Destaques.** A mesma regra do Operacional: as três maiores mudanças entre o mês e o comparado, sem repetir a faixa. Só entram números com direção clara de melhor ou pior: conversão por canal, motivos de perda, conversão dos professores, tempo até o primeiro contato e dias até a matrícula.

## 4. A regra de cada número

### Recortes

- **Mês.** O mês de competência vai do dia 1 ao dia 1 do mês seguinte. O mês comparado é cortado no mesmo dia do mês em andamento, pela mesma conta do Operacional (`comparisonCut`).
- **Pessoa.** Conta a carteira da pessoa: os leads de que ela é dona (`consultantId`). O contrato grava o dono do lead na venda, então a matrícula por pessoa bate com a do Operacional. Quem está fora da equipe entra na linha "Outros" (`OTHERS_ID`). O card de professores continua com a academia inteira.
- **Funil.** Vale o funil do lead (`funnelId`). "Todos os funis" soma os funis de lead, inclusive o de indicações. Os funis de cliente (Renovações, Vencidos e Upgrade) ficam de fora.
- **Importados.** Lead criado pela importação de planilha (`isImportCreatedLead`, de `src/lib/operacional/routine.js`) não conta como lead novo nem como matrícula.

### Faixa

- **Leads novos:** leads com `createdAt` no mês.
- **Agendamentos:** registros de `stronix_aulas`, de aula e de visita, com `scheduledFor` no mês e `status` diferente de `cancelled`. Pessoa e funil saem do lead do registro (`leadId`). Um reagendamento move o registro e não conta duas vezes.
- **Comparecimento:** entre os agendamentos do mês com data até agora, `attended` dividido por `attended` mais `no_show`. Um registro com data passada que continua `agendada` fica fora da conta e aparece à parte, como "sem desfecho".
- **Matrículas:** leads com `convertedAt` no mês.
- **Conversão dos leads do mês:** dos leads novos do mês, os que têm `convertedAt` até o corte, divididos pelos leads novos. Ao lado aparece quantos seguem em jogo, porque no mês em andamento a conversão ainda sobe.

### Blocos

- **Funil por marcos,** sobre os leads novos do mês e até o corte:
  - agendaram: têm registro em `stronix_aulas` que não foi cancelado, de qualquer data, ou um agendamento em aberto no próprio lead (`appointmentScheduledFor`), que cobre a aula marcada para depois do mês;
  - compareceram: têm um registro `attended`;
  - matricularam: têm `convertedAt`;
  - perdidos: têm `lostAt` e não matricularam;
  - em jogo: o resto.
- **Passagem entre etapas.** Usa as trocas gravadas (§5) e as etapas do funil na ordem do campo `order`. Para cada etapa:
  - entraram: trocas no mês com `toStatus` igual à etapa;
  - avançaram: dessas entradas, as que saíram depois para uma etapa de `order` maior ou matricularam, até o corte;
  - perdidos a partir dela: trocas para Perda no mês com `fromStatus` igual à etapa;
  - tempo mediano na etapa: nas saídas do mês, o tempo desde a entrada na etapa. A entrada é a troca anterior que levou o lead para ela, ou o cadastro, se for a primeira etapa.

  Mês sem trocas gravadas mostra "sem base".
- **Canais:** o `source` dos leads novos, com os leads e a conversão de cada canal, pela mesma regra da conversão dos leads do mês.
- **Indicação:** leads novos com `referredAt` e quantos deles matricularam.
- **Tabela da equipe:** por dono do lead, mostra leads novos, agendamentos, comparecimento, matrículas, conversão e o tempo mediano até o primeiro contato.
- **Professores:** registros de aula, sem visitas, com `scheduledFor` no mês. Por `professorId`, com "Treina sozinho" quando `soloTraining`:
  - realizadas: `attended`;
  - faltas: `no_show`;
  - matrículas: `converted`, a última aula atendida antes da matrícula, pela regra que já existe em `pickConvertingAula`;
  - conversão: matrículas divididas por realizadas, com a divisão por `modality`.
- **Motivos de perda:** leads com `lostAt` no mês, por `lossReason`.
- **Etapa em que o lead foi perdido:** o `fromStatus` da troca para Perda. Só depois da gravação.
- **Tempo até o primeiro contato:** para os leads novos do mês, o tempo corrido do `createdAt` até a primeira interação do lead feita por alguém da equipe. Olha as interações do mês do cadastro e do mês seguinte. Não contam como contato:
  - a observação do cadastro (`note` com texto começando por "OBSERVAÇÃO DO CADASTRO:");
  - `referral`;
  - `import`.

  O lead sem interação nesse prazo entra em "sem contato".
- **Dias até a matrícula:** entre as matrículas do mês, a mediana dos dias de `createdAt` até `convertedAt`.
- **Agora:**
  - leads em jogo (`lifecycleBucket` `ativo`) por etapa (`status`) do funil escolhido. Com "Todos os funis", por funil;
  - sem próximo contato: leads em jogo sem `nextFollowUp`.

## 5. Gravação da troca de etapa (entrega 1)

**Onde.** Todo lugar que muda a etapa de um lead de funil:
- o Pipeline (`KanbanView.jsx`, no arrasto e no menu Mover);
- a ficha (`LeadProfileView.jsx`, na troca de etapa e na perda);
- a matrícula (`contractsWrites.js`);
- o desfecho de agendamento que promove o lead para Negociação (`appointmentOutcome.js`).

A importação e os funis de cliente ficam de fora.

**O que grava:**
- Na interação `status_change`, junto com o texto de hoje: `fromStatus`, `toStatus` e `funnelId`, mais `fromFunnelId` quando o lead troca de funil. O nome da etapa é gravado como estava na hora da troca.
- No lead, `statusEnteredAt` com o horário do servidor, sempre que a etapa muda. No cadastro, `statusEnteredAt` é o momento do cadastro.

**Como.** `planStageMove` e `planLoss` (`src/lib/stageMove.js`) passam a devolver os campos da troca. O horário do servidor entra em quem chama, como já acontece com o `upgradeEnteredAt`.

**Regras do Firestore.** Não mudam. As interações aceitam campos livres, e a alteração de lead não tem lista fechada de campos.

**Custo.** Nenhuma leitura a mais e um campo a mais por gravação.

**Testes.** `planStageMove` e `planLoss` com os campos novos, e um teste para cada montagem de payload que for função pura.

## 6. Carga dos dados e custo de leitura

- **Esquema do Operacional.** O mesmo de `useOperacionalSources`. O mês corrente usa o que já está ao vivo: as interações do mês e os leads em jogo vêm do App. Os meses fechados são buscados uma vez, conferidos pelo cache do aparelho com uma contagem no servidor e guardados na memória da sessão.
- **Memória compartilhada.** As interações e os leads cadastrados no mês que o Operacional já carregou servem ao CRM, na mesma memória de sessão por academia.
- **Consultas novas, de campo único e sem índice para publicar:**
  - leads por `convertedAt` no mês;
  - leads por `lostAt` no mês;
  - `stronix_aulas` por `scheduledFor` no mês.

  Os três campos são Timestamp, conferido em produção em 14/09/2026. O lead de um agendamento que não estiver na memória é buscado pelo id, uma vez por sessão, como a carteira do Operacional.

  Aula e visita se separam no navegador (`isAulaRecord`), nunca com `where` no `type`. O registro antigo não tem o campo, e juntar `type` com o intervalo de `scheduledFor` pede índice composto. Conferido em 14/09/2026: essa consulta falha com `FAILED_PRECONDITION`.
- **Volume real** (STRONIX, de junho a agosto de 2026), por mês:
  - de 89 a 119 leads novos;
  - de 26 a 64 matrículas;
  - de 11 a 14 perdas;
  - de 17 a 58 agendamentos;
  - cerca de 500 interações.
- **Estimativa,** além do que o Operacional já carrega:
  - primeira abertura na sessão, com o cache do aparelho preenchido: cerca de 15 contagens (três consultas por mês fechado) mais de 50 a 130 documentos do mês corrente;
  - primeiro uso do aparelho: cerca de 500 documentos;
  - volta à aba na mesma sessão: perto de zero.

  Se o Operacional não foi aberto na sessão, a parte compartilhada custa o mesmo que custa para ele.

## 7. Fora do escopo e limites

- Visitante e passe livre, num projeto próprio.
- Valores em R$, que ficam para o novo Gerencial.
- Meta, prospecção, tarefas, base de clientes, renovação e cancelamento, que estão no Operacional.
- Funis de cliente (Renovações, Vencidos e Upgrade).
- A passagem entre etapas, o tempo em cada etapa e a etapa da perda só existem depois da gravação. Antes, aparecem como "sem base".
- O primeiro contato só enxerga o que está registrado no sistema. Mensagem de WhatsApp sem registro não conta até a Parte B da ponte com o Stronizap.
- O histórico de agendamentos (`stronix_aulas`) só fica completo a partir da segunda quinzena de julho de 2026, quando a gravação a cada agendamento entrou. Antes disso, os registros vêm da carga inicial, com o agendamento que cada lead tinha na época. Pela contagem de 14/09/2026, a primeira quinzena de julho tem 3 aulas e a segunda tem 33. As visitas aparecem desde 01/06/2026. Nos meses anteriores a agosto de 2026, agendamentos e comparecimento aparecem marcados como parciais.
- Etapa renomeada: o histórico guarda o nome da etapa na hora da troca, então os meses antigos mostram o nome antigo.
- Troca de responsável: a carteira é a de quem cuida do lead hoje, o mesmo limite do Operacional.

## 8. Testes

- As contas puras ficam em `src/lib/crm/`, no padrão de `src/lib/operacional/`, com testes para os recortes, a faixa, o funil por marcos, a passagem entre etapas, os canais, a equipe, os professores, as perdas, o primeiro contato e os dias até a matrícula.
- As contas do Gerencial antigo (`dashboardMetrics.js`) que forem reaproveitadas mantêm os testes.
- As consultas são funções puras com testes, como `queries.js` do Operacional.
- A tela tem teste de render com `renderToString` nos componentes novos.

## 9. Entregas

Cada entrega tem o seu plano.

1. Gravação da troca de etapa, numa PR pequena.
2. Prompt para o Claude Design, salvo em `docs/superpowers/specs/`. O Johnny aprova o visual lá e traz o handoff.
3. PR do CRM: contas, carga e a tela portada do handoff.
