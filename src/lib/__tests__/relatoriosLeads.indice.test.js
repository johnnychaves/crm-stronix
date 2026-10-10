// O índice da Conversão (interações por lead, registros e desfechos) depende só
// dos meses carregados. A tela refaz o relatório a cada clique num número, a
// cada virada de minuto e a cada período novo, e o índice não pode ser refeito
// por isso: só quando os meses são outro objeto (a useCrmSources entrega um
// objeto novo quando chega interação, lead ou registro).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ built: vi.fn() }));
// Só conta quantas vezes o índice foi montado: a conta é a de verdade.
vi.mock('../crm/contact.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    contactTimesByLead: (...args) => {
      h.built();
      return original.contactTimesByLead(...args);
    },
  };
});

const { conversaoReport } = await import('../relatorios/leads/conversao.js');
const { periodFromParams, previousPeriod } = await import('../period.js');
const { makeCtx, NOW, N, D } = await import('./fixtures/crmCtx.js');

const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const semana = periodFromParams({ periodo: 'semana' }, NOW);
const ctxOf = () => ({ ...makeCtx(), sources: [] });
const relatorio = (ctx, period, extra = {}) => conversaoReport(ctx, { period, cmp: previousPeriod(period, NOW), ...extra });
const primeiroContatoDe = (r, id) => r.rows.find((x) => x.id === id).firstContactMin;

beforeEach(() => h.built.mockClear());

describe('índice da Conversão', () => {
  it('um clique num número, a virada de minuto e o período novo não refazem o índice dos mesmos meses', () => {
    const ctx = ctxOf();
    relatorio(ctx, setembro);
    expect(h.built).toHaveBeenCalledTimes(1);
    // O clique num número só muda o recorte.
    relatorio(ctx, setembro, { recorte: 'situacao:matricularam' });
    relatorio(ctx, setembro, { recorte: 'origem:Instagram' });
    // A virada do minuto é outro ctx, com o mesmo objeto de meses.
    relatorio({ ...ctx, now: new Date(NOW.getTime() + 60_000) }, setembro);
    // E o período novo, dentro dos mesmos meses.
    relatorio(ctx, semana);
    expect(h.built).toHaveBeenCalledTimes(1);
  });

  it('meses que são outro objeto refazem o índice, e a interação nova entra na conta', () => {
    const ctx = ctxOf();
    expect(primeiroContatoDe(relatorio(ctx, setembro), 's4')).toBeNull();
    expect(h.built).toHaveBeenCalledTimes(1);
    // Chega ao vivo uma anotação do s4, vinte minutos depois do cadastro: a
    // useCrmSources entrega outro objeto de meses, com ela dentro.
    const setembroNovo = { ...ctx.months['2026-09'], interactions: [...ctx.months['2026-09'].interactions, N('i9', 's4', D(9, 13, 10, 20))] };
    const comAnotacao = { ...ctx, months: { ...ctx.months, '2026-09': setembroNovo } };
    expect(primeiroContatoDe(relatorio(comAnotacao, setembro), 's4')).toBe(20);
    expect(h.built).toHaveBeenCalledTimes(2);
    // Os meses de antes continuam com o índice deles, sem a anotação.
    expect(primeiroContatoDe(relatorio(ctx, setembro), 's4')).toBeNull();
    expect(h.built).toHaveBeenCalledTimes(2);
  });
});
