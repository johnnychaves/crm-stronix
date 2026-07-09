import { useState, useMemo } from 'react';
import { BookOpen, Building2, Calendar, Check, Clock, Dumbbell, GraduationCap, MessageCircle, Phone, RefreshCw } from 'lucide-react';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL, professorsForModality, professorNameById } from '../../lib/professores.js';
import { Btn } from '../ui/Btn.jsx';
import { cn } from '@/lib/utils';

// ScheduleWizard — porte fiel (classe por classe) do protótipo
// design_handoff_perfil_cadastro/prototype/wizard.jsx. Espelha o markup exato do
// wizard passo-a-passo (tipos Mensagem/Ligação/Visita/Aula; passos liberados em
// sequência; resumo lateral; barra de progresso; quick slots; confirmar só quando
// completo). Diferenças obrigatórias vs. o protótipo: ícones do lucide-react no
// lugar dos globais window['I*']; modalidades/unidades/qtde de aulas vêm das
// Config Gerais (useGeneralConfig) no lugar dos arrays hardcoded; o passo do meio
// da aula é "quantidade" (trialClassOptions) renderizado igual ao freepass do
// protótipo; token azul brand-500 do protótipo → brand-600 no app.
//
// CONTRATO: onConfirm devolve { typeId, typeLabel, date, modalidade, professorId,
// soloTraining, quantidade, unidade, note } — consumido por handleWizardConfirm
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

