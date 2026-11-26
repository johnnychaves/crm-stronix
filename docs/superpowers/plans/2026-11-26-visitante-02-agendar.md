# Visitante, entrega 2: o Agendar — Plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development. Cada tarefa traz o contrato, os casos de teste e as armadilhas; implemente em TDD (teste que falha, código, teste passando, commit). Commits em português, terminando com uma linha em branco e `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Objetivo:** a aula experimental passa a viver dentro do freepass: o Agendar da ficha escolhe ou lança o freepass e marca todas as aulas de uma vez, a Meta, o Stronizap e a IA seguem a regra automática, a aula da vez anda no dia da aula seguinte, e as telas que mostravam o passe antigo leem o freepass.

**Spec:** `docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md`, seções "Parte 1", "Parte 3" e "Entrega 2 em detalhe". **Mockup escolhido:** `docs/superpowers/specs/mockups/2026-11-26-visitante-entrega2-a.html` (estados `#passo-freepass`, `#marcar-aulas`, `#cartao`, `#remarcar`, `#upgrade`).

**Base que já existe (entrega 1):** `src/lib/visitante.js` (tipos, `isFreepassRunning`, `activeFreepassesOf`, `freepassSummaryPatch`, `visitorOf`, `launchCheck`, `buildFreepassDoc`, textos), `src/lib/freepassWrites.js` (`writeFreepassLaunch`, `writeFreepassEnd`, pelo gancho `extra` do `logInteractions`), `src/hooks/useLeadFreepasses.js` (devolve `null` antes da primeira leitura), `src/modals/FreepassLaunchModal.jsx`, `src/components/profile/contracts/FreepassCard.jsx`, a regra `stronix_freepass` no `firestore.rules`, `ACTIONS.FREEPASS_LANCAR` e o módulo Stronix 2.0 (`faltosos`) como trava (`freepassOn`).

**Regras que valem em todas as tarefas**
- Tudo do freepass continua atrás do módulo Stronix 2.0 (`hasModule(appUser?.tenantModules, MODULES.FALTOSOS)` no app e `hasModule(appId, 'faltosos')` nas regras). Sem o módulo, o Agendar, a Meta e Configurações ficam exatamente como hoje, com o passo "Quantas aulas" e o painel de quantidades. A ponte confere o módulo pelo documento da academia que ela já lê (`openByKey`).
- `src/lib/visitante.js` só importa `./dates.js` (a `api/` lê o arquivo). Código novo de regra que a `api/` use vai para lá ou para outro arquivo puro com o mesmo limite.
- O dono da tarefa, o eco do agendamento, o registro em `stronix_aulas` e o texto da interação continuam como hoje. O freepass entra por cima, sem mudar essas regras.

**Agendar é remarcar quando há aula pendente.** Hoje o Agendar de aula (ficha, Meta e ponte) move o registro pendente do lead (`currentAulaId` com status 'agendada', pelo `upsertScheduledAula`) em vez de criar outro. Isso continua: com aula pendente, o Agendar remarca essa aula, e a escolha do freepass recebe o `movingFreepassId` (o `freepassId` desse registro), que mantém a aula no mesmo freepass ("Continua no freepass ..."), mesmo com o freepass cheio. Aula nova num freepass que já tem aula pendente (a vaga que voltou depois de um Cancelou) só nasce pelo "Agendar" do cartão do freepass, no modo `new` (Tarefa 4), que cria o registro sem mover o pendente.

**A aula da vez é a mais cedo.** Depois de toda gravação que cria, move ou cancela aula de freepass, o agendamento do lead aponta para `nextFreepassAula` (a pendente mais cedo, de hoje em diante), a não ser que o agendamento atual do lead seja uma aula pendente mais cedo que ela. A aula com desfecho só sai do agendamento do lead pela Tarefa 6, no dia da aula seguinte.

---

### Tarefa 1: Regra pura do Agendar com freepass

**Arquivos:** `src/lib/visitante.js`, `src/lib/__tests__/visitante.test.js`.

