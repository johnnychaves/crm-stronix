# Agendamento pelo Stronizap · PR 3 (Stronizap, lembrete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Stronizap envia sozinho, antes da visita ou da aula experimental agendada pela conversa, um lembrete com o texto que a academia configurou, e confere no Stronilead, antes de enviar, se o agendamento continua no mesmo dia e horário.

**Architecture:** O lembrete é uma mensagem agendada comum da conversa (`status: SCHEDULED` e `scheduledFor`) com um campo novo, `crmReminder`, que a liga ao agendamento. Duas contas puras decidem quando ele sai (`crm-reminder-time.ts`) e o que ele diz (`crm-reminder-text.ts`). O `crm-reminder.service.ts` cria e troca o lembrete, confere com o Stronilead pela ação `appointment-status` (`fetchCrmAppointmentStatus`, no `crm.service.ts`) numa varredura de 15 em 15 minutos e de novo na hora de enviar, e deixa nota interna em cada mudança. O agendador de mensagens passa a esperar essa conferência antes de enviar um lembrete e a deixar o lembrete sair em conversa encerrada. A configuração mora em campos novos da `Organization`, que só o admin edita, em Configurações → Stronilead.

**Tech Stack:** Node 20+, TypeScript, Express 4, Prisma 5 (PostgreSQL, campo `Json`), Zod, Socket.IO (back: testes com `node:test` e tsx, e a suíte de isolamento contra banco de verdade); React 18, Vite, Radix (`Switch`), Vitest com jsdom (front).

**Spec:** `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` (fonte da verdade), seções "O lembrete (PR 3)", "Testes → Stronizap, lembrete", "Publicação" (passo 3) e "Critérios de aceitação". Mockups aprovados: `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-mockup.html`, seções 2 (o bloco do lembrete no resumo do balão), 3 (a conversa), 4 (a configuração) e 5 ("Sem tempo para lembrete" e "Remarcado ou cancelado no Stronilead").

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronizap` (remoto `johnnychaves/whatsapp-stronix`). A execução acontece nesse repositório, num branch próprio criado a partir da `main` **depois que o PR 2 (agendamento no Stronizap) for mesclado** (Task 0). Todos os caminhos abaixo são relativos à raiz desse repositório. O plano foi levantado sobre `origin/main` em `78f36d3` (29/09/2026), antes do PR 2.

**Depende de dois PRs:**
- **PR 1 (Stronilead) no ar**, com a ação `appointment-status` no `POST /api/zap`. Sem ela, toda conferência volta sem resposta e nenhum lembrete sai (cada um é apagado com a nota de "não respondeu" 30 minutos depois da hora dele). Por isso o deploy deste PR vem depois do PR 1 publicado pela Vercel.
- **PR 2 (agendamento no Stronizap) mesclado.** Este PR usa o que o PR 2 cria: o tipo `CrmAppointmentDetail` e as três funções de texto (`dayPhrase`, `hourPhrase` e `firstName`), além do serviço e do balão do agendamento, que as Tasks 18 a 21 estendem.

**Números de linha:** os que o plano cita são os do arquivo em `78f36d3`, antes de qualquer edição. O PR 2 mexe em `backend/src/services/crm.service.ts`, `backend/src/services/crm-lead.service.ts`, `backend/src/routes/conversations.routes.ts`, `backend/src/routes/tenant-isolation.spec.ts` e no front. Nesses arquivos, e sempre que uma task mexe em vários pontos do mesmo arquivo, guie-se pelo trecho citado, que é único, e não pelo número.

---

## O que este plano usa do contrato entre os três PRs

O contrato foi fixado antes dos três planos. Repito aqui, com as minhas palavras, só a parte que este PR usa.

1. **A ação `appointment-status` (PR 1).** `POST /api/zap` com a chave no header `x-stronizap-key`, igual ao `match`, ao `lead-options` e ao `create-lead`. Corpo: `{ "action": "appointment-status", "tenant": "<identificador da academia>", "leadIds": ["L1", "L2"] }`, com 1 a 30 ids, em texto e sem repetir (id repetido é `dados_invalidos`, 400). Resposta 200: `{ "appointments": { "L1": { ...AppointmentDetail }, "L2": null } }`. Todo id pedido aparece como chave. O valor é `null` quando o lead não existe na academia, quando não tem agendamento e quando o agendamento foi cancelado. A ação só lê e não tem limite próprio.
2. **O `AppointmentDetail`.** `{ leadId, leadName, type, at, unit, unitAddress, modality, professorName, soloTraining, quantity, outcome }`, com `type` igual a `visita` ou `aula_experimental`, `at` em ISO e `outcome` igual a `attended`, `no_show` ou `null`. O desfecho `rescheduled` já chega como `null`, porque o lead está com a data nova, e `cancelled` faz o agendamento inteiro chegar como `null`. `unitAddress` é o endereço de agora da unidade, procurado pelo nome, e alimenta o `[endereco]`.
3. **`fetchCrmAppointmentStatus` é deste PR**, no `backend/src/services/crm.service.ts`, no molde de `fetchCrmLeadOptions`, com tempo máximo de 4 segundos.
4. **O texto em `backend/src/services/crm-appointment-text.ts` (o PR 2 cria).** Módulo puro, sempre no horário de Brasília (`America/Sao_Paulo`), nunca no fuso do processo: `dayPhrase(at: Date, reference: Date): string` devolve "hoje (29/09)", "amanhã, quarta-feira (30/09)" ou "quinta-feira (01/10)", relativo ao dia de `reference`; `hourPhrase(at: Date): string` devolve "18h" em hora cheia e "18h30" nos outros casos; `firstName(name: string | null | undefined): string | null` devolve a primeira palavra de um nome de verdade e `null` para vazio ou para nome que é telefone. Este PR usa as três para `[dia]`, `[hora]`, `[primeiro_nome]`, `[professor_da_aula]` e `[meu_primeiro_nome]`, e não recria nenhuma.
5. **O tipo `CrmAppointmentDetail` (o PR 2 cria)** em `backend/src/services/crm.service.ts`: o `AppointmentDetail` acima, com `type: 'visita' | 'aula_experimental'`, `at: string` e `outcome: 'attended' | 'no_show' | null`.
6. **O serviço `backend/src/services/crm-schedule.service.ts` (o PR 2 cria, este PR estende).** `scheduleCrmAppointment(...)` atende o `POST /api/conversations/:id/crm-schedule` e devolve `{ card, appointment, confirmationText, alreadyScheduled }`. O contrato diz que o corpo do `POST` é o objeto `schedule` do pedido ao Stronilead; o PR 2 o recebe embrulhado, `{ schedule }` (`crmScheduleBodySchema`), e `tenant`, `phone`, `actor` e `channelName` saem do servidor. Este PR acrescenta ao corpo um campo opcional `reminder`, ao lado do `schedule`, e à resposta o `reminderFailed` e, depois do sucesso, inclusive quando `alreadyScheduled` é `true`, cria ou troca o lembrete (Task 18).
7. **O balão (o PR 2 cria, este PR estende).** O PR 2 põe o resumo e o rodapé do balão num componente próprio, e este PR insere o bloco do lembrete entre o resumo e a "Anotação (opcional)" (Task 20).

---

## Notas antes de começar

A spec deixou alguns pontos em aberto, e o código de hoje decide outros. Cada decisão abaixo é a menor solução fiel à spec.

1. **O que o `crmReminder` guarda.** Um JSON (`CrmReminderData`, Task 7) com os dados que a spec lista: o lead (`leadId`), o primeiro nome de quem vai (`attendeeFirstName`) e se é menor (`isWard`), o tipo (`type`), o horário do agendamento (`appointmentAt`), se o texto foi mudado à mão (`customText`) e quando o lembrete foi conferido pela última vez (`checkedAt`). Um campo a mais, `unansweredSince`, marca que o Stronilead não respondeu na hora de enviar, para a nota final dizer o motivo certo (nota 6).
2. **A faixa das 8h às 21h é inclusiva nas duas pontas.** A hora da véspera vai de 08:00 a 21:00 na configuração, então só o modo "N horas antes" cai fora da faixa. Aí o lembrete sai às 20h do dia anterior ao agendamento, como a spec manda, e o balão passa a dizer "na véspera".
3. **Sem lembrete.** A hora do lembrete que já passou é `hora_passada`, e a que falta menos de 30 minutos é `em_cima_da_hora`. Os dois viram "Sem lembrete" com o motivo no balão (Task 20) e nenhum lembrete na criação.
4. **A conferência.** Sem agendamento, com outro tipo ou com desfecho registrado: cancela. Mesmo tipo e mesmo horário: fica, e o texto padrão é remontado com os dados de agora, sem nota, porque nada mudou para quem recebe (a spec pede nota quando o lembrete muda de hora ou é cancelado). Mesmo tipo e horário novo: com o texto padrão, é refeito com a configuração de agora da academia; com o texto mudado à mão, é cancelado; refeito para uma hora que já passou, ou a menos de 30 minutos, é cancelado.
5. **As notas.** Na varredura, o lembrete cancelado deixa "Lembrete da visita cancelado: o agendamento mudou no Stronilead." (spec). Na hora de enviar, o cancelado deixa "Lembrete da visita não enviado: o agendamento mudou no Stronilead.", o texto que o mockup mostra nesse momento (seção 5). O refeito deixa "Lembrete da visita remarcado para 02/10 às 18:00, junto com o agendamento.", com o dia e a hora novos do lembrete. Na aula, "Lembrete da aula experimental …". A nota é uma mensagem interna (não vai para o WhatsApp, a equipe vê) com um payload próprio no `content` (`{ kind: 'crm_reminder_note', event, text }`), e a conversa a desenha como a pílula centralizada do mockup aprovado (seção 5, "Remarcado ou cancelado no Stronilead"): sino cortado, fundo claro, borda fina e cantos arredondados. É o molde do cartão de transferência (`parseTransferNote` e `TransferNoteCard`). A nota do remarcado leva o sino sem o corte (Task 15).
6. **Stronilead sem resposta na hora de enviar, e a faixa que não se fura.** Qualquer falha da ponte (fora do ar, tempo esgotado, chave recusada, integração desligada, resposta fora do combinado) conta como "não respondeu". O lembrete continua agendado, e o agendador tenta de novo no minuto seguinte. A janela das tentativas vai até 30 minutos depois da hora marcada e fecha às 21h de Brasília, se chegar antes (`reminderSendable`): nenhum envio sai fora da faixa das 8h às 21h, nem nas tentativas, nem quando o agendador volta de uma parada. A faixa é contada em minutos, então o lembrete das 21:00 sai no tique das 21:00 e não tem tentativa depois disso. Fechada a janela sem a confirmação, o lembrete é apagado com a nota "Lembrete da visita não enviado: o Stronilead não respondeu para confirmar o horário." quando a ponte falhou nesse envio, ou com "Lembrete da visita não enviado: passou da hora de enviar." quando quem ficou fora do ar foi o próprio Stronizap (texto a confirmar).
7. **Conversa encerrada.** A exceção vale só para o lembrete e mora numa função pura (`scheduledSendBlock`, Task 11). O envio passa pelo `whatsappService.sendText`, que marca o id como enviado pelo próprio Stronizap (`markSentByMe`, `backend/src/services/whatsapp.service.ts:594`), então o eco do WhatsApp não reabre a conversa. Ela volta para a fila quando o lead responde, pelo caminho de sempre (`persistIncomingMessage`, `backend/src/services/message.service.ts:709-729`).
8. **"Mostrar meu nome".** Na criação, o texto passa por `applySenderName` com a preferência de quem agendou, a mesma regra do `scheduleTextMessage` (`backend/src/services/conversation.service.ts:1603-1607`). O texto padrão que a conferência remonta leva a preferência de agora do autor. O texto mudado à mão nunca é remontado.
9. **A troca.** Criar um lembrete apaga os lembretes agendados do mesmo lead e do mesmo tipo em toda a organização, não só na conversa, e cria o novo, numa transação que trava a linha da organização (`FOR NO KEY UPDATE`, o mesmo jeito do `issueCode` do "Esqueci a senha"). Assim dois cliques ou duas pessoas deixam um lembrete só. A troca apaga o anterior mesmo quando o novo não é criado (chave desligada no balão, lembrete desligado na academia, sem tempo para lembrete), porque ele citaria a data antiga.
10. **Desligar o lembrete na academia cancela os que já estão agendados** (decisão tomada na revisão do plano, a confirmar com o Johnny; a spec não fala desse caso). A varredura e a conferência na hora de enviar apagam o lembrete pendente da academia com o lembrete desligado, com a nota "Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações." (texto a confirmar). Ligar de novo não traz de volta os cancelados.
11. **Variáveis.** A troca segue a das mensagens prontas (`frontend/src/lib/replyTemplate.ts`): maiúscula, acento, espaço e hífen não importam (`[Endereço]` vale como `[endereco]`), e variável desconhecida fica escrita como está, como o `[professor]`. Diferente das mensagens prontas, variável conhecida sem valor some, porque o lembrete sai sozinho. Depois da troca, o espaço repetido vira um só, o espaço antes de pontuação sai e a vírgula que sobra antes de outra pontuação também: "Oi, [primeiro_nome]!" sem nome vira "Oi!". Na academia sem unidade, quando o `[unidade]` fica vazio, o trecho "na unidade [unidade]" sai junto, com a vírgula antes dele, a mesma ideia da confirmação ("academia sem unidade sai sem 'na unidade'").
12. **A bolha da conversa.** A agendada que é lembrete ganha "· lembrete da visita" (ou "· lembrete da aula experimental") no cabeçalho, como no mockup da seção 3, e o resto da bolha fica como é hoje, com o cancelar de sempre.
13. **A prévia da configuração.** Uma rota nova, só do admin, `POST /api/organization/crm-reminder/preview`, monta os dois textos com os dados de exemplo do mockup (Mariana, visita amanhã às 18:00 na unidade Centro, Rua Garibaldi, 1200, aula de Pilates com Carla Dias) e com o nome de quem está logado no `[meu_primeiro_nome]`, como a prévia das mensagens prontas desde o PR #171. É a mesma função que monta o lembrete, então a prévia nunca diverge do que sai.
14. **Chips e prévias da configuração.** Os chips são os do mockup, mais `[meu_primeiro_nome]` nos dois textos, porque a spec lista a variável. O mockup mostra só a "Prévia da visita"; o plano mostra também a "Prévia da aula experimental", com o mesmo desenho.
15. **Gênero.** A spec e o mockup escrevem "Lembrete para a Mariana" e "A confirmação na caixa já avisa a Mariana.". O artigo adivinha o gênero, e a spec evita isso no texto da confirmação. O plano escreve o nome sem artigo ("já avisa Mariana"). Está na lista para o Johnny.
16. **Tamanho.** Os dois textos da configuração e o texto mudado no balão vão até 1.000 caracteres, o mesmo teto da anotação.
17. **Teste de rota e do agendador.** O tsx dos testes do backend não carrega o Baileys, então nenhuma rota é importada em `node:test`. O serviço é testado com dependências injetadas (no molde do `crm-lead.service.ts`), e as rotas e o banco de verdade entram na suíte de isolamento, que roda sobre o build. O `scheduler.service.ts` importa o Baileys e não tem teste; a regra da conversa encerrada sai para uma função pura com teste próprio.
18. **Migration provada em banco descartável** (Task 1), com o Postgres do Homebrew da máquina do Johnny, sem Docker, como manda o `CLAUDE.md` do Stronizap (seção 11).
19. **`ja_agendado` também cria ou troca o lembrete** (Task 18). A primeira resposta pode ter se perdido antes de o lembrete nascer, e a troca por lead e tipo garante um lembrete só.
20. **A prévia do balão mora no serviço do agendamento** (Task 12). O `POST /api/conversations/:id/crm-reminder-preview` é uma rota do balão do agendamento e passa pelas portas dele (`crmConversationTarget`, com as `SCHEDULE_*_MESSAGE` do PR 2). O corpo leva o `leadId`, e o backend decide pelo cartão se o agendamento é de menor e qual é o nome do contato, com as mesmas regras da criação (`ehDeMenor` e `nomeDoCartao(card) ?? displayName`).
21. **O lembrete no corpo do agendamento** (Task 18). O `reminder` (`{ enabled, text }`) entra ao lado de `schedule`, nunca dentro, porque `schedule` segue inteiro para o Stronilead. O balão só manda o `reminder` quando mostrou o bloco. Sem ele (a academia desligou o lembrete, ou a prévia não carregou), o backend usa o padrão: lembrete ligado, com o texto padrão, se a academia tiver ligado. Remarcar pelo Stronizap troca o lembrete pela mesma chamada.
22. **"Agendado. O lembrete não foi criado."** aparece quando a criação do lembrete falha depois do agendamento gravado (o backend devolve `reminderFailed: true`). Sem lembrete por escolha (chave desligada no balão, lembrete desligado na academia) ou por falta de tempo, que o balão já avisou com o "Sem lembrete", não há aviso.
23. **O destinatário do lembrete (pendência vinda da revisão do PR 1, a decidir com o Johnny antes de executar).** O `appointment-status` confere o agendamento, e não o destinatário. Se o telefone do lead mudar no Stronilead depois do agendamento, o lembrete continua indo para a conversa em que foi criado, com o número antigo. O cartão do número (`GET /api/zap`) traz o lead do dono e os menores, então a conferência na hora de enviar (Task 10) pode confirmar que o lead ainda é do número da conversa e, se não for, cancelar o lembrete com nota. Se o Johnny quiser, entra como um passo a mais da Task 10, com teste.

### Textos a confirmar com o Johnny

Nenhum destes aparece, palavra por palavra, na spec ou no mockup. O plano usa a redação abaixo.

1. "Lembrete da aula experimental cancelado: o agendamento mudou no Stronilead." e as outras notas da aula, no molde das da visita.
2. "Lembrete da visita não enviado: passou da hora de enviar." (o Stronizap ficou fora do ar na hora do lembrete).
3. "Sai sozinho 3 horas antes, quinta, 01/10, às 15:00." (a frase do modo "N horas antes"; a da véspera é a do mockup) e "1 hora antes" no singular.
4. Os motivos de "Sem lembrete" além do exemplo do mockup: "A visita é amanhã e o horário do lembrete, na véspera, já passou.", "A visita é hoje e o horário do lembrete, 3 horas antes, é daqui a menos de 30 minutos." e "A confirmação na caixa já avisa o contato." para contato sem nome.
5. O nome sem artigo: "Lembrete para Mariana" e "A confirmação na caixa já avisa Mariana." (nota 15).
6. "Prévia da aula experimental" (nota 14).
7. As mensagens de erro da configuração: "Escolha um horário entre 08:00 e 21:00.", "Escolha de 1 a 48 horas.", "Escreva o texto do lembrete.", e os avisos "Lembrete salvo", "Falha ao salvar o lembrete" e "Falha ao atualizar o lembrete".
8. "Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações." e o da aula, e a própria decisão de cancelar os pendentes quando a academia desliga o lembrete (nota 10).
9. "Lembrete para o contato", o título do bloco do balão quando o contato não tem nome.
10. "Dia ou horário que não existe.", a recusa da prévia com uma data impossível, que a tela não provoca.
11. Os rótulos de leitor de tela "Hora da véspera" e "Horas antes", nos dois campos de "Quando sai" da configuração.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `backend/prisma/schema.prisma` | enum `CrmReminderMode`, seis campos do lembrete na `Organization` e `crmReminder Json?` na `Message` |
| `backend/prisma/migrations/<data>_lembrete_de_agendamento/migration.sql` (novo) | a migration dos campos novos, com os padrões da spec |
| `backend/src/services/crm-reminder-time.ts` (novo) | calendário de Brasília, quando o lembrete sai, a janela das tentativas e as frases de "quando sai" e "sem lembrete" |
| `backend/src/services/crm-reminder-time.test.ts` (novo) | com o processo em UTC |
| `backend/src/services/crm-reminder-text.ts` (novo) | textos padrão, variáveis, a montagem do texto, a limpeza de espaço, o exemplo da configuração, o texto das notas e o payload delas |
| `backend/src/services/crm-reminder-text.test.ts` (novo) | com o processo em UTC, mais a trava que confere os padrões do `schema.prisma` |
| `backend/src/services/crm.service.ts` | `'appointment-status'` no `AcaoDaPonte`, `fetchCrmAppointmentStatus`, `APPOINTMENT_STATUS_TIMEOUT_MS`, `APPOINTMENT_STATUS_MAX` e a leitura da resposta pelo `lerDetalheDoAgendamento` do PR 2 |
| `backend/src/services/crm.service.test.ts` | a ação, a leitura, as falhas e o tempo máximo |
| `backend/src/services/crm-reminder.service.ts` (novo) | `CrmReminderData`, o repositório (Prisma), a troca, a conferência, a varredura, o preparo do envio, a prévia (`previewFromSettings`) e a prévia da configuração |
| `backend/src/services/crm-reminder.service.test.ts` (novo) | com repositório falso |
| `backend/src/lib/scheduledDispatch.ts` (novo) | `scheduledSendBlock`, a exceção da conversa encerrada |
| `backend/src/lib/scheduledDispatch.test.ts` (novo) | |
| `backend/src/services/scheduler.service.ts` | o lembrete espera a conferência, sai em conversa encerrada, e a varredura roda de 15 em 15 minutos |
| `backend/src/services/crm-schedule.service.ts` | a prévia do balão (`previewCrmReminder`), o `reminder` no corpo e a troca do lembrete depois do agendamento, com o `reminderFailed` |
| `backend/src/services/crm-schedule.service.test.ts` | a prévia, o lembrete depois do agendamento e do `ja_agendado`, e a falha do lembrete |
| `backend/src/routes/conversations.routes.ts` | `POST /:id/crm-reminder-preview` |
| `backend/src/services/organization.service.ts` | a configuração do lembrete no `toPublicOrg` e `updateCrmReminderSettings` |
| `backend/src/services/organization.service.test.ts` | |
| `backend/src/routes/organization.routes.ts` | `crmReminder` no `PATCH` e `POST /crm-reminder/preview` |
| `backend/src/routes/tenant-isolation.spec.ts` | a prévia nas portas do agendamento, a configuração, e a troca, a varredura e o envio contra o banco de verdade |
| `backend/src/scripts/smoke-crm-card.ts` | bloco que confere o `appointment-status`, só leitura |
| `backend/src/scripts/smoke-crm-card.guard.test.ts` | a trava do smoke barra também o lembrete |
| `frontend/src/types/message.ts` | `crmReminder` na `Message` |
| `frontend/src/lib/reminderNote.ts` (novo) | o payload da nota do lembrete e a leitura dele |
| `frontend/src/lib/reminderNote.test.ts` (novo) | |
| `frontend/src/lib/transferNote.ts` | o resumo da nota do lembrete na lista e nos avisos |
| `frontend/src/components/MessageBubble.tsx` | "· lembrete da visita" na bolha da agendada e a pílula da nota do lembrete |
| `frontend/src/components/MessageBubble.test.tsx` | |
| `frontend/src/lib/crmReminderSettings.ts` (novo) | regras puras do formulário da configuração |
| `frontend/src/lib/crmReminderSettings.test.ts` (novo) | |
| `frontend/src/components/settings/CrmReminderSettings.tsx` (novo) | o cartão "Lembrete de agendamento" |
| `frontend/src/components/settings/CrmReminderSettings.test.tsx` (novo) | |
| `frontend/src/components/settings/CrmIntegrationManager.tsx` | o cartão novo embaixo dos dados da conexão, só para o admin |
| `frontend/src/components/settings/CrmIntegrationManager.test.tsx` (novo) | o admin vê o cartão, o superadmin não |
| `frontend/src/types/crm.ts` | `CrmReminderRequest`, `CrmReminderPreview`, `CrmReminderPreviewBody`, o `reminder` no `CrmScheduleBody` e o `reminderFailed` no `CrmScheduleResult` |
| `frontend/src/lib/crmReminder.ts` (novo) | a chamada da prévia, o corpo dela, o pedido do lembrete e o aviso de falha |
| `frontend/src/lib/crmReminder.test.ts` (novo) | |
| `frontend/src/components/CrmReminderBlock.tsx` (novo) | o bloco do lembrete no resumo do balão |
| `frontend/src/components/CrmReminderBlock.test.tsx` (novo) | |
| `frontend/src/components/CrmScheduleSummary.tsx` | o lugar do bloco (`reminder`) |
| `frontend/src/components/CrmScheduleWizard.tsx` | o estado do lembrete, a prévia e o `reminder` no corpo |
| `frontend/src/components/CrmScheduleWizard.test.tsx` | a prévia fica inerte nos testes do PR 2 |
| `frontend/src/components/CrmScheduleBalloon.tsx` | o aviso "Agendado. O lembrete não foi criado." |
| `frontend/src/components/CrmScheduleBalloon.test.tsx` | o bloco no balão, o `reminder` no corpo e o aviso |
| `CLAUDE.md` | seções 4, 7, 8, 10 e 14 |

---

### Task 0: Worktree e ponto de partida

**Files:** nenhum

O checkout principal é dividido com outras sessões. Nunca troque de branch nele: todo o trabalho acontece no worktree.

- [ ] **Step 1: Conferir que o PR 2 já está na `main` e criar o worktree**

```bash
cd ~/STRONIX-FIRMA/06-sistemas/stronizap
git fetch origin
git worktree add .claude/worktrees/lembrete-de-agendamento -b claude/lembrete-de-agendamento origin/main
cd .claude/worktrees/lembrete-de-agendamento
grep -n "export function dayPhrase\|export function hourPhrase\|export function firstName" backend/src/services/crm-appointment-text.ts
grep -n "CrmAppointmentDetail" backend/src/services/crm.service.ts | head -3
grep -n "export async function scheduleCrmAppointment" backend/src/services/crm-schedule.service.ts
```

Expected: `Preparing worktree (new branch 'claude/lembrete-de-agendamento')`, as três funções de texto achadas, o tipo `CrmAppointmentDetail` exportado e o `scheduleCrmAppointment` achado. Se algum `grep` voltar vazio, o PR 2 ainda não está na `main`: pare e avise, porque este plano depende dele.

- [ ] **Step 2: Instalar, gerar o cliente do Prisma e conferir que a base está verde**

```bash
npm ci
npm run prisma:generate
npm test --workspace=backend
npm test --workspace=frontend
npm run typecheck --workspaces
```

Expected: tudo verde. Anote o número de testes do backend e do frontend, para comparar na verificação final. Se algo falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: Campos do lembrete na `Organization` e `crmReminder` na `Message`

**Files:**
- Modify: `backend/prisma/schema.prisma` (depois da linha 55, antes da linha 76 e depois da linha 497)
- Create: `backend/prisma/migrations/<AAAAMMDDHHMMSS>_lembrete_de_agendamento/migration.sql` (gerado)

A migration é provada num banco descartável, com o Postgres do Homebrew (`CLAUDE.md` do Stronizap, seção 11). Nunca aponte o `DATABASE_URL` para o banco de desenvolvimento de verdade.

- [ ] **Step 1: Escrever o schema**

Em `backend/prisma/schema.prisma`, dentro de `model Organization`, logo depois de:

```prisma
  /// Slug do tenant no CRM, ex.: "stronix-crm-app". Vai na query da consulta.
  crmTenantSlug  String?
```

acrescentar:

```prisma

  // ── Lembrete de agendamento (spec 2026-09-29, PR 3) ─────────────────────
  // Mensagem que o Stronizap envia sozinho antes da visita ou da aula
  // experimental agendada pela conversa. Quem liga é o admin, em
  // Configurações → Stronilead. Regras em services/crm-reminder-*.ts.
  /// Nasce desligado: é mensagem que sai sozinha para o cliente.
  crmReminderEnabled     Boolean         @default(false)
  /// Véspera a uma hora fixa, ou algumas horas antes do horário marcado.
  crmReminderMode        CrmReminderMode @default(EVE)
  /// "HH:MM", de 08:00 a 21:00. Vale no modo EVE.
  crmReminderEveTime     String          @default("18:00")
  /// De 1 a 48. Vale no modo HOURS_BEFORE.
  crmReminderHoursBefore Int             @default(3)
  /// Texto do lembrete da visita, com as variáveis de crm-reminder-text.ts.
  crmReminderVisitText   String          @default("Oi, [primeiro_nome]! Passando para lembrar da visita [do_aluno] [dia], às [hora], na unidade [unidade]. Até lá!") @db.Text
  /// Texto do lembrete da aula experimental.
  crmReminderTrialText   String          @default("Oi, [primeiro_nome]! Passando para lembrar da aula experimental de [modalidade] [do_aluno] [dia], às [hora]. Até lá!") @db.Text
```

Logo antes de `/// Bandeja de figurinhas reutilizáveis da org.` (linha 76), acrescentar:

```prisma
/// Quando o lembrete de agendamento sai (Organization.crmReminderMode).
enum CrmReminderMode {
  EVE // na véspera, a uma hora fixa (crmReminderEveTime)
  HOURS_BEFORE // algumas horas antes do horário marcado (crmReminderHoursBefore)
}

```

Dentro de `model Message`, logo depois de:

```prisma
  /// usamos esse ID pra evitar persistir duplicata.
  igMessageId            String?
```

acrescentar:

```prisma
  /// Preenchido só no lembrete automático de agendamento (spec 2026-09-29,
  /// PR 3): liga a mensagem agendada ao agendamento do Stronilead. Formato em
  /// `CrmReminderData` (services/crm-reminder.service.ts). Null em toda
  /// mensagem que não é lembrete.
  crmReminder            Json?
```

- [ ] **Step 2: Gerar a migration num banco descartável**

```bash
cd backend
createdb lembrete_migra
export DATABASE_URL="postgresql://$USER@localhost:5432/lembrete_migra?schema=public"
npx prisma migrate deploy
npx prisma migrate dev --create-only --name lembrete_de_agendamento
```

Expected: o `migrate deploy` aplica as migrations que já existem, e o `migrate dev` cria `prisma/migrations/<AAAAMMDDHHMMSS>_lembrete_de_agendamento/migration.sql` sem aplicar.

- [ ] **Step 3: Conferir o SQL gerado e pôr o comentário no topo**

O arquivo gerado tem de ter exatamente estas instruções (a ordem entre os dois `ALTER TABLE` pode variar). Acrescente o comentário das três primeiras linhas no topo e confira o resto:

```sql
-- Lembrete de agendamento (spec 2026-09-29, PR 3). Nasce desligado em toda
-- academia: é mensagem que sai sozinha para o cliente, e quem liga é o admin,
-- em Configurações → Stronilead.

-- CreateEnum
CREATE TYPE "CrmReminderMode" AS ENUM ('EVE', 'HOURS_BEFORE');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "crmReminder" JSONB;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "crmReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "crmReminderEveTime" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "crmReminderHoursBefore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "crmReminderMode" "CrmReminderMode" NOT NULL DEFAULT 'EVE',
ADD COLUMN     "crmReminderTrialText" TEXT NOT NULL DEFAULT 'Oi, [primeiro_nome]! Passando para lembrar da aula experimental de [modalidade] [do_aluno] [dia], às [hora]. Até lá!',
ADD COLUMN     "crmReminderVisitText" TEXT NOT NULL DEFAULT 'Oi, [primeiro_nome]! Passando para lembrar da visita [do_aluno] [dia], às [hora], na unidade [unidade]. Até lá!';
```

Se aparecer qualquer outra instrução (um `DROP`, um `ALTER COLUMN` em coluna que não é deste plano), pare: o schema e as migrations discordavam antes, e isso precisa ser entendido antes de seguir (`CLAUDE.md`, seção 11). Nunca rode `prisma migrate reset`.

- [ ] **Step 4: Aplicar e provar que o banco e o schema concordam**

```bash
npx prisma migrate deploy
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
psql "$DATABASE_URL" -c "INSERT INTO plans (id, name, slug, \"maxChannels\", \"maxAttendants\", \"enforcementMode\", \"isDefault\", \"createdAt\", \"updatedAt\") VALUES ('p1', 'Teste', 'teste', -1, -1, 'UNLIMITED', true, now(), now());"
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, slug, \"planId\", \"updatedAt\") VALUES ('o1', 'Org', 'org', 'p1', now());"
psql "$DATABASE_URL" -c "SELECT \"crmReminderEnabled\", \"crmReminderMode\", \"crmReminderEveTime\", \"crmReminderHoursBefore\", left(\"crmReminderVisitText\", 30) AS visita FROM organizations;"
```

Expected: o `migrate deploy` aplica `..._lembrete_de_agendamento`; o `migrate diff` imprime `-- This is an empty migration.`; o `SELECT` mostra `f | EVE | 18:00 | 3 | Oi, [primeiro_nome]! Passando`, ou seja, a academia nova nasce com o lembrete desligado e com os padrões da spec. Se o `INSERT` em `plans` reclamar de coluna, confira os nomes com `\d plans` e ajuste só o `INSERT`, que é descartável.

- [ ] **Step 5: Apagar o banco descartável e gerar o cliente**

```bash
unset DATABASE_URL
dropdb lembrete_migra
cd ..
npm run prisma:generate
npm run typecheck --workspace=backend
```

Expected: o banco some, o cliente do Prisma passa a conhecer `crmReminder` e os seis campos, e o typecheck passa.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: campos do lembrete de agendamento na organização e na mensagem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `crm-reminder-time.ts`, quando o lembrete sai

**Files:**
- Create: `backend/src/services/crm-reminder-time.ts`
- Test: `backend/src/services/crm-reminder-time.test.ts`

Conta pura, no horário de Brasília, testada com o processo em UTC. Nos exemplos, hoje é terça, 29/09/2026 (a data do mockup).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/crm-reminder-time.test.ts`:

```ts
// O processo roda em UTC neste arquivo, como pode rodar em qualquer servidor.
// Na máquina do Johnny, que fica em Brasília, uma conta que usasse o fuso do
// processo passaria sem ninguém perceber.
process.env.TZ = 'UTC';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  instanteDoTexto,
  partesDeBrasilia,
  planReminder,
  reminderSendable,
  withinReminderHours,
  type CrmReminderTiming,
} from './crm-reminder-time';

const VESPERA_18: CrmReminderTiming = { mode: 'EVE', eveTime: '18:00', hoursBefore: 3 };
const TRES_HORAS: CrmReminderTiming = { mode: 'HOURS_BEFORE', eveTime: '18:00', hoursBefore: 3 };
const horasAntes = (n: number): CrmReminderTiming => ({ mode: 'HOURS_BEFORE', eveTime: '18:00', hoursBefore: n });

/** Terça, 29/09/2026, às 15:40 de Brasília. */
const AGORA = new Date('2026-09-29T15:40:00-03:00');

test('fuso: o processo deste teste está mesmo em UTC', () => {
  assert.equal(new Date('2026-09-30T21:00:00.000Z').getHours(), 21);
});

test('calendário: dia, hora e dia da semana saem de Brasília', () => {
  assert.deepEqual(partesDeBrasilia(new Date('2026-10-02T01:00:00.000Z')), {
    year: 2026,
    month: 10,
    day: 1,
    hour: 22,
    minute: 0,
    weekday: 4,
  });
});

test('calendário: dia e hora de Brasília em texto viram o instante', () => {
  assert.equal(instanteDoTexto('2026-10-01', '18:00')?.toISOString(), '2026-10-01T21:00:00.000Z');
  assert.equal(instanteDoTexto('2026-12-31', '23:30')?.toISOString(), '2027-01-01T02:30:00.000Z');
});

test('calendário: data ou hora que não existem voltam null', () => {
  assert.equal(instanteDoTexto('2026-02-30', '18:00'), null);
  assert.equal(instanteDoTexto('2026-10-01', '24:00'), null);
  assert.equal(instanteDoTexto('2026-10-01', '18:60'), null);
  assert.equal(instanteDoTexto('01/10/2026', '18:00'), null);
  assert.equal(instanteDoTexto('2026-10-01', '18h'), null);
});

test('véspera: sai no dia anterior ao agendamento, na hora configurada', () => {
  const plano = planReminder(new Date('2026-10-01T18:00:00-03:00'), VESPERA_18, AGORA);
  assert.deepEqual(plano, { at: new Date('2026-09-30T21:00:00.000Z'), rule: 'eve' });
});

test('véspera: o dia do agendamento é o de Brasília, não o do UTC', () => {
  // 01/10 às 22:00 em Brasília já é 02/10 em UTC. A véspera é 30/09.
  const plano = planReminder(new Date('2026-10-01T22:00:00-03:00'), VESPERA_18, AGORA);
  assert.deepEqual(plano, { at: new Date('2026-09-30T18:00:00-03:00'), rule: 'eve' });
});

test('véspera: vira o mês e o ano', () => {
  const plano = planReminder(new Date('2027-01-01T10:00:00-03:00'), VESPERA_18, AGORA);
  assert.deepEqual(plano, { at: new Date('2026-12-31T18:00:00-03:00'), rule: 'eve' });
});

test('horas antes: sai N horas antes do horário marcado', () => {
  const plano = planReminder(new Date('2026-10-01T18:00:00-03:00'), TRES_HORAS, AGORA);
  assert.deepEqual(plano, { at: new Date('2026-10-01T15:00:00-03:00'), rule: 'hours_before' });
});

test('faixa: 08:00 e 21:00 ainda estão dentro', () => {
  assert.deepEqual(planReminder(new Date('2026-10-01T09:00:00-03:00'), horasAntes(1), AGORA), {
    at: new Date('2026-10-01T08:00:00-03:00'),
    rule: 'hours_before',
  });
  assert.deepEqual(planReminder(new Date('2026-10-01T23:00:00-03:00'), horasAntes(2), AGORA), {
    at: new Date('2026-10-01T21:00:00-03:00'),
    rule: 'hours_before',
  });
});

test('faixa: antes das 8h sai às 20h do dia anterior ao agendamento, e vira véspera', () => {
  const plano = planReminder(new Date('2026-10-01T09:00:00-03:00'), TRES_HORAS, AGORA);
  assert.deepEqual(plano, { at: new Date('2026-09-30T20:00:00-03:00'), rule: 'eve' });
});

test('faixa: depois das 21h sai às 20h do dia anterior ao agendamento', () => {
  const plano = planReminder(new Date('2026-10-01T22:30:00-03:00'), horasAntes(1), AGORA);
  assert.deepEqual(plano, { at: new Date('2026-09-30T20:00:00-03:00'), rule: 'eve' });
});

test('faixa: hora da véspera gravada errada cai nas 20h da véspera', () => {
  for (const eveTime of ['23:00', '06:30', 'abc']) {
    const plano = planReminder(new Date('2026-10-01T18:00:00-03:00'), { ...VESPERA_18, eveTime }, AGORA);
    assert.deepEqual(plano, { at: new Date('2026-09-30T20:00:00-03:00'), rule: 'eve' }, eveTime);
  }
});

