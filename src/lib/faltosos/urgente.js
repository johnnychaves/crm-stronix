// Urgente e contrato ativo do aluno faltando, pelo resumo do lead. Puro.
//
// Contrato ativo é o que deriveLeadContractStatus dá como ativo ou a vencer,
// no mesmo instante que as listas usam: com o fim gravado à meia-noite, o
// contrato fica vencido durante o último dia, e a importação precisa dizer o
// mesmo que Clientes. Por isso as funções recebem o instante (`agora`), e o
// dia de hoje sai dele, no calendário de Brasília.
//
// O fim que vale para o urgente é o do último contrato (currentContractEndsAt).
// Com a renovação já marcada, o último contrato é a renovação, que é o que
// vale depois do contrato em uso: quem já renovou só fica urgente se a
// renovação também termina dentro da janela. O fim do contrato em uso
// (inUseContractEndsAt) não é lido. Ele diria que o contrato termina antes de
// a renovação começar, e o bloco "em uso" continua no lead depois que a
// renovação começa, porque nada o limpa nessa hora.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Urgente").
import { CONTRACT_STATUS, deriveLeadContractStatus } from '../contracts.js';
import { diaEmBrasilia, diasEntre, hojeEmBrasilia } from './dias.js';
import { normalizarJanelaUrgente } from './marcos.js';

// 'ativo' (ativo ou a vencer), 'trancado' ou 'sem_contrato_ativo' (vencido,
// cancelado, agendado ou sem contrato). Com a renovação marcada, vale o
// contrato em uso, pelas regras de deriveLeadContractStatus.
export function situacaoDoContrato(lead, agora) {
  const status = deriveLeadContractStatus(lead, agora);
  if (status === CONTRACT_STATUS.ATIVO || status === CONTRACT_STATUS.A_VENCER) return 'ativo';
  if (status === CONTRACT_STATUS.TRANCADO) return 'trancado';
  return 'sem_contrato_ativo';
}

// O fim do último contrato, como foi gravado (Date ou Timestamp), ou null.
export const fimDoContrato = (lead) => lead?.currentContractEndsAt ?? null;

// { urgente, contratoTerminaEm: 'AAAA-MM-DD' | null }. Urgente: contrato
// ativo que termina em até `janelaDias` dias (padrão 90), contados no
// calendário de Brasília a partir de hoje. contratoTerminaEm vem mesmo sem o
// urgente, para a tela dizer até quando o contrato vai.
export function urgenteDe(lead, agora, janelaDias) {
  const contratoTerminaEm = diaEmBrasilia(fimDoContrato(lead));
  if (!contratoTerminaEm || situacaoDoContrato(lead, agora) !== 'ativo') return { urgente: false, contratoTerminaEm };
  const faltam = diasEntre(hojeEmBrasilia(agora), contratoTerminaEm);
  return {
    urgente: faltam !== null && faltam >= 0 && faltam <= normalizarJanelaUrgente(janelaDias),
    contratoTerminaEm,
  };
}
