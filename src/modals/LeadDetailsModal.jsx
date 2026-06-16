import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { isAdminUser, canEditLead, getInteractionSecurityFields } from '../lib/leads.js';
import { normalizeAppointmentType } from '../lib/dates.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn, IconBtn } from '../components/ui/Btn.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { StatusBadge, TagBadge } from '../components/ui/Badges.jsx';
import { LossReasonModal } from './LossReasonModal.jsx';
import { settingsColorTone } from '../components/ui/ColorPicker.jsx';
import { Ban, BookOpen, Building2, Calendar, Check, CheckCircle, ChevronRight, Clock, Dumbbell, MessageCircle, Phone, RefreshCw, Search, Tag, ThumbsDown, Trash, TrendingUp, Trophy, Users, X } from 'lucide-react';

const interactionToneMap = {
  blue: {
    dot: 'bg-blue-500 text-white',
    card: 'border-blue-500/20 bg-blue-500/5',
    pill: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-blue-600 dark:text-blue-200/70'
  },
  green: {
    dot: 'bg-green-500 text-white',
    card: 'border-green-500/20 bg-green-500/5',
    pill: 'bg-green-500/10 text-green-700 dark:text-green-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-green-600 dark:text-green-200/70'
  },
  yellow: {
    dot: 'bg-yellow-400 text-yellow-900',
    card: 'border-yellow-500/30 bg-yellow-500/10',
    pill: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-yellow-600 dark:text-yellow-400/80'
  },
  purple: {
    dot: 'bg-purple-500 text-white',
    card: 'border-purple-500/20 bg-purple-500/5',
    pill: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-purple-600 dark:text-purple-200/70'
  },
  red: {
    dot: 'bg-red-500 text-white',
    card: 'border-red-500/20 bg-red-500/5',
    pill: 'bg-red-500/10 text-red-700 dark:text-red-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-red-600 dark:text-red-200/70'
  },
  orange: {
    dot: 'bg-blue-600 text-white',
    card: 'border-blue-600/20 bg-blue-600/5',
    pill: 'bg-blue-600/10 text-blue-700 dark:text-blue-400',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-blue-600 dark:text-blue-400/70'
  },
  gray: {
    dot: 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300',
    card: 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60',
    pill: 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300',
    text: 'text-gray-800 dark:text-neutral-200',
    meta: 'text-gray-500 dark:text-neutral-500'
  }
};



const extractStageNameFromInteractionText = (text = '') => {
  const match = String(text).match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : '';
};

const getStageTone = (statusName, statusesArray = []) => {
  if (statusName === 'Venda') return interactionToneMap.green;
  if (statusName === 'Perda') return interactionToneMap.red;

  const statusObj = (statusesArray || []).find(s => s.name === statusName);
  const color = statusObj?.color || 'orange';

  return interactionToneMap[color] || interactionToneMap.orange;
};

const getInteractionVisual = (interaction, statusesArray = []) => {
  const text = String(interaction?.text || '');
  const lower = text.toLowerCase();
  const stageName = extractStageNameFromInteractionText(text);

  if (stageName) {
    return {
      stageName,
      label: 'Mudança de etapa',
      icon: RefreshCw,
      ...getStageTone(stageName, statusesArray)
    };
  }

  if (lower.includes('matrícula') || lower.includes('venda')) {
    return { label: 'Venda', icon: Trophy, ...interactionToneMap.green };
  }

  if (lower.includes('perda') || lower.includes('perdido')) {
    return { label: 'Perda', icon: ThumbsDown, ...interactionToneMap.red };
  }

  if (lower.includes('aula')) {
    return { label: 'Aula experimental', icon: Calendar, ...interactionToneMap.purple };
  }

  if (lower.includes('visita')) {
    return { label: 'Visita', icon: Users, ...interactionToneMap.yellow };
  }

  if (lower.includes('csat')) {
    return { label: 'CSAT', icon: CheckCircle, ...interactionToneMap.blue };
  }

  if (lower.includes('ligação')) {
    return { label: 'Ligação', icon: Phone, ...interactionToneMap.orange };
  }

  if (lower.includes('mensagem')) {
    return { label: 'Mensagem', icon: MessageCircle, ...interactionToneMap.gray };
  }

  return interaction?.type === 'status_change'
    ? { label: 'Atualização', icon: RefreshCw, ...interactionToneMap.orange }
    : { label: 'Observação', icon: MessageCircle, ...interactionToneMap.gray };
};

// ==========================================
// SCHEDULE WIZARD (agendamento passo a passo)
// ==========================================
// Recriação do design_agendamento/wizard.jsx no nosso stack. Reaproveita
// modalidades, opções de aulas (trialClassOptions) e unidades das Config
// Gerais (via GeneralConfigContext). onConfirm devolve o agendamento montado
// e o LeadDetailsModal grava nos campos canônicos.
const WIZ_TONES = {
  brand:   { dot:'bg-brand-600',   text:'text-brand-700',   soft:'bg-brand-50',   strong:'bg-brand-600',   ring:'ring-brand-300',   darkText:'dark:text-brand-300',   darkSoft:'dark:bg-brand-500/10',   darkRing:'dark:ring-brand-500/40' },
  emerald: { dot:'bg-emerald-500', text:'text-emerald-700', soft:'bg-emerald-50', strong:'bg-emerald-500', ring:'ring-emerald-300', darkText:'dark:text-emerald-300', darkSoft:'dark:bg-emerald-500/10', darkRing:'dark:ring-emerald-500/40' },
  amber:   { dot:'bg-amber-500',   text:'text-amber-700',   soft:'bg-amber-50',   strong:'bg-amber-500',   ring:'ring-amber-300',   darkText:'dark:text-amber-300',   darkSoft:'dark:bg-amber-500/10',   darkRing:'dark:ring-amber-500/40' },
  violet:  { dot:'bg-violet-500',  text:'text-violet-700',  soft:'bg-violet-50',  strong:'bg-violet-500',  ring:'ring-violet-300',  darkText:'dark:text-violet-300',  darkSoft:'dark:bg-violet-500/10',  darkRing:'dark:ring-violet-500/40' },
  teal:    { dot:'bg-teal-500',    text:'text-teal-700',    soft:'bg-teal-50',    strong:'bg-teal-500',    ring:'ring-teal-300',    darkText:'dark:text-teal-300',    darkSoft:'dark:bg-teal-500/10',    darkRing:'dark:ring-teal-500/40' },
};

