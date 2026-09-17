# Handoff — tela Gerencial (Visão geral)

Substitui a página "Em breve" da aba Gerencial
(`src/views/dashboard/DashboardComingSoonView.jsx`).

O mockup é **especificação visual e de comportamento**, não código para colar. Abra
`Gerencial.dc.html` e mexa: as setas e a lista trocam o mês, a caixa Comparar liga e
desliga todo o comparativo, e o seletor de academia percorre os três estados de base.
Os estados que o brief pede são todos alcançáveis pelos controles:

| Estado | Como chegar |
| --- | --- |
| Mês em andamento contra agosto | padrão (Setembro 2026, Unidade Centro) |
| Mês fechado | escolha Agosto 2026 ou Julho 2026 |
| Base com 494 importados sem valor | seletor de academia → Unidade Moinhos |
| Mês sem venda, carteira cheia | escolha Maio 2026 |
| Academia sem contrato nenhum | seletor de academia → Unidade Nova |
| Celular 390 e tema escuro | bloco ao pé da página, e o botão de tema no topo |

---

# 1. As escolhas de design, e por quê

## Duas moedas, nunca somadas

O maior risco desta tela não é gráfico, é **unidade**. "Vendido" é o valor de um
contrato inteiro, que acontece uma vez. "Carteira" e "risco" são valor por mês. São
grandezas diferentes e alguém vai tentar somar R$ 78.400 com R$ 134.200.

Três defesas, todas estruturais:

- **O sufixo `/mês` nunca se separa do número.** Onde o valor é mensal, o `/mês` é
  um `&lt;span&gt;` irmão do número, no mesmo baseline, em 13-14px. Nunca some, nunca vai
  para a linha de apoio.
- **Os dois grupos moram em blocos distintos**, cada um com título e pergunta
  próprios, separados por régua de 2px. Nenhuma faixa mistura as duas unidades.
- **O bloco de venda usa valor absoluto; carteira e risco usam valor por mês.** O
  único número que atravessa os dois é o ticket mensal, e ele é mensal por definição.

## O aviso de "não é caixa" fica na barra fixa

"Valor de contrato vendido, não caixa recebido" é um chip âmbar na **barra fixa de
controles**, que acompanha a rolagem. Nota de pé de página é onde avisos vão morrer:
o número grande desta tela é dinheiro, e quem olha precisa ler a ressalva no mesmo
movimento do olho. O chip é `--amber-t` com texto `--amber-700`, 30px de altura,
sem botão de fechar.

## Contratos sem valor viram trilha tracejada

Os 494 importados não podem entrar na soma nem desaparecer da tela. Solução:

- Cada barra de risco ganha uma **trilha hachurada anexa** (borda tracejada 1.5px
  `--slate` + `repeating-linear-gradient` a 135°), rotulada só com a contagem:
  "+41 sem valor". Ela não compartilha o eixo de dinheiro da barra sólida.
- Um cartão tracejado ao lado do total: "114 pessoas sem valor · vencem no período e
  não entram na conta acima".
- Na carteira, a contagem de contratos sobe para 1.122 e o valor por mês **não se
  move** (R$ 134.200), com uma nota tracejada explicando que preencher o valor em
  Contratos corrige a carteira.

A forma carrega a informação, não a cor: é gente que vence, e o dinheiro ainda vai
ser preenchido. **Onde não há contrato sem valor, o item de legenda desaparece** —
explicar um símbolo ausente seria o oposto do argumento.

## Ticket é a coluna que revela

No ranking de consultores o total premia quem atende mais. Por isso a tabela tem
**duas colunas de ticket**: por venda (valor ÷ nº de vendas) e mensal (valor ÷ nº de
vendas ÷ duração média do plano). É o que mostra quem vende melhor: Marcos fecha 4
contratos a R$ 125/mês contra R$ 232/mês da Ana. A barra ordena por total, e a
leitura no rodapé aponta a diferença em texto, para não depender da leitura da coluna.

## A venda vem antes de tudo, o risco é o segundo mais alto

A ordem é a das três perguntas: vendi → tenho → posso perder → quem trouxe. Mas
"quanto posso perder" recebe o segundo tratamento mais forte da tela (número de 32px
em âmbar, esteira de barras), porque é a única das quatro que **gera ação hoje**.
Carteira fica numa faixa de células baixas: é contexto, não alarme.

