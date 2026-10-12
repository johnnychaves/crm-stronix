---
status: revisão
---

# Stronix Pay

O Stronix Pay é a cobrança que o Stronilead faz das academias pela assinatura, no lugar da fatura solta de hoje. A academia escolhe pagar no cartão salvo ou no Pix Automático, e o mês se paga sozinho. Se não pagar, uma régua avisa o gestor por WhatsApp e e-mail antes do vencimento, no dia e depois do atraso. O super-admin acompanha tudo numa seção nova do SuperConsole: saldo da conta Asaas, recebimentos por forma de pagamento, transações e repasses.

A ideia veio do Next Fit Pay, o módulo de pagamentos da Next Fit, que a STRONIX usa para cobrar os alunos. Ele tem cartão salvo, Pix Automático, um "motor de cobrança" que tenta de novo e avisa o aluno, e telas de saldo, transações e repasses. O Stronix Pay leva essas ideias para a cobrança do próprio Stronilead. Academia cobrando aluno pelo Stronilead fica fora (ver "Fora do escopo").

Desenhado com o Johnny em 12/10/2026. Hoje são até 10 academias pagantes, e várias escolhas abaixo contam com esse tamanho.

---

## Decisões do Johnny

- **A primeira entrega tem as quatro partes:** cartão salvo, régua de cobrança, painel no SuperConsole e Pix Automático. A ordem das PRs está em "Entrega em partes".
- **A régua avisa por WhatsApp e e-mail.** O WhatsApp sai de um número da STRONIX pelo Stronizap, e o e-mail pelo Resend, o mesmo do "Esqueci a senha".
- **O bloqueio continua como hoje:** a academia é bloqueada 3 dias depois de a fatura entrar em atraso (`paymentOverdueSince`). A régua avisa antes, mas não muda a conta.

### Decisões que esta spec propõe e o Johnny confirma na revisão

1. **Desligar as notificações da própria Asaas** para as academias quando a régua entrar no ar. Hoje cada cliente da Asaas recebe o padrão dela: e-mail e SMS antes e depois do vencimento, e ligação de robô nos dois avisos de atraso. Com a régua, a academia receberia os dois. A régua manda o link da fatura, então nada se perde.
2. **O e-mail sai de `financeiro@stronilead.com.br`**, com resposta para o e-mail de suporte que o Johnny escolher. O domínio já está verificado no Resend.
3. **Quem recebe é o responsável do Perfil da academia:** o WhatsApp de `tenants/{id}/private.responsiblePhone` (o mesmo que vai para a Asaas como `mobilePhone`) e o e-mail `primaryAdminEmail`. Contato financeiro separado fica para depois.

---

## Como é hoje

O inventário completo, com as linhas, foi levantado em 12/10/2026. O que importa para esta spec:

- **Uma assinatura Asaas por academia, sem forma de pagamento escolhida.** O `createSubscription` (`api/_asaas.js`) manda `billingType: 'UNDEFINED'`, e a academia escolhe Pix, boleto ou cartão na fatura hospedada da Asaas, todo mês, à mão. Não há cartão salvo nem Pix Automático.
- **O webhook** (`api/asaas.js`, `handleWebhook`) trata seis eventos de cobrança. Pago vira `paymentStatus: 'paid'` e tira o trial; `PAYMENT_OVERDUE` vira `overdue` e grava `paymentOverdueSince` com a hora em que o evento chega; estorno e remoção voltam para `pending`; `PAYMENT_CREATED` grava `nextBillingAt` e `lastInvoiceUrl`. Tudo vai para `tenant_payments`, com idempotência por `asaas_events`. Evento sem `payment` é ignorado, então nenhum evento de assinatura ou de Pix Automático chega a ser lido.
- **O bloqueio** é `paymentStatus == 'overdue'` com mais de 3 dias desde `paymentOverdueSince`, conferido no login (`App.jsx`), nas regras (`paymentBlocked`, `firestore.rules`) e na ponte do Stronizap (`tenantBlocked`, `api/_zapLead.js`).
- **A academia bloqueada não tem como pagar pelo app.** A `TenantBlockedScreen` (`src/views/auth/TenantBlockedScreen.jsx`) só tem o Sair. O aviso de vencimento com "Pagar fatura" (`src/components/layout/Banners.jsx`) só aparece para quem ainda entra.
- **Ninguém é avisado pelo Stronilead.** O `api/_mail.js` só manda o "Esqueci a senha", o servidor não manda WhatsApp, e o `vercel.json` não tem cron. Quem avisa hoje é a própria Asaas, com o padrão de notificações dela.
- **O Faturamento do SuperConsole** (`src/views/console/SuperConsole.jsx`) mostra MRR, ARR, "Recebido" somado dos 25 pagamentos mais recentes de todas as academias, inadimplência e próximos vencimentos. O cartão de pagamentos da página da academia filtra esses mesmos 25 e pode aparecer vazio com histórico. O botão Exportar não faz nada.
- **A tela Plano e faturas** (`src/views/settings/PlanInvoicesTab.jsx`) só troca de plano. O aviso "Faturas já emitidas não mudam" contradiz o `updatePendingPayments: true` do `updateSubscription`.
- **Um pagamento qualquer limpa a inadimplência**, mesmo com outra fatura da academia ainda em atraso.
- **São 11 das 12 funções da Vercel.** Nada desta spec cria função nova.

