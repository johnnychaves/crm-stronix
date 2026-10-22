// O professor na ficha (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "O que ele vê"). Ele registra Anotação, WhatsApp, Ligação e Agendar. Não
// tem Mudar fase, foto, etiqueta, o botão Indicações, Marcar venda nem
// o menu Mais ações (Marcar perda e Excluir), e as abas Contratos e Indicações
// aparecem sem botão.
// A ficha inteira é renderizada em node (renderToString), no molde de
// profileContractsTab.test.js. Cada caso renderiza também o gestor ou o
// consultor, para provar que o texto procurado existe quando o botão aparece.
// Sem isso, um texto digitado errado aqui passaria sempre.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { hrefFor } from '../routes.js';
import { REFERRAL_FUNNEL_KIND } from '../referrals.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');
const { ReferralsSection } = await import('../../components/profile/ReferralsSection.jsx');

const D = (y, m, d) => new Date(y, m - 1, d);
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };

const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};
// O funil Indicações com a etapa de entrada: sem os dois, o gestor também não
// teria o Cadastrar indicação, e o caso do professor não provaria nada.
const FUNNELS = [{ id: 'fi', name: 'Indicações', systemKind: REFERRAL_FUNNEL_KIND }];
const STATUSES = [{ id: 's1', funnelId: 'fi', name: 'Aguardando ação', isEntry: true, order: 0 }];
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

// O Start em uso até 11/10/2026 e o Flow, renovação emendada, a partir de 12/10.
const start = {
  id: 'k1', leadId: 'c1', planId: 'p1', planName: 'Start', value: 1200, listValue: 1200, durationMonths: 12,
  status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 11), consultantName: 'Ana'
};
const flow = {
  id: 'k2', leadId: 'c1', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12,
  status: 'ativo', renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28), consultantName: 'Ana'
};
const vencido = { ...start, endsAt: D(2026, 9, 10) };

const cliente = (atual) => ({
  id: 'c1', name: 'Carla Dias', whatsapp: '11999990000', status: 'Venda', lifecycleStage: 'cliente', isConverted: true,
  clienteSince: D(2025, 10, 11), createdAt: D(2025, 9, 1), consultantName: 'Ana', tags: [],
  currentContractId: atual.id, currentPlanName: atual.planName, currentContractValue: atual.value,
  currentContractStartsAt: atual.startsAt, currentContractEndsAt: atual.endsAt,
  currentContractStatus: atual.status, currentContractSeamless: Boolean(atual.seamless)
});
const LEAD = { id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: D(2026, 9, 1), tags: [] };
// Lead no funil Indicações sem indicador: é ele que mostra o "Vincular indicador".
const LEAD_INDICADO = { ...LEAD, id: 'l2', funnelId: 'fi', status: 'Aguardando ação' };

const ficha = ({ lead, tab, appUser, contratos = [] }) => renderToString(
  createElement(MemoryRouter, { initialEntries: [`/acad/ficha/${lead.id}`] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(GeneralConfigContext.Provider, { value: { ...CONFIG, contratos } },
        createElement(LeadProfileView, {
          lead, tab, onTab: () => {}, onBack: () => {}, appUser,
          statuses: STATUSES, tags: [], lossReasons: [], usersList: [GESTOR, CONSULTOR, PROFESSOR],
          db: {}, funnels: FUNNELS,
        })))));

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
afterAll(() => { vi.useRealTimers(); });

describe('ficha do professor: compositor da Linha do tempo', () => {
  it('tem Anotação, WhatsApp, Ligação e Agendar, sem Mudar fase', () => {
    const prof = ficha({ lead: cliente(start), tab: 'timeline', appUser: PROFESSOR, contratos: [start] });
    ['>Anotação<', '>WhatsApp<', '>Ligação<', '>Agendar<'].forEach((aba) => expect(prof).toContain(aba));
    expect(prof).not.toContain('Mudar fase');
  });

  it('gestor e consultor continuam com o Mudar fase', () => {
    expect(ficha({ lead: cliente(start), tab: 'timeline', appUser: GESTOR, contratos: [start] })).toContain('>Mudar fase<');
    expect(ficha({ lead: LEAD, tab: 'timeline', appUser: CONSULTOR })).toContain('>Mudar fase<');
  });
});

