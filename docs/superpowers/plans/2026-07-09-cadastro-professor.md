# Cadastro de professor + seleção no agendamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar o professor responsável no agendamento da aula experimental (com escape "Treina sozinho") para alimentar relatórios futuros de conversão por professor e modalidade.

**Architecture:** Nova coleção Firestore `stronix_professores` (nome + ids de modalidades), assinada em `App.jsx` e exposta via `GeneralConfigContext` (mesma via que `modalities` já usa). Cadastro num card próprio dentro de Equipe. O professor entra como passo no `ScheduleWizard` e no modal de remarcar da Meta Diária, é gravado no lead (`appointmentProfessorId/Name/SoloTraining`) e aparece como filtro + coluna na página de Aulas experimentais.

**Tech Stack:** React 19 + Vite + Firebase/Firestore (sem TypeScript), Tailwind v4, shadcn/ui parcial, lucide-react.

**Abordagem de verificação (importante):** este repositório **não tem framework de testes** (só `dev`, `build`, `lint`). Seguindo a regra do projeto ("patches cirúrgicos, uma tela de cada vez"), **não** vamos introduzir um. Cada task verifica com `npm run lint` + `npm run build` e uma checagem manual no app rodando (`npm run dev`). As funções puras novas ficam isoladas em `src/lib/professores.js` para serem óbvias de conferir a olho.

**Referência:** spec em `docs/superpowers/specs/2026-07-09-cadastro-professor-design.md`.

**Convenções do repo (seguir):** interface em pt-BR; componentes shadcn/tokens semânticos onde já se usa; `Btn`/`SettingsCard`/`cn` existentes; commits em português no formato `tipo: descrição`; nunca commitar na `main` (já estamos na branch `feat/cadastro-professor`).

---

## Arquivos criados / modificados

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/professores.js` | criar | Constante do sentinela "Treina sozinho" + helpers puros (nomes das modalidades de um professor, professores de uma modalidade) |
| `src/lib/firebase.js` | modificar | Constante de path `PROFESSORS_PATH` |
| `firestore.rules` | modificar | Bloco de regras da coleção nova (lê tenant, escreve admin) |
| `src/App.jsx` | modificar | Estado `professores` + `onSnapshot` + inclusão no `GeneralConfigContext` |
| `src/contexts/GeneralConfigContext.jsx` | modificar | `professores: []` nos defaults |
| `src/views/settings/ManageProfessorsCard.jsx` | criar | CRUD de professor (form nome + modalidades em chips, lista, editar/excluir) |
| `src/views/settings/SettingsView.jsx` | modificar | Renderizar o card na aba Equipe |
| `src/components/profile/ScheduleWizard.jsx` | modificar | Passo "Professor" no fluxo da aula |
| `src/views/LeadProfileView.jsx` | modificar | Gravar `appointmentProfessorId/Name/SoloTraining` no lead |
| `src/views/DailyGoalView.jsx` | modificar | Campo de professor no modal de remarcar aula + gravação |
| `src/views/AppointmentTrackingView.jsx` | modificar | Filtro por professor + coluna "Professor" |

Ordem das tasks respeita dependências: helpers e path primeiro, depois fiação, depois telas.

---

## Task 1: Path da coleção + regras do Firestore

**Files:**
- Modify: `src/lib/firebase.js` (após a linha `export const UNITS_PATH = 'stronix_units';`)
- Modify: `firestore.rules` (após o bloco `stronix_units`)

- [ ] **Step 1: Adicionar a constante de path**

Em `src/lib/firebase.js`, logo depois de `export const UNITS_PATH = 'stronix_units';`:

```js
// Catálogo de professores da academia (nome + modalidades em que atua). Não são
// usuários do sistema (sem login/authUid) e não entram no limite de assentos.
export const PROFESSORS_PATH = 'stronix_professores';
```

- [ ] **Step 2: Adicionar o bloco de regras**

Em `firestore.rules`, logo depois do bloco `match /artifacts/{appId}/public/data/stronix_units/{id} { ... }`:

```
match /artifacts/{appId}/public/data/stronix_professores/{id} {
  allow read: if inTenant(appId) && tenantActive(appId);
  allow write: if isAdmin(appId) && inTenant(appId) && tenantActive(appId);
}
```

- [ ] **Step 3: Verificar build/lint**

Run: `npm run lint && npm run build`
Expected: sem erros (mudanças são só constantes/regras).

> Nota operacional: as `firestore.rules` são publicadas MANUALMENTE no console do Firebase. Sem publicar, a coleção fica sem leitura/escrita. Deixar isso claro no commit e avisar o Johnny.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase.js firestore.rules
git commit -m "feat: coleção stronix_professores (path + regras)"
```

