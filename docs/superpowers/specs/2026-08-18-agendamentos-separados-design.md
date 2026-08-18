# Agendamento separado do próximo contato — design

status: ativo
data: 2026-08-18
autor: Johnny + Claude

## O problema

Johnny relatou: agendar uma aula experimental e, logo em seguida, agendar uma
mensagem de confirmação de comparecimento faz a aula **sumir** da tela de Aulas
Experimentais, sobrando só a mensagem.

Confirmado, e vale igual para visitas.

### Causa raiz

O documento do lead tem **uma única vaga de agendamento**: `appointmentType` e
`appointmentScheduledFor`. Todo agendamento feito pelo wizard reescreve essa
vaga inteira.

1. `normalizeAppointmentType` (`src/lib/dates.js:30-36`) só reconhece "aula" e
   "visita". Para `'Mensagem'` devolve `null`.
2. O patch do wizard (`src/views/LeadProfileView.jsx:481-482`) grava:
   ```js
   appointmentType: appointmentType || null,
   appointmentScheduledFor: appointmentType ? date : null,
   ```
   As linhas 475-480 ainda zeram modalidade, professor, quantidade e unidade.
3. A gravação é `set(..., { merge: true })` em `src/lib/interactions.js:45-53`.
   `merge` ignora campo **ausente**; `null` é valor presente e sobrescreve.

Na leitura, a tela de Aulas/Visitas consulta o Firestore por
`appointmentType == 'aula_experimental'` mais range em `appointmentScheduledFor`
(`src/lib/leadQueries.js:181-188`, usado em
`src/views/AppointmentTrackingView.jsx:226`). Com os campos nulos o documento é
excluído no servidor. Some da tela de Aulas, da Meta Diária
(`src/lib/dailyGoal.js:351-365`) e da Agenda do Dia
(`src/hooks/useDayAgenda.js:37-38`).

Ligação faz o mesmo estrago que Mensagem. A ordem inversa também perde: agendar
aula depois de uma mensagem sobrescreve o `nextFollowUp` da mensagem.

### O que sobrevive hoje

Não é perda total. A nota "🔔 Aula Experimental agendada..." fica na linha do
tempo, o registro em `stronix_aulas` continua "agendada" na data original e o
`currentAulaId` é preservado. A conversão por professor do Gerencial ainda
enxerga a aula. A perda é operacional: a aula some de onde o consultor trabalha.

### Outros dois caminhos com o mesmo apagamento

`contactReschedule` (`src/lib/contactGoal.js:38-49`) e `commitNextContact`
(`src/views/DailyGoalView.jsx:1296-1300`) zeram os mesmos campos de propósito.
Reagendar um contato pela Meta apaga uma aula futura do mesmo jeito.

O time já tinha identificado o risco em um lugar: o comentário em
`src/views/DailyGoalView.jsx:1329-1331` diz que ali se limpa só o `nextFollowUp`
"para nunca apagar uma visita/aula futura legítima". A blindagem existe num
caminho e falta nos outros três.

### Buraco vizinho encontrado na exploração

O wizard pergunta *quantas* aulas e salva `trialClassesPlanned`, mas guarda uma
data só (`src/components/profile/ScheduleWizard.jsx:34`). Quem combina 3 aulas
tem 3 no papel e 1 na agenda. Fora do escopo deste spec, mas o modelo novo abre
o caminho.

## Decisões (Johnny, 2026-08-18)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Abordagem | **Separação estrutural**, não o conserto mínimo. |
| 2 | O que vira registro | Só compromisso formal: **visita e aula**. Mensagem e ligação seguem como próximo contato no lead, via `nextFollowUp`. |
| 3 | Onde os registros moram | **Generalizar `stronix_aulas`** com um campo `type`. Sem coleção nova, sem regra nova, sem mover documento. |
| 4 | O que o lead guarda | **Espelho derivado** do próximo compromisso em aberto. As telas e relatórios seguem lendo o lead. |
| 5 | Tela de Aulas/Visitas | **Continua lendo o espelho.** Não passa a ler a coleção. |
| 6 | Base atual | **Backfill único agora**, no molde do `scripts/backfill-aulas.js`. |
| 7 | Caminhos da Meta | Corrigidos **no mesmo PR** da virada. |

### Por que generalizar em vez de coleção nova

Critério do Johnny: o que menos quebra relatório e menos gera bug.

- **Coleção nova** obrigaria a migrar todo o histórico de aulas. Backfill que
  perde documento faz a conversão por professor perder histórico em silêncio.
  Soma uma regra publicada à mão em produção, passo que já apareceu várias vezes
  como pendência neste repo.
- **Subcoleção no lead** exige `collectionGroup` com escopo por consultor nas
  regras. Errar ali é consultor vendo dado alheio, ou `permission-denied`
  derrubando a tela.
