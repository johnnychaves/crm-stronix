# Cadastro completo do cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao cliente (lead matriculado) um cadastro completo — endereço, contato de emergência, RG, estado civil e profissão — editável por um modal em abas que abre no lápis da ficha, com um card de leitura na ficha do cliente.

**Architecture:** A lógica de mapear form ↔ documento do lead vive numa lib pura e testada (`clientRegistration.js`). O modal (`ClientRegistrationModal.jsx`) é fino: só UI em abas usando os componentes reais do app. A `LeadProfileView` passa a abrir esse modal quando o registro é cliente e ganha um card de leitura (`ClientRegistrationCard.jsx`).

**Tech Stack:** React 19 + Vite, Firestore (`updateDoc`), Vitest, Tailwind v4 (tokens do app), componentes `components/ui/*`, helpers `lib/brazilLookups.js` e `lib/leadDerived.js`.

**Fonte visual:** o mockup aprovado (direção B, abas) em `scratchpad/cadastro-cliente-mockups.html` e o padrão do `src/modals/EditLeadModal.jsx`. Portar com os componentes do app (`StyledInput`/`StyledSelect`/`Field`/`Btn`/`Dialog`), não com o CSS cru do mockup.

---

## File Structure

- **Create** `src/lib/masks.js` — máscaras compartilhadas `formatCPF`, `formatPhone` (hoje duplicadas dentro dos modais).
- **Create** `src/lib/__tests__/masks.test.js`
- **Create** `src/lib/clientRegistration.js` — `MARITAL_STATUS_OPTIONS`, `readClientRegistration(lead)`, `buildClientRegistrationPatch(form, ctx)`, `computeCompleteness(form)`.
- **Create** `src/lib/__tests__/clientRegistration.test.js`
- **Create** `src/components/ui/TagsInput.jsx` — extraído do `EditLeadModal` (chips de etiqueta), reusado nos dois modais.
- **Modify** `src/modals/EditLeadModal.jsx` — passa a importar `formatCPF`/`formatPhone` de `lib/masks.js` e `TagsInput` de `components/ui/TagsInput.jsx` (remove as cópias locais).
- **Create** `src/modals/ClientRegistrationModal.jsx` — o cadastro completo do cliente, em abas.
- **Create** `src/components/profile/ClientRegistrationCard.jsx` — card de leitura na ficha.
- **Modify** `src/views/LeadProfileView.jsx` — o lápis abre `ClientRegistrationModal` p/ cliente; renderiza o card de leitura p/ cliente.

Sem migração, sem índice, sem mudança de regras Firestore (a regra de update de lead já é agnóstica de campo).

---

## Task 1: Máscaras compartilhadas (`lib/masks.js`)

**Files:**
- Create: `src/lib/masks.js`
- Test: `src/lib/__tests__/masks.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/masks.test.js
import { describe, it, expect } from 'vitest';
import { formatCPF, formatPhone } from '../masks.js';

describe('formatCPF', () => {
  it('mascara progressivamente e limita a 11 dígitos', () => {
    expect(formatCPF('034')).toBe('034');
    expect(formatCPF('03456')).toBe('034.56');
    expect(formatCPF('0345678')).toBe('034.567.8');
    expect(formatCPF('03456789012')).toBe('034.567.890-12');
    expect(formatCPF('034567890129999')).toBe('034.567.890-12');
    expect(formatCPF('')).toBe('');
  });
});

describe('formatPhone', () => {
  it('mascara telefone celular com DDD', () => {
    expect(formatPhone('51')).toBe('(51');
    expect(formatPhone('5199530')).toBe('(51) 99530');
    expect(formatPhone('51995304633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/masks.test.js`
Expected: FAIL — `Cannot find module '../masks.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/masks.js
// Máscaras de documento/telefone brasileiras. Fonte única (antes duplicadas
// em EditLeadModal/AddLeadModal). Guardam dígitos internamente e formatam
// progressivamente na digitação.

// CPF: 000.000.000-00 (máx. 11 dígitos).
export const formatCPF = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

// Telefone: (51) 9 0000-0000 (máx. 11 dígitos).
export const formatPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/masks.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/masks.js src/lib/__tests__/masks.test.js
git commit -m "feat: lib de máscaras compartilhadas (CPF/telefone)"
```

---

## Task 2: Lib do cadastro (`lib/clientRegistration.js`)

Núcleo testável. `buildClientRegistrationPatch` transforma o form no patch de `updateDoc`. `readClientRegistration` faz o caminho inverso (lead → form). `computeCompleteness` calcula o medidor.