test('sem lembrete: a hora do lembrete já passou', () => {
  // Visita hoje às 19:00: a véspera, 28/09 às 18:00, já foi.
  const plano = planReminder(new Date('2026-09-29T19:00:00-03:00'), VESPERA_18, AGORA);
  assert.deepEqual(plano, { at: null, rule: 'eve', reason: 'hora_passada' });
});

test('sem lembrete: a hora do lembrete é agora', () => {
  const plano = planReminder(new Date('2026-09-29T18:40:00-03:00'), TRES_HORAS, AGORA);
  assert.deepEqual(plano, { at: null, rule: 'hours_before', reason: 'hora_passada' });
});

test('sem lembrete: falta menos de 30 minutos para a hora do lembrete', () => {
  // 3 horas antes das 18:50 é 15:50, dez minutos depois de agora.
  const plano = planReminder(new Date('2026-09-29T18:50:00-03:00'), TRES_HORAS, AGORA);
  assert.deepEqual(plano, { at: null, rule: 'hours_before', reason: 'em_cima_da_hora' });
});

test('sem lembrete: com exatamente 30 minutos, o lembrete sai', () => {
  const plano = planReminder(new Date('2026-09-29T19:10:00-03:00'), TRES_HORAS, AGORA);
  assert.deepEqual(plano, { at: new Date('2026-09-29T16:10:00-03:00'), rule: 'hours_before' });
});

test('faixa das 8h às 21h, em Brasília', () => {
  assert.equal(withinReminderHours(new Date('2026-10-01T07:59:00-03:00')), false);
  assert.equal(withinReminderHours(new Date('2026-10-01T08:00:00-03:00')), true);
  assert.equal(withinReminderHours(new Date('2026-10-01T21:00:00-03:00')), true);
  assert.equal(withinReminderHours(new Date('2026-10-01T21:01:00-03:00')), false);
});

test('janela: o lembrete ainda pode sair até 30 minutos depois da hora dele', () => {
  const hora = new Date('2026-09-30T18:00:00-03:00');
  assert.equal(reminderSendable(hora, new Date('2026-09-30T18:30:00-03:00')), true);
  assert.equal(reminderSendable(hora, new Date('2026-09-30T18:30:01-03:00')), false);
});

test('janela: nenhuma tentativa passa das 21h, e o lembrete das 21:00 sai no minuto dele', () => {
  const vinteECinquenta = new Date('2026-09-30T20:50:00-03:00');
  assert.equal(reminderSendable(vinteECinquenta, new Date('2026-09-30T21:00:40-03:00')), true);
  assert.equal(reminderSendable(vinteECinquenta, new Date('2026-09-30T21:01:00-03:00')), false);

  const vinteEUma = new Date('2026-09-30T21:00:00-03:00');
  assert.equal(reminderSendable(vinteEUma, new Date('2026-09-30T21:00:59-03:00')), true);
  assert.equal(reminderSendable(vinteEUma, new Date('2026-09-30T21:01:05-03:00')), false);
});

test('janela: o agendador que volta de uma parada de madrugada não envia', () => {
  assert.equal(
    reminderSendable(new Date('2026-09-30T20:45:00-03:00'), new Date('2026-10-01T03:10:00-03:00')),
    false,
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com `Cannot find module './crm-reminder-time'`.

- [ ] **Step 3: Implementar `backend/src/services/crm-reminder-time.ts`**

```ts
// Quando o lembrete de agendamento sai. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// seção "Quando sai".
//
// Tudo no horário de Brasília (America/Sao_Paulo), nunca no fuso do processo:
// com o servidor em UTC, "a véspera às 18:00" viraria 15:00. Nenhum Date é
// deslocado: o calendário de Brasília é lido pelo Intl.
//
// Módulo puro. A mesma conta serve à prévia do balão, à criação do lembrete
// e à conferência que refaz o lembrete quando o agendamento muda de hora,
// para o que o balão mostra ser o que vai sair.
import type { CrmAppointmentDetail } from './crm.service';

export type CrmReminderType = CrmAppointmentDetail['type'];

export type CrmReminderMode = 'EVE' | 'HOURS_BEFORE';

/** Como a academia configurou (Organization.crmReminder*). */
export interface CrmReminderTiming {
  mode: CrmReminderMode;
  /** "HH:MM", de 08:00 a 21:00. Vale no modo EVE. */
  eveTime: string;
  /** De 1 a 48. Vale no modo HOURS_BEFORE. */
  hoursBefore: number;
}

/** Qual frase o lembrete leva: "na véspera" ou "N horas antes". */
export type ReminderRule = 'eve' | 'hours_before';

/** Por que não há lembrete. */
export type NoReminderReason = 'hora_passada' | 'em_cima_da_hora';

export type ReminderPlan =
  | { at: Date; rule: ReminderRule }
  | { at: null; rule: ReminderRule; reason: NoReminderReason };

/** A faixa em que o lembrete sai, em minutos do dia de Brasília: das 08:00 às 21:00, inclusive. */
export const REMINDER_WINDOW_START_MIN = 8 * 60;
export const REMINDER_WINDOW_END_MIN = 21 * 60;
/** Fora da faixa, o lembrete sai a esta hora do dia anterior ao agendamento. */
export const REMINDER_FALLBACK_TIME = '20:00';
/** Com menos que isto até a hora do lembrete, não há lembrete. */
export const REMINDER_MIN_LEAD_MS = 30 * 60 * 1000;
/** Depois da hora dele, o lembrete ainda pode sair por este tempo (tentativas de minuto em minuto). */
export const REMINDER_RETRY_WINDOW_MS = 30 * 60 * 1000;

const FUSO = 'America/Sao_Paulo';
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const leitor = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
  hourCycle: 'h23',
});

export interface PartesDeBrasilia {
  year: number;
  /** 1 a 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 é domingo. */
  weekday: number;
}

/** Ano, mês, dia, hora, minuto e dia da semana de um instante, em Brasília. */
export function partesDeBrasilia(at: Date): PartesDeBrasilia {
  const p: Record<string, string> = {};
  for (const { type, value } of leitor.formatToParts(at)) {
    if (type !== 'literal') p[type] = value;
  }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: DIAS_EN.indexOf(p.weekday),
  };
}

/**
 * O instante de um dia e hora de Brasília. Mede a diferença entre o que
 * Brasília mostra num palpite em UTC e o próprio palpite, e desconta: vale
 * para qualquer fuso que Brasília venha a ter.
 */
export function instanteDeBrasilia(year: number, month: number, day: number, hour: number, minute: number): Date {
  const palpite = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(palpite)) return new Date(NaN);
  const p = partesDeBrasilia(new Date(palpite));
  const mostrado = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(palpite - (mostrado - palpite));
}

/**
 * "AAAA-MM-DD" e "HH:MM" de Brasília viram o instante, ou null quando a data
 * ou a hora não existem (30/02, 24:00). A volta confere, porque o Date.UTC
 * aceita 30/02 e devolve 02/03 sem avisar.
 */
export function instanteDoTexto(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [ano, mes, dia, hora, minuto] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (hora > 23 || minuto > 59) return null;
  const at = instanteDeBrasilia(ano, mes, dia, hora, minuto);
  if (Number.isNaN(at.getTime())) return null;
  const p = partesDeBrasilia(at);
  if (p.year !== ano || p.month !== mes || p.day !== dia || p.hour !== hora || p.minute !== minuto) return null;
  return at;
}

/** Número do dia no calendário de Brasília. A diferença entre dois é a distância em dias. */
export function diaDeBrasilia(at: Date): number {
  const p = partesDeBrasilia(at);
  return Date.UTC(p.year, p.month - 1, p.day) / DIA_MS;
}

/** Dentro da faixa das 8h às 21h de Brasília, com as duas pontas. */
export function withinReminderHours(at: Date): boolean {
  const p = partesDeBrasilia(at);
  const minutos = p.hour * 60 + p.minute;
  return minutos >= REMINDER_WINDOW_START_MIN && minutos <= REMINDER_WINDOW_END_MIN;
}

/** A hora "HH:MM" do dia anterior ao agendamento, no calendário de Brasília. */
function vesperaAs(appointmentAt: Date, hhmm: string): Date {
  const p = partesDeBrasilia(appointmentAt);
  const vespera = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
  const [hora, minuto] = hhmm.split(':').map(Number);
  return instanteDeBrasilia(
    vespera.getUTCFullYear(),
    vespera.getUTCMonth() + 1,
    vespera.getUTCDate(),
    hora,
    minuto,
  );
}

/**
 * Quando o lembrete de um agendamento sai. Na véspera, à hora configurada,
 * ou N horas antes. Fora das 8h às 21h, sai às 20h do dia anterior ao
 * agendamento. Se essa hora já passou, ou se falta menos de 30 minutos para
 * ela, não há lembrete, e o motivo vai para o balão.
 */
export function planReminder(appointmentAt: Date, timing: CrmReminderTiming, now: Date): ReminderPlan {
  let at: Date;
  let rule: ReminderRule;
  if (timing.mode === 'HOURS_BEFORE') {
    at = new Date(appointmentAt.getTime() - timing.hoursBefore * HORA_MS);
    rule = 'hours_before';
  } else {
    at = vesperaAs(appointmentAt, timing.eveTime);
    rule = 'eve';
  }
  // A véspera configurada já vem de 08:00 a 21:00. Quem cai fora da faixa é o
  // "N horas antes", ou uma hora gravada errada no banco.
  if (Number.isNaN(at.getTime()) || !withinReminderHours(at)) {
    at = vesperaAs(appointmentAt, REMINDER_FALLBACK_TIME);
    rule = 'eve';
  }
  const falta = at.getTime() - now.getTime();
  if (falta <= 0) return { at: null, rule, reason: 'hora_passada' };
  if (falta < REMINDER_MIN_LEAD_MS) return { at: null, rule, reason: 'em_cima_da_hora' };
  return { at, rule };
}

/**
 * Se o lembrete ainda pode sair agora: até 30 minutos depois da hora dele (as
 * tentativas com o Stronilead fora do ar) e sempre dentro da faixa das 8h às
 * 21h de Brasília. A faixa é contada em minutos, então o lembrete das 21:00
 * sai no tique das 21:00 e não tem tentativa depois disso, e o agendador que
 * volta de uma parada não envia lembrete atrasado fora da faixa.
 */
export function reminderSendable(scheduledFor: Date, now: Date): boolean {
  return now.getTime() <= scheduledFor.getTime() + REMINDER_RETRY_WINDOW_MS && withinReminderHours(now);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 20 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder-time.ts backend/src/services/crm-reminder-time.test.ts
git commit -m "feat: conta de quando o lembrete de agendamento sai, no horário de Brasília

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: As frases de "quando sai" e de "sem lembrete"

**Files:**
- Modify: `backend/src/services/crm-reminder-time.ts` (fim do arquivo)
- Test: `backend/src/services/crm-reminder-time.test.ts`

As duas frases do bloco do balão. A da véspera e o motivo do exemplo do mockup vêm dele, palavra por palavra; as outras estão na lista de textos a confirmar (itens 3, 4 e 5). O nome vai sem artigo (nota 15).

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm-reminder-time.test.ts`, trocar o import do topo por:

```ts
import {
  instanteDoTexto,
  noReminderText,
  partesDeBrasilia,
  planReminder,
  reminderSendable,
  reminderWhenText,
  withinReminderHours,
  type CrmReminderTiming,
} from './crm-reminder-time';
```

E acrescentar no fim do arquivo:

```ts
// ── Frases do bloco do lembrete ────────────────────────────────────────────

test('quando sai: na véspera, com o dia da semana curto, a data e a hora', () => {
  assert.equal(
    reminderWhenText(new Date('2026-09-30T18:00:00-03:00'), 'eve', VESPERA_18),
    'Sai sozinho na véspera, quarta, 30/09, às 18:00.',
  );
});

test('quando sai: N horas antes, e 1 hora no singular', () => {
  assert.equal(
    reminderWhenText(new Date('2026-10-01T15:00:00-03:00'), 'hours_before', TRES_HORAS),
    'Sai sozinho 3 horas antes, quinta, 01/10, às 15:00.',
  );
  assert.equal(
    reminderWhenText(new Date('2026-10-01T17:00:00-03:00'), 'hours_before', horasAntes(1)),
    'Sai sozinho 1 hora antes, quinta, 01/10, às 17:00.',
  );
});

test('quando sai: o "N horas antes" que caiu fora da faixa vira véspera', () => {
  const plano = planReminder(new Date('2026-10-01T09:00:00-03:00'), TRES_HORAS, AGORA);
  assert.ok(plano.at);
  assert.equal(
    reminderWhenText(plano.at, plano.rule, TRES_HORAS),
    'Sai sozinho na véspera, quarta, 30/09, às 20:00.',
  );
});

test('sem lembrete: visita hoje com a véspera que já passou (o exemplo do mockup)', () => {
  assert.equal(
    noReminderText({
      type: 'visita',
      appointmentAt: new Date('2026-09-29T19:00:00-03:00'),
      rule: 'eve',
      reason: 'hora_passada',
      timing: VESPERA_18,
      contactFirstName: 'Mariana',
      now: AGORA,
    }),
    'A visita é hoje e o horário do lembrete, na véspera, já passou. A confirmação na caixa já avisa Mariana.',
  );
});

test('sem lembrete: aula amanhã, em cima da hora, contato sem nome', () => {
  assert.equal(
    noReminderText({
      type: 'aula_experimental',
      appointmentAt: new Date('2026-09-30T10:00:00-03:00'),
      rule: 'hours_before',
      reason: 'em_cima_da_hora',
      timing: TRES_HORAS,
      contactFirstName: null,
      now: AGORA,
    }),
    'A aula experimental é amanhã e o horário do lembrete, 3 horas antes, é daqui a menos de 30 minutos. A confirmação na caixa já avisa o contato.',
  );
});

test('sem lembrete: mais longe que amanhã, o dia da semana', () => {
  const texto = noReminderText({
    type: 'visita',
    appointmentAt: new Date('2026-10-01T18:00:00-03:00'),
    rule: 'hours_before',
    reason: 'hora_passada',
    timing: horasAntes(48),
    contactFirstName: 'Mariana',
    now: AGORA,
  });
  assert.equal(
    texto,
    'A visita é quinta e o horário do lembrete, 48 horas antes, já passou. A confirmação na caixa já avisa Mariana.',
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `noReminderText` e `reminderWhenText` não existem em `./crm-reminder-time`.

- [ ] **Step 3: Implementar no fim de `backend/src/services/crm-reminder-time.ts`**

```ts
// ── Frases do bloco do lembrete no balão ───────────────────────────────────

const DIAS_CURTOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "quarta, 30/09, às 18:00". */
function quandoSai(at: Date): string {
  const p = partesDeBrasilia(at);
  return `${DIAS_CURTOS[p.weekday]}, ${pad(p.day)}/${pad(p.month)}, às ${pad(p.hour)}:${pad(p.minute)}`;
}

function horasAntes(n: number): string {
  return n === 1 ? '1 hora antes' : `${n} horas antes`;
}

function regraEscrita(rule: ReminderRule, timing: CrmReminderTiming): string {
  return rule === 'eve' ? 'na véspera' : horasAntes(timing.hoursBefore);
}

/** "Sai sozinho na véspera, quarta, 30/09, às 18:00." */
export function reminderWhenText(at: Date, rule: ReminderRule, timing: CrmReminderTiming): string {
  return `Sai sozinho ${regraEscrita(rule, timing)}, ${quandoSai(at)}.`;
}

/** "hoje", "amanhã" ou o dia da semana curto ("quinta"), relativo a `now`. */
function diaRelativo(at: Date, now: Date): string {
  const dias = diaDeBrasilia(at) - diaDeBrasilia(now);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return DIAS_CURTOS[partesDeBrasilia(at).weekday];
}

/**
 * O motivo de "Sem lembrete", no molde do exemplo do mockup. O nome vai sem
 * artigo, para não adivinhar o gênero de quem recebe.
 */
export function noReminderText(input: {
  type: CrmReminderType;
  appointmentAt: Date;
  rule: ReminderRule;
  reason: NoReminderReason;
  timing: CrmReminderTiming;
  contactFirstName: string | null;
  now: Date;
}): string {
  const oQue = input.type === 'visita' ? 'A visita' : 'A aula experimental';
  const situacao = input.reason === 'hora_passada' ? 'já passou' : 'é daqui a menos de 30 minutos';
  const quem = input.contactFirstName ?? 'o contato';
  return (
    `${oQue} é ${diaRelativo(input.appointmentAt, input.now)} e o horário do lembrete, ` +
    `${regraEscrita(input.rule, input.timing)}, ${situacao}. A confirmação na caixa já avisa ${quem}.`
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 6 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder-time.ts backend/src/services/crm-reminder-time.test.ts
git commit -m "feat: frases de quando o lembrete sai e de por que não há lembrete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `crm-reminder-text.ts`, o texto do lembrete

**Files:**
- Create: `backend/src/services/crm-reminder-text.ts`
- Test: `backend/src/services/crm-reminder-text.test.ts`

Troca as variáveis da tabela da spec, some com a variável vazia e limpa o espaço que sobra (nota 11). `[dia]` é relativo ao dia em que o lembrete sai. Usa `dayPhrase`, `hourPhrase` e `firstName` do PR 2, sem recriar nenhuma.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/crm-reminder-text.test.ts`:

```ts
// Em UTC de propósito, como o crm-reminder-time.test.ts.
process.env.TZ = 'UTC';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_REMINDER_TEXTS,
  limparEspacos,
  renderReminderText,
  type ReminderTextInput,
} from './crm-reminder-text';

/** Visita de quinta, 01/10, às 18:00, com o lembrete na véspera. O exemplo do mockup. */
const VISITA: ReminderTextInput = {
  template: DEFAULT_REMINDER_TEXTS.visita,
  contactName: 'Mariana Lima',
  attendeeFirstName: 'Mariana',
  isWard: false,
  appointmentAt: new Date('2026-10-01T18:00:00-03:00'),
  sendAt: new Date('2026-09-30T18:00:00-03:00'),
  unit: 'Centro',
  unitAddress: 'Rua Garibaldi, 1200',
  modality: null,
  professorName: null,
  soloTraining: false,
  schedulerName: 'Ana Souza',
};

/** Aula experimental de Pilates do Pedro, filho da Mariana, na sexta, 02/10, às 19:00. */
const AULA_DO_MENOR: ReminderTextInput = {
  template: DEFAULT_REMINDER_TEXTS.aula_experimental,
  contactName: 'Mariana Souza',
  attendeeFirstName: 'Pedro',
  isWard: true,
  appointmentAt: new Date('2026-10-02T19:00:00-03:00'),
  sendAt: new Date('2026-10-01T18:00:00-03:00'),
  unit: null,
  unitAddress: null,
  modality: 'Pilates',
  professorName: 'Carla Dias',
  soloTraining: false,
  schedulerName: 'Ana Souza',
};

test('texto padrão da visita, da própria pessoa (a prévia do mockup)', () => {
  assert.equal(
    renderReminderText(VISITA),
    'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
  );
});

test('texto padrão da aula de um menor: [primeiro_nome] é quem recebe e [do_aluno] vira "de Pedro"', () => {
  assert.equal(
    renderReminderText(AULA_DO_MENOR),
    'Oi, Mariana! Passando para lembrar da aula experimental de Pilates de Pedro amanhã, sexta-feira (02/10), às 19h. Até lá!',
  );
});

test('[dia] é relativo ao dia em que o lembrete sai: hoje, amanhã e outro dia', () => {
  const hoje = renderReminderText({
    ...VISITA,
    template: '[dia] às [hora]',
    appointmentAt: new Date('2026-10-01T18:30:00-03:00'),
    sendAt: new Date('2026-10-01T15:30:00-03:00'),
  });
  assert.equal(hoje, 'hoje (01/10) às 18h30');

  const amanha = renderReminderText({ ...VISITA, template: '[dia]' });
  assert.equal(amanha, 'amanhã, quinta-feira (01/10)');

  const outroDia = renderReminderText({
    ...VISITA,
    template: '[dia]',
    appointmentAt: new Date('2026-10-02T10:00:00-03:00'),
    sendAt: new Date('2026-09-30T10:00:00-03:00'),
  });
  assert.equal(outroDia, 'sexta-feira (02/10)');
});

test('cada variável da tabela da spec', () => {
  const texto = renderReminderText({
    ...AULA_DO_MENOR,
    template:
      '[primeiro_nome] | [do_aluno] | [dia] | [hora] | [unidade] | [endereco] | [modalidade] | [professor_da_aula] | [meu_primeiro_nome]',
    unit: 'Centro',
    unitAddress: 'Rua Garibaldi, 1200',
  });
  assert.equal(
    texto,
    'Mariana | de Pedro | amanhã, sexta-feira (02/10) | 19h | Centro | Rua Garibaldi, 1200 | Pilates | Carla | Ana',
  );
});

test('"Treina sozinho" some com o [professor_da_aula], e a vírgula que sobra também', () => {
  const texto = renderReminderText({ ...AULA_DO_MENOR, template: 'Até lá, [professor_da_aula]!', soloTraining: true });
  assert.equal(texto, 'Até lá!');
});

test('contato sem nome, ou com telefone no lugar do nome, começa em "Oi!"', () => {
  for (const contactName of [null, '', '+55 51 99999-8888']) {
    assert.equal(
      renderReminderText({ ...VISITA, contactName }),
      'Oi! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
      String(contactName),
    );
  }
});

test('[do_aluno] some quando o agendamento é da própria pessoa, mesmo com o nome de quem vai', () => {
  assert.equal(renderReminderText({ ...VISITA, template: 'visita [do_aluno] [dia]' }), 'visita amanhã, quinta-feira (01/10)');
});

test('maiúscula, acento e espaço no nome da variável não importam', () => {
  const texto = renderReminderText({ ...VISITA, template: '[Primeiro_Nome], [endereço], [DIA], [primeiro nome]' });
  assert.equal(texto, 'Mariana, Rua Garibaldi, 1200, amanhã, quinta-feira (01/10), Mariana');
});

test('variável que o lembrete não conhece fica escrita como está, inclusive o [professor]', () => {
  assert.equal(renderReminderText({ ...VISITA, template: '[professor] e [aluno]' }), '[professor] e [aluno]');
});

test('academia sem unidade: o "na unidade" sai junto com a vírgula', () => {
  assert.equal(
    renderReminderText({ ...VISITA, unit: null, unitAddress: null }),
    'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h. Até lá!',
  );
});

test('a quebra de linha do texto fica', () => {
  assert.equal(
    renderReminderText({ ...VISITA, template: 'Oi, [primeiro_nome]!\n\nAté [dia].' }),
    'Oi, Mariana!\n\nAté amanhã, quinta-feira (01/10).',
  );
});

test('limpeza: espaço repetido, espaço antes de pontuação e vírgula antes de pontuação', () => {
  assert.equal(limparEspacos('Oi, !'), 'Oi!');
  assert.equal(limparEspacos('da visita  amanhã'), 'da visita amanhã');
  assert.equal(limparEspacos('de Pilates . Até'), 'de Pilates. Até');
  assert.equal(limparEspacos('a,, b'), 'a, b');
  assert.equal(limparEspacos('  linha com sobra  \n  outra '), 'linha com sobra\noutra');
});

test('os textos padrão são os do schema.prisma, que a migration grava em toda academia', () => {
  const schema = readFileSync(path.join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
  assert.ok(schema.includes(`@default("${DEFAULT_REMINDER_TEXTS.visita}")`), 'texto da visita');
  assert.ok(schema.includes(`@default("${DEFAULT_REMINDER_TEXTS.aula_experimental}")`), 'texto da aula');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com `Cannot find module './crm-reminder-text'`.

- [ ] **Step 3: Implementar `backend/src/services/crm-reminder-text.ts`**

```ts
// O texto do lembrete de agendamento. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// seção "Configuração" (variáveis e textos padrão).
//
// Módulo puro, no horário de Brasília pelas funções de texto do agendamento
// (crm-appointment-text.ts, do PR 2). A troca segue a das mensagens prontas
// (frontend/src/lib/replyTemplate.ts): maiúscula, acento, espaço e hífen no
// nome da variável não importam, e variável desconhecida fica escrita como
// está. A diferença é que variável conhecida sem valor some, porque o
// lembrete sai sozinho e ninguém revisa antes de enviar.
import { dayPhrase, firstName, hourPhrase } from './crm-appointment-text';
import type { CrmReminderType } from './crm-reminder-time';

/**
 * Os textos padrão da spec. São também os padrões dos campos da Organization
 * no schema.prisma, e o teste trava os dois juntos.
 */
export const DEFAULT_REMINDER_TEXTS: Record<CrmReminderType, string> = {
  visita:
    'Oi, [primeiro_nome]! Passando para lembrar da visita [do_aluno] [dia], às [hora], na unidade [unidade]. Até lá!',
  aula_experimental:
    'Oi, [primeiro_nome]! Passando para lembrar da aula experimental de [modalidade] [do_aluno] [dia], às [hora]. Até lá!',
};

/** Teto dos textos do lembrete, na configuração e no "Editar texto" do balão. */
export const REMINDER_TEXT_MAX = 1000;

/**
 * As variáveis que o lembrete troca, sem colchete. O `[professor]` não entra,
 * porque nas mensagens prontas ele quer dizer "quem está logado".
 */
export const REMINDER_VARIABLES = [
  'primeiro_nome',
  'do_aluno',
  'dia',
  'hora',
  'unidade',
  'endereco',
  'modalidade',
  'professor_da_aula',
  'meu_primeiro_nome',
] as const;
export type ReminderVariable = (typeof REMINDER_VARIABLES)[number];

export interface ReminderTextInput {
  template: string;
  /** Nome do contato, quem recebe a mensagem: [primeiro_nome]. */
  contactName: string | null;
  /** Primeiro nome de quem vai à visita ou à aula: o [do_aluno] quando é menor. */
  attendeeFirstName: string | null;
  isWard: boolean;
  appointmentAt: Date;
  /** Quando o lembrete sai. O [dia] é relativo a este dia. */
  sendAt: Date;
  unit: string | null;
  unitAddress: string | null;
  modality: string | null;
  professorName: string | null;
  soloTraining: boolean;
  /** Nome de quem agendou: [meu_primeiro_nome]. */
  schedulerName: string | null;
}

const EH_VARIAVEL = new Set<string>(REMINDER_VARIABLES);

/** O trecho "na unidade [unidade]", com a vírgula e o espaço antes dele. */
const SEM_UNIDADE = /,?\s*na unidade\s*\[\s*unidade\s*\]/gi;

/** O nome da variável do jeito que as mensagens prontas comparam. */
function chave(bruta: string): string {
  return bruta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '_')
    .trim();
}

function valores(input: ReminderTextInput): Record<ReminderVariable, string> {
  const texto = (v: string | null) => v?.trim() ?? '';
  return {
    primeiro_nome: firstName(input.contactName) ?? '',
    do_aluno: input.isWard && input.attendeeFirstName ? `de ${input.attendeeFirstName}` : '',
    dia: dayPhrase(input.appointmentAt, input.sendAt),
    hora: hourPhrase(input.appointmentAt),
    unidade: texto(input.unit),
    endereco: texto(input.unitAddress),
    modalidade: texto(input.modality),
    professor_da_aula: input.soloTraining ? '' : (firstName(input.professorName) ?? ''),
    meu_primeiro_nome: firstName(input.schedulerName) ?? '',
  };
}

/**
 * A variável que sumiu deixa espaço sobrando. Linha por linha: espaço
 * repetido vira um só, espaço antes de pontuação sai, e a vírgula que ficou
 * antes de outra pontuação também ("Oi, !" vira "Oi!"). A quebra de linha
 * que a academia escreveu fica.
 */
export function limparEspacos(texto: string): string {
  return texto
    .split('\n')
    .map((linha) =>
      linha
        .replace(/[ \t]+/g, ' ')
        .replace(/ ([,.!?;:])/g, '$1')
        .replace(/,(?=[,.!?;:])/g, '')
        .trim(),
    )
    .join('\n')
    .trim();
}

/** O texto do lembrete, com as variáveis trocadas e o espaço limpo. */
export function renderReminderText(input: ReminderTextInput): string {
  const v = valores(input);
  // Academia sem unidade: o "na unidade [unidade]" sai inteiro, com a vírgula
  // antes dele, a mesma ideia da confirmação ("academia sem unidade sai sem
  // 'na unidade'"). Sem isso o texto padrão sairia "às 18h, na unidade. Até lá!".
  const template = v.unidade ? input.template : input.template.replace(SEM_UNIDADE, '');
  const trocado = template.replace(/\[([^[\]\n]{1,40})\]/g, (literal, bruta: string) => {
    const k = chave(bruta);
    return EH_VARIAVEL.has(k) ? v[k as ReminderVariable] : literal;
  });
  return limparEspacos(trocado);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 13 testes novos e a suíte inteira verde. Se só o teste de "outro dia" falhar, confira o formato do `dayPhrase` do PR 2 contra o contrato ("quinta-feira (01/10)") antes de mexer aqui: o texto do lembrete segue o do PR 2.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder-text.ts backend/src/services/crm-reminder-text.test.ts
git commit -m "feat: texto do lembrete de agendamento com as variáveis da academia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: As notas da conversa e o exemplo da configuração

**Files:**
- Modify: `backend/src/services/crm-reminder-time.ts` (fim do arquivo)
- Modify: `backend/src/services/crm-reminder-text.ts` (fim do arquivo)
- Test: `backend/src/services/crm-reminder-time.test.ts`, `backend/src/services/crm-reminder-text.test.ts`

As notas seguem a nota 5 das "Notas antes de começar". O exemplo da configuração usa os dados do mockup (nota 13): a visita leva unidade e endereço e não leva modalidade nem professor, e a aula leva modalidade e professor e não leva unidade, como o Stronilead grava de verdade.

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm-reminder-time.test.ts`, acrescentar `amanhaAs` ao import do topo (a lista fica em ordem alfabética: `amanhaAs, instanteDoTexto, noReminderText, ...`) e, no fim do arquivo:

```ts
test('amanhã às 18:00 é o dia seguinte no calendário de Brasília', () => {
  assert.equal(amanhaAs(AGORA, '18:00').toISOString(), '2026-09-30T21:00:00.000Z');
  // 29/09 às 22:30 em Brasília já é 30/09 em UTC. Amanhã continua sendo 30/09.
  assert.equal(amanhaAs(new Date('2026-09-29T22:30:00-03:00'), '18:00').toISOString(), '2026-09-30T21:00:00.000Z');
});
```

Em `backend/src/services/crm-reminder-text.test.ts`, trocar o import de `./crm-reminder-text` por:

```ts
import {
  DEFAULT_REMINDER_TEXTS,
  exampleReminderTexts,
  limparEspacos,
  reminderNoteContent,
  reminderNoteText,
  renderReminderText,
  type ReminderTextInput,
} from './crm-reminder-text';
```

E acrescentar no fim do arquivo:

```ts
// ── Notas da conversa ──────────────────────────────────────────────────────

test('notas da visita: cancelado, não enviado, sem resposta e atrasado', () => {
  assert.equal(
    reminderNoteText({ kind: 'cancelado', type: 'visita' }),
    'Lembrete da visita cancelado: o agendamento mudou no Stronilead.',
  );
  assert.equal(
    reminderNoteText({ kind: 'nao_enviado_mudou', type: 'visita' }),
    'Lembrete da visita não enviado: o agendamento mudou no Stronilead.',
  );
  assert.equal(
    reminderNoteText({ kind: 'sem_resposta', type: 'visita' }),
    'Lembrete da visita não enviado: o Stronilead não respondeu para confirmar o horário.',
  );
  assert.equal(
    reminderNoteText({ kind: 'atrasado', type: 'visita' }),
    'Lembrete da visita não enviado: passou da hora de enviar.',
  );
});

test('nota de remarcado leva o dia e a hora novos do lembrete, em Brasília', () => {
  assert.equal(
    reminderNoteText({ kind: 'remarcado', type: 'visita', at: new Date('2026-10-02T21:00:00.000Z') }),
    'Lembrete da visita remarcado para 02/10 às 18:00, junto com o agendamento.',
  );
});

test('na aula, a nota diz aula experimental', () => {
  assert.equal(
    reminderNoteText({ kind: 'cancelado', type: 'aula_experimental' }),
    'Lembrete da aula experimental cancelado: o agendamento mudou no Stronilead.',
  );
});

test('nota do lembrete desligado nas configurações', () => {
  assert.equal(
    reminderNoteText({ kind: 'desligado', type: 'visita' }),
    'Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações.',
  );
  assert.equal(
    reminderNoteText({ kind: 'desligado', type: 'aula_experimental' }),
    'Lembrete da aula experimental cancelado: o lembrete de agendamento foi desligado nas configurações.',
  );
});

test('a nota vai gravada como o payload que a conversa desenha em pílula', () => {
  assert.deepEqual(JSON.parse(reminderNoteContent({ kind: 'cancelado', type: 'visita' })), {
    kind: 'crm_reminder_note',
    event: 'cancelado',
    text: 'Lembrete da visita cancelado: o agendamento mudou no Stronilead.',
  });
});

// ── Exemplo da configuração ────────────────────────────────────────────────

const AGORA_CONFIG = new Date('2026-09-29T15:40:00-03:00');

test('exemplo da configuração: os dois textos padrão com os dados do mockup', () => {
  assert.deepEqual(
    exampleReminderTexts({
      visitText: DEFAULT_REMINDER_TEXTS.visita,
      trialText: DEFAULT_REMINDER_TEXTS.aula_experimental,
      adminName: 'Johnny Bittencourt',
      now: AGORA_CONFIG,
    }),
    {
      visit: 'Oi, Mariana! Passando para lembrar da visita amanhã, quarta-feira (30/09), às 18h, na unidade Centro. Até lá!',
      trial: 'Oi, Mariana! Passando para lembrar da aula experimental de Pilates amanhã, quarta-feira (30/09), às 18h. Até lá!',
    },
  );
});

test('exemplo da configuração: [meu_primeiro_nome] é quem está logado, e a aula tem professor', () => {
  const r = exampleReminderTexts({
    visitText: 'Aqui é [meu_primeiro_nome], da unidade [unidade] ([endereco]).',
    trialText: 'Com [professor_da_aula], na unidade [unidade].',
    adminName: 'Johnny Bittencourt',
    now: AGORA_CONFIG,
  });
  assert.equal(r.visit, 'Aqui é Johnny, da unidade Centro (Rua Garibaldi, 1200).');
  // A aula não tem unidade: o "na unidade [unidade]" sai junto com a vírgula.
  assert.equal(r.trial, 'Com Carla.');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `amanhaAs`, `exampleReminderTexts`, `reminderNoteContent` e `reminderNoteText` não existem.

- [ ] **Step 3: Implementar**

No fim de `backend/src/services/crm-reminder-time.ts`:

```ts
/** A hora "HH:MM" do dia seguinte a `now`, no calendário de Brasília. */
export function amanhaAs(now: Date, hhmm: string): Date {
  const p = partesDeBrasilia(now);
  const amanha = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const [hora, minuto] = hhmm.split(':').map(Number);
  return instanteDeBrasilia(amanha.getUTCFullYear(), amanha.getUTCMonth() + 1, amanha.getUTCDate(), hora, minuto);
}

/** "02/10 às 18:00", em Brasília. */
export function diaEHora(at: Date): string {
  const p = partesDeBrasilia(at);
  return `${pad(p.day)}/${pad(p.month)} às ${pad(p.hour)}:${pad(p.minute)}`;
}
```

No topo de `backend/src/services/crm-reminder-text.ts`, trocar a linha `import type { CrmReminderType } from './crm-reminder-time';` por:

```ts
import { amanhaAs, diaEHora, type CrmReminderType } from './crm-reminder-time';
```

E, no fim do mesmo arquivo:

```ts
// ── Notas da conversa ──────────────────────────────────────────────────────

/**
 * A nota que a conversa ganha quando o lembrete muda ou não sai.
 * `cancelado` é da varredura; `nao_enviado_mudou`, da conferência na hora de
 * enviar (o texto do mockup nesse momento); `atrasado`, do lembrete que
 * passou da janela porque o Stronizap estava fora do ar; `desligado`, do
 * lembrete pendente de uma academia que desligou o lembrete.
 */
export type ReminderNote =
  | { kind: 'cancelado' | 'nao_enviado_mudou' | 'sem_resposta' | 'atrasado' | 'desligado'; type: CrmReminderType }
  | { kind: 'remarcado'; type: CrmReminderType; at: Date };

/** "visita" ou "aula experimental": o que o lembrete lembra. */
export function reminderSubject(type: CrmReminderType): string {
  return type === 'visita' ? 'visita' : 'aula experimental';
}

export function reminderNoteText(note: ReminderNote): string {
  const lembrete = `Lembrete da ${reminderSubject(note.type)}`;
  if (note.kind === 'remarcado') {
    return `${lembrete} remarcado para ${diaEHora(note.at)}, junto com o agendamento.`;
  }
  if (note.kind === 'cancelado') return `${lembrete} cancelado: o agendamento mudou no Stronilead.`;
  if (note.kind === 'nao_enviado_mudou') return `${lembrete} não enviado: o agendamento mudou no Stronilead.`;
  if (note.kind === 'sem_resposta') {
    return `${lembrete} não enviado: o Stronilead não respondeu para confirmar o horário.`;
  }
  if (note.kind === 'desligado') {
    return `${lembrete} cancelado: o lembrete de agendamento foi desligado nas configurações.`;
  }
  return `${lembrete} não enviado: passou da hora de enviar.`;
}

/**
 * Marca do payload da nota do lembrete. Mantida em sincronia com
 * `frontend/src/lib/reminderNote.ts`, que reconhece o payload e desenha a
 * pílula do mockup, no molde do `transfer_note` da transferência.
 */
export const REMINDER_NOTE_KIND = 'crm_reminder_note';

/**
 * O `content` da mensagem interna da nota: um JSON com a marca, o evento e o
 * texto pronto. A mensagem continua INTERNAL, então não vai para o WhatsApp.
 */
export function reminderNoteContent(note: ReminderNote): string {
  return JSON.stringify({ kind: REMINDER_NOTE_KIND, event: note.kind, text: reminderNoteText(note) });
}

// ── Exemplo da configuração ────────────────────────────────────────────────

/**
 * Os dois textos da configuração montados com os dados de exemplo do mockup:
 * Mariana, visita amanhã às 18:00 na unidade Centro (Rua Garibaldi, 1200) e
 * aula de Pilates com Carla Dias no mesmo horário, com o lembrete saindo
 * agora. A visita não tem modalidade nem professor, e a aula não tem unidade,
 * como o Stronilead grava. O [meu_primeiro_nome] é quem está logado, como na
 * prévia das mensagens prontas. É a mesma montagem do lembrete de verdade,
 * então a prévia nunca diverge do que sai.
 */
export function exampleReminderTexts(input: {
  visitText: string;
  trialText: string;
  adminName: string | null;
  now: Date;
}): { visit: string; trial: string } {
  const comum = {
    contactName: 'Mariana Lima',
    attendeeFirstName: 'Mariana',
    isWard: false,
    appointmentAt: amanhaAs(input.now, '18:00'),
    sendAt: input.now,
    soloTraining: false,
    schedulerName: input.adminName,
  };
  return {
    visit: renderReminderText({
      ...comum,
      template: input.visitText,
      unit: 'Centro',
      unitAddress: 'Rua Garibaldi, 1200',
      modality: null,
      professorName: null,
    }),
    trial: renderReminderText({
      ...comum,
      template: input.trialText,
      unit: null,
      unitAddress: null,
      modality: 'Pilates',
      professorName: 'Carla Dias',
    }),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 8 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder-time.ts backend/src/services/crm-reminder-time.test.ts backend/src/services/crm-reminder-text.ts backend/src/services/crm-reminder-text.test.ts
git commit -m "feat: notas do lembrete na conversa e exemplo da configuração

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `fetchCrmAppointmentStatus` no `crm.service.ts`

**Files:**
- Modify: `backend/src/services/crm.service.ts` (o tipo `AcaoDaPonte`, que o PR 2 criou logo antes de `type Pedido =`, e o fim do arquivo)
- Test: `backend/src/services/crm.service.test.ts`

A leitora da ação `appointment-status`, no molde de `fetchCrmLeadOptions`: mesmo `pedirAoCrm`, mesmo `interpretar`, 4 segundos. Cada agendamento é lido pelo `lerDetalheDoAgendamento` que o PR 2 criou (privado, no mesmo arquivo): o `AppointmentDetail` é montado de novo, campo a campo, e o que o Stronilead mandar a mais morre ali. Aqui só se confere que todo lead pedido veio e que o detalhe é daquele lead. Resposta fora do combinado vale como "sem resposta", e o lembrete espera (nota 6).

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm.service.test.ts`, acrescentar ao import de `./crm.service` do topo, mantendo a ordem alfabética da lista, os nomes `APPOINTMENT_STATUS_MAX`, `APPOINTMENT_STATUS_TIMEOUT_MS`, `fetchCrmAppointmentStatus` e `type CrmAppointmentDetail` (este último pode já estar lá, trazido pelo PR 2).

E acrescentar no fim do arquivo:

```ts
// ── Lembrete: appointment-status ───────────────────────────────────────────

const DETALHE_VISITA: CrmAppointmentDetail = {
  leadId: 'L1',
  leadName: 'Mariana Lima',
  type: 'visita',
  at: '2026-10-01T21:00:00.000Z',
  unit: 'Centro',
  unitAddress: 'Rua Garibaldi, 1200',
  modality: null,
  professorName: null,
  soloTraining: false,
  quantity: null,
  outcome: null,
};

test('estado dos agendamentos: manda a ação, o tenant e os leads, com a chave no header', async () => {
  const a = ambiente({ respostas: [resposta(200, { appointments: { L1: DETALHE_VISITA, L2: null } })] });

  await fetchCrmAppointmentStatus('org1', ['L1', 'L2'], a.deps);

  const [url, init] = a.chamadasFetch[0] as unknown as [
    string,
    { method: string; headers: Record<string, string>; body: string },
  ];
  assert.equal(url, 'https://crm-stronix.vercel.app/api/zap');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-stronizap-key'], 'chave-em-claro');
  assert.deepEqual(JSON.parse(init.body), {
    action: 'appointment-status',
    tenant: 'stronix',
    leadIds: ['L1', 'L2'],
  });
});

test('estado dos agendamentos: 200 vira o mapa, com null para quem não tem agendamento', async () => {
  const a = ambiente({ respostas: [resposta(200, { appointments: { L1: DETALHE_VISITA, L2: null } })] });

  assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1', 'L2'], a.deps), {
    ok: true,
    value: { L1: DETALHE_VISITA, L2: null },
  });
});

test('estado dos agendamentos: lista fechada, campo a mais do Stronilead não passa', async () => {
  const a = ambiente({
    respostas: [
      resposta(200, {
        appointments: { L1: { ...DETALHE_VISITA, phone: '5551999998888', consultantEmail: 'ana@academia.com' } },
        extra: 1,
      }),
    ],
  });

  assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1'], a.deps), {
    ok: true,
    value: { L1: DETALHE_VISITA },
  });
});

test('estado dos agendamentos: aula com professor, quantidade e desfecho', async () => {
  const aula: CrmAppointmentDetail = {
    ...DETALHE_VISITA,
    type: 'aula_experimental',
    unit: null,
    unitAddress: null,
    modality: 'Pilates',
    professorName: 'Carla Dias',
    quantity: 2,
    outcome: 'attended',
  };
  const a = ambiente({ respostas: [resposta(200, { appointments: { L1: aula } })] });

  assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1'], a.deps), { ok: true, value: { L1: aula } });
});

test('estado dos agendamentos: lead pedido que não veio, ou detalhe fora do combinado, é indisponivel', async () => {
  for (const appointments of [
    { L1: DETALHE_VISITA },
    { L1: { ...DETALHE_VISITA, type: 'ligacao' }, L2: null },
    { L1: { ...DETALHE_VISITA, at: 'amanhã' }, L2: null },
    { L1: { ...DETALHE_VISITA, leadId: 'L9' }, L2: null },
  ]) {
    const a = ambiente({ respostas: [resposta(200, { appointments })] });
    assert.deepEqual(
      await fetchCrmAppointmentStatus('org1', ['L1', 'L2'], a.deps),
      { ok: false, kind: 'indisponivel' },
      JSON.stringify(appointments),
    );
  }
});

test('estado dos agendamentos: desfecho remarcado chega como sem desfecho, a regra do PR 2', async () => {
  const a = ambiente({
    respostas: [resposta(200, { appointments: { L1: { ...DETALHE_VISITA, outcome: 'rescheduled' } } })],
  });

  assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1'], a.deps), {
    ok: true,
    value: { L1: DETALHE_VISITA },
  });
});

test('estado dos agendamentos: lista vazia não chama o CRM', async () => {
  const a = ambiente();

  assert.deepEqual(await fetchCrmAppointmentStatus('org1', [], a.deps), { ok: true, value: {} });
  assert.equal(a.chamadasFetch.length, 0);
});

test('estado dos agendamentos: mais de 30 leads ou lead repetido é recusado antes de chamar o CRM', async () => {
  const a = ambiente();
  const demais = Array.from({ length: APPOINTMENT_STATUS_MAX + 1 }, (_, i) => `L${i}`);

  await assert.rejects(() => fetchCrmAppointmentStatus('org1', demais, a.deps), /30/);
  await assert.rejects(() => fetchCrmAppointmentStatus('org1', ['L1', 'L1'], a.deps), /repetir/);
  assert.equal(a.chamadasFetch.length, 0);
});

test('estado dos agendamentos: desligado, chave recusada, erro e rede fora', async () => {
  const desligado = ambiente({ org: { ...ORG_CONFIGURADA, crmEnabled: false } });
  assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1'], desligado.deps), {
    ok: false,
    kind: 'desligado',
  });
  assert.equal(desligado.chamadasFetch.length, 0);

  const chave = ambiente({ respostas: [resposta(401, { error: 'Credencial inválida' })] });
  assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1'], chave.deps), {
    ok: false,
    kind: 'chave_invalida',
  });

  for (const r of [resposta(500, { error: 'boom' }), new Error('ECONNRESET')]) {
    const a = ambiente({ respostas: [r] });
    assert.deepEqual(await fetchCrmAppointmentStatus('org1', ['L1'], a.deps), { ok: false, kind: 'indisponivel' });
  }
});

