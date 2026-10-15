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
- **Fontes consultadas:** guias e templates do toolkit na revisão acima, CLI `skills` 1.7.2 (`--help`, `--list` e `remove`), Context7 para o React Router.
- **Skills de terceiros são conteúdo que o agente segue.** Por isso passaram por revisão de segurança em modo leitura (15/10/2026): sem script, executável, link simbólico nem texto oculto. A revisão achou três ressalvas, tratadas na seção "Revisão feita".
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
| Skills Vercel (`16`) | Instalar, com autorização do Johnny. Cinco de `vercel-labs/agent-skills` mais `find-skills`. Depois da revisão, `find-skills` e `vercel-react-view-transitions` saíram, e as duas skills de revisão passaram a ler regras locais. Ficam quatro. | Projeto | Validado: arquivos em `.claude/skills/`, `skills-lock.json` e `skills list`. A reexecução sem mudança foi provada antes da adaptação das duas skills de revisão |
| aia-harness | Avaliado, não instalado. É de marketplace de terceiros e o `AGENTS.md` com os `docs/` já cobrem o onboarding. | Não se aplica | Decisão registrada |
| Templates `next/`, Drizzle, env e logger | Inaplicáveis à stack. | Não se aplica | Decisão registrada |
| Documentos do manifesto | Ver "Documentação criada". | Projeto | Validado |

### Skills Vercel instaladas

| Skill | Origem | Uso |
|---|---|---|
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | Escrever ou revisar React: dados, bundle, renderização |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Estrutura e API de componentes |
| `web-design-guidelines` | `vercel-labs/agent-skills`, com `rules.md` local | Revisão de interface e acessibilidade |
| `writing-guidelines` | `vercel-labs/agent-skills`, com `rules.md` local | Revisão de documentação e prosa |

Cópias (não links) em `.claude/skills/`, só arquivos markdown, sem scripts, 92 arquivos e 520 kB. Hashes de instalação em `skills-lock.json`. Instaladas em 15/10/2026 a partir do branch principal dos repositórios de origem. Só `vercel-react-best-practices` e `vercel-composition-patterns` declaram licença MIT no frontmatter, e a licença dos repositórios de origem não foi conferida. Fica registrado como pendência.

As duas skills de revisão foram alteradas à mão, com a origem de cada `rules.md` e o commit fixado dentro do próprio `SKILL.md`. O hash do `skills-lock.json` delas é o de antes da alteração.

Não instaladas, com motivo: `deploy-to-vercel` e `vercel-cli-with-tokens` (o Johnny pediu sem deploy), `vercel-optimize` (mira Next, SvelteKit, Nuxt e Astro, e este projeto é uma SPA em Vite) e `vercel-react-native-skills` (sem mobile).

Instaladas e depois retiradas, na revisão de 15/10/2026: `find-skills` (mandava instalar skills de terceiros com `-g -y`, sem confirmação) e `vercel-react-view-transitions` (pede `react@canary` e quase todo o conteúdo é de Next.js).

Aviso sobre o conteúdo de `vercel-react-best-practices`: parte das regras é de Next.js ou de renderização no servidor (`client-swr-dedup`, `server-after-nonblocking`, `bundle-dynamic-imports`, `server-*`, `rendering-hydration-*`) e não se aplica a este app. As regras `js-*`, `async-parallel` e `rerender-*` valem.

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
| Skills instaladas | nenhuma | 4 (eram 6 antes da revisão), listadas por `skills list` | `npx skills@1.7.2 list --agent claude-code` |
| Reexecução das skills | não se aplica | `skills-lock.json` e os 99 arquivos com o mesmo hash, antes da adaptação | `shasum` antes e depois de repetir os dois comandos de instalação |
| `rules.md` das duas skills de revisão | não se aplica | idêntico ao `command.md` do commit fixado | `cmp` entre o arquivo lido do `main` e o baixado pelo SHA |
| Context7 | não testado | consulta real respondida | Seção Componentes |
| Importação do `AGENTS.md` pelo `CLAUDE.md` | não se aplica | linha presente, **carregamento em sessão nova não observado** | Pendência abaixo |

O código da aplicação (`src/`, `api/`, `scripts/`) não foi alterado. Recursos temporários criados: um clone do toolkit e scripts de medição no scratchpad da sessão, fora do projeto.

Recebeu só revisão estática: os links entre documentos e a precisão dos números de `docs/quality.md` (conferidos contra a saída dos comandos desta sessão).

