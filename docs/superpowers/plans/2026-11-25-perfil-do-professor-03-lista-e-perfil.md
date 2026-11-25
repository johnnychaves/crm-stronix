# PR 3: lista de professores, metas e perfil. Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`).

**Objetivo:** a tela Professores do gestor (lista no desenho A, tabela de placar, e a sub-tela Metas), o perfil de cada professor com as abas Carteira e Aulas experimentais, o "Meu perfil" do professor logado (só leitura), o nível e a foto do professor, tudo atrás do módulo da STRONIX, que passa a se chamar "Stronix 2.0".

**Arquitetura:** duas telas novas na tabela de rotas. `professores` (gestor, com as sub-telas Lista e Metas) e `professorPerfil` (`/professores/perfil/<id>/<aba>`, lido à parte como o modelo de rotina). As duas pedem o módulo `faltosos`. As contas são as do PR 2 (`src/lib/professor/`) mais três funções puras novas (metas, carteira do ciclo e aulas por pessoa). Os dados vêm do que o App já assina (professores, contratos, planos) e de duas leituras novas, sem ser ao vivo, só com a tela aberta: os clientes da academia (`clientsAllQuerySpec`, a mesma da tela Clientes) e as aulas do ciclo (`useAulasInWindow`). As metas moram em `stronix_config/carreira`.

