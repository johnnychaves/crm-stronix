---
status: revisão
data: 2026-09-28
sistemas: Stronilead
---

# Esqueci a senha na tela de login

Spec aprovada em conversa com o Johnny em 28/09/2026. Segue o padrão do "Esqueci a senha" do Stronizap, em produção desde 28/09/2026 (`06-sistemas/stronizap/docs/superpowers/specs/2026-09-22-esqueci-a-senha-design.md`), com as diferenças que o Stronilead pede: o login vai direto ao Firebase, o servidor são funções da Vercel e o banco é o Firestore.

## Problema

"Esqueci a senha" e "Recuperar acesso", na tela de login (`src/views/auth/LoginScreen.jsx`), chamam o `sendPasswordResetEmail` do Firebase. Ele manda um link pelo remetente padrão do Firebase, e o link abre a página do próprio Firebase para criar a senha. A proteção contra enumeração de e-mail está ligada no Firebase Auth, então a tela responde "Enviamos um link de redefinição" para qualquer e-mail, com conta ou sem, e o ramo de `auth/user-not-found` do código nunca roda. Segundo o Johnny, esse caminho não funciona hoje.

Sem ele, quem esquece a senha depende do gestor da academia, que define uma senha nova em Configurações → Equipe & acessos.

## O que este passo entrega

Quem esqueceu a senha pede um código de 6 números por e-mail na tela de login, digita o código com a senha nova e volta a entrar sem depender de ninguém. Vale para gestor e consultor de qualquer academia. O super-admin fica de fora e continua recuperando o acesso pelo `scripts/create-super-admin.js`, que já troca a senha dele.

## Decisões tomadas

- **Código de 6 números por e-mail, não link.** A pessoa digita o código na própria tela. Ajuda quando o e-mail está no celular e o Stronilead no computador da recepção.
- **Remetente `Stronilead <nao-responda@stronilead.com.br>` pelo Resend**, com o domínio verificado. O envio é um `fetch` direto na API do Resend, e nenhuma biblioteca nova entra no projeto.
- **O servidor fica em duas ações novas do `api/tenant-resolve.js`**, o endpoint público que já atende a página de indicação. A lógica mora em arquivos com sublinhado, que a Vercel não publica como função. O app continua com 11 das 12 funções do plano Hobby.
- **O pedido fica no Firestore**, num documento por conta, que guarda só uma impressão do código.
- **Super-admin fora.** É a conta que enxerga todas as academias, e um código de 6 números por e-mail protege menos que a senha.
- **A tela nunca revela se um e-mail tem conta.** O passo 1 responde sempre igual e no mesmo tempo, porque a resposta sai antes do trabalho, pelo `waitUntil` da Vercel. O passo 2 tem uma frase só para qualquer falha.
- **Depois de trocar, a pessoa entra pelo login.** A troca não abre sessão.
- **As sessões abertas caem em até 1 hora.** O Firebase não derruba uma sessão na hora, como o Stronizap faz com os sockets. A troca revoga as sessões: as chamadas ao `api/` param na hora, porque o `verifyRequest` confere a revogação, e as telas abertas voltam para o login quando o token de acesso vence, em até 1 hora. O Johnny aprovou esse prazo.
- **Sem Turnstile.** O Stronilead não usa a Cloudflare, e o login vai direto ao Firebase (spec de segurança de 2026-08-03). A proteção fica com o limite por IP, o de 5 códigos por dia e o de 5 tentativas.
- **Sem o Resend configurado em produção, a função fica desligada** e o resto do app segue igual.
- **O `sendPasswordResetEmail` sai do app.**

## Interface

### Endereço e entrada

A tela nova fica em `/recuperar-senha`. A palavra já está em `RESERVED_TENANT_SLUGS` (`src/lib/tenantSlug.js`), então nenhuma academia pode ter esse identificador, e o `loginTenantSlug` devolve `null` para esse endereço: a tela não chama o `/api/tenant-resolve` para buscar marca.

No login, "Esqueci a senha" e "Recuperar acesso" viram `<Link to="/recuperar-senha">`. O estado da navegação leva o e-mail digitado e a academia do endereço (`{ slug, displayName }`, só quando o login achou a academia). A tela nova usa a academia para mostrar a mesma etiqueta com o nome dela que o login mostra e para voltar ao login certo: `/<academia>`, ou `/` sem academia. O estado da navegação sobrevive ao F5.

