# Setup e evidências

Registro da adoção do Vibe Coding Toolkit no STRONILEAD. Serve para repetir o setup sem perder o que foi decidido.

## Origem e contexto

| Item | Valor |
|---|---|
| Data | 15/10/2026 |
| Toolkit | `soumatheusgomes/vibe-coding-toolkit`, revisão `f13bb35` (15/10/2026), prompt 12 |
| Projeto | commit `98584f4` da `main`, trabalho na branch `claude/vibe-toolkit-setup-06fba2` |
| Cliente | Claude Code (app desktop), autenticação e modelo da sessão preservados |
| Runtime | Node 24.15.0 e npm 11.12.1 na máquina, Node 22 no CI |
| Atualidade | revisão do toolkit obtida por clone raso na data acima, sem divergência entre arquivos |

Política de subagentes: nenhum foi despachado neste setup. O trabalho era sequencial (cada passo dependia do diagnóstico do anterior) e de leitura curta. A política para o futuro está no `AGENTS.md`, seção "Delegação e revisão".

## Decisões e fontes

- **Stack preservada.** O toolkit usa Next, Drizzle e PostgreSQL como padrão. O STRONILEAD é Vite, React e Firebase, então templates `next/`, `drizzle`, `env`, `logger` e o ESLint de Next ficaram de fora. Nenhuma migração foi proposta.
- **`CLAUDE.md` preservado.** Tem 461 linhas de regras de domínio que o time usa. Ele passou a importar o `AGENTS.md` (linha `@AGENTS.md`) e nada foi movido. Revisitar quando alguém precisar achar uma regra e não conseguir.
- **Workflow do projeto vence o toolkit** onde divergem: trabalho sempre por PR, merge só com aprovação do Johnny, firestore.rules publicadas à mão. Nenhum hook Git nem bloqueio de branch foi acrescentado.
- **Qualidade só medida.** Regras do toolkit foram contadas fora do ESLint do projeto. Ver `docs/quality.md`.
- **Fontes consultadas:** guias e templates do toolkit na revisão acima, CLI `skills@latest` (`--help` e `--list`), Context7 para o React Router.
- **Texto:** documentos em português, direto e sem travessão no meio da frase, conforme a regra do humanizer da STRONIX.

## Componentes

Cada peça do catálogo do toolkit recebeu uma decisão. Escopo: "usuário" é a configuração do Claude Code da pessoa, "projeto" é o repositório.

| Componente | Ação e motivo | Escopo | Estado e evidência |
|---|---|---|---|
| Superpowers (`docs/tools/01`) | Reaproveitar. Plugin já ativo. | Usuário | Validado: skill `brainstorming` invocada neste setup e listada entre as skills da sessão |
| Subagentes (`02`) | Política escrita no `AGENTS.md`. Sem despacho neste setup. | Projeto | Configurado, sem execução |
| RTK (`03`) | Reaproveitar. Binário 1.0.1 e hook `rtk hook claude` no `PreToolUse` do usuário. Sem wrapper duplicado. | Usuário | Validado: a saída de comando foi comprimida com marca `rtk recall` na sessão |
| Ponytail (`04`) | Reaproveitar. Plugin `ponytail@ponytail` ativo. | Usuário | Configurado. A intensidade `full` não foi verificada |
| Caveman (`05`) | Reaproveitar. Skill presente, ativada só por pedido. | Usuário | Configurado, sem execução |
| ESLint e quality gates (`06`) | Medir `max-lines` e `no-direct-console` sem alterar o lint. `no-direct-data-access` e perfis Next/Drizzle não se aplicam. O `verify.mjs` não foi copiado porque as regras não entraram no projeto. | Projeto | Validado: medição em `docs/quality.md` |
| Graphify (`07`) | Bloqueado. A skill aparece na sessão, a CLI não está instalada. `.graphifyignore` criado e `graphify-out/` ignorado no Git. | Projeto | Pendente: instalar a CLI (ver Pendências) |
| Obsidian (`08`) | Inaplicável. Memória do Claude e documentos versionados cobrem o uso, e não há destino autorizado para um vault. | Não se aplica | Decisão registrada |
| Memória do Claude (`09`) | Reaproveitar. Índice `MEMORY.md` com notas por assunto. | Usuário | Validado: o índice foi carregado nesta sessão |
| Hooks (`10`) | Só referência. O hook do RTK foi preservado e nenhum outro foi criado. | Usuário | Sem mudança |
| agent-browser (`11`) | Inaplicável por ora. O navegador embutido do app e o Chrome DevTools MCP cobrem a necessidade. | Não se aplica | Decisão registrada |
| Context7 (`12`) | Reaproveitar o MCP configurado no usuário. Não criei `.mcp.json` no projeto, para não duplicar o servidor. | Usuário | Validado: `resolve-library-id` e `query-docs` de `navigate` com `replace` e `state` no React Router 7.9.4 (o projeto usa `~7.18.4`, versão que o Context7 não lista) |
| Skills da Anthropic (`13`) | Avaliado. `docx`, `pdf`, `xlsx` e `skill-creator` estão no usuário. Nada a instalar no projeto. | Usuário | Decisão registrada |
| Chrome DevTools MCP (`14`) | Reaproveitar o do plugin `ecc`. | Usuário | Configurado, sem execução (esta entrega não muda interface) |
| Codex (`15`) | Inaplicável. O projeto usa só o Claude Code e não há `.codex/`. O `AGENTS.md` já serve a um Codex futuro. | Não se aplica | Decisão registrada |
| Skills Vercel (`16`) | Instalar, com autorização do Johnny. Cinco de `vercel-labs/agent-skills` mais `find-skills`. | Projeto | Validado: arquivos em `.claude/skills/`, `skills-lock.json`, `skills list` e reexecução sem mudança |
| aia-harness | Avaliado, não instalado. É de marketplace de terceiros e o `AGENTS.md` com os `docs/` já cobrem o onboarding. | Não se aplica | Decisão registrada |
| Templates `next/`, Drizzle, env e logger | Inaplicáveis à stack. | Não se aplica | Decisão registrada |
| Documentos do manifesto | Ver "Documentação criada". | Projeto | Validado |

