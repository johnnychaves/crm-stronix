// O que a faixa de baixo do cabeçalho da ficha mostra (src/lib/profileBand.js).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));

const {
  SILENCE_NOTICE_DAYS, nextStepCell, stageCell, stageText, contractCell, teamCell, arrivedText, stateChipText,
} = await import('../profileBand.js');
const { CONTRACT_STATUS } = await import('../contracts.js');

const D = (m, d, h = 12, mi = 0) => new Date(2026, m - 1, d, h, mi);
const AGORA = D(10, 16, 12);

describe('nextStepCell', () => {
  it('mostra o compromisso mais próximo com o dia da semana, a data e a hora', () => {
    const lead = { name: 'Rafael Moreira', appointmentType: 'visita', appointmentScheduledFor: D(10, 21, 19), appointmentUnit: 'Centro' };
    const cell = nextStepCell(lead, AGORA);
    expect(cell.title).toBe('Visita qua, 21/10 às 19:00');
    expect(cell.item.id).toBe('appointment');
    expect(cell.detail).toContain('Centro');
  });

  it('o que vem antes ganha: o contato de amanhã passa a visita de dias depois', () => {
    const lead = {
      name: 'Rafael', appointmentType: 'visita', appointmentScheduledFor: D(10, 21, 19),
      nextFollowUp: D(10, 17, 9), nextFollowUpType: 'Ligação',
    };
    expect(nextStepCell(lead, AGORA).title).toBe('Ligação sáb, 17/10 às 09:00');
  });

  it('sem nada marcado, convida a definir', () => {
    expect(nextStepCell({ name: 'Rafael Moreira' }, AGORA)).toEqual({
      item: null, title: 'Sem próximo passo', detail: 'Defina quando falar com Rafael de novo.',
    });
  });

  it('lead perdido não tem próximo passo, como o A seguir, e não é convidado a falar de novo', () => {
    const lead = { name: 'Rafael', status: 'Perda', nextFollowUp: D(10, 17, 9), nextFollowUpType: 'Ligação' };
    expect(nextStepCell(lead, AGORA)).toEqual({ item: null, title: 'Sem próximo passo', detail: 'Lead encerrado.' });
  });
});

