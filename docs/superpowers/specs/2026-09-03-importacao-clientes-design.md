# Importação de clientes ativos de outros sistemas (design)

status: revisão
data: 2026-09-03

Uma academia que chega ao Stronilead já tem alunos matriculados em outro
sistema de gestão (NextFit, Pacto, Evo, SCA, Tecnofit). Hoje não existe
caminho para trazer esses cadastros. Cada aluno teria de ser digitado como
lead e matriculado à mão, um por um, para entrar nos funis de Indicações,
Renovações e Vencidos.

Este documento define uma importação por planilha que produz, em lote, o
mesmo par de documentos que uma matrícula pela tela produz hoje: a pessoa em
`stronix_leads` e o contrato em `stronix_contratos`. Com a vigência gravada
certa, os três funis se povoam sozinhos no primeiro render, porque nenhum
deles guarda estado próprio: são colunas projetadas por query sobre
`lifecycleBucket == 'cliente'` e `currentContractEndsAt`.

```
planilha ──parse──> candidatos ──dedupe──> [criar | promover | pular]
                                                    │
                                          lead + contrato + evento
                                                    │
                     RENOVAÇÕES <── 90d p/ vencer ──┴── venceu ──> VENCIDOS
```

## O problema

Um "cliente ativo" no Stronilead não é uma coleção à parte. É um documento de
lead com marcações específicas (`lifecycleStage`, `lifecycleBucket`,
`status: 'Venda'`, `convertedAt`, `clienteSince`), o resumo do contrato
denormalizado (`currentContractId`, `currentContractStartsAt`,
`currentContractEndsAt`, `currentContractStatus`, `currentPlanName`,
`currentContractValue`) e os campos de busca materializados (`nameLower`,
`nameTokens`, `whatsappDigits`, `whatsappDigitsRev`, `cpfDigits`). Ao lado
dele vive o documento do contrato, com `startsAt`, `endsAt`,
`durationMonths`, plano e consultor.

Quem tenta reproduzir isso à mão erra em três lugares: duplica gente que já
está na base como lead, grava vigência chutada, e carimba `convertedAt` com
a data de hoje, o que joga a academia inteira na coluna Venda do mês e fecha
a Meta Diária sozinha.

Duas restrições do repositório moldam a solução. A pasta `api/` está com 12
de 12 funções no plano Hobby da Vercel, então não há endpoint novo: a
importação roda no navegador, gravando no Firestore pelo SDK. E o dedupe já
existe pela metade em `findDuplicateLeadRemote` (`useDuplicateLead.js`),
casando por `whatsappDigits` exato.

## Decisões (Johnny, 2026-09-03)

1. **Origem é planilha (`.xlsx` ou `.csv`) exportada do sistema antigo.**
   Serve para qualquer fornecedor e não gasta função de servidor. Integração
   por API fica fora.
2. **Identidade da pessoa: CPF primeiro, WhatsApp depois.** Nome nunca casa
   sozinho; só levanta suspeita para o gestor confirmar.
3. **Quem já existe é promovido, não recriado.** O lead que já está na base
   vira cliente e recebe o contrato importado. A planilha preenche só o que
   está vazio no Stronilead e nunca troca o consultor dono.
4. **Só o super console importa.** A tela aparece apenas na sessão assumida
   ("Entrar como"). O gestor da academia não vê a seção.
5. **Conflito de contrato pula e lista.** Se a pessoa já tem contrato no
   Stronilead com vigência diferente da planilha, a linha não é gravada e
   aparece no relatório. O dado do Stronilead vence por ser o mais novo.
6. **Sem data de fim, a pessoa entra sem contrato.** A importação nunca
   inventa vigência. A linha importa o cliente, o relatório destaca que ele
   não entra em Renovações nem em Vencidos até alguém registrar o contrato.
7. **Escopo padrão: ativos e vencidos dentro da janela de Vencidos.** Vencido
   antigo e cancelado só entram se o gestor marcar "todos".