---

## O que a Asaas oferece, e o que não

A pesquisa na documentação foi feita em 12/10/2026. O que muda o desenho:

- **Cartão sem o número passar pelo nosso servidor.** O caminho documentado é o **Checkout recorrente** (`POST /v3/checkouts` com `billingTypes: ['CREDIT_CARD']`, `chargeTypes: ['RECURRENT']` e o bloco `subscription`). A academia digita o cartão na página da Asaas, e a Asaas cria uma **assinatura nova** e manda `CHECKOUT_PAID` e `SUBSCRIPTION_CREATED`. As cobranças seguintes caem no cartão no vencimento. A tokenização pela API (`/creditCard/tokenizeCreditCard`) exige o número do cartão no nosso servidor e fica fora.
- **Trocar o cartão de uma assinatura** pela API exige o cartão inteiro ou um token, e a Asaas não tem página para isso. Por isso trocar o cartão, aqui, é fazer outro Checkout recorrente: nasce outra assinatura e a antiga é cancelada.
- **Tentativas no cartão:** pelo blog da Asaas, são 3 no dia do vencimento (8h, 14h e 20h) e mais 2, uma por dia. Depois disso a cobrança vence. A documentação técnica não fala disso, e não há configuração conhecida.
- **Não existe motivo de recusa do cartão na API.** O que se sabe vem do evento: `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` (recusado) ou `PAYMENT_REPROVED_BY_RISK_ANALYSIS` (reprovado na análise de risco). O painel mostra só isso. Motivo como "limite insuficiente", do jeito que a Next Fit mostra, não está disponível.
- **Pix Automático** tem acesso controlado: é preciso pedir à equipe de Integration Success da Asaas. A conta tem de ser PJ aprovada, com CNPJ ativo há pelo menos 6 meses e sem restrição no Pix. O fluxo é a "Jornada 3": uma autorização com QR Code, em que a academia paga o primeiro Pix e autoriza os próximos. Com `paymentCreationMode: 'SUBSCRIPTION'` a Asaas gera as cobranças sozinha. A política de nova tentativa (`ALLOW_THREE_IN_SEVEN_DAYS`) só pode ser escolhida na criação. O sandbox não lista o Pix Automático entre o que pode ser testado.
- **Painel:** saldo (`/finance/balance`), extrato (`/financialTransactions`), estatísticas por status, forma e período (`/finance/payment/statistics`), transferências (`/transfers`) e taxas (`/myAccount/fees`) existem na API.
- **Webhook:** a fila para depois de 15 falhas seguidas, e evento parado há mais de 14 dias é apagado. Todo evento que a gente não usa precisa continuar respondendo 200.
- **Limite de uso:** 25.000 requisições a cada 12 horas por conta. Com até 10 academias, ler a Asaas ao vivo no painel cabe com folga.

Os links de cada ponto estão no levantamento da Parte 0 (ver "Entrega em partes").

---

## Formas de pagamento

Cada academia tem uma forma de pagamento, gravada em `tenants/{id}.billingMethod`:

| `billingMethod` | Como paga | Assinatura na Asaas |
|---|---|---|
| `invoice` | Pix, boleto ou cartão avulso na fatura, todo mês, à mão. É o de hoje. | `billingType: 'UNDEFINED'` |
| `card` | Cartão salvo, cobrado sozinho no vencimento. | Criada pelo Checkout recorrente |
| `pix_auto` | Pix Automático, debitado sozinho pelo banco da academia. | Autorização de Pix Automático no modo `SUBSCRIPTION` |

Campo ausente é `invoice`, então as academias de hoje não precisam de script.

### Cartão salvo

