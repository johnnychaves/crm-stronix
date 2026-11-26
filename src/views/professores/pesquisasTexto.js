// Os textos de data e de ciclo da pesquisa de NPS. Os dias chegam em texto
// 'AAAA-MM-DD' (plano 2026-11-25-perfil-do-professor-04, decisão 2).
const partes = (dia) => String(dia || '').split('-');

export function diaTexto(dia) {
  const [a, m, d] = partes(dia);
  return d ? `${d}/${m}/${a}` : '';
}

// "01/06 a 20/06/2027", com o ano nos dois lados quando muda.
export function periodoTexto(inicio, fim) {
  const [ai, mi, di] = partes(inicio);
  const [af, mf, df] = partes(fim);
  if (!di || !df) return '';
  return ai === af ? `${di}/${mi} a ${df}/${mf}/${af}` : `${di}/${mi}/${ai} a ${df}/${mf}/${af}`;
}

const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);

// O prazo da pesquisa aberta, em minúscula para entrar no meio da frase.
export function prazoTexto(p, hoje) {
  if (hoje < p.inicio) return `recebe respostas a partir de ${diaTexto(p.inicio).slice(0, 5)}`;
  const n = diasEntre(hoje, p.fim);
  if (n <= 0) return 'termina hoje';
  return n === 1 ? 'falta 1 dia' : `faltam ${n} dias`;
}