test('estado dos agendamentos: desiste em 4 segundos, e não antes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = ambiente();
  a.deps.httpFetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    });

  let resultado: unknown = 'pendente';
  const pedido = fetchCrmAppointmentStatus('org1', ['L1'], a.deps).then((r) => {
    resultado = r;
  });
  await new Promise((r) => setImmediate(r));

  t.mock.timers.tick(APPOINTMENT_STATUS_TIMEOUT_MS - 1);
  await new Promise((r) => setImmediate(r));
  assert.equal(resultado, 'pendente');

  t.mock.timers.tick(1);
  await pedido;
  assert.deepEqual(resultado, { ok: false, kind: 'indisponivel' });
  assert.equal(APPOINTMENT_STATUS_TIMEOUT_MS, 4000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `APPOINTMENT_STATUS_MAX`, `APPOINTMENT_STATUS_TIMEOUT_MS` e `fetchCrmAppointmentStatus` não existem em `./crm.service`.

- [ ] **Step 3: Implementar em `backend/src/services/crm.service.ts`**

No tipo das ações da ponte, que o PR 2 criou, trocar:

```ts
type AcaoDaPonte = 'lead-options' | 'create-lead' | 'schedule-options' | 'schedule';
```

por:

```ts
type AcaoDaPonte = 'lead-options' | 'create-lead' | 'schedule-options' | 'schedule' | 'appointment-status';
```

E acrescentar no fim do arquivo:

```ts
// ── Lembrete de agendamento: a conferência (PR 3) ──────────────────────────
// Spec: stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "Estado dos agendamentos (appointment-status)". Só lê. Quem usa é a
// conferência do lembrete (crm-reminder.service.ts), na varredura de 15 em 15
// minutos e na hora de enviar.

/** Tempo máximo da conferência. Só leitura, como o cartão. */
export const APPOINTMENT_STATUS_TIMEOUT_MS = TIMEOUT_MS;

/** Teto de leads por pergunta, o mesmo do `match` (operador `in` do Firestore). */
export const APPOINTMENT_STATUS_MAX = MATCH_MAX;

/**
 * `{ appointments }` com todo lead pedido como chave, cada agendamento lido
 * pelo `lerDetalheDoAgendamento` do agendamento (PR 2). Se faltar um lead, se
 * um detalhe vier fora do combinado ou for de outro lead, a resposta inteira
 * vale como sem resposta: o lembrete espera, porque um lembrete com a data
 * errada é pior que nenhum.
 */
function lerEstados(corpo: unknown, leadIds: string[]): Record<string, CrmAppointmentDetail | null> | null {
  const mapa = objeto(objeto(corpo)?.appointments);
  if (!mapa) return null;
  const estados: Record<string, CrmAppointmentDetail | null> = {};
  for (const leadId of leadIds) {
    if (!Object.prototype.hasOwnProperty.call(mapa, leadId)) return null;
    const bruto = mapa[leadId];
    if (bruto === null) {
      estados[leadId] = null;
      continue;
    }
    const detalhe = lerDetalheDoAgendamento(bruto);
    if (!detalhe || detalhe.leadId !== leadId) return null;
    estados[leadId] = detalhe;
  }
  return estados;
}

/**
 * O agendamento que a ficha, o cartão e a Meta mostram hoje para cada lead,
 * ou null quando não há (lead que não existe na academia, sem agendamento ou
 * cancelado). Não usa cache: quem pergunta é a conferência do lembrete, que
 * precisa da resposta de agora.
 */
export async function fetchCrmAppointmentStatus(
  organizationId: string,
  leadIds: string[],
  deps: Partial<CrmDeps> = {},
): Promise<CrmLeadCall<Record<string, CrmAppointmentDetail | null>>> {
  if (leadIds.length === 0) return { ok: true, value: {} };
  if (leadIds.length > APPOINTMENT_STATUS_MAX || new Set(leadIds).size !== leadIds.length) {
    throw new HttpError(400, `De 1 a ${APPOINTMENT_STATUS_MAX} leads por conferência, sem repetir.`);
  }
  const d = { ...depsReais, ...deps };
  const pedido = await pedirAoCrm(
    organizationId,
    'appointment-status',
    { leadIds },
    APPOINTMENT_STATUS_TIMEOUT_MS,
    d,
  );
  return interpretar(pedido, organizationId, 'appointment-status', (corpo) => lerEstados(corpo, leadIds), d.log);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 10 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm.service.test.ts
git commit -m "feat: ponte pergunta ao Stronilead o estado dos agendamentos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `crm-reminder.service.ts`, o lembrete e a troca

**Files:**
- Create: `backend/src/services/crm-reminder.service.ts`
- Test: `backend/src/services/crm-reminder.service.test.ts`

Este arquivo nasce com tudo que as Tasks 8 a 10 e 12 usam: o formato do `crmReminder` (`CrmReminderData`), a configuração da academia, o repositório de verdade (Prisma) e as dependências. A função desta task é `replaceCrmReminder`, a troca: apaga os lembretes agendados do mesmo lead e do mesmo tipo e cria o novo, numa transação que trava a organização (nota 9). Quem a chama é o agendamento do PR 2 (Task 18). O banco de verdade é provado na suíte de isolamento (Task 14).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/crm-reminder.service.test.ts`:

```ts
// Em UTC de propósito, como os testes das contas puras do lembrete.
process.env.TZ = 'UTC';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerLembrete,
  replaceCrmReminder,
  type CrmReminderData,
  type CrmReminderDeps,
  type CrmReminderSettings,
  type ReminderAuthor,
  type ReminderPlace,
  type ReminderRepo,
  type ReminderRow,
} from './crm-reminder.service';
import type { CrmAppointmentDetail } from './crm.service';
import { DEFAULT_REMINDER_TEXTS, reminderNoteText } from './crm-reminder-text';

// O banco, a ponte, o relógio e o socket entram por parâmetro. O repositório
// falso guarda o que o serviço pediu, e o teste confere as decisões: o que
// foi criado, trocado, apagado e anotado, e quem foi avisado.

/** Terça, 29/09/2026, às 15:40 de Brasília. */
const AGORA = new Date('2026-09-29T15:40:00-03:00');

const CONFIG: CrmReminderSettings = {
  enabled: true,
  timing: { mode: 'EVE', eveTime: '18:00', hoursBefore: 3 },
  texts: { visita: DEFAULT_REMINDER_TEXTS.visita, aula_experimental: DEFAULT_REMINDER_TEXTS.aula_experimental },
};

const ANA: ReminderAuthor = { name: 'Ana Souza', showSenderName: false };

/** Visita da Mariana, quinta, 01/10, às 18:00. */
const VISITA: CrmAppointmentDetail = {
  leadId: 'L1',
  leadName: 'Mariana Lima',
  type: 'visita',
  at: '2026-10-01T21:00:00.000Z',
  unit: 'Centro',
  unitAddress: 'Rua Garibaldi, 1200',
  modality: null,
  professorName: null,
  soloTraining: false,
  quantity: null,
  outcome: null,
};

const TEXTO_DA_VISITA =
  'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!';

const LUGAR: ReminderPlace = { organizationId: 'org1', conversationId: 'c1', channelId: 'ch1' };

/** O lembrete dessa visita, agendado para a véspera, como a troca o cria. */
function lembrete(over: Partial<Omit<ReminderRow, 'data'>> & { data?: Partial<CrmReminderData> } = {}): ReminderRow {
  const { data, ...resto } = over;
  return {
    id: 'm1',
    ...LUGAR,
    content: TEXTO_DA_VISITA,
    scheduledFor: new Date('2026-09-30T18:00:00-03:00'),
    contactName: 'Mariana Lima',
    author: ANA,
    data: {
      leadId: 'L1',
      type: 'visita',
      appointmentAt: '2026-10-01T21:00:00.000Z',
      attendeeFirstName: 'Mariana',
      isWard: false,
      customText: false,
      checkedAt: null,
      unansweredSince: null,
      ...data,
    },
    ...resto,
  };
}

type Estados = Record<string, CrmAppointmentDetail | null>;

/**
 * Monta as dependências de teste. `estados` é o que o Stronilead responde
 * (cada lead pedido que não está no mapa volta null); `null` no lugar do
 * mapa é o Stronilead sem responder.
 */
function ambiente(
  opts: {
    agora?: Date;
    settings?: CrmReminderSettings | null;
    author?: ReminderAuthor | null;
    rows?: ReminderRow[];
    estados?: Estados | null;
    removidosNaTroca?: Array<ReminderPlace & { id: string }>;
  } = {},
) {
  const linhas = new Map((opts.rows ?? []).map((r) => [r.id, r]));
  const trocas: Array<Parameters<ReminderRepo['swap']>[0]> = [];
  const gravacoes: Array<{ id: string; patch: Parameters<ReminderRepo['update']>[1] }> = [];
  const removidos: string[] = [];
  const notas: Array<{ lugar: ReminderPlace; texto: string }> = [];
  const eventos: Array<{ para: string; evento: string; payload: unknown }> = [];
  const perguntas: Array<{ org: string; leadIds: string[] }> = [];
  const avisos: string[] = [];

  const repo: ReminderRepo = {
    loadSettings: async () => (opts.settings === undefined ? CONFIG : opts.settings),
    loadAuthor: async () => (opts.author === undefined ? ANA : opts.author),
    swap: async (args) => {
      trocas.push(args);
      return {
        removed: opts.removidosNaTroca ?? [],
        created: args.create ? { id: 'nova', content: args.create.content } : null,
      };
    },
    orgsWithScheduled: async () => [...new Set([...linhas.values()].map((r) => r.organizationId))],
    listUpcoming: async (org, depois, teto) =>
      [...linhas.values()]
        .filter((r) => r.organizationId === org && r.scheduledFor > depois)
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
        .slice(0, teto),
    loadScheduled: async (id) => linhas.get(id) ?? null,
    update: async (id, patch) => {
      const linha = linhas.get(id);
      if (!linha) return null;
      gravacoes.push({ id, patch });
      linhas.set(id, { ...linha, ...(patch.content !== undefined ? { content: patch.content } : {}), ...(patch.scheduledFor ? { scheduledFor: patch.scheduledFor } : {}), data: patch.data });
      return { id, content: patch.content ?? linha.content };
    },
    remove: async (id) => {
      removidos.push(id);
      return linhas.delete(id);
    },
    note: async (lugar, nota) => {
      notas.push({ lugar, texto: reminderNoteText(nota) });
    },
  };

  const deps: CrmReminderDeps = {
    agora: () => opts.agora ?? AGORA,
    repo,
    perguntar: async (org, leadIds) => {
      perguntas.push({ org, leadIds });
      const estados = opts.estados === undefined ? { L1: VISITA } : opts.estados;
      if (estados === null) return { ok: false, kind: 'indisponivel' };
      return { ok: true, value: Object.fromEntries(leadIds.map((id) => [id, estados[id] ?? null])) };
    },
    emitToChannel: (canal, evento, payload) => {
      eventos.push({ para: `canal:${canal}`, evento, payload });
    },
    emitToOrg: (org, evento, payload) => {
      eventos.push({ para: `org:${org}`, evento, payload });
    },
    log: {
      info: () => {},
      warn: (_dados: unknown, msg: string) => {
        avisos.push(msg);
      },
      error: () => {},
    } as unknown as CrmReminderDeps['log'],
  };
  return { deps, linhas, trocas, gravacoes, removidos, notas, eventos, perguntas, avisos };
}

const PEDIDO = {
  ...LUGAR,
  authorId: 'u-ana',
  contactName: 'Mariana Lima',
  appointment: VISITA,
  isWard: false,
  request: { enabled: true, text: null },
};

// ── O formato do crmReminder ───────────────────────────────────────────────

test('crmReminder: lê o que a troca grava e recusa o que não é lembrete', () => {
  assert.deepEqual(lerLembrete(lembrete().data), lembrete().data);
  assert.equal(lerLembrete(null), null);
  assert.equal(lerLembrete({ leadId: 'L1', type: 'ligacao', appointmentAt: '2026-10-01T21:00:00.000Z' }), null);
  assert.equal(lerLembrete({ leadId: '', type: 'visita', appointmentAt: '2026-10-01T21:00:00.000Z' }), null);
  assert.equal(lerLembrete({ leadId: 'L1', type: 'visita', appointmentAt: 'amanhã' }), null);
});

// ── A troca ────────────────────────────────────────────────────────────────

test('troca: cria o lembrete na véspera, com o texto padrão e os dados do agendamento', async () => {
  const a = ambiente();

  const r = await replaceCrmReminder(PEDIDO, a.deps);

  assert.deepEqual(r, { created: true, sendAt: new Date('2026-09-30T18:00:00-03:00') });
  assert.equal(a.trocas.length, 1);
  const troca = a.trocas[0];
  assert.equal(troca.leadId, 'L1');
  assert.equal(troca.type, 'visita');
  assert.deepEqual(troca.create, {
    ...LUGAR,
    authorId: 'u-ana',
    content: TEXTO_DA_VISITA,
    scheduledFor: new Date('2026-09-30T18:00:00-03:00'),
    data: {
      leadId: 'L1',
      type: 'visita',
      appointmentAt: '2026-10-01T21:00:00.000Z',
      attendeeFirstName: 'Mariana',
      isWard: false,
      customText: false,
      checkedAt: AGORA.toISOString(),
      unansweredSince: null,
    },
  });
  assert.deepEqual(a.eventos, [
    {
      para: 'canal:ch1',
      evento: 'new_message',
      payload: { channelId: 'ch1', conversationId: 'c1', message: { id: 'nova', content: TEXTO_DA_VISITA } },
    },
  ]);
});

test('troca: com "Mostrar meu nome" ligado, o nome de quem agendou vai no começo', async () => {
  const a = ambiente({ author: { name: 'Ana Souza', showSenderName: true } });

  await replaceCrmReminder(PEDIDO, a.deps);

  assert.equal(a.trocas[0].create?.content, `*Ana Souza:*\n\n${TEXTO_DA_VISITA}`);
});

test('troca: menor de idade, o [do_aluno] vira "de Pedro" e o [primeiro_nome] é quem recebe', async () => {
  const a = ambiente();

  await replaceCrmReminder(
    {
      ...PEDIDO,
      contactName: 'Mariana Souza',
      isWard: true,
      appointment: { ...VISITA, leadId: 'L2', leadName: 'Pedro Souza' },
    },
    a.deps,
  );

  const criado = a.trocas[0].create;
  assert.equal(
    criado?.content,
    'Oi, Mariana! Passando para lembrar da visita de Pedro amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
  );
  assert.equal(criado?.data.attendeeFirstName, 'Pedro');
  assert.equal(criado?.data.isWard, true);
  assert.equal(a.trocas[0].leadId, 'L2');
});

test('troca: texto mudado à mão vai como está e fica marcado', async () => {
  const a = ambiente();
  const meu = 'Oi, Mariana! Te espero amanhã às 18h. Traz roupa confortável!';

  await replaceCrmReminder({ ...PEDIDO, request: { enabled: true, text: meu } }, a.deps);

  assert.equal(a.trocas[0].create?.content, meu);
  assert.equal(a.trocas[0].create?.data.customText, true);
});

test('troca: texto "mudado" que é igual ao padrão continua sendo o padrão', async () => {
  const a = ambiente();

  await replaceCrmReminder({ ...PEDIDO, request: { enabled: true, text: ` ${TEXTO_DA_VISITA} ` } }, a.deps);

  assert.equal(a.trocas[0].create?.data.customText, false);
});

test('troca: sem lembrete, o anterior do lead e do tipo é apagado do mesmo jeito', async () => {
  for (const [opts, pedido, motivo] of [
    [{ settings: { ...CONFIG, enabled: false } }, PEDIDO, 'desligado'],
    [{}, { ...PEDIDO, request: { enabled: false, text: null } }, 'pedido_sem_lembrete'],
    [{}, { ...PEDIDO, appointment: { ...VISITA, at: '2026-09-29T22:00:00.000Z' } }, 'hora_passada'],
  ] as const) {
    const a = ambiente(opts);
    const r = await replaceCrmReminder(pedido, a.deps);
    assert.deepEqual(r, { created: false, reason: motivo });
    assert.equal(a.trocas.length, 1, motivo);
    assert.equal(a.trocas[0].create, null, motivo);
    assert.equal(a.eventos.length, 0, motivo);
  }
});

test('troca: cada lembrete anterior apagado avisa a organização, como o cancelar', async () => {
  const a = ambiente({
    removidosNaTroca: [
      { id: 'velho-1', organizationId: 'org1', conversationId: 'c1', channelId: 'ch1' },
      { id: 'velho-2', organizationId: 'org1', conversationId: 'c9', channelId: 'ch9' },
    ],
  });

  await replaceCrmReminder(PEDIDO, a.deps);

  assert.deepEqual(
    a.eventos.filter((e) => e.evento === 'message_deleted'),
    [
      { para: 'org:org1', evento: 'message_deleted', payload: { channelId: 'ch1', conversationId: 'c1', messageId: 'velho-1' } },
      { para: 'org:org1', evento: 'message_deleted', payload: { channelId: 'ch9', conversationId: 'c9', messageId: 'velho-2' } },
    ],
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com `Cannot find module './crm-reminder.service'`.

- [ ] **Step 3: Implementar `backend/src/services/crm-reminder.service.ts`**

```ts
// O lembrete de agendamento. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// seção "O lembrete (PR 3)".
//
// O lembrete é uma mensagem agendada comum da conversa (status SCHEDULED e
// scheduledFor), que o agendador envia como qualquer outra. O campo
// `crmReminder` a liga ao agendamento do Stronilead, e este arquivo cuida do
// que é só do lembrete:
//   - a troca: criar o lembrete apaga o anterior do mesmo lead e do mesmo tipo;
//   - a conferência: de 15 em 15 minutos e de novo na hora de enviar, o
//     agendamento de agora no Stronilead decide se o lembrete fica, é refeito
//     ou é cancelado, e cada mudança deixa uma nota interna na conversa;
//   - a prévia do balão, da mesma conta que cria o lembrete.
//
// Banco, ponte, relógio e socket entram por parâmetro, no molde do
// crm-coverage.service.ts: o teste passa as versões dele sem banco e sem rede,
// e o banco de verdade é provado na suíte de isolamento.
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { applySenderName } from '../lib/senderName';
import { emitToChannel, emitToOrg } from '../lib/socket-emitter';
import {
  fetchCrmAppointmentStatus,
  type CrmAppointmentDetail,
  type CrmLeadCall,
} from './crm.service';
import { firstName } from './crm-appointment-text';
import {
  planReminder,
  type CrmReminderTiming,
  type CrmReminderType,
  type NoReminderReason,
} from './crm-reminder-time';
import { reminderNoteContent, renderReminderText, type ReminderNote } from './crm-reminder-text';

/**
 * O que o campo `crmReminder` da mensagem guarda. Os sete primeiros são os
 * da spec; `unansweredSince` marca que o Stronilead não respondeu na hora de
 * enviar, para a nota final dizer o motivo certo.
 */
export interface CrmReminderData {
  /** O lead do Stronilead: o próprio contato ou o menor de quem ele é responsável. */
  leadId: string;
  type: CrmReminderType;
  /** O horário do agendamento, em ISO. É ele que a conferência compara. */
  appointmentAt: string;
  /** Primeiro nome de quem vai, para o [do_aluno]. */
  attendeeFirstName: string | null;
  /** Agendamento de um menor: o [do_aluno] vira "de Pedro". */
  isWard: boolean;
  /** Texto mudado à mão no balão. A conferência nunca remonta esse texto. */
  customText: boolean;
  /** Quando a conferência confirmou o agendamento pela última vez, em ISO. */
  checkedAt: string | null;
  /** Primeira vez em que o Stronilead não respondeu na hora de enviar, em ISO. */
  unansweredSince: string | null;
}

/** O `crmReminder` como veio do banco, conferido campo a campo. Fora do formato, null. */
export function lerLembrete(valor: unknown): CrmReminderData | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const o = valor as Record<string, unknown>;
  const textoOuNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
  if (typeof o.leadId !== 'string' || o.leadId === '') return null;
  if (o.type !== 'visita' && o.type !== 'aula_experimental') return null;
  if (typeof o.appointmentAt !== 'string' || Number.isNaN(new Date(o.appointmentAt).getTime())) return null;
  return {
    leadId: o.leadId,
    type: o.type,
    appointmentAt: o.appointmentAt,
    attendeeFirstName: textoOuNull(o.attendeeFirstName),
    isWard: o.isWard === true,
    customText: o.customText === true,
    checkedAt: textoOuNull(o.checkedAt),
    unansweredSince: textoOuNull(o.unansweredSince),
  };
}

/** A configuração do lembrete da academia (Organization.crmReminder*). */
export interface CrmReminderSettings {
  enabled: boolean;
  timing: CrmReminderTiming;
  texts: Record<CrmReminderType, string>;
}

/** Quem agendou: o nome e a preferência "Mostrar meu nome". */
export interface ReminderAuthor {
  name: string;
  showSenderName: boolean;
}

/** Onde uma nota ou um aviso do socket chega. */
export interface ReminderPlace {
  organizationId: string;
  conversationId: string;
  channelId: string;
}

/** Um lembrete ainda agendado, com o que a conferência precisa para remontar o texto. */
export interface ReminderRow extends ReminderPlace {
  id: string;
  content: string;
  scheduledFor: Date;
  data: CrmReminderData;
  /** Nome do contato da conversa (o do Zap, senão o do WhatsApp), para o [primeiro_nome]. */
  contactName: string | null;
  /** Quem agendou. Null quando o colaborador foi apagado. */
  author: ReminderAuthor | null;
}

/** O lembrete que a troca cria. */
export interface NewReminder extends ReminderPlace {
  authorId: string;
  content: string;
  scheduledFor: Date;
  data: CrmReminderData;
}

/** O que o serviço faz no banco. A versão de verdade está logo abaixo. */
export interface ReminderRepo {
  loadSettings: (organizationId: string) => Promise<CrmReminderSettings | null>;
  loadAuthor: (collaboratorId: string, organizationId: string) => Promise<ReminderAuthor | null>;
  /**
   * Numa transação que trava a organização: apaga os lembretes agendados do
   * lead e do tipo, em qualquer conversa da organização, e cria o novo quando
   * ele vem. Devolve o que apagou e a mensagem criada.
   */
  swap: (args: {
    organizationId: string;
    leadId: string;
    type: CrmReminderType;
    create: NewReminder | null;
  }) => Promise<{ removed: Array<ReminderPlace & { id: string }>; created: unknown | null }>;
  /** Organizações com algum lembrete agendado. */
  orgsWithScheduled: () => Promise<string[]>;
  /** Lembretes agendados da organização que saem depois de `after`, do mais próximo ao mais distante. */
  listUpcoming: (organizationId: string, after: Date, take: number) => Promise<ReminderRow[]>;
  /** O lembrete ainda agendado, ou null (cancelado, já enviado, ou mensagem que não é lembrete). */
  loadScheduled: (messageId: string) => Promise<ReminderRow | null>;
  /** Grava só se ainda estiver agendado. Devolve a mensagem nova, ou null. */
  update: (
    id: string,
    patch: { content?: string; scheduledFor?: Date; data: CrmReminderData },
  ) => Promise<unknown | null>;
  /** Apaga só se ainda estiver agendado. */
  remove: (id: string) => Promise<boolean>;
  /**
   * Nota do lembrete na conversa: mensagem interna sem autor, com o payload
   * que a conversa desenha como a pílula do mockup, e o aviso pelo socket.
   */
  note: (place: ReminderPlace, note: ReminderNote) => Promise<void>;
}

export interface CrmReminderDeps {
  agora: () => Date;
  repo: ReminderRepo;
  perguntar: (
    organizationId: string,
    leadIds: string[],
  ) => Promise<CrmLeadCall<Record<string, CrmAppointmentDetail | null>>>;
  emitToChannel: (channelId: string, event: string, payload: unknown) => void;
  emitToOrg: (organizationId: string, event: string, payload: unknown) => void;
  log: Pick<typeof logger, 'info' | 'warn' | 'error'>;
}

const SENT_BY = { sentBy: { select: { id: true, name: true } } } as const;

/** O que a conferência lê de um lembrete, de uma vez só. */
const SELECAO_DO_LEMBRETE = {
  id: true,
  organizationId: true,
  conversationId: true,
  channelId: true,
  content: true,
  scheduledFor: true,
  crmReminder: true,
  sentBy: { select: { name: true, showSenderName: true } },
  conversation: { select: { contact: { select: { displayName: true, name: true } } } },
} satisfies Prisma.MessageSelect;

type LinhaDoBanco = Prisma.MessageGetPayload<{ select: typeof SELECAO_DO_LEMBRETE }>;

function paraLinha(m: LinhaDoBanco): ReminderRow | null {
  const data = lerLembrete(m.crmReminder);
  if (!data || !m.scheduledFor) return null;
  const contato = m.conversation.contact;
  return {
    id: m.id,
    organizationId: m.organizationId,
    conversationId: m.conversationId,
    channelId: m.channelId,
    content: m.content ?? '',
    scheduledFor: m.scheduledFor,
    data,
    contactName: contato.displayName?.trim() || contato.name?.trim() || null,
    author: m.sentBy,
  };
}

const comoJson = (data: CrmReminderData) => data as unknown as Prisma.InputJsonValue;

const repoReal: ReminderRepo = {
  loadSettings: async (organizationId) => {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        crmReminderEnabled: true,
        crmReminderMode: true,
        crmReminderEveTime: true,
        crmReminderHoursBefore: true,
        crmReminderVisitText: true,
        crmReminderTrialText: true,
      },
    });
    if (!org) return null;
    return {
      enabled: org.crmReminderEnabled,
      timing: {
        mode: org.crmReminderMode,
        eveTime: org.crmReminderEveTime,
        hoursBefore: org.crmReminderHoursBefore,
      },
      texts: { visita: org.crmReminderVisitText, aula_experimental: org.crmReminderTrialText },
    };
  },
  loadAuthor: (collaboratorId, organizationId) =>
    prisma.collaborator.findFirst({
      where: { id: collaboratorId, organizationId },
      select: { name: true, showSenderName: true },
    }),
  swap: ({ organizationId, leadId, type, create }) =>
    prisma.$transaction(async (tx) => {
      // Trava a organização, o mesmo jeito do issueCode do "Esqueci a senha":
      // dois cliques ou duas pessoas agendando o mesmo lead passam aqui um de
      // cada vez e deixam um lembrete só.
      await tx.$queryRaw`SELECT "id" FROM "organizations" WHERE "id" = ${organizationId} FOR NO KEY UPDATE`;
      const removed = await tx.message.findMany({
        where: {
          organizationId,
          status: 'SCHEDULED',
          AND: [
            { crmReminder: { path: ['leadId'], equals: leadId } },
            { crmReminder: { path: ['type'], equals: type } },
          ],
        },
        select: { id: true, organizationId: true, conversationId: true, channelId: true },
      });
      if (removed.length > 0) {
        await tx.message.deleteMany({ where: { id: { in: removed.map((m) => m.id) }, status: 'SCHEDULED' } });
      }
      const created = create
        ? await tx.message.create({
            data: {
              organizationId: create.organizationId,
              waMessageId: `scheduled:${crypto.randomUUID()}`,
              conversationId: create.conversationId,
              channelId: create.channelId,
              direction: 'OUTBOUND',
              type: 'TEXT',
              content: create.content,
              status: 'SCHEDULED',
              sentById: create.authorId,
              scheduledFor: create.scheduledFor,
              createdAt: new Date(),
              crmReminder: comoJson(create.data),
            },
            include: SENT_BY,
          })
        : null;
      return { removed, created };
    }),
  orgsWithScheduled: async () => {
    const linhas = await prisma.message.findMany({
      where: { status: 'SCHEDULED', crmReminder: { not: Prisma.DbNull } },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
    return linhas.map((l) => l.organizationId);
  },
  listUpcoming: async (organizationId, after, take) => {
    const linhas = await prisma.message.findMany({
      where: {
        organizationId,
        status: 'SCHEDULED',
        crmReminder: { not: Prisma.DbNull },
        scheduledFor: { gt: after },
      },
      orderBy: { scheduledFor: 'asc' },
      take,
      select: SELECAO_DO_LEMBRETE,
    });
    return linhas.map(paraLinha).filter((l): l is ReminderRow => l !== null);
  },
  loadScheduled: async (messageId) => {
    const m = await prisma.message.findFirst({
      where: { id: messageId, status: 'SCHEDULED', crmReminder: { not: Prisma.DbNull } },
      select: SELECAO_DO_LEMBRETE,
    });
    return m ? paraLinha(m) : null;
  },
  update: async (id, patch) => {
    const r = await prisma.message.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: {
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.scheduledFor ? { scheduledFor: patch.scheduledFor } : {}),
        crmReminder: comoJson(patch.data),
      },
    });
    if (r.count === 0) return null;
    return prisma.message.findUnique({ where: { id }, include: SENT_BY });
  },
  remove: async (id) => {
    const r = await prisma.message.deleteMany({ where: { id, status: 'SCHEDULED' } });
    return r.count > 0;
  },
  note: async (place, note) => {
    // O mesmo que o createInternalMessage do conversation.service faz, sem
    // autor e com o payload da nota no content (reminderNoteContent): a
    // conversa desenha a pílula do mockup, como o cartão de transferência.
    const nota = await prisma.message.create({
      data: {
        organizationId: place.organizationId,
        waMessageId: `internal:${crypto.randomUUID()}`,
        conversationId: place.conversationId,
        channelId: place.channelId,
        direction: 'INTERNAL',
        type: 'TEXT',
        content: reminderNoteContent(note),
        status: 'SENT',
        sentById: null,
        createdAt: new Date(),
      },
      include: SENT_BY,
    });
    await prisma.conversation.update({
      where: { id: place.conversationId },
      data: { lastMessageAt: nota.createdAt },
    });
    emitToChannel(place.channelId, 'new_message', {
      channelId: place.channelId,
      conversationId: place.conversationId,
      message: nota,
    });
  },
};

const depsReais: CrmReminderDeps = {
  agora: () => new Date(),
  repo: repoReal,
  perguntar: (organizationId, leadIds) => fetchCrmAppointmentStatus(organizationId, leadIds),
  emitToChannel,
  emitToOrg,
  log: logger,
};

// ── A troca ────────────────────────────────────────────────────────────────

export interface ReplaceReminderArgs extends ReminderPlace {
  /** Quem agendou, o autor do lembrete. Sai da sessão, nunca do corpo do pedido. */
  authorId: string;
  /** Nome do contato da conversa, para o [primeiro_nome]. */
  contactName: string | null;
  /** O agendamento como o Stronilead devolveu. */
  appointment: CrmAppointmentDetail;
  /** O agendamento é de um menor de quem o contato é responsável. */
  isWard: boolean;
  /** O que o balão pediu: a chave do lembrete e o texto mudado à mão, ou null. */
  request: { enabled: boolean; text: string | null };
}

export type ReplaceReminderResult =
  | { created: true; sendAt: Date }
  | { created: false; reason: 'desligado' | 'pedido_sem_lembrete' | NoReminderReason };

