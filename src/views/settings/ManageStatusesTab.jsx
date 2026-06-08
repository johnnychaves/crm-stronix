import { useState } from 'react';
import { Check, GripVertical, Kanban, Lock, Pencil, Trash2, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { appId, LEADS_PATH, STATUSES_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';
import { ColorBadge, ColorDot, SETTINGS_COLOR_OPTIONS } from '../../components/ui/ColorPicker.jsx';

function ManageStatusesTab({ db, statuses, leads, funnelId, funnelName }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);

  const statusesForFunnel = (statuses || []).filter(s => s.funnelId === funnelId);

  // Etapa de sistema: junto com Venda/Perda (hardcoded), Negociação é fixa em
  // todo funil. Identificada por isSystem=true OU pelo nome (legado).
  const isSystemStage = (s) =>
    Boolean(s?.isSystem) || (s?.name || '').trim().toLowerCase() === 'negociação';

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldStatus = statuses.find(s => s.id === editingId);
      if (oldStatus && isSystemStage(oldStatus)) {
        toast.warning(`A etapa "${oldStatus.name}" é uma fase fixa do sistema e não pode ser renomeada.`);
        setEditingId(null);
        setName('');
        return;
      }
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, editingId),
        { name, color },
        { merge: true }
      );

      // Renomeação propaga para os leads (apenas do mesmo funil)
      if (oldStatus && oldStatus.name !== name) {
        const leadsToUpdate = (leads || []).filter(
          l => l.funnelId === funnelId && l.status === oldStatus.name
        );
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { status: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      // Bloqueia criação duplicada da etapa "Negociação" — ela é única por funil.
      if ((name || '').trim().toLowerCase() === 'negociação' &&
          statusesForFunnel.some(s => (s.name || '').trim().toLowerCase() === 'negociação')) {
        toast.warning('A etapa "Negociação" já existe neste funil (etapa fixa do sistema).');
        return;
      }
      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH),
        { name, color, order: statusesForFunnel.length, funnelId }
      );
    }
    setName('');
  };

  const drop = async (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    const arr = [...statusesForFunnel];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, item);
    await Promise.all(arr.map((s, i) =>
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id), { order: i }, { merge: true })
    ));
  };

  const handleDelete = async (s) => {
    if (isSystemStage(s)) {
      toast.warning(`A etapa "${s.name}" é uma fase fixa do sistema e não pode ser excluída.`);
      return;
    }
    const leadsInStatus = (leads || []).filter(l => l.funnelId === funnelId && l.status === s.name);
    if (leadsInStatus.length > 0) {
      toast.warning(`Etapa "${s.name}" tem ${leadsInStatus.length} lead(s). Transfira-os para outra etapa antes de excluir.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a etapa "${s.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id));
      if (editingId === s.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title={`Pipeline · ${funnelName || 'Funil'}`}
      hint="Defina as etapas da jornada deste funil"
      icon={<Kanban size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Kanban size={14} />}
            placeholder="Nome da etapa (ex: Em contato)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-center">Cor</div>
          <div className="flex items-center gap-1.5 h-10">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={color === c} onClick={() => setColor(c)} size={22} />
            ))}
          </div>
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
            <Btn kind="soft" onClick={() => { setEditingId(null); setName(''); }} type="button">Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Adicionar etapa</Btn>
        )}
      </form>

      {statusesForFunnel.length === 0 ? (
        <div className="text-center text-[12.5px] text-slate-400 italic py-12">
          Nenhuma etapa neste funil ainda. Crie a primeira etapa acima.
        </div>
      ) : (
        <>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/[0.1] text-center mb-3">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <GripVertical size={12} /> Arraste as etapas para reordenar o seu funil
            </p>
          </div>
          <div className="space-y-2">
            {statusesForFunnel.map((s, i) => {
              const leadCount = (leads || []).filter(l => l.funnelId === funnelId && l.status === s.name).length;
              const isSystem = isSystemStage(s);
              return (
                <div
                  key={s.id}
                  draggable={!isSystem}
                  onDragStart={e => { if (!isSystem) e.dataTransfer.setData('idx', i); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => drop(Number(e.dataTransfer.getData('idx')), i)}
                  className={`group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/10 transition ${
                    isSystem ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg grid place-items-center transition shrink-0 ${
                    isSystem
                      ? 'text-slate-200 dark:text-white/[0.08]'
                      : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:text-slate-600 dark:hover:text-slate-300'
                  }`}>
                    {isSystem ? <Lock size={14} /> : <GripVertical size={16} />}
                  </span>
                  <span className="text-[11px] font-semibold num text-slate-500 dark:text-slate-400 w-6 text-center shrink-0">{i + 1}</span>
                  <ColorBadge color={s.color || 'blue'} name={s.name} />
                  {isSystem && (
                    <span
                      title="Etapa fixa do sistema — não pode ser editada ou excluída"
                      className="text-[9.5px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 shrink-0"
                    >
                      Fixa
                    </span>
                  )}
                  <div className="flex-1"></div>
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap">
                    <span className="num font-semibold text-slate-700 dark:text-slate-200">{leadCount}</span> {leadCount === 1 ? 'lead na etapa' : 'leads na etapa'}
                  </span>
                  {!isSystem && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <IconBtn icon={<Pencil size={14} />} kind="edit" title="Editar" onClick={() => { setName(s.name); setColor(s.color || 'blue'); setEditingId(s.id); }} />
                      <IconBtn icon={<Trash2 size={14} />} kind="danger" title="Excluir" onClick={() => handleDelete(s)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </SettingsCard>
  );
}

export { ManageStatusesTab };
