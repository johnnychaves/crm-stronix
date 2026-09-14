---
status: rascunho
---

# Prompt para o Claude Design · CRM

> Cole tudo o que está abaixo da linha no claude.ai/design, depois de dar acesso à pasta do Stronilead (`06-sistemas/stronilead/`).

---

## O pedido

Desenhe a tela **CRM** do Stronilead, o CRM de academias da STRONIX. Quero o melhor design que você conseguir fazer para ela, sem se prender ao que já existe. Layout, hierarquia, tipos de gráfico, interações e linguagem visual ficam por sua conta. Se enxergar um jeito melhor de responder às perguntas da tela do que o que eu descrevo aqui, siga o seu caminho e explique a escolha no handoff.

A tela entra no lugar da página "Em breve" da aba CRM (`src/views/dashboard/DashboardComingSoonView.jsx`) e depois vira código React neste repositório.

## Para que serve

O Stronilead organiza o comercial de academias: leads, pipeline, Meta Diária, clientes, contratos e renovações. O grupo "Visão geral" do menu tem três painéis. O Operacional, já pronto, mede o trabalho do dia a dia e a saúde da base de clientes. O CRM, esta tela, mede o funil de leads, do primeiro contato até a matrícula. O Gerencial ainda vai ganhar um papel.

O CRM precisa responder a quatro perguntas:

1. De onde vêm os leads?
2. Onde eles se perdem?
3. Quem converte?
4. Com que velocidade o lead é atendido e fecha?

Quem usa são os gestores e os consultores de vendas da academia, e a tela é a mesma para todos. Eles abrem para entender como foi o mês, comparar com outros meses e descobrir onde agir.

## O que é fixo

São decisões de produto já tomadas. O resto é seu.

- A tela mostra um mês de competência e compara com outro mês. No mês em andamento, a comparação é pró-rata: os mesmos dias do outro mês.
- Dá para filtrar por pessoa ("Equipe toda" ou qualquer usuário, e todo mundo vê todo mundo) e por funil ("Todos os funis" ou um funil de lead da academia).
- Os números saem só dos dados listados abaixo. Se quiser um número que não esteja lá, proponha como sugestão e diga de onde ele viria, para eu conferir se o sistema tem o dado.
- Meta diária, prospecção, tarefas, base de clientes e renovação já estão no Operacional e não entram aqui. Valores em R$ também ficam fora.
- Interface em português do Brasil, com texto direto, sem emoji e sem travessão no meio das frases.
- A tela funciona no computador e no celular, nos temas claro e escuro.

## Os dados disponíveis

Use o que servir melhor às quatro perguntas. Você decide o que vira destaque, o que fica em segundo plano e o que não aparece.

| Dado | Como calcula |
|---|---|
| Leads novos | Leads cadastrados no mês, por canal de origem, por indicação, por funil e por dono. |
| Agendamentos | Visitas e aulas experimentais marcadas para o mês, sem as canceladas. |
| Comparecimento | Quem veio ÷ (quem veio + quem faltou), entre os agendamentos com data já passada. Agendamento sem desfecho é contado à parte. |
| Matrículas | Leads que viraram cliente no mês. |
| Conversão dos leads do mês | Dos leads novos do mês, quantos já matricularam. No mês em andamento ela ainda sobe, então vale mostrar quantos seguem em jogo. |
| Funil por marcos | Sobre os leads novos do mês: quantos agendaram, compareceram, matricularam, foram perdidos e seguem em jogo. |
| Passagem entre etapas | Com um funil escolhido: por etapa, quantos entraram, quantos avançaram, quantos foram perdidos a partir dela e o tempo mediano na etapa. |
| Perdas | Leads perdidos no mês, por motivo e pela etapa em que se perderam. |
| Conversão por pessoa | Por dono do lead: leads novos, agendamentos, comparecimento, matrículas, conversão e tempo até o primeiro contato. |
| Professores | Aulas experimentais do mês por professor: realizadas, faltas, matrículas e conversão (matrículas ÷ realizadas), com a divisão por modalidade. "Treina sozinho" é um grupo à parte. |
| Tempo até o primeiro contato | Tempo corrido do cadastro até a primeira interação feita por alguém da equipe. Dá para ter a mediana e a distribuição (até 1 hora, até 24 horas, mais de 24 horas, sem contato). |
| Dias até a matrícula | Entre as matrículas do mês, os dias entre o cadastro e a matrícula. |
| Carteira agora | Só no mês em andamento: leads em jogo por etapa e os que estão sem próximo contato marcado. Esses últimos não aparecem na Meta Diária de ninguém. |