## Onde mora e quem opera

A seção "Importar clientes" entra em Configurações, no grupo "Pessoas", ao
lado de "Migrar leads". Ela só renderiza quando `appUser.impersonating` é
verdadeiro (`App.jsx`, montado a partir do claim `impersonatedBy`).

Os dados vão para dentro do tenant da academia. Não há estrutura paralela:
cada aluno vira o mesmo par lead + contrato que nasce quando um consultor
fecha uma matrícula pelo app.

Em dev local não existe "Entrar como" (a `/api` responde 404 no vite), então
nesse ambiente o admin da academia vê a seção para conseguir testar; em
produção a condição é só o claim.

A trava é de tela, não de permissão. `impersonating` é condição de
renderização; as regras do Firestore já permitem que um admin de academia
crie lead e contrato, porque é o que a matrícula pela tela faz. A importação
não desbloqueia poder novo, só automatiza em lote o que ele já pode fazer um
por um. Trava de verdade exigiria checagem no servidor, e o muro das 12
funções impede isso. A trava de tela existe para não oferecer e não confundir.

O que compensa é rastro. Todo documento gravado pela importação (lead,
contrato e evento de timeline) nasce com `importedAt`, `importedBy` (uid da
sessão), `importSource` (`nextfit`, `pacto`, `evo`, `sca`, `tecnofit` ou
`manual`) e `importBatchId` (um id por rodada). O "Entrar como" já grava em
`superadmin_audit` (`api/impersonate.js`), então fica registrado quem entrou,
quando, e quais cadastros nasceram daquela sessão.

A sessão assumida é o uid do admin da academia (`createCustomToken(adminUid)`
em `api/impersonate.js`). Isso faz a criação de lead passar pelo caminho
`isAdmin(appId)` que já existe nas regras. Nenhuma regra muda.

## O que cada linha produz

Uma linha válida gera até três documentos numa mesma operação atômica:

| Documento | Conteúdo |
|---|---|
| Lead (`stronix_leads`) | Cadastro da pessoa, marcações de cliente, resumo do contrato, campos de busca, carimbos de importação. Criado quando não existe; atualizado com `merge` quando existe. |
| Contrato (`stronix_contratos`) | Só quando a linha tem data de fim. Mesmo shape do que `buildMatriculaWrites` produz, com `startsAt`/`endsAt` vindos da planilha em vez de calculados. |
| Evento (`stronix_interactions`) | Um só, `type: 'import'`, texto "Cadastro importado do NextFit. Plano Trimestral, vigência até 12/11/2026" (ou "sem vigência registrada"). |

O patch do lead segue o que `commitMatricula` grava (`contractsWrites.js`):
`status: 'Venda'`, `isConverted: true`, `lifecycleStage: 'cliente'`,
`lifecycleBucket: 'cliente'` (via `withBucket`), `lossReason: null`,
`lostAt: null`, `nextFollowUp: null`, `renewalHandledCheckpoints: []`,
`renewalDeclined: false`, `reactivationStageId: null`, e o resumo
`currentContract*` quando há contrato.

Campos que só um cadastro novo recebe:

| Campo | Valor |
|---|---|
| `consultantId`, `consultantName`, `consultantAuthUid` | Consultor da coluna "Consultor", casado por nome normalizado com `usersList`. Sem correspondência: o consultor padrão escolhido no assistente. |
| `professorId`, `professorName` | Coluna "Professor" casada por nome com `stronix_professores`. Sem correspondência: nulo, contado no relatório. |
| `funnelId` | Funil padrão da academia (o primeiro na ordem), para a ficha não mostrar funil vazio. |
| `source` | "Importação NextFit" (ou o nome do sistema detectado). |
| `createdAt` | Coluna "Data de cadastro". Sem ela: data da importação. |
| `tags` | "VIP" quando a coluna VIP marcar. |

