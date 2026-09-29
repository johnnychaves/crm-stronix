import { Building2, Calendar, Check, Shield, TrendingUp, Zap } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Moldura das telas de entrada (login e "Esqueci a senha"): o painel azul da
// esquerda, a marca no celular e o rodapé. O formulário entra como children.
// Saiu do LoginScreen sem mudar o visual.
function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper-50 dark:bg-ink-950 text-gray-900 dark:text-white">
      {/* ===== Painel de marca (esquerda) ===== */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-950 text-white p-10 xl:p-12">
        <div className="absolute inset-0 brandgrid opacity-60" aria-hidden="true"></div>
        <div className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-brand-600/40 glow" aria-hidden="true"></div>
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-accent-500/20 glow" aria-hidden="true"></div>

        {/* topo: wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-white/10 ring-1 ring-white/15">
            <SurgeMark size={26} tone="onDark" />
          </span>
          <div>
            <StronileadWordmark className="text-[18px] text-white" leadOnDark />
            <div className="text-[11.5px] text-white/55 -mt-0.5">Gestão de leads para academias</div>
          </div>
        </div>

        {/* centro: cards flutuantes de preview */}
        <div className="relative z-10 my-8 h-[300px]">
          <div className="floaty absolute left-2 top-4 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 p-4 w-[200px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">Leads no mês</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white">1.284</span>
              <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 num inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+12%</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: '72%' }}></div>
            </div>
          </div>

          <div className="floaty2 absolute right-0 top-24 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 p-3.5 w-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">Meta diária</span>
              <span className="num text-[11px] font-bold text-brand-600 dark:text-brand-300">86%</span>
            </div>
            <div className="mt-2.5 space-y-2">
              {[['Mariana Costa', 'bg-emerald-500'], ['Bruno Tavares', 'bg-brand-500'], ['Júlia Pacheco', 'bg-accent-500']].map(([n, c], i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full grid place-items-center text-white ${c}`}><Check className="w-3 h-3" /></span>
                  <span className="text-[12px] text-slate-700 dark:text-slate-200 font-medium">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute left-6 bottom-2 floaty2 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 px-4 py-3 w-[210px]">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-accent-500/15 text-accent-500 grid place-items-center"><Calendar className="w-4 h-4" /></span>
              <div>
                <div className="num text-[18px] font-semibold text-slate-900 dark:text-white leading-none">7 visitas</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">agendadas hoje</div>
              </div>
            </div>
          </div>
        </div>

        {/* base: headline */}
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-[26px] xl:text-[30px] font-semibold leading-tight tracking-tight">
            Transforme cada lead em matrícula.
          </h2>
          <p className="mt-3 text-[14px] text-white/60 leading-relaxed">
            Pipeline, meta diária e agendamentos num só lugar. Sua equipe focada no que importa: fechar.
          </p>
          <div className="mt-6 flex items-center gap-5 text-[12px] text-white/50">
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Dados criptografados</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Pipeline em tempo real</span>
          </div>
        </div>
      </div>

      {/* ===== Formulário (direita) ===== */}
      <div className="relative flex flex-col min-h-screen lg:min-h-0 px-6 py-8 sm:px-10 bg-paper-50 dark:bg-ink-950">
        {/* wordmark mobile */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <SurgeMark size={22} />
          <StronileadWordmark className="text-[16px]" />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[380px] mx-auto rise">
            {children}
          </div>
        </div>

        <div className="pt-8 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400 dark:text-neutral-500">
          <Shield className="w-3.5 h-3.5" /> Conexão segura · STRONILEAD © 2026
        </div>
      </div>
    </div>
  );
}

// A etiqueta com o nome da academia, no topo do formulário.
function AuthTenantChip({ name }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08] px-2.5 py-1 text-[12px] font-semibold text-brand-700 dark:text-brand-300">
      <Building2 className="w-3.5 h-3.5" /> {name}
    </div>
  );
}

export { AuthLayout, AuthTenantChip };
