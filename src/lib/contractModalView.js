// Textos do ContractModal que dependem de números que o modal já calcula. Ficam
// aqui, puros, para o teste cobrir cada estado sem montar a tela.
import { SEAM_KIND, seamLabel } from './renewal.js';

const fmtDate = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const monthsLabel = (n) => (Number(n) === 1 ? '1 mês' : `${Number(n) || 0} meses`);

// A faixa fixa embaixo das opções de início. Sempre diz alguma coisa, para a
// altura do modal não mudar quando um aviso entra ou sai. Ordem: a regra dos dois
// dias, o aviso de encaixe (vermelho na sobreposição, âmbar no resto), a falta da
// data, a emenda perfeita, a falta do plano (sem plano não há fim) e, por fim, a
// vigência.
export function startStatusOf({ problem = null, warning = null, severe = false, startsAt = null, endsAt = null, seam = null, planMonths = 0 } = {}) {
  if (problem) return { tone: 'bad', text: problem };
  if (warning) return { tone: severe ? 'bad' : 'warn', text: warning };
  if (!startsAt) return { tone: 'warn', text: 'Escolha a data de início.' };
  if (seam?.kind === SEAM_KIND.EMENDA) return { tone: 'ok', text: seamLabel(seam) };
  if (!endsAt) return { tone: 'warn', text: 'Escolha um plano para ver a vigência.' };
  return { tone: 'ok', text: `Vigência de ${fmtDate(startsAt)} a ${fmtDate(endsAt)}, ${monthsLabel(planMonths)}.` };
}

// O que falta para confirmar, ou texto vazio. É a mesma lista de travas do
// handleConfirm do modal, na mesma ordem, dita em frase curta para o rodapé.
export function confirmBlockOf({ plan = null, startsAt = null, startProblem = null, hasDiscount = false, reason = null } = {}) {
  if (!plan) return 'Escolha um plano.';
  if (!startsAt) return 'Escolha a data de início.';
  if (startProblem) return 'Corrija o início da vigência.';
  if (hasDiscount && !reason) return 'Escolha o motivo do desconto.';
  return '';
}

// A nota ao lado de "Motivo do desconto".
export function reasonHintOf({ hasDiscount = false, reason = null } = {}) {
  if (!hasDiscount) return 'escolha quando houver desconto';
  return reason ? '' : 'obrigatório';
}
