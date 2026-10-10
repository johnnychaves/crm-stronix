# Relatórios de Leads, PR 1 (tela, Entrada e Conversão) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O menu lateral ganha o item Relatórios. A tela abre no relatório de Leads, com a lista ao lado e os submenus Entrada de leads e Conversão: período, consultores, origem e funil no endereço, números com a variação, recortes que filtram a lista de nomes e o exportar.

**Architecture:** As contas moram em `src/lib/relatorios/leads/`, puras, e chamam as funções do painel CRM (`src/lib/crm/`). O painel ganha só as saídas por lead de que o relatório precisa (`cohortMilestoneOf`, `firstContactMinutesOf`) e a lista de pessoas no `makeScope`, sem mudar conta nenhuma. A carga é a do painel (`useCrmSources`), com os meses do início do comparado até o mês atual. O período sai de `src/lib/period.js` (API da spec de 25/09) e fica no endereço pela tabela de `src/lib/screenParams.js`. A tela mora em `src/views/relatorios/`, desenhada com a skill frontend-design no molde visual dos painéis (`CrmCard`, `DeltaPill`).

**Tech Stack:** React 19, Vite, Tailwind v4 (tokens semânticos, `cn()`), shadcn (`Popover`, `Select`, `Checkbox`), React Router 7 (`useScreenParams`), Vitest em node com `renderToString` (e jsdom só no teste do download), ESLint com react-hooks v7.

Spec: `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md`.

---

## Decisões de arquitetura

1. **As mesmas contas do painel CRM.** Nenhuma regra é copiada. Onde o painel só devolve contagem (`cohortMilestones`, `firstContactOf`), a regra de um lead vira função própria e a contagem passa a chamá-la, com o resultado de antes. Os testes de equivalência comparam o relatório com o `metricsOf` em meses inteiros, para cada pessoa e cada funil.
2. **Período.** O `src/lib/period.js` é o da Task 1 do plano do período personalizado (`docs/superpowers/plans/2026-09-25-periodo-pr1-base-operacional.md`, branch `claude/periodo-personalizado`), sem mudança de regra. A Visão geral continua com o mês neste PR. A tabela do endereço ganha os parâmetros do período só na tela `relatorios`.
3. **Carga.** `reportMonthKeys` pede do mês do início mais antigo (o período ou o comparado) até o mês atual, porque a safra da Conversão é acompanhada até agora. A conta só roda com todos os meses carregados. Se algum mês falhar, a tela mostra o aviso e nenhum número.
4. **Recorte da lista.** O parâmetro `recorte` guarda `tipo:valor` (`situacao:matricularam`, `origem:Instagram`, `consultor:<id>`, `funil:<id>`, `faixa:ate-1h`). Cada conta devolve os códigos que existem no submenu, e o recorte fora deles é ignorado.
5. **Exportar.** `src/lib/csvExport.js` é a função única: aspas só quando o valor pede, proteção contra fórmula e BOM no download. Todos os leads e Aulas e Visitas passam a usá-la.
6. **Visual.** Feito com a skill frontend-design dentro da identidade do app. O elemento próprio da tela é a lista que repete o número de que veio e o filtro aplicado, e cada número e cada linha de recorte é um filtro dessa lista.
7. **Trocar de submenu leva o período e os filtros junto.** O `goToSub` do `App.jsx` ganha a query, e a tela manda a dela sem o recorte.

## Pontos que o plano decidiu

- `RELATORIOS_SUBS` nasce só com `entrada` e `conversao`. O PR 2 acrescenta `visitas-e-aulas`, `perdas` e `parados`.
- A comparação é sempre com o período anterior (no modo mês, o mês anterior com o corte do mês em andamento). Não há caixa para desligar nem escolha de mês.
- A variação da conversão é em pontos (`p.p.`); a das contagens, em %.
- O "Mostrar mais" acrescenta 50 nomes por clique e volta a 50 quando o filtro muda.
- O arquivo exportado se chama `leads-<submenu>-<início>-a-<último dia>.csv`.
- Texto curto de cada item da lista ao lado: "Quantos chegaram e de onde" e "Quantos viraram matrícula".
- O consultor que saiu da equipe aparece na lista com o nome gravado no lead, e nos recortes entra em "Fora da equipe ou sem responsável", como o Outros do painel.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/period.js` | Criar | Período puro: atalhos, mês, intervalo, recusas, período anterior, meses tocados, textos |
| `src/lib/__tests__/period.test.js` | Criar | Testes do período |
| `src/lib/csvExport.js` | Criar | Planilha única: `csvCell`, `toCsv`, `downloadCsv` |
| `src/lib/__tests__/csvExport.test.js` | Criar | Testes da planilha (jsdom) |
| `src/lib/appointmentReport.js` | Modificar | `rowsToCsv` passa a chamar `toCsv` |
| `src/lib/__tests__/appointmentReport.test.js` | Modificar | Proteção contra fórmula no CSV de Aulas e Visitas |
| `src/modals/AppointmentExportModal.jsx` | Modificar | Download pelo `downloadCsv` |
| `src/views/LeadsView.jsx` | Modificar | Exportar pela função única |
| `src/lib/acesso.js` | Modificar | `ACTIONS.RELATORIOS_EXPORTAR` |
| `src/lib/__tests__/acesso.test.js` | Modificar | Nome da ação nova |
| `src/lib/routes.js` | Modificar | `RELATORIOS_SUBS` e `SCREENS.relatorios` |
| `src/lib/tenantSlug.js` | Modificar | `relatorios` reservada |
| `src/lib/sidebarNav.js` | Modificar | Item `relatorios` |
| `src/lib/__tests__/routes.test.js` | Modificar | Tela nova e submenus |
| `src/lib/__tests__/sidebarNav.test.js` | Modificar | Item novo no menu de cada papel |
| `src/lib/relatoriosRail.js` | Criar | Grupos e itens da lista ao lado |
| `src/lib/__tests__/relatoriosRail.test.js` | Criar | Contrato com a tabela de endereços |
| `src/lib/screenParams.js` | Modificar | Parâmetros do período, `origem` e `recorte` na tela `relatorios` |
| `src/lib/__tests__/screenParams.test.js` | Modificar | Bloco dos Relatórios |
| `src/lib/__tests__/filtrosNoEndereco.sweep.test.js` | Modificar | Nomes novos proibidos em `key` |
| `src/lib/crm/scope.js` | Modificar | `makeScope` aceita `userIds` |
| `src/lib/__tests__/crm.scope.test.js` | Modificar | Lista de pessoas |
| `src/lib/crm/appointments.js` | Modificar | `cohortMilestoneOf` |
| `src/lib/__tests__/crm.appointments.test.js` | Modificar | Marcos de um lead |
| `src/lib/crm/contact.js` | Modificar | `firstContactMinutesOf` |
| `src/lib/__tests__/crm.contact.test.js` | Modificar | Minutos de um lead |
| `src/lib/__tests__/fixtures/crmCtx.js` | Criar | Fixtures do painel CRM, saídas do `crm.metrics.test.js` |
| `src/lib/__tests__/crm.metrics.test.js` | Modificar | Importa as fixtures |
| `src/lib/relatorios/leads/janela.js` | Criar | Meses pedidos, baldes, índices e estado da carga |
| `src/lib/relatorios/leads/base.js` | Criar | Recorte da barra, leads novos, nomes, filtro da lista, contato, datas, nome do arquivo |
| `src/lib/relatorios/leads/entrada.js` | Criar | Conta da Entrada de leads |
| `src/lib/relatorios/leads/conversao.js` | Criar | Conta da Conversão |
| `src/lib/__tests__/relatoriosLeads.janela.test.js` | Criar | Testes da janela |
| `src/lib/__tests__/relatoriosLeads.base.test.js` | Criar | Testes da base |
| `src/lib/__tests__/relatoriosLeads.entrada.test.js` | Criar | Testes e equivalência da Entrada |
| `src/lib/__tests__/relatoriosLeads.conversao.test.js` | Criar | Testes e equivalência da Conversão |
| `src/components/period/PeriodControl.jsx` | Criar | Botão e balão do período |
| `src/lib/__tests__/periodControl.test.js` | Criar | Render do período |
| `src/views/relatorios/ReportParts.jsx` | Criar | Cabeçalho, número grande, números-filtro, recortes, lista, exportar, aviso |
| `src/lib/__tests__/relatoriosParts.test.js` | Criar | Render das peças |
| `src/views/relatorios/RelatoriosToolbar.jsx` | Criar | Barra: período, mês, consultores, origem, funil |
| `src/views/relatorios/RelatoriosRail.jsx` | Criar | Lista ao lado e seletor do celular |
| `src/lib/__tests__/relatoriosBarra.test.js` | Criar | Render da barra e da lista ao lado |
| `src/views/relatorios/EntradaSection.jsx` | Criar | Tela da Entrada de leads |
| `src/views/relatorios/ConversaoSection.jsx` | Criar | Tela da Conversão |
| `src/views/relatorios/RelatoriosView.jsx` | Criar | A tela: endereço, carga, contas, véu, exportar |
| `src/lib/__tests__/relatoriosTela.test.js` | Criar | Render da tela com a carga falsa |
| `src/App.jsx` | Modificar | Item do menu, tela montada, `goToSub` com query |
| `src/lib/__tests__/professorShell.test.js` | Modificar | Item novo pelo `sidebarNav` |
| `src/lib/__tests__/acessoSweep.test.js` | Modificar | A tela entra em `LISTAS_DE_QUEM_VENDE` |
| `CLAUDE.md` | Modificar | Seção "Relatórios" |

Nada a publicar no Firestore: nenhuma consulta nova, nenhum índice, nenhuma regra.

---

### Task 0: Branch e linha de base

**Files:** nenhum.

- [ ] **Step 1: Conferir o branch e a distância da main**

Run:
```bash
git branch --show-current
git fetch origin
git rev-list --count HEAD..origin/main
```
Expected: `claude/relatorios-de-leads` e `0`. Se a contagem for maior que zero, pare e peça ao controlador para atualizar o branch antes de seguir.

- [ ] **Step 2: Instalar dependências**

O `node_modules` do worktree pode ficar para trás da main.

Run:
```bash
npm install
git status --short
```
Expected: nenhuma mudança em `package-lock.json`. Se ele mudar, `git checkout package-lock.json` e avise o controlador.

- [ ] **Step 3: Linha de base**

Run:
```bash
npx vitest run
npm run lint
```
Expected: todos os testes passando e o lint com `0 errors`. Anote os totais de arquivos e de testes como `B_ARQ` e `B_TESTES`: cada task diz quantos testes ela acrescenta.

---

### Task 1: `src/lib/period.js`

**Files:**
- Create: `src/lib/period.js`
- Test: `src/lib/__tests__/period.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/period.test.js`:

```js
// Período dos Relatórios e da Visão geral (src/lib/period.js): atalhos, semana
// de segunda a domingo, intervalo e recusas, período anterior com o corte e
// textos do botão.
import { describe, it, expect } from 'vitest';
import {
  PERIOD_SHORTCUTS, periodFromParams, previousPeriod, monthsCovering, intervalRefusal, oldestDayKey,
  dateFromDayKey, rangeLabel, crossesMonths, dayLabelOf
} from '../period.js';

// 25/09/2026, sexta, 14h30. A semana dele vai de 21 (segunda) a 27 (domingo).
const NOW = new Date(2026, 8, 25, 14, 30);
const D = (m, d, h = 0, min = 0) => new Date(2026, m - 1, d, h, min);

describe('atalhos', () => {
  it('são quatro, e nenhum é o mês ou o intervalo', () => {
    expect(PERIOD_SHORTCUTS).toEqual(['hoje', 'ontem', 'semana', 'semana-passada']);
  });

  it('hoje vai da meia-noite até agora, em andamento', () => {
    const p = periodFromParams({ periodo: 'hoje' }, NOW);
    expect(p).toMatchObject({ kind: 'hoje', start: D(9, 25), fullEnd: D(9, 26), end: NOW, running: true, monthKey: null, days: 1 });
    expect(p.label).toBe('Hoje · 25 set');
  });

  it('ontem é o dia inteiro, fechado', () => {
    const p = periodFromParams({ periodo: 'ontem' }, NOW);
    expect(p).toMatchObject({ kind: 'ontem', start: D(9, 24), fullEnd: D(9, 25), end: D(9, 25), running: false, days: 1 });
    expect(p.label).toBe('Ontem · 24 set');
  });

  it('esta semana vai de segunda até agora, com a régua até domingo', () => {
    const p = periodFromParams({ periodo: 'semana' }, NOW);
    expect(p).toMatchObject({ kind: 'semana', start: D(9, 21), fullEnd: D(9, 28), end: NOW, running: true, days: 7 });
    expect(p.label).toBe('Esta semana · 21 a 25 set');
  });

  it('semana passada é a semana anterior inteira, de segunda a domingo', () => {
    const p = periodFromParams({ periodo: 'semana-passada' }, NOW);
    expect(p).toMatchObject({ kind: 'semana-passada', start: D(9, 14), fullEnd: D(9, 21), end: D(9, 21), running: false, days: 7 });
    expect(p.label).toBe('Semana passada · 14 a 20 set');
  });

  it('no domingo a semana ainda é a que começou na segunda', () => {
    const domingo = new Date(2026, 8, 27, 10);
    expect(periodFromParams({ periodo: 'semana' }, domingo)).toMatchObject({ start: D(9, 21), fullEnd: D(9, 28), label: 'Esta semana · 21 a 27 set' });
    expect(periodFromParams({ periodo: 'semana-passada' }, domingo)).toMatchObject({ start: D(9, 14), label: 'Semana passada · 14 a 20 set' });
  });

  it('na segunda a semana tem um dia só', () => {
    const segunda = new Date(2026, 8, 28, 9);
    expect(periodFromParams({ periodo: 'semana' }, segunda)).toMatchObject({ start: D(9, 28), fullEnd: D(10, 5), label: 'Esta semana · 28 set' });
    expect(periodFromParams({ periodo: 'semana-passada' }, segunda)).toMatchObject({ start: D(9, 21), label: 'Semana passada · 21 a 27 set' });
  });

  it('semana que cruza meses leva os dois meses no texto', () => {
    const quinta = new Date(2026, 9, 1, 11);
    const p = periodFromParams({ periodo: 'semana' }, quinta);
    expect(p).toMatchObject({ start: D(9, 28), fullEnd: D(10, 5), end: quinta, label: 'Esta semana · 28 set a 1 out' });
    expect(crossesMonths(p)).toBe(true);
    expect(monthsCovering(p.start, p.end)).toEqual(['2026-09', '2026-10']);
  });

  it('atalho desconhecido cai no mês', () => {
    expect(periodFromParams({ periodo: 'amanha' }, NOW).kind).toBe('mes');
  });
});

describe('mês', () => {
  it('sem período é o mês do endereço, com o texto de sempre', () => {
    const atual = periodFromParams({ monthKey: '2026-09' }, NOW);
    expect(atual).toMatchObject({ kind: 'mes', start: D(9, 1), fullEnd: D(10, 1), end: NOW, running: true, monthKey: '2026-09', days: 30 });
    expect(atual.label).toBe('Setembro 2026 · em andamento');
    const fechado = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(fechado).toMatchObject({ end: D(9, 1), running: false, label: 'Agosto 2026', days: 31 });
    expect(crossesMonths(fechado)).toBe(false);
  });

  it('sem mês nenhum é o mês de agora', () => {
    expect(periodFromParams({}, NOW).monthKey).toBe('2026-09');
  });
});

describe('intervalo', () => {
  it('de e até incluídos: o fim nominal é o dia seguinte ao até', () => {
    const p = periodFromParams({ de: '2026-09-01', ate: '2026-09-10' }, NOW);
    expect(p).toMatchObject({ kind: 'intervalo', start: D(9, 1), fullEnd: D(9, 11), end: D(9, 11), running: false, days: 10, de: '2026-09-01', ate: '2026-09-10' });
    expect(p.label).toBe('1 a 10 set');
  });

  it('intervalo que cruza meses e intervalo que termina hoje', () => {
    expect(periodFromParams({ de: '2026-08-28', ate: '2026-09-03' }, NOW).label).toBe('28 ago a 3 set');
    const ateHoje = periodFromParams({ de: '2026-09-20', ate: '2026-09-25' }, NOW);
    expect(ateHoje).toMatchObject({ end: NOW, running: true, fullEnd: D(9, 26), label: '20 a 25 set' });
  });

  it('ganha do atalho e do mês', () => {
    expect(periodFromParams({ de: '2026-09-01', ate: '2026-09-10', periodo: 'hoje', monthKey: '2026-07' }, NOW).kind).toBe('intervalo');
    expect(periodFromParams({ periodo: 'ontem', monthKey: '2026-07' }, NOW).kind).toBe('ontem');
  });

  it('intervalo recusado cai no mês atual, mesmo com atalho ou mês junto', () => {
    for (const [de, ate] of [
      ['2026-09-31', '2026-10-01'], ['2026-09-10', '2026-09-01'], ['2025-09-30', '2026-09-01'],
      ['2026-09-01', '2026-09-26'], ['2026-09-01', null], [null, '2026-09-10'], ['banana', '2026-09-10']
    ]) {
      const p = periodFromParams({ de, ate, periodo: 'hoje', monthKey: '2026-07' }, NOW);
      expect(p.kind, `${de} ${ate}`).toBe('mes');
      expect(p.monthKey, `${de} ${ate}`).toBe('2026-09');
    }
  });

  it('texto de trecho em outro ano', () => {
    const now = new Date(2027, 0, 10, 12);
    expect(periodFromParams({ de: '2026-12-28', ate: '2027-01-03' }, now).label).toBe('28 dez 2026 a 3 jan 2027');
    expect(periodFromParams({ de: '2026-11-02', ate: '2026-11-06' }, now).label).toBe('2 a 6 nov 2026');
    expect(rangeLabel(new Date(2026, 10, 2), new Date(2026, 10, 2), now)).toBe('2 nov 2026');
  });
});

describe('recusas do intervalo', () => {
  const HOJE = '2026-09-25';

  it('o mais antigo é o dia 1 do mês de 11 meses atrás', () => {
    expect(oldestDayKey(HOJE)).toBe('2025-10-01');
    expect(oldestDayKey('2026-01-15')).toBe('2025-02-01');
  });

  it('cada recusa com o motivo que o balão mostra', () => {
    expect(intervalRefusal('2026-09-01', null, HOJE)).toBe('Escolha as duas datas.');
    expect(intervalRefusal('', '2026-09-01', HOJE)).toBe('Escolha as duas datas.');
    expect(intervalRefusal('2026-02-30', '2026-03-01', HOJE)).toBe('Essa data não existe.');
    expect(intervalRefusal('banana', '2026-03-01', HOJE)).toBe('Essa data não existe.');
    expect(intervalRefusal('2026-09-10', '2026-09-01', HOJE)).toBe('A data final vem antes da inicial.');
    expect(intervalRefusal('2025-09-30', '2026-09-01', HOJE)).toBe('O período cabe nos últimos 12 meses: comece em 01/10/2025 ou depois.');
    expect(intervalRefusal('2026-09-01', '2026-09-26', HOJE)).toBe('A data final não pode passar de hoje.');
  });

  it('valem: o primeiro dia aceito, um dia só, até hoje', () => {
    expect(intervalRefusal('2025-10-01', '2026-09-25', HOJE)).toBeNull();
    expect(intervalRefusal('2026-09-25', '2026-09-25', HOJE)).toBeNull();
  });

  it('data que existe vira a meia-noite local; a que não existe, null', () => {
    expect(dateFromDayKey('2026-09-01')).toEqual(D(9, 1));
    expect(dateFromDayKey('2026-09-31')).toBeNull();
    expect(dateFromDayKey('2026-9-1')).toBeNull();
    expect(dateFromDayKey(null)).toBeNull();
  });
});

describe('período anterior', () => {
  it('hoje compara com ontem, da meia-noite até a mesma hora', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'hoje' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 24), fullEnd: D(9, 25), end: D(9, 24, 14, 30), running: false, label: '24 set' });
  });

  it('ontem compara com anteontem inteiro', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'ontem' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 23), fullEnd: D(9, 24), end: D(9, 24), label: '23 set' });
  });

  it('esta semana compara com a passada até o mesmo dia da semana e a mesma hora', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'semana' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 14), fullEnd: D(9, 21), end: D(9, 18, 14, 30), label: '14 a 18 set' });
  });

  it('semana passada compara com a anterior inteira', () => {
    const c = previousPeriod(periodFromParams({ periodo: 'semana-passada' }, NOW), NOW);
    expect(c).toMatchObject({ start: D(9, 7), fullEnd: D(9, 14), end: D(9, 14), label: '7 a 13 set' });
  });

  it('intervalo de N dias compara com os N dias logo antes, e corta no mesmo ponto quando inclui hoje', () => {
    const fechado = previousPeriod(periodFromParams({ de: '2026-09-01', ate: '2026-09-10' }, NOW), NOW);
    expect(fechado).toMatchObject({ start: D(8, 22), fullEnd: D(9, 1), end: D(9, 1), days: 10, label: '22 a 31 ago' });
    const aberto = previousPeriod(periodFromParams({ de: '2026-09-20', ate: '2026-09-25' }, NOW), NOW);
    expect(aberto).toMatchObject({ start: D(9, 14), fullEnd: D(9, 20), end: D(9, 19, 14, 30), label: '14 a 19 set' });
  });

  it('mês: o mês anterior, ou o escolhido, com o corte pró-rata no mês em andamento', () => {
    const atual = periodFromParams({ monthKey: '2026-09' }, NOW);
    expect(previousPeriod(atual, NOW)).toMatchObject({ kind: 'mes', monthKey: '2026-08', start: D(8, 1), fullEnd: D(9, 1), end: D(8, 25, 14, 30), label: 'Agosto 2026' });
    expect(previousPeriod(atual, NOW, { compareKey: '2026-06' })).toMatchObject({ monthKey: '2026-06', end: D(6, 25, 14, 30) });
    const fechado = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(previousPeriod(fechado, NOW)).toMatchObject({ monthKey: '2026-07', end: D(8, 1) });
  });
});

