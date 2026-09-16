# Handoff — tela CRM (Visão geral)

Substitui a página "Em breve" da aba CRM (`src/views/dashboard/DashboardComingSoonView.jsx`).
Tela irmã do Operacional: mesmo menu, mesmo cabeçalho, mesmo vocabulário visual.

O mockup é **especificação visual e de comportamento**, não código para colar. Abra
`CRM.dc.html` e mexa:

- as setas e a lista trocam o mês (setembro em andamento → agosto e julho fechados);
- a caixa **Comparar** liga e desliga todo o comparativo;
- o seletor de **funil** abre a passagem entre etapas (em Todos os funis ela não existe);
- o seletor de **pessoa**, e o clique numa linha da tabela, refazem a tela inteira;
- julho mostra os dois buracos de base: etapas sem histórico e agendamento incompleto;
- trocar de mês dispara o estado de carregamento real (opacidade 35% + fio de 2px).

Celular 390 (claro e escuro) e o estado de "mês sem perdas" estão abaixo do quadro.
O botão no topo troca o tema.

Convenções do projeto que valem aqui (de `CLAUDE.md`): PR, nunca commit direto na main;
`cn()` para classe condicional; tokens semânticos (`bg-card`, `text-muted-foreground`,
`border-border`), sem `dark:` manual; `flex gap-*` no lugar de `space-x/y-*`; `size-N`
no lugar de `w-N h-N`; ramp laranja sempre com sufixo (`accent-500`).

---

# 1. As escolhas de design, e por quê

**Quatro seções, uma por pergunta.** Origem, Funil, Pessoas, Velocidade, mais o retrato
de Carteira agora. Cada seção abre com título de 16px e a pergunta em 12,5px sobre uma
régua de 2px — o mesmo recurso do Operacional, que é o que faz a tela ler como cinco
blocos em vez de vinte cartões soltos. A ordem responde na sequência do funil: de onde
vem, onde para, quem trabalha, em quanto tempo.

**Safra é o eixo da tela.** O `lib/dashboardMetrics.js` já separa SAFRA de EVENTO, e esse
é o conceito que resolve a confusão central do CRM: 29 matrículas no mês convivem com 18%
de conversão porque só 10 vieram da turma de setembro. Em vez de esconder isso, a tela
mostra os dois lados na mesma célula: valor 29, sub-linha "10 da safra de setembro · 19 de
safras anteriores". **A palavra "safra" aparece na interface** porque é a palavra do código
e a que descreve o objeto.

**A safra virou passagem e desfecho, não um funil afunilado.** Duas barras de passagem
sobre a mesma base (agendaram, compareceram) com a queda escrita ao lado, e a barra de
desfecho em seguida (matriculou / em jogo / perdido). O desenho de funil clássico mente
duas vezes: sugere que as etapas são
exclusivas e esconde que a safra continua viva.

**Onde se perdem tem duas leituras, e as duas estão na tela.** A perda por motivo
(cadastro do time) e a perda por etapa (gravada pelo sistema) respondem coisas
diferentes: a primeira diz o argumento que derruba a venda, a segunda diz o lugar do
funil que vaza. A passagem entre etapas fica num card próprio porque só existe com um
funil escolhido.

**Canal e conversão na mesma barra.** A barra inteira é o volume de leads e o trecho
escuro é quem matriculou, então dá para ver num relance que o Instagram traz volume
(22 leads, 14%) e a indicação traz resultado (9 leads, 44%). Ordenar por volume e
mostrar só o volume — como o card de canais do Gerencial faz hoje — premia o canal
errado.

**Velocidade tem número grande e distribuição.** A mediana sozinha esconde os leads que
nunca foram atendidos, então **a mediana é calculada com os "sem contato" no fim da fila**
(censura à direita) e o card diz isso. A distribuição em quatro faixas é o que dá a ação:
12 leads passaram de 24 horas sem ninguém falar com eles.

**Carteira agora é o único bloco acionável, e fica no fim.** O número de 23 leads em jogo
sem próximo contato marcado ganha o card vermelho: são os leads que não aparecem na Meta
Diária de ninguém. É o retrato de agora, e desaparece com aviso em mês fechado.

