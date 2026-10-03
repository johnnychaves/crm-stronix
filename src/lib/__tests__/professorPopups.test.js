// @vitest-environment jsdom
// O professor não recebe os pop-ups da jornada de venda: nem o tutorial do lead
// ao cliente, nem a novidade grande. Ele não abre Pipeline, Leads nem
// Configurações, e os dois pop-ups falam dessas telas. As novidades continuam
// no sino dele (spec 2026-10-02-professor-e-faltosos-design.md). O gestor
// continua vendo os passos de configurar, agora pelo isGestor.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { WalkthroughModal } from '../../components/WalkthroughModal.jsx';
import { WhatsNewModal } from '../../components/WhatsNewModal.jsx';
import { latestUnseenAnnouncement } from '../announcements.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T = 'stronix-crm-app';
const gestor = { id: 'u-gestor', role: 'admin', tenantId: T };
const consultor = { id: 'u-consultor', role: 'consultant', tenantId: T };
const professor = { id: 'u-professor', role: 'professor', professorId: 'p1', tenantId: T };

let root = null;
async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(elemento); });
}

beforeEach(() => { localStorage.clear(); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  localStorage.clear();
});

const dialogo = () => document.querySelector('[role="dialog"]');

describe('tutorial da jornada de venda', () => {
  it('abre sozinho para o consultor que ainda não viu', async () => {
    await montar(h(WalkthroughModal, { appUser: consultor }));
    expect(dialogo()).not.toBeNull();
  });

  it('não abre para o professor', async () => {
    await montar(h(WalkthroughModal, { appUser: professor }));
    expect(dialogo()).toBeNull();
  });
});

describe('novidade grande', () => {
  it('existe novidade grande para o consultor (premissa do teste)', () => {
    expect(latestUnseenAnnouncement(consultor)).not.toBeNull();
  });

  it('abre sozinha para o consultor que ainda não viu', async () => {
    await montar(h(WhatsNewModal, { appUser: consultor, onConfigure: () => {} }));
    expect(dialogo()).not.toBeNull();
  });

  it('não abre para o professor', async () => {
    await montar(h(WhatsNewModal, { appUser: professor, onConfigure: () => {} }));
    expect(dialogo()).toBeNull();
  });

  it('o gestor vê o "Como configurar" e o "Configurar agora"', async () => {
    await montar(h(WhatsNewModal, { appUser: gestor, onConfigure: () => {} }));
    expect(dialogo()?.textContent).toContain('Como configurar');
    expect(dialogo()?.textContent).toContain('Configurar agora');
  });

  it('o consultor vê a novidade sem os passos de configurar', async () => {
    await montar(h(WhatsNewModal, { appUser: consultor, onConfigure: () => {} }));
    expect(dialogo()?.textContent).not.toContain('Como configurar');
    expect(dialogo()?.textContent).not.toContain('Configurar agora');
  });
});
