import { BookOpen, Ticket } from 'lucide-react';
import { FREEPASS_KINDS, freepassChoiceText, freepassLongText, freepassQuantityText } from '../../lib/visitante.js';
import { StageHead, WizardOption } from './WizardLayout.jsx';

// O passo Freepass do Agendar (mockup A, #passo-freepass), com o cabeçalho que
// muda pela situação. `choice` é a escolha que a ficha calcula
// (freepassChoiceFor): usar o freepass que corre, lançar um tipo ou aula
// avulsa, ou { kind: 'loading' } enquanto os dados chegam. A escolha vai para
// values.freepass pelo `set` do assistente.

function headOf(choice, mod, nome) {
  if (!choice || choice.kind === 'loading') return { title: 'Freepass', hint: 'Conferindo os freepass da pessoa.' };
  if (choice.kind === 'use') {
    return choice.moving
      ? { title: `A aula continua no freepass de ${nome}`, hint: 'A aula que você está remarcando já está nesse freepass.' }
      : { title: `A aula entra no freepass de ${nome}`, hint: `${nome} já tem um freepass de ${mod} correndo.` };
  }
  if (choice.kind === 'launch') return { title: `Qual freepass de ${mod}?`, hint: `${nome} nunca teve freepass de ${mod}. O freepass nasce junto com a aula.` };
  const hint = {
    repeated: `${nome} já usou o freepass de ${mod}.`,
    full: `O freepass de ${mod} já tem todas as aulas marcadas.`,
    noType: `${nome} não tem freepass para escolher.`,
  }[choice.reason] || `${nome} não tem freepass correndo em ${mod}.`;
  return { title: 'Essa aula fica avulsa', hint };
}

// O andamento do cartão: "1 de 2 agendadas" no por aulas, os dias no por dias.
const progressOf = (fp) => (fp.kind === FREEPASS_KINDS.AULAS ? `${fp.aulas ?? 0} de ${fp.total} agendadas` : freepassLongText(fp));

const launchHint = (tp) => (tp.kind === FREEPASS_KINDS.AULAS && tp.quantity > 1
  ? `${tp.quantity} aulas, você marca todas agora`
  : freepassQuantityText(tp));

// allowAvulsa falso (o "Agendar" do cartão do freepass): a aula só entra no freepass.
export function FreepassStep({ choice, values, set, tone, firstName, allowAvulsa = true }) {
  const nome = firstName || 'O lead';
  const mod = values.modalidade || '';
  const head = headOf(choice, mod, nome);
  const isSel = (key) => values.freepass?.key === key;
  const avulsa = (hint) => allowAvulsa && (
    <WizardOption tone={tone} Icon={BookOpen} label="Aula avulsa" hint={hint} selected={isSel('avulsa')}
      onClick={() => set('freepass', { key: 'avulsa', kind: 'avulsa', label: 'Avulsa' })} />
  );

  let body;
  if (!choice || choice.kind === 'loading') {
    body = <p className="text-[13px] text-muted-foreground">Carregando os freepass…</p>;
  } else if (choice.kind === 'use') {
    const fp = choice.freepass;
    body = (
      <div className="grid max-w-[440px] gap-2.5">
        <WizardOption tone={tone} Icon={Ticket} label={`${choice.moving ? 'Continuar no' : 'Usar o'} freepass ${fp.typeName}`} hint={progressOf(fp)} selected={isSel('use')}
          onClick={() => set('freepass', { key: 'use', kind: 'use', freepassId: fp.id, moving: Boolean(choice.moving), label: fp.typeName })} />
        {avulsa(fp.kind === FREEPASS_KINDS.AULAS ? `Sem freepass. Não conta nas ${fp.total} aulas.` : 'Sem freepass.')}
      </div>
    );
  } else if (choice.kind === 'launch') {
    body = (
      <div className="max-w-[520px]">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {choice.types.map((tp) => (
            <WizardOption key={tp.id} tone={tone} Icon={Ticket} hint={launchHint(tp)} selected={isSel(`launch:${tp.id}`)}
              label={<>{tp.name}{tp.padrao && <>{' '}<span className="inline-flex h-5 items-center rounded-full bg-teal-100 px-2 align-middle text-[11.5px] font-semibold text-teal-800 dark:bg-teal-500/15 dark:text-teal-300">Padrão</span></>}</>}
              onClick={() => set('freepass', { key: `launch:${tp.id}`, kind: 'launch', typeId: tp.id, typeKind: tp.kind, quantity: tp.quantity, label: tp.name })} />
          ))}
          {avulsa('Sem freepass')}
        </div>
        <p className="mt-3 text-[12.5px] text-muted-foreground">{nome} vira Visitante quando você confirmar o agendamento.</p>
      </div>
    );
  } else {
    body = (
      <div className="max-w-[440px]">
        {avulsa('Sem freepass')}
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{freepassChoiceText(choice, mod)}</p>
        {choice.reason === 'repeated' && <p className="mt-3 text-[12.5px] text-muted-foreground">O gestor ainda pode lançar um freepass novo pela aba Contratos.</p>}
      </div>
    );
  }

  return (
    <>
      <StageHead title={head.title} hint={head.hint} />
      {body}
    </>
  );
}
