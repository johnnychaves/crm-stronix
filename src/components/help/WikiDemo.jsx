import { cn } from '../../lib/utils.js';

// Demonstrações da Central de ajuda: mini-telas que repetem a interação real
// em animação de código. Escolhemos isto no lugar de GIF gravado porque não
// pesa nada no carregamento, fica nítido em qualquer tela, acompanha o tema
// claro/escuro e nunca vaza dado de aluno de verdade.
//
// Quando existir gravação real da plataforma, o artigo troca o bloco:
//   { t: 'demo', name: 'pipeline' }  →  { t: 'media', src: '/ajuda/pipeline.gif' }
// (o arquivo vai em public/ajuda/ e o renderer já sabe exibir).
//
// Tudo em CSS puro, com pausa em prefers-reduced-motion.

const KEYFRAMES = `
@keyframes wdSlide { 0%,12% {transform:translate(0,0)} 45%,62% {transform:translate(104px,6px)} 95%,100% {transform:translate(0,0)} }
@keyframes wdType  { 0%,8% {width:0} 55%,100% {width:100%} }
@keyframes wdPop   { 0%,40% {opacity:0;transform:scale(.9)} 55%,100% {opacity:1;transform:scale(1)} }
@keyframes wdFade  { 0%,45% {opacity:1} 60%,100% {opacity:.25} }
@keyframes wdKnob  { 0%,25% {transform:translateX(0)} 45%,100% {transform:translateX(14px)} }
@keyframes wdTrack { 0%,25% {background-color:#CBD5E1} 45%,100% {background-color:#10B981} }
@keyframes wdTab   { 0%,30% {opacity:.45} 45%,100% {opacity:1} }
@keyframes wdSwap  { 0%,45% {opacity:1} 55%,100% {opacity:0} }
@media (prefers-reduced-motion: reduce) { .wd-anim * { animation: none !important } }
`;

const A = (name, dur = '4.5s') => ({ animation: `${name} ${dur} ease-in-out infinite` });

const Screen = ({ children, className }) => (
  <div className={cn('rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] p-3 overflow-hidden', className)}>
    {children}
  </div>
);

const Col = ({ label, children, tone = 'bg-slate-300 dark:bg-slate-600' }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1 mb-1.5">
      <span className={cn('size-1.5 rounded-full', tone)} />
      <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{label}</span>
    </div>
    <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.07] h-[52px] p-1">{children}</div>
  </div>
);

const Card = ({ style, name = 'Ana Prado' }) => (
  <div style={style} className="rounded-md bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 shadow-sm px-1.5 py-1 w-[74px]">
    <div className="text-[8.5px] font-semibold truncate text-slate-700 dark:text-slate-200">{name}</div>
    <div className="h-1 w-8 rounded bg-slate-200 dark:bg-white/10 mt-1" />
  </div>
);

const Field = ({ label, children }) => (
  <div className="mb-1.5">
    <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
    <div className="h-6 rounded-md bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 px-1.5 flex items-center overflow-hidden">
      {children}
    </div>
  </div>
);

const Typed = ({ text }) => (
  <span className="overflow-hidden whitespace-nowrap text-[9.5px] text-slate-700 dark:text-slate-200" style={A('wdType')}>{text}</span>
);

