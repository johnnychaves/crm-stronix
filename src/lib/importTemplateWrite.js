// Único lugar que toca o ExcelJS: transforma a descrição do modelo
// (buildTemplateSpec, em importTemplate.js) no .xlsx. Entra por import()
// dinâmico e mora no pedaço 'exceljs' do build (vite.config.js), então só quem
// clica em "Baixar modelo" no super console baixa a biblioteca. A leitura do
// arquivo preenchido continua com o SheetJS (spreadsheetRead.js).
// Spec: docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md

const loadExcel = async () => {
  const mod = await import('exceljs');
  return mod.default ?? mod;
};

const REQUIRED_FILL = 'FFFF6A2B'; // laranja da marca
const OPTIONAL_FILL = 'FFE5E7EB';
const REQUIRED_FONT = 'FFFFFFFF';
const OPTIONAL_FONT = 'FF1F2937';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function buildTemplateBuffer(spec) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Stronilead';

  // A ordem das abas importa: a importação lê a primeira.
  const ws = wb.addWorksheet(spec.sheets.CLIENTES, { views: [{ state: 'frozen', ySplit: 1 }] });
  const help = wb.addWorksheet(spec.sheets.AJUDA);
  const lists = wb.addWorksheet(spec.sheets.LISTAS, { state: 'hidden' });

  // O formato vai na coluna inteira: o que for digitado depois já nasce texto,
  // data ou dinheiro.
  ws.columns = spec.columns.map((col) => ({ header: col.label, key: col.field, width: col.width, style: { numFmt: col.numFmt } }));
  const head = ws.getRow(1);
  head.height = 22;
  spec.columns.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.font = { bold: true, color: { argb: col.required ? REQUIRED_FONT : OPTIONAL_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.required ? REQUIRED_FILL : OPTIONAL_FILL } };
    cell.alignment = { vertical: 'middle' };
    if (col.note) cell.note = col.note;
    if (col.validation) ws.dataValidations.add(col.range, col.validation);
  });

  spec.lists.forEach(({ letter, title, names }) => {
    const titleCell = lists.getCell(`${letter}1`);
    titleCell.value = title;
    titleCell.font = { bold: true };
    names.forEach((name, i) => { lists.getCell(`${letter}${i + 2}`).value = name; });
    lists.getColumn(letter).width = 32;
  });

  // Texto na coluna A (transborda para as vizinhas vazias) e o exemplo logo
  // abaixo, com uma coluna por campo.
  spec.help.example.headers.forEach((_, i) => { help.getColumn(i + 1).width = 20; });
  let r = 1;
  spec.help.lines.forEach(({ text, bold }) => {
    const cell = help.getCell(`A${r}`);
    cell.value = text;
    if (bold) cell.font = { bold: true };
    r += 1;
  });
  spec.help.example.headers.forEach((label, i) => {
    const cell = help.getRow(r).getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true };
  });
  spec.help.example.rows.forEach((values) => {
    r += 1;
    values.forEach((v, i) => { help.getRow(r).getCell(i + 1).value = v; });
  });

  return wb.xlsx.writeBuffer();
}

export async function downloadTemplate(spec) {
  const buf = await buildTemplateBuffer(spec);
  const blob = new Blob([buf], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = spec.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
