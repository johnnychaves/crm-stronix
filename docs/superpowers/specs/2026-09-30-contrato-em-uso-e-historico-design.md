---
status: ativo
---

# Aba Contratos: contrato em uso no destaque e Histórico detalhado

Spec aprovada em conversa com o Johnny em 30/09/2026. Vale só para o Stronilead. Continua a spec de 28/09 (`2026-09-28-aba-contratos-correcoes-design.md`), que entregou a vigência da renovação nos PRs #234 e #235. Esta entrega sai num PR só, com a tela e as regras, empilhado no #235.

O mockup aprovado é a opção C: `docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html`. Ele é a referência visual. Abrir com um servidor estático, porque usa o Tailwind pelo navegador.

## O problema

1. Depois de uma renovação feita antes do vencimento, o card de cima da aba mostra a renovação, que ainda não começou. O contrato que o cliente usa hoje desce para o Histórico com o selo "Em uso", sem contagem de dias e sem progresso. A recepção abre a aba e vê em destaque um plano que o cliente ainda não tem.
2. O Histórico mostra pouco de cada contrato: plano, início e fim, duração, valor e situação. Não mostra a data final original, o tempo trancado, a média mensal, o desconto, quem fechou nem o motivo do cancelamento. Tudo isso já está gravado.
3. Com uma renovação marcada, o Trancar e o Cancelar agem na renovação, e não no contrato que o cliente está usando.
4. Começar antes da data marcada só é possível pelo Corrigir, mudando a data de início. Ninguém acha esse caminho.
5. Renovação com intervalo aparece como "CONTRATO AGENDADO" nas listas mesmo com o contrato em uso valendo.

## Decisões do Johnny (30/09/2026)

| Tema | Decisão |
|---|---|
| Destaque da aba | O contrato em uso. A renovação que ainda não começou aparece embaixo, como "Próximo contrato", e assume o destaque no dia em que começa |
| Botões do contrato em uso | Com renovação marcada, ele tem Trancar (ou Reativar) e Cancelar |
| Cancelar o contrato em uso | A renovação continua marcada. Se sobrar intervalo até ela começar, o cliente fica como contrato agendado |
| Trancar o contrato em uso | Não mexe na renovação. Ela fica com as datas dela, mesmo que os dois contratos se cruzem |
| Começar antes | Todo contrato agendado ganha "Ativar agora". O contrato passa a começar hoje e o fim anda junto, mantendo a duração vendida |
| Histórico | Só os contratos que não são o destaque nem o próximo, em tabela, com os detalhes de cada um. Sem botões nas linhas |
| Layout | Opção C dos mockups: linha do tempo no topo, card do contrato em uso, faixa fina do próximo e Histórico em tabela |
| Entrega | Um PR só, com a tela e as regras |

## A tela

De cima para baixo, na aba Contratos da ficha:

### Vigência

Uma linha do tempo com os contratos do cliente num eixo só.

- Um segmento por contrato que chegou a valer. Verde é o contrato em uso, roxo hachurado é o próximo, cinza é o encerrado e vermelho é o cancelado, que vai até a data do cancelamento.
- Os períodos de trancamento aparecem em amarelo por cima do segmento do contrato.
- Marcador de hoje, com o rótulo "hoje".
- Marcas de ano.
- Os marcos de renovação da academia (Configurações → Metas & ritmo) viram tracinhos no segmento do contrato em uso, com o mesmo `title` de hoje.
- Contratos que se cruzam no tempo vão para uma segunda trilha, para um não esconder o outro.
- Renovação desfeita (cancelada antes de começar) não aparece, porque nunca valeu.
- O eixo vai do início do contrato mais antigo até o fim mais distante, ou até hoje, o que for maior.
- Cada segmento tem `title` com o plano e as datas.

A linha do tempo substitui a régua que ficava no rodapé do card.

### Contrato em uso

O card de hoje, com as mesmas células: contagem, plano, valor, origem e quem fechou.

- O selo do plano diz "Em uso" quando existe próximo contrato. Sem próximo, continua o selo de situação de hoje (Ativo, A vencer).
- Trancado: o card mostra "Trancado há N dias", como hoje.
- O aviso "N marcos de renovação passaram sem contato" continua no card, numa linha de rodapé. Com próximo contrato ele não aparece, porque o cliente já renovou.

