import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { SettingsSectionHeader, SettingsPanel } from '../../components/ui/SettingsCard.jsx';
import { SettingsBtn, PanelNote, EmptyState } from './settingsBits.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { cn } from '../../lib/utils.js';
import { readSpreadsheetFile } from '../../lib/spreadsheetRead.js';
import { TARGET_FIELDS, TARGET_GROUP_LABEL, detectPreset, buildMapping, importSourceLabel } from '../../lib/importPresets.js';
import {
  parseRow, dedupeInFile, enrichCandidate, distinctPlanNames, resolveMatch, classifyCandidate,
  buildImportedClientWrites, summarizeOutcomes, buildReportCsv,
  OUTCOME, OUTCOME_LABEL, WRITABLE_OUTCOMES, SCOPE, PLAN_AS_TEXT
} from '../../lib/clientImport.js';
import { lookupExisting, runImport } from '../../lib/clientImportWrites.js';
import { getDefaultFunnel, isSystemFunnel } from '../../lib/funnels.js';
import { normalizeExpiredWindowDays } from '../../lib/expiredGoal.js';
import { deriveLeadState, getTone } from '../../lib/leadState.js';

// ==========================================
// IMPORTAR CLIENTES: quatro passos, só na sessão assumida do super console.
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md
//
// Arquivo → Mapeamento → Revisão (ensaio completo, sem gravar) → Importar.
// Toda regra mora em src/lib/clientImport.js; aqui é só estado, handlers e
// tela. Nada de useEffect: leitura do arquivo, consultas e gravação rodam nos
// handlers dos botões, e o que é derivado sai de useMemo.
// ==========================================

const STEPS = ['Arquivo', 'Mapeamento', 'Revisão', 'Importar'];
const NONE = '__none__';
const AUTO = '__auto__';
const UNDECIDED = '__undecided__';

// Fora de contexto seguro (preview por IP em http) crypto.randomUUID não existe.
const newBatchId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const COUNTER_TONE = {
  criar: 'emerald', promover: 'emerald', registrar_contrato: 'brand', atualizar: 'teal',
  sem_alteracao: 'slate', conflito: 'rose', suspeita: 'amber', invalida: 'rose',
  fora_do_escopo: 'slate', duplicada_no_arquivo: 'slate', erro: 'rose'
};

const COUNTER_ORDER = [
  OUTCOME.CRIAR, OUTCOME.PROMOVER, OUTCOME.REGISTRAR_CONTRATO, OUTCOME.ATUALIZAR, OUTCOME.SEM_ALTERACAO,
  OUTCOME.SUSPEITA, OUTCOME.CONFLITO, OUTCOME.INVALIDA, OUTCOME.DUPLICADA, OUTCOME.FORA_DO_ESCOPO, OUTCOME.ERRO
];

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[12px]">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              'size-6 rounded-full grid place-items-center text-[11px] font-bold',
              state === 'current' && 'bg-brand-600 text-white',
              state === 'done' && 'bg-emerald-500 text-white',
              state === 'todo' && 'bg-muted text-muted-foreground'
            )}>
              {state === 'done' ? <CheckCircle2 size={13} /> : n}
            </span>
            <span className={cn('font-semibold', state === 'todo' && 'text-muted-foreground')}>{label}</span>
            {n < STEPS.length && <span className="w-6 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Counter({ label, value, tone }) {
  const t = getTone(tone);
  return (
    <div className={cn('rounded-xl border border-border px-3 py-2.5 min-w-0', value > 0 ? t.soft : 'bg-card', value > 0 && t.darkSoft)}>
      <div className={cn('text-[22px] font-display font-bold leading-none num', value > 0 ? cn(t.text, t.darkText) : 'text-muted-foreground')}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
    </div>
  );
}

const REPORT_ROWS_MAX = 200;

