# Endereço por tela, entrega 1

status: revisão
data: 2026-09-21

## Por que

Hoje o Stronilead troca de tela só na memória. O endereço fica parado em `stronilead.com.br/<academia>`, então:

- o voltar do navegador sai do sistema, porque não há histórico dentro dele;
- o F5 sempre volta para o Operacional;
- não dá para abrir uma tela ou uma ficha em outra aba;
- abrir uma ficha descarta a tela de onde a pessoa veio, e o Voltar da ficha remonta essa tela do zero.

O pedido do Johnny: cada tela com endereço próprio, várias abas ao mesmo tempo, voltar e avançar sem zerar.

## O que a entrega 1 muda para quem usa

- Cada tela do menu e cada ficha têm endereço. F5 mantém a tela.
- Voltar e avançar do navegador andam entre as telas visitadas.
- Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam no menu, nos cards do Pipeline, nas listas de Leads, Clientes, Aulas e Visitas, na Meta diária, na busca, no sino e no "Indicado por".
- A ficha abre direto pelo link, de lead ativo, cliente, perdido ou vencido. Link errado ou lead excluído mostra "Ficha não encontrada".
- Depois do login a pessoa cai no endereço que tentou abrir, inclusive uma ficha.
- O título de cada aba diz a tela: "Meta diária · STRONIX · STRONILEAD".
- Abrir uma segunda aba deixa de deslogar a primeira.
- A configuração de funis deixa de criar funis em dobro quando duas abas abrem juntas.

## Fora da entrega 1

Ficam para a entrega 2, com spec própria:

- filtros, mês, comparativo e pessoa escolhida no endereço;
- seções de Configurações, visão Equipe da Meta e abas internas da ficha no endereço;
- a lista continuar igual ao voltar da ficha (filtros, "carregar mais", rolagem).

Ficam para depois, sem data:

- endereços no Console do super-admin;
- voltar do navegador fechando janelas (cadastro, ajuda, suporte, modais da ficha, sino, menu da conta);
- limpeza da etapa "Negociação" que existe dentro do funil Vencidos da STRONIX (achada na conferência de 21/09).

## Decisões do Johnny

1. Duas entregas, nesta ordem: endereços primeiro, lista preservada depois.
2. Endereços com o slug da academia no começo, nomes em português (tabela abaixo).
3. O Voltar da ficha faz o mesmo que o voltar do navegador. Ficha aberta direto numa aba nova volta para Clientes (cliente) ou Pipeline (lead).
4. Consultor que abre endereço de gestor vê o aviso "Essa tela é só do gestor." e cai no Operacional.
5. React Router 7 como peça de rotas, trocando aos poucos.
6. Depois do login, volta ao endereço tentado. Ao sair, tela de login da academia.
7. Com "Manter conectado" desmarcado, cada aba nova pede login.
8. Console do super-admin sem endereços nesta entrega. Voltar do navegador não fecha janelas nesta entrega.
9. Título da aba na ficha: só "Ficha", sem o nome do lead, porque o título fica no histórico do navegador da recepção.
10. Nome, telefone, CPF e texto de busca nunca vão para o endereço.
11. A setinha do canto do card do Pipeline abre a ficha em OUTRA GUIA no clique simples (decisão de 22/09/2026, depois do teste do PR 2). O clique no corpo do card continua abrindo na mesma guia. Ctrl+clique ou botão do meio na setinha abre a guia em segundo plano, e é assim que se dispara vários cards sem sair do Pipeline: nenhum site consegue forçar segundo plano num clique comum. Duas consequências, aceitas junto com a decisão:
    - **Sem "Manter conectado", a guia nova cai no login.** É a decisão 7 aparecendo aqui. Quem entra com a caixa desmarcada tem a sessão gravada no `sessionStorage` do navegador (`persistenceKind` devolve `session`), e guia nova nasce com esse armazenamento vazio, tanto faz o `rel="noopener"`, porque quem zera é o `target="_blank"`. Medido em Chrome: aba aberta por link não herda nada. Fica assim de propósito: quem pediu para não ficar conectado está pedindo exatamente isso. Com "Manter conectado" marcado, que é o caso do time, a guia nova abre a ficha direto.
    - **No toque a setinha não aparece.** Abrir vários cards é uso de mouse. No celular e no tablet um toque na setinha levaria para fora do app, com o app carregando do zero na guia nova e sem o Voltar. Ali o toque no corpo do card já abre a ficha na mesma tela, então nada se perde.