### Próximo contrato

Uma faixa fina, só quando existe um contrato que ainda não começou e outro em uso.

- Selo "Próximo", plano, "começa em DD/MM/AAAA, daqui a N dias", "até DD/MM/AAAA", valor total e média mensal.
- O encaixe com o contrato em uso: "sem intervalo" quando emenda, "N dias sem contrato antes" quando há intervalo, e "N dias junto com o atual" quando os dois se cruzam.

### Histórico

Uma tabela com os contratos que não são o destaque nem o próximo, do mais novo para o mais antigo.

| Coluna | Conteúdo |
|---|---|
| Contrato | Ícone da origem, plano e a origem por extenso (renovação, retorno com os dias sem contrato, upgrade ou primeira matrícula) |
| Início | Data de início |
| Fim previsto | Início mais a duração vendida |
| Fim de fato | Data em que terminou, com o motivo da diferença em relação ao previsto |
| Trancado | Dias parados e quantas vezes. "Nunca" quando não houve |
| Valor | Valor total do contrato |
| Média/mês | Valor dividido pela duração |
| Situação | Renovado, Vencido, Cancelado, Em uso, Trancado ou Agendado |

A linha abre, no clique, o resto dos detalhes: desconto e motivo (com o valor de tabela), quem fechou e quando, o código do contrato, a data e o motivo do cancelamento com a observação, e os períodos de trancamento. As linhas não têm botões.

Contrato sem valor (os importados) mostra "—" no valor e na média. Contrato sem plano mostra "—" no plano.

A linha pontilhada de "N dias sem contrato" entre dois contratos, que existia na corrente antiga, vira o texto da origem na coluna Contrato ("retorno, 90 dias depois").

### Botões em cada situação

| Situação | Botões |
|---|---|
| Contrato em uso, sem próximo | Renovar contrato, Corrigir, Trancar, Cancelar (como hoje) |
| Contrato em uso trancado, sem próximo | Reativar contrato, Corrigir, Cancelar (como hoje) |
| Contrato em uso, com próximo marcado | Trancar e Cancelar. Trancado, o Trancar vira Reativar. Vale também no último dia dele, quando o fim gravado à meia-noite já o deixa vencido por instante |
| Contrato em uso que não é o último contrato (o último, cancelado, foi para o Histórico) | Os mesmos de com próximo: Trancar ou Reativar e Cancelar. Renovar e Corrigir são do último contrato |
| Próximo contrato | Ativar agora, Corrigir, Cancelar renovação |
| Contrato agendado sem nenhum em uso | Ativar agora, Corrigir, Cancelar. Sai o Trancar |
| Vencido ou cancelado, sem próximo e sendo o último contrato | Nova matrícula (como hoje) |

O "Cancelar renovação" do próximo contrato é o desfazer que já existe (`isRenewalNotStarted`). Se o contrato renovado foi cancelado, a renovação não pode ser desfeita, e o botão diz "Cancelar" e faz o cancelamento comum.

### Modal do Ativar agora

Título "Ativar agora", com o nome do cliente, o plano e a data que estava marcada. Mostra as datas novas do contrato ("passa a valer de DD/MM/AAAA a DD/MM/AAAA"). Quando existe contrato em uso valendo, mostra também quando ele passa a terminar e o aviso de que os dias já pagos se perdem, com a contagem. Botões "Voltar" e "Ativar agora".

A regra de início da renovação vale aqui como no Corrigir (`renewalStartProblem`): a renovação começa no mínimo dois dias depois do início do contrato que ela renova. No dia seguinte ao início dele, o modal mostra a regra ("A renovação precisa começar a partir de DD/MM/AAAA, dois dias depois do início do contrato renovado.") e o botão fica desligado. Sem a regra, o Ativar agora nesse dia não encurtava nada, tirava a marca de emendada da renovação e deixava os dois contratos valendo juntos.

## Quem é o contrato em uso

Regra pura, em `src/lib/contractsTab.js`, a partir dos contratos do lead e de `lead.currentContractId`.