O `AppInner` decide: sem sessão e no endereço `/recuperar-senha`, desenha a tela nova no lugar do login. Com sessão, o `routeDecision` já leva esse endereço para a tela inicial e não mostra aviso. A primeira palavra é reservada, a rota sai como desconhecida e sem academia, e o `sessionPathFor` devolve a tela inicial. Super-admin puro vai para `/`. Conferido em 28/09/2026 rodando `parseAppPath` e `routeDecision`.

### Visual

Igual ao do login. O painel azul da esquerda, a marca do celular e o rodapé saem do `LoginScreen` para um `AuthLayout`, que recebe o formulário como `children`. O campo (rótulo, ícone, input e aviso embaixo) vira `AuthField`. O login e a tela nova usam os dois, e o login não muda de visual.

Aproveitando a mudança, os dois travessões dos textos do login viram ponto final. A frase do painel fica "Pipeline, meta diária e agendamentos num só lugar. Sua equipe focada no que importa: fechar." e o aviso de academia não achada fica "Academia “x” não encontrada. Confira o link."

### Passo 1: pedir o código

- Título "Esqueci a senha". Texto: "Digite o e-mail que você usa para entrar. Vamos mandar um código para você criar uma senha nova."
- Campo de e-mail e botão "Enviar código".
- Link "Voltar para o login".

A tela confere antes de mandar: sem `@`, mostra "Digite o e-mail que você usa para entrar." embaixo do campo.

| Resposta do servidor | O que a tela mostra |
|---|---|
| 200 | Vai para o passo 2 |
| 400 | "Confira o e-mail digitado.", embaixo do campo |
| 429 | "Muitas tentativas. Espere alguns minutos e tente de novo." |
| 503 | O aviso de função desligada |
| Erro de rede ou do servidor | "Não deu para enviar agora. Tente de novo." |

Os avisos que não são de campo aparecem acima do botão, numa região com `role="alert"`.

### Passo 2: código e senha nova

- Título "Criar senha nova". Texto: "Digite o código que mandamos para fulano@academia.com. Ele vale por 15 minutos e aceita até 5 tentativas." Embaixo, menor: "Se esse e-mail tiver conta no Stronilead, o código chega em alguns minutos. Confira também o spam."
- Campo do código: 6 números, `inputMode="numeric"` e `autoComplete="one-time-code"`. Aceita colar com espaço ou hífen no meio ("123 456", "123-456") e fica só com os números.
- Senha nova e repetir senha nova, com o botão de mostrar e a regra à vista. A regra é o `PASSWORD_RULE_TEXT` de `src/lib/passwordPolicy.js`: "Use 8 caracteres ou mais, com letra maiúscula, letra minúscula, número e símbolo (como ! @ # $)."
- Botão "Salvar senha nova".
- "Mandar outro código", que libera 1 minuto depois do último envio e mostra a contagem até lá ("Mandar outro código em 42s"). Enviar de novo mata o código anterior, e a tela avisa: "Mandamos outro código. Só o último vale." A espera de 1 minuto é só da tela. Quem segura abuso no servidor é o limite de 5 códigos por dia e o limite por IP.
- "Usar outro e-mail", que volta ao passo 1.

A tela confere antes de mandar: código com 6 números ("Digite os 6 números do código."), senha dentro da regra (a frase do `passwordPolicyError`) e as duas senhas iguais ("As duas senhas não são iguais."). Cada aviso fica embaixo do seu campo, ligado a ele por `aria-describedby`, e nenhum aviso vira toast.

### Respostas do passo 2

| Situação | O que a tela mostra |
|---|---|
| Deu certo | Volta para o login com o e-mail preenchido e o aviso de sucesso |
| Código errado, vencido, já usado, morto por tentativas, ou e-mail sem conta | "Código errado ou vencido. Confira o último e-mail ou peça outro código.", embaixo do campo do código |
| Senha fora da regra (400 com `field: 'newPassword'`) | A frase do servidor, embaixo do campo da senha |
| 429 | "Muitas tentativas. Espere alguns minutos e tente de novo." |
| Erro de rede ou do servidor | "Não deu para salvar agora. Tente de novo." |

A senha digitada continua nos campos depois de um erro.

### F5 e memória da aba

A tela guarda em `sessionStorage` (`stronilead:recuperar-senha`) o e-mail e a hora do último envio. F5 no passo 2 continua no passo 2 enquanto os 15 minutos não passaram. Quando dá certo, ou quando a pessoa clica em "Usar outro e-mail", a memória é apagada. A senha e o código nunca vão para o `sessionStorage`. Leitura e escrita ficam dentro de `try/catch`: sem `sessionStorage`, a tela funciona e só perde a memória.

