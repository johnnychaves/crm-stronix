// A faixa de baixo do cabeçalho da ficha (ProfileHeaderBand). Marcação em
// node; o clique do Próximo passo é coberto pelos testes da ficha montada.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));

const { ProfileHeaderBand } = await import('../../components/profile/ProfileHeaderBand.jsx');
const { nextStepCell, stageCell, contractCell, teamCell } = await import('../profileBand.js');
const { getTone } = await import('../leadState.js');
const { CONTRACT_STATUS } = await import('../contracts.js');

const D = (m, d, hh = 12) => new Date(2026, m - 1, d, hh);
const AGORA = D(10, 16);
const FUNNELS = [{ id: 'f1', name: 'Vendas', isDefault: true }];
const STAGES = [
  { id: 's1', name: 'Novo', funnelId: 'f1', order: 1 },
  { id: 's2', name: 'Em contato', funnelId: 'f1', order: 2 },
  { id: 's3', name: 'Negociação', funnelId: 'f1', order: 3 },
];
const LEAD = {
  id: 'l1', name: 'Rafael Moreira', funnelId: 'f1', status: 'Em contato', whatsapp: '(51) 9 9184-2270',
  statusEnteredAt: D(10, 10), lastInteractionAt: D(10, 5), createdAt: D(9, 20),
  consultantName: 'Júlia Andrade', professorName: 'Marcos Vieira',
  appointmentType: 'visita', appointmentScheduledFor: D(10, 21, 19), appointmentUnit: 'Centro',
};
const CONTACT = { phone: '(51) 9 9184-2270', viaGuardian: false };

const render = (props = {}) => renderToString(h(ProfileHeaderBand, {
  band: {
    next: nextStepCell(LEAD, AGORA),
    mid: stageCell({ lead: LEAD, statuses: STAGES, funnels: FUNNELS, now: AGORA }),
    team: teamCell(LEAD),
  },
  isClient: false,
  tone: getTone('amber'),
  contact: CONTACT,
  contactText: '',
  studentPhone: null,
  onGoNext: () => {},
  onCopyPhone: () => {},
  ...props,
}));

describe('ProfileHeaderBand', () => {
  it('os quatro rótulos, em frase normal, sem caixa alta', () => {
    const html = render();
    ['Próximo passo', 'Etapa', 'Contato', 'Equipe'].forEach((rotulo) => expect(html).toContain(`>${rotulo}<`));
    expect(html).not.toContain('uppercase');
    expect(html).not.toContain('tracking-');
  });

  it('próximo passo é um botão que leva ao A seguir', () => {
    const html = render();
    expect(html).toContain('Visita qua, 21/10 às 19:00');
    expect(html).toMatch(/<button[^>]*aria-label="Ver o próximo passo no A seguir: Visita qua, 21\/10 às 19:00"/);
  });

  it('sem próximo passo, não é botão e convida a definir', () => {
    const html = render({ band: { next: nextStepCell({ name: 'Rafael' }, AGORA), mid: null, team: teamCell({}) } });
    expect(html).toContain('Sem próximo passo');
    expect(html).toContain('Defina quando falar com Rafael de novo.');
    expect(html).not.toContain('Ver o próximo passo no A seguir');
  });

  it('próximo passo atrasado avisa por escrito', () => {
    const atrasado = { ...LEAD, appointmentScheduledFor: D(10, 14, 19), nextFollowUp: D(10, 14, 19), nextFollowUpType: 'Visita' };
    const html = render({ band: { next: nextStepCell(atrasado, AGORA), mid: null, team: teamCell({}) } });
    expect(html).toContain('>Atrasado<');
  });

  it('lead: a etapa, a régua do funil e os dias', () => {
    const html = render();
    expect(html).toContain('>Etapa<');
    expect(html).toContain('Em contato');
    expect((html.match(/data-seg/g) || [])).toHaveLength(3);
    expect(html).toContain('6 dias nesta etapa. 11 dias sem registro.');
  });

  it('cliente: o contrato com o plano, a régua e quanto falta', () => {
    const lead = { id: 'l1', lifecycleStage: 'cliente', currentContractId: 'c1' };
    const contrato = { id: 'c1', leadId: 'l1', planName: 'Plano Anual', status: CONTRACT_STATUS.ATIVO, startsAt: new Date(2026, 8, 1), endsAt: new Date(2027, 0, 12) };
    const html = render({
      isClient: true,
      band: { next: nextStepCell(lead, AGORA), mid: contractCell({ lead, contracts: [contrato], now: new Date(2026, 9, 16) }), team: teamCell({}) },
    });
    expect(html).toContain('>Contrato<');
    expect(html).toContain('Plano Anual');
    expect(html).toContain('Restam 88 dias, vence 12/01/2027');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="34"');
  });

  it('cliente sem contrato registrado', () => {
    const html = render({ isClient: true, band: { next: nextStepCell({ name: 'Ana' }, AGORA), mid: null, team: teamCell({}) } });
    expect(html).toContain('Sem contrato registrado');
  });

  it('contato: o número e o botão de copiar', () => {
    const html = render();
    expect(html).toContain('(51) 9 9184-2270');
    expect(html).toContain('aria-label="Copiar número"');
  });

  it('contato de menor: rótulo do responsável, a linha dele e o número do aluno', () => {
    const html = render({
      contact: { phone: '(11) 9 5555-4444', viaGuardian: true },
      contactText: 'Ana Costa (mãe)',
      studentPhone: '(11) 9 7777-1111',
    });
    expect(html).toContain('>Contato (responsável)<');
    expect(html).toContain('Ana Costa (mãe)');
    expect(html).toContain('Aluno · (11) 9 7777-1111');
    expect(html).toContain('aria-label="Copiar número do responsável"');
    expect(html).toContain('aria-label="Copiar número do aluno"');
  });

  it('equipe: consultor e professor com o papel, e o que falta', () => {
    const html = render();
    expect(html).toContain('Júlia Andrade');
    expect(html).toContain('>consultor<');
    expect(html).toContain('Marcos Vieira');
    expect(html).toContain('>professor<');
    const vazio = render({ band: { next: nextStepCell({ name: 'A' }, AGORA), mid: null, team: teamCell({}) } });
    expect(vazio).toContain('Sem responsável');
    expect(vazio).toContain('Sem professor');
  });
});
