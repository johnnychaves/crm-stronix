---
status: ativo
---

# Professor e faltosos

Spec aprovada em conversa com o Johnny em 02/10/2026, parte por parte. É um módulo só da STRONIX por enquanto e vale só para o Stronilead. O botão que abre a conversa do aluno no Stronizap tem spec própria.

O levantamento da catraca, da API e das planilhas da Next Fit está em `2026-10-02-professor-e-faltosos-levantamento.md`, nesta mesma pasta.

## O problema

Hoje o Stronilead não sabe quem parou de vir. A frequência está na Next Fit, que controla a catraca. Toda segunda, a coordenadora tira um relatório de lá e repassa a cada professor, numa planilha, os alunos que ele precisa procurar. O professor não entra no Stronilead, o contato não fica registrado em lugar nenhum, e o aluno que sumiu na terça só aparece na lista da segunda seguinte.

Este projeto leva isso para dentro do Stronilead. O professor ganha login. A importação semanal de dois relatórios da Next Fit monta sozinha a lista de faltosos de cada professor, tira da lista quem voltou e registra as presenças na ficha. Cada contato do professor fica na linha do tempo do aluno.

## Decisões

| Assunto | Decisão |
|---|---|
| Para quem | Só a STRONIX, por um módulo que o super-admin liga por academia. Nas outras academias nada muda. |
| De onde vem a presença | Dos relatórios Faltantes e Presenças da Next Fit, exportados e importados no Stronilead. Nada lê a catraca, porque ela só conversa com a Next Fit. |
| Quando importar | Pensado para uma vez por semana, na segunda. Funciona em qualquer dia e com qualquer intervalo. |
| Quem importa | Só o gestor. |
| Marcos de falta | Configuráveis, começando em 7, 14, 30 e 60 dias. Cada marco vale um contato. Depois do último, o aluno fica na lista de acompanhamento, sem virar tarefa toda semana. |
| Urgente | Aluno faltando com o contrato terminando em até 90 dias (configurável). Fica no topo da Meta do professor e destacado para o gestor. O consultor não entra. |
| Aluno sem contrato ativo ou com contrato trancado no Stronilead | Fica fora da Meta e aparece listado na importação. |
| Tarefa pendente | Fica na Meta até o professor registrar o contato. Se o aluno passa para o marco seguinte, o mesmo card troca de marco. |
| "Quer cancelar" | Avisa o gestor no sino. |
| O professor | Papel novo, ligado a um professor do cadastro de professores. Vê a Meta diária, Clientes (com a aba Faltosos) e a ficha. Na ficha, registra Anotação, WhatsApp, Ligação e Agendar. Contratos e Indicações ficam só para leitura. Não tem o lápis de editar cadastro, o "Cadastrar indicação" nem o Mudar fase. |
| Professor e consultor | O professor não é consultor: não aparece na escolha de consultor responsável, não vira dono de lead, não conta em venda nem em ranking e não ocupa vaga de consultor do plano. |
| Perfis de acesso | O que cada papel pode fazer fica numa lista só, consultada por toda tela e todo botão. A tela para editar perfis vem em outro projeto e só troca a origem dessa lista. |
| Presenças | Aba nova da ficha, ao lado de Indicações, com um dia por linha. |
| Travas | No servidor, pelas regras do Firestore, e não só na tela. |
| Stronizap | O professor fala com os alunos pelo canal dos professores, que já existe no Stronizap com número próprio. O botão que abre a conversa vem numa spec própria. Até lá, o card do faltoso tem o botão de WhatsApp. |

## O módulo

- O documento da academia (`tenants/{id}`) ganha `modules`, uma lista de textos. Este projeto usa `'faltosos'`.
- O super console ganha, na página da academia, a chave "Professor e faltosos". Só o super-admin liga e desliga. A gravação passa pela `api/tenant-status.js`, que já grava outros campos da academia (`internal`, `monthlyPrice`), então não nasce função nova.
- O app lê a lista no login, junto com o cadastro da academia que ele já lê nessa hora (`App.jsx`, na leitura de `tenants/{id}`). Ligar ou desligar o módulo vale no próximo login ou F5.
- Sem o módulo, o papel Professor não aparece em Equipe & acessos, as abas Faltosos e Presenças não aparecem, a Meta não muda e as regras recusam gravar nas coleções do módulo.
- A conta mora em `src/lib/modules.js` (`hasModule(tenant, 'faltosos')`), pura. As regras têm a função equivalente, que lê o mesmo documento da academia que o `tenantActive` já lê.
- A tela "Feature flags" do super console continua como está. Ela grava chaves globais que nenhuma parte do app lê, e este projeto não a usa.

