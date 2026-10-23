// O evento do registro (TimelineEvent), renderizado em node. Os fatos de cada
// tipo continuam saindo do mesmo jeito: o que muda é o desenho (nó e régua).
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { TimelineEvent } from '../../components/profile/TimelineEvent.jsx';
import { classifyInteraction } from '../timeline.js';

const D = (m, d, hh = 10, mi = 0) => new Date(2026, m - 1, d, hh, mi);
const STATUSES = [{ id: 's1', name: 'Em contato', color: 'amber' }, { id: 's2', name: 'Negociação', color: 'violet' }];

const evento = (i) => ({ ...i, _kind: classifyInteraction(i) });
const html = (i, extra = {}) => renderToString(h(TimelineEvent, { i: evento(i), statuses: STATUSES, stageTransitions: {}, outcomeOrigin: {}, ...extra }));

describe('TimelineEvent', () => {
  it('nota: carimbo, tipo, autor e o texto sem o prefixo, com id para o link do histórico', () => {
    const out = html({ id: 'n1', type: 'note', text: 'Obs: Pediu para ligar depois.', consultantName: 'Ana Souza', createdAt: D(9, 25, 14, 32) });
    expect(out).toContain('id="ev-n1"');
    expect(out).toContain('>25/09 14:32<');
    expect(out).toContain('>Nota<');
    expect(out).toContain('>Ana Souza</div>');
    expect(out).toContain('Pediu para ligar depois.');
    expect(out).not.toContain('Obs:');
  });

  it('conversa de WhatsApp e ligação perdem o emoji e o prefixo', () => {
    const zap = html({ id: 'c1', type: 'note', text: '📲 Mensagem WhatsApp enviada: Enviei os valores', consultantName: 'Ana', createdAt: D(9, 20) });
    const lig = html({ id: 'c2', type: 'note', text: '📞 Ligação: Não atendeu', consultantName: 'Ana', createdAt: D(9, 21) });
    expect(zap).toContain('Enviei os valores');
    expect(zap).not.toContain('📲');
    expect(lig).toContain('Não atendeu');
    expect(lig).not.toContain('📞');
  });

  it('mudança de fase: os dois chips e há quanto tempo estava na anterior', () => {
    const i = { id: 's', type: 'status_change', text: 'Fase alterada para [Negociação].', consultantName: 'Ana', createdAt: D(9, 22) };
    const out = html(i, { stageTransitions: { s: { from: 'Em contato', days: 4 } } });
    expect(out).toContain('Em contato');
    expect(out).toContain('Negociação');
    expect(out).toContain('após 4d em Em contato');
  });

  it('troca de responsável é linha simples, nunca fase nem perda', () => {
    const out = html({ id: 'o', type: 'status_change', text: 'Responsável alterado de [Ana Souza] para [Bruno Lima].', consultantName: 'Carla', createdAt: D(9, 5) });
    expect(out).toContain('Responsável alterado de Ana Souza para Bruno Lima.');
    expect(out).toContain('>Responsável<');
    expect(out).not.toContain('Oportunidade encerrada');
  });

  it('perda e matrícula viram a faixa de marco, com a régua no topo', () => {
    const perda = html({ id: 'p', type: 'status_change', text: 'Lead perdido. Motivo: Preço.', consultantName: 'Ana', createdAt: D(9, 3) });
    expect(perda).toContain('border-t-2');
    expect(perda).toContain('Oportunidade encerrada');
    expect(perda).toContain('Preço');
    expect(perda).toContain('id="ev-p"');
  });

  it('venda vira a faixa de marco, sem travessão no título', () => {
    const out = html({ id: 'v1', type: 'status_change', text: 'Fase alterada para [Venda].', consultantName: 'Ana', createdAt: D(9, 4) });
    expect(out).toContain('border-t-2');
    expect(out).toContain('Virou cliente, etapa Venda');
    expect(out).toContain('Fase alterada por Ana');
  });

  it('todo evento pode receber o foco do Ver no histórico, sem entrar no Tab', () => {
    const nota = html({ id: 'n2', type: 'note', text: 'Obs: Oi.', consultantName: 'Ana', createdAt: D(9, 1) });
    const perda = html({ id: 'p2', type: 'status_change', text: 'Lead perdido. Motivo: Preço.', consultantName: 'Ana', createdAt: D(9, 3) });
    expect(nota).toContain('tabindex="-1"');
    expect(perda).toContain('tabindex="-1"');
  });

  it('agendamento: cartão com título, horário, detalhe e o selo Agendado', () => {
    const i = { id: 'a', type: 'note', text: '🔔 Visita agendada (Unidade Centro) p/ 21/10/2026, 19:00. Obs: Vem depois do trabalho.', consultantName: 'Ana', createdAt: D(10, 15) };
    const out = html(i);
    expect(out).toContain('>Agendado<');
    expect(out).toContain('Unidade Centro');
    expect(out).toContain('Vem depois do trabalho.');
  });

  it('desfecho aponta para o agendamento de origem', () => {
    const i = { id: 'd', type: 'daily_goal_done', text: '✅ Compareceu', appointmentOutcome: 'attended', consultantName: 'Ana', createdAt: D(10, 21, 20) };
    const out = html(i, { outcomeOrigin: { d: { at: D(10, 15, 9), by: 'Ana Souza', via: null } } });
    expect(out).toContain('>Compareceu<');
    expect(out).toContain('Agendada em 15/10 por Ana Souza');
  });

  it('o evento em destaque ganha o fundo de destaque', () => {
    const i = { id: 'x', type: 'note', text: 'Obs: Oi.', consultantName: 'Ana', createdAt: D(9, 1) };
    expect(html(i, { flash: true })).toContain('bg-brand-50');
    expect(html(i, { flash: false })).not.toContain('bg-brand-50');
  });

  it('evento sem texto para mostrar não desenha nada', () => {
    expect(html({ id: 'v', type: 'note', text: '', consultantName: 'Ana', createdAt: D(9, 1) })).toBe('');
  });
});
