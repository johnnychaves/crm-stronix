# Agendamento pelo Stronizap · PR 1 (Stronilead) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Stronizap passa a pedir as listas do agendamento, a agendar visita e aula experimental e a conferir os agendamentos pelo `POST /api/zap` do Stronilead, que grava o mesmo que o assistente de agendamento da ficha grava. O cartão passa a mostrar o desfecho do agendamento, e a ficha mostra a marca do Stronizap ao lado de quem agendou.

**Architecture:** As regras ficam puras em `api/_zapSchedule.js`: listas do balão, dias sugeridos no horário de Brasília, cadastros do número, leitura e conferência do pedido, o que é gravado e o `AppointmentDetail`. As contas de calendário novas entram em `api/_horarioDeBrasilia.js`. `api/zap.js` ganha três ações pela chave (`schedule-options`, `schedule` e `appointment-status`), desviadas no começo do `handlePost`. O `schedule` confere o lead e o agendamento repetido e grava o registro de aulas, a interação e o lead numa transação só. O cartão (`api/_zapCard.js`) ganha o `outcome` do agendamento, e a linha do tempo da ficha desenha a marca do Stronizap na coluna do autor e no rodapé do desfecho (modelo A dos mockups).

**Tech Stack:** React 19, Vite, Tailwind v4, Firebase (Firestore no navegador, firebase-admin na `api/`), Vercel serverless, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`. **Mockups:** `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-mockup.html` (a seção 6 é a ficha, modelo A). **Levantamento:** `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-levantamento.md`.

**Ordem:** este PR entra antes dos dois do Stronizap (o agendamento e o lembrete). As três ações ficam paradas até o Stronizap chamar, e a Vercel publica no merge.

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronilead`, no worktree `.claude/worktrees/agendamento-pelo-zap`, branch `claude/agendamento-pelo-zap` (a main `5852d5c`, que já tem o PR #237, mais os commits da spec). Caminhos relativos à raiz do worktree. As linhas citadas são as de `84709e8`.

**PRs abertos que mexem perto:**
- **#234 e #235** (aba Contratos da ficha) mexem em `src/views/LeadProfileView.jsx`. Se entrarem antes, o conflito provável é nos imports do topo do arquivo: mantenha os dois lados.
- **#196** (auditoria da importação de clientes) não toca nada daqui.

**Regras do projeto que valem aqui** (do `CLAUDE.md`):
- limite de 12 funções na Vercel, hoje 11: nada de função nova, tudo cabe em `api/zap.js`; arquivo de `api/` que começa com `_` não é função;
- em `api/`, `snap.exists` é propriedade; em `src/`, `snap.exists()` é função;
- nenhum arquivo de `api/` chega a `src/lib/dailyGoal.js` (lucide-react), a `src/lib/firebase.js` (SDK do navegador), a `src/lib/funnels.js`, a `src/lib/aulasWrites.js` ou a `src/lib/interactions.js` (os dois últimos usam o SDK do navegador);
- tudo que é dia e hora no servidor passa pelo horário de Brasília (`api/_horarioDeBrasilia.js`), com teste que põe o processo em UTC, porque a Vercel roda em UTC e a máquina de desenvolvimento fica em Brasília;
- o Sentry e o log nunca recebem o telefone nem a chave;
- código novo de tela usa `cn()`, tokens semânticos (`bg-muted`, `text-muted-foreground`), `flex gap-*` e `size-N`;
- textos em português, diretos, sem travessão no meio da frase;
- trabalho por PR, nunca commit na main; o merge é do Johnny;
- regras e índices do Firestore não mudam neste PR: o `firebase-admin` não passa por regra, e as consultas novas são de campo único (`stronix_aulas` por `leadId`).

---

## Notas de abertura: onde o código difere da spec ou do contrato, e a decisão

1. **O parentesco do "Para quem?" é o do menor visto por quem escreve.** A spec pede "com o parentesco ('Filho', 'Filha')", e o contrato entre os planos diz que `relationship` é o `guardian.relationship` gravado no menor, mas dá "Filho" de exemplo. O que o menor guarda é o contrário: o papel de quem responde por ele ("Mãe", "Pai", "Avó"...), e é isso que o cartão já manda em `wards[].relationship`. Decisão: o `targets[].relationship` sai de `wardRelationship` (`api/_zapSchedule.js`), que inverte o papel pelo campo Sexo do lead: Mãe ou Pai viram "Filho" ou "Filha", Avó ou Avô viram "Neto" ou "Neta", Tia ou Tio viram "Sobrinho" ou "Sobrinha". Sem sexo, com sexo "Outro" ou com parentesco "Outro", vai `null`, para não adivinhar o gênero (a mesma ideia do texto da confirmação na spec). Vale a spec, e o Stronizap não tem o sexo do lead para fazer a conta. O plano do PR 2 só mostra o que vem. Os nomes e a regra do `null` são texto a confirmar com o Johnny.
2. **Só um caminho de cancelamento chega da tela, e ele zera a data.** O "Cancelou" da Meta Diária (`handleOutcome`, `src/views/DailyGoalView.jsx:1234-1240`) apaga `appointmentScheduledFor`, `appointmentType` e `nextFollowUp`, mas deixa `appointmentOutcome: 'cancelled'`, o `nextFollowUpType` e os campos do agendamento (`appointmentUnit`, `appointmentModality`...). O `writeAppointmentOutcome` (`src/lib/appointmentOutcome.js:98-104`) só apaga a data com `consumeAppointment`, e o único lugar que o chama hoje, a Agenda do dia (`markAgendaPresence`, `DailyGoalView.jsx:1088-1094`), passa `consumeAppointment: !isCliente` e nunca manda `cancelled` (o `PresenceSwitch` só manda compareceu, faltou ou desmarcar). A regra de leitura do contrato (cancelado faz o agendamento inteiro virar `null`, no cartão e no `AppointmentDetail`) cobre esse caminho do helper, o dado antigo e um terceiro caso: o "Adiar para amanhã" (`handleSnooze`, `DailyGoalView.jsx:1178-1196`) regrava `nextFollowUp` sem trocar o `nextFollowUpType`, e o `getLeadAppointmentDate` traria de volta a visita cancelada.
3. **O assistente não usa as regras do #237 ao agendar de novo, e a ponte também não.** O `handleWizardConfirm` (`src/views/LeadProfileView.jsx:504-599`) chama só `upsertScheduledAula` e `upsertScheduledAppointment`. O `rescheduleRecordPlan` e o `closeOpenAppointment` do #237 são usados só pelo Remarcar da Meta Diária (`DailyGoalView.jsx:1476-1487`). A ponte espelha o assistente: agendar de novo o mesmo tipo move o registro em aberto para a data nova; trocar de tipo cria ou reaproveita o registro do tipo novo e deixa o do tipo antigo como estava (o Remarcar da Meta o fecharia como cancelado).
4. **O registro da visita não fecha com o desfecho.** O `CLAUDE.md` já registra que o desfecho da visita não é gravado em `stronix_aulas`. Por isso a visita que aconteceu continua `agendada` no registro, e agendar outra visita move esse registro para a data nova, que é o que o assistente faz hoje. A ponte faz igual; corrigir é da PR que gravar o desfecho no registro.
5. **O `appointment` do `201` é o `AppointmentDetail` inteiro**, como o contrato fixa. A spec escreve `{ leadId, type, at }`, e o detalhe contém esses três campos e acrescenta o que o Stronizap precisa para o texto da confirmação e para o lembrete.
6. **O tipo sai normalizado no `AppointmentDetail` e nos `targets`** (`visita` ou `aula_experimental`, por `normalizeAppointmentType(getLeadAppointmentType(lead))`), porque lead antigo pode ter `appointmentType: 'Visita'`. O cartão continua mandando o `type` como sempre mandou e só ganha o `outcome`.
7. **O texto do e-mail ausente é "Não deu para saber quem está agendando."** nas duas ações que recebem `actor`. O contrato pede os mesmos textos do `lead-options` no `schedule-options`, e o de lá diz "cadastrando". Os outros (academia bloqueada, fora da equipe, telefone, canal e formato) são os do cadastro, palavra por palavra. A tela nunca provoca esse erro: o Stronizap tira o e-mail da sessão.
8. **O dia e a hora do texto da interação são montados à mão** (`dataHoraDeBrasilia`), e não com `toLocaleString`, para não depender do ICU do servidor. O resultado é o do navegador: "01/10/2026, 18:00".
9. **`interactionsCount` soma com `FieldValue.increment(1)`**, como o `logInteraction`. É o primeiro `increment` da `api/`, e o banco falso da rota passa a entendê-lo.
10. **O limite conta tentativas**, como no cadastro: o `checkRateLimit` roda depois do formato e da academia. Pedido malformado ou de academia bloqueada não gasta; recusa por equipe, catálogo, horário passado, lead ou agendamento repetido gasta.
11. **O `appointment-status` não confere academia bloqueada.** O contrato manda fazer as mesmas conferências do `GET` do cartão (chave e identificador). O `openByKey` ganha a opção `checkBlocked: false` para isso.
12. **A faixa "Visita hoje" do cartão não muda.** Uma visita cancelada que ainda tem a data (o caminho do helper da nota 2) continuaria acendendo a faixa. Esse caminho não chega da tela hoje, e a spec não pede mexer na faixa.
13. **Professor sem nome não passa na conferência.** O `checkScheduleCatalog` exige o `nome` do professor, porque a lista do balão não mostra quem não tem nome.
14. **Visita e unidade.** Academia sem unidade cadastrada aceita a visita sem unidade, e uma unidade mandada nela é recusada como catálogo que mudou. Academia com unidade exige a unidade: sem ela, `400` no campo `unit`.
15. **Horário que já passou é o instante igual ou anterior a agora**, sem margem, como a spec pede.
16. **Textos a confirmar com o Johnny** (a spec não traz): todos os de `ZAP_SCHEDULE_MESSAGES` (Task 3), os parentescos invertidos da nota 1 e o detalhe do autor sem canal, "Agendado pelo Stronizap" (Task 13).

## O contrato da ponte

Tudo pelo `POST /api/zap`, autenticado pela chave (`x-stronizap-key`), igual ao `match`, ao `lead-options` e ao `create-lead`. O identificador da academia vai em `tenant`.

### `schedule-options` (só lê)

Pedido: `{ "action": "schedule-options", "tenant": "stronix-crm-app", "phone": "5551999998888", "actor": { "email": "ana@academia.com" } }`.

Resposta `200`:

```json
{
  "actor": { "id": "u1", "name": "Ana Souza", "role": "consultor", "countsForMeta": true },
  "targets": [
    { "leadId": "L1", "name": "Mariana Lima", "relationship": null, "appointment": { "type": "visita", "at": "2026-09-30T21:00:00.000Z", "outcome": null } },
    { "leadId": "L2", "name": "Pedro Lima", "relationship": "Filho", "appointment": null }
  ],
  "units": [{ "name": "Centro", "address": "Rua Garibaldi, 1200" }],
  "modalities": [{ "id": "m1", "name": "Pilates" }],
  "professors": [{ "id": "p1", "name": "Carla Dias", "modalityIds": ["m1"] }],
  "trialClassOptions": [1, 2, 3],
  "days": [
    { "date": "2026-09-29", "label": "Hoje", "defaultTime": "18:00" },
    { "date": "2026-09-30", "label": "Amanhã", "defaultTime": "09:00" },
    { "date": "2026-10-01", "label": "Quinta", "defaultTime": "09:00" },
    { "date": "2026-10-02", "label": "Sexta", "defaultTime": "09:00" },
    { "date": "2026-10-05", "label": "Segunda", "defaultTime": "09:00" }
  ]
}
```

- `actor`: a pessoa da equipe achada pelo e-mail, como no `lead-options` (e-mail em minúsculas, com `authUid`). `role` é `gestor` para `role: 'admin'` no `stronix_users`, e `consultor` nos outros casos. `countsForMeta` é `true` só para consultor, e só quando o dia de hoje, no calendário de Brasília, está nos `metaWeekdays` da academia (`stronix_config/general`, pela `normalizeMetaWeekdays`; padrão de segunda a sexta).
- `targets`: primeiro o cadastro do próprio número, quando existe; depois os menores de quem o número é responsável, na mesma seleção que o cartão usa para `wards` e na mesma ordem de nome. `relationship` é `null` no cadastro do próprio número e, no menor, o parentesco visto por quem escreve (nota 1). `appointment` é `{ type, at, outcome }` do agendamento atual, pelas mesmas leituras do cartão, com o `outcome` pela regra do `AppointmentDetail` (`attended`, `no_show` ou `null`; `rescheduled` vira `null`), ou `null` quando não há agendamento ou ele foi cancelado. O desfecho vai junto para o Stronizap só avisar de remarcação quando o agendamento ainda não aconteceu. Número sem cadastro devolve `targets: []`.
- `units`: nome e endereço, na ordem da academia (`order`); endereço vazio vira `null`. `modalities`: id e nome, na ordem. `professors`: só os ativos (`ativo !== false`), com `name` (o `nome`) e `modalityIds` (o `modalidadeIds`). `trialClassOptions`: `normalizeTrialClassOptions(trialClassOptions, maxTrialClasses)`, a mesma do `App.jsx`; sem configuração, `[1, 2, 3]`.
- `days`: a regra do `wzDayOptions` do `ScheduleWizard.jsx`, no horário de Brasília. Começa hoje quando a hora de Brasília é menor que 18, senão amanhã; só dias dos `metaWeekdays` (lista vazia vale todos); cinco dias, procurando no máximo 90. `label` é `Hoje`, `Amanhã` ou o dia da semana curto, sem "-feira" (`Segunda` a `Domingo`). `defaultTime` é `18:00` para hoje e `09:00` para os outros dias.

### `schedule` (grava)

Pedido:

```json
{
  "action": "schedule",
  "tenant": "stronix-crm-app",
  "phone": "5551999998888",
  "actor": { "email": "ana@academia.com", "name": "Ana Souza" },
  "channelName": "Recepção",
  "schedule": {
    "leadId": "L1", "type": "visita", "unit": "Centro", "modality": null, "professorId": null,
    "soloTraining": false, "quantity": null, "date": "2026-10-01", "time": "18:00", "note": "Vem depois do trabalho."
  }
}
```

- `type`: `visita` ou `aula_experimental`.
- Visita: `unit` é o NOME da unidade, como o assistente grava em `appointmentUnit`; obrigatório quando a academia tem unidade e `null` quando não tem nenhuma. `modality`, `professorId` e `quantity` vêm `null`, e `soloTraining`, `false`.
- Aula: `modality` é o NOME da modalidade, como o assistente grava em `appointmentModality`. Exatamente um entre `professorId` (professor ativo que dá a modalidade) e `soloTraining: true`. `quantity` é um inteiro das `trialClassOptions`. `unit` vem `null`.
- `date` em AAAA-MM-DD e `time` em HH:MM (24h), os dois no horário de Brasília. O instante precisa estar no futuro.
- `note`: texto até 1.000 caracteres ou `null`; em branco vira `null`.
- O nome gravado como autor é o do `stronix_users`; o `actor.name` só entra se o cadastro da equipe não tiver nome, como no `create-lead`.

Resposta `201`: `{ "card": { … }, "appointment": { … } }`, com o mesmo cartão que o `GET` devolve para o número, já com o agendamento novo, e o `AppointmentDetail` do agendamento gravado.

### `appointment-status` (só lê; quem usa é o lembrete do Stronizap)

Pedido: `{ "action": "appointment-status", "tenant": "stronix-crm-app", "leadIds": ["L1", "L2"] }`, de 1 a 30 ids, texto, sem repetir.

Resposta `200`: `{ "appointments": { "L1": { …AppointmentDetail }, "L2": null } }`. Todo id pedido aparece como chave. `null` quando o lead não existe na academia, não tem agendamento ou teve o agendamento cancelado. Confere só a chave e o identificador, como o `GET`, e não tem limite próprio.

### `AppointmentDetail`

```json
{
  "leadId": "L1", "leadName": "Mariana Lima", "type": "visita", "at": "2026-10-01T21:00:00.000Z",
  "unit": "Centro", "unitAddress": "Rua Garibaldi, 1200", "modality": null, "professorName": null,
  "soloTraining": false, "quantity": null, "outcome": null
}
```

- Sai do lead: `getLeadAppointmentType` (normalizado, nota 6), `getLeadAppointmentDate`, `appointmentUnit`, `appointmentModality`, `appointmentProfessorName`, `appointmentSoloTraining`, `trialClassesPlanned` e `appointmentOutcome`. Na visita, os campos de aula vão `null` (e `soloTraining`, `false`); na aula, a unidade vai `null`.
- `unitAddress` é procurado pelo nome da unidade na lista de agora; `null` quando a unidade sumiu ou não tem endereço.
- `outcome`: `attended` ou `no_show`. `rescheduled` vira `null`, porque o lead já está com a data nova. `cancelled` faz o agendamento inteiro virar `null`.

### O cartão

O `appointment` do cartão (`api/_zapCard.js`) vira `{ type, at, outcome }`, com o `outcome` pela mesma regra, no cartão de lead, no de cliente e no de cada menor em `wards`. Agendamento cancelado não aparece.

### Recusas

Toda recusa traz `error` e um `message` pronto para a tela; a de campo traz `field` com o nome do pedido (`phone`, `actor`, `channelName`, `schedule`, `leadId`, `type`, `unit`, `modality`, `professorId`, `quantity`, `date`, `time`, `note` e, no `appointment-status`, `leadIds`). O `soloTraining` não tem campo próprio na tela: erro nele vai em `professorId`.

| Código | Status | Quando | Texto |
|---|---|---|---|
| (sem chave ou academia) | 401 | chave ausente | `{ "error": "Credencial ausente" }` |
| (chave errada) | 401 | chave errada, identificador fora do formato ou academia inexistente | `{ "error": "Credencial inválida" }` |
| `dados_invalidos` | 400 | pedido malformado ou campo obrigatório em branco, com `field` | ver `ZAP_SCHEDULE_MESSAGES` (Task 3) |
| `academia_bloqueada` | 403 | academia suspensa, em teste vencido ou com mensalidade atrasada há mais de 3 dias (não vale no `appointment-status`) | o do cadastro |
| `fora_da_equipe` | 403 | o e-mail não está na equipe com login | o do cadastro, com o e-mail |
| `lead_nao_confere` | 422 | o lead não é deste número nem menor de quem ele é responsável | "Esse cadastro não é deste número no Stronilead." |
| `catalogo_mudou` | 422 | unidade, modalidade, professor ou quantidade que não existe mais, com `field` | ver Task 3 |
| `horario_passado` | 422 | dia e hora que já passaram | "Esse horário já passou. Escolha outro." |
| `ja_agendado` | 409 | o lead já tem o mesmo tipo no mesmo dia e horário; traz `card` e o `appointment` que já existia | "Esse agendamento já estava no Stronilead." |
| `limite` | 429 | mais de 60 agendamentos na última hora na academia (`zap-schedule:<academia>`) | "Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos." |
| (erro inesperado) | 5xx | a Vercel responde; o erro vai ao Sentry como `zap <ação> falhou (<código>)`, sem dado pessoal | |

O `ja_agendado` é conferido dentro da transação da gravação, e o Stronizap o trata como sucesso: a gravação é a mesma.

## O que é gravado

A ação `schedule` grava numa transação só o que o assistente (`handleWizardConfirm`) grava em três passos:

1. **O registro em `stronix_aulas`**, com os campos de `aulaRecordFields` (`src/lib/aulas.js`) e os de consultor copiados do dono do lead. A aula reaproveita o registro do `currentAulaId` quando ele ainda está `agendada`; a visita reaproveita a primeira visita `agendada` do lead, como o `upsertScheduledAppointment`. Registro reaproveitado só troca a data e os campos do tipo (a unidade na visita; professor, modalidade e "Treina sozinho" na aula).
2. **A interação**, como o `logInteraction` grava: `type: 'note'`, `volumeKind` (`visita` ou `aula_experimental`), `consultantName`, `actorId` e `actorAuthUid` de quem agendou, os campos de segurança do dono (`getInteractionSecurityFields`), `leadName`, `createdAt` do servidor e o texto que o `parseAppointment` lê, com o dia e a hora de Brasília:
   - "🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho."
   - "🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00."

   E os dois campos novos: `via: 'stronizap'` e `zapChannelName`.
3. **O lead**: o `buildSchedulePatch` (`src/lib/schedulePatch.js`, que já zera o desfecho anterior), `lastInteractionAt` do servidor e `interactionsCount` mais um. A etapa não muda.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `api/_horarioDeBrasilia.js` | `instanteDeBrasilia`, `dataHoraDeBrasilia`, `isoDoDia`, `diaDaSemanaDoDia` e `horaInteiraDeBrasilia` |
| `api/_zapCard.js` | `appointmentOutcomeOf` e `cardAppointment`: o desfecho na linha "Agendamento" do cartão |
| `api/_zapSchedule.js` (novo) | regras puras e textos das três ações |
| `api/zap.js` | `numberPeople`, `readScheduleCatalogs`, as três ações e o desvio |
| `src/lib/leads.js` | `ZAP_VIA`, a origem gravada em `via` |
| `src/lib/timeline.js` | `zapScheduleTitle` e `appointmentOriginText` |
| `src/components/brand/StronizapMark.jsx` | `StronizapBadge`, a marca num círculo ao lado de um nome |
| `src/views/LeadProfileView.jsx` | a marca e o detalhe na coluna do autor e o rodapé do desfecho |
| `api/__tests__/horarioDeBrasilia.test.js` (novo) | as contas de calendário, em UTC |
| `api/__tests__/zapSchedule.test.js` (novo) | as regras puras, em UTC |
| `api/__tests__/zapCard.test.js`, `api/__tests__/zapFuso.test.js` | o desfecho no cartão |
| `api/__tests__/zapRoute.test.js` | banco falso com registro de aulas, unidades, professores, leitura por id e increment; testes das três ações e do desvio |
| `src/lib/__tests__/zapScheduleTimeline.test.js` (novo) | o que a ponte grava, lido pela linha do tempo e pela Meta Diária |
| `src/lib/__tests__/newLeadImports.test.js` | o grafo de imports também do `api/_zapSchedule.js` |
| `src/lib/__tests__/timeline.test.js`, `src/lib/__tests__/profileZapSchedule.test.js` (novo) | o detalhe do autor, o rodapé e a ficha |
| `CLAUDE.md` | a seção da ponte |

---

### Task 0: Preparação

**Files:** nenhum arquivo de código

- [ ] **Step 1: Commit dos planos e rebase na main**

```bash
cd /Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.claude/worktrees/agendamento-pelo-zap
git branch --show-current
git status --short
```

Expected: `claude/agendamento-pelo-zap`, e o status só com os planos novos deste projeto em `docs/superpowers/plans/` (este e, se estiverem neste worktree, os dos PRs 2 e 3). Se o status vier limpo, pule o `git add` e o `git commit` abaixo e siga do `git fetch`.

```bash
git add docs/superpowers/plans/2026-09-29-agendamento-zap-*.md
git commit -m "docs: planos do agendamento pelo Stronizap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git fetch origin
git rebase origin/main
```

Expected: rebase sem conflito. Se os planos dos PRs 2 e 3 tiverem outro nome, acrescente-os ao `git add`.

- [ ] **Step 2: Dependências e suíte de partida**

```bash
npm ci
npm test
```

Expected: suíte verde. Em `84709e8` são `Test Files  145 passed (145)` e `Tests  3193 passed (3193)`; com outros PRs na main, são mais. Este plano soma 4 arquivos e 213 testes. Se a suíte falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: Horário de Brasília: o instante, o dia e a hora escrita (`api/_horarioDeBrasilia.js`)

**Files:**
- Modify: `api/_horarioDeBrasilia.js` (fim do arquivo, depois da linha 60)
- Test: `api/__tests__/horarioDeBrasilia.test.js` (novo)

O agendamento precisa de cinco contas de calendário que o cartão não usava: transformar o dia e a hora que o Stronizap manda (em Brasília) num instante, escrever o dia e a hora do texto da interação, dar o dia em AAAA-MM-DD, o dia da semana e a hora cheia, tudo no horário de Brasília com o processo em UTC.

- [ ] **Step 1: Escrever os testes que falham**

Criar `api/__tests__/horarioDeBrasilia.test.js`:

```js
import { describe, it, expect, vi, afterAll } from 'vitest';

// O agendamento pelo Stronizap roda numa função da Vercel, com o processo em
// UTC (lá o TZ é variável reservada). A máquina de desenvolvimento fica em
// Brasília, e nela um erro de fuso não aparece. Por isso o processo vai para
// UTC antes de importar o módulo, como em zapFuso.test.js, e o primeiro teste
// confere que a troca pegou.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  diaDeBrasilia, isoDoDia, diaDaSemanaDoDia, horaInteiraDeBrasilia, dataHoraDeBrasilia, instanteDeBrasilia
} from '../_horarioDeBrasilia.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
    expect(['UTC', 'Etc/UTC']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

describe('instanteDeBrasilia: dia e hora de Brasília viram instante', () => {
  it('18:00 de Brasília é 21:00 em UTC', () => {
    expect(instanteDeBrasilia('2026-10-01', '18:00').toISOString()).toBe('2026-10-01T21:00:00.000Z');
  });

  it('22:30 do último dia do ano já é o ano seguinte em UTC', () => {
    expect(instanteDeBrasilia('2026-12-31', '22:30').toISOString()).toBe('2027-01-01T01:30:00.000Z');
  });

  it('meia-noite e 23:59 ficam no mesmo dia de Brasília', () => {
    expect(instanteDeBrasilia('2026-10-01', '00:00').toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(instanteDeBrasilia('2026-10-01', '23:59').toISOString()).toBe('2026-10-02T02:59:00.000Z');
  });

  it('29 de fevereiro só existe em ano bissexto', () => {
    expect(instanteDeBrasilia('2026-02-29', '09:00')).toBeNull();
    expect(instanteDeBrasilia('2028-02-29', '09:00').toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });

  it.each([
    ['2026-10-01', '24:00'], ['2026-10-01', '18:60'], ['2026-10-01', '8:00'], ['2026-10-01', '18:00:00'],
    ['2026-10-1', '18:00'], ['2026-13-01', '18:00'], ['2026-04-31', '18:00'], ['01/10/2026', '18:00'],
    [20261001, '18:00'], ['2026-10-01', null], [undefined, undefined]
  ])('fora do formato ou inexistente volta null (%s %s)', (dia, hora) => {
    expect(instanteDeBrasilia(dia, hora)).toBeNull();
  });
});

describe('leitura do calendário de Brasília', () => {
  // 23:30 de quinta, 01/10, em Brasília; em UTC já é sexta.
  const quintaTarde = new Date('2026-10-02T02:30:00.000Z');

  it('dataHoraDeBrasilia escreve como o navegador em pt-BR, no horário de Brasília', () => {
    expect(dataHoraDeBrasilia(new Date('2026-10-01T21:00:00.000Z'))).toBe('01/10/2026, 18:00');
    expect(dataHoraDeBrasilia(quintaTarde)).toBe('01/10/2026, 23:30');
    expect(dataHoraDeBrasilia(new Date('2026-10-05T12:05:00.000Z'))).toBe('05/10/2026, 09:05');
    expect(dataHoraDeBrasilia(new Date('x'))).toBeNull();
  });

  it('isoDoDia e diaDaSemanaDoDia usam o dia de Brasília, não o do processo', () => {
    const dia = diaDeBrasilia(quintaTarde);
    expect(isoDoDia(dia)).toBe('2026-10-01');
    expect(diaDaSemanaDoDia(dia)).toBe(4);
    expect(isoDoDia(dia + 1)).toBe('2026-10-02');
    expect(diaDaSemanaDoDia(dia + 3)).toBe(0);
    expect(isoDoDia(diaDeBrasilia(new Date('2027-01-01T01:30:00.000Z')))).toBe('2026-12-31');
  });

  it('horaInteiraDeBrasilia lê a hora de Brasília', () => {
    expect(horaInteiraDeBrasilia(new Date('2026-09-29T21:30:00.000Z'))).toBe(18);
    expect(horaInteiraDeBrasilia(new Date('2026-09-29T20:59:00.000Z'))).toBe(17);
    expect(horaInteiraDeBrasilia(quintaTarde)).toBe(23);
    expect(horaInteiraDeBrasilia(new Date('x'))).toBeNaN();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/horarioDeBrasilia.test.js`
Expected: FAIL, `18 failed | 1 passed`, com `TypeError: instanteDeBrasilia is not a function` (e o mesmo para as outras funções). Só o teste do UTC passa.

- [ ] **Step 3: Implementar em `api/_horarioDeBrasilia.js`**

Acrescentar no fim do arquivo, depois do `ddmmDoDia`:

```js

// "2026-10-01", a partir do número que diaDeBrasilia devolve.
export function isoDoDia(dia) {
  const d = new Date(dia * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Dia da semana (0 = domingo … 6 = sábado) do número que diaDeBrasilia
// devolve. Mesma numeração do getDay() e dos metaWeekdays da academia.
export function diaDaSemanaDoDia(dia) {
  return new Date(dia * DAY_MS).getUTCDay();
}

// Hora cheia em Brasília, de 0 a 23. NaN para data inválida.
export function horaInteiraDeBrasilia(date) {
  const p = partes(date);
  return p ? p.hour : NaN;
}

// "01/10/2026, 18:00": o dia e a hora como o navegador escreve em pt-BR
// (toLocaleString com dia, mês, ano, hora e minuto), mas sempre no horário
// de Brasília. É o formato que parseAppointment lê. null para data inválida.
export function dataHoraDeBrasilia(date) {
  const p = partes(date);
  return p ? `${pad(p.day)}/${pad(p.month)}/${p.year}, ${pad(p.hour)}:${pad(p.minute)}` : null;
}

// O instante de um dia ("2026-10-01") e de uma hora ("18:00") escritos no
// horário de Brasília. null quando vêm fora do formato ou não existem (31/02,
// 24:00). Brasília está em -03:00 desde que o horário de verão acabou, em
// 2019, mas a conta lê o deslocamento do Intl em vez de fixá-lo.
export function instanteDeBrasilia(dia, hora) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof dia === 'string' ? dia : '');
  const h = /^(\d{2}):(\d{2})$/.exec(typeof hora === 'string' ? hora : '');
  if (!d || !h) return null;
  const [ano, mes, diaDoMes, horas, minutos] = [d[1], d[2], d[3], h[1], h[2]].map(Number);
  if (horas > 23 || minutos > 59) return null;
  // O relógio pedido, lido como se fosse UTC. Date.UTC aceita 31/02 e vira
  // 03/03, então o dia é conferido.
  const relogio = Date.UTC(ano, mes - 1, diaDoMes, horas, minutos);
  const conferido = new Date(relogio);
  if (conferido.getUTCFullYear() !== ano || conferido.getUTCMonth() !== mes - 1 || conferido.getUTCDate() !== diaDoMes) {
    return null;
  }
  // Quanto Brasília está atrás do UTC nesse momento (-3 horas, hoje).
  const p = partes(conferido);
  const deslocamento = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - relogio;
  return new Date(relogio - deslocamento);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/horarioDeBrasilia.test.js && npx eslint api/_horarioDeBrasilia.js api/__tests__/horarioDeBrasilia.test.js`
Expected: `Tests  19 passed (19)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/_horarioDeBrasilia.js api/__tests__/horarioDeBrasilia.test.js
git commit -m "feat: instante e data escrita no horário de Brasília para o agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: O desfecho no cartão (`api/_zapCard.js`)

**Files:**
- Modify: `api/_zapCard.js:14`, `:26-27`, `:36`
- Modify: `api/__tests__/zapFuso.test.js:154`
- Test: `api/__tests__/zapCard.test.js`

A linha "Agendamento" do cartão passa a levar o `outcome`: `attended` ou `no_show`, ou `null`. `rescheduled` não é desfecho, e o agendamento cancelado sai do cartão (nota 2 das notas de abertura).

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapCard.test.js`, trocar a linha 2 por:

```js
import { buildZapCard, buildZapWard, buildGuardianCard, appointmentOutcomeOf, cardAppointment } from '../_zapCard.js';
```

E acrescentar no fim do arquivo:

```js

describe('desfecho do agendamento no cartão', () => {
  // Visita de 01/10 às 18:00 de Brasília, como a ficha e a Meta Diária mostram.
  const visita = (extra = {}) => ({
    id: 'lead9', name: 'Camila Prado', lifecycleStage: 'lead', status: 'Negociação',
    appointmentType: 'visita', appointmentScheduledFor: brt('2026-10-01T18:00'), nextFollowUpType: 'Visita', ...extra
  });

  it('sem desfecho: a linha vem com outcome null', () => {
    expect(buildZapCard(visita(), HOJE).appointment).toEqual({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null });
  });

  it.each(['attended', 'no_show'])('%s registrado na Meta Diária aparece na linha', (outcome) => {
    expect(buildZapCard(visita({ appointmentOutcome: outcome }), HOJE).appointment.outcome).toBe(outcome);
  });

  it('remarcado não é desfecho: o lead já está com a data nova', () => {
    expect(buildZapCard(visita({ appointmentOutcome: 'rescheduled' }), HOJE).appointment.outcome).toBeNull();
  });

  it('cancelado pela Meta Diária: a data já foi apagada e a linha some', () => {
    const cancelado = visita({ appointmentOutcome: 'cancelled', appointmentScheduledFor: null, appointmentType: null, nextFollowUp: null });
    expect(buildZapCard(cancelado, HOJE).appointment).toBeNull();
  });

  it('cancelado sem a data apagada também some', () => {
    expect(buildZapCard(visita({ appointmentOutcome: 'cancelled' }), HOJE).appointment).toBeNull();
  });

  it('o menor em wards leva o desfecho do agendamento dele', () => {
    const menor = visita({ isMinor: true, guardian: { name: 'Maria', phone: '(11) 9 1234-5678', relationship: 'Mãe' }, appointmentOutcome: 'no_show' });
    expect(buildZapWard(menor, HOJE).appointment).toEqual({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'no_show' });
  });

  it('o cliente também mostra o desfecho', () => {
    const cliente = visita({ lifecycleStage: 'cliente', appointmentOutcome: 'attended' });
    expect(buildZapCard(cliente, HOJE)).toMatchObject({ kind: 'cliente', appointment: { outcome: 'attended' } });
  });

  it('appointmentOutcomeOf e cardAppointment são a regra que o cartão usa', () => {
    expect(appointmentOutcomeOf({ appointmentOutcome: 'attended' })).toBe('attended');
    expect(appointmentOutcomeOf({ appointmentOutcome: 'qualquer' })).toBeNull();
    expect(appointmentOutcomeOf(null)).toBeNull();
    expect(cardAppointment({})).toBeNull();
  });
});
```

O `zapFuso.test.js` compara o agendamento do cartão inteiro, então ele passa a esperar o `outcome`. Trocar a linha 154:

```js
    expect(card.appointment).toEqual({ type: 'Visita', at: '2026-09-08T21:00:00.000Z' });
```

por:

```js
    expect(card.appointment).toEqual({ type: 'Visita', at: '2026-09-08T21:00:00.000Z', outcome: null });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapCard.test.js api/__tests__/zapFuso.test.js`
Expected: FAIL. No `zapCard.test.js`, os testes novos falham (`appointmentOutcomeOf is not a function`, e o `outcome` ausente); no `zapFuso.test.js`, o de "as datas em ISO continuam sendo o instante gravado" falha pelo `outcome` que ainda não vem.

- [ ] **Step 3: Implementar em `api/_zapCard.js`**

Trocar a linha 14:

```js
const iso = (d) => (d ? d.toISOString() : null);
```

por:

```js
const iso = (d) => (d ? d.toISOString() : null);

// Desfecho que o cartão mostra: compareceu ou faltou. O Stronilead grava
// também 'rescheduled' (o lead já está com a data nova, então não há desfecho
// a mostrar) e 'cancelled', que tira o agendamento do cartão (cardAppointment).
export function appointmentOutcomeOf(lead) {
  const outcome = lead?.appointmentOutcome;
  return outcome === 'attended' || outcome === 'no_show' ? outcome : null;
}

// A linha "Agendamento" do cartão: tipo, dia e hora e o desfecho, ou null.
// Cancelado não aparece. O cancelamento da Meta Diária já apaga a data do
// lead; o do writeAppointmentOutcome sem consumeAppointment não apaga, e esta
// regra cobre esse caminho.
export function cardAppointment(lead) {
  if (lead?.appointmentOutcome === 'cancelled') return null;
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);
  return tipo && quando ? { type: tipo, at: iso(quando), outcome: appointmentOutcomeOf(lead) } : null;
}
```

Em `buildZapCard`, apagar as duas linhas logo depois de `const fim = getSafeDateOrNull(lead.currentContractEndsAt);` (26 e 27 do arquivo original):

```js
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);
```

E trocar a linha do `appointment` (36 do original):

```js
    appointment: tipo && quando ? { type: tipo, at: iso(quando) } : null,
```

por:

```js
    appointment: cardAppointment(lead),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapCard.test.js api/__tests__/zapFuso.test.js api/__tests__/zapRoute.test.js && npx eslint api/_zapCard.js api/__tests__/zapCard.test.js api/__tests__/zapFuso.test.js`
Expected: `Tests  139 passed (139)` (19 do cartão, 18 do fuso e os 102 da rota, que continuam iguais) e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/_zapCard.js api/__tests__/zapCard.test.js api/__tests__/zapFuso.test.js
git commit -m "feat: cartão do Zap mostra o desfecho do agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Regras do agendamento, parte 1: listas, dias e cadastros do número (`api/_zapSchedule.js`)

**Files:**
- Create: `api/_zapSchedule.js`
- Test: `api/__tests__/zapSchedule.test.js` (novo)

Esta parte serve o `schedule-options`: os textos das recusas, as listas do balão, os cinco dias sugeridos, quem conta na Meta, o parentesco do menor visto por quem escreve (nota 1), o `AppointmentDetail` e os cadastros do número. Os textos de `ZAP_SCHEDULE_MESSAGES` não estão na spec: são texto a confirmar com o Johnny.

- [ ] **Step 1: Escrever os testes que falham**

Criar `api/__tests__/zapSchedule.test.js`:

```js
import { describe, it, expect, vi, afterAll } from 'vitest';

// O agendamento pelo Stronizap roda numa função da Vercel, com o processo em
// UTC (lá o TZ é variável reservada). Como em zapFuso.test.js, o processo vai
// para UTC antes de importar as regras, e o primeiro teste confere que a
// troca pegou: na máquina de desenvolvimento, que fica em Brasília, um erro
// de fuso não apareceria.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  SCHEDULE_LIMIT, LEAD_IDS_MAX, ZAP_SCHEDULE_MESSAGES, unitsView, scheduleCatalogView, suggestedDays, countsForMeta,
  wardRelationship, appointmentDetailOf, scheduleTargets, readScheduleOptionsBody, buildScheduleOptions
} from '../_zapSchedule.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Instante escrito no horário de Brasília: brt('2026-09-29T15:40').
const brt = (s) => new Date(`${s}:00-03:00`);
// Terça, 29/09/2026, às 15:40 de Brasília, como nos mockups.
const AGORA = brt('2026-09-29T15:40');
const SEG_A_SEX = [1, 2, 3, 4, 5];

// Equipe como mora em stronix_users. O id é o do documento.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };

// Os catálogos do agendamento, como a rota lê: unidades, modalidades,
// professores e a config geral da academia.
const CATALOGOS = {
  units: [
    { id: 'un2', name: 'Zona Sul', address: '   ', order: 2 },
    { id: 'un1', name: 'Centro', address: ' Rua Garibaldi, 1200 ', order: 1 },
    { id: 'un3', name: '', order: 3 }
  ],
  modalities: [{ id: 'm2', name: 'Pilates', order: 2 }, { id: 'm1', name: 'Musculação', order: 1 }],
  professors: [
    { id: 'p2', nome: 'Rafael Moura', modalidadeIds: ['m2', 'm1'], order: 2 },
    { id: 'p1', nome: 'Carla Dias', modalidadeIds: ['m2'], order: 1 },
    { id: 'p3', nome: 'Paula Reis', modalidadeIds: ['m2'], ativo: false, order: 3 }
  ],
  config: null
};

// Mariana, lead da Ana, com visita marcada para quarta, 30/09, às 18:00.
const MARIANA = {
  id: 'L1', name: 'Mariana Lima', consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
  zapMatchKey: '5198124471', appointmentType: 'visita', appointmentScheduledFor: brt('2026-09-30T18:00'),
  appointmentUnit: 'Centro', nextFollowUpType: 'Visita'
};
// Pedro, filho da Mariana, com aula experimental de pilates marcada.
const MAE = { name: 'Mariana Lima', phone: '(51) 9 9812-4471', relationship: 'Mãe' };
const PEDRO = {
  id: 'L2', name: 'Pedro Lima', isMinor: true, guardian: MAE, sexo: 'Masculino', guardianZapMatchKey: '5198124471',
  appointmentType: 'aula_experimental', appointmentScheduledFor: brt('2026-10-02T19:00'), appointmentModality: 'Pilates',
  appointmentProfessorId: 'p1', appointmentProfessorName: 'Carla Dias', appointmentSoloTraining: false, trialClassesPlanned: 2
};
const LAURA = { id: 'L3', name: 'Laura Lima', isMinor: true, guardian: MAE, sexo: 'Feminino', guardianZapMatchKey: '5198124471' };

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

describe('limites e textos', () => {
  it('o limite é de 60 agendamentos por hora, e o appointment-status aceita até 30 leads', () => {
    expect(SCHEDULE_LIMIT).toEqual({ limit: 60, windowMs: 3600000 });
    expect(LEAD_IDS_MAX).toBe(30);
  });

  it('o texto de ids inválidos cita o teto', () => {
    expect(ZAP_SCHEDULE_MESSAGES.leadIds).toBe('Envie de 1 a 30 leads, sem repetir.');
  });
});

describe('scheduleCatalogView: as listas do balão', () => {
  it('na ordem da academia, sem item sem nome e sem professor desligado', () => {
    expect(scheduleCatalogView(CATALOGOS)).toEqual({
      units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }, { name: 'Zona Sul', address: null }],
      modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
      professors: [
        { id: 'p1', name: 'Carla Dias', modalityIds: ['m2'] },
        { id: 'p2', name: 'Rafael Moura', modalityIds: ['m2', 'm1'] }
      ],
      trialClassOptions: [1, 2, 3],
      metaWeekdays: SEG_A_SEX
    });
  });

  it('a quantidade de aulas e os dias da meta vêm da config geral, com a normalização do App.jsx', () => {
    const view = scheduleCatalogView({ ...CATALOGOS, config: { trialClassOptions: [2, 1, 2, 'x'], metaWeekdays: [1, 2, 3, 4, 5, 6] } });
    expect(view.trialClassOptions).toEqual([1, 2]);
    expect(view.metaWeekdays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(scheduleCatalogView({ config: { maxTrialClasses: 4 } }).trialClassOptions).toEqual([1, 2, 3, 4]);
  });

  it('unitsView sozinha: lista ausente vira lista vazia', () => {
    expect(unitsView(undefined)).toEqual([]);
  });
});

describe('suggestedDays: os cinco dias no horário de Brasília', () => {
  it('terça às 15:40: começa hoje, só de segunda a sexta', () => {
    expect(suggestedDays({ now: AGORA, metaWeekdays: SEG_A_SEX })).toEqual([
      { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
      { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
      { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
      { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
      { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' }
    ]);
  });

  it('a partir das 18h de Brasília, começa amanhã', () => {
    expect(suggestedDays({ now: brt('2026-09-29T18:00'), metaWeekdays: SEG_A_SEX }).map((d) => d.date))
      .toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']);
  });

  it('às 22:30 de Brasília, quando em UTC já é o dia seguinte, amanhã continua sendo o dia 30', () => {
    expect(suggestedDays({ now: brt('2026-09-29T22:30'), metaWeekdays: SEG_A_SEX })[0])
      .toEqual({ date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' });
  });

  it('meia-noite e meia de Brasília ainda é antes das 18h: começa hoje', () => {
    expect(suggestedDays({ now: brt('2026-09-30T00:30'), metaWeekdays: SEG_A_SEX })[0])
      .toEqual({ date: '2026-09-30', label: 'Hoje', defaultTime: '18:00' });
  });

  it('no sábado, com meta de segunda a sexta, hoje e amanhã ficam de fora', () => {
    expect(suggestedDays({ now: brt('2026-10-03T10:00'), metaWeekdays: SEG_A_SEX })).toEqual([
      { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' },
      { date: '2026-10-06', label: 'Terça', defaultTime: '09:00' },
      { date: '2026-10-07', label: 'Quarta', defaultTime: '09:00' },
      { date: '2026-10-08', label: 'Quinta', defaultTime: '09:00' },
      { date: '2026-10-09', label: 'Sexta', defaultTime: '09:00' }
    ]);
  });

  it('vira o mês e o ano no calendário de Brasília', () => {
    expect(suggestedDays({ now: brt('2026-12-30T10:00'), metaWeekdays: [0, 1, 2, 3, 4, 5, 6] })).toEqual([
      { date: '2026-12-30', label: 'Hoje', defaultTime: '18:00' },
      { date: '2026-12-31', label: 'Amanhã', defaultTime: '09:00' },
      { date: '2027-01-01', label: 'Sexta', defaultTime: '09:00' },
      { date: '2027-01-02', label: 'Sábado', defaultTime: '09:00' },
      { date: '2027-01-03', label: 'Domingo', defaultTime: '09:00' }
    ]);
  });

  it('lista de dias vazia vale todos os dias, como no assistente', () => {
    expect(suggestedDays({ now: brt('2026-10-03T10:00'), metaWeekdays: [] }).map((d) => d.label))
      .toEqual(['Hoje', 'Amanhã', 'Segunda', 'Terça', 'Quarta']);
  });
});

describe('countsForMeta: agendar hoje conta na Meta diária', () => {
  it('consultora em dia de meta conta; gestor nunca', () => {
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(true);
    expect(countsForMeta({ member: JOHNNY, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(false);
  });

  it('no sábado só conta se a academia tem meta no sábado', () => {
    const sabado = brt('2026-10-03T10:00');
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: sabado })).toBe(false);
    expect(countsForMeta({ member: ANA, metaWeekdays: [1, 2, 3, 4, 5, 6], now: sabado })).toBe(true);
  });

  it('sexta às 23:30 de Brasília, quando em UTC já é sábado, ainda é sexta', () => {
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: brt('2026-10-02T23:30') })).toBe(true);
  });
});

describe('wardRelationship: o parentesco do menor visto de quem escreve', () => {
  const menor = (relationship, sexo) => ({ guardian: { ...MAE, relationship }, sexo });

  it.each([
    ['Mãe', 'Masculino', 'Filho'], ['Mãe', 'Feminino', 'Filha'], ['Pai', 'Masculino', 'Filho'],
    ['Avó', 'Feminino', 'Neta'], ['Avô', 'Masculino', 'Neto'], ['Tia', 'Masculino', 'Sobrinho'], ['Tio', 'Feminino', 'Sobrinha']
  ])('%s de alguém do sexo %s: %s', (relationship, sexo, esperado) => {
    expect(wardRelationship(menor(relationship, sexo))).toBe(esperado);
  });

  it('sem sexo, com sexo "Outro", com parentesco "Outro" ou sem responsável, não adivinha', () => {
    expect(wardRelationship(menor('Mãe', null))).toBeNull();
    expect(wardRelationship(menor('Mãe', 'Outro'))).toBeNull();
    expect(wardRelationship(menor('Outro', 'Masculino'))).toBeNull();
    expect(wardRelationship({ name: 'Sem responsável' })).toBeNull();
  });
});

describe('appointmentDetailOf: o agendamento que a ficha, o cartão e a Meta mostram', () => {
  const unidades = unitsView(CATALOGOS.units);

  it('visita: a unidade com o endereço de agora', () => {
    expect(appointmentDetailOf(MARIANA, unidades)).toEqual({
      leadId: 'L1', leadName: 'Mariana Lima', type: 'visita', at: '2026-09-30T21:00:00.000Z',
      unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
      soloTraining: false, quantity: null, outcome: null
    });
  });

  it('aula: modalidade, professor e quantidade', () => {
    expect(appointmentDetailOf(PEDRO, unidades)).toEqual({
      leadId: 'L2', leadName: 'Pedro Lima', type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z',
      unit: null, unitAddress: null, modality: 'Pilates', professorName: 'Carla Dias',
      soloTraining: false, quantity: 2, outcome: null
    });
  });

  it('aula de quem treina sozinho: sem professor', () => {
    const sozinho = { ...PEDRO, appointmentProfessorId: null, appointmentProfessorName: null, appointmentSoloTraining: true };
    expect(appointmentDetailOf(sozinho)).toMatchObject({ professorName: null, soloTraining: true });
  });

  it('unidade que saiu da lista fica sem endereço; campo de aula esquecido numa visita não aparece', () => {
    const lead = { ...MARIANA, appointmentUnit: 'Unidade Antiga', appointmentModality: 'Pilates', trialClassesPlanned: 3 };
    expect(appointmentDetailOf(lead, unidades)).toMatchObject({ unit: 'Unidade Antiga', unitAddress: null, modality: null, quantity: null });
  });

  it('tipo gravado no formato antigo ("Visita") sai no formato do contrato', () => {
    expect(appointmentDetailOf({ ...MARIANA, appointmentType: 'Visita' }).type).toBe('visita');
  });

  it('agendamento antigo, só com nextFollowUp e nextFollowUpType, também vale, como no cartão', () => {
    const antigo = { id: 'L9', name: 'Antigo', nextFollowUpType: 'Aula Experimental', nextFollowUp: brt('2026-10-01T09:00') };
    expect(appointmentDetailOf(antigo)).toMatchObject({ type: 'aula_experimental', at: '2026-10-01T12:00:00.000Z' });
  });

  it('sem agendamento, null', () => {
    expect(appointmentDetailOf({ id: 'L9', name: 'Sem agenda' })).toBeNull();
    expect(appointmentDetailOf(null)).toBeNull();
  });

  it('desfecho: compareceu e faltou aparecem, remarcado não, e cancelado some inteiro', () => {
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'attended' }).outcome).toBe('attended');
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'no_show' }).outcome).toBe('no_show');
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'rescheduled' }).outcome).toBeNull();
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'cancelled' })).toBeNull();
  });
});

describe('scheduleTargets: os cadastros do número', () => {
  it('primeiro o do próprio número, depois os menores em ordem de nome, com o parentesco e o agendamento', () => {
    expect(scheduleTargets({ owner: MARIANA, wards: [PEDRO, LAURA] })).toEqual([
      { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null } },
      { leadId: 'L3', name: 'Laura Lima', relationship: 'Filha', appointment: null },
      { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null } }
    ]);
  });

  it('número sem cadastro: lista vazia', () => {
    expect(scheduleTargets({ owner: null, wards: [] })).toEqual([]);
  });

  it('agendamento que já aconteceu leva o desfecho, pela regra do cartão', () => {
    expect(scheduleTargets({ owner: { ...MARIANA, appointmentOutcome: 'attended' } })[0].appointment)
      .toEqual({ type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: 'attended' });
  });

  it('remarcado não é desfecho, e cancelado tira o agendamento', () => {
    expect(scheduleTargets({ owner: { ...MARIANA, appointmentOutcome: 'rescheduled' } })[0].appointment)
      .toEqual({ type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null });
    expect(scheduleTargets({ owner: { ...MARIANA, appointmentOutcome: 'cancelled' } })[0].appointment).toBeNull();
  });
});

describe('readScheduleOptionsBody', () => {
  it('lê o número da conversa e o e-mail de quem pede', () => {
    expect(readScheduleOptionsBody({ phone: '5551998124471', actor: { email: ' ANA@stronix.com.br ' } })).toEqual({
      value: { phone: '51998124471', matchKey: '5198124471', email: 'ana@stronix.com.br' }
    });
  });

  it('número que não é WhatsApp com DDD e pedido sem e-mail são recusados no campo', () => {
    expect(readScheduleOptionsBody({ phone: '123', actor: { email: ANA.email } }).refusal).toEqual({
      status: 400, body: { error: 'dados_invalidos', field: 'phone', message: 'O número desta conversa não é um WhatsApp com DDD.' }
    });
    expect(readScheduleOptionsBody({ phone: '5551998124471' }).refusal).toEqual({
      status: 400, body: { error: 'dados_invalidos', field: 'actor', message: 'Não deu para saber quem está agendando.' }
    });
  });
});

describe('buildScheduleOptions: a resposta do schedule-options', () => {
  it('consultora em dia de meta, com a Mariana e o Pedro no número', () => {
    expect(buildScheduleOptions({ member: ANA, catalogs: CATALOGOS, owner: MARIANA, wards: [PEDRO], now: AGORA })).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
      targets: [
        { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null } },
        { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null } }
      ],
      units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }, { name: 'Zona Sul', address: null }],
      modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
      professors: [
        { id: 'p1', name: 'Carla Dias', modalityIds: ['m2'] },
        { id: 'p2', name: 'Rafael Moura', modalityIds: ['m2', 'm1'] }
      ],
      trialClassOptions: [1, 2, 3],
      days: [
        { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
        { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
        { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
        { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
        { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' }
      ]
    });
  });

  it('gestor: papel gestor, fora da Meta', () => {
    expect(buildScheduleOptions({ member: JOHNNY, catalogs: CATALOGOS, now: AGORA }).actor)
      .toEqual({ id: 'u-johnny', name: 'Johnny', role: 'gestor', countsForMeta: false });
  });

  it('os dias seguem a meta da academia', () => {
    const catalogs = { ...CATALOGOS, config: { metaWeekdays: [1, 2, 3, 4, 5, 6] } };
    expect(buildScheduleOptions({ member: ANA, catalogs, now: AGORA }).days.map((d) => d.label))
      .toEqual(['Hoje', 'Amanhã', 'Quinta', 'Sexta', 'Sábado']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js`
Expected: FAIL, com `Cannot find module '/api/_zapSchedule.js'` e nenhum teste rodado.

- [ ] **Step 3: Criar `api/_zapSchedule.js`**

```js
// Regras puras do agendamento pelo Stronizap (ações schedule-options, schedule
// e appointment-status de api/zap.js). Sem Firestore: a rota lê, chama estas
// funções e grava. O firebase-admin passa por cima das regras do Firestore,
// então o que o assistente de agendamento da ficha e as regras garantem é
// refeito aqui.
//
// A gravação espelha o assistente (handleWizardConfirm, em
// src/views/LeadProfileView.jsx, mais o upsertScheduledAppointment de
// src/lib/aulasWrites.js e o logInteraction de src/lib/interactions.js): o
// mesmo registro em stronix_aulas, a mesma interação e o mesmo patch do lead
// (buildSchedulePatch). Mudou o assistente, mude aqui.
//
// Dia e hora sempre no horário de Brasília (_horarioDeBrasilia.js), porque a
// função da Vercel roda em UTC. Toda recusa de regra leva `message`, um texto
// pronto para a tela. Nada daqui vai para o log.
//
// Spec: docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md
import { ZAP_LEAD_MESSAGES, invalidData, nationalDigits, emailFromActor, teamRole } from './_zapLead.js';
import { zapMatchKey } from './_zapPhone.js';
import { appointmentOutcomeOf } from './_zapCard.js';
import { diaDeBrasilia, horaInteiraDeBrasilia, diaDaSemanaDoDia, isoDoDia } from './_horarioDeBrasilia.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { normalizeAppointmentType } from '../src/lib/dates.js';
import { normalizeTrialClassOptions, normalizeMetaWeekdays } from '../src/lib/leadStatus.js';

const MINUTE_MS = 60000;
// Anotação do agendamento: o mesmo tamanho da observação do cadastro.
const NOTE_MAX = 1000;
// Dias sugeridos e até onde procurar por eles (wzDayOptions do ScheduleWizard).
const DAYS_SHOWN = 5;
const DAYS_SEARCHED = 90;
// Depois das 18h de Brasília, os dias sugeridos começam amanhã.
const EVENING_HOUR = 18;

// Leads por pedido do appointment-status: o teto do operador `in` do
// Firestore, o mesmo do match.
export const LEAD_IDS_MAX = 30;

// No máximo 60 agendamentos por hora por academia (api/_rateLimit.js).
export const SCHEDULE_LIMIT = Object.freeze({ limit: 60, windowMs: 60 * MINUTE_MS });

// Dia da semana curto, sem "-feira": o balão do Stronizap tem 380px.
const WEEKDAY_LABEL = Object.freeze(['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);

// Os textos das recusas do agendamento. Academia bloqueada, fora da equipe,
// telefone, canal e campo em formato errado usam os do cadastro
// (ZAP_LEAD_MESSAGES).
export const ZAP_SCHEDULE_MESSAGES = Object.freeze({
  actor: 'Não deu para saber quem está agendando.',
  schedule: 'Faltaram os dados do agendamento.',
  leadId: 'Não deu para saber para quem é o agendamento.',
  type: 'Escolha entre visita e aula experimental.',
  date: 'Escolha o dia.',
  time: 'Escolha o horário.',
  noteLong: `Anotação longa demais. Use até ${NOTE_MAX} caracteres.`,
  leadIds: `Envie de 1 a ${LEAD_IDS_MAX} leads, sem repetir.`,
  pick: Object.freeze({
    unit: 'Escolha a unidade.',
    modality: 'Escolha a modalidade.',
    professorId: 'Escolha o professor ou "Treina sozinho".',
    quantity: 'Escolha quantas aulas.'
  }),
  gone: Object.freeze({
    unit: 'Essa unidade não existe mais no Stronilead. Escolha de novo.',
    modality: 'Essa modalidade não existe mais no Stronilead. Escolha de novo.',
    professorId: 'Esse professor não está mais disponível para essa modalidade. Escolha de novo.',
    quantity: 'Essa quantidade de aulas não existe mais no Stronilead. Escolha de novo.'
  }),
  pastTime: 'Esse horário já passou. Escolha outro.',
  notTheLead: 'Esse cadastro não é deste número no Stronilead.',
  alreadyScheduled: 'Esse agendamento já estava no Stronilead.',
  rateLimited: 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.'
});

// ---------------------------------------------------------------------------
// Listas do balão e cadastros do número (schedule-options)
// ---------------------------------------------------------------------------

const hasText = (v) => typeof v === 'string' && v.trim() !== '';
const textOrNull = (v) => (hasText(v) ? v : null);
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const sortedByOrder = (docs) => [...(docs || [])].sort(byOrder);
// A mesma ordem de nome do cartão (buildZapWards, em api/_zapCard.js).
const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR');
const positiveIntOrNull = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// As unidades na ordem da academia, com o nome gravado (é o que o lead guarda
// em appointmentUnit) e o endereço, ou null quando está vazio.
export function unitsView(units) {
  return sortedByOrder(units)
    .filter((u) => hasText(u.name))
    .map((u) => ({ name: u.name, address: hasText(u.address) ? u.address.trim() : null }));
}

// Os catálogos no formato do balão, na ordem das telas do Stronilead (a mesma
// do App.jsx: tudo pelo `order`). Professor desligado (ativo: false) fica de
// fora, como no assistente. A quantidade de aulas e os dias da meta passam
// pela mesma normalização do App.jsx.
export function scheduleCatalogView({ units = [], modalities = [], professors = [], config = null } = {}) {
  return {
    units: unitsView(units),
    modalities: sortedByOrder(modalities).filter((m) => hasText(m.name)).map((m) => ({ id: m.id, name: m.name })),
    professors: sortedByOrder(professors)
      .filter((p) => p.ativo !== false && hasText(p.nome))
      .map((p) => ({
        id: p.id,
        name: p.nome,
        modalityIds: (Array.isArray(p.modalidadeIds) ? p.modalidadeIds : []).filter((id) => typeof id === 'string')
      })),
    trialClassOptions: normalizeTrialClassOptions(config?.trialClassOptions, config?.maxTrialClasses),
    metaWeekdays: normalizeMetaWeekdays(config?.metaWeekdays)
  };
}

// Os cinco dias sugeridos, na regra do wzDayOptions do ScheduleWizard, mas no
// horário de Brasília: começa hoje antes das 18h e amanhã depois delas, só nos
// dias da meta da academia (lista vazia vale todos) e procura no máximo 90
// dias. O horário começa em 18:00 para hoje e 09:00 para os outros dias.
export function suggestedDays({ now = new Date(), metaWeekdays = null } = {}) {
  const today = diaDeBrasilia(now);
  const startOffset = horaInteiraDeBrasilia(now) >= EVENING_HOUR ? 1 : 0;
  const onMeta = (dia) =>
    !Array.isArray(metaWeekdays) || metaWeekdays.length === 0 || metaWeekdays.includes(diaDaSemanaDoDia(dia));
  const days = [];
  for (let k = 0; days.length < DAYS_SHOWN && k < DAYS_SEARCHED; k++) {
    const offset = startOffset + k;
    const dia = today + offset;
    if (!onMeta(dia)) continue;
    let label = WEEKDAY_LABEL[diaDaSemanaDoDia(dia)];
    if (offset === 0) label = 'Hoje';
    else if (offset === 1) label = 'Amanhã';
    days.push({ date: isoDoDia(dia), label, defaultTime: offset === 0 ? '18:00' : '09:00' });
  }
  return days;
}

// Agendar hoje conta na Meta diária de quem agenda: consultor, em dia da meta
// da academia, no calendário de Brasília. Gestor fica fora da régua, como no
// Stronilead.
export function countsForMeta({ member, metaWeekdays, now = new Date() }) {
  return teamRole(member) === 'consultor' && (metaWeekdays || []).includes(diaDaSemanaDoDia(diaDeBrasilia(now)));
}

// O parentesco do menor visto por quem escreve: a mãe vê "Filho" ou "Filha".
// O cadastro guarda o contrário (guardian.relationship é "Mãe", "Pai"...), e
// o gênero sai do campo Sexo do lead. Sem sexo, ou com "Outro", não dá para
// escrever sem adivinhar, e vai null, como no cadastro do próprio número.
const WARD_OF = Object.freeze({
  Mãe: ['Filho', 'Filha'], Pai: ['Filho', 'Filha'],
  Avó: ['Neto', 'Neta'], Avô: ['Neto', 'Neta'],
  Tia: ['Sobrinho', 'Sobrinha'], Tio: ['Sobrinho', 'Sobrinha']
});
export function wardRelationship(lead) {
  const pair = WARD_OF[lead?.guardian?.relationship];
  if (!pair) return null;
  if (lead.sexo === 'Masculino') return pair[0];
  if (lead.sexo === 'Feminino') return pair[1];
  return null;
}

// O agendamento que a ficha, o cartão e a Meta Diária mostram hoje, no
// formato AppointmentDetail do contrato da ponte, ou null. Sai do lead, pelas
// mesmas leituras do cartão, e cancelado vira null. `units` é a lista de
// unitsView, de onde sai o endereço da unidade pelo nome.
export function appointmentDetailOf(lead, units = []) {
  if (!lead || lead.appointmentOutcome === 'cancelled') return null;
  const type = normalizeAppointmentType(getLeadAppointmentType(lead));
  const at = getLeadAppointmentDate(lead);
  if (!type || !at) return null;
  const isVisita = type === 'visita';
  const unit = isVisita ? textOrNull(lead.appointmentUnit) : null;
  return {
    leadId: lead.id ?? null,
    leadName: lead.name ?? null,
    type,
    at: at.toISOString(),
    unit,
    unitAddress: unit ? ((units || []).find((u) => u.name === unit)?.address ?? null) : null,
    modality: isVisita ? null : textOrNull(lead.appointmentModality),
    professorName: isVisita ? null : textOrNull(lead.appointmentProfessorName),
    soloTraining: isVisita ? false : Boolean(lead.appointmentSoloTraining),
    quantity: isVisita ? null : positiveIntOrNull(lead.trialClassesPlanned),
    outcome: appointmentOutcomeOf(lead)
  };
}

// Os cadastros do número, na ordem do "Para quem?": primeiro o do próprio
// número, depois os menores em ordem de nome, como os `wards` do cartão. O
// agendamento de cada um alimenta o aviso de remarcação, e o desfecho vai
// junto (pela regra do cartão), para o Stronizap só avisar quando o
// agendamento ainda não aconteceu.
export function scheduleTargets({ owner = null, wards = [] } = {}) {
  const target = (lead, relationship) => {
    const detail = appointmentDetailOf(lead);
    return {
      leadId: lead.id,
      name: lead.name ?? null,
      relationship,
      appointment: detail ? { type: detail.type, at: detail.at, outcome: detail.outcome } : null
    };
  };
  return [
    ...(owner ? [target(owner, null)] : []),
    ...[...(wards || [])].sort(byName).map((w) => target(w, wardRelationship(w)))
  ];
}

// Lê o corpo do schedule-options: o número da conversa e o e-mail de quem pede.
export function readScheduleOptionsBody(body) {
  const phone = nationalDigits(body?.phone);
  if (!phone) return { refusal: invalidData('phone', ZAP_LEAD_MESSAGES.phone) };
  const email = emailFromActor(body?.actor);
  if (!email) return { refusal: invalidData('actor', ZAP_SCHEDULE_MESSAGES.actor) };
  return { value: { phone, matchKey: zapMatchKey(phone), email } };
}

// Resposta do schedule-options.
export function buildScheduleOptions({ member, catalogs, owner = null, wards = [], now = new Date() }) {
  const view = scheduleCatalogView(catalogs);
  return {
    actor: {
      id: member.id,
      name: member.name ?? null,
      role: teamRole(member),
      countsForMeta: countsForMeta({ member, metaWeekdays: view.metaWeekdays, now })
    },
    targets: scheduleTargets({ owner, wards }),
    units: view.units,
    modalities: view.modalities,
    professors: view.professors,
    trialClassOptions: view.trialClassOptions,
    days: suggestedDays({ now, metaWeekdays: view.metaWeekdays })
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js && npx eslint api/_zapSchedule.js api/__tests__/zapSchedule.test.js`
Expected: `Tests  41 passed (41)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/_zapSchedule.js api/__tests__/zapSchedule.test.js
git commit -m "feat: listas, dias e cadastros do número para o agendamento pelo Stronizap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regras do agendamento, parte 2: pedido e conferências

**Files:**
- Modify: `api/_zapSchedule.js`
- Test: `api/__tests__/zapSchedule.test.js`

Esta parte lê e confere o pedido do `schedule` e do `appointment-status`: o formato, o catálogo de agora, o horário no futuro, o lead do número e o agendamento repetido.

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapSchedule.test.js`, trocar o import de `../_zapSchedule.js` por:

```js
import {
  SCHEDULE_LIMIT, LEAD_IDS_MAX, ZAP_SCHEDULE_MESSAGES, unitsView, scheduleCatalogView, suggestedDays, countsForMeta,
  wardRelationship, appointmentDetailOf, scheduleTargets, readScheduleOptionsBody, buildScheduleOptions,
  isDocId, readScheduleBody, readStatusBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment
} from '../_zapSchedule.js';
```

E acrescentar no fim do arquivo:

```js
describe('readScheduleBody: só o formato do pedido', () => {
  const VISITA = {
    leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
    quantity: null, date: '2026-10-01', time: '18:00', note: '  Vem depois do trabalho.  '
  };
  const AULA = {
    leadId: 'L2', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
    quantity: 1, date: '2026-10-02', time: '19:00', note: null
  };
  const corpo = (schedule = {}, extra = {}) => ({
    phone: '5551998124471', actor: { email: ' Ana@Stronix.com.br ', name: ' Ana ' }, channelName: ' Recepção ',
    schedule: { ...VISITA, ...schedule }, ...extra
  });
  const recusa = (b) => readScheduleBody(b).refusal;

  it('visita: número normalizado, e-mail, canal e o instante no horário de Brasília', () => {
    expect(readScheduleBody(corpo())).toEqual({
      value: {
        phone: '51998124471', matchKey: '5198124471', email: 'ana@stronix.com.br', actorName: 'Ana', channelName: 'Recepção',
        at: new Date('2026-10-01T21:00:00.000Z'),
        schedule: {
          leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
          quantity: null, note: 'Vem depois do trabalho.'
        }
      }
    });
  });

  it('aula: modalidade, professor e quantidade; unidade fica null', () => {
    expect(readScheduleBody(corpo(AULA)).value.schedule).toEqual({
      leadId: 'L2', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
      quantity: 1, note: null
    });
  });

  it('aula de quem treina sozinho: sem professor', () => {
    expect(readScheduleBody(corpo({ ...AULA, professorId: null, soloTraining: true })).value.schedule)
      .toMatchObject({ professorId: null, soloTraining: true });
  });

  it('anotação e canal em branco viram null', () => {
    const { value } = readScheduleBody(corpo({ note: '   ' }, { channelName: '  ' }));
    expect(value.schedule.note).toBeNull();
    expect(value.channelName).toBeNull();
  });

  it.each([
    ['phone', corpo({}, { phone: '123' })],
    ['actor', corpo({}, { actor: { email: 'sem-arroba' } })],
    ['channelName', corpo({}, { channelName: 42 })],
    ['schedule', corpo({}, { schedule: null })],
    ['schedule', corpo({}, { schedule: [] })],
    ['leadId', corpo({ leadId: '' })],
    ['leadId', corpo({ leadId: 'a/b' })],
    ['leadId', corpo({ leadId: 5 })],
    ['type', corpo({ type: 'ligacao' })],
    ['unit', corpo({ unit: 3 })],
    ['note', corpo({ note: 3 })],
    ['quantity', corpo({ ...AULA, quantity: '2' })],
    ['quantity', corpo({ ...AULA, quantity: 1.5 })],
    ['quantity', corpo({ ...AULA, quantity: 0 })],
    ['professorId', corpo({ ...AULA, soloTraining: 'sim' })],
    ['modality', corpo({ modality: 'Pilates' })],
    ['professorId', corpo({ professorId: 'p1' })],
    ['professorId', corpo({ soloTraining: true })],
    ['quantity', corpo({ quantity: 1 })],
    ['unit', corpo({ ...AULA, unit: 'Centro' })],
    ['professorId', corpo({ ...AULA, soloTraining: true })],
    ['date', corpo({ date: '2026-02-30' })],
    ['date', corpo({ date: '01/10/2026' })],
    ['time', corpo({ time: '24:00' })],
    ['time', corpo({ time: '9:00' })],
    ['note', corpo({ note: 'x'.repeat(1001) })]
  ])('formato errado no campo %s é recusado com 400', (field, b) => {
    expect(recusa(b)).toMatchObject({ status: 400, body: { error: 'dados_invalidos', field } });
    expect(typeof recusa(b).body.message).toBe('string');
  });

  it('os textos da tela para dia, horário e anotação', () => {
    expect(recusa(corpo({ date: '2026-02-30' })).body.message).toBe('Escolha o dia.');
    expect(recusa(corpo({ time: '24:00' })).body.message).toBe('Escolha o horário.');
    expect(recusa(corpo({ note: 'x'.repeat(1001) })).body.message).toBe('Anotação longa demais. Use até 1000 caracteres.');
  });

  it('isDocId: texto, sem barra, nem "." nem ".."', () => {
    expect(isDocId('L1')).toBe(true);
    expect([isDocId(''), isDocId('a/b'), isDocId('.'), isDocId('..'), isDocId(7), isDocId('x'.repeat(129))])
      .toEqual([false, false, false, false, false, false]);
  });
});

describe('readStatusBody: de 1 a 30 leads, sem repetir', () => {
  it('lista válida passa como veio', () => {
    expect(readStatusBody({ leadIds: ['L1', 'L2'] })).toEqual({ value: { leadIds: ['L1', 'L2'] } });
    const trinta = Array.from({ length: 30 }, (_, i) => `L${i}`);
    expect(readStatusBody({ leadIds: trinta }).value.leadIds).toHaveLength(30);
  });

  it.each([
    ['ausente', undefined], ['vazia', []], ['31 ids', Array.from({ length: 31 }, (_, i) => `L${i}`)],
    ['repetido', ['L1', 'L1']], ['número', ['L1', 2]], ['com barra', ['a/b']]
  ])('lista %s é recusada no campo leadIds', (_, leadIds) => {
    expect(readStatusBody({ leadIds }).refusal).toEqual({
      status: 400, body: { error: 'dados_invalidos', field: 'leadIds', message: 'Envie de 1 a 30 leads, sem repetir.' }
    });
  });
});

describe('checkScheduleCatalog: o que foi escolhido ainda existe no Stronilead', () => {
  const visita = (unit) => ({ type: 'visita', unit });
  const aula = (extra = {}) => ({ type: 'aula_experimental', modality: 'Pilates', professorId: 'p1', soloTraining: false, quantity: 1, ...extra });
  const gone = (field, message) => ({ status: 422, body: { error: 'catalogo_mudou', field, message } });
  const pick = (field, message) => ({ status: 400, body: { error: 'dados_invalidos', field, message } });

  it('visita numa unidade que existe passa', () => {
    expect(checkScheduleCatalog(visita('Centro'), CATALOGOS)).toBeNull();
  });

  it('com unidade cadastrada, a unidade é obrigatória e precisa existir', () => {
    expect(checkScheduleCatalog(visita(null), CATALOGOS)).toEqual(pick('unit', 'Escolha a unidade.'));
    expect(checkScheduleCatalog(visita('Unidade Antiga'), CATALOGOS))
      .toEqual(gone('unit', 'Essa unidade não existe mais no Stronilead. Escolha de novo.'));
  });

  it('academia sem unidade: visita sem unidade passa, e uma unidade que não existe é recusada', () => {
    const semUnidade = { ...CATALOGOS, units: [] };
    expect(checkScheduleCatalog(visita(null), semUnidade)).toBeNull();
    expect(checkScheduleCatalog(visita('Centro'), semUnidade)).toMatchObject({ status: 422, body: { field: 'unit' } });
  });

  it('aula com modalidade, professor que dá a modalidade e quantidade da academia passa', () => {
    expect(checkScheduleCatalog(aula(), CATALOGOS)).toBeNull();
    expect(checkScheduleCatalog(aula({ professorId: 'p2', quantity: 3 }), CATALOGOS)).toBeNull();
  });

  it('"Treina sozinho" dispensa o professor', () => {
    expect(checkScheduleCatalog(aula({ professorId: null, soloTraining: true }), CATALOGOS)).toBeNull();
  });

  it('modalidade em branco é campo a escolher; modalidade que sumiu é recusada', () => {
    expect(checkScheduleCatalog(aula({ modality: null }), CATALOGOS)).toEqual(pick('modality', 'Escolha a modalidade.'));
    expect(checkScheduleCatalog(aula({ modality: 'Crossfit' }), CATALOGOS))
      .toEqual(gone('modality', 'Essa modalidade não existe mais no Stronilead. Escolha de novo.'));
  });

  it('sem professor e sem "Treina sozinho" é campo a escolher', () => {
    expect(checkScheduleCatalog(aula({ professorId: null }), CATALOGOS))
      .toEqual(pick('professorId', 'Escolha o professor ou "Treina sozinho".'));
  });

  it.each([
    ['desligado', aula({ professorId: 'p3' })],
    ['que não dá a modalidade', aula({ modality: 'Musculação', professorId: 'p1' })],
    ['apagado', aula({ professorId: 'p9' })]
  ])('professor %s é recusado', (_, schedule) => {
    expect(checkScheduleCatalog(schedule, CATALOGOS))
      .toEqual(gone('professorId', 'Esse professor não está mais disponível para essa modalidade. Escolha de novo.'));
  });

  it('quantidade em branco é campo a escolher; fora das opções da academia é recusada', () => {
    expect(checkScheduleCatalog(aula({ quantity: null }), CATALOGOS)).toEqual(pick('quantity', 'Escolha quantas aulas.'));
    expect(checkScheduleCatalog(aula({ quantity: 4 }), CATALOGOS))
      .toEqual(gone('quantity', 'Essa quantidade de aulas não existe mais no Stronilead. Escolha de novo.'));
    expect(checkScheduleCatalog(aula({ quantity: 3 }), { ...CATALOGOS, config: { trialClassOptions: [1, 2] } }))
      .toMatchObject({ status: 422, body: { field: 'quantity' } });
  });
});

describe('checkFuture: horário que já passou não é aceito', () => {
  it('um minuto depois de agora passa; agora e antes, não', () => {
    expect(checkFuture(brt('2026-09-29T15:41'), AGORA)).toBeNull();
    const recusa = { status: 422, body: { error: 'horario_passado', message: 'Esse horário já passou. Escolha outro.' } };
    expect(checkFuture(brt('2026-09-29T15:40'), AGORA)).toEqual(recusa);
    expect(checkFuture(brt('2026-09-28T18:00'), AGORA)).toEqual(recusa);
  });
});

describe('leadBelongsToNumber: o lead é deste número', () => {
  const NUMERO = '5198124471';

  it('o cadastro do próprio número e o menor de quem o número é responsável', () => {
    expect(leadBelongsToNumber(MARIANA, NUMERO, AGORA)).toBe(true);
    expect(leadBelongsToNumber(PEDRO, NUMERO, AGORA)).toBe(true);
  });

  it('quem fez 18 com WhatsApp próprio deixa de ser do número do responsável; sem WhatsApp próprio, continua', () => {
    const adulto = { ...PEDRO, birthDate: new Date('2000-01-10T03:00:00.000Z') };
    expect(leadBelongsToNumber({ ...adulto, whatsapp: '(51) 9 9555-4444' }, NUMERO, AGORA)).toBe(false);
    expect(leadBelongsToNumber(adulto, NUMERO, AGORA)).toBe(true);
  });

  it('outro número, lead ausente ou chave ausente: não', () => {
    expect(leadBelongsToNumber(MARIANA, '1187654321', AGORA)).toBe(false);
    expect(leadBelongsToNumber(null, NUMERO, AGORA)).toBe(false);
    expect(leadBelongsToNumber(MARIANA, null, AGORA)).toBe(false);
  });
});

describe('hasSameAppointment: o mesmo agendamento já gravado', () => {
  const at = brt('2026-09-30T18:00');

  it('mesmo tipo, mesmo dia e mesmo horário', () => {
    expect(hasSameAppointment(MARIANA, { type: 'visita', at })).toBe(true);
  });

  it('outro horário, outro tipo ou agendamento cancelado não é o mesmo', () => {
    expect(hasSameAppointment(MARIANA, { type: 'visita', at: brt('2026-09-30T18:30') })).toBe(false);
    expect(hasSameAppointment(MARIANA, { type: 'aula_experimental', at })).toBe(false);
    expect(hasSameAppointment({ ...MARIANA, appointmentOutcome: 'cancelled' }, { type: 'visita', at })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js`
Expected: FAIL, `56 failed | 41 passed`, com `TypeError: readScheduleBody is not a function` e o mesmo para `readStatusBody`, `checkScheduleCatalog`, `checkFuture`, `leadBelongsToNumber`, `hasSameAppointment` e `isDocId`.

- [ ] **Step 3: Implementar em `api/_zapSchedule.js`**

Trocar o bloco de imports do topo (as sete linhas de `import`) por:

```js
import { ZAP_LEAD_MESSAGES, refusal, invalidData, nationalDigits, emailFromActor, teamRole } from './_zapLead.js';
import { zapMatchKey } from './_zapPhone.js';
import { appointmentOutcomeOf } from './_zapCard.js';
import {
  diaDeBrasilia, horaInteiraDeBrasilia, diaDaSemanaDoDia, isoDoDia, instanteDeBrasilia
} from './_horarioDeBrasilia.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { normalizeAppointmentType } from '../src/lib/dates.js';
import { normalizeTrialClassOptions, normalizeMetaWeekdays } from '../src/lib/leadStatus.js';
import { professorsForModality } from '../src/lib/professores.js';
import { contactOf } from '../src/lib/guardian.js';
```

E acrescentar no fim do arquivo:

```js
// ---------------------------------------------------------------------------
// Pedido de agendamento e conferências (schedule e appointment-status)
// ---------------------------------------------------------------------------

// Os mesmos tetos do cadastro (api/_zapLead.js).
const NAME_MAX = 120;
const CHANNEL_MAX = 80;

export const SCHEDULE_TYPES = Object.freeze(['visita', 'aula_experimental']);

// Id de documento do Firestore: texto não vazio, sem barra, que não seja "."
// nem "..".
export const isDocId = (v) =>
  typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/') && v !== '.' && v !== '..';

// Lê o corpo do schedule. Só o formato: o que depende da academia (equipe,
// catálogos, o lead) é conferido depois. Devolve { value } ou { refusal }.
// Visita não leva campo de aula, e aula não leva unidade. O instante sai do
// dia e da hora de Brasília.
export function readScheduleBody(body) {
  const phone = nationalDigits(body?.phone);
  if (!phone) return { refusal: invalidData('phone', ZAP_LEAD_MESSAGES.phone) };
  const email = emailFromActor(body?.actor);
  if (!email) return { refusal: invalidData('actor', ZAP_SCHEDULE_MESSAGES.actor) };
  const channel = body.channelName;
  if (channel != null && typeof channel !== 'string') {
    return { refusal: invalidData('channelName', ZAP_LEAD_MESSAGES.channelName) };
  }
  const s = body.schedule;
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return { refusal: invalidData('schedule', ZAP_SCHEDULE_MESSAGES.schedule) };
  }
  if (!isDocId(s.leadId)) return { refusal: invalidData('leadId', ZAP_SCHEDULE_MESSAGES.leadId) };
  if (!SCHEDULE_TYPES.includes(s.type)) return { refusal: invalidData('type', ZAP_SCHEDULE_MESSAGES.type) };
  const wrong = (field) => ({ refusal: invalidData(field, ZAP_LEAD_MESSAGES.wrongType) });
  for (const field of ['unit', 'modality', 'professorId', 'note']) {
    if (s[field] != null && typeof s[field] !== 'string') return wrong(field);
  }
  if (s.quantity != null && !(Number.isInteger(s.quantity) && s.quantity > 0)) return wrong('quantity');
  // soloTraining não tem campo próprio na tela: é a opção "Treina sozinho" do
  // passo do professor.
  if (s.soloTraining != null && typeof s.soloTraining !== 'boolean') return wrong('professorId');
  const isAula = s.type === 'aula_experimental';
  if (isAula) {
    if (hasText(s.unit)) return wrong('unit');
    if (hasText(s.professorId) && s.soloTraining === true) return wrong('professorId');
  } else {
    if (hasText(s.modality)) return wrong('modality');
    if (hasText(s.professorId) || s.soloTraining === true) return wrong('professorId');
    if (s.quantity != null) return wrong('quantity');
  }
  if (!instanteDeBrasilia(s.date, '00:00')) return { refusal: invalidData('date', ZAP_SCHEDULE_MESSAGES.date) };
  const at = instanteDeBrasilia(s.date, s.time);
  if (!at) return { refusal: invalidData('time', ZAP_SCHEDULE_MESSAGES.time) };
  const note = typeof s.note === 'string' ? s.note.trim() : '';
  if (note.length > NOTE_MAX) return { refusal: invalidData('note', ZAP_SCHEDULE_MESSAGES.noteLong) };
  const actorName = typeof body.actor.name === 'string' ? body.actor.name.trim().slice(0, NAME_MAX) : '';
  return {
    value: {
      phone,
      matchKey: zapMatchKey(phone),
      email,
      actorName: actorName || null,
      channelName: (typeof channel === 'string' ? channel.trim().slice(0, CHANNEL_MAX) : '') || null,
      at,
      schedule: {
        leadId: s.leadId,
        type: s.type,
        unit: isAula ? null : textOrNull(s.unit),
        modality: isAula ? textOrNull(s.modality) : null,
        professorId: isAula ? textOrNull(s.professorId) : null,
        soloTraining: isAula && s.soloTraining === true,
        quantity: isAula ? (s.quantity ?? null) : null,
        note: note || null
      }
    }
  };
}

// Lê o corpo do appointment-status: de 1 a 30 ids de lead, sem repetição.
export function readStatusBody(body) {
  const ids = body?.leadIds;
  const ok = Array.isArray(ids) && ids.length > 0 && ids.length <= LEAD_IDS_MAX
    && ids.every(isDocId) && new Set(ids).size === ids.length;
  return ok ? { value: { leadIds: ids } } : { refusal: invalidData('leadIds', ZAP_SCHEDULE_MESSAGES.leadIds) };
}

// Unidade, modalidade, professor e quantidade conferidos contra o que existe
// agora no Stronilead. Academia sem unidade não tem o passo da unidade; com
// unidade, ele é obrigatório. O professor precisa estar ativo e dar a
// modalidade (professorsForModality, a regra do assistente), ou a aula é de
// quem treina sozinho. `catalogs` são os documentos que a rota leu.
export function checkScheduleCatalog(schedule, catalogs) {
  const view = scheduleCatalogView(catalogs);
  const gone = (field) => refusal(422, 'catalogo_mudou', ZAP_SCHEDULE_MESSAGES.gone[field], { field });
  const pick = (field) => invalidData(field, ZAP_SCHEDULE_MESSAGES.pick[field]);
  if (schedule.type === 'visita') {
    if (view.units.length === 0) return schedule.unit ? gone('unit') : null;
    if (!schedule.unit) return pick('unit');
    return view.units.some((u) => u.name === schedule.unit) ? null : gone('unit');
  }
  if (!schedule.modality) return pick('modality');
  if (!view.modalities.some((m) => m.name === schedule.modality)) return gone('modality');
  if (!schedule.soloTraining) {
    if (!schedule.professorId) return pick('professorId');
    const teachers = professorsForModality(catalogs?.professors, catalogs?.modalities, schedule.modality);
    if (!teachers.some((p) => p.id === schedule.professorId && hasText(p.nome))) return gone('professorId');
  }
  if (schedule.quantity == null) return pick('quantity');
  return view.trialClassOptions.includes(schedule.quantity) ? null : gone('quantity');
}

// Horário que já passou não é aceito.
export function checkFuture(at, now = new Date()) {
  return at.getTime() > now.getTime() ? null : refusal(422, 'horario_passado', ZAP_SCHEDULE_MESSAGES.pastTime);
}

// O lead escolhido é o cadastro do próprio número, ou um menor que tem esse
// número como responsável e ainda o tem como contato: a mesma conta do cartão.
export function leadBelongsToNumber(lead, matchKey, now = new Date()) {
  if (!lead || !matchKey) return false;
  if (lead.zapMatchKey === matchKey) return true;
  return lead.guardianZapMatchKey === matchKey && contactOf(lead, now).viaGuardian;
}

// O lead já tem este agendamento: mesmo tipo, mesmo dia e mesmo horário.
export function hasSameAppointment(lead, { type, at }) {
  const current = appointmentDetailOf(lead);
  return Boolean(current) && current.type === type && current.at === at.toISOString();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js && npx eslint api/_zapSchedule.js api/__tests__/zapSchedule.test.js`
Expected: `Tests  97 passed (97)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/_zapSchedule.js api/__tests__/zapSchedule.test.js
git commit -m "feat: leitura e conferências do pedido de agendamento pelo Stronizap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Regras do agendamento, parte 3: o que é gravado

**Files:**
- Modify: `src/lib/leads.js:153`
- Modify: `api/_zapSchedule.js`
- Test: `api/__tests__/zapSchedule.test.js`

Esta parte monta o que o `schedule` grava, espelhando o assistente: o texto da interação, o registro em aberto que o `aulasWrites.js` reaproveitaria, o registro novo ou o patch do registro reaproveitado, a interação do `logInteraction` com a origem (`via` e `zapChannelName`) e o `buildSchedulePatch` do lead. A origem ganha uma constante em `src/lib/leads.js`, ao lado do `ZAP_SIGNUP_TYPE`, porque a ficha também a lê.

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapSchedule.test.js`, trocar o import de `../_zapSchedule.js` por estes dois imports (o de `aulaRecordFields` é novo):

```js
import {
  SCHEDULE_LIMIT, LEAD_IDS_MAX, ZAP_SCHEDULE_MESSAGES, unitsView, scheduleCatalogView, suggestedDays, countsForMeta,
  wardRelationship, appointmentDetailOf, scheduleTargets, readScheduleOptionsBody, buildScheduleOptions,
  isDocId, readScheduleBody, readStatusBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  scheduleInteractionText, pickOpenVisitaId, isOpenAulaRecord, buildScheduleWrites, alreadyScheduledBody
} from '../_zapSchedule.js';
import { aulaRecordFields } from '../../src/lib/aulas.js';
```

E acrescentar no fim do arquivo:

```js
describe('scheduleInteractionText: o texto do assistente, no horário de Brasília', () => {
  const visita = { type: 'visita', unit: 'Centro', at: brt('2026-10-01T18:00'), note: 'Vem depois do trabalho.' };
  const aula = { type: 'aula_experimental', modality: 'Pilates', quantity: 1, professorId: 'p1', professorName: 'Carla Dias', at: brt('2026-10-02T19:00') };

  it('visita com unidade e anotação', () => {
    expect(scheduleInteractionText(visita)).toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.');
  });

  it('visita sem unidade e sem anotação', () => {
    expect(scheduleInteractionText({ ...visita, unit: null, note: null })).toBe('🔔 Visita agendada p/ 01/10/2026, 18:00.');
  });

  it('aula de uma aula, com professor', () => {
    expect(scheduleInteractionText(aula)).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00.');
  });

  it('aula de várias aulas', () => {
    expect(scheduleInteractionText({ ...aula, quantity: 2 })).toBe('🔔 Aula Experimental agendada (Pilates · 2 aulas) · Carla Dias p/ 02/10/2026, 19:00.');
  });

  it('aula de quem treina sozinho, com anotação', () => {
    expect(scheduleInteractionText({ ...aula, professorId: null, professorName: null, soloTraining: true, note: 'Traz tênis.' }))
      .toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Treina sozinho p/ 02/10/2026, 19:00. Obs: Traz tênis.');
  });

  it('anotação só com espaço não entra', () => {
    expect(scheduleInteractionText({ ...visita, note: '   ' })).toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00.');
  });

  it('com o processo em UTC, 23:30 de Brasília continua no mesmo dia', () => {
    expect(scheduleInteractionText({ ...visita, at: brt('2026-10-01T23:30'), note: null }))
      .toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 23:30.');
  });
});

describe('registro em aberto que o assistente reaproveita', () => {
  it('pickOpenVisitaId: a primeira visita agendada; aula (com ou sem type) e visita resolvida não contam', () => {
    const registros = [
      { id: 'a1', status: 'agendada' },
      { id: 'a2', type: 'aula', status: 'agendada' },
      { id: 'v1', type: 'visita', status: 'no_show' },
      { id: 'v2', type: 'visita', status: 'agendada' },
      { id: 'v3', type: 'visita', status: 'agendada' }
    ];
    expect(pickOpenVisitaId(registros)).toBe('v2');
    expect(pickOpenVisitaId(registros.slice(0, 3))).toBeNull();
    expect(pickOpenVisitaId(undefined)).toBeNull();
  });

  it('isOpenAulaRecord: só a aula ainda agendada', () => {
    expect(isOpenAulaRecord({ status: 'agendada' })).toBe(true);
    expect(isOpenAulaRecord({ status: 'attended' })).toBe(false);
    expect(isOpenAulaRecord(null)).toBe(false);
  });
});

describe('buildScheduleWrites: o que o assistente grava, numa gravação só', () => {
  const HORA = Object.freeze({ horaDoServidor: true });
  const MAIS_UM = Object.freeze({ incremento: 1 });
  // A Mariana antes do agendamento: lead da Ana, com uma aula antiga já resolvida.
  const LEAD = {
    id: 'L1', name: 'Mariana Lima', status: 'Primeiro contato', consultantId: 'u-ana', consultantName: 'Ana Souza',
    consultantAuthUid: 'auth-ana', currentAulaId: 'aula-velha', appointmentOutcome: 'no_show'
  };
  const VISITA = { leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false, quantity: null, note: 'Vem depois do trabalho.' };
  const AULA = { leadId: 'L1', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false, quantity: 2, note: null };
  const atVisita = brt('2026-10-01T18:00');
  const atAula = brt('2026-10-02T19:00');
  const gravar = (extra) => buildScheduleWrites({
    lead: LEAD, actor: ANA, professors: CATALOGOS.professors, channelName: 'Recepção', serverTime: HORA, increment: MAIS_UM, ...extra
  });

  it('visita nova: o registro, a interação e o patch do lead, valor por valor', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' });
    expect(record).toEqual({
      id: 'rec-novo',
      create: {
        ...aulaRecordFields({
          type: 'visita', leadId: 'L1', leadName: 'Mariana Lima', consultantId: 'u-ana', consultantAuthUid: 'auth-ana',
          consultantName: 'Ana Souza', status: 'agendada', unit: 'Centro', scheduledFor: atVisita
        }),
        createdAt: HORA
      }
    });
    expect(record.create).toMatchObject({ type: 'visita', unit: 'Centro', professorId: null, status: 'agendada', converted: false });
    expect(interaction).toEqual({
      leadId: 'L1',
      leadName: 'Mariana Lima',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      createdAt: HORA,
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
      type: 'note',
      volumeKind: 'visita',
      via: 'stronizap',
      zapChannelName: 'Recepção'
    });
    expect(leadPatch).toEqual({
      lastInteractionAt: HORA,
      interactionsCount: MAIS_UM,
      nextFollowUp: atVisita,
      nextFollowUpType: 'Visita',
      nextFollowUpNote: 'Vem depois do trabalho.',
      appointmentModality: null,
      appointmentProfessorId: null,
      appointmentProfessorName: null,
      appointmentSoloTraining: false,
      trialClassesPlanned: null,
      appointmentUnit: 'Centro',
      appointmentType: 'visita',
      appointmentScheduledFor: atVisita,
      appointmentOutcome: null,
      appointmentOutcomeAt: null,
      appointmentOutcomeBy: null,
      // A visita não mexe no ponteiro da aula, como no assistente.
      currentAulaId: 'aula-velha'
    });
  });

  it('visita remarcada: o registro em aberto só troca a unidade e a data', () => {
    const { record } = gravar({ schedule: VISITA, at: atVisita, openRecordId: 'visita-aberta', newRecordId: 'rec-novo' });
    expect(record).toEqual({ id: 'visita-aberta', update: { unit: 'Centro', scheduledFor: atVisita } });
  });

  it('aula nova: o registro leva o professor e o lead passa a apontar para ele', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: AULA, at: atAula, newRecordId: 'rec-novo' });
    expect(record.create).toMatchObject({
      type: 'aula', unit: null, professorId: 'p1', professorName: 'Carla Dias', soloTraining: false, modality: 'Pilates',
      scheduledFor: atAula, status: 'agendada'
    });
    expect(interaction).toMatchObject({
      text: '🔔 Aula Experimental agendada (Pilates · 2 aulas) · Carla Dias p/ 02/10/2026, 19:00.',
      volumeKind: 'aula_experimental'
    });
    expect(leadPatch).toMatchObject({
      nextFollowUpType: 'Aula Experimental', nextFollowUpNote: null, appointmentType: 'aula_experimental',
      appointmentModality: 'Pilates', appointmentProfessorId: 'p1', appointmentProfessorName: 'Carla Dias',
      appointmentSoloTraining: false, trialClassesPlanned: 2, appointmentUnit: null, currentAulaId: 'rec-novo'
    });
  });

  it('aula no registro ainda agendada: atualiza professor, modalidade e data, e o ponteiro continua', () => {
    const { record, leadPatch } = gravar({ schedule: AULA, at: atAula, openRecordId: 'aula-aberta', newRecordId: 'rec-novo' });
    expect(record).toEqual({
      id: 'aula-aberta',
      update: { professorId: 'p1', professorName: 'Carla Dias', soloTraining: false, modality: 'Pilates', scheduledFor: atAula }
    });
    expect(leadPatch.currentAulaId).toBe('aula-aberta');
  });

  it('quem treina sozinho: sem professor no registro, no lead e no texto', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: { ...AULA, professorId: null, soloTraining: true, quantity: 1 }, at: atAula, newRecordId: 'rec-novo' });
    expect(record.create).toMatchObject({ professorId: null, professorName: null, soloTraining: true });
    expect(leadPatch).toMatchObject({ appointmentProfessorId: null, appointmentProfessorName: null, appointmentSoloTraining: true });
    expect(interaction.text).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Treina sozinho p/ 02/10/2026, 19:00.');
  });

  it('o gestor agenda no lead da Ana: ele é o autor, e a Ana continua dona', () => {
    const { interaction } = gravar({ actor: JOHNNY, schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' });
    expect(interaction).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny',
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana'
    });
  });

  it('sem canal, zapChannelName vai null; agendar não muda a etapa; nada vai como undefined', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo', channelName: null });
    expect(interaction.zapChannelName).toBeNull();
    expect('status' in leadPatch).toBe(false);
    for (const gravado of [record.create, interaction, leadPatch]) expect(Object.values(gravado)).not.toContain(undefined);
  });
});

describe('alreadyScheduledBody: a resposta do ja_agendado', () => {
  it('leva o cartão, o agendamento que já existia e o texto', () => {
    expect(alreadyScheduledBody({ card: { found: true }, appointment: { leadId: 'L1' } })).toEqual({
      error: 'ja_agendado', message: 'Esse agendamento já estava no Stronilead.', card: { found: true }, appointment: { leadId: 'L1' }
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js`
Expected: FAIL, `17 failed | 97 passed`, com `TypeError: scheduleInteractionText is not a function` e o mesmo para `pickOpenVisitaId`, `isOpenAulaRecord`, `buildScheduleWrites` e `alreadyScheduledBody`.

- [ ] **Step 3: A origem em `src/lib/leads.js`**

Trocar a linha 153:

```js
export const ZAP_SIGNUP_TYPE = 'zap_signup';
```

por:

```js
export const ZAP_SIGNUP_TYPE = 'zap_signup';

// Origem de uma interação gravada pelo Stronizap (api/zap.js, ação schedule):
// o campo `via` da interação. A ficha desenha a marca do Stronizap ao lado de
// quem agendou.
export const ZAP_VIA = 'stronizap';
```

- [ ] **Step 4: Implementar em `api/_zapSchedule.js`**

Trocar o bloco de imports do topo por:

```js
import { ZAP_LEAD_MESSAGES, refusal, invalidData, nationalDigits, emailFromActor, teamRole } from './_zapLead.js';
import { zapMatchKey } from './_zapPhone.js';
import { appointmentOutcomeOf } from './_zapCard.js';
import {
  diaDeBrasilia, horaInteiraDeBrasilia, diaDaSemanaDoDia, isoDoDia, dataHoraDeBrasilia, instanteDeBrasilia
} from './_horarioDeBrasilia.js';
import { getLeadAppointmentType, getLeadAppointmentDate, getInteractionSecurityFields, ZAP_VIA } from '../src/lib/leads.js';
import { normalizeAppointmentType } from '../src/lib/dates.js';
import { normalizeTrialClassOptions, normalizeMetaWeekdays } from '../src/lib/leadStatus.js';
import { professorsForModality, professorNameById, SOLO_TRAINING_LABEL } from '../src/lib/professores.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields, isAulaRecord } from '../src/lib/aulas.js';
import { buildSchedulePatch } from '../src/lib/schedulePatch.js';
import { contactOf } from '../src/lib/guardian.js';
```

E acrescentar no fim do arquivo:

```js
// ---------------------------------------------------------------------------
// O que é gravado e o que é respondido (schedule)
// ---------------------------------------------------------------------------

// Rótulo do tipo, igual ao followUpLabel do ScheduleWizard: é o que vai no
// texto da interação e em nextFollowUpType.
const TYPE_LABEL = Object.freeze({ visita: 'Visita', aula_experimental: 'Aula Experimental' });

// O texto da interação, no formato do assistente (handleWizardConfirm), que a
// linha do tempo lê com parseAppointment:
//   "🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: …"
//   "🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00."
// O navegador escreve o dia e a hora no fuso da academia; aqui eles saem no
// horário de Brasília, porque a Vercel roda em UTC.
export function scheduleInteractionText({
  type, unit = null, modality = null, quantity = null, professorId = null, professorName = null,
  soloTraining = false, at, note = null
}) {
  let extra = '';
  if (type === 'aula_experimental') {
    const q = quantity || 1;
    extra = ` (${modality ? `${modality} · ` : ''}${q} ${q === 1 ? 'aula' : 'aulas'})`;
    if (professorId) extra += ` · ${professorName}`;
    else if (soloTraining) extra += ` · ${SOLO_TRAINING_LABEL}`;
  } else if (unit) {
    extra = ` (Unidade ${unit})`;
  }
  const obs = (note || '').trim();
  return `🔔 ${TYPE_LABEL[type]} agendada${extra} p/ ${dataHoraDeBrasilia(at)}.` + (obs ? ` Obs: ${obs}` : '');
}

// A visita em aberto do lead, como o findOpenVisitaId do aulasWrites.js: a
// primeira visita 'agendada' entre os registros dele.
export function pickOpenVisitaId(records) {
  const open = (records || []).find((r) => !isAulaRecord(r) && r.status === AULA_STATUS.AGENDADA);
  return open ? open.id : null;
}

// A aula do currentAulaId só é reaproveitada se ainda estiver 'agendada',
// como no findOpenAulaId do aulasWrites.js.
export const isOpenAulaRecord = (record) => Boolean(record) && record.status === AULA_STATUS.AGENDADA;

// O que a ação schedule grava numa transação só, o mesmo que o assistente
// grava em três passos:
//   - record: o registro em stronix_aulas. Com `openRecordId` (a aula do
//     currentAulaId ainda agendada, ou a visita em aberto do lead), só a data
//     e os campos do tipo mudam; sem ele, nasce um registro com o id
//     `newRecordId`, com os campos de consultor do dono do lead;
//   - interaction: a nota que a linha do tempo mostra como agendamento, com o
//     volumeKind da Meta Diária, quem agendou em consultantName, actorId e
//     actorAuthUid, e a origem (via e zapChannelName);
//   - leadPatch: o buildSchedulePatch do assistente, mais lastInteractionAt e
//     interactionsCount, como o logInteraction.
// `professors` são os documentos de stronix_professores, de onde sai o nome.
// `serverTime` e `increment` são os FieldValue do firebase-admin.
export function buildScheduleWrites({
  lead, actor, schedule, at, professors = [], channelName = null, openRecordId = null, newRecordId = null,
  serverTime, increment
}) {
  const isAula = schedule.type === 'aula_experimental';
  const professorName = isAula && schedule.professorId ? professorNameById(professors, schedule.professorId) : null;
  const recordPatch = isAula
    ? {
        professorId: schedule.professorId || null,
        professorName: professorName || null,
        soloTraining: Boolean(schedule.soloTraining),
        modality: schedule.modality || null,
        scheduledFor: at
      }
    : { unit: schedule.unit || null, scheduledFor: at };
  const recordId = openRecordId || newRecordId;
  const record = openRecordId
    ? { id: openRecordId, update: recordPatch }
    : {
        id: newRecordId,
        create: {
          ...aulaRecordFields({
            type: isAula ? APPOINTMENT_RECORD_TYPES.AULA : APPOINTMENT_RECORD_TYPES.VISITA,
            leadId: lead.id,
            leadName: lead.name || lead.nome || null,
            consultantId: lead.consultantId || null,
            consultantAuthUid: lead.consultantAuthUid || null,
            consultantName: lead.consultantName || null,
            status: AULA_STATUS.AGENDADA,
            ...recordPatch
          }),
          createdAt: serverTime
        }
      };
  const interaction = {
    leadId: lead.id,
    leadName: lead.name || null,
    consultantName: actor.name || null,
    ...getInteractionSecurityFields(lead, actor),
    actorId: actor.id || null,
    actorAuthUid: actor.authUid || null,
    createdAt: serverTime,
    text: scheduleInteractionText({ ...schedule, professorName, at }),
    type: 'note',
    volumeKind: schedule.type,
    via: ZAP_VIA,
    zapChannelName: channelName || null
  };
  const leadPatch = {
    lastInteractionAt: serverTime,
    interactionsCount: increment,
    ...buildSchedulePatch({
      typeLabel: TYPE_LABEL[schedule.type],
      date: at,
      modalidade: schedule.modality,
      professorId: schedule.professorId,
      professorName,
      soloTraining: schedule.soloTraining,
      quantidade: schedule.quantity,
      unidade: schedule.unit,
      note: schedule.note,
      currentAulaId: isAula ? recordId : (lead.currentAulaId || null)
    })
  };
  return { record, interaction, leadPatch };
}

// Resposta 409: o cartão do número e o agendamento que já existia. O
// Stronizap trata como sucesso, porque a gravação é a mesma.
export function alreadyScheduledBody({ card, appointment }) {
  return { error: 'ja_agendado', message: ZAP_SCHEDULE_MESSAGES.alreadyScheduled, card, appointment };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js && npx eslint api/_zapSchedule.js api/__tests__/zapSchedule.test.js src/lib/leads.js`
Expected: `Tests  114 passed (114)` e lint sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leads.js api/_zapSchedule.js api/__tests__/zapSchedule.test.js
git commit -m "feat: o agendamento pelo Stronizap grava o mesmo que o assistente da ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: A linha do tempo e a Meta Diária leem o agendamento da ponte

**Files:**
- Test: `src/lib/__tests__/zapScheduleTimeline.test.js` (novo)
- Modify: `src/lib/__tests__/newLeadImports.test.js:51-56`

Duas travas, sem código novo de produção. A primeira passa o que a ponte grava pelas regras que leem o agendamento: `parseAppointment` e `classifyInteraction` (linha do tempo), `hasActiveInteractionToday` ("Já interagido hoje"), `computeDailyVolume` (o ponto de volume de quem agendou) e `computeDailyGoalSlots` (a tarefa do dono no dia e a saída dos Atrasados). A segunda segue os imports de `api/_zapSchedule.js` e trava que nenhum chegue a pacote ou a módulo do navegador. As duas passam de primeira, porque a Task 5 já fez o código; o Step 3 sabota de propósito para provar que elas enxergam o defeito.

- [ ] **Step 1: A trava da linha do tempo e da Meta**

Criar `src/lib/__tests__/zapScheduleTimeline.test.js`:

```js
// O agendamento feito pelo Stronizap precisa ser lido pelo Stronilead como um
// agendamento do assistente da ficha. Este teste pega o que a ponte grava
// (buildScheduleWrites, em api/_zapSchedule.js) e passa pelas regras que leem
// o agendamento: a linha do tempo (parseAppointment, classifyInteraction), o
// "Já interagido hoje" (hasActiveInteractionToday) e a Meta Diária (volume de
// quem agendou e tarefa do dono no dia). Se uma delas deixar de reconhecer o
// registro, a ficha ou a Meta mudam sem ninguém perceber.
//
// As datas do app são locais; o texto que a ponte grava sai no horário de
// Brasília. Os horários daqui ficam longe da meia-noite, então o teste vale no
// fuso da máquina e no UTC do CI.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildScheduleWrites } from '../../../api/_zapSchedule.js';
import { parseAppointment, classifyInteraction, timelineTypeLabel } from '../timeline.js';
import { hasActiveInteractionToday, ZAP_VIA } from '../leads.js';
import { computeDailyVolume, computeDailyGoalSlots, buildInteractionsByLead } from '../dailyGoal.js';

// 01/10/2026 às 18:00 e 02/10/2026 às 19:00 de Brasília.
const VISITA_EM = new Date('2026-10-01T21:00:00.000Z');
const AULA_EM = new Date('2026-10-02T22:00:00.000Z');

const ANA = { id: 'u-ana', name: 'Ana Souza', authUid: 'auth-ana', role: 'consultant' };
const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', authUid: 'auth-bruno', role: 'consultant' };
// Lead do Bruno, atrasado desde ontem.
const lead = () => ({
  id: 'L1', name: 'Mariana Lima', status: 'Primeiro contato', lifecycleStage: 'lead',
  consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno',
  createdAt: new Date(2026, 8, 1, 10, 0), nextFollowUp: new Date(2026, 8, 30, 10, 0), nextFollowUpType: 'Ligação'
});
const PROFESSORES = [{ id: 'p1', nome: 'Carla Dias', modalidadeIds: ['m2'] }];

// O que a ponte grava quando a Ana agenda, com as datas como o Firestore
// devolve: a hora do servidor vira agora.
function agendar(schedule, at) {
  const { interaction, leadPatch } = buildScheduleWrites({
    lead: lead(), actor: ANA, schedule, at, professors: PROFESSORES, channelName: 'Recepção',
    newRecordId: 'rec-1', serverTime: 'HORA', increment: 'MAIS_UM'
  });
  const agora = new Date();
  const gravada = { id: 'i1', ...interaction, createdAt: agora };
  const patch = { ...leadPatch, lastInteractionAt: agora, interactionsCount: 1 };
  return { interaction: gravada, lead: { ...lead(), ...patch } };
}

const VISITA = { type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false, quantity: null, note: 'Vem depois do trabalho.' };
const AULA = { type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false, quantity: 1, note: null };

describe('o agendamento da ponte na linha do tempo', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 10, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  it('visita: parseAppointment lê tipo, dia, hora, unidade e anotação', () => {
    const { interaction } = agendar(VISITA, VISITA_EM);
    expect(parseAppointment(interaction)).toEqual({
      kind: 'visit', label: 'Visita à unidade', when: new Date(2026, 9, 1, 18, 0),
      location: 'Unidade Centro', note: 'Vem depois do trabalho.'
    });
  });

  it('aula: parseAppointment lê tipo, dia e hora, sem inventar local', () => {
    const { interaction } = agendar(AULA, AULA_EM);
    expect(parseAppointment(interaction)).toEqual({
      kind: 'class', label: 'Aula experimental', when: new Date(2026, 9, 2, 19, 0), location: null, note: null
    });
  });

  it('entra no filtro Agendamentos, com a coluna Agenda ou Aula, e leva a origem', () => {
    const visita = agendar(VISITA, VISITA_EM).interaction;
    const aula = agendar(AULA, AULA_EM).interaction;
    expect(classifyInteraction(visita)).toBe('appointment');
    expect(timelineTypeLabel({ ...visita, _kind: 'appointment' })).toBe('Agenda');
    expect(timelineTypeLabel({ ...aula, _kind: 'appointment' })).toBe('Aula');
    expect(visita).toMatchObject({ type: 'note', via: ZAP_VIA, zapChannelName: 'Recepção' });
  });
});

describe('o agendamento da ponte na Meta Diária', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 10, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  const hoje = () => new Date(2026, 9, 1);

  it('acende o "Já interagido hoje"', () => {
    const { interaction, lead: agendado } = agendar(VISITA, VISITA_EM);
    expect(hasActiveInteractionToday(agendado, [interaction], hoje())).toBe(true);
  });

  it('o ponto de volume vai para quem agendou, não para o dono do lead', () => {
    const { interaction, lead: agendado } = agendar(VISITA, VISITA_EM);
    expect(interaction.volumeKind).toBe('visita');
    expect(computeDailyVolume([agendado], [interaction], ANA.id, ANA.authUid).agendamentos).toBe(1);
    expect(computeDailyVolume([agendado], [interaction], BRUNO.id, BRUNO.authUid).agendamentos).toBe(0);
  });

  it('no dia, a visita vira tarefa do dono do lead e ele sai dos Atrasados', () => {
    const antes = computeDailyGoalSlots([lead()], new Map(), BRUNO.id);
    expect(antes.map((l) => l.categorySlugs)).toEqual([['atrasado']]);
    const { interaction, lead: agendado } = agendar(VISITA, VISITA_EM);
    const depois = computeDailyGoalSlots([agendado], buildInteractionsByLead([interaction]), BRUNO.id);
    expect(depois.map((l) => l.categorySlugs)).toEqual([['visita_hoje']]);
    expect(depois[0].hasOtherActivityToday).toBe(true);
    expect(computeDailyGoalSlots([agendado], buildInteractionsByLead([interaction]), ANA.id)).toEqual([]);
  });

  it('no dia da aula, ela vira tarefa de Aulas exp. do dono', () => {
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
    const { interaction, lead: agendado } = agendar(AULA, AULA_EM);
    const slots = computeDailyGoalSlots([agendado], buildInteractionsByLead([interaction]), BRUNO.id);
    expect(slots.map((l) => l.categorySlugs)).toEqual([['aula_hoje']]);
  });
});
```

- [ ] **Step 2: A trava dos imports**

Em `src/lib/__tests__/newLeadImports.test.js`, logo depois do teste `'as regras do cadastro pelo Stronizap (api/_zapLead.js) também não'` (que termina na linha 56), acrescentar, antes do `});` que fecha o `describe`:

```js
  // O agendamento pelo Stronizap usa o patch do assistente, os helpers do
  // registro de aulas e dos professores, e nenhum deles pode puxar o SDK do
  // navegador (aulasWrites.js e interactions.js puxam) nem a Meta Diária.
  it('as regras do agendamento pelo Stronizap (api/_zapSchedule.js) também não', () => {
    const { arquivos, pacotes } = grafoDe(doRepo('api/_zapSchedule.js'));
    expect(arquivos).toEqual(expect.arrayContaining([
      'src/lib/schedulePatch.js', 'src/lib/aulas.js', 'src/lib/professores.js', 'api/_zapCard.js'
    ]));
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx'))).toEqual([]);
    expect(arquivos).not.toContain('src/lib/aulasWrites.js');
    expect(arquivos).not.toContain('src/lib/interactions.js');
  });
```

- [ ] **Step 3: Rodar, e provar que as travas enxergam o defeito**

Run: `npx vitest run src/lib/__tests__/zapScheduleTimeline.test.js src/lib/__tests__/newLeadImports.test.js`
Expected: `Tests  10 passed (10)` (7 da linha do tempo e da Meta, 3 dos imports).

Sabotagem 1: em `api/_zapSchedule.js`, apague a linha `    volumeKind: schedule.type,` do `buildScheduleWrites` e rode `npx vitest run src/lib/__tests__/zapScheduleTimeline.test.js`.
Expected: FAIL em "o ponto de volume vai para quem agendou, não para o dono do lead". Desfaça a sabotagem.

Sabotagem 2: acrescente `import '../src/lib/dailyGoal.js';` na primeira linha de `api/_zapSchedule.js` e rode `npx vitest run src/lib/__tests__/newLeadImports.test.js`.
Expected: FAIL em "as regras do agendamento pelo Stronizap (api/_zapSchedule.js) também não", com `expected [ 'lucide-react' ] to deeply equal []`. Desfaça a sabotagem.

- [ ] **Step 4: Rodar de novo, lint e commit**

Run: `npx vitest run src/lib/__tests__/zapScheduleTimeline.test.js src/lib/__tests__/newLeadImports.test.js api/__tests__/zapSchedule.test.js && npx eslint src/lib/__tests__/zapScheduleTimeline.test.js src/lib/__tests__/newLeadImports.test.js api/_zapSchedule.js`
Expected: `Tests  124 passed (124)` e lint sem erro. `git diff api/_zapSchedule.js` vazio: as sabotagens foram desfeitas.

```bash
git add src/lib/__tests__/zapScheduleTimeline.test.js src/lib/__tests__/newLeadImports.test.js
git commit -m "test: a linha do tempo e a Meta Diária leem o agendamento feito pelo Stronizap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Banco falso da rota: registro de aulas, unidades, professores, leitura por id e increment

**Files:**
- Modify: `api/__tests__/zapRoute.test.js:27-37`, `:46-55`, `:61-62`, `:85-89`, `:102`, `:183`, `:267-274`, `:284-285`

Só a infraestrutura de teste: os 102 testes que existem continuam verdes. O banco falso passa a guardar `stronix_aulas` por academia, a servir unidades e professores como catálogo, a ler documento de lista pelo id (lead e registro de aulas, com o `id` no snapshot, como o SDK de servidor), a somar o `FieldValue.increment` e a simular a leitura por id recusada (`falhaEm: 'documento'`). Os catálogos da academia ganham duas unidades (a Zona Sul sem endereço) e três professores (a Paula desligada).

- [ ] **Step 1: O comentário e o banco**

Trocar:

```js
// leitura depois de escrita dentro da transação, create de documento que já
// existe e update de documento que não existe. O `select` devolve só os
// campos pedidos. Um fake mais tolerante que produção deixa passar
// exatamente o erro que importa. E tudo fica guardado por academia, para dar
// para provar que a chave de uma não lê a outra.
const banco = vi.hoisted(() => ({
  tenants: {}, leads: {}, config: {}, users: {}, catalogos: {}, interacoes: {},
  gravacoes: [], falhaEm: null, ultimoId: 0
}));
```

por:

```js
// leitura depois de escrita dentro da transação, create de documento que já
// existe e update de documento que não existe. O `select` devolve só os
// campos pedidos, e o increment soma no valor gravado. Um fake mais tolerante
// que produção deixa passar exatamente o erro que importa. E tudo fica
// guardado por academia, para dar para provar que a chave de uma não lê a
// outra.
const banco = vi.hoisted(() => ({
  tenants: {}, leads: {}, config: {}, users: {}, catalogos: {}, interacoes: {}, aulas: {},
  gravacoes: [], falhaEm: null, ultimoId: 0
}));
```

- [ ] **Step 2: Hora do servidor, increment e snapshot com id**

Trocar:

```js
  // Hora do servidor. Na gravação vira um Timestamp falso, com toDate(), como
  // o documento volta do Firestore depois do commit.
  const HORA_DO_SERVIDOR = Object.freeze({ horaDoServidor: true });
  const gravado = (dados) => {
    const instante = new Date();
    return Object.fromEntries(Object.entries(dados).map(([k, v]) =>
      [k, v === HORA_DO_SERVIDOR ? { toDate: () => instante } : v]));
  };

  const snapshot = (dados) => ({ exists: dados != null, data: () => dados ?? undefined });
```

por:

```js
  // Hora do servidor. Na gravação vira um Timestamp falso, com toDate(), como
  // o documento volta do Firestore depois do commit. O increment soma no valor
  // que o documento já tinha (campo ausente conta como zero).
  const HORA_DO_SERVIDOR = Object.freeze({ horaDoServidor: true });
  const incremento = (n) => Object.freeze({ incremento: n });
  const gravado = (dados, anterior = {}) => {
    const instante = new Date();
    return Object.fromEntries(Object.entries(dados).map(([k, v]) => {
      if (v === HORA_DO_SERVIDOR) return [k, { toDate: () => instante }];
      if (v && typeof v === 'object' && 'incremento' in v) return [k, (Number(anterior[k]) || 0) + v.incremento];
      return [k, v];
    }));
  };

  const snapshot = (id, dados) => ({ id, exists: dados != null, data: () => dados ?? undefined });
```

- [ ] **Step 3: As listas e os catálogos novos**

Trocar:

```js
  const LISTAS = { stronix_leads: 'leads', stronix_users: 'users', stronix_interactions: 'interacoes' };
  const CATALOGOS = ['stronix_sources', 'stronix_dores', 'stronix_modalities', 'stronix_funnels', 'stronix_statuses'];
```

por:

```js
  const LISTAS = {
    stronix_leads: 'leads', stronix_users: 'users', stronix_interactions: 'interacoes', stronix_aulas: 'aulas'
  };
  const CATALOGOS = [
    'stronix_sources', 'stronix_dores', 'stronix_modalities', 'stronix_funnels', 'stronix_statuses',
    'stronix_units', 'stronix_professores'
  ];
```

- [ ] **Step 4: Documento de lista pelo id**

Trocar:

```js
  const documento = (caminho) => {
    if (caminho[0] === 'tenants') return snapshot(banco.tenants[caminho[1]]);
    if (caminho.at(-2) === 'stronix_config') return snapshot(banco.config[caminho[1]]);
    throw new Error(`caminho sem fixture no teste: ${caminho.join('/')}`);
  };
```

por:

```js
  const documento = (caminho) => {
    if (caminho[0] === 'tenants') return snapshot(caminho[1], banco.tenants[caminho[1]]);
    if (caminho.at(-2) === 'stronix_config') return snapshot(caminho.at(-1), banco.config[caminho[1]]);
    // Um documento de lista (lead, registro de aulas...) pelo id. `falhaEm:
    // 'documento'` simula a leitura recusada (Firestore fora do ar, por
    // exemplo), com o caminho dentro da mensagem, como o SDK faz.
    if (caminho[0] === 'artifacts' && caminho.length === 6 && LISTAS[caminho[4]]) {
      if (banco.falhaEm === 'documento') {
        throw Object.assign(new Error(`14 UNAVAILABLE: leitura de ${caminho.join('/')} falhou`), { code: 14 });
      }
      const linha = listaDe(caminho.slice(0, 5)).find((l) => l.id === caminho[5]);
      if (!linha) return snapshot(caminho[5], null);
      const { id, ...dados } = linha;
      return snapshot(id, dados);
    }
    throw new Error(`caminho sem fixture no teste: ${caminho.join('/')}`);
  };
```

- [ ] **Step 5: O update soma o increment**

Trocar:

```js
    if (tipo === 'update') lista[i] = { ...lista[i], ...gravado(dados) };
```

por:

```js
    if (tipo === 'update') lista[i] = { ...lista[i], ...gravado(dados, lista[i]) };
```

- [ ] **Step 6: O `FieldValue.increment` do SDK**

Trocar:

```js
    admin: { firestore: { FieldValue: { serverTimestamp: () => HORA_DO_SERVIDOR } } },
```

por:

```js
    admin: { firestore: { FieldValue: { serverTimestamp: () => HORA_DO_SERVIDOR, increment: incremento } } },
```

- [ ] **Step 7: Unidades e professores da academia**

No fim de `catalogosDaAcademia`, trocar:

```js
  stronix_statuses: [
    { id: 'st2', funnelId: 'f-com', name: 'Primeiro contato', order: 2 },
    { id: 'st1', funnelId: 'f-com', name: 'Novo lead', order: 1 },
    { id: 'st3', funnelId: 'f-kids', name: 'Interesse', order: 1 },
    { id: 'st4', funnelId: 'f-ind', name: 'Aguardando ação', order: 1, isEntry: true },
    { id: 'st5', funnelId: 'f-venc', name: 'Aguardando contato', order: 1 }
  ]
});
```

por:

```js
  stronix_statuses: [
    { id: 'st2', funnelId: 'f-com', name: 'Primeiro contato', order: 2 },
    { id: 'st1', funnelId: 'f-com', name: 'Novo lead', order: 1 },
    { id: 'st3', funnelId: 'f-kids', name: 'Interesse', order: 1 },
    { id: 'st4', funnelId: 'f-ind', name: 'Aguardando ação', order: 1, isEntry: true },
    { id: 'st5', funnelId: 'f-venc', name: 'Aguardando contato', order: 1 }
  ],
  // Do agendamento: a Zona Sul sem endereço e a Paula desligada.
  stronix_units: [
    { id: 'un2', name: 'Zona Sul', address: '', order: 2 },
    { id: 'un1', name: 'Centro', address: 'Rua Garibaldi, 1200', order: 1 }
  ],
  stronix_professores: [
    { id: 'p1', nome: 'Carla Dias', modalidadeIds: ['m2'], order: 1 },
    { id: 'p2', nome: 'Rafael Moura', modalidadeIds: ['m2', 'm1'], order: 2 },
    { id: 'p3', nome: 'Paula Reis', modalidadeIds: ['m2'], ativo: false, order: 3 }
  ]
});
```

- [ ] **Step 8: `zerarBanco` limpa o registro de aulas**

Trocar:

```js
  banco.interacoes = {};
  banco.gravacoes = [];