## Endereços

| Tela | Endereço | Quem vê |
|---|---|---|
| Tela inicial (Operacional) | `/<academia>` | todos |
| Operacional | `/<academia>/visao-geral/operacional` (aceito se digitado; o menu aponta para `/<academia>`) | todos |
| CRM | `/<academia>/visao-geral/crm` | todos |
| Gerencial | `/<academia>/visao-geral/gerencial` | todos |
| Pipeline | `/<academia>/pipeline` | todos |
| Clientes | `/<academia>/clientes` | todos |
| Meta diária | `/<academia>/meta-diaria` | todos |
| Todos os leads | `/<academia>/leads` | todos |
| Aulas | `/<academia>/leads/aulas` | todos |
| Visitas | `/<academia>/leads/visitas` | todos |
| Configurações | `/<academia>/configuracoes` | gestor |
| Perfil da academia | `/<academia>/perfil-da-academia` | gestor |
| Plano e faturas | `/<academia>/plano-e-faturas` | gestor |
| Ficha | `/<academia>/ficha/<id do lead>` | todos |
| Super-admin (membro de academia) | `/<academia>/super-admin/visao-geral`, `/clientes`, `/financeiro`, `/planos` | super-admin |
| Console (super-admin puro) | `/` | super-admin |

Continuam fora do roteador, decididas uma vez no `App()`: `/i/<slug>?ref=` (indicação pública) e `/?invite=&t=` (convite). Os nomes `invite`, `t` e `ref` ficam proibidos para parâmetros futuros.

Telas-folha (pipeline, clientes, meta-diaria, configuracoes, perfil-da-academia, plano-e-faturas, ficha/<id>) aceitam segmentos a mais e os ignoram. É o espaço da entrega 2 (`/configuracoes/equipe`, `/ficha/<id>/contratos`). Nos grupos (visao-geral, leads, super-admin), o segundo segmento escolhe a tela, e um filho desconhecido conta como endereço desconhecido.

## Como funciona por dentro

### A peça de rotas

- `react-router` fixado em `~7.18.4`. A 8 exige React 19.2.7.
- `<BrowserRouter useTransitions={false}>` em `src/main.jsx`, envolvendo o `<App/>`. A troca de tela continua síncrona, como o `setActiveTab` de hoje. Conferir que a prop existe na 7.18.4; se não existir, seguir com o padrão e registrar.
- Sem `<Routes>`. O `AppInner` lê `useLocation()` e deriva tudo no render. Isso evita remontar o `AppInner` (que guarda o login e as 15 assinaturas) quando o endereço é corrigido de `/` para `/<academia>`.
- `activeTab`, `resolvedTab`, `profileLeadId` e `superTab` continuam com esses nomes, mas viram valores calculados a partir do endereço. As cerca de 60 leituras e as views não mudam.
- `changeTab`, `openProfile` e os itens do menu passam a navegar.
- Nada de "ler a URL num effect e dar setState": o lint react-hooks v7 reprova e isso repete o defeito do `initialTab` das Configurações.

### `src/lib/routes.js` (novo, puro)

Um módulo só, sem React, sem Firebase, testável em node. Ele concentra o que hoje as seis frentes do desenho propuseram em quatro arquivos:

- `SCREENS`: id da tela (os mesmos valores de `activeTab`) para segmento, título e trava (`gestor`, `superAdmin`).
- `parseAppPath(pathname)` → `{ pathname, tenantSlug, screen, leadId, superTab, rest, unknown }`. Decodifica segmento por segmento. Segmento malformado invalida só a si mesmo.
- `hrefFor(tenantId, screen, { leadId, superTab })`. Aceita qualquer `tenantId` não vazio, com `encodeURIComponent`, para o link nunca sair quebrado; academia com id fora do formato de leitura fica sempre no Operacional, porque o endereço não relê o id (hoje nenhuma está nesse caso, e a validação do provisionamento impede criar outra). `hrefFor(t, 'dashOperacional')` devolve `/<t>`.
- `isValidLeadId(id)`: a regra do Firestore com teto de 128 caracteres. Rejeita vazio, `/`, `.`, `..`, `__x__` e caractere de controle. É o único validador de id do app.
- `routeDecision(route, appUser, { search, returnTo })` → `{ kind: 'ok' }` ou `{ kind: 'redirect', to, target, notice }`.
- `canGoBackInApp(historyState)`: `idx` inteiro maior que zero.
- `backTarget({ historyState, isClient, tenantId })`: `{ type: 'back' }` ou `{ type: 'replace', href }` com o endereço de reserva.
- `screenKey(route)`, `documentTitle({ screen, tenantName })`, `routeTemplate(pathname)` e `scrollActionFor(...)`.

