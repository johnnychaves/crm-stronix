# Interface e design

Como a tela do STRONILEAD é construída. As tabelas de estilo e os tokens vivem em `src/index.css`. As regras de comportamento de cada tela estão no `CLAUDE.md`.

## Identidade

| Item | Valor |
|---|---|
| Fonte dos títulos | Space Grotesk (`--font-display`) |
| Fonte do corpo | Geist, com Inter de reserva (`--font-sans`) |
| Azul primário | `#2B59FF` (`brand-600`), botões, links, seleção |
| Laranja de destaque | `#FF6A2B` (`accent-500`), chamada principal e selos |
| Fundo escuro | `ink-950`, com cards em overlays translúcidos de branco |
| Ícones | lucide-react |

O ramp laranja do app é `accent-50` a `accent-600`, sempre com sufixo numérico. `bg-accent` puro é o token semântico do shadcn (hover suave) e não é o laranja.

## Componentes

- **shadcn/ui**, estilo `new-york`, ícones lucide, alias `@/` para `src/`. Os componentes base ficam em `src/components/ui/` com nome em minúsculas (`button.jsx`, `dialog.jsx`, `tabs.jsx`).
- **Primitivo novo e complexo** (modal, menu, tooltip, tabs, combobox) usa componente shadcn (`npx shadcn@latest add`) e a skill `shadcn`, não se constrói à mão.
- **Não adicionar via shadcn:** `avatar` e `skeleton`. Colidem com `src/components/ui/Avatar.jsx` e `src/components/ui/Skeleton.jsx` do app em sistema de arquivos que não diferencia maiúsculas.
- **Legado:** `Btn`, `SettingsCard`, `Field` e as telas antigas seguem como estão. Migram para shadcn quando a tela passar por redesign.
- **Classes:** `cn()` de `@/lib/utils` para condicionais, tokens semânticos (`bg-background`, `text-muted-foreground`, `border-border`) em código novo, `flex gap-*` no lugar de `space-*` e `size-N` no lugar de `w-N h-N`.
- **Raios:** os `rounded-*` do Tailwind não foram redefinidos, para não mudar o visual atual.

## Como se desenha uma tela nova

1. Comece pela skill `frontend-design`.
2. Redesign apresenta 2 ou 3 mockups antes de virar código.
3. Reuse os tokens e componentes acima. Cor e espaçamento nunca vão soltos.
4. Revise com `web-design-guidelines` antes de concluir (foco, teclado, formulário, estados vazios e de erro).
5. Texto da tela passa pelo humanizer e fica em português, direto.

## Acessibilidade e comportamento

Regras já praticadas, que valem para tela nova:

- Erro de campo em região viva educada (`aria-live="polite"`) presente desde o primeiro render, e foco no primeiro campo com erro.
- Erro fora de campo com `role="alert"` e aviso com `role="status"`.
- Janela (`Dialog`, do Radix) devolve o foco ao elemento que a abriu. Na apresentação das Rotinas, o foco inicial vai ao botão principal, porque o primeiro focável seria decorativo. Faça o mesmo onde essa situação se repetir.
- Animação de entrada com `motion-reduce:` e sem a classe `fade-in` solta do `index.css` (ela vence o `motion-reduce`).
- Rolador horizontal leva `overscroll-x-contain`.
- Abrir ficha é `<a href>`, para Ctrl+clique e "Abrir em nova aba" funcionarem.
- Dado pessoal não entra em `title`, `alt` nem no título da aba.

## Estados e dados na tela

- Tela de lista e de painel guarda filtro, mês e sub-tela no endereço (`src/lib/screenParams.js`), então F5 e o link colado mantêm o recorte.
- Leitura de dados obedece ao portão de inatividade (`listenersActive`): sem ninguém na tela, as assinaturas param.
- Erro de render fora do conteúdo é coberto por `ModalErrorBoundary`, `SilentErrorBoundary` e `ScreenErrorBoundary` (`src/components/ErrorBoundary.jsx`).

## Celular

A tela funciona no celular, mas o layout mobile está em segundo plano por decisão do Johnny (28/09/2026). Não abra tarefa mobile por conta própria. O que já existe, como o menu em gaveta e o rodapé que quebra linha, segue valendo.

## Quando não se aplica

Funções de `api/`, scripts e módulos de `src/lib/` sem tela não têm critério visual.
