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
- **A tela nunca revela se um e-mail tem conta.** O passo 1 responde sempre igual e no mesmo tempo, porque a resposta sai antes do trabalho, pelo `waitUntil` da Vercel. O passo 2 tem uma frase só para qualquer falha e nunca responde em menos de 2,5 s, para o tempo também não entregar quem tem conta.
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

Como a rota sai como desconhecida e sem academia, a aba fica com o título "STRONILEAD" e o Sentry a registra com o molde `/*`. Aceito.

### Visual

Igual ao do login. O painel azul da esquerda, a marca do celular e o rodapé saem do `LoginScreen` para um `AuthLayout`, que recebe o formulário como `children`. O campo (rótulo, ícone e aviso embaixo) vira `AuthField`, e o input e o botão de mostrar senha viram `AuthInput` e `AuthPasswordToggle`, todos em `src/views/auth/`. O login e a tela nova usam os três, e o login não muda de visual. A paleta é a do login (`gray`, `neutral` e `brand`, com o `dark:` escrito à mão), e não a dos tokens semânticos, de propósito: assim as telas de entrada continuam iguais ao login de antes.

Leitor de tela e teclado:

- O nome do input sai só do texto do rótulo (`aria-labelledby`, no `AuthInput`). O botão de mostrar senha fica dentro do `<label>` e, sem isso, entraria no nome ("Senha Mostrar senha").
- O botão de mostrar senha diz a ação ("Mostrar senha" e "Ocultar senha") e não tem `title`, porque o Chrome expõe qualquer `title` como descrição e o leitor de tela repetiria o nome.
- O erro do campo fica numa região viva educada (`aria-live="polite"`) que existe desde o primeiro render, porque o leitor só anuncia o que aparece numa região que já estava na página. A tela leva o foco ao primeiro campo com erro, e a região espera a leitura do campo em vez de cortá-la.
- O erro que não é de campo usa `role="alert"`.
- A moldura põe o formulário num `<main>`, esconde do leitor de tela os cartões de exemplo (os números e os nomes ali são inventados) e não traz título: o único título da página é o h1 da tela.

Aproveitando a mudança, os dois travessões dos textos do login viram ponto final. A frase do painel fica "Pipeline, meta diária e agendamentos num só lugar. Sua equipe focada no que importa: fechar." e o aviso de academia não achada fica "Academia “x” não encontrada. Confira o link. Você ainda pode entrar normalmente."

As mensagens de erro do login também perdem o jargão. Antes, tudo o que não era senha errada mostrava "Erro ao autenticar. Verifique a configuração do Firebase Auth." Agora:

| Situação | Mensagem |
|---|---|
| Senha ou e-mail errado | "E-mail ou senha inválidos." |
| Excesso de tentativas | "Muitas tentativas. Espere alguns minutos e tente de novo." |
| Sem rede | "Sem conexão com a internet. Confira a rede e tente de novo." |
| Conta desativada | "Essa conta está desativada. Fale com o administrador da sua academia." |
| Qualquer outro erro | "Não deu para entrar agora. Tente de novo." |

O código do erro do Firebase fica só no console.

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

Os avisos que não são de campo são o `AuthAlert` (`role="alert"`) e o `AuthStatus` (`role="status"`), em `src/views/auth/AuthNotice.jsx`, os mesmos do login. Aparecem acima do botão. As duas regiões já estão na tela, vazias, desde o primeiro render, porque o leitor de tela só anuncia o que aparece numa região que já estava na página.

### Passo 2: código e senha nova

- Título "Criar senha nova". Texto: "Digite o código que mandamos para fulano@academia.com. Ele vale por 15 minutos e aceita até 5 tentativas." Embaixo, menor: "Se esse e-mail tiver conta no Stronilead, o código chega em alguns minutos. Confira também o spam."
- Campo do código: 6 números, `inputMode="numeric"` e `autoComplete="one-time-code"`. Aceita colar com espaço ou hífen no meio ("123 456", "123-456") e fica só com os números.
- Senha nova e repetir senha nova, com o botão de mostrar e a regra à vista. A regra é o `PASSWORD_RULE_TEXT` de `src/lib/passwordPolicy.js`: "Use 8 caracteres ou mais, com letra maiúscula, letra minúscula, número e símbolo (como ! @ # $)."
- Botão "Salvar senha nova".
- "Mandar outro código", que libera 1 minuto depois do último envio e mostra a contagem até lá ("Mandar outro código em 42s"). Enviar de novo mata o código anterior, e a tela avisa: "Mandamos outro código. Só o último vale." A espera de 1 minuto é só da tela. Quem segura abuso no servidor é o limite de 5 códigos por dia e o limite por IP. A contagem nunca passa de 60 s, mesmo com o relógio do aparelho mexido depois do envio. O relógio dela segue rodando depois de liberar o botão, e isso é aceito.
- "Usar outro e-mail", que volta ao passo 1.

O passo 2 leva um campo de e-mail oculto, com `autocomplete="username"` e o e-mail que recebeu o código, para o gerenciador de senhas salvar a senha nova na conta certa.

O passo 2 não tem link para o login. O Voltar do navegador e o "Usar outro e-mail" levam até lá. Aceito.

A tela confere antes de mandar: código com 6 números ("Digite os 6 números do código."), senha dentro da regra (a frase do `passwordPolicyError`; com a senha vazia, só "Digite a senha nova.", porque a regra já aparece na dica logo abaixo do campo e o erro só a repetiria) e as duas senhas iguais ("As duas senhas não são iguais."). Cada aviso fica embaixo do seu campo, ligado a ele por `aria-describedby`, e nenhum aviso vira toast.

### Respostas do passo 2

| Situação | O que a tela mostra |
|---|---|
| Deu certo | Volta para o login com o e-mail preenchido e o aviso de sucesso |
| Código errado, vencido, já usado, morto por tentativas, ou e-mail sem conta | "Código errado ou vencido. Confira o último e-mail ou peça outro código.", embaixo do campo do código |
| Senha fora da regra (400 com `field: 'newPassword'`) | A frase do servidor, embaixo do campo da senha |
| 429 | "Muitas tentativas. Espere alguns minutos e tente de novo." |
| Erro de rede ou do servidor | "Não deu para salvar agora. Tente de novo." |

