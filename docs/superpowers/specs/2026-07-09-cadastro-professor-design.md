# Cadastro de professor + seleção no agendamento

- **Sistema:** Stronilead (React 19 + Vite + Firebase/Firestore, multi-tenant por `appId`, sem TypeScript)
- **Data:** 2026-07-09
- **Status:** ativo (aprovado para implementação)
- **Autor:** Johnny + Claude

## Problema

Hoje o consultor agenda uma aula experimental sem registrar quem é o professor responsável. Sem esse dado, não dá para medir conversão de aula experimental por professor. O objetivo é capturar o professor no momento do agendamento para alimentar relatórios futuros de conversão por professor e por modalidade.

## Escopo

Entra:

- Cadastro simples de professor (nome + modalidades em que atua, podendo ser mais de uma).
- Seleção do professor responsável no agendamento da aula experimental, nas duas telas que agendam aula.
- Professor aparecendo como filtro e como coluna na página de Aulas experimentais.

Não entra (fora de escopo agora):

- Nenhum dashboard, gráfico ou relatório. Só a captura e a exposição do dado nos filtros.
- Login/acesso para professor. Professor não é usuário do sistema.
- Telefone, e-mail, foto ou qualquer campo além de nome e modalidades.

## Decisões tomadas

1. **Professor não é usuário.** Não tem login, authUid nem senha. Fica numa coleção própria, separada de `stronix_users`. Não entra no limite de assentos do plano. O limite continua valendo só para consultores, como já é hoje.
2. **Cadastro dentro de "Equipe".** Card novo "Professores" logo abaixo do card "Equipe" (mesma aba de Configurações), com botão próprio "Adicionar professor".
3. **Seleção obrigatória, com escape "Treina sozinho".** No agendamento da aula é obrigatório concluir o passo do professor: escolher um professor OU marcar "Treina sozinho" (aluno sem professor responsável). Como "Treina sozinho" está sempre disponível, agendar nunca trava, mesmo sem nenhum professor cadastrado.
4. **Vínculo por id de modalidade.** O professor guarda os ids das modalidades em que atua, não os nomes. Renomear uma modalidade não quebra o vínculo.
5. **Nas duas telas de agendamento.** O passo do professor entra no `ScheduleWizard` (ficha do lead) e no modal de remarcar da Meta Diária (`DailyGoalView`), para o relatório não ter buracos.
6. **Aulas experimentais:** filtro por professor + coluna com o nome do professor na linha.

## Modelo de dados

### Coleção nova: `stronix_professores`

Sob `/artifacts/{appId}/public/data/stronix_professores/{id}`, 1 doc por professor, mesmo padrão de `stronix_modalities`:

```
{
  nome: string,             // "João Silva"
  modalidadeIds: string[],  // ids de docs de stronix_modalities
  ativo: boolean,           // default true
  order: number,            // ordenação na lista
  createdAt: serverTimestamp()
}
```

### Campos novos no lead (`stronix_leads`)

Gravados no agendamento de aula, ao lado dos que já existem (`appointmentModality`, `appointmentType`, etc.):

```
appointmentProfessorId: string | null    // id do professor, ou null se "Treina sozinho"
appointmentProfessorName: string | null   // nome desnormalizado p/ leitura direta na lista
appointmentSoloTraining: boolean          // true = aluno marcado como "Treina sozinho"
```

Distinção importante para o relatório: lead antigo (antes desta feature) fica com os três campos `undefined`; lead novo fica ou com professor preenchido (`soloTraining: false`) ou com `soloTraining: true` e professor null. Assim dá para separar "não respondido" de "sem professor por escolha".

## Mudanças por arquivo

### 1. `src/lib/firebase.js`

Adicionar a constante de path:

```js
export const PROFESSORS_PATH = 'stronix_professores';
```

### 2. `firestore.rules`

Bloco novo espelhando o de `stronix_modalities` (lê quem é do tenant, escreve só admin):

