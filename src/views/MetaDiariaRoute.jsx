// Decide qual Meta diária aparece: a do consultor (DailyGoalView), a do
// professor logado, ou a de um professor escolhido pelo gestor no seletor.
import { useMemo } from 'react';
import { useToast } from '../contexts/ToastContext.jsx';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useMinuteClock, useFrozenWhileIdle } from '../hooks/useMinuteClock.js';
import { useFaltososDoProfessor } from '../hooks/useFaltososDoProfessor.js';
import { useAulasDeHojeDoProfessor } from '../hooks/useAulasDeHojeDoProfessor.js';
import { registrarContatoDeFalta, marcarJaVoltou } from '../lib/faltosos/contatoDeFaltaWrites.js';
import { configDasTelas } from '../lib/faltosos/configFaltosos.js';
import { isGestor, isMetaParticipant, isProfessor } from '../lib/acesso.js';
import { hasModule, MODULES } from '../lib/modules.js';
import { firstName } from '../lib/guardian.js';
import { DailyGoalView } from './DailyGoalView.jsx';
import { ProfessorMetaScreen } from '../components/dailygoal/professor/ProfessorMetaScreen.jsx';
import { SeletorDeMeta } from '../components/dailygoal/professor/SeletorDeMeta.jsx';

const saudacaoDe = (d) => (d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

function MetaDoProfessor({ db, appUser, professorId, nomeVisto, gestorVendo, listenersActive, seletor = null }) {
  const toast = useToast();
  const { faltosos } = useGeneralConfig();
  const config = configDasTelas(faltosos);
  const liveNow = useMinuteClock();
  const now = useFrozenWhileIdle(liveNow, listenersActive);
  const { estados, leadsById } = useFaltososDoProfessor({ db, professorId, listenersActive });
  const aulas = useAulasDeHojeDoProfessor({ db, professorId, now, listenersActive });
  // O erro sobe para o diálogo, que diz "Não deu para registrar".
  const onRegistrar = async (estado, r) => {
    await registrarContatoDeFalta(db, { lead: leadsById.get(estado.id) || { id: estado.id }, estado, quem: appUser, ...r });
    toast.success('Contato registrado.');
  };
  const onJaVoltou = async (estado) => {
    try {
      await marcarJaVoltou(db, { estado, quem: appUser });
      toast.success('Marcado como de volta.');
    } catch {
      toast.error('Não deu para marcar. Tente de novo.');
    }
  };
  return (
      <ProfessorMetaScreen
        now={now}
        live={listenersActive}
        saudacao={saudacaoDe(now)}
        nomeVisto={nomeVisto}
        gestorVendo={gestorVendo}
        professorLigado={Boolean(professorId)}
        ultimaImportacao={config.ultimaImportacao}
        marcos={config.marcos}
        estados={estados}
        leadsById={leadsById}
        aulas={aulas}
        onRegistrar={onRegistrar}
        onJaVoltou={onJaVoltou}
        zapOn={Boolean(appUser?.tenantZap)}
        seletor={seletor}
      />
  );
}

export function MetaDiariaRoute({ db, appUser, listenersActive, dailyGoalProps }) {
  const { professores = [] } = useGeneralConfig();
  const gestor = isGestor(appUser);
  const podeVerProf = hasModule(appUser?.tenantModules, MODULES.FALTOSOS) && gestor;
  const ativos = useMemo(
    () => professores.filter((p) => p?.ativo !== false)
      .map((p) => ({ id: p.id, nome: p.nome || '' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [professores],
  );
  // Os consultores valem em toda academia, sem o Stronix 2.0: o gestor olha a
  // Meta de cada um, sem agir (pedido do Johnny, 27/11/2026).
  const usersList = dailyGoalProps?.usersList;
  const consultores = useMemo(
    () => (gestor ? (usersList || []) : [])
      .filter((u) => u?.id && u.name && u.active !== false && isMetaParticipant(u))
      .map((u) => ({ id: u.id, nome: u.name }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [gestor, usersList],
  );
  const ctx = useMemo(
    () => ({ podeVerProf, professoresAtivos: ativos, podeVerConsultor: gestor, consultoresAtivos: consultores }),
    [podeVerProf, ativos, gestor, consultores],
  );
  const [{ prof, consultor }, setParams] = useScreenParams('dailyGoal', ctx);

  if (isProfessor(appUser)) {
    const meu = typeof appUser?.professorId === 'string' && appUser.professorId.trim() ? appUser.professorId : null;
    return <MetaDoProfessor key={meu || 'sem'} db={db} appUser={appUser} professorId={meu} nomeVisto={firstName(appUser?.name) || 'professor'} gestorVendo={false} listenersActive={listenersActive} />;
  }
  const profsNoSeletor = podeVerProf ? ativos : [];
  const escolha = profsNoSeletor.length > 0 || consultores.length > 0
    ? (
      <SeletorDeMeta
        professores={profsNoSeletor}
        consultores={consultores}
        valor={prof ? `p:${prof}` : consultor ? `c:${consultor}` : ''}
        onEscolher={(e) => setParams({ prof: e?.tipo === 'professor' ? e.id : null, consultor: e?.tipo === 'consultor' ? e.id : null })}
      />
    )
    : null;
  if (prof) {
    const nome = ativos.find((p) => p.id === prof)?.nome || '';
    return <MetaDoProfessor key={prof} db={db} appUser={appUser} professorId={prof} nomeVisto={firstName(nome) || nome} gestorVendo listenersActive={listenersActive} seletor={escolha} />;
  }
  // O seletor fica no mesmo lugar nas duas Metas: dentro do cabeçalho, à
  // direita. Na do consultor, antes da faixa do topo, ele ficava coberto.
  const vendo = consultor ? (usersList || []).find((u) => u?.id === consultor) || null : null;
  return <DailyGoalView key={vendo?.id || 'eu'} {...dailyGoalProps} seletor={escolha} vendo={vendo} />;
}
