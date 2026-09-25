# Responsável do menor, PR 2 (Stronilead) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead menor de idade ganha um responsável (nome, telefone, parentesco), que vira o contato em toda a aplicação e no cartão do Stronizap, até a pessoa fazer 18 anos.

**Architecture:** Uma regra pura, `src/lib/guardian.js`, decide quem é menor agora e quem o consultor chama (`contactOf`). A tela, as listas, a busca e a `api/` usam só ela. O responsável fica no próprio documento do lead, com três campos derivados para busca e para o Stronizap, gravados por `buildGuardianPatch` só onde o responsável muda. A rota `api/zap.js` passa a procurar também os menores daquele telefone e devolve o cartão do tipo `responsavel` ou o cartão do dono com `wards`.

**Tech Stack:** React 19, Vite, Tailwind v4, Firebase (Firestore), Vercel serverless (`api/`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md`.

**Ordem:** o PR 1 (Stronizap, plano `2026-09-24-responsavel-pr1-stronizap.md`) precisa estar em produção ANTES do merge deste. Sem ele, o Stronizap mostra a mãe com a etiqueta "Cliente".

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronilead`, no worktree `.claude/worktrees/confident-ramanujan-6812a9`. Caminhos relativos à raiz do worktree.

**Regras do projeto que valem aqui** (do `CLAUDE.md`):
- nenhum arquivo de `api/` importa `src/lib/dailyGoal.js`, porque ele importa `lucide-react`;
- em `api/`, `snap.exists` é propriedade. Em `src/`, `snap.exists()` é função;
- código novo usa `cn()`, tokens semânticos (`text-muted-foreground`, `bg-card`...), `flex gap-*` e `size-N`;
- regras do Firestore não mudam neste PR (a coleção de leads não tem lista fechada de campos).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/guardian.js` (novo) | regra do menor, contato, links de WhatsApp e telefone, validação do bloco do responsável |
| `src/lib/phoneNotice.js` (novo) | texto dos avisos de telefone do cadastro e da edição |
| `src/hooks/useGuardianMatches.js` (novo) | consulta quem usa um telefone, como dono ou como responsável |
| `src/components/profile/ContactPhone.jsx` (novo) | telefone de contato com a marca "resp." |
| `src/lib/leadDerived.js` | `buildGuardianSearchFields` e `buildGuardianPatch` |
| `src/lib/clientRegistration.js` | leitura, gravação e validação do responsável na edição |
| `src/modals/AddLeadModal.jsx` | chave "Menor de idade" e campos no cadastro |
| `src/modals/ClientRegistrationModal.jsx` | chave e campos na aba Identidade |
| `src/views/LeadProfileView.jsx` | etiqueta, célula Contato, botões e aviso de 18 anos |
| `src/views/DailyGoalView.jsx` | cards e botões pelo contato |
| `src/views/LeadsView.jsx`, `ClientsView.jsx`, `AppointmentTrackingView.jsx` | telefone de contato nas listas e colunas novas no CSV |
| `src/lib/appointmentReport.js` | colunas novas no relatório |
| `src/lib/globalSearch.js`, `src/components/layout/GlobalSearch.jsx` | busca pelo telefone do responsável |
| `api/_zapCard.js`, `api/zap.js` | cartão do responsável e `wards`, e o `match` pelos dois campos |

---

### Task 0: Branch

**Files:** nenhum

- [ ] **Step 1: Criar a branch a partir da atual (que já tem a spec e os planos)**

```bash
cd ~/STRONIX-FIRMA/06-sistemas/stronilead/.claude/worktrees/confident-ramanujan-6812a9
git fetch origin
git rev-list --count HEAD..origin/main
```

Se o número for maior que zero, rode `git merge origin/main` antes de seguir.

```bash
git switch -c claude/responsavel-do-menor
npm test
```

Expected: suíte verde. Se falhar, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: Regra do menor (`src/lib/guardian.js`)

**Files:**
- Create: `src/lib/guardian.js`
- Test: `src/lib/__tests__/guardian.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/guardian.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  GUARDIAN_RELATIONSHIPS, adultSince, turnedAdult, isMinorNow, contactOf, contactLabel,
  firstName, whatsappHref, telHref, guardianIssue,
} from '../guardian.js';

const HOJE = new Date(2026, 8, 24, 10, 0);
const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const menor = (extra = {}) => ({
  name: 'Pedro Souza', whatsapp: '', isMinor: true, guardian: MAE, birthDate: new Date(2015, 4, 10), ...extra,
});

describe('adultSince', () => {
  it('é o aniversário de 18 anos, à meia-noite local', () => {
    expect(adultSince(new Date(2009, 2, 12))).toEqual(new Date(2027, 2, 12));
  });
  it('29 de fevereiro vira 1º de março em ano que não é bissexto', () => {
    expect(adultSince(new Date(2008, 1, 29))).toEqual(new Date(2026, 2, 1));
  });
  it('aceita Timestamp do Firestore e devolve null sem data', () => {
    expect(adultSince({ toDate: () => new Date(2009, 2, 12) })).toEqual(new Date(2027, 2, 12));
    expect(adultSince(null)).toBeNull();
  });
});

describe('turnedAdult e isMinorNow', () => {
  it('menor com data antes dos 18: é menor agora', () => {
    expect(isMinorNow(menor(), HOJE)).toBe(true);
    expect(turnedAdult(menor(), HOJE)).toBe(false);
  });
  it('sem data de nascimento: segue menor até alguém desligar', () => {
    expect(isMinorNow(menor({ birthDate: null }), HOJE)).toBe(true);
  });
  it('vira adulto no dia do aniversário, não antes', () => {
    const lead = menor({ birthDate: new Date(2008, 8, 24) });
    expect(turnedAdult(lead, new Date(2026, 8, 23, 23, 59))).toBe(false);
    expect(turnedAdult(lead, new Date(2026, 8, 24, 0, 0))).toBe(true);
    expect(isMinorNow(lead, new Date(2026, 8, 24, 0, 0))).toBe(false);
  });
  it('chave desligada ou sem telefone do responsável: não é menor', () => {
    expect(isMinorNow(menor({ isMinor: false }), HOJE)).toBe(false);
    expect(isMinorNow(menor({ guardian: { ...MAE, phone: '123' } }), HOJE)).toBe(false);
    expect(isMinorNow(menor({ guardian: null }), HOJE)).toBe(false);
  });
});

describe('contactOf', () => {
  it('menor: o contato é o responsável', () => {
    expect(contactOf(menor({ whatsapp: '(11) 9 5555-4444' }), HOJE)).toEqual({
      phone: MAE.phone, name: 'Maria Souza', relationship: 'Mãe', viaGuardian: true, missingOwnPhone: false,
    });
  });
  it('fez 18 sem WhatsApp próprio: segue o responsável, com o aviso', () => {
    const c = contactOf(menor({ birthDate: new Date(2008, 0, 1) }), HOJE);
    expect(c.viaGuardian).toBe(true);
    expect(c.missingOwnPhone).toBe(true);
  });
  it('fez 18 com WhatsApp próprio: o próprio lead', () => {
    const c = contactOf(menor({ birthDate: new Date(2008, 0, 1), whatsapp: '(11) 9 5555-4444' }), HOJE);
    expect(c).toEqual({ phone: '(11) 9 5555-4444', name: 'Pedro Souza', relationship: null, viaGuardian: false, missingOwnPhone: false });
  });
  it('adulto comum: o próprio lead, como hoje', () => {
    expect(contactOf({ name: 'Ana', whatsapp: '(51) 9 0000-1111' }, HOJE).phone).toBe('(51) 9 0000-1111');
    expect(contactOf(null, HOJE).phone).toBe('');
  });
});

describe('textos e links', () => {
  it('contactLabel: nome e parentesco em minúscula; Outro e vazio só o nome', () => {
    expect(contactLabel({ name: 'Maria Souza', relationship: 'Mãe' })).toBe('Maria Souza (mãe)');
    expect(contactLabel({ name: 'Maria Souza', relationship: 'Outro' })).toBe('Maria Souza');
    expect(contactLabel({ name: 'Maria Souza', relationship: null })).toBe('Maria Souza');
  });
  it('firstName', () => {
    expect(firstName('  Maria Souza ')).toBe('Maria');
    expect(firstName('')).toBe('');
  });
  it('whatsappHref põe o 55 em número de até 11 dígitos e codifica o texto', () => {
    expect(whatsappHref('(11) 9 1234-5678')).toBe('https://wa.me/5511912345678');
    expect(whatsappHref('5511912345678', 'Olá Maria')).toBe('https://wa.me/5511912345678?text=Ol%C3%A1%20Maria');
    expect(whatsappHref('')).toBeNull();
  });
  it('telHref', () => {
    expect(telHref('(11) 9 1234-5678')).toBe('tel:11912345678');
    expect(telHref('')).toBeNull();
  });
  it('lista de parentesco fixa', () => {
    expect(GUARDIAN_RELATIONSHIPS).toEqual(['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro']);
  });
});

