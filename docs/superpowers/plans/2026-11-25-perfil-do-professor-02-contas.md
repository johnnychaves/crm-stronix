# PR 2: as contas do perfil do professor. Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** as quatro contas do plano de carreira (renovação da carteira, conversão das aulas experimentais, NPS e aderência), mais o ciclo e a carteira, como funções puras e testadas em `src/lib/professor/`, sem tela e sem gravação. O PR 3 desenha o perfil em cima delas, e o PR 5 lê a carteira dentro da `api/`.

**Arquitetura:** seis arquivos pequenos em `src/lib/professor/`, um por assunto. Eles só importam módulos puros que já existem: `professorAt` (`src/lib/professorHistory.js`), `planModalityIds` (`src/lib/planos.js`), `liveRenewalOf`, `neverTookEffect` e `isImportedContract` (`src/lib/contracts.js`), `normalizeContracts`, `contractStateAt` e `hasOpenPause` (`src/lib/operacional/base.js`), `AULA_STATUS` e `isAulaRecord` (`src/lib/aulas.js`), `pct` (`src/lib/crm/stats.js`), `monthKeyOf` (`src/lib/operacional/month.js`) e `getSafeDateOrNull` e `fromDateInputValue` (`src/lib/dates.js`). Um teste segue os imports de cada arquivo, como o `newLeadImports.test.js`, e reprova quem chegar a pacote, ao `firebase.js`, ao `dailyGoal.js`, ao `funnels.js` ou a `crm/scope.js` e `crm/appointments.js` (os dois chegam ao `dailyGoal.js` por dentro).

**Stack:** JavaScript, Vitest. Nenhuma regra do Firestore muda, nenhuma função da `api/` muda.

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`, seções "Decisões tomadas", "Dados novos" e "As contas". Plano mestre: `docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md`, seção "PR 2: as contas".

---

## O que o código mostrou antes do plano

- **A taxa de renovação do Operacional** é o `renewalCohort` com o `summarizeCohort` (`src/lib/operacional/renewal.js`). Ele lê os contratos normalizados pelo `normalizeContracts` (`src/lib/operacional/base.js`) e pega os que têm o fim previsto (`plannedEndsAt`: o `originalEndsAt`, ou o `endsAt` sem encurtamento) no mês. **O cancelado antes do fim sai da conta inteira**, sem entrar como vencido nem como renovado: `if (c.cancelledAt && c.cancelledAt < c.endsAt) return;`, com o `endsAt` já ajustado pelo `normalizeContracts`. O cancelado sem data (legado) ganha `cancelledAt = endsAt` na normalização e por isso fica na conta, como encerrado no fim. O contrato que nunca valeu (`neverTookEffect`) cai na mesma regra, porque foi cancelado antes do fim. **O trancado também sai** (`hasOpenPause`: "trancado não vence", o fim anda na reativação). Este plano usa as duas regras, na mesma expressão, sobre o mesmo contrato normalizado, e um teste compara as duas contas.
- **Onde o Operacional e a spec se separam:** para o Operacional, renovado é quem tem sucessor (`successorOf`): a renovação ligada que chegou a valer, mesmo que cancelada depois, ou outro contrato da mesma pessoa criado até o vencimento mais a tolerância (`renewalGraceDays`), como a volta pela ficha que nasce como matrícula. Ele também deixa fora do denominador quem ainda está na tolerância (`pending`). A spec manda contar como renovado só quem tem `liveRenewalOf` (renovação ligada e não cancelada), sem tolerância. O plano segue a spec, e o ponto está em "Dúvidas para o Johnny".
- **O trancamento fica gravado no contrato** em `status: 'trancado'` com `pausedAt` (a pausa em curso), `resumedAt` e `pausedDaysTotal` (a última reativação) e `pauseHistory` (as pausas fechadas). Quem lê isso é o `pausesOf`, dentro do `normalizeContract` (`src/lib/operacional/base.js`), que monta `pauses` como intervalos `[from, to)`, e o `contractStateAt(c, t)`, que diz `'vigente'`, `'trancado'` ou `null` num instante. O `normalizeContracts` ainda fecha a pausa aberta no início do sucessor (`closeOpenPause`). A aderência usa só o `contractStateAt`.
- **O comparecimento** é `status === AULA_STATUS.ATTENDED` (`'attended'`), em `src/lib/aulas.js`. Aula e visita se separam pelo `isAulaRecord`, nunca por `type === 'aula'`, porque o registro antigo não tem o campo.
- **O treino sozinho** (`isSoloTrainingRecord`) mora hoje em `src/lib/crm/appointments.js`, que chega ao `dailyGoal.js` pelo `crm/cohort.js` e pelo `operacional/routine.js`. A Tarefa 1 move a função para `src/lib/aulas.js`, e o `crm/appointments.js` passa a reexportá-la, sem mudar quem a usa.
- **O `APPTS_COMPLETE_MONTH`** (`'2026-09'`) mora em `src/lib/crm/scope.js`, que importa o `funnels.js` (`firebase/firestore`) e o `operacional/routine.js` (`dailyGoal.js`). A conversão guarda uma cópia, e um teste confere que as duas são iguais.
- **A matrícula** só marca `converted` na última aula com "Compareceu" do lead (`pickConvertingAula`, chamado pelo `markConvertingAula` na matrícula, não na renovação), e o `unmarkConvertedAula` desmarca quando a venda é desfeita.
- **O `historicoDoProfessor.sweep.test.js`** (PR 1) reprova arquivo novo com `professorId` como chave. O `conversao.js` recebe `professorId` num parâmetro desestruturado e entra na lista de revisados, como "só conta".

## Nomes e formatos que este PR fixa

Os nomes do plano mestre ficam, com três ajustes de assinatura: as funções recebem um objeto, o `npsDe` não recebe a turma à parte (ela vem dentro dos totais, como na spec) e a aderência recebe leads, contratos, planos e professor, porque a carteira muda de semana para semana.

- **Contratos:** as contas que leem vigência (carteira, renovação e aderência) recebem a lista já normalizada pelo `normalizeContracts`, uma vez, como o Operacional e o Gerencial fazem. Passar a lista crua quebra o `contractStateAt`, e passar duas vezes pela normalização anda o fim do trancado de novo.
- **Professor:** o documento de `stronix_professores`, com `id` e `modalidadeIds`.
- **Plano:** o documento do catálogo, com `id` e `modalityIds` (ou o legado `modalityId`). Contrato sem plano no catálogo fica fora da carteira.
- **Aulas:** os documentos de `stronix_aulas`, com `scheduledFor` em `Date` ou `Timestamp`.
- **Presenças (contrato com o PR 6):** cada documento de `stronix_presencas` tem `leadId`, `semana` (a segunda-feira, `'AAAA-MM-DD'`) e `presencas` (número). O script de importação do PR 6 grava esses nomes.
- **Totais do NPS (contrato com o PR 4):** `{ turma, respostas, porPergunta: { [perguntaId]: { soma, promotores, neutros, detratores } } }`.
- **Porcentagens** saem inteiras pelo `pct` do CRM. A nota do NPS sai com duas casas. As comparações com a meta e com a academia usam o número que a tela mostra, para a tela nunca dizer "acima" com dois números iguais.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/aulas.js` | Ganha `isSoloTrainingRecord`, vindo do `crm/appointments.js`. |
| `src/lib/crm/appointments.js` | Importa `isSoloTrainingRecord` de `../aulas.js` e reexporta. |
| `src/lib/__tests__/aulas.test.js` | Dois testes novos. |
| `src/lib/professor/ciclo.js` | Novo. `cicloDe`, `limitesDoCiclo`, `semestresDoCiclo`. |
| `src/lib/professor/carteira.js` | Novo. `contratosDaModalidade`, `estadoEm`, `carteiraAt`. |
| `src/lib/professor/renovacao.js` | Novo. `renovacaoDoCiclo`, `DIAS_SEM_TROCA`. |
| `src/lib/professor/conversao.js` | Novo. `conversaoDoCiclo`, `APPTS_COMPLETE_MONTH`. |
| `src/lib/professor/nps.js` | Novo. `npsDe`, `npsDoAno`, `RESPOSTAS_MINIMAS`. |
| `src/lib/professor/aderencia.js` | Novo. `aderenciaPorSemana`, `aderenciaDoSemestre`, `aderenciaDoAno`, `BARRA_PADRAO`. |
| `src/lib/__tests__/professor.ciclo.test.js` | Novo. |
| `src/lib/__tests__/professor.carteira.test.js` | Novo. |
| `src/lib/__tests__/professor.renovacao.test.js` | Novo, com a comparação com o Operacional. |
| `src/lib/__tests__/professor.conversao.test.js` | Novo. |
| `src/lib/__tests__/professor.nps.test.js` | Novo. |
| `src/lib/__tests__/professor.aderencia.test.js` | Novo. |
| `src/lib/__tests__/professorContasImports.test.js` | Novo. A varredura dos imports. |
| `src/lib/__tests__/historicoDoProfessor.sweep.test.js` | O `conversao.js` entra em `REVISADOS`. |
| `CLAUDE.md` | A seção "Perfil do professor" ganha o item das contas. |
| `docs/quality.md` | O `professorContasImports` entra na lista dos testes de importação. |
| `docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md` | A linha "Plano:" do PR 2. |

## Onde cada caso da spec é testado

