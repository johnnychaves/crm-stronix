# Plano de carreira, PR 1: trilhas e contas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** criar `src/lib/carreira/` (períodos, números, trilhas e validação) e fazer as contas do professor receberem o período da trilha, sem mudar nenhum número que a tela mostra hoje.

**Architecture:** funções puras, sem import de pacote, testadas em node. `src/lib/professor/ciclo.js` passa a delegar ao `periodo.js` com a trilha anual de dezembro, e os testes de hoje do ciclo continuam passando sem mudar: é o teste de equivalência. As telas continuam lendo o ciclo do endereço como ano e o convertem em período.

**Tech Stack:** JavaScript, Vitest (`npm test`), React 19 nas duas telas que mudam pouco.

**Spec:** `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md`. Visão geral dos PRs: `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`.

**Antes de começar:** crie a branch a partir da `main` e confira `git fetch && git rev-list --count HEAD..origin/main` (precisa dar 0). Rode `npm ci` e `npm test` uma vez para ter a linha de base.

---

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| Criar `src/lib/carreira/periodo.js` | os períodos de uma trilha: chave, início e fim, vizinhos, janela da renovação, pedaços da aderência e a avaliação em que a pesquisa conta |
| Criar `src/lib/carreira/numeros.js` | os números que uma trilha pode ligar, os limites das metas e quando a meta bate |
| Criar `src/lib/carreira/trilhas.js` | as três trilhas padrão, a leitura do documento (com a ponte das metas de hoje), a trilha e o nível de uma pessoa e a sugestão |
| Criar `src/lib/carreira/validacao.js` | `problemaDaTrilha` e `podeArquivar` |
| Modificar `src/lib/professor/ciclo.js` | delega ao `periodo.js` |
| Modificar `src/lib/professor/renovacao.js` | recebe `periodo` |
| Modificar `src/lib/professor/conversao.js` | recebe `periodo` |
| Modificar `src/lib/professor/aderencia.js` | recebe os pedaços |
| Modificar `src/lib/professor/pesquisas.js` | a pesquisa conta pela data; sai o ciclo escolhido no formulário |
| Modificar `src/views/professores/PesquisaForm.jsx`, `PesquisasTab.jsx`, `pesquisasTexto.js` | sai o campo do ciclo |
| Modificar `src/hooks/useProfessoresDados.js` | devolve `trilhas` e `trilhaProfessor` |
| Modificar `src/views/professores/ProfessoresView.jsx`, `ProfessorPerfilView.jsx` | passam o período, os pedaços e a trilha |
| Testes novos em `src/lib/__tests__/`: `carreira.periodo.test.js`, `carreira.numeros.test.js`, `carreira.trilhas.test.js`, `carreira.validacao.test.js`, `carreiraImports.test.js` | |
| Modificar `CLAUDE.md` | seção "Plano de carreira" |

---

### Task 1: os períodos de uma trilha

**Files:**
- Create: `src/lib/carreira/periodo.js`
- Test: `src/lib/__tests__/carreira.periodo.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import {
  chaveDaPesquisa, janelaDaRenovacao, mesesDaAvaliacao, pecasDaAderencia,
  periodoAnterior, periodoDe, periodoPorChave, periodoSeguinte,
} from '../carreira/periodo.js';

const ANUAL_DEZ = { frequencia: 'anual', mes: 12 };
const ANUAL_MAR = { frequencia: 'anual', mes: 3 };
const SEM_JUN = { frequencia: 'semestral', mes: 6 };
const SEM_JAN = { frequencia: 'semestral', mes: 1 };
const d = (dia) => new Date(`${dia}T00:00:00`);
const chave = (trilha, data) => periodoDe(trilha, new Date(data)).chave;

describe('mesesDaAvaliacao', () => {
  it('anual tem um mês e semestral tem dois, a 6 meses de distância', () => {
    expect(mesesDaAvaliacao(ANUAL_DEZ)).toEqual([12]);
    expect(mesesDaAvaliacao(ANUAL_MAR)).toEqual([3]);
    expect(mesesDaAvaliacao(SEM_JUN)).toEqual([6, 12]);
    expect(mesesDaAvaliacao(SEM_JAN)).toEqual([1, 7]);
  });

  it('mês fora da regra cai no padrão', () => {
    expect(mesesDaAvaliacao({})).toEqual([12]);
    expect(mesesDaAvaliacao(undefined)).toEqual([12]);
    expect(mesesDaAvaliacao({ frequencia: 'anual', mes: 0 })).toEqual([12]);
    expect(mesesDaAvaliacao({ frequencia: 'semestral', mes: 9 })).toEqual([6, 12]);
  });
});

describe('periodoPorChave', () => {
  it('anual em dezembro vai de 1º de dezembro a 1º de dezembro, fora', () => {
    expect(periodoPorChave(ANUAL_DEZ, '2027')).toEqual({ chave: '2027', inicio: d('2026-12-01'), fim: d('2027-12-01') });
  });

  it('anual em março, com o ano bissexto', () => {
    expect(periodoPorChave(ANUAL_MAR, '2027')).toEqual({ chave: '2027', inicio: d('2026-03-01'), fim: d('2027-03-01') });
    expect(periodoPorChave(ANUAL_MAR, '2028').fim).toEqual(d('2028-03-01'));
  });

  it('semestral em junho e dezembro, e em janeiro e julho', () => {
    expect(periodoPorChave(SEM_JUN, '2027-1')).toEqual({ chave: '2027-1', inicio: d('2026-12-01'), fim: d('2027-06-01') });
    expect(periodoPorChave(SEM_JUN, '2027-2')).toEqual({ chave: '2027-2', inicio: d('2027-06-01'), fim: d('2027-12-01') });
    expect(periodoPorChave(SEM_JAN, '2027-1')).toEqual({ chave: '2027-1', inicio: d('2026-07-01'), fim: d('2027-01-01') });
  });

  it('recusa a chave que não serve para a trilha', () => {
    expect(periodoPorChave(ANUAL_DEZ, '2027-1')).toBeNull();
    expect(periodoPorChave(SEM_JUN, '2027')).toBeNull();
    expect(periodoPorChave(SEM_JUN, '2027-3')).toBeNull();
    expect(periodoPorChave(ANUAL_DEZ, 'abc')).toBeNull();
    expect(periodoPorChave(ANUAL_DEZ, null)).toBeNull();
  });
});

describe('periodoDe', () => {
  it('anual em dezembro: dezembro já é do ano seguinte', () => {
    expect(chave(ANUAL_DEZ, '2026-12-01T00:00:00')).toBe('2027');
    expect(chave(ANUAL_DEZ, '2027-11-30T23:59:00')).toBe('2027');
  });

  it('anual em março: março já é do ano seguinte, e 29 de fevereiro fica no ano', () => {
    expect(chave(ANUAL_MAR, '2027-02-28T12:00:00')).toBe('2027');
    expect(chave(ANUAL_MAR, '2027-03-01T00:00:00')).toBe('2028');
    expect(chave(ANUAL_MAR, '2028-02-29T12:00:00')).toBe('2028');
  });

  it('semestral em junho e dezembro', () => {
    expect(chave(SEM_JUN, '2027-03-10T12:00:00')).toBe('2027-1');
    expect(chave(SEM_JUN, '2027-06-01T00:00:00')).toBe('2027-2');
    expect(chave(SEM_JUN, '2027-12-05T12:00:00')).toBe('2028-1');
  });

  it('semestral em janeiro e julho', () => {
    expect(chave(SEM_JAN, '2027-03-10T12:00:00')).toBe('2027-2');
    expect(chave(SEM_JAN, '2027-08-01T12:00:00')).toBe('2028-1');
  });

  it('aceita Timestamp e devolve null com data inválida', () => {
    expect(periodoDe(ANUAL_DEZ, { toDate: () => new Date('2027-06-15T12:00:00') }).chave).toBe('2027');
    expect(periodoDe(ANUAL_DEZ, null)).toBeNull();
    expect(periodoDe(ANUAL_DEZ, 'não é data')).toBeNull();
  });
});

describe('periodoAnterior e periodoSeguinte', () => {
  it('andam de um período para o vizinho', () => {
    const p = periodoPorChave(SEM_JUN, '2027-1');
    expect(periodoAnterior(SEM_JUN, p).chave).toBe('2026-2');
    expect(periodoSeguinte(SEM_JUN, p).chave).toBe('2027-2');
    expect(periodoAnterior(ANUAL_DEZ, periodoPorChave(ANUAL_DEZ, '2027')).chave).toBe('2026');
  });
});

describe('janelaDaRenovacao', () => {
  it('no anual é o período', () => {
    expect(janelaDaRenovacao(ANUAL_DEZ, periodoPorChave(ANUAL_DEZ, '2027'))).toEqual({ inicio: d('2026-12-01'), fim: d('2027-12-01') });
  });

  it('no semestral, 12 meses até o fim do período por padrão, ou só o período', () => {
    const p = periodoPorChave(SEM_JUN, '2027-1');
    expect(janelaDaRenovacao(SEM_JUN, p)).toEqual({ inicio: d('2026-06-01'), fim: d('2027-06-01') });
    expect(janelaDaRenovacao({ ...SEM_JUN, janelaRenovacao: 'periodo' }, p)).toEqual({ inicio: d('2026-12-01'), fim: d('2027-06-01') });
  });
});

describe('pecasDaAderencia', () => {
  it('anual em dezembro: janeiro a junho e julho a novembro, como hoje', () => {
    expect(pecasDaAderencia(periodoPorChave(ANUAL_DEZ, '2027'))).toEqual([
      { inicio: d('2027-01-01'), fim: d('2027-07-01') },
      { inicio: d('2027-07-01'), fim: d('2027-12-01') },
    ]);
  });

  it('semestral: o período sem dezembro, em pedaços do calendário', () => {
    expect(pecasDaAderencia(periodoPorChave(SEM_JUN, '2027-1'))).toEqual([
      { inicio: d('2027-01-01'), fim: d('2027-06-01') },
    ]);
    expect(pecasDaAderencia(periodoPorChave(SEM_JUN, '2027-2'))).toEqual([
      { inicio: d('2027-06-01'), fim: d('2027-07-01') },
      { inicio: d('2027-07-01'), fim: d('2027-12-01') },
    ]);
  });

  it('anual em março pega três pedaços', () => {
    expect(pecasDaAderencia(periodoPorChave(ANUAL_MAR, '2028'))).toEqual([
      { inicio: d('2027-03-01'), fim: d('2027-07-01') },
      { inicio: d('2027-07-01'), fim: d('2027-12-01') },
      { inicio: d('2028-01-01'), fim: d('2028-03-01') },
    ]);
  });
});

describe('chaveDaPesquisa', () => {
  it('anual em dezembro: a pesquisa conta no ano em que abre', () => {
    expect(chaveDaPesquisa(ANUAL_DEZ, '2027-06-10')).toBe('2027');
    expect(chaveDaPesquisa(ANUAL_DEZ, '2027-12-01')).toBe('2027');
    expect(chaveDaPesquisa(ANUAL_DEZ, '2027-01-15')).toBe('2027');
  });

  it('semestral: a de junho conta em junho e a de dezembro, em dezembro', () => {
    expect(chaveDaPesquisa(SEM_JUN, '2027-06-10')).toBe('2027-1');
    expect(chaveDaPesquisa(SEM_JUN, '2027-07-01')).toBe('2027-2');
    expect(chaveDaPesquisa(SEM_JUN, '2027-12-01')).toBe('2027-2');
    expect(chaveDaPesquisa(SEM_JUN, '2028-01-05')).toBe('2028-1');
  });

  it('sem dia válido, null', () => {
    expect(chaveDaPesquisa(ANUAL_DEZ, '')).toBeNull();
    expect(chaveDaPesquisa(ANUAL_DEZ, undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.periodo.test.js`
