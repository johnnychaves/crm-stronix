# Busca global fixa no header (leads e clientes)

status: ativo
data: 2026-07-08

## Problema

O app não tem mais uma busca rápida no topo. Para achar uma pessoa hoje é
preciso entrar numa tela específica (Leads ou Clientes) e usar os filtros
daquela tela. Falta um jeito único de, de qualquer página, achar uma pessoa
pelo nome, sobrenome, CPF ou telefone, sem se importar se ela é lead ou já
virou cliente.

## Objetivo

Uma barra de busca fixa no header superior, presente em todas as páginas do
app (usuários de academia). A busca acha leads e clientes na mesma lista, por
nome, sobrenome, CPF ou telefone. Cada resultado mostra o avatar com o anel de
identificação do estado da pessoa. Clicar (ou dar Enter) abre a ficha.

Apresentação escolhida: barra sempre visível no header (Opção A da prévia).
No mobile ela colapsa numa lupa que expande a barra sobre o header.

## Fora de escopo

- Busca no servidor ou índice no Firestore. A busca roda 100% em memória sobre
  o array `leads` que o app já carrega. Nada de mudança em regras do Firestore.
- Mexer nas telas Leads/Clientes, nos filtros delas ou no `ContractRingAvatar`
  da lista de Clientes.
- Busca com tolerância a erro de digitação (fuzzy). Só normalização
  (minúsculas, sem acento) e comparação por trecho.
- Histórico de buscas recentes. Fica para depois.

## Fatos do código que a implementação respeita

- O array `leads` (carregado uma vez em `App.jsx` via `onSnapshot`) contém
  leads E clientes. Cliente é um lead com `lifecycleStage === 'cliente'` (ou
  `isLeadConverted(l)` para os legados de 'Venda').
- Campos por pessoa: `name` (nome completo, o sobrenome é só um token dentro
  dele), `whatsapp` (telefone), `cpf`, `email`.
- Abrir a ficha de qualquer lugar já funciona: `openProfile(id)` vem do
  `LeadProfileContext`, provido no nível do `App`.
- O estado de ciclo de vida da pessoa e o tom do anel vêm de
  `deriveLeadState(lead, refDate, thresholdDays)` em `src/lib/leadState.js`,
  que retorna `{ key, tone, label, hint }`. Os tons e o hex de cada um saem de
  `getTone(toneName)` (mesmo arquivo).
- O perfil desenha o anel com:
  `RingAvatar name={lead.name} size={64} toneName={state.tone}
  splitHex={state.key === 'a_vencer' ? '#10B981' : null}`.
  O `splitHex` é o que faz o anel "metade âmbar, metade verde" do estado
  "a vencer". A busca reproduz essa mesma convenção, numa versão compacta.
- `onlyDigits` existe hoje só como helper local em `AddLeadModal.jsx`
  (`s => String(s||'').replace(/\D/g,'')`). A busca ganha a sua própria cópia
  no módulo puro novo, sem depender do modal.
- `contractThresholdDays` (janela de "a vencer") vem de `useGeneralConfig()`.

## Arquitetura

Três arquivos novos e uma ligação no `App.jsx`. Cada unidade tem um propósito
só e é entendível isolada.

### 1. `src/lib/globalSearch.js` (puro, testável)

Sem React, sem Firestore. Exporta:

- `onlyDigits(s)`: só os dígitos de uma string.
- `normalize(s)`: minúsculas e sem acento, preservando o tamanho caractere a
  caractere (cada char vira exatamente um char), para que a posição do trecho
  encontrado no nome normalizado aponte para a mesma posição no nome original.
  Implementação por char: `.normalize('NFD').replace(/[̀-ͯ]/g,'')`
  seguido de `.toLowerCase()`.
- `searchPeople(leads, query, { limit = 8 })`: retorna
  `{ results, total }`.

Regras do `searchPeople`:

- `qNorm = normalize(query.trim())`, `qDigits = onlyDigits(query)`.
- Dispara a busca por nome quando `qNorm.length >= 2`. Dispara a busca por
  telefone/CPF quando `qDigits.length >= 3` (abaixo disso os dígitos casariam
  com quase tudo, tipo DDD). Se nenhuma condição vale, retorna
  `{ results: [], total: 0 }`.
- Para cada lead, deriva: `nameNorm = normalize(name)`, os tokens de
  `nameNorm` (split por espaço), `phoneDigits = onlyDigits(whatsapp)`,
  `cpfDigits = onlyDigits(cpf)`.
- Camadas de acerto (a menor camada que a pessoa atinge vira o rank dela):
  - 0: algum token do nome começa com `qNorm` (prefixo de nome ou sobrenome).
  - 1: `nameNorm` contém `qNorm` em qualquer posição.
  - 2: `qDigits.length >= 3` e `phoneDigits` contém `qDigits`.
  - 3: `qDigits.length >= 3` e `cpfDigits` contém `qDigits`.
- A pessoa entra no resultado se atinge qualquer camada. Ordena por camada
  crescente e desempata por `name.localeCompare(b.name, 'pt-BR')`.
- `total` = quantos casaram no total. `results` = os primeiros `limit`.
- Cada item de `results`:
  `{ lead, matchKind: 'name' | 'phone' | 'cpf', matchRange: [start, end] | null }`.
  `matchKind` é o tipo da melhor camada. `matchRange` é o trecho a destacar no
  nome original (só quando `matchKind === 'name'`); nas outras é `null`.

### 2. `src/components/ui/StateRingAvatar.jsx` (apresentacional)

Avatar compacto com o anel de estado. Sem contexto, sem derivação: recebe tudo
pronto para ser puro e reutilizável.