- **Último contrato** é o de `lead.currentContractId`, como hoje.
- Se o último contrato já começou, ele é o destaque e não existe próximo.
- Se ele ainda não começou, o destaque é o contrato em uso: o contrato que ele renova (`renewedFromId`), quando esse já começou, não foi cancelado e ainda vale. O trancado conta como em uso, porque o fim dele não corre, a não ser que o sucessor dele já tenha começado (ver "Situação", abaixo). Só quando o último contrato não é renovação (sem `renewedFromId`) vale outro contrato do lead nessas condições, o de início mais recente. Renovação cujo contrato renovado já acabou fica como destaque, agendada, e nunca puxa um contrato antigo ou paralelo para o lugar dele.
- Com contrato em uso, o último contrato é o próximo. Sem contrato em uso, o último contrato é o destaque, como contrato agendado.
- O Histórico é o resto: tudo que não é o destaque nem o próximo.

"Ainda vale" segue `contractEndOf`: o fim do contrato, ou o cancelamento quando veio antes.

## Detalhes de cada contrato

Uma função pura (`contractFactsOf`) monta os fatos de um contrato, para a tabela e para a linha aberta.

- **Início:** `startsAt`. Importado sem início usa `createdAt`.
- **Fim previsto:** início mais `durationMonths`. Sem duração gravada, vale o fim gravado menos os dias trancados.
- **Fim de fato:** `contractEndOf`. No contrato ainda aberto, é o fim gravado.
- **Motivo da diferença**, nesta ordem: cancelado ("cancelado", com o motivo), encerrado antes pela renovação (tem `originalEndsAt` e terminou antes dele: "N dias antes, pela renovação"), esticado pelo trancamento ("N dias depois, pelo trancamento").
- **Trancado:** `pausedDaysTotal` mais a pausa aberta, e o número de pausas. Os períodos saem de `pauseHistory`. Contrato antigo sem o histórico mostra o total com um período refeito, como o Operacional já faz.
- **Valor e média mensal:** `value` e `value` dividido por `durationMonths`.
- **Desconto:** `contractDiscountOf`, com o motivo e o valor de tabela.
- **Quem fechou:** `consultantName` e `createdAt`.
- **Origem:** `contractOriginOf`.
- **Situação:** `historyStatusOf`. Com renovação ligada, "Em uso" enquanto o contrato vale, por dia do calendário, e "Renovado" só depois do fim dele: a renovação que já começou e cruza o contrato sem encurtá-lo vale junto com ele, e ele segue "Em uso" até o fim, a mesma leitura de `isInUseAt` (revisão final de 01/10/2026). E uma regra nova, decidida pelo Johnny em 30/09/2026 depois da revisão: o contrato que continua trancado no dia em que o sucessor começa (a renovação ligada ou outro contrato da pessoa, o que começar primeiro) volta a correr junto com ele. A pausa fecha no início do sucessor e o fim anda os dias parados. No Histórico ele aparece "Em uso" até o fim novo, com a nota "Estava trancado quando a renovação começou e voltou a correr junto com ela.", e depois "Renovado" (ou "Vencido", quando o sucessor não é renovação ligada). É a leitura que o Operacional já fazia (`closeOpenPause`): a regra do sucessor é uma só, `pauseSuccessorStartOf`, e um teste confere que a ficha e o Operacional dão o mesmo fim. A carteira do Gerencial conta os dois contratos nesse trecho.
- **Contrato que nunca valeu** (renovação desfeita): sem fim de fato ("nunca começou"), sem média e sem ordem de renovação.

## Regras de gravação

### O alvo é o contrato certo

Com próximo contrato, o Trancar, o Reativar e o Cancelar do card agem no contrato em uso, e não em `lead.currentContractId`. O `ContractOutcomeModal` já recebe o contrato por parâmetro. O que muda é o resumo do lead que cada gravação toca:

- contrato que é o último (`lead.currentContractId`): como hoje, os campos `currentContract*`;
- contrato em uso com próximo marcado: só o bloco "em uso" do resumo (abaixo), sem tocar em `currentContract*`.

O Corrigir segue a mesma divisão (`buildContractEdit` recebe o `lead`, revisão final de 01/10/2026): só o último contrato grava `currentContract*`. Corrigir outro contrato atualiza apenas o bloco "em uso", e só quando o bloco aponta para ele; sem o bloco, o resumo do lead não é tocado. O contrato que uma renovação encurtou (`shortenedById`) continua terminando na véspera dela: o fim vendido recalculado vai para `originalEndsAt`, e só quando o fim vendido novo cai antes do fim encurtado o encurtamento deixa de existir. Na tela, o Corrigir não aparece no destaque que não é o último contrato, e o `ContractOutcomeModal` não trata o último contrato cancelado como renovação marcada: cancelar o em uso nesse caso é cancelamento comum, no bloco, sem patch na renovação.