**O que eu deixei fora.** Nenhum R$. Nada de meta diária, prospecção, tarefas, base de
clientes ou renovação (é Operacional). Nenhum ranking de pessoa com medalha — a tabela
ordena pelo cadastro e a comparação fica na coluna de conversão, porque com 8 a 18 leads
por pessoa em 14 dias um ranking troca de líder por sorte.

**Identidade.** Space Grotesk nos títulos de seção e nos números de destaque dos cards,
Geist no texto e nos números das faixas, `brand-600` #2B59FF como cor do dado. Nenhuma
cor nem fonte nova. A evolução em relação ao Operacional é só de ritmo: cinco seções
curtas em vez de três longas, e a régua de 2px carregando a hierarquia.

---

# 1b. O que saiu por ser redundante

Rodada de corte depois da primeira revisão. Cada número da tela aparece uma vez só.

| Saiu | Porque |
| --- | --- |
| Destaque "Primeiro contato em 2 h 10 min" | Era o número grande do card de Velocidade, com o mesmo delta. |
| Destaque "29 matrículas, 10 da safra" | Era o valor e a sub-linha da célula Matrículas. |
| Destaque "16 dos 56 agendaram: 29%" | É a primeira linha da passagem da safra. |
| Marco "Cadastraram · 56 · 100% da safra" | É a célula Leads novos com um 100% colado. A base agora fica na hint do card. |
| Marco "Matricularam" | É a primeira fatia da barra de desfecho, logo ao lado. |
| Card "De onde vêm as matrículas" | Existia para dizer 10 e 19, que estão na sub-linha da célula Matrículas. A leitura útil ("o resto é acompanhamento longo") virou uma linha no card de Dias até a matrícula. |
| "56 leads novos" em três hints de card, "29 matrículas" em duas | Os hints passaram a dizer o que o card mede, não a repetir a faixa de resumo. |
| Contagens repetidas em `channelRead`, `desfechoRead` e `fcRead` | Os textos ficaram com a leitura e perderam os números que a barra ao lado já mostra. |

**Os destaques agora narram o que nenhum card diz:** os leads acima de 24 horas sem
primeiro contato (soma das duas últimas faixas da distribuição, que em nenhum lugar
aparece somada) e o canal de melhor conversão comparado com o mesmo canal no mês anterior.
Com o comparativo desligado eles desaparecem, como antes. A grade se adapta à quantidade.

**Três pares que continuam na tela e não são redundância:** comparecimento 12 de 17
(evento) ao lado de "Compareceram 12" (safra); 17 perdas no mês (evento) ao lado de 6
perdidos da safra; 40 em jogo da safra ao lado de 87 em jogo na carteira. São bases
diferentes, e é por isso que cada um mora num bloco com base declarada no título ou na
hint. Se algum deles confundir em teste com gestor, o caminho é reforçar o rótulo, não
apagar o número.

---

# 2. Componentes: o que reusar e o que é novo

## Reusar como está

