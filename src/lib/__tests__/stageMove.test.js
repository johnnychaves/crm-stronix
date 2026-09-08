// Testes da regra ÚNICA de mover no funil (src/lib/stageMove.js).
// A regra que importa: quem virou cliente não volta a ser lead, em hipótese
// alguma — nem por mudança de fase, nem por Perda, nem com contrato vencido.
// O caso que motivou o módulo: um cliente com contrato era tirado de Venda por
// uma mudança de fase e perdia as marcas de cliente, mas não o contrato — a
// aba Contratos dizia "Ainda não é cliente" com o chip de contagem em 1.

import { describe, it, expect } from 'vitest';
import { planStageMove, planLoss, stageMoveBlockMessage, STAGE_MOVE_BLOCK } from '../stageMove.js';

const D = (y, m, d) => new Date(y, m - 1, d);

const leadEmEtapa = { id: 'l1', name: 'Ana Souza', status: 'Em contato', funnelId: 'f1' };
const vendaSemContrato = { id: 'l2', name: 'Bruno Lima', status: 'Venda', isConverted: true, convertedAt: D(2026, 8, 1), funnelId: 'f1' };
const clienteComContrato = {
  id: 'l3', name: 'Carla Dias', status: 'Venda', isConverted: true, convertedAt: D(2026, 8, 1),
  lifecycleStage: 'cliente', currentContractId: 'c-123', currentContractStatus: 'ativo', funnelId: 'f1'
};

describe('planStageMove — lead em etapa comum', () => {
  it('grava só o status e o balde continua ativo', () => {
    const plan = planStageMove(leadEmEtapa, 'Negociação');
    expect(plan.ok).toBe(true);
    expect(plan.patch).toEqual({ status: 'Negociação', lifecycleBucket: 'ativo' });
    expect(plan.stampConvertedAt).toBe(false);
  });

  it('inclui o funil quando ele muda e omite quando é o mesmo', () => {
    expect(planStageMove(leadEmEtapa, 'Novo', { funnelId: 'f2' }).patch.funnelId).toBe('f2');
    expect(planStageMove(leadEmEtapa, 'Novo', { funnelId: 'f1' }).patch).not.toHaveProperty('funnelId');
    expect(planStageMove(leadEmEtapa, 'Novo').patch).not.toHaveProperty('funnelId');
  });

  it('lead perdido volta para uma etapa: limpa o motivo e a data da perda', () => {
    const perdido = { ...leadEmEtapa, status: 'Perda', lossReason: 'Preço', lostAt: D(2026, 7, 1) };
    const plan = planStageMove(perdido, 'Em contato');
    expect(plan.ok).toBe(true);
    expect(plan.patch).toEqual({ status: 'Em contato', lossReason: null, lostAt: null, lifecycleBucket: 'ativo' });
  });

  it('destino com nome de matrícula pede o carimbo de convertedAt quando falta', () => {
    const plan = planStageMove(leadEmEtapa, 'Convertido');
    expect(plan.ok).toBe(true);
    expect(plan.stampConvertedAt).toBe(true);
    expect(plan.patch.lifecycleBucket).toBe('cliente');
    // O carimbo é serverTimestamp() do SDK — o caller injeta; o patch puro não traz.
    expect(plan.patch).not.toHaveProperty('convertedAt');
  });

  it('não recarimba quando convertedAt já existe', () => {
    expect(planStageMove({ ...leadEmEtapa, convertedAt: D(2026, 8, 1) }, 'Convertido').stampConvertedAt).toBe(false);
  });
});

describe('planStageMove — cliente nunca volta a ser lead', () => {
  it('cliente COM contrato → etapa comum: bloqueia, sem patch', () => {
    const plan = planStageMove(clienteComContrato, 'Em contato');
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe(STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD);
    expect(plan.patch).toBeUndefined();
  });

  it('contrato vencido ou cancelado é cliente inativo, não lead: continua bloqueando', () => {
    expect(planStageMove({ ...clienteComContrato, currentContractStatus: 'cancelado' }, 'Novo').ok).toBe(false);
    expect(planStageMove({ ...clienteComContrato, currentContractStatus: 'vencido' }, 'Novo').ok).toBe(false);
  });

  it('Venda sem contrato (antiga) também é cliente: bloqueia', () => {
    const plan = planStageMove(vendaSemContrato, 'Negociação');
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe(STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD);
  });

  it('importado sem vigência (lifecycleStage cliente, sem contrato) bloqueia', () => {
    expect(planStageMove({ ...leadEmEtapa, lifecycleStage: 'cliente' }, 'Novo').ok).toBe(false);
  });

  it('etapa com nome de matrícula é cliente: não volta para etapa comum', () => {
    expect(planStageMove({ ...leadEmEtapa, status: 'Matriculado' }, 'Em contato').ok).toBe(false);
  });

  it('cliente → etapa com nome de matrícula: segue cliente, permitido', () => {
    const plan = planStageMove(clienteComContrato, 'Matriculado');
    expect(plan.ok).toBe(true);
    expect(plan.stampConvertedAt).toBe(false);
    expect(plan.patch).toEqual({ status: 'Matriculado', lifecycleBucket: 'cliente' });
  });

  it('salvar nota com a fase igual (Venda → Venda) não é saída de Venda', () => {
    const plan = planStageMove(clienteComContrato, 'Venda');
    expect(plan.ok).toBe(true);
    expect(plan.patch).toEqual({ status: 'Venda', lifecycleBucket: 'cliente' });
  });
});

describe('planLoss — cliente não vira lead perdido', () => {
  it('lead em etapa comum pode ser marcado como Perda', () => {
    expect(planLoss(leadEmEtapa)).toEqual({ ok: true });
  });

  it('cliente com contrato, Venda sem contrato e etapa de matrícula: bloqueia', () => {
    expect(planLoss(clienteComContrato).reason).toBe(STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA);
    expect(planLoss(vendaSemContrato).ok).toBe(false);
    expect(planLoss({ ...leadEmEtapa, status: 'Matriculado' }).ok).toBe(false);
  });
});

describe('stageMoveBlockMessage', () => {
  it('fala com o primeiro nome e, com contrato, aponta para a aba Contratos', () => {
    const msg = stageMoveBlockMessage(clienteComContrato, STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD);
    expect(msg).toContain('Carla');
    expect(msg).toContain('não volta a ser lead');
    expect(msg).toContain('Contratos');
  });

  it('sem contrato não manda cancelar contrato', () => {
    const msg = stageMoveBlockMessage(vendaSemContrato, STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD);
    expect(msg).toContain('Bruno');
    expect(msg).not.toContain('cancele');
  });

  it('Perda em cliente aponta para o contrato e para a coluna Perda dos funis de cliente', () => {
    const msg = stageMoveBlockMessage(clienteComContrato, STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA);
    expect(msg).toContain('não vira lead perdido');
    expect(msg).toContain('Renovações');
  });

  it('tem um texto genérico para lead sem nome', () => {
    expect(stageMoveBlockMessage({}, STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD)).toContain('Este cliente');
  });
});