const WIZ_TYPES = [
  { id:'mensagem', label:'Mensagem',          followUpLabel:'Mensagem',          desc:'Follow-up por WhatsApp', Icon: MessageCircle, color:'emerald', flow:['datahora'] },
  { id:'ligacao',  label:'Ligação',           followUpLabel:'Ligação',           desc:'Retorno por telefone',   Icon: Phone,         color:'amber',   flow:['datahora'] },
  { id:'visita',   label:'Visita',            followUpLabel:'Visita',            desc:'Conhecer a unidade',     Icon: Building2,     color:'violet',  flow:['unidade','datahora'] },
  { id:'aula',     label:'Aula experimental', followUpLabel:'Aula Experimental', desc:'Treino de experiência',  Icon: BookOpen,      color:'teal',    flow:['modalidade','quantidade','datahora'] },
];

const WIZ_STEP_INFO = {
  modalidade: { title: 'Modalidade',                 hint: 'Qual treino o lead vai experimentar?' },
  quantidade: { title: 'Quantas aulas experimentais', hint: 'O que foi combinado com o aluno.' },
  unidade:    { title: 'Unidade',                    hint: 'Onde a visita vai acontecer?' },
  datahora:   { title: 'Dia e horário',              hint: 'Quando vai ser?' },
};

const wizFmtDateTime = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' }).replace('.', '');
  const time = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `${day} · ${time}`;
};
const wizToLocalInput = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const wizQuickSlots = () => {
  const mk = (daysAhead, h, m = 0) => { const d = new Date(); d.setDate(d.getDate()+daysAhead); d.setHours(h, m, 0, 0); return d; };
  const nextSat = () => { const d = new Date(); const add = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate()+add); d.setHours(10,0,0,0); return d; };
  return [
    { id:'today18', label:'Hoje',   time:'18:00', date: mk(0,18) },
    { id:'tmw09',   label:'Amanhã', time:'09:00', date: mk(1,9)  },
    { id:'tmw18',   label:'Amanhã', time:'18:00', date: mk(1,18) },
    { id:'sat10',   label:'Sábado', time:'10:00', date: nextSat() },
  ];
};

function WizStepDot({ state, n, color = 'brand' }) {
  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  if (state === 'done') {
    return <span className={`w-7 h-7 rounded-full grid place-items-center ${t.strong} text-white shrink-0 check-pop`}><Check size={14} /></span>;
  }
  if (state === 'active') {
    return <span className={`w-7 h-7 rounded-full grid place-items-center bg-white dark:bg-neutral-900 ring-2 ${t.ring} ${t.darkRing} ${t.text} ${t.darkText} text-[12px] font-bold num shrink-0`}>{n}</span>;
  }
  return <span className="w-7 h-7 rounded-full grid place-items-center bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 text-[12px] font-bold num shrink-0">{n}</span>;
}

function WizOptionCard({ Icon, label, hint, selected, color = 'brand', badge, onClick, index = 0 }) {
  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${index*40}ms` }}
      className={`opt-in relative text-left rounded-xl border p-3 transition group ${
        selected
          ? `${t.soft} ${t.darkSoft} border-transparent ring-2 ${t.ring} ${t.darkRing}`
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15'
      }`}>
      {badge && <span className={`absolute top-2 right-2 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${t.strong} text-white`}>{badge}</span>}
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 transition ${selected ? `${t.strong} text-white` : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]'}`}>
            <Icon size={16} />
          </span>
        )}
        <div className="min-w-0">
          <div className={`text-[13.5px] font-semibold leading-tight ${selected ? `${t.text} ${t.darkText}` : 'text-slate-900 dark:text-white'}`}>{label}</div>
          {hint && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{hint}</div>}
        </div>
        {selected && <span className={`ml-auto w-5 h-5 rounded-full grid place-items-center ${t.strong} text-white check-pop shrink-0`}><Check size={12} /></span>}
      </div>
    </button>
  );
}

function WizPill({ label, hint, selected, color = 'brand', badge, onClick, index = 0 }) {
  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${index*40}ms` }}
      className={`opt-in relative rounded-xl border px-3 py-2.5 text-center transition ${
        selected
          ? `${t.soft} ${t.darkSoft} border-transparent ring-2 ${t.ring} ${t.darkRing}`
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15'
      }`}>
      {badge && <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${t.strong} text-white whitespace-nowrap`}>{badge}</span>}
      <div className={`text-[14px] font-semibold ${selected ? `${t.text} ${t.darkText}` : 'text-slate-900 dark:text-white'}`}>{label}</div>
      {hint && <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">{hint}</div>}
    </button>
  );
}

