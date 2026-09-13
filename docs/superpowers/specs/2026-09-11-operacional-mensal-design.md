---
status: revisão
---

# Operacional por competência · especificação técnica

Data: 2026-09-11 · branch `claude/operational-dashboard-redesign-7508c0`

Fontes: o levantamento aprovado com o Johnny, o handoff do Claude Design (`design_handoff_operacional/`, com `README.md` e `Operacional.dc.html`) e o prompt em `2026-09-11-operacional-prompt-claude-design.md`.

## 1. Objetivo

Trocar `src/views/dashboard/DashboardOperacionalView.jsx`, que hoje é uma tela do dia e muda conforme o papel, por uma tela mensal igual para todos, com comparativo e filtro de pessoa. Visual, textos e comportamento vêm do handoff, que é a fonte da verdade e deve ser portado classe a classe, sem reinterpretar. Este documento cobre o que o handoff não resolve: de onde sai cada número, como buscar meses passados, o que muda em regras e escritas e o que sai do código.

## 2. Decisões fechadas

- O Operacional mede o trabalho feito e a saúde da base de clientes. Lead e funil ficam para o dashboard CRM (outro projeto). O Gerencial continua, com papel a definir.
- A tela é a mesma para todos. O filtro mostra "Equipe toda" ou qualquer usuário, e todo mundo vê todo mundo.
- A competência é mensal. Por padrão compara com o mês anterior, mas aceita qualquer mês passado ou o mesmo mês do ano anterior. No mês em andamento a comparação é pró-rata, e a caixa "Comparar" liga e desliga todo o comparativo.
- Com uma pessoa filtrada (decisão do handoff):
  - Continuam da academia: Clientes ativos, Churn e o bloco Base de clientes (movimento, cancelamentos, trancamentos).
  - Passam a ser da pessoa: Rotina, Renovação e Upgrades.
- Atribuição: a venda é do consultor gravado no contrato. A carteira de renovação é do responsável atual pelo cliente.
- Contrato importado de planilha entra na base e na renovação, mas nunca conta como matrícula, retorno, cancelamento ou trancamento.
- A tela não mostra valores em R$.

## 3. Arquitetura

Regra de ouro do handoff (README §6): uma função calcula tudo. `metricsOf(mês, pessoa | null)` serve ao mês exibido, ao mês comparado e a cada ponto das tendências. A fonte é sempre o detalhe, o número da equipe é a soma e nenhuma taxa fica gravada.

Arquivos novos:

- `src/lib/operacional/`, com módulos puros, sem React e sem Firestore:
  - `month.js`: meses, janelas e corte pró-rata.
  - `base.js`: vigência, ponte, churn, cancelamentos e upgrades.
  - `renewal.js`: coorte, desfechos, marcos e a vencer.
  - `routine.js`: meta, prospecção, tarefas e atrasados.
  - `metrics.js`: `metricsOf`, diferenças, destaques e tendências.
  - `queries.js`: especificações das consultas por mês, no padrão de `leadQueries.js`.
- `src/hooks/useOperacionalSources.js`: carrega e guarda em memória as fontes de cada mês (seção 6).
- Componentes em `src/views/dashboard/`, com os nomes do handoff §1: `OperacionalToolbar`, `DashSummaryBand`, `DashHighlights`, `MetaDaysCalendar`, `ProspectionByDay`, `BaseBridge`, `RenewalOutcomeBar`, `MilestoneBars` e `TeamMonthTable`. A tela `DashboardOperacionalView.jsx` é reescrita e só monta esses componentes.

Reaproveitados: `DashCard`, `DashHelpTip`, `BreakdownCard`, `Sparkline`, `dashTokens` e, do shadcn, `select`, `tooltip` e `separator`. O `checkbox` do shadcn entra com `npx shadcn@latest add checkbox`. A faixa de resumo desenha a própria pílula de diferença, porque o `DashKpiCard` formata a diferença como porcentagem de variação e o handoff pede p.p. para taxa e número absoluto para contagem.

No `App.jsx`, o Operacional passa a receber as mesmas props para todos, sem ramo por papel: contratos (contexto), `metaLeads`, interações do mês corrente sem filtro, `usersList`, `db` e a configuração da academia.

## 4. Fonte de cada número

