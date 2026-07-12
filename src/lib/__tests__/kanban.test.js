// Testes de CARACTERIZAÇÃO das funções puras do Kanban (kanban.js).
// Congelam o comportamento ATUAL: recorte do board (filterKanbanLeads),
// particionamento/ordenação por coluna (partitionLeadsByStatus) e utilities
// de apresentação. Datas construídas em horário LOCAL, como o app faz;
// `now` é injetado onde a função aceita, e fake timers onde ela lê o relógio.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  filterKanbanLeads,
  partitionLeadsByStatus,
  getKanbanInitials,
  fmtKanbanRelDate
} from '../kanban.js';

// 15 de julho de 2026, 10:00 local — "agora" de referência dos testes.
const NOW = new Date(2026, 6, 15, 10, 0, 0);

let seq = 0;
const lead = (over = {}) => ({
  id: over.id || `l${++seq}`,
  name: 'Lead Teste',
  status: 'Contato',
  consultantId: 'u1',
  createdAt: new Date(2026, 6, 10),
  nextFollowUp: null,
  ...over
});

describe('filterKanbanLeads (recorte do board)', () => {
  it('exclui clientes (lifecycleStage) e convertidos (Venda/isConverted/status legado)', () => {
    const ativo = lead({ status: 'Contato' });
    const cliente = lead({ lifecycleStage: 'cliente', status: 'Contato' });
    const venda = lead({ status: 'Venda' });
    const flagConvertido = lead({ status: 'Negociação', isConverted: true });
    const legadoMatriculado = lead({ status: 'Matriculado' });
    const legadoMatriculadoAno = lead({ status: 'Matriculado 2024' });

    const result = filterKanbanLeads(
      [ativo, cliente, venda, flagConvertido, legadoMatriculado, legadoMatriculadoAno],
      { now: NOW }
    );
    expect(result.map(l => l.id)).toEqual([ativo.id]);
  });

  it('respFilter filtra por consultantId; array vazio = todos', () => {
    const ana = lead({ consultantId: 'ana' });
    const bruno = lead({ consultantId: 'bruno' });
    const semConsultor = lead({ consultantId: undefined });

    const todos = filterKanbanLeads([ana, bruno, semConsultor], { respFilter: [], now: NOW });
    expect(todos.map(l => l.id)).toEqual([ana.id, bruno.id, semConsultor.id]);

    const soAna = filterKanbanLeads([ana, bruno, semConsultor], { respFilter: ['ana'], now: NOW });
    expect(soAna.map(l => l.id)).toEqual([ana.id]);

    // com filtro ativo, lead sem consultantId fica de fora
    const dupla = filterKanbanLeads([ana, bruno, semConsultor], { respFilter: ['ana', 'bruno'], now: NOW });
    expect(dupla.map(l => l.id)).toEqual([ana.id, bruno.id]);
  });

  it('onlyOverdue exige nextFollowUp Date válido estritamente < now', () => {
    const atrasado = lead({ nextFollowUp: new Date(2026, 6, 14, 9, 0) });
    const maisCedoHoje = lead({ nextFollowUp: new Date(2026, 6, 15, 8, 0) }); // hoje antes de now → atrasado
    const exatamenteAgora = lead({ nextFollowUp: new Date(2026, 6, 15, 10, 0) }); // === now → NÃO é atrasado (< estrito)
    const futuro = lead({ nextFollowUp: new Date(2026, 6, 16, 9, 0) });
    const semFollowUp = lead({ nextFollowUp: null });
    const dataInvalida = lead({ nextFollowUp: new Date(NaN) }); // Date com NaN não passa
    const stringData = lead({ nextFollowUp: '2026-07-01' }); // não é instanceof Date → não passa

    const result = filterKanbanLeads(
      [atrasado, maisCedoHoje, exatamenteAgora, futuro, semFollowUp, dataInvalida, stringData],
      { onlyOverdue: true, now: NOW }
    );
    expect(result.map(l => l.id)).toEqual([atrasado.id, maisCedoHoje.id]);
  });

  it('onlyOverdue exclui Perda mesmo com follow-up vencido (Venda já sai no recorte de cliente)', () => {
    const perda = lead({ status: 'Perda', nextFollowUp: new Date(2026, 6, 1, 9, 0) });
    const ativo = lead({ status: 'Contato', nextFollowUp: new Date(2026, 6, 1, 9, 0) });
    const venda = lead({ status: 'Venda', nextFollowUp: new Date(2026, 6, 1, 9, 0) });

    const result = filterKanbanLeads([perda, ativo, venda], { onlyOverdue: true, now: NOW });
    expect(result.map(l => l.id)).toEqual([ativo.id]);
  });

  it('defaults: sem opts não filtra por responsável nem por atraso; lista null vira []', () => {
    const ativo = lead({ consultantId: 'qualquer', nextFollowUp: null });
    const cliente = lead({ lifecycleStage: 'cliente' });
    // sem segundo argumento: só o recorte de cliente/convertido se aplica
    expect(filterKanbanLeads([ativo, cliente]).map(l => l.id)).toEqual([ativo.id]);
    expect(filterKanbanLeads(null)).toEqual([]);
    expect(filterKanbanLeads(undefined)).toEqual([]);
  });
});