A senha digitada continua nos campos depois de um erro.

### Foco, trava de envio e erro do campo

Decisões da revisão da tela, que valem para os dois passos:

- **Foco.** O foco vai para o primeiro campo com erro, no envio e na resposta do servidor, na ordem da tela: código, senha nova, repetir senha. Ele sai direto do manipulador, sem effect, porque o input já está na tela: o passo não muda quando há erro. Depois do "Mandar outro código" vai para o campo do código, que acabou de ser limpo. Ao trocar de passo, o `autoFocus` leva o cursor ao primeiro campo do passo, inclusive no "Usar outro e-mail". Cada passo é um formulário com `key` própria, senão o React reaproveitaria o input do e-mail no lugar do código e o `autoFocus` não rodaria.
- **`aria-disabled`, e não `disabled`.** Enquanto esperam a resposta, os botões de envio usam `aria-disabled`, porque no Chrome o botão focado que vira `disabled` solta o foco para o corpo da página e o foco não volta. O clique que chega nesse meio tempo é barrado pela guarda por ref, logo abaixo. O "Mandar outro código" só usa `disabled` durante a contagem, quando está de fato indisponível.
- **Uma guarda por ref impede pedido duplo.** O estado `busy` só muda no render seguinte, então dois Enter ou dois cliques seguidos ainda leriam `busy` falso. No passo 1 cada pedido gasta um dos 5 códigos do dia e mata o anterior, e na troca cada pedido gasta uma tentativa. O `busy` fica só para o visual. Depois de uma troca que deu certo, a guarda fica ligada até a tela sumir: o botão não pisca de volta e nenhum segundo envio manda outra troca.
- **O envio nunca segue o caminho nativo do formulário.** O `preventDefault` vem antes da guarda, porque com `aria-disabled` o Enter dado na espera chega ao manipulador, e sem ele o navegador faria um GET da página com a senha nova na URL. O formulário leva `noValidate`, e quem confere os campos é a tela.
- **Sucesso é só a resposta 200 com `ok: true`,** nos dois passos. Um 200 sem isso cai no aviso de erro do passo.
- **O erro de um campo some quando a pessoa muda esse campo.** Mudar a senha nova apaga também o erro de repetir senha, porque a igualdade das duas depende dela. O aviso que não é de campo não some ao digitar.

### F5 e memória da aba

A tela guarda em `sessionStorage` (`stronilead:recuperar-senha`) o e-mail e a hora do último envio, no formato `{ email, sentAt }`. F5 no passo 2 continua no passo 2 enquanto os 15 minutos não passaram. Quando dá certo, ou quando a pessoa clica em "Usar outro e-mail", a memória é apagada. A memória vencida também é apagada, na leitura: numa recepção com computador dividido, o e-mail de quem pediu o código não pode ficar para a próxima pessoa. A senha e o código nunca vão para o `sessionStorage`. Leitura e escrita ficam dentro de `try/catch`: sem `sessionStorage`, a tela funciona e só perde a memória.

A memória vence o e-mail que vem do login: quem abrir o "Esqueci a senha" na mesma aba em até 15 minutos cai no passo 2 do pedido anterior, e o "Usar outro e-mail" resolve. Aceito.

### Aviso de sucesso no login

Quando dá certo, a tela navega com replace para o login da academia, com `{ email, passwordReset: true }` no estado. O login lê esse estado uma vez, no valor inicial do `useState`, preenche o e-mail e mostra "Senha nova salva. Entre com ela." na faixa verde (o `AuthStatus`, com `role="status"`, que antes era a do aviso de link enviado). Como o e-mail já vem preenchido, o cursor vai para o campo da senha, e o campo aponta para o aviso (`aria-describedby`), então o leitor de tela lê o aviso junto com o campo. Depois o login limpa o estado da navegação com `navigate(location, { replace: true, state: null })`, uma vez só, para o aviso não voltar num F5. A trava é um ref: o efeito depende do `location`, o `navigate` o troca, e sem a trava o efeito rodaria de novo, sem parar.

Os erros do login (o do "Entrar" e o `authSetupError`) usam o `AuthAlert`, e o aviso usa o `AuthStatus`, então o leitor de tela anuncia os três.

A volta é o único `navigate` com replace e state próprio fora da ficha. A varredura `filtrosNoEndereco.sweep.test.js` tem uma exceção escrita para ela, presa ao arquivo da tela, e um teste congela o texto da chamada: mexer nela acende a varredura, e a mesma linha em outro arquivo continua reprovada. O state não leva `from`, e o login o zera ao ler.

Se a pessoa aperta o Voltar do navegador durante a troca, o login já está montado e ignora o state que chega depois. Um F5 mostra o aviso e o limpa. Aceito.

### Função desligada

Se o servidor responder 503, o passo 1 mostra: "A redefinição de senha por e-mail ainda não está ligada. Peça uma senha nova ao administrador da sua academia ou ao suporte do Stronilead."

### O e-mail

- Remetente `Stronilead <nao-responda@stronilead.com.br>`.
- Assunto: "Seu código para criar uma senha nova no Stronilead". O código fica fora do assunto para não aparecer na tela bloqueada do celular.
- HTML no molde do e-mail do Stronizap, com as cores do Stronilead, como na prévia aprovada em 28/09/2026:
  - fundo `#F5F7FB` e cartão branco de cantos arredondados;
  - a marca no topo escrita em texto ("STRONI" na cor do texto e só "LEAD" em `#2B59FF`), porque cliente de e-mail costuma bloquear imagem;
  - "Olá, {primeiro nome}." e "Use este código para criar uma senha nova no Stronilead:";
  - o código grande e espaçado, num quadro azul-claro (`#EAF0FF`, texto `#1C3FC4`);
  - "Ele vale por 15 minutos. Se não foi você que pediu, ignore este e-mail. Sua senha atual continua valendo.";
  - fora do cartão, "Stronilead · Gestão de leads para academias", em `#687083`, com contraste de 4,6:1 sobre o fundo, acima do mínimo de 4,5:1 para texto pequeno.
