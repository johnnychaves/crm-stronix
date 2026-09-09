// Chave de casamento entre lead.whatsapp (Stronilead) e Contact.phone
// (Stronizap): DDD + os últimos 8 dígitos. Os últimos 8 são idênticos com ou
// sem o nono dígito, então são a única parte estável entre os dois formatos.
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

export function zapMatchKey(raw) {
  let d = onlyDigits(raw);
  // O 55 só é DDI quando sobra número suficiente depois dele. Com 10 dígitos,
  // "55" na frente é o DDD de Santa Maria, não o país.
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  return `${d.slice(0, 2)}${d.slice(-8)}`;
}
