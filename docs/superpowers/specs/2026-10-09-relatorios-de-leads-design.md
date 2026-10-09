---
status: revisão
---

# Relatórios de Leads (versão básica)

Spec aprovada em conversa com o Johnny em 09/10/2026. É a primeira tela da função de Relatórios.

## Por que esta versão

A auditoria de 24/09/2026 catalogou 172 relatórios, e a seção 1.8 dela juntou os repetidos em 41. Ao ver a lista dos 41, o Johnny achou complexo demais: um gestor perderia minutos para achar o relatório de que precisa. A decisão foi começar pelo básico, só com o relatório de Leads e cinco submenus embaixo dele. Os outros grupos entram depois, um de cada vez.

A auditoria e a spec da entrega A estão na branch `claude/relatorios-entrega-a-spec`, em `docs/auditoria-relatorios-2026-09-24.md` e `docs/superpowers/specs/2026-10-06-relatorios-entrega-a-gravar-o-que-falta-design.md`. O período segue a spec do período personalizado, na branch `claude/periodo-personalizado`, em `docs/superpowers/specs/2026-09-25-periodo-personalizado-visao-geral-design.md`.

## Decisões do Johnny

Em 09/10/2026:

1. A tela começa só com o relatório de Leads, com cinco submenus nesta ordem de prioridade: Entrada de leads, Conversão, Visitas e aulas experimentais, Perdas e Leads parados.
2. O funil por etapa continua no painel CRM, como está.
3. O menu lateral ganha um item só, Relatórios. A tela tem a lista ao lado, com o título Leads e os cinco submenus embaixo, como as seções de Configurações.
4. As contas rodam no navegador, com as mesmas funções do painel CRM, para o relatório sempre bater com o painel.
5. Os cinco submenus seguem o mesmo molde: período e filtros em cima, números no topo, lista de nomes embaixo e o botão de exportar.
6. As telas são montadas com a skill frontend-design.
7. A entrega é em dois PRs.

De 28/09/2026 (seção 1.7 da auditoria), valem aqui:

- Decisão 1: todos os papéis abrem os Relatórios. O professor fica de fora deste relatório porque não vê lead em nenhuma tela (ver "Quem abre").
- Decisão 2: todos exportam lista com nome, WhatsApp, CPF e valor.
- Decisão 12: o período é o do período personalizado.

As decisões 3, 4 e 7 (matrícula pelo contrato, crédito para o dono no dia do fato e contato só como conversa registrada) mudam o painel CRM e entram na entrega C. Quando entrarem, o relatório muda junto, porque usa as mesmas funções.

## A tela

### Menu e endereço

- `src/lib/routes.js` ganha a tela `relatorios`, com o endereço `/<academia>/relatorios`, o título "Relatórios" e as sub-telas dos submenus (`RELATORIOS_SUBS`): `entrada`, `conversao`, `visitas-e-aulas`, `perdas` e `parados`. O padrão (`subPadrao`) é `entrada`.
- `relatorios` entra em `RESERVED_TENANT_SLUGS` (`src/lib/tenantSlug.js`), senão o `tenantSlug.test.js` quebra.
- O `sidebarNav` (`src/lib/sidebarNav.js`) ganha `relatorios`, e o `App.jsx` desenha o item Relatórios, com um ícone do lucide, no bloco Workspace, logo abaixo do grupo Leads.
- Sub-tela desconhecida abre a Entrada de leads, com replace e sem aviso, como as outras telas com sub-tela. Trocar de submenu dentro da tela é replace (`goToSub`), como em Configurações. Quem chega de outra tela empilha.
- Sub-tela não entra no `screenKey`, então trocar de submenu não remonta a tela nem relê nada.

### Quem abre