### `src/lib/tenantSlug.js` (novo, puro)

- `TENANT_SLUG_READ_RE = /^[a-z0-9][a-z0-9-]{0,63}$/` (leitura, igual à de hoje) e `TENANT_SLUG_CREATE_RE` (criação, 3 a 40 caracteres).
- `RESERVED_TENANT_SLUGS`: `api`, `assets`, os segmentos de primeiro nível das telas, `ficha`, `super-admin`, `console`, `i` e as palavras de precaução do desenho.
- `isReservedTenantSlug(s)` e `tenantSlugProblem(s)`.
- Usado por `api/provision-tenant.js` (autoridade), pelo formulário do Console, por `scripts/register-tenant.js`, pelo `parseAppPath` e pelo `api/tenant-resolve.js` (palavra reservada responde `found: false` sem ler o banco).
- Um teste garante que todo segmento de primeiro nível de `SCREENS` está reservado. Tela nova sem reserva quebra o CI.

### A decisão de rota, uma por render

A cada render do app logado, `routeDecision` avalia nesta ordem e para na primeira que se aplica:

1. **Super-admin puro:** endereço diferente de `/` vai para `/`, sem aviso.
2. **Sessão assumida ("Acessar como"):** primeiro segmento diferente da academia assumida vai para `/<assumida>`, sem aviso. Resolve a tela em branco depois do "Acessar como".
3. **Volta da visualização:** vai para o `returnPath` guardado na entrada, quando ele é da academia da sessão.
4. **Slug do endereço diferente da academia da sessão**, sem aviso:
   - mesma academia com outra caixa: mantém o resto;
   - primeiro segmento é palavra de tela (`/pipeline`): vira `/<academia>/pipeline`;
   - raiz `/`: vira `/<academia>`, mantendo a query;
   - outra academia: mantém a tela de primeiro nível e descarta ficha e super-admin.
5. **Trava de acesso:** Configurações, Perfil da academia e Plano e faturas exigem gestor, com o aviso "Essa tela é só do gestor." e ida para `/<academia>`. Super-admin exige `appUser.superAdmin`, sem aviso.
6. **Endereço desconhecido dentro da academia:** aviso "Não achamos essa tela. Abrimos o Operacional." e ida para `/<academia>`.

A tela de destino já é desenhada no mesmo render (`shown = decision.target`), então a tela proibida nunca pisca. Um `<RouteRedirect key={location.key} to notice/>` troca o endereço com `replace` num effect e mostra o aviso. O toast e o navigate não são setState do componente, e o lint aceita (conferido no validador do plugin 7.0.1). No dev o StrictMode mostra o aviso duas vezes; uma trava por ref no effect resolve se incomodar.

Se o id da academia do claim não relê como a academia do endereço, a decisão devolve `ok` a partir da regra 2, para não entrar em laço. Hoje as cinco academias estão no formato. Quando a regra 4 corrige a academia e o endereço corrigido cai numa tela de gestor ou num endereço desconhecido, o aviso sai no mesmo redirect: o destino de todo redirect é aceito de primeira. A volta da visualização (regra 3) só vale na entrada do histórico em que ela foi pedida e enquanto o endereço ainda é da academia que estava assumida.

O `replaceState` cru de `App.jsx:263-273` sai. Ele apagava o resto do caminho e o `history.state` do roteador.

### Login e saída

- A tela de login e o "Carregando sessão" aparecem em qualquer endereço e não mexem nele. Nenhuma decisão de rota roda antes do `appUser`. Por isso a pessoa cai no endereço tentado depois de entrar.
- As telas de academia bloqueada também preservam o endereço, que vale depois do pagamento.
- **Sair:** `await signOut(auth)`, remover `IMPERSONATION_KEY` do sessionStorage e `window.location.replace(destino)`. O destino é `/<academia>` para membro e `/` para super-admin puro ou sessão assumida. A recarga zera ficha, listas em memória, o `appId` do módulo e as migrações. É isso que protege o computador compartilhado da recepção.
- **"Acessar como"** grava também `returnPath: window.location.pathname` no objeto da `IMPERSONATION_KEY`.
- O `/api/tenant-resolve` só é chamado quando a tela de login vai aparecer. Com sessão, o nome da academia vem do doc `tenants/{id}`, que o login já lê. Isso tira uma chamada da cota de 60 por IP a cada 5 minutos em todo F5.

