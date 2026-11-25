import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { abrirPesquisa, encerrarPesquisa, excluirRascunho, salvarRascunho } from '../../lib/npsWrites.js';
import { estadoDaPesquisa, novaPesquisa, pesquisaEmCurso, progressoDaTurma } from '../../lib/professor/pesquisas.js';
import { BOTAO, BOTAO_PRI, Confirmacao } from './Confirmacao.jsx';
import { PesquisaForm } from './PesquisaForm.jsx';
import { cicloCurto, periodoTexto, prazoTexto } from './pesquisasTexto.js';

// A sub-tela Pesquisas do gestor (mockup B de 25/11/2026, pesquisa em
// destaque): a pesquisa aberta num cartão escuro, com o andamento de cada
// professor, o próximo rascunho e o histórico. "Nova pesquisa" e "Editar"
// trocam a lista pelo formulário de três passos.
const CHIP = 'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold before:size-1.5 before:rounded-full before:bg-current';
const CHIP_TOM = {
  aberta: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  rascunho: 'bg-muted text-foreground/80',
  encerrada: 'bg-muted text-muted-foreground',
};
const SITUACAO_TEXTO = { aberta: 'Aberta', rascunho: 'Rascunho', encerrada: 'Encerrada' };
const BOTAO_ESCURO = 'inline-flex h-[34px] items-center whitespace-nowrap rounded-[10px] border border-white/20 bg-white/[0.08] px-3 text-[13px] font-semibold text-white outline-none hover:bg-white/[0.14] focus-visible:anel-foco';
const LINK = 'rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300';

const somaDe = (obj) => Object.values(obj || {}).reduce((a, n) => a + (Number(n) || 0), 0);
const doForm = (p) => ({ nome: p.nome || '', inicio: p.inicio || '', fim: p.fim || '', ciclo: p.ciclo ?? null, perguntas: (p.perguntas || []).map((q) => ({ texto: q.texto || '', principal: Boolean(q.principal) })) });

function Selo({ estado, escuro = false }) {
  return (
    <span className={cn(CHIP, escuro && estado === 'aberta' ? 'bg-emerald-400/15 text-emerald-300' : CHIP_TOM[estado])}>
      {SITUACAO_TEXTO[estado]}
    </span>
  );
}

function LinhaDoProfessor({ prof, turma, respostas }) {
  const p = progressoDaTurma(turma, respostas);
  const nome = prof?.nome || 'Professor removido';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-white/10 py-3 [grid-template-areas:'who_vale''pb_pb'] md:grid-cols-[minmax(200px,1.3fr)_minmax(170px,1.6fr)_150px] md:items-center md:[grid-template-areas:'who_pb_vale']">
      <div className="flex min-w-0 items-center gap-2.5 [grid-area:who]">
        <span aria-hidden="true"><Avatar name={nome} photoUrl={prof?.photoUrl || null} size={34} /></span>
        <b className="truncate font-semibold text-white">{nome}</b>
      </div>
      <div className="flex flex-col gap-1.5 [grid-area:pb]">
        <small className="num text-[12.5px] text-white/80">{respostas} de {turma} alunos responderam ({p.pct}%)</small>
        <div aria-hidden="true" className="relative h-2 rounded-full bg-white/[0.14]">
          <i className={cn('block h-full rounded-full', p.vale ? 'bg-emerald-400' : 'bg-[#7FA0FF]')} style={{ width: `${Math.min(100, p.pct)}%` }} />
          <em className="absolute -bottom-[3px] -top-[3px] left-1/2 w-0.5 rounded-[1px] bg-white/55" />
        </div>
      </div>
      <div className="text-right [grid-area:vale]">
        <span className={cn('text-[12.5px] font-semibold', p.vale ? 'text-emerald-300' : 'text-amber-300')}>
          {p.vale ? 'Já vale' : p.nuncaVale ? 'Turma com menos de 10' : `Faltam ${p.faltam} ${p.faltam === 1 ? 'resposta' : 'respostas'}`}
        </span>
      </div>
    </div>
  );
}

