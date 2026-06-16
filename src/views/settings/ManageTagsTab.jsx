import { useState } from 'react';
import { Check, Pencil, Tag, Trash2, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { appId, LEADS_PATH, TAGS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';
import { ColorBadge, ColorDot, SETTINGS_COLOR_OPTIONS } from '../../components/ui/ColorPicker.jsx';

function ManageTagsTab({ db, tags, leads }) {
  const toast = useToast();
  const [name, setName] = useState(''); const [color, setColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldTag = tags.find(t => t.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', TAGS_PATH, editingId), { name, color }, { merge: true });

      if (oldTag && oldTag.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => (l.tags || []).includes(oldTag.name));
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { tags: (lead.tags || []).map(t => t === oldTag.name ? name : t) }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH), { name, color });
    }
    setName('');
  };

  const handleDelete = async (t) => {
    const leadsWithTag = (leads || []).filter(l => (l.tags || []).includes(t.name));
    if (leadsWithTag.length > 0) {
      toast.warning(`Etiqueta "${t.name}" está em ${leadsWithTag.length} lead(s). Remova-a desses leads antes de excluir.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a etiqueta "${t.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', TAGS_PATH, t.id));
      if (editingId === t.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Etiquetas"
      hint="Marcadores rápidos para segmentar e filtrar leads"
      icon={<Tag size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-border mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Tag size={14} />}
            placeholder="Nome da etiqueta (ex: Plano anual)"
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
            <Btn kind="soft" onClick={() => { setEditingId(null); setName(''); setColor('blue'); }} type="button">Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar etiqueta</Btn>
        )}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {(tags || []).map(t => {
          const tagLeads = (leads || []).filter(l => Array.isArray(l.tags) && l.tags.includes(t.name)).length;
          return (
            <div
              key={t.id}
              className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-slate-300 dark:hover:border-white/10 transition"
            >
              <ColorBadge color={t.color || 'blue'} name={t.name} />
              <div className="flex-1"></div>
              <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{tagLeads}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(t.name); setColor(t.color || 'blue'); setEditingId(t.id); }} />
                <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(t)} />
              </div>
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}

export { ManageTagsTab };
