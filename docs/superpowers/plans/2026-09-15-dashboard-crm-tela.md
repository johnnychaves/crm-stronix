# Dashboard CRM · plano da entrega 3 (a tela)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a página "Em breve" da aba CRM pela tela de verdade: o funil de leads por mês de competência, do cadastro até a matrícula, com comparativo, filtro de pessoa e filtro de funil, fiel ao handoff do Claude Design.

**Architecture:** A matemática mora em módulos puros em `src/lib/crm/` (sem React, sem Firestore), com uma função `metricsOf(ctx, { monthKey, userId, funnelId, cutEnd })` que serve ao mês exibido, ao comparado, a cada ponto de tendência e a cada linha da tabela. Um hook carrega as fontes por mês: a parte que o Operacional já carrega (interações, leads criados) vem pela mesma carga e pela mesma memória de sessão, e a parte do CRM (matrículas, perdas e agendamentos) usa três consultas novas de campo único. A tela é portada classe a classe do handoff.

**Tech Stack:** React 19, Vite, Tailwind v4 (tokens em `src/index.css`), shadcn/ui (Select, Checkbox, Popover, Tooltip já instalados), Firebase Firestore (SDK web), Vitest.

**Documentos de referência (ler antes de começar):**
- Especificação aprovada: `docs/superpowers/specs/2026-09-14-dashboard-crm-design.md`
- Handoff (fonte da verdade visual e de textos): `docs/superpowers/specs/handoff-crm/README.md` e `docs/superpowers/specs/handoff-crm/CRM.dc.html`. A marcação da tela de 1440px está nas linhas 89 a 641, o celular nas 643 a 709, os estados nas 711 a 739 e a lógica de exemplo nas 743 a 1544. Os dados de exemplo (PEOPLE, W, CART, STAGES, PROF, SERIES) NÃO são para copiar.
- Tela irmã, já em produção: `src/views/dashboard/DashboardOperacionalView.jsx`, `src/lib/operacional/`, `src/hooks/useOperacionalSources.js`
- Regras do projeto: `CLAUDE.md` da raiz da pasta do Stronilead

---

## Convenções para todas as tarefas

