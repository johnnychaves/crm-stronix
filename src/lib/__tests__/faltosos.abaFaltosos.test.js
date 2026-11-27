// Os textos da última importação e do lembrete de exportação, e quem importa
// (src/lib/faltosos/abaFaltosos.js). Puro, em node; o bloco de Configurações
// tem o teste dele em faltososPanel.test.js.
import { describe, it, expect } from 'vitest';
import { importaFaltosos, lembreteExportacao, resumoDaUltimaImportacao } from '../faltosos/abaFaltosos.js';
import { MODULES } from '../modules.js';

const COM = [MODULES.FALTOSOS];
const gestor = { id: 'g1', role: 'admin', tenantModules: COM };
const consultor = { id: 'c1', role: 'consultant', tenantModules: COM };
const professor = { id: 'u6', role: 'professor', professorId: 'p-rafa', tenantModules: COM };
const MARCOS = [7, 14, 30, 60];
const HOJE = '2026-10-06';
// Id da importação de 06/10 com o Presenças da semana (decisão D2 do plano).
const IMP = 'f2026-10-06_p2026-09-29_2026-10-05';

describe('quem importa', () => {
  it('só o gestor importa, e só com o módulo', () => {
    expect(importaFaltosos(gestor)).toBe(true);
    expect(importaFaltosos(professor)).toBe(false);
    expect(importaFaltosos(consultor)).toBe(false);
    expect(importaFaltosos({ ...gestor, tenantModules: [] })).toBe(false);
    expect(importaFaltosos(null)).toBe(false);
  });
});

describe('textos da importação', () => {
  it('a última importação com dia e hora de Brasília, quem fez e as datas dos arquivos', () => {
    expect(resumoDaUltimaImportacao(null)).toBeNull();
    expect(resumoDaUltimaImportacao({ dataFaltantes: '2026-10-06' })).toBeNull();
    expect(resumoDaUltimaImportacao({
      id: IMP, dataFaltantes: '2026-10-06', periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' },
      importadoEm: new Date('2026-10-06T12:12:00Z'), importadoPorNome: 'Johnny',
    })).toEqual({
      quando: '06/10 às 09:12, por Johnny',
      faltantes: 'Faltantes de 06/10/2026',
      presencas: 'Presenças de 29/09 a 05/10',
    });
    // O carimbo do Firestore (Timestamp) também vale.
    expect(resumoDaUltimaImportacao({ id: IMP, importadoEm: { toDate: () => new Date('2026-10-06T23:30:00Z') } }).quando)
      .toBe('06/10 às 20:30');
    expect(resumoDaUltimaImportacao({ id: 'p2026-10-01_2026-10-06', dataFaltantes: null, periodoPresencas: null, importadoEm: null, importadoPorNome: '' }))
      .toEqual({ quando: 'Data não registrada', faltantes: 'Nenhum Faltantes importado', presencas: 'Nenhum Presenças importado' });
  });

  it('como exportar: o Faltantes com o menor marco e o Presenças do dia seguinte ao último até hoje', () => {
    const ultima = { id: IMP, periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' } };
    expect(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: ultima, hojeDia: HOJE })).toEqual({
      faltantes: 'Faltantes: exporte com o filtro de 7 dias sem vir.',
      presencas: 'Presenças: exporte de 06/10 até hoje.',
    });
    expect(lembreteExportacao({ marcos: [10, 20], ultimaImportacao: { periodoPresencas: { de: '2026-10-01', ate: HOJE } }, hojeDia: HOJE }))
      .toEqual({ faltantes: 'Faltantes: exporte com o filtro de 10 dias sem vir.', presencas: 'Presenças: já está importado até hoje.' });
    expect(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: { ultimoDiaPresencas: '2026-10-02' }, hojeDia: HOJE }).presencas)
      .toBe('Presenças: exporte de 03/10 até hoje.');
    expect(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: null, hojeDia: HOJE }).presencas).toBe('Presenças: exporte a última semana, até hoje.');
  });

  it('nenhum texto tem travessão', () => {
    const textos = [
      ...Object.values(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: null, hojeDia: HOJE })),
      ...Object.values(resumoDaUltimaImportacao({ id: IMP, dataFaltantes: HOJE, periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' } })),
    ];
    for (const t of textos) expect(String(t)).not.toMatch(/[—–]/);
  });
});
