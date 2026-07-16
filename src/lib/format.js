// Formatação de moeda BRL — sempre 2 casas (padrão de moeda, aceita centavos).
const fmtBRL = (n) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

// Lê o valor digitado no campo de preço (plano/matrícula) e devolve número ou
// null. Aceita vírgula ou ponto decimal, ponto de milhar e prefixo R$. Regra:
// com vírgula, ela é o decimal e os pontos são milhar; sem vírgula, o ponto é
// o decimal.
const parseValorBRL = (input) => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (input == null) return null;
  let s = String(input).trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Formata um número para pré-preencher o campo de valor na edição: "197,90".
// Faz round-trip com parseValorBRL. Vazio/nulo/ inválido vira ''.
const valorToInput = (n) => {
  if (n == null || n === '') return '';
  const num = Number(n);
  return Number.isFinite(num) ? num.toFixed(2).replace('.', ',') : '';
};

// Tempo relativo curto para o feed de auditoria.
const timeAgo = (ms) => {
  if (!ms) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60); if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24); return `há ${d}d`;
};

function humanizeAge(date, now = new Date()) {
  if (!date) return '';
  const diff = Math.max(0, now - date);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function humanizeUntil(date, now = new Date()) {
  if (!date) return '';
  const diff = date - now;
  if (diff < -60000) return humanizeAge(date, now);
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'agora';
  if (mins < 60) return `em ${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `em ${h}h`;
  const d = Math.floor(h / 24);
  return `em ${d}d`;
}

function formatHourLabel(date) {
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export { fmtBRL, parseValorBRL, valorToInput, fmtNum, timeAgo, humanizeAge, humanizeUntil, formatHourLabel };
