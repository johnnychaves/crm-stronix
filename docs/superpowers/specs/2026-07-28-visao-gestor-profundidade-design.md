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
| Denominador do mês | Alvo cheio do mês, hoje conta | **Revisto em 2026-07-30**, ver "Escala das réguas" abaixo. |
| Nomes na prospecção | Mostrar | O handoff diz que não existem. Existem: `listVolumeActionsInRange` já devolve `leadId` e `leadName`. |
| Cobrança | Camada leve, não central de notificação | A Meta do consultor já é o canal. O que falta é registro e desfecho, não mais um aviso. |

Estas quatro saíram de achados do Johnny em cima da tela já rodando, em 2026-07-30.
Cada uma tem seção própria mais abaixo.

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Escala das réguas | Alvo cheio do mês, com marca de ritmo | Ver "Escala das réguas". |
| Onde fica a régua de dias | No cartão da tabela, não no das asas | Ver "Onde fica a régua de dias". |
| Dia passado expande? | Sim, com a prospecção | Ver "Degradação por dia selecionado". |
| Nome do lead na prospecção | Gravado na interação | Ver "Nome do lead no extrato". |

## PR 1

### 1. Meta da equipe: a tela nova

Fonte da verdade visual: `design_handoff_meta_equipe/README.md` e
`Meta da Equipe.dc.html`, seção `#3a`. Hex, px, pesos e ordem saem de lá. As seções
`#1a`, `#1b` e `#2a` são registro da decisão e não se implementam.

Estrutura, de cima pra baixo: cabeçalho, cartão das duas réguas com a régua de dias
no rodapé, cartão da tabela do dia. Gráfico 268px, tabela fechada 262px.

O componente `MonthTrajectory` atual sai inteiro.

#### Cabeçalho

Título, mês, o total de dias programados e quantos já encerraram. À direita os dois números
que resolvem a leitura de três segundos:

- **em dia agora**: quantos consultores estão com a meta de hoje zerada, ou seja
  `progress === 100`. Quem não tem tarefa hoje conta como em dia.
- **críticas**: a soma, no time inteiro, de tarefas pendentes com
  `overdueDaysOf(lead) >= slaOverdueDays`.

#### Cartão 1: as duas réguas

Uma linha por consultor, nome no centro em coluna de 150px, duas barras crescendo em
direções opostas.

Esquerda, meta diária: dias batidos sobre **todos** os dias programados do mês. Azul
`brand-600`.

Direita, prospecção: ações do mês sobre a cota acumulada do mês inteiro. Laranja
`accent-500`. Consultor com alvo 0 fica com a trilha transparente e o rótulo
"sem cota", nunca 0%.

As duas trazem a marca da posição esperada para hoje, e ficam vermelhas quando a barra
está mais de 10 pontos atrás dela. Detalhe em "Escala das réguas".

#### A régua de dias

