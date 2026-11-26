// Os relatórios Faltantes e Presenças da Next Fit (Relatórios → Clientes →
// Acessos/Presenças, exportados para Excel): reconhecer o arquivo pelo
// cabeçalho e ler as linhas. Puro: recebe o que readSpreadsheetFile
// (src/lib/spreadsheetRead.js) devolve, os cabeçalhos e as linhas como
// objetos chaveados pelo cabeçalho, com `__row`. O cabeçalho vem na primeira
// linha do arquivo, sem título em cima (conferido nas planilhas de
// 02/10/2026), e é a primeira linha preenchida que o leitor toma como
// cabeçalho.
//
// As células de data chegam de três jeitos. Texto ("25/09/2026" e
// "02/10/2026 07:00"), que é como o levantamento viu as planilhas. Date, quando
// a célula é de data no Excel: o SheetJS (cellDates) monta a Date com o relógio
// da célula nos getters locais, em qualquer fuso, e é deles que o dia e a hora
// saem (conferido com a versão 0.20.3, como o parseImportDate de
// clientImport.js já fazia). E o número de série do Excel, por garantia.
//
// Cabeçalhos e formatos: docs/superpowers/specs/2026-10-02-professor-e-faltosos-levantamento.md
import { normalize } from '../globalSearch.js';
import { maiorDia, somarDias } from './dias.js';

export const FALTANTES_HEADER = Object.freeze(['Nome', 'Contrato', 'Qtde de ausências', 'Última presença', 'Telefone', 'Professor', 'Consultor']);
export const PRESENCAS_HEADER = Object.freeze(['Cliente', 'Modalidade', 'Contrato', 'Tipo', 'Data']);

export const NAO_E_DA_NEXTFIT = 'Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.';

// Chave de texto: sem acento, minúsculo, só letras e números, um espaço entre
// as palavras. "  JOÃO  da Silva " e "Joao da silva" dão a mesma chave, e
// "Última presença" e "ULTIMA  PRESENCA" também. Serve para reconhecer o
// cabeçalho e para comparar nomes de aluno e de professor, e é o id do
// documento em stronix_nextfit_alunos. É a mesma conta do normalizeHeader de
// importTemplate.js, que não dá para importar daqui porque ele puxa o
// clientImport.js inteiro. A ligação dos alunos (ligacaoAlunos.js) exporta
// esta mesma função.
export const nomeChave = (texto) => normalize(String(texto ?? '')).replace(/[^a-z0-9]+/g, ' ').trim();

// O relatório pelo cabeçalho: todas as colunas dele precisam estar lá. Caixa,
// acento e espaço não importam, e coluna a mais não atrapalha (a Next Fit pode
// acrescentar uma). Nenhum dos dois, ou os dois ao mesmo tempo, dá null.
export function detectReport(headerRow) {
  const presentes = new Set((Array.isArray(headerRow) ? headerRow : []).map(nomeChave).filter(Boolean));
  const tem = (esperado) => esperado.every((h) => presentes.has(nomeChave(h)));
  const faltantes = tem(FALTANTES_HEADER);
  const presencas = tem(PRESENCAS_HEADER);
  if (faltantes === presencas) return null;
  return faltantes ? 'faltantes' : 'presencas';
}

// Lê a coluna pelo nome esperado, achando o cabeçalho de verdade da planilha
// pela mesma chave da detecção.
function leitorDeColunas(rows) {
  const porChave = new Map();
  for (const row of rows || []) {
    for (const k of Object.keys(row || {})) {
      if (k === '__row') continue;
      const chave = nomeChave(k);
      if (chave && !porChave.has(chave)) porChave.set(chave, k);
    }
  }
  return (row, coluna) => {
    const k = porChave.get(nomeChave(coluna));
    return k === undefined ? undefined : row?.[k];
  };
}

const texto = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const pad = (n) => String(n).padStart(2, '0');

