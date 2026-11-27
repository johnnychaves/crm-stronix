// Monta o que o "Registrar contato" e o "Já voltou" da Meta do professor
// gravam. Puro: a gravação está em contatoDeFaltaWrites.js. `agora` é o
// serverTimestamp() de quem grava (as regras exigem a hora do servidor).
import { ABSENCE_CONTACT_TYPE, getInteractionSecurityFields } from '../leads.js';
import { CANAIS, RESULTADOS, canalTexto, resultadoTexto } from './metaProfessor.js';
import { TAREFA } from './planoImportacao.js';

const OBS_MAX = 500;

export function textoDoContato({ marco, urgente, canal, resultado, observacao }) {
  const obs = String(observacao || '').trim().slice(0, OBS_MAX);
  const base = `Contato de falta (${urgente ? 'urgente' : `${marco} dias`}), ${canalTexto(canal)}: ${resultadoTexto(resultado).toLowerCase()}.`;
  return obs ? `${base} ${obs}` : base;
}

function conferirPendente(estado) {
  if (estado?.tarefa?.status !== TAREFA.PENDENTE) throw new Error('A tarefa deste aluno não está pendente.');
}

const fechar = (estado, quem, agora, status, canal, resultado) => ({
  ...estado.tarefa, status, feitaEm: agora, feitaPor: quem?.id || null, feitaPorNome: quem?.name || null, canal, resultado,
});

export function montarContato({ lead, estado, quem, canal, resultado, observacao = '', agora }) {
  conferirPendente(estado);
  if (!CANAIS.some((c) => c.id === canal)) throw new Error('Canal do contato desconhecido.');
  if (!RESULTADOS.some((r) => r.id === resultado)) throw new Error('Resultado do contato desconhecido.');
  const marco = estado.tarefa.marco;
  const urgente = Boolean(estado.urgente || estado.tarefa.urgente);
  const interacao = {
    leadId: lead.id,
    leadName: lead.name || null,
    consultantName: quem?.name || null,
    ...getInteractionSecurityFields(lead, quem),
    actorId: quem?.id || null,
    actorAuthUid: quem?.authUid || null,
    createdAt: agora,
    type: ABSENCE_CONTACT_TYPE,
    canal, resultado, marco, urgente,
    inicioFalta: estado.inicioFalta || null,
    professorId: estado.professorId || null,
    text: textoDoContato({ marco, urgente, canal, resultado, observacao }),
  };
  const estadoPatch = { tarefa: fechar(estado, quem, agora, TAREFA.FEITA, canal, resultado) };
  if (resultado === 'quer_cancelar') {
    Object.assign(estadoPatch, { querCancelarEm: agora, querCancelarPorNome: quem?.name || null, querCancelarAluno: lead.name || null });
  }
  return { interacao, estadoPatch };
}

export function montarJaVoltou({ estado, quem, agora }) {
  conferirPendente(estado);
  return { tarefa: fechar(estado, quem, agora, TAREFA.VOLTOU, null, null) };
}
