// Relatório exportável (PDF via impressão + CSV) da tela de Visitas/Aulas
// (AppointmentTrackingView). Lógica pura e testada — o modal
// (modals/AppointmentExportModal.jsx) só busca os leads do período escolhido
// e chama estas funções; nenhuma regra de filtro/formatação mora no modal.
import { getLeadAppointmentDate, getAppointmentOutcomeMeta } from './leads.js';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL } from './professores.js';
import { getTrialPassNote } from './freePass.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Desfecho do relatório: 4 opções (decisão do Johnny no spec), mapeadas para
// os valores REAIS de lead.appointmentOutcome. 'rescheduled' nunca persiste no
// lead (DailyGoalView zera appointmentOutcome ao remarcar — só fica na
// interaction, fora do escopo deste relatório) — por isso não tem opção
// própria; sem outcome (null/undefined) cai em 'scheduled' (Agendado).
export const REPORT_OUTCOME_OPTIONS = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'attended', label: 'Compareceu' },
  { value: 'no_show', label: 'Faltou' },
  { value: 'cancelled', label: 'Cancelou' },
];

const outcomeKey = (lead) => {
  const o = lead?.appointmentOutcome;
  return (o === 'attended' || o === 'no_show' || o === 'cancelled') ? o : 'scheduled';
};

const outcomeLabel = (lead) => {
  const meta = lead?.appointmentOutcome ? getAppointmentOutcomeMeta(lead.appointmentOutcome) : null;
  return meta ? meta.label : 'Agendado';
};

// Colunas do relatório (Nome, Objetivo/Dor, Data marcada, [Aulas: Professor,
// Modalidade, Passe], Desfecho, Responsável) — mesma ordem usada no CSV e na
// tabela impressa.
export function getReportColumns(isAula) {
  const cols = [
    { key: 'nome', label: 'Nome' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'objetivo', label: 'Objetivo/Dor' },
    { key: 'dataMarcada', label: 'Data marcada' },
  ];
  if (isAula) {
    cols.push({ key: 'professor', label: 'Professor' });
    cols.push({ key: 'modalidade', label: 'Modalidade' });
    cols.push({ key: 'passe', label: 'Passe' });
  }
  cols.push({ key: 'desfecho', label: 'Desfecho' });
  cols.push({ key: 'responsavel', label: 'Responsável' });
  return cols;
}

const fmtDataMarcada = (d) =>
  d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// buildReportRows(leads, { isAula, filters, now }) — aplica os filtros do
// modal (período por appointmentScheduledFor, responsável por consultantId,
// professor por appointmentProfessorId/SOLO_TRAINING, modalidade por
// appointmentModality, desfecho por appointmentOutcome) e devolve linhas já
// formatadas pra tabela/CSV. `filters` (todo array vazio = sem filtro nesse
// campo, igual ao padrão dos filtros da tela):
//   { start: Date|null, end: Date|null, respIds: string[], profIds: string[],
//     modalities: string[], outcomes: string[] }
export function buildReportRows(leads, { isAula = false, filters = {}, now = new Date() } = {}) {
  const { start = null, end = null, respIds = [], profIds = [], modalities = [], outcomes = [] } = filters;
  const startMs = start ? startOfDay(start).getTime() : null;
  const endMs = end ? startOfDay(end).getTime() + DAY_MS : null;

  return (leads || [])
    .map((lead) => ({ lead, d: getLeadAppointmentDate(lead) }))
    .filter(({ d }) => Boolean(d))
    .filter(({ lead, d }) => {
      const t = d.getTime();
      if (startMs != null && t < startMs) return false;
      if (endMs != null && t >= endMs) return false;
      if (respIds.length > 0 && !respIds.includes(lead.consultantId)) return false;
      if (isAula && profIds.length > 0) {
        const matches = lead.appointmentSoloTraining
          ? profIds.includes(SOLO_TRAINING)
          : Boolean(lead.appointmentProfessorId) && profIds.includes(lead.appointmentProfessorId);
        if (!matches) return false;
      }
      if (isAula && modalities.length > 0 && !modalities.includes(lead.appointmentModality)) return false;
      if (outcomes.length > 0 && !outcomes.includes(outcomeKey(lead))) return false;
      return true;
    })
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map(({ lead, d }) => {
      const row = {
        nome: lead.name || '',
        telefone: lead.whatsapp || '—',
        objetivo: lead.dor || '—',
        dataMarcada: fmtDataMarcada(d),
      };
      if (isAula) {
        row.professor = lead.appointmentSoloTraining ? SOLO_TRAINING_LABEL : (lead.appointmentProfessorName || '—');
        row.modalidade = lead.appointmentModality || '—';
        const pass = getTrialPassNote(lead, now);
        row.passe = pass ? pass.text : '—';
      }
      row.desfecho = outcomeLabel(lead);
      row.responsavel = lead.consultantName || '—';
      return row;
    });
}

// rowsToCsv(rows, columns) — separador ';' (Excel pt-BR). O BOM UTF-8 fica a
// cargo de quem monta o Blob (mantém esta função testável como texto puro).
export function rowsToCsv(rows, columns) {
  const esc = (val) => {
    const s = String(val ?? '');
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(';');
  const lines = (rows || []).map((r) => columns.map((c) => esc(r[c.key])).join(';'));
  return [header, ...lines].join('\r\n');
}

const escHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// buildReportHtml({ title, subheading, columns, rows }) — HTML autocontido
// (estilo inline) pra abrir numa aba nova e chamar window.print(). Sem lib de
// PDF: o usuário imprime ou "Salvar como PDF" pelo próprio navegador.
export function buildReportHtml({ title, subheading, columns, rows }) {
  const thead = columns.map((c) => `<th>${escHtml(c.label)}</th>`).join('');
  const tbody = (rows || [])
    .map((r) => `<tr>${columns.map((c) => `<td>${escHtml(r[c.key])}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 28px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subheading { font-size: 12px; color: #475569; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  .empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; }
  @media print { body { margin: 12px; } }
</style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  <p class="subheading">${escHtml(subheading)}</p>
  ${rows && rows.length > 0
    ? `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
    : `<p class="empty">Nenhum registro encontrado para os filtros aplicados.</p>`}
</body>
</html>`;
}
