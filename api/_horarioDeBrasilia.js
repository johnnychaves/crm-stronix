// Dia e hora no horário de Brasília, seja qual for o fuso do processo.
//
// As funções da Vercel rodam em UTC, e lá o TZ é variável reservada: não dá
// para trocar o fuso do processo. getHours() e getDate() leem esse fuso, então
// no servidor uma visita às 18h saía como "21:00", e das 21h à meia-noite de
// Brasília o "hoje" do servidor já era o dia seguinte. Aqui a leitura do
// calendário sai sempre de America/Sao_Paulo. Nenhum Date é deslocado: o
// instante continua o mesmo, e o ISO que o cartão manda não muda.
//
// Serve para hora escrita e para contar dias de calendário. Comparar dois
// instantes (venceu? faltam quantas horas?) não depende de fuso e não precisa
// disto.

const FUSO = 'America/Sao_Paulo';
const DAY_MS = 86400000;

const leitor = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23'
});

// Ano, mês (1 a 12), dia, hora e minuto em Brasília. null para data inválida,
// porque o Intl lança erro onde o getHours() devolvia NaN, e uma data estranha
// num lead não pode derrubar o cartão.
function partes(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const p = {};
  for (const { type, value } of leitor.formatToParts(d)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return p;
}

// Número do dia no calendário de Brasília (dias desde 01/01/1970). A diferença
// entre dois números é a distância em dias de calendário, seja qual for a hora
// de cada um. NaN para data inválida.
export function diaDeBrasilia(date) {
  const p = partes(date);
  return p ? Date.UTC(p.year, p.month - 1, p.day) / DAY_MS : NaN;
}

const pad = (n) => String(n).padStart(2, '0');

// "18:00". null para data inválida.
export function horaDeBrasilia(date) {
  const p = partes(date);
  return p ? `${pad(p.hour)}:${pad(p.minute)}` : null;
}

// "09/09", a partir do número que diaDeBrasilia devolve.
export function ddmmDoDia(dia) {
  const d = new Date(dia * DAY_MS);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}
