# Rotinas dos consultores, parte 1: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o gestor monta modelos de rotina na tela Rotinas (aba Modelos) e escolhe quem segue cada um, e o consultor dá check nas tarefas do dia num cartão da Meta diária.

**Architecture:** uma regra pura (`src/lib/rotinas.js`) diz quais tarefas valem no dia e o estado de cada uma. As gravações moram em `src/lib/rotinasWrites.js`: modelo e versão do dia sempre juntos, numa transação. Três coleções novas sob `artifacts/{appId}/public/data/` têm regras próprias. A tela Rotinas entra no endereço (`/<academia>/rotinas` e `/<academia>/rotinas/modelos/<id>`) com a trava de gestor, e o cartão "Rotina de hoje" entra na lateral da `DailyGoalView`. O servidor tira do modelo quem vira professor ou é excluído.

**Tech Stack:** React 19 + Vite (JS/JSX), Tailwind v4 com os tokens do app, shadcn/ui, Firebase modular (navegador) e firebase-admin (`api/`), React Router 7 sem `<Routes>`, Vitest (node e jsdom com `react-dom/client`).

**Spec:** `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md`. **Mockups:** `docs/superpowers/specs/mockups/2026-10-06-rotina-na-meta-diaria.html` (opção A) e `docs/superpowers/specs/mockups/2026-10-06-tela-rotinas-gestor.html` (aba Modelos). Abra os dois no navegador antes das Tasks 5 e 8.

**Fora desta parte** (vêm nas partes 2 e 3): aba Hoje do gestor, histórico no Operacional, e a etiqueta "Novo" no item do menu (o `SidebarItem` não tem essa prop; a novidade no sino, da Task 10, faz o aviso).

---

## Antes de começar

- [ ] Leia o `CLAUDE.md` do Stronilead (raiz do repositório). As regras que mais pesam aqui: trabalho só via PR, sem merge sem o ok do Johnny; regras do Firestore publicadas antes do merge; `api/` com 11 de 12 funções (esta parte não cria função); comparar `role` com texto fora de `src/lib/acesso.js` reprova o `acessoSweep.test.js`.
- [ ] Na worktree: `git fetch origin && git rev-list --count HEAD..origin/main`. Se der mais que 0, traga a main antes (`git merge origin/main`). A PR #247 do `crm-stronix` (remoção da Meta da equipe) mexe na `DailyGoalView` e no `metaLinks.test.js`. Se ela já estiver na main, os trechos citados nas Tasks 5 e 10 podem estar em outras linhas: procure pelo texto, não pela linha.
- [ ] `npm install` e confira que o `package-lock.json` não mudou (`git status`).
- [ ] Linha de base: `npm test` e `npm run lint` passando antes de qualquer mudança. Anote o número de testes.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/rotinas.js` (novo) | Regra pura: tarefa do dia, estado, textos, validação, troca de modelo, documentos a gravar. |
| `src/lib/rotinasWrites.js` (novo) | Gravações no Firestore: criar, editar, duplicar e excluir modelo, trocar a pessoa de modelo, check, observação e desfazer. |
| `src/hooks/useRoutineModels.js` (novo) | Assinatura de todos os modelos da academia (tela do gestor). |
| `src/hooks/useMyRoutine.js` (novo) | Assinatura do modelo de uma pessoa e dos checks dela no dia (cartão da Meta). |
| `src/components/dailygoal/RoutineCard.jsx` (novo) | Cartão "Rotina de hoje" na Meta diária. |
| `src/views/RotinasView.jsx` (novo) | Tela Rotinas: aba Modelos e o modelo aberto. |
| `src/components/rotinas/ModelCard.jsx` (novo) | Cartão de um modelo, com a faixa do dia. |
| `src/components/rotinas/ConsultantsList.jsx` (novo) | Lista de consultores com o modelo que cada um segue. |
| `src/components/rotinas/ModelDetail.jsx` (novo) | Dentro de um modelo: tarefas, quem segue, renomear, duplicar, excluir. |
| `src/components/rotinas/TaskSheet.jsx` (novo) | Painel Nova tarefa / Editar tarefa. |
| `src/components/rotinas/NewModelSheet.jsx` (novo) | Painel Novo modelo. |
| `src/components/rotinas/FormBits.jsx` (novo) | Peças de formulário dos painéis: escolha segmentada e dias da semana. |
| `src/components/ui/sheet.jsx` (novo, shadcn) | Painel lateral. |
| `src/lib/firebase.js` | Três constantes de caminho. |
| `firestore.rules` | Regras das três coleções. |
| `src/lib/routes.js`, `src/lib/appShell.js`, `src/lib/tenantSlug.js`, `src/lib/sentryScrub.js` | Endereço da tela e do modelo aberto. |
| `src/lib/sidebarNav.js`, `src/App.jsx` | Item do menu, título do cabeçalho e a tela. |
| `src/views/DailyGoalView.jsx` | O cartão na lateral. |
| `api/admin-users.js` | Quem vira professor ou é excluído sai do modelo. |
| `src/lib/announcements.js` | Novidade no sino para os gestores. |
| `CLAUDE.md` | Seção "Rotinas dos consultores". |

---

### Task 1: caminhos e regras do Firestore

**Files:**
- Modify: `src/lib/firebase.js` (fim do bloco de constantes de caminho, depois da última `export const ..._PATH`)
- Modify: `firestore.rules` (depois do bloco `match /artifacts/{appId}/public/data/stronix_aulas/{id}`, antes de `match /tenants/{tenantId}`)

- [ ] **Step 1: constantes de caminho**

No fim das constantes de caminho de `src/lib/firebase.js`, acrescente:

```js
// Rotinas dos consultores (spec docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md).
export const ROUTINE_MODELS_PATH = 'stronix_rotina_modelos';
export const ROUTINE_VERSIONS_PATH = 'stronix_rotina_versoes';
export const ROUTINE_MARKS_PATH = 'stronix_rotina_marcas';
```

- [ ] **Step 2: regras das três coleções**

Em `firestore.rules`, logo depois do fechamento do bloco de `stronix_aulas` (a linha `    }` com 4 espaços), acrescente. Os blocos fecham com `    }` de 4 espaços, porque o `professorRules.test.js` corta os blocos por esse texto.

```
    // Rotinas dos consultores (spec
    // docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md).
    // Modelo e versão do dia: lê quem é da academia, grava só o gestor, como os
    // catálogos. A versão é o histórico da rotina: não se apaga.
    match /artifacts/{appId}/public/data/stronix_rotina_modelos/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow write: if isAdmin(appId) && inTenant(appId) && tenantActive(appId);
    }

    match /artifacts/{appId}/public/data/stronix_rotina_versoes/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create, update: if isAdmin(appId) && inTenant(appId) && tenantActive(appId);
      allow delete: if false;
    }

    // O check da rotina. Só o próprio consultor cria, no id
    // `{consultantId}_{date}_{taskId}`, com a hora do servidor e a observação
    // vazia. O get() confere que o cadastro de consultantId é de quem grava:
    // sem ele, alguém criaria o check de um colega com o próprio uid, o furo
    // descrito no comentário do stronix_daily_goal_history. Depois do check, só
    // a observação muda, e só o dono desfaz, até 24 horas depois (a tela só
    // oferece desfazer no mesmo dia). O professor não tem rotina.
    match /artifacts/{appId}/public/data/stronix_rotina_marcas/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId)
        && request.resource.data.consultantAuthUid == request.auth.uid
        && get(/databases/$(database)/documents/artifacts/$(appId)/public/data/stronix_users/$(request.resource.data.consultantId)).data.authUid == request.auth.uid
        && id == request.resource.data.consultantId + '_' + request.resource.data.date + '_' + request.resource.data.taskId
        && request.resource.data.doneAt == request.time
        && request.resource.data.note == ''
        && !isProfessor(appId);
      allow update: if inTenant(appId) && tenantActive(appId)
        && resource.data.consultantAuthUid == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['note'])
        && request.resource.data.note is string
        && request.resource.data.note.size() <= 140;
      allow delete: if inTenant(appId) && tenantActive(appId)
        && resource.data.consultantAuthUid == request.auth.uid
        && request.time < resource.data.doneAt + duration.value(24, 'h');
    }
```

- [ ] **Step 3: os testes que leem as regras continuam verdes**

Run: `npx vitest run src/lib/__tests__/professorRules.test.js src/lib/__tests__/modules.test.js`
Expected: PASS (as coleções novas não estão na lista que esses testes cobram, e nenhuma lista termina em `'professor']`).

- [ ] **Step 4: validar a sintaxe das regras**

Se o Firebase MCP estiver disponível, chame `firebase_validate_security_rules` com o conteúdo de `firestore.rules`. Não publique nada: a publicação é na Task 11, com o ok do Johnny.
Expected: nenhuma mensagem de erro de sintaxe.

- [ ] **Step 5: commit**

```bash
git add src/lib/firebase.js firestore.rules
git commit -m "feat: coleções e regras das rotinas dos consultores"
```

---

### Task 2: a regra do dia (`src/lib/rotinas.js`)

**Files:**
- Create: `src/lib/rotinas.js`
- Test: `src/lib/__tests__/rotinas.test.js`
- Modify: `src/lib/__tests__/acessoSweep.test.js` (lista `LISTAS_DE_QUEM_VENDE`)

- [ ] **Step 1: escrever os testes**

Crie `src/lib/__tests__/rotinas.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  ALL_DAYS, MAX_TASKS_PER_MODEL, copyName, daysText, followerChanges, markDoneAt, markIdOf, minutesOf, modelDocs,
  modelNameProblem, modelOfUser, normalizeTask, removeTask, routineDayKey, routineParticipants, spanText,
  stateText, taskProblems, taskRunsOn, taskStateAt, tasksForDay, upsertTask,
} from '../rotinas.js';

// 06/10/2026 é terça (getDay 2); 10/10/2026 é sábado.
const at = (hhmm, day = 6) => { const [h, m] = hhmm.split(':').map(Number); return new Date(2026, 9, day, h, m); };
const task = (over = {}) => ({ id: 't1', title: 'Conferir a limpeza', how: '', days: ALL_DAYS, time: '10:30', active: true, ...over });
const SEG_A_SEX = [1, 2, 3, 4, 5];

describe('a tarefa do dia', () => {
  it('"todos os dias de trabalho" segue os dias da Meta da academia', () => {
    expect(taskRunsOn(task(), at('09:00'), SEG_A_SEX)).toBe(true);
    expect(taskRunsOn(task(), at('09:00', 10), SEG_A_SEX)).toBe(false);
    expect(taskRunsOn(task(), at('09:00', 10), [6])).toBe(true);
  });

  it('dias escolhidos valem por si, mesmo fora dos dias da Meta', () => {
    expect(taskRunsOn(task({ days: [1, 2] }), at('09:00'), SEG_A_SEX)).toBe(true);
    expect(taskRunsOn(task({ days: [4] }), at('09:00'), SEG_A_SEX)).toBe(false);
    expect(taskRunsOn(task({ days: [6] }), at('09:00', 10), SEG_A_SEX)).toBe(true);
  });

  it('tarefa pausada não vale', () => {
    expect(taskRunsOn(task({ active: false }), at('09:00'), SEG_A_SEX)).toBe(false);
  });

  it('as tarefas do dia saem em ordem de horário, as sem horário no fim', () => {
    const model = { tasks: [task({ id: 'a', time: null }), task({ id: 'b', time: '11:00' }), task({ id: 'c', time: '08:00' }), task({ id: 'd', days: [4] })] };
    expect(tasksForDay(model, at('09:00'), SEG_A_SEX).map((t) => t.id)).toEqual(['c', 'b', 'a']);
    expect(tasksForDay(null, at('09:00'), SEG_A_SEX)).toEqual([]);
  });
});

describe('o estado da tarefa', () => {
  it('com horário: mais tarde, agora até 30 minutos depois, e atrasada', () => {
    expect(taskStateAt(task(), null, at('10:00'))).toBe('later');
    expect(taskStateAt(task(), null, at('10:30'))).toBe('now');
    expect(taskStateAt(task(), null, at('11:00'))).toBe('now');
    expect(taskStateAt(task(), null, at('11:01'))).toBe('late');
  });

  it('feita até 30 minutos depois do horário é feita; depois disso, feita depois do horário', () => {
    expect(taskStateAt(task(), at('09:00'), at('12:00'))).toBe('done');
    expect(taskStateAt(task(), at('11:00'), at('12:00'))).toBe('done');
    expect(taskStateAt(task(), at('11:01'), at('12:00'))).toBe('doneLate');
  });

  it('sem horário: vale até o fim do dia, e feita é feita', () => {
    expect(taskStateAt(task({ time: null }), null, at('23:50'))).toBe('open');
    expect(taskStateAt(task({ time: null }), at('23:50'), at('23:55'))).toBe('done');
  });

  it('os textos do cartão', () => {
    expect(stateText(task(), 'late', null, at('11:05'))).toBe('Era às 10:30, atrasada há 35 min');
    expect(stateText(task({ time: '18:00' }), 'later', null, at('11:05'))).toBe('Em 6h 55min');
    expect(stateText(task({ time: '12:00' }), 'later', null, at('11:00'))).toBe('Em 1h');
    expect(stateText(task(), 'now', null, at('10:40'))).toBe('É agora');
    expect(stateText(task(), 'done', at('08:06'), at('11:05'))).toBe('Feita às 08:06');
    expect(stateText(task(), 'doneLate', at('10:12'), at('11:05'))).toBe('Feita às 10:12, depois do horário');
    expect(stateText(task({ time: null }), 'open', null, at('11:05'))).toBe('Até o fim do dia');
    expect(stateText(task({ time: null, days: [1, 2] }), 'open', null, at('11:05'))).toBe('Segundas e terças · até o fim do dia');
  });
});

describe('textos do modelo', () => {
  it('os dias da semana', () => {
    expect(daysText(ALL_DAYS)).toBe('Todos os dias de trabalho');
    expect(daysText([5, 1, 2, 3, 4])).toBe('Segunda a sexta');
    expect(daysText([2, 4])).toBe('Terças e quintas');
    expect(daysText([6, 0])).toBe('Sábados e domingos');
    expect(daysText([1, 3, 5])).toBe('Segundas, quartas e sextas');
  });

  it('o horário do modelo', () => {
    const model = { tasks: [task({ time: '07:30' }), task({ time: '12:30' }), task({ time: null }), task({ time: '09:00', active: false })] };
    expect(spanText(model)).toBe('07:30 às 12:30 · 1 sem horário');
    expect(spanText({ tasks: [task({ time: '18:00' })] })).toBe('às 18:00');
    expect(spanText({ tasks: [] })).toBe('');
  });

  it('nome de cópia sem repetir', () => {
    expect(copyName('Consultor da manhã', [])).toBe('Cópia de Consultor da manhã');
    expect(copyName('Consultor da manhã', [{ name: 'Cópia de Consultor da manhã' }])).toBe('Cópia de Consultor da manhã (2)');
    expect(copyName('Um nome bem comprido que passa do limite', []).length).toBeLessThanOrEqual(40);
  });
});