const WZ_STEP_INFO = {
  modalidade: { title:'Modalidade',       hint:'Qual treino o lead vai experimentar?' },
  professor:  { title:'Professor',        hint:'Quem vai acompanhar a aula?' },
  quantidade: { title:'Quantas aulas',    hint:'O que foi combinado com o aluno.' },
  unidade:    { title:'Unidade',          hint:'Onde a visita vai acontecer?' },
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

const WzStepDot = ({ state, n, color = 'brand' }) => {
  const t = WZ_TONES[color] || WZ_TONES.brand;
  if (state === 'done') return <span className={cn('w-7 h-7 rounded-full grid place-items-center text-white shrink-0 check-pop', t.strong)}><Check size={14}/></span>;
  if (state === 'active') return <span className={cn('w-7 h-7 rounded-full grid place-items-center bg-white dark:bg-ink-900 ring-2 text-[12px] font-bold num shrink-0', t.ring, t.darkRing, t.text, t.darkText)}>{n}</span>;
  return <span className="w-7 h-7 rounded-full grid place-items-center bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 text-[12px] font-bold num shrink-0">{n}</span>;
};

const WzStepBody = ({ stepId, values, set, color, modalities, units, qtyOptions, professores }) => {
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
      const matches = professorsForModality(professores, modalities, values.modalidade);
      const list = matches.length ? matches : (professores || []).filter((p) => p.ativo !== false);
      const usingFallback = matches.length === 0 && list.length > 0;
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
          {usingFallback && (
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Nenhum professor cadastrado para <span className="font-semibold">{values.modalidade}</span>. Mostrando todos.
            </p>
          )}
          {list.length === 0 && (
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Nenhum professor cadastrado. Adicione em <span className="font-semibold">Configurações → Equipe</span>, ou marque "Treina sozinho".
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
    case 'datahora': {
      const cur = values.datahora;
      const t = WZ_TONES[color] || WZ_TONES.brand;
      const days = wzDayOptions(5, metaWeekdays);
      // Horário por-card (off → 'HH:MM'); fallback no default do card.
      const slotFor = (off) => slotTimes[off] || wzDefaultSlot(off);
      const selectedISO = wzLocalInput(cur);
      return (
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Dia e horário</div>
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
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Ou escolha manualmente</div>
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

function wzSummary(stepId, values, professores) {
  switch (stepId) {
    case 'modalidade': return values.modalidade || null;
    case 'professor':
      if (values.professor === SOLO_TRAINING) return SOLO_TRAINING_LABEL;
      return values.professor ? (professorNameById(professores, values.professor) || 'Professor selecionado') : null;
    case 'quantidade': return values.quantidade ? `${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}` : null;
    case 'unidade':    return values.unidade ? `Unidade ${values.unidade}` : null;
    case 'datahora':   return values.datahora ? wzFmtDateTime(values.datahora) : null;
    default: return null;
  }
}

const WzStepRow = ({ stepId, n, state, color, values, set, onEdit, isLast, modalities, units, qtyOptions, professores }) => {
  const info = WZ_STEP_INFO[stepId]; const t = WZ_TONES[color] || WZ_TONES.brand; const summary = wzSummary(stepId, values, professores);
  // 'datahora' é o último passo e nunca colapsa: o resumo já vive no rail lateral,
  // então mantemos o corpo (cards de dia + calendário) sempre aberto p/ o usuário
  // revisar/ajustar o horário. A finalização é só pelo botão "Confirmar".
  const alwaysOpen = stepId === 'datahora';
  // O dot acompanha: passo aberto-fixo nunca fica "done" (sempre 'active' ou 'locked').
  const dotState = alwaysOpen && state === 'done' ? 'active' : state;
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <WzStepDot state={dotState} n={n} color={color}/>
        {!isLast && <div className={cn('conn w-px flex-1 mt-1 mb-1', state==='done' ? t.strong : 'bg-slate-200 dark:bg-white/[0.08]')}></div>}
      </div>
      <div className={cn('flex-1 min-w-0', isLast ? 'pb-0' : 'pb-5')}>
        {state === 'locked' && !alwaysOpen ? (
          <div className="pt-0.5 opacity-50 select-none"><div className="text-[13.5px] font-semibold text-slate-400 dark:text-slate-500">{info.title}</div></div>
        ) : state === 'done' && !alwaysOpen ? (
          <button type="button" onClick={onEdit}
            className="sum-in w-full text-left group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{info.title}</div>
              <div className={cn('text-[13.5px] font-semibold truncate mt-0.5', t.text, t.darkText)}>{summary}</div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 whitespace-nowrap shrink-0"><RefreshCw size={12}/> Editar</span>
          </button>
        ) : (
          <div className="step-reveal pt-0.5">
            <div className="mb-2.5">
              <div className="text-[14px] font-semibold text-slate-900 dark:text-white">{info.title}</div>
              {info.hint && <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{info.hint}</div>}
            </div>
            <WzStepBody stepId={stepId} values={values} set={set} color={color} modalities={modalities} units={units} qtyOptions={qtyOptions} professores={professores}/>
          </div>
        )}
      </div>
    </div>
  );
};

const WzSummaryCard = ({ type, values, complete, professores }) => {
  if (!type) return null;
  const t = WZ_TONES[type.color] || WZ_TONES.brand; const Icon = type.Icon;
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
    <div className={cn('rounded-xl border p-3.5', complete ? cn(t.soft, t.darkSoft, 'border-transparent') : 'bg-slate-50 border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06]')}>
      <div className="flex items-start gap-3">
        <span className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', complete ? cn(t.strong, 'text-white') : 'bg-white text-slate-500 dark:bg-white/[0.06] dark:text-slate-400')}><Icon size={16}/></span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resumo do agendamento</div>
          <div className="text-[14px] font-semibold text-slate-900 dark:text-white mt-0.5">{type.label}</div>
          {parts.length > 0 && <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">{parts.join(' · ')}</div>}
          {values.datahora ? (
            <div className={cn('inline-flex items-center gap-1.5 mt-2 text-[12.5px] font-semibold', t.text, t.darkText)}><Calendar size={13}/> {wzFmtDateTime(values.datahora)}</div>
          ) : (
            <div className="inline-flex items-center gap-1.5 mt-2 text-[12px] text-slate-400 dark:text-slate-500"><Clock size={12}/> Falta definir dia e horário</div>
          )}
        </div>
      </div>
    </div>
  );
};

function ScheduleWizard({ onConfirm, onCancel, submitting = false }) {
  const { modalities, trialClassOptions, units, professores } = useGeneralConfig();
  const [typeId, setTypeId] = useState(null);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');

  const type = WZ_TYPES.find(t => t.id === typeId) || null;
  const flow = useMemo(() => (type ? type.flow : []), [type]);
  const color = type ? type.color : 'brand';
  const qtyOptions = (trialClassOptions && trialClassOptions.length ? trialClassOptions : [1]);

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
      if (idx !== -1 && editing) flow.slice(idx+1).forEach(s => { delete next[s]; });
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

  const doneCount = flow.filter(s => values[s]!=null && values[s]!=='').length + 1;
  const totalCount = flow.length + 1;
  const t = WZ_TONES[color] || WZ_TONES.brand;

  const handleConfirm = () => {
    if (!complete || !type) return;
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
    });
    resetAll();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
      {/* stepper */}
      <div className="min-w-0">
        {/* step 0 - type */}
        <div className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <WzStepDot state={type ? 'done' : 'active'} n={1} color={color}/>
            <div className={cn('conn w-px flex-1 mt-1 mb-1', type ? t.strong : 'bg-slate-200 dark:bg-white/[0.08]')}></div>
          </div>
          <div className="flex-1 min-w-0 pb-5">
            {type ? (
              <button type="button" onClick={()=>{ setTypeId(null); setValues({}); setEditing(null); }}
                className="sum-in w-full text-left group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center gap-3">
                <span className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0 text-white', t.strong)}><type.Icon size={16}/></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tipo de agendamento</div>
                  <div className={cn('text-[13.5px] font-semibold truncate', t.text, t.darkText)}>{type.label}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 whitespace-nowrap shrink-0"><RefreshCw size={12}/> Trocar</span>
              </button>
            ) : (
              <div className="step-reveal pt-0.5">
                <div className="mb-2.5">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-white">O que você quer agendar?</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Escolha o tipo para liberar os próximos passos.</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {WZ_TYPES.map((tp, i) => (
                    <WzOptionCard key={tp.id} index={i} Icon={tp.Icon} label={tp.label} hint={tp.desc} color={tp.color} selected={false} onClick={()=>pickType(tp.id)}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {flow.map((stepId, i) => (
          <WzStepRow key={stepId} stepId={stepId} n={i+2} state={stepState(stepId)} color={color}
            values={values} set={setVal} onEdit={()=>setEditing(stepId)} isLast={i === flow.length - 1}
            modalities={modalities} units={units} qtyOptions={qtyOptions} professores={professores}/>
        ))}

        {type && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/[0.06] step-reveal">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Anotação (opcional)</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
              placeholder="O que precisa ser tratado nesse contato?"
              className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-slate-300 dark:focus:border-white/15 outline-none text-[13px] p-3 placeholder:text-slate-400 resize-none transition"/>
          </div>
        )}
      </div>

      {/* summary rail */}
      <aside className="self-start space-y-3">
        {type ? <WzSummaryCard type={type} values={values} complete={complete} professores={professores}/> : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.1] p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mx-auto mb-2 text-slate-400"><Calendar size={18}/></div>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Escolha o tipo de agendamento para começar.</p>
          </div>
        )}
        {type && (
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Progresso</span>
              <span className="num text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">{doneCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
              <div className={cn('h-full', t.strong)} style={{ width: `${totalCount > 0 ? (doneCount/totalCount)*100 : 0}%`, transition:'width .4s' }}></div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Btn kind="brand" icon={<Check size={14}/>} disabled={!complete || submitting} onClick={handleConfirm}>{submitting ? 'Salvando...' : complete ? 'Confirmar agendamento' : 'Complete os passos'}</Btn>
          <Btn kind="soft" onClick={()=>{ resetAll(); onCancel && onCancel(); }}>Cancelar</Btn>
        </div>
      </aside>
    </div>
  );
}

export { ScheduleWizard };
