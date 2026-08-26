# Funil "Renovações" no pipeline (board) — design

status: ativo
data: 2026-08-20

Terceiro funil de sistema do Stronilead, ao lado de **Indicações**
(`src/lib/referrals.js`) e **Vencidos** (`src/lib/expiredFunnel.js`). Fecha a
triagem automática que faltava: o cliente entra no board sozinho quando o
contrato encosta no primeiro marco de renovação, e sai sozinho para o funil
Vencidos no dia em que o contrato vence.

```
lead ──matrícula──> cliente ──90d p/ vencer──> RENOVAÇÕES ──vence──> VENCIDOS
                       ^                            │
                       └────────── renovou ─────────┘
```

## O problema

A renovação já é cobrada todo dia na **Meta Diária** por marcos configuráveis
(`src/lib/renewalGoal.js`, marcos 90/60/30 por padrão). O que não existe é a
visão panorâmica: quem está na janela de renovação, quantos são, quanto falta
para cada um vencer e quem já foi tocado. Hoje isso só dá para saber tarefa por
tarefa, um consultor de cada vez.

O board é onde essa foto mora nos outros funis. Faltava a dele.

E faltava o elo da esteira: o cliente que não renova simplesmente vence, e só
aparece de novo no funil Vencidos. Entre o primeiro marco e o vencimento ele
não tem lugar nenhum no pipeline.

## Decisões (Johnny, 2026-08-20)

1. **Pipeline permanente, não fila de tarefas.** O cliente entra faltando o
   maior marco (90 dias por padrão) e o card **só** sai renovando ou vencendo.
   Tratar o marco não tira o card do board (isso é papel da Meta Diária).
2. **A coluna é o marco, e o marco é tempo.** "90 dias", "60 dias", "30 dias".
   O card anda de coluna sozinho conforme o contrato se aproxima do fim.
3. **Ninguém arrasta entre marcos.** As colunas seguem o relógio do contrato, e
   arrastar mentiria na tela. Arrasto só vale para Venda e Perda.
4. **Colunas virtuais.** Nenhum documento em `stronix_statuses`. O board lê
   `renewalCheckpoints` da config e desenha as colunas na hora.
5. **Uma query por coluna**, cada uma com seu "carregar mais". Todas as colunas
   nascem cheias e a aba custa ~30 leituras para abrir.
6. **A Meta Diária não muda em nada.** Continua cobrando marco a marco como
   cobra hoje.

## A escolha que define o tamanho disto

