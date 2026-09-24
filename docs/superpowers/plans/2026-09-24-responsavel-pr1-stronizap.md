# Responsável do menor, PR 1 (Stronizap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Stronizap passa a entender o cartão do tipo "responsável" e a lista `wards` que o Stronilead vai mandar, sem mudar nada na tela enquanto o CRM ainda não manda.

**Architecture:** O cartão continua vindo pronto do CRM e o Stronizap só renderiza. Os dois espelhos do contrato (`backend/src/services/crm.service.ts` e `frontend/src/types/crm.ts`) ganham `kind: 'responsavel'`, `wards` e o tipo `CrmWard`. As regras de texto viram funções puras em `frontend/src/types/crm.ts`, testadas sem React, e os dois componentes do cartão passam a usá-las. O smoke do cartão aprende o formato novo.

**Tech Stack:** TypeScript, React 18, Vite, Vitest com jsdom (front), `node:test` com tsx (back).

**Spec:** `stronilead/docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md`, seção "Ponte com o Stronizap". Este PR entra ANTES do PR do Stronilead: se o CRM subir primeiro, o Stronizap de hoje mostra a mãe com a etiqueta "Cliente".

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronizap` (remoto `whatsapp-stronix`). Todos os caminhos abaixo são relativos à raiz desse repositório, dentro do worktree criado na Task 0.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `frontend/src/types/crm.ts` | `CrmWard`, `kind: 'responsavel'`, `wards`, `crmStatus` do tipo novo, e as funções puras `crmWardNames` e `crmHeaderText` |
| `frontend/src/types/crm.test.ts` (novo) | testes das funções puras |
| `frontend/src/components/CrmHeaderMeta.tsx` | troca a função local `textoDoEstado` por `crmHeaderText` |
| `frontend/src/components/CrmCardSection.tsx` | seção "Responsável por" com um bloco por menor |
| `frontend/src/components/CrmCardSection.test.tsx` (novo) | render do cartão com e sem `wards` |
| `backend/src/services/crm.service.ts` | o mesmo `CrmWard`, `kind` e `wards` do espelho do front |
| `backend/src/services/crm-name.service.test.ts` | prova que o nome do contato vem do cartão do responsável |
| `backend/src/scripts/smoke-crm-card.ts` | lista fechada ganha `wards`, aceita o tipo responsável e confere cada menor |
| `CLAUDE.md` | parágrafo do responsável na seção da ponte |

---

### Task 0: Worktree e ponto de partida

**Files:** nenhum

- [ ] **Step 1: Criar o worktree a partir da main atualizada**

```bash
cd ~/STRONIX-FIRMA/06-sistemas/stronizap
git fetch origin
git worktree add .claude/worktrees/responsavel-do-menor -b claude/responsavel-do-menor origin/main
cd .claude/worktrees/responsavel-do-menor
```

- [ ] **Step 2: Instalar e conferir que a base está verde**

```bash
(cd backend && npm ci) && (cd frontend && npm ci)
(cd frontend && npm test && npm run typecheck)
(cd backend && npm test && npm run typecheck)
```

Expected: tudo verde. Se algo falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: Tipos e funções puras do cartão (front)

**Files:**
- Modify: `frontend/src/types/crm.ts`
- Create: `frontend/src/types/crm.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/types/crm.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import type { CrmCard, CrmWard } from './crm';
import { crmHeaderText, crmStatus, crmWardNames } from './crm';

const menor = (name: string | null, extra: Partial<CrmWard> = {}): CrmWard => ({
  leadId: `id-${name ?? 'x'}`,
  kind: 'lead',
  name,
  relationship: 'Mãe',
  consultantName: 'Bruno',
  strip: null,
  appointment: null,
  ...extra,
});