- O HTML é montado em tabela e com o estilo no próprio elemento, que é o que os clientes de e-mail respeitam. Por isso as cores aparecem em hex.
- O `<head>` leva o `charset`, o `viewport` e o `<title>`, que repete o assunto. O `charset` vale para o HTML aberto fora do cliente de e-mail, onde não há cabeçalho MIME dizendo que é UTF-8.
- A prévia da caixa de entrada sai do começo do corpo, e o código não pode aparecer nela. Por isso o corpo abre com um trecho escondido ("Abra o e-mail para ver o código. Se não foi você que pediu, pode ignorar este e-mail.", mais um enchimento de espaços invisíveis) que ocupa esse lugar. A frase é longa de propósito: mesmo em cliente que descarta o enchimento, o código cai depois do caractere 140 do texto do corpo. O bloco leva `mso-hide:all`, para o Outlook não o mostrar no e-mail aberto.
- A montagem só aceita código de 6 números: qualquer outra coisa lança erro.
- Uma versão só texto leva o mesmo conteúdo, menos o trecho escondido.
- O primeiro nome vem do cadastro da pessoa na equipe (`stronix_users`), com o nome da conta do Firebase de reserva. Sem nome, fica "Olá.". O nome passa por escape de HTML.

## Regras de segurança

### Quem recebe código

Só quem passaria no login e abriria uma sessão na academia. O e-mail é normalizado como no login (`trim` e minúsculas). Nos outros casos nada é enviado, a resposta é a mesma e o motivo vai para o log do servidor:

| Situação | Envia? | Motivo no log |
|---|---|---|
| E-mail sem conta no Firebase Auth | Não | `unknown_email` |
| Conta sem e-mail no Firebase | Não | `no_email` |
| Super-admin (claim `superAdmin`) | Não | `superadmin` |
| Conta desativada no Firebase | Não | `account_disabled` |
| Conta sem o claim `tenantId` | Não | `no_tenant` |
| Conta sem cadastro na equipe da academia (`stronix_users` pelo `authUid` ou, como no login, pelo e-mail da conta, só com id igual ao uid) | Não | `not_member` |
| Academia suspensa ou arquivada | Não | `organization_inactive` |
| Academia com teste vencido ou mensalidade atrasada | Sim, porque o gestor precisa entrar para ativar o plano ou ver a cobrança | |
| Academia sem documento em `tenants/` (legado) | Sim, como no login | |
| 5 códigos nas últimas 24 horas | Não | `daily_limit` |

"Suspensa ou arquivada" é o mesmo par de checagens do `invite-accept` e da página de indicação: `status === 'suspended'` ou `archived === true`. Quem decide é o `isTenantActive`, em `api/_passwordReset.js`: academia sem documento (legado) conta como ativa.

**Para onde vai o código.** Para o e-mail que a conta tem no Firebase, nunca para o que foi digitado. Conta sem e-mail no Firebase não recebe (`no_email`).

**Cadastro legado.** O login acha o cadastro na equipe pelo `authUid` e, na falta dele, pelo e-mail da conta, e no legado grava o próprio uid no cadastro que achou. As rules só aceitam essa gravação quando o id do cadastro é o uid (`selfLinksOwnUid`, em `firestore.rules`), e cadastro de outro id derruba o login. Por isso, aqui, o cadastro achado pelo e-mail da conta só vale com id igual ao uid: quem o login não deixaria entrar não recebe código. O login usa o primeiro cadastro que o e-mail acha, e a busca daqui traz o mesmo, porque sai ordenada pelo id com `limit(1)`. Mudou o login ou essas rules, muda o `findMember` de `api/_passwordResetRepo.js` também.

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
- Os dois usam o `checkRateLimit` de `api/_rateLimit.js`, com chaves próprias. As chaves por IP contam o IPv6 pelo bloco /64 (`rateKeyIp`, em `api/_passwordResetRoute.js`), porque quem recebe uma rede IPv6 tem bilhões de endereços e trocaria de IP a cada tentativa para fugir do limite. O IPv4 fica como veio, e o IPv4 mapeado no IPv6 (`::ffff:1.2.3.4`) vale o IPv4 dele, para o mesmo cliente não ganhar duas cotas. O IP inteiro continua indo para o log. A recuperação não gasta a cota por IP da marca do login (`tenant-resolve:<ip>`) nem a da indicação. O limitador falha aberto, como hoje. O limite por conta e o de tentativas não dependem dele, porque rodam em transação no documento da conta.

### Troca da senha

- A senha nova passa pelo `passwordPolicyError` antes de gastar tentativa.
- O Firebase recebe a senha pelo `adminAuth.updateUser(uid, { password })`. Se a política do console recusar, o fluxo reconhece a recusa com o `passwordRejectedByFirebase` (`src/lib/passwordPolicy.js`, o mesmo que o `passwordRejection` de `api/_auth.js` usa), a rota responde `PASSWORD_REJECTED_ERROR` com `field: 'newPassword'`, e o código não morre. A tentativa já foi gasta, então o código ainda pode se esgotar por esse caminho (ver Riscos). O erro vai para o log, com o aviso de que o `src/lib/passwordPolicy.js` precisa ser alinhado com a política do console.
- Depois da troca, o código vira usado, o `revokeRefreshTokens(uid)` revoga as sessões e a troca vai para a auditoria. A senha já mudou, então falha em qualquer um desses três passos só vai para o log e não muda a resposta, inclusive erro síncrono. O `killCode` que roda antes da troca (marca mudada e quinta tentativa errada) também é protegido: falha ao matar o código nunca muda a recusa.
- A troca e a marcação do código não cabem numa transação só, porque a senha mora no Firebase Auth e o código no Firestore. A ordem é trocar a senha e depois marcar o código. Se a marcação falhar, o código morre do mesmo jeito, porque a troca de senha muda a marca `tokensValidAfterTime`.

### Registro

