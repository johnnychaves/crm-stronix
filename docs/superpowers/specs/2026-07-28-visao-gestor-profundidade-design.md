# Visão do gestor: profundidade operacional

status: revisão
data: 2026-07-28
telas: Meta da equipe, Visão geral · Operacional

## O problema

O gestor tem dois painéis (Operacional e Gerencial) mais a Meta da equipe, e nenhum
deles desce até a raiz. O card do consultor no Operacional mostra "7 follow-ups
atrasados" e "3 no-shows a reagendar" sem dizer quem são. A tabela da Meta da equipe
mostra "5 pendências, com críticas" sem dizer de qual categoria nem de qual lead. Pra
cobrar o time, o gestor sai da tela, vai no Kanban e garimpa na mão.

O gráfico "Trajetória do mês" da Meta da equipe tem 150px, responde só "quantos
bateram a meta em cada dia" e na prática virou um seletor de dia.

## Escopo

Duas entregas, duas PRs independentes.

**PR 1 (este spec).** A raiz clicável. A Meta da equipe é substituída pela tela do
handoff `design_handoff_meta_equipe`. Os números do Operacional passam a abrir a
lista de leads por trás deles. Mais duas correções de regra que a tela nova expõe.

**PR 2 (spec próprio depois).** Cobrança leve: o gestor marca itens na lista, o lead
recebe um sinal que aparece dentro da Meta do consultor, e o gestor vê depois quantos
dos que ele cobrou foram resolvidos. Esboço no fim deste documento, o suficiente pra
PR 1 não fechar porta.

## Decisões tomadas

Todas com o Johnny, em 2026-07-28.

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Onde a lista abre | Consultor expande na própria linha (Meta da equipe); número abre painel lateral (Operacional) | Expandir compara consultores sem perder a tabela. O painel lateral vira componente único e depois serve os KPIs do Gerencial sem reescrita. |
| Nome do lead | Clicável, abre a ficha via `openProfile` | Mesmo caminho que Kanban, Leads, Clientes e busca global já usam. |
| Volta da ficha | Tela volta fechada | `openProfile` troca o `<main>` inteiro e a view desmonta. Guardar o estado exige subir pra fora da view, e navegação já gerou regressão na PR #144. Se incomodar na prática, é aditivo depois. |
| Dia perfeito com alvo 0 | Mantém a regra atual: exige cota | O mockup dá o selo a quem não tem cota. Mantido como está pra não mudar regra visível em produção nesta PR. |
| Denominador do mês | Só dias programados encerrados, hoje fora | Contar hoje faz todo mundo começar a manhã devendo um dia que nem começou. Muda nas duas telas juntas. |
| Nomes na prospecção | Mostrar | O handoff diz que não existem. Existem: `listVolumeActionsInRange` já devolve `leadId` e `leadName`. |
| Cobrança | Camada leve, não central de notificação | A Meta do consultor já é o canal. O que falta é registro e desfecho, não mais um aviso. |

## PR 1

### 1. Meta da equipe: a tela nova

Fonte da verdade visual: `design_handoff_meta_equipe/README.md` e
`Meta da Equipe.dc.html`, seção `#3a`. Hex, px, pesos e ordem saem de lá. As seções
`#1a`, `#1b` e `#2a` são registro da decisão e não se implementam.

Estrutura, de cima pra baixo: cabeçalho, cartão das duas réguas com a régua de dias
no rodapé, cartão da tabela do dia. Gráfico 268px, tabela fechada 262px.

O componente `MonthTrajectory` atual sai inteiro.

#### Cabeçalho

Título, mês e a contagem de dias programados encerrados. À direita os dois números
que resolvem a leitura de três segundos:

- **em dia agora**: quantos consultores estão com a meta de hoje zerada, ou seja
  `progress === 100`. Quem não tem tarefa hoje conta como em dia.
- **críticas**: a soma, no time inteiro, de tarefas pendentes com
  `overdueDaysOf(lead) >= slaOverdueDays`.

#### Cartão 1: as duas réguas

Uma linha por consultor, nome no centro em coluna de 150px, duas barras crescendo em
direções opostas.

Esquerda, meta diária: dias batidos sobre dias programados encerrados no mês. Azul
`brand-600`, vermelho abaixo de 60%.

Direita, prospecção: ações do mês sobre alvo acumulado. Laranja `accent-500`,
vermelho abaixo de 60%. Consultor com alvo 0 fica com a trilha transparente e o
rótulo "sem cota", nunca 0%.

#### A régua de dias

