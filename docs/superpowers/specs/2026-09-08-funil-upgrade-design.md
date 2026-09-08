# Funil "Upgrade" no pipeline (board) — design

status: revisão
data: 2026-09-08
autor: Johnny + Claude

Continuação da regra fechada na PR #197: quem virou cliente não volta a ser
lead, em hipótese alguma. A regra resolveu o bug do contrato que sumia, mas
deixou o consultor sem lugar para trabalhar um cliente que ele quer levar a um
plano melhor. Este documento cria esse lugar.

## O problema

Fase e cliente moram no mesmo campo. A etapa do funil é gravada em `status`, e
`status: Venda` é a marca de cliente. Colocar um cliente numa etapa comum
significava sobrescrever essa marca, e foi isso que a PR #197 passou a recusar.

O consultor, porém, precisa de uma esteira para venda adicional: pegar um
cliente ativo e oferecer um plano maior ou mais longo. Hoje ele não tem onde
pôr essa pessoa. O funil Vencidos já resolveu o mesmo impasse para um caso: a
etapa do cliente ali mora num campo próprio (`reactivationStageId`) e o
`status` fica intocado. O Upgrade copia esse molde.

## Decisões (Johnny, 2026-09-08)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Para que serve | **Venda adicional**: personal, nutrição, upgrade de plano ou outro produto para quem já é cliente. |
| 2 | O que fecha | **Troca do plano principal.** O contrato novo substitui o atual, como uma renovação antecipada. Continua existindo um contrato vigente só. |
| 3 | Onde vive | **Funil de sistema no board**, como Renovações, Vencidos e Indicações. Nome "Upgrade". |
| 4 | Etapas | Só a primeira é padrão e protegida: **"Aguardando contato"**. As demais a academia decide. |
| 5 | Quem entra | **Qualquer cliente**, colocado à mão pelo consultor. |
| 6 | Encontro com Renovações | **Fica nos dois.** Ao entrar nos marcos, o cliente aparece no Upgrade e em Renovações, e a Meta cobra a renovação. Nada é removido de lado nenhum; o time combina quem conversa. |
| 7 | Contagem | **A venda é única por cliente.** Um contrato fechado por quem estava no Upgrade e na janela de renovação conta um upgrade e uma renovação nos respectivos relatórios, mas é uma venda só. |
| 8 | Mecânica | **Molde do Vencidos, campo próprio.** Ver "A escolha que define o tamanho disto". |
| 9 | O que é upgrade | **Só se estava no funil na hora de fechar.** Definição por processo. A comparação de plano que o modal já faz (valor ou duração maior) segue só na tela; um plano maior fechado fora do funil não conta como upgrade, e um plano igual fechado de dentro conta. |

## A escolha que define o tamanho disto

A etapa do cliente no Upgrade mora num campo próprio do lead,
`upgradeStageId`. Nada é gravado em `status`, `funnelId`, `lifecycleStage` ou
`isConverted`. É o que mantém a regra da PR #197 de pé: a pessoa segue cliente
na aba Clientes, no cabeçalho da ficha, na Meta Diária e nas métricas por
funil, e ganha só uma posição a mais, num board a mais.

A alternativa de um par genérico `clientFunnelId` e `clientStageId` para todos
os funis de cliente, migrando o Vencidos junto, foi descartada por ora. É mais
limpa no longo prazo, mas mexe num funil em produção e exige migração de
dados, e não há hoje um terceiro funil de cliente à vista que pague isso.

Diferença para o Vencidos: lá o card é derivado do vencimento e ninguém
precisa criar nada. Aqui a entrada é uma decisão do consultor, então o card só
existe depois de alguém gravar a etapa. Não há retroativo nem backfill: no dia
em que subir, o funil nasce vazio.

## A regra que este funil respeita

Cliente não volta a ser lead. Isto se traduz em três limites:

- Mover um cliente dentro do Upgrade grava só `upgradeStageId`.
- Sair do Upgrade zera esse campo e mais nada. A pessoa segue cliente, com
  ficha, contrato e histórico.
- Fechar uma venda pelo Upgrade é gravar um contrato novo pelo mesmo caminho
  de renovação ou de nova matrícula que já existe. Não há um terceiro tipo de
  contrato.

