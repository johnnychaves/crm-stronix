import { useMemo, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { User, MapPin, Phone, Briefcase, Users, Calendar, IdCard, Mail, Check, Pencil, Baby, AlertTriangle } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { isClientLead } from '../lib/leads.js';
import { lookupCep, isCepComplete, isValidCpf, isCpfComplete } from '../lib/brazilLookups.js';
import { formatCPF, formatPhone } from '../lib/masks.js';
import {
  MARITAL_STATUS_OPTIONS, readClientRegistration, buildClientRegistrationPatch, computeCompleteness,
  ownerChangeFor, ownerChangeNote, registrationGuardianIssue,
} from '../lib/clientRegistration.js';
import { GUARDIAN_RELATIONSHIPS, adultSince } from '../lib/guardian.js';
import { sameContactPhone } from '../lib/leadDerived.js';
import { fromDateInputValue, toDateInputValue } from '../lib/dates.js';
import { phoneNoticeLines } from '../lib/phoneNotice.js';
import { useGuardianMatches } from '../hooks/useGuardianMatches.js';
import { logInteraction } from '../lib/interactions.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { TagsInput } from '../components/ui/TagsInput.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { Switch } from '../components/ui/switch.jsx';

const SOURCES = ['Instagram', 'Indicação', 'Site', 'WhatsApp', 'Facebook', 'Google', 'Passou na porta', 'Outro'];

// Abas do cadastro. `done(form)` marca a bolinha verde quando a seção tem dados.
const TABS = [
  { id: 'identidade', label: 'Identidade', icon: User, done: (f) => !!(f.cpf || f.rg || f.birthDate || f.email || f.sexo) },
  { id: 'endereco', label: 'Endereço', icon: MapPin, done: (f) => !!(f.street && f.number && f.city) },
  { id: 'emergencia', label: 'Emergência', icon: Phone, done: (f) => !!(f.emgName && f.emgPhone) },
  { id: 'pessoais', label: 'Pessoais', icon: Briefcase, done: (f) => !!(f.maritalStatus || f.profession) },
  { id: 'relacionamento', label: 'Relacionamento', icon: Users, done: (f) => !!(f.tags?.length || f.observation) },
];

// Casca do Dialog. Fica fina de propósito: o Radix desmonta o conteúdo de
// DialogContent quando fecha (Presence sem forceMount, nem o wrapper local em
// components/ui/dialog.jsx nem o pacote passam essa prop, conferido no
// código-fonte do @radix-ui/react-dialog). Assim o RegistrationForm, montado
// só quando o Dialog está aberto, sempre relê o lead do zero na abertura
// seguinte. Antes, form/tab/cepBusy viviam aqui, num componente que a
// LeadProfileView mantém montado o tempo todo, só a prop `open` muda, então
// `useState(() => readClientRegistration(lead))` só rodava uma vez na vida
// do app: ligar Menor, salvar, reabrir, desligar pulava a exigência de
// WhatsApp (a chave congelada ainda dizia que a chave estava ligada), o
// Cancelar não descartava nada, e o useGuardianMatches ficava consultando o
// Firestore a cada abertura de ficha de menor mesmo com o modal fechado.
function ClientRegistrationModal({ open, onClose, lead, appUser, db, usersList, tags }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="z-[210] w-full sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh]" overlayClassName="z-[210]">
        <RegistrationForm lead={lead} appUser={appUser} db={db} usersList={usersList} tags={tags} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function RegistrationForm({ lead, appUser, db, usersList, tags, onClose }) {
  const toast = useToast();
  const { professores, dores, modalities } = useGeneralConfig();
  const isClient = isClientLead(lead);
  const [form, setForm] = useState(() => readClientRegistration(lead));
  const [tab, setTab] = useState('identidade');
  const [cepBusy, setCepBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // Quem pode receber o lead: gente ATIVA da equipe e com login vinculado.
  // Passar para quem saiu deixaria o lead órfão (mesma regra do dono da tarefa
  // de contato), e passar para um cadastro sem authUid deixaria o lead sem
  // ninguém que possa editá-lo, já que a permissão é o authUid do dono.
  const ownerOptions = useMemo(
    () => (usersList || []).filter(
      (u) => u?.id && u.name && u.authUid && u.active !== false && !u.superAdminOnly
    ),
    [usersList]
  );
  const pct = useMemo(() => computeCompleteness(form), [form]);
  const cpfInvalid = isCpfComplete(form.cpf) && !isValidCpf(form.cpf);
  const tagSuggestions = (tags || []).map((t) => t.name);

  const guardianDigits = String(form.guardianPhone || '').replace(/\D/g, '');
  const guardianMatches = useGuardianMatches({ db, phoneDigits: form.isMinor ? guardianDigits : '', excludeId: lead.id });
  const guardianNotice = phoneNoticeLines({ field: 'guardian', ...guardianMatches });
  // O aluno não pode ter o mesmo número do responsável: recria o problema que
  // a feature resolve (whatsappDigits/zapMatchKey do menor viram os da mãe).
  // O salvamento continua bloqueado por registrationGuardianIssue; aqui é só
  // o aviso embaixo do campo, igual ao cadastro.
  const sameAsGuardian = form.isMinor && sameContactPhone(form.whatsapp, form.guardianPhone);
  // form.adultSince só diz que a chave estava ligada na leitura e a pessoa já
  // tinha 18 pela data de então; a DATA mostrada sai do nascimento ATUAL do
  // campo, não da congelada. Nascimento limpo não tem data pra mostrar, então
  // não mostra nota nenhuma; corrigido pra uma data de menor, avisa (a não
  // ser que a chave já esteja ligada de novo, aí a mensagem perde sentido).
  const currentAdultSince = form.adultSince ? adultSince(fromDateInputValue(form.birthDate)) : null;
  const stillAdultByDate = Boolean(currentAdultSince) && Date.now() >= currentAdultSince.getTime();
  const adultNote = !currentAdultSince
    ? null
    : stillAdultByDate
      ? `Fez 18 anos em ${toDateInputValue(currentAdultSince).split('-').reverse().join('/')}.`
      : (form.isMinor ? null : 'Pela data, é menor. Ligue a chave se o contato for o responsável.');

  const onCepBlur = async () => {
    if (!isCepComplete(form.cep)) return;
    setCepBusy(true);
    const r = await lookupCep(form.cep);
    setCepBusy(false);
    if (r) setForm((f) => ({ ...f, street: r.street || f.street, neighborhood: r.neighborhood || f.neighborhood, city: r.city || f.city, state: r.state || f.state }));
    else toast.warning('CEP não encontrado — confira o número.');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.warning('Informe o nome.'); return; }
    const guardianError = registrationGuardianIssue(form);
    if (guardianError) { setTab('identidade'); toast.warning(guardianError); return; }
    setLoading(true);
    try {
      const patch = buildClientRegistrationPatch(form, { usersList, professores });
      const ownerChange = ownerChangeFor(lead, patch);
      if (ownerChange) {
        // Troca de responsável deixa rastro: nota na linha do tempo e patch do
        // lead no MESMO batch (logInteraction), então ou grava tudo ou nada.
        // O carimbo é o que o sino de quem recebeu lê depois.
        await logInteraction(
          db, lead, appUser,
          { text: ownerChangeNote(ownerChange), type: 'status_change' },
          {
            ...patch,
            consultantChangedAt: serverTimestamp(),
            consultantChangedByName: appUser?.name || null,
            consultantChangedByAuthUid: appUser?.authUid || null,
          }
        );
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch);
      }
      toast.success(ownerChange ? `Cadastro salvo. ${ownerChange.toName} agora é o responsável.` : 'Cadastro salvo!');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const tabIdx = TABS.findIndex((t) => t.id === tab);

  return (
    <>
      {/* Cabeçalho */}
      <DialogHeader className="shrink-0 flex flex-row items-center gap-3 text-left px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
        {/* Com foto enviada, o cabeçalho mostra a PESSOA em vez do lápis
            genérico — fica claro quem está sendo editado. Sem foto, mantém
            o ícone de sempre. */}
        {lead.photoUrl ? (
          <Avatar name={lead.name} size={40} photoUrl={lead.photoUrl} />
        ) : (
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Pencil size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[17px] font-bold tracking-tight leading-tight font-display">{isClient ? 'Cadastro do cliente' : 'Cadastro do lead'}</DialogTitle>
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{lead.name}</p>
        </div>
      </DialogHeader>

      {/* Medidor de completude */}
      <div className="shrink-0 px-6 py-3 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Cadastro <b className="text-emerald-600 dark:text-emerald-400 num">{pct}%</b> completo</span>
      </div>

      {/* Abas */}
      <div className="shrink-0 flex gap-1 px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto overscroll-x-contain thin-scroll">
        {TABS.map((t) => {
          const active = t.id === tab;
          const done = t.done(form);
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition',
                active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}>
              <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-brand-500' : done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20')} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Corpo da aba ativa */}
      <div className="h-[min(440px,56vh)] px-6 py-5 overflow-y-auto thin-scroll">
        {tab === 'identidade' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Field label="Nome completo" required><StyledInput icon={<User size={15} />} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e sobrenome" /></Field></div>
            <div>
              <Field label={form.isMinor ? 'WhatsApp do aluno' : 'WhatsApp'} required={!form.isMinor}>
                <StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.whatsapp} onChange={(e) => set('whatsapp', formatPhone(e.target.value))}
                  placeholder="(51) 9 0000-0000" className={sameAsGuardian ? '!border-amber-400' : ''} />
              </Field>
              {sameAsGuardian && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.</span>
                </div>
              )}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-border p-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="size-8 rounded-lg grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300"><Baby size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground leading-tight">Menor de idade</span>
                    <span className="block text-[11.5px] text-muted-foreground">{adultNote || 'O contato passa a ser o responsável'}</span>
                  </span>
                </span>
                <Switch checked={form.isMinor} onCheckedChange={(on) => set('isMinor', on)} />
              </label>
              {form.isMinor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><Field label="Nome do responsável" required><StyledInput icon={<Users size={15} />} value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} placeholder="Nome de quem responde pelo aluno" /></Field></div>
                  <Field label="Telefone do responsável" required><StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.guardianPhone} onChange={(e) => set('guardianPhone', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" /></Field>
                  <Field label="Parentesco"><StyledSelect value={form.guardianRelation} onChange={(e) => set('guardianRelation', e.target.value)}><option value="">Selecione…</option>{GUARDIAN_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</StyledSelect></Field>
                  {guardianNotice.length > 0 && (
                    <div className="sm:col-span-2 flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">
                      {guardianNotice.map((linha) => <span key={linha}>{linha}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Field label="CPF" error={cpfInvalid ? 'CPF inválido' : undefined}><StyledInput icon={<IdCard size={15} />} inputMode="numeric" value={form.cpf} onChange={(e) => set('cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" /></Field>
            <Field label="RG"><StyledInput value={form.rg} onChange={(e) => set('rg', e.target.value)} placeholder="Documento de identidade" /></Field>
            <Field label="Data de nascimento"><StyledInput type="date" icon={<Calendar size={15} />} value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></Field>
            <Field label="Sexo"><StyledSelect value={form.sexo} onChange={(e) => set('sexo', e.target.value)}><option value="">Selecione…</option><option>Feminino</option><option>Masculino</option><option>Outro</option></StyledSelect></Field>
            <Field label="E-mail"><StyledInput type="email" icon={<Mail size={15} />} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" /></Field>
          </div>
        )}

        {tab === 'endereco' && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-3"><Field label="CEP" hint={cepBusy ? 'Buscando…' : undefined}><StyledInput value={form.cep} onChange={(e) => set('cep', e.target.value)} onBlur={onCepBlur} placeholder="00000-000" /></Field></div>
            <div className="sm:col-span-7"><Field label="Rua / logradouro"><StyledInput value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Av. Exemplo" /></Field></div>
            <div className="sm:col-span-2"><Field label="Número"><StyledInput value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="123" /></Field></div>
            <div className="sm:col-span-5"><Field label="Complemento"><StyledInput value={form.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, andar…" /></Field></div>
            <div className="sm:col-span-7"><Field label="Bairro"><StyledInput value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" /></Field></div>
            <div className="sm:col-span-9"><Field label="Cidade"><StyledInput value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" /></Field></div>
            <div className="sm:col-span-3"><Field label="UF"><StyledInput value={form.state} maxLength={2} onChange={(e) => set('state', e.target.value.toUpperCase())} placeholder="UF" /></Field></div>
          </div>
        )}

        {tab === 'emergencia' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome"><StyledInput icon={<User size={15} />} value={form.emgName} onChange={(e) => set('emgName', e.target.value)} placeholder="Quem acionar" /></Field>
            <Field label="Telefone"><StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.emgPhone} onChange={(e) => set('emgPhone', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" /></Field>
            <div className="sm:col-span-2"><Field label="Parentesco"><StyledInput value={form.emgRelation} onChange={(e) => set('emgRelation', e.target.value)} placeholder="Cônjuge, pai, mãe, amigo…" /></Field></div>
          </div>
        )}

        {tab === 'pessoais' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Estado civil"><StyledSelect value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}><option value="">Selecione…</option>{MARITAL_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</StyledSelect></Field>
            <Field label="Profissão"><StyledInput icon={<Briefcase size={15} />} value={form.profession} onChange={(e) => set('profession', e.target.value)} placeholder="Ex.: Fisioterapeuta" /></Field>
          </div>
        )}

        {tab === 'relacionamento' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Dor / necessidade">
                <StyledSelect value={form.dor} onChange={(e) => set('dor', e.target.value)}>
                  <option value="">Selecione…</option>
                  {form.dor && !(dores || []).some((d) => d.name === form.dor) && <option value={form.dor}>{form.dor}</option>}
                  {(dores || []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </StyledSelect>
              </Field>
              <Field label="Modalidade de interesse">
                <StyledSelect value={form.modalidade} onChange={(e) => set('modalidade', e.target.value)}>
                  <option value="">Selecione…</option>
                  {form.modalidade && !(modalities || []).some((m) => m.name === form.modalidade) && <option value={form.modalidade}>{form.modalidade}</option>}
                  {(modalities || []).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </StyledSelect>
              </Field>
              <div className="sm:col-span-2"><Field label="Origem"><StyledSelect value={form.source} onChange={(e) => set('source', e.target.value)}>{!SOURCES.includes(form.source) && form.source && <option value={form.source}>{form.source}</option>}{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</StyledSelect></Field></div>
              <Field label="Consultor responsável">
                {/* Passar a bola é de toda a equipe (não só do admin): quem
                    recebe fica sabendo pelo sino e a troca vai pra linha do
                    tempo. */}
                <StyledSelect value={form.consultantId} onChange={(e) => set('consultantId', e.target.value)}>
                  <option value="">Selecione…</option>
                  {/* Dono atual que já saiu da equipe continua listado, senão
                      o campo abriria em branco e a troca viraria acidente. */}
                  {form.consultantId && !ownerOptions.some((u) => u.id === form.consultantId) && (
                    <option value={form.consultantId}>{lead.consultantName || 'Responsável atual'}</option>
                  )}
                  {ownerOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </StyledSelect>
              </Field>
              <Field label="Professor responsável">
                <StyledSelect value={form.professorId} onChange={(e) => set('professorId', e.target.value)}>
                  <option value="">Sem professor</option>
                  {form.professorId && !(professores || []).some((p) => p.id === form.professorId) && (
                    <option value={form.professorId}>{lead.professorName || 'Professor atual'}</option>
                  )}
                  {(professores || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </StyledSelect>
              </Field>
            </div>
            <Field label="Etiquetas"><TagsInput tags={form.tags} setTags={(t) => set('tags', t)} suggestions={tagSuggestions} /></Field>
            <Field label="Observação">
              <textarea value={form.observation} onChange={(e) => set('observation', e.target.value)} rows={3}
                placeholder="Contexto, preferências, histórico relevante…"
                className="w-full rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] focus:border-brand-400 dark:focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10 outline-none text-[13.5px] p-3.5 placeholder:text-slate-400 resize-none transition" />
            </Field>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="shrink-0 px-6 py-4 flex items-center gap-2 border-t border-slate-100 dark:border-white/[0.05]">
        <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">Aba {tabIdx + 1} de {TABS.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <Btn kind="soft" size="md" onClick={onClose} disabled={loading}>Cancelar</Btn>
          <Btn kind="brand" size="md" icon={<Check size={14} />} onClick={handleSave} disabled={loading || !form.name.trim()}>
            {loading ? 'Salvando…' : 'Salvar cadastro'}
          </Btn>
        </div>
      </div>
    </>
  );
}

export { ClientRegistrationModal };
