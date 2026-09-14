---
status: rascunho
---

# Prompt para o Claude Design · CRM

> Cole tudo o que está abaixo da linha no claude.ai/design, depois de dar acesso à pasta do Stronilead (`06-sistemas/stronilead/`). A tela do CRM é irmã do Operacional novo, e o handoff dele está em `docs/superpowers/specs/handoff-operacional/`.

---

## O pedido

Desenhe a nova tela **CRM** do Stronilead, o CRM de academias da STRONIX. Ela substitui a página "Em breve" da aba CRM (`src/views/dashboard/DashboardComingSoonView.jsx`). Quero alta fidelidade, fiel ao visual que o app já tem e ao Operacional novo, pronta para virar código React neste mesmo repositório.

## Contexto

O Stronilead organiza o comercial de academias: leads, pipeline, Meta Diária, clientes, contratos e renovações. O grupo "Visão geral" do menu tem três painéis:

- Operacional, já pronto: o trabalho do dia a dia e a saúde da base de clientes. É a referência visual desta tela: `src/views/dashboard/DashboardOperacionalView.jsx` e o handoff em `docs/superpowers/specs/handoff-operacional/` (README e `Operacional.dc.html`).
- CRM, esta tela: o resultado do funil de leads, do lead até a matrícula.
- Gerencial, com a página "Em breve" e papel ainda a definir.

Para decidir onde cada número fica: o Operacional mede o trabalho feito e a saúde da base, e o CRM mede o funil. A matrícula aparece nos dois com o mesmo número.

Quem usa são os gestores e os consultores de vendas da academia. A tela é a mesma para todos os perfis.

## Como a tela funciona

A barra de controles do topo é a mesma do Operacional, fixa ao rolar, e vale para a tela inteira.

1. Mês de competência: seletor com setas (‹ Setembro 2026 ›). Cada número pertence ao mês em que o fato aconteceu.
2. Comparar com: por padrão, o mês anterior. Dá para escolher qualquer mês passado. No mês em andamento a comparação é pró-rata, com um aviso de texto na própria barra, como no Operacional.
3. Pessoa: "Equipe toda" ou qualquer usuário. Todo mundo vê todo mundo.
4. Funil, que é novo: "Todos os funis" ou um dos funis de lead da academia (por exemplo Digital, Passantes e Indicações). Os funis de cliente (Renovações, Vencidos e Upgrade) não aparecem aqui.

## Estrutura

Siga a ordem abaixo. A execução visual é sua, mas mantenha o parentesco com o Operacional.

1. Três destaques do mês: frases com as maiores mudanças contra o mês comparado, como no Operacional, sem repetir a faixa. Exemplo: "Conversão do Instagram: de 12% para 19%", com o selo "▲ 7 p.p. · melhorou".
2. Faixa de resumo com cinco números: leads novos, agendamentos, comparecimento, matrículas e conversão dos leads do mês. Cada um traz a diferença contra o mês comparado e a tendência de seis meses, com o mês em andamento marcado como parcial.
3. Funil: onde o lead se perde?
   - Funil por marcos dos leads novos do mês: leads, agendaram, compareceram e matricularam, com os perdidos e os que seguem em jogo. Mostre a taxa de passagem de um marco para o outro.
   - Passagem entre etapas, só com um funil escolhido: para cada etapa do funil, quantos entraram, quantos avançaram, quantos foram perdidos a partir dela e o tempo mediano na etapa. Antes de existir histórico, mostre o estado "sem base" com uma frase curta: "A troca de etapa passou a ser gravada em setembro de 2026."
4. Origem: de onde vêm os leads?
   - Canais, em ranking, com os leads e a conversão de cada um.
   - Indicação: leads indicados no mês e quantos viraram matrícula.