**Onde:** na tela Plano e faturas, que passa a ter um bloco "Forma de pagamento", só para o gestor, como hoje.

**Cadastrar o cartão:**

1. O gestor clica em "Pagar no cartão automaticamente".
2. O servidor cria um Checkout recorrente com o valor efetivo (`effectivePrice`), o ciclo da academia (`MONTHLY` ou `YEARLY`) e o `nextDueDate` igual ao próximo vencimento ainda não pago. A academia é identificada pelo `externalReference` (o id da academia), se o Checkout aceitar, e pelo id do Checkout guardado em `tenants/{id}.pendingCardCheckout` (`{ id, createdAt }`).
3. O app abre a página da Asaas em outra guia. A volta cai em `/<academia>/plano-e-faturas`, a tela que o gestor abre pelo menu do perfil ("Plano & faturas").
4. No `SUBSCRIPTION_CREATED` (ou no `CHECKOUT_PAID`, o que vier primeiro com a assinatura), o webhook liga a assinatura nova à academia (`asaasSubscriptionId`), grava `billingMethod: 'card'`, os quatro últimos dígitos e a bandeira (`cardLast4`, `cardBrand`, da primeira cobrança), apaga o `pendingCardCheckout` e **cancela a assinatura antiga** na Asaas.
5. A tela mostra "Cartão Visa final 1234 · cobrado sozinho todo dia 10".

**Trocar o cartão** é o mesmo caminho, com o botão "Trocar cartão". O cartão novo vale a partir do próximo vencimento.

**Fatura em atraso:** com fatura vencida, o bloco mostra primeiro "Pagar fatura em atraso" (o `invoiceUrl` dela, em qualquer forma), e o cadastro do cartão vale para os meses seguintes. Assim o Checkout nunca precisa cobrar um mês atrasado, e a assinatura antiga só é cancelada sem fatura em aberto.

**Voltar para a fatura:** "Pagar por Pix ou boleto a cada mês" cria uma assinatura `UNDEFINED` com o próximo vencimento e cancela a do cartão.

**O que precisa ser confirmado no sandbox antes do plano** (Parte 0):

- O Checkout recorrente com `nextDueDate` no futuro cobra na hora ou só no vencimento? Se cobra na hora, o próximo vencimento da assinatura antiga é removido antes de abrir o Checkout.
- O Checkout aceita o cliente que já existe ou o `externalReference`? Se criar um cliente novo a cada vez, o webhook acha a academia pelo `pendingCardCheckout`, e o cliente antigo fica sem uso.
- O `SUBSCRIPTION_CREATED` e a primeira cobrança trazem os quatro dígitos e a bandeira?
- Cancelar a assinatura antiga remove as cobranças pendentes dela?
- **Mudar o valor de uma assinatura no cartão.** A documentação diz que alterar valor ou vencimento de assinatura no cartão exige tokenização habilitada. O `syncSubscriptionValue` muda o valor sempre que a academia ganha ou perde um consultor extra. Se o `PUT` for recusado, a saída é pedir à Asaas que habilite a tokenização na conta (ela passa por análise), sem nunca tokenizar pelo nosso servidor. Sem isso, o cartão salvo não funciona para quem tem extras, e o plano precisa de outra saída.

### Pix Automático

**Pré-condição:** a Asaas liberar o Pix Automático na conta do Stronilead, com o CNPJ da empresa dentro dos requisitos. O Johnny pede a liberação na Parte 0. Sem ela, a Parte 4 não começa, e o botão não aparece.

**Ativar:**

1. O gestor clica em "Pagar por Pix Automático".
2. O servidor cria a autorização (`POST /v3/pix/automatic/authorizations`) com `frequency` igual ao ciclo, `startDate` no próximo vencimento, `customerId` da academia, `paymentCreationMode: 'SUBSCRIPTION'`, `retryPolicy: 'ALLOW_THREE_IN_SEVEN_DAYS'` e o QR Code imediato.
3. O app mostra o QR Code e o "copia e cola" numa janela, com o valor do primeiro Pix.
4. O gestor paga no app do banco e autoriza as próximas cobranças.
5. No `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`, o webhook grava `billingMethod: 'pix_auto'` e `pixAutoAuthorizationId`, e cancela a assinatura antiga.

**Saldo insuficiente:** o banco tenta de novo no mesmo dia. Se a instrução for recusada (`PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED`), o webhook pede nova tentativa para o dia útil seguinte (`POST /v3/pix/automatic/paymentInstructions/{id}/retries`), até 3 vezes em 7 dias, que é o que a política permite. Depois disso a cobrança vence, e a régua segue como nas outras formas.

