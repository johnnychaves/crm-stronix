# STRONILEAD — CRM para academias

React 19 + Vite + Tailwind v4 (tokens em `src/index.css` via `@theme`) + Firebase (Firestore/Auth) + Vercel serverless (`api/`, **limite 12 funções** no plano Hobby — consolidar antes de criar função nova). Multi-tenant por claim `tenantId`. Sem TypeScript (JS/JSX).

## Padrão de UI — shadcn/ui (adotado 2026-06-12)

A fundação shadcn está instalada: `components.json`, alias `@/` → `src/`, `cn()` em `@/lib/utils`, tokens semânticos mapeados na paleta STRONILEAD (`src/index.css`) e componentes base em `src/components/ui/` (minúsculos: `button.jsx`, `dialog.jsx`, ...).

**Regras para código novo:**

1. **Primitivo complexo novo (modal, menu, tooltip, tabs, combobox...) → use/adicione componente shadcn** (`npx shadcn@latest add <comp>`), não construa na mão. Invoque a skill `shadcn` ao trabalhar nisso.
2. **`cn()` para classes condicionais** — nada de template literals com ternários.
3. **Tokens semânticos** (`bg-background`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`) em componentes novos — eles resolvem dark mode sozinhos (evite `dark:` manual em código novo).
4. **`flex gap-*`** no lugar de `space-x/y-*`; **`size-N`** no lugar de `w-N h-N`.
5. O ramp laranja do app continua em `accent-50..600` (sempre com sufixo numérico); `bg-accent` puro é o token semântico shadcn (hover suave).

**Exceções conhecidas (APFS case-insensitive — NÃO adicionar via shadcn):** `avatar` e `skeleton` colidem com `Avatar.jsx`/`Skeleton.jsx` próprios do app — continue usando os do app.

**Legado:** os componentes próprios (`Btn`, `SettingsCard`, `Field`, ...) e telas existentes seguem como estão; migram para shadcn **oportunisticamente** quando a tela passar por redesign (e redesigns sempre apresentam 2-3 mockups antes — ver memória).

**Radius:** os utilitários `rounded-*` padrão do Tailwind NÃO foram redefinidos (sem `--radius-*` shadcn) para não alterar o visual atual.

## Convenções gerais

- Trabalho sempre via PR (nunca commit direto na main); merge só com aprovação do Johnny.
- UI nova invoca a skill `frontend-design`; identidade: Space Grotesk (display), azul `#2B59FF`, laranja `#FF6A2B`.
- Firestore rules são publicadas MANUALMENTE no console Firebase (não via CLI).
- Lógica da Meta Diária é regra única em `src/lib/dailyGoal.js` — alterações de categoria/critério acontecem lá. Esse arquivo importa `lucide-react`, então nenhuma função de `api/` pode importá-lo (ver a ponte com o Stronizap, abaixo).

## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09

O atendente do Stronizap enxerga um telefone e um nome do WhatsApp. Quem diz se aquilo é lead em negociação, aluno ativo ou contrato vencendo é **este sistema**. O CRM é dono da identidade; o Zap só renderiza o que recebe.

Tudo cabe numa função só, `api/zap.js`:

- `GET /api/zap?tenant=<id>&phone=<dígitos>` com header `x-stronizap-key` devolve o cartão de contexto, ou `{ found: false }` quando ninguém casa. A lista de campos é FECHADA em `api/_zapCard.js` de propósito: nada de CPF, endereço, valor de contrato ou situação de pagamento numa tela de chat.
- `POST /api/zap` com `{ action: 'generate' | 'revoke' }` gera e revoga a chave. Autentica por ID token do admin da academia, nunca pela chave do próprio Zap.

**A chave é emitida aqui.** Fica gravada só como hash em `tenants/{id}.integrations.zap` (`keyHash`, `keyPrefix`, `createdAt`, `createdBy`, `revokedAt`). O valor em claro sai do servidor uma única vez, na tela Configurações → Integrações → Stronizap (`src/views/settings/ZapIntegrationSection.jsx`), e não fica salvo no navegador. Quem perder gera outra.

**Casamento de telefone.** O campo indexado `lead.zapMatchKey` é o DDD mais os últimos 8 dígitos. É a única parte estável entre o formato daqui (até 11 dígitos, sem DDI) e o do WhatsApp (com 55 na frente, e o nono dígito que existe em número novo e não existe em número antigo). A regra mora em `api/_zapPhone.js` e quem grava é `buildLeadSearchFields`, em `src/lib/leadDerived.js`. Esse builder tem espelho em `api/_referral.js`: mexeu num, mexa no outro, senão `src/lib/__tests__/referralApiMirror.test.js` quebra. Base antiga se acerta com `scripts/backfill-zap-match-key.js`.

**Faixa de destaque** (`api/_zapStrip.js`), por ordem de precedência: visita ou aula de hoje, contrato vencido, freepass válido, marco de renovação. Os gatilhos saem de `src/lib/contracts.js`, de `src/lib/renewalGoal.js` e da conta do freepass. Nenhuma regra é recalculada do outro lado.

**`src/lib/dailyGoal.js` não pode ser importado por função serverless.** Ele importa `lucide-react` e quebra em runtime de servidor. É por isso que a faixa deriva dos módulos puros em vez de reusar as categorias da Meta Diária direto.

**Os marcos de renovação são os da academia.** `api/zap.js` lê `renewalCheckpoints` em `stronix_config/general` depois de achar o lead, e nunca quando ninguém casa, e repassa a `buildZapCard` → `buildZapStrip`. Doc inexistente, campo ausente ou lista malformada caem em `DEFAULT_RENEWAL_CHECKPOINTS` (90/60/30). Mudar os marcos em Configurações → Metas & ritmo muda a Meta Diária e o cartão do Zap juntos.

**Próximo passo.** A Parte B (mensagem enviada virando interação na timeline, Meta Diária deixando de ser autodeclarada, `awaitingReplySince`, fila de contatos a classificar e a rota que abre a conversa a partir do lead) está desenhada em `docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md` e ainda sem plano escrito. Pelo desenho, o `POST` de eventos entra no MESMO `api/zap.js`, não numa função nova. Hoje são 11 das 12 funções da Vercel, e a vaga que sobra continua livre.
