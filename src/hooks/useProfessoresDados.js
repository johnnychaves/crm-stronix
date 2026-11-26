import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { appId, CONFIG_PATH, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { planosDoProfessor } from '../lib/professor/carteira.js';
import { limitesDoCiclo } from '../lib/professor/ciclo.js';
import { metasDe } from '../lib/professor/metas.js';
import { TRILHA_PROFESSOR } from '../lib/carreira/trilhas.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useAulasInWindow } from './useAulasInWindow.js';
import { useCarreira } from './useCarreira.js';
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
  const { professores, planos: planosCrus, contratos: contratosCrus, modalities } = useGeneralConfig();
  const contratos = useMemo(() => normalizeContracts(contratosCrus), [contratosCrus]);
  // O Flow e o Move contam para o professor de pilates e o de funcional, não
  // para o de musculação (planosDoProfessor).
  const planos = useMemo(() => planosDoProfessor(planosCrus, modalities), [planosCrus, modalities]);

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

  // As presenças do ciclo (aderência, PR 6): uma leitura só, pela segunda-feira
  // da semana ('AAAA-MM-DD'), de 1º de dezembro do ano anterior a 30 de
  // novembro, num campo só e sem índice novo. As semanas de janeiro a novembro
  // contam; as de dezembro, que abrem o ciclo, só aparecem na aba.
  const [presencas, setPresencas] = useState(null); // { ciclo, lista, erro }
  useEffect(() => {
    if (!ler) return undefined;
    let vivo = true;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', PRESENCAS_PATH),
      where('semana', '>=', `${ciclo - 1}-12-01`),
      where('semana', '<=', `${ciclo}-11-30`),
    );
    getDocs(q)
      .then((snap) => { if (vivo) setPresencas({ ciclo, lista: snap.docs.map((d) => d.data()), erro: null }); })
      .catch((err) => {
        console.error('useProfessoresDados presencas', err);
        if (vivo) setPresencas({ ciclo, lista: [], erro: err });
      });
    return () => { vivo = false; };
  }, [db, ler, ciclo]);
  const presencasDoCiclo = presencas?.ciclo === ciclo ? presencas : null;

  // As metas de hoje e as trilhas, do mesmo documento (useCarreira).
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const metas = useMemo(() => (carreira ? metasDe(carreira.doc) : null), [carreira]);
  const trilhaProfessor = useMemo(() => trilhas?.find((t) => t.id === TRILHA_PROFESSOR) ?? null, [trilhas]);

  // O documento inteiro: o formulário das metas tem todas elas.
  const salvarMetas = useCallback(
    (m) => setDoc(doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID), m),
    [db],
  );

  return {
    carregando: !clientesProntos || aulasCarregando || carreira === null || !presencasDoCiclo,
    erro: clientesErro || aulasErro || carreira?.erro || presencasDoCiclo?.erro || null,
    professores,
    planos,
    contratos,
    clientes,
    aulas,
    presencas: presencasDoCiclo?.lista ?? [],
    metas,
    trilhas,
    trilhaProfessor,
    salvarMetas,
  };
}
