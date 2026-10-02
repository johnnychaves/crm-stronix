---
status: ativo
---

# Abrir a conversa no Stronizap: levantamento

Leitura do código do Stronizap e do Stronilead feita em 02/10/2026, para a spec do botão que abre a conversa do aluno no Stronizap a partir do Stronilead. Nada foi editado nem instalado. A spec `2026-10-02-professor-e-faltosos-design.md` aponta para este levantamento.

Decidido com o Johnny depois da leitura:

- O professor fala com os alunos pelo canal dos professores, que já existe no Stronizap com número próprio. Ele não entra no canal da recepção.
- O botão serve ao professor, ao consultor e ao gestor. O professor ganha login no Stronilead pelo projeto professor e faltosos.
- As outras perguntas da seção 5 seguem abertas para a spec do botão.

Hoje nenhum endereço abre uma conversa no Stronizap, e o Stronilead não tem como achar o telefone pelo id do lead. Dá para construir sem telefone no endereço. O Stronizap recebe só o id do lead, pergunta o número ao Stronilead de servidor para servidor e abre a conversa sem assumir nada. Quem clica e em qual canal o professor fica foram decididos depois da leitura, no começo deste arquivo.

### Versão lida (nada foi editado nem instalado)
- Stronizap: o checkout local está em `main` a85de75 (2026-09-29 12:18:47 -0300), 106 commits atrás de `origin/main` 7c81bbd (2026-10-01 21:28:36 -0300, PR #177). As linhas do Stronizap abaixo são de 7c81bbd. Onde aparece "(local)", a linha é de a85de75. Existe ainda c4c8922 (2026-10-02, PR #178), que só mexe em ContactPanel (tags). A produção sobe por deploy manual no VPS e não foi conferida.
- Stronilead: `main` 49a978d (2026-10-01 14:32:44 -0300, PR #234). A worktree `claude/stronilead-dual-system-2a0e73` está no mesmo commit.

---

## 1. O que já existe

### Endereço que abre conversa: não existe nenhum
- Rotas do Stronizap: só existem /login, /esqueci-a-senha, /, /contatos, /novidades, /dashboard e /superadmin/* (frontend/src/App.tsx:41-85).
- Caminho desconhecido: cai em `/` com replace e perde a query (App.tsx:84). O roteador é BrowserRouter (frontend/src/main.tsx:46).
- Conversa aberta: é estado em memória, sem persistência. Começa vazia em frontend/src/stores/conversations.store.ts:169-181 e frontend/src/stores/channels.store.ts:33-35. No F5 a seleção some, e o ChatPage escolhe o primeiro canal conectado (frontend/src/pages/ChatPage.tsx:70-79).
- Abrir por id dentro do app já funciona. `openNoticeConversation` faz GET /conversations/:id, que confere o acesso. Depois chama `openConversation(channelId, id)` e vai para `/` (frontend/src/lib/openNoticeConversation.ts:37-76). Conversa que não está na lista aparece mesmo assim, buscada à parte (ChatPage.tsx:111-147). É esse caminho que o link deve reaproveitar.
- Precedente de parâmetro lido na partida e apagado da barra: o `?impersonate=` (App.tsx:26-36; frontend/src/stores/auth.store.ts:218-253).
- Login no meio perde o destino. O RequireAuth guarda `from` (frontend/src/components/RequireAuth.tsx:9-11), mas a LoginPage ignora e vai sempre para `/` (frontend/src/pages/LoginPage.tsx:13-24 e :53).
- Aba nova já entra logada: a sessão fica no localStorage `stronix-auth` (auth.store.ts:79-81 e :191-198).
- O Stronilead não guarda endereço do Stronizap. A busca em src/ e api/ não achou nada. `integrations.zap` só tem keyHash, keyPrefix, revokedAt, createdAt e createdBy (stronilead api/zap.js:244-256).
- Domínio do Stronizap: um só para todas as academias, https://stronizap.com.br (deploy/README.md:468; deploy/scripts/post-news.sh:80). O nginx devolve o index.html para qualquer caminho (deploy/nginx/whatsapp-stronix.conf:88-93), então uma rota nova abre direto.
- Precedente no sentido contrário: o "Abrir no Stronilead" monta `stronilead.com.br/<academia>/ficha/<id>` só com o id (frontend/src/types/crm.ts:256-273).

### Conversa nova por número: existe, mas não serve para "abrir"
- Rota: POST /api/conversations com `{channelId, phone, name?}` chama `startConversation` (backend/src/routes/conversations.routes.ts:182-204; backend/src/services/conversation.service.ts:1469-1645).
- O que ela exige:
  - acesso ao canal (:1477-1484);
  - o socket do canal na memória do servidor, senão dá 400 "Canal não conectado" (:1491-1492);
  - uma consulta ao WhatsApp a cada chamada: 404 se o número não tem WhatsApp, 503 se a consulta falha (:1507-1527).
- Instagram: não inicia conversa, porque o canal não tem socket (backend/src/services/whatsapp.service.ts:754-781).
- Efeitos colaterais:
  - cria conversa ACTIVE em nome de quem clicou;
  - conversa PENDING passa a ser de quem clicou;
  - conversa ENDED é reaberta em nome de quem clicou;
  - põe lastMessageAt = agora, grava TransferHistory e avisa a org inteira (:1563-1619 e :1636-1645);
  - ARCHIVED e ACTIVE de colega ficam como estão (:1621-1628).
- A tela de Contatos já usa esse POST para "abrir" um contato (frontend/src/pages/ContactsPage.tsx:69-84).
- Normalização do número:
  - tira o que não é dígito e exige de 8 a 15 dígitos;
  - número com 10 ou 11 dígitos que não começa com 55 ganha o 55 na frente; o resto vai cru (:1486-1505);
  - o número gravado é o que o WhatsApp devolve (:1529-1530), e o Stronizap nunca põe nem tira o nono dígito.
- Borda do DDD 55 (Santa Maria): gravado sem o 55 do país, o número vai cru e o WhatsApp lê o 55 como país (stronilead api/_zapPhone.js:8-10).

### Busca de contato
- Pelo id do lead: não existe em nenhum dos dois lados. A ação mais parecida do Stronilead é `appointment-status`: recebe ids de lead e devolve o agendamento, sem telefone (api/zap.js:654-676; api/_zapSchedule.js:182-202).
- Pelo telefone no Stronizap, só caminhos com defeito para este uso:
  - GET /api/contacts?search= procura pedaço dos dígitos, canal por canal (backend/src/services/contact.service.ts:32-69);
  - a busca da lista respeita a carteira (backend/src/services/search-sql.ts:38-47);
  - o check-number só diz se o número tem WhatsApp (backend/src/routes/channels.routes.ts:161-176).
- Nono dígito: nenhuma dessas buscas tolera a diferença. A regra DDD + 8 últimos dígitos só existe no Stronilead (api/_zapPhone.js:1-13 e :22-27).
- Contato e conversa são por canal. Contact é único por (phone, channelId) e Conversation é única por (contactId, channelId) (backend/prisma/schema.prisma:383 e :454). A mesma pessoa pode ter uma conversa em cada canal.
- Custo: o índice começa pelo telefone, então a busca exata `phone IN (com 9, sem 9)` é barata.

### O que o Stronizap guarda do Stronilead
- Na organização: crmEnabled, crmBaseUrl, crmApiKey cifrada e crmTenantSlug, que não é único (schema.prisma:45-55). O navegador recebe `crm.tenantSlug` (backend/src/services/organization.service.ts:84-89).
- No contato: só crmCheckedAt e crmFound (schema.prisma:355-361), mais o nome do CRM gravado em displayName (backend/src/services/crm-name.service.ts:94-119).
- Id do lead:
  - fica no cache do cartão, em memória, por 2 minutos, com a chave organização + telefone (backend/src/services/crm.service.ts:12 e :110-112);
  - aparece também dentro de `Message.crmReminder`, nos lembretes (schema.prisma:521-525);
  - Conversation não tem `crmLeadId`.

---

## 2. Visibilidade

### Regra de hoje
- Acesso a canal:
  - ADMIN vê todos os canais da academia;
  - GESTOR e ATENDENTE precisam de uma liberação por canal (`CollaboratorChannel`) (backend/src/services/channel-access.service.ts:18-35 e :41-51; backend/src/lib/tenant-rules.ts:48-57);
  - só o ADMIN libera, em Configurações → Equipe (backend/src/routes/collaborators.routes.ts:176-215; frontend/src/components/settings/CollaboratorsManager.tsx:327-333);
  - colaborador novo nasce sem canal.
- Lista de conversas:
  - ATENDENTE sem a política vê a fila PENDING inteira do canal e só as ACTIVE dele;
  - GESTOR, ou ATENDENTE com "Ver conversas de toda a equipe", vê todas as conversas do canal (backend/src/lib/conversationScope.ts:62-71; schema.prisma:39-43).
- Abrir por id, que é o que o link vai usar:
  - confere só a academia e o canal, nunca quem atende (conversation.service.ts:426-445);
  - responde 404 para conversa que não existe ou é de outra academia, e 403 sem acesso ao canal;
  - no 403 e no 404 o navegador mostra "Você não tem mais acesso a essa conversa" (openNoticeConversation.ts:9-14).
- Mensagens: passam pela mesma porta (conversations.routes.ts:230-248) e não vazam de outra conversa (conversation.service.ts:549-588).

### O que acontece com o professor cadastrado como ATENDENTE

| Situação | Lê? | Responde? |
|---|---|---|
| ACTIVE com outro atendente, mesmo canal | Sim, o histórico todo, e recebe as mensagens novas ao vivo (whatsapp.service.ts:1045 (local)) | Não. A caixa trava com "{Nome} está atendendo. Assuma pra responder" (frontend/src/lib/sendBlock.ts:82-91), e o servidor devolve 403 (conversation.service.ts:1811-1845) |
| Na fila (PENDING) | Sim | Sim. A caixa aceita texto, e enviar assume a conversa (sendBlock.ts:74-79) |
| Encerrada (ENDED) | Sim | Só depois de reabrir (sendBlock.ts:60-62) |
| Canal sem acesso | Não. Recebe 403 e o aviso | Não |
| Outra academia | Não. Recebe 404 | Não |

- Duas exceções na tabela:
  - com a política "Ver conversas de toda a equipe" ligada, o ATENDENTE responde sem assumir (sendBlock.ts:50-57);
  - GESTOR e ADMIN respondem sem assumir em qualquer conversa ACTIVE dos canais deles (conversation.service.ts:1834).
- Assumir conversa de colega: qualquer pessoa com o canal pode, sem trava de papel. O histórico registra "Assumiu de outro atendente" (conversation.service.ts:727).

### Papel que serve ao professor
- Stronizap:
  - Não existe papel de professor. Os papéis são fixos: SUPERADMIN, ADMIN, GESTOR e ATENDENTE (schema.prisma:262-267 (local)).
  - A visibilidade é por canal e carteira, nunca por tipo de contato (lead ou aluno).
  - O que mais se aproxima é ATENDENTE, sem a política, com acesso só ao canal que o professor deve usar.
  - No canal da recepção, porém, ele vê a fila inteira (leads inclusive), todos os contatos do canal (contact.service.ts:32-60) e qualquer conversa do canal pelo id, e pode assumir qualquer uma.
  - Para o professor só falar com aluno, há dois caminhos: um canal próprio dos professores, com número próprio, ou uma regra nova de carteira.
  - A regra nova teria de entrar em conversationScope, assertCanAccessConversation, Contatos, ⌘K e salas do socket.
  - Cada professor conta no limite de atendentes do plano (backend/src/services/plan-limits.service.ts:75-78).
- Stronilead:
  - Professor não é usuário. É um catálogo em `stronix_professores`, sem login (stronilead src/lib/professores.js:1-31; firestore.rules:176-179).
  - Os usuários são admin (gestor) e consultor (api/_zapLead.js:136).
  - A spec `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md`, escrita no mesmo dia, dá login ao professor no Stronilead.

---

## 3. O que falta construir

### Stronilead
- Ação nova `contact-of` (nome a decidir) no POST de api/zap.js:
  - entra no desvio do `handlePost` (api/zap.js:218-229), sobre `openByKey` (api/zap.js:366-384), no molde de `appointment-status` (api/zap.js:654-676);
  - cabe na mesma função da Vercel: hoje são 11 de 12 (stronilead CLAUDE.md:3 e :170).
- O que a ação faz:
  - recebe `{tenant, leadId}` e lê o lead da academia;
  - aplica `contactOf` (src/lib/guardian.js:49-67): no menor devolve o responsável, e no adulto novo sem número próprio também;
  - devolve `{found, leadId, name, phone já com o 55 do país, viaGuardian}`;
  - a decisão de quem é o contato continua só no CRM.
- Como ela é feita:
  - regras puras num arquivo novo (por exemplo `api/_zapOpen.js`), com teste;
  - caso novo em `api/__tests__/zapRoute.test.js`, no bloco do desvio;
  - erro sem dado pessoal pelo `scrubbedError`;
  - limite por hora com `checkRateLimit`.
- Atenção: é a primeira ação que manda telefone do Stronilead para o Stronizap. Ela entra na tabela "Os arquivos que formam o contrato" dos três CLAUDE.md.
- Botão "Stronizap", ao lado do WhatsApp:
  - Onde ele vai:
    - no cabeçalho da ficha (src/views/LeadProfileView.jsx:205-211 e :1258);
    - na Meta Diária, no NextUp e no TaskCard (src/views/DailyGoalView.jsx:254, :500 e :1655-1658).
  - Pipeline e Clientes não têm botão de WhatsApp hoje.
  - Só aparece com `zapIntegrationState` igual a "conectado" (src/lib/zapIntegration.js:15-19; o tenant já é lido em src/App.jsx:482-483).
  - "Conectado" só quer dizer que a chave foi gerada e não revogada.
- Montagem do link:
  - constante `STRONIZAP_URL` e montador do link em src/lib/zapIntegration.js, com teste de que só a academia e o id entram no endereço;
  - âncora com `target="_blank"` e `rel="noopener"`, e a marca de src/components/brand/StronizapMark.jsx.

### Stronizap, servidor
- Rota autenticada nova (por exemplo GET /api/crm/open?lead=<id>), num serviço novo (por exemplo `backend/src/services/crm-open.service.ts`):
  1. confere a integração ligada e recusa o superadmin. Falta decidir sobre a impersonação, porque as rotas de CRM da conversa recusam (backend/src/services/crm-conversation.service.ts:138-139);
  2. chama a ação nova do Stronilead pelo crm.service.ts (o mesmo cliente do cartão, crm.service.ts:357-434), com o crmTenantSlug da academia de quem está logado;
  3. monta os candidatos de telefone, sempre com o 55 do país e com e sem o nono dígito;
  4. procura os contatos da academia com `phone IN candidatos` (índice de schema.prisma:383), só nos canais que a pessoa acessa (channel-access.service.ts:41-51);
  5. devolve as conversas achadas (id, canal, status, primeiro nome de quem atende, última mensagem), sem o telefone. Se não houver nenhuma, devolve os canais de WhatsApp conectados que a pessoa acessa.
- Rota para iniciar (por exemplo POST /api/crm/open/start com `{lead, channelId}`):
  - resolve o telefone de novo no servidor e chama `startConversation` com o nome do CRM;
  - o telefone nunca passa pelo navegador.
- Regra do nono dígito no Stronizap: nova, espelho do zapMatchKey, com teste.
- Tipos: em frontend/src/types/crm.ts.
- Smoke: a checagem da ação nova entra em backend/src/scripts/smoke-crm-card.ts. Ela só lê.
- Limite por usuário nas duas rotas.

### Stronizap, navegador
- Entrada do link: rota nova `/abrir`, ou leitura na partida no molde do `?impersonate=`:
  - lê `academia` e `lead`;
  - guarda os dois no sessionStorage por poucos minutos;
  - apaga da barra com `history.replaceState` (App.tsx:26-36; auth.store.ts:218-253).
  - Sem isso, o catch-all leva para `/` (App.tsx:84).
- Sobreviver ao login: aplicar o pedido guardado depois do login, já que LoginPage.tsx:53 ignora o destino. Só aplicar com a sessão assentada, porque trocar de usuário limpa a conversa e o canal (conversations.store.ts:612-643).
- Vencer a corrida da partida:
  - o ChatPage escolhe o primeiro canal quando nenhum está selecionado (ChatPage.tsx:70-79);
  - a guarda "canal mudou" do `openNoticeConversation` descarta o resultado em silêncio (openNoticeConversation.ts:43-57 e :69);
  - o tratamento do link deve chamar `openConversation(channelId, id)`, que seleciona canal e conversa juntos (conversations.store.ts:241-250), ou usar uma versão sem essa guarda.
- Telas pequenas:
  - escolher a conversa quando há mais de uma;
  - confirmar "Iniciar conversa com Fulano no canal X" quando não há nenhuma;
  - avisos para academia diferente, aluno não encontrado, cadastro sem WhatsApp e canal sem acesso.

### Ordem de deploy
1. Stronilead com a ação nova, que fica parada até o Stronizap chamar.
2. Stronizap, deploy manual no VPS, com as rotas e as telas.
3. Stronilead com o botão.

Se o botão subir antes do Stronizap, o clique cai no catch-all e abre a caixa vazia.

---

## 4. Desenho recomendado

Formato do link: `https://stronizap.com.br/abrir?academia=<id da academia>&lead=<id do lead>`
- O id da academia já aparece nos endereços do Stronilead.
- O id do lead é o id aleatório do Firestore. É o mesmo de `/ficha/<id>`, e o Stronizap já o recebe no cartão (api/_zapCard.js:54-56).
- No menor vai o id do menor, e o Stronilead decide que a conversa é a do responsável.
- Nada de telefone, nome ou CPF.
- O Stronizap apaga os parâmetros ao ler. O Sentry do Stronizap não limpa endereço (frontend/src/lib/sentry.ts:17-30), mas um id aleatório é aceitável lá.

### Quem resolve o id para telefone
- O servidor do Stronizap, conversando direto com o servidor do Stronilead pela chave da integração, que nunca chega ao navegador.
- A academia é a de quem está logado no Stronizap. O `academia` do link só é comparado com o crmTenantSlug, para dar a mensagem certa a quem está logado em outra academia.

Login no meio do caminho: o pedido fica no sessionStorage antes de ir para /login e é aplicado depois. Ele vale alguns minutos, para não abrir uma conversa velha horas mais tarde.

### Canal escolhido

| Caso | O que acontece |
|---|---|
| Uma conversa em canal que a pessoa acessa | Abre direto |
| Várias | Abre a de mensagem mais recente e mostra as outras para escolher (ou pergunta antes, a decidir) |
| Nenhuma em canal acessível | Painel "Ainda não há conversa com Fulano. Iniciar no canal [X]?", listando só canais de WhatsApp conectados que a pessoa acessa. Só esse clique chama `startConversation` |
| Conversa só em canal sem acesso | Tratar como "nenhuma" e oferecer iniciar no próprio canal, sem dizer onde está a outra (a decidir) |

Conversa com outra pessoa: abre só para leitura, pelo caminho de hoje (GET /conversations/:id seguido de openConversation), sem assumir. A trava da caixa já mostra quem atende. Nunca abrir pelo POST /conversations.

### Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| URL da Parte B `/c?tenant&lead&phone&name` (stronilead docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md:140-142) | Põe telefone e nome no endereço, não diz o canal e usa `startConversation`, que tem efeito colateral |
| Abrir chamando POST /conversations | Tira da fila e reabre encerrada em nome de quem clicou, sobe a conversa na lista, exige socket e consulta o WhatsApp a cada clique (conversation.service.ts:1583-1619) |
| Stronizap dentro de iframe no Stronilead | A sessão mora no localStorage do Stronizap, que o navegador separa num iframe de outro site, e o cookie de renovação é SameSite=Strict (backend/src/routes/auth.routes.ts:51). Abriria deslogado. A spec já deixava o painel embutido fora do escopo (:314). Os cabeçalhos de frame não são o motivo: no modelo do nginx do repositório, o index.html sai sem X-Frame-Options e sem frame-ancestors (whatsapp-stronix.conf:53 contra :89-93) |
| wa.me, o botão de hoje (src/lib/guardian.js:79-84) | Abre o WhatsApp, não o Stronizap, e põe o telefone no endereço |
| Gravar o id do lead no contato ou na conversa do Stronizap | Precisa de varredura para preencher e fica velho quando o telefone ou o responsável muda no CRM, que é o dono da identidade. Pode vir depois como atalho |
| Ficha assinada ou código de uso único no Firestore | Amarra quem clicou e expira, mas grava a cada clique e pede outra ação autenticada por login. O id do lead já é aleatório e já circula no Stronizap. Fica como opção se o dono quiser auditoria |
| Busca da lista ou GET /contacts?search com o telefone no navegador | Telefone no navegador, sem tolerância ao nono dígito, canal por canal |
| Devolver só a chave DDD + 8 dígitos | Não permite iniciar conversa quando ela nunca existiu |

---

## 5. Riscos e perguntas para o dono do produto

### Perguntas
1. Quem clica no botão? Professor não tem login no Stronilead hoje. O botão fica com consultor e gestor agora e passa para o professor quando ele virar usuário, no projeto professor e faltosos?
2. Em qual canal o professor fica no Stronizap: um canal próprio dos professores ou o da recepção? Na recepção, como ATENDENTE, ele vê a fila inteira, todos os contatos e qualquer conversa do canal pelo id.
3. O professor pode ler o histórico de uma conversa que o consultor está atendendo? Hoje pode, porque a regra é por canal. Restringir por carteira muda a regra para todo mundo.
4. O professor pode assumir uma conversa do consultor? Hoje qualquer pessoa com o canal pode.
5. Quando não há conversa, quem clicou pode iniciar uma? Em qual canal?
6. Com mais de uma conversa (recepção e financeiro, por exemplo), abrir a mais recente ou perguntar antes?
7. O botão substitui o WhatsApp ou fica ao lado, para a academia sem Stronizap? Entra também no card do Pipeline e na lista de Clientes?
8. O menor que fez 18 anos sem número próprio cai no responsável, pela regra atual de `contactOf`. Pode ficar assim?
9. Cada professor no Stronizap conta no limite de atendentes do plano. Tudo bem?
10. A sessão "Entrar como admin" do superadmin pode usar o link?

### Riscos
- Contato ainda LID (`jidSuffix` igual a "lid"): o telefone não casa, e iniciar a conversa cria um segundo contato ao lado (backend/src/services/message.service.ts:514-549).
- Canal aguardando QR ou reconectando: passa pela primeira checagem e falha na consulta do WhatsApp com 503 (whatsapp.service.ts:807).
- Instagram fica de fora: a busca é por telefone.
- DDD 55: mandar o número sempre com o 55 do país evita a borda do `startConversation`.
- O telefone passa a sair do Stronilead para o Stronizap. Ele tem de ficar fora do log e do Sentry nos dois lados.
- Brechas de acesso que pesam mais quando ids de conversa circulam. Estão fora do escopo e valem uma tarefa à parte:
  - transferir não confere o acesso ao canal de origem (conversations.routes.ts:353; conversation.service.ts:1026-1036 (local));
  - estrelar, reagir, editar e encaminhar mensagem conferem só a academia (conversations.routes.ts:536-596; backend/src/services/message-actions.service.ts:25-37).
- A política "Ver conversas de toda a equipe" diz uma coisa e faz outra.
  - A tela, o schema e o CLAUDE.md do Stronizap dizem que ainda é preciso assumir para responder (frontend/src/components/settings/AttendanceManager.tsx:52 (local); schema.prisma:41).
  - O código deixa responder sem assumir (sendBlock.ts:50-57; conversation.service.ts:1840).
  - Isso importa se o professor for ATENDENTE numa academia com a política ligada.
- CSP fora do app: a CSP do helmet só cobre o Express (backend/src/server.ts:37-60). A página do app não a recebe, embora o comentário a apresente como proteção contra XSS. Fora do escopo.
- Versão: o Stronizap local está 106 commits atrás de `origin/main`, e a produção não foi conferida.

---

## 6. Referências principais

### Stronizap (linhas de 7c81bbd, salvo "(local)")
- Rotas e partida: `frontend/src/App.tsx:26-36, :41-85, :84`; `frontend/src/main.tsx:46`
- Abrir conversa no navegador:
  - `frontend/src/lib/openNoticeConversation.ts:9-14, :37-76, :43-57, :69`
  - `frontend/src/stores/conversations.store.ts:169-181, :241-250, :612-643`
  - `frontend/src/stores/channels.store.ts:33-35`
  - `frontend/src/pages/ChatPage.tsx:70-79, :111-147`
- Login e sessão: `frontend/src/components/RequireAuth.tsx:9-11`; `frontend/src/pages/LoginPage.tsx:13-24, :53`; `frontend/src/stores/auth.store.ts:79-81, :191-198, :218-253`
- Trava da caixa: `frontend/src/lib/sendBlock.ts:50-92`
- Iniciar conversa: `backend/src/routes/conversations.routes.ts:182-204`; `backend/src/services/conversation.service.ts:1469-1645`
- Abrir por id: `backend/src/routes/conversations.routes.ts:206-221, :230-248`; `backend/src/services/conversation.service.ts:426-445, :549-588`
- Enviar e assumir: `backend/src/services/conversation.service.ts:727, :1811-1845`
- Quem vê o quê: `backend/src/lib/conversationScope.ts:35-71`; `backend/src/services/channel-access.service.ts:18-51`; `backend/src/lib/tenant-rules.ts:48-57`
- Modelo de dados: `backend/prisma/schema.prisma:39-43, :45-55, :355-361, :383, :454, :521-525`
- Cliente do CRM: `backend/src/services/crm.service.ts:12, :110-112, :357-434`; `backend/src/services/crm-conversation.service.ts:138-139`
- Link de volta: `frontend/src/types/crm.ts:256-273`
- Infra: `deploy/nginx/whatsapp-stronix.conf:53, :88-93`; `backend/src/routes/auth.routes.ts:51`

### Stronilead (49a978d)
- Ponte: `api/zap.js:218-229, :244-256, :366-384, :654-676`; `api/_zapCard.js:54-56`; `api/_zapPhone.js:1-27`; `api/_zapSchedule.js:182-202`
- Contato do menor e wa.me: `src/lib/guardian.js:49-67, :79-84`
- Estado da integração: `src/lib/zapIntegration.js:15-19`
- Onde o botão entra: `src/views/LeadProfileView.jsx:205-211, :1258`; `src/views/DailyGoalView.jsx:254, :500, :1655-1658`
- Professores: `src/lib/professores.js:1-31`; `firestore.rules:176-179`; `api/_zapLead.js:136`
- Regras do projeto: `CLAUDE.md:3, :45, :170`
- Desenho antigo da Parte B: `docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md:138-144, :227, :308, :314`
- Professor e faltosos: `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md` e o levantamento dela
