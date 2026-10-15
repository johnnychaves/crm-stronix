# Relatórios de Leads, PR 2 (Visitas e aulas experimentais, Perdas e Leads parados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os Relatórios ganham os três submenus que faltam no relatório de Leads: Visitas e aulas experimentais, Perdas e Leads parados, no mesmo molde da Entrada de leads e da Conversão (barra em cima, números que filtram a lista, recortes, lista de nomes e exportar).

**Architecture:** As contas moram em `src/lib/relatorios/leads/` (`visitas.js`, `perdas.js` e `parados.js`), puras, e chamam as funções do painel CRM. Onde o painel só devolve contagem, a regra de um item vira função própria e a contagem passa a chamá-la, com o resultado de antes (`appointmentRowsOf`, `lossStageOf`, `lossReasonOf`, `openLeadsOf`, `noNextStepOf`). Visitas e aulas e Perdas usam a carga do PR 1 (`useCrmSources` com `reportMonthKeys`); Leads parados é retrato de agora, não pede mês nenhum e lê os leads em aberto que o app já tem (`liveLeads`, o `metaLeads` do App) e as interações do mês ao vivo. O corte de dias de Leads parados mora no endereço (`dias`), e a barra troca o período por ele (`showPeriod` falso). As três telas moram em `src/views/relatorios/`, no molde das duas do PR 1, desenhadas com a skill frontend-design.

**Tech Stack:** React 19, Vite, Tailwind v4 (tokens semânticos, `cn()`), shadcn (`Select`), React Router 7 (`useScreenParams`), Vitest em node com `renderToString` e em jsdom nos testes de comportamento, ESLint com react-hooks v7.

Spec: `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md`. Plano do PR 1: `docs/superpowers/plans/2026-10-09-relatorios-de-leads-pr1.md`.

Todo o código deste plano foi montado e rodado numa cópia do branch `claude/relatorios-de-leads` em `593ba16`, a cabeça do PR #258: a suíte passou de 239 arquivos e 5.143 testes para 243 arquivos e 5.202 testes, no fuso local e em `TZ=UTC`, com o lint sem erro e o build ok.

---

## Perguntas para o Johnny

Cada pergunta traz a recomendação, e o plano já segue a recomendação. Se a resposta for outra, a task indicada diz o que muda.

1. **Visitas e aulas: "A acontecer" e o mês em andamento.** O painel CRM conta, no mês em andamento, só os agendamentos de data já passada ("No mês em andamento, entram só as de data já passada", `src/lib/crm/texts.js`). A spec pede "a acontecer" entre os números do topo, o que só existe se o relatório for até o fim do período.
   - **Recomendação:** a lista vai até o fim do período, com os dias que ainda vão acontecer, e Marcados é tudo (vieram + faltaram + sem desfecho + a acontecer). No mês fechado todos os números são os do painel. No mês em andamento, Vieram, Faltaram, Sem desfecho e o comparecimento são os do painel, e Marcados soma os que vão acontecer. Por isso, com o período em andamento, Marcados fica sem variação: o comparado é cortado no mesmo ponto e não tem os agendamentos que ainda vão acontecer, e a variação sairia sempre para cima. Uma frase embaixo dos números diz isso.
   - **Outra saída:** comparar Marcados com o período anterior inteiro. Muda só a linha `delta: period.running ? null : delta('total')` em `visitas.js` (Task 6).
2. **Visitas e aulas: unidade, modalidade e professor.** A spec pede os recortes "unidade e modalidade" e as colunas unidade, modalidade e professor para todo agendamento. No registro de `stronix_aulas`, só a visita guarda a unidade e só a aula guarda a modalidade e o professor (`src/lib/aulasWrites.js`, `buildSchedulePatch` e `api/_zapSchedule.js`, que recusa unidade em aula).
   - **Recomendação:** "Por unidade" conta só as visitas e "Por modalidade" só as aulas, e cada cartão diz isso numa linha. Na lista, a célula do que não se aplica é um traço, que o leitor de tela lê como "não se aplica". Nenhum dado novo é gravado.
3. **Visitas e aulas: quando o aviso dos agendamentos incompletos aparece.** A spec diz "período que começa antes de setembro de 2026". A Conversão do PR 1 mostra o aviso quando o período ou o comparado começa antes disso, porque a variação também fica sem base.
   - **Recomendação:** a mesma regra da Conversão (`apptsPartialOf`), com o texto adaptado: "Quando o período ou o comparado começa antes disso, os números ficam sem variação."
4. **Perdas: a etapa no período que atravessa 14/09/2026.** A spec diz que esse período "mostra a parte coberta, com o aviso de parcial". O card do painel conta a etapa de todas as perdas do mês e põe em "Sem etapa" as que não têm a troca gravada, para o motivo e a etapa somarem o mesmo total (`lossStagesOf`). Mostrar só a parte coberta deixaria o relatório diferente do painel em setembro de 2026.
   - **Recomendação:** a conta do painel (todas as perdas, as de antes de 14/09 em "Sem etapa"), com o aviso de parcial no cartão. O período que acaba antes de 14/09/2026 fica sem base na etapa.
5. **Leads parados: de onde sai "dias na etapa".** O lead guarda a entrada na etapa (`statusEnteredAt`) desde 14/09/2026, em toda troca de etapa e no cadastro, menos no lead da indicação pelo link público (`api/tenant-resolve.js`), que não grava o campo.
   - **Recomendação:** a entrada gravada; sem ela, o cadastro, quando ele é de 14/09/2026 em diante; e, no lead que não troca de etapa desde antes disso, o texto "antes de 14/09". Nenhum dado é gravado.
6. **Leads parados: a régua dos dias sem registro.** A spec diz "sem nada registrado na ficha há mais de N dias (`lastInteractionAt`)".
   - **Recomendação:** a régua do selo "N dias sem contato" do Pipeline (`getDaysSinceFromDate` com `lastInteractionDateOf`): dias inteiros de 24 horas desde o último registro, que é o maior entre o campo do lead e as interações do mês que chegam ao vivo (a marca de desfecho não atualiza o campo); sem registro nenhum, conta do cadastro. Entra no número quem tem mais de N dias, então o mesmo lead diz o mesmo número no card do Pipeline e no relatório.
7. **Leads parados: o número grande.** A spec lista três números e diz que a lista sem recorte mostra cada lead uma vez.
   - **Recomendação:** o número grande é essa lista sem recorte ("4 leads parados"), com a base ao lado ("de 210 em aberto agora", que é o total da carteira de agora do painel), e os três números embaixo, cada um filtrando a lista. Uma frase diz que um lead pode estar em mais de um número.
8. **A data do balão "Novo".** O balão vermelho do item Relatórios some em 15/11/2026 (`NOVO_ATE`, em `src/views/relatorios/RelatoriosNovo.jsx`). O texto dele passa a citar os cinco submenus (Task 12).
   - **Recomendação:** se o PR 2 entrar depois de 01/11/2026, levar o `NOVO_ATE` para uns 30 dias depois do merge dele, para os três submenus novos terem o mesmo tempo de balão. A Task 12 diz onde trocar.

## Decisões de arquitetura

1. **As mesmas contas do painel CRM.** Nenhuma regra é copiada. O painel ganha só as saídas por item que o relatório precisa, e as contagens dele passam a somar essas saídas, com o resultado de antes:
   - `appointmentRowsOf` (`src/lib/crm/appointments.js`): os agendamentos que o `appointmentsOf` conta, um por um, com o lead e o status que vale;
   - `isSoloTrainingRecord` (mesmo arquivo): a regra do "Treina sozinho" do cartão de professores;
   - `lossReasonOf` (`src/lib/crm/cohort.js`): o motivo como o card de perdas agrupa;
   - `lossStageOf` (`src/lib/crm/stages.js`): a etapa da perda de um lead, que o `lossStagesOf` soma;
   - `openLeadsOf` e `noNextStepOf` (mesmo arquivo): os leads em jogo e o "sem próximo passo" da carteira de agora, que o `pipelineNowOf` passa a usar;
   - `getDaysSinceFromDate` (`src/lib/leadStatus.js`) aceita o instante de quem calcula, com o `Date.now()` de padrão.
2. **Equivalência.** Os testes comparam cada submenu com o `metricsOf` do painel, para cada pessoa e cada funil: Visitas e aulas com o `appts` (no mês fechado, igual; no mês em andamento, igual menos Marcados, que soma os que vão acontecer), Perdas com o `losses` e o `lossStages`, e Leads parados com o `now` (`total` e `noNext`).
3. **Carga.** Visitas e aulas e Perdas usam o `reportMonthKeys` do PR 1, sem mudança. Leads parados passa a lista de meses vazia ao `useCrmSources`, que fica pronto na hora, e lê `liveLeads` e `interactions`, que o App já entrega à tela. Nenhuma consulta nova e nenhum índice.
4. **A janela das Visitas e aulas vai até o fim do período, mas nunca depois do fim do mês atual** (`visitasEndOf`). Os meses que a tela carrega param no mês atual. Pedir o mês seguinte ao `useCrmSources` o carregaria como mês fechado e deixaria essa entrada na memória da sessão, e o `shouldStoreMonthEntry` não deixa trocar entrada fechada por aberta quando o mês vira: o Operacional e o CRM ficariam presos carregando na virada do mês. Só a "Esta semana" que atravessa o fim do mês perde os dias do mês seguinte.
5. **O desfecho marcado antes da hora já conta.** A Agenda de hoje deixa marcar o desfecho antes do horário. O relatório decide pelo status: com desfecho, é Veio ou Faltou; sem desfecho, a data diz se ficou sem desfecho (já passou) ou se vai acontecer. O painel só conta esse agendamento depois da hora, então os dois podem diferir por algumas horas no mesmo dia.
6. **O corte de dias de Leads parados** (`dias`: 3, 7, 15 ou 30, e o 7 não é escrito) mora na tabela do endereço, em `src/lib/screenParams.js`, com `DIAS_PARADOS` e `DIAS_PARADOS_PADRAO`. Mora lá, e não em `src/lib/relatorios/`, porque a conta de Leads parados importa o `dailyGoal.js`, que traz o `lucide-react`, e o `screenParams.js` é puro. Ele anda junto ao trocar de submenu, como os filtros da barra; os outros submenus o ignoram. O período continua no endereço em Leads parados, que o ignora, para a pessoa voltar à Entrada no mesmo período.
7. **As três telas** seguem as do PR 1: `ReportHeader`, `HeroNumber`, `NumberTiles`, `CountBreakdown`, `ReportList`, `ReportNotice` e `CellText`. A única peça nova é o `DiasControl` da barra. O `NumberTiles` ganha `className`, para quem tem menos de seis números não deixar coluna vazia.

## Pontos que o plano decidiu

- Os ids e segmentos dos submenus são os da spec: `visitas-e-aulas`, `perdas` e `parados`. Nenhum é primeiro segmento de endereço, então nenhum entra em `RESERVED_TENANT_SLUGS` (o `tenantSlug.test.js` só cobra o primeiro segmento). O parâmetro novo, `dias`, não é `invite`, `t` nem `ref`.
- Texto curto de cada item da lista ao lado: "Quem veio e quem faltou", "Por que e onde se perderam" e "Quem precisa de um próximo passo".
- Visitas e aulas: o número grande é o comparecimento (verde, com a variação em pontos), como a conversão na Conversão. Os números do topo são Marcados (o total da lista), Vieram, Faltaram, Sem desfecho e A acontecer. Faltaram e Sem desfecho usam `lowerBetter`. A acontecer não tem variação, como Em aberto.
- Visitas e aulas: a lista tem um agendamento por linha (o mesmo lead pode ter visita e aula no período), em ordem de data, e o link vai para a ficha do lead. O consultor é o dono de hoje do lead, como no painel. O registro de um lead que não existe mais entra na equipe toda, com o nome do registro e "Sem responsável".
- Perdas: o número grande não leva cor (um zero vermelho diria que algo deu errado) e a variação usa `lowerBetter`. A lista diz o dia da perda e há quanto tempo, em dias do calendário (`calendarDaysBetween`), e a planilha leva os dois em colunas separadas.
- Perdas: o aviso fixo diz o fato, sem prometer o futuro: "Esta conta mostra só quem continua perdido hoje. Quando um lead perdido volta ao funil ou matricula, o sistema apaga a data e o motivo da perda, e ele sai daqui." O `planStageMove` e o `commitMatricula` apagam `lostAt` e `lossReason`, e o `lossesOf` só conta quem está em Perda hoje.
- Leads parados: o atraso é o do Atrasado da Meta (`overdueDaysOf`) e fica com o dono do lead mesmo com o contato delegado, como lá. A lista vai de quem está há mais dias sem registro para quem está há menos. A planilha leva os dias em colunas próprias (dias na etapa, dias sem registro, dias de atraso).
- Nomes dos arquivos: `leads-visitas-e-aulas-<início>-a-<fim da lista>.csv` (a lista vai até o fim do período), `leads-perdas-<início>-a-<último dia>.csv` e `leads-parados-<hoje>.csv`.
- A data em que a etapa passou a ser gravada sai de uma constante só (`STAGE_SINCE_TEXT`, em `base.js`, do `STAGE_TRACKING_SINCE` do painel).

## Ordem com os PRs #258, #256 e #257

- **Este PR começa depois do merge do #258** (PR 1). O branch `claude/relatorios-de-leads-pr2` nasceu da cabeça do #258 (`593ba16`). A Task 0 confere o merge e traz a `main`.
- **#256 (fundo das barras no tema escuro) e #257 (borda, animação e foco dos balões)** podem entrar antes. Os dois corpos listam o que a branch dos Relatórios precisa trocar. Se algum entrou na `main` e a `main` ainda não traz as trocas nos arquivos dos Relatórios, a Task 0 as aplica num commit próprio:
  - **#256:** em `src/views/relatorios/RelatoriosToolbar.jsx`, na linha da barra fixa, trocar `bg-paper-50` e `dark:bg-neutral-950` por um `bg-page` só, e acertar o comentário de cima. Em `src/lib/__tests__/relatoriosBarra.behavior.test.js`, no bloco "fundo da barra fixa", trocar `expect(fundo).toContain('bg-paper-50')` e `expect(fundo).toContain('dark:bg-neutral-950')` por `expect(fundo.split(/\s+/)).toContain('bg-page')` e `expect(fundo).not.toContain('dark:bg-')`, e a conferência da raiz do App por `/<div className="flex h-\[100dvh\] bg-page(?=[\s"])/`.
  - **#257:** em `src/components/focusRing.js`, `export const FOCUS_RING = 'outline-none focus-visible:anel-foco';`. No `ExportButton` (`src/views/relatorios/ReportParts.jsx`), que é `bg-brand-600`, juntar `focus-visible:ring-offset-2 focus-visible:ring-offset-background` às classes. Depois, `grep -rn "ring-brand-500/40" src` não pode achar nada nos Relatórios nem no `PeriodControl`.
- O código novo deste plano usa o `FOCUS_RING` e não pinta barra fixa, então nada dele muda com o #256 ou o #257.
- O corpo do #258 deixa pontos para o Johnny decidir (Em aberto sem variação, a lista larga em 1280 pixels, a barra quebrando com consultor escolhido, a rolagem ao trocar de submenu e o apóstrofo do "+55" na planilha). Se a resposta mudar uma peça dividida (`NumberTiles`, `ReportList`, `csvExport.js`), o PR 2 herda a mudança ao trazer a `main`. Confira na Task 0 se algo deles mudou antes de começar.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/crm/appointments.js` | Modificar | `appointmentRowsOf` e `isSoloTrainingRecord`; `appointmentsOf` e `professorsOf` passam a usá-las |
| `src/lib/__tests__/crm.appointments.test.js` | Modificar | Agendamentos um por um e treina sozinho |
| `src/lib/crm/cohort.js` | Modificar | `lossReasonOf`; `lossesOf` passa a usá-la |
| `src/lib/__tests__/crm.cohort.test.js` | Modificar | Motivo da perda |
| `src/lib/crm/stages.js` | Modificar | `lossStageOf`, `openLeadsOf` e `noNextStepOf`; `lossStagesOf` e `pipelineNowOf` passam a usá-las |
| `src/lib/__tests__/crm.stages.test.js` | Modificar | Etapa da perda de um lead, leads em jogo e sem próximo passo |
| `src/lib/leadStatus.js` | Modificar | `getDaysSinceFromDate` aceita o instante |
| `src/lib/__tests__/leadStatus.test.js` | Modificar | O instante de quem calcula |
| `src/lib/relatorios/leads/base.js` | Modificar | `freshLeadsOf`, `countRows` (vinda da Entrada), `apptsPartialOf` (vinda da Conversão), prefixos novos do recorte, dia e hora, `STAGE_SINCE_TEXT` e `snapshotFileName` |
| `src/lib/relatorios/leads/entrada.js` | Modificar | `countRows` sai daqui |
| `src/lib/relatorios/leads/conversao.js` | Modificar | `apptsPartialOf` sai daqui |
| `src/lib/relatorios/leads/janela.js` | Modificar | O índice ganha as trocas de etapa (`moves`) |
| `src/lib/__tests__/relatoriosLeads.base.test.js` | Modificar | As peças novas da base |
| `src/lib/__tests__/relatoriosLeads.janela.test.js` | Modificar | O índice com as trocas |
| `src/lib/__tests__/relatoriosLeads.conversao.test.js` | Modificar | Importa o `apptsPartialOf` da base |
| `src/lib/screenParams.js` | Modificar | `dias`, `DIAS_PARADOS` e `DIAS_PARADOS_PADRAO` |
| `src/lib/__tests__/screenParams.test.js` | Modificar | O corte de dias |
| `src/lib/__tests__/filtrosNoEndereco.sweep.test.js` | Modificar | `dias` proibido em `key` e `setDias` proibido em estado |
| `src/lib/relatorios/leads/visitas.js` | Criar | Conta das Visitas e aulas experimentais |
| `src/lib/__tests__/relatoriosLeads.visitas.test.js` | Criar | Testes e equivalência das Visitas e aulas |
| `src/lib/relatorios/leads/perdas.js` | Criar | Conta das Perdas |
| `src/lib/__tests__/relatoriosLeads.perdas.test.js` | Criar | Testes e equivalência das Perdas |
| `src/lib/relatorios/leads/parados.js` | Criar | Conta dos Leads parados |
| `src/lib/__tests__/relatoriosLeads.parados.test.js` | Criar | Testes e equivalência dos Leads parados |
| `src/views/relatorios/ReportParts.jsx` | Modificar | `NumberTiles` aceita `className` |
| `src/lib/__tests__/relatoriosParts.test.js` | Modificar | A grade dos números |
| `src/views/relatorios/RelatoriosToolbar.jsx` | Modificar | `DiasControl` e `showPeriod` |
| `src/lib/__tests__/relatoriosBarra.test.js` | Modificar | A barra sem período |
| `src/lib/__tests__/relatoriosBarra.behavior.test.js` | Modificar | O corte de dias em uso |
| `src/lib/__tests__/focusRing.test.js` | Modificar | O anel no corte de dias e os cinco itens da lista ao lado |
| `src/views/relatorios/VisitasSection.jsx` | Criar | Tela das Visitas e aulas experimentais |
| `src/views/relatorios/PerdasSection.jsx` | Criar | Tela das Perdas |
| `src/views/relatorios/ParadosSection.jsx` | Criar | Tela dos Leads parados |
| `src/lib/routes.js` | Modificar | `RELATORIOS_SUBS` com os cinco submenus |
| `src/lib/relatoriosRail.js` | Modificar | Os três itens novos da lista ao lado |
| `src/views/relatorios/RelatoriosView.jsx` | Modificar | Contas e telas por submenu, carga sem mês em Leads parados, corte de dias, nome do arquivo |
| `src/lib/__tests__/routes.test.js` | Modificar | Os cinco submenus |
| `src/lib/__tests__/relatoriosRail.test.js` | Modificar | Os cinco itens |
| `src/lib/__tests__/relatoriosSubmenus.behavior.test.js` | Criar | Os três submenus na tela, em jsdom |
| `src/views/relatorios/RelatoriosNovo.jsx` | Modificar | O balão cita os cinco submenus |
| `CLAUDE.md` | Modificar | Seção "Relatórios" |

Nada a publicar no Firestore: nenhuma consulta nova, nenhum índice e nenhuma regra. O `App.jsx` não muda: ele já entrega à tela os leads em aberto (`liveLeads={metaLeads}`) e as interações do mês (`interactions`).

**Atenção à varredura dos filtros.** Esta entrega põe `dias` na lista de nomes proibidos em `key` (Task 5). A varredura lê cada linha que tem `key={` e reprova a palavra inteira `dias` em qualquer lugar da linha. Nos arquivos novos, nenhuma linha com `key={` pode ter a palavra "dias", nem num texto: por isso o `SelectItem` do `DiasControl` põe o texto em outra linha.

---

### Task 0: Pré-requisitos, branch e linha de base

**Files:** nenhum, a não ser as trocas do #256 e do #257 (Step 3).

- [ ] **Step 1: Conferir que o PR 1 entrou e trazer a `main`**

Run:
```bash
git branch --show-current
gh pr view 258 --json state,mergeCommit
git fetch origin
git merge origin/main
```
Expected: `claude/relatorios-de-leads-pr2`, o #258 com `"state":"MERGED"` e o merge sem conflito. Se o #258 ainda estiver aberto, pare e avise o controlador: este PR começa depois dele. Se o merge der conflito, pare e avise.

- [ ] **Step 2: Conferir o que o PR 1 mudou depois de `593ba16`**

Run:
```bash
git diff 593ba16 HEAD --stat -- src/lib/relatorios src/views/relatorios src/lib/crm src/lib/screenParams.js src/lib/routes.js src/lib/relatoriosRail.js
```
Expected: só o que o #258 acrescentou depois de `593ba16` e o que o #256 e o #257 trocaram. Os trechos "troque isto" deste plano saem de `593ba16`. Se um trecho não bater mais, abra o arquivo, ache o mesmo lugar e faça a mesma troca nele, sem desfazer o que mudou.

- [ ] **Step 3: Aplicar as trocas do #256 e do #257, se eles entraram e a `main` ainda não as fez**

Run:
```bash
grep -n "bg-page" src/index.css | head -3
grep -n "@utility anel-foco" src/index.css
grep -n "bg-paper-50" src/views/relatorios/RelatoriosToolbar.jsx
grep -n "ring-brand-500/40" src/components/focusRing.js
```
- Com `bg-page` no `index.css` e `bg-paper-50` ainda na barra dos Relatórios, faça as trocas do #256 listadas em "Ordem com os PRs", acima.
- Com `@utility anel-foco` no `index.css` e o anel antigo ainda no `focusRing.js`, faça as trocas do #257 listadas lá.
- Rode `npx vitest run src/lib/__tests__/relatoriosBarra.behavior.test.js src/lib/__tests__/focusRing.test.js` e confira que passam. Se não precisou trocar nada, pule o commit.