describe('stageCell e stageText', () => {
  const FUNNELS = [{ id: 'f1', name: 'Vendas', isDefault: true }, { id: 'f2', name: 'Outro' }];
  const STAGES = [
    { id: 's3', name: 'Visita agendada', funnelId: 'f1', order: 3 },
    { id: 's1', name: 'Novo', funnelId: 'f1', order: 1 },
    { id: 's2', name: 'Em contato', funnelId: 'f1', order: 2 },
    { id: 's4', name: 'Negociação', funnelId: 'f1', order: 4 },
    { id: 'x1', name: 'Outra etapa', funnelId: 'f2', order: 1 },
  ];
  const LEAD = {
    id: 'l1', name: 'Rafael', funnelId: 'f1', status: 'Em contato',
    statusEnteredAt: D(10, 10), lastInteractionAt: D(10, 5), createdAt: D(9, 20),
  };
  const cell = (lead) => stageCell({ lead, statuses: STAGES, funnels: FUNNELS, now: AGORA });

  it('posição no funil do lead, dias na etapa e dias sem registro', () => {
    expect(cell(LEAD)).toMatchObject({ name: 'Em contato', index: 1, total: 4, days: 6, silence: 11, silent: true });
  });

  it('só conta as etapas do funil do lead', () => {
    expect(cell({ ...LEAD, funnelId: 'f2', status: 'Outra etapa' })).toMatchObject({ index: 0, total: 1 });
  });

  it('lead sem funil é do funil padrão, como no Mudar fase', () => {
    expect(cell({ ...LEAD, funnelId: undefined })).toMatchObject({ index: 1, total: 4 });
  });

  it('sem a entrada na etapa, usa o cadastro só se for de depois de 14/09/2026', () => {
    const semEntrada = { ...LEAD, statusEnteredAt: null };
    expect(cell({ ...semEntrada, createdAt: D(9, 20) }).days).toBe(26);
    expect(cell({ ...semEntrada, createdAt: D(8, 1) }).days).toBeNull();
  });

  it('o silêncio só vira aviso a partir de 7 dias', () => {
    expect(SILENCE_NOTICE_DAYS).toBe(7);
    expect(cell({ ...LEAD, lastInteractionAt: D(10, 12) })).toMatchObject({ silence: 4, silent: false });
    expect(cell({ ...LEAD, lastInteractionAt: D(10, 9) })).toMatchObject({ silence: 7, silent: true });
  });

  it('o silêncio pega a interação mais nova do registro quando o campo do lead está atrás', () => {
    const registro = [{ leadId: 'l1', type: 'daily_goal_done', createdAt: D(10, 14) }];
    expect(stageCell({ lead: LEAD, statuses: STAGES, funnels: FUNNELS, interactions: registro, now: AGORA }))
      .toMatchObject({ silence: 2, silent: false });
  });

  it('sem registro, conta do cadastro; sem data de cadastro de verdade, não inventa silêncio', () => {
    expect(cell({ ...LEAD, lastInteractionAt: null }).silence).toBe(26);
    const semData = cell({ ...LEAD, lastInteractionAt: null, createdAtMissing: true });
    expect(semData.silence).toBeNull();
    expect(semData.silent).toBe(false);
  });

  it('etapa que não está no funil devolve posição -1', () => {
    expect(cell({ ...LEAD, status: 'Perda' }).index).toBe(-1);
  });

  it('o texto junta os dias na etapa e o aviso de silêncio', () => {
    expect(stageText({ days: 6, silence: 11, silent: true })).toBe('6 dias nesta etapa. 11 dias sem registro.');
    expect(stageText({ days: 1, silence: 2, silent: false })).toBe('1 dia nesta etapa.');
    expect(stageText({ days: 0, silence: 0, silent: false })).toBe('Entrou nesta etapa hoje.');
    expect(stageText({ days: null, silence: 9, silent: true })).toBe('9 dias sem registro.');
    expect(stageText({ days: null, silence: null, silent: false })).toBe('');
  });
});

describe('contractCell', () => {
  const CLIENTE = { id: 'l1', lifecycleStage: 'cliente', currentContractId: 'c1' };
  const contrato = (extra = {}) => ({
    id: 'c1', leadId: 'l1', planName: 'Plano Anual', status: CONTRACT_STATUS.ATIVO,
    startsAt: new Date(2026, 8, 1), endsAt: new Date(2027, 0, 12), ...extra,
  });
  const agora = new Date(2026, 9, 16, 0, 0);
  const cell = (contracts, now = agora) => contractCell({ lead: CLIENTE, contracts, now, thresholdDays: 30 });

  it('contrato em uso: plano, quanto falta e o quanto da vigência já correu', () => {
    const c = cell([contrato()]);
    expect(c.planName).toBe('Plano Anual');
    expect(c.status).toBe(CONTRACT_STATUS.ATIVO);
    expect(c.text).toBe('Restam 88 dias, vence 12/01/2027');
    expect(c.pct).toBe(34);
  });

  it('a vencer: mesma contagem, com o status a vencer', () => {
    const c = cell([contrato({ endsAt: new Date(2026, 10, 1) })]);
    expect(c.status).toBe(CONTRACT_STATUS.A_VENCER);
    expect(c.text).toBe('Restam 16 dias, vence 01/11/2026');
    expect(c.pct).not.toBeNull();
  });

  it('contrato que ainda não começou diz quando começa e não tem régua', () => {
    const c = cell([contrato({ startsAt: new Date(2026, 9, 20), endsAt: new Date(2027, 3, 20) })]);
    expect(c.status).toBe(CONTRACT_STATUS.AGENDADO);
    expect(c.text).toBe('Começa em 4 dias, início 20/10/2026');
    expect(c.pct).toBeNull();
  });

  it('trancado diz há quanto tempo, sem régua', () => {
    const c = cell([contrato({ status: CONTRACT_STATUS.TRANCADO, pausedAt: new Date(2026, 9, 4) })]);
    expect(c.status).toBe(CONTRACT_STATUS.TRANCADO);
    expect(c.text).toBe('Trancado há 12 dias, desde 04/10/2026');
    expect(c.pct).toBeNull();
  });

  it('contrato vencido diz quando venceu', () => {
    const c = cell([contrato({ startsAt: new Date(2026, 0, 1), endsAt: new Date(2026, 6, 1) })]);
    expect(c.status).toBe(CONTRACT_STATUS.VENCIDO);
    expect(c.text).toBe('Venceu em 01/07/2026');
    expect(c.pct).toBeNull();
  });

  it('contrato cancelado diz que foi cancelado', () => {
    const c = cell([contrato({ status: CONTRACT_STATUS.CANCELADO, cancelledAt: new Date(2026, 9, 1) })]);
    expect(c.status).toBe(CONTRACT_STATUS.CANCELADO);
    expect(c.text).toBe('Contrato cancelado');
    expect(c.pct).toBeNull();
  });

  it('com a renovação marcada, o em uso diz "Em uso · restam", como a aba', () => {
    const atual = contrato({ endsAt: new Date(2026, 9, 31) });
    const renov = contrato({ id: 'c2', renewedFromId: 'c1', startsAt: new Date(2026, 10, 1), endsAt: new Date(2027, 10, 1) });
    const c = contractCell({ lead: { ...CLIENTE, currentContractId: 'c2' }, contracts: [atual, renov], now: agora, thresholdDays: 30 });
    expect(c.text).toBe('Em uso · restam 15 dias, vence 31/10/2026');
  });

  it('cliente sem contrato nenhum devolve null', () => {
    expect(contractCell({ lead: { id: 'l9', lifecycleStage: 'cliente' }, contracts: [], now: agora })).toBeNull();
  });
});

