import { useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { FileDown, Printer, Users, Check } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { appointmentsInWindowQuerySpec } from '../lib/leadQueries.js';
import { specToConstraints } from '../hooks/usePagedLeads.js';
import { getLeadAppointmentDate, getLeadAppointmentType } from '../lib/leads.js';
import { fromDateInputValue, toDateInputValue } from '../lib/dates.js';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL } from '../lib/professores.js';
import { REPORT_OUTCOME_OPTIONS, getReportColumns, buildReportRows, rowsToCsv, buildReportHtml } from '../lib/appointmentReport.js';
import { cn } from '../lib/utils.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Field, StyledInput } from '../components/ui/Field.jsx';
import { Btn } from '../components/ui/Btn.jsx';

// ==========================================================================
// EXPORTAR RELATÓRIO (Visitas/Aulas) — PDF (impressão) + CSV. Filtros PRÓPRIOS
// deste modal (não usam o recorte da tela): Período, Responsável, Professor
// (só Aulas), Modalidade (só Aulas), Desfecho. Busca sua PRÓPRIA janela via
// appointmentsInWindowQuerySpec (mesmo índice #5 da tela, sem índice novo) —
// o período do relatório pode ser bem maior que o que a tela tem carregado.
// Regra de filtro/formatação mora em lib/appointmentReport.js (testado); aqui
// é só UI + fetch + acionar impressão/download.
// ==========================================================================

const DAY_MS = 86400000;

function ToggleRow({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-[7px] rounded-[9px] text-left transition-colors',
        selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
      )}
    >
      <span className={cn('flex-1 text-[12.5px] truncate text-gray-900 dark:text-white', selected ? 'font-bold' : 'font-medium')}>
        {label}
      </span>
      {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
    </button>
  );
}

function MultiSelectGroup({ title, options, selected, onToggle }) {
  if (!options.length) return null;
  return (
    <div>
      <div className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
        {title}
      </div>
      <div className="max-h-[136px] overflow-y-auto thin-scroll rounded-[9px] border border-slate-100 dark:border-white/[0.06] p-1">
        {options.map((o) => (
          <ToggleRow key={o.value} label={o.label} selected={selected.includes(o.value)} onClick={() => onToggle(o.value)} />
        ))}
      </div>
    </div>
  );
}

