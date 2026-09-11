---
status: rascunho
---

# Prompt para o Claude Design · Operacional

> Cole tudo o que está abaixo da linha no claude.ai/design, depois de dar acesso à pasta do Stronilead (`06-sistemas/stronilead/`). Se quiser mandar a referência visual, compartilhe o mockup HTML das três direções e cole o link junto. A estrutura pedida aqui é a direção A com os destaques da direção B.

---

## O pedido

Desenhe a nova tela **Operacional** do Stronilead, o CRM de academias da STRONIX. Ela substitui a tela atual (`src/views/dashboard/DashboardOperacionalView.jsx`). Quero alta fidelidade, fiel ao visual que o app já tem, pronta para virar código React neste mesmo repositório.

## Contexto

O Stronilead organiza o comercial de academias: leads, pipeline, Meta Diária, clientes, contratos e renovações. O grupo "Visão geral" do menu passa a ter três painéis:

- Operacional, esta tela: o trabalho do dia a dia e a saúde da base de clientes.
- CRM, outro projeto que não é para desenhar agora: o funil de leads (captação, agendamentos, comparecimento, conversão, canais e motivos de perda).
- Gerencial, que continua com um papel ainda a definir.

Para decidir onde cada número fica: o Operacional mede o trabalho feito e a saúde da base, e o CRM mede o resultado do funil de leads.

Quem usa são os gestores e os consultores de vendas da academia. A tela é a mesma para todos os perfis.

## Como a tela funciona

Uma linha de controles no topo vale para a tela inteira.

1. Mês de competência: seletor com setas (‹ Setembro 2026 ›). Cada número pertence ao mês em que o fato aconteceu.
2. Comparar com: por padrão, o mês anterior. Dá para escolher qualquer mês passado, inclusive o mesmo mês do ano anterior. No mês em andamento a comparação é pró-rata, ou seja, 11 de setembro contra os 11 primeiros dias do mês comparado. Uma linha de texto abaixo do título avisa isso.
3. Pessoa: "Equipe toda" ou qualquer usuário. Todo mundo vê todo mundo, inclusive o consultor vendo os colegas. A tela abre em "Equipe toda".

## Estrutura

A ordem abaixo saiu de três direções testadas em mockup. Siga a ordem; a execução visual é sua.

1. Três destaques do mês. São frases geradas a partir das maiores mudanças contra o mês comparado, por exemplo "Taxa de renovação: de 74% para 66%", com um selo "▼ −8 p.p. · piorou". Servem para a reunião de fechamento.
2. Faixa de resumo com cinco números num objeto só: meta diária, prospecção, clientes ativos, churn e taxa de renovação. Cada um traz a diferença contra o mês comparado e uma tendência de seis meses, com o mês em andamento marcado como parcial.
3. Rotina: o trabalho foi feito?
   - Prospecção por dia: colunas por dia de meta, com a linha do alvo diário.
   - Dias de meta: calendário de segunda a sexta. Para uma pessoa, mostra se bateu ou não. Para a equipe, quantas pessoas bateram em cada dia.
   - Tarefas concluídas por tipo: novos leads, contatos, visitas e aulas, atrasados, renovações e vencidos, com uma marca fina no valor do mês comparado.
   - Atrasados agora, só no mês em andamento: o total e o número de cada pessoa.
4. Base de clientes: a carteira cresceu ou encolheu?
   - Movimento da base, em forma de ponte (waterfall): de quantos clientes ativos o mês partiu, quantos entraram, quantos voltaram, quantos cancelaram, quantos venceram sem renovar, o saldo de trancamentos e onde o mês terminou.
   - Cancelamentos por motivo.
   - Upgrades e trancamentos.
5. Renovação: estamos segurando quem vence?
   - Contratos vencendo no mês: uma barra com o desfecho de cada contrato (renovou, não vai renovar, venceu sem renovar, ainda vai vencer) e, abaixo, quando renovou (antes de vencer, no vencimento ou depois de vencer, dentro da tolerância).
   - Contatos nos marcos de 90, 60 e 30 dias.
   - Motivos de quem não vai renovar.
   - A vencer em 30, 60 e 90 dias, só no mês em andamento.
