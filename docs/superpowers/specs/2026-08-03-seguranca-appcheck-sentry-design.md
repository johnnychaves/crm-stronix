# Segurança — App Check no login e Sentry no sistema

status: revisão
data: 2026-08-03

## Problema

O sistema tem três brechas de naturezas diferentes, todas abertas hoje.

**1. O login não passa pelo nosso servidor.**
`LoginScreen.jsx` chama `signInWithEmailAndPassword` direto do navegador contra
a API de identidade do Google. Não existe endpoint de login em `api/`. A
`apiKey` do Firebase Web está no bundle, e isso é correto por design, ela não é
segredo. A consequência é que qualquer script pode tentar senha contra a API do
Google sem nunca carregar a nossa tela. O Firebase tem um freio nativo por IP,
mas ele cede diante de IPs rotativos.

Isso invalida a solução intuitiva. Um widget de CAPTCHA colado no formulário
protegeria apenas quem passa pelo formulário, e o atacante não passa. Widget
sozinho, neste desenho, é enfeite.

**2. O Firestore não distingue o app de um script.**
As rules isolam por `tenantId` e fazem isso corretamente. Mas uma vez de posse
de um token válido, um cliente qualquer conversa com o Firestore direto. As
rules respondem a "quem é você", nunca a "de onde você está falando".

**3. Erro em produção é invisível.**
Não existe Sentry, não existe ErrorBoundary, não existe nenhuma captura. Um
componente que quebra derruba a árvore React inteira e entrega tela branca. Hoje
a descoberta de um bug depende de uma academia ligar reclamando.

## Decisão

Duas frentes, dois PRs independentes, ambas desligáveis por variável de
ambiente.

**PR 1 — Sentry.** Visibilidade de erro no front e nas funções serverless, com
ErrorBoundary de verdade no lugar da tela branca.

**PR 2 — Firebase App Check em modo monitoramento.** Atestação que carimba toda
requisição ao Firebase provando que ela nasceu no app legítimo. Cobre o Auth e o
Firestore de uma vez, inclusive a chamada direta à API de login, que é
exatamente o furo que o widget não fecharia.

### Por que App Check e não Cloudflare Turnstile

A Turnstile foi o pedido original. Ela é boa e é grátis, mas ela só entrega
proteção real neste sistema se for ligada como *provider customizado* do App
Check, o que exige um endpoint novo em `api/` para validar o token da Turnstile
e emitir o token do App Check.

Dois impedimentos: estamos em **12/12 funções** no plano Hobby da Vercel, então
seria preciso consolidar duas funções antes; e o endpoint viraria dependência
crítica do login, ou seja, se ele cair ninguém entra no sistema.

O App Check com reCAPTCHA Enterprise entrega o mesmo resultado de segurança sem
função nova e sem ponto de falha novo. A porta para a Turnstile fica aberta: a
troca de provider é localizada em `src/lib/appCheck.js` e pode acontecer depois,
junto com a consolidação das funções.

## Princípios

Três regras que valem para os dois PRs.

**Nada liga sem variável de ambiente.** Sem `VITE_SENTRY_DSN` o Sentry não
inicializa. Sem `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` o App Check não inicializa
e o app sobe idêntico ao de hoje. Isso é o botão de desligar, sem precisar de
deploy.

**O App Check sobe sem bloquear.** O código vai para produção em modo
monitoramento. O Firebase registra a métrica de verificado contra não
verificado, e não recusa nada. Ligar o bloqueio é decisão de console, tomada com
os números na mão.

**Dado de lead não sai do sistema.** Nome, CPF, telefone e e-mail de lead nunca
chegam ao Sentry.

---

## PR 1 — Sentry

### Front

| Arquivo | Mudança |
|---|---|
| `src/lib/sentry.js` | **Novo.** Init, gating por env, `beforeSend` de limpeza, filtro de ruído |
| `src/main.jsx` | Importa o Sentry antes de tudo; liga `Sentry.reactErrorHandler` nos três callbacks do React 19 (`onUncaughtError`, `onCaughtError`, `onRecoverableError`) |
| `src/components/ErrorBoundary.jsx` | **Novo.** Tela de erro na identidade do app, com botão de recarregar e o código do evento |
| `src/App.jsx` | Marca contexto do usuário no `onAuthStateChanged` (linha 325) e limpa no logout |
| `vite.config.js` | Envio de source map no build, com pulo silencioso quando falta o token; expõe o SHA do commit da Vercel ao bundle para servir de `release` |

O ErrorBoundary envolve a árvore dentro do `App`, não o `App` inteiro, para que
uma quebra numa view não leve junto o shell de navegação.

### Backend

Um helper `api/_sentry.js` exportando `withSentry(handler)`, aplicado às 12
funções. Nome com underscore não é publicado como função pela Vercel, então o
teto de 12 permanece intacto.

Detalhe que decide se isso funciona ou não: a função serverless congela assim
que responde. Sem um `flush` explícito antes do return, o evento morre no
buffer. O wrapper faz o flush com timeout curto para não segurar a resposta.

### Configuração

| Parâmetro | Valor | Motivo |
|---|---|---|
| Erros | 100% | Volume baixo, todo erro interessa |
| `tracesSampleRate` | 0.1 | Performance não é o objetivo; 10% já mostra tendência sem queimar cota |
| Session Replay | **Desligado** | Grava a tela, e a tela tem ficha de lead aberta |
| `sendDefaultPii` | `false` | Não anexa IP nem dados de usuário automaticamente |
| `release` | SHA do commit da Vercel | Permite saber qual deploy quebrou |
| `environment` | `production` / `preview` | Separa ruído de preview do que é real |

### Privacidade e LGPD

