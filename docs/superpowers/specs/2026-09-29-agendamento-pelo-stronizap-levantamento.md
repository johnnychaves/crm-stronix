---
status: rascunho
---

# Agendamento pelo Stronizap: levantamento do código

Levantamento feito em 29/09/2026 na `main` do Stronilead (`68c4f4c`), para o projeto 2: agendar visita e aula experimental de dentro do Stronizap. Não é spec. É o ponto de partida do desenho, que começa depois do cadastro de lead pelo Stronizap (`2026-09-29-cadastro-de-lead-pelo-stronizap-design.md`).

## O assistente de agendamento (`src/components/profile/ScheduleWizard.jsx`)

- **Visita:** Unidade e depois Dia e horário. As unidades vêm de `stronix_units` e ficam gravadas pelo nome.
- **Aula experimental:** Modalidade, Professor, Quantas aulas e Dia e horário.
  - As modalidades vêm de `stronix_modalities`, gravadas pelo nome.
  - Os professores vêm de `stronix_professores`, filtrados por `modalidadeIds`, mais a opção "Treina sozinho" (`'__solo__'`).
  - A quantidade vem de `trialClassOptions` em `stronix_config/general`, padrão 1, 2 e 3. O freepass trata esse número como dias.
- **Dia e horário:** cinco cartões (Hoje, Amanhã e dias da semana), só nos dias de `metaWeekdays`. Depois das 18h, os cartões começam amanhã. A hora padrão é 18:00 para hoje e 09:00 para os outros dias. Existe também um campo manual, sem data mínima.
- **Anotação:** opcional.
- Não há conferência de data passada, horário de funcionamento, capacidade ou conflito.

## A gravação (`handleWizardConfirm` em `src/views/LeadProfileView.jsx`)

1. **Registro em `stronix_aulas`**, sem transação e com a falha só registrada no console.
   - A aula reaproveita o `currentAulaId` que está agendado. A visita procura a primeira visita agendada do lead.
   - Os campos saem de `aulaRecordFields` (`src/lib/aulas.js`). Os campos de consultor são copiados do dono do lead.
   - Não existe campo de quem agendou.
2. **Um `writeBatch`** (`logInteraction` em `src/lib/interactions.js`):
   - uma interação `type: 'note'` com o texto `🔔 {Visita|Aula Experimental} agendada{extra} p/ dd/mm/aaaa, HH:MM.{ Obs: nota}`, `volumeKind` (`'visita'` ou `'aula_experimental'`), `actorId` e `actorAuthUid`;
   - no lead, `lastInteractionAt`, `interactionsCount` mais um e `buildSchedulePatch` (`src/lib/schedulePatch.js`, puro).

O texto da interação precisa continuar legível por `parseAppointment` (`src/lib/timeline.js`).

Agendar não muda a fase do lead. O `pickMirrorAppointment` ainda não está ligado, porque a segunda PR da spec de agendamentos separados não saiu, e o último agendamento gravado ganha os campos do lead.

Existe um segundo caminho: o Remarcar da Meta Diária (`src/views/DailyGoalView.jsx`), com o texto "🔄 Remarcou…".

## Quem pode e quem ganha crédito

- **Papéis:** `admin` (gestor) e `consultant`. Os dois agendam qualquer lead da academia.
- **Cliente:** pode agendar, para vender outra modalidade.
- **Lead perdido:** pode agendar e continua em Perda.
- **Crédito:**
  - só a meta de volume credita quem agendou, por `interactionOwnerAuthUid`, que é `actorAuthUid`, depois `consultantAuthUid` e depois `leadConsultantAuthUid` (`src/lib/dailyGoal.js`);
  - todo o resto credita o dono do lead;
  - `actorAuthUid` nulo cai no dono do lead, e um id que não é da equipe some da conta.

## No servidor

- A ação nova entra em `api/zap.js`, ao lado do `match` e das duas ações do cadastro. Não há função nova na Vercel, que está em 11 de 12.
- **Módulos puros, que o servidor pode importar:** `schedulePatch`, `aulas`, `dates`, `leads`, `professores`, `leadStatus`, `timeline`, `stageMove` e `dayAgenda`.
- **Precisam de uma versão de servidor:** `aulasWrites` e `interactions`, que usam o SDK do navegador.
- **Nunca importar no servidor:** `dailyGoal`, porque ele puxa o `lucide-react`.
- Em `api/`, `snap.exists` é propriedade, não função.
- O `firebase-admin` passa por cima das regras. A conferência de academia ativa do cadastro serve aqui também.
- **Fuso:** a Vercel roda em UTC. A data precisa ser montada com -03:00 explícito, e o texto precisa ser formatado em America/Sao_Paulo. O cartão já foi corrigido na PR #227 (`api/_horarioDeBrasilia.js`).
- **Qual lead:** um telefone pode casar o dono e os menores, então o agendamento precisa receber o id do lead, conferido contra o telefone.

## No Stronizap

- O único agendamento que existe hoje é o de mensagem (`ScheduleDialog.tsx`). O calendário dele (react-day-picker 8.10) não recebe o idioma e mostra os meses em inglês.
- O cartão de cliente não tem a linha de Agendamento.
- O cadastro de lead já resolve a troca do cartão guardado depois de uma gravação e o aviso para quem está com o contato aberto. O agendamento reaproveita isso.

## O que o desenho do agendamento vai ter que decidir

- Quem ganha o ponto de volume do agendamento feito pelo Stronizap.
- Se o Stronizap oferece a mensagem de confirmação para o lead já escrita na caixa de digitar, sem enviar sozinho.
- Se a hora padrão e os cinco cartões de dia seguem o assistente do Stronilead.
- Se o cartão de cliente passa a mostrar o agendamento.