```bash
git add src/views/relatorios/RelatoriosToolbar.jsx src/lib/__tests__/relatoriosBarra.behavior.test.js src/components/focusRing.js src/views/relatorios/ReportParts.jsx
git commit -m "fix: Relatórios com o fundo e o anel de foco da main" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Instalar dependências**

O `node_modules` do worktree pode faltar ou ficar para trás da `main`.

Run:
```bash
npm ci
git status --short
```
Expected: nenhuma mudança em `package-lock.json`. Se ele mudar, `git checkout package-lock.json` e avise o controlador.

- [ ] **Step 5: Linha de base**

Run:
```bash
npx vitest run
npm run lint
```
Expected: todos os testes passando e o lint com `0 errors` (o aviso que já existia no `SuperAdminView.jsx` continua). Anote os totais de arquivos e de testes como `B_ARQ` e `B_TESTES`: cada task diz quantos testes ela acrescenta. Em `593ba16` eram 239 arquivos e 5.143 testes.

---
### Task 1: Agendamentos um por um e o treina sozinho (`appointments.js`)

**Files:**
- Modify: `src/lib/crm/appointments.js` (`appointmentsOf`, linhas 109 a 140, e `professorsOf`)
- Test: `src/lib/__tests__/crm.appointments.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/crm.appointments.test.js`, troque o import do topo:

```js
import {
  appointmentsOf, recordsByLeadOf, cohortMilestones, cohortMilestoneOf, professorsOf, visitOutcomesByLead, effectiveStatus
} from '../crm/appointments.js';
```

por:

```js
import {
  appointmentsOf, appointmentRowsOf, recordsByLeadOf, cohortMilestones, cohortMilestoneOf, professorsOf, visitOutcomesByLead,
  effectiveStatus, isSoloTrainingRecord
} from '../crm/appointments.js';
```

E acrescente ao fim do arquivo:

```js
describe('agendamentos do mês, um por um', () => {
  const recs = [
    R('1', { status: 'attended' }),
    R('2', { status: 'no_show', leadId: 'b' }),
    R('3', { status: 'agendada', type: 'visita' }),
    R('4', { status: 'cancelled' }),
    R('5', { status: 'attended', scheduledFor: D(9, 20) }),
    R('1', { status: 'attended' })
  ];

  it('os mesmos registros que a contagem, com o lead e o status que vale', () => {
    const rows = appointmentRowsOf(recs, { ...WIN, leadOf, inScope: all });
    expect(rows.map((x) => [x.record.id, x.lead.id, x.status])).toEqual([
      ['1', 'a', 'attended'], ['2', 'b', 'no_show'], ['3', 'a', 'agendada']
    ]);
    expect(appointmentsOf(recs, { ...WIN, leadOf, inScope: all }).total).toBe(rows.length);
  });

  it('a visita leva o desfecho da linha do tempo, como na contagem', () => {
    const visitOutcomes = visitOutcomesByLead([{
      id: 'g1', leadId: 'a', type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', appointmentOutcome: 'attended', createdAt: D(9, 2, 18)
    }]);
    const rows = appointmentRowsOf([R('3', { type: 'visita' })], { ...WIN, leadOf, inScope: all, visitOutcomes });
    expect(rows.map((x) => x.status)).toEqual(['attended']);
  });
});