**A academia cancelou no banco** (`AUTHORIZATION_CANCELLED`, `EXPIRED` ou `REFUSED`): o webhook volta a academia para `invoice`, cria a assinatura `UNDEFINED` com o próximo vencimento e marca a troca para a régua avisar o gestor ("O Pix Automático foi cancelado. A próxima fatura vem pelo link.").

**Desenho preliminar.** O que precisa ser confirmado com a Asaas, já que o sandbox não testa o Pix Automático: se o primeiro Pix do QR Code paga a fatura em aberto ou cria outra cobrança, como o valor variável dos consultores extras cabe na autorização (`value` fixo ou `minLimitValue`) e quanto custa cada Pix.

---

## A régua de cobrança

A régua avisa o gestor da academia sobre a mensalidade do Stronilead. Ela não muda o bloqueio nem cobra nada: quem cobra é a Asaas.

### As etapas

As etapas antes do vencimento contam do `dueDate` da cobrança. As de depois contam de `paymentOverdueSince`, a mesma marca que o bloqueio usa, para os avisos baterem com o bloqueio. Os dias são os do calendário de Brasília (`api/_horarioDeBrasilia.js`).

| Etapa | Quando | Para quem | Mensagem |
|---|---|---|---|
| `aviso` | 3 dias antes do vencimento | `invoice` | Vence em 3 dias, com o link |
| `hoje` | No dia do vencimento | `invoice` | Vence hoje, com o link |
| `atraso` | No dia em que a cobrança entra em atraso | todas | Não identificamos o pagamento, ou o cartão recusou, com o link |
| `vespera` | 2 dias depois do atraso | todas | O acesso será bloqueado amanhã, com o link |
| `bloqueio` | Na primeira rodada com a academia já bloqueada | todas | O acesso está bloqueado; pagando, libera na hora |
| `liberado` | Quando a academia bloqueada paga | todas | Pagamento recebido, acesso liberado |

No cartão salvo e no Pix Automático não há `aviso` nem `hoje`, porque o mês se paga sozinho. A régua só entra depois que as tentativas da Asaas acabam e a cobrança vence.

A etapa `bloqueio` usa a mesma conta do bloqueio (`paymentBlocked`). Ela é extraída para um módulo puro que o login, a ponte e a régua dividem, com teste de paridade contra a regra do `firestore.rules`.

### Os textos

Cada etapa tem um texto de WhatsApp e um e-mail com o mesmo conteúdo. `{nome}` é o primeiro nome do responsável, só quando passa na mesma regra do e-mail do "Esqueci a senha" (`NAME_RE`); senão a saudação fica sem nome.

- **aviso:** "Oi, {nome}! A mensalidade do Stronilead da {academia}, de {valor}, vence em {data}. Dá para pagar por Pix, boleto ou cartão neste link: {link}"
- **hoje:** "Oi, {nome}! A mensalidade do Stronilead da {academia}, de {valor}, vence hoje. Para pagar: {link}"
- **atraso, fatura e Pix Automático:** "Oi, {nome}. Não identificamos o pagamento da mensalidade do Stronilead da {academia}, de {valor}, que venceu em {data}. Para pagar: {link}. Se já pagou, pode ignorar esta mensagem."
- **atraso, cartão:** "Oi, {nome}. O cartão final {final} não passou na mensalidade do Stronilead da {academia}, de {valor}. Dá para pagar por Pix, boleto ou outro cartão neste link: {link}. Para trocar o cartão dos próximos meses, abra Plano & faturas no menu do seu perfil no Stronilead."
- **vespera:** "Oi, {nome}. A mensalidade do Stronilead da {academia} continua em aberto, e o acesso da equipe será bloqueado amanhã. Para pagar: {link}"
- **bloqueio:** "Oi, {nome}. O acesso ao Stronilead da {academia} está bloqueado por causa da mensalidade de {data}. Pagando por Pix, o acesso volta em poucos minutos: {link}"
- **liberado:** "Pagamento recebido. O acesso ao Stronilead da {academia} já está liberado. Obrigado!"

O link é o `invoiceUrl` da cobrança, que aceita Pix, boleto e cartão avulso em qualquer forma de pagamento.

### Quando a régua não avisa

