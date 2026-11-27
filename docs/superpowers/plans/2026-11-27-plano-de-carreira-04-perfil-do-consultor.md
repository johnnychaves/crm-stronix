# Plano de carreira, PR 4: perfil do consultor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O consultor entra no menu Carreira com perfil próprio em `/carreira/consultor/<id>/<aba>`, os quatro números da trilha Consultor (conversão em matrícula, vendas, renovação da carteira e meta diária batida), o placar com a meta do nível e a do próximo, e o "Minha carreira" para o consultor logado.

**Architecture:** As quatro contas moram em `src/lib/carreiraConsultor.js`, fora de `src/lib/carreira/`, e chamam as funções dos painéis direto (`crm/cohort.js`, `crm/scope.js`, `gerencial/sales.js`, `operacional/renewal.js`, `operacional/month.js`). O hook `useConsultoresDados` junta a carga do CRM (`useCrmSources`), os clientes e os dias batidos da Meta. O perfil do consultor reaproveita o cabeçalho, o placar e o balão "Trilha e nível" do professor, e a lista Carreira passa a mostrar professores e consultores.

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui (Tabs), Firebase Firestore, React Router 7 sem `<Routes>`, Vitest (jsdom nos testes de tela).

**Spec:** `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md`, seções "Trilhas de consultor", "As telas", "Custo de leitura" e "Testes". Visão geral dos PRs: `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`. Mockup: `docs/superpowers/specs/mockups/2026-11-26-carreira-lista-e-perfil.html`.

---

## Decisões deste plano

1. **As contas do consultor ficam fora de `src/lib/carreira/`.** A visão geral previa `src/lib/carreira/consultor.js`, com cópia das contas que chegassem a `crm/scope.js` ou `crm/appointments.js`. Na leitura do código, a cópia teria de ser bem maior: `crm/cohort.js` importa `operacional/routine.js`, que importa `dailyGoal.js` (traz `lucide-react`), e `crm/scope.js` importa `funnels.js`. A pasta `src/lib/carreira/` tem de caber na `api/` (`carreiraImports.test.js`), mas o perfil do consultor nunca vai ser lido pela `api/`. Por isso as contas moram em `src/lib/carreiraConsultor.js` e usam as funções dos painéis direto. Não há cópia, e os testes de equivalência comparam com o painel na mesma função. O `carreiraImports.test.js` não muda.
2. **O id do perfil continua no campo `profId` do endereço**, como no perfil do professor. O campo já é "o id da pessoa" no `readScreen`, no `screenState`, no Sentry (`:pessoaId`) e no `goToSub`. No consultor, ele é o id do cadastro em `stronix_users`.
3. **As abas do consultor:** `vendas` (padrão), `renovacao`, `conversao` e `meta-diaria`.
4. **Quem é consultor na Carreira:** `isSeller(u) && !isGestor(u)`, a mesma conta do `isMetaParticipant`. O gestor fica fora mesmo quando vende, como a spec pede. O professor fica fora pelo `isSeller`.
5. **Vendas** são todas as vendas que o Gerencial conta (matrícula nova, renovação, upgrade e retorno), pelo vendedor gravado no contrato (`consultantId`), pela data do fechamento (`saleMoment`), sem o importado. Na tela, o tipo aparece como Matrícula, Renovação, Upgrade ou Retorno. O valor por mês é o total dividido pelos meses corridos do período, em que o mês em andamento conta como `dia de hoje ÷ dias do mês`.
6. **Renovação** é a coorte do Operacional (`renewalCohort` e `summarizeCohort`) na janela inteira do período, com o dono de hoje tirado dos clientes da academia (os mesmos do perfil do professor) e, sem o lead, o consultor do contrato. A taxa conta só o que já se decidiu (renovou, não vai renovar ou passou da tolerância). Quem está dentro da tolerância fica fora da conta.
7. **Meta diária** conta os dias de meta do período (`metaWeekdays`) que já acabaram (até ontem), contra os documentos de `stronix_daily_goal_history` do consultor.
8. **Conversão** é a safra por pessoa do painel CRM, somada nos meses do período até o mês de agora, em Todos os funis. O desfecho é o de agora (`outcomeAt` com o instante de agora). A academia é a mesma conta sem o filtro de pessoa. Mês da carga que falhou deixa a conversão marcada como incompleta.
9. **O consultor não tem foto nem link de NPS.** O cabeçalho do perfil (`PerfilCabecalho`) passa a esconder a câmera e o link quando não recebe os handlers.
10. **Nenhuma regra do Firestore muda.** O gestor grava `trilhaId`, `nivel` e `nivelDesde` em `stronix_users/{id}` pelo ramo `isAdmin`, e a `carreiraKept()` (publicada em 27/11/2026) impede a própria pessoa de trocar esses campos.

## Mapa dos arquivos

**Novos**
- `src/lib/carreiraConsultor.js`: `consultoresDaCarreira`, `mesesDoPeriodo`, `mesesCorridos`, `conversaoDoConsultor`, `vendasDoConsultor`, `renovacaoDoConsultor`, `metaDiariaDoConsultor` e `contasDoConsultor`.
- `src/lib/__tests__/carreiraConsultor.test.js`: as contas e a equivalência com os painéis.
- `src/hooks/useConsultoresDados.js`: a carga do CRM, os clientes e os dias batidos da Meta.
- `src/views/professores/ConsultorPerfilView.jsx`: o perfil do consultor.
- `src/views/professores/ConsultorAbas.jsx`: as abas Vendas, Renovação, Conversão e Meta diária.
- `src/lib/__tests__/routes.consultor.test.js`: endereço, acesso e Sentry do perfil do consultor.
- `src/lib/__tests__/consultorPerfil.behavior.test.js`: a tela do perfil em jsdom.

**Que mudam**
- `src/lib/routes.js`: `CONSULTOR_TABS`, tela `consultorPerfil`, `readScreen`, `hrefFor`, `canAccess`, `accessRedirect`, `sessionPathFor` e `screenKey`.
- `src/lib/appShell.js`: `profId` também no `consultorPerfil`.
- `src/lib/screenParams.js`: `consultorPerfil: { ciclo }`.
- `src/lib/sentryScrub.js`: `PROF_PATH_RE` pega `/carreira/consultor/<id>`.
- `src/lib/sidebarNav.js`: `meuPerfil` também para o consultor com o módulo.
- `src/views/professores/criterios.js`: `valorTexto` e `metaTexto` conhecem os números do consultor.
- `src/views/professores/PlacarDaCarreira.jsx`: o desenho dos quatro números do consultor.
- `src/views/professores/PerfilCabecalho.jsx`: câmera e link do NPS opcionais.
- `src/views/professores/ProfessoresTabela.jsx`: o link de cada linha vem da linha (`href`).
- `src/views/professores/ProfessoresView.jsx`: os consultores entram na lista e na pílula Trilha.
- `src/App.jsx`: monta o `ConsultorPerfilView`, o "Minha carreira" do consultor, o título e as props novas da lista.
- `src/lib/__tests__/acessoSweep.test.js`: `lib/carreiraConsultor.js` entra em `LISTAS_DE_QUEM_VENDE`.
- Testes que já existem e mudam junto: `placarDaCarreira.test.js`, `carreiraTexto.test.js` (se cobrir `valorTexto`), `professoresView.behavior.test.js`, `professorShell.test.js`, `screenParams.test.js` e `routes.professores.test.js` (Sentry).
- `CLAUDE.md` do Stronilead: o perfil do consultor na seção "Plano de carreira".

---

### Task 1: Base das contas do consultor

**Files:**
- Create: `src/lib/carreiraConsultor.js`
- Create: `src/lib/__tests__/carreiraConsultor.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// src/lib/__tests__/carreiraConsultor.test.js
// As contas do consultor no plano de carreira (PR 4): cada uma chama a conta
// do painel de origem, e o teste compara as duas num mês fechado.
import { describe, it, expect } from 'vitest';
import { consultoresDaCarreira, mesesCorridos, mesesDoPeriodo } from '../carreiraConsultor.js';

const P = (a, m, a2, m2) => ({ chave: 'x', inicio: new Date(a, m, 1), fim: new Date(a2, m2, 1) });

describe('meses do período', () => {
  it('vai do início até o mês de agora, sem passar do fim', () => {
    expect(mesesDoPeriodo(P(2025, 11, 2026, 11), new Date(2026, 2, 10))).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
    expect(mesesDoPeriodo(P(2025, 11, 2026, 1), new Date(2026, 5, 10))).toEqual(['2025-12', '2026-01']);
    expect(mesesDoPeriodo(P(2026, 11, 2027, 11), new Date(2026, 5, 10))).toEqual([]);
  });

  it('o mês em andamento conta pelos dias corridos', () => {
    // dezembro e janeiro inteiros, mais 10 de 28 dias de fevereiro
    expect(mesesCorridos(P(2025, 11, 2026, 11), new Date(2026, 1, 10, 15))).toBeCloseTo(2 + 10 / 28, 5);
    expect(mesesCorridos(P(2025, 11, 2026, 1), new Date(2026, 5, 10))).toBe(2);
    expect(mesesCorridos(P(2026, 11, 2027, 11), new Date(2026, 5, 10))).toBe(0);
  });
});

describe('quem é consultor na Carreira', () => {
  it('só o papel consultor, em ordem de nome, com a trilha e o nível do cadastro', () => {
    const users = [
      { id: 'g', name: 'Gestora', role: 'admin' },
      { id: 'p', name: 'Professor', role: 'professor' },
      { id: 'b', name: 'Bruno', role: 'consultant', trilhaId: 'consultor', nivel: 'pleno', nivelDesde: '2026-01-01' },
      { id: 'a', name: 'Ana', role: 'consultant' },
    ];
    expect(consultoresDaCarreira(users)).toEqual([
      { id: 'a', nome: 'Ana', photoUrl: null, trilhaId: null, nivel: null, nivelDesde: null },
      { id: 'b', nome: 'Bruno', photoUrl: null, trilhaId: 'consultor', nivel: 'pleno', nivelDesde: '2026-01-01' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: FAIL, "Failed to resolve import ../carreiraConsultor.js".

- [ ] **Step 3: Escrever o mínimo**

```js
// src/lib/carreiraConsultor.js
// Os números do consultor no plano de carreira (spec 2026-11-26-plano-de-
// carreira-configuravel, "Trilhas de consultor"). Cada conta chama a do painel
// de origem (CRM, Gerencial e Operacional), sem copiar regra. Mora fora de
// src/lib/carreira/ de propósito: as contas dos painéis chegam a dailyGoal.js
// (lucide-react) e a funnels.js, e a pasta da carreira tem de caber na api/
// (carreiraImports.test.js). O perfil do consultor nunca é lido pela api/.
import { isGestor, isSeller } from './acesso.js';
import { daysInMonthOf } from './gerencial/series.js';
import { addMonthsToKey, monthKeyOf, monthRange } from './operacional/month.js';

