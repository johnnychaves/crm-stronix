import { useState } from 'react';
import { Check, Pencil, ThumbsDown, Trash2, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, LOSS_REASONS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';

function ManageLossReasonsTab({ db, lossReasons, leads }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldReason = lossReasons.find(r => r.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH, editingId), { name }, { merge: true });

      if (oldReason && oldReason.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => l.lossReason === oldReason.name);
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { lossReason: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH), { name, createdAt: serverTimestamp() });
    }
    setName('');
  };

  const handleDelete = async (r) => {
    const leadsWithReason = (leads || []).filter(l => l.lossReason === r.name);
    if (leadsWithReason.length > 0) {
      toast.warning(`Motivo "${r.name}" está em uso por ${leadsWithReason.length} lead(s). Não é possível excluí-lo.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o motivo "${r.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH, r.id));
      if (editingId === r.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Motivos de perda"
      hint="Justificativas padronizadas para análise de perdas"
      icon={<ThumbsDown size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<ThumbsDown size={14} />}
            placeholder="Novo motivo (ex: Mudou de cidade)"
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
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar motivo</Btn>
        )}
      </form>

      {(() => {
        const counts = (lossReasons || []).map(r => ({
          r,
          n: (leads || []).filter(l => l.status === 'Perda' && l.lossReason === r.name).length
        }));
        const total = counts.reduce((s, x) => s + x.n, 0);
        const max = counts.reduce((m, x) => Math.max(m, x.n), 0);
        if (counts.length === 0) {
          return <div className="text-center text-[12.5px] text-slate-400 italic py-12">Nenhum motivo cadastrado ainda.</div>;
        }
        return (
          <div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Motivo</span>
              <span>Ocorrências</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {counts.map(({ r, n }) => {
                const pct = max ? Math.round((n / max) * 100) : 0;
                const share = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={r.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                    <span className="w-7 h-7 rounded-lg grid place-items-center bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 shrink-0">
                      <ThumbsDown size={13} />
                    </span>
                    <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 min-w-[160px] flex-shrink-0 truncate">{r.name}</span>
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="num text-[12px] text-slate-500 dark:text-slate-400 w-10 text-right whitespace-nowrap">{share}%</span>
                    </div>
                    <span className="num text-[13px] font-semibold text-slate-800 dark:text-slate-100 w-10 text-right">{n}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(r.name); setEditingId(r.id); }} />
                      <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(r)} />
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

// Configurações Gerais: modalidades da academia + opções de quantidade de aulas.
export { ManageLossReasonsTab };