- **Log da Vercel:** a conta (uid), a academia e o IP, em cada pedido e em cada troca, e o motivo de cada recusa, inclusive o `bad_format` (código que não tem 6 números). As recusas levam a conta ou, sem conta, o e-mail mascarado (`an***@academia.com`), nunca inteiro, e nesse caso a academia fica de fora. O `maskEmail` também nunca deixa a parte antes do `@` inteira: com duas letras aparece `j***@`, e com uma, `***@`. Cada troca registra `troca respondida` com o `status` e os `ms` que o trabalho levou, medidos antes do piso, sem e-mail e sem código. O código nunca vai para o log em produção.
- **Auditoria:** toda troca que deu certo entra em `superadmin_audit`, pelo `logAudit`, como `password.reset`, com a academia e o uid, porque o log da Vercel some em 1 hora. A atividade recente do super-admin mostra "Trocou a senha pelo código · <academia>", com um `case` novo em `auditActionLabel` (`src/lib/superadmin.js`).
- **Sentry:** não recebe corpo, cabeçalho nem query da requisição. O `api/_sentry.js` já corta tudo isso na origem, e o `npm run verificar:sentry` confere. A chave do Resend é mascarada pelo `src/lib/sentryScrub.js` como segunda camada, e o `verificar:sentry` a planta nos erros que simula. A falha de envio vai ao Sentry: o fluxo relança o erro e a rota o captura, porque chave revogada ou domínio sem verificação quebram todo pedido e o log da Vercel some em 1 hora. Nas funções da `api/`, a migalha de console não vai ao Sentry (`scrubApiBreadcrumb`), porque o log leva uid, academia e IP e, no Preview, o e-mail com o código.

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

1. Limite por IP (`pw-reset-request:<ip>`, com o IPv6 pelo bloco /64). Estourado: `429 { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }`.
2. E-mail em texto, com `@` e até 254 caracteres. Senão: `400 { error: 'Confira o e-mail digitado.' }`.
3. Envio desligado: `503 { error: <aviso de função desligada> }`.
4. Senão, responde `200 { ok: true }` na hora e entrega o pedido ao `waitUntil` do `@vercel/functions`. A Vercel mantém a função viva até o pedido terminar, dentro do tempo máximo da função. Erro dali em diante vai para o log e para o Sentry e nunca chega à tela.

**`POST /api/tenant-resolve` com `{ action: 'password-reset-confirm', email, code, newPassword }`**

1. Limite por IP (`pw-reset-confirm:<ip>`, com o IPv6 pelo bloco /64). Estourado: 429, com a mesma frase.
2. `newPassword` pelo `passwordPolicyError`. Fora da regra: `400 { error: <frase>, field: 'newPassword' }`.
3. E-mail com `@` e até 254 caracteres, pelo mesmo `isEmailFormat` do pedido, e código em texto. Senão: `400` com a frase única do item 5, sem chegar ao fluxo.
4. Fluxo da troca, descrito abaixo.
5. Respostas:
   - `200 { ok: true }` quando troca;
   - `400 { error: 'Código errado ou vencido. Confira o último e-mail ou peça outro código.' }` para qualquer falha de conta ou de código, inclusive código que não tem 6 números;
   - `400 { error: PASSWORD_REJECTED_ERROR, field: 'newPassword' }` quando o Firebase recusa a senha;
   - `500 { error: 'Não deu para salvar agora. Tente de novo.' }` no resto.

**O piso de tempo.** Toda resposta da troca sai no mínimo 2500 ms depois do começo do pedido (`CONFIRM_MIN_MS`, em `api/_passwordResetRoute.js`), inclusive a 400, a 429 e a 500. Sem o piso, a troca com um código qualquer demora mais quando o e-mail tem conta (leitura da equipe e transação da tentativa), e esse tempo entregaria quem tem conta sem o dono receber aviso nenhum. O relógio começa antes de qualquer trabalho, e a resposta espera o mais demorado dos dois, o trabalho ou o piso: um não soma ao outro. O piso precisa ficar acima do trabalho mais lento, e por isso cada troca registra no log quanto o trabalho levou (`ms`): um valor perto do piso pede piso maior. O pedido de código não precisa dele, porque responde antes do trabalho.

O erro inesperado, de dentro ou de fora do fluxo (o limitador que lança, por exemplo), também espera o piso e vira 500. O 500 não espera o Sentry: o envio ao Sentry pode levar até 2 s (o `flush`) e roda no `waitUntil`, depois da resposta.

O tempo máximo da função é o que limita o `waitUntil` do pedido. Por isso o `vercel.json` fixa `maxDuration: 30` para o `api/tenant-resolve.js`, para o pedido inteiro caber, envio de até 8 segundos incluso.

### Regras puras (`api/_passwordReset.js`)

Sem banco e sem rede:

- `generateResetCode(randomInt?)`: 6 números com zeros à esquerda. O sorteio entra por parâmetro para o teste escolher o número.
- `hashResetCode(secret, uid, code)` e `resetCodeMatches(secret, uid, code, codeHash)`, esta com `timingSafeEqual`. Sem segredo, a impressão lança erro: com chave vazia ou "undefined", qualquer um a refaria.
- `accountRefusal(account | null)`: o motivo da tabela de "Quem recebe código", inclusive o `no_email`, ou `null`. Vale no pedido e na troca.
- `isTenantActive(tenant)`: a regra da academia ativa. Suspensa ou arquivada não é, e academia sem documento (legado) é.
- `maskEmail(email)`: `an***@academia.com`. A parte antes do `@` nunca sai inteira: com duas letras aparece `j***@`, e com uma, `***@`.

As contas que rodam dentro das transações também moram aqui, puras: `planIssue` (o limite de 5 por dia e o documento novo), `planReserve` (a reserva da tentativa) e `planKill` (mata só o código que ainda está lá). O `_passwordResetRepo.js` as chama dentro das transações. O `marksChanged` compara as marcas guardadas com as da conta, e quem o chama é o fluxo.

