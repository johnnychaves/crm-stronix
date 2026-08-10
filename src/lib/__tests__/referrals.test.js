// Testes das regras puras do sistema de INDICAÇÕES: identificação do funil de
// sistema, etapa de entrada com self-heal, plano idempotente da migração,
// resumo da aba Indicações e textos dos eventos de timeline.

import { describe, it, expect } from 'vitest';
import {
  isReferralFunnel,
  getReferralFunnel,
  getReferralEntryStage,
  pinEntryFirst,
  planReferralSetupOps,
  summarizeReferrals,
  sortReferrals,
  referralIndicadoText,
  referralIndicouText,
  referralConvertedText,
  buildReferralShareLink,
  buildReferralWhatsAppText,
  pendingReferralOwners
} from '../referrals.js';

describe('isReferralFunnel', () => {
  it('true só com systemKind referral — nome NÃO basta', () => {
    expect(isReferralFunnel({ systemKind: 'referral' })).toBe(true);
    expect(isReferralFunnel({ name: 'Indicações' })).toBe(false);
    expect(isReferralFunnel(null)).toBe(false);
  });
});

describe('getReferralFunnel', () => {
  it('null sem funil de sistema (mesmo com homônimo do usuário)', () => {
    expect(getReferralFunnel([])).toBe(null);
    expect(getReferralFunnel([{ id: 'f1', name: 'Indicações' }])).toBe(null);
    expect(getReferralFunnel(null)).toBe(null);
  });

  it('acha pelo systemKind mesmo que o doc tenha outro nome', () => {
    const f = { id: 'f2', name: 'Qualquer', systemKind: 'referral' };
    expect(getReferralFunnel([{ id: 'f1', name: 'Comercial' }, f])).toBe(f);
  });

  it('duplicata (corrida de migração): vence o createdAt mais antigo, em qualquer formato', () => {
    const a = { id: 'a', systemKind: 'referral', createdAt: { seconds: 200 } };
    const b = { id: 'b', systemKind: 'referral', createdAt: { toMillis: () => 100_000 } };
    const c = { id: 'c', systemKind: 'referral' }; // sem createdAt perde de quem tem
    expect(getReferralFunnel([c, a, b]).id).toBe('b');
  });
});

describe('getReferralEntryStage', () => {
  const FID = 'fref';

  it('acha pela flag isEntry, só dentro do funil', () => {
    const entry = { id: 's1', funnelId: FID, name: 'Aguardando ação', isEntry: true, order: 3 };
    const outro = { id: 's9', funnelId: 'outro', isEntry: true, order: 0 };
    expect(getReferralEntryStage([outro, entry], FID)).toBe(entry);
  });

  it('self-heal 1: sem isEntry, cai na etapa de sistema com o nome padrão (case/acentos livres)', () => {
    const neg = { id: 's0', funnelId: FID, name: 'Negociação', isSystem: true, order: 0 };
    const s = { id: 's1', funnelId: FID, name: '  AGUARDANDO AÇÃO ', isSystem: true, order: 2 };
    expect(getReferralEntryStage([neg, s], FID)).toBe(s);
  });

  it('self-heal 2: sem flag nem nome, cai na menor order', () => {
    const first = { id: 's1', funnelId: FID, name: 'Boas-vindas', order: 1 };
    const other = { id: 's2', funnelId: FID, name: 'Meio', order: 5 };
    expect(getReferralEntryStage([other, first], FID)).toBe(first);
  });

  it('null sem etapas do funil', () => {
    expect(getReferralEntryStage([], FID)).toBe(null);
    expect(getReferralEntryStage(null, FID)).toBe(null);
  });
});

