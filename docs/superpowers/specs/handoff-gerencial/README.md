# Handoff — tela Gerencial (Visão geral) · v2

Substitui a página "Em breve" da aba Gerencial
(`src/views/dashboard/DashboardComingSoonView.jsx`).

## Sobre os arquivos

`Gerencial.dc.html` é um **protótipo em HTML de referência**, não código para colar.
A tarefa é recriar a tela no ambiente do codebase (React + Tailwind + shadcn, com
`DashPrimitives` / `dashTokens`), usando os padrões e componentes que já existem.
Abra o arquivo no navegador (precisa do `support.js` ao lado) e use os filtros: todos
os estados abaixo são alcançáveis por eles.

**Fidelidade: alta.** Cores, tipografia, espaçamentos e comportamento são finais.

| Estado | Como chegar |
| --- | --- |
| Mês em andamento contra agosto (pró-rata) | padrão (Setembro 2026, Unidade Centro) |
| Mês fechado | Período → Agosto ou Julho 2026 |
| Sem comparação | Comparar com → Sem comparação |
| Base com 494 importados sem valor | Unidade → Unidade Moinhos |
| Mês sem venda, carteira cheia | Período → Maio 2026 |
| Academia sem contrato nenhum | Unidade → Unidade Nova |
| Tema escuro | botão de lua no cabeçalho |

## O que mudou em relação à v1

- **Menos texto.** Saíram as perguntas de seção, notas de rodapé de card, dicas "?" e
  a leitura em texto do ranking. Cada card tem só título + dado. Explicações ficam no
  tooltip das marcas (§5).
- **Hierarquia por importância.** Os 4 números principais no topo; detalhe de venda no
  meio; risco detalhado; planos e origem por último.
- **Gráficos de pizza** em três formatos: rosca (tipo de venda), pizza cheia (planos),
  meia-rosca (origem).
- **Barra de filtros igual à de Relatórios** (mesmo componente; ver §3).
- Ranking de consultores perdeu a coluna "Ticket da venda" (fica só ticket mensal).
- Removidos da tela: faixa de 4 células da carteira, cartão "N pessoas sem valor",
  notas tracejadas, chip longo de aviso (virou etiqueta "não é caixa").

---

## 1. Layout

Quadro de 1440px: trilho lateral 72px (`card`, borda direita) + `main`.

```
┌ header 72px ─ "Gerencial" + subline ─────────────── [tema] ┐
├ barra de filtros (sticky top:0, fundo bg) ─────────────────┤
│ [‹ 📅 Setembro 2026 ⌄ ›] │ (Comparar com Agosto 2026 ⌄) (Unidade Centro ⌄)
├────────────────────────────────────────────────────────────┤
│ L1  KPIs: grid 1.35fr | 1fr | 1fr | 1fr, gap 16           │
│     Vendido no mês · Carteira mensal · Em risco 90d · Vencidos sem renovar
│ L2  grid 1fr | 1.25fr  → Vendas por tipo (rosca) | Consultores
│ L3  grid 1.25fr | 1fr  → Vencimentos | Saídas do mês
│ L4  grid 1fr | 1fr     → Planos (pizza) | Origem das vendas (meia-rosca)
└────────────────────────────────────────────────────────────┘
```

- Conteúdo: padding `20px 32px 32px`; linhas empilhadas com `gap 20px`.
- Card padrão: `border 1px var(--border)`, `radius 16px`, `bg card`,
  `shadow-card`, padding `20px 22px`. Título de card: Space Grotesk 700 15px,
  `tracking -.01em`. → `DashCard`.
- Cabeçalho: altura 72, padding `0 32px`, `bg card`, borda inferior. Título Space
  Grotesk 700 22px; subline Geist 12px `muted`. Botão de tema 38×38, radius 12, ícone
  Lucide `Moon` 16px.

## 2. Componentes por linha

### L1 · KPIs
Rótulo: Geist 700 11px, `uppercase`, `tracking .08em`, `muted`.