/**
 * Troca o lembrete de um agendamento: apaga os lembretes agendados do mesmo
 * lead e do mesmo tipo, em toda a organização, e cria o novo. Apaga mesmo
 * quando o novo não é criado (lembrete desligado na academia ou no balão, ou
 * sem tempo para ele), porque o anterior citaria a data antiga.
 */
export async function replaceCrmReminder(
  args: ReplaceReminderArgs,
  deps: Partial<CrmReminderDeps> = {},
): Promise<ReplaceReminderResult> {
  const d = { ...depsReais, ...deps };
  const agora = d.agora();
  const { appointment } = args;
  const settings = await d.repo.loadSettings(args.organizationId);

  let create: NewReminder | null = null;
  let result: ReplaceReminderResult;
  const plano = settings ? planReminder(new Date(appointment.at), settings.timing, agora) : null;
  if (!settings?.enabled || !plano) {
    result = { created: false, reason: 'desligado' };
  } else if (!args.request.enabled) {
    result = { created: false, reason: 'pedido_sem_lembrete' };
  } else if (plano.at === null) {
    result = { created: false, reason: plano.reason };
  } else {
    const author = await d.repo.loadAuthor(args.authorId, args.organizationId);
    const attendeeFirstName = firstName(appointment.leadName);
    const padrao = renderReminderText({
      template: settings.texts[appointment.type],
      contactName: args.contactName,
      attendeeFirstName,
      isWard: args.isWard,
      appointmentAt: new Date(appointment.at),
      sendAt: plano.at,
      unit: appointment.unit,
      unitAddress: appointment.unitAddress,
      modality: appointment.modality,
      professorName: appointment.professorName,
      soloTraining: appointment.soloTraining,
      schedulerName: author?.name ?? null,
    });
    const escrito = args.request.text?.trim() || null;
    const mudado = escrito !== null && escrito !== padrao;
    const texto = mudado ? escrito : padrao;
    create = {
      organizationId: args.organizationId,
      conversationId: args.conversationId,
      channelId: args.channelId,
      authorId: args.authorId,
      content: author ? applySenderName(texto, author) : texto,
      scheduledFor: plano.at,
      data: {
        leadId: appointment.leadId,
        type: appointment.type,
        appointmentAt: new Date(appointment.at).toISOString(),
        attendeeFirstName,
        isWard: args.isWard,
        customText: mudado,
        checkedAt: agora.toISOString(),
        unansweredSince: null,
      },
    };
    result = { created: true, sendAt: plano.at };
  }

  const { removed, created } = await d.repo.swap({
    organizationId: args.organizationId,
    leadId: appointment.leadId,
    type: appointment.type,
    create,
  });
  for (const m of removed) {
    d.emitToOrg(m.organizationId, 'message_deleted', {
      channelId: m.channelId,
      conversationId: m.conversationId,
      messageId: m.id,
    });
  }
  if (create && created) {
    d.emitToChannel(create.channelId, 'new_message', {
      channelId: create.channelId,
      conversationId: create.conversationId,
      message: created,
    });
  }
  // Só ids no log: nome e telefone ficam fora.
  d.log.info(
    { organizationId: args.organizationId, conversationId: args.conversationId, removed: removed.length, created: result.created },
    'Lembrete de agendamento trocado',
  );
  return result;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 8 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder.service.ts backend/src/services/crm-reminder.service.test.ts
git commit -m "feat: lembrete de agendamento como mensagem agendada, com a troca por lead e tipo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: A conferência decide: fica, é refeito ou é cancelado

**Files:**
- Modify: `backend/src/services/crm-reminder.service.ts` (fim do arquivo)
- Test: `backend/src/services/crm-reminder.service.test.ts`

Decisão pura, que a varredura (Task 9) e o envio (Task 10) usam do mesmo jeito. As regras são as da spec, seção "As duas proteções", e a nota 4 das "Notas antes de começar".

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm-reminder.service.test.ts`, acrescentar `decideReminderCheck` ao import de `./crm-reminder.service` (em ordem alfabética, antes de `lerLembrete`) e, no fim do arquivo:

```ts
// ── A decisão da conferência ───────────────────────────────────────────────

function decidir(detail: CrmAppointmentDetail | null, row: ReminderRow = lembrete(), agora = AGORA) {
  return decideReminderCheck({ row, detail, settings: CONFIG, now: agora });
}

test('conferência: sem agendamento, com outro tipo ou com desfecho, cancela', () => {
  assert.deepEqual(decidir(null), { action: 'cancel' });
  assert.deepEqual(decidir({ ...VISITA, type: 'aula_experimental' }), { action: 'cancel' });
  assert.deepEqual(decidir({ ...VISITA, outcome: 'attended' }), { action: 'cancel' });
  assert.deepEqual(decidir({ ...VISITA, outcome: 'no_show' }), { action: 'cancel' });
});

test('conferência: mesmo tipo e horário, nada mudou: fica, só com a hora da conferência', () => {
  assert.deepEqual(decidir(VISITA), {
    action: 'keep',
    content: null,
    data: { ...lembrete().data, checkedAt: AGORA.toISOString() },
  });
});

test('conferência: com o texto padrão, remonta com os dados de agora', () => {
  const r = decidir({ ...VISITA, unit: 'Centro Histórico' });
  assert.equal(r.action, 'keep');
  assert.equal(
    r.action === 'keep' ? r.content : null,
    'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro Histórico. Até lá!',
  );
});

test('conferência: remontado com "Mostrar meu nome" de quem agendou', () => {
  const row = lembrete({ author: { name: 'Ana Souza', showSenderName: true } });
  const r = decidir(VISITA, row);
  assert.equal(r.action === 'keep' ? r.content : null, `*Ana Souza:*\n\n${TEXTO_DA_VISITA}`);
});

test('conferência: texto mudado à mão nunca é remontado', () => {
  const row = lembrete({ content: 'Te espero amanhã!', data: { customText: true } });
  const r = decidir({ ...VISITA, unit: 'Centro Histórico' }, row);
  assert.deepEqual(r, { action: 'keep', content: null, data: { ...row.data, checkedAt: AGORA.toISOString() } });
});

test('conferência: horário novo com o texto padrão, refeito para a véspera nova', () => {
  const r = decidir({ ...VISITA, at: '2026-10-02T21:00:00.000Z' });
  assert.deepEqual(r, {
    action: 'reschedule',
    at: new Date('2026-10-01T18:00:00-03:00'),
    content:
      'Oi, Mariana! Passando para lembrar da visita amanhã, sexta-feira (02/10), às 18h, na unidade Centro. Até lá!',
    data: {
      ...lembrete().data,
      appointmentAt: '2026-10-02T21:00:00.000Z',
      checkedAt: AGORA.toISOString(),
    },
  });
});

test('conferência: horário novo com texto mudado à mão, cancela', () => {
  const row = lembrete({ data: { customText: true } });
  assert.deepEqual(decidir({ ...VISITA, at: '2026-10-02T21:00:00.000Z' }, row), { action: 'cancel' });
});

test('conferência: refeito para uma hora que já passou, cancela', () => {
  // A visita passou para hoje às 19:00, e a véspera dela já foi.
  assert.deepEqual(decidir({ ...VISITA, at: '2026-09-29T22:00:00.000Z' }), { action: 'cancel' });
});

test('conferência: com resposta, a marca de "não respondeu" sai', () => {
  const row = lembrete({ data: { unansweredSince: '2026-09-30T21:00:00.000Z' } });
  const r = decidir(VISITA, row);
  assert.equal(r.action === 'keep' ? r.data.unansweredSince : 'outra', null);
});

test('conferência: o primeiro nome de quem vai acompanha o Stronilead', () => {
  const row = lembrete({ data: { isWard: true, attendeeFirstName: 'Pedro' } });
  const r = decidir({ ...VISITA, leadName: 'Pedrinho Souza' }, row);
  assert.equal(r.action === 'keep' ? r.data.attendeeFirstName : null, 'Pedrinho');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `decideReminderCheck` não existe em `./crm-reminder.service`.

- [ ] **Step 3: Implementar no fim de `backend/src/services/crm-reminder.service.ts`**

```ts
// ── A conferência ──────────────────────────────────────────────────────────

/** O que a conferência decidiu para um lembrete. */
export type ReminderCheck =
  | { action: 'keep'; content: string | null; data: CrmReminderData }
  | { action: 'reschedule'; at: Date; content: string; data: CrmReminderData }
  | { action: 'cancel' };

/**
 * O agendamento de agora no Stronilead decide o lembrete:
 * - sem agendamento, com outro tipo ou com desfecho registrado: cancela;
 * - mesmo tipo e mesmo horário: fica. Com o texto padrão, o texto é
 *   remontado com os dados de agora (unidade, modalidade, professor), para
 *   nunca citar algo que mudou no Stronilead. `content` null quer dizer que o
 *   texto não muda;
 * - mesmo tipo e horário novo: com o texto padrão, refeito para a data nova,
 *   pela configuração de agora da academia; com texto mudado à mão,
 *   cancelado, porque o texto pode citar a data antiga; refeito para uma hora
 *   que já passou, ou a menos de 30 minutos, cancelado.
 */
export function decideReminderCheck(input: {
  row: ReminderRow;
  detail: CrmAppointmentDetail | null;
  settings: CrmReminderSettings;
  now: Date;
}): ReminderCheck {
  const { row, detail, settings, now } = input;
  const antes = row.data;
  if (!detail || detail.type !== antes.type || detail.outcome !== null) return { action: 'cancel' };

  const at = new Date(detail.at);
  const conferido: CrmReminderData = {
    ...antes,
    attendeeFirstName: firstName(detail.leadName) ?? antes.attendeeFirstName,
    checkedAt: now.toISOString(),
    unansweredSince: null,
  };
  const montar = (sendAt: Date): string => {
    const texto = renderReminderText({
      template: settings.texts[antes.type],
      contactName: row.contactName,
      attendeeFirstName: conferido.attendeeFirstName,
      isWard: antes.isWard,
      appointmentAt: at,
      sendAt,
      unit: detail.unit,
      unitAddress: detail.unitAddress,
      modality: detail.modality,
      professorName: detail.professorName,
      soloTraining: detail.soloTraining,
      schedulerName: row.author?.name ?? null,
    });
    return row.author ? applySenderName(texto, row.author) : texto;
  };

  if (at.getTime() === new Date(antes.appointmentAt).getTime()) {
    if (antes.customText) return { action: 'keep', content: null, data: conferido };
    const novo = montar(row.scheduledFor);
    return { action: 'keep', content: novo === row.content ? null : novo, data: conferido };
  }

  if (antes.customText) return { action: 'cancel' };
  const plano = planReminder(at, settings.timing, now);
  if (plano.at === null) return { action: 'cancel' };
  return {
    action: 'reschedule',
    at: plano.at,
    content: montar(plano.at),
    data: { ...conferido, appointmentAt: at.toISOString() },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 10 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder.service.ts backend/src/services/crm-reminder.service.test.ts
git commit -m "feat: conferência decide se o lembrete fica, é refeito ou é cancelado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: A varredura de 15 em 15 minutos

**Files:**
- Modify: `backend/src/services/crm-reminder.service.ts` (imports do topo e fim do arquivo)
- Test: `backend/src/services/crm-reminder.service.test.ts`

No molde da varredura de cobertura (`crm-coverage.service.ts`): organização por organização, em lotes de 30 leads pelo `appointment-status`, e sem resposta a organização fica como estava. Só entram os lembretes que ainda vão sair; os que já estão na hora são do agendador (Task 10). Aplicar a decisão (`aplicarConferencia`) é o mesmo passo na varredura e no envio, com a nota de cada momento (nota 5).

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm-reminder.service.test.ts`, acrescentar `runCrmReminderSweep` ao import de `./crm-reminder.service` (em ordem alfabética, depois de `replaceCrmReminder`) e, no fim do arquivo:

```ts
// ── A varredura ────────────────────────────────────────────────────────────

test('varredura: pergunta em lotes de 30 leads, sem repetir lead', async () => {
  const rows = Array.from({ length: 31 }, (_, i) => lembrete({ id: `m${i}`, data: { leadId: `L${i}` } }));
  rows.push(lembrete({ id: 'aula-do-L0', data: { leadId: 'L0', type: 'aula_experimental' } }));
  const a = ambiente({ rows, estados: {} });

  await runCrmReminderSweep(a.deps);

  assert.equal(a.perguntas.length, 2);
  assert.equal(a.perguntas[0].leadIds.length, 30);
  assert.equal(a.perguntas[1].leadIds.length, 1);
  assert.equal(new Set(a.perguntas.flatMap((p) => p.leadIds)).size, 31);
});

test('varredura: agendamento igual, o lembrete fica, sem nota e sem aviso', async () => {
  const a = ambiente({ rows: [lembrete()] });

  await runCrmReminderSweep(a.deps);

  assert.deepEqual(a.gravacoes, [
    { id: 'm1', patch: { data: { ...lembrete().data, checkedAt: AGORA.toISOString() } } },
  ]);
  assert.equal(a.notas.length, 0);
  assert.equal(a.eventos.length, 0);
});

test('varredura: horário novo, o lembrete é refeito, a conversa é avisada e ganha a nota', async () => {
  const a = ambiente({ rows: [lembrete()], estados: { L1: { ...VISITA, at: '2026-10-02T21:00:00.000Z' } } });

  await runCrmReminderSweep(a.deps);

  assert.equal(
    a.gravacoes[0].patch.scheduledFor?.toISOString(),
    new Date('2026-10-01T18:00:00-03:00').toISOString(),
  );
  assert.deepEqual(
    a.eventos.map((e) => [e.para, e.evento]),
    [['org:org1', 'message_replaced']],
  );
  assert.deepEqual(a.notas, [
    { lugar: LUGAR, texto: 'Lembrete da visita remarcado para 01/10 às 18:00, junto com o agendamento.' },
  ]);
});

test('varredura: agendamento cancelado no Stronilead, o lembrete é apagado com a nota da spec', async () => {
  const a = ambiente({ rows: [lembrete()], estados: {} });

  await runCrmReminderSweep(a.deps);

  assert.deepEqual(a.removidos, ['m1']);
  assert.deepEqual(a.eventos, [
    {
      para: 'org:org1',
      evento: 'message_deleted',
      payload: { channelId: 'ch1', conversationId: 'c1', messageId: 'm1' },
    },
  ]);
  assert.deepEqual(a.notas, [
    { lugar: LUGAR, texto: 'Lembrete da visita cancelado: o agendamento mudou no Stronilead.' },
  ]);
});

test('varredura: Stronilead sem resposta não muda nada e para a organização', async () => {
  const rows = Array.from({ length: 40 }, (_, i) => lembrete({ id: `m${i}`, data: { leadId: `L${i}` } }));
  const a = ambiente({ rows, estados: null });

  await runCrmReminderSweep(a.deps);

  assert.equal(a.perguntas.length, 1);
  assert.equal(a.gravacoes.length + a.removidos.length + a.notas.length, 0);
  assert.equal(a.avisos.length, 1);
});

test('varredura: só confere os lembretes que ainda vão sair', async () => {
  const naHora = lembrete({
    id: 'na-hora',
    scheduledFor: new Date('2026-09-29T15:00:00-03:00'),
    data: { leadId: 'L9' },
  });
  const a = ambiente({ rows: [naHora, lembrete()] });

  await runCrmReminderSweep(a.deps);

  assert.deepEqual(a.perguntas.map((p) => p.leadIds), [['L1']]);
});

test('varredura: lembrete desligado nas configurações cancela os agendados, sem perguntar ao Stronilead', async () => {
  const a = ambiente({ rows: [lembrete()], settings: { ...CONFIG, enabled: false } });

  await runCrmReminderSweep(a.deps);

  assert.equal(a.perguntas.length, 0);
  assert.deepEqual(a.removidos, ['m1']);
  assert.deepEqual(a.notas, [
    {
      lugar: LUGAR,
      texto: 'Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações.',
    },
  ]);
});

test('varredura: cada organização é perguntada só pelos lembretes dela', async () => {
  const a = ambiente({
    rows: [lembrete(), lembrete({ id: 'm2', organizationId: 'org2', data: { leadId: 'L2' } })],
  });

  await runCrmReminderSweep(a.deps);

  assert.deepEqual(
    [...a.perguntas].sort((x, y) => x.org.localeCompare(y.org)),
    [
      { org: 'org1', leadIds: ['L1'] },
      { org: 'org2', leadIds: ['L2'] },
    ],
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `runCrmReminderSweep` não existe em `./crm-reminder.service`.

- [ ] **Step 3: Implementar em `backend/src/services/crm-reminder.service.ts`**

Nos imports do topo, trocar o import de `./crm.service` por:

```ts
import {
  APPOINTMENT_STATUS_MAX,
  fetchCrmAppointmentStatus,
  type CrmAppointmentDetail,
  type CrmLeadCall,
} from './crm.service';
```

E acrescentar no fim do arquivo:

```ts
// ── Aplicar a conferência e a varredura ────────────────────────────────────

/** Lote da conferência: o teto do `appointment-status`. */
const LOTE = APPOINTMENT_STATUS_MAX;
/** Lotes por rodada. 10 x 30 = até 300 lembretes a cada 15 minutos, por organização. */
const LOTES_POR_RODADA = 10;

/** Onde a conferência roda. Muda só o texto da nota do lembrete cancelado. */
type Momento = 'varredura' | 'envio';

/** Como terminou. `sumiu`: o lembrete deixou de estar agendado no meio do caminho. */
type Desfecho = 'fica' | 'refeito' | 'cancelado' | 'sumiu';

function lugarDe(row: ReminderRow): ReminderPlace {
  return { organizationId: row.organizationId, conversationId: row.conversationId, channelId: row.channelId };
}

/**
 * Apaga o lembrete, avisa quem está com a conversa aberta (o mesmo evento do
 * cancelar) e deixa a nota. Não faz nada quando ele já não estava agendado.
 */
async function cancelar(
  row: ReminderRow,
  kind: Exclude<ReminderNote['kind'], 'remarcado'>,
  d: CrmReminderDeps,
): Promise<boolean> {
  if (!(await d.repo.remove(row.id))) return false;
  d.emitToOrg(row.organizationId, 'message_deleted', {
    channelId: row.channelId,
    conversationId: row.conversationId,
    messageId: row.id,
  });
  await d.repo.note(lugarDe(row), { kind, type: row.data.type });
  return true;
}

/**
 * Grava a decisão e avisa quem está com a conversa aberta, pelos mesmos
 * eventos que o agendador e o cancelar usam. Refeito e cancelado deixam nota
 * interna; o que fica não deixa, porque nada mudou para quem recebe.
 */
async function aplicarConferencia(
  row: ReminderRow,
  check: ReminderCheck,
  momento: Momento,
  d: CrmReminderDeps,
): Promise<Desfecho> {
  if (check.action === 'keep') {
    const message = await d.repo.update(row.id, {
      ...(check.content !== null ? { content: check.content } : {}),
      data: check.data,
    });
    if (!message) return 'sumiu';
    if (check.content !== null) {
      d.emitToOrg(row.organizationId, 'message_replaced', {
        channelId: row.channelId,
        conversationId: row.conversationId,
        message,
      });
    }
    return 'fica';
  }

  if (check.action === 'reschedule') {
    const message = await d.repo.update(row.id, {
      content: check.content,
      scheduledFor: check.at,
      data: check.data,
    });
    if (!message) return 'sumiu';
    d.emitToOrg(row.organizationId, 'message_replaced', {
      channelId: row.channelId,
      conversationId: row.conversationId,
      message,
    });
    await d.repo.note(lugarDe(row), { kind: 'remarcado', type: row.data.type, at: check.at });
    return 'refeito';
  }

  const cancelou = await cancelar(row, momento === 'varredura' ? 'cancelado' : 'nao_enviado_mudou', d);
  return cancelou ? 'cancelado' : 'sumiu';
}

/**
 * A varredura de 15 em 15 minutos. Confere no Stronilead os lembretes que
 * ainda vão sair, em lotes de 30 leads. Erro numa organização não derruba as
 * outras, e a organização cujo Stronilead não respondeu fica exatamente como
 * estava: a conferência na hora de enviar pega o que mudar. Academia que
 * desligou o lembrete tem os pendentes cancelados, sem perguntar nada ao
 * Stronilead.
 */
export async function runCrmReminderSweep(deps: Partial<CrmReminderDeps> = {}): Promise<void> {
  const d = { ...depsReais, ...deps };
  const agora = d.agora();

  for (const organizationId of await d.repo.orgsWithScheduled()) {
    try {
      const settings = await d.repo.loadSettings(organizationId);
      if (!settings) continue;
      const lembretes = await d.repo.listUpcoming(organizationId, agora, LOTE * LOTES_POR_RODADA);

      if (!settings.enabled) {
        // Lembrete desligado nas configurações: o que estava agendado não sai.
        // Ligar de novo não traz de volta os cancelados.
        for (const row of lembretes) await cancelar(row, 'desligado', d);
        continue;
      }

      // A mesma pessoa pode ter lembrete de visita e de aula: pergunta uma vez
      // por lead, porque o appointment-status recusa id repetido.
      const porLead = new Map<string, ReminderRow[]>();
      for (const row of lembretes) {
        porLead.set(row.data.leadId, [...(porLead.get(row.data.leadId) ?? []), row]);
      }
      const leads = [...porLead.keys()];

      for (let i = 0; i < leads.length; i += LOTE) {
        const lote = leads.slice(i, i + LOTE);
        const resposta = await d.perguntar(organizationId, lote);
        if (!resposta.ok) {
          d.log.warn({ organizationId, kind: resposta.kind }, 'Conferência dos lembretes parou nesta organização');
          break;
        }
        for (const leadId of lote) {
          for (const row of porLead.get(leadId) ?? []) {
            const check = decideReminderCheck({ row, detail: resposta.value[leadId] ?? null, settings, now: agora });
            await aplicarConferencia(row, check, 'varredura', d);
          }
        }
      }
    } catch (err) {
      d.log.error({ err, organizationId }, 'Conferência dos lembretes falhou (segue no próximo ciclo)');
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 8 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder.service.ts backend/src/services/crm-reminder.service.test.ts
git commit -m "feat: varredura confere os lembretes no Stronilead de 15 em 15 minutos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: A conferência na hora de enviar

**Files:**
- Modify: `backend/src/services/crm-reminder.service.ts` (import de `./crm-reminder-time` e fim do arquivo)
- Test: `backend/src/services/crm-reminder.service.test.ts`

Quem chama é o agendador (Task 11), antes de enviar um lembrete que chegou na hora. Com o Stronilead fora do ar, o lembrete continua agendado e o agendador tenta de novo no minuto seguinte, dentro da janela de `reminderSendable`: até 30 minutos depois da hora dele e nunca depois das 21h (nota 6). Academia que desligou o lembrete tem o pendente cancelado (nota 10).

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm-reminder.service.test.ts`, acrescentar `prepareCrmReminderDispatch` ao import de `./crm-reminder.service` (em ordem alfabética, depois de `lerLembrete`) e, no fim do arquivo:

```ts
// ── Na hora de enviar ──────────────────────────────────────────────────────

/** Quarta, 30/09, às 18:00:30: o lembrete da véspera está na hora. */
const NA_HORA = new Date('2026-09-30T18:00:30-03:00');

test('envio: agendamento confirmado, o lembrete sai', async () => {
  const a = ambiente({ agora: NA_HORA, rows: [lembrete()] });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'enviar');
  assert.deepEqual(a.perguntas, [{ org: 'org1', leadIds: ['L1'] }]);
  assert.equal(a.gravacoes[0].patch.data.checkedAt, NA_HORA.toISOString());
  assert.equal(a.notas.length, 0);
});

test('envio: com o texto padrão, sai com os dados de agora', async () => {
  const a = ambiente({
    agora: NA_HORA,
    rows: [lembrete()],
    estados: { L1: { ...VISITA, unit: 'Centro Histórico' } },
  });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'enviar');
  assert.match(a.gravacoes[0].patch.content ?? '', /na unidade Centro Histórico\./);
});

test('envio: agendamento cancelado, o lembrete não sai e a nota diz "não enviado"', async () => {
  const a = ambiente({ agora: NA_HORA, rows: [lembrete()], estados: {} });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.deepEqual(a.removidos, ['m1']);
  assert.deepEqual(a.notas, [
    { lugar: LUGAR, texto: 'Lembrete da visita não enviado: o agendamento mudou no Stronilead.' },
  ]);
});

test('envio: horário novo, o lembrete é refeito e não sai agora', async () => {
  const a = ambiente({
    agora: NA_HORA,
    rows: [lembrete()],
    estados: { L1: { ...VISITA, at: '2026-10-02T21:00:00.000Z' } },
  });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.equal(
    a.gravacoes[0].patch.scheduledFor?.toISOString(),
    new Date('2026-10-01T18:00:00-03:00').toISOString(),
  );
  assert.deepEqual(
    a.notas.map((n) => n.texto),
    ['Lembrete da visita remarcado para 01/10 às 18:00, junto com o agendamento.'],
  );
});

test('envio: Stronilead sem resposta, espera o próximo minuto e marca quando começou', async () => {
  const a = ambiente({ agora: NA_HORA, rows: [lembrete()], estados: null });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'esperar');
  assert.deepEqual(a.gravacoes, [
    { id: 'm1', patch: { data: { ...lembrete().data, unansweredSince: NA_HORA.toISOString() } } },
  ]);
  assert.equal(a.removidos.length + a.notas.length, 0);

  // A segunda falha não regrava a marca.
  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'esperar');
  assert.equal(a.gravacoes.length, 1);
});

test('envio: aos 30 minutos ainda tenta', async () => {
  const a = ambiente({ agora: new Date('2026-09-30T18:30:00-03:00'), rows: [lembrete()], estados: null });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'esperar');
});

test('envio: passados 30 minutos sem resposta, o lembrete não sai e a nota diz por quê', async () => {
  const row = lembrete({ data: { unansweredSince: '2026-09-30T21:00:30.000Z' } });
  const a = ambiente({ agora: new Date('2026-09-30T18:30:01-03:00'), rows: [row], estados: null });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.equal(a.perguntas.length, 0);
  assert.deepEqual(a.removidos, ['m1']);
  assert.deepEqual(a.notas, [
    {
      lugar: LUGAR,
      texto: 'Lembrete da visita não enviado: o Stronilead não respondeu para confirmar o horário.',
    },
  ]);
});

test('envio: com o Stronizap fora do ar na hora, o lembrete atrasado não sai', async () => {
  const a = ambiente({ agora: new Date('2026-09-30T19:10:00-03:00'), rows: [lembrete()] });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.deepEqual(a.notas.map((n) => n.texto), ['Lembrete da visita não enviado: passou da hora de enviar.']);
});

test('envio: a janela fecha às 21h: o lembrete das 20:50 sem resposta não tenta depois das 21:00', async () => {
  const row = lembrete({
    scheduledFor: new Date('2026-09-30T20:50:00-03:00'),
    data: { unansweredSince: '2026-09-30T23:50:30.000Z' },
  });
  const a = ambiente({ agora: new Date('2026-09-30T21:01:00-03:00'), rows: [row], estados: null });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.equal(a.perguntas.length, 0);
  assert.deepEqual(a.notas.map((n) => n.texto), [
    'Lembrete da visita não enviado: o Stronilead não respondeu para confirmar o horário.',
  ]);
});

test('envio: o lembrete das 21:00 sai no minuto dele', async () => {
  const row = lembrete({ scheduledFor: new Date('2026-09-30T21:00:00-03:00') });
  const a = ambiente({ agora: new Date('2026-09-30T21:00:40-03:00'), rows: [row] });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'enviar');
});

test('envio: lembrete desligado nas configurações depois de agendado não sai e deixa a nota', async () => {
  const a = ambiente({ agora: NA_HORA, rows: [lembrete()], settings: { ...CONFIG, enabled: false } });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.equal(a.perguntas.length, 0);
  assert.deepEqual(a.removidos, ['m1']);
  assert.deepEqual(a.notas.map((n) => n.texto), [
    'Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações.',
  ]);
});

