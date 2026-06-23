/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

// Config geral (modalidades + nº máx de aulas experimentais) exposta via
// Context para evitar threading por todos os componentes que renderizam o
// LeadDetailsModal / RescheduleModal. Funciona através de portais (createPortal
// mantém a posição na árvore React).
const GeneralConfigContext = createContext({ modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30 });
function useGeneralConfig() {
  return useContext(GeneralConfigContext) || { modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30 };
}

export { GeneralConfigContext, useGeneralConfig };
