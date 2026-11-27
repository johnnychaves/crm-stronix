import { useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fromDateInputValue, toDateInputValue } from '../../lib/dates.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { pedacoTexto } from './criterios.js';

// A aba Aderência do perfil (mockup B do perfil): a nota do ano com cada
// semestre e, embaixo, as semanas agrupadas por semestre, da mais nova para a
// mais antiga, com a taxa, quantos vieram uma vez e quantos não vieram, e o
// "Ver quem chamar" com os nomes. Antes da primeira importação, "Sem dados ainda".
const CARD = 'rounded-[18px] border border-border bg-card shadow-card';
const FLAG = 'inline-flex h-[22px] items-center rounded-[7px] px-2 text-[12px] font-semibold';
const LINK = 'rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300';
const ddmm = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const sextaDe = (iso) => {
  const d = fromDateInputValue(iso);
  return ddmm(toDateInputValue(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 4)));
};
function SeloDaFaixa({ taxa, min, max }) {
  if (taxa == null) return null;
  if (taxa < min) return <span className={cn(FLAG, 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200')}>Abaixo da meta</span>;
  return <span className={cn(FLAG, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300')}>{taxa > max ? 'Acima da meta' : 'Dentro da meta'}</span>;
}

function Pessoas({ titulo, ids, leadsById }) {
  return (
    <div>
      <b className="text-[13px]">{titulo}</b>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
        {ids.length === 0 ? <li className="text-[13px] text-muted-foreground">Ninguém</li> : ids.map((id) => {
          const lead = leadsById.get(id);
          const nome = String(lead?.name || 'Aluno').trim();
          return (
            <li key={id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-[13px]">
              <span aria-hidden="true"><Avatar name={nome} photoUrl={lead?.photoUrl || null} size={26} /></span>
              <LeadLink leadId={id} className="rounded font-medium outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300">{nome}</LeadLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AderenciaTab({ linhas, resumo, barra, meta, faixaMax, semestral = false, leadsById, professorLogado, primeiroNome }) {
  const [aberta, setAberta] = useState(null);
  // A meta é a do nível de agora; sem nível ou com a meta em branco, a aba
  // não mostra meta.
  const faixaMin = meta;

  if (!linhas.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-[13.5px] text-muted-foreground">
        <b className="block text-foreground">Sem dados ainda.</b>
        {professorLogado ? 'A sua turma' : `A turma de ${primeiroNome}`} ainda não tem presença importada. Hoje o relatório importado da Next Fit é o das aulas de funcional, então a aderência só aparece para quem dá essas aulas.
      </div>
    );
  }

  const fechados = resumo.semestres.filter((s) => s.fechado && s.taxa != null).length;
  // No semestral com o período aberto, o número é a taxa até agora, como no placar.
  const numero = semestral && resumo.nota == null ? resumo.taxa : resumo.nota;
  const andamento = semestral && resumo.nota == null && resumo.emAndamento;
  // Um grupo por pedaço do período, do mais novo para o mais antigo, e no fim
  // as semanas fora de qualquer pedaço (o dezembro), que não entram na conta.
  const noPedaco = (l, p) => { const d = fromDateInputValue(l.semana); return d >= p.inicio && d < p.fim; };
  const grupos = [...resumo.semestres].reverse().map((p) => ({ g: pedacoTexto(p), ls: linhas.filter((l) => noPedaco(l, p)) }));
  grupos.push({ g: 'Fora da conta, dezembro', ls: linhas.filter((l) => !resumo.semestres.some((p) => noPedaco(l, p))) });
  const gruposComSemana = grupos.filter((x) => x.ls.length);
  const somaDoGrupo = (ls) => ls.reduce((a, l) => ({ contam: a.contam + l.contam, aderentes: a.aderentes + l.aderentes, uma: a.uma + l.umaPresenca, zero: a.zero + l.nenhuma }), { contam: 0, aderentes: 0, uma: 0, zero: 0 });

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={semestral ? 'Aderência do período' : 'Aderência do ano'} className={cn(CARD, 'grid gap-4 px-5 py-[18px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:px-[22px]')}>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted-foreground">{semestral ? 'Aderência do período' : 'Aderência do ano'} {faixaMin != null && <SeloDaFaixa taxa={numero} min={faixaMin} max={faixaMax} />}</div>
          <div className={cn('num mb-1.5 mt-2 font-display text-[44px] font-bold leading-none tracking-[-0.03em]', numero == null && 'text-[28px] text-muted-foreground')}>
            {numero == null ? (semestral ? 'Sem dados no período' : 'Sem semestre fechado') : `${numero}%`}
            {andamento && <span className="ml-2 align-middle font-sans text-[13px] font-semibold tracking-normal text-muted-foreground">em andamento</span>}
          </div>
          <p className="m-0 text-[13px] text-muted-foreground">
            {semestral
              ? (resumo.nota == null ? 'A nota sai quando o período fechar.' : 'Soma das semanas do período.')
              : fechados === 2 ? 'Média dos dois semestres.' : fechados === 1 ? 'Só um semestre fechou, então a nota do ano é a dele.' : 'A nota do ano sai quando o primeiro semestre fechar.'} Dezembro fica fora.{faixaMin != null && ` Meta: ${faixaMin}% a ${faixaMax}%, do nível de agora.`}
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {resumo.semestres.map((s, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-xl bg-muted/60 px-3.5 py-2.5">
              <span className="text-[13.5px] font-semibold">{pedacoTexto(s)}{!s.fechado && s.taxa != null ? ', em andamento' : ''}</span>
              <b className="num font-display text-[18px]">{s.taxa == null ? '–' : `${s.taxa}%`}</b>
              <small className="num col-span-2 text-[12px] text-muted-foreground">{s.aderentes} de {s.contam} aluno-semanas</small>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ader-semanas" className={cn(CARD, 'overflow-hidden')}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 md:px-[22px]">
          <div>
            <h3 id="ader-semanas" className="m-0 font-display text-[16px] font-bold">Semanas com {barra} ou mais aulas</h3>
            <p className="mb-0 mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
              A semana do aluno vai de segunda a sexta e conta como aderente com {barra} ou mais aulas de funcional. Ficam fora a semana de trancamento e a primeira semana do contrato.
            </p>
          </div>
          {faixaMin != null && <p className="m-0 inline-flex items-center gap-2 text-[13px] text-muted-foreground"><span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[3px] bg-emerald-400/40" />Meta: {faixaMin}% a {faixaMax}%</p>}
        </div>
        {gruposComSemana.map(({ g, ls }) => {
          const t = somaDoGrupo(ls);
          const taxa = t.contam ? Math.round((t.aderentes / t.contam) * 100) : null;
          return (
            <div key={g}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-y border-border bg-muted/40 px-5 py-3 text-[13px] md:px-[22px]">
                <b className="text-[14.5px]">{g}</b>
                <span className="num text-muted-foreground">{taxa == null ? '' : `${taxa}% aderentes, ${t.aderentes} de ${t.contam} aluno-semanas. `}{t.uma} com 1 presença e {t.zero} sem nenhuma.</span>
              </div>
              <ul className="m-0 list-none p-0">
                {ls.map((l) => {
                  const aberto = aberta === l.semana;
                  return (
                    <li key={l.semana} className="border-b border-border last:border-b-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 md:grid-cols-[150px_110px_minmax(120px,1fr)_120px_120px_auto] md:px-[22px]">
                        <span className="num font-semibold">{ddmm(l.semana)} a {sextaDe(l.semana)}</span>
                        <span className="num text-right md:text-left"><b className="font-display text-[17px]">{l.taxa == null ? '–' : `${l.taxa}%`}</b> <small className="text-[12px] text-muted-foreground">{l.aderentes} de {l.contam}</small></span>
                        <span role="img" aria-label={faixaMin != null ? `${l.taxa ?? 0}%, meta de ${faixaMin}% a ${faixaMax}%` : `${l.taxa ?? 0}%`} className="relative col-span-2 h-2 rounded-full bg-muted md:col-span-1">
                          {faixaMin != null && <span className="absolute inset-y-0 rounded-sm bg-emerald-400/35" style={{ left: `${faixaMin}%`, right: `${100 - faixaMax}%` }} />}
                          <i className="relative block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, l.taxa ?? 0)}%` }} />
                        </span>
                        <span className="num text-[13px]"><b>{l.umaPresenca}</b> com 1 presença</span>
                        <span className="num text-[13px]"><b>{l.nenhuma}</b> sem nenhuma</span>
                        <button type="button" aria-expanded={aberto} onClick={() => setAberta(aberto ? null : l.semana)} className={cn(LINK, 'justify-self-end')}>
                          {aberto ? 'Esconder nomes' : 'Ver quem chamar'}
                        </button>
                      </div>
                      {aberto && (
                        <div className="grid gap-4 bg-brand-50/40 px-5 pb-4 pt-3 md:grid-cols-2 md:px-[22px] dark:bg-brand-500/5">
                          <Pessoas titulo="Vieram 1 vez" ids={l.umaIds} leadsById={leadsById} />
                          <Pessoas titulo="Não vieram" ids={l.nenhumaIds} leadsById={leadsById} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <p className="m-0 flex items-start gap-2 text-[12.5px] text-muted-foreground">
        <Info size={15} aria-hidden="true" className="mt-px flex-none" />
        {professorLogado
          ? 'As presenças vêm do relatório de Presenças da Next Fit, importado toda semana. Quem não tem CPF no cadastro não entra na conta.'
          : `As presenças vêm do relatório de Presenças da Next Fit, importado toda semana. A carteira é a de ${primeiroNome} no Stronilead, e quem não tem CPF no cadastro não entra na conta.`}
      </p>
    </div>
  );
}
