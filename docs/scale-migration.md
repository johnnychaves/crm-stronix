# Runbook — migração de escala (PR D)

Passo a passo para ligar os campos de escala em produção: publicar os índices,
rodar o backfill e verificar. Executado pelo Johnny (precisa das credenciais
Admin). Depois disto as PRs E/F/G podem assinar fatias da coleção em vez da
coleção inteira.

## Contexto de 1 parágrafo

A PR C ligou o **dual-write**: toda escrita NOVA de lead já grava os campos
derivados (`lifecycleBucket`, campos de busca, `lastInteractionAt`,
`interactionsCount`). Mas os leads antigos ainda não têm esses campos — eles
ficam "adormecidos" até o backfill. A PR D traz dois artefatos: os **índices
compostos** (`firestore.indexes.json`) que as queries paginadas vão usar, e o
**backfill** (`scripts/backfill-scale-fields.js`) que preenche os leads antigos.

## Pré-requisitos

- [x] **PR C em produção** (merge `cb7615a` na main, 2026-07-13). Sem isso o
  backfill preencheria campos que o app ainda não mantém atualizados.
- [ ] Credenciais Admin em mãos (as mesmas das funções `api/`):
  `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY`.
- [ ] Node instalado localmente (o backfill roda da sua máquina, fora do app).

## Ordem de execução

```
1. Publicar índices  →  2. Aguardar ENABLED  →  3. Dry-run  →  4. Backfill  →  5. Verificar  →  (só então) E/F/G
```

### 1. Publicar os índices compostos

São 10 índices em `firestore.indexes.json` (já referenciado no `firebase.json`).
A convenção do projeto é publicação **manual** — duas opções:

**Opção A — Firebase CLI (recomendada, versiona junto):**
```bash
firebase deploy --only firestore:indexes --project <PROJECT_ID>
```
Publica exatamente o que está no `firestore.indexes.json`. Não apaga índices que
você tenha criado à mão que não estejam no arquivo (a CLI pergunta antes de
remover, se houver divergência).

**Opção B — Console Firebase:** Firestore → Índices → Composto → criar cada um
conforme a lista abaixo. Mais trabalhoso; use se preferir não rodar a CLI.

Lista (todos `queryScope = Coleção`; ASC = crescente, DESC = decrescente):

| # | Coleção | Campos | Serve |
|---|---|---|---|
| 1 | stronix_leads | lifecycleBucket ASC, funnelId ASC, lostAt DESC | Coluna Perda do Kanban por funil |
| 2 | stronix_leads | lifecycleBucket ASC, funnelId ASC, createdAt DESC | Paginação perda/cliente por funil |
| 3 | stronix_leads | lifecycleBucket ASC, convertedAt DESC | Aba Clientes |
| 4 | stronix_leads | lifecycleBucket ASC, currentContractEndsAt ASC | Clientes a vencer / Renovação |
| 5 | stronix_leads | appointmentType ASC, appointmentScheduledFor ASC | Agendamentos |
| 6 | stronix_leads | consultantId ASC, createdAt DESC | Dashboard consultor: leads novos |
| 7 | stronix_leads | consultantId ASC, convertedAt DESC | Dashboard consultor: conversões |
| 8 | stronix_leads | consultantId ASC, appointmentScheduledFor ASC | Dashboard consultor: agendamentos |
| 9 | stronix_interactions | leadConsultantAuthUid ASC, createdAt ASC | Janela mensal do consultor |
| 10 | stronix_interactions | leadId ASC, createdAt DESC | Timeline do perfil do lead |

### 2. Aguardar os índices ficarem ENABLED

No Console (Firestore → Índices) cada índice passa por `Building` → `Enabled`.
Em base pequena leva minutos. **Não rode as PRs E/F/G antes de todos estarem
`Enabled`** — o app quebraria com "query requires an index" enquanto estiver
`Building`. (O backfill em si NÃO depende dos índices; quem depende são as PRs
futuras. Pode rodar o backfill em paralelo à construção, se quiser.)

### 3. Dry-run do backfill (não grava nada)

```bash
FIREBASE_ADMIN_PROJECT_ID=... \
FIREBASE_ADMIN_CLIENT_EMAIL=... \
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
node scripts/backfill-scale-fields.js --tenant=stronix-crm-app --dry-run
```

Saída esperada: nº de interações lidas, leads varridos e **quantos mudariam**.
Confira se o número de leads bate com o esperado da academia.

### 4. Rodar o backfill (grava)

Preferir uma **janela de baixo tráfego** (madrugada): o backfill grava a
contagem absoluta de interações; uma interação criada exatamente durante a
varredura pode ficar 1 a menos até a próxima interação daquele lead (a live
`increment(1)` continua a partir do valor gravado — não regride de forma
permanente).

```bash
# mesma exportação de env do passo 3, sem --dry-run:
node scripts/backfill-scale-fields.js --tenant=stronix-crm-app
```

Flags úteis:
- `--tenant=<id>` — qual academia migrar (default `stronix-crm-app`).
- `--only=search,bucket,funnel,appointment,denorm` — roda só alvos específicos
  (ex.: `--only=denorm` para reprocessar apenas as contagens). Default: todos.
- `--dry-run` — simula.

**Idempotente:** rodar de novo dá o mesmo resultado (o script só grava o que
mudou; contagens e buckets são recalculados do zero a cada run, não incrementam).

O que cada alvo preenche no lead:
- **search** — `nameLower`, `nameTokens[]`, `whatsappDigits`, `whatsappDigitsRev`, `cpfDigits` (busca global e dup-check da PR F).
- **bucket** — `lifecycleBucket ∈ {ativo, perda, cliente}` (assinatura permanente da PR G).
- **funnel** — `funnelId` (só quando ausente → funil default do tenant).
- **appointment** — `appointmentType` + `appointmentScheduledFor` materializados a partir do legado (`nextFollowUpType`/`nextFollowUp`) para o índice #5 achar os agendamentos antigos.
- **denorm** — `lastInteractionAt` + `interactionsCount` (badge de temperatura da PR E lê daqui, sem carregar as interações).

### 5. Verificar

O próprio script imprime, ao final (quando o alvo `bucket` roda):

```
Verificação — leads: N | com lifecycleBucket: N | SEM bucket: 0
```

**`SEM bucket` tem que ser 0.** Se não for, rode o backfill de novo (é
idempotente) ou investigue os leads faltantes. O script sai com código ≠ 0
nesse caso.

Confira também no Console alguns leads antigos: devem ter agora
`lifecycleBucket`, `nameLower`, `whatsappDigits` e, se tinham interações,
`interactionsCount`/`lastInteractionAt`.

## Rollback

Os campos são **aditivos** — o backfill não apaga nem altera nada que o app já
lia (status, nextFollowUp, etc.), só acrescenta os derivados. Não há rollback a
fazer: enquanto as PRs E/F/G não entram, o app segue assinando a coleção inteira
e ignora esses campos. Se algo parecer errado, é seguro simplesmente não avançar
para E/F/G até revisar.

## Depois disto

Com índices `Enabled` + backfill verificado (`SEM bucket = 0`), o pré-requisito
das PRs **E** (consumidores paginados), **F** (busca/dup-check remotos) e **G**
(o flip das assinaturas) está satisfeito. O redesign do dashboard entra antes da
E2, conforme o plano de escala.
