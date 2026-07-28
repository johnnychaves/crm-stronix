import { useEffect, useMemo, useState } from 'react';
import { Check, DollarSign, Filter, HeartPulse, Pencil, Plus, Tag, ThumbsDown, Trash2, X } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  appId, DORES_PATH, LEADS_PATH, LOSS_REASONS_PATH, PLANS_PATH, SOURCES_PATH, TAGS_PATH
} from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { fmtBRL, parseValorBRL, valorToInput } from '../../lib/format.js';
import { planModalityIds, planModalityNames } from '../../lib/planos.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ColorDot, SETTINGS_COLOR_OPTIONS, settingsColorTone } from '../../components/ui/ColorPicker.jsx';
import { SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import {
  DialogField, EmptyState, FIELD_INPUT, FormDialog, PanelNote, RowAction, SettingsBtn, TableHeadRow
} from './settingsBits.jsx';

// Catálogos — as cinco listas que alimentam os campos do lead, numa tela só.
// Mesma casca, mesma mecânica: o que muda entre elas é a coluna 2, a nota de
// rodapé e o campo do lead que a renomeação precisa alcançar.
//
// Exceção deliberada: Planos edita em diálogo, não na linha. Um plano carrega
// valor, duração, modalidades e o estado ativo/inativo — quatro campos que não
// cabem numa linha de duas colunas sem perder informação.

const CATALOG_GRID = '1.4fr 1fr 90px 84px';

const colorFor = (item, fallbackSeed) => {
  if (item?.color) return item.color;
  // Catálogos sem cor no modelo ganham uma cor estável derivada do nome: o
  // ponto colorido do mockup sem inventar um campo que ninguém edita.
  const seed = String(fallbackSeed || '');
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SETTINGS_COLOR_OPTIONS[h % SETTINGS_COLOR_OPTIONS.length];
};

const CATALOGS = {
  tags: {
    label: 'Etiquetas', singular: 'etiqueta', gender: 'f',
    icon: Tag, path: TAGS_PATH, colorful: true,
    title: 'Etiquetas', description: 'Marcadores rápidos para segmentar e filtrar leads no Pipeline.',
    col2Label: 'Usada para', col2Field: 'description', col2Placeholder: 'Ex: Quem quer contrato longo',
    note: 'Renomear uma etiqueta atualiza todos os leads que a carregam. Excluir só é possível se nenhum lead a usar.',
    countOf: (item, leads) => (leads || []).filter(l => Array.isArray(l.tags) && l.tags.includes(item.name)).length,
    cascade: (leads, oldName, newName) => (leads || [])
      .filter(l => (l.tags || []).includes(oldName))
      .map(l => ({ id: l.id, data: { tags: (l.tags || []).map(t => (t === oldName ? newName : t)) } }))
  },
  sources: {
    label: 'Origens', singular: 'origem', gender: 'f',
    icon: Filter, path: SOURCES_PATH,
    title: 'Origens', description: 'De onde os leads chegam — a base do relatório de canais.',
    col2Label: 'Canal', col2Field: 'channel', col2Placeholder: 'Ex: Orgânico, Pago, Offline',
    note: 'Toda origem em uso continua contando no Gerencial mesmo depois de renomeada.',
    countOf: (item, leads) => (leads || []).filter(l => l.source === item.name).length,
    cascade: (leads, oldName, newName) => (leads || [])
      .filter(l => l.source === oldName)
      .map(l => ({ id: l.id, data: { source: newName } }))
  },
  plans: {
    label: 'Planos', singular: 'plano', gender: 'm',
    icon: DollarSign, path: PLANS_PATH, dialogOnly: true,
    title: 'Planos', description: 'Catálogo de planos e serviços oferecidos na matrícula.',
    col2Label: 'Valor · modalidade',
    note: 'O plano fica gravado no cliente. Alterar o valor aqui não muda contratos já fechados.',
    countOf: (item, leads) => (leads || []).filter(l => l.currentPlanName === item.name).length,
    cascade: (leads, oldName, newName) => (leads || [])
      .filter(l => l.currentPlanName === oldName)
      .map(l => ({ id: l.id, data: { currentPlanName: newName } }))
  },
  loss: {
    label: 'Motivos de perda', singular: 'motivo', gender: 'm',
    icon: ThumbsDown, path: LOSS_REASONS_PATH,
    title: 'Motivos de perda', description: 'Justificativas padronizadas para a análise de perdas.',
    col2Label: 'Observação', col2Field: 'note', col2Placeholder: 'Ex: Achou caro / sem orçamento',
    note: 'Sem motivos cadastrados, os descartes ficam sem justificativa e o relatório de perdas fica cego.',
    countOf: (item, leads) => (leads || []).filter(l => l.lossReason === item.name).length,
    cascade: (leads, oldName, newName) => (leads || [])
      .filter(l => l.lossReason === oldName)
      .map(l => ({ id: l.id, data: { lossReason: newName } }))
  },
  dores: {
    label: 'Dores', singular: 'dor', gender: 'f',
    icon: HeartPulse, path: DORES_PATH,
    title: 'Dores', description: 'O que o lead quer resolver — escolhida na ficha e usada como argumento.',
    col2Label: 'O que o lead procura', col2Field: 'description', col2Placeholder: 'Ex: Perda de peso e medidas',
    note: 'Escolhida na ficha do lead. Boas dores rendem melhores argumentos na negociação.',
    countOf: (item, leads) => (leads || []).filter(l => l.dor === item.name).length,
    cascade: (leads, oldName, newName) => (leads || [])
      .filter(l => l.dor === oldName)
      .map(l => ({ id: l.id, data: { dor: newName } }))
  }
};

const CATALOG_KEYS = ['tags', 'sources', 'plans', 'loss', 'dores'];

const newLabel = (cfg) => `${cfg.gender === 'f' ? 'Nova' : 'Novo'} ${cfg.singular}`;

function CatalogsSection({ db, tags, sources, planos, lossReasons, dores, modalities, leads, focusId, onFocusHandled }) {
  const toast = useToast();
  const { contratos } = useGeneralConfig();

  const [active, setActive] = useState('tags');
  const [draft, setDraft] = useState(null); // null | {id|null, name, col2, color}
  const [saving, setSaving] = useState(false);

  const [planDialog, setPlanDialog] = useState(null); // null | {plan}
  const [planForm, setPlanForm] = useState({ name: '', value: '', durationMonths: '1', modIds: [] });

  const items = { tags, sources, plans: planos, loss: lossReasons, dores };
  const cfg = CATALOGS[active];
  const rows = items[active] || [];

  // Atalho da Visão geral pode pedir uma aba específica.
  useEffect(() => {
    if (!focusId) return;
    if (CATALOG_KEYS.includes(focusId)) setActive(focusId);
    onFocusHandled?.();
  }, [focusId, onFocusHandled]);

  // Trocar de catálogo descarta a linha de criação em andamento.
  const selectCatalog = (key) => { setActive(key); setDraft(null); };

  // Montada sob demanda (render não toca no SDK do Firestore).
  const colRef = () => collection(db, 'artifacts', appId, 'public', 'data', cfg.path);

  const startCreate = () => setDraft({ id: null, name: '', col2: '', color: 'blue' });
  const startEdit = (item) => setDraft({
    id: item.id,
    name: item.name || '',
    col2: cfg.col2Field ? (item[cfg.col2Field] || '') : '',
    color: item.color || 'blue'
  });

  const saveDraft = async () => {
    const trimmed = (draft?.name || '').trim();
    if (!trimmed) { toast.warning(`Informe o nome ${cfg.gender === 'f' ? 'da' : 'do'} ${cfg.singular}.`); return; }
    const dup = rows.find(r => r.id !== draft.id && (r.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`"${dup.name}" já existe neste catálogo.`); return; }

    setSaving(true);
    try {
      const payload = { name: trimmed, updatedAt: serverTimestamp() };
      if (cfg.col2Field) payload[cfg.col2Field] = draft.col2.trim();
      if (cfg.colorful) payload.color = draft.color;

      if (draft.id) {
        const old = rows.find(r => r.id === draft.id);
        await setDoc(doc(colRef(), draft.id), payload, { merge: true });
        // O lead guarda o NOME, não o id — renomear sem cascata deixaria a base
        // apontando para um valor que não existe mais no catálogo.
        if (old && old.name !== trimmed) {
          const ops = cfg.cascade(leads, old.name, trimmed);
          if (ops.length > 0) {
            await commitOpsInChunks(db, ops.map(o => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, o.id),
              data: o.data
            })), 400);
          }
        }
        toast.success('Item atualizado.');
      } else {
        await addDoc(colRef(), { ...payload, createdAt: serverTimestamp() });
        toast.success('Item criado.');
      }
      setDraft(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o item.');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item) => {
    const inUse = cfg.countOf(item, leads);
    if (inUse > 0) {
      toast.warning(`"${item.name}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluir.`);
      return;
    }
    // Contratos no histórico referenciam o plano por planId — excluir deixaria
    // a referência órfã. Desativar preserva o vínculo.
    if (active === 'plans') {
      const inHistory = (contratos || []).filter(c => c.planId === item.id).length;
      if (inHistory > 0) {
        toast.warning(`O plano "${item.name}" tem ${inHistory} contrato(s) no histórico. Desative-o em vez de excluir.`);
        return;
      }
    }
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    await deleteDoc(doc(colRef(), item.id));
    if (draft?.id === item.id) setDraft(null);
    toast.success('Item excluído.');
  };

  // --- Planos (diálogo próprio) -------------------------------------------

  const openPlan = (plan) => {
    setPlanForm({
      name: plan?.name || '',
      value: plan ? valorToInput(plan.value) : '',
      durationMonths: String(plan?.durationMonths ?? '1'),
      modIds: plan ? planModalityIds(plan) : []
    });
    setPlanDialog({ plan: plan || null });
  };

  const savePlan = async () => {
    const trimmed = planForm.name.trim();
    if (!trimmed) { toast.warning('Informe o nome do plano.'); return; }
    // Aceita vírgula/ponto decimal e centavos; barra valor inválido em vez de
    // gravar R$ 0 em silêncio.
    const parsed = parseValorBRL(planForm.value);
    if (parsed == null || parsed < 0) { toast.warning('Informe um valor válido para o plano.'); return; }
    const editingId = planDialog?.plan?.id || null;
    const dup = (planos || []).find(p => p.id !== editingId && (p.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`Já existe um plano chamado "${dup.name}".`); return; }

    const payload = {
      name: trimmed,
      value: parsed,
      durationMonths: Math.max(1, Number(planForm.durationMonths) || 1),
      modalityIds: planForm.modIds,
      updatedAt: serverTimestamp()
    };

    setSaving(true);
    try {
      if (editingId) {
        const old = planDialog.plan;
        await setDoc(doc(colRef(), editingId), payload, { merge: true });
        if (old.name !== trimmed) {
          const ops = CATALOGS.plans.cascade(leads, old.name, trimmed);
          if (ops.length > 0) {
            await commitOpsInChunks(db, ops.map(o => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, o.id),
              data: o.data
            })), 400);
          }
        }
        toast.success('Plano atualizado.');
      } else {
        const order = (planos || []).reduce((mx, p) => Math.max(mx, p.order || 0), 0) + 1;
        await addDoc(colRef(), { ...payload, active: true, order, createdAt: serverTimestamp() });
        toast.success('Plano criado.');
      }
      setPlanDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o plano.');
    } finally {
      setSaving(false);
    }
  };

  const togglePlanActive = async (p) => {
    await setDoc(doc(colRef(), p.id), { active: p.active === false, updatedAt: serverTimestamp() }, { merge: true });
    setPlanDialog(null);
    toast.success(p.active === false ? 'Plano reativado.' : 'Plano desativado — some do seletor de matrícula, mas segue no histórico.');
  };

  const togglePlanMod = (id) => setPlanForm(f => ({
    ...f,
    modIds: f.modIds.includes(id) ? f.modIds.filter(x => x !== id) : [...f.modIds, id]
  }));

  const columns = useMemo(() => ([
    { key: 'name', label: 'Nome' },
    { key: 'col2', label: cfg.col2Label },
    { key: 'usage', label: 'Em uso', align: 'right' },
    { key: 'actions', label: '' }
  ]), [cfg.col2Label]);

  const Icon = cfg.icon;
  const onCreate = cfg.dialogOnly ? () => openPlan(null) : startCreate;

  const col2Of = (item) => {
    if (active !== 'plans') return item[cfg.col2Field] || '';
    const mods = planModalityNames(item, modalities);
    return `${fmtBRL(item.value)}${mods.length ? ` · ${mods.join(' · ')}` : ''}`;
  };

  const draftRow = (
    <div className="grid gap-3 items-center px-5 py-3 border-b border-border bg-brand-50/70 dark:bg-brand-500/10" style={{ gridTemplateColumns: CATALOG_GRID }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="size-3 rounded-full bg-brand-600 shrink-0" />
        <input
          autoFocus
          value={draft?.name || ''}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Escape') setDraft(null); if (e.key === 'Enter') saveDraft(); }}
          placeholder={`Nome ${cfg.gender === 'f' ? 'da' : 'do'} ${cfg.singular}`}
          className="w-full h-9 px-2.5 rounded-lg bg-card border border-brand-600 text-[13px] outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
      <input
        value={draft?.col2 || ''}
        onChange={e => setDraft({ ...draft, col2: e.target.value })}
        onKeyDown={e => { if (e.key === 'Escape') setDraft(null); if (e.key === 'Enter') saveDraft(); }}
        placeholder={cfg.col2Placeholder}
        className="w-full h-9 px-2.5 rounded-lg bg-card border border-border text-[13px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
      />
      {cfg.colorful ? (
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {SETTINGS_COLOR_OPTIONS.slice(0, 5).map(c => (
            <ColorDot key={c} color={c} size={16} active={draft?.color === c} onClick={() => setDraft({ ...draft, color: c })} />
          ))}
        </div>
      ) : <span />}
      <div className="flex items-center justify-end gap-1.5">
        <RowAction kind="neutral" icon={<X size={13} />} title="Cancelar" onClick={() => setDraft(null)} />
        <RowAction icon={<Check size={13} />} title="Salvar" onClick={saveDraft} disabled={saving} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Catálogos"
        hint="As cinco listas que alimentam os campos do lead. Mesma tela, mesma mecânica — clique numa linha para editar."
      />

      <div className="inline-flex w-fit p-1 gap-[3px] rounded-xl bg-muted" role="tablist">
        {CATALOG_KEYS.map(key => {
          const on = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => selectCatalog(key)}
              className={cn(
                'h-9 px-3.5 rounded-[9px] text-[12.5px] font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                on ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {CATALOGS[key].label}
              <span className="num ml-1.5 opacity-65">{(items[key] || []).length}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <header className="px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="size-[34px] rounded-[10px] grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14.5px] font-semibold leading-tight">{cfg.title}</h3>
              <p className="text-[12px] text-muted-foreground leading-snug mt-1">{cfg.description}</p>
            </div>
          </div>
          <SettingsBtn kind="primary" size={36} icon={<Plus size={13} />} onClick={onCreate}>
            {newLabel(cfg)}
          </SettingsBtn>
        </header>

        <TableHeadRow columns={columns} template={CATALOG_GRID} />

        {draft && !draft.id && draftRow}

        {rows.length === 0 && !draft ? (
          <EmptyState>
            {cfg.label} ainda sem nenhum item — crie o primeiro em “{newLabel(cfg)}”.
          </EmptyState>
        ) : rows.map((item, i) => {
          if (draft?.id === item.id) return <div key={item.id}>{draftRow}</div>;

          const tone = settingsColorTone(colorFor(item, item.name));
          const inUse = cfg.countOf(item, leads);
          const inactive = active === 'plans' && item.active === false;

          return (
            <div
              key={item.id}
              className={cn(
                'grid gap-3 items-center px-5 py-3.5 transition hover:bg-muted/50',
                i < rows.length - 1 && 'border-b border-border',
                inactive && 'opacity-60'
              )}
              style={{ gridTemplateColumns: CATALOG_GRID }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn('size-3 rounded-full shrink-0', tone.dot)} />
                <span className="text-[13.5px] truncate">{item.name}</span>
                {inactive && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    Inativo
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-muted-foreground truncate">{col2Of(item)}</div>
              <div className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200 num text-right">{inUse}</div>
              <div className="flex items-center justify-end gap-1.5">
                <RowAction
                  icon={<Pencil size={13} />}
                  title={`Editar ${item.name}`}
                  onClick={() => (cfg.dialogOnly ? openPlan(item) : startEdit(item))}
                />
                <RowAction kind="danger" icon={<Trash2 size={13} />} title={`Excluir ${item.name}`} onClick={() => removeItem(item)} />
              </div>
            </div>
          );
        })}

        <PanelNote>{cfg.note}</PanelNote>
      </section>

      <FormDialog
        open={Boolean(planDialog)}
        onOpenChange={(v) => !v && setPlanDialog(null)}
        title={planDialog?.plan ? `Editar ${planDialog.plan.name}` : 'Novo plano'}
        description="O plano fica gravado no contrato do cliente. Alterar o valor aqui não muda contratos já fechados."
        submitLabel={planDialog?.plan ? 'Salvar' : 'Criar plano'}
        submitting={saving}
        onSubmit={savePlan}
        footerLeft={planDialog?.plan && (
          <button
            type="button"
            onClick={() => togglePlanActive(planDialog.plan)}
            className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300"
          >
            {planDialog.plan.active === false ? 'Reativar plano' : 'Desativar plano'}
          </button>
        )}
      >
        <DialogField label="Nome do plano">
          <input className={FIELD_INPUT} value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Ex: Mensal Musculação" autoFocus required />
        </DialogField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Valor (R$)">
            <input className={cn(FIELD_INPUT, 'num')} type="text" inputMode="decimal" value={planForm.value} onChange={e => setPlanForm({ ...planForm, value: e.target.value })} placeholder="197,90" required />
          </DialogField>
          <DialogField label="Duração (meses)">
            <input className={cn(FIELD_INPUT, 'num')} type="number" min="1" step="1" value={planForm.durationMonths} onChange={e => setPlanForm({ ...planForm, durationMonths: e.target.value })} required />
          </DialogField>
        </div>
        <DialogField label="Modalidades (opcional)">
          {(modalities || []).length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhuma modalidade cadastrada — adicione em Agendamento.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(modalities || []).map(m => {
                const on = planForm.modIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePlanMod(m.id)}
                    aria-pressed={on}
                    className={cn(
                      'px-3 h-9 rounded-[10px] text-[12.5px] font-semibold transition border',
                      on ? 'bg-brand-600 text-white border-brand-600' : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    )}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </DialogField>
      </FormDialog>
    </div>
  );
}

export { CatalogsSection };