Todo número pode ser comparado com o mesmo número do mês escolhido para comparação e ter uma tendência dos últimos seis meses.

Três situações dos dados que o design precisa tratar:

- A passagem entre etapas e a etapa da perda só existem a partir de setembro de 2026, quando a troca de etapa passou a ser gravada. Antes disso não há base para esses números.
- Os agendamentos anteriores a agosto de 2026 estão incompletos no histórico.
- Com uma pessoa escolhida, os números de professores continuam sendo da academia inteira.

## Referências

Servem para inspirar e para você entender o produto. Nada aqui é regra.

- O Operacional novo, tela irmã do CRM: `src/views/dashboard/DashboardOperacionalView.jsx` e o handoff dele em `docs/superpowers/specs/handoff-operacional/` (README e `Operacional.dc.html`). Aproveite o que fizer sentido e mude o que achar melhor.
- A identidade atual do app: `src/index.css` (cores, fontes e sombras), `CLAUDE.md` (regras de UI) e `src/components/ui/` (componentes do shadcn). Hoje o app usa Space Grotesk nos títulos e números, Geist no texto e o azul `#2B59FF` da marca. Isso é o ponto de partida. Se propuser uma evolução, mostre como ela conversa com o resto do app, porque a tela vive dentro do mesmo menu e do mesmo cabeçalho.
- Cuidados de acessibilidade: informação nunca só pela cor, contraste bom nos dois temas e dica também pelo teclado nos gráficos.

## O que o design precisa cobrir

- Mês em andamento (setembro até o dia 14), com "Equipe toda" e "Todos os funis", comparando com agosto.
- Um funil escolhido, com a passagem entre etapas.
- Um mês fechado, sem a carteira de agora e com os números que ainda não têm base.
- Uma pessoa escolhida.
- Estados vazios (por exemplo, mês sem perdas) e o carregamento ao trocar de mês.
- Computador (1440px) e celular (390px), nos temas claro e escuro.

Números de exemplo, na escala real da academia, com nomes fictícios. Setembro até o dia 14:

- 56 leads novos, 19 agendamentos, 71% de comparecimento, 29 matrículas e conversão dos leads do mês de 18%, com 40 ainda em jogo.
- Canais: Instagram 22, Passante 13, Indicação 9, Site 7 e Outros 5.
- Consultores: Ana Ribeiro, Diego Santos e Larissa Moura, mais o gestor Marcos Lima.
- Professores: Paula Nunes, Rafael Costa e Bianca Alves, mais "Treina sozinho".
- Primeiro contato em 2 h 10 min de mediana, com 38% até 1 hora. Dias até a matrícula: 6 de mediana.

## O que preciso no handoff

O design vira código React neste repositório. No handoff, inclua:

- As telas e os estados acima.
- As escolhas de design que você fez e o porquê, em poucas linhas.
- Cada componente com medidas, espaçamentos, tipografia e cores, apontando para os tokens do `src/index.css` quando existirem. Se criar cor ou fonte nova, diga qual e onde usa.
- Quais componentes do app você reaproveitou e quais são novos.
- O comportamento dos filtros, da comparação, dos gráficos e da quebra para celular.
- Os textos finais de títulos, rótulos, dicas e estados vazios.
- Os números novos que você sugerir, se houver, com a indicação de onde viriam.
