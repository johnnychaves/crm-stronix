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

// Arquivo de texto (CSV) em UTF-8 sem BOM chega decodificado como Windows-1252
// pelo SheetJS e todo acento vira lixo ("SituaÃ§Ã£o"). Passar `codepage`
// resolveria, mas faz o SheetJS gritar console.error a cada leitura por falta
// da tabela opcional. Então, quando o arquivo não é um zip (xlsx) e os bytes
// são UTF-8 válido, decodificamos aqui e entregamos texto pronto; o resto
// (xlsx, CSV com BOM, CSV em cp1252) segue o caminho padrão.
const isZip = (bytes) => bytes.length > 1 && bytes[0] === 0x50 && bytes[1] === 0x4b;
const decodeUtf8OrNull = (buf) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
};

export async function readSpreadsheetFile(file) {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const text = isZip(new Uint8Array(buf)) ? null : decodeUtf8OrNull(buf);
  const wb = text != null
    ? XLSX.read(text, { type: 'string', cellDates: true, raw: true })
    : XLSX.read(buf, { type: 'array', cellDates: true, raw: true });
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
    .filter(({ cells }) => cells.some((v) => String(v ?? '').trim() !== ''))
    .map(({ cells, row }) => {
      const obj = { __row: row };
      headers.forEach((h, j) => { if (h) obj[h] = cells[j]; });
      return obj;
    });
  return { headers: headers.filter(Boolean), rows, sheetName };
}
