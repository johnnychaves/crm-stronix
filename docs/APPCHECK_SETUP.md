# App Check — configuração e rollout do bloqueio

O código sobe o App Check em **modo monitoramento**: ele carimba as requisições
e não bloqueia nada. Bloquear é decisão de console, tomada depois, com métrica.

## Por que isso existe

O login do Stronilead não passa pelo nosso servidor. O `LoginScreen` chama a API
de identidade do Google direto do navegador, e a `apiKey` do Firebase está no
bundle, o que é correto por design. A consequência é que um script pode tentar
senha contra a API do Google sem nunca carregar a nossa tela.

Por isso um CAPTCHA no formulário não resolveria: ele protege quem passa pelo
formulário, e o atacante não passa. O App Check age uma camada abaixo, exigindo
que toda requisição ao Firebase venha com um carimbo que só o app legítimo
consegue produzir.

## 1. Criar a chave do reCAPTCHA Enterprise

1. Google Cloud Console, projeto `crm-stronix`
2. Habilitar a API **reCAPTCHA Enterprise**
3. Criar uma chave **baseada em score, para sites**
4. Cadastrar os domínios: o de produção e o de preview da Vercel
5. Copiar o site key

**Se pedir para habilitar faturamento:** o reCAPTCHA Enterprise é produto pago do
Google Cloud e pode exigir plano Blaze. Duas saídas:

- Habilitar o Blaze. A cota gratuita é de 10.000 verificações por mês, e o token
  renova a cada 12h, ou seja, cerca de 2 verificações por usuário por dia. Com 50
  usuários ativos dá cerca de 3.000 por mês, folgado dentro do gratuito.
- Ou trocar para o reCAPTCHA v3 comum, que é grátis e não exige faturamento. A
  troca é de uma linha em `src/lib/appCheck.js`: importar `ReCaptchaV3Provider`
  no lugar de `ReCaptchaEnterpriseProvider` e usar a site key do v3. Nada mais no
  desenho muda.

## 2. Registrar no Firebase

1. Console do Firebase, App Check, aba Apps
2. Registrar o app web com o provider reCAPTCHA Enterprise e colar o site key
3. **Deixar o enforcement DESLIGADO** em todos os produtos

## 3. Configurar a Vercel

Cadastrar `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` em Production e Preview, e
redeployar.

## 4. Token de debug para o ambiente local

Na primeira execução do `npm run dev` depois disso, o console do navegador
imprime um token de debug. Registrar em App Check, Apps, Manage debug tokens, e
guardar em `.env.local` como `VITE_APPCHECK_DEBUG_TOKEN`.

Sem esse passo, no dia em que o bloqueio for ligado o ambiente local para de
conversar com o Firebase.

## 5. Rollout do bloqueio

```
deploy  →  monitorar 3 a 7 dias  →  bloquear Firestore  →  observar  →  bloquear Auth
```

Cada degrau só avança com o painel do App Check mostrando praticamente 100% de
requisições verificadas.

**Fatia teimosa de não verificadas significa usuário real falhando a atestação.**
Nesse caso parar e investigar, não bloquear. O enforcement sobre o Firebase Auth
ainda está marcado como *preview* pelo Google, então esse é o degrau que merece
mais paciência.

Vale conferir três caminhos antes de cada degrau: desktop, mobile, e a
**impersonação do superadmin**, que troca de identidade em tempo de execução e é
o mais provável de se comportar diferente.

**Reversão, em qualquer ponto:** desligar o enforcement no console. Sem deploy.
Se for preciso desligar o App Check inteiro, remover a variável de ambiente na
Vercel e redeployar.

## 6. Ganhos de console independentes deste PR

Grátis, um clique cada, no console do Firebase, em Authentication, Settings:

- **Proteção contra enumeração de e-mail.** Hoje dá para descobrir quais e-mails
  têm conta no sistema testando o formulário de recuperação de senha.
- **Política de senha mínima.**
