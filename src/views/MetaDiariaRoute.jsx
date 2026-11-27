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
import { isGestor, isProfessor } from '../lib/acesso.js';
import { hasModule, MODULES } from '../lib/modules.js';
import { firstName } from '../lib/guardian.js';
import { DailyGoalView } from './DailyGoalView.jsx';
import { ProfessorMetaScreen } from '../components/dailygoal/professor/ProfessorMetaScreen.jsx';
import { SeletorDeMeta } from '../components/dailygoal/professor/SeletorDeMeta.jsx';

const saudacaoDe = (d) => (d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

function MetaDoProfessor({ db, appUser, professorId, nomeVisto, gestorVendo, listenersActive, topo = null }) {
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
    <>
      {topo}
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
      />
    </>
  );
}

export function MetaDiariaRoute({ db, appUser, listenersActive, dailyGoalProps }) {
  const { professores = [] } = useGeneralConfig();
  const podeVerProf = hasModule(appUser?.tenantModules, MODULES.FALTOSOS) && isGestor(appUser);
  const ativos = useMemo(
    () => professores.filter((p) => p?.ativo !== false)
      .map((p) => ({ id: p.id, nome: p.nome || '' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [professores],
  );
  const ctx = useMemo(() => ({ podeVerProf, professoresAtivos: ativos }), [podeVerProf, ativos]);
  const [{ prof }, setParams] = useScreenParams('dailyGoal', ctx);

  if (isProfessor(appUser)) {
    const meu = typeof appUser?.professorId === 'string' && appUser.professorId.trim() ? appUser.professorId : null;
    return <MetaDoProfessor key={meu || 'sem'} db={db} appUser={appUser} professorId={meu} nomeVisto={firstName(appUser?.name) || 'professor'} gestorVendo={false} listenersActive={listenersActive} />;
  }
  const seletor = podeVerProf && ativos.length > 0
    ? <div className="mb-3 flex justify-end"><SeletorDeMeta professores={ativos} valor={prof} onEscolher={(id) => setParams({ prof: id })} /></div>
    : null;
  if (prof) {
    const nome = ativos.find((p) => p.id === prof)?.nome || '';
    return <MetaDoProfessor key={prof} db={db} appUser={appUser} professorId={prof} nomeVisto={firstName(nome) || nome} gestorVendo listenersActive={listenersActive} topo={seletor} />;
  }
  return <>{seletor}<DailyGoalView {...dailyGoalProps} /></>;
}