## O professor

### Criar o acesso

- Em Configurações → Equipe & acessos, ao convidar ou criar uma pessoa, o gestor escolhe o papel Professor e diz qual professor do cadastro de professores ela é. Professor inativo não aparece na escolha. Cada professor do cadastro tem no máximo um login.
- O cadastro em `stronix_users` grava `role: 'professor'` e `professorId`.
- O convite e a senha seguem o caminho de hoje (`api/invite-create.js`, `api/invite-accept.js` e `api/admin-users.js`). Esses caminhos passam a aceitar `professor`, só com o módulo ligado.
- O professor não conta como consultor nem como gestor no limite do plano. `getSeatUsage` e `canAddSeat`, em `api/_plans.js`, contam o professor à parte. Hoje quem não é gestor conta como consultor.
- Trocar o papel de alguém ou o professor ligado é do gestor, como as outras mudanças de equipe.

### O que ele vê

- Menu: Meta diária e Clientes. A ficha abre pelos links, como hoje.
- Fora do menu: Visão geral (Operacional, CRM e Gerencial), Pipeline, Leads (Todos os leads, Aulas e Visitas), Configurações, Perfil da academia e Plano e faturas. Quem abre o endereço de uma dessas telas recebe "Essa tela não está liberada para o seu acesso." e vai para a Meta diária, no molde do aviso de tela de gestor que o `routeDecision` já dá.
- Clientes: a lista de sempre, com a aba Faltosos. Os botões que criam cadastro e o que exporta a lista ficam de fora.
- Busca do topo: acha só clientes.
- Ficha:
  - a Linha do tempo;
  - a aba CRM, com Anotação, WhatsApp, Ligação e Agendar, sem o Mudar fase;
  - Contratos e Indicações sem nenhum botão;
  - a aba Presenças.
  - O lápis de editar o cadastro, o "Indicar" e o "Cadastrar indicação" ficam de fora.
- Sino: só as novidades do Stronilead.

### A lista do que cada papel pode fazer

- Mora em `src/lib/acesso.js`, pura. Para cada papel (gestor, consultor e professor), diz quais telas abre e quais ações faz: `can(user, 'tela.pipeline')`, `can(user, 'ficha.mudarFase')`, `can(user, 'contrato.editar')`, `can(user, 'lead.criar')`, `can(user, 'cadastro.editar')`, `can(user, 'indicacao.cadastrar')`, `can(user, 'clientes.exportar')` e assim por diante.
- `isSeller(user)` diz quem vende (gestor e consultor). Ele decide quem aparece na escolha de consultor responsável, nos rankings, nas listas de equipe da Meta e nos painéis por pessoa.
- Hoje o app decide quase tudo por `role === 'admin'`, em 19 lugares, e trata quem não é gestor como consultor. Cada um desses lugares passa a perguntar à lista ou ao `isSeller`, senão o professor herda o que é de consultor. Um teste de varredura cobra que nenhum arquivo volte a decidir por `role === 'admin'` fora de `acesso.js`.
- Quando os perfis editáveis vierem, a lista sai do código e passa a ser lida da academia. As telas continuam perguntando do mesmo jeito.

## As importações

Ficam em Clientes → aba Faltosos, no botão "Importar planilhas", que só o gestor vê. Tudo roda no navegador, como a importação de clientes, sem função nova na Vercel. A leitura do arquivo usa o SheetJS que o app já usa (`readSpreadsheetFile`).

### Os arquivos

- A tela aceita um ou os dois arquivos de uma vez, em qualquer ordem. Cada um é reconhecido pelo cabeçalho:
  - Faltantes: `Nome`, `Contrato`, `Qtde de ausências`, `Última presença`, `Telefone`, `Professor`, `Consultor`.
  - Presenças: `Cliente`, `Modalidade`, `Contrato`, `Tipo`, `Data`.
