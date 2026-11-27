# Plano de carreira, PR 3: menu Carreira

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o menu Professores vira Carreira. A lista e o perfil leem a trilha de cada pessoa: período, metas por nível, tempo no nível e o "Trilha e nível". O professor ganha o "Minha carreira", e a regra `carreiraKept()` impede que alguém se promova pelo próprio cadastro.

**Architecture:** as telas continuam com os ids internos `professores` e `professorPerfil`, e só os endereços mudam, para `/carreira` e `/carreira/professor/<id>`. Os endereços antigos de `/professores` levam aos novos com replace. As contas novas são funções puras em `src/lib/carreira/` (`placar.js` e `professor.js`) e usam as contas do professor de `src/lib/professor/`. A leitura das aulas e das presenças passa a seguir uma janela de datas: o período escolhido ou, na lista com todas as trilhas, os períodos de agora das trilhas de professor. O `src/lib/professor/ciclo.js` sai.

**Tech Stack:** React 19, Vite, Firebase (Firestore), React Router 7 sem `<Routes>`, Vitest com jsdom nos testes de tela. JavaScript e JSX, sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md`, seções "Os períodos", "A pessoa", "Menu Carreira", "Endereços" e "Regras do Firestore". Mockup: `docs/superpowers/specs/mockups/2026-11-26-carreira-lista-e-perfil.html`, nas abas "Lista Carreira", "Trilha e nível", "Metas em branco" e "Minha carreira". Visão geral dos PRs: `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`.

**Base:** a `main` com os PRs 1 e 2 (#324 e #326). Trabalhe na branch `claude/plano-de-carreira-pr3`.

---

## Decisões do plano

1. **Os ids das telas ficam.** `professores` e `professorPerfil` continuam sendo os ids de `SCREENS`, do `activeTab`, do `PROFESSOR_SCREENS` e do `sidebarNav`. Só mudam os segmentos (`['carreira']` e `['carreira', 'professor']`) e o título (`Carreira`). Renomear os ids mexeria em dezenas de testes sem mudar nada para quem usa. O PR 4 cria a tela nova `consultorPerfil`, em `['carreira', 'consultor']`.
2. **Os endereços antigos são lidos e levam aos novos.** O `readScreen` lê `/professores`, `/professores/pesquisas` e `/professores/perfil/<id>/<aba>` como antes, com `antigo: true`. Depois das travas de acesso, o `accessRedirect` leva ao endereço novo com replace, mantendo a query. O `/professores/metas` continua indo para `/configuracoes/carreira/professor`.
3. **O parâmetro `ciclo` passa a ser a chave do período** (`'2027'` ou `'2027-1'`), conferida pelo `periodoValido` da trilha. No perfil, a trilha é a da pessoa. Na lista, só vale com uma trilha escolhida na pílula (`trilha=<id>`). Com todas as trilhas, cada pessoa aparece no período de agora da trilha dela e o parâmetro não vale.
4. **O primeiro período é o que contém 1º de dezembro de 2025**, o começo do antigo ciclo 2026. Antes disso não há contrato no sistema.
5. **A leitura do `stronix_config/carreira` sai do `useProfessoresDados`.** As telas assinam o `useCarreira` antes, calculam a janela de datas com as trilhas e passam ao hook. Assim a janela já nasce certa e as aulas não são lidas duas vezes.
6. **Os números do placar saem da trilha.** Para cada número ligado: o resultado, a meta do nível de agora, a do próximo nível e o estado (`ok`, `baixo`, `sem` ou `semMeta`). Quem decide se bateu é o `metaBatida` do PR 1, e a conversão compara com a academia mais os pontos. A tolerância de hoje já vira pontos negativos na trilha Professor (`professorDasMetas`: uma folga de 3 é −3 pontos; o padrão é 0), então o resultado é o mesmo.
7. **A aderência semestral soma as semanas do período** (`aderenciaSomada`) e não tira a média dos pedaços, porque o semestral de junho e dezembro tem um pedaço de um mês (achado da revisão do PR 1). A anual continua com a média dos semestres do calendário (`aderenciaResumo`).
8. **A renovação usa a `janelaDaRenovacao` da trilha.** No anual é o período, e no semestral com "12 meses" são os 12 meses que terminam no fim do período. A aba Carteira segue a mesma janela.
9. **Abas que precisam de uma meta, como NPS e Aderência, usam a meta do nível de agora.** Sem nível, ou com a meta em branco, a aba não mostra a meta.
10. **O consultor fica fora da lista até o PR 4.** Neste PR, a pílula Trilha lista só as trilhas de professor, e o "Minha carreira" aparece só para o professor. O "Trilha e nível" do perfil oferece só as trilhas de professor.
11. **A trava do calendário da trilha Professor sai** (Task 13). Com os quatro números seguindo o período da trilha, o gestor pode pôr a Professor no semestral ou em outro mês.
12. **A regra `carreiraKept()` entra neste PR**, no ramo em que a pessoa grava o próprio cadastro em `stronix_users`. O Johnny publica no console antes do merge. Nenhuma tela deste PR grava trilha em `stronix_users`, então a trava não muda nada hoje: ela fecha a porta antes do PR 4.

## Mapa de arquivos

**Novos:**
- `src/lib/carreira/placar.js`: `alvoDe`, `estadoDe`, `placarDe`, `mesesEntre`, `duracaoTexto` e `tempoNoNivel`.
- `src/lib/carreira/professor.js`: `periodoDaPessoa`, `janelaDeLeitura`, `aderenciaDaTrilha` e `contasDoProfessor`.
- `src/views/professores/TrilhaNivelPopover.jsx`: o "Trilha e nível", no lugar do `NivelPopover.jsx`.
- `src/views/professores/PlacarDaCarreira.jsx`: o placar, no lugar do `PlacarDoCiclo.jsx`.
- Testes: `carreira.placar.test.js`, `carreira.professor.test.js`, `trilhaNivelPopover.behavior.test.js`, `placarDaCarreira.test.js` e `carreiraRules.test.js`.

**Mudam:**
- `src/lib/carreira/periodo.js`: ganha `primeiroPeriodo`, `periodoValido` e `periodoTexto`.
- `src/lib/professor/aderencia.js`: ganha `aderenciaSomada`.
- `src/lib/screenParams.js`: `ciclo` vira a chave, e entra `trilha` na lista. Sai o `PRIMEIRO_CICLO`.
- `src/hooks/useProfessoresDados.js`: recebe a janela e para de assinar o `useCarreira`.
- `src/lib/routes.js`: os segmentos novos, o `antigo` e o `hrefFor` do perfil.
- `src/lib/tenantSlug.js`: a palavra reservada `carreira`.
- `src/lib/sentryScrub.js`: `/carreira/professor/<id>`.
- `src/views/professores/ProfessoresComum.jsx`: o `CicloControl` vira `PeriodoControl`.
- `src/views/professores/criterios.js`: só os textos que o placar e a lista usam.
- `src/views/professores/ProfessoresTabela.jsx`: as colunas novas.
- `src/views/professores/ProfessoresView.jsx`, `ProfessorPerfilView.jsx`, `PerfilCabecalho.jsx`, `NpsTab.jsx`, `AderenciaTab.jsx` e `AulasTab.jsx`.
- `src/App.jsx`: rótulos do menu e do cabeçalho.
- `src/lib/carreira/validacao.js`, `src/views/settings/carreira/TrilhaRegras.jsx`, `TrilhaEditor.jsx` e `carreiraTexto.js`: sai a trava do calendário da trilha Professor.
- `firestore.rules`: `carreiraKept()`.
- `CLAUDE.md`: seção "Plano de carreira" e "Perfil do professor".

**Saem:** `src/lib/professor/ciclo.js`, `src/lib/__tests__/professor.ciclo.test.js`, `src/views/professores/NivelPopover.jsx` e `src/views/professores/PlacarDoCiclo.jsx`.

## Antes de começar

- [ ] Confirme a base e a linha de base:

```bash
git switch claude/plano-de-carreira-pr3
git log --oneline -1   # 944a417 ou depois, com os PRs #324 e #326
npm ci
npm run lint && npm test && npm run verificar:sentry && npm run build
```

Esperado: tudo verde (7.141 testes em 27/11/2026). Se o `npm ci` mudar o `package-lock.json`, desfaça e avise.

---

### Task 1: período válido e texto do período

**Files:**
- Modify: `src/lib/carreira/periodo.js` (fim do arquivo)
- Test: `src/lib/__tests__/carreira.periodo.test.js` (acrescentar um `describe`)

- [ ] **Step 1: Write the failing test**

Acrescente ao fim de `src/lib/__tests__/carreira.periodo.test.js`, e inclua `primeiroPeriodo`, `periodoValido` e `periodoTexto` no import de `../carreira/periodo.js` que já existe no topo:

```js
describe('período válido e texto do período', () => {
  const anual = { frequencia: 'anual', mes: 12 };
  const semestral = { frequencia: 'semestral', mes: 6 };
  const marco = { frequencia: 'anual', mes: 3 };
  const agora = new Date(2027, 2, 10); // 10/03/2027

  it('o primeiro período é o que contém 1º de dezembro de 2025', () => {
    expect(primeiroPeriodo(anual).chave).toBe('2026');
    expect(primeiroPeriodo(semestral).chave).toBe('2026-1');
    expect(primeiroPeriodo(marco).chave).toBe('2026');
  });

  it('vale do primeiro período até o de agora', () => {
    expect(periodoValido(anual, '2026', agora)?.chave).toBe('2026');
    expect(periodoValido(anual, '2027', agora)?.chave).toBe('2027');
    expect(periodoValido(anual, '2025', agora)).toBeNull();
    expect(periodoValido(anual, '2028', agora)).toBeNull();
    expect(periodoValido(semestral, '2027-1', agora)?.chave).toBe('2027-1');
    expect(periodoValido(semestral, '2027-2', agora)).toBeNull();
    expect(periodoValido(semestral, '2027', agora)).toBeNull();
    expect(periodoValido(anual, null, agora)).toBeNull();
    expect(periodoValido(null, '2027', agora)).toBeNull();
  });

  it('o texto vai do primeiro ao último mês do período', () => {
    expect(periodoTexto(periodoPorChave(anual, '2027'))).toBe('dez/2026 a nov/2027');
    expect(periodoTexto(periodoPorChave(semestral, '2027-1'))).toBe('dez/2026 a mai/2027');
    expect(periodoTexto(periodoPorChave(marco, '2027'))).toBe('mar/2026 a fev/2027');
    expect(periodoTexto(null)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.periodo.test.js`
Expected: FAIL, com `primeiroPeriodo is not a function`.

- [ ] **Step 3: Write minimal implementation**

Acrescente ao fim de `src/lib/carreira/periodo.js`:

```js
// O primeiro período com dado no sistema: o que contém 1º de dezembro de
// 2025, o começo do antigo ciclo 2026. Antes disso não há contrato.
export const primeiroPeriodo = (trilha) => periodoDe(trilha, new Date(2025, 11, 1));

// O período da chave quando ele vai do primeiro até o de agora; senão null.
// É quem confere o `ciclo` do endereço.
export function periodoValido(trilha, chave, agora = new Date()) {
  if (!trilha) return null;
  const p = periodoPorChave(trilha, chave);
  const primeiro = primeiroPeriodo(trilha);
  const atual = periodoDe(trilha, agora);
  if (!p || !primeiro || !atual) return null;
  return p.inicio >= primeiro.inicio && p.inicio <= atual.inicio ? p : null;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesAno = (d) => `${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}`;

// "dez/2026 a nov/2027": do mês do início ao mês antes do fim (o fim fica fora).
export function periodoTexto(periodo) {
  if (!periodo) return '';
  return `${mesAno(periodo.inicio)} a ${mesAno(new Date(periodo.fim.getFullYear(), periodo.fim.getMonth() - 1, 1))}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.periodo.test.js src/lib/__tests__/carreiraImports.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/periodo.js src/lib/__tests__/carreira.periodo.test.js
git commit -m "feat: período válido e texto do período da trilha"
```

---

### Task 2: placar e tempo no nível

**Files:**
- Create: `src/lib/carreira/placar.js`
- Test: `src/lib/__tests__/carreira.placar.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreira.placar.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { alvoDe, duracaoTexto, estadoDe, mesesEntre, placarDe, tempoNoNivel } from '../carreira/placar.js';
import { trilhasDe } from '../carreira/trilhas.js';

const [professor, estagiario, consultor] = trilhasDe(null);

describe('alvo e estado de um número', () => {
  it('o alvo é a meta, ou a academia mais os pontos no número contra a academia', () => {
    expect(alvoDe('renovacao', 50)).toBe(50);
    expect(alvoDe('conversao', 3, 27)).toBe(30);
    expect(alvoDe('conversao', -3, 27)).toBe(24);
    expect(alvoDe('conversao', 3, null)).toBeNull();
    expect(alvoDe('renovacao', null)).toBeNull();
  });

  it('sem resultado é sem; sem meta é semMeta; senão bate ou fica abaixo', () => {
    expect(estadoDe('renovacao', { valor: null, meta: 50 })).toBe('sem');
    expect(estadoDe('renovacao', { valor: 40, meta: null })).toBe('semMeta');
    expect(estadoDe('renovacao', { valor: 50, meta: 50 })).toBe('ok');
    expect(estadoDe('renovacao', { valor: 49, meta: 50 })).toBe('baixo');
    expect(estadoDe('conversao', { valor: 28, meta: 0, academia: 27 })).toBe('ok');
    expect(estadoDe('conversao', { valor: 27, meta: 0, academia: 27 })).toBe('baixo');
    expect(estadoDe('conversao', { valor: 28, meta: 0, academia: null })).toBe('sem');
  });

  it('a folga de 3 de hoje vira −3 pontos e dá o mesmo resultado', () => {
    // conversaoDoCiclo com tolerancia 3: passa com taxa > academia − 3
    expect(estadoDe('conversao', { valor: 25, meta: -3, academia: 27 })).toBe('ok');
    expect(estadoDe('conversao', { valor: 24, meta: -3, academia: 27 })).toBe('baixo');
  });
});

describe('placarDe', () => {
  it('só os números ligados, com a meta do nível e a do próximo', () => {
    const p = placarDe(professor, 'junior', { renovacao: { valor: 47 }, nps: { valor: 9.2 }, conversao: { valor: 30, academia: 27 }, aderencia: { valor: null } });
    expect(p.nivel.id).toBe('junior');
    expect(p.proximo.id).toBe('pleno');
    expect(p.itens.map((i) => i.id)).toEqual(['renovacao', 'nps', 'conversao', 'aderencia']);
    const renov = p.itens[0];
    expect(renov).toMatchObject({ valor: 47, meta: 45, metaProxima: 55, estado: 'ok' });
    expect(p.itens[3].estado).toBe('sem');
    expect(p.naMeta).toBe(3);
    expect(p.comMeta).toBe(4);
  });

  it('número desligado não aparece', () => {
    const t = { ...professor, numeros: { ...professor.numeros, nps: { ...professor.numeros.nps, ligado: false } } };
    expect(placarDe(t, 'junior', {}).itens.map((i) => i.id)).toEqual(['renovacao', 'conversao', 'aderencia']);
  });

  it('no último nível não há próxima meta; sem nível não há meta', () => {
    const ult = placarDe(professor, 'senior', { renovacao: { valor: 60 } });
    expect(ult.proximo).toBeNull();
    expect(ult.itens[0].metaProxima).toBeNull();
    const sem = placarDe(professor, 'x', { renovacao: { valor: 60 } });
    expect(sem.nivel).toBeNull();
    expect(sem.itens[0]).toMatchObject({ meta: null, estado: 'semMeta' });
    expect(sem.comMeta).toBe(0);
  });

  it('a trilha Consultor nasce com as metas em branco', () => {
    const p = placarDe(consultor, 'junior', { vendas: { valor: 12000 } });
    expect(p.itens.every((i) => i.meta == null)).toBe(true);
    expect(p.itens.find((i) => i.id === 'vendas').estado).toBe('semMeta');
  });

  it('sem trilha, nada', () => {
    expect(placarDe(null, 'junior', {})).toMatchObject({ nivel: null, proximo: null, itens: [], naMeta: 0, comMeta: 0 });
  });
});

describe('tempo no nível', () => {
  it('conta meses inteiros', () => {
    expect(mesesEntre(new Date(2026, 0, 15), new Date(2026, 1, 14))).toBe(0);
    expect(mesesEntre(new Date(2026, 0, 15), new Date(2026, 1, 15))).toBe(1);
    expect(mesesEntre(new Date(2026, 0, 31), new Date(2027, 0, 31))).toBe(12);
    expect(mesesEntre(new Date(2027, 0, 1), new Date(2026, 0, 1))).toBe(0);
  });

  it('escreve a duração em anos e meses', () => {
    expect(duracaoTexto(0)).toBe('menos de 1 mês');
    expect(duracaoTexto(1)).toBe('1 mês');
    expect(duracaoTexto(8)).toBe('8 meses');
    expect(duracaoTexto(12)).toBe('1 ano');
    expect(duracaoTexto(18)).toBe('1 ano e 6 meses');
    expect(duracaoTexto(25)).toBe('2 anos e 1 mês');
  });

  it('antes do mínimo, quanto falta; depois, cumprido; no último nível, só o tempo', () => {
    const agora = new Date(2027, 7, 1);
    expect(tempoNoNivel(professor, { nivel: 'junior', nivelDesde: new Date(2026, 11, 1) }, agora))
      .toEqual({ meses: 8, minimo: 12, pct: 67, texto: '8 meses de 1 ano', falta: 'Faltam 4 meses para Pleno' });
    expect(tempoNoNivel(professor, { nivel: 'junior', nivelDesde: new Date(2026, 0, 1) }, agora))
      .toMatchObject({ pct: 100, texto: 'Tempo mínimo cumprido', falta: null });
    expect(tempoNoNivel(professor, { nivel: 'senior', nivelDesde: new Date(2025, 7, 1) }, agora))
      .toEqual({ meses: 24, minimo: null, pct: null, texto: '2 anos no nível', falta: null });
    expect(tempoNoNivel(estagiario, { nivel: 'estagiario1', nivelDesde: new Date(2027, 4, 1) }, agora).texto).toBe('3 meses de 6 meses');
  });

  it('sem nível ou sem data, null', () => {
    expect(tempoNoNivel(professor, { nivel: 'junior' })).toBeNull();
    expect(tempoNoNivel(professor, { nivel: 'x', nivelDesde: new Date() })).toBeNull();
    expect(tempoNoNivel(null, { nivel: 'junior', nivelDesde: new Date() })).toBeNull();
  });
});
```

Os números vêm do `METAS_PADRAO` (`src/lib/professor/metas.js`, conferido em 27/11/2026): renovação de 45, 55 e 65, NPS 9, folga da conversão 0 (meta 0 pontos) e aderência a partir de 60. Se o padrão mudar, ajuste o `toMatchObject` do primeiro `placarDe` para os valores de lá, sem mexer na regra.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.placar.test.js`
Expected: FAIL, porque o arquivo `../carreira/placar.js` não existe.

- [ ] **Step 3: Write minimal implementation**

Crie `src/lib/carreira/placar.js`:

```js
// O placar da pessoa na trilha (spec 2026-11-26-plano-de-carreira-
// configuravel, "Menu Carreira"): para cada número ligado, o resultado, a meta
// do nível de agora, a do próximo nível e o estado; e o tempo no nível contra o
// mínimo. O sistema não diz se a pessoa está pronta para subir (decisão 7):
// só mostra. Puro e sem pacote (carreiraImports.test.js).
import { getSafeDateOrNull } from '../dates.js';
import { metaBatida, NUMEROS } from './numeros.js';
import { nivelDaPessoa, proximoNivel } from './trilhas.js';

// A meta em valor absoluto: no número contra a academia, a academia mais os
// pontos; sem a academia, não há alvo.
export function alvoDe(id, meta, academia = null) {
  if (meta == null) return null;
  if (!NUMEROS[id]?.contraAcademia) return meta;
  return academia == null ? null : academia + meta;
}

// 'sem' (sem resultado ou sem a academia para comparar), 'semMeta' (meta em
// branco ou sem nível), 'ok' ou 'baixo'.
export function estadoDe(id, { valor, meta, academia = null }) {
  if (valor == null) return 'sem';
  if (meta == null) return 'semMeta';
  const bateu = metaBatida(id, { valor, meta, academia });
  if (bateu == null) return 'sem';
  return bateu ? 'ok' : 'baixo';
}

// `resultados` é { [numeroId]: { valor, academia? } }. Número sem resultado
// entra como 'sem'. `naMeta` e `comMeta` dão o "3 de 4 na meta do Júnior".
export function placarDe(trilha, nivelId, resultados = {}) {
  const nivel = (trilha?.niveis || []).find((n) => n.id === nivelId) ?? null;
  const proximo = nivel ? proximoNivel(trilha, nivel.id) : null;
  const itens = Object.keys(NUMEROS)
    .filter((id) => trilha?.numeros?.[id]?.ligado === true)
    .map((id) => {
      const { valor = null, academia = null } = resultados[id] || {};
      const metas = trilha.numeros[id].metas || {};
      const meta = nivel ? metas[nivel.id] ?? null : null;
      const metaProxima = proximo ? metas[proximo.id] ?? null : null;
      return { id, nome: NUMEROS[id].nome, valor, academia, meta, metaProxima, estado: estadoDe(id, { valor, meta, academia }) };
    });
  return {
    nivel,
    proximo,
    itens,
    naMeta: itens.filter((i) => i.estado === 'ok').length,
    comMeta: itens.filter((i) => i.meta != null).length,
  };
}

// Meses inteiros de `de` até `ate`, nunca abaixo de zero.
export function mesesEntre(de, ate) {
  let m = (ate.getFullYear() - de.getFullYear()) * 12 + (ate.getMonth() - de.getMonth());
  if (ate.getDate() < de.getDate()) m -= 1;
  return Math.max(0, m);
}

export function duracaoTexto(meses) {
  if (meses < 1) return 'menos de 1 mês';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '';
  const m = resto ? `${resto} ${resto === 1 ? 'mês' : 'meses'}` : '';
  return [a, m].filter(Boolean).join(' e ');
}

// O tempo no nível contra o mínimo, ou null sem nível ou sem a data. No
// último nível não há mínimo: só o tempo.
export function tempoNoNivel(trilha, pessoa, agora = new Date()) {
  const nivel = nivelDaPessoa(pessoa, trilha);
  const desde = getSafeDateOrNull(pessoa?.nivelDesde);
  if (!nivel || !desde) return null;
  const meses = mesesEntre(desde, agora);
  const proximo = proximoNivel(trilha, nivel.id);
  if (!proximo || nivel.mesesMinimos == null) {
    return { meses, minimo: null, pct: null, texto: `${duracaoTexto(meses)} no nível`, falta: null };
  }
  const minimo = nivel.mesesMinimos;
  if (meses >= minimo) return { meses, minimo, pct: 100, texto: 'Tempo mínimo cumprido', falta: null };
  return {
    meses,
    minimo,
    pct: Math.round((meses / minimo) * 100),
    texto: `${duracaoTexto(meses)} de ${duracaoTexto(minimo)}`,
    falta: `Faltam ${duracaoTexto(minimo - meses)} para ${proximo.nome}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.placar.test.js src/lib/__tests__/carreiraImports.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/placar.js src/lib/__tests__/carreira.placar.test.js
git commit -m "feat: placar da trilha e tempo no nível"
```

---

### Task 3: aderência somada no semestral

**Files:**
- Modify: `src/lib/professor/aderencia.js` (depois do `aderenciaResumo`)
- Test: `src/lib/__tests__/professor.aderencia.test.js`

- [ ] **Step 1: Write the failing test**

No topo de `src/lib/__tests__/professor.aderencia.test.js`, troque o import do `semestresDoCiclo` (o `ciclo.js` sai na Task 12) por:

```js
import { pecasDaAderencia } from '../carreira/periodo.js';

const semestresDoCiclo = (ciclo) => pecasDaAderencia({ inicio: new Date(ciclo - 1, 11, 1), fim: new Date(ciclo, 11, 1) });
```

e inclua `aderenciaSomada` no import de `../professor/aderencia.js`. Acrescente ao fim do arquivo:

```js
describe('aderência somada (semestral)', () => {
  // Semestral de junho e dezembro, 2º período: junho (um pedaço) e julho a novembro (outro).
  const pecas = pecasDaAderencia({ inicio: new Date(2027, 5, 1), fim: new Date(2027, 11, 1) });
  const linhas = [
    { semana: '2027-06-07', contam: 10, aderentes: 2 },
    { semana: '2027-07-05', contam: 40, aderentes: 32 },
  ];

  it('soma as semanas dos pedaços, sem tirar a média deles', () => {
    expect(pecas).toHaveLength(2);
    const r = aderenciaSomada(linhas, pecas, new Date(2027, 11, 5));
    expect(r.taxa).toBe(68); // 34 de 50; a média dos pedaços daria 50
    expect(r.nota).toBe(68);
    expect(r.emAndamento).toBe(false);
  });

  it('com o período aberto, a taxa até agora e sem nota', () => {
    const r = aderenciaSomada(linhas, pecas, new Date(2027, 7, 1));
    expect(r.taxa).toBe(68);
    expect(r.nota).toBeNull();
    expect(r.emAndamento).toBe(true);
  });

  it('sem semana, nada', () => {
    expect(aderenciaSomada([], pecas, new Date(2027, 11, 5))).toMatchObject({ taxa: null, nota: null, emAndamento: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js`
Expected: FAIL, com `aderenciaSomada is not a function`. Os testes que já existiam continuam passando com o `semestresDoCiclo` local.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/professor/aderencia.js`, logo depois do `aderenciaResumo`:

```js
// O semestral (plano de carreira, PR 3): o período inteiro é a unidade. Soma
// as semanas de todos os pedaços, porque no semestral de junho e dezembro o
// segundo período tem o pedaço de junho (um mês) e o de julho a novembro, e a
// média dos dois daria a junho o peso de cinco meses. A nota sai quando todos
// os pedaços fecham; antes disso, a taxa até agora com `emAndamento`.
export function aderenciaSomada(linhas, pecas, asOf = new Date()) {
  const semestres = (pecas || []).map((s) => ({ ...s, fechado: s.fim <= asOf, ...aderenciaDoSemestre(linhas, s) }));
  const contam = semestres.reduce((a, s) => a + s.contam, 0);
  const aderentes = semestres.reduce((a, s) => a + s.aderentes, 0);
  const taxa = pct(aderentes, contam);
  const fechado = semestres.length > 0 && semestres.every((s) => s.fechado);
  return { semestres, nota: fechado ? taxa : null, taxa, emAndamento: !fechado && taxa != null };
}
```

Confira que o `pct` usado pelo `aderenciaDoSemestre` está declarado no mesmo arquivo. Se ele vier de outro módulo, use o mesmo import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js src/lib/__tests__/professorContasImports.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/professor/aderencia.js src/lib/__tests__/professor.aderencia.test.js
git commit -m "feat: aderência semestral soma as semanas do período"
```

---

### Task 4: as contas do professor pela trilha

**Files:**
- Create: `src/lib/carreira/professor.js`
- Test: `src/lib/__tests__/carreira.professor.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreira.professor.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { aderenciaDaTrilha, contasDoProfessor, janelaDeLeitura, periodoDaPessoa } from '../carreira/professor.js';
import { pecasDaAderencia, periodoPorChave } from '../carreira/periodo.js';
import { trilhasDe } from '../carreira/trilhas.js';

const [professor, estagiario] = trilhasDe(null);
const agora = new Date(2027, 2, 10);

describe('período da pessoa', () => {
  it('a chave válida vale; a inválida ou ausente cai no período de agora', () => {
    expect(periodoDaPessoa(professor, '2026', agora).chave).toBe('2026');
    expect(periodoDaPessoa(professor, '2030', agora).chave).toBe('2027');
    expect(periodoDaPessoa(professor, null, agora).chave).toBe('2027');
    expect(periodoDaPessoa(estagiario, null, agora).chave).toBe('2027-1');
  });
});

describe('janela de leitura', () => {
  it('do início mais antigo ao fim mais novo', () => {
    const j = janelaDeLeitura([periodoPorChave(professor, '2027'), periodoPorChave(estagiario, '2027-1')]);
    expect(j.inicio).toEqual(new Date(2026, 11, 1));
    expect(j.fim).toEqual(new Date(2027, 11, 1));
  });
  it('sem período, null', () => {
    expect(janelaDeLeitura([])).toBeNull();
    expect(janelaDeLeitura([null])).toBeNull();
  });
});

describe('aderência pela frequência da trilha', () => {
  const periodo = periodoPorChave(estagiario, '2027-2');
  const linhas = [
    { semana: '2027-06-07', contam: 10, aderentes: 2 },
    { semana: '2027-07-05', contam: 40, aderentes: 32 },
  ];
  it('semestral soma; anual tira a média dos semestres fechados', () => {
    expect(aderenciaDaTrilha(estagiario, linhas, periodo, new Date(2027, 11, 5)).taxa).toBe(68);
    const anual = aderenciaDaTrilha(professor, linhas, periodoPorChave(professor, '2027'), new Date(2027, 11, 5));
    expect(anual.taxa).toBe(50); // média de 20% (jan a jun) e 80% (jul a nov)
    expect(pecasDaAderencia(periodo)).toHaveLength(2);
  });
});

describe('contasDoProfessor', () => {
  it('sem dado nenhum, os quatro resultados vazios', () => {
    const r = contasDoProfessor({
      trilha: professor,
      periodo: periodoPorChave(professor, '2027'),
      prof: { id: 'p1', nivel: 'junior', modalidadeIds: [] },
      clientes: [], contratos: [], planos: [], aulas: [], presencas: [],
      nps: { pesquisas: [], totais: [] },
      agora,
    });
    expect(r.resultados).toEqual({
      renovacao: { valor: null },
      nps: { valor: null },
      conversao: { valor: null, academia: null },
      aderencia: { valor: null },
    });
    expect(r.carteira).toEqual([]);
    expect(r.pessoas).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.professor.test.js`
Expected: FAIL, porque `../carreira/professor.js` não existe.

- [ ] **Step 3: Write minimal implementation**

Crie `src/lib/carreira/professor.js`:

```js
// Os números do professor e do estagiário pela trilha (plano de carreira, PR
// 3). As contas são as de src/lib/professor/; aqui se escolhe o período, a
// janela da renovação, a aderência pela frequência e os ajustes da trilha.
// Puro e sem pacote (carreiraImports.test.js).
import { aderenciaPorSemana, aderenciaResumo, aderenciaSomada } from '../professor/aderencia.js';
import { conversaoDoCiclo, pessoasDasAulas } from '../professor/conversao.js';
import { npsDoCiclo } from '../professor/pesquisas.js';
import { carteiraDoCiclo, renovacaoDoCiclo } from '../professor/renovacao.js';
import { janelaDaRenovacao, pecasDaAderencia, periodoDe, periodoValido } from './periodo.js';
import { nivelDaPessoa } from './trilhas.js';

// O período escolhido, quando a chave vale para a trilha; senão o de agora.
export const periodoDaPessoa = (trilha, chave, agora = new Date()) =>
  (chave ? periodoValido(trilha, chave, agora) : null) ?? periodoDe(trilha, agora);

// O que as telas leem das aulas e das presenças: do início mais antigo ao fim
// mais novo dos períodos. Null sem período.
export function janelaDeLeitura(periodos) {
  const ps = (periodos || []).filter(Boolean);
  if (!ps.length) return null;
  return {
    inicio: new Date(Math.min(...ps.map((p) => p.inicio.getTime()))),
    fim: new Date(Math.max(...ps.map((p) => p.fim.getTime()))),
  };
}

// A aderência pela frequência: semestral soma as semanas do período, anual
// tira a média dos semestres do calendário (decisão 7 do plano).
export function aderenciaDaTrilha(trilha, semanas, periodo, agora = new Date()) {
  const pecas = pecasDaAderencia(periodo);
  return trilha?.frequencia === 'semestral' ? aderenciaSomada(semanas, pecas, agora) : aderenciaResumo(semanas, pecas, agora);
}

// Tudo o que a lista e o perfil mostram de um professor no período, mais os
// `resultados` que o placarDe recebe. A meta do NPS é a do nível de agora;
// sem ela, vale 9, só para o npsDoCiclo calcular (o estado sai do placar).
export function contasDoProfessor({ trilha, periodo, prof, clientes, contratos, planos, aulas, presencas, nps, agora = new Date() }) {
  const ajustes = trilha?.ajustes || {};
  const base = { leads: clientes, contratos, planos, professor: prof, periodo: janelaDaRenovacao(trilha, periodo), asOf: agora };
  const daAula = { aulas, contratos, professorId: prof.id, periodo, asOf: agora, janelaDias: ajustes.janelaDias ?? 30 };
  const semanas = aderenciaPorSemana({ presencas, leads: clientes, contratos, planos, professor: prof, asOf: agora, barra: ajustes.barra ?? 2 });
  const nivel = nivelDaPessoa(prof, trilha);
  const metaNps = nivel ? trilha.numeros?.nps?.metas?.[nivel.id] ?? null : null;
  const renovacao = renovacaoDoCiclo(base);
  const conversao = conversaoDoCiclo(daAula);
  const aderencia = aderenciaDaTrilha(trilha, semanas, periodo, agora);
  const notaDoPeriodo = npsDoCiclo({ pesquisas: nps?.pesquisas, totais: nps?.totais, professorId: prof.id, trilha, chave: periodo.chave, meta: metaNps ?? 9 });
  return {
    renovacao,
    carteira: carteiraDoCiclo(base),
    conversao,
    pessoas: pessoasDasAulas(daAula),
    semanas,
    aderencia,
    nps: notaDoPeriodo,
    metaNps,
    resultados: {
      renovacao: { valor: renovacao.taxa },
      nps: { valor: notaDoPeriodo.nota },
      conversao: { valor: conversao.professor.taxa, academia: conversao.academia.taxa },
      aderencia: { valor: aderencia.taxa },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.professor.test.js src/lib/__tests__/carreiraImports.test.js`
Expected: PASS. Se o `carteiraDoCiclo` ou o `pessoasDasAulas` devolverem outra forma para dado vazio (por exemplo `null`), ajuste o teste para o que eles devolvem hoje. Leia a função, não mude a conta.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/professor.js src/lib/__tests__/carreira.professor.test.js
git commit -m "feat: contas do professor pela trilha (período, renovação e aderência)"
```

---

### Task 5: `ciclo` e `trilha` no endereço

**Files:**
- Modify: `src/lib/screenParams.js:374-400`
- Test: `src/lib/__tests__/screenParams.test.js` (o bloco "ciclo do plano de carreira", na linha 730)

- [ ] **Step 1: Write the failing test**

Em `src/lib/__tests__/screenParams.test.js`, tire `PRIMEIRO_CICLO` do import do topo e troque o `describe('ciclo do plano de carreira (Professores e perfil)', ...)` inteiro por:

```js
describe('período e trilha do plano de carreira (Carreira e perfil)', () => {
  const [professor, estagiario] = trilhasDe(null);
  const agora = new Date(2027, 2, 10);
  const lista = { trilhas: [professor, estagiario], agora };
  const perfil = { trilha: professor, agora };

  it('a lista tem a trilha e o período; o perfil, só o período', () => {
    expect(SCREEN_PARAM_NAMES.professores).toEqual(['trilha', 'ciclo']);
    expect(SCREEN_PARAM_NAMES.professorPerfil).toEqual(['ciclo']);
  });

  it('no perfil, a chave válida da trilha vale; o resto fica null', () => {
    expect(readScreenParams('professorPerfil', '?ciclo=2026', perfil)).toEqual({ ciclo: '2026' });
    expect(readScreenParams('professorPerfil', '', perfil)).toEqual({ ciclo: null });
    ['2025', '2028', '2027-1', 'abc'].forEach((raw) => {
      expect(readScreenParams('professorPerfil', `?ciclo=${raw}`, perfil), raw).toEqual({ ciclo: null });
    });
    expect(readScreenParams('professorPerfil', '?ciclo=2026', { agora })).toEqual({ ciclo: null });
  });

  it('na lista, o período só vale com uma trilha escolhida', () => {
    expect(readScreenParams('professores', '?ciclo=2026', lista)).toEqual({ trilha: null, ciclo: null });
    expect(readScreenParams('professores', '?trilha=estagiario&ciclo=2027-1', lista)).toEqual({ trilha: 'estagiario', ciclo: '2027-1' });
    expect(readScreenParams('professores', '?trilha=estagiario&ciclo=2026', lista)).toEqual({ trilha: 'estagiario', ciclo: null });
    expect(readScreenParams('professores', '?trilha=sumiu', lista)).toEqual({ trilha: null, ciclo: null });
  });

  it('o período de agora e a trilha sumida não se escrevem', () => {
    expect(screenParamsQuery('professorPerfil', { ciclo: '2027' }, perfil)).toBe('');
    expect(screenParamsQuery('professorPerfil', { ciclo: '2026' }, perfil)).toBe('?ciclo=2026');
    expect(screenParamsQuery('professores', { trilha: 'estagiario', ciclo: '2026-2' }, lista)).toBe('?trilha=estagiario&ciclo=2026-2');
    expect(screenParamsQuery('professores', { trilha: null, ciclo: '2026' }, lista)).toBe('');
    expect(screenParamsQuery('professores', { trilha: 'sumiu', ciclo: null }, lista)).toBe('');
  });
});
```

Acrescente no topo do arquivo `import { trilhasDe } from '../carreira/trilhas.js';` e confira que `screenParamsQuery` está no import de `../screenParams.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js`
Expected: FAIL no bloco novo, porque a lista ainda só tem `['ciclo']`.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/screenParams.js`, acrescente aos imports do topo:

```js
import { periodoDe, periodoValido } from './carreira/periodo.js';
```

Troque o trecho do comentário "Ciclo de avaliação do plano de carreira" até a definição de `const ciclo = param(...)` por:

```js
// O plano de carreira (spec 2026-11-26-plano-de-carreira-configuravel). A
// trilha da lista Carreira (`trilha`, ausente é todas) e o período (`ciclo`),
// que é a chave da trilha ('2027' ou '2027-1'), conferida pelo periodoValido.
// No perfil, a trilha vem no ctx (a da pessoa). Na lista, é a escolhida na
// pílula: sem ela, cada pessoa fica no período de agora da trilha dela e o
// `ciclo` não vale. O período de agora não se escreve.
const trilhaDaLista = param('trilha',
  (raw, ctx) => ((ctx.trilhas || []).some((t) => t.id === raw) ? raw : null),
  (v, ctx) => ((ctx.trilhas || []).some((t) => t.id === v) ? v : null));
const trilhaDoCtx = (ctx, valores) => ctx.trilha ?? (ctx.trilhas || []).find((t) => t.id === valores?.trilha) ?? null;
const ciclo = param('ciclo',
  (raw, ctx, out) => (periodoValido(trilhaDoCtx(ctx, out), raw, ctx.agora) ? String(raw) : null),
  (v, ctx, valores) => {
    const t = trilhaDoCtx(ctx, valores);
    if (!v || !periodoValido(t, v, ctx.agora)) return null;
    return v === periodoDe(t, ctx.agora)?.chave ? null : String(v);
  });
```

Na `TABELA`, troque as duas linhas:

```js
  professores: { trilha: trilhaDaLista, ciclo },
  professorPerfil: { ciclo },
```

Confira que nenhum outro arquivo importa `PRIMEIRO_CICLO` além do `ProfessoresComum.jsx`, que muda na Task 8:

```bash
grep -rn "PRIMEIRO_CICLO" src
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: PASS. O `ProfessoresComum.jsx` ainda importa o `PRIMEIRO_CICLO`, então o build quebra até a Task 8. Não rode o build agora.

- [ ] **Step 5: Commit**

```bash
git add src/lib/screenParams.js src/lib/__tests__/screenParams.test.js
git commit -m "feat: período do plano de carreira no endereço pela chave da trilha"
```

---

### Task 6: endereços `/carreira`

**Files:**
- Modify: `src/lib/routes.js` (`SCREENS`, `readScreen`, `hrefFor`, `accessRedirect` e o comentário de `parseAppPath`)
- Modify: `src/lib/tenantSlug.js:27`
- Modify: `src/lib/sentryScrub.js:119-130`
- Test: `src/lib/__tests__/routes.professores.test.js`, `src/lib/__tests__/sentryScrub.test.js` e `src/lib/__tests__/tenantSlug.test.js`

- [ ] **Step 1: Write the failing test**

Acrescente ao fim de `src/lib/__tests__/routes.professores.test.js` (use o `gestor` e o `professor` que o arquivo já define; se os nomes forem outros, use os de lá):

```js
describe('menu Carreira', () => {
  it('as telas moram em /carreira', () => {
    expect(hrefFor('acad', 'professores')).toBe('/acad/carreira');
    expect(hrefFor('acad', 'professores', { sub: 'pesquisas' })).toBe('/acad/carreira/pesquisas');
    expect(hrefFor('acad', 'professorPerfil', { profId: 'p1', sub: 'nps' })).toBe('/acad/carreira/professor/p1/nps');
    expect(parseAppPath('/acad/carreira')).toMatchObject({ screen: 'professores', sub: null });
    expect(parseAppPath('/acad/carreira/professor/p1/aderencia')).toMatchObject({ screen: 'professorPerfil', profId: 'p1', sub: 'aderencia' });
    expect(documentTitle({ screen: 'professores', tenantName: 'X' })).toBe('Carreira · X · STRONILEAD');
  });

  it('os endereços antigos levam aos novos com replace e a query', () => {
    const casos = [
      ['/acad/professores', '/acad/carreira'],
      ['/acad/professores/pesquisas', '/acad/carreira/pesquisas'],
      ['/acad/professores/perfil/p1/nps', '/acad/carreira/professor/p1/nps'],
    ];
    casos.forEach(([de, para]) => {
      const d = routeDecision(parseAppPath(de), gestor, { search: '?ciclo=2026' });
      expect(d, de).toMatchObject({ kind: 'redirect', to: `${para}?ciclo=2026`, notice: null });
    });
    expect(routeDecision(parseAppPath('/acad/professores/metas'), gestor)).toMatchObject({ kind: 'redirect', to: '/acad/configuracoes/carreira/professor' });
  });

  it('o professor vai ao próprio perfil no endereço novo', () => {
    expect(routeDecision(parseAppPath('/acad/professores/perfil/outro'), professor)).toMatchObject({ kind: 'redirect', to: `/acad/carreira/professor/${professor.professorId}`, notice: 'nao-liberada' });
    expect(routeDecision(parseAppPath(`/acad/professores/perfil/${professor.professorId}`), professor)).toMatchObject({ kind: 'redirect', to: `/acad/carreira/professor/${professor.professorId}`, notice: null });
  });
});
```

Em `src/lib/__tests__/sentryScrub.test.js`, acrescente um caso no `describe` das trocas de caminho (procure pelo `:profId` que já existe com `grep -n ":profId" src/lib/__tests__/*.test.js` e troque o esperado por `:pessoaId` em todos):

```js
it('troca o id da pessoa no endereço do perfil, novo e antigo', () => {
  expect(scrubLeadPath('/acad/carreira/professor/AbC123/nps')).toBe('/acad/carreira/professor/:pessoaId/nps');
  expect(scrubLeadPath('/acad/professores/perfil/AbC123')).toBe('/acad/professores/perfil/:pessoaId');
});
```

Se a função de troca de caminho do `sentryScrub.js` exportada tiver outro nome, use o nome de lá (ela é a que aplica o `PROF_PATH_RE`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/routes.professores.test.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/tenantSlug.test.js`
Expected: FAIL nos casos novos, e o `tenantSlug.test.js` falha depois do Step 3, se a palavra não for reservada.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/routes.js`:

1. Em `SCREENS`, troque as duas linhas das telas de professores por:

```js
  // O menu Carreira (plano de carreira, PR 3). Os ids continuam os de antes
  // (professores e professorPerfil) e só os endereços mudaram; o readScreen lê
  // /professores e leva ao endereço novo (antigo).
  professores: tela(['carreira'], 'Carreira', { gestor: true, modulo: MODULES.FALTOSOS, subs: PROFESSORES_SUBS, subPadrao: 'lista' }),
  professorPerfil: tela(['carreira', 'professor'], 'Carreira', { modulo: MODULES.FALTOSOS, subs: PERFIL_TABS, subPadrao: 'carteira' }),
```

2. Em `readScreen`, troque o bloco `if (head === 'professores') { ... }` por:

```js
  if (head === 'carreira' || head === 'professores') {
    // /carreira e /carreira/professor/<id>/<aba>. O endereço de antes
    // (/professores e /professores/perfil/<id>) é lido igual, com `antigo`, e
    // o accessRedirect o leva ao novo.
    const antigo = head === 'professores';
    if (antigo) out.antigo = true;
    if (lower(segs[1]) === (antigo ? 'perfil' : 'professor')) {
      out.screen = 'professorPerfil';
      out.profId = isValidLeadId(segs[2]) ? segs[2] : null;
      out.rest = segs.slice(3);
      readSub('professorPerfil', out.rest, out);
      return;
    }
    out.screen = 'professores';
    out.rest = segs.slice(1);
    if (antigo && out.rest.length === 1 && lower(out.rest[0]) === 'metas') {
      out.metasAntigas = true;
      return;
    }
    readSub('professores', out.rest, out);
    return;
  }
```

3. No `hrefFor`, troque `${base}/professores/perfil/${id}${trecho}` por `${base}/carreira/professor/${id}${trecho}`.

4. No `accessRedirect`, logo depois do bloco do professor ("O professor abre só o próprio perfil...") e antes do `if (route.unknown)`, acrescente:

```js
  // O endereço de antes do menu Carreira leva ao novo, com a query, sem aviso.
  if (route.antigo) {
    const novo = hrefFor(tenantId, route.screen, { profId: route.profId, sub: route.sub });
    if (novo) return redirectTo(novo, { search });
  }
```

5. No comentário do `parseAppPath`, acrescente uma linha: `- antigo: o endereço é /professores (de antes do menu Carreira) e leva ao /carreira.`

Em `src/lib/tenantSlug.js`, acrescente `'carreira'` à lista de `RESERVED_TENANT_SLUGS`, logo depois de `'professores'`.

Em `src/lib/sentryScrub.js`, troque o `PROF_PATH_RE` e a troca dele:

```js
// E o id da pessoa do perfil de carreira (/carreira/professor/<id>, e o
// endereço de antes, /professores/perfil/<id>).
const PROF_PATH_RE = /(\/(?:carreira\/professor|professores\/perfil)\/)[^/?#\s"'<>]+/gi;
```

e, na cadeia de trocas, `.replace(PROF_PATH_RE, '$1:pessoaId')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/routes src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/tenantSlug.test.js src/lib/__tests__/sidebarNav.test.js`
Expected: PASS. Os testes que esperam `/professores/...` como endereço montado (`hrefFor`) precisam passar a esperar `/carreira/...`: troque só o esperado, nunca a regra. Liste-os com `grep -rln "/professores/" src/lib/__tests__`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routes.js src/lib/tenantSlug.js src/lib/sentryScrub.js src/lib/__tests__
git commit -m "feat: menu Carreira em /carreira, com os endereços de /professores levando ao novo"
```

---

### Task 7: a janela de leitura no `useProfessoresDados`

**Files:**
- Modify: `src/hooks/useProfessoresDados.js` (o arquivo inteiro)

O hook não tem teste próprio: os testes de tela o trocam por um falso (`vi.mock`). A mudança de assinatura é coberta pelas Tasks 10 e 11.

- [ ] **Step 1: Reescreva o hook**

Substitua `src/hooks/useProfessoresDados.js` por:

```js
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { dayKeyOf } from '../lib/operacional/month.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { planosDoProfessor } from '../lib/professor/carteira.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useAulasInWindow } from './useAulasInWindow.js';
import { usePagedLeads } from './usePagedLeads.js';

// Os dados das telas de Carreira (lista e perfil do professor). Professores,
// planos e contratos já chegam assinados pelo App (useGeneralConfig); os
// contratos passam uma vez pelo normalizeContracts, como no Operacional. Três
// leituras que não são ao vivo: os clientes da academia (a mesma consulta da
// tela Clientes), as aulas e as presenças da janela.
//
// A janela (`inicioMs` e `fimMs`, com o fim fora) vem da tela, que a calcula
// com as trilhas (janelaDeLeitura, em src/lib/carreira/professor.js). Sem
// janela, as aulas e as presenças não são lidas. As trilhas não são lidas
// aqui: a tela assina o useCarreira antes, para a janela nascer certa.
//
// As leituras só começam com o portão de ociosidade aberto (listenersActive) e
// ficam ligadas depois disso: com o portão fechado, o usePagedLeads e o
// useAulasInWindow apagariam a lista e a releriam inteira a cada volta da pausa.
const CLIENTES_SPEC_KEY = 'professores-clientes';

export function useProfessoresDados({ db, inicioMs = null, fimMs = null, listenersActive }) {
  const { professores, planos: planosCrus, contratos: contratosCrus, modalities } = useGeneralConfig();
  const contratos = useMemo(() => normalizeContracts(contratosCrus), [contratosCrus]);
  // O Flow e o Move contam para o professor de pilates e o de funcional, não
  // para o de musculação (planosDoProfessor).
  const planos = useMemo(() => planosDoProfessor(planosCrus, modalities), [planosCrus, modalities]);

  const [ligado, setLigado] = useState(Boolean(listenersActive));
  if (listenersActive && !ligado) setLigado(true);
  const ler = ligado && Boolean(db);
  const temJanela = inicioMs != null && fimMs != null;

  const spec = useMemo(() => clientsAllQuerySpec(), []);
  const { items: clientes, ready: clientesProntos, error: clientesErro } = usePagedLeads({
    db, path: LEADS_PATH, spec, specKey: CLIENTES_SPEC_KEY, enabled: ler,
  });

  const { aulas, loading: aulasCarregando, error: aulasErro } = useAulasInWindow({
    db, startMs: inicioMs ?? 0, endMs: (fimMs ?? 1) - 1, enabled: ler && temJanela,
  });

  // As presenças da janela: uma leitura só, pela segunda-feira da semana
  // ('AAAA-MM-DD'), num campo só e sem índice novo.
  const chave = temJanela ? `${inicioMs}-${fimMs}` : null;
  const [presencas, setPresencas] = useState(null); // { chave, lista, erro }
  useEffect(() => {
    if (!ler || !temJanela) return undefined;
    let vivo = true;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', PRESENCAS_PATH),
      where('semana', '>=', dayKeyOf(new Date(inicioMs))),
      where('semana', '<', dayKeyOf(new Date(fimMs))),
    );
    getDocs(q)
      .then((snap) => { if (vivo) setPresencas({ chave: `${inicioMs}-${fimMs}`, lista: snap.docs.map((d) => d.data()), erro: null }); })
      .catch((err) => {
        console.error('useProfessoresDados presencas', err);
        if (vivo) setPresencas({ chave: `${inicioMs}-${fimMs}`, lista: [], erro: err });
      });
    return () => { vivo = false; };
  }, [db, ler, temJanela, inicioMs, fimMs]);
  const presencasDaJanela = chave && presencas?.chave === chave ? presencas : null;

  return {
    carregando: !temJanela || !clientesProntos || aulasCarregando || !presencasDaJanela,
    erro: clientesErro || aulasErro || presencasDaJanela?.erro || null,
    professores,
    planos,
    contratos,
    clientes,
    aulas,
    presencas: presencasDaJanela?.lista ?? [],
  };
}
```

Antes de salvar, confira no `useAulasInWindow.js` que `enabled: false` não lê nada e que o `startMs` e o `endMs` com o `enabled` desligado não disparam erro. Se ele exigir números válidos sempre, mantenha os valores de reserva acima.

- [ ] **Step 2: Rode os testes de tela para ver o que quebrou**

Run: `npx vitest run src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/professorPerfil.behavior.test.js`
Expected: FAIL, porque as telas ainda passam `ciclo` e leem `metas` e `trilhaProfessor`. Elas são reescritas nas Tasks 10 e 11. Não faça commit sozinho: este passo vai junto com a Task 10.

---

### Task 8: `PeriodoControl` e `TrilhaNivelPopover`

**Files:**
- Modify: `src/views/professores/ProfessoresComum.jsx` (troca o `CicloControl`)
- Create: `src/views/professores/TrilhaNivelPopover.jsx`
- Delete: `src/views/professores/NivelPopover.jsx`
- Test: `src/lib/__tests__/trilhaNivelPopover.behavior.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/trilhaNivelPopover.behavior.test.js`. O molde do jsdom (createRoot, `act`, `ResizeObserver` falso) é o do `professoresView.behavior.test.js`:

```js
// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { TrilhaNivelPopover } = await import('../../views/professores/TrilhaNivelPopover.jsx');
const { trilhasDe } = await import('../carreira/trilhas.js');

const trilhas = trilhasDe(null).filter((t) => t.base === 'professor');
let root;
let box;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
});
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; });

const abrir = async (props) => {
  await act(async () => { root.render(h(TrilhaNivelPopover, props)); });
  await act(async () => { box.querySelector('button').click(); });
};
const radio = (texto) => [...document.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes(texto));
const pressionar = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('Trilha e nível', () => {
  it('abre na trilha e no nível de agora, com a sugerida marcada', async () => {
    await abrir({ trilhas, trilhaId: 'professor', nivel: 'pleno', sugeridaId: 'professor', onSalvar: vi.fn() });
    expect(box.querySelector('button').textContent).toBe('Trilha e nível');
    expect(radio('Professor').getAttribute('aria-checked')).toBe('true');
    expect(radio('Professor').textContent).toContain('sugerida');
    expect(radio('Pleno').getAttribute('aria-checked')).toBe('true');
  });

  it('trocar a trilha pede o nível de novo', async () => {
    const onSalvar = vi.fn().mockResolvedValue(true);
    await abrir({ trilhas, trilhaId: 'professor', nivel: 'pleno', sugeridaId: 'professor', onSalvar });
    await pressionar(radio('Estagiário'));
    expect(radio('Estagiário I')).toBeTruthy();
    expect(document.querySelector('[role="status"]').textContent).toBe('Escolha o nível.');
    expect(document.querySelector('button[type="submit"]').disabled).toBe(true);
    await pressionar(radio('Estagiário II'));
    await act(async () => { document.querySelector('form').requestSubmit(); });
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ trilhaId: 'estagiario', nivel: 'estagiario2' }));
    expect(onSalvar.mock.calls[0][0].desde).toBeInstanceOf(Date);
  });

  it('sem trilha nem nível, o botão diz Definir', async () => {
    await act(async () => { root.render(h(TrilhaNivelPopover, { trilhas, trilhaId: null, nivel: null, sugeridaId: null, onSalvar: vi.fn() })); });
    expect(box.querySelector('button').textContent).toBe('Definir trilha e nível');
  });
});
```

O Radix ativa o rádio no `mousedown` em alguns primitivos e no `click` em outros: o `pressionar` dispara os dois. Se o jsdom não tiver `requestSubmit`, use `form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`. O `radio('Estagiário')` acha a primeira opção que contém o texto, e as opções de trilha vêm antes das de nível no DOM, então ele pega a trilha.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/trilhaNivelPopover.behavior.test.js`
Expected: FAIL, porque o arquivo do componente não existe.

- [ ] **Step 3: Write minimal implementation**

Crie `src/views/professores/TrilhaNivelPopover.jsx`:

```jsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { fromDateInputValue, toDateInputValue } from '../../lib/dates.js';

// "Trilha e nível" do perfil, só do gestor (spec 2026-11-26, "Menu
// Carreira"): a trilha (a sugerida marcada), o nível dela e a data em que
// passa a valer (padrão hoje). Trocar a trilha pede o nível de novo. Quem
// grava é a tela: onSalvar({ trilhaId, nivel, desde }) devolve true quando
// gravou. A troca vale da data em diante e não reescreve o passado.
const PILULA = 'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors';
const ESCOLHIDA = 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300';
const LIVRE = 'border-border bg-card text-muted-foreground hover:text-foreground';
const LINK = 'rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300';

export function TrilhaNivelPopover({ trilhas, trilhaId, nivel, sugeridaId, onSalvar }) {
  const [aberto, setAberto] = useState(false);
  const [trilha, setTrilha] = useState('');
  const [escolha, setEscolha] = useState('');
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);

  const atual = (trilhas || []).find((t) => t.id === trilhaId) ?? null;
  const temNivel = Boolean(atual?.niveis.some((n) => n.id === nivel));

  // Cada abertura começa da trilha e do nível de agora e da data de hoje.
  const abrir = (sim) => {
    if (sim) {
      setTrilha(atual ? atual.id : sugeridaId ?? '');
      setEscolha(temNivel ? nivel : '');
      setData(toDateInputValue(new Date()));
    }
    if (!salvando) setAberto(sim);
  };

  const escolhida = (trilhas || []).find((t) => t.id === trilha) ?? null;
  const trocarTrilha = (id) => {
    if (id === trilha) return;
    setTrilha(id);
    setEscolha('');
  };

  const desde = fromDateInputValue(data);
  const falta = !escolhida ? 'Escolha a trilha.'
    : !escolhida.niveis.some((n) => n.id === escolha) ? 'Escolha o nível.'
      : !desde ? 'Escolha a data.' : null;

  const salvar = async (e) => {
    e.preventDefault();
    if (falta || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ trilhaId: escolhida.id, nivel: escolha, desde });
    setSalvando(false);
    if (ok) setAberto(false);
  };

  // A trilha arquivada só aparece para quem já está nela.
  const opcoes = (trilhas || []).filter((t) => !t.arquivada || t.id === trilhaId);

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger className={LINK}>{atual && temNivel ? 'Trilha e nível' : 'Definir trilha e nível'}</PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-4">
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div>
            <p id="carreira-trilha" className="mb-2 text-[13px] font-semibold">Trilha</p>
            <RadioGroup aria-labelledby="carreira-trilha" value={trilha} onValueChange={trocarTrilha} className="flex flex-wrap gap-2">
              {opcoes.map((t) => (
                <RadioGroupOption key={t.id} value={t.id} className={cn(PILULA, t.id === trilha ? ESCOLHIDA : LIVRE)}>
                  {t.nome}
                  {t.id === sugeridaId && <span className="rounded-full bg-accent-50 px-1.5 text-[11px] font-semibold text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">sugerida</span>}
                </RadioGroupOption>
              ))}
            </RadioGroup>
          </div>
          {escolhida && (
            <div>
              <p id="carreira-nivel" className="mb-2 text-[13px] font-semibold">Nível</p>
              <RadioGroup aria-labelledby="carreira-nivel" value={escolha} onValueChange={setEscolha} className="flex flex-wrap gap-2">
                {escolhida.niveis.map((n) => (
                  <RadioGroupOption key={n.id} value={n.id} className={cn(PILULA, n.id === escolha ? ESCOLHIDA : LIVRE)}>
                    {n.nome}
                  </RadioGroupOption>
                ))}
              </RadioGroup>
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Desde
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] font-normal outline-none focus-visible:anel-foco"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="text-[12.5px] text-muted-foreground">{falta}</p>
            <button
              type="submit"
              disabled={Boolean(falta) || salvando}
              className="h-9 flex-none rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white outline-none hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
```

Os tons `accent-50`, `accent-400`, `accent-500` e `accent-600` existem no `@theme` do `src/index.css` (conferido em 27/11/2026). `accent-300` e `accent-700` não existem: não use.

Apague `src/views/professores/NivelPopover.jsx` (`git rm`). O `PerfilCabecalho.jsx` passa a usar o componente novo na Task 11.

Em `src/views/professores/ProfessoresComum.jsx`, troque o import do `PRIMEIRO_CICLO` e o `CicloControl` inteiro por:

```jsx
import { periodoAnterior, periodoSeguinte, periodoTexto, periodoValido } from '../../lib/carreira/periodo.js';

// O seletor do período da trilha: setas para o anterior e o próximo, do
// primeiro período com dado até o de agora. Versão clara (cabeçalho da lista)
// e escura (placar do perfil).
export function PeriodoControl({ trilha, periodo, agora, onChave, escuro = false }) {
  const seta = cn(SETA, escuro ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground');
  const anterior = periodoAnterior(trilha, periodo);
  const seguinte = periodoSeguinte(trilha, periodo);
  const voltar = anterior && periodoValido(trilha, anterior.chave, agora);
  const ir = seguinte && periodoValido(trilha, seguinte.chave, agora);
  return (
    <div
      role="group"
      aria-label="Período de avaliação"
      className={cn(
        'flex h-[38px] items-center gap-0.5 rounded-xl border p-[3px]',
        escuro ? 'border-white/15 bg-white/[0.06] text-white' : 'border-border bg-card shadow-card',
      )}
    >
      <button type="button" aria-label="Período anterior" disabled={!voltar} onClick={() => onChave(anterior.chave)} className={seta}>
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <span className="num whitespace-nowrap px-1.5 text-[13px] font-semibold">{periodoTexto(periodo)}</span>
      <button type="button" aria-label="Próximo período" disabled={!ir} onClick={() => onChave(seguinte.chave)} className={seta}>
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/trilhaNivelPopover.behavior.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/bordaDosPrimitivos.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/professores/TrilhaNivelPopover.jsx src/views/professores/ProfessoresComum.jsx src/lib/__tests__/trilhaNivelPopover.behavior.test.js
git rm src/views/professores/NivelPopover.jsx
git commit -m "feat: Trilha e nível e seletor do período da trilha"
```

---

### Task 9: os textos do placar e o `PlacarDaCarreira`

**Files:**
- Modify: `src/views/professores/criterios.js` (o arquivo inteiro)
- Create: `src/views/professores/PlacarDaCarreira.jsx`
- Delete: `src/views/professores/PlacarDoCiclo.jsx`
- Test: `src/lib/__tests__/placarDaCarreira.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/placarDaCarreira.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { estadoTexto, metaTexto, proximaTexto, valorTexto } from '../../views/professores/criterios.js';

describe('textos do placar', () => {
  it('o valor de cada número', () => {
    expect(valorTexto('renovacao', 47)).toBe('47%');
    expect(valorTexto('nps', 9.2)).toBe('9,20');
    expect(valorTexto('conversao', 30)).toBe('30%');
    expect(valorTexto('aderencia', null)).toBeNull();
  });

  it('a meta, e a da conversão contra a academia', () => {
    expect(metaTexto('renovacao', 50)).toBe('50%');
    expect(metaTexto('nps', 9)).toBe('9,00');
    expect(metaTexto('conversao', 3, 27)).toBe('3 pontos acima da academia, 30%');
    expect(metaTexto('conversao', 0, 27)).toBe('acima da academia, 27%');
    expect(metaTexto('conversao', -3, 27)).toBe('até 3 pontos abaixo da academia, 24%');
    expect(metaTexto('conversao', 3, null)).toBe('3 pontos acima da academia');
    expect(metaTexto('renovacao', null)).toBeNull();
  });

  it('o estado e a linha do próximo nível', () => {
    expect(estadoTexto({ estado: 'ok' }, { nome: 'Júnior' })).toBe('Na meta do Júnior');
    expect(estadoTexto({ estado: 'baixo' }, { nome: 'Júnior' })).toBe('Abaixo da meta do Júnior');
    expect(estadoTexto({ estado: 'semMeta' }, { nome: 'Júnior' })).toBe('Sem meta definida.');
    expect(estadoTexto({ estado: 'semMeta' }, null)).toBe('Sem nível: defina a trilha e o nível.');
    expect(estadoTexto({ estado: 'sem' }, { nome: 'Júnior' })).toBeNull();
    expect(proximaTexto({ id: 'renovacao', metaProxima: 55 }, { nome: 'Pleno' })).toBe('Para Pleno: 55%');
    expect(proximaTexto({ id: 'conversao', metaProxima: 3, academia: 27 }, { nome: 'Pleno' })).toBe('Para Pleno: 3 pontos acima da academia, 30%');
    expect(proximaTexto({ id: 'renovacao', metaProxima: null }, { nome: 'Pleno' })).toBeNull();
    expect(proximaTexto({ id: 'renovacao', metaProxima: 55 }, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/placarDaCarreira.test.js`
Expected: FAIL, com `valorTexto is not a function`.

- [ ] **Step 3: Write minimal implementation**

Antes de reescrever, veja quem usa o `criterios.js` hoje, além das telas que mudam neste PR:

```bash
grep -rn "from './criterios.js'\|views/professores/criterios" src
```

O `NpsTab.jsx` e o `AderenciaTab.jsx` usam o `notaTexto` e podem usar o `ESTADO_TEXTO`. Se algum desses arquivos usar o `ESTADO_TEXTO`, mantenha a constante no arquivo novo, com o mesmo valor.

Substitua `src/views/professores/criterios.js` por:

```js
// Os textos do placar e da lista de Carreira (plano de carreira, PR 3). As
// contas moram em src/lib/carreira/placar.js; aqui só se decide o texto.
import { alvoDe } from '../../lib/carreira/placar.js';

export const notaTexto = (n) => n.toFixed(2).replace('.', ',');

export function valorTexto(id, v) {
  if (v == null) return null;
  return id === 'nps' ? notaTexto(v) : `${v}%`;
}

// A meta para ler: na conversão, os pontos em relação à academia e, com a
// academia, o alvo em porcentagem. A regra é passar da academia mais os
// pontos (empate não passa): 0 é "acima da academia".
export function metaTexto(id, meta, academia = null) {
  if (meta == null) return null;
  if (id !== 'conversao') return valorTexto(id, meta);
  const pontos = Math.abs(meta);
  const regra = meta === 0 ? 'acima da academia'
    : meta > 0 ? `${pontos} ${pontos === 1 ? 'ponto' : 'pontos'} acima da academia`
      : `até ${pontos} ${pontos === 1 ? 'ponto' : 'pontos'} abaixo da academia`;
  const alvo = alvoDe(id, meta, academia);
  return alvo == null ? regra : `${regra}, ${alvo}%`;
}

export function estadoTexto(item, nivel) {
  if (item.estado === 'ok') return `Na meta do ${nivel.nome}`;
  if (item.estado === 'baixo') return `Abaixo da meta do ${nivel.nome}`;
  if (item.estado === 'semMeta') return nivel ? 'Sem meta definida.' : 'Sem nível: defina a trilha e o nível.';
  return null;
}

export function proximaTexto(item, proximo) {
  if (!proximo || item.metaProxima == null) return null;
  return `Para ${proximo.nome}: ${metaTexto(item.id, item.metaProxima, item.academia)}`;
}

// Escala da régua da renovação: as metas e o resultado com folga dos dois
// lados, em dezenas, dentro de 0 a 100.
export function escalaDaRenovacao(valores) {
  const vs = valores.filter((v) => v != null);
  if (!vs.length) return [0, 100];
  const lo = Math.max(0, Math.floor((Math.min(...vs) - 15) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vs) + 15) / 10) * 10);
  return [lo, hi];
}
```

Crie `src/views/professores/PlacarDaCarreira.jsx`. A régua e o desenho escuro são os do `PlacarDoCiclo.jsx` de hoje, e só as referências mudam: o traço laranja é a meta do nível de agora e o tracejado, a do próximo nível.

```jsx
import { cn } from '@/lib/utils';
import { alvoDe } from '../../lib/carreira/placar.js';
import { PeriodoControl } from './ProfessoresComum.jsx';
import { escalaDaRenovacao, estadoTexto, metaTexto, notaTexto, proximaTexto, valorTexto } from './criterios.js';

// O placar escuro do perfil (spec 2026-11-26, "Menu Carreira"): os números
// ligados na trilha, cada um com a régua do resultado, o traço laranja da meta
// do nível de agora e o tracejado da meta do próximo nível. Embaixo, "Para
// Pleno: 55%". No último nível, só a meta de agora. O texto claro fica em 58%
// de branco ou mais, que dá 6:1 ou mais sobre o ink-900.
const posicao = (v, lo, hi) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
const COLUNAS = { 1: '@[1000px]:grid-cols-1', 2: '@[1000px]:grid-cols-2', 3: '@[1000px]:grid-cols-3', 4: '@[1000px]:grid-cols-4' };

// marcas: { v, texto, rotulo, tipo: 'atual' | 'proxima' | 'ref' }.
function Regua({ lo, hi, rotulo, marcas = [], ponto = null, verde = false, pontas = null }) {
  const vazia = ponto == null;
  return (
    <div role="img" aria-label={rotulo} className="relative mt-[22px] h-[50px]">
      <div className={cn('absolute inset-x-0 top-[15px] h-1 rounded-sm', vazia ? 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.22)_0_6px,transparent_6px_11px)]' : 'bg-white/15')} />
      {marcas.map((m) => (
        <div key={`${m.tipo}-${m.texto}`}>
          <div
            className={cn(
              'absolute top-[9px] h-4',
              m.tipo === 'atual' && 'ml-[-1.5px] w-[3px] rounded-[1px] bg-accent-500',
              m.tipo === 'proxima' && 'ml-[-1px] w-0 border-l-2 border-dashed border-white/70',
              m.tipo === 'ref' && 'ml-[-1px] w-0.5 rounded-[1px] bg-white/40',
            )}
            style={{ left: `${posicao(m.v, lo, hi)}%` }}
          />
          <div
            className={cn('absolute top-[30px] -translate-x-1/2 whitespace-nowrap text-center text-[11.5px] leading-[1.25]', m.tipo === 'atual' ? 'font-bold text-[#FFB28F]' : 'text-white/60')}
            style={{ left: `${posicao(m.v, lo, hi)}%` }}
          >
            {m.texto}<br />{m.rotulo}
          </div>
        </div>
      ))}
      {!vazia && (
        <div
          className={cn('absolute top-[9px] ml-[-8px] size-4 rounded-full', verde ? 'bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,.25)]' : 'bg-white shadow-[0_0_0_4px_rgba(127,160,255,.35)]')}
          style={{ left: `${posicao(ponto, lo, hi)}%` }}
        />
      )}
      {pontas && (
        <>
          <div className="absolute left-0 top-[30px] text-[11.5px] text-white/60">{pontas[0]}</div>
          <div className="absolute right-0 top-[30px] text-[11.5px] text-white/60">{pontas[1]}</div>
        </>
      )}
    </div>
  );
}

function Selo({ ok, children }) {
  return (
    <span className={cn('mr-1.5 inline-flex h-[22px] items-center whitespace-nowrap rounded-[7px] px-2 text-[12px] font-semibold', ok ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-500/20 text-amber-200')}>
      {children}
    </span>
  );
}

// A escala, as marcas e as linhas de cada número. `det` são os detalhes das
// contas (renovacao, conversao, nps, aderencia e barra) para a linha de baixo.
function desenhoDe(item, nivel, proximo, det) {
  const { id, valor, meta, metaProxima, academia } = item;
  const alvo = alvoDe(id, meta, academia);
  const alvoProx = alvoDe(id, metaProxima, academia);
  const rotulo = (v) => (id === 'nps' ? notaTexto(v) : `${v}%`);
  const marcas = [];
  if (id === 'conversao' && academia != null) marcas.push({ v: academia, texto: 'academia', rotulo: `${academia}%`, tipo: 'ref' });
  if (alvo != null) marcas.push({ v: alvo, texto: nivel.nome, rotulo: rotulo(alvo), tipo: 'atual' });
  if (alvoProx != null) marcas.push({ v: alvoProx, texto: proximo.nome, rotulo: rotulo(alvoProx), tipo: 'proxima' });
  if (id === 'nps') {
    const candidatos = [alvo, alvoProx].filter((v) => v != null).map((v) => Math.floor(v) - 1);
    const lo = Math.max(0, Math.min(...candidatos, valor == null ? 10 : Math.floor(valor)));
    const comPesquisa = Boolean(det.nps?.itens?.length);
    return {
      lo, hi: 10, pontas: [String(lo), '10'], marcas,
      linha: valor != null ? (det.nps.promotores == null ? null : `${det.nps.promotores}% deram 9 ou 10`) : comPesquisa ? 'Sem nota válida' : 'Sem pesquisa ainda',
      rodape: !comPesquisa ? 'A pesquisa com os alunos ainda não começou.'
        : valor == null ? 'Nenhuma pesquisa do período teve respostas suficientes.'
          : det.nps.pesquisas === 1 ? 'Uma pesquisa válida no período.' : `Média das ${det.nps.pesquisas} pesquisas válidas do período.`,
    };
  }
  if (id === 'conversao') {
    const p = det.conversao.professor;
    return {
      lo: 0, hi: 100, pontas: ['0%', '100%'], marcas,
      linha: p.taxa == null ? 'Ninguém veio ainda' : `${p.matricularam} de ${p.vieram} pessoas se matricularam`,
      rodape: det.conversao.incompleto
        ? 'Aula experimental e freepass, cada pessoa uma vez. As aulas de antes de setembro de 2026 estão incompletas no sistema.'
        : 'Aula experimental e freepass, cada pessoa uma vez.',
    };
  }
  if (id === 'aderencia') {
    const lo = Math.max(0, Math.min((alvo ?? 60) - 20, valor == null ? 100 : Math.floor(valor / 10) * 10));
    return {
      lo, hi: 100, pontas: [`${lo}%`, '100%'], marcas,
      linha: valor == null ? 'Sem dados ainda' : det.aderencia.emAndamento ? 'Período em andamento' : 'Período fechado',
      rodape: `Semanas com ${det.barra} ou mais aulas, de segunda a sexta. Dezembro fica fora.`,
    };
  }
  const [lo, hi] = escalaDaRenovacao([alvo, alvoProx, valor]);
  return {
    lo, hi, pontas: null, marcas,
    linha: valor == null ? 'Nenhum contrato venceu' : `${det.renovacao.renovados} de ${det.renovacao.venceram} contratos renovaram`,
    rodape: 'Contratos das modalidades do professor que venceram na janela da trilha.',
  };
}

export function PlacarDaCarreira({ titulo, trilha, periodo, agora, onChave, placar, detalhes }) {
  const { nivel, proximo, itens } = placar;
  return (
    <section aria-label="Números do plano de carreira" className="@container mt-3.5 rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_88%_-30%,#22357a_0,transparent_60%)] px-6 pb-7 pt-6 text-white md:px-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 font-display text-[17px] font-bold tracking-[-0.01em]">{titulo}</h2>
          <p className="mt-0.5 text-[13px] text-white/60">Trilha {trilha.nome}{nivel ? `, ${nivel.nome}` : ', sem nível'}. Cada régua mostra o resultado e as metas do nível.</p>
        </div>
        <PeriodoControl trilha={trilha} periodo={periodo} agora={agora} onChave={onChave} escuro />
      </div>

      {itens.length === 0 ? (
        <p className="mt-6 text-[14px] text-white/75">Nenhum número ligado nesta trilha.</p>
      ) : (
        <div className={cn('mt-6 grid grid-cols-1 gap-x-8 gap-y-8 @[620px]:grid-cols-2 @[1000px]:gap-x-0', COLUNAS[Math.min(4, itens.length)])}>
          {itens.map((item) => {
            const d = desenhoDe(item, nivel, proximo, detalhes);
            const valor = valorTexto(item.id, item.valor);
            const estado = estadoTexto(item, nivel);
            const prox = proximaTexto(item, proximo);
            return (
              <div key={item.id} className="flex min-w-0 flex-col @[1000px]:border-l @[1000px]:border-white/10 @[1000px]:px-6 @[1000px]:first:border-l-0 @[1000px]:first:pl-0">
                <h3 className="m-0 text-[14px] font-medium text-white/75">{item.nome}</h3>
                {valor != null
                  ? <div className={cn('num mb-1.5 mt-3 font-display text-[52px] font-bold leading-none tracking-[-0.045em]', item.estado === 'ok' && 'text-emerald-300')}>{valor}</div>
                  : <div className="mb-2 mt-[22px] font-display text-[22px] font-bold leading-[1.15] tracking-[-0.015em] text-white/80">{d.linha}</div>}
                {valor != null && d.linha && <div className="num text-[13px] text-white/80">{d.linha}</div>}
                <Regua
                  lo={d.lo}
                  hi={d.hi}
                  marcas={d.marcas}
                  ponto={item.valor}
                  verde={item.estado === 'ok'}
                  pontas={d.pontas}
                  rotulo={`${valor ?? 'Sem resultado'}. ${item.meta == null ? 'Sem meta' : `Meta ${metaTexto(item.id, item.meta, item.academia)}`}.${prox ? ` ${prox}.` : ''}`}
                />
                <div className="mt-2.5 text-[12.5px] text-white/60">
                  {(item.estado === 'ok' || item.estado === 'baixo') && <Selo ok={item.estado === 'ok'}>{estado}</Selo>}
                  {item.estado === 'semMeta' && <span className="mr-1.5 text-white/80">{estado}</span>}
                  {d.rodape}
                </div>
                {prox && <div className="mt-1.5 text-[12.5px] font-semibold text-white/80">{prox}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div aria-hidden="true" className="mt-[22px] flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[12.5px] text-white/60">
        <span className="inline-flex items-center gap-[7px]"><i className="block h-3 w-[3px] rounded-[1px] bg-accent-500" />Meta do nível atual</span>
        {proximo && <span className="inline-flex items-center gap-[7px]"><i className="block h-3 w-0 border-l-2 border-dashed border-white/70" />Meta do {proximo.nome}</span>}
        <span className="inline-flex items-center gap-[7px]"><i className="block size-3 rounded-full bg-white" />Resultado</span>
      </div>
    </section>
  );
}
```

`detalhes` recebe `{ renovacao, conversao, nps, aderencia, barra }`, montado pelo perfil na Task 11.

Apague `src/views/professores/PlacarDoCiclo.jsx` (`git rm`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/placarDaCarreira.test.js src/lib/__tests__/focusRing.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/professores/criterios.js src/views/professores/PlacarDaCarreira.jsx src/lib/__tests__/placarDaCarreira.test.js
git rm src/views/professores/PlacarDoCiclo.jsx
git commit -m "feat: placar com a meta do nível atual e a do próximo"
```

---

### Task 10: a lista Carreira

**Files:**
- Modify: `src/views/professores/ProfessoresView.jsx`
- Modify: `src/views/professores/ProfessoresTabela.jsx`
- Modify: `src/hooks/useProfessoresDados.js` (já reescrito na Task 7, entra neste commit)
- Test: `src/lib/__tests__/professoresView.behavior.test.js`

- [ ] **Step 1: Write the failing test**

No `src/lib/__tests__/professoresView.behavior.test.js`:

1. Ao lado do `vi.mock('../../hooks/useProfessoresDados.js', ...)`, acrescente o falso do `useCarreira`, com as trilhas padrão:

```js
vi.mock('../../hooks/useCarreira.js', async () => {
  const { trilhasDe } = await import('../carreira/trilhas.js');
  return { useCarreira: () => ({ carreira: { doc: null }, trilhas: trilhasDe(null) }) };
});
```

2. No falso do `useProfessoresDados`, tire `metas` e `trilhaProfessor` do objeto devolvido. Professores, planos, contratos, clientes, aulas e presenças continuam como estão.

3. Apague o import de `criterioRenovacao` e `criterioConversao` e os testes que os usam (linhas 151 a 154 e o `it` em volta). As regras deles agora são testadas no `carreira.placar.test.js` e no `placarDaCarreira.test.js`.

4. Acrescente os testes da lista nova. Use a montagem que o arquivo já tem (o `montar` ou o equivalente), com dois professores ativos: um com `trilhaId: 'estagiario'` e `nivel: 'estagiario1'`, outro sem `trilhaId` e com `nivel: 'junior'`.

```js
describe('lista Carreira', () => {
  it('mostra a trilha, o nível e o resumo das metas de cada pessoa', async () => {
    await montar(); // a montagem do arquivo, com os dois professores acima
    const texto = document.body.textContent;
    expect(texto).toContain('Carreira');
    expect(texto).toContain('Estagiário I');
    expect(texto).toContain('Júnior');
    expect(texto).toMatch(/\d de \d na meta do Júnior/);
  });

  it('a pílula Trilha filtra e grava no endereço', async () => {
    await montar();
    const pilula = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Trilha'));
    await act(async () => { pilula.click(); });
    const opcao = [...document.querySelectorAll('[role="menuitemradio"], [role="option"], [role="radio"]')].find((el) => el.textContent.includes('Estagiário'));
    await act(async () => { opcao.click(); });
    expect(ultimoEndereco()).toContain('trilha=estagiario');
  });

  it('a busca pelo nome fica fora do endereço', async () => {
    await montar();
    const busca = document.querySelector('input[type="search"]');
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(busca, 'zzz');
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Ninguém com esse nome.');
    expect(ultimoEndereco()).not.toContain('zzz');
  });
});
```

O arquivo já tem um jeito de ler o endereço depois da navegação (`useLocation` dentro de um componente espião). Use-o no lugar de `ultimoEndereco()`. Confira no `OptionList` do `DashFilterBar.jsx` qual `role` cada opção tem e ajuste o seletor.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/professoresView.behavior.test.js`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Antes de reescrever a tabela, veja quem mais usa o `SeloDoNivel` e o `MarcaDoEstado`:

```bash
grep -rn "SeloDoNivel\|MarcaDoEstado" src
```

O `PerfilCabecalho.jsx` usa o `SeloDoNivel` (muda na Task 11). Se o `NpsTab.jsx` ou o `AderenciaTab.jsx` usarem o `MarcaDoEstado`, ele continua exportado com a mesma assinatura.

Em `src/views/professores/ProfessoresTabela.jsx`, troque o conteúdo inteiro por:

```jsx
import { Check, ChevronRight, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrefFor } from '../../lib/routes.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { valorTexto } from './criterios.js';

// A lista Carreira (mockup "Lista Carreira", 26/11/2026): uma linha por
// pessoa, e a linha inteira é o link do perfil. O nome do link diz tudo o que
// a linha mostra, porque o cabeçalho das colunas é só visual. A tabela quebra
// pela largura dela (@container), não pela da janela.
const COLUNAS = '@[880px]:grid-cols-[minmax(220px,1.4fr)_minmax(150px,0.9fr)_minmax(170px,1fr)_minmax(200px,1.2fr)_20px]';

const MARCA = {
  ok: { Icon: Check, cls: 'bg-emerald-600 text-white dark:bg-emerald-500' },
  baixo: { Icon: X, cls: 'bg-rose-600 text-white dark:bg-rose-500' },
  sem: { Icon: Minus, cls: 'bg-muted text-muted-foreground' },
};

export function MarcaDoEstado({ estado, className }) {
  const { Icon, cls } = MARCA[estado];
  return (
    <span aria-hidden="true" className={cn('grid size-4 flex-none place-items-center rounded-full', cls, className)}>
      <Icon size={10} strokeWidth={3.4} />
    </span>
  );
}

// O quadradinho de cada número na linha: verde na meta, vermelho abaixo, cinza
// sem dados, tracejado sem meta.
const QUADRADO = {
  ok: 'bg-emerald-500',
  baixo: 'bg-rose-500',
  sem: 'bg-slate-300 dark:bg-white/20',
  semMeta: 'border border-dashed border-muted-foreground/70',
};

// `nome` é o nome do nível na trilha (null é "Sem nível"); `desde` (dd/mm/aaaa)
// entra no perfil: "Júnior desde 01/12/2026".
export function SeloDoNivel({ nome, desde = null }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold',
        nome ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-muted text-muted-foreground',
      )}
    >
      {nome && <i className="size-[7px] rounded-full bg-brand-600" />}
      {nome ?? 'Sem nível'}
      {nome && desde && ` desde ${desde}`}
    </span>
  );
}

const resumoDasMetas = ({ placar }) => {
  if (!placar.nivel) return 'Sem nível';
  if (!placar.comMeta) return 'Sem metas definidas';
  return `${placar.naMeta} de ${placar.comMeta} na meta do ${placar.nivel.nome}`;
};

function rotuloDaLinha(linha) {
  const { prof, trilha, placar, tempo } = linha;
  const numeros = placar.itens.map((i) => `${i.nome} ${valorTexto(i.id, i.valor) ?? 'sem dados'}`).join(', ');
  return [
    prof.nome || 'Professor sem nome',
    trilha ? `trilha ${trilha.nome}` : 'sem trilha',
    placar.nivel ? placar.nivel.nome : 'sem nível',
    tempo ? (tempo.falta ?? tempo.texto) : null,
    resumoDasMetas(linha),
    numeros,
    'Abrir perfil',
  ].filter(Boolean).join('. ');
}

export function ProfessoresTabela({ linhas, tenantId }) {
  return (
    <div className="@container overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      <div aria-hidden="true" className={cn('hidden h-[46px] items-center gap-3.5 border-b border-border px-5 text-[12.5px] font-medium text-muted-foreground @[880px]:grid', COLUNAS)}>
        <span>Pessoa</span>
        <span>Nível</span>
        <span>Tempo no nível</span>
        <span>Números do período</span>
        <span />
      </div>
      <ul className="m-0 list-none p-0">
        {linhas.map((linha) => {
          const { prof, trilha, placar, tempo, desde } = linha;
          return (
            <li key={prof.id} className="border-b border-border last:border-b-0">
              <AppLink
                to={hrefFor(tenantId, 'professorPerfil', { profId: prof.id })}
                aria-label={rotuloDaLinha(linha)}
                className={cn(
                  'group grid grid-cols-1 items-center gap-x-3.5 gap-y-3 px-4 py-3.5 outline-none transition-colors hover:bg-brand-50/50 focus-visible:anel-foco focus-visible:ring-inset dark:hover:bg-white/[0.03]',
                  '@[560px]:grid-cols-2 @[880px]:min-h-[72px] @[880px]:px-5 @[880px]:py-2',
                  COLUNAS,
                )}
              >
                <div className="flex min-w-0 items-center gap-3 @[560px]:col-span-2 @[880px]:col-span-1">
                  <span aria-hidden="true"><Avatar name={prof.nome} photoUrl={prof.photoUrl || null} size={40} /></span>
                  <div className="min-w-0">
                    <b className="block truncate font-semibold">{prof.nome || 'Professor sem nome'}</b>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{trilha ? trilha.nome : 'Sem trilha'}</span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <SeloDoNivel nome={placar.nivel?.nome ?? null} />
                  {desde && <small className="text-[12px] text-muted-foreground">desde {desde}</small>}
                  {!trilha && <small className="text-[12px] font-semibold text-brand-700 dark:text-brand-300">Definir trilha e nível</small>}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  {tempo ? (
                    <>
                      {tempo.pct != null && (
                        <span aria-hidden="true" className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-muted">
                          <i className={cn('block h-full rounded-full', tempo.pct >= 100 ? 'bg-emerald-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, tempo.pct)}%` }} />
                        </span>
                      )}
                      <small className="text-[12.5px] text-foreground/80">{tempo.texto}</small>
                      {tempo.falta && <small className="text-[12px] text-muted-foreground">{tempo.falta}</small>}
                    </>
                  ) : (
                    <small className="text-[12.5px] text-muted-foreground">Sem data do nível</small>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span aria-hidden="true" className="flex gap-1">
                    {placar.itens.map((i) => <i key={i.id} className={cn('block size-3.5 rounded-[4px]', QUADRADO[i.estado])} />)}
                  </span>
                  <small className="text-[12.5px] text-foreground/80">{resumoDasMetas(linha)}</small>
                </div>
                <ChevronRight aria-hidden="true" size={18} className="hidden text-muted-foreground/60 group-hover:text-brand-700 @[880px]:block dark:group-hover:text-brand-300" />
              </AppLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LegendaDosEstados() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-[18px] gap-y-2 text-[12.5px] text-muted-foreground">
      {[['ok', 'Na meta'], ['baixo', 'Abaixo da meta'], ['sem', 'Sem dados no período'], ['semMeta', 'Sem meta definida']].map(([k, t]) => (
        <span key={k} className="inline-flex items-center gap-[7px]"><i aria-hidden="true" className={cn('block size-3.5 rounded-[4px]', QUADRADO[k])} />{t}</span>
      ))}
    </div>
  );
}
```

Em `src/views/professores/ProfessoresView.jsx`:

1. Troque os imports do topo por:

```js
import { useCallback, useMemo, useState } from 'react';
import { ClipboardList, Route, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCarreira } from '../../hooks/useCarreira.js';
import { useNpsDados } from '../../hooks/useNpsDados.js';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { useProfessoresDados } from '../../hooks/useProfessoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { hrefFor } from '../../lib/routes.js';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { trilhaDaPessoa } from '../../lib/carreira/trilhas.js';
import { placarDe, tempoNoNivel } from '../../lib/carreira/placar.js';
import { contasDoProfessor, janelaDeLeitura, periodoDaPessoa } from '../../lib/carreira/professor.js';
import { dayKeyOf } from '../../lib/operacional/month.js';
import { estadoDaPesquisa, resumoDaPesquisa, turmasDoDia } from '../../lib/professor/pesquisas.js';
import { FilterBar, FilterChip } from '../dashboard/DashFilterBar.jsx';
import { LegendaDosEstados, ProfessoresTabela } from './ProfessoresTabela.jsx';
import { PesquisasTab } from './PesquisasTab.jsx';
import { diaTexto, prazoTexto } from './pesquisasTexto.js';
import { PeriodoControl, TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';
```

Confira que o `FilterChip` está exportado do `DashFilterBar.jsx` (está, na linha 116 em 27/11/2026) e que o ícone `Route` existe na versão instalada do `lucide-react`. Se não existir, use `Layers`.

2. Troque o começo do componente, do `const porNome` até o fim do `useMemo` de `contas`, por:

```js
const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ProfessoresView({ db, appUser, tenantId, tab, onTab, listenersActive }) {
  // Um relógio só por montagem: as contas do período cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  // Neste PR só as trilhas de professor (a de consultor entra no PR 4).
  const trilhasDeProfessor = useMemo(() => (trilhas || []).filter((t) => t.base === 'professor'), [trilhas]);
  const ctx = useMemo(() => ({ trilhas: trilhasDeProfessor, agora }), [trilhasDeProfessor, agora]);
  const [{ trilha: trilhaId, ciclo }, setParams] = useScreenParams('professores', ctx);
  const escolhida = trilhasDeProfessor.find((t) => t.id === trilhaId) ?? null;

  // A janela de leitura: o período escolhido da trilha da pílula, ou os
  // períodos de agora de todas as trilhas de professor.
  const janela = useMemo(() => {
    if (!trilhas) return null;
    const alvo = escolhida ? [escolhida] : trilhasDeProfessor;
    return janelaDeLeitura(alvo.map((t) => periodoDaPessoa(t, t === escolhida ? ciclo : null, agora)));
  }, [trilhas, escolhida, trilhasDeProfessor, ciclo, agora]);

  const dados = useProfessoresDados({ db, inicioMs: janela?.inicio.getTime() ?? null, fimMs: janela?.fim.getTime() ?? null, listenersActive });
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas } = dados;
  const nps = useNpsDados({ db, listenersActive });
  // O dia das pesquisas anda com o relógio, para a aba aberta de um dia para o
  // outro não ficar no dia velho.
  const relogio = useMinuteClock();
  const hoje = dayKeyOf(relogio);
  const [busca, setBusca] = useState('');

  const ativos = useMemo(() => (professores || []).filter((p) => p.ativo !== false).sort(porNome), [professores]);
  const trilhaDe = useCallback((prof) => trilhaDaPessoa(prof, trilhasDeProfessor, { professor: true }), [trilhasDeProfessor]);

  // A contagem da pílula: quantas pessoas ativas em cada trilha.
  const contagem = useMemo(() => {
    const c = new Map();
    ativos.forEach((p) => { const t = trilhaDe(p); if (t) c.set(t.id, (c.get(t.id) ?? 0) + 1); });
    return c;
  }, [ativos, trilhaDe]);

  const linhas = useMemo(() => {
    if (carregando || carreira === null || nps.carregando) return null;
    return ativos
      .filter((prof) => !escolhida || trilhaDe(prof)?.id === escolhida.id)
      .map((prof) => {
        const trilha = trilhaDe(prof);
        if (!trilha) return { prof, trilha: null, placar: placarDe(null, null, {}), tempo: null, desde: null };
        const periodo = periodoDaPessoa(trilha, trilha === escolhida ? ciclo : null, agora);
        const contas = contasDoProfessor({ trilha, periodo, prof, clientes, contratos, planos, aulas, presencas, nps, agora });
        return {
          prof,
          trilha,
          placar: placarDe(trilha, prof.nivel, contas.resultados),
          tempo: tempoNoNivel(trilha, prof, agora),
          desde: getSafeDateOrNull(prof.nivelDesde)?.toLocaleDateString('pt-BR') ?? null,
        };
      });
  }, [carregando, carreira, nps, ativos, escolhida, trilhaDe, ciclo, agora, clientes, contratos, planos, aulas, presencas]);

  const visiveis = linhas && busca.trim()
    ? linhas.filter((l) => semAcento(l.prof.nome).includes(semAcento(busca.trim())))
    : linhas;
```

3. Mantenha o `turmasHoje` e o `turmasDoMomento`. Troque a `aba`, o `metasHref` e o `academiaTaxa` por:

```js
  const aba = tab === 'pesquisas' ? tab : 'lista';
  const configHref = hrefFor(tenantId, 'settings', { sub: 'carreira' });
  const periodoEscolhido = escolhida ? periodoDaPessoa(escolhida, ciclo, agora) : null;
  const opcoesDaTrilha = [
    { key: 'todas', label: 'Todas as trilhas', note: String(ativos.length) },
    ...trilhasDeProfessor
      .filter((t) => !t.arquivada || contagem.get(t.id))
      .map((t) => ({ key: t.id, label: t.nome, note: String(contagem.get(t.id) ?? 0) })),
  ];
```

Abra o `OptionList` do `DashFilterBar.jsx` e confira o formato de cada opção (`key`, `label` e `note`, ou outro). Use os nomes de lá.

4. No JSX, troque o `FilterBar` inteiro por:

```jsx
      <FilterBar
        title="Carreira"
        subline="Plano de carreira da equipe. Cada trilha tem o próprio período de avaliação."
      >
        <FilterChip
          icon={Route}
          label="Trilha"
          valueText={escolhida ? escolhida.nome : 'Todas'}
          active={Boolean(escolhida)}
          options={opcoesDaTrilha}
          value={escolhida ? escolhida.id : 'todas'}
          onPick={(k) => setParams({ trilha: k === 'todas' ? null : k, ciclo: null })}
        />
        {escolhida && periodoEscolhido && (
          <PeriodoControl trilha={escolhida} periodo={periodoEscolhido} agora={agora} onChave={(c) => setParams({ ciclo: c })} />
        )}
        {configHref && (
          <AppLink to={configHref} className="inline-flex h-[38px] items-center rounded-xl border border-border bg-card px-3 text-[13px] font-semibold shadow-card outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
            Configurar trilhas
          </AppLink>
        )}
      </FilterBar>
```

e, dentro de `<TabsContent value="lista" tabIndex={-1}>`, o miolo:

```jsx
            {erro && <p role="alert" className="mb-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}
            {!visiveis ? (
              <p className="text-[13px] text-muted-foreground">Carregando a equipe…</p>
            ) : ativos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
                Nenhum professor ativo. Cadastre em Configurações, Equipe & acessos, no cartão Professores.
              </div>
            ) : (
              <>
                <CartaoDaPesquisa nps={nps} hoje={hoje} onVer={() => onTab?.('pesquisas')} />
                <label className="mb-3 flex h-[38px] max-w-[320px] items-center gap-2 rounded-xl border border-border bg-card px-3 shadow-card focus-within:anel-foco">
                  <Search size={15} aria-hidden="true" className="flex-none text-muted-foreground" />
                  <span className="sr-only">Buscar pelo nome</span>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pelo nome"
                    autoComplete="off"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  />
                </label>
                {visiveis.length === 0
                  ? <p className="text-[13px] text-muted-foreground">Ninguém com esse nome.</p>
                  : <ProfessoresTabela linhas={visiveis} tenantId={tenantId} />}
                <LegendaDosEstados />
              </>
            )}
```

5. No `TabsTrigger value="lista"`, troque o texto `Professores` por `Pessoas` e a contagem por `{escolhida ? contagem.get(escolhida.id) ?? 0 : ativos.length}`.

6. Apague os imports e as variáveis que ficaram sem uso (`cicloDe`, `limitesDoCiclo`, `semestresDoCiclo`, `npsDoCiclo`, `conversaoDoCiclo`, `renovacaoDoCiclo`, `aderenciaPorSemana`, `aderenciaResumo`, os `criterio*`, `TRILHA_PROFESSOR`, `CicloControl` e `academiaTaxa`). O `npm run lint` aponta os que sobrarem. O `CartaoDaPesquisa` continua igual.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/pesquisasTab.behavior.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/focusRing.test.js && npm run lint`
Expected: PASS, sem erro de lint.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProfessoresDados.js src/views/professores/ProfessoresView.jsx src/views/professores/ProfessoresTabela.jsx src/lib/__tests__/professoresView.behavior.test.js
git commit -m "feat: lista Carreira com a pílula Trilha, o tempo no nível e as metas por número"
```

---

### Task 11: o perfil pela trilha

**Files:**
- Modify: `src/views/professores/ProfessorPerfilView.jsx`
- Modify: `src/views/professores/PerfilCabecalho.jsx`
- Modify: `src/views/professores/NpsTab.jsx`, `AderenciaTab.jsx` e `AulasTab.jsx`
- Test: `src/lib/__tests__/professorPerfil.behavior.test.js`

- [ ] **Step 1: Write the failing test**

No `src/lib/__tests__/professorPerfil.behavior.test.js`:

1. Acrescente o mesmo falso do `useCarreira` da Task 10 e tire `metas` e `trilhaProfessor` do falso do `useProfessoresDados`. O perfil passa a achar o professor pelo `useGeneralConfig`: se o arquivo só entregava os professores pelo falso do `useProfessoresDados`, entregue-os também pelo falso do `GeneralConfigContext` (veja como outro teste de tela faz, com `grep -rn "GeneralConfigContext" src/lib/__tests__ | head`).
2. Troque nos esperados: `'Trocar nível'` por `'Trilha e nível'`, o texto do aviso do professor por `'Só leitura. Quem troca trilha, nível e metas é o gestor.'`, `'Voltar para Professores'` por `'Voltar para Carreira'`, e todo endereço montado `/professores/perfil/` por `/carreira/professor/`.
3. Acrescente os dois casos abaixo, com a montagem do arquivo:

```js
it('o placar mostra a trilha, o nível e a linha do próximo nível', async () => {
  // professor { id: 'p1', nome: 'Ana Lima', nivel: 'junior', nivelDesde: new Date(2026, 11, 1), ativo: true, modalidadeIds: [] }
  await montar();
  const placar = document.querySelector('section[aria-label="Números do plano de carreira"]');
  expect(placar.textContent).toContain('Trilha Professor, Júnior');
  expect(placar.textContent).toMatch(/Para Pleno: /);
});

it('o gestor salva a trilha e o nível no cadastro do professor', async () => {
  await montar();
  const gatilho = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Trilha e nível');
  await act(async () => { gatilho.click(); });
  const radio = (t) => [...document.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes(t));
  const pressionar = async (el) => act(async () => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await pressionar(radio('Estagiário'));
  await pressionar(radio('Estagiário II'));
  await act(async () => { document.querySelector('form').requestSubmit(); });
  expect(updateDocFalso).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ trilhaId: 'estagiario', nivel: 'estagiario2' }));
});
```

Use o nome do `updateDoc` falso que o arquivo já tem para a foto e o nível. Se ele não tiver um, siga o molde do `vi.mock('firebase/firestore', ...)` do `carreiraSettings.behavior.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/professorPerfil.behavior.test.js`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Em `src/views/professores/ProfessorPerfilView.jsx`:

1. Troque os imports de contas, ciclo e placar por:

```js
import { useCarreira } from '../../hooks/useCarreira.js';
import { trilhaDaPessoa, trilhaSugerida } from '../../lib/carreira/trilhas.js';
import { placarDe, tempoNoNivel } from '../../lib/carreira/placar.js';
import { contasDoProfessor, periodoDaPessoa } from '../../lib/carreira/professor.js';
import { PlacarDaCarreira } from './PlacarDaCarreira.jsx';
```

e apague os de `npsDoCiclo`, `../../lib/professor/ciclo.js`, `conversao.js`, `renovacao.js`, `aderencia.js` e `PlacarDoCiclo`.

2. Troque o começo do componente, do `export function ProfessorPerfilView` até o fim do `useMemo` de `contas`, por:

```js
export function ProfessorPerfilView({ db, appUser, tenantId, profId, tab, onTab, listenersActive }) {
  const toast = useToast();
  // Um relógio só por montagem: as contas do período cortam no mesmo instante.
  const [agora] = useState(() => new Date());
  const { professores: professoresDoApp, modalities } = useGeneralConfig();
  const prof = useMemo(() => (professoresDoApp || []).find((p) => p.id === profId) ?? null, [professoresDoApp, profId]);
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const trilhasDeProfessor = useMemo(() => (trilhas || []).filter((t) => t.base === 'professor'), [trilhas]);
  const trilha = useMemo(() => (prof ? trilhaDaPessoa(prof, trilhasDeProfessor, { professor: true }) : null), [prof, trilhasDeProfessor]);

  const ctx = useMemo(() => ({ trilha, agora }), [trilha, agora]);
  const [{ ciclo }, setParams] = useScreenParams('professorPerfil', ctx);
  const periodo = useMemo(() => (trilha ? periodoDaPessoa(trilha, ciclo, agora) : null), [trilha, ciclo, agora]);

  const { carregando, erro, planos, contratos, clientes, aulas, presencas } = useProfessoresDados({
    db, inicioMs: periodo?.inicio.getTime() ?? null, fimMs: periodo?.fim.getTime() ?? null, listenersActive,
  });

  const pode = isGestor(appUser);
  const professorLogado = isProfessor(appUser);
  // O professor só lê os próprios totais: a consulta dele vem filtrada, que é
  // o que a regra aceita.
  const nps = useNpsDados({ db, professorId: professorLogado ? appUser?.professorId ?? null : null, listenersActive });
  const planosById = useMemo(() => new Map((planos || []).map((p) => [p.id, p])), [planos]);
  const clientesPorId = useMemo(() => new Map((clientes || []).map((l) => [l.id, l])), [clientes]);

  const contas = useMemo(() => {
    if (carregando || carreira === null || !prof || !trilha || !periodo || nps.carregando) return null;
    const c = contasDoProfessor({ trilha, periodo, prof, clientes, contratos, planos, aulas, presencas, nps, agora });
    return { ...c, placar: placarDe(trilha, prof.nivel, c.resultados) };
  }, [carregando, carreira, prof, trilha, periodo, clientes, contratos, planos, aulas, presencas, nps, agora]);
```

O `useGeneralConfig` já está importado no arquivo. A linha antiga `const { modalities } = useGeneralConfig();` sai, porque a nova já pega as duas coisas. O `professores` que vinha do `useProfessoresDados` não é mais usado aqui.

3. Troque o `salvarNivel` por:

```js
  const salvarTrilhaENivel = async ({ trilhaId, nivel, desde }) => {
    if (!pode) return false;
    try {
      await updateDoc(profRef(), { trilhaId, nivel, nivelDesde: Timestamp.fromDate(desde) });
      toast.success('Trilha e nível salvos.');
      return true;
    } catch (e) {
      console.error('Erro ao salvar a trilha e o nível do professor:', e);
      toast.error('Não deu para salvar. Tente de novo.');
      return false;
    }
  };
```

A regra do `stronix_professores` já deixa o gestor gravar qualquer campo, então nada muda no `firestore.rules` para isso.

4. No `voltar`, troque `aria-label="Voltar para Professores"` por `aria-label="Voltar para Carreira"` e o texto `Professores` por `Carreira`. No estado sem professor, troque "Ver a lista de professores" por "Ver a lista da equipe".

5. Troque o aviso do professor logado por:

```jsx
        <p className="mb-3.5 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Eye size={16} aria-hidden="true" className="flex-none" />
          Só leitura. Quem troca trilha, nível e metas é o gestor.
        </p>
```

6. No `PerfilCabecalho`, troque a prop `onSalvarNivel={salvarNivel}` por:

```jsx
        trilhas={trilhasDeProfessor}
        trilha={trilha}
        sugeridaId={trilhaSugerida({ base: 'professor', modalidadeIds: prof.modalidadeIds }, trilhasDeProfessor)?.id ?? null}
        tempo={trilha ? tempoNoNivel(trilha, prof, agora) : null}
        onSalvarTrilha={salvarTrilhaENivel}
```

7. Troque o bloco `{!contas ? (...) : (<> <PlacarDoCiclo .../> ...)}`: a mensagem de carregando passa a ser `Carregando os números do período…`; sem trilha (`!trilha` depois de as trilhas chegarem), mostre `<p className="mt-4 text-[13px] text-muted-foreground">Sem trilha. Defina a trilha e o nível no cabeçalho.</p>`; e o `<PlacarDoCiclo ... />` vira:

```jsx
          <PlacarDaCarreira
            titulo={professorLogado ? 'Onde você está no plano de carreira' : `Onde ${primeiroNome} está no plano de carreira`}
            trilha={trilha}
            periodo={periodo}
            agora={agora}
            onChave={(c) => setParams({ ciclo: c })}
            placar={contas.placar}
            detalhes={{ renovacao: contas.renovacao, conversao: contas.conversao, nps: contas.nps, aderencia: contas.aderencia, barra: trilha.ajustes.barra ?? 2 }}
          />
```

8. Nas abas:
   - `AulasTab`: `janelaDias={trilha.ajustes.janelaDias ?? 30}`;
   - `NpsTab`: `metaNps={contas.metaNps}`;
   - `AderenciaTab`: troque `metas={metas}` por `barra={trilha.ajustes.barra ?? 2}`, `meta={contas.placar.itens.find((i) => i.id === 'aderencia')?.meta ?? null}`, `faixaMax={trilha.ajustes.faixaMax ?? 70}` e `semestral={trilha.frequencia === 'semestral'}`.

   Na `CarteiraTab`, a descrição continua igual.

Em `src/views/professores/PerfilCabecalho.jsx`:

- troque o import do `NivelPopover` por `import { TrilhaNivelPopover } from './TrilhaNivelPopover.jsx';`;
- a assinatura passa a ser `PerfilCabecalho({ prof, modalidades, pode, fotoOcupada, onFoto, trilhas, trilha, sugeridaId, tempo, onSalvarTrilha, link, onCopiar, onBaixarQr, onGerarLink })`;
- troque `<SeloDoNivel nivel={prof.nivel} desde={desde} />` por `<SeloDoNivel nome={trilha?.niveis.find((n) => n.id === prof.nivel)?.nome ?? null} desde={desde} />`, e acrescente antes dele `{trilha && <span className="inline-flex h-6 items-center rounded-[7px] bg-muted px-[9px] text-[12px] font-semibold text-foreground/80">Trilha {trilha.nome}</span>}`;
- troque `{pode && <NivelPopover nivel={prof.nivel} onSalvar={onSalvarNivel} />}` por `{pode && <TrilhaNivelPopover trilhas={trilhas} trilhaId={trilha?.id ?? null} nivel={prof.nivel} sugeridaId={sugeridaId} onSalvar={onSalvarTrilha} />}`;
- logo depois da linha dos selos, ainda dentro do `div.min-w-0`, acrescente o tempo no nível:

```jsx
          {tempo && (
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {tempo.texto}{tempo.falta ? `. ${tempo.falta}.` : ''}
            </p>
          )}
```

Em `src/views/professores/NpsTab.jsx`, o `metaNps` pode ser null (sem nível, ou meta em branco). Nas linhas que citam a meta (110, 115 e 155-156 em 27/11/2026):
- cada ` Meta: {metaNps} ou mais.` vira `{metaNps != null && ` Meta: ${metaNps} ou mais.`}`;
- cada `<SeloDaMeta ... meta={metaNps} />` vira `{metaNps != null && <SeloDaMeta ... meta={metaNps} />}`;
- a cor do número (linha 155) usa `metaNps != null && media >= metaNps`.

Em `src/views/professores/AderenciaTab.jsx`, a assinatura passa a ser `AderenciaTab({ linhas, resumo, barra, meta, faixaMax, semestral = false, leadsById, professorLogado, primeiroNome })`. Troque a linha 56 (`const { barra, faixaMin, faixaMax } = metas.aderencia;`) por `const faixaMin = meta;` e:
- onde aparece `Meta: {faixaMin}% a {faixaMax}%` ou `meta de ${faixaMin}% a ${faixaMax}%`, mostre só com `faixaMin != null`;
- a faixa verde da linha 124 só aparece com `faixaMin != null`;
- o texto "a mesma para os três níveis" vira "do nível de agora";
- com `semestral`, o título "Aderência do ano" vira "Aderência do período", e o texto da linha 82 vira `resumo.nota == null ? 'A nota sai quando o período fechar.' : 'Soma das semanas do período.'`;
- o `SeloDaFaixa` recebe `min={faixaMin}` e não aparece com `faixaMin` null.

Rode `grep -n "metas" src/views/professores/AderenciaTab.jsx src/views/professores/NpsTab.jsx` no fim: não pode sobrar referência a `metas`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/professorPerfil.behavior.test.js src/lib/__tests__/focusRing.test.js && npm run lint`
Expected: PASS, sem erro de lint.

- [ ] **Step 5: Commit**

```bash
git add src/views/professores src/lib/__tests__/professorPerfil.behavior.test.js
git commit -m "feat: perfil pela trilha, com o placar das duas metas e o tempo no nível"
```

---

### Task 12: menu, Minha carreira e a saída do `ciclo.js`

**Files:**
- Modify: `src/App.jsx` (linhas 1703, 1731 e 1801-1802 em 27/11/2026)
- Modify: `src/lib/sidebarNav.js` (comentário)
- Delete: `src/lib/professor/ciclo.js`, `src/lib/__tests__/professor.ciclo.test.js`
- Test: `src/lib/__tests__/professorShell.test.js`, `src/lib/__tests__/sidebarNav.test.js`

- [ ] **Step 1: Write the failing test**

Em `src/lib/__tests__/professorShell.test.js`:
- na linha 53, troque `['meuPerfil', 'Meu perfil']` por `['meuPerfil', 'Minha carreira']`;
- no `it('Professores fica em Administração, antes de Rotinas, pelo sidebarNav', ...)`, troque o nome do teste para `'Carreira fica em Administração, antes de Rotinas, pelo sidebarNav'` e o `label="Professores"` por `label="Carreira"`.

Em `src/lib/__tests__/sidebarNav.test.js`, troque nos nomes dos testes "Meu perfil" por "Minha carreira" e "Professores" por "Carreira". As chaves (`professores`, `meuPerfil`) ficam.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js`
Expected: FAIL, porque o `App.jsx` ainda diz "Meu perfil" e "Professores".

- [ ] **Step 3: Write minimal implementation**

Em `src/App.jsx`:
- na linha do `nav.meuPerfil`, `label="Meu perfil"` vira `label="Minha carreira"`;
- na linha do item de Administração, `label="Professores"` vira `label="Carreira"`;
- no cabeçalho, `{activeTab === 'professores' && 'Professores'}` vira `{activeTab === 'professores' && 'Carreira'}`, e a linha de baixo vira `{activeTab === 'professorPerfil' && (isProfessor(appUser) ? 'Minha carreira' : 'Carreira')}`.

Em `src/lib/sidebarNav.js`, troque o comentário dos dois itens por:

```js
    // Carreira (lista e pesquisas) é do gestor com o módulo. O Minha carreira
    // é o perfil de professor de quem está logado, e só existe com o cadastro
    // de professor ligado (appUser.professorId). O do consultor vem no PR 4.
```

Apague o `ciclo.js` e o teste dele, e confira que ninguém mais o importa:

```bash
git rm src/lib/professor/ciclo.js src/lib/__tests__/professor.ciclo.test.js
grep -rn "professor/ciclo" src api   # esperado: nada
```

Procure na wiki e nos textos de ajuda o menu antigo e troque por Carreira onde ele for citado como item do menu:

```bash
grep -rn "menu Professores\|Meu perfil" src/lib/wiki.js src/views src/components
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js src/lib/__tests__/sidebarNav.test.js && npm run lint && npm run build`
Expected: PASS, lint sem erro e build ok.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/lib/sidebarNav.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/sidebarNav.test.js
git commit -m "feat: menu Carreira e Minha carreira; sai o ciclo.js"
```

Inclua no `git add` também os arquivos da wiki ou de ajuda que mudaram.

---

### Task 13: tirar a trava do calendário da trilha Professor

O PR 2 travou a frequência e o mês da trilha Professor (na tela e na gravação), porque só o NPS lia a trilha. Com as Tasks 4, 10 e 11, os quatro números seguem o período da trilha, e a trava sai.

**Files:**
- Modify: `src/lib/carreira/validacao.js:8-12` e `:69-71`
- Modify: `src/views/settings/carreira/carreiraTexto.js:16`
- Modify: `src/views/settings/carreira/TrilhaRegras.jsx` (prop `calendarioTravado` e o aviso)
- Modify: `src/views/settings/carreira/TrilhaEditor.jsx:127`
- Test: `src/lib/__tests__/carreira.validacao.test.js`, `src/lib/__tests__/carreiraEditor.behavior.test.js`

- [ ] **Step 1: Write the failing test**

Em `src/lib/__tests__/carreira.validacao.test.js`, tire `AVISO_CALENDARIO_PROFESSOR` do import e troque o teste "a trilha Professor gravada não muda a frequência nem o mês" (com o comentário "A trava do PR 2" em cima) por:

```js
  it('a trilha Professor muda a frequência e o mês, como as outras', () => {
    const gravada = trilha();
    expect(problema({ ...trilha(), frequencia: 'semestral', mes: 6 }, { gravada })).toBeNull();
    expect(problema({ ...trilha(), mes: 3 }, { gravada })).toBeNull();
  });
```

Em `src/lib/__tests__/carreiraEditor.behavior.test.js`, tire o import de `AVISO_CALENDARIO_PROFESSOR` e troque o teste "a trilha Professor trava a frequência e o mês, com o aviso" (com o comentário em cima) por:

```js
  it('a trilha Professor muda o calendário', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, abaInicial: 'regras' });
    expect(document.body.textContent).not.toContain('O calendário da trilha Professor muda a partir do menu Carreira.');
    expect(radio('Uma vez por ano').disabled).toBe(false);
    expect(radio('Duas vezes por ano').disabled).toBe(false);
    expect(document.body.querySelector('button[aria-label="Mês da avaliação"]').disabled).toBe(false);
  });
```

e, no teste "as outras trilhas mudam o calendário", troque `.not.toContain(AVISO_CALENDARIO_PROFESSOR)` pelo texto literal `'O calendário da trilha Professor muda a partir do menu Carreira.'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.validacao.test.js src/lib/__tests__/carreiraEditor.behavior.test.js`
Expected: FAIL nos dois testes novos.

- [ ] **Step 3: Write minimal implementation**

- Em `src/lib/carreira/validacao.js`, apague o comentário "A trava do PR 2..." e a constante `AVISO_CALENDARIO_PROFESSOR` (linhas 8 a 12), e o `if (t.id === TRILHA_PROFESSOR && gravada && ...)` com o `return` dele (linhas 69 a 71). Se o `TRILHA_PROFESSOR` ficar sem uso no arquivo, tire-o do import.
- Em `src/views/settings/carreira/carreiraTexto.js`, apague a linha `export { AVISO_CALENDARIO_PROFESSOR } from '../../../lib/carreira/validacao.js';`.
- Em `src/views/settings/carreira/TrilhaRegras.jsx`, tire `AVISO_CALENDARIO_PROFESSOR` do import, a prop `calendarioTravado` da assinatura e do comentário em cima, o bloco `{calendarioTravado && (<p ...>{AVISO_CALENDARIO_PROFESSOR}</p>)}` e os dois `disabled={calendarioTravado}`.
- Em `src/views/settings/carreira/TrilhaEditor.jsx`, apague a linha `calendarioTravado={rascunho.id === TRILHA_PROFESSOR}`. Se o `TRILHA_PROFESSOR` ficar sem uso, tire-o do import.

Confira que nada mais cita a trava:

```bash
grep -rn "AVISO_CALENDARIO_PROFESSOR\|calendarioTravado" src   # esperado: nada
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreira.validacao.test.js src/lib/__tests__/carreiraEditor.behavior.test.js src/lib/__tests__/carreiraSettings.behavior.test.js && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreira/validacao.js src/views/settings/carreira src/lib/__tests__/carreira.validacao.test.js src/lib/__tests__/carreiraEditor.behavior.test.js
git commit -m "feat: a trilha Professor muda o calendário, sem a trava do PR 2"
```

---

### Task 14: regra `carreiraKept()`

**Files:**
- Modify: `firestore.rules:273-303`
- Create: `src/lib/__tests__/carreiraRules.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreiraRules.test.js`:

```js
// A trava do plano de carreira no cadastro da equipe (spec 2026-11-26,
// "Regras do Firestore"): a própria pessoa não troca trilhaId, nivel nem
// nivelDesde; o gestor troca pelo ramo isAdmin. Como o npsRules.test.js, este
// teste lê o texto da regra, que o Johnny publica à mão no console.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

describe('regra do plano de carreira em stronix_users', () => {
  it('carreiraKept compara os três campos', () => {
    const inicio = RULES.indexOf('function carreiraKept()');
    expect(inicio).toBeGreaterThan(-1);
    const fn = RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
    ['trilhaId', 'nivel', 'nivelDesde'].forEach((campo) => {
      expect(fn).toContain(`request.resource.data.get('${campo}', null) == resource.data.get('${campo}', null)`);
    });
  });

  it('o ramo da própria pessoa pede a trava; o do gestor não', () => {
    const bloco = blocoDe('stronix_users');
    const corte = bloco.indexOf('|| (request.auth.uid == userId');
    expect(corte).toBeGreaterThan(-1);
    expect(bloco.slice(corte)).toContain('carreiraKept()');
    expect(bloco.slice(bloco.indexOf('isAdmin(appId)'), corte)).not.toContain('carreiraKept()');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreiraRules.test.js`
Expected: FAIL, porque `carreiraKept` não existe.

- [ ] **Step 3: Write minimal implementation**

Em `firestore.rules`, logo depois da função `roleAndProfessorKept()`:

```
    // A trilha e o nível do plano de carreira (spec 2026-11-26-plano-de-
    // carreira-configuravel) só mudam pelo gestor, no ramo isAdmin. Sem a
    // trava, o consultor se promoveria pelo próprio cadastro. O `.get(campo,
    // null)` cobre cadastro sem os campos.
    function carreiraKept() {
      return request.resource.data.get('trilhaId', null) == resource.data.get('trilhaId', null)
        && request.resource.data.get('nivel', null) == resource.data.get('nivel', null)
        && request.resource.data.get('nivelDesde', null) == resource.data.get('nivelDesde', null);
    }
```

E no ramo da própria pessoa do `match /artifacts/{appId}/public/data/stronix_users/{userId}`:

```
          || (request.auth.uid == userId
              && request.resource.data.role == resource.data.role
              && request.resource.data.tenantId == resource.data.tenantId
              && carreiraKept())
```

Atualize o comentário do ramo: "ou o próprio usuário mexe no próprio doc (vínculo do login, "já li" do sino), sem se autopromover nem trocar a própria trilha e o nível".

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreiraRules.test.js src/lib/__tests__/professorRules.test.js src/lib/__tests__/npsRules.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/lib/__tests__/carreiraRules.test.js
git commit -m "feat: regra carreiraKept, ninguém troca a própria trilha e o nível"
```

A regra é publicada à mão no console do Firebase, com o OK do Johnny, **antes do merge**. Não use o Firebase CLI nem o SDK de administrador sem ele pedir.

---

### Task 15: documentação e verificação

**Files:**
- Modify: `CLAUDE.md` (seções "Perfil do professor" e "Plano de carreira")
- Modify: `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md` (a linha do PR 3)

- [ ] **Step 1: Atualize o `CLAUDE.md`**

Na seção "Plano de carreira", acrescente um item depois do item do PR 2:

```markdown
- **Menu Carreira** (PR 3, plano em `docs/superpowers/plans/2026-11-27-plano-de-carreira-03-menu-carreira.md`). O menu Professores virou Carreira, em `/carreira`, `/carreira/pesquisas` e `/carreira/professor/<id>/<aba>`. Os ids das telas continuam `professores` e `professorPerfil`, e só os endereços mudaram. Os endereços de `/professores` levam aos novos com replace e a query (`antigo`, no `readScreen`), e `carreira` é palavra reservada de academia. O Sentry troca o id por `:pessoaId`.
  - **Período:** o `ciclo` do endereço é a chave da trilha (`'2027'` ou `'2027-1'`), conferida pelo `periodoValido`, do primeiro período (o que contém 1º/12/2025) ao de agora. No perfil, a trilha é a da pessoa. Na lista, o período só vale com uma trilha escolhida na pílula (`trilha=<id>`); com todas, cada pessoa fica no período de agora da trilha dela. O `ciclo.js` saiu.
  - **Contas:** `contasDoProfessor` (`src/lib/carreira/professor.js`) junta as contas de `src/lib/professor/` com o período, a `janelaDaRenovacao`, os ajustes e a aderência pela frequência (a semestral soma as semanas, `aderenciaSomada`). O `placarDe` (`src/lib/carreira/placar.js`) dá, por número ligado, o resultado, a meta do nível de agora, a do próximo e o estado (`ok`, `baixo`, `sem`, `semMeta`), e o `tempoNoNivel` dá o tempo contra o mínimo. O sistema não diz se a pessoa está pronta para subir.
  - **Leitura:** a tela assina o `useCarreira` e passa ao `useProfessoresDados` a janela (`inicioMs` e `fimMs`, de `janelaDeLeitura`), e as aulas e as presenças só são lidas com ela.
  - **Trilha e nível:** o balão do perfil (`TrilhaNivelPopover`) grava `trilhaId`, `nivel` e `nivelDesde` no `stronix_professores`, com a sugerida (`trilhaSugerida`) marcada. Trocar a trilha pede o nível de novo.
  - **Minha carreira:** o "Meu perfil" do professor mudou de nome e mostra "Só leitura. Quem troca trilha, nível e metas é o gestor.".
  - **Regra:** `carreiraKept()` no ramo da própria pessoa em `stronix_users` (`carreiraRules.test.js`). Publicada no console antes do merge.
  - Neste PR, a lista e o "Trilha e nível" mostram só as trilhas de professor. O consultor entra no PR 4.
```

Na mesma seção, apague o item "Trava do PR 2" (o calendário da trilha Professor travado) e as menções ao `AVISO_CALENDARIO_PROFESSOR`: a trava saiu na Task 13.

Na seção "Perfil do professor", acrescente no começo: "Desde o PR 3 do plano de carreira, as telas moram no menu Carreira (`/carreira`) e o placar lê a trilha da pessoa; ver "Plano de carreira"." Troque os endereços `/professores/...` citados na seção por `/carreira/...`. Os nomes de arquivo e de função citados ali que mudaram neste PR (`PlacarDoCiclo`, `NivelPopover`, `ciclo.js`, `cicloDe`, `limitesDoCiclo`, `semestresDoCiclo`) passam a citar os novos ou saem.

- [ ] **Step 2: Marque o PR 3 na visão geral**

Em `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`, na tabela, troque "escrito no começo do PR 3" por `2026-11-27-plano-de-carreira-03-menu-carreira.md`.

- [ ] **Step 3: Verificação completa**

```bash
npm run lint && npm test && npm run verificar:sentry && npm run build
```

Expected: lint sem erro (o aviso antigo do `SuperAdminView` pode continuar), todos os testes passando, Sentry ok e build ok.

- [ ] **Step 4: Conferência na tela**

Abra o harness local com fakes do Firebase (memória "harness-navegador-sem-login"), sem gravar nada em produção, e confira:
- a lista a 1100 px e a 1440 px: nada sobreposto, a pílula Trilha com as contagens, a busca e a linha inteira abrindo o perfil;
- o perfil de um professor Júnior com as metas padrão: o traço laranja e o tracejado em cada régua, e a linha "Para Pleno";
- o perfil de um estagiário no semestral: o seletor de período e a aderência "do período";
- o "Trilha e nível": trocar a trilha apaga o nível;
- o tema escuro da lista e do placar.

Apague o harness antes do commit.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md
git commit -m "docs: menu Carreira no CLAUDE.md do Stronilead"
```

---

## Depois do plano

- Sugira de 3 a 8 ciclos de code review, como pede o `AGENTS.md`. As áreas de risco são: a troca de endereço (redirect em laço, o professor no próprio perfil, a query mantida), a regra `carreiraKept()`, a equivalência dos números da trilha Professor com os de antes e o custo de leitura da lista com todas as trilhas.
- A regra é publicada no console pelo Johnny antes do merge.
- O plano detalhado do PR 4 (perfil do consultor) é escrito depois do merge deste.