- Gestor e consultor abrem e exportam.
- O professor não abre: `relatorios` fica fora de `PROFESSOR_SCREENS` (`src/lib/acesso.js`). O menu não mostra o item, e o endereço mostra o aviso de tela não liberada, como nas outras telas dele.
- O exportar pergunta a uma ação nova, `ACTIONS.RELATORIOS_EXPORTAR`, que gestor e consultor têm. Hoje ela não recusa ninguém que abre a tela. Serve aos perfis editáveis do futuro.
- O super-admin puro não tem academia e não chega na tela. Na sessão assumida, vê como o gestor.

### A lista ao lado

- Segue o molde do trilho de Configurações. Um módulo puro, `src/lib/relatoriosRail.js`, guarda os grupos e os itens na ordem da tela. O id de cada item é a chave dele em `RELATORIOS_SUBS`, e um teste de contrato confere os dois, como o `settingsRail.test.js`.
- No fim da entrega, é um grupo, Leads, com os cinco itens. No PR 1, o grupo tem só Entrada de leads e Conversão.
- O item aceso é o submenu do endereço.
- Abaixo da largura `lg`, a lista vira um seletor no topo da tela, sem desenho próprio para o celular.
- Quando vierem os relatórios de clientes e de vendas, eles entram como novos grupos nessa lista.

### A barra de cima

- **Período**, nos atalhos da decisão 12: Hoje, Ontem, Esta semana, Semana passada, Mês e Personalizado, com as datas "de" e "até", até 12 meses para trás e sem data futura. O padrão é o mês atual, em andamento.
- **Consultor**: quem vende (`isSeller`), com escolha de uma ou mais pessoas. Abre com a equipe toda, para qualquer papel, como as listas desde o #249. A equipe toda inclui os leads de quem saiu da equipe e os leads sem dono.
- **Origem**: uma origem do catálogo, ou todas.
- **Funil**: um funil, ou todos. "Todos os funis" deixa de fora Renovações, Vencidos e Upgrade, como no painel CRM.
- **Leads parados** não tem período, porque é retrato de agora. No lugar dele, a barra mostra o corte "sem registro há mais de", com 3, 7, 15 ou 30 dias. O padrão é 7. Consultor, origem e funil valem também ali.
- **Comparação**: os números do topo mostram a variação contra o período anterior do mesmo tamanho. No modo mês, é o mês anterior, cortado no mesmo ponto quando o mês está em andamento. Nesta versão não há escolha do mês de comparação nem caixa para desligar.

### O período

- O período mora num módulo puro, `src/lib/period.js`, com a API da spec de 25/09: `periodFromParams`, `previousPeriod`, `monthsCovering` e o texto do botão. O seletor é o `PeriodControl` da mesma spec, com o `Popover` do shadcn.
- O Relatórios é o primeiro a usar os dois. A Visão geral passa a usá-los quando o período personalizado dela for feito. O plano dele (`docs/superpowers/plans/2026-09-25-periodo-pr1-base-operacional.md`, na branch `claude/periodo-personalizado`) precisa ser revisto para partir do que já existir.

### O endereço

Tudo que a pessoa escolhe fica no endereço, pela tabela de `src/lib/screenParams.js`, como nas outras telas:

| Parâmetro | O que guarda |
|---|---|
| `periodo` | `hoje`, `ontem`, `semana` ou `semana-passada`. Sem ele, a tela fica no modo mês |
| `mes` | o mês do modo mês (AAAA-MM), nos últimos 12 meses |
| `de` e `ate` | as datas do Personalizado (AAAA-MM-DD), sempre os dois juntos |
| `resp` | os consultores, nos três estados de sempre: ausente, vazio ou com ids |
| `origem` | o nome da origem no catálogo |
| `funil` | o id do funil |
| `recorte` | o filtro da lista, como `situacao:matriculou` ou `motivo:Preço` |
| `dias` | o corte de Leads parados: 3, 15 ou 30. O 7 é o padrão e não é escrito |

- A precedência e as recusas do período são as da spec de 25/09: `de` e `ate` antes de `periodo`, que vem antes de `mes`. Valor inválido cai no padrão, sem aviso.
- O padrão nunca é escrito. Trocar filtro é replace, com o `state` junto. Nada disso entra no `screenKey`.
- Nenhum valor é dado pessoal. O `recorte` leva códigos fixos, ids de consultor e nomes de catálogo, nunca nome, telefone ou CPF de lead.
- O `recorte` que não existe no submenu aberto, ou que sumiu com a troca de período, é ignorado.