- Arquivo com outro cabeçalho é recusado: "Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit."
- Perto do botão, a tela lembra como exportar: o Faltantes com o menor marco (hoje 7 dias), e o Presenças a partir do dia seguinte ao último dia já importado ("Exporte de 06/10 até hoje").

### A data do Faltantes

- A data da exportação é a última presença mais a quantidade de ausências. Todas as linhas precisam dar o mesmo dia. Se não derem, vale o dia mais comum e a prévia avisa.
- Faltantes com data anterior à do último Faltantes importado é recusado. Com a mesma data, a importação chega ao mesmo resultado.

### A ligação dos professores

- Fica em `stronix_config/faltosos`, no campo `professorLinks`: o nome como vem da Next Fit aponta para um `professorId`, ou para `null`, que quer dizer "Sem professor".
- Quando aparece um nome novo, a importação para num passo curto, com cada nome novo e uma sugestão. A sugestão é o professor ativo cujo nome começa com o texto da Next Fit, ignorando acento e maiúscula, porque a Next Fit corta o nome em 29 caracteres. Sem esse professor, a sugestão é o professor ativo com mais palavras do nome em comum, desde que sejam pelo menos duas. Sem nenhum assim, não há sugestão. O gestor confirma, escolhe outro ou escolhe "Sem professor", e a escolha fica guardada.
- O aluno com o professor vazio ou ligado a "Sem professor" fica com o gestor: aparece no grupo "Sem professor" da aba Faltosos e não entra na Meta de ninguém.
- As ligações podem ser revistas em Configurações → Metas & ritmo.

### A ligação dos alunos

- Só cliente entra (`lifecycleBucket === 'cliente'`).
- Faltantes: pelo telefone, com a chave que o Stronizap já usa: o DDD e os últimos 8 dígitos (`zapMatchKey`). Ela acha o telefone do próprio aluno e o do responsável pelo menor (`guardianZapMatchKey`). Se o telefone achar mais de um cliente, o nome desempata, sem acento, sem maiúscula e sem espaço a mais. Quando liga, o Stronilead guarda o nome com que o aluno aparece na Next Fit.
- Presenças: pelo nome, porque o relatório não traz telefone. Vale primeiro o nome guardado pelo Faltantes ou por uma ligação feita à mão. Depois, o nome igual entre os clientes. Nome que bate com mais de um cliente, ou com nenhum, não é ligado.
- Os nomes guardados ficam em `stronix_nextfit_alunos`, que só o gestor lê.
- Na prévia, os alunos não ligados aparecem com o nome (e o telefone, no Faltantes) e uma busca de clientes ao lado, para ligar na hora. A ligação feita ali fica guardada. O que não for ligado vai para "Não achados" na aba Faltosos, até a próxima importação.

### O Faltantes, aluno por aluno

O estado de cada aluno faltando mora em `stronix_faltosos/{leadId}`.

Contrato ativo, aqui, é o que `deriveLeadContractStatus` dá como ativo ou a vencer. O aluno ligado que está sem contrato ativo ou com o contrato trancado no Stronilead não entra: não ganha estado nem tarefa e só aparece na prévia. Se ele já tinha um período de falta aberto, o período fecha como "encerrado".

- Aluno que está no arquivo:
  - sem estado guardado, ou com a última presença mais nova que a guardada: começa um período de falta novo. Se havia uma tarefa pendente do período anterior, ela fecha como "voltou";
  - com a mesma última presença: continua o mesmo período de falta;
  - nos dois casos, a importação grava a última presença, o professor, o contrato como vem da Next Fit, os dias sem vir e o urgente.
- Aluno com estado "faltando" que não está no arquivo:
  - se o Presenças tem presença dele depois da última presença guardada, ele voltou nesse dia;
  - se não tem, e o cliente está sem contrato ativo ou com o contrato trancado no Stronilead, o período fecha como "encerrado";
  - se não tem, e o contrato está ativo, ele voltou em algum dia depois da última presença e até a data do Faltantes.
- "Voltou" e "encerrado" fecham a tarefa pendente e tiram o aluno da Meta.
- Quem voltou ganha uma linha na linha do tempo: "Voltou a treinar em 03/10" ou, sem o dia exato, "Voltou a treinar entre 26/09 e 06/10". O tipo é `presence_return`, no filtro Marcos. "Encerrado" não grava linha.

### Marcos e tarefas

