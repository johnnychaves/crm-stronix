// Peças divididas pelos submenus dos Relatórios de Leads: recorte da barra,
// leads novos, nomes, filtro da lista e planilha.
import { describe, it, expect } from 'vitest';
import {
  reportScope, newLeadsIn, namesOf, OTHERS_NAME, OTHERS_NOTE, cutCode, applyCut, cutLabelOf, contactCells, fmtDate,
  fmtScreenDate, compareTextOf, exportFileName, SITUACAO_LABEL,
} from '../relatorios/leads/base.js';
import { OTHERS_ID } from '../crm/scope.js';
import { regimeTexts } from '../crm/texts.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, USERS, FUNNELS, NOW } from './fixtures/crmCtx.js';

const SOURCES = [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação', channel: '' }];
const ctxOf = () => ({ ...makeCtx(), sources: SOURCES });
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);

describe('recorte da barra', () => {
  it('consultores, funil e origem juntos', () => {
    const lead = { id: 'x', consultantId: 'ana', funnelId: 'ven', source: 'Instagram ' };
    expect(reportScope({ users: USERS, funnels: FUNNELS }).inScope(lead)).toBe(true);
    expect(reportScope({ users: USERS, funnels: FUNNELS, origem: 'Instagram' }).inScope(lead)).toBe(true);
    expect(reportScope({ users: USERS, funnels: FUNNELS, origem: 'Indicação' }).inScope(lead)).toBe(false);
    expect(reportScope({ users: USERS, funnels: FUNNELS, userIds: ['diego'] }).inScope(lead)).toBe(false);
    expect(reportScope({ users: USERS, funnels: FUNNELS, funnelId: 'ind' }).inScope(lead)).toBe(false);
    // O funnelOk já leva a origem: o painel entrega ownerOk e funnelOk ao
    // pipelineNowOf, e os dois juntos precisam dar o mesmo que o inScope.
    const s = reportScope({ users: USERS, funnels: FUNNELS, origem: 'Indicação' });
    expect(s.ownerOk(lead)).toBe(true);
    expect(s.funnelOk(lead)).toBe(false);
    expect(s.inScope(lead)).toBe(false);
    // A origem vale sem os espaços das pontas.
    expect(reportScope({ users: USERS, funnels: FUNNELS, origem: ' Instagram ' }).inScope(lead)).toBe(true);
  });

  it('os leads novos da janela, na regra do painel: sem importado e sem funil de cliente', () => {
    const ids = newLeadsIn(ctxOf(), reportScope({ users: USERS, funnels: FUNNELS }), setembro).map((l) => l.id).sort();
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5']);
    const cruza = periodFromParams({ de: '2026-08-04', ate: '2026-09-03' }, NOW);
    expect(newLeadsIn(ctxOf(), reportScope({ users: USERS, funnels: FUNNELS }), cruza).map((l) => l.id).sort())
      .toEqual(['a2', 'a3', 'o1', 's1', 's2', 's3', 's5']);
  });
});

describe('nomes', () => {
  it('consultor da equipe, quem saiu vai para Outros, funil vazio cai no padrão, canal do catálogo', () => {
    const n = namesOf(ctxOf());
    expect(n.ownerKey({ consultantId: 'ana' })).toBe('ana');
    expect(n.ownerKey({ consultantId: 'ex' })).toBe(OTHERS_ID);
    expect(n.ownerName('diego')).toBe('Diego Santos');
    // Nos recortes, quem saiu e o lead sem dono se chamam Outros, como nos painéis, e a explicação vai à parte.
    expect(n.ownerName(OTHERS_ID)).toBe(OTHERS_NAME);
    expect([OTHERS_NAME, OTHERS_NOTE]).toEqual(['Outros', 'fora da equipe ou sem responsável']);
    expect(n.ownerNote(OTHERS_ID)).toBe(OTHERS_NOTE);
    expect(n.ownerNote('ana')).toBe('');
    expect(n.ownerLabel({ consultantId: 'ex', consultantName: 'Carla Antiga' })).toBe('Carla Antiga');
    expect(n.ownerLabel({ consultantId: 'ex' })).toBe('Fora da equipe');
    expect(n.ownerLabel({ consultantId: null })).toBe('Sem responsável');
    expect(n.funnelId({ funnelId: null })).toBe('ven');
    expect(n.funnelName('ind')).toBe('Indicações');
    expect(n.sourceName({ source: '  ' })).toBe('Sem origem');
    expect(n.channelOf('Instagram')).toBe('Pago');
    expect(n.channelOf('Indicação')).toBe('');
  });
});