O que a tela e o servidor dividem mora em `src/lib/passwordReset.js`, puro e sem dependências, no molde do `passwordPolicy.js`: validade, tentativas, limite diário, espera do reenvio, os nomes das ações, as frases, `normalizeEmail`, `normalizeResetCode` e `isResetCodeFormat`.

### Fluxo (`api/_passwordResetFlow.js`)

Recebe de fora as operações de banco e de conta, o envio, o relógio, o sorteio, o segredo da impressão e o `log`. As ações usam uma instância montada com o `adminAuth`, o `adminDb`, o `logAudit` e o envio de verdade (`realResetDeps()`, em `api/_passwordResetRepo.js`). As operações de verdade são finas: cada uma é uma leitura, uma chamada ao Firebase Auth ou uma transação, e a regra de negócio fica nas funções puras.

O `secret` do `realResetDeps()` sai da `FIREBASE_ADMIN_PRIVATE_KEY` e não é enumerável, para não sair se alguém imprimir o `deps` (log, Sentry, JSON). Por isso o `deps` vai direto ao fluxo e nunca é copiado com spread: a cópia deixa o `secret` para trás, e o fluxo falha por falta de segredo em vez de seguir sem ele. Para trocar uma chave, atribua (`deps.log = ...`).

`findAccount(email)` chama o `getUserByEmail` e lê o documento da academia e o cadastro na equipe. Devolve o uid, o e-mail que o Firebase guarda, a academia, se a conta está desativada, se é super-admin, se é da equipe, se a academia está ativa, o nome e as duas marcas.

**Pedido:**

1. Busca a conta pelo e-mail normalizado. Se o `accountRefusal` recusar, grava o motivo no log e para.
2. Numa transação no documento da conta (`issueCode`), conta os pedidos das últimas 24 horas. Com 5 ou mais, para com `daily_limit` no log. Senão escreve o código novo por cima do anterior, com as marcas atuais, as tentativas zeradas e a hora deste pedido somada à lista. A transação faz pedidos simultâneos da mesma conta esperarem a vez, e nenhum passa do limite.
3. Manda o e-mail para o endereço que a conta tem no Firebase. Se o envio falhar, o erro fica no log e o código morre na hora (`killCode`, que só mata se o documento ainda tiver aquele código), porque a pessoa dona da conta não ficou sabendo do pedido. O erro sobe: o fluxo o relança e a rota o captura no Sentry (ver "Erro depois da resposta"). O pedido continua contando no limite diário.

**Troca:**

1. Código que não tem exatamente 6 números: recusa (`bad_format`), sem ler a conta e sem gastar tentativa.
2. Busca a conta pelo e-mail normalizado. Se o `accountRefusal` recusar: recusa.
3. Numa transação (`reserveAttempt`): sem documento, sem código, com o código usado, vencido ou com 5 tentativas, recusa. Senão soma 1 nas tentativas e devolve o número desta tentativa. É essa reserva que garante no máximo 5 comparações por código, mesmo com pedidos simultâneos.
4. Confere as marcas guardadas contra as da conta. Se estiverem diferentes, mata o código e recusa.
5. Compara o código. Se estiver errado e o número da reserva for 5, mata o código. Recusa. O número vem da reserva, e não de uma leitura anterior, que com tentativas simultâneas já pode estar velha.
6. Certo: troca a senha no Firebase, mata o código, revoga as sessões e grava a auditoria e o log. Falha depois da troca só vai para o log (ver "Troca da senha").

### Envio (`api/_mail.js`)

- `sendMail({ to, subject, html, text })` faz `POST https://api.resend.com/emails` com `Authorization: Bearer RESEND_API_KEY`, remetente `MAIL_FROM` (vazio ou ausente, vale o padrão) e tempo limite de 8 segundos por `AbortController`. Os 8 segundos cabem no tempo máximo da função, que o `vercel.json` fixa em 30 s para o `tenant-resolve`. O tempo limite vale até o fim da leitura da resposta: se o corpo trava depois do cabeçalho, o abort também corta a leitura.
- A chave é aparada, sem os espaços das pontas, do mesmo jeito que o `mailStatus` a enxerga. Chave com caractere que não cabe em cabeçalho HTTP (uma quebra de linha no meio, por exemplo) faria o `fetch` lançar uma mensagem que repete o cabeçalho, chave inclusa. Por isso o `sendMail` monta o `Headers` antes, e se falhar lança uma mensagem fixa ("RESEND_API_KEY com caractere inválido") e não chama a rede.
- Resposta fora de 2xx vira erro com o status e o `message` do Resend, e o status também vai em `err.status`. O id do e-mail aceito vai para o log, para achar o envio no painel do Resend quando alguém disser que o código não chegou.
- `mailStatus()` diz como o envio está:
  - `resend`: tem a chave, sem contar espaço nas pontas.
  - `log`: sem a chave e com `VERCEL_ENV` igual a `preview` ou `development` (Preview e `vercel dev`). O `sendMail` escreve o e-mail inteiro no log, código incluso, para dar para testar sem mandar e-mail.
  - `off`: sem a chave em qualquer outro caso, inclusive `production` e `VERCEL_ENV` ausente ou vazio. Falha fechado: só Preview e desenvolvimento escrevem o código no log. A ação do pedido responde 503.
- O modo `log` só é seguro porque os Previews do projeto estão atrás da Vercel Authentication (conferido em 28/09/2026: a página responde 302 para o login da Vercel e a API responde 401). Sem essa proteção, qualquer pessoa poderia pedir código para uma conta de produção, e o dono da conta não receberia e-mail nenhum. O Preview usa o Firebase de produção: o teste só usa conta de academia de teste.
- O `fetch` entra por injeção, para o teste não sair para a rede.

### Conteúdo do e-mail (`api/_passwordResetEmail.js`)

Função pura que recebe o nome e o código e devolve assunto, HTML e texto, com o desenho da seção "O e-mail".

### Erro depois da resposta