describe('ficha do professor: cabeçalho', () => {
  // O que cada opção dos menus mostra é dos testes de cada menu: fechado, o
  // conteúdo dele não existe no HTML.
  const BOTOES = ['title="Alterar foto"', 'aria-label="Mais ações"', 'Adicionar etiqueta'];

  it('no cliente, o gestor tem foto, etiqueta, Indicações e Mais ações, sem o lápis do cadastro', () => {
    const html = ficha({ lead: cliente(start), tab: 'timeline', appUser: GESTOR, contratos: [start] });
    BOTOES.forEach((b) => expect(html).toContain(b));
    // O lápis ao lado do nome saiu: o caminho é a aba Cadastro.
    expect(html).not.toContain('title="Editar cadastro"');
    // Em node a contagem não chega (null): o botão e a aba ficam sem número.
    expect(html).toContain('aria-label="Indicações"');
    expect(html).toMatch(/-trigger-referrals"[^>]*>(?:(?!<\/button>).)*Indicações<\/button>/);
  });

  it('no cliente, o professor só chama: WhatsApp e Ligar', () => {
    const html = ficha({ lead: cliente(start), tab: 'timeline', appUser: PROFESSOR, contratos: [start] });
    BOTOES.forEach((b) => expect(html).not.toContain(b));
    expect(html).not.toContain('aria-label="Indicações');
    expect(html).toContain('>WhatsApp<');
    expect(html).toContain('>Ligar<');
  });

  // O lead em Perda tem o "Reativar lead" à vista, no lugar da Venda, e o menu
  // Mais ações não oferece "Marcar perda" (o canLoss do menu é falso). O
  // conteúdo do menu é coberto pelo moreActionsMenu.test.js e pelo
  // fichaCabecalho.test.js, com a ficha montada.
  it('no lead em Perda, a Venda dá lugar ao "Reativar lead", e o professor não o tem', () => {
    const emAberto = ficha({ lead: LEAD, tab: 'timeline', appUser: CONSULTOR });
    expect(emAberto).not.toContain('Reativar lead');
    expect(emAberto).toContain('>Marcar venda<');
    expect(emAberto).toContain('aria-label="Mais ações"');
    const perdido = { ...LEAD, id: 'l9', status: 'Perda', lossReason: 'Preço', lostAt: D(2026, 9, 20) };
    const consultor = ficha({ lead: perdido, tab: 'timeline', appUser: CONSULTOR });
    expect(consultor).toContain('>Reativar lead<');
    expect(consultor).not.toContain('Marcar venda');
    // Sem a perda e sem a exclusão (só do gestor), o menu nem existe.
    expect(consultor).not.toContain('aria-label="Mais ações"');
    expect(ficha({ lead: perdido, tab: 'timeline', appUser: GESTOR })).toContain('aria-label="Mais ações"');
    const prof = ficha({ lead: perdido, tab: 'timeline', appUser: PROFESSOR });
    expect(prof).not.toContain('Reativar lead');
    expect(prof).not.toContain('aria-label="Mais ações"');
  });

  it('num lead, o professor não marca venda nem perda', () => {
    const consultor = ficha({ lead: LEAD, tab: 'timeline', appUser: CONSULTOR });
    expect(consultor).toContain('>Marcar venda<');
    expect(consultor).toContain('aria-label="Mais ações"');
    const prof = ficha({ lead: LEAD, tab: 'timeline', appUser: PROFESSOR });
    expect(prof).not.toContain('Marcar venda');
    expect(prof).not.toContain('aria-label="Mais ações"');
    expect(prof).toContain('>Ligar<');
  });

  it('num lead do funil Indicações, o professor não vincula o indicador', () => {
    expect(ficha({ lead: LEAD_INDICADO, tab: 'timeline', appUser: CONSULTOR })).toContain('Vincular indicador');
    expect(ficha({ lead: LEAD_INDICADO, tab: 'timeline', appUser: PROFESSOR })).not.toContain('Vincular indicador');
  });
});

describe('ficha do professor: Contratos só para leitura', () => {
  it('contrato em uso com o próximo marcado: o professor vê os dois, sem botão', () => {
    const BOTOES = ['>Trancar<', '>Cancelar<', 'Ativar agora', '>Corrigir<', '>Cancelar renovação<'];
    const gestor = ficha({ lead: cliente(flow), tab: 'contratos', appUser: GESTOR, contratos: [start, flow] });
    BOTOES.forEach((b) => expect(gestor).toContain(b));
    const prof = ficha({ lead: cliente(flow), tab: 'contratos', appUser: PROFESSOR, contratos: [start, flow] });
    BOTOES.forEach((b) => expect(prof).not.toContain(b));
    expect(prof).toContain('>Start<');
    expect(prof).toContain('>Flow<');
    expect(prof).toContain('>Próximo<');
    expect(prof).toContain('>Histórico<');
  });

  it('sem próximo, vencido ou sem contrato: nada de Renovar, Nova matrícula nem Matricular', () => {
    const casos = [
      [cliente(start), [start], 'Renovar contrato'],
      [cliente(vencido), [vencido], 'Nova matrícula'],
      [LEAD, [], 'Matricular agora'],
    ];
    casos.forEach(([lead, contratos, botao]) => {
      expect(ficha({ lead, tab: 'contratos', appUser: CONSULTOR, contratos })).toContain(botao);
      expect(ficha({ lead, tab: 'contratos', appUser: PROFESSOR, contratos })).not.toContain(botao);
    });
  });
});

describe('ficha do professor: Indicações só para leitura', () => {
  it('o gestor tem o Cadastrar indicação; o professor vê a aba sem ele', () => {
    const gestor = ficha({ lead: cliente(start), tab: 'referrals', appUser: GESTOR, contratos: [start] });
    expect(gestor).toContain('Cadastrar indicação');
    const prof = ficha({ lead: cliente(start), tab: 'referrals', appUser: PROFESSOR, contratos: [start] });
    expect(prof).toContain('Nenhuma indicação ainda');
    expect(prof).not.toContain('Cadastrar indicação');
    expect(prof).not.toContain('botão Indicações');
  });

  it('ReferralsSection com canRefer falso não manda procurar o botão Indicações', () => {
    const html = renderToString(
      createElement(MemoryRouter, { initialEntries: ['/acad/ficha/c1/indicacoes'] },
        createElement(LeadProfileContext.Provider, { value: profile },
          createElement(ReferralsSection, { items: [], loading: false, canRefer: false }))));
    expect(html).toContain('Nenhuma indicação ainda');
    expect(html).toContain('Quando este cliente indicar alguém, a pessoa aparece aqui com o andamento dela.');
    expect(html).not.toContain('botão Indicações');
  });
});

// Bug de 21/10/2026: trocar o professor no cadastro do cliente não mudava o
// "Professor resp." da ficha, que lia só o professor da aula experimental.
describe('profileProfessorOf', () => {
  it('o professor do cadastro vem primeiro; sem ele, o da aula', async () => {
    const { profileProfessorOf } = await import('../professores.js');
    expect(profileProfessorOf({ professorName: 'Bia', appointmentProfessorName: 'Caio', appointmentModality: 'Pilates' }))
      .toEqual({ name: 'Bia', modality: null });
    expect(profileProfessorOf({ appointmentProfessorName: 'Caio', appointmentModality: 'Pilates' }))
      .toEqual({ name: 'Caio', modality: 'Pilates' });
    expect(profileProfessorOf({ professorName: 'Caio', appointmentProfessorName: 'Caio', appointmentModality: 'Pilates' }))
      .toEqual({ name: 'Caio', modality: 'Pilates' });
    expect(profileProfessorOf({})).toBeNull();
  });
});
