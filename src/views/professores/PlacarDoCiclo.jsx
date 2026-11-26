import { cn } from '@/lib/utils';
import { NIVEIS, nivelTexto, referenciaDaRenovacao } from '../../lib/professor/metas.js';
import { CicloControl } from './ProfessoresComum.jsx';
import { escalaDaRenovacao, notaTexto } from './criterios.js';

// O placar escuro do perfil (mockup B): os quatro critérios do plano de
// carreira, cada um com a régua do resultado contra a referência. Renovação e
// conversão vêm das contas de src/lib/professor/ e a nota dos alunos, do
// npsDoCiclo, e a aderência, do aderenciaResumo. O texto claro fica em 58% de
// branco ou mais, que dá 6:1 ou mais sobre o ink-900.
const posicao = (v, lo, hi) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

// A régua: trilho, marcas com rótulo embaixo, faixa da meta, o ponto do
// resultado e as pontas da escala. Para o leitor de tela é uma imagem com o
// resumo em `rotulo`.
function Regua({ lo, hi, rotulo, marcas = [], zona = null, zonaTexto = null, ponto = null, verde = false, pontas = null }) {
  const vazia = ponto == null;
  return (
    <div role="img" aria-label={rotulo} className="relative mt-[22px] h-[50px]">
      <div
        className={cn(
          'absolute inset-x-0 top-[15px] h-1 rounded-sm',
          vazia ? 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.22)_0_6px,transparent_6px_11px)]' : 'bg-white/15',
        )}
      />
      {zona && (
        <>
          <div className="absolute top-[15px] h-1 bg-emerald-400/45" style={{ left: `${posicao(zona[0], lo, hi)}%`, right: `${100 - posicao(zona[1], lo, hi)}%` }} />
          {zonaTexto && (
            <div className="absolute -top-2.5 -translate-x-1/2 whitespace-nowrap text-[11.5px] text-emerald-300" style={{ left: `${(posicao(zona[0], lo, hi) + posicao(zona[1], lo, hi)) / 2}%` }}>
              {zonaTexto}
            </div>
          )}
        </>
      )}
      {marcas.map((m) => (
        <div key={m.texto}>
          <div className={cn('absolute top-[9px] h-4 rounded-[1px]', m.minha ? 'ml-[-1.5px] w-[3px] bg-accent-500' : 'ml-[-1px] w-0.5 bg-white/40')} style={{ left: `${posicao(m.v, lo, hi)}%` }} />
          <div className={cn('absolute top-[30px] -translate-x-1/2 whitespace-nowrap text-center text-[11.5px] leading-[1.25]', m.minha ? 'font-bold text-[#FFB28F]' : 'text-white/60')} style={{ left: `${posicao(m.v, lo, hi)}%` }}>
            {m.texto}<br />{m.v}%
          </div>
        </div>
      ))}
      {!vazia && (
        <div
          className={cn('absolute top-[9px] ml-[-8px] size-4 rounded-full', verde ? 'bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,.25)]' : 'bg-white shadow-[0_0_0_4px_rgba(127,160,255,.35)]')}
          style={{ left: `${posicao(ponto, lo, hi)}%` }}
        />
      )}
      {pontas && (
        <>
          <div className="absolute left-0 top-[30px] text-[11.5px] text-white/60">{pontas[0]}</div>
          <div className="absolute right-0 top-[30px] text-[11.5px] text-white/60">{pontas[1]}</div>
        </>
      )}
    </div>
  );
}