**Files:**
- Create: `src/lib/clientRegistration.js`
- Test: `src/lib/__tests__/clientRegistration.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/clientRegistration.test.js
import { describe, it, expect } from 'vitest';
import {
  MARITAL_STATUS_OPTIONS,
  readClientRegistration,
  buildClientRegistrationPatch,
  computeCompleteness,
} from '../clientRegistration.js';
import { buildLeadSearchFields } from '../leadDerived.js';

const baseForm = () => ({
  name: 'Marina Alves Ribeiro',
  whatsapp: '(51) 9 9530-4633',
  cpf: '034.567.890-12',
  rg: '6098765431',
  birthDate: '1994-03-12',
  sexo: 'Feminino',
  email: 'marina@email.com',
  cep: '90035-190', street: 'Rua Ramiro Barcelos', number: '1200',
  complement: 'Apto 502', neighborhood: 'Santana', city: 'Porto Alegre', state: 'RS',
  emgName: 'Rafael Ribeiro', emgPhone: '(51) 9 8811-2200', emgRelation: 'Cônjuge',
  maritalStatus: 'Casado(a)', profession: 'Fisioterapeuta',
  source: 'Indicação', consultantId: '', observation: 'Treina de manhã.', tags: ['VIP'],
});

describe('MARITAL_STATUS_OPTIONS', () => {
  it('tem as opções de estado civil', () => {
    expect(MARITAL_STATUS_OPTIONS).toContain('Solteiro(a)');
    expect(MARITAL_STATUS_OPTIONS).toContain('União estável');
  });
});

describe('buildClientRegistrationPatch', () => {
  it('monta o patch com identidade, mapas e campos de busca', () => {
    const patch = buildClientRegistrationPatch(baseForm(), { isAdmin: false, usersList: [] });
    expect(patch.name).toBe('Marina Alves Ribeiro');
    expect(patch.cpf).toBe('034.567.890-12');
    expect(patch.rg).toBe('6098765431');
    expect(patch.sexo).toBe('Feminino');
    expect(patch.email).toBe('marina@email.com');
    expect(patch.maritalStatus).toBe('Casado(a)');
    expect(patch.profession).toBe('Fisioterapeuta');
    expect(patch.birthDate instanceof Date).toBe(true);
    expect(patch.address).toEqual({
      cep: '90035-190', street: 'Rua Ramiro Barcelos', number: '1200',
      complement: 'Apto 502', neighborhood: 'Santana', city: 'Porto Alegre', state: 'RS',
    });
    expect(patch.emergencyContact).toEqual({
      name: 'Rafael Ribeiro', phone: '(51) 9 8811-2200', relationship: 'Cônjuge',
    });
    // Campos de busca recomputados (dual-write).
    expect(patch).toMatchObject(
      buildLeadSearchFields({ name: baseForm().name, whatsapp: baseForm().whatsapp, cpf: baseForm().cpf })
    );
  });

  it('vazio vira null e mapas vazios viram null', () => {
    const f = { ...baseForm(), rg: '', profession: '', cpf: '', email: '',
      cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
      emgName: '', emgPhone: '', emgRelation: '', birthDate: '' };
    const patch = buildClientRegistrationPatch(f, { isAdmin: false, usersList: [] });
    expect(patch.rg).toBeNull();
    expect(patch.profession).toBeNull();
    expect(patch.cpf).toBeNull();
    expect(patch.email).toBeNull();
    expect(patch.birthDate).toBeNull();
    expect(patch.address).toBeNull();
    expect(patch.emergencyContact).toBeNull();
  });

  it('não-admin não grava campos de consultor', () => {
    const f = { ...baseForm(), consultantId: 'u1' };
    const patch = buildClientRegistrationPatch(f, { isAdmin: false, usersList: [{ id: 'u1', name: 'Ana', authUid: 'a1' }] });
    expect('consultantId' in patch).toBe(false);
    expect('consultantName' in patch).toBe(false);
    expect('consultantAuthUid' in patch).toBe(false);
  });

  it('admin grava consultantName/authUid juntos', () => {
    const f = { ...baseForm(), consultantId: 'u1' };
    const patch = buildClientRegistrationPatch(f, { isAdmin: true, usersList: [{ id: 'u1', name: 'Ana', authUid: 'a1' }] });
    expect(patch.consultantId).toBe('u1');
    expect(patch.consultantName).toBe('Ana');
    expect(patch.consultantAuthUid).toBe('a1');
  });
});

describe('readClientRegistration', () => {
  it('lê um lead com mapas para o form (mascarando cpf/telefone)', () => {
    const lead = {
      name: 'Marina', whatsapp: '(51) 9 9530-4633', cpf: '03456789012', rg: '6098765431',
      sexo: 'Feminino', email: 'm@e.com', maritalStatus: 'Casado(a)', profession: 'Fisio',
      birthDate: null, source: 'Indicação', consultantId: 'u1', observation: 'oi', tags: ['VIP'],
      address: { cep: '90035190', street: 'Rua X', number: '10', complement: '', neighborhood: 'Y', city: 'POA', state: 'RS' },
      emergencyContact: { name: 'Rafa', phone: '51988112200', relationship: 'Cônjuge' },
    };
    const form = readClientRegistration(lead);
    expect(form.name).toBe('Marina');
    expect(form.cpf).toBe('034.567.890-12');
    expect(form.emgPhone).toBe('(51) 9 8811-2200');
    expect(form.street).toBe('Rua X');
    expect(form.emgRelation).toBe('Cônjuge');
    expect(form.tags).toEqual(['VIP']);
  });

  it('lead sem os campos novos não quebra (defaults vazios)', () => {
    const form = readClientRegistration({ name: 'João', whatsapp: '5199999' });
    expect(form.rg).toBe('');
    expect(form.city).toBe('');
    expect(form.emgName).toBe('');
    expect(form.tags).toEqual([]);
  });
});

describe('computeCompleteness', () => {
  it('form cheio ~100% e vazio ~0%', () => {
    expect(computeCompleteness(baseForm())).toBeGreaterThanOrEqual(90);
    const empty = readClientRegistration({ name: 'Só Nome' });
    expect(computeCompleteness(empty)).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/clientRegistration.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Write implementation**

```js
// src/lib/clientRegistration.js
// Regra pura do cadastro completo do cliente. Mapeia form <-> documento do lead
// e calcula o medidor de completude. Mantém o ClientRegistrationModal fino e
// testável (padrão do repo: regra em lib + teste).
import { fromDateInputValue, toDateInputValue } from './dates.js';
import { buildLeadSearchFields } from './leadDerived.js';
import { formatCPF, formatPhone } from './masks.js';

