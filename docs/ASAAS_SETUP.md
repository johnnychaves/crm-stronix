# Cobrança recorrente via Asaas — guia de configuração

A integração já está no código, **desligada até as chaves entrarem**. Sem
`ASAAS_API_KEY`, os endpoints respondem "não configurado" e o painel mostra um
aviso — nada quebra, e a cobrança manual continua valendo. Siga os passos abaixo
para ligar (faça **no sandbox primeiro**).

## 1. Conta + chave de API (sandbox)
1. Crie uma conta de sandbox em **https://sandbox.asaas.com** (grátis, não move dinheiro).
2. No painel: **Integrações → Chave de API** → gere a chave. Ela aparece **uma vez** — copie. (Sandbox tem prefixo `$aact_hmlg_...`.)

## 2. Variáveis de ambiente
Defina em `.env.local` (dev) **e** no Vercel (Project → Settings → Environment Variables). Veja `.env.example`:

```
ASAAS_API_KEY=$aact_hmlg_xxxxxxxxxxxxxxxx
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_USER_AGENT=stronilead-crm
ASAAS_WEBHOOK_TOKEN=<um segredo forte de 32+ chars, sem espaços>
```
> O `ASAAS_WEBHOOK_TOKEN` você inventa — gere algo aleatório (ex.: `openssl rand -hex 24`). Ele precisa ser **idêntico** ao `authToken` do webhook (passo 4).

Depois de salvar no Vercel, **faça um redeploy** para as funções enxergarem as chaves.

## 3. Publicar as regras do Firestore
As coleções novas (`asaas_events`, `tenant_payments`) já estão em `firestore.rules`
(leitura só super-admin, escrita só Admin SDK). **Publique as regras pelo Console
do Firebase** (o projeto publica manualmente, não via CLI).

## 4. Cadastrar o webhook no Asaas
No painel do Asaas: **Integrações → Webhooks → Adicionar**:
- **URL:** `https://stronilead.com.br/api/asaas-webhook` (no sandbox, aponte para o deploy de preview/produção que tiver as env vars)
- **Token de autenticação:** o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- **Versão da API:** v3
- **Tipo de envio:** **Sequencial** (recomendado)
- **Eventos:** marque pelo menos `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`

> ⚠️ Se o endpoint devolver erros seguidos, o Asaas **pausa a fila inteira** (fica em "interrompido") até você corrigir e reativar no painel. O handler já responde 200 rápido e é idempotente para evitar isso.

## 5. Testar (sandbox)
1. No super-admin → uma organização → aba **Cobrança** → seção **Cobrança automática (Asaas)**: informe CPF/CNPJ + e-mail, escolha o ciclo e clique **Criar assinatura no Asaas**.
2. Volte e use **Copiar link da fatura** — abra o link: é a fatura hospedada (Pix/boleto/cartão).
3. Simule o pagamento: no painel do Asaas, abra a cobrança e clique **Confirmar pagamento em dinheiro** (ou via API `POST /payments/{id}/receiveInCash`).
4. O webhook chega → a organização vira **Pago**, aparece em `tenant_payments`, e o MRR reflete. Vencimento atrasado dispara `PAYMENT_OVERDUE` → status **Inadimplente**.

## 6. Ir para produção
1. Conta de produção no Asaas, gere a chave `$aact_prod_...`.
2. No Vercel (produção): `ASAAS_API_KEY=$aact_prod_...` e `ASAAS_BASE_URL=https://api.asaas.com/v3`.
3. Cadastre o webhook de produção apontando para `https://stronilead.com.br/api/asaas-webhook` com o `ASAAS_WEBHOOK_TOKEN` de produção.
4. Redeploy.

## Como funciona (resumo técnico)
- `api/_asaas.js` — cliente (auth `access_token`, `billingType: UNDEFINED` = cliente escolhe Pix/boleto/cartão).
- `api/asaas-subscription.js` — super-admin cria/atualiza/cancela a assinatura; valor vem do catálogo de planos (mensal = `priceMonthly`/override; anual = `priceAnnual`).
- `api/asaas-webhook.js` — recebe eventos, valida o token, é idempotente (`asaas_events/{eventId}`), atualiza o tenant e grava `tenant_payments`.
- Campos no `/tenants/{id}`: `asaasCustomerId`, `asaasSubscriptionId`, `billingProvider`, `billingCycle`, `lastInvoiceUrl` (+ `paymentStatus`/`lastPaymentAt`/`nextBillingAt` agora automáticos).
- Cancelar a assinatura remove cobranças pendentes/atrasadas (pagas ficam).
