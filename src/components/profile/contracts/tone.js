// Constantes que a aba Contratos divide entre o card, a faixa do próximo, a
// tabela do Histórico e a linha do tempo. Só valores: os componentes ficam em
// shared.jsx, para o lint de react-refresh não reclamar de arquivo misto.
import { CONTRACT_STATUS } from '../../../lib/contracts.js';
import { CONTRACT_ORIGIN, HISTORY_STATUS } from '../../../lib/contractHistory.js';

// Tom do bloco de contagem, do selo e do preenchimento: a situação do contrato
// manda na cor da aba inteira.
export const CONTRACT_TONE = {
  [CONTRACT_STATUS.AGENDADO]: { block: 'bg-violet-500/10 dark:bg-violet-500/15', fg: 'text-violet-700 dark:text-violet-300', fill: 'bg-violet-500' },
  [CONTRACT_STATUS.TRANCADO]: { block: 'bg-yellow-500/15', fg: 'text-yellow-800 dark:text-yellow-300', fill: 'bg-yellow-500' },
  [CONTRACT_STATUS.ATIVO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [CONTRACT_STATUS.A_VENCER]: { block: 'bg-amber-500/12 dark:bg-amber-500/16', fg: 'text-amber-700 dark:text-amber-400', fill: 'bg-amber-500' },
  [CONTRACT_STATUS.VENCIDO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' },
  [CONTRACT_STATUS.CANCELADO]: { block: 'bg-rose-500/10 dark:bg-rose-500/15', fg: 'text-rose-700 dark:text-rose-400', fill: 'bg-rose-500' },
  // Selos do Histórico (lib/contractHistory.js).
  [HISTORY_STATUS.EM_USO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [HISTORY_STATUS.RENOVADO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' }
};

// Nome da origem, para o title e o leitor de tela do ícone.
export const ORIGIN_LABEL = {
  [CONTRACT_ORIGIN.RENOVACAO]: 'Renovação',
  [CONTRACT_ORIGIN.UPGRADE]: 'Upgrade',
  [CONTRACT_ORIGIN.RETORNO]: 'Retorno',
  [CONTRACT_ORIGIN.PRIMEIRA]: 'Primeira matrícula'
};

// Botões pequenos do card e da faixa do próximo (o mockup chama de lnk e
// lnk-danger), e o traço entre eles.
export const LINK_BTN = 'h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition disabled:opacity-50';
export const LINK_BTN_DANGER = 'h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 whitespace-nowrap transition disabled:opacity-50';
export const DIVIDER = 'w-px h-[18px] flex-none bg-slate-100 dark:bg-white/[0.06]';