- A cobrança foi paga, removida ou estornada.
- A academia está suspensa, arquivada ou é conta interna (`internal`).
- O super-admin pausou a régua da academia (`tenants/{id}.billingRemindersPaused`), por exemplo numa negociação. A pausa fica no ManagePanel, grava pela `api/tenant-status.js` e entra na auditoria.
- Falta o contato: sem WhatsApp, só o e-mail sai, e vice-versa. Sem os dois, a etapa é gravada como `skipped`, e o painel mostra a academia sem contato.

### Como a régua roda

**O Stronilead decide e o Stronizap entrega o WhatsApp.**

1. **Uma rodada por dia no Stronilead.** Um cron da Vercel chama `GET /api/asaas?job=regua` às 9h de Brasília (`0 12 * * *`). No plano Hobby a Vercel só roda cron uma vez por dia, com o horário aproximado dentro da hora, e para esta régua isso basta. A rota confere `Authorization: Bearer <CRON_SECRET>` em tempo constante, antes do caminho do super-admin, que também usa Bearer.
2. **A rodada** lê na Asaas as cobranças em aberto (`PENDING` com vencimento nos próximos 3 dias e `OVERDUE`), acha a academia de cada uma pelo `externalReference`, calcula as etapas devidas e grava cada uma em `billing_reminders/{paymentId}_{etapa}`. O id fixo é a idempotência: a rodada repetida, ou duas rodadas no mesmo dia, não mandam a etapa duas vezes.
3. **O e-mail sai na própria rodada**, pelo `api/_mail.js`, com o mesmo modo de log no Preview do "Esqueci a senha". Até 10 academias e no máximo 2 etapas por dia cada uma dão bem menos que a cota grátis do Resend, dividida com o Stronizap e com o teto do "Esqueci a senha".
4. **O WhatsApp fica pendente** (`whatsapp.status: 'pending'`) até o Stronizap buscar.
5. **O Stronizap busca a cada 15 minutos**, das 8h às 21h de Brasília, no molde do lembrete de agendamento que ele já tem. Ele chama a ação `billing-reminders` do `POST /api/zap`, recebe os avisos pendentes com o texto pronto, grava cada um como mensagem agendada numa conversa da organização da STRONIX e, depois de enviar, chama `billing-reminder-ack` com `sent` ou `failed`.
6. **O `liberado` não espera a rodada.** O webhook grava a etapa quando a academia bloqueada paga e manda o e-mail pelo `waitUntil`, como o "Esqueci a senha". O WhatsApp entra na próxima busca do Stronizap.

**Pagou no meio do caminho:** quando o webhook marca uma cobrança como paga, ele marca como `skipped` todo WhatsApp ainda pendente dela. O Stronizap também confere a lista de novo na hora de enviar, como já faz com o `appointment-status`.

**Aviso velho não sai:** WhatsApp pendente há mais de 24 horas vira `skipped` na rodada seguinte. Sem isso, um Stronizap fora do ar por um dia mandaria de uma vez avisos que já não valem.

### A ponte com o Stronizap

As duas ações novas moram no `api/zap.js`, no desvio do começo do `handlePost`, mas **não usam a chave da academia**. A chave da ponte é emitida por academia e só enxerga a própria academia, e a régua enxerga todas. Elas autenticam por um segredo de serviço, `ZAP_BILLING_KEY`, no header `x-stronilead-billing-key`, comparado em tempo constante. A ação de régua com chave de academia é recusada, e a ação de academia com o segredo de serviço também.

- **`billing-reminders`** recebe `{}` e devolve `{ reminders: [{ id, phone, text }] }`: os WhatsApp pendentes, no máximo 50, com o telefone já no formato do WhatsApp (55, DDD e o número) e o texto pronto. Não devolve CPF, CNPJ, valor solto nem nome da academia fora do texto.
- **`billing-reminder-ack`** recebe `{ id, status: 'sent' | 'failed', waMessageId?, error? }` e grava no `billing_reminders`. Id desconhecido responde 404; status repetido não muda nada.

**No Stronizap** (PR no repositório dele, `whatsapp-stronix`):

- Uma organização da STRONIX com um canal próprio, o número que manda a cobrança. A configuração liga e desliga a busca e escolhe o canal.
- Uma varredura nova no agendador, no molde do `runCrmReminderSweep`, só para essa organização e só das 8h às 21h.
- Para cada aviso, acha ou cria o contato e a conversa (uma versão do `startConversation` que não depende de um atendente logado), grava a mensagem agendada para agora com o marcador `billingReminder` (o id do aviso, que impede o envio duplicado) e deixa uma nota interna na conversa. O envio que já existe faz o resto.
- A exceção de conversa encerrada (`scheduledDispatch.ts`) passa a valer também para esse marcador, como já vale para o lembrete.
- O endereço do Stronilead e o `ZAP_BILLING_KEY` ficam no `.env` do Stronizap.