O `beforeSend` roda antes de qualquer envio e faz três coisas:

1. **Mascara padrões sensíveis** na mensagem e nos dados extras: CPF, telefone e
   e-mail viram marcadores.
2. **Descarta corpo de requisição** dos eventos de backend, que é onde dado de
   lead trafega.
3. **Filtra ruído** conhecido: erro de extensão de navegador, `ResizeObserver
   loop`, requisição abortada por navegação.

O contexto de usuário enviado é **apenas** `uid`, `tenantId` e `role`. Sem nome,
sem e-mail. `uid` e `tenantId` bastam para saber qual academia está sofrendo, e
o cruzamento com a pessoa acontece no nosso banco, não no Sentry.

Esse mascaramento é lógica pura e ganha teste unitário. É a peça que sustenta a
promessa de LGPD, então ela não pode quebrar sem alguém perceber.

### Variáveis novas

```
VITE_SENTRY_DSN=              # front (público por natureza)
VITE_SENTRY_ENVIRONMENT=      # production | preview
SENTRY_DSN=                   # backend, funções api/
SENTRY_AUTH_TOKEN=            # só no build, para subir source map
SENTRY_ORG=
SENTRY_PROJECT=
```

---

## PR 2 — App Check em monitoramento

### Código

| Arquivo | Mudança |
|---|---|
| `src/lib/appCheck.js` | **Novo.** `initializeAppCheck` com `ReCaptchaEnterpriseProvider`; token de debug no ambiente local |
| `src/lib/firebase.js` | Chama o App Check logo após `initializeApp`, **antes** de `getAuth` e do Firestore |
| `docs/APPCHECK_SETUP.md` | **Novo.** Roteiro dos passos de console |

**A ordem de inicialização é o ponto crítico.** Se o App Check subir depois do
Auth ou do Firestore, as primeiras requisições saem sem carimbo e entram na
métrica como não verificadas. Isso produziria um número falso justamente na
decisão de ligar o bloqueio, que é a decisão mais perigosa do projeto.

Ausência do site key derruba o App Check em silêncio e o app segue normal. Erro
na inicialização também não pode derrubar o boot.

O token de debug é obrigatório para o ambiente local. Sem ele, no dia em que o
bloqueio for ligado, o `npm run dev` para de conversar com o Firebase.

### Passos de console (manuais, feitos pelo Johnny)

1. Google Cloud, projeto `crm-stronix`: habilitar a API do reCAPTCHA Enterprise
2. Criar chave **baseada em score, para sites**, com os domínios de produção e
   preview
3. Firebase console, App Check: registrar o app web com essa chave
4. **Deixar o enforcement desligado**
5. Firebase Auth, Settings: ligar proteção contra enumeração de e-mail e
   política de senha mínima. Grátis, um clique, independentes do resto

### Rollout do bloqueio

```
deploy do PR 2  →  monitorar 3 a 7 dias  →  bloquear Firestore  →  observar  →  bloquear Auth
```

Cada degrau só avança com o painel do App Check mostrando praticamente 100% de
requisições verificadas. Fatia teimosa de não verificadas significa usuário real
falhando a atestação, e nesse caso paramos e investigamos em vez de bloquear.

Reversão em qualquer ponto: desligar o enforcement no console. Sem deploy.

---

## Testes

**PR 1**
- Unitário para o mascaramento do `beforeSend`: CPF, telefone e e-mail saem
  mascarados; evento de ruído conhecido é descartado; evento normal passa intacto
- Unitário para o gating: sem DSN, o init não faz nada
- Verificação ao vivo: disparar um erro proposital, confirmar que chega no Sentry
  com `tenantId` presente e **sem** dado de lead

**PR 2**
- Verificação ao vivo no painel do App Check: requisições aparecendo como
  verificadas em desktop e mobile
- O fluxo de impersonação do superadmin precisa entrar nessa checagem, porque ele
  troca de identidade em tempo de execução
- Confirmar que o `npm run dev` continua funcionando com o token de debug

A suíte atual tem 560 testes verdes e precisa continuar assim nos dois PRs.

## Riscos

**Aberto, precisa de confirmação no console:** o reCAPTCHA Enterprise é produto
do Google Cloud e provavelmente exige faturamento habilitado no projeto. Se o
`crm-stronix` estiver no plano Spark, pode pedir upgrade para Blaze. Não dá para
verificar isso a partir do código.

Saída sem custo, caso peça: o App Check também aceita o reCAPTCHA v3 comum, que
é grátis e não exige faturamento. A troca é de uma linha em `src/lib/appCheck.js`
e não altera mais nada do desenho.

**Bloqueio no Auth barrar usuário legítimo.** O enforcement do App Check sobre o
Firebase Auth ainda está marcado como *preview*. Contido por três camadas: o
código sobe sem bloquear, o bloqueio é decisão de console tomada com métrica na
mão, e desligar é um clique.

**Cota do Sentry.** Plano gratuito tem teto de eventos. Se um erro em laço
disparar milhares de eventos, a cota queima e o mês fica cego. Contido pelo
filtro de ruído e pelo `tracesSampleRate` em 10%.

## O que não entra

- **Turnstile como provider customizado.** Depende de consolidar funções da
  `api/` para caber no teto de 12. Fica para depois, e a troca é localizada.
- **Ligar o bloqueio do App Check.** Este trabalho entrega o código em
  monitoramento. Bloquear é decisão do Johnny, no console, com dados.
- **Restringir o que um consultor autenticado enxerga da própria academia.** Isso
  é desenho de permissão, assunto diferente, fora do pedido.
- **Session Replay do Sentry.** Descartado por decisão de privacidade, não por
  esforço.