### O corpo de cada submenu

- No topo ficam os números do submenu, com a variação. Embaixo deles, os recortes (por origem, por consultor e os outros de cada submenu). Embaixo de tudo, a lista de nomes.
- Clicar num número ou numa linha de recorte filtra a lista (`recorte`), e clicar de novo limpa. A lista diz qual filtro está aplicado e tem o botão para limpar.
- Cada nome é um `LeadLink`: abre a ficha, e o Ctrl+clique abre em outra aba.
- A lista mostra 50 nomes e um "Mostrar mais". O exportar leva sempre a lista inteira, com os filtros e o recorte aplicados.
- O visual sai da skill frontend-design, com a identidade do app, os tokens do shadcn e o tema escuro. Valem as preferências dos painéis: a barra mostra o mesmo número que está ao lado dela, matrícula e conversão aparecem em verde, e o cabeçalho de coluna é curto, numa linha só.
- Os textos passam pelo humanizer e usam o vocabulário do painel CRM.

## Os cinco submenus

### 1. Entrada de leads

- **Base:** os leads cadastrados no período (`createdAt`), sem os importados, na regra do painel (`newLeadsOf`).
- **No topo:** leads novos, com a variação.
- **Recortes:** origem (com o canal do catálogo ao lado, quando a origem tem um), consultor e funil.
- **Lista:** nome, origem, consultor, funil, etapa de hoje, data de cadastro e situação de hoje (em aberto, cliente ou perdido). Os mais recentes primeiro.

### 2. Conversão

- **Base:** a safra do período, que são os leads cadastrados nele, acompanhados até agora (`outcomeAt` e `cohortMilestones`).
- **No topo:** leads da safra, quantos agendaram, vieram, matricularam, se perderam e seguem em aberto, e a conversão em %.
- **Recortes:** origem, consultor e rapidez do primeiro contato, nas faixas do painel: até 1 hora, de 1 a 24 horas, mais de 24 horas e sem contato. Cada faixa mostra a sua conversão.
- **Primeiro contato:** segue a regra do painel (`isContactInteraction` e `firstContactOf`), com o limite no fim do mês seguinte ao do cadastro de cada lead.
- **Lista:** nome, origem, consultor, data de cadastro, primeiro contato (a data e quanto demorou), se agendou, se veio, o desfecho (matriculou, perdeu ou em aberto) e a data do desfecho. Os mais recentes primeiro.

### 3. Visitas e aulas experimentais

- **Base:** os agendamentos de `stronix_aulas` com data no período, sem os cancelados e sem os marcados depois da primeira matrícula, na regra do painel (`appointmentsOf` e `effectiveStatus`).
- **No topo:** marcados, vieram, faltaram, sem desfecho (a data já passou e ninguém marcou), a acontecer e o comparecimento em %, que é quem veio sobre quem veio mais quem faltou.
- **Recortes:** visita ou aula, consultor, unidade e modalidade.
- **Lista:** nome, tipo, dia e hora, unidade, modalidade, professor (ou "Treina sozinho"), consultor e desfecho. Em ordem de data.
- O consultor é o dono de hoje do lead, como no painel.

### 4. Perdas

- **Base:** os leads com data de perda no período (`lostAt`), na regra do painel (`lossesOf`).
- **No topo:** perdas, com a variação.
- **Recortes:** motivo, etapa em que o lead se perdeu (`lossStagesOf`), origem e consultor.
- **Lista:** nome, motivo, etapa, data da perda, dias desde a perda, origem e consultor. A perda mais recente primeiro. Filtrar um motivo e exportar dá a lista de repescagem.

### 5. Leads parados