O Stronizap usa o Baileys, que não é a API oficial do WhatsApp. O risco é o número ser banido por mensagem que a pessoa não pediu. Aqui o volume é pequeno (até 10 academias, poucos avisos por mês) e quem recebe é cliente, mas o número da cobrança deve ser só para isso, e não o da recepção da STRONIX.

### O que a régua recuperou

Quando o webhook marca uma cobrança como paga e ela teve alguma etapa de depois do vencimento entregue (`atraso`, `vespera` ou `bloqueio`, por WhatsApp ou e-mail), o `tenant_payments` dela ganha `recoveredByReminder: true`. É o "valor recuperado pela régua" do painel, a mesma ideia da "inteligência de cobranças" da Next Fit. A conta não prova que a mensagem causou o pagamento; diz só que o pagamento veio depois de um aviso de atraso.

---

## O painel Stronix Pay no SuperConsole

A seção Faturamento passa a se chamar **Stronix Pay** e ganha o que falta. Os números do MRR e do ARR continuam onde estão, na Visão geral.

**Faixa do topo:**

- Saldo disponível na conta Asaas (`/finance/balance`).
- A receber: cobranças confirmadas que ainda não caíram na conta, o "saldo futuro" do cartão.
- Recebido no mês (`/finance/payment/statistics`, status recebido, mês corrente). Substitui a soma dos 25 últimos pagamentos.
- Em atraso: soma e número de cobranças vencidas.
- Recuperado pela régua no mês.

**Recebimentos por forma de pagamento:** os últimos 6 meses, com cartão, Pix, Pix Automático e boleto separados.

**Transações:** as cobranças dos últimos 90 dias de todas as academias, lidas da Asaas (`/payments`), com academia, descrição, vencimento, forma, valor e situação. As situações são pago, pendente, vencido, recusado no cartão, reprovado na análise de risco, estornado e contestado. Filtros por situação, forma, academia e período, no endereço, pela tabela do `src/lib/screenParams.js`. A linha abre o detalhe com os eventos da cobrança (os registros de `tenant_payments` dela), os avisos da régua com o canal e o resultado de cada um, e o link da fatura com "Copiar".

**Repasses:** as transferências da conta Asaas para o banco (`/transfers`), com data, valor, destino e situação.

**Régua:** quantos avisos saíram no mês, por etapa e canal, quantos falharam e as academias sem contato ou com a régua pausada.

**Página da academia:** o cartão de pagamentos passa a ler as cobranças da própria academia na Asaas (`/payments?customer=`), e não mais os 25 de todas. Ele mostra também a forma de pagamento, o cartão, o estado da régua e o botão de pausa.

**De onde vêm os dados:** uma ação nova do super-admin no `api/asaas.js` (`GET ?view=stronixpay`) junta as leituras da Asaas numa resposta só. A tela a guarda na memória da sessão e tem um "Atualizar". Com até 10 academias, a leitura ao vivo cabe no limite da Asaas. Com muito mais, ela precisaria de cache.

**Fora do painel nesta entrega:** antecipação, extrato completo e exportação. O botão Exportar, que hoje não faz nada, sai da tela.

---

## O que a academia vê

**Plano e faturas** ganha o bloco "Forma de pagamento":

- A forma atual: "Cartão Visa final 1234 · cobrado sozinho todo dia 10", "Pix Automático · debitado sozinho todo dia 10" ou "Pix, boleto ou cartão pelo link, todo mês".
- Os botões: "Pagar no cartão automaticamente", "Trocar cartão", "Pagar por Pix Automático" (só com o Pix Automático liberado) e "Pagar por Pix ou boleto a cada mês".
- A lista de faturas ganha as situações novas ("Cartão recusado", "Em análise").
- O aviso "Faturas já emitidas não mudam" é corrigido. Com o `updatePendingPayments: true`, a fatura em aberto muda de valor junto.

**Academia bloqueada:** a `TenantBlockedScreen` ganha "Pagar fatura", que abre o link da cobrança em atraso, e "Já paguei, atualizar", que confere o pagamento e entra se ele já caiu, como a `TrialActivationScreen` faz. O consultor vê "Peça ao gestor para regularizar a mensalidade". O link vem de uma ação nova do `api/asaas.js` que lê na Asaas a cobrança vencida da academia de quem está logado. O `lastInvoiceUrl` não serve, porque é o da última cobrança criada, que pode já ser a do mês seguinte.

