// Tipos de freepass (spec docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md).
// Grava a lista inteira em stronix_config/general.freepassTypes, que só o
// gestor grava (regra de stronix_config). A conferência e a troca do padrão
// moram em src/lib/visitante.js.
import { useState } from 'react';
import { Pencil, Ticket } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appId, CONFIG_PATH, CONFIG_GENERAL_ID } from '../../lib/firebase.js';
import { freepassQuantityText, freepassTypeProblem, saveFreepassType, FREEPASS_KINDS } from '../../lib/visitante.js';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsPanel } from '../../components/ui/SettingsCard.jsx';
import { DialogField, EmptyState, FIELD_INPUT, FormDialog, RowAction, SettingsAddBtn } from './settingsBits.jsx';

const EMPTY = { id: '', name: '', modalidadeId: '', kind: FREEPASS_KINDS.DIAS, quantity: '', padrao: false, ativo: true };
const newId = () => `fp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function FreepassTypesPanel({ db, modalities, freepassTypes }) {
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const types = freepassTypes || [];
  const modName = (id) => (modalities || []).find(m => m.id === id)?.name || 'Modalidade excluída';

  const open = (t) => { setProblem(null); setDraft(t ? { ...t } : { ...EMPTY, id: newId() }); };
  const set = (k, v) => { setProblem(null); setDraft(d => ({ ...d, [k]: v })); };

  const save = async () => {
    const p = freepassTypeProblem(draft, types);
    if (p) { setProblem(p); return; }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { freepassTypes: saveFreepassType(types, draft), updatedAt: serverTimestamp() },
        { merge: true }
      );
      setDraft(null);
      toast.success('Freepass salvo.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o freepass.');
    }
    setSaving(false);
  };

  const isNew = draft && !types.some(t => t.id === draft.id);
  return (
    <>
      <SettingsPanel
        icon={<Ticket size={16} />}
        title="Tipos de freepass"
        hint="O que o consultor lança quando a pessoa aceita experimentar a academia."
        action={<SettingsAddBtn label="Novo freepass" onClick={() => open(null)} />}
      >
        <div className="border-t border-border">
          {types.length === 0 ? (
            <EmptyState>Nenhum freepass ainda. Sem ele, o consultor não consegue lançar o freepass na ficha.</EmptyState>
          ) : types.map((t, i) => (
            <div key={t.id} className={cn('flex items-center gap-3 px-5 py-3', i < types.length - 1 && 'border-b border-border', !t.ativo && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] truncate">{t.name}</div>
                <div className="text-[11.5px] text-muted-foreground">{modName(t.modalidadeId)} · {freepassQuantityText(t)}</div>
              </div>
              {t.padrao && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11.5px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">Padrão</span>}
              {!t.ativo && <span className="text-[11.5px] text-muted-foreground">Desligado</span>}
              <RowAction ghost size={28} icon={<Pencil size={13} />} title={`Editar ${t.name}`} onClick={() => open(t)} />
            </div>
          ))}
        </div>
      </SettingsPanel>

      <FormDialog
        open={Boolean(draft)}
        onOpenChange={(v) => !v && setDraft(null)}
        title={isNew ? 'Novo freepass' : `Editar ${draft?.name || ''}`}
        description="O freepass vale por dias de acesso ou por um número de aulas."
        submitLabel={isNew ? 'Criar freepass' : 'Salvar'}
        submitting={saving}
        onSubmit={save}
      >
        {draft && (
          <>
            <DialogField label="Nome">
              <input className={FIELD_INPUT} value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Pilates 2 aulas" aria-invalid={problem?.field === 'name'} />
            </DialogField>
            <DialogField label="Modalidade">
              <select className={FIELD_INPUT} value={draft.modalidadeId} onChange={e => set('modalidadeId', e.target.value)} aria-invalid={problem?.field === 'modalidadeId'}>
                <option value="">Escolha</option>
                {(modalities || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </DialogField>
            <DialogField label="Vale por">
              <div className="flex gap-2" role="radiogroup" aria-label="Vale por">
                {[[FREEPASS_KINDS.DIAS, 'Dias'], [FREEPASS_KINDS.AULAS, 'Aulas']].map(([k, label]) => (
                  <button
                    key={k} type="button" role="radio" aria-checked={draft.kind === k}
                    onClick={() => set('kind', k)}
                    className={cn('h-9 flex-1 rounded-lg border text-[13px] font-semibold focus-visible:outline-none focus-visible:anel-foco',
                      draft.kind === k ? 'border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200' : 'border-border text-muted-foreground')}
                  >{label}</button>
                ))}
              </div>
            </DialogField>
            <DialogField label={draft.kind === FREEPASS_KINDS.AULAS ? 'Quantas aulas' : 'Quantos dias'} hint="De 1 a 99.">
              <input className={cn(FIELD_INPUT, 'num')} type="number" min={1} max={99} value={draft.quantity} onChange={e => set('quantity', e.target.value)} aria-invalid={problem?.field === 'quantity'} />
            </DialogField>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={draft.padrao} onChange={e => set('padrao', e.target.checked)} />
              Padrão da modalidade (o que o Stronizap e a IA usam)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={draft.ativo} onChange={e => set('ativo', e.target.checked)} />
              Ativo (aparece para lançar)
            </label>
            <p role="status" className="min-h-[18px] text-[12.5px] font-semibold text-rose-600 dark:text-rose-400">{problem?.message || ''}</p>
          </>
        )}
      </FormDialog>
    </>
  );
}
