import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Info } from 'lucide-react';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, INTERACTIONS_PATH, LEADS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { isClientLead } from '../../lib/leads.js';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { SettingsBtn } from './settingsBits.jsx';

// Migrar leads — passa a carteira de um consultor para outro. Os três escopos
// são disjuntos e cobrem a base inteira, então dá para migrar só o que interessa
// (ex.: os leads em aberto, deixando perdas e clientes onde estão).

const SCOPES = [
  { id: 'open', label: 'Leads em aberto', match: (l) => !isClientLead(l) && l.status !== 'Perda' },
  { id: 'clients', label: 'Clientes ativos', match: (l) => isClientLead(l) },
  { id: 'losses', label: 'Perdas', match: (l) => l.status === 'Perda' }
];

const initialsOf = (name) => (name || '?')
  .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function ConsultantPicker({ label, value, onChange, options, counts, focused }) {
  const selected = options.find(o => o.id === value) || null;
  const count = selected ? (counts.get(selected.id) || 0) : 0;

  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500 mb-1.5">{label}</div>
      <div className={cn(
        'relative flex items-center gap-2.5 h-[52px] px-3.5 rounded-xl border transition',
        focused && selected ? 'border-brand-600 shadow-[0_0_0_3px_rgba(43,89,255,.14)] bg-card' : 'border-border bg-muted/60'
      )}>
        <span className="size-[30px] rounded-full grid place-items-center text-[11px] font-bold shrink-0 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {selected ? initialsOf(selected.name) : '—'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold truncate">{selected ? selected.name : 'Selecione o consultor'}</div>
          <div className="text-[11.5px] text-muted-foreground truncate num">
            {selected ? `${count} ${count === 1 ? 'lead na carteira' : 'leads na carteira'}` : '—'}
          </div>
        </div>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
        {/* Select nativo por cima: teclado, mobile e leitor de tela de graça. */}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 w-full h-full appearance-none bg-transparent opacity-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <option value="">Selecione o consultor…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function TransferSection({ db, usersList, appUser, leads }) {
  const toast = useToast();
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [scopes, setScopes] = useState(['open']);
  const [loading, setLoading] = useState(false);

  // Consultores já excluídos ainda aparecem como ORIGEM: a carteira deles
  // continua na base e precisa de destino.
  const orphans = useMemo(() => {
    const activeIds = new Set((usersList || []).map(u => u.id));
    const found = new Map();
    (leads || []).forEach(l => {
      if (l.consultantId && !activeIds.has(l.consultantId) && !found.has(l.consultantId)) {
        found.set(l.consultantId, {
          id: l.consultantId,
          name: l.consultantName ? `${l.consultantName} (excluído)` : `Consultor excluído (${l.consultantId.slice(0, 4)})`
        });
      }
    });
    return Array.from(found.values());
  }, [leads, usersList]);

  const fromOptions = [...(usersList || []), ...orphans];
  const toOptions = (usersList || []).filter(u => u.id !== fromUser);

  // Carteira total por consultor, para a legenda dos dois campos.
  const walletCounts = useMemo(() => {
    const map = new Map();
    (leads || []).forEach(l => {
      if (!l.consultantId) return;
      map.set(l.consultantId, (map.get(l.consultantId) || 0) + 1);
    });
    return map;
  }, [leads]);

  const scopeCounts = useMemo(() => {
    const owned = (leads || []).filter(l => l.consultantId === fromUser);
    return Object.fromEntries(SCOPES.map(s => [s.id, owned.filter(s.match).length]));
  }, [leads, fromUser]);

  const selectedCount = scopes.reduce((sum, id) => sum + (scopeCounts[id] || 0), 0);
  const fromObj = fromOptions.find(u => u.id === fromUser) || null;
  const toObj = (usersList || []).find(u => u.id === toUser) || null;
  const ready = Boolean(fromUser && toUser && fromUser !== toUser && scopes.length > 0);

  const toggleScope = (id) => setScopes(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const changeFrom = (id) => {
    setFromUser(id);
    if (id && id === toUser) setToUser('');
  };

  const migrate = async () => {
    if (!ready) { toast.warning('Escolha origem, destino e ao menos um tipo de lead.'); return; }
    const active = SCOPES.filter(s => scopes.includes(s.id));
    if (!window.confirm(
      `Migrar ${selectedCount} lead(s) de "${fromObj?.name}" para "${toObj?.name}"?\n\n` +
      `Inclui: ${active.map(s => s.label.toLowerCase()).join(', ')}, com as interações vinculadas. ` +
      'Esta ação não pode ser desfeita.'
    )) return;

    setLoading(true);
    try {
      // Busca no Firestore, não na memória: a tela pagina, e a migração precisa
      // alcançar a carteira inteira do consultor de origem.
      const snap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        where('consultantId', '==', fromUser)
      ));
      const movedIds = snap.docs
        .filter(d => active.some(s => s.match(d.data())))
        .map(d => d.id);

      if (movedIds.length === 0) {
        toast.info('Nenhum lead corresponde à seleção — nada foi migrado.');
        return;
      }

      await commitOpsInChunks(db, movedIds.map(id => ({
        ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, id),
        data: {
          consultantId: toUser,
          consultantName: toObj?.name || 'Consultor',
          consultantAuthUid: toObj?.authUid || null
        }
      })));

      // As interações carregam o dono do lead para o filtro do consultor —
      // sem isto o histórico sumiria da visão de quem recebeu a carteira.
      const movedSet = new Set(movedIds);
      const interactionsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
      const interactionOps = [];
      interactionsSnap.forEach(d => {
        const item = d.data();
        if (!item.leadId || !movedSet.has(item.leadId)) return;
        interactionOps.push({
          ref: doc(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH, d.id),
          data: { leadConsultantId: toUser, leadConsultantAuthUid: toObj?.authUid || null }
        });
      });
      await commitOpsInChunks(db, interactionOps);

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        text: `MIGRAÇÃO: ${movedIds.length} lead(s) de [${fromObj?.name}] para [${toObj?.name}] (${active.map(s => s.label.toLowerCase()).join(', ')}).`,
        consultantName: appUser?.name,
        type: 'note',
        createdAt: serverTimestamp(),
        actorId: appUser?.id || null,
        actorAuthUid: appUser?.authUid || null
      });

      toast.success(`${movedIds.length} lead(s) migrado(s) com sucesso.`);
      setFromUser('');
      setToUser('');
      setScopes(['open']);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao migrar leads. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Migrar leads"
        hint="Passe a carteira de um consultor para outro — sem perder histórico nem agendamentos."
      />

      <section className="rounded-2xl border border-border bg-card shadow-card p-6">
        <div className="grid gap-3 items-end lg:grid-cols-[1fr_44px_1fr]">
          <ConsultantPicker
            label="De"
            value={fromUser}
            onChange={changeFrom}
            options={fromOptions}
            counts={walletCounts}
          />
          <div className="hidden lg:grid place-items-center h-[52px]">
            <ArrowRight size={20} className="text-brand-600" />
          </div>
          <ConsultantPicker
            label="Para"
            value={toUser}
            onChange={setToUser}
            options={toOptions}
            counts={walletCounts}
            focused
          />
        </div>

        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500 mb-2.5">
            O que migrar
          </div>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map(s => {
              const on = scopes.includes(s.id);
              const count = scopeCounts[s.id] || 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleScope(s.id)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] text-[12.5px] font-semibold transition border',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                    on
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {s.label}
                  <span className={cn('num', on ? 'text-white/70' : 'opacity-60')}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {fromObj && toObj && (
          <div className="mt-5 flex items-center gap-3.5 flex-wrap px-[18px] py-4 rounded-xl bg-brand-50 dark:bg-brand-500/15">
            <Info size={16} className="text-brand-700 dark:text-brand-300 shrink-0" />
            <p className="text-[13px] text-brand-700 dark:text-brand-200 flex-1 min-w-[240px]">
              <b className="num">{selectedCount} {selectedCount === 1 ? 'lead passa' : 'leads passam'}</b> de {fromObj.name} para {toObj.name}. O histórico e a timeline de cada lead ficam intactos — só o responsável muda.
            </p>
            <SettingsBtn kind="primary" size={38} disabled={!ready || loading} onClick={migrate}>
              {loading ? 'Migrando…' : `Migrar ${selectedCount} ${selectedCount === 1 ? 'lead' : 'leads'}`}
            </SettingsBtn>
          </div>
        )}
      </section>
    </div>
  );
}

export { TransferSection };