5. Quem converte?
   - Equipe no mês, só com "Equipe toda": uma linha por pessoa com leads novos, agendamentos, comparecimento, matrículas, conversão e tempo até o primeiro contato. Clicar na linha filtra a tela por aquela pessoa, como no Operacional.
   - Professores: aulas experimentais realizadas, faltas, matrículas e conversão por professor, com a divisão por modalidade. "Treina sozinho" aparece como uma linha própria.
6. Perdas.
   - Motivos de perda do mês.
   - Etapa em que o lead foi perdido, com o mesmo estado "sem base" antes do histórico.
7. Velocidade.
   - Tempo até o primeiro contato: a mediana e as faixas "até 1 hora", "até 24 horas", "mais de 24 horas" e "sem contato".
   - Dias do cadastro até a matrícula: a mediana.
8. Agora, só no mês em andamento.
   - Leads em jogo por etapa.
   - Leads sem próximo contato marcado. Explique na dica que eles não aparecem na Meta Diária de ninguém.

   No mês fechado, este bloco vira o cartão tracejado, como os retratos do Operacional.

## Definições

Use estes nomes e estas contas nos rótulos e nas dicas.

| Métrica | Como calcula |
|---|---|
| Leads novos | Leads cadastrados no mês. |
| Agendamentos | Visitas e aulas experimentais marcadas para o mês, sem as canceladas. |
| Comparecimento | Quem veio ÷ (quem veio + quem faltou), entre os agendamentos com data já passada. Agendamento sem desfecho aparece à parte, como "sem desfecho". |
| Matrículas | Leads que viraram cliente no mês. |
| Conversão dos leads do mês | Dos leads novos do mês, quantos já matricularam. No mês em andamento ela ainda sobe, então mostre ao lado quantos seguem em jogo. |
| Funil por marcos | Sobre os leads novos do mês: agendaram, compareceram, matricularam, perdidos e em jogo. |
| Passagem entre etapas | Por etapa do funil escolhido: entraram no mês, avançaram para uma etapa à frente ou matricularam, foram perdidos a partir dela e o tempo mediano até sair dela. |
| Canais | A origem do lead, com os leads novos e a conversão de cada uma. |
| Indicação | Leads novos vindos de indicação e as matrículas deles. |
| Professores | Aulas experimentais do mês por professor: realizadas, faltas, matrículas (a última aula a que o lead compareceu antes de matricular) e conversão (matrículas ÷ realizadas). |
| Motivos de perda | Leads perdidos no mês, por motivo. |
| Tempo até o primeiro contato | Tempo corrido do cadastro até a primeira interação feita por alguém da equipe. |
| Dias até a matrícula | Entre as matrículas do mês, a mediana dos dias entre o cadastro e a matrícula. |

Regras que mudam o que aparece:

- A carteira de uma pessoa são os leads de que ela é dona. O card de professores continua mostrando a academia inteira mesmo com uma pessoa escolhida.
- Lead importado de planilha não conta como lead novo nem como matrícula.
- Nos meses anteriores a agosto de 2026, agendamentos e comparecimento aparecem marcados como parciais, porque o histórico de agendamentos estava incompleto.
- Esta tela não mostra valores em R$.

## O que fica fora

Não coloque meta diária, prospecção, tarefas, base de clientes, renovação, cancelamento de contrato, valores em R$, os funis de cliente nem o passe livre das aulas experimentais. Meta, base e renovação já estão no Operacional, e o passe livre vai ganhar um projeto próprio. Se achar que falta algum número, pergunte antes de incluir.

## Sistema visual

Siga o visual do Operacional novo. Antes de desenhar, leia:

- `docs/superpowers/specs/handoff-operacional/README.md` e `Operacional.dc.html`: medidas, componentes e comportamento da tela irmã.
- `src/views/dashboard/`: `OperacionalToolbar.jsx`, `DashSummaryBand.jsx`, `DashHighlights.jsx`, `ChartMark.jsx`, `TeamMonthTable.jsx` e os cartões da `DashboardOperacionalView.jsx`. Reaproveite o que der e diga no handoff o que é novo.
- `src/index.css`: tokens de cor, fontes e sombras, mais as variáveis semânticas do shadcn.
- `CLAUDE.md` na raiz da pasta: regras de UI (shadcn/ui, tokens semânticos, `flex` com `gap`, `size-N`).
- `src/components/ui/`: componentes base do shadcn.