| Componente | Onde | Observação |
| --- | --- | --- |
| `DashCard` (DashPrimitives) | as 10 cascas de card | `rounded-2xl border-border bg-card shadow-card`, header `px-5 py-4`, corpo `p-5`. O mockup usa header `14px 18px` e corpo `16px 18px` para ganhar densidade; se preferir manter o padrão do Operacional, o desenho continua válido. |
| `DashKpiCard` (DashPrimitives) | as 5 células da faixa de resumo | Mesma divergência deliberada do Operacional: a faixa é **um objeto só** com 5 células divididas por `border-left`, não 5 cards. |
| `DashSummaryBand` | a faixa de resumo | Já existe, criado no Operacional. Aqui ela ganha um slot novo: a etiqueta `incompleto` ao lado do valor (ver §5). |
| `DashHighlights` | os destaques | Já existe. Mesmo contrato: `{text, delta, better}`, mais um `rank` (pior, igual, melhor) para a ordem do carrossel no celular. A grade se adapta à quantidade: hoje dois, nenhum quando não há base de comparação. |
| `DashHelpTip` (DashPrimitives) | o "?" das métricas e dos dois cards de conceito | `HelpCircle` 12px em `size-4`, `aria-label` no padrão `O que é "X"?`. |
| `ChartMark` (views/dashboard) | **toda marca de gráfico com valor** | Já existe e resolve o problema do §4 do handoff do Operacional: `Tooltip` do shadcn com `tabIndex=0`, dica no hover **e** no foco. O mockup usa `title` nativo em ~70 marcas porque é HTML puro; na implementação **use `ChartMark`**. |
| `BreakdownCard` (DashPrimitives) | "Perdas" (motivos) | Cobre ícone, eyebrow, número grande do líder, cápsula de 42px na `BREAKDOWN_PALETTE`, lista ranqueada e `emptyText`. O sub-bloco "Etapa em que se perdeu" é o único acréscimo: entra como `children` ou como prop nova `footerSlot`. |
| `Sparkline` (components/charts) | tendência nas células do resumo | `width={120} height={42} strokeWidth={1.75}`, cor por `currentColor`. |
| `DASH_TONES`, `BREAKDOWN_PALETTE`, `dashInitials` | tons de série, cápsula, monogramas | `brand` para leads e conversão, `emerald` para matrícula e comparecimento, `accent` para agendamento. |
| `Select` (`components/ui/select.jsx`) | os 4 controles da barra fixa | O mockup usa `<select>` nativo por ser HTML puro. Use o shadcn. |
| `Checkbox` (components/ui) | a caixa "Comparar" | |
| `Tooltip` (components/ui) | tudo que tem dica | |
| `computeCapturedLeads`, `computeScheduledLeads`, `computeConvertedLeads`, `computeAttendance`, `computeFunnelSteps`, `computeSourceMetrics`, `computeProfessorConversion`, `computeLossReasons`, `computeTeamMetrics` (lib/dashboardMetrics.js) | quase toda a matemática | **Já existe tudo.** Esta tela é, em boa parte, dar lugar próprio a números que hoje moram no Gerencial. Ver §9. |

## Componentes novos a criar

Em `src/views/dashboard/`, apresentação só; a matemática mora em `lib/`.

| Novo | O que é | Props sugeridas |
| --- | --- | --- |
| `CrmToolbar` | a barra fixa de 4 controles | `{month, onMonth, compareOn, onCompareOn, compareKey, onCompare, person, onPerson, people, funnel, onFunnel, funnels, note}` |
| `ChannelTable` | canais: barra volume + trecho de matrícula | `{rows: [{name, leads, enrolled}], avgConv, read}` |
| `CohortMilestones` | as duas passagens + a barra de desfecho | `{leads, sched, came, enrolled, lost, open, monthLabel, running}` |
| `StagePassageTable` | entraram / avançaram / perderam / mediana | `{rows: [{name, entered, advanced, lost, medianMinutes}], funnelName, hasBase, needFunnel}` |
| `LossStageBars` | etapa em que se perdeu | `{rows, total, hasBase, monthLabel}` |
| `PeopleConversionTable` | uma linha por pessoa, clicável | `{rows, person, onPick}` |
| `ProfessorCard` | aulas por professor + modalidade | `{rows, soloRow, done, scopeNote}` |
| `FirstContactCard` | mediana + distribuição em 4 faixas | `{median, buckets, delta}` |
| `DaysToEnrollCard` | histograma de 6 faixas + mediana | `{median, buckets, delta}` |
| `PipelineNowCard` | em jogo por funil ou por etapa | `{rows, total, byFunnel, funnelName}` |
| `NoNextContactCard` | o card vermelho de 23 | `{count, total, onOpenList}` |

`PeopleConversionTable` e `TeamMonthTable` (do Operacional) são tabelas diferentes de
propósito — colunas diferentes, regra de atribuição diferente. Não force uma só.

---

# 3. Layout e medidas

Largura de conteúdo 1440 (o mockup emoldura com o trilho de 72px). Seções empilhadas com
`gap` de 22px, corpo com `padding: 20px 32px 32px`.

