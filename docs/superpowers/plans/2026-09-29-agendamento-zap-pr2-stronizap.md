# Agendamento pelo Stronizap · PR 2 (Stronizap, agendamento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem atende no Stronizap agenda visita ou aula experimental no Stronilead de dentro da conversa, pelo "Agendar" do cabeçalho, num balão passo a passo; o cartão troca na hora, mostra o desfecho quando o Stronilead registra, e a confirmação para o lead fica escrita na caixa de mensagem, sem enviar.

**Architecture:** O navegador fala só com o backend do Stronizap, por duas rotas novas sob a conversa (`GET /api/conversations/:id/crm-schedule-options` e `POST /api/conversations/:id/crm-schedule`). Um serviço novo, `crm-schedule.service.ts`, passa pelas mesmas portas do cadastro de lead (que saem de `crm-lead.service.ts` para `crm-conversation.service.ts`), chama as ações `schedule-options` e `schedule` do `POST /api/zap` do Stronilead pelo `crm.service.ts` (o único lugar que conhece a chave), aplica o cartão que volta como o cadastro aplica e monta o texto da confirmação em `crm-appointment-text.ts`, sempre no horário de Brasília. No front, o "Agendar" do `CrmHeaderMeta` abre o `CrmScheduleBalloon`, com o assistente (`CrmScheduleWizard`) e o resumo (`CrmScheduleSummary`) dentro; depois de agendar, a confirmação entra na caixa vazia pelo `crmConfirmation.store` e a faixa `CrmConfirmationBar` aparece acima dela enquanto o texto for o mesmo.

**Tech Stack:** Node 20+, TypeScript, Express 4, Zod, Socket.IO (back, testes com `node:test` e tsx); React 18, Vite, Zustand, Radix/shadcn (`Popover`, `Switch`, `Calendar` sobre react-day-picker 8 com `date-fns/locale`), Vitest com jsdom (front).

**Spec:** `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` (fonte da verdade), seções "Na tela do Stronizap", "No Stronizap: o agendamento (PR 2)", "O contrato da ponte", "Testes → Stronizap, agendamento" e o passo 2 de "Publicação". Mockups aprovados: `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-mockup.html`, seções 1, 2, 3 e 5 (o bloco do lembrete que aparece nelas é do PR 3). Levantamento: `2026-09-29-agendamento-pelo-stronizap-levantamento.md`, na mesma pasta.

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronizap` (remoto `johnnychaves/whatsapp-stronix`). Todo o trabalho acontece no worktree `~/STRONIX-FIRMA/06-sistemas/stronizap/.claude/worktrees/agendamento-pelo-zap`, no branch `claude/agendamento-pelo-zap`, criado a partir da `origin/main` em `78f36d3`. Todos os caminhos abaixo são relativos à raiz desse worktree. A cópia principal do Stronizap está atrás da `main`: nunca ler nem editar código por ela.

**Ordem de entrada:** este PR só vai para produção depois do PR 1 do Stronilead no ar (as ações `schedule-options`, `schedule` e `appointment-status` no `api/zap.js` e o `outcome` no cartão). Com o Stronilead antigo, o `POST /api/zap` com essas ações cai no caminho do login e responde 401, e este lado trata 401 como chave recusada: a seção do Stronilead sumiria do painel de quem clicasse em Agendar. Desenvolver e testar não depende do PR 1: os testes simulam o CRM. O lembrete (PR 3) vem depois deste e estende os pontos de encaixe listados em "Contrato da ponte → Pontos de encaixe do PR 3".

**Números de linha:** os que o plano cita são os do arquivo em `78f36d3`, antes de qualquer edição. Quando uma task mexe em vários pontos do mesmo arquivo, guie-se pelo trecho citado, que é único, e não pelo número, que anda depois da primeira edição.

**Plano conferido:** o código deste plano foi aplicado sobre `78f36d3` numa cópia fora do repositório, com os `node_modules` do mesmo lockfile: todo trecho "trocar isto" bateu com o arquivo, os dois typechecks passaram e as suítes ficaram verdes (números na Task 17). A suíte de isolamento rodou num PostgreSQL descartável.

---

## Notas antes de começar

O código de hoje e o contrato fixado entre os três planos decidiram alguns pontos que a spec deixou em aberto. Cada decisão abaixo é a menor solução fiel à spec.

1. **As portas saem do cadastro para um lugar só.** `crm-lead.service.ts` tem hoje as portas (superadmin, sessão emprestada, acesso à conversa, contato de WhatsApp com número), o corpo das falhas e o `aplicarCartao`. Tudo isso vai para `crm-conversation.service.ts` (Task 4), com os textos de recusa passados por parâmetro, e o cadastro continua exportando exatamente os mesmos nomes (`LEAD_FAILURE_REPLY`, `CrmLeadDeps`, `CrmLeadTarget`, `CrmLeadViewer`...). O `crm-lead.service.test.ts` não muda uma linha e continua verde: é ele a prova de que o comportamento do cadastro ficou igual.
2. **O corpo do `POST` é `{ schedule }`.** O contrato diz "o corpo do POST é o objeto `schedule` do 1.2". O plano o embrulha como o cadastro embrulha o `lead` (`crmScheduleBodySchema = z.object({ schedule })`), porque o `schedule` segue inteiro para o Stronilead e o `reminder` do PR 3 é só do Stronizap: ele entra ao lado de `schedule`, nunca dentro. O serviço recebe o corpo inteiro (`CrmScheduleBody`), então o PR 3 acrescenta o campo no schema e lê `body.reminder` sem mudar assinatura.
3. **`scheduleCrmAppointment` devolve `{ status, body }`**, como o `getCrmLeadOptions` do cadastro, porque as falhas precisam de status e corpo prontos. No sucesso, `body` é o `CrmScheduleResult` do contrato: `{ card, appointment, confirmationText, alreadyScheduled }`. Status 201 no agendamento novo e 200 no `ja_agendado`.
4. **`ja_agendado` vira sucesso na leitora.** `createCrmAppointment` reconhece o 409 `ja_agendado` antes do `interpretar` e devolve `{ ok: true, value: { card, appointment, alreadyScheduled: true } }`. O `interpretar` e o `lerRecusa` do cadastro não mudam (a recusa genérica não ganha campo novo, o que quebraria os `deepEqual` dos testes do cadastro). `ja_agendado` sem o cartão ou sem o agendamento vira `indisponivel`, e o "Tentar de novo" resolve.
5. **Códigos novos sem texto de reserva.** `lead_nao_confere`, `horario_passado` e `ja_agendado` não entram na tabela `CRM_LEAD_REFUSAL_FALLBACK`: o contrato diz que toda recusa traz o `message`, e recusa de código desconhecido sem texto já vira `indisponivel` pelo `lerRecusa`.
6. **O nome da confirmação.** Quem recebe a confirmação é o contato. O serviço usa o nome do cartão que acabou de voltar (`nomeDoCartao`, o mesmo que o `syncName` grava no `displayName`) e, sem ele, o `displayName` do contato. O agendamento é de menor quando o `leadId` dele aparece em `card.wards`; aí a frase leva o primeiro nome do menor (`appointment.leadName`).
7. **Dia e hora de Brasília também na tela.** O cartão hoje escreve a linha "Agendamento" na hora do navegador e com o código cru ("visita · 01/10 às 18:00"). O plano troca por `appointmentLine` (Task 9): "Visita · 01/10 às 18:00 · Compareceu", lida em `America/Sao_Paulo`, como a faixa do cartão que o Stronilead já manda em Brasília. Os cinco dias e o horário do balão também são de Brasília, e o instante do horário escolhido sai de `brasiliaInstant` (fuso fixo -03:00, sem horário de verão desde 2019).
8. **"Para quem?" mostra o parentesco como vem do Stronilead.** O Stronilead manda o parentesco do menor visto por quem escreve ("Filho", "Filha", "Neto", "Sobrinha"...), que ele tira do campo Sexo do menor, e `null` quando não dá para saber o gênero (plano do PR 1, nota 1). Este lado não faz conta nenhuma: mostra o valor embaixo do nome, como no mockup, sem prefixo, e nada quando vem `null`. O cadastro do próprio número aparece só com o nome.
9. **O aviso de remarcação vai sem artigo:** "Mariana já tem visita marcada para quarta, 30/09, às 18:00. Agendar de novo troca o dia e o horário." O exemplo da spec diz "A Mariana", o que adivinha o gênero; a própria spec tira o artigo do professor na confirmação pelo mesmo motivo.
10. **O aviso de remarcação só vale sem desfecho.** O contrato manda o desfecho em `targets[].appointment` (`outcome`, pela regra do cartão). O aviso no topo e os rótulos "Remarcar visita" e "Remarcar aula" só aparecem quando o agendamento do tipo escolhido está com `outcome` `null` (`isRescheduling`, Task 12). Com desfecho (compareceu ou faltou), o agendamento já aconteceu, e o balão agenda como novo, sem aviso.
11. **Rodapé do resumo.** À esquerda fica "Conta na sua Meta diária." quando o Stronilead diz que conta (`actor.countsForMeta`), e o Cancelar quando não conta, como no mockup da remarcação. Nos passos, o primeiro tem só o Cancelar, e os outros têm Voltar e o botão da direita: "Continuar" no dia e horário e "Complete os passos", apagado, nos demais, como nos mockups.
12. **"Outro dia" abre o calendário dentro do passo**, sem outro balão por cima, e ele fica aberto enquanto o dia escolhido não é um dos cinco cartões. Dia do calendário que não está entre os cinco começa às 09:00 (`OTHER_DAY_TIME`), o horário que o Stronilead dá aos dias que não são hoje. O calendário não deixa escolher dia antes de hoje em Brasília.
13. **Horário que já passou** é barrado no Continuar e de novo no Confirmar (o balão pode ficar aberto até o horário passar), com "Esse horário já passou. Escolha outro." no passo do dia. O Stronilead confere de novo e recusa com `horario_passado`.
14. **Depois de agendar sem a confirmação na caixa** (caixa ocupada ou chave desligada), o aviso é um toast: "Visita agendada no Stronilead." ou "Aula agendada no Stronilead.". A spec só dá o texto da visita com a caixa ocupada.
15. **Caixa em modo nota.** A confirmação só entra com a caixa vazia, mas o modo nota da caixa vazia não fica no rascunho, fica no `MessageInput`. Para a confirmação não sair como nota interna, o `MessageInput` sai do modo nota quando ela entra (Task 13).
16. **A faixa da confirmação nasce com o texto.** Ela não tem uma região `role="status"` sempre montada, como a da reescrita: uma segunda região antes do formulário quebraria o teste "com a IA desligada no servidor, a região de aviso da faixa não existe" (`MessageInput.rewrite.test.tsx`). A faixa some durante a reescrita, que tem a faixa dela.
17. **O rodapé do cartão ganha um tipo.** `CadastroAviso` fica como está (o `CrmLeadBalloon` estreita nele), e o rodapé passa a aceitar `CrmCardNotice = CadastroAviso | { kind: 'agendado' }` (Task 10).
18. **`ja_agendado` na tela.** A tela trata igual ao agendamento novo: cartão, "Agendado agora por você" e confirmação. O `alreadyScheduled` chega ao navegador e não muda nada na tela.
19. **Smoke.** O bloco novo `[5]` pede as opções do agendamento para o telefone do smoke, que precisa ter cadastro, e confere que os cadastros oferecidos são os mesmos do cartão (o próprio e os menores). O `outcome` passa a ser conferido em todo `appointment` do cartão. O teste de guarda trava o `schedule`, o `createCrmAppointment`, o `scheduleCrmAppointment` e o `crm-schedule.service`.
20. **Teste das rotas.** O `tsx` dos testes do backend não carrega o Baileys, então nenhuma rota é importada em `node:test`. As portas são testadas no serviço com dependências injetadas, e as rotas de verdade entram na suíte de isolamento, que roda sobre o build. Os testes novos de lá começam com "agendamento no Stronilead:", porque a suíte já tem um teste de agendamento de mensagem.
21. **Tempo máximo testado com `t.mock.timers`**, como no cadastro: funciona no Node 22 e acima, que é onde os testes rápidos rodam.
22. **Sem migration.** Nada muda no `schema.prisma`. A migration do projeto é a do lembrete (PR 3).
23. **Publicação como a spec pede:** deploy manual (`deploy.sh`) e, depois, o smoke no servidor. O Johnny prefere testar direto em produção na STRONIX e pedir a volta se der errado, então o roteiro de conferência da Task 17 é em produção, sem ambiente de teste na máquina.

### Textos de tela que não estão na spec nem no mockup (a confirmar com o Johnny)

| Onde | Texto |
|---|---|
| Recusa do superadmin (backend, 403) | "O superadmin não agenda no Stronilead." |
| Recusa da sessão emprestada (backend, 403) | "Entrando como admin pelo painel do superadmin não dá para agendar no Stronilead." |
| Contato sem número (backend, 422) | "O agendamento pelo Stronizap vale só para contato de WhatsApp com número." |
| Horário que já passou (passo do dia) | "Esse horário já passou. Escolha outro." (o mesmo texto do `horario_passado` no plano do PR 1) |
| Aviso da aula com a caixa ocupada, e dos dois tipos com a chave da confirmação desligada | "Aula agendada no Stronilead." (a visita usa o texto da spec, "Visita agendada no Stronilead.") |
| Remarcação de aula | "Mariana já tem aula experimental marcada para sexta, 02/10, às 19:00. Agendar de novo troca o dia e o horário." |
| Remarcação sem nome no cadastro | "Já tem visita marcada para …" |
| Confirmação de mais de uma aula de um menor | "Combinado, Mariana! As 3 aulas experimentais de Pilates de Pedro começam sexta-feira (02/10), às 19h, com Carla." |
| Confirmação de menor sem nome no cadastro | "Combinado, Mariana! A visita ficou para …" |
| Rótulo e dica do "Agendar" (leitor de tela e passar o mouse) | "Agendar no Stronilead" |
| Nome do balão do agendamento (leitor de tela) | "Agendamento no Stronilead" |

Reaproveitados, sem texto novo: as dicas dos passos, "Treina sozinho", "1 aula"/"2 aulas", "O que precisa ser tratado nesse contato?", "Complete os passos", "Confirmar agendamento" e os avisos de modalidade e de professor vêm do assistente do Stronilead (`ScheduleWizard.jsx`); "Carregando…", "Não deu para falar com o Stronilead agora." e "Tentar de novo" vêm do cadastro; "Agendando…" vem do "Agendar mensagem"; "Sem nome" e "Esse número não está na base." vêm do cartão.

### Pontos para o Johnny decidir

1. **Toast também com a chave da confirmação desligada (nota 14).** A spec não diz o que aparece nesse caso; o painel pode estar fechado, e sem aviso a pessoa não saberia que agendou.

---

## Contrato da ponte

Resumo, com as palavras deste plano, do contrato fixado entre os três planos do projeto. Quem executa este plano não precisa de outro documento.

### O que o Stronilead responde (PR 1)

As três ações moram no `POST /api/zap`, autenticadas pela chave no header `x-stronizap-key`, como o `match`, o `lead-options` e o `create-lead`. O `tenant` vai no corpo, como nas outras.

**`schedule-options`** (só lê). Pedido: `{ action: 'schedule-options', tenant, phone, actor: { email } }`. Resposta 200:

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

- `actor`: a pessoa da equipe achada pelo e-mail. `role` é `gestor` ou `consultor`. `countsForMeta` diz se agendar hoje conta na Meta Diária dela (consultor em dia de meta).
- `targets`: primeiro o cadastro do próprio número, quando existe; depois cada menor de quem o número é responsável, a mesma seleção do `wards` do cartão. `relationship` é `null` no cadastro do próprio número e, no menor, o parentesco dele visto por quem escreve ("Filho", "Filha"...), que o Stronilead calcula pelo campo Sexo do menor; vem `null` também quando não dá para saber o gênero. `appointment` é o agendamento de agora, `{ type, at, outcome }` (`type` como o lead guarda, `at` em ISO e `outcome` `attended`, `no_show` ou `null`, pela regra do cartão), ou `null`, também quando o agendamento foi cancelado. Número sem cadastro devolve `targets: []`.
- `units` (nome e endereço, que vem `null` quando vazio), `modalities` (id e nome) e `professors` (só os ativos, com os ids das modalidades que dão), na ordem da academia. `trialClassOptions` são as quantidades de aula da academia, `[1, 2, 3]` quando ela não configurou.
- `days`: os cinco dias sugeridos, no horário de Brasília e só nos dias da meta; começam hoje antes das 18h e amanhã depois. `label` é "Hoje", "Amanhã" ou o dia da semana curto ("Quinta"). `defaultTime` é 18:00 para hoje e 09:00 para os outros.
- Recusas: `dados_invalidos` (400), `academia_bloqueada` (403) e `fora_da_equipe` (403).

**`schedule`** (grava). Pedido:

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

- `type` é `visita` ou `aula_experimental`. Na visita, `unit` é o NOME da unidade (ou `null` na academia sem unidade), e os campos da aula vão `null`/`false`. Na aula, `modality` é o NOME da modalidade, exatamente um entre `professorId` e `soloTraining: true`, e `quantity` está em `trialClassOptions`; `unit` vai `null`.
- `date` em AAAA-MM-DD e `time` em HH:MM, no horário de Brasília, e o instante precisa estar no futuro. `note` até 1.000 caracteres, ou `null`.
- Resposta 201: `{ card, appointment }`, com o cartão do número já atualizado e o `AppointmentDetail` abaixo.
- Recusas (todas com `error`, o `message` pronto para a tela e, às vezes, `field`, que usa os nomes do pedido: `phone`, `actor`, `channelName`, `schedule`, `leadId`, `type`, `unit`, `modality`, `professorId`, `quantity`, `date`, `time`, `note`):

| Código | Status | Quando |
|---|---|---|
| `dados_invalidos` | 400 | Pedido malformado, com `field` |
| `academia_bloqueada` | 403 | Academia suspensa, em teste vencido ou com mensalidade atrasada |
| `fora_da_equipe` | 403 | O e-mail não está na equipe do Stronilead |
| `lead_nao_confere` | 422 | O lead não é do número nem menor de quem ele é responsável |
| `catalogo_mudou` | 422 | Unidade, modalidade, professor ou quantidade que não existe mais, com `field` |
| `horario_passado` | 422 | Dia e hora que já passaram |
| `ja_agendado` | 409 | O pedido é idêntico ao agendamento que o lead já tem (mesmo tipo, horário e escolhas de unidade, modalidade, professor e quantidade; uma anotação escrita e diferente grava, e pedido sem anotação nunca conta como mudança); vem com `card` e `appointment` |
| `limite` | 429 | Mais de 60 agendamentos na última hora na academia |

O que mudou no PR 1 durante a execução e vale para este lado: a regra do `ja_agendado` acima (antes, remarcar no mesmo horário trocando só a unidade respondia `ja_agendado` sem gravar); e, no `schedule-options` e no cartão devolvido pelo `schedule`, a falha do Stronilead ao buscar os menores do número responde 5xx, em vez de devolver a lista sem eles. Para este lado as duas coisas não pedem código novo: o 5xx já vira "Não deu para falar com o Stronilead agora." com o "Tentar de novo", e o "Tentar de novo" do `schedule` cai no `ja_agendado` com o cartão inteiro, que a tela trata como sucesso.

**`AppointmentDetail`** (resposta do `schedule`, do `ja_agendado` e, no PR 3, do `appointment-status`):

```json
{
  "leadId": "L1", "leadName": "Mariana Lima", "type": "visita", "at": "2026-10-01T21:00:00.000Z",
  "unit": "Centro", "unitAddress": "Rua Garibaldi, 1200", "modality": null, "professorName": null,
  "soloTraining": false, "quantity": null, "outcome": null
}
```

`unitAddress` é o endereço da unidade na lista de agora (`null` quando ela sumiu ou não tem endereço). `outcome` é `attended`, `no_show` ou `null`: remarcado vira `null`, e cancelado some com o agendamento inteiro.

**O cartão.** O `appointment` do cartão (`GET /api/zap`), no de lead, no de cliente e no de cada menor, passa a ser `{ type, at, outcome }`, com `outcome` pela mesma regra. Agendamento cancelado não aparece.

**`appointment-status`** é do lembrete (PR 3) e este plano não o usa.

### Pontos de encaixe do PR 3

Estes nomes são fixos entre os planos. Este PR cria exatamente assim, e o PR 3 conta com eles.

| O que | Onde | Nome |
|---|---|---|
| Tipos (back e front) | `backend/src/services/crm.service.ts` e `frontend/src/types/crm.ts` | `CrmAppointmentDetail` (com `type: 'visita' \| 'aula_experimental'`, `at: string`, `outcome: 'attended' \| 'no_show' \| null`), `CrmScheduleOptions`, e o agendamento do cartão com `outcome` (`CrmCardAppointment`) |
| Leitoras da ponte | `backend/src/services/crm.service.ts` | `fetchCrmScheduleOptions` (4 s) e `createCrmAppointment` (8 s). O PR 3 acrescenta `fetchCrmAppointmentStatus` no mesmo molde, com a ação `'appointment-status'` no tipo `AcaoDaPonte` e o `lerDetalheDoAgendamento` que este PR cria |
| Texto em Brasília | `backend/src/services/crm-appointment-text.ts` | `dayPhrase(at, reference)`, `hourPhrase(at)`, `firstName(name)` e `buildConfirmationText({ contactName, appointment, isWard, now })` |
| Serviço | `backend/src/services/crm-schedule.service.ts` | `loadScheduleOptions(conversationId, viewer, deps?)` e `scheduleCrmAppointment(conversationId, viewer, body, deps?)`, que devolve `{ status, body }` com `body: CrmScheduleResult = { card, appointment, confirmationText, alreadyScheduled }` no sucesso |
| Corpo do `POST` | `crmScheduleBodySchema` e `CrmScheduleBody`, no mesmo arquivo | Hoje `{ schedule }`. O PR 3 acrescenta `reminder` opcional ao `z.object`, ao lado de `schedule`, e o serviço o lê em `body.reminder`. A rota já passa o corpo inteiro |
| Onde o lembrete é criado | dentro de `scheduleCrmAppointment` | Depois de `applyCrmCard` e de montar o `result`, no comentário "Lembrete (PR 3)" |
| Resumo do balão | `frontend/src/components/CrmScheduleSummary.tsx` | `CrmScheduleSummary`, com as props da Task 14; o PR 3 insere o bloco do lembrete no comentário "O bloco do lembrete (PR 3) entra aqui", entre os passos respondidos e a "Anotação (opcional)" |
| Pedido do front | `frontend/src/lib/crmSchedule.ts` | `scheduleAppointment(conversationId, body: CrmScheduleBody)`; o PR 3 acrescenta `reminder` ao tipo `CrmScheduleBody` de `types/crm.ts` |
| Faixa da confirmação | `frontend/src/stores/crmConfirmation.store.ts` | `useCrmConfirmationStore`, com `offer(conversationId, { text, type })`, `discard(conversationId)` e `clear()` |

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `backend/src/services/crm.service.ts` | `CrmAppointmentType`, `CrmAppointmentOutcome`, `CrmCardAppointment` (o `outcome` no cartão), `AcaoDaPonte`; tipos, leitoras e tempos do agendamento: `fetchCrmScheduleOptions`, `createCrmAppointment`, `lerOpcoesDoAgendamento`, `lerDetalheDoAgendamento`, `lerAgendado` |
| `backend/src/services/crm.service.test.ts` | opções do agendamento, agendamento, `ja_agendado`, recusas e tempos máximos |
| `backend/src/services/crm-appointment-text.ts` (novo) | `dayPhrase`, `hourPhrase`, `firstName` e `buildConfirmationText`, em Brasília |
| `backend/src/services/crm-appointment-text.test.ts` (novo) | com o processo em UTC |
| `backend/src/services/crm-conversation.service.ts` (novo) | as portas, o corpo das falhas e o `applyCrmCard`, que saem do cadastro |
| `backend/src/services/crm-lead.service.ts` | passa a usar `crm-conversation.service.ts`, com os mesmos nomes exportados |
| `backend/src/services/crm-schedule.service.ts` (novo) | `loadScheduleOptions`, `scheduleCrmAppointment`, `crmScheduleBodySchema` e os textos de recusa |
| `backend/src/services/crm-schedule.service.test.ts` (novo) | portas, recusas, cartão aplicado, quem agendou tirado da sessão e o schema |
| `backend/src/routes/conversations.routes.ts` | as duas rotas |
| `backend/src/routes/tenant-isolation.spec.ts` | as duas rotas na suíte de isolamento |
| `backend/src/scripts/smoke-crm-card.ts` | `outcome` no cartão e bloco `[5]` com as opções do agendamento, só leitura |
| `backend/src/scripts/smoke-crm-card.guard.test.ts` | trava: o smoke nunca agenda |
| `frontend/src/components/ui/calendar.tsx` | calendário em português |
| `frontend/src/components/ui/calendar.test.tsx` (novo) | |
| `frontend/src/types/crm.ts` | `CrmCardAppointment` e os tipos do agendamento |
| `frontend/src/lib/crmAppointment.ts` (novo) | linha do cartão, tipo e datas no horário de Brasília |
| `frontend/src/lib/crmAppointment.test.ts` (novo) | com o processo em UTC |
| `frontend/src/lib/crmLead.ts` | `CrmCardNotice` |
| `frontend/src/stores/crm.store.ts` | `avisos` aceita o "Agendado agora por você" |
| `frontend/src/components/CrmCardSection.tsx` | desfecho na linha de Agendamento, a linha no cartão de cliente e o "Agendado agora por você" |
| `frontend/src/components/CrmCardSection.test.tsx` | |
| `frontend/src/lib/crmSchedule.ts` (novo) | as duas chamadas, a leitura da resposta e os textos depois de agendar |
| `frontend/src/lib/crmSchedule.test.ts` (novo) | |
| `frontend/src/lib/crmScheduleWizard.ts` (novo) | regras puras do assistente |
| `frontend/src/lib/crmScheduleWizard.test.ts` (novo) | |
| `frontend/src/stores/crmConfirmation.store.ts` (novo) | a confirmação que entrou na caixa, por conversa |
| `frontend/src/stores/crmConfirmation.store.test.ts` (novo) | |
| `frontend/src/components/CrmConfirmationBar.tsx` (novo) | a faixa "Visita agendada. A confirmação está na caixa." |
| `frontend/src/components/MessageInput.tsx` | a faixa acima da caixa e a saída do modo nota |
| `frontend/src/components/MessageInput.confirmation.test.tsx` (novo) | |
| `frontend/src/components/CrmLeadForm.tsx` | exporta `BOTAO_PRINCIPAL`, `BOTAO_FANTASMA`, `CaixaDeErro` e `AvisoForaDaEquipe`, divididos com o agendamento |
| `frontend/src/components/CrmScheduleSummary.tsx` (novo) | o resumo e o rodapé do balão |
| `frontend/src/components/CrmScheduleWizard.tsx` (novo) | o assistente passo a passo |
| `frontend/src/components/CrmScheduleWizard.test.tsx` (novo) | |
| `frontend/src/components/CrmScheduleBalloon.tsx` (novo) | o balão, o que acontece depois de agendar e o foco |
| `frontend/src/components/CrmScheduleBalloon.test.tsx` (novo) | |
| `frontend/src/lib/crmBalloon.ts` (novo) | a regra de um balão do Stronilead aberto por vez, que o `ChatPage` usa |
| `frontend/src/lib/crmBalloon.test.ts` (novo) | |
| `frontend/src/components/CrmHeaderMeta.tsx` | link "Agendar" |
| `frontend/src/components/CrmHeaderMeta.test.tsx` | |
| `frontend/src/components/ChatWindow.tsx` | props do balão do agendamento |
| `frontend/src/pages/ChatPage.tsx` | um balão aberto por vez, o do cadastro ou o do agendamento |
| `CLAUDE.md` | seções 10 e 14 |

---

### Task 0: Worktree e ponto de partida

**Files:** nenhum

O worktree já existe. O checkout principal é dividido com outras sessões e está atrás da `main`: nunca troque de branch nele.

- [ ] **Step 1: Entrar no worktree e conferir o ponto de partida**

```bash
cd ~/STRONIX-FIRMA/06-sistemas/stronizap/.claude/worktrees/agendamento-pelo-zap
git status --short --branch
git log --oneline -1
git fetch origin
git log --oneline HEAD..origin/main | wc -l
```

Expected: `## claude/agendamento-pelo-zap` sem arquivo modificado, `78f36d3 Merge pull request #168 from johnnychaves/fix/blindar-envio-de-email` e `0`. Se o último número não for zero, a `main` andou depois deste plano: rode `git rebase origin/main` antes de começar e, em cada task, guie-se pelos trechos citados, não pelos números de linha.

- [ ] **Step 2: Instalar, gerar o cliente do Prisma e conferir que a base está verde**

```bash
npm ci
npm run prisma:generate
npm test --workspace=backend
npm test --workspace=frontend
npm run typecheck --workspaces
```

Expected: tudo verde. Em `78f36d3`: backend com 534 testes, frontend com 69 arquivos e 797 testes, e os dois typechecks limpos. Se algo falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: `crm.service.ts`, o desfecho no cartão e as opções do agendamento

**Files:**
- Modify: `backend/src/services/crm.service.ts` (linhas 15-19, 33, 50, 572, 590, 673 e fim do arquivo, depois de `createCrmLead`, linha 821)
- Test: `backend/src/services/crm.service.test.ts` (import das linhas 3-20 e fim do arquivo)

`crm.service.ts` é um dos arquivos do contrato. Os tipos novos espelham os do Stronilead (seção "Contrato da ponte") e são espelhados em `frontend/src/types/crm.ts` na Task 9. A ação nova usa o caminho do cadastro: `pedirAoCrm` manda, `interpretar` lê, e uma leitora própria monta a resposta de novo, campo a campo, em lista fechada.

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm.service.test.ts`, trocar o import do topo (linhas 3-20) por:

```ts
import {
  buildCrmUrl,
  createCrmLead,
  CREATE_LEAD_TIMEOUT_MS,
  CRM_LEAD_REFUSAL_FALLBACK,
  CrmCache,
  crmCacheKey,
  fetchCrmCard,
  fetchCrmLeadOptions,
  fetchCrmMatches,
  fetchCrmScheduleOptions,
  LEAD_OPTIONS_TIMEOUT_MS,
  normalizeCrmBaseUrl,
  SCHEDULE_OPTIONS_TIMEOUT_MS,
  type CrmCard,
  type CrmCreateLeadRequest,
  type CrmDeps,
  type CrmLeadOptions,
  type CrmOrgConfig,
  type CrmScheduleOptions,
} from './crm.service';
```

E acrescentar no fim do arquivo:

```ts
// ── Agendamento: opções ────────────────────────────────────────────────────

const OPCOES_DO_AGENDAMENTO: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [
    {
      leadId: 'L1',
      name: 'Mariana Lima',
      relationship: null,
      appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null },
    },
    { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: null },
  ],
  units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }],
  modalities: [{ id: 'm1', name: 'Pilates' }],
  professors: [{ id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] }],
  trialClassOptions: [1, 2, 3],
  days: [
    { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
    { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
    { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
    { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
    { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' },
  ],
};

test('opções do agendamento: manda a ação, o tenant, o número e o e-mail de quem pede, com a chave no header', async () => {
  const a = ambiente({ respostas: [resposta(200, OPCOES_DO_AGENDAMENTO)] });

  await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps);

  const [url, init] = a.chamadasFetch[0] as unknown as [
    string,
    { method: string; headers: Record<string, string>; body: string },
  ];
  assert.equal(url, 'https://crm-stronix.vercel.app/api/zap');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-stronizap-key'], 'chave-em-claro');
  assert.deepEqual(JSON.parse(init.body), {
    action: 'schedule-options',
    tenant: 'stronix',
    phone: TELEFONE,
    actor: { email: 'ana@academia.com' },
  });
});

test('opções do agendamento: 200 vira as opções como vieram', async () => {
  const a = ambiente({ respostas: [resposta(200, OPCOES_DO_AGENDAMENTO)] });

  assert.deepEqual(await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps), {
    ok: true,
    value: OPCOES_DO_AGENDAMENTO,
  });
});

test('opções do agendamento: lista fechada, campo a mais não passa e item malformado cai', async () => {
  const a = ambiente({
    respostas: [
      resposta(200, {
        ...OPCOES_DO_AGENDAMENTO,
        actor: { id: 'u-jo', name: null, role: 'gestor', countsForMeta: 'sim', email: 'jo@academia.com' },
        targets: [
          { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: { type: 'visita' }, cpf: '1' },
          { name: 'Sem id' },
          null,
        ],
        units: [{ name: 'Centro', address: '' }, { address: 'Rua sem nome' }],
        modalities: [{ id: 'm1', name: 'Pilates' }, { id: 'm2' }],
        professors: [{ id: 'p1', name: 'Carla Dias', modalityIds: ['m1', 7, ''], email: 'carla@academia.com' }],
        trialClassOptions: [1, 0, 2.5, '3', 4],
        days: [
          { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
          { date: '29/09/2026', label: 'Hoje', defaultTime: '18:00' },
          { date: '2026-09-30', label: 'Amanhã', defaultTime: '9h' },
        ],
        segredo: 'x',
      }),
    ],
  });

  const r = await fetchCrmScheduleOptions('org1', TELEFONE, 'jo@academia.com', a.deps);

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value.actor, { id: 'u-jo', name: null, role: 'gestor', countsForMeta: false });
  assert.deepEqual(r.value.targets, [{ leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null }]);
  assert.deepEqual(r.value.units, [{ name: 'Centro', address: null }]);
  assert.deepEqual(r.value.modalities, [{ id: 'm1', name: 'Pilates' }]);
  assert.deepEqual(r.value.professors, [{ id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] }]);
  assert.deepEqual(r.value.trialClassOptions, [1, 4]);
  assert.deepEqual(r.value.days, [{ date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' }]);
  assert.equal('segredo' in r.value, false);
  assert.equal(JSON.stringify(r.value).includes('@'), false);
});

test('opções do agendamento: o desfecho de cada cadastro vem pela regra do cartão', async () => {
  const quando = '2026-09-28T21:00:00.000Z';
  const a = ambiente({
    respostas: [
      resposta(200, {
        ...OPCOES_DO_AGENDAMENTO,
        targets: [
          { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: { type: 'visita', at: quando, outcome: 'attended' } },
          { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: { type: 'visita', at: quando, outcome: 'no_show' } },
          { leadId: 'L3', name: 'Laura Lima', relationship: 'Filha', appointment: { type: 'visita', at: quando, outcome: 'cancelled' } },
          { leadId: 'L4', name: 'Caio Lima', relationship: null, appointment: { type: 'visita', at: quando } },
        ],
      }),
    ],
  });

  const r = await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps);

  assert.deepEqual(r.ok ? r.value.targets.map((t) => t.appointment?.outcome) : null, ['attended', 'no_show', null, null]);
});

test('opções do agendamento: número sem cadastro volta com a lista de cadastros vazia', async () => {
  const a = ambiente({ respostas: [resposta(200, { ...OPCOES_DO_AGENDAMENTO, targets: [] })] });

  const r = await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps);

  assert.deepEqual(r.ok ? r.value.targets : null, []);
});

test('opções do agendamento: sem quem pede, sem os cadastros ou sem os dias é indisponivel', async () => {
  for (const corpo of [
    { ...OPCOES_DO_AGENDAMENTO, actor: null },
    { ...OPCOES_DO_AGENDAMENTO, actor: { id: 'x', name: 'X', role: 'dono', countsForMeta: true } },
    { ...OPCOES_DO_AGENDAMENTO, targets: 'x' },
    { ...OPCOES_DO_AGENDAMENTO, days: undefined },
    null,
  ]) {
    const a = ambiente({ respostas: [resposta(200, corpo)] });
    assert.deepEqual(await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('opções do agendamento: integração desligada não chama o CRM', async () => {
  const a = ambiente({ org: { ...ORG_CONFIGURADA, crmEnabled: false } });

  assert.deepEqual(await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps), {
    ok: false,
    kind: 'desligado',
  });
  assert.equal(a.chamadasFetch.length, 0);
});

test('opções do agendamento: 401 é chave_invalida, e fora da equipe vem com o texto do Stronilead', async () => {
  const semChave = ambiente({ respostas: [resposta(401, { error: 'Credencial inválida' })] });
  assert.deepEqual(await fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', semChave.deps), {
    ok: false,
    kind: 'chave_invalida',
  });

  const message = 'Seu e-mail do Stronizap, bia@stronix.com.br, não está na equipe do Stronilead.';
  const fora = ambiente({ respostas: [resposta(403, { error: 'fora_da_equipe', message })] });
  assert.deepEqual(await fetchCrmScheduleOptions('org1', TELEFONE, 'bia@stronix.com.br', fora.deps), {
    ok: false,
    kind: 'recusa',
    status: 403,
    code: 'fora_da_equipe',
    message,
    field: null,
    card: null,
    createdAt: null,
  });
});

test('opções do agendamento: desiste em 4 segundos, e não antes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = ambiente();
  a.deps.httpFetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    });

  let resultado: unknown = 'pendente';
  const pedido = fetchCrmScheduleOptions('org1', TELEFONE, 'ana@academia.com', a.deps).then((r) => {
    resultado = r;
  });
  await new Promise((r) => setImmediate(r));

  t.mock.timers.tick(SCHEDULE_OPTIONS_TIMEOUT_MS - 1);
  await new Promise((r) => setImmediate(r));
  assert.equal(resultado, 'pendente');

  t.mock.timers.tick(1);
  await pedido;
  assert.deepEqual(resultado, { ok: false, kind: 'indisponivel' });
  assert.equal(SCHEDULE_OPTIONS_TIMEOUT_MS, 4000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com erros de tipo: `fetchCrmScheduleOptions`, `SCHEDULE_OPTIONS_TIMEOUT_MS` e `CrmScheduleOptions` não existem em `./crm.service`.

- [ ] **Step 3: Tipos do agendamento e o desfecho no cartão**

Em `backend/src/services/crm.service.ts`, logo depois da interface `CrmStrip` (linhas 15-19), acrescentar:

```ts

/** Tipo do agendamento, do jeito que o Stronilead grava em `appointmentType`. */
export type CrmAppointmentType = 'visita' | 'aula_experimental';

/**
 * Desfecho que o cartão mostra. O Stronilead grava também `rescheduled` e
 * `cancelled`, mas eles não chegam aqui: remarcado já vem com a data nova, e
 * cancelado some com o agendamento inteiro.
 */
export type CrmAppointmentOutcome = 'attended' | 'no_show';

/**
 * Agendamento no cartão: o que a ficha e a Meta Diária mostram hoje. `type`
 * vem como o lead guarda, e `outcome` diz se a pessoa compareceu ou faltou,
 * quando o Stronilead já registrou.
 */
export interface CrmCardAppointment {
  type: string;
  at: string;
  outcome?: CrmAppointmentOutcome | null;
}
```

Nas interfaces `CrmWard` (linha 33) e `CrmCard` (linha 50), trocar a linha:

```ts
  appointment?: { type: string; at: string } | null;
```

por:

```ts
  appointment?: CrmCardAppointment | null;
```

- [ ] **Step 4: As ações da ponte num tipo só**

Logo antes do comentário `/** Resposta do CRM antes de interpretar, ou o motivo de não ter perguntado. */` (linha 571, acima de `type Pedido =`), acrescentar:

```ts
/**
 * Ações do POST /api/zap que autenticam pela chave e passam por `pedirAoCrm`.
 * O `match` tem caminho próprio (`fetchCrmMatches`).
 */
type AcaoDaPonte = 'lead-options' | 'create-lead' | 'schedule-options' | 'schedule';

```

Em `pedirAoCrm` (linha 590) e em `interpretar` (linha 673), trocar o parâmetro:

```ts
  action: 'lead-options' | 'create-lead',
```

por:

```ts
  action: AcaoDaPonte,
```

- [ ] **Step 5: A leitora das opções, no fim do arquivo**

Acrescentar depois de `createCrmLead` (fim do arquivo):

```ts

// ── Agendamento pelo Stronizap ─────────────────────────────────────────────
// Spec: stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "A ponte". Duas ações no mesmo POST /api/zap do cadastro: `schedule-options`,
// que só lê, e `schedule`, que grava. Quem agenda chega aqui já tirado da
// sessão e do cadastro do colaborador (ver crm-schedule.service.ts).

/** Tempo máximo das opções do agendamento. Só leitura, como o cartão. */
export const SCHEDULE_OPTIONS_TIMEOUT_MS = TIMEOUT_MS;

/** Um cadastro que o número casa: o próprio ou um menor de quem ele é responsável. */
export interface CrmScheduleTarget {
  leadId: string;
  name: string | null;
  /** Parentesco do menor visto por quem escreve ("Filho", "Filha"...), calculado pelo Stronilead. null no cadastro
   * do próprio número e quando o Stronilead não sabe o gênero. */
  relationship: string | null;
  /** O agendamento de agora, com o desfecho pela regra do cartão. Alimenta o aviso de remarcação. */
  appointment: { type: string; at: string; outcome: CrmAppointmentOutcome | null } | null;
}

/**
 * Opções do balão do agendamento, do jeito que saem daqui para o navegador.
 * Espelho de `frontend/src/types/crm.ts`. Lista FECHADA, como a do cadastro:
 * `lerOpcoesDoAgendamento` monta o objeto de novo, campo a campo.
 */
export interface CrmScheduleOptions {
  /** `countsForMeta`: agendar hoje conta na Meta Diária de quem pede. */
  actor: { id: string; name: string | null; role: 'consultor' | 'gestor'; countsForMeta: boolean };
  targets: CrmScheduleTarget[];
  units: Array<{ name: string; address: string | null }>;
  modalities: Array<{ id: string; name: string }>;
  professors: Array<{ id: string; name: string; modalityIds: string[] }>;
  trialClassOptions: number[];
  /** Os cinco dias sugeridos, já no horário de Brasília (`date` em AAAA-MM-DD). */
  days: Array<{ date: string; label: string; defaultTime: string }>;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const textoOuNulo = (v: unknown): string | null => (texto(v) ? v : null);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Opções como saem para a tela, montadas de novo campo a campo. Sem quem pede,
 * sem os cadastros do número ou sem os dias não há balão.
 */
function lerOpcoesDoAgendamento(corpo: unknown): CrmScheduleOptions | null {
  const c = objeto(corpo);
  if (!c) return null;
  const actor = objeto(c.actor);
  const id = actor?.id;
  const role = actor?.role === 'gestor' ? 'gestor' : actor?.role === 'consultor' ? 'consultor' : null;
  if (!actor || !texto(id) || !role) return null;
  const alvos = c.targets;
  const dias = c.days;
  if (!Array.isArray(alvos) || !Array.isArray(dias)) return null;

  return {
    actor: { id, name: textoOuNulo(actor.name), role, countsForMeta: actor.countsForMeta === true },
    targets: alvos.flatMap((t) => {
      const o = objeto(t);
      const leadId = o?.leadId;
      if (!o || !texto(leadId)) return [];
      const agendamento = objeto(o.appointment);
      const tipo = agendamento?.type;
      const quando = agendamento?.at;
      // O desfecho pela regra do cartão: compareceu, faltou ou nenhum.
      const desfecho = agendamento?.outcome;
      return [
        {
          leadId,
          name: textoOuNulo(o.name),
          relationship: textoOuNulo(o.relationship),
          appointment:
            texto(tipo) && texto(quando)
              ? { type: tipo, at: quando, outcome: desfecho === 'attended' || desfecho === 'no_show' ? desfecho : null }
              : null,
        },
      ];
    }),
    units: lista(c.units).flatMap((u) => {
      const o = objeto(u);
      const nome = o?.name;
      return o && texto(nome) ? [{ name: nome, address: textoOuNulo(o.address) }] : [];
    }),
    modalities: lista(c.modalities).flatMap((m) => {
      const o = objeto(m);
      const mid = o?.id;
      const nome = o?.name;
      return texto(mid) && texto(nome) ? [{ id: mid, name: nome }] : [];
    }),
    professors: lista(c.professors).flatMap((p) => {
      const o = objeto(p);
      const pid = o?.id;
      const nome = o?.name;
      return o && texto(pid) && texto(nome)
        ? [{ id: pid, name: nome, modalityIds: lista(o.modalityIds).filter(texto) }]
        : [];
    }),
    trialClassOptions: lista(c.trialClassOptions).filter(
      (n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0,
    ),
    days: dias.flatMap((d) => {
      const o = objeto(d);
      const date = o?.date;
      const label = o?.label;
      const defaultTime = o?.defaultTime;
      return texto(date) && DATA_RE.test(date) && texto(label) && texto(defaultTime) && HORA_RE.test(defaultTime)
        ? [{ date, label, defaultTime }]
        : [];
    }),
  };
}

/**
 * Opções do balão do agendamento para quem está pedindo, no número da
 * conversa. O Stronilead acha a pessoa pelo e-mail e os cadastros pelo número.
 */
export async function fetchCrmScheduleOptions(
  organizationId: string,
  phone: string,
  actorEmail: string,
  deps: Partial<CrmDeps> = {},
): Promise<CrmLeadCall<CrmScheduleOptions>> {
  const d = { ...depsReais, ...deps };
  const pedido = await pedirAoCrm(
    organizationId,
    'schedule-options',
    { phone, actor: { email: actorEmail } },
    SCHEDULE_OPTIONS_TIMEOUT_MS,
    d,
  );
  return interpretar(pedido, organizationId, 'schedule-options', lerOpcoesDoAgendamento, d.log);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test`
Expected: typecheck limpo e PASS, com os nove testes novos de opções do agendamento (543 no total).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm.service.test.ts
git commit -m "feat: ponte pede ao Stronilead as opções do agendamento e lê o desfecho do cartão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `crm.service.ts`, o agendamento e o `ja_agendado`

**Files:**
- Modify: `backend/src/services/crm.service.ts` (fim do arquivo, depois de `fetchCrmScheduleOptions`)
- Test: `backend/src/services/crm.service.test.ts`

`createCrmAppointment` é a leitora do `schedule`. O `ja_agendado` (409) é o mesmo agendamento já gravado, e volta como sucesso com `alreadyScheduled: true`, antes do `interpretar`, que fica como está.

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm.service.test.ts`, no import do topo, trocar:

```ts
  buildCrmUrl,
  createCrmLead,
```

por:

```ts
  buildCrmUrl,
  createCrmAppointment,
  createCrmLead,
```

trocar:

```ts
  normalizeCrmBaseUrl,
  SCHEDULE_OPTIONS_TIMEOUT_MS,
  type CrmCard,
```

por:

```ts
  normalizeCrmBaseUrl,
  SCHEDULE_OPTIONS_TIMEOUT_MS,
  SCHEDULE_TIMEOUT_MS,
  type CrmAppointmentDetail,
  type CrmCard,
```

e trocar:

```ts
  type CrmOrgConfig,
  type CrmScheduleOptions,
} from './crm.service';
```

por:

```ts
  type CrmOrgConfig,
  type CrmScheduleOptions,
  type CrmScheduleRequest,
} from './crm.service';
```

E acrescentar no fim do arquivo:

```ts
// ── Agendamento: schedule ──────────────────────────────────────────────────

const PEDIDO_AGENDAMENTO: CrmScheduleRequest = {
  phone: TELEFONE,
  actor: { email: 'ana@academia.com', name: 'Ana Souza' },
  channelName: 'Recepção',
  schedule: {
    leadId: 'L1',
    type: 'visita',
    unit: 'Centro',
    modality: null,
    professorId: null,
    soloTraining: false,
    quantity: null,
    date: '2026-10-01',
    time: '18:00',
    note: 'Vem depois do trabalho.',
  },
};

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

const CARTAO_AGENDADO: CrmCard = {
  found: true,
  leadId: 'L1',
  kind: 'lead',
  name: 'Mariana Lima',
  stage: 'Primeiro contato',
  source: 'Instagram',
  consultantName: 'Ana Souza',
  strip: null,
  appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null },
};

test('agendamento: manda telefone, quem agendou, canal e o agendamento, na ação schedule', async () => {
  const a = ambiente({ respostas: [resposta(201, { card: CARTAO_AGENDADO, appointment: VISITA })] });

  await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps);

  const [url, init] = a.chamadasFetch[0] as unknown as [
    string,
    { method: string; headers: Record<string, string>; body: string },
  ];
  assert.equal(url, 'https://crm-stronix.vercel.app/api/zap');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-stronizap-key'], 'chave-em-claro');
  assert.deepEqual(JSON.parse(init.body), { action: 'schedule', tenant: 'stronix', ...PEDIDO_AGENDAMENTO });
});

test('agendamento: 201 devolve o cartão e o agendamento, sem ser repetido', async () => {
  const a = ambiente({ respostas: [resposta(201, { card: CARTAO_AGENDADO, appointment: VISITA })] });

  assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), {
    ok: true,
    value: { card: CARTAO_AGENDADO, appointment: VISITA, alreadyScheduled: false },
  });
});

test('agendamento: o agendamento é montado de novo, e campo a mais ou malformado não passa', async () => {
  const a = ambiente({
    respostas: [
      resposta(201, {
        card: CARTAO_AGENDADO,
        appointment: {
          ...VISITA,
          type: 'aula_experimental',
          unit: '',
          modality: 'Pilates',
          professorName: 'Carla Dias',
          soloTraining: 'sim',
          quantity: 2.5,
          outcome: 'rescheduled',
          cpf: '123',
        },
      }),
    ],
  });

  const r = await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps);

  assert.deepEqual(r.ok ? r.value.appointment : null, {
    ...VISITA,
    type: 'aula_experimental',
    unit: null,
    modality: 'Pilates',
    professorName: 'Carla Dias',
    soloTraining: false,
    quantity: null,
    outcome: null,
  });
});

test('agendamento: 201 sem cartão encontrado ou sem agendamento completo é indisponivel', async () => {
  for (const corpo of [
    {},
    { card: CARTAO_AGENDADO },
    { card: { found: false }, appointment: VISITA },
    { card: CARTAO_AGENDADO, appointment: { ...VISITA, type: 'ligacao' } },
    { card: CARTAO_AGENDADO, appointment: { ...VISITA, at: 'ontem' } },
    { card: CARTAO_AGENDADO, appointment: { ...VISITA, leadId: '' } },
    null,
  ]) {
    const a = ambiente({ respostas: [resposta(201, corpo)] });
    assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('agendamento: ja_agendado com o cartão e o agendamento vale como sucesso repetido', async () => {
  const a = ambiente({
    respostas: [
      resposta(409, {
        error: 'ja_agendado',
        message: 'Essa visita já estava agendada.',
        card: CARTAO_AGENDADO,
        appointment: VISITA,
      }),
    ],
  });

  assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), {
    ok: true,
    value: { card: CARTAO_AGENDADO, appointment: VISITA, alreadyScheduled: true },
  });
});

test('agendamento: ja_agendado sem o cartão ou sem o agendamento é indisponivel', async () => {
  for (const corpo of [
    { error: 'ja_agendado', message: 'Já estava.', appointment: VISITA },
    { error: 'ja_agendado', message: 'Já estava.', card: CARTAO_AGENDADO },
  ]) {
    const a = ambiente({ respostas: [resposta(409, corpo)] });
    assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('agendamento: recusa com campo leva o status, o código, o texto e o campo', async () => {
  const message = 'Essa unidade não existe mais no Stronilead. Escolha de novo.';
  const a = ambiente({ respostas: [resposta(422, { error: 'catalogo_mudou', field: 'unit', message })] });

  assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), {
    ok: false,
    kind: 'recusa',
    status: 422,
    code: 'catalogo_mudou',
    message,
    field: 'unit',
    card: null,
    createdAt: null,
  });
});

test('agendamento: horário passado, lead que não confere e limite chegam com o texto do Stronilead', async () => {
  for (const [status, error] of [
    [422, 'horario_passado'],
    [422, 'lead_nao_confere'],
    [429, 'limite'],
  ] as const) {
    const message = `Texto do Stronilead para ${error}.`;
    const a = ambiente({ respostas: [resposta(status, { error, message })] });
    const r = await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps);
    assert.equal(r.ok === false && r.kind === 'recusa' ? `${r.status} ${r.code} ${r.message}` : null, `${status} ${error} ${message}`);
  }
});

test('agendamento: 401 é chave_invalida, 5xx e rede fora são indisponivel', async () => {
  const semChave = ambiente({ respostas: [resposta(401, {})] });
  assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, semChave.deps), {
    ok: false,
    kind: 'chave_invalida',
  });

  for (const r of [resposta(503, {}), new Error('ECONNRESET')]) {
    const a = ambiente({ respostas: [r] });
    assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('agendamento: integração desligada não chama o CRM', async () => {
  const a = ambiente({ org: { ...ORG_CONFIGURADA, crmEnabled: false } });

  assert.deepEqual(await createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps), { ok: false, kind: 'desligado' });
  assert.equal(a.chamadasFetch.length, 0);
});

test('agendamento: desiste em 8 segundos, e não antes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = ambiente();
  a.deps.httpFetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    });

  let resultado: unknown = 'pendente';
  const pedido = createCrmAppointment('org1', PEDIDO_AGENDAMENTO, a.deps).then((r) => {
    resultado = r;
  });
  await new Promise((r) => setImmediate(r));

  t.mock.timers.tick(SCHEDULE_TIMEOUT_MS - 1);
  await new Promise((r) => setImmediate(r));
  assert.equal(resultado, 'pendente');

  t.mock.timers.tick(1);
  await pedido;
  assert.deepEqual(resultado, { ok: false, kind: 'indisponivel' });
  assert.equal(SCHEDULE_TIMEOUT_MS, 8000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `createCrmAppointment`, `SCHEDULE_TIMEOUT_MS`, `CrmAppointmentDetail` e `CrmScheduleRequest` não existem em `./crm.service`.

- [ ] **Step 3: Implementar no fim de `backend/src/services/crm.service.ts`**

Acrescentar depois de `fetchCrmScheduleOptions` (fim do arquivo):

```ts

/** Tempo máximo do agendamento, que roda uma transação do lado do Stronilead. */
export const SCHEDULE_TIMEOUT_MS = 8000;

/**
 * Um agendamento do lead como a ficha, o cartão e a Meta Diária mostram hoje.
 * Vem na resposta do `schedule` (e do `ja_agendado`) e alimenta o texto da
 * confirmação. O lembrete (PR 3) lê o mesmo formato no `appointment-status`.
 */
export interface CrmAppointmentDetail {
  leadId: string;
  leadName: string | null;
  type: CrmAppointmentType;
  /** Instante em ISO. Dia e hora de Brasília saem dele (crm-appointment-text.ts). */
  at: string;
  unit: string | null;
  /** Endereço da unidade na lista de agora. null quando ela sumiu ou não tem endereço. */
  unitAddress: string | null;
  modality: string | null;
  professorName: string | null;
  soloTraining: boolean;
  quantity: number | null;
  outcome: CrmAppointmentOutcome | null;
}

/** O bloco `schedule`, o único pedaço do agendamento que vem do navegador. */
export interface CrmScheduleInput {
  leadId: string;
  type: CrmAppointmentType;
  /** Nome da unidade, na visita. null na aula ou na academia sem unidade. */
  unit: string | null;
  /** Nome da modalidade, na aula. */
  modality: string | null;
  professorId: string | null;
  soloTraining: boolean;
  quantity: number | null;
  /** AAAA-MM-DD, no horário de Brasília. */
  date: string;
  /** HH:MM (24h), no horário de Brasília. */
  time: string;
  note: string | null;
}

/** Pedido completo de agendamento. `phone`, `actor` e `channelName` o backend põe. */
export interface CrmScheduleRequest {
  /** O número do contato como o WhatsApp guarda (`Contact.phone`). */
  phone: string;
  actor: { email: string; name: string };
  channelName: string;
  schedule: CrmScheduleInput;
}

/**
 * Agendamento que deu certo: o cartão do número, já com o agendamento, e o
 * agendamento como o Stronilead gravou. `alreadyScheduled` é true quando ele
 * respondeu `ja_agendado`: a gravação é a mesma, então vale como sucesso.
 */
export interface CrmScheduled {
  card: CrmCard;
  appointment: CrmAppointmentDetail;
  alreadyScheduled: boolean;
}

/** `AppointmentDetail` do Stronilead, montado de novo. Sem lead, tipo ou data, não vale. */
function lerDetalheDoAgendamento(v: unknown): CrmAppointmentDetail | null {
  const o = objeto(v);
  if (!o) return null;
  const leadId = o.leadId;
  const type = o.type;
  const at = o.at;
  if (!texto(leadId) || !texto(at) || Number.isNaN(Date.parse(at))) return null;
  if (type !== 'visita' && type !== 'aula_experimental') return null;
  const quantity = o.quantity;
  const outcome = o.outcome;
  return {
    leadId,
    leadName: textoOuNulo(o.leadName),
    type,
    at,
    unit: textoOuNulo(o.unit),
    unitAddress: textoOuNulo(o.unitAddress),
    modality: textoOuNulo(o.modality),
    professorName: textoOuNulo(o.professorName),
    soloTraining: o.soloTraining === true,
    quantity: typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0 ? quantity : null,
    outcome: outcome === 'attended' || outcome === 'no_show' ? outcome : null,
  };
}

/** `{ card, appointment }`, com o cartão encontrado e o agendamento completo. */
function lerAgendado(corpo: unknown): Omit<CrmScheduled, 'alreadyScheduled'> | null {
  const c = objeto(corpo);
  const card = objeto(c?.card);
  const appointment = lerDetalheDoAgendamento(c?.appointment);
  return card && card.found === true && appointment ? { card: card as unknown as CrmCard, appointment } : null;
}

/**
 * Agenda no Stronilead. Não usa o cache: quem chama troca o cartão guardado
 * pelo que voltar (ver `CrmCache.replaceCard`).
 *
 * `ja_agendado` (409) é o mesmo agendamento que já estava gravado: dois
 * cliques, duas pessoas ou o "Tentar de novo" depois de uma resposta perdida.
 * Ele volta como sucesso, com `alreadyScheduled`, porque o cartão e o
 * agendamento que vieram são os de verdade. Sem os dois, vira indisponível, e
 * a nova tentativa resolve.
 */
export async function createCrmAppointment(
  organizationId: string,
  request: CrmScheduleRequest,
  deps: Partial<CrmDeps> = {},
): Promise<CrmLeadCall<CrmScheduled>> {
  const d = { ...depsReais, ...deps };
  const pedido = await pedirAoCrm(
    organizationId,
    'schedule',
    {
      phone: request.phone,
      actor: request.actor,
      channelName: request.channelName,
      schedule: request.schedule,
    },
    SCHEDULE_TIMEOUT_MS,
    d,
  );

  if (pedido.kind === 'resposta' && pedido.status === 409 && objeto(pedido.corpo)?.error === 'ja_agendado') {
    const repetido = lerAgendado(pedido.corpo);
    if (repetido) return { ok: true, value: { ...repetido, alreadyScheduled: true } };
    d.log.warn({ organizationId, action: 'schedule', status: 409 }, 'CRM respondeu ja_agendado sem o cartão ou o agendamento');
    return { ok: false, kind: 'indisponivel' };
  }

  return interpretar(
    pedido,
    organizationId,
    'schedule',
    (corpo) => {
      const agendado = lerAgendado(corpo);
      return agendado ? { ...agendado, alreadyScheduled: false } : null;
    },
    d.log,
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test`
Expected: typecheck limpo e PASS, com os onze testes novos do agendamento (554 no total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm.service.test.ts
git commit -m "feat: ponte agenda no Stronilead e trata o ja_agendado como o mesmo agendamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `crm-appointment-text.ts`, o texto da confirmação em Brasília

**Files:**
- Create: `backend/src/services/crm-appointment-text.ts`
- Create: `backend/src/services/crm-appointment-text.test.ts`

Módulo puro. O dia e a hora saem de `America/Sao_Paulo` pelo `Intl`, nunca de `getHours()` ou `getDate()`: o CI roda em UTC, e a VPS pode rodar em qualquer fuso. O teste põe o processo em UTC, porque na máquina do Johnny, em Brasília, um defeito de fuso não aparece. O PR 3 reaproveita `dayPhrase`, `hourPhrase` e `firstName` nas variáveis do lembrete.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/crm-appointment-text.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CrmAppointmentDetail } from './crm.service';
import { buildConfirmationText, dayPhrase, firstName, hourPhrase } from './crm-appointment-text';

// A VPS e a máquina do Johnny ficam em Brasília, e lá getHours() e getDate()
// já devolvem o horário certo: um defeito de fuso não aparece. O CI roda em
// UTC. Este arquivo põe o processo em UTC antes dos testes, e o primeiro teste
// confere que a troca pegou, para o resto provar que o texto sai de Brasília
// seja qual for o fuso do processo.
process.env.TZ = 'UTC';

/** Instante escrito no horário de Brasília: brt('2026-10-01T18:00'). */
const brt = (s: string) => new Date(`${s}:00-03:00`);

/** Hoje, nos exemplos da spec: terça, 29/09, às 15:40. */
const AGORA = brt('2026-09-29T15:40');

const VISITA: CrmAppointmentDetail = {
  leadId: 'L1',
  leadName: 'Mariana Lima',
  type: 'visita',
  at: brt('2026-10-01T18:00').toISOString(),
  unit: 'Centro',
  unitAddress: 'Rua Garibaldi, 1200',
  modality: null,
  professorName: null,
  soloTraining: false,
  quantity: null,
  outcome: null,
};

const AULA: CrmAppointmentDetail = {
  ...VISITA,
  type: 'aula_experimental',
  at: brt('2026-10-02T19:00').toISOString(),
  unit: null,
  unitAddress: null,
  modality: 'Pilates',
  professorName: 'Carla Dias',
  quantity: 1,
};

test('o processo roda em UTC neste arquivo', () => {
  assert.equal(new Date(2026, 8, 29, 18, 0).toISOString(), '2026-09-29T18:00:00.000Z');
  assert.equal(new Date(2026, 0, 15).getTimezoneOffset(), 0);
});

// ── dayPhrase ──────────────────────────────────────────────────────────────

test('dia: hoje, amanhã com o dia da semana, e outro dia só com o dia da semana', () => {
  assert.equal(dayPhrase(brt('2026-09-29T18:00'), AGORA), 'hoje (29/09)');
  assert.equal(dayPhrase(brt('2026-09-30T09:00'), AGORA), 'amanhã, quarta-feira (30/09)');
  assert.equal(dayPhrase(brt('2026-10-01T18:00'), AGORA), 'quinta-feira (01/10)');
  assert.equal(dayPhrase(brt('2026-10-04T10:00'), AGORA), 'domingo (04/10)');
  assert.equal(dayPhrase(brt('2026-10-03T10:00'), AGORA), 'sábado (03/10)');
});

test('dia: 22h de Brasília ainda é hoje, mesmo já sendo o dia seguinte em UTC', () => {
  // 22:00 de Brasília é 01:00 do dia 30 em UTC.
  assert.equal(dayPhrase(brt('2026-09-29T22:00'), AGORA), 'hoje (29/09)');
  // Às 22:30 do dia 29, a visita das 09:00 do dia 30 é amanhã.
  assert.equal(dayPhrase(brt('2026-09-30T09:00'), brt('2026-09-29T22:30')), 'amanhã, quarta-feira (30/09)');
});

test('dia: virada de mês e de ano', () => {
  assert.equal(dayPhrase(brt('2026-10-01T09:00'), brt('2026-09-30T20:00')), 'amanhã, quinta-feira (01/10)');
  assert.equal(dayPhrase(brt('2027-01-01T09:00'), brt('2026-12-31T20:00')), 'amanhã, sexta-feira (01/01)');
});

// ── hourPhrase ─────────────────────────────────────────────────────────────

test('hora: cheia vira "18h", quebrada vira "18h30", e sai em Brasília', () => {
  assert.equal(hourPhrase(brt('2026-10-01T18:00')), '18h');
  assert.equal(hourPhrase(brt('2026-10-01T18:30')), '18h30');
  assert.equal(hourPhrase(brt('2026-10-01T09:00')), '9h');
  assert.equal(hourPhrase(brt('2026-10-01T09:05')), '9h05');
  // 21:00 em UTC são 18:00 em Brasília.
  assert.equal(hourPhrase(new Date('2026-10-01T21:00:00.000Z')), '18h');
});

// ── firstName ──────────────────────────────────────────────────────────────

test('primeiro nome: a primeira palavra com letra', () => {
  assert.equal(firstName('Mariana Lima'), 'Mariana');
  assert.equal(firstName('  Mariana   Lima '), 'Mariana');
  assert.equal(firstName('💪 Mariana'), 'Mariana');
});

test('primeiro nome: vazio e nome que é telefone não viram nome', () => {
  assert.equal(firstName(null), null);
  assert.equal(firstName(undefined), null);
  assert.equal(firstName('   '), null);
  assert.equal(firstName('+55 51 99812-4471'), null);
  assert.equal(firstName('5551998124471'), null);
});

// ── buildConfirmationText ──────────────────────────────────────────────────

const confirmacao = (over: Partial<CrmAppointmentDetail> = {}, opts: { nome?: string | null; menor?: boolean } = {}) =>
  buildConfirmationText({
    contactName: opts.nome === undefined ? 'Mariana Lima' : opts.nome,
    appointment: { ...VISITA, ...over },
    isWard: opts.menor ?? false,
    now: AGORA,
  });

test('confirmação: visita com unidade e endereço, como na spec', () => {
  assert.equal(
    confirmacao(),
    'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
  );
});

test('confirmação: unidade sem endereço sai sem parênteses, e academia sem unidade sai sem "na unidade"', () => {
  assert.equal(
    confirmacao({ unitAddress: null }),
    'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro.',
  );
  assert.equal(
    confirmacao({ unit: null, unitAddress: null }),
    'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h.',
  );
});

test('confirmação: hoje e amanhã, com a hora quebrada', () => {
  assert.equal(
    confirmacao({ at: brt('2026-09-29T18:30').toISOString(), unit: null }),
    'Combinado, Mariana! Sua visita ficou para hoje (29/09), às 18h30.',
  );
  assert.equal(
    confirmacao({ at: brt('2026-09-30T18:00').toISOString(), unit: null }),
    'Combinado, Mariana! Sua visita ficou para amanhã, quarta-feira (30/09), às 18h.',
  );
});

test('confirmação: contato sem nome, ou com telefone no lugar do nome, começa em "Combinado!"', () => {
  assert.equal(
    confirmacao({ unit: null }, { nome: null }),
    'Combinado! Sua visita ficou para quinta-feira (01/10), às 18h.',
  );
  assert.equal(
    confirmacao({ unit: null }, { nome: '+55 51 99812-4471' }),
    'Combinado! Sua visita ficou para quinta-feira (01/10), às 18h.',
  );
});

test('confirmação: aula com professor, pelo primeiro nome e sem artigo', () => {
  assert.equal(
    confirmacao(AULA),
    'Combinado, Mariana! Sua aula experimental de Pilates ficou para sexta-feira (02/10), às 19h, com Carla.',
  );
});

test('confirmação: "Treina sozinho" sai sem o "com"', () => {
  assert.equal(
    confirmacao({ ...AULA, professorName: null, soloTraining: true }),
    'Combinado, Mariana! Sua aula experimental de Pilates ficou para sexta-feira (02/10), às 19h.',
  );
});

test('confirmação: mais de uma aula', () => {
  assert.equal(
    confirmacao({ ...AULA, quantity: 2 }),
    'Combinado, Mariana! Suas 2 aulas experimentais de Pilates começam sexta-feira (02/10), às 19h, com Carla.',
  );
});

test('confirmação: menor, na visita e na aula, com o primeiro nome do menor', () => {
  assert.equal(
    confirmacao({ leadName: 'Pedro Lima' }, { menor: true }),
    'Combinado, Mariana! A visita de Pedro ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
  );
  assert.equal(
    confirmacao({ ...AULA, leadName: 'Pedro Lima' }, { menor: true }),
    'Combinado, Mariana! A aula experimental de Pilates de Pedro ficou para sexta-feira (02/10), às 19h, com Carla.',
  );
  assert.equal(
    confirmacao({ ...AULA, leadName: 'Pedro Lima', quantity: 3 }, { menor: true }),
    'Combinado, Mariana! As 3 aulas experimentais de Pilates de Pedro começam sexta-feira (02/10), às 19h, com Carla.',
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `Cannot find module './crm-appointment-text'`.

- [ ] **Step 3: Implementar**

Criar `backend/src/services/crm-appointment-text.ts`:

```ts
// Texto do agendamento em português, no horário de Brasília. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "O texto da confirmação".
//
// O dia e a hora saem sempre de America/Sao_Paulo, nunca do fuso do processo:
// o CI roda em UTC, e a VPS pode rodar em qualquer fuso. Nenhum Date é
// deslocado, só lido no calendário de Brasília (o mesmo jeito do
// api/_horarioDeBrasilia.js do Stronilead). Brasília não tem horário de verão
// desde 2019.
//
// Puro de propósito: o agendamento monta a confirmação aqui, e o lembrete
// (PR 3) reaproveita `dayPhrase`, `hourPhrase` e `firstName` nas variáveis
// [dia], [hora], [primeiro_nome], [professor_da_aula] e [meu_primeiro_nome].
import type { CrmAppointmentDetail } from './crm.service';

const FUSO = 'America/Sao_Paulo';
const DIA_MS = 86_400_000;
const DIAS_DA_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

const leitor = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Ano, mês (1 a 12), dia, hora e minuto no calendário de Brasília. */
function partes(data: Date): Partes {
  const p: Record<string, number> = {};
  for (const { type, value } of leitor.formatToParts(data)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute };
}

/** Número do dia no calendário de Brasília. A diferença entre dois é a distância em dias. */
function numeroDoDia(p: Partes): number {
  return Date.UTC(p.ano, p.mes - 1, p.dia) / DIA_MS;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "hoje (29/09)", "amanhã, quarta-feira (30/09)" ou "quinta-feira (01/10)",
 * contando os dias de calendário entre `reference` e `at`, os dois em Brasília.
 */
export function dayPhrase(at: Date, reference: Date): string {
  const quando = partes(at);
  const dia = numeroDoDia(quando);
  const ddmm = `${pad(quando.dia)}/${pad(quando.mes)}`;
  const distancia = dia - numeroDoDia(partes(reference));
  if (distancia === 0) return `hoje (${ddmm})`;
  const semana = DIAS_DA_SEMANA[new Date(dia * DIA_MS).getUTCDay()];
  if (distancia === 1) return `amanhã, ${semana} (${ddmm})`;
  return `${semana} (${ddmm})`;
}

/** "18h" em hora cheia e "18h30" nos outros casos, em Brasília. */
export function hourPhrase(at: Date): string {
  const { hora, minuto } = partes(at);
  return minuto === 0 ? `${hora}h` : `${hora}h${pad(minuto)}`;
}

/**
 * Primeira palavra com letra de um nome. null para nome vazio e para nome que
 * é só telefone ("+55 51 99812-4471"), a mesma ideia das mensagens prontas
 * (PR #171): nada de "Combinado, +55!".
 */
export function firstName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null;
  return name.trim().split(/\s+/).find((palavra) => /\p{L}/u.test(palavra)) ?? null;
}

export interface ConfirmationInput {
  /** Nome de quem recebe a mensagem, o contato da conversa. */
  contactName: string | null;
  appointment: CrmAppointmentDetail;
  /** O agendamento é de um menor de quem o contato é responsável. */
  isWard: boolean;
  /** Referência do "hoje" e do "amanhã". */
  now: Date;
}

/** ", na unidade Centro (Rua Garibaldi, 1200)", sem os parênteses quando não há endereço. */
function ondeDaVisita(appointment: CrmAppointmentDetail): string {
  if (!appointment.unit) return '';
  const endereco = appointment.unitAddress ? ` (${appointment.unitAddress})` : '';
  return `, na unidade ${appointment.unit}${endereco}`;
}

/** ", com Carla": o primeiro nome, sem artigo, para não adivinhar o gênero. */
function comProfessor(appointment: CrmAppointmentDetail): string {
  if (appointment.soloTraining) return '';
  const professor = firstName(appointment.professorName);
  return professor ? `, com ${professor}` : '';
}

/**
 * Confirmação do agendamento para o lead, que fica escrita na caixa de
 * mensagem. Exemplos:
 * - "Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200)."
 * - "Combinado, Mariana! Sua aula experimental de Pilates ficou para sexta-feira (02/10), às 19h, com Carla."
 * - "Combinado, Mariana! Suas 2 aulas experimentais de Pilates começam sexta-feira (02/10), às 19h, com Carla."
 * - "Combinado, Mariana! A visita de Pedro ficou para …"
 */
export function buildConfirmationText({ contactName, appointment, isWard, now }: ConfirmationInput): string {
  const nome = firstName(contactName);
  const abertura = nome ? `Combinado, ${nome}!` : 'Combinado!';
  const at = new Date(appointment.at);
  const quando = `${dayPhrase(at, now)}, às ${hourPhrase(at)}`;
  const aluno = isWard ? firstName(appointment.leadName) : null;
  const deQuem = aluno ? ` de ${aluno}` : '';

  if (appointment.type === 'visita') {
    const sujeito = isWard ? `A visita${deQuem}` : 'Sua visita';
    return `${abertura} ${sujeito} ficou para ${quando}${ondeDaVisita(appointment)}.`;
  }

  const modalidade = appointment.modality ? ` de ${appointment.modality}` : '';
  const aulas = appointment.quantity ?? 1;
  const professor = comProfessor(appointment);
  if (aulas > 1) {
    const sujeito = isWard
      ? `As ${aulas} aulas experimentais${modalidade}${deQuem}`
      : `Suas ${aulas} aulas experimentais${modalidade}`;
    return `${abertura} ${sujeito} começam ${quando}${professor}.`;
  }
  const sujeito = isWard ? `A aula experimental${modalidade}${deQuem}` : `Sua aula experimental${modalidade}`;
  return `${abertura} ${sujeito} ficou para ${quando}${professor}.`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test`
Expected: typecheck limpo e PASS, com os quinze testes novos do texto (569 no total). O primeiro deles, "o processo roda em UTC neste arquivo", prova que os outros rodaram fora do fuso de Brasília.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-appointment-text.ts backend/src/services/crm-appointment-text.test.ts
git commit -m "feat: texto da confirmação do agendamento no horário de Brasília

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `crm-conversation.service.ts`, as portas saem do cadastro para um lugar só

**Files:**
- Create: `backend/src/services/crm-conversation.service.ts`
- Modify: `backend/src/services/crm-lead.service.ts` (o arquivo inteiro, 289 linhas)
- Test: `backend/src/services/crm-lead.service.test.ts` (não muda: é a prova de que o cadastro continua igual)

Refatoração sem mudar comportamento. O que o cadastro e o agendamento dividem sai de `crm-lead.service.ts`: as portas (`alvoDoCadastro` vira `crmConversationTarget`, com os textos de recusa por parâmetro), o corpo das falhas (`respostaDeFalha` vira `crmFailureReply`), o fim comum quando o cartão novo chega (`aplicarCartao` vira `applyCrmCard`) e as dependências reais de banco, acesso, cache, cobertura, nome e socket. O cadastro continua exportando os mesmos nomes, com os mesmos valores.

- [ ] **Step 1: Conferir que o cadastro está verde antes de mexer**

Run: `cd backend && npm test`
Expected: PASS (569 testes depois da Task 3), com os 21 de `crm-lead.service.test.ts`.

- [ ] **Step 2: Criar `backend/src/services/crm-conversation.service.ts`**

```ts
// O que as rotas da conversa que falam com o Stronilead dividem: o cadastro de
// lead (crm-lead.service.ts) e o agendamento (crm-schedule.service.ts).
//
// As portas, na mesma ordem para as duas: superadmin, sessão emprestada,
// acesso à conversa e contato de WhatsApp com número. Depois, o mesmo corpo
// para as falhas que não são regra do Stronilead e o mesmo fim quando um
// cartão novo chega: cache, cobertura, nome do cadastro e o aviso na sala do
// canal. Cada rota escreve os próprios textos de recusa.
import { prisma } from '../lib/prisma';
import { emitToChannel } from '../lib/socket-emitter';
import type { RequestUser } from '../lib/jwt';
import { HttpError } from '../middleware/errorHandler';
import { crmCache, type CrmCache, type CrmCard, type CrmLeadFailure } from './crm.service';
import { hasRealPhone, syncCrmName, type ContatoParaSync } from './crm-name.service';
import { registrarCoberturaDoCartao } from './crm-coverage.service';

/**
 * Status e texto das falhas que não são regra do Stronilead. Nunca 401: o
 * `api.ts` do front trata 401 como sessão vencida e renovaria o token.
 */
export const CRM_FAILURE_REPLY = {
  desligado: { status: 412, error: 'A integração com o Stronilead está desligada nesta organização.' },
  chave_invalida: {
    status: 502,
    error: 'O Stronilead recusou a chave desta organização. O admin confere em Configurações → Stronilead.',
  },
  indisponivel: { status: 503, error: 'Não deu para falar com o Stronilead agora.' },
} as const;

/** Status e corpo prontos: a rota só escreve. */
export interface CrmReply {
  status: number;
  body: unknown;
}

/** Quem pede: o `req.user` da sessão. */
export type CrmConversationViewer = Pick<RequestUser, 'sub' | 'email' | 'role' | 'orgId' | 'imp'>;

/** A conversa, o canal e o contato que as rotas usam. */
export interface CrmConversationTarget {
  conversationId: string;
  channelType: string;
  channelName: string;
  contact: ContatoParaSync;
}

/** O que cada rota diz quando recusa nas portas. */
export interface CrmGateMessages {
  superadmin: string;
  impersonation: string;
  noPhone: string;
}

/**
 * Tudo que as portas e o fim comum usam de fora. Entra por parâmetro com o
 * valor real como padrão, no molde do crm.service.ts e do rewrite.service.ts:
 * o teste passa as versões dele sem banco, sem rede e sem mock de módulo.
 */
export interface CrmConversationDeps {
  /** Lança 404 (conversa inexistente ou de outra organização) ou 403 (sem acesso ao canal). */
  assertAccess: (
    conversationId: string,
    viewerId: string,
    viewerRole: string,
    viewerOrgId: string | null,
  ) => Promise<unknown>;
  loadTarget: (conversationId: string, organizationId: string) => Promise<CrmConversationTarget | null>;
  /** Nome do colaborador no cadastro do Stronizap. */
  loadActorName: (collaboratorId: string, organizationId: string) => Promise<string | null>;
  cache: CrmCache;
  /** Marca `crmFound` no contato. Nunca lança. */
  registrarCobertura: (contactId: string, card: CrmCard) => Promise<void>;
  /** Grava o nome do cadastro e avisa pelo `contact_updated`. Nunca lança. */
  syncName: (contato: ContatoParaSync, card: CrmCard) => Promise<unknown>;
  emit: (channelId: string, event: string, payload: unknown) => void;
}

export const crmConversationDeps: CrmConversationDeps = {
  assertAccess: async (conversationId, viewerId, viewerRole, viewerOrgId) => {
    // Import tardio: o conversation.service carrega o Baileys, que o tsx dos
    // testes não consegue carregar. Mesmo motivo do rewrite.service.ts.
    const { assertCanAccessConversation } = await import('./conversation.service');
    return assertCanAccessConversation(conversationId, viewerId, viewerRole, viewerOrgId);
  },
  loadTarget: async (conversationId, organizationId) => {
    const conversa = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: {
        id: true,
        channel: { select: { type: true, name: true } },
        contact: {
          select: {
            id: true,
            organizationId: true,
            channelId: true,
            phone: true,
            jidSuffix: true,
            displayName: true,
          },
        },
      },
    });
    if (!conversa) return null;
    return {
      conversationId: conversa.id,
      channelType: conversa.channel.type,
      channelName: conversa.channel.name,
      contact: conversa.contact,
    };
  },
  loadActorName: async (collaboratorId, organizationId) => {
    const colaborador = await prisma.collaborator.findFirst({
      where: { id: collaboratorId, organizationId },
      select: { name: true },
    });
    return colaborador?.name.trim() || null;
  },
  cache: crmCache,
  registrarCobertura: (contactId, card) => registrarCoberturaDoCartao(contactId, { card, reason: null }),
  syncName: (contato, card) => syncCrmName(contato, { card, reason: null }),
  emit: emitToChannel,
};

/**
 * As portas, nesta ordem. Superadmin primeiro, porque `isSameTenant(null, X)`
 * deixaria ele passar em qualquer organização. Sessão emprestada em seguida:
 * o registro nasceria em nome do admin impersonado. Depois o acesso à
 * conversa, e por fim o contato: Instagram e LID guardam um id no lugar do
 * telefone, e o casamento do CRM aceitaria esse id como número.
 */
export async function crmConversationTarget(
  conversationId: string,
  viewer: CrmConversationViewer,
  d: Pick<CrmConversationDeps, 'assertAccess' | 'loadTarget'>,
  messages: CrmGateMessages,
): Promise<{ organizationId: string; target: CrmConversationTarget }> {
  const organizationId = viewer.orgId;
  if (organizationId === null) throw new HttpError(403, messages.superadmin, 'superadmin');
  if (viewer.imp) throw new HttpError(403, messages.impersonation, 'impersonacao');

  await d.assertAccess(conversationId, viewer.sub, viewer.role, organizationId);

  const target = await d.loadTarget(conversationId, organizationId);
  if (!target) throw new HttpError(404, 'Conversa não encontrada');
  if (target.channelType !== 'WHATSAPP' || !hasRealPhone(target.contact)) {
    throw new HttpError(422, messages.noPhone, 'sem_numero');
  }
  return { organizationId, target };
}

/**
 * Corpo único para o navegador: `error` é o texto para a tela e `code`, o
 * código. Recusa do Stronilead leva o texto dela, e o campo, o cartão e a
 * data quando vierem.
 */
export function crmFailureReply(falha: CrmLeadFailure): CrmReply {
  if (falha.kind === 'recusa') {
    const body: Record<string, unknown> = { error: falha.message, code: falha.code };
    if (falha.field) body.field = falha.field;
    if (falha.card) body.card = falha.card;
    if (falha.createdAt) body.createdAt = falha.createdAt;
    return { status: falha.status, body };
  }
  const { status, error } = CRM_FAILURE_REPLY[falha.kind];
  return { status, body: { error, code: falha.kind } };
}

/**
 * O cartão novo vale para todo mundo na hora: cache (senão a rota do cartão
 * devolveria o cartão velho por até dois minutos), cobertura do painel, nome
 * do contato e o aviso na sala do canal, a mesma do `contact_updated`, para
 * quem não tem acesso ao canal não receber cartão de contato que não abre.
 */
export async function applyCrmCard(
  target: CrmConversationTarget,
  card: CrmCard,
  d: Pick<CrmConversationDeps, 'cache' | 'registrarCobertura' | 'syncName' | 'emit'>,
): Promise<void> {
  const contato = target.contact;
  d.cache.replaceCard(contato.organizationId, contato.phone, card);
  await d.registrarCobertura(contato.id, card);
  await d.syncName(contato, card);
  d.emit(contato.channelId, 'crm_card_updated', { contactId: contato.id, card });
}
```

- [ ] **Step 3: Trocar o conteúdo inteiro de `backend/src/services/crm-lead.service.ts` por:**

```ts
// Cadastro de lead no Stronilead a partir da conversa. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md.
//
// As duas rotas da conversa (GET /:id/crm-lead-options e POST /:id/crm-lead)
// passam por aqui. As portas, o corpo das falhas e o que acontece quando o
// cartão novo chega moram em crm-conversation.service.ts, divididos com o
// agendamento. Este arquivo tem o que é só do cadastro: os textos de recusa,
// o schema do corpo e as duas chamadas ao CRM, pelo crm.service.ts, o único
// que conhece a chave.
//
// Quem cadastrou sai da sessão (e-mail) e do cadastro do colaborador (nome),
// nunca do corpo do pedido: o schema daqui só aceita o bloco `lead`.
import { z } from 'zod';
import { logger } from '../lib/logger';
import { HttpError } from '../middleware/errorHandler';
import {
  createCrmLead,
  fetchCrmLeadOptions,
  type CrmCard,
  type CrmCreateLeadRequest,
  type CrmLeadCall,
  type CrmLeadInput,
  type CrmLeadOptions,
} from './crm.service';
import {
  applyCrmCard,
  CRM_FAILURE_REPLY,
  crmConversationDeps,
  crmConversationTarget,
  crmFailureReply,
  type CrmConversationDeps,
  type CrmConversationTarget,
  type CrmConversationViewer,
  type CrmGateMessages,
  type CrmReply,
} from './crm-conversation.service';

export const SUPERADMIN_MESSAGE = 'O superadmin não cadastra lead no Stronilead.';
export const IMPERSONATION_MESSAGE =
  'Entrando como admin pelo painel do superadmin não dá para cadastrar lead no Stronilead.';
export const NO_PHONE_MESSAGE =
  'O cadastro pelo Stronizap vale só para contato de WhatsApp com número.';

/** Status e texto das falhas que não são regra do Stronilead (ver crm-conversation.service.ts). */
export const LEAD_FAILURE_REPLY = CRM_FAILURE_REPLY;

/** Status e corpo prontos: a rota só escreve. */
export type CrmLeadReply = CrmReply;

/** Quem pede: o `req.user` da sessão. */
export type CrmLeadViewer = CrmConversationViewer;

/** A conversa, o canal e o contato que o cadastro usa. */
export type CrmLeadTarget = CrmConversationTarget;

/**
 * Tudo que o serviço usa de fora: as dependências das portas e do cartão
 * (crm-conversation.service.ts) mais as duas chamadas do cadastro.
 */
export interface CrmLeadDeps extends CrmConversationDeps {
  fetchOptions: (organizationId: string, actorEmail: string) => Promise<CrmLeadCall<CrmLeadOptions>>;
  createLead: (
    organizationId: string,
    request: CrmCreateLeadRequest,
  ) => Promise<CrmLeadCall<{ card: CrmCard }>>;
  log: Pick<typeof logger, 'info'>;
}

const depsReais: CrmLeadDeps = {
  ...crmConversationDeps,
  fetchOptions: (organizationId, actorEmail) => fetchCrmLeadOptions(organizationId, actorEmail),
  createLead: (organizationId, request) => createCrmLead(organizationId, request),
  log: logger,
};

const PORTAS: CrmGateMessages = {
  superadmin: SUPERADMIN_MESSAGE,
  impersonation: IMPERSONATION_MESSAGE,
  noPhone: NO_PHONE_MESSAGE,
};

const nomeDePessoa = z.string().trim().min(2).max(120);
const itemDeLista = z.string().trim().min(1).max(120);

/**
 * Corpo do POST /conversations/:id/crm-lead. Só o bloco `lead`: o que vier a
 * mais (quem cadastrou, telefone, tenant, canal) o zod descarta, e o serviço
 * monta com o que a sessão, o banco e a conversa dizem. As listas são
 * conferidas de verdade pelo Stronilead, contra o catálogo dele.
 */
export const crmLeadBodySchema = z.object({
  lead: z.object({
    name: nomeDePessoa,
    source: itemDeLista,
    dor: itemDeLista,
    modalidade: itemDeLista.nullable(),
    funnelId: itemDeLista,
    stage: itemDeLista,
    ownerId: z.string().trim().min(1).max(128).nullable(),
    minor: z
      .object({
        guardianName: nomeDePessoa,
        relationship: z.string().trim().min(1).max(40).nullable(),
        studentWhatsapp: z.string().regex(/^\d{10,13}$/).nullable(),
      })
      .nullable(),
    // O mesmo limite que o Stronilead confere (api/_zapLead.js, NOTE_MAX).
    observacao: z.string().trim().max(1000).nullish(),
  }),
});

/** GET /conversations/:id/crm-lead-options. */
export async function getCrmLeadOptions(
  conversationId: string,
  viewer: CrmLeadViewer,
  deps: Partial<CrmLeadDeps> = {},
): Promise<CrmLeadReply> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await crmConversationTarget(conversationId, viewer, d, PORTAS);
  const call = await d.fetchOptions(organizationId, viewer.email);
  if (call.ok) return { status: 200, body: call.value };
  // Chave recusada: o "Sem cadastro" guardado some, e a próxima leitura do
  // cartão vai ao CRM, que responde como a rota do cartão sempre respondeu.
  if (call.kind === 'chave_invalida') d.cache.forget(organizationId, target.contact.phone);
  return crmFailureReply(call);
}

/** POST /conversations/:id/crm-lead. */
export async function createCrmLeadFromConversation(
  conversationId: string,
  viewer: CrmLeadViewer,
  lead: CrmLeadInput,
  deps: Partial<CrmLeadDeps> = {},
): Promise<CrmLeadReply> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await crmConversationTarget(conversationId, viewer, d, PORTAS);

  const actorName = await d.loadActorName(viewer.sub, organizationId);
  if (!actorName) throw new HttpError(404, 'Colaborador não encontrado');

  const call = await d.createLead(organizationId, {
    phone: target.contact.phone,
    actor: { email: viewer.email, name: actorName },
    channelName: target.channelName,
    lead,
  });

  if (call.ok) {
    await applyCrmCard(target, call.value.card, d);
    // Só ids no log: nome e telefone da pessoa ficam fora.
    d.log.info(
      { organizationId, conversationId, contactId: target.contact.id },
      'Lead cadastrado no Stronilead pelo Stronizap',
    );
    return { status: 201, body: { card: call.value.card } };
  }

  // Número que já estava no CRM: o cartão que veio é o de verdade, e a tela
  // de todo mundo passa a mostrá-lo, igual a um cadastro novo.
  if (call.kind === 'recusa' && call.code === 'ja_cadastrado' && call.card) {
    await applyCrmCard(target, call.card, d);
  }
  if (call.kind === 'chave_invalida') d.cache.forget(organizationId, target.contact.phone);
  return crmFailureReply(call);
}
```

- [ ] **Step 4: Rodar e ver continuar verde, com o teste do cadastro intocado**

```bash
cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test
git diff --stat -- src/services/crm-lead.service.test.ts
```

Expected: typecheck limpo, PASS com os mesmos 569 testes (os 21 do cadastro entre eles), e o `git diff` sem nenhuma linha: o arquivo de teste do cadastro não mudou.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-conversation.service.ts backend/src/services/crm-lead.service.ts
git commit -m "refactor: portas das rotas do Stronilead num lugar só, para o agendamento usar as mesmas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `crm-schedule.service.ts`, as portas, o agendamento e a confirmação

**Files:**
- Create: `backend/src/services/crm-schedule.service.ts`
- Create: `backend/src/services/crm-schedule.service.test.ts`

O serviço que as duas rotas chamam. Mesmas portas do cadastro, com os textos do agendamento. Quem agendou sai da sessão (`viewer.email`) e do colaborador (nome); telefone e canal saem da conversa. No sucesso (e no `ja_agendado`), o cartão é aplicado pelo `applyCrmCard` e a resposta leva o texto da confirmação pronto. É aqui que o PR 3 cria o lembrete.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/crm-schedule.service.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../middleware/errorHandler';
import {
  CrmCache,
  crmCacheKey,
  type CrmAppointmentDetail,
  type CrmCard,
  type CrmLeadCall,
  type CrmScheduled,
  type CrmScheduleOptions,
  type CrmScheduleRequest,
} from './crm.service';
import type { ContatoParaSync } from './crm-name.service';
import { CRM_FAILURE_REPLY, type CrmConversationTarget, type CrmConversationViewer } from './crm-conversation.service';
import {
  crmScheduleBodySchema,
  loadScheduleOptions,
  SCHEDULE_IMPERSONATION_MESSAGE,
  SCHEDULE_NO_PHONE_MESSAGE,
  SCHEDULE_SUPERADMIN_MESSAGE,
  scheduleCrmAppointment,
  type CrmScheduleBody,
  type CrmScheduleDeps,
} from './crm-schedule.service';

// Acesso, banco, CRM, cache, cobertura, nome, socket e relógio entram por
// parâmetro (ver `CrmScheduleDeps`), no molde do crm-lead.service.test.ts.

const CONTATO: ContatoParaSync = {
  id: 'contato-1',
  organizationId: 'org1',
  channelId: 'canal-1',
  phone: '5551998124471',
  jidSuffix: null,
  displayName: 'Mari',
};

const ALVO: CrmConversationTarget = {
  conversationId: 'conv-1',
  channelType: 'WHATSAPP',
  channelName: 'Recepção',
  contact: CONTATO,
};

const ATENDENTE: CrmConversationViewer = {
  sub: 'colab-ana',
  email: 'ana@academia.com',
  role: 'ATENDENTE',
  orgId: 'org1',
};

const CORPO: CrmScheduleBody = {
  schedule: {
    leadId: 'L1',
    type: 'visita',
    unit: 'Centro',
    modality: null,
    professorId: null,
    soloTraining: false,
    quantity: null,
    date: '2026-10-01',
    time: '18:00',
    note: 'Vem depois do trabalho.',
  },
};

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

const CARTAO: CrmCard = {
  found: true,
  leadId: 'L1',
  kind: 'lead',
  name: 'Mariana Lima',
  stage: 'Primeiro contato',
  source: 'Instagram',
  consultantName: 'Ana Souza',
  strip: null,
  appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null },
};

const OPCOES: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [{ leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null }],
  units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }],
  modalities: [{ id: 'm1', name: 'Pilates' }],
  professors: [{ id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] }],
  trialClassOptions: [1, 2, 3],
  days: [{ date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' }],
};

/** Terça, 29/09, às 15:40 de Brasília. */
const AGORA = new Date('2026-09-29T18:40:00.000Z');

interface Ambiente {
  deps: CrmScheduleDeps;
  acessos: unknown[][];
  pedidosDeOpcoes: Array<{ organizationId: string; phone: string; actorEmail: string }>;
  agendamentos: Array<{ organizationId: string; request: CrmScheduleRequest }>;
  coberturas: Array<{ contactId: string; card: CrmCard }>;
  nomes: Array<{ contato: ContatoParaSync; card: CrmCard }>;
  eventos: Array<{ channelId: string; event: string; payload: unknown }>;
  cache: CrmCache;
}

function ambiente(
  opts: {
    acesso?: HttpError;
    alvo?: CrmConversationTarget | null;
    nome?: string | null;
    opcoes?: CrmLeadCall<CrmScheduleOptions>;
    agendamento?: CrmLeadCall<CrmScheduled>;
  } = {},
): Ambiente {
  const acessos: unknown[][] = [];
  const pedidosDeOpcoes: Ambiente['pedidosDeOpcoes'] = [];
  const agendamentos: Ambiente['agendamentos'] = [];
  const coberturas: Ambiente['coberturas'] = [];
  const nomes: Ambiente['nomes'] = [];
  const eventos: Ambiente['eventos'] = [];
  const cache = new CrmCache();
  return {
    acessos,
    pedidosDeOpcoes,
    agendamentos,
    coberturas,
    nomes,
    eventos,
    cache,
    deps: {
      assertAccess: async (...args) => {
        acessos.push(args);
        if (opts.acesso) throw opts.acesso;
      },
      loadTarget: async () => (opts.alvo === undefined ? ALVO : opts.alvo),
      loadActorName: async () => (opts.nome === undefined ? 'Ana Souza' : opts.nome),
      fetchScheduleOptions: async (organizationId, phone, actorEmail) => {
        pedidosDeOpcoes.push({ organizationId, phone, actorEmail });
        return opts.opcoes ?? { ok: true, value: OPCOES };
      },
      createAppointment: async (organizationId, request) => {
        agendamentos.push({ organizationId, request });
        return opts.agendamento ?? { ok: true, value: { card: CARTAO, appointment: VISITA, alreadyScheduled: false } };
      },
      cache,
      registrarCobertura: async (contactId, card) => {
        coberturas.push({ contactId, card });
      },
      syncName: async (contato, card) => {
        nomes.push({ contato, card });
      },
      emit: (channelId, event, payload) => {
        eventos.push({ channelId, event, payload });
      },
      agora: () => AGORA,
      log: { info: () => {} },
    },
  };
}

// ── Portas ──────────────────────────────────────────────────────────────────

test('papel: superadmin é recusado antes de olhar a conversa, nas duas rotas', async () => {
  const amb = ambiente();
  const superadmin: CrmConversationViewer = { ...ATENDENTE, role: 'SUPERADMIN', orgId: null };

  await assert.rejects(loadScheduleOptions('conv-1', superadmin, amb.deps), {
    statusCode: 403,
    code: 'superadmin',
    message: SCHEDULE_SUPERADMIN_MESSAGE,
  });
  await assert.rejects(scheduleCrmAppointment('conv-1', superadmin, CORPO, amb.deps), {
    statusCode: 403,
    code: 'superadmin',
  });
  assert.equal(amb.acessos.length + amb.pedidosDeOpcoes.length + amb.agendamentos.length, 0);
});

test('impersonação: a sessão do superadmin entrando como admin é recusada', async () => {
  const amb = ambiente();
  const emprestada: CrmConversationViewer = { ...ATENDENTE, role: 'ADMIN', imp: { byId: 'sa-1' } };

  await assert.rejects(loadScheduleOptions('conv-1', emprestada, amb.deps), {
    statusCode: 403,
    code: 'impersonacao',
    message: SCHEDULE_IMPERSONATION_MESSAGE,
  });
  await assert.rejects(scheduleCrmAppointment('conv-1', emprestada, CORPO, amb.deps), {
    statusCode: 403,
    code: 'impersonacao',
  });
  assert.equal(amb.acessos.length + amb.agendamentos.length, 0);
});

test('papel: admin, gestor e atendente com acesso ao canal chegam ao Stronilead', async () => {
  for (const role of ['ADMIN', 'GESTOR', 'ATENDENTE'] as const) {
    const amb = ambiente();
    const r = await loadScheduleOptions('conv-1', { ...ATENDENTE, role }, amb.deps);
    assert.equal(r.status, 200, role);
    assert.deepEqual(amb.acessos, [['conv-1', 'colab-ana', role, 'org1']]);
  }
});

test('organização alheia e canal sem acesso: o erro do acesso sobe e nada vai ao CRM', async () => {
  const alheia = ambiente({ acesso: new HttpError(404, 'Conversa não encontrada') });
  await assert.rejects(loadScheduleOptions('conv-b', ATENDENTE, alheia.deps), { statusCode: 404 });
  await assert.rejects(scheduleCrmAppointment('conv-b', ATENDENTE, CORPO, alheia.deps), { statusCode: 404 });

  const semCanal = ambiente({ acesso: new HttpError(403, 'Você não tem acesso ao canal desta conversa') });
  await assert.rejects(loadScheduleOptions('conv-1', ATENDENTE, semCanal.deps), { statusCode: 403 });
  await assert.rejects(scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, semCanal.deps), { statusCode: 403 });

  assert.equal(
    alheia.pedidosDeOpcoes.length + alheia.agendamentos.length + semCanal.pedidosDeOpcoes.length + semCanal.agendamentos.length,
    0,
  );
});

test('contato sem número (LID) e de Instagram são recusados com 422', async () => {
  const alvos: CrmConversationTarget[] = [
    { ...ALVO, contact: { ...CONTATO, jidSuffix: 'lid' } },
    { ...ALVO, channelType: 'INSTAGRAM', contact: { ...CONTATO, jidSuffix: 'ig' } },
    { ...ALVO, channelType: 'INSTAGRAM' },
  ];
  for (const alvo of alvos) {
    const amb = ambiente({ alvo });
    await assert.rejects(loadScheduleOptions('conv-1', ATENDENTE, amb.deps), {
      statusCode: 422,
      code: 'sem_numero',
      message: SCHEDULE_NO_PHONE_MESSAGE,
    });
    await assert.rejects(scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps), { statusCode: 422 });
    assert.equal(amb.pedidosDeOpcoes.length + amb.agendamentos.length, 0);
  }
});

test('integração desligada vira 412 com o código desligado, nas duas rotas', async () => {
  const amb = ambiente({ opcoes: { ok: false, kind: 'desligado' }, agendamento: { ok: false, kind: 'desligado' } });
  const esperado = { status: 412, body: { error: CRM_FAILURE_REPLY.desligado.error, code: 'desligado' } };

  assert.deepEqual(await loadScheduleOptions('conv-1', ATENDENTE, amb.deps), esperado);
  assert.deepEqual(await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps), esperado);
});

// ── Opções ─────────────────────────────────────────────────────────────────

test('opções: 200 com as opções, pedidas com o número do contato e o e-mail da sessão', async () => {
  const amb = ambiente();

  assert.deepEqual(await loadScheduleOptions('conv-1', ATENDENTE, amb.deps), { status: 200, body: OPCOES });
  assert.deepEqual(amb.pedidosDeOpcoes, [
    { organizationId: 'org1', phone: '5551998124471', actorEmail: 'ana@academia.com' },
  ]);
});

test('opções: chave recusada esquece o cartão guardado do número e responde 502', async () => {
  const amb = ambiente({ opcoes: { ok: false, kind: 'chave_invalida' } });
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), CARTAO);

  assert.deepEqual(await loadScheduleOptions('conv-1', ATENDENTE, amb.deps), {
    status: 502,
    body: { error: CRM_FAILURE_REPLY.chave_invalida.error, code: 'chave_invalida' },
  });
  assert.equal(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), undefined);
});

test('opções: fora da equipe vai com o status, o código e o texto do Stronilead', async () => {
  const message = 'Seu e-mail do Stronizap, ana@academia.com, não está na equipe do Stronilead.';
  const amb = ambiente({
    opcoes: { ok: false, kind: 'recusa', status: 403, code: 'fora_da_equipe', message, field: null, card: null, createdAt: null },
  });

  assert.deepEqual(await loadScheduleOptions('conv-1', ATENDENTE, amb.deps), {
    status: 403,
    body: { error: message, code: 'fora_da_equipe' },
  });
});

test('opções: Stronilead fora do ar é 503', async () => {
  const amb = ambiente({ opcoes: { ok: false, kind: 'indisponivel' } });

  assert.deepEqual(await loadScheduleOptions('conv-1', ATENDENTE, amb.deps), {
    status: 503,
    body: { error: CRM_FAILURE_REPLY.indisponivel.error, code: 'indisponivel' },
  });
});

// ── Agendar ────────────────────────────────────────────────────────────────

test('agendar: quem agendou sai da sessão e do colaborador; telefone e canal, da conversa', async () => {
  const amb = ambiente({ nome: 'Ana Souza' });

  await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.deepEqual(amb.agendamentos, [
    {
      organizationId: 'org1',
      request: {
        phone: '5551998124471',
        actor: { email: 'ana@academia.com', name: 'Ana Souza' },
        channelName: 'Recepção',
        schedule: CORPO.schedule,
      },
    },
  ]);
});

test('agendar: deu certo, 201 com o cartão, o agendamento e a confirmação, e os quatro passos do cartão', async () => {
  const amb = ambiente();
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), { found: true, kind: 'lead', name: 'Mariana Lima' });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.deepEqual(r, {
    status: 201,
    body: {
      card: CARTAO,
      appointment: VISITA,
      alreadyScheduled: false,
      confirmationText:
        'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
    },
  });
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), CARTAO);
  assert.deepEqual(amb.coberturas, [{ contactId: 'contato-1', card: CARTAO }]);
  assert.deepEqual(amb.nomes, [{ contato: CONTATO, card: CARTAO }]);
  assert.deepEqual(amb.eventos, [
    { channelId: 'canal-1', event: 'crm_card_updated', payload: { contactId: 'contato-1', card: CARTAO } },
  ]);
});

test('agendar: ja_agendado é sucesso para a tela, com 200, a confirmação e os mesmos quatro passos', async () => {
  const amb = ambiente({ agendamento: { ok: true, value: { card: CARTAO, appointment: VISITA, alreadyScheduled: true } } });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.equal(r.status, 200);
  assert.equal((r.body as { alreadyScheduled: boolean }).alreadyScheduled, true);
  assert.match((r.body as { confirmationText: string }).confirmationText, /^Combinado, Mariana! Sua visita/);
  assert.equal(amb.coberturas.length + amb.nomes.length + amb.eventos.length, 3);
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), CARTAO);
});

test('agendar: agendamento de um menor sai com o nome do menor, e a saudação é para o responsável', async () => {
  const PEDRO: CrmAppointmentDetail = { ...VISITA, leadId: 'L2', leadName: 'Pedro Lima' };
  const RESPONSAVEL: CrmCard = {
    found: true,
    kind: 'responsavel',
    name: 'Mariana Lima',
    wards: [{ leadId: 'L2', kind: 'lead', name: 'Pedro Lima', relationship: 'Mãe', appointment: null, strip: null }],
  };
  const amb = ambiente({ agendamento: { ok: true, value: { card: RESPONSAVEL, appointment: PEDRO, alreadyScheduled: false } } });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.equal(
    (r.body as { confirmationText: string }).confirmationText,
    'Combinado, Mariana! A visita de Pedro ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
  );
});

test('agendar: cartão sem nome usa o nome que o contato já tinha', async () => {
  const semNome: CrmCard = { ...CARTAO, name: null };
  const amb = ambiente({ agendamento: { ok: true, value: { card: semNome, appointment: VISITA, alreadyScheduled: false } } });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.match((r.body as { confirmationText: string }).confirmationText, /^Combinado, Mari! /);
});

test('agendar: recusa do Stronilead não troca cartão, não grava nada e não avisa ninguém', async () => {
  const message = 'Essa unidade não existe mais no Stronilead. Escolha de novo.';
  const amb = ambiente({
    agendamento: { ok: false, kind: 'recusa', status: 422, code: 'catalogo_mudou', message, field: 'unit', card: null, createdAt: null },
  });
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), { found: true, kind: 'lead', name: 'Mariana Lima' });

  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps);

  assert.deepEqual(r, { status: 422, body: { error: message, code: 'catalogo_mudou', field: 'unit' } });
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), { found: true, kind: 'lead', name: 'Mariana Lima' });
  assert.equal(amb.coberturas.length + amb.nomes.length + amb.eventos.length, 0);
});

test('agendar: Stronilead fora do ar é 503, e chave recusada é 502 e esquece o cartão', async () => {
  const foraDoAr = ambiente({ agendamento: { ok: false, kind: 'indisponivel' } });
  assert.deepEqual(await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, foraDoAr.deps), {
    status: 503,
    body: { error: CRM_FAILURE_REPLY.indisponivel.error, code: 'indisponivel' },
  });
  assert.equal(foraDoAr.eventos.length, 0);

  const semChave = ambiente({ agendamento: { ok: false, kind: 'chave_invalida' } });
  semChave.cache.set(crmCacheKey('org1', CONTATO.phone), CARTAO);
  const r = await scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, semChave.deps);
  assert.equal(r.status, 502);
  assert.equal(semChave.cache.get(crmCacheKey('org1', CONTATO.phone)), undefined);
});

test('agendar: colaborador que não existe mais é 404 e nada vai ao CRM', async () => {
  const amb = ambiente({ nome: null });

  await assert.rejects(scheduleCrmAppointment('conv-1', ATENDENTE, CORPO, amb.deps), { statusCode: 404 });
  assert.equal(amb.agendamentos.length, 0);
});

// ── Corpo do pedido ────────────────────────────────────────────────────────

test('schema: só o bloco schedule passa; quem agendou, telefone, tenant e canal vindos do navegador caem', () => {
  const corpo = crmScheduleBodySchema.parse({
    schedule: { ...CORPO.schedule, phone: '5511999999999', actor: { email: 'outra@academia.com' } },
    actor: { email: 'outra@academia.com', name: 'Outra' },
    phone: '5511999999999',
    tenant: 'outra-academia',
    channelName: 'Outro',
  });

  assert.deepEqual(corpo, CORPO);
});

test('schema: anotação aparada, vazia vira null, e passa de 1.000 caracteres é recusada', () => {
  const aparada = crmScheduleBodySchema.parse({ schedule: { ...CORPO.schedule, note: '  Vem de bicicleta.  ' } });
  assert.equal(aparada.schedule.note, 'Vem de bicicleta.');
  assert.equal(crmScheduleBodySchema.parse({ schedule: { ...CORPO.schedule, note: '   ' } }).schedule.note, null);
  assert.equal(crmScheduleBodySchema.parse({ schedule: { ...CORPO.schedule, note: null } }).schedule.note, null);
  assert.equal(crmScheduleBodySchema.safeParse({ schedule: { ...CORPO.schedule, note: 'x'.repeat(1001) } }).success, false);
});

test('schema: tipo fora da lista, data e hora fora do formato e quantidade quebrada são recusados', () => {
  for (const errado of [
    { type: 'ligacao' },
    { date: '01/10/2026' },
    { time: '18h' },
    { time: '24:00' },
    { quantity: 1.5 },
    { quantity: 0 },
    { leadId: '' },
  ]) {
    assert.equal(crmScheduleBodySchema.safeParse({ schedule: { ...CORPO.schedule, ...errado } }).success, false, JSON.stringify(errado));
  }
  assert.equal(
    crmScheduleBodySchema.safeParse({
      schedule: { ...CORPO.schedule, type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', quantity: 2 },
    }).success,
    true,
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `Cannot find module './crm-schedule.service'`.

- [ ] **Step 3: Implementar**

Criar `backend/src/services/crm-schedule.service.ts`:

```ts
// Agendamento de visita e aula experimental no Stronilead a partir da
// conversa. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "No Stronizap: o agendamento (PR 2)".
//
// As duas rotas (GET /:id/crm-schedule-options e POST /:id/crm-schedule)
// passam pelas mesmas portas do cadastro (crm-conversation.service.ts), e o
// cartão que volta é aplicado do mesmo jeito. O que é só do agendamento mora
// aqui: os textos de recusa, o schema do corpo e o texto da confirmação, que
// sai de crm-appointment-text.ts.
//
// Quem agendou sai da sessão (e-mail) e do cadastro do colaborador (nome),
// nunca do corpo. O `tenant`, o `phone` e o `channelName` também saem do
// servidor: a integração da organização, o contato e o canal da conversa.
import { z } from 'zod';
import { logger } from '../lib/logger';
import { HttpError } from '../middleware/errorHandler';
import {
  createCrmAppointment,
  fetchCrmScheduleOptions,
  type CrmAppointmentDetail,
  type CrmCard,
  type CrmLeadCall,
  type CrmScheduled,
  type CrmScheduleOptions,
  type CrmScheduleRequest,
} from './crm.service';
import { nomeDoCartao } from './crm-name.service';
import { buildConfirmationText } from './crm-appointment-text';
import {
  applyCrmCard,
  crmConversationDeps,
  crmConversationTarget,
  crmFailureReply,
  type CrmConversationDeps,
  type CrmConversationViewer,
  type CrmGateMessages,
  type CrmReply,
} from './crm-conversation.service';

export const SCHEDULE_SUPERADMIN_MESSAGE = 'O superadmin não agenda no Stronilead.';
export const SCHEDULE_IMPERSONATION_MESSAGE =
  'Entrando como admin pelo painel do superadmin não dá para agendar no Stronilead.';
export const SCHEDULE_NO_PHONE_MESSAGE =
  'O agendamento pelo Stronizap vale só para contato de WhatsApp com número.';

const PORTAS: CrmGateMessages = {
  superadmin: SCHEDULE_SUPERADMIN_MESSAGE,
  impersonation: SCHEDULE_IMPERSONATION_MESSAGE,
  noPhone: SCHEDULE_NO_PHONE_MESSAGE,
};

/**
 * Tudo que o serviço usa de fora: as dependências das portas e do cartão
 * (crm-conversation.service.ts), as duas chamadas do agendamento e o relógio.
 */
export interface CrmScheduleDeps extends CrmConversationDeps {
  fetchScheduleOptions: (
    organizationId: string,
    phone: string,
    actorEmail: string,
  ) => Promise<CrmLeadCall<CrmScheduleOptions>>;
  createAppointment: (organizationId: string, request: CrmScheduleRequest) => Promise<CrmLeadCall<CrmScheduled>>;
  /** Referência do "hoje" e do "amanhã" no texto da confirmação. */
  agora: () => Date;
  log: Pick<typeof logger, 'info'>;
}

const depsReais: CrmScheduleDeps = {
  ...crmConversationDeps,
  fetchScheduleOptions: (organizationId, phone, actorEmail) =>
    fetchCrmScheduleOptions(organizationId, phone, actorEmail),
  createAppointment: (organizationId, request) => createCrmAppointment(organizationId, request),
  agora: () => new Date(),
  log: logger,
};

const itemDeLista = z.string().trim().min(1).max(120);

/**
 * Corpo do POST /conversations/:id/crm-schedule: só o bloco `schedule`, que
 * vai ao Stronilead como veio. O que vier a mais (quem agendou, telefone,
 * tenant, canal) o zod descarta. Aqui só se confere o formato: quem decide se
 * a combinação vale (unidade na visita, professor ou "Treina sozinho" na
 * aula, horário no futuro) é o Stronilead, que recusa com o texto dele.
 *
 * O lembrete (PR 3) entra como um campo opcional `reminder` deste objeto, ao
 * lado de `schedule` e nunca dentro dele, porque `schedule` segue inteiro
 * para o Stronilead.
 */
export const crmScheduleBodySchema = z.object({
  schedule: z.object({
    leadId: z.string().trim().min(1).max(128),
    type: z.enum(['visita', 'aula_experimental']),
    unit: itemDeLista.nullable(),
    modality: itemDeLista.nullable(),
    professorId: z.string().trim().min(1).max(128).nullable(),
    soloTraining: z.boolean(),
    quantity: z.number().int().min(1).max(99).nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    // O mesmo limite que o Stronilead confere. Vazio vira null, como lá.
    note: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((v) => v || null),
  }),
});

/** O corpo já conferido. O PR 3 acrescenta `reminder` pelo schema. */
export type CrmScheduleBody = z.infer<typeof crmScheduleBodySchema>;

/**
 * O que o agendamento que deu certo devolve para o navegador. `alreadyScheduled`
 * é true quando o Stronilead respondeu `ja_agendado`: a tela trata como
 * sucesso, porque a gravação é a mesma.
 */
export interface CrmScheduleResult {
  card: CrmCard;
  appointment: CrmAppointmentDetail;
  confirmationText: string;
  alreadyScheduled: boolean;
}

/** O agendamento é de um menor de quem o número é responsável? */
function ehDeMenor(card: CrmCard, leadId: string): boolean {
  return Array.isArray(card.wards) && card.wards.some((w) => Boolean(w) && typeof w === 'object' && w.leadId === leadId);
}

/** GET /conversations/:id/crm-schedule-options. */
export async function loadScheduleOptions(
  conversationId: string,
  viewer: CrmConversationViewer,
  deps: Partial<CrmScheduleDeps> = {},
): Promise<CrmReply> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await crmConversationTarget(conversationId, viewer, d, PORTAS);
  const call = await d.fetchScheduleOptions(organizationId, target.contact.phone, viewer.email);
  if (call.ok) return { status: 200, body: call.value };
  // Chave recusada: o cartão guardado some, e a próxima leitura dele vai ao
  // CRM, que responde como a rota do cartão sempre respondeu.
  if (call.kind === 'chave_invalida') d.cache.forget(organizationId, target.contact.phone);
  return crmFailureReply(call);
}

/**
 * POST /conversations/:id/crm-schedule. Deu certo (ou `ja_agendado`): aplica o
 * cartão como o cadastro aplica e responde com o `CrmScheduleResult`, com o
 * texto da confirmação pronto. Falha: o corpo único das falhas.
 */
export async function scheduleCrmAppointment(
  conversationId: string,
  viewer: CrmConversationViewer,
  body: CrmScheduleBody,
  deps: Partial<CrmScheduleDeps> = {},
): Promise<CrmReply> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await crmConversationTarget(conversationId, viewer, d, PORTAS);

  const actorName = await d.loadActorName(viewer.sub, organizationId);
  if (!actorName) throw new HttpError(404, 'Colaborador não encontrado');

  const call = await d.createAppointment(organizationId, {
    phone: target.contact.phone,
    actor: { email: viewer.email, name: actorName },
    channelName: target.channelName,
    schedule: body.schedule,
  });

  if (!call.ok) {
    if (call.kind === 'chave_invalida') d.cache.forget(organizationId, target.contact.phone);
    return crmFailureReply(call);
  }

  const { card, appointment, alreadyScheduled } = call.value;
  await applyCrmCard(target, card, d);

  const result: CrmScheduleResult = {
    card,
    appointment,
    alreadyScheduled,
    // Quem recebe a confirmação é o contato: o nome do cadastro dele, que o
    // applyCrmCard acabou de gravar no contato, ou o nome que o contato já tinha.
    confirmationText: buildConfirmationText({
      contactName: nomeDoCartao(card) ?? target.contact.displayName,
      appointment,
      isWard: ehDeMenor(card, appointment.leadId),
      now: d.agora(),
    }),
  };

  // Lembrete (PR 3): é aqui que ele é criado ou trocado, depois do agendamento
  // gravado e do cartão aplicado, com `body`, `target`, `viewer` e `result` em
  // mãos. Falha do lembrete não desfaz o agendamento.

  // Só ids no log: nome, telefone e anotação da pessoa ficam fora.
  d.log.info(
    { organizationId, conversationId, contactId: target.contact.id, alreadyScheduled },
    'Agendamento feito no Stronilead pelo Stronizap',
  );
  return { status: alreadyScheduled ? 200 : 201, body: result };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test`
Expected: typecheck limpo e PASS, com os 21 testes novos do serviço (590 no total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-schedule.service.ts backend/src/services/crm-schedule.service.test.ts
git commit -m "feat: serviço do agendamento pela conversa, com as portas do cadastro e a confirmação pronta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Rotas da conversa e suíte de isolamento

**Files:**
- Modify: `backend/src/routes/conversations.routes.ts` (import na linha 13, rotas depois da rota `POST /:id/crm-lead`, que termina na linha 652)
- Modify: `backend/src/routes/tenant-isolation.spec.ts` (comentário do topo, linhas 32-35, e bloco novo antes da linha 1187)

A suíte de isolamento sobe o roteador de verdade sobre o build, contra um PostgreSQL descartável. As duas organizações da suíte estão com a integração desligada, então nada sai para a rede: o que se prova é a ordem das portas nas rotas de verdade.

- [ ] **Step 1: Banco descartável da suíte**

O PostgreSQL da máquina do Johnny é o do Homebrew, em `localhost:5432` (CLAUDE.md, seção 11). O script `test:isolation` usa `stronizap_isolation_test` quando `TEST_DATABASE_URL` não vem.

```bash
pg_isready -h localhost -p 5432
createdb stronizap_isolation_test 2>/dev/null || true
cd backend
DATABASE_URL="postgresql://$USER@localhost:5432/stronizap_isolation_test?schema=public" npx prisma migrate deploy
```

Expected: `accepting connections` (ou `aceitando conexões`) e `All migrations have been successfully applied.` (ou `No pending migrations to apply.`).

- [ ] **Step 2: Escrever os testes que falham**

Em `backend/src/routes/tenant-isolation.spec.ts`, no comentário do topo, trocar o fim (linhas 32-35):

```ts
 * E as duas rotas do cadastro de lead no Stronilead (spec 2026-09-29): a
 * ordem das portas (organização, canal, superadmin, sessão emprestada,
 * contato sem número) antes de qualquer conversa com o CRM.
 */
```

por:

```ts
 * E as duas rotas do cadastro de lead no Stronilead (spec 2026-09-29): a
 * ordem das portas (organização, canal, superadmin, sessão emprestada,
 * contato sem número) antes de qualquer conversa com o CRM.
 *
 * E as duas rotas do agendamento pelo Stronizap (spec 2026-09-29), com as
 * mesmas portas do cadastro.
 */
```

E, logo antes do comentário `// ── Esqueci a senha (spec 2026-09-22) ──` (linha 1187), acrescentar:

```ts
  // ── Agendamento pelo Stronizap (spec 2026-09-29) ───────────────────────────
  // As mesmas portas do cadastro, nas duas rotas do agendamento. As duas
  // organizações estão com a integração desligada, então nada sai para a rede.

  const CORPO_DO_AGENDAMENTO = {
    schedule: {
      leadId: 'L1',
      type: 'visita',
      unit: 'Centro',
      modality: null,
      professorId: null,
      soloTraining: false,
      quantity: null,
      date: '2026-10-01',
      time: '18:00',
      note: null,
    },
  };

  function opcoesDoAgendamento(token: string, conversationId: string) {
    return como(token, `/api/conversations/${conversationId}/crm-schedule-options`);
  }

  function agendar(token: string, conversationId: string) {
    return como(token, `/api/conversations/${conversationId}/crm-schedule`, {
      method: 'POST',
      body: JSON.stringify(CORPO_DO_AGENDAMENTO),
    });
  }

  test('agendamento no Stronilead: conversa de outra org é 404 nas duas rotas', async () => {
    assert.equal((await opcoesDoAgendamento(tokenA, B.conversationId)).status, 404);
    assert.equal((await agendar(tokenA, B.conversationId)).status, 404);
  });

  test('agendamento no Stronilead: canal que o atendente não atende é 403 nas duas rotas', async () => {
    assert.equal((await opcoesDoAgendamento(tokenAtendenteA, A.filaRestritaId)).status, 403);
    assert.equal((await agendar(tokenAtendenteA, A.filaRestritaId)).status, 403);
  });

  test('agendamento no Stronilead: superadmin é recusado, mesmo na conversa que existe', async () => {
    for (const res of [
      await opcoesDoAgendamento(tokenSuperAdmin, A.conversationId),
      await agendar(tokenSuperAdmin, A.conversationId),
    ]) {
      assert.equal(res.status, 403);
      assert.equal(await codigo(res), 'superadmin');
    }
  });

  test('agendamento no Stronilead: a sessão do superadmin entrando como admin é recusada', async () => {
    const tokenEmprestado = signAccessToken({
      sub: A.adminId,
      email: A.adminEmail,
      role: 'ADMIN',
      tv: 0,
      orgId: A.orgId,
      imp: { byId: 'superadmin-iso' },
    });
    for (const res of [
      await opcoesDoAgendamento(tokenEmprestado, A.conversationId),
      await agendar(tokenEmprestado, A.conversationId),
    ]) {
      assert.equal(res.status, 403);
      assert.equal(await codigo(res), 'impersonacao');
    }
  });

  test('agendamento no Stronilead: contato sem número (LID) e contato de Instagram são 422', async () => {
    const lid = await prisma.contact.create({
      data: {
        organizationId: A.orgId,
        channelId: A.channelId,
        phone: '208912345678902',
        jidSuffix: 'lid',
        name: 'Contato LID agendamento iso',
      },
    });
    const conversaLid = await prisma.conversation.create({
      data: { organizationId: A.orgId, channelId: A.channelId, contactId: lid.id, status: 'PENDING' },
    });
    const canalInstagram = await prisma.channel.create({
      data: { organizationId: A.orgId, name: 'Instagram agendamento iso', type: 'INSTAGRAM', sessionPath: '/tmp/iso-a-ig-agenda' },
    });
    const ig = await prisma.contact.create({
      data: {
        organizationId: A.orgId,
        channelId: canalInstagram.id,
        phone: '17841400000000002',
        jidSuffix: 'ig',
        name: 'Contato IG agendamento iso',
      },
    });
    const conversaIg = await prisma.conversation.create({
      data: { organizationId: A.orgId, channelId: canalInstagram.id, contactId: ig.id, status: 'PENDING' },
    });

    for (const conversationId of [conversaLid.id, conversaIg.id]) {
      for (const res of [await opcoesDoAgendamento(tokenA, conversationId), await agendar(tokenA, conversationId)]) {
        assert.equal(res.status, 422, conversationId);
        assert.equal(await codigo(res), 'sem_numero');
      }
    }
  });

  test('agendamento no Stronilead: corpo sem o bloco schedule é 400', async () => {
    const res = await como(tokenA, `/api/conversations/${A.conversationId}/crm-schedule`, {
      method: 'POST',
      body: JSON.stringify({ leadId: 'L1', type: 'visita' }),
    });
    assert.equal(res.status, 400);
  });

  test('agendamento no Stronilead: quem passa por todas as portas chega na integração, que está desligada (controle positivo)', async () => {
    for (const res of [
      await opcoesDoAgendamento(tokenA, A.conversationId),
      await agendar(tokenA, A.conversationId),
      await opcoesDoAgendamento(tokenAtendenteA, A.filaLiberadaId),
    ]) {
      assert.equal(res.status, 412);
      assert.equal(await codigo(res), 'desligado');
    }
  });

```

O `codigo`, o `como`, os tokens e os ids `A`/`B` já existem na suíte (o `codigo` nasceu no bloco do cadastro, logo acima).

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npm run test:isolation`
Expected: FAIL nos testes de canal sem acesso, superadmin, sessão emprestada, 422, 400 e 412: sem as rotas, o Express responde 404 para tudo. O teste da outra organização passa por acaso (404).

- [ ] **Step 4: Rotas em `backend/src/routes/conversations.routes.ts`**

Logo depois de `import * as crmLeadService from '../services/crm-lead.service';` (linha 13), acrescentar:

```ts
import * as crmScheduleService from '../services/crm-schedule.service';
```

Logo depois da rota `router.post('/:id/crm-lead', ...)` (termina na linha 652) e antes do comentário `// Envio de cartão de contato (vCard)`, acrescentar:

```ts

// Agendamento de visita e aula experimental no Stronilead a partir da
// conversa (spec
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md).
// Mesmas portas e mesmo formato de resposta do cadastro de lead, acima.
router.get('/:id/crm-schedule-options', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    const reply = await crmScheduleService.loadScheduleOptions(req.params.id, req.user);
    res.status(reply.status).json(reply.body);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/crm-schedule', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    // Só o bloco `schedule`: quem agendou, telefone, academia e canal o
    // serviço tira da sessão e da conversa, nunca do corpo.
    const body = crmScheduleService.crmScheduleBodySchema.parse(req.body);
    const reply = await crmScheduleService.scheduleCrmAppointment(req.params.id, req.user, body);
    res.status(reply.status).json(reply.body);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npm run typecheck && npm test && npm run test:isolation`
Expected: typecheck limpo, suíte rápida verde (590) e suíte de isolamento verde, com os sete testes novos do agendamento (75 no total).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/conversations.routes.ts backend/src/routes/tenant-isolation.spec.ts
git commit -m "feat: rotas das opções e do agendamento sob a conversa, cobertas no isolamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Smoke confere as opções do agendamento e o desfecho, e nunca agenda

**Files:**
- Modify: `backend/src/scripts/smoke-crm-card.ts`
- Modify: `backend/src/scripts/smoke-crm-card.guard.test.ts`

O smoke roda no servidor contra o Stronilead de produção. As opções do agendamento só leem; o agendamento gravaria de verdade e fica proibido no smoke, com a trava no `npm test`. O bloco novo pede as opções para o telefone do smoke, então ele precisa ter cadastro no Stronilead (o smoke já exige isso para conferir o cartão).

- [ ] **Step 1: Escrever a trava**

Trocar o conteúdo de `backend/src/scripts/smoke-crm-card.guard.test.ts` por:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// O smoke do cartão roda contra o Stronilead de produção. O cadastro de lead e
// o agendamento gravam de verdade na academia, então eles nunca podem
// aparecer nele. A conferência é de texto, de propósito: pega até um import
// esquecido.
const fonte = readFileSync(path.join(__dirname, 'smoke-crm-card.ts'), 'utf8');

test('smoke do cartão nunca chama o cadastro de lead', () => {
  assert.equal(fonte.includes('createCrmLead'), false);
  assert.equal(fonte.includes("'create-lead'"), false);
  assert.equal(fonte.includes('"create-lead"'), false);
});

test('smoke do cartão nunca agenda', () => {
  assert.equal(fonte.includes('createCrmAppointment'), false);
  assert.equal(fonte.includes('scheduleCrmAppointment'), false);
  assert.equal(fonte.includes('crm-schedule.service'), false);
  assert.equal(fonte.includes("'schedule'"), false);
  assert.equal(fonte.includes('"schedule"'), false);
});
```

- [ ] **Step 2: Rodar a trava**

Run: `cd backend && npm test`
Expected: PASS (591). A trava nova nasce verde e existe para o futuro: quem acrescentar o agendamento ao smoke derruba o `npm test`.

- [ ] **Step 3: Cabeçalho e import do smoke**

Em `backend/src/scripts/smoke-crm-card.ts`, trocar as linhas 23-25:

```ts
 * Confere também as opções do cadastro de lead (a ação lead-options), que só
 * leem. O cadastro em si grava um lead de verdade e nunca roda aqui: o
 * `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
```

por:

```ts
 * Confere também as opções do cadastro de lead (a ação lead-options) e as do
 * agendamento (schedule-options), que só leem, e o desfecho do agendamento no
 * cartão (`outcome`). O cadastro e o agendamento gravam de verdade e nunca
 * rodam aqui: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
```

Trocar as linhas 34-37:

```ts
 * houver mais de uma, ele pede o slug em vez de escolher sozinho. Sem o
 * e-mail, as opções são pedidas como o admin mais antigo da organização no
 * Stronizap, que precisa estar na equipe do Stronilead com o mesmo e-mail.
 */
```

por:

```ts
 * houver mais de uma, ele pede o slug em vez de escolher sozinho. Sem o
 * e-mail, as opções são pedidas como o admin mais antigo da organização no
 * Stronizap, que precisa estar na equipe do Stronilead com o mesmo e-mail.
 * As opções do agendamento são pedidas para o telefone do primeiro argumento,
 * então ele precisa ter cadastro no Stronilead.
 */
```

E trocar o import da linha 41:

```ts
import { fetchCrmCard, fetchCrmLeadOptions } from '../services/crm.service';
```

por:

```ts
import { fetchCrmCard, fetchCrmLeadOptions, fetchCrmScheduleOptions } from '../services/crm.service';
```

- [ ] **Step 4: O desfecho em todo agendamento do cartão**

Em `conferirPessoa`, trocar o fim do bloco do agendamento (linhas 369-375):

```ts
    check(
      `${quem}: appointment.at é data que o navegador consegue ler`,
      typeof ag.at === 'string' && !Number.isNaN(Date.parse(ag.at)),
      ag.at,
    );
  }
}
```

por:

```ts
    check(
      `${quem}: appointment.at é data que o navegador consegue ler`,
      typeof ag.at === 'string' && !Number.isNaN(Date.parse(ag.at)),
      ag.at,
    );
    // O desfecho sempre vem, preenchido ou null. Cancelado não chega aqui:
    // o Stronilead tira o agendamento inteiro do cartão.
    const temDesfecho = Object.prototype.hasOwnProperty.call(ag, 'outcome');
    check(
      `${quem}: appointment.outcome é 'attended', 'no_show' ou null`,
      temDesfecho && (ag.outcome === null || ag.outcome === 'attended' || ag.outcome === 'no_show'),
      temDesfecho ? ag.outcome : 'campo ausente',
    );
  }
}
```

- [ ] **Step 5: Quem pede as opções, num lugar só**

Logo depois da função `emailDoAdmin` (linhas 453-461), acrescentar:

```ts

/** Quem pede as opções: o e-mail do terceiro argumento ou o do admin mais antigo. */
async function emailDeQuemPede(org: OrgDoSmoke, emailInformado: string | undefined): Promise<string | null> {
  return emailInformado?.trim().toLowerCase() || (await emailDoAdmin(org.id));
}
```

E, em `conferirOpcoes`, trocar a linha 471:

```ts
  const email = emailInformado?.trim().toLowerCase() || (await emailDoAdmin(org.id));
```

por:

```ts
  const email = await emailDeQuemPede(org, emailInformado);
```

- [ ] **Step 6: A conferência das opções do agendamento**

Logo depois do fim de `conferirOpcoes` (a função termina na linha 533) e antes de `async function main()`, acrescentar:

```ts

/**
 * [5] Opções do agendamento, para o telefone do smoke. Só lê: a ação que
 * agenda grava de verdade e nunca roda aqui. Confere que os cadastros que o
 * Stronilead oferece são os mesmos do cartão (o próprio e os menores), e o
 * que o balão precisa para desenhar os passos e os cinco dias.
 */
async function conferirOpcoesDoAgendamento(
  org: OrgDoSmoke,
  telefone: string,
  card: CrmCard | null,
  emailInformado: string | undefined,
): Promise<boolean> {
  console.log('\n[5] opções do agendamento (schedule-options, só leitura)');

  const email = await emailDeQuemPede(org, emailInformado);
  if (!email) {
    nota('a organização não tem admin ativo. Passe o e-mail de alguém da equipe como terceiro argumento.');
    return false;
  }

  const r = await fetchCrmScheduleOptions(org.id, telefone, email);

  if (!r.ok) {
    if (r.kind === 'recusa') {
      check('recusa traz o código e o texto pronto', r.code !== '' && r.message !== '', r);
      nota(`o Stronilead recusou (${r.status} ${r.code}): ${r.message}`);
    } else {
      check(`opções do agendamento responderam (veio ${r.kind})`, false);
    }
    return false;
  }

  const o = r.value;
  check("actor.role é 'consultor' ou 'gestor'", o.actor.role === 'consultor' || o.actor.role === 'gestor', o.actor.role);
  check('gestor nunca conta na Meta diária', o.actor.role === 'consultor' || !o.actor.countsForMeta, o.actor);

  // Os cadastros do número são os mesmos do cartão: o próprio e cada menor.
  const doCartao = new Set<string>();
  if (card?.found && card.kind !== 'responsavel' && typeof card.leadId === 'string') doCartao.add(card.leadId);
  for (const w of Array.isArray(card?.wards) ? card.wards : []) {
    if (w && typeof w === 'object' && typeof w.leadId === 'string') doCartao.add(w.leadId);
  }
  const dasOpcoes = new Set(o.targets.map((t) => t.leadId));
  check(
    'os cadastros do agendamento são os mesmos do cartão (o próprio e os menores)',
    doCartao.size === dasOpcoes.size && [...doCartao].every((id) => dasOpcoes.has(id)),
    { cartao: [...doCartao], opcoes: [...dasOpcoes] },
  );
  for (const t of o.targets) {
    if (t.appointment) {
      check(`agendamento de ${t.leadId} tem data que o navegador consegue ler`, !Number.isNaN(Date.parse(t.appointment.at)), t.appointment);
    }
  }

  check('vêm os cinco dias sugeridos', o.days.length === 5, o.days.length);
  check(
    'os dias vêm em ordem e sem repetir',
    o.days.every((d, i) => i === 0 || d.date > o.days[i - 1].date),
    o.days.map((d) => d.date),
  );
  check(
    'o horário padrão é 18:00 hoje e 09:00 nos outros dias',
    o.days.every((d) => (d.label === 'Hoje' ? d.defaultTime === '18:00' : d.defaultTime === '09:00')),
    o.days,
  );
  check('tem pelo menos uma quantidade de aulas', o.trialClassOptions.length > 0, o.trialClassOptions);
  const modalidades = new Set(o.modalities.map((m) => m.id));
  const orfaos = o.professors.filter((p) => !p.modalityIds.some((id) => modalidades.has(id)));
  if (orfaos.length > 0) {
    nota(`${orfaos.length} professor(es) sem nenhuma modalidade da lista: não aparecem em modalidade nenhuma.`);
  }
  check(
    'nenhum campo das opções do agendamento tem cara de credencial ou de e-mail',
    !chavesAninhadas(o).some((k) => /key|token|secret|senha|email/i.test(k)),
  );

  console.log(`  quem pede:  ${o.actor.name ?? '(sem nome no Stronilead)'} (${o.actor.role}${o.actor.countsForMeta ? ', conta na Meta' : ''})`);
  console.log(`  cadastros:  ${o.targets.length} · unidades: ${o.units.length} · modalidades: ${o.modalities.length} · professores: ${o.professors.length}`);
  console.log(`  dias:       ${o.days.map((d) => `${d.label} ${d.date.slice(8)}/${d.date.slice(5, 7)}`).join(' · ')}`);
  return true;
}
```

- [ ] **Step 7: `main` chama o bloco novo e cobra o resultado**

Em `main`, trocar as linhas 599-600:

```ts
  // Opções do cadastro de lead: só leitura. O cadastro em si nunca roda aqui.
  const conferiuOpcoes = await conferirOpcoes(org, process.argv[4]);
```

por:

```ts
  // Opções do cadastro de lead e do agendamento: só leitura. O cadastro e o
  // agendamento em si nunca rodam aqui.
  const conferiuOpcoes = await conferirOpcoes(org, process.argv[4]);
  const conferiuAgendamento = res.card?.found
    ? await conferirOpcoesDoAgendamento(org, telefone, res.card, process.argv[4])
    : false;
```

E trocar o fim de `main`, do `if (!conferiuOpcoes) {` até o `console.log` do sucesso (linhas 622-629):

```ts
  if (!conferiuOpcoes) {
    console.error('\n❌ SMOKE INCOMPLETO: o cartão está certo, mas as opções do cadastro de lead não foram conferidas.');
    console.error('   Rode com o e-mail de alguém da equipe do Stronilead como terceiro argumento, com o CRM no ar.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão e opções do cadastro)');
```

por:

```ts
  if (!conferiuOpcoes) {
    console.error('\n❌ SMOKE INCOMPLETO: o cartão está certo, mas as opções do cadastro de lead não foram conferidas.');
    console.error('   Rode com o e-mail de alguém da equipe do Stronilead como terceiro argumento, com o CRM no ar.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!conferiuAgendamento) {
    console.error('\n❌ SMOKE INCOMPLETO: as opções do agendamento não foram conferidas.');
    console.error('   Rode com um telefone que exista no Stronilead e o e-mail de alguém da equipe, com o CRM no ar.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão, opções do cadastro e do agendamento)');
```

- [ ] **Step 8: Conferir tipos e a trava**

Run: `cd backend && npm run typecheck && npx tsc -p tsconfig.test.json --noEmit && npm test`
Expected: os dois typechecks limpos e a suíte verde (591), com a trava. O smoke de verdade roda no servidor depois do deploy, com o PR 1 no ar (Task 17, Step 4).

- [ ] **Step 9: Commit**

```bash
git add backend/src/scripts/smoke-crm-card.ts backend/src/scripts/smoke-crm-card.guard.test.ts
git commit -m "chore: smoke do cartão confere as opções do agendamento e o desfecho, e nunca agenda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Calendário em português

**Files:**
- Modify: `frontend/src/components/ui/calendar.tsx` (import na linha 3, comentário das linhas 10-14 e `<DayPicker` na linha 22)
- Create: `frontend/src/components/ui/calendar.test.tsx`

O calendário compartilhado (react-day-picker 8.10) não recebe o idioma e desenha os meses e os dias da semana em inglês, também no "Agendar mensagem" (`ScheduleDialog.tsx`, o único outro uso). O `ptBR` vem do `date-fns` 3.6 que o projeto já tem. O `locale` vai antes do `{...props}`, então quem precisar de outro idioma ainda passa o dele.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/ui/calendar.test.tsx`:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { Calendar } from './calendar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Calendar', () => {
  test('mostra o mês e os dias da semana em português', () => {
    act(() => root.render(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} />));

    const texto = container.textContent ?? '';
    expect(texto).toContain('outubro 2026');
    expect(texto).not.toMatch(/October|Sunday|Monday/);
    // Os botões do dia levam a data escrita por extenso para o leitor de tela.
    expect(container.querySelector('[aria-label*="outubro"]') ?? container.querySelector('[name="day"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/ui/calendar.test.tsx`
Expected: FAIL: o texto traz "October 2026", não "outubro 2026".

- [ ] **Step 3: Implementar em `frontend/src/components/ui/calendar.tsx`**

Trocar o import da linha 3:

```tsx
import { DayPicker } from "react-day-picker"
```

por:

```tsx
import { DayPicker } from "react-day-picker"
import { ptBR } from "date-fns/locale"
```

Trocar o comentário das linhas 10-14:

```tsx
/**
 * Calendário (react-day-picker v8) no tema do app — versão clássica do
 * shadcn pra Tailwind v3 (a gerada pelo registry exigia day-picker v9+ e
 * sintaxe do Tailwind v4, incompatíveis com o stack atual).
 */
```

por:

```tsx
/**
 * Calendário (react-day-picker v8) no tema do app — versão clássica do
 * shadcn pra Tailwind v3 (a gerada pelo registry exigia day-picker v9+ e
 * sintaxe do Tailwind v4, incompatíveis com o stack atual).
 *
 * Em português por padrão (meses, dias da semana e rótulos de leitor de
 * tela), no "Agendar mensagem" e no agendamento pelo Stronizap. Sem o
 * `locale`, o day-picker desenha em inglês.
 */
```

E trocar as linhas 22-23:

```tsx
    <DayPicker
      showOutsideDays={showOutsideDays}
```

por:

```tsx
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/ui/calendar.test.tsx && npm test`
Expected: PASS, e a suíte inteira verde (70 arquivos, 798 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/calendar.tsx frontend/src/components/ui/calendar.test.tsx
git commit -m "fix: calendário em português, também no Agendar mensagem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tipos do front e o horário de Brasília na tela

**Files:**
- Modify: `frontend/src/types/crm.ts` (depois de `CrmStrip`, linhas 22-26; linhas 40 e 57; fim do arquivo, depois de `crmFichaHref`, linha 260)
- Create: `frontend/src/lib/crmAppointment.ts`
- Create: `frontend/src/lib/crmAppointment.test.ts`

`frontend/src/types/crm.ts` é um dos arquivos do contrato: os tipos novos espelham os do backend (Tasks 1, 2 e 5). `lib/crmAppointment.ts` guarda o que a tela precisa ler em Brasília: a linha do cartão, o tipo com o rótulo em português (lead antigo guarda "Visita" ou "Aula Experimental"), as datas do balão, o instante do horário escolhido e o calendário. O teste põe o processo em UTC, como o `zapFuso.test.js` do Stronilead.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmAppointment.test.ts`:

```ts
import { describe, test, expect, vi, afterAll } from 'vitest';

// A máquina do Johnny fica em Brasília, e lá um defeito de fuso não aparece.
// Este arquivo põe o processo em UTC antes de importar o módulo, como o CI, e
// o primeiro teste confere que a troca pegou.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  appointmentKind,
  appointmentLine,
  appointmentTypeLabel,
  appointmentWhen,
  brasiliaInstant,
  calendarDate,
  ddmm,
  firstName,
  fromCalendarDate,
  todayInBrasilia,
  weekdayShort,
} from './crmAppointment';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

describe('processo em UTC', () => {
  test('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 8, 29, 18, 0).toISOString()).toBe('2026-09-29T18:00:00.000Z');
  });
});

describe('tipo do agendamento', () => {
  test('visita e aula, também do jeito antigo, e o resto fica como veio', () => {
    expect(appointmentKind('visita')).toBe('visita');
    expect(appointmentKind('Visita')).toBe('visita');
    expect(appointmentKind('aula_experimental')).toBe('aula_experimental');
    expect(appointmentKind('Aula Experimental')).toBe('aula_experimental');
    expect(appointmentKind('ligacao')).toBeNull();
    expect(appointmentKind({})).toBeNull();
    expect(appointmentTypeLabel('visita')).toBe('Visita');
    expect(appointmentTypeLabel('aula_experimental')).toBe('Aula experimental');
    expect(appointmentTypeLabel('Reunião')).toBe('Reunião');
    expect(appointmentTypeLabel({})).toBeNull();
  });
});

describe('appointmentLine', () => {
  test('tipo, dia e hora de Brasília, como no mockup', () => {
    expect(appointmentLine({ type: 'visita', at: '2026-10-01T21:00:00.000Z' })).toBe('Visita · 01/10 às 18:00');
    expect(appointmentLine({ type: 'aula_experimental', at: '2026-10-02T22:30:00.000Z', outcome: null })).toBe(
      'Aula experimental · 02/10 às 19:30',
    );
  });

  test('o desfecho entra no fim da linha', () => {
    expect(appointmentLine({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'attended' })).toBe(
      'Visita · 01/10 às 18:00 · Compareceu',
    );
    expect(appointmentLine({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'no_show' })).toBe(
      'Visita · 01/10 às 18:00 · Faltou',
    );
  });

  test('21h de Brasília ainda é o dia certo, mesmo já sendo o dia seguinte em UTC', () => {
    expect(appointmentLine({ type: 'visita', at: '2026-10-02T00:00:00.000Z' })).toBe('Visita · 01/10 às 21:00');
  });

  test('cartão malformado não quebra: sem agendamento, tipo que não é texto e data inválida', () => {
    expect(appointmentLine(null)).toBeNull();
    expect(appointmentLine(undefined)).toBeNull();
    expect(appointmentLine({ type: {} as unknown as string, at: 'x' })).toBeNull();
    expect(appointmentLine({ type: 'visita', at: 'x' })).toBe('Visita');
    expect(appointmentLine({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'rescheduled' as never })).toBe(
      'Visita · 01/10 às 18:00',
    );
  });
});

describe('primeiro nome', () => {
  test('a primeira palavra com letra, e nada para vazio ou telefone', () => {
    expect(firstName('Mariana Lima')).toBe('Mariana');
    expect(firstName('  Pedro  ')).toBe('Pedro');
    expect(firstName(null)).toBeNull();
    expect(firstName('+55 51 99812-4471')).toBeNull();
  });
});

describe('datas do balão', () => {
  test('dia e mês, e o dia da semana curto', () => {
    expect(ddmm('2026-10-01')).toBe('01/10');
    expect(weekdayShort('2026-10-01')).toBe('Quinta');
    expect(weekdayShort('2026-10-04')).toBe('Domingo');
    expect(weekdayShort('2026-10-03')).toBe('Sábado');
  });

  test('o instante de um dia e horário de Brasília', () => {
    expect(brasiliaInstant('2026-10-01', '18:00').toISOString()).toBe('2026-10-01T21:00:00.000Z');
    expect(brasiliaInstant('2026-10-01', '22:30').toISOString()).toBe('2026-10-02T01:30:00.000Z');
  });

  test('hoje em Brasília, mesmo quando em UTC já é amanhã', () => {
    expect(todayInBrasilia(new Date('2026-09-29T18:40:00.000Z'))).toBe('2026-09-29');
    expect(todayInBrasilia(new Date('2026-09-30T01:30:00.000Z'))).toBe('2026-09-29');
  });

  test('quando é o agendamento, para o aviso de remarcação', () => {
    expect(appointmentWhen('2026-09-30T21:00:00.000Z')).toBe('quarta, 30/09, às 18:00');
    expect(appointmentWhen('ontem')).toBeNull();
  });

  test('o calendário ida e volta, sem depender do fuso', () => {
    const d = calendarDate('2026-10-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(12);
    expect(fromCalendarDate(d)).toBe('2026-10-12');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmAppointment.test.ts`
Expected: FAIL: `Failed to resolve import "./crmAppointment"`.

- [ ] **Step 3: Tipos em `frontend/src/types/crm.ts`**

Logo depois da interface `CrmStrip` (linhas 22-26), acrescentar:

```ts

/** Tipo do agendamento, do jeito que o Stronilead grava em `appointmentType`. */
export type CrmAppointmentType = 'visita' | 'aula_experimental';

/** Desfecho que o cartão mostra: compareceu ou faltou. Cancelado some com o agendamento. */
export type CrmAppointmentOutcome = 'attended' | 'no_show';

/** Agendamento no cartão. `type` vem como o lead guarda, e `outcome` quando o Stronilead registrou. */
export interface CrmCardAppointment {
  type: string;
  at: string;
  outcome?: CrmAppointmentOutcome | null;
}
```

Nas interfaces `CrmWard` (linha 40) e `CrmCard` (linha 57), trocar:

```ts
  appointment?: { type: string; at: string } | null;
```

por:

```ts
  appointment?: CrmCardAppointment | null;
```

E acrescentar no fim do arquivo, depois de `crmFichaHref`:

```ts

// ── Agendamento pelo Stronizap (spec 2026-09-29) ───────────────────────────
// Espelho dos tipos de `backend/src/services/crm.service.ts` e de
// `backend/src/services/crm-schedule.service.ts`. Nenhuma lista mora aqui:
// cadastros, unidades, modalidades, professores, quantidades e os cinco dias
// chegam de `schedule-options` a cada abertura do balão.

/** Um agendamento como a ficha do Stronilead mostra, na resposta do agendamento. */
export interface CrmAppointmentDetail {
  leadId: string;
  leadName: string | null;
  type: CrmAppointmentType;
  /** Instante em ISO. */
  at: string;
  unit: string | null;
  unitAddress: string | null;
  modality: string | null;
  professorName: string | null;
  soloTraining: boolean;
  quantity: number | null;
  outcome: CrmAppointmentOutcome | null;
}

/** Um cadastro que o número casa: o próprio ou um menor de quem ele é responsável. */
export interface CrmScheduleTarget {
  leadId: string;
  name: string | null;
  /** Parentesco do menor visto por quem escreve ("Filho", "Filha"...), calculado pelo Stronilead. null no cadastro
   * do próprio número e quando o Stronilead não sabe o gênero. */
  relationship: string | null;
  /** O agendamento de agora, com o desfecho pela regra do cartão, para o aviso de remarcação. */
  appointment: { type: string; at: string; outcome: CrmAppointmentOutcome | null } | null;
}

/** Opções do balão, em lista fechada: o backend monta o objeto de novo. */
export interface CrmScheduleOptions {
  /** `countsForMeta`: agendar hoje conta na Meta Diária de quem pede. */
  actor: { id: string; name: string | null; role: 'consultor' | 'gestor'; countsForMeta: boolean };
  targets: CrmScheduleTarget[];
  units: Array<{ name: string; address: string | null }>;
  modalities: Array<{ id: string; name: string }>;
  /** Só os ativos. */
  professors: Array<{ id: string; name: string; modalityIds: string[] }>;
  trialClassOptions: number[];
  /** Os cinco dias sugeridos, já no horário de Brasília (`date` em AAAA-MM-DD). */
  days: Array<{ date: string; label: string; defaultTime: string }>;
}

/** O bloco `schedule` do POST /conversations/:id/crm-schedule. */
export interface CrmScheduleInput {
  leadId: string;
  type: CrmAppointmentType;
  unit: string | null;
  modality: string | null;
  professorId: string | null;
  soloTraining: boolean;
  quantity: number | null;
  /** AAAA-MM-DD, no horário de Brasília. */
  date: string;
  /** HH:MM, no horário de Brasília. */
  time: string;
  note: string | null;
}

/**
 * Corpo do POST /conversations/:id/crm-schedule. Quem agendou, telefone,
 * academia e canal o backend põe. O lembrete (PR 3) entra como um campo
 * opcional `reminder`, ao lado de `schedule`.
 */
export interface CrmScheduleBody {
  schedule: CrmScheduleInput;
}

/** Resposta do agendamento que deu certo, ou que já estava gravado (`alreadyScheduled`). */
export interface CrmScheduleResult {
  card: CrmCard;
  appointment: CrmAppointmentDetail;
  /** A confirmação para o lead, pronta, que fica escrita na caixa de mensagem. */
  confirmationText: string;
  alreadyScheduled: boolean;
}
```

- [ ] **Step 4: Criar `frontend/src/lib/crmAppointment.ts`**

```ts
// Agendamento do Stronilead na tela: a linha do cartão, as datas do balão e o
// instante do horário escolhido, sempre no horário de Brasília (spec
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md).
//
// O dia e a hora saem de America/Sao_Paulo, nunca do fuso do navegador: os
// cinco dias e o horário que o Stronilead manda são de Brasília, e o texto da
// confirmação também. Puro e testado sem React, com o processo em UTC.
import type { CrmAppointmentType, CrmCardAppointment } from '../types/crm';

const FUSO = 'America/Sao_Paulo';
const DIAS_CURTOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const leitor = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Ano, mês (1 a 12), dia, hora e minuto em Brasília. null para data inválida. */
function partes(instante: Date | string): Partes | null {
  const data = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(data.getTime())) return null;
  const p: Record<string, number> = {};
  for (const { type, value } of leitor.formatToParts(data)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "visita" ou "aula_experimental", pela mesma regra do Stronilead
 * (`normalizeAppointmentType`): lead antigo pode guardar "Visita" ou "Aula
 * Experimental". null para o resto.
 */
export function appointmentKind(type: unknown): CrmAppointmentType | null {
  if (typeof type !== 'string') return null;
  const t = type.trim().toLowerCase();
  if (t.includes('aula')) return 'aula_experimental';
  if (t.includes('visita')) return 'visita';
  return null;
}

/** "Visita" ou "Aula experimental". Tipo que não é nenhum dos dois fica como veio. */
export function appointmentTypeLabel(type: unknown): string | null {
  const kind = appointmentKind(type);
  if (kind === 'visita') return 'Visita';
  if (kind === 'aula_experimental') return 'Aula experimental';
  return typeof type === 'string' && type.trim() ? type.trim() : null;
}

const DESFECHO: Record<string, string> = { attended: 'Compareceu', no_show: 'Faltou' };

/**
 * Linha "Agendamento" do cartão: "Visita · 01/10 às 18:00", com " · Compareceu"
 * ou " · Faltou" quando o Stronilead registrou o desfecho. O cartão chega sem
 * validação, então campo malformado vira null em vez de derrubar o painel.
 */
export function appointmentLine(appointment: CrmCardAppointment | null | undefined): string | null {
  if (!appointment || typeof appointment !== 'object') return null;
  const rotulo = appointmentTypeLabel(appointment.type);
  if (!rotulo) return null;
  const p = typeof appointment.at === 'string' ? partes(appointment.at) : null;
  if (!p) return rotulo;
  const desfecho = typeof appointment.outcome === 'string' ? DESFECHO[appointment.outcome] : undefined;
  return `${rotulo} · ${pad(p.dia)}/${pad(p.mes)} às ${pad(p.hora)}:${pad(p.minuto)}${desfecho ? ` · ${desfecho}` : ''}`;
}

/** Primeira palavra com letra de um nome, como no backend. null para vazio ou telefone. */
export function firstName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null;
  return name.trim().split(/\s+/).find((palavra) => /\p{L}/u.test(palavra)) ?? null;
}

// ── Datas do balão (AAAA-MM-DD, sempre de Brasília) ────────────────────────

/** "01/10", de "2026-10-01". */
export function ddmm(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** "Quinta", de "2026-10-01": o dia da semana curto, como os cinco dias do Stronilead. */
export function weekdayShort(date: string): string {
  const [ano, mes, dia] = date.split('-').map(Number);
  return DIAS_CURTOS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
}

/** O instante de um dia e um horário de Brasília. Brasília não tem horário de verão desde 2019. */
export function brasiliaInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}

/** Hoje no calendário de Brasília, em AAAA-MM-DD. */
export function todayInBrasilia(now: Date): string {
  const p = partes(now) as Partes;
  return `${p.ano}-${pad(p.mes)}-${pad(p.dia)}`;
}

/** "quarta, 30/09, às 18:00", para o aviso de remarcação. null para data inválida. */
export function appointmentWhen(at: string): string | null {
  const p = partes(at);
  if (!p) return null;
  const semana = DIAS_CURTOS[new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay()].toLowerCase();
  return `${semana}, ${pad(p.dia)}/${pad(p.mes)}, às ${pad(p.hora)}:${pad(p.minuto)}`;
}

// ── Calendário (react-day-picker trabalha com meia-noite local) ────────────

/** O Date que o calendário usa para um dia AAAA-MM-DD. */
export function calendarDate(date: string): Date {
  const [ano, mes, dia] = date.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** O dia AAAA-MM-DD de um Date do calendário. */
export function fromCalendarDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/lib/crmAppointment.test.ts && npm test`
Expected: typecheck limpo, os doze testes novos verdes e a suíte inteira verde (71 arquivos, 810 testes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/crm.ts frontend/src/lib/crmAppointment.ts frontend/src/lib/crmAppointment.test.ts
git commit -m "feat: tipos do agendamento no front e datas no horário de Brasília

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Cartão com o desfecho, o agendamento do cliente e o "Agendado agora por você"

**Files:**
- Modify: `frontend/src/lib/crmLead.ts` (depois de `CadastroAviso`, linha 25)
- Modify: `frontend/src/stores/crm.store.ts` (linhas 3 e 49-55)
- Modify: `frontend/src/components/CrmCardSection.tsx` (comentário e imports das linhas 10-17, linhas 66, 75, 111-128, 219 e 285-290)
- Test: `frontend/src/components/CrmCardSection.test.tsx`

A linha "Agendamento" passa a sair de `appointmentLine`, com o tipo em português, o dia e a hora de Brasília e o desfecho. O cartão de cliente, que não tinha a linha, ganha. O rodapé do cartão aceita o aviso novo do agendamento sem mexer no `CadastroAviso`, que o `CrmLeadBalloon` estreita.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar no fim de `frontend/src/components/CrmCardSection.test.tsx`:

```tsx

// ── Agendamento pelo Stronizap (spec 2026-09-29) ───────────────────────────

const linhaDoAgendamento = () =>
  [...container.querySelectorAll('div')].find((d) => d.firstElementChild?.textContent === 'Agendamento')?.lastElementChild
    ?.textContent ?? null;

describe('CrmCardSection: agendamento', () => {
  test('lead: a linha mostra o tipo, o dia e a hora de Brasília, e o desfecho quando o Stronilead registrou', () => {
    const card: CrmCard = {
      ...CARTAO_NOVO,
      appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'attended' },
    };
    act(() => root.render(<CrmCardSection card={card} />));

    expect(linhaDoAgendamento()).toBe('Visita · 01/10 às 18:00 · Compareceu');
  });

  test('cliente também tem a linha de agendamento', () => {
    const card: CrmCard = {
      found: true,
      leadId: 'lead-9',
      kind: 'cliente',
      contractStatus: 'ativo',
      planName: 'Anual',
      appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null },
    };
    act(() => root.render(<CrmCardSection card={card} />));

    expect(linhaDoAgendamento()).toBe('Aula experimental · 02/10 às 19:00');
  });

  test('cada menor mostra o próprio desfecho', () => {
    const card: CrmCard = {
      found: true,
      kind: 'responsavel',
      name: 'Maria',
      wards: [
        {
          leadId: 'filho-a',
          kind: 'lead',
          name: 'Pedro',
          relationship: 'Mãe',
          strip: null,
          appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'no_show' },
        },
      ],
    };
    act(() => root.render(<CrmCardSection card={card} />));

    expect(container.querySelector('[data-crm-ward]')?.textContent).toContain('Visita · 01/10 às 18:00 · Faltou');
  });

  test('agendamento cancelado não vem no cartão, e a linha some', () => {
    act(() => root.render(<CrmCardSection card={{ ...CARTAO_NOVO, appointment: null }} />));

    expect(linhaDoAgendamento()).toBeNull();
  });

  test('depois de agendar por esta aba: "Agendado agora por você" com o link da ficha', () => {
    useCrmStore.getState().setAviso('contato-1', { kind: 'agendado' });
    act(() => root.render(<CrmCardSection card={CARTAO_NOVO} fichaLink={LINK} registration={registro()} />));

    expect(container.querySelector('[data-crm-aviso]')?.textContent).toBe('Agendado agora por você');
    expect(container.querySelector('a[href="https://stronilead.com.br/stronix-crm-app/ficha/lead-1"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmCardSection.test.tsx`
Expected: FAIL nos cinco testes novos menos o do cancelado: a linha sai "visita · 01/10 às 18:00" (código cru e sem desfecho), o cliente não tem a linha e o rodapé não conhece o aviso `agendado`.

- [ ] **Step 3: O aviso do agendamento no rodapé**

Em `frontend/src/lib/crmLead.ts`, logo depois de `CadastroAviso` (linha 25), acrescentar:

```ts

/**
 * O rodapé do cartão depois de uma gravação feita por esta aba: o cadastro
 * ou o agendamento ("Agendado agora por você").
 */
export type CrmCardNotice = CadastroAviso | { kind: 'agendado' };
```

Em `frontend/src/stores/crm.store.ts`, trocar o import da linha 3:

```ts
import type { CadastroAviso } from '../lib/crmLead';
```

por:

```ts
import type { CrmCardNotice } from '../lib/crmLead';
```

E trocar as linhas 49-55:

```ts
  /**
   * "Cadastrado agora por você", ou o texto do número que já estava lá, por
   * contato. Só na aba de quem cadastrou: o cartão do painel mostra, venha o
   * cadastro do balão do header ou do botão do painel.
   */
  avisos: Record<string, CadastroAviso>;
  setAviso: (contactId: string, aviso: CadastroAviso) => void;
```

por:

```ts
  /**
   * "Cadastrado agora por você", o texto do número que já estava lá ou
   * "Agendado agora por você", por contato. Só na aba de quem fez: o cartão
   * do painel mostra, venha a gravação do balão do header ou do painel.
   */
  avisos: Record<string, CrmCardNotice>;
  setAviso: (contactId: string, aviso: CrmCardNotice) => void;
```

- [ ] **Step 4: O cartão em `frontend/src/components/CrmCardSection.tsx`**

Trocar o fim do comentário do topo e os imports (linhas 10-17):

```tsx
// Com "Sem cadastro", quem pode cadastrar vê o botão "Cadastrar lead", que
// abre o balão do cadastro ao lado do painel, por cima da conversa
// (CrmLeadBalloon). Todo cartão com lead, e cada menor, ganha o "Abrir no
// Stronilead", que leva só o id na URL.
import { Check, ExternalLink, Info, UserPlus } from 'lucide-react';
import type { CrmCard, CrmFichaLink, CrmStrip, CrmWard } from '../types/crm';
import { crmFichaHref, crmStatus, crmToneKey, crmToneStyle } from '../types/crm';
import type { CadastroAviso } from '../lib/crmLead';
```

por:

```tsx
// Com "Sem cadastro", quem pode cadastrar vê o botão "Cadastrar lead", que
// abre o balão do cadastro ao lado do painel, por cima da conversa
// (CrmLeadBalloon). Todo cartão com lead, e cada menor, ganha o "Abrir no
// Stronilead", que leva só o id na URL.
//
// A linha "Agendamento" aparece no cartão de lead, no de cliente e no de cada
// menor, com o desfecho quando o Stronilead registra (`appointmentLine`).
import { Check, ExternalLink, Info, UserPlus } from 'lucide-react';
import type { CrmCard, CrmFichaLink, CrmStrip, CrmWard } from '../types/crm';
import { crmFichaHref, crmStatus, crmToneKey, crmToneStyle } from '../types/crm';
import type { CrmCardNotice } from '../lib/crmLead';
import { appointmentLine } from '../lib/crmAppointment';
```

No bloco do cliente, logo depois de `<DataRow label="Consultor" value={card.consultantName} />` (linha 66), acrescentar:

```tsx
          <DataRow label="Agendamento" value={appointmentLine(card.appointment)} mono />
```

No bloco do lead (linha 75) e no `WardItem` (linha 219), trocar `formatarAgendamento(card.appointment)` por `appointmentLine(card.appointment)` e `formatarAgendamento(ward.appointment)` por `appointmentLine(ward.appointment)`:

```tsx
          <DataRow label="Agendamento" value={appointmentLine(card.appointment)} mono />
```

```tsx
      <DataRow label="Agendamento" value={appointmentLine(ward.appointment)} mono />
```

Trocar o começo do `RodapeDoCartao` (linhas 111-126):

```tsx
/** "Cadastrado agora por você" (ou o texto do número que já estava lá) e o link da ficha. */
function RodapeDoCartao({ aviso, href }: { aviso: CadastroAviso | null; href: string | null }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
      {aviso && (
        <span data-crm-aviso="" className="inline-flex min-w-0 items-start gap-1" style={{ color: 'var(--ink-3)' }}>
          {aviso.kind === 'criado' ? (
            <Check size={12} aria-hidden className="mt-px flex-none" />
          ) : (
            <Info size={12} aria-hidden className="mt-px flex-none" />
          )}
          <span>{aviso.kind === 'criado' ? 'Cadastrado agora por você' : aviso.message}</span>
        </span>
      )}
```

por:

```tsx
/** Texto do rodapé depois de uma gravação feita nesta aba. */
function textoDoAviso(aviso: CrmCardNotice): string {
  if (aviso.kind === 'criado') return 'Cadastrado agora por você';
  if (aviso.kind === 'agendado') return 'Agendado agora por você';
  return aviso.message;
}

/** "Cadastrado agora por você", "Agendado agora por você" (ou o texto do número que já estava lá) e o link da ficha. */
function RodapeDoCartao({ aviso, href }: { aviso: CrmCardNotice | null; href: string | null }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
      {aviso && (
        <span data-crm-aviso="" className="inline-flex min-w-0 items-start gap-1" style={{ color: 'var(--ink-3)' }}>
          {aviso.kind === 'ja_cadastrado' ? (
            <Info size={12} aria-hidden className="mt-px flex-none" />
          ) : (
            <Check size={12} aria-hidden className="mt-px flex-none" />
          )}
          <span>{textoDoAviso(aviso)}</span>
        </span>
      )}
```

E apagar a função `formatarAgendamento` (linhas 285-290, com a linha em branco antes dela), que ficou sem uso. `pad` continua, porque `formatarData` usa.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/components/CrmCardSection.test.tsx && npm test`
Expected: typecheck limpo, os 23 testes do cartão verdes (18 de antes e 5 novos, inclusive o do campo malformado, que continua sem derrubar o painel) e a suíte inteira verde (71 arquivos, 815 testes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/crmLead.ts frontend/src/stores/crm.store.ts frontend/src/components/CrmCardSection.tsx frontend/src/components/CrmCardSection.test.tsx
git commit -m "feat: cartão mostra o desfecho do agendamento, também no cliente, e o Agendado agora por você

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `lib/crmSchedule.ts`, as chamadas e os textos depois de agendar

**Files:**
- Create: `frontend/src/lib/crmSchedule.ts`
- Create: `frontend/src/lib/crmSchedule.test.ts`

As duas chamadas às rotas novas, no molde de `lib/crmLead.ts`, e com a mesma leitura das falhas (`classifyLeadFailure`): recusa com o texto do Stronilead, seção que some (integração desligada ou chave recusada) e Stronilead fora do ar. Moram aqui também os textos que aparecem depois de agendar e a regra da faixa da confirmação, no jeito do `isUndoActive` da reescrita.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmSchedule.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

import {
  confirmationBarText,
  fetchScheduleOptions,
  isConfirmationActive,
  scheduleAppointment,
  scheduledNotice,
} from './crmSchedule';
import type { CrmScheduleBody, CrmScheduleOptions, CrmScheduleResult } from '../types/crm';

function erroHttp(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

const OPCOES: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [{ leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null }],
  units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }],
  modalities: [],
  professors: [],
  trialClassOptions: [1, 2, 3],
  days: [{ date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' }],
};

const CORPO: CrmScheduleBody = {
  schedule: {
    leadId: 'L1',
    type: 'visita',
    unit: 'Centro',
    modality: null,
    professorId: null,
    soloTraining: false,
    quantity: null,
    date: '2026-10-01',
    time: '18:00',
    note: null,
  },
};

const RESULTADO: CrmScheduleResult = {
  card: { found: true, leadId: 'L1', kind: 'lead', name: 'Mariana Lima' },
  appointment: {
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
  },
  confirmationText: 'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
  alreadyScheduled: false,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('fetchScheduleOptions', () => {
  test('pede as opções da conversa', async () => {
    get.mockResolvedValueOnce({ data: OPCOES });

    expect(await fetchScheduleOptions('conv-1')).toEqual({ kind: 'ok', options: OPCOES });
    expect(get).toHaveBeenCalledWith('/conversations/conv-1/crm-schedule-options');
  });

  test('fora da equipe é recusa com o texto do Stronilead; desligado some; 503 é tentar de novo', async () => {
    const message = 'Seu e-mail do Stronizap, bia@stronix.com.br, não está na equipe do Stronilead.';
    get.mockRejectedValueOnce(erroHttp(403, { error: message, code: 'fora_da_equipe' }));
    expect(await fetchScheduleOptions('conv-1')).toEqual({ kind: 'recusa', code: 'fora_da_equipe', message, field: null });

    get.mockRejectedValueOnce(erroHttp(412, { error: 'Desligada.', code: 'desligado' }));
    expect(await fetchScheduleOptions('conv-1')).toEqual({ kind: 'sumiu', reason: 'desligado' });

    get.mockRejectedValueOnce(erroHttp(503, { error: 'Fora.', code: 'indisponivel' }));
    expect(await fetchScheduleOptions('conv-1')).toEqual({ kind: 'indisponivel' });
  });
});

describe('scheduleAppointment', () => {
  test('manda só o bloco schedule e devolve o resultado', async () => {
    post.mockResolvedValueOnce({ data: RESULTADO });

    expect(await scheduleAppointment('conv-1', CORPO)).toEqual({ kind: 'agendado', result: RESULTADO });
    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-schedule', CORPO);
  });

  test('o que já estava agendado volta como agendado, com a marca', async () => {
    post.mockResolvedValueOnce({ data: { ...RESULTADO, alreadyScheduled: true } });

    const r = await scheduleAppointment('conv-1', CORPO);

    expect(r.kind === 'agendado' ? r.result.alreadyScheduled : null).toBe(true);
  });

  test('resposta sem cartão encontrado, sem agendamento ou sem confirmação é indisponível', async () => {
    for (const data of [
      {},
      { ...RESULTADO, card: { found: false } },
      { ...RESULTADO, appointment: null },
      { ...RESULTADO, confirmationText: '' },
    ]) {
      post.mockResolvedValueOnce({ data });
      expect(await scheduleAppointment('conv-1', CORPO)).toEqual({ kind: 'indisponivel' });
    }
  });

  test('recusa do Stronilead chega com o texto e o campo', async () => {
    const message = 'Essa unidade não existe mais no Stronilead. Escolha de novo.';
    post.mockRejectedValueOnce(erroHttp(422, { error: message, code: 'catalogo_mudou', field: 'unit' }));

    expect(await scheduleAppointment('conv-1', CORPO)).toEqual({
      kind: 'recusa',
      code: 'catalogo_mudou',
      message,
      field: 'unit',
    });
  });
});

describe('textos depois de agendar', () => {
  test('faixa e aviso, na visita e na aula', () => {
    expect(confirmationBarText('visita')).toBe('Visita agendada. A confirmação está na caixa.');
    expect(confirmationBarText('aula_experimental')).toBe('Aula agendada. A confirmação está na caixa.');
    expect(scheduledNotice('visita')).toBe('Visita agendada no Stronilead.');
    expect(scheduledNotice('aula_experimental')).toBe('Aula agendada no Stronilead.');
  });

  test('a faixa vale só com o texto igual ao que entrou', () => {
    expect(isConfirmationActive({ text: 'Combinado!' }, 'Combinado!')).toBe(true);
    expect(isConfirmationActive({ text: 'Combinado!' }, 'Combinado! ')).toBe(false);
    expect(isConfirmationActive(null, '')).toBe(false);
    expect(isConfirmationActive(undefined, 'x')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmSchedule.test.ts`
Expected: FAIL: `Failed to resolve import "./crmSchedule"`.

- [ ] **Step 3: Implementar**

Criar `frontend/src/lib/crmSchedule.ts`:

```ts
// Agendamento no Stronilead pela conversa: as duas chamadas ao backend do
// Stronizap, a leitura do que voltou e os textos que aparecem depois de
// agendar. O backend é quem fala com o CRM, e a chave nunca chega aqui. As
// falhas seguem as do cadastro (`classifyLeadFailure`): recusa com o texto do
// Stronilead, seção que some, ou Stronilead fora do ar.
import { api } from './api';
import { classifyLeadFailure, ehCartao, type LeadFailure } from './crmLead';
import type { CrmAppointmentType, CrmScheduleBody, CrmScheduleOptions, CrmScheduleResult } from '../types/crm';

export type ScheduleOptionsOutcome = { kind: 'ok'; options: CrmScheduleOptions } | LeadFailure;

export type ScheduleOutcome = { kind: 'agendado'; result: CrmScheduleResult } | LeadFailure;

function objeto(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Opções do balão, pedidas a cada abertura. */
export async function fetchScheduleOptions(conversationId: string): Promise<ScheduleOptionsOutcome> {
  try {
    const { data } = await api.get<CrmScheduleOptions>(`/conversations/${conversationId}/crm-schedule-options`);
    return { kind: 'ok', options: data };
  } catch (err) {
    return classifyLeadFailure(err);
  }
}

/** A resposta do agendamento, com o cartão encontrado, o agendamento e a confirmação. */
function lerResultado(data: unknown): CrmScheduleResult | null {
  const o = objeto(data);
  const card = o?.card;
  const appointment = objeto(o?.appointment);
  const texto = o?.confirmationText;
  if (!o || !ehCartao(card) || !card.found || !appointment) return null;
  if (appointment.type !== 'visita' && appointment.type !== 'aula_experimental') return null;
  if (typeof texto !== 'string' || !texto.trim()) return null;
  return o as unknown as CrmScheduleResult;
}

/**
 * Agenda. `ja_agendado` volta do backend como sucesso (`alreadyScheduled`),
 * porque a gravação é a mesma: a tela trata os dois do mesmo jeito.
 */
export async function scheduleAppointment(conversationId: string, body: CrmScheduleBody): Promise<ScheduleOutcome> {
  try {
    const { data } = await api.post<unknown>(`/conversations/${conversationId}/crm-schedule`, body);
    const result = lerResultado(data);
    return result ? { kind: 'agendado', result } : { kind: 'indisponivel' };
  } catch (err) {
    return classifyLeadFailure(err);
  }
}

/** Faixa acima da caixa quando a confirmação entrou nela. */
export function confirmationBarText(type: CrmAppointmentType): string {
  return type === 'aula_experimental'
    ? 'Aula agendada. A confirmação está na caixa.'
    : 'Visita agendada. A confirmação está na caixa.';
}

/** Aviso quando a confirmação não entrou na caixa (ocupada, ou a chave desligada). */
export function scheduledNotice(type: CrmAppointmentType): string {
  return type === 'aula_experimental' ? 'Aula agendada no Stronilead.' : 'Visita agendada no Stronilead.';
}

/**
 * A faixa da confirmação existe só enquanto a caixa tem exatamente o texto
 * que entrou, no mesmo jeito do Desfazer da reescrita (`isUndoActive`).
 */
export function isConfirmationActive(entry: { text: string } | null | undefined, text: string): boolean {
  return Boolean(entry) && text === entry!.text;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/lib/crmSchedule.test.ts && npm test`
Expected: typecheck limpo, os oito testes novos verdes e a suíte inteira verde (72 arquivos, 823 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/crmSchedule.ts frontend/src/lib/crmSchedule.test.ts
git commit -m "feat: chamadas do agendamento pela conversa e textos depois de agendar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `lib/crmScheduleWizard.ts`, as regras do assistente

**Files:**
- Create: `frontend/src/lib/crmScheduleWizard.ts`
- Create: `frontend/src/lib/crmScheduleWizard.test.ts`

Regras puras do balão, testadas sem React, no molde de `lib/crmLeadForm.ts`: quais passos existem, qual está aberto, o que cada linha respondida mostra, o aviso e o título da remarcação, o pedido, onde a recusa aparece e o que sobra quando uma lista muda no Stronilead. Nenhuma lista mora aqui.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmScheduleWizard.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import {
  buildScheduleInput,
  chooseModality,
  chooseProfessor,
  chooseQuantity,
  chooseTarget,
  chooseType,
  chooseUnit,
  confirmLabel,
  fitScheduleToOptions,
  initialScheduleValues,
  isAnswered,
  isPast,
  openStep,
  pickDay,
  previousStep,
  professorsFor,
  rescheduleNotice,
  scheduleSteps,
  scheduleTitle,
  setTime,
  SOLO,
  stepOfRefusal,
  stepValue,
  visibleSteps,
  type ScheduleValues,
} from './crmScheduleWizard';
import type { CrmScheduleOptions } from '../types/crm';

const OPCOES: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [{ leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null }],
  units: [
    { name: 'Centro', address: 'Rua Garibaldi, 1200' },
    { name: 'Zona Sul', address: null },
  ],
  modalities: [
    { id: 'm1', name: 'Pilates' },
    { id: 'm2', name: 'Funcional' },
  ],
  professors: [
    { id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] },
    { id: 'p2', name: 'Rafael Moura', modalityIds: ['m1', 'm2'] },
  ],
  trialClassOptions: [1, 2, 3],
  days: [
    { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
    { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
    { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
    { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
    { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' },
  ],
};

const MAE: CrmScheduleOptions = {
  ...OPCOES,
  targets: [
    { leadId: 'L2', name: 'Pedro Souza', relationship: 'Filho', appointment: null },
    { leadId: 'L3', name: 'Laura Souza', relationship: 'Filha', appointment: null },
  ],
};

/** Terça, 29/09, às 15:40 de Brasília. */
const AGORA = new Date('2026-09-29T18:40:00.000Z');

const inicio = (o: CrmScheduleOptions = OPCOES) => initialScheduleValues(o);

function visitaCompleta(o: CrmScheduleOptions = OPCOES): ScheduleValues {
  let v = chooseType(inicio(o), 'visita', o);
  v = chooseUnit(v, 'Centro');
  v = pickDay(v, '2026-10-01', o);
  v = setTime(v, '18:00');
  return { ...v, dayConfirmed: true };
}

describe('passos', () => {
  test('número com um cadastro: começa em "O que vai ser?", sem "Para quem?"', () => {
    const v = inicio();
    expect(v.leadId).toBe('L1');
    expect(scheduleSteps(v, OPCOES)).toEqual(['tipo']);
    expect(openStep(v, OPCOES, null)).toBe('tipo');
  });

  test('número que casa mais de um cadastro: "Para quem?" primeiro, com "O que vai ser?" apagado embaixo', () => {
    const v = inicio(MAE);
    expect(v.leadId).toBe('');
    expect(openStep(v, MAE, null)).toBe('para_quem');
    expect(visibleSteps(v, MAE, null)).toEqual(['para_quem', 'tipo']);
  });

  test('visita: Unidade e Dia e horário; aula: Modalidade, Professor, Quantas aulas e Dia e horário', () => {
    expect(scheduleSteps(chooseType(inicio(), 'visita', OPCOES), OPCOES)).toEqual(['tipo', 'unidade', 'dia']);
    expect(scheduleSteps(chooseType(inicio(), 'aula_experimental', OPCOES), OPCOES)).toEqual([
      'tipo',
      'modalidade',
      'professor',
      'quantidade',
      'dia',
    ]);
  });

  test('academia com uma unidade só já vem com a unidade respondida, e sem unidade não tem o passo', () => {
    const umaUnidade = { ...OPCOES, units: [{ name: 'Centro', address: null }] };
    const v = chooseType(inicio(umaUnidade), 'visita', umaUnidade);
    expect(v.unit).toBe('Centro');
    expect(openStep(v, umaUnidade, null)).toBe('dia');

    const semUnidade = { ...OPCOES, units: [] };
    expect(scheduleSteps(chooseType(inicio(semUnidade), 'visita', semUnidade), semUnidade)).toEqual(['tipo', 'dia']);
  });

  test('depois de escolher o tipo, "O que vai ser?" sai das linhas, e o Voltar leva de volta a ele', () => {
    const v = chooseType(inicio(), 'visita', OPCOES);
    expect(visibleSteps(v, OPCOES, null)).toEqual(['unidade', 'dia']);
    expect(previousStep('unidade', v, OPCOES)).toBe('tipo');
    expect(visibleSteps(v, OPCOES, 'tipo')).toEqual(['tipo', 'unidade', 'dia']);
    expect(previousStep('tipo', v, OPCOES)).toBeNull();
  });

  test('tudo respondido abre o resumo; clicar numa linha abre aquele passo', () => {
    const v = visitaCompleta();
    expect(openStep(v, OPCOES, null)).toBeNull();
    expect(openStep(v, OPCOES, 'unidade')).toBe('unidade');
  });

  test('o dia só vale depois do Continuar', () => {
    const v = pickDay(chooseUnit(chooseType(inicio(), 'visita', OPCOES), 'Centro'), '2026-10-01', OPCOES);
    expect(isAnswered('dia', v, OPCOES)).toBe(false);
    expect(isAnswered('dia', { ...v, dayConfirmed: true }, OPCOES)).toBe(true);
  });
});

describe('escolhas', () => {
  test('o professor lista só quem dá a modalidade', () => {
    expect(professorsFor(OPCOES, 'Pilates').map((p) => p.name)).toEqual(['Carla Dias', 'Rafael Moura']);
    expect(professorsFor(OPCOES, 'Funcional').map((p) => p.name)).toEqual(['Rafael Moura']);
    expect(professorsFor(OPCOES, 'Natação')).toEqual([]);
  });

  test('trocar a modalidade tira o professor que não dá a nova, e "Treina sozinho" fica', () => {
    let v = chooseModality(chooseType(inicio(), 'aula_experimental', OPCOES), 'Pilates', OPCOES);
    v = chooseProfessor(v, 'p1');
    expect(chooseModality(v, 'Funcional', OPCOES).professor).toBe('');
    expect(chooseModality(chooseProfessor(v, 'p2'), 'Funcional', OPCOES).professor).toBe('p2');
    expect(chooseModality(chooseProfessor(v, SOLO), 'Funcional', OPCOES).professor).toBe(SOLO);
  });

  test('trocar o tipo limpa o do outro tipo e deixa o dia e o horário', () => {
    const v = chooseType(visitaCompleta(), 'aula_experimental', OPCOES);
    expect(v.unit).toBe('');
    expect(v.date).toBe('2026-10-01');
    expect(v.time).toBe('18:00');
    expect(openStep(v, OPCOES, null)).toBe('modalidade');
  });

  test('o horário vem o do dia: 18:00 hoje e 09:00 nos outros, até a pessoa mexer', () => {
    let v = pickDay(inicio(), '2026-09-29', OPCOES);
    expect(v.time).toBe('18:00');
    v = pickDay(v, '2026-10-01', OPCOES);
    expect(v.time).toBe('09:00');
    v = setTime(v, '19:30');
    expect(pickDay(v, '2026-10-02', OPCOES).time).toBe('19:30');
  });

  test('dia do calendário fora dos cinco dias começa às 09:00', () => {
    expect(pickDay(inicio(), '2026-10-12', OPCOES).time).toBe('09:00');
  });

  test('horário que já passou, no horário de Brasília', () => {
    expect(isPast({ ...inicio(), date: '2026-09-29', time: '15:00' }, AGORA)).toBe(true);
    expect(isPast({ ...inicio(), date: '2026-09-29', time: '15:40' }, AGORA)).toBe(true);
    expect(isPast({ ...inicio(), date: '2026-09-29', time: '18:00' }, AGORA)).toBe(false);
  });
});

describe('linhas respondidas', () => {
  test('o que cada linha mostra', () => {
    let v = chooseTarget(inicio(MAE), 'L2');
    v = chooseType(v, 'aula_experimental', MAE);
    v = chooseModality(v, 'Pilates', MAE);
    v = chooseProfessor(v, SOLO);
    v = chooseQuantity(v, 2);
    v = setTime(pickDay(v, '2026-09-29', MAE), '19:00');
    expect(stepValue('para_quem', v, MAE)).toBe('Pedro Souza');
    expect(stepValue('modalidade', v, MAE)).toBe('Pilates');
    expect(stepValue('professor', v, MAE)).toBe('Treina sozinho');
    expect(stepValue('quantidade', v, MAE)).toBe('2 aulas');
    expect(stepValue('dia', v, MAE)).toBe('Hoje, 29/09 às 19:00');
    expect(stepValue('dia', setTime(pickDay(v, '2026-10-12', MAE), '10:00'), MAE)).toBe('Segunda, 12/10 às 10:00');
  });

  test('uma aula no singular', () => {
    const v = chooseQuantity(chooseType(inicio(), 'aula_experimental', OPCOES), 1);
    expect(stepValue('quantidade', v, OPCOES)).toBe('1 aula');
  });
});

describe('remarcar', () => {
  const COM_VISITA: CrmScheduleOptions = {
    ...OPCOES,
    targets: [
      {
        leadId: 'L1',
        name: 'Mariana Lima',
        relationship: null,
        appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null },
      },
    ],
  };

  test('mesmo tipo já marcado: aviso no topo, título e botão viram Remarcar', () => {
    const v = chooseType(inicio(COM_VISITA), 'visita', COM_VISITA);
    expect(rescheduleNotice(v, COM_VISITA)).toBe(
      'Mariana já tem visita marcada para quarta, 30/09, às 18:00. Agendar de novo troca o dia e o horário.',
    );
    expect(scheduleTitle(v, COM_VISITA)).toBe('Remarcar visita');
    expect(confirmLabel(v, COM_VISITA)).toBe('Remarcar visita');
  });

  test('outro tipo não é remarcação', () => {
    const v = chooseType(inicio(COM_VISITA), 'aula_experimental', COM_VISITA);
    expect(rescheduleNotice(v, COM_VISITA)).toBeNull();
    expect(scheduleTitle(v, COM_VISITA)).toBe('Agendar aula experimental');
    expect(confirmLabel(v, COM_VISITA)).toBe('Confirmar agendamento');
  });

  test('visita que já teve desfecho não é remarcação: agenda como nova, sem aviso', () => {
    const faltou: CrmScheduleOptions = {
      ...OPCOES,
      targets: [
        {
          leadId: 'L1',
          name: 'Mariana Lima',
          relationship: null,
          appointment: { type: 'visita', at: '2026-09-28T21:00:00.000Z', outcome: 'no_show' },
        },
      ],
    };
    const v = chooseType(inicio(faltou), 'visita', faltou);
    expect(rescheduleNotice(v, faltou)).toBeNull();
    expect(scheduleTitle(v, faltou)).toBe('Agendar visita');
    expect(confirmLabel(v, faltou)).toBe('Confirmar agendamento');
  });

  test('aula já marcada, também do jeito antigo do Stronilead', () => {
    const comAula: CrmScheduleOptions = {
      ...OPCOES,
      targets: [
        {
          leadId: 'L1',
          name: 'Mariana Lima',
          relationship: null,
          appointment: { type: 'Aula Experimental', at: '2026-10-02T22:00:00.000Z', outcome: null },
        },
      ],
    };
    const v = chooseType(inicio(comAula), 'aula_experimental', comAula);
    expect(scheduleTitle(v, comAula)).toBe('Remarcar aula');
    expect(confirmLabel(v, comAula)).toBe('Remarcar aula');
    expect(rescheduleNotice(v, comAula)).toBe(
      'Mariana já tem aula experimental marcada para sexta, 02/10, às 19:00. Agendar de novo troca o dia e o horário.',
    );
  });

  test('sem tipo escolhido, o título é Agendar', () => {
    expect(scheduleTitle(inicio(), OPCOES)).toBe('Agendar');
  });
});

describe('pedido', () => {
  test('visita manda a unidade e nada da aula', () => {
    expect(buildScheduleInput({ ...visitaCompleta(), note: '  Vem depois do trabalho.  ' })).toEqual({
      leadId: 'L1',
      type: 'visita',
      unit: 'Centro',
      modality: null,
      professorId: null,
      soloTraining: false,
      quantity: null,
      date: '2026-10-01',
      time: '18:00',
      note: 'Vem depois do trabalho.',
    });
  });

  test('aula manda modalidade, professor ou "Treina sozinho" e a quantidade', () => {
    let v = chooseType(inicio(), 'aula_experimental', OPCOES);
    v = chooseQuantity(chooseProfessor(chooseModality(v, 'Pilates', OPCOES), 'p1'), 2);
    v = { ...setTime(pickDay(v, '2026-10-02', OPCOES), '19:00'), dayConfirmed: true };
    expect(buildScheduleInput(v)).toEqual({
      leadId: 'L1',
      type: 'aula_experimental',
      unit: null,
      modality: 'Pilates',
      professorId: 'p1',
      soloTraining: false,
      quantity: 2,
      date: '2026-10-02',
      time: '19:00',
      note: null,
    });
    const sozinho = buildScheduleInput(chooseProfessor(v, SOLO));
    expect(sozinho.professorId).toBeNull();
    expect(sozinho.soloTraining).toBe(true);
  });
});

describe('recusas e listas que mudaram', () => {
  test('o campo da recusa leva ao passo dele', () => {
    expect(stepOfRefusal('catalogo_mudou', 'unit')).toBe('unidade');
    expect(stepOfRefusal('catalogo_mudou', 'professorId')).toBe('professor');
    expect(stepOfRefusal('dados_invalidos', 'time')).toBe('dia');
    expect(stepOfRefusal('dados_invalidos', 'note')).toBe('note');
    expect(stepOfRefusal('horario_passado', null)).toBe('dia');
    expect(stepOfRefusal('lead_nao_confere', null)).toBe('para_quem');
    expect(stepOfRefusal('limite', null)).toBeNull();
  });

  test('o que sumiu no Stronilead sai, e o resto fica como estava', () => {
    let v = chooseType(inicio(), 'aula_experimental', OPCOES);
    v = chooseQuantity(chooseProfessor(chooseModality(v, 'Pilates', OPCOES), 'p1'), 3);
    v = { ...setTime(pickDay(v, '2026-10-02', OPCOES), '19:00'), dayConfirmed: true, note: 'Tem dor no joelho.' };
    const semCarla: CrmScheduleOptions = {
      ...OPCOES,
      professors: OPCOES.professors.filter((p) => p.id !== 'p1'),
      trialClassOptions: [1, 2],
    };
    const ajustado = fitScheduleToOptions(v, semCarla);
    expect(ajustado.modality).toBe('Pilates');
    expect(ajustado.professor).toBe('');
    expect(ajustado.quantity).toBeNull();
    expect(ajustado.date).toBe('2026-10-02');
    expect(ajustado.note).toBe('Tem dor no joelho.');
    expect(openStep(ajustado, semCarla, null)).toBe('professor');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmScheduleWizard.test.ts`
Expected: FAIL: `Failed to resolve import "./crmScheduleWizard"`.

- [ ] **Step 3: Implementar**

Criar `frontend/src/lib/crmScheduleWizard.ts`:

```ts
// Regras do balão do agendamento (spec
// stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "O balão, passo a passo", "Remarcar" e "O resumo e a confirmação"). Puro e
// testado sem React.
//
// Nenhuma lista mora aqui: cadastros, unidades, modalidades, professores,
// quantidades e os cinco dias vêm das opções que o Stronilead mandou. Este
// arquivo decide quais passos existem, qual está aberto, o que cada linha
// respondida mostra e o que vai no pedido. O Stronilead confere tudo de novo
// com as regras dele e recusa com o texto dele.
import type { CrmAppointmentType, CrmScheduleInput, CrmScheduleOptions, CrmScheduleTarget } from '../types/crm';
import { appointmentKind, appointmentWhen, brasiliaInstant, ddmm, firstName, weekdayShort } from './crmAppointment';

export type ScheduleStep = 'para_quem' | 'tipo' | 'unidade' | 'modalidade' | 'professor' | 'quantidade' | 'dia';

/** "Treina sozinho" no lugar do id do professor, como no assistente do Stronilead. */
export const SOLO = '__solo__';
export const SOLO_LABEL = 'Treina sozinho';

/** Limite da anotação, o mesmo que o Stronilead confere. */
export const NOTE_MAX = 1000;

/**
 * Horário que um dia escolhido no calendário recebe quando a pessoa ainda
 * não mexeu no horário: o dos dias que não são hoje no assistente do
 * Stronilead. Os cinco dias sugeridos trazem o horário deles.
 */
export const OTHER_DAY_TIME = '09:00';

export const DAY_PAST = 'Esse horário já passou. Escolha outro.';
export const NO_MODALITY = 'Nenhuma modalidade cadastrada. Adicione em Configurações → Configurações Gerais.';

/** Aviso do Stronilead quando a modalidade não tem professor. */
export function noProfessorNotice(modality: string): string {
  return `Nenhum professor cadastrado para ${modality}. Cadastre um em Configurações → Equipe, ou marque "Treina sozinho".`;
}

export const STEP_TITLES: Record<ScheduleStep, string> = {
  para_quem: 'Para quem?',
  tipo: 'O que vai ser?',
  unidade: 'Unidade',
  modalidade: 'Modalidade',
  professor: 'Professor',
  quantidade: 'Quantas aulas',
  dia: 'Dia e horário',
};

/** As dicas do assistente do Stronilead. */
export const STEP_HINTS: Partial<Record<ScheduleStep, string>> = {
  unidade: 'Onde a visita vai acontecer?',
  modalidade: 'Qual treino o lead vai experimentar?',
  professor: 'Quem vai acompanhar a aula?',
  quantidade: 'O que foi combinado com o aluno.',
  dia: 'Quando vai ser?',
};

export interface ScheduleValues {
  leadId: string;
  type: CrmAppointmentType | '';
  /** Nome da unidade. */
  unit: string;
  /** Nome da modalidade. */
  modality: string;
  /** Id do professor, ou SOLO. */
  professor: string;
  quantity: number | null;
  /** AAAA-MM-DD, no horário de Brasília. */
  date: string;
  /** HH:MM. */
  time: string;
  /** A pessoa mexeu no horário: trocar de dia não volta ao horário padrão. */
  timeTouched: boolean;
  /** "Continuar" no passo do dia e horário. */
  dayConfirmed: boolean;
  note: string;
  writeConfirmation: boolean;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Respostas que vêm sozinhas: o cadastro, quando o número casa um só, e a
 * unidade da visita, quando a academia tem uma só.
 */
function comRespostasSozinhas(values: ScheduleValues, options: CrmScheduleOptions): ScheduleValues {
  return {
    ...values,
    leadId: values.leadId || (options.targets.length === 1 ? options.targets[0].leadId : ''),
    unit: values.unit || (values.type === 'visita' && options.units.length === 1 ? options.units[0].name : ''),
  };
}

export function initialScheduleValues(options: CrmScheduleOptions): ScheduleValues {
  return comRespostasSozinhas(
    {
      leadId: '',
      type: '',
      unit: '',
      modality: '',
      professor: '',
      quantity: null,
      date: '',
      time: '',
      timeTouched: false,
      dayConfirmed: false,
      note: '',
      writeConfirmation: true,
    },
    options,
  );
}

/** Professores que dão a modalidade escolhida. O Stronilead só manda os ativos. */
export function professorsFor(options: CrmScheduleOptions, modality: string): CrmScheduleOptions['professors'] {
  const escolhida = options.modalities.find((m) => m.name === modality);
  if (!escolhida) return [];
  return options.professors.filter((p) => p.modalityIds.includes(escolhida.id));
}

/** Os passos do tipo, na ordem. Visita sem unidade cadastrada vai direto ao dia. */
function passosDoTipo(type: ScheduleValues['type'], options: CrmScheduleOptions): ScheduleStep[] {
  if (type === 'visita') return options.units.length > 0 ? ['unidade', 'dia'] : ['dia'];
  if (type === 'aula_experimental') return ['modalidade', 'professor', 'quantidade', 'dia'];
  return [];
}

/** Todos os passos, na ordem. "Para quem?" só quando o número casa mais de um cadastro. */
export function scheduleSteps(values: ScheduleValues, options: CrmScheduleOptions): ScheduleStep[] {
  const paraQuem: ScheduleStep[] = options.targets.length > 1 ? ['para_quem'] : [];
  return [...paraQuem, 'tipo', ...passosDoTipo(values.type, options)];
}

export function isAnswered(step: ScheduleStep, values: ScheduleValues, options: CrmScheduleOptions): boolean {
  switch (step) {
    case 'para_quem':
      return options.targets.some((t) => t.leadId === values.leadId);
    case 'tipo':
      return values.type !== '';
    case 'unidade':
      return options.units.some((u) => u.name === values.unit);
    case 'modalidade':
      return options.modalities.some((m) => m.name === values.modality);
    case 'professor':
      return values.professor === SOLO || professorsFor(options, values.modality).some((p) => p.id === values.professor);
    case 'quantidade':
      return values.quantity !== null && options.trialClassOptions.includes(values.quantity);
    case 'dia':
      return values.dayConfirmed && DATA_RE.test(values.date) && HORA_RE.test(values.time);
  }
}

/** O passo aberto: o que a pessoa pediu para trocar, ou o primeiro sem resposta. null é o resumo. */
export function openStep(
  values: ScheduleValues,
  options: CrmScheduleOptions,
  editing: ScheduleStep | null,
): ScheduleStep | null {
  const passos = scheduleSteps(values, options);
  if (editing && passos.includes(editing)) return editing;
  return passos.find((p) => !isAnswered(p, values, options)) ?? null;
}

/**
 * As linhas que o balão desenha. "O que vai ser?" sai da lista depois de
 * respondido, porque o título do balão já diz o tipo, e volta quando a pessoa
 * vai para ele pelo Voltar.
 */
export function visibleSteps(
  values: ScheduleValues,
  options: CrmScheduleOptions,
  editing: ScheduleStep | null,
): ScheduleStep[] {
  const aberto = openStep(values, options, editing);
  return scheduleSteps(values, options).filter((p) => p !== 'tipo' || aberto === 'tipo' || values.type === '');
}

/** O passo de antes, para o Voltar. null no primeiro. */
export function previousStep(
  step: ScheduleStep,
  values: ScheduleValues,
  options: CrmScheduleOptions,
): ScheduleStep | null {
  const passos = scheduleSteps(values, options);
  const i = passos.indexOf(step);
  return i > 0 ? passos[i - 1] : null;
}

export function chooseTarget(values: ScheduleValues, leadId: string): ScheduleValues {
  return { ...values, leadId };
}

/** Trocar o tipo limpa o que era do outro tipo. Cadastro, dia e horário ficam. */
export function chooseType(
  values: ScheduleValues,
  type: CrmAppointmentType,
  options: CrmScheduleOptions,
): ScheduleValues {
  if (values.type === type) return values;
  return comRespostasSozinhas({ ...values, type, unit: '', modality: '', professor: '', quantity: null }, options);
}

export function chooseUnit(values: ScheduleValues, unit: string): ScheduleValues {
  return { ...values, unit };
}

/** Trocar a modalidade tira o professor que não dá a nova. "Treina sozinho" fica. */
export function chooseModality(values: ScheduleValues, modality: string, options: CrmScheduleOptions): ScheduleValues {
  const segue = values.professor === SOLO || professorsFor(options, modality).some((p) => p.id === values.professor);
  return { ...values, modality, professor: segue ? values.professor : '' };
}

export function chooseProfessor(values: ScheduleValues, professor: string): ScheduleValues {
  return { ...values, professor };
}

export function chooseQuantity(values: ScheduleValues, quantity: number): ScheduleValues {
  return { ...values, quantity };
}

/**
 * Escolher o dia. O horário vem o do dia (18:00 hoje e 09:00 nos outros, como
 * o Stronilead manda), a não ser que a pessoa já tenha mexido nele.
 */
export function pickDay(values: ScheduleValues, date: string, options: CrmScheduleOptions): ScheduleValues {
  const padrao = options.days.find((d) => d.date === date)?.defaultTime ?? OTHER_DAY_TIME;
  return { ...values, date, time: values.timeTouched && values.time ? values.time : padrao };
}

export function setTime(values: ScheduleValues, time: string): ScheduleValues {
  return { ...values, time, timeTouched: true };
}

/** O dia e o horário escolhidos, no horário de Brasília, já passaram? */
export function isPast(values: ScheduleValues, now: Date): boolean {
  return brasiliaInstant(values.date, values.time).getTime() <= now.getTime();
}

export function quantityLabel(n: number): string {
  return n === 1 ? '1 aula' : `${n} aulas`;
}

/** "Quinta" para um dos cinco dias, e o dia da semana para um dia do calendário. */
export function dayLabel(date: string, options: CrmScheduleOptions): string {
  return options.days.find((d) => d.date === date)?.label ?? weekdayShort(date);
}

export function targetOf(values: ScheduleValues, options: CrmScheduleOptions): CrmScheduleTarget | null {
  return options.targets.find((t) => t.leadId === values.leadId) ?? null;
}

/** O que a linha de um passo respondido mostra: "Centro", "Quinta, 01/10 às 18:00". */
export function stepValue(step: ScheduleStep, values: ScheduleValues, options: CrmScheduleOptions): string | null {
  switch (step) {
    case 'para_quem':
      return targetOf(values, options)?.name ?? null;
    case 'tipo':
      return values.type === 'visita' ? 'Visita' : values.type === 'aula_experimental' ? 'Aula experimental' : null;
    case 'unidade':
      return values.unit || null;
    case 'modalidade':
      return values.modality || null;
    case 'professor':
      return values.professor === SOLO
        ? SOLO_LABEL
        : (options.professors.find((p) => p.id === values.professor)?.name ?? null);
    case 'quantidade':
      return values.quantity ? quantityLabel(values.quantity) : null;
    case 'dia':
      return values.date && values.time ? `${dayLabel(values.date, options)}, ${ddmm(values.date)} às ${values.time}` : null;
  }
}

/**
 * A pessoa escolhida já tem um agendamento do tipo escolhido, ainda sem
 * desfecho: agendar de novo remarca. Com desfecho (compareceu ou faltou), o
 * agendamento já aconteceu, e o balão agenda como novo, sem aviso.
 */
export function isRescheduling(values: ScheduleValues, options: CrmScheduleOptions): boolean {
  const agendamento = targetOf(values, options)?.appointment;
  return Boolean(
    values.type && agendamento && agendamento.outcome === null && appointmentKind(agendamento.type) === values.type,
  );
}

/**
 * "Mariana já tem visita marcada para quarta, 30/09, às 18:00. Agendar de novo
 * troca o dia e o horário." Sem artigo antes do nome, para não adivinhar o
 * gênero, a mesma regra do professor na confirmação.
 */
export function rescheduleNotice(values: ScheduleValues, options: CrmScheduleOptions): string | null {
  if (!isRescheduling(values, options)) return null;
  const alvo = targetOf(values, options);
  const quando = alvo?.appointment ? appointmentWhen(alvo.appointment.at) : null;
  if (!alvo || !quando) return null;
  const oQue = values.type === 'visita' ? 'visita' : 'aula experimental';
  const nome = firstName(alvo.name);
  const quem = nome ? `${nome} já tem` : 'Já tem';
  return `${quem} ${oQue} marcada para ${quando}. Agendar de novo troca o dia e o horário.`;
}

/** Título do balão: "Agendar", "Agendar visita", "Remarcar aula"... */
export function scheduleTitle(values: ScheduleValues, options: CrmScheduleOptions): string {
  if (values.type === '') return 'Agendar';
  const remarcar = isRescheduling(values, options);
  if (values.type === 'visita') return remarcar ? 'Remarcar visita' : 'Agendar visita';
  return remarcar ? 'Remarcar aula' : 'Agendar aula experimental';
}

/** Botão do resumo: "Confirmar agendamento", ou "Remarcar visita" e "Remarcar aula". */
export function confirmLabel(values: ScheduleValues, options: CrmScheduleOptions): string {
  if (!isRescheduling(values, options)) return 'Confirmar agendamento';
  return values.type === 'visita' ? 'Remarcar visita' : 'Remarcar aula';
}

/** O bloco `schedule` do pedido. Só chamar com todos os passos respondidos. */
export function buildScheduleInput(values: ScheduleValues): CrmScheduleInput {
  if (values.type === '') throw new Error('Tipo vazio: confira os passos antes de montar o agendamento.');
  const aula = values.type === 'aula_experimental';
  return {
    leadId: values.leadId,
    type: values.type,
    unit: !aula && values.unit ? values.unit : null,
    modality: aula ? values.modality || null : null,
    professorId: aula && values.professor && values.professor !== SOLO ? values.professor : null,
    soloTraining: aula && values.professor === SOLO,
    quantity: aula ? values.quantity : null,
    date: values.date,
    time: values.time,
    note: values.note.trim() || null,
  };
}

/**
 * Onde a recusa do Stronilead aparece: no passo do campo que ela traz, ou na
 * anotação. `horario_passado` e `lead_nao_confere` sem campo vão para o dia e
 * para o "Para quem?". null: na área geral do resumo.
 */
export function stepOfRefusal(code: string | null, field: string | null): ScheduleStep | 'note' | null {
  switch (field) {
    case 'leadId':
      return 'para_quem';
    case 'type':
      return 'tipo';
    case 'unit':
      return 'unidade';
    case 'modality':
      return 'modalidade';
    case 'professorId':
      return 'professor';
    case 'quantity':
      return 'quantidade';
    case 'date':
    case 'time':
      return 'dia';
    case 'note':
      return 'note';
  }
  if (code === 'horario_passado') return 'dia';
  if (code === 'lead_nao_confere') return 'para_quem';
  return null;
}

/** Recusas depois das quais as listas mudaram no Stronilead e voltam de lá. */
export const RELOAD_ON: readonly string[] = ['catalogo_mudou', 'lead_nao_confere'];

/**
 * Depois de recarregar as opções (unidade apagada, professor desligado), o que
 * não existe mais sai. O resto fica como a pessoa deixou.
 */
export function fitScheduleToOptions(values: ScheduleValues, options: CrmScheduleOptions): ScheduleValues {
  const modality = options.modalities.some((m) => m.name === values.modality) ? values.modality : '';
  const professor =
    values.professor === SOLO || professorsFor(options, modality).some((p) => p.id === values.professor)
      ? values.professor
      : '';
  return comRespostasSozinhas(
    {
      ...values,
      leadId: options.targets.some((t) => t.leadId === values.leadId) ? values.leadId : '',
      unit: options.units.some((u) => u.name === values.unit) ? values.unit : '',
      modality,
      professor,
      quantity: values.quantity !== null && options.trialClassOptions.includes(values.quantity) ? values.quantity : null,
    },
    options,
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/lib/crmScheduleWizard.test.ts && npm test`
Expected: typecheck limpo, os 24 testes novos verdes e a suíte inteira verde (73 arquivos, 847 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/crmScheduleWizard.ts frontend/src/lib/crmScheduleWizard.test.ts
git commit -m "feat: regras do balão do agendamento, passo a passo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: A confirmação na caixa: o store, a faixa e o `MessageInput`

**Files:**
- Create: `frontend/src/stores/crmConfirmation.store.ts`
- Create: `frontend/src/stores/crmConfirmation.store.test.ts`
- Create: `frontend/src/components/CrmConfirmationBar.tsx`
- Modify: `frontend/src/components/MessageInput.tsx` (import depois da linha 43, efeito depois da linha 155, faixa depois da linha 940)
- Create: `frontend/src/components/MessageInput.confirmation.test.tsx`

A confirmação entra na caixa pelo `useCrmConfirmationStore.offer`, só com a caixa vazia, e o store guarda o texto que entrou, por conversa, porque o `MessageInput` remonta a cada conversa. A faixa `CrmConfirmationBar` aparece acima da caixa enquanto o texto for igual ao que entrou, no jeito do Desfazer da reescrita, e sai do store de vez quando a pessoa mexe no texto, apaga ou envia. Nada é enviado sozinho.

Dois cuidados no `MessageInput` (notas 15 e 16):
- o modo nota da caixa vazia mora no estado do `MessageInput`, não no rascunho; quando a confirmação entra, a caixa sai do modo nota, senão ela iria como nota interna;
- a faixa só existe com a confirmação na caixa. Uma região `role="status"` sempre montada antes do formulário quebraria o teste "com a IA desligada no servidor, a região de aviso da faixa não existe" do `MessageInput.rewrite.test.tsx`. Durante a reescrita, a faixa some, porque a da reescrita fala por ela.

- [ ] **Step 1: Escrever os testes do store que falham**

Criar `frontend/src/stores/crmConfirmation.store.test.ts`:

```ts
import { describe, test, expect, beforeEach } from 'vitest';
import { useAuthStore, type AuthUser } from './auth.store';
import { useDraftsStore } from './drafts.store';
import { useCrmConfirmationStore } from './crmConfirmation.store';

function user(id: string): AuthUser {
  return { id, name: 'Ana Souza', email: `${id}@stronix.test`, role: 'ATENDENTE', avatarUrl: null, showSenderName: true };
}

const CONFIRMACAO = {
  text: 'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h.',
  type: 'visita' as const,
};

const rascunho = (id: string) => useDraftsStore.getState().drafts[id];
const faixa = (id: string) => useCrmConfirmationStore.getState().byConversation[id];

beforeEach(() => {
  useAuthStore.setState({ user: user('ana'), accessToken: 't1' });
  useDraftsStore.getState().clear();
  useCrmConfirmationStore.getState().clear();
});

describe('confirmação do agendamento na caixa', () => {
  test('caixa vazia: o texto entra como mensagem, não como nota, e a faixa fica guardada', () => {
    expect(useCrmConfirmationStore.getState().offer('conv-1', CONFIRMACAO)).toBe('escrita');

    expect(rascunho('conv-1')).toMatchObject({ text: CONFIRMACAO.text, noteMode: false });
    expect(faixa('conv-1')).toEqual(CONFIRMACAO);
  });

  test('caixa ocupada: nada muda, para não apagar o que a pessoa escrevia', () => {
    useDraftsStore.getState().setDraft('conv-1', 'Oi, tudo bem?', false);

    expect(useCrmConfirmationStore.getState().offer('conv-1', CONFIRMACAO)).toBe('caixa_ocupada');

    expect(rascunho('conv-1')?.text).toBe('Oi, tudo bem?');
    expect(faixa('conv-1')).toBeUndefined();
  });

  test('caixa só com espaço conta como vazia', () => {
    useDraftsStore.getState().setDraft('conv-1', '   ', false);

    expect(useCrmConfirmationStore.getState().offer('conv-1', CONFIRMACAO)).toBe('escrita');
    expect(rascunho('conv-1')?.text).toBe(CONFIRMACAO.text);
  });

  test('a faixa de uma conversa não encosta na outra', () => {
    useCrmConfirmationStore.getState().offer('conv-1', CONFIRMACAO);
    useCrmConfirmationStore.getState().offer('conv-2', { ...CONFIRMACAO, type: 'aula_experimental' });

    useCrmConfirmationStore.getState().discard('conv-1');

    expect(faixa('conv-1')).toBeUndefined();
    expect(faixa('conv-2')?.type).toBe('aula_experimental');
  });

  test('troca de usuário apaga as faixas, como os rascunhos', () => {
    useCrmConfirmationStore.getState().offer('conv-1', CONFIRMACAO);

    useAuthStore.setState({ user: user('bia'), accessToken: 't2' });

    expect(faixa('conv-1')).toBeUndefined();
    expect(rascunho('conv-1')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/stores/crmConfirmation.store.test.ts`
Expected: FAIL: `Failed to resolve import "./crmConfirmation.store"`.

- [ ] **Step 3: Criar o store**

Criar `frontend/src/stores/crmConfirmation.store.ts`:

```ts
import { create } from 'zustand';
import { useAuthStore } from './auth.store';
import { useDraftsStore } from './drafts.store';
import type { CrmAppointmentType } from '../types/crm';

/**
 * Confirmação do agendamento que entrou na caixa de digitar, por conversa
 * (spec do agendamento pelo Stronizap, "Depois de agendar"). Mora num store
 * porque o MessageInput remonta a cada conversa: quem volta para a conversa
 * ainda vê a faixa, enquanto a caixa tiver o mesmo texto.
 *
 * A faixa ("Visita agendada. A confirmação está na caixa.") aparece só
 * enquanto o texto da caixa for igual ao que entrou (`isConfirmationActive`),
 * como o Desfazer da reescrita. Nada é enviado sozinho.
 */
export interface CrmConfirmation {
  text: string;
  type: CrmAppointmentType;
}

interface CrmConfirmationState {
  byConversation: Record<string, CrmConfirmation>;
  /**
   * Escreve a confirmação na caixa da conversa, só se ela estiver vazia, e
   * guarda a faixa. Com a caixa ocupada não mexe em nada, para não apagar o
   * que a pessoa estava escrevendo.
   */
  offer: (conversationId: string, confirmation: CrmConfirmation) => 'escrita' | 'caixa_ocupada';
  /** Tira a faixa da conversa. */
  discard: (conversationId: string) => void;
  clear: () => void;
}

export const useCrmConfirmationStore = create<CrmConfirmationState>((set) => ({
  byConversation: {},

  offer: (conversationId, confirmation) => {
    const rascunho = useDraftsStore.getState().drafts[conversationId]?.text ?? '';
    if (rascunho.trim() !== '') return 'caixa_ocupada';
    // O rascunho vai antes da faixa: quem desenha a faixa compara o texto da
    // caixa com o dela, e nunca pode ver a faixa sem o texto.
    useDraftsStore.getState().setDraft(conversationId, confirmation.text, false);
    // Sem usuário logado o rascunho não grava, e aí a faixa não tem o que dizer.
    if (useDraftsStore.getState().drafts[conversationId]?.text !== confirmation.text) return 'caixa_ocupada';
    set((s) => ({ byConversation: { ...s.byConversation, [conversationId]: confirmation } }));
    return 'escrita';
  },

  discard: (conversationId) =>
    set((s) => {
      if (!(conversationId in s.byConversation)) return s;
      const resto = { ...s.byConversation };
      delete resto[conversationId];
      return { byConversation: resto };
    }),

  clear: () => set({ byConversation: {} }),
}));

// Qualquer troca de usuário apaga as faixas, junto com os rascunhos
// (drafts.store.ts): a confirmação tem o nome do cliente.
let lastUserId = useAuthStore.getState().user?.id ?? null;
useAuthStore.subscribe((state) => {
  const id = state.user?.id ?? null;
  if (id === lastUserId) return;
  lastUserId = id;
  useCrmConfirmationStore.getState().clear();
});
```

- [ ] **Step 4: Rodar os testes do store e ver passar**

Run: `cd frontend && npx vitest run src/stores/crmConfirmation.store.test.ts`
Expected: PASS, os cinco testes.

- [ ] **Step 5: Escrever os testes da faixa no `MessageInput` que falham**

Criar `frontend/src/components/MessageInput.confirmation.test.tsx`:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => {};
});

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(() => new Promise(() => {})), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { useAuthStore } from '../stores/auth.store';
import { useConversationsStore } from '../stores/conversations.store';
import { useCrmConfirmationStore } from '../stores/crmConfirmation.store';
import { useDraftsStore } from '../stores/drafts.store';
import { useMessagesStore } from '../stores/messages.store';
import { useQuickRepliesStore } from '../stores/quick-replies.store';
import { MessageInput } from './MessageInput';
import { TooltipProvider } from './ui/tooltip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ana = {
  id: 'ana',
  name: 'Ana Souza',
  email: 'ana@stronix.test',
  role: 'ATENDENTE' as const,
  avatarUrl: null,
  showSenderName: false,
};

const TEXTO = 'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h.';

let container: HTMLDivElement;
let root: Root;

function montar() {
  act(() =>
    root.render(
      <TooltipProvider>
        <MessageInput key="c1" conversationId="c1" channelType="WHATSAPP" />
      </TooltipProvider>,
    ),
  );
}

const ta = () => container.querySelector('textarea') as HTMLTextAreaElement;
const faixa = () => container.querySelector('[data-crm-confirmacao]');
const botao = (texto: string) =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === texto) ?? null;

function digitar(valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(ta(), valor);
    ta().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  useAuthStore.setState({ user: ana, accessToken: 't' });
  useDraftsStore.setState({ drafts: {} } as never);
  useCrmConfirmationStore.getState().clear();
  useMessagesStore.setState({ rewriteEnabled: false });
  useQuickRepliesStore.setState({ available: [], availableLoaded: true });
  useConversationsStore.setState({ composerFocus: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('confirmação do agendamento no MessageInput', () => {
  test('sem confirmação, nada de faixa', () => {
    montar();
    expect(faixa()).toBeNull();
  });

  test('a confirmação entra na caixa com a faixa da visita, e a caixa espera o envio', () => {
    montar();
    act(() => {
      useCrmConfirmationStore.getState().offer('c1', { text: TEXTO, type: 'visita' });
    });

    expect(ta().value).toBe(TEXTO);
    expect(faixa()?.textContent).toContain('Visita agendada. A confirmação está na caixa.');
    expect(botao('Apagar')).not.toBeNull();
  });

  test('na aula, a faixa diz "Aula agendada."', () => {
    montar();
    act(() => {
      useCrmConfirmationStore.getState().offer('c1', { text: TEXTO, type: 'aula_experimental' });
    });

    expect(faixa()?.textContent).toContain('Aula agendada. A confirmação está na caixa.');
  });

  test('Apagar tira o texto e a faixa e devolve o cursor à caixa', () => {
    montar();
    act(() => {
      useCrmConfirmationStore.getState().offer('c1', { text: TEXTO, type: 'visita' });
    });

    act(() => botao('Apagar')!.click());

    expect(ta().value).toBe('');
    expect(faixa()).toBeNull();
    expect(useCrmConfirmationStore.getState().byConversation.c1).toBeUndefined();
    expect(document.activeElement).toBe(ta());
  });

  test('mexer no texto tira a faixa de vez, mesmo voltando ao texto de antes', () => {
    montar();
    act(() => {
      useCrmConfirmationStore.getState().offer('c1', { text: TEXTO, type: 'visita' });
    });

    digitar(`${TEXTO} Até lá!`);
    expect(faixa()).toBeNull();
    expect(useCrmConfirmationStore.getState().byConversation.c1).toBeUndefined();

    digitar(TEXTO);
    expect(faixa()).toBeNull();
  });

  test('voltar para a conversa mostra a faixa de novo, enquanto o texto for o mesmo', () => {
    montar();
    act(() => {
      useCrmConfirmationStore.getState().offer('c1', { text: TEXTO, type: 'visita' });
    });
    act(() => root.render(<TooltipProvider><div /></TooltipProvider>));

    montar();

    expect(faixa()?.textContent).toContain('Visita agendada.');
  });

  test('caixa em modo nota e vazia: a confirmação entra como mensagem e o modo nota sai', () => {
    montar();
    const maisOpcoes = container.querySelector<HTMLButtonElement>('button[aria-label="Mais opções"]')!;
    act(() => {
      maisOpcoes.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    });
    const criarNota = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
      el.textContent?.includes('Criar nota interna'),
    );
    act(() => criarNota!.click());
    expect(container.textContent).toContain('Modo nota interna');

    act(() => {
      useCrmConfirmationStore.getState().offer('c1', { text: TEXTO, type: 'visita' });
    });

    expect(container.textContent).not.toContain('Modo nota interna');
    expect(ta().value).toBe(TEXTO);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/MessageInput.confirmation.test.tsx`
Expected: FAIL nos testes da faixa (`[data-crm-confirmacao]` não existe) e no do modo nota (a caixa continua em "Modo nota interna"). O primeiro teste ("sem confirmação, nada de faixa") passa.

- [ ] **Step 7: Criar a faixa**

Criar `frontend/src/components/CrmConfirmationBar.tsx`:

```tsx
// Faixa acima da caixa de digitar depois de agendar pelo Stronizap: "Visita
// agendada. A confirmação está na caixa.", com o Apagar. Existe só enquanto a
// caixa tem exatamente o texto da confirmação (`isConfirmationActive`):
// digitar, colar, reescrever com IA ou enviar mudam o texto e a faixa vai
// embora de vez, como o Desfazer da reescrita.
import { useEffect } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useCrmConfirmationStore } from '../stores/crmConfirmation.store';
import { useDraftsStore } from '../stores/drafts.store';
import { useConversationsStore } from '../stores/conversations.store';
import { confirmationBarText, isConfirmationActive } from '../lib/crmSchedule';

export function CrmConfirmationBar({ conversationId }: { conversationId: string }) {
  const text = useDraftsStore((s) => s.drafts[conversationId]?.text ?? '');
  const entry = useCrmConfirmationStore((s) => s.byConversation[conversationId] ?? null);
  const ativa = isConfirmationActive(entry, text);

  // Mexeu no texto: a faixa sai do store, para não voltar se a pessoa
  // escrever o mesmo texto de novo. Lê o rascunho do store, e não do render,
  // como o Desfazer da reescrita.
  useEffect(() => {
    const atual = useCrmConfirmationStore.getState().byConversation[conversationId];
    if (!atual) return;
    const rascunho = useDraftsStore.getState().drafts[conversationId]?.text ?? '';
    if (!isConfirmationActive(atual, rascunho)) useCrmConfirmationStore.getState().discard(conversationId);
  }, [entry, text, conversationId]);

  if (!ativa || !entry) return null;

  function apagar() {
    useDraftsStore.getState().clearDraft(conversationId);
    useCrmConfirmationStore.getState().discard(conversationId);
    useConversationsStore.getState().requestComposerFocus(conversationId);
  }

  return (
    <div
      data-crm-confirmacao=""
      className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-xs"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
    >
      <span role="status" className="inline-flex min-w-0 items-center gap-1.5">
        <CalendarCheck size={14} aria-hidden className="flex-none" />
        <span className="truncate">{confirmationBarText(entry.type)}</span>
      </span>
      <button
        type="button"
        onClick={apagar}
        className="flex-none font-medium underline-offset-2 hover:underline"
        style={{ color: 'var(--ink-2)' }}
      >
        Apagar
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Ligar a faixa no `MessageInput`**

Em `frontend/src/components/MessageInput.tsx`, logo depois de `import { RewriteBar } from './RewriteBar';` (linha 43), acrescentar:

```tsx
import { CrmConfirmationBar } from './CrmConfirmationBar';
import { useCrmConfirmationStore } from '../stores/crmConfirmation.store';
import { isConfirmationActive } from '../lib/crmSchedule';
```

Logo depois de `const rewriteEnabled = useMessagesStore((s) => s.rewriteEnabled);` (linha 155), acrescentar:

```tsx

  // A confirmação do agendamento pelo Stronizap é mensagem para o lead. Ela só
  // entra com a caixa vazia, e se a caixa estava em modo nota, sai do modo
  // nota: senão a confirmação iria como nota interna.
  const confirmationInBox = useCrmConfirmationStore((s) =>
    isConfirmationActive(s.byConversation[conversationId], text),
  );
  useEffect(() => {
    if (confirmationInBox && noteModeRef.current) setNoteModeState(false);
  }, [confirmationInBox]);
```

E, logo depois do bloco da faixa da reescrita, que termina em `) : null}` (linha 940), antes do `<form`, acrescentar:

```tsx

      {/* Faixa da confirmação do agendamento pelo Stronizap, enquanto a caixa
          tiver o texto que entrou. Some durante a reescrita, que fala por ela. */}
      {!rewriting && <CrmConfirmationBar conversationId={conversationId} />}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/components/MessageInput src/stores/crmConfirmation.store.test.ts && npm test`
Expected: typecheck limpo, os 7 testes novos do `MessageInput` e os 5 do store verdes, os outros arquivos do `MessageInput` (inclusive o da reescrita) continuam verdes, e a suíte inteira fica verde (75 arquivos, 859 testes).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/stores/crmConfirmation.store.ts frontend/src/stores/crmConfirmation.store.test.ts frontend/src/components/CrmConfirmationBar.tsx frontend/src/components/MessageInput.tsx frontend/src/components/MessageInput.confirmation.test.tsx
git commit -m "feat: confirmação do agendamento escrita na caixa vazia, com a faixa e o Apagar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: O assistente e o resumo do balão

**Files:**
- Modify: `frontend/src/components/CrmLeadForm.tsx` (linha 47, bloco das linhas 199 a 212, `Botoes` nas linhas 406 a 420 e `CaixaDeErro` na linha 422)
- Create: `frontend/src/components/CrmScheduleSummary.tsx`
- Create: `frontend/src/components/CrmScheduleWizard.tsx`
- Create: `frontend/src/components/CrmScheduleWizard.test.tsx`

O assistente pede as opções ao abrir, mostra os passos com as regras do `lib/crmScheduleWizard.ts` (Task 12) e agenda pelo `lib/crmSchedule.ts` (Task 11). Cada passo respondido vira uma linha com a escolha, que dá para clicar e trocar; o passo atual fica aberto e os seguintes, apagados, como nos mockups 1, 2 e 3. Com tudo respondido, o resumo aparece embaixo das linhas.

O resumo é um componente separado, `CrmScheduleSummary`, porque é nele que o PR 3 põe o bloco do lembrete, entre os passos respondidos e a "Anotação (opcional)". O estado mora no assistente: a anotação e a chave da confirmação não podem sumir quando a pessoa volta a um passo para trocar a escolha.

O `CrmLeadForm.tsx` passa a exportar os botões, a caixa de erro e o aviso de quem está fora da equipe, para os dois balões ficarem iguais. O comportamento do cadastro não muda, e o `CrmLeadForm.test.tsx` continua verde sem mexer numa linha.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/components/CrmScheduleWizard.test.tsx`:

```tsx
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const get = vi.fn();
const post = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { CrmScheduleWizard } from './CrmScheduleWizard';
import type { CrmScheduleOptions, CrmScheduleResult } from '../types/crm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Terça, 29/09, às 15:40 de Brasília, como nos mockups. */
const AGORA = new Date('2026-09-29T18:40:00.000Z');

const OPCOES: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [{ leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null }],
  units: [
    { name: 'Centro', address: 'Rua Garibaldi, 1200' },
    { name: 'Zona Sul', address: null },
  ],
  modalities: [
    { id: 'm1', name: 'Pilates' },
    { id: 'm2', name: 'Funcional' },
  ],
  professors: [
    { id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] },
    { id: 'p2', name: 'Rafael Moura', modalityIds: ['m1'] },
  ],
  trialClassOptions: [1, 2, 3],
  days: [
    { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
    { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
    { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
    { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
    { date: '2026-10-03', label: 'Sábado', defaultTime: '09:00' },
  ],
};

const RESULTADO: CrmScheduleResult = {
  card: { found: true, leadId: 'L1', kind: 'lead', name: 'Mariana Lima' },
  appointment: {
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
  },
  confirmationText: 'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
  alreadyScheduled: false,
};

const onCancel = vi.fn();
const onDone = vi.fn();
const onGone = vi.fn();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  onCancel.mockReset();
  onDone.mockReset();
  onGone.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

async function montar(opcoes: CrmScheduleOptions = OPCOES, props: Partial<ComponentProps<typeof CrmScheduleWizard>> = {}) {
  get.mockResolvedValue({ data: opcoes });
  act(() => {
    root.render(
      <CrmScheduleWizard
        conversationId="conv-1"
        onCancel={onCancel}
        onDone={onDone}
        onGone={onGone}
        now={() => AGORA}
        {...props}
      />,
    );
  });
  await flush();
}

const texto = () => container.textContent ?? '';
const titulo = () => container.querySelector('header span')?.textContent;
const botoes = () => [...container.querySelectorAll<HTMLButtonElement>('button')];
/** Botão pelo texto exato, ou pela primeira linha de texto (opções com dica embaixo). */
function botao(rotulo: string): HTMLButtonElement {
  const achado =
    botoes().find((b) => b.textContent?.trim() === rotulo) ??
    botoes().find((b) => b.querySelector('span span')?.textContent === rotulo);
  if (!achado) throw new Error(`botão "${rotulo}" não achado`);
  return achado;
}
const clicar = async (rotulo: string) => {
  act(() => botao(rotulo).click());
  await flush();
};
const passoAberto = () => container.querySelector('[data-crm-passo]')?.getAttribute('data-crm-passo') ?? null;
const linha = (passo: string) => container.querySelector<HTMLButtonElement>(`[data-crm-linha="${passo}"]`);

function digitarHorario(valor: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Horário"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function visitaAteOResumo() {
  await clicar('Visita');
  await clicar('Centro');
  await clicar('Quinta01/10');
  digitarHorario('18:00');
  await clicar('Continuar');
}

describe('CrmScheduleWizard: abrir', () => {
  test('pede as opções da conversa e mostra "Carregando…" enquanto isso', () => {
    get.mockReturnValue(new Promise(() => {}));
    act(() => {
      root.render(<CrmScheduleWizard conversationId="conv-1" onCancel={onCancel} onDone={onDone} onGone={onGone} />);
    });

    expect(texto()).toContain('Carregando…');
    expect(get).toHaveBeenCalledWith('/conversations/conv-1/crm-schedule-options');
  });

  test('o primeiro passo é "O que vai ser?", com Visita e Aula experimental, e o Cancelar', async () => {
    await montar();

    expect(titulo()).toBe('Agendar');
    expect(passoAberto()).toBe('tipo');
    expect(texto()).toContain('Conhecer a unidade');
    expect(texto()).toContain('Treino de experiência');
    await clicar('Cancelar');
    expect(onCancel).toHaveBeenCalled();
  });

  test('fora da equipe: o aviso do Stronilead no lugar dos passos', async () => {
    const message = 'Seu e-mail do Stronizap, bia@stronix.com.br, não está na equipe do Stronilead.';
    get.mockRejectedValue(Object.assign(new Error('HTTP 403'), { response: { status: 403, data: { error: message, code: 'fora_da_equipe' } } }));
    act(() => {
      root.render(<CrmScheduleWizard conversationId="conv-1" onCancel={onCancel} onDone={onDone} onGone={onGone} />);
    });
    await flush();

    expect(container.querySelector('[data-crm-fora-da-equipe]')?.textContent).toContain(message);
  });

  test('integração desligada: a seção some, como no cadastro', async () => {
    get.mockRejectedValue(Object.assign(new Error('HTTP 412'), { response: { status: 412, data: { error: 'x', code: 'desligado' } } }));
    act(() => {
      root.render(<CrmScheduleWizard conversationId="conv-1" onCancel={onCancel} onDone={onDone} onGone={onGone} />);
    });
    await flush();

    expect(onGone).toHaveBeenCalledWith('desligado');
  });
});

describe('CrmScheduleWizard: visita', () => {
  test('Unidade com o endereço embaixo, depois os cinco dias com o horário do dia, e o resumo', async () => {
    await montar();

    await clicar('Visita');
    expect(titulo()).toBe('Agendar visita');
    expect(passoAberto()).toBe('unidade');
    expect(texto()).toContain('Rua Garibaldi, 1200');

    await clicar('Centro');
    expect(passoAberto()).toBe('dia');
    expect(linha('unidade')?.textContent).toContain('Centro');
    expect(texto()).toContain('Hoje29/09');
    expect(texto()).toContain('Sábado03/10');

    await clicar('Quinta01/10');
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Horário"]')?.value).toBe('09:00');
    digitarHorario('18:00');
    await clicar('Continuar');

    expect(passoAberto()).toBeNull();
    expect(linha('dia')?.textContent).toContain('Quinta, 01/10 às 18:00');
    expect(container.querySelector('[data-crm-meta]')?.textContent).toBe('Conta na sua Meta diária.');
    expect(botao('Confirmar agendamento')).toBeDefined();
  });

  test('confirmar manda só o bloco schedule, com a anotação, e entrega o resultado com a chave da confirmação', async () => {
    post.mockResolvedValueOnce({ data: RESULTADO });
    await montar();
    await visitaAteOResumo();

    const anotacao = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Anotação (opcional)"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(anotacao, 'Vem depois do trabalho.');
      anotacao.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar('Confirmar agendamento');

    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-schedule', {
      schedule: {
        leadId: 'L1',
        type: 'visita',
        unit: 'Centro',
        modality: null,
        professorId: null,
        soloTraining: false,
        quantity: null,
        date: '2026-10-01',
        time: '18:00',
        note: 'Vem depois do trabalho.',
      },
    });
    expect(onDone).toHaveBeenCalledWith(RESULTADO, true);
  });

  test('a chave da confirmação desligada chega a quem fechou o balão', async () => {
    post.mockResolvedValueOnce({ data: RESULTADO });
    await montar();
    await visitaAteOResumo();

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Deixar a confirmação escrita na caixa de mensagem"]')!.click());
    await clicar('Confirmar agendamento');

    expect(onDone).toHaveBeenCalledWith(RESULTADO, false);
  });

  test('academia com uma unidade só: a unidade já vem respondida', async () => {
    await montar({ ...OPCOES, units: [{ name: 'Centro', address: null }] });

    await clicar('Visita');

    expect(linha('unidade')?.textContent).toContain('Centro');
    expect(passoAberto()).toBe('dia');
  });

  test('horário que já passou não é aceito', async () => {
    await montar();
    await clicar('Visita');
    await clicar('Centro');
    await clicar('Hoje29/09');
    digitarHorario('15:00');
    await clicar('Continuar');

    expect(passoAberto()).toBe('dia');
    expect(container.querySelector('[data-crm-erro-do-passo]')?.textContent).toBe('Esse horário já passou. Escolha outro.');
  });

  test('Voltar leva ao passo de antes, e a linha respondida abre o passo dela', async () => {
    await montar();
    await clicar('Visita');
    await clicar('Voltar');
    expect(passoAberto()).toBe('tipo');

    await clicar('Visita');
    await clicar('Centro');
    act(() => linha('unidade')!.click());
    await flush();
    expect(passoAberto()).toBe('unidade');
  });
});

describe('CrmScheduleWizard: aula experimental', () => {
  test('Modalidade, Professor só de quem dá a modalidade mais "Treina sozinho", Quantas aulas e Dia e horário', async () => {
    post.mockResolvedValueOnce({ data: RESULTADO });
    await montar();

    await clicar('Aula experimental');
    expect(titulo()).toBe('Agendar aula experimental');
    await clicar('Pilates');
    expect(passoAberto()).toBe('professor');
    expect(texto()).toContain('Carla Dias');
    expect(texto()).toContain('Treina sozinho');
    await clicar('Carla Dias');
    await clicar('2 aulas');
    await clicar('Sexta02/10');
    digitarHorario('19:00');
    await clicar('Continuar');
    await clicar('Confirmar agendamento');

    expect(post.mock.calls[0][1]).toEqual({
      schedule: {
        leadId: 'L1',
        type: 'aula_experimental',
        unit: null,
        modality: 'Pilates',
        professorId: 'p1',
        soloTraining: false,
        quantity: 2,
        date: '2026-10-02',
        time: '19:00',
        note: null,
      },
    });
  });

  test('modalidade sem professor: o aviso do Stronilead e só "Treina sozinho"', async () => {
    await montar();
    await clicar('Aula experimental');
    await clicar('Funcional');

    expect(texto()).toContain('Nenhum professor cadastrado para Funcional.');
    expect(texto()).not.toContain('Carla Dias');
    expect(botao('Treina sozinho')).toBeDefined();
  });
});

describe('CrmScheduleWizard: para quem e remarcação', () => {
  test('número de responsável com dois menores: "Para quem?" primeiro, com o parentesco como veio do Stronilead', async () => {
    await montar({
      ...OPCOES,
      targets: [
        { leadId: 'L2', name: 'Pedro Souza', relationship: 'Filho', appointment: null },
        { leadId: 'L3', name: 'Laura Souza', relationship: null, appointment: null },
      ],
    });

    expect(passoAberto()).toBe('para_quem');
    // Embaixo do nome, o parentesco como veio; sem ele (o Stronilead não sabe o gênero), só o nome.
    const linhasDe = (nome: string) => [...botao(nome).querySelectorAll('span span')].map((s) => s.textContent);
    expect(linhasDe('Pedro Souza')).toEqual(['Pedro Souza', 'Filho']);
    expect(linhasDe('Laura Souza')).toEqual(['Laura Souza']);
    await clicar('Pedro Souza');

    expect(passoAberto()).toBe('tipo');
    expect(linha('para_quem')?.textContent).toContain('Pedro Souza');
  });

  test('já tem visita marcada: aviso no topo, e o título e o botão viram "Remarcar visita"', async () => {
    await montar({
      ...OPCOES,
      targets: [
        {
          leadId: 'L1',
          name: 'Mariana Lima',
          relationship: null,
          appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null },
        },
      ],
    });
    await visitaAteOResumo();

    expect(titulo()).toBe('Remarcar visita');
    expect(container.querySelector('[data-crm-remarcacao]')?.textContent).toBe(
      'Mariana já tem visita marcada para quarta, 30/09, às 18:00. Agendar de novo troca o dia e o horário.',
    );
    expect(botao('Remarcar visita')).toBeDefined();
  });

  test('gestor, ou dia fora da meta: sem "Conta na sua Meta diária.", com o Cancelar no lugar', async () => {
    await montar({ ...OPCOES, actor: { ...OPCOES.actor, role: 'gestor', countsForMeta: false } });
    await visitaAteOResumo();

    expect(container.querySelector('[data-crm-meta]')).toBeNull();
    expect(botao('Cancelar')).toBeDefined();
  });
});

describe('CrmScheduleWizard: falhas', () => {
  test('Stronilead fora do ar: o que foi escolhido fica, e o botão vira "Tentar de novo"', async () => {
    post.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    post.mockResolvedValueOnce({ data: RESULTADO });
    await montar();
    await visitaAteOResumo();

    await clicar('Confirmar agendamento');
    expect(texto()).toContain('Não deu para falar com o Stronilead agora.');
    expect(linha('dia')?.textContent).toContain('Quinta, 01/10 às 18:00');

    await clicar('Tentar de novo');
    expect(post).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith(RESULTADO, true);
  });

  test('unidade apagada no Stronilead: a recusa aparece no passo dela, e as opções voltam de lá', async () => {
    const message = 'Essa unidade não existe mais no Stronilead. Escolha de novo.';
    post.mockRejectedValueOnce(
      Object.assign(new Error('HTTP 422'), {
        response: { status: 422, data: { error: message, code: 'catalogo_mudou', field: 'unit' } },
      }),
    );
    await montar();
    await visitaAteOResumo();
    get.mockResolvedValue({ data: { ...OPCOES, units: [{ name: 'Zona Sul', address: null }, { name: 'Moinhos', address: null }] } });

    await clicar('Confirmar agendamento');

    expect(get).toHaveBeenCalledTimes(2);
    expect(passoAberto()).toBe('unidade');
    expect(container.querySelector('[data-crm-erro-do-passo]')?.textContent).toBe(message);
    expect(texto()).not.toContain('Centro');
    expect(linha('dia')?.textContent).toContain('Quinta, 01/10 às 18:00');
  });

  test('recusa sem campo aparece na área do resumo, com o texto do Stronilead', async () => {
    const message = 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.';
    post.mockRejectedValueOnce(
      Object.assign(new Error('HTTP 429'), { response: { status: 429, data: { error: message, code: 'limite' } } }),
    );
    await montar();
    await visitaAteOResumo();

    await clicar('Confirmar agendamento');

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(passoAberto()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmScheduleWizard.test.tsx`
Expected: FAIL, com `Failed to resolve import "./CrmScheduleWizard"`.

- [ ] **Step 3: Exportar do `CrmLeadForm.tsx` o que os dois balões dividem**

Em `frontend/src/components/CrmLeadForm.tsx`, trocar a linha 47:

```tsx
const BOTAO_PRINCIPAL = 'sx-btn-primary h-[30px] rounded-lg px-3.5 text-xs';
```

por:

```tsx
/** Botões do balão, divididos com o agendamento (CrmScheduleWizard). */
export const BOTAO_PRINCIPAL = 'sx-btn-primary h-[30px] rounded-lg px-3.5 text-xs';
export const BOTAO_FANTASMA =
  'inline-flex h-[30px] items-center rounded-lg px-2.5 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10';
```

Trocar o bloco das linhas 199 a 212:

```tsx
  if (fase.kind === 'fora_da_equipe') {
    return (
      <div
        data-crm-fora-da-equipe=""
        className="flex gap-2 rounded-[10px] p-2.5"
        style={{ background: 'var(--bg-soft)' }}
      >
        <UserX size={16} aria-hidden className="mt-px flex-none" style={{ color: 'var(--ink-3)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {fase.message}
        </p>
      </div>
    );
  }
```

por:

```tsx
  if (fase.kind === 'fora_da_equipe') return <AvisoForaDaEquipe message={fase.message} />;
```

No `Botoes` (linhas 406 a 420), trocar o botão:

```tsx
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-[30px] items-center rounded-lg px-2.5 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
        style={{ color: 'var(--ink-2)' }}
      >
        Cancelar
      </button>
```

por:

```tsx
      <button type="button" onClick={onCancel} className={BOTAO_FANTASMA} style={{ color: 'var(--ink-2)' }}>
        Cancelar
      </button>
```

E trocar a linha 422:

```tsx
function CaixaDeErro({ children }: { children: ReactNode }) {
```

por:

```tsx
/**
 * Quem não está na equipe do Stronilead com o mesmo e-mail vê o texto que o
 * Stronilead mandou. O mesmo aviso no cadastro e no agendamento.
 */
export function AvisoForaDaEquipe({ message }: { message: string }) {
  return (
    <div data-crm-fora-da-equipe="" className="flex gap-2 rounded-[10px] p-2.5" style={{ background: 'var(--bg-soft)' }}>
      <UserX size={16} aria-hidden className="mt-px flex-none" style={{ color: 'var(--ink-3)' }} />
      <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        {message}
      </p>
    </div>
  );
}

export function CaixaDeErro({ children }: { children: ReactNode }) {
```

O `FALHA_AO_ABRIR` (linha 36) já é exportado e fica como está.

- [ ] **Step 4: Criar o resumo**

Criar `frontend/src/components/CrmScheduleSummary.tsx`:

```tsx
// O resumo e o rodapé do balão do agendamento, embaixo dos passos
// respondidos: a anotação, a chave da confirmação, os avisos de falha e o
// botão. O estado mora no assistente (CrmScheduleWizard), porque a anotação
// não pode sumir quando a pessoa volta a um passo para trocar a escolha.
//
// O lembrete (PR 3) entra neste componente, entre os passos respondidos e a
// "Anotação (opcional)", como a spec pede.
import { useId } from 'react';
import { Switch } from './ui/switch';
import { BOTAO_FANTASMA, BOTAO_PRINCIPAL, CaixaDeErro, FALHA_AO_ABRIR } from './CrmLeadForm';
import { NOTE_MAX } from '../lib/crmScheduleWizard';

export interface CrmScheduleSummaryProps {
  note: string;
  onNoteChange: (note: string) => void;
  /** Recusa do Stronilead no campo da anotação. */
  noteError?: string;
  /** "Deixar a confirmação escrita na caixa de mensagem". */
  writeConfirmation: boolean;
  onWriteConfirmationChange: (on: boolean) => void;
  /** O Stronilead diz que agendar hoje conta na Meta Diária de quem agenda. */
  countsForMeta: boolean;
  /** "Confirmar agendamento", "Remarcar visita" ou "Remarcar aula". */
  confirmLabel: string;
  sending: boolean;
  /** O Stronilead não respondeu: o que foi escolhido fica, e o botão vira "Tentar de novo". */
  retry: boolean;
  /** Recusa que não é de um passo nem da anotação. */
  generalError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CrmScheduleSummary({
  note,
  onNoteChange,
  noteError,
  writeConfirmation,
  onWriteConfirmationChange,
  countsForMeta,
  confirmLabel,
  sending,
  retry,
  generalError,
  onConfirm,
  onCancel,
}: CrmScheduleSummaryProps) {
  const id = useId();
  const rotulo = sending ? 'Agendando…' : retry ? 'Tentar de novo' : confirmLabel;

  return (
    <div className="flex flex-col gap-2.5 pt-2.5">
      {/* O bloco do lembrete (PR 3) entra aqui, entre os passos e a Anotação. */}

      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${id}anotacao`} className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
          Anotação (opcional)
        </label>
        <textarea
          id={`${id}anotacao`}
          aria-label="Anotação (opcional)"
          aria-invalid={noteError ? true : undefined}
          className="crm-field crm-field--area"
          value={note}
          placeholder="O que precisa ser tratado nesse contato?"
          rows={2}
          maxLength={NOTE_MAX}
          onChange={(e) => onNoteChange(e.target.value)}
        />
        {noteError && (
          <p className="text-[11px] leading-snug" style={{ color: 'var(--notice-danger)' }}>
            {noteError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id={`${id}confirmacao`}
          checked={writeConfirmation}
          onCheckedChange={onWriteConfirmationChange}
          aria-label="Deixar a confirmação escrita na caixa de mensagem"
        />
        <label htmlFor={`${id}confirmacao`} className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
          Deixar a confirmação escrita na caixa de mensagem
        </label>
      </div>

      {generalError && <CaixaDeErro>{generalError}</CaixaDeErro>}
      {retry && !sending && <CaixaDeErro>{FALHA_AO_ABRIR}</CaixaDeErro>}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        {countsForMeta ? (
          <span data-crm-meta="" className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Conta na sua Meta diária.
          </span>
        ) : (
          <button type="button" onClick={onCancel} className={BOTAO_FANTASMA} style={{ color: 'var(--ink-2)' }}>
            Cancelar
          </button>
        )}
        <button type="button" className={BOTAO_PRINCIPAL} disabled={sending} onClick={onConfirm}>
          {rotulo}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Criar o assistente**

Criar `frontend/src/components/CrmScheduleWizard.tsx`:

```tsx
// Assistente do agendamento no Stronilead, dentro do balão
// (CrmScheduleBalloon), que abre pelo "Agendar" do header da conversa. Spec
// em stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md,
// "O balão, passo a passo".
//
// Cada abertura pede as opções ao Stronilead (`schedule-options`): nenhuma
// lista mora no Stronizap. Cada passo respondido vira uma linha com a
// escolha, que dá para clicar e trocar; o passo atual fica aberto e os
// seguintes, apagados. Com tudo respondido, o resumo (CrmScheduleSummary)
// mostra a anotação, a chave da confirmação e o botão.
//
// As falhas seguem as do cadastro: Stronilead fora do ar deixa o que foi
// escolhido e o botão vira "Tentar de novo"; a recusa aparece com o texto do
// Stronilead, no passo do campo quando ela diz qual; e quando uma lista mudou,
// as opções voltam de lá com o que ainda vale do que foi escolhido.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  Dumbbell,
  Footprints,
  GraduationCap,
  Pencil,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from './ui/calendar';
import { StronileadLockup } from './StronileadMark';
import { AvisoForaDaEquipe, BOTAO_FANTASMA, BOTAO_PRINCIPAL, CaixaDeErro, FALHA_AO_ABRIR } from './CrmLeadForm';
import { CrmScheduleSummary } from './CrmScheduleSummary';
import { fetchScheduleOptions, scheduleAppointment } from '../lib/crmSchedule';
import type { LeadFailure } from '../lib/crmLead';
import { calendarDate, ddmm, fromCalendarDate, todayInBrasilia } from '../lib/crmAppointment';
import {
  buildScheduleInput,
  chooseModality,
  chooseProfessor,
  chooseQuantity,
  chooseTarget,
  chooseType,
  chooseUnit,
  confirmLabel,
  DAY_PAST,
  fitScheduleToOptions,
  initialScheduleValues,
  isAnswered,
  isPast,
  NO_MODALITY,
  noProfessorNotice,
  openStep,
  pickDay,
  previousStep,
  professorsFor,
  quantityLabel,
  RELOAD_ON,
  rescheduleNotice,
  scheduleSteps,
  scheduleTitle,
  setTime,
  SOLO,
  SOLO_LABEL,
  STEP_HINTS,
  STEP_TITLES,
  stepOfRefusal,
  stepValue,
  visibleSteps,
  type ScheduleStep,
  type ScheduleValues,
} from '../lib/crmScheduleWizard';
import type { CrmScheduleOptions, CrmScheduleResult } from '../types/crm';

type Fase =
  | { kind: 'carregando' }
  | { kind: 'falha_ao_abrir' }
  | { kind: 'recusado_ao_abrir'; message: string }
  | { kind: 'fora_da_equipe'; message: string }
  | { kind: 'pronto' }
  | { kind: 'enviando' };

type Recusa = Extract<LeadFailure, { kind: 'recusa' }>;
type Erros = Partial<Record<ScheduleStep | 'note', string>>;

interface Props {
  conversationId: string;
  onCancel: () => void;
  /** Agendou, ou já estava agendado: o balão fecha e a confirmação vai para a caixa. */
  onDone: (result: CrmScheduleResult, writeConfirmation: boolean) => void;
  /** Integração desligada ou chave recusada: a seção do Stronilead some, como no cartão. */
  onGone: (reason: 'desligado' | 'indisponivel') => void;
  /** Relógio do horário que já passou. O teste passa o dele. */
  now?: () => Date;
}

const agoraDeVerdade = () => new Date();

export function CrmScheduleWizard({ conversationId, onCancel, onDone, onGone, now = agoraDeVerdade }: Props) {
  const [fase, setFase] = useState<Fase>({ kind: 'carregando' });
  const [options, setOptions] = useState<CrmScheduleOptions | null>(null);
  const [values, setValues] = useState<ScheduleValues | null>(null);
  // Passo que a pessoa pediu para trocar (a linha clicada ou o Voltar).
  const [editing, setEditing] = useState<ScheduleStep | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [avisoGeral, setAvisoGeral] = useState<string | null>(null);
  const [semResposta, setSemResposta] = useState(false);

  // Fechar o balão desmonta o assistente com um pedido no ar. A resposta que
  // chega depois não mexe em nada: o socket já leva o cartão novo a quem está
  // com o contato aberto.
  const vivo = useRef(false);
  const ultimoPedido = useRef(0);
  const saidas = useRef({ onDone, onGone });
  useEffect(() => {
    saidas.current = { onDone, onGone };
  });

  async function carregarOpcoes(manterValores: boolean) {
    const meu = ++ultimoPedido.current;
    if (!manterValores) setFase({ kind: 'carregando' });
    const r = await fetchScheduleOptions(conversationId);
    if (!vivo.current || meu !== ultimoPedido.current) return;
    if (r.kind === 'ok') {
      setOptions(r.options);
      setValues((atual) =>
        manterValores && atual ? fitScheduleToOptions(atual, r.options) : initialScheduleValues(r.options),
      );
      if (!manterValores) setFase({ kind: 'pronto' });
      return;
    }
    // Recarga depois de uma recusa: o balão segue como está.
    if (manterValores) return;
    if (r.kind === 'sumiu') saidas.current.onGone(r.reason);
    else if (r.kind === 'indisponivel') setFase({ kind: 'falha_ao_abrir' });
    else if (r.code === 'fora_da_equipe') setFase({ kind: 'fora_da_equipe', message: r.message });
    else setFase({ kind: 'recusado_ao_abrir', message: r.message });
  }

  useEffect(() => {
    vivo.current = true;
    void carregarOpcoes(false);
    return () => {
      vivo.current = false;
    };
    // Uma vez por abertura: o balão desmonta o assistente ao fechar, e as
    // opções voltam do Stronilead toda vez.
  }, []);

  function limparErro(chave: ScheduleStep | 'note') {
    setErros((atual) => {
      if (!(chave in atual)) return atual;
      const novo = { ...atual };
      delete novo[chave];
      return novo;
    });
  }

  /** Uma escolha: o erro do passo sai e, a não ser no dia e horário, o passo fecha. */
  function responder(passo: ScheduleStep, muda: (v: ScheduleValues) => ScheduleValues, fechar = true) {
    setValues((atual) => (atual ? muda(atual) : atual));
    limparErro(passo);
    setAvisoGeral(null);
    if (fechar) setEditing(null);
  }

  function continuarDia() {
    if (!values) return;
    if (isPast(values, now())) {
      setErros((atual) => ({ ...atual, dia: DAY_PAST }));
      return;
    }
    responder('dia', (v) => ({ ...v, dayConfirmed: true }));
  }

  function aplicarRecusa(r: Recusa, valores: ScheduleValues, opcoes: CrmScheduleOptions) {
    if (r.code === 'fora_da_equipe') {
      setFase({ kind: 'fora_da_equipe', message: r.message });
      return;
    }
    const passo = stepOfRefusal(r.code, r.field);
    if (passo === 'note') {
      setErros({ note: r.message });
    } else if (passo && scheduleSteps(valores, opcoes).includes(passo)) {
      const novos: Erros = {};
      novos[passo] = r.message;
      setErros(novos);
      // O dia volta a ficar sem resposta e se abre sozinho; os outros passos
      // se abrem como uma linha clicada.
      if (passo === 'dia') setValues((v) => (v ? { ...v, dayConfirmed: false } : v));
      else setEditing(passo);
    } else {
      setAvisoGeral(r.message);
    }
    // Item apagado do catálogo, menor que não é mais deste número: as listas
    // mudaram no Stronilead e voltam de lá, com o que ainda vale.
    if (r.code && RELOAD_ON.includes(r.code)) void carregarOpcoes(true);
  }

  async function enviar() {
    if (!options || !values || fase.kind !== 'pronto') return;
    // O balão pode ficar aberto até o horário passar.
    if (isPast(values, now())) {
      setValues({ ...values, dayConfirmed: false });
      setErros({ dia: DAY_PAST });
      setEditing(null);
      return;
    }
    setErros({});
    setAvisoGeral(null);
    setFase({ kind: 'enviando' });
    const r = await scheduleAppointment(conversationId, { schedule: buildScheduleInput(values) });
    if (!vivo.current) return;
    switch (r.kind) {
      case 'agendado':
        saidas.current.onDone(r.result, values.writeConfirmation);
        return;
      case 'sumiu':
        saidas.current.onGone(r.reason);
        return;
      case 'indisponivel':
        setFase({ kind: 'pronto' });
        setSemResposta(true);
        return;
      case 'recusa':
        setFase({ kind: 'pronto' });
        setSemResposta(false);
        aplicarRecusa(r, values, options);
        return;
    }
  }

  const titulo = options && values ? scheduleTitle(values, options) : 'Agendar';

  function corpo(): ReactNode {
    if (fase.kind === 'carregando') {
      return (
        <p role="status" className="py-2.5 text-xs" style={{ color: 'var(--ink-3)' }}>
          Carregando…
        </p>
      );
    }
    if (fase.kind === 'fora_da_equipe') {
      return (
        <div className="pt-2.5">
          <AvisoForaDaEquipe message={fase.message} />
        </div>
      );
    }
    if (fase.kind === 'falha_ao_abrir' || fase.kind === 'recusado_ao_abrir') {
      return (
        <div className="flex flex-col gap-2.5 pt-2.5">
          <CaixaDeErro>{fase.kind === 'falha_ao_abrir' ? FALHA_AO_ABRIR : fase.message}</CaixaDeErro>
          <div className="flex justify-end gap-1">
            <button type="button" onClick={onCancel} className={BOTAO_FANTASMA} style={{ color: 'var(--ink-2)' }}>
              Cancelar
            </button>
            {fase.kind === 'falha_ao_abrir' && (
              <button type="button" className={BOTAO_PRINCIPAL} onClick={() => void carregarOpcoes(false)}>
                Tentar de novo
              </button>
            )}
          </div>
        </div>
      );
    }
    if (!options || !values) return null;

    if (options.targets.length === 0) {
      return (
        <div className="flex flex-col gap-2.5 pt-2.5">
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
            Esse número não está na base.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onCancel} className={BOTAO_FANTASMA} style={{ color: 'var(--ink-2)' }}>
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    const aberto = openStep(values, options, editing);
    const aviso = rescheduleNotice(values, options);

    return (
      <>
        {aviso && (
          <div
            data-crm-remarcacao=""
            className="mt-2.5 flex gap-2 rounded-[10px] p-2.5 text-[11.5px] leading-snug"
            style={{ background: 'var(--bg-soft)', color: 'var(--ink-2)' }}
          >
            <CalendarDays size={16} aria-hidden className="mt-px flex-none" style={{ color: 'var(--ink-3)' }} />
            <span>{aviso}</span>
          </div>
        )}

        {visibleSteps(values, options, editing).map((passo, i) => {
          if (passo === aberto) {
            return (
              <PassoAberto key={passo} n={i + 1} passo={passo} erro={erros[passo]}>
                {corpoDoPasso(passo, values, options)}
              </PassoAberto>
            );
          }
          if (isAnswered(passo, values, options)) {
            return (
              <LinhaRespondida
                key={passo}
                passo={passo}
                valor={stepValue(passo, values, options)}
                onClick={() => setEditing(passo)}
              />
            );
          }
          return <LinhaApagada key={passo} n={i + 1} passo={passo} />;
        })}

        {aberto === null ? (
          <CrmScheduleSummary
            note={values.note}
            onNoteChange={(note) => {
              setValues((v) => (v ? { ...v, note } : v));
              limparErro('note');
            }}
            noteError={erros.note}
            writeConfirmation={values.writeConfirmation}
            onWriteConfirmationChange={(on) => setValues((v) => (v ? { ...v, writeConfirmation: on } : v))}
            countsForMeta={options.actor.countsForMeta}
            confirmLabel={confirmLabel(values, options)}
            sending={fase.kind === 'enviando'}
            retry={semResposta}
            generalError={avisoGeral}
            onConfirm={() => void enviar()}
            onCancel={onCancel}
          />
        ) : (
          <RodapeDoPasso
            anterior={previousStep(aberto, values, options)}
            noDia={aberto === 'dia'}
            podeContinuar={Boolean(values.date && values.time)}
            onVoltar={(passo) => setEditing(passo)}
            onContinuar={continuarDia}
            onCancel={onCancel}
          />
        )}
      </>
    );
  }

  function corpoDoPasso(passo: ScheduleStep, v: ScheduleValues, o: CrmScheduleOptions): ReactNode {
    switch (passo) {
      case 'para_quem':
        return o.targets.map((t) => (
          <Opcao
            key={t.leadId}
            icon={User}
            label={t.name ?? 'Sem nome'}
            hint={t.relationship ?? undefined}
            selected={v.leadId === t.leadId}
            onClick={() => responder('para_quem', (atual) => chooseTarget(atual, t.leadId))}
          />
        ));
      case 'tipo':
        return (
          <>
            <Opcao
              icon={Building2}
              label="Visita"
              hint="Conhecer a unidade"
              selected={v.type === 'visita'}
              onClick={() => responder('tipo', (atual) => chooseType(atual, 'visita', o))}
            />
            <Opcao
              icon={Dumbbell}
              label="Aula experimental"
              hint="Treino de experiência"
              selected={v.type === 'aula_experimental'}
              onClick={() => responder('tipo', (atual) => chooseType(atual, 'aula_experimental', o))}
            />
          </>
        );
      case 'unidade':
        return o.units.map((u) => (
          <Opcao
            key={u.name}
            icon={Building2}
            label={u.name}
            hint={u.address ?? undefined}
            selected={v.unit === u.name}
            onClick={() => responder('unidade', (atual) => chooseUnit(atual, u.name))}
          />
        ));
      case 'modalidade':
        if (o.modalities.length === 0) return <Aviso>{NO_MODALITY}</Aviso>;
        return o.modalities.map((m) => (
          <Opcao
            key={m.id}
            icon={Dumbbell}
            label={m.name}
            selected={v.modality === m.name}
            onClick={() => responder('modalidade', (atual) => chooseModality(atual, m.name, o))}
          />
        ));
      case 'professor': {
        const lista = professorsFor(o, v.modality);
        return (
          <>
            {lista.map((p) => (
              <Opcao
                key={p.id}
                icon={GraduationCap}
                label={p.name}
                selected={v.professor === p.id}
                onClick={() => responder('professor', (atual) => chooseProfessor(atual, p.id))}
              />
            ))}
            <Opcao
              icon={Footprints}
              label={SOLO_LABEL}
              selected={v.professor === SOLO}
              onClick={() => responder('professor', (atual) => chooseProfessor(atual, SOLO))}
            />
            {lista.length === 0 && <Aviso>{noProfessorNotice(v.modality)}</Aviso>}
          </>
        );
      }
      case 'quantidade':
        return (
          <div className="flex flex-wrap gap-1.5">
            {o.trialClassOptions.map((n) => (
              <Pilula
                key={n}
                selected={v.quantity === n}
                onClick={() => responder('quantidade', (atual) => chooseQuantity(atual, n))}
              >
                {quantityLabel(n)}
              </Pilula>
            ))}
          </div>
        );
      case 'dia': {
        const hoje = todayInBrasilia(now());
        return (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-5 gap-1.5">
              {o.days.map((d) => {
                const escolhido = v.date === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    aria-pressed={escolhido}
                    onClick={() => {
                      setCalendarOpen(false);
                      responder('dia', (atual) => pickDay(atual, d.date, o), false);
                    }}
                    className="rounded-lg border pb-1.5 pt-1 text-center leading-tight transition"
                    style={{
                      borderColor: escolhido ? 'var(--accent)' : 'var(--border-strong)',
                      background: escolhido ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <span className="block text-[10px]" style={{ color: escolhido ? 'var(--accent-ink)' : 'var(--ink-3)' }}>
                      {d.label}
                    </span>
                    <span
                      className="mono block text-xs font-semibold tabular-nums"
                      style={{ color: escolhido ? 'var(--accent-ink)' : 'var(--ink)' }}
                    >
                      {ddmm(d.date)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <label className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  Horário
                </span>
                <input
                  type="time"
                  aria-label="Horário"
                  className="crm-field mono w-[92px]"
                  value={v.time}
                  onChange={(e) => responder('dia', (atual) => setTime(atual, e.target.value), false)}
                />
              </label>
              <button
                type="button"
                aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen((a) => !a)}
                className="inline-flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                <CalendarDays size={14} aria-hidden />
                Outro dia
              </button>
            </div>
            {calendarOpen && (
              <Calendar
                mode="single"
                selected={v.date ? calendarDate(v.date) : undefined}
                defaultMonth={calendarDate(v.date || hoje)}
                disabled={{ before: calendarDate(hoje) }}
                onSelect={(d) => {
                  if (d) responder('dia', (atual) => pickDay(atual, fromCalendarDate(d), o), false);
                }}
                className="rounded-lg border"
              />
            )}
          </div>
        );
      }
    }
  }

  return (
    <>
      <header
        className="flex flex-none items-center justify-between gap-2 border-b px-3.5 py-2.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="font-display text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
          {titulo}
        </span>
        <StronileadLockup />
      </header>
      <div className="min-h-0 overflow-y-auto px-3.5 pb-3.5">{corpo()}</div>
    </>
  );
}

function Numero({ n, atual = false }: { n: number; atual?: boolean }) {
  return (
    <span
      className={cn('grid size-5 flex-none place-items-center rounded-full text-[10.5px] font-semibold', atual && 'text-white')}
      style={atual ? { background: 'var(--accent)' } : { background: 'var(--bg-soft)', color: 'var(--ink-3)' }}
    >
      {n}
    </span>
  );
}

function PassoAberto({
  n,
  passo,
  erro,
  children,
}: {
  n: number;
  passo: ScheduleStep;
  erro?: string;
  children: ReactNode;
}) {
  const dica = STEP_HINTS[passo];
  return (
    <div data-crm-passo={passo} className="flex flex-col gap-2 border-b pb-3 pt-2.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        <Numero n={n} atual />
        <b className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
          {STEP_TITLES[passo]}
        </b>
        {dica && (
          <span className="truncate text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {dica}
          </span>
        )}
      </div>
      {children}
      {erro && (
        <p data-crm-erro-do-passo="" className="text-[11px] leading-snug" style={{ color: 'var(--notice-danger)' }}>
          {erro}
        </p>
      )}
    </div>
  );
}

function LinhaRespondida({ passo, valor, onClick }: { passo: ScheduleStep; valor: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      data-crm-linha={passo}
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b py-2 text-left text-xs"
      style={{ borderColor: 'var(--border)' }}
    >
      <span
        className="grid size-5 flex-none place-items-center rounded-full"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
      >
        <Check size={12} aria-hidden />
      </span>
      <span style={{ color: 'var(--ink-2)' }}>{STEP_TITLES[passo]}</span>
      <span className="ml-auto min-w-0 truncate font-medium" style={{ color: 'var(--ink)' }}>
        {valor}
      </span>
      <Pencil size={13} aria-hidden className="flex-none" style={{ color: 'var(--ink-4)' }} />
    </button>
  );
}

function LinhaApagada({ n, passo }: { n: number; passo: ScheduleStep }) {
  return (
    <div className="flex items-center gap-2 border-b py-2 text-xs opacity-50" style={{ borderColor: 'var(--border)' }}>
      <Numero n={n} />
      <span style={{ color: 'var(--ink-2)' }}>{STEP_TITLES[passo]}</span>
    </div>
  );
}

function RodapeDoPasso({
  anterior,
  noDia,
  podeContinuar,
  onVoltar,
  onContinuar,
  onCancel,
}: {
  anterior: ScheduleStep | null;
  noDia: boolean;
  podeContinuar: boolean;
  onVoltar: (passo: ScheduleStep) => void;
  onContinuar: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-3">
      {anterior ? (
        <button type="button" onClick={() => onVoltar(anterior)} className={BOTAO_FANTASMA} style={{ color: 'var(--ink-2)' }}>
          Voltar
        </button>
      ) : (
        <span />
      )}
      {noDia ? (
        <button type="button" className={BOTAO_PRINCIPAL} disabled={!podeContinuar} onClick={onContinuar}>
          Continuar
        </button>
      ) : anterior ? (
        <button type="button" className={BOTAO_PRINCIPAL} disabled>
          Complete os passos
        </button>
      ) : (
        <button type="button" onClick={onCancel} className={BOTAO_FANTASMA} style={{ color: 'var(--ink-2)' }}>
          Cancelar
        </button>
      )}
    </div>
  );
}

function Opcao({
  icon: Icone,
  label,
  hint,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border-strong)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
      }}
    >
      <span
        className="grid size-[30px] flex-none place-items-center rounded-lg"
        style={{
          background: selected ? 'var(--bg-elev)' : 'var(--bg-soft)',
          color: selected ? 'var(--accent)' : 'var(--ink-2)',
        }}
      >
        <Icone size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
          {label}
        </span>
        {hint && (
          <span className="block truncate text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {hint}
          </span>
        )}
      </span>
      {selected && <Check size={15} aria-hidden className="flex-none" style={{ color: 'var(--accent)' }} />}
    </button>
  );
}

function Pilula({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="h-[30px] rounded-lg border px-3 text-xs font-medium transition"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border-strong)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent-ink)' : 'var(--ink)',
      }}
    >
      {children}
    </button>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>
      {children}
    </p>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/components/CrmScheduleWizard.test.tsx src/components/CrmLeadForm.test.tsx && npm test`
Expected: typecheck limpo, os 18 testes do assistente e os 22 do `CrmLeadForm.test.tsx` (sem mudança) verdes, e a suíte inteira verde (76 arquivos, 877 testes).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CrmLeadForm.tsx frontend/src/components/CrmScheduleSummary.tsx frontend/src/components/CrmScheduleWizard.tsx frontend/src/components/CrmScheduleWizard.test.tsx
git commit -m "feat: assistente do agendamento no Stronilead, passo a passo, com o resumo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: O balão, o "Agendar" no header e um balão por vez

**Files:**
- Create: `frontend/src/lib/crmBalloon.ts`
- Create: `frontend/src/lib/crmBalloon.test.ts`
- Create: `frontend/src/components/CrmScheduleBalloon.tsx`
- Create: `frontend/src/components/CrmScheduleBalloon.test.tsx`
- Modify: `frontend/src/components/CrmHeaderMeta.tsx` (linhas 19 a 37, 79 a 82 e 98 a 102)
- Modify: `frontend/src/components/CrmHeaderMeta.test.tsx` (linha 25, linhas 69 a 79 e bloco novo no fim)
- Modify: `frontend/src/components/ChatWindow.tsx` (linhas 45 a 55 e 492 a 497)
- Modify: `frontend/src/pages/ChatPage.tsx` (linha 24, linhas 48 a 53, 82 a 87, 154 e 155, 167 a 174, 218 a 220)

O balão do agendamento segue o do cadastro (`CrmLeadBalloon`): abre logo abaixo do link, com 380px; clicar fora fecha e deixa o foco onde a pessoa clicou; Cancelar, Esc e o agendamento feito fecham e devolvem o cursor para a caixa. Depois de agendar, ele troca o cartão no store, marca o "Agendado agora por você" e oferece a confirmação à caixa pelo `useCrmConfirmationStore.offer`. Quando a confirmação não entra (caixa ocupada ou chave desligada), o toast diz que o agendamento foi feito, porque o painel com o cartão pode estar fechado (nota 14).

O "Agendar" fica no `CrmHeaderMeta`, depois da situação do cadastro, como no mockup 1: "Lead · Primeiro contato · Ana Souza · Agendar". Aparece com o cartão achado (lead, cliente ou responsável por um menor), em contato de WhatsApp com número e fora da sessão do superadmin entrando como admin, o mesmo recorte do "Cadastrar". Sem cartão (integração desligada ou Stronilead fora do ar), o item inteiro já some hoje, e o "Agendar" some junto.

O `ChatPage` guarda hoje só o balão do cadastro (`leadForm`). Ele passa a guardar um balão só, o do cadastro ou o do agendamento, com a regra pura de `lib/crmBalloon.ts`, testada sem React (o `ChatPage` não tem teste de componente, e montar a página inteira para isso não vale). Abrir um fecha o outro; trocar de conversa fecha os dois; fechar o painel fecha só o balão que abriu dele.

- [ ] **Step 1: Escrever os testes da regra do balão único, que falham**

Criar `frontend/src/lib/crmBalloon.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { closePanelBalloon, isBalloonOpen, toggleBalloon, type CrmBalloon } from './crmBalloon';

const CADASTRO_HEADER: CrmBalloon = { conversationId: 'c1', kind: 'cadastro', from: 'header' };
const CADASTRO_PAINEL: CrmBalloon = { conversationId: 'c1', kind: 'cadastro', from: 'panel' };
const AGENDAMENTO: CrmBalloon = { conversationId: 'c1', kind: 'agendamento', from: 'header' };

describe('um balão do Stronilead por vez', () => {
  test('abrir o agendamento fecha o cadastro, e abrir o cadastro fecha o agendamento', () => {
    let aberto = toggleBalloon(null, CADASTRO_HEADER, true);
    aberto = toggleBalloon(aberto, AGENDAMENTO, true);
    expect(isBalloonOpen(aberto, AGENDAMENTO)).toBe(true);
    expect(isBalloonOpen(aberto, CADASTRO_HEADER)).toBe(false);

    aberto = toggleBalloon(aberto, CADASTRO_PAINEL, true);
    expect(isBalloonOpen(aberto, CADASTRO_PAINEL)).toBe(true);
    expect(isBalloonOpen(aberto, AGENDAMENTO)).toBe(false);
  });

  test('o fechar de um balão que já não está aberto não fecha o outro', () => {
    const aberto = toggleBalloon(null, AGENDAMENTO, true);
    expect(toggleBalloon(aberto, CADASTRO_HEADER, false)).toEqual(AGENDAMENTO);
    expect(toggleBalloon(aberto, AGENDAMENTO, false)).toBeNull();
  });

  test('o mesmo balão em outra conversa não conta como aberto', () => {
    expect(isBalloonOpen(AGENDAMENTO, { ...AGENDAMENTO, conversationId: 'c2' })).toBe(false);
  });

  test('fechar o painel fecha só o balão que abriu dele', () => {
    expect(closePanelBalloon(CADASTRO_PAINEL)).toBeNull();
    expect(closePanelBalloon(AGENDAMENTO)).toEqual(AGENDAMENTO);
    expect(closePanelBalloon(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmBalloon.test.ts`
Expected: FAIL, com `Failed to resolve import "./crmBalloon"`.

- [ ] **Step 3: Criar a regra**

Criar `frontend/src/lib/crmBalloon.ts`:

```ts
// Qual balão do Stronilead está aberto: o do cadastro de lead (pelo
// "Cadastrar" do header ou pelo "Cadastrar lead" do painel) ou o do
// agendamento (pelo "Agendar" do header). Um estado só, no ChatPage, para só
// um balão abrir por vez (spec do agendamento pelo Stronizap, "Quando aparece
// o Agendar"). Puro e testado sem React.

export type CrmBalloonKind = 'cadastro' | 'agendamento';
export type CrmBalloonFrom = 'header' | 'panel';

export interface CrmBalloon {
  conversationId: string;
  kind: CrmBalloonKind;
  from: CrmBalloonFrom;
}

/** O balão aberto é este? */
export function isBalloonOpen(atual: CrmBalloon | null, alvo: CrmBalloon): boolean {
  return (
    atual !== null &&
    atual.conversationId === alvo.conversationId &&
    atual.kind === alvo.kind &&
    atual.from === alvo.from
  );
}

/** Abrir um balão fecha o que estava aberto. Fechar só fecha se o aberto for este. */
export function toggleBalloon(atual: CrmBalloon | null, alvo: CrmBalloon, aberto: boolean): CrmBalloon | null {
  if (aberto) return alvo;
  return isBalloonOpen(atual, alvo) ? null : atual;
}

/** Fechar o painel do contato fecha o balão que abriu dele. Os do header ficam. */
export function closePanelBalloon(atual: CrmBalloon | null): CrmBalloon | null {
  return atual?.from === 'panel' ? null : atual;
}
```

- [ ] **Step 4: Escrever os testes do balão, que falham**

O teste usa o assistente de verdade, com a API simulada, como o `CrmCardSection.test.tsx` faz com o formulário do cadastro. O balão não passa relógio ao assistente, então o teste fixa só a data do sistema (`vi.useFakeTimers({ toFake: ['Date'] })`): os `setTimeout` continuam de verdade e o `flush` funciona.

Criar `frontend/src/components/CrmScheduleBalloon.test.tsx`:

```tsx
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const get = vi.fn();
const post = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const toastFn = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }),
);
vi.mock('react-hot-toast', () => ({ default: toastFn }));

import { CrmScheduleBalloon } from './CrmScheduleBalloon';
import { useAuthStore, type AuthUser } from '../stores/auth.store';
import { useConversationsStore } from '../stores/conversations.store';
import { useCrmConfirmationStore } from '../stores/crmConfirmation.store';
import { useCrmStore } from '../stores/crm.store';
import { useDraftsStore } from '../stores/drafts.store';
import type { CrmScheduleOptions, CrmScheduleResult } from '../types/crm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Terça, 29/09, às 15:40 de Brasília. O balão não passa relógio ao assistente, então o teste fixa a data do sistema. */
const AGORA = new Date('2026-09-29T18:40:00.000Z');

const ANA: AuthUser = {
  id: 'ana',
  name: 'Ana Souza',
  email: 'ana@academia.com',
  role: 'ATENDENTE',
  avatarUrl: null,
  showSenderName: true,
};

const OPCOES: CrmScheduleOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
  targets: [{ leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: null }],
  units: [
    { name: 'Centro', address: 'Rua Garibaldi, 1200' },
    { name: 'Zona Sul', address: null },
  ],
  modalities: [{ id: 'm1', name: 'Pilates' }],
  professors: [{ id: 'p1', name: 'Carla Dias', modalityIds: ['m1'] }],
  trialClassOptions: [1, 2, 3],
  days: [
    { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
    { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
    { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
    { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
    { date: '2026-10-03', label: 'Sábado', defaultTime: '09:00' },
  ],
};

const RESULTADO: CrmScheduleResult = {
  card: {
    found: true,
    leadId: 'L1',
    kind: 'lead',
    name: 'Mariana Lima',
    appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null },
  },
  appointment: {
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
  },
  confirmationText: 'Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200).',
  alreadyScheduled: false,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  get.mockReset();
  post.mockReset();
  toastFn.mockReset();
  toastFn.success.mockReset();
  useAuthStore.setState({ user: ANA, accessToken: 't1' });
  useCrmStore.getState().clear();
  useDraftsStore.getState().clear();
  useCrmConfirmationStore.getState().clear();
  useConversationsStore.setState({ composerFocus: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** Como o header: o balão aberto ou fechado vem de fora. */
function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <p>Mensagens da conversa</p>
      <CrmScheduleBalloon
        scheduling={{
          conversationId: 'conv-1',
          contactId: 'c1',
          open: aberto,
          onOpenChange: (v) => {
            onOpenChange?.(v);
            setAberto(v);
          },
        }}
      >
        <button type="button">Agendar</button>
      </CrmScheduleBalloon>
    </div>
  );
}

/** O balão mora num portal, fora do header. */
const balao = () => document.querySelector<HTMLElement>('[aria-label="Agendamento no Stronilead"]');

/** Botão do balão pelo texto exato, ou pela primeira linha (opções com dica embaixo). */
function noBalao(rotulo: string): HTMLButtonElement {
  const botoes = [...(balao()?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  const achado =
    botoes.find((b) => b.textContent?.trim() === rotulo) ??
    botoes.find((b) => b.querySelector('span span')?.textContent === rotulo);
  if (!achado) throw new Error(`botão "${rotulo}" não achado no balão`);
  return achado;
}

async function clicarNoBalao(rotulo: string) {
  act(() => noBalao(rotulo).click());
  await flush();
}

async function abrir() {
  act(() => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Agendar')!.click());
  await flush();
}

async function agendarVisita({ desligarConfirmacao = false } = {}) {
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
  if (desligarConfirmacao) {
    act(() =>
      balao()!.querySelector<HTMLButtonElement>('button[aria-label="Deixar a confirmação escrita na caixa de mensagem"]')!.click(),
    );
  }
  await clicarNoBalao('Confirmar agendamento');
}

describe('CrmScheduleBalloon', () => {
  test('o "Agendar" abre o balão com o assistente, que pede as opções da conversa', async () => {
    get.mockResolvedValue({ data: OPCOES });
    act(() => root.render(<Harness />));

    await abrir();

    expect(balao()?.textContent).toContain('O que vai ser?');
    expect(container.contains(balao())).toBe(false);
    expect(get).toHaveBeenCalledWith('/conversations/conv-1/crm-schedule-options');
  });

  test('agendou com a caixa vazia: o cartão troca, a confirmação entra na caixa, o balão fecha e o cursor volta', async () => {
    get.mockResolvedValue({ data: OPCOES });
    post.mockResolvedValueOnce({ data: RESULTADO });
    act(() => root.render(<Harness />));

    await abrir();
    await agendarVisita();

    expect(useCrmStore.getState().cards.c1?.card).toEqual(RESULTADO.card);
    expect(useCrmStore.getState().avisos.c1).toEqual({ kind: 'agendado' });
    expect(useDraftsStore.getState().drafts['conv-1']).toMatchObject({ text: RESULTADO.confirmationText, noteMode: false });
    expect(useCrmConfirmationStore.getState().byConversation['conv-1']).toEqual({
      text: RESULTADO.confirmationText,
      type: 'visita',
    });
    expect(toastFn.success).not.toHaveBeenCalled();
    expect(balao()).toBeNull();
    expect(useConversationsStore.getState().composerFocus?.conversationId).toBe('conv-1');
  });

  test('caixa ocupada: o texto não entra, e o aviso diz "Visita agendada no Stronilead."', async () => {
    useDraftsStore.getState().setDraft('conv-1', 'Oi, tudo bem?', false);
    get.mockResolvedValue({ data: OPCOES });
    post.mockResolvedValueOnce({ data: RESULTADO });
    act(() => root.render(<Harness />));

    await abrir();
    await agendarVisita();

    expect(useDraftsStore.getState().drafts['conv-1']?.text).toBe('Oi, tudo bem?');
    expect(useCrmConfirmationStore.getState().byConversation['conv-1']).toBeUndefined();
    expect(toastFn.success).toHaveBeenCalledWith('Visita agendada no Stronilead.');
    expect(useCrmStore.getState().cards.c1?.card).toEqual(RESULTADO.card);
  });

  test('chave da confirmação desligada: a caixa fica como estava, com o mesmo aviso', async () => {
    get.mockResolvedValue({ data: OPCOES });
    post.mockResolvedValueOnce({ data: RESULTADO });
    act(() => root.render(<Harness />));

    await abrir();
    await agendarVisita({ desligarConfirmacao: true });

    expect(useDraftsStore.getState().drafts['conv-1']).toBeUndefined();
    expect(useCrmConfirmationStore.getState().byConversation['conv-1']).toBeUndefined();
    expect(toastFn.success).toHaveBeenCalledWith('Visita agendada no Stronilead.');
  });

  test('integração desligada ao abrir: a seção some do store e o balão fecha', async () => {
    get.mockRejectedValue(
      Object.assign(new Error('HTTP 412'), { response: { status: 412, data: { error: 'Desligada.', code: 'desligado' } } }),
    );
    act(() => root.render(<Harness />));

    await abrir();

    expect(useCrmStore.getState().cards.c1).toEqual({ card: null, loading: false, reason: 'desligado' });
    expect(balao()).toBeNull();
  });

  test('Cancelar fecha o balão e devolve o cursor para a caixa', async () => {
    get.mockResolvedValue({ data: OPCOES });
    act(() => root.render(<Harness />));

    await abrir();
    await clicarNoBalao('Cancelar');

    expect(balao()).toBeNull();
    expect(useConversationsStore.getState().composerFocus?.conversationId).toBe('conv-1');
  });

  test('clicar fora fecha o balão, e o cursor fica onde a pessoa clicou', async () => {
    get.mockResolvedValue({ data: OPCOES });
    const onOpenChange = vi.fn();
    act(() => root.render(<Harness onOpenChange={onOpenChange} />));

    await abrir();
    expect(balao()).not.toBeNull();
    await act(async () => {
      container.querySelector('p')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    await flush();

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(balao()).toBeNull();
    expect(useConversationsStore.getState().composerFocus).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmScheduleBalloon.test.tsx`
Expected: FAIL, com `Failed to resolve import "./CrmScheduleBalloon"`.

- [ ] **Step 6: Criar o balão**

Criar `frontend/src/components/CrmScheduleBalloon.tsx`:

```tsx
// Balão do agendamento no Stronilead. Abre só pelo "Agendar" do header da
// conversa, logo abaixo dele, com o assistente (CrmScheduleWizard) dentro. Só
// um balão do Stronilead fica aberto por vez: quem guarda qual é o ChatPage.
//
// Clicar fora fecha e deixa o foco onde a pessoa clicou. Cancelar, Esc e o
// agendamento feito fecham e devolvem o cursor para a caixa de digitar, como
// no balão do cadastro (CrmLeadBalloon).
import { useRef, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useCrmStore } from '../stores/crm.store';
import { useConversationsStore } from '../stores/conversations.store';
import { useCrmConfirmationStore } from '../stores/crmConfirmation.store';
import { scheduledNotice } from '../lib/crmSchedule';
import type { CrmScheduleResult } from '../types/crm';
import { CrmScheduleWizard } from './CrmScheduleWizard';

/** O agendamento deste contato, e se o balão está aberto. */
export interface CrmScheduling {
  conversationId: string;
  contactId: string;
  /** Balão aberto. Quem guarda é o ChatPage, para só um balão abrir por vez. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrmScheduleBalloon({ scheduling, children }: { scheduling: CrmScheduling; children: ReactNode }) {
  const replaceCard = useCrmStore((s) => s.replaceCard);
  const hideCard = useCrmStore((s) => s.hideCard);
  const setAviso = useCrmStore((s) => s.setAviso);
  // Fechou por um clique ou foco fora: o cursor não volta para a caixa, para
  // não tirar a pessoa de onde ela clicou.
  const fechouPorFora = useRef(false);
  const s = scheduling;

  function concluir(result: CrmScheduleResult, escreverConfirmacao: boolean) {
    replaceCard(s.contactId, result.card);
    setAviso(s.contactId, { kind: 'agendado' });
    // A confirmação só entra com a caixa vazia. Com a caixa ocupada, ou com a
    // chave desligada, um aviso diz que o agendamento foi feito, porque o
    // painel com o cartão pode estar fechado.
    const escrita =
      escreverConfirmacao &&
      useCrmConfirmationStore
        .getState()
        .offer(s.conversationId, { text: result.confirmationText, type: result.appointment.type }) === 'escrita';
    if (!escrita) toast.success(scheduledNotice(result.appointment.type));
    s.onOpenChange(false);
  }

  return (
    <Popover open={s.open} onOpenChange={s.onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Agendamento no Stronilead"
        className="crm-balloon flex w-[380px] flex-col rounded-[14px] border p-0"
        style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}
        onOpenAutoFocus={() => {
          fechouPorFora.current = false;
        }}
        onInteractOutside={() => {
          fechouPorFora.current = true;
        }}
        onCloseAutoFocus={(e) => {
          // Sem isto o Radix devolveria o foco ao "Agendar".
          e.preventDefault();
          if (!fechouPorFora.current) {
            useConversationsStore.getState().requestComposerFocus(s.conversationId);
          }
          fechouPorFora.current = false;
        }}
      >
        <CrmScheduleWizard
          conversationId={s.conversationId}
          onCancel={() => s.onOpenChange(false)}
          onDone={concluir}
          onGone={(reason) => {
            hideCard(s.contactId, reason);
            s.onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/crmBalloon.test.ts src/components/CrmScheduleBalloon.test.tsx`
Expected: PASS, 11 testes (4 da regra e 7 do balão).

- [ ] **Step 8: Escrever os testes do "Agendar" no header, que falham**

Em `frontend/src/components/CrmHeaderMeta.test.tsx`, trocar a linha 25 e a seguinte:

```tsx
import type { CrmRegistration } from './CrmLeadBalloon';
import { useCrmStore } from '../stores/crm.store';
```

por:

```tsx
import type { CrmRegistration } from './CrmLeadBalloon';
import type { CrmScheduling } from './CrmScheduleBalloon';
import { useCrmStore } from '../stores/crm.store';
```

Trocar o `montar` e o `cadastrar` (linhas 69 a 79):

```tsx
function montar(card: CrmCard, props: { jidSuffix?: string | null; registration?: CrmRegistration | null } = {}) {
  // Com a entrada já no store, o loadCard do componente não pergunta nada.
  useCrmStore.getState().replaceCard('c1', card);
  act(() =>
    root.render(
      <CrmHeaderMeta contactId="c1" jidSuffix={props.jidSuffix ?? null} registration={props.registration ?? null} />,
    ),
  );
}

const cadastrar = () => container.querySelector<HTMLButtonElement>('button[aria-label="Cadastrar no Stronilead"]');
```

por:

```tsx
function agendamento(over: Partial<CrmScheduling> = {}): CrmScheduling {
  return { conversationId: 'conv-1', contactId: 'c1', open: false, onOpenChange: () => {}, ...over };
}

function montar(
  card: CrmCard,
  props: { jidSuffix?: string | null; registration?: CrmRegistration | null; scheduling?: CrmScheduling | null } = {},
) {
  // Com a entrada já no store, o loadCard do componente não pergunta nada.
  useCrmStore.getState().replaceCard('c1', card);
  act(() =>
    root.render(
      <CrmHeaderMeta
        contactId="c1"
        jidSuffix={props.jidSuffix ?? null}
        registration={props.registration ?? null}
        scheduling={props.scheduling ?? null}
      />,
    ),
  );
}

const cadastrar = () => container.querySelector<HTMLButtonElement>('button[aria-label="Cadastrar no Stronilead"]');
const agendar = () => container.querySelector<HTMLButtonElement>('button[aria-label="Agendar no Stronilead"]');
```

E acrescentar no fim do arquivo:

```tsx
describe('CrmHeaderMeta: Agendar', () => {
  test('lead achado, contato de WhatsApp com número: o Agendar vem depois da situação e pede para abrir o balão', () => {
    const onOpenChange = vi.fn();
    montar(
      { found: true, kind: 'lead', stage: 'Primeiro contato', consultantName: 'Ana Souza' },
      { scheduling: agendamento({ onOpenChange }) },
    );

    expect(container.textContent).toMatch(/Lead · Primeiro contato · Ana Souza·Agendar$/);
    act(() => agendar()!.click());

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  test('cliente e responsável por um menor também têm o Agendar', () => {
    montar({ found: true, kind: 'cliente', contractStatus: 'ativo', planName: 'Anual' }, { scheduling: agendamento() });
    expect(agendar()).not.toBeNull();

    montar(
      { found: true, kind: 'responsavel', name: 'Mariana Souza', wards: [{ leadId: 'L2', kind: 'lead', name: 'Pedro Souza' }] },
      { scheduling: agendamento() },
    );
    expect(agendar()).not.toBeNull();
    expect(container.textContent).toContain('Responsável por Pedro');
  });

  test('aberto, o balão desce do header com o assistente', () => {
    montar({ found: true, kind: 'lead', stage: 'Novo lead' }, { scheduling: agendamento({ open: true }) });

    const balao = document.querySelector('[aria-label="Agendamento no Stronilead"]');
    expect(balao?.textContent).toContain('Carregando…');
    expect(container.contains(balao)).toBe(false);
  });

  test('sem cadastro: o Cadastrar, e nada de Agendar', () => {
    montar({ found: false }, { registration: registro(), scheduling: agendamento() });

    expect(cadastrar()).not.toBeNull();
    expect(agendar()).toBeNull();
  });

  test('contato sem número (LID) ou de Instagram: sem Agendar', () => {
    montar({ found: true, kind: 'lead', stage: 'Novo lead' }, { jidSuffix: 'lid', scheduling: agendamento() });
    expect(agendar()).toBeNull();

    montar({ found: true, kind: 'lead', stage: 'Novo lead' }, { jidSuffix: 'ig', scheduling: agendamento() });
    expect(agendar()).toBeNull();
  });

  test('superadmin entrando como admin: sem Agendar, e a situação continua', () => {
    useAuthStore.setState({ user: { ...ANA, role: 'ADMIN', imp: { byId: 'sa-1' } } });
    montar({ found: true, kind: 'lead', stage: 'Novo lead' }, { scheduling: agendamento() });

    expect(agendar()).toBeNull();
    expect(container.textContent).toContain('Lead · Novo lead');
  });

  test('integração desligada: sem cartão, o item inteiro some, com o Agendar junto', () => {
    useCrmStore.getState().hideCard('c1', 'desligado');
    act(() => root.render(<CrmHeaderMeta contactId="c1" jidSuffix={null} scheduling={agendamento()} />));

    expect(container.textContent).toBe('');
    expect(agendar()).toBeNull();
  });

  test('sem quem agende, sem Agendar', () => {
    montar({ found: true, kind: 'lead', stage: 'Novo lead' });

    expect(agendar()).toBeNull();
  });
});
```

- [ ] **Step 9: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmHeaderMeta.test.tsx`
Expected: FAIL, `3 failed | 11 passed`. Falham os três testes em que o "Agendar" aparece ("lead achado…", "cliente e responsável…" e "aberto, o balão desce…"); os que dizem quando ele não aparece já passam, e os 6 do "Cadastrar" continuam verdes.

- [ ] **Step 10: Pôr o "Agendar" no header**

Em `frontend/src/components/CrmHeaderMeta.tsx`, trocar o fim do comentário do topo, os imports e as props (linhas 19 a 37):

```tsx
// com número e fora da sessão do superadmin entrando como admin.
import { useEffect } from 'react';
import { useCrmStore } from '../stores/crm.store';
import { isImpersonationSession, useAuthStore } from '../stores/auth.store';
import { hasRealPhone } from '../types/conversation';
import { crmHeaderText, crmStatus } from '../types/crm';
import { StronileadMark } from './StronileadMark';
import { CrmLeadBalloon, type CrmRegistration } from './CrmLeadBalloon';

export function CrmHeaderMeta({
  contactId,
  jidSuffix,
  registration = null,
}: {
  contactId: string;
  jidSuffix?: string | null;
  /** Quem pode cadastrar e o balão aberto ou fechado. Sem ele, o "Cadastrar" não aparece. */
  registration?: CrmRegistration | null;
}) {
```

por:

```tsx
// com número e fora da sessão do superadmin entrando como admin.
//
// Com o número achado no Stronilead (lead, cliente ou responsável por um
// menor), o link "Agendar" vem depois da situação e abre o balão do
// agendamento logo abaixo. Mesmo recorte do "Cadastrar".
import { useEffect } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useCrmStore } from '../stores/crm.store';
import { isImpersonationSession, useAuthStore } from '../stores/auth.store';
import { hasRealPhone } from '../types/conversation';
import { crmHeaderText, crmStatus } from '../types/crm';
import { StronileadMark } from './StronileadMark';
import { CrmLeadBalloon, type CrmRegistration } from './CrmLeadBalloon';
import { CrmScheduleBalloon, type CrmScheduling } from './CrmScheduleBalloon';

export function CrmHeaderMeta({
  contactId,
  jidSuffix,
  registration = null,
  scheduling = null,
}: {
  contactId: string;
  jidSuffix?: string | null;
  /** Quem pode cadastrar e o balão aberto ou fechado. Sem ele, o "Cadastrar" não aparece. */
  registration?: CrmRegistration | null;
  /** O balão do agendamento aberto ou fechado. Sem ele, o "Agendar" não aparece. */
  scheduling?: CrmScheduling | null;
}) {
```

Trocar as linhas 79 a 82:

```tsx
  const status = crmStatus(card);
  const texto = crmHeaderText(card, status.label);

  return (
```

por:

```tsx
  const status = crmStatus(card);
  const texto = crmHeaderText(card, status.label);
  // Sem cadastro, o lugar é do "Cadastrar", e depois do cadastro o "Agendar"
  // já aparece.
  const agendamento = card.found && consultavel && !isImpersonationSession(user) ? scheduling : null;

  return (
```

E trocar o fim do JSX (linhas 98 a 102):

```tsx
        <span className="truncate">{texto}</span>
      </span>
    </>
  );
}
```

por:

```tsx
        <span className="truncate">{texto}</span>
      </span>
      {agendamento && (
        <>
          <span aria-hidden style={{ color: 'var(--border-strong)' }}>
            ·
          </span>
          <CrmScheduleBalloon scheduling={agendamento}>
            <button
              type="button"
              aria-label="Agendar no Stronilead"
              title="Agendar no Stronilead"
              className="inline-flex flex-none items-center gap-[3px] rounded-[5px] px-[5px] py-px text-[10.5px] font-medium"
              style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
            >
              <CalendarPlus size={12} aria-hidden />
              Agendar
            </button>
          </CrmScheduleBalloon>
        </>
      )}
    </>
  );
}
```

O desenho do link segue o mockup 1: ícone de calendário com mais, tinta do acento sobre o fundo suave do acento, 10,5px como o resto da linha. A marca do Stronilead já está no começo do item, então o link não repete a marca, ao contrário do "Cadastrar", que ocupa o lugar do texto.

- [ ] **Step 11: Ligar no `ChatWindow` e no `ChatPage`**

Em `frontend/src/components/ChatWindow.tsx`, trocar o fim das `Props` e a desestruturação (linhas 45 a 55):

```tsx
  /** Sem ele, o "Cadastrar" do header não aparece. */
  onLeadFormOpenChange?: (open: boolean) => void;
}

export function ChatWindow({
  conversation,
  onOpenContactPanel,
  contactPanelOpen = false,
  leadFormOpen = false,
  onLeadFormOpenChange,
}: Props) {
```

por:

```tsx
  /** Sem ele, o "Cadastrar" do header não aparece. */
  onLeadFormOpenChange?: (open: boolean) => void;
  /** Balão do agendamento aberto a partir do "Agendar" do header. */
  scheduleOpen?: boolean;
  /** Sem ele, o "Agendar" do header não aparece. */
  onScheduleOpenChange?: (open: boolean) => void;
}

export function ChatWindow({
  conversation,
  onOpenContactPanel,
  contactPanelOpen = false,
  leadFormOpen = false,
  onLeadFormOpenChange,
  scheduleOpen = false,
  onScheduleOpenChange,
}: Props) {
```

E, no `CrmHeaderMeta` (linhas 483 a 497), trocar o fim do `registration`:

```tsx
                        open: leadFormOpen,
                        onOpenChange: onLeadFormOpenChange,
                      }
                    : null
                }
              />
```

por:

```tsx
                        open: leadFormOpen,
                        onOpenChange: onLeadFormOpenChange,
                      }
                    : null
                }
                scheduling={
                  onScheduleOpenChange
                    ? {
                        conversationId: conversation.id,
                        contactId: conversation.contactId,
                        open: scheduleOpen,
                        onOpenChange: onScheduleOpenChange,
                      }
                    : null
                }
              />
```

Em `frontend/src/pages/ChatPage.tsx`, trocar a linha 24:

```tsx
import type { Channel } from '../types/channel';
```

por:

```tsx
import type { Channel } from '../types/channel';
import { closePanelBalloon, isBalloonOpen, toggleBalloon, type CrmBalloon } from '../lib/crmBalloon';
```

Trocar o estado do balão (linhas 48 a 53):

```tsx
  // Balão do cadastro de lead aberto: a conversa e de onde ele abriu, o
  // "Cadastrar" do header ou o botão do painel do contato. Mora aqui para só
  // um balão abrir por vez.
  const [leadForm, setLeadForm] = useState<{ conversationId: string; from: 'header' | 'panel' } | null>(
    null,
  );
```

por:

```tsx
  // Balão do Stronilead aberto: o do cadastro de lead (pelo "Cadastrar" do
  // header ou pelo botão do painel do contato) ou o do agendamento (pelo
  // "Agendar" do header). Mora aqui para só um balão abrir por vez.
  const [balao, setBalao] = useState<CrmBalloon | null>(null);
```

Trocar o efeito da troca de conversa (linhas 82 a 87):

```tsx
  // Fecha o painel do contato sempre que troca a conversa selecionada. O
  // balão do cadastro de lead fecha junto, e o que foi digitado fica para trás.
  useEffect(() => {
    setContactPanelOpen(false);
    setLeadForm(null);
  }, [selectedConvId]);
```

por:

```tsx
  // Fecha o painel do contato sempre que troca a conversa selecionada. O
  // balão do Stronilead fecha junto, e o que foi digitado ou escolhido fica
  // para trás.
  useEffect(() => {
    setContactPanelOpen(false);
    setBalao(null);
  }, [selectedConvId]);
```

Trocar as linhas 154 e 155:

```tsx
  // Fechar o painel fecha o balão do cadastro que abriu dele. O do header fica.
  const fecharBalaoDoPainel = () => setLeadForm((atual) => (atual?.from === 'panel' ? null : atual));
```

por:

```tsx
  // Fechar o painel fecha o balão que abriu dele. Os do header ficam.
  const fecharBalaoDoPainel = () => setBalao(closePanelBalloon);
```

Trocar o `balaoDoCadastro` (linhas 167 a 174):

```tsx
  /** Aberto e fechado do balão do cadastro, para o header ou para o painel. */
  function balaoDoCadastro(conversationId: string, from: 'header' | 'panel') {
    return {
      leadFormOpen: leadForm?.conversationId === conversationId && leadForm.from === from,
      onLeadFormOpenChange: (aberto: boolean) =>
        setLeadForm((atual) => (aberto ? { conversationId, from } : atual?.from === from ? null : atual)),
    };
  }
```

por:

```tsx
  /** Aberto e fechado do balão do cadastro, para o header ou para o painel. */
  function balaoDoCadastro(conversationId: string, from: 'header' | 'panel') {
    const alvo: CrmBalloon = { conversationId, kind: 'cadastro', from };
    return {
      leadFormOpen: isBalloonOpen(balao, alvo),
      onLeadFormOpenChange: (aberto: boolean) => setBalao((atual) => toggleBalloon(atual, alvo, aberto)),
    };
  }

  /** Aberto e fechado do balão do agendamento, que só abre pelo "Agendar" do header. */
  function balaoDoAgendamento(conversationId: string) {
    const alvo: CrmBalloon = { conversationId, kind: 'agendamento', from: 'header' };
    return {
      scheduleOpen: isBalloonOpen(balao, alvo),
      onScheduleOpenChange: (aberto: boolean) => setBalao((atual) => toggleBalloon(atual, alvo, aberto)),
    };
  }
```

E, no `ChatWindow` (linhas 218 a 220), trocar:

```tsx
            // "Cadastrar" do header: abre o balão do cadastro logo abaixo dele.
            {...balaoDoCadastro(selectedConv.id, 'header')}
          />
```

por:

```tsx
            // "Cadastrar" do header: abre o balão do cadastro logo abaixo dele.
            {...balaoDoCadastro(selectedConv.id, 'header')}
            // "Agendar" do header: abre o balão do agendamento logo abaixo dele.
            {...balaoDoAgendamento(selectedConv.id)}
          />
```

O `ContactPanel` continua recebendo `leadFormOpen` e `onLeadFormOpenChange` do `balaoDoCadastro(selectedConv.id, 'panel')`, sem mudança.

- [ ] **Step 12: Rodar e ver passar**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run src/components/CrmHeaderMeta.test.tsx && npm test && npm run build`
Expected: typecheck limpo, os 14 testes do header verdes, a suíte inteira verde (78 arquivos, 896 testes) e o build termina com `✓ built` (o aviso de pedaço maior que 500 kB já existe hoje).

- [ ] **Step 13: Commit**

```bash
git add frontend/src/lib/crmBalloon.ts frontend/src/lib/crmBalloon.test.ts frontend/src/components/CrmScheduleBalloon.tsx frontend/src/components/CrmScheduleBalloon.test.tsx frontend/src/components/CrmHeaderMeta.tsx frontend/src/components/CrmHeaderMeta.test.tsx frontend/src/components/ChatWindow.tsx frontend/src/pages/ChatPage.tsx
git commit -m "feat: Agendar no header da conversa abre o balão do agendamento no Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: `CLAUDE.md` do Stronizap

**Files:**
- Modify: `CLAUDE.md` (seção 4, linha 81; seção 10, parágrafo do cadastro na linha 244, parágrafo novo antes de "Onde o desenvolvimento está" e os dois parágrafos do smoke nas linhas 256 e 268; seção 14, o item do cadastro na linha 424 e dois itens novos depois dele)

O `CLAUDE.md` descreve o sistema como ele é, e o do Stronizap documentou o cadastro de lead nas seções 10 e 14. O agendamento entra nos mesmos lugares e no mesmo tom. Texto de documento passa pelo humanizer: linguagem direta, sem travessão no meio da frase.

- [ ] **Step 1: Seção 4, a contagem de serviços**

A árvore diz "38 services", e em `78f36d3` já são 42 arquivos em `backend/src/services/` fora os testes. Com os três novos deste PR, são 45. Trocar a linha 81:

````text
│   │   ├── services/              38 services (regra de negócio vive aqui)
````

por:

````text
│   │   ├── services/              45 arquivos (regra de negócio vive aqui)
````

- [ ] **Step 2: Seção 10, as portas do cadastro**

No parágrafo "**Cadastro de lead pelo Stronizap.**" (linha 244), trocar o trecho:

````markdown
As duas rotas passam por `services/crm-lead.service.ts`: superadmin e impersonação são recusados antes de olhar a conversa (403 com `code`),
````

por:

````markdown
As duas rotas passam por `services/crm-lead.service.ts`, com as portas de `services/crm-conversation.service.ts`, que o agendamento também usa: superadmin e impersonação são recusados antes de olhar a conversa (403 com `code`),
````

- [ ] **Step 3: Seção 10, o parágrafo do agendamento**

Logo depois do parágrafo do cadastro, antes de "**Onde o desenvolvimento está.**", acrescentar o parágrafo:

````markdown
**Agendamento pelo Stronizap.** Contato de WhatsApp com número que o Stronilead acha (lead, cliente ou responsável por um menor) ganha, no header, o link "Agendar" depois da situação do cadastro, para admin, gestor e atendente com acesso ao canal, menos na sessão do superadmin entrando como admin. Sem cadastro, o lugar é do "Cadastrar", e depois do cadastro o "Agendar" já aparece. O link abre o balão do agendamento (`CrmScheduleBalloon`, com o assistente `CrmScheduleWizard` e o resumo `CrmScheduleSummary`), que pede as opções a cada abertura em `GET /api/conversations/:id/crm-schedule-options` e agenda em `POST /api/conversations/:id/crm-schedule`. As duas rotas passam por `services/crm-schedule.service.ts`, com as mesmas portas do cadastro, e chamam as ações `schedule-options` e `schedule` do `POST /api/zap` (`fetchCrmScheduleOptions` e `createCrmAppointment`, com 4 e 8 segundos de tempo máximo). O corpo do `POST` é `{ schedule }` (`crmScheduleBodySchema`), e o `schedule` segue inteiro para o Stronilead; quem agendou sai da sessão e do cadastro do colaborador, nunca do corpo. Nenhuma lista mora aqui: para quem, unidades, modalidades, professores, quantidades de aula e os cinco dias com o horário padrão vêm do Stronilead, remontados em lista fechada por `lerOpcoesDoAgendamento`, e o agendamento feito volta como `CrmAppointmentDetail` (`lerDetalheDoAgendamento`). A recusa aparece com o texto do Stronilead, no passo do campo quando ele diz qual (`stepOfRefusal`, em `lib/crmScheduleWizard.ts`), e com `catalogo_mudou` ou `lead_nao_confere` as opções voltam de lá com o que ainda vale do que foi escolhido. O `ja_agendado` (409, com o cartão e o agendamento) vira sucesso com `alreadyScheduled: true` e status 200, e a tela trata igual ao agendamento novo. Depois de agendar, o serviço aplica o cartão como o cadastro (`applyCrmCard`: cache, cobertura, nome e `crm_card_updated`) e monta o texto da confirmação em `services/crm-appointment-text.ts` (`buildConfirmationText`), sempre no horário de Brasília; os testes dele põem o processo em UTC. A confirmação só entra na caixa vazia e nunca é enviada sozinha. Com a caixa ocupada, ou com a chave da confirmação desligada, um toast diz que o agendamento foi feito. O cartão mostra o desfecho que o Stronilead registra na linha de Agendamento ("Visita · 01/10 às 18:00 · Compareceu"), no horário de Brasília (`lib/crmAppointment.ts`). Spec em `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`.
````

- [ ] **Step 4: Seção 10, o smoke**

No parágrafo que começa com "Ele fala com o CRM de verdade" (linha 256), trocar:

````markdown
e confere o formato da resposta campo a campo: o cartão e as opções do cadastro de lead (`lead-options`, que só lê). Sem o e-mail, as opções são pedidas como o admin mais antigo da organização, que precisa estar na equipe do Stronilead com o mesmo e-mail. O cadastro (`create-lead`) grava lead de verdade e nunca roda no smoke: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
````

por:

````markdown
e confere o formato da resposta campo a campo: o cartão, com o `outcome` de cada agendamento, as opções do cadastro de lead (`lead-options`, que só lê) e as opções do agendamento (`schedule-options`, que também só lê e confere que os cadastros oferecidos são os mesmos do cartão). Sem o e-mail, as opções são pedidas como o admin mais antigo da organização, que precisa estar na equipe do Stronilead com o mesmo e-mail. O cadastro (`create-lead`) e o agendamento (`schedule`) gravam de verdade e nunca rodam no smoke: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
````

E, no fim do último parágrafo da seção (linha 268), trocar:

````markdown
As opções do cadastro de lead não têm lista fechada no smoke: quem fecha é o `lerOpcoes` do `crm.service.ts`, que monta o objeto de novo antes de ele sair para o navegador, e o smoke confere o resultado dessa montagem.
````

por:

````markdown
As opções do cadastro de lead e as do agendamento não têm lista fechada no smoke: quem fecha são o `lerOpcoes` e o `lerOpcoesDoAgendamento` do `crm.service.ts`, que montam o objeto de novo antes de ele sair para o navegador, e o smoke confere o resultado dessa montagem.
````

A tabela dos arquivos do contrato fica como está, como ficou no cadastro de lead.

- [ ] **Step 5: Seção 14, os balões e a faixa**

No item do cadastro de lead em **Frontend** (linha 424), trocar:

````markdown
Qual balão está aberto é estado do `ChatPage` (`leadForm`, com a conversa e a origem), para só um abrir por vez, e trocar de conversa descarta o que foi digitado.
````

por:

````markdown
Qual balão está aberto é estado do `ChatPage` (`balao`, um `CrmBalloon` com a conversa, o tipo e a origem, pela regra de `lib/crmBalloon.ts`), para só um abrir por vez, seja o do cadastro ou o do agendamento, e trocar de conversa descarta o que foi digitado.
````

E, logo depois desse item (ele termina em "Decisões do Johnny em 29/09, depois de ver a tela."), acrescentar os dois itens:

````markdown
- O agendamento abre num balão só pelo "Agendar" do header (`CrmScheduleBalloon`), com as regras de foco e de clique fora do balão do cadastro. O assistente (`CrmScheduleWizard`) guarda o estado e tira as regras dos passos de `lib/crmScheduleWizard.ts`, puro: cada passo respondido vira uma linha que dá para clicar e trocar, o atual fica aberto e os seguintes, apagados. O resumo (`CrmScheduleSummary`) é um componente à parte porque o bloco do lembrete entra nele. Os botões, a caixa de erro e o aviso de fora da equipe vêm do `CrmLeadForm`, para os dois balões ficarem iguais. Dia e hora do agendamento na tela são sempre os de Brasília (`lib/crmAppointment.ts`), nunca os do navegador. "Outro dia" abre o calendário dentro do passo, e o calendário (`components/ui/calendar.tsx`) fala português (`ptBR` do `date-fns/locale`), também no "Agendar mensagem".
- A confirmação do agendamento entra na caixa só quando ela está vazia (`useCrmConfirmationStore.offer`), e a caixa sai do modo nota junto, senão a confirmação iria como nota interna. A faixa `CrmConfirmationBar` ("Visita agendada. A confirmação está na caixa.", com o Apagar) existe só enquanto o texto da caixa for igual ao que entrou (`isConfirmationActive` em `lib/crmSchedule.ts`), no mesmo jeito do Desfazer da reescrita, e some durante a reescrita. O store guarda o texto por conversa, porque o `MessageInput` remonta a cada conversa, e é apagado na troca de usuário. Não tratar a faixa em cada caminho que muda o texto.
````

- [ ] **Step 6: Conferir**

Run: `grep -n "45 arquivos\|crm-conversation.service\|Agendamento pelo Stronizap\|schedule-options\|lerOpcoesDoAgendamento\|CrmBalloon\|CrmScheduleBalloon\|CrmConfirmationBar" CLAUDE.md`
Expected: 8 linhas, 81 (a árvore), 244 (o cadastro com as portas), 246 (o parágrafo novo), 258 e 270 (o smoke), 426, 427 e 428 (os itens da seção 14). Ler o texto novo inteiro uma vez: sem travessão no meio da frase, sem frase de efeito, e todo nome citado existe no código deste PR.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: agendamento pelo Stronizap no CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Conferência final, PR e publicação

**Files:** nenhum no repositório. O Step 6, depois do deploy, mexe em dois `CLAUDE.md` que ficam fora dos repositórios (não são git).

- [ ] **Step 1: Suítes, typechecks e build**

Com o banco de isolamento da Task 6:

```bash
npm run typecheck --workspaces
cd backend && npx tsc -p tsconfig.test.json --noEmit && npm test && npm run test:isolation && cd ..
cd frontend && npm test && npm run build && cd ..
```

Expected: os typechecks limpos; backend com 591 testes (534 de antes e 57 novos); isolamento com 75, os sete "agendamento no Stronilead:" entre eles; frontend com 78 arquivos e 896 testes (797 de antes e 99 novos); o build termina com `✓ built`. São os números da cópia conferida.

- [ ] **Step 2: O que os testes não pegam**

```bash
git diff --stat origin/main...HEAD -- backend/prisma
git diff origin/main...HEAD -- frontend/src | grep '^+' | grep -n "x-stronizap-key\|crmApiKey"
git diff --name-only origin/main...HEAD | wc -l
```

Expected: as duas primeiras não imprimem nada (sem migration, e nada da chave chega ao navegador); a terceira dá 43, os arquivos do "Mapa de arquivos". Os três pontos comparam com o ponto em que o branch saiu da `main`, então valem mesmo que a `main` ande. Depois, ler o diff inteiro uma vez atrás de `console.log` esquecido e de texto de tela que não esteja na spec, no mockup ou na tabela "Textos de tela que não estão na spec nem no mockup".

- [ ] **Step 3: Abrir o PR (sem merge)**

```bash
git push -u origin claude/agendamento-pelo-zap
gh pr create --base main --title "feat: agendamento pelo Stronizap (Stronizap)" --body "$(cat <<'EOF'
O Stronizap passa a agendar visita e aula experimental no Stronilead de dentro da conversa. Este PR é a metade do Stronizap; a do Stronilead é o PR do agendamento no `crm-stronix`.

- "Agendar" no cabeçalho da conversa, depois da situação do cadastro, para lead, cliente e responsável por um menor, em contato de WhatsApp com número e fora da sessão do superadmin entrando como admin
- balão passo a passo (para quem, visita ou aula, unidade, modalidade, professor, quantas aulas, dia e horário), com as listas e os cinco dias vindos do Stronilead a cada abertura; um balão do Stronilead aberto por vez
- rotas `GET /api/conversations/:id/crm-schedule-options` e `POST /api/conversations/:id/crm-schedule`, com as portas do cadastro, que passaram para um lugar só (`crm-conversation.service.ts`); o `crm-lead.service.test.ts` não mudou
- depois de agendar, o cartão troca para todos com a conversa aberta, aparece "Agendado agora por você" e a confirmação fica escrita na caixa vazia, com a faixa e o Apagar; nada é enviado sozinho
- o cartão mostra o desfecho na linha de Agendamento ("Compareceu" ou "Faltou"), no horário de Brasília
- o calendário passa a falar português, também no "Agendar mensagem"
- o smoke confere as opções do agendamento e o desfecho, e uma trava no `npm test` impede que ele agende
- sem migration

**Só vai para produção depois do PR do Stronilead no ar.** Com o Stronilead antigo, as ações novas respondem 401, e este lado trata 401 como chave recusada: a seção do Stronilead sumiria no clique em Agendar.

Para o Johnny olhar, nas notas de abertura do plano: os textos de tela que não estavam na spec nem no mockup e o ponto para decidir.

Spec e plano no `crm-stronix`, em `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` e `docs/superpowers/plans/2026-09-29-agendamento-zap-pr2-stronizap.md`.

Verificação: typechecks limpos, backend com 591 testes, isolamento com 75, frontend com 78 arquivos e 896 testes, build ok. O teste de verdade é em produção, na STRONIX, depois do deploy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: o link do PR. Não fazer merge: o merge é do Johnny, depois do PR 1 no ar.

- [ ] **Step 4: Publicação (Johnny, com o PR 1 no ar)**

1. Conferir que o PR do agendamento no `crm-stronix` foi mesclado e que o deploy da `main` na Vercel está em Ready. Sem isso, não publicar este.
2. Mesclar este PR na `main`.
3. No servidor: `sudo -u whatsapp bash /opt/whatsapp-crm/deploy/scripts/deploy.sh`. Expected: termina com "✅ Deploy concluído: <commit anterior> → <commit novo>". O `prisma migrate deploy` do script não aplica nada, porque não há migration.
4. O smoke, no servidor, com o telefone de um lead de teste da STRONIX e o e-mail de alguém da equipe do Stronilead:

```bash
cd /opt/whatsapp-crm/backend && sudo -u whatsapp npx tsx src/scripts/smoke-crm-card.ts <telefone-do-lead-de-teste> stronix-crm-app <email-da-equipe>
```

Expected: todas as conferências com ✅, inclusive as do bloco `[5] opções do agendamento (schedule-options, só leitura)`, e a última linha "✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão, opções do cadastro e do agendamento)". Um `[5]` que responde `chave_invalida` quer dizer que o PR 1 não está no ar.

- [ ] **Step 5: Conferência em produção, na STRONIX (Johnny)**

Com um contato de teste que já é lead no Stronilead (o próprio número do Johnny serve). Os agendamentos ficam de verdade na ficha desse lead, e dá para cancelar pelo Stronilead depois.

1. Na conversa do lead de teste, o cabeçalho mostra "Lead · <etapa> · <consultor> · Agendar". Numa conversa sem cadastro, o "Cadastrar" continua no lugar e não há "Agendar"; numa conversa do Instagram, nenhum dos dois.
2. Agendar uma visita: "O que vai ser?", Visita, a unidade com o endereço embaixo, um dos cinco dias, o horário e Continuar. No resumo, "Conta na sua Meta diária." aparece para consultor em dia de meta. Em "Confirmar agendamento", o balão fecha, o cursor volta para a caixa, a confirmação está escrita nela com a faixa "Visita agendada. A confirmação está na caixa." e o painel mostra a linha "Visita · <dia> às <hora>" com "Agendado agora por você". Nada foi enviado.
3. "Apagar" na faixa tira o texto da caixa.
4. Agendar de novo para o mesmo lead: o aviso "… já tem visita marcada para …" no topo e o título e o botão "Remarcar visita". Remarcar para outro dia troca a data no cartão.
5. Com algo escrito na caixa, agendar: o texto da caixa fica como estava, e o aviso "Visita agendada no Stronilead." aparece.
6. Aula experimental com professor, com "Treina sozinho" e com mais de uma aula: o texto da confirmação de cada caso, como na spec.
7. Num número de responsável por menores, "Para quem?" aparece primeiro, com o parentesco embaixo do nome quando o Stronilead manda, e a confirmação sai "A visita de <menor> …".
8. No Stronilead, a ficha mostra o agendamento com a marca do Stronizap antes de quem agendou, e a Meta Diária de quem agendou conta o ponto. Registrar "Compareceu" na Meta Diária e, passados uns 2 minutos (o cache do cartão no servidor), um F5 no Stronizap mostra "· Compareceu" na linha do agendamento.
9. No tema escuro, o balão, o "Agendar" e a faixa continuam legíveis.

Se algo der errado e o Johnny pedir a volta: reverter o merge deste PR na `main` (o botão Revert do PR no GitHub, e mesclar o PR de revert) e rodar o `deploy.sh` de novo. Sem migration, voltar o código basta. O PR 1 pode ficar no ar, porque as ações novas só respondem a quem chama.

- [ ] **Step 6: Documentação fora dos repositórios (depois do deploy e da conferência)**

Os dois arquivos não são git e só mudam com o agendamento em produção. O plano do PR 1 tem o mesmo passo ("Depois do merge"): é um texto só para o projeto, escrito uma vez, com as duas metades. Se o passo do PR 1 já escreveu, conferir contra o que está abaixo e completar o que faltar. Se algum trecho citado mudou até lá, guie-se pelo sentido.

1. `~/STRONIX-FIRMA/06-sistemas/CLAUDE.md`
   - Tabela "Sistemas Cadastrados", linha do Stronizap: trocar "e cadastra no CRM quem ainda não está lá." por "cadastra no CRM quem ainda não está lá e agenda visita e aula experimental no CRM de dentro da conversa.", e acrescentar " · agendamento pelo Zap desde <data do deploy>" no fim do status. Linha do Stronilead: trocar "recebe o cadastro de lead feito no Zap" por "recebe o cadastro de lead e o agendamento feitos no Zap", e acrescentar o mesmo trecho no status.
   - Seção "Ponte Stronilead ↔ Stronizap": depois do parágrafo **Cadastro de lead pelo Stronizap.**, o parágrafo abaixo, com a data e os números dos dois PRs:

     > **Agendamento pelo Stronizap.** Contato de WhatsApp que o Stronilead acha (lead, cliente ou responsável por um menor) ganha o "Agendar" no cabeçalho da conversa, depois da situação do cadastro. Ele abre um balão passo a passo, como o assistente da ficha: para quem (quando o número tem mais de um cadastro), visita ou aula experimental, unidade, modalidade, professor, quantas aulas e os cinco dias da meta com o horário. As listas e os dias vêm do Stronilead a cada abertura, pelas ações `schedule-options` e `schedule` do `POST /api/zap`, e o Stronizap não guarda lista nenhuma. A gravação é a do assistente, numa transação só: a ficha mostra a marca do Stronizap ao lado de quem agendou, e a Meta Diária conta o ponto para quem agendou. Depois de agendar, o cartão troca na hora, a confirmação para o lead entra na caixa de digitar só quando ela está vazia e nunca é enviada sozinha, e a linha de Agendamento do cartão passa a mostrar o desfecho ("Compareceu" ou "Faltou"). Dia e hora saem sempre no horário de Brasília. O deploy seguiu a ordem do cadastro: o Stronilead primeiro, porque as ações novas ficam paradas até o Stronizap chamar; o Stronizap antes faria a seção do Stronilead sumir no clique em Agendar, porque o Stronilead antigo responde 401. A ação `appointment-status` já está no ar e é do lembrete (PR 3). Em produção desde <data do deploy> (PRs #<número> do `crm-stronix` e #<número> do `whatsapp-stronix`). Spec em `stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md`.

   - Tabela "Os arquivos que formam o contrato": na linha do Stronilead, acrescentar ` · api/_zapSchedule.js`, como o plano do PR 1 pede. Na do Stronizap, os arquivos continuam os mesmos.
   - Parágrafo do smoke: trocar "confere o cartão e as opções do cadastro. Ele nunca cadastra, porque o `create-lead` grava lead de verdade." por "confere o cartão, as opções do cadastro e as do agendamento. Ele nunca cadastra nem agenda, porque o `create-lead` e o `schedule` gravam de verdade."
2. `~/STRONIX-FIRMA/CLAUDE.md`, tabela "Últimas Atualizações": uma linha no fim, no molde da linha de 2026-09-29 do cadastro de lead pelo Stronizap:

   > | <data do deploy> | Agendamento pelo Stronizap em produção, testado pelo Johnny na STRONIX (PRs #<número> do `crm-stronix` e #<número> do `whatsapp-stronix`): contato de WhatsApp com cadastro no Stronilead ganha o "Agendar" no cabeçalho da conversa, depois da situação do cadastro. Ele abre um balão passo a passo com visita ou aula experimental, unidade, modalidade, professor, quantas aulas e os cinco dias da meta com o horário, tudo vindo do Stronilead a cada abertura. O agendamento entra na ficha como o do assistente, com a marca do Stronizap ao lado de quem agendou, e conta na Meta Diária de quem agendou. Com a caixa de digitar vazia, a confirmação para o lead fica escrita nela, sem enviar, e o cartão da conversa mostra o desfecho quando o Stronilead registra ("Compareceu" ou "Faltou"). O lembrete automático antes do horário é o próximo PR. Spec em `06-sistemas/stronilead/docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` |

   Só escrever "testado pelo Johnny na STRONIX" depois do Step 5 feito.

---

## Antes do merge e do deploy

- [ ] O PR do agendamento no `crm-stronix` está mesclado e no ar (Vercel em Ready).
- [ ] O Johnny viu os textos da tabela "Textos de tela que não estão na spec nem no mockup" e o ponto de "Pontos para o Johnny decidir". Texto trocado é só texto: muda o teste que o cita, e nada mais.
- [ ] O Step 1 da Task 17 está verde no worktree, com os números citados.
- [ ] O smoke roda no servidor logo depois do deploy (Task 17, Step 4), antes de avisar a equipe.