Expected: FAIL, "Failed to resolve import ../carreira/periodo.js".

- [ ] **Step 3: Write the implementation**

```js
// Os períodos de avaliação de uma trilha do plano de carreira (spec
// 2026-11-26-plano-de-carreira-configuravel, "Os períodos"). Anual: os 12
// meses que terminam no fim do mês anterior ao mês da avaliação. Semestral:
// dois períodos de 6 meses por ano, com as avaliações a 6 meses de distância.
// A chave é o ano da avaliação ('2027') ou o ano com a vez dela ('2027-1',
// '2027-2'). Datas no fuso local, como o ciclo.js de antes. Puro e sem
// pacote: a api/ também vai ler (carreiraImports.test.js).
import { getSafeDateOrNull } from '../dates.js';

const SEMESTRAL = 'semestral';

// Os meses da avaliação, de 1 a 12. Mês fora da regra cai no padrão:
// dezembro no anual, junho e dezembro no semestral.
export function mesesDaAvaliacao(trilha) {
  const mes = Number(trilha?.mes);
  if (trilha?.frequencia === SEMESTRAL) {
    const primeiro = Number.isInteger(mes) && mes >= 1 && mes <= 6 ? mes : 6;
    return [primeiro, primeiro + 6];
  }
  return [Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : 12];
}

const mesesDoPeriodo = (trilha) => (trilha?.frequencia === SEMESTRAL ? 6 : 12);

// [inicio, fim): fim é o dia 1º do mês da avaliação, às 00:00, fora do período.
function periodoQueTerminaEm(trilha, ano, mes, chave) {
  return {
    chave,
    inicio: new Date(ano, mes - 1 - mesesDoPeriodo(trilha), 1),
    fim: new Date(ano, mes - 1, 1),
  };
}

// O período de uma chave, ou null quando a chave não serve para a trilha.
export function periodoPorChave(trilha, chave) {
  const m = /^(\d{4})(?:-([12]))?$/.exec(String(chave ?? ''));
  if (!m) return null;
  const ano = Number(m[1]);
  const meses = mesesDaAvaliacao(trilha);
  if (meses.length === 1) return m[2] ? null : periodoQueTerminaEm(trilha, ano, meses[0], m[1]);
  if (!m[2]) return null;
  return periodoQueTerminaEm(trilha, ano, meses[Number(m[2]) - 1], `${m[1]}-${m[2]}`);
}

// O período em que a data cai, ou null com data inválida.
export function periodoDe(trilha, data) {
  const d = getSafeDateOrNull(data);
  if (!d) return null;
  const mes = d.getMonth() + 1;
  const ano = d.getFullYear();
  const [primeiro, segundo] = mesesDaAvaliacao(trilha);
  if (segundo == null) return periodoPorChave(trilha, String(mes < primeiro ? ano : ano + 1));
  if (mes < primeiro) return periodoPorChave(trilha, `${ano}-1`);
  if (mes < segundo) return periodoPorChave(trilha, `${ano}-2`);
  return periodoPorChave(trilha, `${ano + 1}-1`);
}

// Os vizinhos, para as setas do perfil.
export const periodoAnterior = (trilha, periodo) => periodoDe(trilha, new Date(periodo.inicio.getTime() - 1));
export const periodoSeguinte = (trilha, periodo) => periodoDe(trilha, periodo.fim);

// A janela da renovação: o período, ou, no semestral com 12 meses (o padrão),
// os 12 meses que terminam no fim do período.
export function janelaDaRenovacao(trilha, periodo) {
  if (trilha?.frequencia !== SEMESTRAL || trilha?.janelaRenovacao === 'periodo') {
    return { inicio: periodo.inicio, fim: periodo.fim };
  }
  return { inicio: new Date(periodo.fim.getFullYear(), periodo.fim.getMonth() - 12, 1), fim: periodo.fim };
}

// Os pedaços da aderência: os semestres do calendário (janeiro a junho e julho
// a novembro, sem dezembro) que caem no período, cortados nas pontas dele.
export function pecasDaAderencia({ inicio, fim }) {
  const pecas = [];
  for (let ano = inicio.getFullYear(); ano <= fim.getFullYear(); ano += 1) {
    [[0, 6], [6, 11]].forEach(([de, ate]) => {
      const i = new Date(Math.max(inicio.getTime(), new Date(ano, de, 1).getTime()));
      const f = new Date(Math.min(fim.getTime(), new Date(ano, ate, 1).getTime()));
      if (i < f) pecas.push({ inicio: i, fim: f });
    });
  }
  return pecas;
}

// A chave da avaliação em que a pesquisa conta: a primeira da trilha no mês
// em que ela abre ou depois. `inicio` é o dia 'AAAA-MM-DD' da pesquisa. O dia
// 0 do mês é o último dia do mês anterior, e o período dele termina na
// primeira avaliação a partir do mês da pesquisa.
export function chaveDaPesquisa(trilha, inicio) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(inicio ?? ''));
  if (!m) return null;
  return periodoDe(trilha, new Date(Number(m[1]), Number(m[2]) - 1, 0))?.chave ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.periodo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/periodo.js src/lib/__tests__/carreira.periodo.test.js
git commit -m "feat: períodos de avaliação da trilha de carreira"
```

---

### Task 2: o ciclo do professor delega ao período

O teste de hoje do ciclo (`src/lib/__tests__/professor.ciclo.test.js`) não muda e precisa continuar passando. É ele que garante que a trilha anual de dezembro dá exatamente o ciclo de hoje.

**Files:**
- Modify: `src/lib/professor/ciclo.js` (arquivo inteiro)
- Test: `src/lib/__tests__/professor.ciclo.test.js` (sem mudança)

- [ ] **Step 1: Run the current test**

Run: `npx vitest run src/lib/__tests__/professor.ciclo.test.js`
Expected: PASS (linha de base).

- [ ] **Step 2: Replace `src/lib/professor/ciclo.js`**

```js
// O ciclo da avaliação do professor: a trilha anual em dezembro
// (src/lib/carreira/periodo.js), com a chave como número. As contas recebem o
// período; este arquivo fica só para as telas, que ainda leem o ciclo do
// endereço como ano, e sai no PR 3 do plano de carreira (menu Carreira).
// O teste deste arquivo é o de equivalência: a trilha anual de dezembro dá
// exatamente o ciclo de 1º de dezembro a 30 de novembro de antes.
import { pecasDaAderencia, periodoDe, periodoPorChave } from '../carreira/periodo.js';

const ANUAL_DEZEMBRO = Object.freeze({ frequencia: 'anual', mes: 12 });

// O ciclo de uma data, ou null com data inválida.
export function cicloDe(data) {
  const p = periodoDe(ANUAL_DEZEMBRO, data);
  return p ? Number(p.chave) : null;
}

// [inicio, fim): fim é 1º de dezembro às 00:00, fora do ciclo. Ciclo que não
// é ano dá datas inválidas, como antes.
export function limitesDoCiclo(ciclo) {
  const p = periodoPorChave(ANUAL_DEZEMBRO, String(ciclo));
  return p ? { inicio: p.inicio, fim: p.fim } : { inicio: new Date(NaN), fim: new Date(NaN) };
}

// Os dois semestres da aderência na avaliação de dezembro: janeiro a junho e
// julho a novembro.
export const semestresDoCiclo = (ciclo) => pecasDaAderencia(limitesDoCiclo(ciclo));
```

- [ ] **Step 3: Run the ciclo test and the professor tests**

Run: `npx vitest run src/lib/__tests__/professor.ciclo.test.js src/lib/__tests__/professor.renovacao.test.js src/lib/__tests__/professor.conversao.test.js src/lib/__tests__/professor.aderencia.test.js src/lib/__tests__/professor.pesquisas.test.js`
Expected: PASS em todos, sem mudar nenhum teste.

- [ ] **Step 4: Commit**

```bash
git add src/lib/professor/ciclo.js
git commit -m "refactor: ciclo do professor delega ao período da trilha"
```

---

### Task 3: os números que uma trilha pode ligar

**Files:**
- Create: `src/lib/carreira/numeros.js`
- Test: `src/lib/__tests__/carreira.numeros.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { AJUSTES, metaBatida, metaValida, NUMEROS, numerosDaBase, VENDAS_EM } from '../carreira/numeros.js';

describe('numerosDaBase', () => {
  it('quatro de professor e quatro de consultor, na ordem da grade', () => {
    expect(numerosDaBase('professor')).toEqual(['renovacao', 'nps', 'conversao', 'aderencia']);
    expect(numerosDaBase('consultor')).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
    expect(numerosDaBase('outra')).toEqual([]);
  });
});

describe('metaValida', () => {
  it('confere o limite de cada número', () => {
    expect(metaValida('renovacao', 0)).toBe(true);
    expect(metaValida('renovacao', 100)).toBe(true);
    expect(metaValida('renovacao', 101)).toBe(false);
    expect(metaValida('nps', 9.5)).toBe(true);
    expect(metaValida('nps', 10.5)).toBe(false);
    expect(metaValida('conversao', -3)).toBe(true);
    expect(metaValida('conversao', -51)).toBe(false);
    expect(metaValida('vendas', 15000)).toBe(true);
    expect(metaValida('renovacao', '45')).toBe(false);
    expect(metaValida('renovacao', NaN)).toBe(false);
    expect(metaValida('desconhecido', 1)).toBe(false);
  });
});

describe('metaBatida', () => {
  it('sem meta ou sem resultado, null', () => {
    expect(metaBatida('renovacao', { valor: 50, meta: null })).toBeNull();
    expect(metaBatida('renovacao', { valor: null, meta: 45 })).toBeNull();
  });

  it('a renovação, a nota, a aderência e a meta diária batem ao chegar na meta', () => {
    expect(metaBatida('renovacao', { valor: 45, meta: 45 })).toBe(true);
    expect(metaBatida('renovacao', { valor: 44, meta: 45 })).toBe(false);
    expect(metaBatida('nps', { valor: 9.33, meta: 9 })).toBe(true);
    expect(metaBatida('nps', { valor: 8.92, meta: 9 })).toBe(false);
  });

  it('a conversão passa da academia mais os pontos; empate não bate', () => {
    expect(metaBatida('conversao', { valor: 53, meta: 0, academia: 45 })).toBe(true);
    expect(metaBatida('conversao', { valor: 45, meta: 0, academia: 45 })).toBe(false);
    expect(metaBatida('conversao', { valor: 43, meta: -3, academia: 45 })).toBe(true);
    expect(metaBatida('consultorConversao', { valor: 31, meta: 3, academia: 27 })).toBe(true);
    expect(metaBatida('conversao', { valor: 53, meta: 0, academia: null })).toBeNull();
  });
});

describe('AJUSTES e VENDAS_EM', () => {
  it('os padrões são os de hoje', () => {
    expect(AJUSTES.janelaDias.padrao).toBe(30);
    expect(AJUSTES.barra.padrao).toBe(2);
    expect(AJUSTES.faixaMax.padrao).toBe(70);
    expect(VENDAS_EM).toEqual(['reais', 'quantidade']);
    expect(NUMEROS.conversao.contraAcademia).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.numeros.test.js`