**Stack:** React 19, Vite, Tailwind v4, shadcn, Firebase (Firestore e Storage), Vitest com jsdom.

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`. Plano mestre: `docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md`, seção "PR 3". Mockups aprovados: perfil `docs/superpowers/specs/mockups/2026-11-24-perfil-professor-b.html` (gestor) e `-b-professor.html` (professor logado); lista e metas `docs/superpowers/specs/mockups/2026-11-25-professores-lista-e-metas-a.html` (opção A, escolhida pelo Johnny em 25/11/2026).

**Sobre o código deste plano:** as partes em que a exatidão decide (rotas, parâmetros, contas puras, foto, regras) vêm com o código. As telas vêm com a estrutura, os textos e o comportamento, porque o desenho está nos mockups aprovados e escrever o JSX duas vezes não ajuda ninguém. Quem executa abre o mockup ao lado.

---

## Decisões deste plano

1. **Duas telas, uma trava de módulo.** `SCREENS` ganha o campo `modulo` (`'faltosos'`). O `canAccess` recusa a tela quando a academia não tem o módulo, e o aviso é o de tela não liberada. Sem o módulo, o menu não mostra os itens novos.
2. **O professor abre só o próprio perfil.** `professorPerfil` entra em `PROFESSOR_SCREENS`. Quando o id do endereço não é o `appUser.professorId`, a decisão de rota leva ao perfil dele, com replace e sem aviso. Professor sem `professorId` vai para a inicial com o aviso de tela não liberada.
3. **O gestor abre qualquer perfil.** O consultor não abre nenhuma das duas telas (trava `gestor` na lista; no perfil, a trava é a regra 2 mais `gestor` para quem não é professor).
4. **Sem pesquisa neste PR.** O cartão da pesquisa da lista, a aba Pesquisas, o link e o QR code do perfil e a aba NPS entram no PR 4. O `npsCode` também, porque só ele usa. A coluna e o critério do NPS mostram "Sem pesquisa ainda".
5. **Sem aderência neste PR.** A coluna e o critério mostram "Sem dados ainda". A aba entra no PR 6.
6. **Professor sem nível.** O cadastro antigo não tem `nivel`. A lista mostra "Sem nível" e a renovação aparece sem a referência ("defina o nível"). O perfil mostra "Definir nível" para o gestor.
7. **A aba Aulas não diz o tipo.** O registro em `stronix_aulas` não guarda se foi aula experimental ou freepass (`aulaRecordFields` não tem o campo). A aba mostra a pessoa, a última aula em que veio, a modalidade e se matriculou.
8. **A foto segue a dos leads.** Mesmo processamento (`processImageToSquareBlob`), caminho `tenants/<academia>/professores/<id>/avatar.jpg`, e o gestor grava `photoUrl`, `photoPath` e `photoUpdatedAt` no professor. A regra do Storage é a mesma dos leads, num caminho novo, e o Johnny publica no console antes do merge.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `src/views/console/TenantModulesCard.jsx` | O módulo `faltosos` passa a se chamar "Stronix 2.0". |
| `src/lib/professor/metas.js` | Novo. Níveis, metas padrão, leitura do `stronix_config/carreira` e validação do formulário. |
| `src/lib/professor/renovacao.js` | Ganha `carteiraDoCiclo`. |
| `src/lib/professor/conversao.js` | Ganha `pessoasDasAulas`. |
| `src/lib/routes.js` | `PROFESSORES_SUBS`, `PERFIL_TABS`, as duas telas, leitura do endereço, `hrefFor`, `screenKey`, trava do módulo e regra do próprio perfil. |
| `src/lib/appShell.js` | `screenState` devolve `profId`. |
| `src/lib/acesso.js` | `professorPerfil` em `PROFESSOR_SCREENS`. |
| `src/lib/tenantSlug.js` | `professores` reservado. |
| `src/lib/sentryScrub.js` | `PROF_PATH_RE`. |
| `src/lib/screenParams.js` | Parâmetro `ciclo` nas duas telas. |
| `src/lib/sidebarNav.js` | `professores` e `meuPerfil`. |
| `src/lib/professorPhoto.js` | Novo. Caminho, envio e remoção da foto do professor. |
| `src/hooks/useProfessoresDados.js` | Novo. Junta clientes, aulas do ciclo, contratos normalizados, planos, professores e metas. |
| `src/views/professores/*` | Novos. A tela e os componentes (lista, metas, perfil, abas). |
| `src/App.jsx` | Itens do menu, título do cabeçalho e as duas views. |
| Testes | Ver cada tarefa. |
| `CLAUDE.md` | Seção "Perfil do professor" ganha o item do PR 3. |

---

### Tarefa 0: base

- [ ] `git rev-list --count HEAD..origin/main` (a branch `claude/perfil-professor-lista` saiu da `claude/perfil-professor-contas`, do PR #311). Se a `main` andou, rebase na branch do PR 2 primeiro.
- [ ] `npm run lint && npx vitest run` passam antes de mexer.

### Tarefa 1: o nome do módulo

**Arquivos:** `src/views/console/TenantModulesCard.jsx`, `src/lib/__tests__/tenantModulesCard.test.js`.

- [ ] No teste, troque a expectativa do título para "Stronix 2.0" e a do texto para "Libera o papel Professor em Equipe & acessos e as telas de Professores. Vale no próximo login ou F5 de cada pessoa." Rode e veja falhar.
- [ ] Em `MODULE_ROWS`, `title: 'Stronix 2.0'` e o `hint` acima. Rode e veja passar. Commit `feat: módulo da STRONIX passa a se chamar Stronix 2.0`.

### Tarefa 2: as metas

**Arquivos:** criar `src/lib/professor/metas.js` e `src/lib/__tests__/professor.metas.test.js`; modificar `src/lib/__tests__/professorContasImports.test.js` (a lista da pasta ganha `metas.js`).

- [ ] Testes (escreva antes):

```js
import { describe, it, expect } from 'vitest';
import { METAS_PADRAO, NIVEIS, metasDe, problemaDasMetas, referenciaDaRenovacao, nivelTexto } from '../professor/metas.js';

describe('metasDe', () => {
  it('sem documento, valem as metas padrão', () => {
    expect(metasDe(null)).toEqual(METAS_PADRAO);
    expect(METAS_PADRAO).toEqual({
      renovacao: { junior: 45, pleno: 55, senior: 65 },
      nps: { meta: 9 },
      conversao: { tolerancia: 0, janelaDias: 30 },
      aderencia: { barra: 2, faixaMin: 60, faixaMax: 70 },
    });
  });
  it('campo ausente ou fora do formato cai no padrão, campo bom fica', () => {
    const m = metasDe({ renovacao: { junior: 50, pleno: 'x' }, nps: { meta: 9.5 }, aderencia: { faixaMin: 80, faixaMax: 70 } });
    expect(m.renovacao).toEqual({ junior: 50, pleno: 55, senior: 65 });
    expect(m.nps.meta).toBe(9.5);
    // Faixa invertida volta inteira para o padrão.
    expect(m.aderencia).toEqual({ barra: 2, faixaMin: 60, faixaMax: 70 });
  });
});

describe('problemaDasMetas', () => {
  it('aceita as metas padrão', () => { expect(problemaDasMetas(METAS_PADRAO)).toBeNull(); });
  it('recusa porcentagem fora de 0 a 100, nota fora de 0 a 10 e faixa invertida', () => {
    expect(problemaDasMetas({ ...METAS_PADRAO, renovacao: { junior: 120, pleno: 55, senior: 65 } })).toEqual({ campo: 'renovacao.junior', texto: 'Use um número de 0 a 100.' });
    expect(problemaDasMetas({ ...METAS_PADRAO, nps: { meta: 11 } })).toEqual({ campo: 'nps.meta', texto: 'Use uma nota de 0 a 10.' });
    expect(problemaDasMetas({ ...METAS_PADRAO, aderencia: { barra: 2, faixaMin: 70, faixaMax: 70 } })).toEqual({ campo: 'aderencia.faixaMin', texto: 'O começo da faixa precisa ser menor que o fim.' });
  });
});

describe('nível', () => {
  it('três níveis, com texto e referência da renovação', () => {
    expect(NIVEIS).toEqual(['junior', 'pleno', 'senior']);
    expect(nivelTexto('pleno')).toBe('Pleno');
    expect(nivelTexto(undefined)).toBe('Sem nível');
    expect(referenciaDaRenovacao(METAS_PADRAO, 'senior')).toBe(65);
    expect(referenciaDaRenovacao(METAS_PADRAO, null)).toBeNull();
  });
});
```

- [ ] Módulo:

```js
// Metas do plano de carreira do time técnico, guardadas em
// stronix_config/carreira. Só a renovação tem meta por nível (spec
// 2026-11-24-perfil-do-professor, decisão 12). Documento ausente ou campo fora
// do formato vale o padrão, campo a campo, para um gestor que só mexeu numa
// meta não apagar as outras.
export const NIVEIS = Object.freeze(['junior', 'pleno', 'senior']);
const NIVEL_TEXTO = Object.freeze({ junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' });
export const nivelTexto = (nivel) => NIVEL_TEXTO[nivel] ?? 'Sem nível';

export const METAS_PADRAO = Object.freeze({
  renovacao: Object.freeze({ junior: 45, pleno: 55, senior: 65 }),
  nps: Object.freeze({ meta: 9 }),
  conversao: Object.freeze({ tolerancia: 0, janelaDias: 30 }),
  aderencia: Object.freeze({ barra: 2, faixaMin: 60, faixaMax: 70 }),
});

const LIMITES = {
  'renovacao.junior': [0, 100, 'Use um número de 0 a 100.'],
  'renovacao.pleno': [0, 100, 'Use um número de 0 a 100.'],
  'renovacao.senior': [0, 100, 'Use um número de 0 a 100.'],
  'nps.meta': [0, 10, 'Use uma nota de 0 a 10.'],
  'conversao.tolerancia': [0, 50, 'Use um número de 0 a 50.'],
  'conversao.janelaDias': [0, 90, 'Use um número de 0 a 90.'],
  'aderencia.barra': [1, 5, 'Use um número de 1 a 5.'],
  'aderencia.faixaMin': [0, 100, 'Use um número de 0 a 100.'],
  'aderencia.faixaMax': [0, 100, 'Use um número de 0 a 100.'],
};
const ler = (obj, campo) => campo.split('.').reduce((o, k) => o?.[k], obj);
const valido = (campo, v) => {
  const [min, max] = LIMITES[campo];
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
};

// { campo, texto } do primeiro problema, ou null.
export function problemaDasMetas(m) {
  for (const campo of Object.keys(LIMITES)) {
    if (!valido(campo, ler(m, campo))) return { campo, texto: LIMITES[campo][2] };
  }
  if (m.aderencia.faixaMin >= m.aderencia.faixaMax) {
    return { campo: 'aderencia.faixaMin', texto: 'O começo da faixa precisa ser menor que o fim.' };
  }
  return null;
}

export function metasDe(doc) {
  const out = {};
  for (const [grupo, padrao] of Object.entries(METAS_PADRAO)) {
    out[grupo] = {};
    for (const [k, v] of Object.entries(padrao)) {
      const lido = ler(doc, `${grupo}.${k}`);
      out[grupo][k] = valido(`${grupo}.${k}`, lido) ? lido : v;
    }
  }
  if (out.aderencia.faixaMin >= out.aderencia.faixaMax) out.aderencia = { ...METAS_PADRAO.aderencia };
  return out;
}

export const referenciaDaRenovacao = (metas, nivel) => (NIVEIS.includes(nivel) ? metas.renovacao[nivel] : null);
```

- [ ] Varredura: a lista da pasta no `professorContasImports.test.js` passa a ser `['aderencia.js', 'carteira.js', 'ciclo.js', 'conversao.js', 'metas.js', 'nps.js', 'renovacao.js']`.
- [ ] Rode os dois testes, commit `feat: metas do plano de carreira com padrão campo a campo`.

### Tarefa 3: a carteira do ciclo

Uma linha por aluno da carteira, para a aba Carteira. Situação:
- **renovou / não renovou:** o aluno tem linha na renovação do ciclo (`renovacaoDoCiclo`), e vale a do vencimento mais recente;
- **a vencer:** sem linha de renovação, mas na carteira agora (`carteiraAt` em `asOf`), com o contrato em vigor de fim previsto mais distante.

**Arquivos:** `src/lib/professor/renovacao.js` (exporta `carteiraDoCiclo`; ela usa a renovação, e `renovacao.js` já importa `carteira.js`, então morar em `carteira.js` criaria ciclo de import), `src/lib/__tests__/professor.carteira.test.js`.

- [ ] Testes (no fim do arquivo):

```js
import { carteiraDoCiclo } from '../professor/renovacao.js';

describe('carteiraDoCiclo', () => {
  const ASOF = new Date('2027-06-15T12:00:00');
  const base = { planId: 'move', status: 'ativo', value: 2388 };
  const raw = [
    // ana venceu em março e renovou
    { id: 'a1', leadId: 'ana', ...base, startsAt: new Date('2026-03-10T12:00:00'), endsAt: new Date('2027-03-10T12:00:00'), createdAt: new Date('2026-03-10T12:00:00') },
    { id: 'a2', leadId: 'ana', ...base, renewedFromId: 'a1', startsAt: new Date('2027-03-10T12:00:00'), endsAt: new Date('2028-03-10T12:00:00'), createdAt: new Date('2027-03-01T12:00:00') },
    // bia venceu em abril sem renovar
    { id: 'b1', leadId: 'bia', ...base, startsAt: new Date('2026-04-10T12:00:00'), endsAt: new Date('2027-04-10T12:00:00'), createdAt: new Date('2026-04-10T12:00:00') },
    // caio vence em setembro
    { id: 'c1', leadId: 'caio', ...base, startsAt: new Date('2026-09-10T12:00:00'), endsAt: new Date('2027-09-10T12:00:00'), createdAt: new Date('2026-09-10T12:00:00') },
  ];
  const leads = [
    { id: 'ana', professorId: 'p1', name: 'Ana', cpfDigits: '52998224725' },
    { id: 'bia', professorId: 'p1', name: 'Bia' },
    { id: 'caio', professorId: 'p1', name: 'Caio', cpfDigits: '11144477735' },
  ];
  const linhas = carteiraDoCiclo({ leads, contratos: normalizeContracts(raw), planos: PLANOS, professor: PROF, ciclo: 2027, asOf: ASOF });

  it('uma linha por aluno, com a situação', () => {
    expect(linhas.map((l) => [l.lead.id, l.situacao])).toEqual([['caio', 'vencer'], ['ana', 'renovou'], ['bia', 'nao']]);
  });
  it('diz o vencimento e se falta CPF', () => {
    const bia = linhas.find((l) => l.lead.id === 'bia');
    expect(bia.vence).toEqual(new Date('2027-04-10T12:00:00'));
    expect(bia.semCpf).toBe(true);
    expect(linhas.find((l) => l.lead.id === 'ana').semCpf).toBe(false);
  });
});
```

(`PLANOS` e `PROF` são os do topo do arquivo: `move` tem `func`.)

- [ ] Código:

```js
// Em renovacao.js, que passa a importar também carteiraAt e estadoEm de ./carteira.js.
const ORDEM_SITUACAO = { vencer: 0, renovou: 1, nao: 2 };

// A aba Carteira do perfil: uma linha por aluno, com a situação no ciclo.
// [{ lead, contrato, situacao: 'vencer' | 'renovou' | 'nao', vence, estado, semCpf }],
// a vencer primeiro (do vencimento mais perto), depois os que venceram (do
// mais recente).
export function carteiraDoCiclo({ leads, contratos, planos, professor, ciclo, asOf = new Date() }) {
  const porLead = new Map();
  renovacaoDoCiclo({ leads, contratos, planos, professor, ciclo, asOf }).linhas.forEach((l) => {
    const atual = porLead.get(l.lead.id);
    if (!atual || l.contrato.plannedEndsAt > atual.vence) {
      porLead.set(l.lead.id, { lead: l.lead, contrato: l.contrato, situacao: l.renovou ? 'renovou' : 'nao', vence: l.contrato.plannedEndsAt, estado: null });
    }
  });
  const daModalidade = contratosDaModalidade(contratos, professor, planos);
  carteiraAt({ leads, contratos, planos, professor, data: asOf }).forEach(({ lead, estado }) => {
    if (porLead.has(lead.id)) return;
    const contrato = (daModalidade.get(lead.id) || [])
      .filter((c) => estadoEm([c], asOf))
      .reduce((a, c) => (!a || c.plannedEndsAt > a.plannedEndsAt ? c : a), null);
    porLead.set(lead.id, { lead, contrato, situacao: 'vencer', vence: contrato?.plannedEndsAt ?? null, estado });
  });
  return [...porLead.values()]
    .map((l) => ({ ...l, semCpf: !String(l.lead.cpfDigits || '').trim() }))
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
      || (a.situacao === 'vencer' ? a.vence - b.vence : b.vence - a.vence));
}
```

- [ ] Rode, commit `feat: carteira do professor no ciclo com a situação de cada aluno`.

### Tarefa 4: as pessoas das aulas

**Arquivos:** `src/lib/professor/conversao.js` (exporta `pessoasDasAulas`), `src/lib/__tests__/professor.conversao.test.js`.

Mesmo filtro do `conversaoDoCiclo` (aula com "Compareceu", sem treino sozinho, no ciclo), mas com as aulas da janela incluídas e marcadas, uma linha por pessoa do professor: `{ leadId, nome, ultima, modalidade, matriculou, naJanela }`, da aula mais recente para a mais antiga. `nome` é o `leadName` do registro; `matriculou` é a mesma regra do `contaPessoas` (algum registro com `converted` e contrato pago); `naJanela` diz que a última aula está nos últimos `janelaDias` e ainda não conta.

- [ ] Teste:

```js
import { pessoasDasAulas } from '../professor/conversao.js';

describe('pessoasDasAulas', () => {
  it('uma linha por pessoa do professor, com a última aula e a janela marcada', () => {
    const r = pessoasDasAulas({
      aulas: [
        aula('ana', { scheduledFor: new Date('2027-03-03T18:00:00'), leadName: 'Ana', modality: 'Funcional' }),
        aula('ana', { converted: true, leadName: 'Ana', modality: 'Funcional' }),
        aula('bia', { scheduledFor: new Date('2027-06-01T18:00:00'), leadName: 'Bia' }),
        aula('caio', { professorId: 'p2' }),
      ],
      contratos: [pago('ana')], professorId: 'p1', ciclo: 2027, asOf: ASOF,
    });
    expect(r.map((p) => [p.leadId, p.matriculou, p.naJanela])).toEqual([['bia', false, true], ['ana', true, false]]);
    expect(r[1]).toMatchObject({ nome: 'Ana', modalidade: 'Funcional', ultima: new Date('2027-03-10T18:00:00') });
  });
});
```

- [ ] Código: extraia o filtro do `conversaoDoCiclo` numa função `vieramNoCiclo(aulas, ciclo)` (sem o corte da janela), use nos dois, e:

```js
export function pessoasDasAulas({ aulas, contratos, professorId, ciclo, asOf = new Date(), janelaDias = 30 }) {
  const corte = asOf.getTime() - janelaDias * DAY_MS;
  const comContratoPago = new Set((contratos || []).filter(contratoPago).map((c) => c.leadId));
  const porLead = new Map();
  vieramNoCiclo(aulas, ciclo).filter((r) => r.professorId === professorId).forEach((r) => {
    const at = getSafeDateOrNull(r.scheduledFor);
    const p = porLead.get(r.leadId) || { leadId: r.leadId, nome: r.leadName || null, ultima: at, modalidade: r.modality || null, matriculou: false };
    if (at > p.ultima) Object.assign(p, { ultima: at, modalidade: r.modality || p.modalidade, nome: r.leadName || p.nome });
    if (r.converted === true && comContratoPago.has(r.leadId)) p.matriculou = true;
    porLead.set(r.leadId, p);
  });
  return [...porLead.values()]
    .map((p) => ({ ...p, naJanela: p.ultima.getTime() >= corte }))
    .sort((a, b) => b.ultima - a.ultima);
}
```

O `conversaoDoCiclo` passa a ser `vieramNoCiclo(...)` mais o filtro `at.getTime() < corte`. Os 11 testes dele continuam passando sem mudar.

- [ ] Rode, commit `feat: pessoas das aulas experimentais do professor no ciclo`.

### Tarefa 5: rotas, acesso e Sentry

**Arquivos:** `src/lib/routes.js`, `src/lib/appShell.js`, `src/lib/acesso.js`, `src/lib/tenantSlug.js`, `src/lib/sentryScrub.js`, testes `routes.test.js`, `acesso.test.js` (ou o teste que cobre `PROFESSOR_SCREENS`), `sentryScrub.test.js`, `tenantSlug.test.js`.

- [ ] Testes novos em `routes.test.js` (descreva com os helpers do arquivo; os casos):
  - `parseAppPath('/stronix-crm-app/professores')` → `screen: 'professores'`, `sub: null`; `/professores/metas` → `sub: 'metas'`; `/professores/xyz` → `subUnknown: true`.
  - `/stronix-crm-app/professores/perfil/P1` → `screen: 'professorPerfil'`, `profId: 'P1'`; `/professores/perfil/P1/aulas-experimentais` → `sub: 'aulas'`; `/professores/perfil` → `screen: 'professorPerfil'`, `profId: null`.
  - `hrefFor('t', 'professorPerfil', { profId: 'P1', sub: 'aulas' })` → `'/t/professores/perfil/P1/aulas-experimentais'`; sem `profId` válido → `null`. `hrefFor('t', 'professores', { sub: 'metas' })` → `'/t/professores/metas'`.
  - `screenKey` do perfil é `professorPerfil:P1`, igual para as duas abas.
  - `canAccess('professores', gestorSemModulo)` → `false`; `canAccess('professores', gestorComModulo)` → `true`; consultor com módulo → `false`; professor com módulo → `false` na lista e `true` no perfil.
  - `routeDecision` do professor (com `professorId: 'P1'` e o módulo) em `/t/professores/perfil/P2` → redirect para `/t/professores/perfil/P1`, sem aviso; professor sem `professorId` → inicial com `'nao-liberada'`; gestor sem módulo em `/t/professores` → inicial com `'nao-liberada'`.
  - Endereço de outra academia com perfil (`/outra/professores/perfil/P1`) cai em `/<sessão>/professores`, sem o id.
- [ ] `tenantSlug.test.js` já cobra a reserva pelo `FIRST_LEVEL_SEGMENTS`: rode depois da rota e veja falhar até `professores` entrar em `RESERVED_TENANT_SLUGS`.
- [ ] `sentryScrub.test.js`: `/stronix/professores/perfil/AbC123/carteira` vira `/stronix/professores/perfil/:profId/carteira`.
- [ ] Código em `routes.js`:
  - `export const PROFESSORES_SUBS = Object.freeze({ lista: 'lista', metas: 'metas' });` e `export const PERFIL_TABS = Object.freeze({ carteira: 'carteira', aulas: 'aulas-experimentais' });` com comentário (o PR 4 acrescenta `pesquisas` e `nps`, o PR 6 `aderencia`).
  - `SCREENS.professores: tela(['professores'], 'Professores', { gestor: true, modulo: 'faltosos', subs: PROFESSORES_SUBS, subPadrao: 'lista' })` e `SCREENS.professorPerfil: tela(['professores', 'perfil'], 'Perfil do professor', { modulo: 'faltosos', subs: PERFIL_TABS, subPadrao: 'carteira' })`. O texto `'faltosos'` é o `MODULES.FALTOSOS`; importe de `./modules.js`, que não importa nada.
  - `SPECIAL` ganha `'professores'`, e o laço dos `GROUPS` pula `professorPerfil` (`if (def.segs.length !== 2 || id === 'professorPerfil') continue;`).
  - `readScreen`, antes do ramo de Rotinas:

```js
if (head === 'professores') {
  if (lower(segs[1]) === 'perfil') {
    out.screen = 'professorPerfil';
    out.profId = isValidLeadId(segs[2]) ? segs[2] : null;
    out.rest = segs.slice(3);
    readSub('professorPerfil', out.rest, out);
    return;
  }
  out.screen = 'professores';
  out.rest = segs.slice(1);
  readSub('professores', out.rest, out);
  return;
}
```

  - `parseAppPath` inclui `profId` só quando existe (como o `modelId`), e `redirectTo` o repassa no alvo.
  - `hrefFor`: `if (screen === 'professorPerfil') { const id = isValidLeadId(profId) ? encode(profId) : null; return id === null ? null : `${base}/professores/perfil/${id}${trecho}`; }` (desestruture `profId` das opções).
  - `canAccess`: depois do `canOpenScreen`, `if (def.modulo && !hasModule(appUser?.tenantModules, def.modulo)) return false;`. Para o perfil, quem não é professor precisa ser gestor: `if (screen === 'professorPerfil' && !isProfessor(appUser)) return isGestor(appUser);`.
  - `blockedNotice`: antes do `def.gestor`, `if (def.modulo && !hasModule(appUser?.tenantModules, def.modulo)) return 'nao-liberada';`.
  - `accessRedirect`, depois da trava de tela: o professor no perfil de outro professor.

```js
if (route.screen === 'professorPerfil' && isProfessor(appUser)) {
  const dele = hrefFor(tenantId, 'professorPerfil', { profId: appUser.professorId, sub: route.sub });
  if (!dele) return redirectTo(home, { notice: 'nao-liberada' });
  if (route.profId !== appUser.professorId) return redirectTo(dele, { search });
}
```

  - `sessionPathFor`: quando o endereço é de outra academia e a tela é `professorPerfil`, cai em `joinPath(base, ['professores'])` (o id é dado da outra academia, como o `modelId`).
  - `screenKey`: `if (screen === 'professorPerfil') return `professorPerfil:${route.profId ?? ''}`;`.
- [ ] `appShell.js`: `screenState` devolve `profId: shown?.screen === 'professorPerfil' ? (shown.profId ?? null) : null`.
- [ ] `acesso.js`: `PROFESSOR_SCREENS = ['dailyGoal', 'clientes', 'ficha', 'professorPerfil']`, com o comentário atualizado.
- [ ] `tenantSlug.js`: `'professores'` na linha das palavras de tela.
- [ ] `sentryScrub.js`: `const PROF_PATH_RE = /(\/professores\/perfil\/)[^/?#\s"'<>]+/gi;` encadeado no `scrubLeadPath` (`.replace(PROF_PATH_RE, '$1:profId')`), com o comentário dos segmentos com id atualizado.
- [ ] Rode `routes`, `appShell`, `acesso`, `tenantSlug`, `sentryScrub`, `professorShell` e `filtrosNoEndereco`. Commit `feat: endereço da tela de professores e do perfil, atrás do módulo`.

### Tarefa 6: o ciclo no endereço

**Arquivos:** `src/lib/screenParams.js`, `src/lib/__tests__/screenParams.test.js`.

- [ ] Testes: em `professores` e em `professorPerfil`, sem `ciclo` vale `ctx.cicloAtual`; `?ciclo=2026` com `cicloAtual` 2027 vale 2026; `?ciclo=2025` (antes do primeiro ciclo) e `?ciclo=2030` (depois do atual) valem o atual; escrever o atual some do endereço.
- [ ] Código:

```js
// Ciclo de avaliação do plano de carreira (dezembro a novembro, com o nome do
// ano em que termina). O primeiro é o de 2026, o primeiro com contratos no
// sistema; o último é o de agora. O atual não se escreve.
export const PRIMEIRO_CICLO = 2026;
const cicloValido = (raw, ctx) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= PRIMEIRO_CICLO && n <= ctx.cicloAtual ? n : null;
};
const ciclo = param('ciclo',
  (raw, ctx) => cicloValido(raw, ctx) ?? ctx.cicloAtual,
  (v, ctx) => (cicloValido(v, ctx) && v !== ctx.cicloAtual ? String(v) : null));
```

  e `professores: [ciclo]`, `professorPerfil: [ciclo]` na `TABELA`. O `ctx` vem de `useMemo(() => ({ cicloAtual: cicloDe(new Date()) }), [])` na view.
- [ ] Rode, commit `feat: ciclo do plano de carreira no endereço`.

### Tarefa 7: o menu

**Arquivos:** `src/lib/sidebarNav.js`, `src/lib/__tests__/sidebarNav.test.js`, `src/lib/__tests__/professorShell.test.js`, `src/App.jsx`.

- [ ] `sidebarNav` ganha `professores: tela('professores')` e `meuPerfil: isProfessor(appUser) && Boolean(appUser?.professorId) && tela('professorPerfil')`. Testes: gestor com módulo vê `professores` e não `meuPerfil`; gestor sem módulo não vê nenhum; professor com módulo e `professorId` vê `meuPerfil` e não `professores`; consultor não vê nenhum.
- [ ] `App.jsx`, bloco Administração: o item "Professores" (ícone `GraduationCap` do lucide) entra **antes** de Rotinas, com a guarda `{nav.professores && …}`, `href={menuHref('professores')}`, `active={activeTab === 'professores' || activeTab === 'professorPerfil'}`. O `professorShell.test.js` (Rotinas antes de Configurações, com um rótulo entre eles) continua passando, porque o item novo fica antes de Rotinas.
- [ ] `App.jsx`, bloco Workspace: "Meu perfil" (ícone `IdCard`), com `{nav.meuPerfil && …}`, logo depois da Meta diária, `href={hrefFor(sessionTenant, 'professorPerfil', { profId: appUser.professorId })}`, `active={activeTab === 'professorPerfil'}`. Acrescente `meuPerfil` à lista de itens guardados do `professorShell.test.js`.
- [ ] Título do cabeçalho: `{activeTab === 'professores' && 'Professores'}` e `{activeTab === 'professorPerfil' && 'Perfil do professor'}`.
- [ ] Rode `sidebarNav`, `professorShell`, `acessoSweep`. Commit `feat: Professores no menu do gestor e Meu perfil no do professor`.

### Tarefa 8: a foto do professor

**Arquivos:** criar `src/lib/professorPhoto.js` e `src/lib/__tests__/professorPhoto.test.js`.

- [ ] Teste: `professorPhotoPath('stronix', 'P1')` → `'tenants/stronix/professores/P1/avatar.jpg'`; id inválido (`'a/b'`, `''`) lança erro.
- [ ] Código:

```js
// Foto do professor (spec 2026-11-24, decisão 13): o mesmo processamento da
// foto do lead (processImageToSquareBlob), noutro caminho do Storage. Quem
// grava photoUrl e photoPath no professor é o gestor (regra de
// stronix_professores). A regra do Storage deste caminho é publicada à mão no
// console, como a dos leads.
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { isValidLeadId } from './routes.js';

export function professorPhotoPath(appId, profId) {
  if (!isValidLeadId(profId) || !appId) throw new Error('Professor inválido para a foto.');
  return `tenants/${appId}/professores/${profId}/avatar.jpg`;
}

export async function uploadProfessorPhoto(storage, appId, profId, blob) {
  const path = professorPhotoPath(appId, profId);
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
  return { url: await getDownloadURL(objectRef), path };
}

export async function deleteProfessorPhoto(storage, path) {
  if (!path) return;
  try { await deleteObject(ref(storage, path)); } catch { /* arquivo já apagado */ }
}
```

  (Confira no `leadPhoto.js` como o `deleteLeadPhoto` trata o erro e repita o mesmo.)
- [ ] Regra do Storage para o Johnny publicar no console, dentro de `match /b/{bucket}/o`:

```
match /tenants/{tenant}/professores/{profId}/{fileName} {
  allow read: if request.auth != null && request.auth.token.tenantId == tenant;
  allow write: if request.auth != null && request.auth.token.tenantId == tenant
               && request.resource.size < 2 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
  allow delete: if request.auth != null && request.auth.token.tenantId == tenant;
}
```

  A página pública do PR 5 abre a foto pelo link de download (`getDownloadURL`), que não passa pela regra.
- [ ] Commit `feat: foto do professor no Storage`.

### Tarefa 9: os dados da tela

**Arquivos:** criar `src/hooks/useProfessoresDados.js`.

- [ ] O hook recebe `{ db, ciclo, listenersActive }` e devolve `{ carregando, erro, professores, planos, contratos, clientes, aulas, metas, salvarMetas }`:
  - `professores`, `planos`, `contratos` de `useGeneralConfig()`; `contratos` passa uma vez pelo `normalizeContracts`, num `useMemo`.
  - `clientes` pelo `usePagedLeads({ db, path: LEADS_PATH, spec: clientsAllQuerySpec(), specKey: 'professores-clientes', enabled: listenersActive })` (confira como a `ClientsView` chama e repita).
  - `aulas` pelo `useAulasInWindow({ db, startMs: inicio.getTime(), endMs: fim.getTime() - 1, enabled: listenersActive })`, com `limitesDoCiclo(ciclo)`.
  - `metas`: `onSnapshot` de `stronix_config/carreira` (o mesmo caminho do `CONFIG_GENERAL_ID`, com o id `carreira`) só enquanto `listenersActive`, passado por `metasDe`. `salvarMetas(m)` faz `setDoc(ref, m)` (documento inteiro, porque o formulário tem todas as metas).
- [ ] Sem teste próprio: é só ligação. O comportamento é testado pelas telas.

### Tarefa 10: a tela Professores (lista e metas)

**Arquivos:** criar `src/views/professores/ProfessoresView.jsx`, `ProfessoresTabela.jsx`, `MetasForm.jsx`; teste `src/lib/__tests__/professoresView.behavior.test.js` (jsdom, `MemoryRouter`, mocks do `firebase.js` e dos hooks de dados como nos outros testes de tela).

- [ ] **Cabeçalho:** o `FilterBar` dos painéis com o título "Professores", a linha "Plano de carreira do time técnico. Os números são do ciclo de avaliação, de dezembro a novembro." e, à direita, o seletor de ciclo com setas ("Ciclo dez/2026 a nov/2027"; seta da direita desligada no atual, a da esquerda desligada no `PRIMEIRO_CICLO`). Trocar de ciclo é o `setParams` do `useScreenParams('professores', ctx)`.
- [ ] **Abas:** `Tabs` do shadcn com Professores (com o número de ativos) e Metas, no endereço pela sub-tela (`onTab(id === 'lista' ? null : id)`, como a `RotinasView`).
- [ ] **Lista (mockup A):** uma linha por professor com `ativo !== false`, em ordem de nome, cada linha um `AppLink` para `hrefFor(tenant, 'professorPerfil', { profId })`. Colunas: Professor (foto ou iniciais, nome, selo do nível ou "Sem nível"), Renovação (`renovacaoDoCiclo`: "67%" e "esperado 45%"; sem vencidos, "—" e "nenhum contrato venceu"; sem nível, a taxa e "defina o nível"), Nota dos alunos ("—", "sem pesquisa ainda"), Conversão (`conversaoDoCiclo` com a tolerância e a janela das metas: "53%" e "academia 45%"; sem pessoas, "—" e "ninguém veio"), Aderência ("—", "sem dados ainda"). Marca de estado com ícone e texto para leitor de tela (bateu, ficou abaixo, sem dados), nunca só cor. Acima da tabela, a linha "Conversão da academia: 45%, a régua de todos." Abaixo, a legenda.
- [ ] **Metas (mockup A):** quatro cartões (Renovação com Júnior, Pleno e Sênior; Nota dos alunos com a meta; Conversão com a folga e a janela; Aderência com a barra e a faixa), cada um com a régua de prévia que muda enquanto se digita. Erro no campo pelo `problemaDasMetas`, ligado ao campo por `aria-describedby`, e o "Salvar metas" desligado com erro. Salvar chama `salvarMetas`, mostra "Metas salvas." numa região `role="status"` e o toast de falha se der erro. Texto do rodapé: "As metas valem para todos os professores. Só o gestor muda."
- [ ] Testes de comportamento: a lista mostra os ativos e não o inativo; a linha leva ao perfil (href); trocar o ciclo troca o endereço; nas metas, faixa invertida mostra o erro e desliga o botão, e salvar chama `salvarMetas` com o documento inteiro.
- [ ] Varreduras: `filtrosNoEndereco`, `leadLinkSweep`, `overscrollGuard`, `anelDeFoco`, `fundoDaPagina` passam.
- [ ] Commit `feat: lista de professores e metas do plano de carreira`.

### Tarefa 11: o perfil

**Arquivos:** criar `src/views/professores/ProfessorPerfilView.jsx`, `PerfilCabecalho.jsx`, `PlacarDoCiclo.jsx`, `CarteiraTab.jsx`, `AulasTab.jsx`, `NivelPopover.jsx`; teste `src/lib/__tests__/professorPerfil.behavior.test.js`.

- [ ] **Cabeçalho (mockup B):** "Voltar para Professores" (só gestor), foto com anel azul (ou iniciais), botão de câmera sobre a foto só para o gestor (abre o `PhotoCaptureMenu`; `onPicked` envia pelo `uploadProfessorPhoto` e grava `{ photoUrl, photoPath, photoUpdatedAt: serverTimestamp() }` no professor; `onRemove` apaga e zera), nome, selo do nível com "desde dd/mm/aaaa" (ou "Sem nível"), modalidades e, para o gestor, "Trocar nível".
- [ ] **Trocar nível:** `Popover` com os três níveis (grupo de rádio) e a data (padrão hoje), "Salvar nível" grava `{ nivel, nivelDesde: Timestamp.fromDate(data) }` no professor. A troca não reescreve nada do passado: o nível é o de agora.
- [ ] **Placar (mockup B, faixa escura):** "Onde o {primeiro nome} está no plano de carreira", o seletor de ciclo, e os quatro critérios com a régua: Renovação (taxa, "6 de 9 contratos renovaram", régua com as três médias e a do nível em laranja), Nota dos alunos ("Sem pesquisa ainda"), Conversão (taxa, "8 de 15 pessoas se matricularam", régua com a academia, selo "Acima da academia" ou "Abaixo da academia"; com o ciclo pegando agosto de 2026 ou antes, o aviso do `incompleto`), Aderência ("Sem dados ainda").
- [ ] **Abas:** Carteira e Aulas experimentais, no endereço (`PERFIL_TABS`).
- [ ] **Carteira:** `carteiraDoCiclo`, pílulas Todos, A vencer, Renovou, Não renovou com a contagem (estado local, como no mockup; não é filtro de tela, porque é aba de um perfil), aviso âmbar "N alunos não têm CPF no cadastro e não conseguem responder o NPS." com "Ver quem são", e a linha de cada aluno com `LeadLink`, plano, vencimento e situação. Lista vazia: "Ninguém nesta situação."
- [ ] **Aulas experimentais:** o resumo ("8 de 15 pessoas se matricularam" e a conversão da academia) e a lista do `pessoasDasAulas`: nome (`LeadLink`), última aula (data), modalidade, "Matriculou" em verde ou "Ainda não", e o selo "Nos últimos 30 dias" com a explicação de que ainda não conta.
- [ ] **Professor logado:** o mesmo perfil, sem Voltar, sem câmera e sem Trocar nível, com a faixa "Você está vendo o seu perfil. Só o gestor muda o nível e a foto." (mockup `-b-professor.html`).
- [ ] **Professor não encontrado:** id que não existe em `stronix_professores` mostra "Não achamos esse professor." com o link para Professores (gestor).
- [ ] Testes de comportamento: gestor vê câmera e Trocar nível, professor não; trocar de aba troca o endereço; a carteira filtra pelas pílulas; o aviso de CPF conta certo; salvar o nível chama o `updateDoc` com o nível e a data.
- [ ] Commit `feat: perfil do professor com carteira e aulas experimentais`.

### Tarefa 12: o App

**Arquivos:** `src/App.jsx`.

- [ ] Na sequência de telas dentro do `AppErrorBoundary`:

```jsx
{activeTab === 'professores' && (
  <ProfessoresView db={db} appUser={appUser} tenantId={sessionTenant} tab={sub}
    onTab={(subId) => goToSub('professores', subId)} listenersActive={listenersActive} />)}
{activeTab === 'professorPerfil' && (
  <ProfessorPerfilView db={db} storage={storage} appUser={appUser} tenantId={sessionTenant} profId={profId}
    tab={sub} onTab={(subId) => goToSub('professorPerfil', subId)} listenersActive={listenersActive} />)}
