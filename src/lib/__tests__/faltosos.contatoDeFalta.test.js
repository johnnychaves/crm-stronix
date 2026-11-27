import { describe, it, expect } from 'vitest';
import { montarContato, montarJaVoltou, textoDoContato } from '../faltosos/contatoDeFalta.js';
import { ABSENCE_CONTACT_TYPE } from '../leads.js';

const AGORA = { __serverTime: true };
const lead = { id: 'l1', name: 'Marina Albuquerque', consultantId: 'c1', consultantAuthUid: 'ac1' };
const quem = { id: 'u6', authUid: 'a6', name: 'Heloísa Prado' };
const estado = { leadId: 'l1', status: 'faltando', professorId: 'p1', urgente: false, inicioFalta: '2026-10-14',
  tarefa: { marco: 30, urgente: false, status: 'pendente', inicioFalta: '2026-10-14', criadaEm: '2026-11-23', importacaoId: 'f', feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null } };

describe('montarContato', () => {
  it('interação no nome de quem registrou e tarefa feita', () => {
    const r = montarContato({ lead, estado, quem, canal: 'whatsapp', resultado: 'vai_voltar', observacao: ' Volta segunda. ', agora: AGORA });
    expect(r.interacao).toMatchObject({
      type: ABSENCE_CONTACT_TYPE, leadId: 'l1', leadName: 'Marina Albuquerque', consultantName: 'Heloísa Prado',
      leadConsultantId: 'c1', leadConsultantAuthUid: 'ac1', actorId: 'u6', actorAuthUid: 'a6', createdAt: AGORA,
      canal: 'whatsapp', resultado: 'vai_voltar', marco: 30, urgente: false, inicioFalta: '2026-10-14', professorId: 'p1',
      text: 'Contato de falta (30 dias), WhatsApp: vai voltar. Volta segunda.',
    });
    expect(r.estadoPatch).toEqual({
      tarefa: { ...estado.tarefa, status: 'feita', feitaEm: AGORA, feitaPor: 'u6', feitaPorNome: 'Heloísa Prado', canal: 'whatsapp', resultado: 'vai_voltar' },
    });
  });

  it('quer cancelar marca o estado para o sino', () => {
    const r = montarContato({ lead, estado, quem, canal: 'ligacao', resultado: 'quer_cancelar', observacao: '', agora: AGORA });
    expect(r.estadoPatch).toMatchObject({ querCancelarEm: AGORA, querCancelarPorNome: 'Heloísa Prado', querCancelarAluno: 'Marina Albuquerque' });
    expect(r.interacao.text).toBe('Contato de falta (30 dias), Ligação: quer cancelar.');
  });

  it('no urgente, o texto diz urgente', () => {
    const r = montarContato({ lead, estado: { ...estado, urgente: true }, quem, canal: 'pessoalmente', resultado: 'respondeu', observacao: '', agora: AGORA });
    expect(r.interacao.text).toBe('Contato de falta (urgente), Pessoalmente: respondeu.');
  });

  it('recusa tarefa que não está pendente, canal ou resultado desconhecido', () => {
    const feita = { ...estado, tarefa: { ...estado.tarefa, status: 'feita' } };
    expect(() => montarContato({ lead, estado: feita, quem, canal: 'whatsapp', resultado: 'vai_voltar', agora: AGORA })).toThrow();
    const outroPeriodo = { ...estado, tarefa: { ...estado.tarefa, inicioFalta: '2026-08-01' } };
    expect(() => montarContato({ lead, estado: outroPeriodo, quem, canal: 'whatsapp', resultado: 'vai_voltar', agora: AGORA })).toThrow();
    expect(() => montarContato({ lead, estado, quem, canal: 'fax', resultado: 'vai_voltar', agora: AGORA })).toThrow();
    expect(() => montarContato({ lead, estado, quem, canal: 'whatsapp', resultado: 'talvez', agora: AGORA })).toThrow();
  });
});

describe('montarJaVoltou', () => {
  it('fecha a tarefa como voltou, sem interação', () => {
    expect(montarJaVoltou({ estado, quem, agora: AGORA })).toEqual({
      tarefa: { ...estado.tarefa, status: 'voltou', feitaEm: AGORA, feitaPor: 'u6', feitaPorNome: 'Heloísa Prado', canal: null, resultado: null },
    });
  });
});

it('a observação vai até 500 caracteres', () => {
  expect(textoDoContato({ marco: 7, urgente: false, canal: 'whatsapp', resultado: 'respondeu', observacao: 'x'.repeat(600) }).length).toBeLessThanOrEqual(560);
});
