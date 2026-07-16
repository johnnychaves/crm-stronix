# Histórico de aulas por professor (entrega 2)

status: revisão
data: 2026-07-16
branch: (a criar)

## Problema

Hoje o lead guarda UM agendamento de aula experimental (bloco denormalizado no doc, sobrescrito a cada novo agendamento). Quando o lead marca uma segunda aula com outro professor, o agendamento anterior some, então:

- A "Conversão por professor" no Gerencial atribui a venda só ao professor do agendamento ATUAL do lead. O professor da aula anterior (que deu uma aula, o aluno compareceu e não fechou naquele momento) desaparece das estatísticas.
- O desfecho (compareceu/faltou) também é único no lead, não dá pra ter dois professores cada um com sua presença.

Decisão do Johnny: manter o histórico de todas as aulas, cada professor com sua aula/comparecimento/conversão, sem um resultado apagar o outro.

## Decisões (definidas com o Johnny)

- **Só o dashboard nesta entrega.** Sem tela nova de histórico. O núcleo é a "Conversão por professor" passar a contar cada aula corretamente.
- **Regra de atribuição da conversão:** quando o lead fecha o plano, o crédito vai pra **última aula em que ele compareceu antes de fechar**. Aulas atendidas anteriores ficam "compareceu, sem conversão" para os respectivos professores.
- **Backfill sim:** migrar os dados atuais (um registro de aula por lead, a partir do agendamento atual). Multi-aula anterior ao deploy não é recuperável (nunca foi gravado).
- **Coleção separada** (não array no lead), pra o dashboard buscar as aulas do período por data sem depender de quais leads estão carregados.

## Arquitetura

Coleção nova flat `stronix_aulas` em `artifacts/{appId}/public/data/stronix_aulas/{id}` (mesmo padrão dos demais domínios; não há subcoleções de domínio no projeto). É a fonte analítica/histórica; o bloco de agendamento do lead continua sendo o estado operacional "atual" (agenda, Meta Diária, ficha, no-show seguem iguais).

### Registro de aula (`stronix_aulas`)
```
leadId: string
leadName: string            // denorm (exibição/debug)
professorId: string | null  // null = treina sozinho
professorName: string | null
soloTraining: boolean
modality: string | null     // nome (mesma convenção de lead.appointmentModality)
scheduledFor: Timestamp
status: 'agendada' | 'attended' | 'no_show' | 'cancelled'
outcomeAt: Timestamp | null
converted: boolean          // esta aula levou à venda
convertedAt: Timestamp | null
consultantId: string | null
consultantAuthUid: string | null   // dono, p/ a regra
createdAt: Timestamp
```
O lead ganha o campo `currentAulaId` (id do registro de aula ativo), pra os caminhos de presença saberem qual registro atualizar.

## Fluxos de escrita (dual-write)

O bloco denormalizado do lead (`appointmentType/ScheduledFor/Modality/ProfessorId/ProfessorName/SoloTraining/trialClassesPlanned` + `appointmentOutcome/At/By`) **continua exatamente como hoje**. A coleção nova é escrita em paralelo.

### 1. Agendar / reagendar aula experimental
Caminhos: `handleWizardConfirm` (`src/views/LeadProfileView.jsx:358-417`) e `handleReschedule` (`src/views/DailyGoalView.jsx:1299-1378`).
- Grava o bloco do lead como hoje.
- **Novo:** resolve o registro de aula:
  - Se `lead.currentAulaId` aponta pra um registro ainda `'agendada'` (sem desfecho), **atualiza** ele (nova data/professor/modalidade). Evita duplicar registros "agendada" quando é só um ajuste antes da aula acontecer.
  - Senão, **cria** um registro novo (`status: 'agendada'`) e grava `lead.currentAulaId = novoId`.

### 2. Marcar presença (attended / no_show / cancelled) e desfazer
Consolidação: hoje a lógica de desfecho existe em 3 lugares — o helper `writeAppointmentOutcome` (`src/lib/appointmentOutcome.js`, usado pela presença cruzada e pelo atalho das Aulas), e uma cópia inline no toque da Meta Diária (`DailyGoalView.jsx:1091-1171 handleOutcome`). Vou **rotear o toque da Meta pelo helper** (remove a duplicação) e adicionar no helper a escrita do registro de aula:
- Grava `appointmentOutcome/At/By` no lead como hoje (+ consume/promote).
- **Novo:** atualiza o registro `lead.currentAulaId`: `status = outcome`, `outcomeAt`.
- `clearAppointmentOutcome` (desfazer no atalho das Aulas): volta o registro pra `'agendada'`, `outcomeAt = null`.

