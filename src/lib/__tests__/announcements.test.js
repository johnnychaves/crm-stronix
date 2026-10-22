// @vitest-environment jsdom
// Desde 08/10/2026 as novidades antigas não abrem mais o pop-up (WhatsNewModal):
// nenhuma entrada de ANNOUNCEMENTS é grande, e o sino guarda o histórico. Tela
// nova se apresenta com o balão "Novo" (NewFeatureBadge). Quem
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

describe('a novidade das rotinas', () => {
  it('fala da aba Hoje numa frase', () => {
    const rotinas = ANNOUNCEMENTS.find((a) => a.id === 'rotinas-dos-consultores-2026-10');
    expect(rotinas.summary).toContain('Na aba Hoje, você acompanha o que cada um já fez, o que está atrasado e as observações do dia.');
  });
});

describe('textos que apontam para a ficha', () => {
  // O modal de cadastro saiu (desenho A2): o consultor se troca no Contexto
  // comercial, na Linha do tempo. A novidade antiga continua no sino.
  it('nenhuma novidade manda ir ao lápis ou à aba Relacionamento', () => {
    ANNOUNCEMENTS.forEach((a) => {
      expect(a.summary, a.id).not.toMatch(/Relacionamento|clique no lápis/);
    });
  });

  it('a troca de responsável aponta para o Contexto comercial, com o mesmo id e a mesma data', () => {
    const troca = ANNOUNCEMENTS.find((a) => a.id === 'troca-responsavel-2026-08');
    expect(troca.date).toBe('2026-08-26');
    expect(troca.major).toBeUndefined();
    expect(troca.summary).toContain('Contexto comercial');
  });
});
