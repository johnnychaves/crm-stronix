import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, GripVertical, Pencil, Plus, Trophy } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { appId, FUNNELS_PATH, LEADS_PATH, STATUSES_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks, isSystemStage, isSystemFunnel } from '../../lib/funnels.js';
import { pinEntryFirst } from '../../lib/referrals.js';
import { isRenewalFunnel } from '../../lib/renewalFunnel.js';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ColorDot, SETTINGS_COLOR_OPTIONS, settingsColorTone } from '../../components/ui/ColorPicker.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import {
  DialogField, EmptyState, FIELD_INPUT, FormDialog, RowAction, SettingsBtn
} from './settingsBits.jsx';

// Funis & etapas — master-detail: a lista de funis à esquerda, as etapas do
// funil selecionado à direita.
//
// Negociação, Venda e Perda são fases fixas do sistema: aparecem com o selo
// SISTEMA e não podem ser renomeadas, reordenadas nem excluídas. O funil de
// INDICAÇÕES é um funil de sistema inteiro: rename/excluir/tornar-padrão
// bloqueados e a etapa de entrada pinada no topo — só o meio é configurável.
// (isSystemStage foi promovida para lib/funnels.js quando esse funil nasceu.)

function FunnelsSection({ db, funnels, statuses, leads, focusId, onFocusHandled }) {
  const toast = useToast();
  const safeFunnels = useMemo(() => (Array.isArray(funnels) ? funnels : []), [funnels]);

  const [selectedId, setSelectedId] = useState(null);
  const [funnelDialog, setFunnelDialog] = useState(null); // null | {funnel}
  const [funnelName, setFunnelName] = useState('');
  const [stageDialog, setStageDialog] = useState(null); // null | {stage}
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('blue');
  const [saving, setSaving] = useState(false);

  // O funil padrão abre por default; um atalho da Visão geral pode pedir outro.
  const selected = safeFunnels.find(f => f.id === selectedId)
    || safeFunnels.find(f => f.isDefault)
    || safeFunnels[0]
    || null;

  useEffect(() => {
    if (!focusId) return;
    setSelectedId(focusId);
    onFocusHandled?.();
  }, [focusId, onFocusHandled]);

  const stagesOf = (funnelId) => (statuses || []).filter(s => s.funnelId === funnelId);
  const leadsOf = (funnelId) => (leads || []).filter(l => l.funnelId === funnelId).length;
  const selectedStages = selected ? stagesOf(selected.id) : [];

  // --- Funis ---------------------------------------------------------------

  const openFunnel = (funnel) => {
    setFunnelName(funnel?.name || '');
    setFunnelDialog({ funnel: funnel || null });
  };

  const saveFunnel = async () => {
    const trimmed = funnelName.trim();
    if (!trimmed) { toast.warning('Informe o nome do funil.'); return; }
    setSaving(true);
    try {
      if (funnelDialog?.funnel) {
        if (isSystemFunnel(funnelDialog.funnel)) {
          toast.warning(`O funil "${funnelDialog.funnel.name}" é do sistema e não pode ser renomeado.`);
          setFunnelDialog(null);
          return;
        }
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, funnelDialog.funnel.id),
          { name: trimmed, updatedAt: serverTimestamp() },
          { merge: true }
        );
        toast.success('Funil renomeado.');
      } else {
        // Funil novo nunca nasce como padrão — só o botão dedicado define isso.
        const funnelRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH), {
          name: trimmed, order: safeFunnels.length, isDefault: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        // Junto com Venda/Perda (colunas terminais fixas), Negociação é uma das
        // três fases de sistema — todo funil já nasce com ela.
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), {
          name: 'Negociação', color: 'violet', order: 0, funnelId: funnelRef.id, isSystem: true
        });
        setSelectedId(funnelRef.id);
        toast.success('Funil criado com a etapa Negociação.');
      }
      setFunnelDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o funil.');
    } finally {
      setSaving(false);
    }
  };

  const setDefaultFunnel = async (f) => {
    if (f.isDefault) return;
    // O fallback legado de isItemInFunnel joga leads sem funnelId no funil
    // default — o funil de Indicações nunca pode assumir esse papel.
    if (isSystemFunnel(f)) {
      toast.warning(`O funil "${f.name}" é do sistema e não pode ser o padrão.`);
      return;
    }
    const batch = writeBatch(db);
    safeFunnels.forEach(item => {
      if (item.isDefault) batch.update(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, item.id), { isDefault: false });
    });
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id), { isDefault: true });
    await batch.commit();
    setFunnelDialog(null);
    toast.success(`"${f.name}" agora é o funil padrão.`);
  };

  const deleteFunnel = async (f) => {
    if (isSystemFunnel(f)) { toast.warning('Este funil é do sistema e não pode ser excluído.'); return; }
    if (f.isDefault) { toast.warning('Não é possível excluir o funil padrão. Marque outro como padrão antes.'); return; }
    const inFunnel = leadsOf(f.id);
    if (inFunnel > 0) {
      toast.warning(`O funil "${f.name}" tem ${inFunnel} ${inFunnel === 1 ? 'lead' : 'leads'}. Mova-os para outro funil antes de excluir.`);
      return;
    }
    const stages = stagesOf(f.id);
    if (stages.length > 0) {
      if (!window.confirm(`Este funil tem ${stages.length} etapa(s) configurada(s). Excluir o funil também excluirá essas etapas. Confirma?`)) return;
      const batch = writeBatch(db);
      stages.forEach(s => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id)));
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id));
      await batch.commit();
    } else {
      if (!window.confirm(`Excluir o funil "${f.name}"?`)) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id));
    }
    if (selectedId === f.id) setSelectedId(null);
    setFunnelDialog(null);
    toast.success('Funil excluído.');
  };

  const reorderFunnels = async (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx || Number.isNaN(dragIdx)) return;
    const arr = [...safeFunnels];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, item);
    await Promise.all(arr.map((f, i) =>
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id), { order: i }, { merge: true })
    ));
  };

  // --- Etapas --------------------------------------------------------------

  const openStage = (stage) => {
    setStageName(stage?.name || '');
    setStageColor(stage?.color || 'blue');
    setStageDialog({ stage: stage || null });
  };

  const saveStage = async () => {
    if (!selected) return;
    const trimmed = stageName.trim();
    if (!trimmed) { toast.warning('Informe o nome da etapa.'); return; }
    const editing = stageDialog?.stage || null;

    setSaving(true);
    try {
      if (editing) {
        if (isSystemStage(editing)) {
          toast.warning(`A etapa "${editing.name}" é uma fase fixa do sistema e não pode ser renomeada.`);
          setStageDialog(null);
          return;
        }
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, editing.id),
          { name: trimmed, color: stageColor },
          { merge: true }
        );
        // O status do lead guarda o NOME da etapa — a renomeação só vale para
        // os leads deste funil (outro funil pode ter etapa homônima).
        if (editing.name !== trimmed) {
          const affected = (leads || []).filter(l => l.funnelId === selected.id && l.status === editing.name);
          if (affected.length > 0) {
            await commitOpsInChunks(db, affected.map(l => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
              data: { status: trimmed }
            })), 400);
          }
        }
        toast.success('Etapa atualizada.');
      } else {
        if (trimmed.toLowerCase() === 'negociação' && selectedStages.some(s => (s.name || '').trim().toLowerCase() === 'negociação')) {
          toast.warning('A etapa "Negociação" já existe neste funil (etapa fixa do sistema).');
          return;
        }
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), {
          name: trimmed, color: stageColor, order: selectedStages.length, funnelId: selected.id
        });
        toast.success('Etapa criada.');
      }
      setStageDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a etapa.');
    } finally {
      setSaving(false);
    }
  };

  const deleteStage = async (s) => {
    if (isSystemStage(s)) { toast.warning(`A etapa "${s.name}" é uma fase fixa do sistema e não pode ser excluída.`); return; }
    const inStage = (leads || []).filter(l => l.funnelId === selected?.id && l.status === s.name).length;
    if (inStage > 0) {
      toast.warning(`A etapa "${s.name}" tem ${inStage} ${inStage === 1 ? 'lead' : 'leads'}. Transfira-os para outra etapa antes de excluir.`);
      return;
    }
    if (!window.confirm(`Excluir a etapa "${s.name}"?`)) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id));
    setStageDialog(null);
    toast.success('Etapa excluída.');
  };

  const reorderStages = async (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx || Number.isNaN(dragIdx)) return;
    const arr = [...selectedStages];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, item);
    // Etapa de entrada (funil de Indicações) fica pinada na posição 0: soltar
    // outra etapa "acima" dela reordena só o meio. Sem isso, o drop no topo
    // empurrava a etapa de sistema para order 1 mesmo com o drag dela travado.
    const pinned = pinEntryFirst(arr);
    await Promise.all(pinned.map((s, i) =>
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id), { order: i }, { merge: true })
    ));
  };

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Funis & etapas"
        hint="Funis paralelos e as colunas que cada um mostra no Pipeline."
      >
        <SettingsBtn kind="primary" size={38} icon={<Plus size={14} />} onClick={() => openFunnel(null)}>
          Novo funil
        </SettingsBtn>
      </SettingsSectionHeader>

      <div className="grid gap-3.5 items-start lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-2">
          {safeFunnels.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">
              Nenhum funil ainda. Crie o primeiro — o Kanban precisa de um.
            </div>
          )}
          {safeFunnels.map((f, i) => {
            const stages = stagesOf(f.id);
            const active = selected?.id === f.id;
            return (
              <div
                key={f.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('idx', String(i))}
                onDragOver={e => e.preventDefault()}
                onDrop={e => reorderFunnels(Number(e.dataTransfer.getData('idx')), i)}
                onClick={() => setSelectedId(f.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(f.id); } }}
                className={cn(
                  'group px-4 py-3.5 rounded-[14px] border bg-card cursor-pointer transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? 'border-brand-600 shadow-[0_0_0_3px_rgba(43,89,255,.12)]'
                    : 'border-border hover:border-brand-600'
                )}
              >
                <div className="flex items-center gap-2">
                  <GripVertical size={13} className="text-slate-400 dark:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                  <span className="text-[14px] font-semibold truncate flex-1">{f.name}</span>
                  {f.isDefault && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                      Padrão
                    </span>
                  )}
                  {isSystemFunnel(f) && (
                    <span
                      title={isRenewalFunnel(f)
                        ? 'Funil do sistema — as colunas são os marcos de renovação, configurados em Metas & ritmo'
                        : 'Funil do sistema — só as etapas do meio são configuráveis'}
                      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0"
                    >
                      Sistema
                    </span>
                  )}
                  {stages.length < 2 && (
                    <span
                      title="Funil com menos de duas etapas — o Kanban vira uma coluna só"
                      className="size-[7px] rounded-full bg-amber-500 shrink-0"
                    />
                  )}
                  <span className="shrink-0 flex items-center">
                    <RowAction
                      ghost size={24}
                      icon={<Pencil size={12} />}
                      title={`Editar ${f.name}`}
                      onClick={(e) => { e.stopPropagation(); openFunnel(f); }}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    />
                    {!active && <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />}
                  </span>
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-1 ml-[21px] num">
                  {stages.length} {stages.length === 1 ? 'etapa' : 'etapas'} · {leadsOf(f.id)} leads
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <SettingsPanel
            title={<>Etapas de <b>{selected.name}</b></>}
            hint={isRenewalFunnel(selected)
              ? 'As colunas deste funil são os marcos de renovação, configurados em Metas & ritmo. Elas mudam sozinhas quando você muda os marcos.'
              : isSystemFunnel(selected)
                ? 'A etapa de entrada deste funil e as fases Negociação, Venda e Perda são do sistema. Configure as etapas do meio.'
                : 'Arraste para reordenar. Negociação, Venda e Perda são etapas do sistema.'}
            // Funil de Renovações não tem etapa no banco: criar uma aqui geraria
            // uma coluna que o board nunca renderiza.
            action={isRenewalFunnel(selected) ? null : (
              <SettingsBtn size={34} icon={<Plus size={13} />} onClick={() => openStage(null)}>Nova etapa</SettingsBtn>
            )}
          >
            <div className="border-t border-border">
              {selectedStages.length === 0 ? (
                <EmptyState>
                  {isRenewalFunnel(selected)
                    ? 'Este funil não tem etapas para configurar: as colunas do board são os marcos de renovação.'
                    : 'Nenhuma etapa neste funil ainda — crie a primeira.'}
                </EmptyState>
              ) : selectedStages.map((s, i) => {
                const system = isSystemStage(s);
                const tone = settingsColorTone(s.color || 'blue');
                const count = (leads || []).filter(l => l.funnelId === selected.id && l.status === s.name).length;
                return (
                  <div
                    key={s.id}
                    draggable={!system}
                    onDragStart={e => { if (!system) e.dataTransfer.setData('idx', String(i)); }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => reorderStages(Number(e.dataTransfer.getData('idx')), i)}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3.5 transition hover:bg-muted/50',
                      i < selectedStages.length - 1 && 'border-b border-border'
                    )}
                  >
                    <GripVertical
                      size={14}
                      className={cn('shrink-0', system ? 'text-slate-200 dark:text-white/10' : 'text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing')}
                    />
                    <span className="num text-[11px] font-bold text-slate-400 dark:text-slate-500 w-5 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={cn('size-3 rounded-full shrink-0', tone.dot)} />
                    <span className="text-[13.5px] flex-1 truncate">{s.name}</span>
                    {system && (
                      <span
                        title="Fase fixa do sistema — não pode ser editada ou excluída"
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0"
                      >
                        Sistema
                      </span>
                    )}
                    <span className="num text-[11.5px] text-slate-400 dark:text-slate-500 w-16 text-right shrink-0">
                      {count} {count === 1 ? 'lead' : 'leads'}
                    </span>
                    {!system
                      ? <RowAction ghost size={28} icon={<Pencil size={13} />} title={`Editar ${s.name}`} onClick={() => openStage(s)} />
                      : <span className="w-7 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </SettingsPanel>
        )}
      </div>

      <FormDialog
        open={Boolean(funnelDialog)}
        onOpenChange={(v) => !v && setFunnelDialog(null)}
        title={funnelDialog?.funnel ? `Editar ${funnelDialog.funnel.name}` : 'Novo funil'}
        description={funnelDialog?.funnel
          ? (isSystemFunnel(funnelDialog.funnel)
            ? 'Funil do sistema para indicações — o nome é fixo; você configura as etapas do meio na lista ao lado.'
            : 'Renomear o funil não muda as etapas nem os leads dentro dele.')
          : 'O funil nasce com a etapa Negociação — as demais você desenha depois.'}
        submitLabel={funnelDialog?.funnel ? 'Salvar' : 'Criar funil'}
        submitting={saving}
        onSubmit={saveFunnel}
        footerLeft={funnelDialog?.funnel && !isSystemFunnel(funnelDialog.funnel) && (
          <div className="flex items-center gap-3">
            {!funnelDialog.funnel.isDefault && (
              <button
                type="button"
                onClick={() => setDefaultFunnel(funnelDialog.funnel)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300"
              >
                <Trophy size={13} /> Tornar padrão
              </button>
            )}
            <button
              type="button"
              onClick={() => deleteFunnel(funnelDialog.funnel)}
              className="text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
            >
              Excluir funil
            </button>
          </div>
        )}
      >
        <DialogField label="Nome do funil">
          <input
            className={FIELD_INPUT}
            value={funnelName}
            onChange={e => setFunnelName(e.target.value)}
            placeholder="Ex: Corporativo"
            disabled={Boolean(funnelDialog?.funnel && isSystemFunnel(funnelDialog.funnel))}
            autoFocus
            required
          />
        </DialogField>
      </FormDialog>

      <FormDialog
        open={Boolean(stageDialog)}
        onOpenChange={(v) => !v && setStageDialog(null)}
        title={stageDialog?.stage ? `Editar ${stageDialog.stage.name}` : 'Nova etapa'}
        description={`Etapa do funil ${selected?.name || ''} — vira uma coluna no Kanban.`}
        submitLabel={stageDialog?.stage ? 'Salvar' : 'Criar etapa'}
        submitting={saving}
        onSubmit={saveStage}
        footerLeft={stageDialog?.stage && !isSystemStage(stageDialog.stage) && (
          <button
            type="button"
            onClick={() => deleteStage(stageDialog.stage)}
            className="text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            Excluir etapa
          </button>
        )}
      >
        <DialogField label="Nome da etapa">
          <input className={FIELD_INPUT} value={stageName} onChange={e => setStageName(e.target.value)} placeholder="Ex: Contato feito" autoFocus required />
        </DialogField>
        <DialogField label="Cor">
          <div className="flex flex-wrap items-center gap-1.5">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={stageColor === c} onClick={() => setStageColor(c)} />
            ))}
          </div>
        </DialogField>
      </FormDialog>
    </div>
  );
}

export { FunnelsSection };