Expected: FAIL, "Failed to resolve import ../carreira/numeros.js".

- [ ] **Step 3: Write the implementation**

```js
// Os números que uma trilha pode ligar (spec 2026-11-26-plano-de-carreira-
// configuravel, "Os números e as metas"). Cada um sabe a base (professor ou
// consultor), o limite da meta e quando a meta bate. As contas moram em
// src/lib/professor/ (professor) e, a partir do PR 4, em
// src/lib/carreira/consultor.js. A ordem das chaves é a ordem da grade.
export const BASES = Object.freeze(['professor', 'consultor']);

export const NUMEROS = Object.freeze({
  renovacao: Object.freeze({ base: 'professor', nome: 'Renovação da carteira', min: 0, max: 100 }),
  nps: Object.freeze({ base: 'professor', nome: 'Nota dos alunos', min: 0, max: 10 }),
  conversao: Object.freeze({ base: 'professor', nome: 'Conversão em matrícula', min: -50, max: 50, contraAcademia: true }),
  aderencia: Object.freeze({ base: 'professor', nome: 'Aderência às aulas', min: 0, max: 100 }),
  consultorConversao: Object.freeze({ base: 'consultor', nome: 'Conversão em matrícula', min: -50, max: 50, contraAcademia: true }),
  vendas: Object.freeze({ base: 'consultor', nome: 'Vendas', min: 0, max: 10000000 }),
  consultorRenovacao: Object.freeze({ base: 'consultor', nome: 'Renovação da carteira', min: 0, max: 100 }),
  metaDiaria: Object.freeze({ base: 'consultor', nome: 'Meta diária batida', min: 0, max: 100 }),
});

export const numerosDaBase = (base) => Object.keys(NUMEROS).filter((id) => NUMEROS[id].base === base);

export function metaValida(id, valor) {
  const n = NUMEROS[id];
  return Boolean(n) && typeof valor === 'number' && Number.isFinite(valor) && valor >= n.min && valor <= n.max;
}

// true, false ou null (sem meta ou sem resultado). O número contra a academia
// bate quando passa da academia mais os pontos da meta, e empate não bate,
// como a conversão do professor de hoje. Os outros batem ao chegar na meta.
export function metaBatida(id, { valor, meta, academia = null }) {
  if (!NUMEROS[id] || meta == null || valor == null) return null;
  if (NUMEROS[id].contraAcademia) return academia == null ? null : valor > academia + meta;
  return valor >= meta;
}

// Os ajustes da trilha, cada um ligado a um número. Os padrões são os de hoje
// (src/lib/professor/metas.js).
export const AJUSTES = Object.freeze({
  janelaDias: Object.freeze({ numero: 'conversao', min: 0, max: 90, padrao: 30 }),
  barra: Object.freeze({ numero: 'aderencia', min: 1, max: 5, padrao: 2 }),
  faixaMax: Object.freeze({ numero: 'aderencia', min: 0, max: 100, padrao: 70 }),
});

export const VENDAS_EM = Object.freeze(['reais', 'quantidade']);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.numeros.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/numeros.js src/lib/__tests__/carreira.numeros.test.js
git commit -m "feat: números que uma trilha de carreira pode ligar"
```

---

### Task 4: as trilhas

**Files:**
- Create: `src/lib/carreira/trilhas.js`
- Test: `src/lib/__tests__/carreira.trilhas.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import {
  lerTrilha, nivelDaPessoa, professorDasMetas, proximoNivel, TRILHA_CONSULTOR, TRILHA_ESTAGIARIO,
  TRILHA_PROFESSOR, trilhaDaPessoa, trilhasDe, trilhaSugerida,
} from '../carreira/trilhas.js';
import { metasDe } from '../professor/metas.js';

const porId = (lista, id) => lista.find((t) => t.id === id);

describe('trilhasDe', () => {
  it('sem documento, as três prontas, na ordem', () => {
    const t = trilhasDe(null);
    expect(t.map((x) => x.id)).toEqual([TRILHA_PROFESSOR, TRILHA_ESTAGIARIO, TRILHA_CONSULTOR]);
    expect(t.every((x) => x.padrao && !x.arquivada)).toBe(true);
  });

  it('a Professor lê as metas de hoje enquanto não foi gravada', () => {
    const doc = {
      renovacao: { junior: 40, pleno: 50, senior: 60 },
      nps: { meta: 8.5 },
      conversao: { tolerancia: 3, janelaDias: 20 },
      aderencia: { barra: 3, faixaMin: 55, faixaMax: 75 },
    };
    const p = porId(trilhasDe(doc), TRILHA_PROFESSOR);
    expect(p).toMatchObject({ nome: 'Professor', base: 'professor', frequencia: 'anual', mes: 12 });
    expect(p.niveis).toEqual([
      { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
      { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
      { id: 'senior', nome: 'Sênior', mesesMinimos: null },
    ]);
    expect(p.numeros.renovacao).toEqual({ ligado: true, metas: { junior: 40, pleno: 50, senior: 60 } });
    expect(p.numeros.nps.metas).toEqual({ junior: 8.5, pleno: 8.5, senior: 8.5 });
    expect(p.numeros.conversao.metas).toEqual({ junior: -3, pleno: -3, senior: -3 });
    expect(p.numeros.aderencia.metas).toEqual({ junior: 55, pleno: 55, senior: 55 });
    expect(p.ajustes).toEqual({ janelaDias: 20, barra: 3, faixaMax: 75 });
  });

  it('tolerância 0 vira 0 ponto, e não -0', () => {
    expect(Object.is(porId(trilhasDe(null), TRILHA_PROFESSOR).numeros.conversao.metas.junior, 0)).toBe(true);
  });

  it('o Estagiário vem semestral, com 45% de renovação nos três níveis', () => {
    const e = porId(trilhasDe(null), TRILHA_ESTAGIARIO);
    expect(e).toMatchObject({ frequencia: 'semestral', mes: 6, janelaRenovacao: '12meses', sugestao: { vinculo: 'estagio', modalidadeIds: [] } });
    expect(e.niveis.map((n) => [n.nome, n.mesesMinimos])).toEqual([['Estagiário I', 6], ['Estagiário II', 6], ['Estagiário III', null]]);
    expect(Object.values(e.numeros.renovacao.metas)).toEqual([45, 45, 45]);
  });

  it('o Consultor vem com os quatro números ligados e as metas em branco', () => {
    const c = porId(trilhasDe(null), TRILHA_CONSULTOR);
    expect(c.base).toBe('consultor');
    expect(Object.keys(c.numeros)).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
    expect(Object.values(c.numeros).every((n) => n.ligado && Object.values(n.metas).every((v) => v === null))).toBe(true);
    expect(c.ajustes).toEqual({ vendasEm: 'reais' });
  });

  it('a trilha gravada vence a do código, e a nova entra na lista pela ordem', () => {
    const doc = {
      trilhas: {
        professor: {
          nome: 'Professor formado', base: 'professor', frequencia: 'anual', mes: 12, ordem: 0,
          niveis: [{ id: 'junior', nome: 'Júnior', mesesMinimos: 18 }, { id: 'senior', nome: 'Sênior', mesesMinimos: 6 }],
          numeros: { renovacao: { ligado: true, metas: { junior: 50, senior: 70 } } },
        },
        pilates: { nome: 'Professor de pilates', base: 'professor', niveis: [{ id: 'a', nome: 'A' }], ordem: 5 },
      },
    };
    const t = trilhasDe(doc);
    expect(t.map((x) => x.id)).toEqual(['professor', 'estagiario', 'consultor', 'pilates']);
    expect(t[0].nome).toBe('Professor formado');
    expect(t[0].niveis).toEqual([{ id: 'junior', nome: 'Júnior', mesesMinimos: 18 }, { id: 'senior', nome: 'Sênior', mesesMinimos: null }]);
    expect(t[0].numeros.nps).toEqual({ ligado: false, metas: { junior: null, senior: null } });
    expect(t[3]).toMatchObject({ padrao: false, nome: 'Professor de pilates' });
  });

  it('a padrão gravada sem nível volta para a do código, e a nova sem nível some', () => {
    const t = trilhasDe({ trilhas: { consultor: { nome: 'X', niveis: [] }, nova: { nome: 'Sem nível' } } });
    expect(porId(t, TRILHA_CONSULTOR).nome).toBe('Consultor');
    expect(porId(t, 'nova')).toBeUndefined();
  });

  it('a arquivada continua na lista, marcada', () => {
    const t = trilhasDe({ trilhas: { estagiario: { ...trilhasDe(null)[1], arquivada: true } } });
    expect(porId(t, TRILHA_ESTAGIARIO).arquivada).toBe(true);
  });
});

describe('lerTrilha', () => {
  it('campo fora do formato vale o padrão', () => {
    const t = lerTrilha({
      nome: '  Pilates  ', base: 'outra', frequencia: 'mensal', mes: 15, janelaRenovacao: 'x',
      niveis: [{ id: 'a', nome: 'A', mesesMinimos: 0 }, { id: 'b', nome: 'B' }],
      numeros: { renovacao: { ligado: true, metas: { a: 120, b: 60 } } },
      ajustes: { barra: 9, faixaMax: 80 },
      sugestao: { vinculo: 'outro', modalidadeIds: ['func', 3] },
    }, 'pilates');
    expect(t).toMatchObject({ id: 'pilates', nome: 'Pilates', base: 'professor', frequencia: 'anual', mes: 12, janelaRenovacao: '12meses', arquivada: false, ordem: 99 });
    expect(t.niveis).toEqual([{ id: 'a', nome: 'A', mesesMinimos: 12 }, { id: 'b', nome: 'B', mesesMinimos: null }]);
    expect(t.numeros.renovacao.metas).toEqual({ a: null, b: 60 });
    expect(t.ajustes).toEqual({ janelaDias: 30, barra: 2, faixaMax: 80 });
    expect(t.sugestao).toEqual({ vinculo: 'qualquer', modalidadeIds: ['func'] });
  });

  it('sem nível com id e nome, null', () => {
    expect(lerTrilha({ niveis: [{ id: '', nome: 'A' }] }, 'x')).toBeNull();
    expect(lerTrilha(null, 'x')).toBeNull();
  });

  it('a Professor das metas padrão é a de hoje', () => {
    const p = professorDasMetas(metasDe(null));
    expect(p.numeros.renovacao.metas).toEqual({ junior: 45, pleno: 55, senior: 65 });
    expect(p.numeros.nps.metas.junior).toBe(9);
    expect(p.ajustes).toEqual({ janelaDias: 30, barra: 2, faixaMax: 70 });
  });
});

describe('a pessoa na trilha', () => {
  const trilhas = trilhasDe(null);

  it('o professor sem trilha está na Professor; o consultor sem trilha, em nenhuma', () => {
    expect(trilhaDaPessoa({ nivel: 'pleno' }, trilhas, { professor: true }).id).toBe(TRILHA_PROFESSOR);
    expect(trilhaDaPessoa({}, trilhas)).toBeNull();
    expect(trilhaDaPessoa({ trilhaId: 'consultor' }, trilhas).id).toBe(TRILHA_CONSULTOR);
    expect(trilhaDaPessoa({ trilhaId: 'sumiu' }, trilhas, { professor: true })).toBeNull();
  });

  it('o nível que não existe na trilha é "sem nível"', () => {
    const p = porId(trilhas, TRILHA_PROFESSOR);
    expect(nivelDaPessoa({ nivel: 'pleno' }, p).nome).toBe('Pleno');
    expect(nivelDaPessoa({ nivel: 'estagiario1' }, p)).toBeNull();
    expect(nivelDaPessoa({}, null)).toBeNull();
  });

  it('o próximo nível, e null no último', () => {
    const p = porId(trilhas, TRILHA_PROFESSOR);
    expect(proximoNivel(p, 'junior').id).toBe('pleno');
    expect(proximoNivel(p, 'senior')).toBeNull();
    expect(proximoNivel(p, 'x')).toBeNull();
  });
});

describe('trilhaSugerida', () => {
  const trilhas = trilhasDe({
    trilhas: { pilates: { nome: 'Professor de pilates', base: 'professor', ordem: -1, sugestao: { vinculo: 'formado', modalidadeIds: ['pil'] }, niveis: [{ id: 'a', nome: 'A' }] } },
  });

  it('o professor formado cai na trilha da modalidade dele, ou na Professor', () => {
    expect(trilhaSugerida({ base: 'professor', modalidadeIds: ['pil'] }, trilhas).id).toBe('pilates');
    expect(trilhaSugerida({ base: 'professor', modalidadeIds: ['func'] }, trilhas).id).toBe(TRILHA_PROFESSOR);
  });

  it('o estagiário cai na Estagiário; sem vínculo conhecido, só as de formado ou qualquer', () => {
    expect(trilhaSugerida({ base: 'professor', vinculo: 'estagio', modalidadeIds: ['func'] }, trilhas).id).toBe(TRILHA_ESTAGIARIO);
    expect(trilhaSugerida({ base: 'professor', vinculo: null, modalidadeIds: ['func'] }, trilhas).id).toBe(TRILHA_PROFESSOR);
  });

  it('o consultor cai na Consultor, e a arquivada não é sugerida', () => {
    expect(trilhaSugerida({ base: 'consultor' }, trilhas).id).toBe(TRILHA_CONSULTOR);
    const arquivada = trilhasDe({ trilhas: { consultor: { ...porId(trilhas, TRILHA_CONSULTOR), arquivada: true } } });
    expect(trilhaSugerida({ base: 'consultor' }, arquivada)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.trilhas.test.js`
