import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfessoresDados } from '../../hooks/useProfessoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { PRIMEIRO_CICLO } from '../../lib/screenParams.js';
import { cicloDe } from '../../lib/professor/ciclo.js';
import { conversaoDoCiclo } from '../../lib/professor/conversao.js';
import { renovacaoDoCiclo } from '../../lib/professor/renovacao.js';
import { FilterBar } from '../dashboard/DashFilterBar.jsx';
import { CRITERIO_ADERENCIA, CRITERIO_NPS, criterioConversao, criterioRenovacao } from './criterios.js';
import { LegendaDosEstados, ProfessoresTabela } from './ProfessoresTabela.jsx';
import { MetasForm } from './MetasForm.jsx';

// A tela Professores do gestor (mockup A de 25/11/2026): a lista de placar e
// a sub-tela Metas. O ciclo mora no endereço (`ciclo`), e a aba é a sub-tela
// (/professores e /professores/metas), que o App troca com replace.
const TAB_TRIGGER = 'h-10 flex-none rounded-t-lg px-3 text-[13.5px] font-medium text-muted-foreground hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground after:rounded-full after:bg-brand-600 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]';
const SETA = 'grid size-[30px] flex-none place-items-center rounded-[9px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:anel-foco disabled:pointer-events-none disabled:opacity-35';

const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');

function CicloControl({ ciclo, cicloAtual, onCiclo }) {
  return (
    <div role="group" aria-label="Ciclo de avaliação" className="flex h-[38px] items-center gap-0.5 rounded-xl border border-border bg-card p-[3px] shadow-card">
      <button type="button" aria-label="Ciclo anterior" disabled={ciclo <= PRIMEIRO_CICLO} onClick={() => onCiclo(ciclo - 1)} className={SETA}>
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <span className="num whitespace-nowrap px-1.5 text-[13px] font-semibold">Ciclo dez/{ciclo - 1} a nov/{ciclo}</span>
      <button type="button" aria-label="Próximo ciclo" disabled={ciclo >= cicloAtual} onClick={() => onCiclo(ciclo + 1)} className={SETA}>
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

export function ProfessoresView({ db, tenantId, tab, onTab, listenersActive }) {
  // Um relógio só por montagem: as contas do ciclo cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const ctx = useMemo(() => ({ cicloAtual: cicloDe(agora) }), [agora]);
  const [{ ciclo }, setParams] = useScreenParams('professores', ctx);
  const dados = useProfessoresDados({ db, ciclo, listenersActive });
  const { carregando, erro, professores, planos, contratos, clientes, aulas, metas, salvarMetas } = dados;

  const ativos = useMemo(() => (professores || []).filter((p) => p.ativo !== false).sort(porNome), [professores]);

  const contas = useMemo(() => {
    if (carregando || !metas) return null;
    const { janelaDias, tolerancia } = metas.conversao;
    const linhas = ativos.map((prof) => {
      const renovacao = renovacaoDoCiclo({ leads: clientes, contratos, planos, professor: prof, ciclo, asOf: agora });
      const conversao = conversaoDoCiclo({ aulas, contratos, professorId: prof.id, ciclo, asOf: agora, janelaDias, tolerancia });
      return {
        prof,
        criterios: {
          renovacao: criterioRenovacao(renovacao, metas, prof.nivel),
          nps: CRITERIO_NPS,
          conversao: criterioConversao(conversao),
          aderencia: CRITERIO_ADERENCIA,
        },
      };
    });
    // A academia é a mesma para todos; sai da conta sem filtro de professor.
    const academia = conversaoDoCiclo({ aulas, contratos, professorId: null, ciclo, asOf: agora, janelaDias, tolerancia });
    return { linhas, academia };
  }, [carregando, metas, ativos, clientes, contratos, planos, aulas, ciclo, agora]);

  const aba = tab === 'metas' ? 'metas' : 'lista';
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
          <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
            <TabsTrigger value="lista" className={TAB_TRIGGER}>
              Professores
              <span className="rounded-full bg-muted px-[7px] py-px text-[12px] font-semibold text-muted-foreground">{ativos.length}</span>
            </TabsTrigger>
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