```
match /artifacts/{appId}/public/data/stronix_professores/{id} {
  allow read: if inTenant(appId) && tenantActive(appId);
  allow write: if isAdmin(appId) && inTenant(appId) && tenantActive(appId);
}
```

Atenção operacional: as rules são publicadas MANUALMENTE no console do Firebase (não pela CLI). Depois de editar o arquivo, o Johnny publica.

### 3. `src/App.jsx`

- `const [professores, setProfessores] = useState([])`.
- `onSnapshot` novo em `PROFESSORS_PATH`, ordenando por `order` (mesmo bloco de `unsubModalities`), com `onSnapErr('professores')` e o unsub no cleanup.
- Incluir `professores` no valor do `GeneralConfigContext` (o `useMemo` de `generalConfigValue` e suas deps).
- Passar `professores` para `AppointmentTrackingView` (aba `aulas`).
- Passar `professores` para `SettingsView`.

### 4. `src/contexts/GeneralConfigContext.jsx`

Adicionar `professores: []` ao default do `createContext` e ao fallback do `useGeneralConfig`.

### 5. `src/views/settings/ManageProfessorsCard.jsx` (novo)

Componente próprio para não inchar o `ManageUsersTab` (que já passa de 600 linhas). Recebe `{ db, professores, modalities, leads }`. Segue os padrões visuais e de CRUD já usados em `ManageGeneralSettingsTab` (modalidades/unidades):

- `SettingsCard` "Professores" com botão de ação "Adicionar professor" (abre/fecha o form inline).
- Form: campo **nome** (obrigatório) + **modalidades** como chips de múltipla seleção (toggle liga/desliga, igual aos dias da meta em `ManageGeneralSettingsTab`). Ao menos uma modalidade recomendada, mas não bloqueante.
- Anti-duplicado por nome (case-insensitive), exceto o próprio em edição.
- Criar: `addDoc` com `{ nome, modalidadeIds, ativo: true, order, createdAt }`.
- Editar: `setDoc(..., { merge: true })`. Se o nome mudou, propaga `appointmentProfessorName` para os leads que têm `appointmentProfessorId === prof.id` (mesmo padrão de renomear modalidade/unidade, usando `commitOpsInChunks`).
- Excluir: bloqueado se algum lead usa aquele professor (`leads.filter(l => l.appointmentProfessorId === prof.id).length > 0`), com toast avisando. Senão, `deleteDoc` após `window.confirm`.
- Lista abaixo: cada professor com nome + chips das modalidades (resolvendo `modalidadeIds` para nomes via `modalities`; ids órfãos, de modalidade excluída, são ignorados na exibição) + botões editar/excluir.

### 6. `src/views/settings/SettingsView.jsx`

- Receber `professores` como prop.
- Na aba `users`, renderizar `ManageProfessorsCard` logo depois de `ManageUsersTab`, passando `db`, `professores`, `modalities`, `leads`.
- `ManageUsersTab` continua recebendo só `{ db, appUser }` (sem mudança de responsabilidade).

### 7. `src/components/profile/ScheduleWizard.jsx`

- Ler `professores` de `useGeneralConfig()` (além de `modalities`, que já lê).
- Fluxo da aula passa de `['modalidade','quantidade','datahora']` para `['modalidade','professor','quantidade','datahora']`.
- `WZ_STEP_INFO.professor = { title:'Professor', hint:'Quem vai acompanhar a aula?' }`.
- Novo caso no `WzStepBody` para `professor`:
  - Lista os professores que atuam na modalidade escolhida: `professores.filter(p => p.modalidadeIds?.includes(selectedModalityId))`, onde `selectedModalityId` é o id da modalidade cujo `name === values.modalidade`.
  - Se nenhum professor bater com a modalidade, mostra todos os professores como fallback (nunca dead-end), com uma nota discreta.
  - Card "Treina sozinho" SEMPRE presente (usa o valor sentinela `SOLO = '__solo__'`).
  - Guarda em `values.professor` o id do professor OU o sentinela `SOLO`.
