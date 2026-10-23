// O último registro de texto da ficha (anotação, WhatsApp ou ligação), para o
// compositor mostrar o que foi dito antes de a pessoa escrever. Recebe as
// interações já classificadas (cada uma com `_kind`, de classifyInteraction em
// lib/timeline.js). Puro.
const PREFIXES = [
  /^📲\s*Mensagem WhatsApp enviada:\s*/i,
  /^📞\s*Ligação:\s*/i,
  /^OBSERVAÇÃO DO CADASTRO:\s*/i,
  /^Obs:\s*/i,
];

export function lastRecordOf(interactions) {
  const textos = (interactions || [])
    .filter((i) => (i._kind === 'note' || i._kind === 'conversation') && i.createdAt instanceof Date && !isNaN(i.createdAt.getTime()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const i = textos[0];
  if (!i) return null;
  const raw = String(i.text || '').trim();
  const label = i._kind === 'conversation' ? (/^📞/.test(raw) ? 'Ligação' : 'WhatsApp') : 'Anotação';
  const text = PREFIXES.reduce((t, re) => t.replace(re, ''), raw).trim();
  return { id: i.id, label, date: i.createdAt, text };
}