## O que eu deixei de fora do que você descreveu

O brief permite reorganizar. Duas escolhas conscientes:

- **Não fiz cartões separados para 30, 60 e 90 dias.** Três cartões iguais lado a
  lado esconderiam o que importa, que é o acumulado e a proporção sobre a carteira.
  Virou uma esteira de três barras num painel só, com o total de 90 dias no topo.
- **Não pus tendência de seis meses em toda métrica.** Contratos existem desde
  junho de 2026: uma linha de três pontos finge série histórica. Onde a comparação
  não existe, a tela diz isso (ver §5).

---

# 2. Componentes: o que reusar e o que é novo

## Reusar como está

| Componente | Onde | Observação |
| --- | --- | --- |
| `DashCard` (DashPrimitives) | as ~8 cascas de card | `rounded-2xl border-border bg-card shadow-card` |
| `BreakdownCard` (DashPrimitives) | "Planos mais vendidos" e "Origem do lead que fechou" | Cobre inteiro: ícone `accent-50`, herói do líder, cápsula segmentada de 42px na `BREAKDOWN_PALETTE`, legenda ranqueada e rodapé. O mockup já foi desenhado nesse formato — **não reimplemente**. A única adição é a coluna de contagem (`11x`) entre o rótulo e o valor. |
| `DashHelpTip` (DashPrimitives) | o "?" de cada métrica | `HelpCircle` 12px em `size-4`, `aria-label` no padrão `O que é "X"?` |
| `DASH_TONES`, `BREAKDOWN_PALETTE`, `dashInitials` (dashTokens) | tons e monogramas | |
| `OperacionalToolbar` (do handoff Operacional) | a barra fixa | Mesmo componente: mês com setas + lista, caixa Comparar + mês comparado. Precisa de dois slots novos: o seletor de academia e o chip de aviso. Vale generalizar para `DashToolbar`. |
| `Select` (`components/ui/select.jsx`) | os 3 seletores | O mockup usa `&lt;select&gt;` nativo porque é HTML puro |
| `Tooltip` (`components/ui/tooltip.jsx`) | **toda marca de gráfico** | Ver §4 |
| `Checkbox`, `Separator` (components/ui) | caixa Comparar, réguas verticais | |

## Componentes novos

Em `src/views/dashboard/`, seguindo o estilo de `DashPrimitives.jsx`: apresentação
só, com a matemática em `lib/`.

| Novo | O que é | Props |
| --- | --- | --- |
| `SoldHeroCard` | o painel de venda do mês: herói + cápsula de tipos + clawback | `{sold, count, delta, ticket, discount, mix, clawback}` |
| `WalletBand` | a faixa de 4 células da carteira | `{items, notes}` |
| `ExpiryRunway` | a esteira 30/60/90 com trilha tracejada | `{total, share, horizon, blind}` |
| `ExitsCard` | cancelamentos e trancamentos do mês | `{items, total}` |
| `SellerRankTable` | o ranking com as duas colunas de ticket | `{rows, read}` |
| `BlindValueNote` | a nota tracejada de contratos sem valor | `{count, context}` |
| `GerencialEmpty` | o painel único de academia sem contrato | — |

---

# 3. Medidas, tipografia e cores

Largura de conteúdo 1440. Seções empilhadas com `gap` 24px; cada uma abre com
título 16px Space Grotesk 700 + pergunta 12.5px `muted` sobre **régua de 2px**
`border-border` — a mesma gramática do Operacional e do CRM.

## Tipografia

| Onde | Fonte e tamanho |
| --- | --- |
| Herói "Vendido no mês" | Space Grotesk 700, 44px, `tracking -.035em`, `leading .95` |
| Número de risco 90 dias | Space Grotesk 700, 32px, `tracking -.03em` |
| Herói do BreakdownCard, "já venceu" | Space Grotesk 700, 28-30px |
| Células da carteira | Geist 600, 28px, `tracking -.025em` |
| Títulos de seção | Space Grotesk 700, 16px |
| Título de card | Geist 600, 13.5-14px |
| Rótulo de célula | Geist 500, 12px, `muted-foreground`, **caixa baixa** |
| Versalete estrutural | Geist 700, 9.5-10px, `tracking .08em`, `muted-foreground` |
| Valor em tabela | Geist 600, 13px, `num` |
| Linha de apoio | Geist 400, 11-11.5px, `muted-foreground` |

