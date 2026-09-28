---
status: revisão
---

# Aba Contratos da ficha: correções da auditoria

Spec aprovada em conversa com o Johnny em 28/09/2026. Vale só para o Stronilead. Saiu da auditoria da aba Contratos feita no mesmo dia, que levantou 16 pontos. Esta spec cobre os itens 1 a 7. Os itens 8 a 16 ficam para depois: aviso prévio do cancelamento, regras de trancamento por plano, plano de recorrência, ações no Histórico, quem fechou a venda, rastro da correção, cliente antigo sem contrato e detalhes menores.

## O problema

1. A aba trata como vigente o último contrato criado (`lead.currentContractId`), e não o que vale hoje. A renovação feita antes do vencimento começa, por padrão, no dia seguinte ao fim do contrato atual. Por isso, quem renovou cedo aparece como "MATRÍCULA AGENDADA" no cabeçalho, o card mostra "Começa em N dias", o contrato que o aluno está usando vai para o Histórico com o selo "A vencer", e em Clientes o anel fica roxo.
2. Contrato trancado aparece como "CLIENTE ATIVO" no cabeçalho, porque `deriveLeadState` não tem esse caso. Em Clientes, o trancado tem anel cinza e não tem filtro. Os filtros de Clientes pintam vencido de vermelho e cancelado de cinza, o contrário da ficha.
3. Quando a renovação começa antes do fim do contrato atual, o modal avisa que o atual será encerrado na véspera, mas `commitMatricula` não mexe nele. Os dois ficam valendo, e a carteira do Gerencial soma os dois.
4. "Interrompido a X% da vigência", no contrato cancelado, é calculado com a data de hoje. O número sobe todo dia.
5. Na linha do tempo, trancamento e correção caem na faixa verde de matrícula. Todo evento de contrato mostra o plano e o valor do contrato atual (`lead.currentPlanName` e `lead.currentContractValue`), e não os do próprio evento.
6. Corrigir não mexe nos campos de desconto (`discountMode`, `discountValue`, `discountReason`). O card lê `discountValue` primeiro e mostra o desconto antigo. O Gerencial calcula tabela menos valor e mostra outro número.
7. A célula "Renovado de" conta qualquer contrato anterior como renovação (`pastContracts.length`). Quem voltou depois de meses sem contrato aparece como "1ª renovação", e o Gerencial chama o mesmo contrato de Retorno.

## Decisões do Johnny

1. Contrato que começa no futuro é agendado, a não ser que comece no dia seguinte ao fim do contrato atual. Esse contrato, chamado aqui de emendado, conta como ativo.
2. Trancado vira um estado próprio da pessoa, em amarelo. O "A vencer" continua âmbar. Os dois se distinguem pelo rótulo, pelo ícone de pausa e pelo anel em Clientes.
3. Renovação que começa antes do fim do contrato atual encerra o atual na véspera do início do novo, como o aviso do modal já dizia.
4. A porcentagem do cancelado usa a data do cancelamento.
5. Na linha do tempo, trancamento, reativação e correção deixam de parecer matrícula, e cada evento mostra o próprio plano e o próprio valor.
6. Corrigir recalcula o desconto.
7. Contrato sem ligação com o anterior é retorno, não renovação.

Aprovado junto com o desenho:
- O selo do cabeçalho passa de "MATRÍCULA AGENDADA" para "CONTRATO AGENDADO".
- Cancelar uma renovação que ainda não começou devolve o cliente ao contrato em uso.
- Corrigir a data de início de uma renovação recalcula o emendado e o fim do contrato anterior.
- Renovar contrato trancado fica bloqueado até reativar.
- Um script marca as renovações emendadas já feitas. As sobreposições antigas ficam como estão.
- As cores de vencido e cancelado nos filtros de Clientes passam a ser as da ficha.
- A contagem de dias do trancado no card passa a ser a mesma da reativação.
- Contrato paralelo aparece como Retorno, como no Gerencial.

## Entrega

Dois PRs, nesta ordem:
- O PR 1 cuida das telas: itens 2, 4, 5, 6 e 7. A única mudança de gravação é o desconto na correção.
- O PR 2 cuida da vigência: itens 1 e 3, mais cancelar e corrigir a renovação que ainda não começou, o bloqueio do trancado, os selos "Em uso" e "Renovado" no Histórico e o script.

As regras do Firestore não mudam. `stronix_contratos` e `stronix_leads` não têm lista fechada de campos, e o update de contrato só exige que `consultantAuthUid` continue igual, campo que nenhuma escrita nova toca. Não há consulta nova nem índice novo.

## PR 1: as telas

### Trancado (item 2)

