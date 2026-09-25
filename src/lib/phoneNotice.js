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
  const quem = firstName(filhos[0]?.guardian?.name) || 'Essa pessoa';
  const linhas = [];
  if (field === 'guardian' && owner) {
    linhas.push(`Esse é o telefone de ${owner.name}, ${situacao(owner)}.`);
  }
  if (filhos.length > 0) {
    linhas.push(field === 'guardian'
      ? `${quem} já é responsável de ${nomes(filhos)}.`
      : `Esse telefone é de ${quem}, responsável de ${nomes(filhos)}.`);
  }
  return linhas;
}
