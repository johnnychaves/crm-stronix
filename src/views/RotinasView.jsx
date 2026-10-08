import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ListChecks, Plus } from 'lucide-react';
import { useRoutineModels } from '../hooks/useRoutineModels.js';
import { canGoBackInApp, hrefFor } from '../lib/routes.js';
import { firstName, modelOfUser, namesText, routineParticipants } from '../lib/rotinas.js';
import { ModelCard } from '../components/rotinas/ModelCard.jsx';
import { ConsultantsList } from '../components/rotinas/ConsultantsList.jsx';
import { ModelDetail } from '../components/rotinas/ModelDetail.jsx';
import { NewModelSheet } from '../components/rotinas/NewModelSheet.jsx';

// Tela Rotinas do gestor (spec 2026-10-06, mockup
// 2026-10-06-tela-rotinas-gestor.html). Parte 1: a aba Modelos e o modelo
// aberto em /rotinas/modelos/<id>. O modelo aberto é outra tela no endereço
// (screenKey rotinas:<id>): abrir empilha no histórico, rola para o topo e
// remonta esta view. Por isso o que passa da lista para o modelo vai no state
// da navegação:
//   - fromList: o modelo foi aberto pela lista (cartão, "Abrir modelo" ou
//     criado no Novo modelo). Só aí o Voltar do modelo volta uma entrada do
//     histórico. O cartão e o "Abrir modelo" são links (modelLink), e o Link
//     do React Router manda o state só no clique que troca de tela nesta aba:
//     o modelo aberto em outra aba chega sem a marca, e o Voltar dele troca
//     o endereço pela lista. O modelo aberto pelo Duplicar não leva a marca, senão o
//     Voltar levaria para o modelo de origem, e não para a lista.
//   - rotinaNova e at: o modelo acabou de ser criado ou duplicado, no instante
//     `at`. A transação só aparece na lista quando o servidor confirma; até lá
//     a tela fica em branco, sem o aviso de modelo excluído. A espera dura até
//     o modelo aparecer pela primeira vez nesta montagem ou até FRESH_MS
//     depois de `at`, o que vier antes. O state sobrevive ao F5 e ao voltar e
//     avançar do navegador: sem o prazo, o modelo novo excluído em outra aba
//     deixaria a tela em branco para sempre.
//   - renomear: abre o modelo com o nome em edição (depois de duplicar). Vale
//     só durante a espera, então o F5 depois do prazo não reabre o nome.
const FRESH_MS = 15_000;

// A espera do modelo recém-criado. O prazo é conferido na montagem e depois
// por um timer, porque nenhuma resposta da assinatura vai chegar para
// redesenhar a tela quando o modelo não existe. A primeira vez que o modelo
// aparece é guardada no estado durante o render (o padrão do React para
// derivar estado), junto com o renomear daquele instante: é ele que o
// ModelDetail recebe ao montar. O estado vale para um modelo só, porque a view
// remonta a cada modelo aberto (screenKey rotinas:<id>).
function useFreshModel(nova, modelPresent) {
  const at = Number.isFinite(nova?.at) ? nova.at : null;
  const [expired, setExpired] = useState(() => at === null || Date.now() - at >= FRESH_MS);
  const [firstSight, setFirstSight] = useState(null);
  const waiting = !expired && firstSight === null;
  if (modelPresent && firstSight === null) setFirstSight({ renomear: waiting && nova?.renomear === true });

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => setExpired(true), Math.max(0, at + FRESH_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [waiting, at]);

  return { fresh: waiting, renomear: firstSight?.renomear === true };
}

function Headline({ people, models }) {
  if (people.length === 0) return <>Nenhum consultor na equipe ainda.</>;
  const without = people.filter((p) => !modelOfUser(models, p.id));
  const withModel = people.length - without.length;
  return (
    <>
      <em className="font-bold not-italic text-brand-600 dark:text-brand-300">{withModel} de {people.length}</em> consultores seguem um modelo
      {without.length
        ? <>. <em className="font-bold not-italic text-amber-700 dark:text-amber-300">{namesText(without.map((p) => firstName(p.name)))}</em> ainda {without.length === 1 ? 'está' : 'estão'} sem rotina.</>
        : '. Todos têm rotina.'}
    </>
  );
}