describe('partitionLeadsByStatus (colunas + ordenação por prioridade de follow-up)', () => {
  it('Map contém TODAS as statusNames, mesmo colunas vazias, na ordem dada', () => {
    const map = partitionLeadsByStatus([], ['Novo', 'Contato', 'Venda'], NOW);
    expect([...map.keys()]).toEqual(['Novo', 'Contato', 'Venda']);
    expect(map.get('Novo')).toEqual([]);
    expect(map.get('Contato')).toEqual([]);
    expect(map.get('Venda')).toEqual([]);
  });

  it('status fora da lista ganha entrada própria no Map (depois das colunas conhecidas)', () => {
    const orfao = lead({ status: 'Etapa Antiga' });
    const map = partitionLeadsByStatus([orfao], ['Novo'], NOW);
    expect([...map.keys()]).toEqual(['Novo', 'Etapa Antiga']);
    expect(map.get('Etapa Antiga').map(l => l.id)).toEqual([orfao.id]);
  });

  it('ordena: 1 atrasado · 2 hoje · 3 futuro · 4 sem follow-up (now injetado)', () => {
    // "hoje mais cedo que now" conta como ATRASADO (prioridade 1), não como "hoje";
    // "hoje" (prioridade 2) é só o resto do dia a partir de now.
    const semFU = lead({ nextFollowUp: null, createdAt: new Date(2026, 6, 1) });
    const futuro = lead({ nextFollowUp: new Date(2026, 6, 16, 9, 0) });
    const hoje = lead({ nextFollowUp: new Date(2026, 6, 15, 18, 0) });
    const hojeCedo = lead({ nextFollowUp: new Date(2026, 6, 15, 8, 0) }); // antes de now → atrasado
    const atrasado = lead({ nextFollowUp: new Date(2026, 6, 14, 9, 0) });

    const map = partitionLeadsByStatus([semFU, futuro, hoje, hojeCedo, atrasado], ['Contato'], NOW);
    expect(map.get('Contato').map(l => l.id)).toEqual([
      atrasado.id, hojeCedo.id, // prioridade 1, empate por nextFollowUp asc
      hoje.id,                  // prioridade 2
      futuro.id,                // prioridade 3
      semFU.id                  // prioridade 4
    ]);
  });

  it('empate intra-prioridade usa nextFollowUp asc; prioridade 4 usa createdAt DESC', () => {
    const futuroTarde = lead({ nextFollowUp: new Date(2026, 6, 20, 9, 0) });
    const futuroCedo = lead({ nextFollowUp: new Date(2026, 6, 17, 9, 0) });
    const semFUVelho = lead({ nextFollowUp: null, createdAt: new Date(2026, 6, 1) });
    const semFUNovo = lead({ nextFollowUp: null, createdAt: new Date(2026, 6, 12) });
    const semFUSemCreatedAt = lead({ nextFollowUp: null, createdAt: undefined }); // createdAt ausente vale 0 → vai pro fim

    const map = partitionLeadsByStatus(
      [semFUVelho, futuroTarde, semFUSemCreatedAt, semFUNovo, futuroCedo],
      ['Contato'],
      NOW
    );
    expect(map.get('Contato').map(l => l.id)).toEqual([
      futuroCedo.id, futuroTarde.id,           // prioridade 3, nextFollowUp asc
      semFUNovo.id, semFUVelho.id,             // prioridade 4, createdAt desc
      semFUSemCreatedAt.id                     // sem createdAt (0) fica por último
    ]);
  });

  it('nextFollowUp inválido (Date NaN ou string) cai na prioridade 4', () => {
    const dataNaN = lead({ nextFollowUp: new Date(NaN), createdAt: new Date(2026, 6, 5) });
    const stringData = lead({ nextFollowUp: '2026-07-14', createdAt: new Date(2026, 6, 8) });
    const atrasado = lead({ nextFollowUp: new Date(2026, 6, 14, 9, 0) });

    const map = partitionLeadsByStatus([dataNaN, stringData, atrasado], ['Contato'], NOW);
    expect(map.get('Contato').map(l => l.id)).toEqual([
      atrasado.id,
      stringData.id, // prioridade 4: createdAt 8/jul > 5/jul (desc)
      dataNaN.id
    ]);
  });

  it('é null-safe: lista null retorna só as colunas vazias; sem statusNames usa []', () => {
    const map = partitionLeadsByStatus(null, ['Novo'], NOW);
    expect([...map.keys()]).toEqual(['Novo']);
    expect(map.get('Novo')).toEqual([]);

    const orfao = lead({ status: 'Contato' });
    const semColunas = partitionLeadsByStatus([orfao], undefined, NOW);
    expect([...semColunas.keys()]).toEqual(['Contato']);
  });
});

