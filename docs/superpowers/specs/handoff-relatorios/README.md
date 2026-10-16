# Handoff — Relatórios de leads

Redesenho da tela de Relatórios da branch `claude/relatorios-de-leads-pr2`
(`src/views/relatorios/`), seguindo a spec
`docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md`.

O mockup é **especificação visual e de comportamento**, não código para colar. Abra
`Relatorios.dc.html` e mexa: abra o grupo Leads na lista ao lado e troque de relatório,
mude o período e os filtros, clique numa célula do painel ou numa linha de recorte
para filtrar a lista, e exporte.

As contas da spec **não mudam**. Tudo continua saindo de `src/lib/relatorios/leads/`;
só a apresentação muda.

---

# 1. O que mudou e por quê

| Antes (branch) | Agora | Motivo |
| --- | --- | --- |
| Lista ao lado com 5 itens soltos | **Grupo "Leads" recolhível**, fechado por padrão, com o relatório aberto escrito embaixo | O menu vai ganhar outros grupos; agrupar já agora evita refazer. |
| Item com nome + texto de apoio | Só o nome e o número principal | O número já diz o que o relatório mede. |
| Um número grande + 6 cartões soltos de 96px | **Um painel só**: herói à esquerda, células divididas à direita | Os números são do mesmo período e da mesma base; o desenho diz isso. |
| Células da Conversão independentes | Safra → Agendaram → Vieram → Matricularam **ligadas por seta** | São etapas da mesma safra. "Perderam" e "Em aberto" ficam depois de uma régua: não são etapa. |
| 3 cartões de recorte lado a lado | **Recortes em abas**, um por vez, largura inteira | O próprio código registra ~33px para o nome a 1280. |
| Situação em texto colorido | **Selo com texto escrito** (ponto + rótulo) | Informação nunca só pela cor. |
| Entrada e Perdas: só o total | Total + **gráfico por dia** | Não é número novo: é o mesmo total distribuído. Opcional, ver §6. |
| Visitas e aulas sem professor | Aba **Por professor**, a segunda do relatório | Mostra quantas aulas cada professor deu e quantos desses leads matricularam depois. |

---

# 2. Componentes

## Reusar

| Componente | Onde |
| --- | --- |
| `DashCard` (DashPrimitives) | casca do painel, dos recortes e da lista |
| `DashHelpTip` (DashPrimitives) | "?" das métricas, se quiser manter |
| `Tooltip` (components/ui) | barras do gráfico por dia e linhas de recorte. O mockup usa `title`, que **não dispara no foco do teclado**; na implementação cada marca é focável dentro de `Tooltip`. |
| `Popover` (components/ui) | menus de período e dos filtros. O mockup desenha à mão. |
| `Tabs` (components/ui) | abas de recorte (`role="tablist"` já no mockup) |
| `Checkbox` / `RadioGroup` (components/ui) | opções dos filtros: Consultor é múltipla escolha, Origem e Funil são escolha única |
| `RelatoriosToolbar`, `RelatoriosRail` (branch) | **editar**, não recriar |
| `relatoriosRail.js` (branch) | continua sendo a fonte da lista ao lado; acrescenta o grupo |

## Novos ou reescritos

| Peça | O que é |
| --- | --- |
| `RailGroup` | cabeçalho recolhível do grupo (ícone 34px, título, resumo, chevron) + filhos |
| `ReportBand` | o painel de números: herói + células ou herói + gráfico |
| `BandCell` | uma célula clicável (rótulo, valor, pílula ou nota, barra ativa de 3px no topo) |
| `DayBars` | gráfico de colunas por dia |
| `CutTabs` | abas de recorte com linhas de contagem ou de conversão |
| `StatusPill` | selo de situação |

---

# 3. Medidas

Conteúdo em grade `248px | 1fr` com `gap` 28px; a lista ao lado é `sticky top-6`.

**Grupo da lista ao lado**
- Cabeçalho: botão sem borda e sem fundo (`hover: bg-muted`), `rounded-[14px]`,
  `px-[11px] py-[10px]`, ícone `Users` em quadrado 34px `rounded-[10px]` `bg-brand-50`
  `text-brand-700`; título 13.5px/700; resumo 11.5px `muted` ("Aberto: Conversão" quando
  fechado, "5 relatórios" quando aberto); chevron 15px que gira 180°.
- Filhos: recuo `ml-4 pl-2.5` com `border-l-2 border-border`, `gap` 4px.
- **Transição**: o contêiner é `grid` com `grid-template-rows` de `0fr` para `1fr`
  (0.28s ease) e `opacity` de 0 para 1 (0.22s); o filho direto tem `min-h-0
  overflow-hidden`. Fechado, recebe `inert` para sair da ordem de foco. Respeite
  `prefers-reduced-motion` zerando as duas durações.
