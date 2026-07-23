import { describe, it, expect } from 'vitest';
import { SOLO_TRAINING } from '../professores.js';
import {
  REPORT_OUTCOME_OPTIONS,
  getReportColumns,
  buildReportRows,
  rowsToCsv,
  buildReportHtml,
} from '../appointmentReport.js';

const NOW = new Date(2026, 6, 15, 9, 0, 0);

function aula(overrides = {}) {
  return {
    id: 'l1',
    name: 'Ana Souza',
    dor: 'Emagrecimento',
    appointmentType: 'aula_experimental',
    appointmentScheduledFor: new Date(2026, 6, 10, 18, 0),
    appointmentModality: 'Musculação',
    appointmentProfessorId: 'p1',
    appointmentProfessorName: 'João',
    appointmentSoloTraining: false,
    appointmentOutcome: null,
    trialClassesPlanned: 7,
    consultantId: 'c1',
    consultantName: 'Bruna Consultora',
    ...overrides,
  };
}

function visita(overrides = {}) {
  return {
    id: 'v1',
    name: 'Carlos Lima',
    dor: 'Condicionamento',
    appointmentType: 'visita',
    appointmentScheduledFor: new Date(2026, 6, 10, 10, 0),
    appointmentOutcome: 'attended',
    consultantId: 'c2',
    consultantName: 'Bruna Consultora',
    ...overrides,
  };
}

describe('getReportColumns', () => {
  it('Aulas: inclui Professor, Modalidade e Passe', () => {
    const cols = getReportColumns(true).map((c) => c.key);
    expect(cols).toEqual(['nome', 'telefone', 'objetivo', 'dataMarcada', 'professor', 'modalidade', 'passe', 'desfecho', 'responsavel']);
  });

  it('Visitas: sem Professor/Modalidade/Passe', () => {
    const cols = getReportColumns(false).map((c) => c.key);
    expect(cols).toEqual(['nome', 'telefone', 'objetivo', 'dataMarcada', 'desfecho', 'responsavel']);
  });
});