| Card | Valor | Linha de apoio |
| --- | --- | --- |
| **Vendido no mês** (`border-top 3px brand`) | Space Grotesk 700 **40px**, `tracking -.035em` + pílula de delta (24px alt., radius 8, `green-t`/`green-700` ou `red-t`/`red-700`, "▲ 9%"; `title` = base de comparação). Etiqueta "não é caixa" à direita do rótulo: 10.5px 600, `amber-t` / `amber-700`, pílula | "42 contratos · ticket R$ 214/mês" |
| Carteira mensal | Space Grotesk 700 30px + "/mês" 13px 600 `muted` | "628 contratos · 19 trancados" |
| Em risco · 90 dias | 30px `amber-700` + "/mês" `amber-700` | "26% da carteira" |
| Vencidos sem renovar | 30px `red-700` | "contratos para recuperar" |

Apoio: Geist 12.5px `muted`, `tabular-nums`. Valor da carteira usa formato curto
("R$ 134,2 mil").

### L2 · Vendas por tipo (rosca)
- Cabeçalho: título + à direita "desconto **8%**" (12px; valor `amber-700` se ≥ 12%).
- Rosca 148×148: `conic-gradient` com os 4 tipos; furo `inset 22px` na cor do card;
  no centro "42" (Space Grotesk 700 22px) + "contratos" (11px `muted`).
- Legenda à direita (gap 24): linhas de 8px de padding com régua `rule` em cima —
  quadrado 9px radius 3 · rótulo 13px · % 12px `muted` (36px) · valor Space Grotesk
  700 13.5px (80px, à direita).
- Clawback (se houver): linha abaixo com régua, ícone `RotateCcw` 14px, 12px
  `red-700`: "2 vendas já canceladas · R$ 3.100".

### L2 · Consultores
- Cabeçalho: título + colunas "VENDAS" (60px) e "TICKET/MÊS" (90px), 10px versalete.
- Linha (padding 11px 0, régua `rule`): avatar 32px círculo `brand-50`/`brand-700`
  com iniciais 11px 700 · nome 13px 600 + valor Space Grotesk 700 14px na mesma linha
  · barra 6px radius 999 (`soft2` de fundo; líder `brand`, demais `brand-200`) ·
  vendas 13px 600 · ticket mensal 13px 600.

### L3 · Vencimentos
- Cabeçalho: título + "168 contratos" (12px `muted`, **nowrap**).
- 3 linhas (gap 14): rótulo 78px ("Em 30 dias") · barra 10px `amber` radius 999
  (largura ∝ valor, máx 74%) · valor Space Grotesk 700 13.5px `amber-700` (92px).
- Contratos sem valor: trilha anexa, mesma altura, **borda 1.5px tracejada `slate`**,
  sem preenchimento; abaixo, legenda "114 contratos importados sem valor". Só aparece
  quando há importados (Unidade Moinhos).

### L3 · Saídas do mês
- Cabeçalho: título + "R$ 2.300/mês".
- Linhas: rótulo 110px · barra 10px (`red` cancelamento, `amber` trancamento) ·
  contagem 13px 700 na cor do tom.

### L4 · Planos (pizza) e Origem das vendas (meia-rosca)
- Planos: pizza cheia 140×140 via `conic-gradient`.
- Origem: meia-rosca 180×90 (círculo de 180 cortado na metade, `conic-gradient` a
  partir de -90°, metade transparente; furo de 120px). No centro-base: % do líder
  (Space Grotesk 700 18px) + nome do líder (10.5px `muted`).
- Legenda igual à da rosca (bolinha 9px). Paleta `BREAKDOWN_PALETTE`:
  claro `accent, brand, #0E1A40, #94a3b8, green`; escuro `accent, brand-500, #94a3b8, #475569, green`.
- Na implementação, use **Recharts `PieChart`** (ou o que o projeto já tiver) com
  `innerRadius` para rosca e `startAngle 180 / endAngle 0` para meia-rosca, em vez de
  `conic-gradient`. Separador entre fatias: stroke 2px cor do card.

## 3. Barra de filtros (mesma de Relatórios)

