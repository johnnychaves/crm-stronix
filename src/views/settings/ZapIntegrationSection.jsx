import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Copy, KeyRound, PlugZap } from 'lucide-react';
import { auth } from '../../lib/firebase.js';
import { cn } from '../../lib/utils.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { PanelNote, SettingsBtn } from './settingsBits.jsx';
import { zapIntegrationState, ZAP_STATE, ZAP_STATE_LABEL } from '../../lib/zapIntegration.js';

// Integração com o Stronizap — o admin gera aqui a chave que o Stronizap usa
// para reconhecer quem é o contato por trás de um telefone. O estado vem
// direto de tenants/{id} (as rules já liberam a leitura para quem é da
// academia); a escrita é sempre pelo /api/zap, com o Admin SDK do lado de lá.
//
// A chave em claro só existe no navegador entre o "Gerar" e o admin sair da
// tela — nunca é persistida aqui, e o servidor não guarda outra cópia dela.

const ZAP_ENDPOINT = 'https://crm-stronix.vercel.app/api/zap';

const STATE_TONE = {
  [ZAP_STATE.DESCONECTADO]: 'bg-amber-500',
  [ZAP_STATE.CONECTADO]: 'bg-emerald-500',
  [ZAP_STATE.REVOGADO]: 'bg-rose-500'
};

const STATE_TEXT_TONE = {
  [ZAP_STATE.DESCONECTADO]: 'text-amber-600 dark:text-amber-400',
  [ZAP_STATE.CONECTADO]: 'text-emerald-600 dark:text-emerald-400',
  [ZAP_STATE.REVOGADO]: 'text-rose-600 dark:text-rose-400'
};

function ZapIntegrationSection({ db, appUser }) {
  const toast = useToast();
  const tenantId = appUser?.tenantId;

  const [zap, setZap] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    if (!db || !tenantId) return;
    const unsub = onSnapshot(
      doc(db, 'tenants', tenantId),
      (snap) => {
        setZap(snap.exists() ? snap.data()?.integrations?.zap || null : null);
        setLoaded(true);
      },
      (err) => { console.error('zap integration', err); setLoaded(true); }
    );
    return () => unsub();
  }, [db, tenantId]);

  const state = zapIntegrationState(zap);

  const authHeader = async () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
  });

  const callZap = async (action) => {
    const res = await fetch('/api/zap', {
      method: 'POST',
      headers: await authHeader(),
      body: JSON.stringify({ action })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Não foi possível falar com a integração.');
    return data;
  };

  const generate = async () => {
    setBusy(true);
    try {
      const data = await callZap('generate');
      setNewKey(data.key);
      toast.success('Chave gerada. Copie agora — ela não aparece de novo.', { duration: 8000 });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Não foi possível gerar a chave.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm(
      'Revogar a chave de conexão do Stronizap?\n\nO Stronizap para de reconhecer os contatos desta academia até você gerar uma chave nova.'
    )) return;
    setBusy(true);
    try {
      await callZap('revoke');
      setNewKey('');
      toast.success('Chave revogada.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Não foi possível revogar a chave.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, message) => {
    try { await navigator.clipboard.writeText(text); toast.success(message); }
    catch { toast.info('Copie manualmente.'); }
  };

  if (!loaded) {
    return <div className="text-center text-[13px] text-muted-foreground py-12">Carregando integração…</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Stronizap"
        hint="A chave que conecta este CRM ao atendimento por WhatsApp."
      />

      <SettingsPanel
        icon={<PlugZap size={16} />}
        title="Chave de conexão"
        hint="O Stronizap usa esta chave para reconhecer os contatos desta academia."
        action={
          state === ZAP_STATE.CONECTADO ? (
            <SettingsBtn kind="danger" size={36} onClick={revoke} disabled={busy}>Revogar</SettingsBtn>
          ) : null
        }
        padded
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className={cn('size-[7px] rounded-full shrink-0', STATE_TONE[state])} />
            <span className={cn('text-[12.5px] font-semibold', STATE_TEXT_TONE[state])}>
              {ZAP_STATE_LABEL[state]}
            </span>
            {state !== ZAP_STATE.DESCONECTADO && zap?.keyPrefix && (
              <span className="text-[12px] text-muted-foreground num">· {zap.keyPrefix}…</span>
            )}
          </div>

          {!newKey && (
            <div>
              <SettingsBtn kind="primary" size={38} icon={<KeyRound size={14} />} onClick={generate} disabled={busy}>
                {state === ZAP_STATE.DESCONECTADO ? 'Gerar chave' : 'Gerar nova chave'}
              </SettingsBtn>
            </div>
          )}

          {newKey && (
            <div className="flex flex-col gap-2.5 p-3.5 rounded-[12px] bg-muted/60 border border-border">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[12.5px] num truncate select-all">{newKey}</code>
                <SettingsBtn size={34} icon={<Copy size={13} />} onClick={() => copy(newKey, 'Chave copiada!')}>
                  Copiar
                </SettingsBtn>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
                  Copie agora. Ela não será mostrada de novo.
                </p>
                <button
                  type="button"
                  onClick={() => setNewKey('')}
                  className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground shrink-0"
                >
                  Já copiei
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Endereço para o Stronizap"
        hint="Informe este endereço na configuração do Stronizap, junto com a chave."
      >
        <div className="px-5 pb-4 flex items-center gap-2">
          <span className="flex-1 text-[12px] text-muted-foreground truncate num p-2.5 rounded-[10px] bg-muted/60 border border-border">
            {ZAP_ENDPOINT}
          </span>
          <SettingsBtn size={34} icon={<Copy size={13} />} onClick={() => copy(ZAP_ENDPOINT, 'Endereço copiado!')}>
            Copiar
          </SettingsBtn>
        </div>
        <PanelNote>
          A chave nunca fica salva aqui em texto puro — só um hash. Se você revogar ou perder a chave, gere uma nova e atualize no Stronizap.
        </PanelNote>
      </SettingsPanel>
    </div>
  );
}

export { ZapIntegrationSection };
