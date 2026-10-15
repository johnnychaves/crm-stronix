# STRONILEAD

CRM de leads para academias, multi-tenant, em produção. Produto e escopo em `PRODUCT.md`. Arquitetura em `docs/architecture.md`. As regras de domínio detalhadas, que não cabem aqui, estão no `CLAUDE.md`.

## Stack

React 19 + Vite 8 + Tailwind v4 + shadcn/ui + React Router 7 (`~7.18.4`, sem `<Routes>`), Firebase (Firestore e Auth) e funções serverless da Vercel em `api/` com Firebase Admin. JavaScript e JSX, sem TypeScript. Node 22 no CI, npm com `package-lock.json`.

## Comandos

- Instalar: `npm ci` (na worktree, confira que o lockfile não mudou).
- Desenvolver: `npm run dev`. Sem `.env.local` o front aponta para o Firebase de produção (`crm-stronix`), então não use contas reais para testar escrita.
- Lint: `npm run lint`.
- Tipos: indisponível, o projeto não usa TypeScript.
- Testes: `npm test` (Vitest, jsdom nos testes que montam tela).
- Vazamento no Sentry: `npm run verificar:sentry`.
- Build: `npm run build`.
- Verificar base, igual ao CI: `npm run lint && npm test && npm run verificar:sentry && npm run build`.

## Acordos de trabalho

- Leia o código e o `CLAUDE.md` antes de editar. Declare hipóteses que mudem comportamento.
- Trabalho sempre por PR, nunca commit direto na `main`. O merge só acontece com aprovação do Johnny.
- Menor mudança suficiente. Reaproveite componentes, módulos de `src/lib/` e padrões que já existem.
- UI nova começa pela skill `frontend-design`, e redesign apresenta 2 ou 3 mockups antes. Primitivo complexo novo usa shadcn (skill `shadcn`).
- Texto de tela e documento passa pelo humanizer: direto, sem travessão no meio da frase e sem jargão.
- Teste o comportamento e a falha relevante. Corrigir bug pede reprodução e teste de regressão.
- As `firestore.rules` são publicadas à mão no console do Firebase. Mudou regra, publica e só depois faz o merge.
- Não grave dado pessoal no endereço, no título da aba nem no Sentry.
- Não publique, não faça push e não rode script de `scripts/` que grave dado (`--apply`, `--commit` ou sem gatilho nenhum) sem pedido explícito. Leia o cabeçalho do script antes.

## Armadilhas que já custaram caso

- `api/` tem limite de 12 funções no plano Hobby, e hoje são 11. Consolide antes de criar função nova.
- Nenhuma função de `api/` pode importar `src/lib/dailyGoal.js` (traz `lucide-react`). Os arquivos puros de `src/lib/` lidos pela `api/` não importam pacote, e há teste que trava isso.
- No SDK de servidor `snap.exists` é propriedade, no do navegador é função.
- Filtro de tela mora no endereço (`src/lib/screenParams.js`), nunca em `useState` nem em `key`.
- Papel de usuário só se decide em `src/lib/acesso.js`.

## Documentos

| Assunto | Onde |
|---|---|
| Produto, MVP e limites | `PRODUCT.md` |
| Estrutura, dados, rotas e decisões | `docs/architecture.md` |
| Interface e identidade visual | `docs/design.md` |
| Preparar a máquina e o primeiro dia | `docs/onboarding.md` |
| Checks, linha de base e regras de lint | `docs/quality.md` |
| Toolkit, ferramentas e evidências do setup | `docs/setup.md` |
| Regras de domínio por área | `CLAUDE.md` |
| Specs e planos de cada entrega | `docs/superpowers/specs/` e `docs/superpowers/plans/` |

## Ferramentas

- **Superpowers**: brainstorming antes de feature, plano antes de mudança grande, debugging sistemático antes de corrigir.
- **Ponytail**: menor mudança completa em código.
- **Caveman**: conversa concisa em português. Código, documentação e commits têm redação normal.
- **Context7**: consulte para API de biblioteca, resolvendo o identificador e perguntando um conceito por vez. Nunca envie segredo nem dado de cliente.
- **RTK**: o hook do usuário já reescreve os comandos suportados. Não prefixe `rtk` à mão. Use `rtk proxy <comando>` para a saída original.
- **Graphify**: não instalado. Consulte o `docs/setup.md` antes de depender dele.
- **Skills do projeto** (`.claude/skills/`, versionadas com `skills-lock.json`): `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `writing-guidelines`, `vercel-react-view-transitions` e `find-skills`. Skill instalada não executa nada sozinha.

## Delegação e revisão

- Delegue só quando isolar contexto ou paralelizar trabalho independente compensar. Cada arquivo tem um escritor, e lockfile, configuração compartilhada e Git ficam com quem coordena.
- Revisor trabalha em leitura. Segurança, autorização, regras do Firestore e cálculo de contratos de alunos (valores e datas) pedem a capacidade maior.
- Ao fim de cada ciclo de implementação ou correção, sugira de 3 a 8 ciclos de code review, com o motivo e um prompt pronto. A sugestão não autoriza rodar as rodadas sozinha.