- Testes: `npm test` roda `vitest run`. Um arquivo só: `npx vitest run src/lib/__tests__/<arquivo>.test.js`. A linha de base em 15/09/2026 era 61 arquivos e 1.299 testes passando.
- Lint: `npm run lint` (0 erros; existe 1 aviso antigo no SuperAdminView). Build: `npm run build`.
- Commits em português, formato `tipo: descrição curta`, terminando com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. A branch é `claude/dashboard-crm-screen-cccd05`. Nunca commitar na `main`.
- O hook GateGuard desta máquina pode bloquear o primeiro Bash da sessão e a primeira criação ou edição de cada arquivo, pedindo "fatos" (o pedido do usuário, o que o comando ou o arquivo faz, quem importa o arquivo). Responda os fatos em texto e repita a mesma operação.
- UI nova segue o `CLAUDE.md`: `cn()` para classe condicional, tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`), `flex gap-*` no lugar de `space-*`, `size-N` no lugar de `w-N h-N`, ramp laranja sempre com sufixo (`accent-500`). Cor com variação no escuro segue o padrão da tela irmã (`text-emerald-700 dark:text-emerald-300`, `bg-danger dark:bg-[#E11D48]`).
- Arquivo de componente só exporta componente (regra `react-refresh/only-export-components`). Constante de classe fica local no arquivo (como `RULE` no Operacional) ou em `src/views/dashboard/dashTokens.js`.
- Lint react-hooks v7: nada de `setState` síncrono no corpo de efeito e nada de ler ou escrever `ref.current` durante o render. `setState` dentro de `.then`/`.catch` de promessa pode.
- Todo texto de interface em português do Brasil, sem travessão no meio de frase e sem emoji. Os textos finais estão no README do handoff, §7, com os ajustes listados em "Decisões" abaixo.
- Datas: todo cálculo em horário local. Chave de mês `'YYYY-MM'` (a ordem do texto é a das datas).
- `convertedAt`, `lostAt` e `appointmentScheduledFor` chegam do Firestore como Timestamp: `normalizeLeadDoc` não converte. Leia sempre com `getSafeDateOrNull` (`src/lib/dates.js`). `createdAt` e `nextFollowUp` já chegam como `Date`.

## Decisões desta entrega (entram na descrição da PR)

A spec e o handoff foram aprovados pelo Johnny. Onde eles divergem, ou onde o código real pede ajuste, vale o que está aqui:

1. **Destaques:** os dois do handoff, no lugar da lista de cinco candidatos da spec §3. Um conta os leads que passaram de 24 horas sem primeiro contato, o outro compara o canal de melhor conversão com o mesmo canal no mês comparado. É a rodada de corte do README §1b: o destaque narra o que nenhum card diz. Com o comparativo desligado, ou sem base, o bloco some.
2. **Indicação:** o número da spec §3 (Bloco 2) aparece na linha "Indicação" da tabela de canais, que usa a origem do cadastro. É a equivalência que o README §5 descreve em "Filtro de funil".
3. **"Abrir a lista no Kanban":** fica fora desta entrega. O Kanban não tem filtro de "sem próximo contato", e um atalho para o board inteiro diria uma coisa e faria outra. O texto do card troca "até alguém abrir a lista" por "até alguém marcar o próximo contato".
4. **Card de Perdas:** portado do `.dc.html` (sem ícone, cápsula de 34px, sem rótulo dentro do segmento), e não com o `BreakdownCard` que o README §2 sugere. O `.dc.html` é a fonte da verdade visual, e o próprio README §3 proíbe rótulo dentro do segmento, que o `BreakdownCard` desenha.
5. **Meses carregados:** do mais antigo da tendência (5 meses antes do exibido) até o mês corrente. A safra de um mês fechado é acompanhada até hoje: a matrícula e a perda podem cair num mês seguinte, e o primeiro contato olha o mês seguinte ao do cadastro. O comparado entra sozinho quando é cortado (mês exibido em andamento) e com os meses até o corrente quando não é. No caso comum (mês corrente contra o anterior) são os mesmos 6 meses do Operacional.
6. **Agendamentos do mês corrente:** relidos do servidor a cada abertura da tela (até uns 60 documentos). O desfecho muda o registro sem mudar nenhuma data, então a busca incremental não o enxerga. Matrículas e perdas do mês corrente usam busca incremental, como os leads criados no Operacional.
7. **Lead fora da memória:** os leads citados por agendamento ou por troca de etapa dos meses carregados, que não estão em nenhuma lista, são buscados por id uma vez por sessão, na mesma memória da carteira do Operacional. A spec §6 previa isso só para os agendamentos. Lead apagado vira "desconhecido": entra na equipe toda e em Todos os funis, e na pessoa conta como Outros.
8. **Velocidade:** calculada com os filtros de pessoa e funil, como o README §5 manda fazer na implementação. O rótulo "todos os funis" da seção sai. Professores continuam da academia inteira, com a etiqueta.
9. **Primeiro contato:** "feita por alguém da equipe" vira "qualquer interação registrada, menos as três exclusões da spec" (observação do cadastro, `referral` e `import`). A interação de quem já saiu da equipe continua valendo, porque o contato aconteceu.
10. **Série com pessoa filtrada:** a pessoa tem os mesmos seis meses da equipe. O texto "Três meses de base para esta pessoa" do mockup existia porque o mockup só tinha três meses de dados.
11. **Nota "sem base no sistema" da barra:** sai. O sistema não tem como saber se um mês "existia"; mês sem dado mostra os deltas como "sem base" pela conta.
12. **Carregando:** o fio de progresso e a opacidade de 35% repetem o código do Operacional (barra com `animate-pulse`), para as duas telas irmãs carregarem igual.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/crm/stats.js` (novo) | porcentagem, mediana, mediana com censura à direita, contagem ranqueada |
| `src/lib/crm/format.js` (novo) | duração, dias, plural, nome de mês em texto corrido |
| `src/lib/crm/scope.js` (novo) | datas em que cada base começa, funis de lead, etapas do funil, recorte de pessoa e de funil |
| `src/lib/crm/cohort.js` (novo) | leads novos, matrículas, perdas por motivo, desfecho da safra, canais, dias até a matrícula |
| `src/lib/crm/appointments.js` (novo) | agendamentos e comparecimento do mês, marcos da safra, professores |
| `src/lib/crm/contact.js` (novo) | tempo até o primeiro contato |
| `src/lib/crm/stages.js` (novo) | trocas de etapa gravadas, passagem entre etapas, etapa da perda, carteira agora |
| `src/lib/crm/metrics.js` (novo) | `metricsOf`, diferença, destaques e tendências |
| `src/lib/crm/queries.js` (novo) | consultas do CRM, meses a carregar, busca incremental, leads a buscar por id, versão mais nova de cada lead |
| `src/hooks/monthSources.js` (novo) | carga e memória de sessão dos meses compartilhadas pelo Operacional e pelo CRM (movidas do `useOperacionalSources`) |
| `src/hooks/useOperacionalSources.js` (alterado) | passa a importar a carga compartilhada, sem mudar comportamento |
| `src/hooks/useCrmSources.js` (novo) | fontes do CRM por mês e leads por id |
| `src/views/dashboard/dashTokens.js` (alterado) | tom `accent` e a paleta das perdas |
| `src/views/dashboard/DashSummaryBand.jsx` (alterado) | cor por célula, etiqueta `incompleto`, cartão de série sem base, pílula "sem base" |
| `src/views/dashboard/DashHighlights.jsx` (alterado) | modo com veredito (melhor, pior, igual) e grade do tamanho da lista |
| `src/views/dashboard/OperacionalToolbar.jsx` (alterado) | exporta os controles de mês, comparativo e pessoa |
| `src/views/dashboard/CrmToolbar.jsx` (novo) | barra fixa com os quatro controles |
| `src/views/dashboard/CrmParts.jsx` (novo) | casca de card, título de seção, cartão tracejado, pílula de diferença, legenda, etiqueta |
| `src/views/dashboard/ChannelTable.jsx` (novo) | canais de origem |
| `src/views/dashboard/CohortMilestones.jsx` (novo) | card da safra: passagem e desfecho |
| `src/views/dashboard/StagePassageTable.jsx` (novo) | passagem entre etapas |
| `src/views/dashboard/LossCard.jsx` (novo) | perdas por motivo e etapa em que se perdeu |
| `src/views/dashboard/PeopleConversionTable.jsx` (novo) | conversão por pessoa |
| `src/views/dashboard/ProfessorCard.jsx` (novo) | aulas experimentais por professor |
| `src/views/dashboard/SpeedCards.jsx` (novo) | tempo até o primeiro contato e dias até a matrícula |
| `src/views/dashboard/PipelineNowCards.jsx` (novo) | em jogo agora e sem próximo contato |
| `src/views/dashboard/CrmDashboard.jsx` (novo) | a tela, só apresentação: recebe as métricas prontas e monta textos e seções |
| `src/views/dashboard/DashboardCrmView.jsx` (novo) | estado dos filtros, carga e chamadas de `metricsOf` |
| `src/views/dashboard/DashboardComingSoonView.jsx` (alterado) | fica só com o Gerencial |
| `src/App.jsx` (alterado) | a aba `dashCrm` abre a tela nova |
| `CLAUDE.md` (alterado) | seção do dashboard CRM |
| Testes em `src/lib/__tests__/` | `crm.scope.test.js`, `crm.cohort.test.js`, `crm.appointments.test.js`, `crm.contact.test.js`, `crm.stages.test.js`, `crm.metrics.test.js`, `crm.queries.test.js`, `crm.dashParts.test.js`, `crm.components.test.js`, `crm.dashboard.test.js` |

---

### Task 0: Preparação

**Files:**
- Commit: `docs/superpowers/specs/handoff-crm/` (já copiado do zip, sem o `support.js`) e este plano

- [ ] **Step 1: Conferir a base**

Run: `git status --short && git fetch origin --quiet && git rev-list --count HEAD..origin/main`
Expected: só `docs/superpowers/specs/handoff-crm/` e este plano como não rastreados, e `0` commits atrás da main. Se estiver atrás, rode `git merge origin/main` antes de seguir.

- [ ] **Step 2: Dependências e suíte inteira como linha de base**

Run: `npm install && npm test`
Expected: todos os testes passam (1.299 em 15/09/2026). Anote o total.

- [ ] **Step 3: Commit do handoff e do plano**

```bash
git add docs/superpowers/specs/handoff-crm/ docs/superpowers/plans/2026-09-15-dashboard-crm-tela.md
git commit -m "docs: handoff do Claude Design e plano da tela do CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1: Contas pequenas, formatos e recortes (`stats.js`, `format.js`, `scope.js`)

**Files:**
- Create: `src/lib/crm/stats.js`, `src/lib/crm/format.js`, `src/lib/crm/scope.js`
- Test: `src/lib/__tests__/crm.scope.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { pct, median, medianWithMissing, countBy, rankCounts } from '../crm/stats.js';
import { fmtDuration, fmtDays, plural, monthName } from '../crm/format.js';
import { leadFunnelsOf, funnelStagesOf, makeScope, isClientFunnel, OTHERS_ID } from '../crm/scope.js';

const FUNNELS = [
  { id: 'ren', name: 'Renovações', systemKind: 'renewal', order: 98 },
  { id: 'ind', name: 'Indicações', systemKind: 'referral', order: 2 },
  { id: 'ven', name: 'Vendas', isDefault: true, order: 0 },
  { id: 'upg', name: 'Upgrade', systemKind: 'upgrade', order: 97 },
  { id: 'exp', name: 'Vencidos', systemKind: 'expired', order: 99 }
];
const USERS = [{ id: 'ana' }, { id: 'diego' }];

describe('stats', () => {
  it('pct arredonda e devolve null sem base', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(0, 0)).toBeNull();
  });

  it('mediana de números', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('mediana com os sem valor no fim da fila', () => {
    expect(medianWithMissing([10, 5, 20, null])).toBe(15);
    expect(medianWithMissing([5, 10, null, null])).toBeNull();
    expect(medianWithMissing([null, 30, 10])).toBe(30);
    expect(medianWithMissing([])).toBeNull();
  });

  it('contagem ranqueada, do maior para o menor e empate pelo nome', () => {
    const m = countBy(['b', 'a', 'b', 'c', 'a'], (x) => x);
    expect(rankCounts(m)).toEqual([{ name: 'a', count: 2 }, { name: 'b', count: 2 }, { name: 'c', count: 1 }]);
  });
});

describe('format', () => {
  it('duração em minutos, horas ou dias', () => {
    expect(fmtDuration(null)).toBe('—');
    expect(fmtDuration(42.4)).toBe('42 min');
    expect(fmtDuration(59.6)).toBe('1 h');
    expect(fmtDuration(130)).toBe('2 h 10 min');
    expect(fmtDuration(1440)).toBe('1 dia');
    expect(fmtDuration(5760)).toBe('4 dias');
  });

  it('dias com uma casa e vírgula', () => {
    expect(fmtDays(null)).toBe('—');
    expect(fmtDays(1)).toBe('1 dia');
    expect(fmtDays(6.5)).toBe('6,5 dias');
  });

  it('plural e nome do mês em texto corrido', () => {
    expect(plural(1, 'lead', 'leads')).toBe('1 lead');
    expect(plural(1200, 'lead', 'leads')).toBe('1.200 leads');
    expect(monthName('2026-08', '2026-09')).toBe('agosto');
    expect(monthName('2025-09', '2026-09')).toBe('setembro de 2025');
  });
});

describe('funis', () => {
  it('funis de lead: sem os de cliente, com Indicações, na ordem das Configurações', () => {
    expect(leadFunnelsOf(FUNNELS).map((f) => f.id)).toEqual(['ven', 'ind']);
    expect(isClientFunnel(FUNNELS[0])).toBe(true);
    expect(isClientFunnel(FUNNELS[1])).toBe(false);
  });

  it('etapas do funil na ordem, sem Perda, Venda e etapa de matrícula; etapa sem funil cai no padrão', () => {
    const statuses = [
      { name: 'Negociação', funnelId: 'ven', order: 3 },
      { name: 'Novo lead', order: 0 },
      { name: 'Contato feito', funnelId: 'ven', order: 1 },
      { name: 'Perda', funnelId: 'ven', order: 9 },
      { name: 'Matriculado', funnelId: 'ven', order: 8 },
      { name: 'Aguardando ação', funnelId: 'ind', order: 0 }
    ];
    expect(funnelStagesOf(statuses, 'ven', 'ven')).toEqual(['Novo lead', 'Contato feito', 'Negociação']);
    expect(funnelStagesOf(statuses, 'ind', 'ven')).toEqual(['Aguardando ação']);
  });
});

describe('makeScope', () => {
  const lead = (over) => ({ id: 'x', consultantId: 'ana', funnelId: 'ven', ...over });

  it('sem filtro: todo lead fora dos funis de cliente', () => {
    const s = makeScope({ users: USERS, funnels: FUNNELS });
    expect(s.inScope(lead())).toBe(true);
    expect(s.inScope(lead({ funnelId: 'ren' }))).toBe(false);
    expect(s.inScope(lead({ funnelId: null }))).toBe(true);
    expect(s.defaultFunnelId).toBe('ven');
  });

  it('pessoa: o dono do lead; Outros junta quem não está na equipe', () => {
    const ana = makeScope({ users: USERS, funnels: FUNNELS, userId: 'ana' });
    const others = makeScope({ users: USERS, funnels: FUNNELS, userId: OTHERS_ID });
    expect(ana.inScope(lead())).toBe(true);
    expect(ana.inScope(lead({ consultantId: 'diego' }))).toBe(false);
    expect(others.inScope(lead({ consultantId: 'ex' }))).toBe(true);
    expect(others.inScope(lead())).toBe(false);
  });

  it('funil: o do lead, com o lead sem funil caindo no padrão', () => {
    const ven = makeScope({ users: USERS, funnels: FUNNELS, funnelId: 'ven' });
    const ind = makeScope({ users: USERS, funnels: FUNNELS, funnelId: 'ind' });
    expect(ven.inScope(lead({ funnelId: null }))).toBe(true);
    expect(ind.inScope(lead({ funnelId: null }))).toBe(false);
    expect(ind.inScope(lead({ funnelId: 'ind' }))).toBe(true);
  });

  it('lead desconhecido só entra na equipe toda e em Todos os funis, e conta em Outros', () => {
    const unknown = { id: 'z', unknown: true };
    expect(makeScope({ users: USERS, funnels: FUNNELS }).inScope(unknown)).toBe(true);
    expect(makeScope({ users: USERS, funnels: FUNNELS, userId: 'ana' }).inScope(unknown)).toBe(false);
    expect(makeScope({ users: USERS, funnels: FUNNELS, userId: OTHERS_ID }).inScope(unknown)).toBe(true);
    expect(makeScope({ users: USERS, funnels: FUNNELS, funnelId: 'ven' }).inScope(unknown)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.scope.test.js`
Expected: FAIL, os módulos `../crm/stats.js`, `../crm/format.js` e `../crm/scope.js` não existem.

- [ ] **Step 3: Escrever `src/lib/crm/stats.js`**

```js
// Contas pequenas do CRM. Mediana nunca soma: vem sempre da lista (README do
// handoff §6).

export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// Mediana de números. Lista vazia: null.
export function median(values) {
  const v = (values || []).filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Mediana com os que não têm valor (null) no fim da fila, a censura à direita
// do card de primeiro contato: se o meio da fila cai num sem valor, não existe
// mediana.
export function medianWithMissing(values) {
  const list = values || [];
  const n = list.length;
  if (!n) return null;
  const rank = (x) => (x == null ? Infinity : x);
  const sorted = [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra === rb ? 0 : ra - rb;
  });
  const lo = sorted[Math.ceil(n / 2) - 1];
  const hi = sorted[n % 2 ? Math.ceil(n / 2) - 1 : n / 2];
  if (lo == null || hi == null) return null;
  return (lo + hi) / 2;
}

export function countBy(list, keyOf) {
  const map = new Map();
  (list || []).forEach((x) => {
    const k = keyOf(x);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

// Mapa nome → contagem em lista, do maior para o menor, empate pelo nome.
export function rankCounts(map) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}
```

- [ ] **Step 4: Escrever `src/lib/crm/format.js`**

```js
// Formatos do CRM, usados pelas contas (texto da diferença) e pela tela.

import { fmtNum } from '../format.js';
import { monthLabel } from '../operacional/month.js';

// Minutos em "42 min", "2 h 10 min" ou "4 dias". Arredonda antes de dividir
// para não sair "1 h 60 min".
export function fmtDuration(min) {
  if (min == null || !Number.isFinite(min)) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.round(m / 1440);
  return `${d} ${d === 1 ? 'dia' : 'dias'}`;
}

// Dias com uma casa decimal e vírgula: "6 dias", "6,5 dias".
export function fmtDays(d) {
  if (d == null || !Number.isFinite(d)) return '—';
  const v = Math.round(d * 10) / 10;
  return `${String(v).replace('.', ',')} ${v === 1 ? 'dia' : 'dias'}`;
}

export const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

// Mês em texto corrido: "agosto", ou "setembro de 2025" quando o ano é outro.
export function monthName(key, refKey) {
  const name = monthLabel(key, { capitalized: false, withYear: false });
  return key.slice(0, 4) === refKey.slice(0, 4) ? name : `${name} de ${key.slice(0, 4)}`;
}
```

- [ ] **Step 5: Escrever `src/lib/crm/scope.js`**

```js
// Recortes do CRM: as datas em que cada base começa, os funis de lead, as
// etapas de um funil e o recorte de pessoa e de funil (spec §4, "Recortes").
// Puro.

import { getDefaultFunnel, isItemInFunnel } from '../funnels.js';
import { isConvertedStatusName } from '../leads.js';
import { OTHERS_ID } from '../operacional/routine.js';

export { OTHERS_ID };

// A troca de etapa passou a ser gravada em 14/09/2026 (PR #208). Antes disso
// não há base para a passagem entre etapas nem para a etapa da perda.
export const STAGE_TRACKING_MONTH = '2026-09';

// O histórico de agendamentos (stronix_aulas) só fica completo a partir de
// agosto de 2026. Antes disso agendamentos e comparecimento são parciais.
export const APPTS_COMPLETE_MONTH = '2026-08';

// Funis de cliente (Renovações, Vencidos e Upgrade) ficam fora do CRM. O de
// Indicações é funil de lead e entra. O discriminador é a flag systemKind,
// nunca o nome (src/lib/funnels.js).
const CLIENT_FUNNEL_KINDS = new Set(['renewal', 'expired', 'upgrade']);
export const isClientFunnel = (f) => CLIENT_FUNNEL_KINDS.has(f?.systemKind);

// Funis de lead da academia, na ordem das Configurações.
export const leadFunnelsOf = (funnels) => (funnels || [])
  .filter((f) => f?.id && !isClientFunnel(f))
  .sort((a, b) => (a.order || 0) - (b.order || 0));

// Etapas de um funil na ordem do campo `order`, sem Perda e sem etapa com
// nome de matrícula (Venda, "Matriculado"): a matrícula não é etapa de lead.
// Etapa sem funil cai no funil padrão, como no Kanban.
export function funnelStagesOf(statuses, funnelId, defaultFunnelId) {
  const names = (statuses || [])
    .filter((s) => s?.name && isItemInFunnel(s, funnelId, defaultFunnelId))
    .filter((s) => s.name !== 'Perda' && !isConvertedStatusName(s.name))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((s) => s.name);
  return [...new Set(names)];
}

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
    if (!lead || lead.unknown) return userId === OTHERS_ID;
    return userId === OTHERS_ID ? !team.has(lead.consultantId) : lead.consultantId === userId;
  };
  const funnelOk = (lead) => {
    if (!lead || lead.unknown) return !funnelId;
    if (!funnelId) return !clientIds.has(lead.funnelId);
    return isItemInFunnel(lead, funnelId, defaultFunnelId);
  };
  return { ownerOk, funnelOk, inScope: (lead) => ownerOk(lead) && funnelOk(lead), defaultFunnelId, team };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.scope.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/crm/stats.js src/lib/crm/format.js src/lib/crm/scope.js src/lib/__tests__/crm.scope.test.js
git commit -m "feat: recortes e contas pequenas do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Safra, matrículas, perdas e canais (`cohort.js`)

**Files:**
- Create: `src/lib/crm/cohort.js`
- Test: `src/lib/__tests__/crm.cohort.test.js`

Regras (spec §4): leads novos têm `createdAt` no mês; matrícula tem `convertedAt` no mês; importado (`isImportCreatedLead`) não conta em nenhum dos dois; perda é quem está em Perda hoje (e não é cliente) com `lostAt` no mês. A safra é acompanhada até o instante `asOf` (agora, ou o corte pró-rata). As listas chegam com a versão mais nova de cada lead (Task 6 cuida disso).

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { newLeadsOf, enrollmentsOf, lossesOf, outcomeAt, channelsOf, daysToEnrollOf, convertedAtOf } from '../crm/cohort.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const TS = (date) => ({ toDate: () => date });
const SEP = { start: D(9, 1, 0), end: D(10, 1, 0) };
const all = () => true;

describe('leads novos', () => {
  it('cadastro no mês, sem importado, sem data ausente e sem repetir', () => {
    const leads = [
      { id: 'a', createdAt: D(9, 2) },
      { id: 'a', createdAt: D(9, 2) },
      { id: 'b', createdAt: D(8, 31) },
      { id: 'c', createdAt: D(9, 3), createdAtMissing: true },
      { id: 'd', createdAt: D(9, 4), importBatchId: 'lote', source: 'Importação NextFit' },
      { id: 'e', createdAt: D(9, 5), importBatchId: 'lote', source: 'Instagram' }
    ];
    expect(newLeadsOf(leads, { ...SEP, inScope: all }).map((l) => l.id)).toEqual(['a', 'e']);
  });

  it('respeita o recorte', () => {
    const leads = [{ id: 'a', createdAt: D(9, 2), consultantId: 'ana' }, { id: 'b', createdAt: D(9, 2), consultantId: 'diego' }];
    expect(newLeadsOf(leads, { ...SEP, inScope: (l) => l.consultantId === 'ana' }).map((l) => l.id)).toEqual(['a']);
  });
});

describe('matrículas do mês', () => {
  it('convertedAt no mês (Timestamp ou Date), sem importado e sem carimbo ausente', () => {
    const leads = [
      { id: 'a', convertedAt: TS(D(9, 3)), createdAt: D(8, 1) },
      { id: 'b', convertedAt: D(9, 30, 23), createdAt: D(9, 1) },
      { id: 'c', convertedAt: D(10, 1, 0), createdAt: D(9, 1) },
      { id: 'd', convertedAt: D(9, 5), createdAt: D(9, 1), importSource: 'planilha', source: 'Importação' },
      { id: 'e', status: 'Venda', createdAt: D(9, 2) }
    ];
    expect(enrollmentsOf(leads, { ...SEP, inScope: all }).map((l) => l.id)).toEqual(['a', 'b']);
    expect(convertedAtOf(leads[0])).toEqual(D(9, 3));
  });
});

describe('perdas do mês', () => {
  it('quem está em Perda hoje, com lostAt no mês, por motivo', () => {
    const leads = [
      { id: 'a', status: 'Perda', lostAt: TS(D(9, 2)), lossReason: 'Preço' },
      { id: 'b', status: 'Perda', lostAt: D(9, 3), lossReason: 'Preço' },
      { id: 'c', status: 'Perda', lostAt: D(9, 4), lossReason: '' },
      { id: 'd', status: 'Contato feito', lostAt: D(9, 4), lossReason: 'Preço' },
      { id: 'e', status: 'Perda', lostAt: D(8, 30), lossReason: 'Preço' },
      { id: 'f', status: 'Perda', isConverted: true, lostAt: D(9, 6), lossReason: 'Preço' }
    ];
    expect(lossesOf(leads, { ...SEP, inScope: all })).toEqual({
      total: 3,
      reasons: [{ name: 'Preço', count: 2 }, { name: 'Sem motivo', count: 1 }]
    });
  });
});

describe('desfecho da safra', () => {
  it('matriculou até o instante, perdeu até o instante, ou segue em jogo', () => {
    const asOf = D(9, 14);
    expect(outcomeAt({ convertedAt: D(9, 10) }, asOf)).toBe('enrolled');
    expect(outcomeAt({ convertedAt: D(9, 20) }, asOf)).toBe('open');
    expect(outcomeAt({ status: 'Perda', lostAt: TS(D(9, 5)) }, asOf)).toBe('lost');
    expect(outcomeAt({ status: 'Perda', lostAt: D(9, 20) }, asOf)).toBe('open');
    expect(outcomeAt({ status: 'Contato feito' }, asOf)).toBe('open');
  });
});

describe('canais', () => {
  it('origem do cadastro com a matrícula até o instante, do maior volume para o menor', () => {
    const asOf = D(9, 14);
    const cohort = [
      { id: 'a', source: 'Instagram', convertedAt: D(9, 5) },
      { id: 'b', source: 'Instagram' },
      { id: 'c', source: 'Indicação', convertedAt: D(9, 6) },
      { id: 'd', source: '' },
      { id: 'e', source: 'Instagram', convertedAt: D(9, 20) }
    ];
    expect(channelsOf(cohort, asOf)).toEqual([
      { name: 'Instagram', leads: 3, enrolled: 1 },
      { name: 'Indicação', leads: 1, enrolled: 1 },
      { name: 'Sem origem', leads: 1, enrolled: 0 }
    ]);
  });
});

describe('dias até a matrícula', () => {
  it('dias inteiros do cadastro à matrícula, nas seis faixas, com a mediana', () => {
    const list = [
      { createdAt: D(9, 1, 10), convertedAt: D(9, 1, 18) },
      { createdAt: D(9, 1, 10), convertedAt: D(9, 3, 9) },
      { createdAt: D(9, 1, 10), convertedAt: D(9, 6, 10) },
      { createdAt: D(8, 1, 10), convertedAt: D(9, 12, 10) },
      { createdAt: D(9, 1, 10), convertedAt: D(9, 2, 10), createdAtMissing: true }
    ];
    const r = daysToEnrollOf(list);
    expect(r.total).toBe(4);
    expect(r.buckets).toEqual([2, 0, 1, 0, 0, 1]);
    expect(r.median).toBe(3);
  });

  it('sem matrícula: nada nas faixas e sem mediana', () => {
    expect(daysToEnrollOf([])).toEqual({ total: 0, median: null, buckets: [0, 0, 0, 0, 0, 0] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.cohort.test.js`
Expected: FAIL, `../crm/cohort.js` não existe.

- [ ] **Step 3: Escrever `src/lib/crm/cohort.js`**

```js
// Safra e eventos de lead do CRM (spec §4): leads novos, matrículas, perdas
// por motivo, desfecho da safra num instante, canais e dias até a matrícula.
// Puro. As listas chegam com a versão mais nova de cada lead.

import { getSafeDateOrNull } from '../dates.js';
import { deriveLeadBucket } from '../leadDerived.js';
import { isImportCreatedLead } from '../operacional/routine.js';
import { median, countBy, rankCounts } from './stats.js';

const DAY_MS = 86400000;

const inWindow = (d, start, end) => d instanceof Date && d >= start && d < end;

// Só o carimbo real da matrícula e da perda: nunca cai no cadastro.
export const convertedAtOf = (l) => getSafeDateOrNull(l?.convertedAt);
export const lostAtOf = (l) => getSafeDateOrNull(l?.lostAt);

// Tira repetido por id, mantendo o primeiro.
function unique(list) {
  const seen = new Set();
  return (list || []).filter((l) => {
    if (!l?.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

// Leads novos: cadastrados em [start, end), sem os criados pela importação e
// sem os de data de cadastro ausente (createdAtMissing, o normalizeLeadDoc põe
// "agora" neles).
export const newLeadsOf = (leads, { start, end, inScope }) => unique(leads).filter((l) =>
  !l.createdAtMissing && inWindow(l.createdAt, start, end) && !isImportCreatedLead(l) && inScope(l));

// Matrículas: convertedAt em [start, end), sem os importados.
export const enrollmentsOf = (leads, { start, end, inScope }) => unique(leads).filter((l) =>
  inWindow(convertedAtOf(l), start, end) && !isImportCreatedLead(l) && inScope(l));

// Perdas: quem está em Perda hoje e não é cliente, com lostAt em [start, end),
// por motivo. Perda sem motivo entra em "Sem motivo".
export function lossesOf(leads, { start, end, inScope }) {
  const list = unique(leads).filter((l) =>
    deriveLeadBucket(l) === 'perda' && inWindow(lostAtOf(l), start, end) && inScope(l));
  return { total: list.length, reasons: rankCounts(countBy(list, (l) => String(l.lossReason || '').trim() || 'Sem motivo')) };
}

// Desfecho de um lead da safra no instante asOf.
export function outcomeAt(lead, asOf) {
  const conv = convertedAtOf(lead);
  if (conv && conv <= asOf) return 'enrolled';
  const lost = lostAtOf(lead);
  if (deriveLeadBucket(lead) === 'perda' && lost && lost <= asOf) return 'lost';
  return 'open';
}

// Canais: a origem do cadastro dos leads novos e quantos deles matricularam
// até asOf. Do maior volume para o menor.
export function channelsOf(cohort, asOf) {
  const map = new Map();
  (cohort || []).forEach((l) => {
    const name = String(l.source || '').trim() || 'Sem origem';
    const row = map.get(name) || { name, leads: 0, enrolled: 0 };
    row.leads += 1;
    if (outcomeAt(l, asOf) === 'enrolled') row.enrolled += 1;
    map.set(name, row);
  });
  return [...map.values()].sort((a, b) =>
    b.leads - a.leads || b.enrolled - a.enrolled || a.name.localeCompare(b.name, 'pt-BR'));
}

// Faixas do histograma de dias até a matrícula (handoff, linha 1351).
export const DAYS_BUCKETS = [
  { name: '0 a 1', min: 0, max: 1 },
  { name: '2 a 3', min: 2, max: 3 },
  { name: '4 a 7', min: 4, max: 7 },
  { name: '8 a 14', min: 8, max: 14 },
  { name: '15 a 30', min: 15, max: 30 },
  { name: '31+', min: 31, max: Infinity }
];

// Dias inteiros do cadastro à matrícula das matrículas do mês.
export function daysToEnrollOf(enrollments) {
  const days = (enrollments || [])
    .filter((l) => !l.createdAtMissing && l.createdAt instanceof Date && convertedAtOf(l))
    .map((l) => Math.max(0, Math.floor((convertedAtOf(l) - l.createdAt) / DAY_MS)));
  return {
    total: days.length,
    median: median(days),
    buckets: DAYS_BUCKETS.map((b) => days.filter((d) => d >= b.min && d <= b.max).length)
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.cohort.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/cohort.js src/lib/__tests__/crm.cohort.test.js
git commit -m "feat: safra, matrículas, perdas e canais do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Agendamentos, marcos da safra e professores (`appointments.js`)

**Files:**
- Create: `src/lib/crm/appointments.js`
- Test: `src/lib/__tests__/crm.appointments.test.js`

Regras (spec §4): agendamento é o registro de `stronix_aulas` (aula ou visita) com `scheduledFor` no mês e status diferente de `cancelled`; a janela termina no fim efetivo (agora no mês em andamento), então todo registro contado já tem data passada. Comparecimento = `attended` ÷ (`attended` + `no_show`); o que continua `agendada` é "sem desfecho". Os registros chegam com `scheduledFor` e `createdAt` já em `Date` (o hook converte).

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { appointmentsOf, recordsByLeadOf, cohortMilestones, professorsOf } from '../crm/appointments.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const WIN = { start: D(9, 1, 0), end: D(9, 14, 12) };
const lead = (id, over = {}) => ({ id, consultantId: 'ana', funnelId: 'ven', ...over });
const LEADS = new Map([['a', lead('a')], ['b', lead('b', { consultantId: 'diego' })]]);
const leadOf = (id) => LEADS.get(id) || { id, unknown: true };
const all = () => true;
const R = (id, over) => ({ id, leadId: 'a', type: 'aula', status: 'agendada', scheduledFor: D(9, 2), createdAt: D(8, 30), ...over });

describe('agendamentos do mês', () => {
  const recs = [
    R('1', { status: 'attended' }),
    R('2', { status: 'no_show', leadId: 'b' }),
    R('3', { status: 'agendada', type: 'visita' }),
    R('4', { status: 'cancelled' }),
    R('5', { status: 'attended', scheduledFor: D(9, 20) }),
    R('6', { status: 'attended', scheduledFor: D(8, 31) }),
    R('1', { status: 'attended' })
  ];

  it('visitas e aulas do mês até o fim da janela, sem cancelados, sem repetir', () => {
    expect(appointmentsOf(recs, { ...WIN, leadOf, inScope: all }))
      .toEqual({ total: 3, came: 1, missed: 1, pending: 1, decided: 2, rate: 50 });
  });

  it('pessoa e funil saem do lead do registro', () => {
    expect(appointmentsOf(recs, { ...WIN, leadOf, inScope: (l) => l.consultantId === 'diego' }))
      .toMatchObject({ total: 1, missed: 1, rate: 0 });
  });
});

describe('marcos da safra', () => {
  const asOf = D(9, 14, 12);
  const byLead = recordsByLeadOf([
    R('1', { leadId: 'a', status: 'attended', scheduledFor: D(9, 3) }),
    R('2', { leadId: 'b', status: 'cancelled' }),
    R('3', { leadId: 'c', status: 'agendada', scheduledFor: D(9, 20), createdAt: D(9, 10) }),
    R('4', { leadId: 'd', status: 'agendada', scheduledFor: D(9, 20), createdAt: null }),
    R('5', { leadId: 'e', status: 'no_show', scheduledFor: D(9, 4) })
  ]);
  const cohort = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }));
  cohort[5].appointmentScheduledFor = { toDate: () => D(10, 2) };
  cohort[6].appointmentScheduledFor = D(9, 25);
  cohort[6].appointmentOutcome = 'cancelled';

  it('agendou: registro não cancelado marcado até o instante, ou agendamento em aberto no lead', () => {
    expect(cohortMilestones(cohort, { asOf, cut: false, recordsByLead: byLead })).toEqual({ sched: 4, came: 1 });
  });

  it('no corte pró-rata o agendamento em aberto do lead não conta, porque ele é o de hoje', () => {
    expect(cohortMilestones(cohort, { asOf, cut: true, recordsByLead: byLead })).toEqual({ sched: 3, came: 1 });
  });
});

describe('professores', () => {
  const recs = [
    R('1', { status: 'attended', professorId: 'p1', professorName: 'Paula Nunes', modality: 'Funcional', converted: true }),
    R('2', { status: 'attended', professorId: 'p1', professorName: 'Paula Nunes', modality: 'Musculação' }),
    R('3', { status: 'no_show', professorId: 'p1', professorName: 'Paula Nunes' }),
    R('4', { status: 'attended', professorId: 'p2', professorName: 'Rafael Costa', modality: 'Musculação', converted: true }),
    R('5', { status: 'attended', soloTraining: true, modality: 'Musculação' }),
    R('6', { status: 'attended', type: 'visita', professorId: 'p1' }),
    R('7', { status: 'agendada', professorId: 'p3', professorName: 'Bianca Alves' }),
    R('8', { status: 'attended', professorId: 'p2', professorName: 'Rafael Costa', scheduledFor: D(9, 20) })
  ];

  it('só aulas do mês até o fim da janela; realizadas, faltas, matrículas e modalidade; treina sozinho à parte', () => {
    const r = professorsOf(recs, WIN);
    expect(r.rows.map((p) => [p.name, p.done, p.missed, p.enrolled, p.conv])).toEqual([
      ['Rafael Costa', 1, 0, 1, 100],
      ['Paula Nunes', 2, 1, 1, 50]
    ]);
    expect(r.rows[1].mods).toEqual([{ name: 'Funcional', count: 1 }, { name: 'Musculação', count: 1 }]);
    expect(r.solo).toMatchObject({ name: 'Treina sozinho', done: 1, enrolled: 0, conv: 0 });
    expect(r.done).toBe(4);
  });

  it('mês sem aula: sem linhas, sem treina sozinho', () => {
    expect(professorsOf([], WIN)).toEqual({ rows: [], solo: null, done: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.appointments.test.js`
Expected: FAIL, `../crm/appointments.js` não existe.

- [ ] **Step 3: Escrever `src/lib/crm/appointments.js`**

```js
// Agendamentos do CRM, pela coleção stronix_aulas (visitas e aulas). Puro.
// Aula e visita se separam por isAulaRecord, nunca por where no `type`: o
// registro antigo não tem o campo (src/lib/aulas.js).

import { AULA_STATUS, isAulaRecord } from '../aulas.js';
import { getSafeDateOrNull } from '../dates.js';
import { pct, rankCounts } from './stats.js';

const inWindow = (d, start, end) => d instanceof Date && d >= start && d < end;

// Agendamentos do mês (spec §4, faixa): scheduledFor em [start, end), sem os
// cancelados. Pessoa e funil saem do lead do registro. Um reagendamento move o
// registro, então ele não conta duas vezes.
export function appointmentsOf(records, { start, end, leadOf, inScope }) {
  let came = 0;
  let missed = 0;
  let pending = 0;
  const seen = new Set();
  (records || []).forEach((r) => {
    if (!r?.id || seen.has(r.id)) return;
    seen.add(r.id);
    if (r.status === AULA_STATUS.CANCELLED || !inWindow(r.scheduledFor, start, end)) return;
    if (!inScope(leadOf(r.leadId))) return;
    if (r.status === AULA_STATUS.ATTENDED) came += 1;
    else if (r.status === AULA_STATUS.NO_SHOW) missed += 1;
    else pending += 1;
  });
  const decided = came + missed;
  return { total: came + missed + pending, came, missed, pending, decided, rate: pct(came, decided) };
}

// Registros por lead, sem repetir id. Serve aos marcos da safra, que olham
// todos os meses carregados.
export function recordsByLeadOf(records) {
  const map = new Map();
  const seen = new Set();
  (records || []).forEach((r) => {
    if (!r?.leadId || !r.id || seen.has(r.id)) return;
    seen.add(r.id);
    const list = map.get(r.leadId) || [];
    list.push(r);
    map.set(r.leadId, list);
  });
  return map;
}

// Instante em que o agendamento foi marcado. O registro da carga inicial não
// tem createdAt: vale a data marcada.
const bookedAt = (r) => r.createdAt || r.scheduledFor || null;

// Agendamento em aberto no próprio lead (o espelho do registro atual).
// Reagendado continua em aberto; atendido, falta e cancelado não.
const OPEN_OUTCOMES = new Set([undefined, null, '', 'rescheduled']);
const hasOpenAppointment = (lead) =>
  Boolean(getSafeDateOrNull(lead?.appointmentScheduledFor)) && OPEN_OUTCOMES.has(lead?.appointmentOutcome);

// Marcos da safra no instante asOf (spec §4, "Funil por marcos"). Agendou: tem
// registro não cancelado marcado até asOf, de qualquer mês carregado, ou, sem
// corte, um agendamento em aberto no próprio lead, que cobre a aula marcada
// para depois dos meses carregados. No corte pró-rata o espelho do lead fica
// de fora porque ele é o retrato de hoje. Compareceu: tem registro attended
// com data até asOf. Quem compareceu também agendou.
export function cohortMilestones(cohort, { asOf, cut, recordsByLead }) {
  let sched = 0;
  let came = 0;
  (cohort || []).forEach((l) => {
    const recs = recordsByLead.get(l.id) || [];
    const attended = recs.some((r) => r.status === AULA_STATUS.ATTENDED && r.scheduledFor && r.scheduledFor <= asOf);
    const booked = attended
      || recs.some((r) => r.status !== AULA_STATUS.CANCELLED && bookedAt(r) && bookedAt(r) <= asOf)
      || (!cut && hasOpenAppointment(l));
    if (booked) sched += 1;
    if (attended) came += 1;
  });
  return { sched, came };
}

// Aulas experimentais por professor, da academia inteira (spec §4): registros
// de aula, sem visitas, marcados em [start, end). Realizadas = attended,
// faltas = no_show, matrículas = realizada com `converted` (pickConvertingAula
// marca a última aula atendida antes da matrícula), modalidade das realizadas.
// "Treina sozinho" (soloTraining ou sem professor) vai à parte, fora do
// ranking. Professor sem realizada nem falta no mês não aparece.
export function professorsOf(records, { start, end }) {
  const byProf = new Map();
  let solo = null;
  const seen = new Set();
  const bucket = (id, name, isSolo) => ({ id, name, solo: isSolo, done: 0, missed: 0, enrolled: 0, mods: new Map() });
  (records || []).forEach((r) => {
    if (!r?.id || seen.has(r.id) || !isAulaRecord(r) || !inWindow(r.scheduledFor, start, end)) return;
    seen.add(r.id);
    let b;
    if (r.soloTraining || !r.professorId) {
      if (!solo) solo = bucket(null, 'Treina sozinho', true);
      b = solo;
    } else {
      if (!byProf.has(r.professorId)) byProf.set(r.professorId, bucket(r.professorId, r.professorName || 'Professor', false));
      b = byProf.get(r.professorId);
    }
    if (r.status === AULA_STATUS.ATTENDED) {
      b.done += 1;
      if (r.converted === true) b.enrolled += 1;
      const mod = String(r.modality || '').trim() || 'Sem modalidade';
      b.mods.set(mod, (b.mods.get(mod) || 0) + 1);
    } else if (r.status === AULA_STATUS.NO_SHOW) {
      b.missed += 1;
    }
  });
  const finish = (b) => ({ ...b, conv: pct(b.enrolled, b.done), mods: rankCounts(b.mods) });
  const active = (b) => b.done > 0 || b.missed > 0;
  const rows = [...byProf.values()].filter(active).map(finish)
    .sort((a, b) => (b.conv ?? -1) - (a.conv ?? -1) || b.done - a.done || a.name.localeCompare(b.name, 'pt-BR'));
  const soloRow = solo && active(solo) ? finish(solo) : null;
  const done = rows.reduce((a, b) => a + b.done, 0) + (soloRow ? soloRow.done : 0);
  return { rows, solo: soloRow, done };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.appointments.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/appointments.js src/lib/__tests__/crm.appointments.test.js
git commit -m "feat: agendamentos, marcos da safra e professores do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Tempo até o primeiro contato (`contact.js`)

**Files:**
- Create: `src/lib/crm/contact.js`
- Test: `src/lib/__tests__/crm.contact.test.js`

Regras (spec §4 e Decisão 9): para cada lead novo, o tempo corrido do `createdAt` até a primeira interação dele, olhando as interações até um limite (fim do mês seguinte ao do cadastro, ou o corte). Não contam: a observação do cadastro (`note` que começa com "OBSERVAÇÃO DO CADASTRO:", `isRegistrationNote`), `referral` e `import`. Faixas: até 60 minutos, até 1440, mais que isso e sem contato. A mediana põe os sem contato no fim da fila.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { isContactInteraction, contactTimesByLead, firstContactOf } from '../crm/contact.js';

const T = (d, h = 10, min = 0) => new Date(2026, 8, d, h, min);

describe('interação que conta como contato', () => {
  it('a observação do cadastro, a indicação e a importação não contam', () => {
    expect(isContactInteraction({ type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: veio pelo site' })).toBe(false);
    expect(isContactInteraction({ type: 'referral' })).toBe(false);
    expect(isContactInteraction({ type: 'import' })).toBe(false);
    expect(isContactInteraction({ type: 'note', text: 'Liguei, vai pensar' })).toBe(true);
    expect(isContactInteraction({ type: 'status_change' })).toBe(true);
    expect(isContactInteraction({ type: 'daily_goal_done' })).toBe(true);
  });
});

describe('índice de contatos por lead', () => {
  it('em ordem, sem repetir id e sem data inválida', () => {
    const map = contactTimesByLead([
      { id: '2', leadId: 'a', type: 'note', text: 'b', createdAt: T(3) },
      { id: '1', leadId: 'a', type: 'note', text: 'a', createdAt: T(2) },
      { id: '1', leadId: 'a', type: 'note', text: 'a', createdAt: T(2) },
      { id: '3', leadId: 'a', type: 'referral', createdAt: T(1) },
      { id: '4', leadId: 'b', type: 'note', text: 'x', createdAt: null }
    ]);
    expect(map.get('a')).toEqual([T(2).getTime(), T(3).getTime()]);
    expect(map.has('b')).toBe(false);
  });
});

describe('tempo até o primeiro contato', () => {
  const lead = (id) => ({ id, createdAt: T(1, 10) });
  const contactTimes = contactTimesByLead([
    { id: 'i1', leadId: 'a', type: 'note', text: 'oi', createdAt: T(1, 11) },
    { id: 'i2', leadId: 'b', type: 'note', text: 'oi', createdAt: T(1, 11, 1) },
    { id: 'i3', leadId: 'c', type: 'note', text: 'oi', createdAt: T(2, 10) },
    { id: 'i4', leadId: 'd', type: 'note', text: 'oi', createdAt: T(2, 10, 1) },
    { id: 'i5', leadId: 'e', type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: x', createdAt: T(1, 10, 5) },
    { id: 'i6', leadId: 'f', type: 'note', text: 'depois do prazo', createdAt: T(20, 10) }
  ]);
  const cohort = ['a', 'b', 'c', 'd', 'e', 'f'].map(lead);
  const limit = T(15).getTime();

  it('faixas de até 1 hora, até 24 horas, mais de 24 horas e sem contato', () => {
    expect(firstContactOf(cohort, { contactTimes, limit })).toMatchObject({ total: 6, h1: 1, h24: 2, over: 1, none: 2 });
  });

  it('a mediana põe os sem contato no fim da fila', () => {
    // 60, 61, 1440, 1441, sem, sem: o meio fica entre 1440 e 1441.
    expect(firstContactOf(cohort, { contactTimes, limit }).median).toBe(1440.5);
    // Com mais dois sem contato, o meio cai num sem contato: não há mediana.
    expect(firstContactOf([...cohort, lead('g'), lead('h')], { contactTimes, limit }).median).toBeNull();
  });

  it('com o limite mais longe, a interação passa a contar', () => {
    expect(firstContactOf([lead('f')], { contactTimes, limit: T(30).getTime() })).toMatchObject({ total: 1, over: 1, none: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.contact.test.js`
Expected: FAIL, `../crm/contact.js` não existe.

- [ ] **Step 3: Escrever `src/lib/crm/contact.js`**

```js
// Tempo até o primeiro contato (spec §4): do cadastro até a primeira interação
// registrada do lead. Quem chama passa o limite: o fim do mês seguinte ao do
// cadastro, ou o corte pró-rata. Puro.

import { isRegistrationNote } from '../leads.js';
import { medianWithMissing } from './stats.js';

// Não contam como contato: a observação do cadastro, a indicação e a
// importação. Qualquer outra interação registrada conta, inclusive a de quem
// já saiu da equipe, porque o contato aconteceu.
export const isContactInteraction = (i) => Boolean(i)
  && i.type !== 'referral'
  && i.type !== 'import'
  && !(i.type === 'note' && isRegistrationNote(i.text));

// leadId → instantes (ms) das interações que contam como contato, em ordem.
export function contactTimesByLead(interactions) {
  const map = new Map();
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (!i?.leadId || !(i.createdAt instanceof Date) || !isContactInteraction(i)) return;
    if (i.id) {
      if (seen.has(i.id)) return;
      seen.add(i.id);
    }
    const list = map.get(i.leadId) || [];
    list.push(i.createdAt.getTime());
    map.set(i.leadId, list);
  });
  map.forEach((list) => list.sort((a, b) => a - b));
  return map;
}

// Minutos corridos do cadastro ao primeiro contato de cada lead da safra, só
// com interação em [cadastro, limit). Sem interação no prazo: sem contato.
export function firstContactOf(cohort, { contactTimes, limit }) {
  const values = (cohort || []).map((l) => {
    if (!(l.createdAt instanceof Date)) return null;
    const from = l.createdAt.getTime();
    const t = (contactTimes.get(l.id) || []).find((x) => x >= from && x < limit);
    return t == null ? null : (t - from) / 60000;
  });
  return {
    total: values.length,
    h1: values.filter((v) => v != null && v <= 60).length,
    h24: values.filter((v) => v != null && v > 60 && v <= 1440).length,
    over: values.filter((v) => v != null && v > 1440).length,
    none: values.filter((v) => v == null).length,
    median: medianWithMissing(values)
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.contact.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/contact.js src/lib/__tests__/crm.contact.test.js
git commit -m "feat: tempo até o primeiro contato do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Trocas de etapa, passagem, etapa da perda e carteira agora (`stages.js`)

**Files:**
- Create: `src/lib/crm/stages.js`
- Test: `src/lib/__tests__/crm.stages.test.js`

Regras (spec §4): a passagem usa as trocas gravadas desde a PR #208 (`status_change` com `fromStatus`, `toStatus`, `funnelId` e, na troca de funil, `fromFunnelId`) e as etapas do funil na ordem do campo `order`. Por etapa: **entraram** = trocas do mês para a etapa, no funil; **avançaram** = dessas entradas, as que depois (até `asOf`) foram para etapa de ordem maior no funil ou para matrícula; **perderam** = trocas do mês para Perda saindo da etapa; **mediana** = nas saídas do mês, o tempo desde a entrada na etapa (a troca anterior que levou o lead para lá ou, na primeira etapa, o cadastro), da academia inteira. Etapa que aparece nas trocas e não existe mais no funil (renomeada) entra no fim, com o nome antigo. Troca com `funnelId` vazio é do funil padrão.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { isStageMove, movesByLead, stagePassageOf, lossStagesOf, pipelineNowOf } from '../crm/stages.js';

const T = (d, h = 10) => new Date(2026, 8, d, h);
const MONTH = { start: T(1, 0), end: T(15, 12), asOf: T(15, 12) };
const STAGES = ['Novo lead', 'Contato feito', 'Agendado', 'Negociação'];
const M = (id, leadId, from, to, day, over = {}) => ({
  id, leadId, type: 'status_change', fromStatus: from, toStatus: to, funnelId: 'ven', createdAt: T(day), ...over
});
const LEADS = new Map([
  ['a', { id: 'a', consultantId: 'ana', createdAt: T(1, 9) }],
  ['b', { id: 'b', consultantId: 'diego', createdAt: T(1, 9) }],
  ['c', { id: 'c', consultantId: 'ana', createdAt: T(1, 9), convertedAt: T(12) }]
]);
const leadOf = (id) => LEADS.get(id) || { id, unknown: true };
const all = () => true;
const MOVES = movesByLead([
  M('a1', 'a', 'Novo lead', 'Contato feito', 3),
  M('a2', 'a', 'Contato feito', 'Agendado', 5),
  M('a3', 'a', 'Agendado', 'Perda', 8),
  M('b1', 'b', 'Novo lead', 'Contato feito', 4),
  M('b2', 'b', 'Contato feito', 'Perda', 6),
  M('c1', 'c', 'Novo lead', 'Contato feito', 2),
  M('d1', 'd', 'Novo lead', 'Contato feito', 6, { funnelId: 'ind' }),
  M('e1', 'e', 'Novo lead', 'Visita', 7),
  M('f1', 'f', 'Novo lead', 'Negociação', 9, { funnelId: null })
]);
const passage = (over = {}) => stagePassageOf({
  moves: MOVES, funnelId: 'ven', defaultFunnelId: 'ven', stages: STAGES, ...MONTH, ownerOk: all, leadOf, ...over
});
const table = (r) => r.rows.map((x) => [x.name, x.entered, x.advanced, x.lost, x.medianMin]);

describe('trocas de etapa gravadas', () => {
  it('só status_change com toStatus, em ordem por lead', () => {
    const map = movesByLead([
      M('2', 'a', 'Contato feito', 'Agendado', 5),
      M('1', 'a', 'Novo lead', 'Contato feito', 3),
      { id: '0', leadId: 'a', type: 'status_change', text: 'Movido para a etapa [X] via Kanban.', createdAt: T(2) },
      { id: '9', leadId: 'a', type: 'note', toStatus: 'Agendado', createdAt: T(2) }
    ]);
    expect(map.get('a').map((m) => m.id)).toEqual(['1', '2']);
    expect(isStageMove({ type: 'status_change', toStatus: 'Perda', createdAt: T(1) })).toBe(true);
  });
});

describe('passagem entre etapas', () => {
  it('entraram, avançaram, perderam e a mediana na etapa, com a etapa renomeada no fim', () => {
    const r = passage();
    // Novo lead: saídas de a (49 h), b (73 h) e c (25 h) desde o cadastro.
    expect(table(r)).toEqual([
      ['Novo lead', 0, 0, 0, 2940],
      ['Contato feito', 3, 2, 1, 2880],
      ['Agendado', 1, 0, 1, 4320],
      ['Negociação', 1, 0, 0, null],
      ['Visita', 1, 0, 0, null]
    ]);
    expect(r.worst.name).toBe('Agendado');
  });

  it('com pessoa filtrada as contagens são dela e a mediana continua da academia', () => {
    expect(table(passage({ ownerOk: (l) => l.consultantId === 'ana' }))).toEqual([
      ['Novo lead', 0, 0, 0, 2940],
      ['Contato feito', 2, 2, 0, 2880],
      ['Agendado', 1, 0, 1, 4320],
      ['Negociação', 0, 0, 0, null],
      ['Visita', 0, 0, 0, null]
    ]);
  });

  it('matrícula depois da entrada conta como avanço; avanço depois do corte não conta', () => {
    const moves = movesByLead([M('x1', 'x', 'Novo lead', 'Negociação', 3), M('x2', 'x', 'Negociação', 'Venda', 4)]);
    const row = (asOf) => stagePassageOf({
      moves, funnelId: 'ven', defaultFunnelId: 'ven', stages: STAGES, start: T(1, 0), end: asOf, asOf, ownerOk: all, leadOf
    }).rows.find((x) => x.name === 'Negociação');
    expect(row(T(15, 12))).toMatchObject({ entered: 1, advanced: 1 });
    expect(row(T(3, 12))).toMatchObject({ entered: 1, advanced: 0 });
  });
});

describe('etapa da perda', () => {
  it('o fromStatus das trocas para Perda do mês, no recorte', () => {
    expect(lossStagesOf({ moves: MOVES, start: MONTH.start, end: MONTH.end, inScope: all, leadOf }))
      .toEqual([{ name: 'Agendado', count: 1 }, { name: 'Contato feito', count: 1 }]);
    expect(lossStagesOf({ moves: MOVES, start: MONTH.start, end: MONTH.end, inScope: (l) => l.consultantId === 'diego', leadOf }))
      .toEqual([{ name: 'Contato feito', count: 1 }]);
  });
});

describe('carteira agora', () => {
  const FUNNELS = [{ id: 'ven', name: 'Vendas', order: 0 }, { id: 'ind', name: 'Indicações', order: 1 }];
  const live = [
    { id: '1', status: 'Novo lead', funnelId: 'ven', consultantId: 'ana', nextFollowUp: T(20) },
    { id: '2', status: 'Contato feito', funnelId: 'ven', consultantId: 'ana', nextFollowUp: null },
    { id: '3', status: 'Contato feito', funnelId: null, consultantId: 'diego', nextFollowUp: null },
    { id: '4', status: 'Aguardando ação', funnelId: 'ind', consultantId: 'ana', nextFollowUp: T(21) },
    { id: '5', status: 'Venda', isConverted: true, funnelId: 'ven', consultantId: 'ana' },
    { id: '6', status: 'Perda', funnelId: 'ven', consultantId: 'ana' },
    { id: '7', status: 'Legado', funnelId: 'ven', consultantId: 'ana', nextFollowUp: T(22) },
    { id: '8', status: 'Novo lead', funnelId: 'apagado', consultantId: 'ana', nextFollowUp: T(20) },
    { id: '1', status: 'Novo lead', funnelId: 'ven', consultantId: 'ana', nextFollowUp: T(20) }
  ];

  it('sem funil: por funil de lead, com quem ficou sem funil à parte, e os sem próximo contato', () => {
    const r = pipelineNowOf(live, { funnelId: null, funnels: FUNNELS, defaultFunnelId: 'ven', stages: [], ownerOk: all, funnelOk: all });
    expect(r).toEqual({
      total: 6,
      noNext: 2,
      rows: [
        { id: 'ven', name: 'Vendas', count: 4 },
        { id: 'ind', name: 'Indicações', count: 1 },
        { id: null, name: 'Sem funil', count: 1 }
      ]
    });
  });

  it('com funil: por etapa na ordem do funil, etapa fora da lista no fim', () => {
    const inVen = (l) => !l.funnelId || l.funnelId === 'ven';
    const r = pipelineNowOf(live, {
      funnelId: 'ven', funnels: FUNNELS, defaultFunnelId: 'ven', stages: ['Novo lead', 'Contato feito', 'Negociação'], ownerOk: all, funnelOk: inVen
    });
    expect(r.rows).toEqual([
      { name: 'Novo lead', count: 1 },
      { name: 'Contato feito', count: 2 },
      { name: 'Negociação', count: 0 },
      { name: 'Legado', count: 1 }
    ]);
    expect(r.total).toBe(4);
    expect(r.noNext).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.stages.test.js`
Expected: FAIL, `../crm/stages.js` não existe.

- [ ] **Step 3: Escrever `src/lib/crm/stages.js`**

```js
// Trocas de etapa do CRM (spec §4 e §5): a passagem entre etapas, a etapa em
// que o lead se perdeu e a carteira de agora. As trocas são as interações
// status_change gravadas desde a PR #208, com fromStatus, toStatus, funnelId
// e, na troca de funil, fromFunnelId. O nome da etapa é o da hora da troca.
// Puro.

import { isConvertedStatusName } from '../leads.js';
import { deriveLeadBucket } from '../leadDerived.js';
import { getSafeDateOrNull } from '../dates.js';
import { isItemInFunnel } from '../funnels.js';
import { median, rankCounts } from './stats.js';
import { convertedAtOf } from './cohort.js';

// A troca anterior ao registro (só o texto "Movido para a etapa [X]") não tem
// toStatus e fica de fora.
export const isStageMove = (i) =>
  i?.type === 'status_change' && typeof i.toStatus === 'string' && i.createdAt instanceof Date;

// leadId → trocas em ordem de data, sem repetir id.
export function movesByLead(interactions) {
  const map = new Map();
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (!isStageMove(i) || !i.leadId) return;
    if (i.id) {
      if (seen.has(i.id)) return;
      seen.add(i.id);
    }
    const list = map.get(i.leadId) || [];
    list.push(i);
    map.set(i.leadId, list);
  });
  map.forEach((list) => list.sort((a, b) => a.createdAt - b.createdAt));
  return map;
}

// Passagem entre etapas de um funil no mês [start, end), acompanhada até asOf.
// `ownerOk` recorta entraram, avançaram e perderam pela pessoa; a mediana é da
// academia inteira, porque mediana não soma nem se recorta (README §6).
export function stagePassageOf({ moves, funnelId, defaultFunnelId, stages, start, end, asOf, ownerOk, leadOf }) {
  const inMonth = (m) => m.createdAt >= start && m.createdAt < end;
  const sameFunnel = (id) => id === funnelId || (!id && funnelId === defaultFunnelId);
  const isLeadStage = (name) => Boolean(name) && name !== 'Perda' && !isConvertedStatusName(name);
  const names = [...(stages || [])];
  moves.forEach((list) => list.forEach((m) => {
    if (inMonth(m) && sameFunnel(m.funnelId) && isLeadStage(m.toStatus) && !names.includes(m.toStatus)) names.push(m.toStatus);
  }));
  const orderOf = new Map(names.map((n, i) => [n, i]));
  const rows = new Map(names.map((n) => [n, { entered: 0, advanced: 0, lost: 0, durations: [] }]));

  moves.forEach((list, leadId) => {
    const lead = leadOf(leadId);
    const mine = ownerOk(lead);
    list.forEach((m, idx) => {
      if (!inMonth(m)) return;
      // Entrada na etapa.
      const entry = sameFunnel(m.funnelId) ? rows.get(m.toStatus) : null;
      if (entry && mine) {
        entry.entered += 1;
        const next = list[idx + 1];
        const byMove = Boolean(next) && next.createdAt <= asOf && (isConvertedStatusName(next.toStatus)
          || (sameFunnel(next.funnelId) && (orderOf.get(next.toStatus) ?? -1) > orderOf.get(m.toStatus)));
        const conv = convertedAtOf(lead);
        const byEnroll = Boolean(conv) && conv > m.createdAt && conv <= asOf;
        if (byMove || byEnroll) entry.advanced += 1;
      }
      // Saída da etapa: perda e tempo na etapa.
      const fromFunnel = m.fromFunnelId !== undefined ? m.fromFunnelId : m.funnelId;
      const exit = sameFunnel(fromFunnel) ? rows.get(m.fromStatus) : null;
      if (!exit) return;
      if (m.toStatus === 'Perda' && mine) exit.lost += 1;
      const prev = list.slice(0, idx).reverse().find((x) => x.toStatus === m.fromStatus && sameFunnel(x.funnelId));
      const firstStage = orderOf.get(m.fromStatus) === 0;
      const enteredAt = prev
        ? prev.createdAt
        : (firstStage && lead?.createdAt instanceof Date && !lead.createdAtMissing ? lead.createdAt : null);
      if (enteredAt && m.createdAt >= enteredAt) exit.durations.push((m.createdAt - enteredAt) / 60000);
    });
  });

  const out = names.map((name) => {
    const r = rows.get(name);
    return { name, entered: r.entered, advanced: r.advanced, lost: r.lost, medianMin: median(r.durations) };
  });
  const worst = out.filter((r) => r.entered > 0 && r.lost > 0)
    .sort((a, b) => b.lost / b.entered - a.lost / a.entered || b.lost - a.lost)[0] || null;
  return { rows: out, worst };
}

// Etapa em que o lead foi perdido: o fromStatus das trocas para Perda do mês.
export function lossStagesOf({ moves, start, end, inScope, leadOf }) {
  const map = new Map();
  moves.forEach((list, leadId) => {
    if (!inScope(leadOf(leadId))) return;
    list.forEach((m) => {
      if (m.toStatus !== 'Perda' || m.createdAt < start || m.createdAt >= end) return;
      const name = String(m.fromStatus || '').trim() || 'Sem etapa';
      map.set(name, (map.get(name) || 0) + 1);
    });
  });
  return rankCounts(map);
}

// Carteira agora (spec §4, "Agora"): leads em jogo (balde ativo) neste
// instante. Com um funil, por etapa na ordem do funil, com a etapa que não
// está mais nele no fim; sem funil, por funil de lead, e quem está num funil
// que não existe mais em "Sem funil". Sem próximo contato: em jogo sem
// nextFollowUp, que por isso não aparece na Meta Diária de ninguém.
export function pipelineNowOf(liveLeads, { funnelId, funnels, defaultFunnelId, stages, ownerOk, funnelOk }) {
  const open = [];
  const seen = new Set();
  (liveLeads || []).forEach((l) => {
    if (!l?.id || seen.has(l.id)) return;
    seen.add(l.id);
    if (deriveLeadBucket(l) === 'ativo' && ownerOk(l) && funnelOk(l)) open.push(l);
  });
  let rows;
  if (funnelId) {
    const names = [...(stages || [])];
    open.forEach((l) => { if (l.status && !names.includes(l.status)) names.push(l.status); });
    rows = names.map((name) => ({ name, count: open.filter((l) => l.status === name).length }));
  } else {
    const placed = new Set();
    rows = (funnels || []).map((f) => {
      const inIt = open.filter((l) => isItemInFunnel(l, f.id, defaultFunnelId));
      inIt.forEach((l) => placed.add(l.id));
      return { id: f.id, name: f.name, count: inIt.length };
    }).filter((r) => r.count > 0);
    const rest = open.filter((l) => !placed.has(l.id)).length;
    if (rest > 0) rows.push({ id: null, name: 'Sem funil', count: rest });
  }
  return { total: open.length, rows, noNext: open.filter((l) => !getSafeDateOrNull(l.nextFollowUp)).length };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.stages.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/stages.js src/lib/__tests__/crm.stages.test.js
git commit -m "feat: passagem entre etapas, etapa da perda e carteira agora do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Uma função para tudo (`metrics.js`)

**Files:**
- Create: `src/lib/crm/metrics.js`
- Test: `src/lib/__tests__/crm.metrics.test.js`

`ctx = { now, users, funnels, statuses, liveLeads, leadsById, months }`, com `months[chave] = { interactions, leadsCreated, converted, lost, aulas, failed? }` e `leadsById` com a versão mais nova de cada lead (a Task 9 monta os dois). O corte segue o Operacional: `end = cutEnd || effectiveEnd(mês, now)` e `asOf = end < fim do mês ? end : now` (no corte pró-rata vale o que existia no corte; nos demais casos a safra é acompanhada até agora).

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { metricsOf, crmDelta, bestChannelOf, buildCrmHighlights, seriesOf, OTHERS_ID } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';

const NOW = new Date(2026, 8, 14, 12, 0);
const D = (m, d, h = 10, min = 0) => new Date(2026, m - 1, d, h, min);
const USERS = [{ id: 'ana', name: 'Ana Ribeiro' }, { id: 'diego', name: 'Diego Santos' }];
const FUNNELS = [
  { id: 'ven', name: 'Vendas', isDefault: true, order: 0 },
  { id: 'ind', name: 'Indicações', systemKind: 'referral', order: 1 },
  { id: 'ren', name: 'Renovações', systemKind: 'renewal', order: 98 }
];
const STATUSES = [
  { name: 'Novo lead', funnelId: 'ven', order: 0 },
  { name: 'Contato feito', funnelId: 'ven', order: 1 },
  { name: 'Aguardando ação', funnelId: 'ind', order: 0 }
];
const L = (id, over) => ({ id, consultantId: 'ana', funnelId: 'ven', source: 'Instagram', status: 'Novo lead', createdAt: D(9, 2), ...over });
const N = (id, leadId, at, text = 'Falei com a pessoa') => ({ id, leadId, type: 'note', text, createdAt: at });
const MV = (id, leadId, from, to, at) => ({ id, leadId, type: 'status_change', fromStatus: from, toStatus: to, funnelId: 'ven', createdAt: at });
const A = (id, leadId, status, at, booked, over = {}) => ({ id, leadId, type: 'aula', status, scheduledFor: at, createdAt: booked, ...over });

const s1 = L('s1', { status: 'Venda', isConverted: true, convertedAt: D(9, 5) });
const s2 = L('s2', { consultantId: 'diego', source: 'Indicação', funnelId: 'ind', nextFollowUp: null });
const s3 = L('s3', { status: 'Perda', lostAt: D(9, 6), lossReason: 'Preço' });
const s4 = L('s4', { consultantId: 'diego', createdAt: D(9, 13), nextFollowUp: D(9, 15) });
const s5 = L('s5', { consultantId: 'ex', nextFollowUp: null });
const imp = L('imp', { importBatchId: 'lote', source: 'Importação' });
const ren = L('ren', { funnelId: 'ren' });
const o1 = L('o1', { consultantId: 'diego', createdAt: D(8, 10), status: 'Venda', isConverted: true, convertedAt: D(9, 8) });
const a1 = L('a1', { createdAt: D(8, 3), status: 'Venda', isConverted: true, convertedAt: D(8, 20) });
const a2 = L('a2', { consultantId: 'diego', source: 'Site', createdAt: D(8, 5), nextFollowUp: D(9, 20) });
const a3 = L('a3', { createdAt: D(8, 12), nextFollowUp: null });

// Setembro em andamento (até dia 14, meio-dia) e agosto fechado.
function makeCtx() {
  const everyone = [s1, s2, s3, s4, s5, imp, ren, o1, a1, a2, a3];
  return {
    now: NOW,
    users: USERS,
    funnels: FUNNELS,
    statuses: STATUSES,
    liveLeads: [s2, s4, s5, a2, a3],
    leadsById: new Map(everyone.map((l) => [l.id, l])),
    months: {
      '2026-09': {
        leadsCreated: [s1, s2, s3, s4, s5, imp, ren],
        converted: [s1, o1],
        lost: [s3],
        aulas: [
          A('r1', 's1', 'attended', D(9, 4), D(9, 3), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Funcional', converted: true }),
          A('r2', 's2', 'no_show', D(9, 5), D(9, 3), { type: 'visita' }),
          A('r3', 's4', 'agendada', D(9, 20), D(9, 13), { professorId: 'p1', professorName: 'Paula Nunes' })
        ],
        interactions: [
          N('i1', 's1', D(9, 2, 10, 30)),
          N('i2', 's2', D(9, 3, 12)),
          N('i3', 's3', D(9, 2, 10), 'OBSERVAÇÃO DO CADASTRO: veio pelo Instagram'),
          N('i4', 's5', D(9, 2, 15)),
          MV('m1', 's1', 'Novo lead', 'Contato feito', D(9, 3)),
          MV('m2', 's3', 'Novo lead', 'Contato feito', D(9, 4)),
          MV('m4', 's1', 'Contato feito', 'Venda', D(9, 5)),
          MV('m3', 's3', 'Contato feito', 'Perda', D(9, 6))
        ]
      },
      '2026-08': {
        leadsCreated: [a1, a2, a3, o1],
        converted: [a1],
        lost: [],
        aulas: [A('r4', 'a1', 'attended', D(8, 8), D(8, 6), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Musculação', converted: true })],
        interactions: [N('j1', 'a1', D(8, 3, 10, 20)), N('j2', 'a2', D(8, 7)), N('j3', 'o1', D(8, 10, 10, 45))]
      }
    }
  };
}

describe('metricsOf', () => {
  const ctx = makeCtx();
  const team = metricsOf(ctx, { monthKey: '2026-09' });

  it('faixa do mês em andamento, sem importado e sem funil de cliente', () => {
    expect(team).toMatchObject({ running: true, hasSource: true, leads: 5, enroll: 2, fromCohort: 1 });
    expect(team.appts).toEqual({ total: 2, came: 1, missed: 1, pending: 0, decided: 2, rate: 50 });
    expect(team.cohort).toEqual({ leads: 5, sched: 3, came: 1, enrolled: 1, lost: 1, open: 3, conv: 20 });
    expect(team.channels).toEqual([
      { name: 'Instagram', leads: 4, enrolled: 1 },
      { name: 'Indicação', leads: 1, enrolled: 0 }
    ]);
  });

  it('a equipe é a soma das pessoas e de Outros', () => {
    const parts = ['ana', 'diego', OTHERS_ID].map((userId) => metricsOf(ctx, { monthKey: '2026-09', userId }));
    const sum = (pick) => parts.reduce((a, m) => a + pick(m), 0);
    expect(sum((m) => m.leads)).toBe(team.leads);
    expect(sum((m) => m.enroll)).toBe(team.enroll);
    expect(sum((m) => m.appts.total)).toBe(team.appts.total);
    expect(parts[0].cohort).toMatchObject({ leads: 2, enrolled: 1, lost: 1, conv: 50 });
  });

  it('os funis de lead somados dão Todos os funis', () => {
    const ven = metricsOf(ctx, { monthKey: '2026-09', funnelId: 'ven' });
    const ind = metricsOf(ctx, { monthKey: '2026-09', funnelId: 'ind' });
    expect(ven.leads + ind.leads).toBe(team.leads);
  });

  it('perdas, etapa da perda, primeiro contato e dias até a matrícula', () => {
    expect(team.losses).toEqual({ total: 1, reasons: [{ name: 'Preço', count: 1 }] });
    expect(team.lossStages).toEqual([{ name: 'Contato feito', count: 1 }]);
    expect(team.firstContact).toEqual({ total: 5, h1: 1, h24: 1, over: 2, none: 1, median: 1560 });
    expect(team.daysToEnroll).toEqual({ total: 2, buckets: [0, 1, 0, 0, 1, 0], median: 16 });
  });

  it('passagem só com funil escolhido e só a partir de setembro de 2026', () => {
    expect(team.passage).toBeNull();
    const ven = metricsOf(ctx, { monthKey: '2026-09', funnelId: 'ven' });
    expect(ven.passage.rows.map((r) => [r.name, r.entered, r.advanced, r.lost, r.medianMin])).toEqual([
      ['Novo lead', 0, 0, 0, 2160],
      ['Contato feito', 2, 1, 1, 2880]
    ]);
    const aug = metricsOf(ctx, { monthKey: '2026-08', funnelId: 'ven' });
    expect(aug).toMatchObject({ stageBase: false, passage: null, lossStages: null, apptsBase: true });
  });

  it('carteira agora só no mês em andamento e sem corte', () => {
    expect(team.now).toEqual({
      total: 5,
      noNext: 3,
      rows: [{ id: 'ven', name: 'Vendas', count: 4 }, { id: 'ind', name: 'Indicações', count: 1 }]
    });
    expect(metricsOf(ctx, { monthKey: '2026-08' }).now).toBeNull();
    expect(metricsOf(ctx, { monthKey: '2026-09', cutEnd: D(9, 10) }).now).toBeNull();
  });

  it('professores da academia inteira, iguais com pessoa filtrada', () => {
    expect(team.professors.rows.map((p) => [p.name, p.done, p.enrolled, p.conv])).toEqual([['Paula Nunes', 1, 1, 100]]);
    expect(metricsOf(ctx, { monthKey: '2026-09', userId: 'diego' }).professors).toBe(team.professors);
  });

  it('o comparado pró-rata acompanha a safra só até o corte', () => {
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    expect(cut).toEqual(D(8, 14, 12));
    expect(metricsOf(ctx, { monthKey: '2026-08', cutEnd: cut }).cohort).toMatchObject({ leads: 4, enrolled: 0, conv: 0 });
    expect(metricsOf(ctx, { monthKey: '2026-08' }).cohort).toMatchObject({ leads: 4, enrolled: 2, conv: 50 });
  });

  it('mês sem fonte fica sem número; as marcas de base seguem as datas', () => {
    const jul = metricsOf(ctx, { monthKey: '2026-07' });
    expect(jul).toMatchObject({ hasSource: false, leads: null, appts: null, cohort: null, now: null, apptsBase: false, stageBase: false });
  });

  it('mesmo ctx e mesmo recorte devolvem o mesmo objeto', () => {
    expect(metricsOf(ctx, { monthKey: '2026-09' })).toBe(team);
  });
});

describe('crmDelta', () => {
  it('contagem em %, taxa em p.p., duração e dias', () => {
    expect(crmDelta(56, 48)).toEqual({ up: true, value: expect.any(Number), text: '16,7%' });
    expect(crmDelta(18, 20, { kind: 'pp' })).toMatchObject({ up: false, text: '−2 p.p.' });
    expect(crmDelta(20, 12, { kind: 'pp' })).toMatchObject({ up: true, text: '+8 p.p.' });
    expect(crmDelta(130, 170, { kind: 'min' })).toMatchObject({ up: false, text: '40 min' });
    expect(crmDelta(6, 7.5, { kind: 'days' })).toMatchObject({ up: false, text: '1,5 dias' });
  });

  it('sem base, comparado com zero e igual', () => {
    expect(crmDelta(null, 5)).toEqual({ none: true, text: 'sem base' });
    expect(crmDelta(5, 0)).toEqual({ none: true, text: 'sem base' });
    expect(crmDelta(5, 5)).toEqual({ flat: true, value: 0, text: '= 0%' });
    expect(crmDelta(30, 30, { kind: 'pp' })).toMatchObject({ flat: true, text: '= 0 p.p.' });
  });
});

describe('destaques', () => {
  const ctx = makeCtx();
  const cur = metricsOf(ctx, { monthKey: '2026-09' });
  const cmp = metricsOf(ctx, { monthKey: '2026-08', cutEnd: comparisonCut('2026-09', '2026-08', NOW) });

  it('melhor canal só entre os que trouxeram ao menos 5 leads', () => {
    expect(bestChannelOf(cur)).toBeNull();
    expect(bestChannelOf({ channels: [{ name: 'Site', leads: 5, enrolled: 2 }, { name: 'Instagram', leads: 9, enrolled: 1 }] }))
      .toMatchObject({ name: 'Site', conv: 40 });
  });

  it('leads acima de 24 horas sem contato, com veredito e o pior primeiro no celular', () => {
    expect(buildCrmHighlights(cur, cmp, { cmpName: 'agosto' })).toEqual([{
      text: '3 dos 5 leads passaram de 24 horas sem primeiro contato',
      delta: '▲ 50%',
      tone: 'bad',
      verdict: 'pior que agosto',
      rank: 0
    }]);
  });

  it('sem o comparado não há destaque', () => {
    expect(buildCrmHighlights(cur, null, { cmpName: 'agosto' })).toEqual([]);
    expect(buildCrmHighlights(cur, metricsOf(ctx, { monthKey: '2026-07' }), { cmpName: 'julho' })).toEqual([]);
  });
});

describe('seriesOf', () => {
  it('seis meses até o exibido, sem os meses sem fonte; agendamento só desde agosto de 2026', () => {
    const ctx = makeCtx();
    expect(seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.leads }))
      .toEqual([{ key: '2026-08', value: 4 }, { key: '2026-09', value: 5 }]);
    expect(seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.appts?.total ?? null, apptsBased: true }))
      .toEqual([{ key: '2026-08', value: 1 }, { key: '2026-09', value: 2 }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.metrics.test.js`
Expected: FAIL, `../crm/metrics.js` não existe.

- [ ] **Step 3: Escrever `src/lib/crm/metrics.js`**

```js
// Dashboard CRM: uma função calcula tudo (README do handoff §6). O mês
// exibido, o comparado, cada ponto de tendência e cada linha da tabela chamam
// metricsOf. A fonte é sempre o detalhe; nenhuma taxa nem mediana é guardada.
//
// ctx = { now, users, funnels, statuses, liveLeads, leadsById, months }
//   months[chave] = { interactions, leadsCreated, converted, lost, aulas, failed? }
//   leadsById = a versão mais nova de cada lead conhecido (useCrmSources).

import { fmtNum } from '../format.js';
import { monthRange, effectiveEnd, isCurrentMonthKey, addMonthsToKey } from '../operacional/month.js';
import { pct } from './stats.js';
import { fmtDuration, fmtDays } from './format.js';
import { OTHERS_ID, STAGE_TRACKING_MONTH, APPTS_COMPLETE_MONTH, makeScope, leadFunnelsOf, funnelStagesOf } from './scope.js';
import { newLeadsOf, enrollmentsOf, lossesOf, outcomeAt, channelsOf, daysToEnrollOf } from './cohort.js';
import { appointmentsOf, recordsByLeadOf, cohortMilestones, professorsOf } from './appointments.js';
import { contactTimesByLead, firstContactOf } from './contact.js';
import { movesByLead, stagePassageOf, lossStagesOf, pipelineNowOf } from './stages.js';

export { OTHERS_ID };

// Índices de toda a carga, por ctx (WeakMap: ctx novo, cache novo). Um
// desenho da tela chama metricsOf dezenas de vezes; o resultado fica guardado
// por mês, pessoa, funil e corte, e é compartilhado: não mutar. Trocar um
// insumo no mesmo objeto de ctx zera o cache.
const caches = new WeakMap();

function cacheOf(ctx) {
  const sig = [ctx.now?.getTime(), ctx.users, ctx.funnels, ctx.statuses, ctx.liveLeads, ctx.leadsById, ctx.months];
  let cache = caches.get(ctx);
  if (!cache || cache.sig.some((v, i) => v !== sig[i])) {
    const loaded = Object.values(ctx.months || {});
    const interactions = loaded.flatMap((m) => m.interactions || []);
    cache = {
      sig,
      results: new Map(),
      professors: new Map(),
      moves: movesByLead(interactions),
      contactTimes: contactTimesByLead(interactions),
      recordsByLead: recordsByLeadOf(loaded.flatMap((m) => m.aulas || [])),
      leadFunnels: leadFunnelsOf(ctx.funnels)
    };
    caches.set(ctx, cache);
  }
  return cache;
}

export function metricsOf(ctx, { monthKey, userId = null, funnelId = null, cutEnd = null }) {
  const cache = cacheOf(ctx);
  const key = `${monthKey}|${userId ?? ''}|${funnelId ?? ''}|${cutEnd?.getTime() ?? ''}`;
  const hit = cache.results.get(key);
  if (hit) return hit;
  const value = computeMetrics(ctx, cache, { monthKey, userId, funnelId, cutEnd });
  cache.results.set(key, value);
  return value;
}

// Professores: da academia inteira, iguais para qualquer pessoa e funil.
function professorsOfMonth(cache, src, { monthKey, start, end }) {
  if (!src) return null;
  const key = `${monthKey}|${end.getTime()}`;
  if (!cache.professors.has(key)) cache.professors.set(key, professorsOf(src.aulas, { start, end }));
  return cache.professors.get(key);
}

function computeMetrics(ctx, cache, { monthKey, userId, funnelId, cutEnd }) {
  const { start, end: monthEnd } = monthRange(monthKey);
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  const asOf = end < monthEnd ? end : ctx.now;
  const running = isCurrentMonthKey(monthKey, ctx.now);
  const src = ctx.months?.[monthKey] || null;
  const scope = makeScope({ users: ctx.users, funnels: ctx.funnels, userId, funnelId });
  const stageBase = monthKey >= STAGE_TRACKING_MONTH;
  const base = {
    monthKey,
    running,
    start,
    end,
    asOf,
    hasSource: Boolean(src),
    failed: Boolean(src?.failed),
    apptsBase: monthKey >= APPTS_COMPLETE_MONTH,
    stageBase,
    professors: professorsOfMonth(cache, src, { monthKey, start, end }),
    // Retrato de agora: só no mês em andamento e sem corte.
    now: running && !cutEnd ? pipelineNowOf(ctx.liveLeads, {
      funnelId,
      funnels: cache.leadFunnels,
      defaultFunnelId: scope.defaultFunnelId,
      stages: funnelId ? funnelStagesOf(ctx.statuses, funnelId, scope.defaultFunnelId) : [],
      ownerOk: scope.ownerOk,
      funnelOk: scope.funnelOk
    }) : null
  };
  if (!src) {
    return {
      ...base, leads: null, channels: [], appts: null, enroll: null, fromCohort: null, cohort: null,
      losses: null, lossStages: null, firstContact: null, daysToEnroll: null, passage: null
    };
  }

  const leadOf = (id) => ctx.leadsById?.get(id) || { id, unknown: true };
  const fresh = (list) => (list || []).map((l) => ctx.leadsById?.get(l.id) || l);
  const cohortLeads = newLeadsOf(fresh(src.leadsCreated), { start, end, inScope: scope.inScope });
  const cohortIds = new Set(cohortLeads.map((l) => l.id));
  const enrollments = enrollmentsOf(fresh(src.converted), { start, end, inScope: scope.inScope });
  const outcomes = cohortLeads.map((l) => outcomeAt(l, asOf));
  const enrolled = outcomes.filter((o) => o === 'enrolled').length;
  const lost = outcomes.filter((o) => o === 'lost').length;
  const miles = cohortMilestones(cohortLeads, { asOf, cut: Boolean(cutEnd), recordsByLead: cache.recordsByLead });
  // O primeiro contato olha o mês do cadastro e o seguinte, até o corte.
  const limit = Math.min(asOf.getTime(), monthRange(addMonthsToKey(monthKey, 1)).end.getTime());

  return {
    ...base,
    leads: cohortLeads.length,
    channels: channelsOf(cohortLeads, asOf),
    appts: appointmentsOf(src.aulas, { start, end, leadOf, inScope: scope.inScope }),
    enroll: enrollments.length,
    fromCohort: enrollments.filter((l) => cohortIds.has(l.id)).length,
    cohort: {
      leads: cohortLeads.length,
      sched: miles.sched,
      came: miles.came,
      enrolled,
      lost,
      open: cohortLeads.length - enrolled - lost,
      conv: pct(enrolled, cohortLeads.length)
    },
    losses: lossesOf(fresh(src.lost), { start, end, inScope: scope.inScope }),
    lossStages: stageBase ? lossStagesOf({ moves: cache.moves, start, end, inScope: scope.inScope, leadOf }) : null,
    firstContact: firstContactOf(cohortLeads, { contactTimes: cache.contactTimes, limit }),
    daysToEnroll: daysToEnrollOf(enrollments),
    passage: funnelId && stageBase ? stagePassageOf({
      moves: cache.moves,
      funnelId,
      defaultFunnelId: scope.defaultFunnelId,
      stages: funnelStagesOf(ctx.statuses, funnelId, scope.defaultFunnelId),
      start,
      end,
      asOf,
      ownerOk: scope.ownerOk,
      leadOf
    }) : null
  };
}

const comma = (v) => String(v).replace('.', ',');
const ZERO = { pct: '0%', pp: '0 p.p.', min: '0 min', days: '0 dias' };

// Diferença entre o mês e o comparado no formato do handoff: contagem em %
// ("12,5%"), taxa em pontos ("+8 p.p."), duração ("40 min") e dias ("1,5
// dias"). Sem um dos lados, ou contagem comparada com zero: "sem base".
export function crmDelta(cur, prev, { kind = 'pct' } = {}) {
  if (cur == null || prev == null) return { none: true, text: 'sem base' };
  if (kind === 'pct' && prev === 0) return { none: true, text: 'sem base' };
  const diff = kind === 'pct' ? ((cur - prev) / prev) * 100 : cur - prev;
  if (Math.abs(diff) < 0.05) return { flat: true, value: 0, text: `= ${ZERO[kind]}` };
  const abs = Math.abs(diff);
  let text;
  if (kind === 'pct') text = `${comma(Math.round(abs * 10) / 10)}%`;
  else if (kind === 'pp') text = `${diff > 0 ? '+' : '−'}${comma(Math.round(abs * 10) / 10)} p.p.`;
  else if (kind === 'min') text = fmtDuration(abs);
  else text = fmtDays(abs);
  return { up: diff > 0, value: diff, text };
}

// O canal de melhor conversão da safra, entre os que trouxeram ao menos 5
// leads: com menos, uma matrícula decide a taxa.
export function bestChannelOf(m) {
  return (m?.channels || [])
    .map((c) => ({ ...c, conv: pct(c.enrolled, c.leads) }))
    .filter((c) => c.leads >= 5 && c.conv != null)
    .sort((a, b) => b.conv - a.conv || b.leads - a.leads)[0] || null;
}

// Destaques (Decisão 1 do plano): os leads que passaram de 24 horas sem
// primeiro contato e o canal de melhor conversão, cada um contra o mês
// comparado. Só entra o que tem base dos dois lados. `rank` ordena o
// carrossel do celular com o pior primeiro.
export function buildCrmHighlights(cur, cmp, { cmpName }) {
  if (!cur?.hasSource || !cmp?.hasSource) return [];
  const out = [];
  const add = (text, delta, lowerBetter) => {
    if (!delta || delta.none) return;
    const tone = delta.flat ? 'flat' : (delta.up !== lowerBetter ? 'good' : 'bad');
    out.push({
      text,
      delta: delta.flat ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`,
      tone,
      verdict: tone === 'good' ? `melhor que ${cmpName}` : tone === 'bad' ? `pior que ${cmpName}` : `igual a ${cmpName}`,
      rank: tone === 'bad' ? 0 : tone === 'flat' ? 1 : 2
    });
  };
  const fc = cur.firstContact;
  const pfc = cmp.firstContact;
  if (fc?.total > 0 && pfc) {
    const late = fc.over + fc.none;
    add(
      `${fmtNum(late)} dos ${fmtNum(fc.total)} leads ${late === 1 ? 'passou' : 'passaram'} de 24 horas sem primeiro contato`,
      crmDelta(late, pfc.over + pfc.none, { kind: 'pct' }),
      true
    );
  }
  const best = bestChannelOf(cur);
  if (best) {
    const prev = (cmp.channels || []).find((c) => c.name === best.name);
    add(
      `${best.name} converteu ${best.conv}%, a melhor taxa entre os canais`,
      crmDelta(best.conv, prev ? pct(prev.enrolled, prev.leads) : null, { kind: 'pp' }),
      false
    );
  }
  return out;
}

