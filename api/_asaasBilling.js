// A fatura a pagar de uma academia, lida da lista de cobranças do Asaas.
// O Asaas cria a cobrança do mês seguinte antes de a do mês atual ser paga, e a
// lista não tem ordem garantida: por isso a regra olha o vencimento, e não a
// última cobrança criada. Puro (sem import), testado em api/__tests__.

const OPEN = new Set(['PENDING', 'OVERDUE']);
const PAID = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

const byDueAsc = (a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || ''));

// payments: o `data` da listagem do Asaas.
// due: a cobrança em aberto de vencimento mais antigo (é a que o cliente paga).
// overdue: a atrasada mais antiga. paymentStatus: 'overdue' com qualquer
// atrasada; senão 'paid' se alguma já foi paga; senão 'pending' (nunca pagou).
export function billingSnapshot(payments) {
  const list = (Array.isArray(payments) ? payments : []).filter((p) => p && !p.deleted);
  const open = list.filter((p) => OPEN.has(p.status)).sort(byDueAsc);
  const overdue = open.find((p) => p.status === 'OVERDUE') || null;
  const everPaid = list.some((p) => PAID.has(p.status));
  return {
    due: open[0] || null,
    overdue,
    paymentStatus: overdue ? 'overdue' : everPaid ? 'paid' : 'pending',
  };
}
