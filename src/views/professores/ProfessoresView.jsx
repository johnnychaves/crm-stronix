import { useCallback, useMemo, useState } from 'react';
import { ClipboardList, Route, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCarreira } from '../../hooks/useCarreira.js';
import { useNpsDados } from '../../hooks/useNpsDados.js';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { useProfessoresDados } from '../../hooks/useProfessoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { hrefFor } from '../../lib/routes.js';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { trilhaDaPessoa } from '../../lib/carreira/trilhas.js';
import { placarDe, tempoNoNivel } from '../../lib/carreira/placar.js';
import { contasDoProfessor, janelaDeLeitura, periodoDaPessoa } from '../../lib/carreira/professor.js';
import { dayKeyOf } from '../../lib/operacional/month.js';
import { estadoDaPesquisa, resumoDaPesquisa, turmasDoDia } from '../../lib/professor/pesquisas.js';
import { FilterBar, FilterChip } from '../dashboard/DashFilterBar.jsx';
import { LegendaDosEstados, ProfessoresTabela } from './ProfessoresTabela.jsx';
import { PesquisasTab } from './PesquisasTab.jsx';
import { diaTexto, prazoTexto } from './pesquisasTexto.js';
import { PeriodoControl, TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';

// A lista Carreira do gestor (mockup "Lista Carreira", 26/11/2026) e a
// sub-tela Pesquisas (mockup B das pesquisas). A trilha da pílula e o período
// moram no endereço (`trilha` e `ciclo`), e a aba é a sub-tela (/carreira e
// /carreira/pesquisas), que o App troca com replace. A busca pelo nome fica
// fora do endereço de propósito. As metas moram em Configurações → Plano de
// carreira.
const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ProfessoresView({ db, appUser, tenantId, tab, onTab, listenersActive }) {
  // Um relógio só por montagem: as contas do período cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  // Neste PR só as trilhas de professor (a de consultor entra no PR 4).
  const trilhasDeProfessor = useMemo(() => (trilhas || []).filter((t) => t.base === 'professor'), [trilhas]);
  const ctx = useMemo(() => ({ trilhas: trilhasDeProfessor, agora }), [trilhasDeProfessor, agora]);
  const [{ trilha: trilhaId, ciclo }, setParams] = useScreenParams('professores', ctx);
  const escolhida = trilhasDeProfessor.find((t) => t.id === trilhaId) ?? null;

  // A janela de leitura: o período escolhido da trilha da pílula, ou os
  // períodos de agora de todas as trilhas de professor.
  const janela = useMemo(() => {
    if (!trilhas) return null;
    const alvo = escolhida ? [escolhida] : trilhasDeProfessor;
    return janelaDeLeitura(alvo.map((t) => periodoDaPessoa(t, t === escolhida ? ciclo : null, agora)));
  }, [trilhas, escolhida, trilhasDeProfessor, ciclo, agora]);

  const dados = useProfessoresDados({ db, inicioMs: janela?.inicio.getTime() ?? null, fimMs: janela?.fim.getTime() ?? null, listenersActive });
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas } = dados;
  const nps = useNpsDados({ db, listenersActive });
  // O dia das pesquisas anda com o relógio, para a aba aberta de um dia para o
  // outro não ficar no dia velho.
  const relogio = useMinuteClock();
  const hoje = dayKeyOf(relogio);
  const [busca, setBusca] = useState('');

  const ativos = useMemo(() => (professores || []).filter((p) => p.ativo !== false).sort(porNome), [professores]);
  const trilhaDe = useCallback((prof) => trilhaDaPessoa(prof, trilhasDeProfessor, { professor: true }), [trilhasDeProfessor]);

  // A contagem da pílula: quantas pessoas ativas em cada trilha.
  const contagem = useMemo(() => {
    const c = new Map();
    ativos.forEach((p) => { const t = trilhaDe(p); if (t) c.set(t.id, (c.get(t.id) ?? 0) + 1); });
    return c;
  }, [ativos, trilhaDe]);

  const linhas = useMemo(() => {
    if (carregando || carreira === null || nps.carregando) return null;
    return ativos
      .filter((prof) => !escolhida || trilhaDe(prof)?.id === escolhida.id)
      .map((prof) => {
        const trilha = trilhaDe(prof);
        if (!trilha) return { prof, trilha: null, placar: placarDe(null, null, {}), tempo: null, desde: null };
        const periodo = periodoDaPessoa(trilha, trilha === escolhida ? ciclo : null, agora);
        const contas = contasDoProfessor({ trilha, periodo, prof, clientes, contratos, planos, aulas, presencas, nps, agora });
        return {
          prof,
          trilha,
          placar: placarDe(trilha, prof.nivel, contas.resultados),
          tempo: tempoNoNivel(trilha, prof, agora),
          desde: getSafeDateOrNull(prof.nivelDesde)?.toLocaleDateString('pt-BR') ?? null,
        };
      });
  }, [carregando, carreira, nps, ativos, escolhida, trilhaDe, ciclo, agora, clientes, contratos, planos, aulas, presencas]);

  const visiveis = linhas && busca.trim()
    ? linhas.filter((l) => semAcento(l.prof.nome).includes(semAcento(busca.trim())))
    : linhas;

  // A turma de cada professor se a pesquisa abrisse agora (o formulário e o
  // Abrir mostram o total). Null enquanto os clientes não chegaram.
  const turmasHoje = useMemo(
    () => (carregando ? null : turmasDoDia({ clientes, contratos, planos, professores, agora })),
    [carregando, clientes, contratos, planos, professores, agora],
  );

  const turmasDoMomento = (instante) => turmasDoDia({ clientes, contratos, planos, professores, agora: instante });

  const aba = tab === 'pesquisas' ? tab : 'lista';
  const configHref = hrefFor(tenantId, 'settings', { sub: 'carreira' });
  const periodoEscolhido = escolhida ? periodoDaPessoa(escolhida, ciclo, agora) : null;
  const opcoesDaTrilha = [
    { key: 'todas', label: 'Todas as trilhas', note: String(ativos.length) },
    ...trilhasDeProfessor
      .filter((t) => !t.arquivada || contagem.get(t.id))
      .map((t) => ({ key: t.id, label: t.nome, note: String(contagem.get(t.id) ?? 0) })),
  ];

  return (
    <div className="-m-4 animate-fade-in md:-m-8">
      <FilterBar
        title="Carreira"
        subline="Plano de carreira da equipe. Cada trilha tem o próprio período de avaliação."
      >
        <FilterChip
          icon={Route}
          label="Trilha"
          valueText={escolhida ? escolhida.nome : 'Todas'}
          active={Boolean(escolhida)}
          options={opcoesDaTrilha}
          value={escolhida ? escolhida.id : 'todas'}
          onPick={(k) => setParams({ trilha: k === 'todas' ? null : k, ciclo: null })}
        />
        {escolhida && periodoEscolhido && (
          <PeriodoControl trilha={escolhida} periodo={periodoEscolhido} agora={agora} onChave={(c) => setParams({ ciclo: c })} />
        )}
        {configHref && (
          <AppLink to={configHref} className="inline-flex h-[38px] items-center rounded-xl border border-border bg-card px-3 text-[13px] font-semibold shadow-card outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
            Configurar trilhas
          </AppLink>
        )}
      </FilterBar>

      <div className="px-4 pb-8 pt-2 md:px-8">
        <Tabs value={aba} onValueChange={(id) => onTab?.(id === 'lista' ? null : id)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
            <TabsTrigger value="lista" className={TAB_TRIGGER}>
              Pessoas
              <span className={TAB_CONTAGEM}>{escolhida ? contagem.get(escolhida.id) ?? 0 : ativos.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pesquisas" className={TAB_TRIGGER}>Pesquisas</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" tabIndex={-1}>
            {erro && <p role="alert" className="mb-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}
            {!visiveis ? (
              <p className="text-[13px] text-muted-foreground">Carregando a equipe…</p>
            ) : ativos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
                Nenhum professor ativo. Cadastre em Configurações, Equipe & acessos, no cartão Professores.
              </div>
            ) : (
              <>
                <CartaoDaPesquisa nps={nps} hoje={hoje} onVer={() => onTab?.('pesquisas')} />
                <label className="mb-3 flex h-[38px] max-w-[320px] items-center gap-2 rounded-xl border border-border bg-card px-3 shadow-card focus-within:anel-foco">
                  <Search size={15} aria-hidden="true" className="flex-none text-muted-foreground" />
                  <span className="sr-only">Buscar pelo nome</span>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pelo nome"
                    autoComplete="off"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  />
                </label>
                {visiveis.length === 0
                  ? <p className="text-[13px] text-muted-foreground">Ninguém com esse nome.</p>
                  : <ProfessoresTabela linhas={visiveis} tenantId={tenantId} />}
                <LegendaDosEstados />
              </>
            )}
          </TabsContent>

          <TabsContent value="pesquisas" tabIndex={-1}>
            {nps.erro && <p role="alert" className="mb-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para ler as pesquisas. Recarregue a página.</p>}
            {nps.carregando
              ? <p className="text-[13px] text-muted-foreground">Carregando as pesquisas…</p>
              : <PesquisasTab db={db} appUser={appUser} tenantId={tenantId} pesquisas={nps.pesquisas} totais={nps.totais} professores={professores} turmasHoje={turmasHoje} turmasDoMomento={turmasDoMomento} hoje={hoje} agora={agora} />}
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

// O cartão da pesquisa em cima da lista (mockup A): a pesquisa aberta com o
// andamento, ou a última que houve.
function CartaoDaPesquisa({ nps, hoje, onVer }) {
  const resumo = resumoDaPesquisa(nps.pesquisas, nps.totais, hoje);
  const ultima = resumo ? null : [...nps.pesquisas]
    .filter((p) => estadoDaPesquisa(p, hoje) === 'encerrada')
    .sort((a, b) => String(b.fim).localeCompare(String(a.fim)))[0];
  const pct = resumo && resumo.turma > 0 ? Math.round((resumo.respostas / resumo.turma) * 100) : 0;
  // Aberta antes do início, a pesquisa ainda não aceita resposta.
  const comecou = resumo ? hoje >= resumo.pesquisa.inicio : false;
  return (
    <section aria-label="Pesquisa dos alunos" className="mb-4 flex flex-wrap items-center gap-4 rounded-[18px] border border-border bg-card px-[18px] py-3.5 shadow-card">
      <span aria-hidden="true" className={cn('grid size-[38px] flex-none place-items-center rounded-xl', resumo ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'bg-muted text-muted-foreground')}>
        <ClipboardList size={19} />
      </span>
      <div className="min-w-0 flex-[1_1_260px]">
        <b className="block font-semibold">{!resumo ? 'Nenhuma pesquisa aberta' : comecou ? `${resumo.pesquisa.nome}, aberta até ${diaTexto(resumo.pesquisa.fim).slice(0, 5)}` : `${resumo.pesquisa.nome}, ${prazoTexto(resumo.pesquisa, hoje)}`}</b>
        <span className="text-[13px] text-muted-foreground">
          {resumo
            ? `${resumo.respostas} ${resumo.respostas === 1 ? 'resposta' : 'respostas'} de ${resumo.turma} alunos nas turmas dos professores.`
            : ultima ? `A última foi a ${ultima.nome}, encerrada.` : 'Crie a primeira na aba Pesquisas.'}
        </span>
      </div>
      {resumo && comecou && (
        <div aria-hidden="true" className="h-2 flex-[0_1_220px] overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <i className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      <button type="button" onClick={onVer} className="inline-flex h-[34px] items-center whitespace-nowrap rounded-[10px] border border-border bg-card px-3 text-[13px] font-semibold outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
        Ver pesquisas
      </button>
    </section>
  );
}
