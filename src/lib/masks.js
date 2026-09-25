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

// Telefone: (51) 9 0000-0000 (máx. 11 dígitos). Número colado com +55 na
// frente (ex.: "+55 51 99530-4633") tem mais de 11 dígitos — sem tirar o 55,
// o corte em 11 cortava o final do número de verdade. Só tira quando sobra
// mais que 11: com exatamente 11, "55" na frente é o DDD de Santa Maria, não
// o país (mesma regra de api/_zapPhone.js).
export const formatPhone = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