### Aviso de sucesso no login

Quando dá certo, a tela navega com replace para o login da academia, com `{ email, passwordReset: true }` no estado. O login lê esse estado uma vez, no valor inicial do `useState`, preenche o e-mail e mostra "Senha nova salva. Entre com ela." na faixa verde que hoje é do aviso de link enviado, com `role="status"`. Depois limpa o estado da navegação com `navigate(..., { replace: true, state: null })`, para o aviso não voltar num F5.

### Função desligada

Se o servidor responder 503, o passo 1 mostra: "A redefinição de senha por e-mail ainda não está ligada. Peça uma senha nova ao administrador da sua academia ou ao suporte do Stronilead."

### O e-mail

- Remetente `Stronilead <nao-responda@stronilead.com.br>`.
- Assunto: "Seu código para criar uma senha nova no Stronilead". O código fica fora do assunto para não aparecer na tela bloqueada do celular.
- HTML no molde do e-mail do Stronizap, com as cores do Stronilead, como na prévia aprovada em 28/09/2026:
  - fundo `#F5F7FB` e cartão branco de cantos arredondados;
  - a marca no topo escrita em texto ("STRONI" e "LEAD" em `#2B59FF`), porque cliente de e-mail costuma bloquear imagem;
  - "Olá, {primeiro nome}." e "Use este código para criar uma senha nova no Stronilead:";
  - o código grande e espaçado, num quadro azul-claro (`#EAF0FF`, texto `#1C3FC4`);
  - "Ele vale por 15 minutos. Se não foi você que pediu, ignore este e-mail. Sua senha atual continua valendo.";
  - fora do cartão, "Stronilead · Gestão de leads para academias".
- O HTML é montado em tabela e com o estilo no próprio elemento, que é o que os clientes de e-mail respeitam. Por isso as cores aparecem em hex.
- Uma versão só texto leva o mesmo conteúdo.
- O primeiro nome vem do cadastro da pessoa na equipe (`stronix_users`), com o nome da conta do Firebase de reserva. Sem nome, fica "Olá.". O nome passa por escape de HTML.

## Regras de segurança

### Quem recebe código

Só quem passaria no login e abriria uma sessão na academia. O e-mail é normalizado como no login (`trim` e minúsculas). Nos outros casos nada é enviado, a resposta é a mesma e o motivo vai para o log do servidor:

| Situação | Envia? | Motivo no log |
|---|---|---|
| E-mail sem conta no Firebase Auth | Não | `unknown_email` |
| Super-admin (claim `superAdmin`) | Não | `superadmin` |
| Conta desativada no Firebase | Não | `account_disabled` |
| Conta sem o claim `tenantId` | Não | `no_tenant` |
| Conta sem cadastro na equipe da academia (`stronix_users` pelo `authUid` ou, como no login, pelo e-mail) | Não | `not_member` |
| Academia suspensa ou arquivada | Não | `organization_inactive` |
| Academia com teste vencido ou mensalidade atrasada | Sim, porque o gestor precisa entrar para ativar o plano ou ver a cobrança | |
| Academia sem documento em `tenants/` (legado) | Sim, como no login | |
| 5 códigos nas últimas 24 horas | Não | `daily_limit` |

"Suspensa ou arquivada" é o mesmo par de checagens do `invite-accept` e da página de indicação: `status === 'suspended'` ou `archived === true`.

### O código

- Sorteado com `crypto.randomInt(0, 1_000_000)` e completado com zeros à esquerda até 6 números.
- Vale 15 minutos a partir do pedido.
- Aceita até 5 tentativas. A quinta errada mata o código.
- Pedir outro mata o anterior: cada conta tem um documento só, e o pedido novo escreve por cima.
- O banco guarda o HMAC-SHA256 do código, nunca o código. A chave é `HMAC-SHA256(FIREBASE_ADMIN_PRIVATE_KEY, "stronilead:password-reset-code")`, e a impressão é `HMAC-SHA256(chave, "<uid>:<código>")` em hexadecimal. A chave privada do Admin já é obrigatória na Vercel, então nenhuma variável nova entra para isso, e trocar a chave privada só mata os códigos pendentes. Uma impressão comum (`sha256`) de 6 números seria desfeita em segundos por quem lesse o banco, porque são só 1 milhão de combinações. O uid na mensagem faz o mesmo código de duas contas dar impressões diferentes. A comparação usa `crypto.timingSafeEqual`.