export const MARITAL_STATUS_OPTIONS = [
  'Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)', 'Outro',
];

const str = (v) => String(v ?? '').trim();
const nullify = (v) => (str(v) ? str(v) : null);

// Monta o mapa se pelo menos um subcampo tiver valor; senão null.
const mapOrNull = (obj) => (Object.values(obj).some((v) => str(v)) ? obj : null);

// lead (documento) -> form do modal.
export function readClientRegistration(lead = {}) {
  const a = lead.address || {};
  const e = lead.emergencyContact || {};
  return {
    name: lead.name || '',
    whatsapp: formatPhone(lead.whatsapp || ''),
    cpf: lead.cpf ? formatCPF(lead.cpf) : '',
    rg: lead.rg || '',
    birthDate: toDateInputValue(lead.birthDate),
    sexo: lead.sexo || '',
    email: lead.email || '',
    cep: a.cep || '', street: a.street || '', number: a.number || '',
    complement: a.complement || '', neighborhood: a.neighborhood || '',
    city: a.city || '', state: a.state || '',
    emgName: e.name || '', emgPhone: formatPhone(e.phone || ''), emgRelation: e.relationship || '',
    maritalStatus: lead.maritalStatus || '',
    profession: lead.profession || '',
    source: lead.source || '',
    consultantId: lead.consultantId || '',
    observation: lead.observation || '',
    tags: lead.tags || [],
  };
}

// form do modal -> patch para updateDoc no documento do lead.
export function buildClientRegistrationPatch(form, { isAdmin, usersList } = {}) {
  const patch = {
    name: str(form.name),
    whatsapp: str(form.whatsapp),
    cpf: nullify(form.cpf),
    rg: nullify(form.rg),
    birthDate: fromDateInputValue(form.birthDate),
    sexo: nullify(form.sexo),
    email: nullify(form.email),
    maritalStatus: nullify(form.maritalStatus),
    profession: nullify(form.profession),
    source: str(form.source),
    observation: str(form.observation),
    tags: Array.isArray(form.tags) ? form.tags : [],
    address: mapOrNull({
      cep: str(form.cep), street: str(form.street), number: str(form.number),
      complement: str(form.complement), neighborhood: str(form.neighborhood),
      city: str(form.city), state: str(form.state),
    }),
    emergencyContact: mapOrNull({
      name: str(form.emgName), phone: str(form.emgPhone), relationship: str(form.emgRelation),
    }),
    // Dual-write: campos de busca recomputados a partir do que será gravado.
    ...buildLeadSearchFields({ name: str(form.name), whatsapp: str(form.whatsapp), cpf: nullify(form.cpf) }),
  };
  // Reatribuição de consultor só para admin: grava os três campos juntos
  // (consultantAuthUid é a chave de permissão/atribuição).
  if (isAdmin && form.consultantId) {
    const c = (usersList || []).find((u) => u.id === form.consultantId);
    if (c) {
      patch.consultantId = form.consultantId;
      patch.consultantName = c.name;
      patch.consultantAuthUid = c.authUid || null;
    }
  }
  return patch;
}

