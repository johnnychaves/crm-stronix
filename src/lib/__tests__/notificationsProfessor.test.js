// O sino do professor: só as novidades do Stronilead (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). Nada de indicações pelo link nem de "passaram para você", mesmo que
// algum lead aponte para ele como dono. O consultor, com a mesma carteira,
// continua recebendo os dois grupos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildNotificationFeed, emptyBellText } from '../notifications.js';

const NOW = new Date(2026, 9, 2, 12, 0);
const ago = (h) => new Date(NOW.getTime() - h * 3600_000);

const ANNS = [
  { id: 'a1', audience: 'todos', eyebrow: 'Novidade', title: 'Para todos', summary: 's1', date: '2026-09-30' },
  { id: 'a2', audience: 'gestor', eyebrow: 'Novidade', title: 'Só gestor', summary: 's2', date: '2026-09-29' }
];

const professor = { id: 'p1', authUid: 'uidp', role: 'professor', professorId: 'prof1' };
const consultor = { id: 'u1', authUid: 'uid1', role: 'consultant' };
const gestor = { id: 'u9', authUid: 'uid9', role: 'admin' };

const indicado = (over) => ({
  id: 'l1', name: 'João', referralVia: 'link', referredByName: 'Maria',
  consultantId: 'p1', consultantAuthUid: 'uidp', createdAt: ago(1), ...over
});
const passado = (over) => ({
  id: 'l9', name: 'Carla', consultantId: 'p1', consultantAuthUid: 'uidp',
  consultantChangedAt: ago(2), consultantChangedByName: 'Bruno', consultantChangedByAuthUid: 'uid2', ...over
});

describe('sino do professor', () => {
  it('recebe só as novidades para todos', () => {
    const feed = buildNotificationFeed({
      announcements: ANNS, appUser: professor, leads: [indicado()], handoffLeads: [passado()], now: NOW
    });
    expect(feed.news.map((n) => n.id)).toEqual(['a1']);
    expect(feed.referrals).toEqual([]);
    expect(feed.handoffs).toEqual([]);
    expect(feed.unreadCount).toBe(1);
  });

  it('a mesma carteira, com o consultor como dono, continua chegando ao consultor', () => {
    const dele = { consultantId: 'u1', consultantAuthUid: 'uid1' };
    const feed = buildNotificationFeed({
      announcements: ANNS, appUser: consultor, leads: [indicado(dele)], handoffLeads: [passado(dele)], now: NOW
    });
    expect(feed.news.map((n) => n.id)).toEqual(['a1']);
    expect(feed.referrals.map((r) => r.id)).toEqual(['l1']);
    expect(feed.handoffs.map((h) => h.id)).toEqual(['l9']);
    expect(feed.unreadCount).toBe(3);
  });

  it('o gestor continua vendo a novidade de gestor e as indicações da academia', () => {
    const feed = buildNotificationFeed({
      announcements: ANNS, appUser: gestor, leads: [indicado()], handoffLeads: [], now: NOW
    });
    expect(feed.news.map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(feed.referrals.map((r) => r.id)).toEqual(['l1']);
  });
});

describe('texto do sino vazio', () => {
  it('o professor ouve só das novidades; quem vende, dos três grupos', () => {
    expect(emptyBellText(professor)).toBe('Nada por aqui ainda. As novidades do Stronilead aparecem neste espaço.');
    const deQuemVende = 'Nada por aqui ainda. Novidades do sistema, indicações pelo link e leads que passarem pra você aparecem neste espaço.';
    expect(emptyBellText(consultor)).toBe(deQuemVende);
    expect(emptyBellText(gestor)).toBe(deQuemVende);
  });
});

// O App só busca os "passados pra você" (useHandoffs, uma leitura por sessão)
// para quem recebe esse grupo no sino. O App inteiro não roda em teste de
// node, então o texto dele é lido. A conferência é por regex, e não pelo
// texto exato da linha, porque o `enabled` também leva a guarda
// `!professorAccessOff(appUser)` da Task 7, que o professorShell.test.js
// cobra na mesma chamada.
describe('o App não busca os passados pra você de quem não os recebe', () => {
  it('o useHandoffs liga só com ACTIONS.SINO_EQUIPE', () => {
    const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');
    expect(app).toMatch(/useHandoffs\(\{[^}]*enabled: [^}]*can\(appUser, ACTIONS\.SINO_EQUIPE\)[^}]*\}\)/);
  });
});
