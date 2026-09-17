# Dashboard Gerencial (Visão geral → Gerencial)

status: revisão
data: 2026-09-17

## Por que esta tela existe

O Operacional mostra o trabalho e a base de clientes. O CRM mostra o funil de leads, do cadastro à matrícula. Falta a tela do dinheiro: quanto a academia vendeu no mês, quanto a carteira vale por mês, quanto está prestes a sair e quem traz receita. Hoje a aba Gerencial diz "Em breve".

## O que esta tela não é

Não é financeiro nem caixa. O CRM não guarda pagamento, parcela, forma de pagamento nem inadimplência, e nada disso vai passar a existir por causa desta tela. Todo número aqui é valor de contrato vendido. Quem confere o que caiu na conta continua sendo o financeiro, fora do CRM.

## As três perguntas que a tela responde

1. Quanto vendi no mês.
2. Quanto posso perder.
3. Quem traz receita.

## Decisões

1. **Quem vê.** Todos veem tudo. Sem recorte por permissão, igual ao Operacional mensal.
2. **Período.** Mês de competência, com o mesmo seletor das outras telas.
3. **Comparativo.** Contra o mês anterior no mesmo dia do mês, mostrando o total com a diferença ao lado.
4. **Valor da venda.** O total do contrato, já com desconto, com o ticket mensal ao lado.
5. **Organização.** Quatro grupos de cartões: venda do mês, carteira hoje, o que está em risco, quem traz receita.
6. **Carteira.** Medida em valor por mês, que é a soma dos tickets mensais dos contratos vigentes.
7. **Planos.** Combinação de modalidades é um grupo próprio no ranking, não a soma das partes.
8. **Layout.** Molde das outras telas do dashboard, sem inventar estrutura nova.
9. **Data da venda.** Conta no mês do fechamento do contrato (`createdAt`, com `startsAt` de reserva), igual ao Operacional e à comissão. Renovação assinada antes conta no mês do esforço.
10. **Cancelado no mesmo mês.** Continua no total do mês, com a marca de quanto foi cancelado depois. O número de um mês fechado não muda quando alguém cancela hoje.
11. **Trancado.** Fica dentro da carteira, porque volta. O cartão diz quantos estão parados.
12. **Campo de valor do plano.** Ganha rótulo claro de valor total do plano, e a Shape One é corrigida antes da tela entrar no ar.
13. **Importados sem valor.** Aparecem à parte, nunca somados ao dinheiro, e o valor é preenchido depois por planilha.

## Os quatro grupos e a regra de cada número

### Grupo 1: quanto vendi no mês

- **Vendido no mês.** Soma do valor fechado dos contratos criados dentro do mês. Contrato importado não entra.
- **Ticket mensal.** Valor do contrato dividido pela duração do plano em meses. É o que permite comparar anual com mensal.
- **Desconto dado.** Tabela (`listValue`) menos o fechado (`value`), em reais e em porcentagem do total.
- **Quebra por tipo, sem contar ninguém duas vezes,** nesta ordem: tem contrato anterior ligado (`renewedFromId`) é renovação; fechou dentro do funil Upgrade (`closedFromUpgrade`) é upgrade; é o primeiro contrato da pessoa é matrícula nova; o que sobrar é retorno de ex-cliente.
- **Cancelado depois.** Linha própria dentro do grupo, dizendo quantos contratos vendidos no mês já foram cancelados e quanto valiam.

### Grupo 2: a carteira hoje

- **Clientes com contrato vigente** e o **valor por mês** que a carteira gera, que é a soma dos tickets mensais.
- **Ticket mensal médio da base**, que é esse valor dividido pelo número de contratos vigentes.
- **Trancados**, com quantos são e quanto valem por mês, dentro do total e visíveis como linha.
- A carteira soma contrato, não pessoa. Quem tem dois contratos vigentes conta duas vezes, e a tela avisa quantas pessoas estão nessa situação.

### Grupo 3: quanto posso perder