describe('pinEntryFirst', () => {
  it('etapa de entrada volta pro topo preservando a ordem relativa das demais', () => {
    const a = { id: 'a', name: 'Meio 1' };
    const e = { id: 'e', name: 'Aguardando ação', isEntry: true };
    const b = { id: 'b', name: 'Meio 2' };
    expect(pinEntryFirst([a, e, b]).map((s) => s.id)).toEqual(['e', 'a', 'b']);
  });

  it('sem entry, mantém a ordem dada', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    expect(pinEntryFirst([a, b]).map((s) => s.id)).toEqual(['a', 'b']);
    expect(pinEntryFirst([])).toEqual([]);
  });
});

describe('planReferralSetupOps — plano idempotente da migração', () => {
  it('tenant sem nada: cria funil + 2 etapas + origem', () => {
    const plan = planReferralSetupOps({
      funnels: [{ id: 'f1', name: 'Comercial', isDefault: true }],
      statuses: [],
      sources: [{ id: 'src1', name: 'Instagram' }]
    });
    expect(plan.createFunnel).toMatchObject({
      name: 'Indicações', systemKind: 'referral', isDefault: false, order: 1
    });
    expect(plan.createStages.map((s) => s.name)).toEqual(['Aguardando ação', 'Negociação']);
    expect(plan.createStages[0]).toMatchObject({ order: 0, isSystem: true, isEntry: true, color: 'teal' });
    expect(plan.createStages[1]).toMatchObject({ order: 1, isSystem: true });
    expect(plan.createSource).toMatchObject({ name: 'Indicação' });
  });

  it('tudo já existe: não cria nada', () => {
    const plan = planReferralSetupOps({
      funnels: [{ id: 'fr', systemKind: 'referral', name: 'Indicações' }],
      statuses: [
        { id: 's1', funnelId: 'fr', name: 'Aguardando ação', isEntry: true, isSystem: true, order: 0 },
        { id: 's2', funnelId: 'fr', name: 'Negociação', isSystem: true, order: 1 }
      ],
      sources: [{ id: 'src1', name: 'INDICAÇÃO de aluno' }]
    });
    expect(plan.createFunnel).toBe(null);
    expect(plan.createStages).toEqual([]);
    expect(plan.createSource).toBe(null);
  });

  it('funil existe sem a etapa de entrada: repõe só ela, com funnelId e order 0', () => {
    const plan = planReferralSetupOps({
      funnels: [{ id: 'fr', systemKind: 'referral' }],
      statuses: [{ id: 's2', funnelId: 'fr', name: 'Negociação', isSystem: true, order: 0 }],
      sources: [{ name: 'Indicação' }]
    });
    expect(plan.createFunnel).toBe(null);
    expect(plan.createStages).toEqual([
      expect.objectContaining({ name: 'Aguardando ação', funnelId: 'fr', order: 0, isEntry: true })
    ]);
  });

  it('funil existe sem Negociação: repõe só ela no fim', () => {
    const plan = planReferralSetupOps({
      funnels: [{ id: 'fr', systemKind: 'referral' }],
      statuses: [{ id: 's1', funnelId: 'fr', name: 'Aguardando ação', isEntry: true, isSystem: true, order: 0 }],
      sources: [{ name: 'Indicação' }]
    });
    expect(plan.createStages).toEqual([
      expect.objectContaining({ name: 'Negociação', funnelId: 'fr', order: 1 })
    ]);
  });

  it('funil homônimo do usuário NÃO conta como o de sistema', () => {
    const plan = planReferralSetupOps({
      funnels: [{ id: 'f9', name: 'Indicações' }],
      statuses: [],
      sources: [{ name: 'Indicação' }]
    });
    expect(plan.createFunnel).toMatchObject({ systemKind: 'referral', order: 1 });
    expect(plan.createSource).toBe(null);
  });
});