- Item: `rounded-[14px]`, ícone 34px; ativo fica com `bg-card border shadow`, ícone
  `bg-brand` branco e número `text-brand-700`. Número em Space Grotesk 13px/700.

**Barra de cima** — `sticky top-0`, `pb-3.5 mb-5.5 border-b`. Período em caixa de 38px
`rounded-xl` com setas só no modo Mês; filtros em pílulas de 36px `rounded-full`, que
ficam `bg-brand-50 border-brand-200 text-brand-700` quando ativos. Em Leads parados, o
período é trocado pelo segmentado "Sem registro há mais de 3 · 7 · 15 · 30 dias".

**Painel** — herói com 236px: rótulo 12px/600 `muted`, valor 42px Space Grotesk 700
`tracking-[-.035em]`, pílula de delta 20px. Células `flex-1`, `pt-[18px] px-3.5
pb-3.5`, valor 27px Space Grotesk 700; ativa com `bg-brand-50` e barra de 3px
`bg-brand` no topo. Seta entre etapas: 14px, `ChevronRight` 12px `slate-400`.

**Recortes** — abas em trilho `bg-muted rounded-[11px] p-[3px]`; linha em grade
`1.15fr | 2fr | 48px | 44px` (nome, barra 10px, número, fatia). Conversão:
`1.15fr | 60px | 60px | 1.6fr | 44px` (nome, leads, matrículas, barra verde, %).

**Aba Por professor** (Visitas e aulas) — usa a grade de conversão. A primeira coluna
de número se chama **Aulas**, não "Leads": cada linha conta aulas experimentais que
aconteceram. A sub-linha mostra a modalidade; quem treinou sem professor ("Treina
sozinho" no dado) aparece como "Treinou sozinho · sem professor".

**Lista** — cabeçalho com total em 23px Space Grotesk; chip do recorte ativo com X;
cabeçalho de coluna em versalete 9.5px/700 `muted` sobre `bg-muted/50`; linhas de 46px;
"Mostrar mais 50" no pé. Vazio em caixa tracejada.

**Cores** — só tokens já existentes: `brand`, `emerald` (veio, matriculou),
`rose` (faltou, perdeu, atrasado), `amber` (sem desfecho, sem próximo passo),
`slate` (em aberto). Texto colorido sempre no passo 700; versalete é `muted`, nunca
`slate-400`.

---

# 4. Comportamento

- **Grupo**: fechado ao abrir a tela. O relatório aberto aparece escrito no resumo.
- **Trocar de relatório** limpa o recorte da lista e volta à primeira aba.
- **Período e filtros** valem para os cinco relatórios e para os números da lista ao
  lado. Mudar qualquer um volta a lista aos 50 primeiros.
- **Célula do painel e linha de recorte** filtram a lista; clicar de novo limpa. O chip
  acima da lista diz o que está filtrado. Recorte que deixou de existir com a troca de
  período é ignorado.
- **Por professor conta só as aulas em que o lead veio.** Falta não depende do professor
  e não pesa contra ele. O filtro da lista usa **a mesma regra**:
  `professor === v && attend === 'veio'`. Se a linha e a lista usarem regras
  diferentes, a linha mostra 5 e a lista mostra 6 — foi o bug corrigido no mockup.
  O chip da lista diz "Professor: Bianca Alves".
- **Comparado**: período anterior do mesmo tamanho; no Mês, o mês anterior cortado no
  mesmo dia. Leads parados é retrato de agora e não tem comparado.
- **Avisos da spec** (visitas antes de 18/08, etapa da perda antes de 14/09, perda que
  voltou ao funil) aparecem em faixa âmbar sob o painel, só quando o período toca a
  data.
- **Exportar** gera o CSV da lista **com o recorte aplicado**; desabilita com zero linhas.

---

# 5. Textos

Aba de professor: "Por professor" · dica "só aulas experimentais · quantos matricularam
depois da aula · clique numa linha para filtrar a lista".

Itens: Entrada de leads · Conversão · Visitas e aulas · Perdas · Leads parados.
Títulos e perguntas de cada relatório: os do mockup (`SECS` na lógica).
Vazios: "Nada neste período." / "Ninguém neste filtro." / "Nenhum lead parado." com
"Escolha outro período ou limpe os filtros da barra." ou "Limpe o filtro da lista para
ver todos."

---

# 6. A decidir

- **Gráfico por dia** em Entrada e Perdas não estava na spec. Se sair, o herói ocupa
  a largura com o total e a pílula.
- O mockup usa uma base sintética de ~300 leads; os números não são da academia.

# 7. Regra herdada das outras telas

Nenhum total gravado ao lado do detalhe. O número da lista ao lado, o herói, as
células e os recortes saem das mesmas funções da branch sobre a mesma base filtrada.