describe('filtro da lista', () => {
  const rows = [{ id: 'a', cuts: ['origem:Instagram', 'consultor:ana'] }, { id: 'b', cuts: ['origem:Indicação'] }];

  it('vale só o recorte que existe no submenu', () => {
    const available = new Set(['origem:Instagram', 'origem:Indicação', 'consultor:ana']);
    expect(applyCut(rows, 'origem:Instagram', available)).toEqual({ cut: 'origem:Instagram', rows: [rows[0]] });
    expect(applyCut(rows, 'origem:Outdoor', available)).toEqual({ cut: null, rows });
    expect(applyCut(rows, null, available)).toEqual({ cut: null, rows });
    expect(cutCode('situacao', 'matricularam')).toBe('situacao:matricularam');
  });

  it('o texto do filtro diz o tipo, menos nos números', () => {
    const items = [{ key: 'origem:Instagram', name: 'Instagram' }, { key: 'situacao:vieram', name: 'Vieram' }, { key: 'faixa:ate-1h', name: 'Até 1 hora' }];
    expect(cutLabelOf('origem:Instagram', items)).toBe('Origem: Instagram');
    expect(cutLabelOf('situacao:vieram', items)).toBe('Vieram');
    expect(cutLabelOf('faixa:ate-1h', items)).toBe('Primeiro contato: Até 1 hora');
    expect(cutLabelOf('origem:Outdoor', items)).toBeNull();
  });
});

describe('planilha', () => {
  it('contato no molde de Todos os leads, com o responsável do menor e o CPF', () => {
    const adulto = { whatsapp: '(11) 99999-0000', cpf: '123.456.789-00' };
    expect(contactCells(adulto, NOW)).toEqual({ whatsapp: '(11) 99999-0000', responsavel: '', telefoneResponsavel: '', cpf: '123.456.789-00' });
    const menor = { whatsapp: '', isMinor: true, guardian: { name: 'Marta Lima', phone: '(11) 98888-7777', relationship: 'Mãe' } };
    expect(contactCells(menor, NOW)).toEqual({ whatsapp: '', responsavel: 'Marta Lima (mãe)', telefoneResponsavel: '(11) 98888-7777', cpf: '' });
  });

  it('data no formato do Brasil, e vazio sem data', () => {
    expect(fmtDate(new Date(2026, 8, 2, 10))).toBe('02/09/2026');
    expect(fmtDate(null)).toBe('');
  });

  it('data na tela: sem o ano quando é o de agora, e a planilha continua com o ano', () => {
    // Só a tela encurta: a coluna de data da lista cabe numa linha, e quem exporta recebe a data inteira.
    expect(fmtScreenDate(new Date(2026, 8, 2, 10), 2026)).toBe('02/09');
    expect(fmtScreenDate(new Date(2026, 0, 31, 23, 59), 2026)).toBe('31/01');
    expect(fmtScreenDate(new Date(2025, 11, 31, 10), 2026)).toBe('31/12/2025');
    expect(fmtScreenDate(new Date(2027, 0, 5, 10), 2026)).toBe('05/01/2027');
    expect(fmtScreenDate(null, 2026)).toBe('');
    expect(fmtScreenDate(new Date('x'), 2026)).toBe('');
    expect(fmtDate(new Date(2026, 8, 2, 10))).toBe('02/09/2026');
  });

  it('nome do arquivo com o submenu e as datas do período', () => {
    expect(exportFileName('entrada', setembro)).toBe('leads-entrada-2026-09-01-a-2026-09-14.csv');
    const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(exportFileName('conversao', agosto)).toBe('leads-conversao-2026-08-01-a-2026-08-31.csv');
  });

  it('situação de hoje em palavras', () => {
    expect(SITUACAO_LABEL).toEqual({ ativo: 'Em aberto', cliente: 'Cliente', perda: 'Perdido' });
  });
});

