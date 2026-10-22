import { useState, useMemo } from 'react';
import { BookOpen, Building2, Calendar, Check, Clock, Dumbbell, GraduationCap, MessageCircle, Phone, UserRound } from 'lucide-react';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL, professorsForModality, professorNameById } from '../../lib/professores.js';
import { Btn } from '../ui/Btn.jsx';
import { cn } from '@/lib/utils';
import { WizardFrame, WizardStepper, StageHead, WizardSummary, WizardProgress, WizardNote } from './WizardLayout.jsx';

// ScheduleWizard: o Agendar da ficha. Tipos Mensagem, Ligação, Visita e Aula,
// passos liberados em sequência, confirmar só quando completo. Desenho A2
// (WizardLayout): os passos numa linha numerada no topo, só o passo atual
// embaixo e, à direita, o resumo, o progresso, a anotação e os botões, com
// altura mínima fixa. Modalidades, unidades e quantidade de aulas vêm das
// Configurações (useGeneralConfig). `initialTypeId` abre já com o tipo
// escolhido.
//
// CONTRATO: onConfirm devolve { typeId, typeLabel, date, modalidade, professorId,
// soloTraining, quantidade, unidade, note, contactOwnerId, contactOwnerName } —
// consumido por handleWizardConfirm
// na LeadProfileView.

const WZ_TONES = {
  brand:   { text:'text-brand-700',   soft:'bg-brand-50',   strong:'bg-brand-600',   ring:'ring-brand-300',   darkText:'dark:text-brand-300',   darkSoft:'dark:bg-brand-500/10',   darkRing:'dark:ring-brand-500/40' },
  emerald: { text:'text-emerald-700', soft:'bg-emerald-50', strong:'bg-emerald-500', ring:'ring-emerald-300', darkText:'dark:text-emerald-300', darkSoft:'dark:bg-emerald-500/10', darkRing:'dark:ring-emerald-500/40' },
  amber:   { text:'text-amber-700',   soft:'bg-amber-50',   strong:'bg-amber-500',   ring:'ring-amber-300',   darkText:'dark:text-amber-300',   darkSoft:'dark:bg-amber-500/10',   darkRing:'dark:ring-amber-500/40' },
  violet:  { text:'text-violet-700',  soft:'bg-violet-50',  strong:'bg-violet-500',  ring:'ring-violet-300',  darkText:'dark:text-violet-300',  darkSoft:'dark:bg-violet-500/10',  darkRing:'dark:ring-violet-500/40' },
  teal:    { text:'text-teal-700',    soft:'bg-teal-50',    strong:'bg-teal-500',    ring:'ring-teal-300',    darkText:'dark:text-teal-300',    darkSoft:'dark:bg-teal-500/10',    darkRing:'dark:ring-teal-500/40' },
};

// followUpLabel = rótulo do tipo p/ follow-up (espelha o contrato).
const WZ_TYPES = [
  { id:'mensagem', label:'Mensagem',          followUpLabel:'Mensagem',          desc:'Follow-up por WhatsApp', Icon: MessageCircle, color:'emerald', flow:['datahora'] },
  { id:'ligacao',  label:'Ligação',           followUpLabel:'Ligação',           desc:'Retorno por telefone',   Icon: Phone,         color:'amber',   flow:['datahora'] },
  { id:'visita',   label:'Visita',            followUpLabel:'Visita',            desc:'Conhecer a unidade',     Icon: Building2,     color:'violet',  flow:['unidade','datahora'] },
  { id:'aula',     label:'Aula experimental', followUpLabel:'Aula Experimental', desc:'Treino de experiência',  Icon: BookOpen,      color:'teal',    flow:['modalidade','professor','quantidade','datahora'] },
];

// Mensagem e ligação são CONTATO: só elas têm dono de tarefa escolhível.
const isContactType = (typeId) => typeId === 'mensagem' || typeId === 'ligacao';

// Sentinela da etapa "Responsável": manter a tarefa com o dono do lead. Precisa
// ser um valor NÃO VAZIO, senão o wizard trata a etapa como não cumprida
// (firstIncomplete testa null e string vazia).
const WZ_OWNER_LEAD = '__lead__';