**Contrato:**
- `freepassChoiceFor({ lead, freepasses, types, modalidadeId, modalidadeName, canLaunch, now })` → uma de:
  - `{ kind: 'use', freepass, aulasLeft }`: há freepass correndo (`activeFreepassesOf`) na modalidade. `aulasLeft` = `total - aulas` no por aulas, `null` no por dias. Se for por aulas e `aulasLeft === 0`, devolve `{ kind: 'avulsa', reason: 'full', freepass }`.
  - `{ kind: 'launch', types }`: nunca teve freepass na modalidade (nenhum documento com o `modalidadeId`, de qualquer situação), há tipos ativos da modalidade e `canLaunch`. `types` são os ativos da modalidade, o padrão primeiro.
  - `{ kind: 'avulsa', reason: 'repeated', since }`: já teve freepass na modalidade e nenhum corre (`since` = início do mais recente).
  - `{ kind: 'avulsa', reason: 'noType' }`: a modalidade não tem tipo ativo.
  - `{ kind: 'avulsa', reason: 'noLaunch' }`: teria de lançar, mas `canLaunch` é falso (professor).
- `autoFreepassFor(args)` → a mesma escolha, mas `launch` vira `{ kind: 'launch', type }` com o tipo padrão da modalidade; sem padrão, `{ kind: 'avulsa', reason: 'noType' }`. É a regra do Remarcar, do Stronizap e da IA.
- `freepassChoiceText(choice, modalidadeName)` → a linha do Remarcar e o aviso do passo: `'Entra no freepass Pilates 2 aulas (2 de 2)'`, `'Nasce o freepass Pilates 2 aulas'`, `'Aula avulsa: já teve freepass de Pilates em 10/11'`, `'Aula avulsa: o freepass já tem as 2 aulas'`, `'Aula avulsa: Pilates não tem freepass cadastrado'`, `'Aula avulsa: só o consultor lança freepass'`.
- `freepassAulasPatch({ freepass, records })` → `{ aulas, endsAt }`: `aulas` = registros com `freepassId === freepass.id` e `status !== 'cancelled'`; `endsAt` = no por aulas, com `aulas >= total`, o começo do dia do `scheduledFor` mais tarde entre eles, senão `null`; no por dias, devolve o `endsAt` do freepass como está.
- `currentAulaToAdvance({ lead, records, now })` → o registro para onde a aula da vez deve andar, ou `null`: o registro de hoje (`scheduledFor` no dia local de `now`), com `freepassId`, `status === 'agendada'`, diferente de `lead.currentAulaId`, quando o agendamento do lead é de um dia anterior a hoje, já tem desfecho (`appointmentOutcome`) ou não existe. Com mais de um, o mais cedo.
- `movingFreepassId` (opcional, em `freepassChoiceFor` e `autoFreepassFor`): o `freepassId` do registro pendente que o Agendar vai mover. Freepass que corre e é da modalidade pedida → `{ kind: 'use', freepass, aulasLeft, moving: true }`, contando a aula movida como livre e nunca 'full'. Vem antes das outras regras. Texto: `'Continua no freepass Pilates 2 aulas'`.
- `nextFreepassAula({ records, freepassId, now })` → o registro agendado mais cedo do freepass, de hoje em diante, ou null.
- `freepassTagOf({ lead, contractActive, now })` → `null` | `{ label: 'Visitante' | 'Upgrade', text }`, sobre o `visitorOf`. Com `contractActive` (contrato ativo, a vencer, trancado ou agendado), `label: 'Upgrade'` e `text` = `'Pilates, faltam 3 dias'` (modalidade mais andamento); senão `'Visitante'` e o `shortText`.

**Casos de teste (mínimo):** cada `kind` e `reason` de `freepassChoiceFor`; o padrão primeiro em `types`; `autoFreepassFor` com e sem padrão; os seis textos; `freepassAulasPatch` ignorando cancelados e de outro freepass, com `endsAt` só quando completa; `currentAulaToAdvance` nos quatro casos (lead em aula de ontem, lead com desfecho hoje, lead já na aula de hoje, sem aula de freepass hoje); `freepassTagOf` para lead, ex-aluno e aluno ativo.

**Commit:** `feat: regra do Agendar com freepass`

---

### Tarefa 2: O registro da aula guarda o freepass

**Arquivos:** `src/lib/aulas.js` (`aulaRecordFields` ganha `freepassId`, padrão `null`), `src/lib/aulasWrites.js` (`recordNewAppointment` e `upsertScheduledAppointment` repassam `fields.freepassId` ao criar e ao mover), `src/lib/freepassAgendaWrites.js` (novo), testes em `src/lib/__tests__/aulas.test.js` e `src/lib/__tests__/freepassAgendaWrites.test.js`.