Reaproveite o componente da barra de Relatórios — se ainda não for compartilhado,
extraia como `DashFilterBar` e use nas duas telas.

- Contêiner: `sticky top-0 z-20`, `bg var(--bg)`, `padding-bottom 14px`, borda
  inferior 1px, `margin-bottom 22px`, `gap 8px`.
- **Período**: caixa 38px, radius 12, borda, `bg card`, `shadow-card`, padding 3.
  Setas 30×30 radius 9 (desabilitadas a 35% nos extremos). Botão central: ícone
  `Calendar` 14px `brand` + "Setembro 2026" 13px 600 + `ChevronDown` 13px.
  Abre popover (top 46px, 240px, radius 14, `shadow-card-lg`) com versalete "MÊS" e a
  lista de meses; selecionado em `brand-50`/`brand-700` com check; "em andamento" à
  direita em 11px `muted`.
- Divisor vertical 1×22px `border`.
- **Chips de filtro** (pílula 36px, radius 999, padding 0 12): ícone 14px · rótulo
  500 `muted` · valor 600 · `ChevronDown` 12px. Ativo (fora do padrão): borda
  `brand-200`, fundo `brand-50`, valor `brand-700`, ícone `brand`. Popover: top 44px,
  min 236px, radius 14, itens 34px com rádio 16px.
  - **Comparar com** (ícone `LineChart`): meses anteriores com venda + régua +
    "Sem comparação". Ativo enquanto houver comparação.
  - **Unidade** (ícone `Building2`): lista de academias. Ativo quando ≠ unidade padrão.
- Ao escolher uma opção o popover fecha. Clique fora fecha (o protótipo não faz;
  use o `Popover` do shadcn).
- Quando não há mês anterior com venda, o chip "Comparar com" lista só "Sem comparação".

## 4. Comportamento

- **Venda conta no mês em que o contrato foi fechado.**
- Mês em andamento: comparação **pró-rata** (dia 17 contra os 17 primeiros dias do
  mês comparado). Subline: "1 a 17 de setembro · vs. mesmos dias de agosto". Mês
  fechado: "agosto inteiro · vs. julho". Sem comparar: "1 a 17 de setembro · em
  andamento".
- Sem comparação: some a pílula de delta.
- **`gymEmpty`** (academia sem contrato): corpo inteiro vira um card único "Ainda não
  há contratos" + botão "Ir para o pipeline" (40px, `brand`, radius 12).
- **`monthNoSales`**: L2 e L4 saem, entra card "Nenhum contrato fechado neste mês".
  KPIs de carteira/risco e L3 continuam (olham contratos vigentes).
- **Duas moedas**: "Vendido" é valor de contrato inteiro; carteira, risco e saídas são
  por mês. O sufixo `/mês` nunca se separa do número.
- Celular (< 768px): uma coluna; KPIs em 2×2 com "Vendido" ocupando a linha toda;
  rosca/pizza ficam acima da legenda; barra de filtros vira um botão que abre um
  painel com período, comparação e unidade.

## 5. Tooltips

Toda marca de gráfico (fatias, barras, trilhas tracejadas) tem dica no hover **e no
foco**. O protótipo usa `title`; em produção use `Tooltip` do shadcn em elementos
focáveis. Conteúdo: "Matrícula nova: 21 contratos · R$ 34.700 · 44% do vendido",
"Em 30 dias: 63 contratos valendo R$ 13.100 por mês", etc. (ver `title` no HTML).
Foco visível: `outline 2px brand, offset 2px`.

## 6. Design tokens

