import { useState } from 'react';
import { Check, GripVertical, Kanban, Pencil, Trash2, Trophy, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { appId, FUNNELS_PATH, STATUSES_PATH } from '../../lib/firebase.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';

function ManageFunnelsTab({ db, funnels, statuses, leads, onSelectFunnel }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const safeFunnels = Array.isArray(funnels) ? funnels : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Novos funis nunca nascem como padrão. O único "padrão" é definido pelo botão dedicado.
    const funnelRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH), {
      name: trimmed,
      order: safeFunnels.length,
      isDefault: false,
      createdAt: serverTimestamp()
    });
    // Todo funil novo já nasce com a etapa de sistema "Negociação" — junto
    // com Venda/Perda (hardcoded como colunas terminais), são as três fases
    // fixas do sistema. A etapa carrega isSystem=true para o ManageStatusesTab
    // bloquear edit/delete.
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), {
      name: 'Negociação',
      color: 'purple',
      order: 0,
      funnelId: funnelRef.id,
      isSystem: true
    });
    setName('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const trimmed = editingName.trim();
    if (!trimmed || !editingId) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, editingId),
      { name: trimmed },
      { merge: true }
    );
    setEditingId(null);
    setEditingName('');
  };

  const handleReorder = async (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    const arr = [...safeFunnels];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, item);
    await Promise.all(arr.map((f, i) =>
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id), { order: i }, { merge: true })
    ));
  };

  const handleSetDefault = async (f) => {
    if (f.isDefault) return;
    const batch = writeBatch(db);
    safeFunnels.forEach(item => {
      if (item.isDefault) {
        batch.update(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, item.id), { isDefault: false });
      }
    });
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id), { isDefault: true });
    await batch.commit();
  };

  const handleDelete = async (f) => {
    if (f.isDefault) {
      toast.warning('Não é possível excluir o funil padrão. Marque outro como padrão antes.');
      return;
    }
    const leadsInFunnel = (leads || []).filter(l => l.funnelId === f.id);
    if (leadsInFunnel.length > 0) {
      toast.warning(`Funil "${f.name}" tem ${leadsInFunnel.length} lead(s). Mova-os para outro funil antes de excluir.`);
      return;
    }
    const statusesInFunnel = (statuses || []).filter(s => s.funnelId === f.id);
    if (statusesInFunnel.length > 0) {
      if (!window.confirm(`Este funil tem ${statusesInFunnel.length} etapa(s) configurada(s). Excluir o funil também excluirá essas etapas. Confirma?`)) return;
      const batch = writeBatch(db);
      statusesInFunnel.forEach(s => {
        batch.delete(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id));
      });
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id));
      await batch.commit();
    } else {
      if (!window.confirm(`Excluir o funil "${f.name}"?`)) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id));
    }
  };

  return (
    <SettingsCard
      title="Funis ativos"
      hint="Crie funis paralelos (Comercial, Indicação, Inativos, Renovações…) e configure as etapas"
      icon={<Kanban size={16} />}
    >
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Kanban size={14} />}
            placeholder="Nome do funil (ex: Indicação)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Adicionar funil</Btn>
      </form>

      {safeFunnels.length === 0 ? (
        <div className="text-center text-[12.5px] text-slate-400 italic py-12">
          Nenhum funil cadastrado ainda. Crie o primeiro funil acima.
        </div>
      ) : (
        <>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/[0.1] text-center mb-3">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <GripVertical size={12} /> Arraste os funis para reordenar
            </p>
          </div>
          <div className="space-y-2">
            {safeFunnels.map((f, i) => (
              <div
                key={f.id}
                draggable={editingId !== f.id}
                onDragStart={e => e.dataTransfer.setData('idx', i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleReorder(Number(e.dataTransfer.getData('idx')), i)}
                className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/10 transition cursor-grab active:cursor-grabbing"
              >
                <span className="w-8 h-8 rounded-lg grid place-items-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:text-slate-600 dark:hover:text-slate-300 transition shrink-0">
                  <GripVertical size={16} />
                </span>
                {editingId === f.id ? (
                  <form onSubmit={handleSaveEdit} className="flex gap-2 flex-1 items-center">
                    <StyledInput
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="flex-1"
                    />
                    <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
                    <Btn kind="soft" type="button" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancelar</Btn>
                  </form>
                ) : (
                  <>
                    <span className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{f.name}</span>
                    {f.isDefault && (
                      <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                        Padrão
                      </span>
                    )}
                    <div className="flex-1"></div>
                    <Btn kind="soft" size="sm" onClick={() => onSelectFunnel(f.id)}>Configurar etapas</Btn>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      {!f.isDefault && (
                        <IconBtn icon={<Trophy size={14} />} title="Tornar padrão" onClick={() => handleSetDefault(f)} />
                      )}
                      <IconBtn icon={<Pencil size={14} />} kind="edit" title="Renomear" onClick={() => { setEditingId(f.id); setEditingName(f.name); }} />
                      <IconBtn icon={<Trash2 size={14} />} kind="danger" title="Excluir" onClick={() => handleDelete(f)} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </SettingsCard>
  );
}

export { ManageFunnelsTab };