**Contrato de `freepassAgendaWrites.js`:**
- `readLeadAulas(db, leadId)` → os registros de `stronix_aulas` do lead (`where('leadId', '==', leadId)`, campo único, sem índice), com `id`.
- `extraAulaRecords({ db, lead, freepassId, aulas })` → `[{ ref, data }]` para as aulas 2..N do lançamento, cada uma com `aulaRecordFields` (tipo aula, modalidade, professor, `scheduledFor`, `status: 'agendada'`, consultor do dono do lead, como o `recordNewAppointment` faz) e `createdAt: serverTimestamp()`.
- `freepassAfterAulas({ freepass, records })` → o patch do documento (`freepassAulasPatch`) e o freepass atualizado, para o `freepassSummaryPatch`.

**Ao mover, o `freepassId` só muda quando vem no pedido** (`fields.freepassId !== undefined`): o Remarcar da Meta e a ponte movem a aula sem passar o campo, e o registro não pode perder o freepass por isso. Ao criar, sem o campo, grava `null`.

**`src/hooks/useLeadAulas.js` (novo):** os registros de `stronix_aulas` do lead, ao vivo, no molde do `useLeadFreepasses` (mesma assinatura `{ db, leadId, active }`, null até a primeira resposta, [] na falha). A ficha usa para o `movingFreepassId` e para a lista do cartão.

**Armadilhas:** o `aulasWrites.test.js` mocka `firebase.js`; mantenha o retorno do `recordNewAppointment` (o id da aula). O `rescheduleRecordPlan` não muda. A ponte tem cópia da regra de registro (`api/_zapSchedule.js`, `scheduleRecordChanges` e `buildScheduleWrites`); a Tarefa 7 a acompanha.

**Commit:** `feat: registro de aula com freepass e escritas das aulas do freepass`

---

### Tarefa 3: O Agendar da ficha

**Arquivos:** `src/components/profile/ScheduleWizard.jsx`, `src/components/profile/AulasPlanner.jsx` (novo), `src/views/LeadProfileView.jsx` (`handleWizardConfirm`), testes `src/lib/__tests__/scheduleWizard.test.js`, `src/lib/__tests__/professorRules.test.js` (o bloco que lê o `handleWizardConfirm`) e um teste novo de comportamento do passo em jsdom.

**Comportamento (mockup `#passo-freepass` e `#marcar-aulas`):**
- Com `freepassOn`, o fluxo da aula vira `modalidade → freepass → professor → datahora` sem o `quantidade`. Sem o módulo, fica como hoje.
- O `ScheduleWizard` recebe `freepassChoice(modalidadeName)`, função da ficha que chama `freepassChoiceFor` com os documentos do `useLeadFreepasses`, os `freepassTypes` e `canLaunch = canFreepass`. O passo mostra a situação; nas avulsas, um cartão "Aula avulsa" com o aviso (`freepassChoiceText`), que fecha o passo no clique.
- Escolher um tipo **por aulas** no `launch` troca os dois últimos passos por "Marcar as aulas" (`AulasPlanner`, opção A): N linhas com dia (atalhos e "Outro dia"), horário e professor (os da modalidade, mais "Treina sozinho"); a linha seguinte nasce com o professor e o horário da anterior e o mesmo dia da semana seguinte; a frase "{Nome} vira Visitante com N aulas: sex 27/11 e sex 04/12."; sem dia repetido e sem horário no passado. No por dias e no `use`, segue o `professor → datahora` de sempre.
- `onConfirm` ganha `freepass: { kind, freepassId?, type?, aulas? }`, com `aulas = [{ date, professorId, soloTraining }]` no lançamento por aulas (a primeira é a aula da vez).
- `handleWizardConfirm`:
  - `avulsa`: como hoje, sem `quantidade` (o `trialClassesPlanned` vai `null`).
  - O `movingFreepassId` sai dos registros do `useLeadAulas`: o `freepassId` do registro `currentAulaId` quando ele está 'agendada'.
  - `use`: o registro da aula leva `freepassId` (criado ou movido); depois do `recordNewAppointment`, relê os registros (`readLeadAulas`) e atualiza o documento de cada freepass afetado (o novo e, se a aula saiu de outro freepass, o antigo) pelo `freepassAfterAulas`, e o resumo no lead.
  - Aula avulsa movida de um freepass (troca de modalidade na remarcação) grava `freepassId: null` e recalcula o freepass antigo, que volta a ter uma vaga.
  - `launch`: a aula 1 segue pelo caminho de sempre (`recordNewAppointment` com `freepassId`), e o mesmo lote cria o freepass (`buildFreepassDoc`; no por dias, início no dia da aula), as aulas 2..N (`extraAulaRecords`), a interação `freepass` de lançamento e o resumo. Uma escrita só: `logInteractions(db, lead, appUser, [notaDoAgendamento, notaDoFreepass], up, extra)`.
  - Recusa com `negarAcesso` o `launch` sem `canFreepass`.