### A ficha

- Vira um componente de rota, `src/views/LeadProfileRoute.jsx`, com `key` pelo id do endereço. Ele só existe dentro do app logado, então nada da ficha sobrevive ao logout.
- `useProfileLead({ db, leadId, sessionKey, active })` → `{ status, lead, retry }`, com status `invalid`, `waiting`, `loading`, `ready`, `missing`, `deleted` ou `error`. A `sessionKey` sai só do `appUser` (`${tenantId}:${authUid || id}`), nunca do `firebaseUser`, porque este muda antes do `appId`. O "Tentar de novo" incrementa uma tentativa. Sai o `setLoading(true)` síncrono com eslint-disable.
- `active = listenersActive`: a ficha e a linha do tempo (`useLeadTimeline`) obedecem ao portão de ociosidade de 15 minutos e mantêm o último estado. Uma ficha esquecida numa aba deixa de ficar assinada a noite toda.
- A leitura do documento começa na hora, mas a ficha só aparece pronta depois dos catálogos e dos contratos da academia (`ready`, `!loadingData` e os contratos já chegados), com um `ProfileSkeleton` no lugar. Assim ela não mostra cliente sem contrato nem etapa sem cor enquanto os catálogos chegam. "Não encontrada" e erro aparecem sem esperar. Sem internet, doc ausente que só o cache respondeu mostra o erro, e não "Não encontrada".
- Painéis, com `Button` do shadcn e tokens semânticos:
  - `missing` e `invalid`: "Ficha não encontrada", "Essa pessoa pode ter sido excluída, ou o link é de outra academia.", botão "Ir para o início".
  - `deleted`: "Essa ficha foi excluída", "Alguém da equipe excluiu esse cadastro enquanto ele estava aberto.", botões "Voltar" e "Ir para o início".
  - `error`: "Não deu para abrir a ficha", "Pode ser a internet. Tente de novo em alguns segundos.", botões "Tentar de novo" e "Ir para o início".
  - Durante a exclusão pela própria ficha: "Excluindo a ficha…". A `LeadProfileView` ganha `onDeleteStart` e `onDeleteFailed`.
- **Voltar:** lê `window.history.state` no clique. Com `idx > 0`, `navigate(-1)`. Sem isso, `replace` para `/<academia>/clientes` se `isClientLead(lead)`, senão `/<academia>/pipeline`. `location.key === 'default'` não serve, porque o replace da correção de slug troca a key e mantém o idx.
- **Abrir outra ficha** (indicado para indicador) empilha. Clicar de novo na mesma ficha não empilha.
- **Tela de origem:** quem abre a ficha passa `state: { from: <tela atual> }` (só o id da tela). Com ficha aberta, `activeTab = from ?? 'ficha'`, então o menu continua aceso e o título do cabeçalho continua o da origem. Aberta direto numa aba nova, o cabeçalho diz "Ficha".
- "Ver ficha" do cadastro de lead navega direto. Saem `justCreatedLeadId` e o effect que esperava o lead aparecer na lista de ativos.

### Links