| Número | Fonte |
|---|---|
| Meta diária e régua de dias | `stronix_daily_goal_history` (um doc por pessoa por dia batido, campo `date` "YYYY-MM-DD") |
| Prospecção e prospecção por dia | leads criados no mês, de todos os baldes (dono = `consultantId`), mais interações com `volumeKind` (autor = `interactionOwnerAuthUid`) |
| Tarefas concluídas por tipo | interações `type: 'daily_goal_done'` pelo `dailyGoalCategory` |
| Atrasados agora | `metaLeads`, com a mesma condição da categoria Atrasados da Meta (`dailyGoal.js:368`) |
| Clientes ativos, movimento da base, churn, cancelamentos, trancamentos, upgrades | `stronix_contratos`, que já carrega inteira e ao vivo para todos |
| Renovação e marcos | contratos, mais interações de desfecho e o doc do lead (responsável atual) |
| A vencer | contratos vigentes, só no mês em andamento |

## 5. Regras de cálculo

Mês M é o intervalo [início, fim) no horário local. No mês em andamento, o fim efetivo é agora. O corte pró-rata do mês comparado vai do início até o mesmo dia do mês, limitado ao fim do mês comparado.

### 5.1 Meta diária

- Dias de meta são os dias de M em `metaWeekdays`. Contam só os já fechados; no mês em andamento, hoje aparece à parte na régua.
- Batidos são os docs de histórico com `date` nesses dias. Um dia sem tarefa não gera doc e conta como não batido, a mesma régua do painel da Equipe.
- Pessoa: os docs dela. Equipe: a soma dos dias-pessoa de todos os usuários.
- Calendário: para a pessoa, bateu ou não bateu. Para a equipe, quantas pessoas bateram em cada dia.

### 5.2 Prospecção

- As ações de uma pessoa somam:
  - os leads criados em dia de meta com o `consultantId` dela, em qualquer balde;
  - as interações com `volumeKind` cujo dono (`interactionOwnerAuthUid`) é ela.

  É a regra de `computeVolumeInRange`, aplicada a uma base que inclui leads já convertidos ou perdidos.
- O alvo é `volumeTargetFor(usuário)` vezes os dias de meta do período. No mês em andamento, conta os dias decorridos incluindo hoje, como a Meta faz.
- Alvo 0 significa prospecção desligada: aparece "Desligada", sem porcentagem, e o card de prospecção por dia sai da tela.
- Na equipe entram só as pessoas com alvo maior que zero. O alvo diário do gráfico é a soma dos alvos.

### 5.3 Tarefas concluídas por tipo

- Categorias: Novos leads = `novo_24h`, Contatos = `contato_hoje`, Visitas e aulas = `visita_hoje` + `aula_hoje`, Atrasados = `atrasado`, Renovações = `renovacao`, Vencidos = `vencido`.
- Uma tarefa é única por lead, categoria e dia, então conclusões repetidas contam uma vez.
- O dono é `interactionOwnerAuthUid`.

### 5.4 Atrasados agora

Leads em `metaLeads` com `nextFollowUp` antes do início de hoje e status fora de Venda e Perda, agrupados por `consultantId`. Com a equipe, o número aparece como coluna da tabela. Com uma pessoa, vira um card. Em mês fechado dá lugar ao card tracejado do handoff.

### 5.5 Base de clientes

- Cliente vigente no instante t é o lead que tem contrato com:
  - `startsAt ≤ t < endsAt`;
  - status diferente de cancelado, ou cancelamento depois de t;
  - e não está trancado em t (`pausedAt ≤ t`, sem `resumedAt` ou com `resumedAt` depois de t).
- Clientes ativos(t) conta leads vigentes, sem repetir quem tem mais de um contrato. Trancados(t) conta quem está trancado e sem outro contrato vigente.
- A ponte usa transição de estado, então sempre fecha. A = vigentes no início de M e B = vigentes no fim efetivo.
  - Cada lead em B e não em A é uma entrada, classificada como:
    - Entraram: o primeiro contrato da vida do lead foi criado em M e não é importado.
    - Voltaram: tinha contrato anterior e voltou depois da tolerância (`renewalGraceDays`) ou dentro dela.
    - Trancamentos: saiu do trancamento.
  - Cada lead em A e não em B é uma saída, classificada como:
    - Cancelaram: o contrato foi cancelado em M.
    - Venceram: a vigência terminou em M sem sucessor.
    - Trancamentos: foi trancado.
  - O passo "Trancamentos" mostra o saldo. A conta fecha: início + entradas − saídas = fim = Clientes ativos.