const WZ_STEP_INFO = {
  modalidade: { title:'Modalidade',       hint:'Qual treino o lead vai experimentar?' },
  professor:  { title:'Professor',        hint:'Quem vai acompanhar a aula?' },
  quantidade: { title:'Quantas aulas',    hint:'O que foi combinado com o aluno.' },
  unidade:    { title:'Unidade',          hint:'Onde a visita vai acontecer?' },
  responsavel:{ title:'Responsável',      hint:'Quem vai fazer esse contato?' },
  datahora:   { title:'Dia e horário',    hint:'Quando vai ser?' },
};

// Dias sugeridos: DISTINTOS e consecutivos (não repete "Amanhã"). Começa em
// HOJE quando ainda dá tempo no dia (antes das 18h); à noite começa direto em
// AMANHÃ. Rótulos: Hoje / Amanhã / dia da semana (Terça-feira, Quarta-feira…).
function wzDayOptions(count = 5, metaWeekdays = null) {
  // metaWeekdays = dias da semana programados na Meta Diária (getDay(): 0=dom..6=sáb).
  // Definido → os cards rápidos só sugerem dias PROGRAMADOS (ex.: seg–sex). Limite de
  // 90 dias de busca p/ evitar laço infinito caso a lista venha vazia/estranha.
  const onMeta = (d) => !metaWeekdays || metaWeekdays.length === 0 || metaWeekdays.includes(d.getDay());
  const startOff = new Date().getHours() >= 18 ? 1 : 0;
  const out = [];
  for (let k = 0; out.length < count && k < 90; k++) {
    const off = startOff + k;
    const d = new Date(); d.setDate(d.getDate() + off); d.setHours(0, 0, 0, 0);
    if (!onMeta(d)) continue;
    let label;
    if (off === 0) label = 'Hoje';
    else if (off === 1) label = 'Amanhã';
    else { label = d.toLocaleDateString('pt-BR', { weekday: 'long' }); label = label.charAt(0).toUpperCase() + label.slice(1); }
    out.push({ off, label, date: d });
  }
  return out;
}
const wzSameDay = (a, b) => a instanceof Date && b instanceof Date && a.toDateString() === b.toDateString();
// Aplica HH:MM ao dia de `cur` (ou hoje, se ainda não escolheu o dia).
function wzWithTime(cur, hhmm) {
  if (!hhmm) return cur || null;
  const [h, m] = hhmm.split(':').map(Number);
  const base = (cur instanceof Date && !isNaN(cur.getTime())) ? new Date(cur) : new Date();
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}
// Valor p/ <input type="datetime-local">: yyyy-MM-ddTHH:mm (hora local, sem TZ).
function wzLocalInput(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Horário default sugerido por card de dia: Hoje à noite (18:00), demais às 09:00.
const wzDefaultSlot = (off) => (off === 0 ? '18:00' : '09:00');

function wzFmtDateTime(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' }).replace('.', '');
  const time = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `${day} · ${time}`;
}

// ---- option card ----
const WzOptionCard = ({ Icon, label, hint, selected, color = 'brand', badge, onClick, index = 0 }) => {
  const t = WZ_TONES[color] || WZ_TONES.brand;
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${index*40}ms` }}
      className={cn('opt-in relative text-left rounded-xl border p-3 transition group',
        selected
          ? cn(t.soft, t.darkSoft, 'border-transparent ring-2', t.ring, t.darkRing)
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15')}>
      {badge && <span className={cn('absolute top-2 right-2 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white', t.strong)}>{badge}</span>}
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0 transition',
            selected ? cn(t.strong, 'text-white') : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]')}>
            <Icon size={16}/>
          </span>
        )}
        <div className="min-w-0">
          <div className={cn('text-[13.5px] font-semibold leading-tight', selected ? cn(t.text, t.darkText) : 'text-slate-900 dark:text-white')}>{label}</div>
          {hint && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{hint}</div>}
        </div>
        {selected && <span className={cn('ml-auto w-5 h-5 rounded-full grid place-items-center text-white check-pop shrink-0', t.strong)}><Check size={12}/></span>}
      </div>
    </button>
  );
};

const WzPill = ({ label, hint, selected, color = 'brand', badge, onClick, index = 0 }) => {
  const t = WZ_TONES[color] || WZ_TONES.brand;
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${index*40}ms` }}
      className={cn('opt-in relative rounded-xl border px-3 py-2.5 text-center transition',
        selected
          ? cn(t.soft, t.darkSoft, 'border-transparent ring-2', t.ring, t.darkRing)
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15')}>
      {badge && <span className={cn('absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white whitespace-nowrap', t.strong)}>{badge}</span>}
      <div className={cn('text-[14px] font-semibold', selected ? cn(t.text, t.darkText) : 'text-slate-900 dark:text-white')}>{label}</div>
      {hint && <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">{hint}</div>}
    </button>
  );
};

const WzStepBody = ({ stepId, values, set, color, modalities, units, qtyOptions, professores, ownerOptions, leadOwnerName }) => {
  // Dias da Meta Diária (ex.: [1,2,3,4,5] = seg–sex) filtram os cards rápidos de dia.
  const { metaWeekdays } = useGeneralConfig();
  // Horário por-card do passo "Dia e horário" (off → 'HH:MM'); fallback no default.
  const [slotTimes, setSlotTimes] = useState({});
  // Qual card está com a edição rápida de horário aberta (off do dia ou null).
  const [editTimeOff, setEditTimeOff] = useState(null);
  switch (stepId) {
    case 'modalidade':
      if (!(modalities || []).length) {
        return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Nenhuma modalidade cadastrada. Adicione em <span className="font-semibold">Configurações → Configurações Gerais</span>.</p>;
      }
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {modalities.map((m, i) => (
            <WzOptionCard key={m.id} index={i} Icon={Dumbbell} label={m.name}
              color={color} selected={values.modalidade===m.name} onClick={()=>set('modalidade', m.name)}/>
          ))}
        </div>
      );
    case 'professor': {
      // Só os professores que atuam na modalidade escolhida (sem fallback de
      // "mostrar todos"): evita escalar professor de outra modalidade. "Treina
      // sozinho" aparece sempre.
      const list = professorsForModality(professores, modalities, values.modalidade);
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {list.map((p, i) => (
              <WzOptionCard key={p.id} index={i} Icon={GraduationCap} label={p.nome}
                color={color} selected={values.professor === p.id} onClick={() => set('professor', p.id)} />
            ))}
            <WzOptionCard index={list.length} Icon={GraduationCap} label={SOLO_TRAINING_LABEL}
              hint="Sem professor responsável" color={color}
              selected={values.professor === SOLO_TRAINING} onClick={() => set('professor', SOLO_TRAINING)} />
          </div>
          {list.length === 0 && (
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Nenhum professor cadastrado para <span className="font-semibold">{values.modalidade}</span>. Cadastre um em <span className="font-semibold">Configurações → Equipe</span>, ou marque "Treina sozinho".
            </p>
          )}
        </div>
      );
    }
    case 'quantidade':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {qtyOptions.map((nq, i) => (
            <WzPill key={nq} index={i} label={`${nq} ${nq === 1 ? 'aula' : 'aulas'}`}
              color={color} selected={values.quantidade===nq} onClick={()=>set('quantidade', nq)}/>
          ))}
        </div>
      );
    case 'unidade':
      if (!(units || []).length) {
        return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Nenhuma unidade cadastrada. Adicione em <span className="font-semibold">Configurações → Configurações Gerais</span>.</p>;
      }
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {units.map((u, i) => (
            <WzOptionCard key={u.id} index={i} Icon={Building2} label={u.name} hint={u.address}
              color={color} selected={values.unidade===u.name} onClick={()=>set('unidade', u.name)}/>
          ))}
        </div>
      );
    case 'responsavel':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <WzOptionCard index={0} Icon={UserRound}
            label={leadOwnerName ? `Responsável pelo lead (${leadOwnerName})` : 'Responsável pelo lead'}
            hint="Mantém a tarefa com quem já cuida do lead"
            color={color} selected={values.responsavel === WZ_OWNER_LEAD}
            onClick={() => set('responsavel', WZ_OWNER_LEAD)}/>
          {(ownerOptions || []).map((u, i) => (
            <WzOptionCard key={u.id} index={i + 1} Icon={UserRound} label={u.name}
              hint="A tarefa vai para a Meta Diária dessa pessoa"
              color={color} selected={values.responsavel === u.id}
              onClick={() => set('responsavel', u.id)}/>
          ))}
        </div>
      );
    case 'datahora': {
      const cur = values.datahora;
      const t = WZ_TONES[color] || WZ_TONES.brand;
      const days = wzDayOptions(5, metaWeekdays);
      // Horário por-card (off → 'HH:MM'); fallback no default do card.
      const slotFor = (off) => slotTimes[off] || wzDefaultSlot(off);
      const selectedISO = wzLocalInput(cur);
      return (
        <div className="space-y-3">
          {/* O título "Dia e horário" já vem do cabeçalho do passo (StageHead). */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {days.map((o, i) => {
                const time = slotFor(o.off);
                const sel = wzSameDay(cur, o.date);
                const editing = editTimeOff === o.off;
                return (
                  <button type="button" key={o.off} style={{ animationDelay: `${i*40}ms` }}
                    onClick={()=>{ setEditTimeOff(null); set('datahora', wzWithTime(o.date, time)); }}
                    className={cn('opt-in relative rounded-xl border px-3 py-2.5 text-center transition',
                      sel
                        ? cn(t.soft, t.darkSoft, 'border-transparent ring-2', t.ring, t.darkRing)
                        : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15')}>
                    <div className={cn('text-[14px] font-semibold', sel ? cn(t.text, t.darkText) : 'text-slate-900 dark:text-white')}>{o.label}</div>
                    <div className="mt-1 inline-flex items-center justify-center gap-1">
                      {editing ? (
                        <input type="time" value={time} autoFocus
                          onClick={(e)=> e.stopPropagation()}
                          onBlur={()=> setEditTimeOff(null)}
                          onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); setEditTimeOff(null); } }}
                          onChange={(e)=>{
                            e.stopPropagation();
                            const v = e.target.value || wzDefaultSlot(o.off);
                            setSlotTimes(prev => ({ ...prev, [o.off]: v }));
                            set('datahora', wzWithTime(o.date, v));
                          }}
                          className={cn('w-[78px] rounded-md border px-1 py-0.5 text-[11.5px] font-semibold num text-center outline-none bg-white dark:bg-white/[0.06] border-slate-200 dark:border-white/15 focus:border-brand-400 dark:focus:border-brand-500/60')}/>
                      ) : (
                        <>
                          <span className={cn('text-[11.5px] font-semibold num', sel ? cn(t.text, t.darkText) : 'text-slate-500 dark:text-slate-400')}>{time}</span>
                          <span role="button" tabIndex={0}
                            title="Editar horário"
                            onClick={(e)=>{ e.stopPropagation(); setEditTimeOff(o.off); }}
                            onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setEditTimeOff(o.off); } }}
                            className={cn('grid place-items-center rounded p-0.5 cursor-pointer transition text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:text-slate-500 dark:hover:text-brand-300 dark:hover:bg-brand-500/10', sel && cn(t.text, t.darkText))}>
                            <Clock size={12}/>
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] text-muted-foreground">Ou escolha manualmente</div>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input type="datetime-local" value={selectedISO}
                onChange={(e)=> set('datahora', e.target.value ? new Date(e.target.value) : null)}
                className="w-full h-11 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-400 dark:focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10 outline-none text-[13.5px] num pl-9 pr-3 transition"/>
            </div>
          </div>
        </div>
      );
    }
    default: return null;
  }
};