test('envio: lembrete cancelado na conversa antes da hora nem é perguntado', async () => {
  const a = ambiente({ agora: NA_HORA, rows: [] });

  assert.equal(await prepareCrmReminderDispatch('m1', a.deps), 'nao_enviar');
  assert.equal(a.perguntas.length, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `prepareCrmReminderDispatch` não existe em `./crm-reminder.service`.

- [ ] **Step 3: Implementar em `backend/src/services/crm-reminder.service.ts`**

No import de `./crm-reminder-time` do topo, acrescentar `reminderSendable`:

```ts
import {
  planReminder,
  reminderSendable,
  type CrmReminderTiming,
  type CrmReminderType,
  type NoReminderReason,
} from './crm-reminder-time';
```

E acrescentar no fim do arquivo:

```ts
// ── Na hora de enviar ──────────────────────────────────────────────────────

/** O que o agendador faz com um lembrete que chegou na hora. */
export type DispatchDecision = 'enviar' | 'esperar' | 'nao_enviar';

/**
 * A conferência na hora de enviar.
 * - `enviar`: o agendamento continua no mesmo dia e horário, e o texto
 *   padrão já foi remontado com os dados de agora;
 * - `esperar`: o Stronilead não respondeu. O lembrete continua agendado, e
 *   o agendador tenta de novo no próximo minuto;
 * - `nao_enviar`: o lembrete foi refeito para outra hora, foi cancelado, já
 *   não estava agendado, a academia desligou o lembrete, ou a janela fechou
 *   (30 minutos depois da hora dele, sem passar das 21h). Cada caso deixa a
 *   nota que diz o motivo, menos o que já não estava agendado.
 */
export async function prepareCrmReminderDispatch(
  messageId: string,
  deps: Partial<CrmReminderDeps> = {},
): Promise<DispatchDecision> {
  const d = { ...depsReais, ...deps };
  const row = await d.repo.loadScheduled(messageId);
  if (!row) return 'nao_enviar';
  const agora = d.agora();
  const settings = await d.repo.loadSettings(row.organizationId);
  if (!settings) return 'nao_enviar';

  // Lembrete desligado nas configurações depois de agendado: não sai.
  if (!settings.enabled) {
    await cancelar(row, 'desligado', d);
    return 'nao_enviar';
  }

  // A janela fechou: passou de 30 minutos da hora dele, ou das 21h.
  if (!reminderSendable(row.scheduledFor, agora)) {
    await cancelar(row, row.data.unansweredSince ? 'sem_resposta' : 'atrasado', d);
    return 'nao_enviar';
  }

  const resposta = await d.perguntar(row.organizationId, [row.data.leadId]);
  if (!resposta.ok) {
    if (!row.data.unansweredSince) {
      await d.repo.update(row.id, { data: { ...row.data, unansweredSince: agora.toISOString() } });
    }
    d.log.warn(
      { organizationId: row.organizationId, messageId, kind: resposta.kind },
      'Stronilead não respondeu na hora do lembrete, tenta de novo no próximo minuto',
    );
    return 'esperar';
  }

  const check = decideReminderCheck({
    row,
    detail: resposta.value[row.data.leadId] ?? null,
    settings,
    now: agora,
  });
  return (await aplicarConferencia(row, check, 'envio', d)) === 'fica' ? 'enviar' : 'nao_enviar';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 12 testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-reminder.service.ts backend/src/services/crm-reminder.service.test.ts
git commit -m "feat: lembrete é conferido no Stronilead na hora de enviar, com tentativas por 30 minutos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: O agendador espera a conferência e deixa o lembrete sair em conversa encerrada

**Files:**
- Create: `backend/src/lib/scheduledDispatch.ts`
- Test: `backend/src/lib/scheduledDispatch.test.ts`
- Modify: `backend/src/services/scheduler.service.ts` (linhas 7, 15, 21-30, 34, 58-63, 87-90, 105-109, 131-135, 160-163 e 288-295)

O `scheduler.service.ts` importa o Baileys e não roda no `node:test` (nota 17). Por isso a regra da conversa encerrada sai para uma função pura com teste, e o resto da mudança no agendador é ligação, conferida pelo typecheck e pela suíte de isolamento (Task 14).

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/lib/scheduledDispatch.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduledSendBlock } from './scheduledDispatch';

test('mensagem agendada comum não sai em conversa encerrada', () => {
  assert.equal(
    scheduledSendBlock({ conversationStatus: 'ENDED', isCrmReminder: false }),
    'Conversa encerrada antes do envio',
  );
});

test('o lembrete de agendamento sai mesmo com a conversa encerrada', () => {
  assert.equal(scheduledSendBlock({ conversationStatus: 'ENDED', isCrmReminder: true }), null);
});

test('conversa na fila ou em atendimento não barra nenhuma das duas', () => {
  for (const conversationStatus of ['PENDING', 'ACTIVE']) {
    for (const isCrmReminder of [false, true]) {
      assert.equal(scheduledSendBlock({ conversationStatus, isCrmReminder }), null);
    }
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com `Cannot find module './scheduledDispatch'`.

- [ ] **Step 3: Implementar `backend/src/lib/scheduledDispatch.ts`**

```ts
/**
 * Por que uma mensagem agendada não pode sair agora, ou null quando pode. O
 * motivo vai só para o log: a tabela `messages` não tem coluna para ele.
 *
 * Conversa encerrada barra a mensagem agendada comum, escrita para uma
 * conversa em andamento. O lembrete de agendamento é a exceção (spec
 * stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
 * "As duas proteções"): ele sai mesmo assim, e a conversa continua encerrada
 * até o lead responder, quando volta para a fila pelo caminho de sempre.
 */
export function scheduledSendBlock(args: { conversationStatus: string; isCrmReminder: boolean }): string | null {
  if (args.conversationStatus === 'ENDED' && !args.isCrmReminder) return 'Conversa encerrada antes do envio';
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os 3 testes novos e a suíte inteira verde.

- [ ] **Step 5: Ligar o lembrete no `backend/src/services/scheduler.service.ts`**

Logo depois de `import { runCrmCoverageSweep } from './crm-coverage.service';` (linha 7), acrescentar:

```ts
import { prepareCrmReminderDispatch, runCrmReminderSweep } from './crm-reminder.service';
import { scheduledSendBlock } from '../lib/scheduledDispatch';
```

Logo depois de `const CRM_COVERAGE_INTERVAL_MS = 15 * 60 * 1000; // 15 min` (linha 15), acrescentar:

```ts
const CRM_REMINDER_INTERVAL_MS = 15 * 60 * 1000; // 15 min
```

No comentário da classe (linhas 21-30), trocar:

```ts
 *   4. Em qualquer falha (canal off, conversa ENDED, exception), marca FAILED
```

por:

```ts
 *   4. Em qualquer falha (canal off, conversa ENDED, exception), marca FAILED.
 *      O lembrete de agendamento (crmReminder preenchido) é conferido no
 *      Stronilead antes de enviar e só sai das 8h às 21h de Brasília, também
 *      nas tentativas e na volta de uma parada (crm-reminder.service.ts), e
 *      sai mesmo com a conversa ENDED (lib/scheduledDispatch.ts).
```

Logo depois de `private crmCoverageTimer: NodeJS.Timeout | null = null;` (linha 34), acrescentar:

```ts
  private crmReminderTimer: NodeJS.Timeout | null = null;
```

Em `start()`, logo depois do bloco do `this.crmCoverageTimer = setInterval(...)` (linhas 58-63), acrescentar:

```ts

    // Conferência dos lembretes de agendamento, a cada 15 min. Sem rodada no
    // boot, como a cobertura: o lembrete que estiver na hora é conferido pelo
    // tick de minuto em minuto de qualquer jeito.
    this.crmReminderTimer = setInterval(
      () => void this.runCrmReminders(),
      CRM_REMINDER_INTERVAL_MS,
    );
```

Em `stop()`, logo depois do bloco que limpa o `crmCoverageTimer` (linhas 87-90), acrescentar:

```ts
    if (this.crmReminderTimer) {
      clearInterval(this.crmReminderTimer);
      this.crmReminderTimer = null;
    }
```

Em `tick()`, trocar a busca e o laço das mensagens na hora (linhas 105-109 e 131-135):

```ts
      const due = await prisma.message.findMany({
        where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
        select: { id: true },
        take: 50,
      });
```

```ts
      for (const { id } of due) {
        await this.dispatchOne(id).catch((err) =>
          logger.error({ err, messageId: id }, 'Falha inesperada no dispatch agendado'),
        );
      }
```

por:

```ts
      const due = await prisma.message.findMany({
        where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
        select: { id: true, crmReminder: true },
        take: 50,
      });
```

```ts
      for (const { id, crmReminder } of due) {
        // O lembrete só sai depois de conferido no Stronilead. Enquanto a
        // conferência não responde, ele fica SCHEDULED e volta no próximo tick.
        if (crmReminder !== null && !(await this.reminderReady(id))) continue;
        await this.dispatchOne(id).catch((err) =>
          logger.error({ err, messageId: id }, 'Falha inesperada no dispatch agendado'),
        );
      }
```

Em `dispatchOne`, trocar (linhas 160-163):

```ts
    if (msg.conversation.status === 'ENDED') {
      await this.markFailed(messageId, 'Conversa encerrada antes do envio');
      return;
    }
```

por:

```ts
    const bloqueio = scheduledSendBlock({
      conversationStatus: msg.conversation.status,
      isCrmReminder: msg.crmReminder !== null,
    });
    if (bloqueio) {
      await this.markFailed(messageId, bloqueio);
      return;
    }
```

E, logo depois do método `runCrmCoverage()` (linhas 288-295), acrescentar:

```ts

  /** Conferência na hora de enviar. Erro aqui vale como "não respondeu": tenta no próximo minuto. */
  private async reminderReady(messageId: string): Promise<boolean> {
    try {
      return (await prepareCrmReminderDispatch(messageId)) === 'enviar';
    } catch (err) {
      logger.error({ err, messageId }, 'Conferência do lembrete falhou (tenta de novo no próximo minuto)');
      return false;
    }
  }

  /** Varredura dos lembretes. Falha aqui nunca derruba o tick das outras rotinas. */
  private async runCrmReminders(): Promise<void> {
    try {
      await runCrmReminderSweep();
    } catch (err) {
      logger.error({ err }, 'Conferência dos lembretes falhou (segue no próximo ciclo)');
    }
  }
```

- [ ] **Step 6: Conferir tipos e testes**

Run: `cd backend && npm run typecheck && npm test`
Expected: typecheck limpo e a suíte inteira verde. O `msg.crmReminder` existe porque o `findUnique` do `dispatchOne` usa `include`, que traz todas as colunas da mensagem.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/scheduledDispatch.ts backend/src/lib/scheduledDispatch.test.ts backend/src/services/scheduler.service.ts
git commit -m "feat: agendador confere o lembrete antes de enviar e deixa sair em conversa encerrada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: A prévia do balão, `POST /api/conversations/:id/crm-reminder-preview`

**Files:**
- Modify: `backend/src/services/crm-reminder.service.ts` (import de `./crm-reminder-time` e fim do arquivo)
- Modify: `backend/src/services/crm-reminder.service.test.ts`
- Modify: `backend/src/services/crm-schedule.service.ts` (do PR 2: imports, `CrmScheduleDeps`, `depsReais` e fim do arquivo)
- Modify: `backend/src/services/crm-schedule.service.test.ts` (do PR 2: imports, `ambiente` e fim do arquivo)
- Modify: `backend/src/routes/conversations.routes.ts` (logo depois da rota `POST /:id/crm-schedule`, do PR 2)

A prévia devolve quando o lembrete sai e o texto, montados pelas mesmas funções da troca (`planReminder` e `renderReminderText`, por `previewFromSettings`), para o que aparece no balão ser o que vai sair. A rota é do balão do agendamento e mora no serviço dele, com as mesmas portas e os mesmos textos de recusa (nota 20): superadmin, sessão emprestada, acesso à conversa e contato de WhatsApp com número, nessa ordem. O corpo é o que o balão já tem nos passos respondidos, mais o `leadId`. O backend lê o cartão do número (do cache, ou do Stronilead) para saber se o agendamento é de menor e qual é o nome do contato, com as regras da criação. Com o lembrete desligado na academia, a resposta é `{ enabled: false }`, sem ler o cartão, e o balão não mostra o bloco (Task 20).

- [ ] **Step 1: Escrever os testes da prévia pura, que falham**

Em `backend/src/services/crm-reminder.service.test.ts`, acrescentar `previewFromSettings` ao import de `./crm-reminder.service` (em ordem alfabética) e, no fim do arquivo:

```ts
// ── A prévia do balão ──────────────────────────────────────────────────────

const ESCOLHA = {
  type: 'visita' as const,
  appointmentAt: new Date('2026-10-01T18:00:00-03:00'),
  unit: 'Centro',
  unitAddress: 'Rua Garibaldi, 1200',
  modality: null,
  professorName: null,
  soloTraining: false,
  attendeeName: 'Mariana Lima',
  isWard: false,
  contactName: 'Mariana Lima',
  schedulerName: 'Ana Souza',
};

test('prévia: lembrete desligado na academia, o balão não mostra o bloco', () => {
  assert.deepEqual(previewFromSettings({ ...CONFIG, enabled: false }, ESCOLHA, AGORA), { enabled: false });
  assert.deepEqual(previewFromSettings(null, ESCOLHA, AGORA), { enabled: false });
});

test('prévia: para quem vai, quando sai e o texto, como no mockup', () => {
  assert.deepEqual(previewFromSettings(CONFIG, ESCOLHA, AGORA), {
    enabled: true,
    recipientFirstName: 'Mariana',
    sendAt: '2026-09-30T21:00:00.000Z',
    whenText: 'Sai sozinho na véspera, quarta, 30/09, às 18:00.',
    text: TEXTO_DA_VISITA,
  });
});

test('prévia: sem tempo para lembrete, o motivo', () => {
  assert.deepEqual(
    previewFromSettings(CONFIG, { ...ESCOLHA, appointmentAt: new Date('2026-09-29T19:00:00-03:00') }, AGORA),
    {
      enabled: true,
      recipientFirstName: 'Mariana',
      sendAt: null,
      reasonText:
        'A visita é hoje e o horário do lembrete, na véspera, já passou. A confirmação na caixa já avisa Mariana.',
    },
  );
});

test('prévia: é a mesma conta da criação, com o mesmo texto e a mesma hora', async () => {
  const previa = previewFromSettings(CONFIG, ESCOLHA, AGORA);
  const a = ambiente();

  await replaceCrmReminder(PEDIDO, a.deps);

  assert.ok(previa.enabled && previa.sendAt !== null);
  assert.equal(a.trocas[0].create?.content, previa.text);
  assert.equal(a.trocas[0].create?.scheduledFor.toISOString(), previa.sendAt);
});
```

- [ ] **Step 2: Escrever os testes da rota, que falham**

Em `backend/src/services/crm-schedule.service.test.ts` (do PR 2), fazer quatro mudanças no começo do arquivo.

1. No import de `./crm-schedule.service`, acrescentar `previewCrmReminder` e `type CrmReminderPreviewBody` (em ordem alfabética), e logo depois desse import acrescentar:

```ts
import type { CrmReminderSettings } from './crm-reminder.service';
import { DEFAULT_REMINDER_TEXTS } from './crm-reminder-text';
```

2. Logo depois de `const AGORA = new Date('2026-09-29T18:40:00.000Z');`, acrescentar:

```ts

/** O lembrete da academia ligado, na véspera às 18:00, com os textos padrão. */
const CONFIG_DO_LEMBRETE: CrmReminderSettings = {
  enabled: true,
  timing: { mode: 'EVE', eveTime: '18:00', hoursBefore: 3 },
  texts: { visita: DEFAULT_REMINDER_TEXTS.visita, aula_experimental: DEFAULT_REMINDER_TEXTS.aula_experimental },
};

const CORPO_DA_PREVIA: CrmReminderPreviewBody = {
  leadId: 'L1',
  type: 'visita',
  date: '2026-10-01',
  time: '18:00',
  unit: 'Centro',
  unitAddress: 'Rua Garibaldi, 1200',
  modality: null,
  professorName: null,
  soloTraining: false,
  attendeeName: 'Mariana Lima',
};
```

3. No `interface Ambiente`, logo depois de `eventos: Array<{ channelId: string; event: string; payload: unknown }>;`, acrescentar:

```ts
  /** Telefones cujo cartão a prévia do lembrete leu. */
  cartoesPedidos: string[];
```

4. Na função `ambiente`, logo depois de `    agendamento?: CrmLeadCall<CrmScheduled>;` (nas opções), acrescentar:

```ts
    configDoLembrete?: CrmReminderSettings | null;
    cartaoGuardado?: CrmCard | null;
```

logo depois de `  const cache = new CrmCache();`, acrescentar:

```ts
  const cartoesPedidos: string[] = [];
```

logo depois da linha `    cache,` que vem antes de `    deps: {` (a de quatro espaços, no objeto devolvido), acrescentar:

```ts
    cartoesPedidos,
```

e, dentro de `deps`, logo depois de `      agora: () => AGORA,`, acrescentar:

```ts
      loadReminderSettings: async () => (opts.configDoLembrete === undefined ? null : opts.configDoLembrete),
      loadCard: async (_organizationId, phone) => {
        cartoesPedidos.push(phone);
        return opts.cartaoGuardado === undefined ? CARTAO : opts.cartaoGuardado;
      },
```

E acrescentar no fim do arquivo:

```ts
// ── Prévia do lembrete (PR 3) ──────────────────────────────────────────────

test('prévia do lembrete: as portas do agendamento vêm antes de tudo', async () => {
  const amb = ambiente({ configDoLembrete: CONFIG_DO_LEMBRETE });
  const superadmin: CrmConversationViewer = { ...ATENDENTE, role: 'SUPERADMIN', orgId: null };

  await assert.rejects(previewCrmReminder('conv-1', superadmin, CORPO_DA_PREVIA, amb.deps), {
    statusCode: 403,
    code: 'superadmin',
    message: SCHEDULE_SUPERADMIN_MESSAGE,
  });
  assert.equal(amb.acessos.length, 0);
  assert.deepEqual(amb.cartoesPedidos, []);
});

test('prévia do lembrete: desligado na academia, { enabled: false }, sem ler o cartão', async () => {
  const amb = ambiente({ configDoLembrete: null });

  assert.deepEqual(await previewCrmReminder('conv-1', ATENDENTE, CORPO_DA_PREVIA, amb.deps), { enabled: false });
  assert.deepEqual(amb.cartoesPedidos, []);
});

test('prévia do lembrete: quando sai e o texto, com o nome do cartão', async () => {
  const amb = ambiente({ configDoLembrete: CONFIG_DO_LEMBRETE });

  assert.deepEqual(await previewCrmReminder('conv-1', ATENDENTE, CORPO_DA_PREVIA, amb.deps), {
    enabled: true,
    recipientFirstName: 'Mariana',
    sendAt: '2026-09-30T21:00:00.000Z',
    whenText: 'Sai sozinho na véspera, quarta, 30/09, às 18:00.',
    text: 'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
  });
  assert.deepEqual(amb.cartoesPedidos, [CONTATO.phone]);
});

test('prévia do lembrete: agendamento de um menor do número leva o "de Pedro"', async () => {
  const responsavel: CrmCard = {
    found: true,
    kind: 'responsavel',
    name: 'Mariana Souza',
    wards: [{ leadId: 'L2', kind: 'lead', name: 'Pedro Souza', relationship: 'Filho' }],
  };
  const amb = ambiente({ configDoLembrete: CONFIG_DO_LEMBRETE, cartaoGuardado: responsavel });

  const r = await previewCrmReminder(
    'conv-1',
    ATENDENTE,
    { ...CORPO_DA_PREVIA, leadId: 'L2', attendeeName: 'Pedro Souza' },
    amb.deps,
  );

  assert.equal(
    r.enabled && r.sendAt !== null ? r.text : null,
    'Oi, Mariana! Passando para lembrar da visita de Pedro amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
  );
});

test('prévia do lembrete: dia que não existe é 400', async () => {
  const amb = ambiente({ configDoLembrete: CONFIG_DO_LEMBRETE });

  await assert.rejects(
    previewCrmReminder('conv-1', ATENDENTE, { ...CORPO_DA_PREVIA, date: '2026-02-30' }, amb.deps),
    { statusCode: 400 },
  );
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `previewFromSettings`, `previewCrmReminder` e `CrmReminderPreviewBody` não existem, e o `ambiente` do agendamento tem `loadReminderSettings` e `loadCard`, que `CrmScheduleDeps` ainda não conhece.

- [ ] **Step 4: A prévia pura em `backend/src/services/crm-reminder.service.ts`**

No import de `./crm-reminder-time` do topo, acrescentar `noReminderText` e `reminderWhenText`:

```ts
import {
  noReminderText,
  planReminder,
  reminderSendable,
  reminderWhenText,
  type CrmReminderTiming,
  type CrmReminderType,
  type NoReminderReason,
} from './crm-reminder-time';
```

E acrescentar no fim do arquivo:

```ts
// ── A prévia do balão ──────────────────────────────────────────────────────

/** A configuração do lembrete da academia, para quem está fora deste arquivo. */
export function loadCrmReminderSettings(organizationId: string): Promise<CrmReminderSettings | null> {
  return repoReal.loadSettings(organizationId);
}

/**
 * A resposta da prévia. `enabled: false`: a academia não ligou o lembrete, e
 * o balão não mostra o bloco. `recipientFirstName` é quem recebe, o título do
 * bloco ("Lembrete para Mariana").
 */
export type CrmReminderPreview =
  | { enabled: false }
  | { enabled: true; recipientFirstName: string | null; sendAt: string; whenText: string; text: string }
  | { enabled: true; recipientFirstName: string | null; sendAt: null; reasonText: string };

/**
 * A prévia, pelas mesmas funções que criam o lembrete. O texto vai sem o nome
 * de quem agenda no começo, que a criação acrescenta pelo "Mostrar meu nome".
 */
export function previewFromSettings(
  settings: CrmReminderSettings | null,
  input: {
    type: CrmReminderType;
    appointmentAt: Date;
    unit: string | null;
    unitAddress: string | null;
    modality: string | null;
    professorName: string | null;
    soloTraining: boolean;
    attendeeName: string | null;
    isWard: boolean;
    contactName: string | null;
    schedulerName: string | null;
  },
  now: Date,
): CrmReminderPreview {
  if (!settings?.enabled) return { enabled: false };
  const recipientFirstName = firstName(input.contactName);
  const plano = planReminder(input.appointmentAt, settings.timing, now);
  if (plano.at === null) {
    return {
      enabled: true,
      recipientFirstName,
      sendAt: null,
      reasonText: noReminderText({
        type: input.type,
        appointmentAt: input.appointmentAt,
        rule: plano.rule,
        reason: plano.reason,
        timing: settings.timing,
        contactFirstName: recipientFirstName,
        now,
      }),
    };
  }
  return {
    enabled: true,
    recipientFirstName,
    sendAt: plano.at.toISOString(),
    whenText: reminderWhenText(plano.at, plano.rule, settings.timing),
    text: renderReminderText({
      template: settings.texts[input.type],
      contactName: input.contactName,
      attendeeFirstName: firstName(input.attendeeName),
      isWard: input.isWard,
      appointmentAt: input.appointmentAt,
      sendAt: plano.at,
      unit: input.unit,
      unitAddress: input.unitAddress,
      modality: input.modality,
      professorName: input.professorName,
      soloTraining: input.soloTraining,
      schedulerName: input.schedulerName,
    }),
  };
}
```

- [ ] **Step 5: A rota no serviço do agendamento, `backend/src/services/crm-schedule.service.ts`**

No import de `./crm.service` do topo, acrescentar `fetchCrmCard` (em ordem alfabética, depois de `createCrmAppointment`), e logo depois do import de `./crm-appointment-text` acrescentar:

```ts
import { instanteDoTexto } from './crm-reminder-time';
import {
  loadCrmReminderSettings,
  previewFromSettings,
  type CrmReminderPreview,
  type CrmReminderSettings,
} from './crm-reminder.service';
```

No `interface CrmScheduleDeps`, logo antes de `  /** Referência do "hoje" e do "amanhã" no texto da confirmação. */`, acrescentar:

```ts
  /** A configuração do lembrete da academia (crm-reminder.service.ts), para a prévia. */
  loadReminderSettings: (organizationId: string) => Promise<CrmReminderSettings | null>;
  /** O cartão do número, do cache ou do Stronilead, para a prévia saber o nome e se é de um menor. */
  loadCard: (organizationId: string, phone: string) => Promise<CrmCard | null>;
```

No `depsReais`, logo depois de `  createAppointment: (organizationId, request) => createCrmAppointment(organizationId, request),`, acrescentar:

```ts
  loadReminderSettings: (organizationId) => loadCrmReminderSettings(organizationId),
  loadCard: async (organizationId, phone) => (await fetchCrmCard(organizationId, phone)).card,
```

E acrescentar no fim do arquivo:

```ts

// ── Prévia do lembrete (PR 3) ──────────────────────────────────────────────

/**
 * Corpo do POST /conversations/:id/crm-reminder-preview: o que foi escolhido
 * nos passos do balão, com o dia e a hora de Brasília. Só serve à prévia; o
 * lembrete de verdade é montado com o que o Stronilead devolver ao agendar.
 */
export const crmReminderPreviewBodySchema = z.object({
  leadId: z.string().trim().min(1).max(128),
  type: z.enum(['visita', 'aula_experimental']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  unit: itemDeLista.nullable(),
  unitAddress: z.string().trim().min(1).max(300).nullable(),
  modality: itemDeLista.nullable(),
  professorName: itemDeLista.nullable(),
  soloTraining: z.boolean(),
  attendeeName: itemDeLista.nullable(),
});
export type CrmReminderPreviewBody = z.infer<typeof crmReminderPreviewBodySchema>;

/**
 * POST /conversations/:id/crm-reminder-preview. Mesmas portas do agendamento.
 * O nome do contato e o menor saem do cartão, pelas mesmas regras da criação
 * do lembrete depois do agendamento, e o lembrete desligado responde sem ler
 * o cartão.
 */
export async function previewCrmReminder(
  conversationId: string,
  viewer: CrmConversationViewer,
  body: CrmReminderPreviewBody,
  deps: Partial<CrmScheduleDeps> = {},
): Promise<CrmReminderPreview> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await crmConversationTarget(conversationId, viewer, d, PORTAS);
  const appointmentAt = instanteDoTexto(body.date, body.time);
  if (!appointmentAt) throw new HttpError(400, 'Dia ou horário que não existe.', 'dados_invalidos');

  const settings = await d.loadReminderSettings(organizationId);
  if (!settings?.enabled) return { enabled: false };

  const [card, schedulerName] = await Promise.all([
    d.loadCard(organizationId, target.contact.phone),
    d.loadActorName(viewer.sub, organizationId),
  ]);
  return previewFromSettings(
    settings,
    {
      type: body.type,
      appointmentAt,
      unit: body.unit,
      unitAddress: body.unitAddress,
      modality: body.modality,
      professorName: body.professorName,
      soloTraining: body.soloTraining,
      attendeeName: body.attendeeName,
      isWard: card ? ehDeMenor(card, body.leadId) : false,
      contactName: nomeDoCartao(card) ?? target.contact.displayName,
      schedulerName,
    },
    d.agora(),
  );
}
```

- [ ] **Step 6: A rota em `backend/src/routes/conversations.routes.ts`**

Logo depois do fim da rota `router.post('/:id/crm-schedule', ...)`, que o PR 2 criou, acrescentar:

```ts

// Prévia do lembrete de agendamento (PR 3): quando ele sai e o texto, da mesma
// conta que cria o lembrete depois do agendamento. Mesmas portas do agendamento.
router.post('/:id/crm-reminder-preview', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    const body = crmScheduleService.crmReminderPreviewBodySchema.parse(req.body);
    res.json(await crmScheduleService.previewCrmReminder(req.params.id, req.user, body));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd backend && npm run typecheck && npm test`
Expected: typecheck limpo e PASS, com os 9 testes novos (4 da prévia pura e 5 da rota) e a suíte inteira verde, com os testes do agendamento do PR 2 intocados. As portas de verdade e a rota entram na suíte de isolamento (Task 14).

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/crm-reminder.service.ts backend/src/services/crm-reminder.service.test.ts backend/src/services/crm-schedule.service.ts backend/src/services/crm-schedule.service.test.ts backend/src/routes/conversations.routes.ts
git commit -m "feat: prévia do lembrete para o balão do agendamento, da mesma conta que cria o lembrete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: A configuração no servidor: leitura, gravação e prévia

**Files:**
- Modify: `backend/src/services/organization.service.ts` (linhas 11-31, 55-66 e fim do arquivo)
- Modify: `backend/src/services/organization.service.test.ts` (import do topo, `ORG_SALVA` nas linhas 16-24 e fim do arquivo)
- Modify: `backend/src/services/crm-reminder.service.ts` (import de `./crm-reminder-text` e fim do arquivo)
- Modify: `backend/src/services/crm-reminder.service.test.ts`
- Modify: `backend/src/routes/organization.routes.ts` (linhas 6-7, 23-37, 44-46 e depois da rota `POST /crm/test`)

A leitura (`GET /organization`, que qualquer papel da organização já lê) passa a trazer o bloco `crmReminder`; a configuração não é segredo, e o balão do PR 2 pode precisar dela. A gravação entra no mesmo `PATCH /organization`, só do admin (`requireRole('ADMIN')`, que recusa o superadmin). A prévia dos textos é uma rota nova, também só do admin (nota 13). As regras de formato moram no zod da rota: a hora da véspera de 08:00 a 21:00, as horas antes de 1 a 48 e os textos de 1 a 1.000 caracteres.

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/organization.service.test.ts`, trocar o import do topo por:

```ts
import {
  getOrganization,
  updateCrmIntegration,
  updateCrmReminderSettings,
  updateOrganizationPolicy,
  type OrganizationDeps,
} from './organization.service';
```

No `ORG_SALVA` (linhas 16-24), logo depois de `crmApiKey: null,`, acrescentar:

```ts
  crmReminderEnabled: false,
  crmReminderMode: 'EVE' as const,
  crmReminderEveTime: '18:00',
  crmReminderHoursBefore: 3,
  crmReminderVisitText: 'texto da visita',
  crmReminderTrialText: 'texto da aula',
```

E acrescentar no fim do arquivo:

```ts
// ── Lembrete de agendamento ────────────────────────────────────────────────

test('lembrete: a leitura traz a configuração num bloco próprio', async () => {
  const a = ambiente();
  const org = await getOrganization('org1', a.deps);
  assert.deepEqual(org.crmReminder, {
    enabled: false,
    mode: 'EVE',
    eveTime: '18:00',
    hoursBefore: 3,
    visitText: 'texto da visita',
    trialText: 'texto da aula',
  });
  assert.equal('crmReminderEnabled' in org, false);
});

test('lembrete: viewer sem org é recusado sem escrever', async () => {
  const a = ambiente();
  await assert.rejects(() => updateCrmReminderSettings(null, { enabled: true }, a.deps), /organização/i);
  assert.equal(a.escritas.length, 0);
});

test('lembrete: grava só o que veio, com os textos aparados', async () => {
  const a = ambiente();
  await updateCrmReminderSettings(
    'org1',
    { enabled: true, mode: 'HOURS_BEFORE', hoursBefore: 5, visitText: '  Oi, [primeiro_nome]!  ' },
    a.deps,
  );
  assert.deepEqual(a.escritas, [
    {
      orgId: 'org1',
      data: {
        crmReminderEnabled: true,
        crmReminderMode: 'HOURS_BEFORE',
        crmReminderHoursBefore: 5,
        crmReminderVisitText: 'Oi, [primeiro_nome]!',
      },
    },
  ]);
});

test('lembrete: sem nada para mudar, não escreve', async () => {
  const a = ambiente();
  await updateCrmReminderSettings('org1', {}, a.deps);
  assert.equal(a.escritas.length, 0);
});
```

Em `backend/src/services/crm-reminder.service.test.ts`, acrescentar `previewReminderTemplates` ao import de `./crm-reminder.service` (em ordem alfabética) e, no fim do arquivo:

```ts
// ── A prévia da configuração ───────────────────────────────────────────────

test('prévia da configuração: os dois textos com o exemplo do mockup e o nome de quem está logado', async () => {
  const r = await previewReminderTemplates(
    'org1',
    'u-jo',
    { visitText: DEFAULT_REMINDER_TEXTS.visita, trialText: 'Aqui é [meu_primeiro_nome], com [professor_da_aula].' },
    { agora: () => AGORA, loadActorName: async () => 'Johnny Bittencourt' },
  );
  assert.deepEqual(r, {
    visit: 'Oi, Mariana! Passando para lembrar da visita amanhã, quarta-feira (30/09), às 18h, na unidade Centro. Até lá!',
    trial: 'Aqui é Johnny, com Carla.',
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `updateCrmReminderSettings` e `previewReminderTemplates` não existem, e `ORG_SALVA` tem campos que `OrgRow` ainda não conhece.

- [ ] **Step 3: Implementar em `backend/src/services/organization.service.ts`**

No `orgSelect` (linhas 11-21), logo depois de `crmApiKey: true,`, acrescentar:

```ts
  crmReminderEnabled: true,
  crmReminderMode: true,
  crmReminderEveTime: true,
  crmReminderHoursBefore: true,
  crmReminderVisitText: true,
  crmReminderTrialText: true,
```

No `type OrgRow` (linhas 23-31), logo depois de `crmApiKey: string | null;`, acrescentar:

```ts
  crmReminderEnabled: boolean;
  crmReminderMode: 'EVE' | 'HOURS_BEFORE';
  crmReminderEveTime: string;
  crmReminderHoursBefore: number;
  crmReminderVisitText: string;
  crmReminderTrialText: string;
```

Trocar a função `toPublicOrg` inteira (linhas 55-66) por:

```ts
// Única porta de saída do model Organization pro resto do app. crmApiKey é
// lido aqui só pra virar `hasKey`: nunca reaparece no objeto devolvido. A
// configuração do lembrete de agendamento sai num bloco próprio.
function toPublicOrg(org: OrgRow) {
  const {
    crmApiKey,
    crmEnabled,
    crmBaseUrl,
    crmTenantSlug,
    crmReminderEnabled,
    crmReminderMode,
    crmReminderEveTime,
    crmReminderHoursBefore,
    crmReminderVisitText,
    crmReminderTrialText,
    ...rest
  } = org;
  return {
    ...rest,
    crm: {
      enabled: crmEnabled,
      baseUrl: crmBaseUrl,
      tenantSlug: crmTenantSlug,
      hasKey: Boolean(crmApiKey),
    },
    crmReminder: {
      enabled: crmReminderEnabled,
      mode: crmReminderMode,
      eveTime: crmReminderEveTime,
      hoursBefore: crmReminderHoursBefore,
      visitText: crmReminderVisitText,
      trialText: crmReminderTrialText,
    },
  };
}
```

E acrescentar no fim do arquivo:

```ts
/** Campos da configuração do lembrete de agendamento. O formato é conferido no zod da rota. */
export interface CrmReminderSettingsInput {
  enabled?: boolean;
  mode?: 'EVE' | 'HOURS_BEFORE';
  eveTime?: string;
  hoursBefore?: number;
  visitText?: string;
  trialText?: string;
}

// Configuração do lembrete de agendamento. Só ADMIN chama (ver rota). Grava só
// o que veio, para a chave da tela salvar sozinha, sem mandar o resto.
export async function updateCrmReminderSettings(
  viewerOrgId: string | null,
  input: CrmReminderSettingsInput,
  deps: Partial<OrganizationDeps> = {},
) {
  const { updateOrg } = { ...depsReais, ...deps };
  if (!viewerOrgId) throw new HttpError(400, 'SUPERADMIN não tem organização para editar.');
  const data: Record<string, unknown> = {};
  if (input.enabled !== undefined) data.crmReminderEnabled = input.enabled;
  if (input.mode !== undefined) data.crmReminderMode = input.mode;
  if (input.eveTime !== undefined) data.crmReminderEveTime = input.eveTime;
  if (input.hoursBefore !== undefined) data.crmReminderHoursBefore = input.hoursBefore;
  if (input.visitText !== undefined) data.crmReminderVisitText = input.visitText.trim();
  if (input.trialText !== undefined) data.crmReminderTrialText = input.trialText.trim();
  if (Object.keys(data).length > 0) await updateOrg(viewerOrgId, data);
}
```

- [ ] **Step 4: Implementar a prévia da configuração em `backend/src/services/crm-reminder.service.ts`**

Trocar o import de `./crm-reminder-text` por:

```ts
import { exampleReminderTexts, reminderNoteContent, renderReminderText, type ReminderNote } from './crm-reminder-text';
```

E acrescentar no fim do arquivo:

```ts
// ── A prévia da configuração ───────────────────────────────────────────────

/**
 * POST /organization/crm-reminder/preview: os dois textos da configuração com
 * os dados de exemplo do mockup e o nome de quem está logado no
 * [meu_primeiro_nome]. A mesma montagem do lembrete de verdade.
 */
export async function previewReminderTemplates(
  organizationId: string,
  collaboratorId: string,
  texts: { visitText: string; trialText: string },
  deps: Partial<{
    agora: () => Date;
    /** Nome de quem pede, no cadastro do Stronizap. */
    loadActorName: (collaboratorId: string, organizationId: string) => Promise<string | null>;
  }> = {},
): Promise<{ visit: string; trial: string }> {
  const d = {
    agora: () => new Date(),
    loadActorName: async (id: string, org: string) => (await repoReal.loadAuthor(id, org))?.name ?? null,
    ...deps,
  };
  const adminName = await d.loadActorName(collaboratorId, organizationId);
  return exampleReminderTexts({ ...texts, adminName, now: d.agora() });
}
```

- [ ] **Step 5: As rotas em `backend/src/routes/organization.routes.ts`**

Logo depois de `import { fetchCrmCard } from '../services/crm.service';` (linha 7), acrescentar:

```ts
import { REMINDER_TEXT_MAX } from '../services/crm-reminder-text';
import * as crmReminderService from '../services/crm-reminder.service';
```

Trocar o `patchSchema` inteiro (linhas 23-37) por:

```ts
/** "HH:MM" de 08:00 a 21:00: a véspera configurada já nasce dentro da faixa do lembrete. */
const horaDaVespera = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .refine((v) => v >= '08:00' && v <= '21:00', 'A véspera vai de 08:00 a 21:00.');
const textoDoLembrete = z.string().trim().min(1).max(REMINDER_TEXT_MAX);

const patchSchema = z.object({
  attendantsSeeAllConversations: z.boolean().optional(),
  // Config da integração com o CRM (STRONILEAD). apiKey ausente/vazia não
  // mexe na chave já salva — ver updateCrmIntegration.
  crm: z
    .object({
      enabled: z.boolean().optional(),
      // O formato do endereço é conferido em normalizeCrmBaseUrl (https, host
      // público, URL válida). Aqui fica só o teto de tamanho.
      baseUrl: z.string().max(500).optional(),
      tenantSlug: z.string().max(120).optional(),
      apiKey: z.string().max(500).optional(),
    })
    .optional(),
  // Lembrete de agendamento (spec 2026-09-29, PR 3). Nasce desligado.
  crmReminder: z
    .object({
      enabled: z.boolean().optional(),
      mode: z.enum(['EVE', 'HOURS_BEFORE']).optional(),
      eveTime: horaDaVespera.optional(),
      hoursBefore: z.number().int().min(1).max(48).optional(),
      visitText: textoDoLembrete.optional(),
      trialText: textoDoLembrete.optional(),
    })
    .optional(),
});
```

No `router.patch('/', ...)`, logo depois do bloco `if (patch.crm) { ... }` (linhas 44-46), acrescentar:

```ts
    if (patch.crmReminder) {
      await organizationService.updateCrmReminderSettings(req.user.orgId, patch.crmReminder);
    }
```

E, logo depois do fim da rota `router.post('/crm/test', ...)`, antes de `export default router;`, acrescentar:

```ts

const reminderPreviewSchema = z.object({
  visitText: z.string().max(REMINDER_TEXT_MAX),
  trialText: z.string().max(REMINDER_TEXT_MAX),
});

// Prévia dos textos do lembrete na configuração, só do admin: os dados de
// exemplo do mockup e o nome de quem está logado, na mesma montagem do
// lembrete de verdade.
router.post('/crm-reminder/preview', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    if (!req.user.orgId) throw new HttpError(400, 'SUPERADMIN não tem organização para editar.');
    const body = reminderPreviewSchema.parse(req.body);
    res.json(await crmReminderService.previewReminderTemplates(req.user.orgId, req.user.sub, body));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && npm run typecheck && npm test`
Expected: typecheck limpo e PASS, com os 5 testes novos e a suíte inteira verde. As rotas entram na suíte de isolamento (Task 14).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/organization.service.ts backend/src/services/organization.service.test.ts backend/src/services/crm-reminder.service.ts backend/src/services/crm-reminder.service.test.ts backend/src/routes/organization.routes.ts
git commit -m "feat: configuração do lembrete de agendamento, só para o admin, com prévia dos textos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Suíte de isolamento: a prévia, a configuração e o lembrete contra o banco

**Files:**
- Modify: `backend/src/routes/tenant-isolation.spec.ts` (comentário do topo, imports e fim do arquivo)

A spec pede, na suíte de isolamento, a criação, a troca na remarcação, a exceção da conversa encerrada, a varredura e a conferência na hora de enviar, com cada desfecho e com o Stronilead fora do ar. As regras finas já estão nos testes das Tasks 7 a 10; aqui entra o que só um banco de verdade prova: a troca por lead e tipo com o filtro de JSON, a trava da organização com dois agendamentos ao mesmo tempo, o lembrete de uma organização que nunca encosta no da outra, a nota gravada na conversa, e as rotas novas com as portas e os papéis. O Stronilead é de mentira em todos os testes: quem responde é a função `perguntar` de cada um, e nada sai para a rede.

- [ ] **Step 1: Escrever os testes**

No comentário do topo de `backend/src/routes/tenant-isolation.spec.ts`, logo depois do parágrafo que termina em "contato sem número) antes de qualquer conversa com o CRM.", acrescentar:

```ts
 *
 * E o lembrete de agendamento (spec 2026-09-29, PR 3): a prévia nas portas do
 * agendamento, a configuração só do admin, e a troca, a varredura e o envio
 * contra o banco, sem um lembrete encostar no de outra organização.
```

Nos imports, acrescentar:

```ts
import { Prisma } from '@prisma/client';
import type { CrmAppointmentDetail } from '../services/crm.service';
import {
  prepareCrmReminderDispatch,
  replaceCrmReminder,
  runCrmReminderSweep,
} from '../services/crm-reminder.service';
import { scheduledSendBlock } from '../lib/scheduledDispatch';
```

E acrescentar, logo antes da última linha do arquivo (o `}` que fecha o bloco aberto antes de `const SENHA`), depois dos testes do "Esqueci a senha":

```ts

  // ── Lembrete de agendamento (spec 2026-09-29, PR 3) ───────────────────────
  // A ordem importa: a prévia e o "nasce desligado" rodam antes de o admin
  // ligar o lembrete da org A.

  const semSocket = () => {};
  const semLogDoLembrete = { info() {}, warn() {}, error() {} };

  /** Dia de Brasília daqui a `dias` dias, em AAAA-MM-DD. */
  function diaDaqui(dias: number): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(Date.now() + dias * 86_400_000),
    );
  }

  /** Visita daqui a `dias` dias, às 18:00 de Brasília, como o Stronilead devolve. */
  function visitaDaqui(leadId: string, dias: number): CrmAppointmentDetail {
    return {
      leadId,
      leadName: 'Mariana Lima',
      type: 'visita',
      at: new Date(`${diaDaqui(dias)}T18:00:00-03:00`).toISOString(),
      unit: 'Centro',
      unitAddress: 'Rua Garibaldi, 1200',
      modality: null,
      professorName: null,
      soloTraining: false,
      quantity: null,
      outcome: null,
    };
  }

  /** O Stronilead de mentira: `null` é o Stronilead sem responder. */
  function depsDoLembrete(estados: Record<string, CrmAppointmentDetail | null> | null, agora = new Date()) {
    const perguntas: Array<{ org: string; leadIds: string[] }> = [];
    return {
      perguntas,
      deps: {
        agora: () => agora,
        perguntar: async (org: string, leadIds: string[]) => {
          perguntas.push({ org, leadIds });
          if (estados === null) return { ok: false as const, kind: 'indisponivel' as const };
          return { ok: true as const, value: Object.fromEntries(leadIds.map((id) => [id, estados[id] ?? null])) };
        },
        emitToChannel: semSocket,
        emitToOrg: semSocket,
        log: semLogDoLembrete,
      },
    };
  }

  function criarLembrete(
    org: Record<string, string>,
    appointment: CrmAppointmentDetail,
    conversationId = org.conversationId,
  ) {
    return replaceCrmReminder(
      {
        organizationId: org.orgId,
        conversationId,
        channelId: org.channelId,
        authorId: org.adminId,
        contactName: 'Mariana Lima',
        appointment,
        isWard: false,
        request: { enabled: true, text: null },
      },
      depsDoLembrete({}).deps,
    );
  }

  const lembretesDo = (orgId: string, leadId: string) =>
    prisma.message.findMany({
      where: { organizationId: orgId, status: 'SCHEDULED', crmReminder: { path: ['leadId'], equals: leadId } },
    });

  /** Notas do lembrete com o texto: o `content` é o payload em JSON que a conversa desenha em pílula. */
  const notasCom = (conversationId: string, texto: string) =>
    prisma.message.count({
      where: {
        conversationId,
        direction: 'INTERNAL',
        AND: [{ content: { startsWith: '{"kind":"crm_reminder_note"' } }, { content: { contains: texto } }],
      },
    });

  /** Amanhã às 15:00 de Brasília: uma hora dentro da faixa, para a conferência na hora de enviar. */
  const horaDoLembrete = () => new Date(`${diaDaqui(1)}T15:00:00-03:00`);

  function previaDoLembrete(token: string, conversationId: string) {
    return como(token, `/api/conversations/${conversationId}/crm-reminder-preview`, {
      method: 'POST',
      body: JSON.stringify({
        leadId: 'L1',
        type: 'visita',
        date: diaDaqui(3),
        time: '18:00',
        unit: 'Centro',
        unitAddress: 'Rua Garibaldi, 1200',
        modality: null,
        professorName: null,
        soloTraining: false,
        attendeeName: 'Mariana Lima',
      }),
    });
  }

  test('lembrete: a prévia passa pelas portas do agendamento', async () => {
    assert.equal((await previaDoLembrete(tokenA, B.conversationId)).status, 404);
    assert.equal((await previaDoLembrete(tokenAtendenteA, A.filaRestritaId)).status, 403);

    const superadmin = await previaDoLembrete(tokenSuperAdmin, A.conversationId);
    assert.equal(superadmin.status, 403);
    assert.equal(await codigo(superadmin), 'superadmin');

    const tokenEmprestado = signAccessToken({
      sub: A.adminId,
      email: A.adminEmail,
      role: 'ADMIN',
      tv: 0,
      orgId: A.orgId,
      imp: { byId: 'superadmin-iso' },
    });
    const emprestada = await previaDoLembrete(tokenEmprestado, A.conversationId);
    assert.equal(emprestada.status, 403);
    assert.equal(await codigo(emprestada), 'impersonacao');
  });

  test('lembrete: nasce desligado, e a prévia diz isso a quem passa pelas portas', async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: A.orgId } });
    assert.equal(org.crmReminderEnabled, false);

    const res = await previaDoLembrete(tokenAtendenteA, A.filaLiberadaId);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { enabled: false });
  });

  test('lembrete: só o admin configura, e a véspera fica entre 08:00 e 21:00', async () => {
    const corpo = JSON.stringify({ crmReminder: { enabled: true } });
    assert.equal((await como(tokenAtendenteA, '/api/organization', { method: 'PATCH', body: corpo })).status, 403);
    assert.equal((await como(tokenSuperAdmin, '/api/organization', { method: 'PATCH', body: corpo })).status, 403);

    const foraDaFaixa = await comoAdminA('/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ crmReminder: { eveTime: '22:00' } }),
    });
    assert.equal(foraDaFaixa.status, 400);

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: A.orgId } });
    assert.equal(org.crmReminderEnabled, false);
  });

  test('lembrete: o admin liga, a leitura mostra, e a prévia dos textos usa o nome dele', async () => {
    const res = await comoAdminA('/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ crmReminder: { enabled: true, mode: 'EVE', eveTime: '18:00' } }),
    });
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { crmReminder: { enabled: boolean } }).crmReminder.enabled, true);

    const textos = await comoAdminA('/api/organization/crm-reminder/preview', {
      method: 'POST',
      body: JSON.stringify({ visitText: 'Aqui é [meu_primeiro_nome].', trialText: 'Oi, [primeiro_nome]!' }),
    });
    assert.equal(textos.status, 200);
    assert.deepEqual(await textos.json(), { visit: 'Aqui é Admin.', trial: 'Oi, Mariana!' });

    const doAtendente = await como(tokenAtendenteA, '/api/organization/crm-reminder/preview', {
      method: 'POST',
      body: JSON.stringify({ visitText: 'x', trialText: 'y' }),
    });
    assert.equal(doAtendente.status, 403);
  });

  test('lembrete: criar de novo troca o do mesmo lead e tipo, sem encostar na outra organização', async () => {
    await prisma.organization.update({ where: { id: B.orgId }, data: { crmReminderEnabled: true } });
    await criarLembrete(B, visitaDaqui('L-iso', 3));
    const primeira = await criarLembrete(A, visitaDaqui('L-iso', 3));
    const segunda = await criarLembrete(A, visitaDaqui('L-iso', 4));
    assert.equal(primeira.created, true);
    assert.equal(segunda.created, true);

    const daA = await lembretesDo(A.orgId, 'L-iso');
    assert.equal(daA.length, 1, 'a troca deixou mais de um lembrete');
    assert.equal((daA[0].crmReminder as { appointmentAt: string }).appointmentAt, visitaDaqui('L-iso', 4).at);
    assert.equal(daA[0].sentById, A.adminId);
    assert.equal(daA[0].direction, 'OUTBOUND');
    assert.equal((await lembretesDo(B.orgId, 'L-iso')).length, 1, 'a troca apagou o lembrete da outra organização');
  });

  test('lembrete: dois agendamentos ao mesmo tempo deixam um lembrete só', async () => {
    await Promise.all([
      criarLembrete(A, visitaDaqui('L-corrida', 3)),
      criarLembrete(A, visitaDaqui('L-corrida', 3)),
    ]);
    assert.equal((await lembretesDo(A.orgId, 'L-corrida')).length, 1);
  });

  test('lembrete: a varredura segue cada desfecho e pergunta a cada organização só pelos leads dela', async () => {
    for (const leadId of ['L-fica', 'L-muda', 'L-some']) await criarLembrete(A, visitaDaqui(leadId, 3));
    const leadsDaOrg = new Map<string, Set<string>>();
    const agendados = await prisma.message.findMany({
      where: { status: 'SCHEDULED', crmReminder: { not: Prisma.DbNull } },
    });
    for (const m of agendados) {
      const leadId = (m.crmReminder as { leadId: string }).leadId;
      leadsDaOrg.set(m.organizationId, new Set([...(leadsDaOrg.get(m.organizationId) ?? []), leadId]));
    }

    const conferencia = depsDoLembrete({
      'L-fica': visitaDaqui('L-fica', 3),
      'L-muda': visitaDaqui('L-muda', 5),
      'L-iso': visitaDaqui('L-iso', 4),
      'L-corrida': visitaDaqui('L-corrida', 3),
    });
    await runCrmReminderSweep(conferencia.deps);

    assert.ok(conferencia.perguntas.length >= 2, 'as duas organizações têm lembrete');
    for (const p of conferencia.perguntas) {
      for (const leadId of p.leadIds) {
        assert.ok(leadsDaOrg.get(p.org)?.has(leadId), `${leadId} perguntado pela organização errada`);
      }
    }

    const [fica] = await lembretesDo(A.orgId, 'L-fica');
    assert.ok((fica.crmReminder as { checkedAt: string | null }).checkedAt, 'a conferência não marcou a hora');

    const [muda] = await lembretesDo(A.orgId, 'L-muda');
    assert.equal((muda.crmReminder as { appointmentAt: string }).appointmentAt, visitaDaqui('L-muda', 5).at);
    const [, mes, dia] = diaDaqui(4).split('-');
    assert.equal(
      await notasCom(A.conversationId, `Lembrete da visita remarcado para ${dia}/${mes} às 18:00, junto com o agendamento.`),
      1,
    );

    assert.equal((await lembretesDo(A.orgId, 'L-some')).length, 0);
    assert.equal(
      await notasCom(A.conversationId, 'Lembrete da visita cancelado: o agendamento mudou no Stronilead.'),
      1,
    );
  });

  test('lembrete: na hora de enviar, com o Stronilead fora, espera; passado o prazo, não sai e deixa a nota', async () => {
    await criarLembrete(A, visitaDaqui('L-fora', 3));
    const [lembrete] = await lembretesDo(A.orgId, 'L-fora');
    const hora = horaDoLembrete();
    await prisma.message.update({ where: { id: lembrete.id }, data: { scheduledFor: hora } });

    const fora = depsDoLembrete(null, new Date(hora.getTime() + 60_000));
    assert.equal(await prepareCrmReminderDispatch(lembrete.id, fora.deps), 'esperar');
    const esperando = await prisma.message.findUniqueOrThrow({ where: { id: lembrete.id } });
    assert.equal(esperando.status, 'SCHEDULED');
    assert.ok((esperando.crmReminder as { unansweredSince: string | null }).unansweredSince);

    const depois = depsDoLembrete(null, new Date(hora.getTime() + 31 * 60_000));
    assert.equal(await prepareCrmReminderDispatch(lembrete.id, depois.deps), 'nao_enviar');
    assert.equal(depois.perguntas.length, 0);
    assert.equal(await prisma.message.count({ where: { id: lembrete.id } }), 0);
    assert.equal(
      await notasCom(
        A.conversationId,
        'Lembrete da visita não enviado: o Stronilead não respondeu para confirmar o horário.',
      ),
      1,
    );
  });

  test('lembrete: conferido na hora de enviar, sai, e a conversa encerrada não barra', async () => {
    await criarLembrete(A, visitaDaqui('L-sai', 3), A.buscaEncerradaId);
    const [lembrete] = await lembretesDo(A.orgId, 'L-sai');
    const hora = horaDoLembrete();
    await prisma.message.update({ where: { id: lembrete.id }, data: { scheduledFor: hora } });

    const conferido = depsDoLembrete({ 'L-sai': visitaDaqui('L-sai', 3) }, new Date(hora.getTime() + 60_000));
    assert.equal(await prepareCrmReminderDispatch(lembrete.id, conferido.deps), 'enviar');

    // O que o agendador lê antes de enviar: a conversa continua encerrada, e
    // o lembrete passa pela regra da conversa encerrada.
    const antesDeEnviar = await prisma.message.findUniqueOrThrow({
      where: { id: lembrete.id },
      include: { conversation: true },
    });
    assert.equal(antesDeEnviar.conversation.status, 'ENDED');
    assert.equal(
      scheduledSendBlock({
        conversationStatus: antesDeEnviar.conversation.status,
        isCrmReminder: antesDeEnviar.crmReminder !== null,
      }),
      null,
    );
  });

  // Por último, porque apaga os lembretes pendentes da org B.
  test('lembrete: desligar o lembrete na academia cancela os pendentes dela, com a nota', async () => {
    await criarLembrete(B, visitaDaqui('L-desliga', 3));
    await prisma.organization.update({ where: { id: B.orgId }, data: { crmReminderEnabled: false } });

    const varredura = depsDoLembrete({});
    await runCrmReminderSweep(varredura.deps);

    assert.equal((await lembretesDo(B.orgId, 'L-desliga')).length, 0);
    assert.equal(
      await notasCom(
        B.conversationId,
        'Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações.',
      ) >= 1,
      true,
    );
    assert.equal(varredura.perguntas.some((p) => p.org === B.orgId), false, 'org desligada não pergunta ao Stronilead');
  });
