// Estado da configuração de funis do primeiro login de gestor, amarrado à
// academia (src/lib/setupRun.js). O "Acessar como" troca de academia sem
// recarregar a página, então status e marcas de "já configurado" que não sabem
// de qual academia vieram deixam a academia assumida sem configurar até o F5.

import { describe, it, expect } from 'vitest';
import {
  IDLE_RUN, runStatusFor, settleRun,
  EMPTY_SETUP_FLAGS, setupFlagsFromConfig, setupFlagFor,
} from '../setupRun.js';

const SETUP_KEYS = ['funnels', 'referral', 'expired', 'renewal', 'upgrade'];

describe('IDLE_RUN', () => {
  it('não é de academia nenhuma e está parado', () => {
    expect(IDLE_RUN).toEqual({ tenant: null, status: 'idle' });
  });

  it('é congelado', () => {
    expect(Object.isFrozen(IDLE_RUN)).toBe(true);
  });
});

describe('runStatusFor', () => {
  it('devolve o status quando a execução é da academia pedida', () => {
    for (const status of ['idle', 'running', 'done', 'error']) {
      expect(runStatusFor({ tenant: 'academia-a', status }, 'academia-a')).toBe(status);
    }
  });

  it('status de outra academia conta como parado', () => {
    expect(runStatusFor({ tenant: 'academia-a', status: 'done' }, 'academia-b')).toBe('idle');
    expect(runStatusFor({ tenant: 'academia-a', status: 'error' }, 'academia-b')).toBe('idle');
    expect(runStatusFor({ tenant: 'academia-a', status: 'running' }, 'academia-b')).toBe('idle');
  });

  it('sem academia (null, undefined, vazio) é sempre parado', () => {
    const run = { tenant: 'academia-a', status: 'done' };
    expect(runStatusFor(run, null)).toBe('idle');
    expect(runStatusFor(run, undefined)).toBe('idle');
    expect(runStatusFor(run, '')).toBe('idle');
  });

  it('execução sem academia não casa com sessão sem academia', () => {
    expect(runStatusFor({ tenant: null, status: 'done' }, null)).toBe('idle');
    expect(runStatusFor({ tenant: undefined, status: 'done' }, undefined)).toBe('idle');
  });

  it('IDLE_RUN dá parado para qualquer academia', () => {
    expect(runStatusFor(IDLE_RUN, 'academia-a')).toBe('idle');
    expect(runStatusFor(IDLE_RUN, null)).toBe('idle');
  });

  it('run ausente não quebra', () => {
    expect(runStatusFor(null, 'academia-a')).toBe('idle');
    expect(runStatusFor(undefined, 'academia-a')).toBe('idle');
  });
});

describe('settleRun', () => {
  it('execução atrasada de outra academia não mexe na vaga', () => {
    const prev = { tenant: 'b', status: 'running' };
    expect(settleRun(prev, 'a', 'error')).toBe(prev);
  });

  it('grava o fim quando a vaga ainda é da academia da execução', () => {
    expect(settleRun({ tenant: 'a', status: 'running' }, 'a', 'done')).toEqual({ tenant: 'a', status: 'done' });
  });

  it('vaga que nunca rodou fica como está', () => {
    expect(settleRun(IDLE_RUN, 'a', 'done')).toBe(IDLE_RUN);
  });
});

describe('EMPTY_SETUP_FLAGS', () => {
  it('não é de academia nenhuma e não sabe nada das cinco configurações', () => {
    expect(EMPTY_SETUP_FLAGS).toEqual({
      tenant: null, funnels: null, referral: null, expired: null, renewal: null, upgrade: null,
    });
  });

  it('é congelado', () => {
    expect(Object.isFrozen(EMPTY_SETUP_FLAGS)).toBe(true);
  });
});