function wzSummary(stepId, values, professores, ownerOptions) {
  switch (stepId) {
    case 'modalidade': return values.modalidade || null;
    case 'professor':
      if (values.professor === SOLO_TRAINING) return SOLO_TRAINING_LABEL;
      return values.professor ? (professorNameById(professores, values.professor) || 'Professor selecionado') : null;
    case 'quantidade': return values.quantidade ? `${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}` : null;
    // Só o nome: o título "Unidade" já aparece em cima, na linha de passos.
    case 'unidade':    return values.unidade || null;
    case 'responsavel':
      if (!values.responsavel) return null;
      if (values.responsavel === WZ_OWNER_LEAD) return 'Responsável pelo lead';
      return (ownerOptions || []).find(u => u.id === values.responsavel)?.name || 'Outro consultor';
    // Curto, para caber na linha de passos com a hora à vista ("22/10 · 18:00").
    // O resumo da direita mostra o dia da semana (wzFmtDateTime).
    case 'datahora':   return values.datahora ? `${values.datahora.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })} · ${values.datahora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}` : null;
    default: return null;
  }
}

const WzSummaryCard = ({ type, values, complete, professores }) => {
  if (!type) return null;
  const t = WZ_TONES[type.color] || WZ_TONES.brand;
  const parts = [];
  if (values.modalidade) parts.push(values.modalidade);
  if (values.professor === SOLO_TRAINING) parts.push(SOLO_TRAINING_LABEL);
  else if (values.professor) {
    const p = (professores || []).find((x) => x.id === values.professor);
    if (p) parts.push(p.nome);
  }
  if (values.quantidade) parts.push(`${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}`);
  if (values.unidade) parts.push(`Unidade ${values.unidade}`);
  return (
    <WizardSummary tone={t} Icon={type.Icon} label="Resumo do agendamento" title={type.label} complete={complete}>
      {parts.length > 0 && <p className="mt-px text-[13px] text-slate-600 dark:text-slate-300">{parts.join(', ')}</p>}
      {values.datahora ? (
        <span className={cn('mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold', t.text, t.darkText)}>
          <Calendar size={13} aria-hidden="true" /> {wzFmtDateTime(values.datahora)}
        </span>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Clock size={12} aria-hidden="true" /> Falta definir dia e horário
        </span>
      )}
    </WizardSummary>
  );
};