### Trancar e reativar o contrato em uso

- Trancar grava no contrato o que já grava hoje (`status: 'trancado'`, `pausedAt`, `pauseReason`). No lead, grava o bloco "em uso" com `inUseContractStatus: 'trancado'`.
- Reativar grava no contrato o que já grava hoje (o fim anda pelos dias parados). Se o contrato tinha sido encurtado por uma renovação (`originalEndsAt`), o `originalEndsAt` anda os mesmos dias, para o "Cancelar renovação" devolver a data certa depois. No lead, o bloco volta para `inUseContractStatus: 'ativo'` com o fim novo.
- A renovação não é tocada. Se o fim novo do contrato em uso passar do início dela, os dois valem juntos nesse trecho.
- O modal de trancar, com próximo marcado, avisa: "A renovação (Plano X) continua marcada para DD/MM/AAAA. Se o contrato ainda estiver trancado nesse dia, os dias que sobram dele correm junto com ela."

### Cancelar o contrato em uso

- O contrato em uso é cancelado como hoje (`status: 'cancelado'`, data, motivo e observação).
- A renovação continua. Se ela tinha a marca de emendada (`seamless`), a marca sai, no contrato e em `currentContractSeamless`, porque agora existe um intervalo até ela começar.
- No lead, o bloco "em uso" fica com `inUseContractStatus: 'cancelado'`.
- A linha do tempo ganha a frase no fim do texto de cancelamento: "A renovação continua marcada para DD/MM/AAAA."
- A prévia do modal diz: "O contrato é encerrado em DD/MM/AAAA. A renovação (Plano X) continua marcada para DD/MM/AAAA, e até lá o cliente fica sem contrato."

### Ativar agora

- É a correção do início para hoje, pela regra que já existe (`buildContractEdit`): o fim é recalculado pela duração, e o plano, o valor e o desconto não mudam.
- Com contrato em uso em vigor, vale a regra da véspera: ele passa a terminar ontem, com `originalEndsAt` e `shortenedById`, e o contrato ativado leva a marca de emendado.
- Com o contrato em uso trancado ou cancelado, nada é encurtado.
- O bloco "em uso" do lead é limpo, porque o último contrato passou a valer.
- Texto da linha do tempo: "Contrato ativado antes da data marcada — Plano X (R$ Y), vigência DD/MM/AAAA → DD/MM/AAAA." O `contractEventOf` ganha o tipo `ativacao`, que é linha comum do tipo "Contrato", sem faixa.

### Quem mais grava o bloco "em uso"

- **Renovação** (`buildMatriculaWrites`): quando o contrato novo começa depois de agora e o contrato renovado está em vigor, o resumo do lead ganha o bloco com o contrato renovado. Quando o contrato novo já começa valendo, o bloco é limpo.
- **Matrícula** e **importação**: limpam o bloco. A exceção é a matrícula marcada para depois de um cliente com contrato em vigor: ela grava o bloco com esse contrato, como a renovação, para a lista dizer ativo enquanto ele treina.
- **Corrigir o próximo contrato** (`buildContractEdit`): se o início novo já chegou, limpa o bloco. Se continua no futuro, atualiza o fim do contrato em uso no bloco.
- **Cancelar renovação** (`buildRenewalCancel`): limpa o bloco, porque o resumo volta para o contrato renovado.

## Estado do cliente nas listas

Hoje o resumo do lead só descreve o último contrato. Ele passa a guardar também o contrato em uso, enquanto o último não começa:

| Campo do lead | Conteúdo |
|---|---|
| `inUseContractId` | id do contrato em uso, ou `null` |
| `inUseContractStatus` | `ativo`, `trancado` ou `cancelado` |
| `inUseContractEndsAt` | fim do contrato em uso |

`deriveLeadContractStatus` passa a ler o bloco quando o último contrato ainda não começou e existe `inUseContractId`:

| Contrato em uso | Estado |
|---|---|
| `trancado` | Trancado |
| `cancelado`, ou o fim dele já passou | Agendado |
| valendo | Ativo (nunca "A vencer", porque o cliente já renovou) |