describe('treina sozinho', () => {
  it('a aula com a marca, ou sem professor', () => {
    expect(isSoloTrainingRecord({ soloTraining: true, professorId: 'p1' })).toBe(true);
    expect(isSoloTrainingRecord({ professorId: null })).toBe(true);
    expect(isSoloTrainingRecord({ professorId: 'p1' })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.appointments.test.js`
Expected: FAIL, com `appointmentRowsOf is not a function` e `isSoloTrainingRecord is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/crm/appointments.js`, troque a função `appointmentsOf` inteira (a assinatura e o corpo, do `export function appointmentsOf(records, { start, end, leadOf, inScope, visitOutcomes = null }) {` até o `}` que fecha a função, logo antes do comentário "// Registros por lead, sem repetir id"; o comentário de cima dela fica) por:

```js
export function appointmentsOf(records, opts) {
  let came = 0;
  let missed = 0;
  let pending = 0;
  appointmentRowsOf(records, opts).forEach(({ status }) => {
    if (status === AULA_STATUS.ATTENDED) came += 1;
    else if (status === AULA_STATUS.NO_SHOW) missed += 1;
    else pending += 1;
  });
  const decided = came + missed;
  return { total: came + missed + pending, came, missed, pending, decided, rate: pct(came, decided) };
}

// Os agendamentos que o appointmentsOf conta, um por um, na regra dele
// (comentário acima): o registro, o lead do registro e o status que vale. Os
// Relatórios mostram a lista, e a contagem do painel soma o que esta função
// devolve.
export function appointmentRowsOf(records, { start, end, leadOf, inScope, visitOutcomes = null }) {
  const out = [];
  const seen = new Set();
  (records || []).forEach((r) => {
    if (!r?.id || seen.has(r.id)) return;
    seen.add(r.id);
    if (!inWindow(r.scheduledFor, start, end)) return;
    const lead = leadOf(r.leadId);
    const status = effectiveStatus(r, visitOutcomes, lead);
    if (status === AULA_STATUS.CANCELLED) return;
    if (!inScope(lead)) return;
    const enrolledAt = firstEnrolledAtOf(lead);
    if (enrolledAt && r.scheduledFor >= enrolledAt) return;
    out.push({ record: r, lead, status });
  });
  return out;
}
```

Logo antes do comentário "// Aulas experimentais por professor, da academia inteira (spec §4): registros", acrescente:

```js
// Aula de quem treina sozinho: com a marca, ou sem professor. É o "Treina
// sozinho" do cartão de professores (professorsOf) e da lista dos Relatórios.
export const isSoloTrainingRecord = (r) => Boolean(r?.soloTraining || !r?.professorId);

```

E, dentro de `professorsOf`, troque `    if (r.soloTraining || !r.professorId) {` por `    if (isSoloTrainingRecord(r)) {`.

- [ ] **Step 4: Rodar e ver passar, com o painel igual**

Run: `npx vitest run src/lib/__tests__/crm.appointments.test.js src/lib/__tests__/crm.metrics.test.js`
Expected: PASS. São 3 testes novos, e os do `metricsOf` continuam passando sem edição.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/appointments.js src/lib/__tests__/crm.appointments.test.js
git commit -m "feat: agendamentos do painel CRM um por um, para os Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Motivo e etapa da perda, leads em jogo e sem próximo passo (`cohort.js` e `stages.js`)

**Files:**
- Modify: `src/lib/crm/cohort.js` (`lossesOf`, linhas 80 a 91)
- Modify: `src/lib/crm/stages.js` (`lossStagesOf` e `pipelineNowOf`)
- Test: `src/lib/__tests__/crm.cohort.test.js`, `src/lib/__tests__/crm.stages.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/crm.cohort.test.js`, troque o import do topo:

```js
import {
  newLeadsOf, enrollmentsOf, lossesOf, outcomeAt, channelsOf, daysToEnrollOf, convertedAtOf, clienteSinceOf, firstEnrolledAtOf,
  isImportedEnrollment
} from '../crm/cohort.js';
```

por:

```js
import {
  newLeadsOf, enrollmentsOf, lossesOf, lossReasonOf, outcomeAt, channelsOf, daysToEnrollOf, convertedAtOf, clienteSinceOf,
  firstEnrolledAtOf, isImportedEnrollment
} from '../crm/cohort.js';
```

E acrescente ao fim do arquivo:

```js
describe('motivo da perda', () => {
  it('o texto gravado sem os espaços das pontas, ou Sem motivo, como o card de perdas agrupa', () => {
    expect(lossReasonOf({ lossReason: ' Preço ' })).toBe('Preço');
    expect(lossReasonOf({ lossReason: '' })).toBe('Sem motivo');
    expect(lossReasonOf({})).toBe('Sem motivo');
    expect(lossesOf([{ id: 'p', status: 'Perda', lostAt: D(9, 3), lossReason: ' Preço ' }], { ...SEP, inScope: all }).reasons)
      .toEqual([{ name: 'Preço', count: 1 }]);
  });
});
```

Em `src/lib/__tests__/crm.stages.test.js`, troque a primeira linha de import:

```js
import { isStageMove, movesByLead, stagePassageOf, lossStagesOf, pipelineNowOf } from '../crm/stages.js';
```

por:

```js
import {
  isStageMove, movesByLead, stagePassageOf, lossStagesOf, lossStageOf, pipelineNowOf, openLeadsOf, noNextStepOf
} from '../crm/stages.js';
```

E acrescente ao fim do arquivo:

```js
describe('etapa da perda de um lead', () => {
  it('a mesma etapa da contagem, lead por lead, e Sem etapa sem a troca no mês', () => {
    const win = { moves: MOVES, start: MONTH.start, end: MONTH.end };
    expect(lossStageOf(leadOf('a'), win)).toBe('Agendado');
    expect(lossStageOf(leadOf('b'), win)).toBe('Contato feito');
    expect(lossStageOf({ id: 'z' }, win)).toBe('Sem etapa');
    expect(lossStageOf(leadOf('a'), { ...win, start: T(9, 0) })).toBe('Sem etapa');
  });
});

describe('leads em jogo e sem próximo passo', () => {
  const now = T(15, 12);
  const base = { status: 'Novo lead', funnelId: 'ven', consultantId: 'ana' };
  const live = [
    { ...base, id: 'com-data', nextFollowUp: T(20), createdAt: T(1) },
    { ...base, id: 'sem-data', nextFollowUp: null, createdAt: T(13, 12) },
    { ...base, id: 'novo', nextFollowUp: null, createdAt: T(15, 1) },
    { ...base, id: 'sem-cadastro', nextFollowUp: null, createdAt: T(15, 11), createdAtMissing: true },
    { ...base, id: 'cliente', status: 'Venda', isConverted: true, createdAt: T(1) },
    { ...base, id: 'diego', consultantId: 'diego', nextFollowUp: null, createdAt: T(1) },
    { ...base, id: 'com-data', nextFollowUp: T(20), createdAt: T(1) }
  ];

  it('os leads em jogo são os da carteira de agora: balde ativo, sem repetir, no recorte', () => {
    expect(openLeadsOf(live, { ownerOk: all, funnelOk: all }).map((l) => l.id))
      .toEqual(['com-data', 'sem-data', 'novo', 'sem-cadastro', 'diego']);
    expect(openLeadsOf(live, { ownerOk: (l) => l.consultantId === 'diego', funnelOk: all }).map((l) => l.id)).toEqual(['diego']);
  });

  it('sem próximo passo: sem próximo contato e fora das 24 horas do cadastro, e o sem data de cadastro conta', () => {
    const open = openLeadsOf(live, { ownerOk: all, funnelOk: all });
    expect(open.filter((l) => noNextStepOf(l, now)).map((l) => l.id)).toEqual(['sem-data', 'sem-cadastro', 'diego']);
    // Sem o instante, ninguém está coberto pela Meta.
    expect(noNextStepOf(live[2])).toBe(true);
  });

  it('a carteira de agora conta o mesmo que as duas funções', () => {
    const r = pipelineNowOf(live, { funnelId: null, funnels: [], defaultFunnelId: 'ven', stages: [], ownerOk: all, funnelOk: all, now });
    const open = openLeadsOf(live, { ownerOk: all, funnelOk: all });
    expect([r.total, r.noNext]).toEqual([open.length, open.filter((l) => noNextStepOf(l, now)).length]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.cohort.test.js src/lib/__tests__/crm.stages.test.js`
Expected: FAIL, com `lossReasonOf`, `lossStageOf`, `openLeadsOf` e `noNextStepOf` que não são função.

- [ ] **Step 3: Implementar o motivo**

Em `src/lib/crm/cohort.js`, troque:

```js
// Perdas: quem está em Perda hoje e não é cliente, com lostAt em [start, end),
// por motivo. Perda sem motivo entra em "Sem motivo". A lista vai junto, para a
// etapa da perda sair dos mesmos leads (lossStagesOf).
export function lossesOf(leads, { start, end, inScope }) {
  const list = unique(leads).filter((l) =>
    deriveLeadBucket(l) === 'perda' && inWindow(lostAtOf(l), start, end) && inScope(l));
  return {
    total: list.length,
    reasons: rankCounts(countBy(list, (l) => String(l.lossReason || '').trim() || 'Sem motivo')),
    leads: list
  };
}
```

por:

```js
// O motivo da perda de um lead, como o card de perdas agrupa: o texto gravado,
// sem os espaços das pontas, ou "Sem motivo".
export const lossReasonOf = (l) => String(l?.lossReason || '').trim() || 'Sem motivo';

// Perdas: quem está em Perda hoje e não é cliente, com lostAt em [start, end),
// por motivo (lossReasonOf). A lista vai junto, para a etapa da perda sair dos
// mesmos leads (lossStagesOf).
export function lossesOf(leads, { start, end, inScope }) {
  const list = unique(leads).filter((l) =>
    deriveLeadBucket(l) === 'perda' && inWindow(lostAtOf(l), start, end) && inScope(l));
  return {
    total: list.length,
    reasons: rankCounts(countBy(list, lossReasonOf)),
    leads: list
  };
}
```

- [ ] **Step 4: Implementar a etapa, os leads em jogo e o sem próximo passo**

Em `src/lib/crm/stages.js`, dentro de `lossStagesOf`, troque:

```js
  (lostLeads || []).forEach((l) => {
    const last = (moves.get(l.id) || [])
      .filter((m) => m.toStatus === 'Perda' && m.createdAt >= start && m.createdAt < end)
      .pop();
    const name = String(last?.fromStatus || '').trim() || 'Sem etapa';
    map.set(name, (map.get(name) || 0) + 1);
  });
  return rankCounts(map);
}
```

por:

```js
  (lostLeads || []).forEach((l) => {
    const name = lossStageOf(l, { moves, start, end });
    map.set(name, (map.get(name) || 0) + 1);
  });
  return rankCounts(map);
}

// A etapa da perda de um lead, na regra do lossStagesOf (comentário acima). Os
// Relatórios mostram a etapa lead por lead, e a contagem do painel soma o que
// esta função devolve.
export function lossStageOf(lead, { moves, start, end }) {
  const last = (moves.get(lead.id) || [])
    .filter((m) => m.toStatus === 'Perda' && m.createdAt >= start && m.createdAt < end)
    .pop();
  return String(last?.fromStatus || '').trim() || 'Sem etapa';
}
```

No começo de `pipelineNowOf`, troque:

```js
export function pipelineNowOf(liveLeads, { funnelId, funnels, defaultFunnelId, stages, ownerOk, funnelOk, now = null }) {
  const coveredByMeta = (l) => now instanceof Date && !l.createdAtMissing && l.createdAt instanceof Date
    && now.getTime() - l.createdAt.getTime() < DAY_MS;
  const open = [];
  const seen = new Set();
  (liveLeads || []).forEach((l) => {
    if (!l?.id || seen.has(l.id)) return;
    seen.add(l.id);
    if (deriveLeadBucket(l) === 'ativo' && ownerOk(l) && funnelOk(l)) open.push(l);
  });
  let rows;
```

por:

```js
export function pipelineNowOf(liveLeads, { funnelId, funnels, defaultFunnelId, stages, ownerOk, funnelOk, now = null }) {
  const open = openLeadsOf(liveLeads, { ownerOk, funnelOk });
  let rows;
```

E no fim dela troque:

```js
  return {
    total: open.length,
    rows,
    noNext: open.filter((l) => !getSafeDateOrNull(l.nextFollowUp) && !coveredByMeta(l)).length
  };
}
```

por:

```js
  return {
    total: open.length,
    rows,
    noNext: open.filter((l) => noNextStepOf(l, now)).length
  };
}

// Os leads em jogo da carteira de agora (comentário acima): o balde ativo, sem
// repetir id, no recorte de pessoa e de funil. Os Leads parados dos Relatórios
// partem desta mesma lista.
export function openLeadsOf(liveLeads, { ownerOk, funnelOk }) {
  const open = [];
  const seen = new Set();
  (liveLeads || []).forEach((l) => {
    if (!l?.id || seen.has(l.id)) return;
    seen.add(l.id);
    if (deriveLeadBucket(l) === 'ativo' && ownerOk(l) && funnelOk(l)) open.push(l);
  });
  return open;
}

// Lead em jogo sem próximo passo, na regra da carteira de agora (comentário
// acima): sem nextFollowUp e fora das 24 horas do cadastro, que a Meta ainda
// cobre como "Novo lead 24h". O lead sem data de cadastro conta: a Meta não o
// cobre.
export function noNextStepOf(lead, now = null) {
  if (getSafeDateOrNull(lead?.nextFollowUp)) return false;
  const coveredByMeta = now instanceof Date && !lead.createdAtMissing && lead.createdAt instanceof Date
    && now.getTime() - lead.createdAt.getTime() < DAY_MS;
  return !coveredByMeta;
}
```

- [ ] **Step 5: Rodar e ver passar, com o painel igual**

Run: `npx vitest run src/lib/__tests__/crm.cohort.test.js src/lib/__tests__/crm.stages.test.js src/lib/__tests__/crm.metrics.test.js`
Expected: PASS. São 5 testes novos (1 no cohort e 4 no stages), e os testes que já existiam passam sem edição.

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/cohort.js src/lib/crm/stages.js src/lib/__tests__/crm.cohort.test.js src/lib/__tests__/crm.stages.test.js
git commit -m "feat: motivo, etapa da perda e leads em jogo do painel CRM, lead por lead" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dias sem contato num instante dado (`leadStatus.js`)

**Files:**
- Modify: `src/lib/leadStatus.js` (`getDaysSinceFromDate`)
- Test: `src/lib/__tests__/leadStatus.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/lib/__tests__/leadStatus.test.js`, no `describe('getDaysSinceFromDate')`, logo antes de `  it('retorna null sem nenhuma data utilizável', () => {`, acrescente:

```js
  it('aceita o instante de quem calcula, com a mesma régua', () => {
    const l = lead({ createdAt: ago(30 * DAY_MS) });
    const umDiaDepois = NOW.getTime() + DAY_MS;
    expect(getDaysSinceFromDate(l, ago(3 * DAY_MS), umDiaDepois)).toBe(4);
    expect(getDaysSinceFromDate(lead({ createdAt: ago(10 * DAY_MS) }), null, umDiaDepois)).toBe(11);
  });

```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leadStatus.test.js`
Expected: FAIL: `expected 3 to be 4` (o terceiro argumento ainda é ignorado).

- [ ] **Step 3: Implementar**

Em `src/lib/leadStatus.js`, troque:

```js
const getDaysSinceFromDate = (lead, lastInteractionDate) => {
  const last = (lastInteractionDate instanceof Date ? lastInteractionDate : null) || lead?.createdAt;
  if (!(last instanceof Date) || isNaN(last.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - last.getTime()) / DAY_MS));
};
```

por:

```js
// `nowMs` deixa quem calcula num instante próprio (os Relatórios, com o relógio
// da tela) usar a mesma régua do selo. Sem ele, vale o Date.now().
const getDaysSinceFromDate = (lead, lastInteractionDate, nowMs = Date.now()) => {
  const last = (lastInteractionDate instanceof Date ? lastInteractionDate : null) || lead?.createdAt;
  if (!(last instanceof Date) || isNaN(last.getTime())) return null;
  return Math.max(0, Math.floor((nowMs - last.getTime()) / DAY_MS));
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leadStatus.test.js`
Expected: PASS, 1 teste novo. O selo do Pipeline (`Badges.jsx`) e o `isColdLeadFromDate` chamam sem o terceiro argumento e não mudam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadStatus.js src/lib/__tests__/leadStatus.test.js
git commit -m "feat: dias sem contato aceitam o instante de quem calcula" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: O que os submenus dividem (`base.js` e `janela.js`)

**Files:**
- Modify: `src/lib/relatorios/leads/base.js`, `src/lib/relatorios/leads/entrada.js`, `src/lib/relatorios/leads/conversao.js`, `src/lib/relatorios/leads/janela.js`, `src/views/relatorios/RelatoriosView.jsx` (só o import do `apptsPartialOf`)
- Test: `src/lib/__tests__/relatoriosLeads.base.test.js`, `src/lib/__tests__/relatoriosLeads.janela.test.js`, `src/lib/__tests__/relatoriosLeads.conversao.test.js`

O que muda: a contagem dos recortes (`countRows`) sai da Entrada e o aviso dos agendamentos (`apptsPartialOf`) sai da Conversão, porque as Visitas e aulas, as Perdas e os Leads parados também os usam; a base ganha os leads de qualquer balde (`freshLeadsOf`), os prefixos novos do texto do filtro, o dia e a hora, a data da etapa e o nome do arquivo do retrato de agora; e o índice ganha as trocas de etapa, que dão a etapa da perda.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/relatoriosLeads.base.test.js`, troque o import:

```js
import {
  reportScope, newLeadsIn, namesOf, OTHERS_NAME, OTHERS_NOTE, cutCode, applyCut, cutLabelOf, contactCells, fmtDate,
  fmtScreenDate, compareTextOf, exportFileName, SITUACAO_LABEL,
} from '../relatorios/leads/base.js';
```

por:

```js
import {
  reportScope, newLeadsIn, freshLeadsOf, namesOf, OTHERS_NAME, OTHERS_NOTE, cutCode, countRows, applyCut, cutLabelOf,
  contactCells, fmtDate, fmtScreenDate, fmtDateTime, fmtScreenDateTime, compareTextOf, exportFileName, snapshotFileName,
  SITUACAO_LABEL,
} from '../relatorios/leads/base.js';
```

No `describe('filtro da lista')`, logo depois do teste `'o texto do filtro diz o tipo, menos nos números'` (antes do `});` que fecha o `describe`), acrescente:

```js

  it('os tipos novos de Visitas e aulas e de Perdas também dizem o tipo', () => {
    const items = [
      { key: 'tipo:visita', name: 'Visitas' }, { key: 'unidade:Centro', name: 'Centro' }, { key: 'modalidade:Pilates', name: 'Pilates' },
      { key: 'motivo:Preço', name: 'Preço' }, { key: 'etapa:Contato feito', name: 'Contato feito' },
    ];
    expect(items.map((i) => cutLabelOf(i.key, items))).toEqual([
      'Tipo: Visitas', 'Unidade: Centro', 'Modalidade: Pilates', 'Motivo: Preço', 'Etapa: Contato feito',
    ]);
  });
```

Logo depois do `describe('filtro da lista')` inteiro, acrescente:

```js

describe('contagem dos recortes', () => {
  it('do maior para o menor, o empate pelo nome, com o código do recorte e o que a linha leva a mais', () => {
    const itens = [{ s: 'Site' }, { s: 'Instagram' }, { s: 'Indicação' }, { s: 'Instagram' }];
    const rows = countRows(itens, (x) => x.s, (id) => id, 'origem', (id) => ({ channel: id === 'Instagram' ? 'Pago' : '' }));
    expect(rows).toEqual([
      { key: 'origem:Instagram', id: 'Instagram', name: 'Instagram', count: 2, channel: 'Pago' },
      { key: 'origem:Indicação', id: 'Indicação', name: 'Indicação', count: 1, channel: '' },
      { key: 'origem:Site', id: 'Site', name: 'Site', count: 1, channel: '' },
    ]);
    expect(countRows([], (x) => x, (id) => id, 'origem')).toEqual([]);
  });
});

describe('leads de um balde', () => {
  it('todos os meses carregados, sem repetir, com a versão mais nova de cada lead', () => {
    const ctx = ctxOf();
    const velho = { id: 's3', status: 'Perda', lostAt: new Date(2026, 7, 30), lossReason: 'Antigo' };
    ctx.months['2026-08'] = { ...ctx.months['2026-08'], lost: [velho] };
    const lost = freshLeadsOf(ctx, 'lost');
    expect(lost.map((l) => l.id)).toEqual(['s3']);
    // A cópia que vale é a do leadsById, a mais nova.
    expect(lost[0].lossReason).toBe('Preço');
  });
});
```

No `describe('planilha')`, logo depois do teste `'nome do arquivo com o submenu e as datas do período'`, acrescente:

```js

  it('o retrato de agora leva o dia de hoje no nome', () => {
    expect(snapshotFileName('parados', NOW)).toBe('leads-parados-2026-09-14.csv');
  });

  it('dia e hora: a planilha com o ano e a tela sem o ano de agora', () => {
    const d = new Date(2026, 8, 4, 9, 5);
    expect(fmtDateTime(d)).toBe('04/09/2026 09:05');
    expect(fmtScreenDateTime(d, 2026)).toBe('04/09 09:05');
    expect(fmtScreenDateTime(d, 2027)).toBe('04/09/2026 09:05');
    expect([fmtDateTime(null), fmtScreenDateTime(new Date('x'), 2026)]).toEqual(['', '']);
  });
```

Em `src/lib/__tests__/relatoriosLeads.janela.test.js`, troque:

```js
    expect(idx.contactTimes.get('s1')).toEqual([D(9, 2, 10, 30).getTime(), D(9, 3).getTime(), D(9, 5).getTime()]);
```

por:

```js
    expect(idx.contactTimes.get('s1')).toEqual([D(9, 2, 10, 30).getTime(), D(9, 3).getTime(), D(9, 5).getTime()]);
    // As trocas de etapa, que dão a etapa da perda.
    expect(idx.moves.get('s3').map((m) => [m.fromStatus, m.toStatus])).toEqual([['Novo lead', 'Contato feito'], ['Contato feito', 'Perda']]);
```

E troque:

```js
      expect([idx.records, idx.contactTimes.size, idx.recordsByLead.size, idx.visitOutcomes.size]).toEqual([[], 0, 0, 0]);
```

por:

```js
      expect([idx.records, idx.contactTimes.size, idx.recordsByLead.size, idx.visitOutcomes.size, idx.moves.size]).toEqual([[], 0, 0, 0, 0]);
```

Em `src/lib/__tests__/relatoriosLeads.conversao.test.js`, troque:

```js
import { conversaoReport, CONVERSAO_COLUMNS, SPEED_BUCKETS, apptsPartialOf } from '../relatorios/leads/conversao.js';
```

por:

```js
import { conversaoReport, CONVERSAO_COLUMNS, SPEED_BUCKETS } from '../relatorios/leads/conversao.js';
import { apptsPartialOf } from '../relatorios/leads/base.js';
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.base.test.js src/lib/__tests__/relatoriosLeads.janela.test.js src/lib/__tests__/relatoriosLeads.conversao.test.js`
Expected: FAIL: as funções novas não existem na base, `idx.moves` é `undefined` e o `apptsPartialOf` não vem da base.

- [ ] **Step 3: Implementar na base**

Em `src/lib/relatorios/leads/base.js`, troque o comentário do topo e o primeiro import:

```js
// O que os submenus dos Relatórios de Leads dividem (spec 2026-10-09): o
// recorte da barra, os leads novos da janela, os nomes de consultor, funil e
// origem, o filtro da lista, as colunas de contato da planilha, a data e o
// nome do arquivo. Puro.

import { makeScope, OTHERS_ID } from '../../crm/scope.js';
```

por:

```js
// O que os submenus dos Relatórios de Leads dividem (spec 2026-10-09): o
// recorte da barra, os leads da janela, os nomes de consultor, funil e
// origem, a contagem dos recortes, o filtro da lista, as colunas de contato da
// planilha, as datas, o aviso dos agendamentos e o nome do arquivo. Puro.

import { makeScope, OTHERS_ID, APPTS_COMPLETE_MONTH, STAGE_TRACKING_SINCE } from '../../crm/scope.js';
```

Troque `import { dayKeyOf } from '../../operacional/month.js';` por `import { dayKeyOf, monthKeyOf } from '../../operacional/month.js';`.

Troque:

```js
// Os leads cadastrados na janela [start, end), na regra do painel (newLeadsOf:
// sem importados e sem data de cadastro ausente), com a versão mais nova de
// cada lead (leadsById).
export function newLeadsIn(ctx, scope, { start, end }) {
  const fresh = newestRecordsOf(ctx.months, 'leadsCreated').map((l) => ctx.leadsById?.get(l.id) || l);
  return newLeadsOf(fresh, { start, end, inScope: scope.inScope });
}
```

por:

```js
// Os leads de um balde de todos os meses carregados (leadsCreated, converted ou
// lost), sem repetir id, com a versão mais nova de cada lead (leadsById), como
// o painel faz com o mês dele.
export const freshLeadsOf = (ctx, bucket) => newestRecordsOf(ctx.months, bucket).map((l) => ctx.leadsById?.get(l.id) || l);

// Os leads cadastrados na janela [start, end), na regra do painel (newLeadsOf:
// sem importados e sem data de cadastro ausente).
export function newLeadsIn(ctx, scope, { start, end }) {
  return newLeadsOf(freshLeadsOf(ctx, 'leadsCreated'), { start, end, inScope: scope.inScope });
}
```

Logo antes do comentário "// Filtro da lista. Cada linha leva os códigos dos recortes em que ela entra", acrescente:

```js
// Contagem por um recorte, do maior para o menor, e o empate pelo nome: a ordem
// do rankCounts do painel. `keyOf` diz em que linha cada item entra, e `extra`
// acrescenta o que a linha mostra além do nome (o canal da origem, a nota de
// Outros).
export function countRows(items, keyOf, nameOf, tipo, extra = () => ({})) {
  const map = new Map();
  items.forEach((item) => {
    const id = keyOf(item);
    const row = map.get(id) || { key: cutCode(tipo, id), id, name: nameOf(id), count: 0, ...extra(id) };
    row.count += 1;
    map.set(id, row);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

```

Troque:

```js
const CUT_PREFIX = Object.freeze({ origem: 'Origem', consultor: 'Consultor', funil: 'Funil', faixa: 'Primeiro contato' });
```

por:

```js
const CUT_PREFIX = Object.freeze({
  origem: 'Origem', consultor: 'Consultor', funil: 'Funil', faixa: 'Primeiro contato',
  tipo: 'Tipo', unidade: 'Unidade', modalidade: 'Modalidade', motivo: 'Motivo', etapa: 'Etapa',
});
```

Troque:

```js
export const fmtDate = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '');
```

por:

```js
const isDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());
export const fmtDate = (d) => (isDate(d) ? d.toLocaleDateString('pt-BR') : '');
```

Troque a função `fmtScreenDate` inteira:

```js
export function fmtScreenDate(d, currentYear) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dayMonth = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return d.getFullYear() === currentYear ? dayMonth : `${dayMonth}/${d.getFullYear()}`;
}
```

por:

```js
export function fmtScreenDate(d, currentYear) {
  if (!isDate(d)) return '';
  const dayMonth = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return d.getFullYear() === currentYear ? dayMonth : `${dayMonth}/${d.getFullYear()}`;
}

// Dia e hora do agendamento: "04/09/2026 10:00" na planilha e "04/09 10:00" na
// tela, que só encurta o ano, como o fmtScreenDate.
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const fmtDateTime = (d) => (isDate(d) ? `${fmtDate(d)} ${hhmm(d)}` : '');
export const fmtScreenDateTime = (d, currentYear) => (isDate(d) ? `${fmtScreenDate(d, currentYear)} ${hhmm(d)}` : '');
```

Logo depois da função `exportFileName` (depois do `}` dela), acrescente:

```js

// O dia em que a etapa passou a ser gravada (STAGE_TRACKING_SINCE, 14/09/2026),
// como a tela e a planilha escrevem: a etapa da perda e os dias na etapa de
// Leads parados só existem a partir dele.
export const STAGE_SINCE_TEXT = fmtDate(STAGE_TRACKING_SINCE);

// O do retrato de agora (Leads parados), que não tem período: o dia de hoje.
export const snapshotFileName = (section, now) => `leads-${section}-${dayKeyOf(now)}.csv`;

// Os agendamentos só ficam completos a partir de setembro de 2026
// (APPTS_COMPLETE_MONTH): as visitas só têm registro desde 18/08/2026. Com o
// período ou o comparado começando antes disso, a variação dos números de
// agendamento fica sem base, como no painel CRM (apptsOk, em
// src/lib/crm/texts.js, que olha o apptsBase de cada mês). A Conversão e as
// Visitas e aulas usam a mesma conta para o aviso.
export const apptsPartialOf = (period, cmp) => [period, cmp]
  .some((win) => Boolean(win) && monthKeyOf(win.start) < APPTS_COMPLETE_MONTH);
```

- [ ] **Step 4: Tirar as duas peças da Entrada e da Conversão**

Em `src/lib/relatorios/leads/entrada.js`, troque o import da base:

```js
import {
  reportScope, newLeadsIn, namesOf, cutCode, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate,
  SITUACAO_LABEL, byNewest,
} from './base.js';
```

por:

```js
import {
  reportScope, newLeadsIn, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate,
  SITUACAO_LABEL, byNewest,
} from './base.js';
```

E apague a função local, com o comentário dela:

```js
// Contagem por um recorte, do maior para o menor, e o empate pelo nome.
function countRows(leads, keyOf, nameOf, tipo, extra = () => ({})) {
  const map = new Map();
  leads.forEach((l) => {
    const id = keyOf(l);
    const row = map.get(id) || { key: cutCode(tipo, id), id, name: nameOf(id), count: 0, ...extra(id) };
    row.count += 1;
    map.set(id, row);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}
```

Em `src/lib/relatorios/leads/conversao.js`, apague a linha `import { APPTS_COMPLETE_MONTH } from '../../crm/scope.js';`, troque o import da base:

```js
import {
  reportScope, newLeadsIn, namesOf, cutCode, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate, byNewest,
} from './base.js';
```

por:

```js
import {
  reportScope, newLeadsIn, namesOf, cutCode, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate, byNewest,
  apptsPartialOf,
} from './base.js';
```

E apague o `apptsPartialOf` local, com o comentário dele:

```js
// Os agendamentos só ficam completos a partir de setembro de 2026
// (APPTS_COMPLETE_MONTH): as visitas só têm registro desde 18/08/2026. Com o
// período ou o comparado começando antes disso, a variação de Agendaram e
// Vieram fica sem base, como no painel CRM (apptsOk, em src/lib/crm/texts.js,
// que olha o apptsBase de cada mês). A tela usa a mesma conta para o aviso.
export const apptsPartialOf = (period, cmp) => [period, cmp]
  .some((win) => Boolean(win) && monthKeyOf(win.start) < APPTS_COMPLETE_MONTH);
```

O `monthKeyOf` continua importado na Conversão, porque o `contactLimitOf` usa.

Em `src/views/relatorios/RelatoriosView.jsx`, troque:

```js
import { exportFileName, compareTextOf } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport, apptsPartialOf } from '../../lib/relatorios/leads/conversao.js';
```

por:

```js
import { exportFileName, compareTextOf, apptsPartialOf } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport } from '../../lib/relatorios/leads/conversao.js';
```

- [ ] **Step 5: O índice com as trocas de etapa**

Em `src/lib/relatorios/leads/janela.js`, troque:

```js
import { recordsByLeadOf, visitOutcomesByLead } from '../../crm/appointments.js';
import { newestRecordsOf } from '../../crm/metrics.js';
```

por:

```js
import { recordsByLeadOf, visitOutcomesByLead } from '../../crm/appointments.js';
import { movesByLead } from '../../crm/stages.js';
import { newestRecordsOf } from '../../crm/metrics.js';
```

Troque o comentário do `buildIndex`:

```js
// Índices de toda a carga, os mesmos do painel: registros de agendamento por
// lead, instantes de contato e desfechos de visita pela linha do tempo. Os
// registros vão sem repetir id, com a cópia do mês mais novo. As interações
// entram como no cacheOf do painel, sem tirar repetidos aqui: as duas funções
// do painel (contactTimesByLead e visitOutcomesByLead) já tiram pelo id, e a
// interação que veio sem id continua contando.
```

por:

```js
// Índices de toda a carga, os mesmos do painel: registros de agendamento por
// lead, instantes de contato, desfechos de visita pela linha do tempo e trocas
// de etapa. Os registros vão sem repetir id, com a cópia do mês mais novo. As
// interações entram como no cacheOf do painel, sem tirar repetidos aqui: as
// três funções do painel (contactTimesByLead, visitOutcomesByLead e
// movesByLead) já tiram pelo id, e a interação que veio sem id continua
// contando.
```

E no objeto que ele devolve, troque:

```js
    visitOutcomes: visitOutcomesByLead(interactions),
  };
```

por:

```js
    visitOutcomes: visitOutcomesByLead(interactions),
    moves: movesByLead(interactions),
  };
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatorios src/lib/__tests__/relatoriosLeads`
Expected: PASS. São 5 testes novos na base, e os testes da Entrada, da Conversão, do índice e da tela passam sem outra edição.

- [ ] **Step 7: Lint e commit**

Run: `npx eslint src/lib/relatorios src/views/relatorios`
Expected: sem erro.

```bash
git add src/lib/relatorios/leads/base.js src/lib/relatorios/leads/entrada.js src/lib/relatorios/leads/conversao.js src/lib/relatorios/leads/janela.js src/views/relatorios/RelatoriosView.jsx src/lib/__tests__/relatoriosLeads.base.test.js src/lib/__tests__/relatoriosLeads.janela.test.js src/lib/__tests__/relatoriosLeads.conversao.test.js
git commit -m "refactor: Relatórios dividem a contagem dos recortes, o aviso dos agendamentos e as trocas de etapa" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: O corte de dias no endereço (`screenParams.js`)

**Files:**
- Modify: `src/lib/screenParams.js` (a tabela `relatorios`)
- Test: `src/lib/__tests__/screenParams.test.js`, `src/lib/__tests__/filtrosNoEndereco.sweep.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/screenParams.test.js`, troque no import:

```js
  diaAoLimparPeriodo,
} from '../screenParams.js';
```

por:

```js
  diaAoLimparPeriodo, DIAS_PARADOS,
} from '../screenParams.js';
```

No `describe('Relatórios')`, troque:

```js
    expect(SCREEN_PARAM_NAMES.relatorios).toEqual(['mes', 'periodo', 'de', 'ate', 'resp', 'origem', 'funil', 'recorte']);
```

por:

```js
    expect(SCREEN_PARAM_NAMES.relatorios).toEqual(['mes', 'periodo', 'de', 'ate', 'dias', 'resp', 'origem', 'funil', 'recorte']);
```

Troque:

```js
    expect(v).toEqual({ monthKey: HOJE, periodo: null, de: null, ate: null, resp: [], origem: null, funnel: 'all', recorte: null });
```

por:

```js
    expect(v).toEqual({ monthKey: HOJE, periodo: null, de: null, ate: null, dias: 7, resp: [], origem: null, funnel: 'all', recorte: null });
```

E logo antes de `  it('o que a tela monta ao escolher o período: o mês antigo não vai junto, e o intervalo ganha', () => {`, acrescente:

```js
  it('o corte de Leads parados: 3, 15 e 30 dias são escritos, e o 7, que é o padrão, não', () => {
    expect(DIAS_PARADOS).toEqual([3, 7, 15, 30]);
    for (const n of [3, 15, 30]) {
      expect(ler('relatorios', `?dias=${n}`, rel).dias, `${n}`).toBe(n);
      expect(volta('relatorios', `?dias=${n}`, rel), `${n}`).toBe(`?dias=${n}`);
    }
    expect(volta('relatorios', '?dias=7', rel)).toBe('');
    // O que não é um dos quatro cai no padrão, sem aviso.
    for (const q of ['?dias=10', '?dias=07', '?dias=15.0', '?dias=', '?dias=abc']) {
      expect(ler('relatorios', q, rel).dias, q).toBe(7);
      expect(volta('relatorios', q, rel), q).toBe('');
    }
    // Vem depois do período e antes dos consultores, e anda junto com os outros filtros.
    const v = ler('relatorios', '?periodo=semana&resp=u1', rel);
    expect(montar('relatorios', { ...v, dias: 15 }, rel)).toBe('?periodo=semana&dias=15&resp=u1');
  });

```

Em `src/lib/__tests__/filtrosNoEndereco.sweep.test.js`, troque:

```js
      // Os filtros dos Relatórios.
      'setPeriod', 'setPeriodo', 'setOrigem', 'setRecorte', 'setCut',
```

por:

```js
      // Os filtros dos Relatórios, com o corte de Leads parados.
      'setPeriod', 'setPeriodo', 'setOrigem', 'setRecorte', 'setCut', 'setDias',
```

E troque:

```js
      // Os filtros dos Relatórios: o período (nome da query e da variável da
      // tela), a origem e o recorte da lista.
      'periodo', 'period', 'origem', 'recorte',
```

por:

```js
      // Os filtros dos Relatórios: o período (nome da query e da variável da
      // tela), a origem, o recorte da lista e o corte de Leads parados.
      'periodo', 'period', 'origem', 'recorte', 'dias',
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js`
Expected: FAIL: `DIAS_PARADOS` não existe e a tabela dos Relatórios não tem `dias`.

- [ ] **Step 3: Implementar**

Em `src/lib/screenParams.js`, logo antes de `// Tabela por tela. A ordem aqui é a ordem no endereço.`, acrescente:

```js
// Corte de Leads parados (Relatórios): "sem registro há mais de" 3, 7, 15 ou 30
// dias. O 7 é o padrão e não é escrito, e o que não é um desses quatro cai nele.
// Mora aqui, e não em src/lib/relatorios/, porque a conta de Leads parados
// importa o dailyGoal.js, que traz o lucide-react, e este arquivo é puro.
export const DIAS_PARADOS = Object.freeze([3, 7, 15, 30]);
export const DIAS_PARADOS_PADRAO = 7;
const diasParados = param(
  'dias',
  (raw) => (DIAS_PARADOS.map(String).includes(raw) ? Number(raw) : DIAS_PARADOS_PADRAO),
  (v) => (DIAS_PARADOS.includes(v) && v !== DIAS_PARADOS_PADRAO ? String(v) : null),
);

```

E na tabela, em `relatorios`, troque:

```js
    ate: dataDoPainel('ate'),
    resp,
```

por:

```js
    ate: dataDoPainel('ate'),
    dias: diasParados,
    resp,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/relatoriosTela.test.js src/lib/__tests__/relatoriosTela.behavior.test.js`
Expected: PASS, 1 teste novo. A Entrada e a Conversão ignoram o `dias`, e as telas do PR 1 continuam iguais.

- [ ] **Step 5: Commit**

```bash
git add src/lib/screenParams.js src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js
git commit -m "feat: corte de dias de Leads parados no endereço dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Até aqui: `B_TESTES + 15`, nos mesmos `B_ARQ` arquivos.

---
## As contas (Tasks 6 a 8)

As três contas são puras, testadas em node, e cada uma devolve o que a tela desenha e o que a planilha leva, no molde da Entrada e da Conversão: os números do topo (`tiles`, quando há), os recortes (`by*`), o recorte aplicado (`cut` e `cutLabel`), as linhas visíveis (`rows`) e a planilha (`exportColumns` e `exportRows`). As fixtures são as do painel CRM (`src/lib/__tests__/fixtures/crmCtx.js`): setembro de 2026 em andamento, até o dia 14 ao meio-dia, e agosto fechado.

### Task 6: Conta das Visitas e aulas experimentais (`visitas.js`)

**Files:**
- Create: `src/lib/relatorios/leads/visitas.js`
- Test: `src/lib/__tests__/relatoriosLeads.visitas.test.js`

Os números que o teste espera, com as fixtures e a visita `R5`, já passada e sem desfecho: setembro tem `r1` (Sofia, aula do dia 4, veio), `r2` (Samuel, visita do dia 5, faltou), `r5` (visita do dia 10 de quem saiu da equipe, sem desfecho) e `r3` (Sérgio, aula do dia 20, a acontecer). O painel conta 3 em setembro (os de data já passada), e o relatório conta 4.

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.visitas.test.js`:

```js
// Visitas e aulas experimentais: os agendamentos do período um por um, os
// números, os recortes, a lista e a planilha. No mês fechado, os números são os
// do painel CRM (metricsOf); no mês em andamento, também, e Marcados soma os que
// ainda vão acontecer.
import { describe, it, expect } from 'vitest';
import { visitasReport, visitasEndOf, VISITAS_COLUMNS } from '../relatorios/leads/visitas.js';
import { metricsOf, crmDelta } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW, D, A } from './fixtures/crmCtx.js';

// Uma visita de quem saiu da equipe (s5), já passada e sem desfecho, com unidade.
const R5 = A('r5', 's5', 'agendada', D(9, 10), D(9, 8), { type: 'visita', unit: 'Centro' });
const ctxOf = () => {
  const c = makeCtx();
  c.months['2026-09'] = { ...c.months['2026-09'], aulas: [...c.months['2026-09'].aulas, R5] };
  return { ...c, sources: [] };
};
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
// Os dias 8 a 13 de setembro, fechados, contra os dias 2 a 7: os dois lados depois da base dos agendamentos.
const semana = periodFromParams({ de: '2026-09-08', ate: '2026-09-13' }, NOW);
const rel = (ctx, extra = {}, period = setembro) => visitasReport(ctx, { period, cmp: previousPeriod(period, NOW), ...extra });
const tile = (r, name) => r.tiles.find((t) => t.name === name);

describe('Visitas e aulas experimentais', () => {
  it('os números do mês: quem veio, quem faltou, os sem desfecho e os que vão acontecer, e o comparecimento', () => {
    const r = rel(ctxOf());
    expect(r.totals).toEqual({ total: 4, came: 1, missed: 1, pending: 1, upcoming: 1, decided: 2, rate: 50 });
    expect(r.tiles.map((t) => [t.key, t.name, t.value])).toEqual([
      [null, 'Marcados', 4], ['situacao:vieram', 'Vieram', 1], ['situacao:faltaram', 'Faltaram', 1],
      ['situacao:sem-desfecho', 'Sem desfecho', 1], ['situacao:a-acontecer', 'A acontecer', 1],
    ]);
    expect(r.attendance.value).toBe(50);
    expect(r.tiles.filter((t) => t.lowerBetter).map((t) => t.name)).toEqual(['Faltaram', 'Sem desfecho']);
  });

  it('no mês em andamento, Marcados fica sem variação; com o comparado antes de setembro, o resto fica sem base', () => {
    const r = rel(ctxOf());
    expect(r.running).toBe(true);
    expect(tile(r, 'Marcados').delta).toBeNull();
    expect(tile(r, 'A acontecer').delta).toBeUndefined();
    for (const name of ['Vieram', 'Faltaram', 'Sem desfecho']) expect(tile(r, name).delta, name).toEqual({ none: true, text: 'sem base' });
    expect(r.attendance.delta).toEqual({ none: true, text: 'sem base' });
  });

  it('no período fechado com base dos dois lados, cada número tem a variação dele', () => {
    const r = rel(ctxOf(), {}, semana);
    expect(r.running).toBe(false);
    expect(r.before).toMatchObject({ total: 2, came: 1, missed: 1, pending: 0, rate: 50 });
    expect(tile(r, 'Marcados').delta).toEqual(crmDelta(1, 2));
    expect(tile(r, 'Vieram').delta).toEqual(crmDelta(0, 1));
    expect(tile(r, 'Faltaram').delta).toEqual(crmDelta(0, 1));
    // Nenhum sem desfecho no comparado: sem base, como o painel faz com a contagem comparada a zero.
    expect(tile(r, 'Sem desfecho').delta).toEqual({ none: true, text: 'sem base' });
    // Sem desfecho marcado no período, não há comparecimento.
    expect(r.attendance).toEqual({ value: null, delta: { none: true, text: 'sem base' } });
  });

  it('a lista vai até o fim do período, em ordem de data, com o que cada tipo guarda', () => {
    const r = rel(ctxOf());
    expect(r.rows.map((x) => x.id)).toEqual(['r1', 'r2', 'r5', 'r3']);
    const row = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect(row.r1).toMatchObject({ leadId: 's1', type: 'Aula experimental', unit: null, modality: 'Funcional', professor: 'Paula Nunes', owner: 'Ana Ribeiro', outcome: 'veio' });
    expect(row.r2).toMatchObject({ leadId: 's2', type: 'Visita', unit: 'Sem unidade', modality: null, professor: null, owner: 'Diego Santos', outcome: 'faltou' });
    expect(row.r5).toMatchObject({ type: 'Visita', unit: 'Centro', owner: 'Fora da equipe', outcome: 'sem-desfecho' });
    expect(row.r3).toMatchObject({ modality: 'Sem modalidade', outcome: 'a-acontecer' });
    expect(r.window).toEqual({ start: setembro.start, end: setembro.fullEnd });
  });

  it('os recortes: tipo, consultor, unidade só das visitas e modalidade só das aulas', () => {
    const r = rel(ctxOf());
    const pares = (rows) => rows.map((x) => [x.name, x.count]);
    expect(pares(r.byType)).toEqual([['Aulas experimentais', 2], ['Visitas', 2]]);
    expect(pares(r.byOwner)).toEqual([['Diego Santos', 2], ['Ana Ribeiro', 1], ['Outros', 1]]);
    expect(pares(r.byUnit)).toEqual([['Centro', 1], ['Sem unidade', 1]]);
    expect(pares(r.byModality)).toEqual([['Funcional', 1], ['Sem modalidade', 1]]);
  });

  it('o recorte filtra a lista, e o que não existe é ignorado', () => {
    const ids = (recorte) => rel(ctxOf(), { recorte }).rows.map((x) => x.id);
    expect(ids('situacao:faltaram')).toEqual(['r2']);
    expect(ids('situacao:a-acontecer')).toEqual(['r3']);
    expect(ids('tipo:aula')).toEqual(['r1', 'r3']);
    expect(ids('unidade:Centro')).toEqual(['r5']);
    expect(ids('modalidade:Funcional')).toEqual(['r1']);
    expect(rel(ctxOf(), { recorte: 'unidade:Centro' }).cutLabel).toBe('Unidade: Centro');
    expect(rel(ctxOf(), { recorte: 'tipo:aula' }).cutLabel).toBe('Tipo: Aulas experimentais');
    expect(rel(ctxOf(), { recorte: 'situacao:a-acontecer' }).cutLabel).toBe('A acontecer');
    expect(rel(ctxOf(), { recorte: 'motivo:Preço' })).toMatchObject({ cut: null, cutLabel: null });
  });

  it('o desfecho marcado antes da hora já conta, e o treina sozinho aparece como tal', () => {
    const ctx = ctxOf();
    const cedo = A('r6', 's4', 'attended', D(9, 14, 18), D(9, 13), { soloTraining: true, modality: 'Pilates' });
    ctx.months['2026-09'] = { ...ctx.months['2026-09'], aulas: [...ctx.months['2026-09'].aulas, cedo] };
    const r = rel(ctx);
    expect(r.rows.find((x) => x.id === 'r6')).toMatchObject({ outcome: 'veio', professor: 'Treina sozinho' });
    expect(r.totals).toMatchObject({ came: 2, upcoming: 1 });
  });

  it('o registro de um lead que não existe mais entra na equipe toda, com o nome do registro', () => {
    const ctx = ctxOf();
    const apagado = A('r7', 'apagado', 'attended', D(9, 3), D(9, 1), { type: 'visita', leadName: 'Lia Antiga', unit: 'Centro' });
    ctx.months['2026-09'] = { ...ctx.months['2026-09'], aulas: [...ctx.months['2026-09'].aulas, apagado] };
    expect(rel(ctx).rows.find((x) => x.id === 'r7')).toMatchObject({ name: 'Lia Antiga', owner: 'Sem responsável' });
    expect(rel(ctx, { userIds: ['ana'] }).rows.map((x) => x.id)).not.toContain('r7');
  });

  it('a semana que atravessa o fim do mês vai só até o fim do mês atual', () => {
    const quarta = new Date(2026, 8, 30, 15);
    const semanaQueCruza = periodFromParams({ periodo: 'semana' }, quarta);
    expect(semanaQueCruza.fullEnd).toEqual(new Date(2026, 9, 5));
    expect(visitasEndOf(semanaQueCruza, quarta)).toEqual(new Date(2026, 9, 1));
    expect(visitasEndOf(agosto, NOW)).toEqual(agosto.fullEnd);
  });

  it('a planilha tem o contato, o CPF e as colunas da lista, com o dia e a hora inteiros', () => {
    expect(VISITAS_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Tipo', 'Dia e hora', 'Unidade', 'Modalidade', 'Professor', 'Consultor', 'Desfecho',
    ]);
    expect(rel(ctxOf(), { recorte: 'situacao:faltaram' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
      tipo: 'Visita', diaHora: '05/09/2026 10:00', unidade: 'Sem unidade', modalidade: '', professor: '', consultor: 'Diego Santos', desfecho: 'Faltou',
    }]);
  });

  it('no mês fechado os números são os do painel CRM, e no mês em andamento também, com os que vão acontecer em Marcados', () => {
    const ctx = ctxOf();
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    const sem = (t) => ({ total: t.total, came: t.came, missed: t.missed, pending: t.pending, decided: t.decided, rate: t.rate });
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        const tag = `${userId} ${funnelId}`;
        const fechado = visitasReport(ctx, { period: agosto, ...extra });
        expect(sem(fechado.totals), tag).toEqual(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId }).appts);
        expect(fechado.totals.upcoming, tag).toBe(0);
        const aberto = rel(ctx, extra);
        const m = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId }).appts;
        expect({ ...sem(aberto.totals), total: aberto.totals.total - aberto.totals.upcoming }, tag).toEqual(m);
        expect(aberto.before, tag).toEqual({ ...metricsOf(ctx, { monthKey: '2026-08', userId, funnelId, cutEnd: cut }).appts, upcoming: 0 });
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.visitas.test.js`
Expected: FAIL, porque `../relatorios/leads/visitas.js` não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/visitas.js`:

```js
// Visitas e aulas experimentais (spec 2026-10-09, submenu 3): os agendamentos
// com data no período, quem veio, quem faltou, os que ficaram sem desfecho e os
// que ainda vão acontecer. Os registros e o status que vale saem da regra do
// painel CRM (appointmentRowsOf, com o effectiveStatus): sem os cancelados e
// sem os marcados a partir da primeira matrícula. O consultor é o dono de hoje
// do lead, como no painel. Puro.
//
// O painel conta, no mês em andamento, só os agendamentos de data já passada.
// O relatório vai até o fim do período, para mostrar os que ainda vão
// acontecer. Por isso, no mês fechado, todos os números são os do painel, e no
// mês em andamento Vieram, Faltaram, Sem desfecho e o comparecimento são os do
// painel, e Marcados soma também os que vão acontecer.

import { monthKeyOf, monthRange } from '../../operacional/month.js';
import { AULA_STATUS, isAulaRecord } from '../../aulas.js';
import { appointmentRowsOf, isSoloTrainingRecord } from '../../crm/appointments.js';
import { SOLO_TRAINING_LABEL } from '../../professores.js';
import { crmDelta } from '../../crm/metrics.js';
import { pct } from '../../crm/stats.js';
import { reportIndex } from './janela.js';
import {
  reportScope, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDateTime, apptsPartialOf,
} from './base.js';

// Os códigos dos números do topo, escritos uma vez só, como na Conversão.
const SITUACAO = Object.freeze({
  vieram: 'situacao:vieram',
  faltaram: 'situacao:faltaram',
  semDesfecho: 'situacao:sem-desfecho',
  aAcontecer: 'situacao:a-acontecer',
});

// Desfecho de cada agendamento: o recorte do número e o texto da lista.
const OUTCOME_CUT = Object.freeze({
  veio: SITUACAO.vieram,
  faltou: SITUACAO.faltaram,
  'sem-desfecho': SITUACAO.semDesfecho,
  'a-acontecer': SITUACAO.aAcontecer,
});
export const OUTCOME_LABEL = Object.freeze({ veio: 'Veio', faltou: 'Faltou', 'sem-desfecho': 'Sem desfecho', 'a-acontecer': 'A acontecer' });

export const TIPO_LABEL = Object.freeze({ visita: 'Visita', aula: 'Aula experimental' });
const TIPO_PLURAL = Object.freeze({ visita: 'Visitas', aula: 'Aulas experimentais' });

export const VISITAS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'tipo', label: 'Tipo' }),
  Object.freeze({ key: 'diaHora', label: 'Dia e hora' }),
  Object.freeze({ key: 'unidade', label: 'Unidade' }),
  Object.freeze({ key: 'modalidade', label: 'Modalidade' }),
  Object.freeze({ key: 'professor', label: 'Professor' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'desfecho', label: 'Desfecho' }),
]);

const SEM_BASE = Object.freeze({ none: true, text: 'sem base' });

// Até onde a lista vai: o fim do período (fullEnd), com os dias que ainda vão
// acontecer, mas nunca depois do fim do mês atual. Os meses que a tela carrega
// param no mês atual (reportMonthKeys), e pedir o mês seguinte deixaria na
// memória da sessão uma entrada de mês fechado para um mês que ainda vai
// abrir, que o shouldStoreMonthEntry não deixa trocar pela do mês aberto. Só a
// semana que atravessa o fim do mês perde os dias do mês seguinte.
export function visitasEndOf(period, now) {
  const monthEnd = monthRange(monthKeyOf(now)).end;
  return period.fullEnd < monthEnd ? period.fullEnd : monthEnd;
}

// O desfecho de um agendamento. O status que vale decide quem veio e quem
// faltou, mesmo marcado antes da hora (a Agenda de hoje deixa); sem desfecho, a
// data diz se ficou sem desfecho (já passou) ou se ainda vai acontecer.
function outcomeOf(status, at, now) {
  if (status === AULA_STATUS.ATTENDED) return 'veio';
  if (status === AULA_STATUS.NO_SHOW) return 'faltou';
  return at < now ? 'sem-desfecho' : 'a-acontecer';
}

// Os totais no formato do appts do painel, mais os que vão acontecer.
function totalsOf(list) {
  const by = (o) => list.filter((x) => x.outcome === o).length;
  const came = by('veio');
  const missed = by('faltou');
  return {
    total: list.length,
    came,
    missed,
    pending: by('sem-desfecho'),
    upcoming: by('a-acontecer'),
    decided: came + missed,
    rate: pct(came, came + missed),
  };
}

const tipoOf = (x) => (isAulaRecord(x.record) ? 'aula' : 'visita');
// Só a visita guarda a unidade, e só a aula guarda a modalidade e o professor
// (aulasWrites.js, schedulePatch.js e o agendamento pelo Stronizap).
const unitOf = (x) => String(x.record.unit || '').trim() || 'Sem unidade';
const modalityOf = (x) => String(x.record.modality || '').trim() || 'Sem modalidade';
const professorOf = (r) => (isSoloTrainingRecord(r) ? SOLO_TRAINING_LABEL : (r.professorName || 'Professor'));

// Ordem da lista: a data, depois o nome e o id do registro.
const byDate = (a, b) => a.at - b.at || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);

export function visitasReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = reportIndex(ctx.months);
  const leadOf = (id) => ctx.leadsById?.get(id) || { id, unknown: true };
  const rowsIn = (start, end) => appointmentRowsOf(index.records, { start, end, leadOf, inScope: scope.inScope, visitOutcomes: index.visitOutcomes })
    .map((x) => ({ ...x, outcome: outcomeOf(x.status, x.record.scheduledFor, ctx.now) }));

  const window = { start: period.start, end: visitasEndOf(period, ctx.now) };
  const list = rowsIn(window.start, window.end);
  const totals = totalsOf(list);
  // O comparado vai até o mesmo ponto quando o período está em andamento (cmp.end).
  const before = cmp ? totalsOf(rowsIn(cmp.start, cmp.end)) : null;
  const partial = apptsPartialOf(period, cmp);
  const delta = (k, opts) => (before ? (partial ? SEM_BASE : crmDelta(totals[k], before[k], opts)) : null);

  // Com o período em andamento, Marcados soma os que ainda vão acontecer, e o
  // comparado cortado no mesmo ponto não tem esses: fica sem variação.
  const tiles = [
    { key: null, name: 'Marcados', value: totals.total, delta: period.running ? null : delta('total') },
    { key: SITUACAO.vieram, name: 'Vieram', value: totals.came, tone: 'good', delta: delta('came') },
    { key: SITUACAO.faltaram, name: 'Faltaram', value: totals.missed, tone: 'bad', delta: delta('missed'), lowerBetter: true },
    { key: SITUACAO.semDesfecho, name: 'Sem desfecho', value: totals.pending, delta: delta('pending'), lowerBetter: true },
    { key: SITUACAO.aAcontecer, name: 'A acontecer', value: totals.upcoming },
  ];
  const byType = countRows(list, tipoOf, (id) => TIPO_PLURAL[id], 'tipo');
  const byOwner = countRows(list, (x) => names.ownerKey(x.lead), names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));
  const byUnit = countRows(list.filter((x) => tipoOf(x) === 'visita'), unitOf, (id) => id, 'unidade');
  const byModality = countRows(list.filter((x) => tipoOf(x) === 'aula'), modalityOf, (id) => id, 'modalidade');

  const rows = list.map((x) => {
    const r = x.record;
    const aula = tipoOf(x) === 'aula';
    return {
      // A lista tem um agendamento por linha: o mesmo lead pode ter visita e aula no período.
      id: r.id,
      leadId: r.leadId,
      lead: x.lead,
      name: x.lead.name || r.leadName || 'Sem nome',
      type: TIPO_LABEL[tipoOf(x)],
      at: r.scheduledFor,
      unit: aula ? null : unitOf(x),
      modality: aula ? modalityOf(x) : null,
      professor: aula ? professorOf(r) : null,
      owner: names.ownerLabel(x.lead),
      outcome: x.outcome,
      cuts: [
        OUTCOME_CUT[x.outcome],
        cutCode('tipo', tipoOf(x)),
        cutCode('consultor', names.ownerKey(x.lead)),
        aula ? cutCode('modalidade', modalityOf(x)) : cutCode('unidade', unitOf(x)),
      ],
    };
  }).sort(byDate);

  const items = [...tiles.filter((t) => t.key), ...byType, ...byOwner, ...byUnit, ...byModality];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    totals,
    before,
    running: period.running,
    window,
    attendance: { value: totals.rate, delta: delta('rate', { kind: 'pp' }) },
    tiles,
    byType,
    byOwner,
    byUnit,
    byModality,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: VISITAS_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      tipo: r.type,
      diaHora: fmtDateTime(r.at),
      unidade: r.unit ?? '',
      modalidade: r.modality ?? '',
      professor: r.professor ?? '',
      consultor: r.owner,
      desfecho: OUTCOME_LABEL[r.outcome],
    })),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.visitas.test.js`
Expected: PASS, 11 testes.

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/lib/relatorios/leads/visitas.js src/lib/__tests__/relatoriosLeads.visitas.test.js`
Expected: sem erro.