function ReportTable({ results }) {
  const shown = results.slice(0, REPORT_ROWS_MAX);
  return (
    <div className="px-5 pb-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_1fr_1.4fr] gap-3 px-3 py-2 bg-muted/60 text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
          <span>Linha</span><span>Nome</span><span>Resultado</span><span>Motivo</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {shown.map(({ c, cls }) => {
            const t = getTone(COUNTER_TONE[cls.outcome] || 'slate');
            return (
              <div key={c.rowNumber} className="grid grid-cols-[56px_1fr_1fr_1.4fr] gap-3 px-3 py-1.5 text-[12px] border-t border-border">
                <span className="num text-muted-foreground">{c.rowNumber}</span>
                <span className="truncate font-medium">{c.name || '(sem nome)'}</span>
                <span className={cn('truncate', t.text, t.darkText)}>{OUTCOME_LABEL[cls.outcome] || cls.outcome}</span>
                <span className="truncate text-muted-foreground">{cls.reason || ''}</span>
              </div>
            );
          })}
        </div>
      </div>
      {results.length > REPORT_ROWS_MAX && (
        <div className="text-[11px] text-muted-foreground mt-2">Mostrando {REPORT_ROWS_MAX} de {results.length} linhas. O CSV traz todas.</div>
      )}
    </div>
  );
}

// O instante vem de quem chama, nunca do relógio no render.
const leadStateLabel = (lead, now) => deriveLeadState(lead, now).label;