- Quem entrou e saiu dentro do mesmo mês não aparece na ponte. O "Entraram" da tabela da equipe conta matrículas por vendedor, então os dois só divergem nesse caso raro. A dica da ponte avisa.
- Churn = saídas definitivas em M ÷ ativos no início de M. A saída definitiva acontece no dia do cancelamento, ou no dia em que acaba a tolerância de um contrato vencido sem retorno.
- Cancelamentos por motivo: contratos com `cancelledAt` em M, agrupados por `cancelReason`. Ficam de fora os cancelamentos que vieram da planilha, isto é, contrato importado, sem motivo e com `cancelledAt` no dia do `endsAt`. Cancelamento feito no app conta normalmente, mesmo em contrato importado.
- Trancaram e destrancaram saem da transição de estado da ponte. As pausas vêm do `pauseHistory`, que a reativação passa a gravar a partir desta entrega. Nos contratos antigos, a pausa é reconstruída por `resumedAt − pausedDaysTotal`, e várias pausas antigas viram uma só (limitação conhecida).
- Contrato trancado não vence enquanto a pausa estiver aberta. Se ele ganhar um contrato sucessor, a pausa fecha no início do sucessor.
- A pausa gravada pela importação começa no dia da importação e não conta como trancamento.
- Upgrades: contratos com `closedFromUpgrade` e `createdAt` em M, sem importados, atribuídos ao consultor do contrato.

### 5.6 Renovação

- A coorte são os contratos com `endsAt` em M, inclusive importados, que não foram cancelados antes do fim.
- Desfechos:
  - Renovou: existe contrato com `renewedFromId` igual a este, ou outro contrato do mesmo lead criado até `endsAt` + tolerância. O segundo caso cobre a reativação feita pela ficha, que hoje nasce como matrícula.
  - Quando renovou: "antes de vencer" (sucessor criado antes do dia do fim), "no vencimento" (no mesmo dia) ou "depois, na tolerância".
  - Não vai renovar: há declínio registrado no ciclo (seção 7, item 2) e não houve renovação.
  - Venceu sem renovar: o fim passou, sem renovação e sem declínio.
  - Ainda vai vencer: o fim ainda não chegou (só no mês em andamento).
- Taxa de renovação:
  - Mês fechado: renovou ÷ coorte.
  - Mês em andamento: renovou ÷ (renovou + não vai + venceu).
- O número de um mês fechado pode subir até a tolerância do último vencimento acabar, porque alguém ainda pode renovar atrasado. Uma nota discreta no card avisa.
- Atribuição: a pessoa é o responsável atual (`consultantId` no doc do lead). Se o lead não for achado, vale o consultor do contrato.
- Motivos de quem não vai renovar: o motivo gravado no lead (`renewalDeclineReason`). Registros antigos, sem esse campo, entram como "Outro".

### 5.7 Contatos nos marcos

- Para o marco C, o cruzamento é `endsAt − C` dias.
- Chegaram ao marco em M: contratos cujo cruzamento cai em M e que estavam vigentes e sem sucessor nesse dia.
- Feitos: desses, os que tiveram `daily_goal_done` de renovação, de qualquer autor, entre o cruzamento e o marco seguinte (ou o fim, para o menor marco), ou que renovaram nesse intervalo.
- Os marcos vêm de `renewalCheckpoints` (padrão 90, 60, 30) e a atribuição é o responsável atual.

### 5.8 A vencer

Contratos vigentes, sem o próximo contrato já fechado, com fim em três faixas sem sobreposição a partir de agora: até 30 dias, de 31 a 60 e de 61 a 90. O handoff não tem card de vencidos em aberto. Quem venceu no mês e ainda está na tolerância aparece na fatia "venceu sem renovar".

### 5.9 Comparação, destaques e tendências

