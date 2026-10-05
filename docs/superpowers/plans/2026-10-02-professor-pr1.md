# Professor e faltosos, PR 1: o professor · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A STRONIX ganha o papel Professor no Stronilead. O super-admin liga o módulo "Professor e faltosos" por academia, o gestor cria o acesso do professor ligado ao cadastro de professores, e o professor entra vendo só a Meta diária (ainda sem os faltosos), Clientes e a ficha, com as travas na tela, na ponte do Stronizap e nas regras do Firestore.

**Architecture:** Os módulos ficam em `tenants/{id}.modules`, com a conta em `src/lib/modules.js`, e o app os lê no login e guarda em `appUser.tenantModules`. O papel e o que cada papel pode fazer ficam numa lista só, `src/lib/acesso.js`, sem import, que o app e a `api/` usam. As telas do professor saem de `src/lib/routes.js` e `src/lib/sidebarNav.js`. Só o servidor cria professor (`api/admin-users.js` e `api/invite-accept.js`), conferindo o módulo, o cadastro de professores e um login por professor. As regras do Firestore travam o que o professor grava.

**Tech Stack:** React 19, Vite, React Router 7, Firebase (Firestore no navegador, firebase-admin na `api/`), Vercel serverless, Vitest (node e jsdom).

**Spec:** `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md`, aprovada pelo Johnny em 02/10/2026. Este plano cobre só o PR 1 da seção "Entregas". O PR 2 (importações) e o PR 3 (Meta do professor) terão planos próprios, e o botão do Stronizap tem spec própria a escrever, a partir de `docs/superpowers/specs/2026-10-02-abrir-no-stronizap-levantamento.md`.

**Repositório, branch e base:** `~/STRONIX-FIRMA/06-sistemas/stronilead`, worktree `.claude/worktrees/great-keller-18b985`, branch `claude/stronilead-dual-system-2a0e73`. O código é o da main em `49a978d`, e os únicos commits a mais na branch são os da spec e dos levantamentos (`592188d` e `dc63a63`) e o deste plano. As linhas citadas são as de `49a978d`, e os caminhos são relativos à raiz do worktree. Quando uma task mexe num arquivo que uma task anterior já mudou, procure pelo trecho citado e não pelo número da linha.

**Git:** o git desta máquina está sem `user.name`. Todo commit usa `git -c user.name="Johnny Bittencourt" commit ...` e leva a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não mude a configuração do git.

**Regras do projeto que valem aqui** (do `CLAUDE.md`):
- `src/lib/acesso.js` e `src/lib/modules.js` não importam nada, porque a `api/` importa os dois. A `api/` importa só módulos puros de `src/lib`.
- Em `api/`, `snap.exists` é propriedade; em `src/`, `snap.exists()` é função.
- Limite de 12 funções na Vercel, hoje 11: nada de função nova. As ações novas entram em funções que já existem.
- As regras do Firestore são publicadas à mão pelo Johnny no console, antes do merge do PR que as muda.
- Nada de `setState` dentro de effect para ler o endereço: trocar de tela é navegar.
- UI nova usa shadcn, `cn()`, tokens semânticos, `flex gap-*` e `size-N`.
- Textos em português, diretos, sem travessão no meio da frase e sem aspas curvas.
- Trabalho por PR, nunca commit na main. O merge é do Johnny.

## Decisões tomadas neste plano

A spec não cobria estes casos. O plano segue o caminho mais seguro em cada um, e o Johnny pode mudar qualquer um antes do merge.

| | Caso | Decisão |
|---|---|---|
| D1 | Módulo desligado com professor já criado | O professor entra e vê só o aviso "O acesso de professor está desligado nesta academia. Fale com o gestor.". As regras do Firestore recusam as gravações dele no lead e nas interações, e a ponte do Stronizap recusa o agendamento dele. Nos registros de aula ele grava como qualquer membro (ponto 9). |
| D2 | Consultor com carteira que vira professor | O `set-role` responde 409: "<nome> ainda tem leads na carteira. Passe os leads em Configurações → Migrar leads antes de mudar o papel para Professor." |
| D3 | Professor pela ponte do Stronizap | Não abre o cadastro de lead nem cadastra (403), não aparece na equipe nem como dono, e agenda sem contar na Meta. |
| D4 | Agendamento e anotação do professor nos painéis | Caem em "Outros" no volume do Operacional, porque o professor não tem linha por pessoa. |
| D5 | "Voltar" da ficha sem histórico | Ficha de cliente volta para Clientes. Ficha de lead volta para a Meta diária. |
| D6 | Pop-ups de novidade | O pop-up grande (`WhatsNewModal`) e o tutorial (`WalkthroughModal`) não abrem para o professor. O sino continua mostrando as novidades. |
| D7 | Suporte | Sai do menu do professor (`ACTIONS.SUPORTE_ABRIR`). |
| D8 | Busca do topo | Para o professor, mostra só clientes. O recorte vem depois da leitura. |
| D9 | Desfecho do agendamento | O professor só grava `appointmentOutcome`, `appointmentOutcomeAt` e `appointmentOutcomeBy` vazios. |
| D10 | Onde ficam os módulos no app | Em `appUser.tenantModules`, montado no login. Não existe variável nem prop à parte. |
| D11 | Papel e vínculo do professor | `role` e `professorId` de `stronix_users` só mudam pelo servidor. |

## Pontos que dependem do Johnny

1. **D1 e a leitura da academia no login.** Se a leitura de `tenants/{id}` falhar no login (rede caindo no meio), a lista de módulos vem vazia e o professor vê o aviso de acesso desligado até o F5. Gestor e consultor não sentem nada.
2. **Aviso de endereço desconhecido para o professor.** "Não achamos essa tela. Abrimos a Meta diária." O texto de hoje diz "Abrimos o Operacional", o que seria falso para ele. `/` e `/<academia>`, onde o login e o Sair caem, levam o professor à Meta sem aviso.
3. **Cadastros antigos.** Um cadastro em `stronix_users` com id diferente do uid da conta não vira professor (422), porque as regras leem o papel pelo uid. Antes de ligar o módulo na STRONIX, vale contar quantos cadastros assim existem.
4. **Travas a mais nas regras, além da spec.** A interação do professor sai sempre no nome dele (`actorAuthUid` igual ao uid). Ele não edita nem apaga interação. O gestor deixa de conseguir gravar `role` e `professorId` pelo navegador e de criar ou apagar cadastro de equipe por ali (ponto 10), o que também fecha um desvio do limite de vagas.
5. **O Agendar do professor mexe na Meta do consultor.** Agendar Mensagem ou Ligação cria tarefa na Meta do consultor dono, e a Anotação do professor marca o lead como "Já interagido hoje" para o consultor. A spec libera esses campos. O PR 3 decide o que o contato de falta faz com isso.
6. **Busca do professor.** A busca traz 20 candidatos por consulta. Um começo de nome comum pode encher a página de leads e esconder um cliente. Resolver de vez pede índice composto.
7. **Regras ainda não validadas.** Ninguém rodou o validador do Firebase nas regras novas. A Task 11 traz os cenários do Playground, que precisam passar antes da publicação.
8. **Foto do lead.** Não há `storage.rules` no repositório. O professor não liga foto ao lead (`photoUrl` fica fora da lista dele), mas pode subir o arquivo se as regras do Storage no console deixarem. Vale conferir lá.
9. **Registros de aula sem trava de professor.** Em `stronix_aulas` o professor grava como qualquer membro, como a spec pede, porque o Agendar da ficha cria e move o registro. Pelo console do navegador, com o módulo ligado ou desligado, ele conseguiria criar registro, marcar `attended` ou `no_show` e trocar o `professorId`, e esses registros alimentam a conversão por professor do Dashboard CRM. Travar a troca de status quebraria o Agendar dele, que fecha o registro com o desfecho ao remarcar (`closeOpenAppointment`). Travar só pelo módulo cobriria o caso do módulo desligado, mas cada gravação de aula passaria a custar uma leitura a mais para todo mundo. O plano deixou aberto, como a spec, e o comentário das regras explica as duas saídas.
10. **Cadastro de equipe só pelo servidor.** Fora do plano original, as regras passaram a recusar `create` e `delete` em `stronix_users` vindos do navegador. Sem isso, um gestor apagaria o cadastro de um professor e criaria de novo como consultor, pulando a conta das vagas, a carteira do D2 e a cobrança. Nenhuma tela cria ou apaga esse cadastro: tudo passa por `api/admin-users.js`, `api/invite-accept.js` e `api/provision-tenant.js`.

## Mapa de arquivos

| Task | Cria | Muda |
|---|---|---|
| 1 | `src/lib/modules.js` | |
| 2 | `src/lib/acesso.js` | |
| 3 | | `src/App.jsx` (só o login) |
| 4 | `src/views/console/TenantModulesCard.jsx` | `api/tenant-status.js`, `api/super-overview.js`, `src/views/console/SuperConsole.jsx` |
| 5 | `src/lib/teamRoles.js`, `api/_professorLink.js` | `api/_plans.js`, `api/invite-create.js`, `api/invite-accept.js`, `api/admin-users.js` |
| 6 | | `src/views/settings/TeamAccessSection.jsx`, `src/lib/settingsSetup.js`, `src/views/settings/OverviewSection.jsx`, `src/views/settings/PaceSection.jsx` |
| 7 | `src/lib/sidebarNav.js`, `src/views/ProfessorGoalPlaceholder.jsx`, `src/views/auth/ProfessorAccessOffScreen.jsx` | `src/lib/routes.js`, `src/App.jsx` (menu, rota, Meta, aviso), `src/views/LeadProfileRoute.jsx`, `src/components/WhatsNewModal.jsx`, `src/components/WalkthroughModal.jsx`, `src/lib/announcements.js`, `src/components/layout/PersonaMenu.jsx` |
| 8 | | `src/views/LeadProfileView.jsx`, `src/components/profile/ReferralsSection.jsx`, `src/views/ClientsView.jsx`, `src/modals/ClientRegistrationModal.jsx`, `src/components/layout/GlobalSearch.jsx`, `src/lib/globalSearch.js`, `src/lib/notifications.js`, `src/components/layout/NotificationBell.jsx`, `src/App.jsx` (cabeçalho, busca, `AddLeadModal`, `useHandoffs`) |
| 9 | | `src/lib/dailyGoalHistory.js`, `src/lib/leads.js`, `src/lib/kanban.js`, telas de listas, Meta e painéis, `src/views/settings/ImportClientsSection.jsx`, `src/views/settings/TransferLeadsTab.jsx`, `src/App.jsx` (o resto das checagens de papel) |
| 10 | | `api/_zapLead.js`, `api/_zapSchedule.js`, `api/zap.js` |
| 11 | `src/lib/professorWrites.js` | `firestore.rules` |
| 12 | | `CLAUDE.md` |

Testes novos: `modules.test.js`, `acesso.test.js`, `acessoImports.test.js`, `tenantModulesWiring.test.js`, `tenantModulesCard.test.js`, `teamRoles.test.js`, `teamRolesImports.test.js`, `teamAccessProfessor.test.js`, `routes.professor.test.js`, `sidebarNav.test.js`, `professorGoalPlaceholder.test.js`, `professorAccessOffScreen.test.js`, `professorPopups.test.js`, `professorShell.test.js`, `globalSearchScope.test.js`, `notificationsProfessor.test.js`, `profileProfessor.test.js`, `ownerPickersProfessor.test.js`, `clientsProfessor.test.js`, `acessoSweep.test.js` e `professorRules.test.js`, em `src/lib/__tests__/`; `tenantStatusModules.test.js`, `superOverviewProfessores.test.js`, `plansSeats.test.js`, `professorAccess.test.js` e `zapProfessor.test.js`, em `api/__tests__/`. Blocos novos em `routes.decision.test.js`, `settingsSetup.test.js`, `dailyGoalHistory.test.js` e `zapRoute.test.js`.

A ordem das tasks importa. A 2 vem antes de todas as que importam `acesso.js`. A 5 cria o `teamRoles.js` que a 6 usa. A 9 roda a varredura, que só passa depois das tasks 3 a 8. A 11 só passa depois da 8, porque lê os handlers da ficha.

### Task 0: Preparação

**Files:** nenhum.

- [ ] **Step 1: Conferir o worktree e a branch**

Run: `git branch --show-current && git status --short`
Expected: `claude/stronilead-dual-system-2a0e73` e nenhuma linha de arquivo mudado.

- [ ] **Step 2: Conferir se a main andou**

Run: `git fetch origin && git rev-list --count HEAD..origin/main`
Expected: `0`.

Se vier mais que zero, confira se a main mexeu em algum arquivo do mapa acima:

Run: `git diff --stat HEAD...origin/main -- src/App.jsx src/lib/routes.js src/views/LeadProfileView.jsx src/views/settings/TeamAccessSection.jsx api/ firestore.rules`

Faça o merge com `git -c user.name="Johnny Bittencourt" merge origin/main`. Se algum desses arquivos mudou, releia os trechos citados nas tasks antes de aplicar cada uma.

- [ ] **Step 3: Dependências**

Run: `npm install && git status --short package-lock.json`
Expected: nenhuma linha. O `node_modules` do worktree já ficou para trás da main antes (falta de `tw-animate-css`, `eslint-plugin-react` e `react-router`), e é isso que este passo pega.

- [ ] **Step 4: Linha de base dos testes**

Run: `npx vitest run 2>&1 | tail -5`
Expected: todos passando. Anote os números de `Test Files` e `Tests`. Se algum teste já falhar antes de qualquer mudança, anote qual é, para não confundir com quebra nova.

- [ ] **Step 5: Linha de base do lint**

Run: `npx eslint . 2>&1 | tail -3`
Expected: anote o total de problemas. A Task 13 confere que ele não aumentou.

Não há commit nesta task.

### Task 1: Módulos por academia (`src/lib/modules.js`)

**Files:**
- Create: `src/lib/modules.js`
- Test: `src/lib/__tests__/modules.test.js` (novo)

Notas:
- O arquivo é puro e não tem import, porque a `api/` o importa direto (`api/tenant-status.js`, `api/super-overview.js` e, na Task 5, `api/_plans.js`). Quem cobra a ausência de import é o teste da Task 2, que lê `acesso.js` e `modules.js` com o leitor endurecido (`IMPORT_RE`/`stripComments`).
- As regras do Firestore ganham a própria `hasModule(appId, key)` na Task 11. O último bloco deste teste só lê o `firestore.rules`: hoje ele não tem chamada nenhuma e o bloco passa sem conferir nada. Depois da Task 11, ele cobra que toda chamada passe um módulo de `MODULES`, escrito por extenso (`hasModule(appId, 'faltosos')`).

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/__tests__/modules.test.js`:

```js
// Módulos por academia (src/lib/modules.js). O super-admin liga no console, a
// api/tenant-status.js grava a lista em tenants/{id}.modules, o app lê no
// login e as regras do Firestore leem pela hasModule. Este teste trava a conta
// do lado do app e da api e confere que as regras, quando chamam a hasModule,
// falam dos mesmos módulos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MODULES, KNOWN_MODULES, normalizeModules, hasModule } from '../modules.js';

const rules = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

describe('MODULES e KNOWN_MODULES', () => {
  it('o módulo do professor e dos faltosos se chama faltosos', () => {
    expect(MODULES.FALTOSOS).toBe('faltosos');
  });

  it('KNOWN_MODULES lista os valores de MODULES', () => {
    expect([...KNOWN_MODULES].sort()).toEqual(Object.values(MODULES).sort());
    expect(KNOWN_MODULES).toContain('faltosos');
  });

  it('as duas listas são congeladas', () => {
    expect(Object.isFrozen(MODULES)).toBe(true);
    expect(Object.isFrozen(KNOWN_MODULES)).toBe(true);
  });
});

describe('normalizeModules', () => {
  it('o que não é lista vira lista vazia', () => {
    for (const raw of [undefined, null, '', 'faltosos', 1, true, {}, { faltosos: true }]) {
      expect(normalizeModules(raw), JSON.stringify(raw)).toEqual([]);
    }
  });

  it('fica só com os módulos conhecidos', () => {
    expect(normalizeModules(['faltosos', 'catraca', '', null, undefined, 7, { id: 'faltosos' }, ['faltosos']])).toEqual(['faltosos']);
  });

  it('não corrige caixa nem espaço: a api recusa antes de gravar', () => {
    expect(normalizeModules(['Faltosos', ' faltosos', 'faltosos '])).toEqual([]);
  });

  it('repetido vira um só', () => {
    expect(normalizeModules(['faltosos', 'faltosos', 'faltosos'])).toEqual(['faltosos']);
  });

  it('sai em ordem, qualquer que seja a ordem de entrada', () => {
    expect(normalizeModules([...KNOWN_MODULES].reverse())).toEqual([...KNOWN_MODULES].sort());
  });

  it('devolve lista nova e não mexe na recebida', () => {
    const entrada = ['faltosos', 'catraca'];
    const saida = normalizeModules(entrada);
    expect(entrada).toEqual(['faltosos', 'catraca']);
    expect(saida).not.toBe(entrada);
  });
});

describe('hasModule', () => {
  it('lê o documento da academia', () => {
    expect(hasModule({ displayName: 'STRONIX', modules: ['faltosos'] }, MODULES.FALTOSOS)).toBe(true);
    expect(hasModule({ displayName: 'Shape One', modules: [] }, MODULES.FALTOSOS)).toBe(false);
    expect(hasModule({ displayName: 'Power Club' }, MODULES.FALTOSOS)).toBe(false);
  });

  it('lê a lista direto, como a do appUser.tenantModules', () => {
    expect(hasModule(['faltosos'], MODULES.FALTOSOS)).toBe(true);
    expect(hasModule([], MODULES.FALTOSOS)).toBe(false);
  });

  it('lê as vagas do getSeatUsage, que trazem modules junto', () => {
    expect(hasModule({ plan: 'starter', managers: 1, consultants: 3, modules: ['faltosos'] }, MODULES.FALTOSOS)).toBe(true);
  });

  it('academia sem documento ou com o campo fora do formato: sem módulo', () => {
    for (const t of [null, undefined, {}, { modules: 'faltosos' }, { modules: { faltosos: true } }, { modules: null }]) {
      expect(hasModule(t, MODULES.FALTOSOS), JSON.stringify(t)).toBe(false);
    }
  });

  it('chave desconhecida nunca está ligada, mesmo gravada', () => {
    expect(hasModule({ modules: ['faltosos', 'catraca'] }, 'catraca')).toBe(false);
    expect(hasModule(['faltosos'], 'faltoso')).toBe(false);
    expect(hasModule(['faltosos'], 'Faltosos')).toBe(false);
    expect(hasModule(['faltosos'], undefined)).toBe(false);
  });
});

describe('firestore.rules: as chamadas da hasModule', () => {
  // As regras têm a própria hasModule(appId, key), que lê o mesmo campo. Toda
  // chamada fora da definição passa o módulo escrito por extenso, e o texto
  // precisa ser um dos de MODULES, senão a regra confere um módulo que o
  // console nunca liga. Comentário não conta. Sem chamada nenhuma, não há o
  // que conferir.
  const semComentario = rules.replace(/\/\/.*$/gm, '');
  const chamadas = [...semComentario.matchAll(/(function\s+)?\bhasModule\(([^)]*)\)/g)]
    .filter((m) => !m[1])
    .map((m) => m[2].trim());

  it('toda chamada passa um módulo conhecido, entre aspas', () => {
    for (const args of chamadas) {
      const literal = args.match(/^\w+\s*,\s*'([^']*)'$/)?.[1];
      expect(literal, args).toBeDefined();
      expect(KNOWN_MODULES, args).toContain(literal);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/modules.test.js`
Expected: FAIL, `Error: Cannot find module '../modules.js' imported from .../src/lib/__tests__/modules.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Implementar**

Criar `src/lib/modules.js`:

```js
// Módulos que o super-admin liga por academia. A lista mora em
// tenants/{id}.modules e só a api/tenant-status.js grava (as regras não deixam
// o navegador escrever em /tenants). O app lê a lista no login, junto com o
// resto do documento da academia (App.jsx), e a guarda em
// appUser.tenantModules. Hoje existe um módulo só, o do professor e dos
// faltosos, ligado apenas na STRONIX.
//
// Arquivo puro e sem import: a api/ usa este arquivo direto, e as regras do
// Firestore têm a mesma conta na função hasModule, que lê o mesmo campo.
// Módulo novo entra em MODULES; se as regras o usarem, com o mesmo texto lá
// (o modules.test.js confere).
//
// A tela "Feature flags" do super console é outra coisa: ela grava chaves
// globais que nenhuma parte do app lê.

export const MODULES = Object.freeze({ FALTOSOS: 'faltosos' });

export const KNOWN_MODULES = Object.freeze(Object.values(MODULES));

// A lista que vale: só módulos conhecidos, sem repetição e em ordem. O que não
// é lista vira lista vazia. Não corrige caixa nem espaço, porque a
// api/tenant-status.js recusa o que não é exato antes de gravar.
export function normalizeModules(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((m) => KNOWN_MODULES.includes(m)))].sort();
}

// O módulo `key` está ligado? Aceita o documento da academia ({ modules }),
// as vagas do getSeatUsage ({ modules }) ou a lista direto, como a do
// appUser.tenantModules. Documento ausente, campo fora do formato ou chave
// desconhecida dão false.
export function hasModule(tenantOrModules, key) {
  const raw = Array.isArray(tenantOrModules) ? tenantOrModules : tenantOrModules?.modules;
  return normalizeModules(raw).includes(key);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/modules.test.js`
Expected: PASS, `Tests  15 passed (15)`. O bloco das regras passa sem conferir nada, porque o `firestore.rules` ainda não chama a `hasModule` (Task 11).

Run: `npx eslint src/lib/modules.js src/lib/__tests__/modules.test.js`
Expected: nenhuma saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/modules.js src/lib/__tests__/modules.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: módulos por academia em src/lib/modules.js" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lista de permissões (`src/lib/acesso.js`)

**Files:**
- Create: `src/lib/acesso.js`
- Test: `src/lib/__tests__/acesso.test.js` (novo)
- Test: `src/lib/__tests__/acessoImports.test.js` (novo)

Depende da Task 1: o `src/lib/modules.js` já existe, e a varredura de import lê os dois arquivos.

O conteúdo de `acesso.js` é o do contrato compartilhado: o rascunho de papéis mais a ação `SUPORTE_ABRIR`. O arquivo não importa nada, porque a `api/` (Tasks 5 e 10) o importa direto. `can(null, X)` dá `false` e `isSeller(null)` dá `false`. Gestor e consultor fazem todas as ações de `ACTIONS`, porque é assim hoje: o consultor edita e vende igual ao gestor desde a PR #193. O professor não faz nenhuma.

- [ ] **Step 1: Escrever o teste da lista**

Criar `src/lib/__tests__/acesso.test.js`:

```js
// A lista do que cada papel faz (src/lib/acesso.js): o papel do cadastro, quem
// vende, as ações e as telas do professor.
import { describe, it, expect } from 'vitest';
import {
  ROLES, roleOf, isGestor, isProfessor, isSeller, ROLE_LABELS, roleLabel,
  ACTIONS, can, PROFESSOR_SCREENS, canOpenScreen,
} from '../acesso.js';
import { SCREENS } from '../routes.js';

const gestor = { id: 'u1', role: 'admin', authUid: 'uid-1' };
const consultor = { id: 'u2', role: 'consultant', authUid: 'uid-2' };
const professor = { id: 'u3', role: 'professor', professorId: 'p1', authUid: 'uid-3' };
const semPapel = { id: 'u4', authUid: 'uid-4' };
const legado = { id: 'u5', role: 'consultor' };
const superPuro = { id: 'u6', role: 'superadmin', superAdminOnly: true };

describe('roleOf', () => {
  it('lê os três papéis gravados', () => {
    expect(roleOf(gestor)).toBe('admin');
    expect(roleOf(consultor)).toBe('consultant');
    expect(roleOf(professor)).toBe('professor');
  });

  it('sem papel, papel antigo ou desconhecido vale consultor, como sempre foi', () => {
    expect(roleOf(semPapel)).toBe('consultant');
    expect(roleOf(legado)).toBe('consultant');
    expect(roleOf(superPuro)).toBe('consultant');
    expect(roleOf(null)).toBe('consultant');
    expect(roleOf(undefined)).toBe('consultant');
  });

  it('compara exato, como as regras do Firestore', () => {
    expect(roleOf({ role: 'Admin' })).toBe('consultant');
    expect(roleOf({ role: ' admin' })).toBe('consultant');
    expect(roleOf({ role: 'PROFESSOR' })).toBe('consultant');
    expect(roleOf({ role: ['admin'] })).toBe('consultant');
  });
});

describe('isGestor, isProfessor e isSeller', () => {
  it('cada papel no seu lugar', () => {
    const todos = [gestor, consultor, professor];
    expect(todos.map((u) => isGestor(u))).toEqual([true, false, false]);
    expect(todos.map((u) => isProfessor(u))).toEqual([false, false, true]);
    expect(todos.map((u) => isSeller(u))).toEqual([true, true, false]);
  });

  it('cadastro sem papel e cadastro antigo vendem', () => {
    expect(isSeller(semPapel)).toBe(true);
    expect(isSeller(legado)).toBe(true);
  });

  it('sem usuário ninguém vende', () => {
    expect(isSeller(null)).toBe(false);
    expect(isSeller(undefined)).toBe(false);
  });

  it('serve direto no filter de uma lista da equipe', () => {
    expect([gestor, professor, consultor].filter(isSeller).map((u) => u.id)).toEqual(['u1', 'u2']);
  });
});

describe('roleLabel', () => {
  it('o nome do papel na tela', () => {
    expect(roleLabel(gestor)).toBe('Gestor');
    expect(roleLabel(consultor)).toBe('Consultor');
    expect(roleLabel(professor)).toBe('Professor');
    expect(roleLabel(semPapel)).toBe('Consultor');
    expect(roleLabel(undefined)).toBe('Consultor');
  });

  it('tem um nome para cada papel', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(Object.values(ROLES).sort());
  });
});

describe('tabelas', () => {
  it('os nomes das ações não mudam', () => {
    expect(ACTIONS).toEqual({
      LEAD_CRIAR: 'lead.criar',
      CADASTRO_EDITAR: 'cadastro.editar',
      FICHA_MUDAR_FASE: 'ficha.mudarFase',
      CONTRATO_EDITAR: 'contrato.editar',
      INDICACAO_CADASTRAR: 'indicacao.cadastrar',
      CLIENTES_EXPORTAR: 'clientes.exportar',
      LEADS_VER: 'leads.ver',
      SINO_EQUIPE: 'sino.equipe',
      SUPORTE_ABRIR: 'suporte.abrir',
    });
  });

  it('os papéis são os valores gravados no cadastro', () => {
    expect(ROLES).toEqual({ GESTOR: 'admin', CONSULTOR: 'consultant', PROFESSOR: 'professor' });
  });

  it('nada muda em tempo de execução', () => {
    for (const t of [ROLES, ACTIONS, PROFESSOR_SCREENS, ROLE_LABELS]) expect(Object.isFrozen(t)).toBe(true);
  });
});

describe('can', () => {
  const todas = Object.values(ACTIONS);

  it('gestor e consultor fazem todas as ações da lista, como hoje', () => {
    for (const action of todas) {
      expect(can(gestor, action), action).toBe(true);
      expect(can(consultor, action), action).toBe(true);
      expect(can(semPapel, action), action).toBe(true);
    }
  });

  it('professor não faz nenhuma, com ou sem professor ligado', () => {
    const solto = { id: 'u7', role: 'professor' };
    for (const action of todas) {
      expect(can(professor, action), action).toBe(false);
      expect(can(solto, action), action).toBe(false);
    }
  });

  it('as decisões do professor ditas com o nome: sem Suporte, sem leads na busca, sino sem carteira', () => {
    expect(can(professor, ACTIONS.SUPORTE_ABRIR)).toBe(false);
    expect(can(professor, ACTIONS.LEADS_VER)).toBe(false);
    expect(can(professor, ACTIONS.SINO_EQUIPE)).toBe(false);
    expect(can(consultor, ACTIONS.SUPORTE_ABRIR)).toBe(true);
    expect(can(gestor, ACTIONS.SUPORTE_ABRIR)).toBe(true);
  });

  it('sem usuário, nada', () => {
    for (const action of todas) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('ação fora da lista é recusada para todos (tela é canOpenScreen, não can)', () => {
    expect(can(gestor, 'tela.pipeline')).toBe(false);
    expect(can(consultor, 'lead.excluir')).toBe(false);
    expect(can(gestor, undefined)).toBe(false);
  });
});

describe('canOpenScreen', () => {
  const telas = Object.keys(SCREENS);

  it('as telas do professor existem na tabela de endereços', () => {
    for (const id of PROFESSOR_SCREENS) expect(telas).toContain(id);
  });

  it('professor abre só a Meta diária, Clientes e a ficha', () => {
    expect(telas.filter((id) => canOpenScreen(professor, id)).sort()).toEqual(['clientes', 'dailyGoal', 'ficha']);
  });

  it('a tela inicial, os painéis, o Pipeline, Leads e as telas do gestor ficam fora para o professor', () => {
    for (const id of ['dashboard', 'dashOperacional', 'dashCrm', 'dashGerencial', 'kanban', 'leads', 'aulas', 'visitas', 'settings', 'profile', 'billing', 'superadmin']) {
      expect(canOpenScreen(professor, id), id).toBe(false);
    }
  });

  it('gestor e consultor passam em toda tela: as travas de gestor continuam no routes.js', () => {
    for (const id of telas) {
      expect(canOpenScreen(gestor, id), id).toBe(true);
      expect(canOpenScreen(consultor, id), id).toBe(true);
    }
  });

  it('sem usuário passa: quem decide o login é o routeDecision', () => {
    expect(canOpenScreen(null, 'kanban')).toBe(true);
  });

  it('id que não é tela fica fora para o professor', () => {
    expect(canOpenScreen(professor, 'constructor')).toBe(false);
    expect(canOpenScreen(professor, undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Escrever a varredura de import**

Criar `src/lib/__tests__/acessoImports.test.js`. O leitor é o mesmo do `guardianImports.test.js`: tira os comentários antes de procurar e pega import multilinha, `export ... from` e `import()`.

```js
// acesso.js (o que cada papel faz) e modules.js (os módulos da academia) rodam
// também dentro da api/, nas funções da Vercel, que usam o SDK de servidor e
// não podem puxar pacote nem módulo do navegador. Os dois ficam sem import
// nenhum: assim a api/ lê os mesmos textos de papel e de módulo que o app, e
// nenhum ciclo de import pode nascer deles. Esta varredura trava isso.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// O mesmo leitor do guardianImports.test.js. Pega `import ... from '...'` e
// `export ... from '...'` (grupo 1, inclusive multilinha e export * from) e
// `import('...')` estático ou dinâmico (grupo 2). Os comentários saem antes:
// a palavra "import" solta num comentário casaria com o regex e esticaria até
// o próximo "from '...'" de verdade.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Remove bloco /* */, linha inteira de comentário e comentário de fim de
// linha. O guard antes de `//` evita apagar um `https://` dentro de string.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const ler = (nome) => readFileSync(fileURLToPath(new URL(`../${nome}`, import.meta.url)), 'utf8');

describe('acesso.js e modules.js não importam nada', () => {
  for (const nome of ['acesso.js', 'modules.js']) {
    it(`${nome} não tem import nem export ... from`, () => {
      expect(specifiersOf(ler(nome))).toEqual([]);
    });
  }

  // Autoteste: o leitor enxerga as formas de import, para o teste de cima não
  // passar por estar cego.
  it('o leitor enxerga import multilinha, import só de efeito, export * e import() dinâmico', () => {
    const amostra = `
// Comentário que fala em import: não conta.
import {
  a,
} from './leads.js';
import './side.js';
export * from './re.js';
const x = await import('./dyn.js');
const y = 'https://exemplo.com.br'; // comentário de fim de linha com import
`;
    expect(specifiersOf(amostra)).toEqual(['./leads.js', './side.js', './re.js', './dyn.js']);
  });

  it('comentário que fala em "sem import" não conta como import', () => {
    const amostra = `
// Arquivo puro e sem import: a api/ usa este arquivo direto.
/* Nada de import from './firebase.js' aqui. */
export const A = 1;
`;
    expect(specifiersOf(amostra)).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/acesso.test.js src/lib/__tests__/acessoImports.test.js`
Expected: FAIL com `Test Files  2 failed (2)` e `Tests  1 failed | 3 passed (4)`. O `acesso.test.js` não carrega (`Error: Cannot find module '../acesso.js'`). No `acessoImports.test.js`, falha só "acesso.js não tem import nem export ... from", com `ENOENT` no `src/lib/acesso.js`. O teste do `modules.js` e os dois autotestes do leitor já passam.

- [ ] **Step 4: Criar a lista**

Criar `src/lib/acesso.js`:

```js
// Lista única do que cada papel pode fazer no Stronilead. Toda tela e todo
// botão perguntam aqui, em vez de comparar o papel do cadastro na mão. O
// acessoSweep.test.js reprova comparar `role` com o texto de um papel fora
// deste arquivo.
//
// Puro e sem import nenhum, de propósito: a api/ também lê este arquivo
// (cadastro e agendamento pelo Stronizap), e as regras do Firestore repetem
// a trava do professor em firestore.rules.
//
// Quando os perfis editáveis vierem, a tabela PERMISSOES sai do código e
// passa a ser lida da academia. As telas continuam perguntando do mesmo jeito.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md

// Valores gravados em stronix_users.role.
export const ROLES = Object.freeze({
  GESTOR: 'admin',
  CONSULTOR: 'consultant',
  PROFESSOR: 'professor',
});

// Papel do cadastro. A comparação é exata, igual à das regras do Firestore.
// Sem papel, ou com um papel que não existe ('consultor' de cadastro antigo,
// 'superadmin' da sessão do super-admin puro), vale consultor: é o que o app
// sempre fez com quem não era gestor.
export function roleOf(user) {
  const role = user?.role;
  if (role === ROLES.GESTOR) return ROLES.GESTOR;
  if (role === ROLES.PROFESSOR) return ROLES.PROFESSOR;
  return ROLES.CONSULTOR;
}

export const isGestor = (user) => roleOf(user) === ROLES.GESTOR;
export const isProfessor = (user) => roleOf(user) === ROLES.PROFESSOR;

// Quem vende: gestor e consultor. Decide quem aparece na escolha de consultor
// responsável, nos rankings, na Meta da equipe e nos painéis por pessoa. O
// professor não é dono de lead, não conta em venda e não ocupa vaga de
// consultor.
export const isSeller = (user) => !!user && !isProfessor(user);

// Nome do papel na tela.
export const ROLE_LABELS = Object.freeze({
  [ROLES.GESTOR]: 'Gestor',
  [ROLES.CONSULTOR]: 'Consultor',
  [ROLES.PROFESSOR]: 'Professor',
});
export const roleLabel = (user) => ROLE_LABELS[roleOf(user)];

// Ações que dependem do papel. O nome é o que vai para a tabela de perfis
// quando ela sair do código, então não muda.
export const ACTIONS = Object.freeze({
  LEAD_CRIAR: 'lead.criar',
  CADASTRO_EDITAR: 'cadastro.editar',
  FICHA_MUDAR_FASE: 'ficha.mudarFase',
  CONTRATO_EDITAR: 'contrato.editar',
  INDICACAO_CADASTRAR: 'indicacao.cadastrar',
  CLIENTES_EXPORTAR: 'clientes.exportar',
  LEADS_VER: 'leads.ver',
  SINO_EQUIPE: 'sino.equipe',
  SUPORTE_ABRIR: 'suporte.abrir',
});

const TODAS = Object.freeze(Object.values(ACTIONS));

// O que cada papel faz. Gestor e consultor fazem tudo o que está aqui, porque
// é assim hoje: desde a PR #193 o consultor edita cadastro e vende igual ao
// gestor. O que é só do gestor (Configurações, excluir lead, Meta da equipe,
// filtro de responsável) continua no isGestor e na trava `gestor` das telas
// (src/lib/routes.js). O professor não faz nenhuma: na ficha ele registra
// anotação, WhatsApp, ligação e agendamento, que não passam por esta lista.
//
// `can` olha só o papel. Ter login (authUid, canEditLead em leads.js)
// continua sendo conferido à parte.
const PERMISSOES = Object.freeze({
  [ROLES.GESTOR]: TODAS,
  [ROLES.CONSULTOR]: TODAS,
  [ROLES.PROFESSOR]: Object.freeze([]),
});

export function can(user, action) {
  if (!user) return false;
  return PERMISSOES[roleOf(user)].includes(action);
}

// Telas que o professor abre (ids de SCREENS, em src/lib/routes.js). As
// outras mostram "Essa tela não está liberada para o seu acesso." e levam à
// Meta diária.
export const PROFESSOR_SCREENS = Object.freeze(['dailyGoal', 'clientes', 'ficha']);

// Gestor e consultor passam aqui em toda tela: as travas de gestor e de
// super-admin da tabela SCREENS continuam valendo no canAccess, como hoje.
export function canOpenScreen(user, screenId) {
  if (!isProfessor(user)) return true;
  return PROFESSOR_SCREENS.includes(screenId);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/acesso.test.js src/lib/__tests__/acessoImports.test.js src/lib/__tests__/modules.test.js`
Expected: PASS. Nos dois arquivos novos, `src/lib/__tests__/acesso.test.js (23 tests)` e `src/lib/__tests__/acessoImports.test.js (4 tests)`. O `modules.test.js` da Task 1 continua verde. O `acesso.test.js` importa `SCREENS` de `routes.js`, que nesta altura ainda importa `isAdminUser` de `leads.js`. Não há ciclo, porque `acesso.js` não importa nada.

- [ ] **Step 6: Lint dos arquivos novos**

Run: `npx eslint src/lib/acesso.js src/lib/__tests__/acesso.test.js src/lib/__tests__/acessoImports.test.js`
Expected: nenhuma saída. Nada importa `acesso.js` por enquanto. As Tasks 3 a 11 passam a usá-lo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/acesso.js src/lib/__tests__/acesso.test.js src/lib/__tests__/acessoImports.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: lista única do que cada papel pode fazer (acesso.js)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Módulos no login (`src/App.jsx`, só o login)

**Files:**
- Modify: `src/App.jsx:68` (um import novo logo depois desta linha), `src/App.jsx:477-483` (a leitura de `tenants/{id}`) e os quatro `setAppUser({` do login: `src/App.jsx:543-552`, `src/App.jsx:565`, `src/App.jsx:588-597` e `src/App.jsx:610-619`
- Test: `src/lib/__tests__/tenantModulesWiring.test.js` (novo)

Notas:
- Depende da Task 1 (`src/lib/modules.js`).
- Decisão D10: a lista vai no `appUser.tenantModules`. Não existe variável `tenantModules` no escopo do `App` nem prop `modules` no `SettingsView`. Toda tela pergunta com `hasModule(appUser?.tenantModules, MODULES.FALTOSOS)`.
- Por que no `appUser`: o "Acessar como" (`SuperConsole.jsx:1149`, `SuperAdminView.jsx:79` e a volta em `App.jsx:1300`) chama o `signInWithCustomToken`, que roda este listener de novo, relê `tenants/{academia nova}` e monta outro `appUser`. Os estados do documento da academia (`tenantBlock` e os outros) são gravados antes do `setAppUser`, e um estado à parte para os módulos abriria uma janela com a pessoa de uma academia e os módulos de outra. No mesmo `setAppUser` a troca é de uma vez.
- A leitura fecha quando falta: documento ausente ou leitura que falhou dão `[]`. O bloqueio continua abrindo na falha, como sempre.
- O campo vem depois do `...userDoc.data()`, então um `tenantModules` gravado no cadastro da pessoa nunca vale.
- Esta task só mexe no listener do login e na linha de import nova. Se a Task 7 precisar de `MODULES` e `hasModule` no `App.jsx` (o aviso da decisão D1), ela troca esta linha por `import { MODULES, hasModule, normalizeModules } from './lib/modules.js';` em vez de abrir um segundo import do mesmo arquivo. O teste desta task aceita as duas formas.

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/__tests__/tenantModulesWiring.test.js`:

```js
// O app lê os módulos da academia no login, junto com o documento
// tenants/{id} que ele já lê para o bloqueio, e os guarda no appUser
// (tenantModules). É o appUser que toda tela recebe, e é ele que o "Acessar
// como" troca inteiro quando entra ou sai de outra academia sem recarregar a
// página: o signInWithCustomToken dispara o onAuthStateChanged, que relê o
// documento da academia nova. Guardar os módulos num estado à parte deixaria
// uma janela com o appUser de uma academia e os módulos de outra. Este teste
// cobra que todo appUser montado no login leva o campo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');

// O objeto literal de cada setAppUser({ ... }), pelas chaves balanceadas.
function objetosDoSetAppUser(fonte) {
  const achados = [];
  let i = fonte.indexOf('setAppUser({');
  while (i !== -1) {
    const inicio = i + 'setAppUser('.length;
    let fundo = 0;
    let j = inicio;
    for (; j < fonte.length; j++) {
      if (fonte[j] === '{') fundo++;
      else if (fonte[j] === '}' && --fundo === 0) break;
    }
    achados.push(fonte.slice(inicio, j + 1));
    i = fonte.indexOf('setAppUser({', j);
  }
  return achados;
}

describe('módulos da academia no appUser', () => {
  const objetos = objetosDoSetAppUser(app);

  it('acha os appUser montados no login', () => {
    // Membro achado pelo uid, membro achado pelo e-mail e as duas sessões só
    // de super-admin.
    expect(objetos.length).toBeGreaterThanOrEqual(4);
  });

  it('todo appUser montado no login leva tenantModules', () => {
    for (const o of objetos) expect(o, o.slice(0, 80)).toMatch(/\btenantModules\b/);
  });

  it('o módulo vem da academia, nunca do cadastro da pessoa: o campo fica depois do ...userDoc.data()', () => {
    const comCadastro = objetos.filter((o) => o.includes('...userDoc.data()'));
    expect(comCadastro).toHaveLength(2);
    for (const o of comCadastro) expect(o.indexOf('tenantModules')).toBeGreaterThan(o.indexOf('...userDoc.data()'));
  });

  it('a lista sai do documento da academia, pela normalizeModules', () => {
    expect(app).toMatch(/import \{[^}]*\bnormalizeModules\b[^}]*\} from '\.\/lib\/modules\.js';/);
    expect(app).toMatch(/tenantModules\s*=\s*normalizeModules\(\s*tData\?\.modules\s*\)/);
  });

  it('a falta fecha: a lista nasce vazia antes da leitura, e a leitura que falha não a preenche', () => {
    // O trecho do login, do onAuthStateChanged até o unsubscribe.
    const inicio = app.indexOf('onAuthStateChanged(auth');
    const login = app.slice(inicio, app.indexOf('return () => unsubscribe();', inicio));
    const declaracao = login.indexOf('let tenantModules = [];');
    const leitura = login.indexOf("getDoc(doc(db, 'tenants', tenantId))");
    expect(declaracao).toBeGreaterThan(-1);
    expect(leitura).toBeGreaterThan(declaracao);
    expect(login.indexOf('setAppUser({')).toBeGreaterThan(declaracao);
    // A declaração e uma atribuição só, a da leitura que deu certo. O catch da
    // leitura não mexe na lista.
    expect(login.match(/\btenantModules\s*=(?!=)/g)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/tenantModulesWiring.test.js`
Expected: FAIL, `Tests  4 failed | 1 passed (5)`. Só "acha os appUser montados no login" passa (são 4 objetos hoje). Os outros falham porque nenhum objeto tem `tenantModules`, o import não existe e `let tenantModules = [];` não é achado (`expected -1 to be greater than -1`).

- [ ] **Step 3: Implementar**

Em `src/App.jsx`, logo depois da linha 68:

```js
import { IDLE_RUN, runStatusFor, settleRun, EMPTY_SETUP_FLAGS, setupFlagsFromConfig, setupFlagFor } from './lib/setupRun.js';
```

acrescentar:

```js
import { normalizeModules } from './lib/modules.js';
```

Trocar as linhas 477 a 483:

```js
      // Status da academia (suspensão / trial expirado). Best-effort: se o doc
      // /tenants/{id} não existir (tenant legado) ou a leitura falhar, libera o
      // acesso. Super-admin sem tenant não tem o que checar.
      if (tenantId) {
        try {
          const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
          const tData = tenantSnap.exists() ? tenantSnap.data() : null;
```

por:

```js
      // Status da academia (suspensão / trial expirado). Best-effort: se o doc
      // /tenants/{id} não existir (tenant legado) ou a leitura falhar, libera o
      // acesso. Super-admin sem tenant não tem o que checar.
      // Os módulos da academia (src/lib/modules.js) saem do mesmo documento e
      // vão para o appUser (tenantModules), que o "Acessar como" troca inteiro:
      // o signInWithCustomToken roda este listener de novo, que relê a academia
      // nova. Ao contrário do bloqueio, aqui a falta fecha: documento ausente
      // ou leitura que falhou dão lista vazia.
      let tenantModules = [];
      if (tenantId) {
        try {
          const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
          const tData = tenantSnap.exists() ? tenantSnap.data() : null;
          tenantModules = normalizeModules(tData?.modules);
```

Super-admin sem academia (linhas 543 a 552). Trocar:

```js
        setAppUser({
          id: currentUser.uid,
          authUid: currentUser.uid,
          name: (normalizedEmail || 'Super-admin').split('@')[0],
          email: normalizedEmail,
          role: 'superadmin',
          superAdmin: true,
          superAdminOnly: true,
          tenantId: null
        });
```

por:

```js
        setAppUser({
          id: currentUser.uid,
          authUid: currentUser.uid,
          name: (normalizedEmail || 'Super-admin').split('@')[0],
          email: normalizedEmail,
          role: 'superadmin',
          superAdmin: true,
          superAdminOnly: true,
          tenantId: null,
          tenantModules: []
        });
```

Membro achado pelo uid, que também é a sessão do "Acessar como" (linha 565). Trocar:

```js
        setAppUser({ id: userDoc.id, ...userDoc.data(), tenantId: appId, superAdmin, impersonating: !!impersonatedBy, impersonatedTenant });
```

por:

```js
        setAppUser({ id: userDoc.id, ...userDoc.data(), tenantId: appId, superAdmin, impersonating: !!impersonatedBy, impersonatedTenant, tenantModules });
```

Membro achado pelo e-mail, o vínculo legado (linhas 588 a 597). Trocar:

```js
          setAppUser({
            id: userDoc.id,
            ...userDoc.data(),
            authUid: currentUser.uid,
            email: normalizedEmail,
            tenantId: appId,
            superAdmin,
            impersonating: !!impersonatedBy,
            impersonatedTenant
          });
```

por:

```js
          setAppUser({
            id: userDoc.id,
            ...userDoc.data(),
            authUid: currentUser.uid,
            email: normalizedEmail,
            tenantId: appId,
            superAdmin,
            impersonating: !!impersonatedBy,
            impersonatedTenant,
            tenantModules
          });
```

Super-admin puro (linhas 610 a 619). Trocar:

```js
        setAppUser({
          id: currentUser.uid,
          authUid: currentUser.uid,
          name: fallbackName,
          email: normalizedEmail,
          role: 'superadmin',
          superAdmin: true,
          superAdminOnly: true,
          tenantId: null
        });
```

por:

```js
        setAppUser({
          id: currentUser.uid,
          authUid: currentUser.uid,
          name: fallbackName,
          email: normalizedEmail,
          role: 'superadmin',
          superAdmin: true,
          superAdminOnly: true,
          tenantId: null,
          tenantModules: []
        });
```

Nada mais muda no listener: o `catch (statusErr)` continua igual e deixa a lista vazia, e nenhum effect novo nasce.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/tenantModulesWiring.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  13 passed (13)` (5 deste teste e 8 da varredura de proteção, que também lê o `App.jsx`).

Run: `npx eslint src/App.jsx src/lib/__tests__/tenantModulesWiring.test.js`
Expected: nenhuma saída.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/lib/__tests__/tenantModulesWiring.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: app lê os módulos da academia no login e guarda no appUser" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Chave "Professor e faltosos" no super console (`api/tenant-status.js`, `api/super-overview.js`, `src/views/console/`)

**Files:**
- Modify: `api/tenant-status.js:6` (import novo logo depois), `:14` (comentário do corpo), `:89-90` (GET), `:109-113` (corpo do POST), `:162-165` (validação e gravação), `:244-247` (auditoria)
- Modify: `api/super-overview.js:5` (imports novos logo depois), `:43-52` (contagens), `:65` (módulos), `:85-87` (retorno)
- Create: `src/views/console/TenantModulesCard.jsx`
- Modify: `src/views/console/SuperConsole.jsx:10` (import), `:1150-1152` (`saveModules` depois do `enterAs`), `:1166-1171` (linha de professores no uso), `:1246-1251` (o cartão na coluna da esquerda)
- Test: `api/__tests__/tenantStatusModules.test.js` (novo), `api/__tests__/superOverviewProfessores.test.js` (novo), `src/lib/__tests__/tenantModulesCard.test.js` (novo)

Notas:
- Depende da Task 1 (`modules.js`) e da Task 2 (`ROLES`, em `src/lib/acesso.js`, que o `super-overview.js` importa).
- O GET do `tenant-status` lê `professors` e `modules` do `getSeatUsage`, que a Task 5 reescreve. Até lá, os dois chegam como `0` e `[]` e a linha de professores do console não aparece. O teste desta task usa um `getSeatUsage` falso e cobre os dois casos.
- A gravação do módulo passa só pela `api/tenant-status.js`, que já grava `internal` e `monthlyPrice`: nada de função nova na Vercel (continuam 11 de 12). O `set` com merge troca a lista inteira, então o cartão sempre manda a lista completa. Ligar ou desligar não mexe no `status` e não derruba sessão de ninguém.
- O `super-overview.js` passa a contar o professor à parte, como o `getSeatUsage` da Task 5: sem isso o MRR do console cobraria professor como consultor extra (`effectivePrice`, linha 84).
- O cartão segue o visual do console (classes de `src/views/console/console.css`: `.card`, `.sw`, `.on`, `.partial`), como a chave "Conta interna" do Nova academia (`SuperConsole.jsx:762`). O console é uma tela escura própria, sem os tokens nem os componentes shadcn do app, então um Switch do shadcn ficaria fora do visual dele. A chave é um `<button role="switch">`, acessível pelo teclado, e o `cn()` monta as classes.
- Desligar o módulo com professor de login pede confirmação, porque pela decisão D1 esses professores passam a ver só o aviso de acesso desligado (tela da Task 7, regras da Task 11).

- [ ] **Step 1: Escrever o teste da rota**

Criar `api/__tests__/tenantStatusModules.test.js`:

```js
// Módulos da academia pela api/tenant-status.js. O super-admin liga e desliga
// no console, a rota confere a lista contra src/lib/modules.js e grava em
// tenants/{id}.modules. O app lê o campo no login e as regras leem pela
// hasModule, então o que passa daqui é o que vale em todo lugar. O GET da
// mesma rota leva ao console os professores e os módulos das vagas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-status.js';

const banco = vi.hoisted(() => ({ tenants: {}, gravacoes: [], auditoria: [], sessao: null, vagas: {} }));
const contas = vi.hoisted(() => ({ revokeRefreshTokens: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
    get: async () => {
      const dados = caminho[0] === 'tenants' && caminho.length === 2 ? banco.tenants[caminho[1]] : undefined;
      return { id: caminho.at(-1), exists: dados != null, data: () => dados };
    },
    set: async (dados, opcoes) => { banco.gravacoes.push({ caminho: caminho.join('/'), dados, opcoes }); },
  });
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora', delete: () => 'apagar' } } },
    verifyRequest: async () => banco.sessao,
  };
});
vi.mock('../_audit.js', () => ({ logAudit: async (entrada) => { banco.auditoria.push(entrada); } }));
vi.mock('../_plans.js', () => ({ loadPlans: async () => new Map(), getSeatUsage: async () => banco.vagas }));
vi.mock('../_tenantPrivate.js', () => ({ writeTenantPrivate: async () => [] }));

const SUPER = { uid: 'super-1', superAdmin: true };
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const enviar = async (body) => {
  const res = resposta();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, res);
  return res;
};
const consultar = async (tenantId) => {
  const res = resposta();
  await handler({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { tenantId } }, res);
  return res;
};
const gravado = () => banco.gravacoes.find((g) => g.caminho === 'tenants/stronix-crm-app')?.dados;
const RECUSA = 'Módulo inválido. Os módulos que existem são: faltosos.';

beforeEach(() => {
  banco.tenants = { 'stronix-crm-app': { displayName: 'STRONIX', status: 'active' } };
  banco.gravacoes = [];
  banco.auditoria = [];
  banco.sessao = SUPER;
  banco.vagas = {};
  contas.revokeRefreshTokens.mockReset();
});

describe('POST /api/tenant-status: módulos da academia', () => {
  it('liga o módulo: grava a lista em merge no documento da academia', async () => {
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos'] });
    expect(res.statusCode).toBe(200);
    expect(banco.gravacoes).toHaveLength(1);
    expect(banco.gravacoes[0]).toMatchObject({ caminho: 'tenants/stronix-crm-app', opcoes: { merge: true } });
    expect(gravado().modules).toEqual(['faltosos']);
  });

  it('desliga com a lista vazia', async () => {
    banco.tenants['stronix-crm-app'].modules = ['faltosos'];
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: [] });
    expect(res.statusCode).toBe(200);
    expect(gravado().modules).toEqual([]);
  });

  it('módulo repetido é gravado uma vez', async () => {
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos', 'faltosos'] });
    expect(res.statusCode).toBe(200);
    expect(gravado().modules).toEqual(['faltosos']);
  });

  it('módulo desconhecido, caixa diferente ou item que não é texto: 400 e nada gravado', async () => {
    for (const modules of [['catraca'], ['Faltosos'], [' faltosos'], ['faltosos', 1], ['faltosos', null]]) {
      const res = await enviar({ tenantId: 'stronix-crm-app', modules });
      expect(res.statusCode, JSON.stringify(modules)).toBe(400);
      expect(res.body.error).toBe(RECUSA);
    }
    expect(banco.gravacoes).toEqual([]);
    expect(banco.auditoria).toEqual([]);
  });

  it('modules que não é lista: 400 e nada gravado', async () => {
    for (const modules of ['faltosos', null, { faltosos: true }, 1, true]) {
      const res = await enviar({ tenantId: 'stronix-crm-app', modules });
      expect(res.statusCode, JSON.stringify(modules)).toBe(400);
      expect(res.body.error).toBe(RECUSA);
    }
    expect(banco.gravacoes).toEqual([]);
  });

  it('só o super-admin liga módulo: o gestor da academia recebe 403', async () => {
    banco.sessao = { uid: 'gestor-1', tenantId: 'stronix-crm-app', superAdmin: false };
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos'] });
    expect(res.statusCode).toBe(403);
    expect(banco.gravacoes).toEqual([]);
  });

  it('pedido sem modules não mexe no campo', async () => {
    banco.tenants['stronix-crm-app'].modules = ['faltosos'];
    const res = await enviar({ tenantId: 'stronix-crm-app', internal: true });
    expect(res.statusCode).toBe(200);
    expect('modules' in gravado()).toBe(false);
    expect(banco.auditoria[0].details).toEqual({ changed: ['internal'] });
  });

  it('a auditoria guarda a lista de antes e a de depois', async () => {
    banco.tenants['stronix-crm-app'].modules = ['faltosos'];
    await enviar({ tenantId: 'stronix-crm-app', modules: [] });
    expect(banco.auditoria).toHaveLength(1);
    expect(banco.auditoria[0]).toMatchObject({ action: 'tenant.update', tenantId: 'stronix-crm-app', actorUid: 'super-1' });
    expect(banco.auditoria[0].details).toEqual({ changed: ['modules'], modules: [], modulesBefore: ['faltosos'] });
  });

  it('ligar o módulo não derruba a sessão de ninguém', async () => {
    await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos'] });
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });
});

describe('GET /api/tenant-status: professores e módulos', () => {
  it('leva ao console os professores, fora das vagas, e os módulos', async () => {
    banco.vagas = {
      plan: 'starter', currentUsers: 6, maxUsers: 4, managers: 1, consultants: 3, professors: 2,
      modules: ['faltosos'], maxManagers: 1, maxConsultants: 3, extraConsultants: 0, extraUserPrice: null,
    };
    const res = await consultar('stronix-crm-app');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ userCount: 6, managers: 1, consultants: 3, professors: 2, modules: ['faltosos'] });
  });

  it('vagas sem a contagem de professores e sem módulos: zero e lista vazia', async () => {
    banco.vagas = { plan: 'starter', currentUsers: 2, maxUsers: 4, managers: 1, consultants: 1 };
    const res = await consultar('stronix-crm-app');
    expect(res.statusCode).toBe(200);
    expect(res.body.professors).toBe(0);
    expect(res.body.modules).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/tenantStatusModules.test.js`
Expected: FAIL, `Tests  8 failed | 3 passed (11)`. Um corpo só com `modules` hoje cai em `400 'Nada para atualizar.'` (então "liga", "desliga", "repetido" e "auditoria" recebem 400, e as recusas recebem a mensagem errada), e o GET não traz `professors` nem `modules`. Já passam o 403, o "pedido sem modules" e o "não derruba a sessão".

- [ ] **Step 3: Implementar a rota**

Em `api/tenant-status.js`, logo depois da linha 6:

```js
import { withSentry } from './_sentry.js';
```

acrescentar:

```js
import { KNOWN_MODULES, normalizeModules } from '../src/lib/modules.js';
```

Logo depois da linha 14:

```js
//   - archived, internal, internalNotes, monthlyPrice  (já existiam)
```

acrescentar:

```js
//   - modules: string[]  (módulos da academia, só os de src/lib/modules.js;
//     a lista inteira substitui a anterior)
```

No GET, trocar as linhas 89 e 90:

```js
        managers: seats.managers,
        consultants: seats.consultants,
```

por:

```js
        managers: seats.managers,
        consultants: seats.consultants,
        // Professor fica fora das vagas do plano (getSeatUsage, em api/_plans.js).
        professors: seats.professors || 0,
        modules: normalizeModules(seats.modules),
```

Trocar as linhas 109 a 113:

```js
    const {
      tenantId, status, plan, trialDays, archived, internal, internalNotes, monthlyPrice,
      displayName, settings, paymentStatus, lastPaymentAt, nextBillingAt,
      profile, responsiblePhone,
    } = req.body || {};
```

por:

```js
    const {
      tenantId, status, plan, trialDays, archived, internal, internalNotes, monthlyPrice,
      displayName, settings, paymentStatus, lastPaymentAt, nextBillingAt,
      profile, responsiblePhone, modules,
    } = req.body || {};
```

Trocar as linhas 162 a 165:

```js
    // Conta interna/teste: fica fora dos KPIs de negócio. Não muda acesso/status.
    if (internal !== undefined) {
      update.internal = internal === true;
    }
```

por:

```js
    // Conta interna/teste: fica fora dos KPIs de negócio. Não muda acesso/status.
    if (internal !== undefined) {
      update.internal = internal === true;
    }
    // Módulos da academia (src/lib/modules.js). A lista inteira substitui a
    // anterior, porque o set com merge troca listas inteiras: ligar é mandar a
    // lista com o módulo, desligar é mandar sem ele. Só passa módulo conhecido,
    // escrito exatamente como em MODULES. O app lê no login (App.jsx) e as
    // regras leem pela hasModule. Não mexe no status, então ninguém é deslogado.
    if (modules !== undefined) {
      if (!Array.isArray(modules) || modules.some((m) => !KNOWN_MODULES.includes(m))) {
        return res.status(400).json({ error: `Módulo inválido. Os módulos que existem são: ${KNOWN_MODULES.join(', ')}.` });
      }
      update.modules = normalizeModules(modules);
    }
```

Trocar as linhas 244 a 247:

```js
    await logAudit({
      action: 'tenant.update', tenantId: slug, actorUid: auth.uid,
      details: { changed: [...Object.keys(update).filter((k) => k !== 'updatedAt'), ...privateChanged] },
    });
```

por:

```js
    await logAudit({
      action: 'tenant.update', tenantId: slug, actorUid: auth.uid,
      details: {
        changed: [...Object.keys(update).filter((k) => k !== 'updatedAt'), ...privateChanged],
        // O "changed" só diz que a lista mudou. Antes e depois dizem o que foi
        // ligado ou desligado.
        ...(update.modules ? { modules: update.modules, modulesBefore: normalizeModules(existing.data()?.modules) } : {}),
      },
    });
```

O rótulo do log no console (`auditActionLabel`, `src/lib/superadmin.js:55-58`) e o `detailStr` do `SuperConsole.jsx` leem o `changed` e mostram "Atualizou stronix-crm-app (modules)" sem mudança.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/tenantStatusModules.test.js`
Expected: PASS, `Tests  11 passed (11)`.

- [ ] **Step 5: Escrever o teste da lista do console**

Criar `api/__tests__/superOverviewProfessores.test.js`:

```js
// A lista de academias do super console (api/super-overview.js). Ela leva os
// módulos de cada academia, para o cartão Módulos mostrar a chave certa, e
// conta o professor à parte: professor não ocupa vaga de consultor e não entra
// no preço dos consultores extras, que vira o MRR do console. É a mesma conta
// do getSeatUsage (api/_plans.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../super-overview.js';

const banco = vi.hoisted(() => ({ tenants: {}, equipe: {} }));
const precos = vi.hoisted(() => ({ effectivePrice: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    orderBy: () => ref(caminho, filtro),
    limit: () => ref(caminho, filtro),
    count: () => ({
      get: async () => {
        // artifacts/{academia}/public/data/{coleção}
        const [, academia, , , colecao] = caminho;
        const lista = colecao === 'stronix_users' ? (banco.equipe[academia] || []) : [];
        const n = filtro ? lista.filter((u) => u[filtro.campo] === filtro.valor).length : lista.length;
        return { data: () => ({ count: n }) };
      },
    }),
    get: async () => {
      if (caminho.length === 1 && caminho[0] === 'tenants') {
        return { docs: Object.entries(banco.tenants).map(([id, dados]) => ({ id, data: () => dados })) };
      }
      return { empty: true, docs: [] };
    },
  });
  return { adminDb: ref([]), verifyRequest: async () => ({ uid: 'super-1', superAdmin: true }) };
});
vi.mock('../_plans.js', () => ({ loadPlans: async () => new Map(), effectivePrice: precos.effectivePrice }));
vi.mock('../_asaas.js', () => ({ isAsaasConfigured: () => false }));
vi.mock('../_tenantPrivate.js', () => ({ readTenantPrivate: async () => ({ profile: null, responsiblePhone: '' }) }));

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const consultar = async () => {
  const res = resposta();
  await handler({ method: 'GET', headers: { authorization: 'Bearer x' } }, res);
  return res;
};
const academia = (res, id) => res.body.tenants.find((t) => t.id === id);

describe('GET /api/super-overview: professores e módulos', () => {
  beforeEach(() => {
    banco.tenants = {};
    banco.equipe = {};
    precos.effectivePrice.mockReset();
    precos.effectivePrice.mockImplementation(({ consultantCount }) => 100 + consultantCount * 10);
  });

  it('professor fica fora dos consultores e do preço dos extras', async () => {
    banco.tenants['stronix-crm-app'] = { displayName: 'STRONIX', status: 'active', plan: 'starter', modules: ['faltosos'] };
    // Um gestor, dois consultores, um cadastro antigo sem papel (conta como
    // consultor) e dois professores.
    banco.equipe['stronix-crm-app'] = [
      { role: 'admin' }, { role: 'consultant' }, { role: 'consultant' }, {},
      { role: 'professor' }, { role: 'professor' },
    ];
    const res = await consultar();
    expect(res.statusCode).toBe(200);
    expect(academia(res, 'stronix-crm-app')).toMatchObject({
      userCount: 6, managerCount: 1, professorCount: 2, consultantCount: 3, price: 130,
    });
    expect(precos.effectivePrice).toHaveBeenCalledWith(expect.objectContaining({ consultantCount: 3 }), expect.any(Map));
  });

  it('academia sem professor: a conta de antes', async () => {
    banco.tenants['shape-one'] = { displayName: 'Shape One', status: 'active', plan: 'starter' };
    banco.equipe['shape-one'] = [{ role: 'admin' }, { role: 'consultant' }];
    const res = await consultar();
    expect(academia(res, 'shape-one')).toMatchObject({ userCount: 2, managerCount: 1, professorCount: 0, consultantCount: 1 });
  });

  it('os módulos vão normalizados para o console', async () => {
    banco.tenants['stronix-crm-app'] = { displayName: 'STRONIX', modules: ['catraca', 'faltosos', 'faltosos'] };
    banco.tenants['shape-one'] = { displayName: 'Shape One' };
    banco.tenants['power-club'] = { displayName: 'Power Club', modules: 'faltosos' };
    const res = await consultar();
    expect(academia(res, 'stronix-crm-app').modules).toEqual(['faltosos']);
    expect(academia(res, 'shape-one').modules).toEqual([]);
    expect(academia(res, 'power-club').modules).toEqual([]);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/superOverviewProfessores.test.js`
Expected: FAIL, `Tests  3 failed (3)`. Hoje o `consultantCount` da STRONIX dá 5 (6 menos 1 gestor, com os dois professores dentro), o preço dá 150, não existe `professorCount` e `modules` vem `undefined`.

- [ ] **Step 7: Implementar a lista do console**

Em `api/super-overview.js`, logo depois da linha 5:

```js
import { withSentry } from './_sentry.js';
```

acrescentar:

```js
import { ROLES } from '../src/lib/acesso.js';
import { normalizeModules } from '../src/lib/modules.js';
```

Trocar as linhas 43 a 52:

```js
  const [userCount, managerCount, leadCount, interactionCount, lastInteractionMs, priv] = await Promise.all([
    countOr(dataCol(id, 'stronix_users')),
    countOr(dataCol(id, 'stronix_users').where('role', '==', 'admin')),
    countOr(dataCol(id, 'stronix_leads')),
    countOr(dataCol(id, 'stronix_interactions')),
    lastInteractionMillis(id),
    // Perfil e WhatsApp do responsável vivem no subdocumento privado.
    readTenantPrivate(id, data),
  ]);
  const consultantCount = Math.max(0, userCount - managerCount);
```

por:

```js
  const [userCount, managerCount, professorCount, leadCount, interactionCount, lastInteractionMs, priv] = await Promise.all([
    countOr(dataCol(id, 'stronix_users')),
    countOr(dataCol(id, 'stronix_users').where('role', '==', ROLES.GESTOR)),
    countOr(dataCol(id, 'stronix_users').where('role', '==', ROLES.PROFESSOR)),
    countOr(dataCol(id, 'stronix_leads')),
    countOr(dataCol(id, 'stronix_interactions')),
    lastInteractionMillis(id),
    // Perfil e WhatsApp do responsável vivem no subdocumento privado.
    readTenantPrivate(id, data),
  ]);
  // Professor não ocupa vaga de consultor nem entra no preço dos extras (a
  // mesma conta do getSeatUsage, em api/_plans.js).
  const consultantCount = Math.max(0, userCount - managerCount - professorCount);
```

Logo depois da linha 65:

```js
    internal: data.internal === true, // conta interna/teste: fica na lista mas fora dos KPIs de negócio
```

acrescentar:

```js
    modules: normalizeModules(data.modules), // módulos ligados no console (src/lib/modules.js)
```

Trocar as linhas 86 e 87:

```js
    managerCount,
    consultantCount,
```

por:

```js
    managerCount,
    consultantCount,
    professorCount,
```

A contagem por `role == 'professor'` é de campo único, com o índice automático do Firestore: nada para publicar.

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run api/__tests__/superOverviewProfessores.test.js`
Expected: PASS, `Tests  3 passed (3)`.

- [ ] **Step 9: Escrever o teste do cartão**

Criar `src/lib/__tests__/tenantModulesCard.test.js`:

```js
// @vitest-environment jsdom
// A chave "Professor e faltosos" na página da academia do super console
// (TenantModulesCard). Ligar manda a lista com o módulo, desligar manda sem
// ele, desligar com professor de login pede confirmação, enquanto grava a
// chave fica travada, e a recusa da api aparece no cartão. Quem grava de
// verdade é o `save` que o Detail passa, pela api/tenant-status.js; aqui ele
// é um dublê.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { TenantModulesCard } from '../../views/console/TenantModulesCard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Lê o SuperConsole.jsx pelo caminho relativo a este teste. No jsdom o new URL
// resolve contra a base http do jsdom, então o caminho sai do import.meta.url
// como texto.
const AQUI = dirname(fileURLToPath(import.meta.url));

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(TenantModulesCard, props)); });
}
beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn(() => true));
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.unstubAllGlobals();
});
const chave = () => document.querySelector('[role="switch"]');
const clicar = async () => { await act(async () => { chave().click(); }); };

describe('TenantModulesCard', () => {
  it('academia sem o campo: a chave aparece desligada, com o nome do módulo', async () => {
    await montar({ tenant: { id: 'shape-one' }, save: vi.fn() });
    expect(document.body.textContent).toContain('Professor e faltosos');
    expect(chave().getAttribute('aria-checked')).toBe('false');
    expect(chave().getAttribute('aria-label')).toBe('Professor e faltosos');
  });

  it('ligar manda a lista com o faltosos, sem pedir confirmação', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: [] }, save });
    await clicar();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(['faltosos']);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('desligar sem professor de login manda a lista sem ele, sem pedir confirmação', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['faltosos'] }, save, professores: 0 });
    expect(chave().getAttribute('aria-checked')).toBe('true');
    await clicar();
    expect(save).toHaveBeenCalledWith([]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('desligar com professor de login pede confirmação, e o não deixa tudo como está', async () => {
    const save = vi.fn(async () => {});
    confirm.mockReturnValue(false);
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['faltosos'] }, save, professores: 3 });
    await clicar();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toBe('Desligar Professor e faltosos? Os 3 professores com login passam a ver só o aviso de acesso desligado, a partir do próximo login ou F5.');
    expect(save).not.toHaveBeenCalled();
    expect(chave().getAttribute('aria-checked')).toBe('true');
  });

  it('desligar com um professor só: a frase no singular, e o sim grava', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['faltosos'] }, save, professores: 1 });
    await clicar();
    expect(confirm.mock.calls[0][0]).toBe('Desligar Professor e faltosos? O professor com login passa a ver só o aviso de acesso desligado, a partir do próximo login ou F5.');
    expect(save).toHaveBeenCalledWith([]);
  });

  it('o que não é módulo conhecido não vai junto para a api', async () => {
    const save = vi.fn(async () => {});
    await montar({ tenant: { id: 'stronix-crm-app', modules: ['catraca', 7] }, save });
    expect(chave().getAttribute('aria-checked')).toBe('false');
    await clicar();
    expect(save).toHaveBeenCalledWith(['faltosos']);
  });

  it('enquanto grava, a chave fica travada e o segundo clique não grava de novo', async () => {
    let soltar;
    const save = vi.fn(() => new Promise((resolve) => { soltar = resolve; }));
    await montar({ tenant: { id: 'stronix-crm-app' }, save });
    await clicar();
    expect(chave().disabled).toBe(true);
    expect(document.body.textContent).toContain('salvando');
    await clicar();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { soltar(); });
    expect(chave().disabled).toBe(false);
    expect(document.body.textContent).not.toContain('salvando');
  });

  it('a recusa da api aparece no cartão e a chave volta a funcionar', async () => {
    const save = vi.fn(async () => { throw new Error('Módulo inválido. Os módulos que existem são: faltosos.'); });
    await montar({ tenant: { id: 'stronix-crm-app' }, save });
    await clicar();
    expect(document.querySelector('[role="alert"]').textContent).toBe('Módulo inválido. Os módulos que existem são: faltosos.');
    expect(chave().disabled).toBe(false);
  });
});

describe('o cartão na página da academia (SuperConsole.jsx)', () => {
  const fonte = readFileSync(join(AQUI, '../../views/console/SuperConsole.jsx'), 'utf8');

  it('o Detail monta o cartão com a gravação e os professores da academia', () => {
    expect(fonte).toMatch(/<TenantModulesCard tenant=\{t\} save=\{saveModules\} professores=\{stats\?\.professors \|\| 0\} \/>/);
  });

  it('a gravação vai para a api/tenant-status.js com a lista inteira e relê a lista do console', () => {
    const inicio = fonte.indexOf('const saveModules = async');
    expect(inicio).toBeGreaterThan(-1);
    const corpo = fonte.slice(inicio, fonte.indexOf('const [bg, fg] = tone(t.id);', inicio));
    expect(corpo).toContain("fetch('/api/tenant-status'");
    expect(corpo).toContain('JSON.stringify({ tenantId: t.id, modules })');
    expect(corpo).toMatch(/await reload\?\.\(\);/);
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/tenantModulesCard.test.js`
Expected: FAIL, `Failed to resolve import "../../views/console/TenantModulesCard.jsx"`, com `Tests  no tests`.

- [ ] **Step 11: Criar o cartão**

Criar `src/views/console/TenantModulesCard.jsx`:

```jsx
import { useState } from 'react';
import { cn } from '../../lib/utils.js';
import { MODULES, hasModule, normalizeModules } from '../../lib/modules.js';

// Módulos da academia, na página dela no super console. Cada chave liga ou
// desliga um módulo em tenants/{id}.modules. Quem grava é o `save` que o
// Detail passa (api/tenant-status.js, só o super-admin), e o cartão manda
// sempre a lista inteira. O app lê a lista no login, então a troca vale no
// próximo login ou F5 de cada pessoa da academia.
// O visual segue o do console (classes de console.css, como a chave "Conta
// interna" do Nova academia), e não os tokens do app.
const MODULE_ROWS = [
  {
    key: MODULES.FALTOSOS,
    title: 'Professor e faltosos',
    hint: 'Libera o papel Professor em Equipe & acessos. Vale no próximo login ou F5 de cada pessoa.',
  },
];

// Desligar o módulo com professor de login deixa essas pessoas só com o aviso
// de acesso desligado (o professor continua com o papel, sem tela nenhuma).
function confirmText(professores) {
  return professores === 1
    ? 'Desligar Professor e faltosos? O professor com login passa a ver só o aviso de acesso desligado, a partir do próximo login ou F5.'
    : `Desligar Professor e faltosos? Os ${professores} professores com login passam a ver só o aviso de acesso desligado, a partir do próximo login ou F5.`;
}

function TenantModulesCard({ tenant, save, professores = 0 }) {
  const ligados = normalizeModules(tenant?.modules);
  // Módulo sendo gravado agora. Enquanto há um, nenhuma chave aceita clique.
  const [salvando, setSalvando] = useState(null);
  const [erro, setErro] = useState('');

  const alternar = async (key) => {
    if (salvando) return;
    const ligado = hasModule(ligados, key);
    if (ligado && key === MODULES.FALTOSOS && professores > 0 && !window.confirm(confirmText(professores))) return;
    const proxima = ligado ? ligados.filter((m) => m !== key) : [...ligados, key];
    setSalvando(key);
    setErro('');
    try {
      await save(normalizeModules(proxima));
    } catch (e) {
      setErro(e?.message || 'Não deu para salvar o módulo.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="card">
      <div className="card-h"><h3>Módulos</h3></div>
      <div className="card-pad" style={{ display: 'grid', gap: 12 }}>
        {MODULE_ROWS.map((row) => {
          const ligado = hasModule(ligados, row.key);
          const gravando = salvando === row.key;
          return (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                role="switch"
                aria-checked={ligado}
                aria-label={row.title}
                disabled={!!salvando}
                className={cn('sw', ligado && 'on', gravando && 'partial')}
                style={{ padding: 0 }}
                onClick={() => alternar(row.key)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}{gravando ? ' · salvando…' : ''}</div>
                <div className="muted" style={{ fontSize: 11 }}>{row.hint}</div>
              </div>
            </div>
          );
        })}
        {erro && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>{erro}</div>}
      </div>
    </div>
  );
}

export { TenantModulesCard };
```

Run: `npx vitest run src/lib/__tests__/tenantModulesCard.test.js`
Expected: FAIL, `Tests  2 failed | 8 passed (10)`. O cartão passa inteiro; falham os dois testes do bloco "o cartão na página da academia", porque o `SuperConsole.jsx` ainda não monta o cartão nem tem o `saveModules`.

- [ ] **Step 12: Ligar o cartão na página da academia**

Em `src/views/console/SuperConsole.jsx`, logo depois da linha 10:

```js
import { Icon } from './consoleIcons.jsx';
```

acrescentar:

```js
import { TenantModulesCard } from './TenantModulesCard.jsx';
```

Trocar as linhas 1150 a 1152 (o fim do `enterAs`, dentro do `Detail`):

```js
    } catch (e) { console.error('enterAs', e); setErr('Falha ao entrar como a organização.'); setBusy(false); }
  };
  const [bg, fg] = tone(t.id);
```

por:

```js
    } catch (e) { console.error('enterAs', e); setErr('Falha ao entrar como a organização.'); setBusy(false); }
  };
  // Liga ou desliga um módulo da academia (TenantModulesCard). A api recusa
  // módulo que não existe. A lista do console é relida antes de soltar a
  // chave, senão ela voltaria ao estado antigo por um instante.
  const saveModules = async (modules) => {
    let res;
    try {
      const token = await auth.currentUser.getIdToken();
      res = await fetch('/api/tenant-status', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tenantId: t.id, modules }) });
    } catch (e) {
      console.error('console modules', e);
      throw new Error('Não deu para falar com o servidor.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Não deu para salvar o módulo.');
    await reload?.();
  };
  const [bg, fg] = tone(t.id);
```

O `reload` é o `loadData` do `SuperConsole` (linha 1596, `reload={loadData}`), que é assíncrono e não volta o `loading` para `true`, então esperar por ele não desmonta o `Detail`. O `auth` já está importado na linha 2.

No uso da plataforma, trocar as linhas 1168 a 1171:

```js
      max: stats?.maxConsultants != null ? stats.maxConsultants + (stats?.extraConsultants || 0) : Math.max(3, stats?.consultants || 0),
    },
    { n: 'Interações registradas', v: stats?.interactionCount ?? null, max: Math.max(100, stats?.interactionCount || 0) },
```

por:

```js
      max: stats?.maxConsultants != null ? stats.maxConsultants + (stats?.extraConsultants || 0) : Math.max(3, stats?.consultants || 0),
    },
    // Professor não ocupa vaga do plano: a linha só aparece quando a academia tem algum.
    ...(stats?.professors > 0
      ? [{ n: 'Professores (fora das vagas)', v: stats.professors, max: Math.max(stats.professors, stats.userCount || 0) }]
      : []),
    { n: 'Interações registradas', v: stats?.interactionCount ?? null, max: Math.max(100, stats?.interactionCount || 0) },
```

Na coluna da esquerda, logo depois do cartão "Perfil da academia", trocar as linhas 1246 a 1251:

```jsx
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Atividade recente</h3></div>
```

por:

```jsx
              ))}
            </div>
          </div>
          <TenantModulesCard tenant={t} save={saveModules} professores={stats?.professors || 0} />
        </div>
        <div className="card">
          <div className="card-h"><h3>Atividade recente</h3></div>
```

O `t` vem da lista do `api/super-overview.js` (Step 7), que agora traz `modules`. A tela "Feature flags" do console não muda.

- [ ] **Step 13: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/tenantModulesCard.test.js api/__tests__/tenantStatusModules.test.js api/__tests__/superOverviewProfessores.test.js src/lib/__tests__/modules.test.js`
Expected: PASS, `Test Files  4 passed (4)` e `Tests  39 passed (39)` (10 do cartão, 11 da rota, 3 da lista do console e 15 dos módulos).

Run: `npx eslint api/tenant-status.js api/super-overview.js src/views/console/SuperConsole.jsx src/views/console/TenantModulesCard.jsx api/__tests__/tenantStatusModules.test.js api/__tests__/superOverviewProfessores.test.js src/lib/__tests__/tenantModulesCard.test.js`
Expected: nenhuma saída.

- [ ] **Step 14: Commit**

```bash
git add api/tenant-status.js api/super-overview.js src/views/console/TenantModulesCard.jsx src/views/console/SuperConsole.jsx api/__tests__/tenantStatusModules.test.js api/__tests__/superOverviewProfessores.test.js src/lib/__tests__/tenantModulesCard.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: chave Professor e faltosos no super console" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Convite, cadastro e vagas na API (`api/_plans.js`, `api/_professorLink.js`, `api/invite-create.js`, `api/invite-accept.js`, `api/admin-users.js`)

> Depende das Tasks 1 e 2 (`src/lib/modules.js` e `src/lib/acesso.js`, os dois sem import).
>
> O `src/lib/teamRoles.js` nasce aqui, e não na Task 6. O servidor usa o arquivo primeiro, e a Task 6 só importa dele.
>
> A Task 4 já lê `seats.professors` no GET do `api/tenant-status.js`. É esta task que faz o `getSeatUsage` devolver esse campo, junto com `modules`.
>
> Outras tasks cuidam do resto:
> - a trava que deixa `role` e `professorId` só com o servidor, no `firestore.rules` (D11), é da Task 11;
> - a ponte do Stronizap (D3) é da Task 10.
>
> Aqui fica a parte do servidor que as regras não alcançam, porque o Admin SDK passa por cima delas:
> - módulo ligado;
> - professor do cadastro ativo e sem outro login;
> - vaga de consultor;
> - carteira vazia (D2);
> - cadastro com id igual ao uid.

**Files:**
- Create: `src/lib/teamRoles.js`
- Create: `api/_professorLink.js`
- Modify: `api/_plans.js:1` (imports), `api/_plans.js:174-212` (`getSeatUsage`), `api/_plans.js:214-221` (cabeçalho do `canAddSeat`)
- Modify: `api/invite-create.js:1-90` (arquivo inteiro)
- Modify: `api/invite-accept.js:4-6` (imports), `:81-85` (papel do convite), `:120` (professorId no cadastro), `:134` (gestor principal)
- Modify: `api/admin-users.js:4-16` (imports), `:25` (constante nova logo depois), `:31-33` (comentário), `:44` (roteador), `:51-138` (`handleCreate`), `:199` (`handleSetRole` novo, antes do bloco `---- admin-set-email ----`), `:403` e `:420-422` (`handleDelete`)
- Test: `src/lib/__tests__/teamRoles.test.js` (novo)
- Test: `src/lib/__tests__/teamRolesImports.test.js` (novo)
- Test: `api/__tests__/plansSeats.test.js` (novo; inclui os casos de módulos do `seatUsageModules.test.js` do rascunho de módulos, que não é criado)
- Test: `api/__tests__/professorAccess.test.js` (novo)

- [ ] **Step 1: Escrever os testes da regra pura**

Criar `src/lib/__tests__/teamRoles.test.js`:

```js
// Papéis da equipe e o vínculo do professor (src/lib/teamRoles.js): a mesma
// regra serve a tela de Equipe & acessos e a api/ (convite, aceite, cadastro e
// troca de papel).
import { describe, it, expect } from 'vitest';
import {
  SET_ROLE_ACTION, PROFESSOR_LINK_MESSAGES, isActiveProfessor,
  linkedProfessorIds, availableProfessors, linkedProfessorText, inviteRoleOptions,
  planRoleChange, professorIdProblem, professorModuleProblem, professorLinkProblem,
} from '../teamRoles.js';

const RAFA = { id: 'prof-rafa', nome: 'Rafael Menezes', ativo: true };
// Professor cadastrado antes do campo ativo existir.
const LU = { id: 'prof-lu', nome: 'Luana Prado' };
const VELHO = { id: 'prof-velho', nome: 'Carlos Antigo', ativo: false };
const PROFESSORES = [RAFA, LU, VELHO];

const GESTOR = { id: 'u-gestor', role: 'admin' };
const ANA = { id: 'u-ana', role: 'consultant' };
const LEGADO = { id: 'u-legado' };
const PROF_RAFA = { id: 'u-rafa', role: 'professor', professorId: 'prof-rafa' };

const ids = (lista) => lista.map((p) => p.id);

describe('a troca de papel', () => {
  it('a ação é a mesma dos dois lados', () => {
    expect(SET_ROLE_ACTION).toBe('set-role');
  });
});

describe('professores que o gestor pode escolher', () => {
  it('ativo é quem não tem ativo: false', () => {
    expect([RAFA, LU, VELHO].map(isActiveProfessor)).toEqual([true, true, false]);
    expect(isActiveProfessor(null)).toBe(false);
  });

  it('só os ativos e sem login, na ordem do cadastro', () => {
    expect(ids(availableProfessors(PROFESSORES, [GESTOR, ANA, PROF_RAFA]))).toEqual(['prof-lu']);
  });

  it('na edição, o professor da própria pessoa continua na lista', () => {
    expect(ids(availableProfessors(PROFESSORES, [PROF_RAFA], { exceptUserId: 'u-rafa', keepId: 'prof-rafa' })))
      .toEqual(['prof-rafa', 'prof-lu']);
  });

  it('o professor da própria pessoa fica na lista mesmo inativo', () => {
    const carlos = { id: 'u-carlos', role: 'professor', professorId: 'prof-velho' };
    expect(ids(availableProfessors(PROFESSORES, [carlos], { exceptUserId: 'u-carlos', keepId: 'prof-velho' })))
      .toEqual(['prof-rafa', 'prof-lu', 'prof-velho']);
  });

  it('um professorId que sobrou num consultor não prende o professor', () => {
    expect(linkedProfessorIds([{ id: 'u-x', role: 'consultant', professorId: 'prof-rafa' }]).size).toBe(0);
    expect([...linkedProfessorIds([PROF_RAFA, ANA])]).toEqual(['prof-rafa']);
  });

  it('o texto do professor ligado diz o que falta', () => {
    expect(linkedProfessorText(PROF_RAFA, PROFESSORES)).toBe('Rafael Menezes');
    expect(linkedProfessorText({ role: 'professor' }, PROFESSORES)).toBe('Sem professor ligado');
    expect(linkedProfessorText({ role: 'professor', professorId: 'prof-apagado' }, PROFESSORES)).toBe('Professor fora do cadastro');
  });
});

describe('papéis do convite', () => {
  it('Professor só aparece com o módulo ligado, pela lista ou pela academia', () => {
    expect(inviteRoleOptions([]).map((o) => o.value)).toEqual(['consultant', 'admin']);
    expect(inviteRoleOptions(undefined).map((o) => o.value)).toEqual(['consultant', 'admin']);
    expect(inviteRoleOptions(['faltosos']).map((o) => o.value)).toEqual(['consultant', 'admin', 'professor']);
    expect(inviteRoleOptions({ modules: ['faltosos'] }).map((o) => o.label)).toEqual(['Consultor', 'Gestor (admin)', 'Professor']);
  });
});

describe('o que a edição muda no papel', () => {
  it('o gestor nunca muda de papel por aqui', () => {
    expect(planRoleChange(GESTOR, { role: 'professor', professorId: 'prof-lu' })).toBeNull();
    expect(planRoleChange(GESTOR, { role: 'consultant' })).toBeNull();
  });

  it('consultor que continua consultor não muda nada, nem o cadastro sem papel', () => {
    expect(planRoleChange(ANA, { role: 'consultant' })).toBeNull();
    expect(planRoleChange(LEGADO, { role: 'consultant' })).toBeNull();
  });

  it('consultor vira professor com o professor escolhido', () => {
    expect(planRoleChange(ANA, { role: 'professor', professorId: 'prof-lu' })).toEqual({ role: 'professor', professorId: 'prof-lu' });
  });

  it('consultor que escolhe Professor sem professor leva o id vazio, para a tela pedir', () => {
    expect(planRoleChange(ANA, { role: 'professor' })).toEqual({ role: 'professor', professorId: '' });
  });

  it('professor volta a consultor e perde o professor', () => {
    expect(planRoleChange(PROF_RAFA, { role: 'consultant', professorId: 'prof-rafa' })).toEqual({ role: 'consultant', professorId: null });
  });

  it('qualquer outro papel pedido vira consultor', () => {
    expect(planRoleChange(PROF_RAFA, { role: 'admin' })).toEqual({ role: 'consultant', professorId: null });
  });

  it('professor que troca de professor muda; o mesmo professor não muda nada', () => {
    expect(planRoleChange(PROF_RAFA, { role: 'professor', professorId: 'prof-lu' })).toEqual({ role: 'professor', professorId: 'prof-lu' });
    expect(planRoleChange(PROF_RAFA, { role: 'professor', professorId: 'prof-rafa' })).toBeNull();
  });
});

describe('conferências do servidor', () => {
  it('o professorId precisa ter formato de id de documento', () => {
    for (const ruim of [undefined, null, '', 42, 'a/b', '.', '..', '__x__', 'x'.repeat(129)]) {
      expect(professorIdProblem(ruim)).toEqual({ status: 400, code: 'professor_obrigatorio', error: PROFESSOR_LINK_MESSAGES.missing });
    }
    expect(professorIdProblem('prof-rafa')).toBeNull();
  });

  it('sem o módulo, recusa; com ele, segue', () => {
    expect(professorModuleProblem([])).toEqual({ status: 403, code: 'modulo_desligado', error: PROFESSOR_LINK_MESSAGES.moduleOff });
    expect(professorModuleProblem(undefined)).toEqual({ status: 403, code: 'modulo_desligado', error: PROFESSOR_LINK_MESSAGES.moduleOff });
    expect(professorModuleProblem(['faltosos'])).toBeNull();
    expect(professorModuleProblem({ modules: ['faltosos'] })).toBeNull();
  });

  it('professor fora do cadastro, inativo ou com login de outra pessoa', () => {
    expect(professorLinkProblem({ professor: null })).toMatchObject({ status: 422, code: 'professor_sumiu', error: PROFESSOR_LINK_MESSAGES.notFound });
    expect(professorLinkProblem({ professor: { ativo: false } })).toMatchObject({ status: 422, code: 'professor_inativo', error: PROFESSOR_LINK_MESSAGES.inactive });
    expect(professorLinkProblem({ professor: { ativo: true }, linkedUsers: [PROF_RAFA] })).toMatchObject({ status: 409, code: 'professor_com_login', error: PROFESSOR_LINK_MESSAGES.taken });
  });

  it('o vínculo da própria pessoa não conta como ocupado, e professor sem o campo ativo serve', () => {
    expect(professorLinkProblem({ professor: { ativo: true }, linkedUsers: [PROF_RAFA], exceptUserId: 'u-rafa' })).toBeNull();
    expect(professorLinkProblem({ professor: {}, linkedUsers: [] })).toBeNull();
    expect(professorLinkProblem({ professor: {}, linkedUsers: [{ id: 'u-x', role: 'consultant', professorId: 'prof-rafa' }] })).toBeNull();
  });
});

describe('textos das recusas', () => {
  it('dizem o nome de quem não pode virar professor e para onde ir', () => {
    expect(PROFESSOR_LINK_MESSAGES.ownsLeads('Ana Souza'))
      .toBe('Ana Souza ainda tem leads na carteira. Passe os leads em Configurações → Migrar leads antes de mudar o papel para Professor.');
    expect(PROFESSOR_LINK_MESSAGES.ownsLeads('')).toMatch(/^Essa pessoa ainda tem leads na carteira\./);
    expect(PROFESSOR_LINK_MESSAGES.legacyRecord('Beto')).toMatch(/^Beto tem um cadastro antigo/);
  });

  it('sem travessão nem aspas curvas', () => {
    const textos = Object.values(PROFESSOR_LINK_MESSAGES).map((m) => (typeof m === 'function' ? m('Ana') : m));
    for (const texto of textos) expect(texto, texto).not.toMatch(/[—–“”‘’]/);
  });
});
```

Criar `src/lib/__tests__/teamRolesImports.test.js`, com o leitor do `guardianImports.test.js`:

```js
// teamRoles.js roda também dentro da api/ (convite, aceite, cadastro e troca
// de papel), com o SDK de servidor. Ele não pode puxar pacote nem arquivo do
// navegador (firebase.js, lucide-react, dailyGoal.js): só importa acesso.js e
// modules.js, que não importam nada (quem cobra os dois é o teste de import
// da Task 2). Mesmo leitor do guardianImports.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEAM_ROLES_PATH = fileURLToPath(new URL('../teamRoles.js', import.meta.url));

// `import ... from '...'` e `export ... from '...'` (grupo 1, inclusive
// multilinha), e `import '...'` ou `import('...')` (grupo 2).
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Comentário sai antes do regex: a palavra import num comentário casaria. O
// `[^:'"\`]` antes do `//` protege um `https://` dentro de texto.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

describe('teamRoles.js só importa módulos puros', () => {
  it('importa só ./acesso.js e ./modules.js', () => {
    const text = readFileSync(TEAM_ROLES_PATH, 'utf8');
    expect(specifiersOf(text).sort()).toEqual(['./acesso.js', './modules.js']);
  });

  // Autoteste: o regex enxerga as formas de import que deveria pegar.
  it('o regex enxerga import multilinha, import de efeito, export from, import() e ignora comentário', () => {
    const amostra = `
// Comentário que fala em import { x } from './comentario.js' não conta.
import {
  a,
} from './leads.js';
import 'lucide-react';
export * from './re.js';
const x = await import('./dyn.js'); // e o import('./fim-de-linha.js') também não
`;
    expect(specifiersOf(amostra)).toEqual(['./leads.js', 'lucide-react', './re.js', './dyn.js']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/teamRoles.test.js src/lib/__tests__/teamRolesImports.test.js`
Expected: FAIL, com `Test Files  2 failed (2)` e `Tests  1 failed | 1 passed (2)`:
- o `teamRoles.test.js` cai no import, com `Error: Cannot find module '../teamRoles.js'`;
- no `teamRolesImports.test.js`, o caso do arquivo falha com `ENOENT`, e o autoteste do regex passa.

- [ ] **Step 3: Implementar a regra pura**

Criar `src/lib/teamRoles.js`:

```js
// Papéis da equipe (Equipe & acessos) e a regra de ligar uma pessoa a um
// professor do cadastro de professores (stronix_professores).
//
// Puro de propósito: a tela e a api/ (convite, aceite, cadastro e troca de
// papel) importam daqui, então a regra é uma só dos dois lados. A api/ roda o
// SDK de servidor, e por isso este arquivo só importa ./acesso.js e
// ./modules.js, que não importam nada. O teamRolesImports.test.js trava isso.
// O nome de cada papel na tela mora em acesso.js (ROLE_LABELS e roleLabel).
import { ROLES, ROLE_LABELS, roleOf } from './acesso.js';
import { hasModule, MODULES } from './modules.js';

// A ação do /api/admin-users que troca o papel. Tela e servidor usam a mesma
// constante, como o set-email.
export const SET_ROLE_ACTION = 'set-role';

const nameOrSomeone = (name) => (typeof name === 'string' && name.trim() ? name.trim() : 'Essa pessoa');

export const PROFESSOR_LINK_MESSAGES = Object.freeze({
  moduleOff: 'O papel Professor só existe com o módulo Professor e faltosos ligado nesta academia.',
  missing: 'Escolha qual professor do cadastro é esta pessoa.',
  notFound: 'Esse professor não está mais no cadastro de professores. Atualize a tela e escolha de novo.',
  inactive: 'Esse professor está inativo no cadastro. Escolha um professor ativo.',
  taken: 'Esse professor já tem acesso ao app. Cada professor do cadastro tem um login só.',
  inviteStale: 'Este convite de professor não vale mais. Peça um convite novo ao gestor.',
  // O professor não é dono de lead: quem vira professor passa a carteira antes.
  ownsLeads: (name) => `${nameOrSomeone(name)} ainda tem leads na carteira. Passe os leads em Configurações → Migrar leads antes de mudar o papel para Professor.`,
  // As regras do Firestore leem o papel no cadastro de id igual ao uid da
  // conta. Cadastro antigo, de id diferente, não enxergaria a trava do
  // professor.
  legacyRecord: (name) => `${nameOrSomeone(name)} tem um cadastro antigo, que não vira professor. Exclua esse acesso e cadastre a pessoa de novo, já com o papel Professor.`,
});

// Inativo é só quem tem ativo: false, a mesma conta do professorsForModality
// (src/lib/professores.js). Professor cadastrado antes do campo existir conta
// como ativo.
export const isActiveProfessor = (professor) => !!professor && professor.ativo !== false;

// Ids dos professores do cadastro que já têm login. Só conta quem é professor
// hoje: um professorId que sobrou num consultor não prende ninguém.
export function linkedProfessorIds(users, { exceptUserId = null } = {}) {
  const ids = new Set();
  for (const u of users || []) {
    if (!u || u.id === exceptUserId || roleOf(u) !== ROLES.PROFESSOR) continue;
    if (typeof u.professorId === 'string' && u.professorId) ids.add(u.professorId);
  }
  return ids;
}

// Professores que o gestor pode escolher, na ordem do cadastro: ativos e sem
// login. Na edição, `exceptUserId` é quem está sendo editado (o vínculo dele
// não conta como ocupado) e `keepId` mantém o professor que ele já tem, para o
// select mostrar o valor atual mesmo que o professor tenha ficado inativo.
export function availableProfessors(professores, users, { exceptUserId = null, keepId = null } = {}) {
  const taken = linkedProfessorIds(users, { exceptUserId });
  return (professores || []).filter((p) => p && p.id
    && (p.id === keepId || (isActiveProfessor(p) && !taken.has(p.id))));
}

// Texto do professor ligado, na lista da equipe.
export function linkedProfessorText(user, professores) {
  if (!user?.professorId) return 'Sem professor ligado';
  const professor = (professores || []).find((p) => p.id === user.professorId);
  return professor?.nome || 'Professor fora do cadastro';
}

// Papéis do convite, na ordem do select. Professor só com o módulo. Aceita a
// lista de módulos (appUser.tenantModules) ou o documento da academia.
export function inviteRoleOptions(modulesOrTenant) {
  const options = [
    { value: ROLES.CONSULTOR, label: ROLE_LABELS[ROLES.CONSULTOR] },
    { value: ROLES.GESTOR, label: `${ROLE_LABELS[ROLES.GESTOR]} (admin)` },
  ];
  if (hasModule(modulesOrTenant, MODULES.FALTOSOS)) {
    options.push({ value: ROLES.PROFESSOR, label: ROLE_LABELS[ROLES.PROFESSOR] });
  }
  return options;
}

// O que a edição de um membro muda no papel: null quando nada muda, ou
// { role, professorId }. O gestor nunca muda de papel por aqui. Qualquer
// papel pedido que não seja Professor vira Consultor, e o professorId só
// existe no Professor (vazio quando a tela ainda não escolheu).
export function planRoleChange(user, { role, professorId } = {}) {
  const from = roleOf(user);
  if (from === ROLES.GESTOR) return null;
  if (role !== ROLES.PROFESSOR) {
    return from === ROLES.CONSULTOR ? null : { role: ROLES.CONSULTOR, professorId: null };
  }
  const next = typeof professorId === 'string' ? professorId : '';
  if (from === ROLES.PROFESSOR && next === (user?.professorId || '')) return null;
  return { role: ROLES.PROFESSOR, professorId: next };
}

// Conferências do servidor, em três tempos, cada uma pronta para responder
// ({ status, code, error }) ou null: o formato antes de qualquer leitura, o
// módulo depois de ler a academia, o professor depois de ler o cadastro dele
// e quem já está ligado a ele.

// O mesmo formato de id de documento que a ponte do Stronizap aceita
// (isDocId, em api/_zapSchedule.js).
const isDocId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 128
  && !v.includes('/') && v !== '.' && v !== '..' && !/^__.*__$/.test(v);

const refusal = (status, code, error) => ({ status, code, error });

export function professorIdProblem(professorId) {
  return isDocId(professorId) ? null : refusal(400, 'professor_obrigatorio', PROFESSOR_LINK_MESSAGES.missing);
}

export function professorModuleProblem(modulesOrTenant) {
  return hasModule(modulesOrTenant, MODULES.FALTOSOS)
    ? null
    : refusal(403, 'modulo_desligado', PROFESSOR_LINK_MESSAGES.moduleOff);
}

// `professor` é o documento do cadastro (null quando não existe) e
// `linkedUsers`, os cadastros da equipe com esse professorId.
export function professorLinkProblem({ professor, linkedUsers = [], exceptUserId = null }) {
  if (!professor) return refusal(422, 'professor_sumiu', PROFESSOR_LINK_MESSAGES.notFound);
  if (!isActiveProfessor(professor)) return refusal(422, 'professor_inativo', PROFESSOR_LINK_MESSAGES.inactive);
  if (linkedProfessorIds(linkedUsers, { exceptUserId }).size > 0) {
    return refusal(409, 'professor_com_login', PROFESSOR_LINK_MESSAGES.taken);
  }
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/teamRoles.test.js src/lib/__tests__/teamRolesImports.test.js`
Expected: PASS, com `Tests  23 passed (23)`: 21 no `teamRoles.test.js` e 2 no `teamRolesImports.test.js`.

- [ ] **Step 5: Escrever o teste das vagas**

Criar `api/__tests__/plansSeats.test.js`. Ele leva também os casos de módulos do `seatUsageModules.test.js` do rascunho de módulos, que não é criado:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canAddSeat, getSeatUsage } from '../_plans.js';
import { hasModule, MODULES } from '../../src/lib/modules.js';

// Vagas do plano: só o consultor ocupa vaga de consultor, só o gestor ocupa
// vaga de gestor, e o professor não ocupa nenhuma nem entra no extra pago. É a
// mesma conta que o convite, o aceite, o cadastro, a troca de papel e a
// cobrança usam. O getSeatUsage já lê tenants/{id} para saber o plano, e
// devolve também os módulos da academia, para quem cria acesso de professor
// não ler o documento de novo.

const banco = vi.hoisted(() => ({ tenants: {}, usuarios: [], planos: [], leituras: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    count: () => ({
      get: async () => ({
        data: () => ({ count: banco.usuarios.filter((u) => !filtro || u[filtro.campo] === filtro.valor).length }),
      }),
    }),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      if (caminho.join('/') === 'plans') {
        const docs = banco.planos.map((p) => ({ id: p.slug, data: () => p }));
        return { empty: docs.length === 0, size: docs.length, docs, forEach: (fn) => docs.forEach(fn) };
      }
      const dados = caminho[0] === 'tenants' ? banco.tenants[caminho[1]] : undefined;
      return { exists: dados != null, data: () => dados };
    },
  });
  return { adminDb: ref([]), admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } } };
});

const T = 'academia-teste';
const GESTOR = { role: 'admin' };
const CONSULTOR = { role: 'consultant' };
const PROFESSOR = { role: 'professor', professorId: 'prof-1' };
const LEGADO = {};

beforeEach(() => {
  banco.tenants = { [T]: { plan: 'starter', modules: ['faltosos'] } };
  banco.usuarios = [];
  banco.planos = [];
  banco.leituras = [];
});

describe('getSeatUsage: vagas por papel', () => {
  it('conta o professor à parte: nem consultor nem gestor', async () => {
    banco.usuarios = [GESTOR, CONSULTOR, CONSULTOR, PROFESSOR, PROFESSOR];
    expect(await getSeatUsage(T)).toMatchObject({
      managers: 1, consultants: 2, professors: 2, currentUsers: 5, maxManagers: 1, maxConsultants: 2,
    });
  });

  it('cadastro antigo sem papel continua contando como consultor', async () => {
    banco.usuarios = [GESTOR, LEGADO, PROFESSOR];
    expect(await getSeatUsage(T)).toMatchObject({ consultants: 1, professors: 1 });
  });

  it('o extra pago não conta professor', async () => {
    banco.planos = [{ slug: 'starter', maxManagers: 1, maxConsultants: 1, extraUserPrice: 30, maxExtraUsers: 5 }];
    banco.usuarios = [GESTOR, CONSULTOR, PROFESSOR, PROFESSOR];
    expect(await getSeatUsage(T)).toMatchObject({ consultants: 1, professors: 2, extraConsultants: 0 });
  });
});

describe('getSeatUsage: módulos da academia', () => {
  it('academia com o módulo ligado: a lista vem junto com as vagas', async () => {
    const seats = await getSeatUsage(T);
    expect(seats.modules).toEqual(['faltosos']);
    expect(hasModule(seats, MODULES.FALTOSOS)).toBe(true);
  });

  it('sem documento, sem o campo ou com lixo no campo: lista vazia', async () => {
    const casos = [undefined, { plan: 'starter' }, { modules: 'faltosos' }, { modules: ['catraca', 'Faltosos'] }];
    for (const dados of casos) {
      banco.tenants = dados ? { a: dados } : {};
      const seats = await getSeatUsage('a');
      expect(seats.modules, JSON.stringify(dados)).toEqual([]);
      expect(hasModule(seats, MODULES.FALTOSOS)).toBe(false);
    }
  });

  it('não lê o documento da academia uma segunda vez', async () => {
    await getSeatUsage(T);
    expect(banco.leituras.filter((l) => l.startsWith('tenants/'))).toEqual([`tenants/${T}`]);
  });
});

describe('canAddSeat', () => {
  const cheio = {
    plan: 'starter', managers: 1, maxManagers: 1, consultants: 2, maxConsultants: 2,
    extraUserPrice: null, maxExtraUsers: null,
  };

  it('professor sempre cabe, mesmo com as vagas de gestor e de consultor cheias', () => {
    expect(canAddSeat(cheio, 'professor')).toEqual({ ok: true });
  });

  it('gestor e consultor continuam barrados como antes', () => {
    expect(canAddSeat(cheio, 'admin')).toMatchObject({ ok: false, code: 'managers_limit' });
    expect(canAddSeat(cheio, 'consultant')).toMatchObject({ ok: false, code: 'consultants_limit' });
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/plansSeats.test.js`
Expected: FAIL, `Tests  6 failed | 2 passed (8)`. Os motivos:
- as contagens trazem os professores como consultores (`expected { plan: 'starter', managers: 1, …(9) } to match object { …professors… }`);
- `seats.modules` vem `undefined`;
- `canAddSeat(cheio, 'professor')` cai no ramo do consultor e devolve `consultants_limit`.

Os dois que já passam são "não lê o documento da academia uma segunda vez" e "gestor e consultor continuam barrados".

- [ ] **Step 7: Implementar as vagas**

Em `api/_plans.js`, trocar a linha 1:

```js
import { adminDb, admin } from './_firebaseAdmin.js';
```

por:

```js
import { adminDb, admin } from './_firebaseAdmin.js';
import { ROLES } from '../src/lib/acesso.js';
import { normalizeModules } from '../src/lib/modules.js';
```

Trocar o bloco das linhas 174 a 212 (o comentário e a função `getSeatUsage` inteira) por:

```js
// Lê o plano do tenant (default 'starter') e conta os usuários POR PAPEL.
// Gestor = role 'admin'. Professor = role 'professor', contado à parte e fora
// de qualquer vaga: não é gestor nem consultor e não entra no preço dos
// extras. Consultor = todo o resto (docs legados sem `role` contam como
// consultor, mais seguro para o limite). Devolve também os módulos da academia
// (`modules`, normalizado), lidos do mesmo documento, para quem cria acesso de
// professor não precisar ler a academia de novo. Mantém os campos legados
// { maxUsers, currentUsers, atLimit }; currentUsers conta todo mundo.
export async function getSeatUsage(tenantId) {
  const [tenantSnap, totalSnap, managersSnap, professorsSnap, plans] = await Promise.all([
    adminDb.collection('tenants').doc(tenantId).get(),
    usersCol(tenantId).count().get(),
    usersCol(tenantId).where('role', '==', ROLES.GESTOR).count().get(),
    usersCol(tenantId).where('role', '==', ROLES.PROFESSOR).count().get(),
    loadPlans(),
  ]);
  const tenantData = tenantSnap.exists ? (tenantSnap.data() || {}) : {};
  const plan = tenantData.plan || 'starter';
  const planDoc = plans.get(plan) || null;
  const limits = planSeatLimits(planDoc) || fallbackSeatLimits(plan);

  const currentUsers = totalSnap.data().count || 0;
  const managers = managersSnap.data().count || 0;
  const professors = professorsSnap.data().count || 0;
  const consultants = Math.max(0, currentUsers - managers - professors);

  const extraUserPrice = Number(planDoc?.extraUserPrice);
  const hasExtraSlots = Number.isFinite(extraUserPrice) && extraUserPrice > 0;
  const maxExtraUsers = planDoc?.maxExtraUsers == null ? null : Number(planDoc.maxExtraUsers);
  const extraConsultants = billableExtraConsultants(planDoc, consultants);

  const dynMax = planDocMaxUsers(planDoc);
  const maxUsers = dynMax == null ? planMaxUsers(plan) : dynMax;

  return {
    plan,
    modules: normalizeModules(tenantData.modules),
    managers, consultants, professors,
    maxManagers: limits.maxManagers,
    maxConsultants: limits.maxConsultants,
    extraUserPrice: hasExtraSlots ? extraUserPrice : null,
    maxExtraUsers,
    extraConsultants,
    // legado
    maxUsers, currentUsers, atLimit: currentUsers >= maxUsers,
  };
}
```

Trocar as linhas 214 a 221:

```js
// Pode adicionar um usuário com este papel? Centraliza a regra dos endpoints
// (create-user / invite-create / invite-accept). Retorna:
//   { ok:true, isExtra? }                                → pode criar
//   { ok:false, code:'managers_limit'|'consultants_limit', error }
//   { ok:false, code:'extra_confirm', extraUserPrice, error }  → cabe como
//     EXTRA pago, mas o chamador precisa confirmar (allowExtra=true).
export function canAddSeat(seats, role, { allowExtra = false } = {}) {
  if (role === 'admin') {
```

por:

```js
// Pode adicionar um usuário com este papel? Centraliza a regra dos endpoints
// (create-user / invite-create / invite-accept / set-role). Retorna:
//   { ok:true, isExtra? }                                → pode criar
//   { ok:false, code:'managers_limit'|'consultants_limit', error }
//   { ok:false, code:'extra_confirm', extraUserPrice, error }  → cabe como
//     EXTRA pago, mas o chamador precisa confirmar (allowExtra=true).
// Professor não ocupa vaga de gestor nem de consultor: sempre cabe.
export function canAddSeat(seats, role, { allowExtra = false } = {}) {
  if (role === ROLES.PROFESSOR) return { ok: true };
  if (role === ROLES.GESTOR) {
```

A cobrança não muda de código. O `api/_asaas.js:132`, o `api/asaas.js:199, 386 e 418` e o `extraConsultants` do delete leem o `consultants` e o `extraConsultants` daqui, então todos deixam de cobrar professor.

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run api/__tests__/plansSeats.test.js api/__tests__/adminUsers.test.js api/__tests__/adminUsersSetEmail.test.js api/__tests__/inviteAccept.test.js api/__tests__/provisionTenant.test.js`
Expected: PASS, `Tests  44 passed (44)`. Os quatro arquivos de antes trocam o `../_plans.js` inteiro por um falso e não mudam.

- [ ] **Step 9: Escrever o teste dos caminhos de criação e da troca de papel**

Criar `api/__tests__/professorAccess.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import inviteCreate from '../invite-create.js';
import inviteAccept from '../invite-accept.js';
import adminUsers from '../admin-users.js';
import { PROFESSOR_LINK_MESSAGES } from '../../src/lib/teamRoles.js';

// O acesso de professor pelos caminhos que criam gente na academia (convite,
// aceite e cadastro pelo gestor), pela troca de papel (set-role) e pela
// exclusão. O Firebase Admin é falso, mas a conta das vagas é a de verdade
// (api/_plans.js): é ela que prova que o professor não ocupa vaga de
// consultor nem de gestor. Sem a coleção plans/, o starter é o da semente:
// 1 gestor e 2 consultores, sem extra pago.

const T = 'academia-teste';
const banco = vi.hoisted(() => ({ docs: new Map(), sessao: null, ultimoId: 0 }));
const contas = vi.hoisted(() => ({
  createUser: vi.fn(), setCustomUserClaims: vi.fn(), getUser: vi.fn(), getUserByEmail: vi.fn(),
  updateUser: vi.fn(), deleteUser: vi.fn(), revokeRefreshTokens: vi.fn(),
}));
const cobranca = vi.hoisted(() => ({ sincronizar: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const APAGAR = Symbol('apagar');
  const aplicar = (antes, mudanca) => {
    const depois = { ...(antes || {}) };
    for (const [campo, valor] of Object.entries(mudanca)) {
      if (valor === APAGAR) delete depois[campo];
      else depois[campo] = valor;
    }
    return depois;
  };
  // Documento quando o caminho tem número par de partes, coleção quando ímpar.
  const ref = (caminho, filtros = []) => {
    const chave = caminho.join('/');
    const filhos = () => [...banco.docs.entries()]
      .filter(([k]) => k.startsWith(`${chave}/`) && !k.slice(chave.length + 1).includes('/'))
      .filter(([, d]) => filtros.every(({ campo, valor }) => d[campo] === valor))
      .map(([k, d]) => {
        const id = k.slice(chave.length + 1);
        return { id, exists: true, data: () => ({ ...d }), ref: ref([...caminho, id]) };
      });
    return {
      id: caminho.at(-1),
      collection: (nome) => ref([...caminho, nome]),
      doc: (id) => ref([...caminho, id]),
      where: (campo, _op, valor) => ref(caminho, [...filtros, { campo, valor }]),
      limit: () => ref(caminho, filtros),
      count: () => ({ get: async () => ({ data: () => ({ count: filhos().length }) }) }),
      get: async () => {
        if (caminho.length % 2 === 0) {
          const d = banco.docs.get(chave);
          return { id: caminho.at(-1), exists: d != null, data: () => (d ? { ...d } : undefined), ref: ref(caminho) };
        }
        const docs = filhos();
        return { empty: docs.length === 0, size: docs.length, docs, forEach: (fn) => docs.forEach(fn) };
      },
      set: async (dados, opcoes) => {
        banco.docs.set(chave, aplicar(opcoes?.merge ? banco.docs.get(chave) : {}, dados));
      },
      update: async (dados) => {
        if (!banco.docs.has(chave)) throw Object.assign(new Error('documento não existe'), { code: 5 });
        banco.docs.set(chave, aplicar(banco.docs.get(chave), dados));
      },
      add: async (dados) => {
        const id = `auto-${++banco.ultimoId}`;
        banco.docs.set(`${chave}/${id}`, aplicar({}, dados));
        return ref([...caminho, id]);
      },
      delete: async () => { banco.docs.delete(chave); },
    };
  };
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => 'agora', delete: () => APAGAR },
        Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
      },
    },
    verifyRequest: async () => banco.sessao,
  };
});

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async () => ({ ok: true }),
  clientIp: () => '203.0.113.9',
}));
vi.mock('../_asaas.js', () => ({ syncSubscriptionValue: async (...args) => cobranca.sincronizar(...args) }));
// O SDK do Sentry fica sem rede, mesmo com um SENTRY_DSN no ambiente.
vi.mock('@sentry/node', () => ({
  init: () => {},
  captureException: () => {},
  flush: async () => true,
  httpIntegration: () => ({ name: 'Http' }),
}));

const EQUIPE = `artifacts/${T}/public/data/stronix_users`;
const CATALOGO = `artifacts/${T}/public/data/stronix_professores`;
const SENHA = 'Academia@2026';
const PLANO_COM_EXTRA = { slug: 'starter', name: 'Starter', maxManagers: 1, maxConsultants: 2, extraUserPrice: 30, maxExtraUsers: 5 };

const cadastro = (id) => banco.docs.get(`${EQUIPE}/${id}`);
const convites = () => [...banco.docs.entries()]
  .filter(([k]) => k.startsWith(`tenants/${T}/invites/`))
  .map(([, d]) => d);
const consultorDe = (id) => ({ name: id, email: `${id}@academia.com`, authUid: id, role: 'consultant' });
const professorDe = (id, professorId) => ({ name: id, email: `${id}@academia.com`, authUid: id, role: 'professor', professorId });

// Academia STRONIX de teste: módulo ligado, um gestor, as duas vagas de
// consultor ocupadas (Ana e Bia) e três professores no cadastro.
function semear({ modules = ['faltosos'], plano = null, equipe = {} } = {}) {
  banco.docs = new Map([
    [`tenants/${T}`, { plan: 'starter', status: 'active', modules, primaryAdminUid: 'gestor-1' }],
    [`${EQUIPE}/gestor-1`, { name: 'Gestor', email: 'gestor@academia.com', authUid: 'gestor-1', role: 'admin' }],
    [`${EQUIPE}/uid-ana`, { name: 'Ana', email: 'ana@academia.com', authUid: 'uid-ana', role: 'consultant' }],
    [`${EQUIPE}/uid-bia`, { name: 'Bia', email: 'bia@academia.com', authUid: 'uid-bia', role: 'consultant' }],
    [`${CATALOGO}/prof-rafa`, { nome: 'Rafael Menezes', ativo: true }],
    [`${CATALOGO}/prof-lu`, { nome: 'Luana Prado' }],
    [`${CATALOGO}/prof-velho`, { nome: 'Carlos Antigo', ativo: false }],
  ]);
  if (plano) banco.docs.set(`plans/${plano.slug}`, plano);
  for (const [id, dados] of Object.entries(equipe)) {
    if (dados === null) banco.docs.delete(`${EQUIPE}/${id}`);
    else banco.docs.set(`${EQUIPE}/${id}`, dados);
  }
}

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
async function chamar(handler, body) {
  const res = resposta();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, res);
  return res;
}
const criar = (extra) => chamar(adminUsers, { action: 'create', name: 'Luana', email: 'lu@academia.com', password: SENHA, ...extra });
const trocarPapel = (extra) => chamar(adminUsers, { action: 'set-role', ...extra });

let logErro;
let logInfo;
beforeEach(() => {
  semear();
  banco.sessao = { uid: 'gestor-1', tenantId: T, superAdmin: false };
  banco.ultimoId = 0;
  for (const fn of Object.values(contas)) fn.mockReset();
  contas.createUser.mockImplementation(async ({ email }) => ({ uid: `uid-${email.split('@')[0]}` }));
  contas.getUser.mockImplementation(async (uid) => ({ uid, customClaims: { tenantId: T } }));
  cobranca.sincronizar.mockReset();
  logErro = vi.spyOn(console, 'error').mockImplementation(() => {});
  logInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  logErro.mockRestore();
  logInfo.mockRestore();
});

describe('cadastro pelo gestor (create)', () => {
  it('professor entra ligado ao professor do cadastro, mesmo com as vagas de consultor cheias', async () => {
    const res = await criar({ role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, authUid: 'uid-lu', role: 'professor', isExtra: false });
    expect(cadastro('uid-lu')).toMatchObject({ role: 'professor', professorId: 'prof-lu', authUid: 'uid-lu', tenantId: T });
    expect(contas.setCustomUserClaims).toHaveBeenCalledWith('uid-lu', { tenantId: T });
  });

  it('consultor continua barrado com as duas vagas ocupadas', async () => {
    const res = await criar({});
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Limite de consultores do plano starter');
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('professor não ocupa vaga: com um professor e um consultor, ainda cabe o segundo consultor', async () => {
    semear({ equipe: { 'uid-bia': null, 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const res = await criar({});
    expect(res.statusCode).toBe(200);
    expect(cadastro('uid-lu')).toMatchObject({ role: 'consultant' });
    expect(cadastro('uid-lu')).not.toHaveProperty('professorId');
  });

  it('sem o módulo, o papel Professor é recusado e nenhuma conta é criada', async () => {
    semear({ modules: [] });
    const res = await criar({ role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.moduleOff);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('sem professor escolhido, recusa e não cria a conta', async () => {
    const res = await criar({ role: 'professor' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.missing);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it.each([
    ['professor inativo', 'prof-velho', 422, PROFESSOR_LINK_MESSAGES.inactive],
    ['professor fora do cadastro', 'prof-sumido', 422, PROFESSOR_LINK_MESSAGES.notFound],
    ['professor que já tem login', 'prof-rafa', 409, PROFESSOR_LINK_MESSAGES.taken],
  ])('%s é recusado', async (_caso, professorId, status, erro) => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const res = await criar({ role: 'professor', professorId });
    expect(res.statusCode).toBe(status);
    expect(res.body.error).toBe(erro);
    expect(contas.createUser).not.toHaveBeenCalled();
  });
});

describe('convite de professor', () => {
  const convidar = (extra) => chamar(inviteCreate, { email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', ...extra });
  const aceitar = (token) => chamar(inviteAccept, { tenantId: T, token, password: SENHA, name: 'Luana' });

  it('o convite guarda o professor, e o aceite cria o cadastro ligado a ele', async () => {
    const convite = await convidar();
    expect(convite.statusCode).toBe(200);
    expect(convite.body).toMatchObject({ role: 'professor', professorId: 'prof-lu' });
    expect(convites()).toEqual([
      expect.objectContaining({ email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', status: 'pending' }),
    ]);

    const aceite = await aceitar(convite.body.token);
    expect(aceite.statusCode).toBe(200);
    expect(aceite.body.role).toBe('professor');
    expect(cadastro('uid-lu')).toMatchObject({ name: 'Luana', role: 'professor', professorId: 'prof-lu', tenantId: T });
  });

  it('com a vaga de gestor e as de consultor cheias, o convite de professor passa e o de gestor não', async () => {
    expect((await convidar()).statusCode).toBe(200);
    const gestor = await chamar(inviteCreate, { email: 'outro@academia.com', role: 'admin' });
    expect(gestor.statusCode).toBe(403);
  });

  it('sem o módulo, o convite de professor é recusado', async () => {
    semear({ modules: [] });
    const res = await convidar();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.moduleOff);
    expect(convites()).toEqual([]);
  });

  it('convite de professor sem professor é recusado', async () => {
    const res = await convidar({ professorId: undefined });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.missing);
    expect(convites()).toEqual([]);
  });

  it('o aceite recusa se o professor ganhou outro login depois do convite', async () => {
    const convite = await convidar();
    banco.docs.set(`${EQUIPE}/uid-outra`, professorDe('uid-outra', 'prof-lu'));
    const aceite = await aceitar(convite.body.token);
    expect(aceite.statusCode).toBe(409);
    expect(aceite.body.error).toBe(PROFESSOR_LINK_MESSAGES.inviteStale);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('o aceite recusa se o módulo foi desligado depois do convite', async () => {
    const convite = await convidar();
    banco.docs.set(`tenants/${T}`, { ...banco.docs.get(`tenants/${T}`), modules: [] });
    const aceite = await aceitar(convite.body.token);
    expect(aceite.statusCode).toBe(409);
    expect(aceite.body.error).toBe(PROFESSOR_LINK_MESSAGES.inviteStale);
    expect(contas.createUser).not.toHaveBeenCalled();
  });
});

describe('troca de papel (set-role)', () => {
  it('consultor vira professor: grava o papel e o professor, tira a meta de prospecção e derruba as sessões da pessoa', async () => {
    banco.docs.set(`${EQUIPE}/uid-ana`, { ...cadastro('uid-ana'), dailyVolumeTarget: 20 });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, changed: true, role: 'professor' });
    expect(cadastro('uid-ana')).toMatchObject({ name: 'Ana', role: 'professor', professorId: 'prof-lu' });
    expect(cadastro('uid-ana')).not.toHaveProperty('dailyVolumeTarget');
    expect(contas.revokeRefreshTokens).toHaveBeenCalledWith('uid-ana');
    expect(cobranca.sincronizar).not.toHaveBeenCalled();
  });

  it('consultor com leads não vira professor antes de migrar a carteira', async () => {
    banco.docs.set(`artifacts/${T}/public/data/stronix_leads/L1`, { name: 'Mariana', consultantId: 'uid-ana' });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.ownsLeads('Ana'));
    expect(res.body.error).toContain('Configurações → Migrar leads');
    expect(cadastro('uid-ana').role).toBe('consultant');
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('lead de outra pessoa não barra', async () => {
    banco.docs.set(`artifacts/${T}/public/data/stronix_leads/L1`, { name: 'Mariana', consultantId: 'uid-bia' });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(cadastro('uid-ana').role).toBe('professor');
  });

  it('cadastro antigo, de id diferente do uid da conta, não vira professor', async () => {
    semear({ equipe: { 'doc-antigo': { name: 'Beto', email: 'beto@academia.com', authUid: 'uid-beto', role: 'consultant' } } });
    const res = await trocarPapel({ userDocId: 'doc-antigo', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.legacyRecord('Beto'));
    expect(cadastro('doc-antigo').role).toBe('consultant');
  });

  it('consultor extra que vira professor libera a vaga paga, e a assinatura é ajustada', async () => {
    semear({ plano: PLANO_COM_EXTRA, equipe: { 'uid-cris': consultorDe('uid-cris') } });
    const res = await trocarPapel({ userDocId: 'uid-cris', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(cobranca.sincronizar).toHaveBeenCalledWith(T, { actorUid: 'gestor-1' });
  });

  it('professor só volta a consultor com vaga: com as vagas cheias, recusa e não mexe no cadastro', async () => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const antes = { ...cadastro('uid-rafa') };
    const res = await trocarPapel({ userDocId: 'uid-rafa', role: 'consultant' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Limite de consultores');
    expect(cadastro('uid-rafa')).toEqual(antes);
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('professor vira consultor extra só com a confirmação do gestor, e a assinatura é ajustada', async () => {
    semear({ plano: PLANO_COM_EXTRA, equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const semConfirmar = await trocarPapel({ userDocId: 'uid-rafa', role: 'consultant' });
    expect(semConfirmar.statusCode).toBe(409);
    expect(semConfirmar.body).toMatchObject({ requiresExtraConfirmation: true, extraUserPrice: 30 });
    expect(cadastro('uid-rafa').role).toBe('professor');

    const confirmado = await trocarPapel({ userDocId: 'uid-rafa', role: 'consultant', allowExtra: true });
    expect(confirmado.statusCode).toBe(200);
    expect(confirmado.body).toMatchObject({ changed: true, role: 'consultant', isExtra: true });
    expect(cadastro('uid-rafa').role).toBe('consultant');
    expect(cadastro('uid-rafa')).not.toHaveProperty('professorId');
    expect(cobranca.sincronizar).toHaveBeenCalledTimes(1);
    expect(contas.revokeRefreshTokens).toHaveBeenCalledWith('uid-rafa');
  });

  it('trocar o professor ligado não esbarra no próprio vínculo e não derruba a sessão', async () => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const res = await trocarPapel({ userDocId: 'uid-rafa', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(cadastro('uid-rafa').professorId).toBe('prof-lu');
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('o mesmo papel com o mesmo professor não grava nada; o professor de outra pessoa é recusado', async () => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const igual = await trocarPapel({ userDocId: 'uid-rafa', role: 'professor', professorId: 'prof-rafa' });
    expect(igual.statusCode).toBe(200);
    expect(igual.body).toEqual({ ok: true, changed: false });

    const ocupado = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-rafa' });
    expect(ocupado.statusCode).toBe(409);
    expect(ocupado.body.error).toBe(PROFESSOR_LINK_MESSAGES.taken);
    expect(cadastro('uid-ana').role).toBe('consultant');
  });

  it('sem o módulo, ninguém vira professor', async () => {
    semear({ modules: [] });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.moduleOff);
    expect(cadastro('uid-ana').role).toBe('consultant');
  });

  it('o papel do gestor não muda por aqui, nem o próprio', async () => {
    semear({ equipe: { 'gestor-2': { name: 'Gestora', email: 'g2@academia.com', authUid: 'gestor-2', role: 'admin' } } });
    const outroGestor = await trocarPapel({ userDocId: 'gestor-2', role: 'consultant' });
    expect(outroGestor.statusCode).toBe(400);
    expect(outroGestor.body.error).toBe('O papel do gestor não muda por aqui.');

    const proprio = await trocarPapel({ userDocId: 'gestor-1', role: 'consultant' });
    expect(proprio.statusCode).toBe(400);
    expect(proprio.body.error).toBe('Você não pode trocar o seu próprio papel.');
  });

  it('só o gestor troca papel', async () => {
    banco.sessao = { uid: 'uid-ana', tenantId: T, superAdmin: false };
    const res = await trocarPapel({ userDocId: 'uid-bia', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(403);
    expect(cadastro('uid-bia').role).toBe('consultant');
  });

  it('por aqui o papel muda só entre Consultor e Professor', async () => {
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'admin' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Por aqui o papel muda só entre Consultor e Professor.');
  });
});

describe('exclusão', () => {
  it('excluir professor não mexe na assinatura; excluir consultor extra mexe', async () => {
    semear({
      plano: PLANO_COM_EXTRA,
      equipe: { 'uid-cris': consultorDe('uid-cris'), 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') },
    });
    const professor = await chamar(adminUsers, { action: 'delete', userDocId: 'uid-rafa' });
    expect(professor.statusCode).toBe(200);
    expect(cadastro('uid-rafa')).toBeUndefined();
    expect(cobranca.sincronizar).not.toHaveBeenCalled();

    const consultor = await chamar(adminUsers, { action: 'delete', userDocId: 'uid-cris' });
    expect(consultor.statusCode).toBe(200);
    expect(cobranca.sincronizar).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/professorAccess.test.js`
Expected: FAIL, `Tests  26 failed | 2 passed (28)`. Os motivos:
- o `create` ignora o papel e bate no limite de consultores (`expected 403 to be 200`, ou a frase do limite no lugar de `PROFESSOR_LINK_MESSAGES.moduleOff`);
- o convite troca `professor` por consultor e também bate no limite;
- o aceite recebe token `undefined` (`expected 400 to be 409`);
- todo `set-role` responde `400 'Ação inválida'`;
- a exclusão do professor chama a sincronização da assinatura.

Só passam "consultor continua barrado com as duas vagas ocupadas" e "professor não ocupa vaga", porque já dependem só do `_plans.js` do Step 7.

- [ ] **Step 11: As leituras do vínculo do professor**

Criar `api/_professorLink.js`:

```js
import { dataCollection, usersCollection } from './_auth.js';
import { professorIdProblem, professorModuleProblem, professorLinkProblem } from '../src/lib/teamRoles.js';

const PROFESSORS_PATH = 'stronix_professores';

// Confere o professor do cadastro que uma pessoa da equipe vai ser: o módulo
// Professor e faltosos ligado, e o professor existindo, ativo e sem outro
// login. Usado pelo convite, pelo aceite, pelo cadastro e pela troca de papel.
// As regras moram em src/lib/teamRoles.js, as mesmas que a tela usa para
// montar a escolha. Aqui ficam só as leituras. O underscore no nome deixa o
// arquivo fora das funções da Vercel.
//
// Devolve null quando pode seguir, ou { status, code, error } pronto para
// responder. `modules` é a lista da academia já normalizada (o getSeatUsage
// devolve). `exceptUserId` é quem está trocando de professor: o vínculo dele
// mesmo não conta como ocupado.
//
// Não é transação: dois gestores ligando o mesmo professor no mesmo instante
// passariam os dois. A academia tem um gestor ou dois e a tela esconde quem já
// tem login, então o risco foi aceito.
export async function professorLinkRefusal({ tenantId, modules, professorId, exceptUserId = null }) {
  const early = professorIdProblem(professorId) || professorModuleProblem(modules);
  if (early) return early;
  const [professorSnap, linkedSnap] = await Promise.all([
    dataCollection(tenantId, PROFESSORS_PATH).doc(professorId).get(),
    usersCollection(tenantId).where('professorId', '==', professorId).get(),
  ]);
  return professorLinkProblem({
    professor: professorSnap.exists ? (professorSnap.data() || {}) : null,
    linkedUsers: linkedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    exceptUserId,
  });
}
```

A consulta por `professorId` é de campo único, então não precisa de índice publicado.

- [ ] **Step 12: O convite**

Trocar o conteúdo inteiro de `api/invite-create.js` (linhas 1 a 90) por:

```js
import { randomUUID } from 'node:crypto';
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage, canAddSeat } from './_plans.js';
import { isTenantAdmin } from './_auth.js';
import { professorLinkRefusal } from './_professorLink.js';
import { ROLES } from '../src/lib/acesso.js';
import { professorIdProblem } from '../src/lib/teamRoles.js';
import { withSentry } from './_sentry.js';

// Cria um convite para adicionar um usuário (gestor, consultor ou professor)
// ao tenant. ADMIN do tenant only. Vercel serverless function.
//
// POST body: { email, role, professorId?, allowExtra? }
//   role: 'admin' | 'consultant' | 'professor' (outro valor vira consultor)
//   professorId: obrigatório no professor, id em stronix_professores
// Retorna { inviteId, token, tenantId, expiresAt } — o app monta o link
// /?invite=<token>&t=<tenantId> e o admin envia ao convidado.
//
// Professor só com o módulo Professor e faltosos ligado e com um professor
// ativo do cadastro, sem outro login (api/_professorLink.js). O convite guarda
// o professorId, e o aceite confere tudo de novo.

const INVITE_ROLES = [ROLES.GESTOR, ROLES.CONSULTOR, ROLES.PROFESSOR];
const INVITE_TTL_DAYS = 7;

const invitesCollection = (tenantId) =>
  adminDb.collection('tenants').doc(tenantId).collection('invites');

export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode convidar usuários.' });
    }

    const { email, role, allowExtra, professorId } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = INVITE_ROLES.includes(role) ? role : ROLES.CONSULTOR;
    const asProfessor = normalizedRole === ROLES.PROFESSOR;

    if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (asProfessor) {
      const bad = professorIdProblem(professorId);
      if (bad) return res.status(bad.status).json({ error: bad.error });
    }

    // Vagas por PAPEL do convite: gestor além do incluso → upgrade; consultor
    // além do incluso pode entrar como EXTRA pago, com confirmação do admin
    // AQUI (quem aprova o custo é quem convida, não o convidado). A aprovação
    // fica gravada no convite (extraApproved) e o aceite revalida. Professor
    // não ocupa vaga, mas precisa do módulo e do professor do cadastro,
    // conferidos com a academia que o getSeatUsage já leu.
    const seats = await getSeatUsage(auth.tenantId);
    if (asProfessor) {
      const refused = await professorLinkRefusal({ tenantId: auth.tenantId, modules: seats.modules, professorId });
      if (refused) return res.status(refused.status).json({ error: refused.error });
    }
    const decision = canAddSeat(seats, normalizedRole, { allowExtra: allowExtra === true });
    if (!decision.ok) {
      if (decision.code === 'extra_confirm') {
        return res.status(409).json({
          error: decision.error,
          requiresExtraConfirmation: true,
          extraUserPrice: decision.extraUserPrice,
        });
      }
      return res.status(403).json({ error: decision.error });
    }

    const token = randomUUID();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const ref = await invitesCollection(auth.tenantId).add({
      email: normalizedEmail,
      role: normalizedRole,
      ...(asProfessor ? { professorId } : {}),
      token,
      status: 'pending',
      expiresAt,
      extraApproved: decision.isExtra === true, // admin aceitou o custo do consultor extra
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.uid
    });

    return res.status(200).json({
      ok: true,
      inviteId: ref.id,
      token,
      tenantId: auth.tenantId,
      email: normalizedEmail,
      role: normalizedRole,
      ...(asProfessor ? { professorId } : {}),
      expiresAt: expiresAt.toMillis()
    });
  } catch (error) {
    console.error('invite-create', error);
    return res.status(500).json({ error: 'Erro interno ao criar convite.' });
  }
});
```

- [ ] **Step 13: O aceite**

Em `api/invite-accept.js`, trocar as linhas 4 a 6:

```js
import { getSeatUsage, canAddSeat } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';
import { withSentry } from './_sentry.js';
```

por:

```js
import { getSeatUsage, canAddSeat } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';
import { professorLinkRefusal } from './_professorLink.js';
import { ROLES, roleOf } from '../src/lib/acesso.js';
import { normalizeModules } from '../src/lib/modules.js';
import { PROFESSOR_LINK_MESSAGES } from '../src/lib/teamRoles.js';
import { withSentry } from './_sentry.js';
```

Do `_plans.js`, continuam só o `getSeatUsage` e o `canAddSeat`, porque o `inviteAccept.test.js` troca o arquivo por um falso com essas duas funções.

Trocar as linhas 81 a 85:

```js
    const email = String(invite.email || '').trim().toLowerCase();
    const role = invite.role === 'admin' ? 'admin' : 'consultant';
    if (!email) {
      return res.status(400).json({ error: 'Convite sem e-mail válido.' });
    }
```

por:

```js
    const email = String(invite.email || '').trim().toLowerCase();
    // O papel que o convite gravou: gestor, professor ou consultor. Convite
    // antigo ou com papel desconhecido entra como consultor, como antes.
    const role = roleOf(invite);
    if (!email) {
      return res.status(400).json({ error: 'Convite sem e-mail válido.' });
    }

    // Convite de professor: nos 7 dias do convite, o módulo pode ter sido
    // desligado, o professor inativado ou ligado a outra pessoa. Confere de
    // novo, com a academia já lida, antes de criar a conta. Quem recebe o
    // aviso é o convidado, então a frase é uma só.
    if (role === ROLES.PROFESSOR) {
      const refused = await professorLinkRefusal({
        tenantId: slug, modules: normalizeModules(tData.modules), professorId: invite.professorId,
      });
      if (refused) return res.status(409).json({ error: PROFESSOR_LINK_MESSAGES.inviteStale });
    }
```

Trocar a linha 120 (dentro do `set` do cadastro):

```js
      role,
```

por:

```js
      role,
      ...(role === ROLES.PROFESSOR ? { professorId: invite.professorId } : {}),
```

E trocar a linha 134:

```js
    if (role === 'admin' && !tData.primaryAdminUid) {
```

por:

```js
    if (role === ROLES.GESTOR && !tData.primaryAdminUid) {
```

O cadastro continua nascendo em `usersCollection(slug).doc(userRecord.uid)`, com o id igual ao uid. É por esse id que as regras do Firestore (Task 11) reconhecem o professor.

- [ ] **Step 14: Cadastro, troca de papel e exclusão (`api/admin-users.js`)**

Trocar o bloco de import das linhas 4 a 16:

```js
import {
  usersCollection,
  isTenantAdmin,
  assertTargetInTenant,
  resolveTargetVerdict,
  targetVerdictError,
  TARGET_OK,
  TARGET_FOREIGN,
  TARGET_SUPERADMIN,
  passwordPolicyError,
  passwordRejection
} from './_auth.js';
import { maskEmail } from './_passwordReset.js';
```

por:

```js
import {
  dataCollection,
  usersCollection,
  isTenantAdmin,
  assertTargetInTenant,
  resolveTargetVerdict,
  targetVerdictError,
  TARGET_OK,
  TARGET_FOREIGN,
  TARGET_SUPERADMIN,
  passwordPolicyError,
  passwordRejection
} from './_auth.js';
import { maskEmail } from './_passwordReset.js';
import { professorLinkRefusal } from './_professorLink.js';
import { ROLES, roleOf } from '../src/lib/acesso.js';
import {
  SET_ROLE_ACTION,
  PROFESSOR_LINK_MESSAGES,
  planRoleChange,
  professorIdProblem
} from '../src/lib/teamRoles.js';
```

Do `_plans.js`, continuam só o `getSeatUsage` e o `canAddSeat`. Três testes (`adminUsers`, `adminUsersSetEmail` e `inviteAccept`) trocam o arquivo por um falso com essas duas funções.

Logo depois da linha 25 (`import { withSentry } from './_sentry.js';`), acrescentar:

```js

// Leads da academia, para a troca de papel conferir se a pessoa ainda tem
// carteira. O mesmo nome de coleção de src/lib/firebase.js.
const LEADS_PATH = 'stronix_leads';
```

Trocar as linhas 31 a 33:

```js
// motivo.
//
// Mantido o withSentry no export (os três originais eram todos envolvidos por
```

por:

```js
// motivo.
//
// A troca de papel (set-role) entrou do mesmo jeito, com o acesso de professor.
//
// Mantido o withSentry no export (os três originais eram todos envolvidos por
```

No roteador, trocar a linha 44:

```js
    case SET_EMAIL_ACTION: return handleSetEmail(req, res);
```

por:

```js
    case SET_EMAIL_ACTION: return handleSetEmail(req, res);
    case SET_ROLE_ACTION: return handleSetRole(req, res);
```

A ação nova fica na mesma função da Vercel, então continuam 11 das 12.

Trocar o bloco das linhas 51 a 138 (do `// ---- admin-create-user ----` até o fim do `handleCreate`) por:

```js
// ---- admin-create-user ----
//
// Cadastra consultor ou, com o módulo Professor e faltosos ligado, professor
// ligado a um professor do cadastro (role: 'professor' e professorId no
// corpo). Qualquer outro papel no pedido cria consultor, como sempre: gestor
// só entra por convite.
async function handleCreate(req, res) {
  try {
    // Autenticação: ID token verificado (não confiamos mais no body).
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { name, email, password, allowExtra, role, professorId } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: name, email, password.' });
    }

    const passwordProblem = passwordPolicyError(password);
    if (passwordProblem) {
      return res.status(400).json({ error: passwordProblem });
    }

    // O professor do cadastro tem formato de id, conferido antes de qualquer leitura.
    const newRole = role === ROLES.PROFESSOR ? ROLES.PROFESSOR : ROLES.CONSULTOR;
    if (newRole === ROLES.PROFESSOR) {
      const bad = professorIdProblem(professorId);
      if (bad) return res.status(bad.status).json({ error: bad.error });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode cadastrar consultores.' });
    }

    // Vagas por papel. Consultor além dos inclusos pode entrar como extra
    // pago, só com confirmação explícita do admin (allowExtra), para nunca
    // gerar cobrança surpresa. Professor não ocupa vaga, mas precisa do módulo
    // e do professor do cadastro, conferidos com a academia já lida.
    const seats = await getSeatUsage(auth.tenantId);
    if (newRole === ROLES.PROFESSOR) {
      const refused = await professorLinkRefusal({ tenantId: auth.tenantId, modules: seats.modules, professorId });
      if (refused) return res.status(refused.status).json({ error: refused.error });
    }
    const decision = canAddSeat(seats, newRole, { allowExtra: allowExtra === true });
    if (!decision.ok) {
      if (decision.code === 'extra_confirm') {
        return res.status(409).json({
          error: decision.error,
          requiresExtraConfirmation: true,
          extraUserPrice: decision.extraUserPrice,
        });
      }
      return res.status(403).json({ error: decision.error });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: normalizedName
      });
    } catch (err) {
      if (err?.code === 'auth/email-already-exists') {
        return res
          .status(409)
          .json({ error: 'Já existe uma conta com esse e-mail no Firebase Auth.' });
      }
      const rejected = passwordRejection(err, 'admin-create-user');
      if (rejected) return res.status(rejected.status).json({ error: rejected.error });
      throw err;
    }

    // Vincula o novo usuário ao MESMO tenant do admin que o criou.
    await adminAuth.setCustomUserClaims(userRecord.uid, { tenantId: auth.tenantId });

    await usersCollection(auth.tenantId)
      .doc(userRecord.uid)
      .set({
        name: normalizedName,
        email: normalizedEmail,
        authUid: userRecord.uid,
        role: newRole,
        ...(newRole === ROLES.PROFESSOR ? { professorId } : {}),
        tenantId: auth.tenantId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // Consultor EXTRA muda o preço → ajusta a assinatura Asaas (best-effort,
    // vale na próxima fatura; auditado em superadmin_audit).
    if (decision.isExtra) await syncSubscriptionValue(auth.tenantId, { actorUid: auth.uid });

    return res.status(200).json({ ok: true, authUid: userRecord.uid, role: newRole, isExtra: decision.isExtra === true });
  } catch (error) {
    console.error('admin-create-user', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar consultor.' });
  }
}
```

Na linha 199, entre o fim do `handleSetPassword` (a `}` da linha 198) e o comentário `// ---- admin-set-email ----` da linha 200, acrescentar o `handleSetRole`. A ordem segue a D2: a carteira é conferida antes da vaga, com o nome da tela "Configurações → Migrar leads" (`src/lib/settingsRail.js:21`).

```js
// ---- admin-set-role ----
//
// Troca o papel entre Consultor e Professor, ou o professor do cadastro
// ligado a quem já é professor. Gestor da academia only. O papel do gestor
// não muda por aqui, e ninguém troca o próprio papel. Professor exige o
// módulo Professor e faltosos, um professor ativo do cadastro sem outro login,
// carteira vazia (o professor não é dono de lead) e cadastro com id igual ao
// uid da conta (é por esse id que as regras do Firestore leem o papel).
// Professor que volta a consultor ocupa vaga de consultor, com a mesma regra
// do cadastro (extra pago só com allowExtra).
//
// O cliente não grava role nem professorId (as regras travam os dois): a vaga,
// o módulo e o professor são conferidos aqui. Com o papel trocado, as sessões
// da pessoa são revogadas e ela entra de novo já com o menu novo. As regras
// leem o papel a cada pedido, então a trava vale na hora.
async function handleSetRole(req, res) {
  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { userDocId, role, professorId, allowExtra } = req.body || {};
    if (typeof userDocId !== 'string' || !userDocId) {
      return res.status(400).json({ error: 'Campo obrigatório: userDocId.' });
    }
    if (role !== ROLES.CONSULTOR && role !== ROLES.PROFESSOR) {
      return res.status(400).json({ error: 'Por aqui o papel muda só entre Consultor e Professor.' });
    }
    if (role === ROLES.PROFESSOR) {
      const bad = professorIdProblem(professorId);
      if (bad) return res.status(bad.status).json({ error: bad.error });
    }

    if (!(await isTenantAdmin(auth.tenantId, auth.uid))) {
      return res.status(403).json({ error: 'Apenas o master pode trocar o papel de alguém.' });
    }

    const ref = usersCollection(auth.tenantId).doc(userDocId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' });
    }
    const member = snap.data() || {};
    if (snap.id === auth.uid || member.authUid === auth.uid) {
      return res.status(400).json({ error: 'Você não pode trocar o seu próprio papel.' });
    }
    const from = roleOf(member);
    if (from === ROLES.GESTOR) {
      return res.status(400).json({ error: 'O papel do gestor não muda por aqui.' });
    }

    // O cadastro é escrito pelo próprio gestor: quem prova que a conta é desta
    // academia é o claim do Auth, como no delete. Cadastro sem conta segue.
    const verdict = await resolveTargetVerdict(member.authUid || null, auth.tenantId);
    if (verdict === TARGET_FOREIGN || verdict === TARGET_SUPERADMIN) {
      const denied = targetVerdictError(verdict);
      return res.status(denied.status).json({ error: denied.error });
    }

    const change = planRoleChange(member, { role, professorId });
    if (!change) return res.status(200).json({ ok: true, changed: false });

    if (change.role === ROLES.PROFESSOR && from !== ROLES.PROFESSOR) {
      // Professor não é dono de lead: a carteira passa antes, em
      // Configurações → Migrar leads, que move pelo consultantId.
      const owned = await dataCollection(auth.tenantId, LEADS_PATH)
        .where('consultantId', '==', snap.id).limit(1).get();
      if (!owned.empty) {
        return res.status(409).json({ error: PROFESSOR_LINK_MESSAGES.ownsLeads(member.name) });
      }
      // As regras leem o papel em stronix_users/{uid}. No cadastro antigo, de
      // id diferente do uid, elas não veriam o professor e deixariam a pessoa
      // gravar como consultor.
      if (!member.authUid || member.authUid !== snap.id) {
        return res.status(422).json({ error: PROFESSOR_LINK_MESSAGES.legacyRecord(member.name) });
      }
    }

    const seats = await getSeatUsage(auth.tenantId);
    let decision = { ok: true };
    if (change.role === ROLES.PROFESSOR) {
      const refused = await professorLinkRefusal({
        tenantId: auth.tenantId, modules: seats.modules, professorId: change.professorId, exceptUserId: snap.id,
      });
      if (refused) return res.status(refused.status).json({ error: refused.error });
    } else {
      decision = canAddSeat(seats, ROLES.CONSULTOR, { allowExtra: allowExtra === true });
      if (!decision.ok) {
        if (decision.code === 'extra_confirm') {
          return res.status(409).json({
            error: decision.error,
            requiresExtraConfirmation: true,
            extraUserPrice: decision.extraUserPrice,
          });
        }
        return res.status(403).json({ error: decision.error });
      }
    }

    // O professor não prospecta: a meta de prospecção sai junto.
    await ref.update(change.role === ROLES.PROFESSOR
      ? { role: ROLES.PROFESSOR, professorId: change.professorId, dailyVolumeTarget: admin.firestore.FieldValue.delete() }
      : { role: ROLES.CONSULTOR, professorId: admin.firestore.FieldValue.delete() });

    // Professor que vira consultor extra sobe o preço; consultor que vira
    // professor, com extras em uso, libera uma vaga paga.
    const freedExtra = from === ROLES.CONSULTOR && seats.extraConsultants > 0;
    if (decision.isExtra || freedExtra) await syncSubscriptionValue(auth.tenantId, { actorUid: auth.uid });

    if (verdict === TARGET_OK && from !== change.role) {
      try {
        await adminAuth.revokeRefreshTokens(member.authUid);
      } catch (err) {
        console.error('admin-set-role: as sessões não foram revogadas.', { academia: auth.tenantId, conta: member.authUid, codigo: err?.code || null });
      }
    }

    console.info('admin-set-role', { academia: auth.tenantId, cadastro: snap.id, de: from, para: change.role, por: auth.uid });
    return res.status(200).json({ ok: true, changed: true, role: change.role, isExtra: decision.isExtra === true });
  } catch (error) {
    console.error('admin-set-role', error);
    return res.status(500).json({ error: 'Erro interno ao trocar o papel.' });
  }
}

```

No `handleDelete`, trocar a linha 403:

```js
    const deletedRole = docSnap.data()?.role || 'consultant';
```

por:

```js
    const deletedRole = roleOf(docSnap.data());
```

E trocar as linhas 420 a 422:

```js
    // Excluir consultor com extras faturáveis em uso muda o preço → sync depois.
    let hadExtras = false;
    if (deletedRole !== 'admin') {
```

por:

```js
    // Excluir consultor com extras faturáveis em uso muda o preço → sync depois.
    // Só consultor ocupa vaga paga: excluir gestor ou professor não muda o
    // preço, então não há o que sincronizar.
    let hadExtras = false;
    if (deletedRole === ROLES.CONSULTOR) {
```

O `set-password` e o `set-email` não mudam: eles não olham o papel e servem ao professor do mesmo jeito.

- [ ] **Step 15: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/teamRoles.test.js src/lib/__tests__/teamRolesImports.test.js api/__tests__/plansSeats.test.js api/__tests__/professorAccess.test.js api/__tests__/adminUsers.test.js api/__tests__/adminUsersSetEmail.test.js api/__tests__/inviteAccept.test.js api/__tests__/provisionTenant.test.js`
Expected: PASS, `Test Files  8 passed (8)` e `Tests  95 passed (95)`. São 21 + 2 + 8 + 28 nos arquivos novos e 5 + 23 + 2 + 6 nos de antes.

Run: `npx vitest run api`
Expected: PASS, todos os arquivos de `api/__tests__` verdes. Na main de partida eram 27 arquivos e 895 testes, e esta task soma 2 arquivos e 36 testes. As Tasks 4 e 10 somam os delas.

Run: `npx eslint api/_plans.js api/_professorLink.js api/invite-create.js api/invite-accept.js api/admin-users.js src/lib/teamRoles.js src/lib/__tests__/teamRoles.test.js src/lib/__tests__/teamRolesImports.test.js api/__tests__/plansSeats.test.js api/__tests__/professorAccess.test.js`
Expected: nenhuma saída.

- [ ] **Step 16: Commit**

```bash
git add src/lib/teamRoles.js api/_professorLink.js api/_plans.js api/invite-create.js api/invite-accept.js api/admin-users.js src/lib/__tests__/teamRoles.test.js src/lib/__tests__/teamRolesImports.test.js api/__tests__/plansSeats.test.js api/__tests__/professorAccess.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: papel Professor no convite, no cadastro e na troca de papel, fora das vagas de consultor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Equipe & acessos (`src/views/settings/TeamAccessSection.jsx`, `src/lib/settingsSetup.js`, `src/views/settings/OverviewSection.jsx`, `src/views/settings/PaceSection.jsx`)

> Esta task depende de:
> - Task 5: `src/lib/teamRoles.js` e a ação `set-role`;
> - Tasks 1 e 2;
> - Task 3, que guarda os módulos em `appUser.tenantModules` no login.
>
> Sem a Task 3, a tela fica como hoje, sem o papel Professor, porque `hasModule(undefined, ...)` dá false.
>
> Pela D10, o `SettingsView.jsx` e o `App.jsx` não mudam aqui. O `TeamAccessSection` já recebe o `appUser` (`SettingsView.jsx:158`) e lê `appUser?.tenantModules`.
>
> Todo `role === 'admin'` destes quatro arquivos sai daqui:
> - `TeamAccessSection.jsx`: linhas 167, 347, 523, 527 e 548;
> - `settingsSetup.js`: linha 30;
> - `OverviewSection.jsx`: linha 94;
> - `PaceSection.jsx`: linha 272.
>
> A varredura `acessoSweep.test.js`, da Task 9, cobra que eles não voltem. O código novo compara o papel só por `roleOf`, `isGestor`, `isProfessor` e `ROLES.*`. Um `form.role === 'professor'` reprovaria a varredura.
>
> Quem trava `role` e `professorId` contra o navegador é a regra da Task 11 (D11). Esta tela nunca grava esses dois campos.

**Files:**
- Modify: `src/lib/settingsSetup.js:8-10` (import), `:30` (sai `isManager`), `:47` (`consultants`)
- Modify: `src/views/settings/OverviewSection.jsx:6-7` (import), `:94` (dica de assentos)
- Modify: `src/views/settings/PaceSection.jsx:7-8` (import), `:80` (lista de quem vende logo depois), `:264-272` (meta de prospecção)
- Modify: `src/views/settings/TeamAccessSection.jsx`: linhas 7-8, 21-26, 50-53, 69, 85-90, 100, 121, 145-180, 204-237, 239-247, 265-267, 296-298, 347, 368-376, 465-466, 487-492, 500, 520-537, 548, 560, 578-579, 589-592, 607, 635, 650, 661-665, 679
- Test: `src/lib/__tests__/settingsSetup.test.js` (bloco novo no fim)
- Test: `src/lib/__tests__/teamAccessProfessor.test.js` (novo)

- [ ] **Step 1: Escrever os testes da Visão geral**

No fim de `src/lib/__tests__/settingsSetup.test.js`, que já tem o `complete`, acrescentar:

```js

// O professor (módulo Professor e faltosos) não é consultor: não prospecta e
// não ocupa vaga. Mas entra no app, então pesa no passo de acessos.
describe('buildSetupState — professor', () => {
  it('professor sem meta de prospecção não deixa o passo pendente', () => {
    const s = buildSetupState(complete({
      usersList: [
        ...complete().usersList,
        { id: 'u3', name: 'Rafael', role: 'professor', professorId: 'p1', authUid: 'uid-3' },
      ],
    }));
    expect(s.steps.find(x => x.id === 'prospect').done).toBe(true);
    expect(s.pendings.find(x => x.id === 'prospect')).toBeUndefined();
  });

  it('só gestor e professor na equipe: ainda não há consultor para a prospecção', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u3', name: 'Rafael', role: 'professor', professorId: 'p1', authUid: 'uid-3' },
      ],
    }));
    expect(s.steps.find(x => x.id === 'prospect').done).toBe(false);
    expect(s.pendings.find(x => x.id === 'prospect')).toBeUndefined();
  });

  it('professor sem login ainda pesa no passo de acessos', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u3', name: 'Rafael', role: 'professor', professorId: 'p1', authUid: '' },
      ],
    }));
    expect(s.steps.find(x => x.id === 'access').done).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/settingsSetup.test.js`
Expected: FAIL, `Tests  2 failed | 16 passed (18)`. Hoje o professor conta como consultor sem meta: o passo `prospect` fica pendente e aparece "1 consultor sem meta de prospecção". O terceiro caso, o de acessos, já passa e trava o comportamento.

- [ ] **Step 3: Implementar a Visão geral**

Em `src/lib/settingsSetup.js`, trocar as linhas 8 a 10:

```js
// o que mantém a regra testável sem montar componente.

// Passos na ordem em que aparecem no rodapé do card de progresso.
```

por:

```js
// o que mantém a regra testável sem montar componente.

import { roleOf, ROLES } from './acesso.js';

// Passos na ordem em que aparecem no rodapé do card de progresso.
```

Apagar a linha 30:

```js
const isManager = (u) => u?.role === 'admin';
```

E trocar a linha 47:

```js
  const consultants = users.filter(u => !isManager(u));
```

por:

```js
  // Prospecção é do consultor. O gestor tem meta à parte e o professor não
  // prospecta. Cadastro sem papel conta como consultor (roleOf).
  const consultants = users.filter(u => roleOf(u) === ROLES.CONSULTOR);
```

O `usersWithoutAccess` (linha 48) continua contando todo mundo, professor incluído.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/settingsSetup.test.js`
Expected: PASS, `Tests  18 passed (18)`.

- [ ] **Step 5: Dica de assentos e meta de prospecção**

Estes dois arquivos não têm teste próprio. Quem cobra que o `role === 'admin'` deles não volte é a varredura da Task 9. A regra da prospecção é a mesma do `settingsSetup.js`, já testada no Step 1.

Em `src/views/settings/OverviewSection.jsx`, trocar as linhas 6 e 7:

```js
import { cn } from '../../lib/utils.js';
import { useSeatLimits } from '../../hooks/useSeatLimits.js';
```

por:

```js
import { cn } from '../../lib/utils.js';
import { roleOf, ROLES } from '../../lib/acesso.js';
import { useSeatLimits } from '../../hooks/useSeatLimits.js';
```

E trocar a linha 94:

```js
    const consultants = (usersList || []).filter(u => u.role !== 'admin').length;
```

por:

```js
    // Só consultor ocupa assento de consultor, a mesma conta do api/_plans.js:
    // o gestor tem vaga própria e o professor não ocupa nenhuma.
    const consultants = (usersList || []).filter(u => roleOf(u) === ROLES.CONSULTOR).length;
```

O "na equipe" (linha 128) continua contando todo mundo com acesso. O atalho "Cadastrar consultor" (linha 162) mantém o nome, porque a Visão geral não recebe o `appUser`.

Em `src/views/settings/PaceSection.jsx`, trocar as linhas 7 e 8:

```js
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
```

por:

```js
import { cn } from '../../lib/utils.js';
import { isGestor, isSeller } from '../../lib/acesso.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
```

Logo depois da linha 80 (`const [savingCheckpoints, setSavingCheckpoints] = useState(false);`), acrescentar:

```js
  // A meta de prospecção é de quem vende: gestor e consultor. O professor não
  // prospecta e fica fora da lista.
  const sellers = (usersList || []).filter(isSeller);
```

Trocar as linhas 264 a 268:

```jsx
          {(usersList || []).map((u, i) => (
            <div
              key={u.id}
              className={cn('flex items-center gap-3 px-5 py-3', i < (usersList || []).length - 1 && 'border-b border-border')}
            >
```

por:

```jsx
          {sellers.map((u, i) => (
            <div
              key={u.id}
              className={cn('flex items-center gap-3 px-5 py-3', i < sellers.length - 1 && 'border-b border-border')}
            >
```

E trocar a linha 272:

```jsx
              <span className="text-[13.5px] flex-1 truncate">{u.name}{u.role === 'admin' ? ' (gestor)' : ''}</span>
```

por:

```jsx
              <span className="text-[13.5px] flex-1 truncate">{u.name}{isGestor(u) ? ' (gestor)' : ''}</span>
```

Run: `grep -nE "role (===|!==) '" src/lib/settingsSetup.js src/views/settings/OverviewSection.jsx src/views/settings/PaceSection.jsx`
Expected: nenhuma linha.

- [ ] **Step 6: Escrever o teste da tela da equipe**

Criar `src/lib/__tests__/teamAccessProfessor.test.js`:

```js
// @vitest-environment jsdom
// O papel Professor em Equipe & acessos. Só aparece com o módulo Professor e
// faltosos ligado (appUser.tenantModules, lido no login), pede o professor do
// cadastro (só os ativos e sem login), mostra o selo e o professor ligado na
// lista e troca o papel pelo servidor (set-role do /api/admin-users) antes de
// gravar o resto do cadastro. Sem Firebase de verdade.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { updateDoc, deleteDoc } from 'firebase/firestore';
import { TeamAccessSection } from '../../views/settings/TeamAccessSection.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { MODULES } from '../modules.js';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
// O que a tela fez, na ordem: chamadas à API e gravações do cadastro.
const ordem = vi.hoisted(() => []);

vi.mock('../firebase.js', () => ({
  auth: { currentUser: { getIdToken: async () => 'token-do-gestor' } },
  appId: 'academia-teste',
  LEADS_PATH: 'stronix_leads',
  PROFESSORS_PATH: 'stronix_professores',
  USERS_PATH: 'stronix_users',
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  query: (ref, ...filtros) => ({ ref, filtros }),
  where: (...args) => args,
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  updateDoc: vi.fn(async (ref) => { ordem.push(['cadastro', ref.caminho]); }),
  addDoc: vi.fn(async () => {}),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  deleteField: () => 'apagar',
  serverTimestamp: () => 'agora',
  writeBatch: vi.fn(),
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
// A faixa de assentos busca o plano na API. Fora do teste.
vi.mock('../../hooks/useSeatLimits.js', () => ({ useSeatLimits: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GESTOR = { id: 'gestor-1', authUid: 'gestor-1', name: 'Gestor', email: 'gestor@academia.com', role: 'admin' };
const ANA = { id: 'uid-ana', authUid: 'uid-ana', name: 'Ana', email: 'ana@academia.com', role: 'consultant', dailyVolumeTarget: 20 };
const RAFA = { id: 'uid-rafa', authUid: 'uid-rafa', name: 'Rafa', email: 'rafa@academia.com', role: 'professor', professorId: 'prof-rafa' };
const EQUIPE = [GESTOR, ANA, RAFA];

const PROFESSORES = [
  { id: 'prof-rafa', nome: 'Rafael Menezes', ativo: true, modalidadeIds: [] },
  { id: 'prof-lu', nome: 'Luana Prado', modalidadeIds: [] },
  { id: 'prof-velho', nome: 'Carlos Antigo', ativo: false, modalidadeIds: [] },
];

let root = null;
let respostas = [];

beforeEach(() => {
  ordem.length = 0;
  updateDoc.mockClear();
  deleteDoc.mockClear();
  for (const fn of Object.values(toast)) fn.mockClear();
  respostas = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    ordem.push(['api', url, JSON.parse(init.body)]);
    const r = respostas.shift() ?? { status: 200, body: { ok: true, changed: true, token: 'convite-1', tenantId: 'academia-teste' } };
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  }));
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.unstubAllGlobals();
});

// Os módulos chegam no appUser, como o App.jsx guarda no login.
async function montar({ modules = [MODULES.FALTOSOS] } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(
      GeneralConfigContext.Provider,
      { value: { modalities: [], professores: PROFESSORES } },
      h(TeamAccessSection, { db: {}, appUser: { ...GESTOR, tenantModules: modules }, usersList: EQUIPE, leads: [] })
    ));
  });
}

async function escrever(el, valor) {
  const ehSelect = el instanceof window.HTMLSelectElement;
  const proto = ehSelect ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event(ehSelect ? 'change' : 'input', { bubbles: true }));
  });
}

// O Salvar espera o token, a API e o Firestore, então o clique deixa o relógio
// dar uma volta antes de o act fechar.
async function clicar(el) {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
// O campo do diálogo pelo rótulo do DialogField.
const campo = (rotulo) => [...document.querySelectorAll('label')]
  .find((l) => l.firstElementChild?.textContent === rotulo)
  ?.querySelector('input, select') ?? null;
const opcoes = (select) => [...select.options].filter((o) => !o.disabled).map((o) => o.textContent);
const editar = (i) => clicar(document.querySelectorAll('button[title="Editar membro"]')[i]);
const linhas = () => [...document.querySelectorAll('button[title="Editar membro"]')].map((b) => b.parentElement.parentElement);
const chamadasDaApi = () => ordem.filter(([tipo]) => tipo === 'api');

describe('Equipe & acessos sem o módulo', () => {
  it('fica como sempre: Cadastrar consultor e cadastro sem papel', async () => {
    await montar({ modules: [] });
    expect(botao('Cadastrar consultor')).toBeTruthy();
    await clicar(botao('Cadastrar consultor'));
    expect(campo('Papel')).toBeNull();
  });

  it('o convite não oferece Professor', async () => {
    await montar({ modules: [] });
    await clicar(botao('Convidar por e-mail'));
    expect(opcoes(campo('Papel'))).toEqual(['Consultor', 'Gestor (admin)']);
  });

  it('quem já é professor continua com o selo, e o professor ligado não troca', async () => {
    await montar({ modules: [] });
    expect(linhas()[2].textContent).toContain('Professor');
    await editar(2);
    expect(campo('Papel').value).toBe('professor');
    expect(campo('Professor do cadastro').disabled).toBe(true);
  });
});

describe('Equipe & acessos com o módulo', () => {
  it('a lista mostra o papel de cada um e o professor ligado, sem meta de prospecção para o professor', async () => {
    await montar();
    const [gestor, ana, rafa] = linhas();
    expect(gestor.textContent).toContain('Gestor');
    expect(ana.textContent).toContain('Consultor');
    expect(ana.textContent).toContain('20/dia');
    expect(rafa.textContent).toContain('Professor');
    expect(rafa.textContent).toContain('Rafael Menezes');
    expect(rafa.textContent).not.toContain('sem meta');
  });

  it('o convite de professor só oferece professor ativo e sem login, e manda o id', async () => {
    await montar();
    await clicar(botao('Convidar por e-mail'));
    expect(opcoes(campo('Papel'))).toEqual(['Consultor', 'Gestor (admin)', 'Professor']);
    await escrever(campo('E-mail do convidado'), 'lu@academia.com');
    await escrever(campo('Papel'), 'professor');
    // Rafael já tem login e Carlos está inativo: sobra a Luana.
    expect(opcoes(campo('Professor do cadastro'))).toEqual(['Luana Prado']);
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Gerar convite'));
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/invite-create', { email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', allowExtra: false }],
    ]);
  });

  it('cadastrar pessoa como professor manda papel e professor ao /api/admin-users', async () => {
    await montar();
    await clicar(botao('Cadastrar pessoa'));
    await escrever(campo('Nome'), 'Luana');
    await escrever(campo('E-mail de login'), 'lu@academia.com');
    await escrever(campo('Papel'), 'professor');
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Cadastrar'));
    const [[, url, corpo]] = chamadasDaApi();
    expect(url).toBe('/api/admin-users');
    expect(corpo).toMatchObject({
      action: 'create', name: 'Luana', email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', allowExtra: false,
    });
    expect(toast.success.mock.calls[0][0]).toMatch(/^Professor Luana cadastrado\./);
  });

  it('cadastrar pessoa como consultor manda o pedido de sempre, sem papel', async () => {
    await montar();
    await clicar(botao('Cadastrar pessoa'));
    await escrever(campo('Nome'), 'Bia');
    await escrever(campo('E-mail de login'), 'bia@academia.com');
    await clicar(botao('Cadastrar'));
    const [[, , corpo]] = chamadasDaApi();
    expect(corpo).toMatchObject({ action: 'create', name: 'Bia', email: 'bia@academia.com' });
    expect(corpo).not.toHaveProperty('role');
    expect(corpo).not.toHaveProperty('professorId');
    expect(toast.success.mock.calls[0][0]).toMatch(/^Consultor Bia cadastrado\./);
  });

  it('editar: professor que volta a consultor passa pelo set-role antes de gravar o cadastro', async () => {
    await montar();
    await editar(2);
    expect(campo('Papel').value).toBe('professor');
    expect(campo('Professor do cadastro').value).toBe('prof-rafa');
    expect(opcoes(campo('Professor do cadastro'))).toEqual(['Rafael Menezes', 'Luana Prado']);
    await escrever(campo('Papel'), 'consultant');
    await clicar(botao('Salvar alterações'));

    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-rafa', role: 'consultant', allowExtra: false }],
    ]);
    expect(ordem.map(([tipo]) => tipo)).toEqual(['api', 'cadastro']);
    const [, dados] = updateDoc.mock.calls[0];
    expect(dados).not.toHaveProperty('role');
    expect(dados).not.toHaveProperty('professorId');
    expect(toast.success).toHaveBeenCalledWith('Cadastro atualizado.');
  });

  it('set-role recusado mostra o erro do servidor e não grava o cadastro', async () => {
    const erro = 'Ana ainda tem leads na carteira. Passe os leads em Configurações → Migrar leads antes de mudar o papel para Professor.';
    respostas = [{ status: 409, body: { error: erro } }];
    await montar();
    await editar(1);
    await escrever(campo('Papel'), 'professor');
    await escrever(campo('Professor do cadastro'), 'prof-lu');
    await clicar(botao('Salvar alterações'));
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-role', userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu', allowExtra: false }],
    ]);
    expect(toast.error).toHaveBeenCalledWith(erro);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('o gestor não tem campo de papel', async () => {
    await montar();
    await editar(0);
    expect(campo('Papel')).toBeNull();
  });

  it('professor do cadastro com login não pode ser excluído', async () => {
    await montar();
    await clicar(document.querySelector('button[title="Excluir Rafael Menezes"]'));
    expect(toast.warning.mock.calls[0][0]).toContain('tem acesso ao app');
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/teamAccessProfessor.test.js`
Expected: FAIL, `Tests  8 failed | 3 passed (11)`. O que falta hoje:
- os campos "Papel" e "Professor do cadastro";
- o botão "Cadastrar pessoa";
- o selo de professor, porque a lista mostra "Consultor" e "sem meta";
- a chamada ao `set-role`;
- a trava do "Excluir": ela não acontece, e o `confirm` é chamado.

Já passam "fica como sempre", "o convite não oferece Professor" e "o gestor não tem campo de papel", que travam o que não pode mudar.

- [ ] **Step 8: Implementar a tela**

Em `src/views/settings/TeamAccessSection.jsx`, de cima para baixo. As linhas citadas são as do arquivo antes de qualquer troca.

Trocar as linhas 7 e 8:

```js
import { professorModalityNames } from '../../lib/professores.js';
import { generateTemporaryPassword, passwordPolicyError, PASSWORD_RULE_TEXT } from '../../lib/passwordPolicy.js';
```

por:

```js
import { professorModalityNames, professorNameById } from '../../lib/professores.js';
import { generateTemporaryPassword, passwordPolicyError, PASSWORD_RULE_TEXT } from '../../lib/passwordPolicy.js';
import { isGestor, isProfessor, roleLabel, roleOf, ROLES } from '../../lib/acesso.js';
import { hasModule, MODULES } from '../../lib/modules.js';
import {
  availableProfessors, inviteRoleOptions, linkedProfessorIds, linkedProfessorText,
  planRoleChange, PROFESSOR_LINK_MESSAGES, SET_ROLE_ACTION
} from '../../lib/teamRoles.js';
```

Trocar as linhas 21 a 26:

```js
// Equipe & acessos — quem entra no app, com qual papel, turno e piso de
// prospecção; e, num card à parte, os professores que conduzem aula
// experimental (catálogo simples, sem login).
//
// Os caminhos de escrita são os mesmos de antes do redesign (/api/admin-*,
// /api/invite-create e o doc do usuário): mudou a casca, não a regra.
```

por:

```js
// Equipe & acessos: quem entra no app, com qual papel, turno e piso de
// prospecção; e, num card à parte, os professores que conduzem aula
// experimental (catálogo simples). Com o módulo Professor e faltosos ligado
// (appUser.tenantModules), o professor do cadastro pode ganhar login com o
// papel Professor (src/lib/teamRoles.js).
//
// Os caminhos de escrita são os mesmos de antes do redesign (/api/admin-*,
// /api/invite-create e o doc do usuário): mudou a casca, não a regra. O papel
// e o professor ligado só mudam pelo servidor (set-role), nunca pelo cliente.
```

Trocar as linhas 50 a 53:

```js
const initialsOf = (name) => (name || '?')
  .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const emptyForm = { name: '', email: '', password: '', shiftStart: '', shiftEnd: '', dailyVolumeTarget: '' };
```

por:

```js
// Selo do papel na lista. O professor tem cor própria para não se confundir
// com o consultor, que é quem ocupa vaga do plano.
const ROLE_BADGE = {
  [ROLES.GESTOR]: 'bg-accent-500/[0.14] text-accent-600 dark:text-accent-400',
  [ROLES.CONSULTOR]: 'bg-muted text-slate-600 dark:text-slate-300',
  [ROLES.PROFESSOR]: 'bg-violet-500/[0.12] text-violet-700 dark:text-violet-300'
};

const initialsOf = (name) => (name || '?')
  .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const emptyForm = {
  name: '', email: '', password: '', shiftStart: '', shiftEnd: '', dailyVolumeTarget: '',
  role: ROLES.CONSULTOR, professorId: ''
};
```

Trocar a linha 69:

```jsx
function SeatBand({ seats, consultantCount }) {
```

por:

```jsx
function SeatBand({ seats, consultantCount, professorCount = 0 }) {
```

Trocar as linhas 85 a 90:

```jsx
        {seats.extraUserPrice != null && (
          <div className="text-[12px] text-muted-foreground mt-0.5">
            O {seats.maxConsultants + 1}º consultor entra como extra: +R$ {Number(seats.extraUserPrice).toLocaleString('pt-BR')}/mês, válido a partir da próxima fatura.
          </div>
        )}
      </div>
```

por:

```jsx
        {seats.extraUserPrice != null && (
          <div className="text-[12px] text-muted-foreground mt-0.5">
            O {seats.maxConsultants + 1}º consultor entra como extra: +R$ {Number(seats.extraUserPrice).toLocaleString('pt-BR')}/mês, válido a partir da próxima fatura.
          </div>
        )}
        {professorCount > 0 && (
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {professorCount === 1 ? '1 professor com acesso' : `${professorCount} professores com acesso`}, fora das vagas de consultor.
          </div>
        )}
      </div>
```

Trocar a linha 100:

```jsx
function ProfessorRow({ professor, modalities, aulas, share, conversion, last, onEdit, onDelete }) {
```

por:

```jsx
function ProfessorRow({ professor, modalities, aulas, share, conversion, last, withLogin = false, onEdit, onDelete }) {
```

Trocar a linha 121:

```jsx
          <div className="text-[11.5px] text-muted-foreground truncate">{mods.length ? mods.join(' · ') : 'Sem modalidade'}</div>
```

por:

```jsx
          <div className="text-[11.5px] text-muted-foreground truncate">
            {mods.length ? mods.join(' · ') : 'Sem modalidade'}{withLogin ? ' · com acesso ao app' : ''}
          </div>
```

Trocar as linhas 145 a 180, de `function TeamAccessSection(` até o `};` que fecha o `openEdit`. O `ProfessorPicker` novo entra antes do componente, e tudo que depende do diálogo é calculado no render, sem efeito:

```jsx
// Escolha do professor do cadastro que a pessoa é: só os ativos e sem login,
// mais o próprio professor de quem está sendo editado.
function ProfessorPicker({ value, options, onChange, disabled = false }) {
  return (
    <DialogField
      label="Professor do cadastro"
      hint={options.length === 0
        ? 'Nenhum professor ativo sem acesso. Cadastre o professor no card Professores, mais abaixo.'
        : 'Cada professor do cadastro tem um login só.'}
    >
      <select className={FIELD_INPUT} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} required>
        <option value="" disabled>Escolha o professor</option>
        {options.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </DialogField>
  );
}

function TeamAccessSection({ db, appUser, usersList, leads, focusId, onFocusHandled }) {
  const toast = useToast();
  const { professores, modalities } = useGeneralConfig();
  const seats = useSeatLimits();
  // Módulos da academia, lidos no login e guardados no appUser
  // (src/lib/modules.js). Sem o Professor e faltosos, a tela fica como sempre.
  const tenantModules = appUser?.tenantModules;
  const professorEnabled = hasModule(tenantModules, MODULES.FALTOSOS);

  const [memberDialog, setMemberDialog] = useState(null); // null | {mode:'create'|'edit', user}
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(ROLES.CONSULTOR);
  const [inviteProfessorId, setInviteProfessorId] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviting, setInviting] = useState(false);

  const [profDialog, setProfDialog] = useState(null); // null | {professor}
  const [profName, setProfName] = useState('');
  const [profMods, setProfMods] = useState([]);

  const rowRefs = useRef({});

  const users = useMemo(() => usersList || [], [usersList]);
  // Só consultor ocupa vaga de consultor do plano: o gestor tem a vaga dele e
  // o professor não ocupa nenhuma (a mesma conta do api/_plans.js).
  const consultantCount = users.filter(u => roleOf(u) === ROLES.CONSULTOR).length;
  const professorCount = users.filter(u => isProfessor(u)).length;
  const professorLogins = linkedProfessorIds(users);
  const createLabel = professorEnabled ? 'Cadastrar pessoa' : 'Cadastrar consultor';

  // Diálogo de membro, calculado no render. O papel aparece no cadastro com o
  // módulo ligado e na edição de quem não é gestor, quando o módulo está ligado
  // ou a pessoa já é professor (o módulo pode ter sido desligado depois).
  const editingUser = memberDialog?.mode === 'edit' ? memberDialog.user : null;
  const showRoleField = editingUser
    ? !isGestor(editingUser) && (professorEnabled || isProfessor(editingUser))
    : professorEnabled;
  const creatingProfessor = memberDialog?.mode === 'create' && form.role === ROLES.PROFESSOR;
  const memberProfessorOptions = availableProfessors(professores, users, {
    exceptUserId: editingUser?.id ?? null,
    keepId: editingUser?.professorId ?? null
  });
  const inviteProfessorOptions = availableProfessors(professores, users);

  const openCreate = () => { setForm({ ...emptyForm, password: generateTemporaryPassword() }); setMemberDialog({ mode: 'create' }); };
  const openEdit = (user) => {
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      shiftStart: user.shiftStart || '',
      shiftEnd: user.shiftEnd || '',
      dailyVolumeTarget: user.dailyVolumeTarget != null ? String(user.dailyVolumeTarget) : '',
      role: roleOf(user),
      professorId: user.professorId || ''
    });
    setMemberDialog({ mode: 'edit', user });
  };
```

Trocar a função inteira `createMember` (linhas 204 a 237) por:

```jsx
  const createMember = async (allowExtra = false) => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.warning('Preencha nome, e-mail e senha temporária.');
      return;
    }
    const passwordProblem = passwordPolicyError(form.password);
    if (passwordProblem) { toast.warning(passwordProblem); return; }
    // Professor nasce ligado a um professor do cadastro. O servidor confere de
    // novo: módulo ligado, professor ativo e sem outro login.
    const asProfessor = form.role === ROLES.PROFESSOR;
    if (asProfessor && !form.professorId) { toast.warning(PROFESSOR_LINK_MESSAGES.missing); return; }
    const noun = asProfessor ? 'professor' : 'consultor';
    if (!appUser?.authUid) { toast.error('Sessão sem authUid. Reentre no sistema.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({
          action: 'create', name: form.name.trim(), email: normalizeEmail(form.email), password: form.password, allowExtra,
          ...(asProfessor ? { role: ROLES.PROFESSOR, professorId: form.professorId } : {})
        })
      });
      const data = await res.json();
      if (res.status === 409 && data?.requiresExtraConfirmation) {
        setSaving(false);
        if (confirmExtra(data.extraUserPrice)) return createMember(true);
        return;
      }
      if (!res.ok) { toast.error(data.error || `Erro ao cadastrar ${noun}.`); return; }

      toast.success(`${asProfessor ? 'Professor' : 'Consultor'} ${form.name.trim()} cadastrado. Senha temporária: ${form.password}`, { duration: 8000, title: 'Cadastrado com sucesso' });
      if (data.isExtra) toast.info('Este consultor entrou como extra — a mensalidade foi ajustada a partir da próxima fatura.', { duration: 8000 });
      setMemberDialog(null);
    } catch (err) {
      console.error(err);
      toast.error(`Falha de rede ao cadastrar ${noun}.`);
    } finally {
      setSaving(false);
    }
  };
```

O pedido do consultor sai igual ao de hoje, sem `role`, e os textos do consultor não mudam. O aviso do extra mantém o texto de hoje.

Trocar as linhas 239 a 247 (o começo do `updateMember`, até o fim da conferência da senha). O `changeRole` novo entra antes:

```jsx
  // Papel e professor ligado mudam pelo servidor (set-role do
  // /api/admin-users), que confere o módulo, o professor do cadastro, a
  // carteira e a vaga de consultor. Devolve true quando o resto do cadastro
  // pode seguir.
  const changeRole = async (target, change, allowExtra = false) => {
    const res = await fetch('/api/admin-users', {
      method: 'POST',
      headers: await authHeader(),
      body: JSON.stringify({
        action: SET_ROLE_ACTION,
        userDocId: target.id,
        role: change.role,
        ...(change.role === ROLES.PROFESSOR ? { professorId: change.professorId } : {}),
        allowExtra
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data?.requiresExtraConfirmation) {
      return confirmExtra(data.extraUserPrice) ? changeRole(target, change, true) : false;
    }
    if (!res.ok) { toast.error(data.error || 'Não foi possível trocar o papel.'); return false; }
    if (data.changed !== false) {
      toast.success(change.role === roleOf(target)
        ? 'Professor do cadastro trocado.'
        : `${target.name} passa a ser ${roleLabel({ role: change.role }).toLowerCase()}. O acesso novo vale quando a pessoa entrar de novo.`);
    }
    if (data.isExtra) toast.info('Este consultor entrou como extra. A mensalidade foi ajustada a partir da próxima fatura.', { duration: 8000 });
    return true;
  };

  const updateMember = async () => {
    const target = memberDialog?.user;
    if (!target) return;
    // A senha é conferida antes de gravar o cadastro. Se fosse recusada só no
    // fim, o resto das alterações já estaria salvo com o formulário aberto.
    if (form.password.trim()) {
      const passwordProblem = passwordPolicyError(form.password);
      if (passwordProblem) { toast.warning(passwordProblem); return; }
    }
    // O que muda no papel. Professor sem professor escolhido nem chega ao
    // servidor.
    const roleChange = planRoleChange(target, form);
    if (roleChange?.role === ROLES.PROFESSOR && !roleChange.professorId) {
      toast.warning(PROFESSOR_LINK_MESSAGES.missing);
      return;
    }
```

Trocar as linhas 265 a 267:

```jsx
    setSaving(true);
    try {
      if (emailChange.kind === 'account') {
```

por:

```jsx
    setSaving(true);
    try {
      // A troca de papel vai primeiro: é o único passo que pode pedir a
      // confirmação do extra, e recusada, nada mais é salvo.
      if (roleChange && !(await changeRole(target, roleChange))) return;

      if (emailChange.kind === 'account') {
```

Trocar as linhas 296 a 298:

```jsx
        // Vazio ou 0 = sem meta de prospecção. Não existe padrão de academia:
        // o piso é 100% individual.
        dailyVolumeTarget: form.dailyVolumeTarget !== '' && Number(form.dailyVolumeTarget) > 0
```

por:

```jsx
        // Vazio ou 0 = sem meta de prospecção. Não existe padrão de academia:
        // o piso é 100% individual. O professor não prospecta, então a meta
        // dele sai junto.
        dailyVolumeTarget: form.role !== ROLES.PROFESSOR && form.dailyVolumeTarget !== '' && Number(form.dailyVolumeTarget) > 0
```

O `updateDoc` continua sem `role` nem `professorId`.

Trocar a linha 347:

```jsx
    if (user.role === 'admin') { toast.warning('O gestor não pode ser excluído por aqui.'); return; }
```

por:

```jsx
    if (isGestor(user)) { toast.warning('O gestor não pode ser excluído por aqui.'); return; }
```

Trocar as linhas 368 a 376 (no `createInvite`):

```jsx
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.warning('E-mail inválido.'); return; }
    setInviting(true);
    setInviteLink('');
    try {
      const res = await fetch('/api/invite-create', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ email, role: inviteRole, allowExtra })
      });
```

por:

```jsx
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.warning('E-mail inválido.'); return; }
    const asProfessor = inviteRole === ROLES.PROFESSOR;
    if (asProfessor && !inviteProfessorId) { toast.warning(PROFESSOR_LINK_MESSAGES.missing); return; }
    setInviting(true);
    setInviteLink('');
    try {
      const res = await fetch('/api/invite-create', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ email, role: inviteRole, allowExtra, ...(asProfessor ? { professorId: inviteProfessorId } : {}) })
      });
```

Trocar as linhas 465 e 466:

```jsx
  const deleteProfessor = async (p) => {
    const inUse = (leads || []).filter(l => l.appointmentProfessorId === p.id).length;
```

por:

```jsx
  const deleteProfessor = async (p) => {
    // Professor com login não sai do cadastro: o acesso dele aponta para cá.
    const login = users.find(u => isProfessor(u) && u.professorId === p.id);
    if (login) {
      toast.warning(`"${p.nome}" tem acesso ao app (${login.name}). Exclua esse acesso na lista da equipe antes de excluir o professor.`);
      return;
    }
    const inUse = (leads || []).filter(l => l.appointmentProfessorId === p.id).length;
```

Trocar as linhas 487 a 492:

```jsx
        <SettingsBtn kind="primary" size={38} icon={<Plus size={14} />} onClick={openCreate}>
          Cadastrar consultor
        </SettingsBtn>
      </SettingsSectionHeader>

      <SeatBand seats={seats} consultantCount={consultantCount} />
```

por:

```jsx
        <SettingsBtn kind="primary" size={38} icon={<Plus size={14} />} onClick={openCreate}>
          {createLabel}
        </SettingsBtn>
      </SettingsSectionHeader>

      <SeatBand seats={seats} consultantCount={consultantCount} professorCount={professorCount} />
```

Logo depois da linha 500 (`const target = Number(u.dailyVolumeTarget) > 0 ? u.dailyVolumeTarget : null;`), acrescentar:

```jsx
          const professorRow = isProfessor(u);
          const linkedName = professorRow ? professorNameById(professores, u.professorId) : null;
```

Trocar as linhas 520 a 537 (as células Papel, Turno e Prospecção):

```jsx
              <div>
                <span className={cn(
                  'inline-flex text-[11.5px] font-semibold px-2.5 py-1 rounded-[7px]',
                  u.role === 'admin'
                    ? 'bg-accent-500/[0.14] text-accent-600 dark:text-accent-400'
                    : 'bg-muted text-slate-600 dark:text-slate-300'
                )}>
                  {u.role === 'admin' ? 'Gestor' : 'Consultor'}
                </span>
              </div>

              <div className="text-[12.5px] text-slate-700 dark:text-slate-200 num">
                {u.shiftStart && u.shiftEnd ? `${u.shiftStart}–${u.shiftEnd}` : '—'}
              </div>

              <div className={cn('text-[12.5px] num', target ? 'font-semibold' : 'text-slate-400 dark:text-slate-500')}>
                {target ? `${target}/dia` : 'sem meta'}
              </div>
```

por:

```jsx
              <div className="min-w-0">
                <span className={cn('inline-flex text-[11.5px] font-semibold px-2.5 py-1 rounded-[7px]', ROLE_BADGE[roleOf(u)])}>
                  {roleLabel(u)}
                </span>
                {professorRow && (
                  <div className={cn('text-[11px] mt-1 truncate', linkedName ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400')}>
                    {linkedProfessorText(u, professores)}
                  </div>
                )}
              </div>

              <div className="text-[12.5px] text-slate-700 dark:text-slate-200 num">
                {u.shiftStart && u.shiftEnd ? `${u.shiftStart}–${u.shiftEnd}` : '—'}
              </div>

              <div className={cn('text-[12.5px] num', target && !professorRow ? 'font-semibold' : 'text-slate-400 dark:text-slate-500')}>
                {professorRow ? '—' : target ? `${target}/dia` : 'sem meta'}
              </div>
```

Trocar a linha 548:

```jsx
                {u.role !== 'admin' && (
```

por:

```jsx
                {!isGestor(u) && (
```

Trocar a linha 560 (dica do card Professores; com o módulo desligado, o texto continua o de hoje):

```jsx
        hint="Quem conduz aulas experimentais — não têm login no app."
```

por:

```jsx
        hint={professorEnabled
          ? 'Quem conduz aulas experimentais. Com o papel Professor, na lista da equipe, ganha acesso ao app.'
          : 'Quem conduz aulas experimentais — não têm login no app.'}
```

Trocar as linhas 578 e 579:

```jsx
            last={i === professorStats.length - 1}
            onEdit={() => openProfessor(professor)}
```

por:

```jsx
            last={i === professorStats.length - 1}
            withLogin={professorLogins.has(professor.id)}
            onEdit={() => openProfessor(professor)}
```

Trocar as linhas 589 a 592 (título e descrição do diálogo de membro):

```jsx
        title={memberDialog?.mode === 'edit' ? `Editar ${memberDialog.user.name}` : 'Cadastrar consultor'}
        description={memberDialog?.mode === 'edit'
          ? 'O authUid é gerado no cadastro e não muda. Preencha a nova senha só se quiser redefini-la.'
          : 'Cria a conta no Firebase Auth e o cadastro interno numa operação só. Anote a senha temporária para entregar ao consultor.'}
```

por:

```jsx
        title={memberDialog?.mode === 'edit'
          ? `Editar ${memberDialog.user.name}`
          : (creatingProfessor ? 'Cadastrar acesso de professor' : 'Cadastrar consultor')}
        description={memberDialog?.mode === 'edit'
          ? 'O authUid é gerado no cadastro e não muda. Preencha a nova senha só se quiser redefini-la.'
          : `Cria a conta no Firebase Auth e o cadastro interno numa operação só. Anote a senha temporária para entregar ao ${creatingProfessor ? 'professor' : 'consultor'}.`}
```

Logo depois da linha 607 (o `</div>` que fecha a grade de Nome e E-mail de login), acrescentar o papel e a escolha do professor:

```jsx

        {showRoleField && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Papel" hint="Professor não ocupa vaga de consultor do plano.">
              <select className={FIELD_INPUT} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value={ROLES.CONSULTOR}>Consultor</option>
                <option value={ROLES.PROFESSOR}>Professor</option>
              </select>
            </DialogField>
            {form.role === ROLES.PROFESSOR && (
              <ProfessorPicker
                value={form.professorId}
                options={memberProfessorOptions}
                disabled={!professorEnabled}
                onChange={(id) => setForm({ ...form, professorId: id })}
              />
            )}
          </div>
        )}
```

Trocar a linha 635:

```jsx
        {memberDialog?.mode === 'edit' && (
```

por:

```jsx
        {memberDialog?.mode === 'edit' && form.role !== ROLES.PROFESSOR && (
```

Trocar a linha 650:

```jsx
        onOpenChange={(v) => { setInviteOpen(v); if (!v) { setInviteEmail(''); setInviteLink(''); } }}
```

por:

```jsx
        onOpenChange={(v) => { setInviteOpen(v); if (!v) { setInviteEmail(''); setInviteLink(''); setInviteProfessorId(''); } }}
```

Trocar as linhas 661 a 665:

```jsx
          <select className={FIELD_INPUT} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            <option value="consultant">Consultor</option>
            <option value="admin">Gestor (admin)</option>
          </select>
        </DialogField>
```

por:

```jsx
          <select className={FIELD_INPUT} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            {inviteRoleOptions(tenantModules).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </DialogField>
        {inviteRole === ROLES.PROFESSOR && (
          <ProfessorPicker value={inviteProfessorId} options={inviteProfessorOptions} onChange={setInviteProfessorId} />
        )}
```

E trocar a linha 679 (descrição do diálogo de professor):

```jsx
        description="Professores aparecem na lista ao agendar uma aula experimental. Não têm login no app."
```

por:

```jsx
        description={professorEnabled
          ? 'Professores aparecem na lista ao agendar uma aula experimental. O acesso ao app é dado na lista da equipe, com o papel Professor.'
          : 'Professores aparecem na lista ao agendar uma aula experimental. Não têm login no app.'}
```

Os selects seguem o `<select>` nativo que a tela já usa no convite, e por isso não precisam de componente shadcn. O selo violeta segue o padrão do selo de hoje, com `dark:` à mão.

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/teamAccessProfessor.test.js src/lib/__tests__/teamAccessEmail.test.js src/lib/__tests__/settingsSetup.test.js src/lib/__tests__/teamRoles.test.js`
Expected: PASS, `Test Files  4 passed (4)` e `Tests  60 passed (60)`: 11 + 10 + 18 + 21. O `teamAccessEmail.test.js` monta a tela com um gestor sem `tenantModules`, então segue como hoje.

Run: `npx eslint src/views/settings/TeamAccessSection.jsx src/views/settings/OverviewSection.jsx src/views/settings/PaceSection.jsx src/lib/settingsSetup.js src/lib/__tests__/teamAccessProfessor.test.js src/lib/__tests__/settingsSetup.test.js`
Expected: nenhuma saída.

Run: `grep -nE "role (===|!==) '" src/views/settings/TeamAccessSection.jsx`
Expected: nenhuma linha.

- [ ] **Step 10: Commit**

```bash
git add src/views/settings/TeamAccessSection.jsx src/views/settings/OverviewSection.jsx src/views/settings/PaceSection.jsx src/lib/settingsSetup.js src/lib/__tests__/teamAccessProfessor.test.js src/lib/__tests__/settingsSetup.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: papel Professor em Equipe & acessos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Telas, menu e Meta do professor (`src/lib/routes.js`, `src/lib/sidebarNav.js`, `src/App.jsx`)

> Esta task depende das Tasks 1, 2 e 3:
> - Task 1: `src/lib/modules.js`, com `MODULES` e `hasModule`.
> - Task 2: `src/lib/acesso.js`, com `canOpenScreen`, `isGestor`, `isProfessor`, `isSeller`, `can` e `ACTIONS.SUPORTE_ABRIR`.
> - Task 3: `appUser.tenantModules` preenchido no login. Sem ele, todo professor cai na tela de acesso desligado.
>
> A Task 3 já mexeu no `App.jsx`, então as linhas citadas abaixo são as de `49a978d` e chegam deslocadas. Procure sempre pelo trecho.
>
> O que fica com outras tasks no mesmo arquivo:
> - **Task 8:** o botão "Cadastrar lead", o `GlobalSearch` e o `AddLeadModal` do cabeçalho, e o `useHandoffs`.
> - **Task 9:** os `isAdminUser` que esta task não troca (linhas 844, 913, 1045, 1102, 1159, 1207, 1456, 1496, 1695, 1711 e 1787 a 1789), o `import { isAdminUser, ... }` da linha 54 e a trava do `recordGoalHit`.
> - As Tasks 8 e 9 acrescentam nomes na linha `import { ... } from './lib/acesso.js'` criada aqui. Elas não abrem um segundo import do mesmo arquivo.

**Files:**
- Modify: `src/lib/routes.js:16-17` (import), `:262-277` (`canAccess`, `homeScreenFor` nova, `ROUTE_NOTICES`), `:293-300` (`blockedNotice` nova, `accessRedirect`), `:322-338` (`sessionPathFor`), `:340-367` (`routeDecision`), `:373-374` e `:388-391` (`backTarget`)
- Modify: `src/lib/__tests__/routes.decision.test.js:42-50` (`ROUTE_NOTICES`)
- Create: `src/lib/__tests__/routes.professor.test.js`
- Modify: `src/views/LeadProfileRoute.jsx:16` e `:103-115`
- Create: `src/lib/sidebarNav.js` e `src/lib/__tests__/sidebarNav.test.js`
- Create: `src/views/ProfessorGoalPlaceholder.jsx` e `src/lib/__tests__/professorGoalPlaceholder.test.js`
- Create: `src/views/auth/ProfessorAccessOffScreen.jsx` e `src/lib/__tests__/professorAccessOffScreen.test.js`
- Modify: `src/components/WhatsNewModal.jsx:4`, `:14-15` e `:21`; `src/components/WalkthroughModal.jsx:7-9` e `:136-137`; `src/lib/announcements.js:7-8`, `:13-14` e `:132`; `src/components/layout/PersonaMenu.jsx:7-19`
- Create: `src/lib/__tests__/professorPopups.test.js`
- Modify: `src/App.jsx`:
  - imports: 54, 74, 86 e 101
  - `ticketsOn`: 233
  - `nav`: depois da 1346
  - consultas de renovação e de contato de hoje: 1394 e 1405
  - `dailyGoalProgress`: 1415-1416
  - aviso de acesso desligado: depois da 1499
  - menu: 1547-1576, 1580 e 1584
  - Meta diária: 1780
- Create: `src/lib/__tests__/professorShell.test.js`

- [ ] **Step 1: Escrever os testes de rota**

Criar `src/lib/__tests__/routes.professor.test.js`:

```js
// O professor abre só a Meta diária, Clientes e a ficha (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). A decisão de rota leva qualquer outra tela para a Meta diária, no molde
// do aviso de tela de gestor. O endereço curto da academia, onde o login e o
// Sair caem, leva à Meta sem aviso.
import { describe, it, expect } from 'vitest';
import {
  SCREENS, parseAppPath, canAccess, routeDecision, homeScreenFor, backTarget, ROUTE_NOTICES,
} from '../routes.js';
import { fichaOrigin, logoutDestination, screenState } from '../appShell.js';

const T = 'stronix-crm-app';
const admin = { id: 'u1', role: 'admin', tenantId: T };
const consultor = { id: 'u2', role: 'consultant', tenantId: T };
const professor = { id: 'u6', authUid: 'uid-6', role: 'professor', professorId: 'p1', tenantId: T };
const semLigacao = { id: 'u7', authUid: 'uid-7', role: 'professor', tenantId: T };

const decide = (path, user, opts) => routeDecision(parseAppPath(path), user, opts);
const casa = (to, target, notice = null) => ({ kind: 'redirect', to, target: { leadId: null, superTab: null, sub: null, ...target }, notice });
const meta = (notice = null) => casa(`/${T}/meta-diaria`, { screen: 'dailyGoal' }, notice);

const DELE = ['dailyGoal', 'clientes', 'ficha'];

describe('canAccess: professor', () => {
  it('abre a Meta diária, Clientes e a ficha, e nenhuma outra tela da tabela', () => {
    for (const s of Object.keys(SCREENS)) {
      expect(canAccess(s, professor), s).toBe(DELE.includes(s));
      expect(canAccess(s, semLigacao), s).toBe(DELE.includes(s));
    }
  });

  it('id que não é tela continua passando, como para os outros', () => {
    expect(canAccess(null, professor)).toBe(true);
    expect(canAccess('constructor', professor)).toBe(true);
  });

  it('gestor e consultor continuam como antes', () => {
    for (const s of ['dashboard', 'dashOperacional', 'kanban', 'leads', 'aulas', 'visitas', 'dailyGoal', 'clientes', 'ficha']) {
      expect(canAccess(s, consultor), s).toBe(true);
      expect(canAccess(s, admin), s).toBe(true);
    }
    expect(canAccess('settings', consultor)).toBe(false);
    expect(canAccess('settings', admin)).toBe(true);
  });
});

describe('homeScreenFor', () => {
  it('Visão geral para quem a abre, Meta diária para o professor', () => {
    expect(homeScreenFor(admin)).toBe('dashboard');
    expect(homeScreenFor(consultor)).toBe('dashboard');
    expect(homeScreenFor(null)).toBe('dashboard');
    expect(homeScreenFor(professor)).toBe('dailyGoal');
    expect(homeScreenFor(semLigacao)).toBe('dailyGoal');
  });
});

describe('ROUTE_NOTICES do professor', () => {
  it('textos da spec, sem travessão', () => {
    expect(ROUTE_NOTICES['nao-liberada']).toBe('Essa tela não está liberada para o seu acesso.');
    expect(ROUTE_NOTICES['nao-encontrada-meta']).toBe('Não achamos essa tela. Abrimos a Meta diária.');
    for (const k of ['nao-liberada', 'nao-encontrada-meta']) expect(ROUTE_NOTICES[k]).not.toMatch(/[—–]/);
  });
});

describe('routeDecision: professor', () => {
  it('a raiz e o endereço curto da academia levam à Meta diária sem aviso, porque o login e o Sair caem neles', () => {
    expect(decide('/', professor)).toEqual(meta());
    expect(decide(`/${T}`, professor)).toEqual(meta());
    expect(decide('/Stronix-Crm-App', professor)).toEqual(meta());
    expect(decide('/outra', professor)).toEqual(meta());
    expect(decide('/recuperar-senha', professor)).toEqual(meta());
  });

  it('a raiz leva a query junto, como faz para o consultor', () => {
    expect(decide('/', professor, { search: '?x=1' })).toEqual(casa(`/${T}/meta-diaria?x=1`, { screen: 'dailyGoal' }));
  });

  it('tela fora do acesso dele: Meta diária com o aviso de tela não liberada, sem a query', () => {
    const telas = [
      `/${T}/visao-geral`, `/${T}/visao-geral/operacional`, `/${T}/visao-geral/crm`, `/${T}/visao-geral/gerencial`,
      `/${T}/pipeline`, `/${T}/leads`, `/${T}/leads/aulas`, `/${T}/leads/visitas`,
      `/${T}/configuracoes`, `/${T}/configuracoes/equipe`, `/${T}/configuracoes/xyz`,
      `/${T}/perfil-da-academia`, `/${T}/plano-e-faturas`,
    ];
    for (const p of telas) expect(decide(p, professor, { search: '?mes=2026-09' }), p).toEqual(meta('nao-liberada'));
  });

  it('endereço sem academia ou de outra academia já sai com o aviso, sem passo intermediário', () => {
    expect(decide('/pipeline', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/configuracoes', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/outra/visao-geral/crm', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/STRONIX-CRM-APP/leads/aulas', professor)).toEqual(meta('nao-liberada'));
  });

  it('o super-admin some em silêncio, como para quem não tem o claim', () => {
    expect(decide(`/${T}/super-admin/planos`, professor)).toEqual(meta());
    expect(decide('/super-admin', professor)).toEqual(meta());
  });

  it('endereço desconhecido: Meta diária, com o aviso que fala da Meta', () => {
    for (const p of [`/${T}/xyz`, `/${T}/leads/visita`, `/${T}/visao-geral/xyz`, `/${T}/constructor`]) {
      expect(decide(p, professor), p).toEqual(meta('nao-encontrada-meta'));
    }
  });

  it('as telas dele abrem de primeira, com a aba da ficha', () => {
    const dele = [
      `/${T}/meta-diaria`, `/${T}/clientes`, `/${T}/ficha`, `/${T}/ficha/AbC`,
      `/${T}/ficha/AbC/crm`, `/${T}/ficha/AbC/contratos`, `/${T}/ficha/AbC/indicacoes`,
    ];
    for (const p of dele) {
      expect(decide(p, professor), p).toEqual({ kind: 'ok' });
      expect(decide(p, semLigacao), p).toEqual({ kind: 'ok' });
    }
  });

  it('a correção de academia mantém a tela dele, com o filtro, e descarta a ficha de outra academia', () => {
    expect(decide('/clientes', professor, { search: '?sit=ativo' })).toEqual(casa(`/${T}/clientes?sit=ativo`, { screen: 'clientes' }));
    expect(decide('/outra/meta-diaria', professor)).toEqual(casa(`/${T}/meta-diaria`, { screen: 'dailyGoal' }));
    expect(decide('/ficha/AbC/crm', professor)).toEqual(casa(`/${T}/ficha/AbC/crm`, { screen: 'ficha', leadId: 'AbC', sub: 'crm' }));
    expect(decide('/outra/ficha/AbC', professor)).toEqual(meta());
  });

  it('aba desconhecida da ficha abre a ficha, sem aviso', () => {
    expect(decide(`/${T}/ficha/AbC/xyz`, professor)).toEqual(casa(`/${T}/ficha/AbC`, { screen: 'ficha', leadId: 'AbC' }));
  });

  it('gestor e consultor não mudam: o endereço curto continua sendo o Operacional', () => {
    expect(decide(`/${T}`, consultor)).toEqual({ kind: 'ok' });
    expect(decide('/', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    expect(decide('/pipeline', consultor)).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    expect(decide(`/${T}/configuracoes`, consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide(`/${T}/xyz`, admin)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'nao-encontrada'));
  });

  it('o destino de todo redirect do professor é aceito de primeira, e é uma tela dele', () => {
    const caminhos = [
      '/', '/outra', `/${T}`, `/${T}/xyz`, `/${T}/pipeline`, `/${T}/configuracoes`, `/${T}/super-admin/planos`,
      `/${T}/visao-geral/crm`, `/${T}/ficha/a%2Fb`, '/outra/ficha/Ab12', '/pipeline', '/STRONIX-CRM-APP/clientes',
      '/academia-teste/pipeline', '/api', '/%E0%A4%A', `//${T}//pipeline`, `/${T}/ficha/AbC/xyz`,
    ];
    const retornos = [
      null,
      { fromTenant: 'academia-teste', path: `/${T}/super-admin/clientes` },
      { fromTenant: 'academia-teste', path: `/${T}/clientes` },
    ];
    for (const user of [professor, semLigacao]) {
      for (const returnTo of retornos) {
        for (const p of caminhos) {
          const d = decide(p, user, { search: '?a=1', returnTo });
          if (d.kind !== 'redirect') continue;
          const rotulo = `${user.id} ${p} -> ${d.to}`;
          expect(d.to.startsWith('//'), rotulo).toBe(false);
          const [path] = d.to.split('?');
          expect(decide(path, user, { returnTo }), rotulo).toEqual({ kind: 'ok' });
          const destino = parseAppPath(path);
          expect(d.target, rotulo).toEqual({ screen: destino.screen, leadId: destino.leadId, superTab: destino.superTab, sub: destino.sub });
          expect(DELE, rotulo).toContain(d.target.screen);
        }
      }
    }
  });
});

describe('backTarget: professor', () => {
  it('sem tela antes, a ficha de cliente volta para Clientes', () => {
    expect(backTarget({ historyState: { idx: 0 }, isClient: true, tenantId: T, appUser: professor })).toEqual({ type: 'replace', href: `/${T}/clientes` });
  });

  it('sem tela antes, a ficha de lead volta para a Meta diária, porque o Pipeline não é dele', () => {
    expect(backTarget({ historyState: null, isClient: false, tenantId: T, appUser: professor })).toEqual({ type: 'replace', href: `/${T}/meta-diaria` });
    expect(backTarget({ historyState: { idx: 0 }, isClient: false, tenantId: T, appUser: semLigacao })).toEqual({ type: 'replace', href: `/${T}/meta-diaria` });
  });

  it('com tela antes, o voltar do navegador, como para todos', () => {
    expect(backTarget({ historyState: { idx: 2 }, isClient: false, tenantId: T, appUser: professor })).toEqual({ type: 'back' });
  });

  it('consultor e chamada sem appUser continuam indo ao Pipeline na ficha de lead', () => {
    expect(backTarget({ historyState: null, isClient: false, tenantId: T, appUser: consultor })).toEqual({ type: 'replace', href: `/${T}/pipeline` });
    expect(backTarget({ historyState: null, isClient: false, tenantId: T })).toEqual({ type: 'replace', href: `/${T}/pipeline` });
  });
});

describe('casca do App: professor', () => {
  it('a ficha só guarda a origem das telas dele', () => {
    expect(fichaOrigin({ from: 'dailyGoal' }, professor)).toBe('dailyGoal');
    expect(fichaOrigin({ from: 'clientes' }, professor)).toBe('clientes');
    expect(fichaOrigin({ from: 'kanban' }, professor)).toBeNull();
    expect(fichaOrigin({ from: 'dashCrm' }, professor)).toBeNull();
    expect(fichaOrigin({ from: 'leads' }, professor)).toBeNull();
  });

  it('o endereço curto desenha a Meta diária já no render do redirect', () => {
    const d = decide(`/${T}`, professor);
    const s = screenState(d.target, null, professor);
    expect(s.activeTab).toBe('dailyGoal');
    expect(s.resolvedTab).toBe('dailyGoal');
  });

  it('o Sair leva ao login da academia, como os outros, e a volta do login cai na Meta', () => {
    expect(logoutDestination(professor)).toBe(`/${T}`);
    expect(decide(logoutDestination(professor), professor)).toEqual(meta());
  });
});
```

Em `src/lib/__tests__/routes.decision.test.js`, trocar as linhas 43-46:

```js
    expect(ROUTE_NOTICES).toEqual({
      'so-gestor': 'Essa tela é só do gestor.',
      'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
    });
```

por:

```js
    expect(ROUTE_NOTICES).toEqual({
      'so-gestor': 'Essa tela é só do gestor.',
      'nao-liberada': 'Essa tela não está liberada para o seu acesso.',
      'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
      'nao-encontrada-meta': 'Não achamos essa tela. Abrimos a Meta diária.',
    });
```

O resto do `routes.decision.test.js` fica igual. Para gestor e consultor, `base` e `home` continuam iguais. O fixture com `role: 'consultor'` continua sendo consultor pelo `roleOf`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routes.professor.test.js src/lib/__tests__/routes.decision.test.js`

Expected: FAIL, `Tests  16 failed | 58 passed (74)`. As falhas são:
- `TypeError: homeScreenFor is not a function`;
- o professor abre toda tela, porque o `canAccess` ainda não consulta o `canOpenScreen`;
- faltam as chaves `nao-liberada` e `nao-encontrada-meta`. É isso que reprova também o `toEqual` do `routes.decision.test.js`;
- o `backTarget` manda a ficha de lead do professor para o Pipeline.

Os 8 testes do arquivo novo que já passam travam o que não muda:
- gestor e consultor;
- o id que não é tela;
- as telas dele abrindo;
- a aba desconhecida da ficha;
- o `backTarget` de cliente e com histórico.

- [ ] **Step 3: Implementar em `src/lib/routes.js`**

Trocar as linhas 16-17:

```js
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';
import { isAdminUser } from './leads.js';
```

por:

```js
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';
import { canOpenScreen, isGestor } from './acesso.js';
```

Trocar as linhas 262-277:

```js
// Quem pode ver cada tela. Repete as travas que o App já faz no render
// (isAdminUser nas telas de gestor, appUser.superAdmin no super-admin). Tela
// sem trava, e id que não é tela, passam.
export function canAccess(screen, appUser) {
  if (!own(SCREENS, screen)) return true;
  const def = SCREENS[screen];
  if (def.gestor) return isAdminUser(appUser);
  if (def.superAdmin) return appUser?.superAdmin === true;
  return true;
}

// Avisos da troca de endereço. O App mostra com toast.warning.
export const ROUTE_NOTICES = Object.freeze({
  'so-gestor': 'Essa tela é só do gestor.',
  'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
});
```

por:

```js
// Quem pode ver cada tela. Primeiro a lista do papel (canOpenScreen, em
// acesso.js: o professor só abre a Meta diária, Clientes e a ficha), depois as
// travas que o App já faz no render (isGestor nas telas de gestor,
// appUser.superAdmin no super-admin). Tela sem trava, e id que não é tela,
// passam.
export function canAccess(screen, appUser) {
  if (!own(SCREENS, screen)) return true;
  if (!canOpenScreen(appUser, screen)) return false;
  const def = SCREENS[screen];
  if (def.gestor) return isGestor(appUser);
  if (def.superAdmin) return appUser?.superAdmin === true;
  return true;
}

// Tela inicial da sessão, para onde vai quem abre um endereço que não pode
// ver. A Visão geral para quem a abre; a Meta diária para o professor, que não
// a abre (docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md).
export function homeScreenFor(appUser) {
  return canAccess(HOME_SCREEN, appUser) ? HOME_SCREEN : 'dailyGoal';
}

// Avisos da troca de endereço. O App mostra com toast.warning.
export const ROUTE_NOTICES = Object.freeze({
  'so-gestor': 'Essa tela é só do gestor.',
  'nao-liberada': 'Essa tela não está liberada para o seu acesso.',
  'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
  'nao-encontrada-meta': 'Não achamos essa tela. Abrimos a Meta diária.',
});
```

Trocar as linhas 293-300:

```js
// Regras 6, 7 e 8, sobre um endereço que já é da academia da sessão. A trava de
// tela vem antes da sub-tela: quem não pode ver a tela vai para a inicial com
// aviso, e não para a tela-mãe de uma seção que ele não abriria.
function accessRedirect(route, appUser, home, { tenantId = null, search = '' } = {}) {
  if (route.screen && !canAccess(route.screen, appUser)) {
    return redirectTo(home, { notice: SCREENS[route.screen].gestor ? 'so-gestor' : null });
  }
  if (route.unknown) return redirectTo(home, { notice: 'nao-encontrada' });
```

por:

```js
// Aviso de quem não pode ver a tela. O super-admin some em silêncio, como
// sempre; a tela fora da lista do papel não está liberada; a de gestor é só do
// gestor.
function blockedNotice(screen, appUser) {
  const def = SCREENS[screen];
  if (def.superAdmin) return null;
  if (!canOpenScreen(appUser, screen)) return 'nao-liberada';
  return def.gestor ? 'so-gestor' : null;
}

// Regras 6, 7 e 8, sobre um endereço que já é da academia da sessão. A trava de
// tela vem antes da sub-tela: quem não pode ver a tela vai para a inicial com
// aviso, e não para a tela-mãe de uma seção que ele não abriria.
function accessRedirect(route, appUser, home, { tenantId = null, search = '' } = {}) {
  if (route.screen && !canAccess(route.screen, appUser)) {
    // O endereço curto /<academia> não é tela pedida: é onde o login e o Sair
    // caem. Quem não abre a Visão geral vai para a tela inicial dele sem aviso.
    if (route.screen === HOME_SCREEN) return redirectTo(home);
    return redirectTo(home, { notice: blockedNotice(route.screen, appUser) });
  }
  if (route.unknown) {
    return redirectTo(home, { notice: homeScreenFor(appUser) === HOME_SCREEN ? 'nao-encontrada' : 'nao-encontrada-meta' });
  }
```

O resto do `accessRedirect` (a regra 8, das linhas 301-309) continua igual.

Trocar as linhas 322-338. É aqui que fica a separação entre a base e a tela inicial. Sem ela, a tela inicial do professor viraria prefixo, e `/pipeline` viraria `/<academia>/meta-diaria/pipeline`. O código atual é:

```js
// Regra 5: o endereço não é da academia da sessão. Devolve o caminho corrigido,
// ou null quando o endereço já é dela. Os segmentos depois da academia vão
// crus, do jeito que chegaram, para o id da ficha não mudar.
function sessionPathFor(route, tenantId, home) {
  const raw = rawSegments(route.pathname);
  if (raw.length === 0) return home;
  if (route.tenantSlug === tenantId) {
    // Mesma academia com outra caixa (/STRONIX/...): troca só o slug.
    return decodeSegment(raw[0]) === tenantId ? null : joinPath(home, raw.slice(1));
  }
  // Tela sem academia (/pipeline, /ficha/<id>): põe a academia na frente.
  if (route.tenantSlug === null) return route.unknown ? home : joinPath(home, raw);
  // Outra academia: a tela vem junto, a ficha e o super-admin não, porque são
  // dados da outra academia.
  const keepsScreen = route.screen && route.screen !== 'ficha' && route.screen !== 'superadmin';
  return keepsScreen ? joinPath(home, raw.slice(1)) : home;
}
```

O código novo é:

```js
// Regra 5: o endereço não é da academia da sessão. Devolve o caminho corrigido,
// ou null quando o endereço já é dela. Os segmentos depois da academia vão
// crus, do jeito que chegaram, para o id da ficha não mudar. `base` é a raiz da
// academia da sessão, em que a tela do endereço é remontada; `home` é a tela
// inicial da sessão, para onde vai o endereço que não tem tela para levar. Só
// para o professor as duas diferem (a inicial dele é a Meta diária), e usar a
// inicial como base faria /pipeline virar /<academia>/meta-diaria/pipeline.
function sessionPathFor(route, tenantId, base, home) {
  const raw = rawSegments(route.pathname);
  if (raw.length === 0) return home;
  if (route.tenantSlug === tenantId) {
    // Mesma academia com outra caixa (/STRONIX/...): troca só o slug.
    return decodeSegment(raw[0]) === tenantId ? null : joinPath(base, raw.slice(1));
  }
  // Tela sem academia (/pipeline, /ficha/<id>): põe a academia na frente.
  if (route.tenantSlug === null) return route.unknown ? home : joinPath(base, raw);
  // Outra academia: a tela vem junto, a ficha e o super-admin não, porque são
  // dados da outra academia.
  const keepsScreen = route.screen && route.screen !== 'ficha' && route.screen !== 'superadmin';
  return keepsScreen ? joinPath(base, raw.slice(1)) : home;
}
```

Trocar as linhas 340-367, do comentário das regras até a chamada do `sessionPathFor`:

```js
// O que fazer com o endereço atual nesta sessão. Roda a cada render do app
// logado e para na primeira regra que se aplica:
// 1. sem sessão: ok (o login aparece em qualquer endereço e volta para ele);
// 2. super-admin puro: o console só existe em '/';
// 3. sessão assumida ("Acessar como") com o endereço de outra academia: vai
//    para a tela inicial da assumida;
// 4. volta da visualização: vai para o caminho guardado na entrada;
// 5. endereço sem a academia da sessão: corrige o slug, sem aviso;
// 6. tela que a sessão não vê: tela inicial, com aviso se for de gestor;
// 7. endereço desconhecido: tela inicial, com aviso;
// 8. sub-tela desconhecida: a tela-mãe, sem aviso.
// A regra 5 já sai com as regras 6, 7 e 8 aplicadas ao endereço corrigido, então
// o destino de todo redirect é aceito de primeira: nada pisca e nada entra em
// laço. Devolve { kind: 'ok' } ou { kind: 'redirect', to, target, notice }.
export function routeDecision(route, appUser, opts = {}) {
  const { search = '', returnTo = null } = opts || {};
  if (!appUser) return OK;
  if (appUser.superAdminOnly) return route.pathname === '/' ? OK : redirectTo('/');
  const tenantId = appUser.tenantId;
  const home = hrefFor(tenantId, HOME_SCREEN);
  // Trava contra laço: academia cujo id não relê como ela mesma (fora do
  // formato ou palavra reservada) não é mandada pelo endereço. Sem isso, o
  // redirect cairia nele mesmo para sempre. Vale para as regras 3 a 8.
  if (!home || parseAppPath(home).tenantSlug !== tenantId) return OK;
  if (appUser.impersonating && route.tenantSlug !== tenantId) return redirectTo(home);
  const back = returnPathFor(route, appUser, returnTo);
  if (back) return redirectTo(back);
  const fixed = sessionPathFor(route, tenantId, home);
```

por:

```js
// O que fazer com o endereço atual nesta sessão. Roda a cada render do app
// logado e para na primeira regra que se aplica:
// 1. sem sessão: ok (o login aparece em qualquer endereço e volta para ele);
// 2. super-admin puro: o console só existe em '/';
// 3. sessão assumida ("Acessar como") com o endereço de outra academia: vai
//    para a tela inicial da assumida;
// 4. volta da visualização: vai para o caminho guardado na entrada;
// 5. endereço sem a academia da sessão: corrige o slug, sem aviso;
// 6. tela que a sessão não vê: tela inicial da sessão, com aviso de gestor ou
//    de tela não liberada (o professor); o endereço curto da academia leva o
//    professor à Meta diária sem aviso;
// 7. endereço desconhecido: tela inicial, com aviso;
// 8. sub-tela desconhecida: a tela-mãe, sem aviso.
// A regra 5 já sai com as regras 6, 7 e 8 aplicadas ao endereço corrigido, então
// o destino de todo redirect é aceito de primeira: nada pisca e nada entra em
// laço. Devolve { kind: 'ok' } ou { kind: 'redirect', to, target, notice }.
export function routeDecision(route, appUser, opts = {}) {
  const { search = '', returnTo = null } = opts || {};
  if (!appUser) return OK;
  if (appUser.superAdminOnly) return route.pathname === '/' ? OK : redirectTo('/');
  const tenantId = appUser.tenantId;
  // Raiz da academia (/<academia>), base de toda correção de endereço, e a tela
  // inicial da sessão (homeScreenFor), para onde vai quem não pode ficar.
  const base = hrefFor(tenantId, HOME_SCREEN);
  const home = hrefFor(tenantId, homeScreenFor(appUser));
  // Trava contra laço: academia cujo id não relê como ela mesma (fora do
  // formato ou palavra reservada) não é mandada pelo endereço. Sem isso, o
  // redirect cairia nele mesmo para sempre. Vale para as regras 3 a 8.
  if (!base || !home || parseAppPath(base).tenantSlug !== tenantId) return OK;
  if (appUser.impersonating && route.tenantSlug !== tenantId) return redirectTo(home);
  const back = returnPathFor(route, appUser, returnTo);
  if (back) return redirectTo(back);
  const fixed = sessionPathFor(route, tenantId, base, home);
```

As linhas 368-370, com `extra` e os dois `return`, ficam como estão.

Trocar as linhas 373-374:

```js
// Voltar da ficha: pelo navegador quando há tela do app antes dela nesta aba;
// senão, troca a entrada por Clientes (cliente) ou Pipeline (lead).
```

por:

```js
// Voltar da ficha: pelo navegador quando há tela do app antes dela nesta aba;
// senão, troca a entrada por Clientes (cliente) ou Pipeline (lead). Quem não
// abre o Pipeline (o professor) volta da ficha de lead para a tela inicial
// dele, a Meta diária. Sem appUser vale o Pipeline, como sempre.
```

E trocar as linhas 388-391:

```js
export function backTarget({ historyState, isClient, tenantId } = {}) {
  if (canGoBackInApp(historyState)) return { type: 'back' };
  return { type: 'replace', href: hrefFor(tenantId, isClient ? 'clientes' : 'kanban') };
}
```

por:

```js
export function backTarget({ historyState, isClient, tenantId, appUser = null } = {}) {
  if (canGoBackInApp(historyState)) return { type: 'back' };
  if (isClient) return { type: 'replace', href: hrefFor(tenantId, 'clientes') };
  const lista = canAccess('kanban', appUser) ? 'kanban' : homeScreenFor(appUser);
  return { type: 'replace', href: hrefFor(tenantId, lista) };
}
```

O `routes.js` deixa de importar `leads.js`. Com isso ele sai do grafo `leads.js`, `globalSearch.js`, e o `acesso.js` não importa nada. O `sentry.js`, o `settingsRail.js` e o `fichaState.js`, que importam o `routes.js`, continuam sem pacote novo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/routes.professor.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/routeRedirect.test.js src/lib/__tests__/leadProfileRoute.test.js src/lib/__tests__/settingsRail.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`

Expected: PASS, `Test Files  8 passed (8)` e `Tests  184 passed (184)`:

| Arquivo | Testes |
|---|---|
| `routes.professor` | 23 |
| `routes.decision` | 51 |
| `routes` | 47 |
| `appShell` | 31 |
| `routeRedirect` | 5 |
| `leadProfileRoute` | 11 |
| `settingsRail` | 7 |
| `filtrosNoEndereco.sweep` | 9 |

- [ ] **Step 5: O Voltar e o início da ficha (`src/views/LeadProfileRoute.jsx`)**

Os testes desta ligação são os do `backTarget` e do `homeScreenFor`, já escritos no Step 1. O `appUser` já chega como prop (linha 87).

Trocar a linha 16:

```js
import { backTarget, hrefFor } from '../lib/routes.js';
```

por:

```js
import { backTarget, homeScreenFor, hrefFor } from '../lib/routes.js';
```

Trocar as linhas 103-115:

```jsx
  // Voltar: o histórico é lido na hora do clique, nunca no render. Com uma tela
  // do app antes desta, é o voltar do navegador. Aberta direto numa aba nova,
  // troca a ficha pela lista (Clientes para cliente, Pipeline para lead).
  const goBack = () => {
    if (!mountedRef.current) return;
    const target = backTarget({ historyState: window.history.state, isClient: isClientLead(lead), tenantId });
    if (target.type === 'back') navigate(-1);
    else if (target.href) navigate(target.href, { replace: true });
  };
  const goHome = () => {
    const href = hrefFor(tenantId, 'dashboard');
    if (href) navigate(href, { replace: true });
  };
```

por:

```jsx
  // Voltar: o histórico é lido na hora do clique, nunca no render. Com uma tela
  // do app antes desta, é o voltar do navegador. Aberta direto numa aba nova,
  // troca a ficha pela lista (Clientes para cliente, Pipeline para lead). O
  // professor, que não abre o Pipeline, volta da ficha de lead para a Meta
  // diária.
  const goBack = () => {
    if (!mountedRef.current) return;
    const target = backTarget({ historyState: window.history.state, isClient: isClientLead(lead), tenantId, appUser });
    if (target.type === 'back') navigate(-1);
    else if (target.href) navigate(target.href, { replace: true });
  };
  // Ir para o início: a tela inicial da sessão, direto. Para o professor é a
  // Meta diária, sem passar pelo redirect do endereço curto da academia.
  const goHome = () => {
    const href = hrefFor(tenantId, homeScreenFor(appUser));
    if (href) navigate(href, { replace: true });
  };
```

- [ ] **Step 6: Rodar a ficha, a varredura do histórico e o lint**

Run: `npx vitest run src/lib/__tests__/leadProfileRoute.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`

Expected: PASS, `Tests  20 passed (20)`. O `goHome` faz replace sem state, e a varredura do histórico continua verde.

Run: `npx eslint src/lib/routes.js src/views/LeadProfileRoute.jsx src/lib/__tests__/routes.professor.test.js`

Expected: nenhuma saída.

- [ ] **Step 7: Commit**

```bash
git add src/lib/routes.js src/lib/__tests__/routes.professor.test.js src/lib/__tests__/routes.decision.test.js src/views/LeadProfileRoute.jsx
git -c user.name="Johnny Bittencourt" commit -m "feat: professor abre só Meta diária, Clientes e ficha, com aviso de tela não liberada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Escrever o teste do menu**

Criar `src/lib/__tests__/sidebarNav.test.js`:

```js
// O menu lateral pergunta ao mesmo canAccess da decisão de rota. O professor
// fica com Meta diária e Clientes (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"), e o resto da equipe vê o menu de sempre. Com o módulo desligado na
// academia, o professor não tem tela nenhuma e o App mostra só o aviso.
import { describe, it, expect } from 'vitest';
import { sidebarNav, professorAccessOff } from '../sidebarNav.js';
import { hrefFor, parseAppPath, routeDecision } from '../routes.js';

const T = 'stronix-crm-app';
const COM_MODULO = ['faltosos'];
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: [] };
const consultor = { id: 'u2', role: 'consultant', tenantId: T, tenantModules: [] };
// Cadastro antigo sem papel conta como consultor (roleOf).
const semPapel = { id: 'u3', tenantId: T };
const professor = { id: 'u4', role: 'professor', professorId: 'p1', tenantId: T, tenantModules: COM_MODULO };
const semLigacao = { id: 'u5', role: 'professor', tenantId: T, tenantModules: COM_MODULO };

const TUDO = { overview: true, kanban: true, clientes: true, dailyGoal: true, leads: true, suporte: true };
const DO_PROFESSOR = { overview: false, kanban: false, clientes: true, dailyGoal: true, leads: false, suporte: false };

// As telas que cada item do menu abre (App.jsx, bloco Workspace).
const TELAS = {
  overview: ['dashOperacional', 'dashCrm', 'dashGerencial'],
  kanban: ['kanban'],
  clientes: ['clientes'],
  dailyGoal: ['dailyGoal'],
  leads: ['leads', 'aulas', 'visitas'],
};

describe('sidebarNav', () => {
  it('gestor, consultor e cadastro sem papel veem o menu inteiro, como antes', () => {
    for (const u of [gestor, consultor, semPapel]) expect(sidebarNav(u), u.id).toEqual(TUDO);
  });

  it('o professor vê só a Meta diária e Clientes, com ou sem professor ligado', () => {
    for (const u of [professor, semLigacao]) expect(sidebarNav(u), u.id).toEqual(DO_PROFESSOR);
  });

  it('todo item aceso abre de primeira, sem aviso de rota', () => {
    for (const u of [gestor, consultor, professor, semLigacao]) {
      const nav = sidebarNav(u);
      for (const [item, ids] of Object.entries(TELAS)) {
        if (!nav[item]) continue;
        for (const id of ids) {
          expect(routeDecision(parseAppPath(hrefFor(T, id)), u), `${u.id} ${id}`).toEqual({ kind: 'ok' });
        }
      }
    }
  });

  it('todo item apagado seria recusado pelo endereço', () => {
    for (const u of [professor, semLigacao]) {
      const nav = sidebarNav(u);
      for (const [item, ids] of Object.entries(TELAS)) {
        if (nav[item]) continue;
        for (const id of ids) {
          expect(routeDecision(parseAppPath(hrefFor(T, id)), u).kind, `${u.id} ${id}`).toBe('redirect');
        }
      }
    }
  });

  it('sem sessão não mostra o Suporte', () => {
    expect(sidebarNav(null).suporte).toBe(false);
  });
});

describe('professorAccessOff', () => {
  it('professor com o módulo ligado entra nas telas dele', () => {
    expect(professorAccessOff(professor)).toBe(false);
    expect(professorAccessOff(semLigacao)).toBe(false);
  });

  it('professor sem o módulo fica só com o aviso, inclusive quando a lista não veio', () => {
    expect(professorAccessOff({ ...professor, tenantModules: [] })).toBe(true);
    expect(professorAccessOff({ ...professor, tenantModules: undefined })).toBe(true);
    expect(professorAccessOff({ ...professor, tenantModules: 'faltosos' })).toBe(true);
    expect(professorAccessOff({ ...professor, tenantModules: ['outro'] })).toBe(true);
  });

  it('gestor, consultor, cadastro sem papel e sessão vazia nunca caem no aviso', () => {
    for (const u of [gestor, consultor, semPapel, null, undefined]) expect(professorAccessOff(u)).toBe(false);
  });
});
```

- [ ] **Step 9: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/sidebarNav.test.js`

Expected: FAIL, `Error: Cannot find module '../sidebarNav.js'`, com `Tests  no tests`.

- [ ] **Step 10: Criar `src/lib/sidebarNav.js`**

```js
// O que a sessão vê na casca do app: os itens do menu lateral e, para o
// professor, se ele tem tela nenhuma. Puro, testado em node, porque o App.jsx
// não monta em teste.
//
// Cada item de tela pergunta ao mesmo canAccess da decisão de rota
// (src/lib/routes.js), para o menu nunca mostrar uma tela que o endereço
// recusaria com aviso. Hoje só o professor perde itens: ele fica com Meta
// diária e Clientes (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md). O Suporte
// não é tela, é o chamado com a equipe do Stronilead, e segue a lista de
// permissões (ACTIONS.SUPORTE_ABRIR). Configurações e Organizações continuam no
// bloco Administração do App, com as travas de gestor e de super-admin.
import { canAccess } from './routes.js';
import { ACTIONS, can, isProfessor } from './acesso.js';
import { MODULES, hasModule } from './modules.js';

export function sidebarNav(appUser) {
  const tela = (id) => canAccess(id, appUser);
  return Object.freeze({
    overview: tela('dashOperacional') && tela('dashCrm') && tela('dashGerencial'),
    kanban: tela('kanban'),
    clientes: tela('clientes'),
    dailyGoal: tela('dailyGoal'),
    leads: tela('leads') && tela('aulas') && tela('visitas'),
    suporte: can(appUser, ACTIONS.SUPORTE_ABRIR),
  });
}

// Professor numa academia com o módulo "Professor e faltosos" desligado. O
// login continua valendo, mas nenhuma tela é dele: o App mostra só o aviso,
// com o Sair, e as regras do Firestore recusam as gravações dele. A lista vem
// do appUser.tenantModules, lida no login; sem ela, vale desligado.
export function professorAccessOff(appUser) {
  return isProfessor(appUser) && !hasModule(appUser?.tenantModules, MODULES.FALTOSOS);
}
```

- [ ] **Step 11: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/sidebarNav.test.js`

Expected: PASS, `Tests  8 passed (8)`. Não há ciclo de import: `sidebarNav` importa `routes`, que importa `acesso`, e `acesso` e `modules` não importam nada.

Run: `npx eslint src/lib/sidebarNav.js src/lib/__tests__/sidebarNav.test.js`

Expected: nenhuma saída.

- [ ] **Step 12: Commit**

```bash
git add src/lib/sidebarNav.js src/lib/__tests__/sidebarNav.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: menu lateral pela mesma regra da rota e acesso de professor desligado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 13: Escrever os testes das duas telas do professor**

Criar `src/lib/__tests__/professorGoalPlaceholder.test.js`:

```js
// @vitest-environment jsdom
// A Meta diária do professor antes da Meta dos faltosos (PR 3): o título e uma
// frase, que muda quando o login ainda não foi ligado a um professor do
// cadastro (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "A Meta do professor").
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProfessorGoalPlaceholder } from '../../views/ProfessorGoalPlaceholder.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SEM_IMPORTACAO = 'Sua lista de faltosos aparece aqui depois da primeira importação.';
const SEM_PROFESSOR = 'Seu acesso ainda não está ligado a um professor. Fale com o gestor.';
const professor = { id: 'u7', role: 'professor', professorId: 'prof-1', tenantId: 'stronix-crm-app' };

let root = null;
async function montar(appUser) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(ProfessorGoalPlaceholder, { appUser })); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

const titulo = () => document.querySelector('h2')?.textContent;
const texto = () => document.querySelector('p')?.textContent;

describe('ProfessorGoalPlaceholder', () => {
  it('com professor ligado, diz que a lista chega com a primeira importação', async () => {
    await montar(professor);
    expect(titulo()).toBe('Meta diária');
    expect(texto()).toBe(SEM_IMPORTACAO);
  });

  it.each([
    ['sem o campo', { ...professor, professorId: undefined }],
    ['vazio', { ...professor, professorId: '' }],
    ['só com espaço', { ...professor, professorId: '   ' }],
    ['que não é texto', { ...professor, professorId: 42 }],
    ['nulo', { ...professor, professorId: null }],
  ])('com professorId %s, pede para falar com o gestor', async (_caso, appUser) => {
    await montar(appUser);
    expect(titulo()).toBe('Meta diária');
    expect(texto()).toBe(SEM_PROFESSOR);
  });

  it('sem appUser não quebra e pede o gestor', async () => {
    await montar(null);
    expect(titulo()).toBe('Meta diária');
    expect(texto()).toBe(SEM_PROFESSOR);
  });

  it('o ícone fica fora do leitor de tela e os textos não têm travessão', async () => {
    await montar(professor);
    expect(document.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    for (const t of [SEM_IMPORTACAO, SEM_PROFESSOR]) expect(t).not.toMatch(/[—–]/);
  });

  it('não oferece botão nem link nesta entrega', async () => {
    await montar(professor);
    expect(document.querySelector('a, button')).toBeNull();
  });
});
```

Criar `src/lib/__tests__/professorAccessOffScreen.test.js`:

```js
// @vitest-environment jsdom
// Professor numa academia com o módulo "Professor e faltosos" desligado: o
// login vale, mas ele não tem tela nenhuma. A tela mostra só o aviso e o Sair
// (professorAccessOff, em src/lib/sidebarNav.js, decide quando ela aparece).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProfessorAccessOffScreen } from '../../views/auth/ProfessorAccessOffScreen.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AVISO = 'O acesso de professor está desligado nesta academia. Fale com o gestor.';

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(ProfessorAccessOffScreen, props)); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

describe('ProfessorAccessOffScreen', () => {
  it('mostra o título, o aviso e nenhum link', async () => {
    await montar({ onLogout: () => {} });
    expect(document.querySelector('h1')?.textContent).toBe('Acesso desligado');
    expect(document.querySelector('p')?.textContent).toBe(AVISO);
    expect(document.querySelector('a')).toBeNull();
    expect(AVISO).not.toMatch(/[—–]/);
  });

  it('o único botão é o Sair, e ele chama o onLogout', async () => {
    const onLogout = vi.fn();
    await montar({ onLogout });
    const botoes = [...document.querySelectorAll('button')];
    expect(botoes.map((b) => b.textContent.trim())).toEqual(['Sair']);
    await act(async () => { botoes[0].click(); });
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 14: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorGoalPlaceholder.test.js src/lib/__tests__/professorAccessOffScreen.test.js`

Expected: FAIL nos dois arquivos, com `Failed to resolve import "../../views/ProfessorGoalPlaceholder.jsx"` e `Failed to resolve import "../../views/auth/ProfessorAccessOffScreen.jsx"`.

- [ ] **Step 15: Criar as duas telas**

Criar `src/views/ProfessorGoalPlaceholder.jsx`. Ela usa tokens semânticos, `font-display` (Space Grotesk) e `shadow-card`, como a `DailyGoalView`. Não tem link, então não precisa de roteador:

```jsx
import { CalendarClock, Link2Off } from 'lucide-react';

// Meta diária do professor até a Meta dos faltosos chegar (PR 3 da spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A Meta do
// professor"). O professor não tem a Meta do consultor: nada de lead,
// renovação ou volume. Sem professor do cadastro ligado ao login, a tela diz o
// que fazer, porque a lista dele depende dessa ligação.
export function ProfessorGoalPlaceholder({ appUser }) {
  const ligado = typeof appUser?.professorId === 'string' && appUser.professorId.trim() !== '';
  const Icone = ligado ? CalendarClock : Link2Off;
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center text-card-foreground shadow-card">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icone className="size-6" />
      </span>
      <h2 className="font-display text-[22px] font-bold tracking-tight">Meta diária</h2>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
        {ligado
          ? 'Sua lista de faltosos aparece aqui depois da primeira importação.'
          : 'Seu acesso ainda não está ligado a um professor. Fale com o gestor.'}
      </p>
    </section>
  );
}
```

Criar `src/views/auth/ProfessorAccessOffScreen.jsx`. Ela segue o molde da `TenantBlockedScreen`, com tokens semânticos e o `Button` do shadcn que o app já tem:

```jsx
import { PowerOff } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Tela de quem é professor numa academia com o módulo "Professor e faltosos"
// desligado (professorAccessOff, em src/lib/sidebarNav.js). O login vale, mas
// nenhuma tela é dele: só resta o aviso e o Sair. Ligar o módulo de novo
// devolve as telas no próximo login ou F5. Como a TenantBlockedScreen, ela é
// desenhada no lugar do app inteiro, sem menu e sem cabeçalho.
export function ProfessorAccessOffScreen({ onLogout }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-card-lg">
        <div className="flex items-center justify-center gap-2">
          <SurgeMark size={26} />
          <StronileadWordmark className="text-[18px] text-foreground" />
        </div>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <PowerOff className="size-7" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">Acesso desligado</h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          O acesso de professor está desligado nesta academia. Fale com o gestor.
        </p>
        <Button type="button" size="lg" className="mt-3 w-full" onClick={onLogout}>Sair</Button>
      </section>
    </main>
  );
}
```

- [ ] **Step 16: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professorGoalPlaceholder.test.js src/lib/__tests__/professorAccessOffScreen.test.js`

Expected: PASS, `Test Files  2 passed (2)` e `Tests  11 passed (11)`, sendo 9 testes da Meta e 2 do aviso.

Run: `npx eslint src/views/ProfessorGoalPlaceholder.jsx src/views/auth/ProfessorAccessOffScreen.jsx src/lib/__tests__/professorGoalPlaceholder.test.js src/lib/__tests__/professorAccessOffScreen.test.js`

Expected: nenhuma saída.

- [ ] **Step 17: Commit**

```bash
git add src/views/ProfessorGoalPlaceholder.jsx src/views/auth/ProfessorAccessOffScreen.jsx src/lib/__tests__/professorGoalPlaceholder.test.js src/lib/__tests__/professorAccessOffScreen.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: Meta diária provisória do professor e aviso de acesso desligado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 18: Escrever o teste dos pop-ups**

Criar `src/lib/__tests__/professorPopups.test.js`:

```js
// @vitest-environment jsdom
// O professor não recebe os pop-ups da jornada de venda: nem o tutorial do lead
// ao cliente, nem a novidade grande. Ele não abre Pipeline, Leads nem
// Configurações, e os dois pop-ups falam dessas telas. As novidades continuam
// no sino dele (spec 2026-10-02-professor-e-faltosos-design.md). O gestor
// continua vendo os passos de configurar, agora pelo isGestor.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { WalkthroughModal } from '../../components/WalkthroughModal.jsx';
import { WhatsNewModal } from '../../components/WhatsNewModal.jsx';
import { latestUnseenAnnouncement } from '../announcements.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T = 'stronix-crm-app';
const gestor = { id: 'u-gestor', role: 'admin', tenantId: T };
const consultor = { id: 'u-consultor', role: 'consultant', tenantId: T };
const professor = { id: 'u-professor', role: 'professor', professorId: 'p1', tenantId: T };

let root = null;
async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(elemento); });
}

beforeEach(() => { localStorage.clear(); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  localStorage.clear();
});

const dialogo = () => document.querySelector('[role="dialog"]');

describe('tutorial da jornada de venda', () => {
  it('abre sozinho para o consultor que ainda não viu', async () => {
    await montar(h(WalkthroughModal, { appUser: consultor }));
    expect(dialogo()).not.toBeNull();
  });

  it('não abre para o professor', async () => {
    await montar(h(WalkthroughModal, { appUser: professor }));
    expect(dialogo()).toBeNull();
  });
});

describe('novidade grande', () => {
  it('existe novidade grande para o consultor (premissa do teste)', () => {
    expect(latestUnseenAnnouncement(consultor)).not.toBeNull();
  });

  it('abre sozinha para o consultor que ainda não viu', async () => {
    await montar(h(WhatsNewModal, { appUser: consultor, onConfigure: () => {} }));
    expect(dialogo()).not.toBeNull();
  });

  it('não abre para o professor', async () => {
    await montar(h(WhatsNewModal, { appUser: professor, onConfigure: () => {} }));
    expect(dialogo()).toBeNull();
  });

  it('o gestor vê o "Como configurar" e o "Configurar agora"', async () => {
    await montar(h(WhatsNewModal, { appUser: gestor, onConfigure: () => {} }));
    expect(dialogo()?.textContent).toContain('Como configurar');
    expect(dialogo()?.textContent).toContain('Configurar agora');
  });

  it('o consultor vê a novidade sem os passos de configurar', async () => {
    await montar(h(WhatsNewModal, { appUser: consultor, onConfigure: () => {} }));
    expect(dialogo()?.textContent).not.toContain('Como configurar');
    expect(dialogo()?.textContent).not.toContain('Configurar agora');
  });
});
```

- [ ] **Step 19: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorPopups.test.js`

Expected: FAIL, `Tests  2 failed | 5 passed (7)`. Os dois casos "não abre para o professor" recebem `expected <div role="dialog" …> to be null`, porque hoje os dois pop-ups abrem para qualquer pessoa que não é super-admin. A premissa e os casos de gestor e consultor já passam.

- [ ] **Step 20: Implementar os pop-ups, o menu da conta e o comentário das novidades**

Em `src/components/WhatsNewModal.jsx`, trocar a linha 4:

```js
import { latestUnseenAnnouncement, markAnnouncementSeen } from '../lib/announcements.js';
```

por:

```js
import { latestUnseenAnnouncement, markAnnouncementSeen } from '../lib/announcements.js';
import { isGestor, isProfessor } from '../lib/acesso.js';
```

Trocar as linhas 14-15:

```js
  const ann = useMemo(() => {
    if (!appUser?.id || appUser.superAdminOnly) return null;
```

por:

```js
  const ann = useMemo(() => {
    // A novidade grande fala das telas de venda. O professor não abre essas
    // telas e não recebe o pop-up: as novidades ficam no sino dele.
    if (!appUser?.id || appUser.superAdminOnly || isProfessor(appUser)) return null;
```

E trocar a linha 21:

```js
  const isAdmin = appUser?.role === 'admin';
```

por:

```js
  const isAdmin = isGestor(appUser);
```

Em `src/components/WalkthroughModal.jsx`, trocar as linhas 7-9:

```js
import {
  WALKTHROUGH_STEPS, walkthroughSeen, markWalkthroughSeen,
} from '../lib/walkthrough.js';
```

por:

```js
import {
  WALKTHROUGH_STEPS, walkthroughSeen, markWalkthroughSeen,
} from '../lib/walkthrough.js';
import { isProfessor } from '../lib/acesso.js';
```

E trocar as linhas 136-137:

```js
  const autoShow = useMemo(() => {
    if (!appUser?.id || appUser.superAdminOnly) return false;
```

por:

```js
  // O tutorial é a jornada de venda (Kanban, matrícula, renovação). O
  // professor não abre essas telas, então não recebe o pop-up.
  const autoShow = useMemo(() => {
    if (!appUser?.id || appUser.superAdminOnly || isProfessor(appUser)) return false;
```

Em `src/lib/announcements.js`, trocar as linhas 7-8:

```js
//   audience: 'todos'  → consultor e gestor veem
//   audience: 'gestor' → só admin vê
```

por:

```js
//   audience: 'todos'  → todos os papéis no sino; o pop-up (major) não abre
//                        para o professor (WhatsNewModal)
//   audience: 'gestor' → só o gestor vê
```

Trocar as linhas 13-14:

```js
// ============================================================================
export const ANNOUNCEMENTS = [
```

por:

```js
// ============================================================================
import { isGestor } from './acesso.js';

export const ANNOUNCEMENTS = [
```

E trocar a linha 132:

```js
  const isAdmin = appUser.role === 'admin';
```

por:

```js
  const isAdmin = isGestor(appUser);
```

O `announcements.js` não aparece na lista da Task 9, então a varredura de `role === 'admin'` dele fica aqui.

Em `src/components/layout/PersonaMenu.jsx`, trocar as linhas 7-19:

```jsx
import { AppLink } from '../nav/AppLink.jsx';

// Menu da conta no canto superior direito (ícone de persona). Reúne o perfil da
// academia + Plano & faturas (só para o admin) e o logout. Consultor vê apenas
// a própria identidade + Sair. Super-admin puro não tem academia → sem perfil.
// Perfil da academia e Plano & faturas são links (profileHref e billingHref,
// montados pelo App com a academia da sessão): Ctrl+clique abre em outra aba.
// O item do menu empresta o papel e o foco ao link (asChild) e fecha o menu no
// clique. Enter pelo teclado abre na mesma aba.
function PersonaMenu({ appUser, isAdmin, profileHref, billingHref, onLogout, onHelp, onToggleTheme, isDarkMode }) {
  const superOnly = !!appUser?.superAdminOnly;
  const role = superOnly ? 'Super-admin' : isAdmin ? 'Acesso Master' : 'Consultor';
  const RoleIcon = superOnly ? Shield : isAdmin ? Shield : User;
```

por:

```jsx
import { AppLink } from '../nav/AppLink.jsx';
import { isProfessor } from '../../lib/acesso.js';

// Menu da conta no canto superior direito (ícone de persona). Reúne o perfil da
// academia + Plano & faturas (só para o admin) e o logout. Consultor e
// professor veem apenas a própria identidade + Sair. Super-admin puro não tem
// academia → sem perfil.
// Perfil da academia e Plano & faturas são links (profileHref e billingHref,
// montados pelo App com a academia da sessão): Ctrl+clique abre em outra aba.
// O item do menu empresta o papel e o foco ao link (asChild) e fecha o menu no
// clique. Enter pelo teclado abre na mesma aba.
function PersonaMenu({ appUser, isAdmin, profileHref, billingHref, onLogout, onHelp, onToggleTheme, isDarkMode }) {
  const superOnly = !!appUser?.superAdminOnly;
  const professor = !superOnly && !isAdmin && isProfessor(appUser);
  const role = superOnly ? 'Super-admin' : isAdmin ? 'Acesso Master' : professor ? 'Professor' : 'Consultor';
  const RoleIcon = superOnly ? Shield : isAdmin ? Shield : professor ? GraduationCap : User;
```

O `GraduationCap` já está no import da linha 1. A prop `isAdmin` que o App passa (`App.jsx:1695`) troca de `isAdminUser` para `isGestor` na Task 9.

- [ ] **Step 21: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professorPopups.test.js src/lib/__tests__/notifications.test.js`

Expected: PASS, `Test Files  2 passed (2)` e `Tests  31 passed (31)`, sendo 7 dos pop-ups e 24 do sino. O sino continua lendo as novidades pelo `announcements.js`.

Run: `npx eslint src/components/WhatsNewModal.jsx src/components/WalkthroughModal.jsx src/lib/announcements.js src/components/layout/PersonaMenu.jsx src/lib/__tests__/professorPopups.test.js`

Expected: nenhuma saída.

- [ ] **Step 22: Commit**

```bash
git add src/components/WhatsNewModal.jsx src/components/WalkthroughModal.jsx src/lib/announcements.js src/components/layout/PersonaMenu.jsx src/lib/__tests__/professorPopups.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: pop-ups da jornada de venda não abrem para o professor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 23: Escrever a varredura da casca do App**

O `App.jsx` não monta em teste. Este arquivo lê o código dele, no molde do `protecaoDeErro.sweep.test.js`. Criar `src/lib/__tests__/professorShell.test.js`:

```js
// O App.jsx não monta em teste (Firebase, roteador e dezenas de assinaturas).
// Esta varredura lê o código dele e cobra as ligações do professor que os
// módulos puros não enxergam: o aviso de acesso desligado no lugar do app, o
// menu pelo sidebarNav, o Suporte pela lista de permissões e a Meta diária do
// professor no lugar da Meta do consultor (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Tira comentário de bloco e de linha, no molde das outras varreduras: uma
// linha comentada tem o mesmo texto da ligada e não liga nada.
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = semComentarios(readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8'));

describe('casca do App para o professor', () => {
  it('com o módulo desligado, o aviso entra depois do bloqueio da academia e antes do Console e do app', () => {
    const bloqueio = app.indexOf('if (!appUser.superAdminOnly && tenantBlock)');
    const aviso = app.indexOf('if (professorAccessOff(appUser)) {', bloqueio);
    const superPuro = app.indexOf('if (appUser.superAdminOnly) {', bloqueio);
    const casca = app.indexOf('<GeneralConfigContext.Provider', bloqueio);
    expect(bloqueio).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(bloqueio);
    expect(superPuro).toBeGreaterThan(aviso);
    expect(casca).toBeGreaterThan(superPuro);
    expect(app.slice(aviso, superPuro)).toContain('return <ProfessorAccessOffScreen onLogout={handleLogout} />;');
  });

  it('o menu de trabalho mostra cada item pelo sidebarNav', () => {
    expect(app).toContain('const nav = sidebarNav(appUser);');
    const menu = app.slice(app.indexOf('>Workspace</div>'), app.indexOf('>Administração</div>'));
    const itens = [
      ['overview', 'Visão geral'], ['kanban', 'Pipeline'], ['clientes', 'Clientes'],
      ['dailyGoal', 'Meta diária'], ['leads', 'Leads'], ['suporte', 'Suporte'],
    ];
    for (const [chave, rotulo] of itens) {
      const idx = menu.indexOf(`label="${rotulo}"`);
      expect(idx, rotulo).toBeGreaterThan(-1);
      const guarda = menu.lastIndexOf(`{nav.${chave} && `, idx);
      expect(guarda, rotulo).toBeGreaterThan(-1);
      // Entre a guarda e o rótulo não pode haver outro item do menu.
      expect(menu.slice(guarda, idx).match(/label="/g) ?? [], rotulo).toEqual([]);
    }
  });

  it('os chamados do Suporte só são assinados por quem pode abrir o Suporte', () => {
    expect(app).toMatch(/const ticketsOn = [^;]*&& can\(appUser, ACTIONS\.SUPORTE_ABRIR\);/);
  });

  it('a Meta diária do professor é o ProfessorGoalPlaceholder, e a do resto da equipe continua a DailyGoalView', () => {
    expect(app).toMatch(/activeTab === 'dailyGoal' && \(isProfessor\(appUser\)\s*\?\s*<ProfessorGoalPlaceholder appUser=\{appUser\} \/>\s*:\s*<DailyGoalView /);
  });

  it('só quem vende tem a Meta do consultor no selo do menu e nas consultas de renovação e de contato de hoje', () => {
    expect(app).toMatch(/const dailyGoalProgress = useMemo\(\(\) => \{\s*if \(!appUser\?\.id \|\| !isSeller\(appUser\)\) return \{ total: 0, pending: 0 \};/);
    expect(app).toMatch(/useRenewalClients\(\{[^}]*enabled: isSeller\(appUser\) \}\)/);
    expect(app).toMatch(/useClientsWithContactToday\(\{[^}]*enabled: isSeller\(appUser\) \}\)/);
  });
});
```

O `indexOf` do Console começa depois do bloqueio de propósito. A linha 646 também tem `if (appUser.superAdminOnly) {`, dentro da carga de dados.

- [ ] **Step 24: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js`

Expected: FAIL, `Tests  5 failed (5)`. Ainda não existem no `App.jsx` o `professorAccessOff`, o `sidebarNav`, a trava do Suporte, o placeholder nem o `isSeller`.

- [ ] **Step 25: Ligar tudo no `src/App.jsx`**

Linhas de `49a978d`, já deslocadas pela Task 3. Procure pelo trecho.

1. Imports. Depois da linha 54 (`import { isAdminUser, normalizeLeadDoc } from './lib/leads.js';`), acrescentar:

```js
import { ACTIONS, can, isGestor, isProfessor, isSeller } from './lib/acesso.js';
```

Depois da linha 74 (`} from './lib/appShell.js';`), acrescentar:

```js
import { sidebarNav, professorAccessOff } from './lib/sidebarNav.js';
```

Depois da linha 86 (`import { TrialActivationScreen } from './views/auth/TrialActivationScreen.jsx';`), acrescentar:

```js
import { ProfessorAccessOffScreen } from './views/auth/ProfessorAccessOffScreen.jsx';
```

Depois da linha 101 (`import { DailyGoalView } from './views/DailyGoalView.jsx';`), acrescentar:

```js
import { ProfessorGoalPlaceholder } from './views/ProfessorGoalPlaceholder.jsx';
```

2. Chamados do Suporte. Trocar a linha 233:

```js
  const ticketsOn = !!appUser?.tenantId && !appUser?.superAdminOnly && !tenantBlock;
```

por:

```js
  // O Suporte é do gestor e do consultor (ACTIONS.SUPORTE_ABRIR). O professor
  // não tem o item no menu, então os chamados que só alimentam o selo dele não
  // são assinados.
  const ticketsOn = !!appUser?.tenantId && !appUser?.superAdminOnly && !tenantBlock && can(appUser, ACTIONS.SUPORTE_ABRIR);
```

3. Itens do menu. Depois da linha 1346 (`const menuHref = (screen, extra) => hrefFor(sessionTenant, screen, extra);`), acrescentar:

```js
  // Itens do menu de trabalho que a sessão vê, pela mesma pergunta da decisão
  // de rota (src/lib/sidebarNav.js). O professor fica com Meta diária e
  // Clientes. O menu do computador e o do celular são o mesmo <aside>.
  const nav = sidebarNav(appUser);
```

4. Consultas que só servem à Meta do consultor. Trocar a linha 1394:

```js
  const { clients: renewalClients, candidates: renewalCandidates, loading: renewalLoading } = useRenewalClients({ db, contractThresholdDays, renewalCheckpoints, expiredWindowDays: renewalGraceDays, reloadKey: dayKey, enabled: !!appUser });
```

por:

```js
  // Só quem vende tem a Meta do consultor: o professor não faz estas consultas
  // (isSeller dá false também sem sessão, como o !!appUser de antes).
  const { clients: renewalClients, candidates: renewalCandidates, loading: renewalLoading } = useRenewalClients({ db, contractThresholdDays, renewalCheckpoints, expiredWindowDays: renewalGraceDays, reloadKey: dayKey, enabled: isSeller(appUser) });
```

E trocar a linha 1405:

```js
  const { clients: clientsContactToday, loading: contactTodayLoading } = useClientsWithContactToday({ db, reloadKey: dayKey, enabled: !!appUser });
```

por:

```js
  const { clients: clientsContactToday, loading: contactTodayLoading } = useClientsWithContactToday({ db, reloadKey: dayKey, enabled: isSeller(appUser) });
```

Desligado, o `usePagedLeads` fica com `loading` false e a lista vazia (`src/hooks/usePagedLeads.js:55-61`), então o dia batido e o selo não ficam esperando.

5. Selo da Meta. Trocar as linhas 1415-1416:

```js
  const dailyGoalProgress = useMemo(() => {
    if (!appUser?.id) return { total: 0, pending: 0 };
```

por:

```js
  const dailyGoalProgress = useMemo(() => {
    // Só quem vende tem a Meta do consultor. O professor fica sem pendência no
    // menu e sem dia batido gravado: a Meta dele, a dos faltosos, vem no PR 3.
    if (!appUser?.id || !isSeller(appUser)) return { total: 0, pending: 0 };
```

Com total zero, o `goalHitKeyToRecord` não grava nada. A trava explícita do `recordGoalHit` é da Task 9.

6. Aviso de acesso desligado. Logo depois do fechamento do bloqueio da academia (linhas 1498-1499):

```jsx
    return <TenantBlockedScreen reason={tenantBlock} onLogout={handleLogout} />;
  }
```

acrescentar, antes do comentário do super-admin puro:

```jsx

  // Professor numa academia com o módulo "Professor e faltosos" desligado: o
  // login vale, mas nenhuma tela é dele (professorAccessOff, em
  // src/lib/sidebarNav.js). Fica só o aviso, com o Sair, e as regras do
  // Firestore recusam as gravações dele. Ligar o módulo de novo devolve as
  // telas no próximo login ou F5.
  if (professorAccessOff(appUser)) {
    return <ProfessorAccessOffScreen onLogout={handleLogout} />;
  }
```

A tela não leva `ScreenErrorBoundary`. O `protecaoDeErro.sweep.test.js` conta toda `ScreenErrorBoundary` do arquivo como tela sem sessão, e uma proteção depois do bloqueio derrubaria o teste "tirar a proteção de qualquer uma das telas". Ela fica como a `TenantBlockedScreen`, na lista das telas sem proteção própria.

7. Menu de trabalho. Trocar as linhas 1549-1576, o `<div className="space-y-1">` do Workspace inteiro:

```jsx
              <div className="space-y-1">
                <SidebarGroup
                  icon={<LayoutDashboard className="w-[18px] h-[18px]" />}
                  label="Visão geral"
                  active={isDashTab}
                  open={overviewMenuOpen || isDashTab}
                  onToggle={() => setOverviewMenuOpen(o => !o)}
                >
                  <SidebarSubItem label="Operacional" href={menuHref('dashOperacional')} onNavigate={closeDrawer} active={resolvedTab === 'dashOperacional'} />
                  <SidebarSubItem label="CRM" href={menuHref('dashCrm')} onNavigate={closeDrawer} active={resolvedTab === 'dashCrm'} />
                  <SidebarSubItem label="Gerencial" href={menuHref('dashGerencial')} onNavigate={closeDrawer} active={resolvedTab === 'dashGerencial'} />
                </SidebarGroup>
                <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" href={menuHref('kanban')} onNavigate={closeDrawer} active={activeTab === 'kanban'} />
                <SidebarItem icon={<GraduationCap className="w-[18px] h-[18px]" />} label="Clientes" badge={clientsAVencer > 0 ? clientsAVencer : null} href={menuHref('clientes')} onNavigate={closeDrawer} active={activeTab === 'clientes'} />
                <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" badge={dailyGoalPending > 0 ? dailyGoalPending : null} href={menuHref('dailyGoal')} onNavigate={closeDrawer} active={activeTab === 'dailyGoal'} />
                <SidebarGroup
                  icon={<Users className="w-[18px] h-[18px]" />}
                  label="Leads"
                  active={isLeadsTab}
                  open={leadsMenuOpen}
                  onToggle={() => setLeadsMenuOpen(o => !o)}
                >
                  <SidebarSubItem label="Todos os leads" href={menuHref('leads')} onNavigate={closeDrawer} active={activeTab === 'leads'} />
                  <SidebarSubItem label="Aulas experimentais" href={menuHref('aulas')} onNavigate={closeDrawer} active={activeTab === 'aulas'} />
                  <SidebarSubItem label="Visitas" href={menuHref('visitas')} onNavigate={closeDrawer} active={activeTab === 'visitas'} />
                </SidebarGroup>
                <SidebarItem icon={<LifeBuoy className="w-[18px] h-[18px]" />} label="Suporte" badge={ticketsUnread > 0 ? ticketsUnread : null} active={false} onClick={() => setTicketModalOpen(true)} />
              </div>
```

por:

```jsx
              <div className="space-y-1">
                {nav.overview && (
                  <SidebarGroup
                    icon={<LayoutDashboard className="w-[18px] h-[18px]" />}
                    label="Visão geral"
                    active={isDashTab}
                    open={overviewMenuOpen || isDashTab}
                    onToggle={() => setOverviewMenuOpen(o => !o)}
                  >
                    <SidebarSubItem label="Operacional" href={menuHref('dashOperacional')} onNavigate={closeDrawer} active={resolvedTab === 'dashOperacional'} />
                    <SidebarSubItem label="CRM" href={menuHref('dashCrm')} onNavigate={closeDrawer} active={resolvedTab === 'dashCrm'} />
                    <SidebarSubItem label="Gerencial" href={menuHref('dashGerencial')} onNavigate={closeDrawer} active={resolvedTab === 'dashGerencial'} />
                  </SidebarGroup>
                )}
                {nav.kanban && <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" href={menuHref('kanban')} onNavigate={closeDrawer} active={activeTab === 'kanban'} />}
                {nav.clientes && <SidebarItem icon={<GraduationCap className="w-[18px] h-[18px]" />} label="Clientes" badge={clientsAVencer > 0 ? clientsAVencer : null} href={menuHref('clientes')} onNavigate={closeDrawer} active={activeTab === 'clientes'} />}
                {nav.dailyGoal && <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" badge={dailyGoalPending > 0 ? dailyGoalPending : null} href={menuHref('dailyGoal')} onNavigate={closeDrawer} active={activeTab === 'dailyGoal'} />}
                {nav.leads && (
                  <SidebarGroup
                    icon={<Users className="w-[18px] h-[18px]" />}
                    label="Leads"
                    active={isLeadsTab}
                    open={leadsMenuOpen}
                    onToggle={() => setLeadsMenuOpen(o => !o)}
                  >
                    <SidebarSubItem label="Todos os leads" href={menuHref('leads')} onNavigate={closeDrawer} active={activeTab === 'leads'} />
                    <SidebarSubItem label="Aulas experimentais" href={menuHref('aulas')} onNavigate={closeDrawer} active={activeTab === 'aulas'} />
                    <SidebarSubItem label="Visitas" href={menuHref('visitas')} onNavigate={closeDrawer} active={activeTab === 'visitas'} />
                  </SidebarGroup>
                )}
                {nav.suporte && <SidebarItem icon={<LifeBuoy className="w-[18px] h-[18px]" />} label="Suporte" badge={ticketsUnread > 0 ? ticketsUnread : null} active={false} onClick={() => setTicketModalOpen(true)} />}
              </div>
```

8. Bloco Administração. Trocar a linha 1580:

```jsx
          {(appUser?.superAdmin || (!appUser.superAdminOnly && isAdminUser(appUser))) && (
```

por:

```jsx
          {(appUser?.superAdmin || (!appUser.superAdminOnly && isGestor(appUser))) && (
```

E trocar a linha 1584:

```jsx
                {!appUser.superAdminOnly && isAdminUser(appUser) && (
```

por:

```jsx
                {!appUser.superAdminOnly && isGestor(appUser) && (
```

9. Meta diária. Trocar a linha 1780:

```jsx
              {activeTab === 'dailyGoal' && <DailyGoalView leads={metaLeads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} listenersActive={listenersActive} />}
```

por:

```jsx
              {/* O professor não tem a Meta do consultor. Até a Meta dos
                  faltosos (PR 3), a tela dele diz o que falta. */}
              {activeTab === 'dailyGoal' && (isProfessor(appUser)
                ? <ProfessorGoalPlaceholder appUser={appUser} />
                : <DailyGoalView leads={metaLeads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} listenersActive={listenersActive} />)}
```

O placeholder fica dentro do `AppErrorBoundary` do conteúdo, antes do `</AppErrorBoundary>`, então a varredura dos modais não muda.

O `import { isAdminUser, ... }` da linha 54 continua, porque ainda é usado nas linhas da Task 9. O lint continua sem variável sobrando: os cinco nomes do import novo são usados nesta task.

- [ ] **Step 26: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professorShell.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/overscrollGuard.test.js`

Expected: PASS, `Test Files  5 passed (5)` e `Tests  27 passed (27)`:

| Arquivo | Testes |
|---|---|
| `professorShell` | 5 |
| `protecaoDeErro.sweep` | 8 |
| `leadLinkSweep` | 3 |
| `filtrosNoEndereco.sweep` | 9 |
| `overscrollGuard` | 2 |

A `ProfessorAccessOffScreen` fica depois do `if (!appUser.superAdminOnly && tenantBlock)`, que é a âncora do trecho sem sessão. Por isso a varredura das telas de entrada não a cobra.

- [ ] **Step 27: Lint e suíte inteira**

Run: `npm run lint`

Expected: `0 errors`. O único aviso é o de sempre, em `src/views/superadmin/SuperAdminView.jsx:113`.

Run: `npm test`

Expected: nenhum arquivo falhando. Esta task soma 6 arquivos de teste e 54 testes ao número da Task 6:

| Arquivo novo | Testes |
|---|---|
| `routes.professor` | 23 |
| `sidebarNav` | 8 |
| `professorGoalPlaceholder` | 9 |
| `professorAccessOffScreen` | 2 |
| `professorPopups` | 7 |
| `professorShell` | 5 |

O `routes.decision` continua com 51.

- [ ] **Step 28: Commit**

```bash
git add src/App.jsx src/lib/__tests__/professorShell.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: casca do app do professor com menu, Meta diária e aviso de acesso desligado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ficha, Clientes, busca e sino (`src/views/LeadProfileView.jsx`, `src/views/ClientsView.jsx`, `src/components/layout/GlobalSearch.jsx`, `src/lib/notifications.js`)

**Files:**
- Create: `src/lib/__tests__/globalSearchScope.test.js`
- Create: `src/lib/__tests__/notificationsProfessor.test.js`
- Create: `src/lib/__tests__/profileProfessor.test.js`
- Create: `src/lib/__tests__/ownerPickersProfessor.test.js` (jsdom)
- Create: `src/lib/__tests__/clientsProfessor.test.js`
- Modify: `src/lib/globalSearch.js:21-23` (assinatura do `searchPeople`) e `:31` (o laço)
- Modify: `src/components/layout/GlobalSearch.jsx:4` (import), `:89-92` (assinatura), `:108-112` (busca), `:205`, `:231`, `:260` (textos)
- Modify: `src/lib/notifications.js:7-9` (comentário), `:16-17` (imports), `:36`, `:59`, `:84`, `:109-110` (fim do `buildNotificationFeed`)
- Modify: `src/components/layout/NotificationBell.jsx:5`, `:127-129`, `:186`
- Modify: `src/components/profile/ReferralsSection.jsx:31-35` e `:58-63`
- Modify: `src/views/LeadProfileView.jsx:10`, `:116-119`, `:152-153`, `:174-175`, `:214-215`, `:247-279`, `:285-286`, `:345-346`, `:448-449`, `:465-466`, `:501-506`, `:690-692`, `:794-797`, `:850-851`, `:1169`, `:1198-1200`, `:1207`, `:1231-1234`, `:1242`, `:1259-1260`, `:1294-1323`, `:1432-1434`, `:1667-1669`, `:1686-1687`
- Modify: `src/modals/ClientRegistrationModal.jsx:5` e `:74-80`
- Modify: `src/views/ClientsView.jsx:3`, `:89`, `:97-99`, `:252`, `:257-258`, `:348`
- Modify: `src/App.jsx`, só estas regiões: o `useHandoffs` (hoje 251-252), a busca e o "Cadastrar lead" do cabeçalho (hoje 1644-1651) e a montagem do `AddLeadModal` (hoje 1804-1806). As Tasks 3 e 7 mexem antes no mesmo arquivo, então os números mudam: ache cada trecho pelo texto.

Depende da Task 2: `src/lib/acesso.js` precisa existir com `ACTIONS.LEAD_CRIAR`, `CADASTRO_EDITAR`, `FICHA_MUDAR_FASE`, `CONTRATO_EDITAR`, `INDICACAO_CADASTRAR`, `LEADS_VER` e `SINO_EQUIPE`, `can(null, X) === false` e `isSeller(null) === false`.

Depende da Task 7: o `src/App.jsx` já tem a linha `import { ACTIONS, can, isGestor, isProfessor, isSeller } from './lib/acesso.js';`, logo depois do `import { isAdminUser, normalizeLeadDoc } from './lib/leads.js';`. A Task 7 põe os cinco nomes e esta task não acrescenta nenhum. Esta task usa `can` e `ACTIONS` dessa linha e não cria outro import de `acesso.js` no App. O `LeadProfileRoute.jsx` (Voltar e "Ir para o início" do professor), o `WhatsNewModal.jsx`, o `WalkthroughModal.jsx` e o `announcements.js` são da Task 7. Esta task não toca neles.

A ficha, Clientes, a busca e o sino ficam com o que a spec dá ao professor:
- na ficha, ele registra Anotação, WhatsApp, Ligação e Agendar, e vê Contratos e Indicações sem botão;
- a busca do topo acha só cliente;
- o sino mostra só as novidades;
- nenhuma escolha de pessoa lista professor.

Gestor e consultor continuam exatamente como hoje, e cada teste de tela confere isso junto.

- [ ] **Step 1: Conferir os pré-requisitos**

```bash
grep -n "LEAD_CRIAR\|CADASTRO_EDITAR\|FICHA_MUDAR_FASE\|CONTRATO_EDITAR\|INDICACAO_CADASTRAR\|LEADS_VER\|SINO_EQUIPE" src/lib/acesso.js
grep -n "from './lib/acesso.js'" src/App.jsx
```

Expected: as sete ações aparecem em `src/lib/acesso.js`, e o App tem uma linha só de import de `./lib/acesso.js`, com `can` e `ACTIONS`. Se a linha do App existir sem `can` ou sem `ACTIONS`, acrescente os dois nela, sem criar outra linha.

- [ ] **Step 2: Escrever o teste da busca**

Criar `src/lib/__tests__/globalSearchScope.test.js`:

```js
// A busca do topo do professor acha só cliente (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). O recorte mora no searchPeople, pelo filtro `include`, para o total e o
// limite contarem só quem pode aparecer. O componente recebe clientsOnly do App
// (quem não tem ACTIONS.LEADS_VER) e diz isso no campo.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { searchPeople } from '../globalSearch.js';
import { isClientLead } from '../leads.js';

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {} }));

const { GlobalSearch } = await import('../../components/layout/GlobalSearch.jsx');

const pessoa = (id, name, over = {}) => ({ id, name, whatsapp: '', cpf: '', ...over });
const PESSOAS = [
  pessoa('l1', 'Ana Lima', { status: 'Novo' }),
  pessoa('c1', 'Ana Souza', { lifecycleStage: 'cliente', status: 'Venda', isConverted: true }),
  pessoa('c2', 'Mariana Alves', { status: 'Venda', isConverted: true }),
  pessoa('l2', 'Anderson Reis', { status: 'Perda' }),
];

describe('searchPeople com include', () => {
  it('sem include, nada muda: leads e clientes juntos', () => {
    const { results, total } = searchPeople(PESSOAS, 'ana');
    expect(total).toBe(3);
    expect(results.map((r) => r.lead.id)).toEqual(['l1', 'c1', 'c2']);
  });

  it('com isClientLead, só clientes, e o total conta só eles', () => {
    const { results, total } = searchPeople(PESSOAS, 'ana', { include: isClientLead });
    expect(total).toBe(2);
    expect(results.map((r) => r.lead.id)).toEqual(['c1', 'c2']);
  });

  it('o limite vale depois do recorte: dez leads não escondem o cliente', () => {
    const muitos = [
      ...Array.from({ length: 10 }, (_, i) => pessoa(`l${i}`, `Ana Lead ${i}`, { status: 'Novo' })),
      pessoa('c9', 'Ana Zuleica', { lifecycleStage: 'cliente' }),
    ];
    const { results, total } = searchPeople(muitos, 'ana', { limit: 8, include: isClientLead });
    expect(total).toBe(1);
    expect(results.map((r) => r.lead.id)).toEqual(['c9']);
  });

  it('telefone também passa pelo recorte', () => {
    const pessoas = [
      pessoa('l1', 'Lucas', { whatsapp: '11999990000', status: 'Novo' }),
      pessoa('c1', 'Carla', { whatsapp: '11999990000', isConverted: true }),
    ];
    expect(searchPeople(pessoas, '99999', { include: isClientLead }).results.map((r) => r.lead.id)).toEqual(['c1']);
  });
});

describe('GlobalSearch com clientsOnly', () => {
  it('o campo diz que acha só clientes; sem a chave, leads e clientes', () => {
    const prof = renderToString(createElement(GlobalSearch, { db: null, clientsOnly: true }));
    expect(prof).toContain('placeholder="Buscar clientes"');
    expect(prof).toContain('aria-label="Buscar clientes"');
    const todos = renderToString(createElement(GlobalSearch, { db: null }));
    expect(todos).toContain('placeholder="Buscar leads e clientes"');
    expect(todos).toContain('aria-label="Buscar leads e clientes"');
  });
});

// O App decide pela lista de permissões quem cadastra lead e quem só acha
// cliente. O App inteiro não roda em teste de node, então o texto dele é lido.
describe('o topo do App segue a lista de permissões', () => {
  const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');

  it('a busca recebe clientsOnly de quem não vê leads, e o novo lead só de quem cria lead', () => {
    expect(app).toContain('clientsOnly={!can(appUser, ACTIONS.LEADS_VER)}');
    expect(app).toContain('onAddLead={can(appUser, ACTIONS.LEAD_CRIAR) ? () => setIsAddLeadModalOpen(true) : null}');
  });

  it('o botão Cadastrar lead e o modal do cadastro rápido pedem LEAD_CRIAR', () => {
    expect(app).toContain("{!appUser.superAdminOnly && can(appUser, ACTIONS.LEAD_CRIAR) && (");
    expect(app).toContain('{isAddLeadModalOpen && can(appUser, ACTIONS.LEAD_CRIAR) && (');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/globalSearchScope.test.js`

Expected: FAIL, `Tests  6 failed | 1 passed (7)`.
- O `include` ainda é ignorado: `expected 3 to be 2`, `expected 11 to be 1` e `expected [ 'c1', 'l1' ] to deeply equal [ 'c1' ]`.
- O campo sempre diz "Buscar leads e clientes".
- O App ainda não tem os textos procurados.
- Só o caso "sem include, nada muda" passa.

- [ ] **Step 4: O filtro `include` no `searchPeople`**

Em `src/lib/globalSearch.js`, trocar as linhas 21 a 23:

```js
// searchPeople(leads, query, { limit, now }) -> { results, total }.
// Cada result: { lead, matchKind: 'name'|'phone'|'cpf'|'guardian', matchRange:[s,e]|null }.
export function searchPeople(leads, query, { limit = 8, now = new Date() } = {}) {
```

por:

```js
// searchPeople(leads, query, { limit, now, include }) -> { results, total }.
// Cada result: { lead, matchKind: 'name'|'phone'|'cpf'|'guardian', matchRange:[s,e]|null }.
// `include` (opcional) recorta quem pode aparecer antes de tudo, então o total
// e o limite contam só essas pessoas. A busca do topo passa isClientLead para
// quem só vê cliente (o professor). É função recebida, e não import, porque
// leads.js importa este arquivo.
export function searchPeople(leads, query, { limit = 8, now = new Date(), include = null } = {}) {
```

E, no laço (hoje linhas 31-32), trocar:

```js
  for (const lead of leads || []) {
    const nameNorm = normalize(lead && lead.name);
```

por:

```js
  for (const lead of leads || []) {
    if (include && !include(lead)) continue;
    const nameNorm = normalize(lead && lead.name);
```

O `ReferrerPicker` chama o `searchPeople` sem `include` e continua igual.

- [ ] **Step 5: A busca do topo com `clientsOnly`**

Em `src/components/layout/GlobalSearch.jsx`, trocar a linha 4:

```js
import { searchPeople, onlyDigits } from '../../lib/globalSearch.js';
```

por:

```js
import { searchPeople, onlyDigits } from '../../lib/globalSearch.js';
import { isClientLead } from '../../lib/leads.js';
```

Trocar as linhas 89 a 92:

```jsx
// Barra de busca global fixa no header. Acha leads e clientes por nome,
// sobrenome, CPF ou telefone e abre a ficha. Desktop = barra inline; mobile =
// lupa que expande uma barra sobre o header.
export function GlobalSearch({ onAddLead, db }) {
```

por:

```jsx
// Barra de busca global fixa no header. Acha leads e clientes por nome,
// sobrenome, CPF ou telefone e abre a ficha. Desktop = barra inline; mobile =
// lupa que expande uma barra sobre o header. Com clientsOnly (quem não tem
// ACTIONS.LEADS_VER, hoje o professor, decidido no App), acha só cliente.
export function GlobalSearch({ onAddLead, db, clientsOnly = false }) {
```

Trocar as linhas 108 a 112:

```jsx
  const { candidates, loading: searchLoading } = useLeadSearch({ db, query });
  const { results, total } = useMemo(
    () => searchPeople(candidates, query, { limit: 8 }),
    [candidates, query]
  );
```

por:

```jsx
  // O recorte de cliente vem depois da leitura (include do searchPeople),
  // porque filtrar no Firestore pediria índice composto. Os candidatos são os
  // mesmos 20 por consulta, então leads com o mesmo começo de nome podem
  // tomar o lugar de um cliente na lista de quem só vê cliente.
  const { candidates, loading: searchLoading } = useLeadSearch({ db, query });
  const { results, total } = useMemo(
    () => searchPeople(candidates, query, { limit: 8, include: clientsOnly ? isClientLead : null }),
    [candidates, query, clientsOnly]
  );
  const alvo = clientsOnly ? 'clientes' : 'leads e clientes';
```

Trocar a linha 205:

```jsx
        placeholder="Buscar leads e clientes"
```

por:

```jsx
        placeholder={`Buscar ${alvo}`}
```

Trocar a linha 231:

```jsx
          <p className="text-[13px] text-slate-500 dark:text-neutral-400">Nenhum lead ou cliente encontrado</p>
```

por:

```jsx
          <p className="text-[13px] text-slate-500 dark:text-neutral-400">{clientsOnly ? 'Nenhum cliente encontrado' : 'Nenhum lead ou cliente encontrado'}</p>
```

E trocar a linha 260:

```jsx
        aria-label="Buscar leads e clientes"
```

por:

```jsx
        aria-label={`Buscar ${alvo}`}
```

O "Cadastrar novo lead" do resultado vazio já some quando `onAddLead` não vem (`{onAddLead && (`), e quem decide isso é o App, no passo seguinte.

- [ ] **Step 6: O cabeçalho do App**

Em `src/App.jsx`, no cabeçalho (hoje linhas 1644-1651), trocar:

```jsx
          {!appUser.superAdminOnly && (
            <SilentErrorBoundary>
              <GlobalSearch onAddLead={() => setIsAddLeadModalOpen(true)} db={db} />
            </SilentErrorBoundary>
          )}
          <div className="flex items-center gap-2 md:gap-3">
            {!appUser.superAdminOnly && (
              <div className="hidden sm:flex items-center mr-1">
```

por:

```jsx
          {/* Quem não cria lead (o professor) fica sem o "Cadastrar novo lead"
              da busca, e quem não vê leads acha só cliente (src/lib/acesso.js). */}
          {!appUser.superAdminOnly && (
            <SilentErrorBoundary>
              <GlobalSearch
                onAddLead={can(appUser, ACTIONS.LEAD_CRIAR) ? () => setIsAddLeadModalOpen(true) : null}
                clientsOnly={!can(appUser, ACTIONS.LEADS_VER)}
                db={db}
              />
            </SilentErrorBoundary>
          )}
          <div className="flex items-center gap-2 md:gap-3">
            {!appUser.superAdminOnly && can(appUser, ACTIONS.LEAD_CRIAR) && (
              <div className="hidden sm:flex items-center mr-1">
```

E, na montagem do cadastro rápido (hoje linhas 1804-1806), trocar:

```jsx
      {isAddLeadModalOpen && (
        <ModalErrorBoundary onClose={() => setIsAddLeadModalOpen(false)}>
          <AddLeadModal
```

por:

```jsx
      {isAddLeadModalOpen && can(appUser, ACTIONS.LEAD_CRIAR) && (
        <ModalErrorBoundary onClose={() => setIsAddLeadModalOpen(false)}>
          <AddLeadModal
```

A busca continua dentro do `SilentErrorBoundary` e o modal dentro do `ModalErrorBoundary`, então o `protecaoDeErro.sweep.test.js` segue valendo. O App também passa `onAddLeadClick` ao `LeadsView`, mas a tela nem lê esse valor e o professor não abre Todos os leads, então fica como está.

- [ ] **Step 7: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/globalSearchScope.test.js src/lib/__tests__/globalSearch.test.js src/lib/__tests__/searchBellLinks.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/menuLinks.test.js
npx eslint src/lib/globalSearch.js src/components/layout/GlobalSearch.jsx src/App.jsx src/lib/__tests__/globalSearchScope.test.js
```

Expected: tudo verde, com `globalSearchScope` em `Tests  7 passed (7)`; o eslint sem erro. Se o eslint reclamar de `isProfessor` ou `isSeller` sem uso no App, é sinal de que a Task 7 não foi aplicada inteira: volte a ela, não apague o import.

- [ ] **Step 8: Commit da busca**

```bash
git add src/lib/globalSearch.js src/components/layout/GlobalSearch.jsx src/App.jsx src/lib/__tests__/globalSearchScope.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: busca do topo do professor acha só cliente e ninguém sem permissão cadastra lead pelo topo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Escrever o teste do sino**

Criar `src/lib/__tests__/notificationsProfessor.test.js`:

```js
// O sino do professor: só as novidades do Stronilead (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). Nada de indicações pelo link nem de "passaram para você", mesmo que
// algum lead aponte para ele como dono. O consultor, com a mesma carteira,
// continua recebendo os dois grupos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildNotificationFeed, emptyBellText } from '../notifications.js';

const NOW = new Date(2026, 9, 2, 12, 0);
const ago = (h) => new Date(NOW.getTime() - h * 3600_000);

const ANNS = [
  { id: 'a1', audience: 'todos', eyebrow: 'Novidade', title: 'Para todos', summary: 's1', date: '2026-09-30' },
  { id: 'a2', audience: 'gestor', eyebrow: 'Novidade', title: 'Só gestor', summary: 's2', date: '2026-09-29' }
];

const professor = { id: 'p1', authUid: 'uidp', role: 'professor', professorId: 'prof1' };
const consultor = { id: 'u1', authUid: 'uid1', role: 'consultant' };
const gestor = { id: 'u9', authUid: 'uid9', role: 'admin' };

const indicado = (over) => ({
  id: 'l1', name: 'João', referralVia: 'link', referredByName: 'Maria',
  consultantId: 'p1', consultantAuthUid: 'uidp', createdAt: ago(1), ...over
});
const passado = (over) => ({
  id: 'l9', name: 'Carla', consultantId: 'p1', consultantAuthUid: 'uidp',
  consultantChangedAt: ago(2), consultantChangedByName: 'Bruno', consultantChangedByAuthUid: 'uid2', ...over
});

describe('sino do professor', () => {
  it('recebe só as novidades para todos', () => {
    const feed = buildNotificationFeed({
      announcements: ANNS, appUser: professor, leads: [indicado()], handoffLeads: [passado()], now: NOW
    });
    expect(feed.news.map((n) => n.id)).toEqual(['a1']);
    expect(feed.referrals).toEqual([]);
    expect(feed.handoffs).toEqual([]);
    expect(feed.unreadCount).toBe(1);
  });

  it('a mesma carteira, com o consultor como dono, continua chegando ao consultor', () => {
    const dele = { consultantId: 'u1', consultantAuthUid: 'uid1' };
    const feed = buildNotificationFeed({
      announcements: ANNS, appUser: consultor, leads: [indicado(dele)], handoffLeads: [passado(dele)], now: NOW
    });
    expect(feed.news.map((n) => n.id)).toEqual(['a1']);
    expect(feed.referrals.map((r) => r.id)).toEqual(['l1']);
    expect(feed.handoffs.map((h) => h.id)).toEqual(['l9']);
    expect(feed.unreadCount).toBe(3);
  });

  it('o gestor continua vendo a novidade de gestor e as indicações da academia', () => {
    const feed = buildNotificationFeed({
      announcements: ANNS, appUser: gestor, leads: [indicado()], handoffLeads: [], now: NOW
    });
    expect(feed.news.map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(feed.referrals.map((r) => r.id)).toEqual(['l1']);
  });
});

describe('texto do sino vazio', () => {
  it('o professor ouve só das novidades; quem vende, dos três grupos', () => {
    expect(emptyBellText(professor)).toBe('Nada por aqui ainda. As novidades do Stronilead aparecem neste espaço.');
    const deQuemVende = 'Nada por aqui ainda. Novidades do sistema, indicações pelo link e leads que passarem pra você aparecem neste espaço.';
    expect(emptyBellText(consultor)).toBe(deQuemVende);
    expect(emptyBellText(gestor)).toBe(deQuemVende);
  });
});

// O App só busca os "passados pra você" (useHandoffs, uma leitura por sessão)
// para quem recebe esse grupo no sino. O App inteiro não roda em teste de
// node, então o texto dele é lido.
describe('o App não busca os passados pra você de quem não os recebe', () => {
  it('o useHandoffs liga só com ACTIONS.SINO_EQUIPE', () => {
    const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');
    expect(app).toContain('useHandoffs({ db, appUser, enabled: !!appUser && !appUser.superAdminOnly && can(appUser, ACTIONS.SINO_EQUIPE) })');
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/notificationsProfessor.test.js`

Expected: FAIL, `Tests  3 failed | 2 passed (5)`.
- Hoje o professor é tratado como consultor, então a indicação e o "passado" que apontam para ele aparecem (`expected [ { id: 'l1', ... } ] to deeply equal []`).
- O `emptyBellText` não existe (`TypeError: emptyBellText is not a function`).
- O App ainda liga o `useHandoffs` para todos.
- Os casos do consultor e do gestor passam antes e depois: são a guarda de que nada muda para quem vende.

- [ ] **Step 11: O feed do sino pela lista de permissões**

Em `src/lib/notifications.js`, trocar as linhas 7 a 9 do comentário do topo:

```js
//   • passados pra você — leads/clientes que outra pessoa reatribuiu pra sua
//     carteira (campo consultantChangedAt), no MESMO carimbo das indicações:
//     o "marcar tudo como lido" é um clique só, então um carimbo basta.
```

por:

```js
//   • passados pra você — leads/clientes que outra pessoa reatribuiu pra sua
//     carteira (campo consultantChangedAt), no MESMO carimbo das indicações:
//     o "marcar tudo como lido" é um clique só, então um carimbo basta.
// Indicações e passados pra você são avisos de carteira, e só chegam a quem
// tem ACTIONS.SINO_EQUIPE (lib/acesso.js). O professor fica só com as
// novidades.
```

Trocar as linhas 16 e 17:

```js
import { getSafeDateOrNull } from './dates.js';
import { seenAnnouncementIds } from './announcements.js';
```

por:

```js
import { getSafeDateOrNull } from './dates.js';
import { seenAnnouncementIds } from './announcements.js';
import { ACTIONS, can, isGestor } from './acesso.js';
```

Trocar a linha 36:

```js
  const isAdmin = appUser.role === 'admin';
```

por:

```js
  const isAdmin = isGestor(appUser);
  // Os dois grupos de carteira (indicações e passados pra você). Quem não
  // vende, o professor, fica só com as novidades.
  const teamFeed = can(appUser, ACTIONS.SINO_EQUIPE);
```

Trocar a linha 59:

```js
  const referrals = (leads || [])
```

por:

```js
  const referrals = (teamFeed ? (leads || []) : [])
```

Trocar a linha 84:

```js
  [...(handoffLeads || []), ...(leads || [])].forEach((l) => {
```

por:

```js
  const handoffSources = teamFeed ? [...(handoffLeads || []), ...(leads || [])] : [];
  handoffSources.forEach((l) => {
```

E, logo depois do fim do `buildNotificationFeed` (a linha 109, `return { news, referrals, handoffs, unreadCount };`, e o `}` da 110), acrescentar:

```js

// Texto do sino sem nenhum aviso. Diz só o que a pessoa pode receber: quem
// não tem os grupos de carteira não ouve falar de indicação nem de lead
// passado.
export function emptyBellText(appUser) {
  return can(appUser, ACTIONS.SINO_EQUIPE)
    ? 'Nada por aqui ainda. Novidades do sistema, indicações pelo link e leads que passarem pra você aparecem neste espaço.'
    : 'Nada por aqui ainda. As novidades do Stronilead aparecem neste espaço.';
}
```

O recorte academia contra carteira (`isMine`) continua no `isGestor`, como era no `role === 'admin'`.

- [ ] **Step 12: O sino na tela**

Em `src/components/layout/NotificationBell.jsx`, trocar a linha 5:

```js
import { buildNotificationFeed } from '../../lib/notifications.js';
```

por:

```js
import { buildNotificationFeed, emptyBellText } from '../../lib/notifications.js';
import { isGestor } from '../../lib/acesso.js';
```

Trocar as linhas 127 a 129:

```jsx
            <p className="px-3.5 py-8 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
              Nada por aqui ainda. Novidades do sistema, indicações pelo link e leads que passarem pra você aparecem neste espaço.
            </p>
```

por:

```jsx
            <p className="px-3.5 py-8 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
              {emptyBellText(appUser)}
            </p>
```

E trocar a linha 186:

```jsx
            {appUser?.role === 'admin' ? 'Você vê as indicações da academia' : 'Você vê as indicações da sua carteira'}
```

por:

```jsx
            {isGestor(appUser) ? 'Você vê as indicações da academia' : 'Você vê as indicações da sua carteira'}
```

- [ ] **Step 13: O `useHandoffs` só para quem recebe o grupo**

Em `src/App.jsx` (hoje linhas 251-252), trocar:

```jsx
  // Leads/clientes que passaram pra carteira desta pessoa (grupo do sino).
  const handoffLeads = useHandoffs({ db, appUser, enabled: !!appUser && !appUser.superAdminOnly });
```

por:

```jsx
  // Leads/clientes que passaram pra carteira desta pessoa (grupo do sino). O
  // professor não tem carteira nem esse grupo (ACTIONS.SINO_EQUIPE), então a
  // leitura nem sai.
  const handoffLeads = useHandoffs({ db, appUser, enabled: !!appUser && !appUser.superAdminOnly && can(appUser, ACTIONS.SINO_EQUIPE) });
```

- [ ] **Step 14: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/notificationsProfessor.test.js src/lib/__tests__/notifications.test.js src/lib/__tests__/searchBellLinks.test.js
npx eslint src/lib/notifications.js src/components/layout/NotificationBell.jsx src/App.jsx src/lib/__tests__/notificationsProfessor.test.js
```

Expected: tudo verde, com `notificationsProfessor` em `Tests  5 passed (5)`. O `notifications.test.js` de hoje usa os papéis `consultant` e `admin` e não muda. O eslint sem erro.

- [ ] **Step 15: Commit do sino**

```bash
git add src/lib/notifications.js src/components/layout/NotificationBell.jsx src/App.jsx src/lib/__tests__/notificationsProfessor.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: sino do professor mostra só as novidades do Stronilead" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 16: Escrever os testes da ficha**

Criar `src/lib/__tests__/profileProfessor.test.js`:

```js
// O professor na ficha (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "O que ele vê"). Ele registra Anotação, WhatsApp, Ligação e Agendar. Não
// tem Mudar fase, lápis, foto, etiqueta, Indicar, Marcar venda, Marcar perda
// nem Excluir, e Contratos e Indicações aparecem sem botão.
// A ficha inteira é renderizada em node (renderToString), no molde de
// profileContractsTab.test.js. Cada caso renderiza também o gestor ou o
// consultor, para provar que o texto procurado existe quando o botão aparece.
// Sem isso, um texto digitado errado aqui passaria sempre.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { hrefFor } from '../routes.js';
import { REFERRAL_FUNNEL_KIND } from '../referrals.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');
const { ReferralsSection } = await import('../../components/profile/ReferralsSection.jsx');

const D = (y, m, d) => new Date(y, m - 1, d);
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };

const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};
// O funil Indicações com a etapa de entrada: sem os dois, o gestor também não
// teria o Cadastrar indicação, e o caso do professor não provaria nada.
const FUNNELS = [{ id: 'fi', name: 'Indicações', systemKind: REFERRAL_FUNNEL_KIND }];
const STATUSES = [{ id: 's1', funnelId: 'fi', name: 'Aguardando ação', isEntry: true, order: 0 }];
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

// O Start em uso até 11/10/2026 e o Flow, renovação emendada, a partir de 12/10.
const start = {
  id: 'k1', leadId: 'c1', planId: 'p1', planName: 'Start', value: 1200, listValue: 1200, durationMonths: 12,
  status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 11), consultantName: 'Ana'
};
const flow = {
  id: 'k2', leadId: 'c1', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12,
  status: 'ativo', renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28), consultantName: 'Ana'
};
const vencido = { ...start, endsAt: D(2026, 9, 10) };

const cliente = (atual) => ({
  id: 'c1', name: 'Carla Dias', whatsapp: '11999990000', status: 'Venda', lifecycleStage: 'cliente', isConverted: true,
  clienteSince: D(2025, 10, 11), createdAt: D(2025, 9, 1), consultantName: 'Ana', tags: [],
  currentContractId: atual.id, currentPlanName: atual.planName, currentContractValue: atual.value,
  currentContractStartsAt: atual.startsAt, currentContractEndsAt: atual.endsAt,
  currentContractStatus: atual.status, currentContractSeamless: Boolean(atual.seamless)
});
const LEAD = { id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: D(2026, 9, 1), tags: [] };
// Lead no funil Indicações sem indicador: é ele que mostra o "Vincular indicador".
const LEAD_INDICADO = { ...LEAD, id: 'l2', funnelId: 'fi', status: 'Aguardando ação' };

const ficha = ({ lead, tab, appUser, contratos = [] }) => renderToString(
  createElement(MemoryRouter, { initialEntries: [`/acad/ficha/${lead.id}`] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(GeneralConfigContext.Provider, { value: { ...CONFIG, contratos } },
        createElement(LeadProfileView, {
          lead, tab, onTab: () => {}, onBack: () => {}, appUser,
          statuses: STATUSES, tags: [], lossReasons: [], usersList: [GESTOR, CONSULTOR, PROFESSOR],
          db: {}, funnels: FUNNELS,
        })))));

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
afterAll(() => { vi.useRealTimers(); });

describe('ficha do professor: aba CRM', () => {
  it('tem Anotação, WhatsApp, Ligação e Agendar, sem Mudar fase', () => {
    const prof = ficha({ lead: cliente(start), tab: 'crm', appUser: PROFESSOR, contratos: [start] });
    ['>Anotação<', '>WhatsApp<', '>Ligação<', '>Agendar<'].forEach((aba) => expect(prof).toContain(aba));
    expect(prof).not.toContain('Mudar fase');
  });

  it('gestor e consultor continuam com o Mudar fase', () => {
    expect(ficha({ lead: cliente(start), tab: 'crm', appUser: GESTOR, contratos: [start] })).toContain('>Mudar fase<');
    expect(ficha({ lead: LEAD, tab: 'crm', appUser: CONSULTOR })).toContain('>Mudar fase<');
  });
});

describe('ficha do professor: cabeçalho', () => {
  const BOTOES = ['title="Editar cadastro"', 'title="Alterar foto"', 'title="Excluir lead"', 'Adicionar etiqueta'];

  it('no cliente, o gestor tem lápis, foto, etiqueta, Indicar e Excluir', () => {
    const html = ficha({ lead: cliente(start), tab: 'timeline', appUser: GESTOR, contratos: [start] });
    BOTOES.forEach((b) => expect(html).toContain(b));
    expect(html).toMatch(/ Indicar<\/button>/);
  });

  it('no cliente, o professor só chama: WhatsApp e Ligar', () => {
    const html = ficha({ lead: cliente(start), tab: 'timeline', appUser: PROFESSOR, contratos: [start] });
    BOTOES.forEach((b) => expect(html).not.toContain(b));
    expect(html).not.toMatch(/ Indicar<\/button>/);
    expect(html).toContain('>WhatsApp<');
    expect(html).toContain('>Ligar<');
  });

  it('num lead, o professor não marca venda nem perda', () => {
    const consultor = ficha({ lead: LEAD, tab: 'timeline', appUser: CONSULTOR });
    expect(consultor).toContain('>Marcar venda<');
    expect(consultor).toContain('>Marcar perda<');
    // A exclusão continua só do gestor.
    expect(consultor).not.toContain('title="Excluir lead"');
    const prof = ficha({ lead: LEAD, tab: 'timeline', appUser: PROFESSOR });
    expect(prof).not.toContain('Marcar venda');
    expect(prof).not.toContain('Marcar perda');
    expect(prof).toContain('>Ligar<');
  });

  it('num lead do funil Indicações, o professor não vincula o indicador', () => {
    expect(ficha({ lead: LEAD_INDICADO, tab: 'timeline', appUser: CONSULTOR })).toContain('Vincular indicador');
    expect(ficha({ lead: LEAD_INDICADO, tab: 'timeline', appUser: PROFESSOR })).not.toContain('Vincular indicador');
  });
});

describe('ficha do professor: Contratos só para leitura', () => {
  it('contrato em uso com o próximo marcado: o professor vê os dois, sem botão', () => {
    const BOTOES = ['>Trancar<', '>Cancelar<', 'Ativar agora', '>Corrigir<', '>Cancelar renovação<'];
    const gestor = ficha({ lead: cliente(flow), tab: 'contratos', appUser: GESTOR, contratos: [start, flow] });
    BOTOES.forEach((b) => expect(gestor).toContain(b));
    const prof = ficha({ lead: cliente(flow), tab: 'contratos', appUser: PROFESSOR, contratos: [start, flow] });
    BOTOES.forEach((b) => expect(prof).not.toContain(b));
    expect(prof).toContain('>Start<');
    expect(prof).toContain('>Flow<');
    expect(prof).toContain('>Próximo<');
    expect(prof).toContain('>Histórico<');
  });

  it('sem próximo, vencido ou sem contrato: nada de Renovar, Nova matrícula nem Matricular', () => {
    const casos = [
      [cliente(start), [start], 'Renovar contrato'],
      [cliente(vencido), [vencido], 'Nova matrícula'],
      [LEAD, [], 'Matricular agora'],
    ];
    casos.forEach(([lead, contratos, botao]) => {
      expect(ficha({ lead, tab: 'contratos', appUser: CONSULTOR, contratos })).toContain(botao);
      expect(ficha({ lead, tab: 'contratos', appUser: PROFESSOR, contratos })).not.toContain(botao);
    });
  });
});

describe('ficha do professor: Indicações só para leitura', () => {
  it('o gestor tem o Cadastrar indicação; o professor vê a aba sem ele', () => {
    const gestor = ficha({ lead: cliente(start), tab: 'referrals', appUser: GESTOR, contratos: [start] });
    expect(gestor).toContain('Cadastrar indicação');
    const prof = ficha({ lead: cliente(start), tab: 'referrals', appUser: PROFESSOR, contratos: [start] });
    expect(prof).toContain('Nenhuma indicação ainda');
    expect(prof).not.toContain('Cadastrar indicação');
    expect(prof).not.toContain('botão Indicar');
  });

  it('ReferralsSection com canRefer falso não manda procurar o Indicar', () => {
    const html = renderToString(
      createElement(MemoryRouter, { initialEntries: ['/acad/ficha/c1/indicacoes'] },
        createElement(LeadProfileContext.Provider, { value: profile },
          createElement(ReferralsSection, { items: [], loading: false, canRefer: false }))));
    expect(html).toContain('Nenhuma indicação ainda');
    expect(html).toContain('Quando este cliente indicar alguém, a pessoa aparece aqui com o andamento dela.');
    expect(html).not.toContain('botão Indicar');
  });
});
```

E criar `src/lib/__tests__/ownerPickersProfessor.test.js`, em jsdom, porque as duas escolhas de pessoa só existem com o balão aberto:

```js
// @vitest-environment jsdom
// O professor não é dono de lead nem recebe tarefa de contato (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "Professor
// e consultor"). As duas escolhas de pessoa da ficha deixam o professor de
// fora: o "Consultor responsável" do Editar cadastro e o passo "Responsável"
// do Agendar mensagem. As duas só existem com o balão aberto, então a ficha é
// montada em jsdom e clicada, como em contractActivateModal.test.js.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');
const { ClientRegistrationModal } = await import('../../modals/ClientRegistrationModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'u1', name: 'Bruno Gestor', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa Professor', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };
const EQUIPE = [GESTOR, CONSULTOR, PROFESSOR];
// O lead é do gestor, então o passo Responsável lista as outras pessoas da equipe.
const LEAD = {
  id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1),
  tags: [], consultantId: 'u1', consultantName: 'Bruno Gestor'
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

let root = null;
async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/ficha/l1/crm'] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG }, elemento)))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});
const clicar = async (rotulo) => {
  const alvo = [...document.querySelectorAll('button')].find((el) => el.textContent.trim().startsWith(rotulo));
  expect(alvo, rotulo).toBeTruthy();
  await act(async () => { alvo.click(); });
};

describe('o professor fora das escolhas de pessoa da ficha', () => {
  it('Agendar mensagem: o passo Responsável lista o consultor e não o professor', async () => {
    await montar(h(LeadProfileView, {
      lead: LEAD, tab: 'crm', onTab: () => {}, onBack: () => {}, appUser: GESTOR,
      statuses: [], tags: [], lossReasons: [], usersList: EQUIPE, db: {}, funnels: [],
    }));
    await clicar('Agendar');
    await clicar('Mensagem');
    expect(document.body.textContent).toContain('Responsável pelo lead (Bruno Gestor)');
    expect(document.body.textContent).toContain('Ana Consultora');
    expect(document.body.textContent).not.toContain('Rafa Professor');
  });

  it('Editar cadastro: o Consultor responsável lista o consultor e não o professor', async () => {
    await montar(h(ClientRegistrationModal, {
      open: true, onClose: () => {}, lead: LEAD, appUser: GESTOR, db: null, usersList: EQUIPE, tags: [],
    }));
    await clicar('Relacionamento');
    const opcoes = [...document.querySelectorAll('option')].map((o) => o.textContent);
    expect(opcoes).toContain('Ana Consultora');
    expect(opcoes).not.toContain('Rafa Professor');
  });
});
```

- [ ] **Step 17: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/profileProfessor.test.js src/lib/__tests__/ownerPickersProfessor.test.js`

Expected: FAIL, `Tests  10 failed | 2 passed (12)`. Com `authUid`, o professor hoje tem a ficha do consultor:
- aparecem o Mudar fase, o lápis, a foto, o Indicar, o "Vincular indicador", Marcar venda e perda, os botões de contrato e o "Cadastrar indicação";
- o `canRefer` é ignorado;
- as duas escolhas de pessoa listam "Rafa Professor".

Passam só dois casos, que são a guarda de que nada muda para quem vende: "gestor e consultor continuam com o Mudar fase" e "no cliente, o gestor tem lápis, foto, etiqueta, Indicar e Excluir".

- [ ] **Step 18: `ReferralsSection` com `canRefer`**

Em `src/components/profile/ReferralsSection.jsx`, trocar as linhas 31 a 35:

```jsx
// (opcional) liga o botão de cadastrar indicação à mão; a ficha só passa
// quando a academia tem o funil Indicações e a pessoa pode editar.
// O estado de cada indicado é derivado AO VIVO do doc dele (deriveLeadState/
// isClientLead) — desfazer uma Venda reflete aqui sozinho.
export function ReferralsSection({ items, loading, onAdd = null }) {
```

por:

```jsx
// (opcional) liga o botão de cadastrar indicação à mão; a ficha só passa
// quando a academia tem o funil Indicações e a pessoa pode editar.
// `canRefer` (padrão true) diz se quem vê tem o menu Indicar. O professor não
// tem (src/lib/acesso.js), então o aviso de vazio não manda procurar o botão.
// O estado de cada indicado é derivado AO VIVO do doc dele (deriveLeadState/
// isClientLead) — desfazer uma Venda reflete aqui sozinho.
export function ReferralsSection({ items, loading, onAdd = null, canRefer = true }) {
```

E trocar as linhas 58 a 63:

```jsx
        <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[420px] mx-auto leading-relaxed">
          {onAdd
            ? 'Use o botão Indicar, no topo da ficha, para cadastrar as indicações do cliente ou mandar o link para ele convidar os amigos. Também dá para cadastrar um lead novo com o interruptor “É uma indicação?”.'
            : 'Use o botão Indicar, no topo da ficha, para mandar o link para o cliente convidar os amigos, ou cadastre um lead novo com o interruptor “É uma indicação?”.'}
          {' '}Os indicados aparecem aqui com o andamento de cada um.
        </p>
```

por:

```jsx
        <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[420px] mx-auto leading-relaxed">
          {!canRefer ? 'Quando este cliente indicar alguém, a pessoa aparece aqui com o andamento dela.' : (
            <>
              {onAdd
                ? 'Use o botão Indicar, no topo da ficha, para cadastrar as indicações do cliente ou mandar o link para ele convidar os amigos. Também dá para cadastrar um lead novo com o interruptor “É uma indicação?”.'
                : 'Use o botão Indicar, no topo da ficha, para mandar o link para o cliente convidar os amigos, ou cadastre um lead novo com o interruptor “É uma indicação?”.'}
              {' '}Os indicados aparecem aqui com o andamento de cada um.
            </>
          )}
        </p>
```

Os dois textos de quem tem o Indicar continuam iguais aos de hoje, com as aspas que já estavam lá. O `referralsSection.test.js` não passa `canRefer` e continua verde.

- [ ] **Step 19: A ficha pela lista de permissões (`src/views/LeadProfileView.jsx`)**

São 28 trocas no mesmo arquivo, de cima para baixo. O `isReadOnly` continua sendo `!canEditLead(appUser)` e continua barrando quem está sem `authUid`. Cada ação passa a perguntar também à lista, porque usar só o `can()` devolveria os botões a um consultor sem `authUid`.

19.1. Linha 10, trocar:

```js
import { isAdminUser, canEditLead, isLeadConverted, ZAP_VIA } from '../lib/leads.js';
```

por:

```js
import { canEditLead, isLeadConverted, ZAP_VIA } from '../lib/leads.js';
import { ACTIONS, can, isGestor, isSeller } from '../lib/acesso.js';
```

19.2. Linhas 116 a 119, trocar:

```js
  // contrato e reatribuição de responsável andam junto com isso: isReadOnly hoje
  // só barra quem está sem vínculo de authUid (ver canEditLead). A exclusão é a
  // única coisa que continua no gestor (isAdminUser).
  const canTimeline = Boolean(appUser?.authUid);
```

por:

```js
  // contrato e reatribuição de responsável andam junto com isso: isReadOnly hoje
  // só barra quem está sem vínculo de authUid (ver canEditLead). A exclusão é a
  // única coisa que continua no gestor (isGestor).
  const canTimeline = Boolean(appUser?.authUid);
  // O que o papel libera na ficha, pela lista única de src/lib/acesso.js. O
  // professor registra Anotação, WhatsApp, Ligação e Agendar e vê Contratos e
  // Indicações sem botão. O isReadOnly continua valendo para quem está sem
  // authUid, do jeito de antes.
  const canEditCadastro = !isReadOnly && can(appUser, ACTIONS.CADASTRO_EDITAR);
  const canMudarFase = can(appUser, ACTIONS.FICHA_MUDAR_FASE);
  const canContrato = can(appUser, ACTIONS.CONTRATO_EDITAR);
  const canIndicar = can(appUser, ACTIONS.INDICACAO_CADASTRAR);
  // Última trava dos handlers. O botão já some, mas a ação não pode passar
  // por outro caminho.
  const negarAcesso = () => toast.warning('Essa ação não está liberada para o seu acesso.');
```

O `toast` vem do `useToast()` da linha 111, antes deste bloco, e nada aqui é hook novo.

19.3. A foto grava `photoUrl`, `photoPath` e `photoUpdatedAt` no lead, que são campos de cadastro. Linhas 152-153, trocar:

```js
  const handlePhotoPicked = async (blob) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
```

por:

```js
  const handlePhotoPicked = async (blob) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canEditCadastro) { negarAcesso(); return; }
```

E linhas 174-175, trocar:

```js
  const handlePhotoRemove = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
```

por:

```js
  const handlePhotoRemove = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canEditCadastro) { negarAcesso(); return; }
```

19.4. Excluir continua só do gestor, agora pelo `isGestor`, antes do confirm. Linhas 214-215, trocar:

```js
  const handleDelete = async () => {
    if (!window.confirm("Excluir este lead permanentemente? Não dá pra desfazer.")) return;
```

por:

```js
  const handleDelete = async () => {
    if (!isGestor(appUser)) { negarAcesso(); return; }
    if (!window.confirm("Excluir este lead permanentemente? Não dá pra desfazer.")) return;
```

19.5. Toda entrada de contrato (matrícula, renovação, desfecho, corrigir e ativar) pede `CONTRATO_EDITAR`. Nas linhas 247 a 279, trocar cada uma das cinco aberturas abaixo e deixar como estão os comentários entre elas.

Trocar:

```js
  const handleWin = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setMatriculaMode('matricula');
```

por:

```js
  const handleWin = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
    setMatriculaMode('matricula');
```

Trocar:

```js
  const handleRenew = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setMatriculaMode('renovacao');
```

por:

```js
  const handleRenew = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
    setMatriculaMode('renovacao');
```

Trocar:

```js
  const openContractAction = (action, contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
```

por:

```js
  const openContractAction = (action, contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
```

Trocar:

```js
  const openContractEdit = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
```

por:

```js
  const openContractEdit = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
```

Trocar:

```js
  const openActivate = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
```

por:

```js
  const openActivate = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
```

19.6. A Perda e todo caminho do PhaseChanger pedem `FICHA_MUDAR_FASE`. A Venda pelo PhaseChanger abre o `ContractModal` direto, sem passar pelo `handleWin`, então pede também `CONTRATO_EDITAR`. Hoje o professor tem as duas falsas, então isso só faz diferença quando os perfis forem editáveis. Linhas 285-286, trocar:

```js
  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
```

por:

```js
  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canMudarFase) { negarAcesso(); setLossModalOpen(false); return; }
```

E linhas 345-346, trocar:

```js
  const handlePhaseConfirm = async ({ funnelId: targetFunnelId, targetStatus, note: phaseNote, referrer }) => {
    if (targetStatus === 'Venda') {
```

por:

```js
  const handlePhaseConfirm = async ({ funnelId: targetFunnelId, targetStatus, note: phaseNote, referrer }) => {
    if (!canMudarFase) { negarAcesso(); return; }
    if (targetStatus === 'Venda') {
      // Venda abre o contrato, então pede também a ação de contrato.
      if (!canContrato) { negarAcesso(); return; }
```

19.7. Vincular ou remover o indicador grava o lead e duas linhas do tempo, então é ação de indicação. Linhas 448-449, trocar:

```js
  const handleSaveReferral = async () => {
    if (!referrerPick) return;
```

por:

```js
  const handleSaveReferral = async () => {
    if (!canIndicar) { negarAcesso(); return; }
    if (!referrerPick) return;
```

E linhas 465-466, trocar:

```js
  const handleRemoveReferral = async () => {
    setLoading(true);
```

por:

```js
  const handleRemoveReferral = async () => {
    if (!canIndicar) { negarAcesso(); return; }
    setLoading(true);
```

19.8. O dono da tarefa do Agendar (passo "Responsável" do `ScheduleWizard`) é escolha de quem vende, e isso vale para qualquer pessoa que abra a ficha. Linhas 501 a 506, trocar:

```js
  // Só usuários ATIVOS podem receber tarefa: delegar para quem saiu da academia
  // deixaria a tarefa órfã, sem aparecer para ninguém.
  const activeUsers = useMemo(
    () => (usersList || []).filter(u => u?.id && u.name && u.active !== false),
    [usersList]
  );
```

por:

```js
  // Só usuários ATIVOS podem receber tarefa: delegar para quem saiu da academia
  // deixaria a tarefa órfã, sem aparecer para ninguém. O professor também não
  // recebe tarefa de contato, porque não vende (isSeller, em src/lib/acesso.js).
  const activeUsers = useMemo(
    () => (usersList || []).filter(u => u?.id && u.name && u.active !== false && isSeller(u)),
    [usersList]
  );
```

19.9. Linhas 690 a 692, trocar:

```js
  // indicação?" do Novo lead, e só para quem pode editar.
  const referralEntry = referralFunnel ? getReferralEntryStage(statuses, referralFunnel.id) : null;
  const canQuickReferral = isClient && !isReadOnly && Boolean(referralFunnel && referralEntry);
```

por:

```js
  // indicação?" do Novo lead, e só para quem pode editar e cadastrar indicação.
  const referralEntry = referralFunnel ? getReferralEntryStage(statuses, referralFunnel.id) : null;
  const canQuickReferral = isClient && !isReadOnly && canIndicar && Boolean(referralFunnel && referralEntry);
```

19.10. A aba Mudar fase do composer some. O corpo da aba também fica preso, para o PhaseChanger nunca aparecer. Linhas 794 a 797, trocar:

```jsx
          { id: 'call',     label: 'Ligação',    icon: <Phone size={13} /> },
          { id: 'status',   label: 'Mudar fase', icon: <RefreshCw size={13} /> },
          { id: 'schedule', label: 'Agendar',    icon: <Calendar size={13} /> }
        ].map(t => (
```

por:

```jsx
          { id: 'call',     label: 'Ligação',    icon: <Phone size={13} /> },
          // Mudar fase fica fora de quem não muda fase (o professor).
          ...(canMudarFase ? [{ id: 'status', label: 'Mudar fase', icon: <RefreshCw size={13} /> }] : []),
          { id: 'schedule', label: 'Agendar',    icon: <Calendar size={13} /> }
        ].map(t => (
```

E linhas 850-851, trocar:

```jsx
            {composerTab === 'status' && (
              <>
```

por:

```jsx
            {composerTab === 'status' && canMudarFase && (
              <>
```

O único ponto que chama `setComposerTab('status')` é o clique na aba (linha 801).

19.11. A câmera do avatar (linha 1169), trocar:

```jsx
              onPhotoClick={isReadOnly || photoBusy ? null : () => setPhotoMenuOpen(true)}
```

por:

```jsx
              onPhotoClick={!canEditCadastro || photoBusy ? null : () => setPhotoMenuOpen(true)}
```

19.12. O lápis e o "Adicionar etiqueta", que abre o mesmo modal. Linhas 1198 a 1200, trocar:

```jsx
                {!isReadOnly && (
                  <IconBtn icon={<Pencil size={16} />} kind="default" title="Editar cadastro" onClick={() => setIsEditing(true)} />
                )}
```

por:

```jsx
                {canEditCadastro && (
                  <IconBtn icon={<Pencil size={16} />} kind="default" title="Editar cadastro" onClick={() => setIsEditing(true)} />
                )}
```

E a linha 1207, trocar:

```jsx
                {(lead.tags || []).length === 0 && !isReadOnly && (
```

por:

```jsx
                {(lead.tags || []).length === 0 && canEditCadastro && (
```

19.13. O lápis do "Indicado por" e o "Vincular indicador". O link "Indicado por" fica, porque é navegação. Linhas 1231 a 1234, trocar:

```jsx
                    {!isReadOnly && (
                      <button
                        type="button"
                        title="Editar vínculo de indicação"
```

por:

```jsx
                    {!isReadOnly && canIndicar && (
                      <button
                        type="button"
                        title="Editar vínculo de indicação"
```

E a linha 1242, trocar:

```jsx
                ) : (isInReferralFunnel && !isReadOnly && (
```

por:

```jsx
                ) : (isInReferralFunnel && !isReadOnly && canIndicar && (
```

19.14. O menu Indicar inteiro (Cadastrar indicação, Copiar link e Enviar pro cliente) sai de quem não cadastra indicação, como a spec pede. Quem está sem `authUid` continua com Copiar e Enviar, como hoje. Linhas 1259-1260, trocar:

```jsx
              {isClient && (
                <DropdownMenu>
```

por:

```jsx
              {/* O menu Indicar inteiro (cadastrar, copiar e enviar o link) é de
                  quem cadastra indicação. O professor fica sem ele. */}
              {isClient && canIndicar && (
                <DropdownMenu>
```

19.15. Marcar venda abre o `ContractModal` (contrato) e Marcar perda muda a fase. Excluir passa ao `isGestor`. O professor chega à ficha de lead pelos links da aba Indicações, então isso vale mesmo com a busca achando só cliente. Linhas 1294 a 1323, trocar:

```jsx
              {/* Venda/Perda só fazem sentido p/ LEAD: cliente já converteu e gere
                  o contrato pela aba Contratos (Renovar / Cancelar). */}
              {!isClient && (
                <>
                  <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-0.5 hidden sm:block"></div>
                  <Btn
                    kind="success"
                    size="md"
                    icon={<TrendingUp size={14} />}
                    onClick={handleWin}
                    disabled={lead.status === 'Venda' || loading}
                    title={lead.status === 'Venda' ? 'Lead já marcado como venda' : 'Marcar venda'}
                  >
                    Marcar venda
                  </Btn>
                  <Btn
                    kind="danger"
                    size="md"
                    icon={<Ban size={14} />}
                    onClick={() => setLossModalOpen(true)}
                    disabled={lead.status === 'Perda' || loading}
                    title={lead.status === 'Perda' ? 'Lead já marcado como perda' : 'Marcar perda'}
                  >
                    Marcar perda
                  </Btn>
                </>
              )}
              {isAdminUser(appUser) && (
                <IconBtn icon={<Trash size={15} />} kind="danger" title="Excluir lead" onClick={handleDelete} />
              )}
```

por:

```jsx
              {/* Venda/Perda só fazem sentido p/ LEAD: cliente já converteu e gere
                  o contrato pela aba Contratos (Renovar / Cancelar). Venda abre o
                  contrato e Perda muda a fase, então cada um segue a sua ação. */}
              {!isClient && (canContrato || canMudarFase) && (
                <>
                  <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-0.5 hidden sm:block"></div>
                  {canContrato && (
                    <Btn
                      kind="success"
                      size="md"
                      icon={<TrendingUp size={14} />}
                      onClick={handleWin}
                      disabled={lead.status === 'Venda' || loading}
                      title={lead.status === 'Venda' ? 'Lead já marcado como venda' : 'Marcar venda'}
                    >
                      Marcar venda
                    </Btn>
                  )}
                  {canMudarFase && (
                    <Btn
                      kind="danger"
                      size="md"
                      icon={<Ban size={14} />}
                      onClick={() => setLossModalOpen(true)}
                      disabled={lead.status === 'Perda' || loading}
                      title={lead.status === 'Perda' ? 'Lead já marcado como perda' : 'Marcar perda'}
                    >
                      Marcar perda
                    </Btn>
                  )}
                </>
              )}
              {isGestor(appUser) && (
                <IconBtn icon={<Trash size={15} />} kind="danger" title="Excluir lead" onClick={handleDelete} />
              )}
```

19.16. O "Editar cadastro" embaixo do aviso "Fez 18 anos" (linha 1432). O aviso continua para todos. Trocar:

```jsx
              {!isReadOnly && (
                <button
                  onClick={() => setIsEditing(true)}
```

por:

```jsx
              {canEditCadastro && (
                <button
                  onClick={() => setIsEditing(true)}
```

19.17. A aba Contratos fica só para leitura. Todo botão do `ContractsTab`, do `ContractHeroCard`, do `NextContractStrip` e do `EmptyState`/`ClosedCard` já segue o `isReadOnly`, então esses componentes não mudam. Linhas 1667 a 1669, trocar:

```jsx
            firstName={firstName}
            isReadOnly={isReadOnly}
            loading={loading}
```

por:

```jsx
            firstName={firstName}
            // Contratos ficam só para leitura para quem não mexe em contrato
            // (o professor): todo botão da aba já segue o isReadOnly.
            isReadOnly={isReadOnly || !canContrato}
            loading={loading}
```

19.18. A aba Indicações fica só para leitura. O `onAdd` já vem nulo pelo `canQuickReferral`. Linhas 1686-1687, trocar:

```jsx
              onAdd={canQuickReferral ? () => setQuickReferralOpen(true) : null}
            />
```

por:

```jsx
              onAdd={canQuickReferral ? () => setQuickReferralOpen(true) : null}
              canRefer={canIndicar}
            />
```

Depois das trocas, `grep -n "isAdminUser\|role ===" src/views/LeadProfileView.jsx` não acha nada.

- [ ] **Step 20: O "Consultor responsável" do Editar cadastro (`src/modals/ClientRegistrationModal.jsx`)**

Trocar a linha 5:

```js
import { isClientLead } from '../lib/leads.js';
```

por:

```js
import { isClientLead } from '../lib/leads.js';
import { isSeller } from '../lib/acesso.js';
```

E trocar as linhas 74 a 80:

```js
  // ninguém que possa editá-lo, já que a permissão é o authUid do dono.
  const ownerOptions = useMemo(
    () => (usersList || []).filter(
      (u) => u?.id && u.name && u.authUid && u.active !== false && !u.superAdminOnly
    ),
    [usersList]
  );
```

por:

```js
  // ninguém que possa editá-lo, já que a permissão é o authUid do dono. O
  // professor não é dono de lead (isSeller, em src/lib/acesso.js).
  const ownerOptions = useMemo(
    () => (usersList || []).filter(
      (u) => u?.id && u.name && u.authUid && u.active !== false && !u.superAdminOnly && isSeller(u)
    ),
    [usersList]
  );
```

O `buildClientRegistrationPatch` continua procurando o dono no `usersList` inteiro. O dono atual que não está nas opções continua listado (linha 315), então nada some de um lead antigo.

- [ ] **Step 21: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/profileProfessor.test.js src/lib/__tests__/ownerPickersProfessor.test.js src/lib/__tests__/referralsSection.test.js src/lib/__tests__/profileContractsTab.test.js src/lib/__tests__/profileLinks.test.js src/lib/__tests__/profileTimeline.test.js src/lib/__tests__/profileOriginMarker.test.js src/lib/__tests__/profileZapSchedule.test.js src/lib/__tests__/leadProfileRoute.test.js src/lib/__tests__/contractOutcomeModal.test.js src/lib/__tests__/contractActivateModal.test.js
npx eslint src/views/LeadProfileView.jsx src/components/profile/ReferralsSection.jsx src/modals/ClientRegistrationModal.jsx src/lib/__tests__/profileProfessor.test.js src/lib/__tests__/ownerPickersProfessor.test.js
```

Expected: tudo verde, com `profileProfessor` em `Tests  10 passed (10)` e `ownerPickersProfessor` em `Tests  2 passed (2)`. Os testes de hoje da ficha usam gestor, consultor ou cadastro sem `authUid` e não mudam. O eslint sem erro.

- [ ] **Step 22: Commit da ficha**

```bash
git add src/views/LeadProfileView.jsx src/components/profile/ReferralsSection.jsx src/modals/ClientRegistrationModal.jsx src/lib/__tests__/profileProfessor.test.js src/lib/__tests__/ownerPickersProfessor.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: ficha do professor sem Mudar fase, cadastro, contrato e indicação, e professor fora das escolhas de responsável" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 23: Escrever o teste de Clientes**

Criar `src/lib/__tests__/clientsProfessor.test.js`:

```js
// Clientes com o papel professor (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). A tela não tem botão de criar cadastro nem de exportar, para ninguém:
// o "Cadastrar lead" mora no topo do App, que o esconde pelo LEAD_CRIAR. O que
// muda aqui é o convite para matricular da lista vazia, que é de quem
// matricula, e o filtro de responsável do gestor, que não lista professor. A
// tela é renderizada em node, como em listRowLinks.test.js.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: [], loading: false, hasMore: false, loadMore: () => {} }),
}));

const { ClientsView } = await import('../../views/ClientsView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'clientes' };
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana Duarte', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa Lemos', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };

const render = (appUser, url = '/acad/clientes') => renderToString(
  createElement(MemoryRouter, { initialEntries: [url] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(ClientsView, { appUser, usersList: [GESTOR, CONSULTOR, PROFESSOR], db: {} }))));

describe('Clientes com o papel professor', () => {
  it('lista vazia: o consultor recebe o convite para matricular, o professor não', () => {
    expect(render(CONSULTOR)).toContain('Matricule um lead pelo Kanban');
    const prof = render(PROFESSOR);
    expect(prof).toContain('Nenhum cliente encontrado');
    expect(prof).not.toContain('Matricule um lead');
  });

  it('a tela não tem botão de criar nem de exportar, para ninguém', () => {
    [GESTOR, CONSULTOR, PROFESSOR].forEach((u) => {
      const html = render(u);
      expect(html).not.toContain('Exportar');
      expect(html).not.toContain('Cadastrar lead');
      expect(html).not.toContain('Novo lead');
    });
  });

  it('o filtro de responsável do gestor aceita consultor e ignora professor no endereço', () => {
    // O chip do filtro ativo só aparece quando o id do endereço é aceito.
    expect(render(GESTOR, '/acad/clientes?resp=u2')).toContain('Ana Duarte');
    const comProfessor = render(GESTOR, '/acad/clientes?resp=u3');
    expect(comProfessor).not.toContain('Rafa Lemos');
    expect(comProfessor).not.toContain('Limpar tudo');
  });
});
```

- [ ] **Step 24: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientsProfessor.test.js`

Expected: FAIL, `Tests  2 failed | 1 passed (3)`.
- O professor recebe "Matricule um lead pelo Kanban".
- O endereço `?resp=u3` do gestor é aceito e mostra o chip "Rafa Lemos".
- O caso "não tem botão de criar nem de exportar" passa antes e depois. Ele só registra que a tela nunca teve esses botões, e o `CLIENTES_EXPORTAR` fica sem uso neste PR.

- [ ] **Step 25: Clientes pela lista de permissões (`src/views/ClientsView.jsx`)**

Trocar a linha 3:

```js
import { isClientLead, isAdminUser } from '../lib/leads.js';
```

por:

```js
import { isClientLead } from '../lib/leads.js';
import { ACTIONS, can, isGestor, isSeller } from '../lib/acesso.js';
```

Trocar a linha 89:

```js
  const isAdmin = isAdminUser(appUser);
```

por:

```js
  const isAdmin = isGestor(appUser);
  // Responsável por cliente é quem vende. O professor não é dono de lead
  // (isSeller, em src/lib/acesso.js), então fica fora do filtro e do endereço.
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
```

Trocar as linhas 97 a 99:

```js
  const paramsCtx = useMemo(() => ({
    users: usersList, situacoes: STATUS_OPTIONS, podeResp: isAdmin, respPadrao: [],
  }), [usersList, isAdmin]);
```

por:

```js
  const paramsCtx = useMemo(() => ({
    users: sellers, situacoes: STATUS_OPTIONS, podeResp: isAdmin, respPadrao: [],
  }), [sellers, isAdmin]);
```

Trocar a linha 252:

```jsx
                {isAdmin && (usersList || []).length > 0 && (
```

por:

```jsx
                {isAdmin && sellers.length > 0 && (
```

Trocar as linhas 257-258:

```jsx
                      {(usersList || []).map(u => {
                        const selected = consultantFilters.includes(u.id);
```

por:

```jsx
                      {sellers.map(u => {
                        const selected = consultantFilters.includes(u.id);
```

E trocar a linha 348:

```jsx
              <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Matricule um lead pelo Kanban ou pela ficha para vê-lo aqui.</p>
```

por:

```jsx
              {/* O convite para matricular é de quem matricula. O professor não matricula. */}
              {can(appUser, ACTIONS.CONTRATO_EDITAR) && (
                <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Matricule um lead pelo Kanban ou pela ficha para vê-lo aqui.</p>
              )}
```

O `sellers` fica declarado antes do `paramsCtx`, que o usa. Os chips de filtro ativo (linhas 174-176) continuam procurando o nome no `usersList` inteiro. Isso não faz diferença, porque o `screenParams` já descarta do endereço o `resp` de quem não está em `users`.

- [ ] **Step 26: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/clientsProfessor.test.js src/lib/__tests__/listRowLinks.test.js src/lib/__tests__/screenParams.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js
npx eslint src/views/ClientsView.jsx src/lib/__tests__/clientsProfessor.test.js
```

Expected: tudo verde, com `clientsProfessor` em `Tests  3 passed (3)`; o eslint sem erro.

- [ ] **Step 27: Conferir a área inteira**

```bash
npx vitest run src/lib/__tests__ api/__tests__
grep -rn "isAdminUser\|role === 'admin'" src/views/LeadProfileView.jsx src/views/ClientsView.jsx src/lib/notifications.js src/components/layout/NotificationBell.jsx src/components/layout/GlobalSearch.jsx src/modals/ClientRegistrationModal.jsx
```

Expected: a suíte inteira verde (o `acessoSweep.test.js` ainda não existe: ele nasce na Task 9 e só passa depois dela); o grep sem nenhuma linha.

- [ ] **Step 28: Commit de Clientes**

```bash
git add src/views/ClientsView.jsx src/lib/__tests__/clientsProfessor.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: Clientes do professor sem convite para matricular e sem professor no filtro de responsável" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Varredura dos papéis (`src/lib/__tests__/acessoSweep.test.js`)

**Files:**
- Create: `src/lib/__tests__/acessoSweep.test.js`
- Modify: `src/lib/dailyGoalHistory.js:29-30` (`goalHitKeyToRecord` com `seller`)
- Test: `src/lib/__tests__/dailyGoalHistory.test.js` (bloco no fim)
- Modify: `src/lib/leads.js:249-251` (sai o `isAdminUser`)
- Modify: `src/lib/kanban.js:1, 12-13`
- Modify: `src/views/AppointmentTrackingView.jsx:3, 133, 163-169, 584, 823`
- Modify: `src/views/LeadsView.jsx:3, 30, 54-61, 282, 287`
- Modify: `src/views/KanbanView.jsx:3, 462 (antes do comentário), 469-475, 1292-1299`
- Modify: `src/views/DailyGoalView.jsx:7, 1761`
- Modify: `src/views/DailyGoalTeamView.jsx:1, 5, 57-58`
- Modify: `src/views/dashboard/DashboardOperacionalView.jsx:31, 306`
- Modify: `src/views/dashboard/DashboardCrmView.jsx:21, 42`
- Modify: `src/views/dashboard/DashboardGerencialView.jsx:23-25, 92`
- Modify: `src/views/dashboard/TeamMonthTable.jsx:17, 29, 148`
- Modify: `src/views/dashboard/PeopleConversionTable.jsx:13, 23, 138`
- Modify: `src/views/dashboard/useTeamGoals.js:10, 32, 42, 71`
- Modify: `src/views/settings/ImportClientsSection.jsx:20, 143-148`
- Modify: `src/views/settings/TransferLeadsTab.jsx:6, 84-85, 104`
- Modify: `src/App.jsx`: o import de `leads.js` (linha 54), o import de `acesso.js` deixado pelas Tasks 7 e 8, as 13 chamadas de `isAdminUser(appUser)` que sobraram (a Task 7 já trocou as das linhas 1580 e 1584) e o efeito do dia batido (1431-1443). Os números são de `49a978d` e mudam depois das Tasks 3, 7 e 8, então procure pelo trecho.

**Depende das Tasks 2, 3, 6, 7 e 8.** Esta task só mexe nos arquivos dela. Os outros papéis comparados na mão já saíram nas tasks donas:
- Task 6: `settingsSetup.js`, `OverviewSection.jsx`, `PaceSection.jsx` e `TeamAccessSection.jsx`. O código novo de convite usa `ROLES.PROFESSOR` e `roleOf()`, e nunca `form.role === 'professor'`.
- Task 7: `routes.js` (o import de `isAdminUser`), `WhatsNewModal.jsx`, `PersonaMenu.jsx` e `announcements.js`. A troca de `appUser.role === 'admin'` por `isGestor(appUser)` na linha 132 do `announcements.js` também é da Task 7, junto com o comentário.
- Task 8: `ClientsView.jsx`, `LeadProfileView.jsx`, `ClientRegistrationModal.jsx`, `NotificationBell.jsx` e `notifications.js`.

Se a varredura do Step 4 listar algum desses arquivos, a task dona ficou incompleta: volte a ela. Não edite o arquivo aqui.

O que esta task muda no comportamento:
- o professor sai dos filtros de responsável (Pipeline, Todos os leads, Aulas, Visitas e a exportação delas);
- sai das linhas por pessoa do Operacional e do CRM e da Meta da equipe;
- não é destino nem origem em Migrar leads;
- não é dono no modelo da importação;
- não grava dia batido.

O que ele registra (anotação, agendamento) entra em Outros no volume do Operacional, que é a decisão D4. Para gestor e consultor nada muda.

- [ ] **Step 1: Conferir o ponto de partida**

```bash
grep -n "from './lib/acesso.js'" src/App.jsx
```

Expected: uma linha `import { ... } from './lib/acesso.js';`, deixada pelas Tasks 7 e 8, com `isProfessor`, `can` e `ACTIONS` usados no arquivo. Se houver duas linhas importando de `./lib/acesso.js`, junte as duas no Step 11. Se não houver nenhuma, as Tasks 7 e 8 não foram feitas: pare.

- [ ] **Step 2: Escrever a varredura**

Criar `src/lib/__tests__/acessoSweep.test.js`:

```js
// O papel de quem usa o app é decidido num lugar só, src/lib/acesso.js. Esta
// varredura cobra isso de todo arquivo de src/: comparar o papel do cadastro
// com o texto de um papel ('admin', 'consultant', 'professor' e os nomes em
// português) fora de acesso.js derruba o CI. Com role === 'admin' espalhado
// pelo app, todo mundo que não era gestor virava consultor, e o professor
// herdaria o que é do consultor. Quem precisa do papel usa isGestor,
// isProfessor, isSeller, roleOf com ROLES, can ou canOpenScreen.
//
// Ficam de fora o próprio acesso.js e os testes, que montam cadastros com
// role: 'admin' de propósito. O `role === 'inUse'` dos contratos não é papel
// de pessoa e não entra. A api/ não é varrida: ela compara o papel que chega
// no pedido e o que está gravado, e importa acesso.js onde decide por papel.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const DONO = 'lib/acesso.js';

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// Comentário sai antes da leitura: contar no comentário como era antes não é
// decidir por papel. Mesmo corte do guardianImports.test.js.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ASPAS = "['\"`]";
const PAPEL = ASPAS + '(?:admin|consultant|professor|consultor|gestor)' + ASPAS;
const COMPARA = '[!=]==?';
const POR_PAPEL = new RegExp(
  `\\brole\\b\\s*${COMPARA}\\s*${PAPEL}|${PAPEL}\\s*${COMPARA}\\s*[\\w$?.]*\\brole\\b`,
);

const relPosix = (file) => relative(SRC, file).split(sep).join('/');
const arquivos = sourceFiles(SRC).filter((file) => relPosix(file) !== DONO);
const codigo = (file) => stripComments(readFileSync(file, 'utf8'));

// Listas de pessoas que viram filtro de responsável, escolha de dono, painel
// por pessoa ou Meta da equipe. Cada uma passa pelo isSeller: o professor não
// é dono de lead e não vende. Busca de nome (o chip do filtro, o autor da
// linha do tempo) continua com o usersList inteiro. As listas de Clientes, da
// ficha, do cadastro do cliente e de Metas & ritmo também passam pelo
// isSeller. Tela nova com lista de pessoas entra aqui.
const LISTAS_DE_QUEM_VENDE = [
  'views/KanbanView.jsx',
  'views/LeadsView.jsx',
  'views/AppointmentTrackingView.jsx',
  'views/DailyGoalTeamView.jsx',
  'views/dashboard/DashboardOperacionalView.jsx',
  'views/dashboard/DashboardCrmView.jsx',
  'views/dashboard/useTeamGoals.js',
  'views/settings/TransferLeadsTab.jsx',
  'views/settings/ImportClientsSection.jsx',
  // Já passam pelo isSeller desde as Tasks 6 e 8.
  'views/ClientsView.jsx',
  'views/LeadProfileView.jsx',
  'modals/ClientRegistrationModal.jsx',
  'views/settings/PaceSection.jsx',
];

describe('o papel se decide em src/lib/acesso.js', () => {
  it('nenhum arquivo de src/ compara o papel com o texto de um papel', () => {
    expect(arquivos.filter((file) => POR_PAPEL.test(codigo(file))).map(relPosix).sort()).toEqual([]);
  });

  it('isAdminUser saiu: quem quer saber se é gestor usa isGestor', () => {
    expect(arquivos.filter((file) => /\bisAdminUser\b/.test(codigo(file))).map(relPosix).sort()).toEqual([]);
  });

  it('as listas de quem vende passam pelo isSeller', () => {
    const lidos = new Map(arquivos.map((file) => [relPosix(file), file]));
    const semFiltro = LISTAS_DE_QUEM_VENDE.filter((rel) => !lidos.has(rel) || !/\bisSeller\b/.test(codigo(lidos.get(rel))));
    expect(semFiltro).toEqual([]);
  });

  it('a varredura não está cega: o leitor pega as formas de comparar', () => {
    for (const linha of [
      "const isAdmin = appUser?.role === 'admin';",
      "users.filter(u => u.role !== 'admin')",
      'if (user.role == "consultant") return;',
      "if (role != 'professor') return;",
      "'admin' === appUser?.role",
      'u.role === `admin`',
    ]) expect(POR_PAPEL.test(linha), linha).toBe(true);
  });

  it('e não pega o que não é papel de pessoa', () => {
    for (const linha of [
      "const inUse = role === 'inUse';",
      "a.audience === 'gestor'",
      'roleOf(u) === ROLES.GESTOR',
      'form.role === ROLES.PROFESSOR',
      "const gestor = { id: 'u1', role: 'admin' };",
      'body: JSON.stringify({ email, role: inviteRole, allowExtra })',
      "teamRole(actor) === 'gestor'",
    ]) expect(POR_PAPEL.test(linha), linha).toBe(false);
  });

  it('a varredura lê o app de verdade e o dono existe', () => {
    const lidos = arquivos.map(relPosix);
    expect(lidos).toContain('App.jsx');
    expect(lidos).toContain('views/settings/TeamAccessSection.jsx');
    expect(lidos).toContain('lib/notifications.js');
    expect(lidos).not.toContain(DONO);
    expect(readFileSync(join(SRC, DONO), 'utf8')).toContain('export function roleOf');
  });
});
```

- [ ] **Step 3: Escrever o teste do dia batido**

No fim de `src/lib/__tests__/dailyGoalHistory.test.js`, acrescentar:

```js

describe('goalHitKeyToRecord: só quem vende grava o dia batido', () => {
  const base = { userId: 'rafa', dayKey: '2026-10-02', ready: true, total: 5, pending: 0, recordedKey: null };

  it('quem não vende (o professor) não grava, mesmo com as tarefas zeradas', () => {
    expect(goalHitKeyToRecord({ ...base, seller: false })).toBeNull();
  });

  it('quem vende grava como sempre, e sem o campo vale quem vende', () => {
    expect(goalHitKeyToRecord({ ...base, seller: true })).toBe('rafa_2026-10-02');
    expect(goalHitKeyToRecord(base)).toBe('rafa_2026-10-02');
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/dailyGoalHistory.test.js`
Expected: FAIL, `Tests  4 failed | 11 passed (15)`:
- "nenhum arquivo de src/ compara o papel..." lista `lib/leads.js`, `views/dashboard/DashboardGerencialView.jsx`, `views/dashboard/PeopleConversionTable.jsx` e `views/dashboard/TeamMonthTable.jsx`;
- "isAdminUser saiu..." lista `App.jsx`, `lib/kanban.js`, `lib/leads.js`, `views/AppointmentTrackingView.jsx`, `views/DailyGoalView.jsx`, `views/LeadsView.jsx` e `views/dashboard/useTeamGoals.js`;
- "as listas de quem vende passam pelo isSeller" lista os 9 arquivos de `LISTAS_DE_QUEM_VENDE`;
- "quem não vende (o professor) não grava..." recebe `'rafa_2026-10-02'` no lugar de `null`.

Os dois autotestes do leitor e o "dono existe" já passam. Se as duas primeiras listas trouxerem outro arquivo, a task dona dele ficou incompleta (veja o bloco "Depende", acima).

- [ ] **Step 5: O dia batido só para quem vende (`src/lib/dailyGoalHistory.js`)**

Trocar as linhas 29 e 30:

```js
export function goalHitKeyToRecord({ userId, dayKey, ready, total, pending, recordedKey }) {
  if (!userId || !ready) return null;
```

por:

```js
// `seller` diz se a pessoa vende (isSeller, em acesso.js). Quem não vende (o
// professor) não tem a Meta do consultor e nunca grava dia batido. Sem o
// campo, vale quem vende, como sempre foi.
export function goalHitKeyToRecord({ userId, dayKey, ready, total, pending, recordedKey, seller = true }) {
  if (!userId || !ready || !seller) return null;
```

O arquivo continua sem importar `acesso.js`. Quem chama (o `App.jsx`, no Step 11) passa o `isSeller(appUser)`.

- [ ] **Step 6: Sai o `isAdminUser` (`src/lib/leads.js` e `src/lib/kanban.js`)**

Em `src/lib/leads.js`, trocar as linhas 249 a 251:

```js
// --- Permissions ---

export const isAdminUser = (user) => user?.role === 'admin';
```

por:

```js
// --- Permissions ---
// O papel de quem usa o app (gestor, consultor, professor) se decide em
// src/lib/acesso.js: isGestor, isSeller, can.
```

O `leads.js` não ganha import. A `api/` importa esse arquivo (`_zapLead.js`, `_zapCard.js`, `_zapStrip.js` e `_zapSchedule.js`), e nenhum arquivo de `api/`, `scripts/` ou de teste usa o `isAdminUser`.

Em `src/lib/kanban.js`, trocar a linha 1:

```js
import { isAdminUser, isClientLead } from './leads.js';
```

por:

```js
import { isClientLead } from './leads.js';
import { isGestor } from './acesso.js';
```

E as linhas 12 e 13:

```js
export const defaultRespFilterFor = (user) =>
  (!user || isAdminUser(user) || !user.id) ? [] : [user.id];
```

por:

```js
export const defaultRespFilterFor = (user) =>
  (!user || isGestor(user) || !user.id) ? [] : [user.id];
```

- [ ] **Step 7: Filtro de responsável com quem vende (Pipeline, Todos os leads, Aulas e Visitas)**

Em `src/views/KanbanView.jsx`, depois da linha 3 (`import { canEditLead, normalizeLeadDoc } from '../lib/leads.js';`), acrescentar:

```js
import { isSeller } from '../lib/acesso.js';
```

Logo antes da linha 462 (o comentário "// Funil, responsáveis e atraso vêm do endereço: F5 mantém, o link abre igual"), inserir:

```js
  // Responsável é quem vende: o professor não é dono de lead e fica fora do
  // filtro e do endereço (isSeller, em src/lib/acesso.js).
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
```

Trocar as linhas 469 a 475:

```js
  const paramsCtx = useMemo(() => ({
    users: usersList,
    funis: funnels,
    funilPadrao: savedFunnelId,
    podeResp: true,
    respPadrao: defaultRespFilterFor(appUser),
  }), [usersList, funnels, savedFunnelId, appUser]);
```

por:

```js
  const paramsCtx = useMemo(() => ({
    users: sellers,
    funis: funnels,
    funilPadrao: savedFunnelId,
    podeResp: true,
    respPadrao: defaultRespFilterFor(appUser),
  }), [sellers, funnels, savedFunnelId, appUser]);
```

E as linhas 1292 a 1299:

```js
  const respOptions = useMemo(() => {
    const list = (usersList || []).filter(u => u?.id);
    return [...list].sort((a, b) => {
      if (a.id === appUser?.id) return -1;
      if (b.id === appUser?.id) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }, [usersList, appUser]);
```

por:

```js
  const respOptions = useMemo(() => {
    const list = sellers.filter(u => u?.id);
    return [...list].sort((a, b) => {
      if (a.id === appUser?.id) return -1;
      if (b.id === appUser?.id) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }, [sellers, appUser]);
```

O nome no chip do filtro (linha 1280) continua lendo o `usersList` inteiro, porque é busca de nome.

Em `src/views/LeadsView.jsx`, trocar a linha 3:

```js
import { isAdminUser, normalizeLeadDoc } from '../lib/leads.js';
```

por:

```js
import { normalizeLeadDoc } from '../lib/leads.js';
import { isGestor, isSeller } from '../lib/acesso.js';
```

Trocar a linha 30:

```js
  const isAdmin = isAdminUser(appUser);
```

por:

```js
  const isAdmin = isGestor(appUser);
  // Responsável é quem vende: o professor não é dono de lead e fica fora do
  // filtro e do endereço (isSeller, em src/lib/acesso.js).
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
```

Nas linhas 54 a 61, trocar `    users: usersList,` por `    users: sellers,` e a última linha:

```js
  }), [usersList, funnels, savedFunnelId, isAdmin, statuses, defaultFunnelId]);
```

por:

```js
  }), [sellers, funnels, savedFunnelId, isAdmin, statuses, defaultFunnelId]);
```

Trocar a linha 282:

```jsx
                {isAdmin && (usersList || []).length > 0 && (
```

por:

```jsx
                {isAdmin && sellers.length > 0 && (
```

E a linha 287:

```jsx
                      {(usersList || []).map(u => {
```

por:

```jsx
                      {sellers.map(u => {
```

Em `src/views/AppointmentTrackingView.jsx`, trocar a linha 3:

```js
import { DAILY_GOAL_CATEGORIES, getAppointmentOutcomeMeta, getLeadAppointmentDate, getLeadAppointmentType, isAdminUser, isLeadConverted } from '../lib/leads.js';
```

por:

```js
import { DAILY_GOAL_CATEGORIES, getAppointmentOutcomeMeta, getLeadAppointmentDate, getLeadAppointmentType, isLeadConverted } from '../lib/leads.js';
import { isGestor, isSeller } from '../lib/acesso.js';
```

Trocar a linha 133:

```js
  const isAdmin = isAdminUser(appUser);
```

por:

```js
  const isAdmin = isGestor(appUser);
  // Responsável é quem vende: o professor não é dono de lead e fica fora do
  // filtro, do endereço e da exportação (isSeller, em src/lib/acesso.js).
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
```

Trocar as linhas 163 a 169:

```js
  const paramsCtx = useMemo(() => ({
    users: usersList,
    podeResp: isAdmin,
    respPadrao: [],
    professores,
    temAndamento: isAula,
  }), [usersList, isAdmin, professores, isAula]);
```

por:

```js
  const paramsCtx = useMemo(() => ({
    users: sellers,
    podeResp: isAdmin,
    respPadrao: [],
    professores,
    temAndamento: isAula,
  }), [sellers, isAdmin, professores, isAula]);
```

Trocar a linha 584:

```jsx
                    {(usersList || []).map(u => {
```

por:

```jsx
                    {sellers.map(u => {
```

E a linha 823, que é a lista de responsáveis do `AppointmentExportModal`:

```jsx
          usersList={usersList}
```

por:

```jsx
          usersList={sellers}
```

O nome no resumo do filtro (linha 365) continua com o `usersList` inteiro. Os três arquivos já importam `useMemo`.

- [ ] **Step 8: Meta diária e Meta da equipe**

Em `src/views/DailyGoalView.jsx`, trocar a linha 7:

```js
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL, APPOINTMENT_OUTCOMES, getAppointmentOutcomeMeta, getLeadAppointmentType, getLeadAppointmentDate, hasGoalDoneToday, isAdminUser, isClientLead, outcomeAppliesToAula } from '../lib/leads.js';
```

por:

```js
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL, APPOINTMENT_OUTCOMES, getAppointmentOutcomeMeta, getLeadAppointmentType, getLeadAppointmentDate, hasGoalDoneToday, isClientLead, outcomeAppliesToAula } from '../lib/leads.js';
import { isGestor } from '../lib/acesso.js';
```

E a linha 1761:

```js
  const isManager = isAdminUser(appUser);
```

por:

```js
  const isManager = isGestor(appUser);
```

O `usersById` (linhas 1069 a 1077) continua com o `usersList` inteiro, porque é busca de nome.

Em `src/views/DailyGoalTeamView.jsx`, trocar a linha 1:

```js
import { useEffect, useState } from 'react';
```

por:

```js
import { useEffect, useMemo, useState } from 'react';
```

Depois da linha 5 (`import { DEFAULT_SLA_OVERDUE_DAYS } from '../lib/dailyGoal.js';`), acrescentar:

```js
import { isSeller } from '../lib/acesso.js';
```

E trocar as linhas 57 e 58:

```js
  const board = useTeamBoard({
    leads, interactions, usersList, teamHistory,
```

por:

```js
  // A Meta da equipe é de quem vende. O professor não tem a Meta do consultor
  // e fica fora das linhas e da conta de quem está em dia.
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
  const board = useTeamBoard({
    leads, interactions, usersList: sellers, teamHistory,
```

O `useTeamBoard` usa o `usersList` nas linhas (`useTeamBoard.js:80`) e na conta de quem está em dia (`useTeamBoard.js:167`). Um filtro aqui cobre os dois.

- [ ] **Step 9: Painéis por pessoa e rótulos do papel**

Em `src/views/dashboard/DashboardOperacionalView.jsx`, depois da linha 31 (`import { useScreenParams } from '../../hooks/useScreenParams.js';`), acrescentar:

```js
import { isSeller } from '../../lib/acesso.js';
```

E trocar a linha 306:

```js
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
```

por:

```js
  // As linhas por pessoa, o seletor de pessoa e o endereço são de quem vende.
  // O que o professor registra (anotação, agendamento) cai em Outros.
  const users = useMemo(() => (usersList || []).filter((u) => u?.id && isSeller(u)), [usersList]);
```

Em `src/views/dashboard/DashboardCrmView.jsx`, depois da linha 21 (`import { useScreenParams } from '../../hooks/useScreenParams.js';`), acrescentar:

```js
import { isSeller } from '../../lib/acesso.js';
```

E trocar a linha 42:

```js
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
```

por:

```js
  // A conversão por pessoa e o seletor de pessoa são de quem vende: o
  // professor não é dono de lead.
  const users = useMemo(() => (usersList || []).filter((u) => u?.id && isSeller(u)), [usersList]);
```

Em `src/views/dashboard/DashboardGerencialView.jsx`, trocar as linhas 23 a 25:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';

const roleOf = (user) => (user?.role === 'admin' ? 'Gestor · também vende' : 'Consultor');
```

por:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { isGestor, roleLabel } from '../../lib/acesso.js';

// Rótulo de quem vendeu, na tabela de vendedores. Quem vende sai dos
// contratos, não da equipe, então quem já saiu da equipe aparece como
// Consultor.
const sellerRoleText = (user) => (isGestor(user) ? 'Gestor · também vende' : roleLabel(user));
```

E a linha 92:

```js
    () => dashboardProps({ cur, cmp, comparing, roleOf: (id) => roleOf(userById.get(id)) }),
```

por:

```js
    () => dashboardProps({ cur, cmp, comparing, roleOf: (id) => sellerRoleText(userById.get(id)) }),
```

O `users` do Gerencial (linha 89) continua sem filtro: ele serve só para achar o nome, e quem vende vem dos contratos (`gerencial/people.js`). O nome local muda porque `roleOf` agora é o do contrato e devolve a chave, não o rótulo.

Em `src/views/dashboard/TeamMonthTable.jsx`, depois da linha 17 (`import { dashInitials } from './dashTokens.js';`), acrescentar:

```js
import { roleLabel } from '../../lib/acesso.js';
```

Apagar a linha 29:

```js
const roleOf = (user) => (user.role === 'admin' ? 'Gestor' : 'Consultor');
```

E trocar a linha 148:

```jsx
                <NameCell name={user.name || 'Sem nome'} sub={roleOf(user)} />
```

por:

```jsx
                <NameCell name={user.name || 'Sem nome'} sub={roleLabel(user)} />
```

Em `src/views/dashboard/PeopleConversionTable.jsx`, depois da linha 13 (`import { CrmCard, ReadText } from './CrmParts.jsx';`), acrescentar:

```js
import { roleLabel } from '../../lib/acesso.js';
```

Apagar a linha 23:

```js
const roleOf = (user) => (user.role === 'admin' ? 'Gestor' : 'Consultor');
```

E trocar a linha 138:

```jsx
                  <Who name={name} sub={roleOf(user)} />
```

por:

```jsx
                  <Who name={name} sub={roleLabel(user)} />
```

Em `src/views/dashboard/useTeamGoals.js`, que hoje ninguém importa, trocar a linha 10:

```js
import { isAdminUser } from '../../lib/leads.js';
```

por:

```js
import { isGestor, isSeller } from '../../lib/acesso.js';
```

Na linha 32, trocar `    if (!isAdminUser(appUser)) return undefined;` por:

```js
    if (!isGestor(appUser)) return undefined;
```

Na linha 42, trocar `    if (!isAdminUser(appUser)) return {};` por:

```js
    if (!isGestor(appUser)) return {};
```

E a linha 71:

```js
    (usersList || []).forEach((u) => {
```

por:

```js
    (usersList || []).filter(isSeller).forEach((u) => {
```

- [ ] **Step 10: Migrar leads e Importar clientes**

Em `src/views/settings/TransferLeadsTab.jsx`, depois da linha 6 (`import { isClientLead } from '../../lib/leads.js';`), acrescentar:

```js
import { isSeller } from '../../lib/acesso.js';
```

Trocar as linhas 84 e 85:

```js
  const fromOptions = [...(usersList || []), ...orphans];
  const toOptions = (usersList || []).filter(u => u.id !== fromUser);
```

por:

```js
  // Carteira é de quem vende: o professor não passa nem recebe leads. Ele
  // continua no activeIds acima, então nunca aparece como "(excluído)".
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
  const fromOptions = [...sellers, ...orphans];
  const toOptions = sellers.filter(u => u.id !== fromUser);
```

E a linha 104:

```js
  const toObj = (usersList || []).find(u => u.id === toUser) || null;
```

por:

```js
  const toObj = sellers.find(u => u.id === toUser) || null;
```

Em `src/views/settings/ImportClientsSection.jsx`, depois da linha 20 (`import { deriveLeadState, getTone } from '../../lib/leadState.js';`), acrescentar:

```js
import { isSeller } from '../../lib/acesso.js';
```

E trocar as linhas 143 a 148:

```js
  // Quem pode ser dono do lead importado: gente ATIVA da equipe e com login
  // vinculado (mesmo filtro do cadastro de cliente). Dono sem authUid não
  // consegue editar o próprio lead, e quem saiu deixaria o lead órfão.
  const consultants = useMemo(
    () => (usersList || []).filter((u) => u?.id && u.name && u.authUid && u.active !== false && !u.superAdminOnly),
    [usersList]
```

por:

```js
  // Quem pode ser dono do lead importado: gente ATIVA da equipe, com login
  // vinculado e que vende (mesmo filtro do cadastro de cliente). Dono sem
  // authUid não consegue editar o próprio lead, quem saiu deixaria o lead
  // órfão e o professor não é dono de lead.
  const consultants = useMemo(
    () => (usersList || []).filter((u) => u?.id && u.name && u.authUid && u.active !== false && !u.superAdminOnly && isSeller(u)),
    [usersList]
```

A mesma lista alimenta a equipe do modelo de planilha (`buildTemplateSpec`) e o casamento do nome do consultor (`enrichCandidate`), então o professor sai dos dois.

- [ ] **Step 11: O `App.jsx`**

Trocar a linha 54:

```js
import { isAdminUser, normalizeLeadDoc } from './lib/leads.js';
```

por:

```js
import { normalizeLeadDoc } from './lib/leads.js';
```

Trocar a linha do import de `./lib/acesso.js` que as Tasks 7 e 8 deixaram (se forem duas, as duas) por uma linha só:

```js
import { ACTIONS, can, isGestor, isProfessor, isSeller } from './lib/acesso.js';
```

Troque cada `isAdminUser(appUser)` do arquivo por `isGestor(appUser)`:

```bash
sed -i '' 's/isAdminUser(appUser)/isGestor(appUser)/g' src/App.jsx
grep -c "isAdminUser" src/App.jsx
```

Expected: `0`. São 13 trocas, todas de gestor e sem mudança de sentido, nas linhas de `49a978d` (as das linhas 1580 e 1584, do bloco Administração, já foram feitas pela Task 7):
- 844: assinatura ao vivo da equipe;
- 913, 1045, 1102, 1159 e 1207: as cinco configurações do primeiro login, que continuam só do gestor e nunca viram `!isSeller`;
- 1456: escopo do "a vencer";
- 1496: `TrialActivationScreen`;
- 1695: `isAdmin` do `PersonaMenu`;
- 1711: `PaymentDueBanner`;
- 1787, 1788 e 1789: as telas de Configurações, Perfil e Plano.

No efeito do dia batido, trocar as linhas 1431 a 1433:

```js
  // A decisão (qual chave gravar, ou se grava) é a função pura
  // goalHitKeyToRecord em lib/dailyGoalHistory.js, testada isoladamente.
  const goalHitRecordedRef = useRef(null);
```

por:

```js
  // A decisão (qual chave gravar, ou se grava) é a função pura
  // goalHitKeyToRecord em lib/dailyGoalHistory.js, testada isoladamente. Só
  // quem vende grava: o professor não tem a Meta do consultor (seller).
  const goalHitRecordedRef = useRef(null);
```

E as linhas 1442 e 1443:

```js
      pending: dailyGoalPending,
      recordedKey: goalHitRecordedRef.current
    });
```

por:

```js
      pending: dailyGoalPending,
      recordedKey: goalHitRecordedRef.current,
      seller: isSeller(appUser)
    });
```

O `appUser` já está nas dependências do efeito, então o `react-hooks/exhaustive-deps` continua satisfeito.

Run: `npx eslint src/App.jsx`
Expected: nenhuma saída. Se o lint acusar um nome da linha de `./lib/acesso.js` como sem uso, tire só esse nome. Não deve acontecer: a Task 7 usa os cinco nomes (`can` e `ACTIONS` no `ticketsOn`, `isGestor` no bloco Administração, `isProfessor` na Meta diária e `isSeller` nas consultas e no selo), e esta task usa `isGestor` e `isSeller` de novo.

- [ ] **Step 12: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/dailyGoalHistory.test.js`
Expected: PASS, `Tests  15 passed (15)`.

Run: `npx vitest run src/lib/__tests__/kanban.test.js src/lib/__tests__/crm.components.test.js src/lib/__tests__/listRowLinks.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/gerencial.dashboard.test.js src/lib/__tests__/crm.dashboard.test.js src/lib/__tests__/screenParams.test.js src/lib/__tests__/acesso.test.js src/lib/__tests__/acessoImports.test.js src/lib/__tests__/newLeadImports.test.js src/lib/__tests__/guardianImports.test.js`
Expected: PASS. O `defaultRespFilterFor` do `kanban.test.js` dá o mesmo resultado. A tabela de pessoas do CRM continua mostrando "Gestor" (`crm.components.test.js`). As varreduras de import continuam verdes, porque `kanban.js` agora chega a `acesso.js`, que não importa nada.

- [ ] **Step 13: Suíte inteira e lint**

Run: `npm test`
Expected: todos os arquivos verdes.

Run: `npm run lint`
Expected: nenhum erro. O aviso de `react-hooks/exhaustive-deps` em `src/views/superadmin/SuperAdminView.jsx:113` já existia em `49a978d`.

- [ ] **Step 14: Commit**

```bash
git add src/lib/__tests__/acessoSweep.test.js src/lib/dailyGoalHistory.js src/lib/__tests__/dailyGoalHistory.test.js src/lib/leads.js src/lib/kanban.js src/views/AppointmentTrackingView.jsx src/views/LeadsView.jsx src/views/KanbanView.jsx src/views/DailyGoalView.jsx src/views/DailyGoalTeamView.jsx src/views/dashboard/DashboardOperacionalView.jsx src/views/dashboard/DashboardCrmView.jsx src/views/dashboard/DashboardGerencialView.jsx src/views/dashboard/TeamMonthTable.jsx src/views/dashboard/PeopleConversionTable.jsx src/views/dashboard/useTeamGoals.js src/views/settings/ImportClientsSection.jsx src/views/settings/TransferLeadsTab.jsx src/App.jsx
git -c user.name="Johnny Bittencourt" commit -m "feat: papel decidido em acesso.js e listas de pessoas só com quem vende" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Ponte do Stronizap (`api/_zapLead.js`, `api/_zapSchedule.js`, `api/zap.js`)

A ponte grava pelo Admin SDK, e o Admin SDK passa por cima do `firestore.rules`. Por isso as travas do professor (D3) são repetidas aqui:

- O professor não abre o `lead-options` nem grava o `create-lead`. Recebe 403 `fora_da_equipe` com um texto próprio.
- Ele não aparece na equipe que o gestor vê no cadastro e não pode ser escolhido como dono.
- Ele agenda (`schedule-options` e `schedule`) com `countsForMeta: false`.

A Task também leva o D1 para a ponte: com o módulo `faltosos` desligado, o professor também não agenda pelo Stronizap. É a mesma recusa que as regras fazem na Task 11.

O Stronizap não precisa de deploy. O `lerRecusa` de `backend/src/services/crm.service.ts` (origin/main `7c81bbd`) mostra qualquer recusa que tenha `error` e `message` exatamente como chegou, e `fora_da_equipe` já é um código que ele conhece.

**Depende da Task 1** (`src/lib/modules.js`) **e da Task 2** (`src/lib/acesso.js`, sem import nenhum). Se o `acesso.js` ganhar um import, o `src/lib/__tests__/newLeadImports.test.js` reprova o `api/_zapLead.js` e o `api/_zapSchedule.js`.

**Files:**
- Create: `api/__tests__/zapProfessor.test.js`
- Test: `api/__tests__/zapRoute.test.js` (um bloco novo no fim, depois da linha 2850)
- Modify: `api/_zapLead.js:17` (import), `:37` (mensagem nova), `:135-136` (`teamRole` e o `signupRefusal` novo), `:164-166` e `:185` (equipe do gestor), `:304-305` e `:311` (dono do lead)
- Modify: `api/_zapSchedule.js:34` (imports), `:80` (mensagem nova), `:150-156` (`countsForMeta` e o `scheduleRefusal` novo)
- Modify: `api/zap.js:30` e `:35` (imports), `:360-362` e `:383` (`openByKey`), `:418-419` (`handleLeadOptions`), `:444-445` (`handleCreateLead`), `:542` e `:552-553` (`handleScheduleOptions`), `:572` e `:582-583` (`handleSchedule`)

- [ ] **Step 1: Escrever os testes das regras puras**

Criar `api/__tests__/zapProfessor.test.js`:

```js
import { describe, it, expect, vi, afterAll } from 'vitest';

// O professor na ponte com o Stronizap (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md). Ele fala
// com os alunos pelo canal dos professores do Stronizap, com o mesmo e-mail do
// Stronilead. A ponte grava pelo Admin SDK, que passa por cima do
// firestore.rules, então as travas do professor moram aqui também: ele não
// cadastra lead, não vira dono, não aparece na equipe do cadastro e não conta
// na Meta. Agenda, como no Agendar da ficha, e só com o módulo ligado. O papel
// que vai para o Stronizap continua 'consultor', porque o Stronizap só conhece
// gestor e consultor.
//
// Como nos outros testes da ponte, o processo vai para UTC antes de importar
// as regras: a função da Vercel roda em UTC.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { ZAP_LEAD_MESSAGES, refusal, teamRole, buildLeadOptions, resolveOwner, signupRefusal } from '../_zapLead.js';
import { ZAP_SCHEDULE_MESSAGES, countsForMeta, buildScheduleOptions, scheduleRefusal } from '../_zapSchedule.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Equipe como mora em stronix_users. O cadastro do professor nasce pelo
// servidor, com o id igual ao uid da conta.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };
const CAIO = {
  id: 'auth-caio', name: 'Caio Prof', email: 'caio@stronix.com.br', authUid: 'auth-caio', role: 'professor', professorId: 'p1'
};
const EQUIPE = [JOHNNY, CAIO, ANA];

// Terça, 29/09/2026, às 15:40 de Brasília.
const AGORA = new Date('2026-09-29T18:40:00.000Z');
const SEG_A_SEX = [1, 2, 3, 4, 5];
const COM_MODULO = { modules: ['faltosos'] };
const SEM_MODULO = { modules: [] };
const PROFESSOR_DESLIGADO = 'O acesso de professor está desligado nesta academia. Fale com o gestor.';

describe('o papel que vai para o Stronizap', () => {
  it('o professor responde consultor, e o gestor continua gestor', () => {
    expect(teamRole(CAIO)).toBe('consultor');
    expect(teamRole(ANA)).toBe('consultor');
    expect(teamRole(JOHNNY)).toBe('gestor');
  });
});

describe('signupRefusal: quem cadastra lead pelo Stronizap', () => {
  it('consultora e gestor cadastram', () => {
    expect(signupRefusal(ANA, ANA.email)).toBeNull();
    expect(signupRefusal(JOHNNY, JOHNNY.email)).toBeNull();
  });

  it('o professor recebe a recusa com o texto pronto para a tela', () => {
    expect(signupRefusal(CAIO, CAIO.email)).toEqual(refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.professorNoLead));
    expect(ZAP_LEAD_MESSAGES.professorNoLead)
      .toBe('Seu acesso de professor no Stronilead não cadastra lead. Peça a um consultor ou ao gestor.');
  });

  it('quem não está na equipe continua com o aviso do e-mail', () => {
    expect(signupRefusal(null, 'carla@stronix.com.br'))
      .toEqual(refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam('carla@stronix.com.br')));
  });
});

describe('o professor fora da equipe do cadastro', () => {
  it('não aparece na lista de consultor responsável que o gestor vê', () => {
    const opcoes = buildLeadOptions({ actor: JOHNNY, team: EQUIPE, catalogs: {} });
    expect(opcoes.team).toEqual([{ id: 'u-ana', name: 'Ana Souza' }, { id: 'u-johnny', name: 'Johnny' }]);
  });

  it('não pode ser escolhido como dono do lead', () => {
    expect(resolveOwner({ actor: JOHNNY, ownerId: CAIO.id, team: EQUIPE }))
      .toEqual({ refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.ownerGone) });
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-ana', team: EQUIPE })).toEqual({ owner: ANA });
  });
});

describe('o professor no agendamento', () => {
  it('agendar não conta na Meta do professor nem na do gestor', () => {
    expect(countsForMeta({ member: CAIO, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(false);
    expect(countsForMeta({ member: JOHNNY, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(false);
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(true);
  });

  it('as opções do balão saem com o papel consultor e fora da Meta', () => {
    const opcoes = buildScheduleOptions({ member: CAIO, catalogs: {}, now: AGORA });
    expect(opcoes.actor).toEqual({ id: CAIO.id, name: 'Caio Prof', role: 'consultor', countsForMeta: false });
  });

  it('com o módulo ligado, o professor agenda', () => {
    expect(scheduleRefusal(CAIO, CAIO.email, COM_MODULO)).toBeNull();
  });

  it('com o módulo desligado, ou sem a lista na academia, a recusa diz que o acesso está desligado', () => {
    for (const tenant of [SEM_MODULO, {}, { modules: 'faltosos' }, null]) {
      expect(scheduleRefusal(CAIO, CAIO.email, tenant), JSON.stringify(tenant))
        .toEqual(refusal(403, 'fora_da_equipe', PROFESSOR_DESLIGADO));
    }
    expect(ZAP_SCHEDULE_MESSAGES.professorOff).toBe(PROFESSOR_DESLIGADO);
  });

  it('consultora e gestor agendam com ou sem o módulo', () => {
    for (const tenant of [COM_MODULO, SEM_MODULO, null]) {
      expect(scheduleRefusal(ANA, ANA.email, tenant)).toBeNull();
      expect(scheduleRefusal(JOHNNY, JOHNNY.email, tenant)).toBeNull();
    }
  });

  it('quem não está na equipe recebe o aviso do e-mail', () => {
    expect(scheduleRefusal(null, 'carla@stronix.com.br', COM_MODULO))
      .toEqual(refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam('carla@stronix.com.br')));
  });
});

describe('textos novos da ponte', () => {
  it('nenhum tem travessão', () => {
    for (const texto of [ZAP_LEAD_MESSAGES.professorNoLead, ZAP_SCHEDULE_MESSAGES.professorOff]) {
      expect(typeof texto).toBe('string');
      expect(texto).not.toContain('—');
    }
  });
});
```

- [ ] **Step 2: Escrever os testes da rota**

Acrescentar no fim de `api/__tests__/zapRoute.test.js`, depois da última linha (2850, o `});` do bloco `appointment-status`). O bloco usa o que o arquivo já define: `AGORA`, `zerarBanco`, `academiaComEquipe`, `marianaLead`, `pedidoOpcoes`, `pedidoCadastro`, `pedidoOpcoesAgenda`, `pedidoAgenda`, `resposta`, `leadsDaAcademia`, `interacoesDaAcademia`, `aulasDaAcademia` e `leadDaAcademia`.

```js

// ---------------------------------------------------------------------------
// O professor na ponte (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md)
// ---------------------------------------------------------------------------

// Caio, professor de pilates (p1 do cadastro de professores), com login e o
// mesmo e-mail no Stronizap, onde usa o canal dos professores. O cadastro do
// professor nasce pelo servidor, com o id igual ao uid da conta.
const CAIO = {
  id: 'auth-caio', name: 'Caio Prof', email: 'caio@stronix.com.br', authUid: 'auth-caio', role: 'professor', professorId: 'p1'
};
const PROFESSOR_NAO_CADASTRA = 'Seu acesso de professor no Stronilead não cadastra lead. Peça a um consultor ou ao gestor.';
const PROFESSOR_DESLIGADO = 'O acesso de professor está desligado nesta academia. Fale com o gestor.';

describe('POST /api/zap: o professor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    academiaComEquipe();
    banco.users[TENANT].push(CAIO);
    banco.tenants[TENANT].modules = ['faltosos'];
    banco.leads[TENANT] = [marianaLead()];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não abre o cadastro de lead', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(CAIO.email), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_NAO_CADASTRA });
  });

  it('não cadastra lead, nem com o pedido montado à mão', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: CAIO.email, name: 'Caio' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_NAO_CADASTRA });
    expect(leadsDaAcademia().map((l) => l.id)).toEqual(['L1']);
    expect(banco.gravacoes).toEqual([]);
  });

  it('não aparece na equipe que o gestor vê no cadastro', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(JOHNNY.email), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.team.map((u) => u.id)).toEqual(['u-ana', 'u-bruno', 'u-johnny']);
  });

  it('não vira dono do lead que o gestor cadastra', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: JOHNNY.email }, lead: { ownerId: CAIO.id } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'responsavel_invalido', message: 'Essa pessoa não está mais na equipe do Stronilead.' });
    expect(leadsDaAcademia().map((l) => l.id)).toEqual(['L1']);
  });

  it('abre o balão do agendamento como consultor e fora da Meta', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ email: CAIO.email }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.actor).toEqual({ id: CAIO.id, name: 'Caio Prof', role: 'consultor', countsForMeta: false });
  });

  it('agenda no nome dele, e o lead continua com a dona', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ actor: { email: CAIO.email, name: 'Caio' } }), res);

    expect(res.statusCode).toBe(201);
    expect(interacoesDaAcademia()).toEqual([expect.objectContaining({
      consultantName: 'Caio Prof', actorId: CAIO.id, actorAuthUid: 'auth-caio',
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana', type: 'note', volumeKind: 'visita'
    })]);
    expect(leadDaAcademia('L1')).toMatchObject({
      consultantId: 'u-ana', consultantAuthUid: 'auth-ana', appointmentType: 'visita', appointmentOutcome: null
    });
  });

  it('com o módulo desligado, não abre o balão nem agenda', async () => {
    banco.tenants[TENANT].modules = [];
    const opcoes = resposta();
    const agenda = resposta();

    await handler(pedidoOpcoesAgenda({ email: CAIO.email }), opcoes);
    await handler(pedidoAgenda({ actor: { email: CAIO.email, name: 'Caio' } }), agenda);

    expect(opcoes.statusCode).toBe(403);
    expect(opcoes.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_DESLIGADO });
    expect(agenda.statusCode).toBe(403);
    expect(agenda.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_DESLIGADO });
    expect(interacoesDaAcademia()).toEqual([]);
    expect(aulasDaAcademia()).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('com o módulo desligado, a consultora continua agendando', async () => {
    banco.tenants[TENANT].modules = [];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapProfessor.test.js api/__tests__/zapRoute.test.js`

Expected: FAIL, `Tests  18 failed | 193 passed (211)`.

- Em `zapProfessor.test.js` falham 12 dos 13 testes. Os motivos:
  - `TypeError: signupRefusal is not a function` e `TypeError: scheduleRefusal is not a function`;
  - o Caio aparece na equipe do gestor;
  - o `resolveOwner` devolve `{ owner: CAIO }`;
  - o `countsForMeta` do professor dá `true`;
  - `professorNoLead` e `professorOff` estão `undefined`.

  O único que passa é o do `teamRole`, porque o professor já sai como `'consultor'`.
- Em `zapRoute.test.js` falham 6 dos 8 testes novos. Os dois que já passam ("agenda no nome dele" e "a consultora continua agendando") confirmam o que o D3 mantém: o professor pode agendar com o módulo ligado.

- [ ] **Step 4: Implementar `api/_zapLead.js`**

Na linha 17, trocar:

```js
import { buildNewLeadDoc, leadEntryFunnels } from '../src/lib/newLead.js';
```

por:

```js
import { buildNewLeadDoc, leadEntryFunnels } from '../src/lib/newLead.js';
import { ACTIONS, can, isGestor, isSeller } from '../src/lib/acesso.js';
```

Na linha 37, trocar:

```js
  notInTeam: (email) => `Seu e-mail do Stronizap, ${email}, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.`,
```

por:

```js
  notInTeam: (email) => `Seu e-mail do Stronizap, ${email}, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.`,
  professorNoLead: 'Seu acesso de professor no Stronilead não cadastra lead. Peça a um consultor ou ao gestor.',
```

Nas linhas 135-136, trocar:

```js
// Gestor no Stronilead é o role 'admin'.
export const teamRole = (member) => (member?.role === 'admin' ? 'gestor' : 'consultor');
```

por:

```js
// Gestor no Stronilead é o role 'admin' (isGestor, em src/lib/acesso.js). O
// professor sai como 'consultor', porque o Stronizap só conhece os dois papéis
// (frontend/src/types/crm.ts). Quem barra o professor no cadastro é o
// signupRefusal, e na Meta é o countsForMeta (api/_zapSchedule.js).
export const teamRole = (member) => (isGestor(member) ? 'gestor' : 'consultor');

// Quem cadastra lead pelo Stronizap: alguém da equipe, com login, que cria lead
// no Stronilead (ACTIONS.LEAD_CRIAR, em src/lib/acesso.js). O professor fala
// com os alunos pelo canal dos professores, mas não cadastra lead nem vira dono
// (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md). A
// ponte grava pelo Admin SDK, que passa por cima do firestore.rules, então a
// trava do professor mora aqui também. As duas recusas usam o código
// fora_da_equipe, que o Stronizap já conhece e mostra com o texto que vai.
export function signupRefusal(member, email) {
  if (!member) return refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email));
  if (!can(member, ACTIONS.LEAD_CRIAR)) return refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.professorNoLead);
  return null;
}
```

Na linha 166, trocar:

```js
// e a primeira etapa dele. A equipe só vai para o gestor, com id e nome.
```

por:

```js
// e a primeira etapa dele. A equipe só vai para o gestor, com id e nome, e só
// com quem vende: o professor não é dono de lead (isSeller).
```

Na linha 185, trocar:

```js
      .filter((u) => u.authUid && hasName(u))
```

por:

```js
      .filter((u) => u.authUid && hasName(u) && isSeller(u))
```

Nas linhas 304-305, trocar:

```js
// Dono do lead: quem cadastra, ou quem o gestor escolheu. Consultor não passa
// o lead para outra pessoa, e o escolhido precisa estar na equipe com login.
```

por:

```js
// Dono do lead: quem cadastra, ou quem o gestor escolheu. Consultor não passa
// o lead para outra pessoa, e o escolhido precisa estar na equipe com login e
// vender: o professor nunca é dono de lead (isSeller).
```

Na linha 311, trocar:

```js
  const owner = (team || []).find((u) => u.id === ownerId && u.authUid);
```

por:

```js
  const owner = (team || []).find((u) => u.id === ownerId && u.authUid && isSeller(u));
```

- [ ] **Step 5: Implementar `api/_zapSchedule.js`**

Na linha 34, trocar:

```js
import { contactOf } from '../src/lib/guardian.js';
```

por:

```js
import { contactOf } from '../src/lib/guardian.js';
import { isGestor, isProfessor, isSeller } from '../src/lib/acesso.js';
import { MODULES, hasModule } from '../src/lib/modules.js';
```

Na linha 80, trocar:

```js
  rateLimited: 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.'
});
```

por:

```js
  rateLimited: 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.',
  professorOff: 'O acesso de professor está desligado nesta academia. Fale com o gestor.'
});
```

Nas linhas 150-156, trocar:

```js
// Agendar hoje conta na Meta diária de quem agenda: consultor, em dia da meta
// da academia, no calendário de Brasília. Gestor fica fora da régua, como no
// Stronilead. Lista vazia de dias conta como nenhum dia, mas a rota nunca
// chega aqui com lista vazia: o scheduleCatalogView a troca por segunda a sexta.
export function countsForMeta({ member, metaWeekdays, now = new Date() }) {
  return teamRole(member) === 'consultor' && (metaWeekdays || []).includes(diaDaSemanaDoDia(diaDeBrasilia(now)));
}
```

por:

```js
// Agendar hoje conta na Meta diária de quem agenda: consultor, em dia da meta
// da academia, no calendário de Brasília. Gestor e professor ficam fora da
// régua, como no Stronilead: o professor não vende (isSeller, em
// src/lib/acesso.js), e o teamRole o manda como 'consultor' só porque o
// Stronizap não conhece outro papel. Lista vazia de dias conta como nenhum
// dia, mas a rota nunca chega aqui com lista vazia: o scheduleCatalogView a
// troca por segunda a sexta.
export function countsForMeta({ member, metaWeekdays, now = new Date() }) {
  return isSeller(member) && !isGestor(member)
    && (metaWeekdays || []).includes(diaDaSemanaDoDia(diaDeBrasilia(now)));
}

// Quem agenda pelo Stronizap: alguém da equipe, com login. O professor agenda,
// como no Agendar da ficha, mas só com o módulo do professor ligado na
// academia (tenants/{id}.modules, src/lib/modules.js). Com o módulo desligado,
// as regras do Firestore recusam a gravação do professor, e a ponte, que grava
// pelo Admin SDK, recusa igual. O código é o fora_da_equipe, que o Stronizap
// já mostra com o texto que vai.
export function scheduleRefusal(member, email, tenant) {
  if (!member) return refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email));
  if (isProfessor(member) && !hasModule(tenant, MODULES.FALTOSOS)) {
    return refusal(403, 'fora_da_equipe', ZAP_SCHEDULE_MESSAGES.professorOff);
  }
  return null;
}
```

O `teamRole` continua importado da linha 19, porque o `buildScheduleOptions` (linha 241) ainda o usa para o papel que vai ao Stronizap.

- [ ] **Step 6: Implementar `api/zap.js`**

Na linha 30, trocar:

```js
  buildZapLead, buildZapSignupInteraction, buildRegistrationNote, alreadyRegisteredBody, scrubbedError
```

por:

```js
  buildZapLead, buildZapSignupInteraction, buildRegistrationNote, alreadyRegisteredBody, scrubbedError, signupRefusal
```

Na linha 35, trocar:

```js
  scheduleRecordChanges, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
```

por:

```js
  scheduleRecordChanges, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody, scheduleRefusal
```

Nas linhas 360-362, trocar:

```js
// Autenticação das ações do Stronizap no POST: identificador no formato da
// casa, chave da academia e academia ativa. Devolve { tenantId } ou
// { refusal }. Academia inexistente responde igual a chave errada, como no GET.
```

por:

```js
// Autenticação das ações do Stronizap no POST: identificador no formato da
// casa, chave da academia e academia ativa. Devolve { tenantId, tenant } ou
// { refusal }, com o documento da academia já lido (o agendamento confere nele
// o módulo do professor). Academia inexistente responde igual a chave errada,
// como no GET.
```

Na linha 383, trocar:

```js
  return { tenantId };
```

por:

```js
  return { tenantId, tenant: loaded.tenant };
```

Nas linhas 418-419 (`handleLeadOptions`), trocar:

```js
    const actor = findTeamMember(team, email);
    if (!actor) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
```

por:

```js
    const actor = findTeamMember(team, email);
    // Fora da equipe ou professor: o formulário nem abre.
    const barrado = signupRefusal(actor, email);
    if (barrado) return responder(res, barrado);
```

Nas linhas 444-445 (`handleCreateLead`), trocar:

```js
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
    // O nome do autor é o do Stronilead, como em toda interação do app. O que
```

por:

```js
    const member = findTeamMember(team, email);
    const barrado = signupRefusal(member, email);
    if (barrado) return responder(res, barrado);
    // O nome do autor é o do Stronilead, como em toda interação do app. O que
```

Em `handleScheduleOptions`, primeiro trocar a linha 542:

```js
    const { tenantId } = access;
```

por:

```js
    const { tenantId, tenant } = access;
```

e depois trocar as linhas 552-553:

```js
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));

    return res.status(200).json(
```

por:

```js
    const member = findTeamMember(team, email);
    // Fora da equipe, ou professor com o módulo desligado: o balão nem abre.
    const barrado = scheduleRefusal(member, email, tenant);
    if (barrado) return responder(res, barrado);

    return res.status(200).json(
```

Em `handleSchedule`, trocar a linha 572 (`const { tenantId } = access;`, a segunda ocorrência) por:

```js
    const { tenantId, tenant } = access;
```

e trocar as linhas 582-583:

```js
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
    // O nome de quem agendou é o do Stronilead, como no cadastro. O que o
```

por:

```js
    const member = findTeamMember(team, email);
    const barrado = scheduleRefusal(member, email, tenant);
    if (barrado) return responder(res, barrado);
    // O nome de quem agendou é o do Stronilead, como no cadastro. O que o
```

`refusal` e `ZAP_LEAD_MESSAGES` continuam importados, porque o `openByKey` e os limites (`rateLimited`, `blocked`, `actor`) ainda os usam.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapProfessor.test.js api/__tests__/zapLead.test.js api/__tests__/zapSchedule.test.js api/__tests__/zapRoute.test.js src/lib/__tests__/newLeadImports.test.js`

Expected: PASS, `Test Files  5 passed (5)` e `Tests  470 passed (470)`. Os 470 são os 449 de antes mais os 21 novos. Os testes antigos do `teamRole` (`zapLead.test.js:164-165`), do `countsForMeta` (`zapSchedule.test.js:217-231`) e da equipe do gestor (`zapRoute.test.js:1091-1103`) continuam iguais. O `newLeadImports.test.js` continua verde porque `acesso.js` e `modules.js` não importam nada.

Run: `npx eslint api/zap.js api/_zapLead.js api/_zapSchedule.js api/__tests__/zapProfessor.test.js api/__tests__/zapRoute.test.js`

Expected: nenhuma saída.

- [ ] **Step 8: Commit**

```bash
git add api/_zapLead.js api/_zapSchedule.js api/zap.js api/__tests__/zapProfessor.test.js api/__tests__/zapRoute.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: ponte do Stronizap barra o professor no cadastro de lead e fora da Meta" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Regras do Firestore (`firestore.rules`)

As travas do professor ficam no servidor:

- **Lead:** não cria nem exclui. Altera só as chaves do `buildSchedulePatch` mais `lastInteractionAt` e `interactionsCount`, sempre com o desfecho vazio (D9) e só com o módulo ligado (D1).
- **Contrato:** não cria nem altera.
- **Interação:** cria só `note`, no próprio nome e com o módulo ligado. Não edita nem apaga.
- **Equipe (D11):** `role` e `professorId` só mudam pelo servidor. O cliente cria só gestor ou consultor, e o caminho do cliente com `professorAllowed()` não existe.

O `hasModule` nasce aqui, igual ao de `src/lib/modules.js`.

Para gestor e consultor nada muda. As cláusulas novas são sempre verdadeiras para eles, e nenhuma tela grava `role` nem `professorId` (os únicos updates do cliente em `stronix_users` são `App.jsx:580`, `useNotificationsSeen.js:45`, `PaceSection.jsx:126` e `TeamAccessSection.jsx:286`).

**Dependências:**
- **Depende da Task 1:** o `hasModule` da regra faz a mesma conta do `src/lib/modules.js`. Se a Task 1 deixou no `modules.test.js` o bloco "firestore.rules: a função hasModule", ele fica verde nesta Task.
- **Depende da Task 8:** o teste varre os quatro handlers da ficha depois das mudanças dela.
- **Depende das Tasks 5 e 6:**
  - nenhuma tela grava `role` nem `professorId`;
  - o professor nasce com o id do cadastro igual ao uid, pelo `api/admin-users.js` e pelo `api/invite-accept.js`;
  - o `set-role` nunca faz professor de um cadastro com id diferente do `authUid`. A regra lê o papel em `stronix_users/{uid}` e não o veria.

**Files:**
- Create: `src/lib/professorWrites.js`
- Create: `src/lib/__tests__/professorRules.test.js`
- Modify: `firestore.rules:234-243` (contratos), `:112-127` (`roleAndProfessorKept` e `stronix_users`), `:88-95` (interações), `:77-86` (leads), `:54-58` (`isProfessor` e as listas do professor, depois do `isAdmin`), `:45-48` (`hasModule`, depois do `tenantActive`)

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/__tests__/professorRules.test.js`:

```js
// As travas do professor moram no firestore.rules, que o Johnny publica à mão
// no console (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "As regras do Firestore"). O professor só altera no lead os campos que o
// Agendar e o composer da ficha gravam, sempre com o desfecho vazio, só cria
// interação dos tipos que essas ações gravam, e com o módulo desligado não
// grava nada. Este teste lê o texto da regra e cobra três coisas:
//   1. as listas da regra (professorLeadFields, professorOutcomeFields e
//      professorInteractionTypes) são iguais às de src/lib/professorWrites.js;
//   2. as listas de professorWrites.js são as que os montadores de verdade
//      produzem (buildSchedulePatch, logInteraction e os handlers da ficha);
//   3. as travas continuam ligadas em lead, contrato, interação e equipe.
// Mudou o Agendar ou o composer, o teste quebra até a regra acompanhar. Aí é
// mudar a regra, publicar no console e só depois fazer o merge.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSchedulePatch } from '../schedulePatch.js';
import { planProfileNote } from '../profileNote.js';
import {
  SCHEDULE_TYPE_LABELS,
  LEAD_BUMP_FIELDS,
  SCHEDULE_PATCH_FIELDS,
  PROFESSOR_LEAD_FIELDS,
  PROFESSOR_OUTCOME_FIELDS,
  PROFESSOR_INTERACTION_TYPES,
} from '../professorWrites.js';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const RULES = ler('../../../firestore.rules');
const ordenado = (xs) => [...xs].sort();

// A lista que uma função da regra devolve: `function nome() { return [ ... ]; }`.
// Só os textos entre aspas simples contam, então a regra não pode ter
// comentário dentro da lista.
function listaDaRegra(nome) {
  const m = new RegExp(`function ${nome}\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\];\\s*\\}`).exec(RULES);
  expect(m, `function ${nome}() no firestore.rules`).not.toBeNull();
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// O corpo de uma função da regra, até a chave que a fecha (quatro espaços).
function funcaoDaRegra(assinatura) {
  const inicio = RULES.indexOf(`function ${assinatura} {`);
  expect(inicio, `function ${assinatura}`).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// O bloco `match` de uma coleção da academia, até a chave que o fecha.
function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// Uma linha `allow` do bloco (com as linhas de continuação), até a próxima
// `allow` ou o fim do bloco. `allow update, delete:` serve aos dois.
function regraDe(bloco, op) {
  const m = new RegExp(`allow [\\w, ]*\\b${op}\\b[\\w, ]*:([\\s\\S]*?)(?=\\n\\s*allow |$)`).exec(bloco);
  expect(m, `allow ${op}`).not.toBeNull();
  return m[1];
}

// O corpo de um handler `const nome = async (...) => { ... };` da ficha, até a
// primeira linha que só fecha a função com dois espaços de recuo (o mesmo
// recorte do registroDoAgendamento.sweep.test.js).
function corpoDe(fonte, nome) {
  const inicio = fonte.indexOf(`const ${nome} = async`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf('\n  };\n', inicio));
}

describe('a regra do professor tem as listas do professorWrites', () => {
  it('campos do lead: professorLeadFields() é PROFESSOR_LEAD_FIELDS, sem repetir', () => {
    const regra = listaDaRegra('professorLeadFields');
    expect(new Set(regra).size).toBe(regra.length);
    expect(ordenado(regra)).toEqual(ordenado(PROFESSOR_LEAD_FIELDS));
  });

  it('desfecho: professorOutcomeFields() é PROFESSOR_OUTCOME_FIELDS', () => {
    expect(ordenado(listaDaRegra('professorOutcomeFields'))).toEqual(ordenado(PROFESSOR_OUTCOME_FIELDS));
  });

  it('tipos de interação: professorInteractionTypes() é PROFESSOR_INTERACTION_TYPES, sem repetir', () => {
    const regra = listaDaRegra('professorInteractionTypes');
    expect(new Set(regra).size).toBe(regra.length);
    expect(ordenado(regra)).toEqual(ordenado(PROFESSOR_INTERACTION_TYPES));
  });

  it('o professor nunca troca o dono, a fase, o funil nem o cadastro do lead', () => {
    const regra = listaDaRegra('professorLeadFields');
    for (const campo of [
      'consultantId', 'consultantAuthUid', 'consultantName', 'status', 'funnelId',
      'lifecycleStage', 'lifecycleBucket', 'isConverted', 'name', 'whatsapp', 'cpf',
      'isMinor', 'guardian', 'currentContractId', 'currentContractStatus', 'photoUrl', 'referredById',
    ]) {
      expect(regra, campo).not.toContain(campo);
    }
  });
});

describe('as listas do professorWrites saem dos montadores de verdade', () => {
  it('os rótulos são os followUpLabel do ScheduleWizard', () => {
    const wizard = ler('../../components/profile/ScheduleWizard.jsx');
    const rotulos = [...wizard.matchAll(/followUpLabel:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(rotulos.length).toBeGreaterThan(0);
    expect(ordenado(SCHEDULE_TYPE_LABELS)).toEqual(ordenado(rotulos));
  });

  it('o patch do Agendar, com todos os campos preenchidos, tem as chaves de SCHEDULE_PATCH_FIELDS', () => {
    const cheio = {
      date: new Date(2026, 9, 2, 18, 0),
      modalidade: 'Musculação',
      professorId: 'p1',
      professorName: 'Ana',
      soloTraining: true,
      quantidade: 2,
      unidade: 'Centro',
      note: 'Traz a toalha',
      currentAulaId: 'aula1',
      contactOwnerId: 'u2',
      contactOwnerName: 'Bia',
    };
    const chaves = new Set(
      SCHEDULE_TYPE_LABELS.flatMap((typeLabel) => Object.keys(buildSchedulePatch({ ...cheio, typeLabel })))
    );
    expect(ordenado(SCHEDULE_PATCH_FIELDS)).toEqual(ordenado(chaves));
    expect(ordenado(PROFESSOR_LEAD_FIELDS)).toEqual(ordenado(new Set([...chaves, ...LEAD_BUMP_FIELDS])));
  });

  it('o desfecho são os três campos appointmentOutcome*, e o Agendar sempre os grava vazios', () => {
    expect(ordenado(PROFESSOR_OUTCOME_FIELDS))
      .toEqual(['appointmentOutcome', 'appointmentOutcomeAt', 'appointmentOutcomeBy']);
    for (const typeLabel of ['Visita', 'Aula Experimental']) {
      const patch = buildSchedulePatch({ typeLabel, date: new Date(2026, 9, 2, 18, 0) });
      for (const campo of PROFESSOR_OUTCOME_FIELDS) expect(patch[campo], `${typeLabel}: ${campo}`).toBeNull();
    }
    for (const typeLabel of ['Mensagem', 'Ligação']) {
      const patch = buildSchedulePatch({ typeLabel, date: new Date(2026, 9, 2, 18, 0) });
      for (const campo of PROFESSOR_OUTCOME_FIELDS) expect(campo in patch, `${typeLabel}: ${campo}`).toBe(false);
    }
  });

  it('o logInteraction soma no lead só os campos de LEAD_BUMP_FIELDS, mais o patch', () => {
    const fonte = ler('../interactions.js');
    const escrita = /LEADS_PATH, lead\.id\),\s*\{([\s\S]*?)\},\s*\{ merge: true \}/.exec(fonte);
    expect(escrita).not.toBeNull();
    const chaves = [...escrita[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]);
    expect(ordenado(chaves)).toEqual(ordenado(LEAD_BUMP_FIELDS));
    expect(escrita[1]).toContain('...(leadPatch || {})');
  });

  it('o logInteraction grava o actorAuthUid de quem fez a ação', () => {
    expect(ler('../interactions.js')).toContain('actorAuthUid: appUser?.authUid || null,');
  });

  it('a Anotação do composer grava um tipo da lista', () => {
    expect(PROFESSOR_INTERACTION_TYPES).toContain(planProfileNote('Ligou de volta').type);
  });
});

describe('as ações do professor na ficha passam pelo logInteraction', () => {
  const ficha = ler('../../views/LeadProfileView.jsx');
  const HANDLERS = ['saveInteraction', 'handleSendWhatsAppMessage', 'handleLogCall', 'handleWizardConfirm'];

  it.each(HANDLERS)('%s grava só pelo logInteraction, com tipo da lista', (nome) => {
    const corpo = corpoDe(ficha, nome);
    expect(corpo).toContain('logInteraction(db, lead, appUser');
    expect(corpo.match(/logInteraction\(/g)).toHaveLength(1);
    expect(corpo).not.toMatch(/\b(updateDoc|setDoc|addDoc|writeBatch|runTransaction|commit[A-Z]\w*)\(/);
    for (const [, tipo] of corpo.matchAll(/\btype: '([^']+)'/g)) {
      expect(PROFESSOR_INTERACTION_TYPES, `${nome}: type '${tipo}'`).toContain(tipo);
    }
  });

  it('Anotação, WhatsApp e Ligação não mandam patch para o lead', () => {
    for (const nome of ['saveInteraction', 'handleSendWhatsAppMessage', 'handleLogCall']) {
      expect(corpoDe(ficha, nome), nome)
        .toMatch(/logInteraction\(db, lead, appUser, (payload|\{[\s\S]*?\n\s*\})\);/);
    }
  });

  it('o Agendar manda para o lead só o patch do buildSchedulePatch', () => {
    const corpo = corpoDe(ficha, 'handleWizardConfirm');
    expect(corpo).toContain('const up = buildSchedulePatch({');
    expect(corpo).toMatch(/\},\s*up\s*\);/);
  });
});

describe('as travas do professor continuam no firestore.rules', () => {
  it('isProfessor confere o cadastro antes de ler o papel (conta antiga tem id diferente do uid)', () => {
    const f = funcaoDaRegra('isProfessor(appId)');
    expect(f).toContain('exists(/databases/$(database)/documents/artifacts/$(appId)/public/data/stronix_users/$(request.auth.uid))');
    expect(f).toContain(".data.get('role', null) == 'professor'");
  });

  it('lead: o professor não cria, não exclui e altera só os campos da lista, com o desfecho vazio', () => {
    const leads = blocoDe('stronix_leads');
    expect(regraDe(leads, 'create')).toContain('!isProfessor(appId)');
    expect(regraDe(leads, 'delete')).toContain('!isProfessor(appId)');
    expect(regraDe(leads, 'update')).toContain('(!isProfessor(appId) || professorLeadUpdateOk(appId))');
    const ok = funcaoDaRegra('professorLeadUpdateOk(appId)');
    expect(ok).toMatch(/let changed = request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\);/);
    expect(ok).toContain('changed.hasOnly(professorLeadFields())');
    expect(ok).toContain('(!changed.hasAny(professorOutcomeFields()) || professorOutcomeCleared())');
    const vazio = funcaoDaRegra('professorOutcomeCleared()');
    for (const campo of PROFESSOR_OUTCOME_FIELDS) {
      expect(vazio, campo).toContain(`request.resource.data.get('${campo}', null) == null`);
    }
  });

  it('contrato: o professor não cria nem altera', () => {
    const contratos = blocoDe('stronix_contratos');
    expect(regraDe(contratos, 'create')).toContain('!isProfessor(appId)');
    expect(regraDe(contratos, 'update')).toContain('!isProfessor(appId)');
  });

  it('interação: o professor cria só os tipos da lista, no próprio nome, e não edita nem apaga', () => {
    const interacoes = blocoDe('stronix_interactions');
    expect(regraDe(interacoes, 'create')).toContain('(!isProfessor(appId) || professorInteractionOk(appId))');
    expect(regraDe(interacoes, 'update')).toContain('!isProfessor(appId)');
    expect(regraDe(interacoes, 'delete')).toContain('!isProfessor(appId)');
    const ok = funcaoDaRegra('professorInteractionOk(appId)');
    expect(ok).toContain("request.resource.data.get('type', null) in professorInteractionTypes()");
    expect(ok).toContain("request.resource.data.get('actorAuthUid', null) == request.auth.uid");
  });

  it('com o módulo desligado, o professor não altera lead nem registra interação', () => {
    for (const f of ['professorLeadUpdateOk(appId)', 'professorInteractionOk(appId)']) {
      expect(funcaoDaRegra(f), f).toContain("hasModule(appId, 'faltosos')");
    }
  });

  it('o módulo é lido como lista no documento da academia', () => {
    const f = funcaoDaRegra('hasModule(appId, key)');
    expect(f).toContain('exists(/databases/$(database)/documents/tenants/$(appId))');
    expect(f).toContain("data.get('modules', []) is list");
    expect(f).toContain("key in get(/databases/$(database)/documents/tenants/$(appId)).data.get('modules', [])");
  });

  it('equipe: papel e professor ligado só mudam pelo servidor', () => {
    const equipe = blocoDe('stronix_users');
    expect(regraDe(equipe, 'update')).toContain('roleAndProfessorKept()');
    const mantidos = funcaoDaRegra('roleAndProfessorKept()');
    expect(mantidos).toContain("request.resource.data.get('role', null) == resource.data.get('role', null)");
    expect(mantidos).toContain("request.resource.data.get('professorId', null) == resource.data.get('professorId', null)");
    const criar = regraDe(equipe, 'create');
    expect(criar).toContain("request.resource.data.get('role', 'consultant') in ['admin', 'consultant']");
    expect(criar).toContain("request.resource.data.get('professorId', null) == null");
    expect(regraDe(equipe, 'delete')).toContain('isAdmin(appId)');
  });

  it('nenhum caminho do cliente faz alguém virar professor', () => {
    expect(RULES).not.toMatch(/professorRoleAllowed|professorCreateAllowed|professorAllowed/);
    expect(RULES).not.toMatch(/'professor'\s*\]/);
  });

  it('aulas: o professor grava como os outros membros, porque o Agendar grava ali', () => {
    const aulas = blocoDe('stronix_aulas');
    expect(aulas).not.toContain('isProfessor');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorRules.test.js`

Expected: FAIL antes de rodar teste, `Error: Cannot find module '../professorWrites.js'` e `Tests  no tests`.

- [ ] **Step 3: Criar `src/lib/professorWrites.js`**

```js
// O que as ações do professor gravam no Firestore, tirado dos montadores de
// verdade. É a lista que o firestore.rules repete nas travas do professor
// (professorLeadFields, professorOutcomeFields e professorInteractionTypes), e
// o src/lib/__tests__/professorRules.test.js cobra que as duas sejam iguais.
// Spec em docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "As regras do Firestore".
//
// No PR 1 o professor grava pela ficha: Anotação, WhatsApp e Ligação do
// composer, e o Agendar. As quatro passam pelo logInteraction
// (src/lib/interactions.js), que soma lastInteractionAt e interactionsCount no
// lead, e só o Agendar manda patch, o do buildSchedulePatch. O "Registrar
// contato" da Meta do professor (absence_contact) entra no PR 3, aqui e na
// regra juntos.
//
// Puro: nada de firebase.js aqui, para o teste rodar em node.

import { buildSchedulePatch } from './schedulePatch.js';
import { planProfileNote } from './profileNote.js';

const sortedUnique = (xs) => Object.freeze([...new Set(xs)].sort());

// Os rótulos que o ScheduleWizard manda em typeLabel (o followUpLabel de cada
// tipo). O teste confere a lista contra o próprio ScheduleWizard.jsx.
export const SCHEDULE_TYPE_LABELS = Object.freeze(['Mensagem', 'Ligação', 'Visita', 'Aula Experimental']);

// O que o logInteraction grava no lead em toda interação, além do patch.
export const LEAD_BUMP_FIELDS = sortedUnique(['lastInteractionAt', 'interactionsCount']);

// As chaves do patch do Agendar, somando os dois ramos (contato e
// compromisso). Elas dependem só do tipo, nunca dos valores.
export const SCHEDULE_PATCH_FIELDS = sortedUnique(
  SCHEDULE_TYPE_LABELS.flatMap((typeLabel) => Object.keys(buildSchedulePatch({ typeLabel, date: new Date(0) })))
);

// Os campos do lead que o professor altera.
export const PROFESSOR_LEAD_FIELDS = sortedUnique([...SCHEDULE_PATCH_FIELDS, ...LEAD_BUMP_FIELDS]);

// O desfecho do agendamento. O Agendar o grava sempre vazio (compromisso novo
// nasce sem desfecho), e a regra só deixa o professor gravá-lo vazio: marcar
// Compareceu ou Não compareceu não é dele.
export const PROFESSOR_OUTCOME_FIELDS = sortedUnique(
  SCHEDULE_PATCH_FIELDS.filter((campo) => campo.startsWith('appointmentOutcome'))
);

// Os tipos de interação que o professor cria. A Anotação sai do
// planProfileNote; o WhatsApp, a Ligação e a nota do Agendar gravam 'note'
// direto na LeadProfileView, e o teste varre esses handlers.
export const PROFESSOR_INTERACTION_TYPES = sortedUnique([planProfileNote('-').type, 'note']);
```

- [ ] **Step 4: Rodar e ver falhar nas regras**

Run: `npx vitest run src/lib/__tests__/professorRules.test.js`

Expected: FAIL, `Tests  11 failed | 14 passed (25)`. Se o `hasModule` já estiver no arquivo, são 10 falhas.

- **Falham** as quatro listas, que dão `function ... no firestore.rules` nulo, e as sete travas (`isProfessor`, lead, contrato, interação, módulo desligado, `hasModule` e equipe).
- **Passam:**
  - os seis testes dos montadores;
  - os seis da varredura dos handlers da ficha;
  - os dois negativos: "nenhum caminho do cliente" e "aulas".

- [ ] **Step 5: Mudar o `firestore.rules`**

Faça as seis trocas de baixo para cima, para as linhas citadas continuarem valendo.

**Troca 1, contratos (linhas 234-243).** Trocar:

```
    // Sem delete pelo cliente — o histórico não se apaga (igual ao daily_goal_history).
    match /artifacts/{appId}/public/data/stronix_contratos/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId);
      allow update: if inTenant(appId) && tenantActive(appId)
        && (request.resource.data.get('consultantAuthUid', null)
              == resource.data.get('consultantAuthUid', null)
            || isAdmin(appId));
      allow delete: if false;
    }
```

por:

```
    // Sem delete pelo cliente — o histórico não se apaga (igual ao daily_goal_history).
    //
    // O professor (spec 2026-10-02) só lê: na ficha dele a aba Contratos fica
    // sem botão, e a regra recusa criar e alterar. Com o isProfessor, o caminho
    // comum passa a pagar o get() do cadastro que o isAdmin no fim evitava: uma
    // leitura a mais por gravação de contrato, que é rara (matrícula,
    // renovação, desfecho).
    match /artifacts/{appId}/public/data/stronix_contratos/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId)
        && !isProfessor(appId);
      allow update: if inTenant(appId) && tenantActive(appId)
        && (request.resource.data.get('consultantAuthUid', null)
              == resource.data.get('consultantAuthUid', null)
            || isAdmin(appId))
        && !isProfessor(appId);
      allow delete: if false;
    }
```

**Troca 2, equipe (linhas 112-127).** Trocar:

```
    function selfLinksOwnUid(userId) {
      return request.auth.uid == userId
        && request.resource.data.get('authUid', null) == request.auth.uid;
    }

    // stronix_users: NÃO usa tenantActive — o login precisa ler/vincular o doc do
    // próprio usuário mesmo para conseguir mostrar a tela de bloqueio. O self-update
    // já é travado (role/tenantId imutáveis) contra escalada de privilégio.
    match /artifacts/{appId}/public/data/stronix_users/{userId} {
      allow read: if inTenant(appId);
      allow create, delete: if isAdmin(appId) && inTenant(appId);
      allow update: if inTenant(appId)
        && (authUidKept() || selfLinksOwnUid(userId))
        && (
          // admin edita a equipe (nome, e-mail, turno, meta), menos a chave
          isAdmin(appId)
```

por:

```
    function selfLinksOwnUid(userId) {
      return request.auth.uid == userId
        && request.resource.data.get('authUid', null) == request.auth.uid;
    }

    // role e professorId só mudam pelo Admin SDK: api/admin-users.js (create e
    // set-role) e o aceite de convite (api/invite-accept.js), que conferem a
    // vaga do plano, o módulo e o professor do cadastro (spec 2026-10-02). Pelo
    // cliente ninguém troca o papel nem o professor ligado, nem o gestor:
    // senão o professor passaria a ver e a registrar os alunos de outro, e o
    // gestor pularia a conta das vagas. Nenhuma tela grava esses dois campos,
    // então a trava não muda nada para quem já usa o sistema. O `.get(campo,
    // null)` cobre cadastro antigo sem professorId.
    function roleAndProfessorKept() {
      return request.resource.data.get('role', null) == resource.data.get('role', null)
        && request.resource.data.get('professorId', null) == resource.data.get('professorId', null);
    }

    // stronix_users: NÃO usa tenantActive — o login precisa ler/vincular o doc do
    // próprio usuário mesmo para conseguir mostrar a tela de bloqueio. O self-update
    // já é travado (role/tenantId imutáveis) contra escalada de privilégio, e
    // ninguém troca papel nem professor ligado pelo cliente (roleAndProfessorKept).
    match /artifacts/{appId}/public/data/stronix_users/{userId} {
      allow read: if inTenant(appId);
      // Professor só nasce pelo servidor: pelo cliente, o gestor cria só gestor
      // ou consultor, sem professor ligado.
      allow create: if isAdmin(appId) && inTenant(appId)
        && request.resource.data.get('role', 'consultant') in ['admin', 'consultant']
        && request.resource.data.get('professorId', null) == null;
      allow delete: if isAdmin(appId) && inTenant(appId);
      allow update: if inTenant(appId)
        && (authUidKept() || selfLinksOwnUid(userId))
        && roleAndProfessorKept()
        && (
          // admin edita a equipe (nome, e-mail, turno, meta), menos a chave, o
          // papel e o professor ligado
          isAdmin(appId)
```

O resto do bloco (linhas 128-134, o ramo do próprio usuário) fica como está.

**Troca 3, interações (linhas 88-95).** Trocar:

```
    // Interações compartilhadas: qualquer membro lê e registra (ex.: agendar num
    // lead de outro consultor). Editar/remover: o autor da interação ou admin.
    match /artifacts/{appId}/public/data/stronix_interactions/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId);
      allow update, delete: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || resource.data.consultantAuthUid == request.auth.uid);
    }
```

por:

```
    // Interações compartilhadas: qualquer membro lê e registra (ex.: agendar num
    // lead de outro consultor). Editar/remover: o autor da interação ou admin.
    // O professor (spec 2026-10-02) cria só os tipos de
    // professorInteractionTypes(), no próprio nome e com o módulo ligado, e não
    // edita nem remove. O isProfessor faz a interação gravada sozinha, fora do
    // lote do logInteraction, pagar o get() do cadastro: uma leitura a mais.
    match /artifacts/{appId}/public/data/stronix_interactions/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId)
        && (!isProfessor(appId) || professorInteractionOk(appId));
      allow update, delete: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || resource.data.consultantAuthUid == request.auth.uid)
        && !isProfessor(appId);
    }
```

**Troca 4, leads (linhas 77-86).** Trocar:

```
        == (request.resource.data.get('consultantAuthUid', null) == resource.data.get('consultantAuthUid', null));
    }
    match /artifacts/{appId}/public/data/stronix_leads/{leadId} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || request.resource.data.consultantAuthUid == request.auth.uid);
      allow update: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || ownerFieldsMoveTogether());
      allow delete: if inTenant(appId) && tenantActive(appId) && (isAdmin(appId) || ownsLead(appId, resource.data));
    }
```

por:

```
        == (request.resource.data.get('consultantAuthUid', null) == resource.data.get('consultantAuthUid', null));
    }
    //
    // Professor (spec 2026-10-02): não cria nem exclui lead, e só altera os
    // campos de professorLeadFields(), com o desfecho vazio e o módulo ligado.
    // O isProfessor vem depois do isAdmin para reaproveitar o get() do cadastro
    // que o isAdmin já fez.
    match /artifacts/{appId}/public/data/stronix_leads/{leadId} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || request.resource.data.consultantAuthUid == request.auth.uid)
        && !isProfessor(appId);
      allow update: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || ownerFieldsMoveTogether())
        && (!isProfessor(appId) || professorLeadUpdateOk(appId));
      allow delete: if inTenant(appId) && tenantActive(appId) && (isAdmin(appId) || ownsLead(appId, resource.data))
        && !isProfessor(appId);
    }
```

**Troca 5, o professor depois do `isAdmin` (linhas 54-58).** Trocar:

```
    function isAdmin(appId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/artifacts/$(appId)/public/data/stronix_users/$(request.auth.uid))
        && userDoc(appId).data.role == 'admin';
    }
```

por:

```
    function isAdmin(appId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/artifacts/$(appId)/public/data/stronix_users/$(request.auth.uid))
        && userDoc(appId).data.role == 'admin';
    }

    // Professor (módulo "faltosos", spec
    // docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md). O papel
    // é lido no cadastro da pessoa, como no isAdmin. O exists() vem antes do
    // get() de propósito: conta antiga tem o cadastro com id diferente do uid,
    // e sem ele o get() daria erro e a regra negaria a escrita do consultor
    // legado em lead, contrato e interação. O cadastro de professor só nasce
    // pelo servidor, com o id igual ao uid (api/admin-users.js e
    // api/invite-accept.js), então a regra sempre enxerga o papel dele.
    function isProfessor(appId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/artifacts/$(appId)/public/data/stronix_users/$(request.auth.uid))
        && userDoc(appId).data.get('role', null) == 'professor';
    }

    // O que o professor altera no lead: as chaves do buildSchedulePatch
    // (src/lib/schedulePatch.js, o Agendar), mais o que o logInteraction
    // (src/lib/interactions.js) soma em toda interação: lastInteractionAt e
    // interactionsCount. A Anotação, o WhatsApp e a Ligação só somam esses dois.
    // O src/lib/__tests__/professorRules.test.js compara esta lista com a de
    // src/lib/professorWrites.js, que sai dos montadores de verdade: mudou o
    // Agendar, o teste quebra até a regra acompanhar. Um texto por linha e
    // nenhum comentário dentro da lista, porque o teste lê a lista pelo texto.
    function professorLeadFields() {
      return [
        'appointmentModality',
        'appointmentOutcome',
        'appointmentOutcomeAt',
        'appointmentOutcomeBy',
        'appointmentProfessorId',
        'appointmentProfessorName',
        'appointmentScheduledFor',
        'appointmentSoloTraining',
        'appointmentType',
        'appointmentUnit',
        'currentAulaId',
        'interactionsCount',
        'lastInteractionAt',
        'nextFollowUp',
        'nextFollowUpNote',
        'nextFollowUpOwnerId',
        'nextFollowUpOwnerName',
        'nextFollowUpType',
        'trialClassesPlanned'
      ];
    }
    // O desfecho do agendamento. O Agendar sempre o grava vazio, porque
    // compromisso novo nasce sem desfecho, e marcar Compareceu ou Não
    // compareceu não é do professor: ele só grava esses campos vazios.
    function professorOutcomeFields() {
      return [
        'appointmentOutcome',
        'appointmentOutcomeAt',
        'appointmentOutcomeBy'
      ];
    }
    function professorOutcomeCleared() {
      return request.resource.data.get('appointmentOutcome', null) == null
        && request.resource.data.get('appointmentOutcomeAt', null) == null
        && request.resource.data.get('appointmentOutcomeBy', null) == null;
    }
    // O dono e a fase do lead não estão na lista, então o professor não troca o
    // dono nem move o lead de etapa. Com o módulo desligado, ele não altera
    // lead nenhum.
    function professorLeadUpdateOk(appId) {
      let changed = request.resource.data.diff(resource.data).affectedKeys();
      return hasModule(appId, 'faltosos')
        && changed.hasOnly(professorLeadFields())
        && (!changed.hasAny(professorOutcomeFields()) || professorOutcomeCleared());
    }

    // Os tipos de interação que o professor cria. A Anotação, o WhatsApp, a
    // Ligação e a nota do Agendar gravam todos 'note'. O contato de falta
    // (absence_contact) entra com a Meta do professor, no PR 3, aqui e em
    // src/lib/professorWrites.js juntos.
    function professorInteractionTypes() {
      return [
        'note'
      ];
    }
    // A interação sai no nome de quem grava: o actorAuthUid é o que conta o
    // volume da Meta por pessoa, e o logInteraction sempre o grava. Com o
    // módulo desligado, o professor não registra nada.
    function professorInteractionOk(appId) {
      return hasModule(appId, 'faltosos')
        && request.resource.data.get('type', null) in professorInteractionTypes()
        && request.resource.data.get('actorAuthUid', null) == request.auth.uid;
    }
```

**Troca 6, o módulo depois do `tenantActive` (linhas 45-48).** Trocar:

```
    function tenantActive(appId) {
      return !exists(/databases/$(database)/documents/tenants/$(appId))
        || tenantNotBlocked(get(/databases/$(database)/documents/tenants/$(appId)).data);
    }
```

por:

```
    function tenantActive(appId) {
      return !exists(/databases/$(database)/documents/tenants/$(appId))
        || tenantNotBlocked(get(/databases/$(database)/documents/tenants/$(appId)).data);
    }

    // Módulos da academia, ligados pelo super-admin no console. A lista mora em
    // tenants/{appId}.modules, que só a api/tenant-status.js grava (o cliente
    // não escreve em /tenants), e src/lib/modules.js faz a mesma conta no app.
    // Lê o mesmo documento que o tenantActive. Ao contrário dele, aqui a falta
    // fecha: academia sem documento, sem o campo ou com o campo fora do formato
    // de lista não tem módulo nenhum. Toda chamada passa o módulo escrito por
    // extenso, como em MODULES, e o src/lib/__tests__/modules.test.js confere.
    function hasModule(appId, key) {
      return exists(/databases/$(database)/documents/tenants/$(appId))
        && get(/databases/$(database)/documents/tenants/$(appId)).data.get('modules', []) is list
        && key in get(/databases/$(database)/documents/tenants/$(appId)).data.get('modules', []);
    }
```

Os comentários das regras não podem citar `hasModule(` com outra coisa que não seja um módulo entre aspas. O `modules.test.js` conta as chamadas pelo texto, e uma citação assim conta como chamada sem literal.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professorRules.test.js src/lib/__tests__/modules.test.js`

Expected: PASS. São `25 passed` no `professorRules.test.js`, e o bloco "firestore.rules: as chamadas da hasModule" do `modules.test.js` (Task 1), que até aqui passava sem conferir nada, agora confere as duas chamadas `hasModule(appId, 'faltosos')`.

- [ ] **Step 7: Suíte inteira e lint**

Run: `npm test`
Expected: nenhuma falha.

Run: `npm run lint`
Expected: nenhum erro.

- [ ] **Step 8: Commit**

```bash
git add firestore.rules src/lib/professorWrites.js src/lib/__tests__/professorRules.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: regras do Firestore travam o que o professor grava" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Publicação das regras, à mão, pelo Johnny e antes do merge do PR 1**

Ninguém validou estas regras num validador do Firebase. O validador do MCP do Firebase exige um projeto ativo, e o repositório não tem emulador. As construções usadas existem em `rules_version = '2'`:

- `let` dentro de função;
- `Set.hasOnly` e `Set.hasAny`;
- `.get(campo, padrão)`;
- `is list`;
- `in` em lista;
- função que devolve lista.

Mesmo assim, a primeira validação de verdade é no console. Se o Johnny autorizar mudar a configuração local do MCP para o projeto de produção, dá para conferir antes, só a sintaxe e sem publicar, com `firebase_validate_security_rules` (`type: firestore`, `source_file: firestore.rules`).

Etapa A, antes de publicar:

1. No console do Firebase, Firestore, Regras, abrir as regras publicadas e comparar com `git show 49a978d:firestore.rules`. Se forem diferentes, parar e juntar a diferença no arquivo do PR antes de seguir.
2. Colar o `firestore.rules` do PR no editor, sem publicar. O editor aponta erro de sintaxe na hora.
3. No Rules Playground, usar a academia de teste, com a claim `tenantId` da academia no payload do token e o uid de verdade de cada pessoa. O `get()` e o `exists()` do Playground leem os documentos de verdade.

| Quem | Operação | Esperado |
|---|---|---|
| Consultor C | update num lead de C, mudando só `nextFollowUpNote` | Permitido |
| Consultor C | create em `stronix_interactions` com `type: 'status_change'` | Permitido |
| Consultor C | create em `stronix_contratos` | Permitido |
| Gestor G | update em `stronix_users/{C}`, mudando `name` | Permitido |
| Gestor G | update em `stronix_users/{C}`, mudando `role` para `admin` | Negado. É novo e esperado: o papel só muda pelo servidor |
| Gestor G | create em `stronix_users`, com qualquer papel | Negado. É novo e esperado: o cadastro de equipe só nasce pelo servidor (ponto 10) |
| Gestor G | delete em `stronix_users/{C}` | Negado, pelo mesmo motivo. O "Excluir acesso" da tela passa pelo servidor e continua funcionando |
| Consultor C | update no próprio `stronix_users/{C}`, mudando `lastSeenReferralsAtMs` | Permitido |
| Consultor legado (cadastro com id diferente do uid), se existir | create em `stronix_interactions` | Permitido |

4. Publicar. As travas não mudam nada para quem já usa o sistema.

Etapa B, no Preview do PR 1, depois de publicar (o Preview usa o Firebase de produção, então só a academia de teste):

5. No super console do Preview, ligar "Professor e faltosos" na academia de teste. Como gestor, criar o professor P, ligado a um professor do cadastro.
6. Entrar como P e, num cliente, registrar Anotação, WhatsApp, Ligação e Agendar (visita, aula experimental e mensagem). Tudo grava.
7. No Rules Playground, com o uid de P:

| Operação de P | Esperado |
|---|---|
| update num lead, mudando só `nextFollowUpNote` | Permitido |
| update num lead, mudando `status` | Negado |
| update num lead, mudando `consultantId` e `consultantAuthUid` juntos | Negado |
| update num lead, mudando `photoUrl` | Negado |
| update num lead, gravando `appointmentOutcome: 'attended'` | Negado |
| create e delete em `stronix_leads` | Negado |
| create e update em `stronix_contratos` | Negado |
| create em `stronix_interactions` com `type: 'note'` e `actorAuthUid` igual ao uid de P | Permitido |
| o mesmo com `type: 'status_change'` | Negado |
| o mesmo com o `actorAuthUid` de outra pessoa | Negado |
| delete de uma interação gravada por P | Negado |
| update no próprio `stronix_users/{P}`, mudando `professorId` | Negado |
| update no próprio `stronix_users/{P}`, mudando `lastSeenReferralsAtMs` | Permitido |
| create em `stronix_aulas` | Permitido, como antes |
| update em `stronix_aulas`, mudando `status` para `attended` | Permitido. Aceito, ponto 9 |
| update num lead com `lastInteractionAt` igual à hora do pedido e `interactionsCount` mais 1 (o que a Anotação grava) | Permitido |
| update num lead com `lastInteractionAt` numa data escolhida, ou `interactionsCount` diferente de mais 1 | Negado |
| create ou update em `stronix_daily_goal_history` | Negado |

8. Desligar o módulo no super console e repetir, com P: o update do lead mudando `nextFollowUpNote` e o create da interação `note` passam a ser Negados. O create em `stronix_aulas` continua Permitido (ponto 9). Religar o módulo.
9. Só então fazer o merge do PR 1.

---

### Task 12: CLAUDE.md do Stronilead (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md` (o do Stronilead, na raiz do worktree)

O `CLAUDE.md` é a memória do projeto: cada regra nova deste PR entra nele, no lugar indicado. Os textos abaixo vieram das tasks que criaram cada regra. Escreva no tom do arquivo (frases diretas, sem travessão no meio da frase). Onde o texto traz uma instrução de lugar ("acrescentar depois de..."), siga a instrução e escreva só o conteúdo.

- [ ] **Step 1: Conferir os travessões de hoje**

Run: `grep -c "—" CLAUDE.md`
Expected: anote o número. O Step 7 confere que ele não aumentou.

- [ ] **Step 2: Convenções gerais**

Em "## Convenções gerais", acrescentar no fim da lista, nesta ordem, o texto do papel e das permissões:

```markdown
- Convenções gerais: o papel de quem usa o app se decide só em `src/lib/acesso.js`, com `roleOf` e `ROLES`, `isGestor`, `isProfessor`, `isSeller`, `roleLabel`, `can` com `ACTIONS` e `canOpenScreen`. Comparar `role` com 'admin', 'consultant', 'professor', 'consultor' ou 'gestor' fora dele reprova o `src/lib/__tests__/acessoSweep.test.js`. O `isAdminUser` saiu de `leads.js`. A `api/` não é varrida, mas também importa `acesso.js` onde decide por papel.
- `acesso.js` e `modules.js` não importam nada, porque a `api/` os lê direto. O `src/lib/__tests__/acessoImports.test.js` trava isso com o mesmo leitor do `guardianImports.test.js`.
- Cadastro sem papel, com papel antigo ('consultor') ou com papel desconhecido vale consultor, como sempre. A comparação é exata, igual à das regras do Firestore.
- Gestor e consultor fazem todas as ações de `ACTIONS` (como hoje, desde a PR #193), e o professor não faz nenhuma. O que é só do gestor continua em `isGestor` e na trava `gestor` de `SCREENS`, fora de `ACTIONS`: Configurações, excluir lead, Meta da equipe, filtro de responsável nas listas e cobrança. Quando os perfis editáveis vierem, a tabela `PERMISSOES` sai do código e as telas continuam perguntando igual.
- `can` olha só o papel. O login (`canEditLead`, pelo `authUid`) continua conferido à parte, e a ficha combina os dois. A sessão do super-admin puro tem `role: 'superadmin'`, que `roleOf` lê como consultor, então `can` devolve true para ela. Tela que o super-admin puro alcance sem academia não pode confiar só no `can`.
- Lista de pessoas que vira filtro de responsável, escolha de dono, painel por pessoa, Meta da equipe ou meta de prospecção passa por `isSeller`. Busca de nome (o chip do filtro, o autor da linha do tempo, o `usersById` da Meta) continua com o `usersList` inteiro. As telas da varredura ficam em `LISTAS_DE_QUEM_VENDE`, no `acessoSweep.test.js` (os painéis, a Meta da equipe, o Pipeline, as listas, Clientes, a ficha, o cadastro do cliente e Metas & ritmo), e tela nova com lista de pessoas entra ali.
- O que o professor registra (anotação, WhatsApp, ligação, agendamento) cai em Outros no volume do Operacional, porque ele não está nas linhas por pessoa. Decidido no plano do PR 1, em 02/10/2026, e o Johnny pode mudar.
- O dia batido da Meta (`goalHitKeyToRecord`, em `src/lib/dailyGoalHistory.js`) só grava para quem vende. O `App.jsx` passa `seller: isSeller(appUser)`.
- No Gerencial, o rótulo de quem vendeu sai de `sellerRoleText`. O gestor aparece como "Gestor · também vende" e os outros, pelo `roleLabel`. As tabelas de pessoas do Operacional e do CRM usam o `roleLabel`.
```

E, logo depois do item "Firestore rules são publicadas MANUALMENTE no console Firebase (não via CLI).", as travas do professor nas regras:

```markdown
- Em "Convenções gerais", logo depois de "Firestore rules são publicadas MANUALMENTE": as travas do professor no `firestore.rules`.
  - O professor não cria nem exclui lead.
  - Altera só os campos de `professorLeadFields()`: as chaves do `buildSchedulePatch` mais `lastInteractionAt` e `interactionsCount`.
  - Grava o desfecho do agendamento (`professorOutcomeFields()`) só vazio.
  - Cria interação só dos tipos de `professorInteractionTypes()`, no próprio nome (`actorAuthUid` igual ao uid). Não edita nem apaga interação.
  - Não cria nem altera contrato.
  - Com o módulo `faltosos` desligado, não grava lead nem interação.
  - O `isProfessor` confere o cadastro com `exists()` antes de ler o papel, porque conta antiga tem cadastro com id diferente do uid. Por isso só existe professor em cadastro com id igual ao uid.
  - As três listas são cobradas pelo `src/lib/__tests__/professorRules.test.js` contra `src/lib/professorWrites.js`. Mudou o Agendar ou o composer da ficha, o teste quebra. Aí é mudar a regra, publicar no console e só depois fazer o merge.
- Também em "Convenções gerais": `role` e `professorId` de `stronix_users` só mudam pelo servidor (`roleAndProfessorKept()`). Pelo cliente, o gestor cria só gestor ou consultor, sem `professorId`. Tela nova que grave um desses dois campos cai em permission-denied, e o caminho é o `api/admin-users.js` (`set-role`).
- O `hasModule` das regras faz a mesma conta do `src/lib/modules.js`: lê `tenants/{id}.modules` e, sem documento ou sem lista, o módulo está desligado. Chamada nova passa o módulo escrito por extenso, porque o `modules.test.js` confere.
```

- [ ] **Step 3: Seção nova "Módulos da academia"**

Criar `## Módulos da academia` logo antes de `## Endereço de cada tela`, com:

```markdown
- O super-admin liga módulos por academia, e só ele, no cartão Módulos da página da academia no super console (`src/views/console/TenantModulesCard.jsx`). Hoje existe um módulo, `faltosos` (professor e faltosos), pensado só para a STRONIX. Spec em `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md`.
- A lista mora em `tenants/{id}.modules`. Quem grava é a `api/tenant-status.js`, que recusa módulo fora de `src/lib/modules.js` (texto exato, sem corrigir caixa) e grava a lista inteira de uma vez, porque o `set` com merge troca listas inteiras. As regras não deixam o navegador gravar em `/tenants`. A auditoria (`tenant.update`) guarda a lista de antes (`modulesBefore`) e a de depois (`modules`). Ligar ou desligar não mexe no status e não derruba sessão.
- Desligar o módulo com professor de login pede confirmação no console, porque esses professores passam a ver só o aviso de acesso desligado.
- `src/lib/modules.js` é a conta única, pura e sem import: `MODULES`, `KNOWN_MODULES`, `normalizeModules` e `hasModule`, que aceita a lista, o documento da academia ou as vagas do `getSeatUsage`. A `api/` importa o arquivo direto. Módulo novo entra em `MODULES` e, se as regras o usarem, com o mesmo texto lá: o `modules.test.js` confere toda chamada da `hasModule` no `firestore.rules`.
- O app lê a lista no login, no mesmo `getDoc` de `tenants/{id}` que decide o bloqueio, e a guarda normalizada em `appUser.tenantModules`. Tela pergunta com `hasModule(appUser?.tenantModules, MODULES.FALTOSOS)`. Não existe estado nem prop à parte: o "Acessar como" troca de academia sem recarregar a página, o `signInWithCustomToken` roda o login de novo e monta outro `appUser`, e num estado à parte a tela passaria um instante com a pessoa de uma academia e os módulos de outra. O campo vem depois do `...userDoc.data()`, então o cadastro da pessoa nunca o sobrescreve. O `tenantModulesWiring.test.js` cobra o campo em todo `appUser` montado no login.
- A falha fecha: documento ausente, leitura que falhou ou campo fora do formato dão lista vazia. O bloqueio da academia continua abrindo na falha, como sempre. Ligar ou desligar vale no próximo login ou F5 de cada pessoa.
- A `api/` lê os módulos pelo `getSeatUsage`, que já lê o documento da academia para o plano e devolve `modules`: o convite e o cadastro de professor conferem `hasModule(seats, MODULES.FALTOSOS)` sem ler de novo.
- O console conta o professor à parte: o `api/super-overview.js` devolve `professorCount`, e o `consultantCount` (que vira o preço dos extras e o MRR) não conta professor, com a mesma conta do `getSeatUsage`. O GET da `api/tenant-status.js` devolve `professors` e `modules`, e o uso da plataforma mostra a linha "Professores (fora das vagas)" quando a academia tem algum.
- A tela "Feature flags" do console é outra coisa: grava chaves globais em `flags/` que nenhuma parte do app lê.
```

- [ ] **Step 4: Endereço de cada tela**

Aplicar em `## Endereço de cada tela`:

```markdown
- Em "Endereço de cada tela", depois do tópico "Uma decisão de rota por render", acrescentar:
  - **O professor abre só a Meta diária, Clientes e a ficha.** O `canAccess` consulta o `canOpenScreen` (`src/lib/acesso.js`) antes das travas de gestor e de super-admin.
  - **A tela inicial dele é a Meta diária** (`homeScreenFor`, em `src/lib/routes.js`). `/` e `/<academia>`, onde o login e o Sair caem, levam a ela sem aviso.
  - **Avisos do professor.** Qualquer outra tela mostra "Essa tela não está liberada para o seu acesso." e vai para a Meta diária. O super-admin continua sumindo em silêncio. Endereço desconhecido mostra "Não achamos essa tela. Abrimos a Meta diária.".
  - **A correção de academia remonta o endereço sobre a raiz da academia** (`base`), nunca sobre a tela inicial. Com a inicial do professor como base, `/pipeline` viraria `/<academia>/meta-diaria/pipeline`.
- No tópico "Todo replace passa pelo `navigate`", trocar "vai para Clientes (cliente) ou Pipeline (lead)" por "vai para Clientes (cliente) ou Pipeline (lead), e o professor, que não abre o Pipeline, volta da ficha de lead para a Meta diária (`backTarget` com `appUser`)". Acrescentar que o "Ir para o início" da ficha usa o `homeScreenFor`.
```

- [ ] **Step 5: Seção nova "Professor"**

Criar `## Professor` logo depois de `## Endereço de cada tela`, com três blocos: o acesso, a ficha e as telas.

O acesso:

```markdown
- **Acesso de professor.**
  - Quem tem acesso de professor é um cadastro em `stronix_users` com `role: 'professor'` e `professorId`, que diz qual professor de `stronix_professores` a pessoa é.
  - O cadastro nasce com o id igual ao uid da conta. É por esse id que as regras do Firestore leem o papel.
  - Só o servidor grava `role` e `professorId`. Os caminhos são três: o `create` do `api/admin-users.js`, o convite (`api/invite-create.js` mais `api/invite-accept.js`) e a ação nova `set-role` (`SET_ROLE_ACTION`), na mesma função da Vercel. Continuam 11 de 12.
  - O navegador nunca grava esses dois campos.
- **As regras do vínculo** moram em `src/lib/teamRoles.js`. O arquivo é puro e só importa `acesso.js` e `modules.js`, porque a `api/` também o usa; o `teamRolesImports.test.js` trava isso. As leituras ficam em `api/_professorLink.js`.
- **O que vira professor precisa de:**
  - o módulo `faltosos` ligado;
  - um professor do cadastro ativo (`ativo !== false`) e sem outro login;
  - no `set-role`, carteira vazia. Quem ainda é dono de lead recebe 409 com "Passe os leads em Configurações → Migrar leads";
  - cadastro com id igual ao uid. Cadastro antigo recebe 422 e precisa ser recriado.

  A conferência de "um login por professor" não é transação, e isso foi aceito. O aceite do convite confere tudo de novo, porque o convite vale 7 dias.
- **Vagas.**
  - O `getSeatUsage` (`api/_plans.js`) conta o professor à parte (`professors`) e calcula consultor como total menos gestor menos professor.
  - O `canAddSeat(seats, 'professor')` sempre cabe.
  - A cobrança (Asaas, extras) só lê `consultants` e `extraConsultants`, então nunca cobra professor.
  - O `getSeatUsage` devolve também os `modules` normalizados da academia, para quem cria professor não ler o documento de novo.
  - `currentUsers` continua contando todo mundo.
- **Troca de papel.**
  - O `set-role` muda só entre Consultor e Professor. O gestor não muda por ali, e ninguém troca o próprio papel.
  - Professor que volta a consultor ocupa vaga de consultor, com a mesma confirmação de extra pago do cadastro.
  - Consultor extra que vira professor libera a vaga e sincroniza a assinatura.
  - Virar professor apaga a meta de prospecção.
  - Quando o papel muda, as sessões da pessoa são revogadas.
- **Equipe & acessos** lê os módulos em `appUser.tenantModules`. Com o módulo, a tela tem:
  - o botão "Cadastrar pessoa";
  - o campo Papel e o "Professor do cadastro", só com ativos sem login;
  - o selo violeta de professor, com o professor ligado embaixo;
  - "—" na prospecção do professor;
  - na faixa de vagas, a conta dos professores fora das vagas de consultor.

  Sem o módulo, a tela fica igual à de antes.
- **Exclusão.** O professor do cadastro que tem login não pode ser excluído pela tela, mas a trava é só de tela. Excluir um professor com acesso não mexe na assinatura.
- **Prospecção e assentos.** O professor não entra na "Meta de prospecção" (`settingsSetup.js` e `PaceSection.jsx`, por `isSeller`) nem na dica de assentos da Visão geral. Ele continua pesando no passo "Acessos da equipe". O atalho "Cadastrar consultor" da Visão geral mantém o nome.
- **Convites antigos.** Convite sem papel ou com papel desconhecido entra como consultor (`roleOf`), como antes.
```

A ficha, a busca e o sino:

```markdown
- Ficha do professor:
  - Some: o Mudar fase do composer, o lápis, a foto, o "Adicionar etiqueta", o Indicar inteiro (Cadastrar indicação, Copiar link e Enviar pro cliente), o lápis do "Indicado por", o "Vincular indicador", Marcar venda, Marcar perda e Excluir.
  - Contratos e Indicações aparecem sem botão.
  - Ficam: Anotação, WhatsApp, Ligação, Agendar, o WhatsApp e o Ligar do cabeçalho e a linha do tempo.
- Travas da ficha:
  - `isReadOnly` continua sendo `!canEditLead(appUser)` (sem `authUid`).
  - Cada ação pergunta também à lista:
    - `canEditCadastro` (`CADASTRO_EDITAR`): foto, lápis, etiqueta e "Fez 18 anos";
    - `canMudarFase` (`FICHA_MUDAR_FASE`): Mudar fase e Perda;
    - `canContrato` (`CONTRATO_EDITAR`): Venda e todo botão de contrato;
    - `canIndicar` (`INDICACAO_CADASTRAR`): menu Indicar e vínculo de indicador.
  - Excluir continua só do gestor, pelo `isGestor`.
  - Além do botão escondido, cada handler tem a própria trava (`negarAcesso`, "Essa ação não está liberada para o seu acesso.").
  - A Venda pelo PhaseChanger pede as duas ações, fase e contrato.
- A aba Contratos fica só para leitura pelo `isReadOnly={isReadOnly || !canContrato}`. Todo botão de `ContractsTab`, `ContractHeroCard`, `NextContractStrip` e do card vazio ou fechado já segue o `isReadOnly`. Botão novo na aba precisa seguir o mesmo prop.
- `ReferralsSection` ganhou `canRefer` (padrão true). Sem ele, o aviso de vazio não manda procurar o botão Indicar.
- Professor nunca aparece numa escolha de pessoa que dá carteira ou tarefa. Passam pelo `isSeller`:
  - o passo "Responsável" do Agendar (`activeUsers` da ficha);
  - o "Consultor responsável" do Editar cadastro (`ownerOptions` do `ClientRegistrationModal`);
  - o filtro de responsável de Clientes (lista e `users` do `screenParams`).
- Busca do topo:
  - O `searchPeople` aceita `include`, um filtro aplicado antes de tudo, para o total e o limite contarem só quem pode aparecer. É função recebida e não import, porque `leads.js` importa `globalSearch.js`.
  - O App passa `clientsOnly={!can(appUser, ACTIONS.LEADS_VER)}` ao `GlobalSearch`, que recorta com `isClientLead` e diz "Buscar clientes".
  - O recorte vem depois da leitura: o `useLeadSearch` continua trazendo 20 candidatos por consulta, sem filtro de `lifecycleBucket`, que pediria índice composto. Numa academia com muitos leads de mesmo começo de nome, um cliente pode não aparecer para o professor.
- Topo do App: o "Cadastrar lead" do cabeçalho, o "Cadastrar novo lead" da busca e a montagem do `AddLeadModal` pedem `ACTIONS.LEAD_CRIAR`.
- Sino:
  - Indicações pelo link e "passaram para você" só chegam a quem tem `ACTIONS.SINO_EQUIPE`.
  - O professor recebe só as novidades, e o `useHandoffs` nem faz a leitura para ele.
  - O recorte academia contra carteira continua no `isGestor`.
  - O texto do sino vazio sai de `emptyBellText`, em `src/lib/notifications.js`.
```

O menu, a Meta, o módulo desligado e os pop-ups:

```markdown
- Tópico novo sobre o menu lateral:
  - O menu sai de `sidebarNav` (`src/lib/sidebarNav.js`), que pergunta ao mesmo `canAccess` da decisão de rota. Item novo do menu de trabalho entra ali e no `professorShell.test.js`.
  - O Suporte segue `ACTIONS.SUPORTE_ABRIR`, e o professor não assina os chamados.
- Tópico novo, "Professor com o módulo desligado":
  - Quando `professorAccessOff(appUser)` é verdade (professor numa academia sem `faltosos` em `appUser.tenantModules`), o App desenha só a `ProfessorAccessOffScreen`, com o aviso "O acesso de professor está desligado nesta academia. Fale com o gestor." e o Sair. Ela entra logo depois do bloqueio da academia.
  - A lista de módulos é lida no login. Se a leitura da academia falhar, ela vem vazia e o professor vê o aviso até o próximo F5.
- Tópico novo sobre a Meta diária do professor:
  - É o `ProfessorGoalPlaceholder` até o PR 3.
  - O selo da Meta e as consultas de renovação e de contato de hoje (`useRenewalClients` e `useClientsWithContactToday`) só rodam para quem vende (`isSeller`).
- Tópico novo sobre os pop-ups:
  - O pop-up de novidade grande (`WhatsNewModal`) e o tutorial (`WalkthroughModal`) não abrem para o professor. As novidades continuam no sino.
  - O comentário de `audience` em `src/lib/announcements.js` diz isso.
  - O menu da conta mostra "Professor" como papel.
```

- [ ] **Step 6: Proteção de erro e ponte com o Stronizap**

Em `## Proteção de erro fora do conteúdo`:

```markdown
- Em "Proteção de erro fora do conteúdo", tópico "Ainda sem proteção própria": acrescentar a `ProfessorAccessOffScreen` junto da `TenantBlockedScreen` e da `TrialActivationScreen`. Ela não pode levar `ScreenErrorBoundary`, porque o `protecaoDeErro.sweep.test.js` conta toda `ScreenErrorBoundary` do `App.jsx` como tela sem sessão.
- O `src/lib/__tests__/professorShell.test.js` lê o `App.jsx` e cobra cinco ligações:
  - o aviso de acesso desligado no lugar certo;
  - cada item do menu pelo `nav`;
  - os chamados pela permissão do Suporte;
  - o placeholder na Meta diária;
  - o `isSeller` no selo e nas duas consultas.
```

Em `## Ponte com o Stronizap`, depois do parágrafo do agendamento:

```markdown
- Na "Ponte com o Stronizap", um parágrafo sobre o professor:
  - O `create-lead` e o `lead-options` recusam o professor com 403 `fora_da_equipe` e o texto `professorNoLead` (`signupRefusal`, por `ACTIONS.LEAD_CRIAR`).
  - A equipe do gestor e o dono escolhido passam pelo `isSeller`.
  - O professor agenda, com `countsForMeta: false`, e com o módulo desligado o `schedule-options` e o `schedule` o recusam com o texto `professorOff` (`scheduleRefusal`).
  - O `teamRole` manda o professor como `'consultor'`, porque o Stronizap só conhece gestor e consultor.
  - O `openByKey` devolve também o documento da academia.
  - O Stronizap não precisou de deploy, porque mostra a recusa como ela chega.
```

- [ ] **Step 7: Conferir**

Run: `grep -c "—" CLAUDE.md`
Expected: o mesmo número do Step 1.

Run: `grep -n -E "Decisão do Johnny, 02/10/2026" CLAUDE.md`
Expected: nenhuma linha. O D4 foi decidido no plano, e não pelo Johnny.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git -c user.name="Johnny Bittencourt" commit -m "docs: CLAUDE.md com os módulos da academia, o papel de professor e as travas dele" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Verificação completa

**Files:** nenhum, a não ser que algo falhe.

- [ ] **Step 1: Todos os testes**

Run: `npx vitest run 2>&1 | tail -5`
Expected: tudo passando, com `Test Files` e `Tests` maiores que os da Task 0 (Step 4) pela soma dos testes novos. Nenhum teste que passava na Task 0 pode falhar agora.

- [ ] **Step 2: As travas que cuidam do PR inteiro**

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/acessoImports.test.js src/lib/__tests__/teamRolesImports.test.js src/lib/__tests__/newLeadImports.test.js src/lib/__tests__/modules.test.js src/lib/__tests__/professorRules.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: PASS em todos.

- [ ] **Step 3: Nenhuma comparação de papel sobrou em `src/`**

Run: `grep -rn -E "role (===|!==|==|!=) '(admin|consultant|professor)'" src --include=*.js --include=*.jsx | grep -v "src/lib/acesso.js" | grep -v __tests__`
Expected: nenhuma linha.

- [ ] **Step 4: Lint**

Run: `npx eslint . 2>&1 | tail -3`
Expected: o total de problemas é menor ou igual ao da Task 0 (Step 5). Se aumentou, rode `npx eslint` nos arquivos do mapa e corrija o que este PR trouxe.

- [ ] **Step 5: Build**

Run: `npm run build 2>&1 | tail -15`
Expected: build sem erro. O ExcelJS continua num pedaço próprio (`exceljs`), e nenhum pedaço novo aparece com mais de 500 kB.

- [ ] **Step 6: Vazamento no Sentry**

Run: `npm run verificar:sentry`
Expected: passa, como no CI.

- [ ] **Step 7: Funções da Vercel**

Run: `ls api/*.js | grep -v "/_" | wc -l`
Expected: `11`. Nenhuma função nova.

Se algum passo falhar, corrija na task dona do arquivo, rode de novo os testes dela e faça um commit `fix: ...` antes de seguir.

### Task 14: PR, regras e o teste de verdade

**Files:** nenhum.

- [ ] **Step 1: Subir a branch**

Run: `git push -u origin claude/stronilead-dual-system-2a0e73`
Expected: a branch aparece no GitHub (`johnnychaves/crm-stronix`).

- [ ] **Step 2: Abrir o PR**

Escreva o corpo num arquivo do rascunho da sessão e abra o PR:

```bash
gh pr create --base main --title "feat: professor no Stronilead, módulo da STRONIX (PR 1)" --body-file <arquivo-do-corpo>
```

O corpo, em português e sem travessão, diz:
- o que muda: o módulo por academia, o papel Professor, a lista do que cada papel faz, as telas e a ficha do professor, a ponte do Stronizap e as regras;
- as decisões D1 a D11 e os pontos que dependem do Johnny, copiados deste plano;
- **antes do merge**, o Johnny publica as regras no console, depois de rodar os cenários do Playground da Task 11;
- a lista do teste no Preview (Step 4);
- a ordem depois do merge (Step 5);
- no fim, a linha `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Depois de abrir, ligue o PR à sessão pelas ferramentas do app (`get_status` e, se ele não aparecer, `bind_pr`) e leia o CI. Não agende nem fique consultando o CI por conta própria, e não ligue o auto-merge.

- [ ] **Step 3: Regras no console (Johnny)**

O Johnny cola o `firestore.rules` do PR no console do Firebase, roda os cenários do Playground listados na Task 11 e publica. Sem isso, o professor criado no Preview grava como consultor nas regras antigas, e o gestor ainda consegue gravar `role` pelo navegador.

- [ ] **Step 4: Teste no Preview, com academia de teste**

O Preview usa o Firebase de produção: só academia de teste, nunca a STRONIX.
1. No super console do Preview, ligar "Professor e faltosos" na academia de teste e ver no "Logs & auditoria" a linha da mudança.
2. Pelo "Acessar como", abrir Configurações → Equipe & acessos, cadastrar uma pessoa com o papel Professor ligada a um professor do cadastro e conferir a linha "1 professor com acesso, fora das vagas de consultor." na faixa de vagas. No super console, a página da academia mostra a linha "Professores (fora das vagas)".
3. Tentar trocar para Professor um consultor que tenha lead na carteira e ver a recusa do D2.
4. Entrar como o professor (o Johnny entra, porque a senha é dele) e conferir:
   - o menu só com Meta diária e Clientes;
   - `/<academia>/pipeline` mostrando "Essa tela não está liberada para o seu acesso." e levando à Meta diária;
   - a Meta com o aviso de que a lista de faltosos aparece depois da primeira importação;
   - a ficha de um cliente sem Mudar fase, lápis, Indicar e botões de contrato, com Anotação, WhatsApp, Ligação e Agendar funcionando;
   - a busca do topo achando só clientes;
   - o sino só com novidades.
5. Desligar o módulo, entrar de novo como o professor e ver só o aviso de acesso desligado.
6. Religar o módulo e ver que gestor e consultor da academia de teste não notaram diferença nenhuma.

- [ ] **Step 5: Depois do merge (Johnny)**

1. A Vercel publica o merge sozinha. Conferir o deploy de produção.
2. Contar na STRONIX os cadastros de equipe com id diferente do uid da conta (ponto 3 dos "Pontos que dependem do Johnny"). Cada pessoa que for virar professor e estiver nesse caso precisa ser excluída e cadastrada de novo.
3. O super-admin liga o módulo na STRONIX (`stronix-crm-app`) pelo console.
4. O gestor cria os logins dos professores.
5. Atualizar, no repositório STRONIX-FIRMA (fora deste repositório), a tabela "Últimas Atualizações" do `CLAUDE.md` raiz e o `06-sistemas/CLAUDE.md`. Na seção "Ponte Stronilead ↔ Stronizap" deste, entra o texto abaixo:

```markdown
- No `06-sistemas/CLAUDE.md`, seção "Ponte Stronilead ↔ Stronizap": uma linha dizendo que o professor do Stronilead não cadastra lead pela ponte, não aparece como consultor responsável e agenda sem contar na Meta, tudo decidido no Stronilead.
- Na tabela de arquivos do contrato da ponte, nada muda: o formato da resposta é o mesmo, só há recusas novas com o código que já existia.
```

## Fora deste plano

- O PR 2 (as importações dos relatórios da Next Fit, a aba Faltosos, a aba Presenças e o selo da ficha) e o PR 3 (a Meta do professor, o "Registrar contato", o "Já voltou" e o aviso de "Quer cancelar"), com planos próprios.
- O botão que abre a conversa no Stronizap, com spec própria.
- A tela para editar perfis de acesso.
- Restringir o que o professor lê. As regras deste PR travam só escrita. Pelo SDK, ele lê leads, contratos e interações como o consultor.
- Cortar as assinaturas que o professor ainda faz (leads ativos, interações do mês). Fica para o PR 3, com a Meta dele.
- As regras do Storage da foto do lead, que moram só no console.
- Apagar o `src/views/dashboard/useTeamGoals.js`, que ninguém importa. Este PR só o ajusta para a varredura passar.
- Artigos da Central de ajuda para o professor e o título "Sua Meta Diária" do cabeçalho, que o PR 3 troca.
- Proteção de erro própria para a tela de acesso desligado, junto da tarefa já registrada para as telas de bloqueio.