1. **Cabeçalho** — `CRM` 24px Space Grotesk 700; abaixo, a linha do regime de comparação (§5).
2. **Barra fixa** — `position: sticky; top: 0`, `padding: 10px 32px`, `border-top: 1px solid var(--rule)` + `border-bottom: 1px solid var(--border)`, fundo `bg-card`. Quatro controles à esquerda (mês, comparar, pessoa, funil), nota do regime à direita.
3. **Destaques** — grade de `n` colunas iguais (`repeat(n, minmax(0,1fr))`, hoje 2), `gap` 12px, `rounded-2xl`, tinta `emerald`/`rose`/neutra. O bloco só existe quando há destaque: sem base de comparação ele sai inteiro, sem deixar faixa de padding.
4. **Faixa de resumo** — um card, 5 células divididas por `border-left`.
5. **Origem** — um card, largura cheia.
6. **Funil** — card largo da safra (grade interna `1.5fr / 1fr`), depois `1.5fr / 1fr`: passagem entre etapas | perdas.
7. **Pessoas** — `1.5fr / 1fr`: tabela | professores.
8. **Velocidade** — `1fr / 1fr`.
9. **Carteira agora** — `1.5fr / 1fr`: em jogo | sem próximo contato.

As linhas de Funil e de Pessoas usam `align-items: start`: cada card fica com a altura que
tem. Com `stretch` (o padrão do grid) a passagem entre etapas era esticada até a altura de
Perdas e sobravam 290px de card vazio no estado "escolha um funil" — a mesma lição do card
de calendário no Operacional. As linhas de Origem e de Carteira ficam em `stretch` de
propósito: os cards da direita têm rodapé fixado no fim (`margin-top:auto`) e usam a altura.

**Tipografia.** Título de seção 16px SG 700 + pergunta 12,5px `muted`. Título de card 14px
semibold + hint 11,5px `muted`. Rótulo de célula 12px medium `muted`, valor 32px 600
`tracking-tight` (Geist). Número grande de card 34px SG 700. Cabeçalho de tabela 10px 700
`uppercase tracking-[.05em] muted-foreground` — **nunca `slate-400` nesse tamanho**, que dá
2,56:1. Linha de tabela 52px, linha de lista 36 a 40px. Toda coluna de número com `.num`.

**Barras.** Altura 10px (mini), 14px (canal), 16px (passagem), 20 a 24px (marcos, carteira),
34 a 42px (cápsulas segmentadas). Raio 5 a 7px, segmentos separados por `2px` da cor do card.
Histograma com raio só no topo. **Nenhum rótulo dentro do segmento:** texto branco de 11,5px
sobre `success`, `amber-500` ou `slate-400` fica entre 1,9:1 e 2,4:1, e a legenda logo abaixo
já repete nome, contagem e porcentagem de cada faixa. A cápsula é gráfico; o número é texto.

---

# 4. Cores

Tudo por token de `src/index.css`. Nenhum hex novo, nenhuma fonte nova.

| Papel | Token | Claro | Escuro |
| --- | --- | --- | --- |
| Leads, conversão, avanço de etapa, em jogo | `brand-600` | `#2B59FF` | idem |
| Volume de leads (trecho vazio da barra de canal) | `brand-200` | `#B8CCFF` | `brand` a 40% |
| Safras anteriores, faixa lenta do histograma | `brand-300` | `#8FB0FF` | `#C9D8FF` |
| Texto azul sobre tinta | `brand-700` / `brand-300` | `#1C3FC4` | `#8FB0FF` |
| Agendamento | `accent-500` | `#FF6A2B` | `accent-600` |
| Matrícula, contato até 1 hora | `success` | `#15B981` | `#0E9F6E` |
| Contato até 24 horas, etiqueta "incompleto" | `amber-500` | `#F59E0B` | `amber-600` |
| Perda, mais de 24 horas, sem próximo contato | `danger` | `#F43F5E` | `#E11D48` |
| Sem contato, segue na etapa, treina sozinho | `slate-400` | `#94a3b8` | idem |