- Diferença = valor do mês exibido − valor do mês comparado, os dois vindos de `metricsOf`. Taxa aparece em p.p. e contagem em número absoluto.
- Quando o mês comparado não tem nenhum dado, aparece "sem base". Quando a diferença é zero, aparece "igual".
- Destaques:
  - Candidatos: as métricas que ficam fora da faixa de resumo, isto é, tarefas por tipo, os três marcos, upgrades, cancelamentos por motivo e renovações por janela.
  - Escore: para taxa, o módulo da diferença em p.p. Para contagem, o módulo da diferença ÷ max(comparado, 4) × 60.
  - Entram os três maiores, sem diferença zero. O texto segue o formato "Nome: de X para Y", a pílula traz a diferença e o veredito depende da direção boa de cada métrica.
  - Com a comparação desligada, o bloco some. No celular, o pior destaque vem primeiro.
- Tendências: `metricsOf` roda para os seis meses até o mês exibido. Mês sem nenhum dado fica fora, e o rótulo diz quantos meses entraram.

## 6. Carga de dados e custo de leitura

Já estão em memória: contratos, usuários, configuração, os leads da Meta (ativos, candidatos a renovação e clientes com contato hoje) e as interações do mês corrente.

| Leitura nova | Consulta | Tamanho estimado |
|---|---|---|
| Histórico de metas do mês corrente | ao vivo, `date >=` primeiro dia do mês (índice automático) | até cerca de 90 docs no fim do mês, com 4 pessoas |
| Histórico de metas de mês fechado | `date` do primeiro dia do mês até antes do primeiro dia do seguinte | cerca de 90 por mês |
| Interações de mês passado | `createdAt` no intervalo do mês (índice automático) | cerca de 400 por mês (auditoria de julho: 398) |
| Leads criados no mês, todos os baldes | `createdAt` no intervalo do mês (índice automático; o Gerencial já faz igual) | cerca de 100 a 150 por mês |
| Leads da carteira de renovação | por id, em lotes de 30, sem os que a Meta já carrega | cerca de 35 por mês da janela, perto de 200 no total |

Mês exibido fechado carrega também os meses que o intervalo dos marcos alcança depois do fim dele, sem passar do mês corrente: um mês com os marcos padrão (90, 60 e 30), dois com marcos espaçados como 90 e 30.

Cache: o app já usa o cache persistente do Firestore (`persistentLocalCache` em `src/lib/firebase.js:50`).
- Mês fechado: a busca tenta primeiro o cache (`getDocsFromCache`) e confere com `getCountFromServer` da mesma consulta, que custa uma leitura por até mil docs.
  - Contagem igual: usa o cache.
  - Contagem diferente: busca do servidor.
- Mês em andamento: os leads criados vêm do servidor, sem esse atalho.

As interações são praticamente só de inclusão, porque editar e apagar é exclusivo do gestor. Por isso a contagem pega quase toda mudança.

Memória da sessão: a tela desmonta a cada troca de aba. Os meses já carregados ficam guardados no navegador até a página recarregar, separados por academia.
- Mês fechado guardado é usado direto, sem nova contagem.
- Mês corrente guardado também. Na volta à aba, busca só os leads criados desde a última busca, com 2 minutos de folga, e junta pelo id.
- Não guarda mês que falhou nem mês fechado que veio sem o histórico. A volta tenta de novo.

Estimativa de leitura, com as seis tendências e 4 pessoas:
- Primeira abertura na sessão do navegador:
  - no primeiro uso do aparelho, sem cache: cerca de 3.500 leituras. São 5 meses fechados de cerca de 600 docs, mais os leads do mês corrente, o histórico ao vivo e a carteira;
  - com o cache do aparelho já preenchido: de 250 a 450 leituras, conforme o dia do mês. São 15 contagens (3 por mês fechado), os leads criados no mês corrente (de 20 no começo a 150 no fim), o histórico ao vivo (até 90) e a carteira (perto de 200).
- Volta à aba na mesma sessão: de 1 a cerca de 100 leituras.
  - Os meses fechados saem da memória, sem contagem.
  - Os leads novos custam uma leitura, mesmo sem nenhum lead novo, mais uma por lead criado desde a última busca.
  - A carteira não é lida de novo.
  - O que continua custando é o histórico ao vivo, assinado de novo a cada volta. Se a última escuta foi há menos de 30 minutos, o Firestore cobra só o que mudou. Se foi há mais, cobra o mês inteiro, até 90 docs.