describe('buildReportRows', () => {
  it('sem filtros: devolve todos os leads com data marcada, ordenados por data', () => {
    const later = aula({ id: 'l2', name: 'Zeca', appointmentScheduledFor: new Date(2026, 6, 20) });
    const earlier = aula({ id: 'l1', name: 'Ana', appointmentScheduledFor: new Date(2026, 6, 5) });
    const rows = buildReportRows([later, earlier], { isAula: true, now: NOW });
    expect(rows.map((r) => r.nome)).toEqual(['Ana', 'Zeca']);
  });

  it('ignora leads sem data marcada', () => {
    const noDate = aula({ appointmentScheduledFor: null });
    const rows = buildReportRows([noDate], { isAula: true, now: NOW });
    expect(rows).toEqual([]);
  });

  it('filtra por período (início e fim inclusivos)', () => {
    const inRange = aula({ id: 'a', appointmentScheduledFor: new Date(2026, 6, 10) });
    const beforeRange = aula({ id: 'b', appointmentScheduledFor: new Date(2026, 6, 1) });
    const afterRange = aula({ id: 'c', appointmentScheduledFor: new Date(2026, 6, 20) });
    const onEndDay = aula({ id: 'd', appointmentScheduledFor: new Date(2026, 6, 12, 23, 59) });
    const rows = buildReportRows([inRange, beforeRange, afterRange, onEndDay], {
      isAula: true,
      now: NOW,
      filters: { start: new Date(2026, 6, 5), end: new Date(2026, 6, 12) },
    });
    expect(rows.map((r) => r.nome).sort()).toEqual(['Ana Souza', 'Ana Souza'].sort());
    expect(rows).toHaveLength(2);
  });

  it('filtra por responsável (respIds) — vazio = todos', () => {
    const c1 = aula({ id: 'a', consultantId: 'c1' });
    const c2 = aula({ id: 'b', consultantId: 'c2' });
    expect(buildReportRows([c1, c2], { isAula: true, now: NOW })).toHaveLength(2);
    const filtered = buildReportRows([c1, c2], { isAula: true, now: NOW, filters: { respIds: ['c1'] } });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].responsavel).toBe('Bruna Consultora');
  });

  it('filtra por professor, incluindo o sentinela SOLO_TRAINING', () => {
    const withProf = aula({ id: 'a', appointmentProfessorId: 'p1', appointmentSoloTraining: false });
    const solo = aula({ id: 'b', appointmentProfessorId: null, appointmentSoloTraining: true, appointmentProfessorName: null });
    const otherProf = aula({ id: 'c', appointmentProfessorId: 'p2', appointmentSoloTraining: false });

    const byProf = buildReportRows([withProf, solo, otherProf], { isAula: true, now: NOW, filters: { profIds: ['p1'] } });
    expect(byProf).toHaveLength(1);
    expect(byProf[0].professor).toBe('João');

    const bySolo = buildReportRows([withProf, solo, otherProf], { isAula: true, now: NOW, filters: { profIds: [SOLO_TRAINING] } });
    expect(bySolo).toHaveLength(1);
    expect(bySolo[0].professor).toBe('Treina sozinho');
  });

  it('filtro de professor é ignorado em Visitas (isAula false)', () => {
    const v = visita();
    const rows = buildReportRows([v], { isAula: false, now: NOW, filters: { profIds: ['nunca-existe'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0].professor).toBeUndefined();
  });

  it('filtra por modalidade (só Aulas)', () => {
    const musc = aula({ id: 'a', appointmentModality: 'Musculação' });
    const funcional = aula({ id: 'b', appointmentModality: 'Funcional' });
    const rows = buildReportRows([musc, funcional], { isAula: true, now: NOW, filters: { modalities: ['Funcional'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0].modalidade).toBe('Funcional');
  });

  it('mapeia desfecho: sem outcome -> Agendado, attended -> Compareceu, no_show -> Não veio, cancelled -> Cancelou', () => {
    const scheduled = aula({ id: 'a', appointmentOutcome: null });
    const attended = aula({ id: 'b', appointmentOutcome: 'attended' });
    const noShow = aula({ id: 'c', appointmentOutcome: 'no_show' });
    const cancelled = aula({ id: 'd', appointmentOutcome: 'cancelled' });
    const rows = buildReportRows([scheduled, attended, noShow, cancelled], { isAula: true, now: NOW });
    const byId = Object.fromEntries(rows.map((r, i) => [[scheduled, attended, noShow, cancelled][i].id, r.desfecho]));
    expect(byId).toEqual({ a: 'Agendado', b: 'Compareceu', c: 'Não veio', d: 'Cancelou' });
  });

  it('filtra por desfecho usando os values de REPORT_OUTCOME_OPTIONS', () => {
    expect(REPORT_OUTCOME_OPTIONS.map((o) => o.value)).toEqual(['scheduled', 'attended', 'no_show', 'cancelled']);
    const attended = aula({ id: 'a', appointmentOutcome: 'attended' });
    const scheduled = aula({ id: 'b', appointmentOutcome: null });
    const rows = buildReportRows([attended, scheduled], { isAula: true, now: NOW, filters: { outcomes: ['attended'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0].desfecho).toBe('Compareceu');
  });

  it('lead "rescheduled" no lead doc (não deveria persistir, mas se persistir) cai no balde Agendado', () => {
    // lead.appointmentOutcome nunca é 'rescheduled' na escrita real (DailyGoalView
    // zera o campo ao remarcar), mas a função não deve quebrar se aparecer.
    const weird = aula({ appointmentOutcome: 'rescheduled' });
    const rows = buildReportRows([weird], { isAula: true, now: NOW, filters: { outcomes: ['scheduled'] } });
    expect(rows).toHaveLength(1);
  });

  it('coluna Passe usa getTrialPassNote (mesma regra de isPassActive)', () => {
    const withPass = aula({ appointmentScheduledFor: new Date(2026, 6, 13), trialClassesPlanned: 7 });
    const noPass = aula({ id: 'x', trialClassesPlanned: null });
    const rows = buildReportRows([withPass, noPass], { isAula: true, now: NOW });
    const withPassRow = rows.find((r) => r.nome === 'Ana Souza' && r.passe !== '—');
    expect(withPassRow.passe).toContain('·');
    const noPassRow = rows.find((r) => r.passe === '—');
    expect(noPassRow).toBeTruthy();
  });

  it('Visitas: linhas não têm professor/modalidade/passe', () => {
    const rows = buildReportRows([{ ...visita(), whatsapp: '(51) 9 1234-5678' }], { isAula: false, now: NOW });
    expect(rows[0]).toEqual({
      nome: 'Carlos Lima',
      telefone: '(51) 9 1234-5678',
      objetivo: 'Condicionamento',
      dataMarcada: expect.any(String),
      desfecho: 'Compareceu',
      responsavel: 'Bruna Consultora',
    });
  });

  it('objetivo/responsável caem para "—" quando ausentes', () => {
    const bare = aula({ dor: '', consultantName: '' });
    const rows = buildReportRows([bare], { isAula: true, now: NOW });
    expect(rows[0].objetivo).toBe('—');
    expect(rows[0].responsavel).toBe('—');
  });
});

describe('rowsToCsv', () => {
  const columns = [{ key: 'a', label: 'Coluna A' }, { key: 'b', label: 'Coluna B' }];

  it('gera cabeçalho + linhas separados por ; e \\r\\n', () => {
    const csv = rowsToCsv([{ a: '1', b: '2' }, { a: '3', b: '4' }], columns);
    expect(csv).toBe('Coluna A;Coluna B\r\n1;2\r\n3;4');
  });

  it('escapa valores com ponto-e-vírgula entre aspas', () => {
    const csv = rowsToCsv([{ a: 'Nome; Sobrenome', b: 'ok' }], columns);
    expect(csv).toBe('Coluna A;Coluna B\r\n"Nome; Sobrenome";ok');
  });

  it('escapa aspas duplas duplicando-as', () => {
    const csv = rowsToCsv([{ a: 'Disse "oi"', b: 'ok' }], columns);
    expect(csv).toBe('Coluna A;Coluna B\r\n"Disse ""oi""";ok');
  });

  it('escapa valores com quebra de linha', () => {
    const csv = rowsToCsv([{ a: 'linha1\nlinha2', b: 'ok' }], columns);
    expect(csv).toBe('Coluna A;Coluna B\r\n"linha1\nlinha2";ok');
  });

  it('trata valor ausente (null/undefined) como string vazia', () => {
    const csv = rowsToCsv([{ a: null, b: undefined }], columns);
    expect(csv).toBe('Coluna A;Coluna B\r\n;');
  });

  it('lista vazia gera só o cabeçalho', () => {
    expect(rowsToCsv([], columns)).toBe('Coluna A;Coluna B');
  });
});

describe('buildReportHtml', () => {
  it('inclui título, subheading e as linhas na tabela', () => {
    const html = buildReportHtml({
      title: 'Aulas experimentais',
      subheading: '01/07/2026 – 15/07/2026',
      columns: [{ key: 'nome', label: 'Nome' }],
      rows: [{ nome: 'Ana' }],
    });
    expect(html).toContain('<title>Aulas experimentais</title>');
    expect(html).toContain('01/07/2026 – 15/07/2026');
    expect(html).toContain('<td>Ana</td>');
  });

  it('escapa HTML nos valores (evita quebrar o markup)', () => {
    const html = buildReportHtml({
      title: 'X',
      subheading: '',
      columns: [{ key: 'nome', label: 'Nome' }],
      rows: [{ nome: '<script>alert(1)</script>' }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('lista vazia mostra mensagem de "nenhum registro"', () => {
    const html = buildReportHtml({ title: 'X', subheading: '', columns: [], rows: [] });
    expect(html).toContain('Nenhum registro encontrado');
  });
});
