# Visitas/Aulas: exportar relatório + aba "Em andamento"

status: ativo
data: 2026-07-22

## Problema

A tela de Visitas/Aulas experimentais (`src/views/AppointmentTrackingView.jsx`, um
componente que serve às duas listas via `isAula`) tem abas de dia (Hoje · Ontem ·
Amanhã) e filtros (Responsável, Professor, período custom). Faltam duas coisas:

1. Não dá pra **baixar/imprimir** a lista para levar num relatório.
2. As aulas com **passe livre de vários dias** (o passe vale N dias — ver
   `freePassNote`, que já mantém um contador regressivo `daysLeft`) só aparecem
   na aba do dia em que foram marcadas. Não há uma visão das aulas cujo passe
   **ainda está ativo** no mês.

## Decisões (com o Johnny)

- **Export:** gera **PDF e CSV**.
- **Filtros do export:** painel próprio no modal (não só o filtro da tela) —
  Período (de/até), Responsável (multi), Professor (multi, só Aulas),
  Modalidade (multi, só Aulas), Desfecho (Agendado/Compareceu/Faltou/Cancelou, multi).
- **Aba "Em andamento":** só na tela de **Aulas** (visita é pontual, não tem passe
  multi-dia). Mostra as aulas cujo passe ainda está ativo no mês.

## Feature 1 — Exportar (PDF + CSV)

- Botão **"Exportar"** no header da tela, ao lado do filtro.
- Abre o modal **"Exportar relatório"** com os filtros acima. Botões:
  - **Imprimir / PDF:** abre uma view de relatório limpa (nova aba/janela) com
    cabeçalho (Visitas/Aulas, período, filtros aplicados) + tabela, e chama
    `window.print()`. O usuário imprime ou "Salvar como PDF". **Sem lib de PDF.**
  - **Baixar CSV:** gera o CSV (separador `;` p/ Excel pt-BR, BOM UTF-8) e baixa
    via `Blob`. **Sem lib de CSV.**
- Colunas do relatório: Nome, Objetivo/Dor, Data marcada, (Aulas: Professor,
  Modalidade, Passe), Desfecho, Responsável. Reflete os filtros do modal.

## Feature 2 — Aba "Em andamento" (só Aulas)

- Nova aba ao lado de **"Amanhã"** (só quando `isAula`).
- Critério: aulas cujo **passe ainda não expirou** — reusa a regra do
  `freePassNote` (`daysLeft >= 0`), dentro do **mês corrente**.
- A janela de dados da tela é estendida para cobrir o mês quando essa aba está
  ativa (o mecanismo de range custom já suporta ~30 dias).
- Cada linha mostra o contador regressivo, como já aparece na coluna "Passe livre".

## Arquitetura / técnico

- **Lógica pura e testada em `lib/`:**
  - `isPassActive(lead, now, trialClassOptions)` (ou reuso/extração da regra de
    `freePassNote`): true quando o passe da aula ainda está válido. Base da aba
    "Em andamento" e do filtro do relatório.
  - `buildReportRows(leads, { isAula, filters })` → linhas normalizadas do
    relatório (aplica os filtros do modal). `rowsToCsv(rows)` → string CSV.
  - Testes unitários dessas funções.
- Modais/tela ficam finos (padrão do repo: regra em lib + teste).
- **Sem** lib de PDF/CSV nova, **sem** regra/índice Firestore novo (reusa a query
  existente, com a janela estendida ao mês).

## Fora de escopo

- Aba "Em andamento" em Visitas.
- Agendamento/edição a partir do relatório (é só leitura/export).
- Geração server-side de PDF.

## Entrega

- 1 PR (mesma tela). Verificação no preview + merge com aprovação do Johnny.