// Tendência dos `months` meses até o exibido. Mês sem valor fica fora. Nos
// números de agendamento, os meses antes de agosto de 2026 também saem
// (histórico incompleto), e a série encurta.
export function seriesOf(ctx, { monthKey, userId = null, funnelId = null, pick, months = 6, apptsBased = false }) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(addMonthsToKey(monthKey, -i));
  return keys
    .filter((key) => !apptsBased || key >= APPTS_COMPLETE_MONTH)
    .map((key) => ({ key, value: pick(metricsOf(ctx, { monthKey: key, userId, funnelId })) }))
    .filter((p) => p.value != null);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.metrics.test.js`
Expected: PASS. Se algum número divergir, confira primeiro o cenário do teste contra as regras da spec §4 antes de mexer na conta: os números esperados foram calculados à mão a partir delas.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo passa (linha de base + os arquivos `crm.*` novos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/metrics.js src/lib/__tests__/crm.metrics.test.js
git commit -m "feat: metricsOf, destaques e tendências do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Regras da carga do CRM (`crm/queries.js`)

**Files:**
- Create: `src/lib/crm/queries.js`
- Test: `src/lib/__tests__/crm.queries.test.js`

As regras puras do hook da Task 9, no molde de `src/lib/operacional/queries.js` (que já tem `monthWindowSpec`, `unionById`, `shouldStoreMonthEntry` e `NEW_LEADS_SLACK_MS`, todos reaproveitados aqui). Entrada de mês do CRM: `{ closed, converted, lost, aulas, failed?, fetchedAt?, newestConvertedAt?, newestLostAt? }`.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import {
  convertedInMonthSpec, lostInMonthSpec, aulasInMonthSpec, crmMonthKeys, newestTimeOf, currentFieldWindow,
  failedCrmEntry, shouldRememberCrmEntry, mergeCrmCurrent, referencedLeadIds, mergeLeadsById
} from '../crm/queries.js';
import { NEW_LEADS_SLACK_MS } from '../operacional/queries.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const TS = (date) => ({ toDate: () => date });

describe('consultas do CRM', () => {
  it('são de campo único: range e orderBy no mesmo campo, sem igualdade', () => {
    [convertedInMonthSpec(0, 10), lostInMonthSpec(0, 10), aulasInMonthSpec(0, 10)].forEach((s) => {
      expect(new Set(s.wheres.map((w) => w.field))).toEqual(new Set([s.orderBy.field]));
      expect(s.wheres.map((w) => w.op)).toEqual(['>=', '<']);
    });
    expect([convertedInMonthSpec, lostInMonthSpec, aulasInMonthSpec].map((f) => f(0, 10).orderBy.field))
      .toEqual(['convertedAt', 'lostAt', 'scheduledFor']);
  });
});

describe('meses a carregar', () => {
  it('mês corrente contra o anterior: os seis meses da tendência', () => {
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: true, compareKey: '2026-08', currentKey: '2026-09' }))
      .toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('mês corrente contra o mesmo mês do ano anterior: o comparado entra sozinho, porque é cortado', () => {
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: true, compareKey: '2025-09', currentKey: '2026-09' }))
      .toEqual(['2025-09', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('mês fechado: do mais antigo da tendência até o corrente, e do comparado até o corrente', () => {
    expect(crmMonthKeys({ monthKey: '2026-07', compareOn: true, compareKey: '2026-06', currentKey: '2026-09' }))
      .toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(crmMonthKeys({ monthKey: '2026-07', compareOn: true, compareKey: '2025-07', currentKey: '2026-09' })[0]).toBe('2025-07');
  });

  it('sem comparar, o comparado não entra', () => {
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: false, compareKey: '2025-09', currentKey: '2026-09' }))
      .not.toContain('2025-09');
  });
});

describe('busca incremental do mês corrente', () => {
  it('instante mais novo do campo, em Timestamp ou Date', () => {
    expect(newestTimeOf([{ convertedAt: TS(D(9, 3)) }, { convertedAt: D(9, 5) }, {}], 'convertedAt')).toBe(D(9, 5).getTime());
    expect(newestTimeOf([], 'lostAt')).toBeNull();
  });

  it('sem âncora, o mês inteiro; com âncora, desde ela menos a folga, limitada ao instante da busca', () => {
    const start = D(9, 1, 0).getTime();
    const end = D(10, 1, 0).getTime();
    expect(currentFieldWindow('2026-09', null, null)).toEqual({ from: start, to: end });
    const anchor = D(9, 10).getTime();
    expect(currentFieldWindow('2026-09', anchor, D(9, 12).getTime()).from).toBe(anchor - NEW_LEADS_SLACK_MS);
    expect(currentFieldWindow('2026-09', D(9, 20).getTime(), anchor).from).toBe(anchor - NEW_LEADS_SLACK_MS);
    expect(currentFieldWindow('2026-09', start, null).from).toBe(start);
  });
});

describe('entrada do mês corrente', () => {
  const entry = {
    closed: false, converted: [{ id: 'a', v: 1 }], lost: [{ id: 'x' }], aulas: [{ id: 'r1', status: 'agendada' }],
    fetchedAt: 100, newestConvertedAt: 50, newestLostAt: 40
  };

  it('matrículas e perdas unidas por id, agendamentos trocados pelos da busca mais nova', () => {
    const fresh = {
      converted: [{ id: 'a', v: 2, convertedAt: new Date(200) }, { id: 'b', convertedAt: new Date(300) }],
      lost: [],
      aulas: [{ id: 'r1', status: 'attended' }],
      fetchedAt: 400
    };
    const next = mergeCrmCurrent(entry, fresh);
    expect(next.converted).toEqual([{ id: 'a', v: 2, convertedAt: new Date(200) }, { id: 'b', convertedAt: new Date(300) }]);
    expect(next.lost).toEqual([{ id: 'x' }]);
    expect(next.aulas).toEqual([{ id: 'r1', status: 'attended' }]);
    expect(next).toMatchObject({ fetchedAt: 400, newestConvertedAt: 300, newestLostAt: 40 });
  });

  it('busca mais antiga que chega depois só acrescenta; mês fechado e entrada que falhou ficam como estão', () => {
    const old = mergeCrmCurrent(entry, { converted: [{ id: 'a', v: 0 }, { id: 'c' }], lost: [], aulas: [], fetchedAt: 50 });
    expect(old.converted).toEqual([{ id: 'a', v: 1 }, { id: 'c' }]);
    expect(old.aulas).toEqual(entry.aulas);
    expect(old.fetchedAt).toBe(100);
    const closed = { ...entry, closed: true };
    expect(mergeCrmCurrent(closed, { converted: [], lost: [], aulas: [], fetchedAt: 500 })).toBe(closed);
    const failed = failedCrmEntry(false);
    expect(mergeCrmCurrent(failed, { converted: [], lost: [], aulas: [], fetchedAt: 500 })).toBe(failed);
  });

  it('entrada que falhou não vai para a memória da sessão; o mês só anda de aberto para fechado', () => {
    expect(shouldRememberCrmEntry(null, failedCrmEntry(true))).toBe(false);
    expect(shouldRememberCrmEntry(null, { closed: true, converted: [], lost: [], aulas: [] })).toBe(true);
    expect(shouldRememberCrmEntry({ closed: true }, { closed: false, converted: [], lost: [], aulas: [] })).toBe(false);
  });
});

describe('leads a buscar por id e a versão mais nova de cada lead', () => {
  const months = {
    '2026-08': {
      leadsCreated: [{ id: 'a', v: 'criado' }], converted: [{ id: 'b', v: 'ago' }], lost: [],
      aulas: [{ id: 'r1', leadId: 'z' }], interactions: []
    },
    '2026-09': {
      leadsCreated: [], converted: [{ id: 'a', v: 'set' }], lost: [],
      aulas: [{ id: 'r2', leadId: 'a' }],
      interactions: [
        { leadId: 'y', type: 'status_change', toStatus: 'Contato feito' },
        { leadId: 'w', type: 'status_change', text: 'Movido para a etapa [X] via Kanban.' },
        { leadId: 'v', type: 'note' }
      ]
    }
  };

  it('só os citados por agendamento ou por troca de etapa gravada que ninguém conhece', () => {
    expect(referencedLeadIds(months, new Set(['a', 'b']))).toEqual(['y', 'z']);
  });

  it('meses fechados em ordem, depois os buscados por id, o mês corrente e os ao vivo', () => {
    const fetched = new Map([['b', { id: 'b', v: 'por id' }], ['a', { id: 'a', v: 'por id' }], ['q', null]]);
    const map = mergeLeadsById({ months, currentKey: '2026-09', fetched, liveLeads: [{ id: 'c', v: 'vivo' }] });
    expect(map.get('a').v).toBe('set');
    expect(map.get('b').v).toBe('por id');
    expect(map.get('c').v).toBe('vivo');
    expect(map.has('q')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.queries.test.js`
