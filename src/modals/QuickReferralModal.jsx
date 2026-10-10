import { useId, useRef, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ExternalLink, Handshake, Plus } from 'lucide-react';
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
import { Avatar } from '../components/ui/Avatar.jsx';
import { cn } from '../lib/utils.js';

// Cadastro de indicações à mão, pela ficha do cliente (menu Indicar e aba
// Indicações). Um indicado depois do outro: Cadastrar grava, limpa os campos e
// volta o cursor para o Nome, e cada gravado entra na lista ao lado.
// Dois painéis (desenho aprovado pelo Johnny em 30/09/2026): à esquerda, quem
// indica e o formulário; à direita, o contador e a lista do que já foi
// cadastrado, com o mais recente em cima. No celular os painéis empilham.
// O lead sai do mesmo montador do Novo lead (buildNewLeadDoc), no funil
// Indicações, com quem cadastra de dono (as rules só deixam o consultor criar
// lead em nome dele mesmo). O vínculo com o cliente sai do commitReferralLink,
// que grava referredAt e o 🤝 nas duas linhas do tempo. `referrer` é o doc do
// cliente inteiro: o commitReferralLink tira dele os campos de segurança da
// interação que vai para a linha do tempo do cliente.

const EMPTY = { name: '', whatsapp: '', modalidade: '', dor: '' };
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const INPUT = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus-visible:anel-foco';

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
  const modalidadeLabelId = useId();
  const firstName = String(referrer?.name || '').trim().split(/\s+/)[0] || 'o cliente';

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
      setCreated((list) => [{ id: ref.id, name: leadForm.name, whatsapp: form.whatsapp, modalidade: leadForm.modalidade }, ...list]);
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
      {/* sm:max-w-*: o DialogContent traz sm:max-w-lg, e só a mesma variante o troca. */}
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto rounded-2xl border-border p-0 gap-0">
        <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr]">
          {/* Esquerda: quem indica e o formulário */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 pr-8 md:pr-0">
              <Avatar name={referrer?.name || ''} size={40} photoUrl={referrer?.photoUrl || null} />
              <div className="min-w-0">
                <DialogTitle className="font-display text-[17px] font-bold tracking-tight truncate">
                  {referrer?.name ? `${referrer.name} indica` : 'Indicações do cliente'}
                </DialogTitle>
                <DialogDescription className="text-[12.5px] text-muted-foreground">
                  Funil Indicações · você fica responsável
                </DialogDescription>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
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
              </div>

              {modalities.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span id={modalidadeLabelId} className="text-[11.5px] font-medium text-muted-foreground">
                    Modalidade de interesse
                  </span>
                  {/* Botões de um clique no lugar da lista suspensa. Clicar no
                      que está marcado desmarca, porque o campo é opcional. */}
                  <div role="group" aria-labelledby={modalidadeLabelId} className="flex flex-wrap gap-1.5">
                    {modalities.map((m) => {
                      const on = form.modalidade === m.name;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set({ modalidade: on ? '' : m.name })}
                          // Quem clica na modalidade e aperta Enter quer
                          // cadastrar, não desmarcar o botão em foco.
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                          }}
                          className={cn(
                            'h-7 px-3 rounded-full border text-[12px] font-medium transition',
                            'focus:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                            on
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {dores.length > 0 && (
                <Field label="Dor">
                  <select className={INPUT} value={form.dor} onChange={(e) => set({ dor: e.target.value })}>
                    <option value="">Escolher</option>
                    {dores.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </Field>
              )}

              {duplicate && (
                <p className="text-[12px] text-rose-600 dark:text-rose-400">
                  Já existe:{' '}
                  <LeadLink leadId={duplicate.id} target="_blank" rel="noopener" className="font-semibold underline">
                    {duplicate.name || 'sem nome'}
                  </LeadLink>
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Btn kind="brand" size="md" type="submit" icon={<Plus size={15} />} disabled={!canSubmit}>
                  {saving ? 'Cadastrando…' : 'Cadastrar'}
                </Btn>
                {hint ? (
                  <span className="text-[12px] text-muted-foreground">{hint}</span>
                ) : (
                  <kbd className="pointer-coarse:hidden px-1.5 py-0.5 rounded border border-border text-[11px] text-muted-foreground">
                    Enter
                  </kbd>
                )}
              </div>
            </form>
          </div>

          {/* Direita: o que já foi cadastrado nesta abertura */}
          <div className="flex flex-col p-5 sm:p-6 bg-muted border-t md:border-t-0 md:border-l border-border">
            {created.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center gap-2 py-2">
                <span className="size-9 rounded-xl grid place-items-center bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Handshake size={17} />
                </span>
                <p className="text-[13px] font-semibold text-foreground">
                  Cadastre a primeira indicação de {firstName}
                </p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Cada pessoa cadastrada aparece aqui, com o link para a ficha.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 pr-8">
                  <span className="font-display num text-[30px] font-bold leading-none text-foreground">
                    {created.length}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {created.length === 1 ? 'cadastrada agora' : 'cadastradas agora'}
                  </span>
                </div>
                <ul className="mt-3 -mx-2 flex-1 flex flex-col gap-0.5 max-h-[260px] overflow-y-auto thin-scroll">
                  {created.map((c) => (
                    <li key={c.id} className="animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                      <LeadLink
                        leadId={c.id}
                        target="_blank"
                        rel="noopener"
                        title="Abrir a ficha em outra guia"
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-background transition"
                      >
                        <Avatar name={c.name} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-foreground truncate">{c.name}</span>
                          <span className="block num text-[11.5px] text-muted-foreground truncate">
                            {c.modalidade ? `${c.whatsapp} · ${c.modalidade}` : c.whatsapp}
                          </span>
                        </span>
                        <ExternalLink size={13} className="text-muted-foreground shrink-0" />
                      </LeadLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex justify-end">
              <Btn kind="secondary" size="md" onClick={onClose}>Concluir</Btn>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