export function RotinasView({ db, appUser, usersList, modelId, tenantId, listenersActive }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { models, loading, error } = useRoutineModels({ db, enabled: listenersActive, tenantId });
  const people = useMemo(() => routineParticipants(usersList), [usersList]);
  const [creatingKey, setCreatingKey] = useState(null);
  const newModelRef = useRef(null);
  const model = modelId ? models.find((m) => m.id === modelId) : undefined;
  const nova = modelId && location.state?.rotinaNova === modelId ? location.state : null;
  const { fresh, renomear } = useFreshModel(nova, Boolean(model));

  const modelLink = (id) => ({ to: hrefFor(tenantId, 'rotinas', { modelId: id }), state: { fromList: true } });
  const openNew = (id, { renomear: rename = false, fromList = false } = {}) =>
    navigate(hrefFor(tenantId, 'rotinas', { modelId: id }), { state: { rotinaNova: id, at: Date.now(), renomear: rename, fromList } });
  const toList = () => navigate(hrefFor(tenantId, 'rotinas'), { replace: true });
  // Voltar do modelo, como na ficha, mas só quando ele foi aberto pela lista:
  // aí a entrada de trás é a lista. Senão (link direto, F5 sem histórico,
  // modelo aberto pelo Duplicar), troca o endereço pela lista.
  const back = () => (location.state?.fromList && canGoBackInApp(window.history.state) ? navigate(-1) : toList());
  // O foco volta ao Novo modelo quando o painel fecha sem criar. Depois de
  // criar, a tela troca pelo modelo novo e o botão não existe mais.
  const restoreFocus = (event) => {
    event.preventDefault();
    if (newModelRef.current?.isConnected) newModelRef.current.focus();
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-[13.5px] shadow-card">
        Não deu para carregar as rotinas. Recarregue a página.
      </div>
    );
  }

  if (modelId) {
    if (!model) {
      if (loading || fresh) return null;
      return (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-card">
          <p className="text-[14px] font-semibold">Esse modelo não existe mais.</p>
          <button type="button" onClick={toList} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">Voltar para Modelos</button>
        </div>
      );
    }
    return (
      <ModelDetail
        db={db}
        appUser={appUser}
        model={model}
        models={models}
        people={people}
        startRenaming={renomear}
        onBack={back}
        onDeleted={toList}
        onDuplicated={(id) => openNew(id, { renomear: true })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks size={14} /> Rotinas
          </p>
          <h1 className="mt-2 max-w-[720px] font-display text-[27px] font-medium leading-tight tracking-tight">
            {loading
              ? <span className="text-muted-foreground">Carregando as rotinas…</span>
              : <Headline people={people} models={models} />}
          </h1>
        </div>
        <button type="button" ref={newModelRef} onClick={() => setCreatingKey(Date.now())} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
          <Plus size={15} /> Novo modelo
        </button>
      </div>

      {models.length > 0 && (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {models.map((m) => <ModelCard key={m.id} model={m} people={people} link={modelLink(m.id)} />)}
        </div>
      )}
      {!loading && models.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
          Nenhum modelo ainda. Crie o primeiro no botão Novo modelo e escolha quem segue.
        </div>
      )}

      <ConsultantsList db={db} appUser={appUser} people={people} models={models} loading={loading} modelLink={modelLink} />

      {creatingKey && (
        <NewModelSheet
          key={creatingKey}
          open
          onOpenChange={(open) => { if (!open) setCreatingKey(null); }}
          onCloseAutoFocus={restoreFocus}
          db={db}
          appUser={appUser}
          models={models}
          people={people}
          onCreated={(id) => openNew(id, { fromList: true })}
        />
      )}
    </div>
  );
}
