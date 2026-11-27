import { useMemo, useState } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';
import { doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appId, PROFESSORS_PATH, storage } from '../../lib/firebase.js';
import { isGestor, isProfessor } from '../../lib/acesso.js';
import { hrefFor } from '../../lib/routes.js';
import { professorModalityNames } from '../../lib/professores.js';
import { deleteProfessorPhoto, uploadProfessorPhoto } from '../../lib/professorPhoto.js';
import { npsLinkDe } from '../../lib/npsLink.js';
import { gerarNovoLink } from '../../lib/npsWrites.js';
import { baixarQr } from '../../lib/qrPng.js';
import { trilhaDaPessoa, trilhaSugerida } from '../../lib/carreira/trilhas.js';
import { placarDe, tempoNoNivel } from '../../lib/carreira/placar.js';
import { contasDoProfessor, periodoDaPessoa } from '../../lib/carreira/professor.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useCarreira } from '../../hooks/useCarreira.js';
import { useProfessoresDados } from '../../hooks/useProfessoresDados.js';
import { useNpsDados } from '../../hooks/useNpsDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { PhotoCaptureMenu } from '../../components/profile/PhotoCaptureMenu.jsx';
import { AderenciaTab } from './AderenciaTab.jsx';
import { AulasTab } from './AulasTab.jsx';
import { CarteiraTab } from './CarteiraTab.jsx';
import { NpsTab } from './NpsTab.jsx';
import { PerfilCabecalho } from './PerfilCabecalho.jsx';
import { PlacarDaCarreira } from './PlacarDaCarreira.jsx';
import { TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';

// O perfil do professor (mockups B de 24/11/2026 e "Trilha e nível" de
// 26/11/2026): cabeçalho, placar do período da trilha e as abas Carteira, Aulas
// experimentais, NPS e Aderência. O gestor abre qualquer perfil e é o único
// que troca a foto, a trilha e o nível; o professor logado só chega ao próprio
// (a rota garante) e vê tudo só para leitura. O período mora no endereço
// (`ciclo`, a chave do período da trilha) e a aba é a sub-tela, que o App
// troca com replace.
const LINK = 'rounded outline-none focus-visible:anel-foco';

export function ProfessorPerfilView({ db, appUser, tenantId, profId, tab, onTab, listenersActive }) {
  const toast = useToast();
  // Um relógio só por montagem: as contas do período cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const { professores: professoresDoApp, modalities } = useGeneralConfig();
  const prof = useMemo(() => (professoresDoApp || []).find((p) => p.id === profId) ?? null, [professoresDoApp, profId]);
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const trilhasDeProfessor = useMemo(() => (trilhas || []).filter((t) => t.base === 'professor'), [trilhas]);
  // Sem o professor (ainda não chegou, ou não existe), vale a trilha Professor,
  // para a janela de leitura existir e o "Não achamos" aparecer depois dela.
  const trilha = useMemo(() => trilhaDaPessoa(prof, trilhasDeProfessor, { professor: true }), [prof, trilhasDeProfessor]);

  const ctx = useMemo(() => ({ trilha, agora }), [trilha, agora]);
  const [{ ciclo }, setParams] = useScreenParams('professorPerfil', ctx);
  const periodo = useMemo(() => (trilha ? periodoDaPessoa(trilha, ciclo, agora) : null), [trilha, ciclo, agora]);

  const { carregando, erro, planos, contratos, clientes, aulas, presencas } = useProfessoresDados({
    db, inicioMs: periodo?.inicio.getTime() ?? null, fimMs: periodo?.fim.getTime() ?? null, listenersActive,
  });

  const pode = isGestor(appUser);
  const professorLogado = isProfessor(appUser);
  // O professor só lê os próprios totais: a consulta dele vem filtrada, que é
  // o que a regra aceita.
  const nps = useNpsDados({ db, professorId: professorLogado ? appUser?.professorId ?? null : null, listenersActive });
  const planosById = useMemo(() => new Map((planos || []).map((p) => [p.id, p])), [planos]);
  const clientesPorId = useMemo(() => new Map((clientes || []).map((l) => [l.id, l])), [clientes]);

  const contas = useMemo(() => {
    if (carregando || carreira === null || !prof || !trilha || !periodo || nps.carregando) return null;
    const c = contasDoProfessor({ trilha, periodo, prof, clientes, contratos, planos, aulas, presencas, nps, agora });
    return { ...c, placar: placarDe(trilha, prof.nivel, c.resultados) };
  }, [carregando, carreira, prof, trilha, periodo, clientes, contratos, planos, aulas, presencas, nps, agora]);

  const [fotoAberta, setFotoAberta] = useState(false);
  const [fotoOcupada, setFotoOcupada] = useState(false);
  const profRef = () => doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, prof.id);

  // Como a foto da ficha: escolheu, sobe para o Storage e grava na hora.
  const salvarFoto = async (blob) => {
    if (!pode) return;
    setFotoOcupada(true);
    try {
      const { url, path } = await uploadProfessorPhoto(storage, appId, prof.id, blob);
      await updateDoc(profRef(), { photoUrl: url, photoPath: path, photoUpdatedAt: serverTimestamp() });
      toast.success('Foto atualizada.');
    } catch (e) {
      console.error('Erro ao salvar a foto do professor:', e);
      toast.error(e?.code === 'storage/unauthorized'
        ? 'Sem permissão no Storage. Publique as regras no console do Firebase.'
        : 'Não foi possível salvar a foto. Tente novamente.');
    } finally {
      setFotoOcupada(false);
    }
  };
  const removerFoto = async () => {
    if (!pode) return;
    setFotoOcupada(true);
    try {
      await updateDoc(profRef(), { photoUrl: null, photoPath: null, photoUpdatedAt: serverTimestamp() });
      // O professor já não aponta para o arquivo; apagar é só limpeza.
      if (prof.photoPath) deleteProfessorPhoto(storage, prof.photoPath).catch(() => {});
      toast.success('Foto removida.');
    } catch (e) {
      console.error('Erro ao remover a foto do professor:', e);
      toast.error('Não foi possível remover a foto.');
    } finally {
      setFotoOcupada(false);
    }
  };

  const salvarTrilhaENivel = async ({ trilhaId, nivel, desde }) => {
    if (!pode) return false;
    try {
      await updateDoc(profRef(), { trilhaId, nivel, nivelDesde: Timestamp.fromDate(desde) });
      toast.success('Trilha e nível salvos.');
      return true;
    } catch (e) {
      console.error('Erro ao salvar a trilha e o nível do professor:', e);
      toast.error('Não deu para salvar. Tente de novo.');
      return false;
    }
  };

  // O link do NPS: o professor copia e baixa o QR; só o gestor gera.
  const link = npsLinkDe(window.location.origin, tenantId, prof?.npsCode);
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não deu para copiar. Selecione o link e copie.');
    }
  };
  const baixarQrCode = async () => {
    try {
      const nome = String(prof.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await baixarQr(link, `qr-nps-${nome || 'professor'}.png`);
    } catch (e) {
      console.error('Erro ao gerar o QR code:', e);
      toast.error('Não deu para gerar o QR code. Tente de novo.');
    }
  };
  const gerarLink = async () => {
    if (!pode) return;
    try {
      await gerarNovoLink(db, prof.id);
      toast.success('Link novo gerado.');
    } catch (e) {
      console.error('Erro ao gerar o link do NPS:', e);
      toast.error('Não deu para gerar o link. Tente de novo.');
    }
  };

  const voltar = pode && (
    <AppLink to={hrefFor(tenantId, 'professores')} aria-label="Voltar para Carreira" className={`${LINK} mb-3.5 inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-brand-700 dark:hover:text-brand-300`}>
      <ChevronLeft size={16} aria-hidden="true" />Carreira
    </AppLink>
  );

  if (!prof) {
    return (
      <div className="mx-auto max-w-[1240px] animate-fade-in">
        {carregando ? (
          <p className="text-[13px] text-muted-foreground">Carregando o perfil…</p>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-[14px]">
            <p className="m-0 font-semibold">Não achamos esse professor.</p>
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

  const modalidades = professorModalityNames(prof, modalities);
  const modalidadesTexto = modalidades.length ? modalidades.map((m) => m.toLowerCase()).join(', ') : 'sem modalidade';
  const primeiroNome = String(prof.nome || '').trim().split(/\s+/)[0] || 'o professor';
  const aba = ['aulas', 'nps', 'aderencia'].includes(tab) ? tab : 'carteira';

  return (
    <div className="mx-auto max-w-[1240px] animate-fade-in pb-12">
      {voltar}
      {professorLogado && (
        <p className="mb-3.5 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Eye size={16} aria-hidden="true" className="flex-none" />
          Só leitura. Quem troca trilha, nível e metas é o gestor.
        </p>
      )}

      <PerfilCabecalho
        prof={prof}
        modalidades={modalidades}
        pode={pode}
        fotoOcupada={fotoOcupada}
        onFoto={() => setFotoAberta(true)}
        trilhas={trilhasDeProfessor}
        trilha={trilha}
        sugeridaId={trilhaSugerida({ base: 'professor', modalidadeIds: prof.modalidadeIds }, trilhasDeProfessor)?.id ?? null}
        tempo={trilha ? tempoNoNivel(trilha, prof, agora) : null}
        onSalvarTrilha={salvarTrilhaENivel}
        link={link}
        onCopiar={copiarLink}
        onBaixarQr={baixarQrCode}
        onGerarLink={gerarLink}
      />
      {nps.erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para ler a pesquisa dos alunos. Recarregue a página.</p>}

      {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}

      {trilhas && !trilha ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Sem trilha. Defina a trilha e o nível no cabeçalho.</p>
      ) : !contas ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Carregando os números do período…</p>
      ) : (
        <>
          <PlacarDaCarreira
            titulo={professorLogado ? 'Onde você está no plano de carreira' : `Onde ${primeiroNome} está no plano de carreira`}
            trilha={trilha}
            periodo={periodo}
            agora={agora}
            onChave={(c) => setParams({ ciclo: c })}
            placar={contas.placar}
            detalhes={{ renovacao: contas.renovacao, conversao: contas.conversao, nps: contas.nps, aderencia: contas.aderencia, barra: trilha.ajustes.barra ?? 2 }}
          />

          <Tabs value={aba} onValueChange={(id) => onTab?.(id === 'carteira' ? null : id)} className="mt-7 gap-4">
            <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
              <TabsTrigger value="carteira" className={TAB_TRIGGER}>
                Carteira <span className={TAB_CONTAGEM}>{contas.carteira.length}</span>
              </TabsTrigger>
              <TabsTrigger value="aulas" className={TAB_TRIGGER}>
                Aulas experimentais <span className={TAB_CONTAGEM}>{contas.pessoas.length}</span>
              </TabsTrigger>
              <TabsTrigger value="nps" className={TAB_TRIGGER}>NPS</TabsTrigger>
              <TabsTrigger value="aderencia" className={TAB_TRIGGER}>Aderência</TabsTrigger>
            </TabsList>
            <TabsContent value="carteira" tabIndex={-1}>
              <CarteiraTab
                linhas={contas.carteira}
                planosById={planosById}
                agora={agora}
                professorLogado={professorLogado}
                descricao={professorLogado
                  ? `Seus clientes em planos de ${modalidadesTexto}.`
                  : `Clientes com ${primeiroNome} no cadastro, em planos de ${modalidadesTexto}.`}
              />
            </TabsContent>
            <TabsContent value="aulas" tabIndex={-1}>
              <AulasTab conversao={contas.conversao} pessoas={contas.pessoas} janelaDias={trilha.ajustes.janelaDias ?? 30} nome={professorLogado ? 'você' : primeiroNome} />
            </TabsContent>
            <TabsContent value="nps" tabIndex={-1}>
              <NpsTab
                nps={contas.nps}
                metaNps={contas.metaNps}
                pode={pode}
                professorLogado={professorLogado}
                primeiroNome={primeiroNome}
                db={db}
                prof={prof}
                clientes={clientes}
                contratos={contratos}
                planos={planos}
                listenersActive={listenersActive}
              />
            </TabsContent>
            <TabsContent value="aderencia" tabIndex={-1}>
              <AderenciaTab
                linhas={contas.semanas}
                resumo={contas.aderencia}
                barra={trilha.ajustes.barra ?? 2}
                meta={contas.placar.itens.find((i) => i.id === 'aderencia')?.meta ?? null}
                faixaMax={trilha.ajustes.faixaMax ?? 70}
                semestral={trilha.frequencia === 'semestral'}
                leadsById={clientesPorId}
                professorLogado={professorLogado}
                primeiroNome={primeiroNome}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {pode && (
        <PhotoCaptureMenu
          open={fotoAberta}
          onClose={() => setFotoAberta(false)}
          onPicked={salvarFoto}
          onRemove={prof.photoUrl ? removerFoto : null}
        />
      )}
    </div>
  );
}
