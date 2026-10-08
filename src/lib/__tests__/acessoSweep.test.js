// O papel de quem usa o app é decidido num lugar só, src/lib/acesso.js. Esta
// varredura cobra isso de todo arquivo de src/: comparar o papel do cadastro
// com o texto de um papel ('admin', 'consultant', 'professor' e os nomes em
// português) fora de acesso.js derruba o CI. Com role === 'admin' espalhado
// pelo app, todo mundo que não era gestor virava consultor, e o professor
// herdaria o que é do consultor. Quem precisa do papel usa isGestor,
// isProfessor, isSeller, roleOf com ROLES, can ou canOpenScreen.
//
// Ficam de fora o próprio acesso.js e os testes, que montam cadastros com
// role: 'admin' de propósito. O `role === 'inUse'` dos contratos não é papel
// de pessoa e não entra. A api/ não é varrida: ela compara o papel que chega
// no pedido e o que está gravado, e importa acesso.js onde decide por papel.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const DONO = 'lib/acesso.js';

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// Comentário sai antes da leitura: contar no comentário como era antes não é
// decidir por papel. Mesmo corte do guardianImports.test.js.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ASPAS = "['\"`]";
const PAPEL = ASPAS + '(?:admin|consultant|professor|consultor|gestor)' + ASPAS;
const COMPARA = '[!=]==?';
const POR_PAPEL = new RegExp(
  `\\brole\\b\\s*${COMPARA}\\s*${PAPEL}|${PAPEL}\\s*${COMPARA}\\s*[\\w$?.]*\\brole\\b`,
);

const relPosix = (file) => relative(SRC, file).split(sep).join('/');
const arquivos = sourceFiles(SRC).filter((file) => relPosix(file) !== DONO);
const codigo = (file) => stripComments(readFileSync(file, 'utf8'));

// Listas de pessoas que viram filtro de responsável, escolha de dono ou painel
// por pessoa. Cada uma passa pelo isSeller: o professor não
// é dono de lead e não vende. Busca de nome (o chip do filtro, o autor da
// linha do tempo) continua com o usersList inteiro. As listas de Clientes, da
// ficha, do cadastro do cliente e de Metas & ritmo também passam pelo
// isSeller. Tela nova com lista de pessoas entra aqui.
const LISTAS_DE_QUEM_VENDE = [
  'views/KanbanView.jsx',
  'views/LeadsView.jsx',
  'views/AppointmentTrackingView.jsx',
  'views/dashboard/DashboardOperacionalView.jsx',
  'views/dashboard/DashboardCrmView.jsx',
  'views/settings/TransferLeadsTab.jsx',
  'views/settings/ImportClientsSection.jsx',
  // Já passam pelo isSeller desde as Tasks 6 e 8.
  'views/ClientsView.jsx',
  'views/LeadProfileView.jsx',
  'modals/ClientRegistrationModal.jsx',
  'views/settings/PaceSection.jsx',
  // Rotinas: quem pode seguir modelo (routineParticipants).
  'lib/rotinas.js',
];

describe('o papel se decide em src/lib/acesso.js', () => {
  it('nenhum arquivo de src/ compara o papel com o texto de um papel', () => {
    expect(arquivos.filter((file) => POR_PAPEL.test(codigo(file))).map(relPosix).sort()).toEqual([]);
  });

  it('isAdminUser saiu: quem quer saber se é gestor usa isGestor', () => {
    expect(arquivos.filter((file) => /\bisAdminUser\b/.test(codigo(file))).map(relPosix).sort()).toEqual([]);
  });

  it('as listas de quem vende passam pelo isSeller', () => {
    const lidos = new Map(arquivos.map((file) => [relPosix(file), file]));
    const semFiltro = LISTAS_DE_QUEM_VENDE.filter((rel) => !lidos.has(rel) || !/\bisSeller\b/.test(codigo(lidos.get(rel))));
    expect(semFiltro).toEqual([]);
  });

  it('a varredura não está cega: o leitor pega as formas de comparar', () => {
    for (const linha of [
      "const isAdmin = appUser?.role === 'admin';",
      "users.filter(u => u.role !== 'admin')",
      'if (user.role == "consultant") return;',
      "if (role != 'professor') return;",
      "'admin' === appUser?.role",
      'u.role === `admin`',
    ]) expect(POR_PAPEL.test(linha), linha).toBe(true);
  });

  it('e não pega o que não é papel de pessoa', () => {
    for (const linha of [
      "const inUse = role === 'inUse';",
      "a.audience === 'gestor'",
      'roleOf(u) === ROLES.GESTOR',
      'form.role === ROLES.PROFESSOR',
      "const gestor = { id: 'u1', role: 'admin' };",
      'body: JSON.stringify({ email, role: inviteRole, allowExtra })',
      "teamRole(actor) === 'gestor'",
    ]) expect(POR_PAPEL.test(linha), linha).toBe(false);
  });

  it('a varredura lê o app de verdade e o dono existe', () => {
    const lidos = arquivos.map(relPosix);
    expect(lidos).toContain('App.jsx');
    expect(lidos).toContain('views/settings/TeamAccessSection.jsx');
    expect(lidos).toContain('lib/notifications.js');
    expect(lidos).not.toContain(DONO);
    expect(readFileSync(join(SRC, DONO), 'utf8')).toContain('export function roleOf');
  });
});