Regras que o mockup segue:

- **Texto colorido usa o passo 700**, nunca a base: verde é `emerald-700`, vermelho é
  `rose-700`, laranja é `accent-600`, azul é `brand-700`.
- **Informação nunca só por cor.** Toda barra segmentada tem legenda com rótulo e
  contagem; todo segmento tem `aria-label` com nome e número; os deltas trazem ▲/▼ além
  da tinta; a coluna de perda alta fica vermelha **e** continua legível em cinza.
- Verde e vermelho nunca se tocam: na barra de desfecho o azul de "seguem em jogo" fica
  entre os dois.
- **Nada de branco sobre preenchimento médio.** Se um número precisa aparecer, ele sai da
  barra e vai para a legenda ou para a coluna ao lado.
- Ícones Lucide, 12 a 19px, `strokeWidth` 2 a 2,4.

---

# 5. Comportamento

## Mês de competência
Setas andam um mês; a lista abre direto. Cada número pertence ao mês em que o fato
aconteceu (lead pela data de cadastro, agendamento pela data marcada, matrícula pela data
da conversão). Só o mês corrente é "em andamento".

## Comparar
A caixa governa todo o comparativo. Desligada, saem as pílulas de delta das 5 células, os
deltas dos dois cards de velocidade e **o bloco de destaques inteiro** — ele só existe
para narrar mudança, e também desaparece quando a caixa está ligada mas o mês comparado
não tem base (julho contra junho de 2026). Ligada, o padrão é o mês anterior; a lista
aceita meses passados e o
mesmo mês do ano anterior. No mês em andamento a comparação é **pró-rata**: dia 14 contra
os 14 primeiros dias do mês comparado, inclusive para a conversão da safra, que compara
safras **da mesma idade**. Quando o mês comparado não existe na base, o delta lê
**"sem base"**.

## Filtro de pessoa
"Equipe toda" por padrão; todo mundo vê todo mundo. Com uma pessoa, a tela toda passa a
ser dela, a tabela de pessoas reduz a uma linha e ganha o botão "Ver a equipe toda", e
duas coisas **continuam da academia, com etiqueta na cara**:

- **professores** (uma aula é do professor, não do consultor);
- **a mediana por etapa** na passagem entre etapas (etiqueta `mediana da academia`).

Clicar numa linha da tabela filtra; clicar de novo na mesma linha limpa.

## Filtro de funil
Escopa leads, agendamentos, matrículas, safra, canais, perdas, carteira e a tabela de
pessoas. O funil **Indicações** é o funil que o sistema cria para leads indicados
(`lib/referrals.js`), então o corte por funil e o corte por origem "Indicação" são o mesmo
recorte — o mockup usa essa equivalência em vez de autorar dois números que podem
divergir. **Não escopados, e rotulados na seção:** os dois cards de Velocidade (o tempo de
resposta é propriedade do lead, e o mockup só autora o nível da academia — na
implementação calcule por funil e o rótulo sai) e os professores.

## Os três buracos de base
- **Passagem entre etapas e etapa da perda começam em setembro de 2026.** Em mês anterior
  entra um card tracejado explicando, no lugar de colapsar o espaço ou mostrar zero.
- **Agendamentos antes de agosto de 2026 estão incompletos.** As células de Agendamentos e
  Comparecimento ganham a etiqueta âmbar `incompleto`, o delta lê "sem base" quando um dos
  lados não tem base, e a série de 6 meses encurta para os meses com base (em julho ela
  vira o card tracejado "Sem base antes de agosto de 2026").
- **Com uma pessoa filtrada**, as séries encurtam para os três meses modelados e o rótulo
  diz de onde a onde. Nunca a curva da equipe sob o número da pessoa.

## Carregando
**Sem esqueleto.** Ao trocar mês, pessoa ou funil, os números anteriores ficam a 35% de
opacidade até os novos chegarem, com um fio de progresso de 2px sob a barra fixa. A altura
não muda, então nada salta.