O `withSentry` só pega o erro que sobe antes da resposta. O `api/_sentry.js` ganha um `captureError(err, req)`, que inicia o SDK se preciso, captura com a etiqueta do endpoint (sem a query) e faz o `flush` de até 2 s, porque a função congela quando o trabalho termina e, sem o `flush`, o evento morre no buffer. Sem DSN, não faz nada. O `withSentry` também passa por ele. O pedido que roda no `waitUntil` usa essa função no `catch`, e a troca a usa para o erro inesperado, também dentro do `waitUntil`, para o 500 não esperar o envio.

O `captureError` nunca lança: falha do próprio Sentry vira um aviso no log da Vercel. Como a migalha de console não vai ao Sentry nas funções da `api/`, esse aviso não entra num laço.

### Configuração

- `RESEND_API_KEY`: cadastrada na Vercel em 28/09/2026, só em Production e como Sensitive. Fica fora do Preview de propósito, para o Preview rodar no modo `log`.
- `MAIL_FROM`: opcional. O padrão é `Stronilead <nao-responda@stronilead.com.br>`.
- As duas entram no `.env.example`, com o comentário.
- `vercel.json`: o `api/tenant-resolve.js` ganha `maxDuration: 30` (ver "As duas ações").
- Dependência nova: `@vercel/functions`, pelo `waitUntil`. É o pacote oficial da Vercel. O `waitUntil` dele lê o contexto que a Vercel monta em cada chamada de função, e a documentação diz que ele vale no runtime Node, que é o das funções do Stronilead. O teste no Preview confere que o formato `(req, res)` recebe esse contexto. Importar o pacote não puxa o `ws` nem nada além do `@vercel/oidc`, conferido na versão 3.9.9.

## Tela

- `src/views/auth/AuthLayout.jsx`: o painel da esquerda, a marca do celular e o rodapé, saídos do `LoginScreen.jsx` sem mudar o visual. Traz também o `AuthTenantChip`, a etiqueta com o nome da academia.
- `src/views/auth/AuthField.jsx`: o campo do login (`AuthField`), o input (`AuthInput`) e o botão de mostrar senha (`AuthPasswordToggle`), com o aviso embaixo ligado por `aria-describedby`. Os detalhes de leitor de tela estão em "Visual".
- `src/views/auth/AuthNotice.jsx`: o `AuthAlert` e o `AuthStatus`, os avisos que não são de campo, os mesmos do login.
- `src/views/auth/ForgotPasswordScreen.jsx`: os dois passos. Chama o `/api/tenant-resolve` com `fetch`.
- `src/lib/passwordReset.js`, sem React. Além do que o servidor também usa, traz `resendWaitSeconds(ultimoEnvio, agora)`, a memória da aba no `sessionStorage` e `readResetApiError(status, body)`, que tira da resposta o status, a frase e a frase do campo da senha. Traz também o estado que o login manda e a tela lê (`resetLinkState`, `readResetEntry` e `readLoginArrival`), o `loginPathFor` e o `postResetAction`, o `fetch` das duas ações, que nunca lança: rede fora devolve status nulo.
- `src/App.jsx`: sem sessão e em `/recuperar-senha`, desenha a tela nova no lugar do login.
- `src/views/auth/LoginScreen.jsx`: os links novos, a leitura do estado da navegação, o aviso de sucesso e as mensagens de erro sem jargão. Saem o `sendPasswordResetEmail` e o `handleForgotPassword`.
- O código novo segue o `CLAUDE.md`: `cn()` nas classes condicionais, `flex gap-*` e `size-N`. Os campos repetem as classes do login para ficarem iguais.

## Testes

**Servidor (vitest, em node)**

- Regras puras: o código sempre tem 6 números, com zero à esquerda quando precisa. A impressão confere o código certo e recusa o errado, o mesmo código de outra conta e a impressão feita com outro segredo. O `accountRefusal` cobre cada linha da tabela de quem recebe, inclusive o `no_email`. O `maskEmail` esconde o e-mail e nunca deixa a parte antes do `@` inteira.
- Fluxo, com banco, conta, envio, relógio e sorteio falsos:
  - Pedir cria o código, mata o anterior e manda o e-mail com o código sorteado.
  - O código vai para o e-mail que a conta tem no Firebase, e não para o digitado. Conta sem e-mail no Firebase não recebe.
  - E-mail sem conta, super-admin, conta desativada, conta sem academia, conta fora da equipe, academia suspensa e limite diário não mandam nada.
  - Falha no envio mata o código, continua contando no dia e sobe o erro para a rota mandar ao Sentry.
  - Código certo troca a senha, revoga as sessões, mata o código e grava a auditoria.
  - Código errado gasta tentativa, e a quinta errada mata o código: a sexta é recusada mesmo com o código certo.
  - Código vencido, usado, trocado por outro ou com marca mudada é recusado com a mesma resposta.
  - Código com letra ou com 5 números é recusado sem gastar tentativa.
  - Recusa do Firebase à senha devolve a frase da senha e deixa o código vivo.
  - Falha ao marcar o código, revogar as sessões ou gravar a auditoria depois da troca não desfaz a troca e só vai para o log. A falha do `killCode` antes da troca também não esconde a recusa.
  - Toda recusa vai para o log com o motivo, a conta (ou o e-mail mascarado), a academia e o IP, inclusive o `bad_format`. O código e a senha nunca vão para o log.
