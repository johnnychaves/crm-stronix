import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { appId, CONFIG_PATH, LEADS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { limitesDoCiclo } from '../lib/professor/ciclo.js';
import { metasDe } from '../lib/professor/metas.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useAulasInWindow } from './useAulasInWindow.js';
import { usePagedLeads } from './usePagedLeads.js';

// Os dados das telas de professores (lista, metas e perfil). Professores,
// planos e contratos já chegam assinados pelo App (useGeneralConfig); os
// contratos passam uma vez pelo normalizeContracts, como no Operacional, porque
// a carteira e a renovação os recebem normalizados. Duas leituras novas, que não
// são ao vivo: os clientes da academia (a mesma consulta da tela Clientes) e as
// aulas do ciclo. As metas são uma assinatura de stronix_config/carreira.
//
// As leituras só começam com o portão de ociosidade aberto (listenersActive).
// As duas que não são ao vivo ficam ligadas depois disso: com o portão
// fechado, o usePagedLeads e o useAulasInWindow apagariam a lista e a releriam
// inteira a cada volta da pausa. A assinatura das metas para com o portão e
// guarda o último valor.
//
// `metas` é null até a primeira resposta, e `carregando` fica verdadeiro até
// as três leituras responderem.
const CARREIRA_ID = 'carreira';
const CLIENTES_SPEC_KEY = 'professores-clientes';

export function useProfessoresDados({ db, ciclo, listenersActive }) {
  const { professores, planos, contratos: contratosCrus } = useGeneralConfig();
  const contratos = useMemo(() => normalizeContracts(contratosCrus), [contratosCrus]);

  const [ligado, setLigado] = useState(Boolean(listenersActive));
  if (listenersActive && !ligado) setLigado(true);
  const ler = ligado && Boolean(db);

  const spec = useMemo(() => clientsAllQuerySpec(), []);
  const { items: clientes, ready: clientesProntos, error: clientesErro } = usePagedLeads({
    db, path: LEADS_PATH, spec, specKey: CLIENTES_SPEC_KEY, enabled: ler,
  });

  const { inicio, fim } = limitesDoCiclo(ciclo);
  const { aulas, loading: aulasCarregando, error: aulasErro } = useAulasInWindow({
    db, startMs: inicio.getTime(), endMs: fim.getTime() - 1, enabled: ler,
  });

  // { doc, erro } da última resposta, ou null antes da primeira.
  const [carreira, setCarreira] = useState(null);
  useEffect(() => {
    if (!db || !listenersActive) return undefined;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID);
    return onSnapshot(
      ref,
      (snap) => setCarreira({ doc: snap.exists() ? snap.data() : null, erro: null }),
      (err) => {
        console.error('useProfessoresDados carreira', err);
        setCarreira({ doc: null, erro: err });
      },
    );
  }, [db, listenersActive]);
  const metas = useMemo(() => (carreira ? metasDe(carreira.doc) : null), [carreira]);

  // O documento inteiro: o formulário das metas tem todas elas.
  const salvarMetas = useCallback(
    (m) => setDoc(doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID), m),
    [db],
  );

  return {
    carregando: !clientesProntos || aulasCarregando || carreira === null,
    erro: clientesErro || aulasErro || carreira?.erro || null,
    professores,
    planos,
    contratos,
    clientes,
    aulas,
    metas,
    salvarMetas,
  };
}