function ScheduleWizard({ onConfirm, onCancel, submitting = false }) {
  const { modalities, trialClassOptions, units } = useGeneralConfig();
  const [typeId, setTypeId] = useState(null);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');

  const type = WIZ_TYPES.find(t => t.id === typeId) || null;
  const flow = type ? type.flow : [];
  const color = type ? type.color : 'brand';

  const firstIncomplete = useMemo(() => {
    for (const s of flow) { if (values[s] == null || values[s] === '') return s; }
    return null;
  }, [flow, values]);

  const activeStep = editing || firstIncomplete;
  const complete = Boolean(type) && firstIncomplete === null;

  const setVal = (key, val) => {
    setValues(v => {
      const next = { ...v, [key]: val };
      const idx = flow.indexOf(key);
      if (idx !== -1) flow.slice(idx + 1).forEach(s => { delete next[s]; });
      return next;
    });
    setEditing(null);
  };

  const pickType = (id) => { setTypeId(id); setValues({}); setEditing(null); };
  const resetAll = () => { setTypeId(null); setValues({}); setEditing(null); setNote(''); };

  const stepState = (stepId) => {
    if (stepId === activeStep) return 'active';
    if (values[stepId] != null && values[stepId] !== '') return 'done';
    const idx = flow.indexOf(stepId);
    const firstIdx = activeStep ? flow.indexOf(activeStep) : flow.length;
    return idx < firstIdx ? 'done' : 'locked';
  };

  const summaryFor = (stepId) => {
    switch (stepId) {
      case 'modalidade': return values.modalidade || null;
      case 'quantidade': return values.quantidade ? `${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}` : null;
      case 'unidade':    return values.unidade ? `Unidade ${values.unidade}` : null;
      case 'datahora':   return values.datahora ? wizFmtDateTime(values.datahora) : null;
      default: return null;
    }
  };

  const quickSlots = useMemo(() => wizQuickSlots(), []);
  const qtyOptions = (trialClassOptions && trialClassOptions.length ? trialClassOptions : [1]);

  const renderStepBody = (stepId) => {
    if (stepId === 'modalidade') {
      if (!(modalities || []).length) {
        return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Nenhuma modalidade cadastrada. Adicione em <span className="font-semibold">Configurações → Configurações Gerais</span>.</p>;
      }
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {modalities.map((m, i) => (
            <WizOptionCard key={m.id} index={i} Icon={Dumbbell} label={m.name} color={color}
              selected={values.modalidade === m.name} onClick={() => setVal('modalidade', m.name)} />
          ))}
        </div>
      );
    }
    if (stepId === 'quantidade') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {qtyOptions.map((n, i) => (
            <WizPill key={n} index={i} label={`${n} ${n === 1 ? 'aula' : 'aulas'}`} color={color}
              selected={values.quantidade === n} onClick={() => setVal('quantidade', n)} />
          ))}
        </div>
      );
    }
    if (stepId === 'unidade') {
      if (!(units || []).length) {
        return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Nenhuma unidade cadastrada. Adicione em <span className="font-semibold">Configurações → Configurações Gerais</span>.</p>;
      }
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {units.map((u, i) => (
            <WizOptionCard key={u.id} index={i} Icon={Building2} label={u.name} hint={u.address} color={color}
              selected={values.unidade === u.name} onClick={() => setVal('unidade', u.name)} />
          ))}
        </div>
      );
    }
    // datahora
    const selectedISO = values.datahora ? wizToLocalInput(values.datahora) : '';
    return (
      <div className="space-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Horários sugeridos</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickSlots.map((s, i) => (
              <WizPill key={s.id} index={i} label={s.label} hint={s.time} color={color}
                selected={values.datahora && wizToLocalInput(values.datahora) === wizToLocalInput(s.date)}
                onClick={() => setVal('datahora', s.date)} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Ou escolha manualmente</div>
          <div className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="datetime-local" value={selectedISO}
              onChange={(e) => setVal('datahora', e.target.value ? new Date(e.target.value) : null)}
              className="w-full h-11 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-slate-400 dark:focus:border-white/20 outline-none text-[13.5px] num pl-9 pr-3 transition" />
          </div>
        </div>
      </div>
    );
  };

  const renderStepRow = (stepId, n, isLast) => {
    const info = WIZ_STEP_INFO[stepId];
    const t = WIZ_TONES[color] || WIZ_TONES.brand;
    const state = stepState(stepId);
    const summary = summaryFor(stepId);
    return (
      <div key={stepId} className="relative flex gap-3">
        <div className="flex flex-col items-center">
          <WizStepDot state={state} n={n} color={color} />
          {!isLast && <div className={`conn w-px flex-1 mt-1 mb-1 ${state === 'done' ? t.strong : 'bg-slate-200 dark:bg-white/[0.08]'}`} />}
        </div>
        <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
          {state === 'locked' ? (
            <div className="pt-0.5 opacity-50 select-none">
              <div className="text-[13.5px] font-semibold text-slate-400 dark:text-slate-500">{info.title}</div>
            </div>
          ) : state === 'done' ? (
            <button type="button" onClick={() => setEditing(stepId)}
              className="sum-in w-full text-left group rounded-xl border border-border bg-card px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{info.title}</div>
                <div className={`text-[13.5px] font-semibold ${t.text} ${t.darkText} truncate mt-0.5`}>{summary}</div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 whitespace-nowrap shrink-0"><RefreshCw size={12} /> Editar</span>
            </button>
          ) : (
            <div className="step-reveal pt-0.5">
              <div className="mb-2.5">
                <div className="text-[14px] font-semibold text-slate-900 dark:text-white">{info.title}</div>
                {info.hint && <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{info.hint}</div>}
              </div>
              {renderStepBody(stepId)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  const summaryParts = [];
  if (values.modalidade) summaryParts.push(values.modalidade);
  if (values.quantidade) summaryParts.push(`${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}`);
  if (values.unidade) summaryParts.push(`Unidade ${values.unidade}`);
  const doneCount = flow.filter(s => values[s] != null && values[s] !== '').length + 1;
  const totalCount = flow.length + 1;

  const handleConfirm = () => {
    if (!complete || !type) return;
    onConfirm({
      typeId: type.id,
      typeLabel: type.followUpLabel,
      date: values.datahora,
      modalidade: type.id === 'aula' ? (values.modalidade || null) : null,
      quantidade: type.id === 'aula' ? (values.quantidade || null) : null,
      unidade: type.id === 'visita' ? (values.unidade || null) : null,
      note: note.trim()
    });
    resetAll();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
      {/* stepper */}
      <div className="min-w-0">
        <div className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <WizStepDot state={type ? 'done' : 'active'} n={1} color={color} />
            <div className={`conn w-px flex-1 mt-1 mb-1 ${type ? t.strong : 'bg-slate-200 dark:bg-white/[0.08]'}`} />
          </div>
          <div className="flex-1 min-w-0 pb-5">
            {type ? (
              <button type="button" onClick={() => pickType(null)}
                className="sum-in w-full text-left group rounded-xl border border-border bg-card px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center gap-3">
                <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${t.strong} text-white`}><type.Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tipo de agendamento</div>
                  <div className={`text-[13.5px] font-semibold ${t.text} ${t.darkText} truncate`}>{type.label}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 whitespace-nowrap shrink-0"><RefreshCw size={12} /> Trocar</span>
              </button>
            ) : (
              <div className="step-reveal pt-0.5">
                <div className="mb-2.5">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-white">O que você quer agendar?</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Escolha o tipo para liberar os próximos passos.</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {WIZ_TYPES.map((tp, i) => (
                    <WizOptionCard key={tp.id} index={i} Icon={tp.Icon} label={tp.label} hint={tp.desc} color={tp.color}
                      selected={false} onClick={() => pickType(tp.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {flow.map((stepId, i) => renderStepRow(stepId, i + 2, i === flow.length - 1))}

        {type && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/[0.06] step-reveal">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Anotação (opcional)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="O que precisa ser tratado nesse contato?"
              className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-slate-300 dark:focus:border-white/15 outline-none text-[13px] p-3 placeholder:text-slate-400 resize-none transition" />
          </div>
        )}
      </div>

      {/* summary + actions */}
      <aside className="lg:sticky lg:top-4 self-start space-y-3">
        {type ? (
          <div className={`rounded-xl border p-3.5 ${complete ? `${t.soft} ${t.darkSoft} border-transparent` : 'bg-slate-50 border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06]'}`}>
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${complete ? `${t.strong} text-white` : 'bg-white text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}><type.Icon size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resumo do agendamento</div>
                <div className="text-[14px] font-semibold text-slate-900 dark:text-white mt-0.5">{type.label}</div>
                {summaryParts.length > 0 && <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">{summaryParts.join(' · ')}</div>}
                {values.datahora ? (
                  <div className={`inline-flex items-center gap-1.5 mt-2 text-[12.5px] font-semibold ${t.text} ${t.darkText}`}><Calendar size={13} /> {wizFmtDateTime(values.datahora)}</div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 mt-2 text-[12px] text-slate-400 dark:text-slate-500"><Clock size={12} /> Falta definir dia e horário</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.1] p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mx-auto mb-2 text-slate-400"><Calendar size={18} /></div>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Escolha o tipo de agendamento para começar.</p>
          </div>
        )}

        {type && (
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Progresso</span>
              <span className="num text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">{doneCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
              <div className={`h-full ${t.strong}`} style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`, transition: 'width .4s' }} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Btn kind="brand" icon={<Check size={15} />} disabled={!complete || submitting} onClick={handleConfirm}>
            {submitting ? 'Salvando...' : complete ? 'Confirmar agendamento' : 'Complete os passos'}
          </Btn>
          <Btn kind="soft" onClick={() => { resetAll(); onCancel && onCancel(); }}>Cancelar</Btn>
        </div>
      </aside>
    </div>
  );
}

function LeadDetailsModal({ lead, interactions, onClose, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  const toast = useToast();
  const isReadOnly = !canEditLead(appUser, lead);
  // Linha do tempo COLABORATIVA: qualquer consultor do tenant pode escrever
  // notas/interações e agendar na timeline de QUALQUER lead (base compartilhada,
  // PR #101) — mesmo não sendo o responsável. Edição dos dados do lead,
  // Venda/Perda, reatribuição de responsável e exclusão seguem com dono/admin
  // (isReadOnly / isAdminUser). As regras do Firestore já permitem interações
  // por qualquer membro do tenant, então não há mudança de rules.
  const canTimeline = Boolean(appUser?.authUid);
  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const fallbackFunnelId = lead.funnelId || getDefaultFunnel(safeFunnels)?.id || null;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(lead.status);
  const [funnelId, setFunnelId] = useState(fallbackFunnelId);
  const [loading, setLoading] = useState(false);
  // Agendamento agora é feito pelo ScheduleWizard (aba "Agendar" do composer).

  const [lossModalOpen, setLossModalOpen] = useState(false);

  // Composer tab — drives which form is shown in the activity Composer card.
  const [composerTab, setComposerTab] = useState('note');

  // Timeline filter + search
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineQuery, setTimelineQuery] = useState('');

  const statusesForFunnel = (statuses || []).filter(s => s.funnelId === funnelId);

  useEffect(() => {
    setEditData({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
    setStatus(lead.status);
    setFunnelId(lead.funnelId || getDefaultFunnel(safeFunnels)?.id || null);
  }, [lead]);

  const handleFunnelChange = (newFunnelId) => {
    setFunnelId(newFunnelId);
    // Se o lead estava em uma etapa que não existe no novo funil, alinhar para a primeira
    const nextStatuses = (statuses || []).filter(s => s.funnelId === newFunnelId);
    if (status !== 'Venda' && status !== 'Perda') {
      const stillValid = nextStatuses.some(s => s.name === status);
      if (!stillValid) {
        setStatus(nextStatuses[0]?.name || status);
      }
    }
  };

  const handleWhatsApp = () => { 
    let n = lead.whatsapp.replace(/\D/g, ''); 
    if(n.length <= 11) n='55'+n; 
    window.open(`https://wa.me/${n}?text=Ol%C3%A1%20${encodeURIComponent(lead.name)}`); 
  };
  

  const handleDelete = async () => {
    if (!window.confirm("⚠️ AÇÃO IRREVERSÍVEL: Deseja EXCLUIR este lead permanentemente?")) return;
    setLoading(true);
    try {
      // Apaga as interações ligadas ao lead (senão ficam órfãs na coleção).
      // Em lotes de 450 (limite do writeBatch é 500) para suportar qualquer volume.
      const interSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        where('leadId', '==', lead.id)
      ));
      const interDocs = interSnap.docs;
      for (let i = 0; i < interDocs.length; i += 450) {
        const batch = writeBatch(db);
        interDocs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id));
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir o lead. Tente novamente.');
      setLoading(false);
    }
  };

  const handleUpdateLead = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para editar este lead.'); return; }
    setLoading(true);
    try {
      let finalData = { ...editData };
      if (finalData.consultantId) {
        const c = (usersList || []).find(u => u.id === finalData.consultantId);
        if (c) finalData.consultantName = c.name;
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), finalData);
      setIsEditing(false);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleWin = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!window.confirm("Confirmar matrícula deste lead?")) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Venda',
        nextFollowUp: null,
        isConverted: true,
        convertedAt: serverTimestamp(),
        // Limpa resquício caso o lead viesse de Perda.
        lossReason: null,
        lostAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Matrícula realizada com sucesso! (Venda)`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setStatus('Venda');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar a matrícula. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Perda',
        lossReason: reason,
        nextFollowUp: null,
        lostAt: serverTimestamp(),
        // Limpa resquício caso o lead viesse de Venda.
        isConverted: false,
        convertedAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Lead perdido. Motivo: ${reason}`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setLossModalOpen(false);
      setStatus('Perda');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar a perda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Anotação / Mudar fase / Mover funil. O agendamento é tratado pelo
  // ScheduleWizard via handleWizardConfirm.
  const saveInteraction = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const funnelChanged = Boolean(lead.funnelId) && funnelId && funnelId !== lead.funnelId;
    if (!note.trim() && status === lead.status && !funnelChanged) return;
    setLoading(true);
    try {
      let actionText = '';
      if (funnelChanged) {
        const newFunnelName = safeFunnels.find(f => f.id === funnelId)?.name || 'outro funil';
        actionText += `Lead movido para o funil [${newFunnelName}]. `;
      }
      if (status !== lead.status) actionText += `Fase alterada para [${status}]. `;
      if (note) actionText += `Obs: ${note}. `;

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: actionText || 'Atualização registrada.',
        type: (status !== lead.status || funnelChanged) ? 'status_change' : 'note',
        createdAt: serverTimestamp()
      });

      const up = { status };
      if (funnelChanged) up.funnelId = funnelId;
      // Saindo de Venda/Perda para outra fase: limpa os campos de
      // resolução, senão o lead segue contando como matrícula/perda.
      if (lead.status === 'Venda' && status !== 'Venda') {
        up.isConverted = false;
        up.convertedAt = null;
      }
      if (lead.status === 'Perda' && status !== 'Perda') {
        up.lossReason = null;
        up.lostAt = null;
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      setNote('');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar.');
      setLoading(false);
    }
  };

  // Grava o agendamento montado no ScheduleWizard. Mantém os campos canônicos
  // (nextFollowUp/nextFollowUpType/appointmentType/appointmentScheduledFor) e
  // grava os extras por tipo (modalidade+quantidade p/ aula; unidade p/ visita).
  const handleWizardConfirm = async ({ typeLabel, date, modalidade, quantidade, unidade, note: wizNote }) => {
    if (!canTimeline) { toast.warning('Você não tem permissão para agendar neste lead.'); return; }
    if (!(date instanceof Date) || isNaN(date.getTime())) { toast.warning('Selecione o dia e o horário.'); return; }
    setLoading(true);
    try {
      const appointmentType = normalizeAppointmentType(typeLabel); // 'visita' | 'aula_experimental' | null
      const isAula = appointmentType === 'aula_experimental';
      const isVisita = appointmentType === 'visita';

      let extra = '';
      if (isAula) {
        const q = quantidade || 1;
        extra = ` (${modalidade ? modalidade + ' · ' : ''}${q} ${q === 1 ? 'aula' : 'aulas'})`;
      } else if (isVisita && unidade) {
        extra = ` (Unidade ${unidade})`;
      }
      const dateStr = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const noteStr = (wizNote || '').trim();
      const text = `🔔 ${typeLabel} agendada${extra} p/ ${dateStr}.` + (noteStr ? ` Obs: ${noteStr}` : '');

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text,
        type: 'note',
        // Meta por VOLUME: todo agendamento criado pelo wizard conta como ação
        // de pipeline (visita/aula/mensagem/ligação) — ver lib/dailyGoal.js.
        volumeKind: appointmentType || (/liga/i.test(typeLabel) ? 'ligacao' : 'mensagem'),
        createdAt: serverTimestamp()
      });

      const up = {
        nextFollowUp: date,
        nextFollowUpType: typeLabel,
        // Observação do agendamento, exibida no card da Meta Diária.
        nextFollowUpNote: noteStr || null,
        // Limpa extras de agendamentos anteriores e grava só os do tipo atual.
        appointmentModality: isAula ? (modalidade || null) : null,
        trialClassesPlanned: isAula ? (quantidade || null) : null,
        appointmentUnit: isVisita ? (unidade || null) : null,
        appointmentType: appointmentType || null,
        appointmentScheduledFor: appointmentType ? date : null
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      toast.success(`Agendamento criado para ${dateStr}.`);
      setComposerTab('note');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o agendamento.');
      setLoading(false);
    }
  };

  // Composer tab handlers — each maps to the existing Firestore patterns.
  const handleSendWhatsAppMessage = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const msg = note.trim();
    if (!msg) { toast.warning('Escreva a mensagem antes de enviar.'); return; }
    setLoading(true);
    try {
      // Open WhatsApp Web with the typed message
      const num = String(lead.whatsapp || '').replace(/\D/g, '');
      const phone = num.length <= 11 ? '55' + num : num;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      // Log the outbound message in the timeline
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `📲 Mensagem WhatsApp enviada: ${msg}`,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar o envio.');
    }
    setLoading(false);
  };

  const handleLogCall = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const summary = note.trim();
    if (!summary) { toast.warning('Resuma o que rolou na ligação antes de salvar.'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `📞 Ligação: ${summary}`,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar a ligação.');
    }
    setLoading(false);
  };

  const handleComposerSubmit = () => {
    if (composerTab === 'whatsapp') return handleSendWhatsAppMessage();
    if (composerTab === 'call')     return handleLogCall();
    // 'note' e 'status' fluem pelo saveInteraction. 'schedule' é tratado pelo
    // próprio ScheduleWizard (tem seus botões).
    return saveInteraction();
  };

  const composerSubmitLabel =
    composerTab === 'whatsapp' ? 'Enviar' :
    composerTab === 'status'   ? 'Salvar fase' :
    'Salvar';

  const resetComposer = () => {
    setNote('');
    setStatus(lead.status);
    setFunnelId(fallbackFunnelId);
  };

  // Rendered via Portal at <body> level — escapes the <main>/header stacking
  // context where the global topbar's backdrop-blur creates its own layer and
  // would otherwise sit above this modal regardless of z-index.
  // ----- Derived computations for the redesigned shell -----
  const firstName = (lead.name || '').split(' ')[0] || 'lead';
  const ageDays = lead.createdAt
    ? Math.max(0, Math.floor((Date.now() - lead.createdAt.getTime()) / 86400000))
    : 0;
  const statusChangeCount = (interactions || []).filter(i => i.type === 'status_change').length;

  const groupTimeline = (events) => {
    const now = new Date();
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const todayKey = dayKey(now);
    const yKey = (() => { const y = new Date(now); y.setDate(y.getDate() - 1); return dayKey(y); })();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const map = new Map();
    events.forEach((e) => {
      const d = e.createdAt instanceof Date ? e.createdAt : null;
      if (!d) return;
      const k = dayKey(d);
      let label;
      if (k === todayKey) label = 'Hoje';
      else if (k === yKey) label = 'Ontem';
      else if (d >= startOfWeek) label = 'Esta semana';
      else if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) label = 'Este mês';
      else label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(e);
    });
    return Array.from(map.entries());
  };

  // Classify each interaction into one of the 5 design filter buckets.
  // Inference uses both the `type` field and prefixes injected by the composer.
  const classifyInteraction = (i) => {
    const t = String(i.text || '');
    if (i.type === 'status_change') return 'status';
    if (/^📲|whatsapp enviada/i.test(t) || /^📞/.test(t)) return 'conversation';
    if (/retorno agendado|🔔/i.test(t)) return 'appointment';
    if (/observação do cadastro|csat/i.test(t)) return 'system';
    if (i.type === 'note') return 'note';
    return 'system';
  };

  const TIMELINE_FILTERS = [
    { id: 'all',          label: 'Tudo' },
    { id: 'conversation', label: 'Conversas' },
    { id: 'status',       label: 'Mudanças' },
    { id: 'appointment',  label: 'Agendamentos' },
    { id: 'note',         label: 'Anotações' },
    { id: 'system',       label: 'Sistema' }
  ];

  const interactionsWithClass = (interactions || []).map(i => ({ ...i, _kind: classifyInteraction(i) }));

  const timelineCounts = (() => {
    const counts = { all: interactionsWithClass.length, conversation: 0, status: 0, appointment: 0, note: 0, system: 0 };
    interactionsWithClass.forEach(i => { counts[i._kind] = (counts[i._kind] || 0) + 1; });
    return counts;
  })();

  const filteredInteractions = (() => {
    let list = timelineFilter === 'all' ? interactionsWithClass : interactionsWithClass.filter(i => i._kind === timelineFilter);
    const q = timelineQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(i => `${i.text || ''} ${i.consultantName || ''}`.toLowerCase().includes(q));
    }
    return list;
  })();

  const groupedEvents = groupTimeline(filteredInteractions);

  // Detect appointment metadata embedded in an interaction's text so the
  // timeline can render the highlighted appointment card. Returns
  // `{ kind, label, when }` or null.
  const parseAppointment = (i) => {
    const t = String(i.text || '');
    if (!/retorno agendado|🔔/i.test(t)) return null;
    const typeMatch = t.match(/Retorno agendado \(([^)]+)\)/i);
    const dateMatch = t.match(/p\/\s*([\d/]+(?:[,\s]+[\d:]+)?)/i);
    const kindRaw = typeMatch ? typeMatch[1] : '';
    const lower = kindRaw.toLowerCase();
    let kind = 'follow', label = kindRaw || 'Próximo contato';
    if (lower.includes('aula')) { kind = 'class'; label = 'Aula experimental'; }
    else if (lower.includes('visita')) { kind = 'visit'; label = 'Visita à unidade'; }
    else if (lower.includes('ligação') || lower.includes('ligacao')) { kind = 'call'; label = 'Ligação'; }
    else if (lower.includes('mensagem')) { kind = 'message'; label = 'Mensagem'; }
    let when = null;
    if (dateMatch) {
      const raw = dateMatch[1].trim();
      const [datePart, timePart] = raw.split(/[,\s]+/);
      const dParts = (datePart || '').split('/');
      if (dParts.length === 3) {
        const [day, month, year] = dParts.map(n => parseInt(n, 10));
        const [hh, mm] = (timePart || '00:00').split(':').map(n => parseInt(n, 10) || 0);
        when = new Date(year, month - 1, day, hh, mm);
        if (isNaN(when.getTime())) when = null;
      }
    }
    return { kind, label, when };
  };

  return createPortal(
    <>
      {/* Backdrop: blur + dark overlay over the page behind the modal. Click to close. */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in"
      />
      <div className="fixed inset-0 z-[101] bg-paper-50 dark:bg-ink-950 md:inset-y-4 md:inset-x-4 md:rounded-3xl flex flex-col overflow-hidden animate-fade-in shadow-2xl font-sans">

        {/* TOP BAR */}
        <header className="h-16 border-b border-border bg-white/80 dark:bg-ink-900/70 backdrop-blur flex items-center justify-between gap-3 px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition">
              <ChevronRight size={14} className="rotate-180" /> Todos os leads
            </button>
            <span className="text-slate-300 dark:text-white/15 shrink-0">/</span>
            <span className="text-[14px] font-semibold truncate">{lead.name}</span>
            <StatusBadge statusName={lead.status} statusesArray={statuses} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditing && !isReadOnly && (
              <Btn kind="secondary" icon={<RefreshCw size={13} />} onClick={() => setIsEditing(true)}>Editar</Btn>
            )}
            {!isEditing && (
              <Btn
                kind="success"
                icon={<TrendingUp size={13} />}
                onClick={handleWin}
                disabled={lead.status === 'Venda' || loading}
                title={lead.status === 'Venda' ? 'Lead já marcado como venda' : 'Marcar venda'}
              >
                Marcar venda
              </Btn>
            )}
            {!isEditing && (
              <Btn
                kind="danger"
                icon={<Ban size={13} />}
                onClick={() => setLossModalOpen(true)}
                disabled={lead.status === 'Perda' || loading}
                title={lead.status === 'Perda' ? 'Lead já marcado como perda' : 'Marcar perda'}
              >
                Marcar perda
              </Btn>
            )}
            <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-1"></div>
            {!isEditing && isAdminUser(appUser) && (
              <IconBtn icon={<Trash size={15} />} kind="danger" title="Excluir lead" onClick={handleDelete} />
            )}
            <IconBtn icon={<X size={15} />} title="Fechar" onClick={onClose} />
          </div>
        </header>

        {/* BODY: scrollable content with 12-col grid */}
        <div className="flex-1 overflow-y-auto thin-scroll">
          <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-6">
            <div className="grid grid-cols-12 gap-6">

              {/* LEFT: Lead Summary (sticky) */}
              <div className="col-span-12 lg:col-span-4 xl:col-span-3">
                {isEditing ? (
                  <aside className="rounded-2xl border border-border bg-card shadow-card p-5 space-y-4 lg:sticky lg:top-4">
                    <h3 className="text-[15px] font-semibold">Editar cadastro</h3>
                    <Field label="Nome completo">
                      <StyledInput value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                    </Field>
                    <Field label="WhatsApp">
                      <StyledInput type="tel" value={editData.whatsapp} onChange={e => setEditData({ ...editData, whatsapp: e.target.value })} />
                    </Field>
                    <Field label="Origem">
                      <StyledInput value={editData.source} onChange={e => setEditData({ ...editData, source: e.target.value })} />
                    </Field>
                    <Field label="Consultor responsável">
                      <StyledSelect value={editData.consultantId} onChange={e => setEditData({ ...editData, consultantId: e.target.value })}>
                        <option value="">Selecione um consultor...</option>
                        {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </StyledSelect>
                    </Field>
                    <Field label="Etiquetas">
                      <div className="flex flex-wrap gap-1.5">
                        {(tags || []).map(t => {
                          const active = editData.tags.includes(t.name);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setEditData(prev => ({ ...prev, tags: active ? prev.tags.filter(x => x !== t.name) : [...prev.tags, t.name] }))}
                              className={`px-2 py-1 rounded-md text-[11.5px] font-semibold border transition ${
                                active
                                  ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07]'
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Observação fixa (contexto inicial)">
                      <textarea
                        value={editData.observation}
                        onChange={e => setEditData({ ...editData, observation: e.target.value })}
                        rows={4}
                        className="w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                      />
                    </Field>
                    <div className="flex gap-2 pt-2">
                      <Btn kind="soft" onClick={() => setIsEditing(false)} className="flex-1">Cancelar</Btn>
                      <Btn kind="brand" icon={<Check size={13} />} onClick={handleUpdateLead} disabled={loading}>Salvar</Btn>
                    </div>
                  </aside>
                ) : (
                  <aside className="rounded-2xl border border-border bg-card shadow-card overflow-hidden lg:sticky lg:top-4">
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        <Avatar name={lead.name} size={56} />
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-[20px] font-semibold tracking-tight truncate">{lead.name}</h2>
                          <button
                            onClick={handleWhatsApp}
                            className="text-[12.5px] text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 font-medium num inline-flex items-center gap-1 transition"
                            title="Abrir no WhatsApp"
                          >
                            <Phone size={11} /> {lead.whatsapp}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {(lead.tags || []).map(tName => (
                          <TagBadge key={tName} tagName={tName} tagsArray={tags} />
                        ))}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Btn kind="primary" icon={<MessageCircle size={14} />} onClick={handleWhatsApp}>WhatsApp</Btn>
                        <Btn kind="secondary" icon={<Phone size={14} />} onClick={() => { const num = String(lead.whatsapp || '').replace(/\D/g, ''); if (num) window.location.href = `tel:${num}`; }}>Ligar</Btn>
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="px-5 py-4 grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-white/[0.05]">
                      <div className="text-center">
                        <div className="num text-[18px] font-semibold tracking-tight leading-none">{ageDays}d</div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">Idade do lead</div>
                      </div>
                      <div className="text-center">
                        <div className="num text-[18px] font-semibold tracking-tight leading-none">{(interactions || []).length}</div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">Interações</div>
                      </div>
                      <div className="text-center">
                        <div className="num text-[18px] font-semibold tracking-tight leading-none">{statusChangeCount + 1}</div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">Etapas</div>
                      </div>
                    </div>

                    {/* Info rows */}
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.05] space-y-3.5">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Tag size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Origem</div>
                          <div className="text-[13px] text-slate-800 dark:text-slate-100 mt-0.5">{lead.source || '—'}</div>
                        </div>
                      </div>
                      {lead.consultantName && (
                        <div className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Users size={13} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Consultor</div>
                            <div className="text-[13px] text-slate-800 dark:text-slate-100 mt-0.5 inline-flex items-center gap-2">
                              <Avatar name={lead.consultantName} size={20} />
                              <span className="truncate">{lead.consultantName}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Calendar size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Cadastrado em</div>
                          <div className="text-[13px] text-slate-800 dark:text-slate-100 mt-0.5 num">
                            {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                            {lead.createdAt && <> · {lead.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Clock size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Próximo contato</div>
                          <div className="text-[13px] mt-0.5">
                            {lead.nextFollowUp ? (
                              <span className="num font-medium text-slate-800 dark:text-slate-100">
                                {lead.nextFollowUp.toLocaleDateString('pt-BR')} às {lead.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="italic text-slate-400 dark:text-slate-500">Sem agendamento</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Loss banner */}
                    {lead.status === 'Perda' && lead.lossReason && (
                      <div className="mx-5 mb-4 p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-2.5">
                        <ThumbsDown size={14} className="text-rose-600 dark:text-rose-300 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">Motivo da perda</p>
                          <p className="text-[12.5px] font-medium text-rose-800 dark:text-rose-200 mt-0.5">{lead.lossReason}</p>
                        </div>
                      </div>
                    )}

                    {/* Observação */}
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.05]">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Contexto inicial</div>
                      <p className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {lead.observation || <span className="italic text-slate-400">Nenhuma observação registrada no momento do cadastro.</span>}
                      </p>
                    </div>

                  </aside>
                )}
              </div>

              {/* RIGHT: Timeline */}
              <div className="col-span-12 lg:col-span-8 xl:col-span-9 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <Clock size={13} className="text-brand-600" /> Linha do tempo
                  </div>
                  <h2 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight leading-tight">
                    Jornada de {firstName}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                    Todas as interações, agendamentos e mudanças de fase em ordem cronológica.
                  </p>
                </div>

                {/* Composer with tabs */}
                <section className="rounded-2xl border border-border bg-card shadow-card">
                  {/* Tabs */}
                  <div className="px-4 pt-3 flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
                    {[
                      { id: 'note',     label: 'Anotação',   icon: <MessageCircle size={13} /> },
                      { id: 'whatsapp', label: 'WhatsApp',   icon: <MessageCircle size={13} /> },
                      { id: 'call',     label: 'Ligação',    icon: <Phone size={13} /> },
                      { id: 'status',   label: 'Mudar fase', icon: <RefreshCw size={13} /> },
                      { id: 'schedule', label: 'Agendar',    icon: <Calendar size={13} /> }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setComposerTab(t.id)}
                        className={`inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] font-medium rounded-t-md transition border-b-2 -mb-px whitespace-nowrap ${
                          composerTab === t.id
                            ? 'text-slate-900 dark:text-white border-brand-600'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-transparent'
                        }`}
                      >
                        {t.icon}{t.label}
                      </button>
                    ))}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <div className="flex gap-3">
                      <Avatar name={appUser?.name || 'Você'} size={32} />
                      <div className="flex-1 min-w-0 space-y-3">

                        {composerTab === 'note' && (
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="O que rolou nessa conversa? Detalhes que vão te ajudar no próximo contato..."
                            rows={3}
                            className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                          />
                        )}

                        {composerTab === 'whatsapp' && (
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={`Mensagem para ${firstName}...`}
                            rows={3}
                            className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                          />
                        )}

                        {composerTab === 'call' && (
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Resumo da ligação, próximos passos..."
                            rows={3}
                            className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                          />
                        )}

                        {composerTab === 'status' && (
                          <div className="space-y-3">
                            {safeFunnels.length > 1 && (
                              <Field label="Funil" hint={funnelId && funnelId !== (lead.funnelId || null) ? 'Ao mudar o funil, a etapa será redefinida para a primeira do novo funil.' : null}>
                                <StyledSelect value={funnelId || ''} onChange={e => handleFunnelChange(e.target.value)}>
                                  {safeFunnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </StyledSelect>
                              </Field>
                            )}
                            <Field label="Fase do funil">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                                {statusesForFunnel.map(s => {
                                  const t = settingsColorTone(s.color || 'blue');
                                  const active = status === s.name;
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => setStatus(s.name)}
                                      className={`h-9 px-2.5 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                                        active
                                          ? `${t.soft} ${t.text} ${t.darkSoft} ${t.darkText} border-transparent ring-1 ring-current/30`
                                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 dark:bg-white/[0.02] dark:border-white/[0.07] dark:text-slate-300'
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                                      {s.name}
                                    </button>
                                  );
                                })}
                                {!statusesForFunnel.some(s => s.name === status) && status && (
                                  <span className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-white/[0.07] text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 italic">
                                    {status} (atual)
                                  </span>
                                )}
                              </div>
                            </Field>
                            <Field label="Observação (opcional)">
                              <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Motivo da mudança, contexto..."
                                rows={2}
                                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                              />
                            </Field>
                          </div>
                        )}

                        {composerTab === 'schedule' && (
                          <ScheduleWizard onConfirm={handleWizardConfirm} onCancel={resetComposer} submitting={loading} />
                        )}

                        {composerTab !== 'schedule' && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <div className="flex-1"></div>
                            <Btn kind="soft" onClick={resetComposer} disabled={loading}>Cancelar</Btn>
                            <Btn kind="brand" icon={<Check size={13} />} onClick={handleComposerSubmit} disabled={loading}>
                              {composerSubmitLabel}
                            </Btn>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Timeline filters + search */}
                {(interactions || []).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]">
                      {TIMELINE_FILTERS.map(f => {
                        const active = timelineFilter === f.id;
                        const c = timelineCounts[f.id] || 0;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setTimelineFilter(f.id)}
                            className={`h-7 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                              active
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            {f.label}
                            <span className={`num text-[10.5px] px-1 h-[15px] rounded grid place-items-center min-w-[15px] ${
                              active
                                ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                                : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                            }`}>{c}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex-1"></div>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        value={timelineQuery}
                        onChange={e => setTimelineQuery(e.target.value)}
                        placeholder="Buscar na linha do tempo..."
                        className="h-9 w-64 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[12.5px] pl-8 pr-3 placeholder:text-slate-400 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {(interactions || []).length === 0 ? (
                  <div className="py-16 grid place-items-center text-slate-400">
                    <Clock size={22} className="opacity-40 mb-2" />
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui ainda</p>
                    <p className="text-[12.5px]">Registre a primeira atividade acima.</p>
                  </div>
                ) : filteredInteractions.length === 0 ? (
                  <div className="py-16 grid place-items-center text-slate-400">
                    <Search size={22} className="opacity-40 mb-2" />
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui</p>
                    <p className="text-[12.5px]">Tente ajustar o filtro ou a busca.</p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-4">
                    {groupedEvents.map(([label, events]) => (
                      <section key={label}>
                        <header className="mb-2 px-1 py-1.5 sticky top-0 bg-paper-50/95 dark:bg-ink-950/95 backdrop-blur z-[1]">
                          <div className="flex items-center gap-2 pl-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
                            {events[0]?.createdAt && (
                              <span className="text-[11.5px] text-slate-400 dark:text-slate-500 num whitespace-nowrap">· {events[0].createdAt.toLocaleDateString('pt-BR')}</span>
                            )}
                            <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/[0.06] ml-1"></div>
                            <span className="text-[11px] num text-slate-400 dark:text-slate-500 whitespace-nowrap">{events.length} {events.length === 1 ? 'evento' : 'eventos'}</span>
                          </div>
                        </header>
                        <div className="relative">
                          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200 dark:bg-white/[0.08]"></div>
                          <div className="space-y-1">
                            {events.map((i) => {
                              const visual = getInteractionVisual(i, statuses);
                              const Icon = visual.icon;
                              const appt = parseAppointment(i);
                              const isAppointment = i._kind === 'appointment';
                              return (
                                <article key={i.id} className="relative pl-12 pr-2 py-2.5 fade-in group">
                                  <div className={`absolute left-0 top-2.5 z-10 w-9 h-9 rounded-full grid place-items-center shrink-0 ring-4 ring-paper-50 dark:ring-ink-950 ${
                                    isAppointment
                                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                                      : visual.dot
                                  }`}>
                                    {isAppointment ? <Calendar className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Avatar name={i.consultantName || 'Sistema'} size={20} />
                                    <span className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{i.consultantName || 'Sistema'}</span>
                                    {isAppointment ? (
                                      <span className="text-[12px] text-brand-700 dark:text-brand-300 whitespace-nowrap">criou um agendamento</span>
                                    ) : visual.stageName ? (
                                      <span className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">moveu para</span>
                                    ) : (
                                      <span className={`text-[12px] whitespace-nowrap ${visual.meta || 'text-slate-500 dark:text-slate-400'}`}>{visual.label}</span>
                                    )}
                                    {visual.stageName && <StatusBadge statusName={visual.stageName} statusesArray={statuses} />}
                                    <span className="flex-1"></span>
                                    <span className="text-[11.5px] num text-slate-400 dark:text-slate-500 whitespace-nowrap" title={i.createdAt?.toLocaleString('pt-BR')}>
                                      {i.createdAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {isAppointment && appt && appt.when ? (
                                    <div className="mt-2 max-w-[520px] rounded-xl border border-brand-200/70 dark:border-brand-500/20 bg-gradient-to-br from-brand-50 to-white dark:from-brand-500/10 dark:to-transparent p-4">
                                      <div className="flex items-center gap-3">
                                        <div className="text-center shrink-0">
                                          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">{appt.when.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                                          <div className="num text-[24px] font-semibold tracking-tight leading-none text-brand-700 dark:text-brand-300">{String(appt.when.getDate()).padStart(2, '0')}</div>
                                          <div className="text-[10.5px] text-brand-600 dark:text-brand-300 num mt-0.5">{appt.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <div className="w-px h-12 bg-brand-200/70 dark:bg-brand-500/20"></div>
                                        <div className="flex-1 min-w-0">
                                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                                            {appt.kind === 'class' ? <BookOpen size={11} /> : appt.kind === 'visit' ? <Building2 size={11} /> : appt.kind === 'call' ? <Phone size={11} /> : <MessageCircle size={11} />} {appt.label}
                                          </div>
                                          <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white mt-0.5">{appt.when.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : i.text ? (
                                    <div className={`mt-2 rounded-xl p-3 max-w-[640px] border ${visual.card || 'bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.06]'}`}>
                                      <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${visual.text || 'text-slate-700 dark:text-slate-200'}`}>{i.text}</p>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    ))}

                    {/* Origin marker */}
                    {timelineFilter === 'all' && !timelineQuery && (
                      <div className="relative pl-12">
                        <div className="absolute left-[15px] top-0">
                          <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-white/[0.1] ring-4 ring-paper-50 dark:ring-ink-950"></div>
                        </div>
                        <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                          Início da jornada · {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      {lossModalOpen && <LossReasonModal lossReasons={lossReasons} onClose={()=>setLossModalOpen(false)} onConfirm={confirmLoss} />}
      </div>
    </>,
    document.body
  );
}
export { LeadDetailsModal };
