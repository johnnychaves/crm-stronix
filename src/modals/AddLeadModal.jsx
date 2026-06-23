import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Calendar, Check, ChevronDown, IdCard, Mail, Phone, Tag, User, UserPlus, Users, Zap } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { getInteractionSecurityFields, getLeadOwnershipFields } from '../lib/leads.js';
import { fromDateInputValue } from '../lib/dates.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { Btn } from '../components/ui/Btn.jsx';

// ==========================================
// MODAL DE CADASTRO — "Novo lead"
// ==========================================
// --- helpers de máscara (apresentação; dígitos internamente) ---
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
// Telefone: (51) 9 0000-0000 (máx. 11 dígitos).
const fmtPhone = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
// CPF: 000.000.000-00 (máx. 11 dígitos).
const fmtCPF = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

// Label de campo do protótipo (atoms.jsx → Field): sentence-case + asterisco
// laranja para obrigatório. Espelha o markup do handoff fielmente.
function FieldLabel({ children, required }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">{children}</span>
      {required && <span className="text-accent-500 text-[12px] leading-none">*</span>}
    </div>
  );
}

// Seção do formulário (protótipo: FormSection) — rótulo uppercase + borda inferior.
function FormSection({ label, children, last }) {
  return (
    <div className={cn('px-5 sm:px-6 py-5', !last && 'border-b border-slate-100 dark:border-white/[0.05]')}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5">{label}</div>
      {children}
    </div>
  );
}