// Medidor de completude do cadastro do cliente (0..100). Address e emergência
// contam como 1 cada se tiverem o essencial preenchido.
const COMPLETENESS_CHECKS = [
  (f) => str(f.name), (f) => str(f.whatsapp), (f) => str(f.cpf), (f) => str(f.rg),
  (f) => str(f.birthDate), (f) => str(f.sexo), (f) => str(f.email),
  (f) => str(f.street) && str(f.number) && str(f.city),
  (f) => str(f.emgName) && str(f.emgPhone),
  (f) => str(f.maritalStatus), (f) => str(f.profession),
];

export function computeCompleteness(form = {}) {
  const total = COMPLETENESS_CHECKS.length;
  const filled = COMPLETENESS_CHECKS.filter((fn) => !!fn(form)).length;
  return Math.round((filled / total) * 100);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/clientRegistration.test.js`
Expected: PASS. Se algo do `buildLeadSearchFields` divergir, abra `src/lib/leadDerived.js` e confira o nome dos campos que ele devolve (o teste usa `toMatchObject`, então basta o patch conter esses campos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientRegistration.js src/lib/__tests__/clientRegistration.test.js
git commit -m "feat: lib pura do cadastro completo do cliente + testes"
```

---

## Task 3: Extrair `TagsInput` para componente compartilhado

O `EditLeadModal` define `TagChip`/`TagsInput` inline. Extrair para reusar no novo modal sem duplicar.

**Files:**
- Create: `src/components/ui/TagsInput.jsx`
- Modify: `src/modals/EditLeadModal.jsx` (remove as defs locais, importa o novo)

- [ ] **Step 1: Criar o componente** — copiar `TagChip` + `TagsInput` de `EditLeadModal.jsx` (linhas ~55-108) para o arquivo novo, exportando `TagsInput`:

```jsx
// src/components/ui/TagsInput.jsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

// Chip de etiqueta selecionável.
function TagChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-200 whitespace-nowrap">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-700 dark:hover:text-white -mr-0.5">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Input de etiquetas: chips digitáveis + sugestões. Trabalha sobre string[].
export function TagsInput({ tags, setTags, suggestions = [] }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setVal('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 min-h-11 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] px-2.5 py-2 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition">
        {tags.map((t) => <TagChip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>{t}</TagChip>)}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !val && tags.length) setTags(tags.slice(0, -1));
          }}
          placeholder={tags.length ? '' : 'Digite e pressione Enter…'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px] h-7 placeholder:text-slate-400"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.filter((s) => !tags.includes(s)).slice(0, 5).map((s) => (
            <button key={s} type="button" onClick={() => setTags([...tags, s])}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 hover:text-brand-600 hover:border-brand-300 dark:text-slate-400 dark:hover:text-brand-300 transition inline-flex items-center gap-1">
              <Plus size={10} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Atualizar `EditLeadModal.jsx`** — remover as funções locais `TagChip` e `TagsInput` (linhas ~55-108) e adicionar no topo:

```jsx
import { TagsInput } from '../components/ui/TagsInput.jsx';
```

Mantenha os imports lucide ainda usados por outros trechos (`Calendar, Check, IdCard, Pencil, Phone, User, X`). Remova `Plus` do import se não for mais usado no arquivo depois da remoção.

- [ ] **Step 3: Verificar build/lint do arquivo**

Run: `npx vitest run` (garante que nada quebrou) e `npm run build` para confirmar que o `EditLeadModal` ainda compila.
Expected: sem erros de import.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TagsInput.jsx src/modals/EditLeadModal.jsx
git commit -m "refactor: TagsInput compartilhado (extraído do EditLeadModal)"
```

---

## Task 4: `ClientRegistrationModal.jsx` (modal em abas)

Modal do cadastro completo do cliente. Fino: estado inicializado por `readClientRegistration`, salva com `buildClientRegistrationPatch`, medidor com `computeCompleteness`. Cinco abas. Reusa componentes reais do app. Visual: mockup direção B.

**Files:**
- Create: `src/modals/ClientRegistrationModal.jsx`

- [ ] **Step 1: Implementar o componente**

```jsx
// src/modals/ClientRegistrationModal.jsx
import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { User, MapPin, Phone, Briefcase, Users, Calendar, IdCard, Mail, Check, Pencil } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { isAdminUser } from '../lib/leads.js';
import { lookupCep, isCepComplete, isValidCpf, isCpfComplete } from '../lib/brazilLookups.js';
import { formatCPF, formatPhone } from '../lib/masks.js';
import {
  MARITAL_STATUS_OPTIONS, readClientRegistration, buildClientRegistrationPatch, computeCompleteness,
} from '../lib/clientRegistration.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { TagsInput } from '../components/ui/TagsInput.jsx';
import { Btn } from '../components/ui/Btn.jsx';

const SOURCES = ['Instagram', 'Indicação', 'Site', 'WhatsApp', 'Facebook', 'Google', 'Passou na porta', 'Outro'];

// Abas do cadastro. `done(form)` marca a bolinha verde quando a seção tem dados.
const TABS = [
  { id: 'identidade', label: 'Identidade', icon: User, done: (f) => !!(f.cpf || f.rg || f.birthDate || f.email || f.sexo) },
  { id: 'endereco', label: 'Endereço', icon: MapPin, done: (f) => !!(f.street && f.number && f.city) },
  { id: 'emergencia', label: 'Emergência', icon: Phone, done: (f) => !!(f.emgName && f.emgPhone) },
  { id: 'pessoais', label: 'Pessoais', icon: Briefcase, done: (f) => !!(f.maritalStatus || f.profession) },
  { id: 'relacionamento', label: 'Relacionamento', icon: Users, done: (f) => !!(f.tags?.length || f.observation) },
];

function ClientRegistrationModal({ open, onClose, lead, appUser, db, usersList, tags }) {
  const toast = useToast();
  const isAdmin = isAdminUser(appUser);
  const [form, setForm] = useState(() => readClientRegistration(lead));
  const [tab, setTab] = useState('identidade');
  const [cepBusy, setCepBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pct = useMemo(() => computeCompleteness(form), [form]);
  const cpfInvalid = isCpfComplete(form.cpf) && !isValidCpf(form.cpf);
  const tagSuggestions = (tags || []).map((t) => t.name);

  const onCepBlur = async () => {
    if (!isCepComplete(form.cep)) return;
    setCepBusy(true);
    const r = await lookupCep(form.cep);
    setCepBusy(false);
    if (r) setForm((f) => ({ ...f, street: r.street || f.street, neighborhood: r.neighborhood || f.neighborhood, city: r.city || f.city, state: r.state || f.state }));
    else toast.warning('CEP não encontrado — confira o número.');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.warning('Informe o nome.'); return; }
    setLoading(true);
    try {
      const patch = buildClientRegistrationPatch(form, { isAdmin, usersList });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch);
      toast.success('Cadastro salvo!');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const tabIdx = TABS.findIndex((t) => t.id === tab);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="z-[210] max-w-2xl p-0 gap-0 overflow-hidden" overlayClassName="z-[210]">
        {/* Cabeçalho */}
        <DialogHeader className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Pencil size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-bold tracking-tight leading-tight font-display">Cadastro do cliente</DialogTitle>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{lead.name}</p>
          </div>
        </DialogHeader>

        {/* Medidor de completude */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Cadastro <b className="text-emerald-600 dark:text-emerald-400 num">{pct}%</b> completo</span>
        </div>

        {/* Abas */}
        <div className="flex gap-1 px-3 sm:px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
          {TABS.map((t) => {
            const active = t.id === tab;
            const done = t.done(form);
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition',
                  active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}>
                <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-brand-500' : done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20')} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Corpo da aba ativa */}
        <div className="px-5 sm:px-6 py-5 max-h-[52vh] overflow-y-auto thin-scroll">
          {tab === 'identidade' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Field label="Nome completo" required><StyledInput icon={<User size={15} />} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome e sobrenome" /></Field></div>
              <Field label="WhatsApp" required><StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.whatsapp} onChange={(e) => set('whatsapp', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" /></Field>
              <Field label="CPF" error={cpfInvalid ? 'CPF inválido' : undefined}><StyledInput icon={<IdCard size={15} />} inputMode="numeric" value={form.cpf} onChange={(e) => set('cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" /></Field>
              <Field label="RG"><StyledInput value={form.rg} onChange={(e) => set('rg', e.target.value)} placeholder="Documento de identidade" /></Field>
              <Field label="Data de nascimento"><StyledInput type="date" icon={<Calendar size={15} />} value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></Field>
              <Field label="Sexo"><StyledSelect value={form.sexo} onChange={(e) => set('sexo', e.target.value)}><option value="">Selecione…</option><option>Feminino</option><option>Masculino</option><option>Outro</option></StyledSelect></Field>
              <Field label="E-mail"><StyledInput type="email" icon={<Mail size={15} />} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" /></Field>
            </div>
          )}

          {tab === 'endereco' && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3"><Field label="CEP" hint={cepBusy ? 'Buscando…' : undefined}><StyledInput value={form.cep} onChange={(e) => set('cep', e.target.value)} onBlur={onCepBlur} placeholder="00000-000" /></Field></div>
              <div className="sm:col-span-7"><Field label="Rua / logradouro"><StyledInput value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Av. Exemplo" /></Field></div>
              <div className="sm:col-span-2"><Field label="Número"><StyledInput value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="123" /></Field></div>
              <div className="sm:col-span-5"><Field label="Complemento"><StyledInput value={form.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, andar…" /></Field></div>
              <div className="sm:col-span-7"><Field label="Bairro"><StyledInput value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" /></Field></div>
              <div className="sm:col-span-9"><Field label="Cidade"><StyledInput value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" /></Field></div>
              <div className="sm:col-span-3"><Field label="UF"><StyledInput value={form.state} maxLength={2} onChange={(e) => set('state', e.target.value.toUpperCase())} placeholder="UF" /></Field></div>
            </div>
          )}

          {tab === 'emergencia' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome"><StyledInput icon={<User size={15} />} value={form.emgName} onChange={(e) => set('emgName', e.target.value)} placeholder="Quem acionar" /></Field>
              <Field label="Telefone"><StyledInput icon={<Phone size={15} />} inputMode="numeric" value={form.emgPhone} onChange={(e) => set('emgPhone', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" /></Field>
              <div className="sm:col-span-2"><Field label="Parentesco"><StyledInput value={form.emgRelation} onChange={(e) => set('emgRelation', e.target.value)} placeholder="Cônjuge, pai, mãe, amigo…" /></Field></div>
            </div>
          )}

          {tab === 'pessoais' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Estado civil"><StyledSelect value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}><option value="">Selecione…</option>{MARITAL_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</StyledSelect></Field>
              <Field label="Profissão"><StyledInput icon={<Briefcase size={15} />} value={form.profession} onChange={(e) => set('profession', e.target.value)} placeholder="Ex.: Fisioterapeuta" /></Field>
            </div>
          )}

          {tab === 'relacionamento' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Origem"><StyledSelect value={form.source} onChange={(e) => set('source', e.target.value)}>{!SOURCES.includes(form.source) && form.source && <option value={form.source}>{form.source}</option>}{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</StyledSelect></Field>
                <Field label="Consultor responsável">
                  {isAdmin ? (
                    <StyledSelect value={form.consultantId} onChange={(e) => set('consultantId', e.target.value)}><option value="">Selecione…</option>{(usersList || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</StyledSelect>
                  ) : (
                    <StyledInput value={lead.consultantName || '—'} disabled readOnly />
                  )}
                </Field>
              </div>
              <Field label="Etiquetas"><TagsInput tags={form.tags} setTags={(t) => set('tags', t)} suggestions={tagSuggestions} /></Field>
              <Field label="Observação">
                <textarea value={form.observation} onChange={(e) => set('observation', e.target.value)} rows={3}
                  placeholder="Contexto, preferências, histórico relevante…"
                  className="w-full rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] focus:border-brand-400 dark:focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10 outline-none text-[13.5px] p-3.5 placeholder:text-slate-400 resize-none transition" />
              </Field>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 sm:px-6 py-4 flex items-center gap-2 border-t border-slate-100 dark:border-white/[0.05]">
          <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">Aba {tabIdx + 1} de {TABS.length}</span>
          <div className="ml-auto flex items-center gap-2">
            <Btn kind="soft" size="md" onClick={onClose} disabled={loading}>Cancelar</Btn>
            <Btn kind="brand" size="md" icon={<Check size={14} />} onClick={handleSave} disabled={loading || !form.name.trim()}>
              {loading ? 'Salvando…' : 'Salvar cadastro'}
            </Btn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ClientRegistrationModal };
```

- [ ] **Step 2: Sanidade de compilação**

Run: `npm run build`
Expected: compila sem erro. Confira que `Field` aceita `label`, `required`, `error` e `hint` (ver `src/components/ui/Field.jsx`); o `GymProfileFields` e o `MatriculaModal` usam `label`/`hint`/`error`. Se `required` não existir no `Field`, marque o obrigatório como o padrão do repo (o `Field` do EditLeadModal usa um `FieldLabel` próprio com asterisco — nesse caso, ou adicione suporte a `required` no `Field`, ou envolva o label). Ajuste só o necessário para bater com o `Field` real.

- [ ] **Step 3: Commit**

```bash
git add src/modals/ClientRegistrationModal.jsx
git commit -m "feat: ClientRegistrationModal (cadastro completo do cliente em abas)"
```

---

## Task 5: Abrir o modal certo no lápis (`LeadProfileView`)

O lápis já faz `setIsEditing(true)` e renderiza `EditLeadModal` (~linha 1445). Para cliente, renderizar `ClientRegistrationModal`.

**Files:**
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Importar o novo modal** — no topo, junto dos outros imports de modais:

```jsx
import { ClientRegistrationModal } from '../modals/ClientRegistrationModal.jsx';
```

- [ ] **Step 2: Branch no render do modal** — localizar o bloco que renderiza `<EditLeadModal open={isEditing} ... />` (~linha 1445) e trocá-lo por um branch em `isClient` (a variável `isClient` já existe, ~linha 521). Use exatamente os mesmos props que o `EditLeadModal` já recebia (copie-os do JSX atual — não invente nomes):

```jsx
{isClient ? (
  <ClientRegistrationModal
    open={isEditing}
    onClose={() => setIsEditing(false)}
    lead={lead}
    appUser={appUser}
    db={db}
    usersList={usersList}
    tags={tags}
  />
) : (
  <EditLeadModal
    open={isEditing}
    onClose={() => setIsEditing(false)}
    lead={lead}
    appUser={appUser}
    db={db}
    usersList={usersList}
    tags={tags}
  />
)}
```

Se o `EditLeadModal` atual só é montado quando `isEditing` é true (em vez de sempre receber `open`), mantenha o mesmo padrão de montagem para os dois ramos.

- [ ] **Step 3: Verificar no preview**

Iniciar preview (porta do `.claude/launch.json`), abrir a ficha de um CLIENTE, clicar no lápis → deve abrir o `ClientRegistrationModal` (abas). Abrir a ficha de um LEAD, clicar no lápis → deve abrir o `EditLeadModal` enxuto.

- [ ] **Step 4: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "feat: lápis do cliente abre o cadastro completo"
```

---

## Task 6: Card de leitura na ficha (`ClientRegistrationCard`)

**Files:**
- Create: `src/components/profile/ClientRegistrationCard.jsx`
- Modify: `src/views/LeadProfileView.jsx` (renderizar o card p/ cliente)

- [ ] **Step 1: Criar o componente**

```jsx
// src/components/profile/ClientRegistrationCard.jsx
import { User, MapPin, Phone, Briefcase, IdCard, Pencil, Check } from 'lucide-react';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { computeCompleteness, readClientRegistration } from '../../lib/clientRegistration.js';
import { cn } from '../../lib/utils.js';

const yearsFrom = (d) => {
  const dt = getSafeDateOrNull(d);
  if (!dt) return null;
  const now = new Date();
  let a = now.getFullYear() - dt.getFullYear();
  const m = now.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};

function KV({ k, v }) {
  if (!v) return null;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold mb-0.5">{k}</div>
      <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{v}</div>
    </div>
  );
}

