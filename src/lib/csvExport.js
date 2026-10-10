// Planilha das exportações: o CSV que o Excel pt-BR abre. Uma regra só para
// os exportar das telas (Relatórios, Todos os leads, Aulas e Visitas):
// separador ';', aspas só quando o valor pede, e a proteção contra fórmula. O
// valor que começa com =, +, -, @, tab ou retorno de carro ganha um apóstrofo
// na frente, senão o Excel e o Google Planilhas o executariam (CSV injection).
// O BOM UTF-8 vai no download, para o Excel ler os acentos. Puro, menos o
// downloadCsv, que precisa do navegador.

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[;"\r\n]/;

export function csvCell(value) {
  let s = String(value ?? '');
  if (FORMULA_START.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// `rows` são objetos; `columns` é [{ key, label }], na ordem da planilha.
export function toCsv(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(';');
  const lines = (rows || []).map((r) => columns.map((c) => csvCell(r?.[c.key])).join(';'));
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Safari pode perder o download se o endereço sumir no clique. Um segundo de
  // folga, o mesmo cuidado do importTemplateWrite.js.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
