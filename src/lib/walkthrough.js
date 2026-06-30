// ============================================================================
// TUTORIAL ("Como funciona") — walkthrough da jornada lead → cliente.
// Carrossel de passos mostrado UMA vez por usuário (rastreado no localStorage)
// e reabrível a qualquer momento pelo ícone de ajuda no topo. Sem backend /
// sem função Vercel. Conteúdo product-wide (todas as academias).
//
// Cada passo: { key, tone, eyebrow, title, desc }. A ILUSTRAÇÃO é escolhida
// por `key` dentro do WalkthroughModal. `tone` é um nome de TONES (leadState.js)
// — define a cor do anel de estado e do realce do passo.
//
// Mudou o conteúdo e quer reexibir a todos? Suba WALKTHROUGH_VERSION.
// ============================================================================
export const WALKTHROUGH_VERSION = 1;

export const WALKTHROUGH_STEPS = [
  {
    key: 'lead',
    tone: 'brand',
    eyebrow: 'Passo 1 · Captação',
    title: 'Capte o lead com a dor',
    desc: 'Cadastre o lead já registrando a dor ou necessidade dele. É o que orienta toda a conversa e aparece direto na ficha.',
  },
  {
    key: 'pipeline',
    tone: 'brand',
    eyebrow: 'Passo 2 · Pipeline',
    title: 'Trabalhe o pipeline',
    desc: 'Mova o lead pelas etapas no Kanban. Registre ligações e mensagens, e agende a visita ou a aula experimental.',
  },
  {
    key: 'venda',
    tone: 'emerald',
    eyebrow: 'Passo 3 · Venda',
    title: 'Feche a venda e matricule',
    desc: 'Ao mover para Venda, abra a matrícula: escolha o plano, ajuste o valor com desconto e defina a vigência do contrato.',
  },
  {
    key: 'cliente',
    tone: 'emerald',
    eyebrow: 'Passo 4 · Cliente',
    title: 'Agora é cliente',
    desc: 'O lead sai do Kanban e entra na aba Clientes com o contrato ativo. O anel verde no avatar mostra o novo ciclo de vida.',
  },
  {
    key: 'renovar',
    tone: 'amber',
    eyebrow: 'Passo 5 · Renovação',
    title: 'Acompanhe e renove',
    desc: 'Perto do vencimento o contrato vira “A vencer” na ficha e uma tarefa cai na Meta Diária. Renove ou cancele em um clique.',
    tip: 'Dica: cadastre seus planos e dores em Configurações → Catálogos para deixar a captação e a matrícula completas.',
  },
];

const SEEN_KEY = (uid) => `stronix_seen_walkthrough_${uid || 'anon'}`;

// true = o usuário já viu a versão atual do tutorial.
export function walkthroughSeen(appUser) {
  if (!appUser?.id) return true; // sem usuário não auto-exibe
  try {
    const v = Number(localStorage.getItem(SEEN_KEY(appUser.id)) || 0);
    return v >= WALKTHROUGH_VERSION;
  } catch {
    return true; // localStorage indisponível — não força o pop-up
  }
}

export function markWalkthroughSeen(appUser) {
  if (!appUser?.id) return;
  try {
    localStorage.setItem(SEEN_KEY(appUser.id), String(WALKTHROUGH_VERSION));
  } catch { /* localStorage indisponível — ignora (reaparece no próximo load) */ }
}