O evento de timeline não mexe em `lastInteractionAt` nem em
`interactionsCount`: importação não é contato, e o cliente não pode parecer
"contatado hoje". `classifyInteraction` (`timeline.js`) passa a classificar
`type: 'import'` como Sistema, para o evento ficar atrás do interruptor.

## Não duplicar

### Ordem de decisão

Para cada linha, nesta ordem:

| Passo | Compara | Resultado |
|---|---|---|
| 1 | CPF da linha (11 dígitos, dígito verificador válido) contra `cpfDigits` | Achou: mesma pessoa. Promove o existente. |
| 2 | Telefone normalizado contra `whatsappDigits` | Achou: mesma pessoa. Promove o existente. |
| 3 | Nome normalizado (`normalize`, de `globalSearch.js`) contra `nameLower` | Achou: suspeita. Vai para a lista de revisão com "criar novo" pré-marcado e a opção "usar o existente" (mais de um homônimo: o seletor lista todos). |
| 4 | Nada bateu | Cria o cadastro novo. |

Uma linha sem nome, ou sem CPF válido e sem telefone válido, não pode casar
nem nascer. Ela vai para "inválidas" no relatório, com o número da linha, e a
importação segue.

### Normalizações

Telefone: só dígitos. Se começar com 55 e sobrar 10 ou 11 dígitos depois de
tirá-lo, tira. Vale para casar quando tem 10 ou 11 dígitos; fora disso, a
linha guarda o telefone bruto e não casa por ele. O app guarda DDD + número
sem o 55 (`formatPhone`, em `masks.js`, corta em 11), então exportação com
`5571999999999` precisa perder o 55 antes de comparar.

CPF: só dígitos, 11 posições, dígito verificador válido, rejeita sequência de
um só algarismo. CPF inválido não casa e não é gravado em `cpf`/`cpfDigits`;
a linha recebe o aviso "CPF inválido" sem ser barrada.

Nome: `normalize` (minúsculas, sem acento), espaços colapsados.

### Duplicata dentro da planilha

Duas linhas com o mesmo CPF (ou, sem CPF, o mesmo telefone) viram uma antes
de qualquer consulta ao Firestore. Fica a de data de fim mais recente; a
outra conta como "duplicada no arquivo" no relatório.

### O que "promover o existente" grava

Nome e consultor dono ficam como estão. Consultor é a chave da carteira,
da Meta Diária e da comissão, e nunca é trocado em silêncio.

Telefone, e-mail, CPF, RG, nascimento, sexo, endereço, professor, objetivo
(`dor`) entram só onde o Stronilead está vazio.

Se o existente foi casado por telefone e tem CPF diferente do da linha, não
funde: vira conflito na revisão. Mãe e filho no mesmo telefone é esse caso.

O estado da pessoa recebe o patch de matrícula descrito acima. Um lead em
"Negociando" que aparece na planilha como aluno vira cliente, com a timeline
dele intacta. Um lead em Perda também é promovido (`isClientLead` já dá
precedência a cliente sobre perda).

### Idempotência e o padrão de duas rodadas

Rodar o mesmo arquivo duas vezes não grava nada na segunda. Toda linha casa
por CPF com um cliente que já tem contrato com a mesma data de fim, o patch
sai vazio, e a linha conta como "sem alteração".

Isso sustenta o caminho para o NextFit, cuja exportação de cadastro não tem
datas de contrato. Rodada 1 sobe o cadastro: cria as pessoas, sem contrato.
Rodada 2 sobe o relatório de contratos: casa por CPF e pendura a vigência.
Mesmo assistente, sem modo especial. Na rodada 2, uma linha cujo CPF não casa
com ninguém e que não traz nome suficiente para nascer cai em "inválidas".

### Conflitos

A linha é pulada e listada como conflito quando:

- o existente já tem `currentContractId` e `currentContractEndsAt` diferente
  da data de fim da linha (mesmo dia conta como igual);
- o existente foi casado por telefone e o CPF diverge.

O existente que tem contrato e recebe uma linha sem data de fim não é
conflito: a linha só preenche vazios do cadastro.

