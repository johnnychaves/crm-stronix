/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

// Config geral (modalidades + nº máx de aulas experimentais) exposta via
// Context para evitar threading por todos os componentes que renderizam o
// LeadDetailsModal / RescheduleModal. Funciona através de portais (createPortal
// mantém a posição na árvore React).
// `faltosos` é a configuração de stronix_config/faltosos, que o App assina só
// com o módulo ligado. Fora do Provider ela é null, e as telas usam o
// configDasTelas (src/lib/faltosos/configFaltosos.js), que cai no padrão.
const GeneralConfigContext = createContext({ modalities: [], trialClassOptions: [1, 2, 3], freepassTypes: [], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [], dores: [], faltosos: null });
function useGeneralConfig() {
  return useContext(GeneralConfigContext) || { modalities: [], trialClassOptions: [1, 2, 3], freepassTypes: [], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [], dores: [], faltosos: null };
}

export { GeneralConfigContext, useGeneralConfig };