function Body({ name }) {
  switch (name) {
    case 'pipeline':
      return (
        <Screen>
          <div className="flex gap-2">
            <Col label="Contato"><Card style={A('wdSlide', '5s')} /></Col>
            <Col label="Negociação" tone="bg-violet-400" />
            <Col label="Venda" tone="bg-emerald-500" />
          </div>
        </Screen>
      );

    case 'novo-lead':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Novo lead</div>
          <Field label="Nome"><Typed text="João Pereira" /></Field>
          <Field label="WhatsApp"><Typed text="(51) 9 9812-3344" /></Field>
          <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400" style={A('wdPop')}>
            ✓ Número válido e disponível
          </div>
        </Screen>
      );

    case 'ficha':
      return (
        <Screen>
          <div className="flex gap-3 border-b border-slate-200 dark:border-white/[0.08] pb-1.5 mb-2">
            {['Linha do tempo', 'CRM', 'Contratos'].map((t) => (
              <span key={t} className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{t}</span>
            ))}
            <span className="text-[9px] font-bold text-brand-600 dark:text-brand-300 border-b-2 border-brand-600 pb-1.5 -mb-[7px]" style={A('wdTab')}>
              Indicações
            </span>
          </div>
          <div className="flex gap-2" style={A('wdPop')}>
            {[['Indicados', '4'], ['Viraram alunos', '2'], ['Em andamento', '1']].map(([l, v]) => (
              <div key={l} className="flex-1">
                <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">{l}</div>
                <div className="num text-[13px] font-bold text-slate-800 dark:text-slate-100">{v}</div>
              </div>
            ))}
          </div>
        </Screen>
      );

    case 'meta':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Meta diária · hoje</div>
          {[['Ligar para Ana Prado', true], ['Retorno de Bruno Dias', false], ['Aula às 18h · Carla', false]].map(([t, done]) => (
            <div key={t} className="flex items-center gap-1.5 mb-1" style={done ? A('wdFade') : undefined}>
              <span className={cn('size-3 rounded-[4px] grid place-items-center text-[7px] text-white', done ? 'bg-emerald-500' : 'border border-slate-300 dark:border-white/20')}>
                {done ? '✓' : ''}
              </span>
              <span className="text-[9.5px] text-slate-700 dark:text-slate-200">{t}</span>
            </div>
          ))}
        </Screen>
      );

    case 'indicacao-switch':
      return (
        <Screen>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-800 px-2 py-1.5 mb-2">
            <span className="text-[9.5px] font-semibold text-slate-700 dark:text-slate-200">É uma indicação?</span>
            <span className="w-7 h-4 rounded-full p-0.5 flex items-center" style={A('wdTrack')}>
              <span className="size-3 rounded-full bg-white shadow" style={A('wdKnob')} />
            </span>
          </div>
          <div style={A('wdPop')}>
            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Quem indicou?</div>
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-2 py-1.5">
              <span className="size-5 rounded-full bg-emerald-500 text-white grid place-items-center text-[8px] font-bold">M</span>
              <span className="text-[9.5px] font-semibold text-emerald-800 dark:text-emerald-300">Maria Silva</span>
            </div>
          </div>
        </Screen>
      );

    case 'indicacao-link':
      return (
        <Screen>
          <div className="text-[8px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">Link de indicação</div>
          <div className="num text-[9px] text-slate-500 dark:text-slate-400 truncate mb-2">stronilead.app/i/stronix?ref=aB3xY9</div>
          <div className="flex items-center gap-1.5">
            <span className="relative h-6 px-2 rounded-md bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-[9px] font-semibold text-slate-600 dark:text-slate-300 grid place-items-center">
              <span style={A('wdSwap')}>Copiar</span>
              <span className="absolute inset-0 grid place-items-center text-emerald-600 dark:text-emerald-400" style={A('wdPop')}>Copiado ✓</span>
            </span>
            <span className="h-6 px-2 rounded-md bg-emerald-600 text-white text-[9px] font-semibold grid place-items-center">Enviar pro cliente</span>
          </div>
        </Screen>
      );

    case 'busca':
      return (
        <Screen>
          <div className="h-7 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 px-2 flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-slate-400">🔍</span>
            <Typed text="ana pra" />
          </div>
          <div style={A('wdPop')} className="rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 p-1.5">
            {[['Ana Prado', 'Cliente ativo', 'emerald'], ['Ana Prata', 'Lead quente', 'brand']].map(([n, s, c]) => (
              <div key={n} className="flex items-center gap-1.5 px-1 py-1">
                <span className={cn('size-5 rounded-full grid place-items-center text-[8px] font-bold text-white', c === 'emerald' ? 'bg-emerald-500' : 'bg-brand-600')}>
                  {n.slice(0, 1)}
                </span>
                <span className="text-[9.5px] font-medium text-slate-700 dark:text-slate-200 flex-1">{n}</span>
                <span className="text-[8px] text-slate-400">{s}</span>
              </div>
            ))}
          </div>
        </Screen>
      );

    case 'agendar':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Agendar</div>
          <div className="flex gap-1.5 mb-2">
            <span className="flex-1 h-6 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-800 grid place-items-center text-[9px] text-slate-500">Visita</span>
            <span className="flex-1 h-6 rounded-md border-2 border-brand-500 bg-brand-50 dark:bg-brand-500/12 grid place-items-center text-[9px] font-semibold text-brand-700 dark:text-brand-300" style={A('wdPop')}>
              Aula experimental
            </span>
          </div>
          <Field label="Quando"><Typed text="23/08 às 18:00" /></Field>
          <Field label="Professor"><Typed text="Carla Nunes · Musculação" /></Field>
        </Screen>
      );

    case 'desfecho':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Como foi a aula de Ana Prado?</div>
          <div className="flex gap-1.5">
            <span className="flex-1 h-7 rounded-md grid place-items-center text-[9px] font-semibold text-white bg-emerald-500" style={A('wdPop')}>Compareceu</span>
            <span className="flex-1 h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-800 grid place-items-center text-[9px] text-slate-500">Não veio</span>
            <span className="flex-1 h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-800 grid place-items-center text-[9px] text-slate-500">Remarcou</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 dark:text-slate-400" style={A('wdPop')}>
            → Ana avança para <span className="font-semibold text-violet-600 dark:text-violet-400">Negociação</span>
          </div>
        </Screen>
      );

    case 'matricula':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Matrícula</div>
          <Field label="Plano"><Typed text="Trimestral · Musculação" /></Field>
          <Field label="Valor"><Typed text="R$ 297,00" /></Field>
          <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 mt-1" style={A('wdPop')}>
            <span>Vigência</span>
            <span className="num font-semibold text-slate-700 dark:text-slate-200">23/08/2026 → 23/11/2026</span>
          </div>
        </Screen>
      );

    case 'perda':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Por que perdemos?</div>
          <div className="flex flex-wrap gap-1">
            {['Preço', 'Localização', 'Horário', 'Sem retorno'].map((m, i) => (
              <span
                key={m}
                style={i === 0 ? A('wdPop') : undefined}
                className={cn(
                  'px-2 py-1 rounded-full text-[9px] font-semibold border',
                  i === 0
                    ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
                    : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-white/10 text-slate-500'
                )}
              >
                {m}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[9px] text-slate-500 dark:text-slate-400">O motivo vira relatório de perdas.</div>
        </Screen>
      );

    case 'backfill':
      return (
        <Screen>
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2">Indicações sem dono</div>
          <div className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 px-1.5 py-1.5">
            <span className="size-5 rounded-full bg-brand-600 text-white grid place-items-center text-[8px] font-bold">R</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-semibold text-slate-700 dark:text-slate-200 truncate">Rafael Moura</span>
              <span className="block text-[7.5px] text-slate-400">Cadastrado em 12/05 · Negociação</span>
            </span>
            <span className="relative h-5 w-[86px] rounded-md border border-slate-200 dark:border-white/10 grid place-items-center text-[8px] text-slate-400 shrink-0">
              <span style={A('wdSwap')}>Quem indicou?</span>
              <span className="absolute inset-0 grid place-items-center rounded-md bg-emerald-50 dark:bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-semibold" style={A('wdPop')}>
                ✓ Maria Silva
              </span>
            </span>
          </div>
        </Screen>
      );

    default:
      return null;
  }
}

export function WikiDemo({ name, caption }) {
  const body = Body({ name });
  if (!body) return null;
  return (
    // max-w fixo: as animações têm geometria em pixels (o card anda 104px), então
    // esticar a mini-tela numa janela larga desalinharia o movimento.
    <figure className="wd-anim my-3 max-w-[460px]">
      <style>{KEYFRAMES}</style>
      {body}
      {caption && (
        <figcaption className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 text-center">{caption}</figcaption>
      )}
    </figure>
  );
}
