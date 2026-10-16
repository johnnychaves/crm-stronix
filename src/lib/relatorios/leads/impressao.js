// A ficha do relatório impresso dos Relatórios (o ReportPrint, em
// src/views/relatorios/ReportPrint.jsx, desenha a folha): o período ou o
// retrato, os filtros da barra, o filtro da lista e quem gerou. Pura, fora o
// contexto que leva a ficha à folha enquanto a impressão dura.
import { createContext } from 'react';
import { fmtNum } from '../../format.js';
import { plural } from '../../crm/format.js';
import { dayKeyOf, monthKeyOf, monthLabel } from '../../operacional/month.js';
import { CUT_PREFIX, fmtDate } from './base.js';

// A ficha da impressão em curso, ou null fora dela.
export const ReportPrintContext = createContext(null);

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const atText = (d) => `${fmtDate(d)} às ${hhmm(d)}`;
const monthName = (d) => monthLabel(monthKeyOf(d), { capitalized: false, withYear: false });
const fullDay = (d) => `${d.getDate()} de ${monthName(d)} de ${d.getFullYear()}`;

// "1 a 15 de outubro de 2026", "28 de setembro a 3 de outubro de 2026" ou "15
// de outubro de 2026", do início até o último dia da janela [start, end).
export function longRangeText(start, end) {
  const last = new Date(Math.max(start.getTime(), end.getTime() - 1));
  if (dayKeyOf(start) === dayKeyOf(last)) return fullDay(start);
  if (start.getFullYear() !== last.getFullYear()) return `${fullDay(start)} a ${fullDay(last)}`;
  if (start.getMonth() !== last.getMonth()) return `${start.getDate()} de ${monthName(start)} a ${fullDay(last)}`;
  return `${start.getDate()} a ${fullDay(last)}`;
}

const KIND_NOTE = Object.freeze({ hoje: 'hoje', ontem: 'ontem', semana: 'esta semana', 'semana-passada': 'semana passada' });
const periodNote = (period) => (period.kind === 'mes' ? (period.running ? 'mês em andamento' : '') : KIND_NOTE[period.kind] || '');

// Do que é o "N dos M" da linha do filtro da lista.
const BASE_NOUN = Object.freeze({
  'visitas-e-aulas': ['agendamento do período', 'agendamentos do período'],
  parados: ['lead parado', 'leads parados'],
});
const DEFAULT_NOUN = ['lead do período', 'leads do período'];

/**
 * A ficha da folha: os campos do topo, a linha do filtro da lista, a nota ao
 * lado do número da lista e a linha de quem gerou. Pura.
 *
 * @param {object} p
 * @param {string} p.secao O submenu.
 * @param {object} p.report O relatório na tela (cut, cutLabel, rows; em Leads parados, at e dias).
 * @param {object|null} p.period O período da barra. Null em Leads parados.
 * @param {object} [p.listWindow] As datas que a lista cobre, quando não são as do período (as Visitas e aulas vão até o fim dele).
 * @param {number} p.baseTotal Quantos a lista teria sem o filtro dela.
 * @param {string} p.consultor "Equipe toda" ou os nomes escolhidos.
 * @param {string|null} p.origem A origem da barra, ou null.
 * @param {string|null} p.funil O nome do funil da barra, ou null.
 * @param {string} p.academy O nome da academia ('' quando não há).
 * @param {string} p.author Quem imprime ('' quando não há nome).
 * @param {Date} p.at A hora do clique.
 */
export function printSheetOf({ secao, report, period, listWindow = period, baseTotal, consultor, origem, funil, academy, author, at }) {
  const fields = period
    ? [
      { label: 'Período', value: longRangeText(listWindow.start, listWindow.end), note: periodNote(period) },
      { label: 'Consultor', value: consultor },
      { label: 'Origem', value: origem || 'Todas' },
      { label: 'Funil', value: funil || 'Todos' },
    ]
    : [
      { label: 'Retrato de', value: atText(report.at) },
      { label: 'Sem registro há mais de', value: plural(report.dias, 'dia', 'dias') },
      { label: 'Consultor', value: consultor },
      { label: 'Origem e funil', value: `${origem || 'Todas'}, ${funil || 'todos'}` },
    ];
  const [one, many] = BASE_NOUN[secao] ?? DEFAULT_NOUN;
  const n = report.rows.length;
  const cutLine = report.cutLabel
    ? { value: report.cutLabel, note: `${fmtNum(n)} ${baseTotal === 1 ? 'de' : 'dos'} ${fmtNum(baseTotal)} ${baseTotal === 1 ? one : many}` }
    : null;
  const prefix = report.cut ? CUT_PREFIX[report.cut.slice(0, report.cut.indexOf(':'))] : null;
  const listNote = report.cutLabel
    ? (prefix ? `Lista filtrada por ${prefix.toLowerCase()}` : `Lista filtrada: ${report.cutLabel}`)
    : secao === 'parados' ? 'Quem está há mais dias sem registro vem primeiro' : 'Lista completa, sem filtro';
  const generated = `Gerado pelo Stronilead em ${atText(at)}${author ? ` por ${author}` : ''}`;
  return { fields, cutLine, listNote, generated, academy };
}