- `src/components/nav/AppLink.jsx`: por cima do `<Link>` do React Router, que só intercepta o clique esquerdo sem modificador. `onNavigate` roda só quando o clique vira navegação nesta aba (fechar sino, busca e menu do celular).
- `LeadLink`: lê do `LeadProfileContext` o `leadHref` e o `from`, e passa `state={{ from }}`. Id inválido vira `<span>`.
- O `LeadProfileContext` ganha `leadHref` e `from`. Não se cria contexto novo, porque o arquivo atual já tem a exceção do react-refresh.
- O `AppInner` monta os seus links direto com `hrefFor(appUser.tenantId, ...)`. Hook que lê contexto não enxerga o Provider do próprio componente.
- **Menu:** `SidebarItem` e `SidebarSubItem` com `href` viram `AppLink` com `aria-current="page"`. Sem `href` continuam botão (Suporte). Os acordeões continuam botão.
- **PersonaMenu:** Perfil da academia e Plano e faturas com `DropdownMenuItem asChild` mais `AppLink`.
- **Menu do celular:** `isMobileMenuOpen = drawerKey === location.key`. Abrir grava a key atual. O `onNavigate` dos itens zera. Assim o voltar do navegador fecha o menu e não o reabre.
- **Card do Pipeline:** são DOIS links com o mesmo destino, um em volta do bloco de cima e outro no nome do consultor do rodapé, os dois com `draggable={false}` (implementado assim em 22/09; um link só exigiria tirar as ações do fluxo com `position: absolute`, o que mudaria a altura do card no hover). O do rodapé leva `tabIndex={-1}`, para o Tab parar uma vez por card, e um `aria-label` que começa pelo nome do consultor e termina no destino. Mover e a setinha ficam fora do link. O `article` perde o `onClick` e continua sendo o que se arrasta. Os tooltips do card (motivo da perda, chips, consultor) continuam funcionando porque estão DENTRO dos links, com uma exceção: id que não serve para endereço vira `<span>` e leva o `title` junto, porque o ramo sem href do `LeadLink` só repassa `className` e os filhos. Dois pedaços do rodapé deixaram de abrir a ficha, de propósito: o avatar de iniciais do consultor e o número da direita, que é onde ficam as ações (o número já sumia no hover). A setinha do rodapé vira um link com `target="_blank"` e `rel="noopener"` (decisão 11), com o rótulo dizendo que abre em outra guia, e `pointer-coarse:hidden` para sumir no toque. As ações do rodapé passam a aparecer com `group-has-[:focus-visible]:` no lugar de `group-focus-within:`: depois de um clique de mouse o foco fica no link, e com `focus-within` o card ficava travado mostrando as ações e escondendo o valor até a pessoa clicar em outro lugar.
- **TaskCard e DoneCard da Meta:** o nome vira link esticado (`after:absolute after:inset-0`), o container perde o `onClick` e ganha `relative`, e os botões internos ganham `relative z-10`. Os dois links esticados também levam `draggable={false}`: a camada do `::after` é da âncora, então sem isso arrastar em qualquer ponto do cabeçalho viraria arrasto do endereço da ficha.
- **Listas** (Leads, Clientes, Aulas, Visitas), prévia de amanhã, listas da visão Equipe, aba Indicações e "Indicado por": `LeadLink` direto. No `ConsultantDayDetail`, `group-enabled:group-hover:` vira `group-hover:` no ramo com link. Três blocos viraram componente de módulo para o teste em node conseguir renderizá-los sem montar a tela inteira: `SearchResultRow` (busca), `TomorrowApptRow` (prévia de amanhã) e `NotificationRow` (sino, antes `Row`). `KanbanCard`, `TaskCard` e `DoneCard` passaram a ser exportados pelo mesmo motivo.
- **Busca global:** a escolha sai do `onMouseDown`. O mousedown só faz `preventDefault` com `button === 0`. O resultado vira `LeadLink` com `tabIndex={-1}` e `onNavigate` que fecha e limpa. Enter abre na mesma aba.
- **Sino:** "Passaram para você" e "Indicações que chegaram pelo link" viram link. As novidades continuam abrindo a Central de ajuda.
- Continuam botão: "Ir para o pipeline" do Gerencial (um teste exige `<button>` sem Router), "Configurar agora", Cadastrar lead, Suporte, Central de ajuda, Sair, Acessar como, Voltar e Excluir da ficha.
- O `openProfile` continua memoizado, agora porque ele entra no valor memoizado do `LeadProfileContext`: se mudasse a cada render, todo mundo que lê o contexto renderizaria de novo.

### Configurações

- Sai o `settingsTab` em estado.
- `SettingsView initialTab={location.state?.secao ?? 'users'}`. O menu, sem state, abre em Equipe e acessos.
- "Configurar agora" navega com `state: { secao: 'general' }` e abre em Metas e ritmo.
- O caso "Configurar agora com Configurações já aberta" continua sem efeito, igual a hoje. A entrega 2 resolve com a seção no endereço.

### Rolagem, erro e título

- `useRouteScroll(ref, screenKey(shown))` no container compartilhado (`App.jsx:1667`), com a mesma chave de tela da key do `AppErrorBoundary`, para o endereço barrado não dar uma resposta de cada lado. Ir para outra tela vai ao topo. Voltar ou avançar devolve a posição daquela entrada, tentando por até 1,5 s enquanto o conteúdo carrega ou até a pessoa rolar. Na mesma tela, não mexe. Containers internos (colunas da Meta, board do Pipeline) não são restaurados nesta entrega.
- `<AppErrorBoundary key={screenKey(shown)}>`: trocar de tela limpa a tela de erro.
- Título: `<Tela> · <Academia> · STRONILEAD`. Na ficha, `Ficha · <Academia> · STRONILEAD`. Antes do login, igual a hoje.