function Destaque({ pesquisa, totaisPorId, profsPorId, hoje, onEncerrar }) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef(null);
  if (!pesquisa) {
    return (
      <section aria-labelledby="pesq-destaque" className="mb-[18px] rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_88%_-30%,#22357a_0,transparent_60%)] px-[18px] py-6 text-white md:px-7">
        <h2 id="pesq-destaque" className="m-0 font-display text-[20px] font-bold">Nenhuma pesquisa aberta</h2>
        <p className="mt-1 text-[13px] text-white/70">Crie uma pesquisa e abra quando quiser que os alunos respondam. Só uma pesquisa fica aberta por vez.</p>
      </section>
    );
  }
  const linhas = Object.entries(pesquisa.turmas || {})
    .map(([id, turma]) => ({ id, prof: profsPorId.get(id), turma: Number(turma) || 0, respostas: Number(totaisPorId.get(`${pesquisa.id}_${id}`)?.respostas) || 0 }))
    .sort((a, b) => String(a.prof?.nome || '').localeCompare(String(b.prof?.nome || ''), 'pt-BR'));
  const turmaTotal = somaDe(pesquisa.turmas);
  const respondidas = linhas.reduce((a, l) => a + l.respostas, 0);
  const fechar = () => { setConfirmar(false); requestAnimationFrame(() => botao.current?.focus()); };
  const encerrar = async () => {
    setOcupado(true);
    try {
      await onEncerrar(pesquisa);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section aria-labelledby="pesq-destaque" className="mb-[18px] rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_88%_-30%,#22357a_0,transparent_60%)] px-[18px] pb-2 pt-5 text-white md:px-7 md:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h2 id="pesq-destaque" className="m-0 flex flex-wrap items-center gap-2.5 font-display text-[20px] font-bold">{pesquisa.nome} <Selo estado="aberta" escuro /></h2>
          <p className="mt-1 text-[13px] text-white/70">De {periodoTexto(pesquisa.inicio, pesquisa.fim)}, {prazoTexto(pesquisa, hoje)}. A nota vale com metade da turma e 10 respostas.</p>
        </div>
        {!confirmar && <button ref={botao} type="button" onClick={() => setConfirmar(true)} className={BOTAO_ESCURO}>Encerrar agora</button>}
      </div>
      {confirmar && (
        <Confirmacao
          className="mb-3 mt-1.5"
          titulo="Encerrar a pesquisa antes do fim?"
          texto="Os alunos param de conseguir responder agora. As respostas que já chegaram continuam valendo."
          acao="Encerrar agora"
          perigo
          ocupado={ocupado}
          onConfirmar={encerrar}
          onVoltar={fechar}
        />
      )}
      <div className="mt-4 flex items-baseline gap-2.5">
        <b className="num font-display text-[56px] font-bold leading-none tracking-[-0.04em]">{respondidas}</b>
        <span className="text-white/75">de {turmaTotal} alunos já responderam</span>
      </div>
      <div className="mt-3">
        {linhas.map((l) => <LinhaDoProfessor key={l.id} prof={l.prof} turma={l.turma} respostas={l.respostas} />)}
      </div>
    </section>
  );
}

