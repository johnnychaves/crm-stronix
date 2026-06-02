# STRONILEAD — CRM de leads para academias

SaaS multi-tenant de gestão de leads (do lead à matrícula): pipeline Kanban,
meta diária, agendamentos, ficha do lead com timeline e configurações por
academia. Identidade visual **STRONILEAD** (azul `#2B59FF` + laranja `#FF6A2B`,
Space Grotesk nos títulos, Geist no corpo).

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + lucide-react. Toda a UI vive
  em `src/App.jsx` (single-file, navegação por abas — **sem react-router**).
- **Backend:** funções **serverless da Vercel** em `api/` (Firebase Admin SDK).
- **Dados/Auth:** Firebase (Firestore + Authentication).
- **Deploy:** Vercel (auto-deploy no push para `main`). Regras do Firestore são
  publicadas **manualmente** no console do Firebase.

## Arquitetura multi-tenant (claim-based)

Cada academia é um **tenant** identificado por um `slug` (ex.: `ironfit`). O
isolamento é por **custom claim** no token do Firebase Auth — **não** por URL:

- Todo usuário tem o claim `tenantId` no token. O app resolve o tenant no login
  (`onAuthStateChanged`) e usa `appId = tenantId` no path dos dados:
  `artifacts/{tenantId}/public/data/{coleção}`.
- As **Firestore Rules** garantem o isolamento no banco: `inTenant(appId)` exige
  `request.auth.token.tenantId == appId`. Não há vazamento entre tenants mesmo
  com acesso direto ao Firestore.
- O **super-admin** (dono do STRONILEAD) tem o claim `superAdmin: true` e gerencia
  todas as academias pela tela "Organizações".

### Hierarquia de papéis

```
STRONILEAD (super-admin · claim superAdmin:true)
└── Tenant: Academia A  (slug: academia-a)
    ├── Admin: dono@academia-a.com   (claim tenantId=academia-a, role=admin)
    │   ├── Consultor: ana@academia-a.com    (role=consultant — vê só os próprios leads)
    │   └── Consultor: pedro@academia-a.com
└── Tenant: Academia B  (slug: academia-b)
    └── Admin: dono@academia-b.com
        └── Consultor: lucia@academia-b.com
```

- **Super-admin:** cria/suspende/reativa organizações; define plano e trial.
- **Admin (master):** gerencia consultores (cadastro direto ou convite), vê todos
  os leads do tenant, edita configurações (fases, fontes, tags, modalidades…).
- **Consultor:** vê e gerencia apenas os próprios leads do seu tenant.

## Estrutura de pastas

```
api/                      Funções serverless (Vercel) com Firebase Admin SDK
  _firebaseAdmin.js       Init do Admin + verifyRequest (verifica ID token)
  provision-tenant.js     [super-admin] POST cria tenant+admin+seed · GET lista
  tenant-status.js        [super-admin] POST suspende/reativa + revoga tokens
  invite-create.js        [admin] cria convite (/tenants/{id}/invites)
  invite-accept.js        [público] aceita convite → cria conta + claim
  admin-create-user.js    [admin] cadastra consultor com senha
  admin-set-password.js   [admin] redefine senha de um usuário
  admin-delete-user.js    [admin] remove usuário do tenant
scripts/                  Utilitários Admin (rodar fora do app)
  set-super-admin.js      Define claim superAdmin num usuário
  register-tenant.js      Registra um tenant legado na coleção `tenants`
  backfill-tenant-claims.js  Backfill de claim tenantId em usuários antigos
src/
  App.jsx                 Toda a UI (single-file)
  lib/                    firebase.js, leads.js, funnels.js, dates.js, constants.js, auth.js
firestore.rules           Regras de isolamento por tenant (publicar manual)
```

## Setup local

1. `npm install`
2. Copie `.env.example` → `.env.local` e preencha (ver seção de variáveis).
   O frontend funciona sem env (cai no projeto `crm-stronix`); a pasta `api/`
   precisa das credenciais Admin para rodar localmente (`vercel dev`).
3. `npm run dev` (Vite) — ou `vercel dev` para servir o front + as funções `api/`.

### Variáveis de ambiente (`.env.example`)

- **Frontend (público):** `VITE_FIREBASE_*` — opcional (há fallback).
- **Backend (secreto):** `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY`. No Vercel, configure em Environment Variables.

## Configurar o super-admin (bootstrap, 1x)

Crie/escolha um usuário no Firebase Auth e defina o claim `superAdmin`:

```bash
FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... FIREBASE_ADMIN_PRIVATE_KEY="..." \
  node scripts/set-super-admin.js voce@stronilead.com.br
```

Faça logout/login no app para o token pegar o claim. Você verá a aba
**"Organizações"** no menu.

## Provisionar a primeira academia

Pela UI (recomendado): logado como super-admin → **Organizações → Nova
organização**. Preencha nome, slug, dados do admin, plano e dias de teste.
O endpoint `POST /api/provision-tenant`:

1. Valida o slug (único, `[a-z0-9-]`, 3–40 chars).
2. Cria o admin no Firebase Auth + claim `tenantId`.
3. Cria o registro em `tenants/{slug}` (status, plano, trial, settings).
4. Cria o doc do admin em `stronix_users`.
5. Semeia catálogos padrão: fontes, motivos de perda, modalidades e config geral.
   (O funil "Comercial" + a etapa "Negociação" são semeados no 1º login do admin.)

O admin acessa o app com o e-mail/senha definidos. `'Venda'`/`'Perda'` são status
sentinela de conversão/perda — não renomeie.

## Fluxo de convite de usuários

1. Admin → **Configurações → Consultores → Convidar** → informa e-mail + papel.
2. `POST /api/invite-create` grava o convite em `tenants/{id}/invites` (token UUID,
   validade 7 dias) e devolve um link: `/?invite=<token>&t=<tenantId>`.
3. Admin envia o link. O convidado abre, define nome + senha
   (`POST /api/invite-accept`): conta criada, claim `tenantId` setado, login
   automático.

## Suspensão / trial

- Super-admin suspende/reativa em **Organizações** (`POST /api/tenant-status`).
  Ao suspender, os refresh tokens dos usuários são revogados (sessões caem).
- O app lê `tenants/{id}` no login: `status: 'suspended'` → tela de suspensão;
  `status: 'trial'` com `trialEndsAt` vencido → tela de teste encerrado.

## Deploy

- **App:** push/merge em `main` → Vercel faz o deploy de produção
  (https://crm-stronix.vercel.app/).
- **Firestore Rules:** publique **manualmente** o conteúdo de `firestore.rules`
  no [console do Firebase](https://console.firebase.google.com/project/crm-stronix/firestore/rules)
  (não via CLI). As mudanças de regra só valem após publicar.

## Scripts

- `npm run dev` — servidor de desenvolvimento (Vite)
- `npm run build` — build de produção
- `npm run lint` — ESLint
- `npm run preview` — preview do build
