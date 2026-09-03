// Leitura da planilha de importação (.xlsx ou .csv) no navegador. Único lugar
// que toca o SheetJS, e por import() dinâmico: quem nunca importa nada não paga
// o peso da biblioteca no bundle. Devolve cabeçalhos e linhas como objetos
// chaveados pelo cabeçalho, mais `__row` (número da linha na planilha, base 1)
// para o relatório apontar a linha certa.
//
// `cellDates: true` faz célula de data virar Date; `raw: true` preserva número
// e Date em vez de texto formatado. Texto de data em CSV chega como string e o
// parseImportDate (clientImport.js) resolve.

const loadXlsx = async () => {
  const mod = await import('xlsx');
  return typeof mod.read === 'function' ? mod : mod.default;
};

// Cabeçalho repetido ganha sufixo " (2)", " (3)"... para o mapeamento por
// nome não ambiguar.
const uniqueHeaders = (raw) => {
  const seen = new Map();
  return raw.map((h) => {
    const base = String(h ?? '').trim();
    if (!base) return '';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
};

export async function readSpreadsheetFile(file) {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Planilha sem aba.');
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const headerIdx = matrix.findIndex((r) => r.some((v) => String(v ?? '').trim() !== ''));
  if (headerIdx < 0) throw new Error('Planilha vazia.');
  const headers = uniqueHeaders(matrix[headerIdx]);
  const rows = matrix
    .slice(headerIdx + 1)
    .map((r, i) => ({ cells: r, row: headerIdx + 2 + i }))
    .filter(({ cells }) => cells.some((v) => v !== '' && v != null))
    .map(({ cells, row }) => {
      const obj = { __row: row };
      headers.forEach((h, j) => { if (h) obj[h] = cells[j]; });
      return obj;
    });
  return { headers: headers.filter(Boolean), rows, sheetName };
}