describe('setupFlagsFromConfig', () => {
  it('doc inexistente (data null) conta como não configurado em tudo', () => {
    expect(setupFlagsFromConfig('academia-a', null)).toEqual({
      tenant: 'academia-a', funnels: false, referral: false, expired: false, renewal: false, upgrade: false,
    });
    expect(setupFlagsFromConfig('academia-a', undefined)).toEqual({
      tenant: 'academia-a', funnels: false, referral: false, expired: false, renewal: false, upgrade: false,
    });
  });

  it('doc sem nenhuma marca conta como não configurado em tudo', () => {
    expect(setupFlagsFromConfig('academia-a', { metaWeekdays: [1, 2, 3] })).toEqual({
      tenant: 'academia-a', funnels: false, referral: false, expired: false, renewal: false, upgrade: false,
    });
  });

  it('lê cada marca pela chave exata do config', () => {
    const cases = [
      ['funnelsSetupDoneAt', 'funnels'],
      ['referralSetupDoneAt', 'referral'],
      ['expiredFunnelSetupV2DoneAt', 'expired'],
      ['renewalFunnelSetupDoneAt', 'renewal'],
      ['upgradeFunnelSetupDoneAt', 'upgrade'],
    ];
    for (const [configKey, flagKey] of cases) {
      const flags = setupFlagsFromConfig('academia-a', { [configKey]: { seconds: 1 } });
      expect(flags.tenant).toBe('academia-a');
      for (const key of SETUP_KEYS) {
        expect(flags[key]).toBe(key === flagKey);
      }
    }
  });

  it('a marca antiga do Vencidos (sem V2) não conta', () => {
    const flags = setupFlagsFromConfig('academia-a', { expiredFunnelSetupDoneAt: { seconds: 1 } });
    expect(flags.expired).toBe(false);
  });

  it('todas as marcas presentes dão tudo configurado', () => {
    const flags = setupFlagsFromConfig('academia-a', {
      funnelsSetupDoneAt: 1,
      referralSetupDoneAt: 1,
      expiredFunnelSetupV2DoneAt: 1,
      renewalFunnelSetupDoneAt: 1,
      upgradeFunnelSetupDoneAt: 1,
    });
    expect(flags).toEqual({
      tenant: 'academia-a', funnels: true, referral: true, expired: true, renewal: true, upgrade: true,
    });
  });

  it('devolve sempre booleano, nunca o carimbo', () => {
    const stamp = { seconds: 123, nanoseconds: 0 };
    const flags = setupFlagsFromConfig('academia-a', { funnelsSetupDoneAt: stamp });
    expect(flags.funnels).toBe(true);
  });
});

describe('setupFlagFor', () => {
  const flagsA = setupFlagsFromConfig('academia-a', {
    funnelsSetupDoneAt: 1, referralSetupDoneAt: 1,
  });

  it('devolve a marca quando as marcas são da academia pedida', () => {
    expect(setupFlagFor(flagsA, 'funnels', 'academia-a')).toBe(true);
    expect(setupFlagFor(flagsA, 'referral', 'academia-a')).toBe(true);
    expect(setupFlagFor(flagsA, 'expired', 'academia-a')).toBe(false);
    expect(setupFlagFor(flagsA, 'renewal', 'academia-a')).toBe(false);
    expect(setupFlagFor(flagsA, 'upgrade', 'academia-a')).toBe(false);
  });

  it('marcas de outra academia dão null, mesmo com a marca ligada', () => {
    for (const key of SETUP_KEYS) {
      expect(setupFlagFor(flagsA, key, 'academia-b')).toBe(null);
    }
  });

  it('sem academia (null, undefined, vazio) dá null', () => {
    expect(setupFlagFor(flagsA, 'funnels', null)).toBe(null);
    expect(setupFlagFor(flagsA, 'funnels', undefined)).toBe(null);
    expect(setupFlagFor(flagsA, 'funnels', '')).toBe(null);
  });

  it('marcas sem academia não casam com sessão sem academia', () => {
    expect(setupFlagFor(setupFlagsFromConfig(null, { funnelsSetupDoneAt: 1 }), 'funnels', null)).toBe(null);
    expect(setupFlagFor(setupFlagsFromConfig(undefined, { funnelsSetupDoneAt: 1 }), 'funnels', undefined)).toBe(null);
    expect(setupFlagFor(setupFlagsFromConfig('', { funnelsSetupDoneAt: 1 }), 'funnels', '')).toBe(null);
  });

  it('EMPTY_SETUP_FLAGS dá null para tudo', () => {
    for (const key of SETUP_KEYS) {
      expect(setupFlagFor(EMPTY_SETUP_FLAGS, key, 'academia-a')).toBe(null);
      expect(setupFlagFor(EMPTY_SETUP_FLAGS, key, null)).toBe(null);
    }
  });

  it('chave desconhecida dá null, não undefined', () => {
    expect(setupFlagFor(flagsA, 'naoExiste', 'academia-a')).toBe(null);
  });

  it('flags ausentes não quebram', () => {
    expect(setupFlagFor(null, 'funnels', 'academia-a')).toBe(null);
    expect(setupFlagFor(undefined, 'funnels', 'academia-a')).toBe(null);
  });
});