### As marcas da conta

O pedido guarda duas marcas que o `getUser` do Firebase devolve: `metadata.lastSignInTime`, a hora do último login, e `tokensValidAfterTime`, a validade das sessões, que o Firebase adianta na troca de senha e na revogação. Se qualquer uma mudou até a conferência, o código morre. As marcas fazem o papel da `tokenVersion` do Stronizap e cobrem, sem mexer em outro lugar do código:

- a pessoa lembrou a senha e entrou pelo login;
- o gestor definiu outra senha em Equipe & acessos;
- a pessoa trocou a senha por outro caminho;
- a academia foi suspensa, porque o `tenant-status` revoga as sessões de todos;
- o super-admin usou o "Acessar como", que entra na conta do gestor.

No último caso, a pessoa só precisa pedir outro código.

### Limites

- **Por conta:** no máximo 5 códigos em 24 horas corridas, contados no documento da conta. Isso dá no máximo 25 tentativas por dia em 1 milhão de combinações, e cada código manda um e-mail para a pessoa dona da conta, que percebe. O limite também protege a cota do Resend.
- **Por IP, no pedido:** 5 a cada 15 minutos (`pw-reset-request:<ip>`).
- **Por IP, na troca:** 10 a cada 15 minutos (`pw-reset-confirm:<ip>`). O limitador do Stronilead conta todas, inclusive a que deu certo, e essa encerra o fluxo.
- Os dois usam o `checkRateLimit` de `api/_rateLimit.js`, com chaves próprias. A recuperação não gasta a cota por IP da marca do login (`tenant-resolve:<ip>`) nem a da indicação. O limitador falha aberto, como hoje. O limite por conta e o de tentativas não dependem dele, porque rodam em transação no documento da conta.

### Troca da senha

- A senha nova passa pelo `passwordPolicyError` antes de gastar tentativa.
- O Firebase recebe a senha pelo `adminAuth.updateUser(uid, { password })`. Se a política do console recusar, a resposta sai do `passwordRejection` (`api/_auth.js`), com `field: 'newPassword'`, e o código continua vivo.
- Depois da troca, o código vira usado, o `revokeRefreshTokens(uid)` revoga as sessões e a troca vai para a auditoria.
- A troca e a marcação do código não cabem numa transação só, porque a senha mora no Firebase Auth e o código no Firestore. A ordem é trocar a senha e depois marcar o código. Se a marcação falhar, o código morre do mesmo jeito, porque a troca de senha muda a marca `tokensValidAfterTime`.

### Registro

- **Log da Vercel:** a conta (uid), a academia e o IP, em cada pedido e em cada troca, e o motivo de cada recusa. E-mail sem conta vai mascarado (`an***@academia.com`), nunca inteiro. O código nunca vai para o log em produção.
- **Auditoria:** toda troca que deu certo entra em `superadmin_audit`, pelo `logAudit`, como `password.reset`, com a academia e o uid, porque o log da Vercel some em 1 hora. A atividade recente do super-admin mostra "Trocou a senha pelo código · <academia>", com um `case` novo em `auditActionLabel` (`src/lib/superadmin.js`).
- **Sentry:** não recebe corpo, cabeçalho nem query da requisição. O `api/_sentry.js` já corta tudo isso na origem, e o `npm run verificar:sentry` confere.

### Efeito colateral aceito

Quem souber o e-mail de alguém consegue gastar os 5 códigos do dia dessa pessoa. Ela fica sem conseguir pelo e-mail até o dia seguinte, e a saída é a de hoje: o gestor define a senha em Configurações → Equipe & acessos.

## Modelo de dados

Coleção nova `_password_reset`, com um documento por conta e o uid do Firebase como id:

```js
{
  tenantId: 'academia-x',      // academia da conta no pedido
  codeHash: '9f2c…',           // HMAC-SHA256 do código, em hex. Nunca o código
  expiresAtMs: 1790000000000,  // validade do código
  attempts: 0,                 // tentativas gastas
  usedAtMs: null,              // usado, morto por tentativas, por marca mudada ou por falha no envio
  signInMark: 'Sun, 28 Sep 2026 14:02:11 GMT', // metadata.lastSignInTime no pedido
  tokensMark: 'Sun, 28 Sep 2026 13:00:00 GMT', // tokensValidAfterTime no pedido
  requestsMs: [1790000000000], // pedidos das últimas 24 horas, para o limite diário
  updatedAt: Timestamp,        // hora do servidor
}
```