- Chamando de E a data do Faltantes e de E0 a data do Faltantes anterior (na primeira importação, E menos 7 dias), o aluno atravessou o marco de M dias quando a última presença mais M dias cai depois de E0 e até E.
- Se ele atravessou um ou mais marcos, a tarefa passa a ser do maior marco atravessado. Se havia tarefa pendente, o mesmo card troca de marco. Se a tarefa do marco anterior já tinha sido feita, nasce a do marco novo.
- Se não atravessou nenhum, nada muda, e a tarefa pendente continua pendente.
- Depois do último marco, só o urgente cria tarefa.
- Se o professor do aluno mudar na Next Fit, a tarefa pendente passa para o professor novo.

### Urgente

- Um aluno faltando é urgente quando o contrato em uso termina em até N dias (padrão 90) e ainda não terminou. O fim sai do resumo do lead: `inUseContractEndsAt` quando existe, senão `currentContractEndsAt`, com as regras de `deriveLeadContractStatus`.
- O urgente é calculado na importação e guardado no estado do aluno. A ficha recalcula ao abrir.
- Entrar no urgente cria uma tarefa, uma vez por período de falta, mesmo depois do último marco. A tarefa pendente de marco que vira urgente ganha o selo e sobe para a seção Urgente.

### O Presenças, linha por linha

- Cada linha ligada vira presença no dia, em `stronix_presencas/{leadId}_{AAAA-MM}`, com o dia, a hora da primeira passagem do dia, a origem (`Acesso` vira catraca e `Agenda` vira agenda) e as modalidades com nome de verdade. "offf", "off" e vazio são ignorados.
- O mesmo dia em dois arquivos conta uma vez, e fica a hora menor.
- O aluno com estado "faltando" que tem presença depois da última presença guardada voltou nesse dia, mesmo sem Faltantes novo.
- O período do arquivo vai do primeiro ao último dia que aparece nele. Se entre o último dia já importado e o primeiro dia deste arquivo passarem mais de 2 dias, a prévia avisa que pode ter ficado um buraco.

### A prévia

Nada é gravado antes do "Confirmar". A prévia mostra:

- a data do Faltantes e o período do Presenças;
- quantos alunos entram em cada marco, quantos são urgentes, quantos voltaram, quantos fecharam como encerrados e quantos seguem só na lista de acompanhamento;
- quanto fica com cada professor;
- os nomes novos de professor, no passo próprio, e os alunos não ligados;
- os alunos ligados que ficam de fora por estarem sem contrato ativo ou com contrato trancado no Stronilead;
- os avisos:
  - o Faltantes não tem ninguém com até 3 dias além do menor marco, e mais de 20% dos faltosos da importação anterior sumiram dele. Nesse caso, a prévia diz que o relatório parece ter saído com um filtro maior que o menor marco, e que quem sumiu seria marcado como "voltou";
  - as datas do Faltantes não batem entre si;
  - o buraco no período do Presenças.

### A gravação

- Em lotes de até 500 gravações. Os ids são fixos (`stronix_faltosos/{leadId}` e `stronix_presencas/{leadId}_{AAAA-MM}`), então refazer a mesma importação não duplica nada e completa o que tiver faltado.
- As linhas "Voltou a treinar" também têm id fixo, por aluno e período de falta.
- O registro da importação, em `stronix_importacoes_nextfit`, é gravado por último, com os números da prévia, quem importou e quando. O último Faltantes e o último dia do Presenças saem desse registro.

## A aba Faltosos

Fica em Clientes → Faltosos (`/clientes/faltosos`), para o gestor e para o professor.

- Topo: a última importação (quem fez, quando, a data do Faltantes e o período do Presenças), o botão "Importar planilhas" para o gestor e o lembrete de como exportar.
- Grupos: Urgentes; 7, 14, 30 e 60+ dias; e, para o gestor, Sem professor e Não achados.
- Filtro por professor, guardado no endereço pela regra do `screenParams`. O professor abre a aba já filtrada nos alunos dele.
- Para o gestor: o andamento de cada professor, no formato "12 de 21 feitos", com os pendentes.
- Cada linha: nome (link para a ficha), professor, dias sem vir, última presença, contrato e a tarefa (pendente, feita com o resultado, ou sem tarefa).

## A Meta do professor

