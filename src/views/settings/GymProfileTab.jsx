import { useEffect, useMemo, useState } from 'react';
import { Building2, Check } from 'lucide-react';
import { auth } from '../../lib/firebase.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { EMPTY_PROFILE, buildTenantProfilePayload, readTenantProfile } from '../../lib/gymProfile.js';
import { GymProfileFields } from '../../components/profile/GymProfileFields.jsx';
import { Btn } from '../../components/ui/Btn.jsx';

// Página "Perfil da academia" (admin do tenant). Lê/grava via /api/asaas
// (handleTenantSelf: GET + POST action:'updateProfile'). Os campos + lookups
// vivem em GymProfileFields; o mapeamento form↔tenant em lib/gymProfile.js.

// Campos que contam para a completude (complemento e nome fantasia são opcionais).
const SCORED = [
  ['cnpjCpf', 'CNPJ'], ['legalName', 'razão social'],
  ['cep', 'CEP'], ['street', 'rua'], ['number', 'número'], ['neighborhood', 'bairro'],
  ['city', 'cidade'], ['state', 'UF'],
  ['responsibleName', 'responsável'], ['responsibleCpf', 'CPF'], ['responsibleBirth', 'nascimento'],
  ['whatsapp', 'WhatsApp'], ['email', 'e-mail comercial'], ['phone', 'telefone'],
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

function GymProfileTab() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cpfInvalid, setCpfInvalid] = useState(false);
  const onChange = (patch) => setForm((s) => ({ ...s, ...patch }));

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/asaas', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok) {
          setForm(readTenantProfile(json));
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
    if (cpfInvalid) { toast.warning('O CPF do responsável é inválido. Corrija antes de salvar.'); return; }
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const { profile, settings, responsiblePhone } = buildTenantProfilePayload(form);
      const res = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'updateProfile', profile, settings, responsiblePhone }),
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
            <h3 className="font-display text-[19px] font-bold tracking-tight truncate">{form.tradeName || displayName || 'Sua academia'}</h3>
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

      <GymProfileFields value={form} onChange={onChange} wrapInCards onValidityChange={setCpfInvalid} />

      <div className="flex justify-end">
        <Btn kind="brand" size="md" icon={<Check size={15} />} onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</Btn>
      </div>
    </div>
  );
}

export { GymProfileTab };