- Um documento por conta garante um código vivo só.
- O sublinhado no nome segue o `_ratelimit`: coleção só do servidor.
- As rules do Firestore negam qualquer caminho sem regra, e esta coleção não ganha regra. Nada muda nas rules nem nos índices, e o navegador nunca lê nem escreve aqui.
- Os documentos ficam. É um por conta que já pediu código, e ele serve de rastro do último pedido. A limpeza fica fora deste passo.

## Servidor

### As duas ações

No `api/tenant-resolve.js`, o POST passa a olhar a `action` antes de seguir para a página de indicação. As ações da indicação e o GET da marca continuam como estão, e uma ação desconhecida continua respondendo 405.

**`POST /api/tenant-resolve` com `{ action: 'password-reset-request', email }`**

1. Limite por IP. Estourado: `429 { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }`.
2. E-mail em texto, com `@` e até 254 caracteres. Senão: `400 { error: 'Confira o e-mail digitado.' }`.
3. Envio desligado: `503 { error: <aviso de função desligada> }`.
4. Senão, responde `200 { ok: true }` na hora e entrega o pedido ao `waitUntil` do `@vercel/functions`. A Vercel mantém a função viva até o pedido terminar, dentro do tempo máximo da função. Erro dali em diante vai para o log e para o Sentry e nunca chega à tela.

**`POST /api/tenant-resolve` com `{ action: 'password-reset-confirm', email, code, newPassword }`**

1. Limite por IP. Estourado: 429, com a mesma frase.
2. `newPassword` pelo `passwordPolicyError`. Fora da regra: `400 { error: <frase>, field: 'newPassword' }`.
3. Fluxo da troca, descrito abaixo.
4. Respostas:
   - `200 { ok: true }` quando troca;
   - `400 { error: 'Código errado ou vencido. Confira o último e-mail ou peça outro código.' }` para qualquer falha de conta ou de código, inclusive código que não tem 6 números;
   - `400 { error: PASSWORD_REJECTED_ERROR, field: 'newPassword' }` quando o Firebase recusa a senha;
   - `500 { error: 'Não deu para salvar agora. Tente de novo.' }` no resto.

### Regras puras (`api/_passwordReset.js`)

Sem banco e sem rede:

- `generateResetCode(randomInt?)`: 6 números com zeros à esquerda. O sorteio entra por parâmetro para o teste escolher o número.
- `hashResetCode(secret, uid, code)` e `resetCodeMatches(secret, uid, code, codeHash)`, esta com `timingSafeEqual`.
- `accountRefusal(account | null)`: o motivo da tabela de "Quem recebe código", ou `null`. Vale no pedido e na troca.
- `maskEmail(email)`: `an***@academia.com`.

O que a tela e o servidor dividem mora em `src/lib/passwordReset.js`, puro e sem dependências, no molde do `passwordPolicy.js`: validade, tentativas, limite diário, espera do reenvio, os nomes das ações, as frases, `normalizeEmail`, `normalizeResetCode` e `isResetCodeFormat`.

### Fluxo (`api/_passwordResetFlow.js`)

Recebe de fora as operações de banco e de conta, o envio, o relógio e o sorteio. As ações usam uma instância montada com o `adminAuth`, o `adminDb`, o `logAudit` e o envio de verdade. As operações de verdade são finas: cada uma é uma leitura, uma chamada ao Firebase Auth ou uma transação, sem regra de negócio.

`findAccount(email)` chama o `getUserByEmail` e lê o documento da academia e o cadastro na equipe. Devolve o uid, a academia, se a conta está desativada, se é super-admin, se é da equipe, se a academia está ativa, o nome e as duas marcas.

**Pedido:**

1. Busca a conta pelo e-mail normalizado. Se o `accountRefusal` recusar, grava o motivo no log e para.
2. Numa transação no documento da conta (`issueCode`), conta os pedidos das últimas 24 horas. Com 5 ou mais, para com `daily_limit` no log. Senão escreve o código novo por cima do anterior, com as marcas atuais, as tentativas zeradas e a hora deste pedido somada à lista. A transação faz pedidos simultâneos da mesma conta esperarem a vez, e nenhum passa do limite.
3. Manda o e-mail. Se o envio falhar, o erro fica no log e o código morre na hora (`killCode`, que só mata se o documento ainda tiver aquele código), porque a pessoa dona da conta não ficou sabendo do pedido. O pedido continua contando no limite diário.

**Troca:**