```

- [ ] **Step 2: Rodar a suíte de isolamento num banco descartável**

O banco tem nome próprio deste PR, `stronizap_isolation_lembrete`, e não o `stronizap_isolation_test` padrão do script: o padrão pode estar em uso por outra sessão na máquina. O `test:isolation` lê o `TEST_DATABASE_URL`.

```bash
cd backend
createdb stronizap_isolation_lembrete
DATABASE_URL="postgresql://$USER@localhost:5432/stronizap_isolation_lembrete" npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://$USER@localhost:5432/stronizap_isolation_lembrete" npm run test:isolation
dropdb stronizap_isolation_lembrete
```

Expected: a suíte inteira verde, com os 10 testes novos do lembrete, e o banco apagado no fim. Se `createdb` disser que o banco já existe, é sobra de uma rodada anterior deste PR: rode `dropdb stronizap_isolation_lembrete` antes.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/tenant-isolation.spec.ts
git commit -m "test: lembrete de agendamento na suíte de isolamento entre organizações

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: A bolha diz "lembrete da visita", e a nota vira a pílula do mockup

**Files:**
- Modify: `frontend/src/types/message.ts` (depois da linha 67)
- Create: `frontend/src/lib/reminderNote.ts`
- Test: `frontend/src/lib/reminderNote.test.ts`
- Modify: `frontend/src/lib/transferNote.ts` (linhas 51-60, `messagePreview`)
- Modify: `frontend/src/components/MessageBubble.tsx` (linha 36, linhas 649-703 do `ScheduledBubble` e linhas 751-760 do despachante)
- Test: `frontend/src/components/MessageBubble.test.tsx`

Duas mudanças na conversa, as duas do mockup aprovado. A agendada que é lembrete ganha "· lembrete da visita" no cabeçalho (seção 3; nota 12): o backend já manda o `crmReminder` em toda mensagem, porque o Prisma devolve todas as colunas, e a tela usa só o tipo. E a nota do lembrete deixa de ser a nota interna amarela e vira a pílula centralizada da seção 5 ("Remarcado ou cancelado no Stronilead"): sino cortado, fundo claro, borda fina e cantos arredondados. O molde é o do cartão de transferência (`parseTransferNote` em `lib/transferNote.ts` e `TransferNoteCard` no `MessageBubble.tsx`): a mensagem continua `INTERNAL`, o `content` leva o payload `{ kind: 'crm_reminder_note', event, text }` que o backend grava (`reminderNoteContent`, Task 5), e o despachante do `MessageBubble` desenha a pílula quando reconhece o payload. O resumo da conversa na lista e nos avisos mostra o texto da nota, nunca o JSON.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/reminderNote.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { parseReminderNote } from './reminderNote';
import { messagePreview } from './transferNote';

const NOTA = JSON.stringify({
  kind: 'crm_reminder_note',
  event: 'nao_enviado_mudou',
  text: 'Lembrete da visita não enviado: o agendamento mudou no Stronilead.',
});

describe('parseReminderNote', () => {
  test('reconhece o payload que o backend grava', () => {
    expect(parseReminderNote(NOTA)).toEqual({
      kind: 'crm_reminder_note',
      event: 'nao_enviado_mudou',
      text: 'Lembrete da visita não enviado: o agendamento mudou no Stronilead.',
    });
  });

  test('texto comum, JSON quebrado, outro payload ou sem texto não é nota do lembrete', () => {
    expect(parseReminderNote('Lembrete da visita cancelado')).toBeNull();
    expect(parseReminderNote('{quebrado')).toBeNull();
    expect(parseReminderNote(JSON.stringify({ kind: 'transfer_note', note: 'x' }))).toBeNull();
    expect(parseReminderNote(JSON.stringify({ kind: 'crm_reminder_note', event: 'cancelado', text: '' }))).toBeNull();
    expect(parseReminderNote(null)).toBeNull();
  });
});

describe('resumo da conversa', () => {
  test('a nota do lembrete aparece pelo texto, nunca pelo JSON', () => {
    expect(messagePreview({ type: 'TEXT', direction: 'INTERNAL', content: NOTA })).toBe(
      'Lembrete da visita não enviado: o agendamento mudou no Stronilead.',
    );
  });
});
```

No fim de `frontend/src/components/MessageBubble.test.tsx`, acrescentar:

```tsx
describe('MessageBubble, lembrete de agendamento', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test('a agendada que é lembrete diz de qual agendamento', () => {
    act(() => {
      root.render(<Providers message={scheduledTextMessage({ crmReminder: { type: 'visita' } })} />);
    });
    expect(container.textContent).toContain('lembrete da visita');

    act(() => {
      root.render(<Providers message={scheduledTextMessage({ crmReminder: { type: 'aula_experimental' } })} />);
    });
    expect(container.textContent).toContain('lembrete da aula experimental');
  });

  test('a agendada comum não fala em lembrete', () => {
    act(() => {
      root.render(<Providers message={scheduledTextMessage()} />);
    });
    expect(container.textContent).toContain('Agendada para');
    expect(container.textContent).not.toContain('lembrete da');
  });

  test('a nota do lembrete vira a pílula do mockup, sem o rótulo de nota interna', () => {
    const nota = scheduledTextMessage({
      direction: 'INTERNAL',
      status: 'SENT',
      scheduledFor: null,
      sentById: null,
      sentBy: null,
      content: JSON.stringify({
        kind: 'crm_reminder_note',
        event: 'nao_enviado_mudou',
        text: 'Lembrete da visita não enviado: o agendamento mudou no Stronilead.',
      }),
    });

    act(() => {
      root.render(<Providers message={nota} />);
    });

    const pilula = container.querySelector('[data-crm-reminder-note]');
    expect(pilula?.textContent).toBe('Lembrete da visita não enviado: o agendamento mudou no Stronilead.');
    expect(container.textContent).not.toContain('Nota interna');
    expect(container.textContent).not.toContain('crm_reminder_note');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/reminderNote.test.ts src/components/MessageBubble.test.tsx`
Expected: FAIL com `Failed to resolve import "./reminderNote"`, e os testes da bolha sem "lembrete da" e sem a pílula.

- [ ] **Step 3: O payload da nota em `frontend/src/lib/reminderNote.ts`**

```ts
/**
 * Payload no `content` da mensagem INTERNAL que o lembrete de agendamento grava
 * quando muda ou não sai (spec 2026-09-29, PR 3). Quando presente, a conversa
 * desenha a pílula do mockup (seção 5) em vez da nota interna comum, no molde
 * do cartão de transferência (`parseTransferNote`).
 *
 * Mantido em sincronia com `reminderNoteContent` e `ReminderNote` em
 * backend/src/services/crm-reminder-text.ts.
 */
export interface ReminderNotePayload {
  kind: 'crm_reminder_note';
  /** O que aconteceu: o `kind` da nota no backend. O remarcado leva o sino sem o corte. */
  event: 'cancelado' | 'nao_enviado_mudou' | 'sem_resposta' | 'atrasado' | 'desligado' | 'remarcado';
  /** O texto pronto, como "Lembrete da visita não enviado: o agendamento mudou no Stronilead." */
  text: string;
}

/**
 * Tenta ler `content` como a nota do lembrete. Devolve null se não é JSON, se
 * é outro payload ou se não tem texto. Seguro com qualquer string.
 */
export function parseReminderNote(content: string | null | undefined): ReminderNotePayload | null {
  if (!content || !content.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content) as Partial<ReminderNotePayload> | null;
    if (parsed?.kind !== 'crm_reminder_note') return null;
    if (typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
    return parsed as ReminderNotePayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: O resumo em `frontend/src/lib/transferNote.ts`**

No topo, logo depois de `import { contactsPreviewLabel } from './contactCard';`, acrescentar:

```ts
import { parseReminderNote } from './reminderNote';
```

E, em `messagePreview`, trocar:

```ts
  if (message.direction === 'INTERNAL') {
    const transfer = parseTransferNote(message.content);
    if (transfer) return '↪ Transferência';
    return message.content ?? '';
  }
```

por:

```ts
  if (message.direction === 'INTERNAL') {
    const transfer = parseTransferNote(message.content);
    if (transfer) return '↪ Transferência';
    // Nota do lembrete de agendamento: o texto, nunca o JSON do payload.
    const lembrete = parseReminderNote(message.content);
    if (lembrete) return lembrete.text;
    return message.content ?? '';
  }
```

- [ ] **Step 5: A bolha e a pílula em `frontend/src/components/MessageBubble.tsx`**

Em `frontend/src/types/message.ts`, logo depois de `scheduledFor: string | null;` (linha 67), acrescentar:

```ts
  /**
   * Preenchido só no lembrete automático de agendamento (spec 2026-09-29,
   * PR 3). O backend manda o JSON inteiro; a tela usa só o tipo, para a
   * bolha dizer "lembrete da visita". Opcional porque o stub local não tem.
   */
  crmReminder?: { type: 'visita' | 'aula_experimental' } | null;
```

Em `frontend/src/components/MessageBubble.tsx`, logo depois de `import { parseTransferNote, type TransferNotePayload } from '../lib/transferNote';` (linha 36), acrescentar:

```tsx
import { Bell, BellOff } from 'lucide-react';
import { parseReminderNote, type ReminderNotePayload } from '../lib/reminderNote';
```

Logo antes de `function ScheduledBubble({ message }: { message: Message }) {`, acrescentar:

```tsx
/** "lembrete da visita" ou "lembrete da aula experimental", na bolha da agendada (mockup, seção 3). */
function reminderLabel(type: 'visita' | 'aula_experimental'): string {
  return type === 'visita' ? 'lembrete da visita' : 'lembrete da aula experimental';
}

/**
 * A nota do lembrete de agendamento, como o mockup aprovado desenha (seção 5):
 * uma pílula centralizada, com o sino cortado, fundo claro, borda fina e cantos
 * arredondados. O remarcado leva o sino sem o corte, porque o lembrete continua.
 */
function ReminderNotePill({ payload }: { payload: ReminderNotePayload }) {
  const Sino = payload.event === 'remarcado' ? Bell : BellOff;
  return (
    <div className="flex justify-center px-2 py-1.5">
      <div
        data-crm-reminder-note=""
        className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-center text-[11px] leading-snug"
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)', color: 'var(--ink-2)' }}
      >
        <Sino size={13} aria-hidden="true" className="flex-none" />
        <span>{payload.text}</span>
      </div>
    </div>
  );
}