## O funil e suas etapas

Um doc em `stronix_funis` com `name: 'Upgrade'`, `systemKind: 'upgrade'` e
`order: 97`, que o coloca entre Indicações e Renovações na barra (Renovações
é 98, Vencidos é 99). Discriminador é sempre a flag, nunca o nome: a academia
pode ter um funil "Upgrade" próprio e os dois convivem.

Uma etapa nasce junto, em `stronix_statuses`: "Aguardando contato", com
`isSystem: true`, `isEntry: true`, `order: 0`, cor `slate`. Nenhuma outra é
semeada. A academia adiciona as etapas do meio em Configurações, com a forma
padrão dos outros funis: nome do funil travado, entrada protegida, funil não
pode ser excluído, etapas do meio livres. Nada disso é código novo:
`isSystemFunnel` e `isSystemStage` já tratam qualquer `systemKind`.

Venda e Perda não são etapas deste funil. O board as renderiza como colunas
especiais em todo funil, e é assim que o Upgrade fecha ou solta o cliente.

## Provisionamento

Um módulo puro `src/lib/upgradeFunnel.js`, espelho de `expiredFunnel.js`:

- `UPGRADE_FUNNEL_KIND`, `UPGRADE_FUNNEL_NAME`, `UPGRADE_ENTRY_NAME`,
  `UPGRADE_FUNNEL_ORDER`.
- `isUpgradeFunnel`, `getUpgradeFunnel` (duplicata resolve pelo `createdAt`
  mais antigo), `getUpgradeEntryStage` (autocura: `isEntry`, depois `isSystem`
  com o nome padrão, depois menor `order`).
- `planUpgradeSetupOps({ funnels, statuses })`: idempotente. Sem funil, cria o
  funil e a entrada. Com funil e sem entrada, cria só a entrada. Com os dois,
  não faz nada.
- `upgradeStageIdOf` e `projectUpgradeLeads`, descritos adiante. Não há um
  "split" como no Vencidos: quem recusa sai do funil, então a coluna Perda
  não lista ninguém.

No `App.jsx`, um quarto efeito na corrente dos três provisionamentos
existentes, guardado pelo Renovações estar `done`, com carimbo
`upgradeFunnelSetupDoneAt` em `stronix_config/general`. Snapshots frescos por
`getDocs`, como os outros, para não correr com as assinaturas vazias no boot.

## Como o cliente entra

Só à mão, pela ficha. Na aba "Mudar fase" do composer, quando a pessoa é
cliente, o seletor de fases deixa de mostrar os funis de lead e mostra só o
Upgrade e suas etapas. Confirmar grava:

```
upgradeStageId   = id da etapa escolhida
upgradeEnteredAt = serverTimestamp()   (só quando estava fora do funil)
```

e um evento na linha do tempo, tipo `status_change`, com o texto
"Upgrade: entrou na etapa Aguardando contato." ou "Upgrade: movido para a
etapa Em contato.". O texto não usa colchetes de propósito: a linha do tempo
reconstrói a cadeia de fases de lead a partir de "[etapa]" no texto
(`extractStageNameFromInteractionText`, em `src/lib/timeline.js`), e a etapa
de Upgrade não pode entrar nessa cadeia.

Qualquer cliente entra, inclusive quem está em Renovações ou em Vencidos. O
aviso âmbar que hoje diz que cliente não muda de fase passa a dizer o que dá
para fazer: colocar no Upgrade ou mudar a etapa dele lá.

A regra de escrita é pura, em `src/lib/stageMove.js`, ao lado de
`planStageMove` e `planLoss`: `planUpgradeMove(lead, stage)` devolve
`{ patch, entering }`, e o chamador injeta o `serverTimestamp()` quando
`entering` é verdadeiro. A ação em massa na aba Clientes fica para a segunda
entrega.

## Como o board carrega

Aba Upgrade no Pipeline. A consulta é uma só, sem índice manual:

```
stronix_leads  where upgradeStageId != null  orderBy upgradeStageId
```

O `!=` só devolve docs em que o campo existe e não é nulo, que é exatamente
"quem está no funil". Só cliente recebe o campo, então não precisa cruzar com
`lifecycleBucket`. Carrega tudo de uma vez: o funil guarda quem está sendo
trabalhado, não a base inteira, e o Vencidos já faz o mesmo para a contagem.
Carrega só quando a aba está aberta, como os outros funis de sistema.

