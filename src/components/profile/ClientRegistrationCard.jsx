import { User, MapPin, Phone, Briefcase, IdCard, Pencil, Check } from 'lucide-react';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { computeCompleteness, readClientRegistration } from '../../lib/clientRegistration.js';
import { cn } from '../../lib/utils.js';

const yearsFrom = (d) => {
  const dt = getSafeDateOrNull(d);
  if (!dt) return null;
  const now = new Date();
  let a = now.getFullYear() - dt.getFullYear();
  const m = now.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};

function KV({ k, v }) {
  if (!v) return null;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold mb-0.5">{k}</div>
      <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{v}</div>
    </div>
  );
}

function Block({ icon, title, children, empty, onEdit }) {
  return (
    <div className="py-3.5 border-b border-slate-100 dark:border-white/[0.05] last:border-b-0">
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">{icon}{title}</div>
      {empty ? (
        <button onClick={onEdit} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 border border-dashed border-brand-300 dark:border-brand-500/30 rounded-lg px-3 py-1.5 transition hover:bg-brand-100/70">
          <Pencil size={12} /> {title === 'Endereço' ? 'Adicionar endereço' : title === 'Contato de emergência' ? 'Adicionar contato' : 'Adicionar'}
        </button>
      ) : children}
    </div>
  );
}

// Card de leitura do cadastro do cliente. Só mostra blocos com dados; blocos
// vazios viram um atalho "Adicionar" que abre o modal (onEdit).
function ClientRegistrationCard({ lead, onEdit, readOnly = false }) {
  const f = readClientRegistration(lead);
  const pct = computeCompleteness(f);
  const age = yearsFrom(lead.birthDate);
  const hasAddress = !!(f.street || f.city || f.cep);
  const hasEmg = !!(f.emgName || f.emgPhone);
  const addressLine1 = [f.street, f.number].filter(Boolean).join(', ') + (f.complement ? ` · ${f.complement}` : '');
  const addressLine2 = [[f.neighborhood, f.city].filter(Boolean).join(' · '), f.state, f.cep].filter(Boolean).join(' · ');

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.05]">
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><IdCard size={16} /></span>
        <h3 className="font-display text-[14.5px] font-bold tracking-tight">Cadastro</h3>
        <span className={cn('ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md',
          pct >= 80 ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' : 'text-accent-600 bg-accent-50 dark:text-accent-300 dark:bg-accent-500/10')}>
          {pct >= 80 && <Check size={12} />}<span className="num">{pct}%</span> completo
        </span>
        {!readOnly && (
          <button onClick={onEdit} title="Editar cadastro" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 border border-slate-200 dark:border-white/10 hover:text-brand-600 hover:border-brand-300 transition"><Pencil size={15} /></button>
        )}
      </div>
      <div className="px-5 pb-4">
        <Block icon={<User size={13} />} title="Identidade">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <KV k="CPF" v={f.cpf} />
            <KV k="RG" v={f.rg} />
            <KV k="Nascimento" v={f.birthDate ? `${getSafeDateOrNull(lead.birthDate)?.toLocaleDateString('pt-BR')}${age != null ? ` · ${age} anos` : ''}` : null} />
            <KV k="Sexo" v={f.sexo} />
            <div className="col-span-2"><KV k="E-mail" v={f.email} /></div>
          </div>
        </Block>
        <Block icon={<MapPin size={13} />} title="Endereço" empty={!hasAddress} onEdit={onEdit}>
          <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{addressLine1 || '—'}</div>
          {addressLine2 && <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{addressLine2}</div>}
        </Block>
        <Block icon={<Phone size={13} />} title="Contato de emergência" empty={!hasEmg} onEdit={onEdit}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <KV k="Nome" v={f.emgName} />
            <KV k="Telefone" v={f.emgPhone} />
            <KV k="Parentesco" v={f.emgRelation} />
          </div>
        </Block>
        {(f.maritalStatus || f.profession) && (
          <Block icon={<Briefcase size={13} />} title="Dados pessoais">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <KV k="Estado civil" v={f.maritalStatus} />
              <KV k="Profissão" v={f.profession} />
            </div>
          </Block>
        )}
      </div>
    </section>
  );
}

export { ClientRegistrationCard };