Sem o bloco, vale a regra de hoje, com a marca `currentContractSeamless` como reserva. Lead com renovação marcada antes desta entrega não tem o bloco: o estado dele continua saindo da marca, e a primeira ação no contrato em uso grava o bloco inteiro.

A comparação é por instante, como o resto de `deriveContractStatus`, porque o cartão do Stronizap roda em UTC e nada ali pode ler dia do calendário local.

O estado vale onde `deriveLeadContractStatus` e `deriveLeadState` já são usados: topo da ficha, Clientes, Kanban, Meta Diária e cartão do Stronizap. Conserta o item 5 do problema: renovação com intervalo aparece como ativa enquanto o contrato em uso vale, e como agendada só no intervalo.

## Painéis

Operacional e Gerencial leem os contratos, e não o resumo do lead. Não se espera mudança de código neles. A revisão confere, com a bateria aleatória usada na vigência, as situações novas:

- contrato em uso trancado e reativado com renovação marcada, inclusive com os dois se cruzando;
- contrato em uso cancelado com a renovação seguindo;
- contrato ativado antes da data.

Leituras esperadas: o cancelamento do contrato em uso conta como cancelamento, a pessoa sai da base e volta quando a renovação começa, e ativar antes é lido como a renovação sobreposta de hoje.

## Arquivos

- `src/lib/contractsTab.js` (novo): `contractsTabModel` (destaque, próximo, histórico e encaixe), `contractFactsOf` e `contractTimelineOf` (segmentos, trilhas, pausas, anos e hoje, já em porcentagem).
- `src/lib/contracts.js`: bloco "em uso" nas gravações, `buildContractActivate`, `deriveLeadContractStatus` com o bloco, reativação andando o `originalEndsAt`, cancelamento do contrato em uso.
- `src/lib/contractHistory.js`: `runningPredecessorOf` aceita o trancado, e `historyStatusOf` ganha a regra do trancado com renovação começada.
- `src/lib/timeline.js`: tipo `ativacao`.
- `src/lib/contractsWrites.js`: `commitContractPatch` grava o segundo contrato também no cancelamento do contrato em uso (a marca de emendada da renovação).
- `src/components/profile/contracts/` (novo): `ContractsTab.jsx`, `ContractTimeline.jsx`, `ContractHeroCard.jsx`, `NextContractStrip.jsx` e `ContractHistoryTable.jsx`. A aba sai de dentro do `LeadProfileView.jsx`, que passa a montar o `ContractsTab`.
- `src/modals/ContractOutcomeModal.jsx`: textos e gravação do contrato em uso com próximo marcado.
- `src/modals/ContractActivateModal.jsx` (novo).
- `CLAUDE.md`: seção "Aba Contratos da ficha".

## Testes

Em node, nas regras puras, como no resto do app:

- `contractsTab.test.js` (novo): quem é o destaque e o próximo em cada caso (sem próximo, emendado, com intervalo, em uso trancado, em uso cancelado, agendado sem contrato em uso, contratos paralelos), os fatos de cada contrato (fim previsto, fim de fato e o motivo, trancado, média, importado sem valor) e a linha do tempo (posições, segunda trilha, pausas, renovação desfeita de fora).
- `contracts.test.js`: o bloco "em uso" em cada gravação, o estado do lead com o bloco, o Ativar agora, a reativação do contrato encurtado e o cancelamento do contrato em uso.
- `contractsWrites.test.js`: o lote do cancelamento do contrato em uso.
- `timeline.test.js`: o texto do Ativar agora e o do cancelamento com a frase da renovação.
- `leadState.test.js` e `api/__tests__/zapStrip.test.js`: o estado com o bloco, no cartão do Stronizap com o processo em UTC.
- Um teste de render da aba (`renderToString`, no molde do `profileContractActions.test.js`) nas cinco situações da tabela de botões, com a linha do Histórico aberta.

## Fora do escopo

- As colunas de plano, valor e vencimento da lista de Clientes continuam mostrando o último contrato.
- Corrigir o contrato em uso quando já existe renovação marcada.
- Botões nas linhas do Histórico. O contrato que ainda estiver trancado no dia em que a renovação começa volta a correr junto com ela, aparece "Em uso" no Histórico e não tem ação.
- O contrato cujo fim gravado à meia-noite aparece como vencido no último dia (tarefa separada).
- Os itens 8 a 16 da auditoria de 28/09 que não entraram aqui.