Expected: FAIL, "Failed to resolve import ../carreira/trilhas.js".

- [ ] **Step 3: Write the implementation**

```js
// As trilhas do plano de carreira (spec 2026-11-26-plano-de-carreira-
// configuravel, "As trilhas"). Moram em stronix_config/carreira, no campo
// `trilhas`, um mapa por id. As três padrão moram aqui, com ids fixos, e a
// gravada com o mesmo id vence a daqui. Enquanto a Professor não foi gravada,
// ela lê as metas de hoje do topo do mesmo documento (metasDe). A leitura é
// tolerante, como o metasDe: campo fora do formato vale o padrão, para um
// documento velho não derrubar a tela. Quem confere o que o gestor digita é o
// problemaDaTrilha (validacao.js).
import { metasDe } from '../professor/metas.js';
import { AJUSTES, metaValida, NUMEROS, numerosDaBase, VENDAS_EM } from './numeros.js';
import { mesesDaAvaliacao } from './periodo.js';

export const MAX_NIVEIS = 6;
export const MESES_MAX = 120;
export const TRILHA_PROFESSOR = 'professor';
export const TRILHA_ESTAGIARIO = 'estagiario';
export const TRILHA_CONSULTOR = 'consultor';
export const VINCULOS = Object.freeze(['qualquer', 'formado', 'estagio']);

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const porNivel = (niveis, f) => Object.fromEntries(niveis.map((n) => [n.id, f(n)]));

const NIVEIS_PROFESSOR = [
  { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
  { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
  { id: 'senior', nome: 'Sênior', mesesMinimos: null },
];
const NIVEIS_ESTAGIARIO = [
  { id: 'estagiario1', nome: 'Estagiário I', mesesMinimos: 6 },
  { id: 'estagiario2', nome: 'Estagiário II', mesesMinimos: 6 },
  { id: 'estagiario3', nome: 'Estagiário III', mesesMinimos: null },
];

// A trilha Professor a partir das metas de hoje (o resultado do metasDe). A
// tolerância da conversão vira pontos negativos: 3 de folga é "academia − 3".
export function professorDasMetas(m) {
  const pontos = m.conversao.tolerancia ? -m.conversao.tolerancia : 0;
  return {
    id: TRILHA_PROFESSOR,
    nome: 'Professor',
    base: 'professor',
    sugestao: { vinculo: 'formado', modalidadeIds: [] },
    frequencia: 'anual',
    mes: 12,
    janelaRenovacao: '12meses',
    niveis: NIVEIS_PROFESSOR,
    numeros: {
      renovacao: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, (n) => m.renovacao[n.id]) },
      nps: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => m.nps.meta) },
      conversao: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => pontos) },
      aderencia: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => m.aderencia.faixaMin) },
    },
    ajustes: { janelaDias: m.conversao.janelaDias, barra: m.aderencia.barra, faixaMax: m.aderencia.faixaMax },
    arquivada: false,
    ordem: 0,
  };
}

const ESTAGIARIO = {
  nome: 'Estagiário',
  base: 'professor',
  sugestao: { vinculo: 'estagio', modalidadeIds: [] },
  frequencia: 'semestral',
  mes: 6,
  janelaRenovacao: '12meses',
  niveis: NIVEIS_ESTAGIARIO,
  numeros: {
    renovacao: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 45) },
    nps: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 9) },
    conversao: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 0) },
    aderencia: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 60) },
  },
  ajustes: { janelaDias: 30, barra: 2, faixaMax: 70 },
  ordem: 1,
};

const CONSULTOR = {
  nome: 'Consultor',
  base: 'consultor',
  sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
  frequencia: 'anual',
  mes: 12,
  niveis: NIVEIS_PROFESSOR,
  numeros: Object.fromEntries(numerosDaBase('consultor').map((id) => [id, { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => null) }])),
  ajustes: { vendasEm: 'reais' },
  ordem: 2,
};

// Uma trilha gravada no formato que as telas usam, sempre com objetos novos,
// ou null quando ela não tem como ser usada (nenhum nível com id e nome).
export function lerTrilha(raw, id) {
  if (!raw || typeof raw !== 'object') return null;
  const lidos = (Array.isArray(raw.niveis) ? raw.niveis : []).filter((n) => texto(n?.id) && texto(n?.nome)).slice(0, MAX_NIVEIS);
  if (!lidos.length) return null;
  const niveis = lidos.map((n, i) => ({
    id: texto(n.id),
    nome: texto(n.nome),
    mesesMinimos: i === lidos.length - 1 ? null
      : (Number.isInteger(n.mesesMinimos) && n.mesesMinimos >= 1 && n.mesesMinimos <= MESES_MAX ? n.mesesMinimos : 12),
  }));
  const base = raw.base === 'consultor' ? 'consultor' : 'professor';
  const frequencia = raw.frequencia === 'semestral' ? 'semestral' : 'anual';
  const numeros = Object.fromEntries(numerosDaBase(base).map((nid) => {
    const r = raw.numeros?.[nid];
    return [nid, {
      ligado: r?.ligado === true,
      metas: porNivel(niveis, (n) => (metaValida(nid, r?.metas?.[n.id]) ? r.metas[n.id] : null)),
    }];
  }));
  const ajustes = {};
  Object.entries(AJUSTES).forEach(([k, a]) => {
    if (NUMEROS[a.numero].base !== base) return;
    const v = raw.ajustes?.[k];
    ajustes[k] = typeof v === 'number' && Number.isFinite(v) && v >= a.min && v <= a.max ? v : a.padrao;
  });
  if (base === 'consultor') ajustes.vendasEm = VENDAS_EM.includes(raw.ajustes?.vendasEm) ? raw.ajustes.vendasEm : 'reais';
  return {
    id,
    nome: texto(raw.nome) || id,
    base,
    sugestao: {
      vinculo: VINCULOS.includes(raw.sugestao?.vinculo) ? raw.sugestao.vinculo : 'qualquer',
      modalidadeIds: (Array.isArray(raw.sugestao?.modalidadeIds) ? raw.sugestao.modalidadeIds : []).filter((m) => typeof m === 'string'),
    },
    frequencia,
    mes: mesesDaAvaliacao({ frequencia, mes: raw.mes })[0],
    janelaRenovacao: raw.janelaRenovacao === 'periodo' ? 'periodo' : '12meses',
    niveis,
    numeros,
    ajustes,
    arquivada: raw.arquivada === true,
    ordem: Number.isFinite(raw.ordem) ? raw.ordem : 99,
  };
}

// Todas as trilhas da academia, as arquivadas inclusive (com `arquivada`), na
// ordem da lista. `padrao` marca as três que vêm prontas.
export function trilhasDe(doc) {
  const gravadas = doc?.trilhas && typeof doc.trilhas === 'object' ? doc.trilhas : {};
  const padroes = {
    [TRILHA_PROFESSOR]: professorDasMetas(metasDe(doc)),
    [TRILHA_ESTAGIARIO]: ESTAGIARIO,
    [TRILHA_CONSULTOR]: CONSULTOR,
  };
  const lista = [];
  new Set([...Object.keys(padroes), ...Object.keys(gravadas)]).forEach((id) => {
    const t = lerTrilha(gravadas[id], id) ?? (padroes[id] ? lerTrilha(padroes[id], id) : null);
    if (t) lista.push({ ...t, padrao: Boolean(padroes[id]) });
  });
  return lista.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// A trilha de uma pessoa: a gravada no cadastro (trilhaId), ou a Professor
// para o professor sem trilha. O consultor sem trilha fica sem. A trilha
// arquivada continua valendo para quem está nela.
export function trilhaDaPessoa(pessoa, trilhas, { professor = false } = {}) {
  const id = texto(pessoa?.trilhaId) || (professor ? TRILHA_PROFESSOR : '');
  return (trilhas || []).find((t) => t.id === id) ?? null;
}

// O nível da pessoa na trilha, ou null ("sem nível").
export const nivelDaPessoa = (pessoa, trilha) => (trilha?.niveis || []).find((n) => n.id === pessoa?.nivel) ?? null;

// O nível seguinte, ou null no último nível e no nível que não existe.
export function proximoNivel(trilha, nivelId) {
  const niveis = trilha?.niveis || [];
  const i = niveis.findIndex((n) => n.id === nivelId);
  return i >= 0 ? niveis[i + 1] ?? null : null;
}

// A trilha que o sistema sugere: entre as não arquivadas da base da pessoa, a
// primeira na ordem da lista cujo vínculo combina e, no professor, cujas
// modalidades cruzam com as dele (trilha sem modalidade serve para todas).
// Vínculo Estágio quer as trilhas de estágio; qualquer outro vínculo, e o
// vínculo desconhecido (o cadastro da equipe ainda não está no ar), quer as
// de formado. As de vínculo "qualquer" servem para todos.
export function trilhaSugerida({ base, vinculo = null, modalidadeIds = [] }, trilhas) {
  const quer = vinculo === 'estagio' ? 'estagio' : 'formado';
  return (trilhas || []).find((t) => !t.arquivada && t.base === base
    && (t.sugestao.vinculo === 'qualquer' || t.sugestao.vinculo === quer)
    && (base !== 'professor' || !t.sugestao.modalidadeIds.length || t.sugestao.modalidadeIds.some((m) => modalidadeIds.includes(m)))) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.trilhas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/trilhas.js src/lib/__tests__/carreira.trilhas.test.js
git commit -m "feat: trilhas de carreira padrão e a leitura do documento"
```

