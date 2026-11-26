# Cadastro da equipe, PR 1: lista e ficha

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurações → Equipe & acessos vira uma lista única de pessoas (login e professor juntos), e cada pessoa ganha a ficha em `/configuracoes/equipe/<id>`, com as abas Dados, Movimentações e Acesso ao app.

**Architecture:** Coleção nova `stronix_equipe`, só do gestor. `montarEquipe` (puro) junta fichas, logins e professores. A ficha nasce com o id da pessoa na primeira gravação. A rota da ficha é uma sub-tela das Configurações (como o modelo de rotina), então o `SettingsView` não remonta ao abrir a ficha. Os diálogos de cadastro de hoje continuam no cabeçalho até o PR 2.

**Tech Stack:** React 19, React Router 7, shadcn/ui (`Tabs`), Firestore, Storage, Vitest.

Plano mestre: `docs/superpowers/plans/2026-11-26-cadastro-da-equipe-00-visao-geral.md`. Spec: `docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md`.

---

## Antes de começar

- [ ] Ler o plano mestre e as seções "Endereço de cada tela", "Professor" e "Padrão de UI" do `CLAUDE.md`.
- [ ] `git fetch origin && git rev-list --count HEAD..origin/main` deve dar 0; se não, `git merge --ff-only origin/main`.
- [ ] `npm ci`, depois `git status --short package-lock.json` vazio.
- [ ] Linha de base: `npm run lint && npm test && npm run verificar:sentry && npm run build`. Anotar o que já falhava.

---

### Task 1: Caminho da coleção e regra do Firestore

**Files:**
- Modify: `src/lib/firebase.js` (perto de `PROFESSORS_PATH`, linha ~158)
- Modify: `firestore.rules` (logo depois do bloco de `stronix_professores`, linha ~349)
- Create: `src/lib/__tests__/equipeRules.test.js`

- [ ] **Step 1: Escrever o teste da regra**

```js
// src/lib/__tests__/equipeRules.test.js
// A ficha da equipe guarda CPF, endereço e o motivo do desligamento: só o
// gestor da academia lê e grava (spec 2026-11-26-cadastro-da-equipe). A regra
// é publicada à mão no console; este teste cobra o texto do firestore.rules.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EQUIPE_PATH } from '../firebase.js';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

function bloco() {
  const inicio = RULES.search(/match \/artifacts\/\{appId\}\/public\/data\/stronix_equipe\/\{\w+\} \{/);
  expect(inicio, 'bloco de stronix_equipe').toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

describe('regra de stronix_equipe', () => {
  it('o caminho do app é o mesmo da regra', () => {
    expect(EQUIPE_PATH).toBe('stronix_equipe');
  });

  it('só o gestor da academia ativa lê e grava, numa linha só', () => {
    const allows = bloco().split('\n').filter((l) => l.trim().startsWith('allow'));
    expect(allows).toHaveLength(1);
    expect(allows[0]).toMatch(/allow read, write: if isAdmin\(appId\) && inTenant\(appId\) && tenantActive\(appId\);/);
  });
});
```