```

por:

```js
  banco.interacoes = {};
  banco.aulas = {};
  banco.gravacoes = [];
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/__tests__/zapRoute.test.js`
Expected: `Tests  102 passed (102)` e lint sem erro.

- [ ] **Step 10: Commit**

```bash
git add api/__tests__/zapRoute.test.js
git commit -m "test: banco falso da rota do Zap com registro de aulas, leitura por id e increment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rota: os cadastros do número num lugar só (`numberPeople`)

**Files:**
- Modify: `api/zap.js:98-125`

Refatoração sem mudança de comportamento. O `cardFor` busca o dono do número e os menores que o têm como responsável, e o `schedule-options` precisa exatamente dessa seleção para o "Para quem?". A busca sai para `numberPeople`, e o `cardFor` passa a chamá-la.

- [ ] **Step 1: Separar `numberPeople` do `cardFor`**

Trocar:

```js
// O cartão que o GET devolve para esta chave de telefone: o dono do número e
// os menores que o têm como responsável, ou { found: false } quando ninguém
// casa. O cadastro pelo Stronizap responde com este mesmo cartão.
async function cardFor(tenantId, matchKey) {
  // O dono do número e os menores que o têm como responsável, juntos. A busca
  // dos menores não pode derrubar o cartão do dono: se ela falhar (índice
  // desligado no console, por exemplo), o cartão sai sem os menores. O log
  // leva só o código do erro: a mensagem do Firestore pode trazer o valor da
  // consulta, que é o telefone.
  const [achados, menoresSnap] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get(),
    leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(WARDS_MAX).get()
      .catch((e) => {
        console.error('zap: busca dos menores falhou', e?.code ?? 'sem código');
        return null;
      })
  ]);
  const menoresDocs = menoresSnap ? menoresSnap.docs : [];

  const agora = new Date();
  const dono = achados.empty ? null : leadDoDoc(achados.docs[0]);
  // Só quem ainda tem o responsável como contato (menor, ou que fez 18 sem
  // WhatsApp próprio), e nunca o próprio dono do número.
  const menores = menoresDocs
    .map(leadDoDoc)
    .filter((m) => m.id !== dono?.id && contactOf(m, agora).viaGuardian);

  if (!dono && menores.length === 0) return { found: false };
```

