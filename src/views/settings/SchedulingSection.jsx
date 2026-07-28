import { useMemo, useState } from 'react';
import { BookOpen, Building2, Dumbbell, MapPin, Pencil, Plus, X } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, CONFIG_PATH, CONFIG_GENERAL_ID, MODALITIES_PATH, UNITS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { getLeadAppointmentDate } from '../../lib/leads.js';
import { normalizeTrialClassOptions } from '../../lib/leadStatus.js';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ColorDot, SETTINGS_COLOR_OPTIONS, settingsColorTone } from '../../components/ui/ColorPicker.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import {
  DashedTile, DialogField, EmptyState, FIELD_INPUT, FormDialog,
  RowAction, SettingsAddBtn
} from './settingsBits.jsx';

// Agendamento — o que o consultor escolhe ao marcar uma visita ou aula
// experimental: modalidade, unidade e o pacote de aulas combinado com o aluno.

const TRIAL_WINDOW_DAYS = 90;

// Fatia de cada pacote nos agendamentos recentes. A janela é curta de propósito:
// mostra o que a equipe está combinando AGORA, não a média histórica.
function trialShares(leads, options) {
  const cutoff = Date.now() - TRIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const counts = new Map(options.map(n => [n, 0]));
  let total = 0;

  (leads || []).forEach(lead => {
    const qty = Number(lead?.trialClassesPlanned);
    if (!Number.isFinite(qty) || !counts.has(qty)) return;
    const date = getLeadAppointmentDate(lead);
    if (!(date instanceof Date) || isNaN(date.getTime()) || date.getTime() < cutoff) return;
    counts.set(qty, counts.get(qty) + 1);
    total += 1;
  });

  const max = Math.max(...counts.values(), 0);
  return options.map(n => ({
    value: n,
    count: counts.get(n) || 0,
    percent: total > 0 ? Math.round((counts.get(n) / total) * 100) : 0,
    bar: max > 0 ? Math.round((counts.get(n) / max) * 100) : 0,
    top: max > 0 && counts.get(n) === max
  }));
}