1. Código que não tem exatamente 6 números: recusa, sem gastar tentativa.
2. Busca a conta pelo e-mail normalizado. Se o `accountRefusal` recusar: recusa.
3. Numa transação (`reserveAttempt`): sem documento, sem código, com o código usado, vencido ou com 5 tentativas, recusa. Senão soma 1 nas tentativas e devolve o número desta tentativa. É essa reserva que garante no máximo 5 comparações por código, mesmo com pedidos simultâneos.
4. Confere as marcas guardadas contra as da conta. Se estiverem diferentes, mata o código e recusa.
5. Compara o código. Se estiver errado e o número da reserva for 5, mata o código. Recusa. O número vem da reserva, e não de uma leitura anterior, que com tentativas simultâneas já pode estar velha.
6. Certo: troca a senha no Firebase, mata o código, revoga as sessões e grava a auditoria e o log.

### Envio (`api/_mail.js`)

- `sendMail({ to, subject, html, text })` faz `POST https://api.resend.com/emails` com `Authorization: Bearer RESEND_API_KEY`, remetente `MAIL_FROM` (vazio ou ausente, vale o padrão) e tempo limite de 8 segundos por `AbortController`, para caber no tempo máximo da função.
- Resposta fora de 2xx vira erro com o status e o `message` do Resend. O id do e-mail aceito vai para o log, para achar o envio no painel do Resend quando alguém disser que o código não chegou.
- `mailStatus()` diz como o envio está:
  - `resend`: tem a chave.
  - `off`: sem a chave e com `VERCEL_ENV=production`. A ação do pedido responde 503.
  - `log`: sem a chave e fora de produção (Preview e `vercel dev`). O `sendMail` escreve o e-mail inteiro no log, código incluso, para dar para testar sem mandar e-mail.
- O `fetch` entra por injeção, para o teste não sair para a rede.

### Conteúdo do e-mail (`api/_passwordResetEmail.js`)

Função pura que recebe o nome e o código e devolve assunto, HTML e texto, com o desenho da seção "O e-mail".

### Erro depois da resposta

O `withSentry` só pega o erro que sobe antes da resposta. O `api/_sentry.js` ganha um `captureError(err, req)`, que inicia o SDK se preciso, captura com a etiqueta do endpoint e faz o `flush`. O pedido que roda no `waitUntil` usa essa função no `catch`.

### Configuração

- `RESEND_API_KEY`: cadastrada na Vercel em 28/09/2026, só em Production e como Sensitive. Fica fora do Preview de propósito, para o Preview rodar no modo `log`.
- `MAIL_FROM`: opcional. O padrão é `Stronilead <nao-responda@stronilead.com.br>`.
- As duas entram no `.env.example`, com o comentário.
- Dependência nova: `@vercel/functions`, pelo `waitUntil`. É o pacote oficial da Vercel. O `waitUntil` dele lê o contexto que a Vercel monta em cada chamada de função, e a documentação diz que ele vale no runtime Node, que é o das funções do Stronilead. O teste no Preview confere que o formato `(req, res)` recebe esse contexto. Importar o pacote não puxa o `ws` nem nada além do `@vercel/oidc`, conferido na versão 3.9.9.

## Tela

- `src/views/auth/AuthLayout.jsx`: o painel da esquerda, a marca do celular e o rodapé, saídos do `LoginScreen.jsx` sem mudar o visual.
- `src/views/auth/AuthField.jsx`: o campo do login, com o aviso embaixo ligado por `aria-describedby`.
- `src/views/auth/ForgotPasswordScreen.jsx`: os dois passos. Chama o `/api/tenant-resolve` com `fetch`.
- `src/lib/passwordReset.js`, sem React. Além do que o servidor também usa, traz `resendWaitSeconds(ultimoEnvio, agora)`, a memória da aba no `sessionStorage` e `readResetApiError(status, body)`, que tira da resposta o status, a frase e a frase do campo da senha.
- `src/App.jsx`: sem sessão e em `/recuperar-senha`, desenha a tela nova no lugar do login.
- `src/views/auth/LoginScreen.jsx`: os links novos, a leitura do estado da navegação e o aviso de sucesso. Saem o `sendPasswordResetEmail` e o `handleForgotPassword`.
- O código novo segue o `CLAUDE.md`: `cn()` nas classes condicionais, `flex gap-*` e `size-N`. Os campos repetem as classes do login para ficarem iguais.

## Testes

**Servidor (vitest, em node)**