## Celular (abaixo de 768px)
Uma coluna. Os quatro controles não cabem em linha: o mês fica visível e comparar, pessoa
e funil entram num painel atrás do botão de filtro (com ponto quando há filtro ativo). O
resumo vira grade de 2 (as sparklines saem). Os destaques viram carrossel **com o pior
primeiro**. As barras de canal empilham rótulo em cima e barra embaixo. A tabela de
pessoas vira lista: nome, conversão em destaque, o resto numa linha de texto. O histograma
mantém as 6 colunas e perde o número de cima. A passagem entre etapas vira lista por
etapa, com as três porcentagens em linha.

---

# 6. A regra herdada do Operacional (§6 do handoff dele)

**Nunca guarde um agregado ao lado do detalhe que o gera.** Aqui o detalhe autorado é
sempre por pessoa e por janela: leads por canal, matrículas da safra por canal,
`[veio, faltou, sem desfecho]`, safra `[agendou, compareceu, matriculou, perdido, em jogo]`,
`[[minutos até o 1º contato, quantos]]`, `[[dias até a matrícula, quantos]]`, perdas por
motivo e por etapa, e o mesmo bloco só do funil Indicações (Vendas = total − Indicações).
A carteira de agora segue a mesma regra: leads em jogo **e** "sem próximo contato" são
autorados por pessoa **e por funil**, porque o card do celular mostrava 23 sem próximo
contato ao lado de uma carteira de 72 quando o número não era escopado.

O painel de celular deste mockup lê as mesmas métricas do quadro de 1440 — inclusive o
destaque e o número de "sem próximo contato". Nada é autorado duas vezes: um valor fixo
ali divergiria do vizinho no primeiro filtro.

Nenhuma taxa e nenhuma mediana é autorada: `metricsOf(monthKey, janela, pessoa, funil)`
calcula, e o mês exibido, o mês comparado, cada ponto de série e cada linha da tabela
chamam a mesma função. As duas coisas que isso evitou nesta tela:

- **conversão por pessoa** ao lado de contagens de equipe (o bug que apareceu quatro vezes
  no Operacional);
- **mediana** somada ou escalada. Mediana não soma: ou vem da lista, ou é rotulada como
  sendo de outro escopo. As duas medianas de escopo diferente têm etiqueta.

No React: `lib/crmMetrics.js` (ou uma extensão de `dashboardMetrics.js`) expõe
`metricsOf(range, { userId, funnelId })`, e a view nunca lê um percentual gravado.

---

# 7. Textos finais

**Título e regime**
- `CRM`
- em andamento, comparando: "1 a 14 de setembro comparado com os 14 primeiros dias de agosto. O mês está em andamento, então a comparação é pró-rata e a conversão da safra ainda vai subir."
- em andamento, sem comparar: "1 a 14 de setembro. O mês está em andamento: a conversão da safra de setembro ainda vai subir."
- fechado: "agosto inteiro comparado com julho. Mês fechado."
- julho acrescenta: "Os agendamentos de julho estão incompletos no histórico."
- nota da barra: "Pró-rata: mesmos 14 primeiros dias de agosto" / "Mês fechado contra mês fechado" / "Sem comparativo · 1 a 14 de setembro" / "setembro 2025 não tem base no sistema"

**Seções**
- `Origem` — "de onde vêm os leads?"
- `Funil` — "onde os leads se perdem?"
- `Pessoas` — "quem converte?"
- `Velocidade` — "com que rapidez o lead é atendido e fecha?"
- `Carteira agora` — "o que está em jogo neste momento?" · etiqueta `AGORA`

**Faixa de resumo** (rótulo · sub-linha)
- "Leads novos" · "Instagram lidera com 22"
- "Agendamentos" · "12 vieram · 5 faltaram · 2 sem desfecho"
- "Comparecimento" · "12 de 17 com data já passada"
- "Matrículas" · "10 da safra de setembro · 19 de safras anteriores" (fechado: "da safra de agosto: 24 já matricularam")
- "Conversão da safra" · "10 de 56 · 40 ainda em jogo"