### Custo e infraestrutura

As consultas de dedupe usam `where('cpfDigits', 'in', [...])` e
`where('whatsappDigits', 'in', [...])`, 30 valores por consulta, campos de
igualdade com índice automático. Uma base de 600 alunos gasta cerca de 40
consultas. Nenhum índice composto novo, nenhuma regra nova, nenhuma função
na Vercel.

## Vigência do contrato

A importação nunca inventa data. Data de fim é obrigatória para nascer
contrato. Linha sem data de fim importa a pessoa como cliente sem contrato,
e o relatório mostra em destaque: "N clientes sem vigência, não entram em
Renovações nem em Vencidos até registrar o contrato".

Com a data de fim na mão:

| Campo | De onde vem |
|---|---|
| `endsAt` | Coluna da planilha, sempre. Meia-noite local do dia, igual ao que o modal de matrícula grava. |
| `startsAt` | Coluna, se existir. Senão, fim menos a duração do plano do catálogo, marcado `startsAtInferred: true`. Senão, nulo (`deriveContractStatus` já tolera). |
| `planId` / `planName` | Nome da planilha casado por nome normalizado com `stronix_planos`, ou pelo mapeamento feito no assistente. Sem correspondência: guarda o texto, `planId` nulo, relatório avisa "N planos fora do catálogo". |
| `durationMonths` | Do plano do catálogo; senão meses inteiros entre início e fim; senão nulo. |
| `value` / `listValue` | Coluna de valor, se existir; senão o valor de tabela do plano casado; senão zero. A unidade segue a do catálogo (conferir contra `stronix_planos` na implementação). |
| `status` gravado | `ativo` para Ativo, Vencido e A vencer (o relógio decide, como no app). `cancelado` com `cancelledAt` na data de fim quando a situação disser cancelado. `trancado`, com `pausedAt` na data da importação por falta de dado melhor, quando disser trancado (a reativação pela ficha empurra o fim pelos dias parados a partir daí). Valor desconhecido: linha para revisão. |
| `renewedFromId` | Nulo. Histórico de contratos anteriores fica fora da v1. |

Datas aceitas: `dd/mm/aaaa`, `dd/mm/aa`, `aaaa-mm-dd` e serial numérico do
Excel. Célula ambígua ou vazia conta como sem data.

### Os três carimbos de tempo

`convertedAt` é o início do contrato; sem início, a "Data de cadastro"; sem
nenhuma das duas, a data da importação, com aviso no relatório. Se fosse
"agora", os alunos importados entrariam na coluna Venda do mês
(`salesOfMonthQuerySpec`, em `leadQueries.js`), no ranking e na comissão do
mês corrente, e `isLeadResolvedToday` (`leads.js`) fecharia a Meta Diária de
hoje sozinha.

`createdAt` é a "Data de cadastro" da planilha. Mantém o painel de captação
honesto: ninguém foi captado hoje.

`clienteSince` é a mais antiga entre início do contrato e data de cadastro.

### Escopo do que entra

O assistente oferece duas opções. A padrão, "ativos e vencidos recentes",
aceita a linha quando:

- a situação do contrato é trancado (o tempo não corre); ou
- tem data de fim e, pelo relógio (`deriveContractStatus`, a mesma regra do
  app), o contrato está vigente, agendado ou a vencer; ou
- tem data de fim, está vencido pelo relógio, e venceu há no máximo a janela
  de Vencidos da academia (`expiredWindowDays`, padrão 15); ou
- não tem data de fim e a situação do cliente é ativa (ou a coluna não
  existe).

Com data de fim, a situação escrita na planilha não manda: uma linha marcada
"Ativo" com fim de dois anos atrás é um vencido antigo e fica de fora.

Ficam de fora cancelados, vencidos além da janela, e linhas sem data de fim
cujo cliente está inativo. A opção "todos" aceita tudo que passou na
validação; o que entrar vencido antigo vira inativo, sem barulho.

### O que os funis veem no dia seguinte