por:

```js
// O dono do número e os menores que o têm como responsável, juntos: a mesma
// seleção serve o cartão e o "Para quem?" do agendamento pelo Stronizap. A
// busca dos menores não pode derrubar o dono: se ela falhar (índice desligado
// no console, por exemplo), sai só o dono. O log leva só o código do erro: a
// mensagem do Firestore pode trazer o valor da consulta, que é o telefone.
async function numberPeople(tenantId, matchKey, agora) {
  const [achados, menoresSnap] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get(),
    leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(WARDS_MAX).get()
      .catch((e) => {
        console.error('zap: busca dos menores falhou', e?.code ?? 'sem código');
        return null;
      })
  ]);
  const menoresDocs = menoresSnap ? menoresSnap.docs : [];
  const dono = achados.empty ? null : leadDoDoc(achados.docs[0]);
  // Só quem ainda tem o responsável como contato (menor, ou que fez 18 sem
  // WhatsApp próprio), e nunca o próprio dono do número.
  const menores = menoresDocs
    .map(leadDoDoc)
    .filter((m) => m.id !== dono?.id && contactOf(m, agora).viaGuardian);
  return { dono, menores };
}

// O cartão que o GET devolve para esta chave de telefone: o dono do número e
// os menores que o têm como responsável, ou { found: false } quando ninguém
// casa. O cadastro e o agendamento pelo Stronizap respondem com este mesmo
// cartão.
async function cardFor(tenantId, matchKey) {
  const agora = new Date();
  const { dono, menores } = await numberPeople(tenantId, matchKey, agora);
  if (!dono && menores.length === 0) return { found: false };
```

