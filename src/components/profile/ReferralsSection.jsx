import { useMemo, useState } from 'react';
import { Check, Copy, Handshake, Link2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { appId } from '../../lib/firebase.js';
import {
  summarizeReferrals,
  buildReferralShareLink,
  buildReferralWhatsAppText
} from '../../lib/referrals.js';
import { deriveLeadState, getTone } from '../../lib/leadState.js';
import { isClientLead } from '../../lib/leads.js';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { StateRingAvatar } from '../ui/StateRingAvatar.jsx';

const fmtDia = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : null;
};

// Bloco do resumo (mesmo idioma visual das células rotuladas da ficha).
function SummaryBlock({ label, value, accent }) {
  return (
    <div className="min-w-0 px-5 first:pl-0 py-0.5">
      <div className="text-[9.5px] font-bold uppercase tracking-[.07em] text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</div>
      <div className={cn('mt-1 num text-[20px] font-bold leading-none', accent || 'text-slate-900 dark:text-white')}>{value}</div>
    </div>
  );
}

// Link público de indicação DESTE cliente (fase 2): copiar + mandar direto no
// WhatsApp dele. O slug do tenant é o appId; o ref é o id do doc do cliente.
function ShareLinkBox({ lead }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const link = buildReferralShareLink(window.location.origin, appId, lead.id);
  const firstName = String(lead.name || '').trim().split(/\s+/)[0] || '';
  const waDigits = String(lead.whatsapp || '').replace(/\D/g, '');
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(buildReferralWhatsAppText({ firstName, link }))}`
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link de indicação copiado.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Copie manualmente: ${link}`);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-500/[0.05] px-4 sm:px-5 py-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-emerald-700 dark:text-emerald-300">
            <Link2 size={11} /> Link de indicação deste cliente
          </div>
          <div className="num text-[12px] text-slate-600 dark:text-slate-300 truncate mt-1">{link}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={copy}
            className="h-8 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.06] dark:text-slate-200 dark:border-white/10 transition"
          >
            {copied ? <Check size={13} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              <MessageCircle size={13} /> Enviar pro cliente
            </a>
          )}
        </div>
      </div>
      <p className="text-[11.5px] text-emerald-800/70 dark:text-emerald-200/60 mt-2 leading-relaxed">
        Quem se cadastrar por ele entra no funil Indicações já vinculado a {firstName || 'este cliente'}, com o mesmo consultor responsável.
      </p>
    </section>
  );
}

// Conteúdo da aba Indicações da ficha do CLIENTE: link compartilhável + resumo
// + lista dos indicados. O estado de cada indicado é derivado AO VIVO do doc
// dele (deriveLeadState/isClientLead) — desfazer uma Venda reflete aqui sozinho.
export function ReferralsSection({ lead, items, loading }) {
  const { contractThresholdDays } = useGeneralConfig();
  const { openProfile } = useLeadProfile();
  const summary = useMemo(() => summarizeReferrals(items || []), [items]);
  const now = new Date();

  let content;
  if (loading && items == null) {
    content = (
      <section className="rounded-2xl border border-border bg-card shadow-card px-8 py-10 text-center">
        <p className="text-[13px] text-muted-foreground">Carregando indicações…</p>
      </section>
    );
  } else if (!items || items.length === 0) {
    content = (
      <section className="rounded-2xl border border-border bg-card shadow-card px-8 py-12 text-center">
        <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 grid place-items-center mx-auto mb-3">
          <Handshake size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-[14px] font-semibold text-slate-900 dark:text-white">Nenhuma indicação ainda</p>
        <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[400px] mx-auto leading-relaxed">
          Mande o link acima pro cliente divulgar, ou cadastre um lead novo com o interruptor “É uma indicação?” — os indicados aparecem aqui com o andamento de cada um.
        </p>
      </section>
    );
  } else {
    content = (
      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        {/* Resumo */}
        <div className="px-8 py-4 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-y-3 divide-x divide-slate-100 dark:divide-white/[0.06]">
          <SummaryBlock label="Indicados" value={summary.total} />
          <SummaryBlock label="Viraram alunos" value={summary.alunos} accent="text-emerald-600 dark:text-emerald-400" />
          <SummaryBlock label="Em andamento" value={summary.andamento} accent="text-brand-600 dark:text-brand-300" />
          <SummaryBlock label="Perdidos" value={summary.perdidos} accent={summary.perdidos > 0 ? 'text-rose-600 dark:text-rose-400' : undefined} />
        </div>

        {/* Lista */}
        <ul className="divide-y divide-slate-100 dark:divide-white/[0.05]">
          {items.map((l) => {
            const state = deriveLeadState(l, now, contractThresholdDays);
            const tone = getTone(state.tone);
            const aluno = isClientLead(l);
            const quando = fmtDia(l.referredAt) || fmtDia(l.createdAt);
            const convertido = aluno ? fmtDia(l.convertedAt) : null;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => openProfile(l.id)}
                  className="w-full flex items-center gap-3 px-5 sm:px-8 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition"
                >
                  <StateRingAvatar name={l.name} toneName={state.tone} splitHex={state.key === 'a_vencer' ? '#10B981' : null} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{l.name || 'Sem nome'}</div>
                    <div className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate">
                      {quando ? `Indicado em ${quando}` : 'Indicado'}
                      {aluno && l.currentPlanName ? (
                        <>
                          {' · '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {l.currentPlanName}{convertido ? ` desde ${convertido}` : ''}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-lg shrink-0 whitespace-nowrap', tone.soft, tone.text, tone.darkSoft, tone.darkText)}>
                    {state.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {lead?.id && <ShareLinkBox lead={lead} />}
      {content}
    </div>
  );
}