## Como manter e repetir

```bash
# conferir as skills (versão do CLI fixada; confira a atual antes de subir)
npx --yes skills@1.7.2 list --agent claude-code

# atualizar uma skill do projeto, nunca todas de uma vez. Revise o diff e o skills-lock.json depois
npx --yes skills@1.7.2 update vercel-react-best-practices --project --yes

# repetir o setup: abrir o agente na raiz e usar o prompt 12 do toolkit
```

Não rode `update` em `web-design-guidelines` nem em `writing-guidelines`: ele reescreve a pasta com a versão de origem e apaga a adaptação local (`rules.md` fixado e o `SKILL.md` que lê o arquivo local). Para atualizar essas duas, siga o passo a passo dentro do `SKILL.md` de cada uma.

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
| Licença das skills de origem | Só duas skills declaram licença no frontmatter | Conferir a licença de `vercel-labs/agent-skills` e guardar a atribuição, em `THIRD_PARTY.md` ou aqui |
| `AGENTS.md` e `README.md` compilados dentro das skills | Vêm de origem, somam cerca de 5 mil linhas e há READMEs de `pnpm` que não existem aqui | Apagar, mantendo `SKILL.md` e `rules/`, se o custo de contexto incomodar. Não feito, porque não estava no pedido |
| `.claude/settings.local.json` saiu do índice | Estava versionado desde o commit inicial, com `enableAllProjectMcpServers: true` | Quem fizer pull depois do merge perde esse arquivo local na própria máquina e recria o que precisar |
| Descrição em bloco dobrado em `vercel-composition-patterns` | YAML válido, mas parser simples pode ler vazio | Reformatar em uma linha, se a skill não for descoberta |

Nada foi publicado e nenhum push foi feito. Publicação e novos custos dependem de pedido do Johnny.

## Revisão feita em 15/10/2026

Três ciclos de revisão em modo leitura, depois do primeiro commit: fatos dos documentos contra o código, skills e arquivos de ignore, e links, redundância e linguagem. Sem achado grave. Corrigidos no segundo commit:

- 7 imprecisões de fato em `PRODUCT.md`, `docs/architecture.md` e `docs/quality.md` (quem grava `role`, abrangência do `verificar:sentry`, gatilhos dos scripts, Relatórios, academias ativas, Meta do professor, relação entre regras do Firestore e testes);
- as duas skills de revisão deixaram de buscar regras na rede, e o conteúdo ficou fixado por commit;
- `find-skills` e `vercel-react-view-transitions` saíram do projeto e do lockfile;
- `.claude/settings.local.json` saiu do índice do Git e entrou no `.gitignore`;
- CLI de skills com versão fixa nos comandos e padrões de credencial acrescentados ao `.graphifyignore`.

### Sugestão de code review posterior

Sugiro **3 ciclos**, porque o segundo commit é pequeno, mas mexeu em conteúdo que o agente segue (as duas skills adaptadas) e em fatos que alguém vai citar.

1. **Skills adaptadas.** Conferir que `rules.md` das duas skills é igual ao `command.md` do commit citado e que os `SKILL.md` não perderam nenhuma regra.
2. **Fatos corrigidos.** Reconferir contra o código cada trecho alterado nos documentos, e procurar a mesma imprecisão em `docs/design.md` e `docs/onboarding.md`.
3. **Efeito da saída do `settings.local.json`.** Confirmar que nada no repositório depende do arquivo e que o `.gitignore` o cobre.

Prompt de continuação:

```text
Faça 3 ciclos de code review no branch claude/vibe-toolkit-setup-06fba2 do stronilead, em modo leitura, com achados por severidade, caminho e evidência. Ciclo 1: compare .claude/skills/web-design-guidelines/rules.md e .claude/skills/writing-guidelines/rules.md com o command.md dos commits citados nos SKILL.md e confira se os SKILL.md mantêm todas as regras. Ciclo 2: reconfira contra src/, api/ e CLAUDE.md cada trecho alterado em PRODUCT.md, docs/architecture.md e docs/quality.md, e procure a mesma imprecisão em docs/design.md e docs/onboarding.md. Ciclo 3: confirme que nada depende de .claude/settings.local.json e que o .gitignore o cobre. Rode npm run lint, npm test, npm run verificar:sentry e npm run build ao final. Não corrija nada sem eu aprovar e não faça push.
```
