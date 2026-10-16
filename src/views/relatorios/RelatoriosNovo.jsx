// Balão "Novo" do item Relatórios do menu, no molde do das Rotinas. O clique
// abre a apresentação em quatro passos (mockup
// 2026-10-15-relatorios-apresentacao.html, opção B, escolhida pelo Johnny em
// 15/10/2026): onde ficam os cinco relatórios, o período e os filtros, o número
// que vira a lista de nomes, e o Imprimir e o Exportar lista.
//
// Diferente da das Rotinas, ela só abre pelo balão: não abre sozinha ao entrar
// na tela, então não tem o "Não mostrar novamente".
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/utils.js';
import { Button } from '../../components/ui/button.jsx';
import { DialogDescription, DialogTitle } from '../../components/ui/dialog.jsx';
import { NewFeatureBadge } from '../../components/NewFeatureBadge.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';
import { IntroFilters, IntroNumberToNames, IntroOutputs, IntroRail } from './RelatoriosIntroIllustrations.jsx';

// Até quando o balão aparece: uns 30 dias depois do lançamento. Depois disso o
// App passa null e o item volta a ser o link de sempre.
export const NOVO_ATE = '2026-11-15';

// A caixa do pop-up, a mesma da apresentação das Rotinas.
const INTRO_BOX = 'grid-cols-[minmax(0,1fr)] gap-0 rounded-[18px] p-0 sm:max-w-[520px]';

function B({ children }) {
  return <b className="font-semibold text-foreground">{children}</b>;
}

// Os nomes dos submenus saem da lista ao lado, para o texto nunca citar um
// relatório com outro nome: "A, B, C e D".
const NOMES = RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items.map((it) => it.label));
const NOMES_TEXTO = `${NOMES.slice(0, -1).join(', ')} e ${NOMES[NOMES.length - 1]}`;

const PASSOS = [
  {
    title: 'Os relatórios dos seus leads',
    Illustration: IntroRail,
    text: <>Na lista ao lado ficam {NOMES_TEXTO}. O clique num deles abre o relatório.</>,
  },
  {
    title: 'Escolha o período e os filtros',
    Illustration: IntroFilters,
    text: <>No alto da tela, escolha o mês ou um intervalo de dias e filtre por <B>consultor</B>, <B>origem</B> e <B>funil</B>. Cada número vem comparado com o período anterior. Em Leads parados, você escolhe há quantos dias o lead está sem registro.</>,
  },
  {
    title: 'Clique num número para ver os nomes',
    Illustration: IntroNumberToNames,
    text: <>Cada número filtra a lista logo abaixo, com o nome, a origem e a situação de cada lead. As linhas dos recortes, como Por origem e Por consultor, filtram do mesmo jeito. O <B>X</B> do filtro volta para a lista inteira.</>,
  },
  {
    title: 'Imprima ou exporte a lista',
    Illustration: IntroOutputs,
    text: <><B>Imprimir</B> leva só a lista para uma folha A4, com o período e os filtros escritos no topo. <B>Exportar lista</B> baixa uma planilha que abre no Excel.</>,
  },
];

// O pop-up em passos, com o mesmo comportamento do das Rotinas
// (RotinasIntroCarousel): abre sempre no primeiro passo, porque o conteúdo
// sai da tela quando o pop-up fecha; o botão principal é o mesmo elemento em
// todos os passos, para o foco não se perder, e o pop-up abre com o foco nele
// (autoFocus), senão o Radix focaria o primeiro pontinho; o Voltar some no
// primeiro passo (hidden, que não ocupa lugar), e quem volta para ele leva o
// foco ao botão principal; a etapa, o título e o texto moram numa região
// aria-live polite e atomic só, para o leitor de tela ler o passo novo uma vez.
//
// No último passo o botão principal é "Abrir Relatórios", que fecha e leva à
// tela (href). Quem já está nos Relatórios recebe href null e vê "Entendi",
// que só fecha, para não perder o submenu e os filtros em que está.
//
// No celular o quadro do desenho cresce com ele (h-auto, mínimo de 230px) e
// deixa 40px no alto para o X. A partir do sm o quadro tem 276px e o corpo do
// texto tem a altura do passo mais alto (146px, medida nos passos 2 e 3 com a caixa
// de 520px), para o rodapé não pular e o Próximo ficar sob o mouse. Mudou o
// texto de um passo? Meça de novo.
function RelatoriosIntroCarousel({ close, href }) {
  const [step, setStep] = useState(0);
  const primaryRef = useRef(null);
  const navigate = useNavigate();
  const passo = PASSOS[step];
  const last = step === PASSOS.length - 1;
  const Illustration = passo.Illustration;

  const primary = () => {
    if (!last) {
      setStep((s) => s + 1);
      return;
    }
    close();
    if (href) navigate(href);
  };
  const back = () => {
    if (step === 1) primaryRef.current?.focus();
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <>
      <div
        data-ilustracao=""
        aria-hidden="true"
        className="grid h-auto min-h-[230px] place-items-center overflow-hidden border-b border-border bg-brand-600/[0.05] px-4 pb-5 pt-10 sm:h-[276px] sm:px-[22px] dark:bg-brand-500/[0.08]"
      >
        <div key={step} className="flex w-full justify-center animate-in fade-in-0 duration-300 motion-reduce:animate-none">
          <Illustration />
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true" className="px-6 pb-1.5 pt-5 sm:min-h-[146px]">
        <p className="text-[12px] font-semibold text-brand-600 dark:text-brand-300">{step + 1} de {PASSOS.length}</p>
        <DialogTitle className="mt-1.5 font-display text-[21px] font-semibold leading-tight tracking-tight">{passo.title}</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{passo.text}</DialogDescription>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-5 pt-4">
        <div role="group" aria-label="Passos" className="flex items-center gap-1.5">
          {PASSOS.map((p, i) => (
            <button
              key={p.title}
              type="button"
              aria-label={p.title}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
              className={cn(
                'relative h-2 rounded-full transition-[width,background-color] duration-200 after:absolute after:-inset-x-[3px] after:-inset-y-2 motion-reduce:transition-none',
                i === step ? 'w-[22px] bg-brand-600' : 'w-2 bg-slate-200 dark:bg-white/15',
              )}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={back} className={cn('border-border', step === 0 && 'hidden')}>
            Voltar
          </Button>
          <Button ref={primaryRef} autoFocus type="button" onClick={primary}>
            {!last ? 'Próximo' : href ? 'Abrir Relatórios' : 'Entendi'}
          </Button>
        </div>
      </div>
    </>
  );
}

// `tone`, `now` e `className` vão direto para o NewFeatureBadge. `href` é o
// endereço dos Relatórios, ou null para quem já está na tela.
export function RelatoriosNovo({ href = null, ...props }) {
  return (
    <NewFeatureBadge
      {...props}
      until={NOVO_ATE}
      contentClassName={INTRO_BOX}
      renderContent={({ close }) => <RelatoriosIntroCarousel close={close} href={href} />}
    />
  );
}
