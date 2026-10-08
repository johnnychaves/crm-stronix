// O check da rotina (stronix_rotina_marcas) e a versão do dia do modelo
// (stronix_rotina_versoes) moram no firestore.rules, que o Johnny publica à mão
// no console (spec docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md).
// A regra do check confere campo por campo o que o markDone
// (src/lib/rotinasWrites.js) grava, e nada no código ligava os dois: um campo a
// mais ou a menos no markDone faria todo check de verdade cair em
// permission-denied em produção, sem nenhum teste quebrar. No molde do
// professorRules.test.js, este teste lê o texto da regra e cobra:
//   1. a lista do hasOnly e a do hasAll do check são a mesma, sem repetir, e são
//      as chaves que o markDone grava, inclusive o taskTime null da tarefa sem
//      horário;
//   2. o check exige, no E de cima da regra, o note vazio, o doneAt igual a
//      request.time e o uid de quem grava, e o markDone grava '', o
//      serverTimestamp() e o authUid de quem marca;
//   3. o id do check na regra, montado com os campos do próprio check, é o id
//      em que o markDone grava, que sai do markIdOf, na mesma ordem;
//   4. o id da versão na regra é o que o modelDocs monta e o commitModels grava.
// Mudou o markDone ou o modelDocs, o teste quebra até a regra acompanhar. Aí é
// mudar a regra, publicar no console e só depois fazer o merge.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const s = vi.hoisted(() => ({ writes: [], docs: new Map(), SERVER_TIME: { servidor: 'request.time' } }));

vi.mock('../firebase.js', () => ({
  appId: 'acad',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
}));

// O Firestore falso guarda cada gravação com o id do documento e o objeto
// gravado, que é o que chega à regra como request.resource.data.
vi.mock('firebase/firestore', () => {
  const ref = (p) => ({ path: p.join('/'), id: p[p.length - 1] });
  const write = (r, data) => { s.writes.push({ id: r.id, path: r.path, data }); };
  return {
    collection: (_db, ...p) => ({ kind: 'col', path: p.join('/') }),
    doc: (_db, ...p) => ref(p),
    serverTimestamp: () => s.SERVER_TIME,
    setDoc: vi.fn(async (r, data) => write(r, data)),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    runTransaction: vi.fn(async (_db, fn) => fn({
      get: async (r) => {
        const d = s.docs.get(r.id);
        return { id: r.id, exists: () => d !== undefined, data: () => ({ ...d }) };
      },
      set: (r, data) => write(r, data),
      delete: () => {},
    })),
  };
});

const { markDone, updateModel } = await import('../rotinasWrites.js');
const { markIdOf, modelDocs, routineDayKey } = await import('../rotinas.js');

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const RULES = ler('../../../firestore.rules');
const ordenado = (xs) => [...xs].sort();

const NOW = new Date(2026, 9, 6, 11, 5);
const carla = { id: 'carla', authUid: 'uid-carla' };
const MODEL = { id: 'm1' };
const COM_HORARIO = { id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true };
const SEM_HORARIO = { id: 't2', title: 'Revisar as perdas', how: '', days: 'all', time: null, active: true };
// Tarefa antiga, gravada antes de o campo existir: o time não vem.
const SEM_CAMPO = { id: 't3', title: 'Organizar o mural', how: '', days: 'all', active: true };

beforeEach(() => {
  s.writes.length = 0;
  s.docs.clear();
});

// O bloco `match` de uma coleção da academia, até a chave que o fecha.
function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// Uma linha `allow` do bloco (com as linhas de continuação), até a próxima
// `allow` ou o fim do bloco. `allow create, update:` serve aos dois.
function regraDe(bloco, op) {
  const m = new RegExp(`allow [\\w, ]*\\b${op}\\b[\\w, ]*:([\\s\\S]*?)(?=\\n\\s*allow |$)`).exec(bloco);
  expect(m, `allow ${op}`).not.toBeNull();
  return m[1];
}

