import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Handshake, Lock } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// Página PÚBLICA do link de indicação (fase 2 — docs/indicacoes.md), aberta em
// /i/{slug}?ref={idDoCliente} sem login, quase sempre num celular vindo do
// WhatsApp. O herói é QUEM indicou (convite pessoal, não anúncio); o formulário
// é o mínimo que gera um lead útil: nome + WhatsApp (CPF opcional = 2ª chave de
// dedupe). Visual fixo claro, com a identidade da marca (Space Grotesk +
// brand/accent) — independe do dark mode do app.

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const fmtPhone = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
const fmtCPF = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

const inputCls =
  'w-full h-11 px-3.5 rounded-xl text-[14px] font-medium bg-white border border-slate-200 ' +
  'text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none transition ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12';

const labelCls = 'block text-[11px] font-display font-semibold uppercase tracking-[.04em] text-slate-600 mb-1.5';

function GymHeader({ displayName, logoUrl }) {
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-9 rounded-xl object-cover bg-white ring-1 ring-slate-200" />
      ) : (
        <div className="size-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 text-white font-display font-bold text-[15px]">
          {(displayName || 'A').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-display font-bold text-[15px] tracking-tight text-slate-900 truncate">{displayName}</div>
        <div className="text-[11px] text-slate-500">Academia</div>
      </div>
    </div>
  );
}