function TrialPackageCard({ pack, onRemove }) {
  return (
    <div className={cn(
      'relative p-[13px] pb-3 rounded-[13px] border transition',
      pack.top ? 'bg-brand-50 border-brand-600 dark:bg-brand-500/15' : 'bg-card border-border'
    )}>
      {pack.top && (
        <span className="absolute -top-2 left-[11px] h-[17px] px-[7px] grid place-items-center rounded-md bg-brand-600 text-white text-[9.5px] font-bold uppercase tracking-[0.05em]">
          Mais escolhida
        </span>
      )}
      <div className="flex items-baseline gap-1">
        <span className={cn(
          'font-display text-[24px] font-bold leading-none num',
          pack.top && 'text-brand-700 dark:text-brand-300'
        )}>
          {pack.value}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">{pack.value === 1 ? 'aula' : 'aulas'}</span>
      </div>
      <div className="mt-2.5 h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', pack.top ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20')} style={{ width: `${pack.bar}%` }} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 num">{pack.percent}% dos agend.</span>
        <button
          type="button"
          onClick={onRemove}
          title={`Remover o pacote de ${pack.value} ${pack.value === 1 ? 'aula' : 'aulas'}`}
          aria-label={`Remover o pacote de ${pack.value} ${pack.value === 1 ? 'aula' : 'aulas'}`}
          className="size-[22px] grid place-items-center rounded-md text-slate-400 transition hover:text-rose-600 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function SchedulingSection({ db, modalities, units, trialClassOptions, leads }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [modalityDialog, setModalityDialog] = useState(null); // null | {modality}
  const [modName, setModName] = useState('');
  const [modColor, setModColor] = useState('blue');

  const [unitDialog, setUnitDialog] = useState(null); // null | {unit}
  const [unitName, setUnitName] = useState('');
  const [unitAddr, setUnitAddr] = useState('');

  const [packOpen, setPackOpen] = useState(false);
  const [packInput, setPackInput] = useState('');

  const options = useMemo(() => normalizeTrialClassOptions(trialClassOptions || []), [trialClassOptions]);
  const packages = useMemo(() => trialShares(leads, options), [leads, options]);

  // Montada sob demanda (render não toca no SDK do Firestore).
  const configRef = () => doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID);

  // --- Modalidades ---------------------------------------------------------

  const openModality = (modality) => {
    setModName(modality?.name || '');
    setModColor(modality?.color || 'blue');
    setModalityDialog({ modality: modality || null });
  };

  const saveModality = async () => {
    const trimmed = modName.trim();
    if (!trimmed) { toast.warning('Informe o nome da modalidade.'); return; }
    const editingId = modalityDialog?.modality?.id || null;
    const dup = (modalities || []).some(m => m.id !== editingId && (m.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`A modalidade "${trimmed}" já existe.`); return; }

    setSaving(true);
    try {
      if (editingId) {
        const old = modalityDialog.modality;
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH, editingId),
          { name: trimmed, color: modColor, updatedAt: serverTimestamp() },
          { merge: true }
        );
        // A modalidade fica gravada por NOME no lead — renomear sem cascata
        // deixaria os agendamentos antigos apontando pra um nome que sumiu.
        if (old.name !== trimmed) {
          const affected = (leads || []).filter(l => l.appointmentModality === old.name);
          if (affected.length > 0) {
            await commitOpsInChunks(db, affected.map(l => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
              data: { appointmentModality: trimmed }
            })), 400);
          }
        }
        toast.success('Modalidade atualizada.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH), {
          name: trimmed, color: modColor, order: (modalities || []).length,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        toast.success('Modalidade criada.');
      }
      setModalityDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a modalidade.');
    } finally {
      setSaving(false);
    }
  };

  const deleteModality = async (m) => {
    const inUse = (leads || []).filter(l => l.appointmentModality === m.name).length;
    if (inUse > 0) {
      toast.warning(`A modalidade "${m.name}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluí-la.`);
      return;
    }
    if (!window.confirm(`Excluir a modalidade "${m.name}"?`)) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH, m.id));
    setModalityDialog(null);
    toast.success('Modalidade excluída.');
  };

  // --- Unidades ------------------------------------------------------------

  const openUnit = (unit) => {
    setUnitName(unit?.name || '');
    setUnitAddr(unit?.address || '');
    setUnitDialog({ unit: unit || null });
  };

  const saveUnit = async () => {
    const trimmed = unitName.trim();
    if (!trimmed) { toast.warning('Informe o nome da unidade.'); return; }
    const editingId = unitDialog?.unit?.id || null;
    const dup = (units || []).some(u => u.id !== editingId && (u.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`A unidade "${trimmed}" já existe.`); return; }

    setSaving(true);
    try {
      if (editingId) {
        const old = unitDialog.unit;
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', UNITS_PATH, editingId),
          { name: trimmed, address: unitAddr.trim(), updatedAt: serverTimestamp() },
          { merge: true }
        );
        if (old.name !== trimmed) {
          const affected = (leads || []).filter(l => l.appointmentUnit === old.name);
          if (affected.length > 0) {
            await commitOpsInChunks(db, affected.map(l => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
              data: { appointmentUnit: trimmed }
            })), 400);
          }
        }
        toast.success('Unidade atualizada.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', UNITS_PATH), {
          name: trimmed, address: unitAddr.trim(), order: (units || []).length,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        toast.success('Unidade criada.');
      }
      setUnitDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a unidade.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (u) => {
    const inUse = (leads || []).filter(l => l.appointmentUnit === u.name).length;
    if (inUse > 0) {
      toast.warning(`A unidade "${u.name}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluí-la.`);
      return;
    }
    if (!window.confirm(`Excluir a unidade "${u.name}"?`)) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', UNITS_PATH, u.id));
    setUnitDialog(null);
    toast.success('Unidade excluída.');
  };

  // --- Pacotes de aula experimental ---------------------------------------

  const persistOptions = async (next) => {
    setSaving(true);
    try {
      await setDoc(
        configRef(),
        { trialClassOptions: normalizeTrialClassOptions(next), updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar as opções de aulas.');
    }
    setSaving(false);
  };

  const addPackage = async () => {
    const n = Math.floor(Number(packInput));
    if (!Number.isFinite(n) || n < 1 || n > 99) { toast.warning('Informe um número entre 1 e 99.'); return; }
    if (options.includes(n)) { toast.warning(`O pacote de ${n} já existe.`); setPackInput(''); return; }
    await persistOptions([...options, n]);
    setPackInput('');
    setPackOpen(false);
  };

  const removePackage = async (n) => {
    if (options.length === 1) { toast.warning('Mantenha ao menos uma opção de quantidade.'); return; }
    await persistOptions(options.filter(x => x !== n));
  };

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Agendamento"
        hint="O que o consultor escolhe ao marcar uma visita ou aula experimental."
      />

      <div className="grid gap-3.5 lg:grid-cols-2 items-start">
        <SettingsPanel
          icon={<Dumbbell size={16} />}
          title="Modalidades"
          hint={`${(modalities || []).length} ${(modalities || []).length === 1 ? 'cadastrada' : 'cadastradas'}`}
          action={<SettingsAddBtn label="Nova modalidade" onClick={() => openModality(null)} />}
        >
          <div className="border-t border-border">
            {(modalities || []).length === 0 ? (
              <EmptyState>Nenhuma modalidade ainda — o consultor não consegue dizer o que foi agendado.</EmptyState>
            ) : (modalities || []).map((m, i) => {
              const inUse = (leads || []).filter(l => l.appointmentModality === m.name).length;
              const tone = settingsColorTone(m.color || 'blue');
              return (
                <div
                  key={m.id}
                  className={cn('flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50', i < modalities.length - 1 && 'border-b border-border')}
                >
                  <span className={cn('size-3 rounded-full shrink-0', tone.dot)} />
                  <span className="text-[13.5px] flex-1 truncate">{m.name}</span>
                  <span className="text-[11.5px] text-slate-400 dark:text-slate-500 num whitespace-nowrap">
                    {inUse} {inUse === 1 ? 'lead' : 'leads'}
                  </span>
                  <RowAction ghost size={28} icon={<Pencil size={13} />} title={`Editar ${m.name}`} onClick={() => openModality(m)} />
                </div>
              );
            })}
          </div>
        </SettingsPanel>

        <SettingsPanel
          icon={<Building2 size={16} />}
          title="Unidades"
          hint="Endereços usados nas visitas"
          action={<SettingsAddBtn label="Nova unidade" onClick={() => openUnit(null)} />}
        >
          <div className="border-t border-border">
            {(units || []).length === 0 ? (
              <EmptyState>Nenhuma unidade ainda — adicione o endereço onde as visitas acontecem.</EmptyState>
            ) : (units || []).map((u, i) => {
              const inUse = (leads || []).filter(l => l.appointmentUnit === u.name).length;
              return (
                <div
                  key={u.id}
                  className={cn('flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50', i < units.length - 1 && 'border-b border-border')}
                >
                  <span className="size-7 rounded-[9px] grid place-items-center shrink-0 bg-violet-500/[0.14] text-violet-700 dark:text-violet-300">
                    <MapPin size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] truncate">{u.name}</div>
                    {u.address && <div className="text-[11.5px] text-muted-foreground truncate">{u.address}</div>}
                  </div>
                  <span className="text-[11.5px] text-slate-400 dark:text-slate-500 num whitespace-nowrap">{inUse}</span>
                  <RowAction ghost size={28} icon={<Pencil size={13} />} title={`Editar ${u.name}`} onClick={() => openUnit(u)} />
                </div>
              );
            })}
          </div>
        </SettingsPanel>
      </div>

      <SettingsPanel
        icon={<BookOpen size={16} />}
        iconTone="brand"
        title="Aulas experimentais"
        hint={`Pacotes que o consultor pode combinar com o aluno. A barra mostra a fatia dos agendamentos dos últimos ${TRIAL_WINDOW_DAYS} dias.`}
      >
        <div className="grid gap-2.5 px-5 pb-5 sm:grid-cols-3 xl:grid-cols-6">
          {packages.map(p => (
            <TrialPackageCard key={p.value} pack={p} onRemove={() => removePackage(p.value)} />
          ))}
          <DashedTile
            icon={<Plus size={17} />}
            title="Novo pacote"
            onClick={() => setPackOpen(true)}
            className="justify-center"
          />
        </div>
      </SettingsPanel>

      <FormDialog
        open={Boolean(modalityDialog)}
        onOpenChange={(v) => !v && setModalityDialog(null)}
        title={modalityDialog?.modality ? `Editar ${modalityDialog.modality.name}` : 'Nova modalidade'}
        description="A modalidade aparece ao agendar uma aula experimental e classifica o professor."
        submitLabel={modalityDialog?.modality ? 'Salvar' : 'Criar modalidade'}
        submitting={saving}
        onSubmit={saveModality}
        footerLeft={modalityDialog?.modality && (
          <button
            type="button"
            onClick={() => deleteModality(modalityDialog.modality)}
            className="text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            Excluir modalidade
          </button>
        )}
      >
        <DialogField label="Nome">
          <input className={FIELD_INPUT} value={modName} onChange={e => setModName(e.target.value)} placeholder="Ex: Musculação" required />
        </DialogField>
        <DialogField label="Cor">
          <div className="flex flex-wrap items-center gap-1.5">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={modColor === c} onClick={() => setModColor(c)} />
            ))}
          </div>
        </DialogField>
      </FormDialog>

      <FormDialog
        open={Boolean(unitDialog)}
        onOpenChange={(v) => !v && setUnitDialog(null)}
        title={unitDialog?.unit ? `Editar ${unitDialog.unit.name}` : 'Nova unidade'}
        description="Unidades aparecem ao agendar uma visita."
        submitLabel={unitDialog?.unit ? 'Salvar' : 'Criar unidade'}
        submitting={saving}
        onSubmit={saveUnit}
        footerLeft={unitDialog?.unit && (
          <button
            type="button"
            onClick={() => deleteUnit(unitDialog.unit)}
            className="text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            Excluir unidade
          </button>
        )}
      >
        <DialogField label="Nome">
          <input className={FIELD_INPUT} value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="Ex: Moinhos" required />
        </DialogField>
        <DialogField label="Endereço (opcional)">
          <input className={FIELD_INPUT} value={unitAddr} onChange={e => setUnitAddr(e.target.value)} placeholder="Ex: R. Padre Chagas, 320" />
        </DialogField>
      </FormDialog>

      <FormDialog
        open={packOpen}
        onOpenChange={(v) => { setPackOpen(v); if (!v) setPackInput(''); }}
        title="Novo pacote de aulas"
        description="A quantidade que o consultor pode combinar com o aluno ao agendar."
        submitLabel="Adicionar pacote"
        submitting={saving}
        onSubmit={addPackage}
      >
        <DialogField label="Quantidade de aulas" hint="Entre 1 e 99.">
          <input
            className={cn(FIELD_INPUT, 'num')}
            type="number" min={1} max={99} autoFocus
            value={packInput}
            onChange={e => setPackInput(e.target.value)}
            placeholder="ex: 15"
          />
        </DialogField>
      </FormDialog>
    </div>
  );
}

export { SchedulingSection };
