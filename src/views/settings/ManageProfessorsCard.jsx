import { useState } from 'react';
import { Check, GraduationCap, Pencil, Plus, Trash2, X } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, PROFESSORS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { professorModalityNames } from '../../lib/professores.js';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';

// Cadastro de professores — catálogo simples (sem login, sem limite de vaga do
// plano), usado ao agendar aula experimental. Segue o padrão de modalidades/
// unidades em ManageGeneralSettingsTab: form inline, dedupe por nome,
// propagação de renomeação e bloqueio de exclusão em uso.
function ManageProfessorsCard({ db, leads }) {
  const toast = useToast();
  const { professores, modalities } = useGeneralConfig();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [modIds, setModIds] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setName(''); setModIds([]); setEditingId(null); setShowForm(false); };
  const toggleMod = (id) => setModIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const openNew = () => { setEditingId(null); setName(''); setModIds([]); setShowForm(true); };
  const openEdit = (p) => { setEditingId(p.id); setName(p.nome || ''); setModIds(p.modalidadeIds || []); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast.warning('Informe o nome do professor.'); return; }
    const dup = (professores || []).some((p) => p.id !== editingId && (p.nome || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`O professor "${trimmed}" já existe.`); return; }
    try {
      if (editingId) {
        const old = (professores || []).find((p) => p.id === editingId);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, editingId), { nome: trimmed, modalidadeIds: modIds }, { merge: true });
        // Propaga renomeação para os leads que já têm esse professor gravado.
        if (old && old.nome !== trimmed) {
          const leadsToUpdate = (leads || []).filter((l) => l.appointmentProfessorId === editingId);
          if (leadsToUpdate.length > 0) {
            const ops = leadsToUpdate.map((lead) => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
              data: { appointmentProfessorName: trimmed }
            }));
            await commitOpsInChunks(db, ops, 400);
          }
        }
        toast.success('Professor atualizado.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH), {
          nome: trimmed, modalidadeIds: modIds, ativo: true, order: (professores || []).length, createdAt: serverTimestamp()
        });
        toast.success('Professor cadastrado.');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o professor.');
    }
  };

  const handleDelete = async (p) => {
    const inUse = (leads || []).filter((l) => l.appointmentProfessorId === p.id).length;
    if (inUse > 0) {
      toast.warning(`"${p.nome}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluí-lo.`);
      return;
    }
    if (window.confirm(`Excluir o professor "${p.nome}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, p.id));
      if (editingId === p.id) resetForm();
    }
  };

  return (
    <SettingsCard
      title="Professores"
      hint="Professores da academia e as modalidades em que atuam (usados ao agendar aula experimental)"
      icon={<GraduationCap size={16} />}
      action={
        <Btn kind={showForm ? 'soft' : 'brand'} icon={showForm ? <X size={13} /> : <Plus size={13} />} onClick={() => (showForm ? resetForm() : openNew())}>
          {showForm ? 'Cancelar' : 'Adicionar professor'}
        </Btn>
      }
    >
      {showForm && (
        <form onSubmit={save} className="p-4 rounded-xl bg-muted/50 border border-border mb-5 flex flex-col gap-4 animate-fade-in">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Nome</label>
            <StyledInput icon={<GraduationCap size={14} />} placeholder="Ex: João Silva" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Modalidades em que atua</label>
            {(modalities || []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nenhuma modalidade cadastrada. Adicione em Regras gerais → Modalidades.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(modalities || []).map((m) => {
                  const on = modIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMod(m.id)}
                      aria-pressed={on}
                      className={cn(
                        'px-3 h-9 rounded-lg text-[12.5px] font-semibold transition border',
                        on ? 'bg-brand-600 text-white border-brand-600' : 'bg-card text-muted-foreground border-border hover:bg-accent'
                      )}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>{editingId ? 'Salvar' : 'Cadastrar professor'}</Btn>
            <Btn kind="soft" type="button" onClick={resetForm}>Cancelar</Btn>
          </div>
        </form>
      )}
      {(professores || []).length === 0 ? (
        <div className="text-center text-[12.5px] text-muted-foreground py-12">Nenhum professor ainda — adicione o primeiro acima.</div>
      ) : (
        <div className="divide-y divide-border">
          {(professores || []).map((p) => {
            const mods = professorModalityNames(p, modalities);
            const inUse = (leads || []).filter((l) => l.appointmentProfessorId === p.id).length;
            return (
              <div key={p.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition">
                <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                  <GraduationCap size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{p.nome}</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{mods.length ? mods.join(' · ') : 'Sem modalidade'}</div>
                </div>
                {inUse > 0 && <span className="num text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{inUse} {inUse === 1 ? 'lead' : 'leads'}</span>}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => openEdit(p)} />
                  <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(p)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}

export { ManageProfessorsCard };