Quando quem entra é professor, a Meta diária é a tela dos faltosos dele, e não a Meta do consultor. A tela nova mora num componente próprio e usa as mesmas peças visuais da Meta de hoje.

- Topo: "Faltosos da semana", com o contador ("12 de 21 feitos") e a data da importação ("Importação de segunda, 06/10"). A semana vai de uma importação do Faltantes até a seguinte.
- Seções: Urgente, depois 7, 14, 30 e 60 dias. Embaixo, "Feitos esta semana", recolhida.
- Card do aluno:
  - nome, com link para a ficha, e o plano;
  - "sem vir desde 25/09 (11 dias)", contando no horário de Brasília;
  - o contato pelo `contactOf`, que no menor é o responsável, com o botão de WhatsApp (`whatsappHref`). O botão do Stronizap entra quando a spec dele ficar pronta;
  - o último contato registrado ("Mensagem em 30/09, por" e o nome de quem registrou);
  - os botões "Registrar contato" e "Já voltou".
- Registrar contato: abre um balão com o canal (WhatsApp, Ligação ou Pessoalmente), o resultado (Respondeu, Não respondeu, Vai voltar ou Quer cancelar) e uma anotação opcional. Numa gravação só, entram a interação `absence_contact` e a tarefa como feita. A linha do tempo mostra "Contato de falta (14 dias) · WhatsApp · Vai voltar", no filtro Conversas.
- Quer cancelar: além do contato, o gestor recebe o aviso no sino.
- Já voltou: fecha a tarefa como "voltou (informado)". Se o Faltantes seguinte ainda trouxer o aluno com a mesma última presença, o período de falta continua, e a próxima tarefa vem no marco seguinte.
- Login sem professor ligado: a tela diz "Seu acesso ainda não está ligado a um professor. Fale com o gestor."
- Sem efeito na Meta do consultor: o contato de falta não altera o lead e não fecha tarefa de ninguém. A Meta do consultor só fecha tarefa com `daily_goal_done`.

## A ficha

- Quando o aluno está faltando, todo mundo que abre a ficha vê o selo "Sem vir há 11 dias" no topo. No urgente, o selo é vermelho e diz também quando o contrato termina.
- Aba Presenças (`/ficha/<id>/presencas`): só existe para cliente, como Indicações. Na ficha de um lead, o endereço cai na Linha do tempo.
  - No topo: "8 presenças nos últimos 30 dias" e a última presença.
  - Embaixo, os meses do mais novo para o mais velho, com um dia por linha: "02/10 · 07h00 · Catraca" ou "02/10 · 18h30 · Pilates (agenda)".
  - A aba lê os documentos do aluno só quando é aberta, de três em três meses, com o botão "Ver meses anteriores".
- `FICHA_TABS` ganha `presencas`, e o teste que cobra o par entre as abas e o endereço (`profileLinks.test.js`) passa a cobrar a aba nova.

## O sino do gestor

- O feed do sino (`src/lib/notifications.js`) ganha uma fonte: os contatos com resultado "Quer cancelar" dos últimos 30 dias. O estado do aluno guarda `querCancelarEm`, e o gestor lê esses documentos por esse campo.
- O aviso diz qual professor registrou e qual aluno quer cancelar, com o link para a ficha.
- O "já li" usa o mesmo carimbo de hoje.
- Só para o gestor, e só com o módulo ligado.

## Configurações

Em Configurações → Metas & ritmo entra o bloco "Faltosos", só com o módulo ligado:

- Marcos de falta: de 1 a 6 números de dias, de 1 a 365, sem repetir. O padrão é 7, 14, 30 e 60.
- Janela do urgente: em dias. O padrão é 90.
- Professores da Next Fit: a lista de nomes com o professor ligado a cada um, para trocar.

Mudar os marcos vale a partir da próxima importação.

## O Stronizap

O botão que abre a conversa do aluno no Stronizap tem spec própria, porque mexe nos dois sistemas e serve também ao consultor e ao gestor, na ficha e na Meta deles. O que já ficou decidido nesta conversa:

- O professor fala com os alunos pelo canal dos professores, que já existe no Stronizap e tem número próprio. Ele não entra no canal da recepção.
- O endereço do botão leva só o identificador da academia e o id do aluno. O Stronizap pergunta o telefone ao Stronilead de servidor para servidor.
- A conversa abre só nos canais a que a pessoa tem acesso, então o professor cai sempre no canal dos professores.