function Proxima({ pesquisa, emCurso, turmaHoje, onEditar, onAbrir }) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef(null);
  const perguntas = pesquisa.perguntas || [];
  const motivo = emCurso ? `Só abre depois que a ${emCurso.nome} encerrar.` : turmaHoje == null ? 'Contando os alunos de cada professor…' : null;
  const abrir = async () => {
    setOcupado(true);
    try {
      await onAbrir(pesquisa);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section aria-labelledby={`prox-${pesquisa.id}`} className="flex flex-col gap-2.5 rounded-[18px] border border-border bg-card px-[22px] py-5 shadow-card">
      <h3 id={`prox-${pesquisa.id}`} className="m-0 flex flex-wrap items-center gap-2 font-display text-[16px] font-bold">
        <ClipboardList size={18} aria-hidden="true" className="flex-none text-brand-700 dark:text-brand-300" />
        Próxima: {pesquisa.nome} <Selo estado="rascunho" />
      </h3>
      <p className="m-0 text-[13px] text-muted-foreground">De {periodoTexto(pesquisa.inicio, pesquisa.fim)}.{motivo ? ` ${motivo}` : ''}</p>
      <ol className="m-0 flex flex-col gap-1 pl-[18px] text-[13.5px] text-foreground/80">
        {perguntas.map((q) => <li key={q.id}>{q.principal && <b>Principal: </b>}{q.texto}</li>)}
      </ol>
      {confirmar ? (
        <Confirmacao
          titulo="Abrir a pesquisa agora?"
          texto={`A turma de cada professor fica gravada com os alunos de hoje (${turmaHoje} ${turmaHoje === 1 ? 'aluno' : 'alunos'}), e as perguntas não mudam mais. Só uma pesquisa fica aberta por vez.`}
          acao="Abrir pesquisa"
          ocupado={ocupado}
          onConfirmar={abrir}
          onVoltar={() => { setConfirmar(false); requestAnimationFrame(() => botao.current?.focus()); }}
        />
      ) : (
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" onClick={() => onEditar(pesquisa)} className={BOTAO}>Editar</button>
          <button ref={botao} type="button" disabled={Boolean(motivo)} title={motivo || undefined} onClick={() => setConfirmar(true)} className={BOTAO_PRI}>Abrir pesquisa</button>
        </div>
      )}
    </section>
  );
}