// Quem aparece na Carreira como consultor: quem vende e não é gestor (a conta
// do isMetaParticipant), na forma que as telas de Carreira leem.
export function consultoresDaCarreira(users) {
  return (users || [])
    .filter((u) => u?.id && isSeller(u) && !isGestor(u))
    .map((u) => ({
      id: u.id,
      nome: u.name || '',
      photoUrl: u.photoUrl || null,
      trilhaId: u.trilhaId ?? null,
      nivel: u.nivel ?? null,
      nivelDesde: u.nivelDesde ?? null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Os meses do período ('AAAA-MM') que já começaram: do início até o mês de
// agora, sem passar do fim (que fica fora).
export function mesesDoPeriodo(periodo, agora) {
  const out = [];
  if (!periodo) return out;
  for (let key = monthKeyOf(periodo.inicio); ; key = addMonthsToKey(key, 1)) {
    const { start } = monthRange(key);
    if (start >= periodo.fim || start > agora) break;
    out.push(key);
  }
  return out;
}

// Quantos meses do período já correram: o mês fechado vale 1, e o mês em
// andamento vale o dia de hoje dividido pelos dias dele.
export function mesesCorridos(periodo, agora) {
  return mesesDoPeriodo(periodo, agora).reduce((soma, key) => {
    const { start, end } = monthRange(key);
    return soma + (end <= agora ? 1 : agora.getDate() / daysInMonthOf(start));
  }, 0);
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreiraConsultor.js src/lib/__tests__/carreiraConsultor.test.js
git commit -m "feat: base das contas do consultor no plano de carreira"
```

### Task 2: Conversão em matrícula do consultor

**Files:**
- Modify: `src/lib/carreiraConsultor.js`
- Modify: `src/lib/__tests__/carreiraConsultor.test.js`

O fixture `src/lib/__tests__/fixtures/crmCtx.js` traz agosto de 2026 fechado e setembro em andamento (`NOW` = 14/09/2026 12h), com as donas `ana` e `diego`. `makeCtx()` devolve o `ctx` do `metricsOf` do CRM, com `months`, `leadsById`, `users` e `funnels`.

- [ ] **Step 1: Escrever o teste que falha**

```js
// acrescentar no topo de carreiraConsultor.test.js
import { metricsOf as crmMetricsOf } from '../crm/metrics.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';
import { conversaoDoConsultor } from '../carreiraConsultor.js';

describe('conversão do consultor', () => {
  const agosto = { chave: 'x', inicio: new Date(2026, 7, 1), fim: new Date(2026, 8, 1) };

  it('num mês fechado é a safra por pessoa do painel CRM, e a academia é a equipe toda', () => {
    const ctx = makeCtx();
    for (const id of ['ana', 'diego']) {
      const painel = crmMetricsOf(ctx, { monthKey: '2026-08', userId: id }).cohort;
      const equipe = crmMetricsOf(ctx, { monthKey: '2026-08' }).cohort;
      const r = conversaoDoConsultor({ months: ctx.months, leadsById: ctx.leadsById, users: ctx.users, funnels: ctx.funnels, consultantId: id, periodo: agosto, agora: NOW });
      expect(r.consultor.leads, id).toBe(painel.leads);
      expect(r.consultor.matriculas, id).toBe(painel.enrolled);
      expect(r.consultor.taxa, id).toBe(painel.conv);
      expect(r.academia.leads).toBe(equipe.leads);
      expect(r.academia.matriculas).toBe(equipe.enrolled);
      expect(r.incompleto).toBe(false);
    }
  });

  it('soma os meses do período, e cada lead da lista leva o mês e o desfecho de agora', () => {
    const ctx = makeCtx();
    const doisMeses = { chave: 'x', inicio: new Date(2026, 7, 1), fim: new Date(2026, 9, 1) };
    const ago = crmMetricsOf(ctx, { monthKey: '2026-08', userId: 'ana' }).cohort;
    const set = crmMetricsOf(ctx, { monthKey: '2026-09', userId: 'ana' }).cohort;
    const r = conversaoDoConsultor({ months: ctx.months, leadsById: ctx.leadsById, users: ctx.users, funnels: ctx.funnels, consultantId: 'ana', periodo: doisMeses, agora: NOW });
    expect(r.consultor.leads).toBe(ago.leads + set.leads);
    expect(r.consultor.matriculas).toBe(ago.enrolled + set.enrolled);
    expect(r.linhas).toHaveLength(r.consultor.leads);
    expect(r.linhas.every((l) => ['enrolled', 'lost', 'open'].includes(l.desfecho) && /^2026-0[89]$/.test(l.mes))).toBe(true);
  });

  it('mês sem carga deixa a conta incompleta', () => {
    const ctx = makeCtx();
    const comJulho = { chave: 'x', inicio: new Date(2026, 6, 1), fim: new Date(2026, 8, 1) };
    const r = conversaoDoConsultor({ months: ctx.months, leadsById: ctx.leadsById, users: ctx.users, funnels: ctx.funnels, consultantId: 'ana', periodo: comJulho, agora: NOW });
    expect(r.incompleto).toBe(true);
  });
});
```

Se `makeCtx()` já tiver julho carregado, troque o terceiro caso por um `months` sem a chave `'2026-08'` (`{ ...ctx.months, '2026-08': undefined }`).

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js -t "conversão"`
Expected: FAIL, "conversaoDoConsultor is not a function".

- [ ] **Step 3: Escrever o mínimo**

```js
// acrescentar em src/lib/carreiraConsultor.js
import { newLeadsOf, outcomeAt } from './crm/cohort.js';
import { makeScope } from './crm/scope.js';
import { pct } from './crm/stats.js';

// Conversão em matrícula: dos leads de que o consultor é dono, cadastrados no
// período, quantos se matricularam até agora, contra a mesma conta na academia
// inteira. É a safra por pessoa do painel CRM (crm/metrics.js), mês a mês, em
// Todos os funis, com o desfecho de agora. A lista do CRM vem com a cópia mais
// nova de cada lead (leadsById), como no painel.
export function conversaoDoConsultor({ months, leadsById, users, funnels, consultantId, periodo, agora }) {
  const fresco = (lista) => (lista || []).map((l) => leadsById?.get(l.id) || l);
  const equipe = makeScope({ users, funnels });
  const dono = makeScope({ users, funnels, userId: consultantId });
  const linhas = [];
  let leadsAcad = 0;
  let matAcad = 0;
  let incompleto = false;
  for (const key of mesesDoPeriodo(periodo, agora)) {
    const src = months?.[key];
    if (!src || src.failed) { incompleto = true; continue; }
    const { start, end: fimDoMes } = monthRange(key);
    const end = fimDoMes < agora ? fimDoMes : agora;
    const safra = newLeadsOf(fresco(src.leadsCreated), { start, end, inScope: equipe.inScope });
    leadsAcad += safra.length;
    safra.forEach((lead) => {
      const desfecho = outcomeAt(lead, agora);
      if (desfecho === 'enrolled') matAcad += 1;
      if (dono.ownerOk(lead)) linhas.push({ lead, mes: key, desfecho });
    });
  }
  const matriculas = linhas.filter((l) => l.desfecho === 'enrolled').length;
  linhas.sort((a, b) => b.lead.createdAt - a.lead.createdAt);
  return {
    consultor: { leads: linhas.length, matriculas, taxa: pct(matriculas, linhas.length) },
    academia: { leads: leadsAcad, matriculas: matAcad, taxa: pct(matAcad, leadsAcad) },
    linhas,
    incompleto,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreiraConsultor.js src/lib/__tests__/carreiraConsultor.test.js
git commit -m "feat: conversão do consultor pela safra do painel CRM"
```

### Task 3: Vendas do consultor

**Files:**
- Modify: `src/lib/carreiraConsultor.js`
- Modify: `src/lib/__tests__/carreiraConsultor.test.js`

Os contratos chegam já passados pelo `normalizeContracts` (`src/lib/operacional/base.js`), como no Gerencial e no perfil do professor. O vendedor é o `consultantId` do contrato.

- [ ] **Step 1: Escrever o teste que falha**

```js
// acrescentar em carreiraConsultor.test.js
import { normalizeContracts } from '../operacional/base.js';
import { salesOf } from '../gerencial/sales.js';
import { sellersOf } from '../gerencial/people.js';
import { vendasDoConsultor } from '../carreiraConsultor.js';

const contrato = (id, over) => ({
  id, leadId: `l-${id}`, personKey: `p-${id}`, consultantId: 'ana', value: 1200, durationMonths: 12,
  createdAt: new Date(2026, 7, 10), startsAt: new Date(2026, 7, 10), endsAt: new Date(2027, 7, 10), ...over,
});

describe('vendas do consultor', () => {
  const crus = [
    contrato('c1'),
    contrato('c2', { value: 600, createdAt: new Date(2026, 7, 20) }),
    contrato('c3', { consultantId: 'diego', value: 900 }),
    contrato('c4', { createdAt: new Date(2026, 8, 3), renewedFromId: 'c1' }),
    contrato('c5', { importBatchId: 'lote', value: 0 }),
  ];
  const contratos = normalizeContracts(crus);
  const agosto = { chave: 'x', inicio: new Date(2026, 7, 1), fim: new Date(2026, 8, 1) };

  it('num mês fechado, o total e a quantidade são os do consultor no Gerencial', () => {
    const { rows, sold } = salesOf(contratos, { start: agosto.inicio, end: agosto.fim });
    const ana = sellersOf(rows, sold).find((s) => s.id === 'ana');
    const r = vendasDoConsultor({ contratos, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 9, 5) });
    expect(r.total).toBe(ana.value);
    expect(r.quantidade).toBe(ana.count);
    expect(r.meses).toBe(1);
    expect(r.porMes).toEqual({ valor: ana.value, quantidade: ana.count });
  });

  it('o mês em andamento divide pelos dias corridos, e a renovação aparece como tal', () => {
    const doisMeses = { chave: 'x', inicio: new Date(2026, 7, 1), fim: new Date(2026, 9, 1) };
    const agora = new Date(2026, 8, 15, 12); // 15 de 30 dias de setembro
    const r = vendasDoConsultor({ contratos, consultantId: 'ana', periodo: doisMeses, agora });
    expect(r.quantidade).toBe(3);
    expect(r.renovacoes).toBe(1);
    expect(r.meses).toBeCloseTo(1.5, 5);
    expect(r.porMes.valor).toBeCloseTo(3000 / 1.5, 5);
    expect(r.linhas[0].contrato.id).toBe('c4');
    expect(r.linhas[0].tipo).toBe('renovacao');
  });

  it('a trilha escolhe o valor do placar: reais ou quantidade por mês', () => {
    const r = vendasDoConsultor({ contratos, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 9, 5), vendasEm: 'quantidade' });
    expect(r.valor).toBe(2);
    expect(vendasDoConsultor({ contratos, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 9, 5) }).valor).toBe(1800);
  });

  it('sem mês corrido, não há valor', () => {
    const futuro = { chave: 'x', inicio: new Date(2027, 0, 1), fim: new Date(2027, 11, 1) };
    expect(vendasDoConsultor({ contratos, consultantId: 'ana', periodo: futuro, agora: new Date(2026, 9, 5) }).valor).toBeNull();
  });
});
```

Se o `normalizeContracts` exigir algum campo a mais para marcar o importado (`imported`), confira em `src/lib/operacional/base.js` e acerte o `contrato('c5')`: o importado nunca pode contar.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js -t "vendas"`
Expected: FAIL, "vendasDoConsultor is not a function".

- [ ] **Step 3: Escrever o mínimo**

```js
// acrescentar em src/lib/carreiraConsultor.js
import { indexContracts } from './operacional/base.js';
import { soldContracts } from './gerencial/sales.js';
import { saleMoment, saleTypeOf } from './gerencial/scope.js';

// Vendas: o que o consultor fechou no período, pela data do fechamento e pelo
// vendedor do contrato, como o Gerencial (soldContracts, sem o importado). O
// valor é o do contrato, não o caixa. O placar lê por mês, em reais ou em
// quantidade (ajustes.vendasEm), com o mês em andamento pelos dias corridos.
export function vendasDoConsultor({ contratos, consultantId, periodo, agora, vendasEm = 'reais' }) {
  const end = periodo.fim < agora ? periodo.fim : agora;
  const { byPerson } = indexContracts(contratos || []);
  const linhas = soldContracts(contratos, { start: periodo.inicio, end })
    .filter((c) => c.consultantId === consultantId)
    .map((c) => ({ contrato: c, quando: saleMoment(c), tipo: saleTypeOf(c, byPerson), valor: Number(c.value) || 0 }))
    .sort((a, b) => b.quando - a.quando);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const quantidade = linhas.length;
  const renovacoes = linhas.filter((l) => l.tipo === 'renovacao').length;
  const meses = mesesCorridos(periodo, agora);
  const porMes = meses > 0 ? { valor: total / meses, quantidade: quantidade / meses } : { valor: null, quantidade: null };
  return {
    linhas,
    total,
    quantidade,
    renovacoes,
    matriculas: quantidade - renovacoes,
    meses,
    porMes,
    valor: vendasEm === 'quantidade' ? porMes.quantidade : porMes.valor,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreiraConsultor.js src/lib/__tests__/carreiraConsultor.test.js
git commit -m "feat: vendas do consultor pelas vendas do Gerencial"
```

### Task 4: Renovação da carteira do consultor

**Files:**
- Modify: `src/lib/carreiraConsultor.js`
- Modify: `src/lib/__tests__/carreiraConsultor.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// acrescentar em carreiraConsultor.test.js
import { renewalCohort, summarizeCohort } from '../operacional/renewal.js';
import { renovacaoDoConsultor } from '../carreiraConsultor.js';

describe('renovação do consultor', () => {
  const venceu = (id, over) => contrato(id, {
    createdAt: new Date(2025, 7, 10), startsAt: new Date(2025, 7, 10), endsAt: new Date(2026, 7, 10), ...over,
  });
  const crus = [
    venceu('v1'),
    venceu('v2'),
    // o lead de v3 é da Ana hoje, mesmo com o contrato vendido pelo Diego
    venceu('v3', { consultantId: 'diego' }),
    contrato('n1', { personKey: 'p-v1', leadId: 'l-v1', renewedFromId: 'v1', createdAt: new Date(2026, 7, 5), startsAt: new Date(2026, 7, 10), endsAt: new Date(2027, 7, 10) }),
  ];
  const contratos = normalizeContracts(crus);
  const clientesPorId = new Map([['l-v3', { id: 'l-v3', consultantId: 'ana' }]]);
  const agosto = { chave: 'x', inicio: new Date(2026, 7, 1), fim: new Date(2026, 8, 1) };
  const agora = new Date(2026, 9, 20);

  it('é a coorte do Operacional filtrada pelo dono de hoje', () => {
    const rows = renewalCohort(contratos, { start: agosto.inicio, end: agosto.fim, asOf: agora, graceDays: 15, leadsById: clientesPorId });
    const painel = summarizeCohort(rows, { owner: 'ana' });
    const r = renovacaoDoConsultor({ contratos, clientesPorId, graceDays: 15, consultantId: 'ana', periodo: agosto, agora });
    expect(r.taxa).toBe(painel.rate);
    expect(r.renovados).toBe(painel.counts.renew);
    expect(r.decididos).toBe(painel.decided);
    expect(r.linhas.map((l) => l.contract.id).sort()).toEqual(['v1', 'v2', 'v3']);
  });

  it('quem ainda está na tolerância fica fora da taxa', () => {
    const r = renovacaoDoConsultor({ contratos, clientesPorId, graceDays: 15, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 7, 15) });
    expect(r.linhas.find((l) => l.contract.id === 'v2').outcome).toBe('pending');
    expect(r.decididos).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js -t "renovação"`
Expected: FAIL, "renovacaoDoConsultor is not a function".

- [ ] **Step 3: Escrever o mínimo**

```js
// acrescentar em src/lib/carreiraConsultor.js
import { renewalCohort, summarizeCohort } from './operacional/renewal.js';

// Renovação da carteira: dos clientes de que o consultor é dono hoje, cujo
// contrato venceu no período, quantos renovaram. É a coorte do Operacional
// (renewalCohort e summarizeCohort) na janela do período, com o dono tirado dos
// clientes da academia e, sem o lead, o consultor do contrato. A taxa conta só
// o que já se decidiu: quem está na tolerância fica fora.
export function renovacaoDoConsultor({ contratos, clientesPorId, graceDays, consultantId, periodo, agora }) {
  const rows = renewalCohort(contratos, { start: periodo.inicio, end: periodo.fim, asOf: agora, graceDays, leadsById: clientesPorId });
  const resumo = summarizeCohort(rows, { owner: consultantId });
  const linhas = rows
    .filter((r) => r.owner === consultantId)
    .sort((a, b) => b.contract.plannedEndsAt - a.contract.plannedEndsAt);
  return { linhas, taxa: resumo.rate, renovados: resumo.counts.renew, decididos: resumo.decided, resumo };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreiraConsultor.js src/lib/__tests__/carreiraConsultor.test.js
git commit -m "feat: renovação do consultor pela coorte do Operacional"
```

### Task 5: Meta diária batida do consultor

**Files:**
- Modify: `src/lib/carreiraConsultor.js`
- Modify: `src/lib/__tests__/carreiraConsultor.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// acrescentar em carreiraConsultor.test.js
import { metaDaysOfMonth } from '../operacional/month.js';
import { metaDaysSummary } from '../operacional/routine.js';
import { metaDiariaDoConsultor } from '../carreiraConsultor.js';

describe('meta diária do consultor', () => {
  const semana = [1, 2, 3, 4, 5];
  const history = [
    { consultantId: 'ana', date: '2026-08-03' },
    { consultantId: 'ana', date: '2026-08-04' },
    { consultantId: 'ana', date: '2026-08-08' }, // sábado: fora da meta
    { consultantId: 'diego', date: '2026-08-05' },
  ];
  const agosto = { chave: 'x', inicio: new Date(2026, 7, 1), fim: new Date(2026, 8, 1) };

  it('num mês fechado é a conta do Operacional', () => {
    const agora = new Date(2026, 9, 1);
    const painel = metaDaysSummary({ users: [{ id: 'ana' }], history, metaDays: metaDaysOfMonth('2026-08', semana, agora) }).byUser.get('ana');
    const r = metaDiariaDoConsultor({ history, metaWeekdays: semana, consultantId: 'ana', periodo: agosto, agora });
    expect(r.bateram).toBe(painel.done);
    expect(r.total).toBe(painel.total);
    expect(r.total).toBe(21);
  });

  it('conta até ontem, sem os dias de folga, do dia mais novo para o mais antigo', () => {
    const r = metaDiariaDoConsultor({ history, metaWeekdays: semana, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 7, 5, 9) });
    expect(r.dias.map((d) => d.key)).toEqual(['2026-08-04', '2026-08-03']);
    expect(r.taxa).toBe(100);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js -t "meta diária"`
Expected: FAIL, "metaDiariaDoConsultor is not a function".

- [ ] **Step 3: Escrever o mínimo**

Junte o `metaDaysOfMonth` ao import de `./operacional/month.js` que a Task 1 criou (`import { addMonthsToKey, metaDaysOfMonth, monthKeyOf, monthRange } from './operacional/month.js';`) e acrescente:

```js
// Meta diária batida: dos dias de meta do período que já acabaram (os dias da
// semana da Meta, até ontem), em quantos o consultor tem o dia batido gravado
// (stronix_daily_goal_history). A mesma conta do metaDaysSummary do
// Operacional, juntando os meses do período.
export function metaDiariaDoConsultor({ history, metaWeekdays, consultantId, periodo, agora }) {
  const batidos = new Set((history || []).filter((h) => h?.consultantId === consultantId).map((h) => h.date));
  const dias = mesesDoPeriodo(periodo, agora)
    .flatMap((key) => metaDaysOfMonth(key, metaWeekdays, agora))
    .filter((d) => d.state === 'closed' && d.start >= periodo.inicio && d.start < periodo.fim)
    .map((d) => ({ key: d.key, inicio: d.start, bateu: batidos.has(d.key) }))
    .reverse();
  const bateram = dias.filter((d) => d.bateu).length;
  return { dias, bateram, total: dias.length, taxa: pct(bateram, dias.length) };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreiraConsultor.js src/lib/__tests__/carreiraConsultor.test.js
git commit -m "feat: meta diária batida do consultor"
```

### Task 6: As contas juntas para o placar

**Files:**
- Modify: `src/lib/carreiraConsultor.js`
- Modify: `src/lib/__tests__/carreiraConsultor.test.js`
- Modify: `src/lib/__tests__/acessoSweep.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// acrescentar em carreiraConsultor.test.js
import { contasDoConsultor } from '../carreiraConsultor.js';
import { placarDe } from '../carreira/placar.js';
import { trilhasDe } from '../carreira/trilhas.js';

describe('contas do consultor para o placar', () => {
  it('devolve os quatro resultados com as chaves dos números da trilha', () => {
    const ctx = makeCtx();
    const trilha = trilhasDe(null).find((t) => t.id === 'consultor');
    const periodo = { chave: '2026', inicio: new Date(2026, 7, 1), fim: new Date(2026, 8, 1) };
    const c = contasDoConsultor({
      trilha, periodo, pessoa: { id: 'ana', nivel: 'junior' },
      crm: { months: ctx.months, leadsById: ctx.leadsById }, users: ctx.users, funnels: ctx.funnels,
      contratos: [], clientesPorId: new Map(), graceDays: 15, metaWeekdays: [1, 2, 3, 4, 5], history: [], agora: NOW,
    });
    expect(Object.keys(c.resultados).sort()).toEqual(['consultorConversao', 'consultorRenovacao', 'metaDiaria', 'vendas']);
    expect(c.resultados.consultorConversao).toEqual({ valor: c.conversao.consultor.taxa, academia: c.conversao.academia.taxa });
    expect(c.resultados.vendas).toEqual({ valor: 0 });
    const placar = placarDe(trilha, 'junior', c.resultados);
    expect(placar.itens.map((i) => i.id)).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js -t "placar"`
Expected: FAIL, "contasDoConsultor is not a function".

- [ ] **Step 3: Escrever o mínimo**

```js
// acrescentar em src/lib/carreiraConsultor.js

// Tudo o que a lista e o perfil mostram de um consultor no período, mais os
// `resultados` que o placarDe recebe. As vendas no placar são por mês, em reais
// arredondados ou em quantidade com uma casa.
export function contasDoConsultor({ trilha, periodo, pessoa, crm, users, funnels, contratos, clientesPorId, graceDays, metaWeekdays, history, agora = new Date() }) {
  const id = pessoa.id;
  const conversao = conversaoDoConsultor({ months: crm?.months, leadsById: crm?.leadsById, users, funnels, consultantId: id, periodo, agora });
  const vendasEm = trilha?.ajustes?.vendasEm === 'quantidade' ? 'quantidade' : 'reais';
  const vendas = vendasDoConsultor({ contratos, consultantId: id, periodo, agora, vendasEm });
  const renovacao = renovacaoDoConsultor({ contratos, clientesPorId, graceDays, consultantId: id, periodo, agora });
  const metaDiaria = metaDiariaDoConsultor({ history, metaWeekdays, consultantId: id, periodo, agora });
  const porMes = vendas.valor == null ? null
    : vendasEm === 'quantidade' ? Math.round(vendas.valor * 10) / 10 : Math.round(vendas.valor);
  return {
    conversao,
    vendas,
    vendasEm,
    renovacao,
    metaDiaria,
    resultados: {
      consultorConversao: { valor: conversao.consultor.taxa, academia: conversao.academia.taxa },
      vendas: { valor: porMes },
      consultorRenovacao: { valor: renovacao.taxa },
      metaDiaria: { valor: metaDiaria.taxa },
    },
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/carreiraConsultor.test.js`
Expected: PASS.

- [ ] **Step 5: Varredura de quem vende**

Em `src/lib/__tests__/acessoSweep.test.js`, acrescente ao fim de `LISTAS_DE_QUEM_VENDE`:

```js
  // Carreira: quem aparece como consultor (consultoresDaCarreira).
  'lib/carreiraConsultor.js',
```

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/carreiraImports.test.js`
Expected: PASS. O `carreiraImports.test.js` continua passando porque `carreiraConsultor.js` não está em `src/lib/carreira/`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/carreiraConsultor.js src/lib/__tests__/carreiraConsultor.test.js src/lib/__tests__/acessoSweep.test.js
git commit -m "feat: contas do consultor juntas para o placar"
```

### Task 7: Textos e placar dos números do consultor

**Files:**
- Modify: `src/views/professores/criterios.js`
- Modify: `src/views/professores/PlacarDaCarreira.jsx`
- Modify: `src/views/professores/ProfessoresTabela.jsx` (só a chamada do `valorTexto` no `rotuloDaLinha`)
- Test: `src/lib/__tests__/placarDaCarreira.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente em `src/lib/__tests__/placarDaCarreira.test.js` (veja no topo do arquivo como ele importa e desenha o `PlacarDaCarreira` e siga o mesmo jeito):

```js
import { metaTexto, valorTexto } from '../../views/professores/criterios.js';

describe('textos dos números do consultor', () => {
  it('vendas em reais e em quantidade', () => {
    expect(valorTexto('vendas', 14200)).toBe('R$ 14,2 mil');
    expect(valorTexto('vendas', 950)).toBe('R$ 950');
    expect(valorTexto('vendas', 2.5, { vendasEm: 'quantidade' })).toBe('2,5 vendas');
    expect(valorTexto('vendas', 1, { vendasEm: 'quantidade' })).toBe('1 venda');
    expect(metaTexto('vendas', 18000)).toBe('R$ 18 mil por mês');
    expect(metaTexto('vendas', 3, null, { vendasEm: 'quantidade' })).toBe('3 vendas por mês');
  });

  it('a conversão do consultor segue a regra da academia, e os outros são porcentagem', () => {
    expect(metaTexto('consultorConversao', 0, 40)).toBe('acima da academia, 40%');
    expect(metaTexto('consultorConversao', 5, 40)).toBe('5 pontos acima da academia, 45%');
    expect(valorTexto('consultorRenovacao', 62)).toBe('62%');
    expect(valorTexto('metaDiaria', 81)).toBe('81%');
  });
});
```

E um caso de tela, no molde dos que o arquivo já tem, com a trilha Consultor padrão (`trilhasDe(null).find((t) => t.id === 'consultor')`), o nível `junior` com metas preenchidas (`numeros.vendas.metas.junior = 12000` e `numeros.metaDiaria.metas.junior = 75`) e estes `detalhes`:

```js
const detalhes = {
  vendasEm: 'reais',
  vendas: { quantidade: 68, total: 170400 },
  consultorConversao: { consultor: { leads: 40, matriculas: 18, taxa: 45 }, academia: { taxa: 40 }, incompleto: false },
  consultorRenovacao: { renovados: 9, decididos: 12 },
  metaDiaria: { bateram: 172, total: 213 },
};
```

Ele confere que o placar mostra "R$ 14,2 mil" para `vendas: { valor: 14200 }`, "68 vendas no período" e "172 de 213 dias de meta".

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/placarDaCarreira.test.js`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Escrever o mínimo em `criterios.js`**

Troque `valorTexto`, `metaTexto` e `proximaTexto` por:

```js
import { alvoDe } from '../../lib/carreira/placar.js';
import { NUMEROS } from '../../lib/carreira/numeros.js';

const umaCasa = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const reaisTexto = (v) => (v >= 1000 ? `R$ ${umaCasa(v / 1000)} mil` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`);

// `vendasEm` vem dos ajustes da trilha (reais ou quantidade).
export function valorTexto(id, v, { vendasEm = 'reais' } = {}) {
  if (v == null) return null;
  if (id === 'nps') return notaTexto(v);
  if (id === 'vendas') return vendasEm === 'quantidade' ? `${umaCasa(v)} ${v === 1 ? 'venda' : 'vendas'}` : reaisTexto(v);
  return `${v}%`;
}

// A meta para ler: no número contra a academia, os pontos em relação à
// academia e, com a academia, o alvo em porcentagem. A regra é passar da
// academia mais os pontos (empate não passa): 0 é "acima da academia". A meta
// de vendas é por mês.
export function metaTexto(id, meta, academia = null, opts = {}) {
  if (meta == null) return null;
  if (id === 'vendas') return `${valorTexto(id, meta, opts)} por mês`;
  if (!NUMEROS[id]?.contraAcademia) return valorTexto(id, meta, opts);
  const pontos = Math.abs(meta);
  const regra = meta === 0 ? 'acima da academia'
    : meta > 0 ? `${pontos} ${pontos === 1 ? 'ponto' : 'pontos'} acima da academia`
      : `até ${pontos} ${pontos === 1 ? 'ponto' : 'pontos'} abaixo da academia`;
  const alvo = alvoDe(id, meta, academia);
  return alvo == null ? regra : `${regra}, ${alvo}%`;
}

export function proximaTexto(item, proximo, opts = {}) {
  if (!proximo || item.metaProxima == null) return null;
  return `Para ${proximo.nome}: ${metaTexto(item.id, item.metaProxima, item.academia, opts)}`;
}
```

Confira com `grep -rn "proximaTexto\|metaTexto\|valorTexto" src` todas as chamadas e passe `{ vendasEm }` onde o número pode ser `vendas` (o placar e o `rotuloDaLinha` da tabela).

- [ ] **Step 4: Escrever o mínimo em `PlacarDaCarreira.jsx`**

No `desenhoDe(item, nivel, proximo, det)`, troque a linha `const rotulo = ...` e o teste de `id === 'conversao'` das marcas. Acrescente os ramos do consultor antes do ramo final da renovação:

```js
  const opts = { vendasEm: det.vendasEm };
  const rotulo = (v) => (id === 'nps' ? notaTexto(v) : valorTexto(id, v, opts));
  const marcas = [];
  if (NUMEROS[id]?.contraAcademia && academia != null) marcas.push({ v: academia, texto: 'academia', rotulo: `${academia}%`, tipo: 'ref' });
  // (as marcas do nível atual e do próximo continuam como estão)

  if (id === 'vendas') {
    const hi = Math.max(1, Math.ceil(Math.max(alvo ?? 0, alvoProx ?? 0, valor ?? 0) * 1.25));
    return {
      lo: 0, hi, pontas: [rotulo(0), rotulo(hi)], marcas,
      linha: `${det.vendas.quantidade} ${det.vendas.quantidade === 1 ? 'venda' : 'vendas'} no período, ${reaisTexto(det.vendas.total)}`,
      rodape: 'Valor dos contratos fechados, não o que entrou no caixa. Por mês, com o mês em andamento pelos dias corridos.',
    };
  }
  if (id === 'consultorConversao') {
    const c = det.consultorConversao;
    return {
      lo: 0, hi: 100, pontas: ['0%', '100%'], marcas,
      linha: c.consultor.taxa == null ? 'Nenhum lead no período' : `${c.consultor.matriculas} de ${c.consultor.leads} leads se matricularam`,
      rodape: c.incompleto
        ? 'Leads cadastrados no período, matrícula até hoje. Algum mês não carregou: recarregue a página.'
        : 'Leads cadastrados no período, matrícula até hoje, contra a academia inteira.',
    };
  }
  if (id === 'consultorRenovacao' || id === 'metaDiaria') {
    const [lo, hi] = escalaDaRenovacao([alvo, alvoProx, valor]);
    const r = det.consultorRenovacao;
    const m = det.metaDiaria;
    return {
      lo, hi, pontas: null, marcas,
      linha: id === 'metaDiaria'
        ? (m.total ? `${m.bateram} de ${m.total} dias de meta` : 'Nenhum dia de meta ainda')
        : (r.decididos ? `${r.renovados} de ${r.decididos} clientes renovaram` : 'Nenhum contrato venceu'),
      rodape: id === 'metaDiaria'
        ? 'Dias de meta até ontem.'
        : 'Clientes da carteira de hoje cujo contrato venceu no período.',
    };
  }
```

Importe `NUMEROS` de `../../lib/carreira/numeros.js` e `reaisTexto` e `valorTexto` de `./criterios.js`. No corpo do `PlacarDaCarreira`, passe `{ vendasEm: detalhes.vendasEm }` para o `valorTexto(item.id, item.valor)`, para o `metaTexto(...)` do rótulo e para o `proximaTexto(...)`. O perfil do professor não manda `vendasEm`, e o padrão `reais` não muda nada nos números dele.

Em `ProfessoresTabela.jsx`, no `rotuloDaLinha`, use `valorTexto(i.id, i.valor, { vendasEm: trilha?.ajustes?.vendasEm })`.

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npx vitest run src/lib/__tests__/placarDaCarreira.test.js src/lib/__tests__/carreiraTexto.test.js src/lib/__tests__/professorPerfil.behavior.test.js src/lib/__tests__/professoresView.behavior.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/professores/criterios.js src/views/professores/PlacarDaCarreira.jsx src/views/professores/ProfessoresTabela.jsx src/lib/__tests__/placarDaCarreira.test.js
git commit -m "feat: placar e textos dos números do consultor"
```

### Task 8: Endereço e acesso do perfil do consultor

**Files:**
- Modify: `src/lib/routes.js`
- Modify: `src/lib/appShell.js`
- Modify: `src/lib/screenParams.js`
- Modify: `src/lib/sentryScrub.js`
- Modify: `src/lib/sidebarNav.js`
- Create: `src/lib/__tests__/routes.consultor.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// src/lib/__tests__/routes.consultor.test.js
// O perfil do consultor (plano de carreira, PR 4): /carreira/consultor/<id>/<aba>,
// atrás do módulo. O gestor abre qualquer um; o consultor só o dele.
import { describe, it, expect } from 'vitest';
import { parseAppPath, hrefFor, canAccess, routeDecision, screenKey } from '../routes.js';
import { screenState } from '../appShell.js';
import { scrubLeadPath } from '../sentryScrub.js';
import { sidebarNav } from '../sidebarNav.js';

const T = 'stronix-crm-app';
const MOD = ['faltosos'];
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: MOD };
const ana = { id: 'ana', authUid: 'uid-ana', role: 'consultant', tenantId: T, tenantModules: MOD };
const anaSemModulo = { ...ana, tenantModules: [] };
const professor = { id: 'u6', authUid: 'uid-6', role: 'professor', professorId: 'P1', tenantId: T, tenantModules: MOD };
const decide = (path, user) => routeDecision(parseAppPath(path), user);

describe('endereço do perfil do consultor', () => {
  it('lê o id e a aba, com Vendas como padrão', () => {
    expect(parseAppPath(`/${T}/carreira/consultor/ana`)).toMatchObject({ screen: 'consultorPerfil', profId: 'ana', sub: null });
    expect(parseAppPath(`/${T}/carreira/consultor/ana/meta-diaria`)).toMatchObject({ screen: 'consultorPerfil', profId: 'ana', sub: 'meta' });
    expect(parseAppPath(`/${T}/carreira/consultor/ana/x`)).toMatchObject({ screen: 'consultorPerfil', subUnknown: true });
    expect(screenState(parseAppPath(`/${T}/carreira/consultor/ana`), null, gestor)).toMatchObject({ activeTab: 'consultorPerfil', profId: 'ana', sub: 'vendas' });
  });

  it('monta o endereço, e o id que não serve some', () => {
    expect(hrefFor(T, 'consultorPerfil', { profId: 'ana' })).toBe(`/${T}/carreira/consultor/ana`);
    expect(hrefFor(T, 'consultorPerfil', { profId: 'ana', sub: 'renovacao' })).toBe(`/${T}/carreira/consultor/ana/renovacao`);
    expect(hrefFor(T, 'consultorPerfil', { profId: 'a/b' })).toBeNull();
  });

  it('a chave da tela é por pessoa e o id sai do Sentry', () => {
    expect(screenKey(parseAppPath(`/${T}/carreira/consultor/ana/vendas`))).toBe('consultorPerfil:ana');
    expect(scrubLeadPath(`/${T}/carreira/consultor/AbC123/vendas`)).toBe(`/${T}/carreira/consultor/:pessoaId/vendas`);
    // A trilha Consultor das Configurações continua com o id da trilha.
    expect(scrubLeadPath(`/${T}/configuracoes/carreira/consultor/regras`)).toBe(`/${T}/configuracoes/carreira/:trilhaId/regras`);
  });
});

describe('quem abre', () => {
  it('o gestor abre qualquer um, o consultor só o dele, o professor nenhum', () => {
    expect(canAccess('consultorPerfil', gestor)).toBe(true);
    expect(canAccess('consultorPerfil', ana)).toBe(true);
    expect(canAccess('consultorPerfil', anaSemModulo)).toBe(false);
    expect(canAccess('consultorPerfil', professor)).toBe(false);
    expect(decide(`/${T}/carreira/consultor/ana`, ana)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/carreira/consultor/bruno/renovacao`, ana)).toMatchObject({ kind: 'redirect', to: `/${T}/carreira/consultor/ana/renovacao`, notice: 'nao-liberada' });
    expect(decide(`/${T}/carreira/consultor/bruno`, gestor)).toEqual({ kind: 'ok' });
  });

  it('o perfil de outra academia cai na lista da sessão', () => {
    expect(decide('/outra-academia/carreira/consultor/ana', gestor)).toMatchObject({ kind: 'redirect', to: `/${T}/carreira` });
  });

  it('o consultor com o módulo tem o Minha carreira', () => {
    expect(sidebarNav(ana).meuPerfil).toBeTruthy();
    expect(sidebarNav(anaSemModulo).meuPerfil).toBeFalsy();
    expect(sidebarNav(gestor).meuPerfil).toBeFalsy();
  });
});
```

Confira a assinatura de `sidebarNav` em `src/lib/sidebarNav.js` antes de rodar: se ela recebe mais argumentos além do `appUser`, passe-os como o `professorShell.test.js` passa.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/routes.consultor.test.js`
Expected: FAIL.

- [ ] **Step 3: `routes.js`**

1. Depois do `PERFIL_TABS`:

```js
// Abas do perfil do consultor, em /carreira/consultor/<id>/<aba> (plano de
// carreira, PR 4).
export const CONSULTOR_TABS = Object.freeze({
  vendas: 'vendas',
  renovacao: 'renovacao',
  conversao: 'conversao',
  meta: 'meta-diaria',
});
```

2. Em `SCREENS`, depois de `professorPerfil`:

```js
  consultorPerfil: tela(['carreira', 'consultor'], 'Carreira', { modulo: MODULES.FALTOSOS, subs: CONSULTOR_TABS, subPadrao: 'vendas' }),
```

3. Em `SPECIAL`, acrescente `'consultorPerfil'`.

4. No `readScreen`, dentro do bloco `if (head === 'carreira' || head === 'professores')`, logo depois do `if` do `professorPerfil`:

```js
    if (!antigo && lower(segs[1]) === 'consultor') {
      out.screen = 'consultorPerfil';
      out.profId = isValidLeadId(segs[2]) ? segs[2] : null;
      out.rest = segs.slice(3);
      readSub('consultorPerfil', out.rest, out);
      return;
    }
```

5. No `hrefFor`, depois do `if (screen === 'professorPerfil')`:

```js
  if (screen === 'consultorPerfil') {
    const id = isValidLeadId(profId) ? encode(profId) : null;
    return id === null ? null : `${base}/carreira/consultor/${id}${trecho}`;
  }
```

6. No `canAccess`, depois da linha do `professorPerfil`:

```js
  // O consultor abre o próprio perfil (o accessRedirect leva ao dele); o
  // gestor abre qualquer um.
  if (screen === 'consultorPerfil') return isGestor(appUser) || isMetaParticipant(appUser);
```

Importe `isMetaParticipant` de `./acesso.js` junto com os outros.

7. No `blockedNotice`, troque `screen === 'professorPerfil'` por `(screen === 'professorPerfil' || screen === 'consultorPerfil')`.

8. No `accessRedirect`, depois do bloco do professor no perfil:

```js
  // O consultor abre só o próprio perfil de carreira: o de outro leva ao dele.
  if (route.screen === 'consultorPerfil' && !isGestor(appUser)) {
    const dele = hrefFor(tenantId, 'consultorPerfil', { profId: appUser?.id, sub: route.sub });
    if (!dele) return redirectTo(home, { notice: 'nao-liberada' });
    if (route.profId !== appUser.id) return redirectTo(dele, { search, notice: 'nao-liberada' });
  }
```

9. No `sessionPathFor`, troque `if (route.screen === 'professorPerfil')` por `if (route.screen === 'professorPerfil' || route.screen === 'consultorPerfil')`, com o comentário "O perfil é de alguém da outra academia: cai na lista da sessão."

10. No `screenKey`, depois da linha do `professorPerfil`:

```js
  if (screen === 'consultorPerfil') return `consultorPerfil:${route.profId ?? ''}`;
```

- [ ] **Step 4: `appShell.js`, `screenParams.js`, `sentryScrub.js` e `sidebarNav.js`**

`src/lib/appShell.js`, no `screenState`:

```js
    profId: shown?.screen === 'professorPerfil' || shown?.screen === 'consultorPerfil' ? (shown.profId ?? null) : null,
```

`src/lib/screenParams.js`, na `TABELA`, depois de `professorPerfil: { ciclo },`:

```js
  consultorPerfil: { ciclo },
```

`src/lib/sentryScrub.js`, no `PROF_PATH_RE`:

```js
// E o id da pessoa do perfil de carreira (/carreira/professor/<id>,
// /carreira/consultor/<id> e o endereço de antes, /professores/perfil/<id>).
// Fora de /configuracoes, onde /carreira/professor e /carreira/consultor são
// trilhas (TRILHA_PATH_RE).
const PROF_PATH_RE = /((?<!\/configuracoes)\/(?:carreira\/(?:professor|consultor)|professores\/perfil)\/)[^/?#\s"'<>]+/gi;
```

`src/lib/sidebarNav.js`, troque a linha do `meuPerfil` e o comentário de cima:

```js
    // Carreira (lista e pesquisas) é do gestor com o módulo. O Minha carreira
    // é o perfil de quem está logado: o do professor, com o cadastro de
    // professor ligado (appUser.professorId), e o do consultor.
    professores: tela('professores'),
    meuPerfil: (isProfessor(appUser) && Boolean(appUser?.professorId) && tela('professorPerfil'))
      || (isMetaParticipant(appUser) && tela('consultorPerfil')),
```

Importe `isMetaParticipant` de `./acesso.js`.

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npx vitest run src/lib/__tests__/routes.consultor.test.js src/lib/__tests__/routes.professores.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/routes.carreira.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/screenParams.test.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/tenantSlug.test.js`
Expected: PASS. Se o `routes.test.js` tiver uma lista fechada das telas ou dos segmentos, acrescente `consultorPerfil` nela.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routes.js src/lib/appShell.js src/lib/screenParams.js src/lib/sentryScrub.js src/lib/sidebarNav.js src/lib/__tests__/
git commit -m "feat: endereço e acesso do perfil do consultor"
```

### Task 9: Os dados do consultor

**Files:**
- Create: `src/hooks/useConsultoresDados.js`

Um hook sem teste próprio, no molde do `useProfessoresDados`. Ele é coberto pelos testes de tela das Tasks 11 e 13, que o substituem por um falso.

- [ ] **Step 1: Escrever o hook**

```js
// src/hooks/useConsultoresDados.js
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH, LEADS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { dayKeyOf } from '../lib/operacional/month.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { mesesDoPeriodo } from '../lib/carreiraConsultor.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useCrmSources } from './useCrmSources.js';
import { usePagedLeads } from './usePagedLeads.js';

// Os dados das telas de Carreira para o consultor (plano de carreira, PR 4).
// Os contratos, os dias da Meta e a tolerância da renovação chegam pelo App
// (useGeneralConfig). Três leituras: os meses do CRM da janela (useCrmSources,
// a mesma carga e a mesma memória de sessão dos painéis), os clientes da
// academia (a mesma consulta e a mesma chave do useProfessoresDados, para o
// dono de hoje da renovação) e os dias batidos da Meta. Com `consultantId` (o
// perfil), os dias batidos vêm pelo consultantId; sem ele (a lista), pelo date
// dentro da janela. As duas consultas são de campo único.
//
// A janela (`inicioMs` e `fimMs`, com o fim fora) vem da tela, como no
// useProfessoresDados. As leituras só começam com o portão de ociosidade
// aberto e ficam ligadas depois disso.
const CLIENTES_SPEC_KEY = 'professores-clientes';

export function useConsultoresDados({ db, inicioMs = null, fimMs = null, consultantId = null, agora, liveLeads, interactions, listenersActive }) {
  const { contratos: contratosCrus, metaWeekdays, renewalGraceDays } = useGeneralConfig();
  const contratos = useMemo(() => normalizeContracts(contratosCrus), [contratosCrus]);

  const [ligado, setLigado] = useState(Boolean(listenersActive));
  if (listenersActive && !ligado) setLigado(true);
  const ler = ligado && Boolean(db);
  const temJanela = inicioMs != null && fimMs != null;

  const monthKeys = useMemo(
    () => (temJanela ? mesesDoPeriodo({ inicio: new Date(inicioMs), fim: new Date(fimMs) }, agora) : []),
    [temJanela, inicioMs, fimMs, agora],
  );
  const fontes = useCrmSources({ db, enabled: ler && temJanela, now: agora, monthKeys, liveInteractions: interactions, liveLeads });
  const crm = useMemo(() => ({ months: fontes.months, leadsById: fontes.leadsById }), [fontes.months, fontes.leadsById]);

  const spec = useMemo(() => clientsAllQuerySpec(), []);
  const { items: clientes, ready: clientesProntos, error: clientesErro } = usePagedLeads({
    db, path: LEADS_PATH, spec, specKey: CLIENTES_SPEC_KEY, enabled: ler,
  });

  const chave = temJanela ? `${inicioMs}-${fimMs}-${consultantId ?? ''}` : null;
  const [historico, setHistorico] = useState(null); // { chave, lista, erro }
  useEffect(() => {
    if (!ler || !temJanela) return undefined;
    let vivo = true;
    const col = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const q = consultantId
      ? query(col, where('consultantId', '==', consultantId))
      : query(col, where('date', '>=', dayKeyOf(new Date(inicioMs))), where('date', '<', dayKeyOf(new Date(fimMs))));
    const essa = `${inicioMs}-${fimMs}-${consultantId ?? ''}`;
    getDocs(q)
      .then((snap) => { if (vivo) setHistorico({ chave: essa, lista: snap.docs.map((d) => d.data()), erro: null }); })
      .catch((err) => {
        console.error('useConsultoresDados historico', err);
        if (vivo) setHistorico({ chave: essa, lista: [], erro: err });
      });
    return () => { vivo = false; };
  }, [db, ler, temJanela, inicioMs, fimMs, consultantId]);
  const historicoDaJanela = chave && historico?.chave === chave ? historico : null;
  const clientesPorId = useMemo(() => new Map((clientes || []).map((l) => [l.id, l])), [clientes]);

  return {
    carregando: !temJanela || fontes.loading || !clientesProntos || !historicoDaJanela,
    erro: clientesErro || historicoDaJanela?.erro || null,
    crm,
    contratos,
    clientesPorId,
    history: historicoDaJanela?.lista ?? [],
    metaWeekdays,
    graceDays: renewalGraceDays,
  };
}
```

Antes de seguir, confira em `src/hooks/useCrmSources.js` o que `loading` e `failedKeys` significam. Se `loading` fica verdadeiro com `monthKeys` vazio, troque por `temJanela && fontes.loading`. O mês que falhou não vira erro aqui, porque a conversão já o marca como `incompleto`.

- [ ] **Step 2: Lint**

Run: `npx eslint src/hooks/useConsultoresDados.js`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useConsultoresDados.js
git commit -m "feat: dados do consultor para as telas de Carreira"
```

### Task 10: Cabeçalho do perfil sem foto e sem link

**Files:**
- Modify: `src/views/professores/PerfilCabecalho.jsx`
- Test: `src/lib/__tests__/professorPerfil.behavior.test.js` (só confirmar que continua passando)

- [ ] **Step 1: Escrever o mínimo**

Em `PerfilCabecalho`, troque o comentário e a assinatura, e torne opcionais as duas partes. O professor continua igual, porque o perfil dele sempre manda `onFoto` e `onCopiar`.

```js
// Cabeçalho do perfil (mockup B): a foto com o anel azul, o nome, a trilha, o
// nível com a data, as modalidades, o tempo no nível e, só para o gestor, a
// câmera e o "Trilha e nível". Embaixo, o link do NPS. O consultor não tem
// foto nem NPS: sem `onFoto` não há câmera, e sem `onCopiar` não há a linha
// do link. `semNome` é o texto de quem não tem nome.
export function PerfilCabecalho({ prof, modalidades = [], pode, fotoOcupada, onFoto = null, trilhas, trilha, sugeridaId, tempo, onSalvarTrilha, link, onCopiar = null, onBaixarQr, onGerarLink, semNome = 'Professor sem nome' }) {
```

- `{pode && (` da câmera vira `{pode && onFoto && (`.
- `{prof.nome || 'Professor sem nome'}` vira `{prof.nome || semNome}`.
- `<LinhaDoLink ... />` vira `{onCopiar && <LinhaDoLink ... />}`.

- [ ] **Step 2: Rodar o teste do professor**

Run: `npx vitest run src/lib/__tests__/professorPerfil.behavior.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/views/professores/PerfilCabecalho.jsx
git commit -m "refactor: cabeçalho do perfil com foto e link do NPS opcionais"
```

### Task 11: A tela do perfil do consultor

**Files:**
- Create: `src/views/professores/ConsultorAbas.jsx`
- Create: `src/views/professores/ConsultorPerfilView.jsx`
- Create: `src/lib/__tests__/consultorPerfil.behavior.test.js`

Use a skill `frontend-design` antes de mexer no desenho. A tela segue o perfil do professor e o mockup (`docs/superpowers/specs/mockups/2026-11-26-carreira-lista-e-perfil.html`, aba "Perfil do consultor"), com as mesmas classes de tabela da `CarteiraTab.jsx`.

- [ ] **Step 1: Escrever o teste de tela que falha**

Monte o arquivo no molde do `src/lib/__tests__/professorPerfil.behavior.test.js`: copie o cabeçalho de ambiente (`// @vitest-environment jsdom`, `IS_REACT_ACT_ENVIRONMENT` e o `ResizeObserver` falso), os mocks de `../firebase.js`, `firebase/firestore` e `../../hooks/useCarreira.js`, o `MemoryRouter`, a montagem com `createRoot` e o `GeneralConfigContext`, se ele for usado lá. No mock de `../firebase.js`, acrescente `USERS_PATH: 'stronix_users'`. Os mocks deste arquivo:

```js
const s = vi.hoisted(() => ({ dados: null }));
vi.mock('../../hooks/useConsultoresDados.js', () => ({ useConsultoresDados: () => s.dados }));
vi.mock('../carreiraConsultor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  contasDoConsultor: () => ({
    vendasEm: 'reais',
    vendas: { linhas: [{ contrato: { id: 'c1', leadId: 'l1', leadName: 'Carla Souza', planName: 'Clube+ Start' }, quando: new Date(2026, 9, 3), tipo: 'renovacao', valor: 1309 }], total: 1309, quantidade: 1, renovacoes: 1, matriculas: 0, meses: 1, porMes: { valor: 1309, quantidade: 1 }, valor: 1309 },
    conversao: { consultor: { leads: 4, matriculas: 1, taxa: 25 }, academia: { leads: 40, matriculas: 12, taxa: 30 }, linhas: [], incompleto: false },
    renovacao: { linhas: [], taxa: null, renovados: 0, decididos: 0 },
    metaDiaria: { dias: [{ key: '2026-10-02', inicio: new Date(2026, 9, 2), bateu: true }], bateram: 1, total: 1, taxa: 100 },
    resultados: { consultorConversao: { valor: 25, academia: 30 }, vendas: { valor: 1309 }, consultorRenovacao: { valor: null }, metaDiaria: { valor: 100 } },
  }),
}));
```

Com `s.dados = { carregando: false, erro: null, crm: {}, contratos: [], clientesPorId: new Map(), history: [], metaWeekdays: [1, 2, 3, 4, 5], graceDays: 15 }` e `usersList = [{ id: 'ana', name: 'Ana Ribeiro', role: 'consultant', trilhaId: 'consultor', nivel: 'junior', nivelDesde: '2026-03-01' }]`, os casos são:

1. A gestora (`{ id: 'g', role: 'admin', tenantModules: ['faltosos'] }`) vê "Ana Ribeiro", "Trilha Consultor" e o botão "Trilha e nível". A aba Vendas abre com "Carla Souza" num link para `/acad/ficha/l1`, "Renovação" na linha e o texto "valor dos contratos, não o que entrou no caixa".
2. A consultora logada (`{ id: 'ana', role: 'consultant', tenantModules: ['faltosos'] }`) vê "Só leitura. Quem troca trilha, nível e metas é o gestor." e não vê o botão "Trilha e nível".
3. Clicar na aba "Meta diária" chama o `onTab` com `'meta'`. Com `tab="meta"`, a lista mostra o dia 02/10 como "Bateu".
4. Com um id que não está no `usersList`, aparece "Não achamos esse consultor.".
5. Salvar no "Trilha e nível" chama o `updateDoc` com o caminho `artifacts/acad/public/data/stronix_users/ana` e `{ trilhaId, nivel, nivelDesde }`. Para abrir e salvar o balão, siga o caso equivalente do `professorPerfil.behavior.test.js`.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/consultorPerfil.behavior.test.js`
Expected: FAIL, "Failed to resolve import ../../views/professores/ConsultorPerfilView.jsx".

- [ ] **Step 3: Escrever as abas**

```jsx
// src/views/professores/ConsultorAbas.jsx
import { cn } from '@/lib/utils';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { reaisTexto } from './criterios.js';

// As quatro abas do perfil do consultor (plano de carreira, PR 4). Cada nome
// abre a ficha (LeadLink). As contas vêm prontas de src/lib/carreiraConsultor.js.
const TIPO = { nova: 'Matrícula', renovacao: 'Renovação', upgrade: 'Upgrade', retorno: 'Retorno' };
const dia = (d) => (d instanceof Date ? d.toLocaleDateString('pt-BR') : '—');
const NOME = 'truncate font-semibold outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300';
const CARTAO = 'overflow-hidden rounded-[18px] border border-border bg-card shadow-card';
const LINHA = 'grid items-center gap-3 border-b border-border px-5 py-3 text-[13.5px] last:border-b-0';

function Vazio({ children }) {
  return <p className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">{children}</p>;
}

function Pilula({ ok, children }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-semibold', ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
      {children}
    </span>
  );
}

export function VendasTab({ vendas }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-10 gap-y-2 rounded-[18px] border border-border bg-card px-5 py-4 shadow-card">
        <div>
          <b className="num block text-[18px] font-bold">{vendas.quantidade} {vendas.quantidade === 1 ? 'venda' : 'vendas'}</b>
          <span className="text-[12.5px] text-muted-foreground">{vendas.matriculas} {vendas.matriculas === 1 ? 'matrícula' : 'matrículas'} e {vendas.renovacoes} {vendas.renovacoes === 1 ? 'renovação' : 'renovações'}</span>
        </div>
        <div>
          <b className="num block text-[18px] font-bold">{reaisTexto(vendas.total)}</b>
          <span className="text-[12.5px] text-muted-foreground">valor dos contratos, não o que entrou no caixa</span>
        </div>
      </div>
      {vendas.linhas.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : (
        <ul aria-label="Vendas do período" className={cn(CARTAO, 'm-0 list-none p-0')}>
          {vendas.linhas.map(({ contrato, quando, tipo, valor }) => (
            <li key={contrato.id} className={cn(LINHA, 'grid-cols-[88px_minmax(0,1.4fr)_110px_minmax(0,1fr)_100px]')}>
              <span className="num text-muted-foreground">{dia(quando)}</span>
              <LeadLink leadId={contrato.leadId} className={NOME}>{contrato.leadName || 'Cliente sem nome'}</LeadLink>
              <span><Pilula ok={tipo !== 'renovacao'}>{TIPO[tipo] ?? 'Matrícula'}</Pilula></span>
              <span className="truncate">{contrato.planName || 'Sem plano'}</span>
              <span className="num text-right font-semibold">{reaisTexto(valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DESFECHO_RENOVACAO = { renew: 'Renovou', wont: 'Não vai renovar', lapsed: 'Não renovou', pending: 'Na tolerância' };

export function RenovacaoTab({ renovacao }) {
  if (!renovacao.linhas.length) return <Vazio>Nenhum contrato da carteira venceu no período.</Vazio>;
  return (
    <ul aria-label="Contratos que venceram no período" className={cn(CARTAO, 'm-0 list-none p-0')}>
      {renovacao.linhas.map(({ contract, outcome }) => (
        <li key={contract.id} className={cn(LINHA, 'grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_130px]')}>
          <span className="num text-muted-foreground">{dia(contract.plannedEndsAt)}</span>
          <LeadLink leadId={contract.leadId} className={NOME}>{contract.leadName || 'Cliente sem nome'}</LeadLink>
          <span className="truncate">{contract.planName || 'Sem plano'}</span>
          <span><Pilula ok={outcome === 'renew'}>{DESFECHO_RENOVACAO[outcome]}</Pilula></span>
        </li>
      ))}
    </ul>
  );
}

const DESFECHO_LEAD = { enrolled: 'Matriculou', lost: 'Perdido', open: 'Em aberto' };

export function ConversaoTab({ conversao }) {
  return (
    <div className="flex flex-col gap-3">
      {conversao.incompleto && <p role="alert" className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">Algum mês do período não carregou. Recarregue a página.</p>}
      {conversao.linhas.length === 0 ? <Vazio>Nenhum lead cadastrado no período.</Vazio> : (
        <ul aria-label="Leads do período" className={cn(CARTAO, 'm-0 list-none p-0')}>
          {conversao.linhas.map(({ lead, desfecho }) => (
            <li key={lead.id} className={cn(LINHA, 'grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_120px]')}>
              <span className="num text-muted-foreground">{dia(lead.createdAt)}</span>
              <LeadLink leadId={lead.id} className={NOME}>{lead.name || 'Lead sem nome'}</LeadLink>
              <span className="truncate">{String(lead.source || '').trim() || 'Sem origem'}</span>
              <span><Pilula ok={desfecho === 'enrolled'}>{DESFECHO_LEAD[desfecho]}</Pilula></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MetaDiariaTab({ metaDiaria }) {
  if (!metaDiaria.dias.length) return <Vazio>Nenhum dia de meta no período ainda.</Vazio>;
  return (
    <ul aria-label="Dias de meta do período" className={cn(CARTAO, 'm-0 list-none p-0')}>
      {metaDiaria.dias.map((d) => (
        <li key={d.key} className={cn(LINHA, 'grid-cols-[minmax(0,1fr)_120px]')}>
          <span className="num">{d.inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>
          <span><Pilula ok={d.bateu}>{d.bateu ? 'Bateu' : 'Não bateu'}</Pilula></span>
        </li>
      ))}
    </ul>
  );
}
```

O `contract.leadName` e o `contract.planName` são os campos que o `normalizeContract` mantém do documento do contrato (o `leadName` é gravado em `src/lib/contracts.js`). Se o `normalizeContract` não os repassar, leia o nome no `clientesPorId` (`clientesPorId.get(contract.leadId)?.name`) e passe o mapa para as abas.

As colunas fixas dessas listas quebram a 375 px. Siga o `CarteiraTab.jsx`: abaixo de um `@container` de 640 px, cada linha vira duas (data e pílula em cima, nome e plano embaixo). Ajuste as classes no mesmo molde que ele usa.

- [ ] **Step 4: Escrever o perfil**

```jsx
// src/views/professores/ConsultorPerfilView.jsx
import { useMemo, useState } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appId, USERS_PATH } from '../../lib/firebase.js';
import { isGestor } from '../../lib/acesso.js';
import { hrefFor } from '../../lib/routes.js';
import { trilhaDaPessoa, trilhaSugerida } from '../../lib/carreira/trilhas.js';
import { placarDe, tempoNoNivel } from '../../lib/carreira/placar.js';
import { periodoDaPessoa } from '../../lib/carreira/professor.js';
import { consultoresDaCarreira, contasDoConsultor } from '../../lib/carreiraConsultor.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useCarreira } from '../../hooks/useCarreira.js';
import { useConsultoresDados } from '../../hooks/useConsultoresDados.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { ConversaoTab, MetaDiariaTab, RenovacaoTab, VendasTab } from './ConsultorAbas.jsx';
import { PerfilCabecalho } from './PerfilCabecalho.jsx';
import { PlacarDaCarreira } from './PlacarDaCarreira.jsx';
import { TAB_CONTAGEM, TAB_TRIGGER } from './ProfessoresComum.jsx';

// O perfil do consultor no plano de carreira (PR 4), no desenho do perfil do
// professor: cabeçalho com a trilha, o nível e o tempo no nível, o placar do
// período e as abas Vendas, Renovação, Conversão e Meta diária. O gestor abre
// qualquer consultor e troca a trilha e o nível; o consultor logado chega só
// ao próprio (a rota garante) e lê. O período mora no endereço (`ciclo`).
const LINK = 'rounded outline-none focus-visible:anel-foco';
const ABAS = ['vendas', 'renovacao', 'conversao', 'meta'];

export function ConsultorPerfilView({ db, appUser, tenantId, profId, tab, onTab, usersList, funnels, liveLeads, interactions, listenersActive }) {
  const toast = useToast();
  const [agora] = useState(() => new Date());
  const pessoa = useMemo(() => consultoresDaCarreira(usersList).find((u) => u.id === profId) ?? null, [usersList, profId]);
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const trilhasDeConsultor = useMemo(() => (trilhas || []).filter((t) => t.base === 'consultor'), [trilhas]);
  const trilha = useMemo(() => trilhaDaPessoa(pessoa, trilhasDeConsultor), [pessoa, trilhasDeConsultor]);

  const ctx = useMemo(() => ({ trilha, agora }), [trilha, agora]);
  const [{ ciclo }, setParams] = useScreenParams('consultorPerfil', ctx);
  const periodo = useMemo(() => (trilha ? periodoDaPessoa(trilha, ciclo, agora) : null), [trilha, ciclo, agora]);

  const dados = useConsultoresDados({
    db, consultantId: profId, agora, liveLeads, interactions, listenersActive,
    inicioMs: periodo?.inicio.getTime() ?? null,
    fimMs: periodo?.fim.getTime() ?? null,
  });
  const { carregando, crm, contratos, clientesPorId, graceDays, metaWeekdays, history } = dados;

  const contas = useMemo(() => {
    if (carregando || carreira === null || !pessoa || !trilha || !periodo) return null;
    const c = contasDoConsultor({ trilha, periodo, pessoa, crm, users: usersList, funnels, contratos, clientesPorId, graceDays, metaWeekdays, history, agora });
    return { ...c, placar: placarDe(trilha, pessoa.nivel, c.resultados) };
  }, [carregando, carreira, pessoa, trilha, periodo, crm, usersList, funnels, contratos, clientesPorId, graceDays, metaWeekdays, history, agora]);

  const pode = isGestor(appUser);
  const logado = appUser?.id === profId && !pode;

  const salvarTrilhaENivel = async ({ trilhaId, nivel, desde }) => {
    if (!pode) return false;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, pessoa.id), { trilhaId, nivel, nivelDesde: Timestamp.fromDate(desde) });
      toast.success('Trilha e nível salvos.');
      return true;
    } catch (e) {
      console.error('Erro ao salvar a trilha e o nível do consultor:', e);
      toast.error('Não deu para salvar. Tente de novo.');
      return false;
    }
  };

  const voltar = pode && (
    <AppLink to={hrefFor(tenantId, 'professores')} aria-label="Voltar para Carreira" className={`${LINK} mb-3.5 inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-brand-700 dark:hover:text-brand-300`}>
      <ChevronLeft size={16} aria-hidden="true" />Carreira
    </AppLink>
  );

  if (!pessoa) {
    return (
      <div className="mx-auto max-w-[1240px] animate-fade-in">
        {!usersList?.length ? (
          <p className="text-[13px] text-muted-foreground">Carregando o perfil…</p>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-[14px]">
            <p className="m-0 font-semibold">Não achamos esse consultor.</p>
            {pode && (
              <AppLink to={hrefFor(tenantId, 'professores')} className={`${LINK} mt-2 inline-block font-semibold text-brand-700 hover:underline dark:text-brand-300`}>
                Ver a lista da equipe
              </AppLink>
            )}
          </div>
        )}
      </div>
    );
  }

  const primeiroNome = pessoa.nome.trim().split(/\s+/)[0] || 'o consultor';
  const aba = ABAS.includes(tab) ? tab : 'vendas';

  return (
    <div className="mx-auto max-w-[1240px] animate-fade-in pb-12">
      {voltar}
      {logado && (
        <p className="mb-3.5 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Eye size={16} aria-hidden="true" className="flex-none" />
          Só leitura. Quem troca trilha, nível e metas é o gestor.
        </p>
      )}

      <PerfilCabecalho
        prof={pessoa}
        pode={pode}
        trilhas={trilhasDeConsultor}
        trilha={trilha}
        sugeridaId={trilhaSugerida({ base: 'consultor' }, trilhasDeConsultor)?.id ?? null}
        tempo={trilha ? tempoNoNivel(trilha, pessoa, agora) : null}
        onSalvarTrilha={salvarTrilhaENivel}
        semNome="Consultor sem nome"
      />

      {(dados.erro || carreira?.erro) && <p role="alert" className="mt-3 text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para carregar tudo. Recarregue a página.</p>}

      {trilhas && !trilha ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Sem trilha. Defina a trilha e o nível no cabeçalho.</p>
      ) : !contas ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Carregando os números do período…</p>
      ) : (
        <>
          <PlacarDaCarreira
            titulo={logado ? 'Onde você está no plano de carreira' : `Onde ${primeiroNome} está no plano de carreira`}
            trilha={trilha}
            periodo={periodo}
            agora={agora}
            onChave={(c) => setParams({ ciclo: c })}
            placar={contas.placar}
            detalhes={{
              vendasEm: contas.vendasEm,
              vendas: contas.vendas,
              consultorConversao: contas.conversao,
              consultorRenovacao: contas.renovacao,
              metaDiaria: contas.metaDiaria,
            }}
          />

          <Tabs value={aba} onValueChange={(id) => onTab?.(id === 'vendas' ? null : id)} className="mt-7 gap-4">
            <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
              <TabsTrigger value="vendas" className={TAB_TRIGGER}>Vendas <span className={TAB_CONTAGEM}>{contas.vendas.quantidade}</span></TabsTrigger>
              <TabsTrigger value="renovacao" className={TAB_TRIGGER}>Renovação <span className={TAB_CONTAGEM}>{contas.renovacao.linhas.length}</span></TabsTrigger>
              <TabsTrigger value="conversao" className={TAB_TRIGGER}>Conversão <span className={TAB_CONTAGEM}>{contas.conversao.linhas.length}</span></TabsTrigger>
              <TabsTrigger value="meta" className={TAB_TRIGGER}>Meta diária</TabsTrigger>
            </TabsList>
            <TabsContent value="vendas" tabIndex={-1}><VendasTab vendas={contas.vendas} /></TabsContent>
            <TabsContent value="renovacao" tabIndex={-1}><RenovacaoTab renovacao={contas.renovacao} /></TabsContent>
            <TabsContent value="conversao" tabIndex={-1}><ConversaoTab conversao={contas.conversao} /></TabsContent>
            <TabsContent value="meta" tabIndex={-1}><MetaDiariaTab metaDiaria={contas.metaDiaria} /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
```

O consultor logado sem a lista da equipe completa: para quem não é gestor, o `usersList` do App começa só com o `appUser` e depois recebe a equipe inteira (uma leitura por sessão). Como o próprio consultor está nessa lista desde o início, o perfil dele abre sem esperar.

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/consultorPerfil.behavior.test.js`
Expected: PASS (5 casos).

- [ ] **Step 6: Commit**

```bash
git add src/views/professores/ConsultorAbas.jsx src/views/professores/ConsultorPerfilView.jsx src/lib/__tests__/consultorPerfil.behavior.test.js
git commit -m "feat: perfil do consultor com placar e as quatro abas"
```

### Task 12: Montar o perfil no App e o Minha carreira do consultor

**Files:**
- Modify: `src/App.jsx`
- Test: `src/lib/__tests__/professorShell.test.js`

- [ ] **Step 1: Escrever o teste que falha**

No `professorShell.test.js`, perto do teste que confere o `nav.meuPerfil` (a linha com `['meuPerfil', 'Minha carreira']`), acrescente o caso abaixo, usando a variável que o arquivo já tem com o texto do `App.jsx`:

```js
  it('o Minha carreira do consultor leva ao perfil do consultor, e o App monta a tela', () => {
    expect(app).toMatch(/menuHref\('consultorPerfil', \{ profId: appUser\.id \}\)/);
    expect(app).toMatch(/activeTab === 'consultorPerfil' && \(\s*<ConsultorPerfilView/);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js`
Expected: FAIL.

- [ ] **Step 3: Escrever no `App.jsx`**

1. Import, junto do `ProfessorPerfilView`:

```js
import { ConsultorPerfilView } from './views/professores/ConsultorPerfilView.jsx';
```

2. No item do Minha carreira (hoje na linha com `label="Minha carreira"`), troque o `href` e o `active`:

```jsx
{nav.meuPerfil && <SidebarItem icon={<IdCard className="w-[18px] h-[18px]" />} label="Minha carreira" href={isProfessor(appUser) ? menuHref('professorPerfil', { profId: appUser.professorId }) : menuHref('consultorPerfil', { profId: appUser.id })} onNavigate={closeDrawer} active={activeTab === 'professorPerfil' || activeTab === 'consultorPerfil'} />}
```

3. No item Carreira do gestor, o `active` passa a incluir `activeTab === 'consultorPerfil'`.

4. No título da tela (a linha com `activeTab === 'professorPerfil' && (isProfessor(appUser) ? 'Minha carreira' : 'Carreira')`), acrescente logo depois:

```jsx
{activeTab === 'consultorPerfil' && (isGestor(appUser) ? 'Carreira' : 'Minha carreira')}
```

5. Depois do bloco do `ProfessorPerfilView`:

```jsx
              {activeTab === 'consultorPerfil' && (
                <ConsultorPerfilView
                  db={db}
                  appUser={appUser}
                  tenantId={sessionTenant}
                  profId={profId}
                  tab={sub}
                  onTab={(subId) => goToSub('consultorPerfil', subId, { profId }, location.search)}
                  usersList={usersList}
                  funnels={funnels}
                  liveLeads={metaLeads}
                  interactions={interactions}
                  listenersActive={listenersActive}
                />
              )}
```

6. No `ProfessoresView`, acrescente as props que a Task 13 usa: `usersList={usersList} funnels={funnels} liveLeads={metaLeads} interactions={interactions}`.

Confira que `metaLeads`, `interactions` e `funnels` são os mesmos nomes que o App passa ao `RelatoriosView` (`liveLeads={metaLeads}` e `interactions={interactions}`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/lib/__tests__/professorShell.test.js
git commit -m "feat: perfil do consultor no App e Minha carreira do consultor"
```

### Task 13: Os consultores na lista Carreira

**Files:**
- Modify: `src/views/professores/ProfessoresView.jsx`
- Modify: `src/views/professores/ProfessoresTabela.jsx`
- Test: `src/lib/__tests__/professoresView.behavior.test.js`

- [ ] **Step 1: Escrever o teste que falha**

No `professoresView.behavior.test.js`, mocke também o `useConsultoresDados` e o `contasDoConsultor` (como na Task 11). Passe `usersList` com uma consultora `{ id: 'ana', name: 'Ana Ribeiro', role: 'consultant', trilhaId: 'consultor', nivel: 'junior' }` e uma gestora. Casos novos:

1. A lista tem "Ana Ribeiro" com "Consultor", e o link da linha é `/acad/carreira/consultor/ana`.
2. A gestora não aparece.
3. A pílula Trilha tem a opção "Consultor" com a contagem 1, e escolher "Consultor" deixa só a Ana.
4. Sem professor e sem consultor, a lista diz "Ninguém da equipe no plano de carreira ainda.".

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professoresView.behavior.test.js`
Expected: FAIL nos casos novos.

- [ ] **Step 3: `ProfessoresTabela.jsx`**

O link de cada linha passa a vir da linha, porque o consultor abre outro perfil:

```jsx
              <AppLink
                to={linha.href}
```

No `rotuloDaLinha`, o nome sem nome usa `linha.semNome`:

```js
    prof.nome || linha.semNome || 'Sem nome',
```

Faça o mesmo no `<b>` do nome da linha. A chave do `<li>` vira `key={linha.href}`, porque um professor e um consultor podem ter o mesmo id em coleções diferentes.

- [ ] **Step 4: `ProfessoresView.jsx`**

1. Assinatura: `export function ProfessoresView({ db, appUser, tenantId, tab, onTab, usersList, funnels, liveLeads, interactions, listenersActive })`.
2. As trilhas da pílula passam a ser todas, sem o filtro `t.base === 'professor'`. Troque `trilhasDeProfessor` por `const trilhasDaLista = useMemo(() => trilhas || [], [trilhas]);` no `ctx`, na janela e nas opções, e apague o comentário "Neste PR só as trilhas de professor".
3. A janela de leitura considera as trilhas das duas bases (`alvo = escolhida ? [escolhida] : trilhasDaLista`).
4. Os consultores e os dados deles:

```js
  const consultores = useMemo(() => consultoresDaCarreira(usersList), [usersList]);
  const dadosC = useConsultoresDados({
    db, agora, liveLeads, interactions, listenersActive,
    inicioMs: consultores.length ? janela?.inicio.getTime() ?? null : null,
    fimMs: consultores.length ? janela?.fim.getTime() ?? null : null,
  });
  const trilhaDoConsultor = useCallback((c) => trilhaDaPessoa(c, trilhasDaLista), [trilhasDaLista]);
```

Sem consultor, a janela do hook fica `null` e ele não lê nada.

5. A `contagem` soma também os consultores pela `trilhaDoConsultor`. A aba "Pessoas" conta `ativos.length + consultores.length`, ou a contagem da trilha escolhida.
6. As linhas dos professores ganham `href: hrefFor(tenantId, 'professorPerfil', { profId: prof.id })` e `semNome: 'Professor sem nome'`. As linhas dos consultores:

```js
    const deConsultores = dadosC.carregando ? null : consultores
      .filter((c) => !escolhida || trilhaDoConsultor(c)?.id === escolhida.id)
      .map((c) => {
        const trilha = trilhaDoConsultor(c);
        const href = hrefFor(tenantId, 'consultorPerfil', { profId: c.id });
        if (!trilha) return { prof: c, trilha: null, placar: placarDe(null, null, {}), tempo: null, desde: null, href, semNome: 'Consultor sem nome' };
        const periodo = periodoDaPessoa(trilha, trilha === escolhida ? ciclo : null, agora);
        const contas = contasDoConsultor({
          trilha, periodo, pessoa: c, crm: dadosC.crm, users: usersList, funnels,
          contratos: dadosC.contratos, clientesPorId: dadosC.clientesPorId, graceDays: dadosC.graceDays,
          metaWeekdays: dadosC.metaWeekdays, history: dadosC.history, agora,
        });
        return {
          prof: c, trilha, href, semNome: 'Consultor sem nome',
          placar: placarDe(trilha, c.nivel, contas.resultados),
          tempo: tempoNoNivel(trilha, c, agora),
          desde: getSafeDateOrNull(c.nivelDesde)?.toLocaleDateString('pt-BR') ?? null,
        };
      });
```

Junte as duas listas em ordem de nome (`[...deProfessores, ...deConsultores].sort((a, b) => porNome(a.prof, b.prof))`) e deixe `linhas` em `null` enquanto qualquer uma das duas carrega. Sem consultor, `dadosC.carregando` fica verdadeiro, porque o hook não tem janela: nesse caso use `[]` para os consultores em vez de esperar (`const deConsultores = !consultores.length ? [] : dadosC.carregando ? null : ...`).

7. O professor sem trilha continua caindo na trilha Professor: `trilhaDaPessoa(prof, trilhasDaLista.filter((t) => t.base === 'professor'), { professor: true })`. O consultor sem trilha fica sem trilha e aparece com "Definir trilha e nível".
8. O vazio: troque `ativos.length === 0` por `ativos.length + consultores.length === 0`, com o texto "Ninguém da equipe no plano de carreira ainda.". O cartão da pesquisa (`CartaoDaPesquisa`) continua só quando há professor ativo.

Imports novos: `consultoresDaCarreira` e `contasDoConsultor` de `../../lib/carreiraConsultor.js`, e `useConsultoresDados` de `../../hooks/useConsultoresDados.js`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/focusRing.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/professores/ProfessoresView.jsx src/views/professores/ProfessoresTabela.jsx src/lib/__tests__/professoresView.behavior.test.js
git commit -m "feat: consultores na lista Carreira"
```

### Task 14: Documentação e verificação completa

**Files:**
- Modify: `CLAUDE.md` (do Stronilead, seção "Plano de carreira")

- [ ] **Step 1: `CLAUDE.md`**

Na seção "Plano de carreira", depois do bloco "Menu Carreira (PR 3)", acrescente:

```md
- **Perfil do consultor** (PR 4, plano em `docs/superpowers/plans/2026-11-27-plano-de-carreira-04-perfil-do-consultor.md`). Tela `consultorPerfil`, em `/carreira/consultor/<id>/<aba>` (abas `vendas`, `renovacao`, `conversao` e `meta-diaria`), atrás do módulo, com o id do cadastro em `stronix_users` no campo `profId` do endereço, como o perfil do professor. O gestor abre qualquer consultor; o consultor abre só o dele, pelo "Minha carreira", só para leitura. Quem aparece como consultor é quem vende e não é gestor (`consultoresDaCarreira`).
  - **Contas** em `src/lib/carreiraConsultor.js`, fora de `src/lib/carreira/` de propósito: elas chamam as contas dos painéis direto (`crm/cohort.js`, `crm/scope.js`, `gerencial/sales.js`, `operacional/renewal.js`), que chegam a `dailyGoal.js` e a `funnels.js` e não cabem na `api/`. A conversão é a safra por pessoa do CRM somada nos meses do período, com o desfecho de agora, em Todos os funis. As vendas são as do Gerencial pelo vendedor do contrato, por mês, com o mês em andamento pelos dias corridos, em reais ou quantidade (`ajustes.vendasEm`). A renovação é a coorte do Operacional na janela do período, com o dono de hoje tirado dos clientes da academia. A meta diária conta os dias de meta até ontem contra `stronix_daily_goal_history`. O `carreiraConsultor.test.js` compara cada conta com o painel num mês fechado.
  - **Dados:** `useConsultoresDados`, com os meses do CRM pelo `useCrmSources` (a mesma memória de sessão dos painéis), os clientes pela mesma consulta do `useProfessoresDados` e os dias batidos pelo `date` na lista e pelo `consultantId` no perfil.
  - **Gravação:** o "Trilha e nível" do consultor grava `trilhaId`, `nivel` e `nivelDesde` em `stronix_users/{id}`, pelo ramo `isAdmin` das regras. A `carreiraKept()` impede a própria pessoa de trocar esses campos. Nenhuma regra mudou neste PR.
```

No bloco "Menu Carreira", troque "Neste PR, a lista e o 'Trilha e nível' mostram só as trilhas de professor. O consultor entra no PR 4." por "A lista mostra professores e consultores, e a pílula Trilha tem as trilhas das duas bases."

- [ ] **Step 2: Verificação completa, igual ao CI**

Run: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Expected: lint sem erro, todos os testes passando, a verificação do Sentry passando e o build saindo.

- [ ] **Step 3: Conferir na tela**

Rode `npm run dev` com o harness local de navegador sem login (memória "Harness no navegador sem login"), ou peça ao Johnny para abrir o preview da Vercel logado como gestor da STRONIX:
- `/stronix-crm-app/carreira` mostra os consultores com a trilha Consultor;
- o perfil de uma consultora mostra o placar e as quatro abas, com nomes que abrem a ficha;
- o "Trilha e nível" salva, e o placar passa a mostrar a meta do nível;
- logado como consultora, o "Minha carreira" abre o próprio perfil só para leitura, e o endereço de outra consultora leva ao dela com o aviso.

As metas da trilha Consultor nascem em branco (`null` em todos os níveis), então o placar mostra "Sem meta definida" até o gestor preencher em Configurações → Plano de carreira.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: perfil do consultor no CLAUDE.md do Stronilead"
```

---

## Depois do PR

- Atualizar a linha do Stronilead e a tabela "Últimas Atualizações" do `CLAUDE.md` da raiz do STRONIX-FIRMA quando o PR entrar na `main`.
- Sugerir os ciclos de code review, como pede o `AGENTS.md`. Os ângulos que mais pedem atenção aqui são a equivalência das contas com os painéis (conversão e renovação, com dado real), o acesso do consultor ao perfil de outro, o custo de leitura da lista (a carga do CRM de 12 meses) e o desenho das abas no celular.
