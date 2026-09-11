# Handoff — tela Operacional (Visão geral)

Substitui `src/views/dashboard/DashboardOperacionalView.jsx`.

O mockup é **especificação visual e de comportamento**, não código para colar. Abra
`Operacional.dc.html` no navegador e mexa: setas e lista trocam o mês (setembro em
andamento → agosto e julho fechados), a caixa Comparar liga/desliga todo o
comparativo, o filtro de pessoa refaz a tela inteira, e clicar numa linha da tabela
da equipe filtra por aquela pessoa. Os estados de carregamento, vazio, prospecção
desligada e celular 390 estão no bloco abaixo do quadro principal.

Convenções do projeto que valem aqui (de `CLAUDE.md`): trabalho via PR, nunca commit
direto na main; `cn()` para classe condicional; tokens semânticos (`bg-card`,
`text-muted-foreground`, `border-border`) em código novo, sem `dark:` manual;
`flex gap-*` no lugar de `space-x/y-*`; `size-N` no lugar de `w-N h-N`; ramp laranja
sempre com sufixo (`accent-500`), porque `bg-accent` puro é o token semântico shadcn.

---

# 1. Componentes: o que reusar e o que é novo

## Reusar como está

| Componente | Onde | Observação |
| --- | --- | --- |
| `DashCard` (DashPrimitives) | as ~10 cascas de card da tela | `rounded-2xl border-border bg-card shadow-card`, header `px-5 py-4` com título 14px semibold e `hint` 11.5px embaixo, corpo `p-5`. **O mockup põe o hint inline ao lado do título** porque são hints curtos — se preferir, deixe no lugar padrão (sob o título) e o desenho continua válido. |
| `DashKpiCard` (DashPrimitives) | as 5 células da faixa de resumo | Ver §2 para a única divergência: a faixa é **um objeto só**, não 5 cards. |
| `DashHelpTip` (DashPrimitives) | o "?" de cada métrica | `HelpCircle` 12px em `size-4`, tooltip shadcn, `aria-label` no padrão `O que é "X"?`. O mockout reproduz isso; use o componente. |
| `BreakdownCard` (DashPrimitives) | "Cancelamentos por motivo" e "Motivos de quem não vai renovar" | Cobre tudo: ícone `accent-50`, título, `sub`, `eyebrow`, número grande do motivo líder, cápsula segmentada de 42px na `BREAKDOWN_PALETTE`, lista com dot/nome/contagem/%, e o slot `emptyText` para mês sem cancelamento. **Não reimplemente** — o mockup já foi refeito nesse formato. |
| `Sparkline` (components/charts) | tendência nas células do resumo | `&lt;Sparkline data={série} width={120} height={42} strokeWidth={1.75} /&gt;`, cor por `currentColor` (classe `text-*` no pai, ex. `DASH_TONES.brand.stroke`). Linha + área com gradiente. O mockup aproxima o gradiente com `fill-opacity`; use o componente real. |
| `DASH_TONES`, `BREAKDOWN_PALETTE`, `dashInitials` (dashTokens) | tons de série, cápsula, monogramas | `accent='brand'` para meta, e ver §3 para prospecção. |
| `Select` (`components/ui/select.jsx`) | os 3 controles da barra fixa | O mockup usa `&lt;select&gt;` nativo só porque é HTML puro. **Use o shadcn Select** — abre para baixo, navegação por teclado e portal de z-index vêm de graça. |
| `Tooltip` (`components/ui/tooltip.jsx`) | **toda marca de gráfico com valor** | Ver §4. É o item mais importante desta lista. |
| `Switch` ou `Checkbox` (components/ui) | a caixa "Comparar" | O mockup desenha uma caixa 16px com check; `Checkbox` do shadcn é o equivalente. |
| `Separator` (components/ui) | réguas verticais entre células | Onde o mockup usa `border-left: 1px solid var(--rule)`. |
| `Skeleton` (app, não shadcn) | **não usar** | O estado de carregamento desta tela é deliberadamente sem esqueleto — ver §6. |

Primitivo complexo novo que a tela pedir: `npx shadcn@latest add &lt;comp&gt;` e invocar a
skill `shadcn`, conforme o `CLAUDE.md`. `avatar` e `skeleton` são exceção (colidem em
APFS com `Avatar.jsx`/`Skeleton.jsx` do app — use os do app).

## Componentes novos a criar

Todos em `src/views/dashboard/`, seguindo o estilo de `DashPrimitives.jsx`
(apresentação só; a matemática mora em `lib/`).

