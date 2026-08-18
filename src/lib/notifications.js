// Regra pura do SINO do header: monta o feed de avisos e diz quantos estão por
// ler. Duas fontes, semânticas de leitura diferentes:
//   • novidades  — anúncios de feature (lib/announcements.js), "visto" por id
//     no localStorage do usuário (padrão que já existia no pop-up).
//   • indicações — leads que entraram pelo LINK público (campo referralVia),
//     "visto" por carimbo de tempo (lastSeenReferralsAt).
// Sem React, sem Firestore: os leads já vêm da assinatura que o app mantém em
// memória, então o sino não custa nenhuma leitura nova.
//
// Aqui também mora a LEITURA do "já li" (readSeenState), porque ela precisa ser
// pura: o hook a chama a cada render em vez de congelar o valor no mount.

import { getSafeDateOrNull } from './dates.js';
import { seenAnnouncementIds } from './announcements.js';

// Janela do feed de indicações. Passou disso, o lead virou trabalho de
// pipeline, não aviso.
const REFERRAL_WINDOW_DAYS = 30;

export function buildNotificationFeed({
  announcements = [],
  appUser,
  seenIds = [],
  leads = [],
  lastSeenReferralsAt = 0,
  now = new Date(),
  maxReferrals = 15,
  windowDays = REFERRAL_WINDOW_DAYS
} = {}) {
  if (!appUser?.id) return { news: [], referrals: [], unreadCount: 0 };

  const isAdmin = appUser.role === 'admin';
  const seen = new Set(seenIds || []);

  const news = (announcements || [])
    .filter((a) => a?.audience === 'todos' || (a?.audience === 'gestor' && isAdmin))
    .map((a) => ({
      id: a.id,
      eyebrow: a.eyebrow || 'Novidade',
      title: a.title,
      summary: a.summary,
      articleId: a.articleId || null,
      at: a.date ? new Date(a.date) : null,
      unread: !seen.has(a.id)
    }));

  // Admin vê as indicações da academia inteira; consultor vê a própria carteira
  // (o indicado herda o consultor do cliente que compartilhou o link).
  const isMine = (l) =>
    isAdmin ||
    (Boolean(appUser.authUid) && l?.consultantAuthUid === appUser.authUid) ||
    (Boolean(appUser.id) && l?.consultantId === appUser.id);

  const cutoff = now.getTime() - windowDays * 86_400_000;
  const referrals = (leads || [])
    .filter((l) => l?.referralVia === 'link' && isMine(l))
    .map((l) => ({ lead: l, at: getSafeDateOrNull(l.createdAt) }))
    .filter((x) => x.at && x.at.getTime() >= cutoff)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, maxReferrals)
    .map(({ lead, at }) => ({
      id: lead.id,
      name: lead.name || 'Sem nome',
      referredByName: lead.referredByName || null,
      modalidade: lead.modalidade || null,
      at,
      unread: at.getTime() > (lastSeenReferralsAt || 0)
    }));

  const unreadCount =
    news.filter((n) => n.unread).length + referrals.filter((r) => r.unread).length;

  return { news, referrals, unreadCount };
}


// ---------------------------------------------------------------------------
// "JÁ LI" — leitura
// ---------------------------------------------------------------------------
// O carimbo das indicações tem duas moradas: o doc do usuário (viaja entre
// aparelhos) e o localStorage (reserva para conta antiga cujo id do doc não é o
// auth uid, em que a regra nega a escrita). Vale sempre o maior dos dois.

const REFERRAL_STAMP_KEY = (uid) => `stronix_seen_referrals_${uid || 'anon'}`;

export function readReferralStamp(uid) {
  try { return Number(localStorage.getItem(REFERRAL_STAMP_KEY(uid))) || 0; }
  catch { return 0; }
}

export function writeReferralStamp(uid, ms) {
  try { localStorage.setItem(REFERRAL_STAMP_KEY(uid), String(ms)); }
  catch { /* sem localStorage: fica só o doc do usuário */ }
}

// O que este usuário já leu. SEM usuário devolve vazio, e é justamente por isso
// que ela tem de ser chamada de novo quando a sessão chega: no primeiro render
// do app o appUser ainda é null (a sessão é resolvida depois, no
// onAuthStateChanged). Guardar este retorno no mount marcava tudo como não lido
// para sempre, e todo F5 trazia os mesmos avisos de volta.
export function readSeenState(appUser) {
  if (!appUser?.id) return { seenIds: [], lastSeenReferralsAt: 0 };
  return {
    seenIds: seenAnnouncementIds(appUser),
    lastSeenReferralsAt: Math.max(
      Number(appUser.lastSeenReferralsAtMs) || 0,
      readReferralStamp(appUser.id)
    )
  };
}

// Junta o que está gravado com o que foi marcado agora, nesta sessão.
export function mergeSeenIds(stored = [], justMarked = []) {
  return [...new Set([...(stored || []), ...(justMarked || [])])];
}
