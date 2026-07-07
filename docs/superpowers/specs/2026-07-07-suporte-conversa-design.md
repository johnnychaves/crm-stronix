# Central de Suporte — conversa no ticket + aviso in-app

status: ativo
data: 2026-07-07
aprovado por: Johnny (chat, 2026-07-07)

## Problema

O cliente abre chamado pelo item "Suporte" da sidebar (`CreateTicketModal`), o doc cai na
coleção `tickets` e o fluxo morre aí: o superadmin vê o ticket no Console (tela Suporte)
mas só consegue ciclar o status — não há como responder — e o cliente nunca mais vê o
chamado nem fica sabendo de resposta.

## Decisões (aprovadas)

1. **Formato:** conversa (thread) bidirecional — suporte responde, cliente lê e pode
   responder de volta; sem limite de trocas.
2. **Notificação:** aviso dentro do app (badge em tempo real). E-mail/WhatsApp ficam para
   fase 2 se o in-app não bastar (12/12 funções Vercel usadas e sem provedor de e-mail hoje).

## Modelo de dados

Coleção `tickets` existente — sem coleção nova, sem migração. Campos novos por ticket:

| Campo | Tipo | Uso |
|---|---|---|
| `mensagens` | array de `{ de: 'cliente'\|'suporte', autor: string, texto: string, emMs: number }` | histórico da conversa (append via `arrayUnion`; `serverTimestamp` não funciona dentro de array → usar `Date.now()` em `emMs`) |
| `lastMsgAt` | number (ms) | ordenação e detecção de não-lido |
| `lastMsgBy` | `'cliente'\|'suporte'` | de quem é a última mensagem |
| `clienteLeuEmMs` | number (ms) | última leitura do cliente (setado ao abrir a conversa) |
| `suporteLeuEmMs` | number (ms) | última leitura do superadmin |

- Não-lido do **cliente** = `lastMsgBy === 'suporte' && lastMsgAt > (clienteLeuEmMs || 0)`.
- Não-lido do **suporte** = `lastMsgBy === 'cliente' && lastMsgAt > (suporteLeuEmMs || 0)`.
- Tickets antigos (sem `mensagens`): o `assunto` é renderizado como mensagem de abertura
  do cliente; nada quebra.
- Racional array-no-doc vs subcoleção: 1 doc = 1 listener, rules simples, escala atual
  (unidades de tickets) longe do limite de 1 MB/doc. Subcoleção seria over-engineering.

## Console (superadmin responde)

- Na tela Suporte do `SuperConsole`, clicar na linha do ticket abre painel de conversa
  (histórico + campo de resposta), no visual do console (console.css).
- Responder: `arrayUnion` na `mensagens` com `de: 'suporte'`, atualiza `lastMsgAt/lastMsgBy`;
  se status era `aberto`, vira `em_andamento` automaticamente.
- Abrir a conversa seta `suporteLeuEmMs`.
- Linha com mensagem nova do cliente ganha destaque visual (hoje o superadmin também não
  fica sabendo de nada novo).
- O ciclo manual de status na badge continua funcionando como hoje.

## App do cliente (vê, responde e é avisado)

- O item "Suporte" da sidebar passa a abrir a **Central de suporte** (modal maior, visual
  premium padrão do app): lista dos chamados do tenant (status + preview da última
  mensagem) + conversa do chamado selecionado + botão "Novo chamado" (form atual embutido).
- Cliente responde dentro do chamado (`de: 'cliente'`). Se o ticket estava `resolvido`,
  a resposta reabre (`status: 'aberto'`).
- Abrir a conversa seta `clienteLeuEmMs`.
- **Badge:** bolinha no item "Suporte" da sidebar, alimentada por `onSnapshot` dos tickets
  do tenant (`where tenantId ==`), enquanto existir chamado com não-lido do cliente.

## Regras do Firestore (publicação MANUAL no console Firebase, como de costume)

Cliente ganha `update` restrito na `tickets`:

```
match /tickets/{ticketId} {
  allow read: if isSuperAdmin() || (isSignedIn() && resource.data.tenantId == request.auth.token.tenantId);
  allow create: if isSuperAdmin() || (isSignedIn() && request.resource.data.tenantId == request.auth.token.tenantId);
  allow update: if isSuperAdmin() || (
    isSignedIn()
    && resource.data.tenantId == request.auth.token.tenantId
    && request.resource.data.tenantId == resource.data.tenantId
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['mensagens', 'lastMsgAt', 'lastMsgBy', 'clienteLeuEmMs', 'status', 'updatedAt'])
  );
  allow delete: if isSuperAdmin();
}
```

Risco aceito: o cliente pode tecnicamente reescrever mensagens antigas do array do próprio
ticket (afeta só o chamado dele; sem impacto cross-tenant).

## Fora do escopo (fase 2)

- Notificação por e-mail ou WhatsApp (Stronizap).
- Anexos/imagens nas mensagens.
- Filtros/busca na central de chamados.

## Critérios de aceite

1. Superadmin abre um ticket no console, responde, e a resposta aparece na central do
   cliente em tempo real.
2. Cliente com resposta não lida vê a bolinha no "Suporte" da sidebar; ao abrir a
   conversa, a bolinha some (e não volta ao recarregar).
3. Cliente responde de volta; console mostra destaque de mensagem nova; responder num
   ticket `resolvido` reabre como `aberto`.
4. Tickets antigos (sem `mensagens`) abrem normalmente com o assunto como 1ª mensagem.
5. Cliente de um tenant não lê nem escreve em ticket de outro tenant (rules).
