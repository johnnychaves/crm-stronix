# Cadastro da equipe: plano mestre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar Configurações → Equipe & acessos por uma lista única de pessoas, com a ficha completa de cada uma (dados, movimentações e acesso), o cadastro de pessoa nova numa gaveta e o desligamento que passa a carteira e os alunos.

**Architecture:** Uma coleção nova, `stronix_equipe`, que só o gestor lê, guarda a ficha e aponta para o login (`stronix_users`) e para o professor (`stronix_professores`). A lista junta as três fontes numa função pura (`montarEquipe`). O desligamento é uma ação nova no `api/admin-users.js`, sem função nova na Vercel.

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui, React Router 7 (sem `<Routes>`), Firebase (Firestore, Auth e Storage), funções da Vercel em `api/` com o Admin SDK, Vitest (node e jsdom).

**Spec:** `docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md` (aprovada em 26/11/2026). **Mockup:** `docs/superpowers/specs/mockups/2026-11-26-equipe-a-lista-e-pagina.html`.

---

## Os três PRs

| PR | Plano | O que entrega | Depende de |
|---|---|---|---|
| 1 | `2026-11-26-cadastro-da-equipe-01-lista-e-ficha.md` | coleção e regra, junção, endereço e filtros, lista nova, ficha com as abas Dados, Movimentações e Acesso ao app, saída do card Professores | main |
| 2 | `2026-11-26-cadastro-da-equipe-02-cadastrar-pessoa.md` | gaveta "Cadastrar pessoa" e "Dar acesso", `fichaId` no `invite-create` e no `invite-accept`, saída dos diálogos antigos de cadastro, convite e professor | PR 1 na main |
| 3 | `2026-11-26-cadastro-da-equipe-03-desligar-e-readmitir.md` | ação `desligar` no servidor, diálogo de desligar, readmitir | PR 1 na main |

Os PRs 2 e 3 não dependem um do outro. Cada um sai da main depois do merge do PR 1, sem empilhar (apagar a branch base no merge pelo `gh` fecha as PRs filhas).

O PR 1 deixa no cabeçalho da tela os botões de hoje ("Cadastrar pessoa" ou "Cadastrar consultor", "Convidar por e-mail" e "Cadastrar professor"), abrindo os diálogos de hoje, para a academia não ficar sem cadastro entre o PR 1 e o PR 2. O PR 2 troca os três pela gaveta.

## Mapa de arquivos

Novos:

| Arquivo | Responsabilidade | PR |
|---|---|---|
| `src/lib/equipe/ficha.js` | vínculos, tipos de desligamento, movimentações, admissão, o anel ("Falta:") e o patch de cada bloco. Puro, porque a `api/` lê | 1 |
| `src/lib/equipe/equipe.js` | `montarEquipe`, `acessoDe`, `filtrarEquipe`. Puro, só importa `../acesso.js` | 1 |
| `src/lib/equipe/equipeWrites.js` | gravar bloco da ficha, renomear a pessoa com as cópias, foto | 1 |
| `src/hooks/useEquipeFichas.js` | assinatura de `stronix_equipe` | 1 |
| `src/views/settings/equipe/EquipeLista.jsx` | a lista do mockup A | 1 |
| `src/views/settings/equipe/EquipeFicha.jsx` | a ficha: cabeçalho e abas | 1 |
| `src/views/settings/equipe/FichaDados.jsx` | os blocos Identidade, Contato e Trabalho | 1 |
| `src/views/settings/equipe/FichaMovimentacoes.jsx` | a linha do tempo | 1 |
| `src/views/settings/equipe/FichaAcesso.jsx` | o bloco Acesso ao app | 1 |
| `src/views/settings/equipe/EditarAcessoDialog.jsx` | o diálogo de editar membro de hoje, movido sem mudar a regra | 1 |
| `src/lib/equipe/cadastro.js` | passos e regras da gaveta. Puro | 2 |
| `src/views/settings/equipe/CadastrarPessoa.jsx` | a gaveta | 2 |
| `api/_equipe.js` | a ficha pelo Admin SDK: conferir, gravar o convite e ligar o login (PR 2), desligar (PR 3) | 2 |
| `src/lib/equipe/desligamento.js` | a modalidade de cada aluno e o substituto. Puro, a `api/` lê | 3 |
| `src/views/settings/equipe/DesligarDialog.jsx` e `ReadmitirDialog.jsx` | os diálogos | 3 |

Alterados: `firestore.rules`, `src/lib/firebase.js`, `src/lib/routes.js`, `src/lib/appShell.js`, `src/lib/screenParams.js`, `src/lib/sentryScrub.js`, `src/App.jsx`, `src/views/settings/SettingsView.jsx`, `src/views/settings/TeamAccessSection.jsx`, `src/components/profile/cadastro/CadastroForms.jsx` (exporta o `AddressForm`), `api/admin-users.js`, `api/invite-create.js`, `api/invite-accept.js`, os testes de equipe e o `CLAUDE.md` do Stronilead.

## Regras para todo PR

- Leia o `CLAUDE.md` e o `AGENTS.md` do Stronilead antes. Em especial: "Endereço de cada tela", "Professor" e "Padrão de UI".
- Worktree atrasada: confira `git rev-list --count HEAD..origin/main` antes de começar e traga a main se for maior que zero.
- `npm ci` na worktree e confira que o `package-lock.json` não mudou.
- Linha de base antes de mexer: `npm run lint && npm test && npm run verificar:sentry && npm run build`. Anote o que já falhava.
- Texto de tela em português, sem travessão no meio da frase, sem caixa alta, passado pelo humanizer.
- Primitivo complexo novo pelo shadcn (`Tabs`, `Sheet`, `Dialog` e `RadioGroup` já existem em `src/components/ui/`). `cn()` de `@/lib/utils`, tokens semânticos, anel de foco `focus-visible:anel-foco`.
- Nada de dado pessoal no endereço, no título da aba, no log ou no Sentry.
- `firestore.rules` e a regra do Storage são publicadas à mão, com o OK do Johnny, antes do merge do PR que precisa delas.
- Nada de push, PR ou merge sem o pedido do Johnny.
- Ao fim de cada PR, rode a verificação completa de novo e sugira de 3 a 8 ciclos de code review, com o motivo e um prompt pronto.
- O PR que muda comportamento atualiza a seção "Equipe & acessos" do `CLAUDE.md` do Stronilead (o PR 1 cria a seção).

## Verificação no navegador

Sem login, pelo harness com fakes do Firebase guardado em `harness-professores/`, na pasta de notas das sessões do perfil do professor (`/Users/johnnybittencourt/Library/Application Support/Claude/side-session-notes/local_7c83a8ee-39b6-451b-a822-104070712555/harness-professores/`). Copie para a worktree só durante a conferência e apague antes do commit: os arquivos dentro de `src/` quebram o lint e as varreduras.