describe('crmStatus', () => {
  test('o tipo responsável vira a etiqueta Responsável, no tom neutro', () => {
    const card: CrmCard = { found: true, kind: 'responsavel', name: 'Maria', wards: [menor('Pedro')] };
    expect(crmStatus(card)).toEqual({ key: 'neutro', label: 'Responsável' });
  });

  test('lead e cliente continuam como antes', () => {
    expect(crmStatus({ found: true, kind: 'lead' })).toEqual({ key: 'lead', label: 'Lead' });
    expect(crmStatus({ found: true, kind: 'cliente', contractStatus: 'ativo' })).toEqual({ key: 'ativo', label: 'Ativo' });
    expect(crmStatus({ found: false })).toEqual({ key: 'neutro', label: 'Sem cadastro' });
  });

  test('um menor passa pelo mesmo crmStatus quando vira cartão', () => {
    const w = menor('Pedro', { kind: 'cliente', contractStatus: 'a_vencer' });
    expect(crmStatus({ found: true, ...w })).toEqual({ key: 'avencer', label: 'A vencer' });
  });
});

describe('crmWardNames', () => {
  test('sem menores, texto vazio', () => {
    expect(crmWardNames([])).toBe('');
    expect(crmWardNames(undefined)).toBe('');
    expect(crmWardNames([menor(null)])).toBe('');
  });

  test('um, dois e três menores', () => {
    expect(crmWardNames([menor('Pedro')])).toBe('Pedro');
    expect(crmWardNames([menor('Pedro'), menor('Ana')])).toBe('Pedro e Ana');
    expect(crmWardNames([menor('Pedro'), menor('Ana'), menor('Lia')])).toBe('Pedro, Ana +1');
  });

  test('menor sem nome entra no +N e não aparece', () => {
    expect(crmWardNames([menor('Pedro'), menor(null)])).toBe('Pedro +1');
  });
});