- O texto da interação do agendamento deixa de levar "N aulas" e fica `(Pilates)`; confira o `parseAppointment` e os testes da linha do tempo.

**Armadilhas:** o `professorRules.test.js` exige uma chamada `logInteraction(db, lead, appUser` no `handleWizardConfirm` e reprova `writeBatch`; atualize o teste para aceitar `logInteractions(` e o gancho, sem afrouxar a proibição de outras escritas. O professor nunca lança (`canFreepass` falso), então o caminho dele só tem `use` ou avulsa.

**Commit:** `feat: passo Freepass e aulas marcadas no Agendar da ficha`

---

### Tarefa 4: Aba Contratos com as aulas

**Arquivos:** `src/modals/FreepassLaunchModal.jsx` (no tipo por aulas, depois do tipo, o `AulasPlanner`; o início é a primeira aula), `src/lib/freepassWrites.js` (`writeFreepassLaunch` aceita `aulas` e cria os registros e o agendamento da aula 1 no lead, pelo mesmo caminho da Tarefa 3), `src/components/profile/contracts/FreepassCard.jsx` (lista as aulas do freepass: dia, hora, professor, desfecho ou "Agendada", "Remarcar" em cada; "N aula(s) a agendar" com o botão "Agendar" quando `aulas < total`), `src/components/profile/contracts/ContractsTab.jsx` e a ficha (passam os registros e os gravadores). Testes de comportamento em jsdom.

**Comportamento:** "Remarcar" da aula da vez abre o Agendar já na aula (o caminho de sempre); "Remarcar" de uma aula futura muda só a data e o professor daquele registro (`updateDoc` no registro e o `freepassAulasPatch` no documento e no resumo). "Agendar" abre o Agendar já na aula e na modalidade, no modo `new`: o passo Freepass cai no `use` sem `movingFreepassId`, a gravação cria um registro novo em vez de mover o pendente (`recordNewAppointment` com uma opção que pula o plano de fechar e mover) e o agendamento do lead só muda se a aula nova for a `nextFreepassAula` (a regra "A aula da vez é a mais cedo", no topo).

**Commit:** `feat: aba Contratos lança o freepass com as aulas e o cartão lista as aulas`

---

### Tarefa 5: Meta Diária (Remarcar e Cancelou)

**Arquivos:** `src/modals/RescheduleModal.jsx` (com o módulo, o campo "Aulas previstas" sai e entra a linha `freepassChoiceText(autoFreepassFor(...))`, no mockup `#remarcar`), `src/views/DailyGoalView.jsx` (`handleReschedule` e `handleOutcome`), testes.

**Comportamento:**
- Remarcar que só move a mesma aula: o registro mantém o `freepassId`; o documento recalcula o fim (`freepassAulasPatch`).
- Aula nova pela Meta (o "Agendar próxima tentativa", ou a troca de visita para aula): `autoFreepassFor`; `use` liga a aula; `launch` cria o freepass do tipo padrão com essa aula (as outras ficam a agendar); `avulsa` segue sem freepass.
- Cancelou de uma aula com `freepassId`: o registro já fecha como cancelado (`applyOutcomeToAula`); o documento e o resumo recalculam pelos registros (a vaga volta), e o agendamento do lead passa para a `nextFreepassAula`, quando houver (o Cancelou já apaga o agendamento hoje; aqui ele dá lugar à próxima aula do freepass).
- A Meta não tem os documentos do freepass: leia-os na hora (`where('leadId','==',id)` em `stronix_freepass`) antes de gravar.

**Commit:** `feat: Meta Diária segue o freepass no Remarcar e no Cancelou`

---

### Tarefa 6: A aula da vez anda no dia da aula seguinte

**Arquivos:** `src/hooks/useFreepassAdvance.js` (novo), `src/App.jsx` (liga o hook só para quem vende, com o módulo, preso ao `listenersActive` e ao `dayKey`), testes.

