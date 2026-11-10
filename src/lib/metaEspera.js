import { getSafeDateOrNull } from './dates.js';
import { FOCO_ESPERA } from './metaFocoCodes.js';

// "Respondeu, aguardando você": as entradas da fila do Foco agora para quem
// escreveu no WhatsApp e ficou sem resposta. Puro. A marca (awaitingReplySince)
// e o trecho (awaitingReplyPreview) são gravados pelo servidor quando o
// Stronizap avisa (api/_zapSignal.js), então academia sem a integração nunca
// tem entrada aqui.
//
// Fica fora do computeDailyGoalSlots de propósito: a espera nunca fica feita (a
// resposta é que limpa a marca), não conta no selo do menu, no dia batido nem
// no título da aba.

const HORA_MS = 60 * 60 * 1000;

// A marca que nunca limpa (resposta por ligação, por outro canal ou pelo
// WhatsApp pessoal) sai da fila e da urgência depois disso. 72 horas cobrem o
// lead que escreve na sexta à noite e é respondido na segunda.
export const ESPERA_TETO_HORAS = 72;

// Minutos dentro do expediente (expediente.js) até a espera virar urgente.
// Proposta da spec para ajustar com o uso, como os 90 minutos do Foco agora.
export const ESPERA_URGENTE_MIN = 30;

export const esperaSince = (lead) => getSafeDateOrNull(lead?.awaitingReplySince);

// Uma entrada por lead com a marca, para o dono do lead (consultantId). O
// contato delegado não leva a espera: ela é da conversa, não da tarefa. A
// chave tem o formato de taskKey (metaFoco.js), escrito aqui para o metaFoco
// poder importar este arquivo sem ciclo.
export function awaitingEntriesOf(leads, userId, now) {
  if (!userId) return [];
  const out = [];
  for (const lead of leads || []) {
    if (!lead?.id || lead.consultantId !== userId) continue;
    const since = esperaSince(lead);
    if (!since || now.getTime() - since.getTime() > ESPERA_TETO_HORAS * HORA_MS) continue;
    out.push({ key: `${lead.id}:${FOCO_ESPERA}`, slug: FOCO_ESPERA, lead });
  }
  return out;
}
