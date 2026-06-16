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
- Lógica da Meta Diária é regra única em `src/lib/dailyGoal.js` — alterações de categoria/critério acontecem lá.