Todo número usa `num` (`font-variant-numeric: tabular-nums`). Valores grandes em
Space Grotesk; valores de tabela em Geist, para a coluna não brigar com o herói.

## Cores

| Papel | Token | Claro | Escuro |
| --- | --- | --- | --- |
| Matrícula nova, marca | `brand-600` | `#2B59FF` | idem |
| Renovação | `success` | `#15B981` | `#0E9F6E` |
| Upgrade | `violet-500` | `#8B5CF6` | idem |
| Retorno de ex-cliente | `slate-400` | `#94a3b8` | `#6B7593` |
| Risco, vencimento, trancamento | `amber-500` / texto `amber-700` | `#F59E0B` / `#B45309` | `#D97706` / `#FBBF24` |
| Cancelamento, já vencido | `danger` / texto `--red-700` | `#F43F5E` / `#BE123C` | `#E11D48` / `#FB7185` |
| Líder de breakdown | `accent-500` / texto `accent-600` | `#FF6A2B` / `#C2410C` | `#F2541A` / `#FF8A52` |

**Nenhuma cor nova.** Os quatro tipos de venda reusam brand / success / violet /
slate, que já existem no `index.css`. Violeta é o único que não aparece nas telas
irmãs; se preferir evitá-lo, a alternativa é `brand-300` para upgrade, já que
upgrade é parente de renovação.

Regras que o mockup segue:

- **Texto colorido usa o passo 700**, nunca a base. `#15B981` e `#FF6A2B` são
  preenchimento; texto verde é `emerald-700`, texto laranja é `accent-600`.
- **Versalete estrutural é `muted-foreground`, nunca `slate-400`** — a 9.5px o
  segundo dá 2.56:1.
- **Informação nunca só pela cor.** Cada cápsula e cada barra tem legenda com rótulo
  e número; o tipo de venda aparece escrito na lista abaixo da cápsula; contratos sem
  valor se distinguem por **forma** (hachura + borda tracejada), não por tom.
- Barras até 24px de espessura, ponta arredondada 4px; cápsulas de 42-44px com
  separador de 2px na cor do card.
- Ícones Lucide, 12-23px, `strokeWidth` 2-2.2.

---

# 4. Dicas — o que o mockup não consegue entregar

O brief pede dica no hover **e no foco do teclado**. O mockup usa `title` nativo em
todas as marcas com valor e dá `tabindex="0"` a elas, mas `title` **não dispara no
foco**. Não há como resolver em HTML puro sem reconstruir um tooltip à mão.

Na implementação, cada marca é um elemento focável dentro de
`Tooltip`/`TooltipTrigger` do shadcn, como o `DashHelpTip` já faz. Marcas que
precisam de dica: os 4 segmentos da cápsula de tipos, as 3 barras de risco, as 3
trilhas tracejadas, as 2 barras de saída, as 4 barras de consultor e os 5 segmentos
de cada breakdown. O foco visível é `outline: 2px solid var(--brand); outline-offset: 2px`.

---

# 5. Comportamento

## Mês e comparação

Setas andam um mês; a lista abre direto. **Uma venda conta no mês em que o contrato
foi fechado**, não no mês em que a vigência começa.

A caixa **Comparar** governa todo o comparativo: desligada, saem a pílula de delta e
a linha de base do herói, e a subline passa de "comparado com os 17 primeiros dias
de agosto" para "1 a 17 de setembro. O mês está em andamento e ainda vai receber
vendas."

No mês em andamento a comparação é **pró-rata**: dia 17 contra os 17 primeiros dias
do mês comparado, e a subline diz isso em texto. O mockup guarda o recorte pró-rata
no próprio mês comparado (`prorata: { 17: {...} }`); em produção isso é uma consulta
com o mesmo limite de dia.

**Histórico curto, tratado na interface:** quando não existe mês anterior com venda,
o controle Comparar inteiro sai da barra e no lugar entra "Não há mês anterior com
venda para comparar". A base padrão pula meses sem venda, e eles não aparecem na
lista de comparação. Não há comparação com o ano passado, então essa opção não existe.

## Os dois estados vazios são diferentes

Esta distinção custou uma rodada de correção e vale respeitar na implementação:

- **`gymEmpty`** (a academia não tem contrato nenhum) substitui o **corpo inteiro**
  pelo painel único "Ainda não há contratos" + CTA "Ir para o pipeline". Nenhum
  cabeçalho de seção, nenhum card de zeros, nenhuma tabela com cabeçalho e zero
  linhas.
- **`monthNoSales`** (`count === 0` no mês escolhido) esvazia só o que descreve a
  venda do mês: o herói vira o card "Nenhum contrato fechado neste mês" e "Quem traz
  receita" vira a nota "Sem vendas no mês, não há ranking". **Carteira e risco
  continuam inteiros**, porque olham contratos vigentes.

## Quebra para celular (abaixo de 768px)

Uma coluna. O herói da venda mantém número, delta e a cápsula de tipos com a legenda
em duas colunas. **Carteira e risco viram dois cartões pareados**, porque juntos
respondem "tenho X, posso perder Y". As barras de risco ficam, inclusive as trilhas
tracejadas. O que sai das tabelas é a coluna de ticket mensal, que desce para a linha
de apoio ("16 vendas · R$ 1.950 por venda"). Os três controles não cabem em linha:
viram um ícone no canto que abre painel com mês, comparação e academia.

---

# 6. Textos finais

**Barra e cabeçalho**
- `Gerencial`
- chip fixo: "Valor de contrato vendido, não caixa recebido"
- em andamento, comparando: "1 a 17 de setembro comparado com os 17 primeiros dias de agosto. O mês está em andamento, então a comparação é pró-rata."
- em andamento, sem comparar: "1 a 17 de setembro. O mês está em andamento e ainda vai receber vendas."
- fechado: "agosto inteiro comparado com julho. Mês fechado."
- sem base: "Não há mês anterior com venda para comparar"

**Seções**
- `Quanto vendi` — "contratos fechados no mês"
- `A carteira hoje` — "o que os contratos vigentes geram por mês"
- `Quanto posso perder` — "o que sai da carteira se ninguém renovar"
- `Quem traz receita` — "as vendas do mês por consultor, plano e origem"

**Rótulos**
- "Vendido no mês" · "Ticket mensal" / "média das vendas" · "Desconto" / "R$ 6.800 abaixo da tabela"
- "De onde veio a venda" / "cada contrato entra em um tipo só" · Matrícula nova · Renovação · Upgrade · Retorno de ex-cliente
- "Contratos vigentes" · "Valor por mês" · "Ticket mensal médio" · "Trancados"
- "Vencendo nos próximos 90 dias" · "Em 30 dias" / "Em 60 dias" / "Em 90 dias" · "26% da carteira"
- "Já venceu e ninguém renovou" · "Saiu neste mês" · "Cancelamentos" / "Trancamentos"
- "Quem vendeu" / "o consultor dono do lead na hora da venda" · colunas CONSULTOR · VENDIDO NO MÊS · VENDAS · TICKET DA VENDA · TICKET MENSAL
- "Planos mais vendidos" · "Origem do lead que fechou" · eyebrow "Plano que mais trouxe" / "Canal que mais trouxe"

**Dicas**
- Contratos vigentes: "Contratos com vigência em curso hoje. A carteira soma contrato, não pessoa: quem tem dois contratos vigentes conta duas vezes."
- Valor por mês: "Soma do ticket mensal de cada contrato vigente. Não é caixa recebido nem previsão de recebimento: é o que os contratos valem por mês."
- Trancados: "Contrato trancado segue vigente e continua na carteira, porque volta a valer quando o cliente destranca. A contagem fica à parte para não parecer receita ativa."
- Já venceu: "Contratos que passaram do fim da vigência e não têm contrato sucessor. É um retrato de agora, não um número do mês."
- Trilha tracejada: "Em 30 dias: mais 41 contratos importados sem valor. Contam como pessoas que vencem, não entram no valor por mês."

**Notas de rodapé de card**
- clawback: "2 vendas deste mês já foram canceladas, somando R$ 3.100. O valor continua no total do mês, porque o contrato foi fechado aqui."
- sobreposição: "A carteira soma contrato, não pessoa: 6 pessoas têm dois contratos vigentes ao mesmo tempo, então o número de contratos é maior que o de gente."
- importados: "494 contratos vieram de um sistema antigo sem o valor. Entram na contagem de contratos e no risco, e nunca somam no valor por mês. Preencher o valor deles em Contratos corrige a carteira."
- já vencido: "Já saíram da carteira, então o valor por mês deles não aparece aqui. É a fila de recuperação."
- saídas: "Trancamento é reversível e continua contando na carteira. Cancelamento sai."
- planos: "Combinação de modalidades é um grupo próprio, não a soma das partes: 'Musculação + Pilates' não entra em nenhum dos dois isolados."
- origem: "É a origem do lead que virou contrato, não o volume de leads do canal. Quanto cada canal gera em leads fica no painel CRM."