O levantamento do Stronizap feito em 02/10 acompanha a spec própria.

## Os dados

Todas as coleções ficam dentro da academia, em `artifacts/{appId}/public/data/`.

| Onde | O que guarda |
|---|---|
| `stronix_faltosos/{leadId}` | `professorId`, `professorNextFit`, `contratoNextFit`, `ultimaPresenca` (AAAA-MM-DD), `status` (`faltando`, `voltou` ou `encerrado`), `voltouEm`, `diasNaImportacao`, `urgente`, `contratoTerminaEm`, `querCancelarEm`, `atualizadoNaImportacao` e a `tarefa`: `marco`, `urgente`, `status` (`pendente`, `feita`, `voltou` ou `encerrada`), `criadaEm`, `importacaoId`, `feitaEm`, `feitaPor`, `feitaPorNome`, `canal` e `resultado`. |
| `stronix_presencas/{leadId}_{AAAA-MM}` | `leadId`, `mes` e `dias`, um mapa do dia (AAAA-MM-DD) para `hora`, `origens` e `modalidades`. |
| `stronix_importacoes_nextfit/{id}` | `dataFaltantes`, `periodoPresencas`, `importadoPor`, `importadoPorNome`, `importadoEm`, os números da prévia, os avisos e os não ligados. |
| `stronix_nextfit_alunos/{chave}` | O nome como vem da Next Fit, o `leadId` e a origem da ligação (telefone ou manual). |
| `stronix_config/faltosos` | `marcos`, `janelaUrgenteDias` e `professorLinks`. |
| `stronix_users/{id}` | `role: 'professor'` e `professorId`. |
| `tenants/{id}` | `modules`. |
| `stronix_interactions` | Dois tipos novos: `absence_contact` (marco, canal, resultado e texto) e `presence_return` (dia ou intervalo da volta e texto). |

Os dias são guardados como texto AAAA-MM-DD no calendário de Brasília, porque a importação roda no navegador da academia e o que importa é o dia, não o instante.

## As regras do Firestore

O Johnny publica as regras no console, como sempre.

- `isProfessor(appId)` lê o papel no cadastro da pessoa, do mesmo jeito que o `isAdmin`. `hasModule(appId, 'faltosos')` lê o documento da academia.
- Leads: o professor não cria nem exclui. Ele só altera os campos que o Agendar grava: as chaves do `buildSchedulePatch` (`src/lib/schedulePatch.js`), mais `lastInteractionAt` e `interactionsCount`.
- Contratos: o professor não cria nem altera.
- Interações: o professor cria só os tipos que as ações dele gravam: anotação, WhatsApp, ligação, a nota do agendamento e `absence_contact`.
- Aulas (`stronix_aulas`): o professor grava como os outros membros, porque o Agendar grava ali.
- `stronix_faltosos`: os membros leem, com o módulo ligado. O gestor grava. O professor só altera a `tarefa` e o `querCancelarEm` do documento em que o `professorId` é o dele.
- `stronix_presencas`: os membros leem, com o módulo ligado. Só o gestor grava.
- `stronix_importacoes_nextfit` e `stronix_nextfit_alunos`: só o gestor lê e grava.
- `stronix_config/faltosos`: como o resto da configuração.
- `stronix_users`: só o gestor cria professor, e ninguém troca o próprio papel, como hoje.
- Um teste confere que a lista de campos do lead na regra do professor continua igual às chaves do `buildSchedulePatch`. Mudou o Agendar, o teste quebra até a regra acompanhar.

## Quando algo dá errado

- Arquivo que não é da Next Fit, ou Faltantes mais antigo que o último: é recusado, e a tela diz por quê.
- Buraco no período do Presenças, ou Faltantes que parece ter saído com filtro maior: a prévia avisa antes do "Confirmar".
- Importação que cai no meio da gravação: basta importar os mesmos arquivos de novo. Os ids fixos completam o que faltou, sem duplicar.
- Login de professor sem professor ligado: a Meta mostra o aviso para falar com o gestor.
- Módulo desligado com dados gravados: os dados ficam onde estão, as telas somem e as regras recusam gravar. Com o módulo religado, tudo volta a aparecer.

## Testes

