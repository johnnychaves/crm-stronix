// @vitest-environment jsdom
// Desde 08/10/2026 as novidades antigas não abrem mais o pop-up (WhatsNewModal):
// nenhuma entrada de ANNOUNCEMENTS é grande, e o sino guarda o histórico. Tela
// nova se apresenta com o balão "Novo" dentro dela (NewFeatureBadge). Quem
// marcar uma novidade como `major` de novo volta a abrir o pop-up para todo
// mundo que ainda não a viu, e este teste quebra para lembrar disso.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ANNOUNCEMENTS, latestUnseenAnnouncement } from '../announcements.js';

const T = 'stronix-crm-app';
const gestor = { id: 'u-gestor', role: 'admin', tenantId: T };
const consultor = { id: 'u-consultor', role: 'consultant', tenantId: T };

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('novidades sem pop-up', () => {
  it('nenhuma novidade atual é grande', () => {
    expect(ANNOUNCEMENTS.length).toBeGreaterThan(0);
    expect(ANNOUNCEMENTS.filter((a) => a.major === true).map((a) => a.id)).toEqual([]);
  });

  it('o gestor e o consultor que nunca viram nada não recebem pop-up', () => {
    expect(latestUnseenAnnouncement(gestor)).toBeNull();
    expect(latestUnseenAnnouncement(consultor)).toBeNull();
  });
});
