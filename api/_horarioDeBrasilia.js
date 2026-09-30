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

// "2026-10-01", a partir do número que diaDeBrasilia devolve.
export function isoDoDia(dia) {
  const d = new Date(dia * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Dia da semana (0 = domingo … 6 = sábado) do número que diaDeBrasilia
// devolve. Mesma numeração do getDay() e dos metaWeekdays da academia.
export function diaDaSemanaDoDia(dia) {
  return new Date(dia * DAY_MS).getUTCDay();
}

// Hora cheia em Brasília, de 0 a 23. NaN para data inválida.
export function horaInteiraDeBrasilia(date) {
  const p = partes(date);
  return p ? p.hour : NaN;
}

// "01/10/2026, 18:00": o dia e a hora como o navegador escreve em pt-BR
// (toLocaleString com dia, mês, ano, hora e minuto), mas sempre no horário
// de Brasília. É o formato que parseAppointment lê. null para data inválida.
export function dataHoraDeBrasilia(date) {
  const p = partes(date);
  return p ? `${pad(p.day)}/${pad(p.month)}/${p.year}, ${pad(p.hour)}:${pad(p.minute)}` : null;
}

// O instante de um dia ("2026-10-01") e de uma hora ("18:00") escritos no
// horário de Brasília. null quando vêm fora do formato ou não existem (31/02,
// 24:00). Brasília está em -03:00 desde que o horário de verão acabou, em
// 2019, mas a conta lê o deslocamento do Intl em vez de fixá-lo.
export function instanteDeBrasilia(dia, hora) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof dia === 'string' ? dia : '');
  const h = /^(\d{2}):(\d{2})$/.exec(typeof hora === 'string' ? hora : '');
  if (!d || !h) return null;
  const [ano, mes, diaDoMes, horas, minutos] = [d[1], d[2], d[3], h[1], h[2]].map(Number);
  if (horas > 23 || minutos > 59) return null;
  // O relógio pedido, lido como se fosse UTC. Date.UTC aceita 31/02 e vira
  // 03/03, então o dia é conferido.
  const relogio = Date.UTC(ano, mes - 1, diaDoMes, horas, minutos);
  const conferido = new Date(relogio);
  if (conferido.getUTCFullYear() !== ano || conferido.getUTCMonth() !== mes - 1 || conferido.getUTCDate() !== diaDoMes) {
    return null;
  }
  // Quanto Brasília está atrás do UTC nesse momento (-3 horas, hoje).
  const p = partes(conferido);
  const deslocamento = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - relogio;
  return new Date(relogio - deslocamento);
}