Fica no cabeçalho do cartão da tabela, que é o que ela filtra (ver "Onde fica a régua
de dias"). Um botão por dia **programado**, sem célula de folga. O medidor embaixo do número mostra quantos
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
| Meta diária | barra e "6/11 tarefas" | "bateu" / "não bateu" / "folga" |
| Situação | críticas e pendentes | vazio |
| Prospecção | "5 de 7" | total do dia |
| Linha expansível | sim, carteira + prospecção | **sim, só prospecção** |

A carteira de um dia passado não é reconstruível: o fechamento grava que a meta foi
batida, não quais tarefas existiam. A **prospecção é**, e o handoff errou aqui — ela não
vem de histórico, sai das interações com `volumeKind` e dos leads criados no dia, que
têm data e hora. Então o extrato nominal de qualquer dia do mês existe igual ao de hoje.

Em dia passado a linha expande com a prospecção, e no lugar da carteira vai um aviso que
diz se a meta foi batida e por que o detalhe não existe. Consultor sem cota não expande
em dia passado: sem carteira e sem cota, sobrariam dois avisos e nada mais.

Alcance: as interações carregadas são só as do mês corrente (PR #164). Como a tela é
sempre do mês atual, cobre todos os dias da régua.

#### De onde vem cada número

| Elemento | Fonte |
| --- | --- |
| Asa esquerda | `computeRitmo(history, metaWeekdays)` — mês inteiro no denominador |
| Asa direita | `computeVolumeInRange(..., monthStart, null, metaWeekdays)` sobre `volumeTargetFor(u) × countMetaDaysInMonthAll(...)` |
| Marca de ritmo | `countClosedMetaDaysInMonth(...) ÷ countMetaDaysInMonthAll(...)` |
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

### Escala das réguas

Duas leituras possíveis, e elas não convivem no mesmo número.

*Alvo até agora* (primeira versão, descartada): denominador = dias encerrados × cota.
"50%" significa "fez metade do que já devia". É comparável em qualquer ponto do mês,
mas não diz quanto falta pro fechamento, e o denominador muda todo dia.

*Alvo cheio do mês* (escolhido): denominador = todos os dias programados do mês × cota,
e hoje conta no numerador. "45%" significa "cumpriu 45% da meta do mês". A barra enche
até o fechamento, que é o modelo mental que o Johnny descreveu.

O preço é perder a leitura de ritmo, que o denominador curto dava de graça: no dia 2
todo mundo aparece com 8%. Isso volta como uma **marca** na barra, na posição esperada
para hoje (dias encerrados ÷ dias do mês). Barra à frente da marca, adiantado; atrás,
devendo.

Consequências:

- `computeRitmo` conta o mês inteiro em `monthHits` e `monthTarget`, com hoje incluído.
  `streak` e `history14` não mudam.
- Nasce `countMetaDaysInMonthAll`. `countClosedMetaDaysInMonth` continua, agora só para
  posicionar a marca.
- O numerador da prospecção vira `computeVolumeInRange(..., monthStart, null, metaWeekdays)`.
- A cor de alerta deixa de ser um corte fixo de 60% e passa a ser relativa à marca, com
  folga de 10 pontos (~2 dias). Sem a folga, quem está um dia atrás no fim do mês
  aparece em vermelho; sem o corte relativo, todo mundo aparece em vermelho no dia 3.
- Muda o "X/Y metas no mês" na tela do consultor, que usa a mesma função. As duas telas
  mudam juntas, senão divergem.

`countMetaDaysInMonth` fica como está: a tela do consultor usa ela na conta de
prospecção do mês com hoje incluído nos dois lados.

### Onde fica a régua de dias

O handoff pôs a régua no rodapé do cartão das asas, chamando de "dobradiça". Mas as
asas são do mês e não reagem a ela: clicar num dia e ver o cartão de cima parado parece
número errado. A régua passa a ser o cabeçalho do cartão da tabela, que é o que ela
filtra, e o cartão das asas ganha o título "Acumulado do mês · não muda com o dia
selecionado".

Não se fez as asas seguirem o dia porque a régua da esquerda mede "dias batidos sobre
dias do mês", que só existe sobre um intervalo. Num dia isolado ela viraria um sim ou
não, duplicando a coluna Meta da tabela.

### Nome do lead no extrato

O extrato resolvia o nome pelo lead em memória, e a base carregada só tem os ativos
desde a PR #144. Então ação em cliente (mensagem de renovação, o caso mais comum)
aparecia como "Mensagem agendada" no lugar do nome.

Dois consertos. O primeiro: `listVolumeActionsInRange` recebia a fatia de leads do
consultor, mas a ação é atribuída a quem a **fez**, então ação em lead de outro
consultor também perdia o nome; passa a receber a lista inteira, e a contagem não muda
porque a função filtra por `consultantId` internamente. O segundo: `logInteraction`
grava `leadName` no documento da interação, e o extrato usa esse nome quando o lead não
está em memória. `logInteraction` é o ponto único de escrita, então cobre os quatro
caminhos que geram `volumeKind` de uma vez.

Vale só daqui pra frente. Ação antiga segue sem nome, e a linha diz "lead fora da base
ativa" em vez de exibir o tipo da ação como se fosse nome.

É o primeiro write-path que esta PR toca; até aqui era tudo leitura. Sem regra nova de
Firestore (a criação de interação não restringe campos) e sem índice novo.

**Laço duplicado.** `computeDailyGoalSlots` tem o mesmo bloco de reconciliação escrito
duas vezes (linhas 367 a 374 e 382 a 389). É idempotente, então não altera resultado,
mas dobra o trabalho. Sai um.

## Limitações conhecidas

**Prospecção do mês subconta lead novo.** A asa laranja mede o mês inteiro, mas
`leads` em memória só traz `lifecycleBucket == 'ativo'` desde a PR #144. Lead
cadastrado no dia 3 que já virou cliente ou foi perdido não entra na conta. Os
agendamentos não têm o problema, porque as interações do mês vêm todas.

Decidido com o Johnny em 2026-07-28: aceitar por ora. A barra sai como está e o rótulo
diz "ações do mês" sem promessa de exatidão histórica. O erro é sempre pra baixo, então
ninguém aparece melhor do que é.

Duas saídas foram descartadas. Contar lead novo pela interação de cadastro não serve:
`isRegistrationNote` casa texto que começa com "OBSERVAÇÃO DO CADASTRO:"
([leads.js:142](../../../src/lib/leads.js)), e lead cadastrado sem observação não gera
interação nenhuma, então erraria mais que o jeito atual. Consultar a coleção de leads
do mês também não: adiciona query numa tela de uso diário, que é o tipo de leitura que
a PR #144 cortou.

O conserto de verdade, se um dia fizer falta, é gravar `volumeKind: 'lead_novo'` na
criação do lead, do mesmo jeito que agendar já faz. Vale só daí pra frente, o mês
corrente e o passado seguem tortos de qualquer forma.

**Dia passado não reconstrói tarefas.** Limitação de gravação, não de tela. A tela
declara.

## Testes

A matemática nova entra em `src/lib/__tests__/dailyGoal.test.js`, junto do que já
existe:

- `computeRitmo` conta o mês inteiro no denominador e hoje no numerador, e nunca passa
  de 100%
- `countMetaDaysInMonthAll` respeita a política de dias e é sempre maior ou igual ao
  total de dias encerrados
- `computeDailyGoalSlots` com `renewalCheckpoints` traz a categoria Renovação
- `listVolumeActionsInRange` resolve o nome em três degraus: lead em memória, `leadName`
  gravado na interação, travessão
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
- Guardar tarefas de dias passados: é o que faltaria pra carteira de dia passado
  existir. Vale só do dia da implantação em diante e não recupera nada. Fica pra PR 2.
- Recuperar o nome de ação antiga em lead fora da base ativa: exigiria ler os leads
  faltantes por id, que é a leitura que a PR #164 cortou.
- Gravar `leadId` em ações de prospecção: já é gravado, não precisa
