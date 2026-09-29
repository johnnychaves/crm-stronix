// Máscaras de documento/telefone brasileiras. Fonte única (antes duplicadas
// em EditLeadModal/AddLeadModal). Guardam dígitos internamente e formatam
// progressivamente na digitação.

// CPF: 000.000.000-00 (máx. 11 dígitos).
export const formatCPF = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

// Dígitos nacionais do telefone (máx. 11). Número colado com +55 na frente
// (ex.: "+55 51 99530-4633") vira 13 dígitos, ou 12 com o "+" ainda no texto
// colando DDI num fixo. Datilografar nunca chega nisso de uma vez só, porque
// o campo já corta em 11 a cada tecla, então só um "colar" cai aqui. Com
// exatamente 11 dígitos e sem "+", "55" na frente é o DDD de Santa Maria, não
// o país (mesma regra de api/_zapPhone.js): 12 dígitos SEM "+" também é esse
// caso (DDD 55 e mais um dígito perdido na digitação), então não tira nada.
export const phoneDigits = (raw) => {
  const text = String(raw || '');
  let d = text.replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 13 || (text.trim().startsWith('+') && d.length > 11))) d = d.slice(2);
  return d.slice(0, 11);
};

// Telefone com DDD. Fixo, 10 dígitos: (51) 3333-4444. Celular, 11 dígitos:
// (51) 9 8124-4710. É a máscara dos campos, aplicada a cada tecla, e até o
// 10º dígito não dá para saber se vem um fixo ou um celular. Por isso o
// número fica no desenho do fixo e troca para o do celular quando chega o
// 11º dígito: até lá cada tecla só acrescenta no fim, e a troca acontece uma
// vez só. Regra do DDI em phoneDigits.
export const formatPhone = (v) => {
  const d = phoneDigits(v);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  if (numero.length === 9) return `(${ddd}) ${numero.slice(0, 1)} ${numero.slice(1, 5)}-${numero.slice(5)}`;
  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
};
