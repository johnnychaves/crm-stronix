import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog.jsx';
import { NewFeatureBadge } from '../NewFeatureBadge.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { markRotinasIntroSeen } from '../../lib/rotinasIntro.js';
import { dismissRotinasIntro } from '../../lib/rotinasWrites.js';
import { IntroAddTasks, IntroCheck, IntroCreateModel, IntroFollowers, IntroToday, IntroWhat } from './IntroIllustrations.jsx';

// O balão "Novo" da tela Rotinas, no item Rotinas do menu lateral (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C, em vermelho). O clique no
// balão abre a apresentação em seis passos (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Pop-up 1, escolhido pelo Johnny
// em 08/10/2026, com o passo da aba Hoje do 2026-10-08-rotinas-aba-hoje.html);
// o clique no resto do item abre a tela.
//
// A mesma apresentação abre sozinha quando o gestor entra em Rotinas
// (RotinasIntroDialog, que a RotinasView monta), uma vez por sessão, até ele
// marcar "Não mostrar novamente" no último passo. Quando abre sozinha e quando
// abre pelo balão, ela conta como vista nesta sessão, e o botão do último passo
// grava a dispensa nos dois casos. A regra mora em src/lib/rotinasIntro.js.

// Último dia do balão "Novo" (e do ponto vermelho do menu recolhido): aparece
// por 30 dias depois do lançamento.
export const NOVO_ATE = '2026-11-07';

function B({ children }) {
  return <b className="font-semibold text-foreground">{children}</b>;
}

// A caixa do pop-up. O balão a passa ao NewFeatureBadge, que põe na frente a
// altura máxima, a rolagem e a borda (DIALOG_BASE); o RotinasIntroDialog monta
// a mesma caixa, e o teste confere que as duas saem iguais.
const INTRO_BOX = 'grid-cols-[minmax(0,1fr)] gap-0 rounded-[18px] p-0 sm:max-w-[520px]';
const DIALOG_BASE = 'max-h-[calc(100dvh-2rem)] overflow-y-auto border-border';

const DISMISS_FAILED = 'Não deu para salvar. A apresentação pode aparecer de novo.';

// Os passos, com os textos aprovados no mockup.
const PASSOS = [
  {
    kicker: 'Novidade',
    title: 'O que é a rotina',
    Illustration: IntroWhat,
    text: <>São as tarefas que o consultor faz todo dia e que <B>não dependem de um lead</B>, como abrir a recepção, postar o story da aula ou atualizar o Stronilead antes de sair.</>,
    points: [
      'Você monta a lista uma vez, num modelo.',
      'Ela aparece todo dia na Meta diária de quem segue o modelo, num cartão à parte.',
      'O consultor marca o que fez. A meta de leads não muda, e a rotina não conta para o dia batido.',
    ],
  },
  {
    kicker: 'Como configurar · 1 de 4',
    title: 'Crie um modelo',
    Illustration: IntroCreateModel,
    text: <>Aqui em Rotinas, clique em <B>Novo modelo</B> e dê um nome, como "Consultor manhã". Pode começar em branco ou copiar um modelo que já existe.</>,
  },
  {
    kicker: 'Como configurar · 2 de 4',
    title: 'Coloque as tarefas',
    Illustration: IntroAddTasks,
    text: <>Dentro do modelo, clique em <B>Nova tarefa</B>. Escreva o que fazer, explique como fazer se precisar, escolha os dias e, se quiser, o horário.</>,
  },
  {
    kicker: 'Como configurar · 3 de 4',
    title: 'Escolha quem segue',
    Illustration: IntroFollowers,
    text: <>Na lista <B>Consultores</B>, escolha o modelo de cada pessoa. Cada consultor segue um modelo só, e um modelo pode ter várias pessoas. Para alguém com uma rotina diferente, duplique o modelo e ajuste a cópia.</>,
  },
  {
    kicker: 'Como configurar · 4 de 4',
    title: 'Pronto: o consultor dá check',
    Illustration: IntroCheck,
    text: <>No mesmo dia, a rotina aparece na <B>Meta diária</B> do consultor. A tarefa com horário fica em destaque até 30 minutos depois e, passado isso, aparece como atrasada. Ele marca o que fez e pode deixar uma observação.</>,
    good: <><B>Bom saber:</B> o que você muda num modelo vale a partir de hoje. Os dias anteriores ficam como estavam.</>,
  },
  {
    kicker: 'Acompanhar',
    title: 'Acompanhe o dia na aba Hoje',
    Illustration: IntroToday,
    text: <>Na aba <B>Hoje</B>, aqui em Rotinas, você vê quanto cada consultor já fez, o que está <B>atrasado agora</B> e as observações que eles deixaram. A tela se atualiza sozinha. Você acompanha, mas o check é sempre de quem fez a tarefa.</>,
  },
];