| Caso da seção "Testes" da spec | Teste |
|---|---|
| Professor trocado 60 e 100 dias antes do vencimento | `professor.renovacao.test.js` |
| Lead sem histórico | `professor.renovacao.test.js` |
| Contrato que nunca valeu | `professor.renovacao.test.js` (e `professor.conversao.test.js`, na matrícula) |
| Renovação cancelada | `professor.renovacao.test.js` |
| Ciclo com poucos contratos (a taxa sai igual, sem aviso) | `professor.renovacao.test.js` |
| Plano de outra modalidade | `professor.renovacao.test.js` e `professor.carteira.test.js` |
| A mesma pessoa em dois agendamentos (conta uma vez) | `professor.conversao.test.js` |
| Matrícula com freepass importado de R$ 0 (não conta) | `professor.conversao.test.js` |
| Aula dos últimos 30 dias (fora) | `professor.conversao.test.js` |
| NPS com 49% e 50% da turma, com 9 e 10 respostas | `professor.nps.test.js` |
| A média dos dois exemplos do plano de carreira (9,33 passa, 8,92 não) | `professor.nps.test.js` |
| Nota do ano com uma e com duas pesquisas válidas | `professor.nps.test.js` |
| Promotores e detratores por pergunta | `professor.nps.test.js` |
| Taxa da aderência de um semestre, com semana trancada e primeira semana do contrato fora | `professor.aderencia.test.js` |
| Nota do ano da aderência com um e com dois semestres | `professor.aderencia.test.js` |
| Veredito da conversão de um professor com 3 pessoas (sem mínimo) | `professor.conversao.test.js` |

---

### Tarefa 0: preparar a branch

- [ ] **Passo 1: conferir a base**

A branch `claude/perfil-professor-pr2-contas` saiu da `main` no merge `773d878`, que já tem o PR 1. Traga o que entrou depois:

```bash
git fetch
git rev-list --count HEAD..origin/main
```

Se o número for maior que zero, rode `git rebase origin/main`. Depois:

```bash
npm ci
git status --short package-lock.json
```

Esperado: o `git status` não lista o `package-lock.json`.

- [ ] **Passo 2: linha de base**

```bash
npm run lint && npm test
```

Esperado: tudo passa. Se algo já falha antes de mexer, anote o nome do teste e não siga sem avisar o Johnny.

- [ ] **Passo 3: registrar o plano**

No plano mestre (`docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md`), logo abaixo do título `### PR 2: as contas`, acrescente:

```markdown
**Plano:** `docs/superpowers/plans/2026-11-25-perfil-do-professor-02-contas.md` (pronto).
```

```bash
git add docs/superpowers/plans/2026-11-25-perfil-do-professor-02-contas.md docs/superpowers/plans/2026-11-24-perfil-do-professor-00-visao-geral.md
git commit -m "docs: plano do PR 2 do perfil do professor (as contas)"
```

---

### Tarefa 1: o treino sozinho passa a morar em `aulas.js`

A conversão precisa do `isSoloTrainingRecord`, e o arquivo onde ele mora (`crm/appointments.js`) chega ao `dailyGoal.js`. A função vai para `aulas.js`, que é puro, e o `crm/appointments.js` reexporta, então o cartão de professores do CRM e a aba Por professor dos Relatórios não mudam.

**Arquivos:**
- Modificar: `src/lib/aulas.js`
- Modificar: `src/lib/crm/appointments.js`
- Testar: `src/lib/__tests__/aulas.test.js`

- [ ] **Passo 1: escrever os testes**

Em `src/lib/__tests__/aulas.test.js`, troque o import do topo:

```js
import {
  AULA_STATUS, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, pickMirrorAppointment, aulaRecordFields, rescheduleRecordPlan,
  recordPlanFor, recordMatchesAppointment
} from '../aulas.js';
```

por:

```js
import {
  AULA_STATUS, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, pickMirrorAppointment, aulaRecordFields, rescheduleRecordPlan,
  recordPlanFor, recordMatchesAppointment, isSoloTrainingRecord
} from '../aulas.js';
import { isSoloTrainingRecord as soloDoCrm } from '../crm/appointments.js';
```

E acrescente no fim do arquivo:

```js
describe('isSoloTrainingRecord', () => {
  it('treino sozinho é a marca ou a falta de professor', () => {
    expect(isSoloTrainingRecord({ soloTraining: true, professorId: 'p1' })).toBe(true);
    expect(isSoloTrainingRecord({ professorId: null })).toBe(true);
    expect(isSoloTrainingRecord({ professorId: 'p1' })).toBe(false);
  });

  it('crm/appointments.js continua exportando a mesma função', () => {
    expect(soloDoCrm).toBe(isSoloTrainingRecord);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/aulas.test.js
```

Esperado: FAIL nos dois testes novos (`isSoloTrainingRecord` de `../aulas.js` é `undefined`).

- [ ] **Passo 3: mover a função**

Em `src/lib/aulas.js`, logo depois do `isAulaRecord`, acrescente:

```js

// Aula de quem treina sozinho: com a marca, ou sem professor. É o "Treina
// sozinho" do cartão de professores (professorsOf), da lista dos Relatórios e
// da conversão do perfil do professor.
export const isSoloTrainingRecord = (r) => Boolean(r?.soloTraining || !r?.professorId);
```

Em `src/lib/crm/appointments.js`, troque o import:

```js
import { AULA_STATUS, isAulaRecord, outcomeToAulaStatus } from '../aulas.js';
```

por:

```js
import { AULA_STATUS, isAulaRecord, isSoloTrainingRecord, outcomeToAulaStatus } from '../aulas.js';
```

E troque a definição:

```js
// Aula de quem treina sozinho: com a marca, ou sem professor. É o "Treina
// sozinho" do cartão de professores (professorsOf) e da lista dos Relatórios.
export const isSoloTrainingRecord = (r) => Boolean(r?.soloTraining || !r?.professorId);
```

por:

```js
// A regra do treino sozinho mora em aulas.js, porque as contas do perfil do
// professor (src/lib/professor/) não podem importar este arquivo.
export { isSoloTrainingRecord };
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/aulas.test.js src/lib/__tests__/crm.appointments.test.js src/lib/__tests__/relatoriosLeads
```

Esperado: PASS em todos (o `aulas.test.js` com 52 testes).

- [ ] **Passo 5: commit**

```bash
git add src/lib/aulas.js src/lib/crm/appointments.js src/lib/__tests__/aulas.test.js
git commit -m "refactor: regra do treino sozinho passa a morar em aulas.js"
```

---

### Tarefa 2: o ciclo

**Arquivos:**
- Criar: `src/lib/professor/ciclo.js`
- Criar: `src/lib/__tests__/professor.ciclo.test.js`

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professor.ciclo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cicloDe, limitesDoCiclo, semestresDoCiclo } from '../professor/ciclo.js';

describe('cicloDe', () => {
  it('dezembro já é do ciclo do ano seguinte', () => {
    expect(cicloDe(new Date('2026-12-01T00:00:00'))).toBe(2027);
    expect(cicloDe(new Date('2026-12-31T23:59:00'))).toBe(2027);
  });

  it('de janeiro a novembro é o ciclo do próprio ano', () => {
    expect(cicloDe(new Date('2027-01-01T00:00:00'))).toBe(2027);
    expect(cicloDe(new Date('2026-11-30T23:59:59'))).toBe(2026);
  });

  it('aceita Timestamp e devolve null com data inválida', () => {
    expect(cicloDe({ toDate: () => new Date('2027-06-15T12:00:00') })).toBe(2027);
    expect(cicloDe(null)).toBeNull();
    expect(cicloDe('não é data')).toBeNull();
  });
});

describe('limitesDoCiclo', () => {
  it('vai de 1º de dezembro às 00:00 até 1º de dezembro do ano do ciclo, fora', () => {
    expect(limitesDoCiclo(2027)).toEqual({
      inicio: new Date('2026-12-01T00:00:00'),
      fim: new Date('2027-12-01T00:00:00'),
    });
  });
});