---

### Task 5: o que o sistema recusa numa trilha

**Files:**
- Create: `src/lib/carreira/validacao.js`
- Test: `src/lib/__tests__/carreira.validacao.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { podeArquivar, problemaDaTrilha } from '../carreira/validacao.js';
import { trilhasDe } from '../carreira/trilhas.js';

const trilha = (id = 'professor') => structuredClone(trilhasDe(null).find((t) => t.id === id));
const problema = (t, ctx) => problemaDaTrilha(t, ctx)?.campo ?? null;

describe('problemaDaTrilha', () => {
  it('as três padrão passam', () => {
    expect(problemaDaTrilha(trilha('professor'))).toBeNull();
    expect(problemaDaTrilha(trilha('estagiario'))).toBeNull();
    expect(problemaDaTrilha(trilha('consultor'))).toBeNull();
  });

  it('nome vazio ou repetido em outra trilha não arquivada', () => {
    expect(problema({ ...trilha(), nome: '  ' })).toBe('nome');
    const outras = [{ id: 'x', nome: 'professor', arquivada: false }];
    expect(problemaDaTrilha(trilha(), { outras })).toEqual({ campo: 'nome', texto: 'Já existe uma trilha com esse nome.' });
    expect(problema(trilha(), { outras: [{ ...outras[0], arquivada: true }] })).toBeNull();
    expect(problema(trilha(), { outras: [{ id: 'professor', nome: 'Professor' }] })).toBeNull();
  });

  it('de 1 a 6 níveis, com nome e sem repetir', () => {
    expect(problema({ ...trilha(), niveis: [] })).toBe('niveis');
    const sete = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, nome: `N${i}`, mesesMinimos: 6 }));
    expect(problema({ ...trilha(), niveis: sete })).toBe('niveis');
    const t = trilha();
    t.niveis[1].nome = '';
    expect(problema(t)).toBe('nivel-1');
    const r = trilha();
    r.niveis[2].nome = 'júnior';
    expect(problemaDaTrilha(r)).toEqual({ campo: 'nivel-2', texto: 'Dois níveis têm o mesmo nome.' });
  });

  it('tempo mínimo inteiro de 1 a 120 meses, menos no último nível', () => {
    const t = trilha();
    t.niveis[0].mesesMinimos = 0;
    expect(problema(t)).toBe('meses-0');
    t.niveis[0].mesesMinimos = 1.5;
    expect(problema(t)).toBe('meses-0');
    t.niveis[0].mesesMinimos = 121;
    expect(problema(t)).toBe('meses-0');
    t.niveis[0].mesesMinimos = 12;
    t.niveis[2].mesesMinimos = null;
    expect(problema(t)).toBeNull();
  });

  it('meta fora do limite do número ligado; meta em branco passa', () => {
    const t = trilha();
    t.numeros.renovacao.metas.junior = 101;
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meta-renovacao-junior', texto: 'Use um número de 0 a 100.' });
    t.numeros.renovacao.metas.junior = null;
    expect(problema(t)).toBeNull();
    t.numeros.nps.metas.pleno = 10.5;
    expect(problema(t)).toBe('meta-nps-pleno');
    t.numeros.nps.ligado = false;
    expect(problema(t)).toBeNull();
  });

  it('ajuste fora do limite só conta com o número ligado', () => {
    const t = trilha();
    t.ajustes.barra = 0;
    expect(problema(t)).toBe('ajuste-barra');
    t.numeros.aderencia.ligado = false;
    expect(problema(t)).toBeNull();
    const c = trilha();
    c.ajustes.janelaDias = 91;
    expect(problema(c)).toBe('ajuste-janelaDias');
  });

  it('a meta da aderência fica abaixo do fim da faixa', () => {
    const t = trilha();
    t.numeros.aderencia.metas.senior = 70;
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meta-aderencia-senior', texto: 'A meta precisa ficar abaixo do fim da faixa.' });
  });

  it('as vendas do consultor contam em reais ou em quantidade', () => {
    const c = trilha('consultor');
    c.ajustes.vendasEm = 'dolar';
    expect(problema(c)).toBe('ajuste-vendasEm');
    c.numeros.vendas.ligado = false;
    expect(problema(c)).toBeNull();
  });

  it('com gente na trilha, a base não muda e o nível com gente não sai', () => {
    const gravada = trilha();
    const outraBase = { ...trilha(), base: 'consultor', numeros: {} };
    expect(problema(outraBase, { gravada, pessoasPorNivel: { junior: 2 } })).toBe('base');
    expect(problema(outraBase, { gravada, pessoasPorNivel: {} })).toBeNull();
    const semPleno = trilha();
    semPleno.niveis = semPleno.niveis.filter((n) => n.id !== 'pleno');
    expect(problemaDaTrilha(semPleno, { gravada, pessoasPorNivel: { pleno: 1 } }))
      .toEqual({ campo: 'niveis', texto: 'Pleno tem gente. Passe as pessoas para outro nível antes de apagar.' });
    expect(problema(semPleno, { gravada, pessoasPorNivel: { junior: 3 } })).toBeNull();
  });
});

describe('podeArquivar', () => {
  it('só a trilha sem ninguém', () => {
    expect(podeArquivar({})).toBe(true);
    expect(podeArquivar({ junior: 0 })).toBe(true);
    expect(podeArquivar({ junior: 0, pleno: 1 })).toBe(false);
    expect(podeArquivar(undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.validacao.test.js`
Expected: FAIL, "Failed to resolve import ../carreira/validacao.js".

- [ ] **Step 3: Write the implementation**

