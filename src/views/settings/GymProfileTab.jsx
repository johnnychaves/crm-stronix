import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Clock, FileText, MapPin, User } from 'lucide-react';
import { auth } from '../../lib/firebase.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { Field, StyledInput } from '../../components/ui/Field.jsx';
import { Btn } from '../../components/ui/Btn.jsx';

// Aba self-service "Perfil da academia" (admin do tenant). Lê/grava via /api/asaas
// (handleTenantSelf: GET + POST action:'updateProfile') — sem função nova. Logo
// ADIADA (sem upload aqui). Modalidades e Unidades continuam em "Regras gerais"
// (fonte única); este perfil só as referencia e adiciona o horário.
// Direção visual aprovada: "Carteira da academia" (cartão-identidade + anel de
// completude no topo, 4 blocos em grade).

const EMPTY = {
  cnpjCpf: '', legalName: '',
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  responsibleName: '', whatsapp: '', email: '', phone: '',
  openingHours: '',
};

// Campos que contam para a completude (complemento é opcional, fica de fora).
const SCORED = [
  ['cnpjCpf', 'CNPJ/CPF'], ['legalName', 'razão social'],
  ['cep', 'CEP'], ['street', 'rua'], ['number', 'número'], ['neighborhood', 'bairro'],
  ['city', 'cidade'], ['state', 'UF'],
  ['responsibleName', 'responsável'], ['whatsapp', 'WhatsApp'], ['email', 'e-mail comercial'], ['phone', 'telefone'],
  ['openingHours', 'horário'],
];

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: 60, height: 60 }} aria-label={`Perfil ${pct}% completo`}>
      <svg viewBox="0 0 60 60" width="60" height="60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth="6" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 30 30)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[14px] font-bold text-brand-700 dark:text-brand-300 num">{pct}%</span>
    </div>
  );
}