describe('guardianIssue', () => {
  const ok = { isMinor: true, name: 'Maria', phone: '(11) 9 1234-5678', birthDate: new Date(2015, 4, 10), now: HOJE };
  it('chave desligada: nada a validar', () => {
    expect(guardianIssue({ ...ok, isMinor: false, name: '' })).toBeNull();
  });
  it('tudo certo: null', () => {
    expect(guardianIssue(ok)).toBeNull();
    expect(guardianIssue({ ...ok, birthDate: null })).toBeNull();
  });
  it('nome, telefone e data de quem já tem 18', () => {
    expect(guardianIssue({ ...ok, name: 'M' })).toBe('Informe o nome do responsável.');
    expect(guardianIssue({ ...ok, phone: '(11) 9 12' })).toBe('Informe o telefone do responsável com DDD.');
    expect(guardianIssue({ ...ok, birthDate: new Date(2008, 0, 1) }))
      .toBe('Pela data, já tem 18 anos. Confira a data ou desligue a chave.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/guardian.test.js`
Expected: FAIL, "Failed to resolve import ../guardian.js".

- [ ] **Step 3: Implementar `src/lib/guardian.js`**

```js
// Responsável do lead menor de idade. Regra única de quem é menor agora e de
// quem o consultor chama, usada pela tela, pelas listas, pela busca e pela
// api/ (cartão do Stronizap). Pura: sem React e sem Firebase. Nunca importar
// daqui src/lib/dailyGoal.js, que puxa lucide-react e quebra a api/.
//
// Nada é gravado no aniversário: a regra roda toda vez que o lead é lido.
// Spec: docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md
import { getSafeDateOrNull } from './dates.js';

export const GUARDIAN_RELATIONSHIPS = Object.freeze(['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro']);

const MIN_PHONE_DIGITS = 10;
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
const hasPhone = (v) => onlyDigits(v).length >= MIN_PHONE_DIGITS;
const hasGuardian = (lead) => Boolean(lead?.guardian) && hasPhone(lead.guardian.phone);

// Dia em que a pessoa faz 18 anos. new Date(ano + 18, mês, dia) já leva o
// 29 de fevereiro para 1º de março nos anos que não são bissextos.
export function adultSince(birthDate) {
  const d = getSafeDateOrNull(birthDate);
  if (!d) return null;
  return new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
}

// A chave está ligada, mas a data de nascimento já passou dos 18 anos.
export function turnedAdult(lead, now = new Date()) {
  if (lead?.isMinor !== true) return false;
  const since = adultSince(lead.birthDate);
  return Boolean(since) && now.getTime() >= since.getTime();
}

export function isMinorNow(lead, now = new Date()) {
  return lead?.isMinor === true && hasGuardian(lead) && !turnedAdult(lead, now);
}

// Quem o consultor chama. `viaGuardian` diz se é o responsável e
// `missingOwnPhone` que a pessoa fez 18 anos sem WhatsApp próprio.
export function contactOf(lead, now = new Date()) {
  const own = {
    phone: lead?.whatsapp || '',
    name: lead?.name || '',
    relationship: null,
    viaGuardian: false,
    missingOwnPhone: false,
  };
  if (lead?.isMinor !== true || !hasGuardian(lead)) return own;
  const guardian = {
    phone: lead.guardian.phone,
    name: lead.guardian.name || '',
    relationship: lead.guardian.relationship || null,
    viaGuardian: true,
  };
  if (!turnedAdult(lead, now)) return { ...guardian, missingOwnPhone: false };
  if (!hasPhone(lead.whatsapp)) return { ...guardian, missingOwnPhone: true };
  return own;
}

// "Maria Souza (mãe)". Sem parentesco, ou com "Outro", só o nome.
export function contactLabel({ name, relationship } = {}) {
  const nome = String(name ?? '').trim();
  if (!relationship || relationship === 'Outro') return nome;
  return `${nome} (${String(relationship).toLowerCase()})`;
}

export const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || '';

// Link do wa.me. Número de até 11 dígitos ganha o 55 na frente.
export function whatsappHref(phone, text) {
  let n = onlyDigits(phone);
  if (!n) return null;
  if (n.length <= 11) n = `55${n}`;
  return text ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/${n}`;
}

export function telHref(phone) {
  const n = onlyDigits(phone);
  return n ? `tel:${n}` : null;
}

// O que impede salvar o bloco do responsável, ou null. `birthDate` é Date
// (ou Timestamp); o formulário converte a string do input antes.
export function guardianIssue({ isMinor, name, phone, birthDate, now = new Date() }) {
  if (!isMinor) return null;
  if (String(name ?? '').trim().length <= 1) return 'Informe o nome do responsável.';
  if (!hasPhone(phone)) return 'Informe o telefone do responsável com DDD.';
  const since = adultSince(birthDate);
  if (since && now.getTime() >= since.getTime()) {
    return 'Pela data, já tem 18 anos. Confira a data ou desligue a chave.';
  }
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/guardian.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guardian.js src/lib/__tests__/guardian.test.js
git commit -m "feat: regra do lead menor de idade e do contato pelo responsável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Campos derivados e patch do responsável (`leadDerived.js`)

**Files:**
- Modify: `src/lib/leadDerived.js`
- Test: `src/lib/__tests__/leadDerived.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/leadDerived.test.js`, trocar a linha de import do topo por:

```js
import { buildLeadSearchFields, buildGuardianSearchFields, buildGuardianPatch } from '../leadDerived.js';
```

E acrescentar no fim do arquivo:

```js
describe('buildGuardianSearchFields', () => {
  it('dígitos, dígitos invertidos e chave do Zap do telefone do responsável', () => {
    expect(buildGuardianSearchFields({ name: 'Maria', phone: '(11) 9 1234-5678' })).toEqual({
      guardianPhoneDigits: '11912345678',
      guardianPhoneDigitsRev: '87654321911',
      guardianZapMatchKey: '1112345678',
    });
  });

  it('sem responsável: tudo null', () => {
    const vazio = { guardianPhoneDigits: null, guardianPhoneDigitsRev: null, guardianZapMatchKey: null };
    expect(buildGuardianSearchFields(null)).toEqual(vazio);
    expect(buildGuardianSearchFields({ name: 'Maria', phone: '' })).toEqual(vazio);
  });
});

describe('buildGuardianPatch', () => {
  it('chave ligada: grava o responsável aparado e os derivados', () => {
    expect(buildGuardianPatch({ isMinor: true, name: ' Maria Souza ', phone: '(11) 9 1234-5678', relationship: 'Mãe' })).toEqual({
      isMinor: true,
      guardian: { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' },
      guardianPhoneDigits: '11912345678',
      guardianPhoneDigitsRev: '87654321911',
      guardianZapMatchKey: '1112345678',
    });
  });

  it('parentesco vazio vira null', () => {
    expect(buildGuardianPatch({ isMinor: true, name: 'Maria', phone: '11912345678', relationship: '' }).guardian.relationship).toBeNull();
  });

  it('chave desligada: apaga o responsável e os derivados', () => {
    expect(buildGuardianPatch({ isMinor: false, name: 'Maria', phone: '11912345678' })).toEqual({
      isMinor: false,
      guardian: null,
      guardianPhoneDigits: null,
      guardianPhoneDigitsRev: null,
      guardianZapMatchKey: null,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leadDerived.test.js`
Expected: FAIL, `buildGuardianSearchFields is not a function`.

- [ ] **Step 3: Implementar em `src/lib/leadDerived.js`**

Logo depois de `buildLeadSearchFields`, acrescentar:

```js
// Campos derivados do telefone do RESPONSÁVEL do lead menor de idade. Ficam
// fora de buildLeadSearchFields de propósito: ela é chamada em vários pontos
// só com nome, WhatsApp e CPF, e toda escrita que não repassasse o
// responsável apagaria estes campos. Só quem muda o responsável (cadastro e
// edição) chama esta, por buildGuardianPatch.
export const buildGuardianSearchFields = (guardian) => {
  const digits = onlyDigits(guardian?.phone);
  return {
    guardianPhoneDigits: digits || null,
    guardianPhoneDigitsRev: digits ? digits.split('').reverse().join('') : null,
    guardianZapMatchKey: zapMatchKey(guardian?.phone),
  };
};

// Tudo o que o cadastro e a edição gravam sobre o responsável. Chave
// desligada apaga o responsável e os derivados.
export const buildGuardianPatch = ({ isMinor, name, phone, relationship } = {}) => {
  const trim = (v) => String(v ?? '').trim();
  const guardian = isMinor
    ? { name: trim(name), phone: trim(phone), relationship: trim(relationship) || null }
    : null;
  return { isMinor: Boolean(isMinor), guardian, ...buildGuardianSearchFields(guardian) };
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leadDerived.test.js src/lib/__tests__/referralApiMirror.test.js`
Expected: PASS nos dois (o espelho do `_referral.js` não muda, porque `buildLeadSearchFields` não mudou).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadDerived.js src/lib/__tests__/leadDerived.test.js
git commit -m "feat: campos de busca e patch do responsável do menor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Avisos de telefone (texto puro e consulta)

**Files:**
- Create: `src/lib/phoneNotice.js`
- Create: `src/hooks/useGuardianMatches.js`
- Test: `src/lib/__tests__/phoneNotice.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/phoneNotice.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { phoneNoticeLines } from '../phoneNotice.js';

const HOJE = new Date(2026, 8, 24, 10, 0);
const MAE = { name: 'Maria', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const filho = (name, extra = {}) => ({ id: name, name, isMinor: true, guardian: MAE, birthDate: new Date(2015, 1, 1), ...extra });

describe('phoneNoticeLines', () => {
  it('campo do responsável: telefone de um cliente', () => {
    const owner = { id: 'm', name: 'Maria Silva', lifecycleStage: 'cliente' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [], now: HOJE }))
      .toEqual(['Esse é o telefone de Maria Silva, cliente.']);
  });

  it('campo do responsável: telefone de um lead, com a etapa', () => {
    const owner = { id: 'm', name: 'Maria Silva', status: 'Negociação' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [], now: HOJE }))
      .toEqual(['Esse é o telefone de Maria Silva, lead em Negociação.']);
  });

  it('campo do responsável: já é responsável de outros menores', () => {
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [filho('Ana Souza')], now: HOJE }))
      .toEqual(['Maria já é responsável de Ana.']);
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [filho('Ana Souza'), filho('Pedro Souza'), filho('Lia Souza')], now: HOJE }))
      .toEqual(['Maria já é responsável de Ana, Pedro e mais 1.']);
  });

  it('campo do próprio lead: o telefone é de um responsável', () => {
    expect(phoneNoticeLines({ field: 'own', owner: null, wards: [filho('Ana Souza'), filho('Pedro Souza')], now: HOJE }))
      .toEqual(['Esse telefone é de Maria, responsável de Ana e Pedro.']);
  });

  it('campo do próprio lead: dono do número não gera aviso (quem barra é o duplicado)', () => {
    const owner = { id: 'm', name: 'Maria Silva', lifecycleStage: 'cliente' };
    expect(phoneNoticeLines({ field: 'own', owner, wards: [], now: HOJE })).toEqual([]);
  });

  it('menor que fez 18 com WhatsApp próprio não conta mais como filho', () => {
    const adulto = filho('Ana Souza', { birthDate: new Date(2008, 0, 1), whatsapp: '(11) 9 5555-4444' });
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [adulto], now: HOJE })).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/phoneNotice.test.js`
Expected: FAIL, "Failed to resolve import ../phoneNotice.js".

- [ ] **Step 3: Implementar `src/lib/phoneNotice.js`**

```js
// Avisos de telefone do cadastro e da edição do lead. Nunca barram: quem barra
// é o duplicado do WhatsApp do próprio lead (useDuplicateLead). Aqui só se
// avisa que o número já é de alguém, como dono ou como responsável de menor.
// Mora fora de guardian.js porque precisa de leads.js, e leads.js importa
// globalSearch.js, que importa guardian.js.
import { isClientLead } from './leads.js';
import { contactOf, firstName } from './guardian.js';

const nomes = (lista) => {
  const primeiros = lista.map((l) => firstName(l.name)).filter(Boolean);
  if (primeiros.length <= 2) return primeiros.join(' e ');
  return `${primeiros.slice(0, 2).join(', ')} e mais ${primeiros.length - 2}`;
};

const situacao = (lead) =>
  isClientLead(lead) ? 'cliente' : (lead.status ? `lead em ${lead.status}` : 'lead');

// field: 'own' (WhatsApp do próprio lead) ou 'guardian' (telefone do responsável).
// owner: lead cujo WhatsApp é este número, ou null. wards: menores que têm este
// número como responsável (quem já não o tem como contato é filtrado aqui).
export function phoneNoticeLines({ field, owner, wards = [], now = new Date() }) {
  const filhos = wards.filter((w) => contactOf(w, now).viaGuardian);
  const quem = firstName(filhos[0]?.guardian?.name) || 'Essa pessoa';
  const linhas = [];
  if (field === 'guardian' && owner) {
    linhas.push(`Esse é o telefone de ${owner.name}, ${situacao(owner)}.`);
  }
  if (filhos.length > 0) {
    linhas.push(field === 'guardian'
      ? `${quem} já é responsável de ${nomes(filhos)}.`
      : `Esse telefone é de ${quem}, responsável de ${nomes(filhos)}.`);
  }
  return linhas;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/phoneNotice.test.js`
Expected: PASS.

- [ ] **Step 5: Criar o hook `src/hooks/useGuardianMatches.js`**

Mesmo molde do `useDuplicateLead.js` (consulta de igualdade num campo só, índice automático, espera de 300 ms):

```js
// Quem já usa um telefone: o lead dono do número (whatsappDigits) e os menores
// que o têm como responsável (guardianPhoneDigits). Serve aos avisos do
// cadastro e da edição, que nunca barram. Igualdade num campo só, então o
// índice é o automático, igual ao useDuplicateLead.
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

const MIN_DIGITS = 10;
const VAZIO = { owner: null, wards: [] };

export function useGuardianMatches({ db, phoneDigits, excludeId = null, debounceMs = 300 }) {
  const [matches, setMatches] = useState(VAZIO);

  useEffect(() => {
    if (!db || !phoneDigits || phoneDigits.length < MIN_DIGITS) {
      setMatches(VAZIO);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
        const [donos, menores] = await Promise.all([
          getDocs(query(colRef, where('whatsappDigits', '==', phoneDigits), limit(5))),
          getDocs(query(colRef, where('guardianPhoneDigits', '==', phoneDigits), limit(10))),
        ]);
        if (cancelled) return;
        const fora = (l) => l.id !== excludeId;
        setMatches({
          owner: donos.docs.map(normalizeLeadDoc).find(fora) || null,
          wards: menores.docs.map(normalizeLeadDoc).filter(fora),
        });
      } catch (e) {
        console.error('useGuardianMatches', e);
        if (!cancelled) setMatches(VAZIO);
      }
    }, debounceMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, phoneDigits, excludeId, debounceMs]);

  return matches;
}
```

- [ ] **Step 6: Lint dos arquivos novos**

Run: `npx eslint src/lib/phoneNotice.js src/hooks/useGuardianMatches.js`
Expected: sem erro. O `useDuplicateLead.js`, que tem o mesmo molde, passa limpo no lint de hoje.

- [ ] **Step 7: Commit**

```bash
git add src/lib/phoneNotice.js src/hooks/useGuardianMatches.js src/lib/__tests__/phoneNotice.test.js
git commit -m "feat: avisos de telefone já usado por dono ou por responsável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cadastro (Novo lead)

**Files:**
- Modify: `src/modals/AddLeadModal.jsx`

Sem teste automático de componente aqui: o modal depende de Firestore e de contexto. A regra testável já está em `guardian.js`, `leadDerived.js` e `phoneNotice.js`. A conferência é na tela, na Task 14.

- [ ] **Step 1: Imports**

Trocar a linha `import { buildLeadSearchFields, deriveLeadBucket } from '../lib/leadDerived.js';` por:

```js
import { buildLeadSearchFields, buildGuardianPatch, deriveLeadBucket } from '../lib/leadDerived.js';
import { GUARDIAN_RELATIONSHIPS, guardianIssue } from '../lib/guardian.js';
import { phoneNoticeLines } from '../lib/phoneNotice.js';
import { useGuardianMatches } from '../hooks/useGuardianMatches.js';
```

No import do `lucide-react`, acrescentar `Baby` e `Phone`.

- [ ] **Step 2: Estado do formulário**

Em `blankForm`, depois de `whatsapp: '',`, acrescentar:

```js
    isMinor: false,
    guardianName: '',
    guardianPhone: '',
    guardianRelation: '',
```

- [ ] **Step 3: Validação e avisos**

Trocar o bloco que começa em `const phoneDigits = onlyDigits(form.whatsapp);` e vai até o fim do cálculo de `pct` por:

```js
  const phoneDigits = onlyDigits(form.whatsapp);
  const phoneTooShort = phoneDigits.length > 0 && phoneDigits.length < 10;
  // Dup-check remoto (G1-flip / PR F): query em whatsappDigits, cobre todos os
  // buckets (cliente/perda também) em vez de varrer o prop global 'ativo'.
  const { duplicate } = useDuplicateLead({ db, phoneDigits });
  const guardianDigits = onlyDigits(form.guardianPhone);
  // Avisos que nunca barram: número de um responsável no campo do lead, e
  // número de alguém (dono ou responsável) no campo do responsável.
  const ownMatches = useGuardianMatches({ db, phoneDigits });
  const guardianMatches = useGuardianMatches({ db, phoneDigits: form.isMinor ? guardianDigits : '' });
  const ownNotice = duplicate ? [] : phoneNoticeLines({ field: 'own', ...ownMatches });
  const guardianNotice = phoneNoticeLines({ field: 'guardian', ...guardianMatches });
  const guardianError = guardianIssue({
    isMinor: form.isMinor,
    name: form.guardianName,
    phone: form.guardianPhone,
    birthDate: fromDateInputValue(form.birthDate),
  });
  // Com a chave ligada o WhatsApp do aluno é opcional, mas, preenchido, precisa
  // estar completo.
  const ownPhoneOk = form.isMinor ? (phoneDigits.length === 0 || phoneDigits.length >= 10) : phoneDigits.length >= 10;
  const contactOk = form.isMinor ? guardianDigits.length >= 10 : phoneDigits.length >= 10;
  const nameOk = form.name.trim().length > 1;
  const dorOk = form.dor.trim().length > 0;
  const canSubmit = nameOk && ownPhoneOk && !guardianError && !duplicate && !!form.funnelId && dorOk && (!isReferral || !!referrer);

  // barra de progresso — 6 sinais
  const filled = [nameOk, contactOk, !!form.source, !!form.status, dorOk].filter(Boolean).length
    + ((form.tags.length || form.observation.trim()) ? 1 : 0);
  const pct = Math.round((filled / 6) * 100);
```

- [ ] **Step 4: Gravação**

No objeto do `addDoc`, logo depois da linha `...buildLeadSearchFields({ name: form.name, whatsapp: form.whatsapp, cpf: form.cpf }),`, acrescentar:

```js
          ...buildGuardianPatch({
            isMinor: form.isMinor,
            name: form.guardianName,
            phone: form.guardianPhone,
            relationship: form.guardianRelation,
          }),
```

- [ ] **Step 5: Bloco "Quem é"**

Trocar o `SectionTitle` e o grid da seção 1 (do `<SectionTitle n="1" ...` até o `</div>` que fecha o `grid sm:grid-cols-2 gap-3.5`) por:

```jsx
                    <SectionTitle n="1" title="Quem é" desc={form.isMinor ? 'Nome do aluno e contato do responsável' : 'Nome e WhatsApp são obrigatórios'} />
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <div className="sm:col-span-2">
                        <Label required>Nome do lead</Label>
                        <IconInput inputRef={nameRef} icon={<UserPlus size={16} />} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nome completo" />
                      </div>
                      <label className={cn(
                        'sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition',
                        form.isMinor
                          ? 'border-brand-300 bg-brand-50/70 dark:border-brand-500/30 dark:bg-brand-500/[0.07]'
                          : 'border-border bg-card hover:border-slate-300 dark:hover:border-white/15'
                      )}>
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={cn(
                            'size-9 rounded-lg grid place-items-center shrink-0 transition',
                            form.isMinor ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300'
                          )}>
                            <Baby size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-foreground leading-tight">Menor de idade</span>
                            <span className="block text-[11.5px] text-muted-foreground truncate">O contato passa a ser o responsável</span>
                          </span>
                        </span>
                        <Switch checked={form.isMinor} onCheckedChange={(on) => set({ isMinor: on })} />
                      </label>
                      {form.isMinor && (
                        <>
                          <div className="sm:col-span-2">
                            <Label required>Nome do responsável</Label>
                            <IconInput icon={<Users size={16} />} value={form.guardianName} onChange={(e) => set({ guardianName: e.target.value })} placeholder="Nome de quem responde pelo aluno" />
                          </div>
                          <div>
                            <Label required hint="com DDD + 9 dígitos">Telefone do responsável</Label>
                            <IconInput type="tel" inputMode="numeric" icon={<Phone size={16} />} value={fmtPhone(form.guardianPhone)} onChange={(e) => set({ guardianPhone: e.target.value })} placeholder="(51) 9 0000-0000" />
                          </div>
                          <div>
                            <Label hint="opcional">Parentesco</Label>
                            <Select value={form.guardianRelation} onChange={(e) => set({ guardianRelation: e.target.value })}>
                              <option value="">Selecione…</option>
                              {GUARDIAN_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </Select>
                          </div>
                          {guardianNotice.length > 0 && (
                            <div className="sm:col-span-2 flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">
                              {guardianNotice.map((linha) => <span key={linha}>{linha}</span>)}
                            </div>
                          )}
                          {guardianError && guardianError.startsWith('Pela data') && (
                            <div className="sm:col-span-2 flex items-start gap-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>{guardianError}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="sm:col-span-2">
                        <Label required={!form.isMinor} hint={duplicate ? '' : (form.isMinor ? 'opcional' : 'com DDD + 9 dígitos')}>
                          {form.isMinor ? 'WhatsApp do aluno' : 'WhatsApp'}
                        </Label>
                        <IconInput type="tel" inputMode="numeric" icon={<MessageCircle size={16} />} value={fmtPhone(form.whatsapp)} onChange={(e) => set({ whatsapp: e.target.value })}
                          placeholder="(51) 9 0000-0000"
                          className={duplicate ? '!border-rose-400 focus:!ring-rose-400/15' : (phoneTooShort ? '!border-amber-400' : '')} />
                        {duplicate ? (
                          <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
                          </div>
                        ) : phoneTooShort ? (
                          <div className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">Número incompleto — inclua DDD + 9 dígitos.</div>
                        ) : ownNotice.length > 0 ? (
                          <div className="mt-1.5 text-[11.5px] text-muted-foreground">{ownNotice[0]}</div>
                        ) : phoneDigits.length >= 10 ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400"><Check size={13} /> Número válido e disponível.</div>
                        ) : null}
                      </div>
                    </div>
```

O texto "Número incompleto — inclua DDD + 9 dígitos." já existe e fica como está: o PR não reescreve textos antigos.

- [ ] **Step 6: Painel da esquerda**

No cartão do painel da esquerda, trocar `<Users size={13} /> Responsável</div>` por `<Users size={13} /> Consultor</div>` e trocar `Responsável pelo cadastro` por `Quem faz o cadastro`.

No `PreviewCard`, trocar a linha do telefone:

```jsx
              {form.whatsapp ? fmtPhone(form.whatsapp) : '(00) 0 0000-0000'}
```

por:

```jsx
              {form.isMinor && form.guardianPhone
                ? `${fmtPhone(form.guardianPhone)} · resp.`
                : (form.whatsapp ? fmtPhone(form.whatsapp) : '(00) 0 0000-0000')}
```

- [ ] **Step 7: Lint e testes**

Run: `npx eslint src/modals/AddLeadModal.jsx && npm test`
Expected: lint limpo e suíte verde.

- [ ] **Step 8: Commit**

```bash
git add src/modals/AddLeadModal.jsx
git commit -m "feat: chave Menor de idade e responsável no cadastro do lead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Regra da edição (`clientRegistration.js`)

**Files:**
- Modify: `src/lib/clientRegistration.js`
- Test: `src/lib/__tests__/clientRegistration.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No topo de `src/lib/__tests__/clientRegistration.test.js`, acrescentar `registrationGuardianIssue` ao import de `../clientRegistration.js`. No fim do arquivo, acrescentar:

```js
describe('responsável do menor na edição', () => {
  const HOJE = new Date(2026, 8, 24, 10, 0);
  const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
  const menor = (extra = {}) => ({
    id: 'k1', name: 'Pedro Souza', whatsapp: '', isMinor: true, guardian: MAE,
    birthDate: new Date(2015, 4, 10), ...extra,
  });

  it('lê a chave e o responsável de um menor', () => {
    const f = readClientRegistration(menor(), HOJE);
    expect(f.isMinor).toBe(true);
    expect(f.minorAtOpen).toBe(true);
    expect(f.adultSince).toBe('');
    expect(f.guardianName).toBe('Maria Souza');
    expect(f.guardianPhone).toBe('(11) 9 1234-5678');
    expect(f.guardianRelation).toBe('Mãe');
  });

  it('quem fez 18 abre com a chave desligada e a data dos 18', () => {
    const f = readClientRegistration(menor({ birthDate: new Date(2008, 2, 12) }), HOJE);
    expect(f.isMinor).toBe(false);
    expect(f.minorAtOpen).toBe(false);
    expect(f.adultSince).toBe('2026-03-12');
  });

  it('chave ligada: o patch grava o responsável', () => {
    const patch = buildClientRegistrationPatch(readClientRegistration(menor(), HOJE));
    expect(patch.isMinor).toBe(true);
    expect(patch.guardian).toEqual(MAE);
    expect(patch.guardianZapMatchKey).toBe('1112345678');
  });

  it('chave desligada à mão: o patch apaga o responsável', () => {
    const form = { ...readClientRegistration(menor({ whatsapp: '(11) 9 5555-4444' }), HOJE), isMinor: false };
    const patch = buildClientRegistrationPatch(form);
    expect(patch.isMinor).toBe(false);
    expect(patch.guardian).toBeNull();
    expect(patch.guardianZapMatchKey).toBeNull();
  });

  it('fez 18 com WhatsApp próprio: salvar tira o responsável', () => {
    const form = readClientRegistration(menor({ birthDate: new Date(2008, 2, 12), whatsapp: '(11) 9 5555-4444' }), HOJE);
    expect(buildClientRegistrationPatch(form).guardian).toBeNull();
  });

  it('fez 18 sem WhatsApp próprio: salvar mantém o responsável guardado', () => {
    const form = readClientRegistration(menor({ birthDate: new Date(2008, 2, 12) }), HOJE);
    const patch = buildClientRegistrationPatch(form);
    expect('guardian' in patch).toBe(false);
    expect('isMinor' in patch).toBe(false);
  });

  it('lead que nunca foi menor: o patch grava a chave desligada', () => {
    const patch = buildClientRegistrationPatch(readClientRegistration({ id: 'a', name: 'Ana', whatsapp: '(11) 9 1111-2222' }, HOJE));
    expect(patch.isMinor).toBe(false);
    expect(patch.guardian).toBeNull();
  });

  it('validação: bloco do responsável e WhatsApp exigido só ao desligar a chave', () => {
    const aberto = readClientRegistration(menor(), HOJE);
    expect(registrationGuardianIssue(aberto, HOJE)).toBeNull();
    expect(registrationGuardianIssue({ ...aberto, guardianName: '' }, HOJE)).toBe('Informe o nome do responsável.');
    expect(registrationGuardianIssue({ ...aberto, isMinor: false }, HOJE))
      .toBe('Para desligar Menor de idade, informe o WhatsApp do lead.');
    expect(registrationGuardianIssue({ ...aberto, isMinor: false, whatsapp: '(11) 9 5555-4444' }, HOJE)).toBeNull();
    const semTelefone = readClientRegistration({ id: 'a', name: 'Importado', whatsapp: '' }, HOJE);
    expect(registrationGuardianIssue(semTelefone, HOJE)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/clientRegistration.test.js`
Expected: FAIL nos testes novos (`registrationGuardianIssue` não existe, `minorAtOpen` indefinido).

- [ ] **Step 3: Implementar em `src/lib/clientRegistration.js`**

Trocar os imports do topo por:

```js
import { fromDateInputValue, toDateInputValue } from './dates.js';
import { buildLeadSearchFields, buildGuardianPatch } from './leadDerived.js';
import { formatCPF, formatPhone } from './masks.js';
import { professorNameById } from './professores.js';
import { adultSince, guardianIssue, isMinorNow, turnedAdult } from './guardian.js';
```

Logo abaixo de `const nullify = ...`, acrescentar:

```js
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
```

`readClientRegistration` ganha o parâmetro `now` e os campos do responsável. Trocar a assinatura e as duas primeiras linhas do corpo por:

```js
export function readClientRegistration(lead = {}, now = new Date()) {
  const a = lead.address || {};
  const e = lead.emergencyContact || {};
  const g = lead.guardian || {};
  const minor = isMinorNow(lead, now);
```

E, no objeto devolvido, logo depois de `whatsapp: formatPhone(lead.whatsapp || ''),`, acrescentar:

```js
    isMinor: minor,
    // Estado da chave ao abrir: desligar uma chave que estava ligada passa a
    // exigir o WhatsApp do lead.
    minorAtOpen: minor,
    // Data em que fez 18 anos ('yyyy-mm-dd'), só para quem tinha a chave
    // ligada e já passou da idade. A tela mostra a nota com ela.
    adultSince: turnedAdult(lead, now) ? toDateInputValue(adultSince(lead.birthDate)) : '',
    guardianName: g.name || '',
    guardianPhone: formatPhone(g.phone || ''),
    guardianRelation: g.relationship || '',
```

Em `buildClientRegistrationPatch`, logo antes do comentário `// Reatribuição de consultor`, acrescentar:

```js
  // Responsável do menor. Quem fez 18 anos sem WhatsApp próprio segue com o
  // responsável como contato: o patch não toca no responsável, e a ficha
  // continua pedindo o número.
  const semWhatsappProprio = onlyDigits(form.whatsapp).length < 10;
  if (form.isMinor || !(form.adultSince && semWhatsappProprio)) {
    Object.assign(patch, buildGuardianPatch({
      isMinor: form.isMinor,
      name: form.guardianName,
      phone: form.guardianPhone,
      relationship: form.guardianRelation,
    }));
  }
```

E, depois de `buildClientRegistrationPatch`, a validação:

```js
// O que impede salvar a parte do responsável na edição, ou null. Além do
// bloco (mesma regra do cadastro), desligar uma chave que estava ligada exige
// o WhatsApp do lead. Fora desse caso a edição não exige WhatsApp, para não
// travar lead importado sem telefone.
export function registrationGuardianIssue(form, now = new Date()) {
  const issue = guardianIssue({
    isMinor: form.isMinor,
    name: form.guardianName,
    phone: form.guardianPhone,
    birthDate: fromDateInputValue(form.birthDate),
    now,
  });
  if (issue) return issue;
  if (form.minorAtOpen && !form.isMinor && onlyDigits(form.whatsapp).length < 10) {
    return 'Para desligar Menor de idade, informe o WhatsApp do lead.';
  }
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/clientRegistration.test.js`
Expected: PASS em todos, novos e antigos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientRegistration.js src/lib/__tests__/clientRegistration.test.js
git commit -m "feat: responsável do menor na leitura, gravação e validação da edição

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Edição (aba Identidade)

**Files:**
- Modify: `src/modals/ClientRegistrationModal.jsx`

- [ ] **Step 1: Imports**

Trocar a linha do `lucide-react` por:

```js
import { User, MapPin, Phone, Briefcase, Users, Calendar, IdCard, Mail, Check, Pencil, Baby } from 'lucide-react';
```

Acrescentar `registrationGuardianIssue` ao import de `../lib/clientRegistration.js`, e:

```js
import { GUARDIAN_RELATIONSHIPS } from '../lib/guardian.js';
import { phoneNoticeLines } from '../lib/phoneNotice.js';
import { useGuardianMatches } from '../hooks/useGuardianMatches.js';
import { Switch } from '../components/ui/switch.jsx';
```

- [ ] **Step 2: Aviso e validação no corpo do componente**

Logo depois de `const tagSuggestions = ...`, acrescentar:

```js
  const guardianDigits = String(form.guardianPhone || '').replace(/\D/g, '');
  const guardianMatches = useGuardianMatches({ db, phoneDigits: form.isMinor ? guardianDigits : '', excludeId: lead.id });
  const guardianNotice = phoneNoticeLines({ field: 'guardian', ...guardianMatches });
  const adultNote = form.adultSince
    ? `Fez 18 anos em ${form.adultSince.split('-').reverse().join('/')}.`
    : null;
```

Em `handleSave`, logo depois da checagem do nome (`if (!form.name.trim()) { ... }`), acrescentar:

```js
    const guardianError = registrationGuardianIssue(form);
    if (guardianError) { setTab('identidade'); toast.warning(guardianError); return; }
```

- [ ] **Step 3: Campos na aba Identidade**

O rótulo do WhatsApp passa a depender da chave. Trocar:

```jsx
              <Field label="WhatsApp" required>
```

por:

```jsx
              <Field label={form.isMinor ? 'WhatsApp do aluno' : 'WhatsApp'} required={!form.isMinor}>
```

E, logo depois do `</Field>` desse WhatsApp (antes do campo CPF), acrescentar:

```jsx
              <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-border p-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="size-8 rounded-lg grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300"><Baby size={16} /></span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground leading-tight">Menor de idade</span>
                      <span className="block text-[11.5px] text-muted-foreground">{adultNote || 'O contato passa a ser o responsável'}</span>
                    </span>
                  </span>
                  <Switch checked={form.isMinor} onCheckedChange={(on) => set('isMinor', on)} />
                </label>
                {form.isMinor && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2"><Field label="Nome do responsável" required><StyledInput icon={<Users size={15} />} value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} placeholder="Nome de quem responde pelo aluno" /></Field></div>
                    <Field label="Telefone do responsável" required><StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.guardianPhone} onChange={(e) => set('guardianPhone', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" /></Field>
                    <Field label="Parentesco"><StyledSelect value={form.guardianRelation} onChange={(e) => set('guardianRelation', e.target.value)}><option value="">Selecione…</option>{GUARDIAN_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</StyledSelect></Field>
                    {guardianNotice.length > 0 && (
                      <div className="sm:col-span-2 flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">
                        {guardianNotice.map((linha) => <span key={linha}>{linha}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
```

- [ ] **Step 4: Lint e testes**

Run: `npx eslint src/modals/ClientRegistrationModal.jsx && npm test`
Expected: limpo e verde.

- [ ] **Step 5: Commit**

```bash
git add src/modals/ClientRegistrationModal.jsx
git commit -m "feat: chave Menor de idade e responsável na edição do cadastro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Componente do telefone de contato

**Files:**
- Create: `src/components/profile/ContactPhone.jsx`
- Test: `src/lib/__tests__/contactPhone.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/contactPhone.test.js` (render sem jsdom, igual ao `crm.components.test.js`):

```js
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ContactPhone } from '../../components/profile/ContactPhone.jsx';

const HOJE = new Date(2026, 8, 24, 10, 0);
const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const html = (props) => renderToString(createElement(ContactPhone, { now: HOJE, ...props }));

describe('ContactPhone', () => {
  it('adulto: só o número, sem marca', () => {
    const out = html({ lead: { name: 'Ana', whatsapp: '(51) 9 0000-1111' } });
    expect(out).toContain('(51) 9 0000-1111');
    expect(out).not.toContain('resp.');
  });

  it('menor: número do responsável com a marca resp.', () => {
    const out = html({ lead: { name: 'Pedro', whatsapp: '', isMinor: true, guardian: MAE } });
    expect(out).toContain('(11) 9 1234-5678');
    expect(out).toContain('resp.');
  });

  it('showName: nome e parentesco antes do número', () => {
    const out = html({ lead: { name: 'Pedro', isMinor: true, guardian: MAE }, showName: true });
    expect(out).toContain('Maria Souza (mãe)');
  });

  it('sem telefone nenhum: não desenha nada', () => {
    expect(html({ lead: { name: 'Ana', whatsapp: '' } })).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contactPhone.test.js`
Expected: FAIL, o componente não existe.

- [ ] **Step 3: Implementar `src/components/profile/ContactPhone.jsx`**

```jsx
// Telefone de contato de um lead: o do responsável quando é menor, com a
// marca "resp.", ou o próprio WhatsApp. Serve às listas e à Meta Diária.
// A regra de quem é o contato mora em lib/guardian.js.
import { cn } from '@/lib/utils';
import { contactLabel, contactOf } from '../../lib/guardian.js';

export function ContactPhone({ lead, showName = false, className, now }) {
  const c = contactOf(lead, now);
  if (!c.phone) return null;
  const quem = c.viaGuardian ? contactLabel(c) : '';
  return (
    <span className={cn('num', className)} title={c.viaGuardian ? `Telefone de ${quem}, responsável` : undefined}>
      {showName && c.viaGuardian && <>{quem} · </>}
      {c.phone}
      {c.viaGuardian && (
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">resp.</span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contactPhone.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/ContactPhone.jsx src/lib/__tests__/contactPhone.test.js
git commit -m "feat: telefone de contato com a marca do responsável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ficha

**Files:**
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Import e contato**

Acrescentar:

```js
import { contactLabel, contactOf, firstName, isMinorNow, telHref, whatsappHref } from '../lib/guardian.js';
```

Logo antes de `const handleWhatsApp = () => {`, acrescentar:

```js
  // Quem o consultor chama: o responsável, quando o lead é menor.
  const contact = contactOf(lead);
```

- [ ] **Step 2: WhatsApp do topo**

Trocar `handleWhatsApp` inteiro por:

```js
  const handleWhatsApp = () => {
    const href = whatsappHref(contact.phone, `Olá ${firstName(contact.name)}`);
    if (!href) { toast.warning('Lead sem WhatsApp cadastrado.'); return; }
    window.open(href);
  };
```

- [ ] **Step 3: Link de indicação**

Trocar as linhas de `referralWaDigits` e `referralWaHref` por:

```js
  const referralWaHref = whatsappHref(
    contact.phone,
    buildReferralWhatsAppText({ firstName: firstName(contact.name), link: referralLink })
  );
```

Rode `grep -n referralWaDigits src/views/LeadProfileView.jsx`. Se ainda aparecer, troque o uso por `referralWaHref`.

- [ ] **Step 4: Enviar WhatsApp da composição**

Em `handleSendWhatsAppMessage`, trocar as três linhas do `window.open` (`const num = ...`, `const phone = ...` e o `window.open`) por:

```js
      const href = whatsappHref(contact.phone, msg);
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
```

- [ ] **Step 5: Copiar e Ligar**

Trocar `copyPhone` por uma versão que recebe o número:

```js
  const copyPhone = async (phone) => {
    try {
      await navigator.clipboard.writeText(String(phone || ''));
      toast.success('Número copiado.');
    } catch {
      toast.info('Copie o número manualmente.');
    }
  };
```

No botão Ligar, trocar o `onClick` por:

```jsx
                onClick={() => { const href = telHref(contact.phone); if (href) window.location.href = href; }}
```

- [ ] **Step 6: Etiqueta ao lado do nome**

Logo depois do `<h1 ...>{lead.name}</h1>`, acrescentar:

```jsx
                {isMinorNow(lead) && (
                  <span className="shrink-0 inline-flex items-center h-[20px] px-2 rounded-md text-[10.5px] font-bold uppercase tracking-[.05em] bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Menor de idade
                  </span>
                )}
```

- [ ] **Step 7: Célula Contato e aviso dos 18 anos**

Trocar o `<MetaCell label="Contato">...</MetaCell>` inteiro por:

```jsx
            <MetaCell label={contact.viaGuardian ? 'Contato (responsável)' : 'Contato'}>
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="num truncate">
                    {contact.viaGuardian ? `${contactLabel(contact)} · ` : ''}{contact.phone || '—'}
                  </span>
                  {contact.phone && (
                    <button
                      type="button"
                      onClick={() => copyPhone(contact.phone)}
                      title="Copiar número"
                      aria-label="Copiar número"
                      className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </span>
                {contact.viaGuardian && lead.whatsapp && (
                  <span className="flex items-center gap-1.5 min-w-0 text-[11.5px] font-medium text-muted-foreground">
                    <span className="num truncate">Aluno · {lead.whatsapp}</span>
                    <button
                      type="button"
                      onClick={() => copyPhone(lead.whatsapp)}
                      title="Copiar número do aluno"
                      aria-label="Copiar número do aluno"
                      className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <Copy size={12} />
                    </button>
                  </span>
                )}
              </div>
            </MetaCell>
```

Logo depois do `</div>` que fecha a faixa de metadados (a `div` com `grid grid-cols-2 lg:grid-cols-4`), acrescentar:

```jsx
          {contact.missingOwnPhone && (
            <p className="mt-3 text-[12px] font-medium text-amber-700 dark:text-amber-300">
              Fez 18 anos. Cadastre o WhatsApp próprio.
            </p>
          )}
```

- [ ] **Step 8: Conferir que não sobrou uso direto do WhatsApp para contato**

Run: `grep -n "lead.whatsapp" src/views/LeadProfileView.jsx`
Expected: só as linhas do número do aluno na célula Contato. Se aparecer outro ponto que abre WhatsApp ou liga, troque por `contact.phone` com `whatsappHref`/`telHref`.

- [ ] **Step 9: Lint e testes**

Run: `npx eslint src/views/LeadProfileView.jsx && npm test`
Expected: limpo e verde (o `leadLinkSweep.test.js` não é afetado).

- [ ] **Step 10: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "feat: ficha chama o responsável do menor e avisa quem fez 18 anos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Meta Diária

**Files:**
- Modify: `src/views/DailyGoalView.jsx`

As tarefas da Meta são o próprio lead espalhado (`src/lib/dailyGoal.js`, `...lead`), então `contactOf(task)` enxerga `isMinor`, `guardian` e `birthDate`.

- [ ] **Step 1: Imports**

```js
import { contactOf, telHref, whatsappHref } from '../lib/guardian.js';
import { ContactPhone } from '../components/profile/ContactPhone.jsx';
```

- [ ] **Step 2: Telefone nos cards**

Quatro trocas, localizadas pelo conteúdo:

1. Em `NextUp`: `<div className="text-[12px] text-slate-500 dark:text-slate-400 num">{task.whatsapp}</div>` vira
   `<div className="text-[12px] text-slate-500 dark:text-slate-400"><ContactPhone lead={task} showName /></div>`
2. Em `TaskCard`: `<span>{task.whatsapp}</span>` vira `<ContactPhone lead={task} showName />`
3. No bloco com `{lead.whatsapp && (` (lista de clientes com contato), trocar a condição por `{contactOf(lead).phone && (` e o `<span className="num">{lead.whatsapp}</span>` por `<ContactPhone lead={lead} showName />`
4. Em `RescheduleModal`: `{lead.name} · <span className="num">{lead.whatsapp}</span>` vira `{lead.name} · <ContactPhone lead={lead} showName />`

- [ ] **Step 3: Botões**

Trocar `handleWhatsapp` e `handleCall` por:

```js
  const handleWhatsapp = (lead) => {
    const href = whatsappHref(contactOf(lead).phone);
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (lead) => {
    const href = telHref(contactOf(lead).phone);
    if (href) window.location.href = href;
  };
```

- [ ] **Step 4: Conferir**

Run: `grep -n "\.whatsapp" src/views/DailyGoalView.jsx`
Expected: nenhuma ocorrência.

Run: `npx eslint src/views/DailyGoalView.jsx && npm test`
Expected: limpo e verde.

- [ ] **Step 5: Commit**

```bash
git add src/views/DailyGoalView.jsx
git commit -m "feat: Meta Diária mostra e chama o responsável do menor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Listas, exportação e relatório

**Files:**
- Modify: `src/views/LeadsView.jsx`, `src/views/ClientsView.jsx`, `src/views/AppointmentTrackingView.jsx`
- Modify: `src/lib/appointmentReport.js`
- Test: `src/lib/__tests__/appointmentReport.test.js`

- [ ] **Step 1: Teste do relatório que falha**

Em `src/lib/__tests__/appointmentReport.test.js`, trocar as duas expectativas de `getReportColumns`:

```js
    expect(cols).toEqual(['nome', 'telefone', 'responsavelAluno', 'telefoneResponsavel', 'objetivo', 'dataMarcada', 'professor', 'modalidade', 'passe', 'desfecho', 'responsavel']);
```

```js
    expect(cols).toEqual(['nome', 'telefone', 'responsavelAluno', 'telefoneResponsavel', 'objetivo', 'dataMarcada', 'desfecho', 'responsavel']);
```

E acrescentar dentro de `describe('buildReportRows', ...)`:

```js
  it('menor: colunas do responsável preenchidas; adulto: travessão', () => {
    const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
    const kid = aula({ id: 'k', name: 'Pedro', isMinor: true, guardian: MAE, birthDate: new Date(2015, 4, 10) });
    const adulto = aula({ id: 'a', name: 'Ana', appointmentScheduledFor: new Date(2026, 6, 11, 18, 0) });
    const [rKid, rAdulto] = buildReportRows([kid, adulto], { isAula: true, now: NOW });
    expect(rKid.responsavelAluno).toBe('Maria Souza (mãe)');
    expect(rKid.telefoneResponsavel).toBe('(11) 9 1234-5678');
    expect(rAdulto.responsavelAluno).toBe('—');
    expect(rAdulto.telefoneResponsavel).toBe('—');
  });
```

Run: `npx vitest run src/lib/__tests__/appointmentReport.test.js`
Expected: FAIL nos três.

- [ ] **Step 2: Implementar em `src/lib/appointmentReport.js`**

Import:

```js
import { contactLabel, contactOf } from './guardian.js';
```

Em `getReportColumns`, depois de `{ key: 'telefone', label: 'Telefone' },`:

```js
    // "Responsável do aluno" e não só "Responsável": a coluna Responsável, no
    // fim, é o consultor.
    { key: 'responsavelAluno', label: 'Responsável do aluno' },
    { key: 'telefoneResponsavel', label: 'Telefone do responsável' },
```

Em `buildReportRows`, no objeto `row`, depois de `telefone: lead.whatsapp || '—',`:

```js
        responsavelAluno: '—',
        telefoneResponsavel: '—',
```

E logo depois do fechamento do objeto `row` (antes de `if (isAula)`):

```js
      const contato = contactOf(lead, now);
      if (contato.viaGuardian) {
        row.responsavelAluno = contactLabel(contato) || '—';
        row.telefoneResponsavel = contato.phone;
      }
```

Run: `npx vitest run src/lib/__tests__/appointmentReport.test.js`
Expected: PASS. Se algum teste de `buildReportHtml` ou `rowsToCsv` comparar a linha inteira, atualize a expectativa com as duas colunas novas valendo `'—'`.

- [ ] **Step 3: Listas**

Nas três telas, importar:

```js
import { ContactPhone } from '../components/profile/ContactPhone.jsx';
```

E trocar o número:
- `LeadsView.jsx`: `<Phone className="size-[11px]" /> {l.whatsapp}` vira `<Phone className="size-[11px]" /> <ContactPhone lead={l} />`
- `ClientsView.jsx`: `<Phone className="size-[11px]" /> {c.whatsapp}` vira `<Phone className="size-[11px]" /> <ContactPhone lead={c} />`
- `AppointmentTrackingView.jsx`: `<Phone className="size-[11px]" /> {l.whatsapp}` vira `<Phone className="size-[11px]" /> <ContactPhone lead={l} />`

- [ ] **Step 4: Exportação de Leads**

Em `LeadsView.jsx`, importar `import { contactLabel, contactOf } from '../lib/guardian.js';` e trocar `headers` e a montagem das linhas:

```js
    const headers = ['Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'Origem', 'Indicado por', 'Fase do Funil', 'Consultor', 'Data Cadastro', 'Observação', 'Motivo Perda'];
    const csvRows = filteredLeads.map(l => {
      const contato = contactOf(l);
      return [
        l.name, l.whatsapp,
        contato.viaGuardian ? contactLabel(contato) : '',
        contato.viaGuardian ? contato.phone : '',
        l.source, l.referredByName, l.status, l.consultantName,
        l.createdAt ? l.createdAt.toLocaleDateString('pt-BR') : '',
        l.observation, l.lossReason
      ].map(csvCell).join(SEP);
    });
```

- [ ] **Step 5: Lint e testes**

Run: `npx eslint src/views/LeadsView.jsx src/views/ClientsView.jsx src/views/AppointmentTrackingView.jsx src/lib/appointmentReport.js && npm test`
Expected: limpo e verde.

- [ ] **Step 6: Commit**

```bash
git add src/views/LeadsView.jsx src/views/ClientsView.jsx src/views/AppointmentTrackingView.jsx src/lib/appointmentReport.js src/lib/__tests__/appointmentReport.test.js
git commit -m "feat: listas, exportação e relatório com o responsável do menor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Busca global

**Files:**
- Modify: `src/lib/globalSearch.js`
- Modify: `src/components/layout/GlobalSearch.jsx`
- Test: `src/lib/__tests__/globalSearch.test.js`

- [ ] **Step 1: Testes que falham**

Em `src/lib/__tests__/globalSearch.test.js`, no teste `'nome E dígitos juntos geram os dois conjuntos (2 + 3 = 5 specs)'`, trocar o título para `'nome E dígitos juntos geram os dois conjuntos (2 + 5 = 7 specs)'` e a expectativa para `toHaveLength(7)`. Acrescentar no fim do arquivo:

```js
describe('busca pelo telefone do responsável', () => {
  const HOJE = new Date(2026, 8, 24, 10, 0);
  const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };

  it('acha o menor pelo telefone do responsável, com matchKind guardian', () => {
    const pedro = { id: 'k', name: 'Pedro Souza', whatsapp: '', isMinor: true, guardian: MAE, birthDate: new Date(2015, 4, 10) };
    const { results } = searchPeople([pedro], '91234', { now: HOJE });
    expect(results).toHaveLength(1);
    expect(results[0].matchKind).toBe('guardian');
  });

  it('não acha quem fez 18 e tem WhatsApp próprio pelo telefone antigo do responsável', () => {
    const adulto = { id: 'a', name: 'Ana Souza', whatsapp: '(11) 9 5555-4444', isMinor: true, guardian: MAE, birthDate: new Date(2008, 0, 1) };
    expect(searchPeople([adulto], '91234', { now: HOJE }).results).toHaveLength(0);
  });

  it('specs de dígitos incluem os campos do responsável', () => {
    const specs = searchCandidateSpecs('912', 20);
    const g = specs.find((s) => s.wheres[0].field === 'guardianPhoneDigits');
    const gRev = specs.find((s) => s.wheres[0].field === 'guardianPhoneDigitsRev');
    expect(g.wheres[0]).toEqual({ field: 'guardianPhoneDigits', op: '>=', value: '912' });
    expect(gRev.wheres[0]).toEqual({ field: 'guardianPhoneDigitsRev', op: '>=', value: '219' });
  });
});
```

Run: `npx vitest run src/lib/__tests__/globalSearch.test.js`
Expected: FAIL nos testes novos e no de 7 specs.

- [ ] **Step 2: Implementar em `src/lib/globalSearch.js`**

Logo depois do comentário de abertura, acrescentar o import:

```js
import { contactOf } from './guardian.js';
```

`guardian.js` só importa `dates.js`, então `leads.js → globalSearch.js → guardian.js → dates.js` não fecha ciclo.

Trocar a assinatura de `searchPeople`:

```js
export function searchPeople(leads, query, { limit = 8, now = new Date() } = {}) {
```

E, no comentário acima dela, trocar `matchKind: 'name'|'phone'|'cpf'` por `matchKind: 'name'|'phone'|'cpf'|'guardian'`. No bloco `if (tier === -1 && digitsOn) {`, depois do `else if` do CPF, acrescentar:

```js
      // camada 4: dígitos do telefone do responsável, só enquanto ele é o contato
      else if (contactOf(lead, now).viaGuardian && onlyDigits(lead.guardian.phone).includes(qDigits)) {
        tier = 4; matchKind = 'guardian';
      }
```

Em `searchCandidateSpecs`, dentro do `if (qDigits.length >= 3)`, depois do spec de `cpfDigits`, acrescentar:

```js
    specs.push({
      wheres: [
        { field: 'guardianPhoneDigits', op: '>=', value: qDigits },
        { field: 'guardianPhoneDigits', op: '<', value: qDigits + SEARCH_HIGH },
      ],
      orderBy: { field: 'guardianPhoneDigits', dir: 'asc' },
      limit: pageSize,
    });
    specs.push({
      wheres: [
        { field: 'guardianPhoneDigitsRev', op: '>=', value: rev },
        { field: 'guardianPhoneDigitsRev', op: '<', value: rev + SEARCH_HIGH },
      ],
      orderBy: { field: 'guardianPhoneDigitsRev', dir: 'asc' },
      limit: pageSize,
    });
```

No comentário de `searchCandidateSpecs`, abaixo da linha do CPF, acrescentar:

```js
//   - responsável: range em guardianPhoneDigits (prefixo) + guardianPhoneDigitsRev (sufixo).
```

- [ ] **Step 3: Linha do resultado**

Em `src/components/layout/GlobalSearch.jsx`, importar `import { contactLabel, contactOf } from '../../lib/guardian.js';` e trocar o cálculo de `sub` em `SearchResultRow`:

```js
  const contato = contactOf(lead);
  const sub = row.matchKind === 'cpf'
    ? `CPF ${fmtCpf(lead.cpf)}`
    : contato.viaGuardian
      ? `resp.: ${contactLabel(contato)}`
      : (fmtPhone(lead.whatsapp) || row.state.hint);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/globalSearch.test.js && npx eslint src/lib/globalSearch.js src/components/layout/GlobalSearch.jsx`
Expected: PASS e lint limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/globalSearch.js src/components/layout/GlobalSearch.jsx src/lib/__tests__/globalSearch.test.js
git commit -m "feat: busca global acha o menor pelo telefone do responsável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Cartão do responsável (`api/_zapCard.js`)

**Files:**
- Modify: `api/_zapCard.js`
- Test: `api/__tests__/zapCard.test.js`

- [ ] **Step 1: Testes que falham**

Trocar o import no topo de `api/__tests__/zapCard.test.js` por:

```js
import { buildZapCard, buildZapWard, buildGuardianCard } from '../_zapCard.js';
```

E acrescentar no fim:

```js
describe('cartão do responsável', () => {
  const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
  const pedro = {
    id: 'k1', name: 'Pedro Souza', lifecycleStage: 'lead', status: 'Novo', source: 'Instagram',
    consultantName: 'Bruno', isMinor: true, guardian: MAE, cpf: '12345678900',
    createdAt: new Date(2026, 7, 1),
  };
  const ana = { ...pedro, id: 'k2', name: 'Ana Souza', guardian: { ...MAE, name: 'Maria S.' }, createdAt: new Date(2026, 8, 1) };

  it('menor em wards: cartão de lead sem found, com parentesco, e sem campo fora da lista', () => {
    const w = buildZapWard(pedro, HOJE);
    expect(w).toMatchObject({ leadId: 'k1', kind: 'lead', name: 'Pedro Souza', stage: 'Novo', relationship: 'Mãe' });
    expect('found' in w).toBe(false);
    expect(Object.keys(w).sort()).toEqual([
      'appointment', 'consultantName', 'kind', 'lastInteractionAt', 'leadId', 'name', 'relationship', 'source', 'stage', 'strip',
    ]);
  });

  it('só menores: tipo responsável, nome do menor cadastrado por último, menores em ordem de nome', () => {
    const card = buildGuardianCard([pedro, ana], HOJE);
    expect(card.found).toBe(true);
    expect(card.kind).toBe('responsavel');
    expect(card.name).toBe('Maria S.');
    expect(card.wards.map((w) => w.name)).toEqual(['Ana Souza', 'Pedro Souza']);
    expect(Object.keys(card).sort()).toEqual(['found', 'kind', 'name', 'wards']);
  });
});
```

Run: `npx vitest run api/__tests__/zapCard.test.js`
Expected: FAIL, `buildZapWard is not a function`.

- [ ] **Step 2: Implementar em `api/_zapCard.js`**

No comentário do topo, acrescentar ao fim do primeiro parágrafo: "O cartão do responsável (`buildGuardianCard`) é o único que leva um dado de outra pessoa: o nome de quem responde pelo menor, digitado no cadastro do menor."

No fim do arquivo:

```js
const createdMs = (lead) => getSafeDateOrNull(lead?.createdAt)?.getTime() ?? 0;
const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR');

// Menor dentro de `wards`: o cartão de sempre, sem `found` (quem está no
// cartão é o responsável) e com o parentesco de quem responde por ele.
export function buildZapWard(lead, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  const card = buildZapCard(lead, now, checkpoints);
  delete card.found;
  card.relationship = lead.guardian?.relationship ?? null;
  return card;
}

export function buildZapWards(minors, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  return minors.map((m) => buildZapWard(m, now, checkpoints)).sort(byName);
}

// Quem escreveu não tem cadastro próprio, mas responde por menores. O nome é o
// que foi digitado no menor cadastrado por último: irmãos podem ter o nome da
// mãe escrito de jeitos diferentes, e vale o mais recente.
export function buildGuardianCard(minors, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  const maisRecente = [...minors].sort((a, b) => createdMs(b) - createdMs(a))[0];
  return {
    found: true,
    kind: 'responsavel',
    name: maisRecente?.guardian?.name ?? null,
    wards: buildZapWards(minors, now, checkpoints),
  };
}
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapCard.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/_zapCard.js api/__tests__/zapCard.test.js
git commit -m "feat: cartão do Zap para o responsável e para os menores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Rota do Zap (`api/zap.js`)

**Files:**
- Modify: `api/zap.js`
- Test: `api/__tests__/zapRoute.test.js`

- [ ] **Step 1: Testes que falham**

Em `api/__tests__/zapRoute.test.js`, logo depois da constante `clienteAVencer`, acrescentar as fixtures:

```js
// Mãe de menores, sem cadastro próprio. Como o Zap manda o número dela.
const MAE = '5511912345678';
const guardiaoDaMae = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const menorDe = (id, name, extra = {}) => ({
  id,
  name,
  lifecycleStage: 'lead',
  status: 'Novo',
  isMinor: true,
  guardian: guardiaoDaMae,
  guardianZapMatchKey: zapMatchKey(MAE),
  birthDate: ts(new Date(2015, 4, 10)),
  createdAt: ts(new Date(2026, 7, 1)),
  ...extra
});
```

Dentro de `describe('GET /api/zap', ...)`, acrescentar:

```js
  const pedidoDaMae = () => { const p = pedido(); p.query.phone = MAE; return p; };

  it('mãe sem cadastro: cartão do tipo responsável com os dois filhos em ordem de nome', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza'), menorDe('k2', 'Ana Souza')];
    const res = resposta();

    await handler(pedidoDaMae(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(res.body.wards.map((w) => w.name)).toEqual(['Ana Souza', 'Pedro Souza']);
    expect(res.body.wards[0]).toMatchObject({ kind: 'lead', relationship: 'Mãe' });
  });

  it('mãe que também é cliente: o cartão dela, com os filhos em wards', async () => {
    banco.leads[TENANT] = [{ ...clienteAVencer, zapMatchKey: zapMatchKey(MAE) }, menorDe('k1', 'Pedro Souza')];
    const res = resposta();

    await handler(pedidoDaMae(), res);

    expect(res.body).toMatchObject({ found: true, kind: 'cliente', leadId: 'c1' });
    expect(res.body.wards.map((w) => w.leadId)).toEqual(['k1']);
  });

  it('cartão sem filhos não ganha a chave wards', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedido(), res);

    expect('wards' in res.body).toBe(false);
  });

  it('quem fez 18 com WhatsApp próprio sai da lista; sem ninguém, found false', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { birthDate: ts(new Date(2008, 0, 1)), whatsapp: '(11) 9 5555-4444' })];
    const res = resposta();

    await handler(pedidoDaMae(), res);

    expect(res.body).toEqual({ found: false });
  });

  it('quem fez 18 sem WhatsApp próprio continua na lista', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { birthDate: ts(new Date(2008, 0, 1)) })];
    const res = resposta();

    await handler(pedidoDaMae(), res);

    expect(res.body.wards.map((w) => w.leadId)).toEqual(['k1']);
  });

  it('o próprio dono do número não aparece como filho dele mesmo', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { zapMatchKey: zapMatchKey(MAE) })];
    const res = resposta();

    await handler(pedidoDaMae(), res);

    expect(res.body).toMatchObject({ found: true, kind: 'lead', leadId: 'k1' });
    expect('wards' in res.body).toBe(false);
  });

  it('nome do responsável vem do menor cadastrado por último', async () => {
    banco.leads[TENANT] = [
      menorDe('k1', 'Pedro Souza', { guardian: { ...guardiaoDaMae, name: 'Maria' }, createdAt: ts(new Date(2026, 5, 1)) }),
      menorDe('k2', 'Ana Souza', { guardian: { ...guardiaoDaMae, name: 'Maria Souza Lima' }, createdAt: ts(new Date(2026, 7, 20)) })
    ];
    const res = resposta();

    await handler(pedidoDaMae(), res);

    expect(res.body.name).toBe('Maria Souza Lima');
  });
```

Dentro de `describe('POST /api/zap com action match', ...)`, acrescentar:

```js
  it('telefone de responsável de menor conta como encontrado', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();

    await handler(pedidoMatch([MAE, '5511900000000']), res);

    expect(res.body).toEqual({ found: [MAE] });
  });

  it('responsável de quem fez 18 com WhatsApp próprio não conta', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { birthDate: ts(new Date(2008, 0, 1)), whatsapp: '(11) 9 5555-4444' })];
    const res = resposta();

    await handler(pedidoMatch([MAE]), res);

    expect(res.body).toEqual({ found: [] });
  });
```

O `describe` do `match` não fixa a data. Os dois testes acima dependem de "hoje" ser depois de 01/01/2026 (o menor de 2015 segue menor até 2033), o que vale no relógio real. Se preferir, copie para ele o `beforeEach`/`afterEach` de data falsa do `describe` do GET.

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: FAIL nos testes novos (a rota não procura `guardianZapMatchKey`).

- [ ] **Step 2: Implementar em `api/zap.js`**

Trocar o import de `buildZapCard` por:

```js
import { buildZapCard, buildGuardianCard, buildZapWards } from './_zapCard.js';
import { contactOf } from '../src/lib/guardian.js';
```

Logo abaixo de `const MATCH_MAX = 30; // teto do operador \`in\` do Firestore`, acrescentar:

```js
// Menores por responsável lidos por consulta. Irmãos de verdade passam longe
// disso; o teto só impede um número muito compartilhado de pesar a rota.
const WARDS_MAX = 10;

// Campos de data que os módulos puros esperam como Date. O Firestore devolve
// Timestamp.
const DATE_FIELDS = [
  'currentContractStartsAt', 'currentContractEndsAt',
  'appointmentScheduledFor', 'nextFollowUp', 'lastInteractionAt',
  'birthDate', 'createdAt'
];

const leadDoDoc = (doc) => {
  const lead = { id: doc.id, ...doc.data() };
  for (const campo of DATE_FIELDS) {
    if (lead[campo]?.toDate) lead[campo] = lead[campo].toDate();
  }
  return lead;
};
```

No `handler` do GET, trocar tudo desde `const achados = await leadsCollection(...)` até o `res.status(200).json(buildZapCard(lead, new Date(), renewalCheckpoints));` por:

```js
  // O dono do número e os menores que o têm como responsável, juntos.
  const [achados, menoresSnap] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get(),
    leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(WARDS_MAX).get()
  ]);

  const agora = new Date();
  const dono = achados.empty ? null : leadDoDoc(achados.docs[0]);
  // Só quem ainda tem o responsável como contato (menor, ou que fez 18 sem
  // WhatsApp próprio), e nunca o próprio dono do número.
  const menores = menoresSnap.docs
    .map(leadDoDoc)
    .filter((m) => m.id !== dono?.id && contactOf(m, agora).viaGuardian);

  if (!dono && menores.length === 0) {
    res.status(200).json({ found: false });
    return;
  }

  // Marcos de renovação da academia. Só lê depois de achar alguém — em
  // 'found: false' não há faixa pra montar, então não vale o custo da
  // consulta. Doc inexistente (academia nunca abriu Configurações → Metas &
  // ritmo) ou campo ausente/malformado: buildZapCard/buildZapStrip caem no
  // padrão 90/60/30 sozinhos, não precisa validar aqui.
  const configSnap = await adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(CONFIG_PATH).doc(CONFIG_GENERAL_ID).get();
  const renewalCheckpoints = configSnap.exists ? configSnap.data()?.renewalCheckpoints : undefined;

  let card;
  if (dono) {
    card = buildZapCard(dono, agora, renewalCheckpoints);
    if (menores.length > 0) card.wards = buildZapWards(menores, agora, renewalCheckpoints);
  } else {
    card = buildGuardianCard(menores, agora, renewalCheckpoints);
  }

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(card);
```

Em `handleMatch`, trocar a consulta final (de `const snap = await leadsCollection(tenantId)` até o `return res.status(200).json({ found: [...found] });`) por:

```js
  const chaves = [...porMatchKey.keys()];
  const [snap, snapMenores] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', 'in', chaves).select('zapMatchKey').get(),
    leadsCollection(tenantId)
      .where('guardianZapMatchKey', 'in', chaves)
      .select('guardianZapMatchKey', 'isMinor', 'guardian', 'birthDate', 'whatsapp')
      .get()
  ]);
  const found = new Set();
  for (const doc of snap.docs) {
    for (const phone of porMatchKey.get(doc.data()?.zapMatchKey) || []) found.add(phone);
  }
  // Responsável conta como cadastro enquanto é o contato do menor.
  const agora = new Date();
  for (const doc of snapMenores.docs) {
    const menor = leadDoDoc(doc);
    if (!contactOf(menor, agora).viaGuardian) continue;
    for (const phone of porMatchKey.get(menor.guardianZapMatchKey) || []) found.add(phone);
  }
  return res.status(200).json({ found: [...found] });
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js api/__tests__/zapCard.test.js`
Expected: PASS em todos, novos e antigos (incluindo "lote vazio responde lista vazia sem consultar os leads" e os 401 de identificador).

- [ ] **Step 4: Nenhuma função nova e nenhum import proibido**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
grep -rn "dailyGoal" api/*.js src/lib/guardian.js
```

Expected: o mesmo número de funções de antes (11) e nenhuma ocorrência de `dailyGoal`.

- [ ] **Step 5: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: ponte do Zap reconhece o telefone do responsável do menor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Documentação, verificação e conferência na tela

**Files:**
- Modify: `CLAUDE.md` (do Stronilead, na raiz do worktree)

- [ ] **Step 1: Seção nova no `CLAUDE.md` do Stronilead**

Logo antes de `## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09`, acrescentar:

```markdown
## Responsável do menor de idade

Lead que é criança leva a chave "Menor de idade" e o responsável (nome, telefone e parentesco), no cadastro e na aba Identidade da edição. O responsável vira o contato em todo lugar. Spec em `docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md`.

- **Regra única em `src/lib/guardian.js`.** `contactOf(lead)` diz quem o consultor chama; `isMinorNow` diz se o lead é menor agora. Todo botão de WhatsApp e de Ligar passa por `contactOf` e `whatsappHref`/`telHref`. Não ler `lead.whatsapp` para chamar alguém.
- **Os 18 anos não são gravados.** A regra roda toda vez que o lead é lido: com data de nascimento, no dia dos 18 anos a pessoa vira adulta sozinha. Sem WhatsApp próprio, o responsável continua como contato e a ficha pede o número.
- **Dados no próprio lead:** `isMinor`, `guardian { name, phone, relationship }` e os derivados `guardianPhoneDigits`, `guardianPhoneDigitsRev` e `guardianZapMatchKey`. Quem grava é `buildGuardianPatch` (`src/lib/leadDerived.js`), só no cadastro e na edição. Ele fica fora de `buildLeadSearchFields` de propósito: as outras escritas chamam essa sem o responsável e apagariam os campos.
- **Telefone do responsável nunca barra cadastro.** Irmãos dividem o número da mãe. O aviso sai de `phoneNoticeLines` (`src/lib/phoneNotice.js`).
- **Stronizap:** `api/zap.js` procura também por `guardianZapMatchKey`. Número só de responsável volta como cartão `kind: 'responsavel'`; dono que também é responsável volta com `wards`. O `match` conta o responsável como cadastro. O nome que sai no cartão do responsável é o que foi digitado no menor cadastrado por último.
```

- [ ] **Step 2: Verificação completa**

```bash
npm test
npm run lint
npm run build
npm run verificar:sentry
```

Expected: tudo verde. Anotar o número de testes da suíte para a descrição do PR.

- [ ] **Step 3: Conferência na tela (preview local)**

Rodar o app pela configuração do `.claude/launch.json` (porta 5180) e, logado numa academia de teste:
1. Novo lead com a chave ligada: sem nome ou telefone do responsável o botão fica travado; com data de quem tem 18 anos aparece "Pela data, já tem 18 anos..." e não salva; um menor sem WhatsApp próprio entra.
2. Segundo irmão com o mesmo telefone do responsável: entra, com o aviso "Maria já é responsável de ...".
3. Ficha do menor: etiqueta "Menor de idade", célula "Contato (responsável)", e o WhatsApp abre `wa.me/55...` com "Olá Maria".
4. Edição: desligar a chave sem WhatsApp do aluno mostra "Para desligar Menor de idade, informe o WhatsApp do lead."
5. Meta Diária, lista de Leads e busca global pelo telefone da mãe mostram o responsável.
6. A 390px e no tema escuro, o bloco do responsável no cadastro não estoura a largura.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: responsável do menor no CLAUDE.md do Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: PR

- [ ] **Step 1: Abrir o PR (sem merge; o merge é do Johnny, depois do PR do Stronizap em produção)**

```bash
git push -u origin claude/responsavel-do-menor
gh pr create --title "feat: responsável do lead menor de idade" --body "$(cat <<'EOF'
Lead que é criança ganha a chave "Menor de idade" e o responsável (nome, telefone e parentesco). O responsável vira o contato em toda a aplicação e no cartão do Stronizap até a pessoa fazer 18 anos.

- cadastro e edição: chave, campos do responsável e avisos de telefone que nunca barram (irmãos dividem o número da mãe)
- regra única em `src/lib/guardian.js`: quem é menor agora e quem o consultor chama
- ficha, Meta Diária, listas, exportação, relatório e busca global usam o contato
- 18 anos: sem rotina agendada, a regra olha a data de nascimento a cada leitura
- Stronizap: cartão `responsavel` e `wards`, e o `match` conta o número do responsável

**Merge só depois do PR do Stronizap em produção.** Sem ele, o Stronizap mostra a mãe com a etiqueta "Cliente".

Nada a publicar no Firestore: regras iguais, consultas novas de campo único (índice automático).

Spec: `docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Depois dos dois PRs no ar**

Rodar o smoke do Stronizap com o número de uma mãe de teste (Task 7 do plano do PR 1) e atualizar `~/STRONIX-FIRMA/06-sistemas/CLAUDE.md` (seção "Ponte Stronilead ↔ Stronizap") e a tabela "Últimas Atualizações" do `~/STRONIX-FIRMA/CLAUDE.md`.