describe('validação', () => {
  const models = [{ id: 'm1', name: 'Consultor da manhã' }];

  it('nome do modelo', () => {
    expect(modelNameProblem('  ', models)).toBe('Escreva o nome do modelo.');
    expect(modelNameProblem('x'.repeat(41), models)).toBe('O nome pode ter até 40 caracteres.');
    expect(modelNameProblem(' consultor DA manhã ', models)).toBe('Já existe um modelo com esse nome.');
    expect(modelNameProblem('Consultor da manhã', models, 'm1')).toBe(null);
    expect(modelNameProblem('Consultor da tarde', models)).toBe(null);
  });

  it('tarefa', () => {
    expect(taskProblems({ title: '', how: '', days: ALL_DAYS, time: '09:00' })).toEqual({ title: 'Escreva o nome da tarefa.' });
    expect(taskProblems({ title: 'Ok', how: '', days: [], time: null })).toEqual({ days: 'Escolha pelo menos um dia.' });
    expect(taskProblems({ title: 'Ok', how: '', days: ALL_DAYS, time: '25:00' })).toEqual({ time: 'Escolha o horário.' });
    expect(taskProblems({ title: 'Ok', how: 'x'.repeat(241), days: ALL_DAYS, time: null })).toEqual({ how: 'Até 240 caracteres.' });
    expect(taskProblems({ title: 'Ok', how: '', days: [2], time: '09:00' })).toEqual({});
  });

  it('a tarefa gravada sai limpa, com os dias em ordem', () => {
    expect(normalizeTask({ title: ' Postar o story ', how: ' ', days: [5, 1], time: '11:00' }, 't9'))
      .toEqual({ id: 't9', title: 'Postar o story', how: '', days: [1, 5], time: '11:00', active: true });
    expect(normalizeTask({ title: 'Ok', how: '', days: ALL_DAYS, time: null, active: false }, 't1').active).toBe(false);
  });

  it('o limite de tarefas é 30', () => {
    expect(MAX_TASKS_PER_MODEL).toBe(30);
  });

  it('minutos do horário', () => {
    expect(minutesOf('07:30')).toBe(450);
    expect(minutesOf('24:00')).toBe(null);
    expect(minutesOf(null)).toBe(null);
  });
});

