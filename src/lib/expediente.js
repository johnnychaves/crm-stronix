import { diaDeBrasilia, isoDoDia, instanteDeBrasilia } from '../../api/_horarioDeBrasilia.js';

// A faixa do expediente da urgência da espera ("Respondeu, aguardando você"):
// das 8h às 21h de Brasília, a mesma do lembrete de agendamento e do agente de
// IA do Stronizap (backend/src/lib/aiAgentSlotRequest.ts). Puro. Importa as
// contas de fuso do api/, como o leadDerived.js importa o _zapPhone.js, para
// existir uma regra só de Brasília.
// shortcut: faixa fixa para todas as academias, vira configuração se uma pedir.
export const EXPEDIENTE = Object.freeze({ inicio: '08:00', fim: '21:00' });

const valida = (d) => d instanceof Date && !Number.isNaN(d.getTime());

// Quanto do intervalo cai dentro da faixa, somado dia a dia de Brasília: 08:00
// entra, 21:00 não, e a noite não conta. Zero para intervalo invertido ou data
// inválida.
export function msDeExpediente(de, ate) {
  if (!valida(de) || !valida(ate)) return 0;
  let total = 0;
  for (let dia = diaDeBrasilia(de); dia <= diaDeBrasilia(ate); dia += 1) {
    const iso = isoDoDia(dia);
    const ini = Math.max(de.getTime(), instanteDeBrasilia(iso, EXPEDIENTE.inicio).getTime());
    const fim = Math.min(ate.getTime(), instanteDeBrasilia(iso, EXPEDIENTE.fim).getTime());
    total += Math.max(0, fim - ini);
  }
  return total;
}