describe('summarizeReferrals — resumo da aba Indicações', () => {
  it('conta alunos, em andamento e perdidos com a precedência do ciclo de vida', () => {
    const leads = [
      { id: 'a', lifecycleStage: 'cliente', status: 'Perda' }, // convertido que virou Perda: ALUNO
      { id: 'b', status: 'Venda', isConverted: true },
      { id: 'c', status: 'Aguardando ação' },
      { id: 'd', status: 'Perda' }
    ];
    expect(summarizeReferrals(leads)).toEqual({ total: 4, alunos: 2, andamento: 1, perdidos: 1 });
  });

  it('vazio/nulo', () => {
    expect(summarizeReferrals([])).toEqual({ total: 0, alunos: 0, andamento: 0, perdidos: 0 });
    expect(summarizeReferrals(null)).toEqual({ total: 0, alunos: 0, andamento: 0, perdidos: 0 });
  });
});

describe('sortReferrals', () => {
  it('mais recente primeiro por referredAt (Timestamp-like ou Date), caindo em createdAt', () => {
    const a = { id: 'a', referredAt: new Date(2026, 0, 10) };
    const b = { id: 'b', createdAt: new Date(2026, 0, 20) }; // sem referredAt: usa createdAt
    const c = { id: 'c', referredAt: { toDate: () => new Date(2026, 0, 15) } };
    expect(sortReferrals([a, b, c]).map((l) => l.id)).toEqual(['b', 'c', 'a']);
  });

  it('não muta o array de entrada', () => {
    const arr = [
      { id: 'a', referredAt: new Date(2026, 0, 1) },
      { id: 'b', referredAt: new Date(2026, 0, 2) }
    ];
    sortReferrals(arr);
    expect(arr.map((l) => l.id)).toEqual(['a', 'b']);
  });
});

describe('textos dos eventos de indicação', () => {
  it('vínculo nos dois lados e conversão no indicador', () => {
    expect(referralIndicadoText('Maria Silva')).toBe('🤝 Indicado por Maria Silva');
    expect(referralIndicouText('João Souza')).toBe('🤝 Indicou João Souza');
    expect(referralConvertedText('João Souza')).toBe('🎉 João Souza que você indicou fechou matrícula');
  });
});

describe('pendingReferralOwners — indicações sem dono (backfill)', () => {
  it('pega qualquer grafia de "indica", de todos os estados, e ignora quem já tem dono ou foi dispensado', () => {
    const leads = [
      { id: 'a', source: 'Indicação', createdAt: new Date(2026, 0, 3) },
      { id: 'b', source: 'INDICACAO de aluno', createdAt: new Date(2026, 0, 5), lifecycleBucket: 'cliente' },
      { id: 'c', source: 'Instagram', createdAt: new Date(2026, 0, 4) },
      { id: 'd', source: 'Indicação', referredById: 'x', createdAt: new Date(2026, 0, 9) },
      { id: 'e', source: 'Indicação', referrerUnknown: true, createdAt: new Date(2026, 0, 8) }
    ];
    expect(pendingReferralOwners(leads).map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('lista vazia ou nula', () => {
    expect(pendingReferralOwners([])).toEqual([]);
    expect(pendingReferralOwners(null)).toEqual([]);
  });
});

describe('link compartilhável (fase 2)', () => {
  it('monta a URL pública /i/{slug}?ref= com origin sem barra final e ref escapado', () => {
    expect(buildReferralShareLink('https://app.stronilead.com.br/', 'stronix', 'aB3/xY9'))
      .toBe('https://app.stronilead.com.br/i/stronix?ref=aB3%2FxY9');
    expect(buildReferralShareLink('http://localhost:5173', 'iron-fit', 'z9'))
      .toBe('http://localhost:5173/i/iron-fit?ref=z9');
  });

  it('mensagem de WhatsApp leva o primeiro nome e o link (sem nome, sauda genérico)', () => {
    const text = buildReferralWhatsAppText({ firstName: 'Maria', link: 'https://x/i/s?ref=1' });
    expect(text).toContain('Oi Maria!');
    expect(text).toContain('https://x/i/s?ref=1');
    expect(buildReferralWhatsAppText({ firstName: '', link: 'L' })).toContain('Oi!');
  });
});
