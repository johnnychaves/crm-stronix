// Avisos de telefone do cadastro e da edição do lead. Nunca barram: quem barra
// é o duplicado do WhatsApp do próprio lead (useDuplicateLead). Aqui só se
// avisa que o número já é de alguém, como dono ou como responsável de menor.
// Mora fora de guardian.js porque precisa de leads.js, e leads.js importa
// globalSearch.js, que importa guardian.js.
import { isClientLead } from './leads.js';
import { contactOf, firstName } from './guardian.js';

const nomes = (lista) => {
  const primeiros = lista.map((l) => firstName(l.name)).filter(Boolean);
  if (primeiros.length <= 2) return primeiros.join(' e ');
  return `${primeiros.slice(0, 2).join(', ')} e mais ${primeiros.length - 2}`;
};

const situacao = (lead) =>
  isClientLead(lead) ? 'cliente' : (lead.status ? `lead em ${lead.status}` : 'lead');

// field: 'own' (WhatsApp do próprio lead) ou 'guardian' (telefone do responsável).
// owner: lead cujo WhatsApp é este número, ou null. wards: menores que têm este
// número como responsável (quem já não o tem como contato é filtrado aqui).
export function phoneNoticeLines({ field, owner, wards = [], now = new Date() }) {
  const filhos = wards.filter((w) => contactOf(w, now).viaGuardian);
  const nomesFilhos = nomes(filhos);
  // Caso raro: o menor tem o telefone do responsável como o próprio WhatsApp
  // (cadastro antigo) e é ele mesmo o "owner" achado pelo whatsappDigits.
  // Nesse caso a linha do responsável não soma nada, só a linha do menor.
  const ownerEhFilho = Boolean(owner) && filhos.some((f) => f.id === owner.id);
  const linhas = [];
  if (field === 'guardian' && owner && !ownerEhFilho) {
    linhas.push(`Esse é o telefone de ${owner.name}, ${situacao(owner)}.`);
  }
  if (nomesFilhos) {
    const quem = firstName(filhos[0]?.guardian?.name);
    if (field === 'guardian') {
      linhas.push(quem
        ? `${quem} já é responsável de ${nomesFilhos}.`
        : `Já é responsável de ${nomesFilhos}.`);
    } else {
      linhas.push(quem
        ? `Esse telefone é de ${quem}, responsável de ${nomesFilhos}.`
        : `Esse telefone é do responsável de ${nomesFilhos}.`);
    }
  }
  return linhas;
}
