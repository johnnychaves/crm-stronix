# Funil "Vencidos" no pipeline (board) — design

status: ativo
data: 2026-08-17
revisado: 2026-08-18
autor: Johnny + Claude

Continuação de `docs/superpowers/specs/2026-08-17-funil-vencidos-design.md`, que
trata do funil **Vencidos da Meta Diária** (a tarefa diária). Este trata do funil
**Vencidos do board** (a coluna no pipeline). São coisas diferentes com nomes
parecidos, e confundir os dois já custou uma conversa inteira.

## Revisão de 2026-08-18

Três mudanças pedidas pelo Johnny depois que o funil da Meta entrou em produção:

1. **Nome.** Era "Não renovados", passa a ser **Vencidos** — é como ele fala no
   dia a dia. O arquivo foi renomeado junto.
2. **Etapas.** O conjunto fixo de três (Vencido / Em contato / Não volta) sai. O
   funil passa a ter a **forma padrão dos outros**: entrada protegida, etapas do
   meio livres para a academia configurar, e **Venda e Perda protegidas**. Ver
   "O funil e suas etapas".
3. **Escopo.** O **filtro de período no board** (decisões 4 e 5 abaixo) sai deste
   trabalho e vira spec própria. Ele mexe em todos os funis e é a parte mais
   arriscada; o pedido imediato é só o funil existir e ser configurável.
4. **Arrastar para Venda abre o modal de contrato**, não é só posição visual.
   Ver "Arrastar para Venda abre o contrato".

**Sem pontos em aberto.** O spec está pronto para virar plano de implementação.

O modelo derivado-até-o-primeiro-toque (seção "A etapa do card") **não mudou** —
já era o desenho aprovado em 17/08.

## O problema

O funil Vencidos da Meta Diária cobra o cliente que venceu por N dias e depois
solta. Quem atravessa esse período sem voltar simplesmente some: não vira card,
não entra em lista nenhuma, não tem onde ser trabalhado depois. A base de
ex-clientes, que é o público mais barato de reconquistar que uma academia tem,
fica invisível.

Este spec cria o destino permanente dessas pessoas: um funil próprio do sistema
no board, chamado **Vencidos**, onde o cliente cai sozinho ao vencer.

## Decisões (Johnny, 2026-08-17)

| # | Decisão | Escolha |
|---|---|---|
| 1 | O que o cliente vira ao cair no funil | **Continua cliente.** Segue na aba Clientes com ficha, contratos e histórico intactos; o funil é a vitrine de trabalho. |
| 2 | Momento da entrada | **No vencimento.** Acabou o período de renovação, virou inativo, aparece no funil. Convive com a tarefa diária de Vencidos, que tem outro papel. |
| 3 | Como o card existe | **Derivado, sem escrita.** Ver "A escolha que define o tamanho disto". |
| 4 | Volume da coluna de entrada | Resolvido por **filtro de período no board**, mês a mês. ⚠️ **Fora deste spec desde 18/08** — vira trabalho próprio. |
| 5 | Alcance do filtro | **Board inteiro**, todos os funis, com sentido próprio por funil. ⚠️ **Fora deste spec desde 18/08.** |
| 6 | Filtragem pesada | Fica para a feature futura **Relatórios**, fora deste escopo. |

## A escolha que define o tamanho disto

O card **não é criado por ninguém**. O funil é uma leitura: o board busca os
clientes cujo contrato já venceu e desenha um card para cada um. A etapa em que
o card está só é gravada quando o consultor arrasta.

Por que não materializar o card com uma escrita no vencimento: o app é
client-side e não existe rotina rodando de madrugada. Criar uma exigiria função
serverless nova (o plano Hobby da Vercel dá 12 no total, e o repositório já
trata isso como recurso escasso), ou gravar de carona durante a leitura de
alguma tela, o que significa vários consultores gravando a mesma coisa e quem
venceu enquanto ninguém abriu o app ficando de fora.

O derivado entrega o mesmo efeito visível com menos peças: funciona retroativo
(no dia em que subir, toda a base vencida aparece, sem backfill), nada
dessincroniza porque não há estado duplicado, e quem reativa some do funil
sozinho.

## O funil e suas etapas

Funil de sistema, criado sozinho na primeira vez que o app precisa dele, no molde
do funil de Indicações (`src/lib/referrals.js:86-108`). Nome: **Vencidos**.

O discriminador é a flag `systemKind`, **nunca o nome** — a academia pode ter um
funil "Vencidos" próprio e os dois precisam conviver. É a mesma regra do
`REFERRAL_FUNNEL_KIND` (`referrals.js:12`).

### A forma: igual à dos outros funis

Decisão do Johnny em 2026-08-18. O funil tem a mesma anatomia dos demais, e não
um conjunto fechado próprio:

| Etapa | Protegida? | Papel |
|---|---|---|
| **Aguardando contato** (entrada, `isEntry`) | 🔒 sim | Onde o cliente cai sozinho ao vencer |
| *(etapas do meio)* | ✏️ não | A academia cria e renomeia como quiser |
| **Venda** | 🔒 sim | Reconquistado |
| **Perda** | 🔒 sim | Não volta mais |