---

## Task 2: Helpers puros de professor (`src/lib/professores.js`)

**Files:**
- Create: `src/lib/professores.js`

- [ ] **Step 1: Criar o módulo**

```js
// Helpers puros do catálogo de professores. Isolados aqui p/ serem óbvios de
// conferir e reusados no wizard, na Meta Diária, na lista de Aulas e no cadastro.
// O professor guarda IDS de modalidade (rename-proof); as telas resolvem p/ nome.

// Sentinela do agendamento sem professor responsável ("Treina sozinho"). É um
// valor não-vazio de propósito: no wizard o passo do professor é obrigatório, e
// escolher "Treina sozinho" conta como preenchido.
export const SOLO_TRAINING = '__solo__';
export const SOLO_TRAINING_LABEL = 'Treina sozinho';

// Nomes das modalidades de um professor. Ignora ids órfãos (modalidade excluída).
export function professorModalityNames(prof, modalities) {
  const byId = new Map((modalities || []).map((m) => [m.id, m.name]));
  return (prof?.modalidadeIds || []).map((id) => byId.get(id)).filter(Boolean);
}

// Professores ATIVOS que atuam numa modalidade, buscada pelo NOME (que é o que o
// wizard/agenda guardam). Retorna [] se a modalidade não existir mais.
export function professorsForModality(professores, modalities, modalityName) {
  const mod = (modalities || []).find((m) => m.name === modalityName);
  if (!mod) return [];
  return (professores || []).filter(
    (p) => p.ativo !== false && (p.modalidadeIds || []).includes(mod.id)
  );
}

// Nome do professor por id (p/ desnormalizar no lead e exibir na lista de Aulas).
export function professorNameById(professores, id) {
  if (!id) return null;
  const p = (professores || []).find((x) => x.id === id);
  return p ? p.nome : null;
}
```

- [ ] **Step 2: Verificar lint/build**

Run: `npm run lint && npm run build`
Expected: sem erros. O módulo ainda não é importado, então só valida sintaxe.

- [ ] **Step 3: Conferência a olho (sem framework de teste)**

Confirme mentalmente com estes casos:
- `professorModalityNames({ modalidadeIds: ['a','x'] }, [{id:'a',name:'Musculação'}])` → `['Musculação']` (o `'x'` órfão some).
- `professorsForModality([{id:'p1',ativo:true,modalidadeIds:['a']}], [{id:'a',name:'Musculação'}], 'Musculação')` → `[p1]`.
- `professorsForModality(..., 'Inexistente')` → `[]`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/professores.js
git commit -m "feat: helpers puros do catálogo de professores"
```

---

## Task 3: Assinatura + contexto (`App.jsx`, `GeneralConfigContext.jsx`)

**Files:**
- Modify: `src/App.jsx` (imports de path; estado; bloco `onSnapshot`; valor do contexto; cleanup)
- Modify: `src/contexts/GeneralConfigContext.jsx`

- [ ] **Step 1: Importar o path novo**

Em `src/App.jsx`, no import de `./lib/firebase.js` (onde já constam `MODALITIES_PATH`, `UNITS_PATH`), adicionar `PROFESSORS_PATH`.

- [ ] **Step 2: Estado novo**

Perto de `const [modalities, setModalities] = useState([]);` (~linha 242):

```js
const [professores, setProfessores] = useState([]);
```

- [ ] **Step 3: Assinatura da coleção**

Logo depois do bloco `const unsubModalities = onSnapshot(...)` (~linha 617), adicionar, espelhando-o:

```js
const unsubProfessores = onSnapshot(
  collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH),
  (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => (a.order || 0) - (b.order || 0));
    setProfessores(data);
  },
  onSnapErr('professores')
);
```

- [ ] **Step 4: Incluir no valor do contexto**

No `useMemo` de `generalConfigValue` (~linha 259-261), acrescentar `professores` ao objeto retornado e ao array de dependências:

```js
const generalConfigValue = useMemo(
  () => ({ modalities, trialClassOptions, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, professores }),
  [modalities, trialClassOptions, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, professores]
);
```

- [ ] **Step 5: Limpar a assinatura no cleanup**

No `return () => { ... }` do effect (junto de `unsubModalities();`, ~linha 673+), adicionar `unsubProfessores();`.

- [ ] **Step 6: Default do contexto**

Em `src/contexts/GeneralConfigContext.jsx`, adicionar `professores: []` ao objeto do `createContext(...)` e ao objeto de fallback do `useGeneralConfig()` (as duas ocorrências, para ficarem iguais):

```js
const GeneralConfigContext = createContext({ modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, professores: [] });
function useGeneralConfig() {
  return useContext(GeneralConfigContext) || { modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, professores: [] };
}
```

- [ ] **Step 7: Verificar**

Run: `npm run lint && npm run build`
Expected: sem erros. Rodar `npm run dev` e confirmar no console do navegador que não há erro de `onSnapshot professores` (a coleção pode estar vazia, sem problema).

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/contexts/GeneralConfigContext.jsx
git commit -m "feat: assinatura de professores no contexto geral"
```