### Skills Vercel instaladas

| Skill | Origem | Uso |
|---|---|---|
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | Escrever ou revisar React: dados, bundle, renderização |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Estrutura e API de componentes |
| `web-design-guidelines` | `vercel-labs/agent-skills` | Revisão de interface e acessibilidade |
| `writing-guidelines` | `vercel-labs/agent-skills` | Revisão de documentação e prosa |
| `vercel-react-view-transitions` | `vercel-labs/agent-skills` | Transições, só quando pedidas |
| `find-skills` | `vercel-labs/skills` | Descobrir skill quando faltar capacidade |

Cópias (não links) em `.claude/skills/`, só arquivos markdown, sem scripts, 99 arquivos e 640 kB. Hashes em `skills-lock.json`.

Não instaladas, com motivo: `deploy-to-vercel` e `vercel-cli-with-tokens` (o Johnny pediu sem deploy), `vercel-optimize` (mira Next, SvelteKit, Nuxt e Astro, e este projeto é uma SPA em Vite) e `vercel-react-native-skills` (sem mobile).

## Documentação criada

| Destino do manifesto | Situação |
|---|---|
| `README.md` | Preservado. Corrigida a lista de `api/`, acrescentados `npm test`, `verificar:sentry` e os links para os documentos |
| `PRODUCT.md` | Novo |
| `AGENTS.md` | Novo, curto |
| `CLAUDE.md` | Preservado, com `@AGENTS.md` no topo |
| `docs/architecture.md` | Novo |
| `docs/design.md` | Novo |
| `docs/onboarding.md` | Novo |
| `docs/quality.md` | Novo |
| `docs/setup.md` | Este arquivo |

Documentos que já existiam e foram mantidos como fontes próprias: `docs/APPCHECK_SETUP.md`, `docs/ASAAS_SETUP.md`, `docs/indicacoes.md`, `docs/scale-migration.md` e `docs/auditoria-leitura-2026-07-28.md`. Specs e planos continuam em `docs/superpowers/`.

## Verificações

| Item | Antes | Depois | Evidência |
|---|---|---|---|
| Lint | 0 erros, 1 aviso | 0 erros, 1 aviso (mesmo) | `npm run lint` |
| Testes | 219 arquivos, 4913 passando | 219 arquivos, 4913 passando | `npm test` |
| Sentry sem vazamento | não rodado antes | passou (rodada normal e sabotagem) | `npm run verificar:sentry` |
| Build | passa | passa | `npm run build` |
| Skills instaladas | nenhuma | 6, descobertas por `skills list` | `npx skills@latest list --agent claude-code` |
| Reexecução das skills | não se aplica | `skills-lock.json` e os 99 arquivos com o mesmo hash | `shasum` antes e depois de repetir os dois comandos de instalação |
| Context7 | não testado | consulta real respondida | Seção Componentes |
| Importação do `AGENTS.md` pelo `CLAUDE.md` | não se aplica | linha presente, **carregamento em sessão nova não observado** | Pendência abaixo |

