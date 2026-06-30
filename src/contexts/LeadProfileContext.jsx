/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

// Navegação para a ficha-página (lead/cliente). Exposto via Context para que
// qualquer tela (Kanban, listas, Meta, Dashboard...) abra o perfil sem
// prop-drilling. `openProfile(leadId)` troca o conteúdo do <main> pela
// LeadProfileView; o "Voltar" volta à aba de origem. Espelha o padrão do
// GeneralConfigContext (funciona através de portais).
const LeadProfileContext = createContext({ openProfile: () => {} });

function useLeadProfile() {
  return useContext(LeadProfileContext) || { openProfile: () => {} };
}

export { LeadProfileContext, useLeadProfile };
