import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { carteiraAt } from '../../lib/professor/carteira.js';
import { RESPOSTAS_MINIMAS } from '../../lib/professor/nps.js';
import { principalDe, progressoDaTurma } from '../../lib/professor/pesquisas.js';
import { useNpsRespostas } from '../../hooks/useNpsDados.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { notaTexto } from './criterios.js';
import { periodoTexto } from './pesquisasTexto.js';

// A aba NPS do perfil (mockup B do perfil): a nota do ano, a escolha da
// pesquisa, a pergunta principal com o histograma, as respostas contra a
// turma e as outras perguntas. Só o gestor vê quem respondeu (notas e
// comentário) e quem ainda não respondeu; o professor vê só os totais.
const CARD = 'rounded-[18px] border border-border bg-card px-5 py-[18px] shadow-card md:px-[22px]';
const ROTULO = 'flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted-foreground';
const FLAG = 'inline-flex h-[22px] items-center rounded-[7px] px-2 text-[12px] font-semibold';
const tomDaNota = (n) => (n >= 9 ? 'p' : n >= 7 ? 'n' : 'x');
const COR = { p: 'bg-emerald-500', n: 'bg-amber-400', x: 'bg-rose-500' };
const COR_TEXTO = {
  p: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
  n: 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
  x: 'bg-rose-50 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200',
};
const sinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
const diaCurto = (ts) => getSafeDateOrNull(ts)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) ?? null;

