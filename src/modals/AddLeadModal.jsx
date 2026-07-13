import { useState, useEffect, useRef } from 'react';
import {
  UserPlus, MessageCircle, Megaphone, Globe, DoorOpen, Camera, Calendar, IdCard, Mail,
  ChevronDown, Check, Plus, Zap, AlertTriangle, CheckCircle2, Users, X, Kanban, HeartPulse, Dumbbell,
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { getLeadOwnershipFields, findLeadByPhoneDigits } from '../lib/leads.js';
import { logInteraction } from '../lib/interactions.js';
import { buildLeadSearchFields, deriveLeadBucket } from '../lib/leadDerived.js';
import { fromDateInputValue } from '../lib/dates.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { SurgeMark } from '../components/brand/SurgeMark.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { RingAvatar } from '../components/profile/RingAvatar.jsx';
import { settingsColorTone } from '../components/ui/ColorPicker.jsx';
import { getTone, phaseToneName } from '../lib/leadState.js';

// ==========================================================================
// MODAL DE CADASTRO DE LEAD ("Novo lead") — redesign premium em duas colunas
// (handoff handoff_cadastro_lead) construído sobre a base da PR #123:
// reusa Dialog/RingAvatar/badges soft e mantém o modelo de dados do #123
// (dor obrigatória, sexo, e-mail, nascimento via fromDateInputValue).
// ==========================================================================

// ---------- helpers de apresentação ----------
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
// (51) 9 9530-4633
const fmtPhone = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
// 000.000.000-00
const fmtCPF = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

// Origens só guardam `name`. Derivamos ícone (lucide) + tom + hint por
// palavra-chave, com fallback genérico para origens customizadas.
const sourceTileMeta = (name) => {
  const n = String(name || '').toLowerCase();
  if (n.includes('indica')) return { Icon: UserPlus, tone: 'emerald', hint: 'Aluno indicou' };
  if (n.includes('whats')) return { Icon: MessageCircle, tone: 'teal', hint: 'Link da bio' };
  if (n.includes('insta')) return { Icon: Camera, tone: 'pink', hint: 'DM / perfil' };
  if (n.includes('face') || n.includes('tiktok') || n.includes('rede') || n.includes('social'))
    return { Icon: Camera, tone: 'violet', hint: 'Rede social' };
  if (n.includes('tráfego') || n.includes('trafego') || n.includes('ads') || n.includes('pago') || n.includes('campanha') || n.includes('anúnci') || n.includes('anunci'))
    return { Icon: Megaphone, tone: 'violet', hint: 'Ads / campanha' };
  if (n.includes('site') || n.includes('web') || n.includes('formul') || n.includes('google'))
    return { Icon: Globe, tone: 'brand', hint: 'Formulário web' };
  if (n.includes('porta') || n.includes('walk') || n.includes('balc') || n.includes('passou'))
    return { Icon: DoorOpen, tone: 'amber', hint: 'Walk-in' };
  return { Icon: Zap, tone: 'slate', hint: '' };
};

const inputCls =
  'w-full h-11 px-3.5 rounded-xl text-[14px] font-medium bg-white dark:bg-white/[0.04] ' +
  'border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 placeholder:font-normal outline-none transition ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12';

// ---------- átomos ----------
function Label({ children, hint, required }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
        {children}{required && <span className="text-accent-500">*</span>}
      </span>
      {hint && <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
}

const IconInput = ({ icon, className = '', inputRef, ...p }) => (
  <div className="relative">
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>
    <input ref={inputRef} autoComplete="off" {...p} className={cn(inputCls, 'pl-10', className)} />
  </div>
);

const Select = ({ icon, children, className = '', ...p }) => (
  <div className="relative">
    {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>}
    <select {...p} className={cn(inputCls, 'appearance-none cursor-pointer pr-9', icon && 'pl-10', className)}>{children}</select>
    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
);

function SectionTitle({ n, title, desc }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-bold num bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300 shrink-0">{n}</span>
      <div>
        <div className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white leading-none">{title}</div>
        {desc && <div className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</div>}
      </div>
    </div>
  );
}

// Avatar do preview: anel azul (lead em prospecção) reusando o RingAvatar do
// #123; estado vazio (sem nome) = círculo cinza com travessão.
function LeadAvatar({ name, size = 44 }) {
  if (name) return <RingAvatar name={name} size={size} toneName="brand" />;
  return (
    <div className="relative shrink-0" style={{ padding: 4 }}>
      <div
        className="rounded-full ring-[2.5px] ring-offset-[3px] ring-offset-white dark:ring-offset-[#0e1326]"
        style={{ '--tw-ring-color': '#cbd5e1', boxShadow: '0 0 0 6px #cbd5e155' }}
      >
        <div className="rounded-full grid place-items-center font-semibold bg-paper-200 text-slate-400" style={{ width: size, height: size, fontSize: size * 0.36 }}>–</div>
      </div>
    </div>
  );
}

// ---------- tiles de origem ----------
function SourceTiles({ sources, value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {(sources || []).map((s) => {
        const { Icon, tone, hint } = sourceTileMeta(s.name);
        const t = settingsColorTone(tone);
        const active = value === s.name;
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => onChange(s.name)}
            className={cn(
              'group relative text-left rounded-xl border p-2.5 transition active:scale-[.98]',
              active
                ? `${t.soft} ${t.darkSoft} border-transparent ring-2 ${t.ring}`
                : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.03] dark:border-white/[0.08] dark:hover:border-white/15'
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0 transition',
                active ? `${t.strong} text-white` : `${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`)}><Icon size={17} /></span>
              <div className="min-w-0">
                <div className={cn('text-[12.5px] font-semibold leading-tight truncate', active ? `${t.text} ${t.darkText}` : 'text-slate-800 dark:text-slate-100')}>{s.name}</div>
                {hint && <div className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate">{hint}</div>}
              </div>
            </div>
            {active && <span className={cn('absolute top-2 right-2 w-4 h-4 rounded-full grid place-items-center text-white', t.strong)}><Check size={10} /></span>}
          </button>
        );
      })}
      {(sources || []).length === 0 && (
        <div className="col-span-full text-[12.5px] text-slate-400 dark:text-slate-500 py-2">
          Nenhuma origem cadastrada. Crie em Configurações → Origens.
        </div>
      )}
    </div>
  );
}