Se importar `../firebase.js` no node quebrar (ele inicia o Firebase), troque o import por `const EQUIPE_PATH = 'stronix_equipe';` e o primeiro teste por uma leitura do texto de `src/lib/firebase.js` com `toContain("export const EQUIPE_PATH = 'stronix_equipe';")`. Veja como o `professorRules.test.js` faz.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeRules.test.js`
Expected: FAIL (bloco não encontrado).

- [ ] **Step 3: Implementar**

Em `src/lib/firebase.js`, logo depois de `export const PROFESSORS_PATH = 'stronix_professores';`:

```js
// Ficha da equipe (spec docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md):
// CPF, endereço, vínculo e movimentações de cada pessoa. Só o gestor lê e grava.
export const EQUIPE_PATH = 'stronix_equipe';
```

Em `firestore.rules`, depois do bloco `match /artifacts/{appId}/public/data/stronix_professores/{id} { ... }`:

```
    // Ficha da equipe (spec 2026-11-26-cadastro-da-equipe): CPF, RG,
    // nascimento, endereço, vínculo e as movimentações, com o tipo e o motivo
    // do desligamento. Só o gestor lê, porque o resto da equipe não tem por
    // que ver o CPF de um colega. O servidor grava pelo Admin SDK (o userId do
    // cadastro, o convite e o desligamento).
    match /artifacts/{appId}/public/data/stronix_equipe/{id} {
      allow read, write: if isAdmin(appId) && inTenant(appId) && tenantActive(appId);
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeRules.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase.js firestore.rules src/lib/__tests__/equipeRules.test.js
git commit -m "feat: coleção e regra da ficha da equipe"
```

---

### Task 2: A ficha, em `src/lib/equipe/ficha.js`

**Files:**
- Create: `src/lib/equipe/ficha.js`
- Create: `src/lib/__tests__/equipeFicha.test.js`

- [ ] **Step 1: Escrever os testes**

```js
// src/lib/__tests__/equipeFicha.test.js
import { describe, it, expect } from 'vitest';
import {
  VINCULOS, vinculoSelo, vinculoTexto, MOV, novaMovimentacao, admissaoDe, comAdmissao,
  faltasDaFicha, formDoBloco, patchDoBloco, tempoDeCasa, dataBR, hojeIso,
} from '../equipe/ficha.js';

const AGORA = new Date(2026, 10, 26, 10, 0); // 26/11/2026, 10h local
const AUTOR = { id: 'gestor-1', nome: 'Johnny' };
const prof = (extra = {}) => ({ id: 'p1', nome: 'Marina', modalidadeIds: ['m-func'], ativo: true, ...extra });

describe('vínculos', () => {
  it('lista os seis da spec, na ordem', () => {
    expect(VINCULOS.map((v) => v.id)).toEqual(['clt', 'estagio', 'pj', 'socio', 'temporario', 'outro']);
  });
  it('o selo do estágio diz quem é', () => {
    expect(vinculoSelo('estagio')).toBe('Estagiário');
    expect(vinculoTexto('estagio')).toBe('Estágio');
    expect(vinculoSelo('xyz')).toBe('Sem vínculo');
  });
});

describe('movimentações', () => {
  it('desligamento leva tipo e motivo, e não leva vínculo', () => {
    const m = novaMovimentacao({ tipo: MOV.DESLIGAMENTO, data: '2026-11-26', vinculo: 'clt', tipoDesligamento: 'acordo', motivo: '  mudou ', autor: AUTOR, agora: AGORA });
    expect(m).toEqual({
      tipo: 'desligamento', data: '2026-11-26', vinculo: null, tipoDesligamento: 'acordo', motivo: 'mudou',
      registradoPor: { id: 'gestor-1', nome: 'Johnny' }, registradoEm: AGORA.toISOString(),
    });
  });
  it('admissão ignora tipo de desligamento e motivo', () => {
    const m = novaMovimentacao({ tipo: MOV.ADMISSAO, data: '2026-01-02', vinculo: 'estagio', tipoDesligamento: 'acordo', motivo: 'x', autor: AUTOR, agora: AGORA });
    expect(m.vinculo).toBe('estagio');
    expect(m.tipoDesligamento).toBeNull();
    expect(m.motivo).toBe('');
  });
  it('a admissão de agora é a última admissão ou readmissão', () => {
    const ficha = { movimentacoes: [
      { tipo: 'admissao', data: '2022-02-07' }, { tipo: 'desligamento', data: '2023-12-15' }, { tipo: 'readmissao', data: '2024-03-12' },
    ] };
    expect(admissaoDe(ficha)).toBe('2024-03-12');
    expect(admissaoDe({})).toBeNull();
  });
  it('corrigir a admissão troca a data da última entrada, sem apagar nada', () => {
    const movs = [{ tipo: 'admissao', data: '2022-02-07' }, { tipo: 'desligamento', data: '2023-12-15' }];
    const novo = comAdmissao(movs, '2022-03-01', { vinculo: 'clt', autor: AUTOR, agora: AGORA });
    expect(novo).toHaveLength(2);
    expect(novo[0].data).toBe('2022-03-01');
    expect(movs[0].data).toBe('2022-02-07');
  });
  it('sem admissão, a primeira data cria a admissão', () => {
    const novo = comAdmissao([], '2024-03-12', { vinculo: 'clt', autor: AUTOR, agora: AGORA });
    expect(novo).toEqual([novaMovimentacao({ tipo: 'admissao', data: '2024-03-12', vinculo: 'clt', autor: AUTOR, agora: AGORA })]);
  });
});

describe('o anel', () => {
  const completa = {
    cpf: '91430211870', rg: '5093318820', nascimento: '1996-07-19', celular: '51995106624',
    emailPessoal: 'marina@gmail.com', endereco: { street: 'Rua A', number: '10', city: 'Porto Alegre' },
    vinculo: 'clt', cref: '021904-G/RS', foto: { url: 'u' }, movimentacoes: [{ tipo: 'admissao', data: '2024-03-12' }],
  };
  it('professor formado conta dez itens, com o CREF', () => {
    const r = faltasDaFicha({ funcao: 'professor', ficha: { ...completa, cref: '' }, professor: prof({ photoUrl: 'x' }) });
    expect(r.total).toBe(10);
    expect(r.faltam.map((f) => f.id)).toEqual(['cref']);
  });
  it('estagiário não tem CREF', () => {
    const r = faltasDaFicha({ funcao: 'professor', ficha: { ...completa, vinculo: 'estagio', cref: '' }, professor: prof({ photoUrl: 'x' }) });
    expect(r.total).toBe(9);
    expect(r.faltam).toEqual([]);
  });
  it('a foto do professor é a do cadastro do professor', () => {
    const r = faltasDaFicha({ funcao: 'professor', ficha: completa, professor: prof() });
    expect(r.faltam.map((f) => f.id)).toEqual(['foto']);
  });
  it('pessoa sem ficha mostra tudo faltando, com o bloco de cada item', () => {
    const r = faltasDaFicha({ funcao: 'consultor', ficha: null, professor: null });
    expect(r.total).toBe(9);
    expect(r.faltam[0]).toEqual({ id: 'foto', label: 'Foto', bloco: 'identidade' });
    expect(r.faltam.find((f) => f.id === 'endereco').bloco).toBe('contato');
  });
  it('endereço só conta com rua, número e cidade', () => {
    const r = faltasDaFicha({ funcao: 'consultor', ficha: { ...completa, endereco: { city: 'Canoas' } } });
    expect(r.faltam.map((f) => f.id)).toContain('endereco');
  });
});

describe('patch de cada bloco', () => {
  const pessoa = { id: 'p1', funcao: 'professor', nome: 'Marina', ficha: { movimentacoes: [] }, professor: prof() };
  const ctx = { pessoa, autor: AUTOR, agora: AGORA, professores: [prof(), { id: 'p2', nome: 'Tiago' }] };

  it('identidade: grava só as chaves dela, CPF em dígitos', () => {
    const r = patchDoBloco('identidade', { nome: ' Marina Prado ', cpf: '914.302.118-70', rg: ' 5093 ', nascimento: '1996-07-19' }, ctx);
    expect(r).toEqual({ ficha: { nome: 'Marina Prado', cpf: '91430211870', rg: '5093', nascimento: '1996-07-19' } });
  });
  it('identidade: CPF inválido aponta o campo', () => {
    expect(patchDoBloco('identidade', { nome: 'Marina', cpf: '111.111.111-11', rg: '', nascimento: '' }, ctx))
      .toEqual({ erro: 'CPF inválido.', campo: 'cpf' });
  });
  it('identidade: professor não repete o nome de outro professor', () => {
    expect(patchDoBloco('identidade', { nome: 'tiago', cpf: '', rg: '', nascimento: '' }, ctx))
      .toEqual({ erro: 'Já existe um professor com o nome "tiago".', campo: 'nome' });
  });
  it('identidade: nascimento no futuro é recusado', () => {
    expect(patchDoBloco('identidade', { nome: 'Marina', cpf: '', rg: '', nascimento: '2030-01-01' }, ctx).campo).toBe('nascimento');
  });
  it('contato: celular em dígitos, endereço vazio vira null', () => {
    const r = patchDoBloco('contato', { celular: '(51) 99510-6624', emailPessoal: ' a@b.com ', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }, ctx);
    expect(r).toEqual({ ficha: { celular: '51995106624', emailPessoal: 'a@b.com', endereco: null } });
  });
  it('contato: celular curto e e-mail torto são recusados', () => {
    expect(patchDoBloco('contato', { celular: '9999', emailPessoal: '' }, ctx).campo).toBe('celular');
    expect(patchDoBloco('contato', { celular: '', emailPessoal: 'semarroba' }, ctx).campo).toBe('emailPessoal');
  });
  it('trabalho: vínculo, admissão vira movimentação e as modalidades vão para o professor', () => {
    const r = patchDoBloco('trabalho', { vinculo: 'clt', admissao: '2024-03-12', cref: ' 021904-G/RS ', modalidadeIds: ['m-func'] }, ctx);
    expect(r.ficha.vinculo).toBe('clt');
    expect(r.ficha.cref).toBe('021904-G/RS');
    expect(r.ficha.movimentacoes).toHaveLength(1);
    expect(r.ficha.movimentacoes[0]).toMatchObject({ tipo: 'admissao', data: '2024-03-12', vinculo: 'clt' });
    expect(r.professor).toEqual({ modalidadeIds: ['m-func'] });
  });
  it('trabalho: estagiário não guarda CREF, e quem não é professor não mexe em professor', () => {
    const r = patchDoBloco('trabalho', { vinculo: 'estagio', admissao: '2026-02-02', cref: 'X' }, ctx);
    expect(r.ficha.cref).toBeNull();
    const c = patchDoBloco('trabalho', { vinculo: 'pj', admissao: '2026-11-24', cref: 'X' }, { ...ctx, pessoa: { ...pessoa, funcao: 'consultor', professor: null } });
    expect(c.ficha.cref).toBeNull();
    expect(c.professor).toBeNull();
  });
  it('trabalho: admissão depois de hoje é recusada', () => {
    expect(patchDoBloco('trabalho', { vinculo: 'clt', admissao: '2026-11-27' }, ctx))
      .toEqual({ erro: 'A admissão precisa ser hoje ou antes.', campo: 'admissao' });
  });
  it('o formulário de cada bloco sai da ficha e, sem ela, do login e do professor', () => {
    expect(formDoBloco('identidade', { nome: 'Ana', ficha: null }).nome).toBe('Ana');
    expect(formDoBloco('trabalho', { funcao: 'professor', ficha: null, professor: prof() }).modalidadeIds).toEqual(['m-func']);
    expect(formDoBloco('contato', { ficha: { endereco: { city: 'Canoas' } } }).city).toBe('Canoas');
  });
});

describe('datas', () => {
  it('tempo de casa em anos e meses', () => {
    expect(tempoDeCasa('2024-03-12', AGORA)).toBe('2 anos e 8 meses');
    expect(tempoDeCasa('2025-11-26', AGORA)).toBe('1 ano');
    expect(tempoDeCasa('2026-11-24', AGORA)).toBe('2 dias');
    expect(tempoDeCasa('2026-11-26', AGORA)).toBe('desde hoje');
    expect(tempoDeCasa('', AGORA)).toBe('');
  });
  it('data em dd/mm/aaaa e o dia de hoje no fuso do aparelho', () => {
    expect(dataBR('2024-03-12')).toBe('12/03/2024');
    expect(hojeIso(AGORA)).toBe('2026-11-26');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeFicha.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/equipe/ficha.js`**

```js
// A ficha da equipe (spec docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md):
// vínculos, movimentações, o anel do que falta e o patch de cada bloco da tela.
// Puro, e só importa ../brazilLookups.js (que não importa nada), porque a api/
// (desligar, cadastro) também lê. O equipeImports.test.js trava isso.
import { isValidCpf } from '../brazilLookups.js';

export const FUNCOES = Object.freeze(['consultor', 'gestor', 'professor']);

// A lista do Gestão 360, mais Sócio, que a planilha FINANCEIRO_STRONIX já usa.
export const VINCULOS = Object.freeze([
  { id: 'clt', label: 'CLT' },
  { id: 'estagio', label: 'Estágio' },
  { id: 'pj', label: 'PJ' },
  { id: 'socio', label: 'Sócio' },
  { id: 'temporario', label: 'Temporário' },
  { id: 'outro', label: 'Outro' },
]);
const VINCULO_IDS = new Set(VINCULOS.map((v) => v.id));
export const isVinculo = (v) => VINCULO_IDS.has(v);
export const vinculoTexto = (v) => VINCULOS.find((x) => x.id === v)?.label ?? 'Sem vínculo';
// Na lista e no cabeçalho, o vínculo Estágio diz quem é a pessoa.
export const vinculoSelo = (v) => (v === 'estagio' ? 'Estagiário' : vinculoTexto(v));

// A lista do Gestão 360, sem aposentadoria.
export const TIPOS_DESLIGAMENTO = Object.freeze([
  { id: 'pedido_demissao', label: 'Pedido de demissão' },
  { id: 'sem_justa_causa', label: 'Sem justa causa' },
  { id: 'justa_causa', label: 'Justa causa' },
  { id: 'acordo', label: 'Acordo' },
  { id: 'fim_contrato', label: 'Fim de contrato' },
  { id: 'outro', label: 'Outro' },
]);
const TIPO_IDS = new Set(TIPOS_DESLIGAMENTO.map((t) => t.id));
export const isTipoDesligamento = (v) => TIPO_IDS.has(v);
export const tipoDesligamentoTexto = (v) => TIPOS_DESLIGAMENTO.find((t) => t.id === v)?.label ?? 'Desligamento';

export const MOV = Object.freeze({ ADMISSAO: 'admissao', DESLIGAMENTO: 'desligamento', READMISSAO: 'readmissao' });
const ENTRADAS = new Set([MOV.ADMISSAO, MOV.READMISSAO]);

const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const isDia = (v) => typeof v === 'string' && DIA_RE.test(v);
const pad = (n) => String(n).padStart(2, '0');
// O dia de hoje no fuso do aparelho, em AAAA-MM-DD.
export const hojeIso = (agora = new Date()) => `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
export const dataBR = (iso) => (isDia(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

// "2 anos e 8 meses", "1 ano", "15 dias", "desde hoje". Vazio sem data.
export function tempoDeCasa(iso, agora = new Date()) {
  if (!isDia(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  let meses = (agora.getFullYear() - y) * 12 + (agora.getMonth() + 1 - m);
  if (agora.getDate() < d) meses -= 1;
  if (meses < 1) {
    const dias = Math.round((new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()) - new Date(y, m - 1, d)) / 864e5);
    if (dias <= 0) return 'desde hoje';
    return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anos) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  if (resto) partes.push(`${resto} ${resto === 1 ? 'mês' : 'meses'}`);
  return partes.join(' e ');
}

// Uma movimentação pronta para entrar na lista. registradoEm é texto ISO do
// relógio de quem grava, porque o Firestore não aceita serverTimestamp dentro
// de lista.
export function novaMovimentacao({ tipo, data, vinculo = null, tipoDesligamento = null, motivo = '', autor = null, agora = new Date() }) {
  const sai = tipo === MOV.DESLIGAMENTO;
  return {
    tipo,
    data,
    vinculo: !sai && isVinculo(vinculo) ? vinculo : null,
    tipoDesligamento: sai && isTipoDesligamento(tipoDesligamento) ? tipoDesligamento : null,
    motivo: sai ? String(motivo || '').trim().slice(0, 500) : '',
    registradoPor: { id: autor?.id ?? null, nome: autor?.nome ?? null },
    registradoEm: agora.toISOString(),
  };
}

const listaDe = (movs) => (Array.isArray(movs) ? movs : []);
export function indiceDaAdmissao(movs) {
  const lista = listaDe(movs);
  for (let i = lista.length - 1; i >= 0; i -= 1) if (ENTRADAS.has(lista[i]?.tipo)) return i;
  return -1;
}
export function admissaoDe(ficha) {
  const lista = listaDe(ficha?.movimentacoes);
  const i = indiceDaAdmissao(lista);
  return i >= 0 ? lista[i].data : null;
}

// A lista com a data da admissão de agora corrigida, ou com a primeira
// admissão quando não há nenhuma. Nunca apaga entrada.
export function comAdmissao(movs, data, { vinculo = null, autor = null, agora = new Date() } = {}) {
  const lista = listaDe(movs).slice();
  const i = indiceDaAdmissao(lista);
  if (i >= 0) {
    lista[i] = { ...lista[i], data };
    return lista;
  }
  return [...lista, novaMovimentacao({ tipo: MOV.ADMISSAO, data, vinculo, autor, agora })];
}

const tem = (v) => (typeof v === 'string' ? v.trim() !== '' : !!v);
const formadoProfessor = (pessoa) => pessoa?.funcao === 'professor' && pessoa?.ficha?.vinculo !== 'estagio';
// A foto do professor mora no cadastro do professor; a dos outros, na ficha.
export const fotoDe = (pessoa) => (pessoa?.professor ? pessoa.professor.photoUrl || null : pessoa?.ficha?.foto?.url || null);

// O anel e a linha "Falta:". Cada item diz o bloco onde é preenchido, e o id
// é o `name` do campo no formulário, para o atalho levar o cursor até ele.
export function faltasDaFicha(pessoa) {
  const f = pessoa?.ficha || {};
  const end = f.endereco || {};
  const itens = [
    ['foto', 'Foto', 'identidade', !!fotoDe(pessoa)],
    ['cpf', 'CPF', 'identidade', tem(f.cpf)],
    ['rg', 'RG', 'identidade', tem(f.rg)],
    ['nascimento', 'Nascimento', 'identidade', isDia(f.nascimento)],
    ['celular', 'Celular', 'contato', tem(f.celular)],
    ['emailPessoal', 'E-mail pessoal', 'contato', tem(f.emailPessoal)],
    ['endereco', 'Endereço', 'contato', tem(end.street) && tem(end.number) && tem(end.city)],
    ['vinculo', 'Vínculo', 'trabalho', isVinculo(f.vinculo)],
    ['admissao', 'Admissão', 'trabalho', !!admissaoDe(f)],
  ];
  if (formadoProfessor(pessoa)) itens.push(['cref', 'CREF', 'trabalho', tem(f.cref)]);
  return {
    total: itens.length,
    faltam: itens.filter((i) => !i[3]).map(([id, label, bloco]) => ({ id, label, bloco })),
  };
}

const ENDERECO = Object.freeze(['cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state']);

// O formulário de um bloco, lido da ficha (ou do login e do professor, para
// quem ainda não tem ficha).
export function formDoBloco(bloco, pessoa) {
  const f = pessoa?.ficha || {};
  if (bloco === 'identidade') {
    return { nome: f.nome || pessoa?.nome || '', cpf: f.cpf || '', rg: f.rg || '', nascimento: f.nascimento || '' };
  }
  if (bloco === 'contato') {
    const end = f.endereco || {};
    return {
      celular: f.celular || '', emailPessoal: f.emailPessoal || '',
      ...Object.fromEntries(ENDERECO.map((k) => [k, end[k] || ''])),
    };
  }
  return {
    vinculo: f.vinculo || '', admissao: admissaoDe(f) || '', cref: f.cref || '',
    modalidadeIds: pessoa?.professor?.modalidadeIds ? [...pessoa.professor.modalidadeIds] : [],
  };
}

const so = (v) => String(v ?? '').trim();
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const recusa = (erro, campo) => ({ erro, campo });

// O que um bloco grava: { ficha, professor? } ou { erro, campo }. Cada bloco
// grava só as chaves dele, para uma aba não apagar o que a outra salvou.
// ctx: { pessoa, autor, agora, professores }.
export function patchDoBloco(bloco, form, ctx = {}) {
  const { pessoa = null, autor = null, agora = new Date(), professores = [] } = ctx;
  const hoje = hojeIso(agora);

  if (bloco === 'identidade') {
    const nome = so(form.nome).replace(/\s+/g, ' ');
    if (!nome) return recusa('Escreva o nome completo.', 'nome');
    if (nome.length > 120) return recusa('O nome passa de 120 letras.', 'nome');
    if (pessoa?.professor) {
      const igual = (professores || []).find((p) => p?.id !== pessoa.professor.id && so(p?.nome).toLowerCase() === nome.toLowerCase());
      if (igual) return recusa(`Já existe um professor com o nome "${nome}".`, 'nome');
    }
    const cpf = digitos(form.cpf);
    if (cpf && !isValidCpf(cpf)) return recusa('CPF inválido.', 'cpf');
    const nascimento = so(form.nascimento);
    if (nascimento && (!isDia(nascimento) || nascimento > hoje || nascimento < '1900-01-01')) {
      return recusa('Data de nascimento inválida.', 'nascimento');
    }
    return { ficha: { nome, cpf, rg: so(form.rg).slice(0, 30), nascimento } };
  }

  if (bloco === 'contato') {
    const celular = digitos(form.celular);
    if (celular && (celular.length < 10 || celular.length > 11)) return recusa('Celular com DDD, 10 ou 11 números.', 'celular');
    const emailPessoal = so(form.emailPessoal).toLowerCase();
    if (emailPessoal && !EMAIL_RE.test(emailPessoal)) return recusa('E-mail inválido.', 'emailPessoal');
    const endereco = Object.fromEntries(ENDERECO.map((k) => [k, so(form[k])]));
    const vazio = ENDERECO.every((k) => !endereco[k]);
    return { ficha: { celular, emailPessoal, endereco: vazio ? null : endereco } };
  }

  if (bloco === 'trabalho') {
    const vinculo = so(form.vinculo);
    if (!isVinculo(vinculo)) return recusa('Escolha o vínculo.', 'vinculo');
    const admissao = so(form.admissao);
    if (!isDia(admissao) || admissao > hoje) return recusa('A admissão precisa ser hoje ou antes.', 'admissao');
    const professor = pessoa?.funcao === 'professor';
    const cref = professor && vinculo !== 'estagio' ? so(form.cref).slice(0, 20) || null : null;
    return {
      ficha: { vinculo, cref, movimentacoes: comAdmissao(pessoa?.ficha?.movimentacoes, admissao, { vinculo, autor, agora }) },
      professor: pessoa?.professor ? { modalidadeIds: Array.isArray(form.modalidadeIds) ? [...form.modalidadeIds] : [] } : null,
    };
  }

  return recusa('Bloco desconhecido.', null);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeFicha.test.js`
Expected: PASS. Se o teste do CPF inválido falhar, confira que `isValidCpf` de `src/lib/brazilLookups.js` recebe dígitos (é o que o cadastro do cliente passa).

- [ ] **Step 5: Commit**

```bash
git add src/lib/equipe/ficha.js src/lib/__tests__/equipeFicha.test.js
git commit -m "feat: regras da ficha da equipe"
```

---

### Task 3: A lista, em `src/lib/equipe/equipe.js`

**Files:**
- Create: `src/lib/equipe/equipe.js`
- Create: `src/lib/__tests__/equipeLista.test.js`
- Create: `src/lib/__tests__/equipeImports.test.js`

- [ ] **Step 1: Escrever os testes**

```js
// src/lib/__tests__/equipeLista.test.js
import { describe, it, expect } from 'vitest';
import { montarEquipe, filtrarEquipe, ACESSOS } from '../equipe/equipe.js';

const AGORA = new Date(2026, 10, 26, 10, 0);
const users = [
  { id: 'u-gestor', name: 'Johnny', role: 'admin', authUid: 'u-gestor' },
  { id: 'u-camila', name: 'Camila', role: 'consultant', authUid: 'u-camila' },
  { id: 'u-diego', name: 'Diego', role: 'professor', professorId: 'p-diego', authUid: 'u-diego' },
];
const professores = [
  { id: 'p-diego', nome: 'Diego Viana', modalidadeIds: ['m'] },
  { id: 'p-marina', nome: 'Marina Prado', modalidadeIds: ['m'] },
  { id: 'p-velho', nome: 'Rui', ativo: false },
];

describe('montarEquipe', () => {
  it('sem ficha nenhuma: um por login e um por professor sem login, em ordem de nome', () => {
    const pessoas = montarEquipe({ fichas: [], users, professores, agora: AGORA });
    expect(pessoas.map((p) => [p.id, p.funcao, p.acesso])).toEqual([
      ['u-camila', 'consultor', 'com'],
      ['u-diego', 'professor', 'com'],
      ['u-gestor', 'gestor', 'com'],
      ['p-marina', 'professor', 'sem'],
      ['p-velho', 'professor', 'desligado'],
    ]);
    const diego = pessoas.find((p) => p.id === 'u-diego');
    expect(diego.professor.id).toBe('p-diego');
    expect(diego.nome).toBe('Diego');
  });

  it('a ficha pega o login e o professor, e o nome da ficha manda', () => {
    const fichas = [{ id: 'u-diego', userId: 'u-diego', professorId: 'p-diego', nome: 'Diego Viana Lopes', status: 'ativo' }];
    const pessoas = montarEquipe({ fichas, users, professores, agora: AGORA });
    expect(pessoas.filter((p) => p.professor?.id === 'p-diego')).toHaveLength(1);
    expect(pessoas.find((p) => p.id === 'u-diego').nome).toBe('Diego Viana Lopes');
  });

  it('ficha de professor sem login acha o login novo pelo professor', () => {
    const fichas = [{ id: 'p-diego', professorId: 'p-diego', status: 'ativo' }];
    const pessoas = montarEquipe({ fichas, users, professores, agora: AGORA });
    const diego = pessoas.find((p) => p.id === 'p-diego');
    expect(diego.user.id).toBe('u-diego');
    expect(pessoas.some((p) => p.id === 'u-diego')).toBe(false);
  });

  it('desligada pela ficha; convite que venceu vira sem acesso', () => {
    const fichas = [
      { id: 'f-carla', funcao: 'consultor', nome: 'Carla', status: 'desligado' },
      { id: 'f-bruna', funcao: 'consultor', nome: 'Bruna', status: 'ativo', convite: { email: 'b@x.com', papel: 'consultant', expiraEm: '2026-12-01T00:00:00.000Z' } },
      { id: 'f-rita', funcao: 'consultor', nome: 'Rita', status: 'ativo', convite: { email: 'r@x.com', papel: 'consultant', expiraEm: '2026-11-01T00:00:00.000Z' } },
    ];
    const por = Object.fromEntries(montarEquipe({ fichas, users: [], professores: [], agora: AGORA }).map((p) => [p.id, p]));
    expect(por['f-carla']).toMatchObject({ desligada: true, acesso: 'desligado' });
    expect(por['f-bruna'].acesso).toBe('convite');
    expect(por['f-rita'].acesso).toBe('sem');
  });

  it('ficha com userId de login que sumiu fica sem acesso, com a função da ficha', () => {
    const fichas = [{ id: 'u-sumiu', userId: 'u-sumiu', funcao: 'consultor', nome: 'Léo', status: 'ativo' }];
    const [leo] = montarEquipe({ fichas, users: [], professores: [], agora: AGORA });
    expect(leo).toMatchObject({ funcao: 'consultor', acesso: 'sem', user: null });
  });

  it('ignora entrada sem id', () => {
    expect(montarEquipe({ fichas: [null, {}], users: [null], professores: [{}], agora: AGORA })).toEqual([]);
  });
});

describe('filtrarEquipe', () => {
  const pessoas = montarEquipe({
    fichas: [{ id: 'p-marina', professorId: 'p-marina', vinculo: 'estagio', status: 'ativo' }],
    users, professores, agora: AGORA,
  });
  it('ativos por padrão, desligados à parte', () => {
    expect(filtrarEquipe(pessoas, {}).some((p) => p.desligada)).toBe(false);
    expect(filtrarEquipe(pessoas, { situacao: 'desligados' }).map((p) => p.id)).toEqual(['p-velho']);
  });
  it('função, vínculo, acesso e busca sem acento', () => {
    expect(filtrarEquipe(pessoas, { funcao: 'professor' }).map((p) => p.id)).toEqual(['u-diego', 'p-marina']);
    expect(filtrarEquipe(pessoas, { vinculo: 'estagio' }).map((p) => p.id)).toEqual(['p-marina']);
    expect(filtrarEquipe(pessoas, { acesso: 'sem' }).map((p) => p.id)).toEqual(['p-marina']);
    expect(filtrarEquipe(pessoas, {}, 'MARÍ').map((p) => p.id)).toEqual(['p-marina']);
  });
  it('os acessos da pílula', () => {
    expect(ACESSOS).toEqual(['com', 'convite', 'sem']);
  });
});
```

```js
// src/lib/__tests__/equipeImports.test.js
// A api/ lê src/lib/equipe/ficha.js e equipe.js: nenhum dos dois pode chegar a
// pacote, a firebase.js ou a dailyGoal.js (que traz lucide-react).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const importsDe = (rel) => [...readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  .matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('imports da equipe', () => {
  it('ficha.js só importa brazilLookups', () => {
    expect(importsDe('../equipe/ficha.js')).toEqual(['../brazilLookups.js']);
  });
  it('equipe.js só importa acesso e ficha', () => {
    expect(importsDe('../equipe/equipe.js').sort()).toEqual(['../acesso.js', './ficha.js']);
  });
  it('brazilLookups.js não importa nada', () => {
    expect(importsDe('../brazilLookups.js')).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeLista.test.js src/lib/__tests__/equipeImports.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/equipe/equipe.js`**

```js
// A lista da equipe: junta as fichas (stronix_equipe), os logins
// (stronix_users) e os professores (stronix_professores). Puro, só importa
// ../acesso.js e ./ficha.js, porque a api/ também lê. Spec
// docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md, "Quem é quem
// na lista".
import { ROLES, isProfessor, roleOf } from '../acesso.js';
import { FUNCOES } from './ficha.js';

export const ACESSOS = Object.freeze(['com', 'convite', 'sem']);

const FUNCAO_DO_PAPEL = Object.freeze({
  [ROLES.GESTOR]: 'gestor',
  [ROLES.CONSULTOR]: 'consultor',
  [ROLES.PROFESSOR]: 'professor',
});

function conviteValido(convite, agora) {
  const ate = Date.parse(convite?.expiraEm || '');
  return Number.isFinite(ate) && ate > agora.getTime();
}

function pessoa({ id, ficha, user, professor, agora }) {
  const funcao = user
    ? FUNCAO_DO_PAPEL[roleOf(user)]
    : (FUNCOES.includes(ficha?.funcao) ? ficha.funcao : (professor ? 'professor' : 'consultor'));
  const nome = ficha?.nome || user?.name || professor?.nome || '';
  const desligada = ficha ? ficha.status === 'desligado' : (!user && professor?.ativo === false);
  let acesso = 'sem';
  if (desligada) acesso = 'desligado';
  else if (user) acesso = 'com';
  else if (ficha?.convite && conviteValido(ficha.convite, agora)) acesso = 'convite';
  return { id, ficha: ficha || null, user: user || null, professor: professor || null, funcao, nome, desligada, acesso };
}

// [{ id, ficha, user, professor, funcao, nome, desligada, acesso }], em ordem
// de nome. O id é o da ficha; sem ficha, o do login ou o do professor, que é o
// id com que a ficha nasce na primeira gravação.
export function montarEquipe({ fichas = [], users = [], professores = [], agora = new Date() } = {}) {
  const validos = (lista) => (lista || []).filter((x) => x && typeof x.id === 'string' && x.id);
  const us = validos(users);
  const ps = validos(professores);
  const userPorId = new Map(us.map((u) => [u.id, u]));
  const profPorId = new Map(ps.map((p) => [p.id, p]));
  const loginDoProfessor = new Map(us.filter((u) => isProfessor(u) && u.professorId).map((u) => [u.professorId, u]));
  const usadosU = new Set();
  const usadosP = new Set();
  const out = [];

  for (const ficha of validos(fichas)) {
    const user = (ficha.userId && userPorId.get(ficha.userId))
      || (ficha.professorId && loginDoProfessor.get(ficha.professorId))
      || null;
    const profId = ficha.professorId || (user && isProfessor(user) ? user.professorId : null);
    const professor = (profId && profPorId.get(profId)) || null;
    if (user) usadosU.add(user.id);
    if (professor) usadosP.add(professor.id);
    out.push(pessoa({ id: ficha.id, ficha, user, professor, agora }));
  }
  for (const user of us) {
    if (usadosU.has(user.id)) continue;
    const prof = isProfessor(user) && user.professorId && !usadosP.has(user.professorId) ? profPorId.get(user.professorId) : null;
    if (prof) usadosP.add(prof.id);
    out.push(pessoa({ id: user.id, ficha: null, user, professor: prof || null, agora }));
  }
  for (const professor of ps) {
    if (usadosP.has(professor.id)) continue;
    out.push(pessoa({ id: professor.id, ficha: null, user: null, professor, agora }));
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Recorte da lista: { situacao: 'ativos' | 'desligados', funcao, vinculo,
// acesso } (null é todos) e o texto da busca, sem acento.
export function filtrarEquipe(pessoas, { situacao = 'ativos', funcao = null, vinculo = null, acesso = null } = {}, busca = '') {
  const q = semAcento(busca).trim();
  return (pessoas || []).filter((p) => (situacao === 'desligados' ? p.desligada : !p.desligada)
    && (!funcao || p.funcao === funcao)
    && (!vinculo || p.ficha?.vinculo === vinculo)
    && (!acesso || p.acesso === acesso)
    && (!q || semAcento(p.nome).includes(q)));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeLista.test.js src/lib/__tests__/equipeImports.test.js`
Expected: PASS. Se o teste de `brazilLookups.js` falhar, o arquivo ganhou import: troque o `isValidCpf` da ficha pelo de `src/lib/clientImport.js` (que recebe dígitos) e ajuste o teste de imports.

- [ ] **Step 5: Commit**

```bash
git add src/lib/equipe/equipe.js src/lib/__tests__/equipeLista.test.js src/lib/__tests__/equipeImports.test.js
git commit -m "feat: junção da lista da equipe"
```

---

### Task 4: A ficha no endereço, e o id fora do Sentry

**Files:**
- Modify: `src/lib/routes.js` (`readScreen`, perto da linha 216; `hrefFor`, linha ~319)
- Modify: `src/lib/appShell.js` (`screenState`, linha ~47)
- Modify: `src/lib/sentryScrub.js` (linhas 115 a 124)
- Test: `src/lib/__tests__/routes.test.js`, `src/lib/__tests__/appShell.test.js`, `src/lib/__tests__/sentryScrub.test.js`

- [ ] **Step 1: Escrever os testes**

No fim de `src/lib/__tests__/routes.test.js`:

```js
describe('ficha da equipe nas Configurações', () => {
  it('lê o id e a aba', () => {
    expect(parseAppPath('/stronix-crm-app/configuracoes/equipe/u-123')).toMatchObject({ screen: 'settings', sub: 'team', pessoaId: 'u-123', pessoaAba: 'dados', subUnknown: false });
    expect(parseAppPath('/stronix-crm-app/configuracoes/equipe/u-123/acesso')).toMatchObject({ pessoaId: 'u-123', pessoaAba: 'acesso' });
    expect(parseAppPath('/stronix-crm-app/configuracoes/equipe/u-123/movimentacoes').pessoaAba).toBe('movimentacoes');
  });
  it('aba desconhecida ou segmento a mais abre a lista', () => {
    const r = parseAppPath('/stronix-crm-app/configuracoes/equipe/u-123/xyz');
    expect(r).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(r.pessoaId).toBeUndefined();
  });
  it('a lista continua a seção de sempre', () => {
    const r = parseAppPath('/stronix-crm-app/configuracoes/equipe');
    expect(r).toMatchObject({ screen: 'settings', sub: 'team' });
    expect(r.pessoaId).toBeUndefined();
  });
  it('monta o endereço da ficha e da aba', () => {
    expect(hrefFor('stronix-crm-app', 'settings', { sub: 'team', pessoaId: 'u-123' })).toBe('/stronix-crm-app/configuracoes/equipe/u-123');
    expect(hrefFor('stronix-crm-app', 'settings', { sub: 'team', pessoaId: 'u-123', pessoaAba: 'acesso' })).toBe('/stronix-crm-app/configuracoes/equipe/u-123/acesso');
    expect(hrefFor('stronix-crm-app', 'settings', { sub: 'team', pessoaId: 'u-123', pessoaAba: 'dados' })).toBe('/stronix-crm-app/configuracoes/equipe/u-123');
    expect(hrefFor('stronix-crm-app', 'settings', { sub: 'team', pessoaId: '' })).toBe('/stronix-crm-app/configuracoes/equipe');
  });
  it('abrir a ficha não troca a chave da tela, para as Configurações não remontarem', () => {
    expect(screenKey(parseAppPath('/stronix-crm-app/configuracoes/equipe/u-123'))).toBe('settings');
  });
  it('o nome da transação não leva o id', () => {
    expect(routeTemplate('/stronix-crm-app/configuracoes/equipe/u-123')).toBe('/:tenant/configuracoes');
  });
});
```

Confira que `parseAppPath`, `hrefFor`, `screenKey` e `routeTemplate` estão no import do topo do arquivo; se algum faltar, acrescente.

No fim de `src/lib/__tests__/appShell.test.js`:

```js
describe('screenState: ficha da equipe', () => {
  it('passa o id e a aba só nas Configurações', () => {
    const shown = parseAppPath('/stronix-crm-app/configuracoes/equipe/u-123/acesso');
    expect(screenState(shown, null, { role: 'admin' })).toMatchObject({ sub: 'team', pessoaId: 'u-123', pessoaAba: 'acesso' });
    expect(screenState(parseAppPath('/stronix-crm-app/pipeline'), null, { role: 'admin' })).toMatchObject({ pessoaId: null, pessoaAba: null });
  });
});
```

(Acrescente `parseAppPath` ao import de `../routes.js` se o arquivo ainda não o importa.)

Em `src/lib/__tests__/sentryScrub.test.js`, junto dos testes do `/rotinas/modelos/`, pela mesma função que eles usam:

```js
it('troca o id da ficha da equipe', () => {
  expect(scrubLeadPath('/stronix-crm-app/configuracoes/equipe/u-123/acesso'))
    .toBe('/stronix-crm-app/configuracoes/equipe/:pessoaId/acesso');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/sentryScrub.test.js`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar**

Em `src/lib/routes.js`, logo antes de `export const SETTINGS_SECTIONS` (linha ~30):

```js
// Abas da ficha da equipe (/configuracoes/equipe/<id>/<aba>). Dados é o
// padrão e não vai para o endereço.
export const PESSOA_ABAS = Object.freeze({ dados: '', movimentacoes: 'movimentacoes', acesso: 'acesso' });
const PESSOA_ABA_BY_SEGMENT = Object.freeze({ movimentacoes: 'movimentacoes', acesso: 'acesso' });
```

Em `readScreen`, logo depois do bloco `if (head === 'rotinas') { ... }`:

```js
  if (head === 'configuracoes' && lower(segs[1]) === SETTINGS_SECTIONS.team && segs.length >= 3) {
    // A ficha da equipe é sub-tela das Configurações, como o modelo de rotina:
    // a tela continua 'settings', então o SettingsView não remonta (ele lê a
    // base de leads ao montar). Id inválido ou aba desconhecida abre a lista.
    out.screen = 'settings';
    out.rest = segs.slice(1);
    const aba = segs.length === 3 ? 'dados' : (segs.length === 4 ? PESSOA_ABA_BY_SEGMENT[lower(segs[3])] ?? null : null);
    if (isValidLeadId(segs[2]) && aba) {
      out.sub = 'team';
      out.pessoaId = segs[2];
      out.pessoaAba = aba;
    } else {
      out.subUnknown = true;
    }
    return;
  }
```

Em `hrefFor`, troque a desestruturação da primeira linha por:

```js
  const { leadId, superTab, sub, modelId, profId, pessoaId, pessoaAba } = opts || {};
```

e, logo antes do `return` final (`return \`${base}/${SCREENS[screen].segs.join('/')}${trecho}\`;`):

```js
  if (screen === 'settings' && sub === 'team') {
    const pid = isValidLeadId(pessoaId) ? encode(pessoaId) : null;
    if (pid !== null) {
      const aba = own(PESSOA_ABAS, pessoaAba) && PESSOA_ABAS[pessoaAba] ? `/${PESSOA_ABAS[pessoaAba]}` : '';
      return `${base}/configuracoes/${SETTINGS_SECTIONS.team}/${pid}${aba}`;
    }
  }
```

Em `src/lib/appShell.js`, no objeto que `screenState` devolve, depois de `profId: ...`:

```js
    pessoaId: shown?.screen === 'settings' ? (shown.pessoaId ?? null) : null,
    pessoaAba: shown?.screen === 'settings' ? (shown.pessoaAba ?? null) : null,
```

Em `src/lib/sentryScrub.js`, depois de `const MODEL_PATH_RE = ...`:

```js
// Id da ficha da equipe (/configuracoes/equipe/<id>): é o id do login ou do
// professor, e não vai para o Sentry.
const EQUIPE_PATH_RE = /(\/configuracoes\/equipe\/)[^/?#\s"'<>]+/gi;
```

e na linha da troca (`return text.replace(LEAD_PATH_RE, ...)...`), acrescente no fim da cadeia:

```js
.replace(EQUIPE_PATH_RE, '$1:pessoaId')
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/routes.decision.test.js`
Expected: PASS. Se a decisão de rota reclamar da sub-tela, confira que o caso de id inválido marca `subUnknown` e não `unknown`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routes.js src/lib/appShell.js src/lib/sentryScrub.js src/lib/__tests__/routes.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/sentryScrub.test.js
git commit -m "feat: endereço da ficha da equipe"
```

---

### Task 5: Filtros da lista no endereço

**Files:**
- Modify: `src/lib/screenParams.js` (imports no topo e `TABELA`, linha ~389)
- Test: `src/lib/__tests__/screenParams.test.js`

- [ ] **Step 1: Escrever o teste**

No fim de `src/lib/__tests__/screenParams.test.js`:

```js
describe('Equipe & acessos', () => {
  it('ausente é ativos e todos; valor de fora cai no padrão', () => {
    expect(readScreenParams('settings', '')).toEqual({ situacao: 'ativos', funcao: null, vinculo: null, acesso: null });
    expect(readScreenParams('settings', '?sit=xyz&funcao=dono&vinculo=nada&acesso=talvez'))
      .toEqual({ situacao: 'ativos', funcao: null, vinculo: null, acesso: null });
  });
  it('lê e escreve os quatro, sem escrever o padrão', () => {
    const q = '?sit=desligados&funcao=professor&vinculo=estagio&acesso=sem';
    const v = readScreenParams('settings', q);
    expect(v).toEqual({ situacao: 'desligados', funcao: 'professor', vinculo: 'estagio', acesso: 'sem' });
    expect(screenParamsQuery('settings', v)).toBe(q);
    expect(screenParamsQuery('settings', { situacao: 'ativos', funcao: null, vinculo: null, acesso: null })).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js`
Expected: FAIL (`settings` sem tabela devolve `{}`).

- [ ] **Step 3: Implementar**

No topo de `src/lib/screenParams.js`, junto dos outros imports:

```js
import { FUNCOES, VINCULOS } from './equipe/ficha.js';
import { ACESSOS } from './equipe/equipe.js';
```

Antes de `const TABELA = {`:

```js
// Equipe & acessos (Configurações → Equipe). Ausente é Ativos e todas as
// funções, vínculos e acessos. A busca pelo nome nunca vai para o endereço.
const umDe = (campo, valores) => param(campo, (raw) => (valores.includes(raw) ? raw : null), (v) => (valores.includes(v) ? v : null));
const situacaoEquipe = param('situacao', (raw) => (raw === 'desligados' ? 'desligados' : 'ativos'), (v) => (v === 'desligados' ? 'desligados' : null));
```

Na `TABELA`, depois de `professorPerfil: { ciclo },`:

```js
  settings: {
    sit: situacaoEquipe,
    funcao: umDe('funcao', FUNCOES),
    vinculo: umDe('vinculo', VINCULOS.map((v) => v.id)),
    acesso: umDe('acesso', ACESSOS),
  },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: PASS. Se a varredura de filtros pedir que a tela use `useScreenParams`, ela passa a usar na Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/lib/screenParams.js src/lib/__tests__/screenParams.test.js
git commit -m "feat: filtros da equipe no endereço"
```

---

### Task 6: Leitura e gravação da ficha no app

**Files:**
- Create: `src/hooks/useEquipeFichas.js`
- Create: `src/lib/equipe/equipeWrites.js`
- Modify: `src/lib/__tests__/historicoDoProfessor.sweep.test.js` (`REVISADOS`)
- Test: `src/lib/__tests__/equipeWrites.test.js`

- [ ] **Step 1: Escrever o teste da gravação**

```js
// src/lib/__tests__/equipeWrites.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chamadas = vi.hoisted(() => ({ set: [], update: [], lotes: [] }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...partes) => ({ caminho: partes.join('/') }),
  setDoc: async (ref, dados, opcoes) => { chamadas.set.push({ caminho: ref.caminho, dados, opcoes }); },
  updateDoc: async (ref, dados) => { chamadas.update.push({ caminho: ref.caminho, dados }); },
  serverTimestamp: () => 'agora',
  collection: (_db, ...partes) => ({ caminho: partes.join('/') }),
  query: (c, f) => ({ ...c, f }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  getDocs: async () => ({ empty: false, docs: [{ id: 'lead-1' }] }),
}));
vi.mock('firebase/storage', () => ({ ref: () => ({}), uploadBytes: async () => {}, getDownloadURL: async () => 'u', deleteObject: async () => {} }));
vi.mock('../firebase.js', () => ({
  appId: 'acad', EQUIPE_PATH: 'stronix_equipe', USERS_PATH: 'stronix_users',
  PROFESSORS_PATH: 'stronix_professores', LEADS_PATH: 'stronix_leads', storage: {},
}));
vi.mock('../funnels.js', () => ({ commitOpsInChunks: async (_db, ops) => { chamadas.lotes.push(ops); } }));
vi.mock('../settingsLeads.js', () => ({ leadsWhere: async () => [{ id: 'lead-2' }] }));

const { gravarBloco, renomearPessoa } = await import('../equipe/equipeWrites.js');

beforeEach(() => { chamadas.set = []; chamadas.update = []; chamadas.lotes = []; });

describe('gravarBloco', () => {
  it('a primeira gravação cria a ficha com os vínculos, a função e o nome', async () => {
    const pessoa = { id: 'p-marina', ficha: null, user: null, professor: { id: 'p-marina' }, funcao: 'professor', nome: 'Marina' };
    await gravarBloco({}, pessoa, { celular: '51999990000' }, { id: 'g1' });
    expect(chamadas.set).toEqual([{
      caminho: 'artifacts/acad/public/data/stronix_equipe/p-marina',
      dados: {
        celular: '51999990000', userId: null, professorId: 'p-marina', funcao: 'professor', nome: 'Marina',
        status: 'ativo', createdAt: 'agora', updatedAt: 'agora', updatedBy: 'g1',
      },
      opcoes: { merge: true },
    }]);
  });
  it('depois, grava só o bloco', async () => {
    const pessoa = { id: 'f1', ficha: { id: 'f1' }, user: null, professor: null, funcao: 'consultor', nome: 'Ana' };
    await gravarBloco({}, pessoa, { rg: '1' }, { id: 'g1' });
    expect(chamadas.set[0].dados).toEqual({ rg: '1', updatedAt: 'agora', updatedBy: 'g1' });
  });
});

describe('renomearPessoa', () => {
  it('leva o nome ao login e ao professor, com as cópias dos leads', async () => {
    const pessoa = { id: 'u1', user: { id: 'u1', name: 'Di' }, professor: { id: 'p1', nome: 'Di' } };
    const mudou = await renomearPessoa({}, pessoa, 'Diego Viana');
    expect(mudou).toBe(true);
    expect(chamadas.update).toEqual([{ caminho: 'artifacts/acad/public/data/stronix_users/u1', dados: { name: 'Diego Viana' } }]);
    expect(chamadas.set[0]).toMatchObject({ caminho: 'artifacts/acad/public/data/stronix_professores/p1', dados: { nome: 'Diego Viana', updatedAt: 'agora' } });
    expect(chamadas.lotes.map((ops) => ops.map((o) => o.data))).toEqual([
      [{ consultantName: 'Diego Viana' }],
      [{ appointmentProfessorName: 'Diego Viana' }],
    ]);
  });
  it('nome igual não grava nada', async () => {
    expect(await renomearPessoa({}, { id: 'u1', user: { id: 'u1', name: 'Ana' }, professor: null }, 'Ana')).toBe(false);
    expect(chamadas.update).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeWrites.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/equipe/equipeWrites.js`**

```js
// Gravações da ficha da equipe pelo app (o gestor, pelas regras do Firestore).
// A ficha nasce com o id da pessoa na primeira gravação (setDoc com merge),
// então duas abas caem no mesmo documento. Spec
// docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md.
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { appId, EQUIPE_PATH, LEADS_PATH, PROFESSORS_PATH, USERS_PATH, storage } from '../firebase.js';
import { commitOpsInChunks } from '../funnels.js';
import { leadsWhere } from '../settingsLeads.js';
import { isValidLeadId } from '../routes.js';

const docDe = (db, caminho, id) => doc(db, 'artifacts', appId, 'public', 'data', caminho, id);

// Grava os campos de um bloco. Na primeira gravação, a ficha ganha os vínculos
// com o login e o professor, a função, o nome e o status.
export async function gravarBloco(db, pessoa, campos, autor) {
  const nova = !pessoa.ficha;
  await setDoc(docDe(db, EQUIPE_PATH, pessoa.id), {
    ...campos,
    ...(nova ? {
      userId: pessoa.user?.id ?? null,
      professorId: pessoa.professor?.id ?? null,
      funcao: pessoa.funcao,
      nome: campos.nome ?? pessoa.nome,
      status: 'ativo',
      createdAt: serverTimestamp(),
    } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: autor?.id ?? null,
  }, { merge: true });
}

// As modalidades e a foto do professor, que moram no cadastro do professor.
export async function gravarProfessor(db, professorId, campos) {
  await setDoc(docDe(db, PROFESSORS_PATH, professorId), { ...campos, updatedAt: serverTimestamp() }, { merge: true });
}

// O nome novo vai também ao login e ao professor, com as cópias que já existem
// nos leads (consultantName e appointmentProfessorName). Devolve se algum lead
// mudou. Movido do TeamAccessSection (updateMember e saveProfessor).
export async function renomearPessoa(db, pessoa, nome) {
  let leadsMudaram = false;
  if (pessoa.user && pessoa.user.name !== nome) {
    await updateDoc(docDe(db, USERS_PATH, pessoa.user.id), { name: nome });
    const snap = await getDocs(query(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
      where('consultantId', '==', pessoa.user.id),
    ));
    if (!snap.empty) {
      await commitOpsInChunks(db, snap.docs.map((d) => ({ ref: docDe(db, LEADS_PATH, d.id), data: { consultantName: nome } })), 400);
      leadsMudaram = true;
    }
  }
  if (pessoa.professor && pessoa.professor.nome !== nome) {
    await setDoc(docDe(db, PROFESSORS_PATH, pessoa.professor.id), { nome, updatedAt: serverTimestamp() }, { merge: true });
    const leads = await leadsWhere(db, 'appointmentProfessorId', '==', pessoa.professor.id);
    if (leads.length) {
      await commitOpsInChunks(db, leads.map((l) => ({ ref: docDe(db, LEADS_PATH, l.id), data: { appointmentProfessorName: nome } })), 400);
      leadsMudaram = true;
    }
  }
  return leadsMudaram;
}

// Foto de quem não é professor (a do professor mora no cadastro do professor,
// pelo src/lib/professorPhoto.js). Mesmo processamento da foto do lead.
export function equipeFotoPath(id) {
  if (!appId || !isValidLeadId(id)) throw new Error('Pessoa inválida para a foto.');
  return `tenants/${appId}/equipe/${id}/avatar.jpg`;
}
export async function subirFotoDaEquipe(id, blob) {
  const caminho = equipeFotoPath(id);
  const alvo = storageRef(storage, caminho);
  await uploadBytes(alvo, blob, { contentType: 'image/jpeg' });
  return { url: await getDownloadURL(alvo), path: caminho };
}
export async function apagarFotoDaEquipe(caminho) {
  if (!caminho) return;
  try {
    await deleteObject(storageRef(storage, caminho));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
```

- [ ] **Step 4: Implementar `src/hooks/useEquipeFichas.js`**

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, EQUIPE_PATH } from '../lib/firebase.js';

// As fichas da equipe, ao vivo. Só o gestor lê (regra de stronix_equipe), e só
// a tela Equipe & acessos assina. A academia entra na chave do estado porque o
// "Acessar como" troca de academia sem desmontar a tela.
export function useEquipeFichas(db) {
  const [estado, setEstado] = useState({ chave: null, fichas: [], erro: null });
  const chave = db ? appId : null;
  useEffect(() => {
    if (!db) return undefined;
    const academia = appId;
    return onSnapshot(
      collection(db, 'artifacts', academia, 'public', 'data', EQUIPE_PATH),
      (snap) => setEstado({ chave: academia, fichas: snap.docs.map((d) => ({ id: d.id, ...d.data() })), erro: null }),
      (erro) => {
        console.error('Erro ao ler as fichas da equipe:', erro?.code || erro);
        setEstado({ chave: academia, fichas: [], erro });
      },
    );
  }, [db]);
  const pronto = estado.chave === chave;
  return { fichas: pronto ? estado.fichas : [], pronto, erro: pronto ? estado.erro : null };
}
```

- [ ] **Step 5: Marcar os arquivos novos na varredura do histórico do professor**

Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, no objeto `REVISADOS`, depois da linha de `'src/views/settings/TeamAccessSection.jsx'`:

```js
  // Ficha da equipe (stronix_equipe) e a junção da lista, não o lead.
  'src/lib/equipe/equipe.js': 'ficha da equipe',
  'src/lib/equipe/equipeWrites.js': 'ficha da equipe',
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeWrites.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js`
Expected: PASS. Se a varredura apontar outro arquivo novo com `professorId` como chave, acrescente-o ao `REVISADOS` com o motivo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/equipe/equipeWrites.js src/hooks/useEquipeFichas.js src/lib/__tests__/equipeWrites.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git commit -m "feat: leitura e gravação da ficha da equipe"
```

---

### Task 7: O diálogo de editar acesso, movido

O diálogo de editar membro de hoje sai do `TeamAccessSection.jsx` para um arquivo próprio, com a mesma regra. O campo Nome sai dele: o nome passa a ser editado no bloco Identidade da ficha, que leva o nome ao login e ao professor.

**Files:**
- Create: `src/views/settings/equipe/EditarAcessoDialog.jsx`
- Create: `src/views/settings/equipe/ProfessorPicker.jsx`
- Modify: `src/views/settings/TeamAccessSection.jsx`
- Modify: `src/lib/__tests__/teamAccessEmail.test.js`, `src/lib/__tests__/teamAccessProfessor.test.js`

- [ ] **Step 1: Mover o `ProfessorPicker`**

Recorte a função `ProfessorPicker` de `src/views/settings/TeamAccessSection.jsx` (linhas 186 a 202) para `src/views/settings/equipe/ProfessorPicker.jsx`, com `export function ProfessorPicker`, e os imports `DialogField` e `FIELD_INPUT` de `'../settingsBits.jsx'`. No `TeamAccessSection.jsx`, importe de `./equipe/ProfessorPicker.jsx`.

- [ ] **Step 2: Criar `src/views/settings/equipe/EditarAcessoDialog.jsx`**

Recorte do `TeamAccessSection.jsx` atual, sem mudar a regra: `confirmExtra` (linhas 280 a 282), `authHeader` (284 a 287), `changeRole` (341 a 365), `updateMember` (367 a 484) e o `<FormDialog>` "Cadastro / edição de membro" (753 a 834) só com o modo edição. Mudanças, e só estas:

1. Sem o `DialogField` "Nome" (linhas 768 a 770) e, no `updateMember`, sem `const newName`, sem `name: newName` no `updateDoc` e sem o bloco da cópia em `consultantName` (linhas 444 a 458): isso agora é do `renomearPessoa`, no bloco Identidade.
2. `target` é a prop `user`. `setMemberDialog(null)` vira `onOpenChange(false)`.
3. O título é `` `Editar o acesso de ${user.name}` `` e a descrição continua "O authUid é gerado no cadastro e não muda. Preencha a nova senha só se quiser redefini-la.".
4. `showRoleField` é `!isGestor(user) && (professorEnabled || isProfessor(user))`; `memberProfessorOptions` é `availableProfessors(professores, usersList, { exceptUserId: user.id, keepId: user.professorId ?? null })`.
5. O formulário reinicia a cada abertura, por estado derivado no render (o lint reprova `setState` dentro de efeito):

```jsx
import { useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { auth, appId, USERS_PATH } from '../../../lib/firebase.js';
import { generateTemporaryPassword, passwordPolicyError, PASSWORD_RULE_TEXT } from '../../../lib/passwordPolicy.js';
import { isGestor, isProfessor, roleLabel, roleOf, ROLES } from '../../../lib/acesso.js';
import { hasModule, MODULES } from '../../../lib/modules.js';
import { availableProfessors, planRoleChange, PROFESSOR_LINK_MESSAGES, SET_ROLE_ACTION } from '../../../lib/teamRoles.js';
import { planLoginEmailChange, loginEmailConfirmText, LOGIN_EMAIL_FAILED_MESSAGE } from '../../../lib/loginEmail.js';
import { cn } from '../../../lib/utils.js';
import { useGeneralConfig } from '../../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { DialogField, FIELD_INPUT, FormDialog, SettingsBtn } from '../settingsBits.jsx';
import { ProfessorPicker } from './ProfessorPicker.jsx';

const normalizeUid = (v) => String(v || '').trim();
const formDe = (user) => ({
  email: user?.email || '', password: '', shiftStart: user?.shiftStart || '', shiftEnd: user?.shiftEnd || '',
  dailyVolumeTarget: user?.dailyVolumeTarget != null ? String(user.dailyVolumeTarget) : '',
  role: roleOf(user), professorId: user?.professorId || '',
});

// O diálogo de editar o acesso (papel, e-mail de login, senha, turno e meta de
// prospecção), aberto pela aba Acesso ao app da ficha. A regra é a de antes do
// cadastro da equipe; o nome saiu daqui e mora no bloco Identidade.
export function EditarAcessoDialog({ db, appUser, user, usersList, open, onOpenChange }) {
  const toast = useToast();
  const { professores } = useGeneralConfig();
  const professorEnabled = hasModule(appUser?.tenantModules, MODULES.FALTOSOS);
  const [abertoPara, setAbertoPara] = useState(null);
  const [form, setForm] = useState(() => formDe(user));
  const [saving, setSaving] = useState(false);
  if (open && abertoPara !== user?.id) { setAbertoPara(user?.id ?? null); setForm(formDe(user)); }
  if (!open && abertoPara !== null) setAbertoPara(null);

  // confirmExtra, authHeader, changeRole e updateMember: recortados do
  // TeamAccessSection, com as mudanças 1 e 2 acima.

  // <FormDialog open={open} onOpenChange={onOpenChange} title={`Editar o acesso de ${user.name}`} ...>
  //   o resto dos campos de hoje, sem "Nome".
}
```

- [ ] **Step 3: Apontar os testes para o diálogo**

Em `src/lib/__tests__/teamAccessEmail.test.js`:

1. Troque o import de `TeamAccessSection` por `import { EditarAcessoDialog } from '../../views/settings/equipe/EditarAcessoDialog.jsx';`.
2. Troque `montar` e `editar` (linhas 73 a 80 e 104 a 108) por:

```js
async function editar(membro, appUser = GESTOR) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(EditarAcessoDialog, { db: {}, appUser, user: membro, usersList: EQUIPE, open: true, onOpenChange: () => {} }));
  });
  expect(campoEmail().value).toBe(membro.email);
}
```

3. Apague as chamadas `await montar(...)` antes de `editar(...)`; onde o teste montava com outro usuário, passe-o como segundo argumento de `editar`.
4. Apague as duas linhas `await escrever(campoNome(), 'Ana Duarte');` (~142 e ~180) e o `const campoNome` (~102). Onde a gravação esperada tinha `name`, tire a chave `name` do objeto esperado.
5. Apague o teste "no cadastro de consultor, não mostra a dica" (~243): o cadastro continua no `TeamAccessSection` até o PR 2 e já é coberto pelo `teamAccessProfessor.test.js`.

Em `src/lib/__tests__/teamAccessProfessor.test.js`, os testes de edição (`editar: professor que volta a consultor...`, `set-role recusado...`, os dois `vagas cheias: ...`, `editar: consultor que vira professor...`, `o gestor não tem campo de papel`) passam a montar o `EditarAcessoDialog` do mesmo jeito, dentro do `GeneralConfigContext.Provider` de hoje, com `user: EQUIPE[i]` no lugar de `montar()` mais `editar(i)`. Os testes de lista ("a lista mostra o papel de cada um...", "quem já é professor continua com o selo..." e "professor do cadastro com login não pode ser excluído") saem: a lista nova é coberta na Task 8 e na Task 10.

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/lib/__tests__/teamAccessEmail.test.js src/lib/__tests__/teamAccessProfessor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/settings/equipe/EditarAcessoDialog.jsx src/views/settings/equipe/ProfessorPicker.jsx src/views/settings/TeamAccessSection.jsx src/lib/__tests__/teamAccessEmail.test.js src/lib/__tests__/teamAccessProfessor.test.js
git commit -m "refactor: diálogo de editar acesso em arquivo próprio, sem o nome"
```

---

### Task 8: A lista

**Files:**
- Create: `src/views/settings/equipe/equipeVisual.jsx` (avatar, selos e anel, divididos com a ficha)
- Create: `src/views/settings/equipe/EquipeLista.jsx`
- Test: `src/lib/__tests__/equipeLista.behavior.test.js`

- [ ] **Step 1: Criar `src/views/settings/equipe/equipeVisual.jsx`**

```jsx
import { cn } from '../../../lib/utils.js';
import { fotoDe, vinculoSelo } from '../../../lib/equipe/ficha.js';

const iniciais = (nome) => String(nome || '?').trim().split(/\s+/)
  .filter((_, i, a) => i === 0 || i === a.length - 1).map((w) => w[0]).join('').toUpperCase();

// Foto da pessoa ou, sem foto, as iniciais.
export function PessoaAvatar({ pessoa, size = 36 }) {
  const url = fotoDe(pessoa);
  const estilo = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (url) return <img src={url} alt="" style={estilo} className="flex-none rounded-full object-cover" />;
  return (
    <span style={estilo} className="grid flex-none place-items-center rounded-full bg-brand-50 font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
      {iniciais(pessoa?.nome)}
    </span>
  );
}

export const FUNCAO_TEXTO = Object.freeze({ consultor: 'Consultor', gestor: 'Gestor', professor: 'Professor' });
const FUNCAO_COR = {
  gestor: 'bg-accent-500/[0.14] text-accent-600 dark:text-accent-400',
  consultor: 'bg-muted text-slate-600 dark:text-slate-300',
  professor: 'bg-violet-500/[0.12] text-violet-700 dark:text-violet-300',
};
export function FuncaoSelo({ funcao }) {
  return <span className={cn('inline-flex h-6 items-center rounded-[7px] px-2.5 text-[12px] font-semibold', FUNCAO_COR[funcao])}>{FUNCAO_TEXTO[funcao]}</span>;
}

export function VinculoSelo({ vinculo }) {
  if (!vinculo) return <span className="text-[12px] text-muted-foreground">Sem vínculo</span>;
  return (
    <span className={cn(
      'inline-flex h-6 items-center rounded-[7px] border px-2.5 text-[12px] font-semibold',
      vinculo === 'estagio' ? 'border-amber-500/45 bg-amber-500/[0.14] text-amber-800 dark:text-amber-300' : 'border-border text-slate-700 dark:text-slate-200',
    )}>
      {vinculoSelo(vinculo)}
    </span>
  );
}

const ACESSO = {
  com: ['Com acesso', 'bg-emerald-500', 'text-emerald-700 dark:text-emerald-400'],
  convite: ['Convite enviado', 'bg-amber-500', 'text-amber-700 dark:text-amber-400'],
  sem: ['Sem acesso', 'bg-slate-300 dark:bg-slate-600', 'text-muted-foreground'],
  desligado: ['Desligado', 'bg-rose-500', 'text-rose-700 dark:text-rose-400'],
};
export function AcessoSelo({ acesso }) {
  const [texto, ponto, cor] = ACESSO[acesso] || ACESSO.sem;
  return (
    <span className={cn('inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] font-semibold', cor)}>
      <span aria-hidden="true" className={cn('size-[7px] flex-none rounded-full', ponto)} />{texto}
    </span>
  );
}

// Anel do que falta na ficha: "7 de 10" para o leitor de tela.
export function FichaAnel({ ok, total, size = 30 }) {
  const pct = total ? Math.round((ok / total) * 100) : 0;
  const cheio = ok === total;
  return (
    <span
      role="img"
      aria-label={`Ficha com ${ok} de ${total} itens`}
      className="grid flex-none place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${cheio ? 'var(--color-emerald-500)' : 'var(--color-brand-600)'} ${pct}%, var(--color-border) 0)` }}
    >
      <span className="grid place-items-center rounded-full bg-card text-[9.5px] font-bold text-foreground" style={{ width: size - 8, height: size - 8 }}>
        {ok}/{total}
      </span>
    </span>
  );
}
```

Confira os nomes `--color-emerald-500`, `--color-brand-600` e `--color-border` no `@theme` de `src/index.css`; se algum tiver outro nome, use o que existe.

- [ ] **Step 2: Escrever o teste de comportamento da lista**

```js
// @vitest-environment jsdom
// src/lib/__tests__/equipeLista.behavior.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { EquipeLista } from '../../views/settings/equipe/EquipeLista.jsx';
import { montarEquipe } from '../equipe/equipe.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; });

const pessoas = montarEquipe({
  fichas: [{ id: 'p-otavio', professorId: 'p-otavio', vinculo: 'estagio', status: 'ativo', movimentacoes: [{ tipo: 'admissao', data: '2026-02-02' }] }],
  users: [{ id: 'u-camila', name: 'Camila Torres', role: 'consultant', email: 'camila@x.com' }],
  professores: [{ id: 'p-otavio', nome: 'Otávio Costa', modalidadeIds: ['m-pil'] }],
  agora: new Date(2026, 10, 26),
});

async function montar(props = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, null, h(EquipeLista, {
      pessoas, filtros: { situacao: 'ativos', funcao: null, vinculo: null, acesso: null }, setFiltros: () => {},
      busca: '', setBusca: () => {}, hrefDe: (id) => `/acad/configuracoes/equipe/${id}`,
      modalities: [{ id: 'm-pil', name: 'Pilates' }], leads: [], agora: new Date(2026, 10, 26), ...props,
    })));
  });
}

describe('lista da equipe', () => {
  it('uma linha por pessoa, com link para a ficha', async () => {
    await montar();
    const links = [...document.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-label')]);
    expect(links).toEqual([
      ['/acad/configuracoes/equipe/u-camila', 'Abrir a ficha de Camila Torres'],
      ['/acad/configuracoes/equipe/p-otavio', 'Abrir a ficha de Otávio Costa'],
    ]);
  });
  it('estagiário aparece como Estagiário, com a modalidade e o tempo de casa', async () => {
    await montar();
    const texto = document.body.textContent;
    expect(texto).toContain('Estagiário');
    expect(texto).toContain('Pilates');
    expect(texto).toContain('9 meses');
    expect(texto).toContain('Sem acesso');
  });
  it('lista vazia diz isso', async () => {
    await montar({ pessoas: [] });
    expect(document.body.textContent).toContain('Ninguém neste filtro.');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeLista.behavior.test.js`
Expected: FAIL (componente não existe).

- [ ] **Step 4: Criar `src/views/settings/equipe/EquipeLista.jsx`**

```jsx
import { useMemo } from 'react';
import { Briefcase, Key, Search, Users } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { FilterChip } from '../../dashboard/DashFilterBar.jsx';
import { isClientLead } from '../../../lib/leads.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { VINCULOS, admissaoDe, dataBR, faltasDaFicha, tempoDeCasa } from '../../../lib/equipe/ficha.js';
import { filtrarEquipe } from '../../../lib/equipe/equipe.js';
import { AcessoSelo, FichaAnel, FuncaoSelo, FUNCAO_TEXTO, PessoaAvatar, VinculoSelo } from './equipeVisual.jsx';

const GRADE = 'minmax(220px,2fr) 1.15fr .8fr 1.05fr .95fr 44px';
const TODOS = '__todos';
const opcoes = (lista, todos) => [{ key: TODOS, label: todos }, ...lista];
const FUNCOES_OPC = Object.entries(FUNCAO_TEXTO).map(([key, label]) => ({ key, label }));
const ACESSO_OPC = [{ key: 'com', label: 'Com acesso' }, { key: 'convite', label: 'Convite enviado' }, { key: 'sem', label: 'Sem acesso' }];
const SEG = 'h-7 rounded-full px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco';

// A lista do mockup A: filtros em pílulas (no endereço, pelo useScreenParams
// da tela), a busca pelo nome no estado da tela e uma linha por pessoa, toda
// ela um link para a ficha.
export function EquipeLista({ pessoas, filtros, setFiltros, busca, setBusca, hrefDe, modalities, leads, agora = new Date() }) {
  const visiveis = useMemo(() => filtrarEquipe(pessoas, filtros, busca), [pessoas, filtros, busca]);
  const ativos = (pessoas || []).filter((p) => !p.desligada).length;
  const desligados = (pessoas || []).length - ativos;
  const completas = visiveis.filter((p) => faltasDaFicha(p).faltam.length === 0).length;
  const porConsultor = useMemo(() => {
    const m = new Map();
    for (const l of leads || []) if (l.consultantId) m.set(l.consultantId, (m.get(l.consultantId) || 0) + 1);
    return m;
  }, [leads]);
  const porProfessor = useMemo(() => {
    const m = new Map();
    for (const l of leads || []) if (l.professorId && isClientLead(l)) m.set(l.professorId, (m.get(l.professorId) || 0) + 1);
    return m;
  }, [leads]);
  const pick = (campo) => (k) => setFiltros({ [campo]: k === TODOS ? null : k });

  const subDe = (p) => {
    if (p.funcao === 'professor') {
      const mods = professorModalityNames(p.professor, modalities).join(' e ');
      const n = porProfessor.get(p.professor?.id);
      return [mods, n ? `${n} alunos` : ''].filter(Boolean).join(', ');
    }
    const n = p.funcao === 'consultor' && p.user ? porConsultor.get(p.user.id) : 0;
    return n ? `${n} leads` : '';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Situação" className="inline-flex rounded-full border border-border bg-card p-[3px]">
          {[['ativos', `Ativos ${ativos}`], ['desligados', `Desligados ${desligados}`]].map(([id, texto]) => (
            <button key={id} type="button" aria-pressed={filtros.situacao === id} onClick={() => setFiltros({ situacao: id })}
              className={cn(SEG, filtros.situacao === id ? 'bg-foreground text-background' : 'text-muted-foreground')}>
              {texto}
            </button>
          ))}
        </div>
        <FilterChip icon={Briefcase} label="Função" valueText={filtros.funcao ? FUNCAO_TEXTO[filtros.funcao] : 'Todas'} active={!!filtros.funcao}
          options={opcoes(FUNCOES_OPC, 'Todas as funções')} value={filtros.funcao ?? TODOS} onPick={pick('funcao')} />
        <FilterChip icon={Users} label="Vínculo" valueText={filtros.vinculo ? VINCULOS.find((v) => v.id === filtros.vinculo)?.label : 'Todos'} active={!!filtros.vinculo}
          options={opcoes(VINCULOS.map((v) => ({ key: v.id, label: v.label })), 'Todos os vínculos')} value={filtros.vinculo ?? TODOS} onPick={pick('vinculo')} />
        <FilterChip icon={Key} label="Acesso" valueText={filtros.acesso ? ACESSO_OPC.find((a) => a.key === filtros.acesso)?.label : 'Todos'} active={!!filtros.acesso}
          options={opcoes(ACESSO_OPC, 'Todos os acessos')} value={filtros.acesso ?? TODOS} onPick={pick('acesso')} />
        <label className="flex h-9 min-w-[200px] items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] focus-within:anel-foco">
          <Search size={14} aria-hidden="true" className="text-muted-foreground" />
          <span className="sr-only">Buscar pelo nome</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" autoComplete="off" className="w-full bg-transparent outline-none" />
        </label>
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {visiveis.length} {visiveis.length === 1 ? 'pessoa' : 'pessoas'}, {completas} com a ficha completa
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="hidden h-10 items-center gap-3 border-b border-border bg-muted/40 px-5 text-[12px] font-semibold text-muted-foreground md:grid" style={{ gridTemplateColumns: GRADE }}>
          <span>Pessoa</span><span>Função</span><span>Vínculo</span><span>Acesso ao app</span><span>Na equipe</span><span>Ficha</span>
        </div>
        {visiveis.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">Ninguém neste filtro.</p>
        ) : visiveis.map((p, i) => {
          const { total, faltam } = faltasDaFicha(p);
          const admissao = admissaoDe(p.ficha);
          const sub = subDe(p);
          return (
            <div key={p.id} className={cn('relative grid items-center gap-3 px-5 py-3 transition hover:bg-muted/50', i < visiveis.length - 1 && 'border-b border-border')}
              style={{ gridTemplateColumns: GRADE }}>
              <div className="flex min-w-0 items-center gap-2.5">
                <PessoaAvatar pessoa={p} />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold">{p.nome}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">{p.user?.email || p.ficha?.emailPessoal || p.ficha?.convite?.email || ''}</div>
                </div>
              </div>
              <div className="min-w-0"><FuncaoSelo funcao={p.funcao} />{sub && <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{sub}</div>}</div>
              <div><VinculoSelo vinculo={p.ficha?.vinculo} /></div>
              <div><AcessoSelo acesso={p.acesso} /></div>
              <div className="text-[12.5px]">
                {admissao
                  ? (<><div className="font-semibold">{tempoDeCasa(admissao, agora)}</div><div className="text-[11.5px] text-muted-foreground">desde {dataBR(admissao).slice(3)}</div></>)
                  : <span className="text-muted-foreground">Sem admissão</span>}
              </div>
              <FichaAnel ok={total - faltam.length} total={total} />
              <AppLink to={hrefDe(p.id)} stretched draggable={false} aria-label={`Abrir a ficha de ${p.nome}`}
                className="absolute inset-0 rounded-none outline-none focus-visible:after:anel-foco focus-visible:after:ring-inset" />
            </div>
          );
        })}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeLista.behavior.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/bordaDosPrimitivos.test.js`
Expected: PASS. O "9 meses" vem de 02/02/2026 a 26/11/2026.

- [ ] **Step 6: Commit**

```bash
git add src/views/settings/equipe/EquipeLista.jsx src/views/settings/equipe/equipeVisual.jsx src/lib/__tests__/equipeLista.behavior.test.js
git commit -m "feat: lista da equipe"
```

---

### Task 9: A ficha

**Files:**
- Modify: `src/components/profile/cadastro/CadastroForms.jsx` (`function AddressForm` vira `export function AddressForm`)
- Create: `src/views/settings/equipe/FichaDados.jsx`
- Create: `src/views/settings/equipe/FichaMovimentacoes.jsx`
- Create: `src/views/settings/equipe/FichaAcesso.jsx`
- Create: `src/views/settings/equipe/EquipeFicha.jsx`
- Test: `src/lib/__tests__/equipeFicha.behavior.test.js`

- [ ] **Step 1: Exportar o formulário de endereço**

Em `src/components/profile/cadastro/CadastroForms.jsx`, troque `function AddressForm({ form, set, setForm }) {` por `export function AddressForm({ form, set, setForm }) {`. Ele já usa as chaves `cep, street, number, complement, neighborhood, city, state` e busca o CEP.

- [ ] **Step 2: Escrever o teste de comportamento**

```js
// @vitest-environment jsdom
// src/lib/__tests__/equipeFicha.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

const gravacoes = vi.hoisted(() => ({ blocos: [], nomes: [], profs: [] }));
vi.mock('../equipe/equipeWrites.js', () => ({
  gravarBloco: async (_db, pessoa, campos) => { gravacoes.blocos.push({ id: pessoa.id, campos }); },
  renomearPessoa: async (_db, _p, nome) => { gravacoes.nomes.push(nome); return false; },
  gravarProfessor: async (_db, id, campos) => { gravacoes.profs.push({ id, campos }); },
  subirFotoDaEquipe: async () => ({ url: 'u', path: 'p' }),
  apagarFotoDaEquipe: async () => {},
}));
vi.mock('../firebase.js', () => ({ appId: 'acad', storage: {}, PROFESSORS_PATH: 'stronix_professores' }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }) }));

const { EquipeFicha } = await import('../../views/settings/equipe/EquipeFicha.jsx');
const { montarEquipe } = await import('../equipe/equipe.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; gravacoes.blocos = []; gravacoes.nomes = []; });

const [marina] = montarEquipe({
  fichas: [], users: [], agora: new Date(2026, 10, 26),
  professores: [{ id: 'p-marina', nome: 'Marina Prado', modalidadeIds: ['m-func'] }],
});

async function montar(aba = 'dados') {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, null, h(EquipeFicha, {
      db: {}, appUser: { id: 'g1', name: 'Johnny', role: 'admin' }, pessoa: marina, aba, onAba: () => {},
      voltarHref: '/acad/configuracoes/equipe', modalities: [{ id: 'm-func', name: 'Funcional' }], professores: [{ id: 'p-marina', nome: 'Marina Prado' }],
      leads: [], professorEnabled: true, agora: new Date(2026, 10, 26), onEditarAcesso: () => {}, onTirarAcesso: () => {}, onDarAcesso: () => {}, onLeadsChanged: () => {},
    })));
  });
}

const botao = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const clicar = async (el) => act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });
const editar = (bloco) => clicar(document.querySelector(`[data-bloco="${bloco}"] button[data-editar]`));

describe('ficha da equipe', () => {
  it('o cabeçalho diz quem é, e a linha "Falta:" lista o que falta', async () => {
    await montar();
    expect(document.querySelector('h1').textContent).toBe('Marina Prado');
    expect(document.body.textContent).toContain('Falta:');
    expect(document.body.textContent).toContain('CPF');
    expect(document.body.textContent).toContain('CREF');
  });
  it('editar a Identidade grava só o bloco, com o id da pessoa', async () => {
    await montar();
    await editar('identidade');
    await escrever(document.querySelector('input[name="cpf"]'), '914.302.118-70');
    await clicar(botao('Salvar identidade'));
    expect(gravacoes.blocos).toEqual([{ id: 'p-marina', campos: { nome: 'Marina Prado', cpf: '91430211870', rg: '', nascimento: '' } }]);
    expect(gravacoes.nomes).toEqual([]);
  });
  it('CPF inválido não grava e diz o porquê', async () => {
    await montar();
    await editar('identidade');
    await escrever(document.querySelector('input[name="cpf"]'), '111.111.111-11');
    await clicar(botao('Salvar identidade'));
    expect(gravacoes.blocos).toEqual([]);
    expect(document.querySelector('[role="alert"]').textContent).toBe('CPF inválido.');
  });
  it('uma seção aberta por vez', async () => {
    await montar();
    await editar('identidade');
    expect(document.querySelector('[data-bloco="contato"] button[data-editar]').disabled).toBe(true);
  });
  it('o atalho da linha "Falta:" abre o bloco do item', async () => {
    await montar();
    await clicar(botao('CREF'));
    expect(document.querySelector('[data-bloco="trabalho"] input[name="cref"]')).toBeTruthy();
  });
  it('sem acesso, a aba Acesso oferece dar acesso', async () => {
    await montar('acesso');
    expect(botao('Dar acesso')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeFicha.behavior.test.js`
Expected: FAIL (componente não existe).

- [ ] **Step 4: Criar `src/views/settings/equipe/FichaDados.jsx`**

```jsx
import { useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { AddressForm } from '../../../components/profile/cadastro/CadastroForms.jsx';
import { PhotoCaptureMenu } from '../../../components/profile/PhotoCaptureMenu.jsx';
import { storage, appId } from '../../../lib/firebase.js';
import { uploadProfessorPhoto, deleteProfessorPhoto } from '../../../lib/professorPhoto.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { nivelTexto } from '../../../lib/professor/metas.js';
import { VINCULOS, admissaoDe, dataBR, faltasDaFicha, formDoBloco, patchDoBloco, tempoDeCasa, vinculoTexto } from '../../../lib/equipe/ficha.js';
import { apagarFotoDaEquipe, gravarBloco, gravarProfessor, renomearPessoa, subirFotoDaEquipe } from '../../../lib/equipe/equipeWrites.js';
import { DialogField, FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';
import { FUNCAO_TEXTO } from './equipeVisual.jsx';

const TITULOS = { identidade: 'Identidade', contato: 'Contato', trabalho: 'Trabalho' };
const ITENS = { identidade: ['foto', 'cpf', 'rg', 'nascimento'], contato: ['celular', 'emailPessoal', 'endereco'], trabalho: ['vinculo', 'admissao', 'cref'] };
const LINK = 'rounded font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco disabled:opacity-50 dark:text-brand-300';
const PILULA = 'h-9 rounded-full border px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco';
const pilula = (on) => cn(PILULA, on ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground');

function Linha({ rotulo, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{rotulo}</dt>
      <dd className={cn('mt-0.5 text-[13.5px] font-medium [overflow-wrap:anywhere]', !children && 'text-muted-foreground')}>{children || 'Não informado'}</dd>
    </div>
  );
}

// Os três blocos que editam no lugar, um por vez, como o Cadastro da ficha do
// lead. Cada bloco grava só as chaves dele (patchDoBloco). A linha "Falta:"
// abre o bloco do item com o cursor no campo.
export function FichaDados({ db, appUser, pessoa, professores, modalities, professorEnabled, leads, agora, onLeadsChanged }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(null); // { bloco, form, erro, campo }
  const [salvando, setSalvando] = useState(false);
  const [fotoAberta, setFotoAberta] = useState(false);
  const faltam = faltasDaFicha(pessoa).faltam;
  const autor = { id: appUser?.id ?? null, nome: appUser?.name ?? null };
  const f = pessoa.ficha || {};
  const prof = pessoa.funcao === 'professor';

  const abrir = (bloco, campo = null) => setAberto({ bloco, form: formDoBloco(bloco, pessoa), erro: null, campo });
  const set = (k, v) => setAberto((a) => ({ ...a, form: { ...a.form, [k]: v }, erro: null }));

  const salvar = async () => {
    const r = patchDoBloco(aberto.bloco, aberto.form, { pessoa, autor, agora, professores });
    if (r.erro) { setAberto((a) => ({ ...a, erro: r.erro, campo: r.campo })); return; }
    setSalvando(true);
    try {
      if (aberto.bloco === 'identidade' && r.ficha.nome !== pessoa.nome && (await renomearPessoa(db, pessoa, r.ficha.nome))) onLeadsChanged?.();
      await gravarBloco(db, pessoa, r.ficha, autor);
      if (r.professor && pessoa.professor) await gravarProfessor(db, pessoa.professor.id, r.professor);
      toast.success(`${TITULOS[aberto.bloco]} salva.`);
      setAberto(null);
    } catch (e) {
      console.error('Erro ao salvar a ficha:', e?.code || e);
      setAberto((a) => ({ ...a, erro: 'Não deu para salvar. Tente de novo.' }));
    } finally {
      setSalvando(false);
    }
  };

  const salvarFoto = async (blob) => {
    try {
      if (pessoa.professor) {
        const { url, path } = await uploadProfessorPhoto(storage, appId, pessoa.professor.id, blob);
        await gravarProfessor(db, pessoa.professor.id, { photoUrl: url, photoPath: path });
      } else {
        await gravarBloco(db, pessoa, { foto: await subirFotoDaEquipe(pessoa.id, blob) }, autor);
      }
      toast.success('Foto atualizada.');
    } catch (e) {
      console.error('Erro ao salvar a foto:', e?.code || e);
      toast.error(e?.code === 'storage/unauthorized' ? 'Sem permissão no Storage. Publique as regras no console do Firebase.' : 'Não deu para salvar a foto. Tente de novo.');
    }
  };
  const removerFoto = async () => {
    try {
      if (pessoa.professor) {
        await gravarProfessor(db, pessoa.professor.id, { photoUrl: null, photoPath: null });
        deleteProfessorPhoto(storage, pessoa.professor.photoPath).catch(() => {});
      } else {
        await gravarBloco(db, pessoa, { foto: null }, autor);
        apagarFotoDaEquipe(f.foto?.path).catch(() => {});
      }
      toast.success('Foto removida.');
    } catch (e) {
      console.error('Erro ao remover a foto:', e?.code || e);
      toast.error('Não deu para remover a foto.');
    }
  };

  const campo = (rotulo, nome, props = {}) => (
    <DialogField label={rotulo}>
      <input name={nome} className={FIELD_INPUT} autoComplete="off" autoFocus={aberto?.campo === nome || undefined}
        value={aberto.form[nome] ?? ''} onChange={(e) => set(nome, e.target.value)} {...props} />
    </DialogField>
  );

  const bloco = (id, leitura, formulario) => {
    const editando = aberto?.bloco === id;
    const pend = faltam.filter((x) => ITENS[id].includes(x.id)).map((x) => x.label.toLowerCase());
    return (
      <section data-bloco={id} aria-label={TITULOS[id]} className={cn('rounded-2xl border bg-card p-4 shadow-card', editando ? 'border-brand-300 dark:border-brand-500/50' : 'border-border')}>
        <header className="flex items-center gap-3">
          <h3 className="flex-1 font-display text-[15px] font-bold">{TITULOS[id]}</h3>
          {!editando && (pend.length
            ? <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">Falta {pend.join(', ')}</span>
            : <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">Completo</span>)}
          {!editando && <SettingsBtn size={32} data-editar="" disabled={!!aberto} onClick={() => abrir(id)}>Editar</SettingsBtn>}
        </header>
        {editando ? (
          <form className="mt-3 flex flex-col gap-3" noValidate inert={salvando || undefined} onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            {formulario}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {aberto.erro && <p role="alert" className="mr-auto text-[12.5px] font-semibold text-rose-700 dark:text-rose-400">{aberto.erro}</p>}
              <SettingsBtn size={36} type="button" onClick={() => setAberto(null)}>Cancelar</SettingsBtn>
              <SettingsBtn size={36} kind="primary" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : `Salvar ${TITULOS[id].toLowerCase()}`}</SettingsBtn>
            </div>
          </form>
        ) : (
          <dl className="mt-3 grid gap-x-5 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">{leitura}</dl>
        )}
      </section>
    );
  };

  const admissao = admissaoDe(f);
  const end = f.endereco;
  const alunos = prof && pessoa.professor ? (leads || []).filter((l) => l.professorId === pessoa.professor.id).length : 0;
  const fotoAtual = pessoa.professor ? pessoa.professor.photoUrl : f.foto?.url;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px]">
        {faltam.length ? (
          <>Falta: {faltam.map((x, i) => (
            <span key={x.id}>{i > 0 && ', '}
              <button type="button" className={LINK} disabled={!!aberto}
                onClick={() => (x.id === 'foto' ? setFotoAberta(true) : abrir(x.bloco, x.id === 'endereco' ? 'cep' : x.id))}>{x.label}</button>
            </span>
          ))}</>
        ) : <span className="font-semibold text-emerald-700 dark:text-emerald-300">Ficha completa</span>}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {bloco('identidade', (
          <>
            <Linha rotulo="Nome completo">{f.nome || pessoa.nome}</Linha>
            <Linha rotulo="CPF">{f.cpf && `${f.cpf.slice(0, 3)}.${f.cpf.slice(3, 6)}.${f.cpf.slice(6, 9)}-${f.cpf.slice(9)}`}</Linha>
            <Linha rotulo="RG">{f.rg}</Linha>
            <Linha rotulo="Nascimento">{f.nascimento && dataBR(f.nascimento)}</Linha>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted-foreground">Foto</dt>
              <dd className="mt-0.5"><button type="button" onClick={() => setFotoAberta(true)} className={cn(LINK, 'inline-flex items-center gap-1.5 text-[13px]')}><Camera size={14} aria-hidden="true" />{fotoAtual ? 'Trocar foto' : 'Adicionar foto'}</button></dd>
            </div>
          </>
        ), aberto?.bloco === 'identidade' && (
          <>
            {campo('Nome completo', 'nome')}
            <div className="grid gap-3 sm:grid-cols-2">{campo('CPF', 'cpf', { inputMode: 'numeric', placeholder: '000.000.000-00' })}{campo('RG', 'rg')}</div>
            <div className="grid gap-3 sm:grid-cols-2">{campo('Nascimento', 'nascimento', { type: 'date' })}</div>
          </>
        ))}

        {bloco('contato', (
          <>
            <Linha rotulo="Celular">{f.celular}</Linha>
            <Linha rotulo="E-mail pessoal">{f.emailPessoal}</Linha>
            <div className="col-span-full min-w-0">
              <Linha rotulo="Endereço">{end && [end.street, end.number, end.complement, end.neighborhood, end.city && `${end.city}${end.state ? `/${end.state}` : ''}`, end.cep].filter(Boolean).join(', ')}</Linha>
            </div>
          </>
        ), aberto?.bloco === 'contato' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">{campo('Celular', 'celular', { inputMode: 'tel', placeholder: '(51) 99999-9999' })}{campo('E-mail pessoal', 'emailPessoal', { type: 'email' })}</div>
            <AddressForm form={aberto.form} set={set} setForm={(fn) => setAberto((a) => ({ ...a, form: typeof fn === 'function' ? fn(a.form) : fn }))} />
          </>
        ))}

        <div className="xl:col-span-2">
          {bloco('trabalho', (
            <>
              <Linha rotulo="Função">{FUNCAO_TEXTO[pessoa.funcao]}</Linha>
              <Linha rotulo="Vínculo">{f.vinculo && vinculoTexto(f.vinculo)}</Linha>
              <Linha rotulo="Admissão">{admissao && `${dataBR(admissao)} (${tempoDeCasa(admissao, agora)})`}</Linha>
              {prof && <Linha rotulo="Modalidades">{professorModalityNames(pessoa.professor, modalities).join(' e ')}</Linha>}
              {prof && f.vinculo !== 'estagio' && <Linha rotulo="CREF">{f.cref}</Linha>}
              {prof && professorEnabled && <Linha rotulo="Nível no Stronix 2.0">{nivelTexto(pessoa.professor?.nivel)}</Linha>}
              {prof && <Linha rotulo="Alunos na carteira">{String(alunos)}</Linha>}
            </>
          ), aberto?.bloco === 'trabalho' && (
            <>
              <DialogField label="Vínculo">
                <div role="radiogroup" aria-label="Vínculo" className="flex flex-wrap gap-2">
                  {VINCULOS.map((v) => (
                    <button key={v.id} type="button" role="radio" aria-checked={aberto.form.vinculo === v.id} onClick={() => set('vinculo', v.id)} className={pilula(aberto.form.vinculo === v.id)}>{v.label}</button>
                  ))}
                </div>
              </DialogField>
              <div className="grid gap-3 sm:grid-cols-2">
                {campo('Admissão', 'admissao', { type: 'date' })}
                {prof && aberto.form.vinculo !== 'estagio' && campo('CREF', 'cref', { placeholder: '000000-G/RS' })}
              </div>
              {prof && (
                <DialogField label="Modalidades em que dá aula">
                  <div className="flex flex-wrap gap-2">
                    {(modalities || []).map((m) => {
                      const on = aberto.form.modalidadeIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" aria-pressed={on} className={pilula(on)}
                          onClick={() => set('modalidadeIds', on ? aberto.form.modalidadeIds.filter((x) => x !== m.id) : [...aberto.form.modalidadeIds, m.id])}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </DialogField>
              )}
            </>
          ))}
        </div>
      </div>

      {fotoAberta && (
        <PhotoCaptureMenu open={fotoAberta} onClose={() => setFotoAberta(false)} onPicked={salvarFoto} onRemove={fotoAtual ? removerFoto : null} />
      )}
    </div>
  );
}
```

O `aberto?.bloco === 'x' && (...)` no terceiro argumento de `bloco` é para o formulário só ser montado quando o bloco está aberto: o `campo` lê `aberto.form`. O `gravarProfessor` grava também `updatedAt`; o perfil do professor gravava `photoUpdatedAt`, e nada lê esse campo (confira com `grep -rn photoUpdatedAt src api` antes; se algo ler, grave-o junto).

- [ ] **Step 5: Criar `src/views/settings/equipe/FichaMovimentacoes.jsx`**

```jsx
import { dataBR, tipoDesligamentoTexto, vinculoTexto } from '../../../lib/equipe/ficha.js';

const TITULO = { admissao: 'Admissão', desligamento: 'Desligamento', readmissao: 'Readmissão' };
const PONTO = { admissao: 'bg-emerald-500', desligamento: 'bg-rose-500', readmissao: 'bg-brand-600' };

// A linha do tempo das movimentações, da mais nova para a mais antiga.
// Ninguém apaga uma entrada. `acoes` recebe os botões Desligar e Readmitir no PR 3.
export function FichaMovimentacoes({ pessoa, acoes = null }) {
  const movs = [...(pessoa.ficha?.movimentacoes || [])].reverse();
  return (
    <section aria-label="Movimentações" className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <header className="flex items-center gap-3"><h3 className="flex-1 font-display text-[15px] font-bold">Movimentações</h3>{acoes}</header>
      {movs.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">Sem movimentação ainda. A admissão entra quando você preenche a data em Dados, no bloco Trabalho.</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {movs.map((m, i) => (
            <li key={`${m.tipo}-${m.data}-${i}`} className="grid grid-cols-[88px_18px_1fr] gap-3 pb-4 last:pb-0">
              <span className="pt-0.5 text-right text-[12.5px] tabular-nums text-muted-foreground">{dataBR(m.data)}</span>
              <span aria-hidden="true" className={`mt-1 size-3.5 rounded-full border-[3px] border-card ring-1 ring-border ${PONTO[m.tipo] || 'bg-slate-400'}`} />
              <div>
                <p className="text-[14px] font-semibold">{TITULO[m.tipo] || 'Movimentação'}</p>
                <p className="text-[13px] text-muted-foreground">
                  {m.tipo === 'desligamento'
                    ? [tipoDesligamentoTexto(m.tipoDesligamento), m.motivo].filter(Boolean).join('. ')
                    : `Vínculo ${vinculoTexto(m.vinculo)}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[12px] text-muted-foreground">Ninguém apaga uma movimentação. O tipo e o motivo do desligamento só o gestor vê.</p>
    </section>
  );
}
```

- [ ] **Step 6: Criar `src/views/settings/equipe/FichaAcesso.jsx`**

```jsx
import { KeyRound } from 'lucide-react';
import { isGestor, roleLabel } from '../../../lib/acesso.js';
import { SettingsBtn } from '../settingsBits.jsx';
import { AcessoSelo } from './equipeVisual.jsx';

function Linha({ rotulo, children }) {
  return (<div><dt className="text-[12px] text-muted-foreground">{rotulo}</dt><dd className="mt-0.5 text-[13.5px] font-medium">{children}</dd></div>);
}

// O que era o diálogo de editar membro, em leitura. "Editar acesso" abre o
// EditarAcessoDialog, com a regra de sempre. "Dar acesso" fica para quem pode
// ter login: o professor só com o módulo Stronix 2.0.
export function FichaAcesso({ pessoa, professorEnabled, onEditarAcesso, onTirarAcesso, onDarAcesso }) {
  const u = pessoa.user;
  const podeDar = !pessoa.desligada && !u && (pessoa.funcao !== 'professor' || professorEnabled);
  return (
    <section aria-label="Acesso ao app" className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-display text-[15px] font-bold">Acesso ao app</h3>
        {u && <SettingsBtn size={32} icon={<KeyRound size={13} />} onClick={onEditarAcesso}>Editar acesso</SettingsBtn>}
        {u && !isGestor(u) && <SettingsBtn size={32} onClick={onTirarAcesso}>Tirar acesso</SettingsBtn>}
        {podeDar && <SettingsBtn size={32} kind="primary" icon={<KeyRound size={13} />} onClick={onDarAcesso}>Dar acesso</SettingsBtn>}
      </header>
      {u ? (
        <dl className="mt-3 grid gap-x-5 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          <Linha rotulo="Situação"><AcessoSelo acesso="com" /></Linha>
          <Linha rotulo="Papel">{roleLabel(u)}</Linha>
          <Linha rotulo="E-mail de login">{u.email}</Linha>
          {u.shiftStart && u.shiftEnd && <Linha rotulo="Turno">{`${u.shiftStart} às ${u.shiftEnd}`}</Linha>}
          {Number(u.dailyVolumeTarget) > 0 && <Linha rotulo="Meta de prospecção">{`${u.dailyVolumeTarget} ações por dia`}</Linha>}
        </dl>
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {pessoa.desligada ? 'O acesso saiu no desligamento.'
            : pessoa.funcao === 'professor' ? 'Aparece na agenda das aulas experimentais e no NPS, mas não entra no Stronilead.'
              : 'Esta pessoa ainda não entra no Stronilead.'}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Criar `src/views/settings/equipe/EquipeFicha.jsx`**

```jsx
import { ChevronLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { admissaoDe, dataBR, faltasDaFicha, tempoDeCasa } from '../../../lib/equipe/ficha.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { AcessoSelo, FichaAnel, FuncaoSelo, PessoaAvatar, VinculoSelo } from './equipeVisual.jsx';
import { FichaDados } from './FichaDados.jsx';
import { FichaMovimentacoes } from './FichaMovimentacoes.jsx';
import { FichaAcesso } from './FichaAcesso.jsx';

// A ficha em página própria (mockup A). A aba mora no endereço: `aba` vem do
// screenState e `onAba` troca o endereço com replace. O título da aba do
// navegador continua "Configurações", sem o nome da pessoa.
export function EquipeFicha({
  db, appUser, pessoa, aba, onAba, voltarHref, modalities, professores, leads, professorEnabled, agora = new Date(),
  onEditarAcesso, onTirarAcesso, onDarAcesso, onLeadsChanged, acoesDaFicha = null, acoesDasMovimentacoes = null,
}) {
  const { total, faltam } = faltasDaFicha(pessoa);
  const admissao = admissaoDe(pessoa.ficha);
  const mods = pessoa.funcao === 'professor' ? professorModalityNames(pessoa.professor, modalities) : [];

  return (
    <div className="flex flex-col gap-4">
      <AppLink to={voltarHref} className="inline-flex w-fit items-center gap-1 rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco">
        <ChevronLeft size={16} aria-hidden="true" />Equipe & acessos
      </AppLink>
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <PessoaAvatar pessoa={pessoa} size={72} />
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-[26px] font-bold tracking-tight">{pessoa.nome}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <FuncaoSelo funcao={pessoa.funcao} />
            <VinculoSelo vinculo={pessoa.ficha?.vinculo} />
            {mods.map((m) => <span key={m} className="inline-flex h-6 items-center rounded-[7px] border border-border px-2.5 text-[12px] font-semibold">{m}</span>)}
            <span className="ml-1.5"><AcessoSelo acesso={pessoa.acesso} /></span>
          </div>
          <p className="mt-2 text-[13px]">
            {admissao ? <>Na equipe desde <b className="font-semibold">{dataBR(admissao)}</b>, há {tempoDeCasa(admissao, agora)}</> : <span className="text-muted-foreground">Sem data de admissão</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FichaAnel ok={total - faltam.length} total={total} size={54} />
          {acoesDaFicha}
        </div>
      </header>

      <Tabs value={aba} onValueChange={onAba}>
        <TabsList aria-label="Ficha">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="acesso">Acesso ao app</TabsTrigger>
        </TabsList>
        <TabsContent value="dados" tabIndex={-1} className="mt-4">
          <FichaDados db={db} appUser={appUser} pessoa={pessoa} professores={professores} modalities={modalities}
            professorEnabled={professorEnabled} leads={leads} agora={agora} onLeadsChanged={onLeadsChanged} />
        </TabsContent>
        <TabsContent value="movimentacoes" tabIndex={-1} className="mt-4"><FichaMovimentacoes pessoa={pessoa} acoes={acoesDasMovimentacoes} /></TabsContent>
        <TabsContent value="acesso" tabIndex={-1} className="mt-4">
          <FichaAcesso pessoa={pessoa} professorEnabled={professorEnabled} onEditarAcesso={onEditarAcesso} onTirarAcesso={onTirarAcesso} onDarAcesso={onDarAcesso} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/equipeFicha.behavior.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/bordaDosPrimitivos.test.js`
Expected: PASS. No jsdom, o Radix ativa a aba no `mousedown`; os testes montam a ficha já na aba pedida.

- [ ] **Step 9: Commit**

```bash
git add src/views/settings/equipe/ src/components/profile/cadastro/CadastroForms.jsx src/lib/__tests__/equipeFicha.behavior.test.js
git commit -m "feat: ficha da equipe com dados, movimentações e acesso"
```

---

### Task 10: Ligar a tela

**Files:**
- Modify: `src/views/settings/TeamAccessSection.jsx`
- Modify: `src/views/settings/SettingsView.jsx` (linha ~167)
- Modify: `src/App.jsx` (linha ~229, desestruturação do `screenState`; linha ~1968, `<SettingsView>`)
- Test: `src/lib/__tests__/equipeTela.behavior.test.js`

- [ ] **Step 1: Passar o id e a aba até a seção**

Em `src/App.jsx`, na linha do `screenState`:

```js
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab, sub, modelId, profId, pessoaId, pessoaAba } = screenState(shown, location.state, appUser);
```

e no `<SettingsView ...>`, acrescente `pessoaId={pessoaId} pessoaAba={pessoaAba}`.

Em `src/views/settings/SettingsView.jsx`, receba `pessoaId` e `pessoaAba` nas props e repasse ao `<TeamAccessSection ... pessoaId={pessoaId} pessoaAba={pessoaAba} />`.

- [ ] **Step 2: Escrever o teste da tela**

```js
// @vitest-environment jsdom
// src/lib/__tests__/equipeTela.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

vi.mock('../../hooks/useEquipeFichas.js', () => ({ useEquipeFichas: () => ({ fichas: [], pronto: true, erro: null }) }));
vi.mock('../../hooks/useSeatLimits.js', () => ({ useSeatLimits: () => null }));
vi.mock('../firebase.js', () => ({ auth: {}, appId: 'acad', storage: {}, LEADS_PATH: 'l', PROFESSORS_PATH: 'p', USERS_PATH: 'u', EQUIPE_PATH: 'e' }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} }) }));

const { TeamAccessSection } = await import('../../views/settings/TeamAccessSection.jsx');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; });

const GESTOR = { id: 'g1', authUid: 'g1', name: 'Johnny', role: 'admin', tenantId: 'acad', tenantModules: ['faltosos'] };
const EQUIPE = [GESTOR, { id: 'u2', authUid: 'u2', name: 'Camila', role: 'consultant', email: 'c@x.com' }];
const PROFESSORES = [{ id: 'p1', nome: 'Marina', modalidadeIds: [] }];

async function montar(caminho, props = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [caminho] },
      h(GeneralConfigContext.Provider, { value: { modalities: [], professores: PROFESSORES } },
        h(TeamAccessSection, { db: {}, appUser: GESTOR, usersList: EQUIPE, leads: [], ...props }))));
  });
}

describe('Equipe & acessos', () => {
  it('a lista junta quem tem login e o professor sem login, e o card Professores saiu', async () => {
    await montar('/acad/configuracoes/equipe');
    const nomes = [...document.querySelectorAll('a[aria-label^="Abrir a ficha de"]')].map((a) => a.getAttribute('aria-label'));
    expect(nomes).toEqual(['Abrir a ficha de Camila', 'Abrir a ficha de Johnny', 'Abrir a ficha de Marina']);
    expect(document.body.textContent).not.toContain('Participação');
  });
  it('com o id no endereço, mostra a ficha', async () => {
    await montar('/acad/configuracoes/equipe/p1', { pessoaId: 'p1', pessoaAba: 'dados' });
    expect(document.querySelector('h1').textContent).toBe('Marina');
  });
  it('id que não existe diz isso, sem quebrar', async () => {
    await montar('/acad/configuracoes/equipe/zzz', { pessoaId: 'zzz', pessoaAba: 'dados' });
    expect(document.body.textContent).toContain('Não achamos essa pessoa na equipe.');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/equipeTela.behavior.test.js`
Expected: FAIL (a tela ainda é a de antes).

- [ ] **Step 4: Reescrever o corpo do `TeamAccessSection.jsx`**

O arquivo passa a ser o contêiner da seção.

1. **Fica:** o cabeçalho (`SettingsSectionHeader`, título "Equipe & acessos", dica "Quem trabalha na academia: a ficha, o vínculo e o acesso ao app de cada pessoa.", com "Convidar por e-mail", "Cadastrar professor" e o botão de cadastro), a `SeatBand`, o diálogo de cadastro (só o modo `create`), o de convite, o de cadastrar professor (só o modo novo: a edição do professor agora é o bloco Trabalho), o `deleteMember` (vira o "Tirar acesso") e o `focusId` da Visão geral (`'new'` abre o cadastro, como hoje).
2. **Sai:** a tabela de membros, o card Professores (`ProfessorRow`, `PROFESSORS_GRID`, `PROFESSORS_COLUMNS`, `professorStats`, o modo edição do `openProfessor`/`saveProfessor`), `MEMBERS_GRID`, `MEMBERS_COLUMNS`, `ROLE_BADGE`, `MemberAvatar`, `rowRefs` e o diálogo de editar membro (agora é o `EditarAcessoDialog`).
2a. **O `deleteProfessor` vira o "Excluir cadastro" da ficha**, para cadastro feito por engano. Ele aparece em `acoesDaFicha`, como botão discreto, só quando a pessoa não tem login e tem no máximo uma movimentação. Mantém as conferências de hoje (aulas registradas pelo `leadsWhere(db, 'appointmentProfessorId', '==', id)`) e acrescenta os alunos (`leadsWhere(db, 'professorId', '==', id)`), e apaga a ficha junto:

```jsx
  const excluirCadastro = async (p) => {
    if (p.user || (p.ficha?.movimentacoes || []).length > 1) return;
    if (p.professor) {
      let emUso;
      try {
        const [aulas, alunos] = await Promise.all([
          leadsWhere(db, 'appointmentProfessorId', '==', p.professor.id),
          leadsWhere(db, 'professorId', '==', p.professor.id),
        ]);
        emUso = aulas.length + alunos.length;
      } catch (err) {
        console.error(err);
        toast.error('Não deu para conferir as aulas e os alunos. Tente de novo.');
        return;
      }
      if (emUso > 0) { toast.warning(`"${p.nome}" tem aulas ou alunos registrados. Use Desligar em vez de excluir.`); return; }
    }
    if (!window.confirm(`Excluir o cadastro de "${p.nome}"? Use só para cadastro feito por engano.`)) return;
    try {
      if (p.professor) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, p.professor.id));
      if (p.ficha) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', EQUIPE_PATH, p.ficha.id));
      toast.success('Cadastro excluído.');
      navigate(listaHref);
    } catch (err) {
      console.error(err);
      toast.error('Não deu para excluir o cadastro.');
    }
  };
```

e, no `EquipeFicha`, `acoesDaFicha={!pessoa.user && (pessoa.ficha?.movimentacoes || []).length <= 1 ? <SettingsBtn size={36} onClick={() => excluirCadastro(pessoa)}>Excluir cadastro</SettingsBtn> : null}` (o PR 3 junta o Desligar e o Readmitir nesse mesmo lugar). Importe `EQUIPE_PATH` de `../../lib/firebase.js`. Um caso no `equipeTela.behavior.test.js`: com `confirm` falso trocado por `() => true` e o `leadsWhere` falso devolvendo uma aula, a exclusão é recusada e nada é apagado.
3. **Entra:**

```jsx
  const { tenantId } = appUser || {};
  const navigate = useNavigate();
  const location = useLocation();
  const { fichas } = useEquipeFichas(db);
  const agora = useMinuteClock();
  const pessoas = useMemo(() => montarEquipe({ fichas, users, professores, agora }), [fichas, users, professores, agora]);
  const ctxFiltros = useMemo(() => ({}), []);
  const [filtros, setFiltros] = useScreenParams('settings', ctxFiltros);
  const [busca, setBusca] = useState('');
  const [editandoAcesso, setEditandoAcesso] = useState(false);
  const listaHref = hrefFor(tenantId, 'settings', { sub: 'team' });
  const hrefDe = (id, aba) => hrefFor(tenantId, 'settings', { sub: 'team', pessoaId: id, pessoaAba: aba });
  const pessoa = pessoaId ? pessoas.find((p) => p.id === pessoaId) ?? null : null;

  // Abrir o cadastro já preenchido (o "Dar acesso" da ficha).
  const openCreate = (inicio = {}) => {
    setForm({ ...emptyForm, ...inicio, password: generateTemporaryPassword() });
    setMemberDialog({ mode: 'create' });
  };
```

O `deleteMember` recebe a pessoa e, depois do sucesso, volta para a lista quando a pessoa não tinha ficha (o id dela era o do login, que deixou de existir): `if (!pessoa?.ficha) navigate(listaHref);`.

O retorno:

```jsx
  const dialogos = (
    <>
      {/* os <FormDialog> de cadastro (modo create), de convite e de professor novo, como hoje */}
    </>
  );

  if (pessoaId) {
    if (!pessoa) {
      return (
        <div className="flex flex-col gap-4">
          <AppLink to={listaHref} className="w-fit rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco">Equipe & acessos</AppLink>
          <p className="rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">Não achamos essa pessoa na equipe.</p>
        </div>
      );
    }
    return (
      <>
        <EquipeFicha
          db={db} appUser={appUser} pessoa={pessoa} aba={pessoaAba || 'dados'}
          onAba={(aba) => navigate(hrefDe(pessoa.id, aba), { replace: true, state: location.state })}
          voltarHref={listaHref} modalities={modalities} professores={professores} leads={leads}
          professorEnabled={professorEnabled} agora={agora}
          onEditarAcesso={() => setEditandoAcesso(true)}
          onTirarAcesso={() => deleteMember(pessoa)}
          onDarAcesso={() => openCreate({
            name: pessoa.nome, email: pessoa.ficha?.emailPessoal || '',
            role: pessoa.funcao === 'professor' ? ROLES.PROFESSOR : ROLES.CONSULTOR, professorId: pessoa.professor?.id || '',
          })}
          onLeadsChanged={onLeadsChanged}
        />
        {pessoa.user && (
          <EditarAcessoDialog db={db} appUser={appUser} user={pessoa.user} usersList={users} open={editandoAcesso} onOpenChange={setEditandoAcesso} />
        )}
        {dialogos}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* SettingsSectionHeader de hoje, com a dica nova */}
      <SeatBand seats={seats} consultantCount={consultantCount} professorCount={professorCount} />
      <EquipeLista pessoas={pessoas} filtros={filtros} setFiltros={setFiltros} busca={busca} setBusca={setBusca}
        hrefDe={(id) => hrefDe(id)} modalities={modalities} leads={leads} agora={agora} />
      {dialogos}
    </div>
  );
```

O `deleteMember` de hoje recebe um `user`; ajuste a assinatura para `deleteMember(pessoa)` e use `pessoa.user` dentro dele (`isGestor(pessoa.user)`, `pessoa.user.name`, `userDocId: pessoa.user.id`).

Imports novos no topo: `useNavigate` e `useLocation` de `react-router`; `hrefFor` de `../../lib/routes.js`; `useScreenParams` de `../../hooks/useScreenParams.js`; `useMinuteClock` de `../../hooks/useMinuteClock.js`; `useEquipeFichas` de `../../hooks/useEquipeFichas.js`; `montarEquipe` de `../../lib/equipe/equipe.js`; `AppLink` de `../../components/nav/AppLink.jsx`; `EquipeLista`, `EquipeFicha`, `EditarAcessoDialog` e `ProfessorPicker` de `./equipe/...`. Tire os imports que ficaram sem uso (o lint aponta).

- [ ] **Step 5: Rodar tudo da equipe e as varreduras**

Run: `npx vitest run src/lib/__tests__/equipe src/lib/__tests__/teamAccess src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js src/lib/__tests__/settingsRail.test.js`
Expected: PASS. Se o `acessoSweep.test.js` (linha ~118) exigir que `TeamAccessSection.jsx` leia `isSeller`, mantenha o arquivo na lista de leitura dele como hoje, ou mova a entrada para o arquivo novo que monta a lista.

- [ ] **Step 6: Commit**

```bash
git add src/views/settings/TeamAccessSection.jsx src/views/settings/SettingsView.jsx src/App.jsx src/lib/__tests__/equipeTela.behavior.test.js
git commit -m "feat: Equipe & acessos com a lista única e a ficha"
```

---

### Task 11: Regra do Storage, documentação e verificação

**Files:**
- Create: `docs/superpowers/specs/2026-11-26-cadastro-da-equipe-storage.rules`
- Modify: `CLAUDE.md` do Stronilead (seção nova "Equipe & acessos", depois de "Perfil do professor")

- [ ] **Step 1: Escrever o trecho do Storage para o Johnny publicar**

```
// Foto da ficha da equipe (quem não é professor). Mesma regra da foto do
// professor que está publicada: a trava do gestor fica na tela, porque a
// versão que lê o papel no Firestore pede uma permissão do IAM que não foi dada.
match /tenants/{tenant}/equipe/{fichaId}/{fileName} {
  allow read: if request.auth != null && request.auth.token.tenantId == tenant;
  allow write: if request.auth != null && request.auth.token.tenantId == tenant
               && request.resource.size < 2 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
```

- [ ] **Step 2: Seção no `CLAUDE.md`**

Acrescente, depois da seção "Perfil do professor":

```markdown
## Equipe & acessos

Lista única da equipe e ficha de cada pessoa. Spec em `docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md`, mockup A em `docs/superpowers/specs/mockups/2026-11-26-equipe-a-lista-e-pagina.html`, planos em `docs/superpowers/plans/2026-11-26-cadastro-da-equipe-*.md`.

- **A ficha mora em `stronix_equipe`**, que só o gestor lê e grava (regra no `firestore.rules`, cobrada pelo `equipeRules.test.js`). Ela aponta para o login (`userId`) e para o professor (`professorId`) e guarda CPF, RG, nascimento, contato, endereço, vínculo, CREF, status e as movimentações. Nome e "ativo" são copiados para o login e o professor; a foto do professor continua no cadastro do professor.
- **A lista junta fichas, logins e professores** em `montarEquipe` (`src/lib/equipe/equipe.js`). Quem não tem ficha aparece com o id do login ou do professor, e a ficha nasce com esse id na primeira gravação (`gravarBloco`, com `merge`).
- **Endereço:** a lista em `/configuracoes/equipe`, com `sit`, `funcao`, `vinculo` e `acesso` na query (a busca pelo nome fica no estado); a ficha em `/configuracoes/equipe/<id>` e as abas `movimentacoes` e `acesso`. É sub-tela das Configurações (`screenKey` continua `settings`), então abrir a ficha não remonta o `SettingsView`. O id sai do Sentry pelo `EQUIPE_PATH_RE`.
- **Cada bloco grava só as chaves dele** (`patchDoBloco`, em `src/lib/equipe/ficha.js`). As movimentações são uma lista na ficha, com `registradoEm` em texto ISO, porque o Firestore não aceita `serverTimestamp` dentro de lista. Ninguém apaga uma movimentação; corrigir a admissão troca a data da última admissão ou readmissão.
- **`ficha.js` e `equipe.js` são puros** e a `api/` os lê: o `equipeImports.test.js` trava os imports.
- **O acesso** continua pelas ações de sempre (`create`, `set-role`, `set-email`, `set-password`, `delete`), agora pela aba Acesso ao app da ficha e pelo `EditarAcessoDialog`, sem o campo Nome.
- A foto de quem não é professor fica em `tenants/<academia>/equipe/<id>/avatar.jpg`; o trecho da regra do Storage está em `docs/superpowers/specs/2026-11-26-cadastro-da-equipe-storage.rules`, para o Johnny publicar.
```

- [ ] **Step 3: Verificação completa**

Run: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Expected: tudo verde, comparando com a linha de base.

- [ ] **Step 4: Conferir no navegador**

Com o harness (plano mestre, "Verificação no navegador"): lista com os filtros (o endereço muda sem criar parada no voltar), Ctrl+clique abrindo a ficha em outra aba, as três abas, editar cada bloco, o atalho da linha "Falta:", a foto, "Editar acesso", "Tirar acesso" e "Dar acesso" de um professor, a 1280 px e a 375 px, no claro e no escuro. Apague o harness antes do commit.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-11-26-cadastro-da-equipe-storage.rules
git commit -m "docs: Equipe & acessos no CLAUDE.md e regra do Storage da foto"
```

- [ ] **Step 6: Antes do merge**

Pedir ao Johnny para publicar a regra do Firestore (`stronix_equipe`) e a do Storage, e só então abrir o PR, com o pedido dele.