- As regras ficam em módulos puros em `src/lib/faltosos/`, com teste em node:
  - reconhecer os dois arquivos e recusar os outros;
  - ler as linhas e achar a data do Faltantes;
  - sugerir o professor pelo nome cortado;
  - ligar o aluno pelo telefone, pelo responsável, pelo nome guardado e pelo nome igual, com o desempate e os casos sem par;
  - comparar com a importação anterior: período novo, mesmo período, voltou com dia, voltou sem dia e encerrado;
  - os marcos: primeira importação, importações de semana em semana, intervalo longo entre importações, depois do último marco e troca de professor;
  - o urgente;
  - juntar catraca e agenda no mesmo dia, com a hora menor e sem as modalidades "offf" e "off";
  - os avisos da prévia.
- `src/lib/acesso.js`, com teste de cada papel, e a varredura que barra `role === 'admin'` fora dele.
- O teste da lista de campos do lead na regra do professor.
- Testes de tela em jsdom: a Meta do professor, o "Registrar contato", o "Já voltou" e a aba Presenças.
- Os testes de endereço cobram a aba `presencas` da ficha, a sub-tela `faltosos` de Clientes e o aviso de tela não liberada para o professor.
- Os testes usam planilhas falsas com o mesmo cabeçalho das de verdade. As planilhas de verdade, com dados de aluno, nunca entram no repositório.

## Entregas

1. PR 1, o professor: o módulo, o papel Professor (convite, vaga, lista do que cada papel faz, menu, ficha e o aviso de tela não liberada) e as regras do professor. Sem faltosos ainda.
2. PR 2, as importações: as duas importações, a aba Faltosos, a aba Presenças, o selo da ficha, o bloco de Configurações e as regras das coleções novas.
3. PR 3, a Meta do professor: a Meta, o "Registrar contato", o "Já voltou" e o aviso no sino do gestor.

## Publicação

- As regras de cada PR são publicadas antes do merge dele. As travas do professor não mudam nada para quem já usa o sistema, e as coleções novas precisam das regras antes da primeira importação.
- Depois do PR 1, o super-admin liga o módulo na STRONIX, e o gestor cria os logins dos professores.
- A primeira importação é feita com as planilhas da semana. Primeiro no Preview, parando na prévia para conferir com o Johnny os números e os não ligados. Depois, em produção.

## Fora deste projeto

- A tela para editar perfis de acesso.
- Frequência mínima por semana, como o aluno que vem só uma vez por semana.
- A API da Next Fit, que traria o professor de todos os alunos e a presença da agenda sem planilha.
- Ler a catraca.
- Outras academias. O módulo pode ser ligado nelas, mas o fluxo foi pensado para os relatórios da Next Fit.
- O professor editar cadastro, cadastrar lead ou indicação, mudar fase ou mexer em contrato.
- A frase de privacidade no contrato do aluno, sobre o uso da frequência para contato de retenção. É com o jurídico.
- Corrigir o nome "offf" da modalidade, que é configuração da Next Fit.
- Exportar os relatórios da Next Fit sem passar por alguém.
- O botão que abre a conversa no Stronizap, que tem spec própria.

## Critérios de aceitação

- Com o módulo desligado, nenhuma academia vê diferença.
- O gestor da STRONIX cria um professor ligado ao cadastro de professores, e ele entra vendo só a Meta diária, Clientes e a ficha, com as ações combinadas.
- O professor não consegue, nem pelo navegador, criar contrato, mudar fase, trocar o dono do lead ou cadastrar lead. As regras recusam.
- O professor não aparece na escolha de consultor responsável, nos rankings nem nas listas de equipe da Meta, e não ocupa vaga de consultor.
- A importação das duas planilhas da semana mostra a prévia, pede a ligação dos nomes novos uma vez só e grava só depois do "Confirmar".
- Importar os mesmos arquivos duas vezes não muda nada.
- O aluno que voltou sai da Meta com a linha "Voltou a treinar" na linha do tempo, e o que continua faltando troca de marco no mesmo card.
- O urgente aparece no topo da Meta do professor e destacado para o gestor.
- O "Registrar contato" grava a linha na linha do tempo e move o card para "Feitos esta semana". O "Quer cancelar" avisa o gestor no sino.
- A aba Presenças mostra um dia por linha, com a hora, a origem e a modalidade.