// ---------- funil (dropdown) + etapa inicial (stepper, padrão do perfil) ----------
function PhasePicker({ funnels, funnelId, onFunnel, statuses, status, onStatus }) {
  // Estágios do funil selecionado, ordenados (mesma regra do PhaseChanger do perfil).
  const phases = (statuses || [])
    .filter((s) => s.funnelId === funnelId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const selIdx = phases.findIndex((s) => s.name === status);
  return (
    <div className="space-y-4">
      <div>
        <Label>Funil</Label>
        <Select icon={<Kanban size={16} />} value={funnelId || ''} onChange={(e) => onFunnel(e.target.value)}>
          {(funnels || []).length === 0 && <option value="">Nenhum funil disponível</option>}
          {(funnels || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      </div>

      <div>
        <Label>Em qual etapa do funil</Label>
        {phases.length === 0 ? (
          <span className="text-[12.5px] text-slate-400 dark:text-slate-500">Este funil ainda não tem fases.</span>
        ) : (
          // Stepper do pipeline — mesmo padrão da mudança de fase no perfil do aluno
          // (components/profile/PhaseChanger · PhaseNode): nós numerados conectados,
          // a etapa escolhida destacada com o tom da fase e as anteriores "passadas".
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4 overflow-x-auto thin-scroll">
            <div className="flex min-w-[440px]">
              {phases.map((s, i) => {
                const t = getTone(phaseToneName(s.name, statuses));
                const isTarget = i === selIdx;
                const done = i < selIdx;
                const leftPassed = i <= selIdx;
                const rightPassed = i + 1 <= selIdx;
                return (
                  <button type="button" key={s.id || s.name} onClick={() => onStatus(s.name)} className="flex-1 min-w-[78px] group">
                    <div className="flex items-center">
                      <div className={cn('h-[3px] flex-1 transition-colors', i === 0 ? 'invisible' : leftPassed ? 'bg-brand-600' : 'bg-slate-200 dark:bg-white/[0.08]')}></div>
                      <span className={cn('relative w-7 h-7 rounded-full grid place-items-center shrink-0 transition',
                        isTarget
                          ? cn(t.strong, 'text-white ring-4', `${t.ring}/30`)
                          : done
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]')}>
                        {done || isTarget ? <Check size={13} /> : <span className="text-[11px] font-bold num">{i + 1}</span>}
                      </span>
                      <div className={cn('h-[3px] flex-1 transition-colors', i === phases.length - 1 ? 'invisible' : rightPassed ? 'bg-brand-600' : 'bg-slate-200 dark:bg-white/[0.08]')}></div>
                    </div>
                    <div className={cn('text-center mt-2 text-[11px] font-semibold leading-tight px-0.5', isTarget ? cn(t.text, t.darkText) : 'text-slate-500 dark:text-slate-400')}>
                      {s.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- etiquetas ----------
function TagToggles({ tags, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(tags || []).map((tag) => {
        const t = settingsColorTone(tag.color);
        const on = selected.includes(tag.name);
        return (
          <button
            type="button"
            key={tag.id}
            onClick={() => onToggle(tag.name)}
            className={cn('h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 transition active:scale-[.97]',
              on
                ? `${t.soft} ${t.darkSoft} ${t.text} ${t.darkText} ring-1 ${t.ring}`
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.08]')}
          >
            {on ? <Check size={12} /> : <Plus size={12} className="opacity-60" />}{tag.name}
          </button>
        );
      })}
      {(tags || []).length === 0 && (
        <span className="text-[12.5px] text-slate-400 dark:text-slate-500">Nenhuma etiqueta cadastrada.</span>
      )}
    </div>
  );
}

// ---------- card de preview ao vivo ----------
function PreviewCard({ form, statusObj, sources, tags }) {
  const t = statusObj ? settingsColorTone(statusObj.color) : settingsColorTone('slate');
  const srcObj = (sources || []).find((s) => s.name === form.source);
  const SrcIcon = srcObj ? sourceTileMeta(srcObj.name).Icon : null;
  return (
    <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-card-lg overflow-hidden">
      <div className="h-1.5 w-full bg-brand-500"></div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <LeadAvatar name={form.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-[15px] tracking-tight text-slate-900 dark:text-white truncate">
              {form.name || <span className="text-slate-300 dark:text-slate-600">Nome do lead</span>}
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 num">
              {form.whatsapp ? fmtPhone(form.whatsapp) : '(00) 0 0000-0000'}
            </div>
          </div>
        </div>

        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {form.tags.slice(0, 3).map((name) => {
              const tg = (tags || []).find((x) => x.name === name);
              const tt = settingsColorTone(tg ? tg.color : 'slate');
              return <span key={name} className={cn('text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md', tt.soft, tt.text, tt.darkSoft, tt.darkText)}>{name}</span>;
            })}
            {form.tags.length > 3 && <span className="text-[10.5px] font-semibold text-slate-400 self-center">+{form.tags.length - 3}</span>}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md', t.soft, t.text, t.darkSoft, t.darkText)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', t.strong)}></span>{form.status || '—'}
          </span>
          {form.source && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              {SrcIcon && <SrcIcon size={12} />}{form.source}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
function AddLeadModal({ onClose, appUser, sources, statuses, tags, db, funnels, selectedFunnelId, leads, onCreated, dores = [] }) {
  const toast = useToast();
  const { modalities = [] } = useGeneralConfig();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const [more, setMore] = useState(false);
  const nameRef = useRef(null);
  const submittingRef = useRef(false);

  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const initialFunnelId = selectedFunnelId || getDefaultFunnel(safeFunnels)?.id || null;
  const initialStatuses = (statuses || []).filter((s) => s.funnelId === initialFunnelId).sort((a, b) => (a.order || 0) - (b.order || 0));

  const blankForm = () => ({
    name: '',
    whatsapp: '',
    source: sources?.[0]?.name || '',
    funnelId: initialFunnelId,
    status: initialStatuses?.[0]?.name || '',
    tags: [],
    dor: '',
    modalidade: '',
    birthDate: '',
    cpf: '',
    sexo: '',
    email: '',
    observation: '',
  });
  const [form, setForm] = useState(blankForm);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const statusObj = (statuses || []).find((s) => s.name === form.status);

  const handleFunnel = (id) => {
    const next = (statuses || []).filter((s) => s.funnelId === id).sort((a, b) => (a.order || 0) - (b.order || 0));
    setForm((f) => ({ ...f, funnelId: id, status: next[0]?.name || '' }));
  };
  const toggleTag = (name) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(name) ? f.tags.filter((x) => x !== name) : [...f.tags, name] }));

  const phoneDigits = onlyDigits(form.whatsapp);
  const phoneTooShort = phoneDigits.length > 0 && phoneDigits.length < 10;
  const duplicate = phoneDigits.length >= 10
    ? findLeadByPhoneDigits(leads, phoneDigits)
    : null;
  const nameOk = form.name.trim().length > 1;
  const dorOk = form.dor.trim().length > 0;
  const canSubmit = nameOk && phoneDigits.length >= 10 && !duplicate && !!form.funnelId && dorOk;

  // barra de progresso — 6 sinais
  const filled = [nameOk, phoneDigits.length >= 10, !!form.source, !!form.status, dorOk].filter(Boolean).length
    + ((form.tags.length || form.observation.trim()) ? 1 : 0);
  const pct = Math.round((filled / 6) * 100);

  const reset = () => {
    setForm(blankForm());
    setMore(false);
    setDone(false);
    setCreatedId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!form.funnelId) {
      toast.warning('Selecione um funil para o lead. Crie um em Configurações → Funil Pipeline se não houver opções.');
      return;
    }
    const dup = findLeadByPhoneDigits(leads, phoneDigits);
    if (dup) {
      const ownerLabel = dup.consultantName ? ` (consultor: ${dup.consultantName})` : '';
      const statusLabel = dup.status ? ` · etapa "${dup.status}"` : '';
      toast.warning(`Já existe um lead com este WhatsApp: ${dup.name}${ownerLabel}${statusLabel}.`);
      return;
    }
    if (!dorOk) {
      toast.warning('Descreva a dor/necessidade do lead.');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      const leadRef = await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        {
          name: form.name.trim(),
          whatsapp: form.whatsapp,
          source: form.source,
          funnelId: form.funnelId,
          status: form.status,
          tags: form.tags,
          birthDate: fromDateInputValue(form.birthDate),
          cpf: (form.cpf || '').trim() || null,
          email: (form.email || '').trim() || null,
          sexo: form.sexo || null,
          dor: (form.dor || '').trim() || null,
          modalidade: form.modalidade || null,
          ...getLeadOwnershipFields(appUser),
          ...buildLeadSearchFields({ name: form.name, whatsapp: form.whatsapp, cpf: form.cpf }),
          lifecycleBucket: deriveLeadBucket({ status: form.status }),
          lastInteractionAt: null,
          interactionsCount: 0,
          createdAt: serverTimestamp(),
          nextFollowUp: null,
          nextFollowUpType: null,
          appointmentType: null,
          appointmentScheduledFor: null,
        }
      );

      if (form.observation.trim()) {
        await logInteraction(
          db,
          { id: leadRef.id, consultantId: appUser.id, consultantAuthUid: appUser.authUid },
          appUser,
          {
            text: `OBSERVAÇÃO DO CADASTRO: ${form.observation}`,
            type: 'note',
          }
        );
      }

      setCreatedId(leadRef.id);
      setDone(true);
    } catch (error) {
      console.error(error);
      toast.error?.('Erro ao cadastrar lead.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const consultantName = appUser?.name || 'Você';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => { e.preventDefault(); nameRef.current?.focus(); }}
        overlayClassName="z-[130] bg-ink-950/60 backdrop-blur-[3px]"
        className="z-[130] p-0 gap-0 overflow-hidden flex flex-col w-full max-w-[calc(100%-1.5rem)] sm:max-w-[960px] max-h-[92vh] bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_40px_100px_-24px_rgba(8,13,34,.6)] rounded-3xl"
      >
        {done ? (
          <>
            <DialogTitle className="sr-only">Lead cadastrado</DialogTitle>
            <SuccessView
              form={form} statusObj={statusObj} sources={sources} tags={tags}
              onView={() => { if (createdId && onCreated) onCreated(createdId); onClose(); }}
              onAgain={reset}
            />
          </>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 grid min-[880px]:grid-cols-[340px_minmax(0,1fr)]">

              {/* ── Showcase stage ── */}
              <aside className="hidden min-[880px]:flex flex-col p-6 relative overflow-hidden border-r border-slate-200/70 dark:border-white/[0.06]
                                bg-gradient-to-b from-brand-50/80 via-paper-50 to-paper-50 dark:from-brand-500/[0.07] dark:via-ink-900 dark:to-ink-900">
                <div className="absolute -right-8 -top-6 opacity-[0.06] dark:opacity-[0.09] pointer-events-none rotate-6">
                  <SurgeMark size={190} />
                </div>

                <div className="flex items-center gap-2.5 relative">
                  <div className="w-9 h-9 rounded-xl grid place-items-center bg-white dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08] shadow-sm"><SurgeMark size={20} /></div>
                  <span className="font-display font-extrabold tracking-tight text-[15px]"><span className="text-slate-900 dark:text-white">STRONI</span><span className="text-brand-600 dark:text-brand-300">LEAD</span></span>
                </div>

                <div className="relative mt-7">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">Pré-visualização no funil</div>
                  <PreviewCard form={form} statusObj={statusObj} sources={sources} tags={tags} />
                </div>

                <div className="relative mt-4 rounded-2xl bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.07] p-3.5 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"><Users size={13} /> Responsável</div>
                  <div className="flex items-center gap-2.5 mt-2.5">
                    <Avatar name={consultantName} size={34} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">{consultantName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Responsável pelo cadastro</div>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">Será atribuído a você e somará na sua <strong className="text-slate-700 dark:text-slate-200 font-semibold">Meta diária</strong>.</p>
                </div>

                <div className="relative mt-auto pt-4 flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> <span className="font-medium">Verificação de duplicidade ativa</span>
                </div>
              </aside>

              {/* ── Formulário ── */}
              <div className="flex flex-col min-h-0 min-w-0">
                {/* header */}
                <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-slate-200/80 dark:border-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <div className="min-[880px]:hidden w-9 h-9 rounded-xl grid place-items-center bg-brand-50 dark:bg-white/[0.06]"><SurgeMark size={20} /></div>
                    <div>
                      <DialogTitle className="font-display text-[19px] font-bold tracking-tight leading-none">Novo lead</DialogTitle>
                      <DialogDescription className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Cadastre um contato no pipeline em segundos</DialogDescription>
                    </div>
                  </div>
                  <button type="button" onClick={onClose} title="Fechar"
                    className="w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition"><X size={18} /></button>
                </div>

                {/* progress */}
                <div className="px-5 sm:px-7 pt-3">
                  <div className="h-1 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${Math.max(8, pct)}%` }}></div>
                  </div>
                </div>

                {/* body */}
                <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-5 sm:px-7 py-5 space-y-6">
                  {/* 1 — quem é */}
                  <section>
                    <SectionTitle n="1" title="Quem é" desc="Nome e WhatsApp são obrigatórios" />
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <div className="sm:col-span-2">
                        <Label required>Nome do lead</Label>
                        <IconInput inputRef={nameRef} icon={<UserPlus size={16} />} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nome completo" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label required hint={duplicate ? '' : 'com DDD + 9 dígitos'}>WhatsApp</Label>
                        <IconInput type="tel" inputMode="numeric" icon={<MessageCircle size={16} />} value={fmtPhone(form.whatsapp)} onChange={(e) => set({ whatsapp: e.target.value })}
                          placeholder="(51) 9 0000-0000"
                          className={duplicate ? '!border-rose-400 focus:!ring-rose-400/15' : (phoneTooShort ? '!border-amber-400' : '')} />
                        {duplicate ? (
                          <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
                          </div>
                        ) : phoneTooShort ? (
                          <div className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">Número incompleto — inclua DDD + 9 dígitos.</div>
                        ) : phoneDigits.length >= 10 ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400"><Check size={13} /> Número válido e disponível.</div>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  {/* 2 — origem */}
                  <section>
                    <SectionTitle n="2" title="Como chegou" desc="De onde veio esse contato?" />
                    <SourceTiles sources={sources} value={form.source} onChange={(v) => set({ source: v })} />
                  </section>

                  {/* 3 — funil + fase */}
                  <section>
                    <SectionTitle n="3" title="Onde entra" desc="Funil e fase inicial no pipeline" />
                    <PhasePicker funnels={safeFunnels} funnelId={form.funnelId} onFunnel={handleFunnel} statuses={statuses} status={form.status} onStatus={(v) => set({ status: v })} />
                  </section>

                  {/* 4 — o que busca: dor (obrigatória) + modalidade de interesse */}
                  <section>
                    <SectionTitle n="4" title="O que busca" desc="Necessidade e modalidade de interesse" />
                    <div className="space-y-3.5">
                      <div>
                        <Label required>Dor / necessidade</Label>
                        {dores.length > 0 ? (
                          <Select icon={<HeartPulse size={16} />} value={form.dor} onChange={(e) => set({ dor: e.target.value })}>
                            <option value="">Selecione…</option>
                            {dores.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </Select>
                        ) : (
                          <p className="text-[11.5px] text-slate-400 dark:text-slate-500">Nenhuma dor cadastrada — adicione em Configurações → Catálogos → Dores.</p>
                        )}
                      </div>
                      <div>
                        <Label hint="opcional">Modalidade de interesse</Label>
                        {modalities.length > 0 ? (
                          <Select icon={<Dumbbell size={16} />} value={form.modalidade} onChange={(e) => set({ modalidade: e.target.value })}>
                            <option value="">Selecione…</option>
                            {modalities.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                          </Select>
                        ) : (
                          <p className="text-[11.5px] text-slate-400 dark:text-slate-500">Nenhuma modalidade cadastrada — adicione em Configurações → Configurações Gerais.</p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* 5 — detalhes */}
                  <section>
                    <SectionTitle n="5" title="Detalhes" desc="Etiquetas e dados adicionais (opcional)" />
                    <div className="space-y-4">
                      <div>
                        <Label hint={`${form.tags.length} selecionada${form.tags.length === 1 ? '' : 's'}`}>Etiquetas</Label>
                        <TagToggles tags={tags} selected={form.tags} onToggle={toggleTag} />
                      </div>

                      <button type="button" onClick={() => setMore((m) => !m)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300 hover:underline">
                        <ChevronDown size={14} className={cn('transition', more && 'rotate-180')} /> {more ? 'Ocultar dados adicionais' : 'Adicionar nascimento, CPF, sexo e e-mail'}
                      </button>
                      {more && (
                        <div className="grid sm:grid-cols-2 gap-3.5 fade-in">
                          <div>
                            <Label hint="opcional">Nascimento</Label>
                            <IconInput type="date" icon={<Calendar size={15} />} value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
                          </div>
                          <div>
                            <Label hint="opcional">CPF</Label>
                            <IconInput icon={<IdCard size={15} />} value={form.cpf} onChange={(e) => set({ cpf: fmtCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" />
                          </div>
                          <div>
                            <Label hint="opcional">Sexo</Label>
                            <Select value={form.sexo} onChange={(e) => set({ sexo: e.target.value })}>
                              <option value="">Selecione…</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Outro">Outro</option>
                            </Select>
                          </div>
                          <div>
                            <Label hint="opcional">E-mail</Label>
                            <IconInput type="email" icon={<Mail size={15} />} value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@exemplo.com" />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label hint="opcional">Observação</Label>
                        <textarea value={form.observation} onChange={(e) => set({ observation: e.target.value })}
                          placeholder="Algum detalhe importante para o primeiro atendimento?" autoComplete="off"
                          className={cn(inputCls, '!h-auto py-3 resize-none leading-relaxed')} rows={2} />
                      </div>
                    </div>
                  </section>
                </div>

                {/* footer */}
                <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-ink-900">
                  <button type="button" onClick={reset} className="text-[12px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition hidden sm:block">Limpar</button>
                  <div className="flex items-center gap-2 ml-auto">
                    <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl text-[13.5px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06] transition">Cancelar</button>
                    <button type="submit" disabled={!canSubmit || loading}
                      className="h-11 px-5 rounded-xl text-[13.5px] font-semibold inline-flex items-center gap-2 transition active:scale-[.98]
                        bg-brand-600 text-white hover:bg-brand-700 shadow-[0_10px_24px_-8px_rgba(43,89,255,.7)]
                        disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
                      {loading ? <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span> Salvando…</> : <><Zap size={15} /> Cadastrar lead</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── View de sucesso ──
function SuccessView({ form, statusObj, sources, tags, onView, onAgain }) {
  return (
    <div className="flex-1 grid place-items-center px-6 py-14 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-transparent dark:from-emerald-500/[0.06] pointer-events-none"></div>
      <div className="text-center fade-in relative max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 grid place-items-center mx-auto mb-5 check-pop">
          <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="font-display text-[22px] font-bold tracking-tight">Lead cadastrado!</h3>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-200">{form.name}</strong> entrou no funil em <strong className="text-slate-700 dark:text-slate-200">{form.status}</strong>.
        </p>
        <div className="mt-5 max-w-[260px] mx-auto text-left"><PreviewCard form={form} statusObj={statusObj} sources={sources} tags={tags} /></div>
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={onView} className="h-10 px-4 rounded-xl text-[13px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200">Ver ficha</button>
          <button onClick={onAgain} className="h-10 px-4 rounded-xl text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center gap-1.5"><Zap size={14} /> Cadastrar outro</button>
        </div>
      </div>
    </div>
  );
}

export { AddLeadModal };