describe('semestresDoCiclo', () => {
  it('janeiro a junho e julho a novembro, sem dezembro', () => {
    expect(semestresDoCiclo(2027)).toEqual([
      { inicio: new Date('2027-01-01T00:00:00'), fim: new Date('2027-07-01T00:00:00') },
      { inicio: new Date('2027-07-01T00:00:00'), fim: new Date('2027-12-01T00:00:00') },
    ]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professor.ciclo.test.js
```

Esperado: FAIL, porque `../professor/ciclo.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professor/ciclo.js`:

```js
// O ciclo da avaliação do plano de carreira: de 1º de dezembro a 30 de
// novembro, no fuso local, com o nome do ano em que termina (o ciclo 2027 vai
// de 01/12/2026 a 30/11/2027 e é avaliado em dezembro de 2027). Os semestres
// da aderência são de janeiro a junho e de julho a novembro: dezembro fica
// fora de qualquer ciclo na aderência (spec 2026-11-24-perfil-do-professor).
import { getSafeDateOrNull } from '../dates.js';

// O ciclo de uma data, ou null com data inválida.
export function cicloDe(data) {
  const d = getSafeDateOrNull(data);
  if (!d) return null;
  return d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
}

// [inicio, fim): fim é 1º de dezembro às 00:00, fora do ciclo.
export const limitesDoCiclo = (ciclo) => ({ inicio: new Date(ciclo - 1, 11, 1), fim: new Date(ciclo, 11, 1) });

// Os dois semestres da aderência na avaliação de dezembro. O segundo para em
// 30 de novembro, o fim do ciclo.
export const semestresDoCiclo = (ciclo) => [
  { inicio: new Date(ciclo, 0, 1), fim: new Date(ciclo, 6, 1) },
  { inicio: new Date(ciclo, 6, 1), fim: new Date(ciclo, 11, 1) },
];
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professor.ciclo.test.js
```

Esperado: PASS, 5 testes.

- [ ] **Passo 5: commit**

```bash
git add src/lib/professor/ciclo.js src/lib/__tests__/professor.ciclo.test.js
git commit -m "feat: ciclo de dezembro a novembro do plano de carreira"
```

---

### Tarefa 3: a carteira na data

**Arquivos:**
- Criar: `src/lib/professor/carteira.js`
- Criar: `src/lib/__tests__/professor.carteira.test.js`

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professor.carteira.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import { carteiraAt, contratosDaModalidade, estadoEm } from '../professor/carteira.js';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const PROF = { id: 'p1', modalidadeIds: ['func'] };
const PLANOS = [
  { id: 'move', modalityIds: ['func', 'musc'] },
  { id: 'start', modalityIds: ['musc'] },
  { id: 'legado', modalityId: 'func' },
];
const contrato = (id, leadId, planId, over = {}) => ({
  id, leadId, planId, status: 'ativo', value: 2388,
  startsAt: new Date('2027-01-10T12:00:00'), endsAt: new Date('2028-01-10T12:00:00'),
  createdAt: new Date('2027-01-10T12:00:00'), ...over,
});

describe('contratosDaModalidade', () => {
  it('fica com o plano que tem uma modalidade do professor, inclusive o legado de modalidade única', () => {
    const lista = normalizeContracts([
      contrato('c1', 'ana', 'move'), contrato('c2', 'bia', 'start'), contrato('c3', 'caio', 'legado'),
      contrato('c4', 'dani', 'apagado'), contrato('c5', 'edu', null),
    ]);
    const mapa = contratosDaModalidade(lista, PROF, PLANOS);
    expect([...mapa.keys()].sort()).toEqual(['ana', 'caio']);
  });
});

describe('estadoEm', () => {
  it('vigente vence trancado, e sem contrato no instante é null', () => {
    const [velho, novo] = normalizeContracts([
      contrato('velho', 'ana', 'move', { status: 'trancado', pausedAt: new Date('2027-02-01T12:00:00') }),
      contrato('novo', 'ana', 'move', { startsAt: new Date('2027-01-05T12:00:00') }),
    ]);
    expect(estadoEm([velho], new Date('2027-03-01T12:00:00'))).toBe('trancado');
    expect(estadoEm([velho, novo], new Date('2027-03-01T12:00:00'))).toBe('vigente');
    expect(estadoEm([novo], new Date('2026-12-01T12:00:00'))).toBeNull();
    expect(estadoEm(undefined, new Date())).toBeNull();
  });
});

describe('carteiraAt', () => {
  const contratos = normalizeContracts([
    contrato('c-ana', 'ana', 'move'),
    contrato('c-bia', 'bia', 'move'),
    contrato('c-caio', 'caio', 'start'),
    contrato('c-dani', 'dani', 'move', { status: 'trancado', pausedAt: new Date('2027-02-01T12:00:00') }),
    contrato('c-edu', 'edu', 'move', { endsAt: new Date('2027-02-10T12:00:00') }),
  ]);
  const leads = [
    { id: 'ana', professorId: 'p1' },
    // Trocou de p2 para p1 em 01/03/2027.
    { id: 'bia', professorId: 'p1', professorHistory: [{ professorId: 'p2', since: null }, { professorId: 'p1', since: ts('2027-03-01T12:00:00') }] },
    { id: 'caio', professorId: 'p1' },
    { id: 'dani', professorId: 'p1' },
    { id: 'edu', professorId: 'p1' },
  ];
  const ids = (data) => carteiraAt({ leads, contratos, planos: PLANOS, professor: PROF, data }).map((x) => `${x.lead.id}:${x.estado}`);

  it('lê o professor da data pelo histórico, deixa de fora outra modalidade e contrato vencido, e marca o trancado', () => {
    expect(ids(new Date('2027-02-15T12:00:00'))).toEqual(['ana:vigente', 'dani:trancado']);
    expect(ids(new Date('2027-03-15T12:00:00'))).toEqual(['ana:vigente', 'bia:vigente', 'dani:trancado']);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professor.carteira.test.js
```

Esperado: FAIL, porque `../professor/carteira.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professor/carteira.js`:

```js
// A carteira do professor: os clientes cujo professor na data (professorAt) é
// ele, com contrato de plano de uma modalidade que ele dá (planModalityIds do
// plano contra modalidadeIds do professor). Os contratos chegam normalizados
// pelo normalizeContracts (operacional/base.js), como no Operacional: é ele
// que dá o fim previsto, as pausas e o estado num instante.
import { contractStateAt } from '../operacional/base.js';
import { planModalityIds } from '../planos.js';
import { professorAt } from '../professorHistory.js';

// Contratos de plano da modalidade do professor, por leadId. Contrato sem
// plano no catálogo (plano apagado ou importado sem plano) fica fora.
export function contratosDaModalidade(contratos, professor, planos) {
  const minhas = new Set(professor?.modalidadeIds || []);
  const planosById = new Map((planos || []).map((p) => [p.id, p]));
  const porLead = new Map();
  (contratos || []).forEach((c) => {
    if (!c?.leadId || !planModalityIds(planosById.get(c.planId)).some((id) => minhas.has(id))) return;
    const lista = porLead.get(c.leadId);
    if (lista) lista.push(c);
    else porLead.set(c.leadId, [c]);
  });
  return porLead;
}

// Estado da pessoa num instante pelos contratos dela: 'vigente', 'trancado'
// ou null. Vigente vence trancado, como no personStatesAt do Operacional.
export function estadoEm(contratos, t) {
  let estado = null;
  for (const c of contratos || []) {
    const s = contractStateAt(c, t);
    if (s === 'vigente') return s;
    if (s) estado = s;
  }
  return estado;
}

// A carteira na data: [{ lead, estado }], com o trancado incluído. Quem só
// quer a carteira ativa filtra o estado 'vigente'.
export function carteiraAt({ leads, contratos, planos, professor, data }) {
  const porLead = contratosDaModalidade(contratos, professor, planos);
  return (leads || []).flatMap((lead) => {
    const estado = estadoEm(porLead.get(lead?.id), data);
    return estado && professorAt(lead, data) === professor?.id ? [{ lead, estado }] : [];
  });
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professor.carteira.test.js
```

Esperado: PASS, 3 testes.

- [ ] **Passo 5: commit**

```bash
git add src/lib/professor/carteira.js src/lib/__tests__/professor.carteira.test.js
git commit -m "feat: carteira do professor na data, pela modalidade do plano"
```

---

### Tarefa 4: a renovação do ciclo

Regras, na ordem em que o código as aplica a cada contrato da modalidade do professor:

1. O fim previsto (`plannedEndsAt`) cai no ciclo e não depois do corte (`asOf`): só entra quem já venceu.
2. O cancelado enquanto ainda valia sai (a expressão do `renewalCohort`). O que nunca valeu cai aqui.
3. O trancado sai (`hasOpenPause`, também do `renewalCohort`).
4. O professor no dia do vencimento (`professorAt`) é o professor, e não houve troca de professor nos 90 dias antes do vencimento (entrada do histórico com a data em `(vencimento − 90 dias, vencimento]`).
5. Renovado é quem tem `liveRenewalOf`.

**Arquivos:**
- Criar: `src/lib/professor/renovacao.js`
- Criar: `src/lib/__tests__/professor.renovacao.test.js`

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professor.renovacao.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import { renewalCohort, summarizeCohort } from '../operacional/renewal.js';
import { renovacaoDoCiclo } from '../professor/renovacao.js';
import { limitesDoCiclo } from '../professor/ciclo.js';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const PROF = { id: 'p1', modalidadeIds: ['func'] };
const PLANOS = [{ id: 'move', modalityIds: ['func'] }, { id: 'start', modalityIds: ['musc'] }];
const ASOF = new Date('2027-12-10T12:00:00');

// Contrato de 12 meses do Move que vence em 10/03/2027.
const contrato = (id, over = {}) => ({
  id, leadId: id, planId: 'move', status: 'ativo', value: 2388,
  startsAt: new Date('2026-03-10T12:00:00'), endsAt: new Date('2027-03-10T12:00:00'),
  createdAt: new Date('2026-03-10T12:00:00'), ...over,
});
const renovacao = (id, de, over = {}) => contrato(id, {
  leadId: de, renewedFromId: de, startsAt: new Date('2027-03-10T12:00:00'), endsAt: new Date('2028-03-10T12:00:00'),
  createdAt: new Date('2027-03-01T12:00:00'), ...over,
});
const conta = ({ raw, leads, ciclo = 2027, asOf = ASOF }) => renovacaoDoCiclo({
  leads, contratos: normalizeContracts(raw), planos: PLANOS, professor: PROF, ciclo, asOf,
});
const lead = (id, over = {}) => ({ id, professorId: 'p1', ...over });

describe('renovacaoDoCiclo', () => {
  it('renovados ÷ venceram, com a renovação ligada e não cancelada', () => {
    const r = conta({
      raw: [contrato('ana'), renovacao('ana-r', 'ana'), contrato('bia')],
      leads: [lead('ana'), lead('bia')],
    });
    expect(r).toMatchObject({ venceram: 2, renovados: 1, taxa: 50 });
    expect(r.linhas.map((l) => [l.contrato.id, l.renovou])).toEqual([['ana', true], ['bia', false]]);
  });

  it('lead sem histórico vale o professor atual', () => {
    expect(conta({ raw: [contrato('ana')], leads: [lead('ana')] }).venceram).toBe(1);
    expect(conta({ raw: [contrato('ana')], leads: [lead('ana', { professorId: 'p2' })] }).venceram).toBe(0);
  });

  it('professor trocado 60 dias antes do vencimento: o contrato sai da conta', () => {
    const trocou = lead('ana', { professorHistory: [{ professorId: 'p2', since: null }, { professorId: 'p1', since: ts('2027-01-09T12:00:00') }] });
    expect(conta({ raw: [contrato('ana')], leads: [trocou] }).venceram).toBe(0);
  });

  it('professor trocado 100 dias antes do vencimento: conta para o novo professor', () => {
    const trocou = lead('ana', { professorHistory: [{ professorId: 'p2', since: null }, { professorId: 'p1', since: ts('2026-11-30T12:00:00') }] });
    expect(conta({ raw: [contrato('ana')], leads: [trocou] })).toMatchObject({ venceram: 1, renovados: 0 });
    const saiu = lead('ana', { professorId: 'p2', professorHistory: [{ professorId: 'p1', since: null }, { professorId: 'p2', since: ts('2026-11-30T12:00:00') }] });
    expect(conta({ raw: [contrato('ana')], leads: [saiu] }).venceram).toBe(0);
  });

  it('contrato que nunca valeu fica fora', () => {
    const r = conta({
      raw: [contrato('ana', { status: 'cancelado', cancelledAt: new Date('2026-03-09T12:00:00') })],
      leads: [lead('ana')],
    });
    expect(r).toMatchObject({ venceram: 0, renovados: 0, taxa: null });
  });

  it('renovação cancelada não conta como renovado', () => {
    const r = conta({
      raw: [contrato('ana'), renovacao('ana-r', 'ana', { status: 'cancelado', cancelledAt: new Date('2027-03-05T12:00:00') })],
      leads: [lead('ana')],
    });
    expect(r).toMatchObject({ venceram: 1, renovados: 0, taxa: 0 });
  });

  it('ciclo com poucos contratos dá a taxa do mesmo jeito, sem aviso', () => {
    const r = conta({ raw: [contrato('ana'), renovacao('ana-r', 'ana')], leads: [lead('ana')] });
    expect(r).toEqual({ venceram: 1, renovados: 1, taxa: 100, linhas: expect.any(Array) });
  });

  it('plano de outra modalidade fica fora', () => {
    expect(conta({ raw: [contrato('ana', { planId: 'start' })], leads: [lead('ana')] }).venceram).toBe(0);
  });

  it('o vencimento manda: fora do ciclo ou depois do corte não entra, e a renovação antecipada vale pelo fim previsto', () => {
    const fora = conta({ raw: [contrato('ana')], leads: [lead('ana')], ciclo: 2026 });
    expect(fora.venceram).toBe(0);
    const antes = conta({ raw: [contrato('ana')], leads: [lead('ana')], asOf: new Date('2027-03-09T12:00:00') });
    expect(antes.venceram).toBe(0);
    // Renovação que começou antes do fim encurtou o contrato, que guarda o fim de antes.
    const encurtado = contrato('ana', { endsAt: new Date('2027-01-31T12:00:00'), originalEndsAt: new Date('2027-03-10T12:00:00') });
    const r = conta({ raw: [encurtado, renovacao('ana-r', 'ana', { startsAt: new Date('2027-02-01T12:00:00') })], leads: [lead('ana')] });
    expect(r).toMatchObject({ venceram: 1, renovados: 1 });
  });

  it('dá o mesmo número que a taxa de renovação do Operacional quando as duas se aplicam', () => {
    const raw = [
      contrato('ana'), renovacao('ana-r', 'ana'),
      contrato('bia'),
      contrato('caio', { status: 'cancelado', cancelledAt: new Date('2026-12-15T12:00:00') }),
      contrato('dani', { status: 'cancelado', cancelledAt: new Date('2026-03-09T12:00:00') }),
      contrato('edu', { status: 'trancado', pausedAt: new Date('2027-02-01T12:00:00') }),
    ];
    const leads = ['ana', 'bia', 'caio', 'dani', 'edu'].map((id) => lead(id));
    const nosso = conta({ raw, leads });
    const { inicio, fim } = limitesDoCiclo(2027);
    const operacional = summarizeCohort(renewalCohort(normalizeContracts(raw), {
      start: inicio, end: fim, asOf: ASOF, graceDays: 15, leadsById: new Map(leads.map((l) => [l.id, l])),
    }));
    expect(nosso).toMatchObject({ venceram: 2, renovados: 1, taxa: 50 });
    expect([operacional.decided, operacional.counts.renew, operacional.rate]).toEqual([nosso.venceram, nosso.renovados, nosso.taxa]);
  });
});
```

No último teste, `caio` (cancelado antes do fim), `dani` (nunca valeu) e `edu` (trancado) ficam fora nas duas contas, `ana` renova nas duas e `bia` venceu sem renovar, passada a tolerância de 15 dias do Operacional.

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professor.renovacao.test.js
```

Esperado: FAIL, porque `../professor/renovacao.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professor/renovacao.js`:

```js
// Renovação da carteira no ciclo: renovados ÷ contratos que venceram, pela
// conta do período inteiro, sem amostra mínima e sem recuo para anos
// anteriores. Entram os contratos da modalidade do professor com o fim
// previsto (plannedEndsAt) no ciclo e até o corte (asOf). A carteira vale no
// dia do vencimento (professorAt), e o contrato com troca de professor nos 90
// dias antes do vencimento sai da conta. Renovado é quem tem renovação ligada
// e não cancelada (liveRenewalOf).
// O cancelado antes do fim e o trancado seguem o renewalCohort do Operacional
// (operacional/renewal.js): o contrato cancelado enquanto ainda valia sai da
// conta, sem entrar como vencido, e o trancado não vence. O contrato que nunca
// valeu (neverTookEffect) cai na mesma regra, porque foi cancelado antes do fim.
import { liveRenewalOf } from '../contracts.js';
import { pct } from '../crm/stats.js';
import { getSafeDateOrNull } from '../dates.js';
import { hasOpenPause } from '../operacional/base.js';
import { professorAt } from '../professorHistory.js';
import { contratosDaModalidade } from './carteira.js';
import { limitesDoCiclo } from './ciclo.js';

const DAY_MS = 86400000;
export const DIAS_SEM_TROCA = 90;

// Houve troca de professor nos 90 dias antes do vencimento: alguma entrada do
// histórico com a data em (vencimento − 90 dias, vencimento].
function trocouAntesDoFim(lead, vence) {
  const ate = vence.getTime();
  const desde = ate - DIAS_SEM_TROCA * DAY_MS;
  return (lead?.professorHistory || []).some((e) => {
    const t = getSafeDateOrNull(e?.since)?.getTime();
    return t != null && t > desde && t <= ate;
  });
}

// { venceram, renovados, taxa, linhas: [{ contrato, lead, renovou }] }.
export function renovacaoDoCiclo({ leads, contratos, planos, professor, ciclo, asOf = new Date() }) {
  const { inicio, fim } = limitesDoCiclo(ciclo);
  const leadsById = new Map((leads || []).map((l) => [l.id, l]));
  const linhas = [];
  contratosDaModalidade(contratos, professor, planos).forEach((lista, leadId) => {
    const lead = leadsById.get(leadId);
    if (!lead) return;
    lista.forEach((c) => {
      const vence = c.plannedEndsAt;
      if (!vence || vence < inicio || vence >= fim || vence > asOf) return;
      // Mesma conta do renewalCohort, sobre o mesmo contrato normalizado.
      if (c.cancelledAt && c.cancelledAt < c.endsAt) return;
      if (hasOpenPause(c)) return;
      if (professorAt(lead, vence) !== professor?.id || trocouAntesDoFim(lead, vence)) return;
      linhas.push({ contrato: c, lead, renovou: Boolean(liveRenewalOf(c.id, contratos)) });
    });
  });
  const renovados = linhas.filter((l) => l.renovou).length;
  return { venceram: linhas.length, renovados, taxa: pct(renovados, linhas.length), linhas };
}
```

O `linhas` fica no retorno porque a aba Carteira do PR 3 mostra a situação de cada aluno (renovou, não renovou).

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professor.renovacao.test.js
```

Esperado: PASS, 10 testes.

- [ ] **Passo 5: conferir que a comparação pega diferença**

Em `src/lib/professor/renovacao.js`, apague por um momento a linha `if (c.cancelledAt && c.cancelledAt < c.endsAt) return;` e rode de novo.

```bash
npx vitest run src/lib/__tests__/professor.renovacao.test.js
```

Esperado: FAIL na comparação com o Operacional e no teste do contrato que nunca valeu. Devolva a linha (o arquivo ainda não tem commit, então o `git checkout` não serve) e rode de novo para voltar a PASS.

- [ ] **Passo 6: commit**

```bash
git add src/lib/professor/renovacao.js src/lib/__tests__/professor.renovacao.test.js
git commit -m "feat: renovação da carteira do professor no ciclo"
```

---

### Tarefa 5: a conversão das aulas experimentais

**Arquivos:**
- Criar: `src/lib/professor/conversao.js`
- Criar: `src/lib/__tests__/professor.conversao.test.js`
- Modificar: `src/lib/__tests__/historicoDoProfessor.sweep.test.js` (`REVISADOS`)

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professor.conversao.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { APPTS_COMPLETE_MONTH as DO_CRM } from '../crm/scope.js';
import { APPTS_COMPLETE_MONTH, conversaoDoCiclo } from '../professor/conversao.js';

const ASOF = new Date('2027-06-15T12:00:00');
let seq = 0;
// Registro de aula experimental com "Compareceu", do professor p1, em março.
const aula = (leadId, over = {}) => ({
  id: `a${(seq += 1)}`, leadId, type: 'aula', status: 'attended', professorId: 'p1', professorName: 'Bruno',
  scheduledFor: new Date('2027-03-10T18:00:00'), converted: false, ...over,
});
const pago = (leadId, over = {}) => ({
  id: `c-${leadId}`, leadId, value: 2388, status: 'ativo',
  startsAt: new Date('2027-03-12T12:00:00'), endsAt: new Date('2028-03-12T12:00:00'), ...over,
});
const conta = (aulas, contratos, opts = {}) => conversaoDoCiclo({ aulas, contratos, professorId: 'p1', ciclo: 2027, asOf: ASOF, ...opts });

describe('conversaoDoCiclo', () => {
  it('conta pessoas: quem veio em dois agendamentos com o mesmo professor entra uma vez', () => {
    const r = conta([
      aula('ana', { scheduledFor: new Date('2027-03-03T18:00:00') }),
      aula('ana', { converted: true }),
      aula('bia'),
    ], [pago('ana')]);
    expect(r.professor).toEqual({ vieram: 2, matricularam: 1, taxa: 50 });
  });

  it('matrícula com freepass importado de R$ 0 não conta', () => {
    const importado = { id: 'c-ana', leadId: 'ana', value: 0, importBatchId: 'lote-1', status: 'ativo', startsAt: new Date('2027-03-12T12:00:00') };
    expect(conta([aula('ana', { converted: true })], [importado]).professor).toEqual({ vieram: 1, matricularam: 0, taxa: 0 });
  });

  it('contrato importado com valor e contrato que nunca valeu também não contam', () => {
    const importado = pago('ana', { importSource: 'nextfit' });
    const desistiu = pago('bia', { status: 'cancelado', cancelledAt: new Date('2027-03-12T12:00:00') });
    const r = conta([aula('ana', { converted: true }), aula('bia', { converted: true })], [importado, desistiu]);
    expect(r.professor.matricularam).toBe(0);
  });

  it('aula dos últimos 30 dias fica fora', () => {
    const r = conta([aula('ana', { scheduledFor: new Date('2027-05-20T18:00:00') }), aula('bia', { scheduledFor: new Date('2027-05-10T18:00:00') })], []);
    expect(r.professor.vieram).toBe(1);
    expect(conta([aula('ana', { scheduledFor: new Date('2027-05-20T18:00:00') })], [], { janelaDias: 10 }).professor.vieram).toBe(1);
  });

  it('fora do ciclo, falta, visita e treino sozinho não entram', () => {
    const r = conta([
      aula('a', { scheduledFor: new Date('2026-11-30T18:00:00') }),
      aula('b', { status: 'no_show' }),
      aula('c', { type: 'visita' }),
      aula('d', { soloTraining: true }),
      aula('e', { professorId: null }),
      aula('f', { scheduledFor: { toDate: () => new Date('2026-12-01T09:00:00') } }),
    ], []);
    expect(r.professor.vieram).toBe(1);
    expect(r.academia.vieram).toBe(1);
  });

  it('a matrícula vai para o professor da aula marcada como convertida', () => {
    const aulas = [aula('ana', { professorId: 'p2', scheduledFor: new Date('2027-03-01T18:00:00') }), aula('ana', { converted: true })];
    expect(conta(aulas, [pago('ana')], { professorId: 'p2' }).professor).toEqual({ vieram: 1, matricularam: 0, taxa: 0 });
    expect(conta(aulas, [pago('ana')]).professor).toEqual({ vieram: 1, matricularam: 1, taxa: 100 });
  });

  it('a academia conta cada pessoa uma vez, pelo total', () => {
    const aulas = [
      aula('ana', { professorId: 'p2', scheduledFor: new Date('2027-03-01T18:00:00') }), aula('ana', { converted: true }),
      aula('bia', { professorId: 'p2', converted: true }), aula('caio', { professorId: 'p2' }),
    ];
    expect(conta(aulas, [pago('ana'), pago('bia')]).academia).toEqual({ vieram: 3, matricularam: 2, taxa: 67 });
  });

  it('professor com 3 pessoas tem veredito, sem mínimo', () => {
    const aulas = [
      aula('ana', { converted: true }), aula('bia', { converted: true }), aula('caio'),
      aula('d1', { professorId: 'p2' }), aula('d2', { professorId: 'p2' }), aula('d3', { professorId: 'p2', converted: true }),
    ];
    const r = conta(aulas, [pago('ana'), pago('bia'), pago('d3')]);
    expect(r.professor).toEqual({ vieram: 3, matricularam: 2, taxa: 67 });
    expect(r.academia).toEqual({ vieram: 6, matricularam: 3, taxa: 50 });
    expect(r.passa).toBe(true);
  });

  it('empatar com a academia não passa; a tolerância abre a folga', () => {
    const aulas = [aula('ana', { converted: true }), aula('bia'), aula('d1', { professorId: 'p2', converted: true }), aula('d2', { professorId: 'p2' })];
    const contratos = [pago('ana'), pago('d1')];
    expect(conta(aulas, contratos).passa).toBe(false);
    expect(conta(aulas, contratos, { tolerancia: 5 }).passa).toBe(true);
  });

  it('sem ninguém do professor não há veredito', () => {
    expect(conta([aula('ana', { professorId: 'p2' })], []).passa).toBeNull();
  });

  it('avisa o ciclo que pega os agendamentos incompletos, antes de setembro de 2026', () => {
    expect(conversaoDoCiclo({ aulas: [], contratos: [], professorId: 'p1', ciclo: 2026, asOf: ASOF }).incompleto).toBe(true);
    expect(conta([], []).incompleto).toBe(false);
    expect(APPTS_COMPLETE_MONTH).toBe(DO_CRM);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professor.conversao.test.js
```

Esperado: FAIL, porque `../professor/conversao.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professor/conversao.js`:

```js
// Conversão das aulas experimentais no ciclo: pessoas que vieram e quantas
// delas se matricularam. Freepass e aula experimental são o mesmo registro em
// stronix_aulas, então entram juntos. Cada lead conta uma vez por professor
// (o professorRowsOf dos Relatórios conta registros, e por isso não serve).
// A matrícula é o `converted` que o markConvertingAula grava na última aula
// com "Compareceu" do lead, e só vale com contrato pago: valor acima de zero,
// não importado e que chegou a valer. Treino sozinho e visita não entram, e a
// aula dos últimos `janelaDias` fica fora, porque ainda não teve tempo de
// virar matrícula. A mesma conta sobre a academia inteira, pelo total de
// pessoas, dá a referência. O professor passa quando fica acima da academia
// menos a tolerância; empate não passa. Não há mínimo de pessoas.
import { AULA_STATUS, isAulaRecord, isSoloTrainingRecord } from '../aulas.js';
import { isImportedContract, neverTookEffect } from '../contracts.js';
import { pct } from '../crm/stats.js';
import { getSafeDateOrNull } from '../dates.js';
import { monthKeyOf } from '../operacional/month.js';
import { limitesDoCiclo } from './ciclo.js';

const DAY_MS = 86400000;

// Cópia do APPTS_COMPLETE_MONTH de crm/scope.js, que este arquivo não pode
// importar (scope.js chega ao firebase e ao dailyGoal.js). O teste confere as duas.
export const APPTS_COMPLETE_MONTH = '2026-09';

const contratoPago = (c) => Number(c?.value) > 0 && !isImportedContract(c) && !neverTookEffect(c);

function contaPessoas(registros, comContratoPago) {
  const porLead = new Map();
  registros.forEach((r) => {
    porLead.set(r.leadId, porLead.get(r.leadId) || (r.converted === true && comContratoPago.has(r.leadId)));
  });
  let matricularam = 0;
  porLead.forEach((m) => { if (m) matricularam += 1; });
  return { vieram: porLead.size, matricularam, taxa: pct(matricularam, porLead.size) };
}

// { professor, academia, passa, incompleto }. `passa` é null sem pessoas de
// um dos lados. A comparação usa as porcentagens inteiras que a tela mostra.
// `incompleto` diz que o ciclo pega o trecho antes de setembro de 2026, com
// os agendamentos incompletos.
export function conversaoDoCiclo({ aulas, contratos, professorId, ciclo, asOf = new Date(), janelaDias = 30, tolerancia = 0 }) {
  const { inicio, fim } = limitesDoCiclo(ciclo);
  const corte = asOf.getTime() - janelaDias * DAY_MS;
  const vieram = (aulas || []).filter((r) => {
    const at = getSafeDateOrNull(r?.scheduledFor);
    return Boolean(r?.leadId) && isAulaRecord(r) && r.status === AULA_STATUS.ATTENDED && !isSoloTrainingRecord(r)
      && Boolean(at) && at >= inicio && at < fim && at.getTime() < corte;
  });
  const comContratoPago = new Set((contratos || []).filter(contratoPago).map((c) => c.leadId));
  const professor = contaPessoas(vieram.filter((r) => r.professorId === professorId), comContratoPago);
  const academia = contaPessoas(vieram, comContratoPago);
  const passa = professor.taxa == null || academia.taxa == null ? null : professor.taxa > academia.taxa - tolerancia;
  return { professor, academia, passa, incompleto: monthKeyOf(inicio) < APPTS_COMPLETE_MONTH };
}
```

A conversão aceita os contratos crus ou normalizados: ela só lê `value`, os carimbos da importação, `startsAt` e `cancelledAt`.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professor.conversao.test.js
```

Esperado: PASS, 11 testes.

- [ ] **Passo 5: a varredura do PR 1**

O `conversao.js` tem `professorId` num parâmetro desestruturado, e a varredura do histórico o lista:

```bash
npx vitest run src/lib/__tests__/historicoDoProfessor.sweep.test.js
```

Esperado: FAIL em "todo arquivo com professorId como chave foi revisado", com `src/lib/professor/conversao.js`. Ele só conta e não grava o lead. Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, no bloco "Só mostram ou contam." de `REVISADOS`, logo depois de `'src/lib/dashboardMetrics.js': 'contagem por professor',`, acrescente:

```js
  'src/lib/professor/conversao.js': 'conversão do perfil do professor, só conta',
```

Rode de novo. Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add src/lib/professor/conversao.js src/lib/__tests__/professor.conversao.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git commit -m "feat: conversão das aulas experimentais do professor contra a academia"
```

---

### Tarefa 6: o NPS

**Arquivos:**
- Criar: `src/lib/professor/nps.js`
- Criar: `src/lib/__tests__/professor.nps.test.js`

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professor.nps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { npsDe, npsDoAno } from '../professor/nps.js';

// Totais de uma pergunta a partir das notas.
const pergunta = (notas) => ({
  soma: notas.reduce((a, b) => a + b, 0),
  promotores: notas.filter((n) => n >= 9).length,
  neutros: notas.filter((n) => n === 7 || n === 8).length,
  detratores: notas.filter((n) => n <= 6).length,
});
const vezes = (n, nota) => Array(n).fill(nota);
const totais = (notas, turma = notas.length, extra = {}) => ({ turma, respostas: notas.length, porPergunta: { q1: pergunta(notas), ...extra } });

describe('npsDe', () => {
  it('6 notas 10, 4 notas 9 e 2 notas 8 dão 9,33 e passam', () => {
    const r = npsDe(totais([...vezes(6, 10), ...vezes(4, 9), ...vezes(2, 8)]), { principalId: 'q1' });
    expect(r).toMatchObject({ valida: true, nota: 9.33, passa: true });
  });

  it('5 notas 10, 3 notas 9, 2 notas 8 e 2 notas 7 dão 8,92 e não passam', () => {
    const r = npsDe(totais([...vezes(5, 10), ...vezes(3, 9), ...vezes(2, 8), ...vezes(2, 7)]), { principalId: 'q1' });
    expect(r).toMatchObject({ valida: true, nota: 8.92, passa: false });
  });

  it('a meta é parâmetro', () => {
    const t = totais([...vezes(5, 10), ...vezes(3, 9), ...vezes(2, 8), ...vezes(2, 7)]);
    expect(npsDe(t, { principalId: 'q1', meta: 8.5 }).passa).toBe(true);
  });

  it('vale com metade da turma ou mais; 49% não vale', () => {
    expect(npsDe(totais(vezes(50, 10), 100), { principalId: 'q1' }).valida).toBe(true);
    const r = npsDe(totais(vezes(49, 10), 100), { principalId: 'q1' });
    expect(r).toMatchObject({ valida: false, nota: null, passa: null });
    expect(r.perguntas.q1.media).toBe(10);
  });

  it('vale com 10 respostas ou mais; 9 não vale', () => {
    expect(npsDe(totais(vezes(10, 10), 20), { principalId: 'q1' }).valida).toBe(true);
    expect(npsDe(totais(vezes(9, 10), 18), { principalId: 'q1' }).valida).toBe(false);
  });

  it('turma vazia nunca vale', () => {
    expect(npsDe(totais(vezes(12, 10), 0), { principalId: 'q1' }).valida).toBe(false);
  });

  it('promotores, detratores e o NPS clássico por pergunta, só como informação', () => {
    const notas = [...vezes(6, 10), ...vezes(2, 8), ...vezes(4, 4)];
    const r = npsDe(totais(notas, 12, { q2: pergunta(vezes(12, 9)) }), { principalId: 'q1' });
    expect(r.perguntas.q1).toEqual({ media: 7.67, promotores: 50, nps: 17 });
    expect(r.perguntas.q2).toEqual({ media: 9, promotores: 100, nps: 100 });
    expect(r.nota).toBe(7.67);
  });

  it('sem resposta não tem média', () => {
    expect(npsDe({ turma: 10, respostas: 0, porPergunta: { q1: pergunta([]) } }, { principalId: 'q1' }).perguntas.q1)
      .toEqual({ media: null, promotores: null, nps: null });
  });
});

describe('npsDoAno', () => {
  const passa = npsDe(totais([...vezes(6, 10), ...vezes(4, 9), ...vezes(2, 8)]), { principalId: 'q1' });
  const naoPassa = npsDe(totais([...vezes(5, 10), ...vezes(3, 9), ...vezes(2, 8), ...vezes(2, 7)]), { principalId: 'q1' });
  const invalida = npsDe(totais(vezes(9, 10), 18), { principalId: 'q1' });

  it('com uma pesquisa válida, vale ela', () => {
    expect(npsDoAno([passa, invalida])).toEqual({ nota: 9.33, pesquisas: 1, passa: true });
  });

  it('com duas válidas, a média das duas', () => {
    expect(npsDoAno([passa, naoPassa])).toEqual({ nota: 9.13, pesquisas: 2, passa: true });
  });

  it('sem pesquisa válida não há nota', () => {
    expect(npsDoAno([invalida])).toEqual({ nota: null, pesquisas: 0, passa: null });
    expect(npsDoAno([])).toEqual({ nota: null, pesquisas: 0, passa: null });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professor.nps.test.js
```

Esperado: FAIL, porque `../professor/nps.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professor/nps.js`:

```js
// NPS do professor a partir dos totais de uma pesquisa
// (stronix_nps_totais: { turma, respostas, porPergunta: { [id]: { soma,
// promotores, neutros, detratores } } }). A nota é a média de 0 a 10 da
// pergunta principal, com duas casas, e a meta é 9 (parâmetro). A porcentagem
// de promotores e o NPS clássico (promotores menos detratores) são só
// informação. A pesquisa vale com 10 respostas ou mais e com pelo menos
// metade da turma.
import { pct } from '../crm/stats.js';

export const RESPOSTAS_MINIMAS = 10;
const dua = (x) => Math.round(x * 100) / 100;
const num = (v) => Number(v) || 0;

// { respostas, turma, valida, perguntas: { [id]: { media, promotores, nps } },
// nota, passa }. Sem validade, nota e passa são null ("sem nota válida").
// A meta compara a nota com duas casas, a mesma que a tela mostra.
export function npsDe(totais, { principalId, meta = 9 } = {}) {
  const respostas = num(totais?.respostas);
  const turma = num(totais?.turma);
  const valida = turma > 0 && respostas >= RESPOSTAS_MINIMAS && respostas * 2 >= turma;
  const perguntas = {};
  Object.entries(totais?.porPergunta || {}).forEach(([id, p]) => {
    perguntas[id] = respostas > 0
      ? {
        media: dua(num(p?.soma) / respostas),
        promotores: pct(num(p?.promotores), respostas),
        nps: Math.round(((num(p?.promotores) - num(p?.detratores)) / respostas) * 100),
      }
      : { media: null, promotores: null, nps: null };
  });
  const nota = valida ? (perguntas[principalId]?.media ?? null) : null;
  return { respostas, turma, valida, perguntas, nota, passa: nota == null ? null : nota >= meta };
}

// A nota do ano: média das notas das pesquisas válidas do ciclo (o resultado
// do npsDe de cada uma). Com uma só válida, vale ela; sem nenhuma, null.
export function npsDoAno(resultados, { meta = 9 } = {}) {
  const notas = (resultados || []).map((r) => r?.nota).filter(Number.isFinite);
  const nota = notas.length ? dua(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
  return { nota, pesquisas: notas.length, passa: nota == null ? null : nota >= meta };
}
```

Quem escolhe as pesquisas do ciclo (o campo `ciclo` da pesquisa) é quem chama o `npsDoAno`, no PR 4.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professor.nps.test.js
```

Esperado: PASS, 11 testes.

- [ ] **Passo 5: commit**

```bash
git add src/lib/professor/nps.js src/lib/__tests__/professor.nps.test.js
git commit -m "feat: nota do NPS do professor a partir dos totais da pesquisa"
```

---

### Tarefa 7: a aderência

Regras do aluno-semana, de segunda a sexta (a semana é a da segunda-feira, a mesma da chave `stronix_presencas/{leadId}_{segunda}`):

- O professor do aluno na segunda-feira (`professorAt`) é o professor.
- O aluno tem contrato da modalidade **vigente na segunda às 00:00**. Contrato que começa no meio da semana não cobre aquela semana.
- O aluno **já tinha contrato da modalidade, vigente ou trancado, no fim da sexta anterior**. É assim que a primeira semana do contrato fica fora (a que começa na segunda, no sábado ou no domingo), e a renovação emendada, que cobre a sexta pelo contrato de antes, não perde semana.
- **Nenhum dia de segunda a sexta, ao meio-dia, encontra o aluno trancado** (`estadoEm`, que dá vigente quando um contrato paralelo vale).
- Só entram as semanas que já têm registro importado e que acabaram (sábado às 00:00 até o corte). Aluno sem registro na semana teve nenhuma presença.

**Arquivos:**
- Criar: `src/lib/professor/aderencia.js`
- Criar: `src/lib/__tests__/professor.aderencia.test.js`

- [ ] **Passo 1: escrever os testes**

`src/lib/__tests__/professor.aderencia.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import { aderenciaDoAno, aderenciaDoSemestre, aderenciaPorSemana } from '../professor/aderencia.js';

const PROF = { id: 'p1', modalidadeIds: ['func'] };
const PLANOS = [{ id: 'move', modalityIds: ['func'] }, { id: 'start', modalityIds: ['musc'] }];
const contrato = (leadId, over = {}) => ({
  id: `c-${leadId}`, leadId, planId: 'move', status: 'ativo', value: 2388,
  startsAt: new Date('2027-01-10T12:00:00'), endsAt: new Date('2028-01-10T12:00:00'),
  createdAt: new Date('2027-01-10T12:00:00'), ...over,
});

describe('aderenciaPorSemana', () => {
  // Semanas de segunda 01/03, 08/03 e 15/03/2027.
  const contratos = normalizeContracts([
    contrato('ana'),
    // Começa na segunda 08/03 às 00:00: a semana de 08/03 é a primeira do contrato.
    contrato('bia', { startsAt: new Date('2027-03-08T00:00:00'), createdAt: new Date('2027-03-08T00:00:00') }),
    // Trancado na terça 09/03.
    contrato('caio', { status: 'trancado', pausedAt: new Date('2027-03-09T10:00:00') }),
    contrato('dani', { planId: 'start' }),
    contrato('edu'),
  ]);
  const leads = [
    { id: 'ana', professorId: 'p1' }, { id: 'bia', professorId: 'p1' }, { id: 'caio', professorId: 'p1' },
    { id: 'dani', professorId: 'p1' }, { id: 'edu', professorId: 'p2' },
  ];
  const presencas = [
    { leadId: 'ana', semana: '2027-03-01', presencas: 3 },
    { leadId: 'caio', semana: '2027-03-01', presencas: 2 },
    { leadId: 'ana', semana: '2027-03-08', presencas: 1 },
    { leadId: 'bia', semana: '2027-03-08', presencas: 4 },
    { leadId: 'dani', semana: '2027-03-08', presencas: 5 },
    { leadId: 'edu', semana: '2027-03-08', presencas: 5 },
    { leadId: 'bia', semana: '2027-03-15', presencas: 2 },
    // Semana que ainda não acabou no corte.
    { leadId: 'ana', semana: '2027-03-22', presencas: 2 },
  ];
  const linhas = aderenciaPorSemana({ presencas, leads, contratos, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00') });

  it('uma linha por semana importada e já acabada, da mais nova para a mais antiga', () => {
    expect(linhas.map((l) => l.semana)).toEqual(['2027-03-15', '2027-03-08', '2027-03-01']);
  });

  it('conta aluno-semanas da carteira, sem a primeira semana do contrato e sem semana trancada', () => {
    expect(linhas).toEqual([
      { semana: '2027-03-15', contam: 2, aderentes: 1, umaPresenca: 0, nenhuma: 1, taxa: 50 },
      { semana: '2027-03-08', contam: 1, aderentes: 0, umaPresenca: 1, nenhuma: 0, taxa: 0 },
      { semana: '2027-03-01', contam: 2, aderentes: 2, umaPresenca: 0, nenhuma: 0, taxa: 100 },
    ]);
  });

  it('a barra é parâmetro', () => {
    const com3 = aderenciaPorSemana({ presencas, leads, contratos, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00'), barra: 3 });
    expect(com3.find((l) => l.semana === '2027-03-01')).toMatchObject({ contam: 2, aderentes: 1 });
  });

  it('contrato que começa no meio da semana perde aquela semana e conta na seguinte', () => {
    const quarta = normalizeContracts([contrato('ana', { startsAt: new Date('2027-03-03T12:00:00'), createdAt: new Date('2027-03-03T12:00:00') })]);
    const r = aderenciaPorSemana({
      presencas: [{ leadId: 'ana', semana: '2027-03-01', presencas: 2 }, { leadId: 'ana', semana: '2027-03-08', presencas: 2 }],
      leads: [{ id: 'ana', professorId: 'p1' }], contratos: quarta, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00'),
    });
    expect(r.map((l) => [l.semana, l.contam])).toEqual([['2027-03-08', 1], ['2027-03-01', 0]]);
  });

  it('a renovação emendada não perde a primeira semana', () => {
    const emendada = normalizeContracts([
      contrato('ana', { endsAt: new Date('2027-03-08T00:00:00') }),
      contrato('ana', { id: 'c-ana-r', renewedFromId: 'c-ana', startsAt: new Date('2027-03-08T00:00:00'), endsAt: new Date('2028-03-08T00:00:00'), createdAt: new Date('2027-03-01T12:00:00') }),
    ]);
    const r = aderenciaPorSemana({
      presencas: [{ leadId: 'ana', semana: '2027-03-08', presencas: 2 }],
      leads: [{ id: 'ana', professorId: 'p1' }], contratos: emendada, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00'),
    });
    expect(r).toEqual([{ semana: '2027-03-08', contam: 1, aderentes: 1, umaPresenca: 0, nenhuma: 0, taxa: 100 }]);
  });

  it('sem presença importada não há semana', () => {
    expect(aderenciaPorSemana({ presencas: [], leads, contratos, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00') })).toEqual([]);
  });
});

describe('aderenciaDoSemestre e aderenciaDoAno', () => {
  const linhas = [
    { semana: '2027-12-27', contam: 10, aderentes: 0 },
    { semana: '2027-11-29', contam: 10, aderentes: 9 },
    { semana: '2027-08-02', contam: 10, aderentes: 5 },
    { semana: '2027-03-01', contam: 10, aderentes: 7 },
    { semana: '2027-02-01', contam: 10, aderentes: 5 },
  ];

  it('soma aluno-semanas do semestre, pela segunda-feira, sem dezembro', () => {
    expect(aderenciaDoSemestre(linhas, { inicio: new Date('2027-01-01T00:00:00'), fim: new Date('2027-07-01T00:00:00') }))
      .toEqual({ contam: 20, aderentes: 12, taxa: 60 });
    // A semana de segunda 29/11 conta em julho a novembro; a de 27/12, em nenhum.
    expect(aderenciaDoSemestre(linhas, { inicio: new Date('2027-07-01T00:00:00'), fim: new Date('2027-12-01T00:00:00') }))
      .toEqual({ contam: 20, aderentes: 14, taxa: 70 });
  });

  it('nota do ano com os dois semestres fechados, na avaliação de dezembro', () => {
    const r = aderenciaDoAno(linhas, 2027, new Date('2027-12-10T12:00:00'));
    expect(r.nota).toBe(65);
    expect(r.semestres.map((s) => [s.fechado, s.taxa])).toEqual([[true, 60], [true, 70]]);
  });

  it('com um só semestre fechado, vale ele; sem nenhum, não há nota', () => {
    expect(aderenciaDoAno(linhas, 2027, new Date('2027-08-10T12:00:00')).nota).toBe(60);
    expect(aderenciaDoAno(linhas, 2027, new Date('2027-05-10T12:00:00')).nota).toBeNull();
  });
});
```

Na semana de 08/03, `bia` fica fora porque o contrato começou nessa segunda, `caio` fica fora porque trancou na terça, `dani` é de outra modalidade e `edu` é de outro professor. Sobra `ana`, com 1 presença.

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/professor.aderencia.test.js
```

Esperado: FAIL, porque `../professor/aderencia.js` não existe.

- [ ] **Passo 3: escrever o módulo**

`src/lib/professor/aderencia.js`:

```js
// Aderência da carteira: por aluno-semana, de segunda a sexta, pelas
// presenças na aula de funcional importadas da Next Fit
// (stronix_presencas/{leadId}_{segunda}: { leadId, semana: 'AAAA-MM-DD',
// presencas }). A semana é aderente com presenças iguais ou acima da barra (2).
// O aluno conta na semana quando:
//   - o professor dele na segunda-feira (professorAt) é o professor;
//   - ele tem contrato da modalidade vigente na segunda às 00:00;
//   - ele já tinha contrato da modalidade (vigente ou trancado) no fim da
//     sexta anterior: é assim que a primeira semana do contrato fica fora, e a
//     renovação emendada não perde semana;
//   - nenhum dia de segunda a sexta, ao meio-dia, o encontra trancado.
// Só entram as semanas que já têm registro importado e que acabaram (sábado
// às 00:00 até o corte). Aluno sem registro na semana teve nenhuma presença.
import { pct } from '../crm/stats.js';
import { fromDateInputValue } from '../dates.js';
import { professorAt } from '../professorHistory.js';
import { contratosDaModalidade, estadoEm } from './carteira.js';
import { semestresDoCiclo } from './ciclo.js';

export const BARRA_PADRAO = 2;

const dia = (segunda, n, hora = 0) => new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + n, hora);

function contaNaSemana(contratos, segunda) {
  if (estadoEm(contratos, segunda) !== 'vigente') return false;
  if (!estadoEm(contratos, new Date(dia(segunda, -2).getTime() - 1))) return false;
  for (let n = 0; n < 5; n += 1) {
    if (estadoEm(contratos, dia(segunda, n, 12)) === 'trancado') return false;
  }
  return true;
}

// [{ semana, contam, aderentes, umaPresenca, nenhuma, taxa }], da semana mais
// nova para a mais antiga.
export function aderenciaPorSemana({ presencas, leads, contratos, planos, professor, asOf = new Date(), barra = BARRA_PADRAO }) {
  const porChave = new Map();
  const semanas = new Set();
  (presencas || []).forEach((p) => {
    if (!p?.leadId || !p?.semana) return;
    semanas.add(p.semana);
    porChave.set(`${p.leadId}_${p.semana}`, Number(p.presencas) || 0);
  });
  const leadsById = new Map((leads || []).map((l) => [l.id, l]));
  const daModalidade = contratosDaModalidade(contratos, professor, planos);
  const linhas = [];
  [...semanas].sort().reverse().forEach((semana) => {
    const segunda = fromDateInputValue(semana);
    if (!segunda || dia(segunda, 5) > asOf) return;
    const linha = { semana, contam: 0, aderentes: 0, umaPresenca: 0, nenhuma: 0 };
    daModalidade.forEach((lista, leadId) => {
      const lead = leadsById.get(leadId);
      if (!lead || professorAt(lead, segunda) !== professor?.id || !contaNaSemana(lista, segunda)) return;
      const n = porChave.get(`${leadId}_${semana}`) || 0;
      linha.contam += 1;
      if (n >= barra) linha.aderentes += 1;
      else if (n === 1) linha.umaPresenca += 1;
      else if (n === 0) linha.nenhuma += 1;
    });
    linhas.push({ ...linha, taxa: pct(linha.aderentes, linha.contam) });
  });
  return linhas;
}

// Aluno-semanas aderentes ÷ que contam, nas semanas com a segunda-feira em
// [inicio, fim).
export function aderenciaDoSemestre(linhas, { inicio, fim }) {
  let contam = 0;
  let aderentes = 0;
  (linhas || []).forEach((l) => {
    const segunda = fromDateInputValue(l?.semana);
    if (!segunda || segunda < inicio || segunda >= fim) return;
    contam += l.contam;
    aderentes += l.aderentes;
  });
  return { contam, aderentes, taxa: pct(aderentes, contam) };
}

// Os dois semestres do ciclo e a nota do ano: a média das taxas dos
// semestres fechados (fim até o corte). Com um só fechado, vale ele.
export function aderenciaDoAno(linhas, ciclo, asOf = new Date()) {
  const semestres = semestresDoCiclo(ciclo).map((s) => ({ ...s, fechado: s.fim <= asOf, ...aderenciaDoSemestre(linhas, s) }));
  const taxas = semestres.filter((s) => s.fechado && s.taxa != null).map((s) => s.taxa);
  return { semestres, nota: taxas.length ? Math.round(taxas.reduce((a, b) => a + b, 0) / taxas.length) : null };
}
```

O semestre inteiro de julho a dezembro, que a spec quer mostrar depois de dezembro fechar, sai do mesmo `aderenciaDoSemestre` com `{ inicio: 1º de julho, fim: 1º de janeiro }`, chamado pela tela no PR 6.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/professor.aderencia.test.js
```

Esperado: PASS, 9 testes.

- [ ] **Passo 5: commit**

```bash
git add src/lib/professor/aderencia.js src/lib/__tests__/professor.aderencia.test.js
git commit -m "feat: aderência da carteira do professor por semana e por semestre"
```

---

### Tarefa 8: a varredura dos imports

**Arquivos:**
- Criar: `src/lib/__tests__/professorContasImports.test.js`

- [ ] **Passo 1: escrever a varredura**

`src/lib/__tests__/professorContasImports.test.js`:

```js
// As contas do perfil do professor (src/lib/professor/) vão ser lidas também
// pela api/ (a página pública do NPS confere a carteira), com o SDK de
// servidor. Nada no caminho delas pode chegar a pacote: firebase.js inicializa
// o SDK do navegador, dailyGoal.js puxa lucide-react e funnels.js importa
// writeBatch. Esta varredura segue os imports de verdade, arquivo por arquivo,
// como a newLeadImports.test.js, porque um import direto limpo não basta:
// crm/scope.js e crm/appointments.js chegam ao dailyGoal.js por dentro.
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
const PASTA = path.join(REPO, 'src/lib/professor');
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

describe('as contas do professor cabem na api/', () => {
  it('a pasta tem as seis contas', () => {
    expect(ARQUIVOS).toEqual(['aderencia.js', 'carteira.js', 'ciclo.js', 'conversao.js', 'nps.js', 'renovacao.js']);
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

Arquivo novo na pasta faz o primeiro teste falhar de propósito: quem cria acrescenta o nome na lista e ganha a conferência dele.

- [ ] **Passo 2: rodar**

```bash
npx vitest run src/lib/__tests__/professorContasImports.test.js
```

Esperado: PASS, 7 testes.

- [ ] **Passo 3: conferir que a varredura pega o erro**

Acrescente por um momento, na primeira linha de `src/lib/professor/nps.js`:

```js
import { APPTS_COMPLETE_MONTH } from '../crm/scope.js';
```

```bash
npx vitest run src/lib/__tests__/professorContasImports.test.js
```

Esperado: FAIL em "nps.js não chega a pacote nenhum nem a módulo do navegador". Apague a linha e rode de novo para voltar a PASS.

- [ ] **Passo 4: commit**

```bash
git add src/lib/__tests__/professorContasImports.test.js
git commit -m "test: contas do professor não chegam a pacote nem ao navegador"
```

---

### Tarefa 9: documentação e conferência final

**Arquivos:**
- Modificar: `CLAUDE.md` (seção "Perfil do professor")
- Modificar: `docs/quality.md`

- [ ] **Passo 1: a seção do `CLAUDE.md`**

Na seção "Perfil do professor" do `CLAUDE.md`, depois do item "Histórico de troca de professor (PR 1)", acrescente:

```markdown
- **As contas** (PR 2). Funções puras em `src/lib/professor/`, sem tela, que a `api/` também vai ler; o `professorContasImports.test.js` segue os imports de cada arquivo e reprova quem chegar a pacote, ao `firebase.js`, ao `dailyGoal.js`, ao `funnels.js`, a `crm/scope.js` ou a `crm/appointments.js`. Arquivo novo na pasta entra na lista do teste.
  - **Ciclo** (`ciclo.js`): de 1º de dezembro a 30 de novembro, no fuso local, com o nome do ano em que termina (`cicloDe`, `limitesDoCiclo`). Os semestres da aderência são de janeiro a junho e de julho a novembro (`semestresDoCiclo`).
  - **Contratos normalizados.** Carteira, renovação e aderência recebem os contratos já passados pelo `normalizeContracts` (`operacional/base.js`), uma vez, como o Operacional. A conversão lê só valor, carimbos da importação e datas, e aceita a lista crua.
  - **Carteira** (`carteira.js`): o professor na data é o do `professorAt`, e o contrato é da modalidade quando o plano tem uma das `modalidadeIds` do professor (`planModalityIds`). Contrato sem plano no catálogo fica fora. O `carteiraAt` devolve o estado de cada aluno (vigente ou trancado, e vigente vence trancado, como no `personStatesAt`).
  - **Renovação** (`renovacao.js`): renovados ÷ contratos que venceram no ciclo, até o corte, pelo fim previsto (`plannedEndsAt`). O cancelado antes do fim e o trancado saem pela mesma expressão do `renewalCohort` do Operacional, sobre o mesmo contrato normalizado, e um teste compara as duas contas. Sai também o contrato com troca de professor nos 90 dias antes do vencimento (`DIAS_SEM_TROCA`). Renovado é quem tem `liveRenewalOf`, e aqui a conta se separa do Operacional, que aceita qualquer sucessor até o fim da tolerância.
  - **Conversão** (`conversao.js`): pessoas que vieram (registro de aula com "Compareceu", sem treino sozinho, contando cada lead uma vez) e quantas se matricularam (algum desses registros com `converted` e um contrato pago: valor acima de zero, não importado e que chegou a valer). A aula dos últimos 30 dias fica fora (`janelaDias`). A academia é a mesma conta sem o filtro do professor, e o professor passa quando a porcentagem inteira dele fica acima da da academia menos a tolerância. O `isSoloTrainingRecord` mora em `aulas.js` desde este PR, e o `crm/appointments.js` reexporta. O `APPTS_COMPLETE_MONTH` tem uma cópia em `conversao.js`, e o teste confere que é igual à de `crm/scope.js`.
  - **NPS** (`nps.js`): a nota é a média da pergunta principal com duas casas, a meta compara esse número, e a pesquisa vale com 10 respostas ou mais e metade da turma. A nota do ano é a média das notas válidas do ciclo.
  - **Aderência** (`aderencia.js`): o aluno conta na semana com contrato da modalidade vigente na segunda às 00:00, que já existia no fim da sexta anterior (assim a primeira semana fica fora e a renovação emendada não perde semana), sem nenhum dia trancado de segunda a sexta. Só entram semanas com registro importado e já acabadas, e aluno sem registro teve nenhuma presença. O `stronix_presencas` que o PR 6 grava precisa ter `leadId`, `semana` (`'AAAA-MM-DD'`, a segunda) e `presencas`.
```

- [ ] **Passo 2: o `docs/quality.md`**

Na linha dos testes de importação, troque:

```markdown
- **Testes de importação** (`acessoImports`, `rotinasImports`, `newLeadImports`, `teamRolesImports`, `guardianImports`) travam,
```

por:

```markdown
- **Testes de importação** (`acessoImports`, `rotinasImports`, `newLeadImports`, `teamRolesImports`, `guardianImports`, `professorContasImports`) travam,
```

- [ ] **Passo 3: conferência completa**

```bash
npm run lint && npm test && npm run verificar:sentry && npm run build
```

Esperado: tudo passa.

- [ ] **Passo 4: commit**

```bash
git add CLAUDE.md docs/quality.md
git commit -m "docs: regras das contas do perfil do professor no CLAUDE.md"
```

- [ ] **Passo 5: parar e avisar o Johnny**

Não faça push nem abra PR sem o pedido dele. Diga o que entrou, leve as "Dúvidas para o Johnny" abaixo e sugira as rodadas de code review:

1. **Renovação contra o Operacional.** Motivo: é a conta com mais regra herdada. Prompt: "Revise `src/lib/professor/renovacao.js` contra `renewalCohort` em `src/lib/operacional/renewal.js`. Procure contrato que entra numa conta e não na outra, além das diferenças já anotadas no plano (liveRenewalOf e tolerância). Teste com renovação antecipada, contrato encurtado, trancado reativado e cancelado sem data."
2. **Datas e fuso.** Motivo: ciclo, semana e janela dependem de meia-noite local. Prompt: "Revise as datas de `src/lib/professor/` (ciclo, semana da aderência, sexta anterior, janela de 30 dias, 90 dias antes do vencimento). Rode os testes com `TZ=UTC` e `TZ=America/Sao_Paulo` e diga o que muda."
3. **Conversão por pessoa.** Motivo: o `converted` só marca a última aula, e o contrato pago não olha a modalidade. Prompt: "Revise `src/lib/professor/conversao.js`: quem pode contar como matrícula sem ter comprado, quem pode ficar de fora tendo comprado. Compare com `professorsOf` em `src/lib/crm/appointments.js` num mês real de dados de teste."
4. **Aderência.** Motivo: a regra da primeira semana e do trancamento é nova. Prompt: "Revise `src/lib/professor/aderencia.js` com contratos paralelos, contrato que acaba no meio da semana, trancamento de um dia e reativação na segunda. Diga se algum aluno-semana conta ou some sem motivo."
5. **Imports e api/.** Motivo: o PR 5 vai ler a carteira dentro da `api/`. Prompt: "Confira se a varredura `professorContasImports.test.js` pega todas as formas de import usadas em `src/lib/`, e se algum arquivo alcançado pelas contas usa API que não existe no Node 22 da Vercel."

---

## Dúvidas para o Johnny

1. **O que conta como renovado.** A spec manda usar o `liveRenewalOf`: só a renovação ligada ao contrato e não cancelada. A taxa de renovação do Operacional conta mais coisa como renovação: o contrato novo da mesma pessoa feito até o vencimento mais a tolerância da academia, como quem volta por matrícula em vez de Renovar, e a renovação que começou e foi cancelada depois. O Operacional também espera a tolerância passar antes de dar o contrato como não renovado. Com isso, a renovação do professor pode sair mais baixa que a do Operacional para os mesmos alunos. O plano segue a spec. Quer igualar ao Operacional?
2. **Contrato trancado no vencimento.** A spec não fala dele. O plano segue o Operacional: contrato ainda trancado não vence e fica fora da conta, porque o fim dele anda quando o aluno destranca. Confirma?
3. **A primeira semana do contrato.** O plano lê como a primeira semana da pessoa como aluna: a semana só conta se o aluno já tinha contrato de funcional na sexta anterior. Assim a renovação emendada não perde semana. Se a ideia era tirar a primeira semana de todo contrato, inclusive da renovação, a regra muda numa linha.