| Novo | O que é | Props sugeridas |
| --- | --- | --- |
| `OperacionalToolbar` | a barra fixa de controles | `{month, onMonth, compareOn, onCompareOn, compareKey, onCompare, person, onPerson, people, note}` |
| `DashSummaryBand` | a faixa de 5 números num objeto só | `{items: [{label, value, sub, delta, series, help, accent}]}` — cada célula renderiza o **conteúdo** de `DashKpiCard` |
| `DashHighlights` | os 3 destaques do mês | `{items: [{text, delta, better}]}` |
| `MetaDaysCalendar` | régua de dias seg–sex | `{days, hitsByPerson, person, teamSize, todayIndex}` |
| `ProspectionByDay` | colunas por dia + linha de alvo | `{days, values, target, todayIndex}` |
| `BaseBridge` | a ponte (waterfall) do movimento da base | `{steps: [{name, value, kind: 'level'|'in'|'out'}]}` |
| `RenewalOutcomeBar` | barra de desfecho + "quando renovou" | `{counts: {renew, wont, lapsed, pending}, when}` |
| `MilestoneBars` | contatos nos marcos 90/60/30 | `{items: [{days, done, total}]}` |
| `TeamMonthTable` | uma linha por pessoa | `{rows, running, onPick}` |

---

# 2. Layout e medidas

Largura de conteúdo 1440 (o mockup emoldura a 1440 com o trilho de 72px). Seções
empilhadas com `gap` de 22px. Ordem, que saiu de três direções testadas:

1. **Cabeçalho** — `Operacional` 24px Space Grotesk 700, e abaixo a linha que diz o
   regime de comparação (ver §5).
2. **Barra fixa de controles** — `position: sticky; top: 0`, `padding: 10px 32px`,
   `border-top: 1px solid var(--rule)` + `border-bottom: 1px solid var(--border)`,
   fundo `bg-card`. Três controles à esquerda, nota do regime à direita.
3. **Três destaques** — grade de 3, `gap` 12px, cards `rounded-2xl` com tinta
   `emerald`/`rose` conforme melhorou ou piorou.
4. **Faixa de resumo** — um card só, 5 células divididas por régua vertical.
5. **Rotina** — título + pergunta, régua de 2px, grade `1.55fr / 1fr`.
6. **Base de clientes** — mesma estrutura.
7. **Renovação** — mesma estrutura.
8. **Equipe no mês** — só em "Equipe toda".

Título de seção: 16px Space Grotesk 700 + a pergunta em 12.5px `muted`, sobre uma
**régua de 2px** `border-border`. É ela que faz a tela ler como três blocos em vez de
vinte cartões soltos.

## Faixa de resumo — a divergência deliberada

O brief pede "cinco números num objeto só", então a faixa **não** são 5
`DashKpiCard` lado a lado: é um `DashCard` sem header com 5 células divididas por
`border-left`. Dentro de cada célula, o vocabulário é o do `DashKpiCard`, e é aqui
que o mockup foi corrigido para não divergir do resto do app:

- rótulo `text-[12px] font-medium text-muted-foreground`, **caixa baixa** (não
  versalete), com o `DashHelpTip` ao lado;
- valor `num text-[32px] font-semibold tracking-tight leading-none`, em Geist
  (Space Grotesk fica para títulos de seção e números de destaque dos cards);
- delta em **pílula**: `px-1.5 h-5 rounded-md text-[11px] font-semibold` com ▲/▼ e
  fundo `emerald-50`/`rose-50` (dark: `/10`);
- `sub` `text-[11.5px] text-muted-foreground`;
- `Sparkline` 120×42, `strokeWidth` 1.75, com os rótulos de mês nas pontas.

## Régua de dias (calendário)

O card **preenche a trilha** como os irmãos, mas a grade interna tem largura própria:
`repeat(5, minmax(0,1fr))` com `max-width: 470px`, `gap` 6px, célula `h-[52px]`
`rounded-[10px]`. Isso não é detalhe: sem o teto, qualquer alargamento do card
esticava a célula para 249×34 (letterbox de 7:1); com teto no card em vez da grade,
o card parava antes da borda da trilha e desalinhava da seção. **Teto na grade,
card livre.**

Quando o card de prospecção sai da tela (pessoa com alvo 0), a linha da Rotina troca
de trilhas: `minmax(0,505px) minmax(0,1fr)` — o calendário fica com a largura que
realmente tem e a tabela densa de tarefas fica com a trilha larga. Não use
`grid-column: 1 / -1` no calendário; ele encerra 832px mortos dentro do card.

## Ponte da base — não começa em zero

