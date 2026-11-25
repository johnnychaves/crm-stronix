import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Info, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ciclosDaPesquisa, MAX_PERGUNTAS, problemaDaPesquisa } from '../../lib/professor/pesquisas.js';
import { BOTAO, BOTAO_PRI, Confirmacao } from './Confirmacao.jsx';
import { cicloLongo, periodoTexto } from './pesquisasTexto.js';

// O formulário da pesquisa em três passos (mockup B): nome e datas, perguntas,
// revisar e abrir. O rodapé diz o que falta e só deixa seguir com o passo
// certo. Salvar rascunho pede a pesquisa inteira certa: com a principal
// sugerida, isso já vale depois do primeiro passo.
const PASSOS = ['Nome e datas', 'Perguntas', 'Revisar e abrir'];
const CAMPOS_DO_PASSO = [['nome', 'inicio', 'fim', 'ciclo'], null, null];
const INPUT = 'h-[38px] min-w-0 rounded-[10px] border border-border bg-card px-3 text-[14px] font-medium text-foreground outline-none focus-visible:anel-foco aria-[invalid=true]:border-rose-500';
const LINK = 'rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300';

// O problema que trava o passo `passo` (0 a 2), ou null.
function problemaDoPasso(form, passo) {
  const p = problemaDaPesquisa(form);
  if (!p) return null;
  const campos = CAMPOS_DO_PASSO[0];
  if (passo === 0) return campos.includes(p.campo) ? p : null;
  return p;
}

