import { useRef, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, Plus } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { useDuplicateLead, findDuplicateLeadRemote } from '../hooks/useDuplicateLead.js';
import { buildNewLeadDoc } from '../lib/newLead.js';
import { formatPhone } from '../lib/masks.js';
import { quickReferralForm, quickReferralIssue } from '../lib/referrals.js';
import { commitReferralLink } from '../lib/referralsWrites.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { Btn } from '../components/ui/Btn.jsx';

// Cadastro de indicações à mão, pela ficha do cliente (menu Indicar e aba
// Indicações). Um indicado depois do outro: Cadastrar grava, limpa os campos e
// volta o cursor para o Nome, e cada gravado entra em "Cadastradas agora".
// O lead sai do mesmo montador do Novo lead (buildNewLeadDoc), no funil
// Indicações, com quem cadastra de dono (as rules só deixam o consultor criar
// lead em nome dele mesmo). O vínculo com o cliente sai do commitReferralLink,
// que grava referredAt e o 🤝 nas duas linhas do tempo. `referrer` é o doc do
// cliente inteiro: o commitReferralLink tira dele os campos de segurança da
// interação que vai para a linha do tempo do cliente.

const EMPTY = { name: '', whatsapp: '', modalidade: '', dor: '' };
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const INPUT = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';

function Field({ label, required = false, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11.5px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function QuickReferralModal({ db, appUser, referrer, referralFunnelId, entryStageName, onClose, onCreated }) {
  const toast = useToast();
  const { modalities = [], dores = [] } = useGeneralConfig();
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const nameRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const digits = onlyDigits(form.whatsapp);
  const { duplicate } = useDuplicateLead({ db, phoneDigits: digits });
  const issue = quickReferralIssue(form);
  const canSubmit = !issue && !duplicate && !saving;
  // Diz o que falta quando o Cadastrar está desligado com o campo já começado.
  const hint = issue === 'name' && form.name.trim()
    ? 'Digite o nome com 2 letras ou mais.'
    : issue === 'whatsapp' && digits
      ? 'Digite o WhatsApp com DDD.'
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // O aviso ao vivo tem espera de 300 ms: digitar e apertar Enter rápido
      // passaria por ele, então confere de novo na hora de gravar.
      const dup = await findDuplicateLeadRemote({ db, phoneDigits: digits });
      if (dup) {
        toast.warning(`Já existe um cadastro com este WhatsApp: ${dup.name}.`);
        return;
      }
      const leadForm = quickReferralForm(form, { funnelId: referralFunnelId, entryStageName });
      const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH), {
        ...buildNewLeadDoc(leadForm, { owner: appUser, referrer }),
        createdAt: serverTimestamp(),
        statusEnteredAt: serverTimestamp(),
      });
      // Best-effort, como no Novo lead: o vínculo já está no doc criado acima.
      try {
        await commitReferralLink({
          db,
          lead: { id: ref.id, name: leadForm.name, consultantId: appUser.id, consultantAuthUid: appUser.authUid },
          appUser,
          referrer,
        });
      } catch (err) {
        console.error('commitReferralLink falhou', err);
      }
      setCreated((list) => [...list, { id: ref.id, name: leadForm.name, whatsapp: form.whatsapp }]);
      setForm(EMPTY);
      if (onCreated) onCreated();
      setTimeout(() => nameRef.current?.focus(), 0);
    } catch (err) {
      console.error('QuickReferralModal', err);
      toast.error('Não foi possível cadastrar a indicação. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px] rounded-2xl border-border p-5 gap-0">
        <DialogTitle className="text-[16px] font-bold tracking-tight pr-6">
          Indicações de {referrer?.name || 'cliente'}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] text-muted-foreground mt-1">
          Entram no funil Indicações, com você de responsável.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome" required>
              <input
                ref={nameRef}
                autoFocus
                className={INPUT}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Juliana Prado"
              />
            </Field>
            <Field label="WhatsApp" required>
              <input
                type="tel"
                inputMode="numeric"
                className={INPUT}
                value={formatPhone(form.whatsapp)}
                onChange={(e) => set({ whatsapp: formatPhone(e.target.value) })}
                placeholder="(51) 9 9812-4410"
              />
            </Field>
            {modalities.length > 0 && (
              <Field label="Modalidade de interesse">
                <select className={INPUT} value={form.modalidade} onChange={(e) => set({ modalidade: e.target.value })}>
                  <option value="">Escolher</option>
                  {modalities.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </Field>
            )}
            {dores.length > 0 && (
              <Field label="Dor">
                <select className={INPUT} value={form.dor} onChange={(e) => set({ dor: e.target.value })}>
                  <option value="">Escolher</option>
                  {dores.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          {duplicate && (
            <p className="text-[12px] text-rose-600 dark:text-rose-400">
              Já existe:{' '}
              <LeadLink leadId={duplicate.id} target="_blank" rel="noopener" className="font-semibold underline">
                {duplicate.name || 'sem nome'}
              </LeadLink>
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
            <Btn kind="brand" type="submit" icon={<Plus size={14} />} disabled={!canSubmit}>
              {saving ? 'Cadastrando…' : 'Cadastrar'}
            </Btn>
          </div>
        </form>

        {created.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[11.5px] font-medium text-muted-foreground mb-1">
              Cadastradas agora · {created.length}
            </div>
            <ul className="flex flex-col">
              {created.map((c) => (
                <li key={c.id}>
                  <LeadLink
                    leadId={c.id}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 py-1.5 text-[13px] rounded-md hover:bg-accent"
                  >
                    <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="num text-[12px] text-muted-foreground">{c.whatsapp}</span>
                  </LeadLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Btn kind="secondary" onClick={onClose}>Concluir</Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