```js
// O que o sistema recusa numa trilha do plano de carreira (spec
// 2026-11-26-plano-de-carreira-configuravel, "O que o sistema recusa"). A tela
// usa o primeiro problema para dizer o que falta e roda de novo antes de
// gravar. Meta em branco não é problema: o placar mostra o número sem dizer se
// bateu.
import { AJUSTES, metaValida, NUMEROS, numerosDaBase, VENDAS_EM } from './numeros.js';
import { MAX_NIVEIS, MESES_MAX } from './trilhas.js';

const igual = (a, b) => String(a || '').trim().toLocaleLowerCase('pt-BR') === String(b || '').trim().toLocaleLowerCase('pt-BR');
const nomeDaBase = (base) => (base === 'consultor' ? 'consultores' : 'professores');
const numeroEntre = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// { campo, texto } do primeiro problema da trilha que o gestor quer gravar, ou
// null. `gravada` é a trilha como está no banco (null na trilha nova), `outras`
// são as demais trilhas da academia e `pessoasPorNivel` conta quem está em
// cada nível da gravada ({ [nivelId]: número }).
export function problemaDaTrilha(t, { gravada = null, outras = [], pessoasPorNivel = {} } = {}) {
  if (!String(t?.nome || '').trim()) return { campo: 'nome', texto: 'Dê um nome à trilha.' };
  if (outras.some((o) => !o.arquivada && o.id !== t.id && igual(o.nome, t.nome))) {
    return { campo: 'nome', texto: 'Já existe uma trilha com esse nome.' };
  }
  const niveis = t.niveis || [];
  if (niveis.length < 1 || niveis.length > MAX_NIVEIS) return { campo: 'niveis', texto: `A trilha tem de 1 a ${MAX_NIVEIS} níveis.` };
  for (let i = 0; i < niveis.length; i += 1) {
    if (!String(niveis[i].nome || '').trim()) return { campo: `nivel-${i}`, texto: `Dê um nome ao nível ${i + 1}.` };
    if (niveis.some((n, j) => j < i && igual(n.nome, niveis[i].nome))) return { campo: `nivel-${i}`, texto: 'Dois níveis têm o mesmo nome.' };
    const m = niveis[i].mesesMinimos;
    if (i < niveis.length - 1 && !(Number.isInteger(m) && m >= 1 && m <= MESES_MAX)) {
      return { campo: `meses-${i}`, texto: `Use um número de meses de 1 a ${MESES_MAX}.` };
    }
  }
  for (const id of numerosDaBase(t.base)) {
    const n = t.numeros?.[id];
    if (!n?.ligado) continue;
    for (const nivel of niveis) {
      const v = n.metas?.[nivel.id];
      if (v != null && !metaValida(id, v)) return { campo: `meta-${id}-${nivel.id}`, texto: `Use um número de ${NUMEROS[id].min} a ${NUMEROS[id].max}.` };
    }
  }
  for (const [k, a] of Object.entries(AJUSTES)) {
    if (NUMEROS[a.numero].base !== t.base || !t.numeros?.[a.numero]?.ligado) continue;
    if (!numeroEntre(t.ajustes?.[k], a.min, a.max)) return { campo: `ajuste-${k}`, texto: `Use um número de ${a.min} a ${a.max}.` };
  }
  if (t.base === 'professor' && t.numeros?.aderencia?.ligado) {
    const alta = niveis.find((nv) => (t.numeros.aderencia.metas?.[nv.id] ?? -Infinity) >= t.ajustes.faixaMax);
    if (alta) return { campo: `meta-aderencia-${alta.id}`, texto: 'A meta precisa ficar abaixo do fim da faixa.' };
  }
  if (t.base === 'consultor' && t.numeros?.vendas?.ligado && !VENDAS_EM.includes(t.ajustes?.vendasEm)) {
    return { campo: 'ajuste-vendasEm', texto: 'Escolha se as vendas contam em reais ou em quantidade.' };
  }
  const total = Object.values(pessoasPorNivel || {}).reduce((s, x) => s + (Number(x) || 0), 0);
  if (gravada && total > 0 && t.base !== gravada.base) {
    return { campo: 'base', texto: `Com gente na trilha, ela continua sendo de ${nomeDaBase(gravada.base)}.` };
  }
  const apagado = (gravada?.niveis || []).find((n) => (Number(pessoasPorNivel?.[n.id]) || 0) > 0 && !niveis.some((x) => x.id === n.id));
  if (apagado) return { campo: 'niveis', texto: `${apagado.nome} tem gente. Passe as pessoas para outro nível antes de apagar.` };
  return null;
}

// Só a trilha sem ninguém se arquiva.
export const podeArquivar = (pessoasPorNivel) => Object.values(pessoasPorNivel || {}).every((x) => !(Number(x) > 0));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.validacao.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/validacao.js src/lib/__tests__/carreira.validacao.test.js
git commit -m "feat: o que o sistema recusa numa trilha de carreira"
```

---

### Task 6: a pasta da carreira não chega a pacote

**Files:**
- Create: `src/lib/__tests__/carreiraImports.test.js`

- [ ] **Step 1: Write the test**

```js
// As contas e as trilhas do plano de carreira (src/lib/carreira/) vão ser
// lidas também pela api/, como as do professor (professorContasImports.test.js).
// Nada no caminho delas pode chegar a pacote: firebase.js inicializa o SDK do
// navegador, dailyGoal.js puxa lucide-react e funnels.js importa writeBatch.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo leitor de imports da guardianImports.test.js.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const PASTA = path.join(REPO, 'src/lib/carreira');
const relativo = (arquivo) => path.relative(REPO, arquivo).split(path.sep).join('/');

function grafoDe(entrada) {
  const arquivos = new Set();
  const pacotes = new Set();
  const visitar = (arquivo) => {
    if (arquivos.has(arquivo)) return;
    arquivos.add(arquivo);
    for (const spec of specifiersOf(readFileSync(arquivo, 'utf8'))) {
      if (spec.startsWith('.')) visitar(path.resolve(path.dirname(arquivo), spec));
      else pacotes.add(spec);
    }
  };
  visitar(entrada);
  return { arquivos: [...arquivos].map(relativo), pacotes: [...pacotes] };
}

const PROIBIDOS = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js'];
const ARQUIVOS = readdirSync(PASTA).filter((f) => f.endsWith('.js')).sort();

describe('as contas da carreira cabem na api/', () => {
  it('a pasta tem os períodos, os números, as trilhas e a validação', () => {
    expect(ARQUIVOS).toEqual(['numeros.js', 'periodo.js', 'trilhas.js', 'validacao.js']);
  });

  for (const arquivo of ARQUIVOS) {
    it(`${arquivo} não chega a pacote nenhum nem a módulo do navegador`, () => {
      const { arquivos, pacotes } = grafoDe(path.join(PASTA, arquivo));
      expect(pacotes).toEqual([]);
      expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx') || f.startsWith('src/lib/crm/scope') || f.startsWith('src/lib/crm/appointments'))).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/__tests__/carreiraImports.test.js src/lib/__tests__/professorContasImports.test.js`