function AddLeadModal({ onClose, appUser, sources, statuses, tags, db, funnels, selectedFunnelId, leads, onCreated, dores = [] }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
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
    tags: [],
    // Campos opcionais (revelados pela disclosure). Gravados no doc do lead.
    // No cadastro de CLIENTE, nascimento/CPF/sexo/e-mail são obrigatórios.
    birthDate: '',
    cpf: '',
    sexo: '',
    email: '',
    // "Dor"/necessidade do lead (o que quer resolver). Obrigatório no LEAD.
    dor: ''
  });

  const statusesForFunnel = useMemo(
    () => (statuses || []).filter(s => s.funnelId === formData.funnelId),
    [statuses, formData.funnelId]
  );

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
  // Habilita o "Criar lead" com nome + WhatsApp (≥10 díg.) + sem duplicata +
  // funil + a "dor"/necessidade preenchida.
  const canSubmit = Boolean(formData.name.trim()) && phoneDigits.length >= 10 && !duplicate && Boolean(formData.funnelId) && Boolean(formData.dor.trim());

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
    const dup = (leads || []).find(l => normalizePhone(l.whatsapp) === newPhoneDigits);
    if (dup) {
      const ownerLabel = dup.consultantName ? ` (consultor: ${dup.consultantName})` : '';
      const statusLabel = dup.status ? ` · etapa "${dup.status}"` : '';
      toast.warning(`Já existe um lead com este WhatsApp: ${dup.name}${ownerLabel}${statusLabel}.`);
      return;
    }

    // "Dor"/necessidade obrigatória (defesa em profundidade além do canSubmit).
    if (!formData.dor.trim()) {
      toast.warning('Descreva a dor/necessidade do lead.');
      return;
    }

    // Guarda contra duplo-submit (o `loading`/`disabled` não atualiza a tempo de um
    // clique duplo rápido; a ref é síncrona e impede o 2º addDoc → evita duplicata).
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      // Separa os campos só-de-UI (observation entra como interação) e converte
      // os opcionais: birthDate → Date (ou null), cpf → string mascarada (ou null).
      const { observation, birthDate, cpf, email, sexo, dor, ...leadFields } = formData;
      const leadRef = await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        {
          ...leadFields,
          birthDate: fromDateInputValue(birthDate),
          cpf: (cpf || '').trim() || null,
          email: (email || '').trim() || null,
          sexo: sexo || null,
          dor: (dor || '').trim() || null,
          ...getLeadOwnershipFields(appUser),
          createdAt: serverTimestamp(),
          nextFollowUp: null,
          nextFollowUpType: null,
          appointmentType: null,
          appointmentScheduledFor: null
        }
      );

      if (observation.trim()) {
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
            text: `OBSERVAÇÃO DO CADASTRO: ${observation}`,
            type: 'note',
            createdAt: serverTimestamp()
          }
        );
      }

      // Notifica o App pra abrir o perfil do lead recém-criado.
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
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="z-[130] max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0"
        overlayClassName="z-[130]"
      >
        {/* Cabeçalho sticky (protótipo: ModalHeader, tone=brand) */}
        <DialogHeader className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] sticky top-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur z-10 sm:rounded-t-2xl">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <UserPlus size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-bold tracking-tight leading-tight font-display">Novo lead</DialogTitle>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">Cadastro rápido — capture o essencial agora</p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* ── Quem é ── */}
          <FormSection label="Quem é">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <FieldLabel required>Nome completo</FieldLabel>
                <StyledInput
                  ref={nameRef}
                  icon={<User size={15} />}
                  autoComplete="off"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome e sobrenome"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel required>WhatsApp</FieldLabel>
                <StyledInput
                  type="tel"
                  icon={<Phone size={15} />}
                  inputMode="numeric"
                  autoComplete="off"
                  value={fmtPhone(formData.whatsapp)}
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(51) 9 0000-0000"
                  className={cn(
                    duplicate && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15',
                    !duplicate && phoneTooShort && 'border-amber-400'
                  )}
                />
                {duplicate ? (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
                  </div>
                ) : phoneTooShort ? (
                  <div className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">Número incompleto — inclua DDD.</div>
                ) : null}
              </div>
            </div>
          </FormSection>

          {/* ── Como chegou ── */}
          <FormSection label="Como chegou">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Origem</FieldLabel>
                <StyledSelect value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })}>
                  {(sources || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </StyledSelect>
              </div>
              <div>
                <FieldLabel>Funil</FieldLabel>
                <StyledSelect value={formData.funnelId || ''} onChange={e => handleFunnelChange(e.target.value)}>
                  {safeFunnels.length === 0 && <option value="">Nenhum funil disponível</option>}
                  {safeFunnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </StyledSelect>
              </div>
            </div>
            {statusesForFunnel.length > 0 && (
              <div className="mt-4">
                <FieldLabel>Fase inicial</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {statusesForFunnel.map(s => {
                    const active = formData.status === s.name;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setFormData({ ...formData, status: s.name })}
                        className={cn(
                          'h-9 px-3 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition',
                          active
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/[0.08]'
                        )}
                      >
                        {active && <Check size={12} />}{s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </FormSection>

          {/* ── Dor / necessidade (obrigatória) ── */}
          <FormSection label="Dor / necessidade">
            <FieldLabel required>O que o lead quer resolver?</FieldLabel>
            {dores.length > 0 ? (
              <StyledSelect value={formData.dor} onChange={e => setFormData({ ...formData, dor: e.target.value })}>
                <option value="">Selecione…</option>
                {dores.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </StyledSelect>
            ) : (
              <textarea
                value={formData.dor}
                onChange={e => setFormData({ ...formData, dor: e.target.value })}
                autoComplete="off"
                rows={2}
                placeholder="Ex.: emagrecer, voltar a treinar, dor nas costas, condicionamento…"
                className="w-full rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] focus:border-brand-400 dark:focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10 outline-none text-[13.5px] p-3.5 placeholder:text-slate-400 transition resize-none"
              />
            )}
            {dores.length > 0 && (
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">Cadastre/edite as opções em Configurações → Catálogos → Dores.</p>
            )}
          </FormSection>

          {/* ── Disclosure: dados adicionais ── */}
          <div className="px-5 sm:px-6 pt-4">
            <button
              type="button"
              onClick={() => setShowMore(m => !m)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              <ChevronDown size={14} className={cn('transition', showMore && 'rotate-180')} />
              {showMore ? 'Ocultar dados adicionais' : 'Adicionar nascimento, CPF, sexo, e-mail e etiquetas'}
            </button>
          </div>

          {showMore && (
            <>
              <FormSection label="Dados adicionais">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Data de nascimento</FieldLabel>
                    <StyledInput type="date" icon={<Calendar size={15} />} value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>CPF</FieldLabel>
                    <StyledInput icon={<IdCard size={15} />} inputMode="numeric" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({ ...formData, cpf: fmtCPF(e.target.value) })} />
                  </div>
                  <div>
                    <FieldLabel>Sexo</FieldLabel>
                    <StyledSelect value={formData.sexo} onChange={e => setFormData({ ...formData, sexo: e.target.value })}>
                      <option value="">Selecione…</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Outro">Outro</option>
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel>E-mail</FieldLabel>
                    <StyledInput type="email" icon={<Mail size={15} />} autoComplete="off" placeholder="email@exemplo.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>
              </FormSection>
              <FormSection label="Etiquetas e observação" last>
                <div>
                  <div className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Etiquetas</div>
                  {(tags || []).length === 0 ? (
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 italic">Nenhuma etiqueta cadastrada.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(tags || []).map(t => {
                        const on = formData.tags.includes(t.name);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => toggleTag(t.name)}
                            className={cn(
                              'h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 transition',
                              on
                                ? 'bg-accent-500/12 text-accent-600 border border-accent-500/30 dark:bg-accent-500/15 dark:text-accent-400'
                                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.04] dark:text-slate-400 dark:border-white/[0.08]'
                            )}
                          >
                            {on && <Check size={12} />}<Tag size={11} className="opacity-60" />{t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Observação</div>
                  <textarea
                    value={formData.observation}
                    onChange={e => setFormData({ ...formData, observation: e.target.value })}
                    autoComplete="off"
                    rows={2}
                    placeholder="Algo importante sobre esse cadastro?"
                    className="w-full rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] focus:border-brand-400 dark:focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10 outline-none text-[13.5px] p-3.5 placeholder:text-slate-400 transition resize-none"
                  />
                </div>
              </FormSection>
            </>
          )}

          {/* Rodapé sticky (protótipo) */}
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-2 sticky bottom-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur sm:rounded-b-2xl border-t border-slate-100 dark:border-white/[0.05]">
            <span className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-slate-400 dark:text-slate-500">
              <Users size={13} className="text-brand-600 dark:text-brand-400" />
              Será atribuído a <strong className="text-slate-600 dark:text-slate-300">{appUser?.name}</strong>.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Btn kind="soft" size="md" onClick={onClose} disabled={loading}>Cancelar</Btn>
              <Btn
                kind="brand"
                size="md"
                type="submit"
                icon={loading ? null : <Zap size={14} />}
                disabled={!canSubmit || loading}
              >
                {loading ? 'Salvando…' : 'Criar lead'}
              </Btn>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export { AddLeadModal };