Quem vence em até 90 dias (ou o maior marco configurado) aparece nas colunas
de Renovações. Quem venceu na janela cai em Vencidos, na Meta e no board.
Todo cliente importado pode ser escolhido como indicador na ficha de um lead,
porque a busca de indicador recorta por `lifecycleBucket == 'cliente'`.

## Vários sistemas de origem

O assistente tem um passo de mapeamento de colunas com presets por sistema.
Um preset é uma tabela cabeçalho → campo do Stronilead mais uma assinatura
(conjunto mínimo de cabeçalhos que identifica o sistema). O importador lê a
primeira linha do arquivo e escolhe o preset cuja assinatura bate; se nenhum
bate, abre o mapeamento manual, coluna por coluna, com o que conseguiu
adivinhar já preenchido.

Preset do NextFit, com os 21 cabeçalhos da exportação de cadastro:

| Cabeçalho | Campo |
|---|---|
| Nome | `name` |
| E-mail | `email` |
| Contrato | nome do plano (`planName`, casado com o catálogo) |
| Telefone | `whatsapp` |
| Situação do contrato | status do contrato (ativo / vencido / cancelado / trancado) |
| Situação do cliente | filtro de escopo (ativo / inativo) |
| CPF | `cpf` |
| RG | `rg` |
| Data de nascimento | `birthDate` |
| Data de cadastro | `createdAt` |
| Objetivo | `dor` |
| Sexo | `sexo` |
| VIP | etiqueta "VIP" |
| Endereco, Número, Bairro, Cep, Cidade, Complemento | mapa `address` |
| Consultor | dono (`consultantId`), por nome |
| Professor | `professorId`, por nome |

Essa exportação não traz início, fim nem valor do contrato. O relatório de
contratos do NextFit traz; ele entra na rodada 2, mapeando "Data de início",
"Data de fim" e "Valor" para `startsAt`, `endsAt` e `value`, e "CPF" para
casar. Os cabeçalhos exatos desse relatório se confirmam com a primeira
exportação real.

Pacto, Evo, SCA e Tecnofit entram como preset conforme a primeira exportação
de cada um chegar. Enquanto não há preset, o mapeamento manual resolve.

## O assistente

Quatro passos, numa tela só, com o passo atual em destaque:

1. **Arquivo.** Sobe `.xlsx` ou `.csv`. O importador lê os cabeçalhos,
   reconhece o preset ("NextFit detectado") ou abre o manual.
2. **Mapeamento.** Coluna por campo, pré-preenchido e editável. Aqui também:
   os nomes de plano encontrados na planilha (lista de valores distintos) com
   um seletor para o plano do catálogo ou "manter como texto"; o consultor
   padrão para linha sem consultor reconhecido (obrigatório); e o escopo.
3. **Revisão.** O ensaio completo, sem gravar nada. Roda as normalizações,
   as consultas de dedupe e a classificação de cada linha, e mostra os
   contadores: vai criar, vai promover, vai registrar contrato, só preenche
   dados, sem alteração, sem vigência, conflitos, suspeitas por nome,
   duplicadas no arquivo, inválidas. As duas listas que pedem decisão
   (suspeitas por nome e conflitos) aparecem com a decisão por linha.
4. **Importar.** Barra de progresso por lote e o relatório final com os
   mesmos contadores, mais uma tabela linha a linha (número da linha, nome,
   resultado, motivo), com download em CSV.

Nada passa da revisão sem o gestor ver os números. O botão "Importar" fica
desabilitado enquanto a revisão não terminar.

## Arquitetura