- **Generalizar** não move documento, não muda regra, não toca histórico. O
  único risco é visita se passando por aula na conversão por professor, que é o
  mais contido e o mais testável dos três.

## Modelo de dados

`stronix_aulas` ganha dois campos, em `aulaRecordFields` (`src/lib/aulas.js`):

| Campo | Valores | Observação |
|---|---|---|
| `type` | `'aula'` \| `'visita'` | **Ausente significa `'aula'`.** Todo documento histórico continua valendo sem ser tocado. |
| `unit` | string \| null | Unidade da visita, espelhando o `appointmentUnit` de hoje. Null em aula. |

Campos que só fazem sentido em aula (`professorId`, `professorName`,
`soloTraining`, `modality`, `converted`, `convertedAt`) ficam nulos ou `false`
em visita.

Índice novo em `firestore.indexes.json` (sai por CLI, não é passo manual):

```json
{
  "collectionGroup": "stronix_aulas",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "scheduledFor", "order": "ASCENDING" }
  ]
}
```

Nenhuma mudança em `firestore.rules`. A regra atual
(`firestore.rules:184-191`) já cobre a coleção inteira.

## A regra do espelho

Função pura nova, `pickMirrorAppointment(registros, agora)`, em
`src/lib/aulas.js`. Três regras, nesta ordem:

1. **Em aberto de hoje em diante** (`status === 'agendada'` e
   `scheduledFor >= início de hoje`): pega o **mais próximo**.
2. **Em aberto atrasado** (`status === 'agendada'`, todos no passado): pega o
   **mais recente**, que é o que está esperando desfecho.
3. **Nenhum em aberto**: pega o último resolvido como `attended` ou `no_show`,
   pelo maior `scheduledFor`. **`cancelled` nunca entra no espelho.**

Sem registro que se encaixe, o espelho fica nulo.

A regra 3 preserva a regra do Johnny escrita em
`src/lib/appointmentOutcome.js:90-100`: comparecimento mantém a pessoa na tela
de Aulas/Visitas, cancelamento remove. `no_show` continua aparecendo, que é o
comportamento de hoje.

A regra 2 evita que uma visita esquecida de três semanas atrás segure o espelho
e esconda a aula marcada para amanhã.

### Mudança sutil de comportamento

Hoje o **último agendamento escrito** ganha o espelho. Depois, o **mais
próximo** ganha. Para lead com um compromisso só, que é a esmagadora maioria da
base, é idêntico. Aprovado pelo Johnny com essa ressalva explícita.

### Campos do espelho

O que `pickMirrorAppointment` alimenta no documento do lead:

`appointmentType`, `appointmentScheduledFor`, `appointmentModality`,
`appointmentProfessorId`, `appointmentProfessorName`, `appointmentSoloTraining`,
`appointmentUnit`, `appointmentOutcome`, `appointmentOutcomeAt`, `currentAulaId`.

## Quem escreve o quê

**Recalculam o espelho** (leem os registros do lead, aplicam
`pickMirrorAppointment`, gravam):

| Caminho | Arquivo |
|---|---|
| Criar agendamento no wizard (visita/aula) | `src/views/LeadProfileView.jsx` `handleWizardConfirm` |
| Reagendar pela Meta | `src/views/DailyGoalView.jsx` `handleReschedule` |
| Dar desfecho | `src/lib/appointmentOutcome.js` `writeAppointmentOutcome` |
| Desfazer desfecho | atalho da tela de Aulas (`clearAulaOutcome`) |

**Não encostam no espelho** (passam a escrever só `nextFollowUp`,
`nextFollowUpType` e `nextFollowUpNote`):

| Caminho | Arquivo |
|---|---|
| Mensagem/Ligação no wizard | `src/views/LeadProfileView.jsx:469-490` |
| Reagendar contato (modal de desfecho) | `src/lib/contactGoal.js` `contactReschedule` |
| Próximo contato pela Meta | `src/views/DailyGoalView.jsx` `commitNextContact` |

É nesses três que o bug morre, de uma vez.

## O ajuste obrigatório na Meta Diária

A categoria "Contato Hoje" hoje se esconde quando o lead tem visita ou aula no
espelho (`src/lib/dailyGoal.js:383-385`):

```js
const apptType = getLeadAppointmentType(lead);
if (apptType !== 'visita' && apptType !== 'aula_experimental') { ... }
```

Isso só não incomoda hoje porque a mensagem apagava o compromisso. Preservando o
compromisso, a mensagem sumiria da Meta e o consultor perderia a tarefa.

**A troca:** em vez de comparar o **tipo**, comparar a **data**. O contato
aparece quando o `nextFollowUp` é hoje **e** o `appointmentScheduledFor` do
espelho não cai hoje. Lead sem compromisso nenhum tem o espelho nulo e continua
recebendo a tarefa de contato normalmente, que é o caso mais comum da base.