419 clientes com movimento de 9 entradas seria uma barra reta. A escala corta perto
do mínimo (`pad = max(35% da amplitude, 3)`), **o número vem escrito em cada nível**
e a legenda avisa do corte. Entrada em azul `brand-600`, saída em vermelho
`danger` — verde e vermelho lado a lado reprovam no teste de daltonismo.

---

# 3. Cores

Tudo por token de `src/index.css`; nenhum hex solto onde existe token.

| Papel | Token | Claro | Escuro |
| --- | --- | --- | --- |
| Meta diária, entrada na base | `brand-600` | `#2B59FF` | idem |
| Texto azul sobre tinta | `brand-700` / `brand-300` | `#1C3FC4` | `#8FB0FF` |
| Prospecção | `accent-500` | `#FF6A2B` | `accent-600` `#F2541A` |
| Texto laranja | `accent-600` | `#C2410C` | `accent-400` |
| Renovou | `success` | `#15B981` | `#0E9F6E` |
| Não vai renovar | `amber-500` | `#F59E0B` | `amber-600` `#D97706` |
| Venceu sem renovar, saída | `danger` | `#F43F5E` | `#E11D48` |
| Ainda vai vencer | `slate-400` | `#94a3b8` | idem |

Escala de "quantos bateram a meta" (1 a 4 de 4): claro
`#8FB0FF → #5A7FFF → #2B59FF → #1C3FC4`; escuro `#2B59FF → … → #C9D8FF`. Zero é
`bg-muted`.

Regras de contraste que o mockup segue e que valem na implementação:

- **Texto colorido usa o passo 700**, nunca a base. `#15B981` e `#FF6A2B` são para
  preenchimento; texto verde é `emerald-700`, texto laranja é `accent-600`.
- **Rótulo em versalete é `muted-foreground`, nunca `slate-400`.** A 9.5–10px eles
  fazem trabalho estrutural; `slate-400` nesse tamanho dá 2.56:1.
- Barras com até 24px de espessura e ponta arredondada de 4px, linhas de 2px, grade
  em fio fino, rótulo só onde faz diferença (com mais de 14 colunas o valor sai de
  cima da barra — não cabe e a barra já diz).
- `num` (tabular) em toda coluna de número.
- Ícones Lucide, 12–19px, `strokeWidth` 2–2.2.

---

# 4. Dicas — o ponto que o mockup não consegue entregar

O brief pede dica **no hover e no foco do teclado** em toda marca com valor. O
mockup usa o atributo `title` nativo em 75 marcas (barras de dia, células do
calendário, trechos da ponte, fatias do desfecho, marcos, segmentos da cápsula) e
dá `tabindex="0"` a elas — mas `title` **não dispara no foco**. Não tem como
resolver em HTML puro sem reconstruir um tooltip à mão.

Na implementação, cada marca é um `&lt;button&gt;` (ou elemento focável) dentro de
`Tooltip`/`TooltipTrigger` do shadcn, como o `DashHelpTip` já faz. Textos das dicas
no §7.

---

# 5. Comportamento

## Mês de competência
Setas ‹ › andam um mês; a lista abre o mês direto. Cada número pertence ao mês em
que o fato aconteceu. Só o mês corrente é "em andamento".

## Comparar — ligado e desligado
A caixa **Comparar** governa todo o comparativo. Desligada, saem: as pílulas de
delta das 5 células, a marca fina e a coluna de diferença nas tarefas, o delta dos
upgrades, e **o bloco de destaques inteiro** (ele só existe para narrar mudanças). A
linha sob o título passa de "1 a 11 de setembro comparado com os 11 primeiros dias
de agosto. O mês está em andamento, então a comparação é pró-rata." para "1 a 11 de
setembro. O mês está em andamento: hoje conta à parte."

Ligada, o padrão é o mês anterior, e a lista aceita qualquer mês passado mais o
mesmo mês do ano anterior. No mês em andamento a comparação é **pró-rata**: dia 11
contra os 11 primeiros dias do mês comparado. Quando o mês comparado não existe na
base, o delta lê **"sem base"** em vez de inventar número.

## Filtro de pessoa
"Equipe toda" por padrão; todo mundo vê todo mundo. Com uma pessoa selecionada, a
tabela da equipe desaparece e a tela inteira passa a ser dela — com uma exceção
importante: **clientes ativos e churn continuam da academia** e a sub-linha diz
"base da academia, não da carteira". Escalar a base pela fatia da pessoa fabrica um
número que não existe no modelo.

Clicar numa linha da tabela filtra por aquela pessoa.