- Regras puras: o código sempre tem 6 números, com zero à esquerda quando precisa. A impressão confere o código certo e recusa o errado, o mesmo código de outra conta e a impressão feita com outro segredo. O `accountRefusal` cobre cada linha da tabela de quem recebe. O `maskEmail` esconde o e-mail.
- Fluxo, com banco, conta, envio, relógio e sorteio falsos:
  - Pedir cria o código, mata o anterior e manda o e-mail com o código sorteado.
  - E-mail sem conta, super-admin, conta desativada, conta sem academia, conta fora da equipe, academia suspensa e limite diário não mandam nada.
  - Falha no envio não derruba o pedido e mata o código.
  - Código certo troca a senha, revoga as sessões, mata o código e grava a auditoria.
  - Código errado gasta tentativa, e a quinta errada mata o código: a sexta é recusada mesmo com o código certo.
  - Código vencido, usado, trocado por outro ou com marca mudada é recusado com a mesma resposta.
  - Código com letra ou com 5 números é recusado sem gastar tentativa.
  - Recusa do Firebase à senha devolve a frase da senha e deixa o código vivo.
- Envio: o `sendMail` monta o pedido certo para o Resend (endereço, cabeçalho e corpo). Resposta de erro e demora viram erro com mensagem clara. O `mailStatus` devolve `resend`, `off` e `log` nos três cenários.
- E-mail: sai com o código e o primeiro nome, o código fica fora do assunto, e um nome com `<` ou `&` não quebra o HTML.
- As ações do `tenant-resolve`, no molde do `tenantResolve.test.js`:
  - o pedido responde 200 igual, com conta ou sem, e deixa o trabalho para o `waitUntil`;
  - o pedido responde 503 com o envio desligado, 429 no limite e 400 para e-mail inválido;
  - a troca devolve 200, a frase única, a frase da senha com `field` e 429;
  - ação desconhecida continua 405, e o GET da marca não muda.

**Tela (vitest, em jsdom, no molde do `errorBoundaries.test.js`)**

- O `normalizeResetCode` com espaço, hífen, letra e mais de 6 números. O `resendWaitSeconds`. A memória da aba vence depois de 15 minutos e não quebra sem `sessionStorage`. O `readResetApiError` com e sem `field`.
- A tela nova, dentro de um `MemoryRouter`:
  - o passo 1 manda o e-mail e abre o passo 2;
  - com a memória da aba, a tela abre direto no passo 2;
  - código errado mostra a frase embaixo do campo;
  - o sucesso volta para o login da academia com o e-mail e o aviso;
  - o 503 mostra o aviso de função desligada.

**O que já existe:** a suíte inteira, as varreduras (`tenantSlug`, `overscrollGuard`, `protecaoDeErro`, `leadLinkSweep`), o `npm run verificar:sentry`, o build e o lint no patamar de hoje.

**Na mão, no Preview, sem a chave (modo `log`), com uma conta de academia de teste.** O Preview usa o Firebase de produção, então o teste não usa conta real de cliente.

- Pedir o código, pegar no `vercel logs`, trocar a senha e entrar com ela.
- Errar o código 5 vezes e ver a sexta recusar até o código certo.
- Pedir 6 códigos para a mesma conta e ver que o sexto não sai.
- Pedir o código, entrar pelo login com a senha antiga e ver o código recusado.
- Pedir o código, o gestor trocar a senha em Equipe & acessos e ver o código recusado.
- F5 no passo 2.
- Com uma sessão aberta em outra aba, trocar a senha e ver uma chamada ao `api/` dessa aba ser recusada.
- Conferir no log que o pedido termina depois da resposta, ou seja, que o `waitUntil` segurou a função.

## Documentação

- `CLAUDE.md` do Stronilead: seção "Esqueci a senha", com as regras que não se afrouxam:
  - a resposta do pedido é sempre igual e sai antes do trabalho;
  - o super-admin não recebe código;
  - o banco guarda só o HMAC;
  - a tentativa é reservada antes de comparar;
  - a troca tem uma frase só para qualquer falha;
  - as duas ações moram no `tenant-resolve`, e a conta continua em 11 funções.
- `.env.example`: `RESEND_API_KEY` e `MAIL_FROM`.
- `CLAUDE.md` da raiz da STRONIX-FIRMA: a linha em "Últimas Atualizações" quando for para produção.

## Antes do deploy

