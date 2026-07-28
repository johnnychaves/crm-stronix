# Auditoria de leitura e paginação — 28/07/2026

status: ativo
base: commit `97ab4b9` (main, pós PR #161)
sintoma: 59 mil leituras / 24h, com piso de 1,5–4 mil por hora entre 0h e 6h,
quando nenhuma academia está aberta.

---

## Resposta curta

O sistema não lê de madrugada porque alguém está usando. Ele lê porque **as
telas ficam abertas** e o Firestore **recobra a assinatura inteira toda vez que a
conexão cai por mais de 30 minutos**. Um computador de recepção ligado a noite
toda paga a coleção inteira de novo a cada ciclo de sono/rede da máquina.

O flip do PR G cortou o tamanho da assinatura, mas não cortou a **frequência**.
E sobraram duas coleções que crescem para sempre ainda assinadas por inteiro.

---

## 1. O que descartei primeiro

Antes de acusar o cliente, verifiquei o servidor:

| Suspeita | Resultado |
|---|---|
| Cloud Functions agendadas | Não existem — sem pasta `functions/`, `firebase.json` só tem rules e indexes |
| Cron da Vercel | `vercel.json` só tem rewrites, nenhuma chave `crons` |
| GitHub Actions agendado | Só `ci.yml`, sem `schedule` |
| Webhook Asaas disparando em lote | Só reage a evento de pagamento, não a relógio |
| Timer de 60s reassinando listener | **Não** — os dois `setInterval` (`DailyGoalView.jsx:920`, `DashboardOperacionalView.jsx:415`) alimentam só o relógio de tela; `now` não entra na dependência de nenhum efeito de assinatura |
| Refresh de token de hora em hora | **Não** — o app usa `onAuthStateChanged`, não `onIdTokenChanged` |

**Nada roda no servidor à noite.** Por eliminação, as leituras de madrugada vêm
de sessão de navegador aberta.

---

## 2. Causa raiz das leituras noturnas

### O mecanismo

A documentação de preços do Firestore diz, literalmente:

> "If offline persistence is enabled and the listener is disconnected for more
> than 30 minutes (for example, if the user goes offline), you will be charged
> for documents and index entries read as if you had issued a brand-new query."

As duas condições estão satisfeitas no código:

1. **Persistência ligada** — `src/lib/firebase.js:39` usa
   `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.
2. **Listeners que nunca desligam** — são **16 assinaturas** vivas desde o login
   até fechar a aba, e **não existe nenhum teardown por visibilidade**. Varri o
   projeto inteiro: zero `visibilitychange`, zero pausa por ociosidade.

Uma máquina de recepção ligada a noite toda dorme, perde rede, acorda. Cada
ciclo maior que 30 minutos re-cobra as 16 assinaturas do zero. Repetido a noite
inteira.

### As 16 assinaturas e o que cada uma custa

Todas em `src/App.jsx:518-724` (mais tickets em `App.jsx:180`):

| Coleção | Filtro | Cresce sem limite? |
|---|---|---|
| `stronix_leads` | `lifecycleBucket == 'ativo'` | Não — cortado no PR G |
| `stronix_interactions` | `createdAt >= início do mês` | Dentro do mês; zera na virada |
| `stronix_contratos` | **nenhum** | **Sim — 1 doc por matrícula e por renovação, para sempre** |
| `stronix_users` | nenhum (só admin) | Não |
| 10 catálogos | nenhum | Não |
| config (doc único) | — | Não |
| `tickets` | `tenantId ==` | Não |

Nas telas, mais assinaturas de coleção inteira:

| Onde | Coleção | Filtro |
|---|---|---|
| `useTeamGoals.js:32` | `stronix_daily_goal_history` | **nenhum — cresce para sempre** |
| `DailyGoalTeamView.jsx:170` | `stronix_daily_goal_history` | **nenhum — cresce para sempre** |
| `DashboardOperacionalView.jsx:241` | `stronix_daily_goal_history` | só o meu |
| `DailyGoalView.jsx:949` | `stronix_daily_goal_history` | só o meu |

Um admin parado no dashboard Operacional mantém **duas** assinaturas
simultâneas na mesma coleção de histórico (a do time inteiro e a dele).

### A conta (MEDIDA em produção, 28/07/2026)

Contagens tiradas do banco de produção via agregação no servidor:

| Coleção assinada | Documentos |
|---|---|
| `stronix_leads` (só `ativo`) | 176 |
| `stronix_interactions` (mês corrente) | 398 |
| `stronix_contratos` | 50 |
| catálogos (os 10 somados) | 61 |
| `stronix_users` | 4 |
| config (doc único) | 1 |
| **Uma reassinatura completa** | **~695 leituras** |

No dashboard Operacional somam-se as duas assinaturas do histórico de metas
(55 da coleção inteira + ~14 do próprio consultor), indo a **~765**.

Uma **carga fria** de admin custa mais, porque a migração morta de funis entra
por cima: 354 leads sem filtro + 36 statuses + 10 funis = **~400 extras**,
totalizando **~1.095 por carga**.

Referência: a coleção de leads tem **354 documentos no total**, dos quais 176
ativos. O flip do PR G portanto corta pela metade, não mais que isso.

**Quantas reassinaturas explicam a madrugada:** 14.450 ÷ 695 ≈ **21 eventos**
entre 0h e 6h, ou seja ~3,5 por hora. Compatível com duas ou três máquinas
esquecidas ligadas, cada uma reconectando cerca de uma vez por hora.

### O que o gráfico de 24h prova

Pontos extraídos hora a hora do painel de métricas faturáveis. A soma da minha
leitura dá 59,3 mil contra os 59 mil declarados pelo painel, então a extração
confere e dá para calcular em cima dela.

**Leituras por hora (mil):**

| 13h | 14h | 15h | 16h | 17h | 18h | 19h | 20h | 21h | 22h | 23h | 0h |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,9 | 1,15 | 0,25 | 1,75 | 5,7 | **0,05** | 4,65 | 2,15 | 2,15 | 2,6 | 2,0 | 2,1 |

| 1h | 2h | 3h | 4h | 5h | 6h | 7h | 8h | 9h | 10h | 11h | 12h |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4,1 | 0,7 | 1,9 | 1,55 | 4,1 | 2,15 | 3,0 | 2,5 | 3,1 | 2,05 | 5,5 | 2,2 |

Três conclusões saem daí:

**1. As leituras da madrugada não vêm de mudança de dado.** De 0h às 6h são
**14,45 mil leituras, 24% do dia inteiro**. No mesmo período as gravações são
zero (o dia todo teve 247, nenhuma de madrugada). Listener só cobra quando um
documento muda. Sem gravação não houve mudança, e um listener ocioso deveria
custar zero. Custou 14 mil. Portanto não é mudança, é **re-query**.

**2. Não existe processo constante rodando.** Às 18h a leitura cai para ~50 numa
hora inteira, e às 15h para ~250. Cron, poller ou timer de fundo produziriam um
piso plano, e não há piso plano. Há uma gangorra entre quase zero e picos de 4 a
5,7 mil. Isso confirma no dado o que a seção 1 confirmou no código.

**3. O tamanho dos picos bate com o custo de um re-sync.** A oscilação é o
comportamento esperado: conexão viva e ociosa custa zero (é o que se vê às 18h);
conexão que cai por mais de 30 minutos e volta refaz a query inteira e cobra tudo
(é o que se vê às 17h, 19h, 1h, 5h e 11h). Dividindo as 14,45 mil da madrugada
por um re-sync de 1 a 2 mil, dá **8 a 10 eventos de reconexão entre 0h e 6h**,
cerca de 1,5 por hora. É o ritmo de uma ou duas máquinas dormindo e acordando.

**Proporção:** 59 mil leituras para 247 gravações são **239 leituras por
gravação**. Num CRM onde a operação é registrar contato, agendar aula e mover
card, esse número deveria estar em uma ou duas dezenas. A conta já passou da cota
gratuita de 50 mil leituras/dia. Hoje o excedente custa centavos; com dez
academias no mesmo padrão, não custa.

> **Falta confirmar em produção.** O gráfico é fortemente consistente com a
> hipótese e descarta processo agendado, mas não identifica *qual* máquina está
> reconectando. Teste definitivo na seção 6.

---

## 3. Paginação: o hook está certo, três telas não o usam

`usePagedLeads` está bem feito — cursor com `startAfter`, retry limitado só em
`permission-denied`, reset por `specKey`. O problema está nas **specs**.

Em `usePagedLeads.js:25`, o limite só é aplicado se a spec tiver um:

```js
if (spec?.limit) cs.push(limit(spec.limit));
```

E três specs **não têm limite nenhum**:

| Spec | Arquivo | O que carrega |
|---|---|---|
| `allLeadsQuerySpec()` | `leadQueries.js:44` | `{ wheres: [] }` — **a coleção inteira de leads**, todos os baldes |
| `clientsAllQuerySpec()` | `leadQueries.js:31` | todos os clientes |
| `consultantLeadsQuerySpec()` | `leadQueries.js:72` | todos os leads do consultor |

Sem `limit`, `hasMore` vira `false` (linha 72 do hook) — não há segunda página
porque **a primeira já trouxe tudo**. O hook chamado "paged" não pagina nessas
telas.

Onde isso aparece:

- **`SettingsView.jsx:55`** — abrir **Configurações** lê a coleção inteira de
  leads. Esta é a pior: é a tela que menos precisa disso, e o redesign de ontem
  (PR #161) montou a leitura no topo do componente.
- **`LeadsView.jsx:37`** — "Todos os leads", coleção inteira.
- **`ClientsView.jsx:101`** — todos os clientes.
- **`App.jsx:1020`** — carteira inteira do consultor.

E como o App renderiza por condicional (`{activeTab === 'settings' && <SettingsView/>}`,
`App.jsx:1297`), **sair da aba desmonta e voltar relê tudo de novo**. Não há
cache entre navegações.

O próprio código admite a dívida, em `leadQueries.js:41`:

> "A leitura desta tela só cai com a paginação real (server-side), que fica pro H"

**A PR H nunca foi feita.** O `docs/scale-migration.md` para em E/F/G.

---

## 4. Migração morta que custa uma varredura completa por carga

`App.jsx:776-895` — a migração idempotente de funis. Roda uma vez por carga de
página, para todo admin, e faz:

1. `getDocs` em funis
2. `getDocs` em statuses
3. **`getDocs` na coleção INTEIRA de leads, sem filtro** (`App.jsx:851`)
4. `getDocs` em statuses de novo
5. `getDocs` em funis de novo

É um backfill de uso único que **já rodou há meses**. Hoje ele relê tudo, todo
dia, só para concluir que não há nada a fazer — e passa por cima do flip do PR G
lendo os leads sem o filtro `lifecycleBucket`.

---

## 5. Achados menores

| # | Achado | Impacto |
|---|---|---|
| 5.1 | `StrictMode` ligado (`main.jsx:8`) dobra todo efeito em `npm run dev`, e o dev aponta para o Firestore de **produção** | Toda sessão de desenvolvimento dobra a leitura e entra no gráfico |
| 5.2 | `TransferLeadsTab.jsx:154` lê a coleção **inteira** de interações | Só em ação manual de admin, mas fica caro conforme cresce |
| 5.3 | Busca global dispara **5 queries de prefixo em paralelo**, ~20 docs cada (`globalSearch.js:94-128`) | Até ~100 leituras por busca; o debounce de 220ms segura, mas o custo por busca é alto |
| 5.4 | Assinatura de interações fixa a fronteira do mês no momento em que monta | Aba aberta na virada do mês mantém a janela velha até remontar |

---

## 6. Como confirmar em uma noite

Antes de mexer em qualquer código, um teste que custa zero e mata a dúvida:

1. Hoje à noite, **todo mundo fecha a aba do Stronilead** (fechar mesmo, não só
   bloquear a tela). Confirmar que nenhum computador da recepção ficou com o
   sistema aberto.
2. Amanhã de manhã, olhar o mesmo gráfico de "Métricas faturáveis" no console.

- Se o piso de madrugada **sumiu** → confirmado: são sessões abertas
  reconectando, e a correção é a seção 7.
- Se o piso **continuou** → a hipótese está errada e a origem é outra; nesse
  caso o próximo passo é abrir o Cloud Monitoring e quebrar a métrica
  `document_reads` por tipo, que separa o que vem de listener do que vem de
  query pontual.

Detalhe: o gráfico do Firebase **inclui o uso do próprio console** (está escrito
no topo do painel). Vale conferir se alguma aba do console do Firestore ficou
aberta na aba "Dados" também.

---

## 7. Correções, em ordem de retorno MEDIDO

> **A medição mudou esta ordem.** A primeira versão deste documento colocava
> filtrar `contratos` e o histórico de metas como prioridade 1, no argumento de
> que crescem para sempre. Com os números reais eles são 50 e 55 documentos:
> 15% de uma reassinatura, pouco hoje. Quem estava subestimado era a migração
> morta, que custa 400 leituras em TODA carga de admin.

| # | Correção | Economia medida | Estado |
|---|---|---|---|
| 1 | **Portão de atividade** | madrugada 14.450 → ~700, **−23% do dia** | ✅ feito e verificado |
| 2 | **Migração de funis vira "roda uma vez"** | −400 por carga de admin | ✅ feito |
| 3 | Configurações parar de ler todos os leads | −354 por visita | ⬜ |
| 4 | `limit` real em `allLeadsQuerySpec`/`clientsAllQuerySpec` (a PR H) | −354 e −178 por visita | ⬜ |
| 5 | Filtrar `contratos` e `daily_goal_history` por vigência/mês | −105 por reassinatura (2%) | ⬜ |
| 6 | Portão nos listeners de nível de tela | marginal hoje | ⬜ |

Fazendo 1 e 2, a projeção vai de **59,3 mil para ~40 mil leituras/dia (−33%)**, e
a razão leitura/gravação cai de 240 para ~162.

O item 5 é o único que **piora sozinho todo mês**: `contratos` ganha 1 doc por
matrícula e por renovação, `daily_goal_history` 1 por consultor por dia. Hoje
são pequenos; em doze meses não serão. Vale fazer antes de doer.

### Notas de implementação (itens 1 e 2)

- O portão **não desloga ninguém**. Suspende só as assinaturas, e a trava
  `hasLoadedOnceRef` garante que ele só age sobre sessão já carregada.
- Medido no navegador: religar dentro da janela do cache **não gera leitura**.
  Alt-tab de quem está trabalhando é de graça; a economia vem só da aba
  esquecida.
- A migração **não podia ser apagada**: `api/provision-tenant.js:21` depende
  dela para semear o funil "Comercial" e a etapa "Negociação" no 1º login do
  admin de uma academia nova. Virou marcador `funnelsSetupDoneAt` no doc de
  config, que já é assinado (custo zero de leitura) e cujas rules já permitem
  escrita de admin (sem publicar nada no console).

---

## Comparação com a auditoria de julho

A auditoria anterior (score 55/100) tratou do **tamanho** da leitura e entregou
E1/E2/G. Este levantamento mostra que sobrou o outro eixo: a **frequência**. O
flip fez a leitura parar de crescer com o número de leads, mas ela continua
crescendo com o **tempo de aba aberta** — e é isso que o gráfico de madrugada
está mostrando.