Quando `nextFollowUp` e `appointmentScheduledFor` caem no mesmo dia, as
categorias 3 e 4 (visita/aula hoje) já cobrem o lead, e nada duplica.

Em pseudocódigo, o que substitui o teste de tipo:

```js
const apptDate = getLeadAppointmentDate(lead);
const apptIsToday = apptDate && apptDate >= todayStart && apptDate <= todayEnd;
if (!apptIsToday) { addTarget(lead, ..., CONTATO_HOJE); }
```

## A armadilha da contaminação

Com visitas na mesma coleção, tudo que hoje assume "todo documento aqui é aula"
precisa filtrar. Um helper único em `src/lib/aulas.js`:

```js
export const isAulaRecord = (rec) => (rec?.type ?? 'aula') === 'aula';
```

Pontos que precisam do filtro:

| Função | Arquivo | O que quebra sem o filtro |
|---|---|---|
| `pickConvertingAula` | `src/lib/aulas.js` | Visita "compareceu" vira a aula que levou a conversão |
| `markConvertingAula` | `src/lib/aulasWrites.js` | Carteira do professor carimbada errada, ou crédito da aula real perdido |
| `unmarkConvertedAula` | `src/lib/aulasWrites.js` | Desfaz conversão em documento errado |
| `useAulasInWindow` | `src/hooks/useAulasInWindow.js` | Conversão por professor do Gerencial conta visita como aula |

`applyOutcomeToAula` já tem a guarda `outcomeAppliesToAula` no chamador
(`src/lib/appointmentOutcome.js:104`), que resolve o mesmo problema pelo lado do
desfecho. Segue valendo.

Falha aqui é silenciosa: relatório errado sem erro na tela. Por isso os testes
de contaminação são obrigatórios, não opcionais.

## Rollout em dois PRs

O backfill precisa rodar entre o dual-write e a virada, mesmo desenho das PRs
#143 e #144.

**PR 1 — preparação, sem mudança de comportamento**
1. `type` e `unit` em `aulaRecordFields`
2. Visita passa a gerar registro em `upsertScheduledAula` (dual-write)
3. `isAulaRecord` e os quatro filtros de contaminação
4. Índice `type` + `scheduledFor` em `firestore.indexes.json`
5. `scripts/backfill-appointments.js` escrito, **não rodado**

**Entre os PRs:** backfill roda em produção. Cria registro para todo lead com
compromisso no espelho e sem registro correspondente, cobrindo principalmente as
visitas, que hoje não têm nenhum. Carimba `type: 'aula'` nos registros
existentes.

**PR 2 — a virada**
1. `pickMirrorAppointment` e o recálculo nos quatro caminhos de escrita
2. Mensagem e ligação param de tocar no espelho, nos três caminhos
3. Ajuste da categoria "Contato Hoje" na Meta
4. Testes de regressão do cenário relatado

## Testes

| Teste | Cobre |
|---|---|
| `pickMirrorAppointment` nos 5 casos (aberto futuro, aberto atrasado, só resolvido, cancelado, vazio) | Regra do espelho |
| Visita não aparece em `pickConvertingAula` nem em `markConvertingAula` | Contaminação |
| Visita não entra na conversão por professor do Gerencial | Contaminação |
| Aula agendada + mensagem agendada convivem (o cenário relatado) | Regressão do bug |
| Visita agendada + mensagem agendada convivem | Regressão do bug |
| Contato de hoje aparece na Meta com aula futura no lead | Ajuste da categoria 5 |
| `contactReschedule` e `commitNextContact` preservam aula futura | Os outros dois caminhos |
| Comparecimento mantém o lead na tela; cancelamento remove | Regra do Johnny |

O teste de reprodução já existe e vira regressão
(`scratchpad/repro-agendamento-sobrescrito.test.js`).

## Fora de escopo

- **Pacote de N aulas em N datas.** O modelo passa a suportar, a interface não
  muda neste trabalho.
- **Mensagem e ligação como registro.** Decisão 2. Ficam no `nextFollowUp`.
- **Tela de Aulas/Visitas lendo a coleção.** Decisão 5. Exigiria duplicar campo
  de lead dentro do registro ou uma leitura por lead na tela, contra o trabalho
  de escala das PRs #143 e #144.
- **Renomear a coleção.** O nome `stronix_aulas` fica impreciso e isso é
  aceito. Renomear é migração completa, sem ganho operacional.

## Riscos aceitos

| Risco | Mitigação |
|---|---|
| Visita contaminando relatório de professor | `isAulaRecord` num lugar só, mais testes de contaminação obrigatórios |
| Espelho divergindo dos registros | Espelho é recalculável a partir dos registros; backfill fecha a base atual |
| Backfill incompleto | Não move nada, só cria o que falta. Rodar duas vezes é seguro (idempotente por `leadId` + `scheduledFor`) |
| Lead com visita e aula no mesmo período | Espelho mostra só a mais próxima. Comportamento de hoje, não é regressão |