Expected: FAIL, `../crm/queries.js` não existe.

- [ ] **Step 3: Escrever `src/lib/crm/queries.js`**

```js
// Consultas e regras da carga do CRM (hooks/useCrmSources.js). Puras, sem SDK:
// o hook traduz com specToConstraints. As três consultas são de campo único
// (range e orderBy no mesmo campo): índice automático do Firestore, nada a
// publicar. Os três campos são Timestamp, conferido em produção em 14/09/2026.

import { monthWindowSpec, NEW_LEADS_SLACK_MS, unionById, shouldStoreMonthEntry } from '../operacional/queries.js';
import { monthRange, addMonthsToKey } from '../operacional/month.js';
import { getSafeDateOrNull } from '../dates.js';

export const convertedInMonthSpec = (startMs, endMs) => monthWindowSpec('convertedAt', startMs, endMs);
export const lostInMonthSpec = (startMs, endMs) => monthWindowSpec('lostAt', startMs, endMs);
// Aula e visita se separam no navegador (isAulaRecord): juntar `type` com o
// intervalo de scheduledFor pede índice composto e falha com FAILED_PRECONDITION.
export const aulasInMonthSpec = (startMs, endMs) => monthWindowSpec('scheduledFor', startMs, endMs);

// Meses que a tela precisa, em ordem (Decisão 5 do plano). A tendência pede os
// 6 meses até o exibido. A safra de mês fechado é acompanhada até hoje, então
// entram os meses do exibido até o corrente. O comparado, quando é cortado
// (mês exibido em andamento), entra sozinho; quando não é, com os meses até o
// corrente.
export function crmMonthKeys({ monthKey, compareOn, compareKey, currentKey }) {
  const keys = new Set();
  const span = (from, to) => {
    for (let k = from; k <= to; k = addMonthsToKey(k, 1)) keys.add(k);
  };
  span(addMonthsToKey(monthKey, -5), monthKey);
  span(monthKey, currentKey);
  if (compareOn && compareKey) {
    if (monthKey === currentKey) keys.add(compareKey);
    else span(compareKey, currentKey);
  }
  return [...keys].sort();
}

// Maior instante (ms) de um campo de data na lista, ou null.
export function newestTimeOf(list, field) {
  let newest = null;
  (list || []).forEach((x) => {
    const t = getSafeDateOrNull(x?.[field])?.getTime();
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  });
  return newest;
}

// Janela da busca incremental do mês corrente para um campo: desde a âncora
// (o mais novo já devolvido pelo servidor, limitado ao instante da busca, menos
// a folga) até o fim do mês. Sem âncora, o mês inteiro. Mesma regra dos leads
// criados do Operacional (currentMonthLeadsWindow e leadsWindowSince).
export function currentFieldWindow(key, newest, fetchedAt) {
  const { start, end } = monthRange(key);
  let anchor = null;
  if (Number.isFinite(newest)) anchor = Number.isFinite(fetchedAt) ? Math.min(newest, fetchedAt) : newest;
  const from = anchor == null ? start.getTime() : Math.max(start.getTime(), anchor - NEW_LEADS_SLACK_MS);
  return { from, to: end.getTime() };
}

// Busca que falhou em todas as tentativas: o mês entra vazio e marcado, para
// a tela não ficar presa carregando.
export const failedCrmEntry = (closed) => ({ closed, converted: [], lost: [], aulas: [], failed: true });

// Memória da sessão: só entrada completa, e o mês só anda de aberto para fechado.
export const shouldRememberCrmEntry = (prev, next) =>
  Boolean(next) && !next.failed && shouldStoreMonthEntry(prev, next);

const maxOf = (a, b) => {
  const v = [a, b].filter(Number.isFinite);
  return v.length ? Math.max(...v) : null;
};

// Busca do mês corrente entrando na entrada que já estava na memória (Decisão
// 6). Matrículas e perdas se unem por id, e a busca mais recente ganha; os
// agendamentos são trocados pelos da busca mais recente, porque o desfecho
// muda o registro sem mudar nenhuma data e eles vêm inteiros a cada abertura.
// Entrada ausente, de mês fechado ou que falhou fica como está.
export function mergeCrmCurrent(entry, fresh) {
  if (!entry || entry.closed || entry.failed) return entry;
  const newer = !Number.isFinite(entry.fetchedAt) || fresh.fetchedAt >= entry.fetchedAt;
  const join = (older, latest) => (newer ? unionById(older, latest) : unionById(latest, older));
  return {
    ...entry,
    converted: join(entry.converted, fresh.converted),
    lost: join(entry.lost, fresh.lost),
    aulas: newer ? fresh.aulas : entry.aulas,
    fetchedAt: newer ? fresh.fetchedAt : entry.fetchedAt,
    newestConvertedAt: maxOf(entry.newestConvertedAt, newestTimeOf(fresh.converted, 'convertedAt')),
    newestLostAt: maxOf(entry.newestLostAt, newestTimeOf(fresh.lost, 'lostAt'))
  };
}

// Leads citados pelos meses carregados (agendamentos e trocas de etapa
// gravadas) que não estão em `known`. A tela precisa do dono e do funil deles
// (Decisão 7). Em ordem, para a busca ser estável.
export function referencedLeadIds(months, known) {
  const ids = new Set();
  Object.values(months || {}).forEach((m) => {
    (m.aulas || []).forEach((r) => {
      if (r?.leadId && !known.has(r.leadId)) ids.add(r.leadId);
    });
    (m.interactions || []).forEach((i) => {
      if (i?.type === 'status_change' && typeof i.toStatus === 'string' && i.leadId && !known.has(i.leadId)) ids.add(i.leadId);
    });
  });
  return [...ids].sort();
}

// A versão mais nova de cada lead conhecido, da menos fresca para a mais:
// meses fechados em ordem (em cada um, criados, perdidos e matriculados; o
// mês fechado pode ter vindo do cache do aparelho), os buscados por id nesta
// sessão, o mês corrente (do servidor) e os ao vivo do App. Busca por id que
// não achou o lead (null) não entra.
export function mergeLeadsById({ months, currentKey, fetched, liveLeads }) {
  const map = new Map();
  const put = (l) => { if (l?.id) map.set(l.id, l); };
  const putMonth = (m) => {
    if (!m) return;
    (m.leadsCreated || []).forEach(put);
    (m.lost || []).forEach(put);
    (m.converted || []).forEach(put);
  };
  Object.keys(months || {}).sort().filter((k) => k !== currentKey).forEach((k) => putMonth(months[k]));
  (fetched || new Map()).forEach((l) => put(l));
  putMonth(months?.[currentKey]);
  (liveLeads || []).forEach(put);
  return map;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.queries.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/queries.js src/lib/__tests__/crm.queries.test.js
git commit -m "feat: regras da carga do dashboard CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Carga dos meses compartilhada (`hooks/monthSources.js`)

**Files:**
- Create: `src/hooks/monthSources.js`
- Modify: `src/hooks/useOperacionalSources.js:30-114` (imports e as funções de carga e mapas de memória, que mudam de arquivo)

Mudança só de lugar, sem mudar comportamento: as funções de busca e os dois mapas de memória de sessão do `useOperacionalSources` vão para um módulo que o CRM também importa. Assim os dois painéis dividem a mesma memória por academia (spec §6, "Memória compartilhada"). O Operacional está em produção e o hook dele não tem teste: copie o código exatamente como está.

- [ ] **Step 1: Criar `src/hooks/monthSources.js`**

O corpo das funções é o das linhas 45 a 114 do `useOperacionalSources.js` atual, só com `export` na frente do que o CRM ou o Operacional usam de fora.

```js
// Carga e memória de sessão dos meses, compartilhadas pelo Operacional
// (useOperacionalSources) e pelo CRM (useCrmSources): as interações, os leads
// criados e o histórico de metas de cada mês, e os leads buscados por id. O
// que um dos painéis carregou na sessão serve ao outro. Não é hook: são as
// buscas e os mapas de memória, fora do estado porque as telas desmontam a
// cada troca de aba.

import { collection, getCountFromServer, getDocsFromCache, query } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints, getDocsWithAuthRetry } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDate } from '../lib/dates.js';
import { monthRange, addMonthsToKey } from '../lib/operacional/month.js';
import {
  interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistoryInMonthSpec, loadWithCountCheck,
  currentMonthLeadsWindow, docsFromServerOrThrow, newestCreatedAtOf
} from '../lib/operacional/queries.js';

export const colRef = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

const mapInteraction = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
};

export const mapHistory = (d) => d.data();

// Busca que precisa do servidor: resposta do cache do aparelho é falha.
export const serverDocs = async (q) => docsFromServerOrThrow(await getDocsWithAuthRetry(q));

// Consulta de mês fechado: cache local conferido pela contagem do servidor.
export const cachedOrServer = (q, mapDoc) => loadWithCountCheck({
  fromCache: async () => (await getDocsFromCache(q)).docs.map(mapDoc),
  fromServer: async () => (await serverDocs(q)).map(mapDoc),
  countOnServer: async () => (await getCountFromServer(q)).data().count
}).then((r) => r.docs);

// Com a regra antiga do histórico publicada (cada um lê só o próprio), a
// consulta do mês inteiro é negada. O mês fica sem histórico (null) e quem
// cobre é a assinatura dos docs da pessoa (historyScope 'own').
const unlessDenied = (promise) => promise.catch((e) => {
  if (e?.code === 'permission-denied') return null;
  throw e;
});

// Leads criados no mês corrente, direto do servidor, na janela da busca: o mês
// inteiro na primeira vez; depois, só desde a âncora (leadsWindowSince), menos
// a folga. Devolve junto o instante da busca.
export async function loadCurrentLeads(db, key, since = null) {
  const { from, to } = currentMonthLeadsWindow(key, since);
  const q = query(colRef(db, LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(from, to)));
  const fetchedAt = Date.now();
  const leads = (await serverDocs(q)).map(normalizeLeadDoc);
  return { leads, fetchedAt };
}

// Uma tentativa de carga do mês. Aberto: só os leads criados, direto do
// servidor (interações e histórico vêm ao vivo). Fechado: interações, leads
// criados e histórico, pelo cache conferido.
export async function loadMonth(db, key, closed) {
  if (!closed) {
    const { leads, fetchedAt } = await loadCurrentLeads(db, key);
    return {
      closed, interactions: null, leadsCreated: leads, history: null, fetchedAt,
      newestCreatedAt: newestCreatedAtOf(leads)
    };
  }
  const { start, end } = monthRange(key);
  const [from, to] = [start.getTime(), end.getTime()];
  const qL = query(colRef(db, LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(from, to)));
  const qI = query(colRef(db, INTERACTIONS_PATH), ...specToConstraints(interactionsInMonthSpec(from, to)));
  const qH = query(
    colRef(db, DAILY_GOAL_HISTORY_PATH),
    ...specToConstraints(goalHistoryInMonthSpec(`${key}-01`, `${addMonthsToKey(key, 1)}-01`))
  );
  const [interactions, leadsCreated, history] = await Promise.all([
    cachedOrServer(qI, mapInteraction),
    cachedOrServer(qL, normalizeLeadDoc),
    unlessDenied(cachedOrServer(qH, mapHistory))
  ]);
  return { closed, interactions, leadsCreated, history };
}

// Leads buscados por id e entradas de mês já lidos nesta sessão do navegador,
// por academia (appId). Ficam fora do estado dos hooks porque as telas
// desmontam ao trocar de aba, e cada abertura leria tudo de novo.
export const carteiraDaSessao = new Map();
export const mesesDaSessao = new Map();
```

- [ ] **Step 2: Trocar o topo do `useOperacionalSources.js`**

O comentário de cabeçalho (linhas 1 a 28) fica. Substitua tudo da linha 30 (`import { useEffect, useMemo, useRef, useState } from 'react';`) até a linha 114 (`const mesesDaSessao = new Map();`), inclusive, por:

```js
import { useEffect, useMemo, useRef, useState } from 'react';
import { documentId, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { monthRange, monthKeyOf } from '../lib/operacional/month.js';
import {
  goalHistorySinceSpec, retryWithBackoff, retryDelayMs, monthEntryFits, shouldStoreMonthEntry, failedMonthEntry,
  shouldRememberMonthEntry, monthsFromSession, mergeNewLeads, leadsWindowSince, monthHistory,
  chunk, leadIdsForRenewal
} from '../lib/operacional/queries.js';
// Busca dos meses e memória da sessão, divididas com o CRM (monthSources.js).
import { colRef, mapHistory, serverDocs, loadCurrentLeads, loadMonth, carteiraDaSessao, mesesDaSessao } from './monthSources.js';
```

Nada abaixo da linha 114 muda: o corpo do hook já usa exatamente esses nomes.

- [ ] **Step 3: Conferir que nada ficou duplicado nem órfão**

Run: `grep -nE "const (colRef|mapInteraction|mapHistory|serverDocs|cachedOrServer|unlessDenied|carteiraDaSessao|mesesDaSessao)|function (loadCurrentLeads|loadMonth)" src/hooks/useOperacionalSources.js`
Expected: nenhuma linha.

Run: `npm run lint`
Expected: 0 erros (o lint acusa import sem uso e nome sem definição).

- [ ] **Step 4: Suíte e build**

Run: `npm test && npm run build`
Expected: tudo passa e o build termina sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/monthSources.js src/hooks/useOperacionalSources.js
git commit -m "refactor: carga e memória de sessão dos meses num módulo compartilhado" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Fontes do CRM (`hooks/useCrmSources.js`)

**Files:**
- Create: `src/hooks/useCrmSources.js`

O hook segue o molde do `useOperacionalSources` (mesmos padrões de efeito, guarda de "já carregado", novas tentativas e memória de sessão) e usa as regras puras das Tasks 7 e 8. O projeto não tem testing-library, então a verificação aqui é lint, build e o teste ao vivo da Task 17; toda regra com decisão mora em `src/lib/crm/queries.js`, que tem teste.

Saída: `{ months, leadsById, loading, failedKeys }`, com `months[chave] = { interactions, leadsCreated, converted, lost, aulas, failed? }` só para os meses em que as duas partes (a compartilhada e a do CRM) já valem.

- [ ] **Step 1: Escrever `src/hooks/useCrmSources.js`**

```js
// Fontes do CRM por mês.
//
// Parte compartilhada com o Operacional: interações, leads criados e histórico
// de metas do mês, pela mesma carga e pela mesma memória de sessão
// (monthSources.js). O que um dos painéis carregou serve ao outro. O mês
// corrente usa as interações ao vivo do App e une os leads criados ao vivo.
//
// Parte do CRM, por mês: leads por convertedAt, leads por lostAt e registros
// de stronix_aulas por scheduledFor, as três de campo único (índice
// automático). Mês fechado: cache do aparelho conferido por contagem no
// servidor. Mês corrente: do servidor; na volta à tela, matrículas e perdas
// vêm pela busca incremental e os agendamentos vêm inteiros, porque o desfecho
// muda o registro sem mudar nenhuma data (crm/queries.js, mergeCrmCurrent).
//
// Leads citados por agendamento ou por troca de etapa que não estão em
// nenhuma lista são buscados por id, do servidor, uma vez por sessão, na
// mesma memória da carteira do Operacional. Quem não existe mais fica como
// desconhecido e conta em Outros.

import { useEffect, useMemo, useRef, useState } from 'react';
import { documentId, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, AULAS_PATH } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { monthRange, monthKeyOf } from '../lib/operacional/month.js';
import {
  retryWithBackoff, monthEntryFits, shouldStoreMonthEntry, shouldRememberMonthEntry, failedMonthEntry,
  monthsFromSession, leadsWindowSince, mergeNewLeads, chunk
} from '../lib/operacional/queries.js';
import {
  convertedInMonthSpec, lostInMonthSpec, aulasInMonthSpec, currentFieldWindow, newestTimeOf,
  failedCrmEntry, shouldRememberCrmEntry, mergeCrmCurrent, referencedLeadIds, mergeLeadsById
} from '../lib/crm/queries.js';
import { colRef, serverDocs, cachedOrServer, loadMonth, loadCurrentLeads, carteiraDaSessao, mesesDaSessao } from './monthSources.js';

const mapAula = (d) => {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    scheduledFor: getSafeDateOrNull(data.scheduledFor),
    createdAt: getSafeDateOrNull(data.createdAt),
    outcomeAt: getSafeDateOrNull(data.outcomeAt),
    convertedAt: getSafeDateOrNull(data.convertedAt)
  };
};

const leadsQuery = (db, spec) => query(colRef(db, LEADS_PATH), ...specToConstraints(spec));
const aulasQuery = (db, spec) => query(colRef(db, AULAS_PATH), ...specToConstraints(spec));

// Mês corrente, do servidor. Com a entrada da memória, matrículas e perdas vêm
// desde as âncoras dela; sem, o mês inteiro. Os agendamentos vêm sempre inteiros.
async function loadCrmCurrent(db, key, entry = null) {
  const { start, end } = monthRange(key);
  const winC = currentFieldWindow(key, entry?.newestConvertedAt, entry?.fetchedAt);
  const winL = currentFieldWindow(key, entry?.newestLostAt, entry?.fetchedAt);
  const fetchedAt = Date.now();
  const [converted, lost, aulas] = await Promise.all([
    serverDocs(leadsQuery(db, convertedInMonthSpec(winC.from, winC.to))).then((docs) => docs.map(normalizeLeadDoc)),
    serverDocs(leadsQuery(db, lostInMonthSpec(winL.from, winL.to))).then((docs) => docs.map(normalizeLeadDoc)),
    serverDocs(aulasQuery(db, aulasInMonthSpec(start.getTime(), end.getTime()))).then((docs) => docs.map(mapAula))
  ]);
  return { converted, lost, aulas, fetchedAt };
}

// Uma tentativa de carga da parte do CRM de um mês.
async function loadCrmMonth(db, key, closed) {
  if (!closed) {
    const fresh = await loadCrmCurrent(db, key);
    return {
      closed,
      ...fresh,
      newestConvertedAt: newestTimeOf(fresh.converted, 'convertedAt'),
      newestLostAt: newestTimeOf(fresh.lost, 'lostAt')
    };
  }
  const { start, end } = monthRange(key);
  const [from, to] = [start.getTime(), end.getTime()];
  const [converted, lost, aulas] = await Promise.all([
    cachedOrServer(leadsQuery(db, convertedInMonthSpec(from, to)), normalizeLeadDoc),
    cachedOrServer(leadsQuery(db, lostInMonthSpec(from, to)), normalizeLeadDoc),
    cachedOrServer(aulasQuery(db, aulasInMonthSpec(from, to)), mapAula)
  ]);
  return { closed, converted, lost, aulas };
}

// Memória de sessão da parte do CRM, por academia (appId).
const crmMesesDaSessao = new Map();