function Selo({ tom, children }) {
  return (
    <span className={cn('mr-1.5 inline-flex h-[22px] items-center whitespace-nowrap rounded-[7px] px-2 text-[12px] font-semibold', tom === 'verde' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-500/20 text-amber-200')}>
      {children}
    </span>
  );
}

function Criterio({ titulo, valor, verde = false, linha, children, rodape }) {
  return (
    <div className="flex min-w-0 flex-col @[1000px]:border-l @[1000px]:border-white/10 @[1000px]:px-6 @[1000px]:first:border-l-0 @[1000px]:first:pl-0">
      <h3 className="m-0 text-[14px] font-medium text-white/75">{titulo}</h3>
      {valor != null
        ? <div className={cn('num mb-1.5 mt-3 font-display text-[52px] font-bold leading-none tracking-[-0.045em]', verde && 'text-emerald-300')}>{valor}</div>
        : <div className="mb-2 mt-[22px] font-display text-[22px] font-bold leading-[1.15] tracking-[-0.015em] text-white/80">{linha}</div>}
      {valor != null && linha && <div className="num text-[13px] text-white/80">{linha}</div>}
      {children}
      {rodape && <div className="mt-2.5 text-[12.5px] text-white/60">{rodape}</div>}
    </div>
  );
}

export function PlacarDoCiclo({ titulo, ciclo, cicloAtual, onCiclo, prof, metas, renovacao, conversao, nps, aderencia, modalidadesTexto }) {
  const medias = NIVEIS.map((n) => ({ v: metas.renovacao[n], texto: nivelTexto(n), minha: n === prof.nivel }));
  const [rlo, rhi] = escalaDaRenovacao([...medias.map((m) => m.v), ...(renovacao.taxa == null ? [] : [renovacao.taxa])]);
  const temNivel = NIVEIS.includes(prof.nivel);
  // A mesma regra do criterioRenovacao da lista: bate com a média do nível.
  const esperado = referenciaDaRenovacao(metas, prof.nivel);
  const renovBateu = esperado == null || renovacao.taxa == null ? null : renovacao.taxa >= esperado;
  const p = conversao.professor;
  const a = conversao.academia;
  const { meta: metaNps } = metas.nps;
  const nota = nps?.nota ?? null;
  const comPesquisa = Boolean(nps?.itens?.length);
  // A escala começa um ponto abaixo da meta, ou na nota, se ela ficou mais baixa.
  const npsLo = Math.max(0, Math.min(metaNps - 1, nota == null ? 10 : Math.floor(nota)));
  const { barra, faixaMin, faixaMax } = metas.aderencia;
  const ader = aderencia?.taxa ?? null;
  const aLo = Math.max(0, Math.min(faixaMin - 20, ader == null ? 100 : Math.floor(ader / 10) * 10));
  const aHi = Math.min(100, faixaMax + 10);

  return (
    <section aria-label="Critérios do plano de carreira" className="@container mt-3.5 rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_88%_-30%,#22357a_0,transparent_60%)] px-6 pb-7 pt-6 text-white md:px-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 font-display text-[17px] font-bold tracking-[-0.01em]">{titulo}</h2>
          <p className="mt-0.5 text-[13px] text-white/60">Cada régua mostra o resultado ao lado da sua referência.</p>
        </div>
        <CicloControl ciclo={ciclo} cicloAtual={cicloAtual} onCiclo={onCiclo} escuro />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 @[620px]:grid-cols-2 @[1000px]:grid-cols-4 @[1000px]:gap-x-0">
        <Criterio
          titulo="Renovação da carteira"
          valor={renovacao.taxa == null ? null : `${renovacao.taxa}%`}
          verde={renovBateu === true}
          linha={renovacao.taxa == null ? 'Nenhum contrato venceu' : `${renovacao.renovados} de ${renovacao.venceram} contratos renovaram`}
          rodape={(
            <>
              {renovBateu === true && <Selo tom="verde">Bateu a média do nível</Selo>}
              {renovBateu === false && <Selo tom="ambar">Abaixo da média do nível</Selo>}
              {temNivel ? `Contratos de ${modalidadesTexto} que venceram no ciclo.` : 'Sem nível: defina o nível para ver a média esperada.'}
            </>
          )}
        >
          <Regua
            lo={rlo}
            hi={rhi}
            marcas={medias}
            ponto={renovacao.taxa}
            verde={renovBateu === true}
            rotulo={`${renovacao.taxa == null ? 'Sem resultado' : `${renovacao.taxa}%`}. Médias: ${medias.map((m) => `${m.texto} ${m.v}%`).join(', ')}.`}
          />
        </Criterio>

        <Criterio
          titulo="Nota dos alunos"
          valor={nota == null ? null : notaTexto(nota)}
          verde={nps?.passa === true}
          linha={nota != null ? (nps.promotores == null ? null : `${nps.promotores}% deram 9 ou 10`) : comPesquisa ? 'Sem nota válida' : 'Sem pesquisa ainda'}
          rodape={(
            <>
              {nps?.passa === true && <Selo tom="verde">Nota de promotor</Selo>}
              {nps?.passa === false && <Selo tom="ambar">Abaixo da meta</Selo>}
              {!comPesquisa
                ? `Meta ${metaNps} ou mais. A pesquisa com os alunos ainda não começou.`
                : nota == null
                  ? `Meta ${metaNps} ou mais. Nenhuma pesquisa do ciclo teve respostas suficientes.`
                  : `Meta ${metaNps} ou mais. ${nps.pesquisas === 1 ? 'Uma pesquisa válida no ciclo.' : `Média das ${nps.pesquisas} pesquisas válidas do ciclo.`}`}
            </>
          )}
        >
          <Regua
            lo={npsLo}
            hi={10}
            zona={[metaNps, 10]}
            zonaTexto={`meta ${metaNps}`}
            ponto={nota}
            verde={nps?.passa === true}
            pontas={[String(npsLo), '10']}
            rotulo={`${nota == null ? (comPesquisa ? 'Sem nota válida' : 'Sem pesquisa ainda') : `Nota ${notaTexto(nota)}`}. Meta ${metaNps} ou mais.`}
          />
        </Criterio>

        <Criterio
          titulo="Conversão em matrícula"
          valor={p.taxa == null ? null : `${p.taxa}%`}
          verde={conversao.passa === true}
          linha={p.taxa == null ? 'Ninguém veio ainda' : `${p.matricularam} de ${p.vieram} pessoas se matricularam`}
          rodape={(
            <>
              {conversao.passa === true && <Selo tom="verde">{p.taxa > a.taxa ? 'Acima da academia' : 'Dentro da folga'}</Selo>}
              {conversao.passa === false && <Selo tom="ambar">{p.taxa >= a.taxa ? 'Empatou com a academia' : 'Abaixo da academia'}</Selo>}
              Aula experimental e freepass, cada pessoa uma vez.
              {conversao.incompleto && <span className="mt-1.5 block text-amber-200">As aulas de antes de setembro de 2026 estão incompletas no sistema.</span>}
            </>
          )}
        >
          <Regua
            lo={0}
            hi={100}
            marcas={a.taxa == null ? [] : [{ v: a.taxa, texto: 'academia' }]}
            ponto={p.taxa}
            verde={conversao.passa === true}
            pontas={['0%', '100%']}
            rotulo={`${p.taxa == null ? 'Sem resultado' : `${p.taxa}%`}, academia ${a.taxa == null ? 'sem dados' : `${a.taxa}%`}.`}
          />
        </Criterio>

        <Criterio
          titulo="Aderência às aulas"
          valor={ader == null ? null : `${ader}%`}
          verde={ader != null && ader >= faixaMin}
          linha={ader == null ? 'Sem dados ainda' : aderencia.emAndamento ? 'Semestre em andamento' : 'Média dos semestres do ciclo'}
          rodape={(
            <>
              {ader != null && ader >= faixaMin && <Selo tom="verde">{ader > faixaMax ? 'Acima da meta' : 'Dentro da meta'}</Selo>}
              {ader != null && ader < faixaMin && <Selo tom="ambar">Abaixo da meta</Selo>}
              {`Semanas com ${barra} ou mais aulas, de segunda a sexta. Dezembro fica fora.`}
            </>
          )}
        >
          <Regua
            lo={aLo}
            hi={aHi}
            zona={[faixaMin, faixaMax]}
            zonaTexto={`meta ${faixaMin}% a ${faixaMax}%`}
            ponto={ader}
            verde={ader != null && ader >= faixaMin}
            pontas={[`${aLo}%`, `${aHi}%`]}
            rotulo={`${ader == null ? 'Sem dados ainda' : `${ader}%`}. Meta de ${faixaMin}% a ${faixaMax}%.`}
          />
        </Criterio>
      </div>

      <div aria-hidden="true" className="mt-[22px] flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[12.5px] text-white/60">
        <span className="inline-flex items-center gap-[7px]"><i className="block h-3 w-[3px] rounded-[1px] bg-accent-500" />Média do nível atual</span>
        <span className="inline-flex items-center gap-[7px]"><i className="block size-3 rounded-full bg-white" />Resultado</span>
        <span className="inline-flex items-center gap-[7px]"><i className="block h-2.5 w-4 rounded-[3px] border-[1.5px] border-emerald-300/80 bg-emerald-400/25" />Meta igual para os três níveis</span>
      </div>
    </section>
  );
}