---

## Dados

### `tenants/{id}`: campos novos

Só o servidor grava, como todo o documento da academia.

| Campo | O que é |
|---|---|
| `billingMethod` | `invoice`, `card` ou `pix_auto`. Ausente é `invoice`. |
| `cardLast4`, `cardBrand` | Do cartão salvo. Saem quando a forma deixa de ser `card`. |
| `pendingCardCheckout` | `{ id, createdAt }` do Checkout aberto, até o webhook ligar a assinatura. |
| `pixAutoAuthorizationId`, `pixAutoStatus` | Da autorização de Pix Automático. |
| `billingRemindersPaused` | Régua pausada pelo super-admin. |

### `billing_reminders/{paymentId}_{etapa}`

```
{
  tenantId, paymentId, step, dueDate, value, invoiceUrl, billingMethod,
  createdAt,
  email:    { status: 'sent' | 'failed' | 'skipped', at, error? },
  whatsapp: { status: 'pending' | 'sent' | 'failed' | 'skipped', at, waMessageId?, error? },
}
```

O texto não é guardado; ele sai do módulo de textos na hora de mandar.

### `tenant_payments`: campos novos

`refusal` (`card_refused` ou `risk_reproved`, pelo evento) e `recoveredByReminder`.

### Regras do Firestore

`billing_reminders` fica igual a `tenant_payments`: só o super-admin lê e ninguém grava pelo navegador. As regras são publicadas à mão no console, antes do merge da Parte 3.

---

## O webhook

O `handleWebhook` passa a ler três famílias de evento. Todo evento que ele não usa continua respondendo 200, porque a fila da Asaas para depois de 15 falhas seguidas.

- **Cobrança (`PAYMENT_*`)**, como hoje, mais:
  - `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` e `PAYMENT_REPROVED_BY_RISK_ANALYSIS` gravam o `refusal` e não mudam o `paymentStatus`. A Asaas ainda tenta de novo, e quem marca o atraso é o `PAYMENT_OVERDUE`.
  - `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_CHARGEBACK_DISPUTE` vão para o `tenant_payments` e aparecem no painel como contestado. O bloqueio não muda.
  - **Pago com outra cobrança em atraso:** antes de limpar a inadimplência, o webhook pergunta à Asaas se a academia tem outra cobrança `OVERDUE`. Se tiver, a academia continua `overdue`. Hoje um pagamento qualquer libera.
- **Assinatura e Checkout (`SUBSCRIPTION_*`, `CHECKOUT_PAID`)**: ligam a assinatura nova do cartão salvo e cancelam a antiga.
- **Pix Automático (`PIX_AUTOMATIC_RECURRING_*`)**: ativação, cancelamento e recusa de instrução, como descrito em "Pix Automático".

Os eventos novos não têm `payment`, então o "ignorado por não ter `payment`" sai. A idempotência continua pelo `id` do evento e, sem ele, pela chave derivada do objeto que o evento traz (cobrança, assinatura, checkout ou autorização) mais o tipo, como a de hoje faz com a cobrança.

O `docs/ASAAS_SETUP.md` ganha os eventos novos na lista do webhook, o `CRON_SECRET`, o `ZAP_BILLING_KEY` e o passo de desligar as notificações da Asaas.

---

## Infraestrutura

- **Nenhuma função nova.** O cron, o painel, o cartão e o Pix Automático entram no `api/asaas.js`, e as duas ações do Stronizap entram no `api/zap.js`. Continuam 11 de 12.
- O `vercel.json` ganha o cron e o `maxDuration` de 30 s no `api/asaas.js`.
- **Variáveis novas:** `CRON_SECRET` (a Vercel manda no header do cron) e `ZAP_BILLING_KEY` (Stronilead e Stronizap).
- As regras de bloqueio que hoje moram em três lugares (`App.jsx`, `firestore.rules` e `api/_zapLead.js`) passam a sair de um módulo puro único no lado do servidor e do app, com o teste de paridade contra as regras.

---

## Entrega em partes

Cada parte é uma PR, na ordem.

0. **Levantamento e liberação**, sem código de produto. Um documento `docs/superpowers/specs/2026-10-xx-stronix-pay-levantamento.md` com:
   - as respostas do sandbox às perguntas do cartão salvo;
   - os links da documentação da Asaas;
   - o pedido de liberação do Pix Automático feito pelo Johnny, e a confirmação do CNPJ.

   Os mockups da seção Stronix Pay e do bloco Forma de pagamento (2 ou 3 opções cada, com a skill `frontend-design`) também saem aqui, para o Johnny escolher antes do plano.