```

  (`profId` sai do `screenState`, como o `modelId`; confira o nome do `storage` exportado de `firebase.js`.)
- [ ] `npm run build` passa. Commit `feat: telas de professores ligadas ao app`.

### Tarefa 13: documentação e conferência

- [ ] `CLAUDE.md`, seção "Perfil do professor", item "Lista e perfil (PR 3)": as duas telas e a trava do módulo, a regra do próprio perfil, o ciclo no endereço (`PRIMEIRO_CICLO`), as metas em `stronix_config/carreira` com padrão campo a campo, o nível (`nivel`, `nivelDesde`) e a foto (caminho e regra do Storage publicada à mão).
- [ ] `npm run lint && npx vitest run && npm run verificar:sentry && npm run build`.
- [ ] Abrir as telas num navegador com o harness local (Vite com fakes do Firebase, ver a memória `harness-navegador-sem-login`): lista, metas, perfil do gestor e do professor, a 1280 e a 375 px.
- [ ] Parar e avisar o Johnny: a regra do Storage para publicar, sem push nem PR sem o pedido dele.

## Pontos para o Johnny

1. **Regra do Storage da foto** (Tarefa 8), publicada no console antes do merge.
2. **Professor sem nível:** hoje nenhum professor tem nível. Depois do merge, o gestor define o nível de cada um no perfil.
3. **Aba Aulas sem o tipo:** o sistema não guarda se a pessoa veio por aula experimental ou freepass. Se for importante separar, o agendamento precisa passar a gravar isso, em outra entrega.
