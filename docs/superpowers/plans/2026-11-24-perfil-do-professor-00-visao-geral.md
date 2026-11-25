# Perfil do professor e NPS: visão geral dos PRs

> **Para agentes:** este é o plano mestre. Ele diz a ordem, o que cada PR entrega e o que fecha cada um. O passo a passo de cada PR fica num plano próprio, escrito quando o PR começar, sobre o código daquele dia. Para executar um plano de PR, use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans.

**Objetivo:** o perfil do professor no Stronilead, com os quatro critérios do plano de carreira (renovação, NPS, conversão e aderência) e a pesquisa de NPS que o aluno responde pelo CPF, pronto e testado até maio de 2027.

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`.

**Stack:** React 19, Vite, Tailwind v4, shadcn/ui, React Router 7 sem `<Routes>`, Firebase (Firestore e Auth), funções da Vercel em `api/` com Firebase Admin. JavaScript, sem TypeScript. Testes com Vitest.

---

## Regras que valem para todos os PRs

- Cada PR sai de um `git fetch` e do `origin/main` do dia (a `main` local fica atrás). Rode `npm ci` e confira que o `package-lock.json` não mudou.
- Linha de base antes de mexer e conferência antes do PR: `npm run lint && npm test && npm run verificar:sentry && npm run build`.
- Tela ou rota nova fica atrás do módulo `faltosos` (o "Stronix 2.0"), com `hasModule(appUser?.tenantModules, MODULES.FALTOSOS)` no app e `hasModule(tenant, MODULES.FALTOSOS)` na `api/`.
- PR que muda `firestore.rules` só entra depois de o Johnny publicar as regras no console.
- Não fazer push nem abrir PR sem o pedido do Johnny. Merge só com a aprovação dele.
- Texto de tela em português, direto, sem travessão no meio da frase e sem jargão. UI nova começa pela skill `frontend-design`.
- Ao fim de cada PR, atualizar a seção "Perfil do professor" do `CLAUDE.md` do Stronilead com as regras que o PR criou, e sugerir de 3 a 8 rodadas de code review com o motivo de cada uma.

## Os PRs

### PR 1: histórico de troca de professor

**Plano:** `docs/superpowers/plans/2026-11-24-perfil-do-professor-01-historico.md` (pronto).

Entrega `src/lib/professorHistory.js` (`professorChangePatch` e `professorAt`), os três caminhos que gravam o professor do lead passando por ele (Contexto comercial da ficha, carimbo da conversão em `markConvertingAula` e preenchimento da importação de clientes) e uma varredura que reprova gravação nova de `professorId` sem revisão.

Não muda regra do Firestore. Grava em toda academia, sem tela.

**Fecha quando:** os testes passam, a varredura está no CI e o PR entrou na main. Cada dia sem ele é um dia sem histórico para a regra dos 90 dias.

### PR 2: as contas

**Plano:** `docs/superpowers/plans/2026-11-25-perfil-do-professor-02-contas.md` (pronto).

Funções puras em `src/lib/professor/`, sem tela:

- `carteiraAt(leads, contracts, planos, professor, data)`: os alunos do professor na data, com contrato de plano da modalidade dele.
- `renovacaoDoCiclo(...)`: renovados ÷ venceram no ciclo de dezembro a novembro, com a regra dos 90 dias (troca de professor registrada no `professorHistory`), o `neverTookEffect` de fora e `liveRenewalOf` como renovado. Sem amostra mínima e sem recuo para anos anteriores. Antes de escrever, ler a conta da taxa de renovação do Operacional (`src/lib/operacional/`) e reusar a regra do cancelado. Um teste compara as duas.
- `conversaoDoCiclo(...)`: pessoas que vieram ÷ matriculadas, cada lead uma vez por professor, sobre os registros de aula de `stronix_aulas` (freepass e aula experimental são o mesmo registro). Não reusa o `professorRowsOf`, que conta registros. Matrícula só com contrato pago (valor acima de zero, não importado, fora o `neverTookEffect`). Aula dos últimos 30 dias fora (janela da configuração). Aviso de registros incompletos antes de `APPTS_COMPLETE_MONTH`. A mesma conta sobre a academia inteira (pelo total) dá a referência. Passa quem fica acima da academia menos a tolerância (configuração, valor 0; empate não passa). Sem mínimo de pessoas.
- `npsDe(totais, turma, { meta })`: média por pergunta (soma ÷ respostas), porcentagem de promotores e NPS clássico como informação, validade (≥ 50% da turma e ≥ 10 respostas) e se a média da pergunta principal bate a meta (9). `npsDoAno(pesquisas)`: média das notas das pesquisas válidas do ciclo.
- `aderenciaPorSemana(presencas, carteira, contratos, { barra })`: a taxa de cada semana, separada (aderentes ÷ alunos que contam), sem semana trancada nem a primeira do contrato, com quantos tiveram 1 presença e quantos nenhuma. A barra vem da configuração (2). `aderenciaDoSemestre(...)`: aluno-semanas aderentes ÷ aluno-semanas que contam no semestre (janeiro a junho e julho a dezembro; na avaliação de dezembro, o segundo conta até 30 de novembro; as semanas de dezembro ficam fora). `aderenciaDoAno(...)`: média dos semestres fechados do ciclo.

Os arquivos não importam pacote nem tela, porque a `api/` do PR 5 lê a carteira. Um teste de importação trava isso, no molde do `rotinasImports.test.js`.

**Fecha quando:** cada caso da seção "Testes" da spec tem teste e todos passam.

### PR 3: lista e perfil

**Plano:** `docs/superpowers/plans/2026-11-25-perfil-do-professor-03-lista-e-perfil.md` (pronto). Lista no desenho A, escolhido pelo Johnny em 25/11/2026.

- O rótulo "Stronix 2.0" no `TenantModulesCard.jsx`.
- `SCREENS.professores` em `src/lib/routes.js`, com as sub-telas `pesquisas` e `metas` e o perfil em `perfil/<id>/<aba>`, lido à parte como o modelo de rotina. `professores` entra em `RESERVED_TENANT_SLUGS`. O id do professor ganha expressão no `sentryScrub.js`.
- Menu: "Professores" para o gestor e "Meu perfil" para o professor, pelo `sidebarNav`, e o `canOpenScreen` deixa o professor abrir só o próprio perfil.
- `stronix_professores` ganha `nivel`, `nivelDesde`, `npsCode` e a foto (`photoUrl` e `photoPath`, pelo processamento do `leadPhoto.js` e o `PhotoCaptureMenu`, em `tenants/<academia>/professores/<id>/avatar.jpg`). A regra nova do Storage para esse caminho é publicada no console antes do merge. `stronix_config/carreira` guarda as metas de renovação por nível, a barra (2) e a faixa (60% a 70%) da aderência e, da conversão, a janela (30 dias) e a tolerância (0), a meta do NPS (9). Só a renovação tem meta por nível.
- A lista, as metas e o perfil com as abas Carteira e Aulas experimentais. O ciclo vai no endereço pela tabela do `screenParams.js`.
- O perfil segue o mockup B (`docs/superpowers/specs/mockups/2026-11-24-perfil-professor-b.html` e `-b-professor.html`, na branch `claude/mockup-perfil-professor-1d3637`, que precisa entrar neste PR). A lista de professores e as metas ainda pedem mockup antes.

**Fecha quando:** a tela abre no preview com dados de teste, as varreduras (link de ficha, filtros no endereço, `acessoSweep`, anel de foco) passam e o professor sem módulo não vê nada.

### PR 4: pesquisa por dentro

- Coleções `stronix_nps_pesquisas`, `stronix_nps_respostas` e `stronix_nps_totais` e as regras (o professor lê só os próprios totais; resposta e total só pelo servidor).
- A sub-tela de pesquisas (criar, abrir com a turma de cada professor, encerrar), o link e o QR code no perfil e a aba NPS.
- Teste das regras ao lado do `professorRules.test.js`.

**Fecha quando:** o Johnny publicou as regras, os testes passam e uma pesquisa de teste abre e fecha no preview.

### PR 5: página pública

- Antes de começar, com o OK do Johnny: uma contagem só de leitura de quantos clientes do funcional têm CPF no cadastro, sem listar CPF.
- As ações `nps-info` (com a foto e o primeiro nome do professor; o link inválido não devolve nenhum dos dois), `nps-check` e `nps-answer` na `api/tenant-resolve.js`, com limite largo por IP e limite por link, piso de tempo e erro sem CPF no Sentry. O `verificar:sentry` ganha o CPF entre os valores plantados.
- A página `/avaliar/<academia>/<código>` decidida no `App()`, fora do roteador, com `ScreenErrorBoundary`. `avaliar` entra em `RESERVED_TENANT_SLUGS`.
- Testes da rota com o banco falso que imita o SDK de servidor e testes de comportamento da página em jsdom.

**Fecha quando:** todos os casos da rota pública da spec têm teste e uma resposta de teste aparece nos totais no preview.

### PR 6: aderência

- O script `scripts/import-presencas.js`: lê o relatório de Presenças da Next Fit (aula de funcional), soma por aluno e semana, casa pelo `cpfDigits` e grava `stronix_presencas`. Sem `--apply`, só mostra. Linha sem CPF casado vai para a lista de pendências.
- A regra de `stronix_presencas` (o membro lê, ninguém grava pelo navegador) e a aba Aderência.

**Fecha quando:** o script roda em dry-run sobre um relatório real e a aba mostra o número com dados de teste.

## Datas

PRs 1 a 5 até março de 2027. Abril e maio para testar com a Heloísa e acertar o CPF de quem não tem. Primeira pesquisa em junho de 2027.