- `src/lib/leadState.js` ganha o tom `yellow` em `TONES` (classes `yellow-*` do Tailwind e `hex` `#EAB308`) e o caso do trancado em `deriveLeadState`: `{ key: 'trancado', tone: 'yellow', label: 'TRANCADO', hint: 'Vigência congelada' }`. Cabeçalho, anel da ficha, busca global, indicações e a tela de importação passam a mostrar o trancado sem mudança própria, porque todos leem `deriveLeadState`.
- Efeito colateral aceito: etapa de funil com a cor `yellow` passa a aparecer amarela no chip de fase da ficha, porque `phaseToneName` lê `TONES`. Hoje ela aparece azul.
- Aba Contratos (`CONTRACT_TONE`, em `LeadProfileView.jsx`): o trancado sai do azul da marca e vai para o amarelo, e o rótulo "Trancado há" ganha o ícone de pausa.
- Contagem do trancado: o card passa a usar `daysBetween(pausedAt, agora)`, a mesma conta de `buildContractResume`. Hoje o card arredonda para cima e mostra um dia a mais.
- `src/views/ClientsView.jsx`: `STATUS_TONE`, `STATUS_OPTIONS` e o anel (`contractRing`) ganham o trancado em amarelo. No filtro, o trancado fica entre "A vencer" e "Vencido". O filtro no endereço passa a aceitar `trancado` sem mudança em `src/lib/screenParams.js`, porque a validação usa a lista que a tela repassa (`STATUS_OPTIONS`).
- No mesmo `STATUS_TONE`, vencido passa a cinza e cancelado a vermelho, como em `CONTRACT_TONE` e em `deriveLeadState`.

### Porcentagem do cancelado (item 4)

A régua do contrato vigente passa a usar uma data de referência:
- trancado: a data do trancamento, como hoje;
- cancelado: a data do cancelamento, quando ela já passou;
- nos outros casos: agora.

A regra vira a função pura `vigenciaRefDate({ status, pausedAt, cancelledAt }, now)`, em `src/lib/renewal.js`, e a ficha passa o resultado para `contractVigencia`. "Interrompido a X% da vigência" e a barra do card cancelado passam a sair dela.

### Linha do tempo (item 5)

- Função pura nova em `src/lib/timeline.js`, `contractEventOf(text)`, que lê o texto gravado pelo próprio app e devolve `{ kind, planName, value }`:
  - `kind`: `matricula`, `renovacao`, `cancelamento`, `trancamento`, `reativacao` ou `correcao`. Cancelamento é testado antes de renovação, porque o texto novo do PR 2 começa com "Renovação cancelada".
  - `planName` e `value`: o que o texto trouxer, ou seja, o "Plano X" e o valor entre parênteses, lido com `parseValorBRL`. Sem valor no texto, `value` é `null`.
  - Aceita os textos atuais, que separam as partes com travessão, e os novos do PR 2, que usam vírgula e dois-pontos.
- `classifyInteraction` passa a pôr no balde de contrato também "Contrato reativado", que hoje cai em mudança de fase.
- Na ficha, a faixa de destaque fica só para matrícula, renovação e cancelamento. O título é o plano do evento, na matrícula (ou "Matrícula fechada", se o texto não trouxer plano), "Contrato renovado" e "Contrato cancelado" (ou "Renovação cancelada"). O valor da direita sai do evento e só aparece em matrícula e renovação. Trancamento, reativação e correção viram a linha simples, com o tipo "Contrato".
- A interação não ganha campo novo. Evento antigo sem valor no texto fica sem valor.

### Desconto (item 6)

- O card passa a calcular o desconto como `max(listValue - value, 0)` do contrato, a mesma conta do Gerencial (`src/lib/gerencial/sales.js`). O motivo continua vindo de `discountReason`.
- `buildContractEdit` recalcula o desconto gravado:
  - valor abaixo da tabela: `discountValue` é a diferença e `discountReason` é o motivo escolhido. `discountMode` continua o anterior quando valor e tabela não mudaram, e vira `final` quando mudaram;
  - valor igual à tabela ou acima: `discountMode: 'nenhum'`, `discountValue: 0` e `discountReason: null`.
- `ContractEditModal` mostra os motivos (`DISCOUNT_REASONS`) quando o valor fica abaixo da tabela, já com o motivo anterior marcado, e não salva sem motivo, igual ao modal de matrícula.

### Origem do contrato (item 7)

