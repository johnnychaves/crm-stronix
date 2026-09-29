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

// Dígitos nacionais do número que o WhatsApp guarda, no formato que o
// Stronilead grava: sem o 55 (pela mesma regra da chave acima) e com o nono
// dígito do celular. Número cadastrado no WhatsApp antes do nono dígito chega
// com 10; quando o primeiro depois do DDD é 6, 7, 8 ou 9, é celular e ganha o
// 9 logo depois do DDD. Fixo (2 a 5) fica com 10. null quando não sobram 10
// ou 11 dígitos. A chave de casamento não muda: DDD e últimos 8 são os mesmos
// com e sem o 9.
export function nationalPhoneDigits(raw) {
  let d = onlyDigits(raw);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 10 && '6789'.includes(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  return d.length === 10 || d.length === 11 ? d : null;
}