As três protegidas carregam `isSystem: true` e ficam bloqueadas para edição e
exclusão pelo `isSystemStage()` que já existe (`src/lib/funnels.js:21`), a mesma
trava usada no funil de Indicações. O funil em si também não pode ser excluído e
tem o nome travado — comportamento já implementado em
`src/views/settings/FunnelsSection.jsx:118`.

O app **semeia três etapas do meio** na criação, nenhuma protegida — a academia
renomeia, reordena ou apaga à vontade, e o provisionamento nunca as recria:

| Semeada | Papel |
|---|---|
| **Em contato** | Falou com a pessoa |

**Sem etapa de negociação** (decisão do Johnny em 18/08). Com Venda e Perda já
sendo colunas do board, o funil ficaria largo demais para o volume que costuma
ter, e coluna vazia atrapalha mais que ajuda. A academia adiciona pela tela se
sentir falta: errar para menos custa dez segundos, errar para mais deixa uma
coluna morta que todo mundo olha todo dia.

> **Renome de 19/08:** a entrada chamava-se "Vencido" na primeira versão que foi
> a produção. Como ela é protegida e não pode ser renomeada pela tela, o
> provisionamento ganhou uma passada de `renameStages` e a chave da flag virou
> `expiredFunnelSetupV2DoneAt`, para rodar uma vez a mais em quem já tinha
> provisionado.

> Armadilha para quem for adicionar: uma etapa chamada exatamente `Negociação`
> vira protegida automaticamente (`isSystemStage`, em `src/lib/funnels.js:21`) e
> não pode mais ser apagada pela tela. Nomear "Em negociação" evita isso.

**Não existe etapa "não volta"** (decisão do Johnny em 18/08). Quem recusa é
venda perdida, e o board já tem a coluna **Perda** de sistema — etapa própria
duplicaria o conceito.

Neste funil a coluna Perda mostra quem tem `renewalDeclined`. Soltar um card ali
grava a flag; tirar de lá limpa. **A pessoa NÃO vira `lifecycleBucket: 'perda'`:**
ela continua CLIENTE, com ficha, contratos e histórico, e segue aparecendo na aba
Clientes. É um ex-aluno que não volta, não um lead descartado.

É uma diferença de significado proposital em relação ao resto do app, e foi
confirmada explicitamente pelo Johnny.

"Em negociação" e **não** "Negociação" de propósito: `isSystemStage`
(`src/lib/funnels.js:21`) protege automaticamente qualquer etapa chamada
exatamente `negociação`, e esta precisa ficar livre.

### Arrastar para Venda abre o contrato

Decisão do Johnny em 2026-08-18: **abre o modal de matrícula**, não é só posição
visual.

Em produção o modal de contrato é um só, o `ContractModal`
(`src/modals/ContractModal.jsx`), usado tanto para a primeira matrícula quanto
para renovar. Não existe modal de renovação separado — o `RenewalModal` do
redesign de contratos vive numa branch sem PR. Então "abre matrícula" resolve
sem ambiguidade para o `ContractModal`.

O fluxo fecha sozinho e sem faxina:

1. Consultor arrasta o card para **Venda**
2. Abre o `ContractModal`, o consultor registra o contrato novo
3. O contrato tem vigência futura → o cliente deixa de ser vencido
4. Ele **some da query** do funil, porque a regra derivada só traz vencido

Nenhum card órfão, nenhum estado para limpar na saída. É o mesmo desfecho
descrito em "Como o cliente sai".

**O cuidado que continua valendo:** `buildMatriculaWrites` precisa limpar
`reactivationStageId` junto com os campos de renovação que já limpa. Sem isso, o
cliente que voltou e vencesse de novo daqui a dois anos reapareceria na etapa da
vida passada.

**Se o `RenewalModal` daquela branch entrar em produção um dia**, esta decisão
merece revisão: aí passam a existir dois fluxos e vencido voltando é
conceitualmente renovação, não matrícula nova.

## A regra derivada

Quem aparece: **cliente** (`lifecycleStage === 'cliente'`) com **contrato
vencido** (`deriveLeadContractStatus === VENCIDO`). Sem janela de tempo: o funil
é permanente, ao contrário da Meta, que cobra por N dias e solta. Cancelado e
trancado ficam de fora, igual à Meta: cancelado é rompimento, não vencimento, e
trancado tem a vigência congelada.

Isso pede uma separação em `src/lib/expiredGoal.js`, que hoje mistura duas
perguntas dentro de `shouldPromptExpired`:

- `isExpiredClient(lead, now)` — **novo**, a base: é cliente e o contrato venceu.
- `shouldPromptExpired(lead, now, windowDays)` — passa a ser a base **mais** as
  condições da cobrança diária (dentro do período, sem recusa, sem contato
  marcado). Comportamento idêntico ao de hoje; só se apoia na base.

O funil consome a base. A Meta continua com a regra completa.

## Como o board carrega