export function ReferralLandingScreen({ slug, refId }) {
  const [info, setInfo] = useState(null);
  const [infoError, setInfoError] = useState('');
  const [form, setForm] = useState({ name: '', whatsapp: '', cpf: '', modalidade: '' });
  const [website, setWebsite] = useState(''); // honeypot — humano nunca vê
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [doneName, setDoneName] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tenant-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'referral-info', slug, ref: refId })
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setInfoError(d?.error || 'Não foi possível carregar a página.'); return; }
        setInfo(d);
      })
      .catch(() => { if (!cancelled) setInfoError('Sem conexão — recarregue a página.'); });
    return () => { cancelled = true; };
  }, [slug, refId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const phoneDigits = onlyDigits(form.whatsapp);
  const cpfDigits = onlyDigits(form.cpf);
  const canSubmit = form.name.trim().length >= 2 && phoneDigits.length >= 10 &&
    (!cpfDigits || cpfDigits.length === 11) && !sending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setError('');
    try {
      const r = await fetch('/api/tenant-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'referral-signup',
          slug,
          ref: refId,
          name: form.name,
          whatsapp: form.whatsapp,
          cpf: form.cpf,
          modalidade: form.modalidade,
          website
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error || 'Não foi possível concluir o cadastro. Tente de novo.'); return; }
      setDoneName(d?.firstName || form.name.trim().split(/\s+/)[0]);
    } catch {
      setError('Sem conexão — confira a internet e tente de novo.');
    } finally {
      setSending(false);
    }
  };

  const referrerName = info?.referrerFirstName || null;

  // ---- estados de página inteira ----
  if (infoError) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] grid place-items-center px-6">
        <div className="max-w-[360px] text-center">
          <div className="size-12 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
            <Handshake size={22} className="text-slate-400" />
          </div>
          <p className="font-display font-bold text-[17px] text-slate-900">{infoError}</p>
          <p className="text-[13px] text-slate-500 mt-2">Peça um link novo pra quem te indicou.</p>
        </div>
      </div>
    );
  }
  if (!info) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] grid place-items-center">
        <span className="size-8 rounded-full border-[3px] border-slate-200 border-t-brand-600 animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-slate-900 flex flex-col overflow-x-hidden">
      <div className="w-full max-w-[440px] mx-auto flex-1 flex flex-col px-5 pt-6">
        <GymHeader displayName={info.displayName} logoUrl={info.logoUrl} />

        {/* pulseira do convite — a assinatura da página */}
        {referrerName && !doneName && (
          <div className="-mx-8 mt-5 rotate-[-2deg] bg-gradient-to-r from-accent-500 to-accent-600 py-1.5 overflow-hidden whitespace-nowrap shadow-[0_8px_20px_-8px_rgba(255,106,43,.5)]" aria-hidden>
            <span className="font-display font-bold text-[10.5px] tracking-[.18em] text-white uppercase">
              {` convite de ${referrerName} ·`.repeat(8)}
            </span>
          </div>
        )}

        {doneName ? (
          /* ---- sucesso ---- */
          <div className="flex-1 flex flex-col justify-center text-center pb-16 pt-10">
            <div className="size-16 rounded-3xl bg-emerald-100 grid place-items-center mx-auto mb-5">
              <Check size={30} className="text-emerald-600" />
            </div>
            <h1 className="font-display font-bold text-[26px] tracking-tight leading-tight">Pronto, {doneName}!</h1>
            <p className="text-[14px] text-slate-500 mt-2.5 leading-relaxed">
              A equipe da <strong className="text-slate-700">{info.displayName}</strong> vai te chamar no WhatsApp pra combinar seu primeiro treino.
            </p>
            {referrerName && (
              <div className="mt-6 mx-auto flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm text-left">
                <span className="size-8 rounded-full bg-brand-50 text-brand-600 grid place-items-center font-display font-bold text-[13px] shrink-0">
                  {referrerName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <div className="text-[12.5px] font-semibold">Indicação de {referrerName} registrada</div>
                  <div className="text-[11px] text-slate-500">Valeu por vir pelo convite 🤝</div>
                </div>
              </div>
            )}
            <p className="text-[11.5px] text-slate-400 mt-6">Pode fechar esta página.</p>
          </div>
        ) : (
          /* ---- convite + formulário ---- */
          <>
            <div className="mt-6">
              {referrerName ? (
                <>
                  <div className="size-11 rounded-full bg-brand-50 text-brand-600 grid place-items-center font-display font-bold text-[17px] outline outline-2 outline-offset-[3px] outline-brand-500 mb-4">
                    {referrerName.slice(0, 1).toUpperCase()}
                  </div>
                  <h1 className="font-display font-bold text-[24px] tracking-tight leading-[1.18]">
                    {referrerName} treina aqui — <span className="text-brand-600">e chamou você.</span>
                  </h1>
                </>
              ) : (
                <h1 className="font-display font-bold text-[24px] tracking-tight leading-[1.18]">
                  Vem treinar na <span className="text-brand-600">{info.displayName}</span>.
                </h1>
              )}
              <p className="text-[13.5px] text-slate-500 mt-2 leading-relaxed">
                Deixa seu contato que a equipe marca sua primeira visita. Leva menos de um minuto.
              </p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="relative mt-5 bg-white rounded-2xl border border-slate-200 shadow-[0_14px_34px_-14px_rgba(16,21,40,.16)] p-5">
              <label className={labelCls} htmlFor="ref-name">Seu nome</label>
              <input
                id="ref-name" ref={nameRef} className={inputCls} value={form.name}
                onChange={(e) => set({ name: e.target.value })} placeholder="Nome completo" maxLength={120}
              />

              <label className={cn(labelCls, 'mt-3.5')} htmlFor="ref-zap">Seu WhatsApp</label>
              <input
                id="ref-zap" type="tel" inputMode="numeric" className={inputCls} value={fmtPhone(form.whatsapp)}
                onChange={(e) => set({ whatsapp: e.target.value })} placeholder="(51) 9 0000-0000"
              />

              <label className={cn(labelCls, 'mt-3.5')} htmlFor="ref-cpf">
                Seu CPF <span className="text-slate-400 normal-case font-medium tracking-normal">· opcional, agiliza sua matrícula</span>
              </label>
              <input
                id="ref-cpf" inputMode="numeric" className={inputCls} value={fmtCPF(form.cpf)}
                onChange={(e) => set({ cpf: e.target.value })} placeholder="000.000.000-00"
              />

              {(info.modalities || []).length > 0 && (
                <>
                  <div className={cn(labelCls, 'mt-3.5')}>
                    O que você quer treinar? <span className="text-slate-400 normal-case font-medium tracking-normal">· opcional</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {info.modalities.map((m) => {
                      const on = form.modalidade === m;
                      return (
                        <button
                          type="button" key={m}
                          onClick={() => set({ modalidade: on ? '' : m })}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-[12px] font-semibold border transition active:scale-[.97]',
                            on ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          )}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* honeypot — fora da tela; bot preenche, humano não */}
              <input
                type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1} aria-hidden="true" autoComplete="off"
                className="absolute -left-[9999px] top-0 h-0 w-0 opacity-0"
              />

              {error && (
                <div className="mt-3.5 text-[12.5px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={!canSubmit}
                className="mt-4 w-full h-12 rounded-xl font-display font-bold text-[15px] text-white inline-flex items-center justify-center gap-2 transition active:scale-[.98] bg-gradient-to-b from-accent-500 to-accent-600 shadow-[0_12px_26px_-10px_rgba(255,106,43,.65)] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {sending
                  ? <><span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Enviando…</>
                  : <>Quero conhecer a academia <ArrowRight size={16} /></>}
              </button>

              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                <Lock size={12} className="mt-0.5 shrink-0" />
                <span>Seus dados vão só para a academia — nada de spam, prometido.</span>
              </p>
            </form>
          </>
        )}

        <div className="mt-auto py-5 text-center font-display font-semibold text-[9.5px] tracking-[.14em] uppercase text-slate-400">
          feito com <span className="text-brand-600">STRONILEAD</span>
        </div>
      </div>
    </div>
  );
}