- Função pura nova, `contractOriginOf(contract, leadContracts)`, num módulo novo, `src/lib/contractHistory.js`. Ela segue a ordem de `saleTypeOf` (`src/lib/gerencial/scope.js`): renovação, upgrade, retorno e primeira. Devolve `{ kind, previous, ordinal, gapDays }`.
  - renovação: o contrato tem `renewedFromId`. `previous` é o contrato ligado. `ordinal` conta a sequência de ligações para trás, então recomeça depois de um retorno;
  - upgrade: `closedFromUpgrade` sem `renewedFromId`;
  - retorno: existe contrato anterior sem ligação, pela mesma data que o Gerencial usa (`createdAt`, ou `startsAt` quando falta). `previous` é o anterior mais recente;
  - primeira: nenhum contrato anterior;
  - `gapDays`: dias sem contrato entre o fim do anterior (ou a data do cancelamento, se ele foi cancelado antes do fim) e o início deste. Zero ou negativo vira `null`.
- A célula da ficha:
  - renovação: "Renovado de", o plano anterior e "#ID · 2ª renovação";
  - upgrade: "Upgrade", com o plano anterior;
  - retorno: "Retorno", "último contrato: Plano X, até DD/MM" e o tempo sem contrato (`gapLabel`), quando houver;
  - primeira: "Matrícula inicial", como hoje.
- O número curto do contrato passa a ter 8 caracteres também nessa célula, igual ao resto do card.
- No Histórico, o nó do retorno ganha ícone próprio (`LogIn`). A renovação continua com `RefreshCw` e a primeira matrícula com `GraduationCap`.
- Um teste compara `contractOriginOf` com `saleTypeOf` nos mesmos casos, para a ficha e o Gerencial não se separarem.

## PR 2: a vigência

### Emendado (item 1)

- Emendado: o contrato novo começa no dia do calendário seguinte ao fim do contrato atual, pelo horário local. Função pura `isSeamlessStart(prevEndsAt, startsAt)`, em `src/lib/renewal.js`.
- `buildMatriculaWrites`, no modo renovação, calcula a marca a partir de `lead.currentContractEndsAt` e do início escolhido. Grava `seamless: true` no contrato e `currentContractSeamless: true` no lead. Na matrícula, e na renovação que não emenda, grava `false`.
- `deriveContractStatus` só devolve `agendado` quando o início está no futuro e o contrato não é emendado. O emendado segue para as regras de "A vencer" e "Ativo" pelo fim dele. `deriveLeadContractStatus` repassa `lead.currentContractSeamless`. Cabeçalho, Clientes, Meta Diária e o resto passam a ver o emendado como ativo sem mudança própria.
- `deriveLeadState`: o rótulo do agendado vira "CONTRATO AGENDADO". A cor segue roxa.
- Card de um contrato que ainda não começou e tem um anterior em uso: uma linha na faixa de vigência. No emendado, "Continua o contrato em uso (Plano X, até DD/MM)". Com intervalo, "Contrato em uso: Plano X, até DD/MM", seguido de quantos dias ficam sem contrato. No emendado, a contagem é "Restam N dias" até o fim do contrato novo, e o marcador de hoje não aparece na régua enquanto ele não começa.
- Histórico, pela função pura `historyStatusOf(contract, leadContracts, now, thresholdDays)`, em `src/lib/contractHistory.js`: contrato que tem uma renovação ligada a ele mostra "Em uso" (verde) enquanto já começou e o fim dele ainda não chegou, e "Renovado" (cinza) depois do fim. Renovação cancelada antes de começar não conta como renovação ligada. Cancelado continua "Cancelado", e o resto segue `deriveContractStatus`.

### Sobreposição (item 3)

- Quando a renovação começa antes do fim do contrato atual (`computeSeam` dá sobreposição), o mesmo batch de `commitMatricula` grava no contrato anterior: `endsAt` igual ao início do novo menos um dia, `originalEndsAt` com o fim de antes e `shortenedById` com o id do novo. O cálculo sai de `buildMatriculaWrites` (`previousPatch`), e o id entra no `commitMatricula`.
- O status do anterior não muda. Depois do novo fim, ele fica vencido pelo tempo, e o Histórico mostra "Renovado".
- O aviso do modal e a dica de "Começar hoje" passam a descrever o que acontece de verdade, sem travessão. A lista "Ao confirmar" ganha a linha "O contrato atual passa a terminar em DD/MM".
- Validação: a renovação não pode começar no mesmo dia do início do contrato atual, nem antes. O modal mostra o motivo e não salva.

### Cancelar renovação que não começou

- Vale quando o contrato cancelado tem `renewedFromId`, o anterior existe e não está cancelado, e o dia do cancelamento é anterior ao dia de início do contrato.
- Função pura `buildRenewalCancel({ contract, previous, cancelledAt, reason, note })`, em `src/lib/contracts.js`:
  - contrato: cancelado, com data, motivo e observação, como no cancelamento comum;
  - anterior: se foi encurtado por este contrato (`shortenedById`), `endsAt` volta a `originalEndsAt` e as duas marcas são apagadas;
  - lead: o resumo volta para o anterior (`currentContractId`, plano, valor, início, fim, status e `currentContractSeamless`);
  - linha do tempo: "Renovação cancelada antes de começar: Plano X, motivo Y. O contrato Plano Z volta a valer até DD/MM/AAAA."
