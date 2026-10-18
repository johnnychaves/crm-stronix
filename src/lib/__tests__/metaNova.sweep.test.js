// A tela nova da Meta mora num desvio da DailyGoalView (`if (metaNova)`). Os
// testes de comportamento montam a MetaFocoScreen direto, então quem confere a
// ligação dentro da view é esta varredura: nenhum hook depois do desvio (a
// ordem dos hooks mudaria ao ligar o ?meta=nova), os pop-ups nas duas telas e
// as ações da tela nova ligadas aos mesmos handlers da tela de hoje.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const VIEW = readFileSync(join(aqui, '../../views/DailyGoalView.jsx'), 'utf8');
const corpo = VIEW.slice(VIEW.indexOf('function DailyGoalView('));
const desvio = corpo.indexOf('if (metaNova) {');
const depois = corpo.slice(desvio);

describe('o desvio da tela nova na DailyGoalView', () => {
  it('existe e vem depois de todos os hooks', () => {
    expect(desvio).toBeGreaterThan(0);
    expect(depois).not.toMatch(/\buse[A-Z]\w*\(/);
  });

  it('as duas telas desenham os mesmos pop-ups', () => {
    expect(depois.match(/\{modals\}/g)).toHaveLength(2);
  });

  it('as ações da tela nova são os handlers da tela de hoje', () => {
    for (const ligacao of [
      'onOutcome={handleOutcome}',
      'onPostpone={handleRescheduleTask}',
      'onGoalDone={handleGoalDone}',
      'onWhatsapp={handleWhatsapp}',
      'onCall={handleCall}',
      'onFoco={setFilter}',
    ]) {
      expect(depois, ligacao).toContain(ligacao);
    }
  });

  it('a tela nova usa a Agenda do mockup B, e a de hoje continua com o card de sempre', () => {
    const antiga = corpo.indexOf('<ProgressHero');
    expect(antiga).toBeGreaterThan(desvio);
    const nova = corpo.slice(desvio, antiga);
    const deHoje = corpo.slice(antiga);
    expect(nova).toContain('<AgendaHoje');
    expect(nova).not.toContain('<DayAgendaCard');
    expect(deHoje).toContain('<DayAgendaCard');
    expect(deHoje).not.toContain('<AgendaHoje');
  });

  it('trocar de foco escreve pelo setParams, que guarda o ?meta=nova', () => {
    expect(corpo).toContain('const setFilter = (v) => setParams({ cat: v });');
  });
});
