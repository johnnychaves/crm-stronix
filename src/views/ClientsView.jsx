import { useMemo, useState, useDeferredValue } from 'react';
import { GraduationCap, Phone, Search, Layers } from 'lucide-react';
import { isLeadConverted } from '../lib/leads.js';
import { LIST_PAGE_SIZE } from '../lib/leadStatus.js';
import { deriveLeadContractStatus, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
import { ContractAVencerBadge } from '../components/ui/ContractAVencerBadge.jsx';
import { getSafeDateOrNull } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { StatPill } from '../components/ui/StatPill.jsx';

// Status "vivo" do CLIENTE a partir do resumo denormalizado no lead. Legados
// (Venda antiga sem contrato) não têm endsAt → 'sem_contrato'.
const SEM_CONTRATO = 'sem_contrato';
const clientStatus = (lead, now, threshold) =>
  deriveLeadContractStatus(lead, now, threshold) || SEM_CONTRATO;

const STATUS_TONE = {
  [CONTRACT_STATUS.ATIVO]:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  [CONTRACT_STATUS.A_VENCER]: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  [CONTRACT_STATUS.VENCIDO]:  'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  [CONTRACT_STATUS.CANCELADO]:'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400',
  [SEM_CONTRATO]:             'bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500'
};
const STATUS_LABEL = { ...CONTRACT_STATUS_LABEL, [SEM_CONTRATO]: 'Sem contrato' };

function ContractStatusBadge({ status }) {
  // "A vencer" mostra ambas as tags (Ativo + A vencer) — ver ContractAVencerBadge.
  if (status === CONTRACT_STATUS.A_VENCER) return <ContractAVencerBadge variant="tag" />;
  return (
    <span className={`inline-flex items-center px-2 h-6 rounded-md text-[11px] font-semibold ${STATUS_TONE[status] || STATUS_TONE[SEM_CONTRATO]}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// Pílula de filtro de status do contrato (segmentado, seleção única).
const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: CONTRACT_STATUS.ATIVO, label: 'Ativos' },
  { key: CONTRACT_STATUS.A_VENCER, label: 'A vencer' },
  { key: CONTRACT_STATUS.VENCIDO, label: 'Vencidos' },
  { key: CONTRACT_STATUS.CANCELADO, label: 'Cancelados' },
  { key: SEM_CONTRATO, label: 'Sem contrato' }
];

function ClientsView({ leads }) {
  const { contractThresholdDays } = useGeneralConfig();
  const { openProfile } = useLeadProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const deferredSearch = useDeferredValue(searchTerm);
  const now = new Date();

  // Clientes = matriculados. Opção 1: leads 'Venda' legados também entram
  // (aparecem como "Sem contrato"). A timeline é preservada (mesmo doc).
  const clientes = useMemo(
    () => (leads || []).filter(l => l.lifecycleStage === 'cliente' || isLeadConverted(l)),
    [leads]
  );

  // Planos distintos presentes nos clientes (para o seletor de filtro).
  const planNames = useMemo(() => {
    const set = new Set();
    clientes.forEach(c => { if (c.currentPlanName) set.add(c.currentPlanName); });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [clientes]);

  const filtered = useMemo(() => {
    const lower = deferredSearch.toLowerCase();
    const digits = deferredSearch.replace(/\D/g, '');
    return clientes.filter(c => {
      const matchSearch =
        (c.name || '').toLowerCase().includes(lower) ||
        (c.whatsapp || '').includes(deferredSearch) ||
        (digits && String(c.whatsapp || '').replace(/\D/g, '').includes(digits));
      const st = clientStatus(c, now, contractThresholdDays);
      const matchStatus = statusFilter === 'all' || st === statusFilter;
      const matchPlan = !planFilter || c.currentPlanName === planFilter;
      return matchSearch && matchStatus && matchPlan;
    }).sort((a, b) => {
      // Ordena por vencimento mais próximo primeiro; quem não tem vai ao fim.
      const ea = getSafeDateOrNull(a.currentContractEndsAt)?.getTime() ?? Infinity;
      const eb = getSafeDateOrNull(b.currentContractEndsAt)?.getTime() ?? Infinity;
      return ea - eb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, deferredSearch, statusFilter, planFilter, contractThresholdDays]);

  const visible = filtered.slice(0, visibleCount);

  // Contadores do hero.
  const counts = useMemo(() => {
    const c = { total: clientes.length, ativo: 0, a_vencer: 0, vencido: 0 };
    clientes.forEach(cl => {
      const st = clientStatus(cl, now, contractThresholdDays);
      if (st === CONTRACT_STATUS.ATIVO) c.ativo++;
      else if (st === CONTRACT_STATUS.A_VENCER) c.a_vencer++;
      else if (st === CONTRACT_STATUS.VENCIDO) c.vencido++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, contractThresholdDays]);

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in relative font-sans">
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <GraduationCap size={13} className="text-emerald-600" /> Clientes
          </div>
          <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">
            Alunos matriculados
          </h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Contratos, vencimentos e renovações dos seus clientes.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill label="Clientes" value={counts.total} accent="brand" />
          <StatPill label="Ativos" value={counts.ativo} accent="emerald" />
          <StatPill label="A vencer" value={counts.a_vencer} accent="amber" />
          <StatPill label="Vencidos" value={counts.vencido} accent="rose" />
        </div>
      </section>

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card shadow-card p-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-3 placeholder:text-slate-400 transition"
          />
        </div>
        {planNames.length > 0 && (
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] outline-none text-[13px] px-3 transition md:w-[200px] cursor-pointer"
          >
            <option value="">Todos os planos</option>
            {planNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {/* Segmented status filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`px-2.5 h-7 rounded-md text-[11.5px] font-medium transition ${
              statusFilter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="text-[12.5px] text-slate-500 dark:text-slate-400">
        Exibindo <span className="num font-semibold text-slate-700 dark:text-slate-200">{visible.length}</span> de <span className="num">{filtered.length}</span> clientes
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden flex-1">
        <div className="overflow-x-auto h-full thin-scroll">
          <table className="w-full text-left min-w-[900px]">
            <thead className="sticky top-0 bg-card z-10 border-b border-slate-100 dark:border-white/[0.05]">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-3 pl-5 pr-3">Cliente</th>
                <th className="py-3 px-3">Plano</th>
                <th className="py-3 px-3 text-right">Valor</th>
                <th className="py-3 px-3 text-right">Vencimento</th>
                <th className="py-3 pr-5 pl-3 text-center">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => {
                const st = clientStatus(c, now, contractThresholdDays);
                const endsAt = getSafeDateOrNull(c.currentContractEndsAt);
                return (
                  <tr
                    key={c.id}
                    onClick={() => openProfile(c.id)}
                    className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] cursor-pointer transition"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size={32} />
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-white">{c.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400 num flex-wrap">
                            <span className="inline-flex items-center gap-1"><Phone size={11} /> {c.whatsapp}</span>
                            {c.consultantName && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
                                <span className="text-[11px] text-brand-600 dark:text-brand-300">@{c.consultantName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      {c.currentPlanName ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-700 dark:text-slate-200">
                          <Layers size={12} className="text-slate-400" /> {c.currentPlanName}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right num text-[12.5px] text-slate-700 dark:text-slate-200">
                      {Number.isFinite(Number(c.currentContractValue)) && c.currentContractValue != null ? fmtBRL(c.currentContractValue) : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-right num text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {endsAt ? endsAt.toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3.5 pr-5 pl-3 text-center">
                      <ContractStatusBadge status={st} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-slate-400">
                    <div className="grid place-items-center gap-2">
                      <GraduationCap size={22} className="opacity-40" />
                      <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum cliente encontrado</p>
                      <p className="text-[12.5px]">Matricule um lead pelo Kanban ou pela ficha para vê-lo aqui.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > visibleCount && (
        <div className="flex justify-center">
          <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
            Carregar mais ({visible.length} de {filtered.length})
          </Btn>
        </div>
      )}
    </div>
  );
}

export { ClientsView };
