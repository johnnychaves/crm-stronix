import { useState } from 'react';
import { AlertCircle, BookOpen, Building2, Check, Dumbbell, Minus, Pencil, Plus, Target, Trash2, X, Zap } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { appId, CONFIG_PATH, CONFIG_GENERAL_ID, LEADS_PATH, MODALITIES_PATH, UNITS_PATH, USERS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { cn } from '../../lib/utils.js';
import { normalizeTrialClassOptions } from '../../lib/leadStatus.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';
import { ColorDot, SETTINGS_COLOR_OPTIONS } from '../../components/ui/ColorPicker.jsx';
import { DG_WEEKDAY_NAMES } from '../DailyGoalView.jsx';

function ManageGeneralSettingsTab({ db, modalities, trialClassOptions, units, leads, metaWeekdays, usersList }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);

  const [optionInput, setOptionInput] = useState('');
  const [savingOpts, setSavingOpts] = useState(false);

  // Unidades (academia) — nome + endereço opcional.
  const [unitName, setUnitName] = useState('');
  const [unitAddr, setUnitAddr] = useState('');
  const [unitEditingId, setUnitEditingId] = useState(null);

  const resetForm = () => { setName(''); setColor('blue'); setEditingId(null); };
  const resetUnitForm = () => { setUnitName(''); setUnitAddr(''); setUnitEditingId(null); };

  const saveUnit = async (e) => {
    e.preventDefault();
    const trimmed = unitName.trim();
    if (!trimmed) return;
    const dup = (units || []).some(u => u.id !== unitEditingId && (u.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`A unidade "${trimmed}" já existe.`); return; }
    try {
      if (unitEditingId) {
        const old = (units || []).find(u => u.id === unitEditingId);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', UNITS_PATH, unitEditingId), { name: trimmed, address: unitAddr.trim() }, { merge: true });
        // Propaga renomeação para os leads que já têm essa unidade gravada.
        if (old && old.name !== trimmed) {
          const leadsToUpdate = (leads || []).filter(l => l.appointmentUnit === old.name);
          if (leadsToUpdate.length > 0) {
            const ops = leadsToUpdate.map(lead => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
              data: { appointmentUnit: trimmed }
            }));
            await commitOpsInChunks(db, ops, 400);
          }
        }
        toast.success('Unidade atualizada.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', UNITS_PATH), {
          name: trimmed, address: unitAddr.trim(), order: (units || []).length, createdAt: serverTimestamp()
        });
        toast.success('Unidade criada.');
      }
      resetUnitForm();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a unidade.');
    }
  };

  const handleDeleteUnit = async (u) => {
    const inUse = (leads || []).filter(l => l.appointmentUnit === u.name).length;
    if (inUse > 0) {
      toast.warning(`A unidade "${u.name}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Excluir a unidade "${u.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', UNITS_PATH, u.id));
      if (unitEditingId === u.id) resetUnitForm();
    }
  };

  const saveModality = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Evita duplicada (case-insensitive), exceto a própria em edição.
    const dup = (modalities || []).some(m => m.id !== editingId && (m.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`A modalidade "${trimmed}" já existe.`); return; }
    try {
      if (editingId) {
        const old = (modalities || []).find(m => m.id === editingId);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH, editingId), { name: trimmed, color }, { merge: true });
        // Propaga renomeação para os leads que já têm essa modalidade gravada.
        if (old && old.name !== trimmed) {
          const leadsToUpdate = (leads || []).filter(l => l.appointmentModality === old.name);
          if (leadsToUpdate.length > 0) {
            const ops = leadsToUpdate.map(lead => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
              data: { appointmentModality: trimmed }
            }));
            await commitOpsInChunks(db, ops, 400);
          }
        }
        toast.success('Modalidade atualizada.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH), {
          name: trimmed, color, order: (modalities || []).length, createdAt: serverTimestamp()
        });
        toast.success('Modalidade criada.');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a modalidade.');
    }
  };

  const handleDelete = async (m) => {
    const inUse = (leads || []).filter(l => l.appointmentModality === m.name).length;
    if (inUse > 0) {
      toast.warning(`A modalidade "${m.name}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Excluir a modalidade "${m.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH, m.id));
      if (editingId === m.id) resetForm();
    }
  };

  // Persiste a lista completa de opções no config doc.
  const persistOptions = async (next) => {
    const clean = normalizeTrialClassOptions(next);
    setSavingOpts(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { trialClassOptions: clean },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar as opções de aulas.');
    }
    setSavingOpts(false);
  };

  // Liga/desliga um dia da semana na política de Meta Diária (config da
  // academia). 0=dom..6=sáb. Persiste no config geral (write só admin).
  const toggleMetaWeekday = async (dow) => {
    const set = new Set(Array.isArray(metaWeekdays) ? metaWeekdays : [1, 2, 3, 4, 5]);
    if (set.has(dow)) {
      // Não deixa zerar: ao menos um dia precisa valer, senão a Meta Diária
      // nunca dispara (todo dia vira "folga") e o ritmo do mês trava.
      if (set.size === 1) { toast.warning('Mantenha ao menos um dia ativo na meta.'); return; }
      set.delete(dow);
    } else set.add(dow);
    const next = Array.from(set).sort((a, b) => a - b);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { metaWeekdays: next },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os dias da meta.');
    }
  };

  // Alerta de lead crítico (config da academia): a partir de quantos dias de atraso
  // o lead vira "crítico" (alerta no painel da Equipe + destaque na meta).
  // Lido do contexto (mesmo doc geral); grava direto no clique, como os dias.
  const { slaOverdueDays } = useGeneralConfig();

  // Alvo INDIVIDUAL de prospecção (doc do consultor): vazio = remove o campo
  // (sem meta de prospecção). Mesmo campo editado na aba Equipe.
  const saveUserTarget = async (u, raw) => {
    const cur = u.dailyVolumeTarget ?? null;
    const next = raw === '' ? null : Math.min(500, Math.max(1, Math.floor(Number(raw))));
    if (raw !== '' && !Number.isFinite(next)) return;
    if (next === cur) return;
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, u.id),
        { dailyVolumeTarget: next === null ? deleteField() : next }
      );
      toast.success(`Prospecção de ${u.name}: ${next === null ? 'padrão da academia' : `${next} ações/dia`}.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o alvo individual.');
    }
  };
  const saveSla = async (n) => {
    if (!Number.isFinite(n) || n < 1 || n > 30) return;
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { slaOverdueDays: n },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o alerta de lead crítico.');
    }
  };

  const addOption = async (e) => {
    if (e) e.preventDefault();
    const n = Math.floor(Number(optionInput));
    if (!Number.isFinite(n) || n < 1 || n > 99) {
      toast.warning('Informe um número entre 1 e 99.');
      return;
    }
    if ((trialClassOptions || []).includes(n)) {
      toast.warning(`A opção "${n}" já existe.`);
      setOptionInput('');
      return;
    }
    await persistOptions([...(trialClassOptions || []), n]);
    setOptionInput('');
  };

  const removeOption = async (n) => {
    const next = (trialClassOptions || []).filter(x => x !== n);
    if (next.length === 0) {
      toast.warning('Mantenha ao menos uma opção de quantidade.');
      return;
    }
    await persistOptions(next);
  };

  return (
    <>
      <SettingsCard
        title="Dias da meta diária"
        hint="Dias da semana em que a Meta Diária vale para a equipe. A sequência do ritmo do mês pula os dias desligados."
        icon={<Target size={16} />}
      >
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex flex-wrap items-center gap-2">
            {DG_WEEKDAY_NAMES.map((name, dow) => {
              const on = (metaWeekdays || []).includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleMetaWeekday(dow)}
                  aria-pressed={on}
                  className={cn(
                    'px-3 h-9 rounded-lg text-[12.5px] font-semibold transition border',
                    on
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-card text-muted-foreground border-border hover:bg-accent'
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-3">
            Dias desligados não contam como meta (folga) e não quebram a sequência do consultor.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Alerta de lead crítico"
        hint="A partir de quantos dias de atraso um lead vira crítico"
        icon={<AlertCircle size={16} />}
      >
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => saveSla(slaOverdueDays - 1)}
                disabled={slaOverdueDays <= 1}
                className="size-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
              ><Minus size={14} /></button>
              <span className="num w-12 text-center text-[20px] font-bold text-slate-900 dark:text-white">{slaOverdueDays}</span>
              <button
                type="button"
                onClick={() => saveSla(slaOverdueDays + 1)}
                disabled={slaOverdueDays >= 30}
                className="size-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
              ><Plus size={14} /></button>
            </div>
            <span className="text-[13px] text-muted-foreground">{slaOverdueDays === 1 ? 'dia de atraso' : 'dias de atraso'} → lead <b className="text-rose-600 dark:text-rose-400">crítico</b></span>
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-3">
            Leads atrasados há {slaOverdueDays}+ {slaOverdueDays === 1 ? 'dia' : 'dias'} ganham alerta no painel da Equipe (gestor) e destaque vermelho na Meta Diária do consultor.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Meta de prospecção"
        hint="Piso de ações por dia, definido por consultor"
        icon={<Zap size={16} />}
      >
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Piso de esforço diário por consultor. Conta como <b>ação</b>: agendar ou reagendar visita/aula, registrar ligação ou mensagem, e cadastrar lead novo. Só concluir uma tarefa da meta (sem uma dessas ações) <b>não</b> conta. Quem zera as pendências <b>e</b> bate a prospecção ganha o selo <b>dia perfeito ⚡</b> — a prospecção não trava o "dia batido". O gestor entra só se você definir um alvo pra ele (não herda o padrão da academia).
          </p>

          {(usersList || []).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                Alvo por consultor — vazio = sem meta de prospecção
              </div>
              <div className="flex flex-col gap-2">
                {(usersList || []).map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 flex-1 truncate">{u.name}{u.role === 'admin' ? ' (gestor)' : ''}</span>
                    <input
                      type="number" min="1" max="500"
                      defaultValue={u.dailyVolumeTarget ?? ''}
                      placeholder="off"
                      onBlur={(e) => saveUserTarget(u, e.target.value.trim())}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-24 h-9 px-3 rounded-lg text-[12.5px] num text-center bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                    />
                    <span className="text-[11px] text-muted-foreground w-16">ações/dia</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2.5">Salva ao sair do campo (Enter confirma). O mesmo alvo também pode ser editado na aba Equipe.</p>
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Aulas experimentais"
        hint="Opções de quantidade que o consultor pode escolher ao agendar (ex: 1, 2, 5, 10, 15)"
        icon={<BookOpen size={16} />}
      >
        <div className="p-4 rounded-xl bg-muted/50 border border-border flex flex-col gap-4">
          <form onSubmit={addOption} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Quantidade de aulas
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={optionInput}
                onChange={e => setOptionInput(e.target.value)}
                placeholder="ex: 15"
                className="w-full h-10 rounded-lg bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[14px] num px-3 transition placeholder:text-muted-foreground"
              />
            </div>
            <Btn kind="primary" type="submit" icon={<Plus size={13} />} disabled={savingOpts}>Adicionar</Btn>
            <p className="text-[11.5px] text-muted-foreground flex-1 min-w-[200px]">
              O consultor escolhe uma destas opções ao agendar uma aula experimental — o que foi combinado com o aluno.
            </p>
          </form>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Opções disponíveis</div>
            <div className="flex flex-wrap gap-2">
              {(trialClassOptions || []).map(n => (
                <span key={n} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-lg bg-card border border-border text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  <span className="num">{n} {n === 1 ? 'aula' : 'aulas'}</span>
                  <button
                    type="button"
                    onClick={() => removeOption(n)}
                    title="Remover opção"
                    className="size-5 grid place-items-center rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Modalidades"
        hint="Modalidades da academia (ex: Musculação, Funcional, Cross)"
        icon={<Dumbbell size={16} />}
      >
        <form onSubmit={saveModality} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-muted/50 border border-border mb-5">
          <div className="flex-1 min-w-[220px]">
            <StyledInput
              icon={<Dumbbell size={14} />}
              placeholder="Nova modalidade (ex: Musculação)"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-1.5">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={color === c} onClick={() => setColor(c)} />
            ))}
          </div>
          {editingId ? (
            <div className="flex gap-2">
              <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
              <Btn kind="soft" type="button" onClick={resetForm}>Cancelar</Btn>
            </div>
          ) : (
            <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Adicionar modalidade</Btn>
          )}
        </form>

        {(modalities || []).length === 0 ? (
          <div className="text-center text-[12.5px] text-muted-foreground py-12">Nenhuma modalidade ainda — adicione a primeira acima.</div>
        ) : (
          <div className="divide-y divide-border">
            {(modalities || []).map(m => {
              const inUse = (leads || []).filter(l => l.appointmentModality === m.name).length;
              return (
                <div key={m.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition">
                  <ColorDot color={m.color || 'blue'} active={false} onClick={() => {}} size={18} />
                  <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 flex-1 truncate">{m.name}</span>
                  {inUse > 0 && (
                    <span className="num text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{inUse} {inUse === 1 ? 'lead' : 'leads'}</span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(m.name); setColor(m.color || 'blue'); setEditingId(m.id); }} />
                    <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(m)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Unidades"
        hint="Unidades/endereços da academia (usadas ao agendar uma visita)"
        icon={<Building2 size={16} />}
      >
        <form onSubmit={saveUnit} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-muted/50 border border-border mb-5">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Nome</label>
            <StyledInput icon={<Building2 size={14} />} placeholder="Ex: Moinhos" value={unitName} onChange={e => setUnitName(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Endereço (opcional)</label>
            <StyledInput placeholder="Ex: R. Padre Chagas, 320" value={unitAddr} onChange={e => setUnitAddr(e.target.value)} />
          </div>
          {unitEditingId ? (
            <div className="flex gap-2">
              <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
              <Btn kind="soft" type="button" onClick={resetUnitForm}>Cancelar</Btn>
            </div>
          ) : (
            <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Adicionar unidade</Btn>
          )}
        </form>

        {(units || []).length === 0 ? (
          <div className="text-center text-[12.5px] text-muted-foreground py-12">Nenhuma unidade ainda — adicione a primeira acima.</div>
        ) : (
          <div className="divide-y divide-border">
            {(units || []).map(u => {
              const inUse = (leads || []).filter(l => l.appointmentUnit === u.name).length;
              return (
                <div key={u.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 shrink-0">
                    <Building2 size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{u.name}</div>
                    {u.address && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{u.address}</div>}
                  </div>
                  {inUse > 0 && <span className="num text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{inUse} {inUse === 1 ? 'lead' : 'leads'}</span>}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setUnitName(u.name); setUnitAddr(u.address || ''); setUnitEditingId(u.id); }} />
                    <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDeleteUnit(u)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </>
  );
}

export { ManageGeneralSettingsTab };
