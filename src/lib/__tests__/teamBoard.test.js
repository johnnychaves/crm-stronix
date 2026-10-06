// A Meta da equipe (src/views/team/useTeamBoard.js) monta a linha de cada
// pessoa com a fatia dos leads dela (leadsByGoalOwner, em src/lib/dailyGoal.js),
// e a Meta de cada pessoa decide o resto (computeDailyGoalSlots). O contato que
// um consultor recebeu de um colega (nextFollowUpOwnerId) entra na linha de
// quem recebeu, pendente e feito, e não na do dono do lead. O hook roda de
// verdade, dentro de um componente renderizado no servidor, que escreve cada
// linha como texto ("Bruno 1/1 [l1:contato_hoje=feito]": feitas/total e as
// tarefas de cada lead). O relógio é falso e fixado em quarta-feira 15/07/2026
// 10:00, porque a Meta lê o `new Date()`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { useTeamBoard } from '../../views/team/useTeamBoard.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

const NOW = new Date(2026, 6, 15, 10, 0, 0);
const CONTATO = DAILY_GOAL_CATEGORIES.CONTATO_HOJE;
const ana = { id: 'u-ana', name: 'Ana', authUid: 'auth-ana' };
const bruno = { id: 'u-bruno', name: 'Bruno', authUid: 'auth-bruno' };

function Sonda({ leads, interactions }) {
  const board = useTeamBoard({
    leads, interactions, usersList: [ana, bruno], teamHistory: [],
    metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, renewalCheckpoints: [90, 60, 30],
    renewalGraceDays: undefined, selectedDay: null, now: NOW,
  });
  const linhas = board.rows.map((r) => {
    const tarefas = r.processed.map((l) =>
      `${l.id}:${l.categorySlugs.map((s) => `${s}=${l.categoryStatus[s] ? 'feito' : 'pendente'}`).join(',')}`);
    return `${r.user.name} ${r.doneSlots}/${r.totalSlots} [${tarefas.join(' ')}]`;
  });
  return h('output', null, linhas.join(' | '));
}
// As linhas de cada pessoa, pelo nome.
const quadro = ({ leads, interactions = [] }) => {
  const texto = renderToString(h(Sonda, { leads, interactions })).replace(/<[^>]+>/g, '');
  return Object.fromEntries(texto.split(' | ').map((linha) => [linha.slice(0, linha.indexOf(' ')), linha]));
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('Meta da equipe: o contato delegado fica na linha de quem recebeu', () => {
  // A Ana passou ao Bruno o contato de hoje com a Carla, que é lead dela.
  const contatoDaAnaComOBruno = (over = {}) => ({
    id: 'l1', name: 'Carla', status: 'Contato', consultantId: ana.id, createdAt: new Date(2026, 6, 10),
    nextFollowUp: new Date(2026, 6, 15, 16, 0), nextFollowUpType: 'Mensagem',
    nextFollowUpOwnerId: bruno.id, nextFollowUpOwnerName: 'Bruno', ...over,
  });
  const marcaDoContato = (over = {}) => ({
    id: 'i1', leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: CONTATO,
    actorId: bruno.id, actorAuthUid: bruno.authUid, createdAt: new Date(2026, 6, 15, 9, 30), ...over,
  });

  it('pendente: entra na linha do Bruno e não na da Ana', () => {
    const linhas = quadro({ leads: [contatoDaAnaComOBruno()] });
    expect(linhas.Bruno).toBe(`Bruno 0/1 [l1:${CONTATO}=pendente]`);
    expect(linhas.Ana).toBe('Ana 0/0 []');
  });

  it('feito pelo Bruno: fica feito na linha dele, e a Ana não ganha o feito', () => {
    // Depois do "Contato feito": o próximo contato limpo e a marca do Bruno.
    const feito = contatoDaAnaComOBruno({ nextFollowUp: null, nextFollowUpType: null });
    const linhas = quadro({ leads: [feito], interactions: [marcaDoContato({ goalOwnerId: bruno.id })] });
    expect(linhas.Bruno).toBe(`Bruno 1/1 [l1:${CONTATO}=feito]`);
    expect(linhas.Ana).toBe('Ana 0/0 []');
  });

  it('feito com a marca de antes do campo: fica na linha de quem a gravou', () => {
    const feito = contatoDaAnaComOBruno({ nextFollowUp: null, nextFollowUpType: null });
    const linhas = quadro({ leads: [feito], interactions: [marcaDoContato()] });
    expect(linhas.Bruno).toBe(`Bruno 1/1 [l1:${CONTATO}=feito]`);
    expect(linhas.Ana).toBe('Ana 0/0 []');
  });

  // A marca de antes do campo (a do dia do deploy e a de uma aba aberta com o
  // código antigo) vale para quem a gravou, mesmo quando o contato muda de mãos
  // no mesmo dia.
  it('a Ana conclui o próprio contato com a marca de antes do campo e passa o próximo, para hoje, ao Bruno', () => {
    const passado = contatoDaAnaComOBruno({ nextFollowUp: new Date(2026, 6, 15, 17, 0) });
    const marca = marcaDoContato({ actorId: ana.id, actorAuthUid: ana.authUid });
    const linhas = quadro({ leads: [passado], interactions: [marca] });
    expect(linhas.Ana).toBe(`Ana 1/1 [l1:${CONTATO}=feito]`);
    expect(linhas.Bruno).toBe(`Bruno 0/1 [l1:${CONTATO}=pendente]`);
  });

  it('o Bruno conclui com a marca de antes do campo e a Ana pega o próximo contato, para hoje', () => {
    const devolvido = contatoDaAnaComOBruno({
      nextFollowUpOwnerId: null, nextFollowUpOwnerName: null, nextFollowUp: new Date(2026, 6, 15, 17, 0),
    });
    const linhas = quadro({ leads: [devolvido], interactions: [marcaDoContato()] });
    expect(linhas.Bruno).toBe(`Bruno 1/1 [l1:${CONTATO}=feito]`);
    expect(linhas.Ana).toBe(`Ana 0/1 [l1:${CONTATO}=pendente]`);
  });

  it('o contato da própria Ana continua na linha dela', () => {
    const daAna = contatoDaAnaComOBruno({ nextFollowUpOwnerId: null, nextFollowUpOwnerName: null });
    const linhas = quadro({ leads: [daAna] });
    expect(linhas.Ana).toBe(`Ana 0/1 [l1:${CONTATO}=pendente]`);
    expect(linhas.Bruno).toBe('Bruno 0/0 []');
  });
});