**Destaques** (só com comparativo e base; o pior primeiro no celular)
- "12 dos 56 leads passaram de 24 horas sem primeiro contato" · "▼ 20,0% · melhor que agosto"
- "Indicação converteu 44%, a melhor taxa entre os canais" · "▲ +11 p.p. · melhor que agosto"
- veredito neutro quando o delta é zero: "= 0 p.p. · igual a agosto", em cinza e com traço no lugar da flecha

**Cards**
- "Canais de origem" · "pela origem do cadastro, ordenado por volume" · legenda "leads" / "matricularam"
- "Safra de setembro" · "os 56 leads cadastrados no mês, acompanhados até hoje" · "Passagem da safra" com "Agendaram / Compareceram" · "Desfecho da safra" com "Matricularam / Seguem em jogo / Perdidos"
- "Passagem entre etapas" · "funil Vendas · movimentos gravados em setembro" · colunas "Etapa / Entraram, avançaram, perderam / Avan. / Perda / Mediana" · legenda "avançou / perdeu / segue na etapa" · rodapé "Maior vazamento: Contato feito, 9 perdidos de 38."
- "Perdas" · "17 leads perdidos em setembro" · eyebrow "Motivo mais comum" · sub-bloco "Etapa em que se perdeu"
- "Conversão por pessoa" · "clique numa linha para filtrar a tela por essa pessoa"
- "Aulas experimentais por professor" · "10 aulas realizadas em setembro" · etiqueta `academia inteira`
- "Tempo até o primeiro contato" · "do cadastro até a primeira interação da equipe" · faixas "Até 1 hora / Até 24 horas / Mais de 24 horas / Sem contato"
- "Dias até a matrícula" · "entre o cadastro do lead e a matrícula"
- "Em jogo por funil" / "Em jogo por etapa" · "87 leads abertos agora"
- "Sem próximo contato" · "23" · "de 87 em jogo" · "Leads em jogo sem data de próximo contato marcada. Eles não aparecem na Meta Diária de ninguém, então ficam parados até alguém abrir a lista." · ação "Abrir a lista no Kanban"

**Vazios e sem base**
- "Nenhum lead perdido neste mês." + "Ninguém marcou perda no período. Se o time descarta sem registrar o motivo, este card fica vazio mesmo com leads saindo do funil."
- "Escolha um funil para ver a passagem entre etapas" + "Cada funil tem as suas etapas, e etapa de funis diferentes não soma. Selecione Vendas ou Indicações na barra de cima."
- "A passagem entre etapas começa em setembro de 2026" + "A troca de etapa passou a ser gravada em setembro de 2026. Antes disso não existe base para dizer quantos avançaram ou se perderam em cada etapa, e inventar o número seria pior que não mostrar."
- etapa da perda sem base: "A etapa da perda só existe a partir de setembro de 2026, quando o sistema passou a gravar a troca de etapa. Em julho os motivos estão completos, a etapa não tem base."
- "A carteira agora só existe no mês em andamento" + "É um retrato deste instante, não um número de julho. Em mês fechado, o que interessa da mesma turma de leads está no desfecho da safra, lá em cima."
- série curta: "Sem base antes de agosto de 2026" / "Três meses de base para esta pessoa"

