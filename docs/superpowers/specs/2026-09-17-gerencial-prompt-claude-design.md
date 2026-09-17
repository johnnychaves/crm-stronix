---
status: rascunho
---

# Prompt para o Claude Design · Gerencial

> Cole tudo o que está abaixo da linha no claude.ai/design, depois de dar acesso à pasta do Stronilead (`06-sistemas/stronilead/`).

---

## O pedido

Desenhe a tela **Gerencial** do Stronilead, o CRM de academias da STRONIX. Quero o melhor design que você conseguir fazer para ela, sem se prender ao que já existe. Layout, hierarquia, tipos de gráfico, interações e linguagem visual ficam por sua conta. Se enxergar um jeito melhor de responder às perguntas da tela do que o que eu descrevo aqui, siga o seu caminho e explique a escolha no handoff.

A tela entra no lugar da página "Em breve" da aba Gerencial (`src/views/dashboard/DashboardComingSoonView.jsx`) e depois vira código React neste repositório.

## Para que serve

O Stronilead organiza o comercial de academias: leads, pipeline, Meta Diária, clientes, contratos e renovações. O grupo "Visão geral" do menu tem três painéis. O Operacional mede o trabalho do dia a dia e a saúde da base. O CRM mede o funil de leads, do primeiro contato até a matrícula. O Gerencial, esta tela, é a do dinheiro vendido, e é a última das três.

Ela precisa responder a três perguntas:

1. Quanto vendi no mês?
2. Quanto posso perder?
3. Quem traz receita?

Quem usa são os donos e gestores da academia, e a tela é a mesma para todos, inclusive para os consultores. Eles abrem para saber como o mês está indo, o que está prestes a vencer e quem está vendendo.

## O que é fixo

São decisões de produto já tomadas. O resto é seu.

- **Isto não é financeiro.** Todo número é valor de contrato vendido. O sistema não guarda pagamento, parcela, forma de pagamento nem inadimplência, e a tela precisa deixar isso claro para ninguém confundir com caixa.
- A tela mostra um mês de competência e compara com outro mês, mostrando o total com a diferença ao lado. No mês em andamento, a comparação é pró-rata: os mesmos dias do outro mês.
- O valor de uma venda é o total do contrato, já com desconto, sempre acompanhado do ticket mensal, que é esse total dividido pela duração do plano. Sem o ticket mensal não dá para comparar um plano anual com um mensal.
- Os números se organizam em quatro grupos: a venda do mês, a carteira hoje, o que está em risco e quem traz receita.
- A carteira é medida em valor por mês, que é a soma dos tickets mensais dos contratos vigentes.
- Uma venda conta no mês em que o contrato foi fechado, não no mês em que a vigência começa.
- Interface em português do Brasil, com texto direto, sem emoji e sem travessão no meio das frases.
- A tela funciona no computador e no celular, nos temas claro e escuro.
- Os números saem só dos dados listados abaixo. Se quiser um número que não esteja lá, proponha como sugestão e diga de onde ele viria, para eu conferir se o sistema tem o dado.

## Os dados disponíveis

Use o que servir melhor às três perguntas. Você decide o que vira destaque, o que fica em segundo plano e o que não aparece.

| Dado | Como calcula |
|---|---|
| Vendido no mês | Soma do valor fechado dos contratos criados no mês. |
| Ticket mensal | Valor do contrato dividido pela duração do plano em meses. Serve para o mês e para a média da base. |
| Desconto dado | Preço de tabela menos o valor fechado, em reais e em porcentagem. |
| Tipo de venda | Cada contrato entra em um tipo só: renovação, upgrade, matrícula nova ou retorno de ex-cliente. |
| Cancelado depois | Dos contratos vendidos no mês, quantos já foram cancelados e quanto valiam. A venda continua no total do mês, com essa marca. |
| Carteira hoje | Contratos vigentes, o valor por mês que eles geram e o ticket mensal médio. Trancado conta na carteira, com a contagem à parte. |
| Vence em 30, 60 e 90 dias | Quantos contratos e quanto valem por mês. É o que sai se ninguém renovar. |
| Já vencido sem renovação | Contratos que venceram e não tiveram sucessor. |
| Saídas do mês | Cancelamentos e trancamentos feitos no mês, com o valor por mês envolvido. |
| Quem vendeu | Por consultor: valor vendido, número de vendas e ticket. É o consultor dono do lead na hora da venda. |
| Por plano | Valor vendido e quantas vezes o plano foi vendido. Combinação de modalidades é um grupo próprio, não a soma das partes. |
| Por origem do lead | Valor vendido por canal de origem do lead que virou contrato. |