```bash
git add src/lib/relatorios/leads/visitas.js src/lib/__tests__/relatoriosLeads.visitas.test.js
git commit -m "feat: conta das Visitas e aulas experimentais dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Conta das Perdas (`perdas.js`)

**Files:**
- Create: `src/lib/relatorios/leads/perdas.js`
- Test: `src/lib/__tests__/relatoriosLeads.perdas.test.js`

As fixtures param em 14/09/2026 ao meio-dia, antes de a etapa da perda começar a ser gravada (`STAGE_TRACKING_SINCE`, 14/09 às 18h10). Com elas, setembro não teria a etapa nenhuma, o que nunca acontece depois que o PR entra no ar. Por isso o teste usa 20/09 como agora. Os leads locais: `P1` (perda do Diego em 12/09, motivo Horário, da etapa Novo lead), `P2` (perda de agosto, antes do corte do comparado) e `P4` (perdido em 09/09 e de volta ao funil: a lista de setembro ainda tem a cópia velha, e o lead de hoje não tem mais a data nem o motivo).

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.perdas.test.js`:

```js
// Perdas: os leads perdidos no período, por motivo, etapa, origem e consultor,
// a lista de repescagem e a planilha. No mês inteiro, os números são os do card
// de perdas do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { perdasReport, stageBaseOf, PERDAS_COLUMNS } from '../relatorios/leads/perdas.js';
import { STAGE_SINCE_TEXT } from '../relatorios/leads/base.js';
import { metricsOf, crmDelta } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, L, D, MV } from './fixtures/crmCtx.js';

// As fixtures param em 14/09 ao meio-dia, antes de a etapa da perda começar a ser
// gravada (14/09, 18h10). Aqui o agora é 20/09, para setembro ter a etapa.
const NOW = D(9, 20, 12);

// Uma perda do Diego em setembro, da etapa Novo lead, e uma de agosto antes do corte do comparado.
const P1 = L('p1', { consultantId: 'diego', source: 'Site', status: 'Perda', lostAt: D(9, 12), lossReason: 'Horário' });
const P2 = L('p2', { createdAt: D(8, 1), status: 'Perda', lostAt: D(8, 10), lossReason: 'Preço' });
// Perdido em setembro e de volta ao funil: a lista de setembro ainda tem a cópia velha, e o lead de
// hoje (leadsById) não tem mais a data nem o motivo da perda.
const P4_VELHO = L('p4', { status: 'Perda', lostAt: D(9, 9), lossReason: 'Preço' });
const P4 = L('p4', { status: 'Contato feito', lostAt: null, lossReason: null });
const ctxOf = () => {
  const c = makeCtx();
  c.months['2026-09'] = {
    ...c.months['2026-09'],
    lost: [...c.months['2026-09'].lost, P1, P4_VELHO],
    interactions: [...c.months['2026-09'].interactions, MV('m5', 'p1', 'Novo lead', 'Perda', D(9, 12))],
  };
  c.months['2026-08'] = { ...c.months['2026-08'], lost: [P2] };
  c.leadsById = new Map([...c.leadsById, ['p1', P1], ['p2', P2], ['p4', P4]]);
  return { ...c, now: NOW, sources: [] };
};
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}, period = setembro) => perdasReport(ctx, { period, cmp: previousPeriod(period, NOW), ...extra });
const pares = (rows) => rows.map((x) => [x.name, x.count]);

describe('Perdas', () => {
  it('o total do mês com a variação, e quem voltou ao funil fica fora', () => {
    const r = rel(ctxOf());
    expect(r.total).toBe(2);
    expect(r.delta).toEqual(crmDelta(2, 1));
    expect(r.rows.map((x) => x.id)).toEqual(['p1', 's3']);
  });

  it('os recortes: motivo, etapa, origem e consultor, que somam o mesmo total', () => {
    const r = rel(ctxOf());
    expect(pares(r.byReason)).toEqual([['Horário', 1], ['Preço', 1]]);
    expect(pares(r.byStage)).toEqual([['Contato feito', 1], ['Novo lead', 1]]);
    expect(pares(r.bySource)).toEqual([['Instagram', 1], ['Site', 1]]);
    expect(pares(r.byOwner)).toEqual([['Ana Ribeiro', 1], ['Diego Santos', 1]]);
    for (const k of ['byReason', 'byStage', 'bySource', 'byOwner']) expect(r[k].reduce((s, x) => s + x.count, 0), k).toBe(r.total);
  });

  it('a etapa existe desde 14/09/2026: sem base antes, parcial no período que atravessa a data', () => {
    expect(STAGE_SINCE_TEXT).toBe('14/09/2026');
    expect(stageBaseOf(agosto)).toBe('none');
    expect(stageBaseOf(setembro)).toBe('partial');
    const outubro = new Date(2026, 9, 15, 10);
    expect(stageBaseOf(periodFromParams({ monthKey: '2026-10' }, outubro))).toBe('full');
    expect(stageBaseOf(periodFromParams({ de: '2026-09-01', ate: '2026-09-13' }, NOW))).toBe('none');
    const r = rel(ctxOf(), {}, agosto);
    expect([r.stageBase, r.byStage]).toEqual(['none', []]);
    // Sem base, o recorte de etapa não existe e é ignorado.
    expect(rel(ctxOf(), { recorte: 'etapa:Sem etapa' }, agosto).cut).toBeNull();
  });

  it('a lista: a perda mais recente primeiro, com o motivo, a etapa e os dias desde a perda', () => {
    const [p1, s3] = rel(ctxOf()).rows;
    expect(p1).toMatchObject({ reason: 'Horário', stage: 'Novo lead', lostAt: D(9, 12), days: 8, source: 'Site', owner: 'Diego Santos' });
    expect(s3).toMatchObject({ reason: 'Preço', stage: 'Contato feito', days: 14, owner: 'Ana Ribeiro' });
  });

  it('o recorte filtra a lista: o motivo dá a lista de repescagem', () => {
    const r = rel(ctxOf(), { recorte: 'motivo:Horário' });
    expect([r.cut, r.cutLabel, r.rows.map((x) => x.id)]).toEqual(['motivo:Horário', 'Motivo: Horário', ['p1']]);
    expect(rel(ctxOf(), { recorte: 'etapa:Contato feito' }).cutLabel).toBe('Etapa: Contato feito');
    expect(rel(ctxOf(), { recorte: 'motivo:Distância' }).cut).toBeNull();
  });

  it('filtros da barra: consultores, origem e funil', () => {
    expect(rel(ctxOf(), { userIds: ['diego'] }).rows.map((x) => x.id)).toEqual(['p1']);
    expect(rel(ctxOf(), { origem: 'Instagram' }).rows.map((x) => x.id)).toEqual(['s3']);
    expect(rel(ctxOf(), { funnelId: 'ind' }).total).toBe(0);
  });

  it('a planilha tem o contato, o CPF e as colunas da lista', () => {
    expect(PERDAS_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Motivo', 'Etapa', 'Data da perda', 'Dias desde a perda', 'Origem', 'Consultor',
    ]);
    expect(rel(ctxOf(), { recorte: 'motivo:Horário' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
      motivo: 'Horário', etapa: 'Novo lead', dataPerda: '12/09/2026', diasPerda: 8, origem: 'Site', consultor: 'Diego Santos',
    }]);
  });

  it('no mês inteiro, os números são os do card de perdas do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        const tag = `${userId} ${funnelId}`;
        const set = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId });
        const r = rel(ctx, extra);
        expect(r.total, tag).toBe(set.losses.total);
        expect(pares(r.byReason), tag).toEqual(pares(set.losses.reasons));
        expect(pares(r.byStage), tag).toEqual(pares(set.lossStages));
        const ago = metricsOf(ctx, { monthKey: '2026-08', userId, funnelId });
        expect(perdasReport(ctx, { period: agosto, ...extra }).total, tag).toBe(ago.losses.total);
        expect(ago.lossStages, tag).toBeNull();
        expect(perdasReport(ctx, { period: previousPeriod(setembro, NOW), ...extra }).total, tag)
          .toBe(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId, cutEnd: cut }).losses.total);
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.perdas.test.js`
Expected: FAIL, porque `../relatorios/leads/perdas.js` não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/perdas.js`:

```js
// Perdas (spec 2026-10-09, submenu 4): os leads com a data da perda no período,
// por motivo, pela etapa em que se perderam, por origem e por consultor. As
// perdas saem da regra do painel CRM (lossesOf: quem está em Perda hoje e não é
// cliente) e a etapa, do lossStageOf, a conta do card de perdas lead por lead.
// No mês inteiro, os números são os do painel. Filtrar um motivo e exportar dá a
// lista de repescagem. Puro.
//
// Até o PR 4 da entrega A, a perda não é guardada como fato: quem volta ao
// funil ou matricula perde a data e o motivo da perda (planStageMove, em
// stageMove.js, e commitMatricula, em contractsWrites.js, apagam lostAt e
// lossReason) e sai desta conta. A tela diz isso num aviso fixo.