O resto do `cardFor` (os marcos de renovação e a montagem do cartão) não muda.

- [ ] **Step 2: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/zap.js`
Expected: `Tests  102 passed (102)` e lint sem erro.

- [ ] **Step 3: Commit**

```bash
git add api/zap.js
git commit -m "refactor: cadastros do número do cartão do Zap num lugar só

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Ação `schedule-options`

**Files:**
- Modify: `api/zap.js:28-29`, `:39`, `:198`, fim do arquivo
- Test: `api/__tests__/zapRoute.test.js`

As opções do balão: quem pede, os cadastros do número (pelo `numberPeople` da Task 8), as listas lidas a cada pedido e os dias sugeridos. Só lê. A partir daqui, os testes da rota fixam o relógio em terça, 29/09/2026, às 15:40 de Brasília (`AGORA`), como nos mockups.

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapRoute.test.js`, acrescentar no fim do arquivo:

```js
// ---------------------------------------------------------------------------
// Agendamento pelo Stronizap
// ---------------------------------------------------------------------------

// Terça, 29/09/2026, às 15:40 de Brasília, como nos mockups.
const AGORA = new Date('2026-09-29T18:40:00.000Z');
// A Mariana, lead da Ana com o número da conversa. Os campos de data vêm como
// Timestamp, como o Firestore devolve.
const marianaLead = (extra = {}) => ({
  id: 'L1', name: 'Mariana Souza', lifecycleStage: 'lead', status: 'Primeiro contato', source: 'Instagram',
  consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
  whatsapp: '(51) 9 9812-4471', zapMatchKey: zapMatchKey(MARIANA), interactionsCount: 3,
  createdAt: ts(new Date('2026-09-01T13:00:00.000Z')), ...extra
});