**Comportamento:** uma vez por dia e por aba, lê as aulas de hoje em `stronix_aulas` (`scheduledFor` entre o começo e o fim do dia local, campo único), fica com as de freepass e `agendada`, lê o lead de cada uma e, quando `currentAulaToAdvance` aponta para ela, grava no lead o agendamento dessa aula (`buildSchedulePatch` com o tipo aula, a data, a modalidade, o professor e o `currentAulaId`, sem mexer no dono da tarefa). Grava por `updateDoc` simples, sem interação. Duas abas fazendo ao mesmo tempo gravam o mesmo valor.

**Commit:** `feat: aula da vez do freepass anda no dia da aula seguinte`

---

### Tarefa 7: Ponte do Stronizap e da IA

**Arquivos:** `api/_zapSchedule.js`, `api/zap.js` (`handleSchedule`), `api/_zapStrip.js`, `api/_zapCard.js` se preciso, testes em `api/__tests__/` (`zapSchedule`, `zapRoute`, `zapStrip`, `zapFuso`).

**Comportamento:**
- Com o módulo na academia, o `schedule` de aula lê os freepass do lead dentro da transação (`tx.get` da consulta por `leadId`) e aplica `autoFreepassFor`: `use` liga o registro e atualiza o documento; `launch` cria o freepass do tipo padrão (`buildFreepassDoc` com `via: 'stronizap'` e, com `byAi`, a marca da IA) com a aula pedida; `avulsa` como hoje. O resumo no lead vai no mesmo `leadPatch`.
- A quantidade continua aceita e conferida contra o `trialClassOptions`, mas não é mais gravada (`trialClassesPlanned: null`), e o `hasSameAppointment` para de compará-la.
- `appointmentDetailOf` devolve `quantity: null` quando o lead não tem mais o `trialClassesPlanned`.
- A faixa do cartão (`_zapStrip.js`) lê o freepass pelo `visitorOf` (texto "Freepass até 28/11 · faltam 3 dias" ou "Freepass · 1 de 2 aulas"), no horário de Brasília, e cai no `trialClassesPlanned` antigo quando o lead não tem resumo.
- Em `api/`, `snap.exists` é propriedade.

**Commit:** `feat: Stronizap e IA agendam dentro do freepass`

---

### Tarefa 8: Leituras, Upgrade e Configurações

**Arquivos:**
- `src/lib/freePass.js` e `src/views/AppointmentTrackingView.jsx` (a coluna "Passe livre" usa o freepass quando há resumo; o passe antigo continua para quem não tem);
- `src/lib/upNext.js` e `src/lib/metaFocoTexts.js` (a quantidade sai do `trialClassesPlanned`; com freepass, o detalhe mostra o andamento);
- `src/views/LeadProfileView.jsx` (a etiqueta usa `freepassTagOf`: "Upgrade · Pilates, faltam 3 dias" em violeta com o ícone `TrendingUp` para o aluno ativo; "Visitante" em verde-água para o resto; mockup `#upgrade`);
- `src/views/settings/SchedulingSection.jsx` (com o módulo, o painel "Aulas experimentais" e o `trialShares` saem; sem o módulo, ficam).

**Commit:** `feat: leituras do freepass, etiqueta Upgrade e fim do painel de quantidades`

---

### Tarefa 9: Regras do professor

**Arquivos:** `firestore.rules`, `src/lib/professorWrites.js`, `src/lib/__tests__/professorRules.test.js`, `src/lib/__tests__/freepassRules.test.js`.

**Comportamento:**
- `professorLeadFields()` ganha os campos do resumo que o Agendar do professor grava (`freepassAulas` e `freepassEndsAt`) e, se a Tarefa 3 levar o `freepassId` ao `buildSchedulePatch`, o campo dele.
- `stronix_freepass`: o professor atualiza só `aulas` e `endsAt` (`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['aulas', 'endsAt'])`), com o módulo; continua sem criar.
- O teste das regras do professor e o do freepass acompanham. **Avisar o Johnny: publicar as regras antes do merge.**

**Commit:** `feat: regras do professor para a aula dentro do freepass`

---

### Tarefa 10: Documentação, verificação e PR

- `CLAUDE.md`, seção "Visitante e freepass": o Agendar, a aula da vez, a contagem, a ponte, o Upgrade e as regras do professor.
- `npm run lint && npm test && npm run verificar:sentry && npm run build`.
- Conferência no navegador pelo harness local com Firebase falso (memória `harness-navegador-sem-login`), comparando com o mockup A: o passo Freepass nas quatro situações, o "Marcar as aulas", o cartão com a lista, o Remarcar e a etiqueta Upgrade.
- Code review final antes do PR. PR só com o pedido do Johnny, com o aviso das regras.