```

Dentro do `ScheduledBubble`, trocar:

```tsx
            🕒 Agendada para {formatScheduledFor(message.scheduledFor)}
            {message.sentBy && (
```

por:

```tsx
            🕒 Agendada para {formatScheduledFor(message.scheduledFor)}
            {message.crmReminder && (
              <>
                <span className="opacity-60"> · </span>
                <span className="normal-case">{reminderLabel(message.crmReminder.type)}</span>
              </>
            )}
            {message.sentBy && (
```

E, no despachante `MessageBubble`, trocar:

```tsx
  if (message.direction === 'INTERNAL') {
    const transferPayload = parseTransferNote(message.content);
```

por:

```tsx
  if (message.direction === 'INTERNAL') {
    // Nota do lembrete de agendamento: a pílula do mockup, não a nota amarela.
    const lembrete = parseReminderNote(message.content);
    if (lembrete) return <ReminderNotePill payload={lembrete} />;
    const transferPayload = parseTransferNote(message.content);
```

O despachante continua sem hook: `parseReminderNote` é uma função comum, e a pílula é um subcomponente, como o cartão de transferência (`CLAUDE.md`, seção 14).

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/reminderNote.test.ts src/components/MessageBubble.test.tsx && npm run typecheck`
Expected: PASS, com os 3 testes novos do payload e os 3 da bolha, e typecheck limpo.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/message.ts frontend/src/lib/reminderNote.ts frontend/src/lib/reminderNote.test.ts frontend/src/lib/transferNote.ts frontend/src/components/MessageBubble.tsx frontend/src/components/MessageBubble.test.tsx
git commit -m "feat: bolha do lembrete de agendamento e a nota em pílula, como no mockup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: `lib/crmReminderSettings.ts`, as regras do formulário da configuração

**Files:**
- Create: `frontend/src/lib/crmReminderSettings.ts`
- Test: `frontend/src/lib/crmReminderSettings.test.ts`

Regras puras do cartão da Task 17. O servidor confere de novo (zod da rota, Task 13); aqui é para a tela dizer o que falta antes de salvar. As mensagens de erro estão na lista de textos a confirmar (item 7).

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmReminderSettings.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import {
  appendVariable,
  reminderFormErrors,
  reminderPatch,
  TRIAL_VARIABLES,
  VISIT_VARIABLES,
  type ReminderForm,
} from './crmReminderSettings';

const FORM: ReminderForm = {
  mode: 'EVE',
  eveTime: '18:00',
  hoursBefore: '3',
  visitText: 'Oi, [primeiro_nome]!',
  trialText: 'Oi, [primeiro_nome]!',
};

describe('reminderFormErrors', () => {
  test('o padrão da spec não tem erro', () => {
    expect(reminderFormErrors(FORM)).toEqual({});
  });

  test('a véspera vai de 08:00 a 21:00, com as duas pontas', () => {
    for (const eveTime of ['08:00', '21:00']) expect(reminderFormErrors({ ...FORM, eveTime })).toEqual({});
    for (const eveTime of ['07:59', '21:01', '25:00', '']) {
      expect(reminderFormErrors({ ...FORM, eveTime }).eveTime, eveTime).toBe('Escolha um horário entre 08:00 e 21:00.');
    }
  });

  test('as horas antes vão de 1 a 48, só no modo de horas', () => {
    const horas = (hoursBefore: string) => reminderFormErrors({ ...FORM, mode: 'HOURS_BEFORE', hoursBefore });
    expect(horas('1')).toEqual({});
    expect(horas('48')).toEqual({});
    for (const v of ['0', '49', '2.5', '']) expect(horas(v).hoursBefore, v).toBe('Escolha de 1 a 48 horas.');
    expect(reminderFormErrors({ ...FORM, hoursBefore: '' })).toEqual({});
  });

  test('os dois textos são obrigatórios', () => {
    expect(reminderFormErrors({ ...FORM, visitText: '  ', trialText: '' })).toEqual({
      visitText: 'Escreva o texto do lembrete.',
      trialText: 'Escreva o texto do lembrete.',
    });
  });
});

describe('reminderPatch', () => {
  test('na véspera, manda a hora e não as horas antes', () => {
    expect(reminderPatch({ ...FORM, visitText: '  Oi!  ' })).toEqual({
      mode: 'EVE',
      eveTime: '18:00',
      visitText: 'Oi!',
      trialText: 'Oi, [primeiro_nome]!',
    });
  });

  test('em horas antes, manda o número e não a hora', () => {
    expect(reminderPatch({ ...FORM, mode: 'HOURS_BEFORE', hoursBefore: '5' })).toEqual({
      mode: 'HOURS_BEFORE',
      hoursBefore: 5,
      visitText: 'Oi, [primeiro_nome]!',
      trialText: 'Oi, [primeiro_nome]!',
    });
  });
});

describe('variáveis', () => {
  test('o chip entra no fim do texto, com espaço quando precisa', () => {
    expect(appendVariable('Oi,', '[primeiro_nome]')).toBe('Oi, [primeiro_nome]');
    expect(appendVariable('Oi, ', '[primeiro_nome]')).toBe('Oi, [primeiro_nome]');
    expect(appendVariable('', '[dia]')).toBe('[dia]');
  });

  test('os chips são os do mockup mais o [meu_primeiro_nome], e o [professor] não entra', () => {
    expect(VISIT_VARIABLES).toEqual([
      '[primeiro_nome]',
      '[do_aluno]',
      '[dia]',
      '[hora]',
      '[unidade]',
      '[endereco]',
      '[meu_primeiro_nome]',
    ]);
    expect(TRIAL_VARIABLES).toEqual([
      '[primeiro_nome]',
      '[do_aluno]',
      '[dia]',
      '[hora]',
      '[modalidade]',
      '[professor_da_aula]',
      '[meu_primeiro_nome]',
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmReminderSettings.test.ts`
Expected: FAIL com `Failed to resolve import "./crmReminderSettings"`.

- [ ] **Step 3: Implementar `frontend/src/lib/crmReminderSettings.ts`**

```ts
// Regras puras do cartão "Lembrete de agendamento", em Configurações →
// Stronilead (spec 2026-09-29, PR 3; mockup, seção 4). O servidor confere de
// novo no zod de organization.routes.ts; aqui é para a tela dizer o que falta
// antes de salvar.

export type CrmReminderMode = 'EVE' | 'HOURS_BEFORE';

/** O bloco `crmReminder` do GET /organization. */
export interface CrmReminderConfig {
  enabled: boolean;
  mode: CrmReminderMode;
  eveTime: string;
  hoursBefore: number;
  visitText: string;
  trialText: string;
}

/** O teto do backend (REMINDER_TEXT_MAX, em crm-reminder-text.ts). Mexeu num, mexa no outro. */
export const REMINDER_TEXT_MAX = 1000;
export const EVE_TIME_MIN = '08:00';
export const EVE_TIME_MAX = '21:00';
export const HOURS_BEFORE_MIN = 1;
export const HOURS_BEFORE_MAX = 48;

/** Os chips de cada texto: os do mockup, mais o [meu_primeiro_nome], que a spec lista. */
export const VISIT_VARIABLES = [
  '[primeiro_nome]',
  '[do_aluno]',
  '[dia]',
  '[hora]',
  '[unidade]',
  '[endereco]',
  '[meu_primeiro_nome]',
];
export const TRIAL_VARIABLES = [
  '[primeiro_nome]',
  '[do_aluno]',
  '[dia]',
  '[hora]',
  '[modalidade]',
  '[professor_da_aula]',
  '[meu_primeiro_nome]',
];

/** O formulário como a tela guarda: as horas em texto, como o campo devolve. */
export interface ReminderForm {
  mode: CrmReminderMode;
  eveTime: string;
  hoursBefore: string;
  visitText: string;
  trialText: string;
}

export type ReminderFormErrors = Partial<Record<'eveTime' | 'hoursBefore' | 'visitText' | 'trialText', string>>;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** O que falta. Só o campo do modo escolhido é conferido. */
export function reminderFormErrors(form: ReminderForm): ReminderFormErrors {
  const erros: ReminderFormErrors = {};
  if (form.mode === 'EVE' && !(HORA.test(form.eveTime) && form.eveTime >= EVE_TIME_MIN && form.eveTime <= EVE_TIME_MAX)) {
    erros.eveTime = 'Escolha um horário entre 08:00 e 21:00.';
  }
  const horas = Number(form.hoursBefore);
  if (
    form.mode === 'HOURS_BEFORE' &&
    !(form.hoursBefore.trim() !== '' && Number.isInteger(horas) && horas >= HOURS_BEFORE_MIN && horas <= HOURS_BEFORE_MAX)
  ) {
    erros.hoursBefore = 'Escolha de 1 a 48 horas.';
  }
  if (!form.visitText.trim()) erros.visitText = 'Escreva o texto do lembrete.';
  if (!form.trialText.trim()) erros.trialText = 'Escreva o texto do lembrete.';
  return erros;
}

/** O `crmReminder` do PATCH /organization: o modo, o valor dele e os dois textos. */
export function reminderPatch(form: ReminderForm) {
  return {
    mode: form.mode,
    ...(form.mode === 'EVE' ? { eveTime: form.eveTime } : { hoursBefore: Number(form.hoursBefore) }),
    visitText: form.visitText.trim(),
    trialText: form.trialText.trim(),
  };
}

/** O chip entra no fim do texto, com espaço quando precisa, como nas mensagens prontas. */
export function appendVariable(text: string, token: string): string {
  return text && !/\s$/.test(text) ? `${text} ${token}` : `${text}${token}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/crmReminderSettings.test.ts`
Expected: PASS, com os 8 testes novos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/crmReminderSettings.ts frontend/src/lib/crmReminderSettings.test.ts
git commit -m "feat: regras do formulário do lembrete de agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: O cartão "Lembrete de agendamento" em Configurações → Stronilead

**Files:**
- Create: `frontend/src/components/settings/CrmReminderSettings.tsx`
- Test: `frontend/src/components/settings/CrmReminderSettings.test.tsx`
- Modify: `frontend/src/components/settings/CrmIntegrationManager.tsx` (linhas 7-28, 30-55, 153-156 e 250-252)
- Test: `frontend/src/components/settings/CrmIntegrationManager.test.tsx` (novo)

O cartão do mockup, seção 4, embaixo dos dados da conexão. Configurações → Stronilead já é só do admin (`adminOnly` no `SettingsModal`), e o `CrmIntegrationManager` já mostra ao superadmin só o aviso de que a configuração é por organização; o cartão entra só no caminho do admin. A chave salva na hora, como a da conexão; o resto salva no botão. A prévia vem da rota da Task 13, 400 ms depois da última tecla.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/components/settings/CrmReminderSettings.test.tsx`:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const patch = vi.fn();
const post = vi.fn();
vi.mock('../../lib/api', () => ({
  api: { patch: (...a: unknown[]) => patch(...a), post: (...a: unknown[]) => post(...a) },
}));
const avisoOk = vi.fn();
const avisoErro = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...a: unknown[]) => avisoOk(...a), error: (...a: unknown[]) => avisoErro(...a) },
}));

import { CrmReminderSettings, PREVIEW_DELAY_MS } from './CrmReminderSettings';
import { TRIAL_VARIABLES, VISIT_VARIABLES, type CrmReminderConfig } from '../../lib/crmReminderSettings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PADRAO: CrmReminderConfig = {
  enabled: false,
  mode: 'EVE',
  eveTime: '18:00',
  hoursBefore: 3,
  visitText:
    'Oi, [primeiro_nome]! Passando para lembrar da visita [do_aluno] [dia], às [hora], na unidade [unidade]. Até lá!',
  trialText:
    'Oi, [primeiro_nome]! Passando para lembrar da aula experimental de [modalidade] [do_aluno] [dia], às [hora]. Até lá!',
};

let container: HTMLDivElement;
let root: Root;

function montar(config: CrmReminderConfig = PADRAO) {
  act(() => {
    root.render(<CrmReminderSettings initial={config} />);
  });
}

function digitar(el: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function botao(texto: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('button')].find((el) => el.textContent === texto);
  if (!b) throw new Error(`botão "${texto}" não achado`);
  return b;
}

beforeEach(() => {
  vi.useFakeTimers();
  patch.mockReset().mockResolvedValue({ data: {} });
  post.mockReset().mockResolvedValue({
    data: { visit: 'Oi, Mariana! prévia da visita', trial: 'Oi, Mariana! prévia da aula' },
  });
  avisoOk.mockReset();
  avisoErro.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

describe('CrmReminderSettings', () => {
  test('mostra o cartão do mockup: título, quando sai, a faixa da noite, os textos e os chips', () => {
    montar();
    const texto = container.textContent ?? '';
    for (const trecho of [
      'Lembrete de agendamento',
      'O Stronizap envia sozinho, pelo número da conversa, um lembrete antes da visita ou da aula agendada por aqui.',
      'Quando sai',
      'Na véspera, às',
      'horas antes do horário marcado',
      'O lembrete nunca sai entre 21h e 8h. Se cair nesse intervalo, sai às 20h da véspera.',
      'Texto para visita',
      'Texto para aula experimental',
      'Prévia da visita',
      'Prévia da aula experimental',
    ]) {
      expect(texto, trecho).toContain(trecho);
    }
    const chips = [...container.querySelectorAll('button.mono')].map((b) => b.textContent);
    expect(chips).toEqual([...VISIT_VARIABLES, ...TRIAL_VARIABLES]);
  });

  test('a prévia vem do servidor com os dois textos, depois de uma pausa', async () => {
    montar();
    expect(post).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    });

    expect(post).toHaveBeenCalledWith('/organization/crm-reminder/preview', {
      visitText: PADRAO.visitText,
      trialText: PADRAO.trialText,
    });
    expect(container.textContent).toContain('Oi, Mariana! prévia da visita');
    expect(container.textContent).toContain('Oi, Mariana! prévia da aula');
  });

  test('a chave liga o lembrete na hora', async () => {
    montar();
    const chave = container.querySelector<HTMLButtonElement>('button[role="switch"]')!;

    await act(async () => {
      chave.click();
    });

    expect(patch).toHaveBeenCalledWith('/organization', { crmReminder: { enabled: true } });
    expect(chave.getAttribute('aria-checked')).toBe('true');
  });

  test('a chave volta quando o servidor recusa', async () => {
    patch.mockRejectedValueOnce(new Error('recusado'));
    montar();
    const chave = container.querySelector<HTMLButtonElement>('button[role="switch"]')!;

    await act(async () => {
      chave.click();
    });

    expect(chave.getAttribute('aria-checked')).toBe('false');
    expect(avisoErro).toHaveBeenCalledWith('Falha ao atualizar o lembrete');
  });

  test('Salvar manda o modo, a hora da véspera e os dois textos', async () => {
    montar();

    await act(async () => {
      botao('Salvar').click();
    });

    expect(patch).toHaveBeenCalledWith('/organization', {
      crmReminder: { mode: 'EVE', eveTime: '18:00', visitText: PADRAO.visitText, trialText: PADRAO.trialText },
    });
    expect(avisoOk).toHaveBeenCalledWith('Lembrete salvo');
  });

  test('horas antes: escolher o modo e o número', async () => {
    montar();
    const [, horasAntes] = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    act(() => {
      horasAntes.click();
    });
    digitar(container.querySelector<HTMLInputElement>('input[type="number"]')!, '5');

    await act(async () => {
      botao('Salvar').click();
    });

    expect(patch).toHaveBeenCalledWith('/organization', {
      crmReminder: { mode: 'HOURS_BEFORE', hoursBefore: 5, visitText: PADRAO.visitText, trialText: PADRAO.trialText },
    });
  });

  test('hora da véspera fora da faixa não salva e diz o que falta', async () => {
    montar();
    digitar(container.querySelector<HTMLInputElement>('input[type="time"]')!, '22:00');

    await act(async () => {
      botao('Salvar').click();
    });

    expect(patch).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Escolha um horário entre 08:00 e 21:00.');
  });

  test('o chip entra no fim do texto da visita', () => {
    montar();

    act(() => {
      botao('[endereco]').click();
    });

    const [visita] = [...container.querySelectorAll('textarea')];
    expect(visita.value).toBe(`${PADRAO.visitText} [endereco]`);
  });
});
```

Criar `frontend/src/components/settings/CrmIntegrationManager.test.tsx`:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { test, expect, beforeEach, afterEach, vi } from 'vitest';

const get = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    patch: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { visit: '', trial: '' } }),
  },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { CrmIntegrationManager } from './CrmIntegrationManager';
import { useAuthStore, type AuthUser } from '../../stores/auth.store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORG = {
  id: 'org1',
  name: 'STRONIX',
  attendantsSeeAllConversations: false,
  crm: { enabled: true, baseUrl: 'https://stronilead.com.br', tenantSlug: 'stronix-crm-app', hasKey: true },
  crmReminder: { enabled: false, mode: 'EVE', eveTime: '18:00', hoursBefore: 3, visitText: 'a', trialText: 'b' },
};

let container: HTMLDivElement;
let root: Root;

function entrarComo(role: AuthUser['role']) {
  useAuthStore.setState({
    user: { id: 'u1', name: 'Pessoa', email: 'pessoa@academia.com', role, avatarUrl: null, showSenderName: true },
  });
}

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: ORG });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

test('o admin vê o cartão do lembrete embaixo dos dados da conexão', async () => {
  entrarComo('ADMIN');

  await act(async () => {
    root.render(<CrmIntegrationManager />);
  });

  const texto = container.textContent ?? '';
  expect(texto).toContain('Lembrete de agendamento');
  expect(texto.indexOf('Endereço do CRM')).toBeLessThan(texto.indexOf('Lembrete de agendamento'));
});

test('o superadmin não vê o cartão do lembrete', async () => {
  entrarComo('SUPERADMIN');

  await act(async () => {
    root.render(<CrmIntegrationManager />);
  });

  expect(container.textContent).not.toContain('Lembrete de agendamento');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/settings/CrmReminderSettings.test.tsx src/components/settings/CrmIntegrationManager.test.tsx`
Expected: FAIL com `Failed to resolve import "./CrmReminderSettings"`, e o teste do admin no `CrmIntegrationManager` sem o cartão.

- [ ] **Step 3: Implementar `frontend/src/components/settings/CrmReminderSettings.tsx`**

```tsx
// Cartão "Lembrete de agendamento", em Configurações → Stronilead, só para o
// admin (spec stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// PR 3; mockup, seção 4). A chave salva na hora, como a da conexão; o resto
// salva no botão. A prévia vem do servidor (POST /organization/crm-reminder/preview),
// da mesma montagem do lembrete de verdade, então nunca diverge do que sai.
import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Moon } from 'lucide-react';
import { api } from '../../lib/api';
import {
  appendVariable,
  EVE_TIME_MAX,
  EVE_TIME_MIN,
  HOURS_BEFORE_MAX,
  HOURS_BEFORE_MIN,
  REMINDER_TEXT_MAX,
  reminderFormErrors,
  reminderPatch,
  TRIAL_VARIABLES,
  VISIT_VARIABLES,
  type CrmReminderConfig,
  type ReminderForm,
} from '../../lib/crmReminderSettings';
import { SetGroup, Switch } from './SettingsPrimitives';

/** Quanto a prévia espera depois da última tecla. */
export const PREVIEW_DELAY_MS = 400;

// O mesmo desenho do campo e dos chips das mensagens prontas (QuickRepliesManager).
const CAIXA_DE_TEXTO: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-elev)',
  fontSize: 13.5,
  color: 'var(--ink)',
  resize: 'vertical',
  outline: 'none',
};
const CHIP: CSSProperties = {
  fontSize: 11,
  padding: '3px 9px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--bg-soft)',
  color: 'var(--accent-strong)',
  cursor: 'pointer',
};
const BOLHA: CSSProperties = {
  background: 'var(--bg-soft)',
  borderRadius: '12px 12px 12px 4px',
  padding: '8px 11px',
  lineHeight: 1.45,
  width: 'fit-content',
  maxWidth: '100%',
  fontSize: 13,
  color: 'var(--ink)',
  whiteSpace: 'pre-wrap',
};
const ERRO: CSSProperties = { color: 'var(--danger)', fontSize: 12, margin: 0 };
const OPCAO: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)' };
const CAMPINHO: CSSProperties = { width: 96, height: 32 };

export function CrmReminderSettings({ initial }: { initial: CrmReminderConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [form, setForm] = useState<ReminderForm>(() => ({
    mode: initial.mode,
    eveTime: initial.eveTime,
    hoursBefore: String(initial.hoursBefore),
    visitText: initial.visitText,
    trialText: initial.trialText,
  }));
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<{ visit: string; trial: string } | null>(null);

  const erros = reminderFormErrors(form);
  const visiveis = tentouSalvar ? erros : {};
  const mudar = <K extends keyof ReminderForm>(campo: K, valor: ReminderForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  useEffect(() => {
    let ativo = true;
    const timer = setTimeout(() => {
      api
        .post<{ visit: string; trial: string }>('/organization/crm-reminder/preview', {
          visitText: form.visitText,
          trialText: form.trialText,
        })
        .then(({ data }) => {
          if (ativo) setPrevia(data);
        })
        .catch(() => {
          if (ativo) setPrevia(null);
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [form.visitText, form.trialText]);

  async function alternar(v: boolean) {
    setEnabled(v);
    try {
      await api.patch('/organization', { crmReminder: { enabled: v } });
    } catch {
      setEnabled(!v);
      toast.error('Falha ao atualizar o lembrete');
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setTentouSalvar(true);
    if (Object.keys(erros).length > 0) return;
    setSalvando(true);
    try {
      await api.patch('/organization', { crmReminder: reminderPatch(form) });
      toast.success('Lembrete salvo');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Falha ao salvar o lembrete');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SetGroup
      title="Lembrete de agendamento"
      desc="O Stronizap envia sozinho, pelo número da conversa, um lembrete antes da visita ou da aula agendada por aqui."
      action={<Switch on={enabled} onChange={alternar} label="Lembrete de agendamento" />}
    >
      <form onSubmit={salvar} className="set-stack" noValidate>
        <div role="radiogroup" aria-label="Quando sai" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="set-label">Quando sai</span>
          <label style={OPCAO}>
            <input
              type="radio"
              name="crm-reminder-mode"
              checked={form.mode === 'EVE'}
              onChange={() => mudar('mode', 'EVE')}
            />
            Na véspera, às
            <input
              type="time"
              className="set-input"
              aria-label="Hora da véspera"
              style={CAMPINHO}
              min={EVE_TIME_MIN}
              max={EVE_TIME_MAX}
              value={form.eveTime}
              onChange={(e) => mudar('eveTime', e.target.value)}
            />
          </label>
          {visiveis.eveTime && (
            <p style={ERRO} role="alert">
              {visiveis.eveTime}
            </p>
          )}
          <label style={OPCAO}>
            <input
              type="radio"
              name="crm-reminder-mode"
              checked={form.mode === 'HOURS_BEFORE'}
              onChange={() => mudar('mode', 'HOURS_BEFORE')}
            />
            <input
              type="number"
              className="set-input"
              aria-label="Horas antes"
              style={{ ...CAMPINHO, width: 64 }}
              min={HOURS_BEFORE_MIN}
              max={HOURS_BEFORE_MAX}
              step={1}
              value={form.hoursBefore}
              onChange={(e) => mudar('hoursBefore', e.target.value)}
            />
            horas antes do horário marcado
          </label>
          {visiveis.hoursBefore && (
            <p style={ERRO} role="alert">
              {visiveis.hoursBefore}
            </p>
          )}
          <p className="set-help" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: 0 }}>
            <Moon size={13} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>O lembrete nunca sai entre 21h e 8h. Se cair nesse intervalo, sai às 20h da véspera.</span>
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <CampoDoTexto
            titulo="Texto para visita"
            valor={form.visitText}
            variaveis={VISIT_VARIABLES}
            erro={visiveis.visitText}
            onMudar={(v) => mudar('visitText', v)}
          />
          <CampoDoTexto
            titulo="Texto para aula experimental"
            valor={form.trialText}
            variaveis={TRIAL_VARIABLES}
            erro={visiveis.trialText}
            onMudar={(v) => mudar('trialText', v)}
          />
        </div>

        <Previa titulo="Prévia da visita" texto={previa?.visit ?? null} />
        <Previa titulo="Prévia da aula experimental" texto={previa?.trial ?? null} />
        <p className="set-help" style={{ margin: 0 }}>
          <span className="mono">[dia]</span> vira "amanhã" ou "hoje" quando é o caso, com o dia da semana e a data.{' '}
          <span className="mono">[do_aluno]</span> vira "de Pedro" quando o agendamento é de um menor e some quando é da
          própria pessoa.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="set-btn-primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </SetGroup>
  );
}

function CampoDoTexto({
  titulo,
  valor,
  variaveis,
  erro,
  onMudar,
}: {
  titulo: string;
  valor: string;
  variaveis: string[];
  erro?: string;
  onMudar: (valor: string) => void;
}) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="set-label" htmlFor={id}>
        {titulo}
      </label>
      <textarea
        id={id}
        value={valor}
        rows={4}
        maxLength={REMINDER_TEXT_MAX}
        style={CAIXA_DE_TEXTO}
        onChange={(e) => onMudar(e.target.value)}
      />
      {erro && (
        <p style={ERRO} role="alert">
          {erro}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {variaveis.map((token) => (
          <button
            key={token}
            type="button"
            className="mono"
            style={CHIP}
            onClick={() => {
              const novo = appendVariable(valor, token);
              if (novo.length <= REMINDER_TEXT_MAX) onMudar(novo);
            }}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

function Previa({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="set-label">{titulo}</span>
      <div style={BOLHA}>{texto ?? '…'}</div>
    </div>
  );
}
```

- [ ] **Step 4: Pôr o cartão no `frontend/src/components/settings/CrmIntegrationManager.tsx`**

Logo depois de `import { SetGroup, SetRow, SettingsField, Switch } from './SettingsPrimitives';` (linha 12), acrescentar:

```tsx
import { CrmReminderSettings } from './CrmReminderSettings';
import type { CrmReminderConfig } from '../../lib/crmReminderSettings';
```

No `interface OrgConfig` (linhas 18-28), logo antes do `}` que o fecha, acrescentar:

```tsx
  /** Configuração do lembrete de agendamento, fora do bloco da conexão. */
  crmReminder: CrmReminderConfig;
```

Logo depois de `const [testando, setTestando] = useState(false);` (linha 45), acrescentar:

```tsx
  const [lembrete, setLembrete] = useState<CrmReminderConfig | null>(null);
```

Dentro de `aplicar(org)`, logo depois de `setApiKey('');` (linha 54), acrescentar:

```tsx
    setLembrete(org.crmReminder ?? null);
```

No `return` principal (linhas 153-156), trocar:

```tsx
  return (
    <SetGroup
      title="Stronilead"
      desc="Traz o contexto do CRM pra dentro do atendimento: quem é a pessoa, plano, vencimento e consultor."
    >
```

por:

```tsx
  return (
    <>
    <SetGroup
      title="Stronilead"
      desc="Traz o contexto do CRM pra dentro do atendimento: quem é a pessoa, plano, vencimento e consultor."
    >
```

E, no fim desse mesmo `return` (linhas 250-252, logo antes de `/** Junta a lista com vírgula e um "e" antes do último item. */`), trocar:

```tsx
    </SetGroup>
  );
}
```

por:

```tsx
    </SetGroup>
    {/* Embaixo dos dados da conexão, como no mockup. Só chega aqui o admin:
        o superadmin sai no return lá de cima. */}
    {!carregando && lembrete && <CrmReminderSettings initial={lembrete} />}
    </>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/settings && npm run typecheck`
Expected: PASS, com os 10 testes novos (8 do cartão e 2 do `CrmIntegrationManager`), e typecheck limpo.

- [ ] **Step 6: Olhar a tela de verdade**

Suba o backend e o front da máquina (`npm run dev:backend` e `npm run dev:frontend`, com um banco de desenvolvimento migrado), entre como admin e abra Configurações → Stronilead. Confira contra o mockup, seção 4: o cartão embaixo da conexão, a chave à direita do título, as duas opções de "Quando sai" com a hora e o número dentro da frase, a faixa da lua, os dois textos lado a lado com os chips, as duas prévias atualizando depois de parar de digitar e o Salvar à direita. Confira também no tema escuro. Entre como atendente e veja que a seção Stronilead não aparece.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/settings/CrmReminderSettings.tsx frontend/src/components/settings/CrmReminderSettings.test.tsx frontend/src/components/settings/CrmIntegrationManager.tsx frontend/src/components/settings/CrmIntegrationManager.test.tsx
git commit -m "feat: cartão do lembrete de agendamento em Configurações, só para o admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: O lembrete depois do agendamento, no serviço do PR 2

**Files:**
- Modify: `backend/src/services/crm-schedule.service.ts` (do PR 2: imports, `crmScheduleBodySchema`, `CrmScheduleResult`, `CrmScheduleDeps`, `depsReais` e `scheduleCrmAppointment`)
- Test: `backend/src/services/crm-schedule.service.test.ts` (do PR 2: imports, `ambiente`, o teste de sucesso e fim do arquivo)

O `reminder` entra no corpo do `POST /api/conversations/:id/crm-schedule` ao lado de `schedule`, nunca dentro (nota 21). Depois do agendamento gravado e do cartão aplicado, no comentário "Lembrete (PR 3)" que o PR 2 deixou, o serviço chama `replaceCrmReminder` (Task 7), também no `ja_agendado` (nota 19). O nome do contato e o menor saem do cartão, pelas mesmas regras da confirmação e da prévia: `nomeDoCartao(card) ?? target.contact.displayName` e `ehDeMenor(card, appointment.leadId)`. Falha do lembrete não desfaz o agendamento: a resposta sai com `reminderFailed: true`, e o balão avisa (Task 21). A rota já passa o corpo inteiro, então não muda.

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm-schedule.service.test.ts` (do PR 2), fazer estas mudanças no começo do arquivo.

1. Trocar a linha `import type { CrmReminderSettings } from './crm-reminder.service';` (da Task 12) por:

```ts
import type { CrmReminderSettings, ReplaceReminderArgs } from './crm-reminder.service';
```

2. No `interface Ambiente`, logo depois de `cartoesPedidos: string[];` (da Task 12), acrescentar:

```ts
  /** Lembretes que o agendamento pediu para criar ou trocar. */
  lembretes: ReplaceReminderArgs[];
```

3. Na função `ambiente`, logo depois de `    cartaoGuardado?: CrmCard | null;` (nas opções), acrescentar:

```ts
    /** O banco caiu na hora de criar o lembrete. */
    lembreteFalha?: boolean;
```

logo depois de `  const cartoesPedidos: string[] = [];`, acrescentar:

```ts
  const lembretes: ReplaceReminderArgs[] = [];
```

logo depois de `    cartoesPedidos,` (no objeto devolvido), acrescentar:

```ts
    lembretes,
```

dentro de `deps`, logo depois do `loadCard` da Task 12, acrescentar:

```ts
      replaceReminder: async (args) => {
        lembretes.push(args);
        if (opts.lembreteFalha) throw new Error('banco fora do ar');
        return { created: true, sendAt: new Date('2026-09-30T21:00:00.000Z') };
      },
```

e trocar a linha:

```ts
      log: { info: () => {} },
```

por:

```ts
      log: { info: () => {}, warn: () => {} },
```

4. No teste `'agendar: deu certo, 201 com o cartão, o agendamento e a confirmação, e os quatro passos do cartão'`, trocar:

```ts
      alreadyScheduled: false,
      confirmationText:
```

por:

```ts
      alreadyScheduled: false,
      reminderFailed: false,
      confirmationText:
```

E acrescentar no fim do arquivo:

```ts
// ── O lembrete depois do agendamento (PR 3) ────────────────────────────────

test('lembrete: depois do agendamento, criado com quem agendou, o contato, o agendamento e o pedido do balão', async () => {
  const amb = ambiente();

  await scheduleCrmAppointment(
    'conv-1',
    ATENDENTE,
    { ...CORPO, reminder: { enabled: true, text: 'Te espero amanhã!' } },
    amb.deps,
  );

  assert.deepEqual(amb.lembretes, [
    {
      organizationId: 'org1',
      conversationId: 'conv-1',
      channelId: 'canal-1',
      authorId: 'colab-ana',
      contactName: 'Mariana Lima',
      appointment: VISITA,
      isWard: false,
      request: { enabled: true, text: 'Te espero amanhã!' },
    },
  ]);
});

test('lembrete: sem reminder no corpo, vale o padrão da academia', async () => {
  const amb = ambiente();

  await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.deepEqual(amb.lembretes[0].request, { enabled: true, text: null });
});

test('lembrete: o ja_agendado também cria ou troca o lembrete', async () => {
  const amb = ambiente({ agendamento: { ok: true, value: { card: CARTAO, appointment: VISITA, alreadyScheduled: true } } });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.equal(r.status, 200);
  assert.equal(amb.lembretes.length, 1);
});

test('lembrete: agendamento de um menor vai com isWard e o nome do responsável', async () => {
  const responsavel: CrmCard = {
    found: true,
    kind: 'responsavel',
    name: 'Mariana Souza',
    wards: [{ leadId: 'L2', kind: 'lead', name: 'Pedro Souza', relationship: 'Filho' }],
  };
  const pedro: CrmAppointmentDetail = { ...VISITA, leadId: 'L2', leadName: 'Pedro Souza' };
  const amb = ambiente({ agendamento: { ok: true, value: { card: responsavel, appointment: pedro, alreadyScheduled: false } } });

  await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.equal(amb.lembretes[0].isWard, true);
  assert.equal(amb.lembretes[0].contactName, 'Mariana Souza');
  assert.deepEqual(amb.lembretes[0].appointment, pedro);
});

test('lembrete: falha do lembrete não desfaz o agendamento e sai com reminderFailed', async () => {
  const amb = ambiente({ lembreteFalha: true });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.equal(r.status, 201);
  assert.equal((r.body as { reminderFailed: boolean }).reminderFailed, true);
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), CARTAO);
});

test('lembrete: recusa do Stronilead não mexe em lembrete nenhum', async () => {
  const amb = ambiente({
    agendamento: {
      ok: false,
      kind: 'recusa',
      status: 422,
      code: 'horario_passado',
      message: 'Esse horário já passou. Escolha outro.',
      field: 'time',
      card: null,
      createdAt: null,
    },
  });

  await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.equal(amb.lembretes.length, 0);
});

test('schema: o reminder entra ao lado do schedule, com o texto aparado, e texto vazio é recusado', () => {
  const corpo = crmScheduleBodySchema.parse({ ...CORPO, reminder: { enabled: true, text: '  Te espero!  ' } });
  assert.deepEqual(corpo.reminder, { enabled: true, text: 'Te espero!' });
  assert.deepEqual(crmScheduleBodySchema.parse({ ...CORPO, reminder: { enabled: false, text: null } }).reminder, {
    enabled: false,
    text: null,
  });
  assert.equal('reminder' in crmScheduleBodySchema.parse(CORPO), false);
  assert.throws(() => crmScheduleBodySchema.parse({ ...CORPO, reminder: { enabled: true, text: '   ' } }));
  assert.throws(() => crmScheduleBodySchema.parse({ ...CORPO, reminder: { enabled: true, text: 'x'.repeat(1001) } }));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: o `ambiente` tem `replaceReminder` e `log.warn`, que `CrmScheduleDeps` ainda não conhece, e o corpo não aceita `reminder`.

- [ ] **Step 3: Implementar em `backend/src/services/crm-schedule.service.ts`**

Logo depois do import de `./crm-reminder-time` (da Task 12), acrescentar:

```ts
import { REMINDER_TEXT_MAX } from './crm-reminder-text';
```

E, no import de `./crm-reminder.service` (da Task 12), acrescentar `replaceCrmReminder`, `type ReplaceReminderArgs` e `type ReplaceReminderResult`:

```ts
import {
  loadCrmReminderSettings,
  previewFromSettings,
  replaceCrmReminder,
  type CrmReminderPreview,
  type CrmReminderSettings,
  type ReplaceReminderArgs,
  type ReplaceReminderResult,
} from './crm-reminder.service';
```

No `interface CrmScheduleDeps`, logo antes de `  /** A configuração do lembrete da academia (crm-reminder.service.ts), para a prévia. */` (da Task 12), acrescentar:

```ts
  /** Cria ou troca o lembrete do agendamento (crm-reminder.service.ts). */
  replaceReminder: (args: ReplaceReminderArgs) => Promise<ReplaceReminderResult>;
```

e trocar:

```ts
  log: Pick<typeof logger, 'info'>;
```

por:

```ts
  log: Pick<typeof logger, 'info' | 'warn'>;
```

No `depsReais`, logo antes de `  loadReminderSettings: (organizationId) => loadCrmReminderSettings(organizationId),` (da Task 12), acrescentar:

```ts
  replaceReminder: (args) => replaceCrmReminder(args),
```

No `crmScheduleBodySchema`, trocar o fim do objeto:

```ts
      .transform((v) => v || null),
  }),
});
```

por:

```ts
      .transform((v) => v || null),
  }),
  // Lembrete (PR 3): só do Stronizap, ao lado do `schedule`, que segue inteiro
  // para o Stronilead. `text` null é o texto padrão da academia. Sem o campo,
  // vale o padrão: lembrete ligado, com o texto da academia.
  reminder: z
    .object({
      enabled: z.boolean(),
      text: z.string().trim().min(1).max(REMINDER_TEXT_MAX).nullable(),
    })
    .optional(),
});
```

No `interface CrmScheduleResult`, logo depois de `  alreadyScheduled: boolean;`, acrescentar:

```ts
  /**
   * O agendamento valeu, mas a criação do lembrete falhou (PR 3). A tela
   * avisa "Agendado. O lembrete não foi criado.".
   */
  reminderFailed: boolean;
```

Em `scheduleCrmAppointment`, no objeto `result`, trocar:

```ts
    appointment,
    alreadyScheduled,
    // Quem recebe a confirmação é o contato:
```

por:

```ts
    appointment,
    alreadyScheduled,
    reminderFailed: false,
    // Quem recebe a confirmação é o contato:
```

E trocar o comentário que o PR 2 deixou:

```ts
  // Lembrete (PR 3): é aqui que ele é criado ou trocado, depois do agendamento
  // gravado e do cartão aplicado, com `body`, `target`, `viewer` e `result` em
  // mãos. Falha do lembrete não desfaz o agendamento.
```

por:

```ts
  // Lembrete (PR 3): criado ou trocado depois do agendamento gravado e do
  // cartão aplicado, também no `ja_agendado`, porque a primeira resposta pode
  // ter se perdido antes de o lembrete nascer; a troca por lead e tipo deixa
  // um só. O nome do contato e o menor seguem as regras da confirmação. Falha
  // do lembrete não desfaz o agendamento: a tela avisa.
  try {
    await d.replaceReminder({
      organizationId,
      conversationId,
      channelId: target.contact.channelId,
      authorId: viewer.sub,
      contactName: nomeDoCartao(card) ?? target.contact.displayName,
      appointment,
      isWard: ehDeMenor(card, appointment.leadId),
      request: body.reminder ?? { enabled: true, text: null },
    });
  } catch (err) {
    result.reminderFailed = true;
    d.log.warn({ err, organizationId, conversationId }, 'Agendamento feito, mas o lembrete não foi criado');
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm run typecheck && npm test`
Expected: typecheck limpo e PASS, com os 7 testes novos e a suíte inteira verde, inclusive os testes do agendamento do PR 2 (o de sucesso, agora com `reminderFailed: false`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-schedule.service.ts backend/src/services/crm-schedule.service.test.ts
git commit -m "feat: agendamento pelo Stronizap cria ou troca o lembrete, também no ja_agendado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Tipos do front e `lib/crmReminder.ts`, a prévia e o pedido do lembrete

**Files:**
- Modify: `frontend/src/types/crm.ts` (do PR 2: `CrmScheduleBody` e `CrmScheduleResult`)
- Create: `frontend/src/lib/crmReminder.ts`
- Test: `frontend/src/lib/crmReminder.test.ts`

Espelho dos tipos do backend e as regras puras do bloco: o corpo da prévia sai dos passos respondidos (`ScheduleValues` e `CrmScheduleOptions`, do PR 2), o pedido do lembrete só vai no agendamento quando o balão mostrou o bloco (nota 21), e o texto mudado à mão que ficou vazio volta a ser o padrão.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmReminder.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest';

const post = vi.fn();
vi.mock('./api', () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

import {
  fetchReminderPreview,
  INITIAL_REMINDER_CHOICE,
  REMINDER_NOT_CREATED,
  reminderPreviewBody,
  reminderRequest,
  reminderTitle,
} from './crmReminder';
import { SOLO, type ScheduleValues } from './crmScheduleWizard';
import type { CrmReminderPreview, CrmScheduleOptions } from '../types/crm';

const OPCOES: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [
    { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null },
    { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: null },
  ],
  units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }],
  modalities: [{ id: 'm1', name: 'Pilates' }],
  professors: [{ id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] }],
  trialClassOptions: [1, 2, 3],
  days: [{ date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' }],
};

const VISITA: ScheduleValues = {
  leadId: 'L1',
  type: 'visita',
  unit: 'Centro',
  modality: '',
  professor: '',
  quantity: null,
  date: '2026-10-01',
  time: '18:00',
  timeTouched: true,
  dayConfirmed: true,
  note: '',
  writeConfirmation: true,
};

const PREVIA: CrmReminderPreview = {
  enabled: true,
  recipientFirstName: 'Mariana',
  sendAt: '2026-09-30T21:00:00.000Z',
  whenText: 'Sai sozinho na véspera, quarta, 30/09, às 18:00.',
  text: 'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
};

beforeEach(() => {
  post.mockReset();
});

describe('reminderPreviewBody', () => {
  test('visita: a unidade com o endereço da lista, e o nome de quem vai', () => {
    expect(reminderPreviewBody(VISITA, OPCOES)).toEqual({
      leadId: 'L1',
      type: 'visita',
      date: '2026-10-01',
      time: '18:00',
      unit: 'Centro',
      unitAddress: 'Rua Garibaldi, 1200',
      modality: null,
      professorName: null,
      soloTraining: false,
      attendeeName: 'Mariana Lima',
    });
  });

  test('aula: a modalidade e o nome do professor, ou "Treina sozinho"', () => {
    const aula: ScheduleValues = { ...VISITA, leadId: 'L2', type: 'aula_experimental', unit: '', modality: 'Pilates', professor: 'p1', quantity: 1 };
    expect(reminderPreviewBody(aula, OPCOES)).toMatchObject({
      leadId: 'L2',
      type: 'aula_experimental',
      unit: null,
      unitAddress: null,
      modality: 'Pilates',
      professorName: 'Carla Dias',
      soloTraining: false,
      attendeeName: 'Pedro Lima',
    });
    expect(reminderPreviewBody({ ...aula, professor: SOLO }, OPCOES)).toMatchObject({
      professorName: null,
      soloTraining: true,
    });
  });

  test('com passo sem resposta, não há prévia', () => {
    expect(reminderPreviewBody({ ...VISITA, type: '' }, OPCOES)).toBeNull();
    expect(reminderPreviewBody({ ...VISITA, date: '' }, OPCOES)).toBeNull();
    expect(reminderPreviewBody({ ...VISITA, leadId: '' }, OPCOES)).toBeNull();
  });
});

describe('reminderRequest', () => {
  test('sem o bloco na tela, o agendamento vai sem reminder', () => {
    expect(reminderRequest(INITIAL_REMINDER_CHOICE, null)).toBeUndefined();
    expect(reminderRequest(INITIAL_REMINDER_CHOICE, { enabled: false })).toBeUndefined();
  });

  test('ligado com o texto padrão, com o texto mudado, e desligado', () => {
    expect(reminderRequest(INITIAL_REMINDER_CHOICE, PREVIA)).toEqual({ enabled: true, text: null });
    expect(reminderRequest({ enabled: true, text: 'Te espero!', editing: true }, PREVIA)).toEqual({
      enabled: true,
      text: 'Te espero!',
    });
    expect(reminderRequest({ enabled: true, text: '   ', editing: true }, PREVIA)).toEqual({ enabled: true, text: null });
    expect(reminderRequest({ enabled: false, text: 'Te espero!', editing: false }, PREVIA)).toEqual({
      enabled: false,
      text: null,
    });
  });

  test('sem tempo para lembrete, vai desligado', () => {
    const semTempo: CrmReminderPreview = { enabled: true, recipientFirstName: 'Mariana', sendAt: null, reasonText: 'x' };
    expect(reminderRequest(INITIAL_REMINDER_CHOICE, semTempo)).toEqual({ enabled: false, text: null });
  });
});

describe('textos e chamada', () => {
  test('o título do bloco leva o primeiro nome, sem artigo', () => {
    expect(reminderTitle('Mariana')).toBe('Lembrete para Mariana');
    expect(reminderTitle(null)).toBe('Lembrete para o contato');
  });

  test('o aviso da falha é o da spec', () => {
    expect(REMINDER_NOT_CREATED).toBe('Agendado. O lembrete não foi criado.');
  });

  test('a prévia vai à rota da conversa com o corpo, e falha ou resposta estranha viram falhou', async () => {
    const corpo = reminderPreviewBody(VISITA, OPCOES)!;
    post.mockResolvedValueOnce({ data: PREVIA });
    expect(await fetchReminderPreview('conv-1', corpo)).toEqual({ kind: 'ok', preview: PREVIA });
    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-reminder-preview', corpo);

    post.mockRejectedValueOnce(new Error('rede'));
    expect(await fetchReminderPreview('conv-1', corpo)).toEqual({ kind: 'falhou' });

    post.mockResolvedValueOnce({ data: { qualquer: 1 } });
    expect(await fetchReminderPreview('conv-1', corpo)).toEqual({ kind: 'falhou' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmReminder.test.ts`
Expected: FAIL com `Failed to resolve import "./crmReminder"`.

- [ ] **Step 3: Os tipos em `frontend/src/types/crm.ts`**

Trocar o `CrmScheduleBody` do PR 2:

```ts
export interface CrmScheduleBody {
  schedule: CrmScheduleInput;
}
```

por:

```ts
export interface CrmScheduleBody {
  schedule: CrmScheduleInput;
  /** O lembrete (PR 3), ao lado de `schedule`. Sem ele, vale o padrão da academia. */
  reminder?: CrmReminderRequest;
}

/** O lembrete que o balão pede junto com o agendamento. `text` null é o texto padrão da academia. */
export interface CrmReminderRequest {
  enabled: boolean;
  text: string | null;
}

/** Corpo da prévia do lembrete: o que foi escolhido nos passos do balão. Espelho do backend. */
export interface CrmReminderPreviewBody {
  leadId: string;
  type: CrmAppointmentType;
  /** AAAA-MM-DD, no horário de Brasília. */
  date: string;
  /** HH:MM. */
  time: string;
  unit: string | null;
  unitAddress: string | null;
  modality: string | null;
  professorName: string | null;
  soloTraining: boolean;
  attendeeName: string | null;
}

/**
 * A prévia do lembrete (`POST /conversations/:id/crm-reminder-preview`).
 * `enabled: false`: a academia não ligou o lembrete, e o bloco não aparece.
 */
export type CrmReminderPreview =
  | { enabled: false }
  | { enabled: true; recipientFirstName: string | null; sendAt: string; whenText: string; text: string }
  | { enabled: true; recipientFirstName: string | null; sendAt: null; reasonText: string };
```

E, no `CrmScheduleResult`, logo depois de `  alreadyScheduled: boolean;`, acrescentar:

```ts
  /** O agendamento valeu, mas o lembrete não foi criado (PR 3). */
  reminderFailed?: boolean;
```

- [ ] **Step 4: Criar `frontend/src/lib/crmReminder.ts`**

```ts
// O lembrete no balão do agendamento (spec 2026-09-29, PR 3): a chamada da
// prévia, o corpo dela tirado dos passos respondidos, o pedido do lembrete que
// vai junto com o agendamento e os textos. Quem monta a hora e o texto é o
// backend, da mesma conta que cria o lembrete: aqui não se calcula nada disso.
import { api } from './api';
import { SOLO, type ScheduleValues } from './crmScheduleWizard';
import type { CrmReminderPreview, CrmReminderPreviewBody, CrmReminderRequest, CrmScheduleOptions } from '../types/crm';

/** Aviso quando o agendamento valeu e o lembrete não nasceu (spec, "A mensagem agendada"). */
export const REMINDER_NOT_CREATED = 'Agendado. O lembrete não foi criado.';

/** O que a pessoa escolheu no bloco. `text` null é o texto padrão; `editing`, o "Editar texto" aberto. */
export interface ReminderChoice {
  enabled: boolean;
  text: string | null;
  editing: boolean;
}

export const INITIAL_REMINDER_CHOICE: ReminderChoice = { enabled: true, text: null, editing: false };

/** O corpo da prévia, ou null enquanto falta passo. Nomes e endereço saem das listas do Stronilead. */
export function reminderPreviewBody(values: ScheduleValues, options: CrmScheduleOptions): CrmReminderPreviewBody | null {
  if (!values.type || !values.leadId || !values.date || !values.time) return null;
  const visita = values.type === 'visita';
  const unidade = visita ? options.units.find((u) => u.name === values.unit) : undefined;
  const sozinho = !visita && values.professor === SOLO;
  const professor = !visita && !sozinho ? options.professors.find((p) => p.id === values.professor) : undefined;
  return {
    leadId: values.leadId,
    type: values.type,
    date: values.date,
    time: values.time,
    unit: visita ? values.unit || null : null,
    unitAddress: unidade?.address ?? null,
    modality: visita ? null : values.modality || null,
    professorName: professor?.name ?? null,
    soloTraining: sozinho,
    attendeeName: options.targets.find((t) => t.leadId === values.leadId)?.name ?? null,
  };
}

export type ReminderPreviewOutcome = { kind: 'ok'; preview: CrmReminderPreview } | { kind: 'falhou' };

function ehPrevia(data: unknown): data is CrmReminderPreview {
  const o = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!o || typeof o.enabled !== 'boolean') return false;
  if (!o.enabled) return true;
  return typeof o.sendAt === 'string'
    ? typeof o.whenText === 'string' && typeof o.text === 'string'
    : o.sendAt === null && typeof o.reasonText === 'string';
}

/** Pede a prévia. Qualquer falha some com o bloco, e o agendamento segue sem `reminder`. */
export async function fetchReminderPreview(
  conversationId: string,
  body: CrmReminderPreviewBody,
): Promise<ReminderPreviewOutcome> {
  try {
    const { data } = await api.post<unknown>(`/conversations/${conversationId}/crm-reminder-preview`, body);
    return ehPrevia(data) ? { kind: 'ok', preview: data } : { kind: 'falhou' };
  } catch {
    return { kind: 'falhou' };
  }
}

/**
 * O `reminder` do agendamento, só quando o balão mostrou o bloco. Texto mudado
 * que ficou vazio volta ao padrão, e sem tempo para lembrete vai desligado.
 */
export function reminderRequest(choice: ReminderChoice, preview: CrmReminderPreview | null): CrmReminderRequest | undefined {
  if (!preview?.enabled) return undefined;
  const ligado = choice.enabled && preview.sendAt !== null;
  const texto = choice.text?.trim() ? choice.text : null;
  return { enabled: ligado, text: ligado ? texto : null };
}

/** "Lembrete para Mariana", sem artigo, para não adivinhar o gênero. */
export function reminderTitle(recipientFirstName: string | null): string {
  return recipientFirstName ? `Lembrete para ${recipientFirstName}` : 'Lembrete para o contato';
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/crmReminder.test.ts && npm run typecheck`
Expected: PASS, com os 9 testes novos, e typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/crm.ts frontend/src/lib/crmReminder.ts frontend/src/lib/crmReminder.test.ts
git commit -m "feat: prévia e pedido do lembrete no balão do agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: O bloco "Lembrete para Mariana" no resumo do balão

**Files:**
- Create: `frontend/src/components/CrmReminderBlock.tsx`
- Test: `frontend/src/components/CrmReminderBlock.test.tsx`
- Modify: `frontend/src/components/CrmScheduleSummary.tsx` (do PR 2: import do React, `CrmScheduleSummaryProps`, a assinatura e o comentário "O bloco do lembrete (PR 3) entra aqui")
- Modify: `frontend/src/components/CrmScheduleWizard.tsx` (do PR 2: imports, estados, a prévia, `enviar()` e o `<CrmScheduleSummary`)
- Modify: `frontend/src/components/CrmScheduleWizard.test.tsx` (do PR 2: a prévia fica inerte)

O bloco do mockup (seção 2), entre os passos respondidos e a "Anotação (opcional)": a chave, ligada; quando o lembrete sai ("Sai sozinho na véspera, quarta, 30/09, às 18:00."); e o texto. "Editar texto" abre o texto para mudar só neste agendamento, com "Voltar ao texto padrão". Sem tempo para lembrete, "Sem lembrete" com o motivo. Com o lembrete desligado na academia, ou com a prévia que não carregou, o bloco não aparece. O estado mora no assistente, como a anotação: voltar a um passo para trocar a escolha não apaga a chave nem o texto mudado. A prévia é pedida ao backend quando o resumo aparece e a cada troca de escolha. O título vai sem artigo (nota 15).

- [ ] **Step 1: Escrever os testes do bloco, que falham**

Criar `frontend/src/components/CrmReminderBlock.test.tsx`:

```tsx
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { CrmReminderBlock } from './CrmReminderBlock';
import { INITIAL_REMINDER_CHOICE, type ReminderChoice } from '../lib/crmReminder';
import type { CrmReminderPreview } from '../types/crm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PREVIA: CrmReminderPreview = {
  enabled: true,
  recipientFirstName: 'Mariana',
  sendAt: '2026-09-30T21:00:00.000Z',
  whenText: 'Sai sozinho na véspera, quarta, 30/09, às 18:00.',
  text: 'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
};

let container: HTMLDivElement;
let root: Root;
let ultima: ReminderChoice | null = null;

/** O bloco com o estado de verdade, como o assistente guarda. */
function Harness({ preview }: { preview: CrmReminderPreview | null }) {
  const [choice, setChoice] = useState<ReminderChoice>(INITIAL_REMINDER_CHOICE);
  return (
    <CrmReminderBlock
      preview={preview}
      choice={choice}
      onChange={(c) => {
        ultima = c;
        setChoice(c);
      }}
    />
  );
}

function montar(preview: CrmReminderPreview | null) {
  act(() => {
    root.render(<Harness preview={preview} />);
  });
}

function botao(rotulo: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('button')].find((el) => el.textContent?.trim() === rotulo);
  if (!b) throw new Error(`botão "${rotulo}" não achado`);
  return b;
}

beforeEach(() => {
  ultima = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('CrmReminderBlock', () => {
  test('sem prévia, ou com o lembrete desligado na academia, não aparece', () => {
    montar(null);
    expect(container.innerHTML).toBe('');
    montar({ enabled: false });
    expect(container.innerHTML).toBe('');
  });

  test('mostra o título, quando sai e o texto, com a chave ligada', () => {
    montar(PREVIA);

    expect(container.textContent).toContain('Lembrete para Mariana');
    expect(container.textContent).toContain('Sai sozinho na véspera, quarta, 30/09, às 18:00.');
    expect(container.textContent).toContain(PREVIA.text);
    expect(container.querySelector('button[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  });

  test('"Editar texto" abre o texto já preenchido, e "Voltar ao texto padrão" desfaz', () => {
    montar(PREVIA);

    act(() => botao('Editar texto').click());
    const caixa = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Texto do lembrete"]');
    expect(caixa?.value).toBe(PREVIA.enabled && PREVIA.sendAt !== null ? PREVIA.text : '');
    expect(ultima).toMatchObject({ enabled: true, editing: true });

    act(() => botao('Voltar ao texto padrão').click());
    expect(ultima).toEqual({ enabled: true, text: null, editing: false });
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain(PREVIA.text);
  });

  test('desligar a chave esconde quando sai e o texto', () => {
    montar(PREVIA);

    act(() => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());

    expect(ultima?.enabled).toBe(false);
    expect(container.textContent).toContain('Lembrete para Mariana');
    expect(container.textContent).not.toContain('Sai sozinho');
  });

  test('sem tempo para lembrete, "Sem lembrete" com o motivo', () => {
    montar({
      enabled: true,
      recipientFirstName: 'Mariana',
      sendAt: null,
      reasonText: 'A visita é hoje e o horário do lembrete, na véspera, já passou. A confirmação na caixa já avisa Mariana.',
    });

    expect(container.textContent).toContain('Sem lembrete');
    expect(container.textContent).toContain('A visita é hoje e o horário do lembrete, na véspera, já passou.');
    expect(container.querySelector('button[role="switch"]')?.hasAttribute('disabled')).toBe(true);
  });

  test('contato sem nome: "Lembrete para o contato"', () => {
    montar({ ...PREVIA, recipientFirstName: null });

    expect(container.textContent).toContain('Lembrete para o contato');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmReminderBlock.test.tsx`
Expected: FAIL com `Failed to resolve import "./CrmReminderBlock"`.

- [ ] **Step 3: Criar `frontend/src/components/CrmReminderBlock.tsx`**

```tsx
// O bloco do lembrete no resumo do balão do agendamento (spec
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "No balão"; mockup, seção 2). A hora e o texto vêm da prévia do backend
// (`POST /conversations/:id/crm-reminder-preview`), da mesma conta que cria o
// lembrete. "Editar texto" muda o texto só neste agendamento, e "Voltar ao
// texto padrão" desfaz. O estado mora no assistente (CrmScheduleWizard).
import { useId } from 'react';
import { Clock, Pencil } from 'lucide-react';
import { Switch } from './ui/switch';
import { BOTAO_FANTASMA } from './CrmLeadForm';
import { REMINDER_TEXT_MAX } from '../lib/crmReminderSettings';
import { reminderTitle, type ReminderChoice } from '../lib/crmReminder';
import type { CrmReminderPreview } from '../types/crm';

type Props = {
  preview: CrmReminderPreview | null;
  choice: ReminderChoice;
  onChange: (choice: ReminderChoice) => void;
};

type PreviaComHora = Extract<CrmReminderPreview, { sendAt: string }>;

/**
 * Despachante sem hook, pela regra da casa (CLAUDE.md, seção 14): cada forma do
 * bloco é um subcomponente, e só a forma com o lembrete usa hook.
 */
export function CrmReminderBlock({ preview, choice, onChange }: Props) {
  if (!preview?.enabled) return null;
  if (preview.sendAt === null) return <SemLembrete reasonText={preview.reasonText} />;
  return <ComLembrete preview={preview} choice={choice} onChange={onChange} />;
}

function SemLembrete({ reasonText }: { reasonText: string }) {
  return (
    <div
      data-crm-lembrete=""
      className="flex flex-col gap-1 rounded-[10px] p-2.5 text-[11.5px]"
      style={{ background: 'var(--bg-soft)' }}
    >
      <div className="flex items-center gap-2" style={{ color: 'var(--ink-2)' }}>
        <Switch checked={false} disabled aria-label="Sem lembrete" />
        <span className="font-semibold">Sem lembrete</span>
      </div>
      <p className="leading-snug" style={{ color: 'var(--ink-3)' }}>
        {reasonText}
      </p>
    </div>
  );
}

function ComLembrete({
  preview,
  choice,
  onChange,
}: {
  preview: PreviaComHora;
  choice: ReminderChoice;
  onChange: (choice: ReminderChoice) => void;
}) {
  const id = useId();
  const texto = choice.text ?? preview.text;
  return (
    <div
      data-crm-lembrete=""
      className="flex flex-col gap-1.5 rounded-[10px] border p-2.5 text-[11.5px]"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <Switch
          id={`${id}lembrete`}
          checked={choice.enabled}
          onCheckedChange={(on) => onChange({ ...choice, enabled: on })}
        />
        <label htmlFor={`${id}lembrete`} className="font-semibold" style={{ color: 'var(--ink)' }}>
          {reminderTitle(preview.recipientFirstName)}
        </label>
        {choice.enabled && !choice.editing && (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 text-[11px]"
            style={{ color: 'var(--accent-strong)' }}
            onClick={() => onChange({ ...choice, editing: true, text: texto })}
          >
            <Pencil size={12} aria-hidden="true" />
            Editar texto
          </button>
        )}
      </div>

      {choice.enabled && (
        <>
          <p className="inline-flex items-center gap-1" style={{ color: 'var(--ink-2)' }}>
            <Clock size={12} aria-hidden="true" />
            {preview.whenText}
          </p>
          {choice.editing ? (
            <>
              <textarea
                aria-label="Texto do lembrete"
                className="crm-field crm-field--area"
                value={texto}
                rows={3}
                maxLength={REMINDER_TEXT_MAX}
                onChange={(e) => onChange({ ...choice, text: e.target.value })}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className={BOTAO_FANTASMA}
                  style={{ color: 'var(--ink-2)' }}
                  onClick={() => onChange({ enabled: true, text: null, editing: false })}
                >
                  Voltar ao texto padrão
                </button>
              </div>
            </>
          ) : (
            <p
              className="whitespace-pre-wrap rounded-[12px] px-2.5 py-2 leading-snug"
              style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }}
            >
              {texto}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmReminderBlock.test.tsx`
Expected: PASS, com os 6 testes novos.

- [ ] **Step 5: O lugar do bloco no `frontend/src/components/CrmScheduleSummary.tsx` (do PR 2)**

Trocar:

```tsx
import { useId } from 'react';
```

por:

```tsx
import { useId, type ReactNode } from 'react';
```

No `interface CrmScheduleSummaryProps`, logo depois de `  onCancel: () => void;`, acrescentar:

```tsx
  /** O bloco do lembrete (PR 3), entre os passos respondidos e a Anotação. */
  reminder?: ReactNode;
```

Na assinatura de `CrmScheduleSummary`, trocar:

```tsx
  onConfirm,
  onCancel,
}: CrmScheduleSummaryProps) {
```

por:

```tsx
  onConfirm,
  onCancel,
  reminder,
}: CrmScheduleSummaryProps) {
```

E trocar:

```tsx
      {/* O bloco do lembrete (PR 3) entra aqui, entre os passos e a Anotação. */}
```

por:

```tsx
      {reminder}
```

- [ ] **Step 6: O estado, a prévia e o corpo no `frontend/src/components/CrmScheduleWizard.tsx` (do PR 2)**

Logo depois de `import { CrmScheduleSummary } from './CrmScheduleSummary';`, acrescentar:

```tsx
import { CrmReminderBlock } from './CrmReminderBlock';
import {
  fetchReminderPreview,
  INITIAL_REMINDER_CHOICE,
  reminderPreviewBody,
  reminderRequest,
  type ReminderChoice,
} from '../lib/crmReminder';
```

Trocar:

```tsx
import type { CrmScheduleOptions, CrmScheduleResult } from '../types/crm';
```

por:

```tsx
import type { CrmReminderPreview, CrmScheduleOptions, CrmScheduleResult } from '../types/crm';
```

Logo depois de `  const [semResposta, setSemResposta] = useState(false);`, acrescentar:

```tsx
  // O lembrete (PR 3) mora aqui, como a anotação: voltar a um passo para trocar
  // a escolha não apaga a chave nem o texto mudado à mão.
  const [lembrete, setLembrete] = useState<ReminderChoice>(INITIAL_REMINDER_CHOICE);
  const [previa, setPrevia] = useState<CrmReminderPreview | null>(null);
```

Logo depois do `useEffect` que chama `carregarOpcoes(false)` (termina em `  }, []);`), acrescentar:

```tsx

  // Prévia do lembrete: pedida ao backend quando o resumo aparece e a cada
  // troca de escolha. A resposta de uma escolha velha não vale.
  const corpoDaPrevia =
    options && values && options.targets.length > 0 && openStep(values, options, editing) === null
      ? reminderPreviewBody(values, options)
      : null;
  const chaveDaPrevia = corpoDaPrevia ? JSON.stringify(corpoDaPrevia) : '';
  useEffect(() => {
    if (!chaveDaPrevia) return;
    let valendo = true;
    void fetchReminderPreview(conversationId, JSON.parse(chaveDaPrevia)).then((r) => {
      if (valendo) setPrevia(r.kind === 'ok' ? r.preview : null);
    });
    return () => {
      valendo = false;
    };
  }, [conversationId, chaveDaPrevia]);
```

Em `enviar()`, trocar:

```tsx
    const r = await scheduleAppointment(conversationId, { schedule: buildScheduleInput(values) });
```

por:

```tsx
    // O lembrete vai ao lado do `schedule`, e só quando o bloco apareceu.
    const reminder = reminderRequest(lembrete, previa);
    const r = await scheduleAppointment(conversationId, {
      schedule: buildScheduleInput(values),
      ...(reminder ? { reminder } : {}),
    });
```

E trocar:

```tsx
          <CrmScheduleSummary
            note={values.note}
```

por:

```tsx
          <CrmScheduleSummary
            reminder={<CrmReminderBlock preview={previa} choice={lembrete} onChange={setLembrete} />}
            note={values.note}
```

- [ ] **Step 7: A prévia inerte nos testes do assistente do PR 2**

Em `frontend/src/components/CrmScheduleWizard.test.tsx`, logo antes de `import { CrmScheduleWizard } from './CrmScheduleWizard';`, acrescentar:

```tsx
// O lembrete (PR 3) tem os próprios testes: aqui a prévia responde "desligado",
// o bloco não aparece e o corpo do agendamento segue sem `reminder`, como os
// testes deste arquivo esperam.
vi.mock('../lib/crmReminder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/crmReminder')>()),
  fetchReminderPreview: async () => ({ kind: 'ok', preview: { enabled: false } }),
}));
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmReminderBlock.test.tsx src/components/CrmScheduleWizard.test.tsx && npm run typecheck`
Expected: PASS, com os 6 testes do bloco e os testes do assistente do PR 2 intocados, e typecheck limpo.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/CrmReminderBlock.tsx frontend/src/components/CrmReminderBlock.test.tsx frontend/src/components/CrmScheduleSummary.tsx frontend/src/components/CrmScheduleWizard.tsx frontend/src/components/CrmScheduleWizard.test.tsx
git commit -m "feat: bloco do lembrete no resumo do balão do agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: O aviso "Agendado. O lembrete não foi criado." e o lembrete no balão de ponta a ponta

**Files:**
- Modify: `frontend/src/components/CrmScheduleBalloon.tsx` (do PR 2: imports e `concluir()`)
- Test: `frontend/src/components/CrmScheduleBalloon.test.tsx` (do PR 2: a prévia controlada, o `beforeEach` e dois testes novos)

O aviso da spec aparece quando o backend responde `reminderFailed: true` (nota 22). Ele já diz que o agendamento valeu, então toma o lugar do "Visita agendada no Stronilead." quando a confirmação não entrou na caixa. O teste de ponta a ponta passa pelo balão inteiro: o bloco aparece no resumo com o texto da prévia, "Editar texto" muda o texto, e o agendamento leva o `reminder` ao lado do `schedule`.

- [ ] **Step 1: Escrever os testes que falham**

Em `frontend/src/components/CrmScheduleBalloon.test.tsx` (do PR 2), logo depois de `vi.mock('react-hot-toast', () => ({ default: toastFn }));`, acrescentar:

```tsx

// O lembrete (PR 3): a prévia responde "desligado" nos testes do agendamento,
// e os testes do lembrete trocam a resposta.
const previaDoLembrete = vi.hoisted(() => ({
  resposta: { kind: 'ok', preview: { enabled: false } } as unknown,
  pedidos: [] as unknown[],
}));
vi.mock('../lib/crmReminder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/crmReminder')>()),
  fetchReminderPreview: async (_conversationId: string, body: unknown) => {
    previaDoLembrete.pedidos.push(body);
    return previaDoLembrete.resposta;
  },
}));
```

No `beforeEach`, logo depois de `  toastFn.success.mockReset();`, acrescentar:

```tsx
  toastFn.error.mockReset();
  previaDoLembrete.resposta = { kind: 'ok', preview: { enabled: false } };
  previaDoLembrete.pedidos.length = 0;
```

E, no fim do `describe('CrmScheduleBalloon', ...)`, logo antes do `});` que o fecha, acrescentar:

```tsx

  test('lembrete: o bloco aparece no resumo, o texto muda só aqui, e o reminder vai ao lado do schedule', async () => {
    previaDoLembrete.resposta = {
      kind: 'ok',
      preview: {
        enabled: true,
        recipientFirstName: 'Mariana',
        sendAt: '2026-09-30T21:00:00.000Z',
        whenText: 'Sai sozinho na véspera, quarta, 30/09, às 18:00.',
        text: 'Oi, Mariana! Passando para lembrar da visita amanhã, quinta-feira (01/10), às 18h, na unidade Centro. Até lá!',
      },
    };
    get.mockResolvedValue({ data: OPCOES });
    post.mockResolvedValueOnce({ data: RESULTADO });
    act(() => root.render(<Harness />));

    await abrir();
    await clicarNoBalao('Visita');
    await clicarNoBalao('Centro');
    await clicarNoBalao('Quinta01/10');
    const horario = balao()!.querySelector<HTMLInputElement>('input[aria-label="Horário"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(horario, '18:00');
      horario.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicarNoBalao('Continuar');

    expect(balao()?.textContent).toContain('Lembrete para Mariana');
    expect(balao()?.textContent).toContain('Sai sozinho na véspera, quarta, 30/09, às 18:00.');
    expect(previaDoLembrete.pedidos.at(-1)).toEqual({
      leadId: 'L1',
      type: 'visita',
      date: '2026-10-01',
      time: '18:00',
      unit: 'Centro',
      unitAddress: 'Rua Garibaldi, 1200',
      modality: null,
      professorName: null,
      soloTraining: false,
      attendeeName: 'Mariana Lima',
    });

    await clicarNoBalao('Editar texto');
    const caixa = balao()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Texto do lembrete"]')!;
    const setterDaCaixa = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    act(() => {
      setterDaCaixa.call(caixa, 'Te espero amanhã, Mariana!');
      caixa.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicarNoBalao('Confirmar agendamento');

    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-schedule', {
      schedule: expect.objectContaining({ leadId: 'L1', type: 'visita', date: '2026-10-01', time: '18:00' }),
      reminder: { enabled: true, text: 'Te espero amanhã, Mariana!' },
    });
  });

  test('lembrete: agendou e o lembrete não nasceu, o aviso da spec', async () => {
    get.mockResolvedValue({ data: OPCOES });
    post.mockResolvedValueOnce({ data: { ...RESULTADO, reminderFailed: true } });
    act(() => root.render(<Harness />));

    await abrir();
    await agendarVisita();

    expect(toastFn.error).toHaveBeenCalledWith('Agendado. O lembrete não foi criado.');
    expect(toastFn.success).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmScheduleBalloon.test.tsx`
Expected: FAIL no teste do aviso, porque o `concluir()` ainda não lê o `reminderFailed`. O teste de ponta a ponta já passa com a Task 20.

- [ ] **Step 3: Implementar em `frontend/src/components/CrmScheduleBalloon.tsx`**

Logo depois de `import { scheduledNotice } from '../lib/crmSchedule';`, acrescentar:

```tsx
import { REMINDER_NOT_CREATED } from '../lib/crmReminder';
```

E, em `concluir()`, trocar:

```tsx
    if (!escrita) toast.success(scheduledNotice(result.appointment.type));
```

por:

```tsx
    // O lembrete não nasceu (PR 3): o aviso já diz que o agendamento valeu,
    // então toma o lugar do "agendada no Stronilead" quando a confirmação não
    // entrou na caixa.
    if (result.reminderFailed) toast.error(REMINDER_NOT_CREATED);
    else if (!escrita) toast.success(scheduledNotice(result.appointment.type));
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmScheduleBalloon.test.tsx && npm test && npm run typecheck`
Expected: PASS, com os 2 testes novos e os do balão do PR 2 intocados, a suíte inteira verde e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CrmScheduleBalloon.tsx frontend/src/components/CrmScheduleBalloon.test.tsx
git commit -m "feat: aviso quando o agendamento vale e o lembrete não foi criado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: O smoke confere o `appointment-status` e nunca mexe em lembrete

**Files:**
- Modify: `backend/src/scripts/smoke-crm-card.ts` (do PR 2: o comentário do topo, o import de `../services/crm.service`, uma função nova e `main`)
- Modify: `backend/src/scripts/smoke-crm-card.guard.test.ts` (do PR 2)

A ação `appointment-status` é do contrato da ponte e só lê, então entra no smoke como o bloco `[6]`, no molde do `[5]` do PR 2. A leitura do `crm.service.ts` (Task 6) já recusa lead que falta na resposta, data que não dá para ler e detalhe de outro lead, e os testes dela usam fetch simulado. O smoke confere o que só o Stronilead de verdade mostra: que a ação existe e responde no formato que a leitura aceita, e que o agendamento de cada cadastro é o mesmo do cartão, porque o lembrete segue esse agendamento. O smoke nunca cria nem troca lembrete, e a trava do `npm test` passa a barrar isso também.

- [ ] **Step 1: Escrever a trava, que já nasce verde**

No fim de `backend/src/scripts/smoke-crm-card.guard.test.ts`, acrescentar:

```ts

test('smoke do cartão nunca cria nem troca lembrete de agendamento', () => {
  assert.equal(fonte.includes('replaceCrmReminder'), false);
  assert.equal(fonte.includes('crm-reminder.service'), false);
});
```

- [ ] **Step 2: O comentário do topo e o import**

Em `backend/src/scripts/smoke-crm-card.ts`, trocar as duas últimas linhas do parágrafo que o PR 2 escreveu no comentário do topo:

```ts
 * cartão (`outcome`). O cadastro e o agendamento gravam de verdade e nunca
 * rodam aqui: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
```

por:

```ts
 * cartão (`outcome`). O cadastro e o agendamento gravam de verdade e nunca
 * rodam aqui: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
 *
 * Confere também o estado dos agendamentos (a ação appointment-status, do
 * lembrete de agendamento), que só lê. O smoke nunca cria nem troca lembrete.
```

E trocar o import:

```ts
import { fetchCrmCard, fetchCrmLeadOptions, fetchCrmScheduleOptions } from '../services/crm.service';
```

por:

```ts
import {
  APPOINTMENT_STATUS_MAX,
  fetchCrmAppointmentStatus,
  fetchCrmCard,
  fetchCrmLeadOptions,
  fetchCrmScheduleOptions,
} from '../services/crm.service';
```

- [ ] **Step 3: O bloco `[6]`**

Logo depois do fim de `conferirOpcoesDoAgendamento` (do PR 2) e antes de `async function main()`, acrescentar:

```ts

/**
 * [6] Estado dos agendamentos (appointment-status), do lembrete. Só lê.
 * Pergunta pelos cadastros do cartão, o próprio e os menores. A leitura do
 * crm.service.ts já recusa lead que falta, data que não dá para ler e detalhe
 * de outro lead; aqui fica o que só o CRM de verdade mostra: o agendamento de
 * cada cadastro é o mesmo do cartão, porque o lembrete segue esse agendamento.
 */
async function conferirEstadoDosAgendamentos(org: OrgDoSmoke, card: CrmCard | null): Promise<boolean> {
  console.log('\n[6] estado dos agendamentos (appointment-status, só leitura)');

  const doCartao = new Map<string, { type: string; at: string } | null>();
  if (card?.found && card.kind !== 'responsavel' && typeof card.leadId === 'string') {
    doCartao.set(card.leadId, card.appointment ?? null);
  }
  for (const w of Array.isArray(card?.wards) ? card.wards : []) {
    if (w && typeof w === 'object' && typeof w.leadId === 'string') doCartao.set(w.leadId, w.appointment ?? null);
  }
  if (doCartao.size === 0) {
    nota('o cartão não trouxe cadastro nenhum para perguntar.');
    return false;
  }

  const leadIds = [...doCartao.keys()].slice(0, APPOINTMENT_STATUS_MAX);
  const r = await fetchCrmAppointmentStatus(org.id, leadIds);
  if (!r.ok) {
    check(`estado dos agendamentos respondeu (veio ${r.kind})`, false);
    if (r.kind === 'chave_invalida') nota('o Stronilead recusou a ação: confira se o PR 1 está publicado na Vercel.');
    return false;
  }

  for (const leadId of leadIds) {
    const noCartao = doCartao.get(leadId) ?? null;
    const noEstado = r.value[leadId] ?? null;
    check(
      `agendamento de ${leadId} é o mesmo no cartão e no estado`,
      noCartao === null
        ? noEstado === null
        : noEstado !== null && noCartao.type === noEstado.type && Date.parse(noCartao.at) === Date.parse(noEstado.at),
      { cartao: noCartao, estado: noEstado },
    );
  }

  const comAgendamento = leadIds.filter((id) => r.value[id]).length;
  console.log(`  cadastros:  ${leadIds.length} perguntados · ${comAgendamento} com agendamento`);
  return true;
}
```

- [ ] **Step 4: `main` chama o bloco novo e cobra o resultado**

Em `main`, trocar as linhas que o PR 2 deixou:

```ts
  const conferiuAgendamento = res.card?.found
    ? await conferirOpcoesDoAgendamento(org, telefone, res.card, process.argv[4])
    : false;
```

por:

```ts
  const conferiuAgendamento = res.card?.found
    ? await conferirOpcoesDoAgendamento(org, telefone, res.card, process.argv[4])
    : false;
  // Estado dos agendamentos, do lembrete: também só leitura.
  const conferiuEstado = res.card?.found ? await conferirEstadoDosAgendamentos(org, res.card) : false;
```

E trocar o sucesso do fim de `main`:

```ts
  console.log('\n✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão, opções do cadastro e do agendamento)');
```

por:

```ts
  if (!conferiuEstado) {
    console.error('\n❌ SMOKE INCOMPLETO: o estado dos agendamentos (appointment-status) não foi conferido.');
    console.error('   Rode com um telefone que exista no Stronilead, com o CRM no ar.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    '\n✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão, opções do cadastro e do agendamento, e estado dos agendamentos)',
  );
```

- [ ] **Step 5: Conferir tipos e a trava**

Run: `cd backend && npm run typecheck && npx tsc -p tsconfig.test.json --noEmit && npm test`
Expected: os dois typechecks limpos e a suíte verde, com a trava nova. O smoke de verdade roda no servidor logo depois do deploy (Task 24, Step 4).

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/smoke-crm-card.ts backend/src/scripts/smoke-crm-card.guard.test.ts
git commit -m "chore: smoke confere o estado dos agendamentos e nunca mexe em lembrete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 23: `CLAUDE.md` do Stronizap

**Files:**
- Modify: `CLAUDE.md` (seções 4, 7, 8, 10 e 14)

O lembrete entra nos mesmos lugares em que o PR 2 documentou o agendamento, no mesmo tom. Os trechos citados existem em `78f36d3` ou são os que o PR 2 escreveu (Task 16 do plano dele); se a linha andou, guie-se pelo texto citado. Texto de documento passa pelo humanizer da casa: linguagem direta, sem travessão no meio da frase, sem frase de efeito.

- [ ] **Step 1: Seção 4, a contagem de serviços**

O PR 2 deixou 45 arquivos em `backend/src/services/` fora os testes. Com os três novos deste PR (`crm-reminder-time.ts`, `crm-reminder-text.ts` e `crm-reminder.service.ts`), são 48. Trocar:

````text
│   │   ├── services/              45 arquivos (regra de negócio vive aqui)
````

por:

````text
│   │   ├── services/              48 arquivos (regra de negócio vive aqui)
````

- [ ] **Step 2: Seção 7, o modelo de dados**

Trocar:

````markdown
O `schema.prisma` tem **27 modelos e 14 enums** e é a fonte da verdade.
````

por:

````markdown
O `schema.prisma` tem **27 modelos e 15 enums** e é a fonte da verdade.
````

E, logo depois da linha "- `Message.scheduledFor` com status `SCHEDULED` é agendamento. Só texto por enquanto.", acrescentar:

````markdown
- `Message.crmReminder` preenchido é o lembrete de agendamento (seção 10): uma mensagem agendada comum, com o JSON que a liga ao agendamento do Stronilead. A configuração mora nos campos `crmReminder*` da `Organization`, e o lembrete nasce desligado.
````

- [ ] **Step 3: Seção 8, o agendador**

Trocar:

````markdown
**Agendamento.** `scheduler.service.ts` roda a cada minuto, pega `SCHEDULED` vencido, trava com `updateMany` atômico pra não enviar duas vezes e marca `FAILED` em qualquer erro.
````

por:

````markdown
**Agendamento.** `scheduler.service.ts` roda a cada minuto, pega `SCHEDULED` vencido, trava com `updateMany` atômico pra não enviar duas vezes e marca `FAILED` em qualquer erro. O lembrete de agendamento é a exceção em dois pontos: antes de enviar ele é conferido no Stronilead (`prepareCrmReminderDispatch`), e ele sai mesmo com a conversa encerrada (`scheduledSendBlock`, em `lib/scheduledDispatch.ts`). A varredura dos lembretes roda a cada 15 minutos, no mesmo serviço.
````

- [ ] **Step 4: Seção 10, o parágrafo do lembrete**

Logo depois do parágrafo "**Agendamento pelo Stronizap.**" que o PR 2 escreveu, antes de "**Onde o desenvolvimento está.**", acrescentar:

````markdown
**Lembrete de agendamento.** Depois de agendar pelo balão, o Stronizap cria sozinho um lembrete para o lead, com o texto que a academia configurou em Configurações → Stronilead (só o admin mexe, e nasce desligado). É uma mensagem agendada da conversa, com o campo `crmReminder` (`CrmReminderData`, em `services/crm-reminder.service.ts`), e o autor é quem agendou, com o "Mostrar meu nome" dele. Quando sai e o que diz são contas puras, no horário de Brasília: `crm-reminder-time.ts` (na véspera a uma hora fixa ou N horas antes, só das 8h às 21h, e fora dessa faixa às 20h do dia anterior ao agendamento; sem lembrete quando a hora já passou ou falta menos de 30 minutos) e `crm-reminder-text.ts` (as variáveis; `[unidade]` vazio leva junto o "na unidade"). O bloco do resumo do balão pede a prévia em `POST /api/conversations/:id/crm-reminder-preview`, no serviço do agendamento, e a prévia e a criação usam as mesmas funções. O corpo do agendamento leva o `reminder` ao lado do `schedule`, e falha do lembrete não desfaz o agendamento: a resposta sai com `reminderFailed`, e o balão avisa "Agendado. O lembrete não foi criado.". Remarcar pelo Stronizap troca o lembrete, e o `ja_agendado` também: o anterior do mesmo lead e do mesmo tipo é apagado em toda a organização, numa transação que trava a organização. O lembrete segue o agendamento que o Stronilead mostra, pela ação `appointment-status` (`fetchCrmAppointmentStatus`), de 15 em 15 minutos em lotes de 30 e de novo na hora de enviar. Mesmo tipo e horário, fica, e o texto padrão é remontado com os dados de agora. Horário novo com o texto padrão, é refeito. Horário novo com texto mudado à mão, sem agendamento, outro tipo, desfecho registrado ou lembrete desligado na academia, é cancelado. Com o Stronilead sem responder, o agendador tenta de minuto em minuto, por até 30 minutos e nunca depois das 21h (`reminderSendable`), e depois disso o lembrete não sai. Cada mudança deixa uma nota na conversa: uma mensagem interna com o payload `crm_reminder_note`, que a conversa desenha como a pílula do mockup (`lib/reminderNote.ts` e `ReminderNotePill`, no molde do cartão de transferência). Spec em `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`, seção "O lembrete (PR 3)".
````

- [ ] **Step 5: Seção 10, o smoke**

No parágrafo que começa com "Ele fala com o CRM de verdade", trocar o trecho que o PR 2 escreveu:

````markdown
e as opções do agendamento (`schedule-options`, que também só lê e confere que os cadastros oferecidos são os mesmos do cartão). Sem o e-mail, as opções são pedidas como o admin mais antigo da organização, que precisa estar na equipe do Stronilead com o mesmo e-mail. O cadastro (`create-lead`) e o agendamento (`schedule`) gravam de verdade e nunca rodam no smoke: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
````

por:

````markdown
as opções do agendamento (`schedule-options`, que também só lê e confere que os cadastros oferecidos são os mesmos do cartão) e o estado dos agendamentos (`appointment-status`, do lembrete, que só lê e confere que o agendamento de cada cadastro é o mesmo do cartão). Sem o e-mail, as opções são pedidas como o admin mais antigo da organização, que precisa estar na equipe do Stronilead com o mesmo e-mail. O cadastro (`create-lead`) e o agendamento (`schedule`) gravam de verdade e nunca rodam no smoke, e o smoke nunca cria nem troca lembrete: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
````

- [ ] **Step 6: Seção 14, as regras do lembrete**

Logo antes da linha `**Testes**`, acrescentar:

````markdown
**Lembrete de agendamento**
- Dia e hora do lembrete saem de `crm-reminder-time.ts`, sempre em `America/Sao_Paulo`, e os testes rodam com o processo em UTC. Nada de `getHours()` nem `getDate()` ali.
- A faixa das 8h às 21h não se fura: nem a criação, nem as tentativas com o Stronilead fora do ar, nem o agendador que volta de uma parada envia fora dela (`reminderSendable`, contada em minutos). Sem a confirmação do Stronilead, o lembrete não sai: um lembrete com a data errada é pior que nenhum.
- A nota do lembrete é `INTERNAL`, com o payload `{ kind: 'crm_reminder_note', event, text }` (`reminderNoteContent` no backend, `parseReminderNote` no front). Mexeu num lado, mexa no outro. Nota nova do lembrete passa pelo mesmo caminho, nunca como texto solto.
- O teto dos textos do lembrete (1.000 caracteres) existe dos dois lados de propósito: `REMINDER_TEXT_MAX` em `backend/src/services/crm-reminder-text.ts` e em `frontend/src/lib/crmReminderSettings.ts`. Mexeu num, mexa no outro.
- Os textos padrão moram no `schema.prisma` (os padrões da migration) e em `DEFAULT_REMINDER_TEXTS`, e o teste do texto confere que os dois são iguais.

````

- [ ] **Step 7: Conferir**

Run: `grep -n "48 arquivos\|15 enums\|Message.crmReminder\|prepareCrmReminderDispatch\|Lembrete de agendamento\|appointment-status\|crm_reminder_note\|REMINDER_TEXT_MAX" CLAUDE.md`
Expected: as linhas novas das cinco seções. Ler o texto novo inteiro uma vez: sem travessão no meio da frase, sem frase de efeito, e todo nome citado existe no código deste PR.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: lembrete de agendamento no CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 24: Conferência final, PR e publicação

**Files:** nenhum no repositório. O Step 6, depois do deploy, mexe em dois `CLAUDE.md` que ficam fora dos repositórios (não são git).

- [ ] **Step 1: Suítes, typechecks e build**

Com o banco de isolamento descartável deste PR, como na Task 14:

```bash
npm run typecheck --workspaces
cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test
createdb stronizap_isolation_lembrete
DATABASE_URL="postgresql://$USER@localhost:5432/stronizap_isolation_lembrete" npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://$USER@localhost:5432/stronizap_isolation_lembrete" npm run test:isolation
dropdb stronizap_isolation_lembrete
cd ../frontend && npm test && npm run build && cd ..
```

Expected: os typechecks limpos; o backend com 120 testes a mais que o número anotado na Task 0 e o frontend com 41 a mais (a soma dos testes novos de cada task); a suíte de isolamento verde, com os 10 testes do lembrete; o build termina com `✓ built`; e o banco descartável apagado no fim. Se `createdb` disser que o banco já existe, rode `dropdb stronizap_isolation_lembrete` antes.

- [ ] **Step 2: O que os testes não pegam**

```bash
git diff --stat origin/main...HEAD -- backend/prisma
git diff origin/main...HEAD -- frontend/src | grep '^+' | grep -n "x-stronizap-key\|crmApiKey"
git diff origin/main...HEAD -- backend/src frontend/src ':!*.test.ts' ':!*.test.tsx' ':!backend/src/scripts/smoke-crm-card.ts' | grep '^+' | grep -n "getHours()\|getDate()\|console.log"
```

Expected: a primeira mostra só o `schema.prisma` e a migration `..._lembrete_de_agendamento`; a segunda e a terceira não imprimem nada (o smoke usa `console.log` de propósito e fica de fora, como os testes, que conferem que o processo está em UTC). Depois, ler o diff inteiro uma vez atrás de texto de tela que não esteja na spec, no mockup ou na lista "Textos a confirmar com o Johnny".

- [ ] **Step 3: Abrir o PR (sem merge)**

```bash
git push -u origin claude/lembrete-de-agendamento
gh pr create --base main --title "feat: lembrete de agendamento pelo Stronizap" --body "$(cat <<'CORPO'
O Stronizap passa a mandar sozinho um lembrete antes da visita ou da aula experimental agendada pela conversa, com o texto que a academia configurou. Antes de sair, o lembrete confere no Stronilead se o agendamento continua no mesmo dia e horário.

- configuração em Configurações → Stronilead, só para o admin: a chave (nasce desligada), "Na véspera, às …" ou "… horas antes do horário marcado", os textos da visita e da aula com as variáveis e a prévia
- o bloco "Lembrete para …" no resumo do balão do agendamento, com a chave, quando sai, o texto, "Editar texto" e "Voltar ao texto padrão"; sem tempo para lembrete, "Sem lembrete" com o motivo
- o lembrete é uma mensagem agendada da conversa, com o campo novo `crmReminder`; a bolha diz "lembrete da visita" e tem o cancelar de sempre
- remarcar pelo Stronizap e o `ja_agendado` trocam o lembrete; se a criação falhar, o agendamento vale e o balão avisa "Agendado. O lembrete não foi criado."
- só sai das 8h às 21h de Brasília, também nas tentativas e na volta de uma parada
- conferência com o Stronilead (`appointment-status`) de 15 em 15 minutos e na hora de enviar: o lembrete fica, é refeito ou é cancelado, com a nota em pílula na conversa, como no mockup
- o lembrete sai mesmo com a conversa encerrada, que continua encerrada até o lead responder
- desligar o lembrete na academia cancela os pendentes (a confirmar com o Johnny)
- o smoke confere o `appointment-status` e nunca mexe em lembrete
- **com migration** (campos novos na `Organization` e `crmReminder` na mensagem), que o `deploy.sh` aplica

**Só vai para produção com o PR 1 do Stronilead publicado e o PR 2 no ar.**

Para o Johnny olhar, nas notas de abertura do plano: os textos a confirmar e a decisão de cancelar os pendentes quando a academia desliga o lembrete.

Spec e plano no `crm-stronix`, em `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` e `docs/superpowers/plans/2026-09-29-agendamento-zap-pr3-lembrete.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
CORPO
)"
```

Expected: o link do PR. Não fazer merge: o merge é do Johnny.

- [ ] **Step 4: Publicação (Johnny)**

1. Conferir que o PR 1 do `crm-stronix` está publicado na Vercel (Ready) e que o PR 2 está no ar no servidor. Sem os dois, não publicar este.
2. Mesclar este PR na `main`.
3. No servidor: `sudo -u whatsapp bash /opt/whatsapp-crm/deploy/scripts/deploy.sh`. Expected: termina com "✅ Deploy concluído: <commit anterior> → <commit novo>", com o `prisma migrate deploy` aplicando `..._lembrete_de_agendamento`. O lembrete nasce desligado em toda academia, então nada muda para ninguém até um admin ligar.
4. Logo depois do deploy, antes de ligar o lembrete em qualquer academia, o smoke, com o telefone de um lead de teste da STRONIX e o e-mail de alguém da equipe do Stronilead:

```bash
cd /opt/whatsapp-crm/backend && sudo -u whatsapp npx tsx src/scripts/smoke-crm-card.ts <telefone-do-lead-de-teste> stronix-crm-app <email-da-equipe>
```

Expected: todas as conferências com ✅, inclusive as do bloco `[6] estado dos agendamentos (appointment-status, só leitura)`, e a última linha "✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão, opções do cadastro e do agendamento, e estado dos agendamentos)". Com o `[6]` vermelho, não ligue o lembrete: sem a conferência, nenhum lembrete sairia, e cada um deixaria a nota de que o Stronilead não respondeu.

O smoke roda depois do deploy, e não antes, porque o bloco `[6]` só existe no código novo, e puxar o código antes faria o `deploy.sh` sair com "Nada novo pra deployar", sem build nem migration.

Se algo der errado: desligar o lembrete em Configurações → Stronilead já para tudo. Se o Johnny pedir a volta do código, é o revert do merge na `main` e o `deploy.sh` de novo; a migration só acrescenta colunas com padrão e pode ficar.

- [ ] **Step 5: Conferência em produção, na STRONIX (Johnny)**

Com um contato de teste que já é lead no Stronilead (o próprio número do Johnny serve). Os agendamentos e os lembretes são de verdade: o lembrete sai para esse número.

1. Em Configurações → Stronilead, como admin, o cartão "Lembrete de agendamento" aparece embaixo dos dados da conexão, desligado. Ligar, escolher "1 hora antes do horário marcado", conferir a prévia dos dois textos e salvar. Como gestor, o cartão não aparece.
2. Na conversa do lead de teste, agendar uma visita para daqui a umas 2 horas, dentro das 8h às 21h. O resumo mostra o bloco "Lembrete para <primeiro nome>", com a chave ligada, "Sai sozinho 1 hora antes, …" e o texto. "Editar texto" abre o texto e "Voltar ao texto padrão" desfaz. Confirmar: a conversa mostra a bolha "Agendada para … · lembrete da visita", com o cancelar.
3. Agendar de novo pelo Stronizap ("Remarcar visita") para outro horário: a bolha anterior some e aparece a nova.
4. Remarcar a visita na ficha do Stronilead: em até 15 minutos, a bolha passa para o horário novo e a pílula "Lembrete da visita remarcado para …, junto com o agendamento." aparece na conversa.
5. Registrar o desfecho ou cancelar a visita no Stronilead: em até 15 minutos, a bolha some e aparece a pílula "Lembrete da visita cancelado: o agendamento mudou no Stronilead.".
6. Agendar mais uma vez, encerrar a conversa e esperar a hora: o lembrete sai, com o nome de quem agendou no começo quando o "Mostrar meu nome" está ligado, e a conversa continua encerrada.
7. No tema escuro, o cartão da configuração, o bloco, a bolha e a pílula continuam legíveis.
8. Com um lembrete pendente, desligar o lembrete na academia: em até 15 minutos, a bolha some e aparece a pílula "Lembrete da visita cancelado: o lembrete de agendamento foi desligado nas configurações." (só se o Johnny confirmou essa decisão, nota 10).

- [ ] **Step 6: Documentação fora dos repositórios (depois do deploy e da conferência)**

Os dois arquivos não são git: edite direto, sem commit. Se algum trecho citado mudou até lá, guie-se pelo sentido.

1. `~/STRONIX-FIRMA/06-sistemas/CLAUDE.md`
   - Tabela "Sistemas Cadastrados", linha do Stronizap: trocar "cadastra no CRM quem ainda não está lá e agenda visita e aula experimental no CRM de dentro da conversa." (texto do PR 2) por "cadastra no CRM quem ainda não está lá, agenda visita e aula experimental no CRM de dentro da conversa e manda sozinho o lembrete do agendamento, conferido no CRM antes de sair.", e acrescentar " · lembrete de agendamento desde <data do deploy>" no fim do status.
   - Seção "Ponte Stronilead ↔ Stronizap": depois do parágrafo **Agendamento pelo Stronizap.**, o parágrafo abaixo, com a data e o número do PR:

     > **Lembrete de agendamento.** Depois de agendar pelo Stronizap, o lead recebe sozinho um lembrete antes da visita ou da aula experimental, com o texto que a academia escreveu em Configurações → Stronilead do Stronizap. Só o admin configura, e o lembrete nasce desligado. Ele sai na véspera a uma hora fixa ou algumas horas antes, sempre das 8h às 21h de Brasília. O lembrete segue o agendamento do Stronilead: pela ação `appointment-status` do `POST /api/zap`, que só lê, o Stronizap confere de 15 em 15 minutos e de novo na hora de enviar. Quando o agendamento muda de horário, o lembrete é refeito. Quando ele é cancelado, ganha desfecho ou muda de horário depois de o texto do lembrete ter sido mudado à mão, o lembrete é cancelado. Cada mudança deixa uma nota na conversa. Sem resposta do Stronilead, o lembrete não sai: um lembrete com a data antiga é pior que nenhum. Em produção desde <data do deploy> (PR #<número> do `whatsapp-stronix`). Spec em `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`.

   - Parágrafo do smoke: trocar "confere o cartão, as opções do cadastro e as do agendamento. Ele nunca cadastra nem agenda, porque o `create-lead` e o `schedule` gravam de verdade." (texto do PR 2) por "confere o cartão, as opções do cadastro e as do agendamento, e o estado dos agendamentos. Ele nunca cadastra, nem agenda, nem cria lembrete, porque o `create-lead` e o `schedule` gravam de verdade e o lembrete sai para o lead.".
   - A tabela "Os arquivos que formam o contrato" não muda.
2. `~/STRONIX-FIRMA/CLAUDE.md`, tabela "Últimas Atualizações": uma linha no fim, no molde da linha do agendamento pelo Stronizap:

   > | <data do deploy> | Lembrete de agendamento do Stronizap em produção, testado pelo Johnny na STRONIX (PR #<número> do `whatsapp-stronix`): depois de agendar pelo Stronizap, o lead recebe sozinho um lembrete antes da visita ou da aula experimental, com o texto que a academia escreveu. O admin liga em Configurações → Stronilead e escolhe se sai na véspera a uma hora fixa ou algumas horas antes, sempre das 8h às 21h de Brasília. No balão do agendamento, o bloco "Lembrete para …" mostra quando o lembrete sai e o texto, que dá para mudar só naquele agendamento. O Stronizap confere no Stronilead de 15 em 15 minutos e na hora de enviar: o lembrete é refeito quando o agendamento muda de horário e cancelado quando ele é cancelado ou ganha desfecho, e cada mudança deixa uma nota na conversa. Sem resposta do Stronilead, o lembrete não sai. Spec em `06-sistemas/stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` |

   Só escrever "testado pelo Johnny na STRONIX" depois do Step 5 feito.

Os dois textos passam pelo humanizer da casa: linguagem direta, sem travessão no meio da frase, sem frase de efeito.

---

## Antes do merge e do deploy

- [ ] O PR 1 do `crm-stronix` está publicado (Vercel em Ready) e o PR 2 está no ar no servidor.
- [ ] O Johnny viu a lista "Textos a confirmar com o Johnny" e decidiu a nota 10 (cancelar os pendentes quando a academia desliga o lembrete). Texto trocado é só texto: muda o teste que o cita, e nada mais.
- [ ] O Step 1 da Task 24 está verde no worktree.
- [ ] O smoke roda no servidor logo depois do deploy (Task 24, Step 4), antes de ligar o lembrete em qualquer academia.