const pedidoOpcoesAgenda = ({ phone = MARIANA, email = ANA.email } = {}) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: { action: 'schedule-options', tenant: TENANT, phone, actor: { email } }
});

describe('POST /api/zap com action schedule-options', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consultora em dia de meta: quem ela é, os cadastros do número, as listas e os dias', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), appointmentUnit: 'Centro'
    })];
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
      targets: [
        { leadId: 'L1', name: 'Mariana Souza', relationship: null, appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null } }
      ],
      units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }, { name: 'Zona Sul', address: null }],
      modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
      professors: [
        { id: 'p1', name: 'Carla Dias', modalityIds: ['m2'] },
        { id: 'p2', name: 'Rafael Moura', modalityIds: ['m2', 'm1'] }
      ],
      trialClassOptions: [1, 2, 3],
      days: [
        { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
        { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
        { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
        { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
        { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' }
      ]
    });
    // Opções só leem: não gastam o limite nem gravam nada.
    expect(limitador.chamadas).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('gestor: papel gestor e fora da Meta', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ email: JOHNNY.email }), res);

    expect(res.body.actor).toEqual({ id: 'u-johnny', name: 'Johnny', role: 'gestor', countsForMeta: false });
  });

  it('a quantidade de aulas e os dias da meta são os da academia', async () => {
    banco.config[TENANT] = { trialClassOptions: [1, 2], metaWeekdays: [1, 2, 3, 4, 5, 6] };
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.body.trialClassOptions).toEqual([1, 2]);
    expect(res.body.days.map((d) => d.label)).toEqual(['Hoje', 'Amanhã', 'Quinta', 'Sexta', 'Sábado']);
  });

  it('depois das 18h de Brasília, os dias começam amanhã', async () => {
    vi.setSystemTime(new Date('2026-09-29T21:30:00.000Z'));
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.body.days[0]).toEqual({ date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' });
  });

  it('mãe sem cadastro próprio: os filhos em ordem de nome, com o parentesco e o agendamento de cada um', async () => {
    banco.leads[TENANT] = [
      menorDe('k1', 'Pedro Souza', {
        sexo: 'Masculino', appointmentType: 'aula_experimental',
        appointmentScheduledFor: ts(new Date('2026-10-02T22:00:00.000Z')), appointmentModality: 'Pilates'
      }),
      menorDe('k2', 'Ana Souza', { sexo: 'Feminino' }),
      menorDe('k3', 'Caio Souza')
    ];
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ phone: MAE }), res);

    expect(res.body.targets).toEqual([
      { leadId: 'k2', name: 'Ana Souza', relationship: 'Filha', appointment: null },
      { leadId: 'k3', name: 'Caio Souza', relationship: null, appointment: null },
      { leadId: 'k1', name: 'Pedro Souza', relationship: 'Filho', appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null } }
    ]);
  });

  it('dona do número que também é responsável: ela primeiro, depois o filho', async () => {
    banco.leads[TENANT] = [marianaLead({ zapMatchKey: zapMatchKey(MAE) }), menorDe('k1', 'Pedro Souza', { sexo: 'Masculino' })];
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ phone: MAE }), res);

    expect(res.body.targets.map((t) => [t.leadId, t.relationship])).toEqual([['L1', null], ['k1', 'Filho']]);
  });

  it('número sem cadastro: nenhum alvo, e as listas vêm do mesmo jeito', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.targets).toEqual([]);
    expect(res.body.units).toHaveLength(2);
  });

  it('pessoa fora da equipe recebe o aviso do cadastro, com o e-mail dela', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ email: 'carla@stronix.com.br' }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'fora_da_equipe',
      message: 'Seu e-mail do Stronizap, carla@stronix.com.br, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.'
    });
  });

  it('academia suspensa não abre o balão', async () => {
    banco.tenants[TENANT].status = 'suspended';
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('academia_bloqueada');
  });

  it('número fora do formato e pedido sem e-mail: 400 no campo', async () => {
    const semNumero = resposta();
    await handler(pedidoOpcoesAgenda({ phone: '123' }), semNumero);
    expect(semNumero.statusCode).toBe(400);
    expect(semNumero.body).toMatchObject({ error: 'dados_invalidos', field: 'phone' });

    const semEmail = resposta();
    await handler(pedidoOpcoesAgenda({ email: '' }), semEmail);
    expect(semEmail.body).toEqual({ error: 'dados_invalidos', field: 'actor', message: 'Não deu para saber quem está agendando.' });
  });

  it('chave de outra academia não abre as opções', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoOpcoesAgenda();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('erro do banco sobe sem o telefone', async () => {
    banco.falhaEm = 'zapMatchKey';

    const erro = await handler(pedidoOpcoesAgenda(), resposta()).catch((e) => e);

    expect(erro.message).toBe('zap schedule-options falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MARIANA));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: FAIL, `Tests  12 failed | 102 passed (114)`. Sem o desvio, a ação cai no caminho do login e volta `401 { error: 'Não autenticado.' }`.

- [ ] **Step 3: Implementar em `api/zap.js`**

O import das regras, logo depois do import de `./_zapLead.js`. Trocar:

```js
  buildZapLead, buildZapSignupInteraction, buildRegistrationNote, alreadyRegisteredBody, scrubbedError
} from './_zapLead.js';
```

por:

```js
  buildZapLead, buildZapSignupInteraction, buildRegistrationNote, alreadyRegisteredBody, scrubbedError
} from './_zapLead.js';
import { readScheduleOptionsBody, buildScheduleOptions } from './_zapSchedule.js';
```

As coleções das listas, logo depois de `INTERACTIONS_PATH`. Trocar:

```js
const USERS_PATH = 'stronix_users';
const INTERACTIONS_PATH = 'stronix_interactions';
```

por:

```js
const USERS_PATH = 'stronix_users';
const INTERACTIONS_PATH = 'stronix_interactions';
// Listas do agendamento pelo Stronizap.
const UNITS_PATH = 'stronix_units';
const MODALITIES_PATH = 'stronix_modalities';
const PROFESSORS_PATH = 'stronix_professores';
```

O desvio, no começo do `handlePost`. Trocar:

```js
  if (action === 'create-lead') return handleCreateLead(req, res);
```

por:

```js
  if (action === 'create-lead') return handleCreateLead(req, res);
  if (action === 'schedule-options') return handleScheduleOptions(req, res);
```

E acrescentar no fim do arquivo:

```js
// ---------------------------------------------------------------------------
// Agendamento pelo Stronizap. As regras moram em api/_zapSchedule.js; aqui
// ficam a leitura e a gravação. Spec em
// docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md
// ---------------------------------------------------------------------------

// As listas do agendamento, lidas a cada pedido, como as do cadastro: item
// novo no Stronilead aparece na próxima abertura do balão, e item apagado é
// recusado na gravação.
async function readScheduleCatalogs(tenantId) {
  const [units, modalities, professors, configSnap] = await Promise.all([
    academyCollection(tenantId, UNITS_PATH).get(),
    academyCollection(tenantId, MODALITIES_PATH).get(),
    academyCollection(tenantId, PROFESSORS_PATH).get(),
    academyCollection(tenantId, CONFIG_PATH).doc(CONFIG_GENERAL_ID).get()
  ]);
  return {
    units: docsOf(units),
    modalities: docsOf(modalities),
    professors: docsOf(professors),
    config: configSnap.exists ? configSnap.data() : null
  };
}

// Opções do balão: quem pede (achado pelo e-mail da sessão do Stronizap), os
// cadastros do número, as listas e os dias sugeridos. Só lê.
async function handleScheduleOptions(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readScheduleOptionsBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { matchKey, email } = read.value;

    const agora = new Date();
    const [team, catalogs, people] = await Promise.all([
      readTeam(tenantId), readScheduleCatalogs(tenantId), numberPeople(tenantId, matchKey, agora)
    ]);
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));

    return res.status(200).json(
      buildScheduleOptions({ member, catalogs, owner: people.dono, wards: people.menores, now: agora })
    );
  } catch (e) {
    throw scrubbedError('schedule-options', e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/zap.js api/__tests__/zapRoute.test.js`
Expected: `Tests  114 passed (114)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: Stronizap pede as listas do agendamento pela ponte

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Ação `schedule`

**Files:**
- Modify: `api/zap.js` (o import das regras, as coleções, o desvio e o fim do arquivo)
- Test: `api/__tests__/zapRoute.test.js`

A gravação. A ordem das conferências é a do cadastro: chave e academia ativa, formato (400, sem gastar o limite), limite, equipe, catálogo e horário no futuro. Depois, numa transação só: o lead do número, o agendamento repetido (`ja_agendado`) e as três escritas. A resposta traz o cartão relido depois da gravação e o `AppointmentDetail`.

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapRoute.test.js`, acrescentar no fim do arquivo:

```js
// Um registro de stronix_aulas como o assistente grava.
const registro = (id, extra = {}) => ({
  id, type: 'visita', unit: 'Centro', leadId: 'L1', leadName: 'Mariana Souza', professorId: null, professorName: null,
  soloTraining: false, modality: null, scheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), status: 'agendada',
  outcomeAt: null, converted: false, convertedAt: null, consultantId: 'u-ana', consultantAuthUid: 'auth-ana',
  consultantName: 'Ana Souza', ...extra
});

// Pedido de agendamento da Ana: visita da Mariana na quinta, 01/10, às 18:00.
// `schedule` mexe nos campos do agendamento; o resto troca campos do corpo.
const pedidoAgenda = ({ schedule = {}, ...extra } = {}) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: {
    action: 'schedule',
    tenant: TENANT,
    phone: MARIANA,
    actor: { email: ANA.email, name: 'Ana' },
    channelName: 'Recepção',
    schedule: {
      leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
      quantity: null, date: '2026-10-01', time: '18:00', note: 'Vem depois do trabalho.', ...schedule
    },
    ...extra
  }
});
// Aula experimental de pilates com a Carla, na sexta, 02/10, às 19:00.
const AULA_DA_CARLA = {
  type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
  quantity: 1, date: '2026-10-02', time: '19:00', note: null
};

const aulasDaAcademia = () => banco.aulas[TENANT] ?? [];
const interacoesDaAcademia = () => banco.interacoes[TENANT] ?? [];
const leadDaAcademia = (id) => leadsDaAcademia().find((l) => l.id === id);

describe('POST /api/zap com action schedule', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    academiaComEquipe();
    banco.leads[TENANT] = [marianaLead()];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const QUINTA_18H = new Date('2026-10-01T21:00:00.000Z');
  const SEXTA_19H = new Date('2026-10-02T22:00:00.000Z');

  it('visita nova: o registro, a interação e o lead, numa gravação só, e o cartão já atualizado', async () => {
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    const [rec] = aulasDaAcademia();
    expect(rec).toEqual({
      id: expect.any(String), type: 'visita', unit: 'Centro', leadId: 'L1', leadName: 'Mariana Souza',
      professorId: null, professorName: null, soloTraining: false, modality: null, scheduledFor: QUINTA_18H,
      status: 'agendada', outcomeAt: null, converted: false, convertedAt: null,
      consultantId: 'u-ana', consultantAuthUid: 'auth-ana', consultantName: 'Ana Souza', createdAt: HORA
    });
    expect(interacoesDaAcademia()).toEqual([{
      id: expect.any(String),
      leadId: 'L1',
      leadName: 'Mariana Souza',
      // O nome vem do Stronilead, e não do "Ana" que o Stronizap mandou.
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      createdAt: HORA,
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
      type: 'note',
      volumeKind: 'visita',
      via: 'stronizap',
      zapChannelName: 'Recepção'
    }]);
    expect(leadDaAcademia('L1')).toMatchObject({
      status: 'Primeiro contato',
      interactionsCount: 4,
      lastInteractionAt: HORA,
      nextFollowUp: QUINTA_18H,
      nextFollowUpType: 'Visita',
      nextFollowUpNote: 'Vem depois do trabalho.',
      appointmentType: 'visita',
      appointmentScheduledFor: QUINTA_18H,
      appointmentUnit: 'Centro',
      appointmentModality: null,
      trialClassesPlanned: null,
      appointmentOutcome: null,
      currentAulaId: null
    });
    expect(res.body).toEqual({
      card: expect.objectContaining({
        found: true, leadId: 'L1', kind: 'lead',
        appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null }
      }),
      appointment: {
        leadId: 'L1', leadName: 'Mariana Souza', type: 'visita', at: '2026-10-01T21:00:00.000Z',
        unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
        soloTraining: false, quantity: null, outcome: null
      }
    });
    expect(limitador.chamadas).toEqual([{ chave: 'zap-schedule:academia-teste', opcoes: { limit: 60, windowMs: 3600000 } }]);
  });

  it('remarcar visita: o registro em aberto troca de data, o desfecho anterior sai e a linha do tempo ganha outro registro', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')),
      appointmentUnit: 'Zona Sul', appointmentOutcome: 'no_show', appointmentOutcomeAt: ts(new Date('2026-09-28T21:00:00.000Z'))
    })];
    banco.aulas[TENANT] = [
      registro('v-velha', { status: 'no_show', scheduledFor: ts(new Date('2026-09-20T21:00:00.000Z')) }),
      registro('v-aberta', { unit: 'Zona Sul' })
    ];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    expect(aulasDaAcademia().find((a) => a.id === 'v-aberta')).toMatchObject({ unit: 'Centro', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(aulasDaAcademia().find((a) => a.id === 'v-velha').status).toBe('no_show');
    expect(leadDaAcademia('L1')).toMatchObject({
      appointmentScheduledFor: QUINTA_18H, appointmentUnit: 'Centro', appointmentOutcome: null, appointmentOutcomeAt: null
    });
    expect(interacoesDaAcademia()).toHaveLength(1);
  });

  it('aula nova: o registro leva o professor, e o lead passa a apontar para ele', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), res);

    expect(res.statusCode).toBe(201);
    const [rec] = aulasDaAcademia();
    expect(rec).toMatchObject({
      type: 'aula', unit: null, professorId: 'p1', professorName: 'Carla Dias', modality: 'Pilates',
      soloTraining: false, scheduledFor: SEXTA_19H, status: 'agendada'
    });
    expect(leadDaAcademia('L1')).toMatchObject({
      appointmentType: 'aula_experimental', nextFollowUpType: 'Aula Experimental', appointmentModality: 'Pilates',
      appointmentProfessorId: 'p1', appointmentProfessorName: 'Carla Dias', trialClassesPlanned: 1,
      appointmentUnit: null, currentAulaId: rec.id
    });
    expect(interacoesDaAcademia()[0]).toMatchObject({
      text: '🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00.',
      volumeKind: 'aula_experimental'
    });
    expect(res.body.appointment).toMatchObject({
      type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', modality: 'Pilates', professorName: 'Carla Dias', quantity: 1
    });
  });

  it('aula no registro do currentAulaId ainda agendada: o mesmo registro é atualizado', async () => {
    banco.leads[TENANT] = [marianaLead({ currentAulaId: 'a-aberta' })];
    banco.aulas[TENANT] = [registro('a-aberta', { type: 'aula', unit: null, professorId: 'p2', professorName: 'Rafael Moura', modality: 'Musculação' })];

    await handler(pedidoAgenda({ schedule: { ...AULA_DA_CARLA, quantity: 2 } }), resposta());

    expect(aulasDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()[0]).toMatchObject({
      id: 'a-aberta', professorId: 'p1', professorName: 'Carla Dias', modality: 'Pilates', scheduledFor: SEXTA_19H
    });
    expect(leadDaAcademia('L1')).toMatchObject({ currentAulaId: 'a-aberta', trialClassesPlanned: 2 });
    expect(interacoesDaAcademia()[0].text).toBe('🔔 Aula Experimental agendada (Pilates · 2 aulas) · Carla Dias p/ 02/10/2026, 19:00.');
  });

  it('aula do currentAulaId já resolvida: nasce outro registro', async () => {
    banco.leads[TENANT] = [marianaLead({ currentAulaId: 'a-feita' })];
    banco.aulas[TENANT] = [registro('a-feita', { type: 'aula', status: 'attended' })];

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());

    expect(aulasDaAcademia()).toHaveLength(2);
    const nova = aulasDaAcademia().find((a) => a.id !== 'a-feita');
    expect(leadDaAcademia('L1').currentAulaId).toBe(nova.id);
    expect(aulasDaAcademia().find((a) => a.id === 'a-feita').status).toBe('attended');
  });

  it('quem treina sozinho: a aula vai sem professor', async () => {
    await handler(pedidoAgenda({ schedule: { ...AULA_DA_CARLA, professorId: null, soloTraining: true } }), resposta());

    expect(aulasDaAcademia()[0]).toMatchObject({ professorId: null, professorName: null, soloTraining: true });
    expect(interacoesDaAcademia()[0].text).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Treina sozinho p/ 02/10/2026, 19:00.');
  });

  it('o gestor agenda no lead da Ana: ele é o autor, e a Ana continua dona do lead e do registro', async () => {
    await handler(pedidoAgenda({ actor: { email: JOHNNY.email } }), resposta());

    expect(interacoesDaAcademia()[0]).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny', leadConsultantId: 'u-ana'
    });
    expect(aulasDaAcademia()[0]).toMatchObject({ consultantId: 'u-ana', consultantName: 'Ana Souza' });
    expect(leadDaAcademia('L1').consultantId).toBe('u-ana');
  });

  it('menor de quem o número é responsável: agenda no lead dele e devolve o cartão do responsável', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno' })];
    const res = resposta();

    await handler(pedidoAgenda({ phone: MAE, schedule: { leadId: 'k1' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(res.body.card.wards[0]).toMatchObject({ leadId: 'k1', appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z' } });
    expect(interacoesDaAcademia()[0]).toMatchObject({ leadId: 'k1', leadConsultantId: 'u-bruno', actorId: 'u-ana' });
  });

  it.each([
    ['de outro número', () => { banco.leads[TENANT].push({ ...marianaLead(), id: 'L7', zapMatchKey: zapMatchKey(TELEFONE) }); }, 'L7'],
    ['que não existe', () => {}, 'nao-existe'],
    ['que fez 18 anos com WhatsApp próprio', () => {
      banco.leads[TENANT].push(menorDe('k9', 'Adulto', { birthDate: ts(new Date(2000, 0, 10)), whatsapp: '(11) 9 5555-4444' }));
    }, 'k9']
  ])('lead %s é recusado, sem gravar nada', async (_, preparar, leadId) => {
    preparar();
    const res = resposta();

    await handler(pedidoAgenda({ phone: leadId === 'k9' ? MAE : MARIANA, schedule: { leadId } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'lead_nao_confere', message: 'Esse cadastro não é deste número no Stronilead.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('o mesmo agendamento de novo: 409 com o cartão e o agendamento, sem gravar e sem outro ponto', async () => {
    await handler(pedidoAgenda(), resposta());
    const gravacoes = banco.gravacoes.length;
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'ja_agendado',
      message: 'Esse agendamento já estava no Stronilead.',
      card: expect.objectContaining({ found: true, leadId: 'L1' }),
      appointment: expect.objectContaining({ leadId: 'L1', type: 'visita', at: '2026-10-01T21:00:00.000Z', unit: 'Centro' })
    });
    expect(banco.gravacoes).toHaveLength(gravacoes);
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()).toHaveLength(1);
  });

  it('dois pedidos ao mesmo tempo gravam uma vez só', async () => {
    const [a, b] = [resposta(), resposta()];

    await Promise.all([
      handler(pedidoAgenda(), a),
      handler(pedidoAgenda({ actor: { email: BRUNO.email } }), b)
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(leadDaAcademia('L1').interactionsCount).toBe(4);
  });

  it('horário que já passou é recusado, sem gravar', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { date: '2026-09-29', time: '15:00' } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'horario_passado', message: 'Esse horário já passou. Escolha outro.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it.each([
    ['unit', { unit: 'Unidade Antiga' }],
    ['modality', { ...AULA_DA_CARLA, modality: 'Crossfit' }],
    ['professorId', { ...AULA_DA_CARLA, professorId: 'p3' }],
    ['professorId', { ...AULA_DA_CARLA, modality: 'Musculação' }],
    ['quantity', { ...AULA_DA_CARLA, quantity: 4 }]
  ])('item que mudou no Stronilead (%s) é recusado e diz o campo', async (field, schedule) => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ error: 'catalogo_mudou', field });
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia sem unidade: a visita vai sem unidade', async () => {
    banco.catalogos[TENANT].stronix_units = [];
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { unit: null, note: null } }), res);

    expect(res.statusCode).toBe(201);
    expect(interacoesDaAcademia()[0].text).toBe('🔔 Visita agendada p/ 01/10/2026, 18:00.');
    expect(aulasDaAcademia()[0].unit).toBeNull();
  });

  it('com unidade cadastrada, visita sem unidade é campo a escolher', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { unit: null } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'unit', message: 'Escolha a unidade.' });
  });

  it('pessoa fora da equipe não agenda', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ actor: { email: 'carla@stronix.com.br' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('fora_da_equipe');
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia com teste vencido não agenda nem gasta o limite', async () => {
    Object.assign(banco.tenants[TENANT], { status: 'trial', trialEndsAt: ts(new Date('2026-09-01T00:00:00.000Z')) });
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('academia_bloqueada');
    expect(limitador.chamadas).toEqual([]);
  });

  it('passou de 60 agendamentos na hora: recusa sem gravar', async () => {
    limitador.ok = false;
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'limite', message: 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('pedido com formato errado responde 400 sem gastar o limite', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { date: '2026-02-30' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'date', message: 'Escolha o dia.' });
    expect(limitador.chamadas).toEqual([]);
  });

  it('erro do banco no meio do agendamento sobe sem o telefone e sem gravar nada', async () => {
    banco.falhaEm = 'leadId';

    const erro = await handler(pedidoAgenda(), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap schedule falhou (9)');
    expect(String(erro.stack)).not.toContain(MARIANA);
    expect(banco.gravacoes).toEqual([]);
  });

  it('chave de outra academia não agenda', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoAgenda();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(banco.gravacoes).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: FAIL, `Tests  26 failed | 115 passed (141)`. A ação ainda cai no caminho do login. O único teste novo que já passa é "chave de outra academia não agenda", porque o caminho do login também responde 401 sem gravar.

- [ ] **Step 3: Implementar em `api/zap.js`**

O import das regras. Trocar:

```js
import { readScheduleOptionsBody, buildScheduleOptions } from './_zapSchedule.js';
```

por:

```js
import {
  SCHEDULE_LIMIT, ZAP_SCHEDULE_MESSAGES, unitsView, readScheduleOptionsBody, buildScheduleOptions, isDocId,
  readScheduleBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  isOpenAulaRecord, pickOpenVisitaId, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
} from './_zapSchedule.js';
```

A coleção do registro de aulas. Trocar:

```js
// Listas do agendamento pelo Stronizap.
const UNITS_PATH = 'stronix_units';
const MODALITIES_PATH = 'stronix_modalities';
const PROFESSORS_PATH = 'stronix_professores';
```

por:

```js
// Listas e registro do agendamento pelo Stronizap.
const UNITS_PATH = 'stronix_units';
const MODALITIES_PATH = 'stronix_modalities';
const PROFESSORS_PATH = 'stronix_professores';
const AULAS_PATH = 'stronix_aulas';
```

O desvio. Trocar:

```js
  if (action === 'schedule-options') return handleScheduleOptions(req, res);
```

por:

```js
  if (action === 'schedule-options') return handleScheduleOptions(req, res);
  if (action === 'schedule') return handleSchedule(req, res);
```

E acrescentar no fim do arquivo:

```js
// Agenda a visita ou a aula experimental, gravando o que o assistente da
// ficha grava, numa transação só. Responde 201 com o cartão do número já
// atualizado e o agendamento.
async function handleSchedule(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readScheduleBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { matchKey, email, actorName, channelName, at, schedule } = read.value;

    const limit = await checkRateLimit(`zap-schedule:${tenantId}`, SCHEDULE_LIMIT);
    if (!limit.ok) return responder(res, refusal(429, 'limite', ZAP_SCHEDULE_MESSAGES.rateLimited));

    const [team, catalogs] = await Promise.all([readTeam(tenantId), readScheduleCatalogs(tenantId)]);
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
    // O nome de quem agendou é o do Stronilead, como no cadastro. O que o
    // Stronizap manda só entra se o cadastro da equipe não tiver nome.
    const actor = { ...member, name: member.name || actorName };

    const agora = new Date();
    const problem = checkScheduleCatalog(schedule, catalogs) || checkFuture(at, agora);
    if (problem) return responder(res, problem);

    const serverTime = admin.firestore.FieldValue.serverTimestamp();
    const increment = admin.firestore.FieldValue.increment(1);
    const leadRef = leadsCollection(tenantId).doc(schedule.leadId);
    const aulas = academyCollection(tenantId, AULAS_PATH);
    const interactionRef = academyCollection(tenantId, INTERACTIONS_PATH).doc();

    // Conferência do lead, do agendamento repetido e gravação na MESMA
    // transação: dois cliques, duas pessoas ou o "Tentar de novo" depois de
    // uma resposta perdida gravam uma vez só e dão um ponto só na Meta.
    const outcome = await adminDb.runTransaction(async (tx) => {
      const leadSnap = await tx.get(leadRef);
      const lead = leadSnap.exists ? leadDoDoc(leadSnap) : null;
      if (!leadBelongsToNumber(lead, matchKey, agora)) return { notTheLead: true };
      if (hasSameAppointment(lead, { type: schedule.type, at })) return { repeated: lead };

      // O registro em aberto que o assistente reaproveitaria: a aula do
      // currentAulaId ainda agendada, ou a visita agendada do lead.
      let openRecordId = null;
      if (schedule.type === 'aula_experimental') {
        if (isDocId(lead.currentAulaId)) {
          const aulaSnap = await tx.get(aulas.doc(lead.currentAulaId));
          if (aulaSnap.exists && isOpenAulaRecord(aulaSnap.data())) openRecordId = lead.currentAulaId;
        }
      } else {
        openRecordId = pickOpenVisitaId(docsOf(await tx.get(aulas.where('leadId', '==', lead.id))));
      }
      const newRecordRef = openRecordId ? null : aulas.doc();
      const writes = buildScheduleWrites({
        lead, actor, schedule, at, professors: catalogs.professors, channelName,
        openRecordId, newRecordId: newRecordRef ? newRecordRef.id : null, serverTime, increment
      });
      if (openRecordId) tx.update(aulas.doc(openRecordId), writes.record.update);
      else tx.create(newRecordRef, writes.record.create);
      tx.create(interactionRef, writes.interaction);
      tx.update(leadRef, writes.leadPatch);
      return { scheduled: { ...lead, ...writes.leadPatch } };
    });

    if (outcome.notTheLead) {
      return responder(res, refusal(422, 'lead_nao_confere', ZAP_SCHEDULE_MESSAGES.notTheLead));
    }
    const units = unitsView(catalogs.units);
    const card = await cardFor(tenantId, matchKey);
    if (outcome.repeated) {
      return res.status(409).json(alreadyScheduledBody({ card, appointment: appointmentDetailOf(outcome.repeated, units) }));
    }
    return res.status(201).json({ card, appointment: appointmentDetailOf(outcome.scheduled, units) });
  } catch (e) {
    throw scrubbedError('schedule', e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/zap.js api/__tests__/zapRoute.test.js`
Expected: `Tests  141 passed (141)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: Stronizap agenda visita e aula experimental pela ponte, numa transação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Ação `appointment-status`

**Files:**
- Modify: `api/zap.js:1-4`, `:13-16`, o import das regras, `:187-194`, o desvio, `:330-333`, `:347`, fim do arquivo
- Test: `api/__tests__/zapRoute.test.js`

A conferência que o lembrete do Stronizap faz antes de enviar: o agendamento de cada lead, como a ficha, o cartão e a Meta mostram hoje. Só lê e confere só a chave e o identificador, como o `GET` (nota 11). A tarefa fecha também os comentários do topo do arquivo e do `handlePost`, que passam a listar as seis ações da chave.

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapRoute.test.js`, acrescentar no fim do arquivo:

```js
const pedidoStatus = (leadIds) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: { action: 'appointment-status', tenant: TENANT, leadIds }
});

describe('POST /api/zap com action appointment-status', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    chave = academia(TENANT);
    banco.catalogos[TENANT] = catalogosDaAcademia();
    banco.leads[TENANT] = [
      marianaLead({ appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-10-01T21:00:00.000Z')), appointmentUnit: 'Centro' }),
      menorDe('k1', 'Pedro Souza', {
        appointmentType: 'aula_experimental', appointmentScheduledFor: ts(new Date('2026-10-02T22:00:00.000Z')),
        appointmentModality: 'Pilates', appointmentProfessorName: 'Carla Dias', appointmentSoloTraining: false,
        trialClassesPlanned: 2, appointmentOutcome: 'attended'
      }),
      menorDe('k2', 'Ana Souza'),
      menorDe('k3', 'Caio Souza', {
        appointmentType: null, appointmentScheduledFor: null, nextFollowUpType: 'Visita', appointmentOutcome: 'cancelled'
      })
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('devolve o agendamento de cada lead, e null para quem não tem, foi cancelado ou não existe', async () => {
    const res = resposta();

    await handler(pedidoStatus(['L1', 'k1', 'k2', 'k3', 'nao-existe']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      appointments: {
        L1: {
          leadId: 'L1', leadName: 'Mariana Souza', type: 'visita', at: '2026-10-01T21:00:00.000Z',
          unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
          soloTraining: false, quantity: null, outcome: null
        },
        k1: {
          leadId: 'k1', leadName: 'Pedro Souza', type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z',
          unit: null, unitAddress: null, modality: 'Pilates', professorName: 'Carla Dias',
          soloTraining: false, quantity: 2, outcome: 'attended'
        },
        k2: null,
        k3: null,
        'nao-existe': null
      }
    });
    expect(banco.gravacoes).toEqual([]);
    expect(limitador.chamadas).toEqual([]);
  });

  it('lead de outra academia volta null', async () => {
    academia(OUTRA);
    banco.leads[OUTRA] = [marianaLead({ id: 'L-outra', appointmentType: 'visita', appointmentScheduledFor: ts(AGORA) })];
    const res = resposta();

    await handler(pedidoStatus(['L-outra']), res);

    expect(res.body).toEqual({ appointments: { 'L-outra': null } });
  });

  it('responde mesmo com a academia bloqueada, como o GET do cartão', async () => {
    banco.tenants[TENANT].status = 'suspended';
    const res = resposta();

    await handler(pedidoStatus(['L1']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.appointments.L1).toMatchObject({ type: 'visita' });
  });

  it.each([
    ['vazia', []],
    ['com 31 ids', Array.from({ length: 31 }, (_, i) => `L${i}`)],
    ['com id repetido', ['L1', 'L1']],
    ['com id que não é texto', ['L1', 7]]
  ])('lista %s é recusada no campo leadIds', async (_, leadIds) => {
    const res = resposta();

    await handler(pedidoStatus(leadIds), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'leadIds', message: 'Envie de 1 a 30 leads, sem repetir.' });
  });

  it('chave errada responde 401 e não lê nada', async () => {
    const res = resposta();
    const p = pedidoStatus(['L1']);
    p.headers['x-stronizap-key'] = generateZapKey().key;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('erro do banco sobe sem o caminho do lead', async () => {
    banco.falhaEm = 'documento';

    const erro = await handler(pedidoStatus(['L1']), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap appointment-status falhou (14)');
    expect(String(erro.stack)).not.toContain('stronix_leads/L1');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: FAIL, `Tests  9 failed | 141 passed (150)`, pelo mesmo motivo das tarefas anteriores.

- [ ] **Step 3: Implementar em `api/zap.js`**

O import das regras ganha o `readStatusBody`. Trocar:

```js
import {
  SCHEDULE_LIMIT, ZAP_SCHEDULE_MESSAGES, unitsView, readScheduleOptionsBody, buildScheduleOptions, isDocId,
  readScheduleBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  isOpenAulaRecord, pickOpenVisitaId, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
} from './_zapSchedule.js';
```

por:

```js
import {
  SCHEDULE_LIMIT, ZAP_SCHEDULE_MESSAGES, unitsView, readScheduleOptionsBody, buildScheduleOptions, isDocId,
  readScheduleBody, readStatusBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  isOpenAulaRecord, pickOpenVisitaId, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
} from './_zapSchedule.js';
```

O desvio. Trocar:

```js
  if (action === 'schedule') return handleSchedule(req, res);
```

por:

```js
  if (action === 'schedule') return handleSchedule(req, res);
  if (action === 'appointment-status') return handleAppointmentStatus(req, res);
```

O `openByKey` ganha a opção de ficar só com as conferências do `GET`. Trocar:

```js
// Autenticação das ações do Stronizap no POST: identificador no formato da
// casa, chave da academia e academia ativa. Devolve { tenantId } ou
// { refusal }. Academia inexistente responde igual a chave errada, como no GET.
async function openByKey(req) {
```

por:

```js
// Autenticação das ações do Stronizap no POST: identificador no formato da
// casa, chave da academia e academia ativa. Devolve { tenantId } ou
// { refusal }. Academia inexistente responde igual a chave errada, como no GET.
// `checkBlocked: false` fica só com as conferências do GET (chave e
// identificador): é o appointment-status, que o lembrete do Stronizap consulta.
async function openByKey(req, { checkBlocked = true } = {}) {
```

E, dentro dele: Trocar:

```js
  if (tenantBlocked(loaded.tenant, new Date())) {
```

por:

```js
  if (checkBlocked && tenantBlocked(loaded.tenant, new Date())) {
```

Os comentários do topo do arquivo. Trocar:

```js
// Ponte com o Stronizap. O Zap pergunta quem é a pessoa por trás de um
// telefone e recebe o cartão de contexto. Desde o cadastro pelo Stronizap, ele
// também pede as listas do formulário (lead-options) e cadastra o lead de
// dentro da conversa (create-lead).
```

por:

```js
// Ponte com o Stronizap. O Zap pergunta quem é a pessoa por trás de um
// telefone e recebe o cartão de contexto. Desde o cadastro pelo Stronizap, ele
// também pede as listas do formulário (lead-options) e cadastra o lead de
// dentro da conversa (create-lead). Desde o agendamento pelo Stronizap, pede
// as listas do balão (schedule-options), agenda visita e aula experimental
// (schedule) e confere os agendamentos antes do lembrete (appointment-status).
```

Trocar:

```js
// O POST tem dois donos. `generate` e `revoke` são do admin da academia, logado
// no CRM, e autenticam por verifyRequest (ID token). `match`, `lead-options` e
// `create-lead` são do próprio Stronizap e autenticam pela chave, igual ao GET.
// O desvio fica no começo de handlePost, e os dois caminhos nunca se misturam.
```

por:

```js
// O POST tem dois donos. `generate` e `revoke` são do admin da academia, logado
// no CRM, e autenticam por verifyRequest (ID token). `match`, `lead-options`,
// `create-lead`, `schedule-options`, `schedule` e `appointment-status` são do
// próprio Stronizap e autenticam pela chave, igual ao GET. O desvio fica no
// começo de handlePost, e os dois caminhos nunca se misturam.
```

O comentário do `handlePost`. Trocar:

```js
// Gera e revoga a chave de conexão do Stronizap (ação do admin da academia, pela
// tela de Configurações → Integrações) e atende as ações do próprio Stronizap,
// autenticadas pela chave: o match em lote, as opções e o cadastro de lead.
// Ver o desvio logo abaixo.
async function handlePost(req, res) {
  // match, lead-options e create-lead são do próprio Stronizap e autenticam
  // pela chave do Zap. generate e revoke são do admin logado e seguem exigindo
  // ID token. Ação desconhecida cai no caminho do login e é recusada lá.
```

por:

```js
// Gera e revoga a chave de conexão do Stronizap (ação do admin da academia, pela
// tela de Configurações → Integrações) e atende as ações do próprio Stronizap,
// autenticadas pela chave: o match em lote, as opções e o cadastro de lead, e
// as opções, a gravação e a conferência do agendamento. Ver o desvio logo
// abaixo.
async function handlePost(req, res) {
  // match, lead-options, create-lead, schedule-options, schedule e
  // appointment-status são do próprio Stronizap e autenticam pela chave do
  // Zap. generate e revoke são do admin logado e seguem exigindo ID token.
  // Ação desconhecida cai no caminho do login e é recusada lá.
```

E acrescentar no fim do arquivo:

```js
// O agendamento de cada lead, como a ficha, o cartão e a Meta mostram hoje.
// Quem pergunta é o lembrete do Stronizap, antes de enviar. Só lê, e fica só
// com as conferências do GET (chave e identificador).
async function handleAppointmentStatus(req, res) {
  try {
    const access = await openByKey(req, { checkBlocked: false });
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readStatusBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { leadIds } = read.value;

    const [snaps, unitsSnap] = await Promise.all([
      Promise.all(leadIds.map((id) => leadsCollection(tenantId).doc(id).get())),
      academyCollection(tenantId, UNITS_PATH).get()
    ]);
    const units = unitsView(docsOf(unitsSnap));
    const appointments = Object.fromEntries(leadIds.map((id, i) => [
      id, snaps[i].exists ? appointmentDetailOf(leadDoDoc(snaps[i]), units) : null
    ]));
    return res.status(200).json({ appointments });
  } catch (e) {
    throw scrubbedError('appointment-status', e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/zap.js api/__tests__/zapRoute.test.js`
Expected: `Tests  150 passed (150)` e lint sem erro.

- [ ] **Step 5: As travas da casa**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
grep -n "dailyGoal\|lucide-react\|firebase/firestore\|aulasWrites\|lib/interactions" api/_zapSchedule.js api/zap.js
```

Expected: `11`, e o `grep` sem nenhuma linha.

- [ ] **Step 6: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: Stronizap confere os agendamentos pela ponte antes do lembrete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: O desvio cobre as três ações novas

**Files:**
- Test: `api/__tests__/zapRoute.test.js` (o bloco "o desvio no começo do handlePost", linhas 1055 a 1085 do arquivo original)

As travas do desvio passam a cobrir as ações do agendamento: com login de admin e sem a chave, elas respondem 401 e não gravam; com a chave, nunca consultam o login. Os testes passam de primeira, porque as Tasks 9 a 11 já puseram as ações no desvio; o Step 3 prova que a trava enxerga um desvio apagado.

- [ ] **Step 1: Os pedidos e os dois `it.each`**

Trocar:

```js
  // Os pedidos de cada ação que autentica pela chave.
  const pedidoPelaChave = (action) => ({
    match: { method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action, tenant: TENANT, phones: [TELEFONE] } },
    'lead-options': pedidoOpcoes(),
    'create-lead': pedidoCadastro()
  })[action];

  it.each(['lead-options', 'create-lead'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
```

por:

```js
  // Os pedidos de cada ação que autentica pela chave.
  const pedidoPelaChave = (action) => ({
    match: { method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action, tenant: TENANT, phones: [TELEFONE] } },
    'lead-options': pedidoOpcoes(),
    'create-lead': pedidoCadastro(),
    'schedule-options': pedidoOpcoesAgenda(),
    schedule: pedidoAgenda(),
    'appointment-status': pedidoStatus(['L1'])
  })[action];

  it.each(['lead-options', 'create-lead', 'schedule-options', 'schedule', 'appointment-status'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
```

Trocar:

```js
  it.each(['match', 'lead-options', 'create-lead'])('%s com a chave nunca consulta o login do CRM', async (action) => {
    const res = resposta();
```

por:

```js
  it.each(['match', 'lead-options', 'create-lead', 'schedule-options', 'schedule', 'appointment-status'])('%s com a chave nunca consulta o login do CRM', async (action) => {
    // O agendamento precisa de um lead do número para dar certo.
    if (action === 'schedule') banco.leads[TENANT] = [marianaLead()];
    const res = resposta();
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/__tests__/zapRoute.test.js`
Expected: `Tests  156 passed (156)` e lint sem erro.

- [ ] **Step 3: Provar que a trava enxerga o desvio apagado**

Apague de `api/zap.js` a linha `  if (action === 'schedule') return handleSchedule(req, res);` e rode `npx vitest run api/__tests__/zapRoute.test.js`.
Expected: FAIL, `Tests  28 failed | 128 passed (156)`: caem os testes do `schedule`, inclusive "schedule com a chave nunca consulta o login do CRM". Desfaça a sabotagem e rode de novo: `Tests  156 passed (156)`, com `git diff api/zap.js` vazio.

- [ ] **Step 4: Commit**

```bash
git add api/__tests__/zapRoute.test.js
git commit -m "test: o desvio do POST do Zap cobre as ações do agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: A ficha: a marca do Stronizap em quem agendou e no rodapé do desfecho

**Files:**
- Modify: `src/lib/timeline.js:6`, antes da linha 65
- Modify: `src/components/brand/StronizapMark.jsx:1-3`, fim do arquivo
- Modify: `src/views/LeadProfileView.jsx:10`, `:42`, `:58-60`, `:724-726`, `:736`, `:982-983`, `:1134-1140`, `:1164`
- Test: `src/lib/__tests__/timeline.test.js`, `src/lib/__tests__/profileZapSchedule.test.js` (novo)

O modelo A dos mockups (seção 6): o agendamento feito pelo Stronizap continua o cartão de agendamento de sempre (a variante 3 da linha do tempo), com a marca do Stronizap antes do nome na coluna do autor e "Agendado pelo Stronizap, canal Recepção" ao passar o mouse. No desfecho, o rodapé que aponta para o agendamento de origem ganha a marca e o complemento: "Agendada em 29/09 por Ana Souza, pelo Stronizap". O selo, a data, o texto e a classificação não mudam. A marca vai num círculo de 17px com o fundo `bg-muted`, a mesma da pílula do `ZapSignupMarker`, e não aumenta a altura da linha. O detalhe sem canal, "Agendado pelo Stronizap", é texto a confirmar com o Johnny.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/timeline.test.js`, no import de `../timeline.js`:

Trocar:

```js
  originLastOnTies,
  TIMELINE_FILTERS
} from '../timeline.js';
```

por:

```js
  originLastOnTies,
  zapScheduleTitle,
  appointmentOriginText,
  TIMELINE_FILTERS
} from '../timeline.js';
```

E acrescentar no fim do arquivo:

```js
describe('agendamento feito pelo Stronizap', () => {
  it('zapScheduleTitle: o detalhe do autor, com o canal quando ele veio', () => {
    expect(zapScheduleTitle({ via: 'stronizap', zapChannelName: 'Recepção' })).toBe('Agendado pelo Stronizap, canal Recepção');
    expect(zapScheduleTitle({ via: 'stronizap', zapChannelName: '  ' })).toBe('Agendado pelo Stronizap');
    expect(zapScheduleTitle({ via: 'stronizap' })).toBe('Agendado pelo Stronizap');
  });

  it('zapScheduleTitle: agendamento que não veio do Stronizap não tem detalhe', () => {
    expect(zapScheduleTitle({ zapChannelName: 'Recepção' })).toBeNull();
    expect(zapScheduleTitle({ via: 'outro' })).toBeNull();
    expect(zapScheduleTitle(null)).toBeNull();
  });

  it('appointmentOriginText: o rodapé do desfecho, com o Stronizap quando o agendamento veio de lá', () => {
    const at = new Date(2026, 8, 29, 15, 42);
    expect(appointmentOriginText({ at, by: 'Ana Souza', via: 'stronizap' })).toBe('Agendada em 29/09 por Ana Souza, pelo Stronizap');
    expect(appointmentOriginText({ at, by: 'Ana Souza' })).toBe('Agendada em 29/09 por Ana Souza');
    expect(appointmentOriginText({ at, via: 'stronizap' })).toBe('Agendada em 29/09, pelo Stronizap');
    expect(appointmentOriginText({ at: new Date('x') })).toBe('');
  });
});
```

Criar `src/lib/__tests__/profileZapSchedule.test.js`:

```js
// O agendamento feito pelo Stronizap aparece na ficha como o agendamento do
// assistente (a variante 3 da linha do tempo), com a marca do Stronizap antes
// do nome de quem agendou e o canal no detalhe ao passar o mouse (modelo A da
// spec). O desfecho que aponta para esse agendamento diz que ele veio do
// Stronizap. Mesma montagem de profileOriginMarker.test.js: o LeadProfileView
// lê window.location.origin no render, por isso o window falso.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// A linha do tempo de cada teste, mais recente primeiro, como o useLeadTimeline
// entrega.
const linha = vi.hoisted(() => ({ registros: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => linha.registros }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', status: 'Primeiro contato',
  createdAt: new Date(2026, 8, 1, 10, 0),
};

// O que a ponte grava quando a Ana agenda pelo Stronizap, no canal Recepção.
const AGENDA = {
  id: 'a1', type: 'note', volumeKind: 'visita', via: 'stronizap', zapChannelName: 'Recepção',
  text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 29, 15, 42),
};
// O mesmo agendamento, feito pelo assistente da ficha.
const AGENDA_DA_FICHA = { ...AGENDA, id: 'a2', via: undefined, zapChannelName: undefined };
// O comparecimento registrado pela Meta Diária.
const DESFECHO = {
  id: 'd1', type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', appointmentOutcome: 'attended',
  text: '✅ Compareceu — Meta Diária (Visita Hoje)', consultantName: 'Ana Souza', createdAt: new Date(2026, 9, 1, 18, 40),
};

const ficha = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead: LEAD, onTab: () => {}, onBack: () => {},
        appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
        statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
      }))));

const marcas = (html) => (html.match(/viewBox="0 0 240 240"/g) || []).length;

describe('agendamento feito pelo Stronizap na ficha', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 19, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('é o cartão de agendamento de sempre: título, hora, unidade e anotação', () => {
    linha.registros = [AGENDA];
    const html = ficha();
    expect(html).toContain('Visita à unidade');
    expect(html).toContain('Unidade Centro · Vem depois do trabalho.');
    expect(html).toContain('>Agendado<');
  });

  it('a marca do Stronizap vem antes do nome, e o canal fica no detalhe ao passar o mouse', () => {
    linha.registros = [AGENDA];
    const html = ficha();
    expect(html).toContain('title="Agendado pelo Stronizap, canal Recepção"');
    expect(marcas(html)).toBe(1);
    expect(html.indexOf('viewBox="0 0 240 240"')).toBeLessThan(html.indexOf('>Ana Souza<'));
  });

  it('sem o nome do canal, o detalhe diz só que foi pelo Stronizap', () => {
    linha.registros = [{ ...AGENDA, zapChannelName: null }];
    expect(ficha()).toContain('title="Agendado pelo Stronizap"');
  });

  it('agendamento feito na ficha continua sem a marca, com o nome no detalhe', () => {
    linha.registros = [AGENDA_DA_FICHA];
    const html = ficha();
    expect(marcas(html)).toBe(0);
    expect(html).toContain('title="Ana Souza"');
    expect(html).not.toContain('Agendado pelo Stronizap');
  });

  it('o desfecho aponta para o agendamento de origem e diz que ele veio do Stronizap', () => {
    linha.registros = [DESFECHO, AGENDA];
    const html = ficha();
    expect(html).toContain('>Compareceu<');
    expect(html).toContain('Agendada em 29/09 por Ana Souza, pelo Stronizap');
    expect(marcas(html)).toBe(2);
  });

  it('desfecho de agendamento feito na ficha: o rodapé de sempre, sem a marca', () => {
    linha.registros = [DESFECHO, AGENDA_DA_FICHA];
    const html = ficha();
    expect(html).toContain('Agendada em 29/09 por Ana Souza<');
    expect(html).not.toContain(', pelo Stronizap');
    expect(marcas(html)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js src/lib/__tests__/profileZapSchedule.test.js`
Expected: FAIL. No `timeline.test.js`, `3 failed | 49 passed`, com `zapScheduleTitle is not a function`; no `profileZapSchedule.test.js`, `4 failed | 2 passed` (já passam o cartão de sempre e o agendamento feito na ficha sem a marca). O "rodapé de sempre" também falha antes da mudança: o rodapé de hoje sai em três pedaços de texto (`Agendada em <!-- -->29/09<!-- --> por Ana Souza`), e o novo sai numa frase só.

- [ ] **Step 3: Os textos em `src/lib/timeline.js`**

No import da linha 6:

Trocar:

```js
import { ZAP_SIGNUP_TYPE } from './leads.js';
```

por:

```js
import { ZAP_SIGNUP_TYPE, ZAP_VIA } from './leads.js';
```

E, logo antes do comentário `// O marco de início fica embaixo de quem tem o mesmo horário que ele. O` (linha 65), acrescentar:

```js
// Agendamento gravado pelo Stronizap (api/zap.js, ação schedule): o detalhe
// que aparece ao passar o mouse no autor, com o canal da conversa. null
// quando o agendamento não veio do Stronizap.
export const zapScheduleTitle = (i) => {
  if (i?.via !== ZAP_VIA) return null;
  const canal = String(i?.zapChannelName || '').trim();
  return canal ? `Agendado pelo Stronizap, canal ${canal}` : 'Agendado pelo Stronizap';
};

// O rodapé do desfecho, que aponta para o agendamento de origem: "Agendada em
// 29/09 por Ana Souza", mais ", pelo Stronizap" quando ele veio de lá. `at` é
// o horário do agendamento, `by` quem agendou e `via` a origem.
export const appointmentOriginText = ({ at, by = null, via = null } = {}) => {
  const d = validDate(at);
  if (!d) return '';
  const quem = String(by || '').trim();
  return [
    `Agendada em ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
    quem ? ` por ${quem}` : '',
    via === ZAP_VIA ? ', pelo Stronizap' : ''
  ].join('');
};
```

- [ ] **Step 4: A marca num círculo, em `src/components/brand/StronizapMark.jsx`**

O comentário do topo (linhas 1 a 3):

Trocar:

```js
// Marca do Stronizap: o balão de conversa com o raio, no traçado do logo dele
// (viewBox 240). Vai no marco de início do lead cadastrado pelo Stronizap, do
// mesmo jeito que o Stronizap mostra a marca do Stronilead (StronileadMark).
```

por:

```js
// Marca do Stronizap: o balão de conversa com o raio, no traçado do logo dele
// (viewBox 240). Vai no marco de início do lead cadastrado pelo Stronizap e ao
// lado de quem agendou pelo Stronizap, do mesmo jeito que o Stronizap mostra a
// marca do Stronilead (StronileadMark).
```

E acrescentar no fim do arquivo:

```jsx
// A marca num círculo discreto, ao lado de um nome: na coluna do autor e no
// rodapé do desfecho de um agendamento feito pelo Stronizap, na linha do tempo
// da ficha.
export function StronizapBadge({ className }) {
  return (
    <span className={cn('grid size-[17px] shrink-0 place-items-center rounded-full bg-muted', className)}>
      <StronizapMark size={11} />
    </span>
  );
}
```

- [ ] **Step 5: A ficha, em `src/views/LeadProfileView.jsx`**

O import de `../lib/leads.js` (linha 10). Trocar:

```jsx
import { isAdminUser, canEditLead, isLeadConverted } from '../lib/leads.js';
```

por:

```jsx
import { isAdminUser, canEditLead, isLeadConverted, ZAP_VIA } from '../lib/leads.js';
```

O import da marca, logo depois do `ZapSignupMarker` (linha 42). Trocar:

```jsx
import { ZapSignupMarker } from '../components/profile/ZapSignupMarker.jsx';
```

por:

```jsx
import { ZapSignupMarker } from '../components/profile/ZapSignupMarker.jsx';
import { StronizapBadge } from '../components/brand/StronizapMark.jsx';
```

O fim do import de `../lib/timeline.js` (linhas 58 a 60). Trocar:

```jsx
  TIMELINE_SYSTEM_KIND,
  originLastOnTies
} from '../lib/timeline.js';
```

por:

```jsx
  TIMELINE_SYSTEM_KIND,
  originLastOnTies,
  zapScheduleTitle,
  appointmentOriginText
} from '../lib/timeline.js';
```

O comentário do `outcomeOrigin` (linhas 724 a 726). Trocar:

```jsx
  // O desfecho aponta de volta para o agendamento que o originou: o
  // agendamento mais recente ANTES dele. Dado real — não há campo ligando os
  // dois, mas a ordem cronológica resolve.
```

por:

```jsx
  // O desfecho aponta de volta para o agendamento que o originou: o
  // agendamento mais recente ANTES dele. Dado real — não há campo ligando os
  // dois, mas a ordem cronológica resolve. `via` diz se ele veio do Stronizap.
```

O agendamento de origem leva a origem (linha 736). Trocar:

```jsx
        if (lastScheduled) map[i.id] = { at: lastScheduled.createdAt, by: lastScheduled.consultantName };
```

por:

```jsx
        if (lastScheduled) map[i.id] = { at: lastScheduled.createdAt, by: lastScheduled.consultantName, via: lastScheduled.via ?? null };
```

O detalhe do autor, no começo do `renderTimelineEvent` (linhas 982 e 983). Trocar:

```jsx
    const typeLabel = timelineTypeLabel(i);
    const author = i.consultantName || 'Sistema';
```

por:

```jsx
    const typeLabel = timelineTypeLabel(i);
    const author = i.consultantName || 'Sistema';
    // Agendamento feito pelo Stronizap: a marca antes do nome e o canal no
    // detalhe ao passar o mouse (modelo A da spec do agendamento).
    const zapTitle = zapScheduleTitle(i);
```

O rodapé do desfecho (linhas 1134 a 1140). Trocar:

```jsx
          {/* O desfecho aponta de volta pro agendamento que o originou. */}
          {origin && (
            <div className="mt-[7px] pt-[7px] border-t border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-400 dark:text-slate-500">
              Agendada em {origin.at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              {origin.by ? ` por ${origin.by}` : ''}
            </div>
          )}
```

por:

```jsx
          {/* O desfecho aponta de volta pro agendamento que o originou. */}
          {origin && (
            <div className="mt-[7px] pt-[7px] border-t border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              {origin.via === ZAP_VIA && <StronizapBadge />}
              <span>{appointmentOriginText(origin)}</span>
            </div>
          )}
```

A coluna do autor (linha 1164). Trocar:

```jsx
        <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right truncate pt-0.5" title={author}>{author}</div>
```

por:

```jsx
        <div
          className={cn('text-[11px] text-slate-500 dark:text-slate-400 text-right truncate pt-0.5', zapTitle && 'flex items-center justify-end gap-[5px]')}
          title={zapTitle || author}
        >
          {zapTitle && <StronizapBadge />}
          {zapTitle ? <span className="truncate">{author}</span> : author}
        </div>
```

O `cn()` já é importado pela view (linha 26). Quando o registro não veio do Stronizap, a coluna do autor fica exatamente como era: a mesma classe, o `title` com o nome e o nome sem marca.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js src/lib/__tests__/profileZapSchedule.test.js src/lib/__tests__/profileOriginMarker.test.js src/lib/__tests__/profileTimeline.test.js && npx eslint src/lib/timeline.js src/components/brand/StronizapMark.jsx src/views/LeadProfileView.jsx src/lib/__tests__/timeline.test.js src/lib/__tests__/profileZapSchedule.test.js`
Expected: `Tests  69 passed (69)` (52 da linha do tempo, 6 da ficha nova, 8 do marco de início e 3 do dia e hora) e lint sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/lib/timeline.js src/components/brand/StronizapMark.jsx src/views/LeadProfileView.jsx src/lib/__tests__/timeline.test.js src/lib/__tests__/profileZapSchedule.test.js
git commit -m "feat: ficha mostra a marca do Stronizap em quem agendou por lá

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Documentação (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md` (do Stronilead, na raiz do worktree), seção "Ponte com o Stronizap"

Não mexer no `06-sistemas/CLAUDE.md` nem no `CLAUDE.md` da raiz da STRONIX-FIRMA: eles não são git e mudam só depois do recurso em produção (ver "Depois do merge", no fim).

- [ ] **Step 1: A lista de "Tudo cabe numa função só"**

Trocar o item:

```markdown
- `POST /api/zap` com `{ action: 'match' | 'lead-options' | 'create-lead' }` é do próprio Stronizap e autentica pela chave, igual ao `GET`. O `match` está descrito logo abaixo; as outras duas, em "Cadastro de lead pelo Stronizap".
```

por:

```markdown
- `POST /api/zap` com `{ action: 'match' | 'lead-options' | 'create-lead' | 'schedule-options' | 'schedule' | 'appointment-status' }` é do próprio Stronizap e autentica pela chave, igual ao `GET`. O `match` está descrito logo abaixo; as do cadastro, em "Cadastro de lead pelo Stronizap", e as do agendamento, em "Agendamento pelo Stronizap".
```

- [ ] **Step 2: O parágrafo "O `POST` tem dois donos"**

No parágrafo que começa com `**O \`POST\` tem dois donos.**`, trocar o trecho:

```markdown
`match`, `lead-options` e `create-lead` são do próprio Stronizap e autenticam pela chave, igual ao `GET`. O `match` recebe até 30 telefones
```

por:

```markdown
`match`, `lead-options`, `create-lead`, `schedule-options`, `schedule` e `appointment-status` são do próprio Stronizap e autenticam pela chave, igual ao `GET`. O `match` recebe até 30 telefones
```

E, no mesmo parágrafo, trocar:

```markdown
Apagar o desvio derruba os testes do `match`, das opções e do cadastro em `api/__tests__/zapRoute.test.js`
```

por:

```markdown
Apagar o desvio derruba os testes do `match`, do cadastro e do agendamento em `api/__tests__/zapRoute.test.js`
```

- [ ] **Step 3: A seção do agendamento**

Logo antes do parágrafo que começa com `**Casamento de telefone.**`, depois do último item do "Cadastro de lead pelo Stronizap" (o de "Erro inesperado sobe sem dado pessoal"), acrescentar:

```markdown
**Agendamento pelo Stronizap** (spec em `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`). O atendente agenda visita ou aula experimental de dentro da conversa, e o Stronilead grava o mesmo que o assistente de agendamento da ficha. As regras moram em `api/_zapSchedule.js`, puro e testado em `api/__tests__/zapSchedule.test.js`; a leitura e a gravação ficam em `api/zap.js`.

- **`schedule-options`** recebe `{ tenant, phone, actor: { email } }` e só lê. Devolve quem pede (`actor` com id, nome, papel e `countsForMeta`, que é consultor em dia da meta, no calendário de Brasília), os cadastros do número em `targets` (o do próprio número primeiro e depois os menores em ordem de nome, cada um com o agendamento atual), as unidades com o endereço, as modalidades, os professores ativos com as modalidades que dão, a quantidade de aulas (`normalizeTrialClassOptions`) e os cinco dias sugeridos (`days`, na regra do `wzDayOptions` do `ScheduleWizard.jsx`, mas no horário de Brasília). No menor, `relationship` é o parentesco visto por quem escreve: a mãe vê "Filho" ou "Filha" (`wardRelationship`, pelo campo Sexo), e sem sexo vai `null`, para não adivinhar o gênero.
- **`schedule`** recebe `{ tenant, phone, actor: { email, name }, channelName, schedule: { leadId, type, unit, modality, professorId, soloTraining, quantity, date, time, note } }`, com `date` (AAAA-MM-DD) e `time` (HH:MM) no horário de Brasília (`instanteDeBrasilia`), e responde `201 { card, appointment }`: o cartão do número relido depois da gravação e o `AppointmentDetail` (lead, tipo, instante, unidade com o endereço, modalidade, professor, "Treina sozinho", quantidade e desfecho). As recusas trazem `error`, `message` e, quando são de um campo, `field` com o nome do pedido: `dados_invalidos` (400), `academia_bloqueada` e `fora_da_equipe` (403), `lead_nao_confere`, `catalogo_mudou` e `horario_passado` (422), `ja_agendado` (409, com `card` e o `appointment` que já existia) e `limite` (429). Os textos moram em `ZAP_SCHEDULE_MESSAGES`; os de academia, equipe, telefone e canal são os do cadastro.
- **`appointment-status`** recebe `{ tenant, leadIds }`, de 1 a 30 ids sem repetir, e devolve `{ appointments }` com o `AppointmentDetail` de cada lead, ou `null` para quem não tem agendamento, teve o agendamento cancelado ou não existe na academia. É do lembrete do Stronizap, que confere o agendamento antes de enviar. Confere só a chave e o identificador, como o `GET` (`openByKey` com `checkBlocked: false`).
- **O que é gravado espelha o assistente**, numa transação só: o registro em `stronix_aulas` (a aula reaproveita o `currentAulaId` ainda agendado, e a visita, a primeira visita agendada do lead, como o `upsertScheduledAppointment`), a interação que o `logInteraction` gravaria (`type: 'note'`, `volumeKind`, o texto que o `parseAppointment` lê, o autor em `consultantName`, `actorId` e `actorAuthUid` e o dono nos campos de segurança) e o `buildSchedulePatch` no lead, com `lastInteractionAt` e `interactionsCount` mais um (`FieldValue.increment`). A interação leva também `via: 'stronizap'` (`ZAP_VIA`, em `src/lib/leads.js`) e `zapChannelName`. O dia e a hora do texto saem no horário de Brasília (`dataHoraDeBrasilia`), porque o navegador escreve no fuso da academia e a Vercel roda em UTC. Mudou o `handleWizardConfirm`, o `upsertScheduledAppointment` ou o `logInteraction`, mude o `api/_zapSchedule.js`. Agendar de novo pelo Stronizap faz o que o assistente faz, e não o Remarcar da Meta Diária (`rescheduleRecordPlan`): trocar de tipo não fecha o registro do tipo antigo.
- **A Meta Diária não muda**, porque lê o que o assistente grava: o ponto de volume vai para quem agendou (`actorAuthUid`), a tarefa do dia vai para o dono do lead, e o lead sai dos Atrasados e acende o "Já interagido hoje". O `src/lib/__tests__/zapScheduleTimeline.test.js` passa o que a ponte grava pela linha do tempo e pela Meta.
- **O servidor faz o que o assistente e as regras fariam**: academia ativa, pessoa da equipe pelo e-mail (o nome gravado é o do `stronix_users`), lead do próprio número ou menor de quem ele é responsável (`leadBelongsToNumber`, a mesma conta do cartão), unidade, modalidade, professor ativo que dá a modalidade ou "Treina sozinho" e quantidade das opções da academia (`checkScheduleCatalog`), horário no futuro e no máximo 60 agendamentos por hora por academia (`checkRateLimit`, chave `zap-schedule:<academia>`; o limite conta toda tentativa que passa do formato). O mesmo tipo no mesmo dia e horário, conferido dentro da transação, não grava de novo e responde `ja_agendado`: dois cliques, duas pessoas ou o "Tentar de novo" dão um registro e um ponto só.
- **O desfecho no cartão.** O `appointment` do cartão (`cardAppointment`, em `api/_zapCard.js`) leva `outcome`: `attended`, `no_show` ou `null`. `rescheduled` não é desfecho, e o agendamento cancelado sai do cartão. O "Cancelou" da Meta Diária já apaga a data do lead; o `writeAppointmentOutcome` sem `consumeAppointment` não apaga, e a regra cobre esse caminho.
- **Na ficha**, o agendamento continua o cartão de agendamento de sempre. Com `via: 'stronizap'`, a coluna do autor mostra a marca do Stronizap (`StronizapBadge`, em `src/components/brand/StronizapMark.jsx`) antes do nome e "Agendado pelo Stronizap, canal …" ao passar o mouse (`zapScheduleTitle`), e o rodapé do desfecho diz "Agendada em 29/09 por Ana Souza, pelo Stronizap" (`appointmentOriginText`, em `src/lib/timeline.js`).
- **Erro inesperado sobe sem dado pessoal**, pelo `scrubbedError`, como no cadastro.
- **O banco falso da rota** (`api/__tests__/zapRoute.test.js`) guarda `stronix_aulas`, lê documento de lista pelo id com o `id` no snapshot e soma o `FieldValue.increment`, como o SDK de servidor.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: agendamento pelo Stronizap no CLAUDE.md do Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Verificação completa

**Files:** nenhum

- [ ] **Step 1: Suíte, lint, build e Sentry**

```bash
npm test
npm run lint
npm run build
npm run verificar:sentry
```

Expected:
- `npm test`: tudo verde, com 4 arquivos e 213 testes a mais que no Task 0 (em cima de `84709e8`: `Test Files  149 passed (149)` e `Tests  3406 passed (3406)`);
- `npm run lint`: 0 erros. O aviso de `react-hooks/exhaustive-deps` em `src/views/superadmin/SuperAdminView.jsx` já existe na main;
- `npm run build`: `✓ built`, com o aviso de pedaço maior que 500 kB que a main já tem;
- `npm run verificar:sentry`: `rodada normal: OK` e `rodada sabotagem: OK`.

- [ ] **Step 2: Travas da casa**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
git diff origin/main --stat -- firestore.rules firestore.indexes.json vercel.json package.json package-lock.json
```

Expected: `11` funções, e nenhuma mudança em regras, índices, Vercel ou dependências.

- [ ] **Step 3: Reler o diff contra a spec**

Run: `git diff origin/main --stat`
Expected: só os arquivos do "Mapa de arquivos", mais os planos em `docs/`. Releia as seções "No Stronilead", "A ponte", "O desfecho no cartão" e "O contrato da ponte" da spec contra o diff.

---

### Task 16: PR e o teste de verdade

**Files:** nenhum

- [ ] **Step 1: Abrir o PR (sem merge; o merge é do Johnny)**

```bash
git push -u origin claude/agendamento-pelo-zap
gh pr create --base main --title "feat: agendamento pelo Stronizap (Stronilead)" --body "$(cat <<'EOF'
O Stronizap passa a agendar visita e aula experimental de dentro da conversa. Este PR é a metade do Stronilead: as três ações novas do `POST /api/zap`, o desfecho no cartão e a marca do Stronizap na ficha.

- `schedule-options`: quem pede (pelo e-mail da sessão do Stronizap), os cadastros do número (o próprio e os menores de quem ele é responsável), as unidades, as modalidades, os professores ativos, a quantidade de aulas e os cinco dias sugeridos, no horário de Brasília
- `schedule`: confere academia ativa, equipe, lead do número, catálogo, horário no futuro e o limite de 60 por hora; grava numa transação só o registro de aulas, a interação e o lead, o mesmo que o assistente da ficha grava; o mesmo agendamento de novo responde `ja_agendado`, sem gravar e sem outro ponto na Meta
- `appointment-status`: o agendamento de até 30 leads, para o lembrete do Stronizap conferir antes de enviar
- cartão: a linha do agendamento leva o desfecho (compareceu ou faltou), e o cancelado sai
- ficha: a marca do Stronizap antes de quem agendou, o canal ao passar o mouse e "pelo Stronizap" no rodapé do desfecho
- nenhuma função nova na Vercel (continuam 11) e nada a publicar no Firestore (regras iguais, consultas de campo único)

**Pode entrar antes dos PRs do Stronizap:** as ações ficam paradas até alguém chamar.

Pontos para o Johnny olhar, nas notas de abertura do plano: o parentesco do "Para quem?" ("Filho" ou "Filha", pelo campo Sexo do menor, e nada quando o sexo não foi preenchido) e os textos das recusas, que a spec não trazia.

Spec: `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`
Plano: `docs/superpowers/plans/2026-09-29-agendamento-zap-pr1-stronilead.md`

Verificação: `npm test`, `npm run lint`, `npm run build` e `npm run verificar:sentry` verdes. O teste de verdade vem com o PR do agendamento no Stronizap.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: o link do PR. Não fazer merge.

- [ ] **Step 2: Depois do merge (Johnny)**

1. Confira na Vercel que o deploy da main terminou (Ready).
2. Nada muda para quem usa o Stronilead enquanto o Stronizap não chamar as ações. Abra a ficha de um lead com agendamento feito pelo assistente e confira que a linha do tempo está como antes: o cartão de agendamento, o nome na coluna do autor sem marca e o rodapé "Agendada em … por …" no desfecho.

- [ ] **Step 3: O teste de verdade, com o PR do agendamento no Stronizap no ar**

Na STRONIX, com um contato de teste que já é lead:
- agende uma visita pelo "Agendar" do Stronizap: na ficha do Stronilead, o cartão de agendamento aparece com a marca do Stronizap antes do seu nome, e ao passar o mouse aparece "Agendado pelo Stronizap, canal …"; em Aulas e Visitas, a visita aparece no dia marcado;
- confira a Meta Diária de quem agendou (o ponto de volume) e a do dono do lead no dia (a tarefa em Visitas);
- agende de novo o mesmo dia e horário: nada novo na ficha;
- remarque para outro dia: a ficha ganha outro registro, e Aulas e Visitas mostra a data nova;
- registre "Compareceu" na Meta Diária: o cartão do Stronizap passa a mostrar "Compareceu", e o desfecho na ficha diz "Agendada em … por …, pelo Stronizap";
- repita com uma aula experimental, com professor e com "Treina sozinho";
- confira a marca no tema escuro.

Defeito do lado do Stronilead vira PR novo aqui, no mesmo formato deste plano.

---

## Depois do merge (fora deste plano)

Com o PR do agendamento no Stronizap também em produção e o teste da STRONIX feito, atualizar os dois `CLAUDE.md` de fora do repositório (não são git):

1. `~/STRONIX-FIRMA/06-sistemas/CLAUDE.md`, seção "Ponte Stronilead ↔ Stronizap":
   - um parágrafo **Agendamento pelo Stronizap.**, no molde do **Cadastro de lead pelo Stronizap.**: o "Agendar" do cabeçalho da conversa abre o balão passo a passo, as listas e os dias vêm do Stronilead a cada abertura (ações `schedule-options`, `schedule` e `appointment-status` do `POST /api/zap`), a gravação é a do assistente da ficha numa transação só, a ficha mostra a marca do Stronizap ao lado de quem agendou, a Meta Diária conta o ponto para quem agendou, o cartão mostra o desfecho, e a data do texto sai no horário de Brasília. Com os números dos PRs e a spec (`stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`);
   - na tabela "Os arquivos que formam o contrato", o `api/_zapSchedule.js` na linha do Stronilead;
   - no parágrafo do smoke, que ele passa a conferir também as opções do agendamento e nunca agenda.
2. `~/STRONIX-FIRMA/CLAUDE.md`, tabela "Últimas Atualizações": uma linha com a data do deploy, no molde das linhas do cadastro de lead pelo Stronizap, dizendo o que o atendente passou a fazer, os PRs do `crm-stronix` e do `whatsapp-stronix` e o que ficou para o lembrete (PR 3).

O lembrete (PR 3) tem o próprio passo de documentação no plano dele.