### 3. Conversão / matrícula e desfazer
Caminhos: `MatriculaModal.handleConfirm` (`src/modals/MatriculaModal.jsx:64-142`), e os moves p/ etapa convertida no Kanban (`KanbanView.jsx`) e na ficha (`LeadProfileView.jsx`).
- Grava contrato + patch do lead (`isConverted`, `convertedAt`, etc.) como hoje.
- **Novo:** busca as aulas do lead (`where leadId == X`), escolhe **a última com `status: 'attended'`** (maior `scheduledFor`) e marca `converted: true`, `convertedAt`.
- **Desfazer venda** (sair de 'Venda'/etapa convertida): desmarca a aula que estava `converted`.
- Sem aula atendida → nenhuma aula creditada (lead fechou sem aula, ou treina sozinho) — correto.

## Dashboard (leitura)

- Novo carregamento windowed das aulas do período: `getDocs(query(aulasCol, where('scheduledFor','>=',start), where('scheduledFor','<=', min(range.end, now)), orderBy('scheduledFor')))`. Segue o padrão de janelas do `useAdminDashboardLeads`/`AppointmentTrackingView`.
- `computeProfessorConversion` passa a receber **aulas** (não leads): agrupa por `professorId` (solo → "Treina sozinho"), conta `aulas`, `compareceram` (`status==='attended'`), `matriculas` (`converted===true`). **Mesma saída de hoje** (linhas/totais/deltas), então `DashboardGerencialView` e o render praticamente não mudam.
- Fora desta entrega: o card "Aulas por modalidade" e o KPI "Aulas marcadas" continuam na base do agendamento atual do lead. O foco é a conversão por professor.

## Backfill

Script único (rodado uma vez, como os backfills de escala): varre os leads, e pra cada um com aula experimental no bloco denormalizado cria um registro em `stronix_aulas` a partir dos campos atuais — `professorId/Name`, `soloTraining`, `modality`, `scheduledFor`, `status` (de `appointmentOutcome`, ou `'agendada'` se não houver), `outcomeAt`, `converted` (se o lead está convertido e essa é a aula atendida → true; `convertedAt` do lead), `consultant*`. Grava `lead.currentAulaId`. Best-effort, uma aula por lead.

## Firestore

- **Regra** nova para `stronix_aulas`: leitura por membro do tenant; **create/update por qualquer membro do tenant preservando `consultantAuthUid`** (mesma ideia da regra de `stronix_leads`, pra presença cruzada e conversão por qualquer consultor funcionarem); delete restrito. Publicada **manualmente** por você no console.
- **Índices:** nenhum composto novo. As consultas usam campo único — `where leadId == X` (índice automático) com filtro de `status`/`converted` client-side (o lead tem poucas aulas), e range em `scheduledFor` (índice automático de campo único) pro dashboard.

## Fases (2 PRs)

- **PR-A:** coleção + dual-write (agendar, presença consolidada, conversão) + backfill + regra. Os dados começam a acumular; o dashboard segue igual.
- **PR-B:** vira a chave do `computeProfessorConversion` pra ler `stronix_aulas`. Mudança só de leitura, sobre dados já populados (menos risco).

## Testes

- `computeProfessorConversion` sobre aulas: agrupamento por professor, contagem de compareceram/matrículas, solo fora do ranking, janela de data (aula futura fora).
- Helper "última aula atendida do lead" (atribuição da conversão): escolhe a de maior `scheduledFor` com `status==='attended'`; ignora não-atendidas; retorna nada se não houver.
- Builder do registro de aula a partir do bloco do lead (compartilhado entre agendar e backfill): mapeia `appointmentOutcome` → `status`, solo/professor, modalidade.
- Suíte existente segue verde (a matemática do dashboard não muda de forma, só a fonte).

## Fora de escopo (de propósito)

- Sem tela nova de histórico (ficha/por professor) — decisão do Johnny, "por enquanto".
- "Aulas por modalidade" e KPI de aulas marcadas seguem na base do agendamento atual.
- Sem mudança na semântica da Meta Diária, agenda, no-show, timeline.
- Aula futura continua fora da conversão por professor (só conta aula que já aconteceu).

## Riscos e observações

- Dual-write pode divergir se um caminho esquecer de escrever a aula. Mitigação: consolidar os 3 caminhos de presença num helper só; centralizar a criação/atualização do registro de aula em funções puras testadas; PR-A antes de virar a leitura (PR-B), então dá pra conferir os dados acumulando antes de depender deles.
- Leads convertidos/perdidos não estão no set global ao vivo (`App.jsx` assina só `lifecycleBucket=='ativo'`). Por isso o dashboard lê a coleção de aulas direto (registros self-contained), não os leads — resolve o problema de o lead convertido não estar carregado.
- Publicação da regra do Firestore é manual (console), fora do deploy automático.
