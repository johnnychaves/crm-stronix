import { useState } from 'react';
import { Check, Clock, DollarSign, Layers, Pencil, Power, Trash2 } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, PLANS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { fmtBRL } from '../../lib/format.js';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { Field, StyledInput, StyledSelect } from '../../components/ui/Field.jsx';

// Catálogo de planos/serviços que a academia oferece. O consultor escolhe
// um plano na matrícula (e pode ajustar o valor). Planos inativos somem do
// seletor de matrícula mas seguem no histórico dos contratos.
const durationLabel = (m) => {
  const n = Number(m) || 0;
  return `${n} ${n === 1 ? 'mês' : 'meses'}`;
};

function ManagePlansTab({ db, planos, leads, modalities }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [modalityId, setModalityId] = useState('');
  const [editingId, setEditingId] = useState(null);

  const plansRef = collection(db, 'artifacts', appId, 'public', 'data', PLANS_PATH);

  const resetForm = () => {
    setName(''); setValue(''); setDurationMonths('1'); setModalityId(''); setEditingId(null);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setName(p.name || '');
    setValue(String(p.value ?? ''));
    setDurationMonths(String(p.durationMonths ?? '1'));
    setModalityId(p.modalityId || '');
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      value: Number(value) || 0,
      durationMonths: Math.max(1, Number(durationMonths) || 1),
      modalityId: modalityId || null
    };
    if (!payload.name) { toast.warning('Informe o nome do plano.'); return; }

    if (editingId) {
      const old = (planos || []).find(p => p.id === editingId);
      await setDoc(doc(plansRef, editingId), payload, { merge: true });
      // Mantém o nome denormalizado nos clientes em dia quando o plano é renomeado.
      if (old && old.name !== payload.name) {
        const leadsToUpdate = (leads || []).filter(l => l.currentPlanName === old.name);
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(l => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
            data: { currentPlanName: payload.name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
    } else {
      const order = (planos || []).reduce((mx, p) => Math.max(mx, p.order || 0), 0) + 1;
      await addDoc(plansRef, { ...payload, active: true, order, createdAt: serverTimestamp() });
    }
    resetForm();
  };

  const toggleActive = async (p) => {
    await setDoc(doc(plansRef, p.id), { active: p.active === false }, { merge: true });
  };

  const handleDelete = async (p) => {
    const inUse = (leads || []).filter(l => l.currentPlanName === p.name).length;
    if (inUse > 0) {
      toast.warning(`Plano "${p.name}" está em uso por ${inUse} cliente(s). Desative-o em vez de excluir.`);
      return;
    }
    if (window.confirm(`Excluir o plano "${p.name}"?`)) {
      await deleteDoc(doc(plansRef, p.id));
      if (editingId === p.id) resetForm();
    }
  };

  const modalityName = (id) => (modalities || []).find(m => m.id === id)?.name || null;

  return (
    <SettingsCard
      title="Planos"
      hint="Catálogo de planos e serviços oferecidos na matrícula"
      icon={<DollarSign size={16} />}
    >
      <form onSubmit={save} className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-border mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Field label="Nome do plano">
            <StyledInput
              icon={<Layers size={14} />}
              placeholder="Ex: Mensal Musculação"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Valor (R$)">
            <StyledInput
              type="number" min="0" step="1"
              icon={<DollarSign size={14} />}
              placeholder="99"
              value={value}
              onChange={e => setValue(e.target.value)}
              required
            />
          </Field>
          <Field label="Duração (meses)">
            <StyledInput
              type="number" min="1" step="1"
              icon={<Clock size={14} />}
              placeholder="1"
              value={durationMonths}
              onChange={e => setDurationMonths(e.target.value)}
              required
            />
          </Field>
          <Field label="Modalidade (opcional)">
            <StyledSelect value={modalityId} onChange={e => setModalityId(e.target.value)}>
              <option value="">Sem modalidade</option>
              {(modalities || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </StyledSelect>
          </Field>
        </div>
        <div className="flex gap-2 mt-3">
          {editingId ? (
            <>
              <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
              <Btn kind="soft" type="button" onClick={resetForm}>Cancelar</Btn>
            </>
          ) : (
            <Btn kind="primary" type="submit" icon={<DollarSign size={13} />}>Criar plano</Btn>
          )}
        </div>
      </form>

      {(planos || []).length === 0 ? (
        <div className="px-3 py-10 text-center text-[12.5px] text-slate-400">
          Nenhum plano cadastrado ainda. Crie o primeiro acima (ex: "Mensal Musculação – R$99 – 1 mês").
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(planos || []).map(p => {
            const inactive = p.active === false;
            const clientes = (leads || []).filter(l => l.currentPlanName === p.name).length;
            const mod = modalityName(p.modalityId);
            return (
              <div
                key={p.id}
                className={`group rounded-xl border border-border bg-card p-4 hover:border-slate-300 dark:hover:border-white/10 transition relative ${inactive ? 'opacity-60' : ''}`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <IconBtn icon={<Power size={13} />} kind={inactive ? 'edit' : 'danger'} title={inactive ? 'Reativar' : 'Desativar'} onClick={() => toggleActive(p)} />
                  <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => startEdit(p)} />
                  <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(p)} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                    <Layers size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] truncate flex items-center gap-2">
                      {p.name}
                      {inactive && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">Inativo</span>}
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {fmtBRL(p.value)} · {durationLabel(p.durationMonths)}{mod ? ` · ${mod}` : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11.5px] text-slate-500 dark:text-slate-400">
                  {clientes} {clientes === 1 ? 'cliente' : 'clientes'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}

export { ManagePlansTab };
