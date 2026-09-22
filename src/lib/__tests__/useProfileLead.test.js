// O primeiro render do useProfileLead, sem Firebase de verdade e sem jsdom.
// O renderToString não roda effect, então aqui se confere o que a tela mostra
// antes de qualquer resposta: nunca um lead, e o status certo para cada caso.
// As respostas do Firestore são cobertas pelas funções puras (fichaState).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'stronix_leads' }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}));

const { useProfileLead } = await import('../../hooks/useProfileLead.js');

function Probe(props) {
  const { status, lead, retry } = useProfileLead(props);
  return createElement('output', null, `${status}|${lead ? lead.id : 'sem-lead'}|${typeof retry}`);
}

const render = (props) => renderToString(createElement(Probe, { db: {}, active: true, ...props }));

describe('useProfileLead (primeiro render)', () => {
  it('com sessão e id válido começa carregando, sem lead', () => {
    expect(render({ leadId: 'AbC123xyz', sessionKey: 'acad:u1' })).toContain('loading|sem-lead|function');
  });

  it('sem sessão espera o login', () => {
    expect(render({ leadId: 'AbC123xyz', sessionKey: null })).toContain('waiting|sem-lead|function');
  });

  it('id inválido do endereço é "invalid", com ou sem sessão', () => {
    expect(render({ leadId: 'a/b', sessionKey: 'acad:u1' })).toContain('invalid|sem-lead|function');
    expect(render({ leadId: null, sessionKey: null })).toContain('invalid|sem-lead|function');
  });

  it('com o portão de ociosidade fechado continua carregando, sem lead', () => {
    expect(render({ leadId: 'AbC123xyz', sessionKey: 'acad:u1', active: false })).toContain('loading|sem-lead|function');
  });
});