A contagem na barra de funis sai de `getCountFromServer` sobre a mesma
consulta, uma leitura, no molde do `useFunnelCounts`.

O filtro de responsável vale (`consultantId`). O filtro de atrasados não faz
sentido aqui e é ignorado, como no Vencidos.

## A etapa do card

Projeção em memória, igual à do Vencidos: o status exibido do card vira o nome
da etapa apontada por `upgradeStageId`, e o card recebe `_upgradeCard: true`
para os handlers saberem que precisam gravar esse campo e não `status`. Se o
campo aponta para uma etapa que a academia apagou, o card cai na entrada.

Arrastar entre colunas e o menu "Mover" chamam o mesmo `moveUpgradeToStage`,
que grava `upgradeStageId` e aplica o patch na cópia local depois do ack, sem
recarregar o board. A checagem de permissão mora dentro do helper.

Os cards projetados entram no mapa de arrastáveis por último e sobrescrevendo,
pelo mesmo motivo do Vencidos: o cliente que fechou contrato este mês está na
coluna Venda como doc cru, sem a flag, e o guard não pegaria.

## Como o cliente sai

Dois desfechos, e nenhum deles muda o que a pessoa é.

**Venda.** Soltar em Venda, ou "Mover" para Venda, abre o modal de contrato
com a pessoa. Modo renovação quando há contrato vigente (ativo, a vencer,
agendado ou trancado), porque o contrato novo se liga ao atual e a vigência
emenda; modo nova matrícula quando o contrato está vencido ou cancelado ou não
existe. O modal já lida com plano, valor, desconto e data de início, e já
avisa sobre sobreposição de vigência quando a pessoa escolhe "Começar hoje".

**Perda.** Soltar em Perda, ou "Mover" para Perda, quer dizer "não quis o
upgrade". Abre o mesmo modal de motivo das perdas de lead, e ao confirmar
grava:

```
upgradeStageId    = null
upgradeEnteredAt  = null
upgradeDeclinedAt = serverTimestamp()
```

com o evento "Upgrade: não quis. Motivo: Preço." na linha do tempo. O card
some do board. A coluna Perda do Upgrade não lista ninguém: é só alvo de
soltar. Na ficha, o "Mudar fase" de um cliente que está no Upgrade também
oferece a saída, pelo mesmo modal.

`planLoss` passa a distinguir: lead comum pode virar Perda; cliente no Upgrade
sai do Upgrade; cliente fora dele continua barrado.

## Fechamento e contagem

`buildMatriculaWrites` passa a limpar o Upgrade em todo contrato novo, venha
de onde vier (ficha, board de Renovações, Vencidos ou o próprio Upgrade):

```
leadPatch.upgradeStageId   = null
leadPatch.upgradeEnteredAt = null
contract.closedFromUpgrade = Boolean(lead.upgradeStageId)
```

É o mesmo lugar que já zera `reactivationStageId` por motivo idêntico: sem
isso, o cliente que fechou pelo Vencidos ou pela ficha continuaria parado no
Upgrade com um contrato novo.

A contagem segue as decisões 7 e 9. Renovação continua sendo o contrato com
`renewedFromId`. Upgrade é o contrato com `closedFromUpgrade`, e só ele: a
marca vem do funil, não do plano. O mesmo contrato pode ser os dois, e é uma
venda só: o painel de vendas conta contratos, não flags. O relatório de
upgrades em si fica para a segunda entrega; esta só grava o dado certo desde
o primeiro dia.

Foi considerado e descartado gravar também se o plano cresceu (o modal já
calcula isso para o rótulo "Upgrade" e "Acima do atual"). Johnny preferiu a
definição por processo. Se um dia o relatório precisar da comparação, ela
pode ser gravada no contrato sem mexer em nada disto.

Depois do fechamento, o board do Upgrade recarrega (o cliente saiu do funil) e
a coluna Venda do mês também, como já acontece com a renovação.

## Convivência com Renovações e Vencidos