6. Equipe no mês, só com "Equipe toda": uma linha por pessoa com meta, prospecção, taxa de renovação, entraram, upgrades e atrasados agora. Clicar na linha filtra a tela por aquela pessoa.

## Definições

Use estes nomes e estas contas nos rótulos e nas dicas.

| Métrica | Como calcula |
|---|---|
| Meta diária | Dias com meta batida ÷ dias de meta do mês. No mês em andamento conta só os dias já fechados, e hoje aparece à parte. Os dias de meta vêm da configuração da academia (padrão: segunda a sexta). |
| Prospecção | Ações de prospecção ÷ alvo do mês (alvo diário da pessoa × dias de meta). Quem tem alvo 0 no cadastro está com a prospecção desligada: mostre "Desligada", sem porcentagem. |
| Tarefas concluídas | Tarefas da Meta Diária concluídas no mês, separadas por tipo. |
| Atrasados agora | Contatos que passaram da data sem retorno. É um retrato de agora e não existe para mês fechado. |
| Clientes ativos | Pessoas com contrato vigente no fim do mês (no mês em andamento, hoje). Quem está trancado conta à parte. |
| Entraram | Matrículas novas no mês. |
| Voltaram | Ex-clientes que se matricularam de novo depois de passada a tolerância. |
| Upgrades | Vendas fechadas pelo funil Upgrade. |
| Cancelaram | Cancelamentos no mês, com motivo de uma lista fixa: Financeiro, Mudou de cidade, Insatisfação, Saúde ou lesão, Foi para outra academia, Outro. |
| Venceram sem renovar | Contratos que venceram no mês sem renovação. No mês em andamento, parte deles ainda está na tolerância e pode ser recuperada. |
| Churn | Saídas definitivas (cancelamentos mais vencidos que passaram da tolerância) ÷ clientes ativos no início do mês. |
| Vencendo no mês | Contratos com fim dentro do mês. |
| Taxa de renovação | Renovados ÷ vencendo. No mês em andamento, renovados ÷ contratos que já tiveram desfecho, e "ainda vão vencer" aparece separado na barra. |
| Contatos nos marcos | Tarefas de renovação feitas ÷ clientes que chegaram a cada marco (90, 60 e 30 dias antes do fim; a academia pode mudar os marcos). |
| Não vão renovar | Clientes que declararam que não vão renovar, com motivo da mesma lista fixa do cancelamento. |

Regras que mudam o que aparece:

- A venda é de quem está no contrato, o mesmo nome que sai na comissão. A carteira (vencendo, a vencer, vencidos e taxa de renovação) é de quem cuida do cliente hoje.
- Contrato importado de planilha entra na base e na renovação, mas nunca conta como matrícula, retorno, cancelamento ou trancamento.
- "Atrasados agora", "A vencer" e "vencidos em aberto" só aparecem no mês em andamento.
- Esta tela não mostra valores em R$.

## O que fica fora

Não coloque agenda do dia, placar do dia, "progresso do dia" (novos → agendados → compareceram → matrículas), cartões por consultor com status "Parada" ou "Em dia", feed de atividade, "última ação", conversão, canais, motivos de perda de lead, números por professor nem valores em R$. A agenda e o placar já estão na Meta Diária, e o funil vai para o CRM. Se achar que falta algum número, pergunte antes de incluir.

## Sistema visual

Siga o visual que o app já tem. Antes de desenhar, leia:

- `src/index.css`: tokens de cor, fontes e sombras, mais as variáveis semânticas do shadcn.
- `CLAUDE.md` na raiz da pasta: regras de UI (shadcn/ui, tokens semânticos, `flex` com `gap`, `size-N`).
- `src/components/ui/`: componentes base do shadcn.
- `src/views/dashboard/DashPrimitives.jsx` e `src/views/dashboard/dashTokens.js`: cards, KPIs, dicas e cards de lista dos dashboards atuais.
- `src/components/charts/`: `Sparkline`, `AreaChart` e `Donut`.
- Telas de referência: `src/views/dashboard/DashboardGerencialView.jsx`, `src/views/DailyGoalView.jsx` e `src/views/DailyGoalTeamView.jsx` (o painel da equipe).

Valores que precisam bater:

- Space Grotesk nos títulos e nos números de destaque; Geist no texto.
- Azul da marca `#2B59FF`. O laranja `#FF6A2B` é a cor da prospecção, porque o app já usa azul para meta e laranja para prospecção.
- Fundo `#F5F7FB`, texto `#0E1A40`, cards brancos com borda `#E2E8F0`, raio de 16px e a sombra `shadow-card`.
- Sucesso `#15B981` e alerta `#F43F5E`.
- Tema escuro com fundo `#080D22` e cards `#122142`, usando os tokens do `src/index.css`.
- Interface em português do Brasil, texto direto, sem emoji e sem travessão no meio das frases.

## Gráficos

As cores abaixo já passaram por um validador de daltonismo e de contraste.

- Entrada na base em azul e saída em vermelho. Não ponha verde e vermelho lado a lado, porque o par reprova para daltonismo.
- Desfecho da renovação: renovou em verde, não vai renovar em âmbar, venceu sem renovar em vermelho e ainda vai vencer em cinza. Sempre com legenda e rótulo, nunca só a cor.
- No tema escuro, os status usam `#0E9F6E`, `#D97706` e `#E11D48`; o azul vira `#5A7FFF` e o laranja `#F2541A`.
- Escala de "quantos bateram a meta": `#8FB0FF`, `#5A7FFF`, `#2B59FF` e `#1C3FC4`. No escuro, de `#2B59FF` até `#C9D8FF`.
- Barras com até 24px de espessura e ponta arredondada de 4px, linhas de 2px, grade em fio fino e contínuo, rótulo só onde faz diferença. O texto fica sempre na cor de texto e a cor da série fica na marca.
- Dica ao passar o mouse e no foco do teclado em toda marca que tem valor.
- Algarismos tabulares nas colunas de números.
- A ponte da base não começa no zero, porque a base é grande e o movimento é pequeno. Escreva o número em cada nível e avise isso na legenda.

## Estados para desenhar

- Mês em andamento (setembro até o dia 11) com "Equipe toda", comparando com agosto.
- Mês fechado (julho) comparando com junho, sem "Atrasados agora" e sem "A vencer".
- Uma pessoa selecionada; a tabela da equipe some.
- Uma pessoa com a prospecção desligada.
- Vazios: mês sem cancelamento e mês sem ninguém que "não vai renovar".
- Carregando: ao trocar de mês, a tela mantém os números anteriores apagados até os novos chegarem, sem esqueleto.
- Desktop com 1440px de largura e celular com 390px, nos temas claro e escuro.

Números de exemplo, com nomes fictícios: três consultores (Ana Ribeiro, Diego Santos e Larissa Moura) e um gestor que também vende (Marcos Lima, com a prospecção desligada). Setembro até o dia 11: meta batida em 69% dos dias (22 de 32), prospecção em 79% do alvo, 419 clientes ativos (+2 no mês), churn de 0,5%, taxa de renovação de 82% e 21 contatos atrasados agora.

## O que preciso no handoff

O design vira código React neste repositório. No handoff, inclua:

- As telas e os estados listados acima.
- Cada componente novo com medidas, espaçamentos, tipografia e cores apontando para os tokens do `src/index.css`, sem valor solto quando existir token.
- Quais componentes do shadcn e do `DashPrimitives.jsx` foram reaproveitados e quais são novos.
- O comportamento do seletor de mês, da comparação, do filtro de pessoa, do clique na tabela da equipe, das dicas dos gráficos e da quebra para celular.
- Os textos finais de títulos, rótulos, dicas e estados vazios.