| Token | Claro | Escuro |
| --- | --- | --- |
| `--bg` | `#F5F7FB` | `#080D22` |
| `--card` | `#FFFFFF` | `#122142` |
| `--fg` / `--fg2` | `#0E1A40` / `#334155` | `#EAEEF9` / `#CBD5E1` |
| `--muted` / `--faint` | `#64748b` / `#94a3b8` | `#8A93B0` / `#6B7593` |
| `--border` / `--rule` | `#e2e8f0` / `#eef2f7` | `rgba(255,255,255,.08)` / `.06` |
| `--soft2` (trilho de barra) | `#eef0f5` | `rgba(255,255,255,.07)` |
| `--brand` / `-50` / `-200` / `-700` | `#2B59FF` / `#EAF0FF` / `#B8CCFF` / `#1C3FC4` | `#2B59FF` / `rgba(43,89,255,.18)` / `.36` / `#8FB0FF` |
| `--accent` | `#FF6A2B` | `#F2541A` |
| `--green` / `-700` / `-t` | `#15B981` / `#047857` / `rgba(21,185,129,.10)` | `#0E9F6E` / `#34D399` / `.18` |
| `--red` / `-700` / `-t` | `#F43F5E` / `#BE123C` / `rgba(244,63,94,.09)` | `#E11D48` / `#FB7185` / `.18` |
| `--amber` / `-700` / `-t` | `#F59E0B` / `#B45309` / `rgba(245,158,11,.12)` | `#D97706` / `#FBBF24` / `.20` |
| `--violet` (upgrade) | `#8B5CF6` | idem |
| `--slate` (retorno, sem valor) | `#94a3b8` | `#6B7593` |
| `--shadow-card` | `0 1px 0 rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.06)` | `0 1px 0 rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-card-lg` | `0 1px 0 rgba(15,23,42,.04), 0 8px 24px -8px rgba(15,23,42,.10)` | `0 8px 24px -8px rgba(0,0,0,.6)` |

Tipos de venda: Matrícula nova `brand` · Renovação `green` · Upgrade `violet` ·
Retorno de ex-cliente `slate`.

- Fontes: **Space Grotesk** 500–700 (números grandes, títulos) e **Geist** 400–700
  (resto). Todo número com `tabular-nums`.
- Radius: 16 (card), 12 (controles), 9 (itens de menu), 999 (pílulas, barras).
- Espaçamento: gaps 8 / 10 / 14 / 16 / 20 / 24.
- Ícones: Lucide, stroke 2–2.2.
- Texto colorido usa o passo 700, nunca a base.

## 7. Regras de dados

- **Nunca guarde um agregado ao lado do detalhe.** Ticket médio, % em risco,
  participação e todo % de gráfico saem de `lib/gerencialMetrics.js`, calculados a
  partir dos contratos.
- **Contratos sem valor não entram no denominador do ticket médio** (Moinhos: R$
  134.200 ÷ 628, não ÷ 1.122) e nunca somam em valor por mês.
- **Ticket mensal por consultor** = vendido ÷ vendas ÷ duração média do plano vendido.
  O protótipo usa `AVG_MONTHS` fixo como stand-in: ⚠ substitua por consulta real ou
  remova a coluna.
- % em risco = soma dos 3 horizontes ÷ valor por mês da carteira.

## 8. Dados do protótipo

Consultores: Ana Ribeiro, Diego Santos, Larissa Moura e Marcos Lima (gestor que
também vende). Meses: maio (sem venda, antes do sistema), junho, julho, agosto
fechados; setembro em andamento até o dia 17. Academias: Centro (base limpa), Moinhos
(494 importados sem valor), Nova (sem contrato).

Setembro, Centro: R$ 78.400 em 42 contratos contra R$ 71.900 nos mesmos dias de
agosto (▲ 9%); ticket R$ 214/mês; desconto 8%; 21 novas, 14 renovações, 5 upgrades,
2 retornos; 2 já canceladas (R$ 3.100). Carteira 628 contratos, R$ 134.200/mês, 19
trancados. Risco 63 / 48 / 57 contratos, R$ 13.100 / 9.800 / 11.400 por mês; 29 já
vencidos; saídas 7 cancelamentos e 4 trancamentos (R$ 2.300/mês).

## Arquivos

- `Gerencial.dc.html` — protótipo (template + lógica `renderVals()` com todos os
  cálculos e dados de exemplo no fim do arquivo).
- `support.js` — runtime para abrir o protótipo localmente.
