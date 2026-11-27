import { cn } from '@/lib/utils';
import { alvoDe } from '../../lib/carreira/placar.js';
import { PeriodoControl } from './ProfessoresComum.jsx';
import { escalaDaRenovacao, estadoTexto, metaTexto, notaTexto, proximaTexto, valorTexto } from './criterios.js';

// O placar escuro do perfil (spec 2026-11-26, "Menu Carreira"): os números
// ligados na trilha, cada um com a régua do resultado, o traço laranja da meta
// do nível de agora e o tracejado da meta do próximo nível. Embaixo, "Para
// Pleno: 55%". No último nível, só a meta de agora. O texto claro fica em 58%
// de branco ou mais, que dá 6:1 ou mais sobre o ink-900.
const posicao = (v, lo, hi) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
const COLUNAS = { 1: '@[1000px]:grid-cols-1', 2: '@[1000px]:grid-cols-2', 3: '@[1000px]:grid-cols-3', 4: '@[1000px]:grid-cols-4' };

// marcas: { v, texto, rotulo, tipo: 'atual' | 'proxima' | 'ref' }.
function Regua({ lo, hi, rotulo, marcas = [], ponto = null, verde = false, pontas = null }) {
  const vazia = ponto == null;
  return (
    <div role="img" aria-label={rotulo} className="relative mt-[22px] h-[50px]">
      <div className={cn('absolute inset-x-0 top-[15px] h-1 rounded-sm', vazia ? 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.22)_0_6px,transparent_6px_11px)]' : 'bg-white/15')} />
      {marcas.map((m) => (
        <div key={`${m.tipo}-${m.texto}`}>
          <div
            className={cn(
              'absolute top-[9px] h-4',
              m.tipo === 'atual' && 'ml-[-1.5px] w-[3px] rounded-[1px] bg-accent-500',
              m.tipo === 'proxima' && 'ml-[-1px] w-0 border-l-2 border-dashed border-white/70',
              m.tipo === 'ref' && 'ml-[-1px] w-0.5 rounded-[1px] bg-white/40',
            )}
            style={{ left: `${posicao(m.v, lo, hi)}%` }}
          />
          <div
            className={cn('absolute top-[30px] -translate-x-1/2 whitespace-nowrap text-center text-[11.5px] leading-[1.25]', m.tipo === 'atual' ? 'font-bold text-[#FFB28F]' : 'text-white/60')}
            style={{ left: `${posicao(m.v, lo, hi)}%` }}
          >
            {m.texto}<br />{m.rotulo}
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

function Selo({ ok, children }) {
  return (
    <span className={cn('mr-1.5 inline-flex h-[22px] items-center whitespace-nowrap rounded-[7px] px-2 text-[12px] font-semibold', ok ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-500/20 text-amber-200')}>
      {children}
    </span>
  );
}

// A escala, as marcas e as linhas de cada número. `det` são os detalhes das
// contas (renovacao, conversao, nps, aderencia e barra) para a linha de baixo.
function desenhoDe(item, nivel, proximo, det) {
  const { id, valor, meta, metaProxima, academia } = item;
  const alvo = alvoDe(id, meta, academia);
  const alvoProx = alvoDe(id, metaProxima, academia);
  const rotulo = (v) => (id === 'nps' ? notaTexto(v) : `${v}%`);
  const marcas = [];
  if (id === 'conversao' && academia != null) marcas.push({ v: academia, texto: 'academia', rotulo: `${academia}%`, tipo: 'ref' });
  if (alvo != null) marcas.push({ v: alvo, texto: nivel.nome, rotulo: rotulo(alvo), tipo: 'atual' });
  if (alvoProx != null) marcas.push({ v: alvoProx, texto: proximo.nome, rotulo: rotulo(alvoProx), tipo: 'proxima' });
  if (id === 'nps') {
    const candidatos = [alvo, alvoProx].filter((v) => v != null).map((v) => Math.floor(v) - 1);
    const lo = Math.max(0, Math.min(...candidatos, valor == null ? 10 : Math.floor(valor)));
    const comPesquisa = Boolean(det.nps?.itens?.length);
    return {
      lo, hi: 10, pontas: [String(lo), '10'], marcas,
      linha: valor != null ? (det.nps.promotores == null ? null : `${det.nps.promotores}% deram 9 ou 10`) : comPesquisa ? 'Sem nota válida' : 'Sem pesquisa ainda',
      rodape: !comPesquisa ? 'A pesquisa com os alunos ainda não começou.'
        : valor == null ? 'Nenhuma pesquisa do período teve respostas suficientes.'
          : det.nps.pesquisas === 1 ? 'Uma pesquisa válida no período.' : `Média das ${det.nps.pesquisas} pesquisas válidas do período.`,
    };
  }
  if (id === 'conversao') {
    const p = det.conversao.professor;
    return {
      lo: 0, hi: 100, pontas: ['0%', '100%'], marcas,
      linha: p.taxa == null ? 'Ninguém veio ainda' : `${p.matricularam} de ${p.vieram} pessoas se matricularam`,
      rodape: det.conversao.incompleto
        ? 'Aula experimental e freepass, cada pessoa uma vez. As aulas de antes de setembro de 2026 estão incompletas no sistema.'
        : 'Aula experimental e freepass, cada pessoa uma vez.',
    };
  }
  if (id === 'aderencia') {
    const lo = Math.max(0, Math.min((alvo ?? 60) - 20, valor == null ? 100 : Math.floor(valor / 10) * 10));
    return {
      lo, hi: 100, pontas: [`${lo}%`, '100%'], marcas,
      linha: valor == null ? 'Sem dados ainda' : det.aderencia.emAndamento ? 'Período em andamento' : 'Período fechado',
      rodape: `Semanas com ${det.barra} ou mais aulas, de segunda a sexta. Dezembro fica fora.`,
    };
  }
  const [lo, hi] = escalaDaRenovacao([alvo, alvoProx, valor]);
  return {
    lo, hi, pontas: null, marcas,
    linha: valor == null ? 'Nenhum contrato venceu' : `${det.renovacao.renovados} de ${det.renovacao.venceram} contratos renovaram`,
    rodape: 'Contratos das modalidades do professor que venceram na janela da trilha.',
  };
}

export function PlacarDaCarreira({ titulo, trilha, periodo, agora, onChave, placar, detalhes }) {
  const { nivel, proximo, itens } = placar;
  return (
    <section aria-label="Números do plano de carreira" className="@container mt-3.5 rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_88%_-30%,#22357a_0,transparent_60%)] px-6 pb-7 pt-6 text-white md:px-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 font-display text-[17px] font-bold tracking-[-0.01em]">{titulo}</h2>
          <p className="mt-0.5 text-[13px] text-white/60">Trilha {trilha.nome}{nivel ? `, ${nivel.nome}` : ', sem nível'}. Cada régua mostra o resultado e as metas do nível.</p>
        </div>
        <PeriodoControl trilha={trilha} periodo={periodo} agora={agora} onChave={onChave} escuro />
      </div>

      {itens.length === 0 ? (
        <p className="mt-6 text-[14px] text-white/75">Nenhum número ligado nesta trilha.</p>
      ) : (
        <div className={cn('mt-6 grid grid-cols-1 gap-x-8 gap-y-8 @[620px]:grid-cols-2 @[1000px]:gap-x-0', COLUNAS[Math.min(4, itens.length)])}>
          {itens.map((item) => {
            const d = desenhoDe(item, nivel, proximo, detalhes);
            const valor = valorTexto(item.id, item.valor);
            const estado = estadoTexto(item, nivel);
            const prox = proximaTexto(item, proximo);
            return (
              <div key={item.id} className="flex min-w-0 flex-col @[1000px]:border-l @[1000px]:border-white/10 @[1000px]:px-6 @[1000px]:first:border-l-0 @[1000px]:first:pl-0">
                <h3 className="m-0 text-[14px] font-medium text-white/75">{item.nome}</h3>
                {valor != null
                  ? <div className={cn('num mb-1.5 mt-3 font-display text-[52px] font-bold leading-none tracking-[-0.045em]', item.estado === 'ok' && 'text-emerald-300')}>{valor}</div>
                  : <div className="mb-2 mt-[22px] font-display text-[22px] font-bold leading-[1.15] tracking-[-0.015em] text-white/80">{d.linha}</div>}
                {valor != null && d.linha && <div className="num text-[13px] text-white/80">{d.linha}</div>}
                <Regua
                  lo={d.lo}
                  hi={d.hi}
                  marcas={d.marcas}
                  ponto={item.valor}
                  verde={item.estado === 'ok'}
                  pontas={d.pontas}
                  rotulo={`${valor ?? 'Sem resultado'}. ${item.meta == null ? 'Sem meta' : `Meta ${metaTexto(item.id, item.meta, item.academia)}`}.${prox ? ` ${prox}.` : ''}`}
                />
                <div className="mt-2.5 text-[12.5px] text-white/60">
                  {(item.estado === 'ok' || item.estado === 'baixo') && <Selo ok={item.estado === 'ok'}>{estado}</Selo>}
                  {item.estado === 'semMeta' && <span className="mr-1.5 text-white/80">{estado}</span>}
                  {d.rodape}
                </div>
                {prox && <div className="mt-1.5 text-[12.5px] font-semibold text-white/80">{prox}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div aria-hidden="true" className="mt-[22px] flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[12.5px] text-white/60">
        <span className="inline-flex items-center gap-[7px]"><i className="block h-3 w-[3px] rounded-[1px] bg-accent-500" />Meta do nível atual</span>
        {proximo && <span className="inline-flex items-center gap-[7px]"><i className="block h-3 w-0 border-l-2 border-dashed border-white/70" />Meta do {proximo.nome}</span>}
        <span className="inline-flex items-center gap-[7px]"><i className="block size-3 rounded-full bg-white" />Resultado</span>
      </div>
    </section>
  );
}