**Vazios**
- academia: "Ainda não há contratos" + "Esta tela ganha vida na primeira matrícula registrada. Enquanto isso, o funil de leads continua no painel CRM." + botão "Ir para o pipeline"
- mês: "Nenhum contrato fechado neste mês" + "Os contratos existem no sistema desde junho de 2026, então este mês não tem venda registrada. A carteira e o risco abaixo continuam valendo: eles olham os contratos vigentes, não as vendas do mês."
- ranking: "Sem vendas no mês, não há ranking" + "Consultor, plano e origem descrevem as vendas do mês escolhido. Troque o mês para ver o ranking."

---

# 7. Números que eu sugeri, e de onde vêm

Três derivados que não estavam na sua lista. Todos calculáveis do que já existe:

| Número | Conta | Por que vale |
| --- | --- | --- |
| **% da carteira em risco** ("26%") | (soma dos 3 horizontes) ÷ valor por mês da carteira | Transforma R$ 34.300 em "isso é um quarto do que tenho". Sem ele, o número de risco não tem escala. |
| **Ticket por venda** | valor vendido ÷ nº de vendas, por consultor | Mostra quem fecha contrato maior, independente de volume. |
| **Ticket mensal por consultor** | valor vendido ÷ nº de vendas ÷ **duração média do plano vendido** | É o que revela quem vende plano longo. ⚠ **Precisa confirmar**: exige agrupar a duração dos planos vendidos por consultor no mês. Se o sistema não fizer esse agrupamento, fico só com o ticket por venda e a coluna sai. |
| **Participação de cada consultor** ("40%") | valor do consultor ÷ vendido no mês | Barato e já derivável. |

O mockup usa `AVG_MONTHS` por consultor como stand-in da duração média. **Substitua
por consulta real ou remova a coluna** — não invente a média.

---

# 8. ⚠ Regra de implementação herdada do Operacional

**Nunca guarde um agregado ao lado do detalhe que o gera.** No Operacional esse
mesmo erro apareceu quatro vezes: um percentual autorado ao lado das contagens que
deveriam produzi-lo, e os dois divergindo na tela.

Aqui vale para: ticket mensal médio da carteira (= valor por mês ÷ contratos com
valor), % da carteira em risco, participação de cada consultor, e todo percentual de
cápsula. Nada de campo `ticketMedio` no documento. `lib/gerencialMetrics.js` deve
expor uma função que calcula tudo a partir dos contratos do período, e a view nunca
lê percentual gravado.

Consequência direta nesta tela: **contratos sem valor não podem entrar no
denominador do ticket médio**. Na Unidade Moinhos são 1.122 contratos e 628 com
valor — o ticket é R$ 134.200 ÷ 628, não ÷ 1.122.

---

# 9. Dados do mockup

4 pessoas: Ana Ribeiro, Diego Santos, Larissa Moura (consultores) e Marcos Lima
(gestor que também vende). Cinco meses: maio (sem venda, antes do sistema), junho,
julho, agosto fechados e setembro em andamento até o dia 17. Três academias: Centro
(base limpa), Moinhos (494 importados sem valor) e Nova (sem contrato).

Setembro, Unidade Centro: R$ 78.400 em 42 contratos contra R$ 71.900 nos mesmos dias
de agosto; ticket mensal R$ 214; desconto 8%; 21 matrículas novas, 14 renovações, 5
upgrades, 2 retornos; 2 vendas já canceladas (R$ 3.100). Carteira 628 contratos, R$
134.200/mês, 19 trancados (R$ 4.100/mês), 6 pessoas com dois contratos. Risco: 63 /
48 / 57 contratos valendo R$ 13.100 / 9.800 / 11.400 por mês; 29 já vencidos; saídas
7 cancelamentos (R$ 1.480/mês) e 4 trancamentos (R$ 820/mês).

Toda soma fecha: mix, consultores, planos e origens somam R$ 78.400 e 42 contratos.
