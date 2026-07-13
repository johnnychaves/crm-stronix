# Cadastro completo de clientes no superadmin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao superadmin um cadastro de cliente completo (paridade exata com a tela "Perfil da academia"), tanto ao criar quanto ao editar cada organização.

**Architecture:** Extrair os campos + comportamentos (lookup de CNPJ/CEP, validação de CPF) num componente único `GymProfileFields`, consumido por três telas. Centralizar o mapeamento form↔tenant num helper de lib testável. O único backend a mudar é `provision-tenant.js` (passa a gravar `profile`); os caminhos de edição já aceitam tudo.

**Tech Stack:** React 19 + Vite + Vitest + Firebase (Firestore/Admin SDK). Sem TypeScript. Componentes legados próprios (`Field`, `StyledInput`, `SettingsCard`, `Btn`). Lookups em `src/lib/brazilLookups.js` (BrasilAPI + ViaCEP).

**Nota sobre TDD:** A lógica pura (Task 1) segue TDD estrito com Vitest. As tarefas de UI e do handler serverless são verificadas por build + lint + preview ao vivo, que é a prática real deste repo (não há testes de componente/handler aqui).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/gymProfile.js` | Fonte única do form do perfil: `EMPTY_PROFILE`, `buildTenantProfilePayload` (form→tenant), `readTenantProfile` (tenant→form) | Criar |
| `src/lib/__tests__/gymProfile.test.js` | Testes das duas conversões | Criar |
| `src/components/profile/GymProfileFields.jsx` | Os 3 blocos de campos + lookups + validação de CPF, controlados por `value`/`onChange` | Criar |
| `src/views/settings/GymProfileTab.jsx` | Refatorar para consumir os dois acima (mantém carteira + anel) | Modificar |
| `api/provision-tenant.js` | Aceitar e gravar `profile` via `sanitizeProfile` | Modificar |
| `src/views/superadmin/SuperAdminView.jsx` | Seção recolhível "Dados da empresa" no form de criação + envio do payload | Modificar |
| `src/views/superadmin/TenantManageModal.jsx` | Nova aba "Perfil"; mover Cidade/UF para lá | Modificar |

---

### Task 1: Helpers de mapeamento do perfil (lib pura, TDD)

**Files:**
- Create: `src/lib/gymProfile.js`
- Test: `src/lib/__tests__/gymProfile.test.js`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/__tests__/gymProfile.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE, buildTenantProfilePayload, readTenantProfile } from '../gymProfile.js';

describe('gymProfile', () => {
  it('EMPTY_PROFILE tem os 16 campos planos vazios', () => {
    expect(Object.keys(EMPTY_PROFILE).sort()).toEqual([
      'cep', 'city', 'cnpjCpf', 'complement', 'email', 'legalName', 'neighborhood',
      'number', 'phone', 'responsibleBirth', 'responsibleCpf', 'responsibleName',
      'state', 'street', 'tradeName', 'whatsapp',
    ]);
    expect(Object.values(EMPTY_PROFILE).every((v) => v === '')).toBe(true);
  });

  it('buildTenantProfilePayload separa profile / settings / responsiblePhone', () => {
    const form = {
      ...EMPTY_PROFILE,
      cnpjCpf: '11.222.333/0001-44', legalName: 'ACME LTDA', tradeName: 'ACME',
      cep: '90000-000', street: 'Av. X', number: '10', complement: 'sala 2', neighborhood: 'Centro',
      city: 'Porto Alegre', state: 'RS',
      responsibleName: 'Fulano', responsibleCpf: '123.456.789-09', responsibleBirth: '1990-01-01',
      whatsapp: '55 51 99999-9999', email: 'a@b.com', phone: '(51) 3333-3333',
    };
    const out = buildTenantProfilePayload(form);
    expect(out.settings).toEqual({ city: 'Porto Alegre', state: 'RS' });
    expect(out.responsiblePhone).toBe('55 51 99999-9999');
    // profile NÃO carrega city/state/whatsapp (vivem em settings/responsiblePhone)
    expect(out.profile.city).toBeUndefined();
    expect(out.profile.state).toBeUndefined();
    expect(out.profile.whatsapp).toBeUndefined();
    expect(out.profile.cnpjCpf).toBe('11.222.333/0001-44');
    expect(out.profile.responsibleName).toBe('Fulano');
    expect(Object.keys(out.profile).sort()).toEqual([
      'cep', 'cnpjCpf', 'complement', 'email', 'legalName', 'neighborhood',
      'number', 'phone', 'responsibleBirth', 'responsibleCpf', 'responsibleName',
      'street', 'tradeName',
    ]);
  });

  it('readTenantProfile é o inverso: monta o form plano a partir do tenant', () => {
    const tenant = {
      profile: { cnpjCpf: '11.222.333/0001-44', legalName: 'ACME LTDA', street: 'Av. X' },
      settings: { city: 'Porto Alegre', state: 'RS' },
      responsiblePhone: '55 51 99999-9999',
    };
    const form = readTenantProfile(tenant);
    expect(form.cnpjCpf).toBe('11.222.333/0001-44');
    expect(form.city).toBe('Porto Alegre');
    expect(form.state).toBe('RS');
    expect(form.whatsapp).toBe('55 51 99999-9999');
    expect(form.tradeName).toBe(''); // ausente no tenant → vazio, não undefined
  });

  it('readTenantProfile tolera tenant sem profile/settings', () => {
    const form = readTenantProfile({});
    expect(form).toEqual(EMPTY_PROFILE);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- gymProfile`