- **Base:** os leads em aberto de agora (`deriveLeadBucket` igual a `ativo`), que o app já tem na memória (`metaLeads`). Sem período.
- **No topo:**
  - sem próximo passo: em aberto e sem próximo contato, fora quem chegou há menos de 24 horas, que a Meta cobra como Novo lead (regra do `pipelineNowOf`);
  - com contato atrasado (`overdueDaysOf`, de `src/lib/dailyGoal.js`);
  - sem nada registrado na ficha há mais de N dias (`lastInteractionAt`), com o N do corte da barra.
- **Recorte:** consultor, que é o dono do lead hoje. O atraso fica com o dono mesmo quando o contato foi delegado, como o Atrasado da Meta.
- **Lista:** nome, etapa, dias na etapa, último registro, próximo contato (com os dias de atraso) e consultor. Quem está há mais tempo sem registro aparece primeiro.
- Um lead pode estar em mais de um número, por exemplo sem próximo passo e sem registro. A lista sem recorte mostra cada lead uma vez.

## Exportar

- Uma função única e pura, `src/lib/csvExport.js`, monta a planilha: separador `;`, aspas e a proteção contra fórmula que hoje mora em `LeadsView.jsx` (o valor que começa com `=`, `+`, `-`, `@`, tab ou quebra de linha ganha um apóstrofo na frente). O download vai com o BOM UTF-8, para o Excel ler os acentos.
- O exportar de Todos os leads (`LeadsView.jsx`) e o de Aulas e Visitas (`rowsToCsv`, em `src/lib/appointmentReport.js`) passam a usar a mesma função. O de Aulas e Visitas não tem a proteção contra fórmula hoje e passa a ter.
- O arquivo leva o submenu e as datas do período no nome, como `leads-perdas-2026-10-01-a-2026-10-09.csv`, sem dado pessoal. Em Leads parados, leva a data de hoje.
- **Colunas:** as da lista do submenu, mais as de contato no molde de Todos os leads (WhatsApp, Responsável do aluno e Telefone do responsável, pelo `contactOf`) e o CPF, pela decisão 2. Não há coluna de valor, porque nenhum dos cinco submenus mostra dinheiro.
- Quando o PR 10 da entrega A existir, o exportar grava quem exportou, pela função dele. Até lá, exporta sem esse registro, como os outros exportar do sistema.

## As contas

- Um módulo puro por submenu, em `src/lib/relatorios/leads/` (`entrada.js`, `conversao.js`, `visitas.js`, `perdas.js` e `parados.js`), testado em node. Cada um recebe a janela do período, o filtro de consultor, origem e funil e o `recorte` da lista, e devolve os números, os recortes e as linhas da lista.
- Nenhuma regra é copiada. Os módulos chamam as funções de `src/lib/crm/`: `newLeadsOf`, `outcomeAt`, `cohortMilestones`, `contactTimesByLead`, `firstContactOf`, `appointmentsOf`, `effectiveStatus`, `lossesOf`, `lossStagesOf`, `movesByLead`, `pipelineNowOf` e `makeScope`. Onde a função do painel devolve só a contagem e o relatório precisa dos leads, ela ganha essa saída sem mudar a conta.
- O `makeScope` passa a aceitar uma lista de pessoas. Com uma pessoa só, o resultado é o de hoje.
- Um módulo de janela junta os baldes dos meses que o período toca e filtra pela data, como a spec de 25/09 descreve para o `metricsOf`.
- **Equivalência:** com a janela de um mês inteiro e a origem em todas, cada número do relatório é igual ao do `metricsOf` do mesmo mês, pessoa e funil. Isso vira teste, com as fixtures do painel CRM.

## A carga

- O relatório usa o `useCrmSources` com os meses que a janela pede: os meses que o período e o período anterior tocam e, por causa da safra e do primeiro contato, os meses do início do período até o mês atual. É a mesma memória de sessão dos painéis, então abrir o painel CRM e depois o relatório não lê de novo.
- Leads parados usa os leads que o app já tem na memória (`metaLeads`), sem leitura nova.
- A carga obedece ao portão de ociosidade (`listenersActive`), como o painel.
- Enquanto um período novo carrega, a tela mantém o último resultado completo sob o véu de carregamento, como o painel CRM. Mês que falhou fica sem número, com o aviso, também como no painel.
- **Custo:** nenhuma consulta nova e nenhum índice. Um período dentro do mês atual não lê nada a mais, e um período de três meses custa o mesmo que abrir esses três meses no painel CRM.

