import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { dayKeyOf } from '../lib/operacional/month.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { planosDoProfessor } from '../lib/professor/carteira.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useAulasInWindow } from './useAulasInWindow.js';
import { usePagedLeads } from './usePagedLeads.js';

// Os dados das telas de Carreira (lista e perfil do professor). Professores,
// planos e contratos já chegam assinados pelo App (useGeneralConfig); os
// contratos passam uma vez pelo normalizeContracts, como no Operacional. Três
// leituras que não são ao vivo: os clientes da academia (a mesma consulta da
// tela Clientes), as aulas e as presenças da janela.
//
// A janela (`inicioMs` e `fimMs`, com o fim fora) vem da tela, que a calcula
// com as trilhas (janelaDeLeitura, em src/lib/carreira/professor.js). Sem
// janela, as aulas e as presenças não são lidas. As trilhas não são lidas
// aqui: a tela assina o useCarreira antes, para a janela nascer certa.
//
// As leituras só começam com o portão de ociosidade aberto (listenersActive) e
// ficam ligadas depois disso: com o portão fechado, o usePagedLeads e o
// useAulasInWindow apagariam a lista e a releriam inteira a cada volta da pausa.
const CLIENTES_SPEC_KEY = 'professores-clientes';

export function useProfessoresDados({ db, inicioMs = null, fimMs = null, listenersActive }) {
  const { professores, planos: planosCrus, contratos: contratosCrus, modalities } = useGeneralConfig();
  const contratos = useMemo(() => normalizeContracts(contratosCrus), [contratosCrus]);
  // O Flow e o Move contam para o professor de pilates e o de funcional, não
  // para o de musculação (planosDoProfessor).
  const planos = useMemo(() => planosDoProfessor(planosCrus, modalities), [planosCrus, modalities]);

  const [ligado, setLigado] = useState(Boolean(listenersActive));
  if (listenersActive && !ligado) setLigado(true);
  const ler = ligado && Boolean(db);
  const temJanela = inicioMs != null && fimMs != null;

  const spec = useMemo(() => clientsAllQuerySpec(), []);
  const { items: clientes, ready: clientesProntos, error: clientesErro } = usePagedLeads({
    db, path: LEADS_PATH, spec, specKey: CLIENTES_SPEC_KEY, enabled: ler,
  });

  const { aulas, loading: aulasCarregando, error: aulasErro } = useAulasInWindow({
    db, startMs: inicioMs ?? 0, endMs: (fimMs ?? 1) - 1, enabled: ler && temJanela,
  });

  // As presenças da janela: uma leitura só, pela segunda-feira da semana
  // ('AAAA-MM-DD'), num campo só e sem índice novo.
  const chave = temJanela ? `${inicioMs}-${fimMs}` : null;
  const [presencas, setPresencas] = useState(null); // { chave, lista, erro }
  useEffect(() => {
    if (!ler || !temJanela) return undefined;
    let vivo = true;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', PRESENCAS_PATH),
      where('semana', '>=', dayKeyOf(new Date(inicioMs))),
      where('semana', '<', dayKeyOf(new Date(fimMs))),
    );
    getDocs(q)
      .then((snap) => { if (vivo) setPresencas({ chave: `${inicioMs}-${fimMs}`, lista: snap.docs.map((d) => d.data()), erro: null }); })
      .catch((err) => {
        console.error('useProfessoresDados presencas', err);
        if (vivo) setPresencas({ chave: `${inicioMs}-${fimMs}`, lista: [], erro: err });
      });
    return () => { vivo = false; };
  }, [db, ler, temJanela, inicioMs, fimMs]);
  const presencasDaJanela = chave && presencas?.chave === chave ? presencas : null;

  return {
    carregando: !temJanela || !clientesProntos || aulasCarregando || !presencasDaJanela,
    erro: clientesErro || aulasErro || presencasDaJanela?.erro || null,
    professores,
    planos,
    contratos,
    clientes,
    aulas,
    presencas: presencasDaJanela?.lista ?? [],
  };
}