- Envio: o `sendMail` monta o pedido certo para o Resend (endereço, cabeçalho e corpo). Resposta de erro e demora viram erro com mensagem clara, e a recusa leva o `err.status`. O tempo limite vale até o fim da leitura do corpo, e nenhum timer sobra depois do envio. Chave só com espaços conta como sem chave, espaço nas pontas não vai para o cabeçalho, e chave com caractere inválido vira erro fixo, sem repetir a chave. O `mailStatus` devolve `resend`, `off` e `log`: só Preview e desenvolvimento vão para o log, e sem `VERCEL_ENV` o envio fica desligado.
- E-mail: sai com o código e o primeiro nome, o código fica fora do assunto, e um nome com `<` ou `&` não quebra o HTML. O `<head>` declara charset, viewport e título. A prévia da caixa de entrada vem antes do código e não leva dígito, e sem o enchimento o código ainda cai depois do caractere 140. O rodapé usa `#687083`. Código que não tem 6 números faz a montagem lançar erro.
- As ações do `tenant-resolve`, no molde do `tenantResolve.test.js`:
  - o pedido responde 200 igual, com conta ou sem, e deixa o trabalho para o `waitUntil`;
  - o pedido responde 503 com o envio desligado, 429 no limite e 400 para e-mail inválido;
  - a troca devolve 200, a frase única, a frase da senha com `field` e 429;
  - e-mail sem `@` ou com mais de 254 caracteres, e e-mail ou código que não é texto, recebem a frase única na troca, sem chegar ao fluxo;
  - toda resposta da troca espera o piso de 2500 ms, inclusive a 400, a 429 e a 500, e o piso não soma ao tempo do trabalho;
  - o 500 não espera o Sentry, e o erro inesperado vai ao Sentry pelo `waitUntil`;
  - o `rateKeyIp` conta o IPv6 pelo bloco /64 e o IPv4 mapeado como o IPv4;
  - o `vercel.json` dá ao `tenant-resolve` tempo para o pedido inteiro, envio de até 8 segundos incluso;
  - ação desconhecida continua 405, e o GET da marca não muda.
- Sentry: o `captureError` não faz nada sem DSN, espera o envio, nunca lança e deixa um aviso no log quando o SDK falha. O `withSentry` relança o erro do handler. O `sentryScrub` mascara a chave do Resend, e o `npm run verificar:sentry` a planta nos erros que simula.
- Fiação: o fluxo de verdade ligado ao `realResetDeps()`, sobre um banco falso, prova que os nomes que o fluxo lê em `deps` são os que o repositório entrega e que um pedido e uma troca passam de ponta a ponta. O `secret` não aparece em `JSON.stringify` nem em `util.inspect`, e copiar o `deps` com spread faz o fluxo falhar em vez de seguir sem ele.

**Tela (vitest, em jsdom, no molde do `errorBoundaries.test.js`)**

- O `normalizeResetCode` com espaço, hífen, letra e mais de 6 números. O `resendWaitSeconds`. A memória da aba vence depois de 15 minutos e não quebra sem `sessionStorage`. O `readResetApiError` com e sem `field`.
- A tela nova, dentro de um `MemoryRouter`:
  - o passo 1 manda o e-mail e abre o passo 2;
  - com a memória da aba, a tela abre direto no passo 2;
  - código errado mostra a frase embaixo do campo;
  - o sucesso volta para o login da academia com o e-mail e o aviso;
  - o 503 mostra o aviso de função desligada;
  - o foco vai para o primeiro campo com erro, o erro fica ligado ao campo e some quando a pessoa muda o campo;
  - enquanto espera a resposta, os botões ficam com `aria-disabled`, e dois envios no mesmo instante mandam um pedido só;
  - o relógio da contagem desce de 1 em 1 segundo, para quando a pessoa sai da tela e só anda no passo 2;
  - o passo 2 leva o campo de usuário oculto, e o envio nunca segue o caminho nativo do formulário.
- O `AuthLayout`, o `AuthField` (com o `AuthInput` e o `AuthPasswordToggle`) e o `AuthNotice`: o nome do input sai só do rótulo, a região de erro já existe no primeiro render, o botão de mostrar senha diz a ação e não tem `title`, e o que a pessoa usa não fica escondido do leitor de tela.
- O login: a volta do "Esqueci a senha" (e-mail preenchido, aviso e cursor na senha), o F5 depois da volta, a ida e a volta com as duas telas de verdade, os avisos e os erros do login, os links novos e a ausência do `sendPasswordResetEmail`. O `App` desenha a tela nova em `/recuperar-senha`.

**O que já existe:** a suíte inteira, as varreduras (`tenantSlug`, `overscrollGuard`, `protecaoDeErro`, `leadLinkSweep` e `filtrosNoEndereco`, esta com a exceção escrita para a volta do "Esqueci a senha"), o `npm run verificar:sentry`, o build e o lint no patamar de hoje.

**Na mão, no Preview, sem a chave (modo `log`), com uma conta de academia de teste.** O Preview usa o Firebase de produção, então o teste não usa conta real de cliente.

- Pedir o código, pegar no `vercel logs`, trocar a senha e entrar com ela.
- Errar o código 5 vezes e ver a sexta recusar até o código certo.
- Pedir 6 códigos para a mesma conta e ver que o sexto não sai.
- Pedir o código, entrar pelo login com a senha antiga e ver o código recusado.
- Pedir o código, o gestor trocar a senha em Equipe & acessos e ver o código recusado.
- F5 no passo 2.
- Com uma sessão aberta em outra aba, trocar a senha e ver uma chamada ao `api/` dessa aba ser recusada.
- Conferir no log que o pedido termina depois da resposta, ou seja, que o `waitUntil` segurou a função.
- Trocar com um código errado numa conta que existe, que é o caso mais lento, e conferir no log (`troca respondida`) que o `ms` fica bem abaixo de 2500. Um `ms` perto do piso pede piso maior.

## Documentação

- `CLAUDE.md` do Stronilead: seção "Esqueci a senha", com as regras que não se afrouxam:
  - a resposta do pedido é sempre igual e sai antes do trabalho;
  - a troca responde no mínimo em 2500 ms;
  - o super-admin não recebe código;
  - o código vai para o e-mail da conta no Firebase, nunca para o digitado;
  - o banco guarda só o HMAC;
  - a tentativa é reservada antes de comparar;
  - a troca tem uma frase só para qualquer falha;
  - as duas ações moram no `tenant-resolve`, e a conta continua em 11 funções.
- `CLAUDE.md` do Stronilead, nas outras seções:
  - a regra de senha, em "Convenções gerais", ganha o "Esqueci a senha" entre os caminhos que gravam senha;
  - o parágrafo do Sentry, na "Ponte com o Stronizap", passa a citar a chave do Resend, o `captureError` e a migalha de console que não vai ao Sentry;
  - a seção "Proteção de erro fora do conteúdo" lista o login e o "Esqueci a senha" entre as telas sem proteção própria.