## Prospecção desligada (alvo 0)
Alvo 0 **não é alvo pequeno**. A célula troca o número por "Desligada" em
`muted-foreground`, sem pílula e sem tendência; o card "Prospecção por dia" sai da
tela inteiro; na tabela da equipe vira etiqueta cinza, nunca barra vazia.

## Retratos do agora
"Atrasados agora" e "A vencer" só existem no mês em andamento, com etiqueta AGORA.
Em mês fechado, no lugar deles entra um card tracejado dizendo por que sumiram — em
vez de o espaço colapsar e o gestor achar que é bug. Na tabela da equipe, a coluna
"Atrasados agora" desaparece em mês fechado (não vira fileira de travessões).

## Carregando
**Sem esqueleto.** Ao trocar de mês os números anteriores ficam na tela a 35% de
opacidade até os novos chegarem, com um fio de progresso de 2px no topo do bloco. A
tela não muda de altura, então nada salta quando o dado chega.

## Celular (abaixo de 768px)
Uma coluna; resumo em grade de 2; destaques viram carrossel **com o pior primeiro**;
a tabela da equipe vira lista com as três taxas numa linha de texto; os gráficos de
dia mantêm a barra e perdem o rótulo por cima; a régua de dias vira scroll
horizontal com `scroll-snap`. Os três controles não cabem em linha a 390 — aí sim
vale o ícone no canto abrindo um painel com mês, comparativo e pessoa.

---

# 6. ⚠ A regra que este mockup aprendeu na dor

**Nunca guarde um agregado ao lado do detalhe que o gera.** O mesmo bug apareceu
quatro vezes durante o desenho, sempre com a mesma forma: um campo de taxa autorado
por pessoa ao lado de contagens autoradas por equipe, e os dois divergindo na tela.

- taxa de renovação por pessoa (79%) ao lado da barra que dizia 18 de 22 (82%);
- clientes ativos multiplicado por uma fatia inventada (75) sobre uma tendência de 410;
- calendário por pessoa perguntando "três dos quatro bateram?", então Ana (7/8) e
  Marcos (4/8) viam dias idênticos;
- delta por pessoa calculado contra a linha de base **da equipe** (+22 p.p. em vez
  de +7).

A forma final: **uma função calcula as métricas de qualquer mês, para a equipe ou
para uma pessoa**, e o mês exibido, o mês comparado e cada ponto da série chamam a
mesma função. A fonte é sempre o detalhe (acerto por pessoa por dia, contagem de
desfecho por pessoa); o número da equipe é a soma. Quinze campos `prev` autorados e
doze campos `metaPct` foram deletados por serem exatamente esse risco.

No React isso significa: `lib/dashboardMetrics.js` expõe `metricsOf(monthKey,
userId | null)` e a view nunca lê um percentual gravado. Nada de `metaPct` no
documento.

---

# 7. Textos finais

**Título e regime**
- `Operacional`
- em andamento, comparando: "1 a 11 de setembro comparado com os 11 primeiros dias de agosto. O mês está em andamento, então a comparação é pró-rata."
- em andamento, sem comparar: "1 a 11 de setembro. O mês está em andamento: hoje conta à parte."
- fechado: "julho inteiro comparado com junho. Mês fechado."
- nota da barra: "Comparação pró-rata: mesmos 11 primeiros dias" / "Mês fechado contra mês fechado" / "Sem comparativo"

**Seções**
- `Rotina` — "o trabalho foi feito?"
- `Base de clientes` — "a carteira cresceu ou encolheu?"
- `Renovação` — "estamos segurando quem vence?"
- `Equipe no mês` — "clique numa linha para filtrar a tela por essa pessoa"

**Cards**
- "Prospecção por dia" · legenda "alvo 30/dia"
- "Dias de meta" · legenda "quantos bateram" (equipe) / "bateu / não bateu" (pessoa)
- "Tarefas concluídas por tipo" · legenda com o nome do mês comparado
- "Atrasados agora" · etiqueta "AGORA" · "N contatos sem retorno"
- "Movimento da base" · legendas "entrou" / "saiu" · nota "A escala não começa em zero: a base é grande e o movimento é pequeno. O número está escrito em cada nível."
- "Cancelamentos por motivo" · eyebrow "Motivo mais comum"
- "Upgrades" / "Trancamentos" · "vendas pelo funil Upgrade" / "9 trancaram · 4 destrancaram"
- "Contratos vencendo no mês" · "34 contratos com fim neste mês" · sub-bloco "Quando renovou" com "Antes de vencer" / "No vencimento" / "Depois, na tolerância"
- "Contatos nos marcos" · "90 dias antes", "60 dias antes", "30 dias antes"
- "Motivos de quem não vai renovar" · eyebrow "Motivo mais comum"
- "A vencer" · "em 30 dias" / "em 60 dias" / "em 90 dias" · nota "Contratos com fim nos próximos 30, 60 e 90 dias. Serve para planejar o contato, não entra na taxa do mês."