function ImportClientsSection({ db, appUser, usersList, funnels, planos }) {
  const toast = useToast();
  const { professores, renewalGraceDays } = useGeneralConfig();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);            // { name, headers, rows, preset }
  const [mapping, setMapping] = useState({});
  const [planMap, setPlanMap] = useState({});        // { [nomeNormalizado]: planId | PLAN_AS_TEXT }
  const [defaultConsultantId, setDefaultConsultantId] = useState('');
  const [scope, setScope] = useState(SCOPE.PADRAO);
  const [review, setReview] = useState(null);        // { base: [{ c, match }], now }
  const [decisions, setDecisions] = useState({});    // { [rowNumber]: 'create' | leadId }
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState(null);        // { results, summary, failedFromRow, error, batchId }

  const consultants = usersList || [];
  const defaultConsultant = consultants.find((u) => u.id === defaultConsultantId) || null;
  const windowDays = normalizeExpiredWindowDays(renewalGraceDays);
  const funnelId = getDefaultFunnel((funnels || []).filter((f) => !isSystemFunnel(f)))?.id || null;
  const sourceLabel = importSourceLabel(file?.preset);

  // Nomes de plano da planilha, para a tabela de mapeamento de planos. Lê só
  // a coluna mapeada: não precisa do parse completo da linha.
  const planNames = useMemo(
    () => (file && mapping.planName ? distinctPlanNames(file.rows.map((r) => ({ planName: r[mapping.planName] }))) : []),
    [file, mapping.planName]
  );

  // Classificação reativa às decisões de suspeita (a revisão em si, com as
  // consultas, só roda no botão). `review.now` é o instante congelado do
  // ensaio: gravar com o mesmo `now` mantém escopo e relatório coerentes.
  //
  // Duas linhas do arquivo podem casar com o MESMO cadastro (uma pelo CPF,
  // outra pelo telefone). A primeira fica; as outras viram conflito, senão o
  // batch gravaria o mesmo lead duas vezes e criaria dois contratos.
  const results = useMemo(() => {
    if (!review) return [];
    const claimed = new Map();
    return review.base.map(({ c, match }) => {
      let cls = classifyCandidate(c, match, { decision: decisions[c.rowNumber], scope, now: review.now, windowDays });
      const leadId = cls.lead?.id;
      if (leadId && WRITABLE_OUTCOMES.includes(cls.outcome)) {
        const first = claimed.get(leadId);
        if (first) cls = { ...cls, outcome: OUTCOME.CONFLITO, reason: `Outra linha do arquivo já casou com este cadastro (linha ${first})`, fill: null, createContract: false };
        else claimed.set(leadId, c.rowNumber);
      }
      return { c, match, cls };
    });
  }, [review, decisions, scope, windowDays]);
  const summary = useMemo(() => summarizeOutcomes(results), [results]);
  const suspects = results.filter((r) => r.cls.outcome === OUTCOME.SUSPEITA || (r.match.kind === 'name' && decisions[r.c.rowNumber]));
  const conflicts = results.filter((r) => r.cls.outcome === OUTCOME.CONFLITO);
  const invalids = results.filter((r) => r.cls.outcome === OUTCOME.INVALIDA);

  // Mantém consultor padrão e escopo de propósito: a rodada 2 (contratos) usa os mesmos.
  const resetAll = () => {
    if (report && !window.confirm('Descartar o relatório desta importação? Baixe o CSV antes, se precisar.')) return;
    setStep(1); setFile(null); setMapping({}); setPlanMap({}); setReview(null);
    setDecisions({}); setReport(null); setProgress({ done: 0, total: 0 });
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const { headers, rows } = await readSpreadsheetFile(f);
      if (!headers.length || !rows.length) { toast.error('A planilha não tem cabeçalho ou não tem linhas.'); return; }
      const preset = detectPreset(headers);
      setFile({ name: f.name, headers, rows, preset });
      setMapping(buildMapping(headers, preset));
      setPlanMap({}); setReview(null); setDecisions({}); setReport(null);
      setStep(2);
      toast.success(preset ? `${preset.label} detectado: ${rows.length} linhas.` : `${rows.length} linhas lidas. Confira o mapeamento.`);
    } catch (err) {
      console.error('readSpreadsheetFile', err);
      toast.error('Não consegui ler o arquivo. Use .xlsx ou .csv exportado do sistema.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const runReview = async () => {
    if (!mapping.name) { toast.warning('Mapeie ao menos a coluna do nome.'); return; }
    if (!defaultConsultant) { toast.warning('Escolha o consultor padrão.'); return; }
    if (!funnelId) { toast.warning('A academia não tem funil. Crie um em Funis & etapas.'); return; }
    setBusy(true);
    try {
      const now = new Date();
      const parsed = file.rows.map((r) => parseRow(r, mapping, r.__row, now));
      const { kept, duplicates } = dedupeInFile(parsed);
      const enrich = (c) => enrichCandidate(c, { usersList: consultants, professores, planos, planMap });
      const keptEnriched = kept.map(enrich);
      const index = await lookupExisting({ db, candidates: keptEnriched });
      const base = [...keptEnriched, ...duplicates.map(enrich)]
        .map((c) => ({ c, match: resolveMatch(c, index) }))
        .sort((a, b) => a.c.rowNumber - b.c.rowNumber);
      setReview({ base, now });
      setDecisions({});
      setReport(null);
      setStep(3);
    } catch (err) {
      console.error('runReview', err);
      toast.error(err?.code === 'permission-denied'
        ? 'Sem permissão para ler a base desta academia.'
        : 'Falha ao preparar a revisão. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const runImportNow = async () => {
    const writable = results.filter((r) => WRITABLE_OUTCOMES.includes(r.cls.outcome));
    if (!writable.length) { toast.info('Nada para gravar.'); return; }
    if (summary.suspeita > 0) { toast.warning('Decida as suspeitas por nome antes de importar.'); return; }
    if (!window.confirm(`Gravar ${writable.length} cadastro(s) na base desta academia?\n\nO que já existe é promovido, não recriado. Esta ação não pode ser desfeita.`)) return;

    setBusy(true);
    try {
      const importMeta = {
        importedBy: appUser?.authUid || appUser?.id || null,
        importSource: file.preset?.id || 'manual',
        sourceLabel,
        importBatchId: newBatchId(),
        now: review.now
      };
      const items = writable.map(({ c, cls }) => ({
        rowNumber: c.rowNumber,
        ...buildImportedClientWrites({ c, cls, consultant: c.consultant || defaultConsultant, funnelId, importMeta, now: review.now })
      }));
      setProgress({ done: 0, total: items.length });
      setStep(4);

      const res = await runImport({ db, appUser, items, importMeta, onProgress: (done, total) => setProgress({ done, total }) });

      const writtenRows = new Set(items.slice(0, res.done).map((i) => i.rowNumber));
      const finalResults = results.map((r) => {
        if (!WRITABLE_OUTCOMES.includes(r.cls.outcome)) return r;
        if (writtenRows.has(r.c.rowNumber)) return { ...r, written: true };
        return { ...r, cls: { ...r.cls, outcome: OUTCOME.ERRO, reason: res.failedFromRow ? `Não gravada (falha a partir da linha ${res.failedFromRow})` : 'Não gravada' } };
      });
      setReport({ results: finalResults, summary: summarizeOutcomes(finalResults), failedFromRow: res.failedFromRow, error: res.error, batchId: importMeta.importBatchId });

      if (res.error) {
        console.error('runImport', res.error);
        toast.error(res.error?.code === 'permission-denied'
          ? 'Gravação negada pelo Firestore. Confira se a academia está ativa e se a sessão é de admin.'
          : 'A gravação parou no meio. Rode o mesmo arquivo de novo: o que já entrou conta como sem alteração.');
      } else {
        toast.success(`${res.done} cadastro(s) gravado(s).`);
      }
    } catch (err) {
      console.error('runImportNow', err);
      toast.error('Falha ao preparar a gravação. Confira o arquivo e tente de novo.');
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    const csv = buildReportCsv(report.results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `importacao-${file.name.replace(/\.[^.]+$/, '')}-${review.now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const setMappingField = (field, header) => setMapping((m) => ({ ...m, [field]: header === NONE ? null : header }));
  const setPlanMapKey = (key, value) => setPlanMap((m) => {
    const next = { ...m };
    if (value === AUTO) delete next[key];
    else next[key] = value;
    return next;
  });
  const setDecision = (rowNumber, value) => setDecisions((d) => {
    const next = { ...d };
    if (value === UNDECIDED) delete next[rowNumber];
    else next[rowNumber] = value;
    return next;
  });

  const groupedFields = ['pessoa', 'endereco', 'contrato'].map((g) => ({ id: g, label: TARGET_GROUP_LABEL[g], fields: TARGET_FIELDS.filter((f) => f.group === g) }));

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Importar clientes"
        hint="Traga os alunos ativos de outro sistema de gestão. Quem já existe é promovido, não duplicado."
      >
        {step > 1 && !busy && <SettingsBtn kind="soft" onClick={resetAll}>Recomeçar</SettingsBtn>}
      </SettingsSectionHeader>

      <Stepper step={step} />

      {step === 1 && (
        <SettingsPanel icon={<FileSpreadsheet size={16} />} iconTone="brand" title="1. Arquivo" hint="Exportação de clientes ou de contratos, em .xlsx ou .csv.">
          <div className="px-5 pb-5">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[14px] border border-dashed border-border p-8 text-center transition hover:border-brand-600 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 disabled:opacity-50"
            >
              {busy ? <Loader2 size={22} className="mx-auto animate-spin text-brand-600" /> : <Upload size={22} className="mx-auto text-brand-600" />}
              <div className="mt-2 text-[13.5px] font-semibold">{busy ? 'Lendo a planilha…' : 'Escolher arquivo'}</div>
              <div className="text-[12px] text-muted-foreground mt-1">NextFit é reconhecido sozinho. Outros sistemas passam pelo mapeamento manual.</div>
            </button>
          </div>
          <PanelNote>A vigência (início, fim e valor) costuma vir no relatório de contratos, separado do cadastro. Suba os dois, um de cada vez: o segundo casa por CPF e só pendura o contrato.</PanelNote>
        </SettingsPanel>
      )}

      {step === 2 && file && (
        <>
          <SettingsPanel icon={<FileSpreadsheet size={16} />} iconTone="brand" title="2. Mapeamento" hint={`${file.name} · ${file.rows.length} linhas · ${file.preset ? `preset ${file.preset.label}` : 'sem preset, mapeamento manual'}`}>
            <div className="px-5 pb-4 flex flex-col gap-4">
              {groupedFields.map((g) => (
                <div key={g.id}>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground mb-2">{g.label}</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.fields.map((f) => (
                      <label key={f.id} className="flex flex-col gap-1 min-w-0">
                        <span className={cn('text-[11.5px] font-semibold truncate', f.required && !mapping[f.id] && 'text-rose-600')}>
                          {f.label}{f.required ? ' *' : ''}
                        </span>
                        <Select value={mapping[f.id] || NONE} onValueChange={(v) => setMappingField(f.id, v)}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Sem coluna" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Sem coluna</SelectItem>
                            {file.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SettingsPanel>

          <SettingsPanel title="Planos da planilha" hint="Casa cada nome com um plano do catálogo. Sem correspondência, o nome fica como texto e o contrato nasce sem plano.">
            {planNames.length === 0
              ? <EmptyState>Nenhuma coluna de plano mapeada, ou a planilha não traz plano.</EmptyState>
              : (
                <div className="px-5 pb-4 flex flex-col gap-2">
                  {planNames.map((p) => (
                    <div key={p.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{p.label}</div><div className="text-[11px] text-muted-foreground num">{p.count} {p.count === 1 ? 'linha' : 'linhas'}</div></div>
                      <span className="text-muted-foreground text-[12px]">→</span>
                      <Select value={planMap[p.key] || AUTO} onValueChange={(v) => setPlanMapKey(p.key, v)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO}>Automático (mesmo nome)</SelectItem>
                          <SelectItem value={PLAN_AS_TEXT}>Manter como texto</SelectItem>
                          {(planos || []).map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name} · {pl.durationMonths} {Number(pl.durationMonths) === 1 ? 'mês' : 'meses'}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
          </SettingsPanel>

          <SettingsPanel title="Consultor padrão e escopo">
            <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold">Consultor padrão *</span>
                <Select value={defaultConsultantId || NONE} onValueChange={(v) => setDefaultConsultantId(v === NONE ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Selecione</SelectItem>
                    {consultants.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">Recebe as linhas cujo consultor não bate com ninguém da equipe.</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold">O que entra</span>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SCOPE.PADRAO}>Ativos e vencidos há até {windowDays} dias</SelectItem>
                    <SelectItem value={SCOPE.TODOS}>Todos (inclui cancelados e inativos antigos)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">O padrão é quem os funis de Renovações e Vencidos querem no dia um.</span>
              </label>
            </div>
            <div className="px-5 pb-5 flex justify-end">
              <SettingsBtn kind="primary" disabled={busy || !mapping.name || !defaultConsultant} onClick={runReview} icon={busy ? <Loader2 size={14} className="animate-spin" /> : null}>
                {busy ? 'Consultando a base…' : 'Revisar antes de gravar'}
              </SettingsBtn>
            </div>
          </SettingsPanel>
        </>
      )}

      {step === 3 && review && (
        <>
          <SettingsPanel title="3. Revisão" hint="Ensaio completo. Nada foi gravado ainda.">
            <div className="px-5 pb-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {COUNTER_ORDER.filter((k) => k !== OUTCOME.ERRO).map((k) => <Counter key={k} label={OUTCOME_LABEL[k]} value={summary[k] || 0} tone={COUNTER_TONE[k]} />)}
              <Counter label="Sem vigência" value={summary.semVigencia} tone="amber" />
            </div>
            {(summary.semVigencia > 0 || summary.planosForaDoCatalogo.length > 0 || summary.consultoresNaoReconhecidos.length > 0 || summary.avisos > 0) && (
              <div className="px-5 pb-4 flex flex-col gap-1.5 text-[12px]">
                {summary.semVigencia > 0 && <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle size={14} className="shrink-0 mt-px" /><span>{summary.semVigencia} cliente(s) sem vigência: não entram em Renovações nem em Vencidos até alguém registrar o contrato.</span></div>}
                {summary.planosForaDoCatalogo.length > 0 && <div className="text-muted-foreground">{summary.planosForaDoCatalogo.length} plano(s) fora do catálogo: {summary.planosForaDoCatalogo.join(', ')}.</div>}
                {summary.consultoresNaoReconhecidos.length > 0 && <div className="text-muted-foreground">Consultor não reconhecido (vai para {defaultConsultant?.name}): {summary.consultoresNaoReconhecidos.join(', ')}.</div>}
                {summary.avisos > 0 && <div className="text-muted-foreground">{summary.avisos} linha(s) com aviso (CPF inválido, data ilegível, sem data histórica). Aparecem no relatório.</div>}
              </div>
            )}
          </SettingsPanel>

          {suspects.length > 0 && (
            <SettingsPanel title="Suspeitas por nome" hint="Sem CPF nem telefone em comum, mas o nome já existe na base. Decida linha a linha.">
              <div className="px-5 pb-4 flex flex-col gap-2">
                {suspects.map(({ c, match }) => (
                  <div key={c.rowNumber} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 text-[12.5px]">
                    <span className="num text-muted-foreground">L{c.rowNumber}</span>
                    <span className="font-semibold truncate">{c.name}</span>
                    <Select value={decisions[c.rowNumber] || UNDECIDED} onValueChange={(v) => setDecision(c.rowNumber, v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNDECIDED}>Escolha o que fazer</SelectItem>
                        <SelectItem value="create">Criar cadastro novo</SelectItem>
                        {match.homonyms.map((h) => (
                          <SelectItem key={h.id} value={h.id}>Usar: {h.name} · {leadStateLabel(h, review.now)}{h.consultantName ? ` · ${h.consultantName}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <PanelNote>Nada aqui é gravado até você confirmar. Linha sem decisão segura a importação até você escolher.</PanelNote>
            </SettingsPanel>
          )}

          {conflicts.length > 0 && (
            <SettingsPanel title="Conflitos (pulados)" hint="Contrato com vigência diferente, ou CPF divergente no mesmo telefone. Resolva na ficha e rode de novo.">
              <div className="px-5 pb-4 flex flex-col gap-1 text-[12.5px]">
                {conflicts.slice(0, 50).map(({ c, cls }) => (
                  <div key={c.rowNumber} className="grid grid-cols-[auto_1fr_1fr] gap-3"><span className="num text-muted-foreground">L{c.rowNumber}</span><span className="font-semibold truncate">{c.name}</span><span className="text-muted-foreground truncate">{cls.reason}</span></div>
                ))}
                {conflicts.length > 50 && <div className="text-[11px] text-muted-foreground">E mais {conflicts.length - 50} no relatório.</div>}
              </div>
            </SettingsPanel>
          )}

          {invalids.length > 0 && (
            <SettingsPanel title="Linhas inválidas" hint="Sem nome, ou sem CPF válido e sem telefone válido. Não casam nem nascem.">
              <div className="px-5 pb-4 flex flex-col gap-1 text-[12.5px]">
                {invalids.slice(0, 50).map(({ c, cls }) => (
                  <div key={c.rowNumber} className="grid grid-cols-[auto_1fr_1fr] gap-3"><span className="num text-muted-foreground">L{c.rowNumber}</span><span className="font-semibold truncate">{c.name || '(sem nome)'}</span><span className="text-muted-foreground truncate">{cls.reason}</span></div>
                ))}
                {invalids.length > 50 && <div className="text-[11px] text-muted-foreground">E mais {invalids.length - 50} no relatório.</div>}
              </div>
            </SettingsPanel>
          )}

          <div className="flex items-center justify-between gap-3">
            <SettingsBtn kind="soft" disabled={busy} onClick={() => { setReview(null); setDecisions({}); setStep(2); }}>Voltar ao mapeamento</SettingsBtn>
            <SettingsBtn kind="primary" disabled={busy || summary.gravaveis === 0} onClick={runImportNow}>
              Importar {summary.gravaveis} cadastro(s)
            </SettingsBtn>
          </div>
        </>
      )}

      {step === 4 && (
        <SettingsPanel title="4. Importar" hint={report ? (report.error ? 'A gravação parou no meio.' : 'Concluído.') : 'Gravando…'}>
          <div className="px-5 pb-4">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full transition-all', report?.error ? 'bg-rose-500' : 'bg-brand-600')} style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
            </div>
            <div className="text-[12px] text-muted-foreground mt-2 num">{progress.done} de {progress.total} linha(s) gravada(s)</div>
          </div>
          {report && (
            <>
              <div className="px-5 pb-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {COUNTER_ORDER.map((k) => <Counter key={k} label={OUTCOME_LABEL[k]} value={report.summary[k] || 0} tone={COUNTER_TONE[k]} />)}
                <Counter label="Sem vigência" value={report.summary.semVigencia} tone="amber" />
              </div>
              <ReportTable results={report.results} />
              <div className="px-5 pb-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground num">Lote {report.batchId}</span>
                <div className="flex gap-2">
                  <SettingsBtn kind="secondary" icon={<Download size={14} />} onClick={downloadReport}>Baixar relatório (CSV)</SettingsBtn>
                  <SettingsBtn kind="primary" onClick={resetAll}>Importar outro arquivo</SettingsBtn>
                </div>
              </div>
              <PanelNote>{report.error ? 'Rode o mesmo arquivo de novo: o que já entrou conta como "sem alteração" e só o que faltou é gravado.' : 'Confira Clientes, os funis Renovações e Vencidos e a coluna Venda do mês. O evento "Cadastro importado" fica atrás do interruptor Sistema na timeline.'}</PanelNote>
            </>
          )}
        </SettingsPanel>
      )}
    </div>
  );
}

export { ImportClientsSection };
