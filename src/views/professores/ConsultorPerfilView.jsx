import { useMemo, useState } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appId, USERS_PATH } from '../../lib/firebase.js';
import { isGestor } from '../../lib/acesso.js';
import { hrefFor } from '../../lib/routes.js';
import { trilhaDaPessoa, trilhaSugerida } from '../../lib/carreira/trilhas.js';
import { placarDe, tempoNoNivel } from '../../lib/carreira/placar.js';
import { periodoDaPessoa } from '../../lib/carreira/professor.js';
import { consultoresDaCarreira, contasDoConsultor } from '../../lib/carreiraConsultor.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useCarreira } from '../../hooks/useCarreira.js';
import { useConsultoresDados } from '../../hooks/useConsultoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { ConversaoTab, MetaDiariaTab, RenovacaoTab, VendasTab } from './ConsultorAbas.jsx';
import { PerfilCabecalho } from './PerfilCabecalho.jsx';
import { PlacarDaCarreira } from './PlacarDaCarreira.jsx';
import { TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';

// O perfil do consultor no plano de carreira (PR 4), no desenho do perfil do
// professor: cabeçalho com a trilha, o nível e o tempo no nível, o placar do
// período e as abas Vendas, Renovação, Conversão e Meta diária. O gestor abre
// qualquer consultor e troca a trilha e o nível; o consultor logado chega só
// ao próprio (a rota garante) e lê. O período mora no endereço (`ciclo`).
const LINK = 'rounded outline-none focus-visible:anel-foco';
const ABAS = ['vendas', 'renovacao', 'conversao', 'meta'];

export function ConsultorPerfilView({ db, appUser, tenantId, profId, tab, onTab, usersList, funnels, liveLeads, interactions, listenersActive }) {
  const toast = useToast();
  // Um relógio só por montagem: as contas do período cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const pessoa = useMemo(() => consultoresDaCarreira(usersList).find((u) => u.id === profId) ?? null, [usersList, profId]);
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const trilhasDeConsultor = useMemo(() => (trilhas || []).filter((t) => t.base === 'consultor'), [trilhas]);
  const trilha = useMemo(() => trilhaDaPessoa(pessoa, trilhasDeConsultor), [pessoa, trilhasDeConsultor]);

  const ctx = useMemo(() => ({ trilha, agora }), [trilha, agora]);
  const [{ ciclo }, setParams] = useScreenParams('consultorPerfil', ctx);
  const periodo = useMemo(() => (trilha ? periodoDaPessoa(trilha, ciclo, agora) : null), [trilha, ciclo, agora]);

  const dados = useConsultoresDados({
    db, consultantId: profId, agora, liveLeads, interactions, listenersActive,
    inicioMs: periodo?.inicio.getTime() ?? null,
    fimMs: periodo?.fim.getTime() ?? null,
  });
  const { carregando, crm, contratos, clientesPorId, graceDays, metaWeekdays, history } = dados;

  const contas = useMemo(() => {
    if (carregando || carreira === null || !pessoa || !trilha || !periodo) return null;
    const c = contasDoConsultor({ trilha, periodo, pessoa, crm, users: usersList, funnels, contratos, clientesPorId, graceDays, metaWeekdays, history, agora });
    return { ...c, placar: placarDe(trilha, pessoa.nivel, c.resultados) };
  }, [carregando, carreira, pessoa, trilha, periodo, crm, usersList, funnels, contratos, clientesPorId, graceDays, metaWeekdays, history, agora]);

  const pode = isGestor(appUser);
  const logado = appUser?.id === profId && !pode;

  const salvarTrilhaENivel = async ({ trilhaId, nivel, desde }) => {
    if (!pode) return false;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, pessoa.id), { trilhaId, nivel, nivelDesde: Timestamp.fromDate(desde) });
      toast.success('Trilha e nível salvos.');
      return true;
    } catch (e) {
      console.error('Erro ao salvar a trilha e o nível do consultor:', e);
      toast.error('Não deu para salvar. Tente de novo.');
      return false;
    }
  };

  const voltar = pode && (
    <AppLink to={hrefFor(tenantId, 'professores')} aria-label="Voltar para Carreira" className={`${LINK} mb-3.5 inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-brand-700 dark:hover:text-brand-300`}>
      <ChevronLeft size={16} aria-hidden="true" />Carreira
    </AppLink>
  );

  if (!pessoa) {
    return (
      <div className="mx-auto max-w-[1240px] animate-fade-in">
        {!usersList?.length ? (
          <p className="text-[13px] text-muted-foreground">Carregando o perfil…</p>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-[14px]">
            <p className="m-0 font-semibold">Não achamos esse consultor.</p>
            {pode && (
              <AppLink to={hrefFor(tenantId, 'professores')} className={`${LINK} mt-2 inline-block font-semibold text-brand-700 hover:underline dark:text-brand-300`}>
                Ver a lista da equipe
              </AppLink>
            )}
          </div>
        )}
      </div>
    );
  }

  const primeiroNome = pessoa.nome.trim().split(/\s+/)[0] || 'o consultor';
  const aba = ABAS.includes(tab) ? tab : 'vendas';

  return (
    <div className="mx-auto max-w-[1240px] animate-fade-in pb-12">
      {voltar}
      {logado && (
        <p className="mb-3.5 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Eye size={16} aria-hidden="true" className="flex-none" />
          Só leitura. Quem troca trilha, nível e metas é o gestor.
        </p>
      )}

      <PerfilCabecalho
        prof={pessoa}
        pode={pode}
        trilhas={trilhasDeConsultor}
        trilha={trilha}
        sugeridaId={trilhaSugerida({ base: 'consultor' }, trilhasDeConsultor)?.id ?? null}
        tempo={trilha ? tempoNoNivel(trilha, pessoa, agora) : null}
        onSalvarTrilha={salvarTrilhaENivel}
        semNome="Consultor sem nome"
      />

      {(dados.erro || carreira?.erro) && <p role="alert" className="mt-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}

      {trilhas && !trilha ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Sem trilha. Defina a trilha e o nível no cabeçalho.</p>
      ) : !contas ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Carregando os números do período…</p>
      ) : (
        <>
          <PlacarDaCarreira
            titulo={logado ? 'Onde você está no plano de carreira' : `Onde ${primeiroNome} está no plano de carreira`}
            trilha={trilha}
            periodo={periodo}
            agora={agora}
            onChave={(c) => setParams({ ciclo: c })}
            placar={contas.placar}
            detalhes={{
              vendasEm: contas.vendasEm,
              vendas: contas.vendas,
              consultorConversao: contas.conversao,
              consultorRenovacao: contas.renovacao,
              metaDiaria: contas.metaDiaria,
            }}
          />

          <Tabs value={aba} onValueChange={(id) => onTab?.(id === 'vendas' ? null : id)} className="mt-7 gap-4">
            <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
              <TabsTrigger value="vendas" className={TAB_TRIGGER}>Vendas <span className={TAB_CONTAGEM}>{contas.vendas.quantidade}</span></TabsTrigger>
              <TabsTrigger value="renovacao" className={TAB_TRIGGER}>Renovação <span className={TAB_CONTAGEM}>{contas.renovacao.linhas.length}</span></TabsTrigger>
              <TabsTrigger value="conversao" className={TAB_TRIGGER}>Conversão <span className={TAB_CONTAGEM}>{contas.conversao.linhas.length}</span></TabsTrigger>
              <TabsTrigger value="meta" className={TAB_TRIGGER}>Meta diária</TabsTrigger>
            </TabsList>
            <TabsContent value="vendas" tabIndex={-1}><VendasTab vendas={contas.vendas} /></TabsContent>
            <TabsContent value="renovacao" tabIndex={-1}><RenovacaoTab renovacao={contas.renovacao} /></TabsContent>
            <TabsContent value="conversao" tabIndex={-1}><ConversaoTab conversao={contas.conversao} /></TabsContent>
            <TabsContent value="meta" tabIndex={-1}><MetaDiariaTab metaDiaria={contas.metaDiaria} /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
