import { useState } from 'react';
import { Check, HeartPulse, Pencil, Trash2, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, DORES_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';

// Catálogo de DORES (necessidades do lead — o que ele quer resolver). Espelha o
// padrão dos demais catálogos (ex.: ManageLossReasonsTab): lista name-only, com
// criar/editar/excluir. Ao renomear, propaga para os leads que usam a dor.
function ManageDoresTab({ db, dores, leads }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const old = (dores || []).find(d => d.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DORES_PATH, editingId), { name }, { merge: true });

      if (old && old.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => l.dor === old.name);
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { dor: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', DORES_PATH), { name, createdAt: serverTimestamp() });
    }
    setName('');
  };

  const handleDelete = async (d) => {
    const leadsWithDor = (leads || []).filter(l => l.dor === d.name);
    if (leadsWithDor.length > 0) {
      toast.warning(`A dor "${d.name}" está em uso por ${leadsWithDor.length} lead(s). Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a dor "${d.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DORES_PATH, d.id));
      if (editingId === d.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Dores"
      hint="Necessidades/objetivos que o lead quer resolver (ex.: emagrecer, dor nas costas)"
      icon={<HeartPulse size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-border mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<HeartPulse size={14} />}
            placeholder="Nova dor (ex.: Emagrecer / Voltar a treinar)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
            <Btn kind="soft" type="button" onClick={() => { setEditingId(null); setName(''); }}>Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar dor</Btn>
        )}
      </form>

      {(() => {
        const counts = (dores || []).map(d => ({
          d,
          n: (leads || []).filter(l => l.dor === d.name).length
        }));
        const total = counts.reduce((s, x) => s + x.n, 0);
        const max = counts.reduce((m, x) => Math.max(m, x.n), 0);
        if (counts.length === 0) {
          return <div className="text-center text-[12.5px] text-slate-400 italic py-12">Nenhuma dor cadastrada ainda.</div>;
        }
        return (
          <div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Dor</span>
              <span>Leads</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {counts.map(({ d, n }) => {
                const pct = max ? Math.round((n / max) * 100) : 0;
                const share = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={d.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                    <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                      <HeartPulse size={13} />
                    </span>
                    <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 min-w-[160px] flex-shrink-0 truncate">{d.name}</span>
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="num text-[12px] text-slate-500 dark:text-slate-400 w-10 text-right whitespace-nowrap">{share}%</span>
                    </div>
                    <span className="num text-[13px] font-semibold text-slate-800 dark:text-slate-100 w-10 text-right">{n}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(d.name); setEditingId(d.id); }} />
                      <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(d)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </SettingsCard>
  );
}

export { ManageDoresTab };
