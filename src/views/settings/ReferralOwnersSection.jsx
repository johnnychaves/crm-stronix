import { useMemo, useState } from 'react';
import { collection, doc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowRightLeft, Handshake } from 'lucide-react';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import {
  pendingReferralOwners,
  planReferralFunnelMerge,
  getReferralFunnel,
  isReferralFunnel
} from '../../lib/referrals.js';
import { commitReferralLink } from '../../lib/referralsWrites.js';
import { deriveLeadState } from '../../lib/leadState.js';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { StateRingAvatar } from '../../components/ui/StateRingAvatar.jsx';
import { ReferrerPicker } from '../../components/profile/ReferrerPicker.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { EmptyState, FIELD_INPUT, PanelNote, SettingsBtn } from './settingsBits.jsx';

// INDICAÇÕES SEM DONO — a fila do passado. Leads que entraram com origem
// "Indicação" antes da feature existir não têm vínculo com ninguém; aqui a
// equipe diz quem indicou cada um, ou marca que ninguém sabe.
//
// Fonte: os leads que a tela de Configurações já carrega (todos os estados,
// inclusive clientes e perdidos). Zero query nova, zero índice.

const fmtDia = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : null;
};

function Row({ lead, db, appUser, onDone }) {
  const toast = useToast();
  const { contractThresholdDays } = useGeneralConfig();
  const [referrer, setReferrer] = useState(null);
  const [saving, setSaving] = useState(false);
  const state = deriveLeadState(lead, new Date(), contractThresholdDays);
  const quando = fmtDia(lead.createdAt);

  const salvar = async () => {
    if (!referrer) return;
    setSaving(true);
    try {
      await commitReferralLink({ db, lead, appUser, referrer });
      toast.success(`${lead.name} agora é indicação de ${referrer.name}.`);
      onDone(lead.id);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o vínculo.');
    } finally {
      setSaving(false);
    }
  };

  const naoSei = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        { referrerUnknown: true },
        { merge: true }
      );
      onDone(lead.id);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível tirar da lista.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border last:border-b-0">
      <StateRingAvatar name={lead.name} toneName={state.tone} size={34} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold truncate">{lead.name || 'Sem nome'}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {quando ? `Cadastrado em ${quando}` : 'Sem data de cadastro'} · {state.label}
        </div>
      </div>
      <div className="w-full sm:w-[240px] shrink-0">
        <ReferrerPicker db={db} value={referrer} onSelect={setReferrer} excludeId={lead.id} />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <SettingsBtn kind="primary" size={34} disabled={!referrer || saving} onClick={salvar}>Salvar</SettingsBtn>
        <SettingsBtn size={34} disabled={saving} onClick={naoSei}>Não sei</SettingsBtn>
      </div>
    </div>
  );
}