function Block({ icon, title, children, empty, onEdit }) {
  return (
    <div className="py-3.5 border-b border-slate-100 dark:border-white/[0.05] last:border-b-0">
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">{icon}{title}</div>
      {empty ? (
        <button onClick={onEdit} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 border border-dashed border-brand-300 dark:border-brand-500/30 rounded-lg px-3 py-1.5 transition hover:bg-brand-100/70">
          <Pencil size={12} /> {title === 'Endereço' ? 'Adicionar endereço' : title === 'Contato de emergência' ? 'Adicionar contato' : 'Adicionar'}
        </button>
      ) : children}
    </div>
  );
}

// Card de leitura do cadastro do cliente. Só mostra blocos com dados; blocos
// vazios viram um atalho "Adicionar" que abre o modal (onEdit).
function ClientRegistrationCard({ lead, onEdit, readOnly = false }) {
  const f = readClientRegistration(lead);
  const pct = computeCompleteness(f);
  const age = yearsFrom(lead.birthDate);
  const hasAddress = !!(f.street || f.city || f.cep);
  const hasEmg = !!(f.emgName || f.emgPhone);
  const addressLine1 = [f.street, f.number].filter(Boolean).join(', ') + (f.complement ? ` · ${f.complement}` : '');
  const addressLine2 = [[f.neighborhood, f.city].filter(Boolean).join(' · '), f.state, f.cep].filter(Boolean).join(' · ');

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.05]">
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><IdCard size={16} /></span>
        <h3 className="font-display text-[14.5px] font-bold tracking-tight">Cadastro</h3>
        <span className={cn('ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md',
          pct >= 80 ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' : 'text-accent-600 bg-accent-50 dark:text-accent-300 dark:bg-accent-500/10')}>
          {pct >= 80 && <Check size={12} />}<span className="num">{pct}%</span> completo
        </span>
        {!readOnly && (
          <button onClick={onEdit} title="Editar cadastro" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 border border-slate-200 dark:border-white/10 hover:text-brand-600 hover:border-brand-300 transition"><Pencil size={15} /></button>
        )}
      </div>
      <div className="px-5 pb-4">
        <Block icon={<User size={13} />} title="Identidade">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <KV k="CPF" v={f.cpf} />
            <KV k="RG" v={f.rg} />
            <KV k="Nascimento" v={f.birthDate ? `${getSafeDateOrNull(lead.birthDate)?.toLocaleDateString('pt-BR')}${age != null ? ` · ${age} anos` : ''}` : null} />
            <KV k="Sexo" v={f.sexo} />
            <div className="col-span-2"><KV k="E-mail" v={f.email} /></div>
          </div>
        </Block>
        <Block icon={<MapPin size={13} />} title="Endereço" empty={!hasAddress} onEdit={onEdit}>
          <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{addressLine1 || '—'}</div>
          {addressLine2 && <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{addressLine2}</div>}
        </Block>
        <Block icon={<Phone size={13} />} title="Contato de emergência" empty={!hasEmg} onEdit={onEdit}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <KV k="Nome" v={f.emgName} />
            <KV k="Telefone" v={f.emgPhone} />
            <KV k="Parentesco" v={f.emgRelation} />
          </div>
        </Block>
        {(f.maritalStatus || f.profession) && (
          <Block icon={<Briefcase size={13} />} title="Dados pessoais">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <KV k="Estado civil" v={f.maritalStatus} />
              <KV k="Profissão" v={f.profession} />
            </div>
          </Block>
        )}
      </div>
    </section>
  );
}

