import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { User, MapPin, Phone, Briefcase, Users, Calendar, IdCard, Mail, Check, Pencil } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { isAdminUser } from '../lib/leads.js';
import { lookupCep, isCepComplete, isValidCpf, isCpfComplete } from '../lib/brazilLookups.js';
import { formatCPF, formatPhone } from '../lib/masks.js';
import {
  MARITAL_STATUS_OPTIONS, readClientRegistration, buildClientRegistrationPatch, computeCompleteness,
} from '../lib/clientRegistration.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { TagsInput } from '../components/ui/TagsInput.jsx';
import { Btn } from '../components/ui/Btn.jsx';

const SOURCES = ['Instagram', 'Indicação', 'Site', 'WhatsApp', 'Facebook', 'Google', 'Passou na porta', 'Outro'];

// Abas do cadastro. `done(form)` marca a bolinha verde quando a seção tem dados.
const TABS = [
  { id: 'identidade', label: 'Identidade', icon: User, done: (f) => !!(f.cpf || f.rg || f.birthDate || f.email || f.sexo) },
  { id: 'endereco', label: 'Endereço', icon: MapPin, done: (f) => !!(f.street && f.number && f.city) },
  { id: 'emergencia', label: 'Emergência', icon: Phone, done: (f) => !!(f.emgName && f.emgPhone) },
  { id: 'pessoais', label: 'Pessoais', icon: Briefcase, done: (f) => !!(f.maritalStatus || f.profession) },
  { id: 'relacionamento', label: 'Relacionamento', icon: Users, done: (f) => !!(f.tags?.length || f.observation) },
];

function ClientRegistrationModal({ open, onClose, lead, appUser, db, usersList, tags }) {
  const toast = useToast();
  const isAdmin = isAdminUser(appUser);
  const [form, setForm] = useState(() => readClientRegistration(lead));
  const [tab, setTab] = useState('identidade');
  const [cepBusy, setCepBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pct = useMemo(() => computeCompleteness(form), [form]);
  const cpfInvalid = isCpfComplete(form.cpf) && !isValidCpf(form.cpf);
  const tagSuggestions = (tags || []).map((t) => t.name);

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
    setLoading(true);
    try {
      const patch = buildClientRegistrationPatch(form, { isAdmin, usersList });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch);
      toast.success('Cadastro salvo!');
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="z-[210] w-full sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh]" overlayClassName="z-[210]">
        {/* Cabeçalho */}
        <DialogHeader className="shrink-0 flex flex-row items-center gap-3 text-left px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Pencil size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-bold tracking-tight leading-tight font-display">Cadastro do cliente</DialogTitle>
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
        <div className="shrink-0 flex gap-1 px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
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
              <Field label="WhatsApp" required><StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.whatsapp} onChange={(e) => set('whatsapp', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" /></Field>
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
                <Field label="Origem"><StyledSelect value={form.source} onChange={(e) => set('source', e.target.value)}>{!SOURCES.includes(form.source) && form.source && <option value={form.source}>{form.source}</option>}{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</StyledSelect></Field>
                <Field label="Consultor responsável">
                  {isAdmin ? (
                    <StyledSelect value={form.consultantId} onChange={(e) => set('consultantId', e.target.value)}><option value="">Selecione…</option>{(usersList || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</StyledSelect>
                  ) : (
                    <StyledInput value={lead.consultantName || '—'} disabled readOnly />
                  )}
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
      </DialogContent>
    </Dialog>
  );
}

export { ClientRegistrationModal };