// O texto do comparado ao lado do número grande. Com o mês em andamento, o
// comparado é o mesmo começo do mês anterior, como o painel CRM diz ("Pró-rata:
// mesmos 14 primeiros dias de agosto"); nos outros períodos é o nome dele.
describe('texto do comparado', () => {
  const textoDe = (params, now = NOW) => {
    const period = periodFromParams(params, now);
    return compareTextOf(period, previousPeriod(period, now));
  };
  const setembroEm = (dia, hora = 12) => new Date(2026, 8, dia, hora, 0);

  it('o mês em andamento compara os mesmos primeiros dias do mês anterior', () => {
    // Dia 14 ao meio-dia: o painel diz "mesmos 14 primeiros dias" (os 13 dias e meio contam o de hoje).
    expect(textoDe({ monthKey: '2026-09' })).toBe('vs. os 14 primeiros dias de Agosto 2026');
    expect(textoDe({ monthKey: '2026-09' }, setembroEm(1))).toBe('vs. o primeiro dia de Agosto 2026');
    expect(textoDe({ monthKey: '2026-09' }, setembroEm(2, 0))).toBe('vs. os 2 primeiros dias de Agosto 2026');
    expect(textoDe({ monthKey: '2026-09' }, new Date(2026, 8, 30, 23, 59))).toBe('vs. os 30 primeiros dias de Agosto 2026');
    // O ano do comparado aparece, como no nome dele.
    expect(textoDe({ monthKey: '2026-01' }, new Date(2026, 0, 10, 9, 0))).toBe('vs. os 10 primeiros dias de Dezembro 2025');
  });

  it('usa os mesmos dias que o painel CRM diz na nota do comparativo', () => {
    for (const dia of [1, 2, 14, 30]) {
      const painel = regimeTexts({ running: true, compareOn: true, dayN: dia, shownName: 'setembro', cmpName: 'agosto' }).note;
      const texto = textoDe({ monthKey: '2026-09' }, setembroEm(dia));
      const dias = (t) => t.match(/(\d+) primeiros dias/)?.[1] ?? 'primeiro dia';
      expect([dia, dias(texto)], texto).toEqual([dia, dias(painel)]);
    }
  });

  it('quando os dias que já passaram são todos os do mês comparado, ele entra inteiro', () => {
    // Setembro tem 30 dias, e fevereiro de 2026 tem 28: "os 31 primeiros dias" não existe.
    expect(textoDe({ monthKey: '2026-10' }, new Date(2026, 9, 31, 12, 0))).toBe('vs. Setembro 2026');
    expect(textoDe({ monthKey: '2026-03' }, new Date(2026, 2, 30, 12, 0))).toBe('vs. Fevereiro 2026');
    expect(textoDe({ monthKey: '2026-03' }, new Date(2026, 2, 28, 12, 0))).toBe('vs. Fevereiro 2026');
    expect(textoDe({ monthKey: '2026-03' }, new Date(2026, 2, 27, 12, 0))).toBe('vs. os 27 primeiros dias de Fevereiro 2026');
  });

  it('o mês fechado, o atalho e o intervalo mantêm o nome do comparado', () => {
    expect(textoDe({ monthKey: '2026-08' })).toBe('vs. Julho 2026');
    expect(textoDe({ de: '2026-09-08', ate: '2026-09-13' })).toBe('vs. 2 a 7 set');
    for (const params of [{ periodo: 'hoje' }, { periodo: 'ontem' }, { periodo: 'semana' }, { periodo: 'semana-passada' }]) {
      const period = periodFromParams(params, NOW);
      const cmp = previousPeriod(period, NOW);
      expect(compareTextOf(period, cmp), JSON.stringify(params)).toBe(`vs. ${cmp.label}`);
    }
    // Também no começo do mês, com o período em andamento: o dia 3 de setembro é menor que os 7 dias da semana
    // e que os 4 do intervalo, e o texto continua sendo o nome do comparado, e não "os 3 primeiros dias".
    const dia3 = setembroEm(3);
    for (const params of [{ periodo: 'semana' }, { periodo: 'hoje' }, { de: '2026-08-31', ate: '2026-09-03' }]) {
      const period = periodFromParams(params, dia3);
      expect(period.running, JSON.stringify(params)).toBe(true);
      const cmp = previousPeriod(period, dia3);
      expect(compareTextOf(period, cmp), JSON.stringify(params)).toBe(`vs. ${cmp.label}`);
    }
  });

  it('sem comparado não há texto', () => {
    expect(compareTextOf(periodFromParams({ monthKey: '2026-09' }, NOW), null)).toBeNull();
  });
});
