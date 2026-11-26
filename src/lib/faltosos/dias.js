// Dias dos faltosos como texto AAAA-MM-DD, no calendário de Brasília. As
// planilhas da Next Fit trazem dia e hora escritos, e o que importa é o dia,
// não o instante: a conta entre dois dias é feita sobre o texto, com
// Date.UTC, e não depende do fuso de quem roda. Só "hoje" e o fim do contrato
// (que chegam como instante) passam pelo horário de Brasília, pelo mesmo
// leitor do cartão do Stronizap (api/_horarioDeBrasilia.js).
//
// Puro e sem pacote: os módulos de src/lib/faltosos rodam em node nos testes
// e no navegador, e o faltosos.imports.test.js confere.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Os dados").
import { diaDeBrasilia, isoDoDia } from '../../../api/_horarioDeBrasilia.js';
import { getSafeDateOrNull } from '../dates.js';

const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

// Número do dia (dias desde 01/01/1970), o mesmo que diaDeBrasilia devolve.
// NaN para texto fora do formato ou dia que não existe (31/02).
export function numeroDoDia(dia) {
  const m = DIA_RE.exec(typeof dia === 'string' ? dia : '');
  if (!m) return NaN;
  const [ano, mes, diaDoMes] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(ano, mes - 1, diaDoMes);
  const d = new Date(t);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== diaDoMes) return NaN;
  return t / DAY_MS;
}

export const diaValido = (dia) => Number.isFinite(numeroDoDia(dia));

// O dia `n` dias depois (ou antes, com n negativo). null para dia inválido ou
// n que não é inteiro.
export function somarDias(dia, n) {
  const x = numeroDoDia(dia);
  return Number.isFinite(x) && Number.isInteger(n) ? isoDoDia(x + n) : null;
}

// Dias do calendário de `a` até `b` (b menos a). null se um dos dois é inválido.
export function diasEntre(a, b) {
  const x = numeroDoDia(a);
  const y = numeroDoDia(b);
  return Number.isFinite(x) && Number.isFinite(y) ? y - x : null;
}

// O mais novo dos dias válidos, ou null. Texto AAAA-MM-DD compara como dia.
export function maiorDia(...dias) {
  return dias.filter(diaValido).reduce((max, d) => (max === null || d > max ? d : max), null);
}

// 'AAAA-MM' do dia (o mês do documento stronix_presencas/{leadId}_{AAAA-MM}), ou null.
export const mesDoDia = (dia) => (diaValido(dia) ? dia.slice(0, 7) : null);

// "03/10" e "03/10/2026", para a prévia e a linha do tempo. Texto vazio para o
// que não é dia.
export const ddmm = (dia) => (diaValido(dia) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : '');
export const ddmmaaaa = (dia) => (diaValido(dia) ? `${ddmm(dia)}/${dia.slice(0, 4)}` : '');

// "02/10", ou "15/12/2025" quando o ano não é o de `hojeDia`. Sem o ano, a
// data de dezembro lida em janeiro pareceria do fim do ano seguinte. É a data
// da aba Presenças e do selo da ficha. Texto vazio para o que não é dia.
export function dataCurta(dia, hojeDia = null) {
  if (!diaValido(dia)) return '';
  return diaValido(hojeDia) && hojeDia.slice(0, 4) !== dia.slice(0, 4) ? ddmmaaaa(dia) : ddmm(dia);
}

// Hoje no calendário de Brasília, seja qual for o fuso do navegador. null
// para instante inválido.
export function hojeEmBrasilia(agora = new Date()) {
  const n = diaDeBrasilia(agora);
  return Number.isFinite(n) ? isoDoDia(n) : null;
}

// O dia de Brasília de um instante gravado (Date, Timestamp do Firestore ou
// texto), como o fim do contrato, que é gravado à meia-noite de Brasília.
export function diaEmBrasilia(valor) {
  const d = getSafeDateOrNull(valor);
  if (!d) return null;
  const n = diaDeBrasilia(d);
  return Number.isFinite(n) ? isoDoDia(n) : null;
}
