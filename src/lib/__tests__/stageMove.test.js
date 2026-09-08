// Testes da regra ÚNICA de "mover para uma etapa comum" (src/lib/stageMove.js).
// O caso que motivou o módulo: um cliente com contrato era tirado de Venda por
// uma mudança de fase e perdia as marcas de cliente, mas não o contrato — a
// aba Contratos dizia "Ainda não é cliente" com o chip de contagem em 1.

import { describe, it, expect } from 'vitest';
import { planStageMove, stageMoveBlockMessage, STAGE_MOVE_BLOCK } from '../stageMove.js';

const D = (y, m, d) => new Date(y, m - 1, d);

const leadEmEtapa = { id: 'l1', name: 'Ana Souza', status: 'Em contato', funnelId: 'f1' };
const vendaLegado = { id: 'l2', name: 'Bruno Lima', status: 'Venda', isConverted: true, convertedAt: D(2026, 8, 1), funnelId: 'f1' };
const clienteComContrato = {
  id: 'l3', name: 'Carla Dias', status: 'Venda', isConverted: true, convertedAt: D(2026, 8, 1),
  lifecycleStage: 'cliente', currentContractId: 'c-123', currentContractStatus: 'ativo', funnelId: 'f1'
};

describe('planStageMove — etapa comum → etapa comum', () => {
  it('grava só o status e o balde continua ativo', () => {
    const plan = planStageMove(leadEmEtapa, 'Negociação');
    expect(plan.ok).toBe(true);
    expect(plan.patch).toEqual({ status: 'Negociação', lifecycleBucket: 'ativo' });
    expect(plan.undoesSale).toBe(false);
    expect(plan.stampConvertedAt).toBe(false);
  });

  it('inclui o funil quando ele muda e omite quando é o mesmo', () => {
    expect(planStageMove(leadEmEtapa, 'Novo', { funnelId: 'f2' }).patch.funnelId).toBe('f2');
    expect(planStageMove(leadEmEtapa, 'Novo', { funnelId: 'f1' }).patch).not.toHaveProperty('funnelId');
    expect(planStageMove(leadEmEtapa, 'Novo').patch).not.toHaveProperty('funnelId');
  });

  it('saindo de Perda limpa o motivo e a data da perda', () => {
    const perdido = { ...leadEmEtapa, status: 'Perda', lossReason: 'Preço', lostAt: D(2026, 7, 1) };
    const plan = planStageMove(perdido, 'Em contato');
    expect(plan.patch).toEqual({ status: 'Em contato', lossReason: null, lostAt: null, lifecycleBucket: 'ativo' });
  });
});

describe('planStageMove — saindo de Venda', () => {
  it('Venda legada SEM contrato: desfaz a venda por inteiro (a pessoa volta a ser lead)', () => {
    const plan = planStageMove(vendaLegado, 'Negociação');
    expect(plan.ok).toBe(true);
    expect(plan.undoesSale).toBe(true);
    expect(plan.patch).toEqual({
      status: 'Negociação',
      isConverted: false,
      convertedAt: null,
      lifecycleStage: null,
      lifecycleBucket: 'ativo'
    });
  });

  it('cliente importado sem vigência (lifecycleStage sem contrato) também volta a ser lead', () => {
    const importado = { ...vendaLegado, lifecycleStage: 'cliente' };
    const plan = planStageMove(importado, 'Em contato');
    expect(plan.ok).toBe(true);
    expect(plan.patch.lifecycleStage).toBeNull();
    expect(plan.patch.lifecycleBucket).toBe('ativo');
  });

  it('cliente COM contrato: bloqueia, sem patch — o contrato manda', () => {
    const plan = planStageMove(clienteComContrato, 'Em contato');
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe(STAGE_MOVE_BLOCK.CLIENTE_COM_CONTRATO);
    expect(plan.patch).toBeUndefined();
  });

  it('contrato cancelado ou vencido ainda é contrato: continua bloqueando', () => {
    expect(planStageMove({ ...clienteComContrato, currentContractStatus: 'cancelado' }, 'Novo').ok).toBe(false);
    expect(planStageMove({ ...clienteComContrato, currentContractStatus: 'vencido' }, 'Novo').ok).toBe(false);
  });

  it('cliente COM contrato → etapa com nome de matrícula: segue cliente, nada é desfeito', () => {
    const plan = planStageMove(clienteComContrato, 'Matriculado');
    expect(plan.ok).toBe(true);
    expect(plan.undoesSale).toBe(false);
    expect(plan.stampConvertedAt).toBe(false);
    expect(plan.patch).toEqual({ status: 'Matriculado', lifecycleBucket: 'cliente' });
  });

  it('salvar nota com a fase igual (Venda → Venda) não é saída de Venda', () => {
    const plan = planStageMove(clienteComContrato, 'Venda');
    expect(plan.ok).toBe(true);
    expect(plan.undoesSale).toBe(false);
    expect(plan.patch).toEqual({ status: 'Venda', lifecycleBucket: 'cliente' });
  });
});

describe('planStageMove — destino com nome de matrícula', () => {
  it('pede o carimbo de convertedAt quando o lead ainda não tem', () => {
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

describe('stageMoveBlockMessage', () => {
  it('fala com o primeiro nome e aponta para a aba Contratos', () => {
    const msg = stageMoveBlockMessage(clienteComContrato, STAGE_MOVE_BLOCK.CLIENTE_COM_CONTRATO);
    expect(msg).toContain('Carla');
    expect(msg).toContain('Contratos');
  });

  it('tem um texto genérico para lead sem nome', () => {
    const msg = stageMoveBlockMessage({}, STAGE_MOVE_BLOCK.CLIENTE_COM_CONTRATO);
    expect(msg.length).toBeGreaterThan(10);
  });
});
