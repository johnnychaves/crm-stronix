import { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Handshake } from 'lucide-react';
import { appId, LEADS_PATH } from '../../lib/firebase.js';
import { pendingReferralOwners } from '../../lib/referrals.js';
import { commitReferralLink } from '../../lib/referralsWrites.js';
import { deriveLeadState } from '../../lib/leadState.js';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { StateRingAvatar } from '../../components/ui/StateRingAvatar.jsx';
import { ReferrerPicker } from '../../components/profile/ReferrerPicker.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { EmptyState, SettingsBtn } from './settingsBits.jsx';

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

function ReferralOwnersSection({ db, leads, appUser }) {
  // Resolvidos nesta sessão saem da lista na hora (o prop `leads` só atualiza
  // no próximo carregamento da tela).
  const [resolvidos, setResolvidos] = useState(() => new Set());
  const pendentes = useMemo(
    () => pendingReferralOwners(leads).filter((l) => !resolvidos.has(l.id)),
    [leads, resolvidos]
  );

  const marcarResolvido = (id) => setResolvidos((s) => new Set(s).add(id));

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Indicações sem dono"
        hint="Leads que vieram por indicação antes do sistema existir. Diga quem indicou cada um para eles entrarem na conta do aluno certo."
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