// O pop-up em passos. Abre sempre no primeiro: o conteúdo do pop-up sai da
// tela quando ele fecha. O botão principal é o mesmo elemento em todos os
// passos ("Ver como configurar", "Próximo" e, no último, "Entendi", que
// fecha), para o foco não se perder na troca. O Voltar fica invisível no
// primeiro passo (hidden, e não invisible: o invisible ainda ocupa lugar e, no
// celular, alargava o rodapé além da caixa), e quem volta para ele leva o foco
// ao botão principal. O pop-up abre com o foco nesse botão (autoFocus): sem
// isso o Radix foca o primeiro elemento, que é o primeiro pontinho. A etapa, o
// título e o texto do passo moram juntos numa região aria-live polite e atomic,
// que é o mesmo nó em todos os passos, para o leitor de tela ler o passo novo
// uma vez só. A descrição do pop-up continua sendo só o texto.
//
// No celular o quadro do desenho cresce com ele (h-auto, mínimo de 200px) e
// deixa 40px no alto, para o X do pop-up não ficar em cima do canto do cartão.
// A partir do sm o quadro tem 250px e o corpo do texto tem a altura do passo
// mais alto (294px, medido no primeiro passo, com a caixa de 520px), para o
// rodapé não pular de um passo para o outro e o Próximo ficar sob o mouse.
// Mudou um texto de passo? Meça de novo: o passo mais alto tem de caber.
//
// No último passo, antes do Voltar, vem o "Não mostrar novamente", só quando há
// cadastro para gravar (appUser). Ele fecha na hora e grava em segundo plano; se
// a gravação falha, o aviso diz que a apresentação pode voltar. O Entendi, o X e
// o Esc só fecham. No celular o botão ocupa a linha dele (basis-full) em cima
// do Voltar e do Entendi, que continuam juntos na ponta direita; a partir do sm
// os três ficam na mesma linha. A ordem do Tab é a da tela.
function RotinasIntroCarousel({ close, db, appUser }) {
  const [step, setStep] = useState(0);
  const primaryRef = useRef(null);
  const toast = useToast();
  const passo = PASSOS[step];
  const last = step === PASSOS.length - 1;
  const Illustration = passo.Illustration;
  const canDismiss = Boolean(appUser?.id);

  // Aberta pelo balão ou sozinha, a apresentação conta como vista nesta sessão.
  useEffect(() => {
    if (appUser?.id) markRotinasIntroSeen(appUser);
  }, [appUser]);

  const dismissForever = () => {
    markRotinasIntroSeen(appUser);
    close();
    dismissRotinasIntro({ db, userId: appUser.id }).catch(() => toast.error(DISMISS_FAILED));
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
        className="grid h-auto min-h-[200px] place-items-center overflow-hidden border-b border-border bg-gradient-to-b from-brand-600/[0.08] to-transparent px-4 pb-4 pt-10 sm:h-[250px] sm:py-0"
      >
        <div key={step} className="flex w-full justify-center animate-in fade-in-0 duration-300 motion-reduce:animate-none">
          <Illustration />
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true" className="min-h-[168px] px-6 py-5 sm:min-h-[294px]">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">{passo.kicker}</p>
        <DialogTitle className="mt-1.5 font-display text-[21px] font-semibold leading-tight tracking-tight">{passo.title}</DialogTitle>
        <DialogDescription asChild className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          <div>
            <p>{passo.text}</p>
            {passo.points && (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {passo.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-foreground">
                    <Check aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
            {passo.good && <p className="mt-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-[12px]">{passo.good}</p>}
          </div>
        </DialogDescription>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 px-6 pb-5">
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {last && canDismiss && (
            <Button type="button" variant="ghost" onClick={dismissForever} className="basis-full justify-end px-3 text-[13px] text-muted-foreground sm:basis-auto sm:justify-center">
              Não mostrar novamente
            </Button>
          )}
          <Button type="button" variant="outline" onClick={back} className={cn('border-border', step === 0 && 'hidden')}>
            Voltar
          </Button>
          <Button ref={primaryRef} autoFocus type="button" onClick={last ? close : () => setStep((s) => s + 1)}>
            {step === 0 ? 'Ver como configurar' : last ? 'Entendi' : 'Próximo'}
          </Button>
        </div>
      </div>
    </>
  );
}

// `tone`, `now` e `className` vão direto para o NewFeatureBadge. `db` e
// `appUser` são de quem está logado, para o "Não mostrar novamente".
export function RotinasNovo({ db, appUser, ...props }) {
  return (
    <NewFeatureBadge
      {...props}
      until={NOVO_ATE}
      contentClassName={INTRO_BOX}
      renderContent={({ close }) => <RotinasIntroCarousel close={close} db={db} appUser={appUser} />}
    />
  );
}

// A apresentação que abre sozinha ao entrar em Rotinas (RotinasView). É a do
// balão, na mesma caixa, sem o balão: quem decide se abre é a tela, pela
// shouldAutoOpenRotinasIntro.
export function RotinasIntroDialog({ open, onOpenChange, db, appUser }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* border-border: o `border` do DialogContent sozinho pega a cor do texto e fica branco no escuro. */}
      <DialogContent className={cn(DIALOG_BASE, INTRO_BOX)}>
        <RotinasIntroCarousel close={() => onOpenChange(false)} db={db} appUser={appUser} />
      </DialogContent>
    </Dialog>
  );
}