function Historico({ pesquisas, totaisPorPesquisa, hoje, onEditar }) {
  return (
    <section aria-label="Todas as pesquisas" className="overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      <div aria-hidden="true" className="hidden h-[42px] grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_110px_110px] items-center gap-3.5 px-[22px] text-[12.5px] font-medium text-muted-foreground lg:grid 2xl:grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_110px_110px_110px]">
        <span>Pesquisa</span><span>Período</span><span className="hidden 2xl:inline">Ciclo</span><span>Situação</span><span>Respostas</span>
      </div>
      {pesquisas.length === 0 ? (
        <p className="m-0 border-t border-border px-[22px] py-4 text-[13px] text-muted-foreground">Nenhuma pesquisa criada ainda.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {pesquisas.map((p) => {
            const estado = estadoDaPesquisa(p, hoje);
            const resp = totaisPorPesquisa.get(p.id) ?? 0;
            return (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3 lg:min-h-14 lg:grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_110px_110px] lg:gap-3.5 lg:px-[22px] lg:py-0 2xl:grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_110px_110px_110px]">
                <span className="min-w-0">
                  <b className="font-semibold">{p.nome}</b>
                  {estado === 'rascunho' && <button type="button" onClick={() => onEditar(p)} className={cn(LINK, 'ml-2')}>Editar<span className="sr-only"> {p.nome}</span></button>}
                </span>
                <span className="num text-[12.5px] text-muted-foreground lg:col-start-2 lg:row-start-1 lg:text-[13px]">{periodoTexto(p.inicio, p.fim)}</span>
                <span className="hidden text-[13px] text-muted-foreground 2xl:inline">{p.ciclo ? cicloCurto(p.ciclo) : ''}</span>
                <span><Selo estado={estado} /></span>
                <span className="num text-[13px] text-muted-foreground">{estado === 'rascunho' ? 'ainda não abriu' : `${resp} de ${somaDe(p.turmas)}`}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PesquisasTab({ db, appUser, pesquisas, totais, professores, turmasHoje, hoje, agora }) {
  const toast = useToast();
  const [editando, setEditando] = useState(null); // { id, form }
  const novaRef = useRef(null);
  const voltouRef = useRef(false);

  const profsPorId = useMemo(() => new Map((professores || []).map((p) => [p.id, p])), [professores]);
  const totaisPorId = useMemo(() => new Map((totais || []).map((t) => [`${t.pesquisaId}_${t.professorId}`, t])), [totais]);
  const totaisPorPesquisa = useMemo(() => {
    const m = new Map();
    (totais || []).forEach((t) => m.set(t.pesquisaId, (m.get(t.pesquisaId) ?? 0) + (Number(t.respostas) || 0)));
    return m;
  }, [totais]);
  const ordenadas = useMemo(() => [...(pesquisas || [])].sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))), [pesquisas]);
  const emCurso = pesquisaEmCurso(pesquisas, hoje);
  const proxima = [...ordenadas].reverse().find((p) => estadoDaPesquisa(p, hoje) === 'rascunho') ?? null;
  const turmaHoje = turmasHoje ? somaDe(turmasHoje) : null;

  // Na volta do formulário, o foco vai para o "Nova pesquisa".
  useEffect(() => {
    if (editando || !voltouRef.current) return;
    voltouRef.current = false;
    novaRef.current?.focus();
  }, [editando]);
  const voltar = () => { voltouRef.current = true; setEditando(null); };

  const falhou = (e, texto) => {
    console.error('pesquisas', e);
    toast.error(e?.paraTela ? e.message : texto);
  };
  const encerrar = async (p) => {
    try {
      await encerrarPesquisa(db, p.id);
      toast.success('Pesquisa encerrada.');
    } catch (e) { falhou(e, 'Não deu para encerrar a pesquisa. Tente de novo.'); }
  };
  const abrir = async (id) => {
    await abrirPesquisa(db, id, { turmas: turmasHoje, conhecidas: pesquisas, agora });
    toast.success('Pesquisa aberta.');
  };
  const abrirDaLista = async (p) => {
    try { await abrir(p.id); } catch (e) { falhou(e, 'Não deu para abrir a pesquisa. Tente de novo.'); }
  };

  if (editando) {
    return (
      <PesquisaForm
        id={editando.id}
        inicial={editando.form}
        turmaHoje={turmaHoje}
        outraAberta={emCurso && emCurso.id !== editando.id ? emCurso : null}
        onVoltar={voltar}
        onSalvar={async (form) => {
          try {
            await salvarRascunho(db, editando.id, form, appUser?.id ?? null);
            toast.success('Rascunho salvo.');
            voltar();
          } catch (e) { falhou(e, 'Não deu para salvar o rascunho. Tente de novo.'); }
        }}
        onAbrir={async (form) => {
          try {
            const id = await salvarRascunho(db, editando.id, form, appUser?.id ?? null);
            setEditando((ed) => (ed ? { ...ed, id } : ed));
            await abrir(id);
            voltar();
          } catch (e) { falhou(e, 'Não deu para abrir a pesquisa. Tente de novo.'); }
        }}
        onExcluir={async () => {
          try {
            await excluirRascunho(db, editando.id);
            toast.success('Rascunho excluído.');
            voltar();
          } catch (e) { falhou(e, 'Não deu para excluir o rascunho. Tente de novo.'); }
        }}
      />
    );
  }

  return (
    <div>
      <Destaque pesquisa={emCurso} totaisPorId={totaisPorId} profsPorId={profsPorId} hoje={hoje} onEncerrar={encerrar} />
      <div className={cn('grid grid-cols-1 items-start gap-4', proxima && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]')}>
        {proxima && <Proxima pesquisa={proxima} emCurso={emCurso} turmaHoje={turmaHoje} onEditar={(p) => setEditando({ id: p.id, form: doForm(p) })} onAbrir={abrirDaLista} />}
        <Historico pesquisas={ordenadas} totaisPorPesquisa={totaisPorPesquisa} hoje={hoje} onEditar={(p) => setEditando({ id: p.id, form: doForm(p) })} />
      </div>
      <p className="mt-4">
        <button ref={novaRef} type="button" onClick={() => setEditando({ id: null, form: novaPesquisa() })} className={BOTAO_PRI}>
          <Plus size={15} aria-hidden="true" />Nova pesquisa
        </button>
      </p>
    </div>
  );
}

