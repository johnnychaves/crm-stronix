import { useState } from 'react';
import { AlertCircle, CalendarDays, Minus, Plus, RefreshCw, X, Zap } from 'lucide-react';
import { doc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { appId, CONFIG_PATH, CONFIG_GENERAL_ID, USERS_PATH } from '../../lib/firebase.js';
import { normalizeRenewalCheckpoints } from '../../lib/leadStatus.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { DialogField, FIELD_INPUT, FormDialog, PanelNote, SettingsBtn } from './settingsBits.jsx';
import { DG_WEEKDAY_NAMES } from '../DailyGoalView.jsx';

// Metas & ritmo — as regras que decidem o que aparece na Meta Diária e quando
// um lead vira urgente. Três blocos de configuração da academia (dias, SLA e
// marcos de renovação) mais o piso individual de prospecção.

// Cor de cada marco na régua do contrato: azul → violeta → âmbar, e rosa
// reservado ao vencimento (o marco 0, que não é configurável).
const CHECKPOINT_COLORS = ['#2B59FF', '#8B5CF6', '#F59E0B'];
const DUE_COLOR = '#F43F5E';

const checkpointLegend = (index, total) => {
  if (index === 0) return 'Primeiro aviso';
  if (index === total - 1) return 'Última janela';
  return 'Reforço';
};

const initialsOf = (name) => (name || '?')
  .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Rótulo curto do botão de dia. DG_WEEKDAY_NAMES é a fonte da verdade (e vale
// como aria-label); aqui só encurta para caber no botão de 44px.
const SHORT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function CycleRuler({ checkpoints }) {
  const marks = [
    ...checkpoints.map((n, i) => ({
      value: n,
      unit: 'dias antes',
      legend: checkpointLegend(i, checkpoints.length),
      color: CHECKPOINT_COLORS[Math.min(i, CHECKPOINT_COLORS.length - 1)]
    })),
    { value: 0, unit: 'vencimento', legend: 'Contrato encerra', color: DUE_COLOR }
  ];

  return (
    <div className="relative flex justify-between mx-6 mt-1.5 pt-[34px]">
      {/* A linha entra 7px de cada lado para encostar no centro dos dots. */}
      <span
        aria-hidden="true"
        className="absolute left-[7px] right-[7px] bottom-[6px] h-[3px] rounded-full"
        style={{ background: 'linear-gradient(90deg, var(--muted) 0%, var(--muted) 42%, rgba(245,158,11,.5) 74%, rgba(244,63,94,.7) 100%)' }}
      />
      {marks.map((m, i) => (
        <div
          key={`${m.value}-${i}`}
          className={cn('relative flex flex-col min-w-0', i === marks.length - 1 ? 'items-end text-right' : 'items-start')}
        >
          <div className="flex items-baseline gap-1">
            <span className="font-display text-[16px] font-bold leading-none num" style={{ color: m.color }}>{m.value}</span>
            <span className="text-[10.5px] font-semibold text-muted-foreground">{m.unit}</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{m.legend}</span>
          <span
            className="mt-2 size-[15px] rounded-full bg-card shadow-[0_0_0_4px_var(--card)]"
            style={{ border: `3px solid ${m.color}` }}
          />
        </div>
      ))}
    </div>
  );
}

function PaceSection({ db, usersList, metaWeekdays }) {
  const toast = useToast();
  const { slaOverdueDays, renewalCheckpoints = [90, 60, 30] } = useGeneralConfig();
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [checkpointInput, setCheckpointInput] = useState('');
  const [savingCheckpoints, setSavingCheckpoints] = useState(false);

  // A ref é montada na hora de gravar, não no render: render não deve tocar
  // no SDK do Firestore.
  const saveConfig = (data) => setDoc(
    doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );

  // 0=dom..6=sáb. Dia desligado = folga: não cobra meta nem quebra a sequência.
  const toggleWeekday = async (dow) => {
    const set = new Set(Array.isArray(metaWeekdays) ? metaWeekdays : [1, 2, 3, 4, 5]);
    if (set.has(dow)) {
      // Zerar todos os dias faria a Meta Diária nunca disparar e travaria o
      // ritmo do mês inteiro.
      if (set.size === 1) { toast.warning('Mantenha ao menos um dia ativo na meta.'); return; }
      set.delete(dow);
    } else set.add(dow);
    try {
      await saveConfig({ metaWeekdays: Array.from(set).sort((a, b) => a - b) });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os dias da meta.');
    }
  };

  const saveSla = async (n) => {
    if (!Number.isFinite(n) || n < 1 || n > 30) return;
    try {
      await saveConfig({ slaOverdueDays: n });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o alerta de lead crítico.');
    }
  };

  // Alvo INDIVIDUAL de prospecção (doc do consultor): vazio ou 0 = desabilitado.
  const saveUserTarget = async (u, raw) => {
    const cur = u.dailyVolumeTarget ?? null;
    const parsed = raw === '' ? 0 : Math.floor(Number(raw));
    if (raw !== '' && !Number.isFinite(parsed)) return;
    const next = parsed > 0 ? Math.min(500, parsed) : null;
    if (next === cur) return;
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, u.id),
        { dailyVolumeTarget: next === null ? deleteField() : next }
      );
      toast.success(`Prospecção de ${u.name}: ${next === null ? 'desabilitada' : `${next} ações/dia`}.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o alvo individual.');
    }
  };

  const persistCheckpoints = async (next) => {
    setSavingCheckpoints(true);
    try {
      await saveConfig({ renewalCheckpoints: normalizeRenewalCheckpoints(next) });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os marcos de renovação.');
    }
    setSavingCheckpoints(false);
  };

  const addCheckpoint = async () => {
    const n = Math.floor(Number(checkpointInput));
    if (!Number.isFinite(n) || n < 1 || n > 365) { toast.warning('Informe um número de dias entre 1 e 365.'); return; }
    if ((renewalCheckpoints || []).includes(n)) {
      toast.warning(`O marco de ${n} dias já existe.`);
      setCheckpointInput('');
      return;
    }
    await persistCheckpoints([...(renewalCheckpoints || []), n]);
    setCheckpointInput('');
    setCheckpointOpen(false);
  };

  const removeCheckpoint = async (n) => {
    const next = (renewalCheckpoints || []).filter(x => x !== n);
    if (next.length === 0) { toast.warning('Mantenha ao menos um marco de renovação.'); return; }
    await persistCheckpoints(next);
  };

  const activeDays = Array.isArray(metaWeekdays) ? metaWeekdays : [];
  const checkpoints = normalizeRenewalCheckpoints(renewalCheckpoints || []);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Metas & ritmo"
        hint="As regras que decidem o que aparece na Meta Diária e quando um lead vira urgente."
      />

      <div className="grid gap-3.5 lg:grid-cols-2 items-start">
        <SettingsPanel
          icon={<CalendarDays size={16} />}
          iconTone="brand"
          title="Dias de meta"
          hint="Dias desligados contam como folga: não cobram meta e não quebram a sequência do consultor."
          padded
        >
          <div className="flex flex-wrap gap-1.5">
            {DG_WEEKDAY_NAMES.map((name, dow) => {
              const on = activeDays.includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleWeekday(dow)}
                  aria-pressed={on}
                  aria-label={name}
                  title={name}
                  className={cn(
                    'w-11 h-10 rounded-[10px] text-[12.5px] font-bold transition border',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                    on
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {SHORT_WEEKDAYS[dow]}
                </button>
              );
            })}
          </div>
        </SettingsPanel>

        <SettingsPanel
          icon={<AlertCircle size={16} />}
          iconTone="danger"
          title="Alerta de lead crítico"
          hint={`Leads atrasados há ${slaOverdueDays}+ ${slaOverdueDays === 1 ? 'dia' : 'dias'} ganham alerta no painel do gestor e destaque vermelho na Meta Diária.`}
          padded
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => saveSla(slaOverdueDays - 1)}
                disabled={slaOverdueDays <= 1}
                aria-label="Diminuir dias de atraso"
                className="size-9 grid place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <Minus size={14} />
              </button>
              <span className="num w-11 text-center font-display text-[22px] font-bold leading-none">{slaOverdueDays}</span>
              <button
                type="button"
                onClick={() => saveSla(slaOverdueDays + 1)}
                disabled={slaOverdueDays >= 30}
                aria-label="Aumentar dias de atraso"
                className="size-9 grid place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="text-[13px] text-muted-foreground">
              {slaOverdueDays === 1 ? 'dia de atraso' : 'dias de atraso'} → lead <b className="text-rose-600 dark:text-rose-400">crítico</b>
            </span>
          </div>
        </SettingsPanel>
      </div>

      <SettingsPanel
        icon={<Zap size={16} />}
        iconTone="accent"
        title="Meta de prospecção"
        hint={<>Piso de ações por dia, individual. Conta como ação: agendar/reagendar, registrar ligação ou mensagem, e cadastrar lead novo. Quem zera as pendências <b>e</b> bate a prospecção ganha o selo <b>dia perfeito ⚡</b>. Vazio = sem meta.</>}
      >
        <div className="border-t border-border">
          {(usersList || []).map((u, i) => (
            <div
              key={u.id}
              className={cn('flex items-center gap-3 px-5 py-3', i < (usersList || []).length - 1 && 'border-b border-border')}
            >
              <span className="size-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {initialsOf(u.name)}
              </span>
              <span className="text-[13.5px] flex-1 truncate">{u.name}{u.role === 'admin' ? ' (gestor)' : ''}</span>
              <input
                type="number" min="0" max="500"
                defaultValue={u.dailyVolumeTarget ?? ''}
                placeholder="off"
                aria-label={`Meta de prospecção de ${u.name}`}
                onBlur={(e) => saveUserTarget(u, e.target.value.trim())}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="w-[88px] h-9 px-3 rounded-[10px] text-[12.5px] num text-center bg-muted/60 border border-border outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="text-[11.5px] text-slate-400 dark:text-slate-500 w-[66px] shrink-0">ações/dia</span>
            </div>
          ))}
        </div>
        <PanelNote>Salva ao sair do campo — Enter confirma.</PanelNote>
      </SettingsPanel>

      <SettingsPanel
        icon={<RefreshCw size={16} />}
        iconTone="brand"
        title="Marcos de renovação"
        hint={<>Dias antes do vencimento em que o cliente entra na tarefa de Renovação. Ele aparece <b>uma vez</b> em cada marco — não todo dia.</>}
        action={
          <SettingsBtn kind="dashed" size={34} icon={<Plus size={13} />} onClick={() => setCheckpointOpen(true)}>
            Novo marco
          </SettingsBtn>
        }
      >
        <CycleRuler checkpoints={checkpoints} />

        <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {checkpoints.map((n, i) => (
              <span key={n} className="inline-flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-[10px] bg-card border border-border text-[13px] font-semibold">
                <span className="size-2 rounded-full" style={{ background: CHECKPOINT_COLORS[Math.min(i, CHECKPOINT_COLORS.length - 1)] }} />
                <span className="num">{n} {n === 1 ? 'dia' : 'dias'}</span>
                <button
                  type="button"
                  onClick={() => removeCheckpoint(n)}
                  title={`Remover o marco de ${n} dias`}
                  aria-label={`Remover o marco de ${n} dias`}
                  className="size-5 grid place-items-center rounded-md text-muted-foreground transition hover:text-rose-600 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <p className="text-[11.5px] text-muted-foreground">Para editar um marco, remova e adicione o novo valor.</p>
        </div>
      </SettingsPanel>

      <FormDialog
        open={checkpointOpen}
        onOpenChange={(v) => { setCheckpointOpen(v); if (!v) setCheckpointInput(''); }}
        title="Novo marco de renovação"
        description="Quantos dias antes do vencimento o cliente deve entrar na tarefa de Renovação."
        submitLabel="Adicionar marco"
        submitting={savingCheckpoints}
        onSubmit={addCheckpoint}
      >
        <DialogField label="Dias antes do vencimento" hint="Entre 1 e 365.">
          <input
            className={cn(FIELD_INPUT, 'num')}
            type="number" min={1} max={365} autoFocus
            value={checkpointInput}
            onChange={e => setCheckpointInput(e.target.value)}
            placeholder="ex: 90"
          />
        </DialogField>
      </FormDialog>
    </div>
  );
}

export { PaceSection };