function SeloDaMeta({ nota, meta }) {
  if (nota == null) return null;
  return nota >= meta
    ? <span className={cn(FLAG, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300')}>Nota de promotor</span>
    : <span className={cn(FLAG, 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200')}>Abaixo da meta</span>;
}

function Histograma({ porNota }) {
  const contagem = Array.from({ length: 11 }, (_, i) => Number(porNota?.[i]) || 0);
  const maior = Math.max(1, ...contagem);
  const rotulo = contagem.map((k, i) => (k ? `${k} ${k === 1 ? 'deu' : 'deram'} ${i}` : '')).filter(Boolean).join(', ');
  return (
    <div role="img" aria-label={rotulo || 'Sem notas'} className="mt-1.5 grid h-[104px] grid-cols-11 items-end gap-1.5">
      {contagem.map((k, i) => (
        <div key={i} className="flex flex-col items-center justify-end gap-1">
          <span className="num text-[11px] text-muted-foreground">{k || ''}</span>
          <i className={cn('block w-full rounded-t-[4px]', k ? COR[tomDaNota(i)] : 'bg-border')} style={{ height: k ? Math.max(8, (k / maior) * 64) : 2 }} />
          <span className="num text-[11px] text-muted-foreground">{i}</span>
        </div>
      ))}
    </div>
  );
}

function Barras({ p }) {
  const total = (p?.promotores || 0) + (p?.neutros || 0) + (p?.detratores || 0);
  if (!total) return null;
  return (
    <div aria-hidden="true" className="col-span-full flex h-1.5 overflow-hidden rounded-full bg-muted">
      <i className="block bg-emerald-500" style={{ width: `${(p.promotores / total) * 100}%` }} />
      <i className="block bg-amber-400" style={{ width: `${(p.neutros / total) * 100}%` }} />
      <i className="block bg-rose-500" style={{ width: `${(p.detratores / total) * 100}%` }} />
    </div>
  );
}

export function NpsTab({ nps, metaNps, semestral = false, pode, professorLogado, primeiroNome, db, prof, clientes, contratos, planos, listenersActive }) {
  const itens = nps.itens;
  const [escolhidaId, setEscolhidaId] = useState(null);
  const item = itens.find((i) => i.pesquisa.id === escolhidaId) ?? itens[itens.length - 1] ?? null;
  const pesquisa = item?.pesquisa ?? null;
  const { respostas: todas, carregando: lendo } = useNpsRespostas({ db, pesquisaId: pesquisa?.id, enabled: pode && listenersActive });
  const respostas = useMemo(
    () => todas.filter((r) => r.professorId === prof.id).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')),
    [todas, prof.id],
  );
  // Quem ainda não respondeu: a carteira ativa no dia em que a pesquisa abriu.
  const naoResponderam = useMemo(() => {
    if (!pode || !pesquisa) return [];
    const ja = new Set(respostas.map((r) => r.leadId));
    const dia = getSafeDateOrNull(pesquisa.abertaEm) ?? new Date();
    return carteiraAt({ leads: clientes, contratos, planos, professor: prof, data: dia })
      .filter((a) => a.estado === 'vigente' && !ja.has(a.lead.id))
      .map((a) => a.lead)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }, [pode, pesquisa, respostas, clientes, contratos, planos, prof]);

  if (!itens.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-[13.5px] text-muted-foreground">
        Nenhuma pesquisa deste período teve {professorLogado ? 'a sua turma' : `a turma de ${primeiroNome}`}. A nota aparece quando a primeira pesquisa abrir.
      </div>
    );
  }

  const r = item.resultado;
  const principal = principalDe(pesquisa);
  const outras = (pesquisa.perguntas || []).filter((q) => !q.principal);
  const totaisPrincipal = item.totais?.porPergunta?.[principal?.id];
  const prog = progressoDaTurma(r.turma, r.respostas);
  const precisa = Math.max(RESPOSTAS_MINIMAS, Math.ceil(r.turma / 2));
  const media = r.perguntas[principal?.id]?.media ?? null;
  const abriu = diaCurto(pesquisa.abertaEm);
  const nomeCurto = (n) => String(n || '').trim();

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={semestral ? 'Nota do período' : 'Nota do ano'} className={cn(CARD, 'grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center')}>
        <div>
          <div className={ROTULO}>{semestral ? 'Nota do período' : 'Nota do ano'} {metaNps != null && <SeloDaMeta nota={nps.nota} meta={metaNps} />}</div>
          <div className={cn('num mb-1.5 mt-2 font-display text-[44px] font-bold leading-none tracking-[-0.03em]', metaNps != null && nps.passa && 'text-emerald-700 dark:text-emerald-300', nps.nota == null && 'text-[28px] text-muted-foreground')}>
            {nps.nota == null ? 'Sem nota válida' : notaTexto(nps.nota)}
          </div>
          <p className="m-0 text-[13px] text-muted-foreground">
            {nps.pesquisas >= 2 ? `Média das ${nps.pesquisas} pesquisas do período.` : nps.pesquisas === 1 ? `Só uma pesquisa valeu, então a nota ${semestral ? 'do período' : 'do ano'} é a dela.` : 'Nenhuma pesquisa do período valeu.'}{metaNps != null && ` Meta: ${metaNps} ou mais.`}
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {itens.map((i) => (
            <li key={i.pesquisa.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-xl bg-muted/60 px-3.5 py-2.5">
              <span className="truncate text-[13.5px] font-semibold">{i.pesquisa.nome}</span>
              {i.resultado.valida
                ? <b className="num font-display text-[18px]">{notaTexto(i.resultado.nota)}</b>
                : <b className="text-[13px] font-semibold text-muted-foreground">Sem nota válida</b>}
              <small className="num col-span-2 text-[12px] text-muted-foreground">{i.resultado.respostas} de {i.resultado.turma} responderam</small>
            </li>
          ))}
        </ul>
      </section>

      {itens.length > 1 && (
        <div role="group" aria-label="Pesquisa" className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">Pesquisa</span>
          {[...itens].reverse().map((i) => (
            <button
              key={i.pesquisa.id}
              type="button"
              aria-pressed={i.pesquisa.id === pesquisa.id}
              onClick={() => setEscolhidaId(i.pesquisa.id)}
              className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground/80 outline-none hover:border-brand-200 focus-visible:anel-foco aria-pressed:border-brand-600 aria-pressed:bg-brand-600 aria-pressed:text-white aria-pressed:focus-visible:ring-offset-2 aria-pressed:focus-visible:ring-offset-background"
            >
              {i.pesquisa.nome}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-label="Pergunta principal" className={CARD}>
          <div className={ROTULO}>Pergunta principal <span className={cn(FLAG, 'bg-muted text-muted-foreground')}>conta no plano de carreira</span></div>
          <p className="mb-3 mt-1.5 text-[15px] font-semibold">{principal?.texto}</p>
          {r.valida ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <span className={cn('num font-display text-[52px] font-bold leading-[.95] tracking-[-0.04em]', metaNps != null && media >= metaNps && 'text-emerald-700 dark:text-emerald-300')}>{notaTexto(media)}</span>
                <div>{metaNps != null && <SeloDaMeta nota={media} meta={metaNps} />}<p className="mb-0 mt-1 text-[13px] text-muted-foreground">Média das notas de 0 a 10.{metaNps != null && ` Meta: ${metaNps} ou mais.`}</p></div>
              </div>
              {totaisPrincipal?.porNota && <Histograma porNota={totaisPrincipal.porNota} />}
              <p className="num mb-0 mt-3 text-[13px] text-muted-foreground">
                {r.perguntas[principal.id].promotores}% deram 9 ou 10. NPS clássico {sinal(r.perguntas[principal.id].nps)}, só como informação.
              </p>
            </>
          ) : (
            <>
              <div className="font-display text-[26px] font-bold text-muted-foreground">Sem nota válida</div>
              <p className="mb-0 mt-2 text-[13px] text-foreground/80">
                Responderam {r.respostas} dos {r.turma} alunos da turma. Para a nota valer, {prog.nuncaVale ? 'a turma precisaria de 10 alunos ou mais' : `precisa de ${precisa} respostas`}. Sem isso, esta pesquisa não entra na nota do ano.
              </p>
            </>
          )}
        </section>

        <section aria-label="Respostas" className={CARD}>
          <div className={ROTULO}>
            Respostas
            {r.valida
              ? <span className={cn(FLAG, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300')}>A nota vale</span>
              : <span className={cn(FLAG, 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200')}>Sem nota válida</span>}
          </div>
          <div className="num mt-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em]">
            {r.respostas} de {r.turma} <small className="text-[15px] font-semibold tracking-normal text-muted-foreground">{prog.pct}% da turma</small>
          </div>
          <div role="img" aria-label={`${prog.pct}% da turma respondeu. O mínimo é metade.`} className="relative mb-[26px] mt-4 h-2.5 rounded-full bg-muted">
            <i className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, prog.pct)}%` }} />
            <b className="absolute -top-[5px] left-1/2 h-5 w-0.5 bg-foreground" />
            <em className="absolute left-1/2 top-[18px] -translate-x-1/2 whitespace-nowrap text-[11.5px] not-italic text-muted-foreground">metade da turma</em>
          </div>
          <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] text-foreground/80">
            <li>A nota vale com pelo menos 10 respostas e metade da turma.</li>
            <li>Turma: {professorLogado ? `os seus ${r.turma} alunos ativos` : `os ${r.turma} alunos ativos de ${primeiroNome}`}{abriu ? ` em ${abriu}` : ''}.</li>
            <li>Período de {periodoTexto(pesquisa.inicio, pesquisa.fim)}.</li>
          </ul>
        </section>
      </div>

      {outras.length > 0 && (
        <section aria-labelledby="nps-outras" className={CARD}>
          <h3 id="nps-outras" className="m-0 font-display text-[16px] font-bold">Outras perguntas</h3>
          <p className="mb-0 mt-0.5 text-[13px] text-muted-foreground">Não entram no plano de carreira.</p>
          {r.valida ? (
            <ul className="m-0 mt-2 list-none p-0">
              {outras.map((q) => {
                const res = r.perguntas[q.id];
                return (
                  <li key={q.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-border py-3 first:border-t-0">
                    <span className="text-[13.5px]">{q.texto}</span>
                    <span className="text-right"><b className="num block font-display text-[18px]">{res?.media == null ? '–' : notaTexto(res.media)}</b><small className="num text-[12px] text-muted-foreground">{res?.promotores ?? 0}% deram 9 ou 10</small></span>
                    <Barras p={item.totais?.porPergunta?.[q.id]} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-0 mt-2 text-[13px] text-muted-foreground">Também ficam sem nota, porque a pesquisa não teve respostas suficientes.</p>
          )}
        </section>
      )}

      {pode && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="nps-quem" className={cn(CARD, 'min-w-0')}>
            <h3 id="nps-quem" className="m-0 font-display text-[16px] font-bold">Quem respondeu <span className="num font-medium text-muted-foreground">{respostas.length}</span></h3>
            {lendo ? <p className="mb-0 mt-2 text-[13px] text-muted-foreground">Carregando as respostas…</p>
              : respostas.length === 0 ? <p className="mb-0 mt-2 text-[13px] text-muted-foreground">Ninguém respondeu ainda.</p>
                : (
                  <div className="mt-2 overflow-x-auto overscroll-x-contain">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="text-left text-[12.5px] text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Aluno</th>
                          {(pesquisa.perguntas || []).map((q, i) => <th key={q.id} className="px-1.5 py-2 text-center font-medium" title={q.texto}>{q.principal ? 'Principal' : `P${i + 1}`}</th>)}
                          <th className="py-2 pl-3 font-medium">Comentário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {respostas.map((resposta) => (
                          <tr key={resposta.id} className="border-t border-border align-top">
                            <td className="py-2.5 pr-3"><LeadLink leadId={resposta.leadId} className="rounded font-semibold outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300">{nomeCurto(resposta.nome)}</LeadLink></td>
                            {(pesquisa.perguntas || []).map((q) => {
                              const n = resposta.notas?.[q.id];
                              return <td key={q.id} className="px-1.5 py-2.5 text-center">{Number.isInteger(n) ? <span className={cn('num inline-grid size-7 place-items-center rounded-lg font-bold', COR_TEXTO[tomDaNota(n)])}>{n}</span> : '–'}</td>;
                            })}
                            <td className="min-w-[180px] py-2.5 pl-3 text-foreground/80">{resposta.comentario || <span className="text-muted-foreground">Sem comentário</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
          </section>
          <section aria-labelledby="nps-nao" className={cn(CARD, 'min-w-0')}>
            <h3 id="nps-nao" className="m-0 font-display text-[16px] font-bold">Não responderam <span className="num font-medium text-muted-foreground">{naoResponderam.length}</span></h3>
            {naoResponderam.length === 0 ? <p className="mb-0 mt-2 text-[13px] text-muted-foreground">Toda a turma respondeu.</p> : (
              <ul className="m-0 mt-1 list-none p-0">
                {naoResponderam.map((lead) => (
                  <li key={lead.id} className="flex items-center gap-2.5 border-b border-border py-2 last:border-b-0">
                    <span aria-hidden="true"><Avatar name={lead.name} photoUrl={lead.photoUrl || null} size={28} /></span>
                    <LeadLink leadId={lead.id} className="min-w-0 truncate rounded font-semibold outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300">{nomeCurto(lead.name)}</LeadLink>
                    {!String(lead.cpfDigits || '').trim() && <span className={cn(FLAG, 'ml-auto bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200')}>Sem CPF</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <p className="m-0 flex items-start gap-2 text-[12.5px] text-muted-foreground">
        <Info size={15} aria-hidden="true" className="mt-px flex-none" />
        {professorLogado
          ? 'Você vê só o resultado da turma. Os nomes, as notas de cada aluno e os comentários ficam com a gestão.'
          : `Só a gestão vê os nomes, as notas de cada aluno e os comentários. Na tela de ${primeiroNome}, esta aba mostra só os totais.`}
      </p>
    </div>
  );
}