O molde já existe. `src/lib/expiredFunnel.js` (PRs #184/#185) resolveu o
problema difícil: **o cliente não é movido para o funil de sistema, ele é
projetado nele**. O `status` do documento continua `Venda` e o
`lifecycleBucket` continua `cliente`; o que muda é só o `status` EXIBIDO, em
memória, no momento de montar o board.

Isso é o que faz o funil funcionar **retroativo, sem backfill e sem card
órfão**: as 5 academias em produção ganham o board cheio no primeiro login,
sem uma escrita sequer nos leads.

Renovações herda o molde inteiro e ainda simplifica, porque ninguém arrasta
entre etapas: **não existe campo de etapa gravada**. O Vencidos precisa de
`reactivationStageId` (e de zerá-lo em `buildMatriculaWrites`); aqui a coluna é
100% derivada, sempre.

**Custo em campos novos no lead: zero. Em índices: zero. Em regras do
Firestore: zero.**

## O funil

Documento em `stronix_funis`:

```js
{ name: 'Renovações', systemKind: 'renewal', order: 98 }
```

`order: 98` põe ele entre Indicações e Vencidos (`order: 99`) na barra de
funis, que é a ordem da esteira.

O discriminador é **sempre** a flag `systemKind`, NUNCA o nome — a academia
pode ter um funil "Renovações" próprio e os dois precisam conviver. Mesma
regra dos outros dois (`isSystemFunnel`, em `src/lib/funnels.js`).

Duplicata (corrida do provisionamento em duas abas de admin) resolve
determinístico: vence o `createdAt` mais antigo, igual a
`getExpiredFunnel`/`getReferralFunnel`.

## As colunas são virtuais

O funil nasce **sem nenhuma etapa**. O board monta as colunas a partir de
`renewalCheckpoints` (Configurações → Metas & ritmo), em ordem decrescente:

```
Metas & ritmo:  marcos = 90, 60, 30
                         ↓  (na hora, sem escrita)
Board:   90 dias │ 60 dias │ 30 dias │ [Venda] │ [Perda]
```

Trocar os marcos para 120/90/60/30 faz o board abrir com quatro colunas no
render seguinte. Nada para provisionar, nada para sincronizar, impossível
desalinhar config e board.

O preço: a academia **não** pode renomear nem acrescentar coluna neste funil.
É o preço certo — a coluna não é uma etapa de conversa, é uma faixa de tempo.

### Teto de 6 colunas

`normalizeRenewalCheckpoints` (`src/lib/leadStatus.js:58`) limpa cada marco (1 a
365, sem repetido) mas **não limita quantos marcos** a academia pode cadastrar.
Isso era inofensivo enquanto os marcos só alimentavam a Meta Diária; agora que
cada marco vira uma query, 20 marcos custariam 200 leituras por abertura da aba.

O board renderiza no máximo os **6 maiores** marcos. Os demais continuam valendo
normalmente na Meta Diária, só não viram coluna.

Corta-se por cima, nunca por baixo: a coluna menor que sobra cobre `[0, C_min]`,
então **nenhum card fica órfão**. Cortar os maiores encolheria a janela do board
e deixaria cliente dentro do alcance configurado sem lugar nenhum.

Seis colunas já enchem a largura da tela (6 × 264px, mais Venda e Perda) e
custam 60 leituras para abrir.

### A coluna de cada card

Sai de `activeRenewalCheckpoint(diasParaVencer, marcos)`, em
`src/lib/renewalGoal.js` — a **mesma função** que a Meta Diária usa para
decidir qual marco está ativo. Um lugar só decide o marco, então board e Meta
nunca contam histórias diferentes.

Com marcos [90, 60, 30]:

| Dias para vencer | Coluna |
|---|---|
| 87 | 90 dias |
| 61 | 90 dias |
| 60 | 60 dias |
| 45 | 60 dias |
| 12 | 30 dias |
| 1 (vence amanhã) | 30 dias |

O contrato que vence **hoje** não aparece aqui: o corte é o instante atual e a
data de vencimento é gravada à meia-noite, então ele já é `< corte` desde as
00:00 e está no funil **Vencidos**. É o mesmo critério que `deriveContractStatus`
usa no resto do sistema, então os três concordam.

A regra é `min{ C ∈ marcos : C >= diasParaVencer }`, ou seja a coluna C cobre
o intervalo `(marcoMenorAnterior, C]`.

## Como o board carrega

Uma query por coluna, todas sobre o índice **#4 que já existe**
(`lifecycleBucket ASC, currentContractEndsAt ASC`):

| Coluna | `currentContractEndsAt` |
|---|---|
| 90 dias | `> hoje+60d` e `<= hoje+90d` |
| 60 dias | `> hoje+30d` e `<= hoje+60d` |
| 30 dias | `>= hoje` e `<= hoje+30d` |

Cada uma com `lifecycleBucket == 'cliente'`, `orderBy currentContractEndsAt
ASC` (mais urgente no topo da coluna), `limit KANBAN_PAGE_SIZE` (10) e seu
próprio "carregar mais".

Abrir a aba custa ~30 leituras, e **só de quem abrir**: as queries rodam com
`enabled: isRenewalView`, igual ao Vencidos. Quem nunca abrir a aba não paga
leitura nenhuma.

O número de marcos é configurável, então o número de queries é variável — e
hook do React não pode ser chamado em laço. Por isso a carga mora num hook
próprio, `useRenewalBoard(checkpoints)`, que dispara as N faixas num só effect
e guarda um cursor por coluna. É o único pedaço de código que não tem
precedente direto no repo.

### Quem fica de fora

Filtro no cliente, sobre as páginas carregadas, espelhando o que
`shouldPromptRenewal` já exclui hoje:

- `currentContractStatus === 'cancelado'` — não há o que renovar.
- `currentContractStatus === 'trancado'` — a vigência está congelada.
- `renewalDeclined` — sai da coluna do marco e vai para a coluna Perda.

## O corte com o funil Vencidos

**A invariante que sustenta a esteira:** Renovações usa
`currentContractEndsAt >= corte`, Vencidos usa `< corte`. Nunca sobrepõe,
nunca deixa buraco. O mesmo corte limpo que `shouldPromptRenewal` já faz hoje
para não cobrar renovação de contrato vencido.

O "hoje" é fixado uma vez na montagem da tela (`useState` com inicializador),
exatamente como o `expiredCutoffMs`. Contrato que vence no meio da sessão só
troca de board no próximo carregamento. É caso de borda e o custo de resolver
não paga.

## Arrasto

| Movimento | O que acontece |
|---|---|
| Marco → marco | Recusado. Aviso curto: as colunas seguem o vencimento do contrato |
| Card → **Venda** | Abre o `ContractModal` em `mode="renovacao"` — o mesmo que a Meta abre |
| Card → **Perda** | `renewalDecline(lead, marcoAtivo)`: grava `renewalDeclined: true` e marca o marco atual como tratado |
| **Perda** → marco | Desfaz a recusa (`renewalDeclined: false`). Única volta permitida |

O card carrega `_renewalCard: true` (espelho do `_expiredCard`) para os
handlers de drop saberem que estão lidando com um cliente projetado, e não com
um lead do pipeline de prospecção.

**"Não vai renovar" não vira perda de funil.** A pessoa continua CLIENTE, com
ficha, contratos, histórico e presença na aba Clientes. É a mesma decisão
tomada no Vencidos em 18/08: perda de venda ≠ perda de funil.

**Renovar tira o card do board sozinho.** `buildMatriculaWrites` empurra
`currentContractEndsAt` para frente e zera `renewalHandledCheckpoints` /
`renewalDeclined`. Na próxima carga o cliente já está fora da janela.

## O card

Reaproveita o card do board inteiro. Duas informações no lugar das etiquetas
que não fazem sentido para cliente:

- **"Vence em 87d"** na etiqueta do topo, onde hoje mora o badge de urgência.
- **Selo de marco tratado** quando o marco daquela coluna já está em
  `renewalHandledCheckpoints`. É o "já falei com ele" que substitui o progresso
  por coluna — a informação que se perdeu ao trocar etapas de conversa por
  faixas de tempo.

Contagem, data da última interação e consultor continuam como estão: o card é
o mesmo componente, não uma variante nova.

## Colunas Venda e Perda

Nos funis de sistema as duas colunas especiais são escopadas por `funnelId`, e
cliente nunca tem `funnelId` de funil de sistema. Duas consequências que o
Vencidos **já** tem hoje e que Renovações herda:

- **Venda fica vazia**, servindo só de alvo de arrasto. A query dela
  (`wonInMonthQuerySpec`) busca matrículas do mês por `convertedAt` e filtra
  por funil, então renovação não entra ali de qualquer forma.
- **Perda mostra só os recusados que já estão nas páginas carregadas.** É a
  mesma fidelidade do Vencidos. Deixar completa exigiria um índice composto
  novo (`lifecycleBucket, renewalDeclined, currentContractEndsAt`), e o volume
  de recusa por ciclo não paga esse custo.

Decidido com o Johnny em 2026-08-20, com a limitação na mesa.

## Provisionamento

Terceiro effect no `App.jsx`, encadeado **depois** do Vencidos estar `done`,
para as escritas não correrem juntas no primeiro login de admin de uma
academia nova. Mesmo desenho dos outros dois:

1. Guarda por `renewalFunnelSetupDoneAt` lido da config.
2. Snapshots frescos por `getDocs` (não os props), para eliminar a corrida com
   as assinaturas ao vivo ainda vazias no boot.
3. `planRenewalSetupOps({ funnels })` devolve `{ createFunnel }` ou `null` —
   idempotente, e **nenhuma etapa** para criar.
4. Grava `renewalFunnelSetupDoneAt` na config.

Roda só para admin. Retroativo para as 5 academias em produção.

## Configurações → Funis

O funil aparece na lista com o selo de sistema. `isSystemFunnel` já cobre nome
travado, não pode ser padrão e não pode ser excluído.

Como ele não tem etapas, o painel de etapas mostra uma nota no lugar da lista
vazia — *"As colunas deste funil são os marcos de renovação, configurados em
Metas & ritmo"* — e o botão de adicionar etapa fica desabilitado.

Três avisos hoje dizem "O funil de Indicações..." na unha
(`FunnelsSection.jsx:66`, `:103`, `:118`) e passam a usar o nome do próprio
funil, agora que são três.

## Fora de escopo

- **Meta Diária.** Não muda nada. Continua cobrando marco a marco.
- **Campo novo no lead**, backfill, índice composto novo, regra do Firestore
  para publicar no console. Nada disso é preciso.
- **Aviso no sino / Central de ajuda.** Ficam para uma entrega seguinte, se o
  Johnny quiser.
- **Filtro de período no board.** Não faz sentido aqui: a janela já é o marco.
- **Renomear ou acrescentar coluna** neste funil (consequência aceita da
  decisão 4).

## Testes

`src/lib/__tests__/renewalFunnel.test.js`:

- `isRenewalFunnel` casa por `systemKind` e ignora funil da academia chamado
  "Renovações".
- `getRenewalFunnel` desempata duplicata pelo `createdAt` mais antigo.
- `renewalColumnsFromCheckpoints` devolve as colunas em ordem decrescente,
  descarta marco inválido (≤ 0, não numérico) e deduplica.
- `renewalColumnsFromCheckpoints` corta em 6 colunas mantendo as MAIORES, e a
  menor coluna que sobra continua absorvendo tudo abaixo dela: com marcos
  [120, 90, 60, 45, 30, 15, 7], o cliente a 5 dias de vencer cai em "15 dias"
  e nenhum card fica sem coluna.
- A faixa `(prevDays, days]` de cada coluna é a tradução fiel de
  `activeRenewalCheckpoint`: varrer todo prazo de 0 a 90 (e de 0 a 120 com o
  teto aplicado) e conferir que a coluna da faixa é a do marco ativo. NÃO existe
  função de ponte no código de propósito — recalcular a coluna com um "agora"
  diferente do corte da query discordaria na borda. É este teste que garante que
  board e Meta contam a mesma história.
- `splitRenewalForBoard` manda `renewalDeclined` para a Perda e exclui
  cancelado e trancado das colunas.
- `planRenewalSetupOps` é idempotente: com o funil já existente devolve
  `createFunnel: null`.

`src/lib/__tests__/leadQueries.test.js`:

- `renewalColumnQuerySpec` produz a faixa certa para cada marco, incluindo a
  primeira coluna (limite inferior = corte) e a última.
- **Não sobreposição com `expiredClientsQuerySpec`**: nenhum valor de
  `currentContractEndsAt` cai nas duas, e nenhum valor dentro da janela fica
  sem coluna.

## Riscos

| Risco | Mitigação |
|---|---|
| Hook com N queries variáveis é código sem precedente no repo | Isolado em `useRenewalBoard`, com teste da montagem das faixas em `renewalFunnel.test.js`; a parte de Firestore reusa `usePagedLeads` por dentro |
| Board com ~150 clientes na janela numa academia de 600 | Paginação por coluna (10 por vez) e carga só com a aba aberta |
| Coluna Perda incompleta confunde quem espera ver todos os recusados | Limitação conhecida e igual à do Vencidos; o registro completo está na ficha e o cliente reaparece na Perda do Vencidos ao vencer |
| Marco configurado maior que a vigência do plano (ex.: marco 90 num plano mensal) | `activeRenewalCheckpoint` já resolve: o contrato de 30 dias nasce dentro da coluna "30 dias" e nunca aparece nas outras |
| Academia cadastra muitos marcos e o board dispara uma query por marco | Teto de 6 colunas (as maiores). Os marcos além disso seguem valendo na Meta Diária |

## Entrega

PR único. Sem índice novo, sem regra nova, sem passo manual no console
Firebase. Verificação ao vivo antes do merge: abrir a aba Renovações numa
academia com clientes em cada faixa, conferir a distribuição pelas colunas,
arrastar um card para Venda (abre a renovação), arrastar outro para Perda e
desfazer.
