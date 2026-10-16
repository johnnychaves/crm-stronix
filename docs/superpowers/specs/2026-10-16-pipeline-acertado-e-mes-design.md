status: rascunho

# Pipeline acertado e mês de cadastro

O Johnny escolheu o mockup A (`mockups/2026-10-16-pipeline-a-atual-acertado.html`) em 16/10/2026: o Pipeline de hoje com os erros de ajuste corrigidos. No mesmo pedido entrou o período por mês, no desenho da barra dos painéis (Gerencial, CRM e Operacional). O mockup B (`mockups/2026-10-16-pipeline-b-trilho.html`) fica guardado como referência.

## Erros de ajuste da tela de hoje

Medidos num harness com o `KanbanView` de verdade, a 1440 × 900:

1. O chip cortava a palavra no meio ("Condicionamento físic"): `truncate` num `inline-flex` não desenha reticências.
2. O card media 253 px na coluna que rola e 264 px na que não rola, e a barra de rolagem encostava na borda do card.
3. A altura do quadro era `100vh - 4rem`. Com a faixa do teste, da mensalidade ou do "Acessar como", o quadro passava 40 px do fim da tela, a página ganhava uma segunda rolagem e a barra lateral do quadro sumia embaixo.
4. Com 5 etapas o quadro tem 2.048 px, e Venda e Perda ficam fora da tela de 1.440 px, justamente as colunas em que mais se solta card.
5. A etiqueta do card tinha 9,5 px em maiúsculas, e o nome da etapa também saía em maiúsculas.
6. O funil vazio mostrava "0" na aba.

## O que muda na tela

- **Colunas como faixas.** Cada etapa ganha fundo próprio, a régua da cor da etapa no alto, o nome em letra normal, o total e, à direita, quantos estão atrasados. A Venda mostra o mês e o valor somado dos contratos.
- **Lista da coluna com o lugar da barra reservado** (`scrollbar-gutter: stable`): todo card tem a mesma largura.
- **Card.** Etiqueta de 11 px, sem caixa alta. A urgência sai do rodapé pintado e vira uma borda à esquerda (vermelha no atraso, âmbar no sem agenda, verde na venda). O chip passa a ter reticências, e o segundo chip encolhe antes do primeiro. O compromisso diz "hoje às 18:21". Os três links, os títulos e as ações do rodapé continuam como hoje.
- **Faixa de saída no arrasto.** Enquanto um card é arrastado, aparece no pé do quadro uma faixa com Venda e Perda, que recebem o card como as colunas. Nos funis de clientes os textos seguem o sentido de lá (renovar, não vai renovar, matricular de novo, não volta, fechar o upgrade, não quis).
- **Altura pelo espaço que sobra**, e não por `100vh`: o quadro cabe com qualquer faixa de aviso.
- **Abas.** Funil sem lead não mostra o "0". Os funis de clientes (Upgrade, Renovações e Vencidos) ficam depois de um traço. Vale também em Todos os leads, que usa as mesmas abas.

## A barra de filtros

No lugar do botão de filtro com balão, as pílulas dos painéis, à direita das abas:

- **Período**, o `PeriodControl` da barra dos painéis (setas e a lista de meses). A lista começa por "Todos os meses" e traz os últimos 12 meses, com "em andamento" no atual.
- **Consultor**, a pílula de escolha múltipla dos Relatórios (`ConsultoresControl`). A carteira padrão do papel continua sem acender a pílula: o consultor abre na própria carteira e o gestor na equipe toda.
- **Situação**: Todos ou Em atraso, o antigo "Somente em atraso".

Abaixo de 768 px os três entram num balão, como nos Relatórios.

## O mês é a safra

Decisão do Johnny: o mês escolhido recorta o quadro inteiro pelos leads **cadastrados** naquele mês.

- **Todos os meses** é o padrão e é o quadro de hoje: as etapas com todos os leads em aberto, a Venda com as matrículas do mês corrente e a Perda com todas as perdas do funil. Ficou como padrão para o lead de setembro que ainda está em conversa não sumir do quadro do consultor no dia 1º.
- **Com um mês escolhido**:
  - as etapas mostram os leads em aberto cadastrados no mês (lead sem data de cadastro real fica de fora);
  - a Venda mostra os leads do funil cadastrados no mês que viraram cliente, em qualquer data depois;
  - a Perda mostra os leads do funil cadastrados no mês que estão perdidos, com o total do servidor;
  - o número de cada aba de funil passa a contar só os leads em aberto do mês;
  - lead criado pela importação de clientes não entra, como nos painéis (`isImportCreatedLead`).
- **Funis de clientes** (Renovações, Vencidos e Upgrade) não têm mês de cadastro: lá a pílula de período some, e o quadro é o de hoje.
- **Endereço:** `mes=AAAA-MM`, entre `funil` e `resp`. Ausente é "Todos os meses". Mês fora dos últimos 12 cai em "Todos os meses", sem aviso.

## Consultas

Venda e Perda do mês usam a mesma consulta, `bucketByFunnelInMonthQuerySpec`: balde (`cliente` ou `perda`), funil, `createdAt` dentro do mês e ordem por `createdAt` decrescente. É o índice #2 (`lifecycleBucket`, `funnelId`, `createdAt` desc), que já existe: não há índice novo para publicar. A Venda do mês vem inteira, sem página. A Perda vem de 10 em 10, com "Carregar mais", e o total do cabeçalho é a contagem do servidor sobre a mesma consulta. As etapas não leem nada novo: o recorte é em memória, sobre a assinatura de leads em aberto que o App já tem.

## Fora desta entrega

- O layout do celular além de não quebrar (decisão de 28/09/2026: celular em segundo plano).
- As ideias do mockup B (relógio no card, fila de trabalho, trilho, saídas presas).

## Testes

- `screenParams`: `mes` na tabela do Pipeline, padrão ausente, mês válido, mês fora da janela e a ordem no endereço.
- `leadQueries`: a consulta do mês coberta pelo índice #2.
- `kanban`: lista de meses, recorte por mês de cadastro e contagem de atrasados.
- `kanbanCardLink`: os três links, os títulos e as ações continuam iguais.
- Harness no navegador: largura igual dos cards, quadro dentro da tela com faixa de aviso, faixa de saída no arrasto, claro e escuro.
