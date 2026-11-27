// Os textos, os ícones e as classes compartilhadas do editor de
// Configurações → Plano de carreira (mockup A,
// docs/superpowers/specs/mockups/2026-11-26-carreira-editor-a.html). JS sem
// JSX, como o settingsRailIcons.js: o teste lê os textos sem montar tela, e o
// react-refresh não aceita .jsx exportando constante.
import {
  BadgeDollarSign, Banknote, CalendarCheck, GraduationCap, RefreshCw, Star, Target, UserCheck,
} from 'lucide-react';
import { mesesDaAvaliacao } from '../../../lib/carreira/periodo.js';

export const MESES = Object.freeze(['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']);
export const maiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// A trava do calendário da trilha Professor mora no validacao.js, que a
// confere ao gravar. O PR 3 tira a trava.
export { AVISO_CALENDARIO_PROFESSOR } from '../../../lib/carreira/validacao.js';

// O desenho de cada base: o ícone e os tons do ícone grande, do degrau e do
// quadrado de cada número.
export const BASE_UI = Object.freeze({
  professor: Object.freeze({
    icone: GraduationCap,
    fundo: 'bg-linear-to-br from-brand-600 to-brand-400',
    degrau: 'bg-brand-600',
    tile: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  }),
  consultor: Object.freeze({
    icone: BadgeDollarSign,
    fundo: 'bg-linear-to-br from-accent-500 to-accent-400',
    degrau: 'bg-accent-500',
    tile: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400',
  }),
});

// Ícone, legenda curta da grade (pelos ajustes da trilha) e o texto de "Como
// cada número conta". O nome é o de NUMEROS (src/lib/carreira/numeros.js).
export const NUMERO_UI = Object.freeze({
  renovacao: {
    icone: RefreshCw,
    legenda: () => 'alunos que renovaram',
    regra: 'Dos alunos do professor cujo contrato venceu no período, quantos renovaram.',
  },
  nps: {
    icone: Star,
    legenda: () => 'média da pesquisa, de 0 a 10',
    regra: 'A média da pergunta principal da pesquisa. A pesquisa só vale com 10 respostas ou mais e com metade da turma.',
  },
  conversao: {
    icone: UserCheck,
    legenda: () => 'pontos acima da academia',
    regra: 'Das pessoas que vieram à aula experimental ou ao freepass com o professor, quantas se matricularam, comparado com a conversão da academia inteira. Com 0 pontos, passa quem fica acima da academia.',
  },
  aderencia: {
    icone: CalendarCheck,
    legenda: (a) => `semanas com ${a?.barra ?? 2} aulas ou mais`,
    regra: 'Das semanas dos alunos, de segunda a sexta, em quantas o aluno veio o bastante.',
  },
  consultorConversao: {
    icone: UserCheck,
    legenda: () => 'pontos acima da academia',
    regra: 'Dos leads do consultor cadastrados no período, quantos se matricularam, comparado com a conversão da academia inteira.',
  },
  vendas: {
    icone: Banknote,
    legenda: (a) => (a?.vendasEm === 'quantidade' ? 'vendas fechadas, média por mês' : 'valor fechado, média por mês'),
    regra: 'Matrículas e renovações que o consultor fechou, somadas e divididas pelos meses do período. É o valor do contrato, não o que entrou no caixa.',
  },
  consultorRenovacao: {
    icone: RefreshCw,
    legenda: () => 'clientes que renovaram',
    regra: 'Dos clientes de que o consultor é dono hoje, cujo contrato venceu no período, quantos renovaram.',
  },
  metaDiaria: {
    icone: Target,
    legenda: () => 'dias de meta batidos',
    regra: 'Dos dias de meta do período, em quantos o consultor bateu a Meta diária.',
  },
});

// A unidade dentro do campo da meta. As vendas em reais aparecem em mil reais
// e gravam em reais (escala).
export function unidadeDe(id, ajustes) {
  if (id === 'conversao' || id === 'consultorConversao') return { depois: 'pts' };
  if (id === 'nps') return { depois: 'ou mais' };
  if (id === 'metaDiaria') return { depois: '% dos dias' };
  if (id === 'vendas') return ajustes?.vendasEm === 'quantidade' ? { depois: 'por mês' } : { antes: 'R$', depois: 'mil', escala: 1000 };
  return { depois: '% ou mais' };
}

export function paraQuemTexto(t) {
  if (t.base === 'consultor') return 'Para consultores';
  if (t.sugestao?.vinculo === 'estagio') return 'Para estagiários';
  if (t.sugestao?.vinculo === 'formado') return 'Para professores formados';
  return 'Para professores';
}

export const pessoasTexto = (n) => (n === 0 ? 'ninguém' : n === 1 ? '1 pessoa' : `${n} pessoas`);
export const numerosContamTexto = (n) => (n === 0 ? 'Nenhum número conta' : n === 1 ? '1 número conta' : `${n} números contam`);

export function quandoTexto(t) {
  const [a, b] = mesesDaAvaliacao(t);
  return b ? `Avaliação em ${MESES[a - 1]} e ${MESES[b - 1]}` : `Avaliação em ${MESES[a - 1]}`;
}

const fimDoMes = (m) => (m === 2 ? '28 ou 29 de fevereiro' : `${new Date(2001, m, 0).getDate()} de ${MESES[m - 1]}`);
// O trecho que termina no fim do mês antes da avaliação `m` e dura `meses`.
const trecho = (m, meses) => `de 1º de ${MESES[(m - 1 - meses + 24) % 12]} a ${fimDoMes(m === 1 ? 12 : m - 1)}`;

// Os períodos da trilha (src/lib/carreira/periodo.js), por extenso.
export function periodoTexto(t) {
  const [a, b] = mesesDaAvaliacao(t);
  return b
    ? `Os números contam ${trecho(a, 6)} e ${trecho(b, 6)}.`
    : `Os números contam ${trecho(a, 12)}.`;
}

// Vazio é sem valor (null); o que não é número vira NaN, que o
// problemaDaTrilha recusa. Vírgula vale como decimal.
export function lerNumero(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  return t === '' ? null : Number(t);
}
export const numeroParaTexto = (v) => (v == null || Number.isNaN(v) ? '' : String(v).replace('.', ','));

// Os botões do editor e da lista. O principal tem fundo azul sólido, então o
// anel do foco leva a folga (anelDeFoco.test.js).
export const BOTAO_PRIMARIO = 'inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white outline-none hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
export const BOTAO_SECUNDARIO = 'inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-semibold outline-none hover:bg-muted focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-50';
