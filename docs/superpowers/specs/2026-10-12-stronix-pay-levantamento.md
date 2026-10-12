# Stronix Pay: levantamento no sandbox da Asaas

Parte 0 da spec `docs/superpowers/specs/2026-10-12-stronix-pay-design.md`. Feito em 12/10/2026, no sandbox da Asaas (`https://api-sandbox.asaas.com/v3`), com uma chave de sandbox e um script descartável fora do repositório. O Johnny pagou o Checkout no navegador com um cartão de teste.

## Como foi o teste

1. Criamos duas academias de teste na Asaas, com e-mail `@example.com`. A primeira (A) recebeu uma assinatura igual às de hoje: `billingType: 'UNDEFINED'`, R$ 189,00 por mês, vencimento em 22/10. A segunda (B) serviu só para ler as notificações.
2. Trocamos a forma da assinatura da A para `CREDIT_CARD` sem mandar cartão e voltamos para `UNDEFINED`.
3. Abrimos um Checkout recorrente (`POST /v3/checkouts`, cartão, `RECURRENT`, `nextDueDate` em 22/10) com o cliente A. O Johnny pagou com cartão de teste.
4. Conferimos a assinatura nova e a primeira cobrança, mudamos o valor dela para R$ 219,00, cancelamos a assinatura antiga e mexemos nas notificações da B.

## Respostas

| # | Pergunta | Resposta no sandbox |
|---|---|---|
| 1 | O Checkout com `nextDueDate` no futuro cobra na hora? | **Não.** Ele cria a assinatura no cartão com a primeira cobrança `PENDING` no vencimento (22/10). |
| 2 | O Checkout aceita a academia que já existe na Asaas? | **Sim, com o cadastro completo.** O campo `customer` é aceito, mas a Asaas recusa (400) quando o cliente não tem telefone, endereço, número, CEP, bairro e cidade. Com o cadastro completo, a assinatura nova nasce no mesmo cliente. |
| 2b | O `externalReference` do Checkout passa para a assinatura? | **Não.** A assinatura nova vem com `externalReference: null`. |
| 2c | Dá para ler o Checkout depois? | **Não.** `GET /v3/checkouts/{id}` responde 404. O andamento do Checkout só chega pelo webhook. |
| 3 | A cobrança traz os quatro dígitos e a bandeira? | **Sim.** `creditCard.creditCardNumber` vem com os quatro últimos dígitos e `creditCardBrand` com a bandeira (`MASTERCARD`). Vem também um `creditCardToken`. |
| 4 | Cancelar a assinatura antiga apaga as cobranças pendentes dela? | **Sim.** Depois do `DELETE`, a cobrança pendente da assinatura antiga fica com `deleted: true` e some da lista. |
| 5 | Dá para mudar o valor de uma assinatura no cartão? | **No sandbox, sim.** O `PUT` com `value` e `updatePendingPayments: true` passou, e a assinatura e a cobrança pendente foram para R$ 219,00. A documentação diz que em produção isso exige a tokenização habilitada; a pergunta foi para a Asaas (ver "O que falta"). |
| 6 | Dá para trocar `UNDEFINED` por `CREDIT_CARD` sem mandar cartão? | **A Asaas aceita** (200), mas a assinatura fica no cartão sem cartão salvo. Não testamos o vencimento nesse estado, e o desenho não usa esse caminho. |
| 8 | Como desligar as notificações da Asaas? | O padrão no sandbox são 8 notificações, todas ligadas, com e-mail ligado e SMS, ligação e WhatsApp desligados. **O `PUT /v3/notifications/batch` com `enabled: false` desliga todas**, e a lista confirma. O `notificationDisabled: true` na criação do cliente não muda nada na lista, então não dá para conferir pela API se ele desliga o envio. |

## O que isso muda na spec

- **Antes de abrir o Checkout, o servidor completa o cliente na Asaas** com o telefone e o endereço do Perfil da academia: `responsiblePhone` e `profile` (CEP, rua, número, bairro), em `tenants/{id}/private`. Academia com o Perfil incompleto não abre o Checkout. O bloco Forma de pagamento pede para completar o Perfil, com o link para ele.
- **O webhook acha a academia da assinatura nova pelo cliente** (`asaasCustomerId`), e não pelo `externalReference`, que não passa do Checkout para a assinatura.
- **Sem cobrança na hora:** a troca para o cartão não paga o mês duas vezes. A cobrança pendente da assinatura antiga, no mesmo vencimento, some com o `DELETE` da assinatura antiga.
- **Desligar as notificações da Asaas** é o `PUT /v3/notifications/batch` com `enabled: false`, por cliente.

## O que falta

- **Conferir em 22/10/2026 se a cobrança caiu sozinha no cartão.** É a primeira cobrança da assinatura do teste (`sub_8ozpixlbuxxobk8z`).
- **Respostas da Asaas** ao pedido do Johnny:
  - a liberação do Pix Automático;
  - se mudar o valor de assinatura no cartão exige tokenização em produção;
  - quantas vezes e quando a Asaas tenta de novo um cartão recusado.
- **Pix Automático:** não aparece no sandbox; o teste depende da liberação.

## Documentação consultada (12/10/2026)

- Checkout recorrente: https://docs.asaas.com/docs/checkout-com-assinatura-recorrente e https://docs.asaas.com/reference/criar-novo-checkout
- Assinatura no cartão: https://docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito e https://docs.asaas.com/docs/faq-assinaturas
- Atualizar assinatura: https://docs.asaas.com/reference/atualizar-assinatura-existente
- Tokenização: https://docs.asaas.com/reference/tokenizacao-de-cartao-de-credito
- Cartões de teste: https://docs.asaas.com/docs/testando-pagamento-com-cartão-de-crédito
- Webhooks de cobrança: https://docs.asaas.com/docs/webhook-para-cobrancas
- Webhooks de assinatura: https://docs.asaas.com/docs/eventos-para-assinaturas
- Notificações: https://docs.asaas.com/docs/notificacoes-padroes e https://docs.asaas.com/docs/alterando-notificacoes-de-um-cliente
- Pix Automático: https://docs.asaas.com/docs/pix-automatico, https://docs.asaas.com/docs/faq-2, https://docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico e https://docs.asaas.com/docs/pix-automático-processo-de-retentativas-jornada-3-api
- Painel: https://docs.asaas.com/reference/recuperar-saldo-da-conta, https://docs.asaas.com/reference/estatisticas-de-cobrancas e https://docs.asaas.com/reference/recuperar-extrato
- Limites de uso: https://docs.asaas.com/reference/rate-e-quota-limit