### Sentry

- Continua `Sentry.browserTracingIntegration()`, agora com `beforeStartSpan: (o) => ({ ...o, name: routeTemplate(o.name) })`. O `o.name` é o caminho da página no pageload e o de destino na navegação. `window.location.pathname` não serve, porque o SDK chama o gancho antes de o endereço trocar e daria a tela de antes. Os moldes usam `/:tenant/...` e `/:tenant/ficha/:leadId`, sem dado real, então ir no cabeçalho de amostragem não é problema. A integração específica do React Router não entra, porque exige `<Routes>`.
- Segunda camada em `src/lib/sentryScrub.js`, obrigatória porque o SDK grava o nome cru no escopo e em vários campos:
  - `scrubLeadPath` troca `/ficha/<id>` por `/ficha/:leadId`, sem distinguir maiúscula;
  - uma varredura final do evento inteiro (pulando `sdkProcessingMetadata`) no fim do `scrubEvent` e do `scrubBreadcrumb`;
  - `URL_KEYS` ganha `url.path` e `lcp.url`, e `lcp.element` e `cls.source.N` têm atributos redigidos;
  - novo `beforeSendSpan: scrubSpan` para a span do INP, que hoje pode levar o nome do cliente pelo `alt` do avatar. Ele nunca devolve `null` (o SDK mandaria a original).
- O `verificar:sentry` continua cobrindo o `api/`, que usa o mesmo `sentryScrub.js`.

### Várias abas

**Logout da primeira aba.** Conferido no `@firebase/auth` 1.12.2: o `getAuth` vigia o IndexedDB e o login com "Manter conectado" grava no localStorage. A aba nova move a sessão para o IndexedDB e apaga do localStorage, e a primeira aba lê o localStorage vazio e desloga. A correção:

- `src/lib/authPersistence.js` (puro): `persistenceKind({ remember, indexedDbOk })`.
- `persistenceFor(remember)` em `src/lib/firebase.js`: com "Manter conectado", `indexedDBLocalPersistence`, ou `browserLocalPersistence` se o IndexedDB não funcionar (o teste abre, grava e apaga um valor num banco próprio, como o SDK faz). Sem a opção, `browserSessionPersistence`.
- O `getAuth` não muda. Quem já está logado continua logado depois do deploy, porque o SDK procura a sessão nos três armazenamentos e migra.
- No "Sair da visualização", primeiro `signInWithCustomToken` e só depois `setPersistence`. Na ordem de hoje, a conta do cliente passaria pelo armazenamento que as outras abas vigiam.
- Efeito novo e esperado: uma aba parada no login entra sozinha quando outra aba loga.

**Funis em dobro.** As cinco configurações de funil do primeiro login de gestor (`App.jsx:878-1276`) passam a gravar com id fixo:

- `src/lib/funnelSetup.js` (puro): `DEFAULT_FUNNEL_ID = 'funil-padrao'`, `SYSTEM_FUNNEL_IDS` (`funil-sistema-indicacoes`, `-upgrade`, `-renovacoes`, `-vencidos`), `REFERRAL_SOURCE_ID`, `setupStageId(funnelId, stage)`, `toSetupWrites(plan, ts)`, `planDefaultFunnel(funnels)` e `planNegociacaoStages({ funnels, statuses })`.
- No lugar de `addDoc`, uma gravação que só cria: uma transação confere se o documento com aquele id já existe e só grava se não existir. A repetição cai no mesmo documento em qualquer combinação de abas, computadores e gestores, e a aba atrasada não sobrescreve nada, nem uma edição que o gestor tenha feito no meio. Custa algumas leituras uma vez na vida de cada academia. Sem internet a configuração falha sem carimbar e roda de novo na próxima carga. Não precisa de regra nova do Firestore.
- As leituras da configuração vêm sempre do servidor (`getDocsFromServer`), para não planejar em cima de cache velho.
- Cada execução congela a academia no início (`const tenant = appId`). Se a conta mudar no meio, a execução falha sem carimbar, em vez de gravar na academia errada.
- O passo que põe "Negociação" em todo funil passa a ignorar funis de sistema.
- Os planos atuais (`plan*SetupOps`) e os testes deles não mudam.
- Id publicado nunca muda. O `CLAUDE.md` registra isso.

