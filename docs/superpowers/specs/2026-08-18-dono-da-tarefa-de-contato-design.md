# Dono da tarefa de contato — design

status: ativo
data: 2026-08-18
autor: Johnny + Claude

## O problema

Johnny agendou uma mensagem num lead dele e a tarefa apareceu na Meta Diária.
Agendou outra num lead de uma consultora e a tarefa **não** apareceu para ele.

Não é bug. A Meta Diária é pessoal por construção
(`src/lib/dailyGoal.js:296`):

```js
const myLeads = (leads || []).filter(l => l.consultantId === consultantId);
```

O `consultantId` que chega ali é sempre o do usuário logado
(`src/App.jsx:1185`), sem exceção para gestor. A tarefa foi para a Meta da
consultora, dona do lead.

O que falta é escolha. Hoje **quem agenda não decide nada**: a tarefa vai
sempre para o dono do lead, mesmo quando quem marcou foi outra pessoa e é ela
quem pretende fazer o contato. O caso concreto é o gestor que marca um
follow-up que ele mesmo vai puxar.

### O que já existe a favor

- As regras do Firestore **já permitem** agendar em lead de outro consultor.
  Há comentário explícito em `firestore.rules:76`.
- Leitura de lead é livre dentro da academia (`firestore.rules:68`), então
  rotear tarefa para qualquer consultor não cria problema de acesso.
- A assinatura global carrega **todos** os leads ativos da academia, sem filtro
  por consultor (`src/App.jsx:623`). O recorte por pessoa é client-side, ou
  seja, o lead delegado já está em memória.

### O que não existe

Conceito de dono da tarefa. O roteamento é 100% `lead.consultantId`.

## Decisões (Johnny, 2026-08-18)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo | Só **mensagem e ligação**. Visita e aula ficam de fora: já aparecem na Agenda do Dia, que é compartilhada. |
| 2 | Padrão | **Dono do lead**, o comportamento de hoje. O seletor é opcional e opt-in. Zero regressão. |
| 3 | Visibilidade | **Só o escolhido vê** a tarefa. Uma tarefa, um dono. |
| 4 | Quem pode delegar | Qualquer consultor, não só gestor. As regras já permitem agendar em lead alheio; travar só no app criaria inconsistência. |
| 5 | Consultor desativado | O seletor lista só usuários ativos. Tratamento de tarefa órfã fica para depois, se acontecer. |

## Modelo de dados

Dois campos novos em `stronix_leads`:

| Campo | Tipo | Observação |
|---|---|---|
| `nextFollowUpOwnerId` | string \| null | Id do usuário dono da tarefa de contato. **Ausente significa o dono do lead.** |
| `nextFollowUpOwnerName` | string \| null | Nome no momento da escolha, para exibir sem consulta extra. |

Ausente significando o dono do lead é o mesmo truque do `type` em
`stronix_aulas` (PR 1): **zero backfill, zero migração**, e todo lead existente
continua se comportando como hoje.

**Sem query nova, sem índice novo, sem regra nova.** Tudo é filtro client-side
sobre dados já carregados.

## A regra de roteamento

Função pura nova em `src/lib/leads.js`:

```js
export const contactOwnerId = (lead) => lead?.nextFollowUpOwnerId || lead?.consultantId || null;
```

Em `computeDailyGoalSlots`:

- **Categorias 1 a 4, 6 e 7** (novo 24h, atrasado, visita hoje, aula hoje,
  renovação, vencido) continuam saindo de `myLeads`, filtrado por
  `consultantId`. Delegar um contato **não** arrasta as outras tarefas do lead.
- **Categoria 5** (Contato Hoje) passa a exigir
  `contactOwnerId(lead) === consultantId`. Consequência da decisão 3: quando o
  contato é delegado, ele sai da Meta do dono do lead.
- Lead de **outro** consultor delegado para mim não está em `myLeads`. Entra por
  um segundo laço, que roda **somente** a categoria 5.

## Escrita

`buildSchedulePatch` (`src/lib/schedulePatch.js`) ganha `contactOwnerId` e
`contactOwnerName`, gravados **apenas** quando o tipo não é compromisso formal
(decisão 1). Compromisso segue sem dono de tarefa.

`contactReschedule` (`src/lib/contactGoal.js`) e `commitNextContact`
(`src/views/DailyGoalView.jsx`) **não mencionam** os campos novos. Como a
gravação é `set(merge:true)`, o que não é mencionado sobrevive: quem recebeu a
tarefa continua com ela ao reagendar.

## Interface

Seletor opcional no `ScheduleWizard`, visível **só** nos tipos Mensagem e
Ligação. Fica ao lado do campo de observação, no passo de dia e horário — **não
vira passo novo**, já que o fluxo desses tipos hoje tem um passo só.

Rótulo padrão: `Responsável pelo lead (<nome>)`. Lista os usuários ativos da
academia.

## Rastro para o dono do lead

Como só o escolhido vê a tarefa (decisão 3), o dono do lead precisa de outro
caminho para saber que alguém marcou um contato no lead dele. A nota da linha do
tempo passa a indicar o destino quando ele não for o dono:

```
🔔 Mensagem agendada p/ 20/08 14:00 · tarefa de Maria
```

Quando a tarefa fica com o próprio dono do lead, a nota não muda.

## Testes

| Teste | Cobre |
|---|---|
| `contactOwnerId` com campo ausente, preenchido e lead sem consultor | Regra de roteamento |
| Contato delegado aparece na Meta de quem recebeu | Decisão 3 |
| Contato delegado SOME da Meta do dono do lead | Decisão 3 |
| Delegação não arrasta visita, aula, atrasado nem novo 24h do lead | Recorte por categoria |
| Sem o campo, a tarefa continua indo para o dono do lead | Decisão 2, zero regressão |
| `contactReschedule` e `commitNextContact` preservam o dono da tarefa | Escrita |
| `buildSchedulePatch` não grava dono em visita nem aula | Decisão 1 |

## Fora de escopo

- **Visita e aula com dono de tarefa.** Decisão 1.
- **Tarefa aparecer para os dois.** Decisão 3: quebra o modelo de conclusão.
- **Tratamento de tarefa órfã** quando o consultor sai da academia. Decisão 5.
- **Notificação ativa** para o dono do lead. O rastro é a linha do tempo.