**Dicas (tooltip)**
- Leads novos: "Leads cadastrados no mês, pela data de cadastro. O filtro de pessoa usa o dono do lead e o de funil, o funil em que ele está."
- Agendamentos: "Visitas e aulas experimentais marcadas para o mês, sem as canceladas. Conta pela data do agendamento, não pela data do cadastro do lead."
- Comparecimento: "Quem veio ÷ quem veio mais quem faltou, entre os agendamentos com data já passada. Agendamento sem desfecho registrado fica fora da conta e aparece na linha de baixo."
- Matrículas: "Leads que viraram cliente no mês, de qualquer safra. É o resultado do mês, não a conversão da turma que entrou no mês."
- Conversão da safra: "Dos leads cadastrados no mês, quantos já matricularam. No mês em andamento ela ainda sobe: quem segue em jogo pode fechar depois. A comparação pró-rata mede a safra do outro mês com a mesma idade."
- Safra (card): "Safra é a turma de leads cadastrados no mês. Os marcos são cumulativos e sempre sobre a mesma turma, então a conta nunca passa de 100%. Um lead que agendou, faltou e matriculou depois conta em agendou e em matriculou, não em compareceu."
- Primeiro contato: "Tempo corrido entre o cadastro do lead e a primeira interação registrada por alguém da equipe. A mediana entra com os leads sem contato no fim da fila, então ela não fica bonita por esconder quem nunca foi atendido."
- Marca de gráfico: "Instagram: 22 leads novos, 3 matricularam (14%)", "Contato feito: 38 entraram, 16 avançaram, 9 se perderam, 13 seguem na etapa. Mediana de 4 dias na etapa.", "Perdidos na etapa Contato feito: 7 de 17", "Até 1 hora: 21 leads de 56 (38%)", "4 a 7 dias entre cadastro e matrícula: 8 de 29 matrículas (28%)", "Funil Vendas: 72 leads em jogo agora".

---

# 8. Números que eu sugeri, e de onde vêm

Nenhum número exige campo novo no Firestore. Os quatro que não estavam na sua lista são
combinações do que já existe:

| Número na tela | De onde vem |
| --- | --- |
| Matrículas da safra do mês × de safras anteriores | `computeDashboardStats` já devolve `convertidosDaSafra` e `convertidosAntigos`. É a sub-linha da célula Matrículas. |
| Leads acima de 24 horas sem primeiro contato (5 + 7 = 12) | Soma das duas últimas faixas da distribuição de tempo até o primeiro contato. Em nenhum card ela aparece somada, e é o primeiro destaque. |
| Maior vazamento do funil | A etapa com maior perdidos ÷ entraram na passagem entre etapas. |

Uma coisa eu **não** desenhei por falta de dado confiável e vale conversar: **ranking de
indicadores** (qual aluno traz mais indicados que fecham). O vínculo existe —
`lib/referrals.js` liga o lead indicado ao aluno indicador — então o card seria "melhores
divulgadores: nome, indicados, matriculados". Ficou fora porque premiar indicador é
assunto de campanha, não de diagnóstico de funil, e a seção Origem já responde a pergunta
do mês. Se quiser, entra como quarto card da Origem.

---

# 9. Sobreposição com o Gerencial

`DashboardGerencialView.jsx` hoje mostra **Motivos de perda**, **Canais** e **Aulas por
modalidade** com `BreakdownCard`, além de conversão por consultor e por professor. Esses
cinco blocos são exatamente o miolo desta tela. Quando o CRM entrar, o Gerencial fica sem
papel definido até a próxima rodada — a recomendação é **mover, não duplicar**: os números
de funil, canal, perda e professor passam a viver no CRM, e o Gerencial fica para a leitura
de negócio de período livre (comparações longas, R$, unidades), que é o que esta tela não
faz. Manter os dois iguais garante que vão divergir.

---

# 10. Dados do mockup

4 pessoas: Ana Ribeiro, Diego Santos, Larissa Moura (consultores) e Marcos Lima (gestor
que também vende). 4 professores: Paula Nunes, Rafael Costa, Bianca Alves e a linha de
referência "Treina sozinho". Três meses: julho e agosto fechados, setembro em andamento
até o dia 14. Dois funis: Vendas (5 etapas) e Indicações (3 etapas).

Setembro, equipe, até o dia 14: 56 leads novos, 19 agendamentos, 71% de comparecimento,
29 matrículas, conversão da safra 18% (10 de 56, 40 em jogo, 6 perdidos), primeiro contato
em 2 h 10 min de mediana com 38% até 1 hora, 6 dias de mediana até a matrícula, 17 perdas,
87 leads em jogo agora e 23 sem próximo contato.

Canais: Instagram 22 leads e 3 matrículas (14%), Passante 13 e 1 (8%), Indicação 9 e 4
(44%), Site 7 e 2 (29%), Outros 5 e 0.

A fonte de cada número é sempre o detalhe por pessoa. Troque por dados reais — a estrutura
é a mesma.
