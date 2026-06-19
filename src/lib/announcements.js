// ============================================================================
// "NOVIDADES" — anúncios de feature em pop-up (hardcoded).
// Feature nova = adiciona 1 entrada NO TOPO do array (id novo). Mostrado uma vez
// por usuário no carregamento (WhatsNewModal), rastreado no localStorage.
// Sem backend / sem função Vercel. Conteúdo product-wide (todas as academias).
//   audience: 'todos'  → consultor e gestor veem
//   audience: 'gestor' → só admin vê
//   adminSteps         → passos "como configurar" (mostrados só p/ admin)
// ============================================================================
export const ANNOUNCEMENTS = [
  {
    id: 'meta-prospeccao-2026-06',
    audience: 'todos',
    eyebrow: 'Novidade',
    title: 'Meta de Prospecção + novo Painel da Equipe',
    summary:
      'Além da meta diária de tarefas, agora cada consultor tem um piso de PROSPECÇÃO: uma cota de ações por dia — agendar visita ou aula, registrar ligação ou mensagem, e cadastrar lead novo. Quem zera as tarefas E bate a prospecção ganha o selo Dia perfeito ⚡.',
    points: [
      'O Painel da Equipe virou uma tabela executiva com as duas metas (diária e prospecção) lado a lado.',
      'Gráfico “Trajetória do mês” clicável: clique num dia para ver os resultados daquele dia.',
      'O gestor também pode entrar na meta de prospecção (opcional).',
    ],
    adminSteps: [
      'Abra Configurações → Regras gerais.',
      'Defina o piso de ações por dia da academia e, se quiser, um alvo por consultor.',
    ],
  },
];

const SEEN_KEY = (uid) => `stronix_seen_announcements_${uid || 'anon'}`;

function readSeen(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')); }
  catch { return new Set(); }
}

// O anúncio mais recente (1º do array) que serve ao público do usuário e que
// ele ainda não viu. null = nada a mostrar.
export function latestUnseenAnnouncement(appUser) {
  if (!appUser?.id) return null;
  const isAdmin = appUser.role === 'admin';
  const seen = readSeen(appUser.id);
  return ANNOUNCEMENTS.find(a =>
    !seen.has(a.id) && (a.audience === 'todos' || (a.audience === 'gestor' && isAdmin))
  ) || null;
}

export function markAnnouncementSeen(appUser, id) {
  if (!appUser?.id || !id) return;
  try {
    const seen = readSeen(appUser.id);
    seen.add(id);
    localStorage.setItem(SEEN_KEY(appUser.id), JSON.stringify([...seen]));
  } catch { /* localStorage indisponível — ignora (mostra de novo no próximo load) */ }
}
