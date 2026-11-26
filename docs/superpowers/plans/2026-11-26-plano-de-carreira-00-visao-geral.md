# Plano de carreira configurável: visão geral

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o gestor monta as trilhas de carreira (Consultor, Professor, Estagiário e as que criar), com níveis, tempo mínimo e metas por nível, e acompanha cada pessoa no menu Carreira.

**Architecture:** as trilhas moram em `stronix_config/carreira`, no campo `trilhas`, um mapa por id. A trilha, o nível e o "desde" de cada pessoa moram no cadastro dela (`stronix_professores` ou `stronix_users`). As contas são funções puras em `src/lib/carreira/` e `src/lib/professor/`, que recebem o período da trilha. Tudo fica atrás do módulo Stronix 2.0 (`faltosos`).

**Tech Stack:** React 19, Vite, Firebase (Firestore), React Router 7 sem `<Routes>`, Vitest com jsdom nos testes de tela. JavaScript e JSX, sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md`. Mockups em `docs/superpowers/specs/mockups/2026-11-26-carreira-*`.

---

## Os quatro PRs

Cada PR sai da `main` com o anterior já mergeado, passa por `npm run lint && npm test && npm run verificar:sentry && npm run build` e só entra com o OK do Johnny.

| PR | Plano | O que entrega | Depende de |
|---|---|---|---|
| 1 | `2026-11-26-plano-de-carreira-01-trilhas-e-contas.md` | `src/lib/carreira/` (períodos, números, trilhas, validação), as contas do professor recebendo o período, a pesquisa de NPS contando pela data. Nenhuma tela nova, nenhum número de hoje muda | nada |
| 2 | escrito no começo do PR 2 | Configurações → Plano de carreira: lista das trilhas e o editor do mockup A | PR 1 |
| 3 | escrito no começo do PR 3 | Menu Carreira: rotas, lista com a pílula Trilha, "Trilha e nível", placar com as duas metas, "Minha carreira", regra `carreiraKept()` | PR 1 e PR 2 |
| 4 | escrito no começo do PR 4 | Perfil do consultor: as quatro contas e a tela com as quatro abas | PR 3 |

Os planos detalhados dos PRs 2 a 4 são escritos quando o PR anterior entra na `main`, contra o código que ficou, como foi feito com o perfil do professor. O que cada um precisa fazer está abaixo, com os nomes que o PR 1 cria.

## O que o PR 1 deixa pronto para os outros

Módulos puros, sem import de pacote (o `carreiraImports.test.js` cobra):

- `src/lib/carreira/periodo.js`: `mesesDaAvaliacao(trilha)`, `periodoPorChave(trilha, chave)`, `periodoDe(trilha, data)`, `periodoAnterior(trilha, periodo)`, `periodoSeguinte(trilha, periodo)`, `janelaDaRenovacao(trilha, periodo)`, `pecasDaAderencia(periodo)`, `chaveDaPesquisa(trilha, inicio)`. O período é `{ chave, inicio, fim }`, com `fim` fora.
- `src/lib/carreira/numeros.js`: `NUMEROS`, `numerosDaBase(base)`, `metaValida(id, valor)`, `metaBatida(id, { valor, meta, academia })`, `AJUSTES`, `VENDAS_EM`.
- `src/lib/carreira/trilhas.js`: `TRILHA_PROFESSOR`, `TRILHA_ESTAGIARIO`, `TRILHA_CONSULTOR`, `MAX_NIVEIS`, `MESES_MAX`, `VINCULOS`, `professorDasMetas(metas)`, `lerTrilha(raw, id)`, `trilhasDe(doc)`, `trilhaDaPessoa(pessoa, trilhas, { professor })`, `nivelDaPessoa(pessoa, trilha)`, `proximoNivel(trilha, nivelId)`, `trilhaSugerida({ base, vinculo, modalidadeIds }, trilhas)`.
- `src/lib/carreira/validacao.js`: `problemaDaTrilha(trilha, { gravada, outras, pessoasPorNivel })` e `podeArquivar(pessoasPorNivel)`.
- As contas do professor recebem `periodo` (`{ inicio, fim }`) no lugar de `ciclo`: `renovacaoDoCiclo`, `carteiraDoCiclo`, `conversaoDoCiclo`, `pessoasDasAulas`. A aderência recebe os pedaços: `aderenciaDoAno(linhas, pecas, asOf)` e `aderenciaResumo(linhas, pecas, asOf)`. O NPS recebe a trilha e a chave: `npsDoCiclo({ pesquisas, totais, professorId, trilha, chave, meta })`.
- `src/lib/professor/ciclo.js` fica só para as telas de hoje, que ainda leem o ciclo do endereço como ano, e passa a delegar ao `periodo.js` com a trilha anual de dezembro. O PR 3 o apaga.
- `useProfessoresDados` devolve também `trilhas` (todas, de `trilhasDe`) e `trilhaProfessor`.

Uma diferença da spec: ela põe no PR 1 o placar lendo a trilha Professor. O placar só muda de verdade no PR 3, quando ganha as duas metas, então a leitura das metas pela trilha fica no PR 3, e o PR 1 não mexe no placar.

## PR 2: Configurações → Plano de carreira

**Arquivos novos:** `src/views/settings/carreira/CarreiraSettingsSection.jsx` (lista e roteamento da trilha aberta), `TrilhaEditor.jsx` (cabeçalho, abas e barra de salvar), `TrilhaGrade.jsx` (aba Níveis e metas), `TrilhaRegras.jsx` (aba Regras da trilha), `src/lib/carreira/rascunho.js` (o rascunho da trilha: criar nível, apagar nível, ligar número, trocar meta, montar a trilha nova a partir de outra) e `src/lib/carreiraWrites.js` (`salvarTrilha(db, trilha, appUser)`, que grava `trilhas.<id>` por `updateDoc` e cria o documento com `setDoc` e `merge` quando ele não existe).

**Arquivos que mudam:** `src/lib/settingsRail.js` (item `carreira` no grupo Equipe, só com o módulo), `src/lib/routes.js` (`SETTINGS_SECTIONS.carreira = 'carreira'`, e `readScreen` lendo `/configuracoes/carreira/<id>` e `/<id>/regras`), `src/lib/sentryScrub.js` (`/configuracoes/carreira/:trilhaId`), `src/views/SettingsView.jsx` (monta a seção) e `src/views/professores/ProfessoresView.jsx` (sai a aba Metas e o `MetasForm.jsx`; `/professores/metas` leva a `/configuracoes/carreira/professor` com replace).

**O que precisa ficar coberto por teste:** o rascunho (`rascunho.js`) com nível novo, nível apagado, número desligado e trilha nova; a gravação pelo caminho do campo sem mesclar (com o banco falso); a grade em jsdom (ligar e desligar, meta em branco tracejada, apagar nível com gente desligado com o motivo, trocar de aba sem perder o rascunho, "Arquivar trilha" desligado com gente); o endereço no `routes.test.js` e no `sentryScrub`; e o `settingsRail.test.js` com o item novo.

**A trilha Professor não muda de calendário antes do PR 3:** no PR 1, o NPS das telas já lê a trilha Professor, mas renovação, conversão e aderência ainda usam o ciclo fixo de dezembro. Se o gestor trocasse a Professor para semestral ou outro mês, o NPS sumiria e os outros três números ficariam iguais. Por isso, o editor do PR 2 trava a frequência e o mês da trilha Professor (com o aviso "O calendário da trilha Professor muda a partir do menu Carreira."), e o PR 3 tira a trava (achado da revisão final do PR 1).

**Pessoas por nível:** a contagem vem dos professores (`stronix_professores`, pelo `trilhaDaPessoa` com `professor: true`) e dos usuários consultores (`usersList`), pelo `nivelDaPessoa`. As duas listas o app já tem.

## PR 3: menu Carreira

**Rotas:** `carreira` (lista e `pesquisas`), `carreiraProfessor` (`/carreira/professor/<id>/<aba>`) e `carreiraConsultor` (`/carreira/consultor/<id>/<aba>`, que só abre de verdade no PR 4). `carreira` entra em `RESERVED_TENANT_SLUGS`. Os endereços antigos de `/professores` caem nos novos com replace (`routeDecision`). O parâmetro `ciclo` passa a ser a chave do período (`'2027'` ou `'2027-1'`), validado pelo `periodoPorChave` da trilha da pessoa; na lista, pela trilha escolhida na pílula, ou pela Professor quando a pílula está em todas.

**Telas:** a lista (`ProfessoresView` vira `CarreiraView`) com a pílula Trilha (`trilha` no endereço) e as colunas do mockup; o "Trilha e nível" no lugar do `NivelPopover`, gravando `trilhaId`, `nivel` e `nivelDesde`; o placar (`PlacarDoCiclo`) lendo os números ligados da trilha, com a meta do nível atual, a do próximo nível e a linha "Para Pleno: 55%"; o tempo no nível no cabeçalho; e "Minha carreira" no menu (`sidebarNav`), no lugar do "Meu perfil".

**Contas novas:** a aderência semestral (soma das semanas do período, sem dezembro) e a renovação pela `janelaDaRenovacao`, que o estagiário usa. O `pecasDaAderencia` do semestral de junho e dezembro devolve o segundo período em dois pedaços (junho, e julho a novembro): a conta semestral soma as semanas de todos os pedaços, e não tira a média deles, senão junho pesa o mesmo que os outros cinco meses juntos (achado da revisão do PR 1). Quando a `api/` passar a ler o `periodo.js`, a data precisa vir no horário de Brasília (`api/_horarioDeBrasilia.js`), porque a Vercel roda em UTC.

**Regra:** `carreiraKept()` no ramo do próprio usuário em `stronix_users`, com teste que lê o `firestore.rules`, publicada no console antes do merge.

**Fim do `ciclo.js`:** as telas passam a usar `periodo.js`, e `src/lib/professor/ciclo.js` e o teste dele saem.

## PR 4: perfil do consultor

**Contas novas em `src/lib/carreira/consultor.js`:** `conversaoDoConsultor` (safra por dono, contra a academia, a partir das funções de `src/lib/crm/cohort.js`), `vendasDoConsultor` (`soldContracts` e o vendedor do contrato, em reais ou quantidade, por mês, com o mês em andamento pelos dias corridos), `renovacaoDoConsultor` (`renewalCohort` e `summarizeCohort` com o dono) e `metaDiariaDoConsultor` (dias de meta pelo `metaWeekdays`, até ontem, contra os documentos de `stronix_daily_goal_history`). Cada uma com um teste que compara o mês fechado com a conta do painel de origem. O `carreiraImports.test.js` passa a cobrir o arquivo: se uma conta dos painéis chegar a `crm/scope.js` ou `crm/appointments.js`, ela é copiada como no `conversao.js` do professor, com teste que compara as duas.

**Tela:** `ConsultorPerfilView.jsx`, no desenho do mockup, com as abas Vendas, Renovação, Conversão e Meta diária, e os consultores entrando na lista Carreira.

**Leituras:** os leads pelo `useCrmSources` com os meses do período e `stronix_daily_goal_history` pelo `date` (lista) e pelo `consultantId` (perfil), as duas em campo único.

## Depois de cada PR

- Atualizar o `CLAUDE.md` do Stronilead (o PR 1 cria a seção "Plano de carreira").
- Ao fim de cada PR, sugerir de 3 a 8 ciclos de code review, como pede o `AGENTS.md`.