describe('getKanbanInitials', () => {
  it('pega a inicial das duas primeiras palavras, em maiúsculas', () => {
    expect(getKanbanInitials('João Silva')).toBe('JS');
    expect(getKanbanInitials('ana maria souza')).toBe('AM'); // só as 2 primeiras
    expect(getKanbanInitials('Ana')).toBe('A');
    expect(getKanbanInitials('  João   Silva  ')).toBe('JS'); // espaços extras não atrapalham
  });

  it('vazio/ausente vira "?"', () => {
    expect(getKanbanInitials('')).toBe('?');
    expect(getKanbanInitials('   ')).toBe('?');
    expect(getKanbanInitials()).toBe('?');
  });
});

describe('fmtKanbanRelDate (lê o relógio → fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW); // 15/jul/2026 10:00 local
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Hoje / Amanhã / Ontem por dia de calendário, ignorando a hora', () => {
    expect(fmtKanbanRelDate(new Date(2026, 6, 15, 23, 59))).toBe('Hoje');
    expect(fmtKanbanRelDate(new Date(2026, 6, 15, 0, 0))).toBe('Hoje'); // antes de "agora" mas mesmo dia
    expect(fmtKanbanRelDate(new Date(2026, 6, 16, 8, 0))).toBe('Amanhã');
    expect(fmtKanbanRelDate(new Date(2026, 6, 14, 20, 0))).toBe('Ontem');
  });

  it('janela de 7 dias vira "Em Nd"/"Nd atrás"; fora dela, data pt-BR; inválida vira ""', () => {
    expect(fmtKanbanRelDate(new Date(2026, 6, 18))).toBe('Em 3d');
    expect(fmtKanbanRelDate(new Date(2026, 6, 21))).toBe('Em 6d');
    expect(fmtKanbanRelDate(new Date(2026, 6, 12))).toBe('3d atrás');
    // 7 dias exatos já cai no formato absoluto
    expect(fmtKanbanRelDate(new Date(2026, 6, 22))).toBe(new Date(2026, 6, 22).toLocaleDateString('pt-BR'));
    expect(fmtKanbanRelDate(new Date(2026, 6, 8))).toBe(new Date(2026, 6, 8).toLocaleDateString('pt-BR'));
    expect(fmtKanbanRelDate(new Date(NaN))).toBe('');
    expect(fmtKanbanRelDate('2026-07-15')).toBe('');
    expect(fmtKanbanRelDate(null)).toBe('');
  });
});