1. **Domínio no Resend.** Os registros foram publicados em 28/09/2026 no DNS da Vercel, que é quem responde pelo `stronilead.com.br`: DKIM em `resend._domainkey`, MX e SPF em `send` (região `sa-east-1`) e DMARC em `_dmarc`. Falta ver o domínio como verificado no painel do Resend.
2. **Chave.** A `RESEND_API_KEY` foi cadastrada na Vercel em 28/09/2026, só em Production e como Sensitive. A chave deve ter só permissão de envio, e só para o `stronilead.com.br`.
3. **Teste no Preview**, pela lista de "Na mão".
4. **Merge.** A Vercel publica. Nada a publicar no console do Firebase, nas rules ou nos índices.
5. **Conferir de verdade:** pedir um código para uma conta de gestor, não o super-admin, e ver o e-mail chegar na caixa de entrada, não no spam.

Sem a chave em produção, o deploy funciona igual: a tela mostra o aviso de função desligada e nada mais muda.

## Critérios de aceitação

- [ ] "Esqueci a senha" e "Recuperar acesso" abrem a tela nova com o e-mail do login preenchido e a etiqueta da academia
- [ ] O passo 1 responde igual e no mesmo tempo para e-mail com conta, sem conta, de super-admin, de conta desativada, de conta fora da equipe e de academia suspensa
- [ ] O código chega de `nao-responda@stronilead.com.br`, vale 15 minutos e só o último vale
- [ ] A quinta tentativa errada mata o código
- [ ] O sexto pedido do mesmo dia não manda e-mail
- [ ] Entrar pelo login com a senha antiga depois de pedir o código mata o código
- [ ] O gestor trocar a senha em Equipe & acessos depois do pedido mata o código
- [ ] Trocar a senha revoga as sessões: as chamadas ao `api/` param na hora, e as telas abertas voltam ao login em até 1 hora
- [ ] O banco não guarda o código, só o HMAC
- [ ] Sem `RESEND_API_KEY` em produção, a tela mostra o aviso de função desligada e o resto do app segue igual
- [ ] A Vercel continua com 11 funções
- [ ] O super-admin não recebe código e recupera o acesso pelo `create-super-admin.js`

## Riscos

**E-mail no spam.** O domínio tem SPF, DKIM e DMARC publicados, e a tela manda conferir o spam. O passo 5 de "Antes do deploy" confere com e-mail de verdade.

**E-mail de login que não é caixa de verdade.** Se a academia cadastrou consultor com e-mail inventado, o código não chega. A saída é a de hoje: o gestor define a senha.

**Cota do Resend.** O plano grátis manda 100 e-mails por dia e 3.000 por mês, na conta inteira, e aceita 3 domínios. Se o Stronizap e o Gestão 360 estão na mesma conta, os três sistemas dividem a cota, e o `stronilead.com.br` é o terceiro domínio. O limite de 5 por conta segura abuso de uma conta só. Passar da cota com uso normal exigiria o plano pago.

**Resend fora do ar.** O código morre, a falha vai para o log e a pessoa pede de novo mais tarde ou pede ao gestor.

**O `waitUntil` depende do contexto que a Vercel monta.** Se ele não chegar à função, o pedido pode ser cortado antes de mandar o e-mail. O teste no Preview confere isso antes do merge.

**O passo 2 responde com a mesma frase, mas não no mesmo tempo.** Conta que existe passa por mais leituras antes da recusa. Quem tentasse descobrir contas assim teria de pedir um código antes, o que manda um e-mail de verdade para a pessoa dona da conta, e esbarraria nos limites por IP e por conta. O Stronizap tem a mesma característica.

**Marca que não muda.** Se alguma mudança de conta não mexer nas duas marcas, o código sobrevive a ela. Ainda assim, só vale para quem tem o código, que chegou na caixa da pessoa dona da conta. O teste na mão confere o caso da senha trocada pelo gestor.

**Preview com dados de produção.** No modo `log`, o código de uma conta real aparece em texto no log da Vercel. Só quem tem acesso ao projeto na Vercel lê esse log, e essa pessoa já tem a chave do Admin. O teste na mão usa só conta de academia de teste.

## Fora deste passo

- Link no e-mail em vez de código.
- E-mail avisando que a senha foi trocada.
- Recuperação do super-admin pela tela.
- Turnstile ou App Check na ação.
- Derrubar na hora as sessões abertas.
- Limpeza dos documentos antigos de `_password_reset`.
- Outros e-mails pelo Resend, como convite de equipe.
- Os modelos de e-mail do Firebase no console, que o app deixa de usar.
- Ajustes de celular além do que o login já faz. O celular está em segundo plano por decisão do Johnny.