- Os marcos de renovação tratados continuam zerados, como ficaram na renovação. Se o contrato anterior estiver perto do fim, a Meta Diária volta a cobrar a renovação, que é o esperado.
- `commitContractPatch` aceita um segundo contrato no mesmo batch (`previousContractId` e `previousContractPatch`).
- `ContractOutcomeModal`, nesse caso, usa o título "Cancelar renovação" e a prévia "A renovação é desfeita e {nome} volta ao contrato em uso (Plano Z, até DD/MM)." O anterior sai de `contratos` (`useGeneralConfig`).

### Corrigir renovação

`buildContractEdit` recebe o contrato anterior quando o corrigido tem `renewedFromId`. O fim de referência do anterior é `originalEndsAt`, se foi este contrato que o encurtou, ou `endsAt`, nos outros casos.
- A marca `seamless` é recalculada, no contrato e em `currentContractSeamless`, já que o contrato corrigido é sempre o atual.
- Se o início novo sobrepõe o anterior, o encurtamento é gravado como na criação.
- Se o início novo não sobrepõe e o anterior tinha sido encurtado por este contrato, o fim original volta.
- Se o início novo cai no dia do início do anterior, ou antes, o modal recusa.

`ContractEditModal` busca o anterior em `contratos` e avisa na prévia quando o fim do anterior muda.

### Renovar trancado

No modo renovação, se `lead.currentContractStatus` for `trancado`, o `ContractModal` mostra "Este contrato está trancado. Reative o contrato antes de renovar." e não salva. A ficha já troca Renovar por Reativar no trancado. O caminho que chega aqui é o funil Upgrade, pelo Kanban e pelo Mudar fase.

### Renovações já feitas

Script `scripts/backfill-contract-seamless.js`, no molde dos outros de `scripts/`. Roda por academia (`--tenant=<id>`), só mostra o que faria por padrão e grava com `--apply`.
- Para cada contrato com `renewedFromId` cujo anterior existe e cujo início é o dia seguinte ao fim do anterior (`isSeamlessStart`), grava `seamless: true`.
- Para cada lead cujo `currentContractId` aponta para um contrato marcado, grava `currentContractSeamless: true`.
- Não grava `false` em ninguém e não encurta sobreposições antigas.
- Só roda em produção com o ok do Johnny.

## Dados

No contrato (`stronix_contratos`):

| Campo | Conteúdo |
|---|---|
| `seamless` | `true` quando o contrato começa no dia seguinte ao fim do contrato renovado. `false` ou ausente nos outros casos |
| `originalEndsAt` | o fim de antes, quando uma renovação encurtou este contrato. `null` ou ausente nos outros casos |
| `shortenedById` | o id da renovação que encurtou este contrato |

No lead (`stronix_leads`):

| Campo | Conteúdo |
|---|---|
| `currentContractSeamless` | cópia de `seamless` do contrato atual |

## Testes

Em node, nas regras puras, como no resto do app:
- `contracts.test.js`: agendado com e sem a marca, emendado com início no passado, `buildMatriculaWrites` com emenda, intervalo e sobreposição, `buildRenewalCancel` e `buildContractEdit` com desconto e com o contrato anterior.
- `renewal.test.js`: `isSeamlessStart` (virada de mês, virada de ano, horários diferentes no mesmo dia) e `vigenciaRefDate`.
- `leadState.test.js`: trancado, rótulo do agendado e emendado como ativo.
- `timeline.test.js`: `contractEventOf` com os textos atuais, os antigos (valor sem centavos) e os novos, e o reativado no balde de contrato.
- `contractHistory.test.js` (novo): origem, sequência de renovações, retorno com e sem intervalo, `historyStatusOf` e a comparação com `saleTypeOf`.
- O script tem a decisão separada numa função pura, com teste.

## Fora do escopo

Os itens 8 a 16 da auditoria. Também continuam como estão:
- trancar uma renovação que ainda não começou: o trancamento vai para o contrato novo, e os dias parados voltam no fim dele, a mesma conta de hoje;
- a renovação de contrato vencido pela Meta Diária, que começa no dia seguinte ao fim antigo (item 10 da auditoria);
- a cor do "A vencer".

## Riscos

- Os textos da linha do tempo passam a ser lidos por `contractEventOf`. Quem mudar um texto em `contracts.js` precisa mudar o leitor e o teste junto. O teste cobre os seis tipos de evento.
- A marca de emendado é gravada no momento da renovação. Se o fim do contrato anterior mudar depois por outro caminho, a marca pode ficar desatualizada. Na tela, o contrato anterior não tem ação, e a correção da renovação recalcula a marca.