- **Vence em 30, 60 e 90 dias.** Quantos contratos e quanto valem por mês. É o que sai da carteira se ninguém renovar.
- **Já vencido sem renovação.** O buraco que já aconteceu.
- **Saídas do mês.** Cancelamentos e trancamentos feitos no mês, com o valor por mês envolvido. Trancamento aparece como parada, não como perda, porque continua dentro da carteira.
- **Importados sem valor.** Linha separada com a contagem, porque 114 deles vencem dentro de 90 dias. Contam como risco de vencimento e nunca como dinheiro.

### Grupo 4: quem traz receita

- **Por pessoa.** Valor vendido, número de vendas e ticket. O vendedor é o consultor dono do lead no momento da venda (`consultantId`), o mesmo nome que a comissão usa.
- **Por plano.** Valor vendido e quantas vezes foi vendido. Combinação de modalidades é um grupo próprio.
- **Por origem do lead.** Liga o que o marketing traz ao que fatura. É o único número que custa leitura, porque a origem mora no lead e não no contrato.

## A realidade dos dados hoje

Levantada em auditoria somente de leitura em 16/09/2026, sobre as academias em produção.

- Só duas academias têm contrato: STRONIX (147 do sistema e 494 importados) e Shape One (153).
- A Shape One grava **preço mensal** nos planos de vários meses. A STRONIX grava o **total**. Sem corrigir, o ticket e o valor por mês da Shape One saem errados.
- Os 494 contratos importados da STRONIX estão com `value` igual a zero, sem plano e sem tabela. Desses, 114 vencem dentro de 90 dias.
- Nenhum contrato abaixo de R$ 10. O bug do ponto de milhar (PR #213) não deixou valor estragado na base.
- 4 e 6 pessoas com contratos sobrepostos nas duas academias.
- Contrato só existe no sistema desde junho e julho de 2026.

## As três entregas

**Entrega 1: os dados de valor.** Rótulo claro no campo de valor do plano, dizendo que é o total do plano e não a mensalidade. Correção dos planos da Shape One. Planilha para preencher o valor dos 494 contratos importados da STRONIX. Sem isso, a tela mostra número errado com cara de certo.

**Entrega 2: o prompt para o Claude Design.** Mesmo caminho do Operacional e do CRM. O Johnny aprova o visual lá e traz o handoff.

**Entrega 3: a tela.** Módulos puros e testados em `src/lib/gerencial/`, mais a tela no lugar do "Em breve", portando o handoff fielmente.

## Carga e custo

A coleção de contratos inteira já fica assinada desde o login (`src/App.jsx`), e a de planos também. Os quatro grupos saem do que já está na memória, sem consulta nova e sem índice para publicar. A única leitura extra é a origem do lead das vendas do mês, cerca de 50 documentos por mês aberto, quase sempre já em cache da sessão.

## Testes

Contas em módulos puros, no molde de `src/lib/crm/` e `src/lib/operacional/`, com uma função de entrada que devolve o mês inteiro. Casos obrigatórios:

- Venda contada pelo fechamento, não pela vigência.
- Renovação assinada em um mês para valer no outro.
- Contrato cancelado no mesmo mês entra no total com a marca.
- Cada contrato aparece em um tipo só.
- Ticket mensal de plano anual e de plano mensal.
- Trancado dentro da carteira, com a contagem à parte.
- Vencimentos em 30, 60 e 90 dias.
- Importado com valor zero fora do dinheiro e dentro da contagem de risco.
- Plano com preço mensal e plano com preço total dando o mesmo ticket depois da correção.

## Limites declarados na própria tela

- Valor de contrato vendido, não dinheiro recebido.
- Sem histórico antes de junho de 2026.
- Importados sem valor contam como pessoas e como risco, nunca como receita.
- A carteira soma contrato, não pessoa.

## Fora do escopo

Pagamento, parcela, forma de pagamento, inadimplência, comissão calculada, previsão de receita e meta de faturamento. Nada disso entra nesta entrega.
