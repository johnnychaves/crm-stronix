// Regras puras do SINO: o que entra no feed (novidades + indicações que
// chegaram pelo link), quem vê o quê e o que conta como não lido.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildNotificationFeed, readSeenState, mergeSeenIds, writeReferralStamp } from '../notifications.js';
import { markAnnouncementSeen } from '../announcements.js';

const NOW = new Date(2026, 7, 9, 12, 0);
const ago = (h) => new Date(NOW.getTime() - h * 3600_000);

const ANNS = [
  { id: 'a1', audience: 'todos', eyebrow: 'Novidade', title: 'Indicações no ar', summary: 's1', date: '2026-08-01', articleId: 'indicacoes' },
  { id: 'a2', audience: 'gestor', eyebrow: 'Novidade', title: 'Só gestor', summary: 's2', date: '2026-07-01' }
];

const consultor = { id: 'u1', authUid: 'uid1', role: 'consultant' };
const admin = { id: 'u9', authUid: 'uid9', role: 'admin' };

const lead = (over) => ({
  id: 'l1', name: 'João', referralVia: 'link', referredByName: 'Maria',
  consultantId: 'u1', consultantAuthUid: 'uid1', createdAt: ago(1), ...over
});

describe('buildNotificationFeed — novidades', () => {
  it('respeita o público: consultor não vê anúncio de gestor', () => {
    const { news } = buildNotificationFeed({ announcements: ANNS, appUser: consultor, now: NOW });
    expect(news.map((n) => n.id)).toEqual(['a1']);
  });

  it('admin vê os dois e o já visto não conta como novo', () => {
    const { news } = buildNotificationFeed({ announcements: ANNS, appUser: admin, seenIds: ['a1'], now: NOW });
    expect(news.map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(news.find((n) => n.id === 'a1').unread).toBe(false);
    expect(news.find((n) => n.id === 'a2').unread).toBe(true);
  });

  it('carrega o artigo da wiki quando o anúncio aponta pra um', () => {
    const { news } = buildNotificationFeed({ announcements: ANNS, appUser: admin, now: NOW });
    expect(news[0].articleId).toBe('indicacoes');
    expect(news[0].at).toEqual(new Date('2026-08-01'));
  });
});

describe('buildNotificationFeed — indicações pelo link', () => {
  it('só entra lead marcado como vindo do link', () => {
    const leads = [lead(), lead({ id: 'l2', referralVia: null }), lead({ id: 'l3', referralVia: 'link' })];
    const { referrals } = buildNotificationFeed({ announcements: [], appUser: admin, leads, now: NOW });
    expect(referrals.map((r) => r.id).sort()).toEqual(['l1', 'l3']);
  });

  it('consultor vê só a própria carteira; admin vê todas', () => {
    const leads = [lead(), lead({ id: 'l2', consultantId: 'u2', consultantAuthUid: 'uid2' })];
    expect(buildNotificationFeed({ announcements: [], appUser: consultor, leads, now: NOW }).referrals.map((r) => r.id)).toEqual(['l1']);
    expect(buildNotificationFeed({ announcements: [], appUser: admin, leads, now: NOW }).referrals).toHaveLength(2);
  });

  it('não lido é o que chegou depois da última visita, e a ordem é do mais novo', () => {
    const leads = [lead({ id: 'velho', createdAt: ago(50) }), lead({ id: 'novo', createdAt: ago(2) })];
    const { referrals } = buildNotificationFeed({
      announcements: [], appUser: admin, leads, lastSeenReferralsAt: ago(24).getTime(), now: NOW
    });
    expect(referrals.map((r) => r.id)).toEqual(['novo', 'velho']);
    expect(referrals[0].unread).toBe(true);
    expect(referrals[1].unread).toBe(false);
  });

  it('ignora indicação antiga demais e respeita o teto da lista', () => {
    const leads = [
      lead({ id: 'antigo', createdAt: new Date(2026, 5, 1) }),
      ...Array.from({ length: 20 }, (_, i) => lead({ id: `l${i}`, createdAt: ago(i + 1) }))
    ];
    const { referrals } = buildNotificationFeed({ announcements: [], appUser: admin, leads, now: NOW, maxReferrals: 15 });
    expect(referrals).toHaveLength(15);
    expect(referrals.some((r) => r.id === 'antigo')).toBe(false);
  });

  it('lead sem createdAt não quebra e fica de fora', () => {
    const { referrals } = buildNotificationFeed({
      announcements: [], appUser: admin, leads: [lead({ createdAt: null })], now: NOW
    });
    expect(referrals).toEqual([]);
  });
});

describe('buildNotificationFeed — contagem do badge', () => {
  it('soma novidades não lidas e indicações novas', () => {
    const leads = [lead({ id: 'a', createdAt: ago(1) }), lead({ id: 'b', createdAt: ago(48) })];
    const { unreadCount } = buildNotificationFeed({
      announcements: ANNS, appUser: admin, leads, seenIds: ['a2'], lastSeenReferralsAt: ago(24).getTime(), now: NOW
    });
    expect(unreadCount).toBe(2); // a1 não lida + 1 indicação nova
  });

  it('sem usuário devolve feed vazio', () => {
    expect(buildNotificationFeed({ announcements: ANNS, appUser: null, now: NOW }))
      .toEqual({ news: [], referrals: [], unreadCount: 0 });
  });
});

// ---------------------------------------------------------------------------
// "Já li" — a leitura que quebrava no F5
// ---------------------------------------------------------------------------
// O app monta ANTES de a sessão existir (appUser null) e só depois o usuário
// chega. A leitura tem de acompanhar essa troca: era isso que faltava, e por
// isso as mesmas novidades voltavam como não lidas a cada atualização da página.

describe('readSeenState — leitura do "já li"', () => {
  const fakeStorage = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k)
    };
  };

  beforeEach(() => { globalThis.localStorage = fakeStorage(); });
  afterEach(() => { delete globalThis.localStorage; });

  const u = { id: 'u1', role: 'consultant' };

  it('sem sessão devolve vazio (é o estado do primeiro render do app)', () => {
    expect(readSeenState(null)).toEqual({ seenIds: [], lastSeenReferralsAt: 0 });
    expect(readSeenState({})).toEqual({ seenIds: [], lastSeenReferralsAt: 0 });
  });

  it('quando a sessão chega, devolve o que o usuário já tinha lido', () => {
    // 1º render: ainda não há sessão.
    expect(readSeenState(null).seenIds).toEqual([]);

    // Usuário leu numa visita anterior (o que markAllSeen gravou).
    markAnnouncementSeen(u, 'a1');
    writeReferralStamp(u.id, 1_700_000_000_000);

    // Render seguinte, já com a sessão: a leitura acompanha.
    const s = readSeenState(u);
    expect(s.seenIds).toEqual(['a1']);
    expect(s.lastSeenReferralsAt).toBe(1_700_000_000_000);
  });

  it('não mistura usuários: o que um leu não conta para o outro', () => {
    markAnnouncementSeen(u, 'a1');
    writeReferralStamp(u.id, 1_700_000_000_000);
    expect(readSeenState({ id: 'u2' })).toEqual({ seenIds: [], lastSeenReferralsAt: 0 });
  });

  it('carimbo das indicações é o maior entre o doc do usuário e o localStorage', () => {
    writeReferralStamp(u.id, 100);
    expect(readSeenState({ ...u, lastSeenReferralsAtMs: 500 }).lastSeenReferralsAt).toBe(500);
    writeReferralStamp(u.id, 900);
    expect(readSeenState({ ...u, lastSeenReferralsAtMs: 500 }).lastSeenReferralsAt).toBe(900);
  });

  it('localStorage indisponível não derruba a leitura', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('bloqueado'); } };
    expect(readSeenState({ ...u, lastSeenReferralsAtMs: 42 })).toEqual({ seenIds: [], lastSeenReferralsAt: 42 });
  });
});

describe('mergeSeenIds', () => {
  it('junta o gravado com o que foi marcado agora, sem repetir', () => {
    expect(mergeSeenIds(['a1'], ['a1', 'a2'])).toEqual(['a1', 'a2']);
    expect(mergeSeenIds(undefined, undefined)).toEqual([]);
  });
});
