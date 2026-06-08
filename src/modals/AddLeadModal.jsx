import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Check, CheckCircle2, Users, Zap } from 'lucide-react';
import { collection, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { getInteractionSecurityFields, getLeadOwnershipFields } from '../lib/leads.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { SurgeMark } from '../components/brand/SurgeMark.jsx';

// ==========================================
// MODAL DE CADASTRO
// ==========================================
// --- helpers do AddLeadModal (apresentação) ---
const addLeadOnlyDigits = (s) => String(s || '').replace(/\D/g, '');
const addLeadFmtPhone = (raw) => {
  const d = addLeadOnlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
// pontinho de cor por status — bate com os valores do statusGradientMap.
const ADDLEAD_STATUS_DOT = {
  blue: 'bg-brand-500', green: 'bg-emerald-500', yellow: 'bg-amber-500',
  red: 'bg-rose-500', purple: 'bg-violet-500', orange: 'bg-accent-500',
  gray: 'bg-slate-400', teal: 'bg-teal-500', pink: 'bg-pink-500',
  indigo: 'bg-indigo-500', lime: 'bg-lime-500',
};
const addLeadInputCls = 'w-full h-11 px-3.5 rounded-xl text-[14px] font-medium bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15';

function AddLeadField({ label, hint, children }) {
  return (
    <div>
      <label className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        {hint && <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function AddLeadModal({ onClose, appUser, sources, statuses, tags, db, funnels, selectedFunnelId, leads, onCreated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const nameRef = useRef(null);
  const submittingRef = useRef(false); // guarda síncrona contra duplo-submit
  useEffect(() => { nameRef.current?.focus(); }, []);

  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const initialFunnelId = selectedFunnelId || getDefaultFunnel(safeFunnels)?.id || null;
  const initialStatuses = (statuses || []).filter(s => s.funnelId === initialFunnelId);
  // Normaliza WhatsApp para apenas dígitos. Aceita o caso vazio sem trocar
  // por undefined pra evitar match acidental ("" === "" → true).
  const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '');

  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    source: sources?.[0]?.name || 'Instagram',
    funnelId: initialFunnelId,
    status: initialStatuses?.[0]?.name || 'Novo',
    observation: '',
    tags: []
  });

  const statusesForFunnel = useMemo(
    () => (statuses || []).filter(s => s.funnelId === formData.funnelId),
    [statuses, formData.funnelId]
  );
  const statusObj = (statuses || []).find(s => s.name === formData.status);

  const handleFunnelChange = (newFunnelId) => {
    const nextStatuses = (statuses || []).filter(s => s.funnelId === newFunnelId);
    setFormData(prev => ({
      ...prev,
      funnelId: newFunnelId,
      status: nextStatuses[0]?.name || 'Novo'
    }));
  };

  const toggleTag = (name) =>
    setFormData(prev => ({ ...prev, tags: prev.tags.includes(name) ? prev.tags.filter(x => x !== name) : [...prev.tags, name] }));

  // validações ao vivo (mesma regra do modal original)
  const phoneDigits = normalizePhone(formData.whatsapp);
  const phoneTooShort = phoneDigits.length > 0 && phoneDigits.length < 10;
  const duplicate = phoneDigits.length >= 8
    ? (leads || []).find(l => normalizePhone(l.whatsapp) === phoneDigits)
    : null;
  const canSubmit = formData.name.trim() && phoneDigits.length >= 8 && !duplicate && formData.funnelId;

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.name || !formData.whatsapp) return;
  if (!formData.funnelId) {
    toast.warning('Selecione um funil para o lead. Crie um em Configurações → Funil Pipeline se não houver opções.');
    return;
  }

  // Bloqueio de duplicidade por WhatsApp.
  // Comparamos versões com apenas dígitos para ignorar formatação ((11) 9..., +55, etc).
  // Validação de defesa em profundidade: a UI bloqueia aqui; em paralelo seria
  // ideal ter uma regra Firestore + índice unique, mas isso é fora de escopo.
  const newPhoneDigits = normalizePhone(formData.whatsapp);
  if (newPhoneDigits.length < 8) {
    toast.warning('Informe um número de WhatsApp válido (com DDD).');
    return;
  }
  const duplicate = (leads || []).find(l => normalizePhone(l.whatsapp) === newPhoneDigits);
  if (duplicate) {
    const ownerLabel = duplicate.consultantName ? ` (consultor: ${duplicate.consultantName})` : '';
    const statusLabel = duplicate.status ? ` · etapa "${duplicate.status}"` : '';
    toast.warning(`Já existe um lead com este WhatsApp: ${duplicate.name}${ownerLabel}${statusLabel}.`);
    return;
  }

  // Guarda contra duplo-submit (o `loading`/`disabled` não atualiza a tempo de um
  // clique duplo rápido; a ref é síncrona e impede o 2º addDoc → evita duplicata).
  if (submittingRef.current) return;
  submittingRef.current = true;
  setLoading(true);

  try {
    const leadRef = await addDoc(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
      {
        ...formData,
        ...getLeadOwnershipFields(appUser),
        createdAt: serverTimestamp(),
        nextFollowUp: null,
        nextFollowUpType: null,
        appointmentType: null,
        appointmentScheduledFor: null
      }
    );

    if (formData.observation.trim()) {
      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          leadId: leadRef.id,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(
            {
              consultantId: appUser.id,
              consultantAuthUid: appUser.authUid
            },
            appUser
          ),
          text: `OBSERVAÇÃO DO CADASTRO: ${formData.observation}`,
          type: 'note',
          createdAt: serverTimestamp()
        }
      );
    }

    // Notifica o App pra abrir o perfil do lead recém-criado.
    // O App espera o doc aparecer em `leads` via onSnapshot e abre o
    // LeadDetailsModal — assim o consultor já pode agendar visita/aula.
    if (onCreated) onCreated(leadRef.id);
    onClose();
  } catch (error) {
    console.error(error);
    toast.error?.('Erro ao cadastrar lead.');
  } finally {
    submittingRef.current = false;
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[840px] max-h-[92vh] flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)] animate-fade-in">
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08]">
              <SurgeMark size={21} />
            </div>
            <div>
              <h2 className="font-display text-[18px] font-bold tracking-tight leading-none text-gray-900 dark:text-white">Novo lead</h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Cadastre um contato no pipeline</p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar"
            className="w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_280px]">
            {/* form */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <AddLeadField label="Nome do lead">
                  <input ref={nameRef} autoComplete="off" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome completo" className={addLeadInputCls} />
                </AddLeadField>
                <AddLeadField label="WhatsApp" hint={duplicate ? '' : 'com DDD'}>
                  <input type="tel" autoComplete="off" value={addLeadFmtPhone(formData.whatsapp)} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(51) 9 0000-0000"
                    className={`${addLeadInputCls} ${duplicate ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15' : phoneTooShort ? 'border-amber-400' : ''}`} />
                  {duplicate ? (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
                    </div>
                  ) : phoneTooShort ? (
                    <div className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">Número incompleto — inclua DDD.</div>
                  ) : null}
                </AddLeadField>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <AddLeadField label="Origem">
                  <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className={`${addLeadInputCls} pr-9 cursor-pointer appearance-none`}>
                    {(sources || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </AddLeadField>
                <AddLeadField label="Funil">
                  <select value={formData.funnelId || ''} onChange={(e) => handleFunnelChange(e.target.value)} className={`${addLeadInputCls} pr-9 cursor-pointer appearance-none`}>
                    {safeFunnels.length === 0 && <option value="">Nenhum funil disponível</option>}
                    {safeFunnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </AddLeadField>
              </div>

              <AddLeadField label="Fase inicial">
                <div className="flex flex-wrap gap-1.5">
                  {statusesForFunnel.length === 0 && <span className="text-[12.5px] text-slate-400">Novo</span>}
                  {statusesForFunnel.map((s) => {
                    const active = formData.status === s.name;
                    return (
                      <button type="button" key={s.id} onClick={() => setFormData({ ...formData, status: s.name })}
                        className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-2 transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/[0.08]'}`}>
                        <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : (ADDLEAD_STATUS_DOT[s.color] || 'bg-slate-400')}`} />
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </AddLeadField>

              <AddLeadField label="Etiquetas" hint={`${formData.tags.length} selecionada${formData.tags.length === 1 ? '' : 's'}`}>
                <div className="flex flex-wrap gap-1.5">
                  {(tags || []).map((t) => {
                    const on = formData.tags.includes(t.name);
                    return (
                      <button type="button" key={t.id} onClick={() => toggleTag(t.name)}
                        className={`h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 transition ${on ? 'bg-accent-500/12 text-accent-600 border border-accent-500/30 dark:bg-accent-500/15 dark:text-accent-400' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.04] dark:text-slate-400 dark:border-white/[0.08]'}`}>
                        {on && <Check size={12} />}{t.name}
                      </button>
                    );
                  })}
                </div>
              </AddLeadField>

              <AddLeadField label="Observação" hint="opcional">
                <textarea value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} autoComplete="off"
                  placeholder="Algum detalhe importante para o primeiro atendimento?"
                  className={`${addLeadInputCls} h-24 py-3 resize-none leading-relaxed`} />
              </AddLeadField>
            </div>

            {/* preview */}
            <div className="hidden md:flex flex-col gap-4 p-6 bg-slate-50/70 dark:bg-white/[0.02] border-l border-slate-200/80 dark:border-white/[0.06]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pré-visualização</div>
              <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden">
                <div className="h-1 w-full" style={{ background: formData.name ? '#2B59FF' : '#e3e6ee' }} />
                <div className="p-3.5">
                  <div className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">
                    {formData.name || <span className="text-slate-300 dark:text-slate-600">Nome do lead</span>}
                  </div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">{formData.whatsapp ? addLeadFmtPhone(formData.whatsapp) : '(00) 0 0000-0000'}</div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
                      <span className={`w-2 h-2 rounded-full ${ADDLEAD_STATUS_DOT[statusObj?.color] || 'bg-slate-300'}`} />{formData.status}
                    </span>
                    <span className="text-[11px] text-slate-400">{formData.source}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                <Users size={13} className="mt-0.5 text-brand-600 dark:text-brand-400 shrink-0" />
                O lead será atribuído a <strong className="text-slate-700 dark:text-slate-200">{appUser?.name}</strong> e aparecerá na Meta diária.
              </p>
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-ink-900 shrink-0">
            <div className="text-[11.5px] text-slate-400 dark:text-slate-500 hidden sm:flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Verificação de duplicidade ativa
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="h-11 px-4 rounded-xl text-[13.5px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06] transition">
                Cancelar
              </button>
              <button type="submit" disabled={!canSubmit || loading}
                className="h-11 px-5 rounded-xl text-[13.5px] font-semibold inline-flex items-center gap-2 transition active:scale-[.98] bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_20px_-8px_rgba(43,89,255,.7)] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
                {loading ? <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Salvando…</>
                         : <><Zap size={15} /> Cadastrar lead</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
export { AddLeadModal };
