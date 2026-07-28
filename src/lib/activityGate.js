// Portão de atividade das assinaturas ao vivo.
//
// PROBLEMA (auditoria de 28/07/2026): o app mantém ~16 assinaturas do Firestore
// abertas do login até fechar a aba. Assinatura ociosa não custa nada, MAS o
// Firestore recobra a query INTEIRA sempre que o listener fica desconectado por
// mais de 30 minutos ("you will be charged ... as if you had issued a brand-new
// query", docs de preços). Uma máquina de recepção ligada a noite toda dorme,
// perde rede e acorda várias vezes, e cada ciclo paga tudo de novo. Medido no
// console: 24% da leitura do dia acontecia entre 0h e 6h, com ZERO gravações no
// mesmo período (ou seja, não era dado mudando, era re-query).
//
// SOLUÇÃO: quando ninguém mexe, desliga as assinaturas. A sessão NÃO é
// encerrada; login, token e estado da tela continuam intactos, só o "plantão"
// com o banco é suspenso. Ao primeiro sinal de vida, religa.
//
// UMA REGRA SÓ: aba escondida não é caso especial, é simplesmente ausência de
// atividade. Assim um alt-tab de 10 segundos não derruba nada (gastaria uma
// releitura à toa na volta), e a aba minimizada cai sozinha quando o mesmo
// contador de ociosidade estoura.

// 15 minutos: folgado o bastante pra quem está atendendo alguém no balcão sem
// tocar no computador, curto o bastante pra pegar a madrugada inteira.
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// Com que frequência o relógio confere a ociosidade. Não encosta no Firestore,
// é só uma comparação de números em memória.
export const IDLE_CHECK_MS = 30 * 1000;

// Eventos que contam como "tem gente aí". mousemove e scroll cobrem o uso
// passivo (ler a tela, rolar uma lista) sem exigir clique.
export const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel'
];

// Decide se as assinaturas devem estar ligadas neste instante.
// Recebe milissegundos crus (não Date) pra ser pura e trivial de testar.
export function shouldListen({ lastActivityMs, nowMs, idleTimeoutMs = IDLE_TIMEOUT_MS }) {
  // Entrada inválida nunca pode desligar o app: na dúvida, mantém ligado.
  if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs)) return true;
  // Relógio do sistema andando pra trás (ajuste de horário, volta de suspensão)
  // também não pode desligar: trata como atividade agora.
  if (nowMs < lastActivityMs) return true;
  return nowMs - lastActivityMs < idleTimeoutMs;
}
