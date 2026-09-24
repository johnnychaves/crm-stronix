// Volta completa do modelo: o ExcelJS gera, o SheetJS lê pelo mesmo caminho da
// importação (readSpreadsheetFile) e parseRow interpreta. Datas em horário LOCAL.

import { describe, it, expect } from 'vitest';
import ExcelJSmod from 'exceljs';
import * as XLSXns from 'xlsx';
import { buildTemplateBuffer } from '../importTemplateWrite.js';
import { buildTemplateSpec, checkTemplateHeaders, templateMapping } from '../importTemplate.js';
import { readSpreadsheetFile } from '../spreadsheetRead.js';
import { parseRow } from '../clientImport.js';

const ExcelJS = ExcelJSmod.default ?? ExcelJSmod;
// O SheetJS abre o zip do .xlsx pelo CFB. No node ele chega como CommonJS.
const XLSX = XLSXns.CFB ? XLSXns : XLSXns.default;
const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 9, 24);

const SPEC = buildTemplateSpec({
  planos: [{ id: 'p1', name: 'Trimestral' }, { id: 'p2', name: 'Anual' }],
  users: [{ id: 'u1', name: 'Bia' }],
  professores: [{ id: 'pr1', name: 'Carlos' }],
  windowDays: 15,
  tenantId: 'academia-teste',
  now: NOW
});

const asFile = (buf) => new File([buf], SPEC.fileName);
const loadWorkbook = async (buf) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
};

describe('buildTemplateBuffer', () => {
  it('abre com Clientes primeiro e Listas oculta', async () => {
    const wb = await loadWorkbook(await buildTemplateBuffer(SPEC));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Clientes', 'Como preencher', 'Listas']);
    expect(wb.getWorksheet('Listas').state).toBe('hidden');
  });

  it('o arquivo vazio passa na conferência e não traz linha de dado', async () => {
    const { headers, rows, sheetName } = await readSpreadsheetFile(asFile(await buildTemplateBuffer(SPEC)));
    expect(sheetName).toBe('Clientes');
    expect(checkTemplateHeaders(headers).ok).toBe(true);
    expect(rows).toEqual([]);
  });

  it('cabeçalho congelado, laranja na obrigatória, cinza na opcional, com nota', async () => {
    const ws = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Clientes');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.getCell('A1').value).toBe('Nome *');
    expect(ws.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFFF6A2B' } });
    expect(ws.getCell('G1').fill).toMatchObject({ fgColor: { argb: 'FFE5E7EB' } });
    expect(ws.getCell('A1').note).toBe('Nome completo do cliente.');
  });

  it('formato de texto, data e valor nas colunas', async () => {
    const ws = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Clientes');
    expect(ws.getCell('B2').numFmt).toBe('@');
    expect(ws.getCell('E2').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell('G2').numFmt).toBe('"R$" #,##0.00');
  });

  it('listas suspensas gravadas até a linha 5001', async () => {
    const ws = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Clientes');
    const dv = ws.dataValidations.model;
    expect(dv.D2).toMatchObject({ type: 'list', formulae: ["'Listas'!$A$2:$A$3"], errorStyle: 'warning' });
    expect(dv.D5001).toMatchObject({ type: 'list' });
    expect(dv.H2).toMatchObject({ type: 'list', formulae: ['"Ativo,Trancado"'], errorStyle: 'stop' });
    expect(dv.E2).toMatchObject({ type: 'date', operator: 'between' });
    expect(dv.F2).toMatchObject({ type: 'custom' });
    expect(dv.A2).toBeUndefined();
  });

  // Ler de volta com o ExcelJS não prova nada aqui: ele desfaz a mesma
  // conversão que faz ao gravar. Só o XML mostra o que o Excel vai ver.
  it('no XML, a validação de data vai com os seriais 1 e 73415', async () => {
    const buf = await buildTemplateBuffer(SPEC);
    const zip = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
    const xml = new TextDecoder().decode(XLSX.CFB.find(zip, '/xl/worksheets/sheet1.xml').content);
    const dateRule = xml.match(/<dataValidation\b(?=[^>]*\btype="date")[^>]*\bsqref="E2:E5001"[^>]*>([\s\S]*?)<\/dataValidation>/);
    expect(dateRule?.[1]).toBe('<formula1>1</formula1><formula2>73415</formula2>');
  });

  it('a aba Listas guarda os nomes em ordem', async () => {
    const lists = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Listas');
    expect([lists.getCell('A1').value, lists.getCell('A2').value, lists.getCell('A3').value]).toEqual(['Planos', 'Anual', 'Trimestral']);
    expect(lists.getCell('B2').value).toBe('Bia');
    expect(lists.getCell('C2').value).toBe('Carlos');
  });

  it('a aba Como preencher traz o texto e o exemplo depois dele', async () => {
    const help = (await loadWorkbook(await buildTemplateBuffer(SPEC))).getWorksheet('Como preencher');
    expect(help.getCell('A1').value).toBe('Modelo de importação de clientes do Stronilead');
    const headerRow = SPEC.help.lines.length + 1;
    expect(help.getCell(`A${headerRow}`).value).toBe('Nome *');
    expect(help.getCell(`A${headerRow + 1}`).value).toBe('Maria Souza');
    expect(help.getCell(`A${headerRow + 2}`).value).toBe('João Pereira');
  });

  it('preenchido e lido pela importação: CPF com zero, datas e valor voltam certos', async () => {
    const wb = await loadWorkbook(await buildTemplateBuffer(SPEC));
    const ws = wb.getWorksheet('Clientes');
    ws.getCell('A2').value = 'Ana Teste';
    ws.getCell('B2').value = '01234567890';
    ws.getCell('C2').value = '71999990001';
    ws.getCell('D2').value = 'Trimestral';
    // O ExcelJS grava Date pelo dia em UTC; o SheetJS devolve meia-noite local.
    ws.getCell('E2').value = new Date(Date.UTC(2026, 7, 12));
    ws.getCell('F2').value = new Date(Date.UTC(2026, 10, 12));
    ws.getCell('G2').value = 1200.5;
    ws.getCell('H2').value = 'Trancado';
    ws.getCell('I2').value = 'Bia';
    ws.getCell('R2').value = '04567000';
    const { headers, rows } = await readSpreadsheetFile(asFile(await wb.xlsx.writeBuffer()));
    expect(rows).toHaveLength(1);
    const c = parseRow(rows[0], templateMapping(headers), rows[0].__row, NOW);
    expect(c).toMatchObject({
      rowNumber: 2,
      name: 'Ana Teste',
      cpfDigits: '01234567890',
      whatsappDigits: '71999990001',
      planName: 'Trimestral',
      value: 1200.5,
      contractSituation: 'trancado',
      consultantName: 'Bia',
      warnings: []
    });
    expect(c.startsAt).toEqual(D(2026, 8, 12));
    expect(c.endsAt).toEqual(D(2026, 11, 12));
    expect(c.address.cep).toBe('04567000');
  });
});