describe('crmHeaderText', () => {
  test('responsável: "Responsável por" e os nomes', () => {
    const card: CrmCard = { found: true, kind: 'responsavel', name: 'Maria', wards: [menor('Pedro'), menor('Ana')] };
    expect(crmHeaderText(card, 'Responsável')).toBe('Responsável por Pedro e Ana');
  });

  test('responsável sem nome de menor cai na etiqueta', () => {
    const card: CrmCard = { found: true, kind: 'responsavel', name: 'Maria', wards: [menor(null)] };
    expect(crmHeaderText(card, 'Responsável')).toBe('Responsável');
  });

  test('lead, cliente e sem cadastro seguem o texto de hoje', () => {
    expect(crmHeaderText({ found: false }, 'Sem cadastro')).toBe('Sem cadastro');
    expect(crmHeaderText({ found: true, kind: 'lead', stage: 'Negociação', consultantName: 'Bruno' }, 'Lead'))
      .toBe('Lead · Negociação · Bruno');
    expect(crmHeaderText({ found: true, kind: 'cliente', daysLeft: 0 }, 'Ativo')).toBe('Ativo · vence hoje');
    expect(crmHeaderText({ found: true, kind: 'cliente', daysLeft: -1 }, 'Vencido')).toBe('Vencido · 1 dia em atraso');
    expect(crmHeaderText({ found: true, kind: 'cliente', daysLeft: 12 }, 'Ativo')).toBe('Ativo · 12 dias');
    expect(crmHeaderText({ found: true, kind: 'cliente', daysLeft: null }, 'Ativo')).toBe('Ativo');
  });

  test('cliente que também é responsável mostra o próprio estado, não os menores', () => {
    const card: CrmCard = { found: true, kind: 'cliente', daysLeft: 12, wards: [menor('Pedro')] };
    expect(crmHeaderText(card, 'Ativo')).toBe('Ativo · 12 dias');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/types/crm.test.ts`
Expected: FAIL, porque `crmWardNames` e `crmHeaderText` não existem.

- [ ] **Step 3: Implementar em `frontend/src/types/crm.ts`**

Logo depois de `export interface CrmStrip { ... }`, acrescentar:

```ts
/**
 * Menor de idade que tem este telefone como responsável. É o cartão do menor,
 * montado pelo CRM do mesmo jeito que o de qualquer lead, sem `found` e sem
 * `wards`, mais o parentesco de quem responde por ele ("Mãe", "Avô"...).
 */
export interface CrmWard {
  leadId?: string | null;
  kind?: 'cliente' | 'lead';
  name?: string | null;
  relationship?: string | null;
  consultantName?: string | null;
  lastInteractionAt?: string | null;
  appointment?: { type: string; at: string } | null;
  strip?: CrmStrip | null;
  planName?: string | null;
  contractStatus?: string | null;
  contractEndsAt?: string | null;
  daysLeft?: number | null;
  stage?: string | null;
  source?: string | null;
}
```

Em `export interface CrmCard`, trocar a linha do `kind`:

```ts
  kind?: 'cliente' | 'lead' | 'responsavel';
```

E acrescentar no fim da interface, depois de `source`:

```ts
  /**
   * Menores que têm este telefone como responsável. Vem no cartão de quem tem
   * cadastro próprio e é a única coisa que o tipo responsável traz além do nome.
   */
  wards?: CrmWard[];
```

Em `crmStatus`, acrescentar a linha do responsável antes da do lead:

```ts
export function crmStatus(card: CrmCard | null): { key: CrmStatusKey; label: string } {
  if (!card || !card.found) return { key: 'neutro', label: 'Sem cadastro' };
  if (card.kind === 'responsavel') return { key: 'neutro', label: 'Responsável' };
  if (card.kind === 'lead') return { key: 'lead', label: 'Lead' };
  const conhecida = card.contractStatus ? SITUACAO_CONTRATO[card.contractStatus] : undefined;
  return conhecida ?? { key: 'neutro', label: 'Cliente' };
}
```

No fim do arquivo, acrescentar:

```ts
/**
 * Nomes dos menores numa linha só: "Pedro", "Pedro e Ana" ou "Pedro, Ana +1".
 * Menor sem nome conta no +N, mas não aparece.
 */
export function crmWardNames(wards: CrmWard[] | null | undefined): string {
  const lista = wards ?? [];
  const nomes = lista.map((w) => (w.name ?? '').trim()).filter(Boolean);
  if (nomes.length === 0) return '';
  if (lista.length === 1) return nomes[0];
  if (lista.length === 2 && nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  const mostrados = nomes.slice(0, 2);
  const resto = lista.length - mostrados.length;
  return resto > 0 ? `${mostrados.join(', ')} +${resto}` : mostrados.join(' e ');
}

/**
 * Texto do item do CRM na linha de meta do header da conversa. Quem tem
 * cadastro próprio mostra o próprio estado, mesmo sendo responsável de alguém:
 * os menores aparecem no painel do contato.
 */
export function crmHeaderText(card: CrmCard, label: string): string {
  if (!card.found) return label;

  if (card.kind === 'responsavel') {
    const nomes = crmWardNames(card.wards);
    return nomes ? `Responsável por ${nomes}` : label;
  }

  if (card.kind === 'lead') {
    return ['Lead', card.stage, card.consultantName].filter(Boolean).join(' · ');
  }

  const dias = card.daysLeft;
  if (dias === null || dias === undefined) return label;
  if (dias === 0) return `${label} · vence hoje`;
  if (dias < 0) {
    const n = Math.abs(dias);
    return `${label} · ${n} ${n === 1 ? 'dia' : 'dias'} em atraso`;
  }
  return `${label} · ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/types/crm.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/crm.ts frontend/src/types/crm.test.ts
git commit -m "feat: cartão do CRM aceita o tipo responsável e a lista de menores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Header da conversa usa a função pura

**Files:**
- Modify: `frontend/src/components/CrmHeaderMeta.tsx`

- [ ] **Step 1: Trocar a função local pela de `types/crm.ts`**

Trocar as duas linhas de import de `../types/crm`:

```ts
import type { CrmCard } from '../types/crm';
import { crmStatus } from '../types/crm';
```

por uma só:

```ts
import { crmHeaderText, crmStatus } from '../types/crm';
```

No corpo do componente, trocar:

```ts
  const texto = textoDoEstado(card, status.label);
```

por:

```ts
  const texto = crmHeaderText(card, status.label);
```

Apagar a função `textoDoEstado` inteira do fim do arquivo. Para lead e cliente, `crmHeaderText` produz o mesmo texto (os testes da Task 1 cobrem esses casos).

- [ ] **Step 2: Conferir tipos e testes**

Run: `cd frontend && npm run typecheck && npx vitest run src/types/crm.test.ts`
Expected: sem erro de tipo e testes verdes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CrmHeaderMeta.tsx
git commit -m "refactor: texto do CRM no header sai de crmHeaderText

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Seção "Responsável por" no painel do contato

**Files:**
- Modify: `frontend/src/components/CrmCardSection.tsx`
- Create: `frontend/src/components/CrmCardSection.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/CrmCardSection.test.tsx` (mesmo molde do `RewriteBar.test.tsx`, sem testing-library):

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { CrmCard } from '../types/crm';
import { CrmCardSection } from './CrmCardSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const texto = () => container.textContent ?? '';

describe('CrmCardSection', () => {
  test('responsável: etiqueta Responsável e um bloco por menor, com parentesco, fase, plano, consultor e faixa', () => {
    const card: CrmCard = {
      found: true,
      kind: 'responsavel',
      name: 'Maria',
      wards: [
        {
          leadId: 'a',
          kind: 'lead',
          name: 'Pedro',
          relationship: 'Mãe',
          stage: 'Negociação',
          consultantName: 'Bruno',
          strip: { kind: 'aula_hoje', tone: 'agendado', text: 'Aula experimental hoje às 18:00' },
          appointment: null,
        },
        {
          leadId: 'b',
          kind: 'cliente',
          name: 'Ana',
          relationship: 'Mãe',
          contractStatus: 'ativo',
          planName: 'Kids 12 meses',
          consultantName: 'Carla',
          strip: null,
          appointment: null,
        },
      ],
    };
    act(() => root.render(<CrmCardSection card={card} />));

    expect(texto()).toContain('Responsável por');
    expect(texto()).toContain('Pedro');
    expect(texto()).toContain('Negociação');
    expect(texto()).toContain('Bruno');
    expect(texto()).toContain('Aula experimental hoje às 18:00');
    expect(texto()).toContain('Ana');
    expect(texto()).toContain('Kids 12 meses');
    expect(texto()).toContain('Ativo');
    expect(texto()).toContain('Mãe');
    expect(container.querySelectorAll('[data-crm-ward]').length).toBe(2);
    // O tipo responsável não tem fase, origem nem plano próprios.
    expect(texto()).not.toContain('Origem');
  });

  test('cliente que também é responsável: dados dele e, embaixo, os menores', () => {
    const card: CrmCard = {
      found: true,
      kind: 'cliente',
      name: 'Maria',
      contractStatus: 'ativo',
      planName: 'Musculação anual',
      consultantName: 'Carla',
      strip: null,
      appointment: null,
      wards: [{ leadId: 'a', kind: 'lead', name: 'Pedro', relationship: 'Mãe', stage: 'Novo', strip: null, appointment: null }],
    };
    act(() => root.render(<CrmCardSection card={card} />));

    expect(texto()).toContain('Musculação anual');
    expect(texto()).toContain('Responsável por');
    expect(texto()).toContain('Pedro');
    expect(container.querySelectorAll('[data-crm-ward]').length).toBe(1);
  });

  test('cartão sem wards fica igual a hoje', () => {
    const card: CrmCard = { found: true, kind: 'lead', name: 'João', stage: 'Novo', source: 'Instagram', strip: null, appointment: null };
    act(() => root.render(<CrmCardSection card={card} />));

    expect(texto()).toContain('Instagram');
    expect(texto()).not.toContain('Responsável por');
    expect(container.querySelectorAll('[data-crm-ward]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmCardSection.test.tsx`
Expected: FAIL nos dois primeiros testes ("Responsável por" não aparece). O terceiro já passa.

- [ ] **Step 3: Implementar em `frontend/src/components/CrmCardSection.tsx`**

Trocar os imports do topo por:

```tsx
import type { CrmCard, CrmStrip, CrmWard } from '../types/crm';
import { crmStatus, crmToneKey, crmToneStyle } from '../types/crm';
import { StronileadLockup } from './StronileadMark';
```

No JSX de `CrmCardSection`, logo depois do bloco `{lead && (...)}` e antes do `</div>` que fecha o `px-5 py-4`, acrescentar:

```tsx
      {card.found && card.wards && card.wards.length > 0 && <WardsSection wards={card.wards} />}
```

O tipo responsável não entra em `cliente` nem em `lead`, então para ele só essa seção aparece.

Logo depois da função `CrmStripBand`, acrescentar:

```tsx
/**
 * Menores que têm este telefone como responsável. Cada um vem pronto do CRM
 * e passa pela mesma regra de status do cartão principal.
 */
function WardsSection({ wards }: { wards: CrmWard[] }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>
        Responsável por
      </p>
      {wards.map((ward, i) => (
        <WardItem key={ward.leadId ?? i} ward={ward} />
      ))}
    </div>
  );
}

function WardItem({ ward }: { ward: CrmWard }) {
  const status = crmStatus({ found: true, ...ward });
  const cliente = ward.kind === 'cliente';
  return (
    <div
      data-crm-ward=""
      className="space-y-1.5 rounded-lg px-3 py-2 text-xs"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium" style={{ color: 'var(--ink)' }} title={ward.name ?? undefined}>
          {ward.name || 'Sem nome'}
        </span>
        <span
          className="inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={crmToneStyle(status.key)}
        >
          {status.label}
        </span>
      </div>
      <DataRow label="Parentesco" value={ward.relationship} />
      {cliente ? (
        <>
          <DataRow label="Plano" value={ward.planName} />
          <DataRow label="Vence em" value={formatarData(ward.contractEndsAt)} mono />
        </>
      ) : (
        <DataRow label="Fase" value={ward.stage} />
      )}
      <DataRow label="Consultor" value={ward.consultantName} />
      <DataRow label="Agendamento" value={formatarAgendamento(ward.appointment)} mono />
      {ward.strip && (
        <p
          className="rounded-md px-2 py-1 text-[11.5px] font-medium"
          style={crmToneStyle(crmToneKey(ward.strip.tone))}
        >
          {ward.strip.text}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmCardSection.test.tsx && npm run typecheck`
Expected: PASS nos três testes e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CrmCardSection.tsx frontend/src/components/CrmCardSection.test.tsx
git commit -m "feat: painel do contato mostra os menores de quem é responsável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Espelho do backend e nome do contato

**Files:**
- Modify: `backend/src/services/crm.service.ts` (interfaces `CrmStrip` e `CrmCard`, no topo)
- Modify: `backend/src/services/crm-name.service.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `backend/src/services/crm-name.service.test.ts`, logo depois do teste `'nome: corta em 120 caracteres sem partir emoji ao meio'`, acrescentar:

```ts
test('nome: o cartão do responsável dá o nome da própria responsável, não o do menor', () => {
  const card: CrmCard = {
    found: true,
    kind: 'responsavel',
    name: 'Maria Souza',
    wards: [{ leadId: 'a', kind: 'lead', name: 'Pedro Souza', relationship: 'Mãe', strip: null, appointment: null }],
  };
  assert.equal(nomeDoCartao(card), 'Maria Souza');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com erro de tipo em `crm-name.service.test.ts`: `'responsavel'` não é atribuível ao `kind`, e `wards` não existe em `CrmCard`.

- [ ] **Step 3: Implementar em `backend/src/services/crm.service.ts`**

Logo depois de `export interface CrmStrip { ... }`, acrescentar:

```ts
/**
 * Menor de idade que tem este telefone como responsável. Espelho de
 * `frontend/src/types/crm.ts`: o cartão do menor sem `found` e sem `wards`,
 * mais o parentesco de quem responde por ele.
 */
export interface CrmWard {
  leadId?: string | null;
  kind?: 'cliente' | 'lead';
  name?: string | null;
  relationship?: string | null;
  consultantName?: string | null;
  lastInteractionAt?: string | null;
  appointment?: { type: string; at: string } | null;
  strip?: CrmStrip | null;
  planName?: string | null;
  contractStatus?: string | null;
  contractEndsAt?: string | null;
  daysLeft?: number | null;
  stage?: string | null;
  source?: string | null;
}
```

Em `export interface CrmCard`, trocar a linha do `kind`:

```ts
  kind?: 'cliente' | 'lead' | 'responsavel';
```

E acrescentar depois de `source?: string | null;`:

```ts
  wards?: CrmWard[];
```

`nomeDoCartao` não muda: ela já lê `card.name`, que no tipo responsável é o nome da mãe ou do pai.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm run typecheck && npm test`
Expected: typecheck limpo e a suíte inteira verde, com o teste novo.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm-name.service.test.ts
git commit -m "feat: espelho do cartão no backend aceita o tipo responsável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Smoke do cartão aprende o formato novo

**Files:**
- Modify: `backend/src/scripts/smoke-crm-card.ts`

O smoke roda contra o CRM de verdade e não entra no `npm test`. Hoje ele reprova campo fora da lista fechada e só aceita `kind` cliente ou lead. Sem esta task, ele reprova o primeiro número de mãe que alguém testar.

- [ ] **Step 1: Lista fechada do cartão e do menor**

Em `CAMPOS_CONHECIDOS_DO_CARTAO`, acrescentar `'wards'` depois de `'source'`. Logo abaixo do `Set`, acrescentar:

```ts
/**
 * Lista FECHADA de cada item de `wards`: o cartão do menor sem `found` e sem
 * `wards`, mais o parentesco. Mesma propriedade de segurança do cartão.
 */
const CAMPOS_CONHECIDOS_DO_MENOR = new Set([
  ...[...CAMPOS_CONHECIDOS_DO_CARTAO].filter((c) => c !== 'found' && c !== 'wards'),
  'relationship',
]);
```

- [ ] **Step 2: `campo` recebe o rótulo de quem está sendo conferido**

Trocar a função `campo` por:

```ts
/** Campo presente no objeto e com o tipo combinado. Ausente já é falha. */
function campo(
  card: Record<string, unknown>,
  nome: string,
  tipo: string,
  valida: (v: unknown) => boolean,
  quem = 'cartão',
) {
  const presente = Object.prototype.hasOwnProperty.call(card, nome);
  check(
    `${quem} tem ${nome} (${tipo})`,
    presente && valida(card[nome]),
    presente ? `veio ${JSON.stringify(card[nome])}` : 'campo ausente',
  );
}
```

- [ ] **Step 3: Separar a conferência de uma pessoa (cartão ou menor)**

Substituir a função `conferirCartao` inteira por estas duas. Os blocos de cliente, lead, `strip` e `appointment` saem de `conferirCartao` para `conferirPessoa`, iguais aos de hoje, só com `quem` nas mensagens:

```ts
function conferirCartao(card: CrmCard) {
  console.log('\n[3] campos do cartão');

  const bruto = card as unknown as Record<string, unknown>;

  const inesperados = Object.keys(bruto).filter((k) => !CAMPOS_CONHECIDOS_DO_CARTAO.has(k));
  check(
    'cartão não tem campo fora da lista fechada (sem CPF, endereço, valor de contrato, situação de pagamento)',
    inesperados.length === 0,
    inesperados,
  );

  check('found é boolean', typeof card.found === 'boolean', card.found);
  if (card.found !== true) {
    nota('cartão veio com found false: o CRM não achou esse telefone.');
    return false;
  }

  if (card.kind === 'responsavel') {
    // O tipo responsável é só o nome de quem responde e a lista dos menores.
    campo(bruto, 'name', 'texto ou null', ehTextoOuNulo);
    check(
      'responsável tem wards com pelo menos um menor',
      Array.isArray(card.wards) && card.wards.length > 0,
      card.wards,
    );
  } else {
    check("kind é 'cliente' ou 'lead'", card.kind === 'cliente' || card.kind === 'lead', card.kind);
    conferirPessoa(bruto, 'cartão');
    if (Object.prototype.hasOwnProperty.call(bruto, 'wards')) {
      check('wards é lista', Array.isArray(card.wards), card.wards);
    }
  }

  (Array.isArray(card.wards) ? card.wards : []).forEach((ward, i) => {
    const quem = `wards[${i}]`;
    const w = ward as unknown as Record<string, unknown>;
    const foraDaLista = Object.keys(w).filter((k) => !CAMPOS_CONHECIDOS_DO_MENOR.has(k));
    check(`${quem} não tem campo fora da lista fechada`, foraDaLista.length === 0, foraDaLista);
    check(`${quem}: kind é 'cliente' ou 'lead'`, ward.kind === 'cliente' || ward.kind === 'lead', ward.kind);
    campo(w, 'relationship', 'texto ou null', ehTextoOuNulo, quem);
    conferirPessoa(w, quem);
  });

  return true;
}

/** Campos de quem tem cadastro: o cartão principal ou um menor de `wards`. */
function conferirPessoa(bruto: Record<string, unknown>, quem: string) {
  const kind = bruto.kind;
  campo(bruto, 'name', 'texto ou null', ehTextoOuNulo, quem);
  campo(bruto, 'consultantName', 'texto ou null', ehTextoOuNulo, quem);

  if (kind === 'cliente') {
    campo(bruto, 'planName', 'texto ou null', ehTextoOuNulo, quem);
    campo(bruto, 'contractStatus', 'texto ou null', ehTextoOuNulo, quem);
    campo(bruto, 'contractEndsAt', 'texto ou null', ehTextoOuNulo, quem);
    campo(bruto, 'daysLeft', 'número ou null', ehNumeroOuNulo, quem);
    if (typeof bruto.contractEndsAt === 'string') {
      check(
        `${quem}: contractEndsAt é data que o navegador consegue ler`,
        !Number.isNaN(Date.parse(bruto.contractEndsAt)),
        bruto.contractEndsAt,
      );
    }
  }

  if (kind === 'lead') {
    campo(bruto, 'stage', 'texto ou null', ehTextoOuNulo, quem);
    campo(bruto, 'source', 'texto ou null', ehTextoOuNulo, quem);
  }

  // A chave precisa existir no objeto, preenchida ou `null` — `_zapCard.js`
  // sempre grava as duas. Confere isso com `hasOwnProperty` antes de olhar o
  // conteúdo: se o CRM renomear `strip`, cair aqui dentro do `if` com o valor
  // `undefined` passaria batido, igual a "sem strip". Rename tem que reprovar.
  const temStrip = Object.prototype.hasOwnProperty.call(bruto, 'strip');
  check(`${quem} tem a chave strip (objeto ou null)`, temStrip, bruto.strip);
  if (temStrip && bruto.strip !== null && bruto.strip !== undefined) {
    const faixa = bruto.strip as Record<string, unknown>;
    check(`${quem}: strip.kind é texto`, typeof faixa.kind === 'string' && faixa.kind !== '', faixa.kind);
    check(
      `${quem}: strip.tone é 'agendado', 'avencer', 'vencido' ou 'neutro'`,
      typeof faixa.tone === 'string' && TONS_ACEITOS.includes(faixa.tone),
      faixa.tone,
    );
    check(`${quem}: strip.text é texto`, typeof faixa.text === 'string' && faixa.text !== '', faixa.text);
    if (typeof faixa.kind === 'string' && !KINDS_DE_FAIXA.includes(faixa.kind)) {
      nota(`${quem}: strip.kind "${faixa.kind}" é novo por aqui. Vale conferir se a tela sabe desenhar.`);
    }
  } else if (temStrip) {
    nota(`${quem} sem strip: nenhum prazo curto pra destacar.`);
  }

  const temAppointment = Object.prototype.hasOwnProperty.call(bruto, 'appointment');
  check(`${quem} tem a chave appointment (objeto ou null)`, temAppointment, bruto.appointment);
  if (temAppointment && bruto.appointment !== null && bruto.appointment !== undefined) {
    const ag = bruto.appointment as Record<string, unknown>;
    check(`${quem}: appointment.type é texto`, typeof ag.type === 'string', ag.type);
    check(
      `${quem}: appointment.at é data que o navegador consegue ler`,
      typeof ag.at === 'string' && !Number.isNaN(Date.parse(ag.at)),
      ag.at,
    );
  }
}
```

- [ ] **Step 4: A varredura de nome de credencial desce nos menores**

`chavesAninhadas` não desce em arrays. Trocar por:

```ts
/** Nomes de campo, recursivamente, de um objeto (desce em objetos e arrays). */
function chavesAninhadas(valor: unknown, achadas: string[] = []): string[] {
  if (Array.isArray(valor)) {
    for (const item of valor) chavesAninhadas(item, achadas);
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      achadas.push(k);
      chavesAninhadas(v, achadas);
    }
  }
  return achadas;
}
```

No `check` de `conferirVazamentoDaChave`, trocar o texto "(incluindo dentro de strip e appointment)" por "(incluindo dentro de strip, appointment e wards)". No comentário acima da função, trocar "desce dentro de `strip` e `appointment`" por "desce dentro de `strip`, `appointment` e `wards`".

- [ ] **Step 5: O resumo mostra os menores**

Em `resumo`, trocar o cálculo de `situacao` por:

```ts
  const situacao =
    card.kind === 'responsavel'
      ? 'responsável, sem cadastro próprio'
      : card.kind === 'cliente'
        ? [card.contractStatus, card.planName].filter(Boolean).join(' · ') || 'sem situação'
        : [card.stage, card.source].filter(Boolean).join(' · ') || 'sem etapa';
```

E, depois da linha que imprime a faixa (`if (card.strip) console.log(...)`), acrescentar:

```ts
  for (const w of card.wards ?? []) {
    const onde = w.kind === 'cliente' ? w.contractStatus : w.stage;
    console.log(`  menor:     ${w.name ?? '(sem nome)'} · ${w.relationship ?? 'sem parentesco'} · ${w.kind} · ${onde ?? '-'}`);
  }
```

- [ ] **Step 6: Conferir tipos**

Run: `cd backend && npm run typecheck`
Expected: limpo. O smoke de verdade só roda com o PR do Stronilead no ar (Task 7).

- [ ] **Step 7: Commit**

```bash
git add backend/src/scripts/smoke-crm-card.ts
git commit -m "chore: smoke do cartão confere o tipo responsável e cada menor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Documentação e verificação final

**Files:**
- Modify: `CLAUDE.md` (seção da ponte com o Stronilead)

- [ ] **Step 1: Parágrafo novo no `CLAUDE.md`**

Logo depois do parágrafo que começa com "**Cobertura do CRM.**", acrescentar:

```markdown
**Responsável do menor.** Quando o número é de quem responde por um menor de idade cadastrado no Stronilead, o cartão chega com `kind: 'responsavel'`, o nome do responsável e a lista `wards`, com um cartão por menor: o cartão de lead ou de cliente de sempre, sem `found`, mais `relationship`. Quem tem cadastro próprio e também é responsável recebe o próprio cartão com `wards` junto. O header mostra "Responsável por Pedro e Ana" (`crmHeaderText`) e o painel ganha a seção "Responsável por" (`CrmCardSection`). O nome do contato continua saindo de `card.name`, que no tipo responsável é o nome da mãe ou do pai, e não o do filho. Quem decide quem é menor é o CRM: este lado não calcula idade. O smoke do cartão confere cada menor com a mesma lista fechada. Spec em `stronilead/docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md`.
```

- [ ] **Step 2: Suíte inteira dos dois lados**

```bash
(cd frontend && npm test && npm run typecheck && npm run build)
(cd backend && npm test && npm run typecheck)
```

Expected: tudo verde.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: cartão do responsável na seção da ponte com o Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: PR e ordem de entrada

- [ ] **Step 1: Abrir o PR**

```bash
git push -u origin claude/responsavel-do-menor
gh pr create --title "feat: cartão do responsável do menor (Stronilead)" --body "$(cat <<'EOF'
Prepara o Stronizap para o cartão do tipo responsável que o Stronilead vai mandar.

- `kind: 'responsavel'` e a lista `wards` nos dois espelhos do contrato
- header: "Responsável por Pedro e Ana"
- painel do contato: seção "Responsável por", um bloco por menor
- o nome do contato continua vindo de `card.name`, que passa a ser o da mãe
- o smoke do cartão confere o tipo novo e cada menor

Sem o PR do Stronilead no ar, nada muda na tela. Este entra ANTES dele.

Spec: `stronilead/docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Com este PR e o do Stronilead no ar, rodar o smoke com um número de mãe de teste**

```bash
cd backend && npx tsx src/scripts/smoke-crm-card.ts <telefone-da-mae> stronix-crm-app
```

Expected: nenhuma reprovação. O resumo mostra "responsável, sem cadastro próprio" e uma linha "menor:" para cada filho.