import { calendarDaysBetween } from '../../dates.js';
import { STAGE_TRACKING_SINCE } from '../../crm/scope.js';
import { lossesOf, lossReasonOf, lostAtOf } from '../../crm/cohort.js';
import { lossStageOf } from '../../crm/stages.js';
import { crmDelta } from '../../crm/metrics.js';
import { reportIndex } from './janela.js';
import {
  reportScope, freshLeadsOf, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate,
} from './base.js';

export const PERDAS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'motivo', label: 'Motivo' }),
  Object.freeze({ key: 'etapa', label: 'Etapa' }),
  Object.freeze({ key: 'dataPerda', label: 'Data da perda' }),
  Object.freeze({ key: 'diasPerda', label: 'Dias desde a perda' }),
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
]);

// Quanto do período tem a etapa da perda (STAGE_TRACKING_SINCE, 14/09/2026):
// 'none' quando ele acaba antes disso, 'partial' quando começa antes e acaba
// depois, e 'full' quando começa depois. No parcial, as perdas de antes ficam em
// "Sem etapa", como no card do painel, e o motivo e a etapa somam o mesmo total.
export function stageBaseOf(period) {
  if (period.end <= STAGE_TRACKING_SINCE) return 'none';
  return period.start < STAGE_TRACKING_SINCE ? 'partial' : 'full';
}

// Ordem da lista: a perda mais recente primeiro, depois o nome e o id.
const byLatestLoss = (a, b) => (b.lostAt?.getTime?.() ?? 0) - (a.lostAt?.getTime?.() ?? 0)
  || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);

export function perdasReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = reportIndex(ctx.months);
  const lostIn = ({ start, end }) => lossesOf(freshLeadsOf(ctx, 'lost'), { start, end, inScope: scope.inScope }).leads;
  const leads = lostIn(period);
  const before = cmp ? lostIn(cmp).length : null;
  const stageBase = stageBaseOf(period);
  const stageOf = (l) => lossStageOf(l, { moves: index.moves, start: period.start, end: period.end });

  const byReason = countRows(leads, lossReasonOf, (id) => id, 'motivo');
  const byStage = stageBase === 'none' ? [] : countRows(leads, stageOf, (id) => id, 'etapa');
  const bySource = countRows(leads, names.sourceName, (id) => id, 'origem');
  const byOwner = countRows(leads, names.ownerKey, names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));

  const rows = leads.map((l) => {
    const lostAt = lostAtOf(l);
    return {
      id: l.id,
      lead: l,
      name: l.name || 'Sem nome',
      reason: lossReasonOf(l),
      stage: stageOf(l),
      lostAt,
      days: calendarDaysBetween(lostAt, ctx.now),
      source: names.sourceName(l),
      owner: names.ownerLabel(l),
      cuts: [
        cutCode('motivo', lossReasonOf(l)),
        cutCode('etapa', stageOf(l)),
        cutCode('origem', names.sourceName(l)),
        cutCode('consultor', names.ownerKey(l)),
      ],
    };
  }).sort(byLatestLoss);

  const items = [...byReason, ...byStage, ...bySource, ...byOwner];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    total: leads.length,
    delta: before === null ? null : crmDelta(leads.length, before),
    stageBase,
    byReason,
    byStage,
    bySource,
    byOwner,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: PERDAS_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      motivo: r.reason,
      etapa: r.stage,
      dataPerda: fmtDate(r.lostAt),
      diasPerda: r.days ?? '',
      origem: r.source,
      consultor: r.owner,
    })),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.perdas.test.js`
Expected: PASS, 8 testes.

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/lib/relatorios/leads/perdas.js src/lib/__tests__/relatoriosLeads.perdas.test.js`
Expected: sem erro.

```bash
git add src/lib/relatorios/leads/perdas.js src/lib/__tests__/relatoriosLeads.perdas.test.js
git commit -m "feat: conta das Perdas dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Conta dos Leads parados (`parados.js`)

**Files:**
- Create: `src/lib/relatorios/leads/parados.js`
- Test: `src/lib/__tests__/relatoriosLeads.parados.test.js`

Os números que o teste espera, às 12h de 14/09/2026: em aberto estão `s2`, `s4`, `s5`, `a2`, `a3`, `x1` e `x2` (7). Sem próximo passo: `s2`, `s5` e `a3` (o `x2` foi cadastrado hoje cedo, e a Meta ainda o cobra). Contato atrasado: `x1`, desde 10/09, delegado ao Diego e contado para a Ana, que é a dona. Sem registro há mais de 7 dias: `a3` (33 dias, desde o cadastro), `a2` (11, pelo campo do lead), `s2` e `s5` (11, pelas interações do mês). Na lista, cada lead uma vez: 5.

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.parados.test.js`:

```js
// Leads parados: o retrato de agora dos leads em aberto sem próximo passo, com
// contato atrasado ou sem registro há mais de N dias, cada lead uma vez na
// lista. O em aberto e o sem próximo passo são os da carteira de agora do painel
// CRM (metricsOf, now).
import { describe, it, expect } from 'vitest';
import { paradosReport, stageSinceOf, PARADOS_COLUMNS } from '../relatorios/leads/parados.js';
import { metricsOf } from '../crm/metrics.js';
import { makeCtx, L, D, s2, s4, s5, a2, a3 } from './fixtures/crmCtx.js';

// Agora: 14/09, segunda, meio-dia.
// x1: da Ana, com o contato atrasado desde 10/09 e delegado ao Diego; o atraso fica com a Ana.
const X1 = L('x1', {
  createdAt: D(9, 1), nextFollowUp: D(9, 10), nextFollowUpOwnerId: 'diego', lastInteractionAt: D(9, 12, 9), statusEnteredAt: D(9, 5),
});
// x2: cadastrado hoje cedo e sem próximo contato: a Meta ainda o cobra como Novo lead 24h.
const X2 = L('x2', { createdAt: D(9, 14, 8), nextFollowUp: null });
// x3: cliente, fora dos leads em aberto.
const X3 = L('x3', { status: 'Venda', isConverted: true, nextFollowUp: null });
// O a2 com o último registro gravado no lead, 11 dias atrás.
const A2 = { ...a2, lastInteractionAt: D(9, 3, 12) };
const ctxOf = () => {
  const c = makeCtx();
  return { ...c, liveLeads: [s2, s4, s5, A2, a3, X1, X2, X3], interactions: c.months['2026-09'].interactions, sources: [] };
};
const rel = (ctx, extra = {}) => paradosReport(ctx, extra);
const valores = (r) => r.tiles.map((t) => [t.key, t.name, t.value]);

describe('Leads parados', () => {
  it('os três números e os leads em aberto agora', () => {
    const r = rel(ctxOf());
    expect(r.open).toBe(7);
    expect(valores(r)).toEqual([
      ['situacao:sem-proximo-passo', 'Sem próximo passo', 3],
      ['situacao:atrasado', 'Contato atrasado', 1],
      ['situacao:sem-registro', 'Sem registro há mais de 7 dias', 4],
    ]);
    // Cada lead entra uma vez: s2, s5 e a3 estão em dois números.
    expect(r.total).toBe(5);
  });

  it('a lista: quem está há mais dias sem registro primeiro, com a etapa, o último registro, o próximo contato e o consultor', () => {
    const r = rel(ctxOf());
    expect(r.rows.map((x) => [x.id, x.quiet])).toEqual([['a3', 33], ['a2', 11], ['s2', 11], ['s5', 11], ['x1', 2]]);
    const x1 = r.rows.find((x) => x.id === 'x1');
    expect(x1).toMatchObject({ stage: 'Novo lead', stageDays: 9, lastAt: D(9, 12, 9), next: D(9, 10), late: 4, owner: 'Ana Ribeiro' });
    // O último registro vem das interações que chegam ao vivo quando o lead não tem o campo.
    expect(r.rows.find((x) => x.id === 's2').lastAt).toEqual(D(9, 3, 12));
    expect(r.rows.find((x) => x.id === 'a3')).toMatchObject({ lastAt: null, stageDays: null, next: null, late: 0 });
  });

  it('o corte de dias muda só o terceiro número, e a lista acompanha', () => {
    const r15 = rel(ctxOf(), { dias: 15 });
    expect(r15.tiles[2]).toMatchObject({ name: 'Sem registro há mais de 15 dias', value: 1 });
    // O a2 só estava parado pelo registro: com 15 dias ele sai da lista.
    expect(r15.rows.map((x) => x.id)).toEqual(['a3', 's2', 's5', 'x1']);
    expect(rel(ctxOf(), { dias: 3 }).tiles[2].value).toBe(4);
  });

  it('o recorte filtra a lista: cada número e o consultor', () => {
    const ids = (recorte) => rel(ctxOf(), { recorte }).rows.map((x) => x.id);
    expect(ids('situacao:sem-proximo-passo')).toEqual(['a3', 's2', 's5']);
    expect(ids('situacao:atrasado')).toEqual(['x1']);
    expect(ids('situacao:sem-registro')).toEqual(['a3', 'a2', 's2', 's5']);
    expect(ids('consultor:ana')).toEqual(['a3', 'x1']);
    expect(rel(ctxOf(), { recorte: 'situacao:atrasado' }).cutLabel).toBe('Contato atrasado');
    expect(rel(ctxOf(), { recorte: 'consultor:diego' }).cutLabel).toBe('Consultor: Diego Santos');
    expect(rel(ctxOf(), { recorte: 'situacao:vieram' }).cut).toBeNull();
  });

  it('os consultores do recorte, com Outros para quem saiu da equipe', () => {
    expect(rel(ctxOf()).byOwner.map((x) => [x.name, x.count])).toEqual([['Ana Ribeiro', 2], ['Diego Santos', 2], ['Outros', 1]]);
  });

  it('filtros da barra: consultores, origem e funil', () => {
    expect(rel(ctxOf(), { userIds: ['diego'] }).rows.map((x) => x.id)).toEqual(['a2', 's2']);
    expect(rel(ctxOf(), { origem: 'Site' }).rows.map((x) => x.id)).toEqual(['a2']);
    expect(rel(ctxOf(), { funnelId: 'ind' }).rows.map((x) => x.id)).toEqual(['s2']);
  });

  it('desde quando o lead está na etapa: a entrada gravada, o cadastro de depois de 14/09/2026 ou nada', () => {
    expect(stageSinceOf({ statusEnteredAt: D(9, 5) })).toEqual(D(9, 5));
    expect(stageSinceOf({ createdAt: D(9, 20) })).toEqual(D(9, 20));
    expect(stageSinceOf({ createdAt: D(9, 2) })).toBeNull();
    expect(stageSinceOf({ createdAt: D(9, 20), createdAtMissing: true })).toBeNull();
  });

  it('a planilha tem o contato, o CPF e as colunas da lista, com os dias à parte', () => {
    expect(PARADOS_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Etapa', 'Dias na etapa', 'Último registro', 'Dias sem registro', 'Próximo contato', 'Dias de atraso', 'Consultor',
    ]);
    const linhas = rel(ctxOf(), { recorte: 'consultor:ana' }).exportRows;
    expect(linhas).toEqual([
      {
        nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
        etapa: 'Novo lead', diasNaEtapa: 'antes de 14/09/2026', ultimoRegistro: 'Nenhum', diasSemRegistro: 33, proximoContato: '', diasAtraso: '', consultor: 'Ana Ribeiro',
      },
      {
        nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
        etapa: 'Novo lead', diasNaEtapa: 9, ultimoRegistro: '12/09/2026', diasSemRegistro: 2, proximoContato: '10/09/2026', diasAtraso: 4, consultor: 'Ana Ribeiro',
      },
    ]);
  });

  it('o em aberto e o sem próximo passo são os da carteira de agora do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const tag = `${userId} ${funnelId}`;
        const r = rel(ctx, { userIds: userId ? [userId] : [], funnelId });
        const { now } = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId });
        expect([r.open, r.tiles[0].value], tag).toEqual([now.total, now.noNext]);
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.parados.test.js`
Expected: FAIL, porque `../relatorios/leads/parados.js` não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/parados.js`:

```js
// Leads parados (spec 2026-10-09, submenu 5): retrato de agora dos leads em
// aberto (o balde ativo, que o app já tem na memória) que estão sem próximo
// passo, com contato atrasado ou sem nada registrado na ficha há mais de N dias.
// Sem período e sem comparação. As regras são as do app:
// - em aberto e sem próximo passo são os da carteira de agora do painel CRM
//   (openLeadsOf e noNextStepOf, as contas do pipelineNowOf);
// - o atraso é o do Atrasado da Meta (overdueDaysOf), e fica com o dono do lead
//   mesmo quando o contato foi delegado, como lá;
// - os dias sem registro são os do selo "N dias sem contato" do Pipeline
//   (getDaysSinceFromDate, com a última interação pelo lastInteractionDateOf,
//   que junta o campo do lead e as interações do mês que chegam ao vivo).
// O consultor é o dono do lead hoje. Puro.
//
// O dailyGoal.js importa o lucide-react. Aqui não faz mal, porque os Relatórios
// só rodam no navegador, mas nenhuma função de api/ pode importar este arquivo.

import { getSafeDateOrNull, calendarDaysBetween } from '../../dates.js';
import { STAGE_TRACKING_SINCE } from '../../crm/scope.js';
import { openLeadsOf, noNextStepOf } from '../../crm/stages.js';
import { buildInteractionIndex, lastInteractionDateOf, getDaysSinceFromDate } from '../../leadStatus.js';
import { overdueDaysOf } from '../../dailyGoal.js';
import { DIAS_PARADOS_PADRAO } from '../../screenParams.js';
import {
  reportScope, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate, STAGE_SINCE_TEXT,
} from './base.js';

const SITUACAO = Object.freeze({
  semProximoPasso: 'situacao:sem-proximo-passo',
  atrasado: 'situacao:atrasado',
  semRegistro: 'situacao:sem-registro',
});

export const PARADOS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'etapa', label: 'Etapa' }),
  Object.freeze({ key: 'diasNaEtapa', label: 'Dias na etapa' }),
  Object.freeze({ key: 'ultimoRegistro', label: 'Último registro' }),
  Object.freeze({ key: 'diasSemRegistro', label: 'Dias sem registro' }),
  Object.freeze({ key: 'proximoContato', label: 'Próximo contato' }),
  Object.freeze({ key: 'diasAtraso', label: 'Dias de atraso' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
]);

// Desde quando o lead está na etapa de hoje. Toda troca de etapa grava a
// entrada (statusEnteredAt) desde 14/09/2026, e o lead novo também, menos o da
// indicação pelo link público (api/tenant-resolve.js): para ele, o cadastro.
// Lead que não troca de etapa desde antes disso não tem como saber: null.
export function stageSinceOf(lead) {
  const entered = getSafeDateOrNull(lead?.statusEnteredAt);
  if (entered) return entered;
  const created = lead?.createdAtMissing ? null : getSafeDateOrNull(lead?.createdAt);
  return created && created >= STAGE_TRACKING_SINCE ? created : null;
}

// Ordem da lista: quem está há mais dias sem registro primeiro, depois o nome e o id.
const byQuietest = (a, b) => (b.quiet ?? -1) - (a.quiet ?? -1)
  || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);

export function paradosReport(ctx, { userIds = [], funnelId = null, origem = null, recorte = null, dias = DIAS_PARADOS_PADRAO }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = buildInteractionIndex(ctx.interactions);
  // O funnelOk do reportScope já leva a origem, como o painel entrega ao pipelineNowOf.
  const open = openLeadsOf(ctx.liveLeads, { ownerOk: scope.ownerOk, funnelOk: scope.funnelOk }).map((l) => {
    const lastAt = lastInteractionDateOf(l, index);
    const quiet = getDaysSinceFromDate(l, lastAt, ctx.now.getTime());
    return {
      lead: l,
      lastAt,
      quiet,
      late: overdueDaysOf(l, ctx.now),
      noNext: noNextStepOf(l, ctx.now),
      stale: quiet != null && quiet > dias,
    };
  });
  // Um lead pode estar em mais de um número; na lista ele aparece uma vez.
  const stuck = open.filter((x) => x.noNext || x.late > 0 || x.stale);

  const tiles = [
    { key: SITUACAO.semProximoPasso, name: 'Sem próximo passo', value: open.filter((x) => x.noNext).length },
    { key: SITUACAO.atrasado, name: 'Contato atrasado', value: open.filter((x) => x.late > 0).length },
    { key: SITUACAO.semRegistro, name: `Sem registro há mais de ${dias} dias`, value: open.filter((x) => x.stale).length },
  ];
  const byOwner = countRows(stuck, (x) => names.ownerKey(x.lead), names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));

  const rows = stuck.map((x) => {
    const l = x.lead;
    const stageSince = stageSinceOf(l);
    const cuts = [cutCode('consultor', names.ownerKey(l))];
    if (x.noNext) cuts.push(SITUACAO.semProximoPasso);
    if (x.late > 0) cuts.push(SITUACAO.atrasado);
    if (x.stale) cuts.push(SITUACAO.semRegistro);
    return {
      id: l.id,
      lead: l,
      name: l.name || 'Sem nome',
      stage: l.status || '',
      stageDays: stageSince ? calendarDaysBetween(stageSince, ctx.now) : null,
      lastAt: x.lastAt,
      quiet: x.quiet,
      next: getSafeDateOrNull(l.nextFollowUp),
      late: x.late,
      owner: names.ownerLabel(l),
      cuts,
    };
  }).sort(byQuietest);

  const items = [...tiles, ...byOwner];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    open: open.length,
    total: stuck.length,
    dias,
    tiles,
    byOwner,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: PARADOS_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      etapa: r.stage,
      diasNaEtapa: r.stageDays ?? `antes de ${STAGE_SINCE_TEXT}`,
      ultimoRegistro: fmtDate(r.lastAt) || 'Nenhum',
      diasSemRegistro: r.quiet ?? '',
      proximoContato: fmtDate(r.next),
      diasAtraso: r.late || '',
      consultor: r.owner,
    })),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.parados.test.js`
Expected: PASS, 9 testes.

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/lib/relatorios/leads/parados.js src/lib/__tests__/relatoriosLeads.parados.test.js`
Expected: sem erro.

```bash
git add src/lib/relatorios/leads/parados.js src/lib/__tests__/relatoriosLeads.parados.test.js
git commit -m "feat: conta dos Leads parados dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Até aqui: `B_ARQ + 3` arquivos e `B_TESTES + 43` testes.

---
## As telas (Tasks 9 a 11)

Antes das Tasks 9, 10 e 11, carregue a skill `frontend-design` (pedido do Johnny para as telas dos Relatórios). As três telas seguem o molde do PR 1, e as escolhas próprias de cada uma estão no comentário do topo de cada arquivo: o comparecimento como número grande nas Visitas e aulas, o número grande sem cor nas Perdas, os três números numa linha em Leads parados, o âmbar só em "Sem desfecho" e o vermelho só no atraso. O que vale para as três, aprendido nas revisões do PR 1:

- todo balão e toda lista do shadcn levam `border-border`;
- o anel do teclado é o `FOCUS_RING` de `src/components/focusRing.js`, nunca escrito à mão;
- nada de filtro em `key`, e o `listId` da lista é texto;
- a grade dos cartões é para a coluna estreita (a lista ao lado tem 232px): dois por dois a partir de `sm`, nunca três;
- um verde só no texto pequeno, o `GREEN_TEXT`;
- todo nome de lead é `LeadLink`;
- texto em português direto, sem travessão no meio da frase.

### Task 9: A grade dos números aceita colunas (`ReportParts.jsx`)

**Files:**
- Modify: `src/views/relatorios/ReportParts.jsx` (`NumberTiles`)
- Test: `src/lib/__tests__/relatoriosParts.test.js`

A grade padrão dos números é a de seis (a Conversão). As Visitas e aulas têm cinco e Leads parados tem três, e na grade de seis sobraria coluna vazia no fim da linha.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/lib/__tests__/relatoriosParts.test.js`, no `describe('números do topo')`, logo antes de `  it('o número grande leva a variação e o período comparado', () => {`, acrescente:

```js
  it('quem tem menos números troca as colunas da grade, sem sobrar coluna vazia', () => {
    const tiles = [{ key: null, name: 'Marcados', value: 4 }];
    const grade = (className) => /^<div class="([^"]*)"/.exec(html(createElement(NumberTiles, { tiles, cut: null, onCut: noop, className })))[1].split(' ');
    expect(grade()).toContain('xl:grid-cols-6');
    expect(grade('xl:grid-cols-5')).toContain('xl:grid-cols-5');
    expect(grade('xl:grid-cols-5')).not.toContain('xl:grid-cols-6');
    expect(grade('sm:grid-cols-3 xl:grid-cols-3')).not.toContain('xl:grid-cols-6');
  });

```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosParts.test.js`
Expected: FAIL: a grade continua com `xl:grid-cols-6`.

- [ ] **Step 3: Implementar**

Em `src/views/relatorios/ReportParts.jsx`, troque:

```jsx
// aberto) guarda o lugar dela, com a altura da pílula (h-5), para o número
// ficar na mesma linha dos outros.
export function NumberTiles({ tiles, cut, onCut }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
```

por:

```jsx
// aberto) guarda o lugar dela, com a altura da pílula (h-5), para o número
// ficar na mesma linha dos outros. A grade padrão é a de seis números; quem
// tem menos passa as colunas em className (o cn() troca as do mesmo tamanho de
// tela), para não sobrar coluna vazia no fim da linha.
export function NumberTiles({ tiles, cut, onCut, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6', className)}>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatoriosParts.test.js src/lib/__tests__/relatoriosParts.behavior.test.js src/lib/__tests__/focusRing.test.js`
Expected: PASS, 1 teste novo.

- [ ] **Step 5: Commit**

```bash
git add src/views/relatorios/ReportParts.jsx src/lib/__tests__/relatoriosParts.test.js
git commit -m "feat: grade dos números dos Relatórios aceita colunas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: O corte de dias na barra (`RelatoriosToolbar.jsx`)

**Files:**
- Modify: `src/views/relatorios/RelatoriosToolbar.jsx`
- Test: `src/lib/__tests__/relatoriosBarra.test.js`, `src/lib/__tests__/relatoriosBarra.behavior.test.js`, `src/lib/__tests__/focusRing.test.js`

Em Leads parados, o período e o mês saem da barra (`showPeriod` falso) e entra o corte "Sem registro há mais de", com 3, 7, 15 ou 30 dias. O texto fica do lado de fora do botão, que diz só os dias, para caber na barra: com ele dentro, o botão passaria do `max-w-[160px]` do `FilterButton` e cortaria. O corte não acende o botão de filtros do celular, porque ele toma o lugar do período, que também não acende.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/relatoriosBarra.test.js`, logo antes de `  it('o menu de consultores marca a equipe toda ou cada pessoa', () => {`, acrescente:

```js
  it('em Leads parados, o corte de dias no lugar do período e do mês', () => {
    const out = renderToString(createElement(RelatoriosToolbar, {
      ...base, period: periodFromParams({ monthKey: '2026-09' }, NOW), showPeriod: false, dias: 15, onDias: noop,
    }));
    expect(out).not.toContain('aria-label="Período"');
    expect(out).not.toContain('aria-label="Mês de competência"');
    expect(out).toContain('aria-label="Sem registro há mais de"');
    expect(out).toContain('15 dias');
    // No celular, o texto ao lado do botão de filtros é o corte, e não o período.
    expect(out).toContain('Sem registro há mais de 15 dias');
    expect(out).not.toContain('Setembro 2026 · em andamento</span>');
    for (const l of ['Consultores', 'Origem', 'Funil']) expect(out).toContain(`aria-label="${l}"`);
  });

```

Em `src/lib/__tests__/relatoriosBarra.behavior.test.js`, troque o import da barra:

```js
const { RelatoriosToolbar, FilterButton, ConsultoresMenu, ConsultoresControl, OrigemControl, FunilControl } = await import('../../views/relatorios/RelatoriosToolbar.jsx');
```

por:

```js
const { RelatoriosToolbar, FilterButton, ConsultoresMenu, ConsultoresControl, OrigemControl, FunilControl, DiasControl } = await import('../../views/relatorios/RelatoriosToolbar.jsx');
```

E logo antes de `describe('filtro aceso', () => {`, acrescente:

```js
describe('corte de Leads parados', () => {
  it('a lista tem os quatro cortes, com borda própria, e escolher passa o número de dias', async () => {
    const onDias = vi.fn();
    await montar(h(DiasControl, { dias: 7, onDias }));
    // O nome do botão é o texto inteiro, e o combobox lê os dias como valor.
    expect(gatilho('Sem registro há mais de').getAttribute('role')).toBe('combobox');
    expect(gatilho('Sem registro há mais de').textContent).toContain('7 dias');
    await abrir('Sem registro há mais de');
    expect(lista().className).toContain('border-border');
    expect([...document.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim())).toEqual(['3 dias', '7 dias', '15 dias', '30 dias']);
    await tecla(opcao('15 dias'), 'Enter');
    expect(onDias).toHaveBeenCalledTimes(1);
    expect(onDias).toHaveBeenCalledWith(15);
  });

  it('a barra sem período traz o corte no computador e no balão do celular, e o corte não acende o botão de filtros', async () => {
    await montar(h(RelatoriosToolbar, { ...barra, showPeriod: false, dias: 30, onDias: noop }));
    expect(gatilho('Período')).toBeNull();
    expect(gatilho('Sem registro há mais de').textContent).toContain('30 dias');
    expect(gatilho('Filtros dos relatórios')).not.toBeNull();
    await clicar(gatilho('Filtros dos relatórios'));
    expect(balao().querySelector('[aria-label="Sem registro há mais de"]')).not.toBeNull();
    expect(balao().querySelector('[aria-label="Período"]')).toBeNull();
  });
});

```

Em `src/lib/__tests__/focusRing.test.js`, no teste `'a barra: os filtros, o botão do balão do celular e o menu de consultores'`, logo antes de `    const menu = renderToString(createElement(ConsultoresMenu, { resp: [], people, onResp: noop }));`, acrescente:

```js
    // Em Leads parados, o corte de dias também leva o anel.
    const parados = renderToString(createElement(RelatoriosToolbar, {
      period: mes, todayKey: TODAY, onPeriod: noop, onRange: noop, showPeriod: false, dias: 7, onDias: noop,
      resp: [], people, onResp: noop, origem: null, origens: ['Instagram'], onOrigem: noop,
      funnel: 'all', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop,
    }));
    expect(botaoDe(parados, 'Sem registro há mais de')).toHaveLength(1);
    expect(semAnel(botaoDe(parados, 'Sem registro há mais de'))).toEqual([]);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosBarra.test.js src/lib/__tests__/relatoriosBarra.behavior.test.js src/lib/__tests__/focusRing.test.js`
Expected: FAIL: a barra ainda mostra o período e o `DiasControl` não existe.

- [ ] **Step 3: Implementar**

Em `src/views/relatorios/RelatoriosToolbar.jsx`, troque o começo do comentário do topo:

```js
// Barra dos Relatórios (spec 2026-10-09, "A barra de cima"): o período e, no
// modo mês, as setas e a lista dos 12 meses; os consultores, a origem e o
// funil. Tudo vem do endereço e volta para ele pela tela (on*). Abaixo de md
```

por:

```js
// Barra dos Relatórios (spec 2026-10-09, "A barra de cima"): o período e, no
// modo mês, as setas e a lista dos 12 meses; os consultores, a origem e o
// funil. Em Leads parados, que é retrato de agora, o período sai e entra no
// lugar dele o corte "sem registro há mais de" (showPeriod falso). Tudo vem do
// endereço e volta para ele pela tela (on*). Abaixo de md
```

Troque `import { ChevronDown, Filter, Layers, SlidersHorizontal, Users } from 'lucide-react';` por `import { ChevronDown, Clock, Filter, Layers, SlidersHorizontal, Users } from 'lucide-react';`.

Troque:

```js
import { FOCUS_RING } from '../../components/focusRing.js';
import { MonthControl } from '../dashboard/OperacionalToolbar.jsx';
```

por:

```js
import { FOCUS_RING } from '../../components/focusRing.js';
import { DIAS_PARADOS } from '../../lib/screenParams.js';
import { MonthControl } from '../dashboard/OperacionalToolbar.jsx';
```

Troque:

```jsx
export function RelatoriosToolbar(props) {
  const { period } = props;
```

por (o texto do `SelectItem` fica numa linha própria, sem `key=` junto, por causa da varredura dos filtros):

```jsx
// O corte de Leads parados: "Sem registro há mais de" e os dias, que o botão
// diz. O texto de fora é só visual (aria-hidden): o nome do botão já o leva, e
// o combobox lê os dias como valor. Os dias saem da mesma lista do endereço
// (DIAS_PARADOS). Exportado para o teste.
const diasText = (d) => `${d} dias`;
export function DiasControl({ dias, onDias, compact = false }) {
  return (
    <div className={cn('flex items-center gap-2', compact && 'flex-col items-stretch gap-1')}>
      <span aria-hidden="true" className="whitespace-nowrap text-[12.5px] font-semibold text-muted-foreground">Sem registro há mais de</span>
      <Select value={String(dias)} onValueChange={(v) => onDias(Number(v))}>
        <SelectPrimitive.Trigger asChild>
          <FilterButton label="Sem registro há mais de" icon={Clock} active={false} text={diasText(dias)} compact={compact} />
        </SelectPrimitive.Trigger>
        <SelectContent position="popper" className="border-border">
          {DIAS_PARADOS.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {diasText(d)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RelatoriosToolbar(props) {
  const { period, showPeriod = true } = props;
```

Troque:

```jsx
  const controls = (compact) => (
    <>
      <PeriodControl period={period} todayKey={props.todayKey} onPeriod={props.onPeriod} onRange={props.onRange} compact={compact} />
      {period.kind === 'mes' && (
```

por:

```jsx
  const controls = (compact) => (
    <>
      {!showPeriod && <DiasControl dias={props.dias} onDias={props.onDias} compact={compact} />}
      {showPeriod && <PeriodControl period={period} todayKey={props.todayKey} onPeriod={props.onPeriod} onRange={props.onRange} compact={compact} />}
      {showPeriod && period.kind === 'mes' && (
```

E troque a última linha da barra:

```jsx
      <span className="num min-w-0 truncate text-[12.5px] font-semibold text-muted-foreground md:hidden">{period.label}</span>
```

por:

```jsx
      <span className="num min-w-0 truncate text-[12.5px] font-semibold text-muted-foreground md:hidden">
        {showPeriod ? period.label : `Sem registro há mais de ${diasText(props.dias)}`}
      </span>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatoriosBarra.test.js src/lib/__tests__/relatoriosBarra.behavior.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: PASS, 3 testes novos (1 na barra e 2 no comportamento; o do anel é um trecho a mais num teste que já existia).

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/views/relatorios/RelatoriosToolbar.jsx`
Expected: sem erro.

```bash
git add src/views/relatorios/RelatoriosToolbar.jsx src/lib/__tests__/relatoriosBarra.test.js src/lib/__tests__/relatoriosBarra.behavior.test.js src/lib/__tests__/focusRing.test.js
git commit -m "feat: corte de dias de Leads parados na barra dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Os três submenus na tela

**Files:**
- Create: `src/views/relatorios/VisitasSection.jsx`, `src/views/relatorios/PerdasSection.jsx`, `src/views/relatorios/ParadosSection.jsx`
- Modify: `src/lib/routes.js` (`RELATORIOS_SUBS`), `src/lib/relatoriosRail.js`, `src/views/relatorios/RelatoriosView.jsx`
- Test: `src/lib/__tests__/relatoriosSubmenus.behavior.test.js` (novo), `src/lib/__tests__/routes.test.js`, `src/lib/__tests__/relatoriosRail.test.js`, `src/lib/__tests__/focusRing.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/lib/__tests__/relatoriosSubmenus.behavior.test.js`:

```js
// @vitest-environment jsdom
// Os três submenus do PR 2 na tela de verdade (jsdom): Visitas e aulas
// experimentais, Perdas e Leads parados. Os números que filtram a lista, os
// recortes, as colunas, o aviso do dado, a planilha e, em Leads parados, o
// corte de dias no lugar do período e a carga que não pede mês nenhum. O molde
// é o do relatoriosTela.behavior.test.js: a carga do painel é trocada pelas
// fixtures do CRM e responde como a de verdade (o mesmo objeto enquanto o
// pedido é o mesmo), e só o Date e o intervalo do relógio da tela são falsos.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { VISITAS_COLUMNS } from '../relatorios/leads/visitas.js';
import { PERDAS_COLUMNS } from '../relatorios/leads/perdas.js';
import { PARADOS_COLUMNS } from '../relatorios/leads/parados.js';
import { makeCtx, NOW, D } from './fixtures/crmCtx.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const m = vi.hoisted(() => ({ all: null, args: null, cache: new Map(), download: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources }));
vi.mock('../csvExport.js', async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: m.download }));

function useCrmSources(args) {
  m.args = args;
  const keys = args.monthKeys.join(',');
  if (!m.cache.has(keys)) {
    const months = Object.fromEntries(args.monthKeys.filter((k) => m.all.months[k]).map((k) => [k, m.all.months[k]]));
    m.cache.set(keys, { months, leadsById: m.all.leadsById, loading: args.monthKeys.some((k) => !m.all.months[k]), failedKeys: [] });
  }
  return m.cache.get(keys);
}

const { RelatoriosView } = await import('../../views/relatorios/RelatoriosView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'relatorios' };
const GESTORA = { id: 'ana', name: 'Ana Ribeiro', role: 'admin', tenantId: 'acad', authUid: 'a1' };
const EQUIPE = [GESTORA, { id: 'diego', name: 'Diego Santos', role: 'consultant', tenantId: 'acad', authUid: 'd1' }];
const NOMES = { s1: 'Sofia Alves', s2: 'Samuel Brito', s3: 'Sílvia Costa', s4: 'Sérgio Dias', s5: 'Sandra Esteves', a2: 'Alice Gomes', a3: 'André Lima' };
const nomeado = (l) => (NOMES[l.id] ? { ...l, name: NOMES[l.id] } : l);
const MES_VAZIO = { leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] };

// Setembro em andamento e agosto fechado, com nome em cada lead e julho vazio.
function fontesDoPainel() {
  const c = makeCtx();
  const months = Object.fromEntries(Object.entries(c.months).map(([key, mes]) => [key, {
    ...mes, leadsCreated: mes.leadsCreated.map(nomeado), converted: mes.converted.map(nomeado), lost: mes.lost.map(nomeado),
  }]));
  return { months: { '2026-07': MES_VAZIO, ...months }, leadsById: new Map([...c.leadsById].map(([id, l]) => [id, nomeado(l)])) };
}
const fixtures = makeCtx();
const TELA = {
  db: {}, appUser: GESTORA, usersList: EQUIPE, funnels: fixtures.funnels,
  sources: [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação' }, { name: 'Site' }],
  // Os leads em aberto que o app tem na memória e as interações do mês, para Leads parados.
  liveLeads: fixtures.liveLeads.map(nomeado), interactions: fixtures.months['2026-09'].interactions,
  onSection: () => {},
};

function Sonda() {
  return h('output', { 'data-sonda': '' }, useLocation().search);
}

let root = null;
let container = null;
let avisos = [];
const arvore = (url, props) => h(MemoryRouter, { initialEntries: [url] },
  h(LeadProfileContext.Provider, { value: profile }, h(RelatoriosView, { ...TELA, ...props })),
  h(Sonda));
async function montar(url, props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(arvore(url, props)); });
}
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  m.download.mockClear();
  m.args = null;
  m.all = fontesDoPainel();
  m.cache.clear();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  expect(avisos).toEqual([]);
});

const clicar = async (el) => { await act(async () => { el.click(); }); };
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const recorte = (nome) => container.querySelector(`button [title^="${nome}"]`)?.closest('button');
const gatilho = (nome) => container.querySelector(`button[aria-label="${nome}"]`);
const opcao = (texto) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === texto);
const submenu = (texto) => [...container.querySelectorAll('nav[aria-label="Relatórios"] button')].find((b) => b.textContent.includes(texto));
const sonda = () => container.querySelector('output[data-sonda]').textContent;
const linhas = () => [...container.querySelectorAll('tbody tr')];
const nomesDaLista = () => linhas().map((tr) => tr.firstElementChild.textContent);
const fichas = () => [...container.querySelectorAll('tbody a[href]')].map((a) => a.getAttribute('href').split('/').pop()).sort();
const linhaDe = (id) => linhas().find((tr) => tr.querySelector(`a[href$="/ficha/${id}"]`));
const celula = (tr, coluna) => tr.children[[...container.querySelectorAll('thead th')].findIndex((th) => th.textContent === coluna)];
const heroi = () => container.querySelector('.num.font-display')?.textContent;
const cartao = (titulo) => [...container.querySelectorAll('h3')].find((t) => t.textContent === titulo).closest('section');
const grade = (titulo) => cartao(titulo).parentElement;
const AVISO = 'os agendamentos estão incompletos';

describe('Visitas e aulas experimentais', () => {
  const abrir = (url = '/acad/relatorios/visitas-e-aulas') => montar(url, { section: 'visitas-e-aulas' });

  it('o comparecimento, os cinco números, o aviso do mês em andamento e a lista em ordem de data', async () => {
    await abrir();
    expect(container.querySelector('h2').textContent).toBe('Visitas e aulas experimentais');
    expect(heroi()).toBe('50%');
    expect(submenu('Visitas e aulas experimentais').getAttribute('aria-current')).toBe('page');
    const numero = (nome) => botao(nome).textContent;
    expect(numero('Marcados')).toContain('3');
    expect(numero('A acontecer')).toContain('1');
    // Marcados soma os que ainda vão acontecer e fica sem variação; os outros ficam sem base contra agosto.
    expect(numero('Marcados')).not.toContain('sem base');
    expect(numero('Vieram')).toContain('sem base');
    expect(container.textContent).toContain('Marcados inclui os agendamentos que vão acontecer');
    expect(container.textContent).toContain(AVISO);
    expect(nomesDaLista()).toEqual(['Sofia Alves', 'Samuel Brito', 'Sérgio Dias']);
    expect(celula(linhaDe('s1'), 'Dia e hora').textContent).toBe('04/09 10:00');
  });

  it('"Faltaram" filtra a lista, e a célula do que não se aplica é um traço que se lê', async () => {
    await abrir();
    await clicar(botao('Faltaram'));
    expect(sonda()).toBe('?recorte=situacao%3Afaltaram');
    expect(fichas()).toEqual(['s2']);
    const modalidade = celula(linhaDe('s2'), 'Modalidade');
    expect(modalidade.querySelector('[aria-hidden="true"]').textContent).toBe('—');
    expect(modalidade.querySelector('.sr-only').textContent).toBe('não se aplica');
    expect(celula(linhaDe('s2'), 'Desfecho').firstElementChild.className).toContain('text-rose-700');
  });

  it('os cinco números numa linha a partir de xl, e os quatro recortes dois por dois, com de quem é o dado', async () => {
    await abrir();
    expect(botao('Marcados').parentElement.className).toContain('xl:grid-cols-5');
    expect(botao('Marcados').parentElement.className).not.toContain('xl:grid-cols-6');
    expect(grade('Por tipo').className).toContain('sm:grid-cols-2');
    expect(grade('Por tipo').className).not.toMatch(/grid-cols-3/);
    for (const t of ['Por consultor', 'Por unidade', 'Por modalidade']) expect(grade(t), t).toBe(grade('Por tipo'));
    expect(cartao('Por unidade').textContent).toContain('Só a visita guarda a unidade.');
    expect(cartao('Por modalidade').textContent).toContain('Só a aula experimental guarda a modalidade.');
  });

  it('no período fechado com base dos dois lados, sem o aviso e sem a frase de Marcados', async () => {
    await abrir('/acad/relatorios/visitas-e-aulas?de=2026-09-08&ate=2026-09-13');
    expect(container.textContent).not.toContain(AVISO);
    expect(container.textContent).not.toContain('Marcados inclui');
    expect(botao('Marcados').textContent).toContain('▼ 100%');
  });

  it('o exportar leva a lista até o fim do mês, com as colunas dela', async () => {
    await abrir();
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-visitas-e-aulas-2026-09-01-a-2026-09-30.csv');
    const tabela = csv.split('\r\n');
    expect(tabela[0]).toBe(VISITAS_COLUMNS.map((c) => c.label).join(';'));
    expect(tabela).toHaveLength(1 + 3);
    expect(csv).toContain('20/09/2026 10:00');
  });
});

describe('Perdas', () => {
  // As fixtures param antes de a etapa da perda começar a ser gravada (14/09, 18h10). Em 20/09 setembro tem a etapa.
  beforeEach(() => { vi.setSystemTime(D(9, 20, 12)); });
  const abrir = (url = '/acad/relatorios/perdas') => montar(url, { section: 'perdas' });

  it('o total, o aviso fixo, a etapa parcial e a lista com há quanto tempo foi a perda', async () => {
    await abrir();
    expect(container.querySelector('h2').textContent).toBe('Perdas');
    expect(heroi()).toBe('1');
    expect(container.textContent).toContain('Esta conta mostra só quem continua perdido hoje.');
    expect(cartao('Por etapa').textContent).toContain('Parcial: a etapa só é gravada desde 14/09/2026.');
    expect(cartao('Por etapa').textContent).toContain('Contato feito');
    expect(nomesDaLista()).toEqual(['Sílvia Costa']);
    expect(celula(linhaDe('s3'), 'Perda').textContent).toBe('06/09 · há 14 dias');
    // O número grande não leva cor.
    expect(container.querySelector('.num.font-display').className).not.toMatch(/text-(rose|emerald)/);
  });

  it('em agosto a etapa fica sem base', async () => {
    await abrir('/acad/relatorios/perdas?mes=2026-08');
    expect(cartao('Por etapa').textContent).toContain('Sem base: a etapa da perda só é gravada desde 14/09/2026.');
  });

  it('um motivo filtra a lista e o exportar baixa a lista de repescagem', async () => {
    await abrir();
    await clicar(recorte('Preço'));
    expect(sonda()).toBe(`?recorte=${encodeURIComponent('motivo:Preço')}`);
    expect(container.textContent).toContain('Motivo: Preço');
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-perdas-2026-09-01-a-2026-09-20.csv');
    expect(csv.split('\r\n')[0]).toBe(PERDAS_COLUMNS.map((c) => c.label).join(';'));
    expect(csv.split('\r\n')[1]).toContain('Sílvia Costa;');
  });
});