- `wzSummary` e `WzSummaryCard`: incluir o professor (nome resolvido, ou "Treina sozinho") no resumo da aula.
- `handleConfirm` passa a devolver, para aula:
  - `professorId: values.professor === SOLO ? null : (values.professor || null)`
  - `professorName`: nome resolvido do professor, ou null se solo
  - `soloTraining: values.professor === SOLO`
- Como o passo é obrigatório e "Treina sozinho" conta como preenchido, a lógica de `firstIncomplete`/`complete` já cobre a obrigatoriedade sem mudança extra.

### 8. `src/views/LeadProfileView.jsx`

- `handleWizardConfirm` recebe `professorId`, `professorName`, `soloTraining` no destructuring.
- No objeto `up` (merge no lead), gravar, só quando `isAula`:
  - `appointmentProfessorId: isAula ? (professorId || null) : null`
  - `appointmentProfessorName: isAula ? (professorName || null) : null`
  - `appointmentSoloTraining: isAula ? Boolean(soloTraining) : false`
- Opcional: incluir o professor no texto da interação (`extra`), no mesmo formato de modalidade/quantidade.

### 9. `src/views/DailyGoalView.jsx` (modal de remarcar)

- No form de remarcar/agendar aula: quando `apptType === 'aula_experimental'`, adicionar seleção de professor (select compacto dos professores da modalidade escolhida + opção "Treina sozinho"). Semear do lead (`lead.appointmentProfessorId` / `appointmentSoloTraining`) quando existir.
- Estender a assinatura de `onConfirm` para carregar professor (id + solo), e no write do reschedule (onde já grava `appointmentModality`) gravar `appointmentProfessorId`, `appointmentProfessorName`, `appointmentSoloTraining`.
- Precisa de `professores` disponível no componente (via props a partir do `App.jsx`, já que `DailyGoalView` recebe várias listas por prop).

### 10. `src/views/AppointmentTrackingView.jsx`

- **Coluna "Professor"** (só quando `isAula`): mostra `appointmentProfessorName`, ou "Treina sozinho" quando `appointmentSoloTraining`, ou "—" para leads antigos. Ajustar o `grid-template-columns` da visão de aula para acomodar a coluna nova (visita segue com o layout atual).
- **Filtro por professor** no popover (só admin): seção "Professor" com multi-seleção dos professores + a opção "Treina sozinho". Combina com o filtro de responsável já existente (AND entre os dois). Precisa receber `professores` por prop.

## Consistência e casos de borda

- **Sem professor cadastrado:** o passo do agendamento mostra só "Treina sozinho" (mais o fallback vazio), então nunca bloqueia.
- **Modalidade sem professor:** fallback mostra todos os professores + "Treina sozinho".
- **Modalidade excluída depois:** ids órfãos em `modalidadeIds` são ignorados na exibição dos chips. A exclusão de modalidade já é bloqueada quando em uso por leads; manter esse comportamento (não é obrigatório bloquear por professor, mas os chips degradam bem).
- **Renomear professor:** propaga `appointmentProfessorName` nos leads que o referenciam.
- **Excluir professor em uso:** bloqueado com aviso, igual modalidades/unidades.
- **Leads legados:** sem os campos novos; a lista mostra "—" e o relatório futuro os trata como "não respondido".

## Fiação de dados (resumo)

`stronix_professores` (Firestore) → `onSnapshot` no `App.jsx` → estado `professores` → `GeneralConfigContext` (wizard) + props para `SettingsView`, `AppointmentTrackingView` e `DailyGoalView`.

## Rollout

1. Editar `firestore.rules` e publicar manual no console (senão a coleção fica sem leitura/escrita).
2. Deploy do código.
3. Cadastrar os professores em Configurações → Equipe → Professores.
4. A partir daí, todo agendamento de aula captura o professor (ou "Treina sozinho").