export { ClientRegistrationCard };
```

- [ ] **Step 2: Renderizar na ficha (só cliente)** — em `LeadProfileView.jsx`, importar e inserir o card na coluna do perfil, visível quando `isClient`. Importar no topo:

```jsx
import { ClientRegistrationCard } from '../components/profile/ClientRegistrationCard.jsx';
```

Inserir o card logo após o alerta contextual (`contextAlert`, ~linha 1057-1060) e antes do conteúdo em coluna única (~linha 1205), passando `onEdit` que abre o modal e `readOnly` conforme a permissão da tela:

```jsx
{isClient && (
  <div className="mb-5">
    <ClientRegistrationCard lead={lead} onEdit={() => setIsEditing(true)} readOnly={isReadOnly} />
  </div>
)}
```

Use a mesma flag de somente-leitura que o header usa para esconder o lápis (no header é `!isReadOnly`). Se o nome da variável for outro, use o mesmo do header.

- [ ] **Step 3: Verificar no preview**

Abrir ficha de cliente: o card "Cadastro" aparece com os dados; o lápis do card e o do header abrem o mesmo modal. Preencher pelo modal, salvar, e o card reflete. Cliente sem endereço mostra "Adicionar endereço".

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/ClientRegistrationCard.jsx src/views/LeadProfileView.jsx
git commit -m "feat: card de leitura do cadastro na ficha do cliente"
```