## Avisos do dado

- **Visitas e aulas:** período que começa antes de setembro de 2026 leva o aviso de agendamento incompleto (`APPTS_COMPLETE_MONTH`), porque a visita só tem registro desde 18/08/2026.
- **Etapa da perda:** só existe desde 14/09/2026 (`STAGE_TRACKING_SINCE`). Período antes disso mostra "sem base" na etapa, e o período que atravessa a data mostra a parte coberta, com o aviso de parcial.
- **Perdas:** até o PR 4 da entrega A, um aviso fixo diz que o lead perdido que voltou ao funil sai desta conta, porque a volta apaga a data da perda.

## Proteções que passam a cobrir a tela

- `filtrosNoEndereco.sweep.test.js`: nenhum filtro em estado e nada de filtro numa key.
- `leadLinkSweep.test.js`: o nome que abre a ficha é link.
- `acessoSweep.test.js`: a tela entra em `LISTAS_DE_QUEM_VENDE`.
- `professorShell.test.js` e o teste do `sidebarNav`: o professor não vê o item.
- `overscrollGuard.test.js`: tabela com rolagem lateral leva `overscroll-x-contain`.
- A tela fica dentro do `AppErrorBoundary`, como as outras.

## Entrega

### PR 1

- A tela, o item no menu, a lista ao lado, a barra (período, consultor, origem e funil), os parâmetros do endereço, o `period.js` e o `PeriodControl`.
- A lista de nomes com o recorte e o "Mostrar mais", e o exportar com a função única, já com Todos os leads e Aulas e Visitas usando a mesma função.
- Os submenus Entrada de leads e Conversão.
- `CLAUDE.md` do Stronilead com a seção "Relatórios".

### PR 2

- Os submenus Visitas e aulas experimentais, Perdas e Leads parados.
- `CLAUDE.md` atualizado.

Nada a publicar no Firestore em nenhum dos dois.

## Testes

- `period.js`: os testes da spec de 25/09.
- `screenParams`: os parâmetros do `relatorios`, as recusas, a precedência do período e que o padrão nunca é escrito.
- Cada submenu: números, recortes, linhas e o filtro da lista; equivalência com o `metricsOf` num mês inteiro; período que cruza meses; consultor, origem e funil; importados fora.
- `csvExport`: separador, aspas, proteção contra fórmula e BOM. Todos os leads e Aulas e Visitas continuam com as mesmas colunas de antes.
- Render, com `MemoryRouter` e mock do `firebase.js`: a lista ao lado, a barra e um submenu com dados falsos.
- Rotas: `relatorios` reservado e sub-tela desconhecida caindo na Entrada.
- No preview: 1280px e 390px, tema claro e escuro, cada submenu, e o arquivo exportado aberto no Excel.

## Fora desta entrega

- Os relatórios de clientes, vendas, equipe e os outros grupos da seção 1.8 da auditoria.
- O funil por etapa.
- As regras da entrega C (decisões 3, 4 e 7).
- Os dados novos da entrega A.
- Desenho próprio para o celular.
- Ordenar a lista pela coluna, salvar recortes, PDF e envio por e-mail.

## O que muda depois

- **PR 2 da entrega A:** o lead passa a guardar quem o cadastrou e por onde, e a Entrada pode mostrar a forma de entrada.
- **PR 4 da entrega A:** Perdas passa a contar toda perda do período, pela decisão 5, e o aviso fixo sai.
- **PR 10 da entrega A:** o exportar grava quem exportou.
- **Entrega C:** as regras novas de matrícula, crédito e contato mudam o relatório e o painel CRM juntos.