- Recarga da página: a memória some e o custo volta ao da primeira abertura com cache, de 250 a 450 leituras. A carteira, que vem sempre do servidor, é lida de novo.

Enquanto a regra antiga do histórico estiver publicada, o mês fechado de quem não é gestor volta sem histórico e não fica na memória. Cada volta à aba refaz a conferência dos meses fechados, cerca de 15 leituras.

As tendências completam depois do primeiro desenho, sem mudar a altura da tela.

Nenhum índice composto novo: as consultas novas são de campo único ou por id.

## 7. Mudanças em regras e escritas

1. `firestore.rules`: a leitura de `stronix_daily_goal_history` passa a valer para qualquer membro da academia. Hoje é só o gestor ou o próprio dono. A publicação é manual, no console do Firebase.
2. "Não vai renovar" com motivo da lista fixa. O `RenewalOutcomeModal` troca o campo de texto pela escolha do motivo (`CONTRACT_CANCEL_REASONS`), mais uma nota opcional, e grava:
   - no lead: `renewalDeclinedAt` e `renewalDeclineReason`;
   - na interação: `renewalOutcome: 'declined'` e `renewalDeclineReason`.
3. Dia de meta batida gravado a partir de qualquer tela. O `App.jsx` já calcula as pendências de hoje (`dailyGoalPending`). Quando elas chegam a zero com pelo menos uma tarefa, o dia é gravado com a mesma rotina de `recordGoalHit`, extraída do `DailyGoalView.jsx` para `lib/`.

## 8. O que sai do código

- A tela atual inteira: `DayPulseCard`, `ConsultantCard` e `PlacarDoDia`.
- De `dashboardMetrics.js`: `computeDayFunnel`, `computeConsultantDayBoard`, `computeTodayAgenda`, `computeNoShowsToRework` e `computePendingFollowUps`, que só o Operacional usa, com os testes delas.
- De `DashPrimitives.jsx`: `DashTimeline`.
- `src/components/ui/LeadListPanel.jsx`, se continuar sem uso depois da troca.
- No `App.jsx`, os ramos por papel nas props do Operacional.

Ficam: `useDayAgenda` (usado pela Meta Diária), `useTeamGoals` (Gerencial) e toda a matemática do Gerencial.

## 9. Comportamento

Tudo segue o handoff:
- Barra de controles fixa, com mês, "Comparar", mês comparado e pessoa.
- Linha sob o título explicando a comparação.
- Clique na tabela da equipe filtra por aquela pessoa.
- Cards tracejados em mês fechado.
- Carregamento sem esqueleto: 35% de opacidade e um fio de 2px.
- Quebra para celular abaixo de 768px.
- Toda marca com valor ganha dica pelo `Tooltip` do shadcn, dentro de um elemento focável.

Os textos finais estão no README do handoff, §7.

## 10. Testes

- Testes unitários de `operacionalMetrics.js`, com dados sintéticos, cobrindo:
  - equipe igual à soma das pessoas em toda contagem;
  - taxa sempre coerente com as contagens mostradas;
  - ponte fechando (início + passos = fim = clientes ativos);
  - corte pró-rata;
  - importado fora de entraram e cancelaram;
  - renovação antes, no dia e na tolerância;
  - declínio estruturado e legado;
  - marcos;
  - prospecção desligada;
  - pessoa filtrada mantendo a base da academia;
  - destaques sem as cinco métricas da faixa;
  - "sem base".
- As novas especificações de consulta testadas contra `firestore.indexes.json`.
- Teste ao vivo logado, como gestor e como consultor: mês em andamento e mês fechado, uma pessoa filtrada, celular e tema escuro.

## 11. Pontos para confirmar

1. Com pessoa filtrada, a base continua da academia, como o handoff decidiu. A carteira da pessoa também é calculável, se preferir.
2. Cache de mês fechado conferido por contagem (recomendado).
3. Os rótulos de "A vencer" viram faixas: "até 30 dias", "31 a 60 dias" e "61 a 90 dias".
4. Aba padrão da Visão geral: hoje o gestor abre no Gerencial e o consultor no Operacional. Manter?
5. Nota no card de renovação avisando que um mês fechado ainda pode mudar dentro da tolerância.

## 12. Fora do escopo

Dashboard CRM, novo papel do Gerencial, valores em R$, renovação por professor e tempo até o primeiro contato.