- Props: `{ name, toneName = 'brand', splitHex = null, size = 32 }`.
- `baseHex = getTone(toneName).hex`.
- Fundo do anel: `splitHex` presente vira
  `conic-gradient(${baseHex} 0deg 180deg, ${splitHex} 180deg 360deg)`;
  senão, `baseHex` sólido.
- Estrutura: um `span` externo (padding 2.5, fundo = anel) envolvendo um `span`
  branco (`bg-white dark:bg-neutral-900`, padding 2) que envolve o `Avatar`
  existente (`name`, `size`). Mesma montagem do `ContractRingAvatar` da lista de
  Clientes, mas com a cor vindo do estado de ciclo de vida (então lead fica azul
  e perdido/cancelado fica vermelho, coisas que o anel só-de-contrato não
  cobre). Sem o glow e sem o dot da versão grande do perfil, que pesariam numa
  linha de lista.

### 3. `src/components/layout/GlobalSearch.jsx`

A barra no header e o dropdown de resultados.

- Props: `{ leads, onAddLead }` (`onAddLead` opcional, para o atalho do estado
  vazio).
- Contextos: `useLeadProfile()` para `openProfile`; `useGeneralConfig()` para
  `contractThresholdDays`.
- Estado: `query`, `open` (dropdown aberto), `activeIndex` (item destacado no
  teclado), `mobileOpen` (barra expandida no mobile).
- Derivado (memo em `[leads, query]`):
  `const { results, total } = searchPeople(leads, query, { limit: 8 })`. O
  estado de cada linha sai de `deriveLeadState(lead, new Date(), threshold)`
  na renderização.
- Desktop: input sempre visível (ícone de lupa, placeholder
  "Buscar leads e clientes", dica `⌘K` à direita). Abre o dropdown quando tem
  foco e `query` normalizada tem 2+ caracteres. Dropdown posicionado logo
  abaixo do input.
- Mobile (abaixo de `sm`): no header aparece só um botão de lupa; ao tocar,
  expande uma barra sobre a linha do header com o input e um X para fechar.
- Cada linha do resultado: `StateRingAvatar` + nome (com o `matchRange`
  destacado quando for match por nome) + sub-linha + chip do estado.
  - Sub-linha: telefone formatado. Quando `matchKind === 'cpf'`, mostra o CPF
    mascarado no lugar, para o usuário ver por que aquela pessoa apareceu.
  - Chip: rótulo e tom vindos de `deriveLeadState` (Lead, Cliente ativo, A
    vencer, Inativo, Cancelado, Lead perdido), usando as classes de
    `getTone(state.tone)` (`soft`/`text`/`darkSoft`/`darkText`).
  - Clique na linha: `openProfile(lead.id)`, limpa a busca e fecha.
- Estado vazio (2+ caracteres e zero resultado): texto
  "Nenhum lead ou cliente encontrado" e, se `onAddLead` veio, um botão discreto
  "Cadastrar novo lead".
- Rodapé do dropdown: contador "X de N" quando `total > results.length`.
- Teclado: listener global de `⌘K` / `Ctrl+K` foca o input (com
  `preventDefault`). No input: `ArrowDown`/`ArrowUp` andam no `activeIndex`;
  `Enter` abre o item ativo (ou o primeiro); `Escape` limpa e fecha (no mobile,
  colapsa).
- Fecha ao clicar fora (ref no wrapper e listener de `mousedown`), mesmo padrão
  da bubble de filtros das outras telas.
- Acessibilidade: input com `role="combobox"`, `aria-expanded`,
  `aria-controls` e `aria-activedescendant`; a lista com `role="listbox"`; cada
  linha com `role="option"` e `aria-selected`.

### 4. Ligação em `src/App.jsx`

No header (o `<header>` dentro do `<main>`), colocar o `GlobalSearch` entre o
título (esquerda) e o cluster de botões (direita):

`{!appUser.superAdminOnly && <GlobalSearch leads={leads} onAddLead={() => setIsAddLeadModalOpen(true)} />}`

Escondido para super-admin puro (não carrega leads). No desktop o título fica à
esquerda, a busca no meio (flex, com largura máxima) e os botões à direita. No
mobile o título e a lupa dividem a linha; a lupa expande a barra sobre o header.

## Casos de borda

- `name`, `whatsapp` ou `cpf` ausentes ou nulos: `normalize`/`onlyDigits`
  tratam string vazia sem quebrar; a pessoa só não casa por aquele campo.
- Query só com espaços: depois do `trim` vira vazia, dropdown não abre.
- Lead legado sem `lifecycleStage` nem contrato: `deriveLeadState` já cai no
  estado "lead" (azul), então o anel e o chip aparecem certos.
- Muitos resultados: mostra os 8 primeiros e o contador "8 de N".
- Digitação rápida em base grande: a busca é síncrona sobre um array em
  memória (poucos ms para alguns milhares de itens), memoizada em `query`. Sem
  debounce por ora.

## Verificação

Feita no app rodando (preview, `npm run dev`, porta do `.claude/launch.json`),
cobrindo:

1. Buscar por primeiro nome, por sobrenome, por CPF (com e sem pontuação) e por
   telefone (com e sem máscara). Todos acham.
2. Um lead e um cliente no mesmo resultado, cada um com o anel na cor certa
   (lead azul, cliente ativo verde, a vencer âmbar/verde, inativo cinza,
   cancelado/perdido vermelho).
3. Enter abre a ficha; clique na linha abre a ficha; Esc fecha; clique fora
   fecha; `⌘K` foca a barra.
4. Mobile: a lupa expande a barra e a busca funciona.
5. A barra aparece em todas as telas de academia e não aparece para
   super-admin puro.

A lógica pura de `globalSearch.js` (normalização, dígitos, ranqueamento) é a
candidata natural a teste unitário caso o projeto tenha runner configurado; se
não tiver, entra na verificação manual acima.
