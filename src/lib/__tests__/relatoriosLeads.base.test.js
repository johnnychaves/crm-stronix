// Peças divididas pelos submenus dos Relatórios de Leads: recorte da barra,
// leads novos, nomes, filtro da lista e planilha.
import { describe, it, expect } from 'vitest';
import {
  reportScope, newLeadsIn, namesOf, OTHERS_LABEL, cutCode, applyCut, cutLabelOf, contactCells, fmtDate,
  exportFileName, SITUACAO_LABEL,
} from '../relatorios/leads/base.js';
import { OTHERS_ID } from '../crm/scope.js';
import { periodFromParams } from '../period.js';
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
  });

  it('os leads novos da janela, na regra do painel: sem importado e sem funil de cliente', () => {
    const ids = newLeadsIn(ctxOf(), reportScope({ users: USERS, funnels: FUNNELS }), setembro).map((l) => l.id).sort();
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });
});

describe('nomes', () => {
  it('consultor da equipe, quem saiu vai para Outros, funil vazio cai no padrão, canal do catálogo', () => {
    const n = namesOf(ctxOf());
    expect(n.ownerKey({ consultantId: 'ana' })).toBe('ana');
    expect(n.ownerKey({ consultantId: 'ex' })).toBe(OTHERS_ID);
    expect(n.ownerName('diego')).toBe('Diego Santos');
    expect(n.ownerName(OTHERS_ID)).toBe(OTHERS_LABEL);
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

  it('nome do arquivo com o submenu e as datas do período', () => {
    expect(exportFileName('entrada', setembro)).toBe('leads-entrada-2026-09-01-a-2026-09-14.csv');
    const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(exportFileName('conversao', agosto)).toBe('leads-conversao-2026-08-01-a-2026-08-31.csv');
  });

  it('situação de hoje em palavras', () => {
    expect(SITUACAO_LABEL).toEqual({ ativo: 'Em aberto', cliente: 'Cliente', perda: 'Perdido' });
  });
});