**Vazios**
- "Nenhum cancelamento neste mês."
- "Ninguém declarou que não vai renovar neste mês."
- "Atrasados agora só existe no mês em andamento" + "É um retrato do momento, não um número do mês fechado."
- "A vencer só existe no mês em andamento" + "Em mês fechado todos os contratos do período já tiveram desfecho."
- prospecção desligada: "Desligada" + "alvo 0 no cadastro"

**Dicas (tooltip)**
- Meta diária: "Dias com meta batida ÷ dias de meta do mês. No mês em andamento conta só os dias já fechados; hoje aparece à parte na régua de dias."
- Prospecção: "Ações de prospecção ÷ alvo do mês (alvo diário da pessoa × dias de meta)." / desligada: "Alvo diário 0 no cadastro: a pessoa está sem cota de prospecção. Não é 0%."
- Clientes ativos: "Pessoas com contrato vigente no fim do mês. Quem está trancado conta à parte."
- Churn: "Cancelamentos mais vencidos que passaram da tolerância ÷ clientes ativos no início do mês."
- Taxa de renovação: "Renovados ÷ vencendo. No mês em andamento, renovados ÷ contratos que já tiveram desfecho."
- Atrasados agora: "Contatos que passaram da data sem retorno. É um retrato de agora e não existe para mês fechado."
- Contatos nos marcos: "Tarefas de renovação feitas ÷ clientes que chegaram a cada marco. A academia pode mudar os marcos em Configurações."
- Marca de gráfico: "Dia 12 · 3 de 5 bateram", "Marco de 30 dias: 19 contatos feitos de 34 clientes que chegaram ao marco", "Cancelaram: −2 · base em 426", "Renovou: 18 de 34 contratos", "Financeiro: 1 de 2 · 50%".

---

# 8. Regras de negócio que a tela respeita

- **A venda é de quem está no contrato** (mesmo nome da comissão): entraram,
  voltaram, upgrades. **A carteira é de quem cuida do cliente hoje**: vencendo, a
  vencer, vencidos, taxa de renovação. As duas regras convivem na mesma linha da
  tabela da equipe — foi decisão consciente, não descuido.
- **Contrato importado de planilha** entra na base e na renovação, e nunca conta
  como matrícula, retorno, cancelamento ou trancamento.
- **Os dias de meta vêm da configuração da academia** (padrão seg a sex). O mockup
  deriva a lista do calendário real do mês, não de array digitado. Fim de semana é
  folga e **nunca** conta como falha — por isso a régua tem 22 posições em setembro,
  não 30.
- **Os marcos de renovação vêm de `renewalCheckpoints` em `stronix_config/general`**
  (padrão 90/60/30). Mudar em Configurações → Metas & ritmo muda esta tela, a Meta
  Diária e o cartão do Stronizap juntos. Não hardcode.
- **Motivos** de cancelamento e de "não vai renovar" saem da mesma lista fixa:
  Financeiro, Mudou de cidade, Insatisfação, Saúde ou lesão, Foi para outra
  academia, Outro.
- **Esta tela não mostra R$.** Nem conversão, canais ou motivos de perda de lead
  (isso é CRM), nem agenda, placar do dia ou feed (isso é Meta Diária), nem números
  por professor.

---

# 9. Dados do mockup

4 pessoas: Ana Ribeiro, Diego Santos, Larissa Moura (consultores) e Marcos Lima
(gestor que também vende, prospecção desligada). Três meses no modelo: julho e
agosto fechados, setembro em andamento até o dia 11.

Setembro, equipe: meta 69% (22 de 32 dias-pessoa fechados), prospecção 79% (214 de
270), 419 clientes ativos (+2), churn 0,5%, taxa de renovação 82% (18 de 22 com
desfecho), 21 contatos atrasados agora.

A fonte de cada métrica é sempre um detalhe autorado: `hitsBy` (acerto por pessoa
por dia), `split` (desfecho de renovação por pessoa), `daily` (ações de prospecção
por dia). Troque por dados reais — a estrutura é a mesma.

Duas séries continuam autoradas no nível da equipe por não haver mês suficiente no
modelo: a tendência de 6 meses de clientes ativos e de churn. Com uma pessoa
filtrada, as séries de meta, prospecção e renovação encurtam para os meses que
existem (3 pontos) e o rótulo diz "3 meses", em vez de mostrar a série da equipe sob
um número da pessoa.