- `.env.example`: `RESEND_API_KEY` e `MAIL_FROM`.
- `CLAUDE.md` da raiz da STRONIX-FIRMA: a linha em "Últimas Atualizações" quando for para produção.

## Antes do deploy

1. **Domínio no Resend.** Os registros foram publicados em 28/09/2026 no DNS da Vercel, que é quem responde pelo `stronilead.com.br`: DKIM em `resend._domainkey`, MX e SPF em `send` (região `sa-east-1`) e DMARC em `_dmarc`. Falta ver o domínio como verificado no painel do Resend.
2. **Chave.** A `RESEND_API_KEY` foi cadastrada na Vercel em 28/09/2026, só em Production e como Sensitive. A chave deve ter só permissão de envio, e só para o `stronilead.com.br`.
3. **Teste no Preview**, pela lista de "Na mão".
4. **Merge.** A Vercel publica. Nada a publicar no console do Firebase, nas rules ou nos índices.
5. **Conferir de verdade:** pedir um código para uma conta de gestor, não o super-admin, e ver o e-mail chegar na caixa de entrada, não no spam.
6. **Decisão do Johnny.** O risco do e-mail de conta nunca verificado, descrito em "Riscos", precisa de decisão antes do deploy.

Sem a chave em produção, o deploy funciona igual: a tela mostra o aviso de função desligada e nada mais muda.

## Critérios de aceitação

- [ ] "Esqueci a senha" e "Recuperar acesso" abrem a tela nova com o e-mail do login preenchido e a etiqueta da academia
- [ ] O passo 1 responde igual e no mesmo tempo para e-mail com conta, sem conta, de super-admin, de conta desativada, de conta fora da equipe e de academia suspensa
- [ ] A troca responde no mínimo em 2,5 s em todos os casos
- [ ] O código chega de `nao-responda@stronilead.com.br`, vale 15 minutos e só o último vale
- [ ] O código vai para o e-mail da conta, nunca para o digitado
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

**E-mail de conta nunca verificado.** O Firebase nunca confirmou o e-mail dessas contas. Se o gestor cadastrou um e-mail inventado, quem criar essa caixa de correio depois pode pedir o código e tomar a conta. A decisão fica com o Johnny antes do deploy.

**Cota do Resend.** O plano grátis manda 100 e-mails por dia e 3.000 por mês, na conta inteira, e aceita 3 domínios. Se o Stronizap e o Gestão 360 estão na mesma conta, os três sistemas dividem a cota, e o `stronilead.com.br` é o terceiro domínio. O limite de 5 por conta segura abuso de uma conta só. Passar da cota com uso normal exigiria o plano pago.

**Resend fora do ar.** O código morre, a falha vai para o log e a pessoa pede de novo mais tarde ou pede ao gestor.

**O `waitUntil` depende do contexto que a Vercel monta.** Se ele não chegar à função, o pedido pode ser cortado antes de mandar o e-mail. O teste no Preview confere isso antes do merge.

**Tempo da troca.** A frase da troca é a mesma para qualquer falha, mas conta que existe passa por mais leituras antes da recusa (a equipe e a transação da tentativa), e esse tempo entregaria quem tem conta sem o dono receber aviso nenhum. O piso de 2500 ms cobre isso: toda resposta da troca sai no mínimo nele, e o trabalho e o piso não se somam. O piso só protege enquanto ficar acima do trabalho mais lento, e por isso cada troca registra no log quanto o trabalho levou (`ms`). A medição no Preview, com uma conta que existe e um código errado, confere a folga antes do merge, e um `ms` perto do piso pede piso maior. Descobrir contas por esse caminho ainda exigiria pedir um código antes, o que manda um e-mail de verdade para a pessoa dona da conta, e esbarraria nos limites por IP e por conta.

**Marca que não muda.** Se alguma mudança de conta não mexer nas duas marcas, o código sobrevive a ela. Ainda assim, só vale para quem tem o código, que chegou na caixa da pessoa dona da conta. O teste na mão confere o caso da senha trocada pelo gestor.

**Uso duplo do código pelo próprio dono.** Dois pedidos de troca com o código certo, feitos ao mesmo tempo, passam os dois, porque o código só é marcado como usado depois da troca da senha. A senha do último vale. Quem faz isso é a pessoa que tem o código. Aceito.

**Senha recusada pelo Firebase na quinta tentativa.** A tentativa já foi gasta quando o Firebase recusa a senha, então na quinta o código se esgota, mesmo sendo o certo. A tela e a rota conferem a senha antes, pelo `passwordPolicyError`, então isso só acontece se a política do console divergir do `src/lib/passwordPolicy.js`, e o log avisa. Aceito.

**O limitador por IP falha aberto.** Se a checagem do limitador falhar, ninguém é barrado por IP. Com os e-mails de vários membros da equipe conhecidos, dá para gastar a cota diária do Resend, dividida com o Stronizap, sem esbarrar no limite por conta: cada conta aceita 5 códigos por dia, e cada código é um e-mail.

**Prévia pela parte só texto.** O trecho escondido que segura a prévia só existe no HTML. O cliente de e-mail que monta a prévia da caixa de entrada pela parte só texto ainda mostra o código.

**Preview com dados de produção.** No modo `log`, o código de uma conta real aparece em texto no log da Vercel. Só quem tem acesso ao projeto na Vercel lê esse log, e essa pessoa já tem a chave do Admin. O modo só existe com `VERCEL_ENV` igual a `preview` ou `development`, e os Previews do projeto estão atrás da Vercel Authentication (conferido em 28/09/2026). O teste na mão usa só conta de academia de teste.

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
- Blindar o envio de e-mail do Stronizap. Tarefa separada.
- Tirar a lentidão do padrão de e-mail do Sentry (`src/lib/sentryScrub.js`). Tarefa separada.
- Proteção de erro nas telas de entrada, o login e o "Esqueci a senha". Elas saem do `if (!appUser)` do `App.jsx`, antes de qualquer `ErrorBoundary`, e o `src/main.jsx` não tem proteção na raiz. Tarefa separada.