## Depois da revisão das regras (30/09/2026)

A revisão independente das regras, antes da tela, pediu estes ajustes, já feitos:

- O destaque nunca é um trancado já alcançado pelo sucessor, nem um contrato paralelo quando o último contrato é renovação (o "contrato em uso" escolhido errado aparecia com botões que gravavam no contrato errado).
- O último contrato cancelado nunca é o próximo: com contrato em uso, ele vai para o Histórico.
- O destaque vencido ou cancelado só oferece "Nova matrícula".
- Ativar agora e Corrigir de contrato sem `durationMonths` (importado) andam o fim o mesmo tanto que o início, em vez de apagar o fim, e valor ausente continua ausente.
- Corrigir ou ativar o próximo com o contrato em uso trancado só devolve o fim original do em uso quando o início novo deixa de sobrepor. Enquanto sobrepõe, o em uso fica como está.
- Com o contrato em uso trancado, a faixa do próximo diz "O contrato em uso está trancado. Quando este começar, os dias que sobram dele correm junto."
- O modal de desfecho decide o papel pelo contrato que recebeu, nunca cai em `currentContractId` quando recebeu um contrato, e nunca desfaz renovação com o contrato em uso.

## Depois da revisão final (01/10/2026)

A revisão independente da entrega inteira pediu estes ajustes, já feitos:

- No último dia do contrato em uso, com a renovação marcada, o destaque continua o em uso, com Trancar e Cancelar. O fim gravado à meia-noite já o deixava vencido por instante, e a aba mostrava o card fechado com "Nova matrícula", que gravaria um segundo contrato.
- O destaque que não é o último contrato (o último cancelado foi para o Histórico) age como se tivesse próximo: só Trancar ou Reativar e Cancelar. Antes ele oferecia Renovar e Corrigir, e o Corrigir reescrevia o resumo do lead com os dados dele. O `buildContractEdit` passou a receber o `lead` e só grava `currentContract*` para o último contrato; o contrato encurtado por uma renovação continua encurtado na correção; o `ContractOutcomeModal` ignora o último contrato cancelado como renovação marcada; o `contractById` da ficha não cai mais no último contrato para outro id.
- O Ativar agora segue a regra de início da renovação (dois dias depois do início do contrato renovado), como o Corrigir.
- No Histórico, "Renovado" só depois do fim do contrato: a renovação que já começou e cruza o contrato sem encurtá-lo deixa o contrato "Em uso" até o fim dele, como `isInUseAt`.
- As prévias de reativar e trancar saíram sem travessão no meio da frase, e a aba usa `flex` com `gap` e o token `text-muted-foreground` no texto discreto.

Decisão do Johnny em 01/10/2026: Ativar agora a renovação com o contrato em uso trancado continua tirando a marca de emendada da renovação, pela regra de antes ("fora de vigor, não emenda"). Depois de ativada, a renovação já começou, então a marca não muda o estado dela, e o contrato trancado volta a correr junto, pela regra do sucessor.

## Pontos em aberto

- Com o último contrato cancelado e outro contrato ainda em uso, o resumo do lead descreve o cancelado. Clientes (etiqueta, anel e filtro), o topo da ficha, a busca e o cartão do Stronizap mostram "cancelado", a Meta Diária deixa o cliente fora da renovação e dos vencidos, e o Upgrade do Kanban fecha como matrícula nova. A aba Contratos mostra o contrato em uso. Acontece na renovação cancelada com data depois do início dela, enquanto o contrato anterior ainda vale, e no contrato paralelo, quando o mais novo é cancelado.
- O texto da linha do tempo do Ativar agora mostra "(R$ 0,00)" em contrato importado sem valor.

## Riscos

- O bloco "em uso" é uma cópia. Se o contrato em uso mudar por um caminho que não passa por estas gravações, a cópia fica velha. O estado nas listas pode errar até a próxima gravação. A ficha não erra, porque lê os contratos.
- A aba sai de dentro do `LeadProfileView.jsx`. Os testes de render da ficha que olham a aba (`profileContractActions.test.js`, `profileTimeline.test.js`) precisam continuar passando.
- Os textos novos da linha do tempo são lidos por `contractEventOf`. Quem mudar o texto precisa mudar o leitor e o teste junto.
