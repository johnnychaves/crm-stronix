import { useMemo, useState } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';
import { doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appId, PROFESSORS_PATH, storage } from '../../lib/firebase.js';
import { isGestor, isProfessor } from '../../lib/acesso.js';
import { hrefFor } from '../../lib/routes.js';
import { professorModalityNames } from '../../lib/professores.js';
import { deleteProfessorPhoto, uploadProfessorPhoto } from '../../lib/professorPhoto.js';
import { cicloDe } from '../../lib/professor/ciclo.js';
import { conversaoDoCiclo, pessoasDasAulas } from '../../lib/professor/conversao.js';
import { carteiraDoCiclo, renovacaoDoCiclo } from '../../lib/professor/renovacao.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useProfessoresDados } from '../../hooks/useProfessoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { PhotoCaptureMenu } from '../../components/profile/PhotoCaptureMenu.jsx';
import { AulasTab } from './AulasTab.jsx';
import { CarteiraTab } from './CarteiraTab.jsx';
import { PerfilCabecalho } from './PerfilCabecalho.jsx';
import { PlacarDoCiclo } from './PlacarDoCiclo.jsx';
import { TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';

// O perfil do professor (mockups B de 24/11/2026): cabeçalho, placar do ciclo
// e as abas Carteira e Aulas experimentais. O gestor abre qualquer perfil e é
// o único que troca a foto e o nível; o professor logado só chega ao próprio
// (a rota garante) e vê tudo só para leitura. O ciclo mora no endereço
// (`ciclo`) e a aba é a sub-tela, que o App troca com replace.
const LINK = 'rounded outline-none focus-visible:anel-foco';

export function ProfessorPerfilView({ db, appUser, tenantId, profId, tab, onTab, listenersActive }) {
  const toast = useToast();
  // Um relógio só por montagem: as contas do ciclo cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const ctx = useMemo(() => ({ cicloAtual: cicloDe(agora) }), [agora]);
  const [{ ciclo }, setParams] = useScreenParams('professorPerfil', ctx);
  const { carregando, erro, professores, planos, contratos, clientes, aulas, metas } = useProfessoresDados({ db, ciclo, listenersActive });
  const { modalities } = useGeneralConfig();

  const pode = isGestor(appUser);
  const professorLogado = isProfessor(appUser);
  const prof = useMemo(() => (professores || []).find((p) => p.id === profId) ?? null, [professores, profId]);
  const planosById = useMemo(() => new Map((planos || []).map((p) => [p.id, p])), [planos]);

  const contas = useMemo(() => {
    if (carregando || !metas || !prof) return null;
    const { janelaDias, tolerancia } = metas.conversao;
    const base = { leads: clientes, contratos, planos, professor: prof, ciclo, asOf: agora };
    const daAula = { aulas, contratos, professorId: prof.id, ciclo, asOf: agora, janelaDias };
    return {
      renovacao: renovacaoDoCiclo(base),
      carteira: carteiraDoCiclo(base),
      conversao: conversaoDoCiclo({ ...daAula, tolerancia }),
      pessoas: pessoasDasAulas(daAula),
    };
  }, [carregando, metas, prof, clientes, contratos, planos, aulas, ciclo, agora]);

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

  const salvarNivel = async ({ nivel, desde }) => {
    if (!pode) return false;
    try {
      await updateDoc(profRef(), { nivel, nivelDesde: Timestamp.fromDate(desde) });
      toast.success('Nível salvo.');
      return true;
    } catch (e) {
      console.error('Erro ao salvar o nível do professor:', e);
      toast.error('Não deu para salvar o nível. Tente de novo.');
      return false;
    }
  };

  const voltar = pode && (
    <AppLink to={hrefFor(tenantId, 'professores')} aria-label="Voltar para Professores" className={`${LINK} mb-3.5 inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-brand-700 dark:hover:text-brand-300`}>
      <ChevronLeft size={16} aria-hidden="true" />Professores
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
                Ver a lista de professores
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
  const aba = tab === 'aulas' ? 'aulas' : 'carteira';

  return (
    <div className="mx-auto max-w-[1240px] animate-fade-in pb-12">
      {voltar}
      {professorLogado && (
        <p className="mb-3.5 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Eye size={16} aria-hidden="true" className="flex-none" />
          Você está vendo o seu perfil. Só o gestor muda o nível e a foto.
        </p>
      )}

      <PerfilCabecalho
        prof={prof}
        modalidades={modalidades}
        pode={pode}
        fotoOcupada={fotoOcupada}
        onFoto={() => setFotoAberta(true)}
        onSalvarNivel={salvarNivel}
      />

      {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}

      {!contas ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Carregando os números do ciclo…</p>
      ) : (
        <>
          <PlacarDoCiclo
            titulo={professorLogado ? 'Onde você está no plano de carreira' : `Onde ${primeiroNome} está no plano de carreira`}
            ciclo={ciclo}
            cicloAtual={ctx.cicloAtual}
            onCiclo={(c) => setParams({ ciclo: c })}
            prof={prof}
            metas={metas}
            renovacao={contas.renovacao}
            conversao={contas.conversao}
            modalidadesTexto={modalidadesTexto}
          />

          <Tabs value={aba} onValueChange={(id) => onTab?.(id === 'carteira' ? null : id)} className="mt-7 gap-4">
            <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
              <TabsTrigger value="carteira" className={TAB_TRIGGER}>
                Carteira <span className={TAB_CONTAGEM}>{contas.carteira.length}</span>
              </TabsTrigger>
              <TabsTrigger value="aulas" className={TAB_TRIGGER}>
                Aulas experimentais <span className={TAB_CONTAGEM}>{contas.pessoas.length}</span>
              </TabsTrigger>
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
              <AulasTab conversao={contas.conversao} pessoas={contas.pessoas} janelaDias={metas.conversao.janelaDias} nome={professorLogado ? 'você' : primeiroNome} />
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