describe('Leads parados', () => {
  const abrir = (url = '/acad/relatorios/parados', props = {}) => montar(url, { section: 'parados', ...props });

  it('sem período na barra, sem mês para carregar, e os números saem dos leads em aberto que o app já tem', async () => {
    await abrir();
    expect(gatilho('Período')).toBeNull();
    expect(gatilho('Sem registro há mais de').textContent).toContain('7 dias');
    expect(m.args.monthKeys).toEqual([]);
    expect(container.querySelector('[role="status"]').textContent).toBe('');
    expect(heroi()).toBe('4');
    expect(container.textContent).toContain('de 5 em aberto agora');
    expect(botao('Sem próximo passo').textContent).toContain('3');
    expect(botao('Sem registro há mais de 7 dias').textContent).toContain('4');
    expect(container.textContent).toContain('A lista mostra cada um uma vez.');
    // Quem está há mais dias sem registro primeiro.
    expect(nomesDaLista()).toEqual(['Alice Gomes', 'André Lima', 'Samuel Brito', 'Sandra Esteves']);
    expect(celula(linhaDe('a3'), 'Próximo contato').textContent).toBe('Sem próximo passo');
    expect(celula(linhaDe('a3'), 'Na etapa').textContent).toBe('antes de 14/09');
  });

  it('o corte de dias vai para o endereço, muda o terceiro número e anda junto ao trocar de submenu', async () => {
    const onSection = vi.fn();
    await abrir('/acad/relatorios/parados', { onSection });
    gatilho('Sem registro há mais de').focus();
    await tecla(gatilho('Sem registro há mais de'), 'Enter');
    await tecla(opcao('30 dias'), 'Enter');
    expect(sonda()).toBe('?dias=30');
    expect(botao('Sem registro há mais de 30 dias').textContent).toContain('2');
    await clicar(submenu('Entrada de leads'));
    expect(onSection).toHaveBeenCalledWith('entrada', '?dias=30');
  });

  it('"Sem próximo passo" filtra a lista, e o exportar leva o dia de hoje no nome', async () => {
    await abrir();
    await clicar(botao('Sem próximo passo'));
    expect(sonda()).toBe('?recorte=situacao%3Asem-proximo-passo');
    expect(fichas()).toEqual(['a3', 's2', 's5']);
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-parados-2026-09-14.csv');
    expect(csv.split('\r\n')[0]).toBe(PARADOS_COLUMNS.map((c) => c.label).join(';'));
    expect(csv.split('\r\n')).toHaveLength(1 + 3);
  });

  it('os três números ficam numa linha a partir de sm', async () => {
    await abrir();
    const numeros = botao('Sem próximo passo').parentElement.className.split(/\s+/);
    expect(numeros).toEqual(expect.arrayContaining(['sm:grid-cols-3', 'xl:grid-cols-3']));
    expect(numeros).not.toContain('xl:grid-cols-6');
  });
});
```

Em `src/lib/__tests__/routes.test.js`, no teste `'Relatórios lê os submenus, abre sem submenu e marca o desconhecido'`, troque:

```js
    for (const [seg, id] of [['entrada', 'entrada'], ['conversao', 'conversao']]) {
```

por:

```js
    for (const [seg, id] of [
      ['entrada', 'entrada'], ['conversao', 'conversao'], ['visitas-e-aulas', 'visitas-e-aulas'], ['perdas', 'perdas'], ['parados', 'parados'],
    ]) {
```

E troque:

```js
    expect(parseAppPath(`/${T}/relatorios/perdas`)).toMatchObject({ screen: 'relatorios', subUnknown: true });
```

por:

```js
    expect(parseAppPath(`/${T}/relatorios/clientes`)).toMatchObject({ screen: 'relatorios', subUnknown: true });
    expect(hrefFor(T, 'relatorios', { sub: 'visitas-e-aulas' })).toBe(`/${T}/relatorios/visitas-e-aulas`);
```

Em `src/lib/__tests__/relatoriosRail.test.js`, troque o segundo teste inteiro:

```js
  it('um grupo, Leads, com Entrada de leads e Conversão, nessa ordem e com a pergunta de cada um', () => {
    expect(RELATORIOS_RAIL_GROUPS.map((g) => g.label)).toEqual(['Leads']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.label)).toEqual(['Entrada de leads', 'Conversão']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.hint)).toEqual(['Quantos chegaram e de onde', 'Quantos viraram matrícula']);
  });
```

por:

```js
  it('um grupo, Leads, com os cinco submenus na ordem da spec e com a pergunta de cada um', () => {
    expect(RELATORIOS_RAIL_GROUPS.map((g) => g.label)).toEqual(['Leads']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.label)).toEqual([
      'Entrada de leads', 'Conversão', 'Visitas e aulas experimentais', 'Perdas', 'Leads parados',
    ]);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.hint)).toEqual([
      'Quantos chegaram e de onde', 'Quantos viraram matrícula', 'Quem veio e quem faltou', 'Por que e onde se perderam',
      'Quem precisa de um próximo passo',
    ]);
  });
```

E troque:

```js
    expect(relatoriosSection('perdas')).toBe('entrada');
```

por:

```js
    expect(relatoriosSection('perdas')).toBe('perdas');
    expect(relatoriosSection('clientes')).toBe('entrada');
```

Em `src/lib/__tests__/focusRing.test.js`, no teste `'a lista ao lado'`, troque `    expect(tagsOf(nav, 'button')).toHaveLength(2);` por `    expect(tagsOf(nav, 'button')).toHaveLength(5);`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosSubmenus.behavior.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/relatoriosRail.test.js src/lib/__tests__/focusRing.test.js`
Expected: FAIL: os submenus novos não existem na tabela de endereços nem na lista ao lado, e a tela abre a Entrada no lugar deles.

- [ ] **Step 3: Os submenus no endereço e na lista ao lado**

Em `src/lib/routes.js`, troque:

```js
// Submenus dos Relatórios (spec 2026-10-09). Hoje só o relatório de Leads, com
// Entrada de leads e Conversão. O PR 2 acrescenta visitas-e-aulas, perdas e
// parados. O id é também o segmento, e a lista ao lado
// (src/lib/relatoriosRail.js) usa os mesmos ids.
export const RELATORIOS_SUBS = Object.freeze({
  entrada: 'entrada',
  conversao: 'conversao',
});
```

por:

```js
// Submenus dos Relatórios (spec 2026-10-09). Hoje só o relatório de Leads, com
// os cinco submenus. O id é também o segmento, e a lista ao lado
// (src/lib/relatoriosRail.js) usa os mesmos ids.
export const RELATORIOS_SUBS = Object.freeze({
  entrada: 'entrada',
  conversao: 'conversao',
  'visitas-e-aulas': 'visitas-e-aulas',
  perdas: 'perdas',
  parados: 'parados',
});
```

Em `src/lib/relatoriosRail.js`, logo depois da linha do item `conversao`, acrescente:

```js
      Object.freeze({ id: 'visitas-e-aulas', label: 'Visitas e aulas experimentais', hint: 'Quem veio e quem faltou' }),
      Object.freeze({ id: 'perdas', label: 'Perdas', hint: 'Por que e onde se perderam' }),
      Object.freeze({ id: 'parados', label: 'Leads parados', hint: 'Quem precisa de um próximo passo' }),
```

- [ ] **Step 4: As três telas**

Crie `src/views/relatorios/VisitasSection.jsx`:

```jsx
// Visitas e aulas experimentais (spec 2026-10-09, submenu 3): o comparecimento
// com a variação, os cinco números que filtram a lista (marcados, vieram,
// faltaram, sem desfecho e a acontecer), os recortes por tipo, consultor,
// unidade e modalidade, e a lista dos agendamentos. Desenhada com a skill
// frontend-design, no molde da Conversão.
//
// Os cinco números ficam numa linha só a partir de xl (xl:grid-cols-5), sem a
// sexta coluna vazia da grade padrão. Os quatro recortes ficam em duas colunas a
// partir de sm, como uma grade dois por dois. A visita guarda a unidade e a aula
// guarda a modalidade e o professor, então cada cartão diz de quem é o dado, e a
// célula do que não se aplica é um traço apagado.
//
// A lista não quebra linha, como as outras: tipo, dia e hora e desfecho numa
// linha só, unidade, modalidade, professor e consultor cortam em 9rem com o
// texto inteiro no title, e o nome do lead não encolhe de 10rem. A linha é um
// agendamento: o link vai para a ficha do lead dele (leadId). "Sem desfecho" é o
// único âmbar da lista, porque é o que ainda pede alguém marcar.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtScreenDateTime } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL } from '../../lib/relatorios/leads/visitas.js';
import {
  ReportHeader, HeroNumber, NumberTiles, CountBreakdown, ReportList, ReportNotice, CellText, GREEN_TEXT,
} from './ReportParts.jsx';

const OUTCOME_TONE = Object.freeze({
  veio: GREEN_TEXT,
  faltou: 'text-rose-700 dark:text-rose-400',
  'sem-desfecho': 'text-amber-700 dark:text-amber-300',
  'a-acontecer': 'text-muted-foreground',
});

// O traço da célula que não se aplica ao tipo do agendamento. O leitor de tela
// ouve "não se aplica" no lugar do traço.
const NotApplicable = () => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">—</span>
    <span className="sr-only">não se aplica</span>
  </span>
);
const textOrDash = (text) => (text == null ? <NotApplicable /> : <CellText text={text} />);

const columnsOf = (year) => [
  {
    key: 'nome',
    label: 'Nome',
    className: 'min-w-[10rem]',
    render: (r) => (
      <LeadLink leadId={r.leadId} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'tipo', label: 'Tipo', className: 'whitespace-nowrap', render: (r) => r.type },
  { key: 'diaHora', label: 'Dia e hora', className: 'num whitespace-nowrap', render: (r) => fmtScreenDateTime(r.at, year) },
  { key: 'unidade', label: 'Unidade', render: (r) => textOrDash(r.unit) },
  { key: 'modalidade', label: 'Modalidade', render: (r) => textOrDash(r.modality) },
  { key: 'professor', label: 'Professor', render: (r) => textOrDash(r.professor) },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => <span className={cn('font-semibold', OUTCOME_TONE[r.outcome])}>{OUTCOME_LABEL[r.outcome]}</span>,
  },
];

export function VisitasSection({ report, compareText, listId, year, onCut, exportAction, apptsPartial = false }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Visitas e aulas experimentais"
        question="Quantos agendamentos o período teve, quem veio, quem faltou e quem ainda vem."
        action={exportAction}
      />
      <HeroNumber
        value={report.attendance.value}
        percent
        tone="good"
        label="de comparecimento"
        delta={report.attendance.delta}
        compareText={compareText}
      />
      {apptsPartial && (
        <ReportNotice>
          Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
          {' '}
          Quando o período ou o comparado começa antes disso, os números ficam sem variação.
        </ReportNotice>
      )}
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} className="xl:grid-cols-5" />
      {report.running && (
        <p className="m-0 text-pretty text-[12px] text-muted-foreground">
          O período ainda está em andamento: Marcados inclui os agendamentos que vão acontecer e por isso fica sem variação.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CountBreakdown title="Por tipo" rows={report.byType} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por unidade" hint="Só a visita guarda a unidade." rows={report.byUnit} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por modalidade" hint="Só a aula experimental guarda a modalidade." rows={report.byModality} cut={report.cut} onCut={onCut} />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'agendamento' : 'agendamentos'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum agendamento neste filtro.' : 'Nenhum agendamento neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
```

Crie `src/views/relatorios/PerdasSection.jsx`:

```jsx
// Perdas (spec 2026-10-09, submenu 4): o total com a variação (cair é bom), o
// aviso fixo de quem volta ao funil, os recortes por motivo, etapa, origem e
// consultor, e a lista de repescagem. Desenhada com a skill frontend-design, no
// molde da Entrada de leads.
//
// O número grande não leva cor: um zero vermelho diria que algo deu errado. A
// variação diz se piorou ou melhorou (lowerBetter). Os quatro recortes ficam em
// duas colunas a partir de sm. A etapa só é gravada desde 14/09/2026: o período
// que acaba antes fica sem base, e o que atravessa a data diz que é parcial.
//
// A lista não quebra linha, como as outras: motivo, etapa, origem e consultor
// cortam em 9rem com o texto inteiro no title, e a perda diz o dia e há quanto
// tempo ("12/09 · há 8 dias").
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtScreenDate, STAGE_SINCE_TEXT } from '../../lib/relatorios/leads/base.js';
import { plural } from '../../lib/crm/format.js';
import { ReportHeader, HeroNumber, CountBreakdown, ReportList, ReportNotice, CellText } from './ReportParts.jsx';

const sinceText = (days) => (days === 0 ? 'hoje' : `há ${plural(days, 'dia', 'dias')}`);

const columnsOf = (year) => [
  {
    key: 'nome',
    label: 'Nome',
    className: 'min-w-[10rem]',
    render: (r) => (
      <LeadLink leadId={r.id} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'motivo', label: 'Motivo', render: (r) => <CellText text={r.reason} /> },
  { key: 'etapa', label: 'Etapa', render: (r) => <CellText text={r.stage} /> },
  {
    key: 'perda',
    label: 'Perda',
    className: 'num whitespace-nowrap',
    render: (r) => `${fmtScreenDate(r.lostAt, year)} · ${sinceText(r.days)}`,
  },
  { key: 'origem', label: 'Origem', render: (r) => <CellText text={r.source} /> },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
];

const STAGE_HINT = Object.freeze({
  partial: `Parcial: a etapa só é gravada desde ${STAGE_SINCE_TEXT}. As perdas de antes ficam em Sem etapa.`,
});

export function PerdasSection({ report, compareText, listId, year, onCut, exportAction }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Perdas"
        question="Quantos leads se perderam no período, por qual motivo e em que etapa."
        action={exportAction}
      />
      <HeroNumber
        value={report.total}
        label={report.total === 1 ? 'perda' : 'perdas'}
        delta={report.delta}
        lowerBetter
        compareText={compareText}
      />
      <ReportNotice>
        Esta conta mostra só quem continua perdido hoje. Quando um lead perdido volta ao funil ou matricula, o sistema apaga a data e o motivo da perda, e ele sai daqui.
      </ReportNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <CountBreakdown title="Por motivo" rows={report.byReason} cut={report.cut} onCut={onCut} />
        <CountBreakdown
          title="Por etapa"
          hint={STAGE_HINT[report.stageBase]}
          rows={report.byStage}
          cut={report.cut}
          onCut={onCut}
          emptyText={report.stageBase === 'none' ? `Sem base: a etapa da perda só é gravada desde ${STAGE_SINCE_TEXT}.` : 'Nada no período.'}
        />
        <CountBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhuma perda neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
```

Crie `src/views/relatorios/ParadosSection.jsx`:

```jsx
// Leads parados (spec 2026-10-09, submenu 5): quantos leads em aberto estão
// parados agora, os três números que filtram a lista (sem próximo passo,
// contato atrasado e sem registro há mais de N dias), o recorte por consultor e
// a lista. É retrato de agora: sem período, sem comparação e sem variação. O N
// vem do corte da barra. Desenhada com a skill frontend-design, no molde da
// Conversão.
//
// O número grande é a lista sem filtro, com cada lead uma vez, e o texto ao
// lado dá a base ("de 210 em aberto agora"). Os três números ficam numa linha a
// partir de sm (sm:grid-cols-3 e xl:grid-cols-3), sem as colunas vazias da
// grade padrão. Um lead pode estar em mais de um número, e a frase embaixo diz
// isso, porque a soma dos três passa do número grande.
//
// A lista não quebra linha: etapa, dias na etapa, último registro e próximo
// contato numa linha só, e o consultor corta em 9rem. O atraso é o único
// vermelho da lista.
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { STAGE_TRACKING_SINCE } from '../../lib/crm/scope.js';
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { ReportHeader, HeroNumber, NumberTiles, CountBreakdown, ReportList, CellText } from './ReportParts.jsx';

const days = (n) => plural(n, 'dia', 'dias');

// "12/10 · há 3 dias", ou só o dia quando faz menos de um dia (a régua do selo
// de dias sem contato, que não conta o dia parcial). Sem registro nenhum, conta
// do cadastro.
function lastRecordText(r, year) {
  const ago = r.quiet >= 1 ? `há ${days(r.quiet)}` : null;
  if (!r.lastAt) return ago ? `Nenhum · cadastro ${ago}` : 'Nenhum';
  const day = fmtScreenDate(r.lastAt, year);
  return ago ? `${day} · ${ago}` : day;
}

const columnsOf = (year) => [
  {
    key: 'nome',
    label: 'Nome',
    className: 'min-w-[10rem]',
    render: (r) => (
      <LeadLink leadId={r.id} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'etapa', label: 'Etapa', className: 'whitespace-nowrap', render: (r) => r.stage },
  {
    key: 'naEtapa',
    label: 'Na etapa',
    className: 'num whitespace-nowrap',
    render: (r) => (r.stageDays == null
      ? <span className="text-muted-foreground">{`antes de ${fmtScreenDate(STAGE_TRACKING_SINCE, year)}`}</span>
      : days(r.stageDays)),
  },
  { key: 'registro', label: 'Último registro', className: 'num whitespace-nowrap', render: (r) => lastRecordText(r, year) },
  {
    key: 'proximo',
    label: 'Próximo contato',
    className: 'num whitespace-nowrap',
    render: (r) => {
      if (!r.next) return <span className="text-muted-foreground">Sem próximo passo</span>;
      const day = fmtScreenDate(r.next, year);
      return r.late > 0
        ? <span className="font-semibold text-rose-700 dark:text-rose-400">{`${day} · ${days(r.late)} de atraso`}</span>
        : day;
    },
  },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
];

export function ParadosSection({ report, listId, year, onCut, exportAction }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Leads parados"
        question="Quem está em aberto agora sem próximo passo, com contato atrasado ou sem registro há dias."
        action={exportAction}
      />
      <HeroNumber
        value={report.total}
        label={report.total === 1 ? 'lead parado' : 'leads parados'}
        compareText={`de ${fmtNum(report.open)} em aberto agora`}
      />
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} className="sm:grid-cols-3 xl:grid-cols-3" />
      <p className="m-0 text-pretty text-[12px] text-muted-foreground">
        Um lead pode estar em mais de um número. A lista mostra cada um uma vez.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <CountBreakdown title="Por consultor" hint="O dono do lead hoje." rows={report.byOwner} cut={report.cut} onCut={onCut} emptyText="Nenhum lead parado agora." />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead parado agora.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Todos os leads em aberto têm próximo passo, contato em dia e registro recente.'}
      />
    </div>
  );
}
```

- [ ] **Step 5: A tela escolhe a conta e a tela pelo submenu**

Em `src/views/relatorios/RelatoriosView.jsx`, faça estas trocas.

O comentário do topo:

```js
// Tela dos Relatórios (spec docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md).
// Hoje, o relatório de Leads, com Entrada de leads e Conversão. O submenu vem
// do endereço (section, a sub-tela que o App lê) e o período e os filtros vêm
// da query (useScreenParams). As contas são as do painel CRM, em
// src/lib/relatorios/leads/, e a carga é a do painel (useCrmSources), com os
// meses do início do comparado até o mês atual. Desenhada com a skill
// frontend-design.
```

por:

```js
// Tela dos Relatórios (spec docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md).
// Hoje, o relatório de Leads, com cinco submenus: Entrada de leads, Conversão,
// Visitas e aulas experimentais, Perdas e Leads parados. O submenu vem do
// endereço (section, a sub-tela que o App lê) e o período e os filtros vêm da
// query (useScreenParams). As contas são as do painel CRM, em
// src/lib/relatorios/leads/, e a carga é a do painel (useCrmSources), com os
// meses do início do comparado até o mês atual. Leads parados é retrato de
// agora: não pede mês nenhum e lê os leads em aberto que o app já tem
// (liveLeads) e as interações do mês que chegam ao vivo. Desenhada com a skill
// frontend-design.
```

Os imports das contas (a Task 4 já trouxe o `apptsPartialOf` da base):

```js
import { exportFileName, compareTextOf, apptsPartialOf } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport } from '../../lib/relatorios/leads/conversao.js';
```

por:

```js
import { exportFileName, snapshotFileName, compareTextOf, apptsPartialOf } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport } from '../../lib/relatorios/leads/conversao.js';
import { visitasReport } from '../../lib/relatorios/leads/visitas.js';
import { perdasReport } from '../../lib/relatorios/leads/perdas.js';
import { paradosReport } from '../../lib/relatorios/leads/parados.js';
```

As telas e o mapa das contas:

```js
import { EntradaSection } from './EntradaSection.jsx';
import { ConversaoSection } from './ConversaoSection.jsx';

const REPORTS = Object.freeze({ entrada: entradaReport, conversao: conversaoReport });
```

por:

```js
import { EntradaSection } from './EntradaSection.jsx';
import { ConversaoSection } from './ConversaoSection.jsx';
import { VisitasSection } from './VisitasSection.jsx';
import { PerdasSection } from './PerdasSection.jsx';
import { ParadosSection } from './ParadosSection.jsx';

// A conta e a tela de cada submenu, pelo id do endereço (RELATORIOS_SUBS).
const REPORTS = Object.freeze({
  entrada: entradaReport,
  conversao: conversaoReport,
  'visitas-e-aulas': visitasReport,
  perdas: perdasReport,
  parados: paradosReport,
});
const SECTIONS = Object.freeze({
  entrada: EntradaSection,
  conversao: ConversaoSection,
  'visitas-e-aulas': VisitasSection,
  perdas: PerdasSection,
  parados: ParadosSection,
});
// O retrato de agora: sem período na barra, sem mês para carregar e com o dia de hoje no nome do arquivo.
const SNAPSHOT = 'parados';
```

O corte de dias, que vem do endereço:

```js
  const { monthKey, periodo, de, ate, resp, origem, funnel, recorte } = params;
```

por:

```js
  const { monthKey, periodo, de, ate, dias, resp, origem, funnel, recorte } = params;
```

Os meses que a carga pede (o `secao` sobe para antes deles):

```js
  const period = useMemo(() => periodFromParams({ periodo, de, ate, monthKey }, now), [periodo, de, ate, monthKey, now]);
  const cmp = useMemo(() => previousPeriod(period, now), [period, now]);
  // A lista vira texto antes do useMemo: o relógio refaz o período a cada
  // minuto, e a carga só pode mudar quando os meses mudam.
  const keysText = reportMonthKeys(period, cmp, currentKey).join(',');
  const monthKeys = useMemo(() => keysText.split(','), [keysText]);
```

por:

```js
  const secao = relatoriosSection(section);
  const snapshot = secao === SNAPSHOT;
  const period = useMemo(() => periodFromParams({ periodo, de, ate, monthKey }, now), [periodo, de, ate, monthKey, now]);
  const cmp = useMemo(() => previousPeriod(period, now), [period, now]);
  // A lista vira texto antes do useMemo: o relógio refaz o período a cada
  // minuto, e a carga só pode mudar quando os meses mudam. Leads parados não
  // pede mês: com a lista vazia, a carga fica pronta na hora.
  const keysText = snapshot ? '' : reportMonthKeys(period, cmp, currentKey).join(',');
  const monthKeys = useMemo(() => (keysText ? keysText.split(',') : []), [keysText]);
```

O `secao` de antes sai, e o `ctx` leva os leads em aberto e as interações do mês, que Leads parados usa:

```js
  const secao = relatoriosSection(section);
  const ctx = useMemo(
    () => ({ now, users, funnels: funnels || [], sources: sources || [], months: src.months, leadsById: src.leadsById }),
    [now, users, funnels, sources, src.months, src.leadsById]
  );
```

por:

```js
  const ctx = useMemo(
    () => ({
      now, users, funnels: funnels || [], sources: sources || [], months: src.months, leadsById: src.leadsById, liveLeads, interactions,
    }),
    [now, users, funnels, sources, src.months, src.leadsById, liveLeads, interactions]
  );
```

A conta recebe o corte:

```js
    () => (ready ? REPORTS[secao](ctx, { period, cmp, userIds: resp, funnelId, origem, recorte }) : null),
    [ready, secao, ctx, period, cmp, resp, funnelId, origem, recorte]
```

por:

```js
    () => (ready ? REPORTS[secao](ctx, { period, cmp, userIds: resp, funnelId, origem, recorte, dias }) : null),
    [ready, secao, ctx, period, cmp, resp, funnelId, origem, recorte, dias]
```

O nome do arquivo e a tela do submenu:

```jsx
  const doExport = () => {
    if (!exportable) return;
    downloadCsv(exportFileName(secao, shown.period), toCsv(shown.report.exportRows, shown.report.exportColumns));
  };
  const exportAction = canExport ? <ExportButton onExport={doExport} disabled={!exportable} /> : null;
```

por:

```jsx
  // O arquivo leva as datas que a lista cobre: as do período, ou as da janela das
  // Visitas e aulas, que vai até o fim do período; em Leads parados, o dia de hoje.
  const doExport = () => {
    if (!exportable) return;
    const fileName = snapshot ? snapshotFileName(secao, now) : exportFileName(secao, shown.report.window || shown.period);
    downloadCsv(fileName, toCsv(shown.report.exportRows, shown.report.exportColumns));
  };
  const exportAction = canExport ? <ExportButton onExport={doExport} disabled={!exportable} /> : null;
  // A tela do submenu do resultado que está na tela (o de agora ou o de sob o véu, que é sempre o mesmo submenu).
  const Section = SECTIONS[secao];
```

A barra recebe o corte:

```jsx
        <RelatoriosToolbar
          period={period}
```

por:

```jsx
        <RelatoriosToolbar
          showPeriod={!snapshot}
          dias={dias}
          onDias={(v) => setParams({ dias: v })}
          period={period}
```

E o corpo desenha a tela do submenu:

```jsx
            {secao === 'conversao' ? (
              <ConversaoSection
                report={shown.report}
                compareText={compareText}
                listId={listId}
                year={year}
                onCut={onCut}
                exportAction={exportAction}
                apptsPartial={apptsPartialOf(shown.period, shown.cmp)}
              />
            ) : (
              <EntradaSection report={shown.report} compareText={compareText} listId={listId} year={year} onCut={onCut} exportAction={exportAction} />
            )}
```

por:

```jsx
            <Section
              report={shown.report}
              compareText={compareText}
              listId={listId}
              year={year}
              onCut={onCut}
              exportAction={exportAction}
              apptsPartial={apptsPartialOf(shown.period, shown.cmp)}
            />
```

O `listId` não muda: ele já sai do submenu e da query da tela, e a query agora tem o `dias`, então trocar o corte também volta a lista aos 50 primeiros. O `goSection` também não muda: ele leva a query sem o recorte, e o `dias` vai junto, como os filtros da barra.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/relatoriosSubmenus.behavior.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/relatoriosRail.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/relatoriosTela.test.js src/lib/__tests__/relatoriosTela.behavior.test.js`
Expected: PASS. São 12 testes novos no arquivo novo, e os da Entrada e da Conversão continuam passando.

- [ ] **Step 7: Varreduras, lint e a suíte**

Run:
```bash
npx vitest run src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/overscrollGuard.test.js src/lib/__tests__/professorShell.test.js
npx eslint src/views/relatorios src/lib
npx vitest run
```
Expected: as varreduras passam sem mudança (os nomes viram `LeadLink`, nenhuma `key` leva filtro, a lista de pessoas continua só na `RelatoriosView`, a tabela da lista já tem `overscroll-x-contain`), o lint sem erro e a suíte com `B_ARQ + 4` arquivos e `B_TESTES + 59` testes.

- [ ] **Step 8: Commit**

```bash
git add src/views/relatorios/VisitasSection.jsx src/views/relatorios/PerdasSection.jsx src/views/relatorios/ParadosSection.jsx src/lib/routes.js src/lib/relatoriosRail.js src/views/relatorios/RelatoriosView.jsx src/lib/__tests__/relatoriosSubmenus.behavior.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/relatoriosRail.test.js src/lib/__tests__/focusRing.test.js
git commit -m "feat: Visitas e aulas experimentais, Perdas e Leads parados nos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: O balão "Novo" cita os cinco submenus

**Files:**
- Modify: `src/views/relatorios/RelatoriosNovo.jsx`

Só texto, sem teste: o conteúdo do balão fica dentro de um `Dialog` fechado, e o `professorShell.test.js` já cobra o lugar do balão no `App.jsx`.

- [ ] **Step 1: Trocar o texto**

Em `src/views/relatorios/RelatoriosNovo.jsx`, troque:

```jsx
      description="Escolha o período, o consultor, a origem e o funil, e veja quantos leads chegaram e quantos viraram matrícula."
    >
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
        <li><span className="font-semibold text-foreground">Entrada de leads:</span> quantos chegaram, de onde e para qual consultor.</li>
        <li><span className="font-semibold text-foreground">Conversão:</span> dos que chegaram, quantos agendaram, vieram e matricularam.</li>
        <li>Clique num número para ver os nomes e exportar a lista.</li>
```

por:

```jsx
      description="Escolha o período, o consultor, a origem e o funil, e veja os números dos leads em cinco relatórios."
    >
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
        <li><span className="font-semibold text-foreground">Entrada de leads:</span> quantos chegaram, de onde e para qual consultor.</li>
        <li><span className="font-semibold text-foreground">Conversão:</span> dos que chegaram, quantos agendaram, vieram e matricularam.</li>
        <li><span className="font-semibold text-foreground">Visitas e aulas experimentais:</span> quantos agendamentos, quem veio e quem faltou.</li>
        <li><span className="font-semibold text-foreground">Perdas:</span> por qual motivo e em que etapa os leads se perderam.</li>
        <li><span className="font-semibold text-foreground">Leads parados:</span> quem está sem próximo passo, com contato atrasado ou sem registro.</li>
        <li>Clique num número para ver os nomes e exportar a lista.</li>
```

- [ ] **Step 2: A data do balão (pergunta 8)**

O `NOVO_ATE` continua `'2026-11-15'`, a não ser que o Johnny responda a pergunta 8 pedindo outra data, ou que o PR entre depois de 01/11/2026 com a recomendação aceita. Nesse caso, troque a linha `export const NOVO_ATE = '2026-11-15';` pela data de uns 30 dias depois do merge, no formato `AAAA-MM-DD`, e atualize a data no item **Menu e endereço.** da seção "Relatórios" do `CLAUDE.md` (Task 13).

- [ ] **Step 3: Rodar e commit**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js && npx eslint src/views/relatorios/RelatoriosNovo.jsx`
Expected: PASS e sem erro.

```bash
git add src/views/relatorios/RelatoriosNovo.jsx
git commit -m "docs: balão Novo dos Relatórios cita os cinco submenus" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (seção "Relatórios" e um item da seção "Endereço de cada tela")

Cada trecho abaixo aparece uma vez só no `CLAUDE.md` de `593ba16`. Passe o texto novo pelo humanizer antes do commit: direto, sem travessão no meio da frase.

- [ ] **Step 1: Atualizar o que mudou**

Na seção "Endereço de cada tela", troque `` `/relatorios/<submenu>` (entrada e conversao, e entrada é o padrão) `` por `` `/relatorios/<submenu>` (entrada, conversao, visitas-e-aulas, perdas e parados, e entrada é o padrão) ``.

Na seção "Relatórios", troque:

```markdown
começa pelo relatório de Leads, com os submenus Entrada de leads e Conversão. Spec em `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md` e plano em `docs/superpowers/plans/2026-10-09-relatorios-de-leads-pr1.md`. O PR 2 traz Visitas e aulas experimentais, Perdas e Leads parados.
```

por:

```markdown
começa pelo relatório de Leads, com cinco submenus: Entrada de leads, Conversão, Visitas e aulas experimentais, Perdas e Leads parados. Spec em `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md` e planos em `docs/superpowers/plans/2026-10-09-relatorios-de-leads-pr1.md` (os dois primeiros) e `docs/superpowers/plans/2026-10-15-relatorios-de-leads-pr2.md` (os outros três).
```

Troque `` `SCREENS.relatorios` tem `RELATORIOS_SUBS` (hoje `entrada` e `conversao`, com `entrada` como padrão) `` por `` `SCREENS.relatorios` tem `RELATORIOS_SUBS` (`entrada`, `conversao`, `visitas-e-aulas`, `perdas` e `parados`, com `entrada` como padrão) ``.

Troque:

```markdown
- **Endereço.** `mes`, `periodo`, `de`, `ate`, `resp`, `origem`, `funil` e `recorte`, na tabela de `src/lib/screenParams.js`.
```

por:

```markdown
- **Endereço.** `mes`, `periodo`, `de`, `ate`, `dias`, `resp`, `origem`, `funil` e `recorte`, na tabela de `src/lib/screenParams.js`. O `dias` é o corte de Leads parados (3, 7, 15 ou 30, e o 7, que é o padrão, não é escrito), com a lista em `DIAS_PARADOS`, no mesmo arquivo, porque a conta de Leads parados importa o `dailyGoal.js` e o `screenParams.js` é puro. Ele anda junto ao trocar de submenu, como os filtros da barra, e os outros submenus o ignoram; o período continua no endereço em Leads parados, que o ignora.
```

Troque `` que ganharam as saídas por lead (`cohortMilestoneOf` e `firstContactMinutesOf`) `` por `` que ganharam as saídas por item (`cohortMilestoneOf`, `firstContactMinutesOf`, `appointmentRowsOf`, `lossReasonOf`, `lossStageOf`, `openLeadsOf` e `noNextStepOf`, e o `isSoloTrainingRecord` do "Treina sozinho") ``.

Troque:

```markdown
e os testes de equivalência (`relatoriosLeads.entrada.test.js` e `relatoriosLeads.conversao.test.js`) cobram isso.
```

por:

```markdown
e os testes de equivalência (`relatoriosLeads.entrada.test.js`, `relatoriosLeads.conversao.test.js`, `relatoriosLeads.visitas.test.js`, `relatoriosLeads.perdas.test.js` e `relatoriosLeads.parados.test.js`) cobram isso. A contagem dos recortes (`countRows`) e o aviso dos agendamentos (`apptsPartialOf`) moram em `base.js`, divididos pelos submenus.
```

Troque `` (`apptsPartialOf`, em `conversao.js`, a mesma regra do painel) `` por `` (`apptsPartialOf`, em `base.js`, a mesma regra do painel) ``.

Troque:

```markdown
porque a safra da Conversão é acompanhada até agora. A leitura obedece ao `listenersActive`
```

por:

```markdown
porque a safra da Conversão é acompanhada até agora. Leads parados não pede mês nenhum (a lista de meses vazia deixa a carga pronta na hora) e lê os leads em aberto que o App já tem (`liveLeads`, o `metaLeads`) e as interações do mês, ao vivo. A leitura obedece ao `listenersActive`
```

Troque:

```markdown
num arquivo chamado `leads-<submenu>-<primeiro dia>-a-<último dia>.csv`.
```

por:

```markdown
num arquivo chamado `leads-<submenu>-<primeiro dia>-a-<último dia>.csv`. Nas Visitas e aulas, o último dia é o fim da lista, que vai até o fim do período (`window`), e Leads parados leva só o dia de hoje (`snapshotFileName`).
```

Troque `Controle novo na barra (o corte de Leads parados, no PR 2) precisa ser medido a 1280px.` por `O corte de Leads parados (`DiasControl`) entra no lugar do período e do mês (`showPeriod` falso), com o texto "Sem registro há mais de" do lado de fora do botão, que diz só os dias. Controle novo na barra precisa ser medido a 1280px.`

E troque `` `relatoriosBarra.behavior.test.js` e `relatoriosTela.behavior.test.js`. `` por `` `relatoriosBarra.behavior.test.js`, `relatoriosTela.behavior.test.js` e `relatoriosSubmenus.behavior.test.js` (os três submenus do PR 2). ``.

- [ ] **Step 2: Os três submenus novos**

Logo antes da linha que começa com `- **Visual.** Montado com a skill frontend-design, a pedido do Johnny, no molde dos painéis`, acrescente:

```markdown
- **Visitas e aulas experimentais.** `src/lib/relatorios/leads/visitas.js` e `src/views/relatorios/VisitasSection.jsx`. Os agendamentos de `stronix_aulas` com data no período, pela regra do painel (`appointmentRowsOf`, com o `effectiveStatus`: sem cancelados e sem os marcados a partir da primeira matrícula), um por linha. O número grande é o comparecimento (quem veio sobre quem veio mais quem faltou). Os números do topo são Marcados (o total), Vieram, Faltaram, Sem desfecho (a data passou e ninguém marcou) e A acontecer. O desfecho marcado antes da hora já conta. O painel conta, no mês em andamento, só os de data já passada, e o relatório vai até o fim do período: no mês fechado os números são os do painel, e no mês em andamento todos são, menos Marcados, que soma os que vão acontecer e por isso fica sem variação enquanto o período anda (a tela diz isso). A lista nunca passa do fim do mês atual (`visitasEndOf`), porque pedir o mês seguinte ao `useCrmSources` deixaria na memória da sessão uma entrada fechada para um mês que vai abrir, e o `shouldStoreMonthEntry` não troca entrada fechada por aberta; só a "Esta semana" que atravessa o fim do mês perde os dias do mês seguinte. Só a visita guarda a unidade e só a aula guarda a modalidade e o professor, então "Por unidade" conta só visitas, "Por modalidade" só aulas, e a célula do que não se aplica é um traço que o leitor de tela lê como "não se aplica". O consultor é o dono de hoje do lead.
- **Perdas.** `src/lib/relatorios/leads/perdas.js` e `src/views/relatorios/PerdasSection.jsx`. Os leads com a data da perda no período, pela regra do painel (`lossesOf`: quem está em Perda hoje), por motivo (`lossReasonOf`), etapa (`lossStageOf`), origem e consultor. O número grande não leva cor, e a variação usa `lowerBetter`. A etapa só é gravada desde 14/09/2026 (`STAGE_TRACKING_SINCE`, com o texto em `STAGE_SINCE_TEXT`, na `base.js`): o período que acaba antes fica sem base na etapa, e o que atravessa a data é parcial, com as perdas de antes em "Sem etapa", como no card do painel, para o motivo e a etapa somarem o mesmo total. Um aviso fixo diz que a conta mostra só quem continua perdido: quem volta ao funil ou matricula perde a data e o motivo da perda (`planStageMove` e `commitMatricula` apagam `lostAt` e `lossReason`). O aviso sai quando o PR 4 da entrega A gravar a perda como fato. Filtrar um motivo e exportar dá a lista de repescagem.
- **Leads parados.** `src/lib/relatorios/leads/parados.js` e `src/views/relatorios/ParadosSection.jsx`. Retrato de agora, sem período, sem comparação e sem variação. A base são os leads em aberto da carteira de agora do painel (`openLeadsOf`, a mesma conta do `pipelineNowOf`), e os três números são: sem próximo passo (`noNextStepOf`, fora quem chegou há menos de 24 horas, que a Meta cobra), contato atrasado (`overdueDaysOf`, do `dailyGoal.js`, que fica com o dono do lead mesmo com o contato delegado, como o Atrasado da Meta) e sem registro há mais de N dias (a régua do selo "N dias sem contato" do Pipeline: `getDaysSinceFromDate` com o `lastInteractionDateOf`, que junta o `lastInteractionAt` e as interações do mês ao vivo; sem registro, conta do cadastro). O número grande é a lista sem recorte, com cada lead uma vez, e a base ao lado ("de 210 em aberto agora"). Os dias na etapa saem do `statusEnteredAt`, gravado desde 14/09/2026, ou do cadastro de depois disso (a indicação pelo link público não grava a entrada); antes disso, "antes de 14/09" (`stageSinceOf`). A lista vai de quem está há mais dias sem registro para quem está há menos. O `dailyGoal.js` importa o `lucide-react`, então nenhuma função de `api/` pode importar o `parados.js`.
```

- [ ] **Step 3: A grade dos números**

No item **Visual.**, logo depois da frase que termina em `` e em 3 colunas o nome não teria onde caber. ``, acrescente: `` Os números do topo usam a grade de seis do `NumberTiles`, e quem tem menos passa as colunas em `className` (Visitas e aulas `xl:grid-cols-5`, Leads parados `sm:grid-cols-3 xl:grid-cols-3`). Os quatro recortes de Visitas e aulas e de Perdas ficam dois por dois a partir de `sm`. ``

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md com Visitas e aulas, Perdas e Leads parados nos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Verificação

**Files:** nenhum, a não ser os ajustes que a conferência pedir, cada um com commit próprio.

- [ ] **Step 1: Suíte inteira, nos dois fusos**

Run:
```bash
npx vitest run
TZ=UTC npx vitest run
```
Expected: `B_ARQ + 4` arquivos e `B_TESTES + 59` testes, todos passando, nas duas rodadas. Na cópia de `593ba16` foram 243 arquivos e 5.202 testes.

- [ ] **Step 2: Lint, vazamento no Sentry e build**

Run:
```bash
npm run lint
npm run verificar:sentry
npm run build
```
Expected: o lint com `0 errors` (só o aviso que já existia no `SuperAdminView.jsx`), o `verificar:sentry` passando e o build terminando sem erro.

- [ ] **Step 3: Conferir as telas num Chrome sem janela, sem tocar no Firestore de produção**

Com a skill `frontend-design` carregada, monte a tela num navegador sem login, pelo harness descrito na memória `harness-navegador-sem-login`: um `repro.html` na raiz, um `src/__repro__/harness.jsx` que monta a `RelatoriosView` dentro de um `MemoryRouter` e do `LeadProfileContext`, com as fixtures do CRM nomeadas como no `relatoriosSubmenus.behavior.test.js`, e um `vite.repro.config.js` com plugin `resolveId` (`enforce: 'pre'`, `this.resolve(..., { skipSelf: true })`) que troca `src/lib/firebase.js` e `src/hooks/useCrmSources.js` por fakes em `src/__repro__/`. Nada disso entra em commit: apague os arquivos e confira `git status` no fim. O Firestore de produção nunca é chamado, porque o `firebase.js` é o falso.

Confira nos três submenus novos:
- 1280px e 390px, tema claro e escuro;
- a lista ao lado com os cinco itens no computador e o seletor no celular;
- em Leads parados, a barra a 1280px sem consultor escolhido numa linha só (meça a largura da barra e anote), o texto "Sem registro há mais de" ao lado do botão, e no celular o corte dentro do balão de filtros;
- os cinco números das Visitas e aulas numa linha a partir de 1280px e os três de Leads parados numa linha a partir de `sm`, sem coluna vazia;
- clicar num número e numa linha de recorte filtra a lista, e o X do filtro limpa e leva o foco ao número da lista;
- as listas sem quebrar linha a 1280px, com o traço apagado nas células que não se aplicam;
- o foco visível no teclado e nenhuma rolagem lateral na página;
- o arquivo exportado de cada submenu aberto no Excel, com acentos e sem fórmula executada.

Anote o que precisou de ajuste e corrija antes do PR, com commit próprio.

- [ ] **Step 4: Revisar com as regras da `main`**

Leia as regras direto da `main`, sem copiar os arquivos para o branch:
```bash
git show origin/main:.claude/skills/web-design-guidelines/rules.md
git show origin/main:.claude/skills/writing-guidelines/rules.md
```
Revise contra as regras de interface `src/views/relatorios/VisitasSection.jsx`, `PerdasSection.jsx`, `ParadosSection.jsx`, `RelatoriosToolbar.jsx` e `RelatoriosView.jsx` (foco, teclado, nome dos controles, estados vazios e de erro, contraste), e contra as regras de texto os textos de tela desses arquivos, o `RelatoriosNovo.jsx` e a seção "Relatórios" do `CLAUDE.md`. Algumas regras de texto são de documentação pública (`meta.contentType`, plano da página) e não se aplicam a texto de tela nem ao `CLAUDE.md`: anote quais pulou. Corrija o que valer, com commit próprio, e rode a suíte de novo.

---

### Task 15: PR, só com o pedido do Johnny

**Files:** nenhum.

Os acordos do projeto (`AGENTS.md`) não deixam fazer push nem abrir PR sem pedido explícito. Pare aqui e mostre ao controlador o resultado da Task 14. Quando o Johnny pedir:

- [ ] **Step 1: Enviar o branch**

```bash
git push -u origin claude/relatorios-de-leads-pr2
```

- [ ] **Step 2: Abrir o PR**

```bash
gh pr create --base main --head claude/relatorios-de-leads-pr2 --title "feat: Relatórios de Leads, PR 2 (Visitas e aulas, Perdas e Leads parados)" --body "$(cat <<'BODY'
## O que muda

O relatório de Leads ganha os três submenus que faltavam:

- **Visitas e aulas experimentais:** o comparecimento do período, quantos agendamentos foram marcados, quem veio, quem faltou, os que ficaram sem desfecho e os que ainda vão acontecer, por tipo, consultor, unidade e modalidade.
- **Perdas:** quantos leads se perderam no período, por motivo, pela etapa em que se perderam, por origem e por consultor. Filtrar um motivo e exportar dá a lista de repescagem.
- **Leads parados:** quem está em aberto agora sem próximo passo, com contato atrasado ou sem registro há mais de 3, 7, 15 ou 30 dias. Não tem período: a barra mostra esse corte no lugar dele.

Os números saem das contas do painel CRM, e os testes conferem que o relatório e o painel dão o mesmo número em cada mês, pessoa e funil. A diferença de propósito está nas Visitas e aulas do mês em andamento: o painel conta só os agendamentos de data já passada, e o relatório mostra também os que vão acontecer, em Marcados.

Nada a publicar no Firestore. Nenhuma consulta nova e nenhum índice.

Spec: `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md`
Plano: `docs/superpowers/plans/2026-10-15-relatorios-de-leads-pr2.md`

## Para decidir

(Copie aqui as perguntas do plano que o Johnny ainda não respondeu, com a recomendação que o PR seguiu.)

## Para conferir no preview

- [ ] A lista ao lado tem os cinco submenus, e o balão Novo os cita
- [ ] Visitas e aulas e Perdas batem com a aba CRM da Visão geral num mês fechado
- [ ] Leads parados: o em aberto e o sem próximo passo batem com a carteira de agora da aba CRM
- [ ] O corte de dias fica no link (o F5 mantém) e vai junto ao trocar de submenu
- [ ] Clicar num número ou numa linha filtra a lista, e o X do filtro limpa
- [ ] O exportar de cada submenu abre no Excel com acentos
- [ ] Tela no celular e no tema escuro

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

Expected: o link do PR. Não faça merge: o merge é do Johnny, depois de conferir no preview.

- [ ] **Step 3: Sugerir as revisões**

Pelos acordos do projeto, sugira ao Johnny de 3 a 8 rodadas de code review, com o motivo e um prompt pronto para cada, sem rodar nenhuma sozinho. As que este PR pede: a equivalência com o painel (as três contas contra o `metricsOf`), a janela das Visitas e aulas na virada do mês, o comportamento da barra sem período (foco, leitor de tela e celular), o texto das telas pelo humanizer, e a carga sem mês de Leads parados com o portão de ociosidade.

---

## Fica para depois

- O PR 4 da entrega A grava a perda como fato. Aí as Perdas passam a contar toda perda do período, mesmo de quem voltou ao funil, e o aviso fixo sai.
- O PR 3b da entrega A grava o desfecho da visita no registro na hora em que ele é marcado. Aí o desfecho das Visitas e aulas deixa de depender do espelho do lead e da linha do tempo.
- Unidade na aula e modalidade na visita, se o Johnny quiser os dois recortes completos: é dado novo, gravado pelo agendamento, e fica fora deste PR.
- A semana que atravessa o fim do mês nas Visitas e aulas: mostrar os dias do mês seguinte pede carregar o mês seguinte sem a marca de mês fechado na memória da sessão, uma mudança no `useCrmSources` que vale um PR próprio.
- Recortes com comparecimento por consultor ou por unidade (hoje os recortes das Visitas e aulas contam agendamentos). A spec não pede.