describe('lista de tarefas', () => {
  it('troca a tarefa pelo id ou acrescenta no fim, e tira pelo id', () => {
    const list = [task({ id: 'a' }), task({ id: 'b' })];
    expect(upsertTask(list, task({ id: 'b', title: 'Nova' })).map((t) => t.title)).toEqual(['Conferir a limpeza', 'Nova']);
    expect(upsertTask(list, task({ id: 'c' })).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(removeTask(list, 'a').map((t) => t.id)).toEqual(['b']);
  });
});

describe('quem segue', () => {
  const models = [
    { id: 'm1', name: 'Manhã', followerIds: ['carla', 'diego'] },
    { id: 'm2', name: 'Tarde', followerIds: ['ana'] },
  ];

  it('cada pessoa segue um modelo só', () => {
    expect(modelOfUser(models, 'ana').id).toBe('m2');
    expect(modelOfUser(models, 'bruno')).toBe(null);
  });

  it('pôr alguém num modelo tira a pessoa do modelo anterior', () => {
    const changes = followerChanges(models, 'm1', ['ana']);
    expect(Object.fromEntries(changes)).toEqual({ m2: [], m1: ['carla', 'diego', 'ana'] });
  });

  it('pôr de novo quem já está não muda a lista, e tirar funciona', () => {
    expect(Object.fromEntries(followerChanges(models, 'm1', ['carla']))).toEqual({ m1: ['carla', 'diego'] });
    expect(Object.fromEntries(followerChanges(models, 'm1', [], ['diego']))).toEqual({ m1: ['carla'] });
  });

  it('só consultor ativo, com nome, segue modelo', () => {
    const users = [
      { id: 'carla', name: 'Carla', role: 'consultant' },
      { id: 'g', name: 'Gestora', role: 'admin' },
      { id: 'p', name: 'Prof', role: 'professor', professorId: 'x' },
      { id: 'saiu', name: 'Saiu', role: 'consultant', active: false },
      { id: 'semnome', role: 'consultant' },
    ];
    expect(routineParticipants(users).map((u) => u.id)).toEqual(['carla']);
  });
});

describe('o check só conta no próprio dia', () => {
  it('a hora do check precisa cair no dia do check', () => {
    expect(markDoneAt({ doneAt: at('08:06') }, '2026-10-06')).toEqual(at('08:06'));
    expect(markDoneAt({ doneAt: at('23:50', 5) }, '2026-10-06')).toBe(null);
    expect(markDoneAt({ doneAt: null }, '2026-10-06')).toBe(null);
    expect(markDoneAt(null, '2026-10-06')).toBe(null);
  });
});

describe('o que é gravado', () => {
  it('o id do check', () => {
    expect(markIdOf('carla', '2026-10-06', 't4')).toBe('carla_2026-10-06_t4');
    expect(routineDayKey(at('23:59'))).toBe('2026-10-06');
  });

  it('o modelo e a versão do dia', () => {
    const tasks = [task()];
    expect(modelDocs({ modelId: 'm1', name: ' Manhã ', tasks, followerIds: ['carla'], userId: 'g', dateKey: '2026-10-06' })).toEqual({
      model: { name: 'Manhã', tasks, followerIds: ['carla'] },
      version: { id: 'm1_2026-10-06', data: { modelId: 'm1', date: '2026-10-06', name: 'Manhã', tasks, followerIds: ['carla'], deleted: false, savedBy: 'g' } },
    });
  });

  it('o modelo excluído deixa a versão sem ninguém', () => {
    const { version } = modelDocs({ modelId: 'm1', name: 'Manhã', tasks: [], followerIds: ['carla'], deleted: true, userId: 'g', dateKey: '2026-10-06' });
    expect(version.data).toMatchObject({ deleted: true, followerIds: [] });
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinas.test.js`
Expected: FAIL, "Failed to resolve import ../rotinas.js".

- [ ] **Step 3: escrever `src/lib/rotinas.js`**

```js
// Rotinas dos consultores: a regra única do dia, usada pelo cartão da Meta
// diária, pela tela Rotinas e, na parte 3, pelo histórico do Operacional. Pura
// e sem import de tela (nada de lucide-react), para a api/ poder usar.
// Spec: docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md.
import { isGestor, isSeller } from './acesso.js';
import { dayKeyOf } from './operacional/month.js';

// A tarefa com horário fica "agora" do horário até essa folga depois, e
// atrasada a partir daí. O check dado depois da folga é "depois do horário".
export const ROUTINE_ON_TIME_MINUTES = 30;
export const MODEL_NAME_MAX = 40;
export const TASK_TITLE_MAX = 80;
export const TASK_HOW_MAX = 240;
export const NOTE_MAX = 140;
export const MAX_TASKS_PER_MODEL = 30;
export const ALL_DAYS = 'all';
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// A mesma chave de dia da Meta (dgDateKey): calendário local, AAAA-MM-DD.
export const routineDayKey = (date) => dayKeyOf(date);

// O check só conta quando a hora dele cai no próprio dia do check. As regras
// do Firestore (routineMarkDayOk) deixam uma folga de um dia na virada da
// meia-noite, e o consultor grava o próprio check: a leitura fecha a folga.
export function markDoneAt(mark, dateKey) {
  const doneAt = mark?.doneAt instanceof Date ? mark.doneAt : null;
  return doneAt && routineDayKey(doneAt) === dateKey ? doneAt : null;
}
export const markIdOf = (consultantId, dateKey, taskId) => `${consultantId}_${dateKey}_${taskId}`;

const pad = (n) => String(n).padStart(2, '0');
const clean = (s) => (typeof s === 'string' ? s.trim() : '');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const joinPt = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`);
const minutesOfDate = (d) => d.getHours() * 60 + d.getMinutes();

export const namesText = (names) => joinPt(names);
export const firstName = (name) => clean(name).split(/\s+/)[0] || '';

export function minutesOf(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
export const hhmmOf = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const byTime = (a, b) => (minutesOf(a.time) ?? 9999) - (minutesOf(b.time) ?? 9999);

// Quem pode seguir modelo: consultor ativo, com nome. Gestor e professor não
// seguem. É o isMetaParticipant de acesso.js escrito pelo isSeller, que é o
// que o acessoSweep.test.js cobra das listas de pessoas.
export const routineParticipants = (users) =>
  (users || []).filter((u) => u?.id && u.name && u.active !== false && isSeller(u) && !isGestor(u));

export function taskRunsOn(task, date, metaWeekdays) {
  if (!task || task.active === false) return false;
  const weekday = date.getDay();
  if (task.days === ALL_DAYS) return (metaWeekdays || []).includes(weekday);
  return Array.isArray(task.days) && task.days.includes(weekday);
}

export const tasksForDay = (model, date, metaWeekdays) =>
  (model?.tasks || []).filter((t) => taskRunsOn(t, date, metaWeekdays)).sort(byTime);

// Estado num instante: 'done', 'doneLate', 'now', 'late', 'later' ou 'open'
// (sem horário e sem check). doneAt é a hora do check (Date) ou null.
export function taskStateAt(task, doneAt, now) {
  const t = minutesOf(task?.time);
  if (doneAt instanceof Date) {
    return t != null && minutesOfDate(doneAt) > t + ROUTINE_ON_TIME_MINUTES ? 'doneLate' : 'done';
  }
  if (t == null) return 'open';
  const n = minutesOfDate(now);
  if (n < t) return 'later';
  if (n <= t + ROUTINE_ON_TIME_MINUTES) return 'now';
  return 'late';
}

export const durationText = (minutes) =>
  (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`);

export function daysText(days) {
  if (days === ALL_DAYS) return 'Todos os dias de trabalho';
  const sorted = WEEK_ORDER.filter((d) => (days || []).includes(d));
  if (!sorted.length) return '';
  const idx = sorted.map((d) => WEEK_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (sorted.length >= 3 && contiguous) return `${cap(DAY_LONG[sorted[0]])} a ${DAY_LONG[sorted[sorted.length - 1]]}`;
  return cap(joinPt(sorted.map((d) => `${DAY_LONG[d]}s`)));
}

export function stateText(task, state, doneAt, now) {
  const t = minutesOf(task?.time);
  if (state === 'done') return `Feita às ${hhmmOf(minutesOfDate(doneAt))}`;
  if (state === 'doneLate') return `Feita às ${hhmmOf(minutesOfDate(doneAt))}, depois do horário`;
  if (state === 'now') return 'É agora';
  if (state === 'late') return `Era às ${task.time}, atrasada há ${durationText(minutesOfDate(now) - t)}`;
  if (state === 'later') return `Em ${durationText(t - minutesOfDate(now))}`;
  return task?.days === ALL_DAYS ? 'Até o fim do dia' : `${daysText(task?.days)} · até o fim do dia`;
}

export function spanText(model) {
  const active = (model?.tasks || []).filter((t) => t.active !== false);
  const timed = active.filter((t) => minutesOf(t.time) != null).sort(byTime);
  const free = active.length - timed.length;
  const parts = [];
  if (timed.length === 1) parts.push(`às ${timed[0].time}`);
  if (timed.length > 1) parts.push(`${timed[0].time} às ${timed[timed.length - 1].time}`);
  if (free) parts.push(`${free} sem horário`);
  return parts.join(' · ');
}

export function copyName(name, models) {
  const taken = new Set((models || []).map((m) => clean(m.name).toLowerCase()));
  const base = `Cópia de ${clean(name)}`;
  for (let n = 1; n < 100; n += 1) {
    const suffix = n === 1 ? '' : ` (${n})`;
    const candidate = `${base.slice(0, MODEL_NAME_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base.slice(0, MODEL_NAME_MAX);
}

export function modelNameProblem(name, models, ownId = null) {
  const value = clean(name);
  if (!value) return 'Escreva o nome do modelo.';
  if (value.length > MODEL_NAME_MAX) return `O nome pode ter até ${MODEL_NAME_MAX} caracteres.`;
  const repeated = (models || []).some((m) => m.id !== ownId && clean(m.name).toLowerCase() === value.toLowerCase());
  return repeated ? 'Já existe um modelo com esse nome.' : null;
}

// input: { title, how, days ('all' ou lista), time ('HH:MM' ou null), active }
export function taskProblems(input) {
  const errors = {};
  const title = clean(input.title);
  if (!title) errors.title = 'Escreva o nome da tarefa.';
  else if (title.length > TASK_TITLE_MAX) errors.title = `O nome pode ter até ${TASK_TITLE_MAX} caracteres.`;
  if (input.days !== ALL_DAYS && !(Array.isArray(input.days) && input.days.length)) errors.days = 'Escolha pelo menos um dia.';
  if (input.time !== null && minutesOf(input.time) == null) errors.time = 'Escolha o horário.';
  if (clean(input.how).length > TASK_HOW_MAX) errors.how = `Até ${TASK_HOW_MAX} caracteres.`;
  return errors;
}

export const normalizeTask = (input, id) => ({
  id,
  title: clean(input.title),
  how: clean(input.how),
  days: input.days === ALL_DAYS ? ALL_DAYS : WEEK_ORDER.filter((d) => input.days.includes(d)),
  time: input.time === null ? null : input.time,
  active: input.active !== false,
});

export const newTaskId = () => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);

export function upsertTask(tasks, next) {
  const list = tasks || [];
  const i = list.findIndex((t) => t.id === next.id);
  return i >= 0 ? list.map((t, j) => (j === i ? next : t)) : [...list, next];
}
export const removeTask = (tasks, taskId) => (tasks || []).filter((t) => t.id !== taskId);

export const modelOfUser = (models, userId) =>
  (models || []).find((m) => (m.followerIds || []).includes(userId)) || null;

// Pôr pessoas num modelo tira cada uma do modelo em que estava: cada consultor
// segue um modelo só. Devolve um Map modeloId -> followerIds novo, com o modelo
// de destino sempre presente.
export function followerChanges(models, targetModelId, addIds = [], removeIds = []) {
  const changes = new Map();
  const current = (m) => changes.get(m.id) ?? (m.followerIds || []);
  for (const pid of addIds) {
    for (const m of models || []) {
      if (m.id !== targetModelId && current(m).includes(pid)) changes.set(m.id, current(m).filter((x) => x !== pid));
    }
  }
  const target = (models || []).find((m) => m.id === targetModelId);
  if (target) {
    let ids = current(target).filter((x) => !removeIds.includes(x));
    for (const pid of addIds) if (!ids.includes(pid)) ids = [...ids, pid];
    changes.set(target.id, ids);
  }
  return changes;
}

// O modelo e a versão do dia, sem as datas do servidor (quem grava acrescenta).
export function modelDocs({ modelId, name, tasks, followerIds, deleted = false, userId, dateKey }) {
  const model = { name: clean(name), tasks: tasks || [], followerIds: deleted ? [] : (followerIds || []) };
  return {
    model,
    version: { id: `${modelId}_${dateKey}`, data: { modelId, date: dateKey, ...model, deleted, savedBy: userId } },
  };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rotinas.test.js`
Expected: PASS.

- [ ] **Step 5: a lista de pessoas entra na varredura**

Em `src/lib/__tests__/acessoSweep.test.js`, no fim do array `LISTAS_DE_QUEM_VENDE`, acrescente a linha:

```js
  // Rotinas: quem pode seguir modelo (routineParticipants).
  'lib/rotinas.js',
```

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js`
Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add src/lib/rotinas.js src/lib/__tests__/rotinas.test.js src/lib/__tests__/acessoSweep.test.js
git commit -m "feat: regra do dia das rotinas dos consultores"
```

---

### Task 3: as gravações (`src/lib/rotinasWrites.js`)

**Files:**
- Create: `src/lib/rotinasWrites.js`
- Test: `src/lib/__tests__/rotinasWrites.test.js`

- [ ] **Step 1: escrever os testes**

Crie `src/lib/__tests__/rotinasWrites.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ docs: new Map(), ops: [], seq: 0 }));

vi.mock('../firebase.js', () => ({
  appId: 'acad',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
}));

vi.mock('firebase/firestore', () => {
  const path = (...p) => p.join('/');
  return {
    collection: (_db, ...p) => ({ kind: 'col', path: path(...p) }),
    doc: (a, ...p) => {
      if (a?.kind === 'col' && p.length === 0) { s.seq += 1; return { path: `${a.path}/novo-${s.seq}`, id: `novo-${s.seq}` }; }
      return { path: path(...p), id: p[p.length - 1] };
    },
    serverTimestamp: () => 'agora',
    setDoc: vi.fn(async (ref, data) => { s.ops.push({ op: 'set', path: ref.path, data }); }),
    updateDoc: vi.fn(async (ref, data) => { s.ops.push({ op: 'update', path: ref.path, data }); }),
    deleteDoc: vi.fn(async (ref) => { s.ops.push({ op: 'delete', path: ref.path }); }),
    runTransaction: vi.fn(async (_db, fn) => fn({
      get: async (ref) => {
        const d = s.docs.get(ref.path);
        return { id: ref.id, exists: () => d !== undefined, data: () => ({ ...d }) };
      },
      set: (ref, data, opts) => { s.ops.push({ op: 'set', path: ref.path, data, opts }); },
      delete: (ref) => { s.ops.push({ op: 'delete', path: ref.path }); },
    })),
  };
});

const { createModel, deleteModel, duplicateModel, markDone, saveMarkNote, setPersonModel, undoMark, updateModel } = await import('../rotinasWrites.js');

const M = 'artifacts/acad/public/data/stronix_rotina_modelos';
const V = 'artifacts/acad/public/data/stronix_rotina_versoes';
const K = 'artifacts/acad/public/data/stronix_rotina_marcas';
const NOW = new Date(2026, 9, 6, 11, 5);
const gestor = { id: 'g1', authUid: 'g1' };
const carla = { id: 'carla', authUid: 'uid-carla' };
const TASK = { id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true };
const op = (kind, p) => s.ops.find((o) => o.op === kind && o.path === p);

beforeEach(() => {
  s.docs.clear(); s.ops.length = 0; s.seq = 0;
  s.docs.set(`${M}/m1`, { name: 'Manhã', tasks: [TASK], followerIds: ['carla', 'diego'] });
  s.docs.set(`${M}/m2`, { name: 'Tarde', tasks: [], followerIds: ['ana'] });
});
const models = () => [...s.docs.entries()].map(([k, d]) => ({ id: k.split('/').pop(), ...d }));

describe('modelos', () => {
  it('criar grava o modelo e a versão do dia, e tira quem segue do modelo anterior', async () => {
    const id = await createModel({ db: {}, appUser: gestor, models: models(), name: ' Noite ', followerIds: ['ana'], now: NOW });
    expect(id).toBe('novo-1');
    expect(op('set', `${M}/novo-1`).data).toMatchObject({ name: 'Noite', tasks: [], followerIds: ['ana'], createdAt: 'agora', createdBy: 'g1', updatedBy: 'g1' });
    expect(op('set', `${V}/novo-1_2026-10-06`).data).toMatchObject({ modelId: 'novo-1', date: '2026-10-06', followerIds: ['ana'], deleted: false, savedBy: 'g1', savedAt: 'agora' });
    expect(op('set', `${M}/m2`).data).toMatchObject({ followerIds: [] });
    expect(op('set', `${V}/m2_2026-10-06`).data).toMatchObject({ followerIds: [] });
    expect(op('set', `${M}/m1`)).toBeUndefined();
  });

  it('criar a partir de uma cópia copia as tarefas com ids novos', async () => {
    await createModel({ db: {}, appUser: gestor, models: models(), name: 'Manhã 2', copyFrom: 'm1', now: NOW });
    const tasks = op('set', `${M}/novo-1`).data.tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: 'Conferir a agenda', time: '08:00' });
    expect(tasks[0].id).not.toBe('t1');
  });

  it('duplicar dá o nome "Cópia de" e ninguém segue', async () => {
    const id = await duplicateModel({ db: {}, appUser: gestor, models: models(), source: { id: 'm1', name: 'Manhã' }, now: NOW });
    expect(op('set', `${M}/${id}`).data).toMatchObject({ name: 'Cópia de Manhã', followerIds: [] });
  });

  it('editar grava o modelo e a versão do dia com o que a função devolve', async () => {
    await updateModel({ db: {}, appUser: gestor, modelId: 'm1', edit: (m) => ({ name: `${m.name} cedo` }), now: NOW });
    expect(op('set', `${M}/m1`).data).toMatchObject({ name: 'Manhã cedo', tasks: [TASK], followerIds: ['carla', 'diego'], updatedBy: 'g1' });
    expect(op('set', `${M}/m1`).data.createdAt).toBeUndefined();
    expect(op('set', `${M}/m1`).opts).toEqual({ merge: true });
    expect(op('set', `${V}/m1_2026-10-06`).data).toMatchObject({ name: 'Manhã cedo', followerIds: ['carla', 'diego'] });
  });

  it('editar um modelo que sumiu falha', async () => {
    await expect(updateModel({ db: {}, appUser: gestor, modelId: 'mx', edit: () => ({}), now: NOW })).rejects.toThrow('modelo-sumiu');
    expect(s.ops).toEqual([]);
  });

  it('pôr a pessoa num modelo tira ela do outro; "sem modelo" só tira', async () => {
    await setPersonModel({ db: {}, appUser: gestor, models: models(), userId: 'ana', modelId: 'm1', now: NOW });
    expect(op('set', `${M}/m1`).data.followerIds).toEqual(['carla', 'diego', 'ana']);
    expect(op('set', `${M}/m2`).data.followerIds).toEqual([]);
    s.ops.length = 0;
    await setPersonModel({ db: {}, appUser: gestor, models: models(), userId: 'carla', modelId: null, now: NOW });
    expect(op('set', `${M}/m1`).data.followerIds).toEqual(['diego']);
    expect(op('set', `${V}/m1_2026-10-06`).data.followerIds).toEqual(['diego']);
    expect(op('set', `${M}/m2`)).toBeUndefined();
  });

  it('pôr a pessoa num modelo que sumiu falha e não grava nada', async () => {
    await expect(setPersonModel({ db: {}, appUser: gestor, models: [...models(), { id: 'mx' }], userId: 'ana', modelId: 'mx', now: NOW })).rejects.toThrow('modelo-sumiu');
    expect(s.ops).toEqual([]);
  });

  it('excluir apaga o modelo e grava a versão excluída, sem ninguém', async () => {
    await deleteModel({ db: {}, appUser: gestor, modelId: 'm1', now: NOW });
    expect(op('delete', `${M}/m1`)).toBeDefined();
    expect(op('set', `${V}/m1_2026-10-06`).data).toMatchObject({ deleted: true, followerIds: [], name: 'Manhã' });
  });
});

describe('check', () => {
  it('marcar grava o check no id fixo, com a hora do servidor e a observação vazia', async () => {
    const id = await markDone({ db: {}, appUser: carla, model: { id: 'm1' }, task: TASK, now: NOW });
    expect(id).toBe('carla_2026-10-06_t1');
    expect(op('set', `${K}/carla_2026-10-06_t1`).data).toEqual({
      consultantId: 'carla', consultantAuthUid: 'uid-carla', date: '2026-10-06', modelId: 'm1',
      taskId: 't1', taskTitle: 'Conferir a agenda', taskTime: '08:00', doneAt: 'agora', note: '',
    });
  });

  it('a observação grava só o note, aparada e no limite', async () => {
    await saveMarkNote({ db: {}, markId: 'carla_2026-10-06_t1', note: `  ${'x'.repeat(150)}  ` });
    expect(op('update', `${K}/carla_2026-10-06_t1`).data).toEqual({ note: 'x'.repeat(140) });
  });

  it('desfazer apaga o check', async () => {
    await undoMark({ db: {}, markId: 'carla_2026-10-06_t1' });
    expect(op('delete', `${K}/carla_2026-10-06_t1`)).toBeDefined();
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasWrites.test.js`
Expected: FAIL, "Failed to resolve import ../rotinasWrites.js".

- [ ] **Step 3: escrever `src/lib/rotinasWrites.js`**

```js
// Gravações das rotinas dos consultores. O QUE gravar sai de rotinas.js
// (puro); aqui fica o COMO. Toda gravação de modelo passa por commitModels:
// lê os modelos numa transação, grava o modelo e a versão do dia juntos, e
// assim duas abas do gestor não deixam ninguém em dois modelos.
import { collection, deleteDoc, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH, ROUTINE_MODELS_PATH, ROUTINE_VERSIONS_PATH } from './firebase.js';
import { NOTE_MAX, copyName, followerChanges, markIdOf, modelDocs, newTaskId, routineDayKey } from './rotinas.js';

const modelsCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
const modelRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH, id);
const versionRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_VERSIONS_PATH, id);
const markRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH, id);

const pick = (m) => ({ name: m.name, tasks: m.tasks || [], followerIds: m.followerIds || [] });

// change(fresh) recebe os modelos lidos na transação e devolve
// { [modelId]: { name, tasks, followerIds, deleted?, isNew? } }.
async function commitModels(db, appUser, modelIds, change, now) {
  const dateKey = routineDayKey(now);
  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(modelIds.map((id) => tx.get(modelRef(db, id))));
    const fresh = snaps.filter((snap) => snap.exists()).map((snap) => ({ id: snap.id, ...snap.data() }));
    const next = change(fresh);
    for (const [id, m] of Object.entries(next)) {
      const { model, version } = modelDocs({ modelId: id, ...m, userId: appUser.id, dateKey });
      if (m.deleted) {
        tx.delete(modelRef(db, id));
      } else {
        const stamp = { updatedAt: serverTimestamp(), updatedBy: appUser.id };
        const created = m.isNew ? { createdAt: serverTimestamp(), createdBy: appUser.id } : {};
        tx.set(modelRef(db, id), { ...model, ...stamp, ...created }, { merge: true });
      }
      tx.set(versionRef(db, version.id), { ...version.data, savedAt: serverTimestamp() });
    }
  });
}

export async function createModel({ db, appUser, models, name, copyFrom = null, followerIds = [], now = new Date() }) {
  const id = doc(modelsCol(db)).id;
  await commitModels(db, appUser, (models || []).map((m) => m.id), (fresh) => {
    const source = copyFrom ? fresh.find((m) => m.id === copyFrom) : null;
    const tasks = source ? (source.tasks || []).map((t) => ({ ...t, id: newTaskId() })) : [];
    const all = [...fresh, { id, name, tasks, followerIds: [] }];
    const out = {};
    for (const [mid, ids] of followerChanges(all, id, followerIds)) {
      const m = all.find((x) => x.id === mid);
      out[mid] = { ...pick(m), followerIds: ids, isNew: mid === id };
    }
    return out;
  }, now);
  return id;
}

export const duplicateModel = ({ db, appUser, models, source, now = new Date() }) =>
  createModel({ db, appUser, models, name: copyName(source.name, models), copyFrom: source.id, now });

// edit(modeloAtual) devolve só o que muda: { name } ou { tasks }.
export async function updateModel({ db, appUser, modelId, edit, now = new Date() }) {
  await commitModels(db, appUser, [modelId], (fresh) => {
    const m = fresh.find((x) => x.id === modelId);
    if (!m) throw new Error('modelo-sumiu');
    return { [modelId]: { ...pick(m), ...edit(m) } };
  }, now);
}

// modelId null tira a pessoa do modelo que ela segue ("Sem modelo").
export async function setPersonModel({ db, appUser, models, userId, modelId, now = new Date() }) {
  await commitModels(db, appUser, (models || []).map((m) => m.id), (fresh) => {
    if (modelId === null) {
      const from = fresh.find((m) => (m.followerIds || []).includes(userId));
      return from ? { [from.id]: { ...pick(from), followerIds: from.followerIds.filter((x) => x !== userId) } } : {};
    }
    if (!fresh.some((m) => m.id === modelId)) throw new Error('modelo-sumiu');
    const out = {};
    for (const [mid, ids] of followerChanges(fresh, modelId, [userId])) {
      out[mid] = { ...pick(fresh.find((x) => x.id === mid)), followerIds: ids };
    }
    return out;
  }, now);
}

export async function deleteModel({ db, appUser, modelId, now = new Date() }) {
  await commitModels(db, appUser, [modelId], (fresh) => {
    const m = fresh.find((x) => x.id === modelId);
    return m ? { [modelId]: { ...pick(m), deleted: true } } : {};
  }, now);
}

// O check do consultor. As regras do Firestore exigem a hora do servidor e a
// observação vazia na criação, e só deixam mudar a observação depois.
export async function markDone({ db, appUser, model, task, now = new Date() }) {
  const dateKey = routineDayKey(now);
  const id = markIdOf(appUser.id, dateKey, task.id);
  await setDoc(markRef(db, id), {
    consultantId: appUser.id,
    consultantAuthUid: appUser.authUid,
    date: dateKey,
    modelId: model.id,
    taskId: task.id,
    taskTitle: task.title,
    taskTime: task.time ?? null,
    doneAt: serverTimestamp(),
    note: '',
  });
  return id;
}

export const saveMarkNote = ({ db, markId, note }) =>
  updateDoc(markRef(db, markId), { note: String(note ?? '').trim().slice(0, NOTE_MAX) });

export const undoMark = ({ db, markId }) => deleteDoc(markRef(db, markId));
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rotinasWrites.test.js`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add src/lib/rotinasWrites.js src/lib/__tests__/rotinasWrites.test.js
git commit -m "feat: gravações das rotinas (modelo com versão do dia e check)"
```

---

### Task 4: as assinaturas

**Files:**
- Create: `src/hooks/useRoutineModels.js`
- Create: `src/hooks/useMyRoutine.js`

As duas seguem o molde do `src/hooks/useDayAgenda.js`: a leitura só existe com `enabled` (que recebe o `listenersActive` do portão de ociosidade) e cai na limpeza do efeito. Os caminhos ficam dentro do efeito, nunca no topo do módulo, porque testes que simulam o `firebase.js` sem as constantes novas importam a `DailyGoalView`.

- [ ] **Step 1: `src/hooks/useRoutineModels.js`**

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, ROUTINE_MODELS_PATH } from '../lib/firebase.js';

// Todos os modelos de rotina da academia (tela Rotinas do gestor). enabled
// recebe o listenersActive: sem ele, uma aba esquecida aberta mantém a
// assinatura a noite toda.
export function useRoutineModels({ db, enabled = true }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !enabled) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        setModels(list);
        setLoading(false);
      },
      (err) => { console.error('useRoutineModels onSnapshot falhou', err); setLoading(false); },
    );
    return () => unsub();
  }, [db, enabled]);

  return { models, loading };
}
```

- [ ] **Step 2: `src/hooks/useMyRoutine.js`**

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH, ROUTINE_MODELS_PATH } from '../lib/firebase.js';

// O modelo que a pessoa segue e os checks dela no dia (cartão da Meta). As
// duas consultas usam só igualdade (array-contains, e consultantId + date),
// que o Firestore resolve sem índice composto. O doneAt sai com
// serverTimestamps 'estimate', para o check aparecer na hora, antes de o
// servidor confirmar.
export function useMyRoutine({ db, enabled = true, userId, dayKey }) {
  const [model, setModel] = useState(null);
  const [marks, setMarks] = useState(() => new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !enabled || !userId) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
    const unsub = onSnapshot(
      query(ref, where('followerIds', 'array-contains', userId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        setModel(list[0] || null);
        setLoading(false);
      },
      (err) => { console.error('useMyRoutine modelo falhou', err); setLoading(false); },
    );
    return () => unsub();
  }, [db, enabled, userId]);

  useEffect(() => {
    if (!db || !enabled || !userId || !dayKey) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH);
    const unsub = onSnapshot(
      query(ref, where('consultantId', '==', userId), where('date', '==', dayKey)),
      (snap) => {
        const next = new Map();
        snap.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          const doneAt = typeof data.doneAt?.toDate === 'function' ? data.doneAt.toDate() : null;
          next.set(data.taskId, { id: d.id, doneAt, note: data.note || '' });
        });
        setMarks(next);
      },
      (err) => { console.error('useMyRoutine checks falhou', err); },
    );
    return () => unsub();
  }, [db, enabled, userId, dayKey]);

  return { model, marks, loading };
}
```

- [ ] **Step 3: lint**

Run: `npx eslint src/hooks/useRoutineModels.js src/hooks/useMyRoutine.js`
Expected: sem erros.

- [ ] **Step 4: commit**

```bash
git add src/hooks/useRoutineModels.js src/hooks/useMyRoutine.js
git commit -m "feat: assinaturas dos modelos e da rotina do consultor"
```

---

### Task 5: o cartão "Rotina de hoje" na Meta diária

**Files:**
- Create: `src/components/dailygoal/RoutineCard.jsx`
- Test: `src/lib/__tests__/routineCard.test.js`
- Modify: `src/views/DailyGoalView.jsx` (import da linha 8 e lateral, depois do `<NextUp ... />`)
- Modify: `src/lib/__tests__/metaLinks.test.js` (o `vi.mock('../firebase.js', ...)`)

Antes de escrever, abra `docs/superpowers/specs/mockups/2026-10-06-rotina-na-meta-diaria.html` e veja a opção A, inclusive no tema escuro.

- [ ] **Step 1: escrever o teste**

Crie `src/lib/__tests__/routineCard.test.js`:

```js
// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const routine = vi.hoisted(() => ({ value: null }));
vi.mock('../../hooks/useMyRoutine.js', () => ({ useMyRoutine: () => routine.value }));
vi.mock('../rotinasWrites.js', () => ({
  markDone: vi.fn(async () => 'carla_2026-10-06_t4'),
  saveMarkNote: vi.fn(async () => {}),
  undoMark: vi.fn(async () => {}),
}));

const { markDone, saveMarkNote, undoMark } = await import('../rotinasWrites.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { RoutineCard } = await import('../../components/dailygoal/RoutineCard.jsx');

const MODEL = {
  id: 'm1', name: 'Consultor da manhã', followerIds: ['carla'],
  tasks: [
    { id: 't1', title: 'Conferir a agenda do dia na recepção', how: '', days: 'all', time: '08:00', active: true },
    { id: 't3', title: 'Conferir a limpeza', how: '', days: 'all', time: '10:30', active: true },
    { id: 't4', title: 'Postar o story da aula das 12h', how: '', days: 'all', time: '11:00', active: true },
    { id: 't6', title: 'Revisar as perdas da semana', how: '', days: [1, 2], time: null, active: true },
    { id: 't7', title: 'Organizar o mural', how: '', days: [5], time: '17:00', active: true },
  ],
};
const NOW = new Date(2026, 9, 6, 11, 5); // terça
const appUser = { id: 'carla', authUid: 'carla', name: 'Carla Souza', role: 'consultant' };
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  routine.value = {
    model: MODEL,
    marks: new Map([['t1', { id: 'carla_2026-10-06_t1', doneAt: new Date(2026, 9, 6, 8, 6), note: '' }]]),
    loading: false,
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async () => {
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(RoutineCard, { db: {}, appUser, enabled: true, now: NOW, metaWeekdays: [1, 2, 3, 4, 5] })));
  });
};
const button = (label) => container.querySelector(`button[aria-label="${label}"]`);
const click = async (el) => { await act(async () => { el.click(); }); };
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('cartão Rotina de hoje', () => {
  it('mostra as tarefas do dia com a contagem e o estado de cada uma', async () => {
    await render();
    const text = container.textContent;
    expect(text).toContain('Rotina de hoje');
    expect(text).toContain('Montada pelo gestor. Não conta na sua meta.');
    expect(text).toContain('1 de 4');
    expect(text).toContain('Feita às 08:06');
    expect(text).toContain('Era às 10:30, atrasada há 35 min');
    expect(text).toContain('É agora');
    expect(text).toContain('Segundas e terças · até o fim do dia');
    expect(text).not.toContain('Organizar o mural');
  });

  it('o toque marca a tarefa e abre a observação, que salva só o texto', async () => {
    await render();
    await click(button('Marcar como feita: Postar o story da aula das 12h'));
    expect(markDone).toHaveBeenCalledWith({ db: {}, appUser, model: MODEL, task: MODEL.tasks[2] });
    const input = container.querySelector('input[placeholder="Observação (opcional)"]');
    expect(input).not.toBeNull();
    await type(input, 'Story postado');
    await click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Salvar'));
    expect(saveMarkNote).toHaveBeenCalledWith({ db: {}, markId: 'carla_2026-10-06_t4', note: 'Story postado' });
    expect(container.querySelector('input[placeholder="Observação (opcional)"]')).toBeNull();
  });

  it('o toque numa tarefa feita desfaz o check', async () => {
    await render();
    await click(button('Desmarcar: Conferir a agenda do dia na recepção'));
    expect(undoMark).toHaveBeenCalledWith({ db: {}, markId: 'carla_2026-10-06_t1' });
  });

  it('a observação salva aparece embaixo da tarefa', async () => {
    routine.value.marks.set('t3', { id: 'carla_2026-10-06_t3', doneAt: new Date(2026, 9, 6, 10, 44), note: 'Faltava papel, já reposto' });
    await render();
    expect(container.textContent).toContain('Faltava papel, já reposto');
  });

  it('se marcar falhar, avisa e não abre a observação', async () => {
    markDone.mockRejectedValueOnce(new Error('permission-denied'));
    await render();
    await click(button('Marcar como feita: Postar o story da aula das 12h'));
    expect(toast.error).toHaveBeenCalledWith('Não deu para marcar a tarefa. Tente de novo.');
    expect(container.querySelector('input[placeholder="Observação (opcional)"]')).toBeNull();
  });

  it('enquanto carrega, ou se a leitura falhou, o cartão não aparece', async () => {
    routine.value = { model: MODEL, marks: new Map(), loading: true, error: false };
    await render();
    expect(container.innerHTML).toBe('');
    routine.value = { model: MODEL, marks: new Map(), loading: false, error: true };
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('sem modelo, ou sem tarefa no dia, o cartão não aparece', async () => {
    routine.value = { model: null, marks: new Map(), loading: false };
    await render();
    expect(container.innerHTML).toBe('');
    routine.value = { model: { ...MODEL, tasks: [MODEL.tasks[4]] }, marks: new Map(), loading: false };
    await render();
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routineCard.test.js`
Expected: FAIL, "Failed to resolve import ../../components/dailygoal/RoutineCard.jsx".

- [ ] **Step 3: escrever `src/components/dailygoal/RoutineCard.jsx`**

```jsx
import { useState } from 'react';
import { Check, ListChecks, MessageSquare, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useMyRoutine } from '../../hooks/useMyRoutine.js';
import { NOTE_MAX, hhmmOf, markDoneAt, minutesOf, routineDayKey, stateText, taskStateAt, tasksForDay } from '../../lib/rotinas.js';
import { markDone, saveMarkNote, undoMark } from '../../lib/rotinasWrites.js';

// Cartão "Rotina de hoje" da Meta diária (spec
// docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md, mockup
// 2026-10-06-rotina-na-meta-diaria.html, opção A). Fica fora da conta da Meta:
// não entra no ProgressHero, nos filtros da lista nem no dia batido.

const DONE = new Set(['done', 'doneLate']);

const CHECK_TONE = {
  done: 'border-emerald-500 bg-emerald-500 text-white',
  doneLate: 'border-emerald-500 bg-emerald-500 text-white',
  late: 'border-rose-400 bg-rose-50 dark:bg-rose-500/10',
  now: 'border-brand-600 bg-card ring-4 ring-brand-600/15',
  later: 'border-slate-300 bg-card dark:border-white/20',
  open: 'border-slate-300 bg-card dark:border-white/20',
};

const META_TONE = {
  done: 'text-emerald-700 dark:text-emerald-300',
  doneLate: 'text-amber-700 dark:text-amber-300',
  late: 'text-rose-600 dark:text-rose-300',
  now: 'font-medium text-brand-600',
  later: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

const SEG_TONE = {
  done: 'bg-emerald-500',
  doneLate: 'bg-emerald-500',
  late: 'bg-rose-500',
  now: 'bg-brand-600',
  later: 'bg-slate-200 dark:bg-white/15',
  open: 'bg-slate-200 dark:bg-white/15',
};

function Needle({ now }) {
  return (
    <li aria-hidden="true" className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2.5 px-2 py-0.5">
      <span className="num rounded-[5px] bg-brand-600 py-[3px] text-center text-[11px] font-semibold text-white">
        {hhmmOf(now.getHours() * 60 + now.getMinutes())}
      </span>
      <span className="relative h-0.5 rounded bg-brand-600">
        <span className="absolute -top-[3px] left-[7px] size-2 rounded-full bg-brand-600" />
        <span className="absolute -top-4 right-0 text-[10px] font-semibold uppercase tracking-wider text-brand-600">agora</span>
      </span>
    </li>
  );
}

function RoutineRow({ row, now, busy, editing, draft, onDraft, onToggle, onSave, onClose }) {
  const { task, mark, doneAt, state } = row;
  const done = DONE.has(state);
  return (
    <li className={cn('grid grid-cols-[44px_22px_minmax(0,1fr)] items-start gap-x-2.5 rounded-xl px-2 py-2', state === 'now' && 'bg-brand-600/[0.07]')}>
      <span
        className={cn(
          'num flex h-[22px] items-center justify-end text-[12.5px] font-semibold',
          state === 'now' ? 'text-brand-600' : state === 'late' ? 'text-rose-600 dark:text-rose-300' : 'text-muted-foreground',
        )}
      >
        {task.time ?? <Repeat size={13} aria-label="Sem horário" />}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(row)}
        aria-pressed={done}
        aria-label={`${done ? 'Desmarcar' : 'Marcar como feita'}: ${task.title}`}
        className={cn('relative z-10 grid size-[22px] place-items-center rounded-full border-2 transition disabled:opacity-60', CHECK_TONE[state])}
      >
        {done && <Check size={12} strokeWidth={3.2} />}
      </button>
      <div className="min-w-0">
        <p className={cn('text-[13px] font-medium leading-snug', done && 'text-muted-foreground')}>{task.title}</p>
        <p className={cn('mt-0.5 text-[11.5px]', META_TONE[state])}>{stateText(task, state, doneAt ?? now, now)}</p>
        {task.how && !done && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{task.how}</p>}
        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              maxLength={NOTE_MAX}
              placeholder="Observação (opcional)"
              aria-label={`Observação sobre ${task.title}`}
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onClose();
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-[12.5px] placeholder:text-muted-foreground"
            />
            <button type="button" onClick={onSave} className="h-8 rounded-lg bg-slate-900 px-3 text-[12px] font-medium text-white dark:bg-white dark:text-slate-900">
              Salvar
            </button>
            <button type="button" onClick={() => onToggle(row)} className="px-1 text-[11.5px] text-muted-foreground underline underline-offset-2">
              Desfazer
            </button>
          </div>
        ) : mark?.note ? (
          <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11.5px] dark:bg-white/[0.06]">
            <MessageSquare size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
            {mark.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function RoutineCard({ db, appUser, enabled, now, metaWeekdays }) {
  const toast = useToast();
  const dayKey = routineDayKey(now);
  const { model, marks, loading, error } = useMyRoutine({ db, enabled, userId: appUser?.id, dayKey });
  const [busyTask, setBusyTask] = useState(null);
  const [editing, setEditing] = useState(null); // { markId, taskId }
  const [draft, setDraft] = useState('');

  const tasks = tasksForDay(model, now, metaWeekdays);
  // Enquanto o modelo e os checks do dia não chegam, ou se a leitura falhou, o
  // cartão não aparece: com os checks vazios, o toque marcaria de novo uma
  // tarefa já feita.
  if (loading || error || !model || tasks.length === 0) return null;

  const rows = tasks.map((task) => {
    const mark = marks.get(task.id) || null;
    // Check ainda sem a hora do servidor conta como agora; check cuja hora
    // não cai no dia não conta (markDoneAt), mas pode ser desfeito.
    const doneAt = mark ? (mark.doneAt ? markDoneAt(mark, dayKey) : now) : null;
    return { task, mark, doneAt, state: taskStateAt(task, doneAt, now) };
  });
  const doneCount = rows.filter((r) => DONE.has(r.state)).length;
  const timed = rows.filter((r) => minutesOf(r.task.time) != null);
  const free = rows.filter((r) => minutesOf(r.task.time) == null);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const needleAt = timed.findIndex((r) => minutesOf(r.task.time) > nowMinutes);

  const toggle = async ({ task, mark }) => {
    if (busyTask) return;
    setBusyTask(task.id);
    try {
      if (mark) {
        await undoMark({ db, markId: mark.id });
        if (editing?.taskId === task.id) setEditing(null);
      } else {
        const markId = await markDone({ db, appUser, model, task });
        setDraft('');
        setEditing({ markId, taskId: task.id });
      }
    } catch (err) {
      console.error('rotina: check falhou', err);
      toast.error(mark ? 'Não deu para desfazer. Tente de novo.' : 'Não deu para marcar a tarefa. Tente de novo.');
    } finally {
      setBusyTask(null);
    }
  };

  const saveNote = async () => {
    if (!editing) return;
    const { markId } = editing;
    setEditing(null);
    if (!draft.trim()) return;
    try {
      await saveMarkNote({ db, markId, note: draft });
    } catch (err) {
      console.error('rotina: observação falhou', err);
      toast.error('Não deu para salvar a observação. Tente de novo.');
    }
  };

  const rowEl = (row) => (
    <RoutineRow
      key={row.task.id}
      row={row}
      now={now}
      busy={busyTask === row.task.id}
      editing={editing?.taskId === row.task.id}
      draft={draft}
      onDraft={setDraft}
      onToggle={toggle}
      onSave={saveNote}
      onClose={() => setEditing(null)}
    />
  );

  return (
    <section aria-label="Rotina de hoje" className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/[0.05]">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-600/10 text-brand-600">
          <ListChecks size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold">Rotina de hoje</h3>
          <p className="truncate text-[11px] text-muted-foreground">Montada pelo gestor. Não conta na sua meta.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[12px] text-muted-foreground">
            <b className="text-[15px] font-semibold text-foreground">{doneCount}</b> de {rows.length}
          </p>
          <div className="mt-1 flex justify-end gap-[3px]" aria-hidden="true">
            {rows.map((r) => <span key={r.task.id} className={cn('h-1 w-2.5 rounded-sm', SEG_TONE[r.state])} />)}
          </div>
        </div>
      </div>

      {timed.length > 0 && (
        <ol className="relative p-2">
          <span aria-hidden="true" className="absolute bottom-6 left-[80px] top-6 w-0.5 rounded bg-slate-100 dark:bg-white/[0.06]" />
          {timed.flatMap((row, i) => (i === needleAt ? [<Needle key="agora" now={now} />, rowEl(row)] : [rowEl(row)]))}
          {needleAt === -1 && <Needle now={now} />}
        </ol>
      )}

      {free.length > 0 && (
        <div className="mx-2.5 border-t border-dashed border-slate-200 pb-1 pt-2 dark:border-white/10">
          <p className="px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sem horário</p>
          <ol className="p-1">{free.map(rowEl)}</ol>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/routineCard.test.js`
Expected: PASS.

- [ ] **Step 5: o cartão na lateral da Meta**

Em `src/views/DailyGoalView.jsx`:

1. Troque a linha 8, `import { isGestor } from '../lib/acesso.js';`, por:

```js
import { isGestor, isMetaParticipant } from '../lib/acesso.js';
```

2. Junto dos outros imports de `../components/dailygoal/`, acrescente:

```js
import { RoutineCard } from '../components/dailygoal/RoutineCard.jsx';
```

3. Na lateral (`{/* RIGHT — Sidebar */}`), entre o `<NextUp ... />` e o `<DayAgendaCard ... />`, acrescente:

```jsx
          {isMetaParticipant(appUser) && (
            <RoutineCard
              db={db}
              appUser={appUser}
              enabled={listenersActive}
              now={now}
              metaWeekdays={metaWeekdays}
            />
          )}
```

`now` (o relógio de 60 segundos da tela, linha ~991) e `metaWeekdays` (do `useGeneralConfig`, linha ~1014) já existem na view. O gestor na "Minha meta" não vê o cartão, porque gestor não segue modelo.

- [ ] **Step 6: o `metaLinks.test.js` conhece os caminhos novos**

Em `src/lib/__tests__/metaLinks.test.js`, o `vi.mock('../firebase.js', () => ({ ... }))` passa a ter também as três constantes:

```js
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter',
  DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
  ROUTINE_MODELS_PATH: 'rotina_modelos', ROUTINE_VERSIONS_PATH: 'rotina_versoes', ROUTINE_MARKS_PATH: 'rotina_marcas',
}));
```

(Se a PR #247 já tiver mudado esse bloco, mantenha o que ela deixou e só acrescente a última linha.)

- [ ] **Step 7: rodar os testes da Meta**

Run: `npx vitest run src/lib/__tests__/routineCard.test.js src/lib/__tests__/metaLinks.test.js src/lib/__tests__/marcaDoDia.sweep.test.js src/lib/__tests__/registroDoAgendamento.sweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js`
Expected: PASS.

- [ ] **Step 8: commit**

```bash
git add src/components/dailygoal/RoutineCard.jsx src/lib/__tests__/routineCard.test.js src/views/DailyGoalView.jsx src/lib/__tests__/metaLinks.test.js
git commit -m "feat: cartão Rotina de hoje na Meta diária"
```

---

### Task 6: o endereço da tela Rotinas

**Files:**
- Modify: `src/lib/routes.js`
- Modify: `src/lib/appShell.js`
- Modify: `src/lib/tenantSlug.js`
- Modify: `src/lib/sentryScrub.js`
- Test: `src/lib/__tests__/routes.test.js`, `src/lib/__tests__/appShell.test.js`, `src/lib/__tests__/sentryScrub.test.js`, `src/lib/__tests__/tenantSlug.test.js`

Endereços: `/<academia>/rotinas` (Modelos), `/<academia>/rotinas/modelos` (o mesmo) e `/<academia>/rotinas/modelos/<id>` (o modelo aberto). A aba Hoje entra na parte 2, com o segmento `hoje` em `ROTINAS_TABS`.

- [ ] **Step 1: escrever os testes novos**

No fim de `src/lib/__tests__/routes.test.js`, acrescente (se `parseAppPath`, `hrefFor` ou `canAccess` não estiverem no import de `../routes.js` no topo do arquivo, acrescente):

```js
describe('Rotinas no endereço', () => {
  const T = 'stronix-crm-app';

  it('lê a lista, a aba Modelos e o modelo aberto', () => {
    expect(parseAppPath(`/${T}/rotinas`)).toMatchObject({ tenantSlug: T, screen: 'rotinas', unknown: false });
    expect(parseAppPath(`/${T}/rotinas/modelos`)).toMatchObject({ screen: 'rotinas', sub: 'modelos' });
    expect(parseAppPath(`/${T}/rotinas/modelos/AbC123xyz`)).toMatchObject({ screen: 'rotinas', sub: 'modelos', modelId: 'AbC123xyz' });
  });

  it('sub-tela desconhecida e id inválido caem na lista', () => {
    expect(parseAppPath(`/${T}/rotinas/qualquer`)).toMatchObject({ screen: 'rotinas', subUnknown: true });
    expect(parseAppPath(`/${T}/rotinas/modelos/a.b`).modelId).toBeUndefined();
  });

  it('monta o endereço da lista e do modelo', () => {
    expect(hrefFor(T, 'rotinas')).toBe(`/${T}/rotinas`);
    expect(hrefFor(T, 'rotinas', { modelId: 'AbC123xyz' })).toBe(`/${T}/rotinas/modelos/AbC123xyz`);
    expect(hrefFor(T, 'rotinas', { modelId: 'a.b' })).toBe(`/${T}/rotinas`);
  });

  it('só o gestor abre', () => {
    expect(canAccess('rotinas', { id: 'g', role: 'admin' })).toBe(true);
    expect(canAccess('rotinas', { id: 'c', role: 'consultant' })).toBe(false);
    expect(canAccess('rotinas', { id: 'p', role: 'professor', professorId: 'x' })).toBe(false);
  });
});
```

No `src/lib/__tests__/sentryScrub.test.js`, junto dos testes do `scrubLeadPath` (perto da linha 569), acrescente (com `scrubLeadPath` no import de `../sentryScrub.js`, se ainda não estiver):

```js
  it('o id do modelo de rotina também sai do endereço', () => {
    expect(scrubLeadPath('/s/rotinas/modelos/AbC123')).toBe('/s/rotinas/modelos/:modelId');
    expect(scrubLeadPath('/s/rotinas/modelos/AbC123?x=1')).toBe('/s/rotinas/modelos/:modelId?x=1');
    expect(scrubLeadPath('/s/rotinas/hoje')).toBe('/s/rotinas/hoje');
    expect(scrubLeadPath('/s/rotinas/modelos')).toBe('/s/rotinas/modelos');
    expect(scrubLeadPath('https://x.com/s/ficha/L1 e /s/rotinas/modelos/M9')).toBe('https://x.com/s/ficha/:leadId e /s/rotinas/modelos/:modelId');
    expect(scrubLeadPath(scrubLeadPath('/s/rotinas/modelos/M9'))).toBe('/s/rotinas/modelos/:modelId');
  });
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/sentryScrub.test.js`
Expected: FAIL nos testes novos (tela `rotinas` desconhecida e id do modelo sem máscara).

- [ ] **Step 3: `src/lib/routes.js`**

1. Depois do `FICHA_TABS` (linha ~46), acrescente:

```js
// Abas da tela Rotinas (spec 2026-10-06). A aba Hoje entra na parte 2. O
// modelo aberto mora em /rotinas/modelos/<id>, lido à parte em readScreen.
export const ROTINAS_TABS = Object.freeze({
  modelos: 'modelos',
});
```

2. Em `SCREENS`, logo depois de `dailyGoal: tela(['meta-diaria'], 'Meta diária'),`:

```js
  rotinas: tela(['rotinas'], 'Rotinas', { gestor: true, subs: ROTINAS_TABS, subPadrao: 'modelos' }),
```

3. Troque `const SPECIAL = new Set(['ficha', 'superadmin']);` por:

```js
const SPECIAL = new Set(['ficha', 'superadmin', 'rotinas']);
```

4. Em `readScreen`, logo depois do fechamento do bloco `if (head === 'ficha') { ... }`, acrescente:

```js
  if (head === 'rotinas') {
    out.screen = 'rotinas';
    out.rest = segs.slice(1);
    if (out.rest.length === 2 && lower(out.rest[0]) === 'modelos' && isValidLeadId(out.rest[1])) {
      out.sub = 'modelos';
      out.modelId = out.rest[1];
      return;
    }
    readSub('rotinas', out.rest, out);
    return;
  }
```

O `modelId` só aparece quando existe, para o formato do resto das telas não mudar. O id segue a mesma regra do id da ficha (`isValidLeadId`), que é a de id do Firestore.

5. Em `hrefFor`, troque `const { leadId, superTab, sub } = opts || {};` por:

```js
  const { leadId, superTab, sub, modelId } = opts || {};
```

e, logo antes da última linha da função (`return \`${base}/${SCREENS[screen].segs.join('/')}${trecho}\`;`), acrescente:

```js
  if (screen === 'rotinas' && isValidLeadId(modelId)) return `${base}/rotinas/modelos/${encode(modelId)}`;
```

6. No `redirectTo` (linha ~300), troque o `target` por:

```js
    target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab, sub: r.sub, ...(r.modelId ? { modelId: r.modelId } : {}) },
```

(O resto da linha fica como está. O espalhamento condicional mantém o formato dos alvos que os testes de decisão comparam com `toEqual`.)

- [ ] **Step 4: `src/lib/sentryScrub.js`**

Logo depois de `const LEAD_PATH_RE = /(\/ficha\/)[^/?#\s"'<>]+/gi;`, acrescente:

```js
// O id do modelo de rotina (/rotinas/modelos/<id>) também sai do endereço,
// como pede o CLAUDE.md para todo segmento novo com id.
const MODEL_PATH_RE = /(\/rotinas\/modelos\/)[^/?#\s"'<>]+/gi;
```

e troque a linha `return text.replace(LEAD_PATH_RE, '$1:leadId');` por:

```js
  return text.replace(LEAD_PATH_RE, '$1:leadId').replace(MODEL_PATH_RE, '$1:modelId');
```

- [ ] **Step 5: `src/lib/tenantSlug.js`**

Na lista `RESERVED_TENANT_SLUGS`, na linha das palavras de tela (a que tem `'meta-diaria'`), acrescente `'rotinas',` depois de `'meta-diaria',`.

- [ ] **Step 6: `src/lib/appShell.js`**

No objeto que `screenState` devolve, logo depois da linha `sub: def?.subs ? (shown.sub ?? def.subPadrao) : null,`, acrescente:

```js
    modelId: shown?.screen === 'rotinas' ? (shown.modelId ?? null) : null,
```

- [ ] **Step 7: ajustar os testes que listam telas e formatos**

- `src/lib/__tests__/routes.test.js`:
  - na lista `TELAS` (linha ~16), acrescente `'rotinas'`;
  - troque `expect(gestor.sort()).toEqual(['billing', 'profile', 'settings']);` por `expect(gestor.sort()).toEqual(['billing', 'profile', 'rotinas', 'settings']);`;
  - na lista de `FIRST_LEVEL_SEGMENTS` (linha ~46), acrescente `'rotinas'`;
  - troque `expect(comSub.sort()).toEqual(['ficha', 'settings']);` por `expect(comSub.sort()).toEqual(['ficha', 'rotinas', 'settings']);`.
- `src/lib/__tests__/appShell.test.js`: no objeto esperado da linha ~20 (`{ fichaOpen, profileLeadId, activeTab, resolvedTab, superTab, sub: null }`), acrescente `modelId: null`. Faça o mesmo em qualquer outra comparação exata do objeto inteiro que falhar só por causa do campo novo. E acrescente, no fim do arquivo (com `screenState` no import de `../appShell.js`):

```js
describe('Rotinas', () => {
  it('o modelo aberto sai do endereço; fora de Rotinas, não existe', () => {
    const gestor = { id: 'g', role: 'admin' };
    expect(screenState({ screen: 'rotinas', sub: 'modelos', modelId: 'M1' }, null, gestor)).toMatchObject({ activeTab: 'rotinas', sub: 'modelos', modelId: 'M1' });
    expect(screenState({ screen: 'rotinas' }, null, gestor)).toMatchObject({ sub: 'modelos', modelId: null });
    expect(screenState({ screen: 'settings', modelId: 'M1' }, null, gestor).modelId).toBe(null);
  });
});
```

- [ ] **Step 8: rodar os testes de endereço**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.professor.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/tenantSlug.test.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/acesso.test.js src/lib/__tests__/screenParams.test.js`
Expected: PASS. Se o `routes.decision.test.js` acusar alguma lista exata de telas de gestor, acrescente `'rotinas'` nela, como no `routes.test.js`.

- [ ] **Step 9: commit**

```bash
git add src/lib/routes.js src/lib/appShell.js src/lib/tenantSlug.js src/lib/sentryScrub.js src/lib/__tests__/routes.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/sentryScrub.test.js
git commit -m "feat: endereço da tela Rotinas e do modelo aberto"
```

---

### Task 7: o menu e a casca

**Files:**
- Modify: `src/lib/sidebarNav.js`
- Modify: `src/App.jsx`
- Test: `src/lib/__tests__/sidebarNav.test.js`, `src/lib/__tests__/professorShell.test.js`

Faça esta Task junto com a Task 8 antes de rodar o build: o `App.jsx` passa a importar a `RotinasView`, criada na Task 8.

- [ ] **Step 1: `src/lib/sidebarNav.js`**

No objeto que `sidebarNav` devolve, logo depois de `dailyGoal: tela('dailyGoal'),`, acrescente:

```js
    rotinas: tela('rotinas'),
```

- [ ] **Step 2: os testes do menu**

Em `src/lib/__tests__/sidebarNav.test.js`:
- o objeto `TUDO` (linha ~19) vale para o gestor; o consultor e o usuário sem papel deixam de ver Rotinas. Troque o `TUDO` por dois objetos e use cada um na comparação certa:

```js
const DO_GESTOR = { overview: true, kanban: true, clientes: true, dailyGoal: true, rotinas: true, leads: true, suporte: true };
const DO_CONSULTOR = { ...DO_GESTOR, rotinas: false };
```

  (na comparação do gestor use `DO_GESTOR`; nas do consultor e do usuário sem papel, `DO_CONSULTOR`);
- no `DO_PROFESSOR` (linha ~20), acrescente `rotinas: false`;
- no mapa `TELAS` (linha ~23), acrescente `rotinas: ['rotinas'],`.

Em `src/lib/__tests__/professorShell.test.js`, na lista `itens` (linha ~50), acrescente `['rotinas', 'Rotinas']` logo depois de `['dailyGoal', 'Meta diária']`.

- [ ] **Step 3: `src/App.jsx`**

1. Na linha 3, acrescente `ListChecks` ao import de `lucide-react`:

```js
import { LayoutDashboard, Users, Plus, AlertTriangle, Activity, X, Menu, Settings, Kanban, Moon, Sun, Target, Globe, LifeBuoy, GraduationCap, ListChecks } from 'lucide-react';
```

2. Junto dos imports das views, acrescente:

```js
import { RotinasView } from './views/RotinasView.jsx';
```

3. No `screenState` (linha ~212), acrescente `modelId` à desestruturação:

```js
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab, sub, modelId } = screenState(shown, location.state, appUser);
```

4. No menu, logo depois da linha do item "Meta diária" (`{nav.dailyGoal && <SidebarItem ... label="Meta diária" ... />}`), numa linha própria:

```jsx
                {nav.rotinas && <SidebarItem icon={<ListChecks className="w-[18px] h-[18px]" />} label="Rotinas" href={menuHref('rotinas')} onNavigate={closeDrawer} active={activeTab === 'rotinas'} />}
```

5. Na lista de títulos do cabeçalho (linhas ~1676-1689), junto dos outros `{activeTab === '...' && '...'}`, acrescente:

```jsx
{activeTab === 'rotinas' && 'Rotinas'}
```

6. Dentro do `<AppErrorBoundary key={screenKey(shown)}>`, logo depois da linha de `settings` (`{activeTab === 'settings' && isGestor(appUser) && <SettingsView ... />}`), acrescente:

```jsx
              {activeTab === 'rotinas' && isGestor(appUser) && (
                <RotinasView
                  db={db}
                  appUser={appUser}
                  usersList={usersList}
                  modelId={modelId}
                  tenantId={sessionTenant}
                  listenersActive={listenersActive}
                />
              )}
```

(`sessionTenant` é a mesma academia que o `goToSub` usa para montar o endereço.)

- [ ] **Step 4: rodar os testes da casca**

Run: `npx vitest run src/lib/__tests__/sidebarNav.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js`
Expected: PASS (o `professorShell.test.js` lê o `App.jsx` como texto e não importa a view).

- [ ] **Step 5: commit**

```bash
git add src/lib/sidebarNav.js src/App.jsx src/lib/__tests__/sidebarNav.test.js src/lib/__tests__/professorShell.test.js
git commit -m "feat: item Rotinas no menu do gestor"
```

---

### Task 8: a tela Rotinas (aba Modelos e o modelo aberto)

**Files:**
- Create: `src/components/ui/sheet.jsx` (shadcn)
- Create: `src/components/rotinas/FormBits.jsx`
- Create: `src/components/rotinas/ModelCard.jsx`
- Create: `src/components/rotinas/ConsultantsList.jsx`
- Create: `src/components/rotinas/TaskSheet.jsx`
- Create: `src/components/rotinas/NewModelSheet.jsx`
- Create: `src/components/rotinas/ModelDetail.jsx`
- Create: `src/views/RotinasView.jsx`

Abra `docs/superpowers/specs/mockups/2026-10-06-tela-rotinas-gestor.html` (aba Modelos, abrir um modelo, Nova tarefa, Editar e Novo modelo). Os textos de tela são os da spec. Invoque a skill `shadcn` antes do Step 1.

- [ ] **Step 1: o painel lateral do shadcn**

Run: `npx shadcn@latest add sheet`
Expected: cria `src/components/ui/sheet.jsx` (exporta `Sheet`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SheetClose`, `SheetTrigger`). Confira com `git status` que ele não mexeu em outro arquivo (o `components.json` já existe). Se mexeu no `package.json`, confira que só acrescentou dependência que falta.

- [ ] **Step 2: `src/components/rotinas/FormBits.jsx`**

```jsx
import { cn } from '@/lib/utils';
import { DAY_LONG, DAY_SHORT, WEEK_ORDER } from '../../lib/rotinas.js';

// Peças dos painéis das rotinas: a escolha segmentada e os dias da semana.
export function Segmented({ label, value, options, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-0.5 self-start rounded-[10px] bg-slate-100 p-[3px] dark:bg-white/[0.05]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-lg px-3 text-[12.5px] font-medium text-muted-foreground transition', value === o.value && 'bg-card text-foreground shadow-card')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DayChips({ days, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEK_ORDER.map((d) => {
        const on = days.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={DAY_LONG[d]}
            onClick={() => onToggle(d)}
            className={cn('h-[34px] w-11 rounded-[9px] border text-[12.5px] font-medium', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-border text-muted-foreground')}
          >
            {DAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

export function FieldError({ children }) {
  return children ? <p className="text-[11.5px] text-rose-600 dark:text-rose-300">{children}</p> : null;
}
```

- [ ] **Step 3: `src/components/rotinas/ModelCard.jsx`**

```jsx
import { cn } from '@/lib/utils';
import { firstName, minutesOf, namesText, spanText } from '../../lib/rotinas.js';

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const pct = (m) => ((Math.min(Math.max(m, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100;

// A faixa do dia: quando as tarefas com horário acontecem, de 07h a 21h.
export function DayLine({ tasks }) {
  const times = (tasks || [])
    .filter((t) => t.active !== false)
    .map((t) => minutesOf(t.time))
    .filter((m) => m != null)
    .sort((a, b) => a - b);
  return (
    <div className="relative h-[34px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-2.5 h-0.5 rounded bg-slate-100 dark:bg-white/[0.07]" />
      {times.length > 1 && (
        <span
          className="absolute top-2.5 h-0.5 rounded bg-brand-600/35"
          style={{ left: `${pct(times[0])}%`, width: `${pct(times[times.length - 1]) - pct(times[0])}%` }}
        />
      )}
      {times.map((m, i) => (
        <span key={`${m}-${i}`} className="absolute top-1.5 -ml-[5px] size-2.5 rounded-full border-2 border-brand-600 bg-card" style={{ left: `${pct(m)}%` }} />
      ))}
      <span className="num absolute left-0 top-5 text-[10px] text-muted-foreground">07h</span>
      <span className="num absolute left-1/2 top-5 -translate-x-1/2 text-[10px] text-muted-foreground">14h</span>
      <span className="num absolute right-0 top-5 text-[10px] text-muted-foreground">21h</span>
    </div>
  );
}

export function ModelCard({ model, people, onOpen }) {
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  const active = (model.tasks || []).filter((t) => t.active !== false).length;
  const span = spanText(model);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:border-brand-500/50"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[16px] font-semibold tracking-tight">{model.name}</h3>
          <p className="num mt-0.5 text-[12px] text-muted-foreground">
            {active} {active === 1 ? 'tarefa' : 'tarefas'}{span ? ` · ${span}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-brand-600">Abrir</span>
      </div>
      <DayLine tasks={model.tasks} />
      <p className={cn('text-[12.5px]', followers.length ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
        {followers.length ? namesText(followers.map((p) => firstName(p.name))) : 'Ninguém segue este modelo'}
      </p>
    </button>
  );
}
```

- [ ] **Step 4: `src/components/rotinas/ConsultantsList.jsx`**

```jsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { firstName, modelOfUser, spanText, tasksForDay } from '../../lib/rotinas.js';
import { MODEL_GONE, setPersonModel } from '../../lib/rotinasWrites.js';

const NONE = 'sem-modelo';

export function ConsultantsList({ db, appUser, people, models, onOpenModel }) {
  const toast = useToast();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const [busy, setBusy] = useState(null);

  const change = async (person, value) => {
    const modelId = value === NONE ? null : value;
    setBusy(person.id);
    try {
      await setPersonModel({ db, appUser, models, userId: person.id, modelId });
      const name = firstName(person.name);
      toast.success(modelId ? `${name} agora segue o modelo ${models.find((m) => m.id === modelId)?.name}.` : `${name} ficou sem modelo.`);
    } catch (err) {
      console.error('rotinas: troca de modelo falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : 'Não deu para trocar o modelo. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="font-display text-[16px] font-semibold">Consultores</h2>
        <p className="text-[12.5px] text-muted-foreground">Cada um segue um modelo. Trocar aqui muda a rotina da pessoa a partir de hoje.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {people.length === 0 && (
          <p className="p-5 text-[13px] text-muted-foreground">Nenhum consultor na equipe ainda. Cadastre em Configurações, em Equipe & acessos.</p>
        )}
        {people.map((person) => {
          const model = modelOfUser(models, person.id);
          const today = model ? tasksForDay(model, new Date(), metaWeekdays).length : 0;
          const span = model ? spanText(model) : '';
          return (
            <div
              key={person.id}
              className={cn(
                'grid grid-cols-1 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_240px_110px]',
                !model && 'bg-amber-500/[0.06]',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{person.name}</p>
                <p className={cn('num text-[11.5px]', model ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                  {model ? `${today} ${today === 1 ? 'tarefa' : 'tarefas'} hoje${span ? ` · ${span}` : ''}` : 'Sem rotina na Meta diária'}
                </p>
              </div>
              <Select value={model?.id ?? NONE} onValueChange={(v) => change(person, v)} disabled={busy === person.id}>
                <SelectTrigger aria-label={`Modelo que ${firstName(person.name)} segue`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem modelo</SelectItem>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <span>
                {model && (
                  <button type="button" onClick={() => onOpenModel(model.id)} className="text-[13px] font-medium text-brand-600 underline underline-offset-[3px]">
                    Abrir modelo
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: `src/components/rotinas/TaskSheet.jsx`**

```jsx
import { useState } from 'react';
import { Info } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { useToast } from '../../contexts/ToastContext.jsx';
import {
  ALL_DAYS, MAX_TASKS_PER_MODEL, ROUTINE_ON_TIME_MINUTES, TASK_HOW_MAX, TASK_TITLE_MAX, firstName, namesText,
  newTaskId, normalizeTask, removeTask, taskProblems, upsertTask,
} from '../../lib/rotinas.js';
import { MODEL_GONE, updateModel } from '../../lib/rotinasWrites.js';
import { DayChips, FieldError, Segmented } from './FormBits.jsx';

const initialForm = (task) => ({
  title: task?.title ?? '',
  how: task?.how ?? '',
  daysMode: !task || task.days === ALL_DAYS ? 'all' : 'week',
  days: task && task.days !== ALL_DAYS ? task.days : [1, 2, 3, 4, 5],
  timeMode: task && task.time === null ? 'none' : 'time',
  time: task?.time ?? '09:00',
  active: task?.active !== false,
});

// Painel Nova tarefa / Editar tarefa. O pai monta com key nova a cada
// abertura, então o formulário sempre começa do que está gravado.
export function TaskSheet({ open, onOpenChange, db, appUser, model, followers, task }) {
  const toast = useToast();
  const [form, setForm] = useState(() => initialForm(task));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(task);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const whoSees = followers.length
    ? `${namesText(followers.map((p) => firstName(p.name)))} ${followers.length === 1 ? 'vê' : 'veem'} a mudança na Meta diária a partir de hoje.`
    : 'Ninguém segue este modelo ainda.';

  const write = async (edit, ok, fail) => {
    setSaving(true);
    try {
      await updateModel({ db, appUser, modelId: model.id, edit });
      toast.success(ok);
      onOpenChange(false);
    } catch (err) {
      console.error('rotinas: tarefa falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : fail);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const input = {
      title: form.title,
      how: form.how,
      days: form.daysMode === 'all' ? ALL_DAYS : form.days,
      time: form.timeMode === 'none' ? null : form.time,
      active: form.active,
    };
    const problems = taskProblems(input);
    if (!editing && (model.tasks || []).length >= MAX_TASKS_PER_MODEL) problems.title = `O modelo já tem ${MAX_TASKS_PER_MODEL} tarefas, o máximo.`;
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const next = normalizeTask(input, task?.id ?? newTaskId());
    write((m) => ({ tasks: upsertTask(m.tasks, next) }), editing ? 'Alterações salvas.' : 'Tarefa criada.', 'Não deu para salvar a tarefa. Tente de novo.');
  };

  const togglePause = () => write(
    (m) => ({ tasks: (m.tasks || []).map((t) => (t.id === task.id ? { ...t, active: !form.active } : t)) }),
    form.active ? 'Tarefa pausada.' : 'Tarefa reativada.',
    'Não deu para mudar a tarefa. Tente de novo.',
  );

  const remove = () => write(
    (m) => ({ tasks: removeTask(m.tasks, task.id) }),
    'Tarefa excluída. O histórico continua com ela.',
    'Não deu para excluir a tarefa. Tente de novo.',
  );

  const toggleDay = (d) => set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-[19px]">{editing ? 'Editar tarefa' : 'Nova tarefa'}</SheetTitle>
          <SheetDescription>No modelo {model.name}. {whoSees}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Nome da tarefa</span>
            <Input
              autoFocus
              value={form.title}
              maxLength={TASK_TITLE_MAX}
              placeholder="Ex.: Conferir a agenda do dia na recepção"
              aria-invalid={Boolean(errors.title)}
              onChange={(e) => set({ title: e.target.value })}
            />
            <FieldError>{errors.title}</FieldError>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Como fazer <span className="font-normal text-muted-foreground">(opcional)</span></span>
            <textarea
              value={form.how}
              maxLength={TASK_HOW_MAX}
              rows={3}
              placeholder="O que o consultor precisa saber para fazer do jeito certo."
              onChange={(e) => set({ how: e.target.value })}
              className="min-h-[70px] resize-y rounded-md border border-border bg-card px-3 py-2 text-[13.5px] placeholder:text-muted-foreground"
            />
            <FieldError>{errors.how}</FieldError>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">Em que dias</span>
            <Segmented
              label="Em que dias"
              value={form.daysMode}
              onChange={(v) => set({ daysMode: v })}
              options={[{ value: 'all', label: 'Todos os dias de trabalho' }, { value: 'week', label: 'Dias da semana' }]}
            />
            {form.daysMode === 'week'
              ? <DayChips days={form.days} onToggle={toggleDay} />
              : <p className="text-[11.5px] text-muted-foreground">Os dias da Meta da academia, definidos em Configurações.</p>}
            <FieldError>{errors.days}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">Horário</span>
            <Segmented
              label="Horário"
              value={form.timeMode}
              onChange={(v) => set({ timeMode: v })}
              options={[{ value: 'time', label: 'Com horário' }, { value: 'none', label: 'Sem horário' }]}
            />
            {form.timeMode === 'time' ? (
              <>
                <Input type="time" value={form.time} aria-label="Horário da tarefa" onChange={(e) => set({ time: e.target.value })} className="w-[120px] font-display font-semibold" />
                <p className="text-[11.5px] text-muted-foreground">Até {ROUTINE_ON_TIME_MINUTES} minutos depois do horário ela aparece como "agora". Depois disso, como atrasada.</p>
              </>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">Vale até o fim do dia.</p>
            )}
            <FieldError>{errors.time}</FieldError>
          </div>

          {editing && (
            <p className="flex gap-2 rounded-[10px] bg-brand-600/[0.08] px-3 py-2.5 text-[12px]">
              <Info size={15} className="mt-px shrink-0 text-brand-600" />
              A mudança vale a partir de hoje. Os dias anteriores continuam como estavam no histórico.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border px-5 py-3.5">
          {editing && (
            <div className="flex gap-1">
              <button type="button" disabled={saving} onClick={togglePause} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium">
                {form.active ? 'Pausar tarefa' : 'Reativar tarefa'}
              </button>
              <button type="button" disabled={saving} onClick={remove} className="h-[34px] rounded-[9px] px-3 text-[12.5px] font-medium text-rose-600 dark:text-rose-300">
                Excluir tarefa
              </button>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium">
              Cancelar
            </button>
            <button type="button" disabled={saving} onClick={save} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">
              {editing ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 6: `src/components/rotinas/NewModelSheet.jsx`**

```jsx
import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '../../contexts/ToastContext.jsx';
import { MODEL_NAME_MAX, modelNameProblem, modelOfUser } from '../../lib/rotinas.js';
import { MODEL_GONE, createModel } from '../../lib/rotinasWrites.js';
import { FieldError, Segmented } from './FormBits.jsx';

// Painel Novo modelo. O pai monta com key nova a cada abertura.
export function NewModelSheet({ open, onOpenChange, db, appUser, models, people, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [start, setStart] = useState('blank');
  const [copyFrom, setCopyFrom] = useState(models[0]?.id ?? null);
  const [followerIds, setFollowerIds] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id, checked) => setFollowerIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));

  const save = async () => {
    const problem = modelNameProblem(name, models);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const id = await createModel({ db, appUser, models, name, copyFrom: start === 'copy' ? copyFrom : null, followerIds });
      toast.success('Modelo criado.');
      onOpenChange(false);
      onCreated(id);
    } catch (err) {
      console.error('rotinas: criar modelo falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'O modelo que você quis copiar foi excluído.' : 'Não deu para criar o modelo. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-[19px]">Novo modelo</SheetTitle>
          <SheetDescription>Depois de criar, você põe as tarefas dentro dele.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Nome do modelo</span>
            <Input
              autoFocus
              value={name}
              maxLength={MODEL_NAME_MAX}
              placeholder="Ex.: Consultor do fim de semana"
              aria-invalid={Boolean(error)}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError>{error}</FieldError>
          </label>

          {models.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold">Começar</span>
              <Segmented
                label="Começar"
                value={start}
                onChange={setStart}
                options={[{ value: 'blank', label: 'Em branco' }, { value: 'copy', label: 'Cópia de um modelo' }]}
              />
              {start === 'copy' && (
                <>
                  <Select value={copyFrom ?? undefined} onValueChange={setCopyFrom}>
                    <SelectTrigger aria-label="Modelo para copiar" className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({(m.tasks || []).length} tarefas)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11.5px] text-muted-foreground">As tarefas são copiadas. Mudar a cópia não mexe no original.</p>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">Quem segue <span className="font-normal text-muted-foreground">(opcional, dá para escolher depois)</span></span>
            {people.length === 0 && <p className="text-[12.5px] text-muted-foreground">Nenhum consultor na equipe ainda.</p>}
            {people.map((p) => {
              const current = modelOfUser(models, p.id);
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border px-3 py-2 text-[13px]">
                  <Checkbox checked={followerIds.includes(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-[11.5px] text-muted-foreground">{current ? `sai do ${current.name}` : 'sem modelo'}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium">
            Cancelar
          </button>
          <button type="button" disabled={saving} onClick={save} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">
            Criar modelo
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 7: `src/components/rotinas/ModelDetail.jsx`**

```jsx
import { useState } from 'react';
import { Copy, Info, Plus, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '../../contexts/ToastContext.jsx';
import { MODEL_NAME_MAX, byTime, daysText, firstName, minutesOf, modelNameProblem, modelOfUser, namesText } from '../../lib/rotinas.js';
import { MODEL_GONE, deleteModel, duplicateModel, setPersonModel, updateModel } from '../../lib/rotinasWrites.js';
import { FieldError } from './FormBits.jsx';
import { TaskSheet } from './TaskSheet.jsx';

function TaskRow({ task, onEdit }) {
  const paused = task.active === false;
  return (
    <li className="grid grid-cols-[46px_14px_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
      <span className="num flex justify-end text-[13px] font-semibold leading-[18px] text-muted-foreground">
        {task.time ?? <Repeat size={13} aria-label="Sem horário" />}
      </span>
      <span className={cn('relative z-10 mt-0.5 size-3.5 rounded-full border-2 bg-card', paused ? 'border-slate-300 dark:border-white/20' : 'border-brand-600')} />
      <div className="min-w-0">
        <p className={cn('text-[13.5px] font-medium', paused && 'text-muted-foreground')}>{task.title}</p>
        {task.how && <p className="mt-0.5 text-[12px] text-muted-foreground">{task.how}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {daysText(task.days)}
          {paused && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold dark:bg-white/[0.06]">Pausada</span>}
        </p>
      </div>
      <button type="button" onClick={() => onEdit(task)} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium">
        Editar
      </button>
    </li>
  );
}

export function ModelDetail({ db, appUser, model, models, people, startRenaming = false, onBack, onDeleted, onDuplicated }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(startRenaming);
  const [nameDraft, setNameDraft] = useState(model.name);
  const [nameError, setNameError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sheet, setSheet] = useState(null); // { key, task }
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  const others = people.filter((p) => !(model.followerIds || []).includes(p.id));
  const tasks = [...(model.tasks || [])].sort((a, b) => (Number(b.active !== false) - Number(a.active !== false)) || byTime(a, b));
  const timed = tasks.filter((t) => minutesOf(t.time) != null);
  const free = tasks.filter((t) => minutesOf(t.time) == null);

  const run = async (fn, ok, fail) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      console.error('rotinas:', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : fail);
      return false;
    }
  };

  const saveName = async () => {
    const problem = modelNameProblem(nameDraft, models, model.id);
    setNameError(problem);
    if (problem) return;
    const ok = await run(() => updateModel({ db, appUser, modelId: model.id, edit: () => ({ name: nameDraft.trim() }) }), 'Nome salvo.', 'Não deu para salvar o nome. Tente de novo.');
    if (ok) setRenaming(false);
  };

  const duplicate = async () => {
    try {
      const id = await duplicateModel({ db, appUser, models, source: model });
      toast.success('Modelo duplicado. Dê um nome e escolha quem segue.');
      onDuplicated(id);
    } catch (err) {
      console.error('rotinas: duplicar falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : 'Não deu para duplicar o modelo. Tente de novo.');
    }
  };

  const remove = async () => {
    const ok = await run(() => deleteModel({ db, appUser, modelId: model.id }), 'Modelo excluído. O histórico continua com ele.', 'Não deu para excluir o modelo. Tente de novo.');
    if (ok) onDeleted();
  };

  const unfollow = (p) => run(
    () => setPersonModel({ db, appUser, models, userId: p.id, modelId: null }),
    `${firstName(p.name)} ficou sem modelo.`,
    'Não deu para tirar a pessoa do modelo. Tente de novo.',
  );

  const follow = (pid) => {
    const p = people.find((x) => x.id === pid);
    if (!p) return;
    run(
      () => setPersonModel({ db, appUser, models, userId: pid, modelId: model.id }),
      `${firstName(p.name)} agora segue o modelo ${model.name}.`,
      'Não deu para pôr a pessoa no modelo. Tente de novo.',
    );
  };

  const openTask = (task) => setSheet({ key: `${task?.id ?? 'nova'}-${Date.now()}`, task });
  const taskList = (list) => (
    <ol className="relative p-2.5">
      {list.map((t) => <TaskRow key={t.id} task={t} onEdit={openTask} />)}
    </ol>
  );

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <button type="button" onClick={onBack} className="font-medium text-brand-600">Modelos</button>
        <span>/</span>
        <span className="truncate">{model.name}</span>
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3.5">
        {renaming ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={nameDraft}
                maxLength={MODEL_NAME_MAX}
                aria-label="Nome do modelo"
                aria-invalid={Boolean(nameError)}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') { setRenaming(false); setNameDraft(model.name); setNameError(null); }
                }}
                className="h-11 min-w-[280px] font-display text-[22px] font-semibold"
              />
              <button type="button" onClick={saveName} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">Salvar nome</button>
            </div>
            <FieldError>{nameError}</FieldError>
          </div>
        ) : (
          <h1 className="flex items-center gap-2.5 font-display text-[28px] font-semibold tracking-tight">
            {model.name}
            <button type="button" onClick={() => setRenaming(true)} className="font-sans text-[12px] font-medium text-muted-foreground underline underline-offset-[3px]">Renomear</button>
          </h1>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={duplicate} className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium">
            <Copy size={14} /> Duplicar modelo
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="h-[34px] rounded-[9px] px-3 text-[12.5px] font-medium text-rose-600 dark:text-rose-300">
            Excluir modelo
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-[13px] dark:bg-rose-500/10">
          <span>
            {followers.length
              ? `${namesText(followers.map((p) => firstName(p.name)))} ${followers.length === 1 ? 'fica' : 'ficam'} sem rotina até você escolher outro modelo.`
              : 'Ninguém segue este modelo.'}{' '}
            O histórico dos dias anteriores continua.
          </span>
          <span className="flex gap-1.5">
            <button type="button" onClick={() => setConfirmDelete(false)} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium">Cancelar</button>
            <button type="button" onClick={remove} className="h-[34px] rounded-[9px] bg-rose-600 px-3 text-[12.5px] font-medium text-white">Excluir modelo</button>
          </span>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold">
              Tarefas
              <span className="num rounded-md bg-slate-100 px-1.5 text-[11px] text-muted-foreground dark:bg-white/[0.06]">{tasks.filter((t) => t.active !== false).length}</span>
            </h2>
            <button type="button" onClick={() => openTask(null)} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
          {tasks.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Este modelo ainda não tem tarefa. Crie a primeira.</p>}
          {timed.length > 0 && taskList(timed)}
          {free.length > 0 && (
            <div className="mx-2.5 border-t border-dashed border-slate-200 pt-1.5 dark:border-white/10">
              <p className="px-2 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sem horário</p>
              {taskList(free)}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-[14px] font-semibold">Quem segue <span className="num ml-1 rounded-md bg-slate-100 px-1.5 text-[11px] text-muted-foreground dark:bg-white/[0.06]">{followers.length}</span></h2>
            </div>
            <div className="flex flex-col gap-2 px-4 py-3">
              {followers.length === 0 && <p className="text-[11.5px] text-muted-foreground">Ninguém segue este modelo ainda.</p>}
              {followers.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <button type="button" onClick={() => unfollow(p)} className="text-[12px] text-muted-foreground underline underline-offset-2">Tirar</button>
                </div>
              ))}
              {others.length > 0 && (
                <Select value="" onValueChange={follow}>
                  <SelectTrigger aria-label="Pôr um consultor neste modelo" className="mt-1.5 h-9 w-full">
                    <SelectValue placeholder="Pôr um consultor neste modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {others.map((p) => {
                      const current = modelOfUser(models, p.id);
                      return <SelectItem key={p.id} value={p.id}>{p.name} {current ? `(sai do ${current.name})` : '(sem modelo)'}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          </section>
          <p className="flex gap-2 rounded-[10px] bg-brand-600/[0.08] px-3 py-2.5 text-[12px]">
            <Info size={15} className="mt-px shrink-0 text-brand-600" />
            O que você muda aqui vale a partir de hoje para quem segue o modelo. Os dias anteriores continuam como estavam no histórico.
          </p>
        </aside>
      </div>

      {sheet && (
        <TaskSheet
          key={sheet.key}
          open
          onOpenChange={(open) => { if (!open) setSheet(null); }}
          db={db}
          appUser={appUser}
          model={model}
          followers={followers}
          task={sheet.task}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: `src/views/RotinasView.jsx`**

```jsx
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ListChecks, Plus } from 'lucide-react';
import { useRoutineModels } from '../hooks/useRoutineModels.js';
import { canGoBackInApp, hrefFor } from '../lib/routes.js';
import { firstName, modelOfUser, namesText, routineParticipants } from '../lib/rotinas.js';
import { ModelCard } from '../components/rotinas/ModelCard.jsx';
import { ConsultantsList } from '../components/rotinas/ConsultantsList.jsx';
import { ModelDetail } from '../components/rotinas/ModelDetail.jsx';
import { NewModelSheet } from '../components/rotinas/NewModelSheet.jsx';

// Tela Rotinas do gestor (spec 2026-10-06, mockup
// 2026-10-06-tela-rotinas-gestor.html). Parte 1: a aba Modelos e o modelo
// aberto em /rotinas/modelos/<id>. O modelo aberto é outra tela no endereço
// (screenKey rotinas:<id>): abrir empilha no histórico, rola para o topo e
// remonta esta view. Por isso o que passa da lista para o modelo vai no state
// da navegação:
//   - rotinaNova: o modelo acabou de ser criado ou duplicado. A transação só
//     aparece na lista quando o servidor confirma; até lá a tela fica em
//     branco, sem o aviso de modelo excluído.
//   - renomear: abre o modelo com o nome em edição (depois de duplicar).
function Headline({ people, models }) {
  if (people.length === 0) return <>Nenhum consultor na equipe ainda.</>;
  const without = people.filter((p) => !modelOfUser(models, p.id));
  const withModel = people.length - without.length;
  return (
    <>
      <em className="font-bold not-italic text-brand-600 dark:text-brand-300">{withModel} de {people.length}</em> consultores seguem um modelo
      {without.length
        ? <>. <em className="font-bold not-italic text-amber-700 dark:text-amber-300">{namesText(without.map((p) => firstName(p.name)))}</em> ainda {without.length === 1 ? 'está' : 'estão'} sem rotina.</>
        : '. Todos têm rotina.'}
    </>
  );
}

export function RotinasView({ db, appUser, usersList, modelId, tenantId, listenersActive }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { models, loading, error } = useRoutineModels({ db, enabled: listenersActive, tenantId });
  const people = useMemo(() => routineParticipants(usersList), [usersList]);
  const [creatingKey, setCreatingKey] = useState(null);

  const openModel = (id) => navigate(hrefFor(tenantId, 'rotinas', { modelId: id }));
  const openNew = (id, renomear = false) =>
    navigate(hrefFor(tenantId, 'rotinas', { modelId: id }), { state: { rotinaNova: id, renomear } });
  const toList = () => navigate(hrefFor(tenantId, 'rotinas'), { replace: true });
  // Voltar do modelo, como na ficha: volta uma entrada quando há para onde
  // voltar dentro do app; senão, troca o endereço pela lista.
  const back = () => (canGoBackInApp(window.history.state) ? navigate(-1) : toList());

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-[13.5px] shadow-card">
        Não deu para carregar as rotinas. Recarregue a página.
      </div>
    );
  }

  if (modelId) {
    const model = models.find((m) => m.id === modelId);
    const fresh = location.state?.rotinaNova === modelId;
    if (!model) {
      if (loading || fresh) return null;
      return (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-card">
          <p className="text-[14px] font-semibold">Esse modelo não existe mais.</p>
          <button type="button" onClick={toList} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">Voltar para Modelos</button>
        </div>
      );
    }
    return (
      <ModelDetail
        db={db}
        appUser={appUser}
        model={model}
        models={models}
        people={people}
        startRenaming={fresh && location.state?.renomear === true}
        onBack={back}
        onDeleted={toList}
        onDuplicated={(id) => openNew(id, true)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks size={14} /> Rotinas
          </p>
          <h1 className="mt-2 max-w-[720px] font-display text-[27px] font-medium leading-tight tracking-tight">
            <Headline people={people} models={models} />
          </h1>
        </div>
        <button type="button" onClick={() => setCreatingKey(Date.now())} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
          <Plus size={15} /> Novo modelo
        </button>
      </div>

      {models.length > 0 && (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {models.map((m) => <ModelCard key={m.id} model={m} people={people} onOpen={() => openModel(m.id)} />)}
        </div>
      )}
      {!loading && models.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
          Nenhum modelo ainda. Crie o primeiro no botão Novo modelo e escolha quem segue.
        </div>
      )}

      <ConsultantsList db={db} appUser={appUser} people={people} models={models} onOpenModel={openModel} />

      {creatingKey && (
        <NewModelSheet
          key={creatingKey}
          open
          onOpenChange={(open) => { if (!open) setCreatingKey(null); }}
          db={db}
          appUser={appUser}
          models={models}
          people={people}
          onCreated={(id) => openNew(id)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 9: lint, testes e build**

Run: `npm run lint && npm test && npm run build`
Expected: os três passam. Se o lint reclamar de `react-hooks/set-state-in-effect`, é porque algum estado foi derivado num efeito: o código acima não usa efeito nenhum, então confira a cópia. Se o `filtrosNoEndereco.sweep.test.js` reclamar de algum nome de estado, troque o nome (ele proíbe nomes como `setSection` e `setPerson` em views).

- [ ] **Step 10: conferir na tela, localmente**

Siga a nota de memória "Harness no navegador sem login" (Vite com fakes do Firebase) ou rode `npm run dev` numa conta de academia de teste. Confira, em claro e escuro e em 390 px de largura:
- o menu do gestor mostra "Rotinas" depois de Meta diária, e o do consultor não;
- `/<academia>/rotinas` mostra o título, os cartões e a lista; criar um modelo abre o modelo novo; Nova tarefa, Editar, Pausar, Excluir, Renomear, Duplicar (abre a cópia com o nome em edição) e Excluir modelo funcionam e mostram as mensagens da spec;
- abrir um modelo rola para o topo, e o Voltar do navegador (e o "Modelos" do caminho) volta para a lista na mesma posição; depois de excluir um modelo, o Voltar do navegador não cai no modelo apagado;
- na Meta diária do consultor que segue um modelo, o cartão aparece abaixo do Próximo compromisso, o check marca, a observação salva, e o toque de novo desfaz.

- [ ] **Step 11: commit**

```bash
git add src/components/ui/sheet.jsx src/components/rotinas src/views/RotinasView.jsx package.json package-lock.json
git commit -m "feat: tela Rotinas do gestor com modelos, tarefas e quem segue"
```

(Se o `npx shadcn add sheet` não mexeu em `package.json` nem em `package-lock.json`, tire os dois do `git add`.)

---

### Task 9: quem vira professor ou é excluído sai do modelo

**Files:**
- Modify: `api/admin-users.js`
- Test: `api/__tests__/professorAccess.test.js`

- [ ] **Step 1: o banco falso aceita `array-contains` e `set` no lote**

Em `api/__tests__/professorAccess.test.js`, dentro do `vi.mock('../_firebaseAdmin.js', ...)`:

1. troque `where: (campo, _op, valor) => ref(caminho, [...filtros, { campo, valor }]),` por:

```js
      where: (campo, op, valor) => ref(caminho, [...filtros, { campo, op, valor }]),
```

2. troque `.filter(([, d]) => filtros.every(({ campo, valor }) => d[campo] === valor))` por:

```js
      .filter(([, d]) => filtros.every(({ campo, op, valor }) => (op === 'array-contains' ? Array.isArray(d[campo]) && d[campo].includes(valor) : d[campo] === valor)))
```

3. no `batch`, acrescente o `set` e faça o `commit` gravar cada um do seu jeito (mantenha o comentário que já existe acima):

```js
  const batch = () => {
    const gravacoes = [];
    return {
      update: (alvo, dados) => { gravacoes.push([alvo, dados, 'update']); },
      set: (alvo, dados) => { gravacoes.push([alvo, dados, 'set']); },
      commit: async () => {
        banco.lotes.push(gravacoes.length);
        for (const [alvo, dados, tipo] of gravacoes) await (tipo === 'set' ? alvo.set(dados) : alvo.update(dados));
      },
    };
  };
```

- [ ] **Step 2: escrever os testes**

No topo do arquivo, junto dos outros imports, acrescente:

```js
import { diaDeBrasilia, isoDoDia } from '../_horarioDeBrasilia.js';
```

E, no fim do arquivo:

```js
// Rotinas (spec 2026-10-06): quem vira professor ou é excluído sai do modelo
// que seguia, com a versão do dia gravada junto.
describe('modelo de rotina de quem sai da equipe de vendas', () => {
  const MODELOS = `artifacts/${T}/public/data/stronix_rotina_modelos`;
  const VERSOES = `artifacts/${T}/public/data/stronix_rotina_versoes`;
  const hoje = () => isoDoDia(diaDeBrasilia(new Date()));
  const modelos = () => {
    banco.docs.set(`${MODELOS}/M1`, { name: 'Consultor da manhã', tasks: [{ id: 't1', title: 'Abrir a recepção' }], followerIds: ['uid-ana', 'uid-bia'] });
    banco.docs.set(`${MODELOS}/M2`, { name: 'Consultor da tarde', tasks: [], followerIds: ['uid-bia'] });
  };

  it('consultor que vira professor sai do modelo, e só do dele', async () => {
    semear();
    modelos();
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(banco.docs.get(`${MODELOS}/M1`).followerIds).toEqual(['uid-bia']);
    expect(banco.docs.get(`${MODELOS}/M2`).followerIds).toEqual(['uid-bia']);
    expect(banco.docs.get(`${VERSOES}/M1_${hoje()}`)).toMatchObject({
      modelId: 'M1', date: hoje(), name: 'Consultor da manhã', followerIds: ['uid-bia'], deleted: false, savedBy: 'gestor-1',
    });
    expect(banco.docs.has(`${VERSOES}/M2_${hoje()}`)).toBe(false);
  });

  it('quem não segue modelo não gera gravação de rotina', async () => {
    semear();
    banco.docs.set(`${MODELOS}/M2`, { name: 'Consultor da tarde', tasks: [], followerIds: ['uid-bia'] });
    await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect([...banco.docs.keys()].some((k) => k.startsWith(`${VERSOES}/`))).toBe(false);
  });

  it('quem é excluído sai do modelo', async () => {
    semear();
    modelos();
    const res = await chamar(adminUsers, { action: 'delete', userDocId: 'uid-ana' });
    expect(res.statusCode).toBe(200);
    expect(banco.docs.get(`${MODELOS}/M1`).followerIds).toEqual(['uid-bia']);
    expect(banco.docs.get(`${VERSOES}/M1_${hoje()}`)).toMatchObject({ followerIds: ['uid-bia'] });
  });
});
```

(O `semear()` padrão deixa Ana e Bia como consultoras e o gestor `gestor-1` na sessão. Se a troca de papel de Ana exigir mais preparo, copie o preparo do teste "consultor que vira professor devolve as tarefas ao dono de cada lead", perto da linha 418.)

- [ ] **Step 3: rodar e ver falhar**

Run: `npx vitest run api/__tests__/professorAccess.test.js`
Expected: os três testes novos falham (o modelo continua com `uid-ana`); os antigos continuam passando.

- [ ] **Step 4: `api/admin-users.js`**

1. Depois do import de `./_professorLink.js`, acrescente:

```js
import { diaDeBrasilia, isoDoDia } from './_horarioDeBrasilia.js';
import { modelDocs } from '../src/lib/rotinas.js';
```

(`src/lib/rotinas.js` só importa `acesso.js` e `operacional/month.js`, que não importam nada, então a `api/` pode usá-lo.)

2. Logo depois de `const BATCH_LIMIT = 500;`, acrescente:

```js
const ROUTINE_MODELS_PATH = 'stronix_rotina_modelos';
const ROUTINE_VERSIONS_PATH = 'stronix_rotina_versoes';
```

3. Logo depois da função `returnDelegatedTasks`, acrescente:

```js
// Rotinas dos consultores (spec 2026-10-06): quem vira professor ou é
// excluído sai do modelo de rotina que seguia, e a versão do dia do modelo é
// gravada junto, para o histórico saber que a pessoa saiu naquele dia. Cada
// consultor segue um modelo só, então o lote é pequeno.
async function leaveRoutineModels(tenantId, userDocId, actorId) {
  const snap = await dataCollection(tenantId, ROUTINE_MODELS_PATH).where('followerIds', 'array-contains', userDocId).get();
  if (snap.empty) return 0;
  const date = isoDoDia(diaDeBrasilia(new Date()));
  const batch = adminDb.batch();
  snap.docs.forEach((d) => {
    const data = d.data();
    // Mesma montagem de versão do app (modelDocs), para o histórico ler um formato só.
    const { model, version } = modelDocs({
      modelId: d.id,
      name: data.name || '',
      tasks: data.tasks,
      followerIds: (data.followerIds || []).filter((id) => id !== userDocId),
      userId: actorId,
      dateKey: date,
    });
    batch.update(d.ref, { followerIds: model.followerIds, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorId });
    batch.set(dataCollection(tenantId, ROUTINE_VERSIONS_PATH).doc(version.id), { ...version.data, savedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  return snap.size;
}
```

4. Em `handleSetRole`, logo depois de `const returnedTasks = becomesProfessor ? await returnDelegatedTasks(auth.tenantId, snap.id) : 0;`:

```js
    const leftRoutines = becomesProfessor ? await leaveRoutineModels(auth.tenantId, snap.id, auth.uid) : 0;
```

e, no `console.info('admin-set-role', { ... })`, acrescente `rotinasDeixadas: leftRoutines` ao objeto.

5. Em `handleDelete`, logo depois de `const returnedTasks = await returnDelegatedTasks(auth.tenantId, userDocId);`:

```js
    const leftRoutines = await leaveRoutineModels(auth.tenantId, userDocId, auth.uid);
```

e, no `console.info` do fim do delete (o que já leva `tarefasDevolvidas`), acrescente `rotinasDeixadas: leftRoutines`.

- [ ] **Step 5: rodar e ver passar**

Run: `npx vitest run api/__tests__/professorAccess.test.js api/__tests__/adminUsers.test.js api/__tests__/adminUsersSetEmail.test.js`
Expected: PASS. Se algum teste antigo comparar a lista exata de `banco.consultas` de uma troca ou exclusão que deu certo, acrescente nela a consulta nova (`colecao: 'stronix_rotina_modelos'`, filtro `followerIds`).

- [ ] **Step 6: commit**

```bash
git add api/admin-users.js api/__tests__/professorAccess.test.js
git commit -m "feat: quem vira professor ou é excluído sai do modelo de rotina"
```

---

### Task 10: a novidade no sino e o CLAUDE.md

**Files:**
- Modify: `src/lib/announcements.js` (topo do array)
- Modify: `CLAUDE.md` (seção nova, depois de "## Professor")

- [ ] **Step 1: a novidade para os gestores**

No topo do array de `src/lib/announcements.js` (as novidades novas vão em primeiro), acrescente. A `date` é o dia em que a PR for aberta, em `AAAA-MM-DD` (o exemplo usa 07/10/2026). Sem `major`: com `major` e sem `adminSteps`, o `professorPopups.test.js` quebra.

```js
  {
    id: 'rotinas-dos-consultores-2026-10',
    audience: 'gestor',
    date: '2026-10-07',
    eyebrow: 'Novidade',
    title: 'Rotinas: monte o dia de trabalho de cada consultor',
    summary: 'Em Rotinas, no menu, você cria modelos com as tarefas do dia que não envolvem lead, como conferir a recepção ou postar o story da aula, e escolhe quem segue cada modelo. O consultor dá check na Meta diária, num cartão próprio, e a rotina não conta para o dia batido.',
  },
```

Run: `npx vitest run src/lib/__tests__/professorPopups.test.js src/lib/__tests__/notifications.test.js src/lib/__tests__/wiki.test.js`
Expected: PASS.

- [ ] **Step 2: a seção no `CLAUDE.md`**

No `CLAUDE.md` do Stronilead, depois da seção "## Professor" e antes de "## Responsável do menor de idade", acrescente:

```markdown
## Rotinas dos consultores

O gestor monta modelos de rotina (tarefas recorrentes sem lead) e escolhe quem segue cada um, e o consultor dá check na Meta diária. Spec em `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md`, mockups em `docs/superpowers/specs/mockups/2026-10-06-*`, plano da parte 1 em `docs/superpowers/plans/2026-10-06-rotinas-parte-1.md`. As partes 2 (aba Hoje) e 3 (histórico no Operacional) vêm depois.

- **A regra do dia mora em `src/lib/rotinas.js`**, pura e sem import de tela: tarefa do dia (`taskRunsOn`, com "todos os dias de trabalho" seguindo o `metaWeekdays` da academia), estado (`taskStateAt`: agora até `ROUTINE_ON_TIME_MINUTES` depois do horário, depois atrasada), textos, validação e troca de modelo. Cartão, tela e histórico usam essa regra; não recalcule estado fora dela.
- **Cada consultor segue um modelo só.** Quem pode seguir sai de `routineParticipants` (consultor ativo, com nome; gestor e professor não). Toda gravação que mexe em quem segue passa pela transação de `src/lib/rotinasWrites.js` (`commitModels`), que lê os modelos e grava os que mudam.
- **Modelo e versão do dia andam juntos.** Toda gravação de modelo grava também `stronix_rotina_versoes/{modelId}_{AAAA-MM-DD}` com nome, tarefas e quem segue. É o histórico: a versão não se apaga, e o histórico de um dia usa a versão de data mais recente até ele. Gravação nova de modelo que não passe por `commitModels` deixa o histórico errado.
- **O check** é `stronix_rotina_marcas/{consultantId}_{date}_{taskId}`, criado só pelo próprio consultor, com `doneAt` do servidor e `note` vazio; depois só o `note` muda, e o dono desfaz até 24 horas depois (a tela oferece só no dia). As regras conferem o cadastro de `consultantId` contra o uid de quem grava, exigem que o `date` seja o dia de agora (`routineMarkDayOk`) e só aceitam os nove campos que o app grava.
- **O check não prova nada sozinho.** O consultor grava o próprio check, então `taskTitle`, `taskTime` e `modelId` são declarados por ele. O estado sai sempre da tarefa do modelo (hoje) ou da versão do dia (histórico), e o check só conta quando o `doneAt` cai no próprio `date` (`markDoneAt`). Contagem como "2 de 6" parte da lista de tarefas do modelo ou da versão, nunca dos checks soltos.
- **O cartão "Rotina de hoje"** (`src/components/dailygoal/RoutineCard.jsx`) só aparece para `isMetaParticipant` com modelo e tarefa no dia, e fica fora da conta da Meta (ProgressHero, filtros, dia batido). As leituras obedecem ao `listenersActive`.
- **A tela Rotinas** (`src/views/RotinasView.jsx`, trava `gestor`) mora em `/<academia>/rotinas`, e o modelo aberto em `/<academia>/rotinas/modelos/<id>`, lido à parte em `readScreen` (`src/lib/routes.js`). O id do modelo sai do Sentry pelo `MODEL_PATH_RE` do `sentryScrub.js`. Abrir um modelo empilha no histórico.
- **Quem vira professor ou é excluído sai do modelo** pelo servidor (`leaveRoutineModels`, em `api/admin-users.js`), depois da devolução das tarefas delegadas, com a versão do dia no mesmo lote. O dia do servidor é o de Brasília (`isoDoDia(diaDeBrasilia(...))`).
```

- [ ] **Step 3: commit**

```bash
git add src/lib/announcements.js CLAUDE.md
git commit -m "docs: novidade das rotinas no sino e regras no CLAUDE.md"
```

---

### Task 11: verificação final, regras e PR

- [ ] **Step 1: tudo verde**

Run: `npm run lint && npm test && npm run build`
Expected: os três passam. Compare o número de testes com a linha de base: ele só pode ter subido.

- [ ] **Step 2: revisão de código**

Invoque `superpowers:requesting-code-review` sobre o diff da branch inteira contra a main. Corrija o que for real antes da PR.

- [ ] **Step 3: abrir a PR**

Push da branch e PR em português, com o resumo da parte 1, o link da spec e dos mockups e a lista de verificação manual da Task 8, Step 10. Não faça merge.

- [ ] **Step 4: publicar as regras, com o ok do Johnny**

As regras novas precisam estar publicadas antes de testar no preview da Vercel (que usa o Firebase de produção) e antes do merge. Peça o ok do Johnny e publique pelo console do Firebase ou pelo Firebase CLI, como nas últimas entregas. Depois, confira que o ruleset ativo tem os três blocos novos.

- [ ] **Step 5: teste no preview, numa academia de teste**

No preview da Vercel, com uma conta de gestor da academia de teste: crie um modelo, ponha um consultor de teste, crie tarefas com e sem horário, e entre como o consultor (ou peça ao Johnny) para ver o cartão na Meta, marcar, observar e desfazer. Confira também que um consultor não abre `/<academia>/rotinas` (aviso "Essa tela é só do gestor."). Se a primeira marcação do consultor voltar recusada (permission-denied), olhe primeiro a função `routineMarkDayOk` em `firestore.rules`: o validador só prova a sintaxe, e a conta do dia (com `int('05')`) só se prova com uma marcação de verdade.

- [ ] **Step 6: depois do merge**

Atualize a tabela "Últimas Atualizações" do `CLAUDE.md` raiz da STRONIX e a nota de memória `rotinas-consultores` com o número da PR e o merge.