export function PesquisaForm({ id, inicial, turmaHoje, outraAberta, onSalvar, onAbrir, onExcluir, onVoltar }) {
  const [form, setForm] = useState(inicial);
  const [passo, setPasso] = useState(0);
  const [confirmar, setConfirmar] = useState(null); // 'abrir' | 'excluir'
  const [ocupado, setOcupado] = useState(false);
  const titulo = useRef(null);
  const ultimoDisparo = useRef(null);

  // O foco vai para o título do passo ao abrir o formulário e a cada troca.
  useEffect(() => { titulo.current?.focus(); }, [passo]);

  const ciclos = ciclosDaPesquisa(form.inicio);
  const mudar = (campo, valor) => setForm((f) => {
    const novo = { ...f, [campo]: valor };
    // Início novo: o ciclo segue o padrão quando o escolhido deixou de valer.
    if (campo === 'inicio') {
      const opcoes = ciclosDaPesquisa(valor);
      if (!opcoes.includes(novo.ciclo)) novo.ciclo = opcoes[0] ?? null;
    }
    return novo;
  });
  const mudarPergunta = (i, mudanca) => setForm((f) => ({ ...f, perguntas: f.perguntas.map((q, j) => (j === i ? { ...q, ...mudanca } : q)) }));
  const marcarPrincipal = (i) => setForm((f) => ({ ...f, perguntas: f.perguntas.map((q, j) => ({ ...q, principal: j === i })) }));
  const tirarPergunta = (i) => setForm((f) => {
    const perguntas = f.perguntas.filter((_, j) => j !== i);
    if (!perguntas.some((q) => q.principal) && perguntas[0]) perguntas[0] = { ...perguntas[0], principal: true };
    return { ...f, perguntas };
  });
  const novaPerguntaRef = useRef(false);
  const somarPergunta = () => {
    novaPerguntaRef.current = true;
    setForm((f) => ({ ...f, perguntas: [...f.perguntas, { texto: '', principal: false }] }));
  };
  const ultimaPergunta = useRef(null);
  useEffect(() => {
    if (!novaPerguntaRef.current) return;
    novaPerguntaRef.current = false;
    ultimaPergunta.current?.focus();
  }, [form.perguntas.length]);

  const travaPasso = problemaDoPasso(form, passo);
  const travaTudo = problemaDaPesquisa(form);
  const invalido = (campo) => travaPasso?.campo === campo || undefined;

  const executar = async (acao, disparo) => {
    if (ocupado) return;
    ultimoDisparo.current = disparo;
    setOcupado(true);
    try {
      await acao();
    } finally {
      setOcupado(false);
    }
  };
  const salvar = () => executar(() => onSalvar(form), 'salvar');
  const abrir = () => executar(() => onAbrir(form), 'abrir');
  const excluir = () => executar(() => onExcluir(), 'excluir');

  const principal = form.perguntas.find((q) => q.principal);
  const outras = form.perguntas.length - 1;

  return (
    <div>
      <button type="button" onClick={onVoltar} className="mb-3.5 inline-flex items-center gap-1 rounded-md text-[14px] font-medium text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
        <ChevronLeft size={16} aria-hidden="true" />Pesquisas
      </button>
      <ol aria-label="Passos" className="m-0 mb-4 flex list-none flex-wrap gap-1.5 p-0">
        {PASSOS.map((nome, i) => (
          <li
            key={nome}
            aria-current={i === passo ? 'step' : undefined}
            className={cn(
              'inline-flex h-[34px] items-center gap-2 rounded-full border border-border bg-card py-0 pl-1.5 pr-3.5 text-[13px] font-semibold text-muted-foreground',
              i === passo && 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/40 dark:bg-brand-500/10 dark:text-brand-300',
            )}
          >
            <i className={cn('grid size-6 place-items-center rounded-full bg-muted text-[12px] not-italic', i === passo && 'bg-brand-600 text-white')}>{i + 1}</i>
            {nome}
          </li>
        ))}
      </ol>

      <section className="flex max-w-[760px] flex-col gap-4 rounded-[18px] border border-border bg-card px-5 py-[22px] shadow-card md:px-6">
        <h2 ref={titulo} tabIndex={-1} className="m-0 font-display text-[18px] font-bold outline-none">{PASSOS[passo]}</h2>

        {passo === 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="pesq-nome" className="text-[12.5px] font-medium text-foreground/80">Nome</label>
              <input id="pesq-nome" className={INPUT} value={form.nome} placeholder="Junho de 2027" aria-invalid={invalido('nome')} onChange={(e) => mudar('nome', e.target.value)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="pesq-inicio" className="text-[12.5px] font-medium text-foreground/80">Começa em</label>
              <input id="pesq-inicio" type="date" className={INPUT} value={form.inicio} aria-invalid={invalido('inicio')} onChange={(e) => mudar('inicio', e.target.value)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="pesq-fim" className="text-[12.5px] font-medium text-foreground/80">Termina em</label>
              <input id="pesq-fim" type="date" className={INPUT} value={form.fim} min={form.inicio || undefined} aria-invalid={invalido('fim')} onChange={(e) => mudar('fim', e.target.value)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="pesq-ciclo" className="text-[12.5px] font-medium text-foreground/80">Conta para o ciclo</label>
              <select id="pesq-ciclo" className={INPUT} value={form.ciclo ?? ''} disabled={!ciclos.length} aria-invalid={invalido('ciclo')} onChange={(e) => mudar('ciclo', Number(e.target.value))}>
                {!ciclos.length && <option value="">Escolha o início primeiro</option>}
                {ciclos.map((c) => <option key={c} value={c}>{cicloLongo(c)}</option>)}
              </select>
            </div>
          </div>
        )}

        {passo === 1 && (
          <div className="flex flex-col gap-3">
            <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
              <legend className="sr-only">Perguntas e qual é a principal</legend>
              {form.perguntas.map((q, i) => (
                <div key={i} className={cn('grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-xl border border-border p-2.5', q.principal && 'border-brand-200 bg-brand-50/50 dark:border-brand-400/40 dark:bg-brand-500/10')}>
                  <span className="num pt-[9px] text-center font-display text-[13px] font-bold text-muted-foreground">{i + 1}</span>
                  <textarea
                    ref={i === form.perguntas.length - 1 ? ultimaPergunta : undefined}
                    rows={2}
                    aria-label={`Pergunta ${i + 1}`}
                    aria-invalid={travaPasso?.campo === `pergunta-${i}` || undefined}
                    placeholder="De 0 a 10, ..."
                    value={q.texto}
                    onChange={(e) => mudarPergunta(i, { texto: e.target.value })}
                    className="min-h-[60px] min-w-0 resize-y rounded-[10px] border border-border bg-card px-3 py-[9px] text-[14px] font-medium leading-snug text-foreground outline-none focus-visible:anel-foco aria-[invalid=true]:border-rose-500"
                  />
                  <div className="flex flex-col items-end gap-2">
                    <label className={cn('inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-foreground/80', q.principal && 'text-brand-700 dark:text-brand-300')}>
                      <input type="radio" name="pesq-principal" checked={q.principal} onChange={() => marcarPrincipal(i)} className="accent-brand-600" />
                      Principal
                    </label>
                    <button
                      type="button"
                      aria-label={`Tirar a pergunta ${i + 1}`}
                      disabled={form.perguntas.length === 1}
                      onClick={() => tirarPergunta(i)}
                      className="grid size-[30px] place-items-center rounded-lg border border-border bg-card text-muted-foreground outline-none hover:border-rose-200 hover:text-rose-700 focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </fieldset>
            <button type="button" onClick={somarPergunta} disabled={form.perguntas.length >= MAX_PERGUNTAS} className={cn(BOTAO, 'self-start')}>
              <Plus size={15} aria-hidden="true" />Adicionar pergunta
            </button>
            <p className="m-0 text-[12.5px] text-muted-foreground">De 1 a 5 perguntas, todas de 0 a 10. Só a principal conta no plano de carreira.</p>
          </div>
        )}

        {passo === 2 && (
          <div className="flex flex-col gap-3.5">
            <dl className="m-0 grid grid-cols-1 gap-x-3.5 gap-y-2 text-[14px] sm:grid-cols-[140px_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Nome</dt><dd className="m-0">{form.nome}</dd>
              <dt className="text-muted-foreground">Período</dt><dd className="num m-0">{periodoTexto(form.inicio, form.fim)}</dd>
              <dt className="text-muted-foreground">Ciclo</dt><dd className="m-0">{form.ciclo ? cicloLongo(form.ciclo) : ''}</dd>
              <dt className="text-muted-foreground">Turma ao abrir</dt>
              <dd className="m-0">{turmaHoje == null ? 'Contando os alunos…' : `${turmaHoje} ${turmaHoje === 1 ? 'aluno' : 'alunos'} da carteira dos professores, hoje`}</dd>
              <dt className="text-muted-foreground">Principal</dt><dd className="m-0">{principal?.texto}</dd>
              <dt className="text-muted-foreground">Outras</dt><dd className="m-0">{outras === 0 ? 'nenhuma' : outras === 1 ? '1 pergunta' : `${outras} perguntas`}</dd>
            </dl>
            <p className="m-0 flex items-start gap-2.5 rounded-xl bg-brand-50 px-3.5 py-3 text-[13px] text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
              Ao abrir, a turma de cada professor fica gravada e as perguntas travam.
            </p>
            {confirmar === 'abrir' && (
              <Confirmacao
                titulo="Abrir a pesquisa agora?"
                texto={`A turma de cada professor fica gravada com os alunos de hoje (${turmaHoje ?? 0} ${turmaHoje === 1 ? 'aluno' : 'alunos'}), e as perguntas não mudam mais. Só uma pesquisa fica aberta por vez.`}
                acao="Abrir pesquisa"
                ocupado={ocupado}
                onConfirmar={abrir}
                onVoltar={() => setConfirmar(null)}
              />
            )}
          </div>
        )}

        {confirmar === 'excluir' && (
          <Confirmacao
            titulo="Excluir este rascunho?"
            texto="O rascunho sai da lista de pesquisas. Nenhum aluno respondeu a ele."
            acao="Excluir rascunho"
            perigo
            ocupado={ocupado}
            onConfirmar={excluir}
            onVoltar={() => setConfirmar(null)}
          />
        )}

        <p role="status" className="m-0 min-h-[18px] text-[12.5px] font-semibold text-amber-700 dark:text-amber-300">
          {travaPasso?.texto ?? (passo === 2 && outraAberta ? `A pesquisa ${outraAberta.nome} está aberta. Encerre ela antes de abrir esta.` : '')}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={passo === 0 || ocupado} onClick={() => { setConfirmar(null); setPasso((p) => p - 1); }} className={BOTAO}>Voltar</button>
            {id && (
              <button type="button" disabled={ocupado} onClick={() => setConfirmar('excluir')} className={LINK}>Excluir rascunho</button>
            )}
          </span>
          <span className="flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(travaTudo) || ocupado} onClick={salvar} className={BOTAO}>
              {ocupado && ultimoDisparo.current === 'salvar' ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            {passo < 2 ? (
              <button type="button" disabled={Boolean(travaPasso) || ocupado} onClick={() => setPasso((p) => p + 1)} className={BOTAO_PRI}>Continuar</button>
            ) : (
              <button type="button" disabled={Boolean(travaTudo) || Boolean(outraAberta) || turmaHoje == null || ocupado} onClick={() => setConfirmar('abrir')} className={BOTAO_PRI}>Abrir pesquisa</button>
            )}
          </span>
        </div>
      </section>
    </div>
  );
}