// Os termos do E de cima de uma condição, como no professorRules.test.js: parte
// nos `&&` fora de parênteses e colchetes, sem os comentários. Um `||` fora de
// parênteses quer dizer que não há E de cima, e a lista volta vazia.
function termosDoE(condicao) {
  const expr = condicao.replace(/\/\/.*$/gm, '').trim().replace(/^if\s+/, '').replace(/;\s*$/, '');
  const termos = [];
  let nivel = 0;
  let inicio = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '(' || c === '[') nivel += 1;
    else if (c === ')' || c === ']') nivel -= 1;
    else if (nivel === 0 && expr.startsWith('||', i)) return [];
    else if (nivel === 0 && expr.startsWith('&&', i)) {
      termos.push(expr.slice(inicio, i).trim());
      inicio = i + 2;
      i += 1;
    }
  }
  termos.push(expr.slice(inicio).trim());
  return termos;
}

// A lista de `request.resource.data.keys().hasOnly([...])` ou `.hasAll([...])`,
// que precisa estar no E de cima da regra. Só os textos entre aspas simples
// contam, então a regra não pode ter comentário dentro da lista.
function chavesDa(regra, metodo) {
  const prefixo = `request.resource.data.keys().${metodo}([`;
  const termo = termosDoE(regra).find((t) => t.startsWith(prefixo));
  expect(termo, `keys().${metodo}([...]) no E de cima da regra`).toBeDefined();
  expect(termo.endsWith('])'), termo).toBe(true);
  return [...termo.slice(prefixo.length, -2).matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// O lado direito do `id == ...` da regra, parte por parte: campo do pedido
// (request.resource.data.x) ou texto entre aspas simples, ligados por `+`.
function idDaRegra(regra) {
  const PARTE = String.raw`(?:request\.resource\.data\.\w+|'[^'+]*')`;
  const m = new RegExp(String.raw`\bid == (${PARTE}(?:\s*\+\s*${PARTE})*)`).exec(regra);
  expect(m, 'id == ... na regra').not.toBeNull();
  return m[1].split(/\s*\+\s*/).map((parte) => {
    const campo = /^request\.resource\.data\.(\w+)$/.exec(parte);
    return campo ? { campo: campo[1] } : { texto: parte.slice(1, -1) };
  });
}
// O id que a regra espera para um documento com esses campos.
const idEsperado = (partes, data) => partes.map((p) => ('campo' in p ? String(data[p.campo]) : p.texto)).join('');

const MARCAS = 'stronix_rotina_marcas';
const VERSOES = 'stronix_rotina_versoes';

async function checkDe(task) {
  s.writes.length = 0;
  const id = await markDone({ db: {}, appUser: carla, model: MODEL, task, now: NOW });
  expect(s.writes).toHaveLength(1);
  const [gravado] = s.writes;
  expect(gravado.path).toBe(`artifacts/acad/public/data/${MARCAS}/${id}`);
  return gravado;
}

// Lidas dentro de cada teste, para a falta do bloco aparecer como teste
// reprovado e não como erro ao carregar o arquivo.
const criarCheck = () => regraDe(blocoDe(MARCAS), 'create');
const criarVersao = () => regraDe(blocoDe(VERSOES), 'create');

describe('o check da rotina: a regra e o markDone', () => {

  it('o hasOnly e o hasAll têm a mesma lista, sem repetir', () => {
    const soEssas = chavesDa(criarCheck(), 'hasOnly');
    const todas = chavesDa(criarCheck(), 'hasAll');
    expect(new Set(soEssas).size).toBe(soEssas.length);
    expect(new Set(todas).size).toBe(todas.length);
    expect(ordenado(todas)).toEqual(ordenado(soEssas));
  });

  it.each([
    ['com horário', COM_HORARIO],
    ['sem horário', SEM_HORARIO],
    ['sem o campo time', SEM_CAMPO],
  ])('tarefa %s: o markDone grava exatamente as chaves da regra', async (_nome, task) => {
    const { data } = await checkDe(task);
    expect(ordenado(Object.keys(data))).toEqual(ordenado(chavesDa(criarCheck(), 'hasOnly')));
    expect(ordenado(Object.keys(data))).toEqual(ordenado(chavesDa(criarCheck(), 'hasAll')));
    for (const [campo, valor] of Object.entries(data)) expect(valor, campo).not.toBeUndefined();
  });

  // O hasAll exige o taskTime presente: a tarefa sem horário grava null, e não
  // deixa o campo de fora.
  it('a tarefa sem horário grava o taskTime como null, nunca sem o campo', async () => {
    for (const task of [SEM_HORARIO, SEM_CAMPO]) {
      const { data } = await checkDe(task);
      expect('taskTime' in data, task.id).toBe(true);
      expect(data.taskTime, task.id).toBeNull();
    }
    expect((await checkDe(COM_HORARIO)).data.taskTime).toBe('08:00');
  });

  it('a regra exige o note vazio, a hora do servidor e o uid de quem grava, e o markDone grava os três', async () => {
    const termos = termosDoE(criarCheck());
    expect(termos).toContain("request.resource.data.note == ''");
    expect(termos).toContain('request.resource.data.doneAt == request.time');
    expect(termos).toContain('request.resource.data.consultantAuthUid == request.auth.uid');
    expect(termos).toContain('routineMarkDayOk(request.resource.data.date)');
    const { data } = await checkDe(COM_HORARIO);
    expect(data.note).toBe('');
    expect(data.doneAt).toBe(s.SERVER_TIME);
    expect(data.consultantAuthUid).toBe(carla.authUid);
    expect(data.consultantId).toBe(carla.id);
    expect(data.date).toBe(routineDayKey(NOW));
  });

  it('o id da regra é consultantId, date e taskId, nessa ordem, separados por _', () => {
    expect(idDaRegra(criarCheck())).toEqual([
      { campo: 'consultantId' }, { texto: '_' }, { campo: 'date' }, { texto: '_' }, { campo: 'taskId' },
    ]);
  });

  it('o markIdOf monta o id que a regra espera', () => {
    const partes = idDaRegra(criarCheck());
    const campos = { consultantId: 'carla', date: '2026-10-06', taskId: 't1' };
    expect(markIdOf(campos.consultantId, campos.date, campos.taskId)).toBe(idEsperado(partes, campos));
  });

  it('o markDone grava no id que a regra espera para os campos dele', async () => {
    const partes = idDaRegra(criarCheck());
    for (const task of [COM_HORARIO, SEM_HORARIO]) {
      const { id, data } = await checkDe(task);
      expect(id, task.id).toBe(idEsperado(partes, data));
      expect(id, task.id).toBe(markIdOf(data.consultantId, data.date, data.taskId));
    }
  });
});

describe('a versão do dia: a regra e o modelDocs', () => {

  it('o id da regra é modelId e date, nessa ordem, separados por _', () => {
    expect(idDaRegra(criarVersao())).toEqual([{ campo: 'modelId' }, { texto: '_' }, { campo: 'date' }]);
    expect(termosDoE(criarVersao())).toContain('routineMarkDayOk(request.resource.data.date)');
  });

  it('o modelDocs monta o id que a regra espera para os campos da versão', () => {
    const partes = idDaRegra(criarVersao());
    const { version } = modelDocs({
      modelId: 'm1', name: 'Manhã', tasks: [COM_HORARIO], followerIds: ['carla'], userId: 'g1', dateKey: '2026-10-06',
    });
    expect(version.id).toBe(idEsperado(partes, version.data));
  });

  it('a gravação de modelo grava a versão no id que a regra espera, com o dia de hoje', async () => {
    s.docs.set('m1', { name: 'Manhã', tasks: [COM_HORARIO], followerIds: ['carla'] });
    await updateModel({ db: {}, appUser: { id: 'g1', authUid: 'g1' }, modelId: 'm1', edit: () => ({ name: 'Manhã cedo' }), now: NOW });
    const versoes = s.writes.filter((w) => w.path.startsWith(`artifacts/acad/public/data/${VERSOES}/`));
    expect(versoes).toHaveLength(1);
    const [{ id, data }] = versoes;
    expect(id).toBe(idEsperado(idDaRegra(criarVersao()), data));
    expect(data.date).toBe(routineDayKey(NOW));
  });
});

// As regras juntam os allow com OU, então um segundo `allow create` ou um
// `allow write` no bloco valeria por cima das travas conferidas acima.
describe('as travas continuam numa linha só', () => {
  it.each([MARCAS, VERSOES])('%s: uma linha allow por operação e nenhum allow write', (colecao) => {
    const bloco = blocoDe(colecao).replace(/\/\/.*$/gm, '');
    for (const op of ['create', 'update', 'delete']) {
      expect(bloco.match(new RegExp(`allow [\\w, ]*\\b${op}\\b`, 'g')), `${colecao}: ${op}`).toHaveLength(1);
    }
    expect(bloco).not.toMatch(/allow [\w, ]*\bwrite\b/);
  });
});
