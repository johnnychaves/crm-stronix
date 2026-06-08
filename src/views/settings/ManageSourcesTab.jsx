import { useState } from 'react';
import { Activity, Check, Globe, LayoutDashboard, MessageCircle, Pencil, Trash2, Users, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, SOURCES_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';

function ManageSourcesTab({ db, sources, leads }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldSource = sources.find(s => s.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH, editingId), { name }, { merge: true });

      if (oldSource && oldSource.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => l.source === oldSource.name);
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { source: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH), { name, createdAt: serverTimestamp() });
    }
    setName('');
  };

  const handleDelete = async (s) => {
    const leadsWithSource = (leads || []).filter(l => l.source === s.name);
    if (leadsWithSource.length > 0) {
      toast.warning(`Origem "${s.name}" está em uso por ${leadsWithSource.length} lead(s). Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a origem "${s.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH, s.id));
      if (editingId === s.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Origens"
      hint="Controle de onde vêm os seus leads"
      icon={<Globe size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Zap size={14} />}
            placeholder="Nome da origem (ex: TikTok)"
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
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar origem</Btn>
        )}
      </form>

      {(() => {
        const totalLeads = (leads || []).length;
        const sourceIconFor = (name) => {
          const n = String(name || '').toLowerCase();
          if (n.includes('indica')) return Users;
          if (n.includes('whatsapp')) return MessageCircle;
          if (n.includes('site') || n.includes('web')) return LayoutDashboard;
          if (n.includes('instagram') || n.includes('facebook') || n.includes('tiktok') || n.includes('rede')) return Activity;
          if (n.includes('tráfego') || n.includes('trafego') || n.includes('ads')) return Zap;
          return Zap;
        };
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(sources || []).map(s => {
              const sourceLeads = (leads || []).filter(l => l.source === s.name).length;
              const pct = totalLeads > 0 ? Math.round((sourceLeads / totalLeads) * 100) : 0;
              const Icon = sourceIconFor(s.name);
              return (
                <div
                  key={s.id}
                  className="group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 hover:border-slate-300 dark:hover:border-white/10 transition relative"
                >
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(s.name); setEditingId(s.id); }} />
                    <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(s)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate">{s.name}</div>
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap">
                        {sourceLeads} {sourceLeads === 1 ? 'lead' : 'leads'} · {pct}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </SettingsCard>
  );
}

export { ManageSourcesTab };