export function useCrmSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads }) {
  const currentKey = monthKeyOf(now);

  // --- parte compartilhada: mesma carga e mesma memória do Operacional.
  const [shared, setShared] = useState(() => monthsFromSession(mesesDaSessao.get(appId), currentKey));
  const sharedLoadingRef = useRef(new Set());
  const sharedRefreshedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    if (!mesesDaSessao.has(tenant)) mesesDaSessao.set(tenant, new Map());
    const memory = mesesDaSessao.get(tenant);
    const store = (key, entry) => {
      if (shouldRememberMonthEntry(memory.get(key), entry)) memory.set(key, entry);
      setShared((prev) => (shouldStoreMonthEntry(prev[key], entry) ? { ...prev, [key]: entry } : prev));
    };
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      const entry = shared[key];
      if (monthEntryFits(entry, key, currentKey)) {
        // Mês corrente que veio da memória: busca só os leads criados desde a
        // âncora, uma vez por montagem. Se falhar, fica o que já estava.
        if (!closed && !entry.failed && !sharedRefreshedRef.current.has(key)) {
          sharedRefreshedRef.current.add(key);
          retryWithBackoff(() => loadCurrentLeads(db, key, leadsWindowSince(entry)))
            .then(({ leads, fetchedAt }) => {
              if (memory.has(key)) memory.set(key, mergeNewLeads(memory.get(key), leads, fetchedAt));
              setShared((prev) => {
                const next = mergeNewLeads(prev[key], leads, fetchedAt);
                return next === prev[key] ? prev : { ...prev, [key]: next };
              });
            })
            .catch((e) => console.error('crm leads novos', key, e));
        }
        return;
      }
      const slot = `${key}:${closed ? 'fechado' : 'aberto'}`;
      if (sharedLoadingRef.current.has(slot)) return;
      sharedLoadingRef.current.add(slot);
      if (!closed) sharedRefreshedRef.current.add(key);
      retryWithBackoff(() => loadMonth(db, key, closed))
        .catch((e) => {
          console.error('crm fontes compartilhadas', key, e);
          return failedMonthEntry(closed);
        })
        .then((next) => store(key, next))
        .finally(() => sharedLoadingRef.current.delete(slot));
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- parte do CRM: matrículas, perdas e agendamentos de cada mês.
  const [crm, setCrm] = useState(() => monthsFromSession(crmMesesDaSessao.get(appId), currentKey));
  const crmLoadingRef = useRef(new Set());
  const crmRefreshedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    if (!crmMesesDaSessao.has(tenant)) crmMesesDaSessao.set(tenant, new Map());
    const memory = crmMesesDaSessao.get(tenant);
    const store = (key, entry) => {
      if (shouldRememberCrmEntry(memory.get(key), entry)) memory.set(key, entry);
      setCrm((prev) => (shouldStoreMonthEntry(prev[key], entry) ? { ...prev, [key]: entry } : prev));
    };
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      const entry = crm[key];
      if (monthEntryFits(entry, key, currentKey)) {
        // Mês corrente que veio da memória: matrículas e perdas novas e os
        // agendamentos de novo, uma vez por montagem. Se falhar, fica o que já estava.
        if (!closed && !entry.failed && !crmRefreshedRef.current.has(key)) {
          crmRefreshedRef.current.add(key);
          retryWithBackoff(() => loadCrmCurrent(db, key, entry))
            .then((fresh) => {
              if (memory.has(key)) memory.set(key, mergeCrmCurrent(memory.get(key), fresh));
              setCrm((prev) => {
                const next = mergeCrmCurrent(prev[key], fresh);
                return next === prev[key] ? prev : { ...prev, [key]: next };
              });
            })
            .catch((e) => console.error('crm mês corrente', key, e));
        }
        return;
      }
      const slot = `${key}:${closed ? 'fechado' : 'aberto'}`;
      if (crmLoadingRef.current.has(slot)) return;
      crmLoadingRef.current.add(slot);
      if (!closed) crmRefreshedRef.current.add(key);
      retryWithBackoff(() => loadCrmMonth(db, key, closed))
        .catch((e) => {
          console.error('crm fontes', key, e);
          return failedCrmEntry(closed);
        })
        .then((next) => store(key, next))
        .finally(() => crmLoadingRef.current.delete(slot));
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- crm entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- meses no formato de ctx.months: só os que têm as duas partes valendo.
  const months = useMemo(() => {
    const out = {};
    (monthKeys || []).forEach((key) => {
      const s = shared[key];
      const c = crm[key];
      if (!monthEntryFits(s, key, currentKey) || !monthEntryFits(c, key, currentKey)) return;
      const isCurrent = key === currentKey;
      const { start, end } = monthRange(key);
      const liveCreated = isCurrent
        ? (liveLeads || []).filter((l) => l.createdAt instanceof Date && l.createdAt >= start && l.createdAt < end)
        : [];
      out[key] = {
        interactions: isCurrent ? (liveInteractions || []) : (s.interactions || []),
        leadsCreated: [...new Map([...(s.leadsCreated || []), ...liveCreated].map((l) => [l.id, l])).values()],
        converted: c.converted || [],
        lost: c.lost || [],
        aulas: c.aulas || [],
        ...(s.failed || c.failed ? { failed: true } : {})
      };
    });
    return out;
  }, [monthKeys, shared, crm, currentKey, liveLeads, liveInteractions]);

  // --- leads citados que não estão em lista nenhuma, por id, em lotes de 30,
  // do servidor. `fetched` guarda null para quem não existe mais ou cuja busca
  // falhou nesta montagem (conta como desconhecido). A memória da sessão só
  // guarda os achados, e a próxima montagem tenta os outros de novo.
  const [fetched, setFetched] = useState(() => new Map(carteiraDaSessao.get(appId)));
  const askedRef = useRef(new Set());
  const missing = useMemo(() => {
    const known = new Set(fetched.keys());
    (liveLeads || []).forEach((l) => known.add(l.id));
    Object.values(months).forEach((m) => {
      [m.leadsCreated, m.converted, m.lost].forEach((list) => (list || []).forEach((l) => known.add(l.id)));
    });
    return referencedLeadIds(months, known);
  }, [fetched, liveLeads, months]);
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    const ids = missing.filter((id) => !askedRef.current.has(id));
    if (!ids.length) return undefined;
    ids.forEach((id) => askedRef.current.add(id));
    const settle = (part, found) => setFetched((prev) => {
      const next = new Map(prev);
      part.forEach((id) => { if (!next.has(id)) next.set(id, null); });
      found.forEach((l) => next.set(l.id, l));
      return next;
    });
    chunk(ids).forEach((part) => {
      serverDocs(query(colRef(db, LEADS_PATH), where(documentId(), 'in', part)))
        .then((docs) => {
          const found = docs.map(normalizeLeadDoc);
          if (!carteiraDaSessao.has(tenant)) carteiraDaSessao.set(tenant, new Map());
          found.forEach((l) => carteiraDaSessao.get(tenant).set(l.id, l));
          settle(part, found);
        })
        .catch((e) => {
          console.error('crm leads por id', e);
          settle(part, []);
        });
    });
    return undefined;
  }, [db, enabled, missing]);

  return useMemo(() => {
    const failedKeys = (monthKeys || []).filter((k) => months[k]?.failed);
    const loading = (monthKeys || []).some((k) => !months[k]) || missing.length > 0;
    const leadsById = mergeLeadsById({ months, currentKey, fetched, liveLeads });
    return { months, leadsById, loading, failedKeys };
  }, [monthKeys, months, missing, currentKey, fetched, liveLeads]);
}
```

- [ ] **Step 2: Lint e build**

Run: `npm run lint && npm run build`
Expected: 0 erros no lint e build sem erro. Se o lint reclamar de `set-state-in-effect`, confira que nenhum `setState` ficou fora de `.then`/`.catch`. Se reclamar de `exhaustive-deps` nos dois efeitos de carga, confira que o comentário `eslint-disable-next-line` está na linha logo acima do array de dependências, como no Operacional.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCrmSources.js
git commit -m "feat: fontes do dashboard CRM por mês" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Faixa de resumo e destaques para as duas telas (`DashSummaryBand`, `DashHighlights`, `dashTokens`)

**Files:**
- Modify: `src/views/dashboard/dashTokens.js` (tom `accent` e `LOSS_PALETTE`)
- Modify: `src/views/dashboard/DashSummaryBand.jsx` (reescrito, compatível com o Operacional)
- Modify: `src/views/dashboard/DashHighlights.jsx` (reescrito, compatível com o Operacional)
- Test: `src/lib/__tests__/crm.dashParts.test.js`

Os dois componentes são do Operacional, em produção. Tudo o que muda é opcional: item sem os campos novos renderiza exatamente como antes. O teste cobre os dois formatos.

- [ ] **Step 1: Escrever o teste que falha**

```js
// Render da faixa de resumo e dos destaques nos formatos do Operacional e do
// CRM, sem jsdom (renderToString), no molde do MetaDaysCalendar.test.js.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { DashSummaryBand } from '../../views/dashboard/DashSummaryBand.jsx';
import { DashHighlights } from '../../views/dashboard/DashHighlights.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

describe('DashSummaryBand', () => {
  it('item do Operacional: sem base não mostra pílula, sem etiqueta nem cartão tracejado', () => {
    const html = render(createElement(DashSummaryBand, {
      items: [
        { key: 'a', label: 'Meta diária', value: '82%', sub: '41 de 50', goodUp: true, delta: { up: true, text: '+8 p.p.' }, series: [1, 2, 3] },
        { key: 'b', label: 'Churn', value: '2%', goodUp: false, delta: { none: true, text: 'sem base' } }
      ]
    }));
    expect(html).toContain('▲ +8 p.p.');
    expect(html).not.toContain('sem base');
    expect(html).not.toContain('incompleto');
    expect(html).toContain('text-brand-600');
  });

  it('item do CRM: etiqueta, pílula sem base, cor da tendência e cartão sem base', () => {
    const html = render(createElement(DashSummaryBand, {
      items: [
        { key: 'ag', label: 'Agendamentos', value: '19', goodUp: true, tone: 'accent', flag: 'incompleto', showNone: true, delta: { none: true, text: 'sem base' }, series: [3, 5] },
        { key: 'cv', label: 'Conversão da safra', value: '18%', goodUp: true, delta: { flat: true, text: '= 0 p.p.' }, emptySeries: 'Sem base antes de agosto de 2026' }
      ]
    }));
    expect(html).toContain('incompleto');
    expect(html).toContain('sem base');
    expect(html).toContain('text-accent-500');
    expect(html).toContain('= 0 p.p.');
    expect(html).toContain('Sem base antes de agosto de 2026');
  });
});