Nada é automático nas duas direções. Entrar no Upgrade não tira ninguém de
Renovações nem de Vencidos, que são derivados do contrato. Entrar nos marcos
não tira ninguém do Upgrade. A Meta Diária continua cobrando renovação e
vencido pelas regras de hoje; o Upgrade não cria categoria na Meta.

Os chips cruzados ("em Upgrade" no card de Renovações, "renova em N dias" no
card de Upgrade) ficam para a segunda entrega. Os dois cards leem o mesmo doc,
então é trabalho de tela, não de dado.

## Ficha

No cabeçalho, ao lado do selo de fase, um chip "Upgrade · Em contato" enquanto
`upgradeStageId` estiver preenchido. O nome da etapa sai de `statuses`. É o
retorno visual de que a pessoa está sendo trabalhada.

A aba Contratos não muda. O contrato fechado pelo Upgrade aparece como
renovação ou matrícula, que é o que ele é.

## Central de ajuda

O artigo de funis ganha a seção "Upgrade": para que serve, como colocar um
cliente, o que Venda e Perda fazem ali, e que a pessoa continua cliente o
tempo todo.

## Fora de escopo

- Relatório de upgrades no painel (usa `closedFromUpgrade`, que já nasce aqui).
- Chips cruzados entre os cards de Upgrade e Renovações.
- Ação em massa na aba Clientes ("Colocar no Upgrade").
- Categoria própria na Meta Diária.
- Contrato paralelo (personal ao lado do plano principal). Decisão 2 fecha
  isso: o upgrade substitui o plano.
- Qualquer mudança em Vencidos, Renovações ou Indicações.

## Testes

Puros, em `src/lib/__tests__`:

- `upgradeFunnel.test.js`: plano cria funil e entrada quando não existem; não
  recria quando existem; recria só a entrada quando ela sumiu; duplicata de
  funil resolve pelo mais antigo; projeção usa o nome da etapa e marca
  `_upgradeCard`; etapa apagada cai na entrada.
- `stageMove.test.js`: `planUpgradeMove` marca `entering` só quando estava
  fora; mover dentro do funil não toca `upgradeEnteredAt`; `planLoss`
  distingue lead, cliente no Upgrade e cliente fora dele; `planStageMove`
  continua barrando cliente para etapa comum.
- `contracts.test.js`: `buildMatriculaWrites` zera os campos de Upgrade e
  grava `closedFromUpgrade` conforme o lead estava no funil, em matrícula e em
  renovação.
- `timeline.test.js`: o texto "Upgrade: entrou na etapa X." não entra na
  cadeia de fases de lead.

Smoke logado, antes do merge: colocar um cliente pela ficha, ver o card,
arrastar, fechar pela Venda em modo renovação, conferir que sumiu do Upgrade e
apareceu na coluna Venda do mês com o contrato marcado; repetir soltando em
Perda; conferir que o cliente segue na aba Clientes o tempo todo.

## Riscos

- **Cadeia de fases da linha do tempo.** Se o texto do evento carregar
  "[etapa]", a origem e a duração das fases de lead ficam erradas. Mitigado
  pelo texto sem colchetes e por teste.
- **Consulta `!=`.** O Firestore exige que o `orderBy` seja pelo mesmo campo
  da desigualdade; a spec já vem assim. Sem paginação, então não há cursor a
  se preocupar.
- **Modo do modal.** Errar entre renovação e nova matrícula muda se
  `convertedAt` é recarimbado. A regra é a situação do contrato atual, não a
  origem do card, e é a mesma que a ficha já usa.
- **Seletor de fases.** O `PhaseChanger` destaca a etapa atual pelo `status`
  do lead. Para o cliente, a ficha passa um lead projetado com o `status`
  igual ao nome da etapa de Upgrade, só para o destaque; a escrita continua
  em `upgradeStageId`.
- **Card sem etapa.** Etapa apagada em Configurações deixa `upgradeStageId`
  apontando para o nada. A projeção manda o card para a entrada; o primeiro
  arrasto corrige o campo.

## Entrega

Uma PR, branch `claude/funil-upgrade`, com o plano de implementação em tarefas
pequenas: lib e testes, provisionamento, board, ficha, fechamento, ajuda.
Sem regra nem índice novo no Firestore, então não há publicação manual antes
do merge. A segunda entrega (relatório, chips, ação em massa) tem spec
próprio quando chegar a vez.