describe('teamCell', () => {
  it('consultor e professor do cadastro, sem a modalidade da aula', () => {
    expect(teamCell({ consultantName: 'Júlia Andrade', professorName: 'Marcos Vieira', appointmentProfessorName: 'Caio', appointmentModality: 'Pilates' }))
      .toEqual({ consultant: 'Júlia Andrade', professor: 'Marcos Vieira', professorRole: 'professor' });
  });
  it('sem professor no cadastro, cai no professor da aula, com a modalidade', () => {
    expect(teamCell({ consultantName: 'Júlia', appointmentProfessorName: 'Marcos', appointmentModality: 'Pilates' }))
      .toEqual({ consultant: 'Júlia', professor: 'Marcos', professorRole: 'professor de Pilates' });
  });
  it('sem ninguém, devolve nulos', () => {
    expect(teamCell({})).toEqual({ consultant: null, professor: null, professorRole: 'professor' });
  });
});

describe('textos do topo', () => {
  it('arrivedText diz de onde veio, ou só a data, ou nada', () => {
    expect(arrivedText({ source: 'Instagram', createdAt: D(10, 5) }, AGORA)).toBe('Chegou por Instagram em 05/10.');
    expect(arrivedText({ createdAt: D(10, 5) }, AGORA)).toBe('Cadastrado em 05/10.');
    expect(arrivedText({ source: 'Instagram', createdAt: D(10, 5), createdAtMissing: true }, AGORA)).toBeNull();
    expect(arrivedText({}, AGORA)).toBeNull();
  });

  it('arrivedText põe o ano quando o cadastro é de outro ano', () => {
    expect(arrivedText({ source: 'Site', createdAt: new Date(2025, 11, 3) }, AGORA)).toBe('Chegou por Site em 03/12/2025.');
  });

  it('stateChipText tira a caixa alta do rótulo do estado', () => {
    expect(stateChipText('CLIENTE ATIVO')).toBe('Cliente ativo');
    expect(stateChipText('A VENCER')).toBe('A vencer');
    expect(stateChipText('CONTRATO AGENDADO')).toBe('Contrato agendado');
    expect(stateChipText('')).toBe('');
  });
});
