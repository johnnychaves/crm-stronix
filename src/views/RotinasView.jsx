import { useMemo, useState } from 'react';
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
//   - rotinaNova: o modelo acabou de ser criado ou duplicado. A transação só
//     aparece na lista quando o servidor confirma; até lá a tela fica em
//     branco, sem o aviso de modelo excluído.
//   - renomear: abre o modelo com o nome em edição (depois de duplicar).
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

  const openModel = (id) => navigate(hrefFor(tenantId, 'rotinas', { modelId: id }));
  const openNew = (id, renomear = false) =>
    navigate(hrefFor(tenantId, 'rotinas', { modelId: id }), { state: { rotinaNova: id, renomear } });
  const toList = () => navigate(hrefFor(tenantId, 'rotinas'), { replace: true });
  // Voltar do modelo, como na ficha: volta uma entrada quando há para onde
  // voltar dentro do app; senão, troca o endereço pela lista.
  const back = () => (canGoBackInApp(window.history.state) ? navigate(-1) : toList());

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-[13.5px] shadow-card">
        Não deu para carregar as rotinas. Recarregue a página.
      </div>
    );
  }

  if (modelId) {
    const model = models.find((m) => m.id === modelId);
    const fresh = location.state?.rotinaNova === modelId;
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
        startRenaming={fresh && location.state?.renomear === true}
        onBack={back}
        onDeleted={toList}
        onDuplicated={(id) => openNew(id, true)}
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
            <Headline people={people} models={models} />
          </h1>
        </div>
        <button type="button" onClick={() => setCreatingKey(Date.now())} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
          <Plus size={15} /> Novo modelo
        </button>
      </div>

      {models.length > 0 && (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {models.map((m) => <ModelCard key={m.id} model={m} people={people} onOpen={() => openModel(m.id)} />)}
        </div>
      )}
      {!loading && models.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
          Nenhum modelo ainda. Crie o primeiro no botão Novo modelo e escolha quem segue.
        </div>
      )}

      <ConsultantsList db={db} appUser={appUser} people={people} models={models} onOpenModel={openModel} />

      {creatingKey && (
        <NewModelSheet
          key={creatingKey}
          open
          onOpenChange={(open) => { if (!open) setCreatingKey(null); }}
          db={db}
          appUser={appUser}
          models={models}
          people={people}
          onCreated={(id) => openNew(id)}
        />
      )}
    </div>
  );
}