// Traz um funil de indicações feito à mão para o funil do sistema. Quem já
// trabalhava indicações antes da feature existir tem os dois; sem isto, seria
// preciso mover lead por lead — e o app exige indicador ao mover um a um, o que
// trava justamente quem não sabe quem indicou quem.
function MergeFunnelBox({ db, leads, funnels, statuses, appUser, onDone }) {
  const toast = useToast();
  const [fromId, setFromId] = useState('');
  const [running, setRunning] = useState(false);

  const referralFunnel = getReferralFunnel(funnels);
  const candidatos = (funnels || []).filter((f) => !isReferralFunnel(f) && !f.isDefault);
  const plan = useMemo(
    () => planReferralFunnelMerge({ leads, statuses, fromFunnelId: fromId, referralFunnelId: referralFunnel?.id }),
    [leads, statuses, fromId, referralFunnel]
  );

  if (!referralFunnel) {
    return (
      <PanelNote>
        O funil de Indicações ainda não existe nesta academia. Ele é criado sozinho quando um administrador entra no sistema.
      </PanelNote>
    );
  }

  const origem = candidatos.find((f) => f.id === fromId);

  const executar = async () => {
    if (!plan.total || !origem) return;
    const ok = window.confirm(
      `Mover ${plan.total} ${plan.total === 1 ? 'pessoa' : 'pessoas'} do funil "${origem.name}" para "${referralFunnel.name}"?\n\n` +
      'As etapas com nome equivalente são preservadas; as demais entram na etapa de entrada. ' +
      'Venda e Perda não mudam.'
    );
    if (!ok) return;

    setRunning(true);
    try {
      await commitOpsInChunks(
        db,
        plan.moves.map((m) => ({
          ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, m.id),
          data: { funnelId: m.funnelId, status: m.status }
        })),
        400
      );
      // Rastro de auditoria, no mesmo espírito do "Migrar leads".
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: null,
        leadName: null,
        consultantName: appUser?.name || null,
        actorId: appUser?.id || null,
        actorAuthUid: appUser?.authUid || null,
        text: `MIGRAÇÃO: ${plan.total} pessoa(s) do funil "${origem.name}" para "${referralFunnel.name}".`,
        type: 'note',
        createdAt: serverTimestamp()
      }).catch(() => { /* o log não pode derrubar a migração */ });

      toast.success(`${plan.total} ${plan.total === 1 ? 'pessoa movida' : 'pessoas movidas'} para ${referralFunnel.name}.`);
      setFromId('');
      onDone?.();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível concluir a transferência.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <SettingsPanel
      title={<>Trazer um funil para <b>{referralFunnel.name}</b></>}
      hint="Use se você já tinha um funil de indicações próprio. As pessoas mudam de funil; ninguém é apagado."
    >
      <div className="border-t border-border px-5 py-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-slate-500 dark:text-slate-400 mb-1.5">
            Funil de origem
          </div>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className={FIELD_INPUT}
          >
            <option value="">Selecione…</option>
            {candidatos.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <SettingsBtn
          kind="primary"
          size={38}
          icon={<ArrowRightLeft size={14} />}
          disabled={!plan.total || running}
          onClick={executar}
        >
          {running ? 'Movendo…' : 'Transferir'}
        </SettingsBtn>
      </div>

      {fromId && (
        <div className="px-5 pb-4 -mt-1">
          {plan.total === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Esse funil está vazio. Nada para mover.</p>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              <b className="text-slate-700 dark:text-slate-200">{plan.total}</b> {plan.total === 1 ? 'pessoa' : 'pessoas'} vão para {referralFunnel.name}
              {plan.semDono > 0 && <> e <b className="text-slate-700 dark:text-slate-200">{plan.semDono}</b> {plan.semDono === 1 ? 'entra' : 'entram'} na fila abaixo para você dizer quem indicou</>}.
              {' '}O funil de origem fica vazio e você pode excluí-lo em Funis e etapas.
            </p>
          )}
        </div>
      )}
    </SettingsPanel>
  );
}

function ReferralOwnersSection({ db, leads, funnels, statuses, appUser }) {
  // Resolvidos nesta sessão saem da lista na hora (o prop `leads` só atualiza
  // no próximo carregamento da tela).
  const [resolvidos, setResolvidos] = useState(() => new Set());
  // Recontagem depois de uma transferência: o prop `leads` só volta atualizado
  // no próximo carregamento da tela, então este contador força o recálculo.
  const [epoch, setEpoch] = useState(0);
  const referralFunnelId = getReferralFunnel(funnels)?.id || null;
  const pendentes = useMemo(
    () => pendingReferralOwners(leads, referralFunnelId).filter((l) => !resolvidos.has(l.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `epoch` só existe para reavaliar após a transferência.
    [leads, referralFunnelId, resolvidos, epoch]
  );

  const marcarResolvido = (id) => setResolvidos((s) => new Set(s).add(id));

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Indicações sem dono"
        hint="Leads que vieram por indicação antes do sistema existir. Diga quem indicou cada um para eles entrarem na conta do aluno certo."
      />

      <MergeFunnelBox
        db={db}
        leads={leads}
        funnels={funnels}
        statuses={statuses}
        appUser={appUser}
        onDone={() => setEpoch((n) => n + 1)}
      />

      <SettingsPanel
        title={<>Fila de vínculos {pendentes.length > 0 && <b>({pendentes.length})</b>}</>}
        hint="Salvar registra o vínculo dos dois lados, igual ao cadastro manual."
      >
        <div className="border-t border-border">
          {pendentes.length === 0 ? (
            <EmptyState>
              Nenhuma indicação sem dono por aqui. Toda pessoa que veio por indicação já está ligada a quem a trouxe.
            </EmptyState>
          ) : (
            pendentes.map((lead) => (
              <Row key={lead.id} lead={lead} db={db} appUser={appUser} onDone={marcarResolvido} />
            ))
          )}
        </div>
      </SettingsPanel>

      <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <Handshake size={14} className="shrink-0 mt-0.5" />
        <span>
          “Não sei” tira o lead da fila sem inventar vínculo. Ele continua com a origem Indicação nos relatórios.
        </span>
      </p>
    </div>
  );
}

export { ReferralOwnersSection };
