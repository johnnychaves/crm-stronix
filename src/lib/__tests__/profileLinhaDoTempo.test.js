// A Linha do tempo da ficha depois que a aba CRM saiu (desenho A2, 16/10/2026):
// Contexto comercial, compositor, "A seguir" e registro numa tela só. Renderiza a
// ficha inteira em node, como profileProfessor.test.js.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const D = (y, m, d, h = 0) => new Date(y, m - 1, d, h);
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };
const SEM_LOGIN = { id: 'u4', name: 'Legado', role: 'consultant', tenantId: 'acad', authUid: null };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

const LEAD = {
  id: 'l1', name: 'Rafael Moreira', whatsapp: '11999990000', status: 'Novo', createdAt: D(2026, 9, 1),
  dor: 'Emagrecimento', modalidade: 'Musculação', source: 'Instagram', consultantName: 'Júlia Andrade',
  tags: [], observation: 'Casamento em dezembro.',
};

const ficha = ({ lead = LEAD, tab = 'timeline', appUser = GESTOR, sources = [] } = {}) => renderToString(
  createElement(MemoryRouter, { initialEntries: [`/acad/ficha/${lead.id}`] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead, tab, onTab: () => {}, onBack: () => {}, appUser, sources,
        statuses: [], tags: [], lossReasons: [], usersList: [GESTOR], db: {}, funnels: [],
      }))));

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(D(2026, 10, 16, 10)); });
afterAll(() => { vi.useRealTimers(); });