Valores que precisam bater:

- Space Grotesk nos títulos e nos números de destaque; Geist no texto.
- Azul da marca `#2B59FF`. O laranja `#FF6A2B` é a cor da prospecção no app, então evite usá-lo nesta tela.
- Fundo `#F5F7FB`, texto `#0E1A40`, cards brancos com borda `#E2E8F0`, raio de 16px e a sombra `shadow-card`.
- Sucesso `#15B981` e alerta `#F43F5E`.
- Tema escuro com fundo `#080D22` e cards `#122142`, usando os tokens do `src/index.css`.
- Interface em português do Brasil, texto direto, sem emoji e sem travessão no meio das frases.

## Gráficos

As regras abaixo são as mesmas que o Operacional seguiu e já passaram por validador de daltonismo e de contraste.

- No desfecho do funil, matricularam em azul, perdidos em vermelho e em jogo em cinza. Não ponha verde e vermelho lado a lado, porque o par reprova para daltonismo.
- Canais, motivos de perda e modalidades usam a mesma cápsula segmentada com legenda em ranking dos cartões de motivos do Operacional.
- As faixas do primeiro contato vão de "até 1 hora" a "mais de 24 horas" numa escala de um tom só, e "sem contato" fica em cinza.
- Barras com até 24px de espessura e ponta arredondada de 4px, linhas de 2px, grade em fio fino e contínuo, rótulo só onde faz diferença.
- Dica ao passar o mouse e no foco do teclado em toda marca que tem valor.
- Algarismos tabulares nas colunas de números.

## Estados para desenhar

- Mês em andamento (setembro até o dia 14) com "Equipe toda" e "Todos os funis", comparando com agosto.
- Um funil escolhido (Digital), com a passagem entre etapas preenchida.
- Mês fechado (julho) comparando com junho: sem o bloco Agora, com a passagem entre etapas e a etapa da perda em "sem base" e com agendamentos e comparecimento marcados como parciais.
- Uma pessoa selecionada: a tabela da equipe some e o card de professores continua com a academia inteira.
- Vazios: mês sem perdas e funil sem nenhuma indicação.
- Carregando: ao trocar de mês, a tela mantém os números anteriores apagados até os novos chegarem, sem esqueleto.
- Desktop com 1440px de largura e celular com 390px, nos temas claro e escuro.

Números de exemplo, com nomes fictícios, na escala real da academia. Setembro até o dia 14:

- 56 leads novos, 19 agendamentos, 71% de comparecimento, 29 matrículas e conversão dos leads do mês de 18%, com 40 ainda em jogo.
- Canais: Instagram 22, Passante 13, Indicação 9, Site 7 e Outros 5.
- Consultores: Ana Ribeiro, Diego Santos e Larissa Moura, mais o gestor Marcos Lima, que também vende.
- Professores: Paula Nunes, Rafael Costa e Bianca Alves, mais "Treina sozinho".
- Primeiro contato em 2 h 10 min de mediana, com 38% até 1 hora. Dias até a matrícula: 6 de mediana.

## O que preciso no handoff

O design vira código React neste repositório. No handoff, inclua:

- As telas e os estados listados acima.
- Cada componente novo com medidas, espaçamentos, tipografia e cores apontando para os tokens do `src/index.css`, sem valor solto quando existir token.
- Quais componentes do Operacional e do shadcn foram reaproveitados e quais são novos.
- O comportamento do seletor de funil, do filtro de pessoa, do clique na tabela da equipe, das dicas dos gráficos e da quebra para celular.
- Os textos finais de títulos, rótulos, dicas e estados vazios, inclusive o de "sem base".
