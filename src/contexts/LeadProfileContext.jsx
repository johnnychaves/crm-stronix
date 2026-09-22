/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

// A ficha do lead ou cliente é um endereço (/<academia>/ficha/<id>), e este
// contexto é o caminho de qualquer tela até ela, sem prop-drilling:
// - openProfile(leadId) navega para a ficha, para o clique que não é link;
// - leadHref(leadId) monta o endereço da ficha, ou devolve null quando o id
//   não serve para endereço;
// - from é o id da tela de onde a ficha é aberta. Vai no state da navegação
//   para o menu continuar aceso e o cabeçalho manter o título da origem.
// Fora do Provider, leadHref devolve null e o LeadLink vira texto sem link.
// Espelha o padrão do GeneralConfigContext (funciona através de portais).
const NO_PROFILE = Object.freeze({ openProfile: () => {}, leadHref: () => null, from: null });

const LeadProfileContext = createContext(NO_PROFILE);

function useLeadProfile() {
  return useContext(LeadProfileContext) || NO_PROFILE;
}

export { LeadProfileContext, useLeadProfile };