Uma query, disparada **só quando o funil Vencidos está selecionado**:
clientes com `currentContractEndsAt` anterior a hoje, ordenados do vencimento
mais recente para o mais antigo, paginados como o board já faz. Quem nunca abrir
a aba não paga leitura nenhuma.

O índice #4 (`lifecycleBucket ASC, currentContractEndsAt ASC`) já cobre:
igualdade no balde mais range e ordenação no mesmo campo. **Nenhum índice novo,
nenhuma regra para publicar no console.**

**O funil não entra em "Todos os funis".** Só aparece quando selecionado.
Misturar cliente inativo com prospecção no board geral desfaria a separação
entre lead e cliente.

## A etapa do card

Campo novo no doc do lead: `reactivationStageId` (id da etapa). Gravado **só
quando o consultor arrasta o card**. Enquanto ninguém arrastar, a etapa é
derivada:

- `renewalDeclined === true` → nasce em **Não volta**
- caso contrário → nasce em **Vencido**

É assim que quem registrou "não vou voltar" na Meta já aparece na gaveta certa,
sem ninguém mexer.

Campo separado, e não o `status` que o Kanban de prospecção usa, porque cliente
é `status: 'Venda'` — sobrescrever corromperia o estado de cliente e a aba
Clientes. O custo é o ponto de integração mais delicado da feature: **o arrastar
do board precisa de uma bifurcação**, gravando `reactivationStageId` quando o
funil aberto é o Não renovados e `status` em todos os outros.

## Como o cliente sai

Sozinho: reativou, o contrato novo tem vigência futura, ele deixa de ser vencido
e some da query. Sem faxina, sem card órfão.

Um cuidado que evita um bug silencioso daqui a um ano: `buildMatriculaWrites`
precisa limpar `reactivationStageId` junto com os campos de renovação que já
limpa. Sem isso, o cliente que voltou e vencesse de novo dois anos depois
reapareceria na etapa da vida passada.

## Filtro de período no board

Vale para **todos os funis**, com sentido próprio em cada um:

- **Não renovados** → "venceu neste mês" (`currentContractEndsAt`)
- **demais funis** → "entrou neste mês" (`createdAt`)

Navegação mês a mês, com o mês corrente e a possibilidade de voltar. Três regras
que protegem contra o risco de esconder trabalho ativo:

1. **Padrão "todos"** nos funis de prospecção. Quem usa o board hoje não sente
   diferença nenhuma ao abrir.
2. **Padrão "mês corrente"** só em Não renovados, que é onde o volume dói.
3. **Não persiste entre recargas.** O filtro vive na sessão e volta ao padrão ao
   recarregar. Filtro ligado e esquecido é como um lead ativo some da vista de
   um consultor por uma semana sem ninguém entender por quê.

Quando ligado, o filtro fica **visível como chip destacado**, com um clique para
limpar, no lugar onde o board já mostra os filtros ativos.

## Fora de escopo

- **Relatórios**: feature futura, decidida nesta conversa, para filtragem e
  cruzamento pesados sobre toda a base. A filtragem robusta mora lá; o filtro
  deste spec é o recorte simples da tela de trabalho.
- Etapas adicionais no funil (a academia acrescenta pelo editor, se sentir falta).
- Campanha ou disparo em massa a partir do funil.

## Testes

Regra pura (`expiredGoal.test.js`, estendendo o arquivo que já existe):

- `isExpiredClient`: entra cliente vencido de ontem e de dois anos atrás; não
  entra contrato ativo, a vencer, agendado, cancelado, trancado, cliente legado
  sem vigência, nem quem não é cliente
- `shouldPromptExpired` continua com o comportamento de hoje, agora apoiado na
  base (os testes existentes seguem verdes sem alteração — é o sinal de que a
  separação não mudou nada)
- etapa derivada: com `renewalDeclined` nasce em "Não volta", sem ele nasce em
  "Vencido"

O teste que mais importa, porque é contraintuitivo e alguém vai querer
"consertar" no futuro: **o mesmo cliente aparece no funil e na Meta ao mesmo
tempo durante os primeiros N dias, e isso está certo.** O teste precisa afirmar
isso em voz alta.

Filtro: a função pura que traduz "mês selecionado + funil" em janela de datas e
campo de comparação, testada direto (mês corrente, mês anterior, virada de ano,
funil sem filtro).

## Riscos

**A bifurcação no arrastar.** É a mudança que toca código em produção usado o dia
inteiro. Precisa de teste que garanta que arrastar num funil de prospecção
continua gravando `status` exatamente como hoje.

**Contagem das colunas com paginação.** O número na coluna reflete o que foi
carregado, não o total da etapa. É como o board já se comporta; confirmar o
comportamento exato na implementação e, se ficar confuso com centenas de
vencidos, mostrar o total à parte.

**Sem trabalho manual no Firebase.** Nenhum índice novo, nenhuma regra nova.

## Entrega

Dois PRs, nesta ordem:

1. **Funil Não renovados** — regra derivada, provisionamento do funil, carga no
   board, etapa do card e a bifurcação do arrastar. Entrega valor sozinho, com
   paginação segurando o volume.
2. **Filtro de período no board** — todos os funis, com os padrões e a proteção
   descritos acima.