function ScheduleWizard({ onConfirm, onCancel, submitting = false, usersList = [], leadOwnerName = null, leadOwnerId = null, initialTypeId = null }) {
  const { modalities, trialClassOptions, units, professores } = useGeneralConfig();
  // O tipo pode vir escolhido (o Remarcar do A seguir abre já na visita ou na aula).
  const [typeId, setTypeId] = useState(WZ_TYPES.some((tp) => tp.id === initialTypeId) ? initialTypeId : null);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');

  const type = WZ_TYPES.find(t => t.id === typeId) || null;

  // Candidatos a receber a tarefa, SEM o dono do lead: ele já é a primeira opção
  // da etapa ("Responsável pelo lead"), e listar o nome dele duas vezes confunde.
  const ownerOptions = useMemo(
    () => (usersList || []).filter(u => u?.id && u.name && u.id !== leadOwnerId),
    [usersList, leadOwnerId]
  );

  // A etapa "Responsável" só entra no fluxo em mensagem/ligação E quando há
  // alguém para escolher além do dono do lead. Sem candidato, a etapa seria um
  // clique obrigatório com uma opção só.
  const flow = useMemo(() => {
    if (!type) return [];
    if (isContactType(type.id) && ownerOptions.length > 0) return ['responsavel', ...type.flow];
    return type.flow;
  }, [type, ownerOptions]);
  const color = type ? type.color : 'brand';
  const qtyOptions = (trialClassOptions && trialClassOptions.length ? trialClassOptions : [1]);

  const firstIncomplete = useMemo(() => {
    for (const s of flow) { if (values[s] == null || values[s] === '') return s; }
    return null;
  }, [flow, values]);

  // O passo aberto embaixo. O último (dia e horário) nunca fecha: com tudo
  // preenchido ele continua aberto, para a pessoa ajustar o horário.
  const active = !type ? 'tipo' : (editing || firstIncomplete || 'datahora');
  const complete = Boolean(type) && firstIncomplete === null;

  const setVal = (key, val) => {
    setValues(v => {
      const next = { ...v, [key]: val };
      const idx = flow.indexOf(key);
      if (idx !== -1 && editing) flow.slice(idx+1).forEach(s => { delete next[s]; });
      return next;
    });
    setEditing(null);
  };

  const pickType = (id) => { setTypeId(id); setValues({}); setEditing(null); };
  const resetAll = () => { setTypeId(null); setValues({}); setEditing(null); setNote(''); };

  const t = WZ_TONES[color] || WZ_TONES.brand;
  const steps = [
    { key: 'tipo', title: 'Tipo', value: type ? type.label : '', onEdit: () => { setTypeId(null); setValues({}); setEditing(null); } },
    ...flow.map((k) => ({ key: k, title: WZ_STEP_INFO[k].title, value: wzSummary(k, values, professores, ownerOptions) || '', onEdit: () => setEditing(k) })),
  ].map((s) => ({ ...s, state: s.key === active ? 'active' : s.value ? 'done' : 'locked' }));
  const doneCount = steps.filter((s) => s.value).length;
  const totalCount = steps.length;

  const handleConfirm = () => {
    if (!complete || !type) return;
    const escolhido = values.responsavel && values.responsavel !== WZ_OWNER_LEAD ? values.responsavel : null;
    onConfirm({
      typeId: type.id,
      typeLabel: type.followUpLabel,
      date: values.datahora,
      modalidade: type.id === 'aula' ? (values.modalidade || null) : null,
      professorId: type.id === 'aula' && values.professor !== SOLO_TRAINING ? (values.professor || null) : null,
      soloTraining: type.id === 'aula' && values.professor === SOLO_TRAINING,
      quantidade: type.id === 'aula' ? (values.quantidade || null) : null,
      unidade: type.id === 'visita' ? (values.unidade || null) : null,
      note: note.trim(),
      // Só o contato tem dono de tarefa escolhido aqui. Na visita e na aula,
      // quem fica com a tarefa é decidido na ficha (appointmentTaskOwnerFor, em
      // lib/schedulePatch.js): quem agenda, quando é consultor e não é o dono.
      // A sentinela WZ_OWNER_LEAD vira null: null significa "o dono do lead".
      contactOwnerId: escolhido,
      contactOwnerName: escolhido ? (ownerOptions.find(u => u.id === escolhido)?.name || null) : null,
    });
    resetAll();
  };

  return (
    <WizardFrame
      stepper={<WizardStepper steps={steps} label="Passos do agendamento" tone={t} />}
      stage={active === 'tipo' ? (
        <>
          <StageHead key="tipo" title="O que você quer agendar?" hint="Escolha o tipo para liberar os próximos passos." />
          <div className="grid grid-cols-2 gap-2">
            {WZ_TYPES.map((tp, i) => (
              <WzOptionCard key={tp.id} index={i} Icon={tp.Icon} label={tp.label} hint={tp.desc} color={tp.color} selected={false} onClick={() => pickType(tp.id)}/>
            ))}
          </div>
        </>
      ) : (
        <>
          <StageHead key={`head-${active}`} title={WZ_STEP_INFO[active].title} hint={WZ_STEP_INFO[active].hint} />
          <WzStepBody key={active} stepId={active} values={values} set={setVal} color={color}
            modalities={modalities} units={units} qtyOptions={qtyOptions} professores={professores}
            ownerOptions={ownerOptions} leadOwnerName={leadOwnerName}/>
        </>
      )}
      aside={(
        <>
          {type ? <WzSummaryCard type={type} values={values} complete={complete} professores={professores}/> : (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center">
              <div className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/[0.05]"><Calendar size={18} aria-hidden="true"/></div>
              <p className="text-[12.5px] text-muted-foreground">Escolha o tipo de agendamento para começar.</p>
            </div>
          )}
          {type && <WizardProgress done={doneCount} total={totalCount} tone={t} />}
          {type && (
            <WizardNote id="wz-note" label="Anotação (opcional)" placeholder="O que precisa ser tratado nesse contato?" value={note} onChange={setNote} />
          )}
          <div className="mt-auto flex flex-col gap-2">
            <Btn kind="brand" icon={<Check size={14}/>} disabled={!complete || submitting} onClick={handleConfirm}>{submitting ? 'Salvando...' : complete ? 'Confirmar agendamento' : 'Complete os passos'}</Btn>
            <Btn kind="soft" onClick={()=>{ resetAll(); onCancel && onCancel(); }}>Cancelar</Btn>
          </div>
        </>
      )}
    />
  );
}

export { ScheduleWizard };