describe('DashHighlights', () => {
  it('item do Operacional: melhorou ou piorou, três colunas', () => {
    const html = render(createElement(DashHighlights, {
      items: [{ text: 'Upgrades: de 2 para 5', delta: '3 vendas', up: true, bad: false }]
    }));
    expect(html).toContain('melhorou');
    expect(html).toContain('▲ 3 vendas');
    expect(html).toContain('grid-cols-3');
  });

  it('item do CRM: veredito com o mês comparado, neutro quando igual, grade do tamanho da lista', () => {
    const html = render(createElement(DashHighlights, {
      fit: true,
      items: [
        { text: '12 dos 56 leads passaram de 24 horas sem primeiro contato', delta: '▼ 20%', tone: 'good', verdict: 'melhor que agosto', rank: 2 },
        { text: 'Indicação converteu 44%, a melhor taxa entre os canais', delta: '= 0 p.p.', tone: 'flat', verdict: 'igual a agosto', rank: 1 }
      ]
    }));
    expect(html).toContain('melhor que agosto');
    expect(html).toContain('igual a agosto');
    expect(html).toContain('▼ 20%');
    expect(html).not.toContain('melhorou');
    expect(html).toContain('repeat(2, minmax(0, 1fr))');
  });

  it('sem item, nada', () => {
    expect(render(createElement(DashHighlights, { items: [] }))).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.dashParts.test.js`
Expected: FAIL nos casos do CRM (`incompleto`, `text-accent-500`, `melhor que agosto` e a grade não aparecem).

- [ ] **Step 3: Acrescentar ao `dashTokens.js`**

Dentro de `DASH_TONES`, depois da linha do `brand`, acrescente:

```js
  accent:  { dot: 'bg-accent-500',  strong: 'bg-accent-500',  stroke: 'text-accent-500',  text: 'text-accent-600',  soft: 'bg-accent-50',  darkText: 'dark:text-accent-400',  darkSoft: 'dark:bg-accent-500/10' },
```

E, depois de `BREAKDOWN_PALETTE`, acrescente:

```js
// Cores das perdas por motivo no CRM: a sequência da cápsula de quebra mais o
// azul claro para o sexto motivo (LOSS_COLORS do handoff do CRM).
export const LOSS_PALETTE = [...BREAKDOWN_PALETTE, 'bg-brand-300 dark:bg-brand-400'];
```

- [ ] **Step 4: Reescrever `src/views/dashboard/DashSummaryBand.jsx`**

```jsx
// Faixa de resumo: 5 números num card só, divididos por régua vertical (README
// §2 do Operacional, "a divergência deliberada": não são 5 DashKpiCard
// soltos). Abaixo de 768px vira grade de 2 colunas, cada célula como card
// próprio, sem tendência. Usada pelo Operacional e pelo CRM.
//
// Célula: key, label, help, value, sub, delta ({ up, flat, none, text }),
// goodUp, muted, series, seriesFrom, seriesTo, seriesLabel. Opcionais do CRM
// (handoff do CRM, linhas 180 a 217): tone (cor da tendência, chave de
// DASH_TONES; padrão brand), flag (etiqueta âmbar ao lado do valor),
// emptySeries (texto do cartão tracejado quando não há tendência) e showNone
// (mostra a pílula cinza "sem base"; sem ela, delta sem base some).
import { cn } from '../../lib/utils.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { DASH_TONES } from './dashTokens.js';
import { Sparkline } from '../../components/charts/Sparkline.jsx';
import { ChartMark } from './ChartMark.jsx';

function SummaryCell({ item: k }) {
  const delta = k.delta;
  const showPill = Boolean(delta && (!delta.none || k.showNone));
  const quiet = showPill && Boolean(delta.none || delta.flat);
  const pillTone = !showPill ? null
    : quiet ? 'bg-muted text-muted-foreground'
    : delta.up === k.goodUp ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-muted-foreground">{k.label}</span>
          {k.help && <DashHelpTip text={k.help} label={`O que é "${k.label}"?`} />}
        </div>
        {showPill && (
          <span className={cn('num inline-flex h-5 flex-none items-center gap-[3px] whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold', pillTone)}>
            {quiet ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn('num text-[32px] font-semibold leading-none tracking-tight', k.muted && 'text-muted-foreground')}>{k.value}</span>
        {k.flag && (
          <span className="rounded-[5px] bg-amber-500/[0.12] px-[5px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {k.flag}
          </span>
        )}
      </div>
      {k.sub && <div className="num mt-1 truncate text-[11.5px] text-muted-foreground">{k.sub}</div>}
    </>
  );
}

export function DashSummaryBand({ items }) {
  const list = items || [];
  return (
    <>
      <section className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:flex md:items-stretch">
        {list.map((k, i) => (
          <div key={k.key} className={cn('min-w-0 flex-1 px-[18px] py-4', i > 0 && 'border-l border-slate-100 dark:border-white/[0.06]')}>
            <SummaryCell item={k} />
            {k.series && k.series.length > 1 ? (
              <>
                <ChartMark as="div" tip={k.seriesLabel} className={cn('mt-3 -mx-1 block [&_svg]:h-[42px] [&_svg]:w-full', (DASH_TONES[k.tone] || DASH_TONES.brand).stroke)}>
                  <Sparkline data={k.series} width={120} height={42} strokeWidth={1.75} />
                </ChartMark>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-[9.5px] text-muted-foreground">{k.seriesFrom}</span>
                  <span className="text-[9.5px] text-muted-foreground">{k.seriesTo}</span>
                </div>
              </>
            ) : k.emptySeries ? (
              <div className="mt-3 grid h-[52px] place-items-center rounded-[9px] border border-dashed border-border px-2">
                <span className="text-center text-[10.5px] leading-[1.35] text-muted-foreground">{k.emptySeries}</span>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        {list.map((k) => (
          <div key={k.key} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <SummaryCell item={k} />
          </div>
        ))}
      </section>
    </>
  );
}
```

- [ ] **Step 5: Reescrever `src/views/dashboard/DashHighlights.jsx`**

```jsx
// Destaques do mês, só com o comparativo ligado (a tela decide; o componente
// só renderiza o que receber). Abaixo de 768px vira carrossel horizontal com o
// pior primeiro.
//
// Dois formatos de item. O do Operacional, { text, delta, up, bad }: a seta
// segue a direção do número e o texto diz "melhorou" ou "piorou". O do CRM,
// { text, delta, tone: 'good' | 'bad' | 'flat', verdict, rank }: a seta diz
// melhor, pior ou igual, o delta já chega com ▲/▼ e o veredito cita o mês
// comparado (handoff do CRM, linhas 158 a 176 e 1181 a 1196). Com `fit`, a
// grade tem uma coluna por item em vez das três fixas.
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const TONES = {
  good: { card: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'bg-success dark:bg-[#0E9F6E]', text: 'text-emerald-700 dark:text-emerald-300' },
  bad: { card: 'bg-rose-50 dark:bg-rose-500/10', icon: 'bg-danger dark:bg-[#E11D48]', text: 'text-rose-700 dark:text-rose-300' },
  flat: { card: 'bg-card', icon: 'bg-slate-400 dark:bg-slate-500', text: 'text-muted-foreground' }
};

function HighlightCard({ h }) {
  const verdictMode = Boolean(h.tone);
  const tone = TONES[verdictMode ? h.tone : (h.bad ? 'bad' : 'good')] || TONES.flat;
  let Icon = h.up ? ArrowUp : ArrowDown;
  if (verdictMode) Icon = h.tone === 'good' ? ArrowUp : h.tone === 'bad' ? ArrowDown : Minus;
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border border-border px-[15px] py-[13px]', tone.card)}>
      <span className={cn('mt-px grid size-[26px] flex-none place-items-center rounded-lg text-white', tone.icon)}>
        <Icon size={14} strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-pretty text-[12.5px] font-semibold leading-[1.45]">{h.text}</div>
        <div className="mt-[5px] flex items-center gap-[7px]">
          <span className={cn('num text-[11.5px] font-bold', tone.text)}>
            {verdictMode ? h.delta : `${h.up ? '▲' : '▼'} ${h.delta}`}
          </span>
          <span className="size-[3px] flex-none rounded-full bg-muted-foreground" />
          <span className={cn('text-[11.5px]', tone.text)}>
            {verdictMode ? h.verdict : (h.bad ? 'piorou' : 'melhorou')}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashHighlights({ items, fit = false }) {
  const list = items || [];
  if (list.length === 0) return null;
  const mobileOrder = [...list].sort((a, b) => (
    a.rank != null && b.rank != null ? a.rank - b.rank : Number(b.bad) - Number(a.bad)
  ));
  return (
    <>
      <div
        className={cn('hidden gap-3 md:grid', !fit && 'grid-cols-3')}
        style={fit ? { gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` } : undefined}
      >
        {list.map((h, i) => <HighlightCard key={i} h={h} />)}
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto md:hidden">
        {mobileOrder.map((h, i) => (
          <div key={i} className="w-[260px] flex-none snap-start">
            <HighlightCard h={h} />
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.dashParts.test.js src/lib/__tests__/MetaDaysCalendar.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/views/dashboard/dashTokens.js src/views/dashboard/DashSummaryBand.jsx src/views/dashboard/DashHighlights.jsx src/lib/__tests__/crm.dashParts.test.js
git commit -m "feat: faixa de resumo e destaques aceitam o formato do CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Barra de filtros e peças dos cards (`CrmToolbar`, `CrmParts`)

**Files:**
- Modify: `src/views/dashboard/OperacionalToolbar.jsx` (exporta `MonthControl`, `CompareControl` e `PersonControl`)
- Create: `src/views/dashboard/CrmToolbar.jsx`, `src/views/dashboard/CrmParts.jsx`
- Test: `src/lib/__tests__/crm.components.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// Render das peças da tela do CRM, sem jsdom (renderToString). As tasks
// seguintes acrescentam blocos a este arquivo.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { CrmSection, CrmCard, DashedNote, DeltaPill, ScopeTag } from '../../views/dashboard/CrmParts.jsx';
import { CrmToolbar } from '../../views/dashboard/CrmToolbar.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

describe('peças do CRM', () => {
  it('seção com a pergunta e a nota do recorte, ou com a etiqueta', () => {
    const withNote = render(createElement(CrmSection, { title: 'Origem', question: 'de onde vêm os leads?', note: 'Equipe toda · Todos os funis' }, 'corpo'));
    expect(withNote).toContain('>Origem</h3>');
    expect(withNote).toContain('de onde vêm os leads?');
    expect(withNote).toContain('Equipe toda · Todos os funis');
    const withTag = render(createElement(CrmSection, { title: 'Carteira agora', question: 'o que está em jogo neste momento?', tag: 'Agora' }, 'corpo'));
    expect(withTag).toContain('Agora');
  });

  it('card, cartão tracejado e etiqueta', () => {
    const html = render(createElement(CrmCard, { title: 'Perdas', hint: 'nenhuma perda registrada', action: createElement(ScopeTag, { tone: 'amber' }, 'academia inteira') },
      createElement(DashedNote, { title: 'Nenhum lead perdido neste mês.', text: 'Ninguém marcou perda no período.' })));
    expect(html).toContain('>Perdas</h4>');
    expect(html).toContain('nenhuma perda registrada');
    expect(html).toContain('academia inteira');
    expect(html).toContain('Nenhum lead perdido neste mês.');
  });

  it('pílula de diferença onde menor é melhor', () => {
    expect(render(createElement(DeltaPill, { delta: { up: false, text: '40 min' }, lowerBetter: true }))).toContain('text-emerald-700');
    expect(render(createElement(DeltaPill, { delta: { up: true, text: '40 min' }, lowerBetter: true }))).toContain('text-rose-700');
    expect(render(createElement(DeltaPill, { delta: { none: true, text: 'sem base' }, lowerBetter: true }))).toContain('sem base');
    expect(render(createElement(DeltaPill, { delta: null }))).toBe('');
  });

  it('barra de filtros com os quatro controles e a nota do regime', () => {
    const noop = () => {};
    const html = render(createElement(CrmToolbar, {
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      compareOn: true, onCompareOn: noop, compareKey: '2026-08', compareOptions: [{ key: '2026-08', label: 'Agosto 2026' }], onCompare: noop,
      person: 'all', people: [{ id: 'ana', name: 'Ana Ribeiro' }], onPerson: noop,
      funnel: 'ven', funnels: [{ id: 'ven', name: 'Vendas' }], onFunnel: noop,
      note: 'Pró-rata: mesmos 14 primeiros dias de agosto'
    }));
    expect(html).toContain('aria-label="Funil"');
    expect(html).toContain('aria-label="Pessoa"');
    expect(html).toContain('Pró-rata: mesmos 14 primeiros dias de agosto');
    expect(html).toContain('há filtro ativo');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: FAIL, `CrmParts.jsx` e `CrmToolbar.jsx` não existem.

- [ ] **Step 3: Exportar os controles do Operacional**

Em `src/views/dashboard/OperacionalToolbar.jsx`, troque `function MonthControl(`, `function CompareControl(` e `function PersonControl(` por `export function MonthControl(`, `export function CompareControl(` e `export function PersonControl(`. Nada mais muda nesse arquivo.

- [ ] **Step 4: Escrever `src/views/dashboard/CrmParts.jsx`**

```jsx
// Peças visuais do CRM portadas do handoff (docs/superpowers/specs/handoff-crm/
// CRM.dc.html): o título de seção com a régua de 2px, a casca de card, o
// cartão tracejado dos vazios e da falta de base, o sobretítulo, a leitura do
// rodapé, a etiqueta de escopo, a pílula de diferença dos cards de velocidade
// e o item de legenda.
import { cn } from '../../lib/utils.js';

const RULE = 'border-slate-100 dark:border-white/[0.06]';

// Título de seção com a pergunta e a régua de 2px (handoff, linhas 219 a 226).
// À direita, a nota do recorte ou a etiqueta (AGORA, na carteira).
export function CrmSection({ title, question, note, tag, children }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b-2 border-border pb-[9px]">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h3 className="m-0 font-display text-[16px] font-bold tracking-[-0.01em]">{title}</h3>
          <span className="text-[12.5px] text-muted-foreground">{question}</span>
        </div>
        {tag ? (
          <span className="flex-none rounded-md bg-brand-50 px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.07em] text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {tag}
          </span>
        ) : note ? (
          <span className="num hidden truncate text-[11.5px] text-muted-foreground sm:block">{note}</span>
        ) : null}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

// Casca de card (handoff, linhas 229 a 239): cabeçalho com título de 14px e a
// dica de 11,5px; o corpo fica por conta de quem usa.
export function CrmCard({ title, hint, action, className, children }) {
  return (
    <section className={cn('flex flex-col rounded-2xl border border-border bg-card shadow-card', className)}>
      <header className={cn('flex items-center justify-between gap-3 border-b px-[18px] py-3.5', RULE)}>
        <div className="min-w-0">
          <h4 className="m-0 text-[14px] font-semibold">{title}</h4>
          {hint && <p className="num mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

// Cartão tracejado dos vazios e da falta de base (handoff, linhas 363 a 368).
export function DashedNote({ title, text, className }) {
  return (
    <div className={cn('rounded-xl border border-dashed border-border px-[22px] py-[34px] text-center', className)}>
      <div className="text-[13px] font-semibold text-foreground/80">{title}</div>
      {text && <p className="mx-auto mt-1.5 max-w-[420px] text-pretty text-[12px] leading-[1.55] text-muted-foreground">{text}</p>}
    </div>
  );
}

export function Eyebrow({ className, children }) {
  return <div className={cn('text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground', className)}>{children}</div>;
}

// Leitura no rodapé do card.
export function ReadText({ className, children }) {
  if (!children) return null;
  return <p className={cn('mt-3 text-pretty text-[11.5px] leading-normal text-muted-foreground', className)}>{children}</p>;
}

// Etiqueta de escopo: âmbar para "academia inteira", neutra para "mediana da academia".
export function ScopeTag({ tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'flex-none whitespace-nowrap rounded-md px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.05em]',
        tone === 'amber'
          ? 'bg-amber-500/[0.12] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

// Pílula de diferença dos cards de velocidade (handoff, linhas 537 a 539).
// Com lowerBetter, cair é bom.
export function DeltaPill({ delta, lowerBetter = false }) {
  if (!delta) return null;
  const quiet = Boolean(delta.none || delta.flat);
  const good = !quiet && delta.up !== lowerBetter;
  return (
    <span
      className={cn(
        'num inline-flex h-5 flex-none items-center gap-[3px] whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold',
        quiet ? 'bg-muted text-muted-foreground'
          : good ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      )}
    >
      {quiet ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`}
    </span>
  );
}

// Item de legenda: amostra de cor e rótulo (handoff, linhas 236 e 237).
export function Swatch({ className, children }) {
  return (
    <span className="inline-flex items-center gap-[5px] text-[11px] text-muted-foreground">
      <i className={cn('block h-2 w-3.5 rounded-[3px]', className)} />
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Escrever `src/views/dashboard/CrmToolbar.jsx`**

```jsx
// Barra fixa do CRM: mês de competência, comparativo, pessoa e funil, com a
// nota do regime à direita (handoff do CRM, linhas 96 a 148). Os três
// primeiros controles são os do Operacional. Abaixo de 768px o mês fica à
// vista e comparar, pessoa e funil entram num painel atrás do botão de filtro,
// que ganha um ponto quando há pessoa ou funil escolhido (README §5).
//
// O trigger do Select usa o primitivo Radix direto, pelo mesmo motivo do
// Operacional: o SelectTrigger do shadcn tem dois filhos e quebra o asChild.
import { Select as SelectPrimitive } from 'radix-ui';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectValue } from '../../components/ui/select.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import { MonthControl, CompareControl, PersonControl } from './OperacionalToolbar.jsx';

function FunnelControl({ funnel, funnels, onFunnel }) {
  const active = funnel !== 'all';
  return (
    <Select value={funnel} onValueChange={onFunnel}>
      <SelectPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Funil"
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-foreground'
          )}
        >
          <Filter size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} />
          <SelectValue />
        </button>
      </SelectPrimitive.Trigger>
      <SelectContent position="popper">
        <SelectItem value="all">Todos os funis</SelectItem>
        {(funnels || []).map((f) => (
          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CrmToolbar(props) {
  const { note, person, funnel } = props;
  const filtered = person !== 'all' || funnel !== 'all';
  // A área que rola no App tem recuo interno (p-4 md:p-8): o top negativo do
  // mesmo tamanho faz a barra encostar no cabeçalho do App (ver Operacional).
  return (
    <div className="sticky -top-4 md:-top-8 z-30 flex items-center gap-2.5 border-t border-b border-t-slate-100 border-b-border bg-card px-4 md:px-8 py-2.5 dark:border-t-white/[0.06]">
      <div className="hidden items-center gap-2.5 md:flex">
        <MonthControl {...props} />
        <CompareControl {...props} />
        <PersonControl {...props} />
        <FunnelControl {...props} />
      </div>

      <div className="min-w-0 flex-1 md:hidden">
        <MonthControl {...props} />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={filtered ? 'Filtros do CRM, há filtro ativo' : 'Filtros do CRM'}
            className={cn(
              'relative grid h-10 w-11 flex-none place-items-center rounded-xl border md:hidden',
              filtered ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground'
            )}
          >
            <SlidersHorizontal size={17} strokeWidth={2} />
            {filtered && <span className="absolute right-2 top-[7px] size-1.5 rounded-full bg-brand-600" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-auto flex-col gap-2.5">
          <CompareControl {...props} />
          <PersonControl {...props} />
          <FunnelControl {...props} />
        </PopoverContent>
      </Popover>

      <div className="hidden flex-1 md:block" />
      <span className="num hidden max-w-[430px] truncate text-[11.5px] text-muted-foreground md:block">{note}</span>
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js && npm run lint`
Expected: PASS e 0 erros no lint.

- [ ] **Step 7: Commit**

```bash
git add src/views/dashboard/OperacionalToolbar.jsx src/views/dashboard/CrmParts.jsx src/views/dashboard/CrmToolbar.jsx src/lib/__tests__/crm.components.test.js
git commit -m "feat: barra de filtros e peças dos cards do CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Canais e safra (`ChannelTable`, `CohortMilestones`)

**Files:**
- Create: `src/views/dashboard/ChannelTable.jsx`, `src/views/dashboard/CohortMilestones.jsx`
- Test: `src/lib/__tests__/crm.components.test.js` (acrescentar)

Regra para todo componente desta e das próximas tasks: texto que junta número e palavra vai num template literal só (`{`${fmtNum(n)} leads`}`). Com dois pedaços soltos no JSX, o `renderToString` põe um comentário entre eles e o teste por texto falha. Toda marca de gráfico com valor usa `ChartMark` (dica no hover e no foco).

- [ ] **Step 1: Acrescentar o teste que falha**

No topo de `src/lib/__tests__/crm.components.test.js`, junto dos outros imports:

```js
import { ChannelTable } from '../../views/dashboard/ChannelTable.jsx';
import { CohortMilestones } from '../../views/dashboard/CohortMilestones.jsx';
```

No fim do arquivo:

```js
describe('canais e safra', () => {
  it('canais: volume, matrícula e conversão acima da safra em verde', () => {
    const html = render(createElement(ChannelTable, {
      rows: [{ name: 'Instagram', leads: 22, enrolled: 3 }, { name: 'Indicação', leads: 9, enrolled: 4 }],
      cohortConv: 18,
      read: 'Instagram traz o volume e Indicação traz o resultado.'
    }));
    expect(html).toContain('Canais de origem');
    expect(html).toContain('Instagram: 22 leads novos, 3 matricularam (14%)');
    expect(html).toContain('44%');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('Instagram traz o volume');
  });

  it('canais sem lead: cartão vazio', () => {
    expect(render(createElement(ChannelTable, { rows: [], cohortConv: null }))).toContain('Nenhum lead cadastrado neste mês.');
  });

  it('safra: passagens com a queda e o desfecho', () => {
    const html = render(createElement(CohortMilestones, {
      cohort: { leads: 56, sched: 16, came: 12, enrolled: 10, lost: 6, open: 40 },
      monthName: 'setembro',
      running: true
    }));
    expect(html).toContain('Safra de setembro');
    expect(html).toContain('os 56 leads cadastrados no mês, acompanhados até hoje');
    expect(html).toContain('−40 não agendaram');
    expect(html).toContain('−4 não compareceram');
    expect(html).toContain('29% da safra');
    expect(html).toContain('Seguem em jogo');
    expect(html).toContain('ainda está viva');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: FAIL, os dois componentes não existem.

- [ ] **Step 3: Escrever `src/views/dashboard/ChannelTable.jsx`**

```jsx
// Canais de origem (handoff do CRM, linhas 229 a 258; celular, 681 a 697). A
// barra inteira é o volume de leads e o trecho escuro é quem matriculou; a
// conversão fica verde quando passa a da safra toda. No celular, rótulo em
// cima e barra embaixo.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { ChartMark } from './ChartMark.jsx';
import { CrmCard, DashedNote, ReadText, Swatch } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[104px_minmax(0,1fr)_42px_42px_56px] items-center gap-3';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground';
const VOLUME = 'bg-brand-200 dark:bg-brand-500/40';
const widthOf = (v, max) => `${max > 0 ? Math.round((v / max) * 100) : 0}%`;

function Bar({ row, max, tip, className, radius }) {
  return (
    <ChartMark tip={tip} className={cn('relative block bg-muted', radius, className)}>
      <i className={cn('absolute inset-y-0 left-0', radius, VOLUME)} style={{ width: widthOf(row.leads, max) }} />
      <i className={cn('absolute inset-y-0 left-0 bg-brand-600', radius)} style={{ width: widthOf(row.enrolled, max) }} />
    </ChartMark>
  );
}

export function ChannelTable({ rows, cohortConv, read }) {
  const list = (rows || []).map((r) => ({ ...r, conv: pct(r.enrolled, r.leads) }));
  const max = Math.max(1, ...list.map((r) => r.leads));
  const convLabel = (r) => (r.conv == null ? '—' : `${r.conv}%`);
  const tipOf = (r) => `${r.name}: ${fmtNum(r.leads)} ${r.leads === 1 ? 'lead novo' : 'leads novos'}, ${fmtNum(r.enrolled)} ${r.enrolled === 1 ? 'matriculou' : 'matricularam'}${r.conv == null ? '' : ` (${r.conv}%)`}`;
  const above = (r) => r.conv != null && cohortConv != null && r.conv > cohortConv;
  const legend = (
    <div className="hidden flex-none items-center gap-3 sm:flex">
      <Swatch className={cn('w-[18px] rounded', VOLUME)}>leads</Swatch>
      <Swatch className="w-[18px] rounded bg-brand-600">matricularam</Swatch>
    </div>
  );
  return (
    <CrmCard title="Canais de origem" hint="pela origem do cadastro, ordenado por volume" action={legend}>
      {list.length === 0 ? (
        <div className="p-[18px]"><DashedNote title="Nenhum lead cadastrado neste mês." /></div>
      ) : (
        <div className="px-[18px] pb-4 pt-2">
          <div className={cn(GRID, 'hidden h-[26px] md:grid', HEAD)}>
            <span>Canal</span>
            <span />
            <span className="text-right">Leads</span>
            <span className="text-right">Matr.</span>
            <span className="text-right">Conversão</span>
          </div>
          {list.map((r) => (
            <div key={r.name} className={cn(GRID, 'hidden h-9 border-t md:grid', RULE)}>
              <span className="truncate text-[12.5px] font-medium">{r.name}</span>
              <Bar row={r} max={max} tip={tipOf(r)} className="h-3.5" radius="rounded-[7px]" />
              <span className="num text-right text-[12.5px] font-semibold">{fmtNum(r.leads)}</span>
              <span className="num text-right text-[12.5px] text-muted-foreground">{fmtNum(r.enrolled)}</span>
              <span className={cn('num text-right text-[12.5px] font-bold', above(r) && 'text-emerald-700 dark:text-emerald-300')}>{convLabel(r)}</span>
            </div>
          ))}
          <div className="flex flex-col gap-[9px] md:hidden">
            {list.map((r) => (
              <div key={r.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-medium">{r.name}</span>
                  <span className="num flex-none text-[11.5px] text-muted-foreground">{`${fmtNum(r.leads)} ${r.leads === 1 ? 'lead' : 'leads'} · ${convLabel(r)}`}</span>
                </div>
                <Bar row={r} max={max} tip={tipOf(r)} className="mt-1 h-3" radius="rounded-md" />
              </div>
            ))}
          </div>
          <ReadText>{read}</ReadText>
        </div>
      )}
    </CrmCard>
  );
}
```

- [ ] **Step 4: Escrever `src/views/dashboard/CohortMilestones.jsx`**

```jsx
// Safra do mês (handoff do CRM, linhas 271 a 321): os leads cadastrados no
// mês, acompanhados até hoje. À esquerda, as duas passagens sobre a mesma base
// (agendaram, compareceram), com a queda escrita ao lado; à direita, o
// desfecho (matricularam, seguem em jogo, perdidos). O azul de "seguem em
// jogo" fica entre o verde e o vermelho, que nunca se tocam (README §4).
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';
import { CrmCard, DashedNote, Eyebrow, ReadText } from './CrmParts.jsx';

const SAFRA_HELP = 'Safra é a turma de leads cadastrados no mês. Os marcos são cumulativos e sempre sobre a mesma turma, então a conta nunca passa de 100%. Um lead que agendou, faltou e matriculou depois conta em agendou e em matriculou, não em compareceu.';
const SEGMENT = 'block h-full min-w-[6px] border-r-2 border-white last:border-r-0 dark:border-ink-800';

export function CohortMilestones({ cohort, monthName, running }) {
  const leads = cohort?.leads || 0;
  const help = <DashHelpTip text={SAFRA_HELP} label="Como ler a safra" />;
  if (leads === 0) {
    return (
      <CrmCard title={`Safra de ${monthName}`} hint="nenhum lead cadastrado no mês" action={help}>
        <div className="p-[18px]"><DashedNote title="Nenhum lead cadastrado neste mês." /></div>
      </CrmCard>
    );
  }
  const hint = leads === 1
    ? '1 lead cadastrado no mês, acompanhado até hoje'
    : `os ${fmtNum(leads)} leads cadastrados no mês, acompanhados até hoje`;
  const passages = [
    { name: 'Agendaram', count: cohort.sched, prev: leads, bar: 'bg-brand-500', gone: 'não agendaram' },
    { name: 'Compareceram', count: cohort.came, prev: cohort.sched, bar: 'bg-brand-600', gone: 'não compareceram' }
  ];
  const outcome = [
    { name: 'Matricularam', count: cohort.enrolled, bar: 'bg-success dark:bg-[#0E9F6E]' },
    { name: 'Seguem em jogo', count: cohort.open, bar: 'bg-brand-600' },
    { name: 'Perdidos', count: cohort.lost, bar: 'bg-danger dark:bg-[#E11D48]' }
  ];
  const outTotal = Math.max(1, cohort.enrolled + cohort.open + cohort.lost);
  const passageRead = leads - cohort.sched >= cohort.sched - cohort.came
    ? 'A maior queda da safra é entre cadastrar e agendar: trazer a pessoa para uma visita ou aula é o passo que menos acontece.'
    : 'A maior queda da safra é entre agendar e comparecer: quem marca nem sempre vem.';
  const outcomeRead = running
    ? `A safra de ${monthName} ainda está viva: quem segue em jogo pode virar matrícula e a conversão vai subir até o mês fechar.`
    : `A safra de ${monthName} já fechou o mês, mas quem segue em jogo ainda pode matricular, e a conversão dela continua andando.`;

  return (
    <CrmCard title={`Safra de ${monthName}`} hint={hint} action={help}>
      <div className="grid grid-cols-1 gap-[26px] p-[18px] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <Eyebrow>Passagem da safra</Eyebrow>
          <div className="mt-[11px] flex flex-col gap-[9px]">
            {passages.map((p) => {
              const share = pct(p.count, leads);
              const gone = p.prev - p.count;
              return (
                <div key={p.name} className="grid grid-cols-[118px_minmax(0,1fr)] items-center gap-3.5">
                  <div>
                    <div className="text-[12.5px] font-semibold">{p.name}</div>
                    <div className="num text-[11px] text-muted-foreground">{gone === 0 ? 'ninguém saiu aqui' : `−${fmtNum(gone)} ${p.gone}`}</div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ChartMark
                      tip={`${p.name}: ${fmtNum(p.count)} de ${plural(leads, 'lead', 'leads')} da safra de ${monthName} (${share}%)`}
                      className={cn('block h-6 min-w-[3px] rounded-[5px]', p.bar)}
                      style={{ width: `${Math.round((p.count / leads) * 100)}%` }}
                    />
                    <span className="num whitespace-nowrap text-[13px] font-bold">{fmtNum(p.count)}</span>
                    <span className="num whitespace-nowrap text-[11.5px] text-muted-foreground">{`${share}% da safra`}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <ReadText>{passageRead}</ReadText>
        </div>
        <div>
          <Eyebrow>Desfecho da safra</Eyebrow>
          <div className="mt-[9px] flex h-[34px] overflow-hidden rounded-[9px] bg-muted">
            {outcome.filter((o) => o.count > 0).map((o) => (
              <ChartMark
                key={o.name}
                tip={`${o.name}: ${fmtNum(o.count)} de ${plural(outTotal, 'lead', 'leads')} da safra`}
                className={cn(SEGMENT, o.bar)}
                style={{ width: `${Math.round((o.count / outTotal) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-[7px]">
            {outcome.map((o) => (
              <div key={o.name} className="flex items-center gap-2">
                <i className={cn('block size-[9px] flex-none rounded-[3px]', o.bar)} />
                <span className="min-w-0 flex-1 text-[12.5px]">{o.name}</span>
                <span className="num text-[12.5px] font-bold">{fmtNum(o.count)}</span>
                <span className="num w-[38px] text-right text-[11.5px] text-muted-foreground">{`${pct(o.count, outTotal)}%`}</span>
              </div>
            ))}
          </div>
          <ReadText>{outcomeRead}</ReadText>
        </div>
      </div>
    </CrmCard>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/ChannelTable.jsx src/views/dashboard/CohortMilestones.jsx src/lib/__tests__/crm.components.test.js
git commit -m "feat: cards de canais e da safra do CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Passagem entre etapas e perdas (`StagePassageTable`, `LossCard`)

**Files:**
- Create: `src/views/dashboard/StagePassageTable.jsx`, `src/views/dashboard/LossCard.jsx`
- Test: `src/lib/__tests__/crm.components.test.js` (acrescentar)

- [ ] **Step 1: Acrescentar o teste que falha**

Imports:

```js
import { StagePassageTable } from '../../views/dashboard/StagePassageTable.jsx';
import { LossCard } from '../../views/dashboard/LossCard.jsx';
```

No fim do arquivo:

```js
describe('passagem entre etapas e perdas', () => {
  const passage = {
    rows: [
      { name: 'Novo lead', entered: 47, advanced: 38, lost: 5, medianMin: 240 },
      { name: 'Contato feito', entered: 38, advanced: 16, lost: 9, medianMin: 5760 }
    ],
    worst: { name: 'Contato feito', entered: 38, advanced: 16, lost: 9 }
  };

  it('com funil e base: linhas, porcentagens, mediana e maior vazamento', () => {
    const html = render(createElement(StagePassageTable, {
      passage, needFunnel: false, hasBase: true, funnelName: 'Vendas', monthName: 'setembro', academyMedian: true
    }));
    expect(html).toContain('funil Vendas · movimentos gravados em setembro');
    expect(html).toContain('Contato feito: 38 entraram, 16 avançaram, 9 se perderam, 13 seguem na etapa. Mediana de 4 dias na etapa.');
    expect(html).toContain('42%');
    expect(html).toContain('Maior vazamento: Contato feito, 9 perdidos de 38.');
    expect(html).toContain('mediana da academia');
  });

  it('sem funil e sem base: o cartão explica', () => {
    expect(render(createElement(StagePassageTable, { passage: null, needFunnel: true, hasBase: true, funnelName: '', monthName: 'setembro' })))
      .toContain('Escolha um funil para ver a passagem entre etapas');
    expect(render(createElement(StagePassageTable, { passage: null, needFunnel: false, hasBase: false, funnelName: 'Vendas', monthName: 'julho' })))
      .toContain('A passagem entre etapas começa em setembro de 2026');
  });

  it('perdas: motivo mais comum, participação e etapa da perda', () => {
    const html = render(createElement(LossCard, {
      losses: { total: 17, reasons: [{ name: 'Sem interesse', count: 7 }, { name: 'Preço', count: 5 }, { name: 'Não responde', count: 5 }] },
      lossStages: [{ name: 'Contato feito', count: 7 }, { name: 'Novo lead', count: 4 }],
      stageBase: true,
      monthName: 'setembro'
    }));
    expect(html).toContain('17 leads perdidos em setembro');
    expect(html).toContain('Sem interesse');
    expect(html).toContain('7 de 17 · 41%');
    expect(html).toContain('Perdidos na etapa Contato feito: 7 de 11');
  });

  it('perdas sem base de etapa e mês sem perda', () => {
    const noBase = render(createElement(LossCard, {
      losses: { total: 2, reasons: [{ name: 'Preço', count: 2 }] }, lossStages: null, stageBase: false, monthName: 'julho'
    }));
    expect(noBase).toContain('Em julho os motivos estão completos, a etapa não tem base.');
    const empty = render(createElement(LossCard, { losses: { total: 0, reasons: [] }, lossStages: [], stageBase: true, monthName: 'setembro' }));
    expect(empty).toContain('Nenhum lead perdido neste mês.');
    expect(empty).toContain('nenhuma perda registrada');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: FAIL, os dois componentes não existem.

- [ ] **Step 3: Escrever `src/views/dashboard/StagePassageTable.jsx`**

```jsx
// Passagem entre etapas (handoff do CRM, linhas 324 a 369). Para cada etapa do
// funil escolhido: quantos entraram no mês, quantos avançaram, quantos se
// perderam a partir dela e o tempo mediano na etapa. Só existe com um funil
// escolhido e a partir de setembro de 2026; nos outros casos, o cartão
// tracejado explica. No celular vira lista por etapa, com as três
// porcentagens em linha (README §5).
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { fmtDuration } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { CrmCard, DashedNote, ScopeTag, Swatch } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[118px_minmax(0,1fr)_42px_42px_68px] items-center gap-2.5';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground';
const LOST = 'bg-danger dark:bg-[#E11D48]';
const STAY = 'bg-slate-400/25';
const pctLabel = (v) => (v == null ? '—' : `${v}%`);

function Row({ r, maxEntered }) {
  // A perda conta à parte das entradas do mês (quem entrou antes e se perdeu
  // agora também conta), então a barra limita cada trecho ao que sobra.
  const adv = r.entered ? Math.min(r.advanced, r.entered) : 0;
  const lost = r.entered ? Math.min(r.lost, r.entered - adv) : 0;
  const stay = Math.max(0, r.entered - adv - lost);
  const share = (v) => `${r.entered ? Math.round((v / r.entered) * 100) : 0}%`;
  const advPct = pct(r.advanced, r.entered);
  const lostPct = pct(r.lost, r.entered);
  const staying = Math.max(0, r.entered - r.advanced - r.lost);
  const lostHigh = r.entered > 0 && r.lost / r.entered >= 0.2;
  const tip = `${r.name}: ${fmtNum(r.entered)} entraram, ${fmtNum(r.advanced)} avançaram, ${fmtNum(r.lost)} se perderam, ${fmtNum(staying)} seguem na etapa. Mediana de ${fmtDuration(r.medianMin)} na etapa.`;
  return (
    <>
      <div className={cn(GRID, 'hidden h-10 border-t md:grid', RULE)}>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">{r.name}</div>
          <div className="num text-[10.5px] text-muted-foreground">{`${fmtNum(r.entered)} entraram`}</div>
        </div>
        <ChartMark
          tip={tip}
          className="flex h-4 min-w-3 overflow-hidden rounded-[5px] bg-muted"
          style={{ width: `${Math.round((r.entered / maxEntered) * 100)}%` }}
        >
          <i className="block h-full bg-brand-600" style={{ width: share(adv) }} />
          <i className={cn('block h-full', LOST)} style={{ width: share(lost) }} />
          <i className={cn('block h-full', STAY)} style={{ width: share(stay) }} />
        </ChartMark>
        <span className="num text-right text-[12.5px] font-semibold">{pctLabel(advPct)}</span>
        <span className={cn('num text-right text-[12.5px]', lostHigh ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>{pctLabel(lostPct)}</span>
        <span className="num text-right text-[12px] text-muted-foreground">{fmtDuration(r.medianMin)}</span>
      </div>
      <div className={cn('border-t py-2.5 md:hidden', RULE)}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12.5px] font-semibold">{r.name}</span>
          <span className="num flex-none text-[11px] text-muted-foreground">{`${fmtNum(r.entered)} entraram`}</span>
        </div>
        <div className="num mt-0.5 text-[11.5px] text-muted-foreground">
          {`avançaram ${pctLabel(advPct)} · perderam ${pctLabel(lostPct)} · mediana ${fmtDuration(r.medianMin)}`}
        </div>
      </div>
    </>
  );
}

export function StagePassageTable({ passage, needFunnel, hasBase, funnelName, monthName, academyMedian = false }) {
  const hint = needFunnel ? 'escolha um funil' : `funil ${funnelName} · movimentos gravados em ${monthName}`;
  const rows = passage?.rows || [];
  const ok = !needFunnel && hasBase && Boolean(passage);
  const maxEntered = Math.max(1, ...rows.map((r) => r.entered));
  let empty = null;
  if (needFunnel) {
    empty = (
      <DashedNote
        title="Escolha um funil para ver a passagem entre etapas"
        text="Cada funil tem as suas etapas, e etapa de funis diferentes não soma. Selecione um funil na barra de cima."
      />
    );
  } else if (!hasBase) {
    empty = (
      <DashedNote
        title="A passagem entre etapas começa em setembro de 2026"
        text="A troca de etapa passou a ser gravada em setembro de 2026. Antes disso não existe base para dizer quantos avançaram ou se perderam em cada etapa, e inventar o número seria pior que não mostrar."
      />
    );
  } else if (!ok || rows.length === 0) {
    empty = <DashedNote title="Nenhuma troca de etapa gravada neste mês." />;
  }
  return (
    <CrmCard title="Passagem entre etapas" hint={hint} action={!empty && academyMedian ? <ScopeTag>mediana da academia</ScopeTag> : null}>
      {empty ? (
        <div className="p-[18px]">{empty}</div>
      ) : (
        <div className="px-[18px] pb-4 pt-2.5">
          <div className={cn(GRID, 'hidden h-[26px] md:grid', HEAD)}>
            <span>Etapa</span>
            <span>Entraram, avançaram, perderam</span>
            <span className="text-right">Avan.</span>
            <span className="text-right">Perda</span>
            <span className="text-right">Mediana</span>
          </div>
          {rows.map((r) => <Row key={r.name} r={r} maxEntered={maxEntered} />)}
          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            <Swatch className="bg-brand-600">avançou</Swatch>
            <Swatch className={LOST}>perdeu</Swatch>
            <Swatch className={STAY}>segue na etapa</Swatch>
            {passage.worst && (
              <span className="num text-[11px] text-muted-foreground">
                {`Maior vazamento: ${passage.worst.name}, ${fmtNum(passage.worst.lost)} ${passage.worst.lost === 1 ? 'perdido' : 'perdidos'} de ${fmtNum(passage.worst.entered)}.`}
              </span>
            )}
          </div>
        </div>
      )}
    </CrmCard>
  );
}
```

- [ ] **Step 4: Escrever `src/views/dashboard/LossCard.jsx`**

```jsx
// Perdas do mês (handoff do CRM, linhas 371 a 426; vazio, 715 a 724): o motivo
// mais comum em destaque, a cápsula de participação com a lista, e o
// sub-bloco da etapa em que o lead se perdeu. Nenhum rótulo dentro do
// segmento (README §3): o número fica na legenda. Portado do .dc.html, e não
// com o BreakdownCard (Decisão 4 do plano).
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { LOSS_PALETTE } from './dashTokens.js';
import { CrmCard, DashedNote, Eyebrow } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';

function LossStages({ stages, stageBase, monthName }) {
  if (!stageBase) {
    return (
      <p className="mt-2 text-pretty text-[11.5px] leading-normal text-muted-foreground">
        {`A etapa da perda só existe a partir de setembro de 2026, quando o sistema passou a gravar a troca de etapa. Em ${monthName} os motivos estão completos, a etapa não tem base.`}
      </p>
    );
  }
  if (!stages.length) {
    return <p className="mt-2 text-[11.5px] leading-normal text-muted-foreground">Nenhuma perda com etapa gravada neste mês.</p>;
  }
  const total = stages.reduce((a, s) => a + s.count, 0);
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="mt-[9px] flex flex-col gap-1.5">
      {stages.map((s) => (
        <div key={s.name} className="grid grid-cols-[96px_minmax(0,1fr)_24px] items-center gap-[9px]">
          <span className="truncate text-[11.5px] text-foreground/80">{s.name}</span>
          <ChartMark
            tip={`Perdidos na etapa ${s.name}: ${fmtNum(s.count)} de ${fmtNum(total)}`}
            className="block h-2.5 min-w-[3px] rounded-[5px] bg-danger/85 dark:bg-[#E11D48]/85"
            style={{ width: `${Math.round((s.count / max) * 100)}%` }}
          />
          <span className="num text-right text-[11.5px] font-semibold">{fmtNum(s.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function LossCard({ losses, lossStages, stageBase, monthName }) {
  const total = losses?.total || 0;
  const reasons = (losses?.reasons || []).map((r, i) => ({
    ...r,
    pct: pct(r.count, total),
    color: LOSS_PALETTE[i % LOSS_PALETTE.length]
  }));
  const leader = reasons[0];
  const hint = total > 0 ? `${plural(total, 'lead perdido', 'leads perdidos')} em ${monthName}` : 'nenhuma perda registrada';
  return (
    <CrmCard title="Perdas" hint={hint}>
      {total === 0 || !leader ? (
        <div className="flex flex-1 p-[18px]">
          <DashedNote
            className="grid flex-1 place-content-center py-8"
            title="Nenhum lead perdido neste mês."
            text="Ninguém marcou perda no período. Se o time descarta sem registrar o motivo, este card fica vazio mesmo com leads saindo do funil."
          />
        </div>
      ) : (
        <div className="flex-1 px-[18px] py-4">
          <Eyebrow>Motivo mais comum</Eyebrow>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="num font-display text-[32px] font-bold leading-[0.9] text-accent-500 dark:text-accent-400">{fmtNum(leader.count)}</span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{leader.name}</div>
              <div className="num text-[11.5px] text-muted-foreground">{`${fmtNum(leader.count)} de ${fmtNum(total)} · ${leader.pct}%`}</div>
            </div>
          </div>
          <div
            className="mt-3.5 flex h-[34px] overflow-hidden rounded-[9px] bg-muted"
            role="img"
            aria-label={`Participação dos motivos: ${reasons.map((r) => `${r.name} ${r.pct}%`).join(', ')}`}
          >
            {reasons.map((r) => (
              <div key={r.name} className={cn('h-full min-w-1 border-r-2 border-white last:border-r-0 dark:border-ink-800', r.color)} style={{ width: `${r.pct}%` }} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-[7px]">
            {reasons.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <i className={cn('block size-[9px] flex-none rounded-full', r.color)} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{r.name}</span>
                <span className="num text-[12.5px] font-bold">{fmtNum(r.count)}</span>
                <span className="num w-[34px] text-right text-[11.5px] text-muted-foreground">{`${r.pct}%`}</span>
              </div>
            ))}
          </div>
          <div className={cn('mt-3.5 border-t pt-3', RULE)}>
            <Eyebrow>Etapa em que se perdeu</Eyebrow>
            <LossStages stages={lossStages || []} stageBase={stageBase} monthName={monthName} />
          </div>
        </div>
      )}
    </CrmCard>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/StagePassageTable.jsx src/views/dashboard/LossCard.jsx src/lib/__tests__/crm.components.test.js
git commit -m "feat: cards de passagem entre etapas e de perdas do CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Pessoas e professores (`PeopleConversionTable`, `ProfessorCard`)

**Files:**
- Create: `src/views/dashboard/PeopleConversionTable.jsx`, `src/views/dashboard/ProfessorCard.jsx`
- Test: `src/lib/__tests__/crm.components.test.js` (acrescentar)

- [ ] **Step 1: Acrescentar o teste que falha**

Imports:

```js
import { PeopleConversionTable } from '../../views/dashboard/PeopleConversionTable.jsx';
import { ProfessorCard } from '../../views/dashboard/ProfessorCard.jsx';
```

No fim do arquivo:

```js
describe('pessoas e professores', () => {
  const m = (over) => ({ leads: 18, appts: { total: 6, rate: 83 }, enroll: 11, cohort: { conv: 22 }, firstContact: { median: 42 }, ...over });
  const users = [{ id: 'ana', name: 'Ana Ribeiro', role: 'consultant' }, { id: 'marcos', name: 'Marcos Lima', role: 'admin' }];

  it('uma linha por pessoa, clicável, com a conversão da safra e o primeiro contato', () => {
    const html = render(createElement(PeopleConversionTable, {
      rows: [{ user: users[0], m: m() }, { user: users[1], m: m({ firstContact: { median: 300 } }) }],
      others: m({ leads: 0, appts: { total: 0, rate: null }, enroll: 0 }),
      person: null, personName: null, onPick: () => {}, onClear: () => {}
    }));
    expect(html).toContain('clique numa linha para filtrar a tela por essa pessoa');
    expect(html).toContain('Filtrar a tela por Ana Ribeiro');
    expect(html).toContain('Gestor');
    expect(html).toContain('42 min');
    expect(html).toContain('5 h');
    expect(html).toContain('text-rose-700');
    expect(html).not.toContain('fora da equipe ou sem responsável');
  });

  it('com pessoa escolhida: o botão para voltar à equipe toda', () => {
    const html = render(createElement(PeopleConversionTable, {
      rows: [{ user: users[0], m: m() }], others: null, person: 'ana', personName: 'Ana Ribeiro', onPick: () => {}, onClear: () => {}
    }));
    expect(html).toContain('Ver a equipe toda');
    expect(html).toContain('aria-pressed="true"');
  });

  it('professores: ranking, treina sozinho à parte e a etiqueta da academia', () => {
    const html = render(createElement(ProfessorCard, {
      professors: {
        rows: [{ id: 'p1', name: 'Paula Nunes', solo: false, done: 4, missed: 1, enrolled: 2, conv: 50, mods: [{ name: 'Funcional', count: 3 }, { name: 'Musculação', count: 1 }] }],
        solo: { id: null, name: 'Treina sozinho', solo: true, done: 1, missed: 0, enrolled: 1, conv: 100, mods: [{ name: 'Musculação', count: 1 }] },
        done: 5
      },
      monthName: 'setembro',
      scoped: true
    }));
    expect(html).toContain('5 aulas realizadas em setembro');
    expect(html).toContain('4 realizadas · 1 falta · Funcional 3 · Musculação 1');
    expect(html).toContain('Treina sozinho');
    expect(html).toContain('academia inteira');
    expect(html).toContain('2/4');
  });

  it('professores sem aula no mês', () => {
    expect(render(createElement(ProfessorCard, { professors: { rows: [], solo: null, done: 0 }, monthName: 'julho', scoped: false })))
      .toContain('Nenhuma aula experimental realizada neste mês.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: FAIL, os dois componentes não existem.

- [ ] **Step 3: Escrever `src/views/dashboard/PeopleConversionTable.jsx`**

```jsx
// Conversão por pessoa (handoff do CRM, linhas 440 a 478): uma linha por
// pessoa, clicável para filtrar a tela; clicar de novo na mesma linha limpa.
// Com uma pessoa escolhida, a tabela reduz à linha dela e ganha o botão "Ver a
// equipe toda". A linha Outros junta quem está fora da equipe e não filtra.
// É uma tabela diferente da do Operacional de propósito: outras colunas e
// outra regra de atribuição (README §2). No celular vira lista.
import { Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { fmtDuration } from '../../lib/crm/format.js';
import { dashInitials } from './dashTokens.js';
import { CrmCard, ReadText } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[minmax(0,1fr)_44px_48px_52px_48px_116px_78px] items-center gap-2.5';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground';
const FOOT = 'Conversão da safra: dos leads que a pessoa captou no mês, quantos já matricularam. Nunca passa de 100%, e é diferente de matrículas, que conta o que ela fechou no mês vindo de qualquer safra.';
const OTHERS_SUB = 'fora da equipe ou sem responsável';

const roleOf = (user) => (user.role === 'admin' ? 'Gestor' : 'Consultor');
const pctText = (v) => (v == null ? '—' : `${v}%`);
const numText = (v) => (v == null ? '—' : fmtNum(v));

const valuesOf = (m) => ({
  leads: m?.leads ?? null,
  appts: m?.appts?.total ?? null,
  attend: m?.appts?.rate ?? null,
  enroll: m?.enroll ?? null,
  conv: m?.cohort?.conv ?? null,
  fc: m?.firstContact?.median ?? null
});

const mobileLine = (v) =>
  `${numText(v.leads)} leads · ${numText(v.appts)} agend. · compar. ${pctText(v.attend)} · ${numText(v.enroll)} matr. · 1º contato ${fmtDuration(v.fc)}`;

function Avatar({ name, others = false }) {
  return (
    <span
      className={cn(
        'num grid size-8 flex-none place-items-center rounded-[9px] font-display text-[12px] font-semibold',
        others ? 'bg-muted text-muted-foreground' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
      )}
    >
      {others ? <Users size={14} strokeWidth={2.2} /> : dashInitials(name)}
    </span>
  );
}

function Who({ name, sub, others = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} others={others} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function Cells({ v }) {
  return (
    <>
      <span className="num text-right text-[13px]">{numText(v.leads)}</span>
      <span className="num text-right text-[13px] text-muted-foreground">{numText(v.appts)}</span>
      <span className="num text-right text-[13px] text-muted-foreground">{pctText(v.attend)}</span>
      <span className="num text-right text-[13px] font-semibold">{numText(v.enroll)}</span>
      <div className="flex items-center gap-[9px]">
        <span className="relative block h-2.5 flex-1 overflow-hidden rounded-[5px] bg-muted">
          <i className="absolute inset-y-0 left-0 rounded-[5px] bg-brand-600" style={{ width: `${Math.min(100, v.conv || 0)}%` }} />
        </span>
        <span className="num w-[34px] text-right text-[13px] font-bold">{pctText(v.conv)}</span>
      </div>
      <span className={cn('num text-right text-[12px]', v.fc != null && v.fc > 240 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
        {fmtDuration(v.fc)}
      </span>
    </>
  );
}

export function PeopleConversionTable({ rows, others, person, personName, onPick, onClear }) {
  const list = rows || [];
  const o = others ? valuesOf(others) : null;
  const showOthers = Boolean(o) && ((o.leads || 0) > 0 || (o.appts || 0) > 0 || (o.enroll || 0) > 0);
  const action = person ? (
    <button
      type="button"
      onClick={onClear}
      className="h-7 flex-none rounded-[9px] border border-border bg-card px-[11px] text-[11.5px] font-semibold text-foreground/80 hover:bg-muted/70"
    >
      Ver a equipe toda
    </button>
  ) : null;

  return (
    <CrmCard title="Conversão por pessoa" hint={person ? personName : 'clique numa linha para filtrar a tela por essa pessoa'} action={action}>
      <div className="px-[18px] pb-4 pt-2.5">
        <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[560px]">
            <div className={cn(GRID, 'h-[26px]', HEAD)}>
              <span>Pessoa</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Agend.</span>
              <span className="text-right">Compar.</span>
              <span className="text-right">Matr.</span>
              <span>Conversão da safra</span>
              <span className="text-right">1º contato</span>
            </div>
            {list.map(({ user, m }) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onPick(user.id)}
                aria-label={`Filtrar a tela por ${user.name || 'Sem nome'}`}
                aria-pressed={person === user.id}
                className={cn(
                  GRID,
                  'h-[52px] w-full cursor-pointer rounded-lg border-t text-left outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40',
                  RULE,
                  person === user.id && 'bg-brand-50 dark:bg-brand-500/10'
                )}
              >
                <Who name={user.name || 'Sem nome'} sub={roleOf(user)} />
                <Cells v={valuesOf(m)} />
              </button>
            ))}
            {showOthers && (
              <div className={cn(GRID, 'h-[52px] border-t', RULE)}>
                <Who name="Outros" sub={OTHERS_SUB} others />
                <Cells v={o} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[9px] md:hidden">
          {list.map(({ user, m }) => {
            const v = valuesOf(m);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onPick(user.id)}
                className="flex w-full items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <Avatar name={user.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{user.name || 'Sem nome'}</div>
                  <div className="num truncate text-[10.5px] text-muted-foreground">{mobileLine(v)}</div>
                </div>
                <span className="num flex-none text-[15px] font-bold">{pctText(v.conv)}</span>
              </button>
            );
          })}
          {showOthers && (
            <div className="flex items-center gap-2.5">
              <Avatar others />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">Outros</div>
                <div className="num truncate text-[10.5px] text-muted-foreground">{mobileLine(o)}</div>
              </div>
              <span className="num flex-none text-[15px] font-bold">{pctText(o.conv)}</span>
            </div>
          )}
        </div>
        <ReadText>{FOOT}</ReadText>
      </div>
    </CrmCard>
  );
}
```

- [ ] **Step 4: Escrever `src/views/dashboard/ProfessorCard.jsx`**

```jsx
// Aulas experimentais por professor (handoff do CRM, linhas 480 a 509). Da
// academia inteira, sempre: uma aula é do professor, não do consultor. Com
// pessoa ou funil escolhido, a etiqueta "academia inteira" diz isso na cara.
// Treina sozinho é a linha de referência, fora do ranking.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { dashInitials } from './dashTokens.js';
import { CrmCard, DashedNote, ReadText, ScopeTag } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';

function ProfRow({ p, max }) {
  const mods = (p.mods || []).map((x) => `${x.name} ${fmtNum(x.count)}`).join(' · ');
  const sub = `${plural(p.done, 'realizada', 'realizadas')} · ${plural(p.missed, 'falta', 'faltas')}${mods ? ` · ${mods}` : ''}`;
  const tip = `${p.name}: ${plural(p.done, 'aula realizada', 'aulas realizadas')}, ${plural(p.missed, 'falta', 'faltas')}, ${plural(p.enrolled, 'matrícula', 'matrículas')}${p.conv == null ? '' : ` (${p.conv}%)`}`;
  const good = !p.solo && p.conv != null && p.conv >= 50;
  return (
    <div className={cn('flex items-center gap-[11px] border-t py-[11px]', RULE)}>
      <span
        className={cn(
          'num grid size-[34px] flex-none place-items-center rounded-[10px] font-display text-[12px] font-semibold',
          p.solo ? 'border-[1.5px] border-dashed border-border text-muted-foreground' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
        )}
      >
        {p.solo ? '—' : dashInitials(p.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{p.name}</div>
        <div className="num truncate text-[11px] text-muted-foreground">{sub}</div>
        <ChartMark tip={tip} className="relative mt-[5px] block h-[9px] rounded-[5px] bg-muted">
          <i
            className={cn('absolute inset-y-0 left-0 rounded-[5px]', p.solo ? 'bg-slate-400' : 'bg-brand-600')}
            style={{ width: `${max > 0 ? Math.round((p.done / max) * 100) : 0}%` }}
          />
        </ChartMark>
      </div>
      <div className="w-14 flex-none text-right">
        <div className={cn('num font-display text-[19px] font-bold leading-none', p.solo ? 'text-muted-foreground' : good ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
          {p.conv == null ? '—' : `${p.conv}%`}
        </div>
        <div className="num mt-0.5 text-[10.5px] text-muted-foreground">{`${fmtNum(p.enrolled)}/${fmtNum(p.done)}`}</div>
      </div>
    </div>
  );
}

export function ProfessorCard({ professors, monthName, scoped }) {
  const rows = professors?.rows || [];
  const solo = professors?.solo || null;
  const done = professors?.done || 0;
  const all = solo ? [...rows, solo] : rows;
  const max = Math.max(1, ...all.map((p) => p.done));
  const hint = `${plural(done, 'aula realizada', 'aulas realizadas')} em ${monthName}`;
  const smallBase = done > 0 && done < 30
    ? ` Com ${plural(done, 'aula', 'aulas')} no período, a diferença entre dois professores ainda cabe numa matrícula de sorte.`
    : '';
  const foot = `Conversão do professor: matrículas ÷ aulas realizadas. Treina sozinho é a linha de referência, fora do ranking: é a aula sem professor designado.${smallBase}`;
  return (
    <CrmCard
      title="Aulas experimentais por professor"
      hint={hint}
      action={scoped ? <ScopeTag tone="amber">academia inteira</ScopeTag> : null}
    >
      <div className="px-[18px] pb-4 pt-2">
        {all.length === 0 ? (
          <div className="pt-2.5"><DashedNote title="Nenhuma aula experimental realizada neste mês." /></div>
        ) : (
          <>
            {all.map((p) => <ProfRow key={p.id || 'solo'} p={p} max={max} />)}
            <ReadText>{foot}</ReadText>
          </>
        )}
      </div>
    </CrmCard>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/PeopleConversionTable.jsx src/views/dashboard/ProfessorCard.jsx src/lib/__tests__/crm.components.test.js
git commit -m "feat: conversão por pessoa e aulas por professor no CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: Velocidade e carteira agora (`SpeedCards`, `PipelineNowCards`)

**Files:**
- Create: `src/views/dashboard/SpeedCards.jsx`, `src/views/dashboard/PipelineNowCards.jsx`
- Test: `src/lib/__tests__/crm.components.test.js` (acrescentar)

Ajuste de texto em relação ao handoff (humanizer e honestidade do número): a leitura de "Dias até a matrícula" perde o travessão e a frase que dizia que as matrículas de safras anteriores vêm do grupo lento. Um lead cadastrado no dia 31 e matriculado no dia 1 é de safra anterior e fechou em um dia, então a frase não vale sempre.

- [ ] **Step 1: Acrescentar o teste que falha**

Imports:

```js
import { FirstContactCard, DaysToEnrollCard } from '../../views/dashboard/SpeedCards.jsx';
import { PipelineNowCard, NoNextContactCard } from '../../views/dashboard/PipelineNowCards.jsx';
```

No fim do arquivo:

```js
describe('velocidade e carteira agora', () => {
  it('primeiro contato: mediana, diferença e as quatro faixas', () => {
    const html = render(createElement(FirstContactCard, {
      fc: { total: 56, h1: 21, h24: 23, over: 5, none: 7, median: 130 },
      delta: { up: false, text: '40 min' }
    }));
    expect(html).toContain('2 h 10 min');
    expect(html).toContain('▼ 40 min');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('Até 1 hora: 21 leads de 56 (38%)');
    expect(html).toContain('Sem contato');
  });

  it('dias até a matrícula: histograma e leitura', () => {
    const html = render(createElement(DaysToEnrollCard, {
      dte: { total: 29, median: 6, buckets: [5, 6, 8, 5, 3, 2] },
      delta: { none: true, text: 'sem base' }
    }));
    expect(html).toContain('6 dias');
    expect(html).toContain('sem base');
    expect(html).toContain('4 a 7 dias entre cadastro e matrícula: 8 de 29 matrículas (28%)');
    expect(html).toContain('19 das 29 matrículas fecharam em até 7 dias.');
  });

  it('carteira agora por funil e o card de sem próximo contato', () => {
    const html = render(createElement(PipelineNowCard, {
      now: { total: 87, noNext: 23, rows: [{ id: 'ven', name: 'Vendas', count: 72 }, { id: 'ind', name: 'Indicações', count: 15 }] },
      funnelName: null,
      personName: null
    }));
    expect(html).toContain('Em jogo por funil');
    expect(html).toContain('87 leads abertos agora');
    expect(html).toContain('Funil Vendas: 72 leads em jogo agora');
    const red = render(createElement(NoNextContactCard, { count: 23, total: 87 }));
    expect(red).toContain('Sem próximo contato');
    expect(red).toContain('de 87 em jogo');
    expect(red).toContain('até alguém marcar o próximo contato');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js`
Expected: FAIL, os componentes não existem.

- [ ] **Step 3: Escrever `src/views/dashboard/SpeedCards.jsx`**

```jsx
// Velocidade (handoff do CRM, linhas 523 a 584). O tempo até o primeiro
// contato tem a mediana e a distribuição em quatro faixas; a mediana entra
// com os sem contato no fim da fila (censura à direita). Os dias do cadastro
// até a matrícula vão num histograma de seis faixas, que no celular mantém as
// colunas e perde o número de cima.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { fmtDuration, fmtDays, plural } from '../../lib/crm/format.js';
import { DAYS_BUCKETS } from '../../lib/crm/cohort.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';
import { CrmCard, DashedNote, DeltaPill, ReadText } from './CrmParts.jsx';

const FC_HELP = 'Tempo corrido entre o cadastro do lead e a primeira interação registrada por alguém da equipe. A mediana entra com os leads sem contato no fim da fila, então ela não fica bonita por esconder quem nunca foi atendido.';
const FC_READ = 'A mediana entra com os leads sem contato no fim da fila, em vez de calcular só entre quem foi atendido. Lead que espera mais de um dia costuma já ter marcado em outra academia.';
const SEGMENT = 'block h-full min-w-[6px] border-r-2 border-white last:border-r-0 dark:border-ink-800';
const BAR_MAX_PX = 88;

function BigNumber({ value, delta }) {
  return (
    <div className="flex items-end gap-3">
      <span className="num font-display text-[34px] font-bold leading-[0.9] tracking-[-0.02em]">{value}</span>
      <span className="pb-[3px] text-[11.5px] text-muted-foreground">de mediana</span>
      {delta && <span className="ml-auto"><DeltaPill delta={delta} lowerBetter /></span>}
    </div>
  );
}

export function FirstContactCard({ fc, delta }) {
  const total = fc?.total || 0;
  const help = <DashHelpTip text={FC_HELP} label="Como o tempo até o primeiro contato é medido" />;
  const title = 'Tempo até o primeiro contato';
  const hint = 'do cadastro até a primeira interação da equipe';
  if (!total) {
    return (
      <CrmCard title={title} hint={hint} action={help}>
        <div className="p-[18px]"><DashedNote title="Nenhum lead cadastrado neste mês." /></div>
      </CrmCard>
    );
  }
  const buckets = [
    { name: 'Até 1 hora', count: fc.h1, bar: 'bg-success dark:bg-[#0E9F6E]' },
    { name: 'Até 24 horas', count: fc.h24, bar: 'bg-amber-500 dark:bg-amber-600' },
    { name: 'Mais de 24 horas', count: fc.over, bar: 'bg-danger dark:bg-[#E11D48]' },
    { name: 'Sem contato', count: fc.none, bar: 'bg-slate-400 dark:bg-slate-500' }
  ];
  return (
    <CrmCard title={title} hint={hint} action={help}>
      <div className="px-[18px] py-4">
        <BigNumber value={fmtDuration(fc.median)} delta={delta} />
        <div className="mt-4 flex h-[34px] overflow-hidden rounded-[9px] bg-muted">
          {buckets.filter((b) => b.count > 0).map((b) => (
            <ChartMark
              key={b.name}
              tip={`${b.name}: ${plural(b.count, 'lead', 'leads')} de ${fmtNum(total)} (${pct(b.count, total)}%)`}
              className={cn(SEGMENT, b.bar)}
              style={{ width: `${Math.round((b.count / total) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-[7px]">
          {buckets.map((b) => (
            <div key={b.name} className="flex items-center gap-2">
              <i className={cn('block size-[9px] flex-none rounded-[3px]', b.bar)} />
              <span className="min-w-0 flex-1 text-[12.5px]">{b.name}</span>
              <span className="num text-[12.5px] font-bold">{fmtNum(b.count)}</span>
              <span className="num w-[38px] text-right text-[11.5px] text-muted-foreground">{`${pct(b.count, total)}%`}</span>
            </div>
          ))}
        </div>
        <ReadText>{FC_READ}</ReadText>
      </div>
    </CrmCard>
  );
}

function daysRead(counts, total) {
  const fast = counts[0] + counts[1] + counts[2];
  if (total === 1) {
    return fast === 1 ? 'A única matrícula do mês fechou em até 7 dias.' : 'A única matrícula do mês levou mais de 7 dias.';
  }
  const lead = `${fmtNum(fast)} das ${fmtNum(total)} matrículas ${fast === 1 ? 'fechou' : 'fecharam'} em até 7 dias.`;
  return fast < total
    ? `${lead} O resto é acompanhamento longo, o tipo de lead que cai do radar quando ninguém marca o próximo contato.`
    : lead;
}

export function DaysToEnrollCard({ dte, delta }) {
  const total = dte?.total || 0;
  const title = 'Dias até a matrícula';
  const hint = 'entre o cadastro do lead e a matrícula';
  if (!total) {
    return (
      <CrmCard title={title} hint={hint}>
        <div className="p-[18px]"><DashedNote title="Nenhuma matrícula neste mês." /></div>
      </CrmCard>
    );
  }
  const counts = dte.buckets;
  const max = Math.max(1, ...counts);
  return (
    <CrmCard title={title} hint={hint}>
      <div className="px-[18px] py-4">
        <BigNumber value={fmtDays(dte.median)} delta={delta} />
        <div className="mt-4 grid h-[132px] grid-cols-6 items-end gap-2">
          {DAYS_BUCKETS.map((b, i) => (
            <div key={b.name} className="flex h-full flex-col items-center justify-end gap-1.5">
              <span className={cn('num hidden text-[11.5px] font-bold md:block', counts[i] === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                {fmtNum(counts[i])}
              </span>
              <ChartMark
                tip={`${b.name} dias entre cadastro e matrícula: ${fmtNum(counts[i])} de ${plural(total, 'matrícula', 'matrículas')} (${pct(counts[i], total)}%)`}
                className={cn('block w-full min-h-[3px] rounded-t-md', i <= 2 ? 'bg-brand-600' : 'bg-brand-300 dark:bg-brand-400')}
                style={{ height: `${Math.round((counts[i] / max) * BAR_MAX_PX)}px` }}
              />
              <span className="num whitespace-nowrap text-[10.5px] text-muted-foreground">{i === DAYS_BUCKETS.length - 1 ? b.name : `${b.name} d`}</span>
            </div>
          ))}
        </div>
        <ReadText className="mt-3.5">{daysRead(counts, total)}</ReadText>
      </div>
    </CrmCard>
  );
}
```

- [ ] **Step 4: Escrever `src/views/dashboard/PipelineNowCards.jsx`**

```jsx
// Carteira agora (handoff do CRM, linhas 588 a 629; celular, 698 a 704): os
// leads em jogo neste instante, por funil (em Todos os funis) ou por etapa, e
// o card vermelho dos que estão em jogo sem próximo contato marcado. Esses não
// aparecem na Meta Diária de ninguém. Só no mês em andamento; no mês fechado
// a tela mostra o cartão tracejado no lugar.
import { TriangleAlert } from 'lucide-react';
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { CrmCard, DashedNote, ReadText } from './CrmParts.jsx';

export function PipelineNowCard({ now, funnelName, personName }) {
  const byFunnel = !funnelName;
  const rows = now?.rows || [];
  const total = now?.total || 0;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const hint = `${plural(total, 'lead aberto agora', 'leads abertos agora')}${personName ? ` na carteira de ${personName}` : ''}`;
  const tipOf = (r) => {
    const what = plural(r.count, 'lead em jogo agora', 'leads em jogo agora');
    if (!byFunnel) return `Etapa ${r.name}: ${what}`;
    return r.id ? `Funil ${r.name}: ${what}` : `${r.name}: ${what}`;
  };
  const read = byFunnel
    ? 'Etapa de funis diferentes não soma, então em Todos os funis a carteira aparece por funil. Escolha um funil na barra de cima para ver a fila por etapa.'
    : `Leads abertos no funil ${funnelName} agora, de qualquer safra. Não é o mês: é a fila que existe neste instante.`;
  return (
    <CrmCard title={byFunnel ? 'Em jogo por funil' : 'Em jogo por etapa'} hint={hint}>
      <div className="flex flex-col gap-2.5 px-[18px] pb-4 pt-3.5">
        {total === 0 ? (
          <DashedNote title="Nenhum lead em jogo agora." />
        ) : rows.map((r) => (
          <div key={r.id ?? r.name} className="grid grid-cols-[132px_minmax(0,1fr)_34px] items-center gap-3">
            <span className="truncate text-[12.5px] font-medium">{r.name}</span>
            <ChartMark
              tip={tipOf(r)}
              className="block h-5 min-w-[3px] rounded-[5px] bg-brand-600/90"
              style={{ width: `${Math.round((r.count / max) * 100)}%` }}
            />
            <span className="num text-right text-[13px] font-bold">{fmtNum(r.count)}</span>
          </div>
        ))}
        <ReadText className="mt-1">{read}</ReadText>
      </div>
    </CrmCard>
  );
}

export function NoNextContactCard({ count, total }) {
  return (
    <section className="flex flex-col rounded-2xl border border-danger bg-rose-50 p-[18px] shadow-card dark:border-[#E11D48] dark:bg-rose-500/10">
      <div className="flex items-center gap-[9px]">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-danger text-white dark:bg-[#E11D48]">
          <TriangleAlert size={14} strokeWidth={2.4} />
        </span>
        <h4 className="m-0 text-[14px] font-semibold">Sem próximo contato</h4>
      </div>
      <div className="num mt-3.5 font-display text-[44px] font-bold leading-none tracking-[-0.02em] text-rose-700 dark:text-rose-300">{fmtNum(count)}</div>
      <div className="num mt-1 text-[12px] text-rose-700 dark:text-rose-300">{`de ${fmtNum(total)} em jogo`}</div>
      <p className="mt-3.5 text-pretty text-[12px] leading-[1.55] text-foreground/80">
        Leads em jogo sem data de próximo contato marcada. Eles não aparecem na Meta Diária de ninguém, então ficam parados até alguém marcar o próximo contato.
      </p>
    </section>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/crm.components.test.js && npm run lint`
Expected: PASS e 0 erros no lint.

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/SpeedCards.jsx src/views/dashboard/PipelineNowCards.jsx src/lib/__tests__/crm.components.test.js
git commit -m "feat: velocidade e carteira agora no CRM" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: A tela (`texts.js`, `CrmDashboard`, `DashboardCrmView`, App)

**Files:**
- Create: `src/lib/crm/texts.js` (textos que dependem dos números, puros e testados)
- Create: `src/views/dashboard/CrmDashboard.jsx` (apresentação: recebe as métricas prontas)
- Create: `src/views/dashboard/DashboardCrmView.jsx` (estado, carga, `metricsOf`)
- Modify: `src/views/dashboard/DashboardComingSoonView.jsx` e `src/lib/__tests__/DashboardComingSoonView.test.js` (fica só o Gerencial)
- Modify: `src/App.jsx:81` (import) e `src/App.jsx:1701` (a aba `dashCrm`)
- Test: `src/lib/__tests__/crm.dashboard.test.js`

A tela se divide em duas para ser testável sem Firestore: `CrmDashboard` só apresenta o que recebe, e `DashboardCrmView` cuida do estado dos filtros, da carga (`useCrmSources`) e das chamadas de `metricsOf`, no molde do Operacional (inclusive o "último retrato completo" enquanto o mês novo carrega).

- [ ] **Step 1: Escrever o teste que falha**

```js
// Textos que dependem dos números e render da tela do CRM com métricas de
// verdade (metricsOf num cenário pequeno), sem jsdom.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { metricsOf, seriesOf } from '../crm/metrics.js';
import { regimeTexts, channelRead, summaryItems, scopeNote } from '../crm/texts.js';
import { CrmDashboard } from '../../views/dashboard/CrmDashboard.jsx';

const NOW = new Date(2026, 8, 14, 12, 0);
const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const USERS = [{ id: 'ana', name: 'Ana Ribeiro' }];
const lead = (id, over) => ({ id, consultantId: 'ana', funnelId: 'ven', source: 'Instagram', status: 'Novo lead', createdAt: D(9, 2), ...over });
const LEADS = [
  lead('a', { status: 'Venda', isConverted: true, convertedAt: D(9, 5) }),
  lead('b', { status: 'Perda', lostAt: D(9, 6), lossReason: 'Preço' }),
  lead('c', { nextFollowUp: null })
];
const ctx = {
  now: NOW,
  users: USERS,
  funnels: [{ id: 'ven', name: 'Vendas', isDefault: true, order: 0 }],
  statuses: [{ name: 'Novo lead', funnelId: 'ven', order: 0 }],
  liveLeads: [LEADS[2]],
  leadsById: new Map(LEADS.map((l) => [l.id, l])),
  months: {
    '2026-09': { leadsCreated: LEADS, converted: [LEADS[0]], lost: [LEADS[1]], aulas: [], interactions: [] },
    '2026-08': { leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] }
  }
};
const render = (el) => renderToString(createElement(TooltipProvider, null, el));
const noSeries = { leads: [], appts: [], attend: [], enroll: [], conv: [] };

describe('textos do regime', () => {
  it('mês em andamento comparando, sem comparar, fechado e com agendamento incompleto', () => {
    expect(regimeTexts({ running: true, compareOn: true, dayN: 14, shownName: 'setembro', cmpName: 'agosto', apptsPartial: false })).toEqual({
      range: '1 a 14 de setembro',
      subline: '1 a 14 de setembro comparado com os 14 primeiros dias de agosto. O mês está em andamento, então a comparação é pró-rata e a conversão da safra ainda vai subir.',
      note: 'Pró-rata: mesmos 14 primeiros dias de agosto'
    });
    expect(regimeTexts({ running: true, compareOn: false, dayN: 14, shownName: 'setembro', cmpName: 'agosto' }).subline)
      .toBe('1 a 14 de setembro. O mês está em andamento: a conversão da safra de setembro ainda vai subir.');
    expect(regimeTexts({ running: false, compareOn: true, dayN: 14, shownName: 'agosto', cmpName: 'julho' }))
      .toMatchObject({ subline: 'agosto inteiro comparado com julho. Mês fechado.', note: 'Mês fechado contra mês fechado' });
    expect(regimeTexts({ running: false, compareOn: false, dayN: 14, shownName: 'julho', cmpName: 'junho', apptsPartial: true }))
      .toMatchObject({ subline: 'julho inteiro. Mês fechado. Os agendamentos de julho estão incompletos no histórico.', note: 'Sem comparativo · julho inteiro' });
    expect(scopeNote(null, null)).toBe('Equipe toda · Todos os funis');
    expect(scopeNote('Ana Ribeiro', 'Vendas')).toBe('Ana Ribeiro · Vendas');
  });
});

describe('leitura dos canais', () => {
  it('volume e resultado no mesmo canal, em canais diferentes e com pouco lead', () => {
    expect(channelRead({ channels: [{ name: 'Instagram', leads: 20, enrolled: 8 }, { name: 'Site', leads: 6, enrolled: 1 }] }))
      .toBe('Instagram é ao mesmo tempo o canal de maior volume e o de melhor conversão.');
    expect(channelRead({ channels: [{ name: 'Instagram', leads: 22, enrolled: 3 }, { name: 'Indicação', leads: 9, enrolled: 4 }] }))
      .toBe('Instagram traz o volume e Indicação traz o resultado: a conversão de Indicação é 3,1 vezes a de Instagram.');
    expect(channelRead({ channels: [{ name: 'Site', leads: 3, enrolled: 1 }] })).toBe('Poucos leads no período para comparar canais.');
  });
});

describe('faixa de resumo', () => {
  it('cinco células com sub-linha e sem diferença quando o comparativo está desligado', () => {
    const cur = metricsOf(ctx, { monthKey: '2026-09' });
    const items = summaryItems({ cur, cmp: null, series: noSeries, compareOn: false, shownName: 'setembro' });
    expect(items.map((i) => i.label)).toEqual(['Leads novos', 'Agendamentos', 'Comparecimento', 'Matrículas', 'Conversão da safra']);
    expect(items[0]).toMatchObject({ value: '3', sub: 'Instagram lidera com 3', delta: null });
    expect(items[3].sub).toBe('1 da safra de setembro · 0 de safras anteriores');
    expect(items[4]).toMatchObject({ value: '33%', sub: '1 de 3 · 1 ainda em jogo' });
    expect(items[1].flag).toBeNull();
  });

  it('agendamento antes de agosto de 2026: etiqueta e diferença sem base', () => {
    const jul = { ...metricsOf(ctx, { monthKey: '2026-09' }), apptsBase: false, running: false };
    const items = summaryItems({ cur: jul, cmp: jul, series: noSeries, compareOn: true, shownName: 'julho' });
    expect(items[1]).toMatchObject({ flag: 'incompleto', delta: { none: true, text: 'sem base' } });
    expect(items[2]).toMatchObject({ flag: 'incompleto', delta: { none: true, text: 'sem base' } });
  });
});

describe('tela do CRM (render)', () => {
  const props = (monthKey, shownName) => ({
    cur: metricsOf(ctx, { monthKey }),
    cmp: null,
    highlights: [],
    series: { ...noSeries, leads: seriesOf(ctx, { monthKey, pick: (m) => m.leads }) },
    team: { rows: [{ user: USERS[0], m: metricsOf(ctx, { monthKey, userId: 'ana' }) }], others: null },
    compareOn: false,
    shownName,
    person: null,
    personName: '',
    funnelId: null,
    funnelName: '',
    onPick: () => {},
    onClear: () => {}
  });

  it('mês em andamento: as cinco seções, a carteira de agora e a passagem pedindo um funil', () => {
    const html = render(createElement(CrmDashboard, props('2026-09', 'setembro')));
    ['>Origem</h3>', '>Funil</h3>', '>Pessoas</h3>', '>Velocidade</h3>', '>Carteira agora</h3>'].forEach((s) => expect(html).toContain(s));
    expect(html).toContain('Safra de setembro');
    expect(html).toContain('Escolha um funil para ver a passagem entre etapas');
    expect(html).toContain('Em jogo por funil');
    expect(html).toContain('Sem próximo contato');
    expect(html).toContain('Equipe toda · Todos os funis');
  });

  it('mês fechado: o cartão tracejado no lugar da carteira de agora', () => {
    const html = render(createElement(CrmDashboard, props('2026-08', 'agosto')));
    expect(html).toContain('A carteira agora só existe no mês em andamento');
    expect(html).not.toContain('Sem próximo contato');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/crm.dashboard.test.js`
Expected: FAIL, `../crm/texts.js` e `CrmDashboard.jsx` não existem.

- [ ] **Step 3: Escrever `src/lib/crm/texts.js`**

```js
// Textos da tela do CRM que dependem dos números: o regime de comparação, a
// nota do recorte, a leitura dos canais e as cinco células da faixa de resumo
// (README do handoff, §7). Puro; a tela só posiciona.

import { fmtNum } from '../format.js';
import { addMonthsToKey } from '../operacional/month.js';
import { pct } from './stats.js';
import { APPTS_COMPLETE_MONTH } from './scope.js';
import { crmDelta, bestChannelOf } from './metrics.js';

const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortOf = (key) => SHORT[Number(key.slice(5, 7)) - 1];

const HELP = {
  leads: 'Leads cadastrados no mês, pela data de cadastro. O filtro de pessoa usa o dono do lead e o de funil, o funil em que ele está.',
  appts: 'Visitas e aulas experimentais marcadas para o mês, sem as canceladas. Conta pela data do agendamento, não pela data do cadastro do lead.',
  attend: 'Quem veio ÷ quem veio mais quem faltou, entre os agendamentos com data já passada. Agendamento sem desfecho registrado fica fora da conta e aparece na linha de baixo.',
  enroll: 'Leads que viraram cliente no mês, de qualquer safra. É o resultado do mês, não a conversão da turma que entrou no mês.',
  conv: 'Dos leads cadastrados no mês, quantos já matricularam. No mês em andamento ela ainda sobe: quem segue em jogo pode fechar depois. A comparação pró-rata mede a safra do outro mês com a mesma idade.'
};

// O subtítulo do cabeçalho e a nota da barra, pelo regime de comparação.
export function regimeTexts({ running, compareOn, dayN, shownName, cmpName, apptsPartial = false }) {
  const range = running ? (dayN === 1 ? `1 de ${shownName}` : `1 a ${dayN} de ${shownName}`) : `${shownName} inteiro`;
  const firstDays = dayN === 1 ? 'o primeiro dia' : `os ${dayN} primeiros dias`;
  let subline;
  if (running && compareOn) {
    subline = `${range} comparado com ${firstDays} de ${cmpName}. O mês está em andamento, então a comparação é pró-rata e a conversão da safra ainda vai subir.`;
  } else if (running) {
    subline = `${range}. O mês está em andamento: a conversão da safra de ${shownName} ainda vai subir.`;
  } else if (compareOn) {
    subline = `${range} comparado com ${cmpName}. Mês fechado.`;
  } else {
    subline = `${range}. Mês fechado.`;
  }
  if (apptsPartial) subline += ` Os agendamentos de ${shownName} estão incompletos no histórico.`;
  let note;
  if (!compareOn) note = `Sem comparativo · ${range}`;
  else if (running) note = `Pró-rata: ${dayN === 1 ? 'mesmo primeiro dia' : `mesmos ${dayN} primeiros dias`} de ${cmpName}`;
  else note = 'Mês fechado contra mês fechado';
  return { range, subline, note };
}

// Nota do recorte, à direita do título de cada seção.
export const scopeNote = (personName, funnelName) => `${personName || 'Equipe toda'} · ${funnelName || 'Todos os funis'}`;

// Leitura da tabela de canais: quem traz volume e quem traz resultado.
export function channelRead(m) {
  const rows = m?.channels || [];
  const best = bestChannelOf(m);
  const biggest = rows[0];
  if (!best || !biggest) return 'Poucos leads no período para comparar canais.';
  if (best.name === biggest.name) return `${best.name} é ao mesmo tempo o canal de maior volume e o de melhor conversão.`;
  const bigConv = pct(biggest.enrolled, biggest.leads);
  if (!bigConv) return `${biggest.name} traz o volume e ${best.name} traz o resultado: ${biggest.name} ainda não teve matrícula na safra.`;
  const ratio = Math.round((best.conv / bigConv) * 10) / 10;
  return ratio >= 1.1
    ? `${biggest.name} traz o volume e ${best.name} traz o resultado: a conversão de ${best.name} é ${String(ratio).replace('.', ',')} vezes a de ${biggest.name}.`
    : `${biggest.name} traz o volume e ${best.name} traz o resultado: a conversão de ${best.name} é um pouco maior que a de ${biggest.name}.`;
}

// Tendência de uma célula: os pontos, os rótulos das pontas e a dica.
function sparkOf(points, fmt) {
  if (!points || points.length < 2) return { series: null };
  const first = points[0];
  const last = points[points.length - 1];
  return {
    series: points.map((p) => p.value),
    seriesFrom: `${shortOf(first.key)} ${fmt(first.value)}`,
    seriesTo: `${shortOf(last.key)} ${fmt(last.value)}`,
    seriesLabel: `Tendência de ${points.length} meses: ${points.map((p) => `${shortOf(p.key)} ${fmt(p.value)}`).join(', ')}`
  };
}

// As cinco células da faixa de resumo, no formato do DashSummaryBand.
export function summaryItems({ cur, cmp, series, compareOn, shownName }) {
  const num = (v) => (v == null ? '—' : fmtNum(v));
  const pctText = (v) => (v == null ? '—' : `${v}%`);
  const pctFmt = (v) => `${v}%`;
  const d = (a, b, kind) => (compareOn ? crmDelta(a, b, { kind }) : null);
  // Agendamento sem base num dos lados (antes de agosto de 2026): sem base.
  const apptsOk = cur.apptsBase && (!cmp || cmp.apptsBase);
  const da = (a, b, kind) => (compareOn ? (apptsOk ? crmDelta(a, b, { kind }) : { none: true, text: 'sem base' }) : null);
  const flag = cur.apptsBase ? null : 'incompleto';
  const empty = 'Sem base para a tendência';
  const apptsEmpty = addMonthsToKey(cur.monthKey, -5) < APPTS_COMPLETE_MONTH ? 'Sem base antes de agosto de 2026' : empty;
  const top = (cur.channels || [])[0];
  const a = cur.appts;
  const c = cur.cohort;
  let enrollSub = 'carregando';
  if (c) {
    enrollSub = cur.running
      ? `${fmtNum(cur.fromCohort)} da safra de ${shownName} · ${fmtNum(cur.enroll - cur.fromCohort)} de safras anteriores`
      : `da safra de ${shownName}: ${fmtNum(c.enrolled)} ${c.enrolled === 1 ? 'já matriculou' : 'já matricularam'}`;
  }
  return [
    {
      key: 'leads', label: 'Leads novos', goodUp: true, tone: 'brand', showNone: true, help: HELP.leads,
      value: num(cur.leads),
      sub: top ? `${top.name} lidera com ${fmtNum(top.leads)}` : 'nenhum lead no período',
      delta: d(cur.leads, cmp?.leads, 'pct'), emptySeries: empty, ...sparkOf(series.leads, fmtNum)
    },
    {
      key: 'appts', label: 'Agendamentos', goodUp: true, tone: 'accent', showNone: true, flag, help: HELP.appts,
      value: num(a?.total),
      sub: a ? `${fmtNum(a.came)} vieram · ${fmtNum(a.missed)} faltaram · ${fmtNum(a.pending)} sem desfecho` : 'carregando',
      delta: da(a?.total, cmp?.appts?.total, 'pct'), emptySeries: apptsEmpty, ...sparkOf(series.appts, fmtNum)
    },
    {
      key: 'attend', label: 'Comparecimento', goodUp: true, tone: 'emerald', showNone: true, flag, help: HELP.attend,
      value: pctText(a?.rate),
      sub: a ? `${fmtNum(a.came)} de ${fmtNum(a.decided)} com data já passada` : 'carregando',
      delta: da(a?.rate, cmp?.appts?.rate, 'pp'), emptySeries: apptsEmpty, ...sparkOf(series.attend, pctFmt)
    },
    {
      key: 'enroll', label: 'Matrículas', goodUp: true, tone: 'emerald', showNone: true, help: HELP.enroll,
      value: num(cur.enroll),
      sub: enrollSub,
      delta: d(cur.enroll, cmp?.enroll, 'pct'), emptySeries: empty, ...sparkOf(series.enroll, fmtNum)
    },
    {
      key: 'conv', label: 'Conversão da safra', goodUp: true, tone: 'brand', showNone: true, help: HELP.conv,
      value: pctText(c?.conv),
      sub: c ? `${fmtNum(c.enrolled)} de ${fmtNum(c.leads)} · ${fmtNum(c.open)} ${cur.running ? 'ainda em jogo' : 'seguem em jogo'}` : 'carregando',
      delta: d(c?.conv, cmp?.cohort?.conv, 'pp'), emptySeries: empty, ...sparkOf(series.conv, pctFmt)
    }
  ];
}
```

- [ ] **Step 4: Escrever `src/views/dashboard/CrmDashboard.jsx`**

```jsx
// Corpo da tela do CRM, só apresentação (handoff do CRM, linhas 156 a 639):
// destaques, faixa de resumo e as cinco seções, uma por pergunta. Recebe as
// métricas prontas de DashboardCrmView; os textos que dependem dos números
// saem de src/lib/crm/texts.js.
import { crmDelta } from '../../lib/crm/metrics.js';
import { channelRead, summaryItems, scopeNote } from '../../lib/crm/texts.js';
import { DashSummaryBand } from './DashSummaryBand.jsx';
import { DashHighlights } from './DashHighlights.jsx';
import { CrmSection, DashedNote } from './CrmParts.jsx';
import { ChannelTable } from './ChannelTable.jsx';
import { CohortMilestones } from './CohortMilestones.jsx';
import { StagePassageTable } from './StagePassageTable.jsx';
import { LossCard } from './LossCard.jsx';
import { PeopleConversionTable } from './PeopleConversionTable.jsx';
import { ProfessorCard } from './ProfessorCard.jsx';
import { FirstContactCard, DaysToEnrollCard } from './SpeedCards.jsx';
import { PipelineNowCard, NoNextContactCard } from './PipelineNowCards.jsx';

const WIDE_NARROW = 'grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]';

export function CrmDashboard({
  cur, cmp, series, team, highlights, compareOn, shownName,
  person, personName, funnelId, funnelName, onPick, onClear
}) {
  const scope = scopeNote(person ? personName : null, funnelId ? funnelName : null);
  const speedDelta = (pick, kind) => (compareOn ? crmDelta(pick(cur), cmp ? pick(cmp) : null, { kind }) : null);
  return (
    <>
      {compareOn && highlights.length > 0 && (
        <div className="px-4 md:px-8 pt-[18px]"><DashHighlights items={highlights} fit /></div>
      )}
      <div className="flex flex-col gap-[22px] px-4 md:px-8 pb-8 pt-5">
        <DashSummaryBand items={summaryItems({ cur, cmp, series, compareOn, shownName })} />

        <CrmSection title="Origem" question="de onde vêm os leads?" note={scope}>
          <ChannelTable rows={cur.channels} cohortConv={cur.cohort?.conv ?? null} read={channelRead(cur)} />
        </CrmSection>

        <CrmSection title="Funil" question="onde os leads se perdem?" note={scope}>
          <div className="flex flex-col gap-3.5">
            <CohortMilestones cohort={cur.cohort} monthName={shownName} running={cur.running} />
            {/* align-items start: cada card com a altura que tem (README §3). */}
            <div className={`${WIDE_NARROW} items-start`}>
              <StagePassageTable
                passage={cur.passage}
                needFunnel={!funnelId}
                hasBase={cur.stageBase}
                funnelName={funnelName}
                monthName={shownName}
                academyMedian={Boolean(person)}
              />
              <LossCard losses={cur.losses} lossStages={cur.lossStages} stageBase={cur.stageBase} monthName={shownName} />
            </div>
          </div>
        </CrmSection>

        <CrmSection title="Pessoas" question="quem converte?" note={scope}>
          <div className={`${WIDE_NARROW} items-start`}>
            <PeopleConversionTable
              rows={team?.rows || []}
              others={team?.others || null}
              person={person}
              personName={personName}
              onPick={onPick}
              onClear={onClear}
            />
            <ProfessorCard professors={cur.professors} monthName={shownName} scoped={Boolean(person || funnelId)} />
          </div>
        </CrmSection>

        <CrmSection title="Velocidade" question="com que rapidez o lead é atendido e fecha?" note={scope}>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <FirstContactCard fc={cur.firstContact} delta={speedDelta((m) => m.firstContact?.median ?? null, 'min')} />
            <DaysToEnrollCard dte={cur.daysToEnroll} delta={speedDelta((m) => m.daysToEnroll?.median ?? null, 'days')} />
          </div>
        </CrmSection>

        <CrmSection title="Carteira agora" question="o que está em jogo neste momento?" tag={cur.running ? 'Agora' : null}>
          {cur.running && cur.now ? (
            <div className={WIDE_NARROW}>
              <PipelineNowCard now={cur.now} funnelName={funnelId ? funnelName : null} personName={person ? personName : null} />
              <NoNextContactCard count={cur.now.noNext} total={cur.now.total} />
            </div>
          ) : (
            <DashedNote
              className="rounded-2xl"
              title="A carteira agora só existe no mês em andamento"
              text={`É um retrato deste instante, não um número de ${shownName}. Em mês fechado, o que interessa da mesma turma de leads está no desfecho da safra, lá em cima.`}
            />
          )}
        </CrmSection>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Rodar o teste da tela**

Run: `npx vitest run src/lib/__tests__/crm.dashboard.test.js`
Expected: PASS.

- [ ] **Step 6: Escrever `src/views/dashboard/DashboardCrmView.jsx`**

```jsx
// Tela CRM (Visão geral · CRM): o funil de leads por mês de competência, do
// cadastro até a matrícula, igual para todos os perfis, com comparativo,
// filtro de pessoa e filtro de funil. Visual e textos: handoff do Claude
// Design (docs/superpowers/specs/handoff-crm/). A matemática vem de
// src/lib/crm/ (metricsOf); aqui é só estado, carga e orquestração, no molde
// do DashboardOperacionalView.

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { useCrmSources } from '../../hooks/useCrmSources.js';
import { monthKeyOf, addMonthsToKey, comparisonCut, compareOptions, monthLabel } from '../../lib/operacional/month.js';
import { metricsOf, buildCrmHighlights, seriesOf, OTHERS_ID } from '../../lib/crm/metrics.js';
import { crmMonthKeys } from '../../lib/crm/queries.js';
import { leadFunnelsOf } from '../../lib/crm/scope.js';
import { monthName } from '../../lib/crm/format.js';
import { regimeTexts } from '../../lib/crm/texts.js';
import { cn } from '../../lib/utils.js';
import { CrmToolbar } from './CrmToolbar.jsx';
import { CrmDashboard } from './CrmDashboard.jsx';

// Aviso sob a barra, quando algum mês não carregou (mesmo do Operacional).
function Notice({ children }) {
  return (
    <p role="status" className="flex items-center gap-1.5 px-4 md:px-8 pt-3 text-[12px] text-amber-700 dark:text-amber-300">
      <CircleAlert size={13} strokeWidth={2.2} className="flex-none" />
      {children}
    </p>
  );
}

export function DashboardCrmView({ usersList, liveLeads, interactions, db, listenersActive = true, funnels, statuses }) {
  // Relógio da tela: vira o minuto (mês em andamento, pró-rata, carteira de agora).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = mês anterior
  const [person, setPerson] = useState('all');
  const [funnel, setFunnel] = useState('all');

  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const leadFunnels = useMemo(() => leadFunnelsOf(funnels), [funnels]);
  // Pessoa ou funil que saiu da lista (usuário removido, funil apagado) vale "todos".
  const userId = person !== 'all' && users.some((u) => u.id === person) ? person : null;
  const funnelId = funnel !== 'all' && leadFunnels.some((f) => f.id === funnel) ? funnel : null;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
  // A lista de meses vai até 11 meses atrás; a seta não passa dela.
  const oldestKey = addMonthsToKey(currentKey, -11);

  const monthKeys = useMemo(
    () => crmMonthKeys({ monthKey, compareOn, compareKey: cmpKey, currentKey }),
    [monthKey, compareOn, cmpKey, currentKey]
  );
  const sources = useCrmSources({ db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads });

  const ctx = useMemo(() => ({
    now, users, funnels: funnels || [], statuses: statuses || [], liveLeads,
    leadsById: sources.leadsById,
    months: sources.months
  }), [now, users, funnels, statuses, liveLeads, sources.leadsById, sources.months]);

  const curLoaded = useMemo(() => metricsOf(ctx, { monthKey, userId, funnelId }), [ctx, monthKey, userId, funnelId]);
  const cmpLoaded = useMemo(
    () => (compareOn ? metricsOf(ctx, { monthKey: cmpKey, userId, funnelId, cutEnd: comparisonCut(monthKey, cmpKey, now) }) : null),
    [compareOn, ctx, cmpKey, userId, funnelId, monthKey, now]
  );
  const seriesLoaded = useMemo(() => {
    const s = (pick, apptsBased = false) => seriesOf(ctx, { monthKey, userId, funnelId, pick, apptsBased });
    return {
      leads: s((m) => m.leads),
      appts: s((m) => m.appts?.total ?? null, true),
      attend: s((m) => m.appts?.rate ?? null, true),
      enroll: s((m) => m.enroll),
      conv: s((m) => m.cohort?.conv ?? null)
    };
  }, [ctx, monthKey, userId, funnelId]);
  // Uma linha por pessoa (só a escolhida, com filtro) e a de quem está fora da equipe.
  const teamLoaded = useMemo(() => ({
    rows: (userId ? users.filter((u) => u.id === userId) : users)
      .map((u) => ({ user: u, m: metricsOf(ctx, { monthKey, userId: u.id, funnelId }) })),
    others: userId ? null : metricsOf(ctx, { monthKey, userId: OTHERS_ID, funnelId })
  }), [ctx, monthKey, userId, funnelId, users]);

  // Enquanto o mês novo não tem fonte, fica na tela o último retrato completo,
  // sob a opacidade de 35% e o fio de progresso. Ajuste de estado durante o
  // render, guardado por condição, como no Operacional: efeito com setState e
  // ref lido no render são recusados pelo lint react-hooks v7.
  const ready = curLoaded.hasSource && (!compareOn || Boolean(cmpLoaded?.hasSource));
  const [lastGood, setLastGood] = useState(null);
  if (ready && (lastGood?.cur !== curLoaded || lastGood?.cmp !== cmpLoaded)) {
    setLastGood({ cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded });
  }
  const { cur, cmp, series, team } = ready || !lastGood
    ? { cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded }
    : lastGood;

  const shownName = monthLabel(monthKey, { capitalized: false, withYear: false });
  const cmpName = monthName(cmpKey, monthKey);
  const { subline, note } = regimeTexts({
    running: cur.running, compareOn, dayN: now.getDate(), shownName, cmpName, apptsPartial: !cur.apptsBase
  });
  const highlights = useMemo(
    () => (compareOn ? buildCrmHighlights(cur, cmp, { cmpName }) : []),
    [compareOn, cur, cmp, cmpName]
  );

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );
  const cmpOptions = compareOptions(monthKey).map((k) => ({ key: k, label: monthLabel(k) }));
  const people = users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' }));
  const personUser = userId ? users.find((u) => u.id === userId) : null;
  const funnelObj = funnelId ? leadFunnels.find((f) => f.id === funnelId) : null;
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };
  // Clicar na linha da pessoa filtra; clicar de novo na mesma linha limpa.
  const pickPerson = (id) => setPerson((p) => (p === id ? 'all' : id));
  const failedNames = [monthKey, ...(compareOn ? [cmpKey] : [])]
    .filter((k) => sources.failedKeys.includes(k))
    .map((k) => monthName(k, monthKey));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="-m-4 md:-m-8 font-sans">
        <header className="bg-card px-4 md:px-8 pb-4 pt-5">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">CRM</h2>
          <p className="mt-[5px] max-w-[860px] text-[12.5px] leading-normal text-muted-foreground">{subline}</p>
        </header>
        <CrmToolbar
          monthKey={monthKey} monthOptions={monthOptions} onMonth={changeMonth}
          canPrev={monthKey > oldestKey} onPrev={() => { if (monthKey > oldestKey) changeMonth(addMonthsToKey(monthKey, -1)); }}
          canNext={monthKey < currentKey} onNext={() => { if (monthKey < currentKey) changeMonth(addMonthsToKey(monthKey, 1)); }}
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={setCompareKey}
          person={userId || 'all'} people={people} onPerson={setPerson}
          funnel={funnelId || 'all'} funnels={leadFunnels} onFunnel={setFunnel}
          note={note}
        />
        {failedNames.length > 0 && (
          <Notice>{`Não foi possível carregar os dados de ${failedNames.join(' e ')}. Recarregue a página para tentar de novo.`}</Notice>
        )}
        <div className="relative">
          {sources.loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-500/25" aria-hidden="true">
              <span className="block h-full w-2/5 bg-brand-600 motion-safe:animate-pulse" />
            </div>
          )}
          <div className={cn('transition-opacity', sources.loading && 'opacity-35')} aria-busy={sources.loading}>
            <CrmDashboard
              cur={cur}
              cmp={cmp}
              series={series}
              team={team}
              highlights={highlights}
              compareOn={compareOn}
              shownName={shownName}
              person={userId}
              personName={personUser?.name || 'Sem nome'}
              funnelId={funnelId}
              funnelName={funnelObj?.name || ''}
              onPick={pickPerson}
              onClear={() => setPerson('all')}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 7: O "Em breve" fica só com o Gerencial**

Reescreva `src/views/dashboard/DashboardComingSoonView.jsx`:

```jsx
// Aba Gerencial da Visão geral, por enquanto só com o aviso "Em breve": ela
// volta com um papel novo. Lead e funil estão no CRM; a rotina, a base de
// clientes e a renovação, no Operacional. A tela antiga do Gerencial
// (DashboardGerencialView) saiu do menu e fica no código como base. Mesmo
// cabeçalho do Operacional, que anula o padding do App, e o cartão tracejado
// que o Operacional usa para "não disponível".
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';

const PAGES = {
  gerencial: {
    title: 'Gerencial',
    subline: 'A tela está sendo refeita e volta com um papel novo.',
    note: 'Lead e funil estão no CRM. A rotina, a base de clientes e a renovação estão no Operacional.'
  }
};

export function DashboardComingSoonView({ page, onNavigate }) {
  const p = PAGES[page] || PAGES.gerencial;
  return (
    <div className="-m-4 md:-m-8 font-sans">
      <header className="bg-card px-4 md:px-8 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">{p.title}</h2>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Em breve
          </span>
        </div>
        <p className="mt-[5px] max-w-[820px] text-[12.5px] leading-normal text-muted-foreground">{p.subline}</p>
      </header>
      <div className="border-t border-border px-4 md:px-8 pb-8 pt-5">
        <div className="flex max-w-[620px] flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-slate-50 p-[18px] dark:bg-white/[0.03]">
          <p className="m-0 text-[13px] leading-normal text-muted-foreground">{p.note}</p>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('dashOperacional')}>
            Abrir o Operacional
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

E troque o `describe` de `src/lib/__tests__/DashboardComingSoonView.test.js` por:

```js
describe('DashboardComingSoonView (render)', () => {
  it('gerencial mostra o título, o "Em breve" e o caminho para o Operacional', () => {
    const html = renderToString(createElement(DashboardComingSoonView, { page: 'gerencial', onNavigate: () => {} }));
    expect(html).toContain('>Gerencial</h2>');
    expect(html).toContain('Em breve');
    expect(html).toContain('Abrir o Operacional');
    expect(html).toContain('Lead e funil estão no CRM.');
  });
});
```

Atualize também o comentário do topo desse teste: "Render da aba Gerencial "Em breve" sem jsdom (renderToString)".

- [ ] **Step 8: Ligar a aba no App**

Em `src/App.jsx`, junto do import do Operacional (linha 80):

```js
import { DashboardCrmView } from './views/dashboard/DashboardCrmView.jsx';
```

E troque a linha 1701:

```jsx
              {resolvedTab === 'dashCrm' && <DashboardComingSoonView page="crm" onNavigate={changeTab} />}
```

por:

```jsx
              {/* CRM: o funil de leads por mês, a mesma tela para todos. A mesma
                  base ao vivo do Operacional (metaLeads e as interações do mês),
                  mais funis e etapas para o filtro de funil e a passagem. */}
              {resolvedTab === 'dashCrm' && <DashboardCrmView usersList={usersList} liveLeads={metaLeads} interactions={interactions} db={db} listenersActive={listenersActive} funnels={funnels} statuses={statuses} />}
```

- [ ] **Step 9: Suíte, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: tudo passa, 0 erros no lint, build sem erro.

- [ ] **Step 10: Commit**

```bash
git add src/lib/crm/texts.js src/views/dashboard/CrmDashboard.jsx src/views/dashboard/DashboardCrmView.jsx src/views/dashboard/DashboardComingSoonView.jsx src/lib/__tests__/DashboardComingSoonView.test.js src/lib/__tests__/crm.dashboard.test.js src/App.jsx
git commit -m "feat: tela do dashboard CRM no lugar do Em breve" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 17: Documentação, verificação e conferência visual

**Files:**
- Modify: `CLAUDE.md` (seção nova do dashboard CRM)
- Temporários, NUNCA commitados: `crm-preview.html` e `src/dev/crmPreview.jsx`

- [ ] **Step 1: Acrescentar ao `CLAUDE.md`, depois da seção da ponte com o Stronizap**

```md
## Dashboard CRM (Visão geral → CRM)

O CRM mede o funil de leads por mês de competência, do cadastro até a matrícula: de onde vêm os leads, onde se perdem, quem converte e com que velocidade. O Operacional mede o trabalho e a base de clientes. Spec em `docs/superpowers/specs/2026-09-14-dashboard-crm-design.md`, handoff visual em `docs/superpowers/specs/handoff-crm/` e plano em `docs/superpowers/plans/2026-09-15-dashboard-crm-tela.md`.

- **Contas:** `src/lib/crm/`, puras e testadas. Uma função calcula tudo, `metricsOf(ctx, { monthKey, userId, funnelId, cutEnd })`. A equipe é a soma das pessoas e de Outros, e nenhuma taxa nem mediana é guardada.
- **Recortes:** pessoa é o dono do lead hoje (`consultantId`). Funil é o do lead, e "Todos os funis" deixa de fora Renovações, Vencidos e Upgrade. Importado não conta como lead novo nem como matrícula. Professores são sempre da academia inteira.
- **Carga:** `src/hooks/useCrmSources.js`. Ele divide com o Operacional a carga e a memória de sessão dos meses (`src/hooks/monthSources.js`): mexeu num, confira o outro. As consultas do CRM (leads por `convertedAt`, leads por `lostAt` e `stronix_aulas` por `scheduledFor`) são de campo único, sem índice para publicar. Aula e visita se separam no navegador (`isAulaRecord`), nunca por `where` no `type`.
- **Bases que começam tarde:** a passagem entre etapas e a etapa da perda só existem a partir de setembro de 2026 (`STAGE_TRACKING_MONTH`), e os agendamentos antes de agosto de 2026 são incompletos (`APPTS_COMPLETE_MONTH`). As duas datas moram em `src/lib/crm/scope.js`.
- **Troca de etapa:** a passagem lê a interação `status_change` com `fromStatus`, `toStatus` e `funnelId` (`stageChangeFields`, em `src/lib/stageMove.js`). Um caminho novo que mude a etapa de um lead precisa gravar esses campos, senão o movimento some da passagem.
```

- [ ] **Step 2: Verificação completa**

Run: `npm test && npm run lint && npm run build`
Expected: todos os testes passam (linha de base mais os `crm.*`), 0 erros no lint e build sem erro. Anote os números para a descrição da PR.

- [ ] **Step 3: Conferência visual sem login (temporária)**

A tela real pede login, e o agente não entra com senha. Para conferir o visual contra o handoff, monte uma página temporária que desenha o `CrmDashboard` com um cenário de exemplo (os números da Task 6, ampliados com mais leads, canais e professores), dentro do CSS do app.

`crm-preview.html`, na raiz do projeto:

```html
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>CRM preview</title></head>
  <body class="bg-background text-foreground">
    <div id="root"></div>
    <script type="module" src="/src/dev/crmPreview.jsx"></script>
  </body>
</html>
```

`src/dev/crmPreview.jsx` monta um `ctx` de exemplo (com o formato da Task 6: `now`, `users`, `funnels`, `statuses`, `liveLeads`, `leadsById`, `months`), calcula `cur`, `cmp`, `series`, `team` e `highlights` com as mesmas chamadas do `DashboardCrmView`, e renderiza `CrmToolbar` e `CrmDashboard` dentro de um `TooltipProvider`, com `import '../index.css'` e um botão que troca a classe `dark` no `<html>`. Use o dev server da `.claude/launch.json` (porta 5180) e abra `http://localhost:5180/crm-preview.html`.

Confira, com screenshot, contra `docs/superpowers/specs/handoff-crm/CRM.dc.html`:
- a 1280px e a 390px (`resize_window`), nos temas claro e escuro;
- os estados: mês em andamento com comparativo, sem comparativo, mês fechado (carteira vira cartão tracejado), funil escolhido (passagem aparece), pessoa escolhida (etiquetas "academia inteira" e "mediana da academia"), mês sem perdas;
- a barra fixa com os quatro controles e, no celular, o mês à vista e o botão de filtro com o ponto;
- nenhuma rolagem horizontal da página no celular.

Terminada a conferência, apague os dois arquivos e confirme que não sobrou nada:

Run: `rm -f crm-preview.html src/dev/crmPreview.jsx && rmdir src/dev 2>/dev/null; git status --short`
Expected: só as mudanças desta entrega; nenhum arquivo de preview.

- [ ] **Step 4: Commit da documentação**

```bash
git add CLAUDE.md
git commit -m "docs: dashboard CRM no CLAUDE.md" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Revisão final e PR**

Rode a revisão de código da branch inteira (skill `superpowers:requesting-code-review`), corrija o que ela achar de importante e só então abra a PR (skill `superpowers:finishing-a-development-branch`). A PR nunca é mergeada sem a aprovação do Johnny. A descrição leva as Decisões deste plano, os limites da spec §7 e o teste ao vivo que falta, logado:
- gestor e consultor;
- mês em andamento e mês fechado; comparativo ligado, desligado e contra o mesmo mês do ano anterior;
- pessoa filtrada, funil filtrado (a passagem entre etapas só tem dado desde 14/09/2026);
- celular a 390px e tema escuro;
- o Operacional continua carregando igual (ele passou a importar a carga de `monthSources.js`);
- o contador de leituras do Firebase na primeira abertura e na volta à aba.

Nada a publicar no Firestore: as consultas são de campo único e as regras não mudam.