const diaDe = (ano, mes, dia) => {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
    ? `${ano}-${pad(mes)}-${pad(dia)}`
    : null;
};
const horaDe = (h, m) => (h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${pad(h)}:${pad(m)}` : null);

const TEXTO_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT,]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/;
const TEXTO_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[\sT](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;
// 25569: dias de 30/12/1899 (o zero do Excel) a 01/01/1970.
const EXCEL_ZERO = 25569;

// { dia: 'AAAA-MM-DD', hora: 'HH:MM' | null } de uma célula, ou null quando
// ela não é data. Ano com dois dígitos é recusado (a Next Fit escreve quatro),
// e dia que não existe (31/02) também. Hora fora do relógio fica null, com o
// dia valendo.
export function lerDiaEHora(valor) {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return {
      dia: diaDe(valor.getFullYear(), valor.getMonth() + 1, valor.getDate()),
      hora: horaDe(valor.getHours(), valor.getMinutes()),
    };
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor <= 0) return null;
    const minutos = Math.round(valor * 1440);
    const d = new Date((Math.floor(minutos / 1440) - EXCEL_ZERO) * 86400000);
    const resto = minutos % 1440;
    return {
      dia: diaDe(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      hora: Number.isInteger(valor) ? null : horaDe(Math.floor(resto / 60), resto % 60),
    };
  }
  const s = texto(valor);
  const br = TEXTO_BR.exec(s);
  const iso = br ? null : TEXTO_ISO.exec(s);
  const m = br || iso;
  if (!m) return null;
  const [ano, mes, dia] = br ? [m[3], m[2], m[1]].map(Number) : [m[1], m[2], m[3]].map(Number);
  const d = diaDe(ano, mes, dia);
  if (!d) return null;
  return { dia: d, hora: m[4] === undefined ? null : horaDe(Number(m[4]), Number(m[5])) };
}

const lerDia = (valor) => lerDiaEHora(valor)?.dia || null;

// Inteiro de 0 para cima, de número ou de texto só com dígitos.
const lerInteiro = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor >= 0 ? valor : null;
  const s = texto(valor);
  return /^\d+$/.test(s) ? Number(s) : null;
};

// O número da linha na planilha: o `__row` do leitor ou, sem ele, a posição
// mais 2 (o cabeçalho é a linha 1).
const numeroDaLinha = (row, i) => (Number.isInteger(row?.__row) && row.__row > 0 ? row.__row : i + 2);

// { linhas, erros }. Cada linha: { numero, nome, contrato, ausencias,
// ultimaPresenca, telefone, professorNextFit, consultorNextFit }, em que
// `numero` é o da linha na planilha, para a prévia apontar a linha certa. A
// linha sem nome, sem última presença ou sem quantidade legível vai para
// `erros` ({ numero, nome, motivo }), que a prévia mostra e que não barram a
// importação. Um rodapé como "Total: 196" cai em `erros`.
export function parseFaltantes(rows) {
  const ler = leitorDeColunas(rows);
  const linhas = [];
  const erros = [];
  (rows || []).forEach((row, i) => {
    const numero = numeroDaLinha(row, i);
    const nome = texto(ler(row, 'Nome'));
    const ultimaPresenca = lerDia(ler(row, 'Última presença'));
    const ausencias = lerInteiro(ler(row, 'Qtde de ausências'));
    if (!nome) { erros.push({ numero, nome: null, motivo: 'Linha sem nome.' }); return; }
    if (!ultimaPresenca) { erros.push({ numero, nome, motivo: 'A última presença não é uma data.' }); return; }
    if (ausencias === null) { erros.push({ numero, nome, motivo: 'A quantidade de ausências não é um número.' }); return; }
    linhas.push({
      numero,
      nome,
      contrato: texto(ler(row, 'Contrato')) || null,
      ausencias,
      ultimaPresenca,
      telefone: texto(ler(row, 'Telefone')) || null,
      professorNextFit: texto(ler(row, 'Professor')) || null,
      consultorNextFit: texto(ler(row, 'Consultor')) || null,
    });
  });
  return { linhas, erros };
}

// A data da exportação: a última presença mais a quantidade de ausências, que
// dá o mesmo dia em todas as linhas. Se não der, vale o dia mais comum (no
// empate, o mais novo), e `divergentes` conta as linhas que deram outro dia.
export function dataDoFaltantes(linhas) {
  const contagem = new Map();
  for (const l of linhas || []) {
    const d = somarDias(l?.ultimaPresenca, l?.ausencias);
    if (d) contagem.set(d, (contagem.get(d) || 0) + 1);
  }
  let dia = null;
  let maior = 0;
  let total = 0;
  for (const [d, n] of contagem) {
    total += n;
    if (n > maior || (n === maior && d > dia)) { dia = d; maior = n; }
  }
  return { dia, divergentes: total - maior };
}

const ORIGEM_POR_TIPO = Object.freeze({ acesso: 'catraca', agenda: 'agenda' });
// "offf" e "off" parecem nome provisório de plano na Next Fit (levantamento).
const MODALIDADES_FALSAS = new Set(['off', 'offf']);

// Nome de modalidade de verdade, ou null.
export function modalidadeDeVerdade(valor) {
  const t = texto(valor);
  return t && !MODALIDADES_FALSAS.has(nomeChave(t)) ? t : null;
}

// { linhas, erros }. Cada linha: { numero, nome, contrato, modalidade, origem,
// dia, hora }. `Acesso` vira catraca e `Agenda` vira agenda; outro tipo vai
// para `erros`. Sem hora na célula, hora é null.
export function parsePresencas(rows) {
  const ler = leitorDeColunas(rows);
  const linhas = [];
  const erros = [];
  (rows || []).forEach((row, i) => {
    const numero = numeroDaLinha(row, i);
    const nome = texto(ler(row, 'Cliente'));
    const quando = lerDiaEHora(ler(row, 'Data'));
    const tipo = texto(ler(row, 'Tipo'));
    const origem = ORIGEM_POR_TIPO[nomeChave(tipo)] || null;
    if (!nome) { erros.push({ numero, nome: null, motivo: 'Linha sem nome do cliente.' }); return; }
    if (!quando) { erros.push({ numero, nome, motivo: 'A data não dá para ler.' }); return; }
    if (!origem) { erros.push({ numero, nome, motivo: tipo ? `O tipo "${tipo}" não é Acesso nem Agenda.` : 'Linha sem tipo.' }); return; }
    linhas.push({
      numero,
      nome,
      contrato: texto(ler(row, 'Contrato')) || null,
      modalidade: modalidadeDeVerdade(ler(row, 'Modalidade')),
      origem,
      dia: quando.dia,
      hora: quando.hora,
    });
  });
  return { linhas, erros };
}

// Do primeiro ao último dia que aparece no arquivo, ou null sem linha.
export function periodoDasPresencas(linhas) {
  let de = null;
  for (const l of linhas || []) if (l?.dia && (de === null || l.dia < de)) de = l.dia;
  const ate = maiorDia(...(linhas || []).map((l) => l?.dia));
  return de && ate ? { de, ate } : null;
}