O código da aplicação (`src/`, `api/`, `scripts/`) não foi alterado. Recursos temporários criados: um clone do toolkit e scripts de medição no scratchpad da sessão, fora do projeto.

Recebeu só revisão estática: os links entre documentos e a precisão dos números de `docs/quality.md` (conferidos contra a saída dos comandos desta sessão).

## Como manter e repetir

```bash
# conferir as skills
npx --yes skills@latest list --agent claude-code

# atualizar as skills do projeto, revisar o diff e o skills-lock.json depois
npx --yes skills@latest update --project --yes

# repetir o setup: abrir o agente na raiz e usar o prompt 12 do toolkit
```

Ao repetir, o agente descobre o estado real. Documentos e `AGENTS.md` são conciliados, nunca sobrescritos. Atualize este arquivo com a nova revisão do toolkit.

## Pendências e próxima entrega

| Pendência | Causa | Próxima ação |
|---|---|---|
| Graphify não instalado | A CLI é global (`uv tool install graphifyy` ou `pipx install graphifyy`) e o setup não altera a máquina | O Johnny autoriza a instalação. Depois: `GRAPHIFY_NO_AUTO_REFRESH=1 graphify --version`, geração por modo determinístico e registro da cobertura aqui |
| Descoberta das skills em sessão nova | Arquivo em disco prova a instalação, não o carregamento | Abrir sessão nova na raiz e conferir `vercel-react-best-practices` e o import do `AGENTS.md` |
| 46 arquivos acima de 350 linhas | Dívida anterior ao setup | Reduzir por responsabilidade quando a tela passar por mudança, com `max-lines` em `warn` e contagem. Proposta própria, não neste PR |
| 23 achados de `npm audit` em produção | Dependências do `firebase-admin`, `exceljs` e `postcss` | Decisão por pacote. `exceljs` só fecha trocando para a 3.4.0 |
| 1 aviso de lint (`SuperAdminView.jsx:113`) | Anterior ao setup | Corrigir junto com a próxima mudança nessa tela |
| `CLAUDE.md` com 461 linhas | Regras de domínio concentradas | Se for difícil achar regra, mover por área para `docs/` e deixar índice |
| Registro no `CLAUDE.md` do monorepo STRONIX-FIRMA | O arquivo fica fora deste repositório | O Johnny decide se entra em "Últimas Atualizações" |

Nada foi publicado e nenhum push foi feito. Publicação e novos custos dependem de pedido do Johnny.

### Sugestão de code review posterior

Sugiro **3 ciclos**, porque a mudança é só documentação e configuração, sem código de aplicação. O risco está na precisão dos fatos e no que as skills copiadas carregam.

1. **Fatos contra o código.** Conferir cada afirmação de `docs/architecture.md`, `docs/quality.md` e `PRODUCT.md` com o código e o `CLAUDE.md`.
2. **Skills e configuração.** Ler o conteúdo das 6 skills copiadas (instruções que o agente vai seguir), licenças, `skills-lock.json` e a coerência `.gitignore`, `.graphifyignore` e `.claude/`.
3. **Clareza e links.** Links relativos, redundância entre `AGENTS.md`, `CLAUDE.md` e `docs/`, e passada de humanizer e `writing-guidelines`.

Prompt de continuação:

```text
Faça 3 ciclos de code review no branch claude/vibe-toolkit-setup-06fba2 do stronilead, em modo leitura, com achados por severidade, caminho e evidência. Ciclo 1: confira os fatos de PRODUCT.md, docs/architecture.md e docs/quality.md contra src/, api/ e CLAUDE.md. Ciclo 2: leia as skills de .claude/skills/, skills-lock.json, .gitignore e .graphifyignore. Ciclo 3: links, redundância entre AGENTS.md, CLAUDE.md e docs/, e linguagem. Rode npm run lint, npm test, npm run verificar:sentry e npm run build ao final. Não corrija nada sem eu aprovar e não faça push.
```
