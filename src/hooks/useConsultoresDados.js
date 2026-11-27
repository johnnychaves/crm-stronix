import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH, LEADS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { dayKeyOf } from '../lib/operacional/month.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { mesesDoPeriodo } from '../lib/carreiraConsultor.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useCrmSources } from './useCrmSources.js';
import { usePagedLeads } from './usePagedLeads.js';

// Os dados das telas de Carreira para o consultor (plano de carreira, PR 4).
// Os contratos, os dias da Meta e a tolerância da renovação chegam pelo App
// (useGeneralConfig). Três leituras: os meses do CRM da janela (useCrmSources,
// a mesma carga e a mesma memória de sessão dos painéis), os clientes da
// academia (a mesma consulta e a mesma chave do useProfessoresDados, para o
// dono de hoje da renovação) e os dias batidos da Meta. Com `consultantId` (o
// perfil), os dias batidos vêm pelo consultantId; sem ele (a lista), pelo date
// dentro da janela. As duas consultas são de campo único.
//
// A janela (`inicioMs` e `fimMs`, com o fim fora) vem da tela, como no
// useProfessoresDados. As leituras só começam com o portão de ociosidade
// aberto e ficam ligadas depois disso.
const CLIENTES_SPEC_KEY = 'professores-clientes';

export function useConsultoresDados({ db, inicioMs = null, fimMs = null, consultantId = null, agora, liveLeads, interactions, listenersActive }) {
  const { contratos: contratosCrus, metaWeekdays, renewalGraceDays } = useGeneralConfig();
  const contratos = useMemo(() => normalizeContracts(contratosCrus), [contratosCrus]);

  const [ligado, setLigado] = useState(Boolean(listenersActive));
  if (listenersActive && !ligado) setLigado(true);
  const ler = ligado && Boolean(db);
  const temJanela = inicioMs != null && fimMs != null;

  const monthKeys = useMemo(
    () => (temJanela ? mesesDoPeriodo({ inicio: new Date(inicioMs), fim: new Date(fimMs) }, agora) : []),
    [temJanela, inicioMs, fimMs, agora],
  );
  const fontes = useCrmSources({ db, enabled: ler && temJanela, now: agora, monthKeys, liveInteractions: interactions, liveLeads });
  const crm = useMemo(() => ({ months: fontes.months, leadsById: fontes.leadsById }), [fontes.months, fontes.leadsById]);

  const spec = useMemo(() => clientsAllQuerySpec(), []);
  const { items: clientes, ready: clientesProntos, error: clientesErro } = usePagedLeads({
    db, path: LEADS_PATH, spec, specKey: CLIENTES_SPEC_KEY, enabled: ler,
  });

  const chave = temJanela ? `${inicioMs}-${fimMs}-${consultantId ?? ''}` : null;
  const [historico, setHistorico] = useState(null); // { chave, lista, erro }
  useEffect(() => {
    if (!ler || !temJanela) return undefined;
    let vivo = true;
    const col = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const q = consultantId
      ? query(col, where('consultantId', '==', consultantId))
      : query(col, where('date', '>=', dayKeyOf(new Date(inicioMs))), where('date', '<', dayKeyOf(new Date(fimMs))));
    const essa = `${inicioMs}-${fimMs}-${consultantId ?? ''}`;
    getDocs(q)
      .then((snap) => { if (vivo) setHistorico({ chave: essa, lista: snap.docs.map((d) => d.data()), erro: null }); })
      .catch((err) => {
        console.error('useConsultoresDados historico', err);
        if (vivo) setHistorico({ chave: essa, lista: [], erro: err });
      });
    return () => { vivo = false; };
  }, [db, ler, temJanela, inicioMs, fimMs, consultantId]);
  const historicoDaJanela = chave && historico?.chave === chave ? historico : null;
  const clientesPorId = useMemo(() => new Map((clientes || []).map((l) => [l.id, l])), [clientes]);

  return {
    carregando: !temJanela || fontes.loading || !clientesProntos || !historicoDaJanela,
    erro: clientesErro || historicoDaJanela?.erro || null,
    crm,
    contratos,
    clientesPorId,
    history: historicoDaJanela?.lista ?? [],
    metaWeekdays,
    graceDays: renewalGraceDays,
  };
}
