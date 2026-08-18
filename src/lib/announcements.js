// ============================================================================
// "NOVIDADES" — anúncios de feature (hardcoded).
// Feature nova = adiciona 1 entrada NO TOPO do array (id novo).
// Todas aparecem no SINO do header (lib/notifications.js), com histórico e
// marcação de lido; só as marcadas `major: true` interrompem com o pop-up
// (WhatsNewModal). Sem backend / sem função Vercel. Conteúdo product-wide.
//   audience: 'todos'  → consultor e gestor veem
//   audience: 'gestor' → só admin vê
//   date               → 'YYYY-MM-DD', usado no "há X dias" do sino
//   major              → lançamento grande: além do sino, abre o pop-up
//   articleId          → artigo da Central de ajuda (lib/wiki.js) que explica
//   adminSteps         → passos "como configurar" (mostrados só p/ admin)
// ============================================================================
export const ANNOUNCEMENTS = [
  {
    id: 'vencidos-2026-08',
    audience: 'todos',
    date: '2026-08-18',
    articleId: 'vencidos',
    eyebrow: 'Novidade',
    title: 'Vencidos entram na Meta Diária',
    summary:
      'Cliente que deixou o contrato vencer volta na lista todo dia, pelo prazo que a academia definir. Antes ele sumia da rotina no dia seguinte ao vencimento.',
  },
  {
    id: 'indicacoes-2026-08',
    audience: 'todos',
    date: '2026-08-09',
    major: true,
    articleId: 'indicacoes',
    eyebrow: 'Novidade',
    title: 'Sistema de indicações no ar',
    summary:
      'Agora dá para registrar quem indicou cada lead e acompanhar o que aconteceu com o convite. Cada aluno também tem um link próprio para chamar amigos, e quem se cadastra por ele já entra vinculado, no seu nome.',
    points: [
      'No cadastro de lead, ligue "É uma indicação?" e escolha o aluno que indicou.',
      'A ficha do aluno ganhou a aba Indicações, com quem ele trouxe e quantos viraram alunos.',
      'Quando o indicado fecha matrícula, o aviso aparece na linha do tempo de quem indicou.',
    ],
    adminSteps: [
      'O funil "Indicações" é criado sozinho na primeira vez que um administrador entra.',
      'Em Configurações → Pessoas, use "Indicações sem dono" para dizer quem indicou os leads antigos.',
    ],
  },
  {
    id: 'meta-prospeccao-2026-06',
    audience: 'todos',
    date: '2026-06-20',
    major: true,
    articleId: 'meta-diaria',
    eyebrow: 'Novidade',
    title: 'Meta de Prospecção + novo Painel da Equipe',
    summary:
      'Agora, além da meta diária de tarefas, cada consultor tem um piso de prospecção: um mínimo de ações por dia. Conta agendar visita ou aula, registrar ligação ou mensagem, e cadastrar lead novo. Quem zera as tarefas e ainda bate a prospecção ganha o selo Dia perfeito ⚡.',
    points: [
      'O Painel da Equipe virou uma tabela executiva com as duas metas (diária e prospecção) lado a lado.',
      'Gráfico "Trajetória do mês" clicável: clique num dia para ver os resultados daquele dia.',
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

// Ids já vistos por este usuário — o sino usa para marcar o que é novo.
export function seenAnnouncementIds(appUser) {
  return [...readSeen(appUser?.id)];
}

// O anúncio GRANDE mais recente que serve ao público do usuário e que ele ainda
// não viu. null = nada a interromper. As novidades menores não passam por aqui:
// vivem só no sino, sem pop-up.
export function latestUnseenAnnouncement(appUser) {
  if (!appUser?.id) return null;
  const isAdmin = appUser.role === 'admin';
  const seen = readSeen(appUser.id);
  return ANNOUNCEMENTS.find(a =>
    a.major === true && !seen.has(a.id) && (a.audience === 'todos' || (a.audience === 'gestor' && isAdmin))
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
