import { useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarDaysBetween, getSafeDateOrNull } from '../../lib/dates.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';

// A aba Carteira do perfil (mockup B): as linhas do carteiraDoCiclo, com as
// pílulas de situação e o aviso de quem não tem CPF. As pílulas e o "Ver quem
// são" são estado da aba, e não do endereço: é um recorte dentro do perfil de
// um professor, e não um filtro de tela.
const SITUACOES = [
  ['todos', 'Todos'],
  ['vencer', 'A vencer'],
  ['renovou', 'Renovou'],
  ['nao', 'Não renovou'],
];
const SITUACAO_TEXTO = { vencer: 'A vencer', renovou: 'Renovou', nao: 'Não renovou', trancado: 'Trancado' };
const SITUACAO_COR = {
  vencer: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 before:bg-amber-500',
  renovou: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 before:bg-emerald-500',
  nao: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 before:bg-rose-500',
  trancado: 'bg-yellow-400/20 text-yellow-800 dark:text-yellow-300 before:bg-yellow-500',
};
// A pílula da linha: o trancado é "A vencer" no filtro, mas a pílula diz Trancado.
const pilulaDe = (l) => (l.situacao === 'vencer' && l.estado === 'trancado' ? 'trancado' : l.situacao);
const COLUNAS = '@[760px]:grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_minmax(170px,1fr)_128px]';
const LINK = 'rounded font-semibold underline outline-none focus-visible:anel-foco';

const dataBr = (d) => getSafeDateOrNull(d)?.toLocaleDateString('pt-BR') ?? null;

function Vencimento({ linha, agora }) {
  const data = dataBr(linha.vence);
  if (!data) return <span className="text-muted-foreground">Sem data</span>;
  if (linha.situacao === 'vencer' && linha.estado === 'trancado') {
    return (
      <>
        <b className="num block font-medium">Trancado</b>
        <small className="block text-[12px] text-muted-foreground">O fim previsto, {data}, anda com o trancamento</small>
      </>
    );
  }
  if (linha.situacao === 'vencer') {
    const dias = calendarDaysBetween(agora, linha.vence);
    return (
      <>
        <b className="num block font-medium">Vence em {data}</b>
        {dias != null && dias <= 30 && (
          <small className="block text-[12px] font-semibold text-amber-700 dark:text-amber-300">
            {dias <= 0 ? 'vence hoje' : dias === 1 ? 'daqui a 1 dia' : `daqui a ${dias} dias`}
          </small>
        )}
      </>
    );
  }
  return (
    <>
      <b className="num block font-medium">Venceu em {data}</b>
      <small className="block text-[12px] text-muted-foreground">{linha.situacao === 'renovou' ? 'Contrato novo em seguida' : 'Saiu da carteira'}</small>
    </>
  );
}

export function CarteiraTab({ linhas, planosById, agora, descricao, professorLogado }) {
  const [filtro, setFiltro] = useState('todos');
  const [soSemCpf, setSoSemCpf] = useState(false);

  const semCpf = linhas.filter((l) => l.semCpf).length;
  const base = soSemCpf ? linhas.filter((l) => l.semCpf) : linhas;
  const conta = (k) => (k === 'todos' ? base.length : base.filter((l) => l.situacao === k).length);
  const lista = filtro === 'todos' ? base : base.filter((l) => l.situacao === filtro);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
          {SITUACOES.map(([k, texto]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filtro === k}
              onClick={() => setFiltro(k)}
              className={cn(
                'inline-flex h-[34px] items-center gap-[7px] rounded-full border px-[13px] text-[13px] font-medium outline-none focus-visible:anel-foco',
                filtro === k
                  ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'border-border bg-card hover:border-brand-200',
              )}
            >
              {texto} <b className="num font-bold">{conta(k)}</b>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">{descricao}</p>
      </div>

      {semCpf > 0 && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13.5px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <Info size={17} aria-hidden="true" className="mt-px flex-none text-amber-700 dark:text-amber-300" />
          <p className="m-0 min-w-0 flex-1">
            {soSemCpf
              ? <>Mostrando só {semCpf === 1 ? 'o aluno' : `os ${semCpf} alunos`} sem CPF no cadastro. </>
              : (
                <>
                  {semCpf === 1
                    ? '1 aluno não tem CPF no cadastro e não consegue responder o NPS. '
                    : `${semCpf} alunos não têm CPF no cadastro e não conseguem responder o NPS. `}
                  {professorLogado ? 'Peça o CPF ao aluno e avise a recepção para completar o cadastro. ' : 'Peça o CPF na recepção e complete o cadastro. '}
                </>
              )}
            <button type="button" className={LINK} onClick={() => setSoSemCpf((v) => !v)}>
              {soSemCpf ? 'Mostrar todos' : 'Ver quem são'}
            </button>
          </p>
        </div>
      )}

      <div className="@container overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
        <div aria-hidden="true" className={cn('hidden h-11 items-center gap-4 border-b border-border px-[22px] text-[12.5px] font-medium text-muted-foreground @[760px]:grid', COLUNAS)}>
          <span>Aluno</span><span>Plano</span><span>Vencimento</span><span>Situação</span>
        </div>
        {lista.length === 0 ? (
          <p className="px-[22px] py-7 text-center text-muted-foreground">Ninguém nesta situação.</p>
        ) : (
          <ul aria-label="Carteira do professor" className="m-0 list-none p-0">
            {lista.map((l) => (
              <li
                key={l.lead.id}
                className={cn('grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3.5 last:border-b-0 @[760px]:min-h-[58px] @[760px]:gap-4 @[760px]:px-[22px] @[760px]:py-2', COLUNAS)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true"><Avatar name={l.lead.name} photoUrl={l.lead.photoUrl || null} size={34} /></span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <LeadLink leadId={l.lead.id} className="truncate font-semibold outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300">
                      {l.lead.name || 'Sem nome'}
                    </LeadLink>
                    {l.semCpf && <span className="inline-flex h-5 items-center rounded-md bg-amber-500/15 px-[7px] text-[11.5px] font-semibold text-amber-800 dark:text-amber-300">Sem CPF</span>}
                  </div>
                </div>
                <span className="order-3 text-[13px] @[760px]:order-none @[760px]:text-[14px]">
                  {planosById.get(l.contrato?.planId)?.name || l.contrato?.planName || 'Plano fora do catálogo'}
                </span>
                <span className="order-4 text-right text-[13px] @[760px]:order-none @[760px]:text-left @[760px]:text-[14px]"><Vencimento linha={l} agora={agora} /></span>
                <span className="order-2 @[760px]:order-none">
                  <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold before:size-1.5 before:rounded-full before:content-['']", SITUACAO_COR[pilulaDe(l)])}>
                    {SITUACAO_TEXTO[pilulaDe(l)]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
