// Toda troca do professor do lead passa por professorChangePatch
// (src/lib/professorHistory.js), para entrar no histórico que a renovação da
// carteira lê (spec 2026-11-24-perfil-do-professor-design.md). Esta varredura
// lista os arquivos de src/ e api/ que têm professorId como chave de objeto.
// Arquivo novo na lista reprova até alguém conferir se ele grava o professor
// do lead e, se gravar, fazê-lo passar pelo montador.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSectionPatch, CADASTRO_SECTIONS } from '../cadastroSections.js';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));

function arquivosDeCodigo(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') out.push(...arquivosDeCodigo(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const CHAVE = /\bprofessorId\s*:|[{,]\s*professorId\s*[,}]/;

// Cada arquivo com o motivo de estar aqui.
const REVISADOS = {
  // Gravam o professor do lead, pelo montador.
  'src/lib/professorHistory.js': 'o montador',
  'src/lib/contextPatch.js': 'Contexto comercial da ficha, pelo montador',
  'src/lib/aulasWrites.js': 'registro da aula e carimbo da matrícula, pelo montador',
  'src/lib/clientImport.js': 'candidato da planilha, lead novo (nasce com o professor) e preenchimento pelo montador',
  // O cadastro completo monta o professor, mas nenhuma seção da aba Cadastro grava (teste abaixo).
  'src/lib/clientRegistration.js': 'formulário do cadastro completo',
  // Registro da aula em stronix_aulas, não o professor do lead.
  'src/lib/aulas.js': 'registro da aula',
  'src/components/profile/ScheduleWizard.jsx': 'escolha do professor da aula',
  'src/views/LeadProfileView.jsx': 'registro da aula do assistente',
  'src/views/DailyGoalView.jsx': 'registro da aula do Remarcar',
  'api/_zapSchedule.js': 'registro da aula do agendamento pelo Stronizap',
  // Só mostram ou contam.
  'src/components/profile/ContextCard.jsx': 'opções e valores da tela',
  'src/modals/RescheduleModal.jsx': 'id do campo no JSX',
  'src/lib/dashboardMetrics.js': 'contagem por professor',
  'src/lib/professor/conversao.js': 'conversão do perfil do professor, só conta',
  'src/lib/professor/pesquisas.js': 'pesquisa de NPS do perfil do professor, só conta',
  'src/views/professores/ProfessoresView.jsx': 'lista de professores, só conta',
  'src/views/professores/ProfessorPerfilView.jsx': 'perfil do professor, só conta (grava foto e nível no professor, nunca no lead)',
  // Cadastro da equipe (stronix_users), não o lead.
  'src/lib/teamRoles.js': 'papel da equipe',
  'src/views/settings/TeamAccessSection.jsx': 'papel da equipe',
  'api/_professorLink.js': 'vínculo do login com o professor',
  'api/admin-users.js': 'papel da equipe',
  'api/invite-accept.js': 'convite de professor',
  'api/invite-create.js': 'convite de professor',
};

const comChave = [...arquivosDeCodigo(join(RAIZ, 'src')), ...arquivosDeCodigo(join(RAIZ, 'api'))]
  .filter((f) => CHAVE.test(readFileSync(f, 'utf8')))
  .map((f) => relative(RAIZ, f).split('\\').join('/'))
  .sort();

describe('gravação do professor do lead', () => {
  it('todo arquivo com professorId como chave foi revisado', () => {
    expect(comChave.filter((f) => !(f in REVISADOS))).toEqual([]);
  });

  it('a lista de revisados não tem arquivo que saiu', () => {
    expect(Object.keys(REVISADOS).filter((f) => !comChave.includes(f))).toEqual([]);
  });

  it('os três caminhos que trocam o professor do lead usam o montador', () => {
    for (const f of ['src/lib/contextPatch.js', 'src/lib/aulasWrites.js', 'src/lib/clientImport.js']) {
      expect(readFileSync(join(RAIZ, f), 'utf8'), f).toMatch(/professorChangePatch\(/);
    }
  });

  it('nenhuma seção da aba Cadastro grava o professor', () => {
    const lead = { name: 'Ana', professorId: 'p1', professorName: 'Bruno' };
    for (const { id } of CADASTRO_SECTIONS) {
      expect(buildSectionPatch(id, { professorId: 'p2' }, lead), id).not.toHaveProperty('professorId');
    }
  });
});