---

## Task 7: Verificação end-to-end e fechamento

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: tudo verde (incluindo os testes existentes).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erro.

- [ ] **Step 3: Smoke no preview (skill `verify`)**

- Ficha de CLIENTE → lápis → modal em abas abre; navegar pelas 5 abas; CEP autopreenche; CPF inválido mostra aviso; medidor sobe ao preencher.
- Salvar → toast de sucesso; reabrir a ficha → dados persistiram (identidade, endereço, emergência, pessoais).
- Card "Cadastro" reflete os dados; bloco vazio mostra "Adicionar".
- Ficha de LEAD → lápis → `EditLeadModal` enxuto (inalterado).

- [ ] **Step 4: Abrir PR**

```bash
git push -u origin claude/customer-registration-redesign-b9f034
gh pr create --title "feat: cadastro completo do cliente" --body "Cadastro completo do cliente (endereço, contato de emergência, RG, estado civil, profissão) em modal de abas no lápis da ficha + card de leitura. Spec: docs/superpowers/specs/2026-07-20-cadastro-completo-cliente-design.md. Sem migração/índice/regras."
```

Merge só com aprovação do Johnny.

---

## Self-Review (cobertura do spec)

- Endereço, emergência, documentos & pessoais → Tasks 2/4/6. ✅
- Só cliente vê o completo (lead mantém enxuto) → Task 5 (branch `isClient`). ✅
- Entrada no lápis → Task 5. ✅
- Card de leitura na ficha → Task 6. ✅
- Só Nome obrigatório + medidor → `computeCompleteness` (Task 2) + validação do `handleSave` (Task 4). ✅
- E-mail/sexo editáveis (voltam) → aba Identidade (Task 4). ✅
- Sem foto, sem saúde → não há tais campos. ✅
- Sem migração/índice/regras → só campos novos no doc do lead. ✅
- Lógica testável em lib + teste → Tasks 1/2. ✅
