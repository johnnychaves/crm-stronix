// Cliente do gateway Asaas (cobrança recorrente). Todas as chamadas saem do
// backend (a API key NUNCA vai pro browser). Degradação graciosa: se as env
// vars não estiverem setadas, isAsaasConfigured()=false e os endpoints
// respondem "não configurado" — produção não quebra antes das chaves entrarem.
//
// Docs: https://docs.asaas.com  — auth via header `access_token`, User-Agent
// obrigatório. Sandbox: https://api-sandbox.asaas.com/v3 · Prod: https://api.asaas.com/v3

const BASE_URL = (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').replace(/\/+$/, '');
const API_KEY = process.env.ASAAS_API_KEY || '';
const USER_AGENT = process.env.ASAAS_USER_AGENT || 'stronilead-crm';

export function isAsaasConfigured() {
  return !!API_KEY;
}

export function asaasEnv() {
  // sandbox keys têm prefixo $aact_hmlg_ ; prod $aact_prod_
  return API_KEY.includes('_hmlg_') ? 'sandbox' : (API_KEY ? 'prod' : 'unset');
}

// Chamada genérica. Lança Error com a mensagem do Asaas em erro de negócio.
async function asaasFetch(path, { method = 'GET', body } = {}) {
  if (!API_KEY) throw new Error('ASAAS_API_KEY ausente');
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      access_token: API_KEY,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* corpo vazio */ }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || data?.message || `Asaas HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.asaas = data;
    throw err;
  }
  return data;
}

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// Acha o cliente pelo externalReference (= tenantId) ou cria um novo.
// Asaas permite duplicados, então deduplicamos por externalReference.
export async function findOrCreateCustomer({ tenantId, name, cpfCnpj, email, mobilePhone }) {
  const found = await asaasFetch(`/customers?externalReference=${encodeURIComponent(tenantId)}&limit=1`);
  if (found?.data?.length) return found.data[0];
  return asaasFetch('/customers', {
    method: 'POST',
    body: {
      name: name || tenantId,
      cpfCnpj: onlyDigits(cpfCnpj),
      email: email || undefined,
      mobilePhone: onlyDigits(mobilePhone) || undefined,
      externalReference: tenantId,
    },
  });
}

// Cria assinatura recorrente. billingType UNDEFINED = cliente escolhe
// Pix/boleto/cartão na fatura hospedada (baixo PCI). cycle: MONTHLY | YEARLY.
export async function createSubscription({ customerId, value, cycle, nextDueDate, description, tenantId }) {
  return asaasFetch('/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType: 'UNDEFINED',
      value,
      nextDueDate, // 'YYYY-MM-DD'
      cycle: cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
      description: description || undefined,
      externalReference: tenantId,
    },
  });
}

// Atualiza valor/ciclo. updatePendingPayments:true reescreve também as cobranças
// PENDENTES já geradas (senão o cliente paga o valor antigo no ciclo atual).
export async function updateSubscription(id, { value, cycle }) {
  return asaasFetch(`/subscriptions/${id}`, {
    method: 'PUT',
    body: {
      ...(value != null ? { value } : {}),
      ...(cycle ? { cycle: cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY' } : {}),
      updatePendingPayments: true,
    },
  });
}

// Cancela a assinatura (remove também cobranças pendentes/atrasadas; pagas ficam).
export async function cancelSubscription(id) {
  return asaasFetch(`/subscriptions/${id}`, { method: 'DELETE' });
}

// Cobranças (payments) de uma assinatura, mais recentes primeiro.
export async function listSubscriptionPayments(subscriptionId) {
  return asaasFetch(`/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=20&order=desc`);
}

// SANDBOX: simula o pagamento de uma cobrança (dispara o webhook real).
export async function receiveInCash(paymentId, { value, paymentDate } = {}) {
  return asaasFetch(`/payments/${paymentId}/receiveInCash`, {
    method: 'POST',
    body: { value, paymentDate: paymentDate || new Date().toISOString().slice(0, 10), notifyCustomer: false },
  });
}