describe('troca de academia pelo "Acessar como", sem recarregar', () => {
  // Espelha o que App.jsx deriva no render a cada troca de conta.
  const view = (run, flags, tenantId) => ({
    status: runStatusFor(run, tenantId),
    funnelsSetupDone: setupFlagFor(flags, 'funnels', tenantId),
  });
  // A máquina de funis roda quando está parada e a marca da academia chegou falsa.
  const canRun = ({ status, funnelsSetupDone }) => status === 'idle' && funnelsSetupDone === false;

  it('a academia assumida roda a configuração pendente e a anterior continua pronta', () => {
    // Academia A já configurada, máquina terminou.
    const runA = { tenant: 'academia-a', status: 'done' };
    const flagsA = setupFlagsFromConfig('academia-a', {
      funnelsSetupDoneAt: 1, referralSetupDoneAt: 1, expiredFunnelSetupV2DoneAt: 1,
      renewalFunnelSetupDoneAt: 1, upgradeFunnelSetupDoneAt: 1,
    });
    expect(view(runA, flagsA, 'academia-a')).toEqual({ status: 'done', funnelsSetupDone: true });

    // Troca para B: o estado guardado ainda é o de A, mas nada dele vale para B.
    const beforeConfig = view(runA, flagsA, 'academia-b');
    expect(beforeConfig).toEqual({ status: 'idle', funnelsSetupDone: null });
    // Sem a config de B ainda, a máquina espera em vez de se marcar pronta.
    expect(canRun(beforeConfig)).toBe(false);
    for (const key of SETUP_KEYS) {
      expect(setupFlagFor(flagsA, key, 'academia-b')).toBe(null);
    }

    // Chega a config de B, ainda sem configurar: a máquina de B pode rodar.
    const flagsB = setupFlagsFromConfig('academia-b', { funnelsSetupDoneAt: null });
    expect(flagsB.funnels).toBe(false);
    const afterConfig = view(runA, flagsB, 'academia-b');
    expect(afterConfig).toEqual({ status: 'idle', funnelsSetupDone: false });
    expect(canRun(afterConfig)).toBe(true);

    // Volta para A antes de B rodar: a vaga ainda guarda a execução de A, então
    // A aparece pronta e não roda de novo, mesmo com as marcas de B na mão.
    const backToABeforeB = view(runA, flagsB, 'academia-a');
    expect(backToABeforeB).toEqual({ status: 'done', funnelsSetupDone: null });
    expect(canRun(backToABeforeB)).toBe(false);

    // B roda e termina.
    const runB = { tenant: 'academia-b', status: 'done' };
    expect(view(runB, flagsB, 'academia-b').status).toBe('done');

    // Volta para A: o estado guardado agora é o de B. Até a config de A chegar,
    // a máquina espera; quando chega com a marca ligada, A se encerra pronta
    // sem rodar de novo, como no primeiro acesso.
    expect(view(runB, flagsB, 'academia-a')).toEqual({ status: 'idle', funnelsSetupDone: null });
    const backToA = view(runB, flagsA, 'academia-a');
    expect(backToA).toEqual({ status: 'idle', funnelsSetupDone: true });
    expect(canRun(backToA)).toBe(false);
  });

  it('a execução atrasada de A termina depois da troca e não apaga a de B', () => {
    // A começa a rodar e a conta troca para B no meio.
    const runA = { tenant: 'academia-a', status: 'running' };
    expect(runStatusFor(runA, 'academia-b')).toBe('idle');

    // B começa a rodar na mesma vaga.
    const runB = { tenant: 'academia-b', status: 'running' };

    // A execução de A falha por causa da troca (a regra nega a academia antiga)
    // e só então chega ao fim. A vaga é de B e fica como está.
    expect(settleRun(runB, 'academia-a', 'idle')).toBe(runB);
    expect(settleRun(runB, 'academia-a', 'done')).toBe(runB);
    expect(runStatusFor(settleRun(runB, 'academia-a', 'idle'), 'academia-b')).toBe('running');

    // B termina normalmente.
    expect(runStatusFor(settleRun(runB, 'academia-b', 'done'), 'academia-b')).toBe('done');
  });

  it('A falha pela troca antes de B começar e roda de novo quando for assumida outra vez', () => {
    const runA = { tenant: 'academia-a', status: 'running' };
    // A vaga ainda é de A: a falha pela troca devolve A a 'idle', não a 'error'.
    const settled = settleRun(runA, 'academia-a', 'idle');
    expect(settled).toEqual({ tenant: 'academia-a', status: 'idle' });
    expect(runStatusFor(settled, 'academia-a')).toBe('idle');
  });

  it('um erro em A não trava a máquina de B', () => {
    const runA = { tenant: 'academia-a', status: 'error' };
    expect(runStatusFor(runA, 'academia-a')).toBe('error');
    expect(runStatusFor(runA, 'academia-b')).toBe('idle');
  });
});
