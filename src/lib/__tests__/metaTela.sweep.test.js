// A Meta diária tem uma tela só desde a virada (PR 5 do plano da Meta): a do
// Foco agora, montada pela MetaFocoScreen. Os testes de comportamento montam a
// MetaFocoScreen direto, então quem confere a ligação dentro da DailyGoalView e
// no App é esta varredura: as ações ligadas aos handlers da view, os pop-ups
// desenhados, nada da tela antiga de volta e o número de urgentes no título.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const VIEW = readFileSync(join(aqui, '../../views/DailyGoalView.jsx'), 'utf8');
const APP = readFileSync(join(aqui, '../../App.jsx'), 'utf8');
const corpo = VIEW.slice(VIEW.indexOf('function DailyGoalView('));

describe('a tela da Meta na DailyGoalView', () => {
  it('desenha a MetaFocoScreen e os pop-ups, sem a tela antiga', () => {
    expect(corpo).toContain('<MetaFocoScreen');
    expect(corpo.match(/\{modals\}/g)).toHaveLength(1);
    for (const antigo of ['TaskCard', 'ProgressHero', 'DayAgendaCard', 'NextUp', 'StreakCard', 'metaNova', 'handleGoalDone']) {
      expect(VIEW, antigo).not.toContain(antigo);
    }
  });

  it('as ações da tela são os handlers da view', () => {
    for (const ligacao of [
      'onOutcome={handleOutcome}',
      'onPostpone={handleRescheduleTask}',
      'onOutcomePopup={openOutcomePopup}',
      'onConclude={concludeTask}',
      'onWhatsapp={handleWhatsapp}',
      'onCall={handleCall}',
      'onFoco={setFilter}',
      'onMark={markAgendaPresence}',
      'onCorrect={handleCorrectOutcome}',
    ]) {
      expect(corpo, ligacao).toContain(ligacao);
    }
  });

  it('trocar de foco escreve pelo setParams', () => {
    expect(corpo).toContain('const setFilter = (v) => setParams({ cat: v });');
  });

  it('o relógio da tela congela na pausa por inatividade', () => {
    expect(corpo).toContain('const now = useFrozenWhileIdle(liveNow, listenersActive);');
  });
});

describe('o número de urgentes no título da aba', () => {
  it('o App monta o contador só para quem vende, com a base e as regras da Meta', () => {
    const tag = APP.slice(APP.indexOf('<MetaUrgentCount'), APP.indexOf('/>', APP.indexOf('<MetaUrgentCount')));
    for (const prop of ['leads={metaLeads}', 'interactions={interactions}', 'userId={appUser.id}', 'renewalCheckpoints={renewalCheckpoints}', 'renewalGraceDays={renewalGraceDays}', 'onChange={setMetaUrgent}']) {
      expect(tag, prop).toContain(prop);
    }
    const i = APP.indexOf('<MetaUrgentCount');
    expect(APP.lastIndexOf('{isSeller(appUser) && (', i)).toBeGreaterThan(APP.lastIndexOf('</SilentErrorBoundary>', i));
  });

  it('o título leva o número só com uma tela de sessão aberta', () => {
    expect(APP).toContain('const titleUrgent = titleScreen ? metaUrgent : 0;');
    expect(APP).toContain('documentTitle({ screen: titleScreen, tenantName: titleTenant, urgent: titleUrgent })');
  });
});