Regra pura em `lib`, gravação em `*Writes`, tela fina, no padrão de
`contracts.js` / `contractsWrites.js`.

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/importPresets.js` | Presets por sistema, assinatura e detecção pelos cabeçalhos, chute inicial do mapeamento manual. |
| `src/lib/clientImport.js` | Normalizadores (telefone, CPF, datas, nome), linha → candidato, decisão de dedupe a partir dos resultados das consultas, resolução de plano/consultor/professor, `buildImportedClientWrites` e os contadores do relatório. Sem React, sem Firestore. |
| `src/lib/clientImportWrites.js` | Consultas em lote por `cpfDigits` e `whatsappDigits`, montagem dos batches, progresso e coleta de erros. |
| `src/views/settings/ImportClientsSection.jsx` | O assistente. |
| `src/lib/timeline.js` | `type: 'import'` classifica como Sistema. |
| `src/views/settings/SettingsView.jsx` | Item "Importar clientes" no grupo "Pessoas", condicionado a `appUser.impersonating`. |

`buildImportedClientWrites` recebe `{ candidate, existingLead, plan,
consultant, professor, funnelId, appUser, importMeta }` e devolve
`{ leadPatch, contract, interaction, outcome }`. Onde os campos coincidem
com `buildMatriculaWrites`, o shape é o mesmo, e um teste de paridade garante
isso.

Leitura da planilha com SheetJS (`xlsx`), carregado por `import()` só quando
o passo 1 abre, para não pesar o bundle de quem nunca importa.

Cada batch carrega até 450 operações (lead, contrato e evento por linha; duas
operações quando não há contrato). Cada linha fica inteira dentro de um só
batch: pessoa e contrato nascem juntos ou não nascem.

## Quando dá errado

Arquivo ilegível ou sem cabeçalho reconhecível para no passo 1 com a
mensagem, sem consumir leitura.

Linha inválida (sem nome, ou sem CPF válido e sem telefone válido) vai para
"inválidas" no relatório, com o número da linha. A importação segue.

Falha num lote no meio (rede, permissão): os lotes anteriores ficaram
gravados; o relatório aponta de qual linha em diante faltou; a recuperação é
rodar o mesmo arquivo de novo, porque quem já entrou conta como "sem
alteração".

`permission-denied` (tenant bloqueado, sessão sem `isAdmin`): o assistente
traduz em texto humano e não tenta o lote seguinte.

## Testes

Todos puros, no vitest, em `src/lib/__tests__/`:

- Normalizadores: telefone com e sem 55, com máscara, com espaço, com 9
  dígitos (inválido); CPF válido, inválido, sequência repetida, com máscara;
  datas nos quatro formatos, célula vazia, célula ambígua.
- Dedupe: as quatro ordens de decisão; duplicata dentro da planilha fica com
  a de fim mais recente; CPF divergente vira conflito; promover preenche só
  vazio e nunca troca o consultor; lead em Perda é promovido.
- Vigência: fim obrigatório; início inferido só com duração de catálogo e
  marcado; status por situação; cancelado recebe `cancelledAt`; escopo
  padrão contra a janela.
- Paridade: `buildImportedClientWrites` produz o mesmo `leadPatch` que
  `buildMatriculaWrites` nos campos comuns.
- Presets: a assinatura do NextFit detecta; cabeçalho desconhecido cai no
  manual; o mapa `address` monta a partir das seis colunas.
- Carimbos: `convertedAt` nunca é a data da importação quando existe início
  ou data de cadastro; o evento de timeline não carrega bump de
  `lastInteractionAt`.
- Idempotência: a mesma linha contra um existente já promovido com a mesma
  data de fim produz patch vazio e `outcome: 'sem_alteracao'`.

## Fora da v1

- Reimportação como renovação (linha com fim maior que o contrato vigente
  vira contrato novo com `renewedFromId`). Hoje isso é conflito.
- Integração por API com qualquer sistema.
- Histórico de contratos anteriores, interações, aulas e agendamentos do
  sistema antigo.
- Importação pelo gestor, sem sessão assumida.
- Persistir o mapeamento de planos entre rodadas.

## Gate de merge

Além dos testes: uma importação real numa academia de teste, na sessão
assumida, com uma exportação verdadeira do NextFit (as duas rodadas),
conferindo antes e depois os três funis, a aba Clientes, a coluna Venda do
mês e a Meta Diária do dia.