describe('meses da janela', () => {
  it('toca os meses do início ao último instante, e janela vazia fica no mês do início', () => {
    expect(monthsCovering(D(8, 28), D(9, 4))).toEqual(['2026-08', '2026-09']);
    expect(monthsCovering(D(9, 30), D(10, 1))).toEqual(['2026-09']);
    expect(monthsCovering(D(9, 1), D(9, 1))).toEqual(['2026-09']);
    expect(monthsCovering(new Date(2025, 10, 5), D(1, 10))).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('rótulo curto do dia, com o mês quando pedido', () => {
    expect(dayLabelOf('2026-10-03')).toBe('3');
    expect(dayLabelOf('2026-10-03', true)).toBe('3/10');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/period.test.js`
Expected: FAIL, com `Error: Cannot find module '../period.js'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/period.js`:

```js
// Período dos Relatórios e da Visão geral: o mês de competência de sempre, um
// atalho curto (Hoje, Ontem, Esta semana, Semana passada) ou um intervalo livre
// (de/até). Módulo puro, sem React e sem Firebase, testado em node. Datas
// locais, com meia-noite local, como no resto do app. Regra da spec
// docs/superpowers/specs/2026-09-25-periodo-personalizado-visao-geral-design.md;
// os Relatórios são os primeiros a usar (spec 2026-10-09).
//
// Um período é { kind, start, fullEnd, end, running, monthKey, label, days }:
// - start: o início, meia-noite local;
// - fullEnd: o fim nominal, exclusivo (fim do mês, do dia, da semana ou o dia
//   seguinte ao "até");
// - end: o fim efetivo, exclusivo. Agora, no período em andamento; o corte, no
//   período comparado; senão, o próprio fullEnd. É o papel que o effectiveEnd
//   tem no mês;
// - running: o período contém agora;
// - monthKey: só no modo mês;
// - label: o texto do botão;
// - days: os dias de calendário entre start e fullEnd.
// O intervalo leva também `de` e `ate`, como vieram do endereço.

import {
  addMonthsToKey, comparisonCut, dayKeyOf, effectiveEnd, isCurrentMonthKey, monthKeyOf, monthLabel, monthRange
} from './operacional/month.js';

// Os atalhos do endereço (`periodo`). O mês e o intervalo não entram: o mês é
// a ausência de período, e o intervalo vem por `de` e `ate`.
export const PERIOD_SHORTCUTS = Object.freeze(['hoje', 'ontem', 'semana', 'semana-passada']);

const PREFIX = Object.freeze({ hoje: 'Hoje', ontem: 'Ontem', semana: 'Esta semana', 'semana-passada': 'Semana passada' });
const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Segunda-feira da semana de `d`: a semana vai de segunda a domingo.
const mondayOf = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
// Dias de calendário de `a` até `b`, contados pela data e não pelos
// milissegundos, para o horário de verão não mudar a conta.
const daysBetween = (a, b) => Math.round(
  (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000
);
// Último dia que a janela [start, end) toca. Janela vazia fica no dia do início.
const lastDayOf = (start, end) => startOfDay(new Date(Math.max(start.getTime(), end.getTime() - 1)));

// 'AAAA-MM-DD' que existe no calendário vira a meia-noite local dele; o resto, null.
export function dateFromDayKey(key) {
  if (!DIA_RE.test(key || '')) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDate() === d ? date : null;
}

// Primeiro dia que o intervalo livre aceita: o dia 1 do mês de 11 meses atrás,
// a mesma janela de 12 meses da lista de meses.
export function oldestDayKey(todayKey) {
  return `${addMonthsToKey(todayKey.slice(0, 7), -11)}-01`;
}

const dayKeyText = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

// Motivo da recusa do intervalo, ou null quando ele vale. A regra é uma só: o
// endereço (screenParams) cai no mês atual quando há motivo, e o balão do
// Personalizado mostra o texto embaixo dos campos.
export function intervalRefusal(de, ate, todayKey) {
  if (!de || !ate) return 'Escolha as duas datas.';
  if (!dateFromDayKey(de) || !dateFromDayKey(ate)) return 'Essa data não existe.';
  if (ate < de) return 'A data final vem antes da inicial.';
  const oldest = oldestDayKey(todayKey);
  if (de < oldest) return `O período cabe nos últimos 12 meses: comece em ${dayKeyText(oldest)} ou depois.`;
  if (ate > todayKey) return 'A data final não pode passar de hoje.';
  return null;
}

const dayMonth = (d) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;

// Texto de um trecho de dias, com o último dia incluído: "25 set", "21 a 25
// set", "28 ago a 3 set". Com os dois lados em anos diferentes, os dois levam
// o ano; num trecho inteiro de outro ano que não o de agora, o ano vai no fim.
export function rangeLabel(first, last, now) {
  if (first.getFullYear() !== last.getFullYear()) {
    return `${dayMonth(first)} ${first.getFullYear()} a ${dayMonth(last)} ${last.getFullYear()}`;
  }
  const tail = last.getFullYear() !== now.getFullYear() ? ` ${last.getFullYear()}` : '';
  if (dayKeyOf(first) === dayKeyOf(last)) return `${dayMonth(first)}${tail}`;
  if (first.getMonth() === last.getMonth()) return `${first.getDate()} a ${dayMonth(last)}${tail}`;
  return `${dayMonth(first)} a ${dayMonth(last)}${tail}`;
}

// O mês de competência, igual ao que as telas sempre mostraram: fim efetivo em
// agora no mês em andamento e o texto com o " · em andamento".
export function monthPeriod(key, now) {
  const { start, end: fullEnd } = monthRange(key);
  const running = isCurrentMonthKey(key, now);
  return {
    kind: 'mes',
    start,
    fullEnd,
    end: effectiveEnd(key, now),
    running,
    monthKey: key,
    label: `${monthLabel(key)}${running ? ' · em andamento' : ''}`,
    days: daysBetween(start, fullEnd)
  };
}

function windowPeriod(kind, start, fullEnd, now, extra = {}) {
  const running = start <= now && now < fullEnd;
  const end = running ? now : fullEnd;
  const range = rangeLabel(start, lastDayOf(start, end), now);
  return {
    kind,
    start,
    fullEnd,
    end,
    running,
    monthKey: null,
    label: PREFIX[kind] ? `${PREFIX[kind]} · ${range}` : range,
    days: daysBetween(start, fullEnd),
    ...extra
  };
}

// O período escolhido. Precedência: `de`/`ate` antes de `periodo`, que vem
// antes de `monthKey`. Intervalo recusado cai no mês atual, sem aviso. Os
// atalhos são relativos: `hoje` aberto amanhã é o dia de amanhã.
export function periodFromParams({ periodo = null, de = null, ate = null, monthKey = null } = {}, now) {
  const today = startOfDay(now);
  if (de || ate) {
    if (intervalRefusal(de, ate, dayKeyOf(now)) !== null) return monthPeriod(monthKeyOf(now), now);
    return windowPeriod('intervalo', dateFromDayKey(de), addDays(dateFromDayKey(ate), 1), now, { de, ate });
  }
  if (periodo === 'hoje') return windowPeriod('hoje', today, addDays(today, 1), now);
  if (periodo === 'ontem') return windowPeriod('ontem', addDays(today, -1), today, now);
  if (periodo === 'semana') {
    const monday = mondayOf(now);
    return windowPeriod('semana', monday, addDays(monday, 7), now);
  }
  if (periodo === 'semana-passada') {
    const monday = addDays(mondayOf(now), -7);
    return windowPeriod('semana-passada', monday, addDays(monday, 7), now);
  }
  return monthPeriod(monthKey || monthKeyOf(now), now);
}

// O período de comparação. No modo mês, a regra de sempre: o mês escolhido
// (o anterior por padrão) com o corte pró-rata do mês em andamento. Fora dele,
// os mesmos dias logo antes, sem escolha; com o período em andamento, o
// comparado para no mesmo ponto (ontem até a mesma hora, a semana passada até
// o mesmo dia da semana e a mesma hora).
export function previousPeriod(period, now, { compareKey = null } = {}) {
  if (period.kind === 'mes') {
    const key = compareKey || addMonthsToKey(period.monthKey, -1);
    const { start, end: fullEnd } = monthRange(key);
    return {
      kind: 'mes',
      start,
      fullEnd,
      end: comparisonCut(period.monthKey, key, now),
      running: false,
      monthKey: key,
      label: monthLabel(key),
      days: daysBetween(start, fullEnd)
    };
  }
  const start = addDays(period.start, -period.days);
  const fullEnd = period.start;
  const elapsed = Math.max(0, now.getTime() - period.start.getTime());
  const end = period.running ? new Date(Math.min(start.getTime() + elapsed, fullEnd.getTime())) : fullEnd;
  return {
    kind: 'intervalo',
    start,
    fullEnd,
    end,
    running: false,
    monthKey: null,
    label: rangeLabel(start, lastDayOf(start, end), now),
    days: period.days
  };
}

// Chaves 'AAAA-MM' dos meses que a janela [start, end) toca, em ordem. Janela
// vazia toca o mês do início.
export function monthsCovering(start, end) {
  const last = monthKeyOf(new Date(Math.max(start.getTime(), end.getTime() - 1)));
  const keys = [];
  for (let k = monthKeyOf(start); k <= last; k = addMonthsToKey(k, 1)) keys.push(k);
  return keys;
}

// O período passa de um mês para outro.
export const crossesMonths = (period) =>
  monthKeyOf(period.start) !== monthKeyOf(new Date(period.fullEnd.getTime() - 1));

// Dia de uma chave 'AAAA-MM-DD' para rótulo curto: "3", ou "3/10" com o mês.
export function dayLabelOf(key, withMonth = false) {
  const day = String(Number(key.slice(8, 10)));
  return withMonth ? `${day}/${Number(key.slice(5, 7))}` : day;
}
```

- [ ] **Step 4: Rodar e ver passar, no fuso local e em UTC (o CI roda em UTC)**

Run:
```bash
npx vitest run src/lib/__tests__/period.test.js
TZ=UTC npx vitest run src/lib/__tests__/period.test.js
npx eslint src/lib/period.js src/lib/__tests__/period.test.js
```
Expected: `Tests 28 passed (28)` nas duas rodadas e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/period.js src/lib/__tests__/period.test.js
git commit -m "feat: módulo do período (period.js)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira depois desta task: `B_ARQ + 1` arquivos e `B_TESTES + 28` testes.

---

### Task 2: Planilha única (`csvExport.js`) e os dois exportar que já existem

**Files:**
- Create: `src/lib/csvExport.js`
- Test: `src/lib/__tests__/csvExport.test.js`
- Modify: `src/lib/appointmentReport.js` (import no topo; corpo do `rowsToCsv`)
- Modify: `src/lib/__tests__/appointmentReport.test.js` (bloco `rowsToCsv`)
- Modify: `src/modals/AppointmentExportModal.jsx` (import; `handleDownloadCsv`)
- Modify: `src/views/LeadsView.jsx` (import; `exportToCSV`)

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/csvExport.test.js`:

```js
// @vitest-environment jsdom
// Planilha única do app (src/lib/csvExport.js): separador, aspas só quando o
// valor pede, proteção contra fórmula e o download com o BOM. O ambiente é o
// jsdom por causa do download, que precisa de document e Blob.
import { describe, it, expect, vi } from 'vitest';
import { csvCell, toCsv, downloadCsv } from '../csvExport.js';

const columns = [{ key: 'a', label: 'Coluna A' }, { key: 'b', label: 'Coluna B' }];
const bytesOf = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new Uint8Array(reader.result));
  reader.readAsArrayBuffer(blob);
});

describe('planilha', () => {
  it('cabeçalho e linhas, com ; e a quebra de linha do Windows', () => {
    expect(toCsv([{ a: '1', b: '2' }, { a: '3', b: '4' }], columns)).toBe('Coluna A;Coluna B\r\n1;2\r\n3;4');
  });

  it('aspas só quando o valor pede', () => {
    expect(csvCell('Ana Lima')).toBe('Ana Lima');
    expect(csvCell('Nome; Sobrenome')).toBe('"Nome; Sobrenome"');
    expect(csvCell('Disse "oi"')).toBe('"Disse ""oi"""');
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('valor que começa com fórmula ganha um apóstrofo na frente', () => {
    expect(csvCell('=SOMA(A1:A9)')).toBe("'=SOMA(A1:A9)");
    expect(csvCell('+5511999990000')).toBe("'+5511999990000");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('=A;B')).toBe(`"'=A;B"`);
  });

  it('valor ausente vira vazio', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(toCsv([{ a: null }], columns)).toBe('Coluna A;Coluna B\r\n;');
  });

  it('o download leva o nome e o BOM, e solta o endereço do arquivo', async () => {
    const blobs = [];
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:planilha'; });
    URL.revokeObjectURL = vi.fn();
    const seen = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clickFake() {
      seen.push([this.download, this.getAttribute('href')]);
    });
    try {
      downloadCsv('leads-entrada.csv', 'Nome\r\nAna');
      expect(seen).toEqual([['leads-entrada.csv', 'blob:planilha']]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:planilha');
      expect(document.querySelector('a[download]')).toBeNull();
      const bytes = await bytesOf(blobs[0]);
      expect([...bytes.slice(0, 3)]).toEqual([0xEF, 0xBB, 0xBF]);
      expect(new TextDecoder().decode(bytes.slice(3))).toBe('Nome\r\nAna');
    } finally {
      click.mockRestore();
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
```

Em `src/lib/__tests__/appointmentReport.test.js`, dentro do `describe('rowsToCsv', ...)`, logo depois do teste `escapa valores com quebra de linha`, acrescente:

```js
  it('protege contra fórmula, como o exportar de Todos os leads', () => {
    const csv = rowsToCsv([{ a: '=HYPERLINK("http://x")', b: 'ok' }], columns);
    expect(csv).toBe(`Coluna A;Coluna B\r\n"'=HYPERLINK(""http://x"")";ok`);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/csvExport.test.js src/lib/__tests__/appointmentReport.test.js`
Expected: FAIL. O `csvExport.test.js` não acha `../csvExport.js`, e o teste novo do `rowsToCsv` falha porque hoje o valor sai sem o apóstrofo.

- [ ] **Step 3: Criar `src/lib/csvExport.js`**

```js
// Planilha das exportações: o CSV que o Excel pt-BR abre. Uma regra só para
// todo exportar do app (Relatórios, Todos os leads, Aulas e Visitas):
// separador ';', aspas só quando o valor pede, e a proteção contra fórmula. O
// valor que começa com =, +, -, @, tab ou retorno de carro ganha um apóstrofo
// na frente, senão o Excel e o Google Planilhas o executariam (CSV injection).
// O BOM UTF-8 vai no download, para o Excel ler os acentos. Puro, menos o
// downloadCsv, que precisa do navegador.

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[;"\r\n]/;

export function csvCell(value) {
  let s = String(value ?? '');
  if (FORMULA_START.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// `rows` são objetos; `columns` é [{ key, label }], na ordem da planilha.
export function toCsv(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(';');
  const lines = (rows || []).map((r) => columns.map((c) => csvCell(r?.[c.key])).join(';'));
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Ligar o CSV de Aulas e Visitas à função única**

Em `src/lib/appointmentReport.js`, acrescente o import depois de `import { contactLabel, contactOf } from './guardian.js';`:

```js
import { toCsv } from './csvExport.js';
```

E troque o comentário e o corpo do `rowsToCsv`, de:

```js
// rowsToCsv(rows, columns) — separador ';' (Excel pt-BR). O BOM UTF-8 fica a
// cargo de quem monta o Blob (mantém esta função testável como texto puro).
export function rowsToCsv(rows, columns) {
  const esc = (val) => {
    const s = String(val ?? '');
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(';');
  const lines = (rows || []).map((r) => columns.map((c) => esc(r[c.key])).join(';'));
  return [header, ...lines].join('\r\n');
}
```

para:

```js
// rowsToCsv(rows, columns): a planilha única do app (src/lib/csvExport.js),
// com separador ';' e a proteção contra fórmula. O BOM UTF-8 fica com o
// download (downloadCsv), e esta função continua testável como texto puro.
export function rowsToCsv(rows, columns) {
  return toCsv(rows, columns);
}
```

Em `src/modals/AppointmentExportModal.jsx`, acrescente o import depois da linha do `appointmentReport.js`:

```js
import { downloadCsv } from '../lib/csvExport.js';
```

E, no `handleDownloadCsv`, troque:

```js
      const csv = rowsToCsv(result.rows, columns);
      // BOM UTF-8 explícito — sem ele o Excel pt-BR pode abrir o CSV
      // com acentuação quebrada.
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isAula ? 'aulas' : 'visitas'}_${draftStart}_a_${draftEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
```

por:

```js
      const csv = rowsToCsv(result.rows, columns);
      downloadCsv(`${isAula ? 'aulas' : 'visitas'}_${draftStart}_a_${draftEnd}.csv`, csv);
```

- [ ] **Step 5: Ligar o exportar de Todos os leads à função única**

Em `src/views/LeadsView.jsx`, acrescente o import depois de `import { contactLabel, contactOf } from '../lib/guardian.js';`:

```js
import { downloadCsv, toCsv } from '../lib/csvExport.js';
```

Logo depois dos imports (antes da primeira declaração do arquivo), acrescente:

```js
// Colunas do exportar de Todos os leads, na ordem de sempre.
const LEADS_CSV_COLUMNS = [
  { key: 'nome', label: 'Nome' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'responsavel', label: 'Responsável do aluno' },
  { key: 'telefoneResponsavel', label: 'Telefone do responsável' },
  { key: 'origem', label: 'Origem' },
  { key: 'indicadoPor', label: 'Indicado por' },
  { key: 'fase', label: 'Fase do Funil' },
  { key: 'consultor', label: 'Consultor' },
  { key: 'cadastro', label: 'Data Cadastro' },
  { key: 'observacao', label: 'Observação' },
  { key: 'motivoPerda', label: 'Motivo Perda' },
];
```

Troque a função inteira, da linha `// EXPORTAÇÃO CSV — respeita os filtros aplicados.` até o `};` que vem antes de `// Chips de filtros ativos (removem individualmente).`, por:

```js
  // EXPORTAÇÃO CSV: respeita os filtros aplicados. A planilha sai pela função
  // única do app (src/lib/csvExport.js), com a proteção contra fórmula.
  const exportToCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.warning('Não há leads para exportar com os filtros atuais.');
      return;
    }
    const rows = filteredLeads.map((l) => {
      const contato = contactOf(l);
      return {
        nome: l.name,
        whatsapp: l.whatsapp,
        responsavel: contato.viaGuardian ? contactLabel(contato) : '',
        telefoneResponsavel: contato.viaGuardian ? contato.phone : '',
        origem: l.source,
        indicadoPor: l.referredByName,
        fase: l.status,
        consultor: l.consultantName,
        cadastro: l.createdAt ? l.createdAt.toLocaleDateString('pt-BR') : '',
        observacao: l.observation,
        motivoPerda: l.lossReason,
      };
    });
    downloadCsv(`leads_stronix_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, LEADS_CSV_COLUMNS));
  };
```

- [ ] **Step 6: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/csvExport.test.js src/lib/__tests__/appointmentReport.test.js src/lib/__tests__/filtroResponsavelParaTodos.test.js
npx eslint src/lib/csvExport.js src/lib/appointmentReport.js src/modals/AppointmentExportModal.jsx src/views/LeadsView.jsx src/lib/__tests__/csvExport.test.js src/lib/__tests__/appointmentReport.test.js
```
Expected: os três arquivos passando (5 testes novos no `csvExport.test.js`, 1 novo no `appointmentReport.test.js`) e o lint sem saída. O `filtroResponsavelParaTodos.test.js` renderiza Todos os leads e o modal de Aulas e Visitas, e precisa continuar verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/csvExport.js src/lib/__tests__/csvExport.test.js src/lib/appointmentReport.js src/lib/__tests__/appointmentReport.test.js src/modals/AppointmentExportModal.jsx src/views/LeadsView.jsx
git commit -m "feat: planilha única do exportar, com proteção contra fórmula em Aulas e Visitas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 2` arquivos e `B_TESTES + 34` testes.

---

### Task 3: Ação de exportar os Relatórios

**Files:**
- Modify: `src/lib/acesso.js` (objeto `ACTIONS`)
- Modify: `src/lib/__tests__/acesso.test.js` (teste `os nomes das ações não mudam`)

- [ ] **Step 1: Atualizar o teste**

Em `src/lib/__tests__/acesso.test.js`, no teste `os nomes das ações não mudam`, troque:

```js
      SUPORTE_ABRIR: 'suporte.abrir',
    });
```

por:

```js
      SUPORTE_ABRIR: 'suporte.abrir',
      RELATORIOS_EXPORTAR: 'relatorios.exportar',
    });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/acesso.test.js`
Expected: FAIL no teste `os nomes das ações não mudam`.

- [ ] **Step 3: Implementar**

Em `src/lib/acesso.js`, troque:

```js
  SUPORTE_ABRIR: 'suporte.abrir',
});
```

por:

```js
  SUPORTE_ABRIR: 'suporte.abrir',
  // Exportar a lista dos Relatórios (decisão 2 de 28/09/2026: todos exportam).
  RELATORIOS_EXPORTAR: 'relatorios.exportar',
});
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/acesso.test.js src/lib/__tests__/acessoActionsRef.test.js
npx eslint src/lib/acesso.js src/lib/__tests__/acesso.test.js
```
Expected: os dois arquivos passando e o lint sem saída. Gestor e consultor ganham a ação sozinhos (`TODAS`), e o professor continua sem nenhuma.

- [ ] **Step 5: Commit**

```bash
git add src/lib/acesso.js src/lib/__tests__/acesso.test.js
git commit -m "feat: ação de exportar os Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 2` arquivos e `B_TESTES + 34` testes.

---

### Task 4: A tela no endereço e no menu

**Files:**
- Modify: `src/lib/routes.js` (constantes de sub-tela; `SCREENS`)
- Modify: `src/lib/tenantSlug.js` (`RESERVED_TENANT_SLUGS`)
- Modify: `src/lib/sidebarNav.js` (`sidebarNav`)
- Modify: `src/lib/__tests__/routes.test.js` (lista `TELAS`; bloco `sub-tela no caminho`)
- Modify: `src/lib/__tests__/sidebarNav.test.js` (tabelas do topo)

- [ ] **Step 1: Atualizar os testes**

Em `src/lib/__tests__/routes.test.js`, troque:

```js
  'leads', 'aulas', 'visitas', 'settings', 'profile', 'billing', 'superadmin', 'ficha', 'rotinas',
];
```

por:

```js
  'leads', 'aulas', 'visitas', 'settings', 'profile', 'billing', 'superadmin', 'ficha', 'rotinas', 'relatorios',
];
```

No mesmo arquivo, dentro do `describe('sub-tela no caminho', ...)`, logo depois do teste `a ficha lê as quatro abas`, acrescente:

```js
  it('Relatórios lê os submenus, abre sem submenu e marca o desconhecido', () => {
    for (const [seg, id] of [['entrada', 'entrada'], ['conversao', 'conversao']]) {
      const r = parseAppPath(`/${T}/relatorios/${seg}`);
      expect([r.screen, r.sub, r.subUnknown], seg).toEqual(['relatorios', id, false]);
    }
    expect(parseAppPath(`/${T}/relatorios`)).toMatchObject({ screen: 'relatorios', sub: null, subUnknown: false });
    expect(parseAppPath(`/${T}/relatorios/perdas`)).toMatchObject({ screen: 'relatorios', subUnknown: true });
    expect(hrefFor(T, 'relatorios', { sub: 'conversao' })).toBe(`/${T}/relatorios/conversao`);
    expect(SCREENS.relatorios).toMatchObject({ title: 'Relatórios', subPadrao: 'entrada' });
    expect(SCREENS.relatorios.gestor).toBeUndefined();
  });
```

Em `src/lib/__tests__/sidebarNav.test.js`, troque:

```js
const DO_GESTOR = { overview: true, kanban: true, clientes: true, dailyGoal: true, rotinas: true, leads: true, suporte: true };
const DO_CONSULTOR = { ...DO_GESTOR, rotinas: false };
const DO_PROFESSOR = { overview: false, kanban: false, clientes: true, dailyGoal: true, rotinas: false, leads: false, suporte: false };
```

por:

```js
const DO_GESTOR = { overview: true, kanban: true, clientes: true, dailyGoal: true, rotinas: true, leads: true, relatorios: true, suporte: true };
const DO_CONSULTOR = { ...DO_GESTOR, rotinas: false };
const DO_PROFESSOR = { overview: false, kanban: false, clientes: true, dailyGoal: true, rotinas: false, leads: false, relatorios: false, suporte: false };
```

E troque:

```js
  leads: ['leads', 'aulas', 'visitas'],
};
```

por:

```js
  leads: ['leads', 'aulas', 'visitas'],
  relatorios: ['relatorios'],
};
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/sidebarNav.test.js`
Expected: FAIL. A lista de telas não tem `relatorios`, o teste novo não acha a tela e o `sidebarNav` não devolve o item.

- [ ] **Step 3: Implementar**

Em `src/lib/routes.js`, logo depois do bloco de `ROTINAS_TABS` (depois do `});` que o fecha), acrescente:

```js
// Submenus dos Relatórios (spec 2026-10-09). Hoje só o relatório de Leads, com
// Entrada de leads e Conversão. O PR 2 acrescenta visitas-e-aulas, perdas e
// parados. O id é também o segmento, e a lista ao lado
// (src/lib/relatoriosRail.js) usa os mesmos ids.
export const RELATORIOS_SUBS = Object.freeze({
  entrada: 'entrada',
  conversao: 'conversao',
});
```

E, em `SCREENS`, troque:

```js
  visitas: tela(['leads', 'visitas'], 'Visitas'),
```

por:

```js
  visitas: tela(['leads', 'visitas'], 'Visitas'),
  relatorios: tela(['relatorios'], 'Relatórios', { subs: RELATORIOS_SUBS, subPadrao: 'entrada' }),
```

Em `src/lib/tenantSlug.js`, troque:

```js
  'visao-geral', 'pipeline', 'clientes', 'meta-diaria', 'rotinas', 'leads', 'configuracoes', 'perfil-da-academia', 'plano-e-faturas', 'ficha', 'super-admin',
```

por:

```js
  'visao-geral', 'pipeline', 'clientes', 'meta-diaria', 'rotinas', 'leads', 'relatorios', 'configuracoes', 'perfil-da-academia', 'plano-e-faturas', 'ficha', 'super-admin',
```

Em `src/lib/sidebarNav.js`, troque:

```js
    leads: tela('leads') && tela('aulas') && tela('visitas'),
```

por:

```js
    leads: tela('leads') && tela('aulas') && tela('visitas'),
    relatorios: tela('relatorios'),
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/sidebarNav.test.js src/lib/__tests__/tenantSlug.test.js src/lib/__tests__/acesso.test.js
npx eslint src/lib/routes.js src/lib/tenantSlug.js src/lib/sidebarNav.js src/lib/__tests__/routes.test.js src/lib/__tests__/sidebarNav.test.js
```
Expected: os quatro arquivos passando e o lint sem saída. O `tenantSlug.test.js` confere que toda tela de primeiro nível está reservada, e o `acesso.test.js` confere que o professor continua abrindo só Meta diária, Clientes e a ficha.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routes.js src/lib/tenantSlug.js src/lib/sidebarNav.js src/lib/__tests__/routes.test.js src/lib/__tests__/sidebarNav.test.js
git commit -m "feat: tela de Relatórios no endereço e no menu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 2` arquivos e `B_TESTES + 35` testes.

---

### Task 5: A lista ao lado (`relatoriosRail.js`)

**Files:**
- Create: `src/lib/relatoriosRail.js`
- Test: `src/lib/__tests__/relatoriosRail.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosRail.test.js`:

```js
// Lista ao lado dos Relatórios: o contrato com a tabela de endereços, como o
// settingsRail.test.js faz com as Configurações.
import { describe, it, expect } from 'vitest';
import {
  RELATORIOS_RAIL_GROUPS, RELATORIOS_RAIL_IDS, RELATORIOS_DEFAULT_SECTION, relatoriosSection, relatoriosItem,
} from '../relatoriosRail.js';
import { RELATORIOS_SUBS } from '../routes.js';

describe('lista ao lado dos Relatórios', () => {
  it('cada item é um submenu do endereço, e todo submenu do endereço está na lista', () => {
    expect([...RELATORIOS_RAIL_IDS].sort()).toEqual(Object.keys(RELATORIOS_SUBS).sort());
  });

  it('um grupo, Leads, com Entrada de leads e Conversão, nessa ordem e com a pergunta de cada um', () => {
    expect(RELATORIOS_RAIL_GROUPS.map((g) => g.label)).toEqual(['Leads']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.label)).toEqual(['Entrada de leads', 'Conversão']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.hint)).toEqual(['Quantos chegaram e de onde', 'Quantos viraram matrícula']);
  });

  it('o padrão é a Entrada, e submenu desconhecido cai nele', () => {
    expect(RELATORIOS_DEFAULT_SECTION).toBe('entrada');
    expect(relatoriosSection('conversao')).toBe('conversao');
    expect(relatoriosSection(null)).toBe('entrada');
    expect(relatoriosSection('perdas')).toBe('entrada');
  });

  it('acha o item pelo id, e nada muda em tempo de execução', () => {
    expect(relatoriosItem('conversao')).toMatchObject({ label: 'Conversão' });
    expect(relatoriosItem('xyz')).toBeNull();
    expect(Object.isFrozen(RELATORIOS_RAIL_GROUPS)).toBe(true);
    expect(Object.isFrozen(RELATORIOS_RAIL_GROUPS[0].items)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosRail.test.js`
Expected: FAIL, com `Cannot find module '../relatoriosRail.js'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatoriosRail.js`:

```js
// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado"): os grupos
// e os submenus, na ordem da tela, com a pergunta de cada um embaixo do nome,
// para o gestor achar o relatório sem abrir um por um. Puro (sem React): o id
// de cada item é a chave dele em RELATORIOS_SUBS (src/lib/routes.js), e o
// relatoriosRail.test.js cobra isso. Quando vierem os relatórios de clientes e
// de vendas, eles entram aqui como grupos novos.

import { SCREENS } from './routes.js';

export const RELATORIOS_RAIL_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Leads',
    items: Object.freeze([
      Object.freeze({ id: 'entrada', label: 'Entrada de leads', hint: 'Quantos chegaram e de onde' }),
      Object.freeze({ id: 'conversao', label: 'Conversão', hint: 'Quantos viraram matrícula' }),
    ]),
  }),
]);

export const RELATORIOS_RAIL_IDS = Object.freeze(
  RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
);

// O submenu de quem abre /relatorios sem submenu sai da tabela de endereços,
// para não existirem duas verdades.
export const RELATORIOS_DEFAULT_SECTION = SCREENS.relatorios.subPadrao;

// Submenu que a tela desenha: o do endereço, ou o padrão.
export const relatoriosSection = (sub) => (RELATORIOS_RAIL_IDS.includes(sub) ? sub : RELATORIOS_DEFAULT_SECTION);

export const relatoriosItem = (id) =>
  RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items).find((i) => i.id === id) || null;
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosRail.test.js
npx eslint src/lib/relatoriosRail.js src/lib/__tests__/relatoriosRail.test.js
```
Expected: `Tests 4 passed (4)` e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatoriosRail.js src/lib/__tests__/relatoriosRail.test.js
git commit -m "feat: lista ao lado dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 3` arquivos e `B_TESTES + 39` testes.

---

### Task 6: Período, origem e recorte no endereço dos Relatórios

**Files:**
- Modify: `src/lib/screenParams.js` (import no topo; bloco novo antes de `// Tabela por tela.`; tabela; `AJUSTES`)
- Modify: `src/lib/__tests__/screenParams.test.js` (bloco novo no fim)
- Modify: `src/lib/__tests__/filtrosNoEndereco.sweep.test.js` (lista `alvos`)

- [ ] **Step 1: Escrever os testes que falham**

No fim de `src/lib/__tests__/screenParams.test.js`, acrescente:

```js
describe('Relatórios', () => {
  // 25/09/2026: o intervalo aceita de 01/10/2025 até hoje.
  const origens = ['Instagram', 'Indicação'];
  const rel = { currentKey: HOJE, todayKey: '2026-09-25', users, podeResp: true, respPadrao: [], funis, origens };

  it('os nomes, na ordem do endereço', () => {
    expect(SCREEN_PARAM_NAMES.relatorios).toEqual(['mes', 'periodo', 'de', 'ate', 'resp', 'origem', 'funil', 'recorte']);
  });

  it('endereço limpo é o mês atual, a equipe toda, todas as origens e todos os funis, e nada é escrito', () => {
    const v = ler('relatorios', '', rel);
    expect(v).toEqual({ monthKey: HOJE, periodo: null, de: null, ate: null, resp: [], origem: null, funnel: 'all', recorte: null });
    expect(montar('relatorios', v, rel)).toBe('');
  });

  it('atalho vale e apaga o mês; de e até ganham do atalho', () => {
    expect(ler('relatorios', '?mes=2026-07&periodo=semana', rel)).toMatchObject({ periodo: 'semana', monthKey: HOJE });
    expect(ler('relatorios', '?periodo=hoje&de=2026-09-01&ate=2026-09-10', rel))
      .toMatchObject({ periodo: null, de: '2026-09-01', ate: '2026-09-10', monthKey: HOJE });
    expect(volta('relatorios', '?mes=2026-07&periodo=semana', rel)).toBe('?periodo=semana');
  });

  it('intervalo recusado cai no mês atual, sem aviso', () => {
    for (const q of ['?de=2026-09-10&ate=2026-09-01', '?de=2025-09-30&ate=2026-09-01', '?de=2026-09-01&ate=2026-09-26', '?de=2026-09-01']) {
      expect(ler('relatorios', q, rel), q).toMatchObject({ periodo: null, de: null, ate: null, monthKey: HOJE });
      expect(volta('relatorios', q, rel), q).toBe('');
    }
  });

  it('o mês do modo mês vale nos últimos 12 meses', () => {
    expect(volta('relatorios', '?mes=2026-07', rel)).toBe('?mes=2026-07');
    expect(ler('relatorios', '?mes=2025-07', rel).monthKey).toBe(HOJE);
  });

  it('consultores, origem e funil do catálogo; o que sumiu cai no padrão', () => {
    expect(ler('relatorios', '?resp=u1,u9&origem=Instagram&funil=f1', rel)).toMatchObject({ resp: ['u1'], origem: 'Instagram', funnel: 'f1' });
    expect(ler('relatorios', '?origem=Outdoor&funil=f9', rel)).toMatchObject({ origem: null, funnel: 'all' });
    expect(volta('relatorios', '?resp=u2&origem=Indica%C3%A7%C3%A3o&funil=f1', rel)).toBe('?resp=u2&origem=Indica%C3%A7%C3%A3o&funil=f1');
  });

  it('o recorte da lista no formato tipo:valor', () => {
    expect(ler('relatorios', '?recorte=situacao:matricularam', rel).recorte).toBe('situacao:matricularam');
    expect(volta('relatorios', '?recorte=origem:Instagram', rel)).toBe('?recorte=origem%3AInstagram');
    for (const q of ['?recorte=', '?recorte=matricularam', '?recorte=Situacao:x', `?recorte=origem:${'x'.repeat(81)}`]) {
      expect(ler('relatorios', q, rel).recorte, q).toBeNull();
    }
  });
});
```

Em `src/lib/__tests__/filtrosNoEndereco.sweep.test.js`, no teste `nenhum parâmetro entra numa key de componente`, troque:

```js
      'funnel', 'person', 'sub',
    ];
```

por:

```js
      'funnel', 'person', 'sub',
      // Os filtros dos Relatórios: o período (nome da query e da variável da
      // tela), a origem e o recorte da lista.
      'periodo', 'period', 'origem', 'recorte',
    ];
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: FAIL nos 7 testes do bloco `Relatórios` (a tabela não tem a tela, e a leitura devolve `{}`). A varredura passa.

- [ ] **Step 3: Implementar em `src/lib/screenParams.js`**

Troque o import:

```js
import { addMonthsToKey, compareOptions } from './operacional/month.js';
```

por:

```js
import { addMonthsToKey, compareOptions } from './operacional/month.js';
import { PERIOD_SHORTCUTS, intervalRefusal } from './period.js';
```

Logo antes da linha `// Tabela por tela. A ordem aqui é a ordem no endereço.`, acrescente:

```js
// Período (src/lib/period.js), por enquanto só nos Relatórios. A Visão geral
// passa a usar o mesmo quando o período personalizado dela for feito (spec
// 2026-09-25). `periodo` é um dos quatro atalhos; `de` e `ate` são o
// Personalizado e andam juntos. Precedência: `de`/`ate`, depois `periodo`,
// depois `mes`. Com período, o `mes` não vale, nem na leitura nem na escrita.
// O intervalo passa pela mesma recusa do balão (intervalRefusal), que precisa
// do dia de hoje: a tela manda `todayKey` no ctx. Sem ele, intervalo nenhum vale.
const intervaloValido = (ja, ctx) =>
  Boolean(ctx.todayKey) && intervalRefusal(ja?.de, ja?.ate, ctx.todayKey) === null;
const foraDoModoMes = (ja, ctx) => PERIOD_SHORTCUTS.includes(ja?.periodo) || intervaloValido(ja, ctx);

const periodoDoPainel = param(
  'periodo',
  (raw) => (PERIOD_SHORTCUTS.includes(raw) ? raw : null),
  (v, ctx, ja) => (PERIOD_SHORTCUTS.includes(v) && !intervaloValido(ja, ctx) ? v : null),
);

// A leitura guarda o valor cru, inclusive o torto: quem decide é o ajuste,
// que precisa saber que o intervalo foi pedido para cair no mês atual.
const dataDoPainel = (campo) => param(
  campo,
  (raw) => raw,
  (v, ctx, ja) => (intervaloValido(ja, ctx) ? v : null),
);

// Mesmo parâmetro, que só é escrito no modo mês.
const soNoModoMes = (p) => param(
  p.campo,
  p.ler,
  (v, ctx, ja) => (foraDoModoMes(ja, ctx) ? null : p.escrever(v, ctx, ja)),
);

// Regra que cruza os parâmetros do período. Intervalo pedido e recusado (data
// que não existe, fim antes do início, antes da janela de 12 meses, depois de
// hoje, metade do par) cai no mês atual, sem aviso, como o mês inválido. Com
// período que vale, o mês fica o atual e, na tela que tem mês de comparação,
// ele some.
function ajustaPeriodoDoPainel(valores, ctx) {
  const semComparado = 'compareKey' in valores ? { compareKey: null } : {};
  if (valores.de !== null || valores.ate !== null) {
    const vale = intervaloValido(valores, ctx);
    return {
      ...valores,
      periodo: null,
      de: vale ? valores.de : null,
      ate: vale ? valores.ate : null,
      monthKey: ctx.currentKey,
      ...semComparado,
    };
  }
  if (valores.periodo) return { ...valores, monthKey: ctx.currentKey, ...semComparado };
  return valores;
}

// Origem dos Relatórios: o nome de uma origem do catálogo (o lead guarda o
// nome), ou todas. Origem que saiu do catálogo cai em todas.
const origem = param(
  'origem',
  (raw, ctx) => ((ctx.origens || []).includes(raw) ? raw : null),
  (v, ctx) => ((ctx.origens || []).includes(v) ? v : null),
);

// Filtro da lista dos Relatórios, no formato "tipo:valor"
// (situacao:matricularam, origem:Instagram, consultor:<id>). Aqui só se confere
// o formato; se o valor existe no submenu aberto, quem confere é a conta do
// submenu, que ignora o que não acha. Nunca leva nome, telefone ou CPF de
// lead: os tipos são fixos e os valores são códigos, ids e nomes de catálogo.
const RECORTE_RE = /^[a-z-]+:[^\n]{1,80}$/;
const recorte = param(
  'recorte',
  (raw) => (RECORTE_RE.test(raw || '') ? raw : null),
  (v) => (RECORTE_RE.test(v || '') ? v : null),
);
```

Na tabela, troque:

```js
  dailyGoal: { cat },
};
```

por:

```js
  dailyGoal: { cat },
  relatorios: {
    mes: soNoModoMes(mes),
    periodo: periodoDoPainel,
    de: dataDoPainel('de'),
    ate: dataDoPainel('ate'),
    resp,
    origem,
    funil: funilRecorte,
    recorte,
  },
};
```

E troque:

```js
const AJUSTES = Object.freeze({ aulas: ajustaPeriodo, visitas: ajustaPeriodo });
```

por:

```js
const AJUSTES = Object.freeze({ aulas: ajustaPeriodo, visitas: ajustaPeriodo, relatorios: ajustaPeriodoDoPainel });
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js
npx eslint src/lib/screenParams.js src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js
```
Expected: os dois arquivos passando (7 testes novos) e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/screenParams.js src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js
git commit -m "feat: período, origem e recorte no endereço dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 3` arquivos e `B_TESTES + 46` testes.

---

### Task 7: Lista de pessoas no recorte do painel CRM

**Files:**
- Modify: `src/lib/crm/scope.js` (`makeScope`)
- Modify: `src/lib/__tests__/crm.scope.test.js` (bloco `makeScope`)

- [ ] **Step 1: Escrever o teste que falha**

Em `src/lib/__tests__/crm.scope.test.js`, dentro do `describe('makeScope', ...)`, depois do teste `lead desconhecido só entra na equipe toda e em Todos os funis, e conta em Outros`, acrescente:

```js
  it('lista de pessoas: o dono do lead é uma delas; lista vazia é a equipe toda', () => {
    const duas = makeScope({ users: USERS, funnels: FUNNELS, userIds: ['ana', 'diego'] });
    const so = makeScope({ users: USERS, funnels: FUNNELS, userIds: ['ana'] });
    const vazia = makeScope({ users: USERS, funnels: FUNNELS, userIds: [] });
    expect(duas.inScope(lead())).toBe(true);
    expect(duas.inScope(lead({ consultantId: 'diego' }))).toBe(true);
    expect(duas.inScope(lead({ consultantId: 'ex' }))).toBe(false);
    expect(so.inScope(lead({ consultantId: 'diego' }))).toBe(false);
    expect(so.inScope({ id: 'z', unknown: true })).toBe(false);
    expect(vazia.inScope(lead({ consultantId: 'ex' }))).toBe(true);
    expect(vazia.inScope({ id: 'z', unknown: true })).toBe(true);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.scope.test.js`
Expected: FAIL no teste novo: sem `userIds`, `duas.inScope(lead({ consultantId: 'ex' }))` dá `true`.

- [ ] **Step 3: Implementar**

Em `src/lib/crm/scope.js`, troque:

```js
// Pessoa = dono do lead hoje (consultantId). OTHERS_ID junta quem não está na
// equipe. Funil = o do lead, com o lead sem funil caindo no padrão; sem funil
// escolhido, todo lead que não está num funil de cliente. Lead desconhecido
// (apagado, ou busca por id que falhou) só entra na equipe toda e em Todos os
// funis, e na pessoa conta como Outros.
export function makeScope({ users, funnels, userId = null, funnelId = null }) {
  const team = new Set((users || []).map((u) => u.id));
  const clientIds = new Set((funnels || []).filter(isClientFunnel).map((f) => f.id));
  const defaultFunnelId = getDefaultFunnel(funnels)?.id || null;
  const ownerOk = (lead) => {
    if (!userId) return true;
```

por:

```js
// Pessoa = dono do lead hoje (consultantId). OTHERS_ID junta quem não está na
// equipe. Funil = o do lead, com o lead sem funil caindo no padrão; sem funil
// escolhido, todo lead que não está num funil de cliente. Lead desconhecido
// (apagado, ou busca por id que falhou) só entra na equipe toda e em Todos os
// funis, e na pessoa conta como Outros. `userIds` é o filtro de várias pessoas
// dos Relatórios: com ids, o dono do lead precisa ser um deles; vazio é a
// equipe toda. Com uma pessoa só, dá o mesmo que `userId`.
export function makeScope({ users, funnels, userId = null, userIds = null, funnelId = null }) {
  const team = new Set((users || []).map((u) => u.id));
  const clientIds = new Set((funnels || []).filter(isClientFunnel).map((f) => f.id));
  const defaultFunnelId = getDefaultFunnel(funnels)?.id || null;
  const ids = Array.isArray(userIds) && userIds.length ? new Set(userIds) : null;
  const ownerOk = (lead) => {
    if (ids) return Boolean(lead) && !lead.unknown && ids.has(lead.consultantId);
    if (!userId) return true;
```

O resto da função fica como está.

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/crm.scope.test.js src/lib/__tests__/crm.metrics.test.js
npx eslint src/lib/crm/scope.js src/lib/__tests__/crm.scope.test.js
```
Expected: os dois arquivos passando (1 teste novo) e o lint sem saída. O `crm.metrics.test.js` confere que o painel não mudou.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/scope.js src/lib/__tests__/crm.scope.test.js
git commit -m "feat: recorte do CRM aceita uma lista de pessoas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 3` arquivos e `B_TESTES + 47` testes.

---

### Task 8: Marcos e primeiro contato de um lead, pelas regras do painel

**Files:**
- Modify: `src/lib/crm/appointments.js` (`cohortMilestones`)
- Modify: `src/lib/crm/contact.js` (`firstContactOf`)
- Modify: `src/lib/__tests__/crm.appointments.test.js` (import; bloco novo no fim)
- Modify: `src/lib/__tests__/crm.contact.test.js` (import; bloco novo no fim)

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/crm.appointments.test.js`, troque o import:

```js
import {
  appointmentsOf, recordsByLeadOf, cohortMilestones, professorsOf, visitOutcomesByLead, effectiveStatus
} from '../crm/appointments.js';
```

por:

```js
import {
  appointmentsOf, recordsByLeadOf, cohortMilestones, cohortMilestoneOf, professorsOf, visitOutcomesByLead, effectiveStatus
} from '../crm/appointments.js';
```

E acrescente no fim do arquivo:

```js
describe('marcos de um lead da safra', () => {
  const asOf = D(9, 20);

  it('agendou e veio, pela mesma regra da contagem', () => {
    const recordsByLead = recordsByLeadOf([R('m1', { status: 'attended', scheduledFor: D(9, 5), createdAt: D(9, 2) })]);
    expect(cohortMilestoneOf(lead('a'), { asOf, cut: false, recordsByLead })).toEqual({ booked: true, attended: true });
    expect(cohortMilestones([lead('a')], { asOf, cut: false, recordsByLead })).toEqual({ sched: 1, came: 1 });
  });

  it('só agendou, ou nem agendou', () => {
    const agendado = recordsByLeadOf([R('m2', { scheduledFor: D(9, 25), createdAt: D(9, 3) })]);
    expect(cohortMilestoneOf(lead('a'), { asOf, cut: false, recordsByLead: agendado })).toEqual({ booked: true, attended: false });
    expect(cohortMilestoneOf(lead('b'), { asOf, cut: false, recordsByLead: agendado })).toEqual({ booked: false, attended: false });
  });
});
```

Em `src/lib/__tests__/crm.contact.test.js`, troque o import:

```js
import { isContactInteraction, contactTimesByLead, firstContactOf } from '../crm/contact.js';
```

por:

```js
import { isContactInteraction, contactTimesByLead, firstContactOf, firstContactMinutesOf } from '../crm/contact.js';
```

E acrescente no fim do arquivo:

```js
describe('minutos até o primeiro contato de um lead', () => {
  it('a mesma regra das faixas, lead por lead', () => {
    const contactTimes = contactTimesByLead([{ id: 'c1', leadId: 'a', type: 'note', text: 'oi', createdAt: T(1, 10, 30) }]);
    const limit = T(15).getTime();
    expect(firstContactMinutesOf({ id: 'a', createdAt: T(1, 10) }, { contactTimes, limit })).toBe(30);
    expect(firstContactMinutesOf({ id: 'b', createdAt: T(1, 10) }, { contactTimes, limit })).toBeNull();
    expect(firstContactMinutesOf({ id: 'a', createdAt: null }, { contactTimes, limit })).toBeNull();
    expect(firstContactMinutesOf({ id: 'a', createdAt: T(1, 10) }, { contactTimes, limit: T(1, 10, 15).getTime() })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.appointments.test.js src/lib/__tests__/crm.contact.test.js`
Expected: FAIL nos três testes novos (`cohortMilestoneOf is not a function` e `firstContactMinutesOf is not a function`).

- [ ] **Step 3: Implementar em `src/lib/crm/appointments.js`**

Troque a função `cohortMilestones` inteira, de `export function cohortMilestones(cohort, { asOf, cut, recordsByLead, visitOutcomes = null }) {` até o `}` que a fecha, por:

```js
export function cohortMilestones(cohort, opts) {
  let sched = 0;
  let came = 0;
  (cohort || []).forEach((l) => {
    const m = cohortMilestoneOf(l, opts);
    if (m.booked) sched += 1;
    if (m.attended) came += 1;
  });
  return { sched, came };
}

// Marcos de um lead da safra no instante asOf, na regra do cohortMilestones
// (comentário acima): agendou e compareceu. Os Relatórios mostram os dois lead
// por lead, e a contagem do painel soma o que esta função devolve.
export function cohortMilestoneOf(l, { asOf, cut, recordsByLead, visitOutcomes = null }) {
  const enrolledAt = firstEnrolledAtOf(l);
  const recs = (recordsByLead.get(l.id) || [])
    .filter((r) => !(enrolledAt && bookedAt(r) && bookedAt(r) >= enrolledAt))
    .map((r) => ({ r, status: effectiveStatus(r, visitOutcomes, l) }));
  const attended = recs.some(({ r, status }) => status === AULA_STATUS.ATTENDED && r.scheduledFor
    && r.scheduledFor <= asOf && !(enrolledAt && r.scheduledFor >= enrolledAt));
  const booked = attended
    || recs.some(({ r, status }) => status !== AULA_STATUS.CANCELLED && bookedAt(r) && bookedAt(r) <= asOf)
    || (!cut && hasOpenAppointment(l));
  return { booked, attended };
}
```

O comentário que fica em cima de `cohortMilestones` não muda.

- [ ] **Step 4: Implementar em `src/lib/crm/contact.js`**

Troque:

```js
export function firstContactOf(cohort, { contactTimes, limit }) {
  const list = cohort || [];
  const values = list.map((l) => {
    if (!(l.createdAt instanceof Date)) return null;
    const from = l.createdAt.getTime();
    const t = (contactTimes.get(l.id) || []).find((x) => x >= from && x < limit);
    return t == null ? null : (t - from) / 60000;
  });
```

por:

```js
export function firstContactOf(cohort, { contactTimes, limit }) {
  const list = cohort || [];
  const values = list.map((l) => firstContactMinutesOf(l, { contactTimes, limit }));
```

E acrescente no fim do arquivo:

```js
// Minutos corridos do cadastro ao primeiro contato de um lead, só com
// interação em [cadastro, limit). Sem interação no prazo, ou sem data de
// cadastro: null. É a regra de cada lead do firstContactOf, que os Relatórios
// mostram lead por lead.
export function firstContactMinutesOf(l, { contactTimes, limit }) {
  if (!(l?.createdAt instanceof Date)) return null;
  const from = l.createdAt.getTime();
  const t = (contactTimes.get(l.id) || []).find((x) => x >= from && x < limit);
  return t == null ? null : (t - from) / 60000;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/crm.appointments.test.js src/lib/__tests__/crm.contact.test.js src/lib/__tests__/crm.metrics.test.js src/lib/__tests__/crm.dashboard.test.js
npx eslint src/lib/crm/appointments.js src/lib/crm/contact.js src/lib/__tests__/crm.appointments.test.js src/lib/__tests__/crm.contact.test.js
```
Expected: os quatro arquivos passando (3 testes novos) e o lint sem saída. O painel continua igual.

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/appointments.js src/lib/crm/contact.js src/lib/__tests__/crm.appointments.test.js src/lib/__tests__/crm.contact.test.js
git commit -m "refactor: marcos e primeiro contato de um lead saem das contas do CRM" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 3` arquivos e `B_TESTES + 50` testes.

---

### Task 9: Fixtures do painel CRM num arquivo próprio

**Files:**
- Create: `src/lib/__tests__/fixtures/crmCtx.js`
- Modify: `src/lib/__tests__/crm.metrics.test.js` (linhas 5 a 75 saem; import novo)

Os testes dos Relatórios comparam o relatório com o `metricsOf`, com os mesmos dados que o teste do painel usa. As fixtures saem do `crm.metrics.test.js` para um arquivo que os dois importam.

- [ ] **Step 1: Mover as fixtures**

Crie `src/lib/__tests__/fixtures/crmCtx.js` com o cabeçalho abaixo e, embaixo dele, as linhas 5 a 75 de `src/lib/__tests__/crm.metrics.test.js`, que vão de `const NOW = new Date(2026, 8, 14, 12, 0);` até o `}` que fecha `function makeCtx()`. Ponha `export` na frente de cada `const` de nível de arquivo e da `function makeCtx`.

```js
// Fixtures do painel CRM (setembro de 2026 em andamento, até dia 14 ao
// meio-dia, e agosto fechado), divididas pelo crm.metrics.test.js e pelos
// testes dos Relatórios de Leads, que comparam o relatório com o metricsOf
// nos mesmos dados.
```

Apague as linhas 5 a 75 do `crm.metrics.test.js` e, logo depois da linha `import { comparisonCut } from '../operacional/month.js';`, acrescente:

```js
import { NOW, D, USERS, FUNNELS, STATUSES, L, MV, A, makeCtx } from './fixtures/crmCtx.js';
```

- [ ] **Step 2: Rodar e conferir que nada mudou**

Run:
```bash
npx vitest run src/lib/__tests__/crm.metrics.test.js
npx eslint src/lib/__tests__/crm.metrics.test.js src/lib/__tests__/fixtures/crmCtx.js
```
Expected: `Tests 28 passed (28)`, igual a antes, e o lint sem saída. Se o lint acusar um nome importado sem uso, tire esse nome do import do `crm.metrics.test.js`; se acusar um nome não definido, acrescente-o ao import.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/fixtures/crmCtx.js src/lib/__tests__/crm.metrics.test.js
git commit -m "test: fixtures do painel CRM num arquivo próprio" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 3` arquivos e `B_TESTES + 50` testes.

---

### Task 10: Janela de meses e índices (`janela.js`)

**Files:**
- Create: `src/lib/relatorios/leads/janela.js`
- Test: `src/lib/__tests__/relatoriosLeads.janela.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.janela.test.js`:

```js
// Carga dos Relatórios de Leads: os meses que a tela pede, os baldes juntados
// sem repetir e os índices, os mesmos do painel CRM.
import { describe, it, expect } from 'vitest';
import { reportMonthKeys, bucketOf, reportIndex, loadState } from '../relatorios/leads/janela.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, D } from './fixtures/crmCtx.js';

// 09/10/2026, sexta. A semana dele começa em 05/10, e a passada em 28/09.
const HOJE = new Date(2026, 9, 9, 15);

describe('meses que a tela pede', () => {
  it('do início do comparado até o mês atual', () => {
    const outubro = periodFromParams({ monthKey: '2026-10' }, HOJE);
    expect(reportMonthKeys(outubro, previousPeriod(outubro, HOJE), '2026-10')).toEqual(['2026-09', '2026-10']);
    const julho = periodFromParams({ monthKey: '2026-07' }, HOJE);
    expect(reportMonthKeys(julho, previousPeriod(julho, HOJE), '2026-10'))
      .toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    const semana = periodFromParams({ periodo: 'semana' }, HOJE);
    expect(reportMonthKeys(semana, previousPeriod(semana, HOJE), '2026-10')).toEqual(['2026-09', '2026-10']);
  });

  it('sem período, só o mês atual', () => {
    expect(reportMonthKeys(null, null, '2026-10')).toEqual(['2026-10']);
  });
});

describe('baldes e índices', () => {
  it('junta os meses sem repetir, com a cópia do mês mais novo', () => {
    const velho = { id: 'r', status: 'agendada' };
    const novo = { id: 'r', status: 'attended' };
    const months = { '2026-08': { aulas: [velho] }, '2026-09': { aulas: [novo, { id: 's' }] } };
    expect(bucketOf(months, 'aulas')).toEqual([novo, { id: 's' }]);
    expect(bucketOf(null, 'aulas')).toEqual([]);
  });

  it('os índices do painel, de todos os meses carregados', () => {
    const idx = reportIndex(makeCtx().months);
    expect(idx.records.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(idx.recordsByLead.get('s1').map((r) => r.id)).toEqual(['r1']);
    expect(idx.contactTimes.get('s1')).toEqual([D(9, 2, 10, 30).getTime(), D(9, 3).getTime(), D(9, 5).getTime()]);
  });

  it('a carga fica pronta com todos os meses, e a falha de um aparece', () => {
    expect(loadState({ '2026-09': {} }, ['2026-09', '2026-10'])).toEqual({ ready: false, failed: false });
    expect(loadState({ '2026-09': {}, '2026-10': { failed: true } }, ['2026-09', '2026-10'])).toEqual({ ready: true, failed: true });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.janela.test.js`
Expected: FAIL, com `Cannot find module '../relatorios/leads/janela.js'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/janela.js`:

```js
// Carga dos Relatórios de Leads (spec 2026-10-09, "A carga" e "As contas").
// Puro. A carga é a do painel CRM (useCrmSources), por mês e com a mesma
// memória de sessão: aqui se decide quais meses pedir e como juntar os baldes
// deles, do mesmo jeito que o painel faz (cacheOf, em src/lib/crm/metrics.js).

import { addMonthsToKey, monthKeyOf } from '../../operacional/month.js';
import { contactTimesByLead } from '../../crm/contact.js';
import { recordsByLeadOf, visitOutcomesByLead } from '../../crm/appointments.js';

// O mesmo teto do painel (crmMonthKeys): uma data torta não prende o laço.
const MAX_SPAN_MONTHS = 36;

// Meses que a tela pede, em ordem: do mês do início mais antigo (o período ou
// o comparado) até o mês atual. A safra da Conversão é acompanhada até agora,
// e o primeiro contato olha o mês seguinte ao do cadastro, então os meses
// depois do período também entram.
export function reportMonthKeys(period, cmp, currentKey) {
  const starts = [period?.start, cmp?.start].filter((d) => d instanceof Date).map((d) => d.getTime());
  if (!starts.length) return [currentKey];
  const keys = [];
  let k = monthKeyOf(new Date(Math.min(...starts)));
  for (let i = 0; i < MAX_SPAN_MONTHS && k <= currentKey; i++, k = addMonthsToKey(k, 1)) keys.push(k);
  return keys.length ? keys : [currentKey];
}

// Um balde (leadsCreated, converted, lost, aulas ou interactions) de todos os
// meses carregados, sem repetir id, com a cópia do mês mais novo: o registro
// remarcado de agosto para setembro continua na lista de agosto e contaria
// duas vezes (o newestRecordsOf do painel faz o mesmo com os registros).
export function bucketOf(months, bucket) {
  const seen = new Set();
  const out = [];
  Object.keys(months || {}).sort().reverse().forEach((key) => {
    (months[key]?.[bucket] || []).forEach((x) => {
      if (!x?.id || seen.has(x.id)) return;
      seen.add(x.id);
      out.push(x);
    });
  });
  return out;
}

// Índices de toda a carga, os mesmos do painel: registros de agendamento por
// lead, instantes de contato e desfechos de visita pela linha do tempo.
export function reportIndex(months) {
  const interactions = bucketOf(months, 'interactions');
  const records = bucketOf(months, 'aulas');
  return {
    records,
    recordsByLead: recordsByLeadOf(records),
    contactTimes: contactTimesByLead(interactions),
    visitOutcomes: visitOutcomesByLead(interactions),
  };
}

// Estado da carga dos meses pedidos: pronta quando todos chegaram; com falha
// quando algum falhou, e aí a tela mostra o aviso e nenhum número.
export function loadState(months, keys) {
  const entries = (keys || []).map((k) => months?.[k] || null);
  return { ready: entries.every(Boolean), failed: entries.some((e) => Boolean(e?.failed)) };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosLeads.janela.test.js
TZ=UTC npx vitest run src/lib/__tests__/relatoriosLeads.janela.test.js
npx eslint src/lib/relatorios/leads/janela.js src/lib/__tests__/relatoriosLeads.janela.test.js
```
Expected: `Tests 5 passed (5)` nas duas rodadas e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorios/leads/janela.js src/lib/__tests__/relatoriosLeads.janela.test.js
git commit -m "feat: janela de meses e índices dos Relatórios de Leads" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 4` arquivos e `B_TESTES + 55` testes.

---

### Task 11: O que os submenus dividem (`base.js`)

**Files:**
- Create: `src/lib/relatorios/leads/base.js`
- Test: `src/lib/__tests__/relatoriosLeads.base.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.base.test.js`:

```js
// Peças divididas pelos submenus dos Relatórios de Leads: recorte da barra,
// leads novos, nomes, filtro da lista e planilha.
import { describe, it, expect } from 'vitest';
import {
  reportScope, newLeadsIn, namesOf, OTHERS_LABEL, cutCode, applyCut, cutLabelOf, contactCells, fmtDate,
  exportFileName, SITUACAO_LABEL,
} from '../relatorios/leads/base.js';
import { OTHERS_ID } from '../crm/scope.js';
import { periodFromParams } from '../period.js';
import { makeCtx, USERS, FUNNELS, NOW } from './fixtures/crmCtx.js';

const SOURCES = [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação', channel: '' }];
const ctxOf = () => ({ ...makeCtx(), sources: SOURCES });
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);

describe('recorte da barra', () => {
  it('consultores, funil e origem juntos', () => {
    const lead = { id: 'x', consultantId: 'ana', funnelId: 'ven', source: 'Instagram ' };
    expect(reportScope({ users: USERS, funnels: FUNNELS }).inScope(lead)).toBe(true);
    expect(reportScope({ users: USERS, funnels: FUNNELS, origem: 'Instagram' }).inScope(lead)).toBe(true);
    expect(reportScope({ users: USERS, funnels: FUNNELS, origem: 'Indicação' }).inScope(lead)).toBe(false);
    expect(reportScope({ users: USERS, funnels: FUNNELS, userIds: ['diego'] }).inScope(lead)).toBe(false);
    expect(reportScope({ users: USERS, funnels: FUNNELS, funnelId: 'ind' }).inScope(lead)).toBe(false);
  });

  it('os leads novos da janela, na regra do painel: sem importado e sem funil de cliente', () => {
    const ids = newLeadsIn(ctxOf(), reportScope({ users: USERS, funnels: FUNNELS }), setembro).map((l) => l.id).sort();
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });
});

describe('nomes', () => {
  it('consultor da equipe, quem saiu vai para Outros, funil vazio cai no padrão, canal do catálogo', () => {
    const n = namesOf(ctxOf());
    expect(n.ownerKey({ consultantId: 'ana' })).toBe('ana');
    expect(n.ownerKey({ consultantId: 'ex' })).toBe(OTHERS_ID);
    expect(n.ownerName('diego')).toBe('Diego Santos');
    expect(n.ownerName(OTHERS_ID)).toBe(OTHERS_LABEL);
    expect(n.ownerLabel({ consultantId: 'ex', consultantName: 'Carla Antiga' })).toBe('Carla Antiga');
    expect(n.ownerLabel({ consultantId: 'ex' })).toBe('Fora da equipe');
    expect(n.ownerLabel({ consultantId: null })).toBe('Sem responsável');
    expect(n.funnelId({ funnelId: null })).toBe('ven');
    expect(n.funnelName('ind')).toBe('Indicações');
    expect(n.sourceName({ source: '  ' })).toBe('Sem origem');
    expect(n.channelOf('Instagram')).toBe('Pago');
    expect(n.channelOf('Indicação')).toBe('');
  });
});

describe('filtro da lista', () => {
  const rows = [{ id: 'a', cuts: ['origem:Instagram', 'consultor:ana'] }, { id: 'b', cuts: ['origem:Indicação'] }];

  it('vale só o recorte que existe no submenu', () => {
    const available = new Set(['origem:Instagram', 'origem:Indicação', 'consultor:ana']);
    expect(applyCut(rows, 'origem:Instagram', available)).toEqual({ cut: 'origem:Instagram', rows: [rows[0]] });
    expect(applyCut(rows, 'origem:Outdoor', available)).toEqual({ cut: null, rows });
    expect(applyCut(rows, null, available)).toEqual({ cut: null, rows });
    expect(cutCode('situacao', 'matricularam')).toBe('situacao:matricularam');
  });

  it('o texto do filtro diz o tipo, menos nos números', () => {
    const items = [{ key: 'origem:Instagram', name: 'Instagram' }, { key: 'situacao:vieram', name: 'Vieram' }, { key: 'faixa:ate-1h', name: 'Até 1 hora' }];
    expect(cutLabelOf('origem:Instagram', items)).toBe('Origem: Instagram');
    expect(cutLabelOf('situacao:vieram', items)).toBe('Vieram');
    expect(cutLabelOf('faixa:ate-1h', items)).toBe('Primeiro contato: Até 1 hora');
    expect(cutLabelOf('origem:Outdoor', items)).toBeNull();
  });
});

describe('planilha', () => {
  it('contato no molde de Todos os leads, com o responsável do menor e o CPF', () => {
    const adulto = { whatsapp: '(11) 99999-0000', cpf: '123.456.789-00' };
    expect(contactCells(adulto, NOW)).toEqual({ whatsapp: '(11) 99999-0000', responsavel: '', telefoneResponsavel: '', cpf: '123.456.789-00' });
    const menor = { whatsapp: '', isMinor: true, guardian: { name: 'Marta Lima', phone: '(11) 98888-7777', relationship: 'Mãe' } };
    expect(contactCells(menor, NOW)).toEqual({ whatsapp: '', responsavel: 'Marta Lima (mãe)', telefoneResponsavel: '(11) 98888-7777', cpf: '' });
  });

  it('data no formato do Brasil, e vazio sem data', () => {
    expect(fmtDate(new Date(2026, 8, 2, 10))).toBe('02/09/2026');
    expect(fmtDate(null)).toBe('');
  });

  it('nome do arquivo com o submenu e as datas do período', () => {
    expect(exportFileName('entrada', setembro)).toBe('leads-entrada-2026-09-01-a-2026-09-14.csv');
    const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
    expect(exportFileName('conversao', agosto)).toBe('leads-conversao-2026-08-01-a-2026-08-31.csv');
  });

  it('situação de hoje em palavras', () => {
    expect(SITUACAO_LABEL).toEqual({ ativo: 'Em aberto', cliente: 'Cliente', perda: 'Perdido' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.base.test.js`
Expected: FAIL, com `Cannot find module '../relatorios/leads/base.js'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/base.js`:

```js
// O que os submenus dos Relatórios de Leads dividem (spec 2026-10-09): o
// recorte da barra, os leads novos da janela, os nomes de consultor, funil e
// origem, o filtro da lista, as colunas de contato da planilha, a data e o
// nome do arquivo. Puro.

import { makeScope, OTHERS_ID } from '../../crm/scope.js';
import { newLeadsOf } from '../../crm/cohort.js';
import { getDefaultFunnel } from '../../funnels.js';
import { contactLabel, contactOf } from '../../guardian.js';
import { dayKeyOf } from '../../operacional/month.js';
import { bucketOf } from './janela.js';

// Recorte da barra: consultores (lista; vazia é a equipe toda, com quem saiu
// da equipe e os leads sem dono), funil (null é todos os funis de lead) e
// origem (o nome no catálogo; null é todas).
export function reportScope({ users, funnels, userIds = [], funnelId = null, origem = null }) {
  const scope = makeScope({ users, funnels, userIds, funnelId });
  const sourceOk = (lead) => !origem || String(lead?.source || '').trim() === origem;
  return { ...scope, sourceOk, inScope: (lead) => scope.inScope(lead) && sourceOk(lead) };
}

// Os leads cadastrados na janela [start, end), na regra do painel (newLeadsOf:
// sem importados e sem data de cadastro ausente), com a versão mais nova de
// cada lead (leadsById).
export function newLeadsIn(ctx, scope, { start, end }) {
  const fresh = bucketOf(ctx.months, 'leadsCreated').map((l) => ctx.leadsById?.get(l.id) || l);
  return newLeadsOf(fresh, { start, end, inScope: scope.inScope });
}

export const OTHERS_LABEL = 'Fora da equipe ou sem responsável';

// Nomes que os recortes e a lista mostram. Nos recortes, quem saiu da equipe e
// o lead sem dono entram juntos em OTHERS_ID, como o Outros do painel. Na
// lista, o lead mostra o nome gravado nele.
export function namesOf(ctx) {
  const team = new Map((ctx.users || []).map((u) => [u.id, u.name || 'Sem nome']));
  const defaultFunnelId = getDefaultFunnel(ctx.funnels || [])?.id || null;
  const funnels = new Map((ctx.funnels || []).map((f) => [f.id, f.name || 'Funil']));
  const channels = new Map((ctx.sources || []).map((s) => [String(s?.name || '').trim(), String(s?.channel || '').trim()]));
  return {
    ownerKey: (l) => (team.has(l?.consultantId) ? l.consultantId : OTHERS_ID),
    ownerName: (id) => (id === OTHERS_ID ? OTHERS_LABEL : team.get(id) || OTHERS_LABEL),
    ownerLabel: (l) => team.get(l?.consultantId) || l?.consultantName || (l?.consultantId ? 'Fora da equipe' : 'Sem responsável'),
    funnelId: (l) => l?.funnelId || defaultFunnelId,
    funnelName: (id) => funnels.get(id) || 'Sem funil',
    sourceName: (l) => String(l?.source || '').trim() || 'Sem origem',
    channelOf: (name) => channels.get(name) || '',
  };
}

// Filtro da lista. Cada linha leva os códigos dos recortes em que ela entra
// (situacao:matricularam, origem:Instagram, consultor:<id>). O recorte do
// endereço só vale quando algum número ou recorte do submenu tem esse código;
// senão é ignorado.
export const cutCode = (tipo, valor) => `${tipo}:${valor}`;

export function applyCut(rows, recorte, available) {
  const cut = recorte && available.has(recorte) ? recorte : null;
  return { cut, rows: cut ? rows.filter((r) => r.cuts.includes(cut)) : rows };
}

const CUT_PREFIX = Object.freeze({ origem: 'Origem', consultor: 'Consultor', funil: 'Funil', faixa: 'Primeiro contato' });

// Texto do filtro aplicado, que a lista mostra: "Origem: Instagram". Os
// números (situacao) aparecem só com o nome deles, como "Matricularam".
export function cutLabelOf(cut, items) {
  const item = (items || []).find((i) => i.key === cut);
  if (!item) return null;
  const prefix = CUT_PREFIX[cut.slice(0, cut.indexOf(':'))];
  return prefix ? `${prefix}: ${item.name}` : item.name;
}

// Colunas de contato da planilha, no molde de Todos os leads (LeadsView): o
// WhatsApp do lead e, quando quem atende é o responsável do menor, o nome e o
// telefone dele. O CPF vai pela decisão 2 de 28/09/2026.
export const CONTACT_COLUMNS = Object.freeze([
  Object.freeze({ key: 'whatsapp', label: 'WhatsApp' }),
  Object.freeze({ key: 'responsavel', label: 'Responsável do aluno' }),
  Object.freeze({ key: 'telefoneResponsavel', label: 'Telefone do responsável' }),
  Object.freeze({ key: 'cpf', label: 'CPF' }),
]);

export function contactCells(lead, now) {
  const c = contactOf(lead, now);
  return {
    whatsapp: lead?.whatsapp || '',
    responsavel: c.viaGuardian ? contactLabel(c) : '',
    telefoneResponsavel: c.viaGuardian ? c.phone : '',
    cpf: lead?.cpf || '',
  };
}

export const fmtDate = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '');

// Situação de hoje do lead, pelo deriveLeadBucket.
export const SITUACAO_LABEL = Object.freeze({ ativo: 'Em aberto', cliente: 'Cliente', perda: 'Perdido' });

// Nome do arquivo da planilha: o submenu e as datas do período, sem dado
// pessoal. O último dia é o do fim efetivo (hoje, no período em andamento).
export function exportFileName(section, period) {
  const last = new Date(Math.max(period.start.getTime(), period.end.getTime() - 1));
  return `leads-${section}-${dayKeyOf(period.start)}-a-${dayKeyOf(last)}.csv`;
}

// Ordem das listas: cadastro mais novo primeiro, depois o nome e o id.
export const byNewest = (a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0)
  || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosLeads.base.test.js
TZ=UTC npx vitest run src/lib/__tests__/relatoriosLeads.base.test.js
npx eslint src/lib/relatorios/leads/base.js src/lib/__tests__/relatoriosLeads.base.test.js
```
Expected: `Tests 9 passed (9)` nas duas rodadas e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorios/leads/base.js src/lib/__tests__/relatoriosLeads.base.test.js
git commit -m "feat: peças divididas pelos Relatórios de Leads" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 5` arquivos e `B_TESTES + 64` testes.

---

### Task 12: Conta da Entrada de leads

**Files:**
- Create: `src/lib/relatorios/leads/entrada.js`
- Test: `src/lib/__tests__/relatoriosLeads.entrada.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.entrada.test.js`:

```js
// Entrada de leads: o total, a variação, os recortes, a lista e a planilha. No
// mês inteiro, o total e as origens são os do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { entradaReport, ENTRADA_COLUMNS } from '../relatorios/leads/entrada.js';
import { metricsOf, OTHERS_ID } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';

const SOURCES = [{ name: 'Instagram', channel: 'Pago' }];
const ctxOf = () => ({ ...makeCtx(), sources: SOURCES });
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}) => entradaReport(ctx, { period: setembro, cmp: previousPeriod(setembro, NOW), ...extra });

describe('Entrada de leads', () => {
  it('o total, a variação e os recortes do mês', () => {
    const r = rel(ctxOf());
    expect(r.total).toBe(5);
    expect(r.delta).toMatchObject({ up: true, text: '25%' });
    expect(r.bySource.map((x) => [x.name, x.count, x.channel])).toEqual([['Instagram', 4, 'Pago'], ['Indicação', 1, '']]);
    expect(r.byOwner.map((x) => [x.name, x.count])).toEqual([['Ana Ribeiro', 2], ['Diego Santos', 2], ['Fora da equipe ou sem responsável', 1]]);
    expect(r.byFunnel.map((x) => [x.name, x.count])).toEqual([['Vendas', 4], ['Indicações', 1]]);
  });

  it('a lista, do cadastro mais novo para o mais antigo, com a situação de hoje', () => {
    const r = rel(ctxOf());
    expect(r.rows.map((x) => x.id)).toEqual(['s4', 's1', 's2', 's3', 's5']);
    expect(r.rows.find((x) => x.id === 's1').situation).toBe('Cliente');
    expect(r.rows.find((x) => x.id === 's3').situation).toBe('Perdido');
    expect(r.rows.find((x) => x.id === 's5').owner).toBe('Fora da equipe');
  });

  it('filtros da barra: consultores, origem e funil', () => {
    expect(rel(ctxOf(), { userIds: ['diego'] }).total).toBe(2);
    expect(rel(ctxOf(), { origem: 'Indicação' }).total).toBe(1);
    expect(rel(ctxOf(), { funnelId: 'ind' }).total).toBe(1);
  });

  it('o recorte filtra só a lista, e o que não existe é ignorado', () => {
    const r = rel(ctxOf(), { recorte: 'origem:Instagram' });
    expect([r.cut, r.cutLabel, r.rows.length, r.total]).toEqual(['origem:Instagram', 'Origem: Instagram', 4, 5]);
    const outros = rel(ctxOf(), { recorte: `consultor:${OTHERS_ID}` });
    expect(outros.rows.map((x) => x.id)).toEqual(['s5']);
    expect(outros.cutLabel).toBe('Consultor: Fora da equipe ou sem responsável');
    expect(rel(ctxOf(), { recorte: 'origem:Outdoor' })).toMatchObject({ cut: null, cutLabel: null });
  });

  it('a planilha tem o contato, o CPF e as colunas da lista', () => {
    expect(ENTRADA_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Origem', 'Consultor', 'Funil', 'Etapa', 'Cadastro', 'Situação',
    ]);
    expect(rel(ctxOf(), { recorte: 'funil:ind' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
      origem: 'Indicação', consultor: 'Diego Santos', funil: 'Indicações', etapa: 'Novo lead', cadastro: '02/09/2026', situacao: 'Em aberto',
    }]);
  });

  it('no mês inteiro, o total e as origens são os do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    const cmp = previousPeriod(setembro, NOW);
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        const tag = `${userId} ${funnelId}`;
        const set = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId });
        expect(rel(ctx, extra).total, tag).toBe(set.leads);
        expect(new Map(rel(ctx, extra).bySource.map((x) => [x.name, x.count])), tag)
          .toEqual(new Map(set.channels.map((c) => [c.name, c.leads])));
        expect(entradaReport(ctx, { period: agosto, ...extra }).total, tag)
          .toBe(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId }).leads);
        expect(entradaReport(ctx, { period: cmp, ...extra }).total, tag)
          .toBe(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId, cutEnd: cut }).leads);
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.entrada.test.js`
Expected: FAIL, com `Cannot find module '../relatorios/leads/entrada.js'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/entrada.js`:

```js
// Entrada de leads (spec 2026-10-09, submenu 1): quantos leads chegaram no
// período, de que origem e para qual consultor. Os leads novos saem da regra
// do painel CRM (newLeadsOf), então, no mês inteiro, o total é o "Leads novos"
// do painel. Puro.

import { deriveLeadBucket } from '../../leadDerived.js';
import { crmDelta } from '../../crm/metrics.js';
import {
  reportScope, newLeadsIn, namesOf, cutCode, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate,
  SITUACAO_LABEL, byNewest,
} from './base.js';

export const ENTRADA_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'funil', label: 'Funil' }),
  Object.freeze({ key: 'etapa', label: 'Etapa' }),
  Object.freeze({ key: 'cadastro', label: 'Cadastro' }),
  Object.freeze({ key: 'situacao', label: 'Situação' }),
]);

// Contagem por um recorte, do maior para o menor, e o empate pelo nome.
function countRows(leads, keyOf, nameOf, tipo, extra = () => ({})) {
  const map = new Map();
  leads.forEach((l) => {
    const id = keyOf(l);
    const row = map.get(id) || { key: cutCode(tipo, id), id, name: nameOf(id), count: 0, ...extra(id) };
    row.count += 1;
    map.set(id, row);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

export function entradaReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const leads = newLeadsIn(ctx, scope, period);
  const before = cmp ? newLeadsIn(ctx, scope, cmp).length : null;

  const bySource = countRows(leads, names.sourceName, (id) => id, 'origem', (id) => ({ channel: names.channelOf(id) }));
  const byOwner = countRows(leads, names.ownerKey, names.ownerName, 'consultor');
  const byFunnel = countRows(leads, names.funnelId, names.funnelName, 'funil');

  const rows = leads.map((l) => ({
    id: l.id,
    lead: l,
    name: l.name || 'Sem nome',
    source: names.sourceName(l),
    owner: names.ownerLabel(l),
    funnel: names.funnelName(names.funnelId(l)),
    stage: l.status || '',
    createdAt: l.createdAt,
    situation: SITUACAO_LABEL[deriveLeadBucket(l)],
    cuts: [cutCode('origem', names.sourceName(l)), cutCode('consultor', names.ownerKey(l)), cutCode('funil', names.funnelId(l))],
  })).sort(byNewest);

  const items = [...bySource, ...byOwner, ...byFunnel];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    total: leads.length,
    delta: before === null ? null : crmDelta(leads.length, before),
    bySource,
    byOwner,
    byFunnel,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: ENTRADA_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      origem: r.source,
      consultor: r.owner,
      funil: r.funnel,
      etapa: r.stage,
      cadastro: fmtDate(r.createdAt),
      situacao: r.situation,
    })),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosLeads.entrada.test.js
TZ=UTC npx vitest run src/lib/__tests__/relatoriosLeads.entrada.test.js
npx eslint src/lib/relatorios/leads/entrada.js src/lib/__tests__/relatoriosLeads.entrada.test.js
```
Expected: `Tests 6 passed (6)` nas duas rodadas e o lint sem saída. Se a equivalência falhar, a conta do relatório está diferente da do painel: corrija o relatório, nunca o teste.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorios/leads/entrada.js src/lib/__tests__/relatoriosLeads.entrada.test.js
git commit -m "feat: conta da Entrada de leads, igual ao painel CRM no mês inteiro" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 6` arquivos e `B_TESTES + 70` testes.

---

### Task 13: Conta da Conversão

**Files:**
- Create: `src/lib/relatorios/leads/conversao.js`
- Test: `src/lib/__tests__/relatoriosLeads.conversao.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosLeads.conversao.test.js`:

```js
// Conversão: a safra do período lead por lead, os números, a rapidez do
// primeiro contato, o comparado, a lista e a planilha. No mês inteiro, os
// números são os do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { conversaoReport, CONVERSAO_COLUMNS, SPEED_BUCKETS } from '../relatorios/leads/conversao.js';
import { metricsOf } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';

const ctxOf = () => ({ ...makeCtx(), sources: [] });
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}) => conversaoReport(ctx, { period: setembro, cmp: previousPeriod(setembro, NOW), ...extra });
const speedOf = (r) => Object.fromEntries(r.bySpeed.map((b) => [b.id, b.leads]));

describe('Conversão', () => {
  it('a safra do mês, os números e a conversão', () => {
    const r = rel(ctxOf());
    expect(r.totals).toEqual({ leads: 5, sched: 3, came: 1, enrolled: 1, lost: 1, open: 3, conv: 20 });
    expect(r.conversion.value).toBe(20);
    expect(r.tiles.map((t) => [t.key, t.value])).toEqual([
      [null, 5], ['situacao:agendaram', 3], ['situacao:vieram', 1],
      ['situacao:matricularam', 1], ['situacao:perderam', 1], ['situacao:em-aberto', 3],
    ]);
  });

  it('a rapidez do primeiro contato nas faixas do painel, com a conversão de cada uma', () => {
    const r = rel(ctxOf());
    expect(SPEED_BUCKETS.map((b) => b.label)).toEqual(['Até 1 hora', 'De 1 a 24 horas', 'Mais de 24 horas', 'Sem contato']);
    expect(speedOf(r)).toEqual({ 'ate-1h': 1, 'ate-24h': 1, 'mais-24h': 2, 'sem-contato': 1 });
    expect(r.bySpeed.find((b) => b.id === 'ate-1h')).toMatchObject({ enrolled: 1, conv: 100 });
  });

  it('o comparado vai até o mesmo ponto quando o mês está em andamento', () => {
    const ctx = ctxOf();
    const r = rel(ctx);
    const m = metricsOf(ctx, { monthKey: '2026-08', cutEnd: comparisonCut('2026-09', '2026-08', NOW) });
    expect(r.before).toEqual(m.cohort);
    expect(r.conversion.delta.text).toMatch(/p\.p\.$/);
  });

  it('o recorte filtra a lista: quem matriculou, quem agendou, quem ficou sem contato', () => {
    const m = rel(ctxOf(), { recorte: 'situacao:matricularam' });
    expect([m.cut, m.cutLabel, m.rows.map((x) => x.id)]).toEqual(['situacao:matricularam', 'Matricularam', ['s1']]);
    expect(rel(ctxOf(), { recorte: 'situacao:agendaram' }).rows.map((x) => x.id).sort()).toEqual(['s1', 's2', 's4']);
    expect(rel(ctxOf(), { recorte: 'faixa:sem-contato' }).rows.map((x) => x.id)).toEqual(['s4']);
    expect(rel(ctxOf(), { recorte: 'faixa:xyz' }).cut).toBeNull();
  });

  it('a planilha diz o primeiro contato, se agendou e veio, e o desfecho com a data', () => {
    expect(CONVERSAO_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF', 'Origem', 'Consultor', 'Cadastro',
      'Primeiro contato', 'Tempo até o primeiro contato', 'Agendou', 'Veio', 'Desfecho', 'Data do desfecho',
    ]);
    expect(rel(ctxOf(), { recorte: 'situacao:matricularam' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '', origem: 'Instagram', consultor: 'Ana Ribeiro',
      cadastro: '02/09/2026', primeiroContato: '02/09/2026', tempoPrimeiroContato: '30 min', agendou: 'Sim', veio: 'Sim',
      desfecho: 'Matriculou', dataDesfecho: '05/09/2026',
    }]);
  });

  it('no mês inteiro, os números são os do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        for (const [period, key] of [[setembro, '2026-09'], [agosto, '2026-08']]) {
          const tag = `${userId} ${funnelId} ${key}`;
          const r = conversaoReport(ctx, { period, ...extra });
          const m = metricsOf(ctx, { monthKey: key, userId, funnelId });
          expect(r.totals, tag).toEqual(m.cohort);
          expect(speedOf(r), tag).toEqual({
            'ate-1h': m.firstContact.h1, 'ate-24h': m.firstContact.h24, 'mais-24h': m.firstContact.over, 'sem-contato': m.firstContact.none,
          });
          expect(new Map(r.bySource.map((x) => [x.name, [x.leads, x.enrolled]])), tag)
            .toEqual(new Map(m.channels.map((c) => [c.name, [c.leads, c.enrolled]])));
        }
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosLeads.conversao.test.js`
Expected: FAIL, com `Cannot find module '../relatorios/leads/conversao.js'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/relatorios/leads/conversao.js`:

```js
// Conversão (spec 2026-10-09, submenu 2): dos leads que chegaram no período (a
// safra), quantos agendaram, vieram, matricularam, se perderam ou seguem em
// aberto, acompanhados até agora. As contas são as do painel CRM, lead por
// lead: outcomeAt para o desfecho, cohortMilestoneOf para agendou e veio e
// firstContactMinutesOf para o primeiro contato. No mês inteiro, os números
// são os do painel. Puro.

import { addMonthsToKey, monthKeyOf, monthRange } from '../../operacional/month.js';
import { outcomeAt, firstEnrolledAtOf, lostAtOf } from '../../crm/cohort.js';
import { cohortMilestoneOf } from '../../crm/appointments.js';
import { firstContactMinutesOf } from '../../crm/contact.js';
import { crmDelta } from '../../crm/metrics.js';
import { pct } from '../../crm/stats.js';
import { fmtDuration } from '../../crm/format.js';
import { reportIndex } from './janela.js';
import {
  reportScope, newLeadsIn, namesOf, cutCode, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate, byNewest,
} from './base.js';

// Faixas da rapidez do primeiro contato, as do painel (firstContactOf).
export const SPEED_BUCKETS = Object.freeze([
  Object.freeze({ id: 'ate-1h', label: 'Até 1 hora', test: (m) => m != null && m <= 60 }),
  Object.freeze({ id: 'ate-24h', label: 'De 1 a 24 horas', test: (m) => m != null && m > 60 && m <= 1440 }),
  Object.freeze({ id: 'mais-24h', label: 'Mais de 24 horas', test: (m) => m != null && m > 1440 }),
  Object.freeze({ id: 'sem-contato', label: 'Sem contato', test: (m) => m == null }),
]);

// Código do recorte e texto de cada desfecho.
const OUTCOME_CODE = Object.freeze({ enrolled: 'matricularam', lost: 'perderam', open: 'em-aberto' });
export const OUTCOME_LABEL = Object.freeze({ enrolled: 'Matriculou', lost: 'Perdeu', open: 'Em aberto' });

export const CONVERSAO_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'cadastro', label: 'Cadastro' }),
  Object.freeze({ key: 'primeiroContato', label: 'Primeiro contato' }),
  Object.freeze({ key: 'tempoPrimeiroContato', label: 'Tempo até o primeiro contato' }),
  Object.freeze({ key: 'agendou', label: 'Agendou' }),
  Object.freeze({ key: 'veio', label: 'Veio' }),
  Object.freeze({ key: 'desfecho', label: 'Desfecho' }),
  Object.freeze({ key: 'dataDesfecho', label: 'Data do desfecho' }),
]);

// O primeiro contato olha até o fim do mês seguinte ao do cadastro de cada
// lead, ou até o instante da safra, o que vier antes (a regra do painel).
const contactLimitOf = (lead, asOf) => Math.min(
  asOf.getTime(),
  monthRange(addMonthsToKey(monthKeyOf(lead.createdAt), 1)).end.getTime(),
);

// A safra da janela, lead por lead, no instante asOf. O corte vale quando a
// safra é acompanhada até antes de agora (o comparado do período em
// andamento): aí o agendamento em aberto no próprio lead não conta.
function cohortOf(ctx, scope, index, win, asOf) {
  const cut = asOf.getTime() < ctx.now.getTime();
  return newLeadsIn(ctx, scope, win).map((l) => {
    const m = cohortMilestoneOf(l, { asOf, cut, recordsByLead: index.recordsByLead, visitOutcomes: index.visitOutcomes });
    return {
      lead: l,
      outcome: outcomeAt(l, asOf),
      booked: m.booked,
      attended: m.attended,
      minutes: firstContactMinutesOf(l, { contactTimes: index.contactTimes, limit: contactLimitOf(l, asOf) }),
    };
  });
}

function totalsOf(list) {
  const leads = list.length;
  const enrolled = list.filter((x) => x.outcome === 'enrolled').length;
  const lost = list.filter((x) => x.outcome === 'lost').length;
  return {
    leads,
    sched: list.filter((x) => x.booked).length,
    came: list.filter((x) => x.attended).length,
    enrolled,
    lost,
    open: leads - enrolled - lost,
    conv: pct(enrolled, leads),
  };
}

// Recorte com leads, matrículas e conversão, do maior volume para o menor.
function convRows(list, keyOf, nameOf, tipo) {
  const map = new Map();
  list.forEach((x) => {
    const id = keyOf(x.lead);
    const row = map.get(id) || { key: cutCode(tipo, id), id, name: nameOf(id), leads: 0, enrolled: 0 };
    row.leads += 1;
    if (x.outcome === 'enrolled') row.enrolled += 1;
    map.set(id, row);
  });
  return [...map.values()]
    .map((r) => ({ ...r, conv: pct(r.enrolled, r.leads) }))
    .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name, 'pt-BR'));
}

export function conversaoReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = reportIndex(ctx.months);
  const list = cohortOf(ctx, scope, index, period, ctx.now);
  const totals = totalsOf(list);
  // O comparado é acompanhado até o mesmo ponto quando o período está em
  // andamento, e até agora quando o período já fechou, como no painel.
  const before = cmp ? totalsOf(cohortOf(ctx, scope, index, cmp, period.running ? cmp.end : ctx.now)) : null;
  const delta = (k) => (before ? crmDelta(totals[k], before[k]) : null);

  const tiles = [
    { key: null, name: 'Leads da safra', value: totals.leads, delta: delta('leads') },
    { key: 'situacao:agendaram', name: 'Agendaram', value: totals.sched },
    { key: 'situacao:vieram', name: 'Vieram', value: totals.came },
    { key: 'situacao:matricularam', name: 'Matricularam', value: totals.enrolled, tone: 'good', delta: delta('enrolled') },
    { key: 'situacao:perderam', name: 'Perderam', value: totals.lost, tone: 'bad' },
    { key: 'situacao:em-aberto', name: 'Em aberto', value: totals.open },
  ];
  const bySource = convRows(list, names.sourceName, (id) => id, 'origem');
  const byOwner = convRows(list, names.ownerKey, names.ownerName, 'consultor');
  const bySpeed = SPEED_BUCKETS.map((b) => {
    const inIt = list.filter((x) => b.test(x.minutes));
    const enrolled = inIt.filter((x) => x.outcome === 'enrolled').length;
    return { key: cutCode('faixa', b.id), id: b.id, name: b.label, leads: inIt.length, enrolled, conv: pct(enrolled, inIt.length) };
  });

  const rows = list.map((x) => {
    const l = x.lead;
    const speed = SPEED_BUCKETS.find((b) => b.test(x.minutes));
    const cuts = [
      cutCode('situacao', OUTCOME_CODE[x.outcome]),
      cutCode('origem', names.sourceName(l)),
      cutCode('consultor', names.ownerKey(l)),
      cutCode('faixa', speed.id),
    ];
    if (x.booked) cuts.push('situacao:agendaram');
    if (x.attended) cuts.push('situacao:vieram');
    return {
      id: l.id,
      lead: l,
      name: l.name || 'Sem nome',
      source: names.sourceName(l),
      owner: names.ownerLabel(l),
      createdAt: l.createdAt,
      firstContactAt: x.minutes == null ? null : new Date(l.createdAt.getTime() + x.minutes * 60000),
      firstContactMin: x.minutes,
      booked: x.booked,
      attended: x.attended,
      outcome: x.outcome,
      outcomeAt: x.outcome === 'enrolled' ? firstEnrolledAtOf(l) : x.outcome === 'lost' ? lostAtOf(l) : null,
      cuts,
    };
  }).sort(byNewest);

  const items = [...tiles.filter((t) => t.key), ...bySource, ...byOwner, ...bySpeed];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    totals,
    before,
    conversion: { value: totals.conv, delta: before ? crmDelta(totals.conv, before.conv, { kind: 'pp' }) : null },
    tiles,
    bySource,
    byOwner,
    bySpeed,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: CONVERSAO_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      origem: r.source,
      consultor: r.owner,
      cadastro: fmtDate(r.createdAt),
      primeiroContato: fmtDate(r.firstContactAt),
      tempoPrimeiroContato: r.firstContactMin == null ? '' : fmtDuration(r.firstContactMin),
      agendou: r.booked ? 'Sim' : 'Não',
      veio: r.attended ? 'Sim' : 'Não',
      desfecho: OUTCOME_LABEL[r.outcome],
      dataDesfecho: fmtDate(r.outcomeAt),
    })),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosLeads.conversao.test.js
TZ=UTC npx vitest run src/lib/__tests__/relatoriosLeads.conversao.test.js
npx eslint src/lib/relatorios/leads/conversao.js src/lib/__tests__/relatoriosLeads.conversao.test.js
```
Expected: `Tests 6 passed (6)` nas duas rodadas e o lint sem saída. Se a equivalência falhar, a conta do relatório está diferente da do painel: corrija o relatório, nunca o teste.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorios/leads/conversao.js src/lib/__tests__/relatoriosLeads.conversao.test.js
git commit -m "feat: conta da Conversão, igual ao painel CRM no mês inteiro" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 7` arquivos e `B_TESTES + 76` testes.

---

## As telas (Tasks 14 a 17)

O Johnny pediu que as telas dos Relatórios sejam montadas com a skill frontend-design. **Antes da Task 14, carregue a skill frontend-design.** O código destas tasks já é o desenho decidido com ela, dentro da identidade do app (Space Grotesk no display, azul `brand-600`, verde para matrícula e conversão, tokens do shadcn e tema escuro): siga-o como está e use a skill para conferir o resultado na Task 20. Regras do `CLAUDE.md` que valem aqui: tokens semânticos, `cn()` para classe condicional, `flex gap-*` e `size-N`, nada de filtro em `useState` e nada de filtro numa `key`.

---

### Task 14: Seletor de período (`PeriodControl`)

**Files:**
- Create: `src/components/period/PeriodControl.jsx`
- Test: `src/lib/__tests__/periodControl.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/periodControl.test.js`:

```js
// Seletor de período, sem jsdom (renderToString). O conteúdo de um Popover
// fechado não é renderizado, então o balão é testado pelo PeriodMenu direto.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PeriodControl, PeriodMenu } from '../../components/period/PeriodControl.jsx';
import { periodFromParams } from '../period.js';

const noop = () => {};
const NOW = new Date(2026, 8, 25, 14, 30);
const TODAY = '2026-09-25';
const mes = periodFromParams({ monthKey: '2026-09' }, NOW);
const hoje = periodFromParams({ periodo: 'hoje' }, NOW);
const intervalo = periodFromParams({ de: '2026-08-28', ate: '2026-09-03' }, NOW);

describe('seletor de período', () => {
  it('no modo mês o botão diz Mês; fora dele, o texto do período, em destaque', () => {
    const m = renderToString(createElement(PeriodControl, { period: mes, todayKey: TODAY, onPeriod: noop, onRange: noop }));
    expect(m).toContain('aria-label="Período"');
    expect(m).toContain('>Mês</span>');
    expect(m).not.toContain('border-brand-600');
    const h = renderToString(createElement(PeriodControl, { period: hoje, todayKey: TODAY, onPeriod: noop, onRange: noop }));
    expect(h).toContain('Hoje · 25 set');
    expect(h).toContain('border-brand-600');
  });

  it('o balão lista os seis itens e marca o atual', () => {
    const html = renderToString(createElement(PeriodMenu, { period: hoje, todayKey: TODAY, onPick: noop, onApply: noop }));
    for (const label of ['Hoje', 'Ontem', 'Esta semana', 'Semana passada', 'Mês', 'Personalizado']) {
      expect(html).toContain(`>${label}</span>`);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).not.toContain('type="date"');
  });

  it('no intervalo o balão já abre nos campos, com as datas dele e os limites da janela', () => {
    const html = renderToString(createElement(PeriodMenu, { period: intervalo, todayKey: TODAY, onPick: noop, onApply: noop }));
    expect(html).toContain('value="2026-08-28"');
    expect(html).toContain('value="2026-09-03"');
    expect(html).toContain('min="2025-10-01"');
    expect(html).toContain(`max="${TODAY}"`);
    expect(html).toContain('>Aplicar</button>');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/periodControl.test.js`
Expected: FAIL, com `Cannot find module '../../components/period/PeriodControl.jsx'`.

- [ ] **Step 3: Implementar**

Crie `src/components/period/PeriodControl.jsx`:

```jsx
// Seletor de período (spec do período personalizado, 25/09/2026, "A barra"),
// usado primeiro pelos Relatórios: um botão com o texto do período, que abre um
// balão com os atalhos (Hoje, Ontem, Esta semana, Semana passada, Mês) e o
// Personalizado. O Personalizado abre, no mesmo balão, os campos "de" e "até" e
// o botão Aplicar. As datas passam pela mesma regra do endereço
// (intervalRefusal, em src/lib/period.js), e o motivo da recusa aparece
// embaixo dos campos. No modo mês o botão diz "Mês", e as setas e a lista dos
// 12 meses ficam ao lado dele, na barra da tela (MonthControl).
//
// O rascunho das datas mora no PeriodMenu, que só existe com o balão aberto:
// cada abertura começa do período do endereço, sem efeito nenhum. O filtro de
// verdade é o do endereço, e quem escreve nele é a tela (onPeriod, onRange).
import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.jsx';
import { intervalRefusal, oldestDayKey } from '../../lib/period.js';

const OPTIONS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'semana-passada', label: 'Semana passada' },
  { id: 'mes', label: 'Mês' },
  { id: 'intervalo', label: 'Personalizado' }
];

const FIELD = 'h-[34px] rounded-[9px] border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-brand-500';

// Conteúdo do balão: a lista e, no Personalizado, os campos. Exportado para o
// teste renderizar sem abrir o Popover.
export function PeriodMenu({ period, todayKey, onPick, onApply }) {
  const [custom, setCustom] = useState(period.kind === 'intervalo');
  const [draftDe, setDraftDe] = useState(period.de || '');
  const [draftAte, setDraftAte] = useState(period.ate || '');
  const [error, setError] = useState('');

  const apply = () => {
    const motivo = intervalRefusal(draftDe, draftAte, todayKey);
    if (motivo) { setError(motivo); return; }
    onApply(draftDe, draftAte);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {OPTIONS.map((o) => {
        const active = o.id === 'intervalo' ? custom : !custom && period.kind === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => (o.id === 'intervalo' ? setCustom(true) : onPick(o.id))}
            className={cn(
              'flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-[12.5px] font-semibold',
              active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-foreground hover:bg-muted/70'
            )}
          >
            <span className="flex-1">{o.label}</span>
            {active && <Check size={14} strokeWidth={2.2} />}
          </button>
        );
      })}
      {custom && (
        <div className="mt-1.5 flex flex-col gap-2 border-t border-border pt-2.5">
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted-foreground">De</span>
              <input
                type="date"
                value={draftDe}
                min={oldestDayKey(todayKey)}
                max={draftAte || todayKey}
                onChange={(e) => { setDraftDe(e.target.value); setError(''); }}
                className={FIELD}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted-foreground">Até</span>
              <input
                type="date"
                value={draftAte}
                min={draftDe || oldestDayKey(todayKey)}
                max={todayKey}
                onChange={(e) => { setDraftAte(e.target.value); setError(''); }}
                className={FIELD}
              />
            </label>
          </div>
          {error && <p role="alert" className="m-0 text-[11px] font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
          <button
            type="button"
            onClick={apply}
            className="h-[34px] self-end rounded-full bg-brand-600 px-[18px] text-[12px] font-bold text-white hover:bg-brand-700"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

// `compact`: ocupa a largura toda da linha do celular.
export function PeriodControl({ period, todayKey, onPeriod, onRange, compact = false }) {
  const [open, setOpen] = useState(false);
  const active = period.kind !== 'mes';
  const pick = (kind) => { setOpen(false); onPeriod(kind); };
  const apply = (de, ate) => { setOpen(false); onRange(de, ate); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Período"
          className={cn(
            'num flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            compact && 'w-full',
            active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-foreground'
          )}
        >
          <CalendarDays size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} />
          <span className={cn('truncate', compact && 'flex-1 text-left')}>{active ? period.label : 'Mês'}</span>
          <ChevronDown size={13} strokeWidth={2.2} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[288px] p-2">
        <PeriodMenu period={period} todayKey={todayKey} onPick={pick} onApply={apply} />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/periodControl.test.js
npx eslint src/components/period/PeriodControl.jsx src/lib/__tests__/periodControl.test.js
```
Expected: `Tests 3 passed (3)` e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/components/period/PeriodControl.jsx src/lib/__tests__/periodControl.test.js
git commit -m "feat: seletor de período" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 8` arquivos e `B_TESTES + 79` testes.

---

### Task 15: Peças da tela (`ReportParts.jsx`)

**Files:**
- Create: `src/views/relatorios/ReportParts.jsx`
- Test: `src/lib/__tests__/relatoriosParts.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosParts.test.js`:

```js
// Peças da tela de Relatórios, sem jsdom (renderToString): números que filtram
// a lista, número grande, recortes em barras, lista, exportar e aviso.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  NumberTiles, HeroNumber, CountBreakdown, ConversionBreakdown, ReportList, ExportButton, ReportNotice,
} from '../../views/relatorios/ReportParts.jsx';

const noop = () => {};
const html = (el) => renderToString(el);

describe('números do topo', () => {
  it('o total acende sem recorte, e cada número é um filtro da lista', () => {
    const tiles = [
      { key: null, name: 'Leads da safra', value: 5 },
      { key: 'situacao:matricularam', name: 'Matricularam', value: 1, tone: 'good' },
    ];
    const semRecorte = html(createElement(NumberTiles, { tiles, cut: null, onCut: noop }));
    expect(semRecorte.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(semRecorte).toContain('text-emerald-600');
    const comRecorte = html(createElement(NumberTiles, { tiles, cut: 'situacao:matricularam', onCut: noop }));
    expect(comRecorte.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(comRecorte.indexOf('aria-pressed="true"')).toBeGreaterThan(comRecorte.indexOf('Leads da safra'));
  });

  it('o número grande leva a variação e o período comparado', () => {
    const out = html(createElement(HeroNumber, { value: 1280, label: 'leads novos', delta: { up: true, text: '25%' }, compareText: 'vs. Agosto 2026' }));
    expect(out).toContain('1.280');
    expect(out).toContain('leads novos');
    expect(out).toContain('▲ 25%');
    expect(out).toContain('vs. Agosto 2026');
  });
});

describe('recortes', () => {
  it('a barra mostra o mesmo número que está ao lado, e a linha acesa é o filtro', () => {
    const rows = [
      { key: 'origem:Instagram', name: 'Instagram', channel: 'Pago', count: 4 },
      { key: 'origem:Indicação', name: 'Indicação', count: 1 },
    ];
    const out = html(createElement(CountBreakdown, { title: 'Por origem', rows, cut: 'origem:Indicação', onCut: noop }));
    expect(out).toContain('Por origem');
    expect(out).toContain('width:100%');
    expect(out).toContain('width:25%');
    expect(out).toContain('Pago');
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('na conversão, a barra é a própria conversão, em verde', () => {
    const rows = [
      { key: 'origem:Instagram', name: 'Instagram', leads: 4, enrolled: 1, conv: 25 },
      { key: 'faixa:sem-contato', name: 'Sem contato', leads: 0, enrolled: 0, conv: null },
    ];
    const out = html(createElement(ConversionBreakdown, { title: 'Por origem', rows, cut: null, onCut: noop }));
    for (const h of ['Leads', 'Matr.', 'Conv.']) expect(out).toContain(`>${h}</span>`);
    expect(out).toContain('>25%</span>');
    expect(out).toContain('width:25%');
    expect(out).toContain('bg-emerald-500');
  });
});

describe('lista', () => {
  const columns = [{ key: 'nome', label: 'Nome', render: (r) => r.name }];
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, name: `Lead ${i}` }));

  it('repete o número, mostra o filtro e 50 nomes por vez', () => {
    const out = html(createElement(ReportList, { total: 60, noun: 'leads', cutLabel: 'Matricularam', onClearCut: noop, columns, rows }));
    expect(out).toContain('>60</span>');
    expect(out).toContain('Matricularam');
    expect(out).toContain('aria-label="Limpar filtro da lista"');
    expect(out).toContain('>Lead 49</td>');
    expect(out).not.toContain('>Lead 50</td>');
    expect(out).toContain('Mostrar mais 10');
    expect(out).toContain('overscroll-x-contain');
  });

  it('lista vazia convida a trocar o período', () => {
    const out = html(createElement(ReportList, {
      total: 0, noun: 'leads', columns, rows: [],
      emptyTitle: 'Nenhum lead chegou neste período.', emptyText: 'Escolha outro período ou limpe os filtros.',
    }));
    expect(out).toContain('Nenhum lead chegou neste período.');
    expect(out).not.toContain('<table');
  });

  it('exportar desligado sem nome na lista, e o aviso do dado', () => {
    expect(html(createElement(ExportButton, { onExport: noop, disabled: true }))).toContain('disabled=""');
    expect(html(createElement(ReportNotice, null, 'Agendamentos incompletos.'))).toContain('Agendamentos incompletos.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosParts.test.js`
Expected: FAIL, com `Cannot find module '../../views/relatorios/ReportParts.jsx'`.

- [ ] **Step 3: Implementar**

Crie `src/views/relatorios/ReportParts.jsx`:

```jsx
// Peças da tela de Relatórios (spec 2026-10-09), desenhadas com a skill
// frontend-design no molde dos painéis (CrmCard, DeltaPill): o cabeçalho de
// cada submenu, o número grande, os números que filtram a lista, os recortes
// em barras, a lista de nomes, o exportar e o aviso do dado. A marca da tela é
// a lista que repete o número de que veio e o filtro aplicado: cada número e
// cada linha de recorte é um filtro dessa lista. A barra mostra sempre o mesmo
// número que está ao lado dela, e matrícula e conversão são verdes, como nos
// painéis.
import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { CrmCard, DashedNote, DeltaPill } from '../dashboard/CrmParts.jsx';

const TONE_TEXT = Object.freeze({
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
});
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const ROW_ON = 'bg-brand-50 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/15';

// Título do submenu, a pergunta que ele responde e, à direita, o exportar.
export function ReportHeader({ title, question, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 font-display text-[22px] font-bold tracking-[-0.015em]">{title}</h2>
        <p className="mt-1 text-pretty text-[13px] text-muted-foreground">{question}</p>
      </div>
      {action}
    </div>
  );
}

// O número que abre o submenu, com a variação contra o período anterior.
export function HeroNumber({ value, label, delta = null, compareText = null, percent = false, tone = null }) {
  const text = value == null ? 'sem base' : percent ? `${value}%` : fmtNum(value);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
      <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-0.03em]', TONE_TEXT[tone])}>{text}</span>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      {delta && <DeltaPill delta={delta} />}
      {compareText && <span className="text-[12px] text-muted-foreground">{compareText}</span>}
    </div>
  );
}

// Os números do topo. Cada um é também o filtro da lista: clicar mostra
// embaixo só os nomes dele, e clicar de novo volta para todos. O número sem
// filtro próprio (key null) é o total, aceso quando a lista não tem recorte.
export function NumberTiles({ tiles, cut, onCut }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => {
        const active = t.key === null ? cut === null : cut === t.key;
        return (
          <button
            key={t.name}
            type="button"
            aria-pressed={active}
            onClick={() => onCut(t.key === null || active ? null : t.key)}
            className={cn(
              'flex min-h-[96px] flex-col items-start justify-between gap-2 rounded-2xl border bg-card px-4 py-3.5 text-left shadow-card transition-colors motion-reduce:transition-none',
              FOCUS,
              active ? 'border-brand-600 ring-1 ring-brand-600 dark:border-brand-400 dark:ring-brand-400' : 'border-border hover:border-brand-300 dark:hover:border-brand-500/40'
            )}
          >
            <span className="text-[11.5px] font-semibold text-muted-foreground">{t.name}</span>
            <span className={cn('num font-display text-[28px] font-bold leading-none tracking-[-0.02em]', TONE_TEXT[t.tone])}>{fmtNum(t.value)}</span>
            {t.delta && <DeltaPill delta={t.delta} />}
          </button>
        );
      })}
    </div>
  );
}

// Recorte em barras: cada linha filtra a lista. A barra é o próprio número ao
// lado dela.
export function CountBreakdown({ title, hint, rows, cut, onCut, emptyText = 'Nada no período.' }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <CrmCard title={title} hint={hint}>
      {rows.length === 0 ? (
        <p className="px-[18px] py-4 text-[12.5px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-2">
          {rows.map((r) => {
            const active = cut === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCut(active ? null : r.key)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted/70', FOCUS, active && ROW_ON)}
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                    {r.name}
                    {r.channel && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{r.channel}</span>}
                  </span>
                  <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.count / max) * 100}%` }} />
                  </span>
                  <span className="num w-9 shrink-0 text-right text-[13px] font-semibold">{fmtNum(r.count)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CrmCard>
  );
}

const CONV_GRID = 'grid grid-cols-[minmax(0,1fr)_40px_40px_104px] items-center gap-x-2';

// Recorte da conversão: leads, matrículas e a conversão, com a barra sendo a
// própria conversão, em verde. Cada linha filtra a lista.
export function ConversionBreakdown({ title, hint, rows, cut, onCut }) {
  return (
    <CrmCard title={title} hint={hint}>
      <div className={cn(CONV_GRID, 'px-[18px] pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground')}>
        <span aria-hidden="true" />
        <span className="text-right">Leads</span>
        <span className="text-right">Matr.</span>
        <span className="text-right">Conv.</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2">
        {rows.map((r) => {
          const active = cut === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onCut(active ? null : r.key)}
                className={cn(CONV_GRID, 'w-full rounded-lg px-2.5 py-2 text-left hover:bg-muted/70', FOCUS, active && ROW_ON)}
              >
                <span className="truncate text-[12.5px] font-medium">{r.name}</span>
                <span className="num text-right text-[12.5px]">{fmtNum(r.leads)}</span>
                <span className="num text-right text-[12.5px]">{fmtNum(r.enrolled)}</span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-2 w-12 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${r.conv ?? 0}%` }} />
                  </span>
                  <span className="num w-9 text-right text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {r.conv == null ? '' : `${r.conv}%`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </CrmCard>
  );
}

// A lista de nomes por trás dos números. O cabeçalho repete o número que ela
// mostra e o filtro aplicado, com o botão de limpar. Mostra 50 nomes por vez,
// e o exportar leva todos. Ao trocar de filtro, volta aos 50 primeiros: o
// "Mostrar mais" vale para a lista em que foi clicado.
export function ReportList({ total, noun, cutLabel = null, onClearCut, columns, rows, emptyTitle, emptyText, pageSize = 50 }) {
  const sig = `${cutLabel || ''}|${rows.length}|${rows[0]?.id || ''}`;
  const [more, setMore] = useState({ sig, extra: 0 });
  const extra = more.sig === sig ? more.extra : 0;
  const shown = rows.slice(0, pageSize + extra);
  const left = rows.length - shown.length;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-[18px] py-3.5', RULE)}>
        <p className="m-0 flex items-baseline gap-2" aria-live="polite">
          <span className="num font-display text-[24px] font-bold leading-none tracking-[-0.02em]">{fmtNum(total)}</span>
          <span className="text-[13px] font-semibold text-muted-foreground">{noun}</span>
        </p>
        {cutLabel && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 pl-3 pr-1 text-[12px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {cutLabel}
            <button
              type="button"
              onClick={onClearCut}
              aria-label="Limpar filtro da lista"
              className={cn('grid size-5 place-items-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-500/25', FOCUS)}
            >
              <X size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        )}
      </header>
      {rows.length === 0 ? (
        <DashedNote className="m-4" title={emptyTitle} text={emptyText} />
      ) : (
        <>
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn('whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground', c.className)}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={cn('border-t', RULE)}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-4 py-2.5 text-[12.5px]', c.className)}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {left > 0 && (
            <div className={cn('border-t p-3 text-center', RULE)}>
              <button
                type="button"
                onClick={() => setMore({ sig, extra: extra + pageSize })}
                className={cn('h-9 rounded-full border border-border px-4 text-[12.5px] font-semibold hover:bg-muted/70', FOCUS)}
              >
                {`Mostrar mais ${Math.min(pageSize, left)}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ExportButton({ onExport, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className={cn('inline-flex h-9 items-center gap-2 rounded-full bg-brand-600 px-4 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40', FOCUS)}
    >
      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
      Exportar lista
    </button>
  );
}

// Aviso do dado, como o agendamento incompleto antes de setembro de 2026.
export function ReportNotice({ children }) {
  return (
    <p className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-200">
      {children}
    </p>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosParts.test.js src/lib/__tests__/overscrollGuard.test.js
npx eslint src/views/relatorios/ReportParts.jsx src/lib/__tests__/relatoriosParts.test.js
```
Expected: `relatoriosParts.test.js` com `Tests 7 passed (7)`, o `overscrollGuard.test.js` passando e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/views/relatorios/ReportParts.jsx src/lib/__tests__/relatoriosParts.test.js
git commit -m "feat: peças da tela de Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 9` arquivos e `B_TESTES + 86` testes.

---

### Task 16: A barra e a lista ao lado

**Files:**
- Create: `src/views/relatorios/RelatoriosToolbar.jsx`
- Create: `src/views/relatorios/RelatoriosRail.jsx`
- Test: `src/lib/__tests__/relatoriosBarra.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosBarra.test.js`:

```js
// Barra dos Relatórios e lista ao lado, sem jsdom (renderToString). O conteúdo
// de Popover e de Select fechados não é renderizado, então o menu de
// consultores é testado pelo ConsultoresMenu direto.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { RelatoriosToolbar, ConsultoresMenu } from '../../views/relatorios/RelatoriosToolbar.jsx';
import { RelatoriosRail } from '../../views/relatorios/RelatoriosRail.jsx';
import { periodFromParams } from '../period.js';

const noop = () => {};
const NOW = new Date(2026, 8, 25, 14, 30);
const people = [{ id: 'u1', name: 'Ana Ribeiro' }, { id: 'u2', name: 'Bruno Lima' }];
const base = {
  todayKey: '2026-09-25', onPeriod: noop, onRange: noop,
  monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
  canPrev: true, canNext: false, onPrev: noop, onNext: noop,
  resp: [], people, onResp: noop, origem: null, origens: ['Instagram'], onOrigem: noop,
  funnel: 'all', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop,
};

describe('barra dos Relatórios', () => {
  it('no modo mês: período, mês, consultores, origem e funil', () => {
    const out = renderToString(createElement(RelatoriosToolbar, { ...base, period: periodFromParams({ monthKey: '2026-09' }, NOW) }));
    for (const l of ['Período', 'Mês de competência', 'Consultores', 'Origem', 'Funil']) expect(out).toContain(`aria-label="${l}"`);
    expect(out).toContain('Equipe toda');
    expect(out).toContain('Todas as origens');
    expect(out).toContain('Todos os funis');
  });

  it('fora do modo mês, sem o seletor de mês, e o filtro aceso diz o que está escolhido', () => {
    const out = renderToString(createElement(RelatoriosToolbar, {
      ...base, resp: ['u2'], origem: 'Instagram', period: periodFromParams({ periodo: 'hoje' }, NOW),
    }));
    expect(out).not.toContain('aria-label="Mês de competência"');
    expect(out).toContain('Hoje · 25 set');
    expect(out).toContain('Bruno Lima');
    expect(out).toContain('>Instagram</span>');
  });

  it('o menu de consultores marca a equipe toda ou cada pessoa', () => {
    const toda = renderToString(createElement(ConsultoresMenu, { resp: [], people, onResp: noop }));
    expect(toda.match(/aria-pressed="true"/g)).toHaveLength(1);
    const uma = renderToString(createElement(ConsultoresMenu, { resp: ['u1'], people, onResp: noop }));
    expect(uma).toContain('aria-checked="true"');
    expect(uma).not.toContain('aria-pressed="true"');
  });
});

describe('lista ao lado', () => {
  it('o título Leads, os submenus com a pergunta, e o aceso é o do endereço', () => {
    const out = renderToString(createElement(RelatoriosRail, { section: 'conversao', onSection: noop }));
    expect(out).toContain('>Leads</div>');
    expect(out).toContain('Entrada de leads');
    expect(out).toContain('Quantos viraram matrícula');
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out.indexOf('aria-current="page"')).toBeGreaterThan(out.indexOf('Entrada de leads'));
    expect(out).toContain('aria-label="Relatório"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosBarra.test.js`
Expected: FAIL, com `Cannot find module '../../views/relatorios/RelatoriosToolbar.jsx'`.

- [ ] **Step 3: Criar a barra**

Crie `src/views/relatorios/RelatoriosToolbar.jsx`:

```jsx
// Barra dos Relatórios (spec 2026-10-09, "A barra de cima"): o período e, no
// modo mês, as setas e a lista dos 12 meses; os consultores, a origem e o
// funil. Tudo vem do endereço e volta para ele pela tela (on*). Abaixo de md
// os controles entram num balão, como na barra do Operacional. Desenhada com
// a skill frontend-design, no molde dos controles do Operacional e do CRM.
//
// O trigger dos Select usa o primitivo Radix direto (SelectPrimitive.Trigger
// asChild), pelo mesmo motivo explicado no topo do OperacionalToolbar.jsx: o
// SelectTrigger do shadcn põe um segundo filho e o Slot exige um só.
import { Select as SelectPrimitive } from 'radix-ui';
import { ChevronDown, Filter, Layers, SlidersHorizontal, Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import { Select, SelectContent, SelectItem } from '../../components/ui/select.jsx';
import { Checkbox } from '../../components/ui/checkbox.jsx';
import { PeriodControl } from '../../components/period/PeriodControl.jsx';
import { MonthControl } from '../dashboard/OperacionalToolbar.jsx';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';
const IDLE = 'border-border bg-card text-foreground';
const ON = 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';
const TODAS = '__todas__';

// Botão de filtro: ícone, texto e a setinha, aceso quando o filtro está
// ligado. Recebe do Radix (asChild) o ref e os eventos, que vão para o botão.
function FilterButton({ label, icon: Icon, active, text, compact, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn('flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold', FOCUS, active ? ON : IDLE, compact && 'w-full')}
      {...rest}
    >
      <Icon size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} aria-hidden="true" />
      <span className={cn('truncate', compact ? 'flex-1 text-left' : 'max-w-[160px]')}>{text}</span>
      <ChevronDown size={13} strokeWidth={2.2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

// Conteúdo do balão de consultores. Exportado para o teste renderizar sem
// abrir o Popover.
export function ConsultoresMenu({ resp, people, onResp }) {
  const toggle = (id) => onResp(resp.includes(id) ? resp.filter((x) => x !== id) : [...resp, id]);
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-pressed={resp.length === 0}
        onClick={() => onResp([])}
        className={cn(
          'flex h-8 items-center rounded-lg px-2.5 text-left text-[12.5px] font-semibold',
          FOCUS,
          resp.length === 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-foreground hover:bg-muted/70'
        )}
      >
        Equipe toda
      </button>
      <div className="my-1 h-px bg-border" aria-hidden="true" />
      {people.map((p) => (
        <label key={p.id} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] hover:bg-muted/70">
          <Checkbox checked={resp.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.name} />
          <span className="truncate">{p.name}</span>
        </label>
      ))}
    </div>
  );
}

export function ConsultoresControl({ resp, people, onResp, compact = false }) {
  const one = resp.length === 1 ? people.find((p) => p.id === resp[0]) : null;
  const text = resp.length === 0 ? 'Equipe toda' : one ? one.name : `${resp.length} consultores`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton label="Consultores" icon={Users} active={resp.length > 0} text={text} compact={compact} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[264px] p-2">
        <ConsultoresMenu resp={resp} people={people} onResp={onResp} />
      </PopoverContent>
    </Popover>
  );
}

export function OrigemControl({ origem, origens, onOrigem, compact = false }) {
  return (
    <Select value={origem || TODAS} onValueChange={(v) => onOrigem(v === TODAS ? null : v)}>
      <SelectPrimitive.Trigger asChild>
        <FilterButton label="Origem" icon={Filter} active={Boolean(origem)} text={origem || 'Todas as origens'} compact={compact} />
      </SelectPrimitive.Trigger>
      <SelectContent position="popper">
        <SelectItem value={TODAS}>Todas as origens</SelectItem>
        {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function FunilControl({ funnel, funnels, onFunnel, compact = false }) {
  const chosen = funnel !== 'all' ? funnels.find((f) => f.id === funnel) : null;
  return (
    <Select value={funnel} onValueChange={onFunnel}>
      <SelectPrimitive.Trigger asChild>
        <FilterButton label="Funil" icon={Layers} active={Boolean(chosen)} text={chosen ? chosen.name : 'Todos os funis'} compact={compact} />
      </SelectPrimitive.Trigger>
      <SelectContent position="popper">
        <SelectItem value="all">Todos os funis</SelectItem>
        {funnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function RelatoriosToolbar(props) {
  const { period } = props;
  const controls = (compact) => (
    <>
      <PeriodControl period={period} todayKey={props.todayKey} onPeriod={props.onPeriod} onRange={props.onRange} compact={compact} />
      {period.kind === 'mes' && (
        <MonthControl
          monthKey={props.monthKey}
          monthOptions={props.monthOptions}
          onMonth={props.onMonth}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          compact={compact}
        />
      )}
      <ConsultoresControl resp={props.resp} people={props.people} onResp={props.onResp} compact={compact} />
      <OrigemControl origem={props.origem} origens={props.origens} onOrigem={props.onOrigem} compact={compact} />
      <FunilControl funnel={props.funnel} funnels={props.funnels} onFunnel={props.onFunnel} compact={compact} />
    </>
  );
  // A área que rola no App tem recuo (p-4 md:p-8), e o top negativo do mesmo
  // tamanho faz a barra encostar no cabeçalho ao rolar, como a do Operacional.
  return (
    <div className="sticky -top-4 z-30 -mx-4 mb-6 flex items-center gap-2.5 border-b border-border bg-background px-4 py-2.5 md:-top-8 md:mx-0 md:px-0">
      <div className="hidden flex-wrap items-center gap-2.5 md:flex">{controls(false)}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Filtros dos relatórios"
            className={cn('grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground md:hidden', FOCUS)}
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-[288px] flex-col gap-2.5">{controls(true)}</PopoverContent>
      </Popover>
      <span className="num min-w-0 truncate text-[12.5px] font-semibold text-muted-foreground md:hidden">{period.label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Criar a lista ao lado**

Crie `src/views/relatorios/RelatoriosRail.jsx`:

```jsx
// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado"): o título
// de cada grupo e os submenus, com a pergunta de cada um embaixo do nome. No
// computador é uma coluna ao lado do conteúdo, como o trilho de
// Configurações; abaixo de lg vira um seletor no topo. Trocar de submenu é
// onSection, que a tela liga ao goToSub do App, com a query junto. Desenhada
// com a skill frontend-design.
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';

export function RelatoriosRail({ section, onSection }) {
  return (
    <>
      <nav aria-label="Relatórios" className="hidden flex-col gap-5 lg:flex">
        {RELATORIOS_RAIL_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <div className="px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{g.label}</div>
            {g.items.map((it) => {
              const active = it.id === section;
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSection(it.id)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 motion-reduce:transition-none',
                    active ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-muted/70'
                  )}
                >
                  <span className={cn('text-[13.5px] font-semibold', active ? 'text-brand-700 dark:text-brand-300' : 'text-foreground')}>{it.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{it.hint}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="lg:hidden">
        <Select value={section} onValueChange={onSection}>
          <SelectTrigger aria-label="Relatório" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items.map((it) => (
              <SelectItem key={it.id} value={it.id}>{`${g.label} · ${it.label}`}</SelectItem>
            )))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosBarra.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js
npx eslint src/views/relatorios/RelatoriosToolbar.jsx src/views/relatorios/RelatoriosRail.jsx src/lib/__tests__/relatoriosBarra.test.js
```
Expected: `relatoriosBarra.test.js` com `Tests 4 passed (4)`, a varredura passando e o lint sem saída.

- [ ] **Step 6: Commit**

```bash
git add src/views/relatorios/RelatoriosToolbar.jsx src/views/relatorios/RelatoriosRail.jsx src/lib/__tests__/relatoriosBarra.test.js
git commit -m "feat: barra e lista ao lado dos Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 10` arquivos e `B_TESTES + 90` testes.

---

### Task 17: Os dois submenus e a tela

**Files:**
- Create: `src/views/relatorios/EntradaSection.jsx`
- Create: `src/views/relatorios/ConversaoSection.jsx`
- Create: `src/views/relatorios/RelatoriosView.jsx`
- Test: `src/lib/__tests__/relatoriosTela.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/relatoriosTela.test.js`:

```js
// A tela dos Relatórios, sem jsdom (renderToString), com a carga do painel
// trocada pelas fixtures do CRM (setembro de 2026 em andamento, até dia 14 ao
// meio-dia). O relógio é falso para o "agora" da tela cair nessa data.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';

const h = vi.hoisted(() => ({ sources: null }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources: () => h.sources }));

const { RelatoriosView } = await import('../../views/relatorios/RelatoriosView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'relatorios' };
const GESTORA = { id: 'ana', name: 'Ana Ribeiro', role: 'admin', tenantId: 'acad', authUid: 'a1' };
const EQUIPE = [GESTORA, { id: 'diego', name: 'Diego Santos', role: 'consultant', tenantId: 'acad', authUid: 'd1' }];
const ficha = (leadId) => `href="${hrefFor('acad', 'ficha', { leadId })}"`;

const render = (url, props = {}) => renderToString(createElement(MemoryRouter, { initialEntries: [url] },
  createElement(LeadProfileContext.Provider, { value: profile },
    createElement(RelatoriosView, {
      db: {}, appUser: GESTORA, usersList: EQUIPE, funnels: makeCtx().funnels,
      sources: [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação' }],
      liveLeads: [], interactions: [], section: 'entrada', onSection: () => {}, ...props,
    }))));

const noRelogio = () => { vi.useFakeTimers(); vi.setSystemTime(NOW); };
const carregado = () => {
  const c = makeCtx();
  h.sources = { months: c.months, leadsById: c.leadsById, loading: false, failedKeys: [] };
};
afterEach(() => vi.useRealTimers());

describe('tela dos Relatórios', () => {
  it('abre na Entrada de leads do mês, com os recortes, a lista e o exportar', () => {
    noRelogio();
    carregado();
    const out = render('/acad/relatorios');
    expect(out).toContain('Entrada de leads');
    expect(out).toContain('leads novos');
    expect(out).toContain('Por origem');
    expect(out).toContain('Instagram');
    expect(out).toContain('Exportar lista');
    expect(out).toContain(ficha('s4'));
  });

  it('a Conversão mostra a conversão da safra e a lista filtrada pelo número', () => {
    noRelogio();
    carregado();
    const out = render('/acad/relatorios/conversao?recorte=situacao%3Amatricularam', { section: 'conversao' });
    expect(out).toContain('Conversão');
    expect(out).toContain('20%');
    expect(out).toContain('Rapidez do primeiro contato');
    expect(out).toContain('aria-label="Limpar filtro da lista"');
    expect(out).toContain(ficha('s1'));
    expect(out).not.toContain(ficha('s4'));
  });

  it('enquanto carrega, avisa; com mês que falhou, não mostra número', () => {
    noRelogio();
    h.sources = { months: {}, leadsById: new Map(), loading: true, failedKeys: [] };
    expect(render('/acad/relatorios')).toContain('Carregando os números do período.');
    const c = makeCtx();
    h.sources = { months: c.months, leadsById: c.leadsById, loading: false, failedKeys: ['2026-09'] };
    const out = render('/acad/relatorios');
    expect(out).toContain('Não deu para carregar o período.');
    expect(out).not.toContain('leads novos');
  });

  it('quem não pode exportar não vê o botão', () => {
    noRelogio();
    carregado();
    const professor = { id: 'p', role: 'professor', tenantId: 'acad', authUid: 'p1' };
    expect(render('/acad/relatorios', { appUser: professor })).not.toContain('Exportar lista');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/relatoriosTela.test.js`
Expected: FAIL, com `Cannot find module '../../views/relatorios/RelatoriosView.jsx'`.

- [ ] **Step 3: Criar a Entrada de leads**

Crie `src/views/relatorios/EntradaSection.jsx`:

```jsx
// Entrada de leads (spec 2026-10-09, submenu 1): o total com a variação, os
// recortes por origem, consultor e funil, e a lista. Cada linha de recorte
// filtra a lista. Desenhada com a skill frontend-design.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtDate } from '../../lib/relatorios/leads/base.js';
import { ReportHeader, HeroNumber, CountBreakdown, ReportList } from './ReportParts.jsx';

const SITUACAO_TONE = Object.freeze({
  Cliente: 'text-emerald-700 dark:text-emerald-400',
  Perdido: 'text-rose-700 dark:text-rose-400',
});

const COLUMNS = [
  {
    key: 'nome',
    label: 'Nome',
    render: (r) => (
      <LeadLink leadId={r.id} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'origem', label: 'Origem', render: (r) => r.source },
  { key: 'consultor', label: 'Consultor', render: (r) => r.owner },
  { key: 'funil', label: 'Funil', render: (r) => r.funnel },
  { key: 'etapa', label: 'Etapa', render: (r) => r.stage },
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtDate(r.createdAt) },
  {
    key: 'situacao',
    label: 'Situação',
    render: (r) => <span className={cn('font-semibold', SITUACAO_TONE[r.situation])}>{r.situation}</span>,
  },
];

export function EntradaSection({ report, cmp, onCut, exportAction }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Entrada de leads"
        question="Quantos leads chegaram no período, de onde e para qual consultor."
        action={exportAction}
      />
      <HeroNumber
        value={report.total}
        label={report.total === 1 ? 'lead novo' : 'leads novos'}
        delta={report.delta}
        compareText={cmp ? `vs. ${cmp.label}` : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <CountBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por funil" rows={report.byFunnel} cut={report.cut} onCut={onCut} />
      </div>
      <ReportList
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={COLUMNS}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead chegou neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
```

- [ ] **Step 4: Criar a Conversão**

Crie `src/views/relatorios/ConversaoSection.jsx`:

```jsx
// Conversão (spec 2026-10-09, submenu 2): a conversão da safra com a variação,
// os números que filtram a lista (agendaram, vieram, matricularam, perderam,
// em aberto), os recortes por origem, consultor e rapidez do primeiro contato,
// e a lista. Desenhada com a skill frontend-design.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtDuration } from '../../lib/crm/format.js';
import { fmtDate } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL } from '../../lib/relatorios/leads/conversao.js';
import { ReportHeader, HeroNumber, NumberTiles, ConversionBreakdown, ReportList, ReportNotice } from './ReportParts.jsx';

const OUTCOME_TONE = Object.freeze({
  enrolled: 'text-emerald-700 dark:text-emerald-400',
  lost: 'text-rose-700 dark:text-rose-400',
});

const COLUMNS = [
  {
    key: 'nome',
    label: 'Nome',
    render: (r) => (
      <LeadLink leadId={r.id} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'origem', label: 'Origem', render: (r) => r.source },
  { key: 'consultor', label: 'Consultor', render: (r) => r.owner },
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtDate(r.createdAt) },
  {
    key: 'contato',
    label: '1º contato',
    className: 'num whitespace-nowrap',
    render: (r) => (r.firstContactMin == null
      ? <span className="text-muted-foreground">Sem contato</span>
      : fmtDuration(r.firstContactMin)),
  },
  { key: 'agendou', label: 'Agend.', render: (r) => (r.booked ? 'Sim' : 'Não') },
  { key: 'veio', label: 'Veio', render: (r) => (r.attended ? 'Sim' : 'Não') },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => (
      <span className={cn('font-semibold', OUTCOME_TONE[r.outcome])}>
        {r.outcomeAt ? `${OUTCOME_LABEL[r.outcome]} em ${fmtDate(r.outcomeAt)}` : OUTCOME_LABEL[r.outcome]}
      </span>
    ),
  },
];

export function ConversaoSection({ report, cmp, onCut, exportAction, apptsPartial = false }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Conversão"
        question="Dos leads que chegaram no período, quantos viraram matrícula até agora."
        action={exportAction}
      />
      <HeroNumber
        value={report.conversion.value}
        percent
        tone="good"
        label="de conversão da safra"
        delta={report.conversion.delta}
        compareText={cmp ? `vs. ${cmp.label}` : null}
      />
      {apptsPartial && (
        <ReportNotice>
          Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
        </ReportNotice>
      )}
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} />
      <div className="grid gap-4 lg:grid-cols-3">
        <ConversionBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <ConversionBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        <ConversionBreakdown
          title="Rapidez do primeiro contato"
          hint="Do cadastro à primeira conversa registrada."
          rows={report.bySpeed}
          cut={report.cut}
          onCut={onCut}
        />
      </div>
      <ReportList
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={COLUMNS}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead chegou neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
```

- [ ] **Step 5: Criar a tela**

Crie `src/views/relatorios/RelatoriosView.jsx`:

```jsx
// Tela dos Relatórios (spec docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md).
// Hoje, o relatório de Leads, com Entrada de leads e Conversão. O submenu vem
// do endereço (section, a sub-tela que o App lê) e o período e os filtros vêm
// da query (useScreenParams). As contas são as do painel CRM, em
// src/lib/relatorios/leads/, e a carga é a do painel (useCrmSources), com os
// meses do início do comparado até o mês atual. Desenhada com a skill
// frontend-design.
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { ACTIONS, can, isSeller } from '../../lib/acesso.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { useCrmSources } from '../../hooks/useCrmSources.js';
import { screenParamsQuery } from '../../lib/screenParams.js';
import { periodFromParams, previousPeriod } from '../../lib/period.js';
import { addMonthsToKey, dayKeyOf, monthKeyOf, monthLabel } from '../../lib/operacional/month.js';
import { APPTS_COMPLETE_MONTH, leadFunnelsOf } from '../../lib/crm/scope.js';
import { relatoriosSection } from '../../lib/relatoriosRail.js';
import { loadState, reportMonthKeys } from '../../lib/relatorios/leads/janela.js';
import { exportFileName } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport } from '../../lib/relatorios/leads/conversao.js';
import { downloadCsv, toCsv } from '../../lib/csvExport.js';
import { DashedNote } from '../dashboard/CrmParts.jsx';
import { RelatoriosRail } from './RelatoriosRail.jsx';
import { RelatoriosToolbar } from './RelatoriosToolbar.jsx';
import { ExportButton } from './ReportParts.jsx';
import { EntradaSection } from './EntradaSection.jsx';
import { ConversaoSection } from './ConversaoSection.jsx';

const REPORTS = Object.freeze({ entrada: entradaReport, conversao: conversaoReport });

export function RelatoriosView({
  db, appUser, usersList, funnels, sources, liveLeads, interactions, listenersActive = true, section, onSection,
}) {
  // Relógio da tela: vira o minuto (período em andamento e corte do comparado).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const currentKey = monthKeyOf(now);
  const todayKey = dayKeyOf(now);

  // Quem vende entra no filtro de consultores e nos nomes dos recortes.
  const users = useMemo(() => (usersList || []).filter((u) => u?.id && isSeller(u)), [usersList]);
  const people = useMemo(() => users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' })), [users]);
  const leadFunnels = useMemo(() => leadFunnelsOf(funnels), [funnels]);
  const origens = useMemo(
    () => [...new Set((sources || []).map((s) => String(s?.name || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [sources]
  );
  const paramsCtx = useMemo(
    () => ({ currentKey, todayKey, users, podeResp: true, respPadrao: [], funis: leadFunnels, origens }),
    [currentKey, todayKey, users, leadFunnels, origens]
  );
  const [params, setParams] = useScreenParams('relatorios', paramsCtx);
  const { monthKey, periodo, de, ate, resp, origem, funnel, recorte } = params;

  const period = useMemo(() => periodFromParams({ periodo, de, ate, monthKey }, now), [periodo, de, ate, monthKey, now]);
  const cmp = useMemo(() => previousPeriod(period, now), [period, now]);
  // A lista vira texto antes do useMemo: o relógio refaz o período a cada
  // minuto, e a carga só pode mudar quando os meses mudam.
  const keysText = reportMonthKeys(period, cmp, currentKey).join(',');
  const monthKeys = useMemo(() => keysText.split(','), [keysText]);
  const src = useCrmSources({ db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads });
  const load = loadState(src.months, monthKeys);
  const failed = load.failed || (src.failedKeys || []).length > 0;
  const ready = !src.loading && load.ready && !failed;

  const secao = relatoriosSection(section);
  const ctx = useMemo(
    () => ({ now, users, funnels: funnels || [], sources: sources || [], months: src.months, leadsById: src.leadsById }),
    [now, users, funnels, sources, src.months, src.leadsById]
  );
  const funnelId = funnel === 'all' ? null : funnel;
  const report = useMemo(
    () => (ready ? REPORTS[secao](ctx, { period, cmp, userIds: resp, funnelId, origem, recorte }) : null),
    [ready, secao, ctx, period, cmp, resp, funnelId, origem, recorte]
  );

  // Enquanto o período novo carrega, o último resultado do mesmo submenu fica
  // na tela sob o véu. Ajuste de estado no render, guardado por condição, como
  // no painel CRM: o lint react-hooks v7 recusa efeito com setState e ref lido
  // no render.
  const [lastGood, setLastGood] = useState(null);
  if (report && lastGood?.report !== report) setLastGood({ secao, report });
  const shown = report || (!failed && lastGood?.secao === secao ? lastGood.report : null);
  const veiled = !report && Boolean(shown);

  // Trocar de submenu leva o período e os filtros junto, sem o recorte da
  // lista, que é de cada submenu.
  const goSection = (id) => onSection(id, screenParamsQuery('relatorios', { ...params, recorte: null }, paramsCtx));
  const onCut = (code) => setParams({ recorte: code });
  const onPeriod = (kind) => setParams(kind === 'mes'
    ? { periodo: null, de: null, ate: null, monthKey: currentKey }
    : { periodo: kind, de: null, ate: null });
  const onRange = (d, a) => setParams({ periodo: null, de: d, ate: a });
  const shownMonth = period.monthKey || currentKey;
  const oldestKey = addMonthsToKey(currentKey, -11);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );

  const canExport = can(appUser, ACTIONS.RELATORIOS_EXPORTAR);
  const exportable = Boolean(shown) && !veiled && shown.exportRows.length > 0;
  const doExport = () => {
    if (!exportable) return;
    downloadCsv(exportFileName(secao, period), toCsv(shown.exportRows, shown.exportColumns));
  };
  const exportAction = canExport ? <ExportButton onExport={doExport} disabled={!exportable} /> : null;

  return (
    <div className="animate-fade-in flex flex-col gap-6 font-sans lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:sticky lg:top-20 lg:w-[232px] lg:shrink-0">
        <div className="mb-4 lg:px-3">
          <h1 className="m-0 font-display text-[17px] font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">Os números do período e os nomes por trás deles.</p>
        </div>
        <RelatoriosRail section={secao} onSection={goSection} />
      </aside>
      <div className="min-w-0 flex-1">
        <RelatoriosToolbar
          period={period}
          todayKey={todayKey}
          onPeriod={onPeriod}
          onRange={onRange}
          monthKey={shownMonth}
          monthOptions={monthOptions}
          onMonth={(k) => setParams({ monthKey: k })}
          canPrev={shownMonth > oldestKey}
          canNext={shownMonth < currentKey}
          onPrev={() => setParams({ monthKey: addMonthsToKey(shownMonth, -1) })}
          onNext={() => setParams({ monthKey: addMonthsToKey(shownMonth, 1) })}
          resp={resp}
          people={people}
          onResp={(ids) => setParams({ resp: ids })}
          origem={origem}
          origens={origens}
          onOrigem={(v) => setParams({ origem: v })}
          funnel={funnel}
          funnels={leadFunnels}
          onFunnel={(v) => setParams({ funnel: v })}
        />
        {failed ? (
          <DashedNote title="Não deu para carregar o período." text="Confira a internet e abra a tela de novo." />
        ) : !shown ? (
          <p role="status" className="py-12 text-center text-[13px] text-muted-foreground">Carregando os números do período.</p>
        ) : (
          <div
            aria-busy={veiled}
            className={cn('transition-opacity motion-reduce:transition-none', veiled && 'pointer-events-none opacity-35')}
          >
            {secao === 'conversao' ? (
              <ConversaoSection
                report={shown}
                cmp={cmp}
                onCut={onCut}
                exportAction={exportAction}
                apptsPartial={monthKeyOf(period.start) < APPTS_COMPLETE_MONTH}
              />
            ) : (
              <EntradaSection report={shown} cmp={cmp} onCut={onCut} exportAction={exportAction} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/relatoriosTela.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/overscrollGuard.test.js
npx eslint src/views/relatorios src/lib/__tests__/relatoriosTela.test.js
```
Expected: `relatoriosTela.test.js` com `Tests 4 passed (4)`, as três varreduras passando e o lint sem saída.

- [ ] **Step 7: Commit**

```bash
git add src/views/relatorios/EntradaSection.jsx src/views/relatorios/ConversaoSection.jsx src/views/relatorios/RelatoriosView.jsx src/lib/__tests__/relatoriosTela.test.js
git commit -m "feat: tela de Relatórios com Entrada de leads e Conversão" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 11` arquivos e `B_TESTES + 94` testes.

---

### Task 18: O item no menu e a tela no App

**Files:**
- Modify: `src/App.jsx` (import do lucide; import da tela; `goToSub`; menu lateral; tela montada)
- Modify: `src/lib/__tests__/professorShell.test.js` (lista `itens`)
- Modify: `src/lib/__tests__/acessoSweep.test.js` (`LISTAS_DE_QUEM_VENDE`)

- [ ] **Step 1: Atualizar os testes**

Em `src/lib/__tests__/professorShell.test.js`, troque:

```js
      ['dailyGoal', 'Meta diária'], ['leads', 'Leads'], ['suporte', 'Suporte'],
    ];
```

por:

```js
      ['dailyGoal', 'Meta diária'], ['leads', 'Leads'], ['relatorios', 'Relatórios'], ['suporte', 'Suporte'],
    ];
```

Em `src/lib/__tests__/acessoSweep.test.js`, troque:

```js
  // Rotinas: quem pode seguir modelo (routineParticipants).
  'lib/rotinas.js',
];
```

por:

```js
  // Rotinas: quem pode seguir modelo (routineParticipants).
  'lib/rotinas.js',
  // Relatórios: o filtro de consultores e os nomes dos recortes.
  'views/relatorios/RelatoriosView.jsx',
];
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js src/lib/__tests__/acessoSweep.test.js`
Expected: FAIL no `professorShell.test.js` (o menu ainda não tem `label="Relatórios"`). O `acessoSweep.test.js` passa, porque a tela já usa o `isSeller`.

- [ ] **Step 3: Ligar no `src/App.jsx`**

Troque o import do lucide:

```js
import { LayoutDashboard, Users, Plus, AlertTriangle, Activity, X, Menu, Settings, Kanban, Moon, Sun, Target, Globe, LifeBuoy, GraduationCap, ListChecks } from 'lucide-react';
```

por:

```js
import { LayoutDashboard, Users, Plus, AlertTriangle, Activity, X, Menu, Settings, Kanban, Moon, Sun, Target, Globe, LifeBuoy, GraduationCap, ListChecks, ChartColumn } from 'lucide-react';
```

Logo depois de `import { RotinasView } from './views/RotinasView.jsx';`, acrescente:

```js
import { RelatoriosView } from './views/relatorios/RelatoriosView.jsx';
```

Troque o `goToSub`:

```js
  const goToSub = (screen, subId, extra) => {
    const href = hrefFor(sessionTenant, screen, { sub: subId, ...extra });
    if (href) navigate(href, { replace: shown.screen === screen, state: location.state });
  };
```

por:

```js
  // `query` é a dos Relatórios: trocar de submenu leva o período e os filtros
  // junto (screenParamsQuery da tela, sem o recorte da lista).
  const goToSub = (screen, subId, extra, query = '') => {
    const href = hrefFor(sessionTenant, screen, { sub: subId, ...extra });
    if (href) navigate(href + query, { replace: shown.screen === screen, state: location.state });
  };
```

No menu lateral, logo antes da linha que começa com `{nav.suporte && <SidebarItem icon={<LifeBuoy`, acrescente:

```jsx
                {nav.relatorios && <SidebarItem icon={<ChartColumn className="w-[18px] h-[18px]" />} label="Relatórios" href={menuHref('relatorios')} onNavigate={closeDrawer} active={activeTab === 'relatorios'} />}
```

Logo depois da linha `{activeTab === 'visitas' && <AppointmentTrackingView ... appointmentType="visita" />}`, acrescente:

```jsx
              {/* Relatórios (spec 2026-10-09): o submenu vem do endereço (sub), e
                  trocar de submenu leva o período e os filtros junto. */}
              {activeTab === 'relatorios' && <RelatoriosView db={db} appUser={appUser} usersList={usersList} funnels={funnels} sources={sources} liveLeads={metaLeads} interactions={interactions} listenersActive={listenersActive} section={sub} onSection={(id, query) => goToSub('relatorios', id, undefined, query)} />}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npx vitest run src/lib/__tests__/professorShell.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/sidebarNav.test.js
npx eslint src/App.jsx src/lib/__tests__/professorShell.test.js src/lib/__tests__/acessoSweep.test.js
```
Expected: os sete arquivos passando e o lint sem saída.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/lib/__tests__/professorShell.test.js src/lib/__tests__/acessoSweep.test.js
git commit -m "feat: Relatórios no menu lateral" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Suíte inteira: `B_ARQ + 11` arquivos e `B_TESTES + 94` testes.

---

### Task 19: `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (seção nova antes de `## Proteção de erro fora do conteúdo`)

- [ ] **Step 1: Escrever a seção**

Em `CLAUDE.md`, logo antes da linha `## Proteção de erro fora do conteúdo`, acrescente:

```markdown
## Relatórios

A tela de Relatórios (`/<academia>/relatorios`) começa pelo relatório de Leads, com os submenus Entrada de leads e Conversão. Spec em `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md` e plano em `docs/superpowers/plans/2026-10-09-relatorios-de-leads-pr1.md`. O PR 2 traz Visitas e aulas experimentais, Perdas e Leads parados.

- **Menu e endereço.** Item Relatórios no bloco Workspace, abaixo de Leads (`sidebarNav`). `SCREENS.relatorios` com `RELATORIOS_SUBS` (hoje `entrada` e `conversao`) e a lista ao lado em `src/lib/relatoriosRail.js`, que o `relatoriosRail.test.js` confere contra a tabela. `relatorios` é palavra reservada de academia. Submenu novo entra nos dois arquivos.
- **Quem abre.** Gestor e consultor. O professor não: `relatorios` fica fora de `PROFESSOR_SCREENS`. O exportar pergunta a `ACTIONS.RELATORIOS_EXPORTAR`.
- **Período.** `src/lib/period.js` e `src/components/period/PeriodControl.jsx`, na regra da spec do período personalizado de 25/09/2026. Os Relatórios são os primeiros a usar. A Visão geral continua no mês até o período personalizado dela, e o plano dele (branch `claude/periodo-personalizado`) precisa partir desses dois arquivos.
- **Endereço.** `mes`, `periodo`, `de`, `ate`, `resp`, `origem`, `funil` e `recorte`, na tabela de `src/lib/screenParams.js`. O `recorte` é o filtro da lista, no formato `tipo:valor` (`situacao:matricularam`, `origem:Instagram`, `consultor:<id>`, `funil:<id>`, `faixa:ate-1h`), e a conta do submenu ignora o que não existe nele. Trocar de submenu leva a query junto, sem o recorte: o `goToSub` do `App.jsx` recebe a query.
- **Contas.** `src/lib/relatorios/leads/` chama as funções do painel CRM, que ganharam as saídas por lead (`cohortMilestoneOf` e `firstContactMinutesOf`) e a lista de pessoas no `makeScope` (`userIds`). No mês inteiro, os números batem com o `metricsOf`, e os testes de equivalência (`relatoriosLeads.entrada.test.js` e `relatoriosLeads.conversao.test.js`) cobram isso. Mudou uma regra do painel CRM, o relatório muda junto, e o teste mostra se as duas contas se separaram. As fixtures dos dois lados moram em `src/lib/__tests__/fixtures/crmCtx.js`.
- **Carga.** `useCrmSources` com `reportMonthKeys`: do início do comparado até o mês atual, porque a safra da Conversão é acompanhada até agora. A conta só roda com todos os meses carregados, e mês que falhou deixa a tela sem número, com o aviso. Nenhuma consulta nova e nenhum índice.
- **Exportar.** `src/lib/csvExport.js` é a planilha única do app: aspas só quando o valor pede, proteção contra fórmula (o valor que começa com `=`, `+`, `-`, `@`, tab ou retorno de carro ganha um apóstrofo) e BOM no download. Todos os leads e Aulas e Visitas também passam por ela. Exportar novo usa essa função.
- **Visual.** Montado com a skill frontend-design, a pedido do Johnny, no molde dos painéis (`CrmCard`, `DeltaPill`). A lista sempre repete o número de que veio e o filtro aplicado, e cada número e cada linha de recorte é um filtro dessa lista. A barra mostra o mesmo número que está ao lado dela, e matrícula e conversão são verdes.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md com a tela de Relatórios" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Verificação

**Files:** nenhum.

- [ ] **Step 1: Suíte inteira, nos dois fusos**

Run:
```bash
npx vitest run
TZ=UTC npx vitest run
```
Expected: `B_ARQ + 11` arquivos e `B_TESTES + 94` testes, todos passando, nas duas rodadas.

- [ ] **Step 2: Lint e build**

Run:
```bash
npm run lint
npm run build
```
Expected: o lint com `0 errors` e o build terminando sem erro.

- [ ] **Step 3: Conferir a tela com a skill frontend-design**

Com a skill frontend-design carregada, abra a tela num navegador sem tocar no Firestore de produção: pelo harness de tela sem login (memória `harness-navegador-sem-login`, com os fakes do Firebase pelo Vite) ou, se ele não servir, peça ao controlador. Confira, nos dois submenus:
- 1280px e 390px, tema claro e escuro;
- a lista ao lado no computador e o seletor no celular;
- cada atalho do período, o Personalizado e as setas do mês;
- consultores, origem e funil acendendo quando escolhidos;
- clicar num número e numa linha de recorte filtra a lista, e o filtro aparece no cabeçalho dela com o botão de limpar;
- o "Mostrar mais" e o exportar (o arquivo abre no Excel com acentos e sem fórmula executada);
- o foco visível no teclado e nenhuma rolagem lateral na página.

Anote o que precisou de ajuste e corrija antes do PR, com commit próprio.

---

### Task 21: PR

**Files:** nenhum.

- [ ] **Step 1: Enviar o branch**

Run:
```bash
git push -u origin claude/relatorios-de-leads
```

- [ ] **Step 2: Abrir o PR**

Run:
```bash
gh pr create --base main --head claude/relatorios-de-leads --title "feat: Relatórios de Leads, PR 1 (Entrada e Conversão)" --body "$(cat <<'BODY'
## O que muda

O menu lateral ganha o item Relatórios. A tela abre no relatório de Leads, com a lista ao lado e dois submenus:

- **Entrada de leads:** quantos leads chegaram no período, de que origem e para qual consultor, com a lista de nomes.
- **Conversão:** dos leads que chegaram no período, quantos agendaram, vieram, matricularam ou se perderam, e quanto a rapidez do primeiro contato muda a matrícula.

Em cima ficam o período (Hoje, Ontem, Esta semana, Semana passada, Mês e Personalizado), os consultores, a origem e o funil, tudo no endereço. Clicar num número ou numa linha de recorte filtra a lista, e o exportar baixa a lista do jeito que está na tela, com WhatsApp e CPF. Gestor e consultor abrem e exportam; o professor não vê o item.

Os números saem das mesmas contas do painel CRM, e os testes conferem que, no mês inteiro, o relatório e o painel dão o mesmo número. O exportar de Aulas e Visitas passou a ter a proteção contra fórmula que Todos os leads já tinha.

Nada a publicar no Firestore.

Spec: `docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md`

## Para conferir no preview

- [ ] O item Relatórios aparece abaixo de Leads para gestor e consultor
- [ ] Entrada de leads e Conversão batem com a aba CRM da Visão geral no mesmo mês
- [ ] Período, consultores, origem e funil mudam os números e ficam no link (F5 mantém)
- [ ] Clicar num número filtra a lista, e o X do filtro limpa
- [ ] O exportar abre no Excel com acentos
- [ ] Tela no celular e no tema escuro

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

Expected: o link do PR. Não faça merge: o merge é do Johnny, depois de conferir no preview.

---

## O que fica para o PR 2

- `RELATORIOS_SUBS` e a lista ao lado ganham `visitas-e-aulas`, `perdas` e `parados`.
- As contas de Visitas e aulas experimentais (`appointmentsOf`, com a saída por registro), Perdas (`lossesOf` e `lossStagesOf`, com o aviso fixo até o PR 4 da entrega A) e Leads parados (retrato de agora, com o corte `dias` no endereço e sem período na barra).
- A barra recebe `showPeriod` para Leads parados.