Expected: PASS nos dois (o `ciclo.js` do professor agora chega ao `periodo.js`, que só importa `dates.js`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/carreiraImports.test.js
git commit -m "test: a pasta da carreira não chega a pacote"
```

---

### Task 7: renovação e conversão recebem o período

**Files:**
- Modify: `src/lib/professor/renovacao.js:18,35-36,67-69`
- Modify: `src/lib/professor/conversao.js:17,37-41,52-55,67-71`
- Test: `src/lib/__tests__/professor.renovacao.test.js:22-24`, `src/lib/__tests__/professor.carteira.test.js:4,104`, `src/lib/__tests__/professor.conversao.test.js`

- [ ] **Step 1: Change the tests to pass the period**

Em `src/lib/__tests__/professor.renovacao.test.js`, o ajudante da linha 22 passa a mandar o período (o import de `limitesDoCiclo` já existe na linha 5):

```js
const conta = ({ raw, leads, ciclo = 2027, asOf = ASOF }) => renovacaoDoCiclo({
  leads, contratos: normalizeContracts(raw), planos: PLANOS, professor: PROF, periodo: limitesDoCiclo(ciclo), asOf,
});
```

Em `src/lib/__tests__/professor.carteira.test.js`, acrescente o import depois da linha 4:

```js
import { limitesDoCiclo } from '../professor/ciclo.js';
```

e troque, na linha 104, `ciclo: 2027` por `periodo: limitesDoCiclo(2027)`:

```js
  const linhas = carteiraDoCiclo({ leads, contratos: normalizeContracts(raw), planos: PLANOS, professor: PROF, periodo: limitesDoCiclo(2027), asOf: ASOF });
```

Em `src/lib/__tests__/professor.conversao.test.js`, acrescente o import depois da linha 3 e troque todo `ciclo: AAAA` das chamadas:

```bash
sed -i '' -e "3a\\
import { limitesDoCiclo } from '../professor/ciclo.js';
" -e 's/ciclo: \(20[0-9][0-9]\)/periodo: limitesDoCiclo(\1)/g' src/lib/__tests__/professor.conversao.test.js
grep -n "ciclo" src/lib/__tests__/professor.conversao.test.js
```

Expected do grep: só o import, as chamadas com `periodo: limitesDoCiclo(...)` e os textos dos `it` ("fora do ciclo", "avisa o ciclo").

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/professor.renovacao.test.js src/lib/__tests__/professor.carteira.test.js src/lib/__tests__/professor.conversao.test.js`
Expected: FAIL. As contas ainda leem `ciclo`, que chega `undefined`, e não acham nenhum contrato nem aula.

- [ ] **Step 3: Change `renovacao.js`**

Tire a linha 18 (`import { limitesDoCiclo } from './ciclo.js';`). Troque a assinatura e a primeira linha da `renovacaoDoCiclo`:

```js
// { venceram, renovados, taxa, linhas: [{ contrato, lead, renovou }] }.
// `periodo` é { inicio, fim }, com fim fora (src/lib/carreira/periodo.js).
export function renovacaoDoCiclo({ leads, contratos, planos, professor, periodo, asOf = new Date() }) {
  const { inicio, fim } = periodo;
```

e a assinatura e a chamada da `carteiraDoCiclo`:

```js
export function carteiraDoCiclo({ leads, contratos, planos, professor, periodo, asOf = new Date() }) {
  const porLead = new Map();
  renovacaoDoCiclo({ leads, contratos, planos, professor, periodo, asOf }).linhas.forEach((l) => {
```

- [ ] **Step 4: Change `conversao.js`**

Tire a linha 17 (`import { limitesDoCiclo } from './ciclo.js';`). Troque a função dos registros:

```js
// Os registros de aula com "Compareceu" do período, sem visita e sem treino
// sozinho, ainda com as aulas da janela.
function vieramNoPeriodo(aulas, { inicio, fim }) {
  return (aulas || []).filter((r) => {
    const at = getSafeDateOrNull(r?.scheduledFor);
    return Boolean(r?.leadId) && isAulaRecord(r) && r.status === AULA_STATUS.ATTENDED && !isSoloTrainingRecord(r)
      && Boolean(at) && at >= inicio && at < fim;
  });
}
```

o começo da `conversaoDoCiclo`:

```js
export function conversaoDoCiclo({ aulas, contratos, professorId, periodo, asOf = new Date(), janelaDias = 30, tolerancia = 0 }) {
  const { inicio } = periodo;
  const corte = asOf.getTime() - janelaDias * DAY_MS;
  const vieram = vieramNoPeriodo(aulas, periodo).filter((r) => getSafeDateOrNull(r.scheduledFor).getTime() < corte);
```

e o começo da `pessoasDasAulas`:

```js
export function pessoasDasAulas({ aulas, contratos, professorId, periodo, asOf = new Date(), janelaDias = 30 }) {
  const corte = asOf.getTime() - janelaDias * DAY_MS;
  const comContratoPago = new Set((contratos || []).filter(contratoPago).map((c) => c.leadId));
  const porLead = new Map();
  vieramNoPeriodo(aulas, periodo).filter((r) => r.professorId === professorId).forEach((r) => {
```

(o resto das duas funções não muda).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/professor.renovacao.test.js src/lib/__tests__/professor.carteira.test.js src/lib/__tests__/professor.conversao.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/professor/renovacao.js src/lib/professor/conversao.js src/lib/__tests__/professor.renovacao.test.js src/lib/__tests__/professor.carteira.test.js src/lib/__tests__/professor.conversao.test.js
git commit -m "refactor: renovação e conversão do professor recebem o período"
```

---

### Task 8: a aderência recebe os pedaços

**Files:**
- Modify: `src/lib/professor/aderencia.js:20,85-101`
- Test: `src/lib/__tests__/professor.aderencia.test.js`

- [ ] **Step 1: Change the tests to pass the pieces**

```bash
sed -i '' -e "3a\\
import { semestresDoCiclo } from '../professor/ciclo.js';
" -e 's/(linhas, 2027, /(linhas, semestresDoCiclo(2027), /g' -e 's/(\[\], 2027, /([], semestresDoCiclo(2027), /g' src/lib/__tests__/professor.aderencia.test.js
grep -n "2027, new Date\|semestresDoCiclo" src/lib/__tests__/professor.aderencia.test.js
```

Expected do grep: o import e as chamadas de `aderenciaDoAno` e `aderenciaResumo` com `semestresDoCiclo(2027)`, e nenhuma com `2027, new Date` sobrando.

Acrescente no fim do arquivo o caso dos três pedaços (avaliação em março):

```js
describe('aderência com outro calendário', () => {
  it('a nota é a média dos pedaços fechados, quantos forem', () => {
    const pecas = [
      { inicio: new Date('2027-03-01T00:00:00'), fim: new Date('2027-07-01T00:00:00') },
      { inicio: new Date('2027-07-01T00:00:00'), fim: new Date('2027-12-01T00:00:00') },
      { inicio: new Date('2028-01-01T00:00:00'), fim: new Date('2028-03-01T00:00:00') },
    ];
    const linhas = [
      { semana: '2027-04-05', contam: 10, aderentes: 6 },
      { semana: '2027-08-02', contam: 10, aderentes: 7 },
      { semana: '2028-01-10', contam: 10, aderentes: 8 },
    ];
    expect(aderenciaDoAno(linhas, pecas, new Date('2028-03-05T12:00:00')).nota).toBe(70);
    expect(aderenciaResumo(linhas, pecas, new Date('2027-05-10T12:00:00'))).toMatchObject({ taxa: 60, emAndamento: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js`
Expected: FAIL. A `aderenciaDoAno` ainda chama `semestresDoCiclo` com a lista de pedaços.

- [ ] **Step 3: Change `aderencia.js`**

Tire a linha 20 (`import { semestresDoCiclo } from './ciclo.js';`) e troque as duas funções do fim:

```js
// Os pedaços do período (pecasDaAderencia, em src/lib/carreira/periodo.js) e
// a nota: a média das taxas dos pedaços fechados (fim até o corte). Com um só
// fechado, vale ele.
export function aderenciaDoAno(linhas, pecas, asOf = new Date()) {
  const semestres = (pecas || []).map((s) => ({ ...s, fechado: s.fim <= asOf, ...aderenciaDoSemestre(linhas, s) }));
  const taxas = semestres.filter((s) => s.fechado && s.taxa != null).map((s) => s.taxa);
  return { semestres, nota: taxas.length ? Math.round(taxas.reduce((a, b) => a + b, 0) / taxas.length) : null };
}

// O número da lista e do placar: a nota quando já há pedaço fechado; antes
// disso, a taxa do pedaço em andamento (emAndamento). Null sem semana.
export function aderenciaResumo(linhas, pecas, asOf = new Date()) {
  const ano = aderenciaDoAno(linhas, pecas, asOf);
  if (ano.nota != null) return { ...ano, taxa: ano.nota, emAndamento: false };
  const atual = [...ano.semestres].reverse().find((sm) => sm.inicio <= asOf && sm.taxa != null) ?? null;
  return { ...ano, taxa: atual?.taxa ?? null, emAndamento: atual != null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/professor/aderencia.js src/lib/__tests__/professor.aderencia.test.js
git commit -m "refactor: aderência do professor recebe os pedaços do período"
```

---

### Task 9: a pesquisa conta pela data em que abre

O campo `ciclo` sai do formulário e deixa de ser lido. Ele continua gravado, com o ano do início, porque a regra do Firestore da pesquisa encerrada compara `request.resource.data.ciclo == resource.data.ciclo`, e uma pesquisa sem o campo seria recusada ao encerrar. Ninguém lê esse valor.

**Files:**
- Modify: `src/lib/professor/pesquisas.js:8,26-31,33-39,47,58-66,132-140`
- Modify: `src/views/professores/PesquisaForm.jsx:5,7,42-50,133-139,189`
- Modify: `src/views/professores/PesquisasTab.jsx:12,30,226`
- Modify: `src/views/professores/pesquisasTexto.js:18-19`
- Test: `src/lib/__tests__/professor.pesquisas.test.js`, `src/lib/__tests__/pesquisasTab.behavior.test.js:179`, `src/lib/__tests__/pesquisasTexto.test.js:2,10-11`

- [ ] **Step 1: Change the tests**

Em `src/lib/__tests__/professor.pesquisas.test.js`:

1. Tire `ciclosDaPesquisa, ` do import da linha 4 e apague o bloco `describe('ciclosDaPesquisa', ...)` inteiro (linhas 15 a 22).
2. No teste "recusa datas, ciclo e perguntas fora da regra", troque o nome para "recusa datas e perguntas fora da regra" e as duas linhas que esperam `campo: 'ciclo'` por uma que diz que o ciclo não é mais conferido:

```js
    expect(problemaDaPesquisa(form({ ciclo: null }))).toBeNull();
```

3. Acrescente, no topo do arquivo, depois dos imports:

```js
const ANUAL_DEZ = { frequencia: 'anual', mes: 12 };
const SEM_JUN = { frequencia: 'semestral', mes: 6 };
```

4. Troque os parâmetros `ciclo: 2027` das chamadas de `npsDoCiclo` pela trilha e a chave:

```bash
sed -i '' -e "s/^      ciclo: 2027,$/      trilha: ANUAL_DEZ, chave: '2027',/" -e "s/professorId: 'p1', ciclo: 2027 })/professorId: 'p1', trilha: ANUAL_DEZ, chave: '2027' })/" src/lib/__tests__/professor.pesquisas.test.js
grep -n "ciclo: 2027" src/lib/__tests__/professor.pesquisas.test.js
```

Expected do grep: só as fábricas de pesquisa e de formulário (`form()`, `pesquisa()` e o objeto esperado do `paraGravar`), nunca um parâmetro de `npsDoCiclo`.

5. Acrescente dentro do `describe('npsDoCiclo', ...)`:

```js
  it('a pesquisa conta pela data em que abre, e o ciclo gravado não importa', () => {
    const r = npsDoCiclo({
      pesquisas: [pesquisa('dez', '2027-12-01', { ciclo: 2028 }), pesquisa('jan', '2028-01-10', { ciclo: 2027 })],
      totais: [],
      professorId: 'p1',
      trilha: ANUAL_DEZ,
      chave: '2027',
    });
    expect(r.itens.map((i) => i.pesquisa.id)).toEqual(['dez']);
  });

  it('no semestral, a de junho conta no primeiro e a de dezembro no segundo', () => {
    const pesquisas = [pesquisa('jun', '2027-06-01'), pesquisa('dez', '2027-12-01')];
    const ids = (chave) => npsDoCiclo({ pesquisas, totais: [], professorId: 'p1', trilha: SEM_JUN, chave }).itens.map((i) => i.pesquisa.id);
    expect(ids('2027-1')).toEqual(['jun']);
    expect(ids('2027-2')).toEqual(['dez']);
  });
```

6. Acrescente no fim do arquivo:

```js
describe('paraGravar e o ciclo', () => {
  it('grava o ano do início no ciclo, só para a regra da pesquisa encerrada', () => {
    expect(paraGravar(form({ inicio: '2027-12-01', fim: '2027-12-15' })).ciclo).toBe(2027);
    expect(novaPesquisa()).not.toHaveProperty('ciclo');
  });
});
```

Em `src/lib/__tests__/pesquisasTab.behavior.test.js`, troque a linha 179 por:

```js
    expect(container.querySelector('#pesq-ciclo')).toBeNull();
```

Em `src/lib/__tests__/pesquisasTexto.test.js`, tire `cicloCurto, cicloLongo, ` do import da linha 2 e apague as linhas 10 e 11 (os dois `expect` do ciclo). Se o `it` delas ficar vazio, apague o `it`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/professor.pesquisas.test.js src/lib/__tests__/pesquisasTab.behavior.test.js src/lib/__tests__/pesquisasTexto.test.js`
Expected: FAIL. O `npsDoCiclo` ainda filtra por `p.ciclo`, o formulário ainda tem o campo do ciclo e o `problemaDaPesquisa` ainda o confere.

- [ ] **Step 3: Change `pesquisas.js`**

Troque o import da linha 8:

```js
import { chaveDaPesquisa } from '../carreira/periodo.js';
```

Apague a `ciclosDaPesquisa` e o comentário dela (linhas 26 a 31). A pesquisa nova perde o ciclo:

```js
export const novaPesquisa = () => ({
  nome: '',
  inicio: '',
  fim: '',
  perguntas: [{ texto: PERGUNTA_PRINCIPAL_PADRAO, principal: true }],
});
```

Apague, no `problemaDaPesquisa`, a linha que confere o ciclo (`if (!ciclosDaPesquisa(f.inicio).includes(f.ciclo)) ...`). No `paraGravar`, troque `ciclo: f.ciclo,` por:

```js
    // Ninguém lê: a pesquisa conta pela data em que abre (chaveDaPesquisa). O
    // campo fica porque a regra da pesquisa encerrada compara o ciclo.
    ciclo: Number(f.inicio.slice(0, 4)),
```

E troque o comentário e o começo do `npsDoCiclo`:

```js
// O NPS do professor no período: as pesquisas que contam na avaliação da
// chave (pela data em que abrem, chaveDaPesquisa), que já abriram e têm turma
// dele, cada uma com o npsDe (a turma é a da pesquisa), a nota do período e a
// porcentagem de promotores da principal, somada das pesquisas válidas.
// `totais` é a lista de stronix_nps_totais ({ pesquisaId, professorId, ... }).
export function npsDoCiclo({ pesquisas, totais, professorId, trilha, chave, meta = 9 }) {
  const porId = new Map((totais || []).map((t) => [`${t.pesquisaId}_${t.professorId}`, t]));
  const itens = (pesquisas || [])
    .filter((p) => chaveDaPesquisa(trilha, p.inicio) === chave && p.situacao !== 'rascunho' && !nuncaRecebeu(p) && Number(p.turmas?.[professorId]) > 0)
```

(o resto da função não muda).

- [ ] **Step 4: Change the form, the list and the texts**

Em `src/views/professores/PesquisaForm.jsx`:

- tire `ciclosDaPesquisa, ` do import da linha 5 e `cicloLongo, ` do import da linha 7;
- apague a linha `const ciclos = ciclosDaPesquisa(form.inicio);` e troque o `mudar` por:

```js
  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
```

- apague o bloco do campo "Conta para o ciclo" (o `<div>` com o `label htmlFor="pesq-ciclo"` e o `<select id="pesq-ciclo">`, linhas 133 a 139);
- apague, no resumo do passo 3, a linha `<dt className="text-muted-foreground">Ciclo</dt><dd ...>...</dd>` (linha 189).

Em `src/views/professores/PesquisasTab.jsx`:

- troque o import da linha 12 por `import { diaTexto, periodoTexto, prazoTexto } from './pesquisasTexto.js';`;
- tire `ciclo: p.ciclo ?? null, ` do `doForm` da linha 30;
- apague o `<span>` da linha 226 que mostra `cicloCurto(p.ciclo)`.

Em `src/views/professores/pesquisasTexto.js`, apague as linhas 18 e 19 (`cicloCurto` e `cicloLongo`).

Confira que nada mais usa o que saiu:

```bash
grep -rn "ciclosDaPesquisa\|cicloCurto\|cicloLongo\|pesq-ciclo" src
```

Expected: só a linha 179 do `pesquisasTab.behavior.test.js`, que procura `#pesq-ciclo` para dizer que ele não existe. Qualquer outra linha é sobra.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/professor.pesquisas.test.js src/lib/__tests__/pesquisasTab.behavior.test.js src/lib/__tests__/pesquisasTexto.test.js src/lib/__tests__/npsWrites.test.js src/lib/__tests__/npsRules.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/professor/pesquisas.js src/views/professores/PesquisaForm.jsx src/views/professores/PesquisasTab.jsx src/views/professores/pesquisasTexto.js src/lib/__tests__/professor.pesquisas.test.js src/lib/__tests__/pesquisasTab.behavior.test.js src/lib/__tests__/pesquisasTexto.test.js
git commit -m "feat: a pesquisa de NPS conta pela data em que abre"
```

---

### Task 10: o hook e as telas passam o período e a trilha

**Files:**
- Modify: `src/hooks/useProfessoresDados.js:8,84-100`
- Modify: `src/views/professores/ProfessoresView.jsx:10,35,44-62`
- Modify: `src/views/professores/ProfessorPerfilView.jsx:14,46,58-73`

- [ ] **Step 1: The hook returns the tracks**

Em `src/hooks/useProfessoresDados.js`, acrescente o import depois da linha 8:

```js
import { TRILHA_PROFESSOR, trilhasDe } from '../lib/carreira/trilhas.js';
```

Depois da linha `const metas = useMemo(() => (carreira ? metasDe(carreira.doc) : null), [carreira]);`, acrescente:

```js
  // As trilhas do plano de carreira, do mesmo documento. A Professor, enquanto
  // não foi gravada, sai das metas de hoje (trilhasDe).
  const trilhas = useMemo(() => (carreira ? trilhasDe(carreira.doc) : null), [carreira]);
  const trilhaProfessor = useMemo(() => trilhas?.find((t) => t.id === TRILHA_PROFESSOR) ?? null, [trilhas]);
```

e devolva os dois no objeto de retorno, junto de `metas`:

```js
    trilhas,
    trilhaProfessor,
```

- [ ] **Step 2: The list passes the period**

Em `src/views/professores/ProfessoresView.jsx`, troque o import da linha 10:

```js
import { cicloDe, limitesDoCiclo, semestresDoCiclo } from '../../lib/professor/ciclo.js';
```

Acrescente `trilhaProfessor` à desestruturação de `dados` (linha 35):

```js
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas, metas, salvarMetas, trilhaProfessor } = dados;
```

E troque o `useMemo` das contas (linhas 44 a 62):

```js
  const contas = useMemo(() => {
    if (carregando || !metas || nps.carregando) return null;
    const { janelaDias, tolerancia } = metas.conversao;
    const periodo = limitesDoCiclo(ciclo);
    const pecas = semestresDoCiclo(ciclo);
    const chave = String(ciclo);
    const linhas = ativos.map((prof) => {
      const renovacao = renovacaoDoCiclo({ leads: clientes, contratos, planos, professor: prof, periodo, asOf: agora });
      const conversao = conversaoDoCiclo({ aulas, contratos, professorId: prof.id, periodo, asOf: agora, janelaDias, tolerancia });
      return {
        prof,
        criterios: {
          renovacao: criterioRenovacao(renovacao, metas, prof.nivel),
          nps: criterioNps(npsDoCiclo({ pesquisas: nps.pesquisas, totais: nps.totais, professorId: prof.id, trilha: trilhaProfessor, chave, meta: metas.nps.meta }), metas),
          conversao: criterioConversao(conversao),
          aderencia: criterioAderencia(aderenciaResumo(aderenciaPorSemana({ presencas, leads: clientes, contratos, planos, professor: prof, asOf: agora, barra: metas.aderencia.barra }), pecas, agora), metas),
        },
      };
    });
    // A academia é a mesma para todos; sai da conta sem filtro de professor.
    const academia = conversaoDoCiclo({ aulas, contratos, professorId: null, periodo, asOf: agora, janelaDias, tolerancia });
    return { linhas, academia };
  }, [carregando, metas, nps.carregando, nps.pesquisas, nps.totais, ativos, clientes, contratos, planos, aulas, presencas, ciclo, agora, trilhaProfessor]);
```

- [ ] **Step 3: The profile passes the period**

Em `src/views/professores/ProfessorPerfilView.jsx`, troque o import da linha 14:

```js
import { cicloDe, limitesDoCiclo, semestresDoCiclo } from '../../lib/professor/ciclo.js';
```

Acrescente `trilhaProfessor` à desestruturação do `useProfessoresDados` (linha 46):

```js
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas, metas, trilhaProfessor } = useProfessoresDados({ db, ciclo, listenersActive });
```

No `useMemo` das contas (linhas 58 a 73), troque as linhas que montam `base` e `daAula`:

```js
    const periodo = limitesDoCiclo(ciclo);
    const base = { leads: clientes, contratos, planos, professor: prof, periodo, asOf: agora };
    const daAula = { aulas, contratos, professorId: prof.id, periodo, asOf: agora, janelaDias };
```

e as chamadas da aderência e do NPS:

```js
      aderencia: aderenciaResumo(semanas, semestresDoCiclo(ciclo), agora),
      nps: npsDoCiclo({ pesquisas: nps.pesquisas, totais: nps.totais, professorId: prof.id, trilha: trilhaProfessor, chave: String(ciclo), meta: metas.nps.meta }),
```

e acrescente `trilhaProfessor` à lista de dependências do `useMemo`.

Sem trilha (os testes de tela trocam o hook por um falso que não a devolve), o `chaveDaPesquisa` cai na trilha anual de dezembro, que é a de hoje.

- [ ] **Step 4: Run the screen tests**

Run: `npx vitest run src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/professorPerfil.behavior.test.js`
Expected: PASS, sem mudar os testes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProfessoresDados.js src/views/professores/ProfessoresView.jsx src/views/professores/ProfessorPerfilView.jsx
git commit -m "refactor: telas de professores passam o período e a trilha às contas"
```

---

### Task 11: o CLAUDE.md e a verificação inteira

**Files:**
- Modify: `CLAUDE.md` (seção nova depois de "## Perfil do professor")

- [ ] **Step 1: Write the section**

Acrescente depois da seção "## Perfil do professor" do `CLAUDE.md`:

```markdown
## Plano de carreira

O gestor monta as trilhas de carreira (Consultor, Professor, Estagiário e as que criar), com níveis, tempo mínimo e metas por nível. Spec em `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md` e visão geral dos PRs em `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`. O PR 1 trouxe só as contas, sem tela nova.

- **As trilhas moram em `stronix_config/carreira`, no campo `trilhas`**, um mapa por id, e são lidas por `trilhasDe` (`src/lib/carreira/trilhas.js`). As três padrão (`professor`, `estagiario` e `consultor`) moram no código, e a gravada com o mesmo id vence a do código. Enquanto a Professor não foi gravada, ela sai das metas de hoje, no topo do mesmo documento (`professorDasMetas` sobre o `metasDe`). Os ids dos níveis da Professor são `junior`, `pleno` e `senior`, os mesmos do `nivel` já gravado nos professores.
- **O período é da trilha** (`src/lib/carreira/periodo.js`): anual ou semestral, com o mês da avaliação, e a chave `'2027'` ou `'2027-1'`. As contas do professor recebem o período (`renovacaoDoCiclo`, `carteiraDoCiclo`, `conversaoDoCiclo`, `pessoasDasAulas`), os pedaços da aderência (`aderenciaDoAno`, `aderenciaResumo`) ou a trilha e a chave (`npsDoCiclo`). O `src/lib/professor/ciclo.js` só converte o ciclo do endereço (ano) no período da trilha anual de dezembro, e o teste dele é o de equivalência com o ciclo de antes. Ele sai no PR 3.
- **A pesquisa de NPS conta pela data em que abre** (`chaveDaPesquisa`): na primeira avaliação da trilha no mês em que ela abre ou depois. O campo `ciclo` saiu do formulário e ninguém o lê, mas continua gravado com o ano do início, porque a regra da pesquisa encerrada no `firestore.rules` compara o ciclo.
- **A pasta `src/lib/carreira/` não chega a pacote** (`carreiraImports.test.js`), porque a `api/` vai ler as contas.
- **O que se recusa numa trilha** mora no `problemaDaTrilha` (`src/lib/carreira/validacao.js`): nome, níveis, tempo mínimo, limites das metas e dos ajustes, a base que não muda e o nível que não sai com gente.
```

- [ ] **Step 2: Run the whole check**

Run: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Expected: tudo verde. Se o lint reclamar de import sem uso, tire o import e rode de novo.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: plano de carreira no CLAUDE.md do Stronilead"
```

- [ ] **Step 4: Abrir o PR (só com o pedido do Johnny)**

Título: `feat: plano de carreira, PR 1 (trilhas e contas)`. Corpo: o que entrou (os quatro módulos de `src/lib/carreira/`, as contas recebendo o período, a pesquisa pela data, o campo do ciclo fora do formulário), o que não muda (nenhum número da tela, nenhuma regra do Firestore) e o teste de equivalência (`professor.ciclo.test.js` sem mudança). Depois do PR aberto, sugerir de 3 a 8 ciclos de code review.

---

## Self-review

- **Cobertura da spec no PR 1:** períodos (Task 1), números (Task 3), trilhas padrão, ponte e sugestão (Task 4), recusas (Task 5), contas do professor com o período (Tasks 7 e 8), pesquisa pela data e o ciclo fora do formulário (Task 9), equivalência (Task 2, mais as telas na Task 10). O placar lendo a trilha ficou para o PR 3, como diz a visão geral.
- **Nomes:** `periodo` (`{ inicio, fim }` ou `{ chave, inicio, fim }`) em todas as contas; `pecas` na aderência; `trilha` e `chave` no NPS; `trilhaProfessor` no hook e nas telas.
- **Fora deste PR:** a aderência semestral (soma das semanas) e a renovação pela `janelaDaRenovacao` passam a ser usadas no PR 3, quando o estagiário ganha tela; o `periodo.js` já traz as duas funções.