Fica na costura entre os dois cartões: fecha o gráfico e abre a tabela. Um botão por
dia **programado**, sem célula de folga. O medidor embaixo do número mostra quantos
bateram sobre o tamanho do time. O rótulo à esquerda ("DIA DO MÊS" e "quantos
bateram, de N") é obrigatório: sem ele a régua não se explica.

#### Cartão 2: a tabela do dia

Colunas: Consultor, Meta diária (barra e "6/11 tarefas"), Situação, Prospecção,
chevron. A coluna Situação carrega a leitura: "meta batida" em verde, "5 críticas"
em vermelho, "3 pendentes" em neutro.

A linha inteira é botão. Uma linha aberta por vez.

#### A linha aberta

Abre na própria linha, não em gaveta, com o gráfico visível.

Esquerda, a carteira do dia: as 6 categorias da Meta (Novos 24h, Visitas de hoje,
Aulas experimentais, Contatos agendados, Follow-ups atrasados, Renovações) em grid de
2 colunas, cada uma com contador e a lista nominal de leads. Cada lead tem um ponto de
estado (concluído, pendente, crítico), o nome e à direita a hora ou "atrasado 4d".
Concluído sai riscado e com opacidade reduzida.

**O nome do lead é um botão que chama `openProfile(lead.id)`.**

Direita, a prospecção do dia: o número grande, quanto falta pra cota, e a lista das
ações. Diferente do handoff, **a lista sai nominal**: cada ação mostra o tipo, o lead
e a hora, com o nome clicável. Ação cujo lead já saiu da base ativa mostra só tipo e
hora.

#### Degradação por dia selecionado

Dia passado guarda o resultado, não as tarefas. A tela anuncia isso em vez de
esconder.

| | hoje | dia passado |
| --- | --- | --- |
| Meta diária | barra e "6/11 tarefas" | "bateu" / "não bateu" |
| Situação | críticas e pendentes | vazio |
| Prospecção | "5 de 7" | total do dia |
| Linha expansível | sim | não |

#### De onde vem cada número

| Elemento | Fonte |
| --- | --- |
| Asa esquerda | `computeRitmo(history, metaWeekdays)`, com o denominador ajustado pra excluir hoje |
| Asa direita | `computeVolumeInRange(..., monthStart, null, metaWeekdays)` sobre `volumeTargetFor(u) × dias programados encerrados` |
| Régua de dias | `teamHistory` agrupado por `date`, filtrado por `metaWeekdays` |
| Tabela, coluna Meta | `slotTotals(computeDailyGoalSlots(...))` |
| Coluna Situação | pendentes por categoria e `overdueDaysOf(lead) >= slaOverdueDays` |
| Categorias da linha aberta | `computeDailyGoalSlots` (`categorySlugs`, `categoryStatus`) |
| Hora e "atrasado 4d" | `getLeadAppointmentDate`, `nextFollowUp`, `overdueDaysOf` |
| Prospecção nominal | `listVolumeActionsInRange` (`at`, `label`, `leadId`, `leadName`) |
| Dia passado, bateu ou não | existência do doc em `DAILY_GOAL_HISTORY_PATH` |

### 2. Operacional: os números clicáveis

Um componente novo de painel lateral, usado por qualquer número do dashboard. Recebe
título, subtítulo, a lista de leads e como renderizar a coluna da direita. Fecha por
Esc, por clique fora e por botão. No celular ocupa a tela toda.

Passam a abrir esse painel, no card de cada consultor:

- "N follow-ups atrasados", ordenado por dias parados
- "N no-shows a reagendar", com a data da falta
- os três números do trio (Agendou, Compareceu, Matrículas), cada um com os leads do
  dia

Os dados já estão em memória. `computeConsultantDayBoard` hoje devolve só contagens;
passa a devolver também as listas, sem leitura nova no Firestore.

### 3. Correções de regra

**Renovação fora da Meta do gestor.** `useTeamGoals.js:73` e
`DailyGoalTeamView.jsx:228` chamam `computeDailyGoalSlots` sem `renewalCheckpoints`,
então a Meta que o gestor vê ignora a categoria Renovação e diverge da tela do
consultor. Fica mais grave com a tela nova, que renderiza Renovações como uma das 6
categorias.

**Denominador do mês.** `computeRitmo` e `countMetaDaysInMonth` contam hoje. Passam a
contar só dias programados encerrados. Muda também o número na tela do consultor, e as
duas telas precisam mudar juntas pra não divergirem.

**Laço duplicado.** `computeDailyGoalSlots` tem o mesmo bloco de reconciliação escrito
duas vezes (linhas 367 a 374 e 382 a 389). É idempotente, então não altera resultado,
mas dobra o trabalho. Sai um.

## Limitações conhecidas

**Prospecção do mês subconta lead novo.** A asa laranja mede o mês inteiro, mas
`leads` em memória só traz `lifecycleBucket == 'ativo'` desde a PR #144. Lead
cadastrado no dia 3 que já virou cliente ou foi perdido não entra na conta. Os
agendamentos não têm o problema, porque as interações do mês vêm todas.

Assumido nesta PR: a barra sai como está e o rótulo diz "ações do mês" sem promessa de
exatidão histórica. Contar lead novo pela interação de cadastro em vez do lead resolve,
mas é trabalho a mais e precisa de verificação própria. Fica registrado pra decidir na
revisão.

**Dia passado não reconstrói tarefas.** Limitação de gravação, não de tela. A tela
declara.

## Testes

A matemática nova entra em `src/lib/__tests__/dailyGoal.test.js`, junto do que já
existe:

- denominador do mês exclui hoje, em dia programado e em folga
- `computeDailyGoalSlots` com `renewalCheckpoints` traz a categoria Renovação
- `listVolumeActionsInRange` devolve nome quando o lead está na base e degrada pro
  tipo quando não está
- régua de dias ignora folga e conta acertos só em dia programado
- consultor com alvo 0 não recebe dia perfeito

Verificação na tela: preview logado como gestor, expandir uma linha, clicar num nome,
conferir que a ficha abre e que o Voltar traz de volta. Selecionar um dia passado e
conferir a degradação.

## PR 2, esboço

Só o que a PR 1 não pode contradizer.

O gestor marca um item na lista (na linha aberta ou no painel lateral). A marca vive
no lead, não numa coleção nova: campo com quem cobrou, quando e de qual categoria.
Some quando a tarefa é concluída.

Na Meta do consultor o lead marcado sobe na lista e ganha um sinal, com badge de não
lido no padrão da Central de Suporte (PR #128). Pro gestor, a mesma lista mostra
depois quantos dos cobrados foram resolvidos.

Sem sino no header, sem inbox, sem coleção nova.

## Fora de escopo

- Gerencial: fica pra depois, mas o painel lateral da PR 1 já nasce pronto pra ele
- Central de notificação (camada 3)
- Guardar tarefas de dias passados
- Gravar `leadId` em ações de prospecção: já é gravado, não precisa
