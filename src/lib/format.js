// Formatação dos números do painel (BRL inteiro — os preços são redondos).
const fmtBRL = (n) => `R$ ${Number(n || 0).toLocaleString('pt-BR')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

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
export { fmtBRL, fmtNum, timeAgo, humanizeAge, humanizeUntil, formatHourLabel };