Expected: FAIL (`Failed to resolve import '../gymProfile.js'`).

- [ ] **Step 3: Implementar o mínimo**

`src/lib/gymProfile.js`:

```js
// Fonte única do formulário "Perfil da academia" no front. Espelha os campos
// de api/_profile.js (PROFILE_MAX) e o mapeamento tenant↔form usado por TODOS
// os caminhos de escrita (criação no superadmin, edição no superadmin, self-
// service do cliente), pra nunca divergirem.

// Form PLANO (16 campos). city/state e whatsapp são "planos" na UI, mas gravam
// em lugares próprios do tenant (settings / responsiblePhone).
export const EMPTY_PROFILE = {
  cnpjCpf: '', legalName: '', tradeName: '',
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  responsibleName: '', whatsapp: '', email: '', phone: '', responsibleCpf: '', responsibleBirth: '',
};

// Campos que vivem em tenant.profile (13 — sem city/state/whatsapp).
const PROFILE_FIELDS = [
  'cnpjCpf', 'legalName', 'tradeName',
  'cep', 'street', 'number', 'complement', 'neighborhood',
  'responsibleName', 'email', 'phone', 'responsibleCpf', 'responsibleBirth',
];

// form plano → { profile, settings:{city,state}, responsiblePhone }
export function buildTenantProfilePayload(form = {}) {
  const profile = {};
  for (const k of PROFILE_FIELDS) profile[k] = String(form[k] ?? '');
  return {
    profile,
    settings: { city: String(form.city ?? ''), state: String(form.state ?? '') },
    responsiblePhone: String(form.whatsapp ?? ''),
  };
}

// tenant ({profile, settings, responsiblePhone}) → form plano
export function readTenantProfile(tenant = {}) {
  const p = tenant.profile || {};
  return {
    ...EMPTY_PROFILE,
    ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, String(p[k] ?? '')])),
    city: String(tenant.settings?.city ?? ''),
    state: String(tenant.settings?.state ?? ''),
    whatsapp: String(tenant.responsiblePhone ?? ''),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- gymProfile`