1. **Base e painel.**
   - Testes do webhook de hoje, que não existem.
   - Os eventos novos de cobrança, o "pago com outra em atraso" e o módulo único do bloqueio.
   - A seção Stronix Pay do SuperConsole e o cartão de pagamentos da academia.
   - O "Pagar fatura" da tela de bloqueio.
2. **Cartão salvo.** O bloco Forma de pagamento, o Checkout recorrente, a troca de assinatura no webhook e a volta para a fatura.
3. **Régua.**
   - O cron, os textos e o e-mail.
   - As ações do Stronizap, a pausa no ManagePanel e o "recuperado pela régua".
   - As notificações da Asaas desligadas, se o Johnny confirmar.
   - Junto, a PR do Stronizap. O Stronizap só liga a busca depois que esta parte estiver em produção.
4. **Pix Automático**, depois da liberação da Asaas. A autorização, o QR Code, os eventos e as novas tentativas.

---

## Fora do escopo

- **Academia cobrando aluno pelo Stronilead** (um "Next Fit Pay" de verdade, com subconta por academia). As cobranças dos alunos continuam no Next Fit.
- Antecipação, extrato completo e exportação no painel.
- Contato financeiro separado do responsável da academia.
- Cobrança proporcional na troca de plano no meio do mês.
- Nota fiscal da mensalidade.
- Negativação (`DUNNING_*`) e disputa de chargeback pela tela. A disputa continua no painel da Asaas.

### Limites aceitos

- O painel não mostra o motivo da recusa do cartão, porque a Asaas não o entrega.
- A régua roda uma vez por dia. Uma cobrança que entra em atraso às 10h recebe o aviso de atraso na manhã seguinte.
- Trocar o cartão cria uma assinatura nova na Asaas. O histórico da academia passa a ter mais de uma assinatura, e o painel junta as cobranças pelo cliente.
- O "recuperado pela régua" diz que o pagamento veio depois de um aviso, não que veio por causa dele.

## Riscos

- **O Checkout recorrente pode não se comportar como a documentação sugere.** A Parte 0 responde antes de qualquer código, e o plano do cartão salvo só é escrito depois.
- **Mudar o valor de assinatura no cartão pode exigir tokenização habilitada** (ver "Cartão salvo"). Sem ela, academia com consultor extra não pode usar o cartão salvo.
- **Pix Automático depende de a Asaas liberar.** A Parte 4 pode ficar parada, e as outras três não dependem dela.
- **WhatsApp pelo Baileys** pode levar o número a ser banido. O número da cobrança deve ser só dela.
- **Plano Hobby da Vercel.** Pelos termos da Vercel, o Hobby é para uso pessoal e não comercial, e o Stronilead já cobra academias. Com cobrança automática em produção, vale passar para o Pro, que também tira o limite de 12 funções e de um cron por dia. A decisão é do Johnny e não muda esta spec.

## Testes

- **Webhook** (`api/__tests__/asaasWebhook.test.js`, novo, com um banco falso no molde do `zapRoute.test.js`): cada evento e o efeito na academia, a idempotência pelo `id`, o evento desconhecido respondendo 200, o pago com outra cobrança em atraso, a troca de assinatura do cartão e a ativação e o cancelamento do Pix Automático.
- **Régua** (`api/__tests__/billingReminders.test.js`): as etapas devidas por forma de pagamento e por dia, no calendário de Brasília com o processo em UTC (como o `zapFuso.test.js`), a idempotência pelo id da etapa, a pausa, a academia suspensa, o contato faltando, o WhatsApp vencido em 24 horas e o `liberado`.
- **Textos:** cada etapa com e sem nome, e o nome que não passa no `NAME_RE`.
- **Ponte:** as duas ações só com o segredo de serviço, recusadas com a chave de academia; a ação de academia recusada com o segredo de serviço; o `ack` repetido.
- **Cron:** o `job=regua` recusado sem o `CRON_SECRET` e nunca confundido com o Bearer do super-admin.
- **Bloqueio:** paridade do módulo único com o `paymentBlocked` do `firestore.rules`.
- **Telas** (jsdom): o "Pagar fatura" da tela de bloqueio para gestor e consultor, o bloco Forma de pagamento em cada forma, e a seção Stronix Pay com dados falsos.