### Custo de leitura

- Ficha e linha do tempo obedecem ao portão de ociosidade (acima).
- O pool de renovação e o contato de hoje esperarem o config da academia fica para uma tarefa separada, fora deste PR: a primeira tentativa abria uma janela em que a Meta podia gravar meta batida antes da hora. Hoje eles buscam duas vezes em academia com marcos próprios, a cada F5 e a cada aba nova.
- `/api/tenant-resolve` só na tela de login (acima).
- Antes do merge do PR 2, medir no preview as leituras de abrir 5 fichas em abas pela busca e pôr o número na PR.

### Consertos pequenos que o F5 frequente exige

- **Funil salvo.** Hoje o Pipeline volta ao funil padrão no F5 em toda academia que não é a STRONIX, porque a chave do localStorage é lida com o `appId` padrão. O conserto relê a chave no callback do login, logo depois do `setTenantId`.
- **Gesto de voltar do trackpad e do iPhone.** `overscroll-x-contain` no board do Pipeline e em todo rolador horizontal (tabelas, abas da ficha e dos cadastros), para o gesto não trocar de tela. O `FunnelTabs` não rola para o lado: o excedente vai para o menu "+N". Uma varredura nos testes cobra a classe de todo `overflow-x-auto`.

## Entrega em três PRs

1. **Várias abas sem susto.** Persistência do login e funis com id fixo. Não toca em tela.
2. **Endereços.** Peça de rotas, `routes.js`, `tenantSlug.js` e validação no provisionamento, decisão de rota, login e saída, ficha por endereço, menu e PersonaMenu como links, menu do celular, Configurações, rolagem, erro, título, Sentry, custo de leitura, consertos pequenos e documentação.
3. **Ctrl+clique em tudo que abre ficha.** Card do Pipeline, listas, Meta, visão Equipe, busca, sino, Indicações e "Indicado por". Entregue em 22/09/2026, com a setinha do card abrindo em outra guia (decisão 11) e uma varredura no CI cobrando que nenhuma tela volte a abrir ficha por `onClick`.

## Testes automáticos (node, sem jsdom)

- `routes.test.js` e `routes.decision.test.js`: cada endereço da tabela; ida e volta `hrefFor`/`parseAppPath` para todas as telas e para ids com espaço, acento e `%`; segmento malformado; filhos desconhecidos; `rest` da entrega 2; cada regra da decisão de rota por papel (consultor, gestor, super-admin membro, sessão assumida, super-admin puro), incluindo palavra reservada, raiz, outra academia, caixa, `returnPath` e ausência de laço; `canGoBackInApp`; `backTarget`; `documentTitle`; `routeTemplate`; `scrollActionFor`; textos sem travessão.
- Contrato do `idx`: com `UNSAFE_createBrowserHistory` e um `window` falso, provar que a carga grava `idx` 0, o push soma 1 e o replace mantém.
- `tenantSlug.test.js`: formato, reservadas e a guarda de que toda tela de primeiro nível está reservada.
- `authPersistence.test.js`: as três combinações.
- `funnelSetup.test.js`: ids congelados e válidos; `setupStageId`; `toSetupWrites`; `planDefaultFunnel` reproduzindo o critério de hoje; `planNegociacaoStages` pulando funis de sistema; e o teste de convergência de duas abas em todos os pontos de corrida, para os quatro funis de sistema e o padrão.
- `sentryScrub.test.js`: request.url, transaction, migalhas de navegação, `url.path`, span do documento, Referer, mensagem de erro, varredura final sem cortar stacktrace e com referência circular, `scrubSpan` do INP e LCP; o que não pode mudar (`/pipeline`, `/leads/aulas`, o slug).
- `sentryInit.test.js`: fiação dos ganchos (`beforeSend`, `beforeSendTransaction`, `beforeSendSpan`, `beforeBreadcrumb`, `beforeStartSpan`).
- Estados puros da ficha: `nextProfileSnap`, `profileStatusFor`, `resolveFichaView`.
- `appLink.test.js` com `renderToString` sob `MemoryRouter`: href certo, `LeadLink` com id inválido vira `<span>` e `LeadLink` leva o state. `menuLinks.test.js`: `SidebarItem` com `href` é `<a aria-current="page">` e sem `href` é `<button>`.
- `npm run lint` sem eslint-disable novo. Saem três (o do `useProfileLead`, o do `justCreatedLeadId` e o do effect que forçava a tela do super-admin).

