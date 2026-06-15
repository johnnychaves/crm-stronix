// Consultas públicas (sem chave, com CORS) para auto-preencher o cadastro da
// academia direto no browser:
//   • CEP  → ViaCEP    (https://viacep.com.br)
//   • CNPJ → BrasilAPI (https://brasilapi.com.br) — mesma base da Receita
// Retornam null quando o formato é inválido, a consulta falha ou o documento
// não existe; o chamador decide a mensagem ao usuário.

const digits = (s) => String(s || '').replace(/\D/g, '');

export const isCnpjComplete = (v) => digits(v).length === 14;
export const isCepComplete = (v) => digits(v).length === 8;

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

// Dados cadastrais a partir do CNPJ. { legalName } ou null (404 = não existe).
export async function lookupCnpj(cnpj) {
  const d = digits(cnpj);
  if (d.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!res.ok) return null;
    const j = await res.json();
    return { legalName: j.razao_social || j.nome_fantasia || '' };
  } catch { return null; }
}
