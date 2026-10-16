// Passos do Novo lead em etapas (a gaveta do AddLeadModal), no desenho do
// assistente de agendar da ficha: o primeiro passo que ainda não está feito é o
// aberto, e os de baixo esperam. Puro, sem React. O lead menor de idade ganha
// um passo a mais, o do responsável.

// O texto de cada passo na frase "Falta ...".
export const SIGNUP_STEP_TEXT = {
  contato: 'WhatsApp',
  nome: 'nome',
  responsavel: 'responsável',
  origem: 'origem',
  dor: 'dor',
  modalidade: 'modalidade',
  funil: 'funil',
};

// O funil e a etapa vêm por último: o destino do lead é a resposta final, e a
// origem Indicação (que trava o funil) já foi escolhida antes. A modalidade de
// interesse só entra quando a academia tem modalidade cadastrada; a pessoa pode
// pular, então ela nunca trava o cadastro.
export const signupFlow = ({ isMinor = false, withModality = false } = {}) => [
  'contato',
  'nome',
  ...(isMinor ? ['responsavel'] : []),
  'origem',
  'dor',
  ...(withModality ? ['modalidade'] : []),
  'funil',
];

// `done` é { [passo]: boolean }. Devolve o primeiro passo não feito ou null.
export const firstOpenStep = (flow, done) => flow.find((id) => !done[id]) ?? null;

// "WhatsApp, nome e dor", na ordem dos passos. Vazio quando nada falta.
export function missingText(flow, done) {
  const names = flow.filter((id) => !done[id]).map((id) => SIGNUP_STEP_TEXT[id]);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