const fmtShort = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function AppointmentExportModal({ open, onClose, db, appointmentType, isAula, isAdmin, usersList }) {
  const toast = useToast();
  const { professores, modalities } = useGeneralConfig();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [draftStart, setDraftStart] = useState(() => toDateInputValue(monthStart));
  const [draftEnd, setDraftEnd] = useState(() => toDateInputValue(today));
  const [respIds, setRespIds] = useState([]);
  const [profIds, setProfIds] = useState([]);
  const [modalityNames, setModalityNames] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [busy, setBusy] = useState(null); // null | 'print' | 'csv'

  const toggle = (setter) => (value) =>
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));

  const respOptions = (usersList || []).map((u) => ({ value: u.id, label: u.name }));
  const profOptions = [
    ...(professores || []).map((p) => ({ value: p.id, label: p.nome })),
    { value: SOLO_TRAINING, label: SOLO_TRAINING_LABEL },
  ];
  const modalityOptions = (modalities || []).map((m) => ({ value: m.name, label: m.name }));

  const buildSubheading = (start, end) => {
    const parts = [`${fmtShort(start)} – ${fmtShort(end)}`];
    parts.push(respIds.length > 0 ? `${respIds.length} responsável${respIds.length > 1 ? 'is' : ''}` : 'Toda a equipe');
    if (isAula) {
      parts.push(profIds.length > 0 ? `${profIds.length} professor${profIds.length > 1 ? 'es' : ''}` : 'Todos os professores');
      parts.push(modalityNames.length > 0 ? modalityNames.join(', ') : 'Todas as modalidades');
    }
    parts.push(
      outcomes.length > 0
        ? outcomes.map((o) => REPORT_OUTCOME_OPTIONS.find((opt) => opt.value === o)?.label || o).join(', ')
        : 'Todos os desfechos'
    );
    return parts.join(' · ');
  };

  // Busca a JANELA do período escolhido (índice #5, mesmo mecanismo da tela) e
  // aplica os demais filtros client-side via buildReportRows.
  const fetchRows = async () => {
    const start = fromDateInputValue(draftStart);
    const end = fromDateInputValue(draftEnd);
    if (!start || !end) {
      toast.warning('Informe o período (de/até).');
      return null;
    }
    if (end.getTime() < start.getTime()) {
      toast.warning('O fim precisa ser depois do início.');
      return null;
    }
    try {
      const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() + DAY_MS;
      const spec = appointmentsInWindowQuerySpec(appointmentType, startMs, endMs);
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
      const snap = await getDocs(query(colRef, ...specToConstraints(spec)));
      const leads = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((l) => getLeadAppointmentType(l) === appointmentType && getLeadAppointmentDate(l));
      const rows = buildReportRows(leads, {
        isAula,
        now: new Date(),
        filters: { start, end, respIds, profIds, modalities: modalityNames, outcomes },
      });
      return { rows, subheading: buildSubheading(start, end) };
    } catch (e) {
      console.error('AppointmentExportModal fetchRows', e);
      toast.error('Não foi possível gerar o relatório. Tente novamente.');
      return null;
    }
  };

  const handlePrint = async () => {
    if (busy) return;
    setBusy('print');
    try {
      const result = await fetchRows();
      if (!result) return;
      const columns = getReportColumns(isAula);
      const html = buildReportHtml({
        title: isAula ? 'Aulas experimentais' : 'Visitas',
        subheading: result.subheading,
        columns,
        rows: result.rows,
      });
      const win = window.open('', '_blank');
      if (!win) {
        toast.error('Pop-up bloqueado. Permita pop-ups para imprimir o relatório.');
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadCsv = async () => {
    if (busy) return;
    setBusy('csv');
    try {
      const result = await fetchRows();
      if (!result) return;
      const columns = getReportColumns(isAula);
      const csv = rowsToCsv(result.rows, columns);
      // BOM UTF-8 explícito — sem ele o Excel pt-BR pode abrir o CSV
      // com acentuação quebrada.
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isAula ? 'aulas' : 'visitas'}_${draftStart}_a_${draftEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="z-[210] w-full sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]" overlayClassName="z-[210]">
        <DialogHeader className="shrink-0 flex flex-row items-center gap-3 text-left px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <FileDown size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-bold tracking-tight leading-tight font-display">Exportar relatório</DialogTitle>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{isAula ? 'Aulas experimentais' : 'Visitas'}</p>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 overflow-y-auto thin-scroll space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="De" required>
              <StyledInput type="date" value={draftStart} max={draftEnd || undefined} onChange={(e) => setDraftStart(e.target.value)} />
            </Field>
            <Field label="Até" required>
              <StyledInput type="date" value={draftEnd} min={draftStart || undefined} onChange={(e) => setDraftEnd(e.target.value)} />
            </Field>
          </div>

          {/* Responsável só pra admin — consultor só enxerga os próprios leads
              (regra do Firestore), então filtrar por outro nome não muda nada. */}
          {isAdmin && (
            <MultiSelectGroup title="Responsável" options={respOptions} selected={respIds} onToggle={toggle(setRespIds)} />
          )}
          {isAdmin && respOptions.length === 0 && (
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500 inline-flex items-center gap-1.5"><Users className="size-[13px]" /> Nenhum responsável cadastrado.</p>
          )}

          {isAula && (
            <MultiSelectGroup title="Professor" options={profOptions} selected={profIds} onToggle={toggle(setProfIds)} />
          )}

          {isAula && (
            <MultiSelectGroup title="Modalidade" options={modalityOptions} selected={modalityNames} onToggle={toggle(setModalityNames)} />
          )}

          <MultiSelectGroup title="Desfecho" options={REPORT_OUTCOME_OPTIONS} selected={outcomes} onToggle={toggle(setOutcomes)} />
        </div>

        <div className="shrink-0 px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t border-slate-100 dark:border-white/[0.05]">
          <Btn kind="soft" size="md" onClick={onClose} disabled={Boolean(busy)}>Cancelar</Btn>
          <div className="flex-1" />
          <Btn kind="secondary" size="md" icon={<Printer size={14} />} onClick={handlePrint} disabled={Boolean(busy)}>
            {busy === 'print' ? 'Gerando…' : 'Imprimir / PDF'}
          </Btn>
          <Btn kind="brand" size="md" icon={<FileDown size={14} />} onClick={handleDownloadCsv} disabled={Boolean(busy)}>
            {busy === 'csv' ? 'Gerando…' : 'Baixar CSV'}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { AppointmentExportModal };
