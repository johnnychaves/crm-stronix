// Consultas e validações públicas (sem chave, com CORS) para o cadastro da
// academia, rodando no browser:
//   • CEP  → ViaCEP    (https://viacep.com.br)
//   • CNPJ → BrasilAPI (https://brasilapi.com.br) — base pública da Receita
//   • CPF  → apenas VALIDAÇÃO de dígitos (dado pessoal protegido por LGPD não
//            tem consulta pública gratuita; nome a partir de CPF exige API paga)
// As consultas retornam null quando o formato é inválido, a consulta falha ou
// o documento não existe; o chamador decide a mensagem ao usuário.

const digits = (s) => String(s || '').replace(/\D/g, '');

export const isCnpjComplete = (v) => digits(v).length === 14;
export const isCepComplete = (v) => digits(v).length === 8;
export const isCpfComplete = (v) => digits(v).length === 11;

// Validação de CPF (algoritmo dos dígitos verificadores). Offline, instantânea.
export function isValidCpf(v) {
  const c = digits(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +c[i] * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== +c[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +c[i] * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === +c[10];
}

// Endereço a partir do CEP. { street, neighborhood, city, state } ou null.
export async function lookupCep(cep) {
  const d = digits(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.erro) return null; // CEP inexistente
    return {
      street: j.logradouro || '',
      neighborhood: j.bairro || '',
      city: j.localidade || '',
      state: j.uf || '',
    };
  } catch { return null; }
}

// Dados cadastrais a partir do CNPJ. { legalName, tradeName } ou null (404 = não existe).
export async function lookupCnpj(cnpj) {
  const d = digits(cnpj);
  if (d.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!res.ok) return null;
    const j = await res.json();
    return { legalName: j.razao_social || '', tradeName: j.nome_fantasia || '' };
  } catch { return null; }
}