---

## Task 4: Card de cadastro de professor (`ManageProfessorsCard.jsx`) + SettingsView

**Files:**
- Create: `src/views/settings/ManageProfessorsCard.jsx`
- Modify: `src/views/settings/SettingsView.jsx`

O card lê `professores` e `modalities` do contexto (`useGeneralConfig`) e recebe `db` + `leads` por prop (p/ o bloqueio de exclusão e a propagação de rename). Segue o padrão visual do card de Modalidades em `ManageGeneralSettingsTab` e o toggle de chips dos dias da meta.

- [ ] **Step 1: Criar o componente**

```jsx
import { useState } from 'react';
import { Check, GraduationCap, Pencil, Plus, Trash2, X } from 'lucide-react';
import { collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, PROFESSORS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { professorModalityNames } from '../../lib/professores.js';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledInput } from '../../components/ui/Field.jsx';

// Cadastro de professores. Professor NÃO é usuário do sistema (sem login) e não
// entra no limite do plano. Guarda nome + ids das modalidades em que atua.
function ManageProfessorsCard({ db, leads }) {
  const toast = useToast();
  const { professores, modalities } = useGeneralConfig();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [modIds, setModIds] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setName(''); setModIds([]); setEditingId(null); setShowForm(false); };

  const toggleMod = (id) =>
    setModIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openNew = () => { setEditingId(null); setName(''); setModIds([]); setShowForm(true); };
  const openEdit = (p) => { setEditingId(p.id); setName(p.nome || ''); setModIds(p.modalidadeIds || []); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast.warning('Informe o nome do professor.'); return; }
    // Anti-duplicado por nome (case-insensitive), exceto o próprio em edição.
    const dup = (professores || []).some(
      (p) => p.id !== editingId && (p.nome || '').trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) { toast.warning(`O professor "${trimmed}" já existe.`); return; }
    try {
      if (editingId) {
        const old = (professores || []).find((p) => p.id === editingId);
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, editingId),
          { nome: trimmed, modalidadeIds: modIds },
          { merge: true }
        );
        // Propaga a renomeação p/ os leads que já têm esse professor gravado.
        if (old && old.nome !== trimmed) {
          const leadsToUpdate = (leads || []).filter((l) => l.appointmentProfessorId === editingId);
          if (leadsToUpdate.length > 0) {
            const ops = leadsToUpdate.map((lead) => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
              data: { appointmentProfessorName: trimmed },
            }));
            await commitOpsInChunks(db, ops, 400);
          }
        }
        toast.success('Professor atualizado.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH), {
          nome: trimmed, modalidadeIds: modIds, ativo: true, order: (professores || []).length, createdAt: serverTimestamp(),
        });
        toast.success('Professor cadastrado.');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o professor.');
    }
  };

  const handleDelete = async (p) => {
    const inUse = (leads || []).filter((l) => l.appointmentProfessorId === p.id).length;
    if (inUse > 0) {
      toast.warning(`"${p.nome}" está em uso por ${inUse} ${inUse === 1 ? 'lead' : 'leads'}. Não é possível excluí-lo.`);
      return;
    }
    if (window.confirm(`Excluir o professor "${p.nome}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, p.id));
      if (editingId === p.id) resetForm();
    }
  };

  return (
    <SettingsCard
      title="Professores"
      hint="Professores da academia e as modalidades em que atuam (usados ao agendar aula experimental)"
      icon={<GraduationCap size={16} />}
      action={
        <Btn
          kind={showForm ? 'soft' : 'brand'}
          icon={showForm ? <X size={13} /> : <Plus size={13} />}
          onClick={() => (showForm ? resetForm() : openNew())}
        >
          {showForm ? 'Cancelar' : 'Adicionar professor'}
        </Btn>
      }
    >
      {showForm && (
        <form onSubmit={save} className="p-4 rounded-xl bg-muted/50 border border-border mb-5 flex flex-col gap-4 animate-fade-in">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Nome</label>
            <StyledInput icon={<GraduationCap size={14} />} placeholder="Ex: João Silva" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Modalidades em que atua</label>
            {(modalities || []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nenhuma modalidade cadastrada. Adicione em Regras gerais → Modalidades.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(modalities || []).map((m) => {
                  const on = modIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMod(m.id)}
                      aria-pressed={on}
                      className={cn(
                        'px-3 h-9 rounded-lg text-[12.5px] font-semibold transition border',
                        on ? 'bg-brand-600 text-white border-brand-600' : 'bg-card text-muted-foreground border-border hover:bg-accent'
                      )}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>{editingId ? 'Salvar' : 'Cadastrar professor'}</Btn>
            <Btn kind="soft" type="button" onClick={resetForm}>Cancelar</Btn>
          </div>
        </form>
      )}

      {(professores || []).length === 0 ? (
        <div className="text-center text-[12.5px] text-muted-foreground py-12">Nenhum professor ainda — adicione o primeiro acima.</div>
      ) : (
        <div className="divide-y divide-border">
          {(professores || []).map((p) => {
            const mods = professorModalityNames(p, modalities);
            const inUse = (leads || []).filter((l) => l.appointmentProfessorId === p.id).length;
            return (
              <div key={p.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition">
                <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                  <GraduationCap size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{p.nome}</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                    {mods.length ? mods.join(' · ') : 'Sem modalidade'}
                  </div>
                </div>
                {inUse > 0 && <span className="num text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{inUse} {inUse === 1 ? 'lead' : 'leads'}</span>}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => openEdit(p)} />
                  <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(p)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}

export { ManageProfessorsCard };
```

> Antes de rodar, confirme que `Btn` exporta `IconBtn` e que `StyledInput` existe em `components/ui/Field.jsx` (ambos são usados por `ManageGeneralSettingsTab.jsx`, então existem). Se `GraduationCap` não estiver disponível no lucide instalado, trocar por `UserRound`.

- [ ] **Step 2: Renderizar o card na aba Equipe**

Em `src/views/settings/SettingsView.jsx`:
1. Importar: `import { ManageProfessorsCard } from './ManageProfessorsCard.jsx';`
2. Na renderização da aba `users` (hoje `{activeTab === 'users' && <ManageUsersTab db={db} appUser={appUser} />}`), envolver os dois num fragmento:

```jsx
{activeTab === 'users' && (
  <>
    <ManageUsersTab db={db} appUser={appUser} />
    <ManageProfessorsCard db={db} leads={leads} />
  </>
)}
```

`leads` já é prop do `SettingsView` (usada por outras abas), então não há mudança de assinatura. `professores`/`modalities` vêm do contexto dentro do card.

- [ ] **Step 3: Verificar no app**

Run: `npm run lint && npm run build`, depois `npm run dev`.
Checagem manual:
- Configurações → Equipe: aparece o card "Professores" com botão "Adicionar professor".
- Adicionar um professor com nome + 1-2 modalidades marcadas → aparece na lista com as modalidades embaixo.
- Editar renomeia; excluir pede confirmação; duplicar nome mostra aviso.
- Se ainda não houver modalidades, o form mostra a mensagem de "cadastre em Regras gerais".

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/ManageProfessorsCard.jsx src/views/settings/SettingsView.jsx
git commit -m "feat: cadastro de professores dentro de Equipe"
```

---

## Task 5: Passo "Professor" no wizard + gravação no lead

**Files:**
- Modify: `src/components/profile/ScheduleWizard.jsx`
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Importar helpers no wizard**

No topo de `ScheduleWizard.jsx`, adicionar:

```js
import { SOLO_TRAINING, SOLO_TRAINING_LABEL, professorsForModality } from '../../lib/professores.js';
import { GraduationCap } from 'lucide-react'; // somar aos ícones já importados de lucide-react
```

(`GraduationCap` entra na lista de imports de `lucide-react` já existente; não criar um segundo import.)

- [ ] **Step 2: Adicionar o passo ao fluxo da aula e ao dicionário de passos**

No array `WZ_TYPES`, na entrada `id:'aula'`, trocar o `flow`:

```js
{ id:'aula', label:'Aula experimental', followUpLabel:'Aula Experimental', desc:'Treino de experiência', Icon: BookOpen, color:'teal', flow:['modalidade','professor','quantidade','datahora'] },
```

Em `WZ_STEP_INFO`, adicionar:

```js
professor: { title:'Professor', hint:'Quem vai acompanhar a aula?' },
```

- [ ] **Step 3: Ler professores do contexto e passar aos passos**

Em `ScheduleWizard`, junto de `const { modalities, trialClassOptions, units } = useGeneralConfig();`, incluir `professores`:

```js
const { modalities, trialClassOptions, units, professores } = useGeneralConfig();
```

`WzStepBody` e `WzStepRow` recebem os dados por prop. Adicionar `professores` a essas passagens:
- Na assinatura de `WzStepBody`: `({ stepId, values, set, color, modalities, units, qtyOptions, professores })`.
- Na assinatura de `WzStepRow`: acrescentar `professores` e repassar ao `WzStepBody`.
- No `.map` que renderiza `WzStepRow` (dentro do return do `ScheduleWizard`), passar `professores={professores}`.

- [ ] **Step 4: Renderizar o passo do professor no `WzStepBody`**

Adicionar um `case 'professor':` no `switch (stepId)` do `WzStepBody`, depois do `case 'modalidade':`:

```jsx
case 'professor': {
  const matches = professorsForModality(professores, modalities, values.modalidade);
  const list = matches.length ? matches : (professores || []).filter((p) => p.ativo !== false);
  const usingFallback = matches.length === 0 && list.length > 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.map((p, i) => (
          <WzOptionCard key={p.id} index={i} Icon={GraduationCap} label={p.nome}
            color={color} selected={values.professor === p.id} onClick={() => set('professor', p.id)} />
        ))}
        <WzOptionCard index={list.length} Icon={GraduationCap} label={SOLO_TRAINING_LABEL}
          hint="Sem professor responsável" color={color}
          selected={values.professor === SOLO_TRAINING} onClick={() => set('professor', SOLO_TRAINING)} />
      </div>
      {usingFallback && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
          Nenhum professor cadastrado para <span className="font-semibold">{values.modalidade}</span>. Mostrando todos.
        </p>
      )}
      {list.length === 0 && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
          Nenhum professor cadastrado. Adicione em <span className="font-semibold">Configurações → Equipe</span>, ou marque "Treina sozinho".
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Resumo do passo**

Em `wzSummary`, adicionar o caso `professor` (mostra "Treina sozinho" ou o nome do professor). Como `wzSummary` não recebe as listas, resolver o nome no componente pai não é trivial ali; então guardar no resumo um rótulo simples:

```js
case 'professor':
  return values.professor === SOLO_TRAINING ? SOLO_TRAINING_LABEL : (values.professor ? 'Professor selecionado' : null);
```

> Isso mantém `wzSummary` puro. O nome real aparece no card lateral (próximo passo) e na lista de Aulas.

- [ ] **Step 6: Card lateral de resumo (`WzSummaryCard`)**

`WzSummaryCard` recebe `type, values, complete`. Para exibir o nome do professor no resumo lateral, passar `professores` e `modalities` a ele. Na chamada dentro do `ScheduleWizard`, trocar `<WzSummaryCard type={type} values={values} complete={complete}/>` por `<WzSummaryCard type={type} values={values} complete={complete} professores={professores}/>` e, na assinatura do componente, incluir `professores`. No corpo, adicionar ao array `parts`, logo após o push da modalidade:

```js
if (values.professor === SOLO_TRAINING) parts.push(SOLO_TRAINING_LABEL);
else if (values.professor) {
  const p = (professores || []).find((x) => x.id === values.professor);
  if (p) parts.push(p.nome);
}
```

- [ ] **Step 7: `handleConfirm` devolve o professor**

No `handleConfirm` do `ScheduleWizard`, no objeto passado a `onConfirm`, adicionar (só faz sentido p/ aula):

```js
professorId: type.id === 'aula' && values.professor !== SOLO_TRAINING ? (values.professor || null) : null,
soloTraining: type.id === 'aula' && values.professor === SOLO_TRAINING,
```

(Não precisa devolver o nome: a `LeadProfileView` resolve o nome pelo id via contexto no próximo passo.)

- [ ] **Step 8: Persistir no lead (`LeadProfileView.jsx`)**

Em `LeadProfileView.jsx`:
1. Garantir acesso a `professores`. A view já usa contexto/props; adicionar no topo do componente: `const { professores } = useGeneralConfig();` (import `useGeneralConfig` se ainda não houver; e `professorNameById` de `../lib/professores.js`).
2. Em `handleWizardConfirm`, no destructuring do argumento, acrescentar `professorId, soloTraining`.
3. No objeto `up` (o merge no lead), adicionar, junto de `appointmentModality`:

```js
appointmentProfessorId: isAula ? (professorId || null) : null,
appointmentProfessorName: isAula ? (professorId ? professorNameById(professores, professorId) : null) : null,
appointmentSoloTraining: isAula ? Boolean(soloTraining) : false,
```

4. (Opcional, recomendado) incluir o professor no texto `extra` da interação da aula, p/ a Linha do Tempo. Ex.: se `professorId`, acrescentar ` · ${professorNameById(professores, professorId)}`; se `soloTraining`, ` · Treina sozinho`.

- [ ] **Step 9: Verificar no app**

Run: `npm run lint && npm run build`, depois `npm run dev`.
Checagem manual (com ao menos 1 professor cadastrado numa modalidade):
- Abrir uma ficha de lead → agendar → Aula experimental.
- Passo 1 Modalidade, passo 2 **Professor** (mostra os da modalidade + "Treina sozinho"), passo 3 Quantas aulas, passo 4 Dia/horário.
- O card lateral mostra o nome do professor (ou "Treina sozinho").
- Não dá pra confirmar sem escolher professor/"Treina sozinho" (passo obrigatório).
- Confirmar → no Firestore, o lead recebe `appointmentProfessorId`/`appointmentProfessorName`/`appointmentSoloTraining`.
- Testar também com zero professores na modalidade: aparece fallback "mostrando todos"; com zero professores no total: só "Treina sozinho" + nota.

- [ ] **Step 10: Commit**

```bash
git add src/components/profile/ScheduleWizard.jsx src/views/LeadProfileView.jsx
git commit -m "feat: passo do professor no agendamento de aula (wizard)"
```

---

## Task 6: Professor no remarcar da Meta Diária (`DailyGoalView.jsx`)

**Files:**
- Modify: `src/views/DailyGoalView.jsx`

O modal de remarcar (componente interno da `DailyGoalView`) já lê `modalities`/`trialClassOptions` do `useGeneralConfig`. Vamos ler `professores` da mesma fonte e gravar os campos do professor no mesmo `onConfirm`/write que já grava `appointmentModality`.

- [ ] **Step 1: Importar helpers**

No topo de `DailyGoalView.jsx`, adicionar:

```js
import { SOLO_TRAINING, SOLO_TRAINING_LABEL, professorsForModality, professorNameById } from '../lib/professores.js';
```

E garantir que `professores` esteja disponível no modal: onde ele já obtém `modalities`/`trialClassOptions` (via `useGeneralConfig()`), incluir `professores`.

- [ ] **Step 2: Estado do professor no modal de remarcar**

Junto de `const [modality, setModality] = useState(lead?.appointmentModality || '');` (~linha 544), adicionar, semeando do lead:

```js
const [professorSel, setProfessorSel] = useState(
  lead?.appointmentSoloTraining ? SOLO_TRAINING : (lead?.appointmentProfessorId || '')
);
```

- [ ] **Step 3: Campo de professor no form (só aula)**

Dentro do bloco `apptType === 'aula_experimental'` (hoje um `grid grid-cols-2` com Modalidade + Aulas previstas, ~linha 619-648), adicionar abaixo um select de professor (largura cheia). Ex.:

```jsx
<div>
  <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
    Professor
  </label>
  <select
    value={professorSel}
    onChange={(e) => setProfessorSel(e.target.value)}
    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer"
  >
    <option value="">Selecione...</option>
    {professorsForModality(professores, modalities, modality).map((p) => (
      <option key={p.id} value={p.id}>{p.nome}</option>
    ))}
    <option value={SOLO_TRAINING}>{SOLO_TRAINING_LABEL}</option>
  </select>
</div>
```

> Observação: como o select depende da modalidade escolhida, mantê-lo fora do `grid grid-cols-2` (numa linha própria) evita aperto visual. Se preferir, `professorsForModality` com fallback p/ todos quando a lista vier vazia — para o remarcar, manter simples (só os da modalidade + "Treina sozinho") já atende; se ficar vazio, o consultor usa "Treina sozinho".

- [ ] **Step 4: Passar o professor no `handleSubmit`/`onConfirm`**

No `handleSubmit` do modal (~linha 557-566), estender a chamada `onConfirm` para carregar o professor. Como `onConfirm` já recebe `(newDate, note, apptType, modality, qty)`, acrescentar dois argumentos:

```js
const isSolo = professorSel === SOLO_TRAINING;
const professorId = isAula && !isSolo ? (professorSel || null) : null;
const soloTraining = isAula && isSolo;
await onConfirm(newDate, note, apptType, isAula ? (modality || '').trim() : null, isAula ? finalQty : null, professorId, soloTraining);
```

- [ ] **Step 5: Gravar no write do reschedule**

Localizar a definição de `onConfirm` da `DailyGoalView` (a que monta `leadUpdate`/`appointmentModality`, ~linha 1230-1245). Atualizar a assinatura para receber `(newDate, note, apptType, finalModality, finalQty, professorId, soloTraining)` e, no objeto gravado no lead (onde há `appointmentModality: finalModality`), adicionar:

```js
appointmentProfessorId: apptType === 'aula_experimental' ? (professorId || null) : null,
appointmentProfessorName: apptType === 'aula_experimental' ? (professorId ? professorNameById(professores, professorId) : null) : null,
appointmentSoloTraining: apptType === 'aula_experimental' ? Boolean(soloTraining) : false,
```

Garantir que `professores` está no escopo dessa função (vem do `useGeneralConfig()` da `DailyGoalView`).

- [ ] **Step 6: Verificar no app**

Run: `npm run lint && npm run build`, depois `npm run dev`.
Checagem manual:
- Meta Diária com uma tarefa de aula → remarcar. Ao escolher a modalidade, o select de professor lista os professores dela + "Treina sozinho".
- Ao confirmar, o lead recebe os campos do professor (conferir no Firestore).
- Semear: reabrir o remarcar de um lead que já tem professor mostra o professor pré-selecionado; um lead "Treina sozinho" reabre com essa opção marcada.

- [ ] **Step 7: Commit**

```bash
git add src/views/DailyGoalView.jsx
git commit -m "feat: professor no remarcar de aula da Meta Diária"
```

---

## Task 7: Filtro + coluna na página de Aulas experimentais

**Files:**
- Modify: `src/views/AppointmentTrackingView.jsx`

- [ ] **Step 1: Importar helpers e o contexto**

No topo, adicionar:

```js
import { SOLO_TRAINING_LABEL } from '../lib/professores.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
```

Dentro do componente, ler os professores:

```js
const { professores } = useGeneralConfig();
```

- [ ] **Step 2: Estado do filtro de professor**

Junto de `const [respFilter, setRespFilter] = useState([]);` (~linha 130), adicionar:

```js
// Filtro por professor. Além dos ids de professor, aceita o token '__solo__'
// (via SOLO_TRAINING) para filtrar quem está como "Treina sozinho".
const [profFilter, setProfFilter] = useState([]);
```

Importar também `SOLO_TRAINING` do mesmo módulo p/ o token.

- [ ] **Step 3: Aplicar o filtro (só na visão de aulas)**

Onde hoje se calcula `scopedLeads` (filtro por responsável, ~linha 166-169), encadear o filtro de professor quando `isAula` e `profFilter` não vazio. Substituir por:

```js
const scopedLeads = useMemo(() => {
  let list = respFilter.length > 0 ? typeLeads.filter(l => respFilter.includes(l.consultantId)) : typeLeads;
  if (isAula && profFilter.length > 0) {
    list = list.filter(l => {
      if (l.appointmentSoloTraining) return profFilter.includes(SOLO_TRAINING);
      return l.appointmentProfessorId && profFilter.includes(l.appointmentProfessorId);
    });
  }
  return list;
}, [typeLeads, respFilter, profFilter, isAula]);
```

Ajustar `hasActiveFilters` para `respFilter.length > 0 || (isAula && profFilter.length > 0)`.

- [ ] **Step 4: Coluna "Professor" no cabeçalho e nas linhas (só aula)**

O grid atual é `grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]` (Aluno, Objetivo, Data marcada, Passe livre/Situação, Finalizou). Para a visão de aula, inserir a coluna Professor entre "Data marcada" e "Passe livre". Definir a template condicional no topo do render:

```js
const gridCols = isAula
  ? 'grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]'
  : 'grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]';
```

Trocar as duas ocorrências hardcoded do template (cabeçalho `hidden md:grid ...` e a linha `grid ... md:grid-cols-[...]`) por `cn('...', isAula ? 'md:grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]' : 'md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]')` mantendo as demais classes.

No cabeçalho (`<span>{col1Label}</span>...`), inserir `{isAula && <span>Professor</span>}` entre a coluna "Data marcada" e a `{col4Label}`.

Na linha, logo após o bloco "Data marcada" e antes do bloco da 4ª coluna, inserir (só aula):

```jsx
{isAula && (
  <div className="min-w-0 text-[12.5px] font-medium text-gray-700 dark:text-neutral-300 truncate">
    {l.appointmentSoloTraining ? SOLO_TRAINING_LABEL : (l.appointmentProfessorName || '—')}
  </div>
)}
```

- [ ] **Step 5: Seção "Professor" no popover de filtros (só aula)**

No popover de filtros (o `filterOpen && (...)`, ~linha 411), depois da seção "Responsável", adicionar uma seção "Professor" quando `isAula`. Espelhar o padrão dos botões de responsável (multi-toggle), incluindo uma opção "Treina sozinho" com o token `SOLO_TRAINING`:

```jsx
{isAula && (
  <div className="pt-2.5 px-2 pb-1 border-t border-slate-100 dark:border-white/10 mt-1">
    <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
      Professor
    </div>
    {(professores || []).map((p) => {
      const selected = profFilter.includes(p.id);
      return (
        <button key={p.id} type="button"
          onClick={() => setProfFilter(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
          className={cn('w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
            selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5')}>
          <span className="flex-1 text-[12.5px] text-gray-900 dark:text-white truncate">{p.nome}</span>
          {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
        </button>
      );
    })}
    <button type="button"
      onClick={() => setProfFilter(prev => prev.includes(SOLO_TRAINING) ? prev.filter(x => x !== SOLO_TRAINING) : [...prev, SOLO_TRAINING])}
      className={cn('w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
        profFilter.includes(SOLO_TRAINING) ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5')}>
      <span className="flex-1 text-[12.5px] text-gray-900 dark:text-white truncate">{SOLO_TRAINING_LABEL}</span>
      {profFilter.includes(SOLO_TRAINING) && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
    </button>
  </div>
)}
```

Também: o botão "Limpar" do popover deve limpar os dois filtros (`setRespFilter([]); setProfFilter([]);`), e o badge de contagem no ícone de filtro deve somar `respFilter.length + (isAula ? profFilter.length : 0)`.

- [ ] **Step 6: Verificar no app**

Run: `npm run lint && npm run build`, depois `npm run dev`.
Checagem manual:
- Aba Aulas experimentais: cada linha mostra a coluna "Professor" (nome, "Treina sozinho" ou "—" p/ leads antigos).
- Popover de filtros (admin): seção "Professor" filtra a lista; "Treina sozinho" também filtra. Combina com o filtro de responsável.
- Aba Visitas: layout inalterado (sem coluna/filtro de professor).

- [ ] **Step 7: Commit**

```bash
git add src/views/AppointmentTrackingView.jsx
git commit -m "feat: filtro e coluna de professor nas Aulas experimentais"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run lint && npm run build` limpos.
- [ ] Fluxo ponta a ponta no `npm run dev`:
  1. Cadastrar 2 professores (modalidades diferentes) em Equipe.
  2. Agendar aula pela ficha do lead escolhendo um professor; agendar outra como "Treina sozinho".
  3. Remarcar uma aula pela Meta Diária trocando o professor.
  4. Conferir na aba Aulas experimentais: coluna e filtro por professor batendo com o que foi agendado.
- [ ] Publicar as `firestore.rules` no console do Firebase (passo manual do Johnny).
- [ ] Abrir PR da branch `feat/cadastro-professor` (sem merge direto na main).

## Fora de escopo (não fazer neste plano)

- Dashboard/relatório de conversão (só a captura do dado).
- Migração de leads antigos (ficam com "—").
- Bloquear exclusão de modalidade por uso em professor (os chips já degradam com ids órfãos).