Todo número pode ser comparado com o mesmo número do mês escolhido e ter uma tendência dos últimos meses.

Três situações dos dados que o design precisa tratar:

- **Contratos importados sem valor.** Uma das academias trouxe 494 contratos de um sistema antigo sem o valor. Eles são clientes de verdade e 114 vencem nos próximos 90 dias, mas o valor deles é zero. Precisam aparecer na contagem de pessoas e de risco, nunca somados ao dinheiro, e com um jeito de dizer que aquele valor ainda vai ser preenchido.
- **Histórico curto.** Contratos só existem no sistema desde junho de 2026. Não há comparação com o ano passado, e a tendência tem poucos pontos.
- **Contratos sobrepostos.** Algumas pessoas têm dois contratos vigentes ao mesmo tempo. A carteira soma contrato e não pessoa, e a tela precisa dizer isso em vez de esconder.

## Referências

Servem para inspirar e para você entender o produto. Nada aqui é regra.

- As duas telas irmãs, já prontas: `src/views/dashboard/DashboardOperacionalView.jsx` e `src/views/dashboard/CrmDashboard.jsx`, com os handoffs em `docs/superpowers/specs/handoff-operacional/` e `docs/superpowers/specs/handoff-crm/`. As três telas vivem no mesmo menu e no mesmo cabeçalho, então o Gerencial precisa parecer irmão delas. Aproveite o que fizer sentido e mude o que achar melhor.
- A identidade atual do app: `src/index.css` (cores, fontes e sombras), `CLAUDE.md` (regras de UI) e `src/components/ui/` (componentes do shadcn). Hoje o app usa Space Grotesk nos títulos e números, Geist no texto e o azul `#2B59FF` da marca. No CRM, matrícula e conversão aparecem em verde, e a barra do gráfico sempre mostra o mesmo número que está escrito ao lado.
- Cuidados de acessibilidade: informação nunca só pela cor, contraste bom nos dois temas e dica também pelo teclado nos gráficos.

## O que o design precisa cobrir

- Mês em andamento (setembro até o dia 17), comparando com agosto.
- Um mês fechado.
- A academia com os 494 contratos importados sem valor, mostrando como a tela conta gente sem contar dinheiro.
- Estados vazios: academia sem nenhum contrato e mês sem venda.
- Computador (1440px) e celular (390px), nos temas claro e escuro.

Números de exemplo, na escala real da academia, com nomes fictícios. Setembro até o dia 17:

- Vendido no mês: R$ 78.400 em 42 contratos, contra R$ 71.900 nos mesmos dias de agosto. Ticket mensal médio de R$ 214 e desconto médio de 8%.
- Tipos: 21 matrículas novas, 14 renovações, 5 upgrades e 2 retornos. Dos vendidos, 2 já foram cancelados, somando R$ 3.100.
- Carteira hoje: 628 contratos vigentes, R$ 134.200 por mês, ticket mensal médio de R$ 214, com 19 trancados que valem R$ 4.100 por mês. 6 pessoas com dois contratos vigentes.
- Risco: vencem em 30 dias 63 contratos (R$ 13.100 por mês), em 60 dias 48 (R$ 9.800) e em 90 dias 57 (R$ 11.400). Já vencidos sem renovação: 29 contratos. Saídas do mês: 7 cancelamentos (R$ 1.480 por mês) e 4 trancamentos (R$ 820). Além disso, 114 contratos importados vencem em 90 dias e estão sem valor.
- Quem vendeu: Ana Ribeiro R$ 31.200 em 16 vendas, Diego Santos R$ 24.800 em 13, Larissa Moura R$ 16.400 em 9 e o gestor Marcos Lima R$ 6.000 em 4.
- Planos mais vendidos: Anual Musculação, Semestral Musculação, Musculação + Pilates (combinação), Trimestral Musculação e Mensal.
- Origem dos leads que fecharam: Instagram R$ 29.600, Indicação R$ 21.300, Passante R$ 15.900, Site R$ 8.100 e Outros R$ 3.500.

## O que preciso no handoff

O design vira código React neste repositório. No handoff, inclua:

- As telas e os estados acima.
- As escolhas de design que você fez e o porquê, em poucas linhas.
- Cada componente com medidas, espaçamentos, tipografia e cores, apontando para os tokens do `src/index.css` quando existirem. Se criar cor ou fonte nova, diga qual e onde usa.
- Quais componentes do app você reaproveitou e quais são novos.
- O comportamento da comparação, dos gráficos e da quebra para celular.
- Os textos finais de títulos, rótulos, dicas e estados vazios, incluindo o aviso de que a tela não é caixa.
- Os números novos que você sugerir, se houver, com a indicação de onde viriam.
