import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadLink } from '../../components/nav/AppLink.jsx';

// A aba Aulas experimentais do perfil (mockup B): o resumo da conversão do
// ciclo e as pessoas do pessoasDasAulas. O registro da aula não guarda se foi
// aula experimental ou freepass (decisão 7 do plano), então a lista mostra a
// última aula, a modalidade e se a pessoa se matriculou.
const COLUNAS = '@[720px]:grid-cols-[minmax(200px,1.5fr)_120px_minmax(140px,1fr)_130px]';

function Numero({ rotulo, children }) {
  return (
    <div>
      <div className="text-[13px] text-muted-foreground">{rotulo}</div>
      <div className="num font-display text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">{children}</div>
    </div>
  );
}

export function AulasTab({ conversao, pessoas, janelaDias, nome }) {
  const p = conversao.professor;
  const a = conversao.academia;
  return (
    <div className="@container overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      {conversao.incompleto && (
        <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13.5px] text-amber-900 md:mx-[22px] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <Info size={17} aria-hidden="true" className="mt-px flex-none text-amber-700 dark:text-amber-300" />
          <p className="m-0">Os registros de aula de antes de setembro de 2026 estão incompletos, então a conta deste ciclo deixa de fora parte das pessoas que vieram.</p>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-7 gap-y-4 border-b border-border px-4 py-5 md:px-[22px]">
        <Numero rotulo="Pessoas na conta">{p.vieram}</Numero>
        <Numero rotulo="Matricularam">
          <span className="text-emerald-700 dark:text-emerald-300">
            {p.matricularam}
            {p.taxa != null && <span className="text-[16px]"> ({p.taxa}%)</span>}
          </span>
        </Numero>
        <Numero rotulo="Academia toda">
          {a.taxa == null ? '—' : `${a.taxa}%`}
          <span className="ml-1.5 text-[14px] font-medium text-muted-foreground">{a.matricularam} de {a.vieram}</span>
        </Numero>
        {conversao.passa != null && (
          <span
            className={cn(
              'inline-flex h-[22px] items-center self-center whitespace-nowrap rounded-[7px] px-2 text-[12px] font-semibold',
              conversao.passa ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
            )}
          >
            {!conversao.passa ? (p.taxa >= a.taxa ? 'Empatou com a academia' : 'Abaixo da academia') : p.taxa > a.taxa ? 'Acima da academia' : 'Dentro da folga'}
          </span>
        )}
        <p className="m-0 max-w-[46ch] text-[13px] text-muted-foreground">
          {p.matricularam} de {p.vieram} pessoas se matricularam. Cada pessoa conta uma vez, com aula experimental e freepass juntos. Só contrato pago conta como matrícula.
        </p>
      </div>

      {pessoas.length === 0 ? (
        <p className="px-[22px] py-7 text-center text-muted-foreground">Ninguém veio a uma aula com {nome} neste ciclo.</p>
      ) : (
        <>
          <div aria-hidden="true" className={cn('hidden h-11 items-center gap-4 border-b border-border px-[22px] text-[12.5px] font-medium text-muted-foreground @[720px]:grid', COLUNAS)}>
            <span>Pessoa</span><span>Última aula</span><span>Modalidade</span><span>Matrícula</span>
          </div>
          <ul aria-label="Aulas experimentais do ciclo" className="m-0 list-none p-0">
            {pessoas.map((quem) => (
              <li
                key={quem.leadId}
                className={cn('grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3 last:border-b-0 @[720px]:min-h-[54px] @[720px]:gap-4 @[720px]:px-[22px] @[720px]:py-2', COLUNAS)}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <LeadLink leadId={quem.leadId} className="truncate font-semibold outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300">
                    {quem.nome || 'Sem nome'}
                  </LeadLink>
                  {quem.naJanela && (
                    <span className="inline-flex h-5 items-center rounded-md bg-brand-50 px-[7px] text-[11.5px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      Nos últimos {janelaDias} dias
                    </span>
                  )}
                </span>
                <span className="num order-3 text-[12.5px] text-muted-foreground @[720px]:order-none @[720px]:text-[14px] @[720px]:text-foreground">
                  {quem.ultima.toLocaleDateString('pt-BR')}
                </span>
                <span className="order-4 text-right text-[12.5px] text-muted-foreground @[720px]:order-none @[720px]:text-left @[720px]:text-[14px] @[720px]:text-foreground">
                  {quem.modalidade || 'Sem modalidade'}
                </span>
                <span className="order-2 text-right @[720px]:order-none @[720px]:text-left">
                  {quem.matriculou
                    ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">Matriculou</span>
                    : <span className="text-muted-foreground">Ainda não</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {pessoas.some((x) => x.naJanela) && (
        <p className="m-0 flex items-start gap-2 border-t border-border px-4 py-3.5 text-[13px] text-muted-foreground md:px-[22px]">
          <Info size={16} aria-hidden="true" className="mt-px flex-none" />
          Quem veio nos últimos {janelaDias} dias aparece na lista, mas ainda não conta na conversão: falta tempo para a pessoa decidir.
        </p>
      )}
    </div>
  );
}