describe('Linha do tempo sem a aba CRM', () => {
  it('não tem mais a aba CRM', () => {
    const html = ficha();
    expect(html).not.toContain('>CRM<');
    expect(html).not.toContain('-trigger-crm');
  });

  it('abre com o Contexto comercial e o compositor, nessa ordem, antes do registro', () => {
    const html = ficha();
    expect(html).toContain('Contexto comercial');
    ['>Anotação<', '>WhatsApp<', '>Ligação<', '>Mudar fase<', '>Agendar<'].forEach((rotulo) => expect(html).toContain(rotulo));
    expect(html.indexOf('Contexto comercial')).toBeLessThan(html.indexOf('>Anotação<'));
    expect(html.indexOf('>Anotação<')).toBeLessThan(html.indexOf('Sem histórico ainda'));
  });

  it('gestor e consultor veem os campos como botões de editar', () => {
    for (const appUser of [GESTOR, CONSULTOR]) {
      const html = ficha({ appUser });
      // Cinco listas (a célula é o gatilho) e dois botões, cada um com o "Editar" para o leitor de tela.
      expect(html.match(/role="combobox"/g)).toHaveLength(5);
      expect(html.match(/class="sr-only">Editar </g)).toHaveLength(7);
      expect(html).toContain('Clique em um campo para editar');
    }
  });

  it('o professor vê o contexto, sem poder editar', () => {
    const html = ficha({ appUser: PROFESSOR });
    expect(html).toContain('Contexto comercial');
    expect(html).toContain('Emagrecimento');
    expect(html).not.toContain('class="sr-only">Editar ');
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain('Clique em um campo para editar');
  });

  it('quem está sem login vinculado também só lê o contexto', () => {
    const html = ficha({ appUser: SEM_LOGIN });
    expect(html).toContain('Emagrecimento');
    expect(html).not.toContain('class="sr-only">Editar ');
    expect(html).not.toContain('role="combobox"');
  });

  it('A seguir aparece com visita marcada e some quando não há nada marcado', () => {
    const marcado = { ...LEAD, appointmentType: 'visita', appointmentScheduledFor: D(2026, 10, 21, 19), appointmentUnit: 'Centro', nextFollowUp: D(2026, 10, 21, 19), nextFollowUpType: 'Visita' };
    const comVisita = ficha({ lead: marcado });
    expect(comVisita).toContain('aria-label="A seguir"');
    expect(comVisita).toContain('Unidade Centro');
    expect(ficha()).not.toContain('aria-label="A seguir"');
  });

  it('a lista vazia do registro manda registrar no compositor, e não na aba CRM', () => {
    const html = ficha();
    expect(html).not.toContain('na aba CRM');
    expect(html).toContain('Registre uma nota, mensagem ou ligação');
  });

  it('a chave antiga tab crm abre a Linha do tempo, nunca a ficha em branco', () => {
    // A rota já descarta o segmento; este é o caso de um chamador que ainda passe a chave.
    expect(ficha({ tab: 'crm' })).toContain('Contexto comercial');
  });

  const hoje = { ...LEAD, appointmentType: 'visita', appointmentScheduledFor: D(2026, 10, 16, 19), appointmentUnit: 'Centro', nextFollowUp: D(2026, 10, 16, 19), nextFollowUpType: 'Visita' };

  it('A seguir de hoje tem Remarcar e Marcar desfecho para quem muda fase', () => {
    for (const appUser of [GESTOR, CONSULTOR]) {
      const html = ficha({ lead: hoje, appUser });
      expect(html).toContain('>Remarcar<');
      expect(html).toContain('aria-label="Marcar desfecho: Visita"');
    }
  });

  it('compromisso de dias à frente só tem Remarcar', () => {
    const html = ficha({ lead: { ...hoje, appointmentScheduledFor: D(2026, 10, 21, 19), nextFollowUp: D(2026, 10, 21, 19) }, appUser: GESTOR });
    expect(html).toContain('>Remarcar<');
    expect(html).not.toContain('aria-label="Marcar desfecho');
  });

  it('visita de anteontem sem desfecho só tem Remarcar, como na Agenda de hoje', () => {
    const anteontem = D(2026, 10, 14, 19);
    const html = ficha({ lead: { ...hoje, appointmentScheduledFor: anteontem, nextFollowUp: anteontem }, appUser: GESTOR });
    expect(html).toContain('aria-label="A seguir"');
    expect(html).toContain('>Remarcar<');
    expect(html).not.toContain('aria-label="Marcar desfecho');
  });

  it('o professor remarca, mas não marca desfecho', () => {
    const html = ficha({ lead: hoje, appUser: PROFESSOR });
    expect(html).toContain('>Remarcar<');
    expect(html).not.toContain('aria-label="Marcar desfecho');
  });

  it('quem está sem login vinculado não tem ação no A seguir', () => {
    const html = ficha({ lead: hoje, appUser: SEM_LOGIN });
    expect(html).toContain('aria-label="A seguir"');
    expect(html).not.toContain('>Remarcar<');
    expect(html).not.toContain('aria-label="Marcar desfecho');
  });

  describe('cabeçalho', () => {
    // A barra fina (56 px) e o mês que gruda embaixo dela cobrem o topo da área
    // que rola: quem volta com Shift+Tab via o foco sumir atrás deles.
    it('os focáveis da ficha têm margem de rolagem para não ficarem atrás da barra fina e do mês', () => {
      const html = ficha();
      const raiz = html.match(/<div class="([^"]*max-w-\[1160px\][^"]*)"/);
      expect(raiz).toBeTruthy();
      // O renderToString escreve o & como &amp;.
      expect(raiz[1].replaceAll('&amp;', '&').split(' ')).toContain('[&_:is(a,button,input,textarea,[tabindex])]:scroll-mt-32');
    });

    it('a faixa de baixo tem os quatro blocos, em frase normal', () => {
      const html = ficha();
      ['Próximo passo', 'Etapa', 'Contato', 'Equipe'].forEach((rotulo) => expect(html).toContain(`>${rotulo}<`));
      expect(html).not.toContain('Consultor resp.');
      expect(html).not.toContain('Professor resp.');
      expect(html).toContain('Júlia Andrade');
    });

    it('o selo do estado sai em frase normal, e o lead diz de onde veio', () => {
      const html = ficha();
      expect(html).toContain('>Lead<');
      expect(html).not.toContain('>LEAD<');
      expect(html).toContain('Chegou por Instagram em 01/09.');
    });

    it('a barra fina existe, escondida, fora da leitura e repete o nome', () => {
      const html = ficha();
      const barra = html.slice(html.indexOf('data-slot="ficha-mini"'));
      expect(barra).toMatch(/^data-slot="ficha-mini" aria-hidden="true" inert=""/);
      expect(barra).toContain('Rafael Moreira');
    });

    it('o próximo passo é a visita marcada, e é um botão', () => {
      const marcado = { ...LEAD, appointmentType: 'visita', appointmentScheduledFor: D(2026, 10, 21, 19), appointmentUnit: 'Centro', nextFollowUp: D(2026, 10, 21, 19), nextFollowUpType: 'Visita' };
      expect(ficha({ lead: marcado })).toContain('aria-label="Ver o próximo passo no A seguir: Visita qua, 21/10 às 19:00"');
      expect(ficha()).toContain('Sem próximo passo');
    });

    it('WhatsApp e Ligar ficam à vista para todos, e o professor fica sem Venda e sem Mais ações', () => {
      const prof = ficha({ appUser: PROFESSOR });
      expect(prof).toContain('>WhatsApp<');
      expect(prof).toContain('>Ligar<');
      expect(prof).not.toContain('Marcar venda');
      expect(prof).not.toContain('aria-label="Mais ações"');
    });
  });

  describe('aba Cadastro', () => {
    it('o gestor tem a aba, e o endereço dela abre a leitura com o que falta', () => {
      const html = ficha({ tab: 'cadastro', appUser: GESTOR });
      expect(html).toContain('-trigger-cadastro');
      expect(html).toContain('para completar o cadastro');
      expect(html).toContain('aria-label="Identidade"');
    });

    it('o consultor também tem a aba', () => {
      const html = ficha({ tab: 'cadastro', appUser: CONSULTOR });
      expect(html).toContain('-trigger-cadastro');
      expect(html).toContain('aria-label="Identidade"');
    });

    it('o professor não tem a aba, e o endereço dela abre a Linha do tempo', () => {
      const html = ficha({ tab: 'cadastro', appUser: PROFESSOR });
      expect(html).not.toContain('-trigger-cadastro');
      expect(html).not.toContain('para completar o cadastro');
      expect(html).toContain('aria-label="Contexto comercial"');
    });

    it('sem login vinculado (só leitura) também não tem a aba', () => {
      const html = ficha({ tab: 'cadastro', appUser: SEM_LOGIN });
      expect(html).not.toContain('-trigger-cadastro');
      expect(html).not.toContain('para completar o cadastro');
    });

    it('a aba vem logo depois da Linha do tempo', () => {
      const html = ficha({ tab: 'timeline', appUser: GESTOR });
      expect(html.indexOf('-trigger-timeline')).toBeGreaterThan(-1);
      expect(html.indexOf('-trigger-cadastro')).toBeGreaterThan(html.indexOf('-trigger-timeline'));
      expect(html.indexOf('-trigger-contratos')).toBeGreaterThan(html.indexOf('-trigger-cadastro'));
    });
  });
});