function GymProfileTab({ modalities, units, onManageOperational }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/asaas', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok) {
          const p = json.profile || {};
          setForm({
            ...EMPTY, ...p,
            city: json.settings?.city || '', state: json.settings?.state || '',
            whatsapp: json.responsiblePhone || '',
          });
          setDisplayName(json.displayName || '');
        } else { toast.error(json.error || 'Não foi possível carregar o perfil.'); }
      } catch (e) { console.error('profile load', e); toast.error('Erro ao carregar o perfil.'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  }, []);

  const pct = useMemo(() => {
    const filled = SCORED.filter(([k]) => String(form[k] || '').trim()).length;
    return Math.round((filled / SCORED.length) * 100);
  }, [form]);
  const missing = useMemo(() => SCORED.filter(([k]) => !String(form[k] || '').trim()).map(([, l]) => l), [form]);

  const save = async () => {
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const body = {
        action: 'updateProfile',
        profile: {
          cnpjCpf: form.cnpjCpf, legalName: form.legalName,
          cep: form.cep, street: form.street, number: form.number, complement: form.complement, neighborhood: form.neighborhood,
          responsibleName: form.responsibleName, email: form.email, phone: form.phone,
          openingHours: form.openingHours,
        },
        settings: { city: form.city, state: form.state },
        responsiblePhone: form.whatsapp,
      };
      const res = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Não foi possível salvar o perfil.'); return; }
      toast.success('Perfil da academia salvo!');
    } catch (e) { console.error('profile save', e); toast.error('Erro ao salvar o perfil.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-center text-[13px] text-slate-400 py-12">Carregando o perfil…</div>;

  const cityUf = [form.city, form.state].filter(Boolean).join(' · ');
  return (
    <div className="space-y-5">
      {/* Carteira da academia — identidade + completude */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="h-1 bg-brand-600" />
        <div className="p-5 flex items-center gap-4">
          <div className="w-[58px] h-[58px] rounded-xl border border-dashed border-slate-300 dark:border-white/15 grid place-items-center text-slate-400 dark:text-slate-500 shrink-0 text-center leading-none">
            <span>
              <Building2 className="w-5 h-5 mx-auto" />
              <span className="block text-[8.5px] font-medium mt-1">logo · em breve</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[19px] font-bold tracking-tight truncate">{displayName || 'Sua academia'}</h3>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              <span className="num">{form.cnpjCpf ? `CNPJ ${form.cnpjCpf}` : 'CNPJ não informado'}</span>{cityUf ? ` · ${cityUf}` : ''}
            </p>
          </div>
          <Ring pct={pct} />
        </div>
        {missing.length > 0 && (
          <div className="px-5 pb-4 text-[11.5px] text-slate-400">
            Faltam: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` e +${missing.length - 3}` : ''}.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Identidade & fiscal */}
        <SettingsCard title="Identidade & fiscal" hint="Dados oficiais da empresa" icon={<FileText size={16} />}>
          <div className="space-y-4">
            <Field label="CNPJ / CPF"><StyledInput value={form.cnpjCpf} onChange={(e) => set('cnpjCpf', e.target.value)} placeholder="00.000.000/0000-00" /></Field>
            <Field label="Razão social"><StyledInput value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Nome empresarial" /></Field>
          </div>
        </SettingsCard>

        {/* Endereço */}
        <SettingsCard title="Endereço" hint="Onde a academia funciona" icon={<MapPin size={16} />}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP"><StyledInput value={form.cep} onChange={(e) => set('cep', e.target.value)} placeholder="00000-000" /></Field>
              <div className="col-span-2"><Field label="Rua / logradouro"><StyledInput value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Av. Exemplo" /></Field></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Número"><StyledInput value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="123" /></Field>
              <div className="col-span-2"><Field label="Complemento"><StyledInput value={form.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, andar…" /></Field></div>
            </div>
            <Field label="Bairro"><StyledInput value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Field label="Cidade"><StyledInput value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" /></Field></div>
              <Field label="UF"><StyledInput value={form.state} maxLength={2} onChange={(e) => set('state', e.target.value.toUpperCase())} placeholder="UF" /></Field>
            </div>
          </div>
        </SettingsCard>

        {/* Contato & responsável */}
        <SettingsCard title="Contato & responsável" hint="Quem responde pela academia" icon={<User size={16} />}>
          <div className="space-y-4">
            <Field label="Nome do responsável"><StyledInput value={form.responsibleName} onChange={(e) => set('responsibleName', e.target.value)} placeholder="Nome completo" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp"><StyledInput value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="55 51 99999-9999" /></Field>
              <Field label="Telefone"><StyledInput value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(51) 3333-3333" /></Field>
            </div>
            <Field label="E-mail comercial"><StyledInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@academia.com" /></Field>
          </div>
        </SettingsCard>

        {/* Operacional */}
        <SettingsCard title="Operacional" hint="Funcionamento da academia" icon={<Clock size={16} />}>
          <div className="space-y-4">
            <Field label="Horário de funcionamento" hint="Texto livre — ex.: Seg–Sex 6h–22h · Sáb 8h–14h">
              <textarea
                value={form.openingHours}
                onChange={(e) => set('openingHours', e.target.value)}
                rows={2}
                placeholder="Seg–Sex 6h–22h · Sáb 8h–14h · Dom fechado"
                className="w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
              />
            </Field>
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12px] text-slate-600 dark:text-slate-300">
                  <b className="num">{(modalities || []).length}</b> modalidade{(modalities || []).length === 1 ? '' : 's'} · <b className="num">{(units || []).length}</b> unidade{(units || []).length === 1 ? '' : 's'}
                </span>
                {onManageOperational && (
                  <button type="button" onClick={onManageOperational} className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 inline-flex items-center gap-1">
                    Gerir em Regras gerais →
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Modalidades e unidades ficam em Regras gerais — são usadas ao agendar visitas.</p>
            </div>
          </div>
        </SettingsCard>
      </div>

      <div className="flex justify-end">
        <Btn kind="brand" size="md" icon={<Check size={15} />} onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</Btn>
      </div>
    </div>
  );
}

export { GymProfileTab };