## Conferência manual no preview da Vercel

Nunca com o dev local apontado para a produção.

**PR 1**
- Entrar com "Manter conectado", abrir a segunda aba, voltar à primeira: continua logada.
- Sem "Manter conectado": a aba nova pede login e a primeira continua logada.
- Sair numa aba: a outra cai no login.
- Navegador logado antes do deploy continua logado depois do F5.
- Academia de teste: apagar a flag do Upgrade e o funil, abrir três abas juntas: sobra um funil `funil-sistema-upgrade` com uma entrada.

**PR 2**
- F5 em cada endereço da tabela mantém a tela.
- Voltar e avançar entre Pipeline, Clientes e Meta.
- Menu com Ctrl+clique, botão do meio e botão direito abre outra aba no endereço certo.
- Deslogado, abrir uma ficha pelo link: login com a marca da academia e depois a ficha.
- Consultor em `/configuracoes`: aviso e Operacional, sem piscar Configurações.
- `/<academia>/xyz` e ficha com id ruim: aviso ou painel certo.
- Sair: login da academia. Entrar com outra conta não mostra nada da anterior.
- "Acessar como" pelos dois caminhos abre o Operacional da academia assumida. "Sair da visualização" volta ao lugar de antes.
- Celular: tocar no item ativo fecha o menu. Voltar com o menu aberto fecha o menu.
- Mac: rolar o Pipeline até a borda e insistir não troca de tela.
- Erro de teste no console com a ficha aberta: o envelope do Sentry não tem o id do lead.
- Rolar o Operacional, abrir ficha pela busca e voltar devolve a rolagem.

**PR 3**
- Pipeline no Chrome, Safari e Firefox: arrastar pelo nome e pelo corpo move sem abrir a ficha; clique abre; Ctrl+clique abre outra aba; Mover não navega; tooltips aparecem.
- Pipeline no iPad e no Android: segurar o card para arrastar não abre o menu de link.
- Busca: Ctrl+clique abre várias fichas e a lista continua aberta.
- Sino: clique simples fecha, Ctrl+clique mantém aberto.
- Meta: botões do card (WhatsApp, Ligar, Adiar, desfechos, Remarcar) não abrem a ficha.
- Abrir ficha pela lista, pelo card e pela Meta e voltar com um clique só.

## Riscos conhecidos

- O Voltar depende de `history.state.idx`, que é detalhe interno do React Router. O teste do contrato trava isso na versão instalada. Se falhar, o Voltar cai na lista de reserva e nunca sai do app.
- Qualquer `history.replaceState` cru apaga o `idx`. Todo replace passa pelo `navigate`.
- Voltar do navegador com modal aberto dentro de uma tela ou da ficha desmonta a tela e perde o que foi digitado. Antes o voltar saía do app inteiro, então não piora, mas passa a acontecer dentro do app.
- Depois de uma troca de conta, entradas antigas do histórico são reescritas para a academia atual quando o voltar chega nelas.
- Todo push e todo replace com endereço, inclusive o do aviso de rota, vira transação de navegação no Sentry. O nome sai do destino (`options.name`), porque o SDK chama o gancho antes de o endereço trocar.
- Cada troca de tela vira transação de navegação amostrada a 10%. Olhar a cota depois de uns dias.
- "Acessar como" continua derrubando as outras abas do super-admin, e Ctrl+clique durante a visualização abre o login. Nada disso muda nesta entrega.

## Documentação a atualizar

- `CLAUDE.md` do Stronilead: seção de endereços (tabela em `src/lib/routes.js`, URL como fonte da verdade, `activeTab` derivado, nada de dado pessoal no endereço, `invite`/`t`/`ref` reservados, todo replace pelo `navigate`, regra do Voltar pelo `idx`), nota do Sentry (`/ficha/:leadId`, `beforeSendSpan`) e nota dos funis com id fixo.
- `README.md:11`: tirar o "sem react-router".
- `CLAUDE.md` raiz e de `06-sistemas/`: linha na tabela de atualizações quando cada PR entrar.

## Conferência feita na produção (21/09/2026, só leitura)

- Academias: `academia-power-club`, `academia-shape-one`, `academia-teste`, `petros-barbell-club`, `stronix-crm-app`. Todas no formato, nenhuma reservada.
- Funis, etapas e origens duplicados: nenhum.
- Achado à parte: a STRONIX tem "Negociação" dentro do funil de sistema Vencidos. Fica fora desta entrega.
