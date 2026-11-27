import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNpsDados } from '../../hooks/useNpsDados.js';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { useProfessoresDados } from '../../hooks/useProfessoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { dayKeyOf } from '../../lib/operacional/month.js';
import { cicloDe, limitesDoCiclo, semestresDoCiclo } from '../../lib/professor/ciclo.js';
import { estadoDaPesquisa, npsDoCiclo, resumoDaPesquisa, turmasDoDia } from '../../lib/professor/pesquisas.js';
import { conversaoDoCiclo } from '../../lib/professor/conversao.js';
import { renovacaoDoCiclo } from '../../lib/professor/renovacao.js';
import { FilterBar } from '../dashboard/DashFilterBar.jsx';
import { criterioAderencia, criterioConversao, criterioNps, criterioRenovacao } from './criterios.js';
import { aderenciaPorSemana, aderenciaResumo } from '../../lib/professor/aderencia.js';
import { LegendaDosEstados, ProfessoresTabela } from './ProfessoresTabela.jsx';
import { MetasForm } from './MetasForm.jsx';
import { PesquisasTab } from './PesquisasTab.jsx';
import { diaTexto, prazoTexto } from './pesquisasTexto.js';
import { CicloControl, TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';

// A tela Professores do gestor (mockup A de 25/11/2026): a lista de placar e
// as sub-telas Pesquisas (mockup B das pesquisas) e Metas. O ciclo mora no
// endereço (`ciclo`), e a aba é a sub-tela (/professores, /professores/pesquisas
// e /professores/metas), que o App troca com replace.
const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');

export function ProfessoresView({ db, appUser, tenantId, tab, onTab, listenersActive }) {
  // Um relógio só por montagem: as contas do ciclo cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const ctx = useMemo(() => ({ cicloAtual: cicloDe(agora) }), [agora]);
  const [{ ciclo }, setParams] = useScreenParams('professores', ctx);
  const dados = useProfessoresDados({ db, ciclo, listenersActive });
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas, metas, salvarMetas, trilhaProfessor } = dados;
  const nps = useNpsDados({ db, listenersActive });
  // O dia das pesquisas (prazo, situação, quando o Abrir libera) anda com o
  // relógio, para a aba aberta de um dia para o outro não ficar no dia velho.
  const relogio = useMinuteClock();
  const hoje = dayKeyOf(relogio);

  const ativos = useMemo(() => (professores || []).filter((p) => p.ativo !== false).sort(porNome), [professores]);

  const contas = useMemo(() => {
    if (carregando || !metas || nps.carregando) return null;
    const { janelaDias, tolerancia } = metas.conversao;
    const periodo = limitesDoCiclo(ciclo);
    const pecas = semestresDoCiclo(ciclo);
    const chave = String(ciclo);
    const linhas = ativos.map((prof) => {
      const renovacao = renovacaoDoCiclo({ leads: clientes, contratos, planos, professor: prof, periodo, asOf: agora });
      const conversao = conversaoDoCiclo({ aulas, contratos, professorId: prof.id, periodo, asOf: agora, janelaDias, tolerancia });
      return {
        prof,
        criterios: {
          renovacao: criterioRenovacao(renovacao, metas, prof.nivel),
          nps: criterioNps(npsDoCiclo({ pesquisas: nps.pesquisas, totais: nps.totais, professorId: prof.id, trilha: trilhaProfessor, chave, meta: metas.nps.meta }), metas),
          conversao: criterioConversao(conversao),
          aderencia: criterioAderencia(aderenciaResumo(aderenciaPorSemana({ presencas, leads: clientes, contratos, planos, professor: prof, asOf: agora, barra: metas.aderencia.barra }), pecas, agora), metas),
        },
      };
    });
    // A academia é a mesma para todos; sai da conta sem filtro de professor.
    const academia = conversaoDoCiclo({ aulas, contratos, professorId: null, periodo, asOf: agora, janelaDias, tolerancia });
    return { linhas, academia };
  }, [carregando, metas, nps.carregando, nps.pesquisas, nps.totais, ativos, clientes, contratos, planos, aulas, presencas, ciclo, agora, trilhaProfessor]);

  // A turma de cada professor se a pesquisa abrisse agora (o formulário e o
  // Abrir mostram o total). Null enquanto os clientes não chegaram.
  const turmasHoje = useMemo(
    () => (carregando ? null : turmasDoDia({ clientes, contratos, planos, professores, agora })),
    [carregando, clientes, contratos, planos, professores, agora],
  );

  const turmasDoMomento = (instante) => turmasDoDia({ clientes, contratos, planos, professores, agora: instante });

  const aba = tab === 'metas' || tab === 'pesquisas' ? tab : 'lista';
  const academiaTaxa = contas?.academia.academia.taxa ?? null;

  return (
    <div className="-m-4 animate-fade-in md:-m-8">
      <FilterBar
        title="Professores"
        subline="Plano de carreira do time técnico. Os números são do ciclo de avaliação, de dezembro a novembro."
      >
        <CicloControl ciclo={ciclo} cicloAtual={ctx.cicloAtual} onCiclo={(c) => setParams({ ciclo: c })} />
      </FilterBar>

      <div className="px-4 pb-8 pt-2 md:px-8">
        <Tabs value={aba} onValueChange={(id) => onTab?.(id === 'lista' ? null : id)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
            <TabsTrigger value="lista" className={TAB_TRIGGER}>
              Professores
              <span className={TAB_CONTAGEM}>{ativos.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pesquisas" className={TAB_TRIGGER}>Pesquisas</TabsTrigger>
            <TabsTrigger value="metas" className={TAB_TRIGGER}>Metas</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" tabIndex={-1}>
            {erro && <p role="alert" className="mb-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}
            {!contas ? (
              <p className="text-[13px] text-muted-foreground">Carregando os professores…</p>
            ) : ativos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
                Nenhum professor ativo. Cadastre em Configurações, Equipe & acessos, no cartão Professores.
              </div>
            ) : (
              <>
                <CartaoDaPesquisa nps={nps} hoje={hoje} onVer={() => onTab?.('pesquisas')} />
                <p className="mb-3 flex flex-wrap gap-x-[22px] gap-y-2 text-[13.5px] text-foreground/80">
                  <span>
                    <b className="font-bold">Conversão da academia:</b>{' '}
                    {academiaTaxa == null ? 'ainda sem aulas que contam no ciclo.' : `${academiaTaxa}%, a régua de todos.`}
                  </span>
                  {contas.academia.incompleto && <span className="text-muted-foreground">As aulas de antes de setembro de 2026 estão incompletas no sistema.</span>}
                </p>
                <ProfessoresTabela linhas={contas.linhas} tenantId={tenantId} />
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

          <TabsContent value="metas" tabIndex={-1}>
            {metas
              ? <MetasForm metas={metas} salvarMetas={salvarMetas} academia={academiaTaxa} />
              : <p className="text-[13px] text-muted-foreground">Carregando as metas…</p>}
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