Expected: PASS (4 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gymProfile.js src/lib/__tests__/gymProfile.test.js
git commit -m "feat: helper único de mapeamento do perfil da academia (form<->tenant)"
```

---

### Task 2: Componente compartilhado `GymProfileFields`

**Files:**
- Create: `src/components/profile/GymProfileFields.jsx`

Extrai os 3 blocos + comportamentos que hoje vivem em `GymProfileTab.jsx` (lookups CNPJ/CEP, validação de CPF). Controlado: recebe `value` (form plano) + `onChange(patch)`. `wrapInCards` decide se cada bloco vem embrulhado em `SettingsCard` (uso no Perfil da academia) ou como grid solto com um título simples (uso dentro de outro card, no superadmin). `onValidityChange(bool)` avisa o pai quando o CPF fica inválido.

- [ ] **Step 1: Criar o componente**

`src/components/profile/GymProfileFields.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { FileText, MapPin, User } from 'lucide-react';
import { lookupCep, lookupCnpj, isCepComplete, isCnpjComplete, isCpfComplete, isValidCpf } from '../../lib/brazilLookups.js';
import { SettingsCard } from '../ui/SettingsCard.jsx';
import { Field, StyledInput } from '../ui/Field.jsx';

// Campos do "Perfil da academia", isolados pra serem reusados em 3 telas:
// Perfil da academia (cliente), criação e edição no superadmin. Dono dos
// lookups (BrasilAPI/ViaCEP) e da validação de CPF. Controlado por value/onChange.
//
// Props:
//   value            form plano (ver EMPTY_PROFILE em lib/gymProfile.js)
//   onChange(patch)  recebe um objeto parcial pra mesclar no form
//   wrapInCards      true = cada bloco num SettingsCard (default); false = grid
//                    solto com título leve (pra usar dentro de outro card)
//   onValidityChange(bool) opcional — chamado com true quando o CPF é inválido
function GymProfileFields({ value, onChange, wrapInCards = true, onValidityChange }) {
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const set = (k, v) => onChange({ [k]: v });

  const cpfInvalid = isCpfComplete(value.responsibleCpf) && !isValidCpf(value.responsibleCpf);
  useEffect(() => { onValidityChange?.(cpfInvalid); }, [cpfInvalid, onValidityChange]);

  // CNPJ completo → razão social + nome fantasia (BrasilAPI).
  const onCnpjBlur = async () => {
    if (!isCnpjComplete(value.cnpjCpf)) return;
    setCnpjBusy(true);
    const r = await lookupCnpj(value.cnpjCpf);
    setCnpjBusy(false);
    if (r) onChange({ legalName: r.legalName || value.legalName, tradeName: r.tradeName || value.tradeName });
  };
  // CEP completo → rua/bairro/cidade/UF (ViaCEP). Não toca número/complemento.
  const onCepBlur = async () => {
    if (!isCepComplete(value.cep)) return;
    setCepBusy(true);
    const r = await lookupCep(value.cep);
    setCepBusy(false);
    if (r) onChange({ street: r.street || value.street, neighborhood: r.neighborhood || value.neighborhood, city: r.city || value.city, state: r.state || value.state });
  };

  const identity = (
    <div className="space-y-4">
      <Field label="CNPJ" hint={cnpjBusy ? 'Buscando na Receita…' : 'Preenche razão social e nome fantasia'}>
        <StyledInput value={value.cnpjCpf} onChange={(e) => set('cnpjCpf', e.target.value)} onBlur={onCnpjBlur} placeholder="00.000.000/0000-00" />
      </Field>
      <Field label="Razão social"><StyledInput value={value.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Nome empresarial" /></Field>
      <Field label="Nome fantasia (opcional)"><StyledInput value={value.tradeName} onChange={(e) => set('tradeName', e.target.value)} placeholder="Como a academia é conhecida" /></Field>
    </div>
  );

  const contact = (
    <div className="space-y-4">
      <Field label="Nome do responsável"><StyledInput value={value.responsibleName} onChange={(e) => set('responsibleName', e.target.value)} placeholder="Nome completo" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CPF" error={cpfInvalid ? 'CPF inválido' : undefined}><StyledInput value={value.responsibleCpf} onChange={(e) => set('responsibleCpf', e.target.value)} placeholder="000.000.000-00" /></Field>
        <Field label="Data de nascimento"><StyledInput type="date" value={value.responsibleBirth} onChange={(e) => set('responsibleBirth', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="WhatsApp"><StyledInput value={value.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="55 51 99999-9999" /></Field>
        <Field label="Telefone"><StyledInput value={value.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(51) 3333-3333" /></Field>
      </div>
      <Field label="E-mail comercial"><StyledInput type="email" value={value.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@academia.com" /></Field>
    </div>
  );

  const address = (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
      <div className="sm:col-span-3">
        <Field label="CEP" hint={cepBusy ? 'Buscando endereço…' : undefined}>
          <StyledInput value={value.cep} onChange={(e) => set('cep', e.target.value)} onBlur={onCepBlur} placeholder="00000-000" />
        </Field>
      </div>
      <div className="sm:col-span-7"><Field label="Rua / logradouro"><StyledInput value={value.street} onChange={(e) => set('street', e.target.value)} placeholder="Av. Exemplo" /></Field></div>
      <div className="sm:col-span-2"><Field label="Número"><StyledInput value={value.number} onChange={(e) => set('number', e.target.value)} placeholder="123" /></Field></div>
      <div className="sm:col-span-5"><Field label="Complemento"><StyledInput value={value.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, andar…" /></Field></div>
      <div className="sm:col-span-7"><Field label="Bairro"><StyledInput value={value.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" /></Field></div>
      <div className="sm:col-span-9"><Field label="Cidade"><StyledInput value={value.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" /></Field></div>
      <div className="sm:col-span-3"><Field label="UF"><StyledInput value={value.state} maxLength={2} onChange={(e) => set('state', e.target.value.toUpperCase())} placeholder="UF" /></Field></div>
    </div>
  );

  if (wrapInCards) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard title="Identidade & fiscal" hint="Dados oficiais da empresa" icon={<FileText size={16} />}>{identity}</SettingsCard>
        <SettingsCard title="Contato & responsável" hint="Quem responde pela academia" icon={<User size={16} />}>{contact}</SettingsCard>
        <SettingsCard className="order-last lg:col-span-2" title="Endereço" hint="Onde a academia funciona" icon={<MapPin size={16} />}>{address}</SettingsCard>
      </div>
    );
  }

  // Modo "solto": títulos leves, sem card (o pai já é um card/modal).
  const Section = ({ icon, title, children }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">{icon}{title}</div>
      {children}
    </div>
  );
  return (
    <div className="space-y-5">
      <Section icon={<FileText size={14} className="text-brand-600" />} title="Identidade & fiscal">{identity}</Section>
      <Section icon={<User size={14} className="text-brand-600" />} title="Contato & responsável">{contact}</Section>
      <Section icon={<MapPin size={14} className="text-brand-600" />} title="Endereço">{address}</Section>
    </div>
  );
}

export { GymProfileFields };
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos. (Se `npm install` estiver incompleto no worktree e o build falhar por dep ausente — `tw-animate-css`/`eslint-plugin-react` — rode `npm install` antes; ver memória do worktree.)

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/GymProfileFields.jsx
git commit -m "feat: componente GymProfileFields reusável (campos + lookups do perfil)"
```

---

### Task 3: Refatorar `GymProfileTab` para consumir os compartilhados

**Files:**
- Modify: `src/views/settings/GymProfileTab.jsx`

Manter a "carteira" (cabeçalho com anel de completude) e o botão salvar. Trocar os 3 `SettingsCard` de campos pelo `GymProfileFields`, o `EMPTY` local por `EMPTY_PROFILE`, o load/save pelo `readTenantProfile`/`buildTenantProfilePayload`, e a validação de CPF por estado vindo do componente.

- [ ] **Step 1: Reescrever o arquivo**

Substituir todo o conteúdo de `src/views/settings/GymProfileTab.jsx` por:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Building2, Check } from 'lucide-react';
import { auth } from '../../lib/firebase.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { EMPTY_PROFILE, buildTenantProfilePayload, readTenantProfile } from '../../lib/gymProfile.js';
import { GymProfileFields } from '../../components/profile/GymProfileFields.jsx';
import { Btn } from '../../components/ui/Btn.jsx';

// Página "Perfil da academia" (admin do tenant). Lê/grava via /api/asaas
// (handleTenantSelf: GET + POST action:'updateProfile'). Os campos + lookups
// vivem em GymProfileFields; o mapeamento form↔tenant em lib/gymProfile.js.

// Campos que contam para a completude (complemento e nome fantasia são opcionais).
const SCORED = [
  ['cnpjCpf', 'CNPJ'], ['legalName', 'razão social'],
  ['cep', 'CEP'], ['street', 'rua'], ['number', 'número'], ['neighborhood', 'bairro'],
  ['city', 'cidade'], ['state', 'UF'],
  ['responsibleName', 'responsável'], ['responsibleCpf', 'CPF'], ['responsibleBirth', 'nascimento'],
  ['whatsapp', 'WhatsApp'], ['email', 'e-mail comercial'], ['phone', 'telefone'],
];

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: 60, height: 60 }} aria-label={`Perfil ${pct}% completo`}>
      <svg viewBox="0 0 60 60" width="60" height="60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth="6" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" className="text-brand-600" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 30 30)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[14px] font-bold text-brand-700 dark:text-brand-300 num">{pct}%</span>
    </div>
  );
}

function GymProfileTab() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cpfInvalid, setCpfInvalid] = useState(false);
  const onChange = (patch) => setForm((s) => ({ ...s, ...patch }));

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/asaas', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok) {
          setForm(readTenantProfile(json));
          setDisplayName(json.displayName || '');
        } else { toast.error(json.error || 'Não foi possível carregar o perfil.'); }
      } catch (e) { console.error('profile load', e); toast.error('Erro ao carregar o perfil.'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  }, []);

  const pct = useMemo(() => {
    const filled = SCORED.filter(([k]) => String(form[k] || '').trim()).length;
    return Math.round((filled / SCORED.length) * 100);
  }, [form]);
  const missing = useMemo(() => SCORED.filter(([k]) => !String(form[k] || '').trim()).map(([, l]) => l), [form]);

  const save = async () => {
    if (cpfInvalid) { toast.warning('O CPF do responsável é inválido. Corrija antes de salvar.'); return; }
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const { profile, settings, responsiblePhone } = buildTenantProfilePayload(form);
      const res = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'updateProfile', profile, settings, responsiblePhone }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Não foi possível salvar o perfil.'); return; }
      toast.success('Perfil da academia salvo!');
    } catch (e) { console.error('profile save', e); toast.error('Erro ao salvar o perfil.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-center text-[13px] text-slate-400 py-12">Carregando o perfil…</div>;

  const cityUf = [form.city, form.state].filter(Boolean).join(' · ');
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="h-1 bg-brand-600" />
        <div className="p-5 flex items-center gap-4">
          <div className="w-[58px] h-[58px] rounded-xl border border-dashed border-slate-300 dark:border-white/15 grid place-items-center text-slate-400 dark:text-slate-500 shrink-0 text-center leading-none">
            <span>
              <Building2 className="w-5 h-5 mx-auto" />
              <span className="block text-[8.5px] font-medium mt-1">logo · em breve</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[19px] font-bold tracking-tight truncate">{form.tradeName || displayName || 'Sua academia'}</h3>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              <span className="num">{form.cnpjCpf ? `CNPJ ${form.cnpjCpf}` : 'CNPJ não informado'}</span>{cityUf ? ` · ${cityUf}` : ''}
            </p>
          </div>
          <Ring pct={pct} />
        </div>
        {missing.length > 0 && (
          <div className="px-5 pb-4 text-[11.5px] text-slate-400">
            Faltam: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` e +${missing.length - 3}` : ''}.
          </div>
        )}
      </div>

      <GymProfileFields value={form} onChange={onChange} wrapInCards onValidityChange={setCpfInvalid} />

      <div className="flex justify-end">
        <Btn kind="brand" size="md" icon={<Check size={15} />} onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</Btn>
      </div>
    </div>
  );
}

export { GymProfileTab };
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos.

- [ ] **Step 3: Verificar paridade no preview**

Run: `npm run dev` (abrir a URL/porta que o Vite imprimir). Logar como admin de um tenant → Configurações → "Perfil da academia".
Expected: layout, labels, anel de completude e auto-preenchimento de CNPJ/CEP idênticos ao de antes; salvar mostra "Perfil da academia salvo!".

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/GymProfileTab.jsx
git commit -m "refactor: GymProfileTab consome GymProfileFields + helpers de perfil"
```

---

### Task 4: Backend — `provision-tenant` grava `profile`

**Files:**
- Modify: `api/provision-tenant.js`

O handler já aceita `city`, `state`, `responsiblePhone`. Falta aceitar `profile` e gravá-lo saneado no `.create()` do tenant. `sanitizeProfile` já existe em `api/_profile.js`.

- [ ] **Step 1: Importar o saneador**

Em `api/provision-tenant.js`, logo abaixo da linha 4 (`import { logAudit } from './_audit.js';`), adicionar:

```js
import { sanitizeProfile } from './_profile.js';
```

- [ ] **Step 2: Ler `profile` do body**

No POST, na desestruturação do `req.body` (hoje linhas ~123-126), acrescentar `profile`:

```js
      const {
        tenantId, displayName, adminEmail, adminPassword, adminName, plan, trialDays,
        city, state, responsiblePhone, internal, monthlyPrice, resendInvite, profile,
      } = req.body || {};
```

- [ ] **Step 3: Sanear antes do create**

Logo antes de `await tenantsCol().doc(slug).create({` (hoje ~linha 253), adicionar:

```js
      const profilePatch = sanitizeProfile(profile);
```

- [ ] **Step 4: Persistir no documento do tenant**

Dentro do objeto passado ao `.create({ ... })`, logo após o bloco de `settings: { ... }` (hoje linhas ~258-262), acrescentar uma linha:

```js
          ...(profilePatch ? { profile: profilePatch } : {}),
```

- [ ] **Step 5: Verificar sintaxe do handler**

Run: `node --check api/provision-tenant.js`
Expected: sem saída (sintaxe OK).

- [ ] **Step 6: Commit**

```bash
git add api/provision-tenant.js
git commit -m "feat: provision-tenant grava o perfil completo da academia (sanitizeProfile)"
```

---

### Task 5: Form "Nova organização" — seção recolhível "Dados da empresa"

**Files:**
- Modify: `src/views/superadmin/SuperAdminView.jsx`

O `form` state ganha os campos de perfil (via spread de `EMPTY_PROFILE`); uma seção `<details>` recolhível abaixo do bloco atual hospeda `GymProfileFields`; `submit()` envia o payload de perfil; CPF inválido bloqueia.

- [ ] **Step 1: Imports**

No topo de `src/views/superadmin/SuperAdminView.jsx`, após a linha 13 (`import { TenantManageModal } ...`), adicionar:

```js
import { GymProfileFields } from '../../components/profile/GymProfileFields.jsx';
import { EMPTY_PROFILE, buildTenantProfilePayload } from '../../lib/gymProfile.js';
```

E no import de ícones (linha 14), acrescentar `Building2`:

```js
import { Activity, AlertCircle, Ban, Building2, Check, Eye, FileText, Globe, Plus, Search, Settings } from 'lucide-react';
```

- [ ] **Step 2: Estado inicial do form + validade do CPF**

Trocar a linha 24 (`const [form, setForm] = useState({ displayName: '', ... })`) por (mescla os campos de perfil no mesmo state):

```js
  const [form, setForm] = useState({ displayName: '', tenantId: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter', trialDays: '', ...EMPTY_PROFILE });
```

E logo após a linha 25 (`const [slugTouched, setSlugTouched] = useState(false);`), adicionar:

```js
  const [profileOpen, setProfileOpen] = useState(false);
  const [cpfInvalid, setCpfInvalid] = useState(false);
```

- [ ] **Step 3: Bloquear submit com CPF inválido + enviar o perfil**

No `submit` (hoje ~166-200): após o check de senha (`if (form.adminPassword.length < 6) ...`, hoje linha 173), adicionar:

```js
    if (cpfInvalid) { toast.warning('O CPF do responsável é inválido. Corrija antes de criar.'); return; }
```

No corpo do `fetch('/api/provision-tenant', ...)`, trocar o objeto do `JSON.stringify` (hoje linhas 179-187) por (acrescenta o payload de perfil):

```js
        body: JSON.stringify({
          tenantId: form.tenantId.trim(),
          displayName: form.displayName.trim(),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPassword: form.adminPassword,
          plan: form.plan,
          trialDays: form.trialDays ? Number(form.trialDays) : 0,
          ...buildTenantProfilePayload(form),
        })
```

E no reset após sucesso (hoje linha 192, `setForm({ displayName: '', ... })`), trocar por:

```js
      setForm({ displayName: '', tenantId: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter', trialDays: '', ...EMPTY_PROFILE });
      setProfileOpen(false);
```

- [ ] **Step 4: Renderizar a seção recolhível**

No JSX do form de criação, logo após o `</div>` que fecha o grid de "Plano / Dias de teste" (hoje linha 312, `</div>` após o Field "Dias de teste") e ANTES do `<div className="flex justify-end">` do botão criar (hoje linha 313), inserir:

```jsx
          <details open={profileOpen} onToggle={(e) => setProfileOpen(e.currentTarget.open)}
            className="rounded-xl border border-border bg-white/60 dark:bg-white/[0.02]">
            <summary className="flex items-center gap-2 cursor-pointer select-none px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
              <Building2 size={15} className="text-brand-600" />
              Dados da empresa
              <span className="font-normal text-slate-400">(opcional — CNPJ, endereço, responsável)</span>
            </summary>
            <div className="px-3.5 pb-4 pt-1">
              <GymProfileFields
                value={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                wrapInCards={false}
                onValidityChange={setCpfInvalid}
              />
            </div>
          </details>
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos.

- [ ] **Step 6: Verificar no preview**

Run: `npm run dev`. Superadmin → aba Organizações (clients) → "Nova organização" → abrir "Dados da empresa", preencher CNPJ (ver auto-preencher razão social), CEP (ver auto-preencher endereço), criar org.
Expected: org criada sem erro; toast de sucesso.

- [ ] **Step 7: Commit**

```bash
git add src/views/superadmin/SuperAdminView.jsx
git commit -m "feat: cadastro completo (Dados da empresa) no form de nova organização"
```

---

### Task 6: Modal "Gerenciar" — aba "Perfil"

**Files:**
- Modify: `src/views/superadmin/TenantManageModal.jsx`

Nova sub-aba "Perfil" com `GymProfileFields`, pré-carregada via `readTenantProfile(t)` e salva via `onPatch`. Cidade/UF saem de "Configurações".

- [ ] **Step 1: Imports**

No topo de `src/views/superadmin/TenantManageModal.jsx`, após a linha 6 (`import { Field, StyledInput, StyledSelect } ...`), adicionar:

```js
import { GymProfileFields } from '../../components/profile/GymProfileFields.jsx';
import { buildTenantProfilePayload, readTenantProfile } from '../../lib/gymProfile.js';
```

- [ ] **Step 2: Estado do perfil**

Após a linha 25 (fim do `useState` do `f`), adicionar:

```js
  const [profileForm, setProfileForm] = useState(() => readTenantProfile(t));
  const [profileCpfInvalid, setProfileCpfInvalid] = useState(false);
```

- [ ] **Step 3: Handler de salvar o perfil**

Logo após `saveConfig` (hoje ~56-59), adicionar:

```js
  const saveProfile = () => {
    if (profileCpfInvalid) { toast.warning('O CPF do responsável é inválido. Corrija antes de salvar.'); return; }
    const { profile, settings, responsiblePhone } = buildTenantProfilePayload(profileForm);
    onPatch({ profile, settings, responsiblePhone }, 'Perfil salvo.');
  };
```

- [ ] **Step 4: Remover Cidade/UF da aba Configurações + não sobrescrevê-los no saveConfig**

Na aba `config` (hoje linhas ~195-206), remover o grid de Cidade/Estado (hoje linhas 198-201):

```jsx
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade"><StyledInput value={f.city} onChange={e => set('city', e.target.value)} placeholder="Ex: Porto Alegre" /></Field>
                <Field label="Estado"><StyledInput value={f.state} onChange={e => set('state', e.target.value)} placeholder="Ex: RS" /></Field>
              </div>
```

E trocar o `saveConfig` (hoje linhas 56-59) para não mandar city/state (agora donos da aba Perfil):

```js
  const saveConfig = () => {
    if (!f.displayName.trim()) return;
    onPatch({ displayName: f.displayName.trim(), settings: { logoUrl: f.logoUrl.trim() } }, 'Configurações salvas.');
  };
```

(Os campos `f.city`/`f.state` no `useState` do `f` podem continuar existindo sem uso; opcionalmente removê-los. Se o lint acusar variável não usada, remova as chaves `city`/`state` do objeto inicial de `f`.)

- [ ] **Step 5: Adicionar a aba na barra de sub-abas**

Na lista de sub-abas (hoje linha 82), inserir "Perfil" entre "config" e "acoes":

```jsx
          {[{ id: 'visao', label: 'Visão Geral' }, { id: 'plano', label: 'Plano & Cobrança' }, { id: 'config', label: 'Configurações' }, { id: 'perfil', label: 'Perfil' }, { id: 'acoes', label: 'Ações' }].map(s => (
```

- [ ] **Step 6: Renderizar o painel da aba**

Logo após o bloco `{sub === 'config' && ( ... )}` fechar (hoje linha 206, antes de `{sub === 'acoes' && (`), inserir:

```jsx
          {sub === 'perfil' && (
            <div className="space-y-4">
              <GymProfileFields value={profileForm} onChange={(patch) => setProfileForm((p) => ({ ...p, ...patch }))} wrapInCards={false} onValidityChange={setProfileCpfInvalid} />
              <div className="flex justify-end"><Btn kind="brand" icon={<Check size={13} />} onClick={saveProfile} disabled={!!busy}>Salvar perfil</Btn></div>
            </div>
          )}
```

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros novos.

- [ ] **Step 8: Commit**

```bash
git add src/views/superadmin/TenantManageModal.jsx
git commit -m "feat: aba Perfil no modal Gerenciar do superadmin (edita cadastro completo)"
```

---

### Task 7: Verificação de ponta a ponta

**Files:** nenhum (verificação).

- [ ] **Step 1: Suite + lint + build verdes**

Run: `npm run test && npm run lint && npm run build`
Expected: testes passam (incl. `gymProfile`), lint sem erros novos, build OK.

- [ ] **Step 2: Round-trip criação → perfil do cliente**

Run: `npm run dev`. Como superadmin: criar uma org preenchendo "Dados da empresa" (CNPJ, endereço, responsável). Depois "Entrar como" essa org → Configurações → "Perfil da academia".
Expected: todos os campos aparecem preenchidos exatamente como digitados (CNPJ, razão social, endereço, responsável, WhatsApp, cidade/UF). Anel de completude reflete o preenchimento.

- [ ] **Step 3: Round-trip edição no superadmin**

Voltar ao superadmin → "Gerenciar" a mesma org → aba "Perfil" → alterar um campo (ex.: telefone) → "Salvar perfil". Fechar e reabrir o modal.
Expected: o valor alterado persiste; toast "Perfil salvo.".

- [ ] **Step 4: Regressão do Perfil da academia**

Confirmar que a tela "Perfil da academia" do cliente segue idêntica à de antes (layout, anel, auto-preenchimento de CNPJ/CEP, validação de CPF inválido bloqueando o salvar).

- [ ] **Step 5: Árvore limpa**

Run: `git status`
Expected: árvore limpa (todos os commits das tasks anteriores já feitos).

---

## Notas de PR

- Trabalho via PR (nunca commit direto na main); merge só com aprovação do Johnny (ver CLAUDE.md).
- Sem função Serverless nova — o limite de 12 do Vercel Hobby continua respeitado.
- Firestore rules: sem mudança (o campo `tenant.profile` já é gravado pelos caminhos existentes; nada novo a publicar no console).
