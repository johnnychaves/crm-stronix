---
status: rascunho
data: 2026-09-24
---

# Auditoria do Stronilead para a função de Relatórios

Levantamento feito em 24/09/2026 sobre a main (depois do merge da PR #220), para desenhar a tela de Relatórios. Responde que perguntas o dono, o gestor e o consultor de uma academia conseguem responder com o que o sistema grava hoje, desde quando, a que custo e com que cuidado.

Como foi feito. Treze leituras em paralelo cobriram leads, contratos, interações e Meta Diária, agenda e professores, equipe e permissões, configuração e catálogos, os três painéis da Visão geral, listas e exportações, custo e arquitetura, o que já foi pedido nas specs, nas memórias e nos playbooks, a história do dado no git e o que outros sistemas de academia e CRMs de vendas oferecem. As 430 ideias levantadas viraram um catálogo de 172 relatórios, com duas rodadas de busca pelo que faltava, e cada relatório foi conferido no código por um verificador. Uma revisão final cruzou as seções e corrigiu 44 contradições entre elas. Nada foi lido do Firestore de produção: as datas de "desde quando" saem do git e do código.

Seções:

1. Resumo e recomendação
2. Mapa de dados, parte 1: leads, contratos e agenda
3. Mapa de dados, parte 2: interações, Meta Diária, equipe, configuração e a história do dado
4. O que já existe
5. Catálogo de relatórios, em 15 domínios
6. Lacunas e dados a gravar
7. Regras, permissões, custo e arquitetura

O que mudou na main depois desta auditoria. Até 30/09/2026 entraram os PRs #221 a #238, e as citações `caminho:linha` deste documento valem para a main de 24/09. Dois deles mexem em pontos daqui. O #237 faz o registro da visita acompanhar o Remarcar da Meta Diária: a visita que faltou fecha como falta e a troca de visita por aula fecha como cancelado. O #238 trocou o interruptor de presença pelo balão Marcar desfecho, com correção no mesmo dia. O comparecimento da visita continua sem ir para o registro de `stronix_aulas`, então essa lacuna da seção 1.5 segue aberta.

O que esta auditoria não confirmou:

- A data de 29/04/2026, usada como início de leads e interações, é a do primeiro commit do repositório. O banco pode ter leads mais antigos, e isso só se confirma lendo o Firestore.
- Pelo repositório não dá para saber se o `scripts/fix-clients-unsold-by-stage-move.js` rodou com `--apply` nem se o backfill de `zapMatchKey` rodou. Os 19 clientes do backfill de `convertedAt` vêm da memória do projeto.
- Três referências internas do rascunho foram casadas com relatórios pela descrição e merecem um olhar: "venda por dia" virou R049, "hora das ações" virou R121 e um item de carteira virou R074.
- A revisão final reconferiu no código só as citações `caminho:linha` que se contradiziam entre seções. As outras ficaram como os verificadores escreveram, e algumas podem estar deslocadas por poucas linhas sem mudar o fato.
- O formato da foto diária (um documento por mês com a parte de cada pessoa, ou um documento por pessoa e dia) está em aberto nas seções 1.5, 6.3 e 7.6.

## 1. Resumo e recomendação

### 1.1 O que o sistema já mostra

Hoje o Stronilead responde às perguntas de gestão em três painéis mensais da Visão geral, na Meta Diária com a visão da equipe e em cinco listas com nome de pessoa (Pipeline, Todos os leads, Clientes, Aulas e Visitas). O Operacional mede o trabalho do time e a base de clientes: meta, prospecção, ativos, churn, renovação e a tabela da equipe. O CRM mede o funil de leads por mês de competência, do cadastro à matrícula. O Gerencial mostra o valor de contrato vendido, a carteira por mês e o que vence em 30, 60 e 90 dias. As contas moram em módulos testados (`src/lib/operacional/`, `src/lib/crm/`, `src/lib/gerencial/`) que já aceitam qualquer janela de datas, então a base de cálculo dos Relatórios existe. O que falta é o que um relatório tem e um painel não tem. Nenhum número abre a lista de pessoas por trás dele, nenhum painel exporta, o período é sempre o mês civil até 11 meses atrás (`src/lib/screenParams.js:58-59`) e os três painéis abrem para qualquer papel, inclusive o dinheiro vendido por colega (`src/lib/routes.js:52-55`). Na academia só exportam o CSV de Todos os leads, com 9 colunas (`src/views/LeadsView.jsx:123-155`), e o CSV e o PDF de Aulas e Visitas, que leem o agendamento guardado no lead e não o histórico de `stronix_aulas`. No super console, Exportar, CSV e Relatório mensal são botões sem ação (`src/views/console/SuperConsole.jsx:106-107`, `:229`, `:861`), e o MRR mês a mês é uma estimativa feita com as academias e os preços de hoje.

### 1.2 O que a auditoria achou

O catálogo da seção 5 tem 172 relatórios em 15 domínios, cada um conferido no código da main de 24/09/2026.

| Viabilidade | Relatórios | Prioridade alta | Prioridade média | Prioridade baixa |
|---|---|---|---|---|
| Pronto | 11 | 5 | 4 | 2 |
| Com ajuste | 123 | 32 | 50 | 41 |
| Precisa gravar dado novo | 35 | 1 | 14 | 20 |
| Fora do escopo | 3 | 0 | 0 | 3 |
| Total | 172 | 38 | 68 | 66 |

Na conferência com o código, 168 relatórios voltaram ajustados, 2 foram confirmados como estavam (R094 e R170) e 2 deram inviáveis (R047 e R062). Ajustado quer dizer que a leitura do código corrigiu a fonte, a regra ou a data de início que a ideia supunha. Cada item da seção 5 traz a linha "Conferência no código" com o que mudou.

| Seção | Domínio | Total | Pronto | Com ajuste | Gravar dado novo | Fora | Alta |
|---|---|---|---|---|---|---|---|
| 5.1 | Entrada e origem | 5 | 0 | 2 | 3 | 0 | 1 |
| 5.2 | Funil e conversão | 15 | 1 | 14 | 0 | 0 | 4 |
| 5.3 | Perdas | 6 | 0 | 6 | 0 | 0 | 2 |
| 5.4 | Agenda e professores | 22 | 0 | 15 | 6 | 1 | 4 |
| 5.5 | Vendas e contratos | 17 | 2 | 9 | 5 | 1 | 5 |
| 5.6 | Carteira e retenção | 20 | 0 | 16 | 4 | 0 | 5 |
| 5.7 | Renovação e vencidos | 11 | 1 | 9 | 1 | 0 | 5 |
| 5.8 | Upgrade | 2 | 0 | 2 | 0 | 0 | 0 |
| 5.9 | Equipe e rotina | 35 | 5 | 21 | 9 | 0 | 8 |
| 5.10 | Indicações | 7 | 0 | 7 | 0 | 0 | 0 |
| 5.11 | Perfil da base | 1 | 0 | 1 | 0 | 0 | 0 |
| 5.12 | Qualidade da base | 11 | 1 | 7 | 3 | 0 | 3 |
| 5.13 | Listas exportáveis | 3 | 0 | 3 | 0 | 0 | 1 |
| 5.14 | Resumos | 4 | 0 | 3 | 1 | 0 | 0 |
| 5.15 | Super-admin | 13 | 1 | 8 | 3 | 1 | 0 |
| | Total | 172 | 11 | 123 | 35 | 3 | 38 |

O que mais pesa no desenho:

- O dado guarda o estado de hoje, não a história. Reabrir uma perda apaga `lossReason` e `lostAt` do lead (`src/lib/stageMove.js:89-92`). Dono, origem e funil são os de hoje. A correção de contrato reescreve o valor sem guardar o anterior, e excluir um lead apaga as interações dele (`src/views/LeadProfileView.jsx:216-236`). Por isso o número de um mês fechado muda depois, sem aviso.
- Convivem duas regras de matrícula e de crédito por pessoa. O CRM conta a primeira matrícula no lead e credita o dono de hoje. O Operacional e o Gerencial contam o contrato e creditam o dono gravado na venda. Depois de uma transferência de carteira os números se separam. A regra de atribuição assinada pelo time comercial (quem agendou o freepass confirmado) não é nenhuma das duas.
- As bases começam tarde: contratos em junho de 2026, autor da interação em 13/07/2026, visitas em 18/08/2026, agendamentos completos em setembro de 2026 e passagem entre etapas em 14/09/2026. Comparar com o mesmo mês do ano anterior só terá base em 2027.
- Há contradições que um relatório herdaria se ninguém decidir. O passe livre é "pacote de N aulas" em Configurações (`src/views/settings/SchedulingSection.jsx:76`) e N dias na conta do passe (`src/lib/freePass.js:3`, `:17-21`). A mesma reativação de cliente vencido vira renovação na Meta Diária e matrícula nova no board e na ficha. O upgrade de quem tem contrato vivo conta como Upgrade no Operacional e como Renovação no Gerencial.
- Dado pessoal. Qualquer consultor exporta a base inteira com nome e WhatsApp, e o CSV de Aulas e Visitas não neutraliza fórmula (`src/lib/appointmentReport.js:111-114`), então um lead criado pelo link público de indicação pode levar fórmula para o Excel do gestor. Esconder relatório do consultor é só trava de tela, porque as regras deixam qualquer membro ler leads e interações (`firestore.rules:79-80`, `:90-91`).
- Dinheiro errado com cara de certo. Os 494 contratos importados não têm valor, e os planos da Shape One guardam o preço mensal no lugar do total, o que derruba ticket e carteira.
- Custo e limite. Tudo roda no navegador, e a cota grátis de 50 mil leituras por dia é uma só para todas as academias. Doze meses de interações de uma academia com 3 a 5 mil registros por mês custam de 36 a 60 mil leituras na primeira carga de cada aparelho. A Vercel tem 11 das 12 funções em uso (`api/`).

### 1.3 Recomendação em três ondas

A tela `/<academia>/relatorios` nasce só no navegador (arquitetura A da seção 7.6), com as contas dos painéis, e liga desde a primeira entrega a foto diária do pipeline (arquitetura C). O resumo mensal gravado por função (arquitetura B) fica para quando alguma academia passar de uns 2 mil registros de interação por mês, alguém pedir série de atividade maior que 12 meses ou você decidir que o mês fechado congela (decisão 8).

#### Onda 1: prontos e de prioridade alta

| Id | Relatório |
|---|---|
| R049 | Vendas do período por tipo |
| R086 | Renovação por coorte de vencimento |
| R105 | Atrasados agora por consultor |
| R107 | Tempo até o primeiro contato |
| R114 | Leads sem próximo passo |

Com eles vem a estrutura que as outras ondas usam: período, lista por trás de cada número, ficha aberta por link, exportação e o registro de quem exportou (a metade de exportações do R147). Um relatório com ajuste sobe para cá: R150, Valores suspeitos em planos e contratos, porque o R049 mostra dinheiro e todo relatório de dinheiro abre com o aviso de valor suspeito. Os outros seis prontos, de prioridade média ou baixa, entram de carona porque usam a mesma estrutura: R008, R054, R103, R130, R145 e R160 (este no super console, onde dá uso ao botão CSV da lista de academias). O R107 herda a regra de contato do CRM, que conta troca de etapa e adiamento (`src/lib/crm/contact.js:17-21`), e sai com essa regra escrita na tela até a decisão 7.

Por que primeiro: a conta já existe e tem teste, então a onda constrói tela, lista e exportação sobre números que batem com os painéis, e qualquer erro que aparecer é da estrutura nova, não da regra.

#### Onda 2: com ajuste

São os 122 restantes com ajuste, em três blocos pela prioridade.

| Domínio | 2a, alta | 2b, média | 2c, baixa |
|---|---|---|---|
| 5.1 Entrada e origem | R001 | | R003 |
| 5.2 Funil e conversão | R006, R010, R011, R020 | R007, R009, R012, R013, R015 | R014, R016, R017, R018, R019 |
| 5.3 Perdas | R021, R026 | R022, R023, R025 | R024 |
| 5.4 Agenda e professores | R028, R029, R041 | R032, R033, R034, R037, R039, R042 | R030, R031, R040, R044, R045, R046 |
| 5.5 Vendas e contratos | R050, R051, R055, R056 | R052 | R053, R059, R063, R064 |
| 5.6 Carteira e retenção | R066, R067, R068, R069, R070 | R071, R072, R073, R074, R079, R080, R081, R082, R085 | R075, R077 |
| 5.7 Renovação e vencidos | R087, R088, R089, R091 | R090, R092 | R093, R095, R096 |
| 5.8 Upgrade | | R097, R098 | |
| 5.9 Equipe e rotina | R099, R100, R101, R102, R113 | R109, R110, R111, R115, R117, R118, R121, R133 | R112, R116, R120, R123, R124, R126, R127, R129 |
| 5.10 Indicações | | R134, R135, R136, R140 | R137, R138, R139 |
| 5.11 Perfil da base | | R141 | |
| 5.12 Qualidade da base | R142, R149 | R143, R148, R151 | R144 |
| 5.13 Listas exportáveis | R153 | R154 | R155 |
| 5.14 Resumos | | R156, R157 | R158 |
| 5.15 Super-admin | | R161, R162, R164 | R165, R166, R167, R168, R171 |
| Total | 31 | 50 | 41 |

Dentro da 2a, a ordem sugerida é esta. Primeiro R142 e R149, que mostram o que falta na base antes de alguém confiar no resto. Depois carteira, renovação e vendas (R066 a R070, R087 a R091, R050, R051, R055 e R056), que leem os contratos já carregados no login e não custam leitura nova (`src/App.jsx:794-802`). Por último funil, perdas, agenda e equipe, que dependem das decisões 3 a 5.

Por que em segundo: cada um pede uma troca de fonte ou de regra (o histórico de `stronix_aulas` no lugar do agendamento guardado no lead, período livre, lista nominal onde hoje só existe contagem), e muitos esperam uma das decisões do fim desta seção.

#### Onda 3: precisam de dado novo

- Alta: R027.
- Média: R002, R005, R036, R057, R058, R076, R083, R104, R106, R108, R131, R147 (a metade de exclusões), R159, R163.
- Baixa: R004, R035, R038, R043, R048, R060, R061, R065, R078, R084, R094, R119, R122, R125, R128, R132, R146, R152, R169, R172.

Por que por último: o relatório de um dado novo só enxerga o que foi gravado a partir do dia em que a gravação começou, então a gravação entra já, junto da onda 1 (seção 1.5), e a tela de cada um vem quando houver pelo menos um mês fechado inteiro com o dado, o mínimo para o comparativo ter os dois lados.

Ficam de fora os três fora do escopo. R047 (uso diário do passe e capacidade da turma) e R062 (recebimento, forma de pagamento e inadimplência) são do sistema de gestão da academia, o Stronix Suite, e o CRM não guarda check-in nem pagamento. R170 (custo de leitura por academia) não tem de onde sair, porque o Firestore cobra por projeto e o app não conta a própria leitura.

### 1.4 O que toda tela de relatório precisa ter

1. Período livre: dia, semana, mês, trimestre ou intervalo, com o mês de competência como padrão. Série de vários meses usa um parâmetro próprio na tabela de `src/lib/screenParams.js`, com teto escrito, porque o parâmetro de mês só aceita os 12 meses até o corrente (`src/lib/screenParams.js:58-65`).
2. Comparativo com o período anterior e com o mesmo período do ano anterior, pró-rata no período em curso e "sem base" quando falta um lado, com a mesma conta dos painéis (`comparisonCut`, `crmDelta`).
3. A mesma conta dos painéis. O relatório chama os `metricsOf` e os módulos puros de `src/lib/crm/`, `src/lib/operacional/` e `src/lib/gerencial/`, sem recalcular por fora, e repete as exclusões deles: importado nunca é venda, matrícula nem lead novo, e "Todos os funis" deixa fora Renovações, Vencidos e Upgrade.
4. A regra escrita na tela. O filtro de pessoa diz qual atribuição usa (dono de hoje, vendedor do contrato ou autor da ação), e todo evento de contrato diz se conta pela data do lançamento ou pela data do fato, porque cancelamento e trancamento aceitam data retroativa (`src/modals/ContractOutcomeModal.jsx:66`, `:182-188`).
5. A data de início ao lado de cada medida. Mês anterior à base aparece como "parcial" ou "sem base", nunca como zero.
6. Todo número abre a lista de onde saiu, e cada linha abre a ficha por `LeadLink`, que o `leadLinkSweep.test.js` cobra.
7. Faixa de alertas no topo das listas: passe livre expirando hoje, agendamento passado sem desfecho, marco de renovação sem contato. Cada alerta abre a própria lista (`src/lib/freePass.js`, `src/lib/renewalGoal.js`).
8. Dinheiro sempre rotulado. Chip fixo "valor de contrato, não é caixa", total e valor por mês com a unidade escrita, e aviso com link para o R150 quando a academia tem plano ou contrato com valor suspeito.
9. Contato de verdade separado de ação administrativa. Troca de etapa, adiamento e a interação automática da matrícula aparecem à parte da conversa registrada, senão "contatado em 5 minutos" e "aluno novo com contato" saem inflados (`src/lib/crm/contact.js:17-21`).
10. Taxa por perfil (bairro, dor, faixa etária, etiqueta) só com base mínima e com o n ao lado. A idade é a da data do cadastro ou da matrícula, não a de hoje, para a safra fechada não trocar de faixa.
11. Endereço e título. Filtros entram na tabela de `src/lib/screenParams.js` e trocam com replace, com nome novo que nunca seja `invite`, `t` ou `ref`. Nome, telefone, CPF e bairro nunca vão ao endereço, ao título da aba nem ao nome do arquivo. `relatorios` entra em `RESERVED_TENANT_SLUGS` (`src/lib/tenantSlug.js:24-29`). Filtro fica fora da `key`, e todo rolador horizontal leva `overscroll-x-contain`.
12. Formatos de saída. CSV com `;`, BOM e neutralização de fórmula em toda célula (o de Aulas e Visitas ainda não neutraliza). Planilha pelo `xlsx` que o app já carrega sob demanda. PDF pela impressão da própria tela, com regra de impressão, e não por janela nova, que o bloqueador de pop-up derruba.
13. Trava e rastro. Trava por papel na tela, sabendo que as regras deixam qualquer membro ler a base (`firestore.rules:79-95`). Toda exportação nominal grava quem exportou, quando, de qual relatório e quantas linhas, sem guardar os dados. Listas de repescagem, cadastros duplicados e LGPD só exportam pela tela do gestor.
14. Custo. Leitura sob demanda com `getDocs`, memória de sessão e conferência por contagem, sem assinatura nova e com o portão de ociosidade valendo. Consulta de campo único ou índice já publicado; índice novo é publicado à mão e conferido como ENABLED antes do deploy. Tipo e dado antigo são filtrados no navegador (`isAulaRecord`), nunca com `where('type')` nem `orderBy` em campo que pode faltar. Conta de servidor entra como `action` numa função existente.
15. Tela e texto no padrão da casa. Barra com o mesmo número escrito ao lado, verde para matrícula e conversão, cabeçalho curto, tabelas irmãs no mesmo formato, sem medalha. Texto passado pelo humanizer. Tela nova com spec, prompt para o Claude Design, handoff e plano.

### 1.5 O que começar a gravar já

O histórico de um dado começa no dia em que o sistema passa a gravá-lo, e nada da lista abaixo se reconstrói para trás com segurança. Cada semana de espera é uma semana a menos de série. O que começar antes de 01/10/2026 já cobre outubro inteiro.

Estes não dependem de decisão sua:

| Dado | Onde | Destrava | Por que |
|---|---|---|---|
| Desfecho da visita no próprio registro (`status`, `outcomeAt`), inclusive remarcação, cancelamento e adiar | `stronix_aulas`, por `writeAppointmentOutcome` (`src/lib/appointmentOutcome.js:55`) e pelos caminhos da Meta | R027, R028, R033, R037, R142 | A visita fica "agendada" para sempre e o CRM deduz o comparecimento pela linha do tempo. É o dado que falta ao único relatório de prioridade alta da onda 3. |
| No mesmo registro: quem agendou, confirmação da véspera (`confirmedAt`, `confirmedBy`), motivo do cancelamento e pacote de aulas combinado | `stronix_aulas` | R036, R038, R043, R048, R057 | O pacote vive só no lead e é sobrescrito. Os outros três não existem. |
| Autor e `lastInteractionAt` no desfecho da Agenda do dia | `stronix_interactions` e `stronix_leads` | R045, R100, R113 | Presença confirmada fica sem autor, e o lead parece mais frio do que está. |
| Perda como evento: `lossReason` e `fromStatus` na interação de passagem para Perda | `stronix_interactions` | R021, R022, R023 | Reabrir a perda apaga motivo e data do lead (`src/lib/stageMove.js:89-92`). |
| Quem cadastrou o lead (`createdByAuthUid`, `createdByName`), gravado uma vez e nunca sobrescrito | `stronix_leads`, no cadastro e no link público | R001, R099, R101, R131 | Não achei quem grava. Sem o campo, a opção "crédito de quem cadastrou" da decisão 4 nunca vai ter passado. |
| Troca de responsável com `fromConsultantId` e `toConsultantId` em cada lead, inclusive na transferência em massa | `stronix_interactions` (ficha e `src/views/settings/TransferLeadsTab.jsx`) | R069, R117, R119, R120 | Hoje o de/para é só nome no texto, e a transferência em massa não deixa rastro por lead. |
| Recusa pelo board e movimento do funil Vencidos com data e motivo; entrada, movimento e recusa do Upgrade com etapa e motivo | `stronix_interactions` (`src/views/KanbanView.jsx`) | R089, R091, R094, R097 | O board grava "Outro" só no lead, o arrasto não tem data e `upgradeEnteredAt` é zerado. |
| Valores anteriores na correção de contrato | `stronix_interactions` ou histórico no contrato | R061 | A correção muda a venda de um mês fechado sem deixar trilha. |
| Motivo em cada item de `pauseHistory` | `stronix_contratos` | R072 | Só a pausa atual guarda motivo (`src/lib/contracts.js:255-262`). |
| Modalidades e professor congelados no contrato | `stronix_contratos`, no fechamento | R052, R076 | Plano e professor do cliente são editáveis e reescrevem o passado. |
| Registro de exportação e de exclusão (ação, autor, tela, linhas, instante), sem dado pessoal | coleção nova, só de criação | R147 e a exportação da onda 1 | O CSV sai sem rastro (`src/views/LeadsView.jsx:123-155`) e excluir um lead apaga tudo dele (`src/views/LeadProfileView.jsx:216-236`). |
| Foto diária: leads ativos por funil, etapa e consultor, atrasados, clientes por situação e carteira | `stronix_fotos/{AAAA-MM}`, gravada pelo app no primeiro acesso do dia (arquitetura C) | R012, R104, R106, R119 | Pipeline por etapa, atrasados e carteira por consultor só existem ao vivo. Dia sem foto não volta. |
| Tentativa de cadastro repetido, com a origem escolhida na nova tentativa | `stronix_interactions`, no lead que já existe | R005 | O cadastro manual só mostra um aviso (`src/modals/AddLeadModal.jsx:435-441`), e a volta espontânea some junto com o canal que a trouxe. |

As duas coleções novas (foto diária e registro de exportação) precisam de regra publicada à mão no console antes do deploy, senão a gravação dá permission-denied.

Estes começam assim que você responder:

| Dado | Decisão | Destrava |
|---|---|---|
| Foto do mês fechado com a versão da regra, gravada uma vez na virada. Se começar antes de 01/10/2026, setembro já fica congelado | 8 | R159 |
| Histórico datado de dias de meta, alvo de prospecção, SLA, marcos e tolerância | 9 | R101, R102, R146 |
| Folga, férias, afastamento e feriado da academia | 10 | R101, R102 |
| Canal do contato (WhatsApp, Instagram, presencial, ligação) e resultado da ligação ou da mensagem | 7 | R109, R132 |
| Membro desligado em vez de apagado, com data de saída e último acesso; lead arquivado em vez de excluído | 15 | R122, R124, R125 |

Os demais dados novos da auditoria dependem de um processo ou de um número que ainda não existe fora do sistema: meta mensal por pessoa (R058), investimento por origem (R004), unidade no lead e no contrato (R060), nota de satisfação (R078), escala de plantão do digital (R131), pedido de cancelamento e reversão (R083, com o processo ainda em rascunho), regras de trancamento e transferência por linha de plano (R084), autorização do titular para a LGPD (R152), cobrança do gestor (R128), mensagem recebida pelo WhatsApp, que é a Parte B da ponte com o Stronizap (R108), e, no super-admin, motivo de saída da academia, valor antes e depois na auditoria e foto mensal do MRR (R163, R172).

### 1.6 Decisões que dependem de você

1. Quem abre Relatórios: só dono e gestor | todos os papéis, como os painéis hoje | o consultor abre, mas só com a própria carteira.
2. Quem exporta lista com nome, WhatsApp, CPF ou valor: qualquer papel (hoje) | só o gestor | o gestor tudo, e o consultor só a própria carteira, sem CPF, endereço e valor.
3. Matrícula oficial: primeira matrícula no lead, inclusive etapa com nome de matrícula sem contrato (regra do CRM) | contrato criado (regra do Operacional e do Gerencial).
4. Crédito por pessoa de lead novo, matrícula, venda e renovação: dono de hoje (CRM) | dono na época do fato (quem cadastrou, dono gravado no contrato, dono no vencimento) | regra de ouro do time comercial (quem agendou o freepass confirmado).
5. Perda: todo evento de perda do período, mesmo que o lead tenha voltado | só quem continua perdido hoje (regra atual do CRM).
6. Tipo da venda: reativação de cliente vencido conta como renovação (Meta Diária) ou retorno de ex-cliente (board e ficha), e upgrade de quem tem contrato vivo conta como Upgrade (Operacional) ou Renovação (Gerencial)?
7. O que é contato: só conversa registrada (WhatsApp, ligação, nota, contato feito na Meta) | qualquer ação no lead, inclusive mover no Kanban e adiar (regra atual do CRM).
8. Mês fechado: recalcula sempre com a base de hoje (hoje) | congela na virada | congela e lança correção, cancelamento retroativo e exclusão como ajuste no mês em que foram feitos.
9. Réguas de meses passados (dias de meta, alvo de prospecção, marcos, tolerância): a de hoje, como o Operacional faz | a que valia na época, com histórico gravado daqui para frente.
10. Dia de meta sem nenhuma tarefa, feriado, férias ou antes da entrada da pessoa: não batido (hoje) | batido | fora da conta, com registro de folga e feriado.
11. Gestor que também vende: entra nas somas da equipe, na prospecção e nos rankings (hoje) | aparece à parte.
12. Período: só mês de competência (hoje) | período livre comparado com o período anterior do mesmo tamanho | período livre comparado com o mesmo trecho do mês anterior.
13. Passe livre: o número combinado (`trialClassesPlanned`) é quantidade de aulas, como dizem Configurações | dias de validade, como contam `src/lib/freePass.js` e o cartão do Stronizap.
14. Relatório de dinheiro: espera o preenchimento dos 494 importados e a correção dos planos da Shape One | sai já, com o aviso de valor suspeito.
15. Excluir lead e excluir membro: continua apagando o histórico (hoje) | passa a arquivar o lead e desligar o membro, para o mês fechado não mudar e a pessoa não sumir dos relatórios.

### 1.7 Decisões tomadas (28 a 30/09/2026)

O Johnny respondeu às decisões 1, 2, 3, 4 e 13. A 12 já estava decidida na spec do período personalizado da Visão geral, de 25/09/2026. As outras (5 a 11, 14 e 15) ficaram com a recomendação, sem objeção dele.

| # | Assunto | O que ficou |
|---|---|---|
| 1 | Quem abre Relatórios | Todos os papéis. |
| 2 | Quem exporta lista com nome, WhatsApp, CPF ou valor | Todos os papéis. O registro de quem exportou continua na onda 1. |
| 3 | Matrícula oficial | O contrato criado. A aba CRM da Visão geral, que hoje conta pela etapa do lead, passa a contar pelo contrato para os números baterem. |
| 4 | Crédito por pessoa | O dono do lead no dia do fato, que é o que o contrato já grava (`src/lib/contracts.js:179`). O mês fechado não muda quando a carteira é redistribuída. |
| 5 | Perda de quem voltou | Conta toda perda do período, mesmo que o lead tenha voltado depois. Para isso a perda passa a ser gravada como registro próprio, com data e motivo. |
| 6 | Tipo da venda | Pelo que aconteceu, e não pelo botão usado. Upgrade: veio pelo funil Upgrade. Renovação: o contrato novo emenda no anterior, fechado antes do fim ou dentro da tolerância da academia (padrão de 15 dias). Retorno de ex-cliente: veio depois da tolerância. Matrícula nova: a pessoa nunca teve contrato. |
| 7 | O que é contato | Só conversa registrada: mensagem, ligação, nota e contato feito na Meta. Mover card e adiar aparecem à parte. |
| 8 | Mês fechado | Recalcula sempre, como hoje. A correção de contrato passa a guardar o valor anterior. |
| 9 | Metas de meses passados | A meta que valia na época, com histórico gravado a partir de agora. Os meses anteriores usam a de hoje, com aviso na tela. |
| 10 | Dia de meta sem tarefa, feriado ou férias | Fica fora da conta. Feriado e férias dependem de um cadastro de folgas. Enquanto ele não existe, só o dia sem nenhuma tarefa fica fora. |
| 11 | Gestor que também vende | Entra nas somas e nos rankings, marcado como gestor e com filtro para esconder. |
| 12 | Período | O do período personalizado: atalhos Hoje, Ontem, Esta semana, Semana passada, Mês e Personalizado, comparação com o período anterior do mesmo tamanho e até 12 meses para trás. |
| 13 | Passe livre | Depende da modalidade. Na musculação o passe costuma ser em dias (7 dias). No pilates, em aulas (2 aulas). O passe precisa guardar a unidade, e hoje o sistema guarda só o número e conta sempre como dias (`src/lib/freePass.js`, `api/_zapStrip.js`). Vira uma correção própria, antes dos relatórios de passe (R041 e R043). |
| 14 | Dinheiro com os 494 contratos importados sem valor | O relatório sai já, com o aviso de valor suspeito e esses contratos contados à parte. |
| 15 | Excluir lead ou membro | Arquivar o lead e desligar o membro, em vez de apagar. |


## 2. Mapa de dados (parte 1: leads, contratos e agenda)

Todas as coleções desta parte ficam em `artifacts/{academia}/public/data/`. A coluna "Desde quando" traz a data do merge na main, tirada do `git log`, ou a data que o próprio código declara. "Sobrescrito" quer dizer que o valor novo apaga o anterior e ninguém guarda o antigo. As citações são caminho:linha a partir da raiz do repositório, conferidas na main de 24/09/2026.

### 2.1 Leads e clientes (`stronix_leads`)

O documento do lead é o cadastro vivo da pessoa, do primeiro contato até virar cliente. Ele guarda o estado de hoje: etapa, dono, próximo contato, compromisso marcado, resumo do contrato vigente e recusa de renovação. O passado quase nunca fica aqui. Ele mora na linha do tempo (2.6), nos contratos (2.2) e nos agendamentos (2.4).

Quatro datas servem de eixo com segurança. `createdAt` não muda. `clienteSince` é a primeira matrícula e também não muda. `lostAt` vale até a reabertura, quando some. `statusEnteredAt` só existe desde 14/09/2026. Já `convertedAt` guarda a última matrícula, e não a primeira.

Não existe campo de quem cadastrou o lead. Todo recorte por pessoa usa o dono de hoje (`consultantId`), que muda na troca de responsável e na transferência em massa. Quem recebe um lead transferido leva junto o crédito do passado dele.

Tem bastante dado de perfil gravado que nenhuma tela lê: nascimento, sexo, estado civil, profissão, endereço, contato de emergência e o canal da origem. Isso abre relatório de perfil, de mapa da base e de aniversariantes, mas a cobertura é baixa fora dos clientes. O cadastro do lead não pede endereço, e o cadastro completo só existe desde 21/07/2026.

Custo: o jeito barato de ler é a janela por mês num campo de data só (índice automático, nada a publicar), com memória de sessão em `src/hooks/monthSources.js` e contagem no servidor (`getCountFromServer`, uma leitura a cada mil documentos contados). Ler a coleção inteira a cada abertura, como fazem Todos os leads e Configurações, é o caminho caro.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `name` | Nome da pessoa | cadastro `src/modals/AddLeadModal.jsx:455`; link de indicação `api/tenant-resolve.js:264`; importação `src/lib/clientImport.js:602`; cadastro completo `src/lib/clientRegistration.js:50` | 29/04/2026 (primeiro commit) | Rótulo de lista nominal (aniversariantes, parados, recusas). Nunca vai para o endereço nem para o título da aba. |
| `whatsapp` | Telefone digitado, quase sempre com máscara | `src/modals/AddLeadModal.jsx:456`; `src/lib/clientRegistration.js:51`; importação `src/lib/clientImport.js:368` (só se vazio) | 29/04/2026 | O DDD é a única pista de região presente em todos os leads: dá mapa de captação por DDD. Também mede telefone curto ou inválido. |
| `email`, `cpf`, `rg` | Contato e documentos, opcionais | `src/modals/AddLeadModal.jsx:462-463`; `src/lib/clientRegistration.js:52-56`; `src/lib/clientImport.js:369-371`; o link grava CPF em `api/tenant-resolve.js:273` | e-mail desde o início; CPF 30/06/2026 (PR #123); RG 21/07/2026 (PR #154) | Completude do cadastro e duplicidade. Não entra em relatório agregado. |
| `createdAt` | Data e hora do cadastro | `src/modals/AddLeadModal.jsx:476`; `api/tenant-resolve.js:290`; importação `src/lib/clientImport.js:624` (data da planilha ou hora da importação) | 29/04/2026; doc sem o campo vira `createdAtMissing` na leitura (`src/lib/leads.js:21`) | Safra, leads novos por mês, dia da semana e hora do cadastro. Não é sobrescrito. |
| `source` | Origem pelo nome. O canal (Orgânico, Pago, Offline) mora no catálogo, em `stronix_sources.channel` | cadastro `src/modals/AddLeadModal.jsx:457` (catálogo); link grava "Indicação" (`api/tenant-resolve.js:267`); importação grava "Importação NextFit" ou "Importação por planilha" (`src/lib/clientImport.js:565` e `613`); o cadastro completo usa uma lista fixa fora do catálogo (`src/modals/ClientRegistrationModal.jsx:22`); renome em cascata (`src/views/settings/CatalogsSection.jsx:58-60`) | 29/04/2026 | Eixo de captação (CRM) e de venda por origem (Gerencial). Juntando com o catálogo, vira canal. Três fontes de valor que não batem entre si. Editável a qualquer hora, sem rastro. |
| `consultantId`, `consultantName`, `consultantAuthUid` | Dono de hoje. `consultantAuthUid` é a chave de permissão | criação `src/lib/leads.js:261-265`; link herda o dono do indicador (`api/tenant-resolve.js:283-285`); importação `src/lib/clientImport.js:589-591`; troca na ficha `src/lib/clientRegistration.js:81-88`; transferência em massa `src/views/settings/TransferLeadsTab.jsx:141-148` | 29/04/2026 | Recorte "pessoa" de todos os painéis (`src/lib/crm/scope.js:54-63`). Lead transferido leva o passado junto. |
| `consultantChangedAt`, `consultantChangedByName`, `consultantChangedByAuthUid` | Última troca de responsável feita na ficha | `src/modals/ClientRegistrationModal.jsx:74-84` | 26/08/2026 (PR #188) | Repasses recebidos por pessoa (o índice já existe, usado em `src/hooks/useHandoffs.js:32-33`). Só a última troca. A transferência em massa não grava. |
| `funnelId` | Funil do lead | cadastro `src/modals/AddLeadModal.jsx:458`; troca pela ficha `src/lib/stageMove.js:88`; em massa `src/views/settings/ReferralOwnersSection.jsx:135`; lead antigo sem funil vai ao padrão (`src/App.jsx:977-986`) | multi-funil sem data precisa | Recorte por funil. "Todos os funis" deixa fora Renovações, Vencidos e Upgrade (`src/lib/crm/scope.js:27-30`). |
| `status` | Nome da etapa atual. "Venda" para cliente, "Perda" para perdido | Kanban e ficha por `src/lib/stageMove.js:87`; perda `src/views/LeadProfileView.jsx:307` e `src/views/KanbanView.jsx:1186`; matrícula `src/lib/contractsWrites.js:109`; promoção a Negociação `src/lib/appointmentOutcome.js:90-92`; renome `src/views/settings/FunnelsSection.jsx:181-189` | 29/04/2026 | Pipeline de hoje por etapa. Guarda o nome, não o id: renomear etapa quebra a série histórica. |
| `statusEnteredAt` | Quando entrou na etapa atual | `src/lib/stageMove.js:64-66` (Kanban e ficha); matrícula `src/lib/contractsWrites.js:117`; cadastro `src/modals/AddLeadModal.jsx:477`; promoção a Negociação pela Agenda do dia `src/lib/appointmentOutcome.js:92`. Não gravam: link público, importação e movimento em massa para Indicações | 14/09/2026 (PR #208) | Tempo parado na etapa (envelhecimento do pipeline). |
| `lifecycleBucket` | ativo, cliente ou perda (cliente ganha de perda) | `src/lib/leadDerived.js:18-19` e `43-46`, em toda escrita de etapa | 13/07/2026 (PR #137, com backfill na PR #140) | Filtro base de toda consulta barata: os índices compostos começam por ele. |
| `lifecycleStage`, `isConverted` | "cliente" depois da primeira matrícula, e nunca volta. `isConverted` é a marca antiga | `src/lib/contracts.js:185` via `src/lib/contractsWrites.js:102-120`; `isConverted` em `src/lib/contractsWrites.js:110`, zerado na perda de lead | `lifecycleStage` 30/06/2026; `isConverted` 29/04/2026 | Separar cliente de lead. Cliente anterior a 30/06 pode ter só `status` "Venda" (`src/lib/leads.js:48-56`). |
| `clienteSince` | Data da primeira matrícula | `src/lib/contractsWrites.js:116`, só se ausente (`src/lib/contracts.js:221`); importação `src/lib/clientImport.js:626` e `647` | 30/06/2026 | Matrícula do mês no CRM e coorte de clientes. Não é sobrescrito. |
| `convertedAt` | Data da última matrícula | matrícula nova e retorno (`src/lib/contractsWrites.js:115`, ligado por `stampConvertedAt` em `src/lib/contracts.js:219`); a renovação não regrava; etapa com nome de matrícula, só se ausente (`src/lib/stageMove.js:96`); zerado na perda de lead; importação `src/lib/clientImport.js:625` | 29/04/2026 | Coluna Venda do Kanban. Maior que `clienteSince` indica retorno de ex-cliente. `scripts/backfill-scale-fields.js:219-227` tem um alvo que copia `createdAt` para os clientes antigos sem o campo: nesses, a data é a do cadastro e não a da venda. |
| `lostAt`, `lossReason` | Quando foi perdido e por quê (nome do catálogo) | `src/views/LeadProfileView.jsx:307-310`; `src/views/KanbanView.jsx:1186-1189`; zerados ao sair da Perda (`src/lib/stageMove.js:89-92`) e na matrícula (`src/lib/contractsWrites.js:111`) | 29/04/2026 | Perdas do mês por motivo (índice `lifecycleBucket` + `funnelId` + `lostAt` já existe). O modal abre com o primeiro motivo marcado (`src/modals/LossReasonModal.jsx:9`), então o motivo campeão pode ser só o primeiro da lista. |
| `lastInteractionAt`, `interactionsCount` | Último toque e total de interações | `src/lib/interactions.js:45-53`; contratos `src/lib/contractsWrites.js:40` e `105-106`; indicação `src/lib/referralsWrites.js:39-40`. Não atualizam: desfecho pela Agenda do dia (`src/lib/appointmentOutcome.js:105`), importação e o updateDoc do board (`src/views/KanbanView.jsx:914`, `930`, `998`, `1016`) | 13/07/2026, com backfill | Dias sem contato, leads esquecidos, contatos até a matrícula. |
| `nextFollowUp`, `nextFollowUpType`, `nextFollowUpNote` | Próximo toque: data e hora, canal e observação | `src/lib/schedulePatch.js:32-37`; Meta `src/views/DailyGoalView.jsx:1170-1187`, `1360-1363` e `1482-1487`; `src/lib/renewalGoal.js:166-167`. Zerado na perda, na matrícula e no desfecho | 29/04/2026; nota 03/06/2026 | Atrasados, leads sem próximo contato, agenda futura por pessoa. |
| `nextFollowUpOwnerId`, `nextFollowUpOwnerName` | Quem faz o contato quando não é o dono | `src/lib/schedulePatch.js:46-47` | 18/08/2026 (PR #181) | Tarefas passadas a outra pessoa. |
| `appointmentType`, `appointmentScheduledFor` | Compromisso atual (visita ou aula experimental) e quando | `src/lib/schedulePatch.js:61-62`; remarcação `src/views/DailyGoalView.jsx:1484`; zerados no cancelamento (`src/lib/appointmentOutcome.js:100-103`) e no "Adiar p/ amanhã" (`src/views/DailyGoalView.jsx:1184-1185`) | antes de 14/05/2026 (o par formal ganhou backfill em julho) | Tela de Aulas e Visitas, relatório exportável, Meta, Agenda do dia e cartão do Zap. Vaga única: ganha o último agendamento escrito. O histórico está em `stronix_aulas` (2.4). |
| `appointmentModality`, `appointmentProfessorId`, `appointmentProfessorName`, `appointmentSoloTraining`, `appointmentUnit` | Modalidade, professor e treino solo da aula; unidade da visita | `src/lib/schedulePatch.js:55-60`; `src/views/DailyGoalView.jsx:1488-1491`; renomes em cascata (`src/views/settings/SchedulingSection.jsx:133-142` e `196-203`; `src/views/settings/TeamAccessSection.jsx:401-407`) | modalidade e unidade 01/06/2026; professor 09/07/2026 | Filtros de aula e visita. `appointmentUnit` é o único campo de unidade no lead. |
| `appointmentOutcome`, `appointmentOutcomeAt`, `appointmentOutcomeBy` | Desfecho do compromisso atual: compareceu, faltou ou cancelou | Meta `src/views/DailyGoalView.jsx:1212-1216`; Agenda do dia `src/lib/appointmentOutcome.js:85-89`; zerados no agendamento novo (`src/lib/schedulePatch.js:66-68`), no desfazer (`src/lib/appointmentOutcome.js:44-48`) e no próximo contato (`src/views/DailyGoalView.jsx:1364-1374`) | 14/05/2026 | Comparecimento de visita, que o registro da visita não guarda. `appointmentOutcomeBy` mistura `authUid` e id do usuário. |
| `trialClassesPlanned` | Passe livre. A conta trata como validade em dias (`src/lib/freePass.js:16-23`); a tela chama de pacote de N aulas (`src/components/profile/ScheduleWizard.jsx:50`) | `src/lib/schedulePatch.js:59`; `src/views/DailyGoalView.jsx:1492` | 01/06/2026 | Passes ativos e a vencer. Não vai para `stronix_aulas`. |
| `currentAulaId` | Aponta para o registro da aula em `stronix_aulas` | `src/lib/schedulePatch.js:69`; `src/views/DailyGoalView.jsx:1496` | 16/07/2026 | Liga o lead ao histórico de aulas. Visita não tem ponteiro. |
| `professorId`, `professorName` | Professor da carteira: o da aula que fechou a venda, o importado ou o escolhido no cadastro | `src/lib/aulasWrites.js:120-124` (na matrícula); `src/lib/clientRegistration.js:63-64`; `src/lib/clientImport.js:616-617` | 21/07/2026 (PR #154, commit `cb529b2`) | Carteira e retenção por professor. Nenhuma tela lê hoje. `professorName` não acompanha o renome do professor. |
| `dor` | Objetivo da pessoa, nome do catálogo `stronix_dores` | `src/modals/AddLeadModal.jsx:465` (obrigatória, linha 411); `src/lib/clientRegistration.js:57`; o link grava vazio (`api/tenant-resolve.js:276`); renome em cascata `src/views/settings/CatalogsSection.jsx:91-93` | 30/06/2026 (PR #123), já obrigatória no cadastro manual | Leads, conversão e perda por dor. Hoje só aparece no card e no relatório de aulas (`src/lib/appointmentReport.js:93`). |
| `modalidade` | Modalidade de interesse no cadastro (não é a da aula marcada) | `src/modals/AddLeadModal.jsx:466`; `api/tenant-resolve.js:192`; `src/lib/clientRegistration.js:58` | 30/06/2026 no cadastro (PR #126); no link público desde 10/08/2026 (PR #171) | Demanda e conversão por modalidade de interesse. Renomear a modalidade não atualiza este campo (`src/views/settings/SchedulingSection.jsx:135`). |
| `tags` | Etiquetas do catálogo. A importação põe "VIP" | `src/modals/AddLeadModal.jsx:460`; `src/lib/clientRegistration.js:66`; `src/lib/clientImport.js:611`; renome em cascata `src/views/settings/CatalogsSection.jsx:47-49` | 29/04/2026 | Segmentação livre da academia. |
| `birthDate`, `sexo` | Nascimento e sexo | `src/modals/AddLeadModal.jsx:461` e `464`; `src/lib/clientRegistration.js:54-55`; `src/lib/clientImport.js:607` e `372` (só se vazio) | 30/06/2026 (PR #123) | Faixa etária, aniversariantes do mês, conversão por idade e por sexo. Nenhuma tela lê. Na importação, sexo com texto desconhecido passa como veio (`src/lib/clientImport.js:98-104`). |
| `maritalStatus`, `profession` | Estado civil (lista fixa) e profissão (texto livre) | `src/lib/clientRegistration.js:59-60` | 21/07/2026 (PR #154) | Perfil da base de clientes. Profissão precisa de limpeza para agrupar. |
| `address` (`cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`) | Endereço | `src/lib/clientRegistration.js:67-71`; importação `src/lib/clientImport.js:181-186` (sem estado) e `377-380` | 21/07/2026; importação desde 04/09/2026 | Mapa da base por bairro, cidade e CEP. Na prática só cliente tem. |
| `emergencyContact` (`name`, `phone`, `relationship`) | Contato de emergência | `src/lib/clientRegistration.js:72-74` | 21/07/2026 | Clientes ativos sem contato de emergência. |
| `referredById`, `referredByName`, `referredAt`, `referralVia`, `referrerUnknown` | Quem indicou, quando, se veio pelo link público e indicação sem indicador conhecido | `src/modals/AddLeadModal.jsx:469-470`; `src/lib/referralsWrites.js:35-37`; `api/tenant-resolve.js:278-282`; `src/views/settings/ReferralOwnersSection.jsx:59-63` | 10/08/2026 (PR #171) | Ranking de indicadores, indicações por mês, conversão de indicados, link contra cadastro manual. |
| `currentContractId`, `currentPlanName`, `currentContractValue`, `currentContractStartsAt`, `currentContractEndsAt`, `currentContractStatus` | Resumo do contrato vigente | `src/lib/contractsWrites.js:102-120` com `src/lib/contracts.js:184-190`; desfechos `src/lib/contracts.js:248` e `264`; importação `src/lib/clientImport.js:554-560`; renome de plano `src/views/settings/CatalogsSection.jsx:69-71` | 30/06/2026; `currentContractStatus` sem backfill (`src/hooks/useLeadCount.js:11-16`) | Situação do cliente hoje e consultas dos funis Renovações e Vencidos. O histórico está em `stronix_contratos` (2.2). |
| `renewalHandledCheckpoints` | Marcos (90/60/30) já tratados no ciclo | `src/lib/renewalGoal.js:124-133` e `160-170`; zerado no contrato novo (`src/lib/contracts.js:195`) | 23/07/2026 (PR #157) | Cobertura dos marcos no ciclo atual. O histórico sai das interações. |
| `renewalDeclined`, `renewalDeclinedAt`, `renewalDeclineReason` | Cliente não vai renovar ou não vai voltar | Meta `src/modals/RenewalOutcomeModal.jsx:151`; board `src/views/KanbanView.jsx:929` (Vencidos) e `997` (Renovações), sempre com motivo "Outro"; desfazer `src/lib/renewalGoal.js:139-145`; zerados no contrato novo (`src/lib/contracts.js:196-198`) | marca 23/07/2026; data e motivo 14/09/2026 (PR #206) | Recusas por motivo. Desfazer apaga data e motivo. Recusa anterior a 14/09 não tem data no lead. |
| `reactivationStageId` | Etapa do cliente no funil Vencidos do board | `src/views/KanbanView.jsx:913` e `929`; zerado no contrato novo (`src/lib/contracts.js:202`) | 19/08/2026 (PR #184) | Retrato do funil Vencidos agora. Sem data e sem evento. |
| `upgradeStageId`, `upgradeEnteredAt`, `upgradeDeclinedAt` | Etapa no funil Upgrade, entrada e última recusa | `src/lib/stageMove.js:120-142`; `src/views/KanbanView.jsx:942-980`; `src/views/LeadProfileView.jsx:285-290` e `355-361`; `upgradeStageId` e `upgradeEnteredAt` zerados no contrato novo (`src/lib/contracts.js:206-207`); `upgradeDeclinedAt` nunca é zerado | 11/09/2026 (PR #199) | Quem está no Upgrade agora. `upgradeEnteredAt` some quando a pessoa sai. `upgradeDeclinedAt` guarda só a última recusa. |
| `importedAt`, `importedBy`, `importSource`, `importBatchId` | Marca de importação | `src/lib/clientImportWrites.js:105`; `src/lib/clientImport.js:595` e `630` | 04/09/2026 (PR #195) | Separar importado de captação real (`src/lib/crm/cohort.js:45-54`). Sobrescrito a cada reimportação. |
| `photoUrl`, `photoPath`, `photoUpdatedAt` | Foto do cliente e data da última troca | `src/views/LeadProfileView.jsx:161-164` e `182-185` | 20/08/2026 (PR #186) | Quantos clientes têm foto. |
| `observation` | Observação do cadastro completo | `src/lib/clientRegistration.js:65`. O cadastro do lead manda a observação para a linha do tempo (`src/modals/AddLeadModal.jsx:503-510`) | 29/04/2026 | Só texto. Sai no CSV de Todos os leads (`src/views/LeadsView.jsx:139-142`), quase sempre vazio para lead novo. |
| `nameLower`, `nameTokens`, `whatsappDigits`, `whatsappDigitsRev`, `cpfDigits`, `zapMatchKey` | Campos de busca e de casamento com o Stronizap | `src/lib/leadDerived.js:25-38` (espelho em `api/_referral.js:22-35`) | busca 13/07/2026; `zapMatchKey` 09/09/2026 (PR #200) | Sem valor próprio. Servem para achar duplicidade e medir cobertura do Stronizap. |
| `satisfactionAt`, `hasAttended`, `attendedAt` | Campos antigos, só lidos (`src/lib/leads.js:72-74` e `212-226`) | não achei quem grava | legado | Nenhum. Ignorar. |

Fica gravado como evento com data:

- O cadastro (`createdAt`), que não muda depois.
- A primeira matrícula (`clienteSince`), que também não muda.
- A marca de importação (`importedAt`), trocada só se a mesma pessoa for reimportada.

Só o estado atual (o passado se perde):

- Etapa e funil (`status`, `funnelId`). O caminho entre etapas só existe na linha do tempo, e estruturado só desde 14/09/2026.
- Dono (`consultantId`). A transferência em massa não guarda quem era o dono antes.
- Última matrícula (`convertedAt`). O retorno de ex-cliente regrava.
- Perda (`lostAt`, `lossReason`). A reabertura apaga os dois.
- Compromisso e desfecho (`appointment*`). Vaga única, zerada a cada agendamento novo.
- Origem, dor, modalidade, etiquetas, dados pessoais e professor. A edição sobrescreve sem rastro (`src/modals/ClientRegistrationModal.jsx:87`), e o renome de catálogo também.
- Recusa de renovação, etapa no Vencidos e etapa no Upgrade. Desfazer ou fechar contrato apaga.
- Passe livre (`trialClassesPlanned`).
- A exclusão do lead apaga o documento e todas as interações dele, e deixa contratos e aulas sem dono (`src/views/LeadProfileView.jsx:216-243`). O botão só aparece para admin (`src/views/LeadProfileView.jsx:1319-1321`), mas a regra deixa o dono do lead apagar também (`firestore.rules:85`). Um lead excluído muda o número de meses já fechados.

### 2.2 Contratos (`stronix_contratos`)

Cada matrícula, renovação e retorno vira um documento novo, e a regra não deixa ninguém apagar (`firestore.rules:242`). É a base mais pronta para relatório de dinheiro, desde 30/06/2026 (PR #123). O valor é o total do contrato em reais, com centavos depois da vírgula e já com desconto (`src/lib/format.js:1-22`). Desde 28/07/2026 (PR #162) o contrato guarda também o desconto com motivo, o cancelamento com motivo, o trancamento e a reativação. O status gravado só assume ativo, trancado ou cancelado. Agendado, a vencer e vencido saem da conta com o relógio (`src/lib/contracts.js:66-104`).

Custo: a coleção inteira já é assinada por toda sessão logada (`src/App.jsx:794-802`). Um relatório feito só com contratos não gasta leitura a mais.

Os limites para relatório são estes. O contrato não guarda modalidade, professor nem forma de pagamento, e o sistema não guarda pagamento, parcela ou inadimplência. Segundo o `CLAUDE.md` do Stronilead, 494 contratos importados da STRONIX estão sem valor. A correção de contrato apaga o valor, o plano e o início anteriores. A renovação que começa antes do fim do contrato atual deixa os dois vigentes, e a carteira conta os dois nesse intervalo. A volta de um cliente vencido é gravada de dois jeitos: pela Meta Diária vira renovação (o "Renovou" abre o contrato em modo renovação, `src/views/DailyGoalView.jsx:1543-1549` e `1869-1878`), e pela ficha ou pela coluna Venda do board Vencidos vira matrícula nova, sem `renewedFromId`.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `leadId`, `leadName` | Cliente dono do contrato e o nome dele no fechamento | `src/lib/contracts.js:158-159`; importação `src/lib/clientImportWrites.js:110` | 30/06/2026 | `leadId` é a chave da pessoa em todas as contas: valor ao longo da vida do cliente, tempo de casa, sucessor, retorno, contrato paralelo. `leadName` não acompanha a troca de nome: preferir o nome atual do lead. |
| `planId`, `planName` | Plano e o nome dele na hora da venda | `src/lib/contracts.js:160-161`; correção `src/lib/contracts.js:384-385`; importação `src/lib/clientImport.js:492-530` (`planId` vazio quando o plano não casou, `planName` com o texto da planilha) | 30/06/2026 | Vendas e carteira por plano. É o único caminho do contrato até a modalidade (via `stronix_planos.modalityIds`). |
| `value` | Valor total do contrato em reais, já com desconto | `src/lib/contracts.js:154` e `162` (vem de `src/modals/ContractModal.jsx:194`); correção `src/lib/contracts.js:380` e `386`; importação `src/lib/clientImport.js:502` | 30/06/2026 | Dinheiro vendido. Valor por mês = `value` dividido por `durationMonths` (`src/lib/gerencial/scope.js:17-21`). A correção sobrescreve sem guardar o anterior. |
| `listValue` | Preço de tabela do plano no dia da venda, congelado | `src/lib/contracts.js:155` e `163`; correção `src/lib/contracts.js:387` | 30/06/2026 | Desconto real (`listValue` menos `value`) e histórico de preço de tabela, que o plano não guarda. |
| `durationMonths` | Meses de vigência | `src/lib/contracts.js:152` e `164`; correção `src/lib/contracts.js:376` e `388`; importação pode deixar vazio | 30/06/2026 | Mistura de mensal, trimestral e anual; valor por mês. |
| `startsAt` | Início da vigência: hoje, o dia seguinte ao fim do atual ou outra data, inclusive passada ou futura | `src/modals/ContractModal.jsx:132-134` para `src/lib/contracts.js:151` e `165`; correção `src/lib/contracts.js:375` e `389`; importação com início real, inferido (`startsAtInferred`) ou vazio | 30/06/2026 | Contrato vigente num dia qualquer, base de ativos, tempo de casa, agendados. |
| `endsAt` | Fim da vigência: início mais os meses. Já conta como vencido às 00:00 desse dia | `src/lib/contracts.js:56-60` e `166`; reativação empurra pelos dias parados (`src/lib/contracts.js:340` e `353`); correção `src/lib/contracts.js:377-379` e `390` | 30/06/2026 | Coorte de vencimento, risco de 30, 60 e 90 dias, vencidos, saída de clientes. |
| `status` | ativo, trancado ou cancelado | `src/lib/contracts.js:167` (ativo), `243` (cancelado), `260` (trancado), `349` (ativo na reativação); importação traz o da planilha | 30/06/2026; trancado desde 28/07/2026 | Situação de hoje. Para o passado, usar `cancelledAt`, `pausedAt` e `pauseHistory`. |
| `createdAt` | Momento em que o contrato foi gravado. É a data da venda no Gerencial | `src/lib/contractsWrites.js:96`; importação `src/lib/clientImportWrites.js:111` (hora da importação) | 30/06/2026 | Mês da venda, antecedência da renovação, sucessor. Não é sobrescrito. |
| `renewedFromId` | Contrato que este renova | `src/lib/contracts.js:170`; sem informação do chamador, cai no `currentContractId` do lead (`src/modals/ContractModal.jsx:197`) | 30/06/2026 | Corrente de renovações, tipo de venda, aumento de plano na renovação, antecedência. |
| `closedFromUpgrade` | Contrato fechado de dentro do funil Upgrade | `src/lib/contracts.js:174`; a importação grava `false` (`src/lib/clientImport.js:522`) | 11/09/2026 (PR #199); antes, ausente | Conversão do funil Upgrade e tipo de venda. |
| `consultantId`, `consultantName`, `consultantAuthUid` | Dono do lead na hora da venda, que leva o crédito. Não é quem clicou | `src/lib/contracts.js:179-181`; importação usa o dono do lead ou o consultor padrão do assistente | 30/06/2026 | Ranking de venda. Só admin muda o dono do contrato (`firestore.rules:238-241`). A carteira de renovação usa o dono de hoje do lead (`src/lib/operacional/renewal.js:13-15`), e não este. |
| `discountMode`, `discountValue`, `discountReason` | Modo do desconto, desconto em reais e motivo (Fidelidade, Indicação, Campanha, Retorno, Outro) | `src/modals/ContractModal.jsx:198-202`; listas em `src/lib/renewal.js:82-89` | 28/07/2026 (PR #162) | Descontos por motivo, consultor e plano. A correção muda `value` sem mexer aqui, então os dois podem descasar. |
| `cancelledAt` | Data do cancelamento escolhida no modal, que pode ser passada. Na importação é o próprio `endsAt` | `src/lib/contracts.js:244` via `src/modals/ContractOutcomeModal.jsx:104-105`; importação `src/lib/clientImport.js:514` | 30/06/2026 (antes de 28/07 o cancelamento era um confirm sem motivo) | Cancelamentos do mês, saída de clientes, estorno de comissão. Não dá para desfazer. |
| `cancelReason`, `cancelNote` | Motivo da lista fixa (Financeiro, Mudou de cidade, Insatisfação, Saúde ou lesão, Foi para outra academia, Outro) e observação | `src/lib/contracts.js:38-45` e `245-246` | 28/07/2026; antes, vazio | Cancelamentos por motivo. Vazio vira "Outro" na conta (`src/lib/operacional/base.js:289`). |
| `pausedAt`, `pauseReason` | Início da pausa em curso e o motivo (Viagem, Saúde ou lesão, Financeiro, Outro) | `src/lib/contracts.js:47` e `261-262`; zerado na reativação (`src/lib/contracts.js:350`); importação grava `pausedAt` com a hora da importação, sem motivo (`src/lib/clientImport.js:518`) | 28/07/2026 | Trancados agora e motivo da pausa atual. `pauseReason` é sobrescrito na pausa seguinte. |
| `resumedAt`, `pausedDaysTotal` | Última reativação e total de dias parados | `src/lib/contracts.js:351-352` | 28/07/2026 | Duração dos trancamentos. `resumedAt` guarda só a última. |
| `pauseHistory` | Lista das pausas encerradas (`pausedAt`, `resumedAt`), sem motivo | `src/lib/contracts.js:354-359` | 14/09/2026 (PR #206). Antes, as pausas viram uma só, reconstruída (`src/lib/contracts.js:314-330`) | Trancaram e destrancaram por mês (`src/lib/operacional/base.js:187-199`). |
| `updatedAt` | Hora do último desfecho ou da última correção | `src/lib/contractsWrites.js:34` | 28/07/2026 | Pouco útil: mostra só a última mudança. |
| `importBatchId`, `importSource`, `importedBy`, `importedAt`, `startsAtInferred` | Marca de contrato importado e de início deduzido | `src/lib/clientImport.js:523-529`; `src/lib/clientImportWrites.js:109-112` | 04/09/2026 (PR #195) | Tirar da venda e dos cancelamentos e trancamentos (`src/lib/contracts.js:271`). Qualidade de dados. |

Fica gravado como evento com data:

- A venda (`createdAt`), com tipo: renovação (`renewedFromId`), fechamento pelo Upgrade (`closedFromUpgrade`), matrícula nova ou retorno.
- O cancelamento (`cancelledAt`), com motivo desde 28/07/2026.
- As pausas encerradas (`pauseHistory`), desde 14/09/2026 e sem motivo.
- O vencimento, que não é gravado mas sai de `endsAt`.

Só o estado atual (o passado se perde):

- Valor, plano, duração e início antes de uma correção.
- Motivo das pausas que já terminaram.
- Datas de reativação anteriores à última, para pausas antes de 14/09/2026.
- Situação do contrato (`status`), que só diz como ele está hoje.

### 2.3 Planos (`stronix_planos`)

O catálogo dos planos que a academia vende. Só admin grava, em `src/views/settings/CatalogsSection.jsx:210-262`. O plano não guarda histórico de preço: o preço do passado sai do `listValue` de cada contrato. É o único caminho entre contrato e modalidade.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `name` | Nome do plano, único na academia | `src/views/settings/CatalogsSection.jsx:210-256` | 30/06/2026 | Rótulo. O renome só chega a `currentPlanName` do lead (`src/views/settings/CatalogsSection.jsx:69-71`); o contrato fica com o nome antigo. |
| `value` | Preço de tabela total, em reais | `src/views/settings/CatalogsSection.jsx:221-227` | 30/06/2026 | Preço de hoje. |
| `durationMonths` | Duração em meses (mínimo 1) | `src/views/settings/CatalogsSection.jsx:224` | 30/06/2026 | Agrupar plano por duração. |
| `modalityIds` (e o antigo `modalityId`) | Modalidades que o plano cobre | `src/views/settings/CatalogsSection.jsx:225`; leitura em `src/lib/planos.js:7-16` | 16/07/2026 (PR #149) | Venda e carteira por modalidade, via `planId` do contrato. |
| `active`, `order`, `createdAt`, `updatedAt` | Plano no seletor, ordem e datas | `src/views/settings/CatalogsSection.jsx:246` e `258-262` | 30/06/2026 | Filtrar o catálogo atual. Plano desligado continua valendo nos contratos. |

Fica gravado como evento com data:

- A criação do plano (`createdAt`).

Só o estado atual (o passado se perde):

- Preço, duração e modalidades. Mudar a modalidade de um plano muda a leitura de todos os contratos antigos dele.

### 2.4 Agendamentos (`stronix_aulas`)

Um registro por compromisso, aula experimental ou visita. É a fonte do CRM (`src/lib/crm/appointments.js`). A regra não deixa apagar, e quem edita não troca o dono (`firestore.rules:248-254`). O campo `type` vazio quer dizer aula (`src/lib/aulas.js:15-16`), e o filtro por tipo é feito no navegador, nunca por `where`.

A aula está completa desde a segunda quinzena de julho de 2026. A visita só tem registro desde 18/08/2026; antes disso, só as 18 da carga inicial (`src/lib/crm/scope.js:19-24`). Por isso o CRM só trata os agendamentos como completos a partir de setembro de 2026 (`APPTS_COMPLETE_MONTH`).

O registro de aula está bem cuidado: agendar cria ou ajusta o registro em aberto, o desfecho vai para `status` e `outcomeAt`, e a matrícula marca `converted` na última aula atendida. A visita tem três buracos. O desfecho nunca é gravado no registro (`src/lib/leads.js:232-233`). A remarcação pela Meta não mexe no registro (`src/views/DailyGoalView.jsx:1465` só trata aula). O cancelamento só aparece na linha do tempo. O CRM contorna isso deduzindo o desfecho pelo espelho do lead e pela interação do dia marcado ou do seguinte (`src/lib/crm/appointments.js:91-104`).

As outras telas (Aulas e Visitas, Meta, Agenda do dia, relatório exportável, cartão do Zap) leem o espelho no lead (2.1), que guarda só o compromisso atual. O relatório exportável herda isso: mostra uma linha por lead, e o filtro "Cancelou" nunca devolve nada, porque cancelar zera `appointmentScheduledFor`.

Custo: o CRM lê o mês por `scheduledFor`, campo único, sem índice a publicar.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `type` | "aula" ou "visita". Vazio é aula | `src/lib/aulasWrites.js:33-43` com `src/lib/aulas.js:99-104`; `scripts/backfill-appointments.js` carimbou os antigos | 18/08/2026 (commit `cf09db4`) | Separar aula de visita. |
| `leadId`, `leadName` | Lead do agendamento e o nome dele na criação | `src/lib/aulasWrites.js:35-36` | 16/07/2026 | Ligação com o lead (dono, funil, origem, perda, matrícula) e com os contratos. `leadName` fica velho se o nome mudar. |
| `scheduledFor` | Data e hora marcadas | `src/lib/aulasWrites.js:16` e `22`; backfills | 16/07/2026 (aula); 18/08/2026 (visita) | Janela do mês, dia da semana, horário, antecedência. Remarcar antes do desfecho troca a data no mesmo registro, sem guardar a anterior (`src/lib/aulasWrites.js:28-31`). |
| `createdAt` | Primeira marcação desse compromisso | `src/lib/aulasWrites.js:43`; os backfills gravaram o dia em que rodaram (`scripts/backfill-appointments.js:238`) | 16/07/2026 | Antecedência. O CRM usa o menor entre `createdAt` e `scheduledFor` (`src/lib/crm/appointments.js:20-25`). |
| `status` | agendada, attended (veio), no_show (faltou) ou cancelled | criação como agendada; desfecho só para aula (`src/lib/aulasWrites.js:84-101`); desfazer volta para agendada (`src/lib/aulasWrites.js:104-107`) | 16/07/2026 | Comparecimento e falta de aula. Visita criada ao vivo fica "agendada" para sempre: usar o status deduzido. O desfecho não é gravado quando a data do registro difere da do lead (`src/lib/aulasWrites.js:91-98`). |
| `outcomeAt` | Quando o desfecho da aula foi registrado | `src/lib/aulasWrites.js:100`; zerado ao desfazer | 16/07/2026 | Atraso no registro do desfecho, só aula. |
| `converted`, `convertedAt` | Esta aula levou à matrícula (a última atendida antes do fechamento) | `src/lib/aulasWrites.js:110-126`, chamado na matrícula (`src/lib/contractsWrites.js:159-162`), na ficha (`src/views/LeadProfileView.jsx:405-408`) e no Kanban (`src/views/KanbanView.jsx:863-866`) | 16/07/2026 | Matrículas por professor, tempo entre aula e matrícula. Sem janela de tempo: uma aula de meses atrás leva o crédito. A função que desmarca (`src/lib/aulasWrites.js:130-140`) não tem quem chame. |
| `professorId`, `professorName`, `soloTraining` | Professor da aula, ou treino sozinho | `src/lib/aulasWrites.js:18-20`, pelo assistente de agendamento (`src/views/LeadProfileView.jsx:534-541`) e pela remarcação da Meta (`src/views/DailyGoalView.jsx:1465-1476`) | 16/07/2026 | Aulas, comparecimento e conversão por professor (`src/lib/crm/appointments.js:199-231`). O renome do professor não chega aqui (`src/views/settings/TeamAccessSection.jsx:397-406`). |
| `modality` | Modalidade da aula, pelo nome | `src/lib/aulasWrites.js:21` | 16/07/2026 | Aulas e conversão por modalidade. O renome da modalidade não chega aqui. |
| `unit` | Unidade da visita, pelo nome | `src/lib/aulasWrites.js:16`; backfill `scripts/backfill-appointments.js:144` | 18/08/2026 | Visitas por unidade. O renome da unidade não chega aqui. |
| `consultantId`, `consultantAuthUid`, `consultantName` | Dono do lead quando o registro nasceu. Não é quem agendou | `src/lib/aulasWrites.js:37-39` | 16/07/2026 | O CRM usa o dono de hoje do lead, não este. A troca de responsável não atualiza o registro. |

Fica gravado como evento com data:

- A marcação da aula (`createdAt`, `scheduledFor`), desde 16/07/2026.
- A marcação da visita, desde 18/08/2026.
- O desfecho da aula (`status`, `outcomeAt`).
- A aula que levou à matrícula (`converted`, `convertedAt`).

Só o estado atual (o passado se perde):

- A data anterior de uma aula remarcada. Na visita remarcada pela Meta, nem a data nova chega ao registro.
- O desfecho e o cancelamento da visita, que só existem no lead e na linha do tempo.
- Quem agendou e quem confirmou a presença. Isso só sai do `actorId` da linha do tempo.
- O passe livre combinado.
- Registros órfãos: perda com agendamento aberto, troca de aula por visita e "Adiar p/ amanhã" deixam o registro "agendada" para sempre.

### 2.5 Professores (`stronix_professores`)

Catálogo de professores, que não têm login no app. Só admin grava (`firestore.rules:176-179`), em `src/views/settings/TeamAccessSection.jsx:382-435`. A exclusão apaga o documento de vez e só é barrada se algum lead tiver compromisso marcado com o professor, então aulas antigas podem ficar com `professorId` sem dono.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `nome` | Nome do professor | `src/views/settings/TeamAccessSection.jsx:382-424` | 09/07/2026 | Nome atual pelo id. O renome só chega ao espelho do lead. Para professor excluído, usar o `professorName` do registro da aula. |
| `modalidadeIds` | Modalidades em que dá aula | `src/views/settings/TeamAccessSection.jsx:382-424` | 09/07/2026 | Filtro do professor no agendamento (`src/lib/professores.js:19-25`). |
| `ativo`, `order`, `createdAt`, `updatedAt` | Aparece no agendamento, ordem e datas | criado com `ativo: true` (`src/views/settings/TeamAccessSection.jsx:412`); não achei tela que desliga | 09/07/2026 | Nenhum. |

Fica gravado como evento com data:

- O cadastro do professor (`createdAt`).

Só o estado atual (o passado se perde):

- Nome, modalidades e a própria existência do professor (exclusão física, sem rastro).

### 2.6 Linha do tempo (`stronix_interactions`), só o que toca lead, contrato e agenda

É aqui que mora quase todo o passado do lead. Cada interação é um evento com data. Nenhuma tela edita nem apaga interação; só a exclusão do lead apaga as dele (`src/views/LeadProfileView.jsx:223-235`). A regra deixa editar e apagar o admin ou quem tiver `consultantAuthUid` igual ao próprio login (`firestore.rules:93-94`). Nenhuma interação grava esse campo (o que vai é `leadConsultantAuthUid`), então na prática só o admin, e não achei tela que use isso.

O ponto fraco é que muita coisa só existe no texto. Contrato cancelado, trancado, reativado ou corrigido, troca de responsável, eventos do Upgrade e data marcada no agendamento só são legíveis lendo a frase. Nenhuma interação de contrato guarda o id do contrato.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `type` | note, status_change, daily_goal_done, referral ou import | `src/lib/interactions.js:26-57` e quem chama | 29/04/2026 | Classificar o evento. |
| `leadId`, `createdAt` | Lead e hora do evento | `src/lib/interactions.js:26-57` | 29/04/2026 | Eixo de tempo de tudo que é histórico. Nota de transferência em massa e de movimento em massa não tem `leadId`. |
| `fromStatus`, `toStatus`, `funnelId`, `fromFunnelId` | Troca de etapa estruturada | `src/lib/stageMove.js:51-60`; matrícula `src/lib/contractsWrites.js:90` e `132` | 14/09/2026 às 18h10 (`src/lib/crm/scope.js:17`) | Passagem entre etapas, tempo por etapa, etapa da perda, reabertura. Antes disso, só a frase "[etapa]". |
| `actorId`, `actorAuthUid` | Quem fez a ação | `src/lib/interactions.js:38-40` | 13/07/2026 | Crédito da ação a quem fez, e não ao dono. O desfecho pela Agenda do dia não grava (`src/lib/appointmentOutcome.js:112-123`). |
| `leadConsultantId` | Dono do lead na hora | `src/lib/leads.js:267-270` | 13/07/2026 | Reescrito na transferência em massa (`src/views/settings/TransferLeadsTab.jsx:152-164`), então não é o dono da época. |
| `volumeKind` | Tipo de ação de prospecção (inclui visita e aula agendadas) | `src/views/LeadProfileView.jsx:576-584` e a Meta | 19/06/2026 (PR #111) | Ações de prospecção e agendamentos criados por pessoa e por dia. |
| `dailyGoalCategory`, `appointmentOutcome` | Tarefa da Meta concluída e desfecho do compromisso | Meta `src/views/DailyGoalView.jsx:1236-1245`; Agenda do dia `src/lib/appointmentOutcome.js:112-123` (só se o dia ainda não tiver marca); renovação `src/modals/RenewalOutcomeModal.jsx:158-178` | 14/05/2026; renovação 30/06/2026 (PR #123), por marcos desde 23/07/2026 (PR #157); vencido 17/08/2026 | Desfecho da visita, tarefas de agenda, cobertura dos marcos de renovação. Desfazer o desfecho não apaga a marca. |
| `rescheduledFor` | Nova data de uma remarcação | `src/views/DailyGoalView.jsx:1500-1517` | 14/05/2026 | Remarcações por mês e falta seguida de nova tentativa. |
| `renewalOutcome`, `renewalDeclineReason` | Recusa de renovação pela Meta e o motivo da lista | `src/modals/RenewalOutcomeModal.jsx:150-157` | 14/09/2026 (PR #206). Entre 23/07 e 14/09 a recusa pela Meta deixou só a nota "Motivo da perda de renovação:" com texto livre | Motivos de não renovar com data real. As recusas pelo board não deixam interação. |
| `text` | A frase do evento | todos os caminhos acima; textos de contrato em `src/lib/contracts.js:117-124`, `249`, `265`, `365-367` e `398`; Upgrade em `src/lib/stageMove.js:128-131` e `140` | 29/04/2026 | Fonte única de: data marcada no agendamento antes de 16/07 (`src/lib/timeline.js:177-200`), motivo da recusa do Upgrade (`src/lib/timeline.js:48`), troca de responsável, eventos de contrato por quem registrou. |

Fica gravado como evento com data:

- Contatos (mensagem, ligação, nota), tarefas da Meta concluídas e remarcações.
- Troca de etapa e perda. Estruturadas desde 14/09/2026; antes, só a frase.
- Matrícula, renovação, cancelamento, trancamento, reativação e correção de contrato, com quem registrou.
- Agendamento criado, desfecho, recusa de renovação pela Meta, eventos do Upgrade, indicação.

Só o estado atual (o passado se perde):

- O dono do lead na época (`leadConsultantId`), que a transferência em massa reescreve.
- Tudo o que o lead perde ao ser excluído, porque as interações dele vão junto.

### 2.7 Catálogos e configuração ligados por nome

O lead guarda o nome da etapa, da origem, do motivo, da dor, da etiqueta, da modalidade e da unidade, e não o id. O renome passa em cascata pelos leads, mas não pelas interações antigas nem pelos registros de `stronix_aulas`. Série histórica por nome quebra sempre que alguém renomeia.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `stronix_sources.name`, `channel` | Origem e canal (Orgânico, Pago, Offline) | `src/views/settings/CatalogsSection.jsx:51-61` e `137-166` | canal existe no catálogo; nenhuma tela lê | Agrupar origem em canal. |
| `stronix_statuses.name`, `funnelId`, `order`, `isEntry`, `isSystem`; `stronix_funnels.name`, `isDefault`, `systemKind` | Etapas e funis; `systemKind` marca Renovações, Vencidos e Upgrade | `src/views/settings/FunnelsSection.jsx:170-200`; configuração em `src/App.jsx:1100-1240` | Vencidos 19/08/2026; Renovações 26/08/2026 (PR #190); Upgrade 11/09/2026 | Ordem das etapas no funil (`src/lib/crm/scope.js:40-49`). Renovações não tem etapa gravada: as colunas são os marcos. |
| `stronix_loss_reasons.name`, `stronix_dores.name`, `stronix_tags.name`, `stronix_modalities.name`, `stronix_units.name` | Listas de valores das dimensões do lead | `src/views/settings/CatalogsSection.jsx`; `src/views/settings/SchedulingSection.jsx:117-225` | variado | Rótulos e ordem das dimensões. Excluir modalidade não confere os planos (`src/views/settings/SchedulingSection.jsx:164-170`). |
| `stronix_config/general.renewalCheckpoints` | Marcos de renovação (padrão 90/60/30) | `src/views/settings/PaceSection.jsx:149` | 23/07/2026 | Cobertura de marcos. O passado é recalculado com a configuração de hoje. |
| `stronix_config/general.renewalGraceDays` | Tolerância depois do vencimento (padrão 15, de 0 a 90) | `src/views/settings/PaceSection.jsx:138` | 28/07/2026 (PR #162) | Saída de clientes e sucessor (`src/lib/operacional/base.js:256-280`; `src/lib/operacional/renewal.js:38-52`). Sem histórico. |
| `contractThresholdDays` | Janela de "a vencer" | fixo em 30 no código (`src/App.jsx:331`), não é gravado | 30/06/2026 | Selo "a vencer". |
| `stronix_config/general.trialClassOptions` | Pacotes de passe livre oferecidos (1, 2, 3 por padrão) | `src/views/settings/SchedulingSection.jsx:234-270` | 01/06/2026 | Fatia de pacotes. |

Fica gravado como evento com data:

- Nada. Os catálogos só têm `createdAt` e `updatedAt`.

Só o estado atual (o passado se perde):

- Todo nome, canal, ordem e configuração. Relatório de meses passados lê com a configuração de hoje.

### 2.8 Eventos do ciclo de vida

| Fato | Onde fica | Data usada | Dá para contar o passado? |
|---|---|---|---|
| Lead cadastrado pelo modal | `stronix_leads.createdAt`; interação só se houver observação | `createdAt` | Sim, desde 29/04/2026. Quem cadastrou não fica gravado: o crédito vai para o dono de hoje. |
| Lead cadastrado pelo link de indicação | lead com `referralVia: 'link'` e interação `referral` nos dois lados (`api/tenant-resolve.js:263-330`) | `createdAt` | Sim, desde 10/08/2026. Não grava `statusEnteredAt`. |
| Cliente importado | lead e contrato com `importBatchId`; interação `import` (`src/lib/clientImportWrites.js:87-144`) | `importedAt`; datas da planilha em `createdAt` e `clienteSince` | Sim, desde 04/09/2026. O `createdAt` do contrato importado é a hora da importação, não a da venda. |
| Troca de etapa de lead | interação `status_change`; no lead só `status` e `statusEnteredAt` | `createdAt` da interação | Estruturado desde 14/09/2026 às 18h10. Antes, só a frase "[etapa]". |
| Promoção automática para Negociação depois de comparecer | lead e interação `status_change` separada (`src/lib/appointmentOutcome.js:73-135`) | `createdAt` da interação | Sim, desde maio de 2026. Pode faltar se a segunda gravação falhar. |
| Funil inteiro movido para Indicações | lead (`funnelId`, `status`) e uma nota sem `leadId` (`src/views/settings/ReferralOwnersSection.jsx:120-150`) | nenhuma no lead | Não. |
| Primeira matrícula | `clienteSince`, contrato novo e interação | `clienteSince` | Sim, desde 30/06/2026. Antes disso, só `convertedAt` ou `createdAt` do cliente antigo. |
| Retorno de ex-cliente | contrato novo sem `renewedFromId`; `convertedAt` regravado | `stronix_contratos.createdAt` | Sim, pelos contratos, desde 30/06/2026. No lead só a última volta. Pela Meta, o retorno é gravado como renovação. |
| Renovação | contrato novo com `renewedFromId` | `stronix_contratos.createdAt` | Sim, desde 30/06/2026. Antes de 28/07 a renovação começava "hoje" e criava sobreposição (`src/modals/ContractModal.jsx:26-30`). |
| Fechamento pelo funil Upgrade | `closedFromUpgrade` | `stronix_contratos.createdAt` | Sim, desde 11/09/2026. |
| Desconto concedido | `discountMode`, `discountValue`, `discountReason`; `listValue` menos `value` | `stronix_contratos.createdAt` | Motivo desde 28/07/2026; diferença de tabela desde 30/06/2026. A correção pode descasar os dois. |
| Cancelamento de contrato | `cancelledAt`, `cancelReason`, `cancelNote`; interação | `cancelledAt` (escolhida, pode ser passada); a hora do registro está na interação | Sim, desde 30/06/2026. Motivo desde 28/07/2026. |
| Trancamento | `pausedAt`, `pauseReason` | `pausedAt` | A pausa em curso, sim. As encerradas, pela `pauseHistory` desde 14/09/2026 e sem motivo; antes, uma pausa só, reconstruída. |
| Reativação de contrato trancado | `resumedAt`, `pausedDaysTotal`, `pauseHistory`, `endsAt` empurrado | `resumedAt` | Completo desde 14/09/2026. Antes, só a última. |
| Correção de contrato | contrato reescrito; interação com os valores novos | `updatedAt` | Dá para saber que houve correção, não o valor de antes. |
| Vencimento | não é gravado; sai de `endsAt` | `endsAt` | Sim, reconstruível. A reativação e a correção movem `endsAt`. |
| Lead perdido | `lostAt` e `lossReason` no lead; interação | `lostAt` | Sim, pela interação. No lead, a reabertura apaga. Etapa da perda estruturada desde 14/09/2026. |
| Lead perdido reaberto | interação com `fromStatus: 'Perda'` | `createdAt` da interação | Só desde 14/09/2026. |
| Troca de responsável pela ficha | interação "Responsável alterado de X para Y." e `consultantChangedAt` | `consultantChangedAt` | Sim, desde 26/08/2026, lendo a frase. |
| Transferência de carteira em massa | lead e interações reescritos; nota sem `leadId` (`src/views/settings/TransferLeadsTab.jsx:115-175`) | nenhuma | Não. O dono anterior de cada lead se perde. |
| Edição de cadastro (origem, dor, etiquetas, dados pessoais, professor) | só o lead | nenhuma | Não. |
| Renome de etapa, origem, etiqueta, dor, motivo, plano, modalidade, unidade ou professor | cascata no lead | nenhuma | Não. As interações antigas ficam com o nome antigo. |
| Contato registrado (mensagem, ligação, nota) | interação `note`; `lastInteractionAt` e `interactionsCount` no lead | `createdAt` da interação | Sim, desde 29/04/2026. |
| Próximo contato marcado, feito ou adiado | interação `daily_goal_done` ou `note` com `volumeKind` e `rescheduledFor`; `nextFollowUp` no lead | `createdAt` da interação | Sim. `volumeKind` desde 19/06/2026. |
| Aula experimental agendada | `stronix_aulas`, espelho no lead e interação | `scheduledFor`; `createdAt` | Sim desde 16/07/2026 (completo a partir da segunda quinzena de julho). A interação existe desde 01/06/2026, com a data marcada só no texto. |
| Visita agendada | `stronix_aulas` com `type: 'visita'` | `scheduledFor` | Sim desde 18/08/2026. Antes, só a linha do tempo e as 18 da carga inicial. |
| Remarcação | registro sobrescrito; interação com `rescheduledFor` | `createdAt` da interação | Pela interação, desde 14/05/2026. A data antiga some do registro. Visita remarcada pela Meta nem atualiza o registro. |
| Compareceu ou faltou (aula) | `stronix_aulas.status` e `outcomeAt`; espelho; interação | `outcomeAt` | Sim, desde 16/07/2026. |
| Compareceu ou faltou (visita) | espelho no lead e interação `daily_goal_done` | `createdAt` da interação | Por dedução (`src/lib/crm/appointments.js:91-104`). A correção de "faltou" para "veio" pela Agenda do dia chega ao lead e não à linha do tempo. |
| Cancelou o agendamento | aula: `status: 'cancelled'`; visita: só a interação. O espelho some | `outcomeAt` ou `createdAt` da interação | Aula, sim. Visita, só se registrado no dia marcado ou no seguinte. Só dá para cancelar pelo cartão do dia na Meta. |
| Desfazer desfecho | espelho zerado; aula volta a "agendada" (`src/lib/appointmentOutcome.js:43-53`) | nenhuma | Não. A marca antiga continua na linha do tempo. |
| Aula que levou à matrícula | `stronix_aulas.converted`; `professorId` no lead | `stronix_aulas.convertedAt` | Sim, desde 16/07/2026. A carteira no lead desde 21/07/2026. |
| Adiar para amanhã, perda ou troca de tipo com agendamento aberto | espelho apagado ou trocado; registro fica "agendada" | nenhuma | Não. O registro conta como pendente para sempre. |
| Passe livre combinado | `trialClassesPlanned` e a frase "N aulas" | `createdAt` da interação | Só lendo o texto. Não existe registro de uso de cada dia do passe. |
| Indicação feita ou removida | `referredById`, `referredAt`; interação `referral` nos dois lados | `referredAt` | Sim, desde 10/08/2026. |
| Indicado fez a primeira matrícula | interação `referral` na ficha do indicador (`src/lib/contractsWrites.js:141-154`) | `createdAt` da interação | Sim, desde 10/08/2026. |
| Marco de renovação tratado | `renewalHandledCheckpoints` e interação `daily_goal_done` "renovacao" | `createdAt` da interação | Sim, desde 23/07/2026, pela interação. |
| Não vai renovar ou não vai voltar, pela Meta | lead e interação `note` com `renewalOutcome: 'declined'` | `createdAt` da interação | Com campo e motivo da lista desde 14/09/2026. Entre 23/07 e 14/09, pela nota com texto livre. |
| Não vai renovar ou não vai voltar, pelo board | só o lead, com motivo "Outro" | `renewalDeclinedAt` | Só o estado atual, com data desde 14/09/2026. Não deixa interação. |
| Desfazer a recusa | lead zerado (`src/views/KanbanView.jsx:913` e `1010-1022`) | nenhuma | Não. A recusa some. |
| Movimento no funil Vencidos | `reactivationStageId` (`src/views/KanbanView.jsx:902-920`) | nenhuma | Não. |
| Entrada, movimento e recusa no Upgrade | `upgradeStageId`, `upgradeEnteredAt`, `upgradeDeclinedAt`; interação só com texto | `createdAt` da interação | Sim, desde 11/09/2026, lendo a frase. O motivo da recusa só existe no texto. |
| Plano criado ou alterado | `stronix_planos` | `createdAt`, `updatedAt` | Não há histórico de preço. O preço do passado sai do `listValue` dos contratos. |
| Professor cadastrado, renomeado ou excluído | `stronix_professores` | `createdAt` | Não. Renome e exclusão não deixam rastro. |
| Foto trocada | `photoUpdatedAt` | `photoUpdatedAt` | Só a última. |
| Lead excluído | nada; apaga o lead e as interações | nenhuma | Não, e muda o número de meses já fechados. Contratos e aulas dele ficam sem dono. |


## 3. Mapa de dados (parte 2: interações, Meta Diária, equipe, configuração e a história do dado)

Esta parte cobre a rotina do consultor, a equipe e as réguas da academia. A linha do tempo (`stronix_interactions`) é a única fonte com data do trabalho do dia a dia, e boa parte do que ela diz mora no texto, não em campo. A Meta Diária é calculada na hora: só a conclusão de cada tarefa e o dia batido ficam gravados. Equipe, configuração e catálogos são sobrescritos sem versão, então todo mês passado é recalculado com a equipe, as cotas e os nomes de hoje.

Os caminhos abaixo ficam em `artifacts/{academia}/public/data/`, menos `tenants/{id}` e o que está dentro dele. O "desde quando" é a entrada em produção (merge na `main`, que a Vercel publica sozinha), conferida com `git log --first-parent main`, e traz o commit ou a PR de onde saiu. As citações são caminho:linha a partir da raiz do repositório, na `main` de 24/09/2026.

### 3.1 Interações e linha do tempo (`stronix_interactions`)

É o livro de eventos do lead. Cada documento é um fato com data (`createdAt`) que o app não edita depois. Quase toda escrita passa por `logInteraction` (`src/lib/interactions.js:26-57`), que grava no mesmo lote a interação e a cópia no lead (`lastInteractionAt`, `interactionsCount`), já com o dono do lead, o autor e o nome do lead. Escrevem por conta própria: contratos (`src/lib/contractsWrites.js`), indicações (`src/lib/referralsWrites.js` e `api/tenant-resolve.js`), importação (`src/lib/clientImportWrites.js`), as duas migrações em massa (`src/views/settings/TransferLeadsTab.jsx`, `src/views/settings/ReferralOwnersSection.jsx`) e a presença marcada pela Agenda do dia (`src/lib/appointmentOutcome.js:112-135`). Essa última sai sem autor, sem nome do lead e sem atualizar `lastInteractionAt`.

Qualquer membro da academia lê e cria interação (`firestore.rules:90-92`). Para editar e apagar, a regra aceita o gestor ou quem tiver `consultantAuthUid` igual ao próprio login (`firestore.rules:93-94`), mas nenhuma interação grava esse campo: o que vai é `leadConsultantAuthUid` (`src/lib/leads.js:267-270`). Na prática, só o gestor. Excluir um lead apaga as interações dele junto (`src/views/LeadProfileView.jsx:216-236`), e só o gestor vê o botão (`src/views/LeadProfileView.jsx:1319-1321`). O mês passado perde esses eventos, mas contratos e agendamentos do lead ficam.

Custo: o mês é lido por intervalo de `createdAt`, com índice automático de campo único (`src/lib/operacional/queries.js:20`). A ficha lê por `leadId` com `createdAt` decrescente (`src/hooks/useLeadTimeline.js:5`). Filtrar por autor (`actorAuthUid`) no servidor pediria um índice composto que hoje não existe. O dia de cada evento é calculado no fuso do navegador (`dgDateKey`).

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `leadId` | Lead ou cliente a que o evento pertence. Chave da linha do tempo da ficha. | Todo caminho de escrita, a partir de `src/lib/interactions.js:31`. As notas de migração não levam: `src/views/settings/TransferLeadsTab.jsx:166-173` omite o campo e `src/views/settings/ReferralOwnersSection.jsx:141` grava `null` | 29/04/2026 (primeiro commit, `e07e9f4`) | Cruzar o evento com o lead (etapa, origem, dono de hoje). A nota de migração fica solta e não aparece em ficha nenhuma. |
| `createdAt` | Instante do evento, com a hora do servidor, no navegador e na API. | `src/lib/interactions.js:41`; `src/lib/appointmentOutcome.js:121`, `133`; `src/lib/contractsWrites.js:54`, `133`, `152`; `src/lib/clientImportWrites.js:133`; `api/tenant-resolve.js:239`, `312`, `331` | 29/04/2026 | Base de toda série por dia e por mês. Não é sobrescrito. |
| `type` | Uma de cinco classes: `note`, `status_change`, `daily_goal_done`, `referral`, `import`. Detalhe em 3.2. | Todos os pontos de escrita | `note` e `status_change` desde 29/04/2026; `daily_goal_done` desde 14/05/2026 (PR #11); `referral` desde 10/08/2026 (PR #171); `import` desde 04/09/2026 (PR #195) | Primeiro corte de qualquer relatório. Conversa, agendamento e anotação dividem o `note`, então o subtipo sai do texto. |
| `text` | Texto do evento. Os começos fixos fazem papel de subtipo (tabela de 3.2). | Mesmos pontos do `type` | 29/04/2026. Abas de WhatsApp e Ligação no composer desde 14/05/2026 (PR #16). Ano na data do agendamento desde 30/06/2026 (commit `3bb30d5`, PR #123) | Única fonte do canal, da data prevista do agendamento feito pela ficha, do motivo do reagendamento e do delegado da tarefa. Mudar a redação no código quebra o relatório. |
| `consultantName` | Nome de quem fez a ação, no momento. É o único rastro de quem marcou presença pela Agenda do dia. | `src/lib/interactions.js:37`; `src/lib/appointmentOutcome.js:115`, `128`; `src/lib/contractsWrites.js:47`, `125`, `146`; `src/lib/clientImportWrites.js:122`; `src/views/settings/TransferLeadsTab.jsx:168`. Vazio no link público de indicação | 29/04/2026 | Mostrar o nome. Não serve para agrupar: renomear a pessoa não chega às interações (`src/views/settings/TeamAccessSection.jsx:265-279` só alcança os leads). |
| `leadConsultantId`, `leadConsultantAuthUid` | Dono do lead na hora do evento. Serve de permissão e de autor de reserva. | `getInteractionSecurityFields` (`src/lib/leads.js:267-270`), usado por quase todos os caminhos. Reescrito pela migração de carteira em massa (`src/views/settings/TransferLeadsTab.jsx:151-164`) | 29/04/2026 | Autor das interações sem `actorAuthUid`. Como a migração reescreve, não é confiável como dono histórico. |
| `actorId`, `actorAuthUid` | Quem fez a ação. Base da prospecção e das tarefas por pessoa (`interactionOwnerAuthUid`, `src/lib/dailyGoal.js:97-98`). | `src/lib/interactions.js:39-40`; `src/lib/contractsWrites.js:49-50`, `127-128`, `148-149`; `src/lib/clientImportWrites.js:125-126`; as duas migrações. Não grava na presença pela Agenda (`src/lib/appointmentOutcome.js:113-122`) nem no link público. Sem backfill | 13/07/2026 20:18 (commit `9824a66`, PR #137) | Produção por pessoa. A regra de criação não confere o valor contra o login (`firestore.rules:92`). |
| `leadName` | Nome do lead no momento do evento. | `src/lib/interactions.js:36`; `src/lib/referralsWrites.js:47`, `55`, `85`; `src/lib/contractsWrites.js:145`; `src/lib/clientImportWrites.js:121`; `api/tenant-resolve.js:231`, `305`, `323`. Não grava na presença pela Agenda nem nos eventos de contrato (`src/lib/contractsWrites.js:44-55`, `122-134`) | 30/07/2026 (commit `b4988a3`, PR #165) | Mostrar o nome no extrato sem ler o lead. |
| `dailyGoalCategory` | Categoria da Meta concluída: `novo_24h`, `atrasado`, `visita_hoje`, `aula_hoje`, `contato_hoje`, `renovacao`, `vencido` (`src/lib/leads.js:87-101`). | `src/views/DailyGoalView.jsx:1242`, `1330`, `1519`; `src/modals/ContactOutcomeModal.jsx:94`, `110`; `src/modals/RenewalOutcomeModal.jsx:161`, `177`; `src/lib/appointmentOutcome.js:119`. As linhas `1377` e `1408` do `DailyGoalView.jsx` só gravam no fluxo `complete`, que hoje não tem chamador (o único é `after_outcome`, linha `1274`) | 14/05/2026 (PR #11). `contato_hoje` desde 14/05/2026 (PR #13); `renovacao` desde 30/06/2026 (PR #123); `vencido` desde 17/08/2026 (PR #174) | Tarefas feitas por categoria, pessoa e dia (`tasksByType`, `src/lib/operacional/routine.js:150-175`). Só o numerador: quantas tarefas havia no dia não é gravado. |
| `appointmentOutcome` | Desfecho de visita ou aula: `attended`, `no_show`, `cancelled`, ou `rescheduled` na remarcação para outro dia. | `src/views/DailyGoalView.jsx:1243`, `1520`; `src/lib/appointmentOutcome.js:120` | 14/05/2026 (PR #10) | Comparecimento por consultor e dia. Desmarcar a presença não apaga a marca. Na Agenda do dia, uma segunda marca da mesma categoria no mesmo dia não é gravada (`src/views/DailyGoalView.jsx:1074-1084`): quem corrige "compareceu" para "não veio" deixa a primeira marca na linha do tempo e a certa só no lead. |
| `volumeKind` | Marca a ação que conta na prospecção: `visita`, `aula_experimental`, `mensagem`, `ligacao` (um agendamento criado). | `src/views/LeadProfileView.jsx:582`; `src/views/DailyGoalView.jsx:1378`, `1517`; `src/modals/ContactOutcomeModal.jsx:111`. Não grava no reagendamento de renovação (`src/modals/RenewalOutcomeModal.jsx:165-181`) nem no "contato feito" | 19/06/2026 (commit `8c13cdb`, #111) | Prospecção por pessoa e dia (`computeVolumeInRange`, `src/lib/dailyGoal.js:100-114`; `prospectionSummary`, `src/lib/operacional/routine.js:105-131`). |
| `rescheduledFor` | Nova data do contato ou do compromisso. | `src/views/DailyGoalView.jsx:1379`, `1511`; `src/modals/ContactOutcomeModal.jsx:112`. Não grava no assistente da ficha nem no reagendamento de renovação | 14/05/2026 (commit `4e223da`, PR #13) | Pontualidade do retorno (data prevista contra a data em que foi feito), só nos caminhos da Meta. |
| `fromStatus`, `toStatus`, `funnelId`, `fromFunnelId` | Troca de etapa: nome da etapa de origem e de destino como estavam na hora, e o funil (`fromFunnelId` só quando muda de funil). | `stageChangeFields` (`src/lib/stageMove.js:51-60`), usado em `src/views/KanbanView.jsx:859`, `1182`; `src/views/LeadProfileView.jsx:304`, `401`; `src/views/DailyGoalView.jsx:1258`; `src/lib/appointmentOutcome.js:132`; `src/lib/contractsWrites.js:132`. Não grava na troca de responsável, no Upgrade, no cancelamento de contrato nem na mescla de funil | 14/09/2026 18:10 (`STAGE_TRACKING_SINCE`, `src/lib/crm/scope.js:17`; PR #208) | Passagem entre etapas, tempo na etapa e etapa da perda (`src/lib/crm/stages.js`). Guarda o nome, não o id: renomear a etapa (`src/views/settings/FunnelsSection.jsx:175-190`) não reescreve os eventos. |
| `renewalOutcome`, `renewalDeclineReason` | Recusa de renovação ou de volta (`declined`), com o motivo da lista fixa. | `src/modals/RenewalOutcomeModal.jsx:155-156` | 14/09/2026 09:48 (commit `0f3237d`, PR #206) | Motivos de não renovar por consultor. A recusa feita pelo board não gera evento. |
| `importedBy`, `importSource`, `importBatchId`, `importedAt` | Rastro do lote de importação. | `src/lib/clientImportWrites.js:129-132` | 04/09/2026 (PR #195) | Separar cadastro importado de trabalho de verdade. |
| `pinned` | Nota fixada na ficha. | Não achei quem grava. É lido em `src/lib/timeline.js:120` e `src/views/LeadProfileView.jsx:1126` | Desconhecido | Nenhum. |
| `metadata.category` | Forma antiga da categoria da Meta. | Não achei quem grava. É lido em `src/lib/leads.js:122` | Anterior a 14/05/2026 | Ignorar. |

Cuidados para relatório:

- Antes de 13/07/2026 não existe autor com id. O sistema usa o dono do lead como autor de reserva, e esse dono é reescrito a cada migração de carteira em massa. A atribuição de um mês antigo muda depois de cada migração.
- A classificação da linha do tempo já depende do texto (`classifyInteraction`, `src/lib/timeline.js:52-86`). Relatório novo deve reusar essa função, não copiar os prefixos. Ela reconhece contrato pela expressão `CONTRACT_RE` (`src/lib/timeline.js:45`, `70`), que não pega "Contrato reativado..." nem o trancamento sem plano: esses aparecem na ficha como marco de etapa. Contrato se conta em `stronix_contratos`, nunca pela linha do tempo.
- As ações do suporte no "Acessar como" ficam gravadas em nome do gestor principal da academia, porque a sessão assumida é a dele (`api/impersonate.js:21-22`, `61-65`).

Fica gravado como evento com data:

- Anotação, mensagem e ligação registradas na ficha, e a observação digitada no cadastro.
- Agendamento pelo assistente da ficha, com `volumeKind`. A data prevista fica só no texto.
- Troca de etapa, perda e promoção automática a Negociação. Com origem e destino em campo desde 14/09/2026 18:10.
- Matrícula, renovação, cancelamento, trancamento, reativação e correção de contrato. O detalhe fica em `stronix_contratos`.
- Conclusão de tarefa da Meta, desfecho de visita e aula, remarcação, contato feito e reagendado, adiamento para amanhã e recusa de renovação pela Meta.
- Troca de responsável pela ficha, com quem saiu e quem entrou só por nome.
- Indicação, cadastro importado e a nota geral de cada migração em massa (sem `leadId`).

Só o estado atual:

- O botão de WhatsApp no cabeçalho da ficha (`src/views/LeadProfileView.jsx:212`) e nos cards da Meta, e o botão Ligar da Meta (`src/views/DailyGoalView.jsx:1553-1558`), só abrem o aplicativo. Não gravam nem o estado.
- Desmarcar presença zera o lead (`src/lib/appointmentOutcome.js:43-53`), mas a marca antiga continua na linha do tempo. O relatório de comparecimento pode contar presença desfeita.
- Recusa de renovação e desfazer recusa pelo board, e o movimento no funil Vencidos (`src/views/KanbanView.jsx:903-935`, `983-1020`).
- Troca de origem, dor e etiqueta no cadastro (`src/modals/ClientRegistrationModal.jsx:87`).
- Por lead, a migração de carteira em massa e a mescla de funil para Indicações.
- Exclusão de lead: apaga o lead e a linha do tempo inteira dele.

### 3.2 Tipos de interação

São cinco valores de `type`. O `note` e o `status_change` carregam vários subtipos que só o começo do texto separa. A tabela lista cada situação que grava. Onde o texto começa com um ícone, ele está descrito em palavras. "Base" quer dizer os campos de `logInteraction`: `leadId`, `leadName`, `consultantName`, `leadConsultantId`, `leadConsultantAuthUid`, `actorId`, `actorAuthUid`, `createdAt`, `type` e `text`. Quando falta algum, a linha diz.

| type | Quando é gravado | Campos que leva | Quem grava |
|---|---|---|---|
| `note` | Anotação livre na ficha, texto `Obs: ...`. | Base | `src/views/LeadProfileView.jsx:475-488`; `src/lib/profileNote.js:8-11` |
| `note` | Mensagem registrada no composer da ficha: ícone de celular e `Mensagem WhatsApp enviada: <texto>`. | Base | `src/views/LeadProfileView.jsx:598-619` (texto em `:610`) |
| `note` | Ligação registrada no composer: ícone de telefone e `Ligação: <resumo>`. | Base | `src/views/LeadProfileView.jsx:621-637` (texto em `:628`) |
| `note` | Agendamento pelo assistente da ficha (visita, aula, mensagem, ligação): ícone de sino, `<Tipo> agendada (...) p/ dd/mm/aaaa, hh:mm`, mais `tarefa de X` quando a tarefa foi passada a outra pessoa. | Base e `volumeKind`. Data prevista e delegado só no texto | `src/views/LeadProfileView.jsx:500-596` (texto em `:526`), com `src/lib/schedulePatch.js:14-71` |
| `note` | Observação digitada no cadastro: `OBSERVAÇÃO DO CADASTRO: ...`. Não conta como contato (`src/lib/leads.js:145-149`; `src/lib/crm/contact.js:20`). | Base | `src/modals/AddLeadModal.jsx:501-511` |
| `note` | Adiar para amanhã: `Contato adiado para amanhã via Meta Diária.` | Base, sem a categoria de origem | `src/views/DailyGoalView.jsx:1170-1188` |
| `note` | Motivo do reagendamento de contato, renovação ou vencido: `Motivo do reagendamento: X (...) próximo contato em <data>.` | Base | `src/modals/ContactOutcomeModal.jsx:97-114`; `src/modals/RenewalOutcomeModal.jsx:165-181` |
| `note` | Próximo contato depois do desfecho da visita ou aula, ou `Sem próximo contato agendado. Obs: ...`. Sem observação, o "sem próximo contato" não grava nada (`src/views/DailyGoalView.jsx:1416-1420`). | Base, com `volumeKind` e `rescheduledFor` quando agenda | `src/views/DailyGoalView.jsx:1342-1389`, `1395-1428` |
| `note` | Remarcação de visita ou aula no mesmo dia (`Horário ajustado`) ou depois de "não veio" (`Próxima tentativa marcada`). | Base, `volumeKind`, `rescheduledFor` | `src/views/DailyGoalView.jsx:1436-1538` (textos em `:1500-1506`) |
| `note` | Recusa de renovação ou de volta pela Meta: `Motivo da perda de renovação: <motivo>.` | Base, `renewalOutcome`, `renewalDeclineReason` | `src/modals/RenewalOutcomeModal.jsx:150-157` |
| `note` | Migração em massa: `MIGRAÇÃO: N lead(s) de [X] para [Y] (...)` ou `MIGRAÇÃO: N pessoa(s) do funil "X" para "Y".` | Sem `leadId`; `consultantName`, `actorId`, `actorAuthUid`, `createdAt` | `src/views/settings/TransferLeadsTab.jsx:166-173`; `src/views/settings/ReferralOwnersSection.jsx:140-149` |
| `status_change` | Troca de etapa pelo board (`Movido para a etapa [X] via Kanban.`) ou pela ficha (`Fase alterada para [X]`). | Base, `fromStatus`, `toStatus`, `funnelId`, `fromFunnelId` (desde 14/09/2026) | `src/views/KanbanView.jsx:840-872`; `src/views/LeadProfileView.jsx:370-414` |
| `status_change` | Perda: `Lead perdido. Motivo: X`. Conclui todas as tarefas da Meta do lead no dia (`isLeadResolvedToday`, `src/lib/leads.js:132-142`). | Base e troca de etapa | `src/views/KanbanView.jsx:1159-1205`; `src/views/LeadProfileView.jsx:275-330` |
| `status_change` | Promoção automática a Negociação depois do comparecimento: `Fase alterada para [Negociação] após comparecimento em ...` | Troca de etapa. Pela Agenda do dia sai sem `actorId`, `actorAuthUid` e `leadName` | `src/views/DailyGoalView.jsx:1254-1260`; `src/lib/appointmentOutcome.js:125-135` |
| `status_change` | Matrícula (`Matrícula realizada`) e renovação (`Renovação registrada`), com plano, valor e vigência; cancelamento, trancamento, reativação e correção de contrato. | Base sem `leadName`. Troca de etapa só na matrícula de lead | `src/lib/contractsWrites.js:19-57`, `62-165`; textos em `src/lib/contracts.js:118`, `249`, `265`, `365-367`, `398` |
| `status_change` | Funil Upgrade: `Upgrade: entrou na etapa X.`, `Upgrade: movido para a etapa X.`, `Upgrade: não quis. Motivo: X.` Sem colchetes de propósito, para não entrar na cadeia de etapas de lead. | Base, só texto | `src/lib/stageMove.js:120-142`; `src/views/KanbanView.jsx:939-981`; `src/views/LeadProfileView.jsx:281-296`, `348-366` |
| `status_change` | Troca de responsável pela ficha: `Responsável alterado de [X] para [Y].` Tem colchetes e não tem `toStatus`: quem procurar etapa no texto precisa separar (`src/lib/crm/contact.js:9-12`). | Base, sem ids de origem e destino | `src/modals/ClientRegistrationModal.jsx:66-97`; texto em `src/lib/clientRegistration.js:109` |
| `daily_goal_done` | Conclusão simples de tarefa da Meta (sobretudo Novo lead 24h): sinal de visto, categoria e `Meta Diária concluída.` Só pede confirmação, não pede o canal. | Base e `dailyGoalCategory` | `src/views/DailyGoalView.jsx:1282-1338` |
| `daily_goal_done` | Desfecho de visita ou aula marcado na Meta (compareceu, não veio, cancelou). | Base, `dailyGoalCategory`, `appointmentOutcome` | `src/views/DailyGoalView.jsx:1190-1280` |
| `daily_goal_done` | Presença marcada pela Agenda do dia, inclusive em lead de colega. Só grava se ainda não há marca da mesma categoria no dia. Entre 13/07 e 30/07/2026 o mesmo caminho servia ao atalho de presença das Aulas (PR #135), trocado pela Agenda na PR #166. | `leadId`, `consultantName`, dono do lead, `dailyGoalCategory`, `appointmentOutcome`, `createdAt`. Sem `actorId`, `actorAuthUid` e `leadName` | `src/views/DailyGoalView.jsx:1051-1104`; `src/lib/appointmentOutcome.js:112-123` |
| `daily_goal_done` | Remarcação de visita ou aula para outro dia: ícone de setas e `Remarcou <tipo> para <data> às <hora>`. | Base, `dailyGoalCategory`, `appointmentOutcome` igual a `rescheduled`, `volumeKind`, `rescheduledFor` | `src/views/DailyGoalView.jsx:1436-1538` (texto em `:1505`) |
| `daily_goal_done` | Contato feito, em Contato hoje ou Atrasado: `... Meta Diária concluída (contato feito).` O canal não é gravado e não conta na prospecção. | Base e `dailyGoalCategory` | `src/modals/ContactOutcomeModal.jsx:88-96` |
| `daily_goal_done` | Contato reagendado: `... Meta Diária concluída (contato reagendado para <data>).` Sai junto com a nota do motivo. | Base, `dailyGoalCategory`, `volumeKind`, `rescheduledFor` | `src/modals/ContactOutcomeModal.jsx:97-114` |
| `daily_goal_done` | Renovação ou vencido: não vai renovar, ou reagendar o contato. Não conta na prospecção. | Base e `dailyGoalCategory`, sem `volumeKind` | `src/modals/RenewalOutcomeModal.jsx:150-181` |
| `referral` | Vínculo de indicação criado ou removido, cadastro pelo link público, tentativa pelo link de quem já existe e conversão do indicado (textos em 3.7). Não conta como contato. | Base. No link público, sem autor e com `consultantName` vazio. No aviso de conversão, o `leadId` é o indicador, mas o dono gravado é o do indicado (`src/lib/contractsWrites.js:143-147`) | `src/lib/referralsWrites.js:30-98`; `src/lib/contractsWrites.js:141-155`; `api/tenant-resolve.js:227-240`, `295-333` |
| `import` | Cadastro importado de planilha. Não mexe em `lastInteractionAt`. | Base, com o dono vindo da planilha, mais `importedBy`, `importSource`, `importBatchId`, `importedAt` | `src/lib/clientImportWrites.js:116-134` |

### 3.3 Histórico da Meta Diária (`stronix_daily_goal_history`) e rotina no lead

A Meta Diária não é gravada. `computeDailyGoalSlots` (`src/lib/dailyGoal.js:286-446`) monta a lista na hora, a partir do estado de hoje dos leads e das interações do mês, em sete categorias: novo lead 24h, atrasado, visita hoje, aula hoje, contato hoje, renovação por marco e vencido. Uma tarefa conta como feita se existe `daily_goal_done` daquela categoria criado hoje, ou se o lead virou Venda ou Perda hoje (`isLeadResolvedToday`, `src/lib/leads.js:132-142`). Adiar para amanhã tira a tarefa de Contato, Atrasado e Vencido da conta do dia sem concluí-la.

O que fica é pouco: cada conclusão, como evento, e o dia batido, em `stronix_daily_goal_history`, um documento por pessoa por dia (`{consultantId}_{AAAA-MM-DD}`). O próprio código admite que a carteira do dia não se reconstrói (`src/views/team/useTeamBoard.js:137-140`), e o painel da equipe avisa isso na tela (`src/views/DailyGoalTeamView.jsx:109`). A prospecção, ao contrário, se recalcula inteira para qualquer dia, porque sai das interações com `volumeKind` e dos leads criados.

O dia batido só é gravado com a sessão da própria pessoa aberta, pendência zero e pelo menos uma tarefa (`goalHitKeyToRecord`, `src/lib/dailyGoalHistory.js:29-34`). Até 14/09/2026 isso só acontecia com a tela da Meta aberta. Desde a PR #206 (commit `75400c9`) vale para qualquer tela (`src/App.jsx:1425-1441`). Quem zerou a Meta pelo Pipeline antes disso pode estar sem o dia. Só a própria pessoa cria e atualiza o documento, e ninguém apaga (`firestore.rules:206-217`). Toda a equipe lê os dias de todos desde a mesma PR (`firestore.rules:206-207`). A leitura é barata: uma consulta por `date` a partir de um dia (`goalHistorySinceSpec`, `src/lib/operacional/queries.js:22-25`).

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `stronix_daily_goal_history.consultantId`, `consultantAuthUid` | Pessoa que zerou a Meta do dia. | `src/lib/dailyGoalHistory.js:13-14`, chamado por `src/App.jsx:1425-1441` e `src/views/DailyGoalView.jsx:1152-1168` | 03/06/2026 (commit `237257d`, PR #67) | Dias batidos por pessoa. |
| `consultantName` | Nome no momento da gravação. | `src/lib/dailyGoalHistory.js:15` | 03/06/2026 | Só exibição. Regravado a cada gravação do mesmo dia. |
| `date` | Dia local `AAAA-MM-DD` em que a pessoa zerou as pendências tendo pelo menos uma tarefa. | `src/lib/dailyGoalHistory.js:16`, `38` | 03/06/2026 | Numerador de "X de Y dias batidos" (`computeRitmo`, `src/lib/dailyGoal.js:461-498`; `metaDaysSummary`, `src/lib/operacional/routine.js:34-47`). Dia sem documento pode ser "não bateu", "não abriu o app" ou "dia sem tarefa", e os três ficam iguais. |
| `hitAt` | Hora da última gravação do documento do dia, não da primeira vez que bateu. | `src/lib/dailyGoalHistory.js:42` | 03/06/2026 | Não responde "a que horas bateu a meta". |
| `volumeCount`, `volumeTarget` | Prospecção feita e cota do dia na última gravação feita pela tela da Meta. | `src/lib/dailyGoalHistory.js:17`, só com cota maior que zero e vindo de `src/views/DailyGoalView.jsx:1165`. A gravação do `App.jsx` (`:1439`) não passa volume | 19/06/2026 (#111) | Única foto da cota de um dia passado, e só em dia batido. A prospecção do dia deve ser recalculada das interações e dos leads criados. |
| `stronix_leads.nextFollowUp`, `nextFollowUpType`, `nextFollowUpNote` | Próximo toque marcado (data e tipo: Mensagem, Ligação, Visita, Aula Experimental) e a observação. Decide Atrasado, Contato hoje e a saída do Vencidos. | `src/lib/schedulePatch.js:32-37`; `src/lib/contactGoal.js:27-47`; `src/lib/renewalGoal.js:166-169`; `src/views/DailyGoalView.jsx:1178`, `1361-1362`, `1411-1412`, `1484-1487`; `src/lib/appointmentOutcome.js:99`; `src/lib/contractsWrites.js:112`; `src/views/KanbanView.jsx:1188`; `src/views/LeadProfileView.jsx:309` | 29/04/2026 | Atrasados agora, agenda futura, lead sem próximo passo. O valor anterior se perde a cada agendamento, conclusão, perda ou matrícula. |
| `nextFollowUpOwnerId`, `nextFollowUpOwnerName` | Dono da tarefa de contato quando ela foi passada a outra pessoa. Vazio quer dizer o dono do lead (`contactOwnerId`, `src/lib/leads.js:244`). | `src/lib/schedulePatch.js:46-47` | 18/08/2026 (commit `bd63bc5`, #181) | Delegação só de hoje. No histórico, só no texto `tarefa de X`. |
| `appointmentOutcome`, `appointmentOutcomeAt`, `appointmentOutcomeBy` | Desfecho do compromisso atual e o login de quem marcou. | `src/lib/appointmentOutcome.js:85-89`; `src/views/DailyGoalView.jsx:1214-1222`. Zerados em `src/lib/schedulePatch.js:66-68` e `src/lib/appointmentOutcome.js:44-48` | 14/05/2026 (PR #10) | Quem confirmou a presença pela Agenda do dia só existe aqui, e só até o próximo agendamento. |
| `lastInteractionAt`, `interactionsCount` | Última interação e total, copiados no lead para a temperatura. | `src/lib/interactions.js:48-49`; `src/lib/contractsWrites.js:40`, `105-106`; `src/lib/referralsWrites.js:39-40`, `77-78`; `api/tenant-resolve.js:288-289`. Não atualizam na presença pela Agenda nem na importação | 13/07/2026 (PR #137), com backfill (PR #140) | Carteira sem toque há X dias, como foto de agora. Fica defasado quando o último toque foi presença pela Agenda. |

Fica gravado como evento com data:

- Cada tarefa concluída, com a categoria e, em visita e aula, o desfecho (desde 14/05/2026).
- Cada agendamento que conta na prospecção (`volumeKind`, desde 19/06/2026) e cada lead criado (`stronix_leads.createdAt`). Entre 19/06 e 13/07/2026 a tela mostrava os agendamentos da prospecção zerados, porque o filtro olhava um campo que nenhuma interação grava, mas o dado está no banco (`scripts/volume-audit-report.js:1-8`).
- O dia batido, por pessoa (desde 03/06/2026).

Só o estado atual:

- A carteira do dia: quantas tarefas havia em cada categoria e quantas ficaram pendentes.
- O dia não batido.
- Os atrasados e quantos dias cada um passou do prazo (`src/lib/dailyGoal.js:257-265`; `overdueNow`, `src/lib/operacional/routine.js:180-192`). Fica só a conclusão da tarefa `atrasado`.
- O próximo contato, a delegação da tarefa e quem marcou a presença.
- A cota de prospecção e os dias da semana da meta. O Operacional aplica os de hoje aos meses passados (`src/lib/operacional/routine.js:108`).
- A hora em que a meta foi batida.

### 3.4 Usuários, papéis e unidades

Dentro da academia há dois papéis: `admin`, que a tela chama de Gestor, e `consultant`, o Consultor. O super-admin é uma marca no login, fora da academia. Professor não é usuário: é um item de cadastro sem login (`stronix_professores`). Também não existe papel de dono. O dono é o gestor principal gravado em `tenants/{id}.primaryAdminUid`, com as mesmas permissões dos outros gestores.

A separação entre academias vem da marca `tenantId` no login: tudo vive em `artifacts/{academia}/...` e as regras exigem que as duas batam (`firestore.rules:19-21`). Academia suspensa, com teste vencido sem pagamento ou com mais de 3 dias de atraso perde a leitura dos dados (`tenantActive`, `firestore.rules:31-48`). A lista da equipe e o documento `tenants/{id}` continuam legíveis nesse caso (`firestore.rules:121`, `261`). Dentro da academia, todo membro lê todas as coleções, inclusive contratos com valor e o e-mail de todos. Qualquer relatório pode ser calculado no navegador de qualquer papel, então restringir um relatório ao gestor hoje é decisão de tela, não segredo. As três Visões gerais já abrem para todos (`src/lib/routes.js:52-55`), e a lista da equipe chega completa para todos: ao vivo para o gestor e numa leitura por sessão para o consultor (`src/App.jsx:838-853`).

O sistema não guarda o ciclo de vida da pessoa. Não existe estado de desligado: `active` é lido, mas não achei quem grava. A saída é a exclusão do cadastro e da conta de login (`api/admin-users.js:238-247`), sem registro de auditoria. Nome, e-mail, turno e cota são sobrescritos sem data. Por isso os meses passados são recalculados com a equipe e as cotas de hoje, e quem saiu vira "Outros" (`OTHERS_ID`, `src/lib/operacional/routine.js:10`; `src/lib/crm/scope.js:49-61`). O Gerencial preserva o ex-consultor pelo nome gravado no contrato (`src/lib/gerencial/people.js:37-38`).

Privacidade: o documento `tenants/{id}` é lido por todo membro da academia (`firestore.rules:260-262`) e carrega `internalNotes`, `monthlyPrice`, `primaryAdminEmail` e `lastInvoiceUrl`. Um relatório não deve ler nem repetir esses campos.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `stronix_users.name` | Nome exibido. | `api/admin-users.js:106`; `api/invite-accept.js:114`; `api/provision-tenant.js:310`; edição em `src/views/settings/TeamAccessSection.jsx:250` | 29/04/2026 | Rótulo. Renomear só chega a `stronix_leads.consultantName` (`src/views/settings/TeamAccessSection.jsx:265-279`); contratos, interações, aulas e dias batidos guardam o nome antigo. Agrupar sempre pelo id. |
| `email` | E-mail de login. | Criação, edição (`src/views/settings/TeamAccessSection.jsx:251`) e vínculo no primeiro login (`src/App.jsx:575-580`) | 29/04/2026 | Identificação. Todo membro lê o de todos (`firestore.rules:121`). |
| `authUid` | Liga o cadastro à conta de login. É o valor que vai em `actorAuthUid` e `consultantAuthUid`. | `api/admin-users.js:108`; `api/invite-accept.js:116`; `src/App.jsx:575-580`. As regras proíbem trocar (`firestore.rules:124`) | 29/04/2026 | Juntar interações com a pessoa. Em cadastro antigo o `authUid` difere do id do documento: leads e contratos juntam pelo id, interações pelo `authUid`. |
| `role` | `admin` (Gestor) ou `consultant` (Consultor). Cadastro antigo pode vir sem. | Só na criação: `api/admin-users.js:109` (sempre consultor), `api/invite-accept.js:117` (papel do convite), `api/provision-tenant.js:312` (gestor). Nenhuma tela troca o papel | 29/04/2026 | Separar gestor de consultor. Sem papel conta como consultor nas vagas (`api/_plans.js:175-191`). Os painéis não tiram o gestor da meta nem do ranking. |
| `createdAt` | Entrada da pessoa no sistema. | `api/admin-users.js:111`; `api/invite-accept.js:119`; `api/provision-tenant.js:314` | 29/04/2026; pode faltar em cadastro antigo | Nenhum leitor no app. É a única data de entrada e some junto com a exclusão. |
| `shiftStart`, `shiftEnd` | Turno declarado (`HH:MM`). | `src/views/settings/TeamAccessSection.jsx:255-256` | 13/05/2026 (commit `22bda46`, PR #3) | Só aparece na tabela da equipe. Sem histórico. |
| `dailyVolumeTarget` | Cota diária de prospecção, de 1 a 500. Vazio ou zero desliga. | `src/views/settings/TeamAccessSection.jsx:259-261`; `src/views/settings/PaceSection.jsx:125-128` | 19/06/2026 (#111); só individual desde 13/07/2026 (PR #135) | Alvo da prospecção (`volumeTargetFor`, `src/lib/dailyGoal.js:251-255`). O mês passado usa a cota de hoje. |
| `lastSeenReferralsAtMs` | Último "já li" do sino. | `src/hooks/useNotificationsSeen.js:44-48` (falha em cadastro antigo com id diferente do login) | 10/08/2026 (PR #171) | Indício fraco de uso. Não é registro de acesso. |
| `active` | Se a pessoa ainda está na equipe. | Não achei quem grava. Lido em `src/modals/ClientRegistrationModal.jsx:49` e `src/views/LeadProfileView.jsx:496` | Nunca gravado | Na prática sempre verdadeiro. |
| `stronix_units.name`, `address`, `order`, `createdAt`, `updatedAt` | Unidade onde a visita acontece. | `src/views/settings/SchedulingSection.jsx:180-232`, só gestor (`firestore.rules:171-174`) | 01/06/2026 (commit `eda7542`, PR #27) | A visita aponta a unidade pelo nome (`src/lib/schedulePatch.js:60`; `src/lib/aulasWrites.js:16`). Renomear só chega a `stronix_leads.appointmentUnit` (`src/views/settings/SchedulingSection.jsx:196-203`); `stronix_aulas.unit` fica com o nome antigo. Lead, contrato e usuário não têm unidade. Sem campo de ativa; excluir apaga de vez. |
| `stronix_professores.nome`, `modalidadeIds`, `ativo` | Professor de aula experimental, sem login e sem vaga. | `src/views/settings/TeamAccessSection.jsx:393-414`, só gestor (`firestore.rules:176-179`) | 09/07/2026 (PR #132) | Renomear só chega a `stronix_leads.appointmentProfessorName`; `stronix_aulas.professorName` fica com o nome antigo. `ativo` é sempre verdadeiro (não achei quem grava falso). Excluir apaga de vez (`TeamAccessSection.jsx:433`). |
| `tenants/{id}/invites` (`email`, `role`, `status`, `expiresAt`, `createdAt`, `createdBy`, `acceptedAt`, `acceptedUid`) | Convite para a equipe. | `api/invite-create.js:66-75`; `api/invite-accept.js:76`, `123-126` | 02/06/2026 (commit `3779dd3`, PR #39) | Gestor e super-admin leem (`firestore.rules:266-269`); nenhuma tela lista. `expired` só é gravado quando alguém tenta aceitar fora do prazo. |
| `tenants/{id}` (`status`, `plan`, `trialEndsAt`, `statusChangedAt`, `primaryAdminUid`, cobrança) | Situação da academia na plataforma. | Só pelas funções: `api/provision-tenant.js`, `api/tenant-status.js:123-235`, `api/asaas.js` | Desde o provisionamento | Bloqueio no login e painel do super-admin. `statusChangedAt` guarda só a última troca. |

Fica gravado como evento com data:

- Convite criado e aceito (`createdAt`, `acceptedAt`).
- Autor de cada ação na linha do tempo, desde 13/07/2026.
- Dia batido de cada pessoa, desde 03/06/2026.
- Troca de responsável de um lead pela ficha, desde 26/08/2026, só por nome.
- Entrada e saída do super-admin numa academia (`superadmin_audit`, `api/impersonate.js:42`, `66-69`) e pagamento da mensalidade da academia (`tenant_payments`). Só o super-admin lê.

Só o estado atual:

- Entrada da pessoa: `createdAt` some quando ela é excluída.
- Saída da pessoa: não fica registrada em lugar nenhum.
- Nome, e-mail, turno, cota e papel.
- Senha redefinida pelo gestor: só na conta de login (`api/admin-users.js:167`).
- Acesso e login: não achei `lastLoginAt` nem registro de sessão. O uso só se infere pelas interações com `actorId`.
- Unidade e professor renomeados ou excluídos.

### 3.5 Configuração e catálogos

A configuração da academia é um documento só (`stronix_config/general`) e mais os catálogos pequenos, assinados ao vivo por todo usuário logado (`src/App.jsx:717-834`). Só o gestor grava (`firestore.rules:136-192`). Os catálogos são o vocabulário do lead, mas o lead guarda o nome, não o id: `source`, `status`, `lossReason`, `dor`, `tags`, `appointmentModality`, `appointmentUnit` e `currentPlanName` são texto. Renomear um item regrava só os leads (`src/views/settings/CatalogsSection.jsx:152-161`; `src/views/settings/FunnelsSection.jsx:180-190`; `src/views/settings/SchedulingSection.jsx:132-141`, `196-204`). As interações, os registros de `stronix_aulas` e os contratos continuam com o nome antigo (o contrato tem `planId` estável). Excluir apaga de vez e só é bloqueado quando algum lead usa o nome hoje.

Não há histórico de configuração. Dias de meta, limiar de atraso, marcos de renovação, janela do Vencidos e cota de prospecção são sobrescritos sem autor e sem valor anterior, e o Operacional recalcula os meses passados com a configuração de hoje. A única foto antiga é a cota gravada nos dias batidos.

Também há grafias fora do catálogo: o cadastro completo usa uma lista fixa de 8 origens (`src/modals/ClientRegistrationModal.jsx:22`), a importação grava `Importação <sistema>` (`src/lib/clientImport.js:565`), o link público grava `Indicação` fixo (`api/tenant-resolve.js:267`), o cadastro completo aceita etiqueta livre (`src/modals/ClientRegistrationModal.jsx:229`) e a importação grava `VIP` (`src/lib/clientImport.js:612`). Um relatório por origem ou etiqueta precisa juntar essas grafias.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `stronix_config/general.metaWeekdays` | Dias da semana em que a Meta cobra (0 é domingo). Padrão de segunda a sexta. | `src/views/settings/PaceSection.jsx:91-105` | 03/06/2026 (PR #67) | Dias de meta de qualquer mês no Operacional (`src/lib/operacional/metrics.js:114`). Mudar hoje muda o denominador dos meses passados. |
| `slaOverdueDays` | Dias de atraso a partir dos quais o atrasado é crítico. Padrão 3. | `src/views/settings/PaceSection.jsx:107-115` | 10/06/2026 (PR #107) | Atrasado crítico, sempre com o limiar de hoje. |
| `renewalCheckpoints` | Marcos em dias antes do vencimento. Padrão 90, 60 e 30. | `src/views/settings/PaceSection.jsx:146-174` | 23/07/2026 (PR #157) | Tarefa de Renovação, colunas do funil Renovações, cartão do Stronizap (`api/zap.js:104-106`) e marcos do Operacional. Aplicados ao passado com o valor de hoje. |
| `renewalGraceDays` | Quantos dias depois do vencimento o cliente segue cobrado na Meta. Padrão 15. | `src/views/settings/PaceSection.jsx:136-144` | 28/07/2026 (PR #162); usado pela categoria Vencido desde 17/08/2026 (PR #174) | Churn e coorte de renovação do Operacional (`src/lib/operacional/metrics.js:77-88`), recalculados com o valor de hoje. |
| `trialClassOptions` | Pacotes de aula experimental. Padrão 1, 2 e 3. | `src/views/settings/SchedulingSection.jsx:236-263`; semente em `api/provision-tenant.js:59-63` | 01/06/2026 (PR #26) | Valores possíveis de `trialClassesPlanned`, que só vive no lead e não vai para `stronix_aulas`. |
| `contractThresholdDays` | Janela de "a vencer". | Não achei quem grava nem quem lê do documento. O app fixa 30 (`src/App.jsx:331`) | Não se aplica | Tratar como 30. |
| `maxTrialClasses`, `dailyVolumeTarget` (no documento da academia) | Formatos antigos. | Não achei quem grava hoje. O `dailyVolumeTarget` do documento é lido em `src/App.jsx:823` e ignorado por `volumeTargetFor` | Legado | Não usar. |
| `funnelsSetupDoneAt`, `referralSetupDoneAt`, `expiredFunnelSetupV2DoneAt`, `renewalFunnelSetupDoneAt`, `upgradeFunnelSetupDoneAt` | Carimbo de que a configuração de funis, e cada funil de sistema, rodou nesta academia. | `src/App.jsx:1016-1238`, no primeiro login de gestor | Funis 28/07/2026 (PR #164); Indicações 10/08/2026 (PR #171); Vencidos 19/08/2026 (#185); Renovações 26/08/2026 (PR #190); Upgrade 11/09/2026 (PR #199) | Piso do histórico de cada funil de sistema, academia por academia. |
| `updatedAt` | Hora da última gravação de qualquer campo do documento. | `src/views/settings/PaceSection.jsx:86`; `src/views/settings/SchedulingSection.jsx:241` | Desde as telas atuais | Não diz o que mudou nem quem mudou. |
| `stronix_sources.name` | Nome da origem, que é o valor de `lead.source`. | `src/views/settings/CatalogsSection.jsx:137-175`; semente em `api/provision-tenant.js:47-49` (Instagram, Facebook, Indicação, Passeio, Google, WhatsApp, Outros); `Indicação` com id `origem-indicacao` quando falta (`src/lib/funnelSetup.js:22`) | 29/04/2026 | Canal no CRM (`src/lib/crm/cohort.js:105-116`) e no Gerencial (`src/lib/gerencial/people.js:67-71`). |
| `stronix_sources.channel` | Canal da origem (Orgânico, Pago, Offline), em texto livre. | `src/views/settings/CatalogsSection.jsx:55`, `146` | 27/07/2026 (PR #161) | Nenhum relatório usa. Pode virar um segundo nível de agrupamento, com o risco do texto livre. |
| `stronix_tags` (`name`, `description`, `color`) | Etiqueta. O lead guarda o nome em `tags`. | `src/views/settings/CatalogsSection.jsx:40-50` | 29/04/2026 | Nenhum painel usa. Troca de etiqueta no lead não deixa evento. |
| `stronix_loss_reasons` (`name`, `note`) | Motivo de perda. O lead guarda o nome em `lossReason`. | `src/views/settings/CatalogsSection.jsx:73-83`; semente em `api/provision-tenant.js:50-52` (Preço, Localização, Horário, Concorrência, Sem interesse, Sem retorno) | 29/04/2026 | Perdas por motivo (`src/lib/crm/cohort.js:83-91`). Sem catálogo, grava "Sem motivo configurado" (`src/modals/LossReasonModal.jsx:8`). O texto "Motivo: X" da interação não acompanha a renomeação. |
| `stronix_dores` (`name`, `description`) | O que o lead quer resolver. Obrigatória no cadastro manual (`src/modals/AddLeadModal.jsx:410-413`). | `src/views/settings/CatalogsSection.jsx:84-94`; não vem semeada | 30/06/2026 (commit `4646327`, PR #123) | Nenhum painel usa; só aparece como objetivo na exportação de agendamentos. Vazia no link público (`api/tenant-resolve.js:275-276`). |
| `stronix_modalities` (`name`, `color`, `order`) | Modalidade da aula experimental e do plano (o plano guarda `modalityIds`). | `src/views/settings/SchedulingSection.jsx:116-170`; semente em `api/provision-tenant.js:26-35` | 29/04/2026 | Renomear só chega a `lead.appointmentModality`; `lead.modalidade` e `stronix_aulas.modality` ficam com o nome antigo. O plano liga por id. |

Fica gravado como evento com data:

- Criação de item de catálogo (`createdAt`). Etapa de funil não tem essa data.
- Configuração de funis e criação de cada funil de sistema na academia (`*SetupDoneAt`).
- A cota do dia, só nos dias batidos (`stronix_daily_goal_history.volumeTarget`).

Só o estado atual:

- Todas as réguas: dias de meta, limiar de atraso, marcos, janela do Vencidos, pacotes de aula e cota de prospecção.
- Renomeação de item: o nome antigo se perde, e a cascata não deixa rastro no lead.
- Exclusão de item: apagado de vez, sem registro. Plano com contrato é desativado (`active` falso, `src/views/settings/CatalogsSection.jsx:259`), não apagado.
- Origem, dor e etiqueta de cada lead.

### 3.6 Funis e etapas

Os funis vivem em `stronix_funnels` e as etapas em `stronix_statuses`. Funil de sistema se reconhece pela marca `systemKind`, nunca pelo nome. Nos funis de lead, a etapa é o par funil mais nome (`lead.funnelId` e `lead.status`). Nos funis de cliente, a etapa é um id (`reactivationStageId` no Vencidos, `upgradeStageId` no Upgrade) ou um marco em dias (Renovações). A troca de etapa com origem e destino em campo só existe desde 14/09/2026 18:10. Antes, só o texto com o destino entre colchetes.

Três mudanças de tela reescrevem o passado sem avisar. Renomear etapa regrava `lead.status` e deixa as interações com o nome velho. Reordenar etapas muda o "avançou" da passagem, porque o CRM usa a ordem de hoje. Mesclar funil para Indicações (desde 13/08/2026, PR #172) muda funil e etapa sem evento por lead.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `stronix_funnels.id` | Fixo no funil padrão (`funil-padrao`) e nos de sistema (`funil-sistema-indicacoes`, `funil-sistema-upgrade`, `funil-sistema-renovacoes`, `funil-sistema-vencidos`) quando criados pela configuração nova. Aleatório nos funis criados pela tela. | `src/lib/funnelSetup.js:13-20`, `37-66`; `src/views/settings/FunnelsSection.jsx:79-82` | Id fixo desde 22/09/2026 (PRs #216 e #217). Antes, a configuração criava com id aleatório | Chave estável do funil e valor de `funnelId` nas trocas de etapa. Para achar funil de sistema, use `systemKind`. |
| `name` | Nome exibido. Travado nos de sistema. | `src/views/settings/FunnelsSection.jsx:71-75` | 29/04/2026 | Rótulo. O lead guarda `funnelId`, então renomear funil não parte nada. |
| `systemKind` | `referral`, `expired`, `renewal`, `upgrade` ou vazio. | Configuração de cada funil: `src/lib/referrals.js:69-80`, `src/lib/expiredFunnel.js:87-96`, `src/lib/renewalFunnel.js:161-170`, `src/lib/upgradeFunnel.js:69-76` | `referral` 10/08/2026 (PR #171); `expired` 19/08/2026 (#184); `renewal` 26/08/2026 (PR #190); `upgrade` 11/09/2026 (PR #199) | Separa funil de lead de funil de cliente (`src/lib/crm/scope.js:29-36`). |
| `isDefault` | Funil padrão. Recebe o lead sem `funnelId`. | `src/views/settings/FunnelsSection.jsx:100-117`; `src/App.jsx:944-961` | Desde a passagem para vários funis | Resolve lead antigo sem funil (`src/lib/funnels.js:34-39`). A troca não tem data. |
| `stronix_statuses.name` | Nome da etapa e valor de `lead.status`. | `src/views/settings/FunnelsSection.jsx:175-201` e configurações | 29/04/2026 | Passagem, carteira e etapa da perda casam por nome (`src/lib/crm/stages.js:79-83`, `107-120`, `146-156`). Renomear regrava `lead.status` dos leads carregados daquele funil (`src/views/settings/FunnelsSection.jsx:182-189`) sem evento. |
| `stronix_statuses.funnelId` | Funil dono da etapa. | `src/views/settings/FunnelsSection.jsx:198`; configurações | 29/04/2026 | Etapa com o mesmo nome em outro funil é outra etapa. |
| `stronix_statuses.order` | Posição da coluna. | `src/views/settings/FunnelsSection.jsx:224-236` | 29/04/2026 | O CRM usa a ordem de hoje para dizer se o lead avançou (`src/lib/crm/stages.js:83`, `93`). Reordenar muda o passado. |
| `isSystem`, `isEntry` | Etapa fixa (Negociação e as entradas dos funis de sistema). | Configurações; `src/views/settings/FunnelsSection.jsx:85-87` | Com cada funil de sistema | Entrada: "Aguardando ação" em Indicações, "Aguardando contato" em Vencidos e Upgrade. |
| `stronix_statuses.createdAt` | Não existe. | Não achei quem grava (`src/views/settings/FunnelsSection.jsx:197-199` e a configuração não carimbam) | Não se aplica | Não dá para saber desde quando uma etapa existe. |
| `stronix_leads.statusEnteredAt` | Entrada na etapa atual. | `withStageEntered` (`src/lib/stageMove.js:64-66`); `src/modals/AddLeadModal.jsx:477`; `src/lib/contractsWrites.js:117`; `src/lib/appointmentOutcome.js:92`. Não grava no link público, na importação nem na mescla de funil | 14/09/2026 18:08 (commit `c5e04fa`, PR #208) | Tempo parado na etapa atual. Lead que não mudou de etapa desde então não tem o campo. |
| `stronix_leads.reactivationStageId` | Etapa do cliente no funil Vencidos do board. | `src/views/KanbanView.jsx:903-919`; zerado em `src/views/KanbanView.jsx:929` e `src/lib/contracts.js:202` | 19/08/2026 (commit `6cb32b5`, #184) | Só estado de hoje, sem evento nem data. O retorno do vencido aparece como contrato novo. |
| `upgradeStageId`, `upgradeEnteredAt`, `upgradeDeclinedAt` | Etapa, entrada e última recusa no funil Upgrade. | `planUpgradeMove` e `planUpgradeDecline` (`src/lib/stageMove.js:120-142`), pela ficha e pelo board; `upgradeStageId` e `upgradeEnteredAt` zerados em todo contrato novo (`src/lib/contracts.js:206-207`), `upgradeDeclinedAt` nunca | 11/09/2026 (PR #199) | Estado de hoje. A trilha fica só no texto `Upgrade: ...`. A venda sai marcada em `closedFromUpgrade` no contrato (`src/lib/contracts.js:174`). |
| `renewalHandledCheckpoints`, `renewalDeclined`, `renewalDeclinedAt`, `renewalDeclineReason` | Marcos já tratados no ciclo (em dias) e recusa de renovação. | `src/lib/renewalGoal.js:112-171`, pela Meta (`src/modals/RenewalOutcomeModal.jsx:152`, `169`) e pelo board (`src/views/KanbanView.jsx:923-1020`); zerados em todo contrato novo (`src/lib/contracts.js:192-198`) | Marcos e recusa 23/07/2026 (PR #157); data e motivo 14/09/2026 (PR #206) | Estado do ciclo atual. Pelo board o motivo é sempre "Outro". Mudar os marcos no meio do ciclo muda o que conta como tratado. |

Fica gravado como evento com data:

- Troca de etapa de lead, com origem, destino e funil desde 14/09/2026 18:10.
- Perda, com o motivo só no texto da interação.
- Movimento e recusa no Upgrade, só como texto.
- Venda fechada dentro do Upgrade (`closedFromUpgrade`, desde 11/09/2026).
- A etapa em que o lead nasceu, recuperada pelo `fromStatus` da primeira troca (`src/lib/crm/stages.js:106-108`). Só para quem mudou de etapa depois de 14/09/2026.

Só o estado atual:

- Etapa no funil Vencidos, recusa pelo board e marcos tratados.
- Funil padrão, ordem e nome das etapas.
- A mescla de funil para Indicações (`src/views/settings/ReferralOwnersSection.jsx:131-137`): a passagem entre etapas não enxerga esse movimento.
- A entrada em etapas anteriores à atual.

### 3.7 Indicações

O vínculo de indicação é bom desde 10/08/2026 (PR #171): o lead indicado guarda quem indicou e quando, e os dois lados ganham um evento `referral` na linha do tempo. O link público (`api/tenant-resolve.js:262-332`) cria o lead com origem `Indicação` fixa, no funil de Indicações, com o consultor herdado do indicador (`api/tenant-resolve.js:283-285`), sem `statusEnteredAt` e com dor vazia. Sem um `ref` válido, não grava nada (`api/tenant-resolve.js:213-215`).

"É indicação" tem três sinais que não batem sempre: o vínculo (`referredById`), a origem `Indicação` e estar no funil de Indicações. Há cadastro com origem Indicação sem vínculo, vínculo feito depois em lead de outra origem e lead levado ao funil pela mescla. O relatório precisa escolher um sinal e dizer qual. O aviso de conversão só sai na primeira matrícula feita pelo contrato (`src/lib/contractsWrites.js:141-154`). Lead que vira cliente por etapa com nome de matrícula não gera o evento.

| Campo | O que é | Quem grava | Desde quando | Uso em relatório |
|---|---|---|---|---|
| `stronix_leads.referredById`, `referredByName`, `referredAt` | Cliente que indicou e quando o vínculo foi feito. | `commitReferralLink` (`src/lib/referralsWrites.js:28-62`), no cadastro (`src/modals/AddLeadModal.jsx:467-470`), na ficha e na fila sem dono (`src/views/settings/ReferralOwnersSection.jsx:42-55`); link público (`api/tenant-resolve.js:277-279`). `removeReferralLink` zera (`src/lib/referralsWrites.js:67-92`) | 10/08/2026 (PR #171) | Indicados por indicador e conversão da indicação. Vínculo feito depois do cadastro tem `referredAt` posterior ao `createdAt`. Trocar de indicador sobrescreve. A busca por `referredById` usa índice automático (`src/hooks/useReferrals.js:29`, `41`). |
| `referralVia` | `link` quando o cadastro veio do link público. | `api/tenant-resolve.js:282` | 10/08/2026 | Separa a indicação pelo link da manual (`src/lib/notifications.js:60`). |
| `referrerUnknown` | "Não sei quem indicou": tira o lead da fila sem vínculo. | `src/views/settings/ReferralOwnersSection.jsx:57-64` | 10/08/2026 | Fila de indicações sem dono. Sem data e sem autor. |
| `source` igual a `Indicação` | Origem fixa no modo indicação do cadastro e no link. | `src/modals/AddLeadModal.jsx:359`, `393`; `api/tenant-resolve.js:267` | 29/04/2026 (a origem existe desde o início) | Um dos três sinais. Não bate sempre com o vínculo. |
| `consultantId` do lead criado pelo link | Dono herdado do consultor do indicador. | `api/tenant-resolve.js:283-285` | 10/08/2026 | Indicação pelo link cai na carteira de quem cuida do indicador. |
| `funnelId` levado pela mescla | Funil de Indicações, com a etapa trocada em massa. | `src/views/settings/ReferralOwnersSection.jsx:125-150` | 13/08/2026 (PR #172) | Um dos três sinais. Sem evento por lead, só a nota `MIGRAÇÃO:`. |
| Interação `referral` | Textos com ícone de aperto de mão: "Indicado por X" no indicado, "Indicou X" no indicador, "Tentou se cadastrar pelo link de indicação de X." em quem já existia, "Cadastro pelo link de indicação." e "Vínculo de indicação removido.". Com ícone de festa: "X que você indicou fechou matrícula", no indicador. | `src/lib/referralsWrites.js:45-59`, `83-89`; `src/lib/contractsWrites.js:141-154`; `api/tenant-resolve.js:227-240`, `303-329`; textos em `src/lib/referrals.js:198-200` e `api/_referral.js:78-86` | 10/08/2026 | Linha do tempo dos dois lados. Não conta como contato. A tentativa de quem já existe não cria vínculo nem muda funil. |

Fica gravado como evento com data:

- Vínculo criado, trocado e removido (interação `referral`; `referredAt` no lead).
- Cadastro pelo link público (`createdAt` e `referredAt` do lead novo, mais as interações).
- Tentativa pelo link de quem já estava na base.
- Primeira matrícula do indicado, no indicador.

Só o estado atual:

- O indicador de hoje. Ao remover o vínculo, o lead perde quem era o indicador, e só a interação guarda o nome.
- A marca "não sei quem indicou".
- A mescla de funil para Indicações, por lead.

### 3.8 Linha do tempo do dado

Cada linha diz a partir de quando um relatório pode confiar num dado, e o que distorce os meses anteriores. As datas são de entrada em produção. Quando o merge tem hora que importa, ela vem junto.

| Data | O que passou a ser gravado, corrigido ou importado | Efeito nos relatórios |
|---|---|---|
| 29/04/2026 | Primeiro commit (`e07e9f4`). Lead com `createdAt`, `source`, `status`, `consultantId`, `lostAt`, `lossReason` e `convertedAt`. Interações `note` e `status_change` só com texto (`Movido para a etapa [X]`, `Lead perdido. Motivo: X`). Adiar para amanhã já existia. A migração de carteira em massa já reescrevia o dono das interações. | Piso de leads novos e de perdas. Etapa, perda e matrícula anteriores a junho só pelo estado do lead e pelo texto. Lead excluído levou junto as interações. |
| 13/05/2026 | Turno da pessoa (`shiftStart`, `shiftEnd`, PR #3). | Nenhum relatório lê. |
| 14/05/2026 | Conclusão de tarefa como `daily_goal_done` com `dailyGoalCategory` (PR #11), desfecho de visita e aula (PR #10), `rescheduledFor` e a categoria `contato_hoje` (PR #13), e o composer com WhatsApp e Ligação (PR #16). | Tarefas por categoria e comparecimento existem daqui em diante. O contato é autodeclarado e o canal fica só no texto. |
| 01/06/2026 | Assistente de agendamento na ficha, unidades e pacotes de aula (PRs #26 e #27). | Data prevista do agendamento só no texto. Unidade gravada pelo nome. |
| 02/06/2026 | Várias academias (PR #28), convites (PR #39) e fim da pesquisa de satisfação (PR #32). | Os dados das outras academias começam depois. `satisfactionScore` sobra em leads antigos da STRONIX. |
| 03/06/2026 | Dia de meta batida (`stronix_daily_goal_history`) e dias da semana da meta (PR #67). | Dias batidos daqui em diante. Até 14/09/2026 só gravava com a tela da Meta aberta. |
| 10/06/2026 | Limiar de atraso crítico (`slaOverdueDays`, PR #107). | Sem histórico do limiar. |
| 19/06/2026 | Prospecção: `volumeKind`, cota individual e a foto `volumeCount`/`volumeTarget` no dia batido (#111). | Prospecção contra a cota daqui em diante. Até 13/07/2026 a tela mostrava os agendamentos zerados, mas o dado existe (`scripts/volume-audit-report.js:1-8`). |
| 23/06/2026 | Próximo contato depois do desfecho e "Sem próximo contato agendado" (#124). | O retorno depois da visita passa a ter evento. |
| 30/06/2026 | Contratos, `clienteSince`, categoria `renovacao`, catálogo de dores e ano na data do agendamento (PR #123). A mesma PR trouxe o erro que zerava `convertedAt` e a fase de cliente ao tirar o cliente de Venda (commit `3749e8b`). | Venda com valor e primeira matrícula daqui em diante. Cliente mexido de fase entre 30/06 e 08/09/2026 pode estar com `convertedAt` vazio. |
| 13/07/2026 | De manhã (10:32), o atalho de presença nas Aulas, que grava presença sem autor, e a cota de prospecção só individual (PR #135). À noite (20:18), o autor da interação (`actorId`, `actorAuthUid`), `lastInteractionAt`, `interactionsCount` e `lifecycleBucket` (PR #137), e às 21:19 o backfill das cópias no lead (PR #140). A mesma PR #137 corrigiu a leitura da prospecção. | Produção por pessoa confiável daqui em diante. Antes, o autor é o dono do lead, e a migração reescreve esse dono. |
| 14/07/2026 | Backfill de `convertedAt` igual ao `createdAt` nos clientes antigos sem data de matrícula (commit `625673b`, PR #143). Segundo a memória do projeto, rodou na STRONIX: 314 leads varridos, 19 gravados. | Essas 19 matrículas caem no mês do cadastro, não no mês real. |
| 16/07/2026 | Histórico de aulas (`stronix_aulas`, PR #150), com backfill de uma aula por lead, e valores em centavos (PR #149). | Conversão por professor daqui em diante. Aula anterior só existe se estava marcada no lead no dia do backfill. |
| 23/07/2026 | Marcos de renovação, `renewalHandledCheckpoints`, `renewalDeclined` sem data, texto "Motivo da perda de renovação" e o pop-up de contato feito ou reagendado (PR #157). | Recusa de renovação existe como marca, sem data até 14/09/2026. Contato feito passa a ter evento próprio, sem canal. |
| 27/07/2026 | Canal da origem (`channel`) e cota na tela da equipe (PR #161). | Canal pronto para agrupar, ainda sem uso. |
| 28/07/2026 | Motivo de cancelamento, trancamento, reativação, desconto e `renewalGraceDays` (PR #162). Carimbo `funnelsSetupDoneAt`, com a configuração de funis rodando uma vez por academia (PR #164). | Cancelamento por motivo daqui em diante. Antes, `cancelReason` era sempre vazio. |
| 30/07/2026 | Nome do lead na interação (`leadName`, PR #165) e Agenda do dia no lugar do atalho das Aulas, marcando presença em lead de colega sem autor (PR #166). | Extrato com nome sem ler o lead. A presença pela Agenda credita o dono do lead, não quem marcou. |
| 10/08/2026 | Indicações: vínculo, `referralVia`, eventos `referral`, funil de Indicações e `systemKind` (PR #171). | Relatório de indicação daqui em diante. |
| 13/08/2026 | Mescla de funil para Indicações (PR #172). | Leads movidos em massa sem evento por lead. |
| 17/08/2026 | Categoria `vencido` na Meta (PR #174). | Cobrança de vencidos entra nas tarefas. |
| 18/08/2026 | Visitas no histórico (`stronix_aulas` com tipo visita, PR #177), backfill em todas as academias (#178), correção do agendamento que a mensagem apagava (#179) e delegação da tarefa de contato (`nextFollowUpOwnerId`, #181). | Agendamentos completos só de setembro em diante (`APPTS_COMPLETE_MONTH`, `src/lib/crm/scope.js:24`). A visita fica "agendada" para sempre no registro. |
| 19/08/2026 | Funil Vencidos no board, com `reactivationStageId` sem evento (#184 e #185). | Movimento no Vencidos sem histórico. |
| 26/08/2026 | Troca de responsável por qualquer consultor, com nota e `consultantChangedAt` (PR #188); reagendamento com hora (PR #189); funil Renovações criado nas academias (PR #190). | Troca de dono tem evento, em texto, daqui em diante. Antes só o gestor trocava, e sem nota. |
| 04/09/2026 | Importação de clientes: leads, contratos e interação `import` com `importBatchId` (PR #195). | 494 contratos da STRONIX sem valor (`CLAUDE.md` do Stronilead). Datas de cadastro e de matrícula vêm da planilha. |
| 08/09/2026 | Cliente não volta a lead, nem por fase nem por perda (PR #197). | Fecha a janela do `convertedAt` zerado. Não achei registro de que o reparo `scripts/fix-clients-unsold-by-stage-move.js` rodou com `--apply`. |
| 11/09/2026 | Funil Upgrade e `closedFromUpgrade` no contrato (PR #199). | Venda de upgrade separável daqui em diante. |
| 14/09/2026 09:48 | Data e motivo da recusa de renovação em campo, histórico de pausas (`pauseHistory`), dia batido gravado de qualquer tela e leitura dos dias batidos pela equipe inteira (PR #206). | Motivo de não renovar e pausas repetidas contáveis daqui em diante. |
| 14/09/2026 18:08 | Troca de etapa com origem, destino e funil, e `statusEnteredAt` (PR #208). O código só confia a partir de 18:10 (`STAGE_TRACKING_SINCE`, `src/lib/crm/scope.js:17`). | Passagem entre etapas, tempo na etapa e etapa da perda daqui em diante. |
| 17/09/2026 | Valor com ponto de milhar deixa de virar decimal (PR #213). | Segundo o `CLAUDE.md` raiz, falta corrigir os planos da Shape One, que guardam o preço mensal no campo de total. |
| 22/09/2026 | Configuração de funis com id fixo (PRs #216 e #217). | Funil novo não duplica. O relatório continua reconhecendo funil de sistema por `systemKind`. |

Até 24/09/2026, nunca foi gravado:

- A foto diária da carteira da Meta: tarefas por categoria, pendentes e atrasados.
- A mensagem que chega pelo WhatsApp. Sem ela não existe tempo de resposta (Parte B da ponte com o Stronizap, ainda sem plano).
- O canal do "contato feito".
- Entrada, saída e acesso de quem é da equipe.
- Versão da configuração (dias de meta, marcos, cota).
- Quem cadastrou o lead, separado do dono de hoje.
- O rastro por lead da migração em massa.
- O autor da presença marcada pela Agenda do dia.
- O desfecho da visita no registro de `stronix_aulas`.


## 4. O que já existe (telas, números e exportações)

O Stronilead já tem três painéis na Visão geral (Operacional, CRM e Gerencial), a Meta Diária com a visão da equipe para o gestor, cinco listas com nome de pessoa (Pipeline, Todos os leads, Clientes, Aulas e Visitas) e o super console da STRONIX. Os três painéis são mensais, comparam com outro mês e guardam o recorte no endereço (`src/lib/screenParams.js:256-265`). Nenhum deles tem trava de papel: o consultor abre os três (`src/lib/routes.js:52-55`), e a decisão está escrita em `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:22` ("Todos veem tudo").

Toda conta roda no navegador, em módulos puros e testados: `src/lib/operacional/`, `src/lib/crm/` e `src/lib/gerencial/`. Quase todas as funções recebem uma janela `{ start, end }` ou um instante `t`. O que prende as telas ao mês é a carga dos dados e o parâmetro `mes`, não a conta. Por isso esses módulos são a base natural dos Relatórios (tabela em 4.7).

Em todas as telas de número faltam as mesmas três coisas:

- Nenhum número abre a lista de pessoas por trás dele. Nenhum arquivo de `src/views/dashboard/` usa `LeadLink`, `AppLink` ou `hrefFor`, e a única saída é o botão "Ir para o pipeline" (`src/views/dashboard/GerencialParts.jsx:70`). O único painel com nome clicável é o detalhe do consultor na visão Equipe da Meta Diária, e só no mês corrente (`src/views/team/ConsultantDayDetail.jsx:96` e `180`).
- Nenhum painel exporta.
- O período é sempre o mês civil, do corrente até 11 meses atrás (`src/lib/screenParams.js:58-59`). Não existe semana, trimestre nem período livre.

As datas de "desde quando" desta seção são as do merge na main, como na seção 2.

### 4.1 Operacional

Endereço `/<academia>` ou `/<academia>/visao-geral/operacional`, com os parâmetros `mes`, `comparar`, `comparar-com` e `pessoa`. Mede o trabalho do time e a base de clientes. Tem uma função de entrada, `metricsOf(ctx, { monthKey, userId, cutEnd })` (`src/lib/operacional/metrics.js:92-184`), e a tela só desenha (`src/views/dashboard/DashboardOperacionalView.jsx:290-637`).

Lê `stronix_daily_goal_history` (um documento por pessoa por dia de meta batida), `stronix_interactions` do mês (tarefas `daily_goal_done` e ações com `volumeKind`), `stronix_leads` criados no mês mais os leads vivos da Meta, a coleção `stronix_contratos` inteira, que o App já assina ao vivo para todo usuário (`src/App.jsx:794-802`), `users` e `stronix_config/general`. Pela spec, a primeira abertura custa de 250 a 450 leituras com o cache do aparelho e cerca de 3.500 sem cache, com uns 600 documentos por mês fechado (`docs/superpowers/specs/2026-09-11-operacional-mensal-design.md:182-185`).

| Número ou gráfico | Definição | Recorte | Onde está a conta |
|---|---|---|---|
| Meta diária (faixa) | Dias de meta já fechados com meta batida ÷ dias de meta fechados no mês. Hoje fica fora. Na equipe, soma os dias de cada usuário atual | Mês; pessoa ou equipe; diferença em p.p.; tendência de 6 meses | `src/lib/operacional/routine.js:34-54`; `src/lib/operacional/metrics.js:130,147` |
| Prospecção (faixa) | Ações ÷ alvo. Ações: leads criados em dia de meta com `consultantId` da pessoa, sem importados, mais interações com `volumeKind` feitas por ela. Alvo: `dailyVolumeTarget` de hoje × dias de meta decorridos, contando hoje. Alvo 0 mostra "Desligada" | Mês; pessoa ou equipe (só quem tem alvo); p.p. e tendência | `src/lib/operacional/routine.js:105-148`; `src/lib/operacional/metrics.js:131-132,150` |
| Clientes ativos | Pessoas com contrato vigente no fim do mês (ou agora, no mês corrente), sem contar duas vezes quem tem dois contratos. Trancado fica fora e aparece na dica | Mês; sempre a academia inteira; diferença absoluta e tendência | `src/lib/operacional/base.js:120-150`; `src/lib/operacional/metrics.js:155,157` |
| Churn | Saídas definitivas no mês ÷ ativos no início, em % com uma casa. Saída é o cancelamento no app sem outro contrato valendo, ou o fim da tolerância (`renewalGraceDays`) de contrato vencido sem retorno. Trancar não é sair | Mês; academia; p.p. e tendência | `src/lib/operacional/base.js:252-280`; `src/lib/operacional/metrics.js:83` |
| Taxa de renovação | Renovou ÷ (renovou + não vai renovar + venceu sem renovar), na coorte de contratos com `endsAt` no mês. Ficam fora os cancelados antes do fim e os trancados com pausa aberta. Importados entram. Sucessor é `renewedFromId` ou outro contrato da pessoa criado até `endsAt` mais a tolerância | Mês; pessoa pelo responsável atual do lead; p.p. e tendência | `src/lib/operacional/renewal.js:35-114`; `src/lib/operacional/metrics.js:86,166` |
| Tendências | `metricsOf` dos 6 meses até o exibido. Mês sem valor fica fora e o rótulo diz quantos meses entraram | 6 meses; meta, prospecção e renovação por pessoa; ativos e churn da academia | `src/lib/operacional/metrics.js:258-264` |
| Diferença contra o mês comparado | Valor exibido menos o comparado. Taxa em p.p., contagem em número. "sem base" quando falta um lado. No mês corrente, o comparado é cortado no mesmo tempo decorrido | Um dos 12 meses anteriores ou o mesmo mês do ano anterior | `src/lib/operacional/metrics.js:188-195`; `src/lib/operacional/month.js:36-43,61-67` |
| Destaques | As 3 maiores variações entre tarefas por tipo, contatos nos marcos, upgrades, cancelamentos por motivo e renovação antes, no dia ou depois do fim. Taxa pesa pela diferença em p.p.; contagem, pela diferença ÷ o maior valor entre o comparado e 4, × 60 | Só com Comparar ligado; pessoa ou equipe | `src/lib/operacional/metrics.js:215-254`; `src/views/dashboard/DashHighlights.jsx:46-69` |
| Prospecção por dia | Colunas com as ações por dia de meta e linha com a soma dos alvos. Coluna laranja quando bate o alvo | Mês; pessoa ou equipe; sem comparativo; some com a prospecção desligada | `src/lib/operacional/routine.js:105-148`; `src/views/dashboard/ProspectionByDay.jsx:8-63` |
| Régua dos dias de meta | Pessoa: bateu ou não em cada dia. Equipe: quantos bateram em cada dia, em 4 tons. Dia futuro tracejado | Mês; pessoa ou equipe | `src/lib/operacional/routine.js:56-91`; `src/views/dashboard/MetaDaysCalendar.jsx:28-129` |
| Tarefas concluídas por tipo | `daily_goal_done` do mês por categoria (novos, contatos, visitas e aulas, atrasados, renovações, vencidos), uma por lead, categoria, dia e autor | Mês; pessoa pelo autor, equipe ou Outros; marca do mês comparado | `src/lib/operacional/routine.js:12-29,150-175` |
| Atrasados agora | Leads da Meta fora de Venda e Perda com `nextFollowUp` antes de hoje, por `consultantId`. Quem não é da equipe vai para Outros | Foto de agora, só no mês corrente; pessoa ou equipe | `src/lib/operacional/routine.js:177-192`; `src/lib/operacional/metrics.js:152` |
| Movimento da base (ponte) | Vigentes no início; entradas (entraram, voltaram, importados); saídas (cancelaram, venceram); saldo de trancamentos; vigentes no fim. Início mais os passos dá o fim | Mês; academia; sem comparativo | `src/lib/operacional/base.js:201-250`; `src/views/dashboard/BaseBridge.jsx:14-112` |
| Cancelamentos por motivo | Contratos com `cancelledAt` no mês por `cancelReason` ("Outro" sem motivo), fora os gravados pela importação. Conta contrato, não pessoa | Mês; academia | `src/lib/operacional/base.js:285-294` |
| Upgrades | Contratos com `closedFromUpgrade` e `createdAt` no mês, sem importados, pelo consultor gravado no contrato | Mês; pessoa pelo vendedor; diferença absoluta | `src/lib/operacional/base.js:296-314`; `src/lib/operacional/metrics.js:164-165` |
| Trancamentos | Pessoas com pausa iniciada no mês (trancaram, sem a pausa da importação) ou encerrada no mês (destrancaram). Saldo é destrancaram menos trancaram | Mês; academia | `src/lib/operacional/base.js:180-199,246` |
| Contratos vencendo no mês | Barra com Renovou, Não vai renovar, Venceu sem renovar e Ainda vai vencer (este só no mês corrente) | Mês; pessoa pelo responsável atual | `src/lib/operacional/renewal.js:62-114`; `src/views/dashboard/RenewalOutcomeBar.jsx:25-99` |
| Quando renovou | Renovações da coorte pelo dia em que o sucessor foi criado: antes do fim, no dia, ou depois, dentro da tolerância | Mês; pessoa | `src/lib/operacional/renewal.js:76-80,95-99` |
| Contatos nos marcos | Para cada marco: contratos que cruzaram o marco no mês ainda vigentes e sem sucessor. Feito é a tarefa de renovação de qualquer autor, ou sucessor criado antes do marco seguinte. % = feitos ÷ total | Mês; pessoa pelo responsável atual; entra nos destaques | `src/lib/operacional/renewal.js:126-182`; `src/lib/operacional/metrics.js:25-38,171-181`; `src/views/dashboard/MilestoneBars.jsx:8-49` |
| Motivos de quem não vai renovar | Contratos da coorte com desfecho "não vai renovar", por `lead.renewalDeclineReason` ("Outro" sem o campo) | Mês; pessoa | `src/lib/operacional/renewal.js:54-60,100,109-112` |
| A vencer em 30, 60 e 90 dias | Contratos vigentes agora, o mais recente de cada pessoa, pela faixa de dias até o fim | Foto de agora, só no mês corrente; pessoa pelo responsável atual | `src/lib/operacional/renewal.js:184-202`; `src/lib/operacional/metrics.js:182` |
| Tabela Equipe no mês | Uma linha por usuário: Meta diária %, Prospecção %, Taxa de renovação %, Entraram, Upgrades e Atrasados agora. Linha Outros e rodapé da equipe. Clicar numa linha filtra a tela | Mês; só com "Equipe toda"; sem ordenação | `src/views/dashboard/TeamMonthTable.jsx:114-225` |
| Entraram (na tabela) | Contratos criados no mês que são o primeiro da pessoa (sem `renewedFromId`, sem contrato anterior, sem importado), pelo consultor do contrato | Mês; vendedor | `src/lib/operacional/base.js:296-314`; `src/lib/operacional/metrics.js:162-163` |
| Aviso de mês incompleto | Mês cuja busca falhou entra vazio e a barra avisa, para o zero não parecer resultado | Por mês carregado | `src/views/dashboard/DashboardOperacionalView.jsx:410-414,526-533`; `src/lib/operacional/queries.js:94-100` |

Limites de hoje. Só mês civil, do corrente até 11 meses atrás, embora `computeBaseMovement`, `computeChurn`, `tasksByType` e `renewalCohort` aceitem qualquer janela. Meta e prospecção ficam presas a `metaDaysOfMonth` (`src/lib/operacional/month.js:48-58`). Filtra uma pessoa ou a equipe toda, nunca um grupo. Base de clientes, churn, ponte e trancamentos são sempre da academia inteira, mesmo com pessoa escolhida. Não mostra valor em R$ e não exporta. Nenhum número abre a lista de nomes, porque as funções devolvem contagem; só `renewalCohort` (`src/lib/operacional/renewal.js:62-89`) já devolve uma linha por contrato, com dono, desfecho, quando renovou e motivo. Atrasados e A vencer não existem para mês passado.

Cuidados com o número. O mês fechado usa réguas de hoje: alvo de prospecção (`src/lib/operacional/routine.js:108`), dias de meta (`src/lib/operacional/month.js:48-58`), marcos (`src/lib/operacional/renewal.js:149`), tolerância (`src/lib/operacional/base.js:257`) e dono atual do lead (`src/lib/operacional/renewal.js:13-15`). E muda depois do fechamento: a data de cancelar e de trancar é escolhida no modal (`src/modals/ContractOutcomeModal.jsx:66,105-108`), a correção de contrato reescreve valores (`src/lib/contracts.js:364-393`), excluir um lead apaga as interações dele (`src/views/LeadProfileView.jsx:222-234`) e um usuário excluído some da meta e da prospecção dos meses em que trabalhou (`src/lib/operacional/routine.js:37-41,108-109`). Há dois "Entraram" com regras diferentes: o da ponte conta a mudança de estado da pessoa (`src/lib/operacional/base.js:215-225`) e o da tabela conta a venda do primeiro contrato (`src/lib/operacional/base.js:298-314`).

Desde quando cada dado vale: tarefas da Meta desde 14/05/2026 (PR #11); dia batido desde 03/06/2026 (PR #67), mas gravado de qualquer tela só desde 14/09/2026 (PR #206, commit `75400c9`), antes só com a Meta aberta; `volumeKind` desde 19/06/2026 (PR #111); contratos desde 30/06/2026 (PR #123); autor da interação (`actorAuthUid`) desde 13/07/2026 (PR #137); motivo de cancelamento em lista fixa desde 28/07/2026; `closedFromUpgrade` desde 11/09/2026 (PR #199); `pauseHistory` e motivo de não renovar em lista fixa desde 14/09/2026 (PR #206).

### 4.2 CRM

Endereço `/<academia>/visao-geral/crm`, com os parâmetros `mes`, `comparar`, `comparar-com`, `pessoa` e `funil`. Mede o funil de leads por mês de competência, do cadastro à matrícula. Uma função calcula tudo, `metricsOf(ctx, { monthKey, userId, funnelId, cutEnd })` em `src/lib/crm/metrics.js:93`, e a tela é `src/views/dashboard/DashboardCrmView.jsx`.

Lê por mês `stronix_leads` (por `createdAt`, `convertedAt`, `clienteSince` e `lostAt`), `stronix_interactions` e `stronix_aulas` (por `scheduledFor`), com memória de sessão e cache do aparelho conferido por contagem no servidor (`src/hooks/useCrmSources.js`). No pior caso, 11 meses para trás comparando com o ano anterior, carrega de 17 a 24 meses, uns 13 a 19 mil documentos sem cache (`docs/superpowers/plans/2026-09-15-dashboard-crm-tela.md:52`).

| Número ou gráfico | Definição | Recorte | Onde está a conta |
|---|---|---|---|
| Leads novos | Leads com `createdAt` no mês até o fim efetivo, sem `createdAtMissing` e sem os criados pela importação | Mês; pessoa (dono atual); funil (atual); % contra outro mês, pró-rata no corrente; tendência de 6 meses | `src/lib/crm/cohort.js:68-69`; `src/lib/crm/metrics.js:159,186` |
| Agendamentos | Registros de `stronix_aulas` (aula e visita) com `scheduledFor` no mês (no corrente, até agora), sem cancelados e sem os marcados na data da primeira matrícula ou depois. Sub-linha: vieram, faltaram, sem desfecho | Pessoa e funil saem do lead do registro; comparativo só quando os dois meses têm base | `src/lib/crm/appointments.js:115-136` |
| Comparecimento | Vieram ÷ (vieram + faltaram). Sem desfecho fica fora da conta | Igual a Agendamentos; diferença em p.p. | `src/lib/crm/appointments.js:130-135` |
| Matrículas | Leads cuja primeira matrícula (o menor entre `convertedAt` e `clienteSince`) cai no mês, sem lead importado e sem matrícula importada. Sub-linha: da safra e de safras anteriores | Pessoa (dono atual); funil; % e tendência | `src/lib/crm/cohort.js:22-27,45-53,77-78`; `src/lib/crm/metrics.js:161,189-190` |
| Conversão da safra | Leads novos do mês já matriculados até o corte ÷ leads novos do mês. Sub-linha: X de Y e quantos seguem em jogo | Safra acompanhada até hoje no mês fechado; no comparado pró-rata, até o corte; p.p. | `src/lib/crm/metrics.js:116-120,162-164,191-199`; `src/lib/crm/cohort.js:95-101` |
| Tendências | Os mesmos números nos 6 meses até o exibido | 6 meses; agendamentos cortam antes de 2026-09 | `src/lib/crm/metrics.js:309-316` |
| Destaque: mais de 24 h sem primeiro contato | Leads que passaram de 24 horas sem contato ou seguem sem contato, contra o mês comparado | Só com Comparar; pessoa e funil; menor é melhor | `src/lib/crm/metrics.js:265-291` |
| Destaque: canal de melhor conversão | Canal com pelo menos 5 leads e a maior conversão da safra, contra o mesmo canal no outro mês se ele também tiver 5 ou mais | Só com Comparar; pessoa e funil | `src/lib/crm/metrics.js:253-259,292-302` |
| Canais de origem | Por `lead.source` dos leads novos: leads, matriculados até o corte e conversão, em ordem de volume, com uma frase de volume contra resultado | Pessoa e funil; sem comparativo | `src/lib/crm/cohort.js:105-116`; `src/views/dashboard/ChannelTable.jsx`; `src/lib/crm/texts.js:56-68` |
| Safra: agendaram e compareceram | Agendou: tem registro não cancelado marcado até o corte. Compareceu: registro com presença, antes da primeira matrícula. Os dois acumulam sobre a mesma safra | Pessoa e funil; sem comparativo | `src/lib/crm/appointments.js:174-191`; `src/views/dashboard/CohortMilestones.jsx` |
| Safra: desfecho | Matricularam, seguem em jogo e perdidos, pela situação de cada lead da safra no corte | Pessoa e funil | `src/lib/crm/metrics.js:162-164,191-199`; `src/views/dashboard/CohortMilestones.jsx:42-47` |
| Passagem entre etapas | Por etapa do funil escolhido: entradas no mês, quantos avançaram, quantos perderam e a mediana do tempo na etapa das saídas do mês | Só com funil escolhido e mês a partir de 2026-09; pessoa recorta entradas, avanços e perdas, mas a mediana é sempre da academia | `src/lib/crm/stages.js:40-140`; `src/views/dashboard/StagePassageTable.jsx` |
| Maior vazamento | Etapa com a maior razão perderam ÷ entraram | Igual à passagem | `src/lib/crm/stages.js:137-139`; `src/views/dashboard/StagePassageTable.jsx:115-119` |
| Perdas por motivo | Leads que estão em Perda hoje com `lostAt` no mês, por `lossReason` ("Sem motivo" quando vazio) | Pessoa e funil; sem comparativo | `src/lib/crm/cohort.js:83-91`; `src/views/dashboard/LossCard.jsx` |
| Etapa em que se perdeu | `fromStatus` da última troca para Perda no mês, dos mesmos leads do card de motivos. "Sem etapa" sem troca gravada | A partir de 2026-09 | `src/lib/crm/stages.js:146-156` |
| Conversão por pessoa | Para cada usuário: leads, agendamentos, comparecimento, matrículas, conversão da safra e mediana do primeiro contato. Linha Outros para quem está fora da equipe. Clicar filtra a tela | Dono atual do lead; funil escolhido; sem comparativo | `src/views/dashboard/DashboardCrmView.jsx:85-89`; `src/views/dashboard/PeopleConversionTable.jsx` |
| Aulas experimentais por professor | Aulas (sem visitas) com `scheduledFor` no mês: realizadas, faltas, matrículas (`converted`), conversão = matrículas ÷ realizadas, e a divisão por modalidade. "Treina sozinho" à parte | Sempre a academia inteira, com etiqueta quando há filtro; sem comparativo | `src/lib/crm/appointments.js:199-231`; `src/views/dashboard/ProfessorCard.jsx` |
| Tempo até o primeiro contato | Do cadastro à primeira interação que conta como contato (fora observação do cadastro, indicação, importação e troca de responsável). Mediana, com os sem contato no fim da fila, e faixas até 1 h, até 24 h, mais de 24 h e sem contato | Pessoa e funil; diferença em minutos | `src/lib/crm/contact.js:14-63`; `src/lib/crm/stats.js:17-31`; `src/views/dashboard/SpeedCards.jsx` |
| Dias até a matrícula | Dias inteiros do cadastro à primeira matrícula, entre as matrículas do mês. Mediana e 6 faixas (0 a 1, 2 a 3, 4 a 7, 8 a 14, 15 a 30, 31 ou mais) | Pessoa e funil; diferença em dias | `src/lib/crm/cohort.js:119-141` |
| Em jogo por funil ou por etapa | Leads vivos no balde ativo, por funil (em "Todos os funis") ou por etapa do funil escolhido | Só no mês corrente; pessoa e funil | `src/lib/crm/stages.js:166-196`; `src/views/dashboard/PipelineNowCards.jsx:12-46` |
| Sem próximo contato | Leads em jogo sem `nextFollowUp`, fora os cadastrados há menos de 24 horas | Foto de agora | `src/lib/crm/stages.js:158-195`; `src/views/dashboard/PipelineNowCards.jsx:48-64` |

Limites de hoje. Só mês civil, com a janela de 12 meses. Filtra uma pessoa ou a equipe toda, e pessoa é sempre o dono atual do lead (`src/lib/crm/scope.js:58-62`); não dá para ver quem era o dono na época. O card de professores não aceita o filtro de pessoa. A passagem entre etapas só aparece com um funil escolhido. Não exporta e nenhum número abre a lista de leads, embora `newLeadsOf`, `enrollmentsOf` e `lossesOf` já trabalhem com os leads um a um. Campos que já são gravados e o CRM não lê: `lead.statusEnteredAt`, `stronix_sources.channel`, `stronix_aulas.consultantId` e `unit`, e no lead `modalidade`, `dor`, `sexo`, `birthDate` e `tags`.

Cuidados com o número. O Gerencial e o Operacional creditam a venda ao consultor gravado no contrato; depois de uma transferência os dois divergem do CRM, porque a migração não mexe em contrato (`src/views/settings/TransferLeadsTab.jsx:142-149`). A etapa com nome de matrícula grava `convertedAt` sem contrato (`src/lib/stageMove.js:94-96`), então a matrícula entra no CRM e fica fora do Gerencial e do Operacional. As perdas de um mês fechado encolhem quando o lead volta a negociar, porque `lostAt` e `lossReason` são apagados (`src/lib/stageMove.js:89-92`), e a safra passa de "perdido" para "em jogo". A troca de etapa só é gravada desde 14/09/2026 às 18h10 (PR #208, `src/lib/crm/scope.js:13-17`). Agendamento e comparecimento só estão completos desde 2026-09, porque as visitas só têm registro desde 18/08/2026 (`src/lib/crm/scope.js:19-24`). O card de professores conta aulas de quem já é cliente, que Agendamentos e a safra excluem (`src/lib/crm/appointments.js:199-223` contra `128-129`). Mês fechado pode vir do cache do aparelho sem refletir troca de responsável ou desfecho de aula antiga (`src/hooks/useCrmSources.js:41-53`). Lead excluído some de todos os números passados (`firestore.rules:85`). O cadastro já vem com a primeira origem do catálogo marcada (`src/modals/AddLeadModal.jsx:359`), então quem não troca grava uma origem que não é a real.

### 4.3 Gerencial

Endereço `/<academia>/visao-geral/gerencial`, com os parâmetros `mes`, `comparar` e `comparar-com`, sem filtro de pessoa. É a tela do dinheiro vendido, em valor de contrato e não em caixa. A entrada é `metricsOf(ctx, { monthKey, cutEnd })` em `src/lib/gerencial/metrics.js:52`, e a tela é `src/views/dashboard/DashboardGerencialView.jsx`. Não abre consulta nova: usa a coleção de contratos que o App já assina (`src/App.jsx:794-802`) e só busca por id os leads das vendas do mês, em lotes de 30, para saber a origem (`src/hooks/useGerencialLeads.js:18-55`).

| Número ou gráfico | Definição | Recorte | Onde está a conta |
|---|---|---|---|
| Vendido no mês | Soma de `value` dos contratos não importados com `createdAt` (ou `startsAt` na falta dele) no mês, e a contagem | Mês; academia. É o único número com comparativo: % contra um mês anterior com venda, pró-rata no corrente | `src/lib/gerencial/sales.js:9-17`; `src/lib/gerencial/scope.js:9`; `src/lib/gerencial/viewModel.js:19-26` |
| Ticket mensal da venda | Média de `value ÷ durationMonths` das vendas do mês. Um anual e um mensal pesam igual | Mês; sem comparativo | `src/lib/gerencial/sales.js:33-34`; `src/lib/gerencial/scope.js:17-21` |
| Desconto | Soma de `listValue` (ou `value` na falta dele) menos o vendido, em reais e em % da tabela. Fica âmbar a partir de 12% | Mês; não usa `discountReason` nem `discountMode` | `src/lib/gerencial/sales.js:18-19,35-36`; `src/views/dashboard/SoldHeroCard.jsx:50-51` |
| De onde veio a venda | Contagem, valor e % por tipo. Cada contrato entra num tipo só, nesta ordem de prioridade: renovação (`renewedFromId`), upgrade (`closedFromUpgrade`), retorno (a pessoa teve contrato antes), matrícula nova | Mês; sem comparativo | `src/lib/gerencial/scope.js:25-34`; `src/lib/gerencial/sales.js:20-40` |
| Vendas já canceladas | Vendas do mês que hoje têm `cancelledAt`: contagem e valor. Continuam no total | Mês | `src/lib/gerencial/sales.js:28,41-42`; `src/lib/gerencial/texts.js:29-34` |
| Contratos vigentes | Contratos vigentes ou trancados agora. Soma contrato, não pessoa. Sub-linha com importados sem valor ou trancados | Foto de hoje, igual em qualquer mês escolhido | `src/lib/gerencial/wallet.js:7-28`; `src/lib/operacional/base.js:122-131` |
| Valor por mês da carteira | Soma do ticket mensal dos contratos vigentes e trancados com valor | Hoje | `src/lib/gerencial/wallet.js:13-14` |
| Ticket mensal médio da carteira | Valor por mês ÷ contratos com valor | Hoje | `src/lib/gerencial/wallet.js:22` |
| Trancados | Contratos trancados e o valor por mês deles, que continuam na carteira | Hoje | `src/lib/gerencial/wallet.js:15,23-24` |
| Notas de carteira | Pessoas com mais de um contrato na carteira; contratos na carteira sem valor | Hoje | `src/lib/gerencial/wallet.js:16-26`; `src/lib/gerencial/texts.js:36-49` |
| Vencendo em 30, 60 e 90 dias | Contratos vigentes (trancado não) sem sucessor, com `endsAt` em cada faixa: contagem, valor por mês e sem valor; total dos 90 dias e % da carteira | Hoje; sem comparativo | `src/lib/gerencial/risk.js:8-39`; `src/views/dashboard/ExpiryRunway.jsx:37-57` |
| Já venceu e ninguém renovou | Contratos com `endsAt` no passado, sem `cancelledAt` e sem sucessor, sem janela de tempo. Só a contagem aparece | Hoje | `src/lib/gerencial/risk.js:42-48`; `src/views/dashboard/GerencialParts.jsx:31-50` |
| Saiu neste mês | Cancelamentos (`cancelledAt` no mês, fora os da importação) e trancamentos (pausa iniciada no mês, fora os da importação), com contagem e valor por mês | Mês; sem comparativo | `src/lib/gerencial/risk.js:50-63`; `src/views/dashboard/ExitsCard.jsx` |
| Quem vendeu | Por `contrato.consultantId`: vendido, vendas, participação, valor por venda e ticket mensal. A frase aponta o maior e o menor ticket mensal | Mês; dono do lead na hora da venda | `src/lib/gerencial/people.js:34-53`; `src/lib/gerencial/viewModel.js:30-38`; `src/views/dashboard/SellerRankTable.jsx` |
| Planos mais vendidos | Por `planId` (ou nome gravado): valor, vezes e participação | Mês | `src/lib/gerencial/people.js:58-65` |
| Origem do lead que fechou | Por `source` atual do lead da venda: valor, vezes e participação. Lead não buscado cai em "Sem origem" | Mês | `src/lib/gerencial/people.js:69-72`; `src/hooks/useGerencialLeads.js:18-55` |

Limites de hoje. Não filtra por pessoa: o ranking mostra todos, e o consultor vê a venda dos colegas. Só o total vendido compara com outro mês; ticket, desconto, tipo de venda, carteira, risco e ranking não têm comparativo nem tendência, embora exista `deltaOf` sem uso em nenhuma tela (`src/lib/gerencial/metrics.js:102-110`). Carteira e risco são sempre de hoje, iguais para qualquer mês escolhido, mesmo com `walletAt(contracts, t)` aceitando qualquer instante: não dá para ver como estava a carteira em 30/06. Os horizontes são fixos em 30, 60 e 90 dias (`src/lib/gerencial/risk.js:8`). "Já venceu" não tem janela e mostra só a contagem; o valor é calculado e não aparece. Não exporta e não abre a lista de contratos. Campos gravados e não lidos: `discountReason`, `discountMode` e `discountValue`.

Cuidados com o número. "Já venceu" conta também o contrato trancado cuja vigência original já passou, que ao mesmo tempo está na carteira como trancado (`src/lib/operacional/base.js:128`). O ticket da venda divide por todas as vendas não importadas, inclusive as sem valor, e usa o valor cheio como mensal quando falta `durationMonths` (`src/lib/gerencial/sales.js:33-34`; `src/lib/gerencial/scope.js:17-21`), enquanto o próprio `hasValue` diz que contrato sem valor fica fora do denominador (`src/lib/gerencial/scope.js:11-13`). A correção de contrato muda a venda de um mês fechado (`src/lib/contracts.js:374-395`), coisa que a spec não cobre (`docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:31`). A origem é a de hoje no lead. Contrato só existe desde 30/06/2026.

### 4.4 Meta Diária e visão da equipe

Endereço `/<academia>/meta-diaria`, com o parâmetro `cat` (categoria). A Meta não é gravada: é calculada na hora por `computeDailyGoalSlots` (`src/lib/dailyGoal.js:286-446`) a partir do estado atual dos leads em memória e das interações do mês. Tem 7 categorias: novo em 24 h, atrasado, visita hoje, aula hoje, contato hoje, renovação por marco e vencido. Uma tarefa conta como feita se existe `daily_goal_done` daquela categoria criado hoje, ou se o lead virou Venda ou Perda hoje. Fica gravado só cada conclusão (`daily_goal_done` com `dailyGoalCategory`) e o dia batido em `stronix_daily_goal_history`. O alternador "Minha meta | Equipe" aparece só para o gestor (`src/views/DailyGoalView.jsx:929,1657-1664`).

| Número ou gráfico | Definição | Recorte | Onde está a conta |
|---|---|---|---|
| Progresso da Meta do dia | Pares lead × categoria feitos ÷ total do dia. Sem tarefa, 100% | Pessoa logada; hoje | `src/lib/dailyGoal.js:286-456`; `src/views/DailyGoalView.jsx:1113-1122` |
| Tarefas por categoria | Lista nominal das tarefas do dia, com feito ou pendente, filtrável pela categoria | Pessoa logada; hoje | `src/lib/dailyGoal.js:286-446` |
| Ritmo do mês | Dias com meta batida ÷ dias de meta do mês, sequência atual (pula dia sem meta; hoje ainda não quebra) e os últimos 14 dias | Pessoa; mês corrente | `src/lib/dailyGoal.js:461-498`; `src/views/DailyGoalView.jsx:990-1015` |
| Prospecção do dia e do mês | Agendamentos (interação com `volumeKind`, autor por `actorAuthUid` ou dono do lead) mais leads novos (`createdAt`, dono atual), só em dias de meta. Cota = `dailyVolumeTarget` × dias de meta | Pessoa; dia e mês corrente | `src/lib/dailyGoal.js:100-133,251-255`; `src/views/DailyGoalView.jsx:1128-1144` |
| Dia perfeito | Meta zerada com tarefa e prospecção do dia maior ou igual à cota | Pessoa; dia | `src/views/DailyGoalView.jsx:1135`; `src/views/team/useTeamBoard.js:133,155` |
| Agenda do dia | Visitas e aulas de hoje da academia inteira. Confirmar presença ali credita o dono do lead, não quem clicou, porque a gravação sai sem autor | Academia; hoje | `src/lib/dayAgenda.js:36`; `src/components/dailygoal/DayAgendaCard.jsx`; `src/lib/appointmentOutcome.js:112-134` |
| Asas do mês (Equipe) | Por consultor: dias batidos ÷ dias de meta do mês inteiro, e prospecção do mês ÷ cota × dias. A marca de ritmo é dias fechados ÷ dias do mês | Equipe e pessoa; mês corrente | `src/views/team/useTeamBoard.js:36-100`; `src/views/team/TeamWings.jsx` |
| Régua de dias e resultados do dia (Equipe) | Hoje: situação por consultor (meta batida, críticas pelo SLA de atraso, pendentes). Dia passado: só bateu, não bateu ou folga, mais a prospecção recalculada | Pessoa; dia do mês corrente | `src/views/team/useTeamBoard.js:102-180`; `src/views/team/DayRail.jsx`; `src/views/team/TeamDayTable.jsx` |
| Detalhe do consultor (Equipe) | A carteira do dia em 6 categorias, com feitas sobre total, e o extrato da prospecção. Os dois lados têm nome e link para a ficha. Em dia passado, só a prospecção | Pessoa; dia do mês corrente | `src/views/team/ConsultantDayDetail.jsx:38-205`; `src/lib/dailyGoal.js:208` |

Limites de hoje. Tudo é do mês corrente: não dá para abrir a meta de agosto nem a de outra pessoa fora da visão Equipe. Dia passado só diz se bateu, porque o sistema não guarda quais tarefas existiam, quantas ficaram pendentes nem quantos atrasados havia; a própria tela avisa isso ("O sistema guarda o resultado, não quais tarefas existiam", `src/views/team/ConsultantDayDetail.jsx:59-68`). É a única tela de números com nome clicável, e só no dia de hoje e no extrato da prospecção. Nada exporta.

Cuidados com o número. O dia batido nunca é desfeito e só é gravado pela sessão do próprio consultor (`firestore.rules:208-216`; `src/lib/dailyGoalHistory.js:29-34`). Adiar tira Contato, Atrasado e Vencido do denominador sem concluir (`src/views/DailyGoalView.jsx:1170-1188`), então dá para bater a meta adiando. O contato delegado concluído aparece como feito na Meta do dono do lead e some da Meta de quem recebeu (`src/lib/dailyGoal.js:434-443`; `src/lib/contactGoal.js:27-29`); não há teste para esse caso. A Meta e o painel da equipe contam lead importado como lead novo, e o Operacional não (`src/lib/dailyGoal.js:104-107` contra `src/lib/operacional/routine.js:98-99`). Num dia passado, o painel da equipe enxerga só os leads em memória e conta menos leads novos que o Operacional (`src/App.jsx:1398-1404`; `src/views/team/useTeamBoard.js:142-150`). O painel da equipe assina o histórico de metas inteiro, sem filtro de data (`src/views/DailyGoalTeamView.jsx:47-55`). O dia é o do fuso do navegador (`src/lib/dailyGoal.js:57-60`). `useTeamGoals` (`src/views/dashboard/useTeamGoals.js:25-99`) é uma cópia antiga da régua da equipe sem quem importe, e não deve servir de base.

### 4.5 Listas, filtros e exportações

| Tela | Colunas | Filtros | Exporta? |
|---|---|---|---|
| Pipeline (`/pipeline`) | Uma coluna por etapa e um card por lead (nome, chips de agendamento e prazo, motivo da perda, consultor), 10 por coluna. Coluna Venda com as matrículas do mês corrente (`src/views/KanbanView.jsx:641-659`); Perda com total contado no servidor (`src/views/KanbanView.jsx:703-727`); badges de Vencidos, Upgrade e Renovações (`src/views/KanbanView.jsx:733-789`) | `funil`, `resp`, `atraso` | Não |
| Todos os leads (`/leads`) | Lead, Status no funil, Ação agendada, Cadastro (`src/views/LeadsView.jsx:327-328`), 30 por vez, com "X de Y leads" | `funil`, `fase`, `resp` (só gestor), `atraso`, `quente` | Sim, CSV com Nome, WhatsApp, Origem, Indicado por, Fase do Funil, Consultor, Data Cadastro, Observação e Motivo Perda, respeitando o filtro (`src/views/LeadsView.jsx:122-155`) |
| Clientes (`/clientes`) | Cliente, Plano, Valor, Vencimento (`src/views/ClientsView.jsx:326-327`), com "X de Y clientes" | `sit` (situação do contrato), `resp` (só gestor); plano também filtra, mas fica fora do endereço (`src/views/ClientsView.jsx:86-92`) | Não |
| Aulas (`/leads/aulas`) | Aluno, Objetivo, Data marcada, Professor, Passe livre, Finalizou (`src/views/AppointmentTrackingView.jsx:667`) | `dia` (hoje, ontem, amanhã, em andamento), `de` e `ate` (até 30 dias), `resp` (só gestor), `prof` | Sim, CSV e PDF pela impressão, com filtros próprios de período, responsável, professor, modalidade e desfecho. Colunas: Nome, Telefone, Objetivo/Dor, Data marcada, Professor, Modalidade, Passe, Desfecho, Responsável (`src/lib/appointmentReport.js:37-52`; `src/modals/AppointmentExportModal.jsx`) |
| Visitas (`/leads/visitas`) | Visitante, Objetivo, Data marcada, Situação, Finalizou | `dia`, `de` e `ate`, `resp` (só gestor) | Sim, igual a Aulas, sem Professor, Modalidade e Passe |
| Meta diária (`/meta-diaria`) | Tarefas do dia por categoria, com nome do lead | `cat` | Não |
| Ficha, aba Linha do tempo | Interações do lead com data, tipo e autor, e os dias que ele ficou em cada fase (`src/lib/timeline.js:153-174`) | Tudo, Conversas, Agendamentos, Anotações, Marcos e o interruptor Sistema (`src/lib/timeline.js:52-109`) | Não |
| Sino | "Passaram para você": leads e clientes reatribuídos à pessoa nos últimos 30 dias, até 15 (`src/lib/notifications.js:74-102`) | Nenhum | Não |
| Configurações, Importação de clientes | Resultado de cada linha da planilha importada | Nenhum | Sim, CSV (`src/views/settings/ImportClientsSection.jsx:297-303`) |
| Super console | Academias, faturamento, suporte e logs (ver 4.6) | Busca do topo sem ação (`src/views/console/SuperConsole.jsx:1588`) | Não. Os botões Exportar, CSV e Relatório mensal não têm ação (`src/views/console/SuperConsole.jsx:106-107,229,861`) |

Nenhuma lista pagina no servidor. Todos os leads baixa a coleção inteira a cada abertura, sem filtro (`src/lib/leadQueries.js:36-44`), e Clientes baixa todos os clientes (`src/lib/leadQueries.js:31-33`). As duas filtram e ordenam no navegador e mostram 30 por vez (`src/lib/leadStatus.js:12`). Aulas e Visitas baixam uma janela de datas e leem o espelho do compromisso gravado no lead, um por pessoa; o histórico completo está em `stronix_aulas` e não é usado ali. Por isso o relatório de Aulas e Visitas conta menos do que aconteceu, e o filtro "Cancelou" quase nunca acha nada, porque o cancelamento apaga o espelho (`src/lib/appointmentReport.js:17-22`; `src/lib/appointmentOutcome.js:98-103`). O "Y" de "X de Y aulas" conta pessoas com espelho, não agendamentos (`src/views/AppointmentTrackingView.jsx:266-278`).

Limites de hoje. Clientes, Pipeline, Meta, os três painéis e o super console não exportam. Nenhuma lista filtra por período de cadastro, de matrícula ou de perda. O CSV de leads tem 9 colunas fixas e não traz data de conversão, data de perda, etapa com data nem contrato; o arquivo sai como `leads_stronix_<data>.csv` em qualquer academia (`src/views/LeadsView.jsx:149`). Uma exportação nova construída em cima de Todos os leads ou de Clientes repete o custo de baixar a coleção inteira.

Cuidados com o número. O CSV de Aulas e Visitas não protege contra fórmula (`src/lib/appointmentReport.js:110-118`), ao contrário do CSV de leads (`src/views/LeadsView.jsx:129-134`), e um lead criado pela página pública de indicação, sem login, pode levar fórmula ao Excel do gestor (`api/tenant-resolve.js:188,265`). Qualquer consultor baixa a base inteira da academia com nome e WhatsApp em Todos os leads, e Aulas e Visitas de todos: o botão não checa papel (`src/views/LeadsView.jsx:177-185`) e as telas não têm trava de gestor (`src/lib/routes.js:59-61`; `firestore.rules:79-80`). O modal de exportação não tem teto de período, diferente da tela, que para em 30 dias (`src/modals/AppointmentExportModal.jsx:107-126` contra `src/lib/screenParams.js:245-251`). Lead sem `createdAt` aparece no topo da lista e no CSV com a data de hoje (`src/lib/leads.js:18-21`). No Pipeline, a Perda filtrada por responsável conta só a página carregada (`src/views/KanbanView.jsx:712-727`).

### 4.6 Super-admin

É a visão da STRONIX sobre as academias clientes, não um relatório de academia. O console em uso é `src/views/console/SuperConsole.jsx`; `src/views/superadmin/SuperAdminView.jsx` é o antigo, mantido como reserva. Os números vêm de `api/super-overview.js`, `api/tenant-status.js` e `api/plans.js`.

| Número ou gráfico | Definição | Recorte | Onde está a conta |
|---|---|---|---|
| MRR, ARR e MRR potencial | Soma do preço efetivo das academias ativas, não arquivadas e não internas; ARR = MRR × 12; o potencial soma os trials | Hoje; sem internas | `api/super-overview.js:145-147,184-185`; `api/_plans.js:39-51` |
| MRR e ativas por mês, e a diferença contra o mês anterior | Estimativa: preço de hoje das academias ativas hoje, somado pela data de criação | 6 meses | `api/super-overview.js:204-217`; `src/views/console/SuperConsole.jsx:78-92` |
| Academias por status e por plano | Contagem de ativas, trial, suspensas, arquivadas e internas, e por plano | Hoje | `api/super-overview.js:138-153` |
| Receita por plano | Soma do preço das ativas por plano | Hoje | `src/views/console/SuperConsole.jsx:83-85` |
| Em risco | Ativa ou trial sem interação há mais de 14 dias (piso na data de criação) | Hoje | `api/super-overview.js:56-58,168-172` |
| Saúde (console antigo) | Ativo até 7 dias, Ocioso de 8 a 14, Em risco depois de 14 dias desde a última atividade | Hoje | `src/lib/superadmin.js:26-39` |
| Churn 30 dias | Suspensas ou arquivadas com `statusChangedAt` nos últimos 30 dias | 30 dias | `api/super-overview.js:163-166` |
| Trials vencendo e próximos vencimentos | `trialEndsAt` em até 7 dias; `nextBillingAt` em até 30 dias | Próximos dias | `api/super-overview.js:156-161,174-180` |
| Inadimplência | Academias com `paymentStatus` "overdue" e a soma do preço delas | Hoje | `src/views/console/SuperConsole.jsx:851-852` |
| Recebido (recente) | Soma de `value` dos eventos pagos entre os 25 últimos eventos de pagamento | Sem período | `src/views/console/SuperConsole.jsx:847,853-854`; `api/super-overview.js:234` |
| Uso por academia | Leads, gestores, consultores (mais extras) e interações, por contagem no servidor | Hoje | `api/tenant-status.js:75-97`; `src/views/console/SuperConsole.jsx:1162-1171` |
| Organizações por plano | Contagem de academias por plano | Hoje | `api/plans.js:88-100` |
| Chamados abertos e de alta prioridade | Status diferente de resolvido; prioridade alta | Hoje | `src/views/console/SuperConsole.jsx:1357-1358` |
| Ticket médio (console antigo) | MRR ÷ academias ativas | Hoje | `src/views/superadmin/SuperOverviewCards.jsx` |
| Auditoria recente | As 30 últimas linhas de `superadmin_audit` | Sem período | `api/super-overview.js:223` |

Limites de hoje. Não existe período: tudo é foto de agora, ou as últimas 25 cobranças e 30 linhas de auditoria. Não compara academias em conversão, renovação ou tempo de contato, porque essas contas só rodam no navegador de cada academia. Leitura e custo de Firestore por academia não aparecem em lugar nenhum. Nada exporta, apesar dos botões.

Cuidados com o número. A curva de MRR é estimativa com preços e academias ativas de hoje, então não mostra churn nem mudança de preço (`api/super-overview.js:204-217`). Não existe histórico de status, plano ou preço, só o último carimbo: reativar e suspender de novo apaga o evento anterior do churn (`api/tenant-status.js:233-235`). A auditoria guarda o nome do campo alterado, não o valor. O "Último acesso" é a última interação de qualquer pessoa da academia, não o login. "Recebido (recente)" pode somar duas vezes o mesmo pagamento de cartão, porque o Asaas manda confirmado e depois recebido e cada evento vira um documento (`api/asaas.js:43,76,124`). A tela Logs e a atividade do detalhe da academia mostram "undefined" no lugar da ação, porque `auditActionLabel` espera o objeto e recebe o texto (`src/views/console/SuperConsole.jsx:279,1254`; `src/lib/superadmin.js:50-60`).

### 4.7 Funções de conta reaproveitáveis

| Módulo | O que calcula | Serve a relatórios de |
|---|---|---|
| `src/lib/operacional/month.js` | Chave e intervalo de mês (`monthRange`, `addMonthsToKey`), fim efetivo, corte pró-rata do comparado (`comparisonCut`), dias de meta do mês (`metaDaysOfMonth`), opções de comparação | Qualquer relatório mensal com comparativo |
| `src/lib/operacional/base.js` | Estado de cada contrato num instante (`contractStateAt`, `personStatesAt`), ativos e trancados num instante (`countActiveAt`, `countLockedAt`), ponte da base (`computeBaseMovement`), churn (`computeChurn`), cancelamentos por motivo (`cancellationsByReason`), vendas por vendedor (`salesInWindow`) | Base de clientes, série de ativos mês a mês, evasão, cancelamento por motivo, entradas e retornos |
| `src/lib/operacional/renewal.js` | Coorte de renovação com uma linha por contrato (`renewalCohort`), resumo (`summarizeCohort`), contatos nos marcos (`milestones`), a vencer (`upcomingExpirations`), dono do contrato (`ownerOf`) | Renovação por mês de vencimento, lista nominal de quem venceu, contato nos marcos |
| `src/lib/operacional/routine.js` | Dias batidos (`metaDaysSummary`, `metaCalendar`), prospecção por dia e pessoa (`prospectionSummary`), tarefas por tipo (`tasksByType`), atrasados agora (`overdueNow`), filtro de lead importado | Atividade do consultor, disciplina da Meta, prospecção contra cota |
| `src/lib/operacional/metrics.js` | Agregado do mês (`metricsOf`), diferença (`deltaOf`), série (`seriesOf`), destaques (`buildHighlights`) | Resumo do mês, frases do que mudou, ranking da equipe |
| `src/lib/operacional/queries.js` | Carga por mês com conferência de contagem (`loadWithCountCheck`), memória de sessão, marca de mês que falhou (`failedMonthEntry`) | Carga de qualquer relatório no navegador, sem mostrar zero no lugar de falha |
| `src/lib/crm/cohort.js` | Leads novos (`newLeadsOf`), matrículas (`enrollmentsOf`), perdas (`lossesOf`), situação do lead num instante (`outcomeAt`), canais (`channelsOf`), dias até matricular (`daysToEnrollOf`), primeira matrícula (`firstEnrolledAtOf`) | Funil por origem, safra contra período, motivos de perda, ciclo de venda |
| `src/lib/crm/appointments.js` | Agendamentos e comparecimento (`appointmentsOf`), marcos da safra (`cohortMilestones`), professores (`professorsOf`), status efetivo do registro, desfecho da visita pelo espelho | Visitas e aulas experimentais, conversão por professor e modalidade |
| `src/lib/crm/stages.js` | Passagem entre etapas (`stagePassageOf`), etapa da perda (`lossStagesOf`), carteira agora (`pipelineNowOf`), trocas por lead (`movesByLead`) | Onde o funil trava, tempo por etapa, movimento entre funis, pipeline numa data passada |
| `src/lib/crm/contact.js` | Primeiro contato por lead (`contactTimesByLead`, `firstContactOf`) e a regra do que conta como contato | Tempo até o primeiro contato, por consultor, origem e hora do cadastro |
| `src/lib/crm/stats.js` | Porcentagem, mediana, mediana com os sem valor no fim, contagem por chave, ranking | Qualquer relatório |
| `src/lib/crm/metrics.js` | Agregado do mês (`metricsOf`), diferença (`crmDelta`), melhor canal (`bestChannelOf`), destaques (`buildCrmHighlights`), série (`seriesOf`) | Resumo do funil, frases do que mudou |
| `src/lib/crm/scope.js` | Recorte por pessoa e funil (`makeScope`), funis de cliente fora do CRM (`isClientFunnel`), datas de início (`STAGE_TRACKING_SINCE`, `APPTS_COMPLETE_MONTH`) | Qualquer relatório de lead; aviso de base incompleta |
| `src/lib/gerencial/sales.js` e `scope.js` | Venda do período (`salesOf`, `soldContracts`), tipo de venda (`saleTypeOf`), ticket mensal (`monthlyTicket`), contrato com valor (`hasValue`), momento da venda (`saleMoment`) | Vendas, ticket, desconto, tipo de venda, cancelado depois |
| `src/lib/gerencial/wallet.js` | Carteira num instante (`walletAt`) | Carteira em qualquer data passada |
| `src/lib/gerencial/risk.js` | A vencer por horizonte (`expiryHorizons`), vencidos sem sucessor (`expiredWithoutSuccessor`), saídas do período (`exitsInWindow`) | Contratos a vencer, ex-clientes para reconquistar, valor que saiu |
| `src/lib/gerencial/people.js` | Venda por consultor (`sellersOf`), por plano (`plansOf`) e por origem (`sourcesOf`) | Vendas por consultor, planos mais vendidos, receita por origem |
| `src/lib/dailyGoal.js` | Meta do dia (`computeDailyGoalSlots`, `slotTotals`), ritmo (`computeRitmo`), extrato da prospecção com nome do lead (`listVolumeActionsInRange`) | Meta do dia e do mês corrente. Importa `lucide-react` (`src/lib/dailyGoal.js:1`), então não pode ir para função em `api/` |
| `src/lib/timeline.js` | Classificação de cada interação (`classifyInteraction`) e tempo em cada fase | Atividade por tipo de ação; cuidado com a troca de responsável, que entra na cadeia de fases |
| `src/lib/leadStatus.js` | Lead quente e frio (`isHotLeadFromDate`, `isColdLeadFromDate`), dias desde a data | Carteira esquecida, leads quentes sem ação |
| `src/lib/freePass.js` | Passe da aula experimental ativo (`isPassActive`) | Passe vencendo sem matrícula |
| `src/lib/appointmentReport.js` | Colunas, linhas filtradas, CSV (`rowsToCsv`) e página de impressão (`buildReportHtml`) | Molde de exportação de qualquer relatório de lista, depois de ganhar a proteção contra fórmula |
| `src/hooks/useFunnelCounts.js` | Contagem no servidor por balde e funil (`getCountFromServer`), uma leitura por contagem | Totais baratos sem baixar documentos |
| `src/lib/dashboardMetrics.js` | Presets de período com pró-rata (`buildPeriodRange`, `buildPreviousRange`), captados, agendados, conversão da safra, por origem, por funil, perdas por motivo, conversão por professor | Só como molde: nenhuma tela usa, só o teste importa, e a fonte é a vaga única de agendamento do lead |
| `src/lib/superadmin.js` | Saúde da academia (`tenantHealth`), rótulo da última atividade | Relatório da STRONIX sobre as academias |

### 4.8 O que outros sistemas oferecem e o que cabe aqui

O leitor de mercado olhou 10 sistemas de academia (Next Fit, Tecnofit, ABC Evo/W12, Pacto, Cloud Gym, Glofox, Mindbody, PushPress, Zen Planner, Wodify) e 5 CRMs de vendas (Pipedrive, HubSpot, RD Station CRM, Kommo, Agendor). A central de ajuda da Tecnofit pede login, as páginas de suporte da Glofox devolveram 403 e as do Mindbody só carregam com JavaScript; nesses casos valeram a página pública do produto e o resumo da busca.

O que o Stronilead já calcula e falta só virar relatório com lista e exportação:

| O que o mercado oferece | Quem oferece (fonte) | Aqui hoje |
|---|---|---|
| Funil e conversão por origem | Glofox Lead Conversion Report (https://support.glofox.com/hc/en-us/articles/360005275778-How-to-Use-the-Lead-Conversion-Report); Next Fit, Como conheceu (https://ajuda.nextfit.com.br/support/solutions/articles/69000853197-como-analisar-o-dashboard-de-crm-); Zen Planner (https://zenplanner.com/blogs/using-zen-planner-to-track-leads-and-convert-students/) | CRM, `src/lib/crm/cohort.js:105-116` |
| Motivos de perda | Next Fit; HubSpot Deal Loss Reasons (https://knowledge.hubspot.com/reports/create-sales-reports-in-the-sales-analytics-suite); Agendor (https://www.agendor.com.br/blog/dashboard-vendas-agendor/) | CRM, `src/lib/crm/cohort.js:83-92`, mas o motivo some quando o lead volta |
| Passagem e tempo por etapa | Agendor Relatório de Conversão (https://www.agendor.com.br/blog/novidade-relatorio-conversao-crm/); HubSpot Time Spent in Deal Stage; Pipedrive Deal Duration (https://support.pipedrive.com/en/article/insights-report-types) | CRM desde 14/09/2026, `src/lib/crm/stages.js:61-139` |
| Tempo até o primeiro contato | HubSpot Lead Response Time; RD Station (https://www.rdstation.com/produtos/crm/vendas/relatorios-de-vendas/); ABC Evo (https://w12.com.br/blog/crm-para-academia/) | CRM, `src/lib/crm/contact.js:45-63` |
| Ciclo de venda | HubSpot Deal Velocity; RD Station; Agendor | CRM, `src/lib/crm/cohort.js:132-141` |
| Comparecimento em aula experimental e visita | PushPress show rate (https://www.pushpress.com/blog/stop-losing-leads-increase-show-rate-using-pushpress-grow); Glofox No Shows (https://www.glofox.com/blog/data-tracking-software/) | CRM desde 2026-09, `src/lib/crm/appointments.js:115-136` |
| Conversão por professor | Glofox Trainer Insights, que mede reserva e presença, não matrícula | CRM, `src/lib/crm/appointments.js:199-231` |
| Vendas por consultor | Mindbody Sales by Rep (https://support.mindbodyonline.com/s/article/203257153-Sales-by-Rep-report?language=en_US); Agendor; Tecnofit | Gerencial, `src/lib/gerencial/people.js:34-53` |
| Receita por origem e planos mais vendidos | Next Fit, Dashboard gerencial (https://ajuda.nextfit.com.br/support/solutions/articles/69000860460-como-analisar-o-dashboard-gerencial-); HubSpot; Pipedrive Products | Gerencial, `src/lib/gerencial/people.js:58-72`, em valor de contrato |
| Estatística de contratos (novas, renovações, upgrades, retornos, cancelamentos) | Next Fit, relatórios de clientes (https://ajuda.nextfit.com.br/support/solutions/articles/69000851911-como-funciona-cada-relat%C3%B3rio-de-clientes-); Tecnofit | Gerencial e Operacional, `src/lib/gerencial/sales.js:20-40`; `src/lib/operacional/base.js:206-250` |
| Taxa de renovação | Pacto (https://blog.sistemapacto.com.br/crm-para-academias-por-que-e-como-trabalhar-com-metas/); ABC Evo (https://w12.com.br/blog/4-indicadores-basicos-de-gestao/); Next Fit | Operacional, `src/lib/operacional/renewal.js:62-114` |
| Contratos a vencer e ex-clientes | Next Fit Contratos a vencer; Glofox Lost Members; Pacto CRM com ex-alunos (https://www.rdstation.com/integracoes/pacto-crm/) | Gerencial e Operacional, `src/lib/gerencial/risk.js:19-48`; `src/lib/operacional/renewal.js:184-202` |
| Evasão por motivo | Next Fit Relatório de Evasão; Zen Planner Member Churn (https://zenplanner.com/guides/metrics-that-matter-general-gym/) | Operacional, `src/lib/operacional/base.js:252-294` |
| Atividade por consultor | HubSpot Activity Leaderboard; Agendor Tarefas Finalizadas; Pacto meta diária | Operacional e Meta Diária, `src/lib/operacional/routine.js:34-175` |
| Comparação com o período anterior em todo cartão | Next Fit, Dashboard de cliente (https://ajuda.nextfit.com.br/support/solutions/articles/69000860454-como-analisar-o-dashboard-de-cliente-) | Nos três painéis; no Gerencial só o total vendido |

O que cabe com ajuste, sem gravar dado novo:

| O que o mercado oferece | Quem oferece (fonte) | O que falta aqui |
|---|---|---|
| Clicar no número e abrir a lista de onde ele saiu | Pacto, BI no CRM (https://blog.sistemapacto.com.br/business-intelligence-crm/); Next Fit, botão Abrir relatório; Glofox Insights | As funções devolverem as linhas, não só a contagem. `LeadLink` já existe e dá Ctrl+clique de graça |
| Exportar todo relatório | Next Fit, mais de 70 relatórios (https://nextfit.com.br/sistema-para-academia/); RD Station | Generalizar `src/lib/appointmentReport.js`, com a proteção contra fórmula do CSV de leads |
| KPIs da semana | PushPress Weekly KPI Tracker (https://www.pushpress.com/resources/weekly-kpi-tracker) | Janela semanal na carga e no endereço; as contas já recebem `start` e `end` |
| Cancelamento nos primeiros 90 dias por consultor e plano | Pacto, KPIs da academia (https://blog.sistemapacto.com.br/indicadores-da-academia-kpis/) | A conta. Os dados existem desde 30/06/2026 |
| Série de clientes ativos mês a mês | Next Fit Histórico de Clientes Ativos; Zen Planner Net Member Gains | Rodar `countActiveAt` e `computeBaseMovement` em 12 meses; os contratos já estão carregados |
| Ticket, desconto e valor acumulado por cliente | Next Fit LTV e Ticket Médio; Zen Planner Average Lifetime Value | A conta de permanência. Histórico curto, e é valor de contrato, não caixa |
| Contatos agendados contra feitos | Agendor, atividades agendadas e finalizadas | Cruzar `rescheduledFor` (`src/views/DailyGoalView.jsx:1379`) com a conclusão; conferir se todo caminho grava o campo |
| Carteira esquecida | Agendor Clientes Esquecidos; RD Station | Faixas por `lastInteractionAt` (gravado desde 13/07/2026, `src/lib/interactions.js:44`); ler os clientes inteiros tem custo |
| Leads sem próximo passo | Agendor Próximo Passo | Ampliar `pipelineNowOf` e `overdueNow` para lista por consultor e etapa |
| Movimento entre funis | Agendor Movimentações entre Funis | Ler `funnelId` das trocas, desde 14/09/2026 |
| Pipeline numa data passada | HubSpot Historical Snapshots e Deal Pipeline Waterfall | Reconstruir a etapa pela primeira troca depois da data, desde 14/09/2026 |
| Passe experimental vencendo sem matrícula | Mindbody, alerta de ofertas introdutórias (https://support.mindbodyonline.com/s/article/What-does-the-Unconverted-Intro-Offers-alert-on-my-dashboard-mean?language=en_US) | Lista a partir de `src/lib/freePass.js`, como alerta no topo |
| Aniversariantes | Next Fit Relatório de Aniversariantes | Um campo de dia e mês para consultar, ou ler a base inteira |
| Perfil de leads e clientes (idade, sexo, bairro, objetivo) | Next Fit Perfil de Cliente | Ler `birthDate`, `sexo`, `dor` e endereço, que já são gravados; bairro e profissão só vêm do cadastro completo do cliente |
| Indicações: quem indica e quanto converte | ABC Evo, convidados com status (https://evohelp.w12app.com.br/pt-BR/articles/1932225-perfil-de-cliente); Glofox | Agregar `referredById` (gravado desde 10/08/2026, PR #171); hoje o resumo existe só na ficha |
| Resumo semanal em frases, dentro do app | Mindbody Weekly AI Insights (https://www.mindbodyonline.com/business/reporting) | Os destaques do CRM e do Operacional já montam as frases; falta a janela semanal |

O que precisa de dado novo:

| O que o mercado oferece | Quem oferece (fonte) | O que teria de ser gravado |
|---|---|---|
| Meta mensal de venda por consultor, com projeção | Pipedrive Goals (https://support.pipedrive.com/en/article/insights-goals); Kommo (https://support.kommo.com/docs/pt-br/manage-stats-in-kommo); RD Station; HubSpot Quota Attainment | Meta por pessoa e mês. Hoje só existe o piso diário de prospecção, `dailyVolumeTarget` (`src/lib/settingsSetup.js:33`) |
| Previsão de matrículas e de valor | HubSpot Weighted Pipeline Forecast; Pipedrive Deal Revenue Forecast; Kommo | Valor esperado ou plano de interesse no lead. Sem isso, só uma estimativa por taxa histórica × ticket |
| Relatório agendado por e-mail | HubSpot (https://knowledge.hubspot.com/dashboard/email-or-export-reports-and-dashboards?src=feed) | Quem recebe o quê, job agendado e provedor de e-mail. A Vercel está em 11 de 12 funções e o `vercel.json` só tem rewrites |
| Custo por matrícula e retorno por canal | Next Fit CAC; Kommo relatórios de ROI (https://www.kommo.com/br/recursos/crm/roi-reports/); RD Station | Custo por origem e mês, e campanha no lead |
| Relatórios por unidade | ABC Evo, redes (https://w12.com.br/funcionalidades/) | Unidade no lead e no contrato. Só `stronix_aulas` guarda `unit` (`src/lib/aulas.js:105`) |
| Tempo de resposta e volume no WhatsApp | HubSpot Chats; RD Station | Eventos de mensagem do Stronizap, que dependem da Parte B da ponte |
| NPS | ABC Evo; Cloud Gym (https://cloudgym.io/sistema-academia/); Pacto | Nota e data da pesquisa. `satisfactionAt` só é lido (`src/lib/leads.js:72-74`); não achei quem grava |
| Comparativo anônimo entre academias | Mindbody Comparative Analytics (https://www.mindbodyonline.com/business/reporting) | As métricas calculadas no servidor por academia; hoje só rodam no navegador |

Três diferenças de regra pedem cuidado ao comparar com o mercado. A Next Fit chama de conversão as ganhas divididas pelas perdidas; aqui é matrícula dividida por lead da safra (`src/lib/crm/metrics.js:198`). O mercado põe Vendas e Receita lado a lado; aqui todo número de dinheiro é valor de contrato, e o sistema não guarda pagamento. A Glofox e a Agendor medem conversão pelo que aconteceu no período, qualquer que seja a data de cadastro; o CRM daqui mostra as duas leituras (safra e matrículas do mês), e o relatório precisa dizer qual está na tela.

Algumas ofertas de mercado não cabem como estão. O link público de painel do Pipedrive (https://support.pipedrive.com/en/article/insights-feature) traria nome de cliente para fora do login, e a regra do app é nunca pôr dado pessoal no endereço; o link com filtro para colega logado já existe desde a PR #220. Relatório mais completo como plano pago (RD Station, add-on Insights da Glofox) é decisão comercial: hoje os planos do Stronilead só limitam usuários (`api/_plans.js:7-11`). Os motivos de perda configuráveis por funil da RD Station (https://ajuda.rdstation.com/s/article/Configurar-motivos-de-perda-por-funil?language=pt_BR) também não existem aqui, porque `stronix_loss_reasons` é uma lista única da academia.

Ficam fora do escopo, porque vivem em outros sistemas ou o Stronilead não guarda: fluxo de caixa, DRE, receita recebida, inadimplência do aluno, contas a pagar, comissão (vive no Comissão STRONIX), frequência e acessos, faltantes, risco de abandono por frequência, ocupação de turma, avaliação física, treino, graduação, agregadores (Wellhub, TotalPass), PDV e estoque.


## 5. Catálogo de relatórios

São 172 relatórios, de R001 a R172, divididos em 15 domínios. Cada domínio abre com uma tabela de prioridade, viabilidade e resultado da conferência no código (ajustado, confirmado ou inviável). Cada relatório traz a pergunta que responde, para quem serve, recortes, números, filtros, formato, de onde vem o dado, desde quando vale, viabilidade e prioridade, permissão e custo, o que já existe parecido e o que a conferência mudou.

### 5.1 Entrada e origem

Este domínio diz quantos leads chegam à academia, por qual origem, em que dia e hora, de que região e a que custo. A base é boa: todo lead tem data de cadastro desde 29/04/2026 e WhatsApp com DDD. O limite está no resto. Origem, funil e dono são os de hoje, sem histórico, o canal é texto livre, e o sistema não guarda investimento, campanha, hora real de chegada nem a volta de quem já está na base.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R001 | Entrada de leads por origem e canal | Alta | Com ajuste | Ajustado |
| R002 | Horário de chegada dos leads e cobertura de turno | Média | Precisa gravar dado novo | Ajustado |
| R003 | Mapa de captação por DDD | Baixa | Com ajuste | Ajustado |
| R004 | Custo por lead e por matrícula por canal pago | Baixa | Precisa gravar dado novo | Ajustado |
| R005 | Leads antigos que voltaram a procurar | Média | Precisa gravar dado novo | Ajustado |

#### R001. Entrada de leads por origem e canal

Quantos leads entraram no período, de que origem e canal (pago, orgânico, offline), em que funil e para quem?

- Para quem: dono, gestor e consultor.
- Recortes: dia, semana ou mês de cadastro; origem; canal da origem; funil; dono atual do lead; forma de entrada. A forma de entrada tem três valores: pelo link público (`referralVia: 'link'`, `api/tenant-resolve.js:282`), manual (o cadastro não grava marca nenhuma, `src/modals/AddLeadModal.jsx:452-480`) e importação (reconhecida por `importSource`).
- Números: leads novos, variação contra o período anterior e participação de cada origem e canal, em %.
- Filtros: período, pessoa, funil, origem e canal.
- Formato: número com comparativo, evolução mês a mês e tabela por origem.
- De onde vem: `stronix_leads.createdAt` e `createdAtMissing`; `stronix_leads.source` (estado de hoje, em texto); `stronix_sources.name` e `channel`, ligados pelo nome; `stronix_leads.funnelId` com `stronix_funnels.systemKind`; `stronix_leads.consultantId` (dono de hoje); `stronix_leads.referralVia`; `importSource`, `importBatchId` e `source` começando com "Importação" para tirar os importados. Cuidados com o dado:
  - O canal é texto livre e opcional no catálogo de origens (`src/views/settings/CatalogsSection.jsx:55`). Não é padronizado: "Pago" e "pago" viram dois canais.
  - A ligação é pelo nome da origem. Fica "Sem canal" todo lead cuja origem não está no catálogo: a origem editada no cadastro do cliente, que usa uma lista fixa no código e não o catálogo (`src/modals/ClientRegistrationModal.jsx:22` e `204`), a origem apagada e a "Indicação" que o sistema semeia sem canal (`src/App.jsx:1034`).
  - A origem é a de hoje, não a do primeiro contato. O cadastro do cliente pode sobrescrever (`src/lib/clientRegistration.js:61`), e renomear no catálogo reescreve os leads (`src/views/settings/CatalogsSection.jsx:58-60`). Um mês fechado muda de rótulo.
  - Funil e dono também são os de hoje (`src/lib/crm/scope.js:49-69`). Mudar o lead de funil ou de dono reescreve o passado, e lead excluído some da contagem dos meses fechados.
  - Os leads com `createdAtMissing` saem, porque o `normalizeLeadDoc` põe "agora" neles (`src/lib/leads.js:21`; `src/lib/crm/cohort.js:66-69`).
  - A exclusão dos importados usa `isImportCreatedLead`: `source` começando com "Importação" mais a marca do lote (`src/lib/operacional/routine.js:98-99`), e não só o `importBatchId`. O lead que já existia e casou com a planilha também recebe `importBatchId` (`src/lib/clientImport.js:595` e `648`), mas mantém a origem dele e continua contando. Está certo que conte.
- Desde quando: leads novos por `createdAt` desde 29/04/2026 (primeiro commit). O link público é marcado com `referralVia` desde 10/08/2026. O canal não tem data: vale o texto de hoje para qualquer mês, e só nas origens em que o gestor preencheu. O campo Canal aparece na tela desde 27/07/2026 (commit `5b4074b`), mas isso não é um corte do dado. A importação está no ar desde 04/09/2026, e mesmo assim a exclusão dos importados vale para todos os meses, porque o `createdAt` deles é a data da planilha (`src/lib/clientImport.js:624`).
- Viabilidade e prioridade: com ajuste, prioridade alta. É pergunta de todo fechamento e o dado está pronto; falta período livre e o canal, que é texto livre ligado pelo nome.
- Permissão e custo: todos os papéis. As rules liberam a leitura de leads e catálogos a qualquer membro (`firestore.rules:79-80` e `136-137`), e o consultor já recebe a equipe inteira (`src/App.jsx:838-852`). Não precisa de regra nova. Custo baixo: uma consulta de leads por `createdAt` na janela, campo único, sem índice composto (`src/lib/operacional/queries.js:21`), a mesma que o Operacional e o CRM já usam. As origens vêm do catálogo carregado no login. Numa academia de 2 a 3 mil leads, um mês traz centenas de documentos e um ano, de mil a três mil.
- Já existe em: Visão geral → CRM, no número de Leads novos e na seção Origem (`src/views/dashboard/CrmDashboard.jsx:51`), que agrupa pelo `source` do lead (`src/lib/crm/cohort.js:105-117`), só por mês. Não existe seção Canais no CRM, e nenhuma tela usa `stronix_sources.channel`.
- Conferência no código: ajustado. Mudou o seguinte: o canal não tem data nem histórico (não existe "canal desde 27/07/2026"), a ligação pelo nome gera a faixa "Sem canal", origem, funil e dono são estado de hoje, os importados saem em qualquer mês por `isImportCreatedLead`, os `createdAtMissing` saem, a forma de entrada tem três valores e a sobreposição foi corrigida (o CRM tem Origem, não Canais). Evidências: `src/views/settings/CatalogsSection.jsx:55-60`; `src/lib/clientImport.js:624`.

#### R002. Horário de chegada dos leads e cobertura de turno

Em que dia e hora os leads chegam, alguém da equipe está de turno nessa hora e esses leads convertem?

- Para quem: dono e gestor.
- Recortes: dia da semana, hora do `createdAt` e origem.
- Números: leads novos, consultores de turno na hora, leads fora de qualquer turno e conversão da safra.
- Filtros: período, origem e funil.
- Formato: mapa de calor dia × hora.
- De onde vem: `stronix_leads.createdAt`, `referralVia` e `source`; `convertedAt` e `clienteSince` pela primeira matrícula (`firstEnrolledAtOf`, `src/lib/crm/cohort.js:22-27`), sem a matrícula importada (`isImportedEnrollment`, `src/lib/crm/cohort.js:45-53`); `stronix_users.shiftStart` e `shiftEnd`; dado novo: hora de chegada do lead. Cuidados com o dado:
  - No lead manual, o `createdAt` é o `serverTimestamp()` do momento em que o consultor salva o cadastro (`src/modals/AddLeadModal.jsx:476`), não a hora em que a pessoa procurou a academia. O mapa mostra quando a equipe cadastra. Cruzar isso com o turno fica circular: alguém precisava estar no sistema para cadastrar.
  - Só o lead do link público tem a hora real de chegada, gravada no envio do formulário (`api/tenant-resolve.js:290`). E todos esses são indicação.
  - O turno é só hora HH:MM, sem dia da semana, e é o de hoje, sem histórico. Só a tela de Equipe grava (`src/views/settings/TeamAccessSection.jsx:255-256`, campo de hora na linha `586`). Quem foi excluído some da coleção. Turno que passa da meia-noite não tem tratamento, e nenhum arquivo de `api/` ou de `src/lib` lê o turno hoje.
  - Lead importado e lead com `createdAtMissing` ficam fora (`src/lib/operacional/routine.js:98-99`; `src/lib/crm/cohort.js:66-69`).
  - Para medir a chegada de verdade é preciso um campo novo, como a hora do primeiro contato informada no cadastro, ou receber o dado do Stronizap pela Parte B da ponte, que ainda não tem plano.
- Desde quando: hora de cadastro desde 29/04/2026. Hora real de chegada só nos leads do link, desde 10/08/2026. O turno existe desde 13/05/2026 (commit `22bda46`), mas só na versão de hoje. A chegada real dos leads manuais só existe a partir de quando o dado novo começar a ser gravado.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. Serve para montar a escala da recepção, mas o turno não tem histórico e o lead importado precisa sair.
- Permissão e custo: gestor e dono, com trava só na tela. As rules deixam qualquer membro ler leads e usuários (`firestore.rules:79-80` e `119-120`). Dono e gestor são o mesmo papel, admin. Custo baixo: a mesma leitura de leads por `createdAt` da janela, mais a equipe que já chega no login.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O mapa mede a hora do cadastro, e não a da chegada, fora os leads do link; o turno não tem dia nem histórico; a conversão usa a primeira matrícula sem importados, e não o `clienteSince` puro. Evidências: `src/modals/AddLeadModal.jsx:476`; `src/views/settings/TeamAccessSection.jsx:255-256`.

#### R003. Mapa de captação por DDD

De que regiões vêm os leads e quais regiões convertem?

- Para quem: dono e gestor.
- Recortes: DDD, origem e mês.
- Números: leads, matrículas e conversão.
- Filtros: período e origem.
- Formato: ranking por DDD.
- De onde vem: `stronix_leads.whatsapp` (ou `zapMatchKey`, que já começa pelo DDD), com o 55 do DDI tirado pela regra de `api/_zapPhone.js`; `stronix_leads.createdAt` e `createdAtMissing`; `convertedAt` e `clienteSince` pela `firstEnrolledAtOf`; `importSource`, `importBatchId` e `source` para tirar os importados. Cuidados com o dado:
  - O 55 só sai quando o número tem 12 dígitos ou mais, porque 55 também é o DDD de Santa Maria (`api/_zapPhone.js:6-13`).
  - O cadastro manual pede no mínimo 10 dígitos e não tem teto (`src/modals/AddLeadModal.jsx:404-411`). Número estrangeiro precisa de uma faixa própria.
  - DDD é a região da linha, não a de moradia. Endereço com cidade só existe no cliente com cadastro completo (`src/lib/clientRegistration.js:67-70`).
  - A conversão usa `firstEnrolledAtOf` e tira o lead e a matrícula importados (`src/lib/crm/cohort.js:45-53` e `76-78`), e não o `clienteSince` puro.
- Desde quando: desde 29/04/2026, para todo lead cadastrado no CRM. O WhatsApp é obrigatório e sempre traz o DDD, com no mínimo 10 dígitos no cadastro manual e no link (`api/tenant-resolve.js:195`).
- Viabilidade e prioridade: com ajuste, prioridade baixa. É o único dado de região com cobertura total, mas a pergunta é rara.
- Permissão e custo: gestor e dono, com trava só na tela. As rules liberam a leitura para qualquer membro. Custo baixo: leads do período por `createdAt`, com a conta do DDD feita no navegador.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O início passou de 13/07/2026 para 29/04/2026: o DDD sai do `whatsapp`, que todo lead tem desde o começo, e não depende do `whatsappDigits` (campo derivado criado em 13/07/2026, commit `9824a66`) nem do backfill. Entraram a regra do 55 e a conversão sem importados. Evidências: `api/_zapPhone.js:6-13`; `src/lib/leadDerived.js:28-34`.

#### R004. Custo por lead e por matrícula por canal pago

Quanto custou cada lead e cada matrícula em cada canal pago, e quanto de contrato voltou?

- Para quem: dono.
- Recortes: origem, campanha e mês.
- Números: investimento, custo por lead, custo por matrícula e valor de contrato vendido sobre o investimento.
- Filtros: período e origem.
- Formato: tabela por canal com evolução mês a mês.
- De onde vem: `stronix_leads.source` (o de hoje); `stronix_leads.createdAt`, `convertedAt` e `clienteSince` pela `firstEnrolledAtOf`, sem importados; `stronix_contratos.value`, `createdAt`, `renewedFromId`, `closedFromUpgrade` e `importBatchId`/`importSource`/`importedBy`, contando só matrícula nova, com `value` maior que zero e não importada; coleção nova de investimento por origem e mês, com regra própria; campo novo de campanha, opcional. Cuidados com o dado:
  - O investimento não existe no sistema. A coleção nova precisa de `match` no `firestore.rules`, publicado à mão, porque coleção sem regra é negada. Hoje todo membro lê tudo da academia (`firestore.rules:79-95`). Se o investimento for sigiloso, a regra nova restringe a leitura ao admin.
  - Campanha e UTM não têm campo em lugar nenhum. Nem o cadastro manual nem o link público gravam (`src/modals/AddLeadModal.jsx:452-480`; `api/tenant-resolve.js:264-291`). Seria dado novo no lead ou uma sub-origem no catálogo.
  - A atribuição usa a origem de hoje do lead, que é editável (`src/lib/clientRegistration.js:61`) e é sobrescrita pela lista fixa do cadastro do cliente (`src/modals/ClientRegistrationModal.jsx:22`). Não é a origem do primeiro contato.
  - O valor é de contrato, não é caixa. Conta pela data de fechamento (`createdAt` do contrato), deixa de fora os contratos importados (`src/lib/contracts.js:271`) e os de `value` menor ou igual a zero. Para aquisição só conta a matrícula nova, nunca renovação nem upgrade (`src/lib/gerencial/scope.js:7-34`). O rótulo precisa dizer "valor de contrato vendido".
- Desde quando: a partir do primeiro mês com investimento gravado. O valor de contrato só existe desde junho de 2026.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. O sistema não guarda investimento, campanha nem UTM.
- Permissão e custo: gestor (admin), com trava na regra da coleção nova se o investimento for sigiloso. Dono não é papel separado de gestor. Os demais dados já são legíveis por qualquer membro. Custo baixo: leads do período, contratos que já chegam pela assinatura do login e poucos documentos de investimento.
- Já existe em: nada parecido hoje. O mais perto é o Gerencial, que agrupa a venda do mês pela origem atual do lead, sem custo nenhum (`src/lib/gerencial/people.js:67-72`).
- Conferência no código: ajustado. Entraram a coleção nova com regra publicada à mão, a falta de campo de campanha, a origem de hoje no lugar do primeiro contato e o corte de valor do Gerencial (só matrícula nova, sem importado, sem valor zero). Evidências: `src/lib/gerencial/scope.js:7-34`; `firestore.rules:79-95`.

#### R005. Leads antigos que voltaram a procurar

Quantos leads em aberto, leads perdidos e ex-clientes voltaram a procurar a academia por conta própria, por qual canal dessa vez, e quanto disso vira matrícula?

- Para quem: dono e gestor.
- Recortes: situação do cadastro na volta (lead ativo, perda, cliente vencido), origem da volta, origem original, mês e dono atual.
- Números: voltas, voltas por canal, matrículas depois da volta e dias entre a volta e a matrícula.
- Filtros: mês, origem e situação do cadastro.
- Formato: tabela por origem e mês, com lista nominal.
- De onde vem: `stronix_interactions` com `type: 'referral'` e o texto "Tentou se cadastrar pelo link..." (só a volta por indicação, sem a situação do cadastro e sem id do indicador); dado novo: interação estruturada de nova procura no lead existente (marcador, origem da volta e situação na hora), gravada no aviso de duplicata do cadastro manual e no link; `stronix_leads.convertedAt`, `clienteSince` e os contratos, para medir a matrícula depois da volta. Cuidados com o dado:
  - A tentativa repetida pelo link só acontece com quem chegou pelo link de indicação de um cliente. Desde 03/09/2026 o link exige indicador válido (`api/tenant-resolve.js:205-215`). Com o dado de hoje, a origem da volta é sempre Indicação, e "voltas por canal" não sai.
  - O evento tem `type: 'referral'`, o mesmo dos eventos do indicado e do indicador. Só dá para separar pelo texto "Tentou se cadastrar..." (`api/_referral.js:82-85`). O indicador vem só como nome dentro do texto, sem id. A situação do cadastro no momento da volta não é gravada, então o relatório só enxergaria a de hoje.
  - No cadastro manual a duplicata é barrada antes do envio: `useDuplicateLead` desliga o botão (`src/modals/AddLeadModal.jsx:407-411`) e o envio só mostra um aviso (`src/modals/AddLeadModal.jsx:435-441`), sem gravar nada. O dado novo precisa nascer nesse aviso, como interação no lead existente, com a origem escolhida, a situação da hora e um marcador próprio. As rules deixam qualquer membro criar interação (`firestore.rules:90-95`).
  - A busca de duplicata compara o `whatsappDigits` exato (`src/hooks/useDuplicateLead.js:22`). O mesmo número digitado com 55 na frente passa como lead novo, e a volta não é vista.
- Desde quando: pelo link, a tentativa repetida é registrada desde 10/08/2026, sempre como indicação (texto criado no commit `8283a49`). Entre essa data e 03/09/2026 (commit `ca67691`), o link sem indicador criava lead novo no funil padrão. Pelo cadastro manual e com o canal da volta, só a partir de quando o dado novo começar a ser gravado.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. A campanha que traz de volta quem já está na base fica sem crédito, porque o cadastro manual só avisa da duplicata e a origem do lead não muda depois do primeiro cadastro. Por isso R001 e R004 contam esse canal a menos. É a conta do último contato, que o mercado usa ao lado da conta do primeiro.
- Permissão e custo: dono e gestor, com trava na tela. As rules liberam as interações a qualquer membro. Custo baixo: interações do mês por `createdAt`, campo único (`src/lib/operacional/queries.js:20`), com tipo e texto filtrados no navegador.
- Já existe em: em parte, dentro do catálogo. O R137 conta a tentativa repetida só pelo link de indicação. O R023 conta a reabertura feita pelo consultor, sem separar quem voltou sozinho.
- Conferência no código: ajustado. O dado de hoje só cobre a volta pelo link de indicação, sempre como Indicação, sem id do indicador e sem a situação da hora; o cadastro manual não grava nada; o número com 55 escapa da duplicata; e a permissão passou a bater com o público (dono e gestor, trava só de tela). Evidências: `api/tenant-resolve.js:219-241`; `src/modals/AddLeadModal.jsx:435-441`.


### 5.2 Funil e conversão

Este domínio mostra o caminho do lead do cadastro até a matrícula: de que mês e de que origem ele veio, por quais etapas passou, quanto tempo levou e quanto do funil de hoje deve virar venda. Quase todas as contas já existem em `src/lib/crm/` e rodam no navegador sobre a carga mensal do painel CRM. O limite está no dado. A troca de etapa só é gravada com origem e destino desde 14/09/2026, 18h10, os agendamentos só ficam completos a partir de setembro de 2026, e perda, dono, funil e origem são sempre os de hoje.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R006 | Conversão da safra por origem, consultor e funil | Alta | Com ajuste | Ajustado |
| R007 | Maturação da safra | Média | Com ajuste | Ajustado |
| R008 | Matrículas do período e matrículas da safra lado a lado | Média | Pronto | Ajustado |
| R009 | Velocidade até a matrícula | Média | Com ajuste | Ajustado |
| R010 | Passagem entre etapas e tempo na etapa | Alta | Com ajuste | Ajustado |
| R011 | Pipeline agora e leads parados na etapa | Alta | Com ajuste | Ajustado |
| R012 | Pipeline numa data passada e o que mudou entre duas datas | Média | Com ajuste | Ajustado |
| R013 | Conversão por funil | Média | Com ajuste | Ajustado |
| R014 | Movimentação entre funis | Baixa | Com ajuste | Ajustado |
| R015 | Qual caminho converte mais | Média | Com ajuste | Ajustado |
| R016 | Esforço até a venda | Baixa | Com ajuste | Ajustado |
| R017 | Promoções automáticas para Negociação | Baixa | Com ajuste | Ajustado |
| R018 | Etapas de meses antigos pelo texto | Baixa | Com ajuste | Ajustado |
| R019 | Previsão de matrículas e valor do funil | Baixa | Com ajuste | Ajustado |
| R020 | Rapidez do primeiro contato contra conversão | Alta | Com ajuste | Ajustado |

#### R006. Conversão da safra por origem, consultor e funil

Dos leads que entraram em cada mês, quantos agendaram, compareceram, matricularam, se perderam ou seguem em aberto?

- Para quem: dono, gestor e consultor.
- Recortes: mês de cadastro (a safra), origem, dono atual do lead e funil.
- Números: leads da safra, quantos agendaram, quantos compareceram, matriculados, perdidos, em aberto e a conversão em %.
- Filtros: período, pessoa, funil e origem. O filtro de origem não existe no CRM de hoje, e o período fica preso aos 12 meses do parâmetro de mês (`screenParams`).
- Formato: funil por safra, com uma tabela por origem e outra por pessoa.
- De onde vem: `stronix_leads.createdAt` (sem os de `createdAtMissing`), `convertedAt`, `clienteSince`, `lostAt` junto com o balde atual (`deriveLeadBucket === 'perda'`), `source`, `consultantId` e `funnelId` de hoje, e o espelho do agendamento no lead (`appointmentScheduledFor` e `appointmentOutcome`). De `stronix_aulas`: `scheduledFor`, `createdAt`, `status` e `type`, separados por `isAulaRecord` no navegador. De `stronix_interactions`: o `daily_goal_done` de `visita_hoje` (`appointmentOutcome`, `createdAt`). Importados saem por `isImportCreatedLead` e `isImportedEnrollment`.
- Desde quando: leads novos desde 29/04/2026, sem os de `createdAtMissing` e sem importados. A matrícula por `convertedAt` existe desde o início, mas a primeira matrícula de quem voltou só é confiável desde 30/06/2026 (`clienteSince`). Agendou e compareceu ficam completos a partir de setembro de 2026: as visitas têm registro desde 18/08/2026 e as aulas desde a segunda quinzena de julho de 2026. Perdidos: só quem segue em Perda hoje.
- Viabilidade e prioridade: com ajuste, alta. É a pergunta central do comercial, as contas estão em `src/lib/crm/cohort.js` e o crédito vai para o dono atual.
- Permissão e custo: todos os papéis, e as rules liberam a leitura para qualquer membro. Custo médio. Para cada mês da safra até o corrente entram os leads criados, os leads por `convertedAt`, por `clienteSince` e por `lostAt`, as aulas por `scheduledFor` e todas as interações do mês. Tudo é consulta de campo único, sem índice novo, na mesma memória de sessão do CRM e do Operacional. É o custo do painel CRM por mês carregado.
- Já existe em: Visão geral → CRM, nos blocos Conversão da safra, Canais e Conversão por pessoa, só por mês.
- Conferência no código: ajustado. O que mudou:
  - "Compareceram" não sai só de `stronix_aulas.status`. O registro de visita fica "agendada" para sempre, porque o app só grava desfecho no registro de aula. O CRM infere o desfecho da visita pelo espelho do lead do mesmo instante e, sem ele, pelo `daily_goal_done` de `visita_hoje` do dia marcado ou do seguinte (`effectiveStatus`). "Agendaram" também usa o espelho do lead quando a safra vai até agora (`cohortMilestones`). Esses campos entraram nas fontes.
  - Perdidos são só os que estão em Perda hoje. Perda reaberta ou que depois matriculou some da safra, porque sair da Perda zera o `lostAt`.
  - Matrícula é a data menor entre `convertedAt` e `clienteSince` (`firstEnrolledAtOf`). O `convertedAt` é regravado a cada matrícula. O `clienteSince` só existe desde o merge da PR #123, em 30/06/2026. A matrícula por etapa com nome de matrícula, sem contrato, só carimba `convertedAt`. Entre 30/06 e 08/09/2026, levar um cliente de volta para uma etapa de lead zerava o `convertedAt`. O alvo `converted` do `scripts/backfill-scale-fields.js` grava `convertedAt = createdAt` em cliente antigo sem data. O código não mostra se rodou, mas a memória do projeto registra que rodou na STRONIX em 14/07/2026 e gravou 19 clientes (seção 3.8). Nesses 19, as safras de abril a junho mostram matrícula no dia 0.
  - O corte por origem não está pronto. `makeScope` só recorta pessoa e funil, e `channelsOf` só dá leads e matriculados por origem, sem agendou, compareceu e perdeu. Cruzar origem com esses marcos pede estender o recorte.
  - A origem é o texto atual de `lead.source`. Renomear a origem no catálogo reescreve todos os leads, e a safra antiga muda de nome junto.
  - O custo é médio, e não baixo, porque a carga de cada mês traz todas as interações do mês para inferir a visita e achar o primeiro contato.
  - Evidência: `src/lib/crm/appointments.js:81-104`; `src/lib/crm/scope.js:54-69`.

#### R007. Maturação da safra

Quantos dias cada safra leva para matricular, e as safras novas convertem mais rápido que as antigas?

- Para quem: dono e gestor.
- Recortes: mês de cadastro, dias desde o cadastro (7, 14, 30, 60 e 90), origem e dono.
- Números: % matriculado até o dia N, % perdido até o dia N e % ainda em jogo.
- Filtros: origem, pessoa e funil.
- Formato: curvas de safra sobrepostas (coorte).
- De onde vem: `stronix_leads.createdAt`, `convertedAt`, `clienteSince`, `lostAt` junto com o balde atual, `source`, `consultantId` e `funnelId`. Importados saem por `isImportCreatedLead` e `isImportedEnrollment`.
- Desde quando: safras desde 29/04/2026. Primeira matrícula confiável desde 30/06/2026. Perda só para quem segue em Perda hoje. A curva de cada safra vai só até o dia que ela já viveu.
- Viabilidade e prioridade: com ajuste, média. Reusa `outcomeAt(lead, asOf)` e mostra se o mês fechado ainda vai subir.
- Permissão e custo: as rules liberam para todos, e o CRM de hoje abre para todos os papéis. Restringir a dono e gestor é decisão de tela. Custo médio: os leads criados de cada mês de safra, mais as consultas por `convertedAt` e `clienteSince` dos meses até hoje. Já estão na carga mensal do CRM e não pedem índice.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - A curva precisa de censura. Numa safra recente, o dia N só conta quando `createdAt` mais N dias já passou. Sem isso, as safras novas parecem piores do que são.
  - "% perdido até o dia N" só enxerga quem está em Perda hoje. O `lostAt` é apagado quando a perda é reaberta e regravado quando o lead perde de novo, então a data da primeira perda se perde.
  - A matrícula usa `firstEnrolledAtOf` (`convertedAt` ou `clienteSince`), não só `clienteSince`. Antes de 30/06/2026 vale só o `convertedAt`, que o retorno regrava. O backfill de `convertedAt = createdAt` que rodou na STRONIX em 14/07/2026 (19 clientes, pela memória do projeto) dá matrícula no dia 0 para esses casos.
  - Entraram nas fontes o `convertedAt`, o balde atual e os filtros de importado.
  - "Dono e gestor" é trava só de tela.
  - Evidência: `src/lib/crm/cohort.js:95-101` (`outcomeAt`, reaproveitável com `asOf = createdAt + N`); `src/lib/stageMove.js:89-92` (sair da Perda apaga o `lostAt`).

#### R008. Matrículas do período e matrículas da safra lado a lado

Quantas matrículas saíram no mês, de qualquer safra, e quanto da safra do mês já matriculou?

- Para quem: dono e gestor.
- Recortes: mês, dono, funil e origem.
- Números: matrículas do mês, matrículas vindas da própria safra e conversão da safra.
- Filtros: período, pessoa e funil.
- Formato: número com comparativo.
- De onde vem: `stronix_leads.createdAt`, `convertedAt`, `clienteSince`, `source`, `consultantId` e `funnelId`. Importados saem por `isImportCreatedLead` e `isImportedEnrollment`.
- Desde quando: `convertedAt` desde 29/04/2026. Primeira matrícula confiável desde 30/06/2026 (`clienteSince`).
- Viabilidade e prioridade: pronto, média. O CRM já calcula e já dá nome às duas leituras. O que o relatório acrescenta é a série de vários meses, a origem e a lista nominal.
- Permissão e custo: todos. Custo baixo: as mesmas listas do CRM por mês, sem nada novo.
- Já existe em: Visão geral → CRM, nos cards Matrículas e Conversão da safra. No mês em andamento, o card Matrículas já traz "X da safra de <mês> · Y de safras anteriores".
- Conferência no código: ajustado. O que mudou:
  - Deixou de ser "com ajuste". O CRM já calcula e mostra os dois números (`fromCohort`), e a ajuda da tela já separa "Matrículas" de "Conversão da safra". O nome claro que a justificativa pedia já existe.
  - Do jeito que foi proposto, o relatório repete o card do painel, contra a regra de cada número aparecer num lugar só. Ele só vale como camada de detalhe: série de vários meses, origem e lista nominal.
  - No mês fechado, o subtítulo do card mostra quanto da safra já matriculou até hoje, e não o `fromCohort` (matrículas do próprio mês vindas da safra). São leituras diferentes, e o relatório precisa dizer qual usa.
  - O filtro de origem não existe no CRM (`makeScope` só tem pessoa e funil).
  - A matrícula por etapa com nome de matrícula, sem contrato, conta aqui e não conta no Operacional nem no Gerencial.
  - Evidência: `src/lib/crm/metrics.js:185-190`; `src/lib/crm/texts.js:100-104`.

#### R009. Velocidade até a matrícula

Quantos dias leva do cadastro à matrícula, por origem, consultor e plano?

- Para quem: dono e gestor.
- Recortes: origem, dono, plano vendido e mês da matrícula.
- Números: mediana de dias e as faixas de 0 a 1, 2 a 3, 4 a 7, 8 a 14, 15 a 30 e 31 ou mais dias.
- Filtros: período, pessoa, funil e origem.
- Formato: histograma com a mediana e comparativo.
- De onde vem: `stronix_leads.createdAt`, `convertedAt`, `clienteSince`, `source` e `consultantId`. De `stronix_contratos`: `leadId`, `createdAt`, `planId`, `planName` e `isImportedContract`.
- Desde quando: 30/06/2026, com `clienteSince` e contratos. Antes disso, só por `convertedAt` e sem plano.
- Viabilidade e prioridade: com ajuste, média. A conta está pronta em `cohort.js`. O corte por origem é filtro, e o corte por plano pede ligar o lead ao contrato.
- Permissão e custo: todos. Custo baixo: as listas de matrícula do CRM, mais os contratos, que já chegam pela assinatura do App para todos os papéis.
- Já existe em: Visão geral → CRM, card Dias até a matrícula.
- Conferência no código: ajustado. O que mudou:
  - O corte por plano não sai pronto de `cohort.js`. É preciso ligar o lead ao primeiro contrato não importado dele (o de menor `createdAt` com o mesmo `leadId`). A matrícula por etapa com nome de matrícula não tem contrato nem plano, e fica em "Sem plano".
  - O `planId` do contrato pode mudar na correção, e o plano pode ter mudado de preço ou de duração depois da venda. O rótulo deve ser o `planName` do contrato.
  - `daysToEnrollOf` usa `firstEnrolledAtOf` (`convertedAt` ou `clienteSince`), não só `clienteSince`. Antes de 30/06/2026, a primeira matrícula de quem voltou se perde.
  - O filtro de origem não existe no CRM atual. Seria filtro em memória sobre `lead.source`, com o texto de hoje.
  - A mediana por pessoa é possível, porque é conta de lista, mas usa o dono de hoje.
  - Evidência: `src/lib/crm/cohort.js:132-141`; `src/lib/contracts.js:384-385` (a correção troca o plano).

#### R010. Passagem entre etapas e tempo na etapa

Onde o funil trava: quantos entram, avançam e se perdem em cada etapa, e quanto tempo ficam, por consultor e origem?

- Para quem: dono e gestor.
- Recortes: funil, etapa, período livre, pessoa e origem.
- Números: entraram, avançaram, perderam, taxa de avanço, mediana de tempo na etapa e o maior vazamento.
- Filtros: período, funil (obrigatório), pessoa e origem.
- Formato: funil com barras de passagem e uma tabela.
- De onde vem: `stronix_interactions` com `type` `status_change` (`fromStatus`, `toStatus`, `funnelId`, `fromFunnelId`, `createdAt`, `leadId`). `stronix_statuses.name`, `order` e `funnelId`. `stronix_leads.createdAt`, `status`, `funnelId`, `consultantId` e `source`, para a entrada pelo cadastro e os recortes. `convertedAt` e `clienteSince`, para o avanço por matrícula.
- Desde quando: 14/09/2026, 18h10 (PR #208). A entrada pelo cadastro só vale para quem foi cadastrado depois disso e dentro dos meses carregados sem falha.
- Viabilidade e prioridade: com ajuste, alta. `stagePassageOf` já aceita janela livre, e etapa renomeada divide a série.
- Permissão e custo: dono e gestor, por trava de tela. Custo médio: todas as interações de cada mês, do início da janela até hoje, na carga compartilhada, sem índice novo.
- Já existe em: Visão geral → CRM, bloco Passagem entre etapas, só por mês e um funil por vez.
- Conferência no código: ajustado. O que mudou:
  - A mediana de tempo na etapa é da academia inteira, por construção. O `ownerOk` recorta entraram, avançaram e perderam, mas não a mediana. Recortar a mediana por pessoa ou origem muda a regra do painel e pede decisão.
  - A janela livre funciona (`start` e `end` são parâmetros). Mas a entrada pelo cadastro e a troca seguinte exigem as interações carregadas do início da janela até hoje, sem mês faltando (`loadedRunStart`).
  - A origem entra combinada no predicado `ownerOk`. Funciona, porque o mesmo predicado recorta a entrada pelo cadastro.
  - Nem todo caminho grava a troca. A transferência em massa de um funil para Indicações (Configurações) muda `funnelId` e `status` sem `status_change`, só com uma nota sem `leadId`.
  - Não precisa do índice `type` + `createdAt`, que não está em `firestore.indexes.json` e teria de ser publicado à mão. As interações do mês já vêm inteiras por `createdAt`, de campo único, e o filtro de `status_change` roda no navegador.
  - O nome da etapa é o da hora da troca. Renomear parte a série.
  - Evidência: `src/lib/crm/stages.js:57-60` (mediana da academia); `src/views/settings/ReferralOwnersSection.jsx:131-149` (transferência sem `status_change`).

#### R011. Pipeline agora e leads parados na etapa

Quantos leads estão em cada etapa hoje, há quantos dias parados e quantos sem próximo contato?

- Para quem: gestor e consultor.
- Recortes: funil, etapa, dono e faixa de dias na etapa.
- Números: leads em jogo, dias na etapa (mediana), sem próximo contato e atrasados.
- Filtros: pessoa, funil e etapa.
- Formato: retrato por etapa, com tabela nominal exportável.
- De onde vem: `stronix_leads.status`, `funnelId`, `consultantId` e `lifecycleBucket`. `statusEnteredAt`, só desde 14/09/2026 e sem o link público nem a transferência em massa. `nextFollowUp`. `createdAt`, só como piso e para a regra de 24 horas.
- Desde quando: é um retrato de agora. Os dias na etapa só são exatos para quem trocou de etapa ou foi cadastrado pelo modal depois de 14/09/2026, 18h10. O resto aparece como "na etapa desde antes de 14/09" ou sem data.
- Viabilidade e prioridade: com ajuste, alta. O `statusEnteredAt` é gravado e nunca lido, e esta é a lista de trabalho do dia.
- Permissão e custo: todos. O consultor abre na própria carteira. Custo zero: a assinatura de leads ativos do App já está carregada.
- Já existe em: Visão geral → CRM, bloco Carteira agora, e o Pipeline.
- Conferência no código: ajustado. O que mudou:
  - Confirmado que `statusEnteredAt` é gravado e nenhum código o lê. Precisa converter com `getSafeDateOrNull`, porque o `normalizeLeadDoc` não trata esse campo.
  - Nem todo caminho grava. O cadastro pelo link público (`api/tenant-resolve.js`) cria o lead sem `statusEnteredAt`, e a transferência em massa para Indicações muda a etapa sem gravá-lo.
  - A regra "antes disso, usa o `createdAt`" estava errada para o lead cadastrado antes de 14/09/2026 que trocou de etapa: o `createdAt` superestima o tempo parado. Ela só vale para quem nunca trocou (link público depois de 14/09). Os outros aparecem como "na etapa desde antes de 14/09".
  - Atrasados e sem próximo contato são estado de agora (`nextFollowUp`). O painel já tira da conta de sem próximo contato o lead com menos de 24 horas, porque a Meta cobre esse caso.
  - A lista nominal exportável, para o consultor, traz a base inteira com telefone. As rules não recortam, e o CSV precisa da regra de neutralização.
  - Evidência: `src/lib/stageMove.js:62-65` (quem grava `statusEnteredAt` na troca); `api/tenant-resolve.js:263-295` (lead do link sem `statusEnteredAt`).

#### R012. Pipeline numa data passada e o que mudou entre duas datas

Como estava o funil no dia 1º, e o que entrou, avançou, saiu e matriculou até hoje?

- Para quem: dono e gestor.
- Recortes: etapa, funil, dono e data.
- Números: leads por etapa na data, entradas, avanços, perdas e matrículas.
- Filtros: duas datas, funil e pessoa.
- Formato: cascata (waterfall), com a evolução por etapa.
- De onde vem: `stronix_interactions` do tipo `status_change` (`fromStatus`, `toStatus`, `funnelId`, `fromFunnelId`, `createdAt`, `leadId`). `stronix_leads.status`, `funnelId`, `createdAt` e `consultantId` de hoje. `convertedAt`, `clienteSince` e `lostAt`, para achar quem saiu dos ativos.
- Desde quando: a reconstrução vale para datas a partir de 14/09/2026, 18h10. Série longa, ou atrasados numa data, só com uma foto diária nova.
- Viabilidade e prioridade: com ajuste, média. A etapa na data é o `fromStatus` da primeira troca depois dela. Atrasados antigos precisam de foto.
- Permissão e custo: dono e gestor. Custo médio: as interações de todos os meses desde a data e as listas de matriculados e perdidos. A foto diária seria custo novo de gravação.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Antes de 14/09/2026, 18h10, a troca não tem `fromStatus` nem `toStatus`, então a reconstrução começa ali.
  - Quem hoje é cliente ou está em Perda não está na assinatura de ativos. É preciso somar as listas por `convertedAt`, `clienteSince` e `lostAt` desde a data, ou buscar por id os leads citados nas trocas.
  - Lead excluído some junto com as interações dele. A transferência em massa para Indicações não deixa troca, e a transferência de dono em massa não deixa evento. A etapa e o dono na data podem sair errados.
  - Atrasados antigos e o dono na data não se reconstroem. O `nextFollowUp` é sobrescrito, e a migração em massa (`TransferLeadsTab`) reescreve o `leadConsultantId` das interações.
  - A série longa com foto diária exige gravar dado novo: coleção nova, regra nova publicada à mão e alguém que grave todo dia. Hoje não há rotina no servidor, e sobra uma vaga de função na Vercel.
  - Evidência: `src/lib/stageMove.js:51-60` (`fromStatus` e `toStatus`); `src/views/settings/TransferLeadsTab.jsx:129-166`.

#### R013. Conversão por funil

Os funis próprios (por exemplo, Corporativo) e o de Indicações convertem melhor que o padrão?

- Para quem: dono e gestor.
- Recortes: funil e mês.
- Números: leads novos, matrículas, perdas, conversão e valor vendido.
- Filtros: período e pessoa.
- Formato: tabela comparativa por funil.
- De onde vem: `stronix_leads.funnelId` de hoje, `createdAt`, `convertedAt`, `clienteSince` e `lostAt`. `stronix_funnels.systemKind`. De `stronix_contratos`: `leadId`, `createdAt`, `value`, `durationMonths`, `renewedFromId` e `isImportedContract`.
- Desde quando: funis próprios desde 29/04/2026, pelo funil de hoje. Indicações desde 10/08/2026, com leads antigos movidos em massa a partir de 13/08/2026. Valor desde 30/06/2026, quando os contratos entraram.
- Viabilidade e prioridade: com ajuste, média. Mover o lead de funil leva o passado junto, e o funil da época só sai da interação, a partir de setembro de 2026.
- Permissão e custo: todos. Custo baixo: as listas do CRM por mês e os contratos da assinatura do App.
- Já existe em: Visão geral → CRM, pelo filtro de funil. Mostra leads, matrículas e conversão da safra de um funil por vez, só por mês.
- Conferência no código: ajustado. O que mudou:
  - O funil de Indicações entrou em produção em 10/08/2026 (merge da PR #171), e não em 07/08/2026, que é a data do commit. Desde 13/08/2026 (PR #172), a transferência em massa de um funil inteiro para Indicações muda o `funnelId` sem evento e leva safras antigas para lá.
  - "Já existe em" não é vazio: o CRM mostra um funil por vez pelo filtro.
  - Valor vendido por funil não tem campo no contrato. Liga pelo `leadId` ao funil de hoje do lead e segue as regras do Gerencial: venda pela data de fechamento do contrato, sem importado, `value <= 0` fora do dinheiro, valor de contrato e não caixa. Falta decidir se conta só a primeira matrícula ou toda venda da pessoa, renovação incluída.
  - Lead sem `funnelId` cai no funil padrão. Trocar o padrão muda o funil desse lead antigo.
  - Evidência: `src/lib/contracts.js:158-161` (o contrato tem `leadId` e não tem `funnelId`); `src/views/settings/ReferralOwnersSection.jsx:131-149`.

#### R014. Movimentação entre funis

Quantos leads mudaram de funil, e de onde para onde?

- Para quem: gestor.
- Recortes: funil de origem, funil de destino e mês.
- Números: movimentos e leads distintos.
- Filtros: período.
- Formato: matriz de/para.
- De onde vem: `stronix_interactions` do tipo `status_change` (`fromFunnelId`, `funnelId`, `createdAt`, `leadId`). `stronix_funnels.systemKind` e `name`.
- Desde quando: 14/09/2026, 18h10. A transferência em massa para Indicações aparece só como nota de lote, desde 13/08/2026.
- Viabilidade e prioridade: com ajuste, baixa. Pouco volume e pergunta rara.
- Permissão e custo: gestor, por trava de tela, porque as rules liberam as interações para qualquer membro. Custo médio: as interações dos meses da janela, na carga mensal que já existe.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `fromFunnelId` só é gravado quando o funil muda (`stageChangeFields`), e só desde 14/09/2026, 18h10.
  - O Kanban grava `funnelId` para lead sem funil, com `fromFunnelId` nulo. Quando o destino é o funil padrão, isso não é movimento. O nulo deve ser tratado como o padrão, como o `stages.js` faz (`effFunnel`).
  - A transferência em massa para Indicações não gera evento por lead, só uma nota sem `leadId`. A contagem de leads distintos perde esses movimentos. O total do lote sai do texto da nota.
  - Evidência: `src/lib/stageMove.js:51-60`; `src/lib/crm/stages.js:65-68`.

#### R015. Qual caminho converte mais

O lead que faz só visita, só aula, as duas ou nenhuma converte mais, e mais rápido?

- Para quem: dono e gestor.
- Recortes: caminho, origem e funil.
- Números: leads, matrículas, conversão e dias até matricular.
- Filtros: período, origem e funil.
- Formato: tabela comparativa.
- De onde vem: `stronix_aulas.leadId`, `type` (`isAulaRecord`), `status`, `scheduledFor` e `createdAt`. O espelho no lead: `appointmentScheduledFor`, `appointmentType` e `appointmentOutcome`. `stronix_interactions` do tipo `daily_goal_done` (`dailyGoalCategory` `visita_hoje` e `aula_hoje`, `appointmentOutcome`). `stronix_leads.createdAt`, `convertedAt`, `clienteSince`, `source` e `funnelId`.
- Desde quando: safras a partir de setembro de 2026, quando os agendamentos ficam completos. Visitas têm registro desde 18/08/2026 e aulas desde a segunda quinzena de julho de 2026.
- Viabilidade e prioridade: com ajuste, média. Mostra onde vale pôr o esforço do consultor. Aula e visita se separam por `isAulaRecord` no navegador, nunca por `where` no `type`.
- Permissão e custo: dono e gestor. Custo médio: aulas e interações de cada mês, da safra até hoje, na carga do CRM, sem consulta por `leadId` e sem índice novo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O desfecho da visita não está em `stronix_aulas.status`, porque o registro de visita fica "agendada". Precisa da inferência do CRM (espelho do lead e `daily_goal_done` de `visita_hoje`).
  - Reagendar pela Meta Diária só move o registro de aula. A visita reagendada ali deixa o registro velho na data antiga, e a data nova fica só no espelho do lead. O caminho "só visita" sai subcontado ou na data errada.
  - A gravação no registro fica dentro de um try/catch e não trava nada se falhar. Nesse caso, a aula existe só no espelho do lead.
  - O caminho "nenhuma" mistura quem não agendou com quem agendou sem registro (visitas antes de 18/08/2026 e falhas de gravação).
  - Não precisa de consulta por `leadId`. Os registros por `scheduledFor` dos meses da safra até hoje já vêm na carga do CRM (`recordsByLead`). O agendamento feito depois da primeira matrícula fica fora, como no CRM.
  - Evidência: `src/views/DailyGoalView.jsx:1464-1480` (só a aula é regravada no reagendamento); `src/lib/appointmentOutcome.js:106-110` (só desfecho de aula vai ao registro).

#### R016. Esforço até a venda

Quantos toques e quantos dias um lead recebe antes de matricular ou ser perdido?

- Para quem: gestor e consultor.
- Recortes: desfecho, origem e dono.
- Números: mediana de interações até o desfecho e dias até o desfecho.
- Filtros: período, pessoa e origem.
- Formato: histograma.
- De onde vem: `stronix_interactions.leadId`, `type`, `text` e `createdAt`, filtradas por `isContactInteraction`. `stronix_leads.createdAt`, `convertedAt`, `clienteSince`, `lostAt` junto com o balde atual, `source` e `consultantId`. Não usar `interactionsCount`.
- Desde quando: as interações existem desde 29/04/2026, então o esforço vale para safras de qualquer mês dentro da janela de 12 meses. O desfecho de matrícula é confiável desde 30/06/2026.
- Viabilidade e prioridade: com ajuste, baixa. A justificativa original (a contagem exata exigiria leitura por lead) caiu na conferência, e a prioridade seguiu baixa.
- Permissão e custo: todos, pelas rules. Restringir ao gestor é decisão de tela. Custo médio: as interações dos meses do cadastro até o desfecho, pela carga mensal compartilhada, sem leitura por lead.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `interactionsCount` não serve nem como aproximação. Não sobe nas interações gravadas direto por `addDoc`: desfecho e promoção pela Agenda do dia, e os eventos da importação, estes de propósito. Sobe no evento de indicação, que não é contato, e o lead do link já nasce com 1. Só existe desde 13/07/2026 (merge da PR #137). Antes disso, só se o alvo `denorm` do backfill foi rodado.
  - A contagem exata não precisa de leitura por lead. As interações de cada mês já vêm inteiras na carga compartilhada. Basta agrupar por `leadId`, do cadastro ao desfecho, com o mesmo filtro de contato do CRM (`isContactInteraction`), que tira nota de cadastro, indicação, importação e troca de responsável. Troca de etapa e tarefa concluída contam como toque.
  - O desfecho perda só vale para quem está em Perda hoje, e a perda reaberta some.
  - Lead excluído leva as interações junto.
  - Evidência: `src/lib/appointmentOutcome.js:113-134` (`addDoc` sem somar no contador); `src/lib/crm/contact.js:17-21` (`isContactInteraction`).

#### R017. Promoções automáticas para Negociação

Quantos leads entraram em Negociação por comparecimento e quantos por decisão do consultor?

- Para quem: gestor.
- Recortes: tipo (visita ou aula), funil e mês.
- Números: promoções automáticas e promoções manuais.
- Filtros: período e funil.
- Formato: número com comparativo.
- De onde vem: `stronix_interactions` do tipo `status_change` (`toStatus`, `fromStatus`, `funnelId`, `text`, `createdAt`, `leadId`) e do tipo `daily_goal_done` (`dailyGoalCategory`, `appointmentOutcome`, `createdAt`, `leadId`).
- Desde quando: as automáticas, pelo texto, desde 18/05/2026. A comparação com as manuais usando campos, desde 14/09/2026, 18h10.
- Viabilidade e prioridade: com ajuste, baixa. Explica a passagem para Negociação, mas a causa só está no texto "após comparecimento".
- Permissão e custo: gestor. Custo médio: as interações dos meses da janela, pela carga mensal, sem índice novo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Nenhum campo marca a promoção como automática. A única marca é o texto "Fase alterada para [Negociação] após comparecimento em <categoria>", gravado nos dois caminhos (Meta Diária e Agenda do dia), desde 18/05/2026.
  - O tipo visita ou aula sai do rótulo da categoria no texto ("Visita Hoje" ou "Aula Experimental Hoje") ou do `daily_goal_done` gravado junto (`dailyGoalCategory`, `appointmentOutcome` `attended`). O `status_change` não leva a categoria.
  - Promoção manual é o `status_change` com `toStatus` Negociação sem esse texto, feito pelo Kanban ou pela ficha. Com `toStatus` e `funnelId`, só desde 14/09/2026, 18h10. Antes disso, só pelo texto "[Negociação]".
  - A promoção automática exige que o `funnelId` do lead seja o da etapa Negociação, então lead sem `funnelId` nunca é promovido. Cliente na Agenda do dia também não.
  - Para não depender de texto, dá para gravar um campo novo no `status_change`, por exemplo a causa "comparecimento" e a categoria.
  - Evidência: `src/views/DailyGoalView.jsx:1195-1258`; `src/lib/appointmentOutcome.js:126-134`.

#### R018. Etapas de meses antigos pelo texto

Dá para ver o funil antes de 14/09/2026?

- Para quem: dono.
- Recortes: mês e etapa de destino.
- Números: movimentos para cada etapa.
- Filtros: período.
- Formato: evolução mensal.
- De onde vem: `stronix_interactions.text`, em quatro formatos ("Movido para a etapa [X]", "Fase alterada para [X]", "Lead perdido. Motivo:" e "Matrícula realizada"). `stronix_interactions.type == 'status_change'`, filtrado no navegador, sem os que têm `toStatus` e sem os de troca de responsável. `createdAt` e `leadId`. `stronix_leads.funnelId` de hoje, como funil aproximado do movimento.
- Desde quando: só a etapa de destino, pelo texto, desde o primeiro commit do repositório (`e07e9f4`, 29/04/2026). A matrícula pelo texto do contrato vale desde junho de 2026. Não consegui confirmar pelo código se há dado anterior no banco. De 14/09/2026, 18h10, em diante, usar `toStatus` e `fromStatus`.
- Viabilidade e prioridade: com ajuste, baixa. É leitura de texto, sem a origem da troca, e depende de decisão.
- Permissão e custo: gestor (admin), com trava só de tela, porque as rules deixam qualquer membro ler as interações. O papel "dono" não existe. Custo alto no primeiro carregamento: as interações de todos os tipos de cada mês, de abril a setembro, porque filtrar o `type` no servidor pediria o índice composto `type` + `createdAt`, que não existe. Dá para reaproveitar a memória de sessão dos meses (`monthSources`), que já guarda essas interações para os painéis dentro da janela de 12 meses.
- Já existe em: nada parecido hoje. O CRM deixa de fora a troca antiga, que só tem texto.
- Conferência no código: ajustado. O que mudou:
  - O texto não tem formato único. A etapa de destino aparece entre colchetes em "Movido para a etapa [X] via Kanban." e em "Fase alterada para [X]" (ficha e promoção automática após comparecimento). A perda vem como "Lead perdido. Motivo: ...", sem colchete. A matrícula pelo contrato, desde junho, vem como "Matrícula realizada" seguido do plano, sem etapa. A leitura precisa tratar os quatro formatos, senão Perda e matrícula somem do funil antigo.
  - O texto não diz o funil. As etapas "Aguardando contato" e "Negociação" existem em vários funis, então o funil de cada movimento sai do `funnelId` de hoje. Lead que trocou de funil leva o passado junto, e o recorte "Todos os funis sem Renovações, Vencidos e Upgrade" vira aproximação.
  - O nome é o da hora da troca. Etapa renomeada depois divide a série em duas linhas, e o relatório precisa aceitar nome que não existe mais no catálogo.
  - Há `status_change` que não é troca de etapa de lead: a troca de responsável ("Responsável alterado...", sem colchete), os movimentos dos quadros de Renovações, Vencidos e Upgrade (`plan.interactionText`) e a matrícula ou renovação do contrato. Todos precisam ser filtrados. A promoção automática para Negociação ("após comparecimento") aparece separada, porque ali o consultor não decidiu nada.
  - A etapa em que o lead nasceu não vira interação. Sem a entrada pelo cadastro, a primeira etapa fica subcontada nos meses antigos.
  - Lead excluído leva as interações junto (a ficha apaga), então um mês antigo recalculado pode diminuir.
  - A contagem é só de movimentos para cada etapa, sem saída e sem passagem entre etapas.
  - Evidência: `src/views/KanbanView.jsx:859` ("Movido para a etapa [X] via Kanban."); `src/lib/crm/stages.js:17-20` (a troca antiga, só com texto, fica fora do CRM).

#### R019. Previsão de matrículas e valor do funil

Quanto devemos fechar até o fim do mês com o que está no funil?

- Para quem: dono e gestor.
- Recortes: etapa, dono e funil.
- Números: leads por etapa, taxa histórica de avanço, ticket médio, matrículas previstas e valor previsto.
- Filtros: funil e pessoa.
- Formato: número com faixa de previsão.
- De onde vem: `stronix_leads` ativos ao vivo (`status`, `funnelId`, `consultantId`, `createdAt`, `modalidade`). `stronix_leads.convertedAt`, `clienteSince` e `lostAt`, para a conversão por safra e os dias até a matrícula. `stronix_interactions.toStatus`, `fromStatus` e `funnelId`, só desde 14/09/2026, 18h10, para a taxa por etapa no futuro. De `stronix_contratos`: `value`, `durationMonths`, `createdAt`, `renewedFromId`, `closedFromUpgrade` e `isImportedContract`, para o ticket de matrícula nova. Um campo novo opcional no lead, com valor ou plano de interesse, que não existe hoje.
- Desde quando: conversão da safra e dias até a matrícula desde abril de 2026. Ticket desde junho de 2026, quando os contratos entraram. A taxa por etapa só fica utilizável alguns meses depois de 14/09/2026, 18h10.
- Viabilidade e prioridade: com ajuste, baixa. Sem valor no lead, só sai estimativa por taxa vezes ticket, e o histórico ainda é curto.
- Permissão e custo: gestor (admin), com trava só de tela. O papel "dono" não existe, e hoje todos os papéis veem CRM e Gerencial. Custo baixo a médio: os ativos já vêm da carga ao vivo, os contratos da assinatura do login e as safras da memória de sessão do CRM. Nenhuma consulta nova e nenhum índice novo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Não achei quem grava valor esperado no lead: nenhum `expectedValue` ou equivalente em `src/` nem em `api/`. O valor por lead pede campo novo, gravado no cadastro, na ficha e no Kanban. A importação não teria esse dado.
  - A taxa histórica de avanço por etapa só existe a partir de 14/09/2026, 18h10: dez dias de dado hoje. E o `stagePassageOf` mede avanço para qualquer etapa de ordem maior, não a chance de uma etapa chegar à matrícula. A previsão por etapa precisa de meses de trocas registradas e de uma conta nova, da etapa até a matrícula, que não existe.
  - A quantidade dá para prever sem dado novo: a conversão da safra por mês (desde abril) e os dias até a matrícula (`daysToEnrollOf`), aplicados aos leads abertos de agora (`pipelineNowOf`, que já vem da carga ao vivo de ativos).
  - O ticket segue as regras do Gerencial. Só vale matrícula nova (sem renovação nem upgrade), sem importado e sem contrato de valor zero. A moeda tem de estar declarada, valor total do contrato ou valor por mês (`value ÷ durationMonths`), sem somar as duas. É valor de contrato, não é caixa, e o contrato existe desde junho de 2026.
  - A matrícula por etapa com nome de matrícula não tem contrato. Ela entra na contagem do CRM e fica fora do valor, então a previsão de quantidade e a de valor não usam a mesma base.
  - Sem campo novo, uma saída é o ticket por modalidade de interesse (`lead.modalidade`, gravado no cadastro), cruzado com as modalidades dos planos vendidos. Continua sendo estimativa.
  - Dono e funil são os de hoje (`consultantId` e `funnelId` atuais).
  - Pode esbarrar na preferência contra índice inventado. A previsão precisa mostrar a base (quantas safras, quantos leads) e a faixa, sem virar veredito.
  - Evidência: `src/lib/crm/stages.js:40-60` (passagem mede avanço para etapa de ordem maior, não para matrícula); `src/lib/gerencial/scope.js:11-21` (regras do ticket e valor zero fora).

#### R020. Rapidez do primeiro contato contra conversão

O lead que recebe o primeiro contato em até 5 minutos, 30 minutos, 1 hora ou 24 horas agenda e matricula mais do que o lead que espera mais ou nunca é contatado?

- Para quem: dono e gestor.
- Recortes: faixa de tempo até o primeiro contato (até 5 min, até 30 min, até 1 h, até 24 h, mais de 24 h e sem contato), origem, dono atual, dia da semana e hora do cadastro, e mês de cadastro (safra).
- Números: leads da safra, agendaram, compareceram, matricularam, perdidos, conversão da safra em % e mediana de dias até a matrícula em cada faixa.
- Filtros: todos os funis menos os de cliente, sem importados, e período da safra.
- Formato: tabela por faixa de tempo, com barra de dois tons (leads e matrículas) e recorte por origem. Cada linha abre a lista de leads da faixa.
- De onde vem: `stronix_leads.createdAt`, `createdAtMissing`, `convertedAt`, `clienteSince`, `lostAt`, `source`, `consultantId` e `funnelId`, com `importBatchId` e `importSource` para tirar os importados. `stronix_interactions.createdAt` (o instante do registro), `type`, `volumeKind`, `text`, `toStatus` e `leadId`. `stronix_aulas.scheduledFor`, `status` e `type` (`isAulaRecord` no navegador), mais o desfecho de visita inferido da linha do tempo. Os minutos até o primeiro contato já saem de `src/lib/crm/contact.js:45-63`. As faixas de 5 e 30 minutos são novas.
- Desde quando: leads e interações desde 29/04/2026 (primeiro commit). Agendaram e compareceram completos só desde setembro de 2026, com visitas desde 18/08/2026. As safras recentes ainda não estão maduras.
- Viabilidade e prioridade: com ajuste, alta. É o ponto mais barato de melhorar na venda, e o playbook já pede resposta em até 30 minutos (`02-playbooks/TIME COMERCIAL/PLAYBOOK_COMERCIAL_STRONIX.md:343`). Se o relatório mostrar que o contato rápido converte mais, a regra vira meta cobrada. Os dados existem, falta cruzar.
- Permissão e custo: todos os papéis veem os números agregados, como na aba CRM. A lista nominal usa `LeadLink`, e as rules não recortam nada. O custo reaproveita a carga do CRM: leads por `createdAt` e interações do mês do cadastro e do seguinte, da memória de sessão (`monthSources`), com o mês corrente vindo das interações ao vivo. Sem índice novo. Cabe em academia de 2 a 3 mil leads.
- Já existe em: o card de tempo até o primeiro contato da aba CRM (mediana e faixas) e a mediana na tabela da equipe. Nenhum dos dois cruza o tempo com o resultado. No catálogo, o R107 mede o mesmo tempo por consultor e o R006 mede a conversão da safra, cada um sem o outro.
- Conferência no código: ajustado. O que mudou:
  - O primeiro contato é o instante em que a interação foi registrada (`serverTimestamp`), não o instante da conversa. O próprio spec avisa que WhatsApp sem registro não conta. O relatório mede a disciplina de registro, não a velocidade de resposta.
  - A faixa de 5 minutos sai inflada por construção. Depois do cadastro, "Ver ficha" abre a ficha, e o agendamento feito ali grava uma nota com `volumeKind` (visita, aula, mensagem, ligação), que conta como contato. Cruzar "contato em 5 minutos" com "agendaram" fica em parte circular, porque o primeiro contato é o próprio agendamento. Arrasto no Kanban, adiamento e `daily_goal_done` também contam. O relatório precisa mostrar o tipo da primeira interação, ou separar quem agendou no ato do cadastro.
  - Na recepção e no WhatsApp, o lead costuma ser cadastrado depois da conversa. Aí o tempo até o primeiro contato não reflete espera nenhuma.
  - O `firstContactOf` hoje só dá as faixas até 1 h, até 24 h, mais de 24 h e sem contato. As de 5 e 30 minutos pedem uma função nova sobre os mesmos minutos, o que é ajuste simples. A janela olha só o mês do cadastro e o seguinte, e isso basta para essas faixas.
  - O playbook fala em 30 minutos "durante o horário de trabalho". Sem descontar o horário, o lead do link público cadastrado à noite cai em "mais de 24 h" ou "até 24 h" sem culpa de ninguém.
  - O lead não tem campo de canal. Ele guarda só `source`, que o `channelsOf` já agrupa. O canal (Orgânico, Pago, Offline) mora no catálogo de origens, em `stronix_sources.channel`, texto livre ligado pelo nome da origem, com os cuidados do R001.
  - Agendaram e compareceram saem do `cohortMilestones`, com `stronix_aulas` mais o desfecho de visita inferido da linha do tempo. Antes de setembro de 2026 são parciais, e as visitas só existem desde 18/08/2026. A conversão de safra recente continua subindo, então as safras precisam ser comparadas maduras e com a base à vista. Com poucas dezenas de leads por faixa, a diferença pode ser acaso.
  - Dono e funil são os de hoje, então a transferência muda o passado. E a correlação não prova que rapidez causa matrícula: o consultor rápido também pode ser o melhor vendedor.
  - A lista nominal por faixa usa `LeadLink` e leva só a faixa no endereço, nunca nome.
  - Evidência: `src/lib/crm/contact.js:17-21` (o que conta como contato); `src/views/LeadProfileView.jsx:575-584` (agendamento pela ficha grava nota com `volumeKind`).


### 5.3 Perdas

Este domínio mostra por que a academia perde lead, em que etapa, por qual canal e com qual consultor, e quantos perdidos voltam ao funil ou matriculam depois. O limite está no próprio lead: ele guarda só a última perda, e sair da Perda ou matricular apaga o `lostAt` e o `lossReason`. O histórico fica nas interações, onde o motivo só existe no texto e a etapa da perda só aparece a partir de 14/09/2026 às 18h10. Origem, dor e dono são sempre os valores de hoje.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R021 | Perdas por motivo, etapa, origem e consultor | Alta | Com ajuste | Ajustado |
| R022 | Perdas registradas no período, inclusive as reabertas | Média | Com ajuste | Ajustado |
| R023 | Reativação de perdidos | Média | Com ajuste | Ajustado |
| R024 | Tempo até a perda por motivo | Baixa | Com ajuste | Ajustado |
| R025 | Perdas depois de comparecer | Média | Com ajuste | Ajustado |
| R026 | Repescagem de leads perdidos | Alta | Com ajuste | Ajustado |

#### R021. Perdas por motivo, etapa, origem e consultor

Por que, em que etapa, de que canal e com quem a academia perde leads?

- Para quem: dono, gestor e consultor.
- Recortes: motivo, etapa da perda, origem, dono, dor, funil e mês.
- Números: perdas, participação de cada motivo em % e uma taxa sobre a safra. A taxa precisa de uma base só, escrita no rótulo: perdidos da safra sobre leads da safra (por `outcomeAt`), ou perdas do mês sobre leads novos do mês.
- Filtros: período, pessoa, funil, origem e motivo.
- Formato: ranking, matriz de motivo por origem e por consultor, e tabela nominal exportável.
- De onde vem: `stronix_leads.lossReason` (texto, com o nome de hoje depois da cascata do catálogo), `stronix_leads.lostAt` (última perda, apagado ao reabrir ou matricular), `stronix_leads.lifecycleBucket` (filtro `'perda'` feito no navegador), `stronix_leads.source`, `dor`, `consultantId` e `funnelId` (valores de hoje), `stronix_leads.createdAt` (base da safra), `stronix_interactions` do tipo `status_change` com `toStatus` `'Perda'` e `fromStatus` para a etapa (carregadas pelo mês em `interactionsInMonthSpec`) e `stronix_interactions.actorId` para saber quem marcou. A `dor` é gravada no cadastro e fica nula no link público e na importação (`src/modals/AddLeadModal.jsx:465`).
- Desde quando: motivo e `lostAt` desde 29/04/2026, que é a data do primeiro commit e já gravava os dois (`git show e07e9f4`, `src/App.jsx:1609`). Perdas antigas sem `lostAt` ficam fora, porque nunca houve backfill desse campo. Etapa da perda desde 14/09/2026 às 18h10; antes disso ela aparece como "Sem etapa". Quem marcou, pelo `actorId`, desde 13/07/2026.
- Viabilidade e prioridade: com ajuste, alta. É pergunta de todo fechamento, e hoje a tela conta só quem segue perdido e o motivo é puxado pelo item que já vem marcado.
- Permissão e custo: todos, como o CRM, porque as regras do Firestore deixam qualquer membro ler leads e interações (`firestore.rules:79-80`). O recorte por pessoa usa o dono de hoje. A tabela nominal depende da decisão pendente sobre exportar dado pessoal, e não existe registro de exportação; o CSV segue a regra do `LeadsView`. Custo baixo: uma consulta de campo único por `lostAt` na janela (`src/lib/crm/queries.js:18`), os leads criados no mês para a safra e as interações do mês, que o CRM e o Operacional já carregam. Nenhum índice novo.
- Já existe em: Visão geral → CRM, nos cards Perdas por motivo e Etapa da perda (`src/views/dashboard/LossCard.jsx:46-96`, `src/views/dashboard/CrmDashboard.jsx:69`).
- Conferência no código: ajustado. O que mudou:
  - O relatório é de estado, não de evento. `lossesOf` conta só quem está em Perda hoje com `lostAt` na janela. Lead reaberto some do mês em que foi perdido, porque sair da Perda apaga `lostAt` e `lossReason`. Lead perdido de novo muda de mês, porque o `lostAt` é regravado. A tela precisa dizer "perdas que continuam perdidas", ou a contagem do período tem que vir do evento (ver R022).
  - O motivo é texto. Renomear no catálogo reescreve só os leads, então um mês fechado recalculado já mostra o nome novo. O modal abre com o primeiro motivo da lista marcado (`src/modals/LossReasonModal.jsx:8-9`), e quem só confirma infla esse motivo.
  - Origem, dor e dono são os de hoje. Transferir a carteira, inclusive pela migração em massa, que tem o grupo "Perdas" (`src/views/settings/TransferLeadsTab.jsx:19`), muda o passado por consultor. Quem marcou a perda está no `actorId`.
  - A etapa da perda vale desde 14/09/2026 às 18h10 (`STAGE_TRACKING_SINCE`), e não desde o dia 14 inteiro.
  - A medida "perdas sobre leads da safra" misturava duas bases: perda do mês, de lead de qualquer safra, dividida por leads novos do mês. Ficou a escolha descrita em Números.
  - Evidências: `src/lib/crm/cohort.js:80-91` (`lossesOf` filtra `deriveLeadBucket === 'perda'` e `lostAt` na janela, agrupado por `lossReason`) e `src/lib/stageMove.js:89-92` (sair de Perda zera `lossReason` e `lostAt`).

#### R022. Perdas registradas no período, inclusive as reabertas

Quantas perdas houve de fato no mês, mesmo as que depois voltaram ao funil?

- Para quem: gestor e dono.
- Recortes: mês, motivo, etapa de origem e quem marcou a perda.
- Números: perdas registradas, quantas seguem perdidas, quantas foram reabertas e o % reaberto por motivo.
- Filtros: período, funil e pessoa.
- Formato: número com comparativo e tabela.
- De onde vem: `stronix_interactions` do tipo `status_change` com `toStatus` `'Perda'` (desde 14/09/2026 às 18h10) ou com `text` começando com `'Lead perdido.'` (desde 29/04/2026). O motivo sai do `text` por regex, com o nome da época. `fromStatus` e `funnelId` do evento (desde 14/09/2026 às 18h10), `actorId` (desde 13/07/2026) e `createdAt`. A reabertura sai das trocas posteriores com `fromStatus` `'Perda'`. O estado de hoje dos que saíram da Perda vem de `stronix_leads` por id, em lotes de 30.
- Desde quando: pelo texto, desde 29/04/2026 (`git show e07e9f4`, `src/App.jsx:1619`); pelo `toStatus`, desde 14/09/2026 às 18h10.
- Viabilidade e prioridade: com ajuste, média. O mês fechado encolhe porque sair de Perda apaga `lostAt` e `lossReason`, e o motivo no evento só existe no texto.
- Permissão e custo: gestor e dono na tela. As regras deixam qualquer membro ler as interações, então a trava é só de tela. Custo médio: todas as interações do mês, que a carga do CRM e do Operacional já lê (`src/hooks/monthSources.js:71-81`), mais os leads reabertos buscados por id em lotes de 30. Filtrar `type` junto com `createdAt` no servidor pediria índice composto que não existe em `firestore.indexes.json`, por isso a leitura é do mês inteiro. Nenhum índice novo.
- Já existe em: nada parecido hoje. A ficha reconhece a perda no texto, mas só na linha do tempo de um lead.
- Conferência no código: ajustado. O que mudou:
  - A interação de perda não tem campo de motivo. Ele só existe no texto "Lead perdido. Motivo: X" e sai por regex, como a ficha já faz. Motivo com ponto no nome é cortado. A renomeação do catálogo não chega ao texto, então o mesmo motivo aparece em duas linhas.
  - Filtrar pelo texto exige tirar as recusas de Upgrade ("Upgrade: não quis. Motivo:"), que também são `status_change` (`src/lib/stageMove.js:136-142`). O filtro seguro é `toStatus === 'Perda'` ou o texto começando com "Lead perdido.".
  - O dono no evento não serve como histórico: o `leadConsultantId` é reescrito pela migração em massa (`src/views/settings/TransferLeadsTab.jsx:150-163`). Quem marcou está no `actorId`. O `funnelId` do evento só existe desde 14/09/2026 às 18h10; antes vale o funil de hoje do lead.
  - "Reabertas" não sai só das interações da janela. Precisa das trocas com `fromStatus` `'Perda'` depois da perda, até hoje, portanto dos meses seguintes, ou do lead de hoje (balde diferente de `'perda'`, ou `lostAt` posterior ao evento). O lead reaberto sai da consulta por `lostAt`, e por isso é buscado por id.
  - O custo não era só "status_change da janela": é a leitura de todas as interações do mês, já feita hoje.
  - Lead excluído leva as interações junto, então as perdas dele somem também deste relatório.
  - Evidências: `src/views/LeadProfileView.jsx:304` e `src/views/KanbanView.jsx:1182` (texto `Lead perdido. Motivo: ${reason}` com `...loss.stageChange`, sem campo de motivo na interação) e `src/views/LeadProfileView.jsx:974-993` (a ficha acha a perda por regex, exclui `/^upgrade: /` e extrai o motivo com `/motivo:\s*([^.·\n]+)/`).

#### R023. Reativação de perdidos

Quantos perdidos foram reabertos, de qual motivo, e quantos matricularam depois?

- Para quem: gestor e dono.
- Recortes: mês da reabertura, motivo da perda anterior e dono. O dono é quem reabriu (`actorId`) ou o consultor de hoje (`consultantId`), com a escolha escrita na tela.
- Números: reabertos, matriculados depois de reabrir e dias entre a perda e a volta.
- Filtros: período, pessoa e motivo.
- Formato: tabela por motivo.
- De onde vem: `stronix_interactions` do tipo `status_change` com `fromStatus` `'Perda'` (a reabertura, desde 14/09/2026 às 18h10), separando as que têm `toStatus` `'Venda'`. `text` e `createdAt` da perda anterior do mesmo lead, pelo histórico por `leadId` em lotes de 30. `actorId` para quem reabriu. `stronix_leads.clienteSince` e `consultantId`. `stronix_contratos.createdAt`, sem contrato com `isImportedContract`.
- Desde quando: 14/09/2026 às 18h10 para o dado estruturado. Antes disso a reabertura só se reconstrói pela sequência de textos: "Lead perdido." seguido de "Fase alterada para [X]" ou "Movido para a etapa [X]".
- Viabilidade e prioridade: com ajuste, média. A rotina manda reativar "Sem resposta" em 7 dias e "Sem interesse" em 30 a 60 dias.
- Permissão e custo: gestor e dono na tela; as regras liberam a leitura a todos os membros. Custo médio: as interações do mês, já carregadas, acham as reaberturas. Depois vem o histórico por lead em lotes de 30 (`leadId in`, com o índice `leadId` ASC + `createdAt` DESC que já existe em `stronix_interactions`) para achar a perda anterior, e os leads por id.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O motivo e a data da perda anterior não estão no lead reaberto, porque sair da Perda apaga `lossReason` e `lostAt`. Eles saem da interação de perda anterior, que pode estar meses antes da reabertura. Isso pede o histórico por lead, e não só as interações do mês.
  - A matrícula feita direto de um lead em Perda (`ContractModal`, pela coluna Venda) grava `fromStatus` `'Perda'` e `toStatus` `'Venda'` (`src/lib/contractsWrites.js:108-113`, `src/views/KanbanView.jsx:1591`). Ela conta como reabertura e matrícula no mesmo instante e precisa ficar separada da reabertura para uma etapa de lead.
  - Antes de 14/09/2026 às 18h10 não existe `fromStatus`, então o "desde 14/09/2026" vale só para o dado estruturado.
  - Os dias entre perda e volta saem do `createdAt` da interação de perda, porque o `lostAt` já foi apagado. Quando houve várias perdas, conta a última antes da reabertura.
  - O `leadConsultantId` do evento é reescrito pela migração em massa, então não serve como dono.
  - Matriculado depois quer dizer `clienteSince` do lead (carimbado uma vez, na primeira matrícula, `src/lib/contracts.js:133-139`) ou contrato com `createdAt` depois da reabertura, sem contar contrato importado.
  - O link público, quando o cadastro já existe, só grava um evento e não reabre o lead (`api/tenant-resolve.js:227-241`), então não entra aqui.
  - Evidências: `src/lib/stageMove.js:89-92` (sair de Perda zera `lossReason` e `lostAt`) e `src/lib/stageMove.js:67-78` (`matriculaStageChange` grava a troca da matrícula).

#### R024. Tempo até a perda por motivo

A academia perde o lead rápido ou depois de muito esforço?

- Para quem: gestor.
- Recortes: motivo e origem.
- Números: mediana de dias do cadastro à perda e interações até a perda.
- Filtros: período e origem.
- Formato: tabela por motivo.
- De onde vem: `stronix_leads.createdAt` (sem os marcados com `createdAtMissing`), `stronix_leads.lostAt` (última perda), `stronix_leads.lifecycleBucket` igual a `'perda'` e `stronix_leads.source` (de hoje). Para as interações, `stronix_interactions` por `leadId` com `createdAt` anterior ao `lostAt`, ou `stronix_leads.interactionsCount` marcado na tela como aproximado.
- Desde quando: 29/04/2026 para os dias. O `interactionsCount` só existe desde o backfill de 13/07/2026 (commits `9824a66` e `9cb22ac`, `scripts/backfill-scale-fields.js:214`).
- Viabilidade e prioridade: com ajuste, baixa. É curiosidade útil para treino, e o dado dos dias está pronto.
- Permissão e custo: gestor na tela; as regras liberam a leitura a todos. Custo baixo se usar o contador (consulta por `lostAt`). Médio se contar as interações até a perda pelo histórico por lead (`leadId in`, lotes de 30).
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - `interactionsCount` é o total de hoje, não o total até a perda. Ele inclui a própria interação de perda e qualquer anotação feita depois. E alguns caminhos gravam interação sem somar no contador: o desfecho e a promoção a Negociação pela Agenda do dia e os eventos da importação, gravados por `addDoc` direto. A observação do cadastro passa por `logInteraction` e soma (`src/modals/AddLeadModal.jsx:501-510`). Para contar até a perda é preciso ler o histórico do lead com `createdAt` anterior ao `lostAt`, ou declarar a medida como aproximada.
  - `lostAt` é a última perda, regravada a cada nova perda. Lead reaberto e perdido de novo mede do cadastro até a segunda perda, e lead reaberto que segue aberto não entra.
  - Lead sem `createdAt` ganha "agora" na normalização (`src/lib/leads.js:11-21`) e fica fora, como no `newLeadsOf` (`src/lib/crm/cohort.js:65-66`). Perdas legadas sem `lostAt` também ficam fora.
  - A origem é a de hoje, porque a renomeação faz cascata só nos leads.
  - Evidências: `src/lib/interactions.js:44-52` (`increment(1)` só no `logInteraction`) e `src/lib/appointmentOutcome.js:112-116` (`daily_goal_done` por `addDoc`, sem somar no contador).

#### R025. Perdas depois de comparecer

Quem veio à visita ou à aula e mesmo assim foi perdido, e por quê?

- Para quem: gestor.
- Recortes: motivo, tipo (aula ou visita), professor (só em aula) e dono (o de hoje).
- Números: perdas depois de comparecer e perdas sem agendar.
- Filtros: período e pessoa.
- Formato: tabela e lista nominal.
- De onde vem: `stronix_leads.lostAt`, `lossReason`, `lifecycleBucket` igual a `'perda'` e `consultantId`. `stronix_aulas` por `leadId` em lotes de 30: `status`, `scheduledFor`, tipo pelo `isAulaRecord`, e `professorId` e `professorName`, que só existem em aula. Para visita, o espelho no lead (`stronix_leads.appointmentOutcome` e `appointmentScheduledFor`) e as `stronix_interactions` dos dias da visita, com a mesma inferência de `src/lib/crm/appointments.js`.
- Desde quando: setembro de 2026 para a base completa. As aulas têm registro desde a segunda quinzena de julho e as visitas desde 18/08/2026 (`src/lib/crm/scope.js:19-24`).
- Viabilidade e prioridade: com ajuste, média. Mostra a perda no fechamento, onde o esforço já foi feito.
- Permissão e custo: gestor na tela; as regras liberam leads, aulas e interações a todos os membros. A lista nominal leva nome, e a exportação segue a regra de dado pessoal. Custo médio: perdas por `lostAt`, registros de `stronix_aulas` pelo `leadId` dos perdidos em lotes de 30 e, para visita, as interações do dia marcado. A busca é por lead, e não pela janela de `scheduledFor` do mês, porque o comparecimento pode ser de meses antes da perda. Nenhum índice novo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `status` de `stronix_aulas` só é confiável para aula. O desfecho da visita não é gravado no registro, só no espelho do lead e na linha do tempo. Para visita vale a inferência do CRM (`effectiveStatus`), que lê o espelho e as interações do dia marcado e do seguinte. Cancelamento de visita registrado em outro dia não aparece.
  - Professor só existe no registro de aula (`src/lib/aulasWrites.js:18-19`). Visita não tem professor.
  - "Perdas sem agendar" (lead perdido sem registro em `stronix_aulas`) fica inflado para lead cadastrado antes de 18/08/2026, porque as visitas só têm registro desde essa data.
  - O desfecho da aula só chega ao registro quando a data dele bate com o compromisso atual do lead (`src/lib/aulasWrites.js:68-101`). Quando a remarcação falhou, o desfecho fica só no lead.
  - O dono é o de hoje (`consultantId`).
  - O custo subiu porque a busca é por lead, e a visita ainda pede as interações do dia dela.
  - Evidências: `src/lib/leads.js:228-233` (`outcomeAppliesToAula`: só aula propaga o desfecho) e `src/lib/crm/appointments.js:52-104` (`effectiveStatus` infere a visita pelo espelho e pela linha do tempo).

#### R026. Repescagem de leads perdidos

Quais leads perdidos há 30 a 180 dias, por motivos que passam com o tempo (preço, horário, viagem, "agora não"), nunca foram reabertos e podem ser procurados de novo, e com quem estão?

- Para quem: gestor e consultor.
- Recortes: motivo da perda, faixa de dias desde a perda (30, 60, 90, 180), etapa em que perdeu (desde 14/09/2026), origem, dono atual, funil e se compareceu a visita ou aula antes da perda.
- Números: leads na fila por motivo; lista nominal com nome, telefone, motivo, data da perda, último contato e etapa da perda; quantos já foram reabertos antes; matriculados depois de reabrir, da fila anterior (sem dado hoje, ver a conferência).
- Filtros: motivos que a academia marcou como recuperáveis, faixa de dias, dono, origem e funil.
- Formato: lista nominal com a contagem por motivo no topo e exportação em CSV ou planilha.
- De onde vem: `stronix_leads` (`lifecycleBucket` igual a `'perda'`, `lostAt`, `lossReason`, `consultantId`, `source`, `funnelId` e `lastInteractionAt`, este desde 13/07/2026). `stronix_loss_reasons`, que precisa de um campo novo de recuperável, ou a escolha dos motivos feita na própria tela. `stronix_interactions` por `leadId` em lotes de 30 (o texto "Lead perdido." e as trocas posteriores; `fromStatus` `'Perda'` desde 14/09/2026 às 18h10). `stronix_aulas` por `leadId` em lotes de 30 (comparecimento em aula; visita por inferência).
- Desde quando: `lostAt` desde 29/04/2026 para perdas feitas no app. Perdas antigas sem `lostAt` ficam fora, porque nunca houve backfill. Etapa da perda e reabertura estruturadas só desde 14/09/2026 às 18h10. Hoje a janela de 30 a 180 dias vai de 28/03 a 25/08/2026, toda anterior a essa data. Então etapa da perda e reabertura estruturada ficam vazias para a fila inteira até meados de outubro de 2026.
- Viabilidade e prioridade: com ajuste, alta. O catálogo tem fila de recuperação para cliente vencido e para ex-cliente, em outros domínios, e nenhuma para lead perdido, que é o maior estoque da base. Como sair de Perda apaga `lostAt` e `lossReason` (`src/lib/stageMove.js:89-92`), o resultado da repescagem só se mede pela interação com `fromStatus` `'Perda'`. A consulta por janela de `lostAt` já existe (`src/lib/crm/queries.js:18`).
- Permissão e custo: o gestor vê a academia e o consultor abre na própria carteira, com trava de tela, porque as regras liberam todos. Não existe registro de exportação: exportar telefone precisa de decisão e, se for para registrar, de dado novo. O CSV precisa neutralizar fórmula, como no `LeadsView` (`src/views/LeadsView.jsx:127-146`). Os nomes de motivo podem ir para o endereço, porque não são dado pessoal. Custo médio: consulta por `lostAt` na janela de 5 meses (campo único, ou o índice existente de `lifecycleBucket`, `funnelId` e `lostAt` DESC, que já filtra balde e funil no servidor), mais o histórico de interações e de aulas por lead em lotes de 30. Numa academia de 2 a 3 mil leads, pode passar de mil leituras por abertura.
- Já existe em: nada parecido hoje. A ajuda do app já manda guardar a perda com motivo para retomada (`src/lib/wiki.js:74`), mas não há tela que monte a fila. O que já foi reaberto é medido pelo R023.
- Conferência no código: ajustado. O que mudou:
  - Não está pronto. O filtro de motivo recuperável não existe: o catálogo `stronix_loss_reasons` guarda nome e observação, sem marca de recuperável. Ou vira campo novo no catálogo, gravado pelo gestor (as regras já deixam o admin escrever, `firestore.rules:151-154`), ou vira uma escolha de motivos feita na tela.
  - A janela inteira de hoje é anterior a 14/09/2026 às 18h10, então o "desde 14/09/2026" escrito para etapa e reabertura não ajuda nada agora.
  - "Nunca foram reabertos" e "já reabertos antes" só se descobrem pelo histórico por lead: sair da Perda apaga o `lostAt`, e o lead perdido de novo aparece com o `lostAt` da última perda. Desde 14/09 vale o `fromStatus` `'Perda'`; antes, a sequência de textos. Isso pede `leadId in` em lotes de 30, e não só a consulta por `lostAt`.
  - "Matriculados depois de reabrir, da fila anterior" não tem como ser medido: nada grava que o lead esteve na fila nem que a reabertura veio da repescagem. Precisa de dado novo (por exemplo, uma marca na interação de reabertura) ou vira "reabertos e matriculados entre perdidos do mesmo motivo".
  - "Compareceu a visita ou aula antes da perda" tem os limites do R025: visita sem desfecho no registro, visitas só desde 18/08/2026 e aulas desde julho. Quase toda a fila de hoje é anterior à base completa.
  - "Exportação com telefone fica registrada" não confere: não achei registro de exportação em `src/` nem em `api/`.
  - O custo de "algumas centenas de leituras" estava baixo. Cinco meses de perdas numa academia de 2 a 3 mil leads podem passar de mil leads, mais o histórico por lead.
  - A sobreposição citava ids do rascunho do catálogo, que saíram. Quem mede o que já foi reaberto é o R023, e não o R021.
  - Evidências: `src/views/settings/CatalogsSection.jsx:73-83` (motivo de perda só com `name` e `note`, sem campo de recuperável) e `src/lib/crm/scope.js:16-17` (`STAGE_TRACKING_SINCE` = 14/09/2026 às 18h10).


### 5.4 Agenda e professores

Este domínio responde quem foi agendado para visita ou aula experimental, quem apareceu e quem faltou, que professor e que consultor transformam aula em matrícula e quem está de passe livre agora. A base é o registro `stronix_aulas`: aula desde a segunda quinzena de julho de 2026, visita desde 18/08/2026, completo só a partir de setembro de 2026. O limite está na visita. Ela não guarda o próprio desfecho, a remarcação pela Meta Diária nem chega ao registro e a remarcação na ficha sobrescreve a data, então visita sai subcontada e a data original se perde. Professor é catálogo sem login, e o CRM não guarda check-in, catraca nem ocupação de turma.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R027 | Agenda do período pelo histórico real | Alta | Precisa gravar dado novo | Ajustado |
| R028 | Comparecimento de visitas e aulas | Alta | Com ajuste | Ajustado |
| R029 | Conversão por professor | Alta | Com ajuste | Ajustado |
| R030 | Dupla consultor e professor | Baixa | Com ajuste | Ajustado |
| R031 | Com professor ou treina sozinho | Baixa | Com ajuste | Ajustado |
| R032 | Aulas e procura por modalidade | Média | Com ajuste | Ajustado |
| R033 | Visitas por unidade e conversão pós-visita | Média | Com ajuste | Ajustado |
| R034 | Ocupação e falta por dia da semana e hora | Média | Com ajuste | Ajustado |
| R035 | Antecedência do agendamento e falta | Baixa | Precisa gravar dado novo | Ajustado |
| R036 | Remarcações | Média | Precisa gravar dado novo | Ajustado |
| R037 | Faltas, reincidência e remarcação em 72h | Média | Com ajuste | Ajustado |
| R038 | Cancelamentos de agendamento e motivo | Baixa | Precisa gravar dado novo | Ajustado |
| R039 | Velocidade até o primeiro agendamento | Média | Com ajuste | Ajustado |
| R040 | Tempo entre comparecer e matricular | Baixa | Com ajuste | Ajustado |
| R041 | Passe livre em andamento e expirando | Alta | Com ajuste | Ajustado |
| R042 | Escala do professor | Média | Com ajuste | Ajustado |
| R043 | Aulas combinadas e feitas no passe | Baixa | Precisa gravar dado novo | Ajustado |
| R044 | Aulas de upgrade de alunos | Baixa | Com ajuste | Ajustado |
| R045 | Quem confirma presença na Agenda do dia | Baixa | Com ajuste | Ajustado |
| R046 | Visitas antes de 18/08/2026 pela linha do tempo | Baixa | Com ajuste | Ajustado |
| R047 | Uso diário do passe e capacidade da turma | Baixa | Fora do escopo | Inviável |
| R048 | Confirmação na véspera e comparecimento | Baixa | Precisa gravar dado novo | Ajustado |

#### R027. Agenda do período pelo histórico real

Quem teve aula ou visita no período, com quem, em que unidade e o que aconteceu, inclusive as substituídas e remarcadas?

- Para quem: gestor e consultor. O pedido incluía o professor, mas professor é catálogo e não tem login.
- Recortes: data e hora, tipo, dono, quem agendou, professor, modalidade, unidade e desfecho.
- Números: agendados, compareceram, faltaram, cancelados, sem desfecho e convertidos.
- Filtros: período, tipo, pessoa, professor, modalidade, unidade e desfecho.
- Formato: tabela nominal exportável em CSV e PDF.
- De onde vem: `stronix_aulas.scheduledFor`; `stronix_aulas.type`, separado por `isAulaRecord` no navegador e nunca por filtro na consulta; `stronix_aulas.status` na aula; na visita, `effectiveStatus` com `stronix_interactions.appointmentOutcome` de `visita_hoje` e o espelho do lead; `stronix_aulas.professorId`, `professorName`, `soloTraining` e `modality` (só aula); `stronix_aulas.unit` (só visita); `stronix_aulas.consultantId` e `consultantName` (dono na criação) e `stronix_leads.consultantId` (dono hoje); `stronix_aulas.converted` (só aula); `stronix_interactions.actorAuthUid` da nota com `volumeKind` visita ou aula_experimental, para saber quem agendou, com casamento aproximado.
- Desde quando: aula completa desde a segunda quinzena de julho de 2026, visita desde 18/08/2026.
- Viabilidade e prioridade: precisa gravar dado novo. Prioridade alta, porque troca a fonte do export (hoje um compromisso por lead) por `stronix_aulas`, e a visita ainda não tem desfecho no registro.
- Permissão e custo: gestor e consultor. A trava é só de tela, porque as regras do Firestore deixam qualquer membro ler. Custo baixo: `stronix_aulas` por intervalo de `scheduledFor`, campo único, sem índice. Qualquer filtro a mais na consulta (tipo, professor) pede índice composto, então esses filtros ficam no navegador.
- Já existe em: Leads → Aulas/Visitas → Exportar, que lê o espelho do lead.
- Conferência no código: ajustado. O que muda:
  - Remarcada não existe no registro. Remarcar um compromisso em aberto reescreve o `scheduledFor` do mesmo documento, e a data original se perde. Só a falta seguida de nova tentativa cria documento novo.
  - A remarcação de visita pela Meta Diária não grava nada em `stronix_aulas`. O `handleReschedule` só chama `upsertScheduledAula` quando é aula, então a visita nova fica sem registro e a antiga fica "agendada" para sempre. Isso vale também depois de 18/08/2026.
  - Visita reaproveita o registro. A ficha procura a visita "agendada" do lead e troca a data. Como o desfecho da visita nunca vai para o registro, uma visita em que a pessoa faltou é sobrescrita pela visita nova, e a falta some da coleção.
  - O desfecho da visita mora só no espelho do lead e na linha do tempo (`daily_goal_done` de `visita_hoje`). O relatório precisa repetir o `effectiveStatus` do CRM, que perde o cancelamento registrado em outro dia.
  - "Adiar" na Meta e a troca de aula para visita apagam o compromisso do lead e deixam o registro "agendada" sem desfecho. Isso infla o "sem desfecho" com agendamentos abandonados.
  - `stronix_aulas.consultantId` não é quem agendou. É o dono do lead quando o registro nasceu (ou no dia da carga retroativa), e nunca muda, porque a regra do Firestore trava `consultantAuthUid`. Quem agendou só sai do `actorAuthUid` da nota de agendamento (desde 13/07/2026), que não tem ligação com o registro: o casamento é pelo `leadId` e pelo horário.
  - Aula não tem `unit`, visita não tem professor nem modalidade, e `converted` só existe em aula.
  - O público "professor" não se aplica, porque professor não tem login.
  - Permissão e filtro por papel são só de tela.
  - Evidências: `src/lib/aulasWrites.js:25-31` (a gravação atualiza o registro em aberto), `src/views/DailyGoalView.jsx:1463-1480` (remarcar na Meta só escreve aula).

#### R028. Comparecimento de visitas e aulas

Quantos agendados aparecem e quantos faltam, por tipo, consultor, origem, funil, modalidade e unidade?

- Para quem: dono, gestor e consultor.
- Recortes: mês ou semana, tipo, dono, quem agendou, origem, funil, modalidade e unidade.
- Números: agendados, vieram, faltaram, pendentes e comparecimento em %.
- Filtros: período, pessoa, funil e tipo.
- Formato: número com comparativo, mais tabela.
- De onde vem: `stronix_aulas.scheduledFor`; `stronix_aulas.type`; `stronix_aulas.status` (aula); `stronix_interactions.appointmentOutcome` com `dailyGoalCategory` `visita_hoje` (visita, pelo `effectiveStatus`); `stronix_leads.appointmentOutcome` e `appointmentScheduledFor` (espelho); `stronix_aulas.consultantId` (dono na criação) ou `stronix_leads.consultantId` (dono hoje); `stronix_interactions.actorAuthUid` (quem agendou); `stronix_leads.source` e `funnelId` (valor atual); `stronix_aulas.modality` (aula); `stronix_aulas.unit` (visita).
- Desde quando: completo desde setembro de 2026, com a ressalva da conferência para visita.
- Viabilidade e prioridade: com ajuste. Prioridade alta: o painel já existe por mês, pessoa e funil, mas `stronix_aulas.consultantId` e `unit` nunca são lidos e a visita sai por inferência.
- Permissão e custo: todos os papéis. Custo baixo em `stronix_aulas`. Origem e funil pedem ler os leads por id, em lotes de 30, com a mesma memória de sessão do CRM.
- Já existe em: Visão geral → CRM, blocos Agendamentos e Comparecimento.
- Conferência no código: ajustado. O que muda:
  - O CRM já mostra agendamentos e comparecimento por mês, pela pessoa (dono de hoje) e pelo funil (o de hoje). Não separa tipo, origem, modalidade nem unidade. Tipo e modalidade saem do registro. Origem exige ler o lead por id.
  - Quem agendou não é `stronix_aulas.consultantId`. Esse campo é o dono do lead quando o registro nasceu e nunca muda. Quem agendou vem do `actorAuthUid` da nota, desde 13/07/2026. O relatório precisa dizer qual das três atribuições usa: dono na criação, dono de hoje ou autor da nota.
  - "Completo desde setembro de 2026" não vale para visita. A remarcação de visita pela Meta não grava registro, e o registro de visita reaproveitado apaga a falta anterior. As visitas continuam subcontadas e a taxa sai distorcida.
  - Comparecimento é vieram ÷ (vieram + faltaram). O que ficou sem desfecho, inclusive o abandonado por "Adiar" ou por perda, fica fora da taxa e precisa aparecer à parte.
  - Origem é a `source` atual do lead e muda se alguém editar. Funil também é o de hoje.
  - Unidade só existe em visita e modalidade só em aula.
  - Agendamento marcado depois da primeira matrícula fica fora, como no CRM.
  - Evidências: `src/lib/crm/appointments.js:115-136` (`appointmentsOf` só devolve totais), `src/lib/crm/scope.js:19-24`.

#### R029. Conversão por professor

Quais professores transformam mais aula experimental em matrícula, por modalidade e período?

- Para quem: dono e gestor.
- Recortes: professor, modalidade e período.
- Números: aulas agendadas, realizadas, faltas, matrículas, conversão em % e dias entre a aula e a matrícula.
- Filtros: período, modalidade e professor.
- Formato: ranking sem medalha, sempre com a base ao lado.
- De onde vem: `stronix_aulas.professorId`, `professorName`, `soloTraining`, `status`, `scheduledFor`, `converted`, `convertedAt` e `modality`; `stronix_leads.clienteSince` e `convertedAt`, pelo `firstEnrolledAtOf`, para tirar aula de cliente e de retorno.
- Desde quando: segunda quinzena de julho de 2026.
- Viabilidade e prioridade: com ajuste. Prioridade alta: o `professorsOf` já aceita janela, falta tirar a aula de cliente (upgrade) e unificar as três definições.
- Permissão e custo: gestor e dono na tela. Hoje o CRM mostra o card para todos os papéis, e as regras deixam qualquer membro ler. Custo baixo.
- Já existe em: Visão geral → CRM, bloco Aulas por professor; e Configurações → Equipe & acessos, bloco Professores, com a regra antiga. O pedido chamava essa segunda tela de "Configurações → Professores".
- Conferência no código: ajustado. O que muda:
  - Não está pronto, porque o próprio relatório pede para tirar a aula de cliente e unificar as definições.
  - `markConvertingAula` roda em toda matrícula, inclusive no retorno de ex-cliente e no fechamento de Upgrade sem contrato vivo. Ela escolhe a última aula atendida, sem cortar pela data da primeira matrícula, e regrava `converted` e `convertedAt`. Assim o professor de uma aula de upgrade ou de uma aula antiga ganha a matrícula, e o `convertedAt` anda para frente, o que distorce os dias entre aula e matrícula. Isso contraria a regra do CRM de que retorno não é matrícula nova.
  - `professorsOf` conta por `scheduledFor` e não tira a aula marcada depois da primeira matrícula.
  - Há três definições diferentes. O card do CRM usa os registros. Equipe & acessos, bloco Professores, lê o espelho `appointmentProfessorId` dos leads em memória e conta como matrícula quem é cliente. A carteira usa o carimbo `lead.professorId`.
  - "Aulas agendadas" não aparece no card, que só conta realizadas e faltas. Sai do registro com status `agendada` ou `cancelled`.
  - A conversão de um mês fechado continua subindo depois, porque o `converted` é gravado na matrícula, semanas após a aula.
  - Evidências: `src/lib/aulasWrites.js:110-126` (`markConvertingAula`), `src/views/settings/TeamAccessSection.jsx:362-373` (bloco Professores).

#### R030. Dupla consultor e professor

Quais combinações de consultor e professor convertem melhor?

- Para quem: gestor.
- Recortes: consultor e professor.
- Números: aulas e conversão em %.
- Filtros: período.
- Formato: matriz.
- De onde vem: `stronix_aulas.professorId`; `stronix_aulas.consultantId` (dono na criação) ou `stronix_leads.consultantId` (dono hoje); `stronix_aulas.status`; `stronix_aulas.converted`; `stronix_leads.clienteSince`.
- Desde quando: 16/07/2026, quando `stronix_aulas` passa a existir. O professor é gravado desde 09/07/2026.
- Viabilidade e prioridade: com ajuste. Prioridade baixa, porque o volume por célula é pequeno.
- Permissão e custo: gestor, com trava de tela. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - `stronix_aulas.consultantId` é o dono do lead quando o registro nasceu. Nos registros da carga retroativa, é o dono no dia da carga. Não é quem agendou nem o dono de hoje. Depois de uma migração de carteira o registro continua com o dono antigo, porque a regra do Firestore impede trocar `consultantAuthUid` e a migração não mexe em `stronix_aulas`.
  - A conversão herda os defeitos do R029: retorno e upgrade dão crédito, e aula de cliente entra.
  - O volume por célula é pequeno. A tela precisa mostrar a base e não fazer ranking.
  - A data de início certa é 16/07/2026 (`stronix_aulas`), com professor gravado desde 09/07/2026.
  - Evidências: `src/lib/aulasWrites.js:33-43` (`consultantId` copiado do lead na criação), `src/views/settings/TransferLeadsTab.jsx:129-165` (a migração não toca `stronix_aulas`).

#### R031. Com professor ou treina sozinho

Aula com professor converte mais que treinar sozinho?

- Para quem: dono.
- Recortes: com professor ou sozinho, e modalidade.
- Números: realizadas e conversão em %.
- Filtros: período.
- Formato: comparativo de dois números.
- De onde vem: `stronix_aulas.soloTraining`, `professorId`, `status`, `converted`, `modality` e `scheduledFor`.
- Desde quando: 16/07/2026.
- Viabilidade e prioridade: com ajuste. Prioridade baixa, porque já aparece no CRM.
- Permissão e custo: gestor e dono, com trava de tela. Custo baixo.
- Já existe em: Visão geral → CRM, linha "Treina sozinho".
- Conferência no código: ajustado. O que muda:
  - "Treina sozinho" no CRM junta `soloTraining` com aula sem professor. A aula da carga retroativa ou marcada antes de 09/07/2026 não tem professor e cai ali, então a comparação sai contaminada. É preciso separar `professorId` nulo de `soloTraining` verdadeiro.
  - A modalidade não está pronta: `professorsOf` só conta as realizadas por modalidade, sem a conversão por modalidade.
  - Herda os problemas do R029: retorno e upgrade dão crédito, e aula de cliente entra.
  - Comparar os dois grupos não prova causa. Quem escolhe treinar sozinho tem outro perfil, e o texto da tela precisa dizer isso.
  - Evidências: `src/lib/crm/appointments.js:207-219`, `scripts/backfill-aulas.js:112-114` (aula da carga retroativa sem professor).

#### R032. Aulas e procura por modalidade

Qual modalidade tem mais procura e melhor conversão?

- Para quem: dono e gestor.
- Recortes: modalidade, mês e professor.
- Números: leads interessados, agendadas, realizadas, matrículas e conversão em %.
- Filtros: período.
- Formato: tabela, mais a evolução mensal.
- De onde vem: `stronix_aulas.modality`, `status`, `converted` e `scheduledFor`; `stronix_leads.modalidade` (estado atual, contado pela safra de `createdAt`); `stronix_leads.createdAt`.
- Desde quando: aula desde 16/07/2026. Interesse desde 30/06/2026 no cadastro manual e desde 10/08/2026 no link público.
- Viabilidade e prioridade: com ajuste. Prioridade média, porque a modalidade é gravada pelo nome e renomear divide a série.
- Permissão e custo: gestor e dono, com trava de tela. Custo baixo para aulas. O interesse pede os leads da safra, que o CRM já carrega por mês.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - "Leads interessados" usa `stronix_leads.modalidade`, que é estado atual, editável e opcional no cadastro (o `canSubmit` não exige). Chega nulo na importação e é opcional no link público. Só dá para contar pela safra de cadastro com o valor de hoje, nunca como evento do mês.
  - Renomear modalidade reescreve só o `appointmentModality` dos leads ativos em memória. Não reescreve `lead.modalidade` nem `stronix_aulas.modality`, então a série se parte nos dois lados.
  - Matrícula por modalidade herda os problemas do R029: retorno e upgrade.
  - "Desde junho de 2026" é impreciso. O campo de interesse entrou em produção em 30/06/2026, no cadastro novo (PR #126, merge `aafb25c`), e no link público em 10/08/2026 (PR #171, merge `28ad875`). As datas de 25/06 e 09/08 são dos commits, antes do merge.
  - Evidências: `src/modals/AddLeadModal.jsx:364` (modalidade opcional no cadastro), `src/views/settings/SchedulingSection.jsx:130-140` (renomear só atinge `appointmentModality`).

#### R033. Visitas por unidade e conversão pós-visita

Que unidade recebe mais visitas, quantos comparecem e quantos matriculam depois, em quanto tempo?

- Para quem: dono, gestor e consultor. A permissão pedida diz só gestor e dono (ver conferência).
- Recortes: unidade, mês e dono.
- Números: visitas, compareceram, não vieram, matrículas depois da visita e dias até matricular.
- Filtros: período, unidade e pessoa.
- Formato: tabela por unidade.
- De onde vem: `stronix_aulas.type`, `unit`, `scheduledFor` e `consultantId`; `stronix_interactions.appointmentOutcome` (`visita_hoje`); `stronix_leads.appointmentOutcome` e `appointmentScheduledFor`; `stronix_leads.clienteSince`; `stronix_leads.convertedAt`.
- Desde quando: 18/08/2026, completo desde setembro de 2026.
- Viabilidade e prioridade: com ajuste. Prioridade média: o desfecho da visita é inferido, e visita não tem `converted`, então a matrícula se atribui pela data.
- Permissão e custo: gestor e dono, com trava de tela. As regras do Firestore deixam todos lerem. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - Visitas continuam subcontadas mesmo desde setembro. A remarcação pela Meta não cria registro, e o reaproveitamento do registro na ficha apaga a falta anterior.
  - O desfecho é inferido pelo espelho do lead e pela linha do tempo. O cancelamento feito em outro dia não aparece.
  - `stronix_aulas.unit` guarda o nome da unidade. Renomear não atualiza o registro, só o `appointmentUnit` dos leads ativos. O passo de unidade pode ficar vazio quando a academia não tem unidade cadastrada.
  - "Matriculou depois da visita" precisa usar a primeira matrícula (`clienteSince`, ou `convertedAt` quando não houver). Retorno não conta, e visita marcada depois da primeira matrícula não é funil de lead.
  - "Dono" precisa dizer se é o dono na criação (`stronix_aulas.consultantId`) ou o de hoje.
  - O público inclui o consultor, mas a permissão diz gestor e dono. É incoerente, e de todo jeito a trava é só de tela.
  - Evidências: `src/views/DailyGoalView.jsx:1463-1480` (remarcação de visita sem registro), `src/lib/crm/appointments.js:91-104` (desfecho de visita inferido).

#### R034. Ocupação e falta por dia da semana e hora

Em que dias e horários há mais agendamentos e mais faltas?

- Para quem: dono e gestor.
- Recortes: dia da semana, faixa de hora, tipo, professor e unidade.
- Números: agendados, vieram, faltaram e comparecimento em %.
- Filtros: período e tipo.
- Formato: mapa de calor.
- De onde vem: `stronix_aulas.scheduledFor`; `stronix_aulas.type`; `stronix_aulas.status` na aula e `effectiveStatus` na visita; `stronix_aulas.professorId` (aula); `stronix_aulas.unit` (visita).
- Desde quando: aula desde a segunda quinzena de julho de 2026, visita desde 18/08/2026.
- Viabilidade e prioridade: com ajuste. Prioridade média: há viés dos horários sugeridos (09:00 e 18:00), e a hora precisa ser convertida para America/Sao_Paulo.
- Permissão e custo: gestor e dono, com trava de tela. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - Professor só existe em aula e unidade só em visita. O mapa por professor ou por unidade vale para um tipo só.
  - Visita subcontada: a remarcação pela Meta não gera registro e a falta é apagada no reaproveitamento. A falta de visita é inferida.
  - A hora do mapa é o `scheduledFor` final. Quando a remarcação atualiza o registro em aberto, a hora original some.
  - Viés dos horários sugeridos: o assistente de agendamento sugere 18:00 para hoje e 09:00 para os outros dias, e a Meta usa 9h como base. A hora precisa ser convertida para America/Sao_Paulo.
  - Evidências: `src/components/profile/ScheduleWizard.jsx:93-94` (horários sugeridos), `src/lib/aulasWrites.js:15-31` (remarcação move o registro em aberto).

#### R035. Antecedência do agendamento e falta

Com quantos dias de antecedência se marca, e marcar longe aumenta a falta?

- Para quem: gestor.
- Recortes: faixa de antecedência, tipo e consultor.
- Números: dias entre marcar e a data, e comparecimento em % por faixa.
- Filtros: período e tipo.
- Formato: barras por faixa.
- De onde vem: `stronix_aulas.createdAt`, `scheduledFor` e `status`; um campo novo com a hora de cada marcação, gravado quando o registro é criado ou atualizado (a gravar).
- Desde quando: aula desde 16/07/2026, visita desde 18/08/2026.
- Viabilidade e prioridade: precisa gravar dado novo. Prioridade baixa. O `createdAt` da carga retroativa não serve, e a correção proposta é usar o menor entre `createdAt` e `scheduledFor`.
- Permissão e custo: gestor, com trava de tela. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - O `createdAt` do registro é a primeira marcação. Remarcar um registro em aberto troca só o `scheduledFor` e deixa o `createdAt` antigo, então a antecedência de todo agendamento remarcado sai inflada. O menor entre `createdAt` e `scheduledFor` corrige a carga retroativa, mas não isso.
  - Visita reaproveitada guarda o `createdAt` de uma visita anterior. O próprio CRM registra isso em `src/lib/crm/appointments.js:110-114`.
  - Visita remarcada pela Meta não tem registro.
  - Para medir direito é preciso gravar a hora de cada marcação (por exemplo `bookedAt`) ou o par data anterior e data nova. Sem isso o relatório só vale para registros nunca remarcados, e hoje não dá para saber quais são.
  - Os registros da carga inicial e da carga retroativa têm `createdAt` do dia em que o script rodou.
  - Evidências: `src/lib/aulasWrites.js:28-31` (atualização sem `createdAt`), `src/lib/crm/appointments.js:16-25`.

#### R036. Remarcações

Quantos agendamentos são remarcados, quantas vezes, com que antecedência e quem remarca muito?

- Para quem: gestor.
- Recortes: tipo, consultor, lead e mês.
- Números: % remarcados, remarcações por agendamento e dias entre a data original e a nova.
- Filtros: período, pessoa e tipo.
- Formato: tabela, mais a lista dos mais remarcados.
- De onde vem: `stronix_interactions.rescheduledFor`; `stronix_interactions.volumeKind` (visita ou aula_experimental); `stronix_interactions.appointmentOutcome` (`rescheduled` só quando fecha a tarefa do dia); `stronix_interactions.createdAt`; `stronix_interactions.actorAuthUid`; `stronix_interactions.text`, só para separar ajuste do mesmo dia de nova tentativa depois de falta; um campo novo com a data anterior (a gravar).
- Desde quando: 14/05/2026, pela linha do tempo.
- Viabilidade e prioridade: precisa gravar dado novo. Prioridade média: o registro sobrescreve a data, e a remarcação pelo assistente da ficha vira agendamento novo.
- Permissão e custo: gestor, com trava de tela. Custo médio: interações da janela por `createdAt`, a mesma carga do Operacional.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - `rescheduledFor` também é gravado na remarcação de contato (mensagem e ligação), pelo `ContactOutcomeModal` e pelo "Escolher data" da Meta. É preciso filtrar `volumeKind` visita ou aula_experimental, campo que só existe desde 19/06/2026 (commit `8c13cdb`). Antes disso o tipo só aparece no texto. O `rescheduledFor` existe desde 14/05/2026 (commit `4e223da`).
  - Só a remarcação pela Meta (`handleReschedule`) grava `rescheduledFor`. Na ficha, remarcar gera uma nota de agendamento igual à de um agendamento novo, sem `rescheduledFor` e sem ligação com o registro, e some do relatório.
  - A data original não fica gravada em lugar nenhum. A interação só tem a data nova, e o registro de `stronix_aulas` é sobrescrito. "Dias entre a data original e a nova" exige gravar um campo novo, ou ler o texto, que é frágil.
  - O mesmo fluxo junta três coisas: ajuste de horário no mesmo dia ("Horário ajustado", sem `appointmentOutcome`), nova tentativa depois de falta (`after_no_show`) e remarcação de verdade. Só o texto e o `appointmentOutcome` `rescheduled` separam uma da outra.
  - "Quem remarca" usa `actorAuthUid` só desde 13/07/2026. Antes disso cai no dono do lead.
  - A interação de lead excluído some.
  - Evidências: `src/views/DailyGoalView.jsx:1436-1522` (remarcação pela Meta), `src/modals/ContactOutcomeModal.jsx:97-113` (`rescheduledFor` em contato).

#### R037. Faltas, reincidência e remarcação em 72h

Quem falta, quantas vezes, quantos remarcam em até 72h e quantos comparecem na segunda tentativa?

- Para quem: gestor e consultor.
- Recortes: lead, dono, tipo e número da tentativa.
- Números: faltas por lead, % que remarcou em 72h e % que compareceu na segunda tentativa.
- Filtros: período, pessoa e tipo.
- Formato: tabela nominal exportável.
- De onde vem: `stronix_aulas.leadId`, `status`, `scheduledFor`, `outcomeAt`, `createdAt` e `consultantId`; `stronix_interactions.rescheduledFor` com `volumeKind`, como apoio.
- Desde quando: aula desde 16/07/2026.
- Viabilidade e prioridade: com ajuste. Prioridade média: serve à regra 4 de atribuição de vendas (72h para remarcar), e a visita precisa gravar desfecho.
- Permissão e custo: gestor e consultor, com trava de tela. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - Para aula funciona pelos registros. A falta gera `no_show` com `outcomeAt`, e a nova tentativa cria outro documento, porque o antigo já não está `agendada`. As 72h contam do `scheduledFor` da falta até o `createdAt` do registro novo, porque o `outcomeAt` pode ser marcado dias depois.
  - Para visita não dá. O desfecho não é gravado no registro, a remarcação pela Meta não cria registro e a nova visita pela ficha sobrescreve o registro em que a pessoa faltou.
  - `stronix_interactions.text` não deve ser fonte. Para aula, use a sequência de registros. Se precisar da interação, use `rescheduledFor` e `volumeKind`.
  - Quando o registro está com data diferente do compromisso do lead, a trava descarta o desfecho e a falta fica só no lead. Isso abre buracos.
  - "Consultor vê só a própria carteira" é trava de tela, porque as regras liberam tudo. A lista nominal exportada precisa seguir a regra de não levar nome de pessoa no endereço nem no nome do arquivo.
  - Evidências: `src/lib/aulasWrites.js:52-56`, `src/lib/appointmentOutcome.js:106-110` (só desfecho de aula vai ao registro).

#### R038. Cancelamentos de agendamento e motivo

Quantos agendamentos são cancelados e por quê?

- Para quem: gestor.
- Recortes: tipo, consultor, mês e motivo.
- Números: cancelados e % sobre agendados.
- Filtros: período e tipo.
- Formato: número com comparativo.
- De onde vem: `stronix_aulas.status` (aula); `stronix_interactions.appointmentOutcome` com `dailyGoalCategory` `visita_hoje` (visita); motivo do cancelamento (novo, em lista fixa).
- Desde quando: contagem de aula desde 16/07/2026. Motivo a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo. Prioridade baixa: o motivo não existe, e a visita cancelada some do espelho.
- Permissão e custo: gestor, com trava de tela. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - O motivo do cancelamento não existe em lugar nenhum. É preciso gravar, com lista fixa como a de contratos, em `appointmentOutcome.js` e no `handleOutcome` da Meta.
  - O cancelamento de aula só chega ao registro quando feito pela Meta no dia (`aula_hoje`). "Adiar", a troca de aula para visita, a perda e a matrícula tiram o compromisso sem cancelar o registro, que fica `agendada`. A contagem de cancelados sai subestimada.
  - O cancelamento de visita só existe na linha do tempo (`daily_goal_done` de `visita_hoje` com `appointmentOutcome` `cancelled`), e o espelho apaga o compromisso. O CRM só acha o cancelamento feito no dia marcado ou no seguinte.
  - O percentual sobre agendados herda a subcontagem de visitas.
  - Evidências: `src/views/DailyGoalView.jsx:1170-1185` (adiar zera o compromisso sem fechar o registro), `src/lib/contracts.js:36-47` (molde de lista fixa).

#### R039. Velocidade até o primeiro agendamento

Quanto tempo leva do cadastro ao primeiro agendamento, por consultor e origem?

- Para quem: gestor e consultor.
- Recortes: dono, origem e mês de cadastro.
- Números: mediana de horas e % que agendou em 24h e em 72h.
- Filtros: período, pessoa e origem.
- Formato: mediana com comparativo.
- De onde vem: `stronix_leads.createdAt`; `stronix_leads.consultantId` (dono de hoje); `stronix_leads.source`; `stronix_leads.importedAt` e `isImportCreatedLead`, para excluir; `stronix_interactions.volumeKind` em visita ou aula_experimental mais `createdAt`, como fonte principal; `stronix_interactions.actorAuthUid` (quem agendou, desde 13/07/2026); `stronix_aulas.createdAt` e `scheduledFor` só como conferência, pelo `bookedAt`.
- Desde quando: 19/06/2026 pela linha do tempo (`volumeKind`). Pelo registro, aula desde a segunda quinzena de julho de 2026 e visita desde 18/08/2026, completo desde setembro de 2026.
- Viabilidade e prioridade: com ajuste. Prioridade média, porque é indicador do playbook (taxa de agendamento de freepass).
- Permissão e custo: gestor e consultor. As regras liberam leads e interações para qualquer membro. Custo médio: reaproveita as interações do mês e do mês seguinte que o CRM já carrega para o primeiro contato (`monthSources`), só com consulta de campo único.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - `stronix_aulas.createdAt` não é o instante do agendamento em todo registro. As cargas retroativas gravaram `createdAt` no dia em que rodaram, e a carga inicial não tem `createdAt`. O CRM já corrige isso com `bookedAt`, o menor entre `createdAt` e `scheduledFor`.
  - A remarcação pela Meta Diária só grava registro de aula. Visita remarcada, ou aula trocada por visita, não cria nem atualiza registro de visita. Então `stronix_aulas` sozinho não acha o primeiro agendamento.
  - `volumeKind` também vale `mensagem` e `ligacao`. Para contar agendamento de freepass, o filtro precisa ser visita ou aula_experimental. Senão uma mensagem agendada conta como agendamento.
  - O início pelo registro em 16/07/2026 só vale para aula. Visita tem registro desde 18/08/2026, e a base fica completa em setembro de 2026 (`APPTS_COMPLETE_MONTH`).
  - É preciso tirar o lead criado pela importação (`isImportCreatedLead`), como fazem a captação do CRM e a prospecção.
  - "Dono" é o dono de hoje (`consultantId`), e a transferência de carteira reescreve o passado. Se a pergunta for quem agendou, a resposta é o `actorAuthUid` da interação, que existe desde 13/07/2026.
  - O molde de mediana que já conta os sem contato, em `src/lib/crm/contact.js:45-63`, serve aqui.
  - Evidências: `src/lib/crm/appointments.js:15-25` (`bookedAt`), `src/views/DailyGoalView.jsx:1464-1480` (remarcação só chama `upsertScheduledAula`).

#### R040. Tempo entre comparecer e matricular

Depois da aula ou da visita, quanto tempo a pessoa leva para fechar?

- Para quem: dono e gestor.
- Recortes: tipo, professor e consultor.
- Números: mediana de dias e % que fechou no mesmo dia.
- Filtros: período.
- Formato: histograma.
- De onde vem: na aula, `stronix_aulas.scheduledFor`, `status`, `converted`, `convertedAt`, `professorId` e `type`; na visita, `stronix_aulas` mais `effectiveStatus` (espelho do lead e `daily_goal_done` de `visita_hoje`); `stronix_leads.clienteSince` e `convertedAt`, para a primeira matrícula (`firstEnrolledAtOf`); `stronix_leads.consultantId` (dono de hoje) ou `stronix_aulas.consultantId` (dono na hora do agendamento).
- Desde quando: aula desde a segunda quinzena de julho de 2026 (commit `c1504f5`, 16/07/2026). Visita desde 18/08/2026, completa desde setembro de 2026.
- Viabilidade e prioridade: com ajuste. Prioridade baixa: a conversão não tem janela, e uma aula antiga pode levar crédito de uma venda muito posterior.
- Permissão e custo: gestor e dono, com trava de tela. As regras deixam qualquer membro ler. Custo baixo: aulas por `scheduledFor` (campo único) e leads por `clienteSince` e `convertedAt`, que o CRM já consulta.
- Já existe em: nada parecido hoje. O CRM mostra dias até a matrícula contados do cadastro, que é outra pergunta.
- Conferência no código: ajustado. O que muda:
  - `stronix_aulas.convertedAt` só existe em aula. Visita nunca é marcada como convertida, e o desfecho da visita nem fica no registro (`applyOutcomeToAula` só vale para aula). Para o tipo visita, o comparecimento sai do `effectiveStatus` (espelho do lead ou linha do tempo) e a matrícula sai do `clienteSince` ou `convertedAt` do lead.
  - `markConvertingAula` roda em toda matrícula, inclusive no retorno de ex-cliente e no Upgrade fechado sem contrato vivo. Aí marca a última aula atendida, que pode ser de meses antes ou uma aula de upgrade. O relatório precisa limitar às aulas com `scheduledFor` antes da primeira matrícula (`firstEnrolledAtOf`).
  - O `convertedAt` da aula é o instante em que `markConvertingAula` rodou. Desfazer a venda apaga essa marca (`unmarkConvertedAula`), então venda desfeita sai do relatório.
  - "Consultor" é ambíguo. `stronix_aulas.consultantId` é o dono na hora do agendamento e não muda na transferência. O CRM usa o dono de hoje. O relatório tem que escolher um dos dois e dizer qual.
  - Parte disso já aparece no CRM: "dias até a matrícula" é contado do cadastro (`daysToEnrollOf`), com as mesmas faixas. O recorte novo começa no comparecimento e deve reaproveitar `DAYS_BUCKETS`.
  - Evidências: `src/lib/aulasWrites.js:110-126` (`markConvertingAula` sem limite de tempo), `src/lib/crm/cohort.js:18-27` (`firstEnrolledAtOf`).

#### R041. Passe livre em andamento e expirando

Quem está de passe livre, quem expira nesta semana e quem expirou sem matricular?

- Para quem: consultor e gestor.
- Recortes: dono, professor, modalidade e dias restantes.
- Números: passes ativos, que expiram em 3 dias, expirados sem matrícula e convertidos dentro do passe.
- Filtros: pessoa e professor.
- Formato: alerta, mais tabela nominal.
- De onde vem: `stronix_leads.trialClassesPlanned`; `stronix_leads.appointmentType` e `appointmentScheduledFor`; `stronix_leads.appointmentOutcome`; `stronix_leads.appointmentProfessorId`, `appointmentProfessorName` e `appointmentModality`; `stronix_leads.consultantId`; `stronix_leads.clienteSince`, `convertedAt` e `lifecycleBucket`.
- Desde quando: retrato de hoje. `trialClassesPlanned` existe desde 01/06/2026 (commit `0ff27c6`), mas só guarda o último compromisso de cada lead.
- Viabilidade e prioridade: com ajuste. Prioridade alta, porque é rotina diária. Atenção: `trialClassesPlanned` é validade em dias, não número de aulas.
- Permissão e custo: todos os papéis. Custo baixo: o índice composto `appointmentType` mais `appointmentScheduledFor` já está publicado, com janela de até 99 dias para trás.
- Já existe em: Leads → Aulas, aba Em andamento.
- Conferência no código: ajustado. O que muda:
  - `trialClassesPlanned` mora só no lead e é sobrescrito. Um agendamento novo reinicia o passe pela data nova, e visita grava nulo. "Expirados sem matrícula" é retrato de quem ainda tem aquela aula como último compromisso. Não dá para contar os expirados de um período.
  - Cancelar pela Meta apaga `appointmentScheduledFor` e `appointmentType`. Adiar para amanhã também apaga. Nos dois casos o passe some do relatório.
  - `isPassActive` não olha o desfecho. Aula com "não veio" continua com passe ativo, contando da data marcada. O relatório precisa separar por `appointmentOutcome`: no mínimo tirar o `no_show` e mostrar o "sem desfecho" à parte.
  - A primeira lista de campos estava incompleta. Faltavam `appointmentType`, `appointmentOutcome`, `appointmentProfessorId` e `appointmentProfessorName`, `appointmentModality`, `consultantId`, `lifecycleBucket` (para separar Perda) e `convertedAt`. A lista acima já inclui todos.
  - A aba Em andamento só conta aula marcada no mês corrente. Passe que começou no mês anterior e ainda vale fica fora dela. O relatório precisa de janela própria: hoje menos o maior pacote configurado (até 99 dias).
  - A matrícula não limpa o compromisso do lead, então "convertidos dentro do passe" (primeira matrícula entre a aula e o último dia do passe) é viável como retrato.
  - Evidências: `src/lib/freePass.js:16-31` (último dia é a data mais N menos 1, sem olhar desfecho), `src/views/AppointmentTrackingView.jsx:299-313` (Em andamento é o mês corrente mais `isPassActive`).

#### R042. Escala do professor

Quais aulas cada professor tem amanhã e na semana?

- Para quem: gestor. O pedido incluía o professor, que não tem login e recebe a escala impressa ou em PDF.
- Recortes: professor, dia, hora e modalidade.
- Números: aulas marcadas.
- Filtros: período curto e professor.
- Formato: calendário impresso.
- De onde vem: `stronix_aulas.professorId`, `professorName`, `scheduledFor`, `status`, `modality`, `soloTraining`, `leadName` e `type`; `stronix_leads.currentAulaId`, `appointmentScheduledFor` e `status`, para conferência; `stronix_professores` (catálogo, sem login).
- Desde quando: agenda futura. O registro de aula existe desde a segunda quinzena de julho de 2026.
- Viabilidade e prioridade: com ajuste. Prioridade média: é operação da recepção e o dado está pronto.
- Permissão e custo: gestor, com trava de tela. Professor não tem login, então a escala sai impressa ou em PDF pelo molde de `appointmentReport.js`. Custo baixo: uma consulta por intervalo de campo único por semana.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - `stronix_aulas` guarda registro fantasma. Trocar uma aula por visita, na remarcação da Meta ou no assistente da ficha, não cancela o registro da aula, que segue `agendada` na data velha. Lead que vai para Perda não cancela a aula. Lead excluído deixa a aula órfã até alguém rodar o script de limpeza, porque as regras do Firestore proíbem apagar.
  - A gravação no registro é tentada à parte: se falhar, a aula existe no lead e não no registro. A escala precisa conferir com o espelho do lead (`currentAulaId`, `appointmentScheduledFor`) e tirar lead inexistente ou em Perda.
  - Filtrar `status == 'agendada'` e `isAulaRecord` no navegador. Nunca filtrar por `type` na consulta.
  - O "desde quando" não pesa numa escala futura. É relatório de agenda, não de período.
  - Evidências: `src/views/DailyGoalView.jsx:1464-1497` (troca para visita não mexe no registro de aula e mantém `currentAulaId`), `scripts/cleanup-orphan-aulas.js:3-8`.

#### R043. Aulas combinadas e feitas no passe

Quem combinou várias aulas experimentais compareceu a quantas, e pacote maior converte mais?

- Para quem: gestor e dono.
- Recortes: tamanho do pacote, modalidade e professor.
- Números: previstas, feitas e conversão em %.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_aulas.trialClassesPlanned` (novo, gravado em `aulaRecordFields` e na gravação do registro em aberto); `stronix_aulas.status`, `scheduledFor` e `converted`; `stronix_leads.clienteSince` e `convertedAt`; como histórico parcial, o texto da interação do assistente de agendamento ("N aulas").
- Desde quando: a partir da gravação. Aproximação pelo texto do assistente desde 01/06/2026.
- Viabilidade e prioridade: precisa gravar dado novo. Prioridade baixa: o pacote vive só no lead e é sobrescrito.
- Permissão e custo: gestor. Custo baixo.
- Já existe em: Configurações → Agendamento, fatia de cada pacote.
- Conferência no código: ajustado. O que muda:
  - A pergunta "compareceu a quantas das aulas combinadas" vai contra a regra de negócio. `trialClassesPlanned` é validade do passe em dias, não quantidade de aulas. O CRM também não registra o uso dia a dia do passe: um agendamento vira um registro só, com um desfecho só. "Previstas" e "feitas" não dá para medir.
  - O que dá para fazer é "passe mais longo converte mais?", cruzando a duração do passe com a matrícula. Para isso `trialClassesPlanned` precisa entrar no registro da aula (`aulaRecordFields`), porque no lead ele é sobrescrito.
  - Há um rastro parcial. O texto da interação do assistente grava "N aulas" desde 01/06/2026, e dá para extrair. A remarcação da Meta não grava o número no texto.
  - A tela chama o número de "aulas" e "pacote de aulas", o que contradiz `freePass.js`. Vale alinhar o rótulo antes de expor o relatório.
  - Evidências: `src/lib/freePass.js:1-6` (validade em dias), `src/lib/schedulePatch.js:59` (só no lead, sobrescrito).

#### R044. Aulas de upgrade de alunos

Aulas feitas por quem já é cliente viram venda adicional?

- Para quem: dono e gestor.
- Recortes: professor, modalidade e mês.
- Números: aulas de cliente, compareceram e upgrades fechados.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_aulas.scheduledFor`, `status`, `professorId`, `modality` e `leadId` (aula); `stronix_leads.clienteSince` e `convertedAt` (`firstEnrolledAtOf`); `stronix_contratos.closedFromUpgrade`, `leadId`, `createdAt` e `isImportedContract`; `stronix_contratos.renewedFromId`, para separar no mix.
- Desde quando: aulas de cliente com desfecho desde 30/07/2026. Upgrades fechados desde 11/09/2026.
- Viabilidade e prioridade: com ajuste. Prioridade baixa. A justificativa original era "`markConvertingAula` não marca upgrade", e a conferência mostrou que ela está errada.
- Permissão e custo: gestor e dono, com trava de tela. Custo baixo: aulas por `scheduledFor`, e os contratos já chegam na assinatura do login.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - A justificativa está errada. `markConvertingAula` roda no Upgrade fechado sem contrato vivo, porque o modal abre em modo matrícula, e aí marca a última aula atendida, que costuma ser a de upgrade. Com contrato vivo o modo é renovação e nada é marcado. O relatório não pode usar `aula.converted` para medir upgrade.
  - "Aulas de cliente" são os registros de aula com `scheduledFor` a partir da primeira matrícula (`firstEnrolledAtOf`), o mesmo corte que o CRM usa para tirá-las do funil de lead.
  - "Upgrades fechados" saem de contratos com `closedFromUpgrade`, criados depois da aula e do mesmo `leadId`. O campo existe desde o funil Upgrade (código de 08/09/2026, em produção em 11/09/2026) e só vale se o lead estava no funil (`upgradeStageId`). Upgrade fechado pela ficha fora do funil não é marcado.
  - A presença em aula de cliente só é registrável pela Agenda do dia, em produção desde 30/07/2026, porque a Meta não mostra compromisso de cliente. O comparecimento é confiável a partir daí.
  - Pela ordem de tipo, o upgrade fechado com contrato vivo entra como renovação no mix do Gerencial.
  - Evidências: `src/views/KanbanView.jsx:1578-1582` (Upgrade sem contrato vivo vira matrícula), `src/lib/contracts.js:174` (`closedFromUpgrade` vem de `lead.upgradeStageId`).

#### R045. Quem confirma presença na Agenda do dia

Quem da equipe confirma presenças, inclusive nos leads de colegas?

- Para quem: gestor.
- Recortes: quem confirmou, dono do lead e dia.
- Números: confirmações e % em leads de outra pessoa.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_interactions` do tipo `daily_goal_done` com `appointmentOutcome`, com `actorAuthUid` quando veio da Meta e `consultantName` mais o texto terminado em "Agenda do dia" quando veio da Agenda; `stronix_interactions.leadConsultantId` (dono gravado); `stronix_interactions.actorAuthUid` em `writeAppointmentOutcome` (novo, para ficar exato).
- Desde quando: aproximado desde 13/07/2026 (Meta) e 30/07/2026 (Agenda do dia). Exato a partir da gravação do `actorAuthUid`.
- Viabilidade e prioridade: com ajuste. Prioridade baixa: `writeAppointmentOutcome` não grava `actorId`, e `appointmentOutcomeBy` é sobrescrito.
- Permissão e custo: gestor, com trava de tela. Custo baixo a médio: interações do período por `createdAt`, com o filtro de tipo no navegador.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - Não é só dado novo, porque já existe rastro. Pela Meta (`handleOutcome`), o `daily_goal_done` é gravado por `logInteraction`, com `actorId` e `actorAuthUid` de quem clicou. Pela Agenda do dia (`writeAppointmentOutcome`), o `daily_goal_done` leva `consultantName` com o nome de quem confirmou e o texto terminado em "Agenda do dia", mas não leva `actorId` nem `actorAuthUid`.
  - Lacunas: a segunda confirmação do mesmo lead no mesmo dia não grava interação (`writeGoalDone` falso), desfazer não deixa rastro, e o autor pela Agenda é só um nome em texto.
  - `appointmentOutcomeBy` no lead é estado, sobrescrito a cada compromisso novo. Não serve para período.
  - O dono do lead na interação é `leadConsultantId`, que a migração em massa reescreve. Para "% em leads de outra pessoa", compare com o dono gravado na interação, sabendo desse limite.
  - O ajuste para ficar exato é pequeno: gravar `actorId` e `actorAuthUid` no `addDoc` de `writeAppointmentOutcome`.
  - Evidências: `src/lib/appointmentOutcome.js:112-122` (interação sem `actorAuthUid`, `consultantName` de quem clicou), `src/views/DailyGoalView.jsx:1070-1086` (`writeGoalDone` e origem "Agenda do dia").

#### R046. Visitas antes de 18/08/2026 pela linha do tempo

Como eram visitas e comparecimento antes do registro em `stronix_aulas`?

- Para quem: dono.
- Recortes: mês e consultor.
- Números: visitas agendadas e desfechos.
- Filtros: período.
- Formato: evolução mensal.
- De onde vem: `stronix_interactions.volumeKind = 'visita'` mais `createdAt` (desde 19/06/2026); `stronix_interactions.text` com "Visita agendada" e o ícone de sino na frente (de 01/06/2026 a 18/06/2026); `stronix_interactions.rescheduledFor`; `stronix_interactions.dailyGoalCategory = visita_hoje` mais `appointmentOutcome`; `stronix_interactions.actorAuthUid` (desde 13/07/2026) ou `leadConsultantAuthUid`.
- Desde quando: desfecho desde 14/05/2026. Agendamento pelo texto desde 01/06/2026 e estruturado desde 19/06/2026. Parcial até agosto de 2026.
- Viabilidade e prioridade: com ajuste. Prioridade baixa: parte vem de leitura de texto e só serve para série histórica.
- Permissão e custo: dono, com trava de tela. Custo alto: todas as interações de maio a agosto por `createdAt`. Rodar sob demanda, com `getDocs` e memória de sessão.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que muda:
  - Não precisa extrair tudo do texto. Desde 19/06/2026 o agendamento de visita tem `volumeKind` `visita` na interação, e a remarcação grava `rescheduledFor`. O texto com "Visita agendada" só precisa ser lido entre 01/06/2026 e 18/06/2026.
  - O texto do assistente gravava a data sem ano até a correção. `parseAppointment` assume o ano corrente, o que serve para 2026.
  - O desfecho sai de `daily_goal_done` com `dailyGoalCategory` `visita_hoje` e `appointmentOutcome`, desde 14/05/2026, pela mesma função que o CRM já usa (`visitOutcomesByLead`).
  - Consultor: o autor (`actorAuthUid`) só existe desde 13/07/2026. Antes disso vale `leadConsultantAuthUid`, que a migração em massa reescreve. Excluir um lead apaga as interações dele, então a série pode cair.
  - O período de 18/08/2026 a 31/08/2026 também precisa sair marcado como parcial, porque a base só fica completa em setembro de 2026.
  - Não existe índice de tipo com `createdAt` nem de `volumeKind` com `createdAt`, então é preciso ler todas as interações do período. O custo alto está certo, e o caminho é rodar uma vez só e guardar em memória de sessão.
  - Evidências: `src/lib/crm/appointments.js:27-49` (`visitOutcomesByLead`), `src/lib/timeline.js:175-215` (`parseAppointment`, ano assumido).

#### R047. Uso diário do passe e capacidade da turma

O aluno usou os dias do passe, e a turma ou o horário está cheio?

- Para quem: gestor e dono.
- Recortes: dia do passe, professor e horário.
- Números: presenças, vagas e ocupadas.
- Filtros: nenhum definido.
- Formato: não se aplica.
- De onde vem: não existe.
- Desde quando: não se aplica.
- Viabilidade e prioridade: fora do escopo. Prioridade baixa: o CRM não guarda check-in, catraca nem grade do professor, e isso fica no Stronix Suite.
- Permissão e custo: não se aplica.
- Já existe em: nada parecido hoje.
- Conferência no código: inviável. O CRM não guarda check-in, catraca, grade de horário nem capacidade de turma. O registro da aula tem uma data, um professor e um desfecho, e nada sobre os dias seguintes do passe. Isso é do sistema de gestão da academia (Stronix Suite), e passar a gravar no CRM duplicaria a operação da recepção. O mais perto que o CRM chega é a validade do passe (R041) e a escala de aulas experimentais por professor (R042), e nenhum dos dois é ocupação de turma.
  - Evidências: `src/lib/aulas.js:92-121` (campos do registro); a busca por `capacit`, `capacity`, `checkin` e `catraca` em `src` e `api` só acha `isAuthChecking` em `src/App.jsx`, nada do domínio.

#### R048. Confirmação na véspera e comparecimento

O agendamento confirmado na véspera comparece mais? Quantos são confirmados, e por quem?

- Para quem: gestor e consultor.
- Recortes: tipo (visita ou aula), consultor, antecedência da confirmação e modalidade.
- Números: agendados, confirmados e comparecimento com e sem confirmação.
- Filtros: período e tipo.
- Formato: tabela com duas colunas de comparecimento, confirmado e não confirmado.
- De onde vem: `stronix_aulas.confirmedAt` e `confirmedBy` (novos, com `actorAuthUid`); `stronix_aulas.status`, `scheduledFor` e `type`; `effectiveStatus` para visita, até o desfecho ir para o registro.
- Desde quando: a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo. Prioridade baixa. Confirmar na véspera é a prática mais usada contra falta, e o relatório mostra se vale cobrar isso da equipe.
- Permissão e custo: todos os papéis. Custo baixo: aulas por `scheduledFor`, campo único.
- Já existe em: nada parecido hoje. No catálogo, o R028 e o R034 medem comparecimento e falta, sem saber se houve lembrete.
- Conferência no código: ajustado. O que muda:
  - Não há campo de confirmação na véspera, nem no registro da aula nem no lead. O relatório exportável só tem quatro desfechos.
  - A primeira versão citava como fonte `src/lib/appointmentReport.js`, que é código e não campo. As fontes certas são as novas a gravar: no registro (`stronix_aulas`), um evento com data e autor (`confirmedAt`, `confirmedBy`), e não no lead, onde seria sobrescrito.
  - Há um rastro fraco hoje. O consultor pode agendar uma "Mensagem" de confirmação no assistente, que vira `volumeKind` `mensagem` e depois `daily_goal_done` de `contato_hoje`. Mas nada liga essa mensagem ao compromisso, então não serve como medida.
  - O comparecimento de visita depende de inferência (`effectiveStatus`), porque o desfecho da visita não vai para o registro. Gravar o desfecho no registro da visita também melhora esta medida.
  - Evidências: `src/lib/appointmentReport.js:12-27` (só quatro desfechos), `src/lib/schedulePatch.js:39-48` (mensagem de confirmação é só próximo contato).


### 5.5 Vendas e contratos

Este domínio responde quanto a academia vendeu em valor de contrato, de que tipo, em que plano, com quanto desconto e por quem, e serve de insumo para o fechamento da Comissão. Todo número daqui é valor de contrato fechado, nunca dinheiro que entrou no caixa: o CRM não guarda pagamento, parcela nem forma de pagamento. O contrato só existe no sistema desde 30/06/2026 (PR #123). Valores digitados entre 16/07/2026 e 17/09/2026 podem ter o erro do ponto de milhar.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R049 | Vendas do período por tipo | Alta | Pronto | Ajustado |
| R050 | Ranking de vendedores | Alta | Com ajuste | Ajustado |
| R051 | Descontos concedidos | Alta | Com ajuste | Ajustado |
| R052 | Mix de planos, durações e modalidades | Média | Com ajuste | Ajustado |
| R053 | Preço praticado contra tabela | Baixa | Com ajuste | Ajustado |
| R054 | Vendas canceladas depois | Média | Pronto | Ajustado |
| R055 | Relatório de contratos | Alta | Com ajuste | Ajustado |
| R056 | Insumo do fechamento da Comissão | Alta | Com ajuste | Ajustado |
| R057 | Atribuição de venda pela regra de ouro | Média | Precisa gravar dado novo | Ajustado |
| R058 | Meta de vendas contra realizado | Média | Precisa gravar dado novo | Ajustado |
| R059 | Contratos agendados e carteira a entrar | Baixa | Com ajuste | Ajustado |
| R060 | Leads, vendas e carteira por unidade | Baixa | Precisa gravar dado novo | Ajustado |
| R061 | Auditoria de correções de contrato | Baixa | Precisa gravar dado novo | Ajustado |
| R062 | Recebimento, forma de pagamento e inadimplência da academia | Baixa | Fora do escopo | Inviável |
| R063 | Clientes pagando abaixo da tabela atual | Baixa | Com ajuste | Ajustado |
| R064 | Dia e hora das vendas | Baixa | Com ajuste | Ajustado |
| R065 | Valor estimado do aluno por canal | Baixa | Precisa gravar dado novo | Ajustado |

#### R049. Vendas do período por tipo

Quanto a academia vendeu em valor de contrato, em quantos contratos, e quanto disso foi matrícula nova, renovação, upgrade e retorno?

- Para quem: dono e gestor.
- Recortes: dia, semana, mês ou trimestre do fechamento (`createdAt`), tipo de venda, plano e consultor do contrato.
- Números: valor vendido, contratos, ticket mensal médio, participação de cada tipo e variação contra o período anterior. O total de upgrades sai de `closedFromUpgrade` num número à parte, que nunca entra na soma do total.
- Filtros: período, tipo, plano e pessoa.
- Formato: número com comparativo e evolução mensal.
- De onde vem: `stronix_contratos.createdAt` (com `startsAt` de reserva), `value`, `listValue`, `durationMonths`, `renewedFromId`, `closedFromUpgrade` (contado à parte, fora do mix exclusivo), `planId` e `planName`, `consultantId` e `consultantName`, `leadId` (chave da pessoa, para achar o retorno). As marcas `importBatchId`, `importSource` e `importedBy` servem para excluir o importado.
- Desde quando: valor e contagem desde 30/06/2026, com julho como primeiro mês inteiro. Upgrade só a partir de 11/09/2026. Valores digitados entre 16/07/2026 e 17/09/2026 podem ter o erro do ponto de milhar.
- Viabilidade e prioridade: pronto, prioridade alta. É o fechamento do mês e o `salesOf` já aceita janela livre; antes de confiar no número, esperar a correção dos planos da Shape One.
- Permissão e custo: todos. O Gerencial já abre para qualquer membro, e o contrato é legível por qualquer membro (`firestore.rules:236`). Custo zero, porque os contratos já chegam assinados no login (`src/App.jsx:794-802`).
- Já existe em: Visão geral → Gerencial, no Vendido no mês e no mix.
- Conferência no código: ajustado. Evidências: `src/lib/gerencial/scope.js:25-34` e `src/views/KanbanView.jsx:1577-1581`.
  - O tipo de venda é exclusivo e a renovação ganha do upgrade. O Upgrade fechado com contrato vivo abre o modal de contrato em modo renovação, grava `renewedFromId` e entra no mix como renovação. Então "upgrade" no mix só mostra o upgrade fechado sem contrato vivo. O total de upgrades tem que sair de `closedFromUpgrade` à parte, como já faz o `salesInWindow` (`src/lib/operacional/base.js:302`), e não pode ser somado ao total.
  - `closedFromUpgrade` só existe desde o PR #199 (merge `4c321d3`, 11/09/2026). Contrato anterior não tem o campo, e nenhum mês antes de setembro de 2026 tem upgrade.
  - A justificativa original pedia para esperar também os 494 contratos sem valor. Eles não pesam aqui: importado nunca entra na venda (`src/lib/gerencial/sales.js:10`). Pesam na carteira. O que distorce a venda é a Shape One, com preço mensal gravado no lugar do total.
  - De 16/07/2026 (`parseValorBRL`, commit `2497364`) a 17/09/2026 (PR #213, commit `33db5ee`), um "2.988" digitado era gravado como 2,988, no plano (`CatalogsSection`) e no desconto em modo valor final ou em reais (`src/lib/renewal.js:96`). Vendas e tabelas desse intervalo podem ter valor errado. Não há acerto da base em `scripts/`.
  - O retorno só enxerga contrato registrado no sistema (`scope.js:28-33`). Cliente antigo sem contrato no sistema que volta aparece como matrícula nova.
  - A correção de contrato reescreve `value`, `listValue`, plano e duração no próprio contrato (`src/lib/contracts.js:374-391`). O mês fechado muda depois de uma correção; só o cancelamento não mexe nele. E qualquer membro pode alterar `value` direto no banco, porque a regra só protege `consultantAuthUid` (`firestore.rules:238-241`).
  - O comparativo proporcional (`comparisonCut`, `src/lib/operacional/month.js:38-43`) só funciona para mês. Dia, semana e trimestre precisam de uma regra de corte própria. As contas servem, porque o `salesOf` aceita início e fim livres.
  - Histórico: PR #123 (merge `b2b0c9d`, 30/06/2026), PR #199 (merge `4c321d3`, 11/09/2026), PR #213 (merge `e96ccbe`, 17/09/2026). Todo contrato feito no app nasce no `commitMatricula` com `createdAt` do servidor (`src/lib/contractsWrites.js:95-96`), chamado pelo modal de contrato na ficha, no Pipeline e na Meta Diária.

#### R050. Ranking de vendedores

Quem vende mais, a que ticket, com quanto desconto, em plano de quantos meses e quanto disso é renovação?

- Para quem: dono, gestor e consultor.
- Recortes: consultor do contrato, mês e tipo de venda.
- Números: valor vendido, vendas, ticket mensal, participação, desconto médio, renovações e duração média.
- Filtros: período e tipo.
- Formato: ranking sem medalha.
- De onde vem: `stronix_contratos.consultantId` e `consultantName`, `value`, `listValue`, `durationMonths`, `renewedFromId`, `closedFromUpgrade` e `createdAt`, com `importBatchId`, `importSource` e `importedBy` para excluir o importado.
- Desde quando: valor, vendas, ticket e renovações desde 30/06/2026. Motivo do desconto desde 28/07/2026. Quem registrou a venda (`actorId` na interação do contrato) desde 13/07/2026.
- Viabilidade e prioridade: com ajuste, prioridade alta. O `sellersOf` está pronto, desconto e renovação por pessoa são acréscimo, e o crédito é do dono do lead na hora da venda.
- Permissão e custo: todos hoje, porque o Gerencial é aberto e o contrato é legível por qualquer membro. Esconder o valor do colega seria só trava de tela. Custo zero.
- Já existe em: Visão geral → Gerencial, no "Quem vendeu" (`src/views/dashboard/SellerRankTable.jsx:46`). No Operacional, nas colunas de matrículas e upgrades por vendedor (`src/views/dashboard/TeamMonthTable.jsx:133-134`).
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:175-181` e `src/lib/gerencial/people.js:34-53`.
  - O crédito é `consultantId`, o dono do lead na hora da venda, e não quem clicou. O relatório precisa dizer isso. É diferente do CRM, que usa o dono de hoje, e da regra de ouro do playbook, que dá a venda a quem agendou o passe. Quem registrou só aparece no `actorId` da interação `status_change`, gravado desde 13/07/2026 (PR #137, merge `cb7615a`, então no `MatriculaModal`; hoje em `src/lib/contractsWrites.js:124-134`).
  - O nome vem de `consultantName`, congelado na venda (`people.js:37-38`). Pessoa renomeada continua com o nome antigo. Por outro lado, o ex-funcionário continua com nome próprio e não cai em "Outros".
  - Desconto médio por pessoa é `listValue - value`, limitado a zero por contrato, porque no modo valor final o preço pode passar da tabela (`src/lib/renewal.js:98-106`). Contrato com `listValue` 0 (plano sem preço) fica fora. O desconto é creditado ao dono do lead, não a quem deu o desconto.
  - Duração média é uma medida à parte. O plano do Gerencial só proíbe usá-la no lugar do ticket mensal (`docs/superpowers/plans/2026-09-17-dashboard-gerencial-tela.md:22`). O ticket mensal continua sendo a média de `value ÷ durationMonths` por venda.
  - Renovações por pessoa contam para o dono do lead no momento da renovação. Isso não bate com a carteira de renovação do Operacional, que usa o dono atual (`src/lib/operacional/renewal.js:13-15`).
  - No Operacional, a coluna "Entraram" conta só o primeiro contrato da pessoa (`src/lib/operacional/base.js:301-307`), não todas as vendas. As contagens do Operacional e do Gerencial diferem por construção.
  - O gestor pode reescrever `consultantId` e `consultantAuthUid` (`firestore.rules:238-241`), e o `scripts/fix-consultant-ownership.js --contracts` já saneou esses campos (linhas 28-29). O histórico é estável, mas pode ser corrigido.
  - A decisão 1 do spec do Gerencial é que todos veem tudo (`docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:22`).

#### R051. Descontos concedidos

Quanto a academia abre mão em desconto, por qual motivo, em que plano e por quem?

- Para quem: dono e gestor.
- Recortes: mês, motivo, modo do desconto (nenhum, percentual, em reais ou valor final digitado), consultor, plano e tipo de venda.
- Números: desconto total (`listValue - value`, limitado a zero contrato por contrato), percentual sobre a tabela, contratos com desconto e desconto médio.
- Filtros: período, pessoa, plano e motivo.
- Formato: número com comparativo, mais uma tabela por motivo e outra por pessoa.
- De onde vem: `stronix_contratos.listValue`, `value`, `discountReason`, `discountMode` (`nenhum`, `percent`, `reais`, `final`), `consultantId` (dono do lead, não quem deu o desconto), `planId`, `renewedFromId` e `closedFromUpgrade`. Quem registrou vem de `stronix_interactions.actorId`, casado por `leadId` e horário, desde 13/07/2026.
- Desde quando: a diferença para a tabela desde 30/06/2026. Motivo e modo desde 28/07/2026. Valores entre 16/07/2026 e 17/09/2026 sujeitos ao erro do ponto de milhar.
- Viabilidade e prioridade: com ajuste, prioridade alta. O playbook proíbe desconto espontâneo, e a conta usa `listValue - value` porque a correção não atualiza `discountValue`.
- Permissão e custo: gestor e dono, como trava de tela, porque qualquer membro lê os contratos. Custo zero nos contratos. Cruzar com a interação para saber quem registrou é barato (consulta por `leadId`).
- Já existe em: Visão geral → Gerencial, no Desconto (só o total).
- Conferência no código: ajustado. Evidências: `src/modals/ContractModal.jsx:196-202` e `src/lib/contracts.js:383-390`.
  - A justificativa original dizia que os campos eram gravados e nunca lidos. Não é verdade: a ficha lê `discountValue` e `discountReason` (`src/views/LeadProfileView.jsx:1702-1707`), e o Gerencial mostra o total (`src/lib/gerencial/sales.js:18-19`, `SoldHeroCard.jsx:76`).
  - O modo tem quatro valores, e não dois: nenhum, percent, reais e final (`src/lib/renewal.js:82-87`). No modo final o preço pode ficar acima da tabela e o `discountValue` vira 0. Por isso `listValue - value` precisa ser limitado a zero contrato por contrato.
  - "Por quem": o contrato traz o dono do lead, não quem concedeu o desconto (`contracts.js:175-181`). Quem clicou fica no `actorId` da interação desde 13/07/2026, e ela não aponta o id do contrato. O casamento é por `leadId` e horário.
  - A correção reescreve `value` e `listValue` (com o preço do plano no dia da correção) e deixa `discountValue`, `discountMode` e `discountReason` como estavam. Depois de uma correção, pode sobrar motivo sem desconto ou desconto sem motivo.
  - Antes de 28/07/2026 não há motivo nem modo. Esses contratos aparecem como "sem motivo", e não como "Outro".
  - Contrato com `listValue` 0 (plano sem preço) não permite medir desconto. Os planos da Shape One (preço mensal no lugar do total) e o erro do ponto de milhar entre 16/07/2026 e 17/09/2026 distorcem a diferença para a tabela.
  - O motivo é obrigatório quando há desconto (`ContractModal.jsx:185`) e sai de uma lista fixa (`src/lib/renewal.js:89`). O `contractExtra` é gravado no contrato em `src/lib/contractsWrites.js:96`; o comentário das linhas 62-63, que fala só da renovação, está desatualizado. `discountReason` e `discountMode` nasceram no commit `c2685a2` (PR #162, merge `ba774dc`, 28/07/2026), e `listValue` existe desde `89df3e9` (PR #123, 30/06/2026).

#### R052. Mix de planos, durações e modalidades

Quais planos, durações e modalidades mais vendem, a que ticket, e quanto cada modalidade vale na carteira?

- Para quem: dono e gestor.
- Recortes: plano, duração, modalidade ou combinação de modalidades, mês e tipo de venda.
- Números: contratos, valor vendido, ticket mensal, participação no total e valor por mês na carteira.
- Filtros: período e tipo.
- Formato: ranking e tabela.
- De onde vem: `stronix_contratos.planId` e `planName`, `durationMonths`, `value`, `createdAt`, `renewedFromId` e `closedFromUpgrade`. Do catálogo, no estado de hoje: `stronix_planos.modalityIds` (e o legado `modalityId`) e `stronix_modalities.name`.
- Desde quando: plano, duração e valor desde 30/06/2026. A modalidade é sempre a do plano de hoje (`modalityIds` desde 16/07/2026, antes o `modalityId` legado).
- Viabilidade e prioridade: com ajuste, prioridade média. A modalidade vem do plano de hoje, e o ideal é congelá-la no contrato.
- Permissão e custo: gestor e dono. Custo zero, porque planos e contratos já chegam assinados no login.
- Já existe em: Visão geral → Gerencial, em "Planos mais vendidos" (`src/views/dashboard/GerencialDashboard.jsx:109`).
- Conferência no código: ajustado. Evidências: `src/lib/planos.js:1-16` e `src/views/settings/CatalogsSection.jsx:225-236`.
  - O contrato não guarda a modalidade. Ela vem do plano de hoje (`src/lib/planos.js:7-10`), e o plano pode ser editado sem histórico. O recorte por modalidade retrata o catálogo atual, não o que foi vendido.
  - Plano com várias modalidades: somar o dinheiro por modalidade conta duas vezes. É preciso agrupar pela combinação ou definir uma regra de rateio.
  - Plano antigo usa o campo legado `modalityId`, que a leitura já cobre. Contrato importado pode vir sem `planId`, só com `planName` (`src/lib/clientImport.js:505-506`), e fica sem modalidade. Como importado não entra na venda, isso só afeta o recorte da carteira.
  - Valor por mês na carteira por plano ou modalidade é acréscimo: o `walletAt` devolve só o total (`src/lib/gerencial/wallet.js:7-27`). É preciso agrupar os contratos de `contractStateAt`, deixando fora os sem valor.
  - A duração é a gravada no contrato (`durationMonths`), mas a correção pode trocá-la (`src/lib/contracts.js:376`).
  - O ranking de hoje agrupa por `planId`, com o nome de reserva (`src/lib/gerencial/people.js:58-65`). Plano com contrato não é excluído, só desativado (`CatalogsSection.jsx:183-191`). `modalityIds` entrou no commit `2497364` (PR #149, merge `68c57fd`, 16/07/2026).

#### R053. Preço praticado contra tabela

O preço de tabela de cada plano mudou, e quanto se cobra de fato em relação a ela, mês a mês?

- Para quem: dono.
- Recortes: plano e mês da venda.
- Números: `listValue` médio, `value` médio, ticket mensal e percentual de desconto.
- Filtros: período e plano.
- Formato: evolução mensal.
- De onde vem: `stronix_contratos.listValue`, `value`, `durationMonths`, `planId`, `createdAt` e `updatedAt` (indício de correção ou de desfecho posterior).
- Desde quando: 30/06/2026. Contratos corrigidos vêm marcados à parte (`listValue` reescrito), e valores de 16/07/2026 a 17/09/2026 ficam sob suspeita.
- Viabilidade e prioridade: com ajuste, prioridade baixa. O plano não tem histórico, e o `listValue` do contrato é a única memória do preço.
- Permissão e custo: dono. Custo zero.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:154-163` e `src/lib/contracts.js:383-390`.
  - O `listValue` guarda o preço de tabela do dia da venda, mas a correção de contrato o reescreve com o preço do plano no dia da correção (`contracts.js:387`). Contrato corrigido perde o preço de tabela original.
  - Plano sem preço grava `listValue` 0 (`contracts.js:155`). Esse contrato sai da média.
  - Os planos da Shape One guardam o preço mensal no lugar do total. E preço digitado no catálogo com ponto de milhar entre 16/07/2026 e 17/09/2026 pode ter virado decimal, porque o `CatalogsSection` usa o `parseValorBRL` (corrigido em `src/lib/format.js` no commit `33db5ee`, PR #213). A série de `listValue` herda os dois erros.
  - O percentual de desconto limita `listValue - value` a zero, por causa do modo valor final.
  - Importado não entra: o `listValue` dele é o preço do plano no dia da importação (`src/lib/clientImport.js:502`).
  - O plano não guarda histórico de preço, só `updatedAt` (`src/views/settings/CatalogsSection.jsx:225-236`).

#### R054. Vendas canceladas depois

Quanto do que foi vendido em cada mês já foi cancelado, de quem, por qual motivo e depois de quantos dias?

- Para quem: dono e gestor.
- Recortes: mês da venda, consultor, motivo e plano.
- Números: vendas canceladas, valor e dias até cancelar.
- Filtros: período e pessoa.
- Formato: tabela.
- De onde vem: `stronix_contratos.createdAt`, `cancelledAt` (data efetiva, não a do registro), `cancelReason`, `cancelNote`, `value`, `consultantId` e `planId`. A data do registro vem de `stronix_interactions.createdAt`, na interação `status_change` "Contrato cancelado".
- Desde quando: vendas canceladas e valor desde 30/06/2026. Motivo desde 28/07/2026.
- Viabilidade e prioridade: pronto, prioridade média. É a base do abatimento da comissão, e o cancelado continua na venda do mês.
- Permissão e custo: gestor e dono. Custo zero nos contratos. Buscar a data do registro na interação é barato.
- Já existe em: Visão geral → Gerencial, na nota de cancelado depois (`src/lib/gerencial/texts.js:29-34`).
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:238-251` e `src/modals/ContractOutcomeModal.jsx:67`.
  - O motivo só existe desde 28/07/2026 (commit `c2685a2`, PR #162). Antes disso, o cancelamento pela ficha gravava `cancelReason` nulo (versão de 30/06/2026 do `LeadProfileView.jsx`, linha 164), e o `cancellationsByReason` agrupa o nulo como "Outro" (`src/lib/operacional/base.js:287`). O relatório deve mostrar "sem motivo", e não "Outro".
  - `cancelledAt` é a data efetiva escolhida no modal, não a data do registro (`ContractOutcomeModal.jsx:67` e `104-105`). Pode ser retroativa ou futura. "Dias até cancelar" (`cancelledAt` menos `createdAt`) pode dar negativo ou mostrar um cancelamento que ainda não aconteceu, e o `clawCount` já conta cancelamento com data futura. A data do registro fica só na interação.
  - O `clawValue` soma o valor inteiro do contrato, não a parte que ficou sem uso (`src/lib/gerencial/sales.js:42`). Para servir de abatimento de comissão, o relatório tem que dizer isso.
  - Cancelado antigo sem `cancelledAt` recebe o `endsAt` na normalização (`base.js:62`), o que infla os dias até cancelar. Não achei caminho do app que cancele sem gravar `cancelledAt`.
  - Os motivos saem de uma lista fixa (`src/lib/contracts.js:38-45`).

#### R055. Relatório de contratos

Quais contratos foram fechados, renovados, cancelados, trancados ou vencem num período, com plano, valor, desconto, motivo e origem?

- Para quem: dono e gestor.
- Recortes: mês de fechamento, de início ou de fim, plano, consultor, situação, tipo, origem do lead e professor.
- Números: quantidade, valor total e por mês, desconto, dias trancados e dias do cadastro à matrícula.
- Filtros: período (e qual data vale), situação, tipo, plano e pessoa.
- Formato: tabela nominal exportável.
- De onde vem: a coleção `stronix_contratos` inteira (`createdAt`, `startsAt`, `endsAt`, `status`, `cancelledAt`, `cancelReason`, `pausedAt`, `pauseReason`, `resumedAt`, `pausedDaysTotal`, `pauseHistory`, `value`, `listValue`, `discountReason`, `planId`, `planName`, `consultantId`, `renewedFromId`, `closedFromUpgrade`, `leadName` e as marcas de importação). Do lead, lido por id: `stronix_leads.source`, `createdAt` (fora os importados), `professorId` e `professorName` (professor do cliente hoje, não do contrato).
- Desde quando: 30/06/2026. Motivo de cancelamento e de trancamento desde 28/07/2026. Histórico exato de pausas desde 14/09/2026.
- Viabilidade e prioridade: com ajuste, prioridade alta. Foi pedido e adiado em 28/07, a coleção já está em memória e o relatório inclui a lista de matrículas do período.
- Permissão e custo: gestor e dono, como trava de tela, porque qualquer membro lê contratos e leads (`firestore.rules:235-243`). Custo zero nos contratos. O lead é lido por id em lotes de 30 (mais 1 leitura do `tenantActive` por consulta), em proporção aos contratos do período, com memória de sessão.
- Já existe em: nada parecido hoje. A memória do redesign de contratos registra que relatórios de contrato seguem sem existir.
- Conferência no código: ajustado. Evidências: `src/lib/aulasWrites.js:110-125` e `src/lib/operacional/base.js:122-131`.
  - O contrato não tem professor. O professor fica no lead (`professorId` e `professorName`), carimbado só na matrícula a partir da última aula atendida, e é sobrescrito numa conversão posterior. Serve como professor do cliente hoje, não do contrato.
  - A situação é derivada e não é gravada: agendado, a vencer e vencido saem do relógio (`src/lib/contracts.js:67-92`). Para o passado, ela precisa ser recalculada pelas datas com `contractStateAt`, e não lida do `status`.
  - O `pauseHistory` só existe desde 14/09/2026 (commit `43fd457`, de 11/09, em produção com o merge `08f4442` da PR #206). Antes disso a pausa é reconstruída a partir de `resumedAt` e `pausedDaysTotal`, e várias pausas antigas viram uma só (`contracts.js:311-320`).
  - "Vencem no período" usa `endsAt`, que anda na reativação (`contracts.js:340` e `353`). Vencimento passado muda depois de reativar, e a correção também reescreve `startsAt` e `endsAt`.
  - Origem e dias do cadastro à matrícula exigem ler o lead por id em lotes de 30 (molde em `src/hooks/useGerencialLeads.js:26-45`). Num período longo são mais leituras que as do Gerencial de hoje (cerca de 50 por mês). Lead excluído vira "Sem origem", e lead importado tem `createdAt` igual ao dia da importação, então fica fora da conta de dias.
  - A lista exportável deve usar a neutralização de CSV que já existe (`src/views/LeadsView.jsx:127-146`), e nome de pessoa não vai para o endereço nem para o nome do arquivo. A restrição a gestor e dono é só trava de tela.

#### R056. Insumo do fechamento da Comissão

Quantos contratos de cada plano cada consultor fechou na competência, quanto valem e quantos foram cancelados depois?

- Para quem: dono.
- Recortes: competência (`createdAt` no fuso America/Sao_Paulo), consultor e plano convertido em serviço da Comissão.
- Números: quantidade por serviço, valor fechado e de tabela, e cancelado depois.
- Filtros: competência.
- Formato: tabela exportável no formato da Comissão.
- De onde vem: `stronix_contratos.createdAt`, `consultantId` e `consultantName`, `planId` e `planName`, `value`, `listValue`, `cancelledAt`, `renewedFromId` e `closedFromUpgrade`. O mapa plano → serviço da Comissão é novo. Taxa de matrícula e forma de pagamento não existem no Stronilead.
- Desde quando: 30/06/2026 (junho não tem mês inteiro).
- Viabilidade e prioridade: com ajuste, prioridade alta. Hoje o fechamento é digitado à mão, e falta o mapa plano → serviço e decidir a atribuição.
- Permissão e custo: dono. Custo zero.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:157-182` e, fora deste repositório, `06-sistemas/comissao-stronix/lib/seed.ts:17-122`.
  - A Comissão STRONIX lança itens por serviço (`{servicoId, qtd}`) com valor em centavos inteiros (CLAUDE.md da Comissão, seções do modelo e de dinheiro em centavos). O Stronilead grava `value` em reais com casas decimais, então a exportação tem que converter.
  - Parte dos serviços da Comissão não existe no Stronilead. "Matrícula" e "Rematrícula" são taxas, e "Recorrente Fidelidade 12x" e "Recorrente 1 Mês" dependem da forma de pagamento. O contrato do Stronilead não guarda taxa, parcela nem forma de pagamento. O mapa plano → serviço não cobre as taxas, e deduzir a taxa pelo tipo (nova ou retorno) não é confiável, porque ela pode ter sido isenta.
  - A atribuição por `consultantId` é o dono do lead na venda, e não a regra de ouro do playbook. Isso precisa ser decidido antes de alimentar a comissão.
  - As contas do Stronilead cortam o mês no horário do navegador (`src/lib/operacional/month.js`). Numa exportação feita no servidor, tem que usar America/Sao_Paulo, como a Comissão.
  - "Cancelado depois" usa `cancelledAt`, que é a data efetiva escolhida no modal, e o `clawValue` é o valor inteiro. Na Comissão, o abatimento é um campo manual por lançamento.
  - A correção de contrato reescreve plano e valor no mês original. Uma competência já fechada na Comissão pode divergir do Stronilead.
  - As contas prontas estão em `src/lib/gerencial/sales.js:9-44` e `src/lib/gerencial/people.js:34-65`.

#### R057. Atribuição de venda pela regra de ouro

Quem agendou primeiro o passe de cada matrícula, quem registrou a venda e a quem ela pertence pela regra, contra o que o sistema credita?

- Para quem: gestor e dono.
- Recortes: contrato, dono no contrato, quem registrou, quem agendou primeiro e mês.
- Números: vendas pela regra, vendas pelo sistema, vendas cruzadas e divergências.
- Filtros: competência e pessoa.
- Formato: tabela de divergências.
- De onde vem: `stronix_contratos.consultantId`, `createdAt` e `leadId`. Das interações: `stronix_interactions.actorId` e `actorAuthUid` (na `status_change` do contrato e nas interações com `volumeKind` de visita ou aula), `volumeKind` e `createdAt`. De `stronix_aulas`: `createdAt`, `scheduledFor` e `status`, sem autor. Quem confirmou o passe, plantão e cobertura são dado novo.
- Desde quando: autor do agendamento e do registro da venda desde 13/07/2026. Visitas com registro desde 18/08/2026. Confirmação, plantão e cobertura a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. A disputa de venda pede "veja quem registrou primeiro", e confirmação, plantão e cobertura não são gravados.
- Permissão e custo: gestor e dono. Custo médio: as interações por `leadId` de cada venda do mês (consulta de campo único, sem índice composto). As interações são legíveis por qualquer membro (`firestore.rules:88-95`).
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/aulasWrites.js:13-44` e `src/lib/contractsWrites.js:124-134`.
  - `stronix_aulas` não guarda quem agendou. O registro traz `consultantId`, `consultantAuthUid` e `consultantName` do dono do lead (`aulasWrites.js:34-42`). O autor do agendamento só está na interação com `volumeKind` (`actorId` e `actorAuthUid`), gravada desde 13/07/2026 (commits `9824a66` e `6ee5df4`). Antes disso, e na presença marcada pela Agenda do dia, o autor cai no dono do lead (`src/lib/dailyGoal.js:88-98`).
  - Quem registrou a venda: `actorId` na `status_change` do contrato desde 13/07/2026 (PR #137, merge `cb7615a`, no `MatriculaModal` da época). A matrícula de 30/06 a 13/07/2026 não gravava `actorId`. A interação não traz o id do contrato, então o casamento é por `leadId` e horário.
  - Visitas só têm registro desde 18/08/2026. Confirmação do passe, plantão e cobertura não são gravados (não achei campo nenhum), e o dado novo que o relatório pede cabe dentro do CRM.
  - A migração em massa reescreve `leadConsultantId` das interações (`TransferLeadsTab.jsx:129-165`), mas não o `actorId`. O `actorId` é a trilha confiável. Excluir o lead apaga as interações dele, e a trilha se perde.

#### R058. Meta de vendas contra realizado

A academia e cada consultor estão no ritmo da meta de matrículas e de valor do mês?

- Para quem: dono, gestor e consultor.
- Recortes: consultor, mês e tipo de meta.
- Números: meta, realizado, percentual atingido e projeção no ritmo atual.
- Filtros: mês e pessoa.
- Formato: barra de progresso com ritmo.
- De onde vem: `stronix_contratos.value`, `createdAt` e `consultantId`, com `importBatchId`, `importSource` e `importedBy` para excluir o importado. A meta por pessoa e mês é dado novo, escrito pelo gestor.
- Desde quando: a partir da gravação da meta. O realizado existe desde 30/06/2026.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. Só existe o piso diário de prospecção, e o Gerencial deixou meta de fora.
- Permissão e custo: todos. "Consultor vê só a própria" seria só trava de tela. Custo zero para o realizado, mais uma leitura pequena da meta.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/settingsSetup.js:33` e `firestore.rules:235-243`.
  - Não existe meta de vendas no Stronilead. O único alvo por pessoa é o `dailyVolumeTarget`, o piso de prospecção. Gravar a meta exige coleção ou campo novo, regra publicada à mão no console e, se for um documento por pessoa e mês, conferir se não pede índice.
  - Para a STRONIX, a meta individual em reais já existe na Comissão STRONIX (`metasIndividuais` por consultor e `metasTemplate`, no CLAUDE.md da Comissão). O relatório precisa decidir se vale a meta da Comissão ou uma meta do Stronilead para todas as academias, senão ficam duas metas divergentes.
  - "Consultor vê a própria" é só trava de tela: qualquer membro lê contratos e configuração.
  - O realizado usa `consultantId` e `createdAt`, sem importados (`src/lib/gerencial/sales.js:9-11`, `src/lib/contracts.js:175-181`). A projeção pelo ritmo do mês precisa de uma regra própria de dias, porque a Meta Diária e o Operacional já usam denominadores diferentes.

#### R059. Contratos agendados e carteira a entrar

Quantos contratos assinados ainda não começaram e quanto vão somar à carteira?

- Para quem: gestor.
- Recortes: mês de início e tipo.
- Números: contratos e valor por mês a entrar.
- Filtros: período.
- Formato: número e lista.
- De onde vem: `stronix_contratos.startsAt`, `endsAt`, `value`, `durationMonths`, `cancelledAt` e `renewedFromId` (para separar renovação de entrada nova).
- Desde quando: 30/06/2026.
- Viabilidade e prioridade: com ajuste, prioridade baixa. O status agendado é derivado.
- Permissão e custo: gestor. Custo zero.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:81-86` e `src/lib/operacional/base.js:122-131`.
  - O "desde" foi corrigido para 30/06/2026. A matrícula daquela data já aceitava qualquer data de início (`git show b2b0c9d:src/modals/MatriculaModal.jsx`, linhas 55, 84 e 181), então há contrato agendado desde o primeiro dia. O "Emendar" de 28/07/2026 só facilitou (`src/modals/ContractModal.jsx:117` e `132-134`).
  - "Quanto vão somar à carteira" não é a soma bruta. A renovação emendada entra quando o contrato antigo sai, então o ganho líquido é o novo menos o que acaba. Matrícula nova, retorno e renovação precisam ficar separados, e contrato sem valor fica fora do dinheiro (`src/lib/gerencial/scope.js:13` e `17-21`).
  - O agendado não entra no `walletAt`, porque o `contractStateAt` devolve nulo antes de `startsAt` (`base.js:123`). O agendado cancelado antes de começar nunca valeu e tem que sair.
  - O status agendado é derivado e muda com o relógio.

#### R060. Leads, vendas e carteira por unidade

Quanto cada unidade capta, vende e renova?

- Para quem: dono.
- Recortes: unidade e mês.
- Números: leads, matrículas, valor vendido, carteira e renovação.
- Filtros: período e unidade.
- Formato: tabela por unidade.
- De onde vem: `stronix_aulas.unit` (nome, só visita), `stronix_leads.appointmentUnit` (estado atual, só visita) e o catálogo `stronix_units`. A unidade no lead e no contrato, por id, é dado novo.
- Desde quando: a partir da gravação. Visitas com unidade desde 18/08/2026.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. Só a visita tem unidade, e o recorte importa para redes.
- Permissão e custo: dono. Custo zero a baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/schedulePatch.js:60` e `src/lib/aulasWrites.js:15-23`.
  - Só a visita tem unidade: o `appointmentUnit` do lead (estado atual, sobrescrito a cada compromisso) e o `unit` de `stronix_aulas` (por registro de visita). Aula experimental, lead e contrato não têm unidade (`src/lib/contracts.js:157-182`).
  - A unidade é gravada pelo nome. Renomear em Configurações reescreve só o `appointmentUnit` dos leads carregados, e não o `stronix_aulas.unit` (`src/views/settings/SchedulingSection.jsx:196-203`). Isso parte o histórico em duas linhas.
  - As visitas só têm registro desde 18/08/2026. Para leads, vendas, carteira e renovação por unidade é preciso gravar a unidade no cadastro do lead e no contrato, de preferência por id (`stronix_units`). Isso cabe no CRM.

#### R061. Auditoria de correções de contrato

Quem corrigiu que contrato, e de quanto para quanto?

- Para quem: dono. O papel não existe no sistema, e na prática quem abre é o gestor.
- Recortes: mês, quem corrigiu e campo alterado.
- Números: correções e diferença de valor.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_interactions` com texto começando por "Contrato corrigido" (`actorId`, `actorAuthUid`, `createdAt`, `leadId`), que dá autor, data e valor novo desde 28/07/2026. O `stronix_contratos.updatedAt` não é exclusivo da correção: cancelar, trancar e reativar também gravam. Dado novo: no contrato, um histórico de correções com `correctedAt`, `correctedBy` e os valores anteriores (`planId`, `value`, `startsAt`, `endsAt`), ou, na interação, um `contractId`, uma marca de correção e o valor anterior.
- Desde quando: autor, data e valor novo desde 28/07/2026 (PRs #162 e #163). Valor anterior e campo alterado só a partir de quando o dado novo começar a ser gravado.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. A correção reescreve o contrato e muda o mês fechado sem guardar o valor de antes.
- Permissão e custo: gestor (admin). Não existe papel "dono", e a trava é só de tela. Se o histórico for gravado no próprio contrato, não há leitura nova, porque os contratos já chegam inteiros pela assinatura do app (`src/App.jsx:794-802`). Se ficar só na interação, é uma consulta das interações por `createdAt` no período, filtrada pelo texto no navegador.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:371-400` e `src/lib/contractsWrites.js:20-58`.
  - A justificativa original dizia que a correção muda o mês fechado sem rastro. Isso está errado em parte. Toda correção já grava uma interação com autor e data (`actorId`, `actorAuthUid`, `createdAt`, type `status_change`), e o texto traz plano, valor novo e vigência nova. Falta o valor anterior e o id do contrato: a interação não leva `contractId`, e o contrato só ganha `updatedAt`, com gravação por cima de `planId`, `planName`, `value`, `listValue`, `durationMonths`, `startsAt` e `endsAt`.
  - Nenhum campo marca a interação como correção. Hoje só dá para achá-la pelo começo do texto ("Contrato corrigido"), e o type `status_change` é o mesmo de matrícula, cancelamento, trancamento e reativação.
  - "Campo alterado" só existe se o valor anterior for gravado. A correção regrava todos os campos juntos, então sem o antes não dá para saber qual mudou. Reconstruir o antes pelo texto da interação anterior do mesmo lead é frágil e fica ambíguo quando a pessoa tem contrato paralelo.
  - O papel "dono" não existe. Só há admin (gestor) e consultant, e o dono é só o `primaryAdminUid`, sem permissão própria.
  - Quem corrige não é só o gestor. O botão Corrigir aparece para qualquer membro com `authUid` (`canEditLead`, `src/lib/leads.js:257`; `src/views/LeadProfileView.jsx:121` e `1812-1817`), e a regra do contrato aceita alteração de qualquer membro desde que o `consultantAuthUid` não mude (`firestore.rules:235-241`). O relatório precisa incluir consultores.
  - A correção só age no contrato atual (`currentContract`, `LeadProfileView.jsx:2049-2055`). Na prática, corrige o contrato vigente, e não um contrato antigo qualquer.
  - O modal de correção e o texto "Contrato corrigido" nasceram no commit `c2685a2`, de 28/07/2026 (merges `3f7a01c` e `ba774dc`). A chamada está em `src/modals/ContractEditModal.jsx:68-80`.

#### R062. Recebimento, forma de pagamento e inadimplência da academia

Quanto entrou no caixa, como foi pago e quem está devendo?

- Para quem: dono.
- Recortes: mês, forma de pagamento e plano.
- Números: recebido, em aberto, inadimplência e previsão.
- Filtros: nenhum.
- Formato: não se aplica.
- De onde vem: não existe no CRM.
- Desde quando: não se aplica.
- Viabilidade e prioridade: fora do escopo, prioridade baixa. O Gerencial deixou isso de fora de propósito, e é papel do financeiro (Stronix Suite).
- Permissão e custo: não se aplica.
- Já existe em: nada parecido hoje.
- Conferência no código: inviável. Evidências: `src/views/dashboard/GerencialToolbar.jsx:14` e `api/asaas.js:124-125`.
  - O CRM não guarda pagamento, parcela, forma de pagamento nem inadimplência do aluno. A busca por `formaPagamento`, `paymentMethod` e `inadimpl` em `src/` não achou campo de pagamento de aluno. O Gerencial avisa num chip fixo que o número é valor de contrato vendido, não caixa recebido. A classificação "fora do escopo" está certa.
  - Não confundir com `tenant_payments` nem com a inadimplência que aparece no `src/App.jsx:487-493`. As duas são a cobrança do próprio Stronilead à academia (Asaas), e não o caixa da academia com os alunos.
  - Passar a gravar recebimento e cobrança de aluno transformaria o CRM em financeiro, que é o papel do Stronix Suite no ecossistema.

#### R063. Clientes pagando abaixo da tabela atual

Quantos clientes pagam por mês menos do que a tabela de hoje do próprio plano, quanto a carteira ganharia se renovassem pela tabela atual, e quem vence primeiro?

- Para quem: dono e gestor.
- Recortes: plano, faixa de diferença percentual, mês de vencimento, motivo do desconto de entrada e dono atual.
- Números: clientes abaixo da tabela, diferença mensal por cliente, ganho mensal possível na renovação e lista nominal.
- Filtros: contrato vigente e com valor (fora os importados sem valor).
- Formato: tabela por plano com o ganho possível, mais a lista nominal ordenada pelo vencimento.
- De onde vem: `stronix_contratos` (`value`, `listValue`, `durationMonths`, `planId`, `endsAt`, `pausedAt`, `renewedFromId`, `discountMode`, `discountValue`, `discountReason`, `importBatchId` e `importSource`), `stronix_planos` (`value`, `durationMonths`, `active`) e `stronix_leads.consultantId`, só para o dono atual, lido por id.
- Desde quando: contratos e `listValue` desde 30/06/2026. Motivo do desconto só desde 28/07/2026. Importados ficam fora ou marcados. A comparação é sempre com a tabela de hoje.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Dá ao dono o tamanho do reajuste possível e a lista de quem abordar primeiro na renovação.
- Permissão e custo: gestor (admin). Não há papel "dono" separado, e qualquer membro lê contratos e planos pelas regras, então a trava é só de tela. Plano e valor não pedem leitura nova. Com o recorte por dono atual, é uma leitura por cliente vigente (lotes de 30, cerca de 600 na STRONIX), com memória de sessão.
- Já existe em: nada igual hoje. Encosta em dois outros: o R053, que compara o preço cobrado com a tabela da época de cada venda, e o R092, que mostra o que aconteceu nas renovações feitas. Este olha para a frente. Plano que guarda preço mensal no lugar do total (Shape One) dá diferença falsa.
- Conferência no código: ajustado. Evidências: `src/lib/contracts.js:155` e `163`, e `src/lib/clientImport.js:501-502`.
  - Faltava nas fontes o `listValue`, o preço de tabela do plano no dia da venda, gravado desde o primeiro contrato (commit `89df3e9`, 23/06/2026; em produção com o PR #123, merge `b2b0c9d`, 30/06/2026). É ele que separa "abaixo da tabela porque teve desconto" de "abaixo porque a tabela subiu depois". Sem ele o relatório mistura as duas causas.
  - Contrato importado sem coluna de valor recebeu `value` igual ao `listValue` (preço do plano no dia da importação), e não o que o aluno paga. Esses aparecem como pagando a tabela, o que é falso. Filtrar "com valor" não basta: o importado sai (`isImportedContract`) ou vem marcado.
  - `discountMode`, `discountValue` e `discountReason` só existem desde 28/07/2026 (`c2685a2`), e só nos contratos feitos pelo modal de contrato (`src/modals/ContractModal.jsx:189-202`). Contrato de 30/06 a 27/07 e importado não têm motivo do desconto.
  - O dono atual não está no contrato. O `consultantId` é o consultor do lead na hora da venda (`contracts.js:175-181`). O dono de hoje exige ler o lead de cada cliente, e desde o flip os clientes não estão em memória (a base viva é `lifecycleBucket` "ativo"). Com esse recorte, "nenhuma leitura nova" deixa de valer: são as leituras dos leads por id em lotes de 30, cerca de uma por cliente vigente.
  - Contrato vigente que já tem sucessor (renovação ligada ou outro contrato da pessoa que começa depois) sai da lista, como faz o risco do Gerencial (`src/lib/gerencial/risk.js:10-39`). Senão quem já renovou aparece entre os que precisam ser abordados.
  - Contrato paralelo é permitido, então a mesma pessoa pode aparecer duas vezes. A lista nominal precisa agrupar por pessoa ou avisar.
  - Trancado fica na carteira, mas o `endsAt` dele anda na reativação. Na ordem por vencimento, o trancado vem marcado, porque a data não é vencimento.
  - A comparação é mensal dos dois lados (`value ÷ durationMonths` do contrato contra o mesmo cálculo no plano), porque a duração do plano pode ter mudado (`src/views/settings/CatalogsSection.jsx:215-224`). O aviso da Shape One continua valendo.
  - Faixa de diferença e ganho possível são contas derivadas. Mostrar com a base (quantos contratos) e sem nota composta.

#### R064. Dia e hora das vendas

Em que dia da semana, hora e semana do mês se fecham matrículas e renovações, e quanto é lançado fora do turno de quem vendeu?

- Para quem: dono e gestor.
- Recortes: dia da semana, hora do lançamento, semana do mês, tipo de venda e consultor do contrato.
- Números: vendas, valor vendido, percentual fora do turno e percentual na última semana do mês.
- Filtros: sem importados e período.
- Formato: mapa de calor de dia da semana por hora, mais barras por semana do mês.
- De onde vem: `stronix_contratos.createdAt`, `consultantId`, `value`, `renewedFromId`, `closedFromUpgrade` e as marcas de importação. `stronix_interactions.actorId` para quem lançou, casado por `leadId` e `createdAt`. `stronix_users.shiftStart` e `shiftEnd` (turno atual, sem dia da semana).
- Desde quando: 30/06/2026 para dia e hora. O percentual fora do turno só vale para quem tem turno cadastrado, e sempre com o turno de hoje.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Mostra se a escala cobre os horários em que se vende e se o mês depende da corrida final.
- Permissão e custo: gestor (admin), trava só de tela. O mapa de calor não pede leitura nova. O percentual fora do turno por quem lançou pede as interações `status_change` do período (consulta por `createdAt`).
- Já existe em: nada igual hoje. Encosta no R002 (hora de chegada do lead), no R121 (hora das ações) e no R049, que soma a venda por dia mas não por dia da semana nem por hora. O `createdAt` é a hora do lançamento, não da assinatura: venda lançada depois muda a hora.
- Conferência no código: ajustado. Evidências: `src/lib/contractsWrites.js:119-130` e `src/views/settings/TeamAccessSection.jsx:255-256`.
  - "Fora do turno de quem vendeu" mistura duas pessoas. O `consultantId` do contrato é o dono do lead no momento da venda, e não quem lançou (`src/lib/contracts.js:175-181`). Quem lançou está no `actorId` da interação de matrícula ou renovação gravada no mesmo lote, que não leva `contractId`: só dá para casar por `leadId` e `createdAt`.
  - `shiftStart` e `shiftEnd` formam um único intervalo HH:MM, sem dia da semana, opcional (a tela mostra um traço quando está vazio, `TeamAccessSection.jsx:493` e `586-589`) e sem histórico. Vale o turno de hoje. Venda de quem não tem turno fica sem classificação, e turno mudado reescreve o passado.
  - Contrato importado recebe `createdAt` igual à hora da importação (`src/lib/clientImportWrites.js:107-112`). Precisa sair (`isImportedContract`, `src/lib/contracts.js:271`), senão os 494 caem todos numa hora só. O filtro "sem importados" já está previsto.
  - A ressalva de que `createdAt` é a hora do lançamento está certa. Contrato sem `createdAt` cairia no `startsAt` (meia-noite, `src/lib/gerencial/scope.js:9`), mas desde o primeiro commit de contratos (`89df3e9`) o `createdAt` é gravado. Esse caso é só teórico.
  - Ficha, Pipeline e Meta Diária usam o mesmo modal de contrato e o mesmo `commitMatricula`, então a hora é gravada do mesmo jeito nos três (`src/lib/contractsWrites.js:95-96`).

#### R065. Valor estimado do aluno por canal

Quanto vale, em estimativa, um aluno novo de cada canal ao longo da permanência, e quanto isso dá contra o custo de trazê-lo?

- Para quem: dono.
- Recortes: origem e canal, plano de entrada e safra.
- Números: ticket mensal de entrada, permanência média observada, valor estimado por aluno (ticket vezes permanência) e custo por matrícula (R004).
- Filtros: origem e período.
- Formato: tabela por canal com as partes da conta lado a lado, sem nota única.
- De onde vem: `stronix_contratos` (`value`, `durationMonths`, `planId`, `createdAt`, `endsAt`, `cancelledAt`, pausas, `renewedFromId` e marcas de importação) e `stronix_leads.source` (origem atual, lida por id). Dado novo: investimento por mês e por origem, numa configuração gravada pelo gestor.
- Desde quando: ticket e origem desde 30/06/2026. Permanência só com leitura de sobrevivência (quem saiu separado de quem continua). O custo por canal só existe a partir da gravação do investimento.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. O "LTV estimado" aparece nas ideias do mercado e o catálogo só tem a forma realizada. Pela preferência do Johnny contra número composto, a tela mostra ticket, permanência e custo separados, e só vale a pena quando houver um ano de contratos.
- Permissão e custo: gestor (admin), sem papel "dono" separado. Contratos já assinados, mais os leads das vendas por id em lotes de 30 (`src/hooks/useGerencialLeads.js`), mais um documento de investimento por mês.
- Já existe em: nada igual hoje. No catálogo, o valor já realizado está no R075, e o custo e o retorno da primeira venda no R004.
- Conferência no código: ajustado. Evidências: `src/lib/gerencial/people.js:67-72` e `src/lib/gerencial/scope.js:23-34`.
  - O investimento por canal não existe em lugar nenhum do código (a busca por `investiment`, `adSpend`, `verba` e `marketingCost` em `src/` e `api/` não achou nada). A classificação "precisa gravar dado novo" está certa, e o dado cabe no CRM, então não é inviável.
  - A permanência média observada está censurada. Em 24/09/2026, o contrato mais antigo feito no sistema tem menos de 3 meses. Média de quem ainda está ativo subestima a permanência, então o relatório precisa separar quem saiu de quem continua, e não mostrar uma média simples. Os importados têm permanência mais longa, mas não são aluno novo e não têm origem confiável.
  - "Ticket vezes permanência" é número composto e contradiz a preferência do Johnny, mesmo com o "sem nota única". O relatório deve mostrar ticket e permanência lado a lado e deixar a multiplicação de fora, ou explícita como conta.
  - A origem é a `source` atual do lead, e não um campo do contrato. Muda se alguém editar, o renomear do catálogo reescreve os leads, e lead apagado vira "Sem origem".
  - "Aluno novo" usa só contrato não importado (`src/lib/contracts.js:271`) e do tipo nova do `saleTypeOf`, fora retorno e renovação. "Plano de entrada" é o primeiro contrato da pessoa (`personKey`).
  - A permanência depende do `renewalGraceDays` e do trancamento (trancado não é saída), do mesmo jeito que o churn do Operacional. Essa configuração é a de hoje, sem versão.
  - Os primeiros contratos entraram em produção com o PR #123 (merge `b2b0c9d`, 30/06/2026).


### 5.6 Carteira e retenção

Este domínio diz quantos clientes a academia tem agora, como a carteira mudou mês a mês, quem saiu, por que e depois de quanto tempo, e quem trancou. Quase tudo sai da coleção `stronix_contratos`, que já chega inteira no login e não custa leitura nova, mas só existe desde 30/06/2026. A importação trouxe só o último contrato de quem estava vivo, então os meses anteriores à importação de cada academia têm viés de sobrevivente, e a correção de contrato e a reativação mudam meses já fechados. Todo dinheiro aqui é valor de contrato, não caixa, e dono, professor, origem e modalidade são sempre os de hoje.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R066 | Situação atual da base de clientes | Alta | Com ajuste | Ajustado |
| R067 | Evolução da carteira e da base ativa | Alta | Com ajuste | Ajustado |
| R068 | Ponte da base do mês com nomes | Alta | Com ajuste | Ajustado |
| R069 | Churn mensal por segmento | Alta | Com ajuste | Ajustado |
| R070 | Cancelamentos por motivo e momento | Alta | Com ajuste | Ajustado |
| R071 | Cancelamento nos primeiros 90 dias | Média | Com ajuste | Ajustado |
| R072 | Trancamentos | Média | Com ajuste | Ajustado |
| R073 | Retenção por safra de entrada | Média | Com ajuste | Ajustado |
| R074 | Tempo de casa e permanência | Média | Com ajuste | Ajustado |
| R075 | Valor de contrato por cliente (LTV realizado) | Baixa | Com ajuste | Ajustado |
| R076 | Carteira e retenção por professor | Média | Precisa gravar dado novo | Ajustado |
| R077 | Pessoas com contrato paralelo | Baixa | Com ajuste | Ajustado |
| R078 | Satisfação dos clientes (NPS) | Baixa | Precisa gravar dado novo | Ajustado |
| R079 | Ponte da carteira em valor por mês | Média | Com ajuste | Ajustado |
| R080 | Projeção da base e da carteira no fim do mês | Média | Com ajuste | Ajustado |
| R081 | Quem fica e quem sai: renovação e cancelamento por perfil e origem | Média | Com ajuste | Ajustado |
| R082 | Acompanhamento do aluno novo nos primeiros 90 dias | Média | Com ajuste | Ajustado |
| R083 | Pedidos de cancelamento e reversão | Média | Precisa gravar dado novo | Ajustado |
| R084 | Trancamento e transferência fora da regra do plano | Baixa | Precisa gravar dado novo | Ajustado |
| R085 | Engajamento do cliente e permanência | Média | Com ajuste | Ajustado |

#### R066. Situação atual da base de clientes

Quantos clientes estão ativos, a vencer, vencidos, trancados, cancelados, agendados ou sem contrato agora, de quem são e em que plano?

- Para quem: dono, gestor e consultor.
- Recortes: situação, dono atual, plano e professor.
- Números: clientes e valor por mês.
- Filtros: situação, pessoa e plano.
- Formato: retrato com tabela nominal exportável.
- De onde vem: `stronix_contratos`, que já está em memória (`startsAt`, `endsAt`, `status`, `cancelledAt`, `pausedAt`, `pauseHistory`, `value`, `durationMonths`, `planName`, `leadId`, `leadName`), para a situação e o valor por mês. `stronix_leads.consultantId` para o dono atual, `stronix_leads.professorId` para o professor de hoje e `stronix_leads.lifecycleBucket == 'cliente'` para achar quem está sem contrato. O espelho do lead (`currentContractStatus`, `currentContractEndsAt`) entra só como apoio.
- Desde quando: é retrato. O cliente legado sem contrato aparece como Sem contrato.
- Viabilidade e prioridade: com ajuste, alta. A tela Clientes não exporta, e a situação é calculada e filtrada no navegador.
- Permissão e custo: todos os papéis leem pelas regras. O recorte por responsável só aparece na tela do gestor, e deixar o consultor exportar dado pessoal (telefone) pede decisão. Situação e valor saem de graça da assinatura de contratos. Dono, professor e Sem contrato custam a leitura da base de clientes (`clientsAllQuerySpec`, uma leitura por cliente a cada abertura). A alternativa é ler os leads por id em lotes de 30, mais uma consulta só dos clientes sem `currentContractId`.
- Já existe em: menu Clientes, sem exportação e sem filtro de trancado.
- Conferência no código: ajustado. O que mudou:
  - O espelho do lead (`currentContract*`) é do último contrato gravado, não do vigente. Quem renova antes do vencimento ganha um contrato que começa no dia seguinte ao fim do atual (`src/lib/renewal.js:39`, `src/modals/ContractModal.jsx:105` e `197`), e o lead passa a mostrar Agendado enquanto o contrato velho ainda vale (`src/lib/contracts.js:84-88`). Pelo espelho, os ativos saem a menos. A situação por pessoa sai de `personStatesAt` sobre a coleção de contratos, onde vigente ganha de trancado (`src/lib/operacional/base.js:134-146`), e o espelho fica só como apoio.
  - `currentContractValue` é o valor total do contrato, e o lead não guarda `durationMonths`. O valor por mês pede o documento do contrato (pelo `currentContractId`, com os contratos já em memória) e o `monthlyTicket` (`src/lib/gerencial/scope.js:13-21`). Contrato sem valor (os 494 importados) conta como cliente e nunca como dinheiro.
  - A vencer é fixo em 30 dias. O `contractThresholdDays` nasce em 30 e só volta a 30, nunca é lido da configuração (`src/App.jsx:331` e `835`). Não é escolha da academia.
  - Sem contrato não é só legado. Lead movido para etapa com nome de matrícula (Venda, Matriculado) vira cliente sem contrato e sem `clienteSince` (`src/lib/stageMove.js:80-103`). O `clienteSince` só é gravado em `src/lib/contractsWrites.js:116` e na importação (`src/lib/clientImport.js:626` e `647`).
  - Cancelar e trancar agem só sobre o contrato atual do lead (`src/lib/contracts.js:248`, `264` e `361-363`; `src/views/LeadProfileView.jsx:269-273` e `2039-2046`). Com contrato paralelo, o espelho pode dizer cancelado de alguém que segue vigente pelo outro contrato. A importação grava o mesmo espelho (`src/lib/clientImport.js:554-560`).
  - O professor é o `professorId` de hoje no lead: carimbado na matrícula desde 21/07/2026, editável no cadastro e vindo da importação (`src/lib/aulasWrites.js:110-126`, `src/lib/clientRegistration.js:63-64`). Não tem histórico.
  - A tela Clientes já filtra por plano, mas não tem Trancado entre as situações, não exporta e não mostra o professor. O filtro de responsável só aparece para o gestor. Exportar lista com telefone para o consultor é decisão de produto, porque as regras deixam qualquer membro ler tudo (`firestore.rules:79-80` e `235-236`).
  - Evidências: `src/lib/contracts.js:184-190` (a matrícula grava no lead `currentPlanName`, `currentContractValue`, início, fim e status `'ativo'`) e `src/views/ClientsView.jsx:40-47` (`STATUS_OPTIONS` sem Trancado; a base vem do `clientsAllQuerySpec` em `111-114`, e não há exportação no arquivo).

#### R067. Evolução da carteira e da base ativa

Como a carteira (contratos e valor por mês) e o número de clientes ativos e trancados evoluíram no fim de cada mês?

- Para quem: dono e gestor.
- Recortes: fim de cada mês, plano, modalidade e vendedor.
- Números: contratos vigentes, clientes ativos, trancados, valor por mês, ticket mensal e pessoas com dois vigentes.
- Filtros: intervalo de meses e plano.
- Formato: evolução mensal.
- De onde vem: `stronix_contratos.startsAt`, `endsAt`, `cancelledAt`, `pauseHistory` e `value`.
- Desde quando: os contratos existem desde 30/06/2026 (PR #123, merge `b2b0c9d`). A série só é confiável a partir do mês seguinte à importação da academia. Antes disso fica marcada como parcial, com viés de sobrevivente.
- Viabilidade e prioridade: com ajuste, alta. `walletAt` e `countActiveAt` aceitam qualquer instante, mas a correção e o trancamento mudam o passado.
- Permissão e custo: gestor, como trava de tela. Não existe papel dono, e o dado é legível por todos. Custo zero, porque a coleção inteira de contratos já chega na assinatura do login (`src/App.jsx:794-802`).
- Já existe em: Visão geral → Gerencial, bloco Carteira, só como retrato de hoje.
- Conferência no código: ajustado. O que mudou:
  - "Confiável a partir do fim de julho" não se sustentava. A importação trouxe só contratos ativos, trancados e vencidos dentro da janela de Vencidos (`src/lib/clientImport.js:319-335`). Cancelados e vencidos antigos ficaram de fora, e o `startsAt` vem da planilha, às vezes inferido pela duração do plano (`src/lib/clientImport.js:492-495`). Nos meses anteriores à importação só aparece quem sobreviveu até ela, e o cliente legado sem contrato não aparece. A série vale a partir do mês seguinte à importação da academia (`importedAt` dos contratos). Numa academia que nunca importou, vale a partir de quando todo cliente passou a ter contrato.
  - A correção de contrato reescreve `startsAt`, `endsAt` e o valor (`src/lib/contracts.js:374-400`). A reativação empurra o `endsAt`. O `normalizeContracts` fecha a pausa aberta no início do contrato seguinte (`src/lib/operacional/base.js:100-116`). Meses passados mudam depois, e o relatório não pode ser congelado como mês fechado.
  - A modalidade não está no contrato. Sai do plano de hoje pelo `planId`, e o plano pode ter mudado desde a venda.
  - A carteira soma contratos, e os clientes ativos somam pessoas (vigente ganha de trancado). As duas colunas precisam de rótulo, e o valor por mês deixa de fora o contrato sem valor.
  - Gerencial e Operacional abrem para todos (`src/lib/routes.js:53-55`). "Só gestor e dono" seria trava só de tela, e não existe papel dono separado do gestor.
  - Evidências: `src/lib/gerencial/wallet.js:7-28` (`walletAt` em qualquer instante, com `overlap` e `blind`) e `src/lib/operacional/base.js:122-150` (`contractStateAt`, `countActiveAt` e `countLockedAt`).

#### R068. Ponte da base do mês com nomes

Com quantos clientes o mês começou e terminou, e quem entrou, voltou, foi importado, cancelou, venceu, trancou e destrancou?

- Para quem: dono e gestor.
- Recortes: mês, passo da ponte, plano e consultor do contrato.
- Números: início, entradas, retornos, importados, saídas, trancaram, destrancaram e fim.
- Filtros: mês e plano.
- Formato: cascata, com a lista nominal de cada passo.
- De onde vem: `stronix_contratos` (`startsAt`, `endsAt`, `createdAt`, `cancelledAt`, `cancelReason`, `pausedAt`, `pauseHistory`, `pausedDaysTotal`, `resumedAt`, `renewedFromId`, `leadId`, `leadName`, `consultantId`, `planName`, `importBatchId`, `importedAt`). Para o nome atual, se quiser, `stronix_leads` por id.
- Desde quando: 30/06/2026, com os contratos. O retrato por pessoa só é confiável depois da importação da academia. As pausas aparecem separadas desde 14/09/2026.
- Viabilidade e prioridade: com ajuste, alta. O `computeBaseMovement` precisa devolver os ids para abrir as fichas.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Custo zero.
- Já existe em: Visão geral → Operacional, bloco Movimento da base, só com os números.
- Conferência no código: ajustado. O que mudou:
  - O `computeBaseMovement` devolve só contagens. Para a lista de cada passo, ele e o `lockEventsInWindow` (`src/lib/operacional/base.js:187-199`) precisam devolver as `personKey` (o `leadId`). O nome vem de `contract.leadName`, que é uma foto da época da venda, ou do lead lido por id. O contrato importado também recebe `leadId` (`src/lib/clientImportWrites.js:106-113`).
  - A ponte não usa `stronix_leads.clienteSince`. "Voltaram" sai da existência de contrato anterior da pessoa na coleção. O cliente legado sem contrato (antes de 30/06/2026) que fecha contrato novo aparece como entrada, não como retorno.
  - O passo dos trancamentos é saldo, e "trancaram" e "destrancaram" contam pausa de contrato. Com contrato paralelo, "trancaram" pode passar do passo da ponte, e a lista precisa dizer isso.
  - Pausa e cancelamento gravados pela importação não contam. Os que o app grava depois num contrato importado contam (`src/lib/contracts.js:271-311`).
  - O viés de sobrevivente dos meses anteriores à importação vale aqui também.
  - A data do cancelamento pode ser escolhida à mão, sem limite (`src/modals/ContractOutcomeModal.jsx:67` e `184`), e isso muda a ponte de um mês já fechado (`src/lib/operacional/metrics.js:78`).
  - Evidências: `src/lib/operacional/base.js:206-250` (`computeBaseMovement` só conta) e `src/lib/operacional/base.js:223-224` (retorno é ter contrato anterior na coleção).

#### R069. Churn mensal por segmento

Quantos clientes saíram de vez no mês, quanto valor mensal saiu, e de que plano, duração, carteira e tempo de casa eles eram?

- Para quem: dono e gestor.
- Recortes: mês, plano, duração, dono atual, dono na época, tempo de casa e tipo de saída.
- Números: saídas definitivas, churn em % sobre os ativos no início do mês e valor mensal perdido.
- Filtros: período, plano e pessoa.
- Formato: número com comparativo e tabela por segmento.
- De onde vem: `stronix_contratos.cancelledAt`, `endsAt`, `startsAt`, `pauseHistory`, `pausedAt`, `value`, `durationMonths`, `planName` e `consultantId` (o vendedor do contrato que saiu). `stronix_config/general.renewalGraceDays`, no valor de hoje. `stronix_leads.consultantId` para o dono atual.
- Desde quando: as contas são possíveis desde julho de 2026, mas só ficam comparáveis a partir do mês seguinte à importação da academia.
- Viabilidade e prioridade: com ajuste, alta. O churn da academia existe e os cortes não; dono na época pede histórico de posse, e a tolerância é a de hoje.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Custo zero.
- Já existe em: Visão geral → Operacional, bloco Churn, e Gerencial, bloco Saiu neste mês (`src/lib/gerencial/risk.js:50-63`).
- Conferência no código: ajustado. O que mudou:
  - Dono na época não existe. O sistema não guarda histórico de posse, e a migração em massa reescreve o `leadConsultantId` das interações (`src/views/settings/TransferLeadsTab.jsx:129-165`). O substituto que existe é o consultor gravado no contrato que terminou: `contract.consultantId`, o dono do lead na hora da venda (`src/lib/contracts.js:175-181`).
  - O `computeChurn` devolve só a contagem de pessoas. Para cortar por plano, duração ou tempo de casa e somar o valor mensal perdido, ele precisa devolver o contrato que saiu de cada pessoa. O denominador de cada segmento é o número de vigentes do segmento no início do mês, não o da academia.
  - A saída por vencimento depende do `renewalGraceDays` de hoje, que não tem versão. Mudar a configuração muda meses fechados.
  - Valor mensal perdido é o `monthlyTicket` do contrato que saiu, sem os contratos de valor zero. É valor de contrato, não caixa.
  - "Desde julho de 2026" tem viés. Antes da importação a base só tem quem sobreviveu até ela, então o churn e o denominador de julho e agosto saem menores do que foram. O vencido no fim do mês só vira churn no mês seguinte.
  - Tempo de casa pelo `clienteSince` não é confiável no importado, que usa a data de cadastro da planilha (`src/lib/clientImport.js:626` e `647`), nem no cliente feito por etapa, que não tem o campo. Melhor usar o início do primeiro contrato e marcar de onde veio a data.
  - Evidências: `src/lib/operacional/base.js:256-280` (`computeChurn` conta saídas por pessoa) e `src/lib/operacional/metrics.js:77-83` (a tolerância é a da configuração de hoje).

#### R070. Cancelamentos por motivo e momento

Por que as pessoas cancelam, em que ponto da vigência, depois de quanto tempo de casa e quanto contrato fica sem cumprir?

- Para quem: dono e gestor.
- Recortes: mês, motivo, plano, consultor do contrato, % da vigência cumprida e tempo de casa.
- Números: cancelamentos, valor mensal que saiu, valor não cumprido e observações.
- Filtros: período, motivo e plano.
- Formato: ranking de motivos e tabela nominal.
- De onde vem: `stronix_contratos.cancelledAt`, `cancelReason`, `cancelNote`, `startsAt`, `endsAt`, `pausedDaysTotal`, `pauseHistory`, `value`, `durationMonths`, `consultantId` e `planName`.
- Desde quando: cancelamentos desde 30/06/2026. Motivo, nota e data escolhida desde 28/07/2026. Antes disso o cancelamento aparece como "Sem motivo", e não como "Outro".
- Viabilidade e prioridade: com ajuste, alta. A lista fixa de motivos foi criada para virar relatório, mas a data do cancelamento é escolhida à mão.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Custo zero.
- Já existe em: Visão geral → Operacional, bloco Cancelamentos por motivo.
- Conferência no código: ajustado. O que mudou:
  - Antes de 28/07/2026 (PR #162, commit `c2685a2`, merge `ba774dc`) o cancelamento gravava `cancelReason` nulo, e o `cancelledAt` era a hora do clique (`git show b2b0c9d:src/views/LeadProfileView.jsx:164`). O `cancellationsByReason` junta o nulo com "Outro" e mistura quem não deu motivo com quem escolheu "Outro". O relatório separa "Sem motivo (antes de 28/07)".
  - Desde 28/07 a data do cancelamento é escolhida à mão, sem limite (`src/modals/ContractOutcomeModal.jsx:67` e `184`), então um mês fechado muda com cancelamento retroativo.
  - Valor não cumprido é valor de contrato proporcional ao que faltava, não dinheiro perdido. A academia pode ter recebido por mês. Contrato sem valor (importado) fica fora da soma.
  - O % da vigência cumprida tira os dias trancados (`pausedDaysTotal` e as pausas), porque o `endsAt` anda na reativação.
  - O contrato cancelado antes de começar nunca valeu e fica à parte. O cancelado depois do fim é tratado como vencimento no churn, mas entra na lista por motivo (`src/lib/operacional/base.js:192` e `266-268`).
  - O `cancelNote` é texto livre e pode ter dado pessoal. Na exportação, passa pela neutralização do CSV.
  - O tempo de casa pede a primeira matrícula: o primeiro contrato da pessoa, ou o `clienteSince` com as ressalvas da importação.
  - Evidências: `src/lib/operacional/base.js:285-294` (nulo vira "Outro") e `src/lib/contracts.js:36-45` e `238-251` (lista fixa de motivos e `buildContractCancel` com `cancelNote`).

#### R071. Cancelamento nos primeiros 90 dias

Quantos alunos novos cancelam cedo, e de qual consultor, plano e origem eles vieram?

- Para quem: dono e gestor.
- Recortes: mês da matrícula, consultor que vendeu, plano e origem.
- Números: matrículas, cancelados em até 90 dias e taxa em %.
- Filtros: período.
- Formato: coorte por safra.
- De onde vem: `stronix_contratos.startsAt`, `createdAt`, `cancelledAt`, `endsAt`, `renewedFromId`, `consultantId`, `planName` e `importBatchId` (para excluir o importado). `stronix_leads.source`, lido por id.
- Desde quando: safra de julho de 2026 em diante, lida só depois de 90 dias fechados. A primeira sai em novembro de 2026.
- Viabilidade e prioridade: com ajuste, média. É o indicador de mercado para a qualidade da venda, e é conta nova sobre dado pronto.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Contratos sem custo, mais os leads por id em lotes de 30 só para a origem.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Matrícula é o primeiro contrato da pessoa: sem `renewedFromId`, sem contrato anterior e sem importado. É a regra do `salesInWindow`. O cliente legado sem contrato (antes de 30/06) que fecha contrato entra como novo. Momento e tipo da venda seguem `src/lib/gerencial/scope.js:9` e `25-34`.
  - Os 90 dias contam do início da vigência (`startsAt`), não do `createdAt`, porque a venda pode ser fechada antes de começar. A safra só pode ser lida depois de 90 dias fechados, então os meses recentes aparecem como imaturos.
  - Contar só o `cancelledAt` deixa de fora quem sai cedo porque o plano curto venceu e não renovou. O relatório separa "cancelou" de "saiu de vez", pela regra do `computeChurn`.
  - A data do cancelamento é escolhida à mão desde 28/07 (`src/modals/ContractOutcomeModal.jsx:184`), e antes era a hora do clique.
  - A origem é a `source` de hoje do lead. Renomear no catálogo reescreve, e editar muda. A leitura é por id em lotes de 30, no molde do `useGerencialLeads` (`src/hooks/useGerencialLeads.js:30-31`). O consultor é o do contrato (`src/lib/contracts.js:175-181`).
  - "Desde junho de 2026" virou safra de julho de 2026 em diante, porque os contratos existem desde 30/06.
  - Evidências: `src/lib/operacional/base.js:298-314` (`salesInWindow`: primeiro contrato, sem importado) e `src/lib/gerencial/people.js:67-72` (origem pela `source` atual do lead).

#### R072. Trancamentos

Quantos trancam, por quê, por quanto tempo, quantos voltam e quantos cancelam depois?

- Para quem: dono e gestor.
- Recortes: mês de início e de fim, motivo, plano e faixa de dias parados.
- Números: trancaram, destrancaram, trancados agora, duração média e % que cancelou depois.
- Filtros: período e plano.
- Formato: número com comparativo e tabela.
- De onde vem: `stronix_contratos.pausedAt`, `pauseReason` (só da última pausa), `pauseHistory`, `resumedAt`, `pausedDaysTotal`, `cancelledAt`, `importedAt` e `importBatchId`. Campo novo: `pauseHistory[].reason`, gravado na reativação.
- Desde quando: trancamento desde 28/07/2026. Pausas separadas desde 14/09/2026. Motivo por pausa só a partir da gravação nova; antes disso, só o da última pausa.
- Viabilidade e prioridade: com ajuste, média. O motivo de cada pausa precisa entrar no `pauseHistory`.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Custo zero.
- Já existe em: Visão geral → Operacional, bloco Trancamentos.
- Conferência no código: ajustado. O que mudou:
  - O motivo existe só para a pausa atual ou a última. A reativação não apaga o `pauseReason` nem o copia para o `pauseHistory`, e o trancamento seguinte o sobrescreve. O motivo de cada pausa só fica no texto da interação ("Contrato trancado a partir de...", com o motivo no fim, `src/lib/contracts.js:255-266`), que não agrupa com segurança. Para ter motivo por pausa, a reativação precisa gravar o motivo dentro do item do `pauseHistory`. É dado novo, que vale dali em diante.
  - Antes de 14/09/2026 (PR #206, commit `43fd457`, merge `08f4442`) várias pausas do mesmo contrato viram uma só, refeita a partir do `resumedAt` e do `pausedDaysTotal`. A duração dessas é aproximada.
  - A pausa gravada pela importação não tem data real (`fromImport`) e fica fora das contagens e da duração média.
  - Quem renova ainda trancado tem a pausa fechada por conta, no início do contrato seguinte, sem nada gravado (`src/lib/operacional/base.js:100-116`). A duração dessas é inferida.
  - Trancados agora conta pessoas sem outro contrato vigente (`countLockedAt`). Trancaram e destrancaram contam pausas de contrato (`src/lib/operacional/base.js:187-199`). Com contrato paralelo, os números diferem.
  - "% que cancelou depois" pede `cancelledAt` com pausa aberta ou depois de uma pausa, e o motivo do cancelamento só é gravado desde 28/07 (commit `c2685a2`, merge `ba774dc`).
  - Evidências: `src/lib/contracts.js:335-370` (`buildContractResume` grava o `pauseHistory` sem motivo e não limpa o `pauseReason`) e `src/lib/contracts.js:313-330` (`reconstructedPauseOf` e `closedPausesOf`).

#### R073. Retenção por safra de entrada

Dos clientes que entraram em cada mês, quantos seguem ativos depois de 1, 3, 6 e 12 meses?

- Para quem: dono e gestor.
- Recortes: mês da primeira matrícula, meses desde a entrada, origem, plano de entrada e consultor.
- Números: % da safra vigente e receita acumulada por cliente.
- Filtros: origem e plano.
- Formato: triângulo de safras.
- De onde vem: `stronix_contratos.startsAt` do primeiro contrato não importado da pessoa, mais `endsAt`, `cancelledAt`, `pauseHistory`, `pausedAt`, `renewedFromId`, `value`, `consultantId` e `planName`. `stronix_leads.source`, por id, se quiser o corte por origem.
- Desde quando: safra de julho de 2026. O marco de 3 meses aparece a partir de outubro de 2026, o de 6 meses a partir de janeiro de 2027 e o de 12 meses a partir de julho de 2027. Importados ficam fora.
- Viabilidade e prioridade: com ajuste, média. O `contractStateAt` dá o estado em qualquer instante, mas não dá para fingir série com poucos pontos.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Contratos sem custo, mais os leads por id em lotes de 30 se houver corte por origem.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - A safra não sai do `stronix_leads.clienteSince`. Ele é gravado na hora do clique da primeira matrícula por contrato (`src/lib/contractsWrites.js:116`, `src/lib/contracts.js:221`). Na importação vira a data de cadastro da planilha (`earliest(registeredAt, startsAt)`), que pode ser de anos atrás. E não existe para cliente feito por etapa (`src/lib/stageMove.js:80-103`) nem para legado. A safra certa sai do início do primeiro contrato não importado da pessoa, pela coleção de contratos.
  - Importados ficam fora da coorte. Só entraram se estavam vivos na importação (`src/lib/clientImport.js:319-335`), e uma safra antiga com eles mostraria retenção perto de 100%.
  - Receita acumulada é valor de contrato somado, não caixa. Contrato sem valor fica fora.
  - Vigente no mês N sai do `personStatesAt`: trancado conta como cliente, não como saída. O cliente legado sem contrato que volta entra como safra nova.
  - Evidências: `src/lib/clientImport.js:626` e `647` (`clienteSince` da importação) e `src/lib/operacional/base.js:122-146` (`contractStateAt` e `personStatesAt`).

#### R074. Tempo de casa e permanência

Há quanto tempo os clientes estão na academia, e quanto ficam em média antes de sair?

- Para quem: dono e gestor.
- Recortes: faixa de tempo de casa, plano atual, origem e professor.
- Números: meses desde a primeira matrícula, meses vigentes, renovações e permanência média de quem saiu.
- Filtros: plano e origem.
- Formato: histograma.
- De onde vem: `stronix_leads.clienteSince`, com a marca de importado pelo `importBatchId`; `stronix_leads.convertedAt` para o legado; `stronix_contratos.startsAt`, `endsAt`, `pausedDaysTotal`, `pauseHistory` e `renewedFromId`; `stronix_leads.professorId`, `source` e `currentPlanName`, todos de hoje.
- Desde quando: o tempo de casa vale desde a data que existir. Importados pela data da planilha, com marca; os demais desde 30/06/2026. A permanência de quem saiu só existe desde julho de 2026, e truncada.
- Viabilidade e prioridade: com ajuste, média. Os importados distorcem, então a tela mostra de onde veio cada data.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Contratos sem custo. Leads por id em lotes de 30, ou a base de clientes inteira (custo alto) se ler tudo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `clienteSince` da importação é a data mais antiga entre cadastro e início na planilha, e o cadastro pode ser de quando a pessoa era só contato. Cliente por etapa e legado não têm `clienteSince`. A marca de origem da data é obrigatória, e o legado cai no `convertedAt` ou em "sem data".
  - Meses vigentes descontam os dias trancados (`src/lib/contracts.js:335-360`). A renovação conta pelo `renewedFromId`, mas a renovação feita como matrícula nova, sem vínculo, só aparece pela regra de contrato seguinte (`src/lib/operacional/renewal.js:35-52`).
  - A permanência média de quem saiu só existe para saídas desde julho de 2026 e é truncada à direita: com três meses de história, sai curta por construção. Precisa de aviso, ou de esperar a série crescer.
  - O custo não era "zero mais base de clientes". A base de clientes é a leitura alta do `clientsAllQuerySpec` (`src/lib/leadQueries.js:31`). Dá para trocar por contratos em memória mais leads por id em lotes de 30.
  - Professor, origem e plano atual são os de hoje, sem histórico.
  - Evidências: `src/lib/clientImport.js:604-626` e `647` (o cadastro vira `createdAt` e o `clienteSince` fica com a data mais antiga) e `src/lib/stageMove.js:80-103` (cliente por etapa sem `clienteSince`).

#### R075. Valor de contrato por cliente (LTV realizado)

Quanto cada cliente já comprou em contratos, e qual canal, consultor ou plano de entrada traz os clientes mais valiosos?

- Para quem: dono.
- Recortes: origem, consultor da primeira matrícula, plano de entrada e safra.
- Números: valor somado por pessoa, média, contratos por pessoa e meses de contrato.
- Filtros: origem e safra.
- Formato: ranking.
- De onde vem: `stronix_contratos.leadId`, `value`, `durationMonths`, `consultantId`, `startsAt`, `createdAt` e `importBatchId` (para excluir o importado). `stronix_leads.source`, por id.
- Desde quando: 30/06/2026, sem importados.
- Viabilidade e prioridade: com ajuste, baixa. É valor de contrato, não caixa, e o importado fica fora.
- Permissão e custo: gestor (admin), como trava de tela. Não existe papel dono, e o dado é legível por todos. Custo zero, mais os leads por id.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Não existe papel dono. Os papéis são admin (gestor) e consultant (`api/admin-users.js`). O dono é só o `primaryAdminUid`, sem permissão própria, e qualquer membro lê os contratos (`firestore.rules:235-236`). "Só dono" não dá para travar nem na tela sem regra nova.
  - O valor do contrato importado pode ser o preço de tabela do plano quando a planilha não trouxe valor, e o histórico anterior à importação não existe. Todos os importados ficam fora do LTV, e não só os sem valor.
  - A correção de contrato reescreve o valor, então o número de uma pessoa muda depois.
  - O consultor da primeira matrícula é o `consultantId` do primeiro contrato não importado. A origem é a de hoje do lead e muda com renomeação ou edição (`src/lib/gerencial/scope.js:13` para o `hasValue`).
  - Com três meses de história, o LTV realizado mede basicamente o primeiro contrato. É valor de contrato, não caixa.
  - Evidências: `src/lib/clientImport.js:501-502` (o valor é o da planilha ou, sem ele, o do plano) e `src/lib/contracts.js:374-390` (a correção reescreve o `value`).

#### R076. Carteira e retenção por professor

Quantos alunos cada professor tem, quanto valem por mês, quantos seguem ativos e quantos renovam?

- Para quem: dono e gestor.
- Recortes: professor, modalidade, situação do contrato e mês de vencimento.
- Números: clientes, ativos, valor por mês, taxa de renovação e cancelamentos.
- Filtros: professor e modalidade.
- Formato: tabela por professor.
- De onde vem: `stronix_leads.professorId` e `professorName` (retrato de hoje); `stronix_contratos.endsAt`, `renewedFromId`, `value` e `durationMonths`. Campo novo: `stronix_contratos.professorId`, gravado na matrícula e na renovação.
- Desde quando: a aproximação pelo professor de hoje vale desde 21/07/2026. Histórico só a partir da gravação do professor no contrato.
- Viabilidade e prioridade: precisa gravar dado novo, média. O pedido foi adiado (spec em revisão), e trocar o professor do cliente reescreve o passado.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Custo alto: a base de clientes.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `stronix_leads.professorId` é retrato. É carimbado na matrícula pela última aula atendida (não na renovação), regravado num retorno, editável no cadastro do cliente (`src/lib/clientRegistration.js:63-64`) e vem da importação (`src/lib/clientImport.js:382-383` e `616-617`). O contrato não tem professor e não há histórico. Trocar o professor reescreve o passado, então a taxa de renovação por professor exige gravar o professor no contrato.
  - A aproximação vale desde 21/07/2026 (PR #154, commits `cb529b2` e `30fa53d`, merge `9e134f5`), e não 20/07.
  - O spec da carteira de professor (`af08b67`, status revisão) está só na branch `claude/experimental-classes-audit-d78091`. Ele decide um professor por modalidade e a carteira como retrato de hoje (decisões 2 e 4 em `docs/superpowers/specs/2026-07-17-professor-responsavel-carteira-design.md`, lido com `git show af08b67`). O relatório segue essa decisão ou a reabre.
  - A modalidade não está no contrato. Sai do plano de hoje, que pode ter mudado.
  - Cliente de "Treina sozinho" ou com matrícula direta fica sem professor.
  - Evidências: `src/lib/aulasWrites.js:110-126` (`markConvertingAula` carimba o `professorId` no lead) e `src/lib/contracts.js:158-182` (o contrato não tem professor).

#### R077. Pessoas com contrato paralelo

Quem tem dois contratos vigentes ao mesmo tempo?

- Para quem: gestor e dono.
- Recortes: pessoa e plano.
- Números: pessoas e contratos.
- Filtros: plano.
- Formato: tabela nominal.
- De onde vem: `stronix_contratos.leadId`, `leadName`, `startsAt`, `endsAt`, `cancelledAt`, `pausedAt`, `pauseHistory`, `renewedFromId` e `planName`.
- Desde quando: 30/06/2026.
- Viabilidade e prioridade: com ajuste, baixa. O `walletAt` já conta, falta a lista.
- Permissão e custo: gestor, como trava de tela; o dado é legível por todos. Custo zero.
- Já existe em: Visão geral → Gerencial, na nota de contratos sobrepostos (`src/lib/gerencial/texts.js:36-40`).
- Conferência no código: ajustado. O que mudou:
  - O `walletAt.overlap` conta pessoas com mais de um contrato vigente ou trancado, e não só "dois vigentes".
  - A lista mistura contrato paralelo de verdade com renovação sobreposta. O modal de renovação avisa que "o contrato atual será encerrado" antes do previsto (`src/lib/renewal.js:64-68`, `src/modals/ContractModal.jsx:189-203`), mas nenhuma gravação encurta o contrato antigo: os dois ficam valendo juntos até o fim do velho. A lista separa, pelo `renewedFromId`, a renovação sobreposta do paralelo sem vínculo.
  - A lista precisa das `personKey`, e o `walletAt` hoje devolve só o número. Contrato sem `leadId` vira pessoa própria (`src/lib/operacional/base.js:71`).
  - O Gerencial abre para todos, então "só gestor" é trava de tela.
  - Evidências: `src/lib/gerencial/wallet.js:9-17` e `26` (`overlap` sobre estado vigente ou trancado) e `src/lib/contractsWrites.js:64-160` (`commitMatricula` não mexe no contrato antigo).

#### R078. Satisfação dos clientes (NPS)

Os clientes recomendariam a academia, e isso muda por plano, consultor ou tempo de casa?

- Para quem: dono e gestor.
- Recortes: plano, consultor, tempo de casa e mês.
- Números: nota média, promotores, detratores e NPS.
- Filtros: período.
- Formato: número com comparativo.
- De onde vem: coleção nova de respostas, com nota de 0 a 10, data, `leadId`, `planId` e `consultantId` do contrato vigente no momento e o canal (ficha ou link). `stronix_leads.clienteSince` para o tempo de casa. O contrato de `stronix_contratos` vigente na data da resposta, para plano e consultor.
- Desde quando: a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, baixa. O `satisfactionAt` é lido e não achei quem grava.
- Permissão e custo: gestor e dono como trava de tela. As regras deixam qualquer membro ler, e a coleção nova precisa de regra publicada à mão. Custo baixo: uma consulta por período na coleção nova (campo único `createdAt`); os contratos já chegam na assinatura do login.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - A justificativa confere. O `satisfactionAt` só é lido por uma função sem chamador (`src/lib/leads.js:72-74`). Não achei quem grava, e o `git log -S satisfactionAt` só mostra o commit inicial e refatorações.
  - Faltava dizer como a nota entra no sistema. O CRM não tem canal com o aluno. Há dois caminhos: o consultor registra a nota na ficha, ou a pesquisa vai por link público. O link público precisa de rota de servidor no molde da indicação (`api/tenant-resolve.js:205-285`, que já serve `/i/<slug>`), para não gastar a 12ª função da Vercel, já que 11 das 12 estão em uso.
  - Coleção nova (por exemplo `stronix_nps`) sem regra própria é negada. Precisa de regra e de publicação manual no console antes do deploy. Um campo no próprio lead não guarda série, porque a segunda pesquisa sobrescreveria a primeira. A pesquisa tem que ser um documento por resposta, com data.
  - O tempo de casa sai do `clienteSince`. A importação grava a data da planilha (`src/lib/clientImport.js:626`), e a matrícula feita no app carimba só na primeira vez (`src/lib/contracts.js:219-221`). Serve, mas o cliente legado anterior a 30/06/2026 sem `clienteSince` fica sem faixa.
  - As regras deixam qualquer membro ler tudo (`firestore.rules:79-95`), então "gestor e dono" vale só como trava de tela.
  - Evidências: `src/lib/leads.js:72-74` (`getLeadSatisfactionDate`, sem chamador em `src/`) e `firestore.rules:235-253` (cada coleção tem regra própria, e coleção nova precisa da sua).

#### R079. Ponte da carteira em valor por mês

Quanto a carteira mensal (valor por mês dos contratos vigentes) mudou no mês, e de onde veio a diferença: matrícula nova, retorno, upgrade, renovação mais cara ou mais barata, cancelamento, vencido sem renovar, trancamento ou destrancamento?

- Para quem: dono e gestor.
- Recortes: mês; passo da ponte (início, novas, retornos, expansão, contração, cancelamentos, vencidos sem renovar, trancaram, destrancaram, fim); plano; modalidade; consultor do contrato.
- Números: carteira no início e no fim (R$/mês); variação por passo (R$/mês); retenção bruta da carteira em %, sem novas e sem expansão; retenção líquida da carteira em %, com expansão e contração; contratos sem valor, à parte.
- Filtros: importados só no início e no fim, nunca nos passos de movimento (a conferência mostra que isso não fecha a conta); trancado dentro ou fora da carteira.
- Formato: cascata do início ao fim do mês em R$/mês, com a tabela dos passos e a comparação com o mês anterior.
- De onde vem: `stronix_contratos` (`value`, `durationMonths`, `startsAt`, `endsAt`, `cancelledAt`, `pausedAt`, `resumedAt`, `pausedDaysTotal`, `pauseHistory`, `renewedFromId`, `closedFromUpgrade`, `consultantId`, `planId`, `importBatchId`, `importSource`). As contas `normalizeContracts` e `contractStateAt` (`src/lib/operacional/base.js:100-131`). O `walletAt` (`src/lib/gerencial/wallet.js:7`) no início e no fim, com a decomposição por contrato ainda a escrever. `stronix_planos.modalityIds` de hoje, não do dia da venda.
- Desde quando: contratos desde 30/06/2026; ponte confiável a partir de julho de 2026, com a ressalva da importação descrita na conferência.
- Viabilidade e prioridade: com ajuste, média. É o MRR da academia: o dono vê se a carteira cresce por venda nova ou encolhe por saída, na mesma lógica que o super-admin já usa para as academias.
- Permissão e custo: dono e gestor como trava de tela; qualquer membro já lê todos os contratos pelas regras (`firestore.rules:235-236`). Nenhuma leitura nova: a coleção de contratos chega inteira na assinatura do login (`src/App.jsx:794-802`).
- Já existe em: nada parecido hoje. No catálogo, o R068 é a mesma ponte contada em pessoas, o R067 mostra só o saldo do fim do mês, e o R069 e o R092 (aumento na renovação) mostram pedaços (valor perdido e aumento). Nenhum explica em dinheiro, passo a passo, por que a carteira mudou. Os 494 importados sem valor ficam fora do dinheiro, e os planos da Shape One, que guardam preço mensal no lugar do total, distorcem a expansão e a contração.
- Conferência no código: ajustado. O que mudou:
  - A ponte em R$/mês não existe pronta. O `computeBaseMovement` conta pessoas por troca de estado e não separa expansão de contração. O Gerencial calcula a carteira só no instante de hoje (`src/lib/gerencial/metrics.js:30-47`). Falta escrever a decomposição por contrato: `walletAt` no início e no fim (`src/lib/gerencial/wallet.js:7-28`), e cada contrato que entra ou sai classificado. Expansão e contração saem da diferença de `monthlyTicket` entre o contrato seguinte (`renewedFromId`) e o anterior.
  - "Importados só no início e no fim, nunca nos passos" não fecha a conta. A ponte de pessoas já tem o passo importados (`src/lib/operacional/base.js:220-222`) para quem entra por contrato importado com `startsAt` dentro do mês. Sem esse passo, o início mais os passos deixa de dar o fim. Na STRONIX o passo vale R$ 0, porque os 494 importados não têm valor, mas pesa numa academia que importar com valor.
  - Upgrade não é passo separado na maioria dos casos. Com contrato vivo, fechar pelo funil Upgrade é renovação emendada (`src/views/KanbanView.jsx:1573-1582`, `src/lib/renewal.js:39`). O valor novo só entra na carteira quando o contrato seguinte começa, e esse mês pode não ser o da venda. A ponte segue a vigência (`startsAt`); a venda do Gerencial segue o `createdAt`. Os dois caem em meses diferentes.
  - Risco a conferir em teste: o `endsAt` é o início mais N meses (`src/lib/contracts.js:56-59`), e o contrato já está vencido às 00:00 do `endsAt` (`src/lib/operacional/base.js:126`). A emenda começa no `endsAt` mais 1 dia (`src/lib/renewal.js:39`), e o modal chama isso de emenda perfeita (`src/lib/renewal.js:42-51`). Pela conta do Operacional, sobra um dia sem contrato vigente. Quando esse dia cai no dia 1º, a renovação aparece como vencido num mês e retorno no seguinte, e a carteira do início do mês sai sem esse valor.
  - Mês fechado muda depois. A correção reescreve valor, plano e início no próprio documento (`src/lib/contracts.js:371-400`), e a reativação empurra o `endsAt` (`src/lib/contracts.js:333-362`). Nenhuma foto é gravada.
  - A modalidade vem do `stronix_planos.modalityIds` de hoje (`src/views/settings/CatalogsSection.jsx:221-226`). O contrato não guarda modalidade, e o plano pode ter sido editado depois da venda.
  - A carteira anterior à importação é parcial: a importação trouxe só o contrato mais recente de cada pessoa (`src/lib/clientImport.js:245-252`) e só ativos e vencidos recentes (`src/lib/clientImport.js:314-333`).
  - A comparação com o MRR do super-admin é só analogia. Aquilo é assinatura do SaaS (`api/super-overview.js`), não contrato de aluno.
  - Datas no git: contratos na main em 30/06/2026 (`b2b0c9d`, PR #123), `closedFromUpgrade` em 11/09/2026 (`4c321d3`, PR #199) e `pauseHistory` em 14/09/2026 (`08f4442`, PR #206). Os campos `renewedFromId` e `closedFromUpgrade` são gravados em `src/lib/contracts.js:171-172`.
  - Evidências: `src/lib/operacional/base.js:206-254` (ponte em pessoas, com o passo importados em `220-222`) e `src/lib/renewal.js:39-51` (a emenda começa no fim mais 1 dia e é tratada como emenda perfeita).

#### R080. Projeção da base e da carteira no fim do mês

Com quantos clientes ativos e quanto valor por mês o mês deve terminar, somando quem vence até o último dia, a taxa de renovação recente, os cancelamentos já lançados com data futura e os contratos que ainda vão começar?

- Para quem: dono e gestor.
- Recortes: mês corrente, dono atual, plano e semana do vencimento.
- Números: ativos hoje; vencem até o fim do mês; já renovados; renovações esperadas pela taxa dos últimos 3 meses; cancelamentos com encerramento ainda neste mês; contratos agendados que começam no mês; ativos e carteira previstos no fim do mês; faixa otimista e pessimista.
- Filtros: tolerância de vencidos (`renewalGraceDays`) e com ou sem importados.
- Formato: cartão com o número previsto e a faixa, mais a lista nominal de quem ainda decide o mês (vence sem contrato seguinte).
- De onde vem: `stronix_contratos` normalizados (`normalizeContracts`, `src/lib/operacional/base.js:100`); `renewalCohort` e `upcomingExpirations` (`src/lib/operacional/renewal.js:62` e `185`); `walletAt` (`src/lib/gerencial/wallet.js:7`); `contractStateAt` (`src/lib/operacional/base.js:122`); `stronix_config/general.renewalGraceDays`; `stronix_leads` por id em lotes de 30, para o dono atual e o nome na lista.
- Desde quando: contratos desde 30/06/2026. A taxa histórica pede pelo menos 3 meses de vencimento fechados. A proposta dizia "com folga a partir de outubro de 2026"; pela conferência, três meses completos só existem com folga a partir de dezembro de 2026.
- Viabilidade e prioridade: com ajuste, média. No dia 20 o dono quer saber se a academia vai crescer ou encolher no mês, e hoje só descobre no dia 1º do mês seguinte.
- Permissão e custo: dono e gestor; o consultor vê a própria carteira de renovação, pelo dono atual do lead. Tudo como trava de tela, porque as regras deixam qualquer membro ler contratos e leads. Nenhuma leitura nova para os números; a lista nominal lê os leads por id em lotes de 30.
- Já existe em: nada parecido hoje. No catálogo, a projeção de matrículas pelo funil de leads (R019) e a projeção de venda contra a meta (R058) não olham a base de clientes, e a lista de quem vence (R088) não diz como o mês fecha. O cancelamento pode ser lançado com data futura porque o campo de data do `ContractOutcomeModal` não tem limite (`src/modals/ContractOutcomeModal.jsx:182-188`).
- Conferência no código: ajustado. O que mudou:
  - A taxa dos últimos 3 meses fica enviesada na STRONIX antes de setembro. A importação de 04/09/2026 trouxe só o contrato mais recente de cada pessoa (`src/lib/clientImport.js:245-252`) e só ativos e vencidos dentro da janela (`src/lib/clientImport.js:314-333`). Assim, as coortes de vencimento de julho e agosto quase só têm contratos feitos no app e perdem quem renovou no sistema antigo. Três meses fechados e completos só existem com as coortes de setembro, outubro e novembro, com folga a partir de dezembro de 2026, e não de outubro.
  - A coorte de mês fechado ainda sobe até acabar a tolerância, e no mês em andamento a taxa só usa quem já teve desfecho. A projeção usa só meses em que a tolerância já acabou.
  - A faixa otimista e pessimista é modelo inventado. Pela preferência de não criar índice nem nota sem base, a faixa sai de regra simples e explicada, como a menor e a maior taxa dos meses usados, com a base ao lado.
  - O cancelamento com data futura é possível mesmo: o campo de data não tem limite (`src/modals/ContractOutcomeModal.jsx:176-188`) e o confirmar só exige a data (`src/modals/ContractOutcomeModal.jsx:95-97`). O status vira cancelado na hora, mas o `contractStateAt` usa o `cancelledAt` (`src/lib/operacional/base.js:124`), então o contrato segue vigente até a data.
  - O risco da emenda descrito no R079 vale aqui: o `endsAt` é o primeiro dia sem vigência (`src/lib/operacional/base.js:126`) e a emenda começa um dia depois (`src/lib/renewal.js:39`). Quem renova emendado no último dia do mês pode sair da contagem de ativos no fim por um dia.
  - A lista por dono usa o responsável atual (`ownerOf`, `src/lib/operacional/renewal.js:13-15`). Está certo para a carteira de renovação, mas é diferente do vendedor do contrato.
  - Evidências: `src/lib/operacional/renewal.js:62-89` (`renewalCohort`) e `91-110` (a taxa só com quem já decidiu), e `src/modals/ContractOutcomeModal.jsx:176-188` (data sem limite).

#### R081. Quem fica e quem sai: renovação e cancelamento por perfil e origem

Que tipo de aluno renova mais e que tipo cancela mais: por idade na matrícula, sexo, bairro, dor, modalidade, etiqueta, origem, indicado ou não, se fez aula ou visita antes, com qual professor e se entrou com desconto?

- Para quem: dono e gestor.
- Recortes: faixa etária na matrícula; sexo; bairro e cidade; dor; modalidade do plano; etiqueta; origem e canal; indicado (tem `referredById`) ou não; caminho antes da matrícula (aula, visita, as duas, nenhuma); professor da aula experimental; entrou com desconto e faixa de desconto em %; plano e duração de entrada.
- Números: clientes, taxa de renovação, cancelamentos, cancelamento em até 90 dias em %, churn em %, permanência média em meses e % sem o dado.
- Filtros: safra da primeira matrícula; sem importados (ou só importados, à parte); base mínima por grupo para mostrar a taxa.
- Formato: tabela pela dimensão escolhida, com a base (n) ao lado de cada taxa e barra de dois tons. Sem nota composta.
- De onde vem: `stronix_leads` (`birthDate`, `sexo`, `address.neighborhood`, `address.city`, `dor`, `tags`, `source`, `referredById`, `clienteSince`), pela consulta `where lifecycleBucket == 'cliente'`. `stronix_contratos` (`planId`, `durationMonths`, `listValue`, `value`, `discountMode`, `discountValue`, `discountReason`, `cancelledAt`, `cancelReason`, `renewedFromId`, `importBatchId`). `stronix_planos.modalityIds`, na versão de hoje. `stronix_aulas` (`type` pelo `isAulaRecord`, `status`, `professorId`, `scheduledFor`) por `leadId` em lotes de 30. As contas `renewalCohort` (`src/lib/operacional/renewal.js:62`) e `computeChurn` (`src/lib/operacional/base.js:256`), restritas às pessoas de cada grupo.
- Desde quando: contratos desde 30/06/2026; desconto desde 28/07/2026; sexo e nascimento desde 30/06/2026; bairro desde 21/07/2026; indicação desde 10/08/2026.
- Viabilidade e prioridade: com ajuste, média. Diz onde vale gastar marketing e desconto: se o indicado e quem fez aula experimental ficam mais tempo, e se o desconto traz aluno que sai cedo.
- Permissão e custo: dono e gestor como trava de tela; as regras deixam qualquer membro ler. Contratos sem leitura nova. Uma consulta de campo único dos clientes (`lifecycleBucket == 'cliente'`, centenas de documentos, uma vez por sessão). Aulas dos clientes em lotes de 30 por `leadId`.
- Já existe em: nada parecido hoje. No catálogo, o R141 (perfil) descreve a conversão do lead, não a retenção. O R069 e o R071 cortam o churn e o cancelamento cedo por plano, duração, dono e origem, mas não por idade, sexo, bairro, dor, indicação, caminho ou desconto. O R135 (indicação contra as outras origens) compara só até a matrícula. Com poucos casos por grupo a taxa engana, então a base fica sempre visível.
- Conferência no código: ajustado. O que mudou:
  - A modalidade do plano não sai do `stronix_leads.modalidade`. Esse campo é a modalidade de interesse do lead no cadastro (`src/modals/AddLeadModal.jsx:466`), e a importação grava nulo (`src/lib/clientImport.js:610`). A modalidade do plano vem do `stronix_planos.modalityIds` de hoje, pelo `planId` do contrato, desde 16/07/2026 (PR #149, merge `68c57fd`).
  - O caminho antes da matrícula é incompleto no histórico. O registro de aula existe desde 16/07/2026 (PR #150, `6a06f0f`; antes disso só o backfill do espelho em `scripts/backfill-aulas.js`), e o de visita só desde 18/08/2026. Quem matriculou antes cai em "nenhum" por falta de dado, e não por não ter feito aula. Importado nunca tem caminho. O registro guarda `professorId`, `type` e `status` (`src/lib/aulas.js:92-122`).
  - O desconto confere desde 28/07/2026 (PR #162, merge `ba774dc`; `src/modals/ContractModal.jsx:197-201`). Contrato anterior não tem `discountValue`, e o desconto só se infere por `listValue` menos `value` (`src/lib/contracts.js:154-155`).
  - Indicado pelo `referredById` só vale desde 10/08/2026 (PR #171, `28ad875`) e pode ser desfeito (`src/lib/referralsWrites.js:35` e `74`). Antes disso a única marca é a origem "Indicação", em texto.
  - Renovação, churn e cancelamento em 90 dias só existem para contratos que já venceram ou completaram 90 dias. Com contratos desde 30/06/2026, a primeira safra completa de 90 dias fecha no fim de setembro, e taxa por grupo com poucos casos engana. A base mínima é obrigatória, como o próprio relatório diz.
  - As coortes de renovação de julho e agosto têm o viés da importação: só o último contrato de cada pessoa foi importado (`src/lib/clientImport.js:245-252`).
  - Datas conferidas: sexo e nascimento no cadastro desde 30/06/2026 (PR #123); endereço com bairro desde 21/07/2026 (PR #154, merge `9e134f5`, em `clientRegistration.js`); indicação desde 10/08/2026. Sexo, nascimento e bairro não são obrigatórios, só a dor é (`src/modals/AddLeadModal.jsx:409-411`), então a coluna "% sem o dado" é obrigatória.
  - A origem do importado é `Importação <fonte>` (`src/lib/clientImport.js:614`) e fica separada ou fora.
  - Evidências: `src/modals/AddLeadModal.jsx:461-469` (`birthDate`, `sexo`, modalidade de interesse e `referredById`) e `src/views/settings/CatalogsSection.jsx:221-226` (o plano guarda `modalityIds`).

#### R082. Acompanhamento do aluno novo nos primeiros 90 dias

Os alunos novos receberam contato registrado no dia da matrícula (boas-vindas) e depois em 7, 30 e 90 dias, e quem recebeu cancela menos?

- Para quem: gestor, consultor e dono.
- Recortes: mês da matrícula, consultor que vendeu, dono atual, plano e tipo (matrícula nova ou retorno).
- Números: matrículas; com contato no mesmo dia; com contato em 7, 30 e 90 dias; sem nenhum contato depois da matrícula; cancelamento em até 90 dias com e sem contato; lista nominal dos alunos novos sem contato.
- Filtros: sem importados; sem a interação automática da própria matrícula ("Matrícula realizada").
- Formato: tabela por consultor e mês com as quatro janelas, mais a lista nominal exportável de quem está sem contato.
- De onde vem: `stronix_contratos` (`createdAt`, `renewedFromId`, `consultantId`, `cancelledAt`, `leadId`), sem importados. `stronix_leads` (`clienteSince`, `consultantId` atual). `stronix_interactions` por `leadId` e `createdAt` a partir da matrícula (índice 10), só dos tipos `note` (sem a observação do cadastro) e `daily_goal_done`; `status_change`, `referral` e `import` ficam fora. Mensagem e ligação registradas na ficha são `note`, separadas pelo começo do texto.
- Desde quando: contratos desde 30/06/2026; autor da interação desde 13/07/2026.
- Viabilidade e prioridade: com ajuste, média. O playbook manda dar boas-vindas no mesmo dia da matrícula (`02-playbooks/TIME COMERCIAL/PLAYBOOK_COMERCIAL_STRONIX.md:248-254` e `:349`), e o relatório diz se isso acontece e se muda o cancelamento cedo.
- Permissão e custo: todos. O recorte do consultor pelo responsável atual é trava de tela, porque as regras deixam qualquer membro ler as interações. Contratos sem leitura nova. Interações dos alunos novos pelo índice `leadId` + `createdAt` (índice 10 do `firestore.indexes.json`) ou em lotes de 30. O volume é pequeno, só as matrículas do período.
- Já existe em: nada parecido hoje. No catálogo, o R113 (carteira sem toque há 7, 15 ou 30 dias) olha a base inteira, sem o começo da vida do aluno, e o R071 mede o cancelamento cedo sem ligar ao acompanhamento. A boas-vindas mandada pelo WhatsApp sem registro na ficha não aparece.
- Conferência no código: ajustado. O que mudou:
  - Tirar só a "Matrícula realizada" não basta. A matrícula grava interação `status_change`, e a mesma venda pode gerar outras `status_change` no mesmo dia, como a troca de etapa para Venda. Também são `status_change` o trancamento, a reativação, o cancelamento e a correção do contrato (`src/lib/contractsWrites.js:44-56`). A regra de contato do CRM conta tudo isso como contato (`src/lib/crm/contact.js:16-21`). Sem filtro, "contato no mesmo dia" dá quase 100% por construção. Contato de acompanhamento é interação que não seja `status_change`, `referral` nem `import`: `note` fora da observação do cadastro e `daily_goal_done`.
  - A lista de tipos é fechada no relatório. As interações gravam cinco tipos: `note`, `daily_goal_done`, `status_change`, `referral` e `import` (seção 3.2). `visita` e `aula` são o `type` do registro em `stronix_aulas`, e não de interação. `call` só aparece nos testes.
  - Autor confiável (`actorAuthUid`) só desde 13/07/2026. Antes disso vale o dono do lead.
  - Boas-vindas pelo WhatsApp sem registro na ficha não aparece. A mensagem do Stronizap só vira interação na Parte B da ponte, que ainda não tem plano.
  - "O consultor vê os próprios alunos" precisa dizer qual dono vale: o vendedor gravado no contrato (`src/lib/contracts.js:175-181`) ou o responsável atual (`lead.consultantId`). O acompanhamento é do responsável atual.
  - O filtro de matrícula exclui o importado (`isImportedContract`, `src/lib/contracts.js:271`) e deixa claro que contrato sem `renewedFromId` inclui retorno de ex-cliente e upgrade fechado sem contrato vivo.
  - Evidências: `src/lib/contractsWrites.js:124-133` (a matrícula grava `status_change`) e `src/lib/crm/contact.js:8-21` (fora indicação, importação, observação do cadastro e troca de responsável, toda interação conta como contato).

#### R083. Pedidos de cancelamento e reversão

Quantos pedidos de cancelamento chegaram no mês, quantos foram revertidos e com qual oferta (congelamento, troca de plano, cortesia, transferência), quanto tempo levou cada fase e quanto de carteira foi salvo?

- Para quem: dono e gestor.
- Recortes: mês do pedido, canal do pedido (e-mail, presencial), oferta de retenção, resultado, plano, motivo e quem atendeu.
- Números: pedidos, revertidos, % de reversão, dias entre o pedido e o encerramento, valor por mês salvo e pedidos sem resposta em 5 dias úteis.
- Filtros: linha do plano e período.
- Formato: funil do pedido (pedido, oferta, revertido ou cancelado), com tabela por oferta.
- De onde vem: campos novos, ou um subdocumento de pedido no contrato: `cancelRequestedAt`, `cancelRequestChannel`, `retentionOffer` (lista fixa), `retentionOutcome`, `retentionDecidedAt` e `monthlyValueAtRequest`. Mais `stronix_contratos.cancelledAt`, `cancelReason` e `cancelNote`, e o `stronix_interactions.actorId` de quem registrou o pedido e o desfecho.
- Desde quando: a partir da gravação do pedido.
- Viabilidade e prioridade: precisa gravar dado novo, média. A taxa de reversão é o número que diz se a fase 2 do processo de cancelamento funciona.
- Permissão e custo: dono e gestor como trava de tela. Nenhuma leitura extra se os campos ficarem no contrato, que já chega inteiro na assinatura do login.
- Já existe em: nada parecido hoje. O R070 explica o cancelamento que aconteceu, e ninguém mede o que foi salvo. Hoje o pedido e a reversão vivem só no e-mail financeirostronix@gmail.com.
- Conferência no código: ajustado. O que mudou:
  - Confere que pedido e reversão não existem no sistema. O cancelamento grava só `status`, `cancelledAt`, `cancelReason` e `cancelNote`. A data vem de um campo livre (`src/modals/ContractOutcomeModal.jsx:95-97` e `176-188`). Não achei nada sobre pedido, oferta ou reversão em `src/` e `api/`.
  - Faltavam os campos e o lugar deles: data do pedido, canal, oferta (lista fixa, no molde do `CONTRACT_CANCEL_REASONS`, `src/lib/contracts.js:38-45`), resultado, data da resposta e quem atendeu (o `actorId` da interação). Tudo isso pede um fluxo novo na ficha, "Registrar pedido de cancelamento". O pedido revertido não gera cancelamento hoje, então não deixa rastro nenhum.
  - O valor por mês salvo precisa do valor anterior. Quando a reversão vira troca de plano pela correção de contrato, o documento é reescrito e o valor antigo se perde. O pedido tem que guardar o valor por mês do dia do pedido.
  - As ofertas e os prazos (5 dias úteis, aviso prévio de 30 dias, e-mail financeirostronix) são da STRONIX (`02-playbooks/TIME ADMINISTRATIVO/PROCESSO_CANCELAMENTO_STRONIX.md:14-27`). Num SaaS com várias academias, a lista de ofertas e o prazo precisam ser genéricos ou configuráveis.
  - "Dono e gestor" é só trava de tela: qualquer membro lê e atualiza contratos (`firestore.rules:235-241`).
  - Evidências: `src/lib/contracts.js:238-251` (`buildContractCancel`) e `src/lib/contracts.js:371-400` (a correção reescreve o contrato).

#### R084. Trancamento e transferência fora da regra do plano

Algum trancamento passou do teto do plano (45 dias na recorrência, 90 no Clube+ Start, Move e Flow), foi dado em plano sem esse direito ou em bloco menor que 15 dias, e quantas transferências de titularidade aconteceram?

- Para quem: gestor e dono.
- Recortes: linha do plano (recorrência, Clube+), plano, motivo do trancamento e mês.
- Números: trancamentos, fora da regra, dias parados e transferências de titularidade.
- Filtros: período e linha do plano.
- Formato: lista das exceções com o plano e os dias parados.
- De onde vem: `stronix_contratos` (`pauseHistory`, `pausedAt`, `resumedAt`, `pausedDaysTotal`, `pauseReason` do último trancamento, `importBatchId`). `stronix_interactions`, pelo texto do trancamento com o motivo de cada pausa. Campos novos em `stronix_planos`: teto de dias trancado, bloco mínimo, permite trancar e permite transferir. Registro novo de transferência de titularidade, que não existe.
- Desde quando: `pauseHistory` completo desde 14/09/2026; linha do plano a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, baixa. Evita dar um direito que o contrato não dá e mostra quanto da carteira fica parado fora da regra.
- Permissão e custo: gestor e dono como trava de tela. Nenhuma leitura nova.
- Já existe em: nada parecido hoje. O R072 mede os trancamentos, mas não confere a regra do contrato. Não achei quem grava transferência de titularidade (nenhuma ocorrência de "titular" em `src/` e `api/`).
- Conferência no código: ajustado. O que mudou:
  - O motivo do trancamento é um só por contrato. O `buildContractPause` grava o `pauseReason` no contrato, e o `pauseHistory` guarda só `pausedAt` e `resumedAt` (`src/lib/contracts.js:355-358`), sem motivo. O motivo por pausa só existe no texto da interação.
  - Pausas antigas se juntam. Antes de 14/09/2026 (PR #206, merge `08f4442`) não havia `pauseHistory`, e o histórico refeito junta várias pausas num intervalo só (`reconstructedPauseOf`, `src/lib/contracts.js:314-321`). O bloco mínimo de 15 dias não dá para checar nas pausas de 28/07/2026 (início do trancamento, PR #162, merge `ba774dc`) até 14/09. Nesse período só dá para checar o teto, pelo `pausedDaysTotal`.
  - Pausa em curso não tem fim: os dias parados contam até hoje.
  - O teto e o direito por linha de plano não existem no catálogo. O plano grava nome, valor, duração e modalidades (`src/views/settings/CatalogsSection.jsx:221-226`). Seriam campos novos no plano: teto de dias trancado, bloco mínimo e se permite transferência. As regras de 45, 90 e 15 dias são da STRONIX (`02-playbooks/TIME ADMINISTRATIVO/PROCESSO_CANCELAMENTO_STRONIX.md:22-25`), então cada academia configura as suas.
  - Transferência de titularidade: confere que não achei quem grava. Precisa de fluxo e registro novos.
  - Contrato importado com pausa da importação não tem data real (`isImportPause`, `src/lib/contracts.js:293-298`) e fica fora.
  - Evidências: `src/lib/contracts.js:255-266` (`pauseReason` só no contrato) e `src/lib/contracts.js:314-330` (pausa antiga refeita como uma só).

#### R085. Engajamento do cliente e permanência

O cliente que indica alguém, compra upgrade, tem plano de mais de uma modalidade ou faz aula de outra modalidade renova mais e cancela menos?

- Para quem: dono e gestor.
- Recortes: comportamento (indicou pelo menos 1, fez upgrade, plano de várias modalidades, fez aula já sendo cliente), plano, tempo de casa e dono atual.
- Números: clientes, taxa de renovação, cancelamentos, cancelamento em até 90 dias e permanência média.
- Filtros: mês de vencimento, plano e comportamento.
- Formato: tabela com e sem cada comportamento, com a base de cada linha.
- De onde vem: `stronix_leads.referredById` (consulta de campo único, ou lotes de 30 por id do indicador). `stronix_contratos` (`closedFromUpgrade`, `renewedFromId`, `cancelledAt`, `endsAt`, `planId`). `stronix_planos.modalityIds`, na versão de hoje. `stronix_aulas` com `scheduledFor` depois do `clienteSince`, com o tipo pelo `isAulaRecord`. As contas `renewalCohort` (`src/lib/operacional/renewal.js:62`) e `computeChurn` (`src/lib/operacional/base.js:256`).
- Desde quando: indicação desde 10/08/2026, upgrade desde 11/09/2026 e multimodalidade desde 16/07/2026. A renovação só se mede em contrato que já venceu, então as taxas ficam firmes em 2027.
- Viabilidade e prioridade: com ajuste, média. Responde se pedir indicação e oferecer upgrade também seguram o aluno, além de vender; nenhum relatório do catálogo cruza o comportamento depois da matrícula com renovação e cancelamento.
- Permissão e custo: gestor e dono como trava de tela; as regras deixam qualquer membro ler. Contratos sem leitura nova. Indicados numa consulta de campo único por `referredById`. Aulas dos clientes em lotes de 30 por `leadId`.
- Já existe em: nada parecido hoje. No catálogo, o R081 cruza renovação com o perfil e com a pessoa ter sido indicada; este cruza com o que o cliente faz depois de entrar.
- Conferência no código: ajustado. O que mudou:
  - Não está pronto. "Fez upgrade" é circular: com contrato vivo, fechar pelo Upgrade já é renovação ligada ao contrato atual. Quem fez upgrade renovou por definição, então a comparação só vale no ciclo seguinte ao do upgrade. E o `closedFromUpgrade` só existe desde 11/09/2026 (PR #199, merge `4c321d3`).
  - Plano de várias modalidades usa o `stronix_planos.modalityIds` de hoje (`src/views/settings/CatalogsSection.jsx:221-226`, desde 16/07/2026, `68c57fd`), não o do dia da venda. O contrato não guarda modalidade (`src/lib/contracts.js:157-181`).
  - "Indicou pelo menos 1" vem do `referredById` do indicado, desde 10/08/2026 (`28ad875`), e o vínculo pode ser desfeito (`src/lib/referralsWrites.js:35` e `74`). A base de clientes em memória não serve, porque os indicados em geral são leads e as listas do app são paginadas. Precisa de consulta própria: `where referredById in [ids]` em lotes de 30, ou `referredById != null`, as duas de campo único.
  - "Fez aula já sendo cliente" depende de `stronix_aulas`, com aula desde 16/07/2026 (`6a06f0f`) e visita desde 18/08/2026. O tipo é filtrado no navegador (`isAulaRecord`, registro em `src/lib/aulas.js:92-122`). Aula agendada para cliente não gera tarefa na Meta Diária.
  - Renovação e cancelamento só se medem em contrato que já venceu. Com contratos desde 30/06/2026 e upgrade desde 11/09/2026, as taxas por comportamento ficam firmes em 2027.
  - As coortes de julho e agosto têm o viés da importação: só o último contrato de cada pessoa foi importado (`src/lib/clientImport.js:245-252`).
  - Evidências: `src/views/KanbanView.jsx:1573-1582` (upgrade com contrato vivo vira renovação) e `src/lib/contracts.js:166-172` (`renewedFromId` e `closedFromUpgrade` no mesmo contrato).


### 5.7 Renovação e vencidos

Este domínio responde quem renova e quando, quem foi procurado em cada marco, quem venceu e não voltou, por que as pessoas recusam e quem volta depois de sair. O limite está no dado: contrato só existe no sistema desde 30/06/2026, e a recusa, o motivo e a etapa do Vencidos moram no lead como estado de agora, zerados quando sai um contrato novo. O motivo estruturado da recusa só existe desde 14/09/2026. A tolerância (`renewalGraceDays`) e os marcos (`renewalCheckpoints`) são os valores de hoje, aplicados também aos meses que já fecharam.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R086 | Renovação por coorte de vencimento | Alta | Pronto | Ajustado |
| R087 | Cobertura dos marcos de renovação | Alta | Com ajuste | Ajustado |
| R088 | Vencimentos a vir com lista nominal | Alta | Com ajuste | Ajustado |
| R089 | Fila de recuperação de vencidos | Alta | Com ajuste | Ajustado |
| R090 | Reconquista de ex-clientes | Média | Com ajuste | Ajustado |
| R091 | Motivos de não renovar e de não voltar | Alta | Com ajuste | Ajustado |
| R092 | Aumento e redução na renovação | Média | Com ajuste | Ajustado |
| R093 | Antecedência e encaixe da renovação | Baixa | Com ajuste | Ajustado |
| R094 | Passagem entre etapas do funil Vencidos | Baixa | Precisa gravar dado novo | Confirmado |
| R095 | Primeira renovação contra as seguintes | Baixa | Com ajuste | Ajustado |
| R096 | Recusas de renovação revertidas | Baixa | Com ajuste | Ajustado |

#### R086. Renovação por coorte de vencimento

Dos contratos que venceram no mês, quantos renovaram, quando (antes, no dia ou depois), quantos disseram que não e quantos sumiram?

- Para quem: dono, gestor e consultor.
- Recortes: mês de vencimento, dono atual, plano, duração.
- Números: taxa de renovação; renovou antes, no dia ou depois do vencimento; não vai renovar, por motivo; venceu sem renovar; pendentes.
- Filtros: mês, pessoa, plano, duração.
- Formato: funil de desfecho, com a tabela nominal exportável embaixo.
- De onde vem:
  - `stronix_contratos`: `endsAt`, `createdAt`, `startsAt`, `renewedFromId`, `cancelledAt`, `leadId`, `planId`/`planName`, `durationMonths`, `importBatchId`/`importSource`/`importedBy` e `pauses` (lidas por `normalizeContracts`).
  - `stronix_leads.consultantId`, o dono atual.
  - `stronix_leads.renewalDeclined`, `renewalDeclinedAt` e `renewalDeclineReason`. São estado e zeram no contrato novo.
  - `stronix_config/general.renewalGraceDays`, com o valor de hoje.
  - Sucessor é o contrato com `renewedFromId` apontando para este ou outro contrato da mesma pessoa criado até o fim mais a tolerância (`src/lib/operacional/renewal.js:38-52`).
- Desde quando: julho de 2026 para renovou e venceu, porque os contratos existem desde 30/06/2026 (merge do #123, `b2b0c9d`). Os meses anteriores a 04/09/2026 precisam de marca por causa dos importados. O motivo da recusa só a partir de 14/09/2026 (merge do #206, `08f4442`, commit `0f3237d`).
- Viabilidade e prioridade: pronto, prioridade alta. `renewalCohort` já devolve uma linha por contrato; o cuidado é que a recusa zera no contrato novo e a recusa desfeita some.
- Permissão e custo: todos os papéis veem tudo. As rules deixam qualquer membro ler contratos, leads e interações (`firestore.rules:79-95` e `229-236`), e no Operacional o filtro de pessoa começa em "todos" para qualquer papel (`src/lib/screenParams.js:93-97`). Mostrar só a carteira do consultor é padrão de tela, nunca trava. Custo baixo, mas não zero. Os contratos já estão em memória. O dono, a recusa e o motivo vêm do doc do lead, que o Operacional lê por id em lotes de 30, sempre do servidor, para os contratos que vencem na janela mais 91 dias (`src/hooks/useOperacionalSources.js:160-190`, `src/lib/operacional/queries.js:217-229`). O relatório pode reaproveitar a memória de sessão (`leadsPorIdDaSessao`) e paga essa leitura só na primeira abertura.
- Já existe em: Visão geral → Operacional, bloco Renovação.
- Conferência no código: ajustado. O que mudou:
  - O custo deixou de ser zero, pela leitura dos leads descrita acima.
  - "Não vai renovar" é estado atual do lead, não evento. `renewalDeclined`, `renewalDeclinedAt` e `renewalDeclineReason` são zerados no contrato novo (`src/lib/contracts.js:191-202`) e apagados pelo desfazer do board (`src/lib/renewalGoal.js:139-145`, `src/views/KanbanView.jsx:1015-1016`). Por isso um mês fechado muda depois: o "não vai renovar" vira "venceu sem renovar" quando a pessoa volta depois da tolerância ou quando a recusa é desfeita.
  - Motivo e data da recusa só existem desde 14/09/2026. Antes disso, e em toda recusa feita pelo board, o motivo sai como "Outro" (`src/lib/operacional/renewal.js:54-60`, `src/views/KanbanView.jsx:997`). A recusa sem data passa pelo corte `asOf` e conta até no comparativo pró-rata.
  - Os importados entram na coorte, porque `renewalCohort` não filtra `isImportedContract`. No escopo padrão, a importação traz vencidos até `renewalGraceDays` antes de 04/09/2026. No escopo "todos", traz vencidos e cancelados antigos (`src/lib/clientImport.js:314-335`). O cancelado importado grava `cancelledAt` igual a `endsAt` (`src/lib/clientImport.js:512`) e passa pelo filtro de cancelamento de `src/lib/operacional/renewal.js:68`. Com isso agosto de 2026 e os meses anteriores ganham "venceu sem renovar" que o sistema nunca acompanhou. É preciso marcar os meses anteriores à importação ou separar os importados.
  - Não há corte por carteira. "Consultor vê a própria carteira" só pode ser padrão de filtro.
  - A reativação feita no board de Vencidos nasce como matrícula, sem `renewedFromId` (`src/views/KanbanView.jsx:1573-1579`). Ela só conta como renovação se for criada até o fim do contrato mais a tolerância. Depois disso vira "venceu sem renovar" naquele mês, e o `renewalGraceDays` usado é o de hoje, aplicado ao passado.

#### R087. Cobertura dos marcos de renovação

Em cada marco (90, 60 e 30 dias), quantos clientes foram contatados, quem chegou sem contato e quem foi contatado renova mais?

- Para quem: gestor, consultor e dono.
- Recortes: marco, mês, dono atual.
- Números: chegaram ao marco, contatados, % de cobertura, taxa de renovação com contato e sem contato.
- Filtros: mês, pessoa, marco.
- Formato: tabela, com a lista de pendentes.
- De onde vem:
  - `stronix_contratos`: `endsAt`, `startsAt`, `createdAt`, `renewedFromId`, `leadId`, `pauses`.
  - `stronix_interactions` com `type` igual a `'daily_goal_done'` e `dailyGoalCategory` igual a `'renovacao'`, mais `leadId`, `createdAt` e `actorId`.
  - `stronix_config/general.renewalCheckpoints`, com o valor de hoje.
  - `stronix_leads.consultantId`, o dono atual.
- Desde quando: 23/07/2026, quando os marcos entraram em produção (merge do #157, `9be9e59`). Só para contratos a partir de 30/06/2026.
- Viabilidade e prioridade: com ajuste, prioridade alta. Os marcos de hoje são aplicados ao passado e reagendar conta como tratado.
- Permissão e custo: todos. Custo médio: as interações do mês por `createdAt`, consulta de campo único (`src/lib/operacional/queries.js:20`), mais as dos meses seguintes que o marco alcança (`src/lib/operacional/metrics.js:33-38`) e os leads por id para saber o dono.
- Já existe em: Visão geral → Operacional, "Contatos nos marcos" (`src/views/dashboard/MilestoneBars.jsx:13`).
- Conferência no código: ajustado. O que mudou:
  - `stronix_leads.renewalHandledCheckpoints` saiu das fontes. `milestones()` usa só os contratos e as interações `daily_goal_done` da categoria `'renovacao'` (`src/lib/operacional/renewal.js:149-182`). O marco é cruzado na data do fim do contrato menos os dias do marco, com o contrato vigente e sem sucessor nessa data. `renewalHandledCheckpoints` é estado e zera no contrato novo (`src/lib/contracts.js:195`), então não serve para o passado.
  - "Contatado" quer dizer tarefa de Renovação concluída na Meta Diária (`daily_goal_done`, de qualquer autor) ou sucessor criado dentro do intervalo do marco. Mensagem ou anotação comum não conta. A recusa pelo board também não, porque ela não grava interação (`src/views/KanbanView.jsx:997-1004`).
  - Reagendar grava `daily_goal_done` da categoria `'renovacao'` (`src/modals/RenewalOutcomeModal.jsx:150-162` e `170-178`). O marco reagendado aparece como contatado mesmo sem conversa conclusiva.
  - A taxa de renovação com e sem contato não sai pronta. `milestones()` devolve só o total e os feitos por marco. Falta uma versão linha a linha, cruzada com o desfecho de `renewalCohort`.
  - Os marcos usados são os de hoje. Mudar os marcos em Configurações → Metas & ritmo reescreve os meses fechados.
  - Um mês fechado depende das interações dos meses seguintes (`milestoneMonthsAfter`), o que aumenta a leitura.

#### R088. Vencimentos a vir com lista nominal

Quem vence nos próximos 30, 60, 90 ou 180 dias, quanto isso vale por mês e em que ponto está o contato?

- Para quem: gestor e consultor.
- Recortes: faixa de dias, dono atual, plano.
- Números: contratos, valor por mês em risco, contratos sem valor, marcos tratados, recusou, próximo contato.
- Filtros: faixa, pessoa, plano.
- Formato: tabela nominal exportável.
- De onde vem:
  - `stronix_contratos`: `endsAt`, `startsAt`, `value`, `durationMonths`, `leadId`, `leadName`, `planName`, `renewedFromId`, `pauses`.
  - `stronix_leads`: `consultantId`, `renewalHandledCheckpoints`, `renewalDeclined`, `nextFollowUp`, `nextFollowUpType`.
  - `stronix_config/general.renewalCheckpoints`.
- Desde quando: retrato de agora.
- Viabilidade e prioridade: com ajuste, prioridade alta. As contagens existem, a lista com valor e contato não.
- Permissão e custo: todos. O recorte pela própria carteira é padrão de tela, não regra: as rules liberam contratos para todo membro (`firestore.rules:229-236`). Custo baixo: contratos em memória e leads por id em lotes de 30, só dos contratos da faixa escolhida.
- Já existe em: Gerencial, "Vencendo 30/60/90"; Operacional, "A vencer"; e a lista de Clientes, que filtra por situação "A vencer" (pelo `contractThresholdDays`, fixo em 30 dias no código) e "Vencido", com nome (`src/views/ClientsView.jsx:23-24` e `40-47`). O que falta nela são as faixas de 60, 90 e 180 dias, o valor por mês e o estado do contato.
- Conferência no código: ajustado. O que mudou:
  - A lista de Clientes entrou em "Já existe em".
  - Duas regras de "vence" convivem. O Operacional (`upcomingExpirations`) usa o contrato mais recente da pessoa (`src/lib/operacional/renewal.js:185-202`). O Gerencial (`expiryHorizons`) tira do risco quem já tem sucessor (`src/lib/gerencial/risk.js:13-39`). O relatório segue a regra do Gerencial (quem renovou antes sai do risco) e diz isso na tela, senão os números não batem com nenhum dos dois cards.
  - Não dá para partir do lead pelo índice 4 da tabela da seção 7.3, de `currentContractEndsAt` (`src/lib/leadQueries.js:74-84`). O lead guarda só o contrato atual, e com contrato paralelo ou trancamento isso diverge dos contratos. O certo é partir dos contratos em memória e ler os leads por id em lotes de 30. O índice 13, a mesma chave em ordem decrescente, também não entra aqui.
  - Trancado fica fora: `contractStateAt` precisa dar `'vigente'` (`src/lib/operacional/base.js:122-131`). Contrato com `value` menor ou igual a zero entra na contagem e fica fora do dinheiro. O valor por mês é `value ÷ durationMonths`.
  - Marcos tratados, recusa e próximo contato são estado de agora, o que serve para um retrato. Os marcos são os de hoje.

#### R089. Fila de recuperação de vencidos

Quem venceu e não voltou, há quanto tempo, se ainda está na tolerância, quanto valia e em que etapa do funil Vencidos está?

- Para quem: gestor e consultor.
- Recortes: faixa de dias vencido, dentro ou fora da tolerância, etapa do Vencidos, recusou, dono atual, plano anterior.
- Números: clientes, valor mensal perdido, reativados por faixa.
- Filtros: pessoa, etapa, faixa.
- Formato: tabela nominal exportável.
- De onde vem:
  - `stronix_contratos`: `endsAt`, `cancelledAt`, `pauses`, `leadId`, `value`, `durationMonths`, `planName`, `createdAt`, `renewedFromId`.
  - `stronix_leads`: `reactivationStageId`, `renewalDeclined`, `renewalDeclineReason`, `consultantId`, `nextFollowUp`.
  - `stronix_config/general.renewalGraceDays`.
- Desde quando: vencimentos desde 30/06/2026. A etapa só como retrato de agora, desde 19/08/2026 (#184, `6cb32b5`).
- Viabilidade e prioridade: com ajuste, prioridade alta. O board inclui cancelado e trancado, então a fila tem de sair dos contratos e da janela de tolerância.
- Permissão e custo: todos. Custo baixo a médio: contratos em memória, mais leads por id em lotes de 30 dos vencidos sem sucessor. Cresce com a base de ex-clientes.
- Já existe em: Pipeline, funil Vencidos; Gerencial, "Já venceu".
- Conferência no código: ajustado. O que mudou:
  - Confirmado que o board inclui cancelado e trancado. A consulta é só `lifecycleBucket` igual a `'cliente'` com `currentContractEndsAt` antes de agora (`src/lib/leadQueries.js:100-108`), e a tela só separa quem recusou (`src/views/KanbanView.jsx:510-535`). `isExpiredClient`, que tiraria esses casos, existe e fica sem uso no board (`src/lib/expiredGoal.js:47-52`).
  - O card "Já venceu" do Gerencial também não serve de molde. `expiredWithoutSuccessor` só tira quem tem `cancelledAt` (`src/lib/gerencial/risk.js:42-48`), então o trancado com pausa aberta e `endsAt` passado entra na conta. O relatório precisa usar `contractStateAt`/`hasOpenPause` e o estado da pessoa, porque um contrato paralelo vigente tira a pessoa da fila.
  - A etapa do Vencidos (`reactivationStageId`) é estado. O arrasto grava sem data, por `updateDoc` (`src/views/KanbanView.jsx:913-914`), e o contrato novo zera o campo (`src/lib/contracts.js:202`). Então "reativados por etapa" não existe, e "reativados por faixa" tem de sair dos contratos, casando por pessoa. A reativação pelo board nasce como matrícula, sem `renewedFromId` (`src/views/KanbanView.jsx:1573-1579`).
  - A consulta de leads pelo índice 13 da tabela da seção 7.3 (`currentContractEndsAt` decrescente) não tem limite para trás, porque o funil é permanente, e cresce com todo cliente que já venceu. É melhor partir dos contratos em memória e ler os leads por id em lotes de 30. Não é custo zero.
  - A tolerância é o `renewalGraceDays` de hoje. O cliente legado sem contrato fica de fora. Os importados vencidos recentes entram.

#### R090. Reconquista de ex-clientes

Quantos ex-clientes voltam, depois de quanto tempo fora, por qual valor e por mérito de quem, e quem ainda pode voltar?

- Para quem: dono, gestor e consultor.
- Recortes: mês da saída ou da volta, via (vencido ou cancelado), tempo fora, consultor da volta, último plano, motivo da saída.
- Números: % que voltou em 15, 30, 60 e 90 dias; tempo médio fora; ticket na volta contra o anterior; ex-clientes em aberto.
- Filtros: período, pessoa.
- Formato: coorte, com a lista nominal.
- De onde vem:
  - `stronix_contratos`: `leadId`, `endsAt`, `cancelledAt`, `cancelReason`, `createdAt`, `startsAt`, `value`, `durationMonths`, `planName`, `consultantId`, `renewedFromId`, `importBatchId`.
  - `stronix_interactions` com `renewalOutcome` igual a `'declined'` e `renewalDeclineReason`, para o motivo de quem venceu.
  - `stronix_config/general.renewalGraceDays`.
- Desde quando: saídas desde julho de 2026 (contratos desde 30/06/2026). As janelas de 90 dias só fecham para saídas com mais de 90 dias.
- Viabilidade e prioridade: com ajuste, prioridade média. É preciso agrupar por pessoa, porque a reativação é gravada como renovação ou como matrícula conforme a tela.
- Permissão e custo: todos os papéis podem ler. "Gestor e dono" seria só trava de tela, e dono é o admin. Custo zero para a coorte: contratos em memória, com `leadName` e `consultantName` no próprio contrato. Baixo para a lista de ex-clientes em aberto, que lê os leads por id para saber o dono atual.
- Já existe em: Gerencial, tipo "retorno" no mix de venda (`src/lib/gerencial/scope.js:23-34`), e o passo "Voltaram" da Ponte do Operacional, que conta os retornos do mês (`src/lib/operacional/base.js:203-224`).
- Conferência no código: ajustado. O que mudou:
  - "Já existe em" ganhou o passo "Voltaram" da Ponte do Operacional.
  - O motivo da saída só vale para cancelamento: `cancelReason`, lista fixa desde 28/07/2026 (`src/lib/contracts.js:36-45`, commit `c2685a2`). Para quem venceu, `renewalDeclineReason` fica no lead e é zerado justamente quando a pessoa volta (`src/lib/contracts.js:196-198`). Só a interação da Meta guarda o motivo, e só desde 14/09/2026. Quem saiu pelo board fica com "Outro".
  - O cancelamento gravado pela importação (`cancelFromImport`, com `cancelledAt` igual a `endsAt`) não é saída e precisa sair da conta (`src/lib/operacional/base.js:63-69`).
  - "Voltou" e "renovou" precisam ficar separados. Um contrato criado até o fim mais a tolerância é renovação pela coorte. Retorno só conta depois da tolerância ou depois de um cancelamento, senão o relatório conta a mesma coisa duas vezes.
  - A reativação é matrícula pelo board e renovação pela Meta (`src/views/KanbanView.jsx:1573-1579`, `src/views/DailyGoalView.jsx:1870-1876`). Na ficha, quem decide é o contrato vivo (`src/views/LeadProfileView.jsx:339`). O consultor da volta é o dono do lead na hora da venda (`src/lib/contracts.js:179-181`).
  - As taxas de 15, 30, 60 e 90 dias só fecham para saídas mais antigas que a janela. Com contratos desde 30/06/2026, as primeiras saídas são de julho, e em 24/09/2026 nenhuma tem a janela de 90 dias fechada. As primeiras fecham a partir de 29/09/2026, para quem saiu em 01/07.
  - "Dono" não é papel separado: só existem admin e consultant, e as rules liberam os contratos para todo membro.

#### R091. Motivos de não renovar e de não voltar

Por que os clientes recusam renovar ou voltar, e isso muda com o tempo?

- Para quem: dono e gestor.
- Recortes: mês, motivo, variante (renovação ou vencido), consultor, plano.
- Números: recusas, % por motivo.
- Filtros: período, pessoa.
- Formato: ranking, com a evolução mês a mês.
- De onde vem:
  - `stronix_interactions` com `type` igual a `'note'` e `renewalOutcome` igual a `'declined'`: `renewalDeclineReason`, `actorId`, `createdAt`, `leadId`.
  - `stronix_interactions` com `type` igual a `'daily_goal_done'` e `dailyGoalCategory` igual a `'renovacao'` ou `'vencido'`, para saber a variante.
  - `stronix_leads.renewalDeclined`, `renewalDeclinedAt` e `renewalDeclineReason`, para as recusas feitas pelo board e as que ainda valem.
- Desde quando: motivo estruturado desde 14/09/2026 (merge do #206, `08f4442`; o commit `0f3237d` é de 12/09). De 23/07 a 14/09/2026 a nota trazia só texto livre ("Motivo da perda de renovação: ...").
- Viabilidade e prioridade: com ajuste, prioridade alta. Ler da interação preserva os ciclos antigos, mas a recusa pelo board grava "Outro" sem evento.
- Permissão e custo: gestor e dono, como trava de tela; as rules deixam qualquer membro ler leads e interações (`firestore.rules:79-95`). Custo baixo: `where('renewalOutcome','==','declined')` e `where('renewalDeclined','==',true)`, consultas de campo único, sem índice composto.
- Já existe em: Visão geral → Operacional, "Motivos de quem não vai renovar" (`src/views/dashboard/DashboardOperacionalView.jsx:607`), agrupado pela coorte de vencimento e não pela data da recusa.
- Conferência no código: ajustado. O que mudou:
  - O início do motivo estruturado passou de 12/09 (data do commit) para 14/09/2026 (merge).
  - A nota da recusa não diz a variante: o texto é o mesmo para renovação e vencido. A variante só aparece na interação `daily_goal_done` gravada logo depois, num batch separado, com `dailyGoalCategory` igual a `'renovacao'` ou `'vencido'` (`src/modals/RenewalOutcomeModal.jsx:150-162`; a variante vencido em `60-69`). É preciso casar as duas por lead e horário.
  - Ler só das interações perde toda recusa feita pelo board (Renovações e Vencidos), que só faz `updateDoc` com "Outro" (`src/views/KanbanView.jsx:929-930` e `997-1004`). Ler só do lead perde a recusa de quem renovou depois ou teve a recusa desfeita. O relatório junta as duas fontes e marca que o "Outro" do board não é motivo.
  - "Consultor" pode ser quem registrou a recusa (`actorId` da nota, `src/lib/interactions.js:26-43`) ou o dono atual do lead. O relatório precisa dizer qual dos dois.

#### R092. Aumento e redução na renovação

Quem renova passa a pagar mais ou menos por mês, e migra para plano mais longo?

- Para quem: dono e gestor.
- Recortes: mês, consultor, plano anterior para plano novo, desconto e motivo do desconto.
- Números: variação % do ticket mensal, valor mensal a mais ou a menos (valor de contrato, não caixa), % que aumentou a duração, % que trocou de plano.
- Filtros: período, pessoa.
- Formato: tabela.
- De onde vem: `stronix_contratos`: `renewedFromId`, `value`, `listValue`, `durationMonths`, `planId`, `planName`, `discountMode`, `discountValue`, `discountReason`, `consultantId`, `createdAt`.
- Desde quando: contratos desde 30/06/2026; desconto com motivo desde 28/07/2026.
- Viabilidade e prioridade: com ajuste, prioridade média. O selo Upgrade do modal não é gravado, então a conta é derivada.
- Permissão e custo: gestor e dono, como trava de tela (as rules liberam contratos para todo membro, `firestore.rules:229-236`). Custo zero: os contratos já estão em memória.
- Já existe em: nada parecido hoje. O modal de contrato calcula um selo Upgrade na hora da venda e não grava (`src/modals/ContractModal.jsx:234-235` e `562`).
- Conferência no código: ajustado. O que mudou:
  - Só entra a renovação ligada por `renewedFromId` (`src/lib/contracts.js:157-170`). A reativação pelo board de Vencidos e a matrícula de volta pela ficha não ligam ao contrato anterior. Para incluir quem volta, o relatório tem de casar por pessoa.
  - O contrato anterior importado costuma não ter valor (os 494 importados da STRONIX estão com valor zero), e `durationMonths` pode ser nulo no importado (`src/lib/clientImport.js:496-509`). Os pares sem valor saem da variação e aparecem contados à parte (`hasValue` e ticket mensal em `src/lib/gerencial/scope.js:11-21`).
  - O ticket mensal (`value ÷ durationMonths`) fica distorcido nos planos que guardam preço mensal no lugar do total (Shape One).
  - O desconto da renovação (`discountMode`, `discountValue`, `discountReason`) é gravado desde 28/07/2026 (`src/modals/ContractModal.jsx:197-202`) e explica parte da redução. Por isso entrou nos recortes.
  - O plano pode ter mudado de preço desde a venda. A comparação usa `value` e `durationMonths` do contrato, não o catálogo.

#### R093. Antecedência e encaixe da renovação

Com quantos dias de antecedência a pessoa renova, e quantos dias ficam sem contrato ou com dois contratos sobrepostos?

- Para quem: gestor.
- Recortes: mês, consultor, plano.
- Números: dias entre o fechamento e o fim do contrato anterior, % de emenda perfeita, dias de lacuna, dias sobrepostos.
- Filtros: período.
- Formato: histograma.
- De onde vem: `stronix_contratos`: `renewedFromId`, `createdAt`, `startsAt`, `endsAt`, `pauses` (via `normalizeContracts`), `consultantId`, `planName`.
- Desde quando: antecedência desde 30/06/2026. Encaixe desde 28/07/2026, quando o modal passou a sugerir a emenda (commit `c2685a2`, merge `ba774dc` do #162).
- Viabilidade e prioridade: com ajuste, prioridade baixa. `computeSeam` já calcula o encaixe (`src/lib/renewal.js:38-54`).
- Permissão e custo: gestor, como trava de tela. Custo zero.
- Já existe em: Operacional, "Quando renovou" (`src/views/dashboard/RenewalOutcomeBar.jsx:70`), que separa antes, no dia e depois.
- Conferência no código: ajustado. O que mudou:
  - O `endsAt` do contrato anterior pode mudar depois. A reativação de um trancado empurra o fim, e a correção reescreve o contrato (`src/lib/contracts.js:326-400`). O encaixe medido depois pode não ser o que o consultor viu na hora.
  - Renovação fechada com o anterior ainda trancado: `normalizeContracts` fecha a pausa no início do sucessor e move o fim em memória (`src/lib/operacional/base.js:100-116`). O encaixe desses casos não tem sentido e precisa sair ou aparecer à parte.
  - Antes de 28/07/2026 o modal sugeria começar hoje, o que gerava sobreposição por padrão. Os dados de 30/06 a 28/07 existem, mas mostram o padrão antigo e não a decisão da pessoa. A renovação não reescreve o contrato anterior, então a sobreposição fica gravada (`src/lib/contractsWrites.js:88-120`).
  - Só a renovação ligada por `renewedFromId` tem par definido.

#### R094. Passagem entre etapas do funil Vencidos

Quanto tempo o cliente vencido fica em cada etapa, e quantos avançam?

- Para quem: gestor.
- Recortes: etapa, consultor, mês.
- Números: tempo médio por etapa, conversão entre etapas.
- Filtros: período.
- Formato: funil.
- De onde vem: `stronix_leads.reactivationStageId` e um evento novo de movimento no Vencidos, que ainda não existe.
- Desde quando: a partir de quando o evento começar a ser gravado.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. O arrasto só faz `updateDoc`, sem data.
- Permissão e custo: gestor, como trava de tela. Custo baixo.
- Já existe em: nada parecido hoje.
- Conferência no código: confirmado.
  - `moveExpiredToStage` só faz `updateDoc` com `reactivationStageId`, sem interação e sem data (`src/views/KanbanView.jsx:902-920`). A recusa no Vencidos também não deixa evento (`src/views/KanbanView.jsx:922-936`).
  - A entrada no funil é derivada, e só o primeiro arrasto grava a etapa (`src/lib/expiredFunnel.js:119-125`). O contrato novo zera a etapa (`src/lib/contracts.js:202`).
  - O Upgrade serve de molde: ele grava `logInteraction` com `status_change` em cada movimento (`src/views/KanbanView.jsx:942-959`).
  - Para quem for implementar: a data de entrada pode sair do `endsAt` do contrato. Se o evento novo for `status_change` com `funnelId`, o CRM já tira os funis de sistema de "Todos os funis" (`src/lib/crm/scope.js:25-37`).

#### R095. Primeira renovação contra as seguintes

A primeira renovação é a mais difícil? Quanto renova quem está no primeiro contrato, no segundo e do terceiro em diante?

- Para quem: dono e gestor.
- Recortes: número do ciclo (1º contrato, 2º, 3º ou mais), plano e duração, dono atual, mês de vencimento.
- Números: contratos que venceram, renovaram, taxa de renovação por ciclo, renovou antes, no dia ou depois.
- Filtros: importados fora do primeiro ciclo (o primeiro contrato no sistema pode não ser o primeiro da pessoa), tolerância de vencidos.
- Formato: tabela de três linhas (1º, 2º, 3º ou mais) por mês de vencimento, mais a linha "ciclo desconhecido".
- De onde vem:
  - `stronix_contratos`: `leadId` (para ordenar por pessoa), `renewedFromId`, `createdAt`, `startsAt`, `endsAt`, `importBatchId`, `planName`, `durationMonths`.
  - `stronix_leads`: `clienteSince`, `consultantId`.
  - A coorte de `renewalCohort` (`src/lib/operacional/renewal.js:62`).
- Desde quando: contratos desde 30/06/2026. Por enquanto só os planos mensais e trimestrais têm ciclos completos.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Se a primeira renovação for o gargalo, o marco de 30 dias do primeiro contrato pede um cuidado diferente dos demais.
- Permissão e custo: dono e gestor, como trava de tela. Custo baixo: leads por id em lotes de 30, reaproveitando a memória de sessão do Operacional (`src/hooks/useOperacionalSources.js:160-190`).
- Já existe em: o bloco Renovação do Operacional mede a coorte sem separar o ciclo. No catálogo, o R086 (renovação por coorte, sem ciclo) e o R074 (renovações por cliente, sem a taxa por ciclo) chegam perto. Nenhum dá a taxa por ciclo.
- Conferência no código: ajustado. O que mudou:
  - A cadeia por `renewedFromId` se quebra na reativação feita como matrícula, pelo board de Vencidos ou pela ficha sem contrato vivo (`src/views/KanbanView.jsx:1573-1579`). Para numerar o ciclo é preciso ordenar os contratos da pessoa (`index.byPerson`, `src/lib/operacional/base.js:165-175`), não só seguir a cadeia. O contrato paralelo precisa de uma regra própria.
  - O custo deixou de ser "nenhuma leitura nova": `clienteSince` e o dono atual moram no lead.
  - Nem sempre o primeiro contrato no sistema é o primeiro da pessoa. A importação grava `clienteSince` como o mais cedo entre o cadastro, o início na planilha e o início do contrato (`src/lib/clientImport.js:626` e `647`). O cliente legado que virou cliente antes de 30/06/2026 sem contrato também tem `clienteSince` anterior ao primeiro contrato, porque o campo é carimbado uma vez só (`src/lib/contracts.js:221`, `src/lib/contractsWrites.js:116`). Os dois casos vão para "ciclo desconhecido", não para "1º".
  - O "antes, no dia, depois" e a tolerância seguem `renewalCohort` (`src/lib/operacional/renewal.js:38-52` e `62-89`), com o `renewalGraceDays` de hoje.

#### R096. Recusas de renovação revertidas

Quem disse que não ia renovar ou voltar acabou renovando ou voltando? Em quanto tempo, com qual motivo de recusa e com quem?

- Para quem: gestor e dono.
- Recortes: motivo da recusa, variante (renovação ou vencido), quem registrou a recusa, consultor que fechou depois, mês da recusa.
- Números: recusas, revertidas, % revertida, dias entre a recusa e o contrato novo.
- Filtros: só recusas registradas pela Meta, porque as do board não deixam interação.
- Formato: tabela por motivo com a taxa de reversão, mais a lista nominal.
- De onde vem:
  - `stronix_interactions` com `type` igual a `'note'` e `renewalOutcome` igual a `'declined'`: `renewalDeclineReason`, `actorId`, `createdAt`, `leadId`.
  - `stronix_interactions` com `type` igual a `'daily_goal_done'` e `dailyGoalCategory`, para a variante.
  - `stronix_contratos`: `leadId`, `createdAt` e `consultantId` dos contratos posteriores à recusa.
- Desde quando: motivo estruturado desde 14/09/2026. De 23/07 a 14/09/2026, só texto livre.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Mostra se vale insistir em quem recusou e com qual motivo a insistência funciona.
- Permissão e custo: gestor e dono, como trava de tela (contratos legíveis por qualquer membro, `firestore.rules:229-236`). Custo baixo: consulta de campo único por `renewalOutcome` igual a `'declined'`, com poucos documentos; os contratos não pedem leitura nova.
- Já existe em: nada parecido hoje. No catálogo, o R091 conta recusas por motivo e o R086 conta quem recusou, mas nenhum diz quantas recusas viraram venda. A recusa feita pelo board fica só no lead e é zerada no contrato novo (`src/lib/contracts.js:191-208`), então essa parte some.
- Conferência no código: ajustado. O que mudou:
  - O motivo estruturado está em produção desde 14/09/2026 (merge `08f4442` do #206), não desde 12/09.
  - A variante (renovação ou vencido) não está na nota da recusa. Ela sai da `daily_goal_done` gravada logo depois, com `dailyGoalCategory` igual a `'renovacao'` ou `'vencido'`, casada por lead e horário (`src/modals/RenewalOutcomeModal.jsx:150-162`; `actorId`, `createdAt` e `leadId` em `src/lib/interactions.js:26-43`).
  - "Revertida" tem de ser definida por contrato criado depois da recusa com o mesmo `leadId`, e não pelo estado do lead. O contrato novo zera a recusa no lead (`src/lib/contracts.js:191-202`), e o desfazer do board apaga a recusa sem deixar evento (`src/views/KanbanView.jsx:929-930`, `997-1004` e `1015-1016`).


### 5.8 Upgrade

Este domínio responde quanto a academia vende a mais para quem já é cliente: quem entrou no funil Upgrade, quem fechou, quem recusou e quem ainda poderia comprar. O funil só existe desde 11/09/2026 (merge da PR #199), então o histórico tem menos de duas semanas. Entrada, troca de etapa e recusa ficam gravadas só como texto na linha do tempo. E a marca de "fechou pelo Upgrade" vale para qualquer contrato feito enquanto o cliente estava no funil, até renovação do mesmo plano.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R097 | Funil Upgrade | Média | Com ajuste | Ajustado |
| R098 | Clientes com potencial de upgrade | Média | Com ajuste | Ajustado |

#### R097. Funil Upgrade

Quantos clientes entram no Upgrade, quantos fecham, quantos recusam e por quê, em quanto tempo, de qual plano para qual e com quanto a mais por mês?

- Para quem: dono, gestor e consultor.
- Recortes: mês, consultor, etapa, plano de origem para plano novo, motivo da recusa. A pessoa muda conforme o número. No fechado é o `consultantId` do contrato, que é o dono do lead na hora da venda (`src/lib/contracts.js:179-181`). Na entrada e na recusa é o `actorId` da interação, quem clicou. Em "em negociação agora" é o `consultantId` do lead hoje.
- Números: entradas, fechados, recusas, conversão, dias até fechar, aumento no valor mensal do contrato, em negociação agora.
- Filtros: período, pessoa, etapa.
- Formato: funil, com a tabela nominal embaixo.
- De onde vem:
  - `stronix_interactions` com `type` igual a `'status_change'` e texto começando com "Upgrade: entrou na etapa", "Upgrade: movido para a etapa" ou "Upgrade: não quis. Motivo:", mais `createdAt`, `leadId` e `actorId`.
  - `stronix_contratos`: `closedFromUpgrade`, `planId`, `planName`, `value`, `durationMonths`, `createdAt`, `consultantId`, `leadId`, `imported`.
  - Plano de origem: `stronix_contratos.renewedFromId` quando havia contrato vivo. Sem contrato vivo, o contrato anterior do mesmo `leadId`.
  - `stronix_leads.upgradeStageId` e `consultantId`, só para "em negociação agora" e para a etapa atual.
  - `stronix_leads.upgradeEnteredAt`, só para o tempo parado de quem está no funil hoje.
  - `stronix_leads.upgradeDeclinedAt`, que guarda só a última recusa.
  - `stronix_loss_reasons`, o catálogo de motivos, para agrupar o texto da recusa.
- Desde quando: 11/09/2026, merge da PR #199 (`4c321d3`). Antes disso não havia funil Upgrade nem `closedFromUpgrade` (o campo entrou no código em 08/09/2026, commit `c0d9d72`). Contrato antigo, sem o campo, conta como não-upgrade. O aumento mensal só sai quando o contrato de origem tem valor maior que zero.
- Viabilidade e prioridade: com ajuste, prioridade média. É a segunda entrega do Upgrade, que ficou para depois, e entrada e motivo só existem no texto, com `upgradeEnteredAt` zerado no desfecho.
- Permissão e custo: todos. As rules deixam qualquer membro ler leads, interações e contratos (`firestore.rules:79-95` e `218-242`), então não precisa de regra nova. Custo moderado. O Firestore não filtra por começo de texto, por isso o relatório lê todas as interações da janela por `createdAt` (a consulta de campo único do mês, `src/hooks/monthSources.js:71`) e separa as do Upgrade no navegador. É a mesma carga de meses que o Operacional e o CRM já fazem. Para "dias até fechar", a janela tem que ir até a data de entrada, que pode estar em outro mês. Contratos já chegam na assinatura do login, sem leitura nova. "Em negociação agora" usa `upgradeClientsQuerySpec` (`src/lib/leadQueries.js:119-122`), de campo único e sem índice composto. Numa academia de 2 a 3 mil leads, fica dentro do que o Operacional já lê.
- Já existe em: o número da aba Upgrade no Pipeline (`src/views/KanbanView.jsx:742-748`), o card Upgrades do Operacional, que conta vendas pelo funil (`src/views/dashboard/DashboardOperacionalView.jsx:230-244`), e a fatia Upgrade no mix de vendas do Gerencial (`src/views/dashboard/SoldHeroCard.jsx:34`), que só mostra o upgrade que não virou renovação. Nenhum deles mostra entrada, recusa, motivo ou tempo até fechar.
- Conferência no código: ajustado. O que mudou em relação ao rascunho:
  - `upgradeEnteredAt` não serve para contar entradas nem para "dias até fechar". Ele é zerado quando sai qualquer contrato novo (`src/lib/contracts.js:206-207`), na recusa (`src/lib/stageMove.js:139`) e na importação (`src/lib/clientImport.js:551-552` e `:644`). Só vale para quem está no funil agora.
  - Entrada, troca de etapa e recusa com data só existem como interação `status_change` com texto (`src/lib/stageMove.js:128-140`), gravada por `logInteraction` com `createdAt`, `actorId` e `leadId` (`src/lib/interactions.js:30-43`). Não há `fromStatus`, `toStatus` nem `funnelId` nessas interações, então o relatório vai ler texto. Hoje o único leitor desse texto é o `UPGRADE_EVENT_RE` da linha do tempo (`src/lib/timeline.js:66-70`). Quando a troca é feita pela ficha, o texto ainda ganha " Obs: ..." no fim (`src/views/LeadProfileView.jsx:358-360`).
  - O motivo da recusa não é campo. Sai do mesmo catálogo de motivos de perda de lead, `stronix_loss_reasons`, pelo `LossReasonModal` (`src/modals/LossReasonModal.jsx:6-20`; `src/views/KanbanView.jsx:1146` e `1169-1171`; `src/views/LeadProfileView.jsx:2010`). Com o catálogo vazio, grava "Sem motivo configurado". Renomear um motivo não reescreve o texto antigo.
  - `upgradeDeclinedAt` é estado, não evento. Guarda só a última recusa e não é zerado por contrato novo nem por reentrada no funil. Só dois lugares escrevem nele (`src/views/KanbanView.jsx:973` e `src/views/LeadProfileView.jsx:289`). Recusas por mês têm que vir das interações.
  - `closedFromUpgrade` é `Boolean(lead.upgradeStageId)` na hora de qualquer contrato novo (`src/lib/contracts.js:174`). Se alguém parado no Upgrade renova pela ficha, pelo funil Renovações ou pelo Vencidos, o contrato conta como upgrade, mesmo com o mesmo plano. O relatório precisa avisar isso ou comparar os planos para separar quem fechou com plano maior.
  - Tem saída sem evento. A importação tira o cliente do funil (`src/lib/clientImport.js:644`) sem interação "Upgrade:" e com `closedFromUpgrade` falso (`src/lib/clientImport.js:520-522`). Fica uma entrada sem desfecho. Só acontece pelo super console.
  - Plano de origem: com contrato vivo, o fechamento é renovação e `renewedFromId` aponta o contrato de origem (`src/views/KanbanView.jsx:1578-1582`; `src/modals/ContractModal.jsx:197`). Sem contrato vivo, `renewedFromId` fica nulo e a origem é o contrato anterior do mesmo `leadId` por `createdAt`. Na renovação, o contrato novo é emendado no fim do atual (`seamStart`, `src/modals/ContractModal.jsx:105`), então o valor novo só passa a valer quando o antigo acaba.
  - Aumento mensal: `value ÷ durationMonths` dos dois contratos. Se o contrato de origem é importado sem valor (`value <= 0`), o aumento fica indeterminado e não pode virar número. A diferença é valor de contrato por mês, não dinheiro que entrou.
  - Não pode somar ao total de vendas. No mix do Gerencial, o upgrade com contrato vivo vira renovação (`src/lib/gerencial/scope.js:23-34`). O Operacional conta todo `closedFromUpgrade` como Upgrade, pelo vendedor do contrato (`src/lib/operacional/base.js:296-311`). É o mesmo contrato visto de dois jeitos.
  - A conversão precisa dizer se é por safra (entradas do mês que fecharam até agora) ou por período (fechados no mês ÷ entradas no mês). Para "dias até fechar", o contrato `closedFromUpgrade` se liga à última interação "Upgrade: entrou" do mesmo `leadId` anterior ao `createdAt` do contrato. Quem sai e volta ao funil tem vários ciclos.

#### R098. Clientes com potencial de upgrade

Quais clientes ativos têm plano de uma modalidade só, mostraram interesse em outra no cadastro, fizeram aula de outra modalidade ou estão em plano curto, e ainda não passaram pelo funil Upgrade?

- Para quem: gestor e consultor.
- Recortes: modalidade do plano atual, modalidade de interesse do cadastro, duração do plano, tempo de casa, dono atual, recusou upgrade nos últimos N dias.
- Números: clientes candidatos, valor por mês atual, aulas de outra modalidade feitas, lista nominal.
- Filtros: fora do funil Upgrade (`upgradeStageId` vazio), sem recusa recente (`upgradeDeclinedAt`), contrato vigente. Falta decidir o trancado: ele fica na carteira, mas está parado, então o natural é deixar fora da fila de oferta ou mostrar à parte.
- Formato: lista nominal exportável, com a ação de levar o cliente ao funil Upgrade, mais a contagem por modalidade.
- De onde vem:
  - `stronix_contratos`: todos os contratos vigentes da pessoa (`leadId`, `planId`, `value`, `durationMonths`, `startsAt`, `endsAt`, `status`, `pausedAt`, `imported`), com a situação tirada das datas.
  - `stronix_planos`: `modalityIds` (com `modalityId` de reserva) e `durationMonths`, traduzidos para nome pelo catálogo de modalidades.
  - `stronix_leads`: `lifecycleBucket` igual a `'cliente'`, `modalidade`, `clienteSince`, `upgradeStageId`, `upgradeDeclinedAt`, `consultantId`.
  - `stronix_aulas`: registros de aula (`isAulaRecord`), `leadId`, `modality`, `status` igual a `'attended'`, `scheduledFor`.
- Desde quando: modalidades no plano desde 16/07/2026 (commit `2497364`). Funil Upgrade e recusa desde 11/09/2026. Aula com desfecho no registro só nos casos em que a gravação dupla pegou. Contratos desde junho de 2026. Cliente importado vem sem modalidade de interesse e às vezes sem `planId`.
- Viabilidade e prioridade: com ajuste, prioridade média. Hoje o funil Upgrade só recebe quem alguém lembrou de colocar, e esta lista vira a fila de trabalho do consultor.
- Permissão e custo: todos. O recorte "minha carteira" do consultor é padrão de tela (`consultantId` do lead hoje), não trava de segurança, porque as rules deixam qualquer membro ler leads, contratos e aulas (`firestore.rules:79-95`). A lista exportável segue a regra do CSV e não põe nome no endereço. Contratos e planos não custam leitura nova (chegam na assinatura do login). Clientes vêm pelo balde `'cliente'`, a mesma carga da tela Clientes. As aulas de cliente pedem uma leitura nova: por `scheduledFor` numa janela definida, com o filtro de cliente no navegador, ou por `leadId` em lotes de 30. As duas são de campo único, sem índice composto novo. Não existe hoje janela de aulas de cliente já carregada, porque `useAulasInWindow` e `useCrmSources` leem por mês ou por período.
- Já existe em: nada parecido hoje. O Pipeline mostra só quem já está no funil (`src/lib/leadQueries.js:119-122`). No catálogo, o R097 (quem já entrou no Upgrade), o R044 (aula de cliente que vira venda) e o R052 (mix vendido) medem o que já aconteceu, e nenhum aponta quem ainda pode comprar.
- Conferência no código: ajustado. O que mudou em relação ao rascunho:
  - A modalidade de interesse é o nome, gravado em `stronix_leads.modalidade` (`src/modals/AddLeadModal.jsx:466`, editável em `src/modals/ClientRegistrationModal.jsx:198`). O plano guarda ids em `modalityIds`, com `modalityId` antigo de reserva (`src/lib/planos.js:7-10`). A comparação passa pelo catálogo de modalidades (`planModalityNames`). Renomear a modalidade atualiza só o lead.
  - A modalidade de interesse fica nula para cliente importado (`src/lib/clientImport.js:610`) e é opcional no link público (`api/tenant-resolve.js:192` e `276`). E é o interesse do dia do cadastro de lead, que ninguém atualiza depois da matrícula.
  - "Plano de uma modalidade só" não pode olhar só `currentContractId` ou `currentPlanName` do lead. Contrato paralelo é permitido, e a pessoa pode ter dois contratos vigentes de modalidades diferentes, como musculação e pilates. É preciso juntar todos os contratos vigentes do mesmo `leadId` antes de dizer que ela tem uma modalidade só.
  - Contrato importado pode ter `planId` nulo quando o plano da planilha não casou (`src/lib/clientImport.js:506`). Aí a modalidade é desconhecida e o cliente não entra como candidato de uma modalidade só.
  - "Contrato vigente" sai das datas (`deriveContractStatus`), não do campo `status`. Para o sistema, trancado conta como contrato vivo (`hasLiveContract`, `src/lib/contracts.js:109-114`), por isso a decisão sobre o trancado precisa ser explícita no filtro.
  - "Aulas de outra modalidade feitas" são registros de `stronix_aulas` com `status` igual a `'attended'` (`src/lib/aulas.js:5`) e `modality` diferente da do plano. O desfecho só chega ao registro por `applyOutcomeToAula`, sem garantia, e só quando a data do registro bate com a do compromisso atual do lead (`src/lib/aulasWrites.js:84-101`; `src/lib/appointmentOutcome.js:106-110`). Aula de cliente sem desfecho marcado fica como "agendada" e não conta. A modalidade da aula também é nome (`src/lib/aulasWrites.js:21`).
  - `upgradeDeclinedAt` guarda só a última recusa e nunca é zerado (`src/views/KanbanView.jsx:973`; `src/views/LeadProfileView.jsx:289`). Para "sem recusa recente" ele serve, porque o que importa é a última.
  - "Fora do funil Upgrade" como `upgradeStageId` vazio está certo: só dois caminhos gravam o campo e contrato novo zera (`src/lib/contracts.js:206`).
  - Tempo de casa vem de `clienteSince`, carimbado só na primeira matrícula (`src/lib/contracts.js:219-221`). Cliente de antes de 30/06/2026 ou importado pode não ter o campo, e aí a conta cai no `startsAt` do contrato mais antigo.


### 5.9 Equipe e rotina

Este domínio responde como a equipe trabalha no dia a dia: quem bate a Meta Diária, quanto prospecta, quem deixa contato atrasar, quanto o lead novo espera pelo primeiro contato e como a carteira está dividida entre as pessoas. O limite do dado aparece em quase todo relatório. Quem fez a ação só é gravado desde 13/07/2026, e a presença marcada pela Agenda do dia continua sem autor até hoje. O dono do lead é sempre o de hoje, e atraso, próximo contato e dono são estado sobrescrito, sem histórico, então vários relatórios só passam a existir a partir de uma gravação nova.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R099 | Placar mensal por consultor | Alta | Com ajuste | Ajustado |
| R100 | Produção por pessoa | Alta | Com ajuste | Ajustado |
| R101 | Prospecção contra a cota | Alta | Com ajuste | Ajustado |
| R102 | Constância da Meta Diária | Alta | Com ajuste | Ajustado |
| R103 | Tarefas da Meta concluídas por categoria | Média | Pronto | Ajustado |
| R104 | Cumprimento da carteira do dia | Média | Precisa gravar dado novo | Ajustado |
| R105 | Atrasados agora por consultor | Alta | Pronto | Ajustado |
| R106 | Evolução dos atrasados | Média | Precisa gravar dado novo | Ajustado |
| R107 | Tempo até o primeiro contato | Alta | Pronto | Ajustado |
| R108 | Tempo de resposta no WhatsApp | Média | Precisa gravar dado novo | Ajustado |
| R109 | Conversas registradas por canal | Média | Com ajuste | Ajustado |
| R110 | Desfecho dos contatos da Meta | Média | Com ajuste | Ajustado |
| R111 | Leads empurrados | Média | Com ajuste | Ajustado |
| R112 | Pontualidade do follow-up | Baixa | Com ajuste | Ajustado |
| R113 | Carteira sem toque | Alta | Com ajuste | Ajustado |
| R114 | Leads sem próximo passo | Alta | Pronto | Ajustado |
| R115 | Agenda futura e carga por pessoa | Média | Com ajuste | Ajustado |
| R116 | Tarefas de contato delegadas | Baixa | Com ajuste | Ajustado |
| R117 | Trocas de responsável | Média | Com ajuste | Ajustado |
| R118 | Carteira por pessoa e carteira órfã | Média | Com ajuste | Ajustado |
| R119 | Carteira do consultor numa data passada | Baixa | Precisa gravar dado novo | Ajustado |
| R120 | Quem cobre quem | Baixa | Com ajuste | Ajustado |
| R121 | Horário de trabalho e aderência ao turno | Média | Com ajuste | Ajustado |
| R122 | Uso do sistema por pessoa | Baixa | Precisa gravar dado novo | Ajustado |
| R123 | Quadro da equipe e vagas do plano | Baixa | Com ajuste | Ajustado |
| R124 | Rampa do consultor novo | Baixa | Com ajuste | Ajustado |
| R125 | Entradas e saídas da equipe | Baixa | Precisa gravar dado novo | Ajustado |
| R126 | Convites da equipe | Baixa | Com ajuste | Ajustado |
| R127 | Gestor contra consultores | Baixa | Com ajuste | Ajustado |
| R128 | Cobrança do gestor e resultado | Baixa | Precisa gravar dado novo | Ajustado |
| R129 | Cobertura da tarefa Novo 24h | Baixa | Com ajuste | Ajustado |
| R130 | Extrato de atendimento de um lead | Baixa | Pronto | Ajustado |
| R131 | Plantão do digital | Média | Precisa gravar dado novo | Ajustado |
| R132 | Resultado das ligações e mensagens | Baixa | Precisa gravar dado novo | Ajustado |
| R133 | Evolução do consultor mês a mês | Média | Com ajuste | Ajustado |

#### R099. Placar mensal por consultor

Como cada pessoa foi no mês ou na semana, numa tabela só: leads, contatos, agendados, comparecimento, matrículas, valor, meta, prospecção, renovação e upgrades?

- Para quem: dono, gestor e consultor.
- Recortes: pessoa, mês ou semana.
- Números: meta %, prospecção %, leads, agendados, comparecimento, matrículas, conversão, ticket, taxa de renovação, upgrades e perdas por motivo. Cada coluna diz de quem é o número. Leads, agendados, comparecimento, matrículas, conversão e perdas são do dono de hoje. Valor, ticket e upgrades são do consultor gravado no contrato na hora da venda. A renovação é do dono atual do cliente.
- Filtros: período e funil. O funil só recorta as colunas do CRM, e a tabela precisa mostrar quais colunas obedecem ao filtro.
- Formato: tabela exportável, com comparativo.
- De onde vem:
  - `metricsOf` do Operacional por pessoa: meta, prospecção, tarefas e renovação, pelo dono atual.
  - `metricsOf` do CRM com `userId` e `funnelId`: leads, agendados, comparecimento, matrículas, conversão e perdas, pelo dono atual.
  - `salesOf` e `sellersOf` do Gerencial: valor, ticket e upgrades, por `stronix_contratos.consultantId`, fora os importados.
- Desde quando: cada coluna começa numa data. Meta desde 03/06/2026, completa desde 14/09/2026 (PR #206). Prospecção desde 19/06/2026, com autor real desde 13/07/2026. Venda e ticket desde junho de 2026. Agendamento e comparecimento completos desde setembro de 2026. Passagem entre etapas desde 14/09/2026, 18h10. Categoria Renovação na Meta desde 30/06/2026.
- Viabilidade e prioridade: com ajuste, prioridade alta. Junta numa folha só os indicadores da Parte 9 do playbook comercial; falta ordenar, ver por semana e exportar.
- Permissão e custo: todos veem todos, pelas rules e pela lista de usuários, que o consultor também recebe inteira numa leitura por sessão (`src/App.jsx:843-852`). O consultor abrir em si mesmo é só o padrão da tela. No mês não há leitura nova: CRM e Operacional dividem `src/hooks/monthSources.js`, e os contratos já chegam pela assinatura do login. A semana pede um parâmetro de janela novo nos três `metricsOf`.
- Já existe em: Operacional, tabela Equipe no mês (`src/views/dashboard/TeamMonthTable.jsx:131-135`); CRM, Conversão por pessoa (`src/views/dashboard/PeopleConversionTable.jsx:108`); Gerencial, Quem vendeu (`src/views/dashboard/SellerRankTable.jsx:46`).
- Conferência no código: ajustado. O que mudou:
  - Os três `metricsOf` só recebem `monthKey` (`src/lib/operacional/metrics.js:92`, `src/lib/crm/metrics.js:93`, `src/lib/gerencial/metrics.js:52`). A semana não sai deles. E na safra do CRM, que agrupa por mês de cadastro, trocar mês por semana muda a definição da medida.
  - O filtro de funil só existe no CRM (`funnelId` em `src/lib/crm/metrics.js:93`). Operacional e Gerencial não recortam por funil. Aplicado à linha inteira, o filtro mistura colunas recortadas com colunas que o ignoram.
  - A mesma linha mistura três atribuições: dono de hoje no CRM (`src/lib/crm/scope.js:50-63`), consultor do contrato na venda (`src/lib/contracts.js:175-181`, `src/lib/gerencial/people.js:34-53`) e dono atual do cliente na renovação (`src/lib/operacional/renewal.js:13-15`). Depois de uma transferência a soma da linha não fecha.
  - "Perdas por motivo" conta só quem está em Perda hoje, com `lostAt` no período (`src/lib/crm/cohort.js:80-91`). Perda desfeita some do mês em que aconteceu.
  - As datas de início de cada coluna são diferentes (`src/lib/crm/scope.js:11-24`), como listado em "Desde quando".
  - A coleção de contratos é `stronix_contratos` (`src/lib/firebase.js:164`), e não `stronix_contracts`, como estava no rascunho.

#### R100. Produção por pessoa

Quantas ações cada pessoa registrou por dia, semana e mês, de que tipo e em quais leads?

- Para quem: dono, gestor e consultor.
- Recortes: autor; dia, semana ou mês; tipo de ação.
- Números: interações, interações por tipo, dias com ação, média por dia de meta.
- Filtros: período, pessoa, tipo.
- Formato: barras por dia, mais um extrato exportável.
- De onde vem: `stronix_interactions`: `actorAuthUid` (na falta, `leadConsultantAuthUid`, pelo `interactionOwnerAuthUid`), `type`, `volumeKind`, `dailyGoalCategory`, `createdAt` e `leadName` (desde 30/07/2026). Saem da conta a importação, as notas sem `leadId`, a troca de responsável e os eventos do link público.
- Desde quando: interações desde 29/04/2026, mas com autor real só desde 13/07/2026 (PR #137). A presença marcada pela Agenda do dia ou pelo atalho de Aulas e Visitas continua creditada ao dono do lead até hoje.
- Viabilidade e prioridade: com ajuste, prioridade alta. O `classifyInteraction` já classifica; falta tirar importação e notas sem lead.
- Permissão e custo: todo membro lê todas as interações (`firestore.rules:90-91`); o consultor ver só a própria é trava de tela. Interações do mês por `createdAt` (`interactionsInMonthSpec`, campo único, sem índice), que o Operacional já carrega. Uma série longa lê um mês por vez e reaproveita a memória de sessão de `src/hooks/monthSources.js`.
- Já existe em: Operacional, Tarefas concluídas por tipo.
- Conferência no código: ajustado. O que mudou:
  - O `actorAuthUid` só é gravado por `logInteraction` (`src/lib/interactions.js:39-40`) e pelos caminhos de contrato, indicação, importação de clientes, `TransferLeadsTab` e `ReferralOwnersSection`. O desfecho de presença pela Agenda do dia grava `daily_goal_done` e `status_change` sem autor (`src/lib/appointmentOutcome.js:113-133`). A presença marcada ali por um colega vai para o dono do lead. Pela Meta, o desfecho passa por `logInteraction` e leva o autor.
  - Algumas ações não geram interação e ficam fora: a recusa de Vencidos pelo board (`src/views/KanbanView.jsx:922-935`, só `updateDoc`), mover card do funil Vencidos (`src/views/KanbanView.jsx:913`) e o botão de WhatsApp rápido da ficha (`src/views/LeadProfileView.jsx:208-212`).
  - Além da importação, é preciso tirar a troca de responsável (`status_change` "Responsável alterado", `src/lib/crm/contact.js:11-12`, com o gestor como autor na migração em massa, `src/views/settings/TransferLeadsTab.jsx:171`) e os eventos do link público, com `actorAuthUid` nulo (`api/tenant-resolve.js:235`, `308` e `323`).
  - O `leadName` na interação só existe desde 30/07/2026 (PR #165, `src/lib/interactions.js:36`). Antes disso, "em quais leads" depende de ler o lead pelo id, com leitura extra quando ele está fora da base ativa.
  - Antes de 13/07/2026 (commit `9824a66`, PR #137) o autor é o dono do lead, não quem agiu.
  - Excluir um lead apaga todas as interações dele (`src/views/LeadProfileView.jsx:222-233`). A produção de meses fechados pode cair depois.

#### R101. Prospecção contra a cota

Cada consultor fez as ações de prospecção combinadas, de que tipo, e em que dias ficou abaixo?

- Para quem: gestor e consultor.
- Recortes: pessoa, dia, tipo (lead novo, visita, aula, mensagem, ligação).
- Números: ações, cota, % do alvo, dias abaixo, composição em %.
- Filtros: período, pessoa.
- Formato: barras diárias com a linha do alvo.
- De onde vem: `stronix_interactions.volumeKind`, `actorAuthUid` (na falta, `leadConsultantAuthUid`) e `createdAt`; `stronix_leads.createdAt`, `consultantId`, `referralVia`, `importBatchId` e `source`; `stronix_users.dailyVolumeTarget` e `stronix_config.general.metaWeekdays`, os dois com o valor de hoje.
- Desde quando: 19/06/2026, quando o `volumeKind` entrou na main (commit `8c13cdb`, PR #111). Autor real dos agendamentos desde 13/07/2026.
- Viabilidade e prioridade: com ajuste, prioridade alta. O `prospectionSummary` faz a conta, mas aplica o alvo de hoje ao passado e o lead novo segue o dono atual.
- Permissão e custo: todos. Custo médio: interações e leads criados no mês, os dois por `createdAt` de campo único, que o Operacional já carrega.
- Já existe em: Operacional, Prospecção; Meta Diária, prospecção.
- Conferência no código: ajustado. O que mudou:
  - O `prospectionSummary` não separa por tipo (`src/lib/operacional/routine.js:105-131`). A composição pede agrupar por `volumeKind`. O ajuste é pequeno, mas o relatório não está pronto.
  - O alvo é o `dailyVolumeTarget` de hoje (`volumeTargetFor`, `src/lib/dailyGoal.js:251-255`). O `volumeTarget` do histórico só é gravado quando o dia batido sai pela Meta Diária aberta com alvo maior que zero (`src/views/DailyGoalView.jsx:1165`, `src/lib/dailyGoalHistory.js:17`), e o caminho do `src/App.jsx:1439` grava sem ele. Não existe alvo histórico confiável.
  - Lead novo conta para o `consultantId` atual (`src/lib/operacional/routine.js:116`), em qualquer balde. O lead do link público conta como prospecção do consultor herdado do indicador, sem ação dele (`api/tenant-resolve.js:267` e `283-285`, `referralVia` igual a `'link'`). Separar ou tirar da conta.
  - Ação feita em dia fora de `metaWeekdays` some (`src/lib/operacional/routine.js:106-107`), e `metaWeekdays` é a configuração de hoje, sem versão.
  - O reagendamento de renovação não grava `volumeKind` (`src/modals/RenewalOutcomeModal.jsx:173-177`) e não entra, o que está coerente com a regra. O reagendamento de contato e de atrasado entra (`src/modals/ContactOutcomeModal.jsx:101-114`).

#### R102. Constância da Meta Diária

Quem bate a meta com regularidade, em que dias da semana falha, qual a maior sequência e quantos dias perfeitos teve?

- Para quem: dono, gestor e consultor.
- Recortes: pessoa, mês, dia da semana.
- Números: dias batidos, dias de meta, % batido, maior sequência, dias perfeitos.
- Filtros: período, pessoa.
- Formato: calendário, mais tabela.
- De onde vem: `stronix_daily_goal_history.consultantId` e `date`; `stronix_config.general.metaWeekdays` (valor de hoje). Para o dia perfeito, o `prospectionSummary` do dia (interações com `volumeKind` e leads criados) contra `stronix_users.dailyVolumeTarget`.
- Desde quando: 03/06/2026 (commit `237257d`, merge da PR #67). Até 14/09/2026 (PR #206, commit `75400c9` de 12/09/2026) o dia só era gravado com a Meta Diária aberta, então subconta. Depois disso ainda depende de a pessoa abrir o app no dia.
- Viabilidade e prioridade: com ajuste, prioridade alta. O histórico foi desenhado para ser a base deste relatório; o denominador conta feriado e férias.
- Permissão e custo: todos. Custo baixo: histórico por mês (`goalHistoryInMonthSpec`, `src/lib/operacional/queries.js:29-35`).
- Já existe em: Operacional, Dias de meta; Meta Diária, Ritmo do mês.
- Conferência no código: ajustado. O que mudou:
  - Dia perfeito não sai do histórico. `volumeCount` e `volumeTarget` só são gravados com a Meta Diária aberta e alvo maior que zero (`src/views/DailyGoalView.jsx:1165`, `src/lib/dailyGoalHistory.js:17`), e o `src/App.jsx:1439` grava o dia sem volume. É preciso cruzar o dia batido com o `prospectionSummary` do dia, e essa conta usa o alvo de hoje.
  - A maior sequência histórica não existe como função. O streak de `src/lib/dailyGoal.js:486-497` anda para trás a partir de hoje. Precisa de uma conta nova sobre o histórico, ajuste pequeno.
  - O denominador sai do `metaWeekdays` de hoje e conta feriado, férias e os dias antes de a pessoa entrar. Dia sem nenhuma tarefa nunca é gravado (`goalHitKeyToRecord`, `src/lib/dailyGoalHistory.js:31`) e conta como não batido.
  - Mesmo depois de 14/09/2026, o dia só é gravado se a pessoa estiver com o app aberto e a base carregada depois de zerar as pendências (`src/App.jsx:1426-1439`). Se um colega fecha a última tarefa pela Agenda do dia e a pessoa não abre o app, o dia fica sem registro.
  - O histórico é imutável (`firestore.rules:206-217`). Tarefa que aparece depois de bater não desfaz o dia.

#### R103. Tarefas da Meta concluídas por categoria

Que tipo de tarefa cada pessoa fecha, e quantas por dia?

- Para quem: gestor e consultor.
- Recortes: autor; dia ou mês; categoria.
- Números: tarefas concluídas, média por dia de meta, participação em %.
- Filtros: período, pessoa.
- Formato: barras empilhadas.
- De onde vem: `stronix_interactions` com `type` igual a `daily_goal_done`, mais `dailyGoalCategory`, `actorAuthUid` (na falta, `leadConsultantAuthUid`) e `createdAt`.
- Desde quando: 14/05/2026 (merge `c4af763`, PR #11). Renovação desde 30/06/2026 e vencido desde 17/08/2026 (PR #174). Autor real desde 13/07/2026, fora a presença pela Agenda do dia e pelo atalho de Aulas e Visitas.
- Viabilidade e prioridade: pronto, prioridade média. O `tasksByType` aceita qualquer janela; é só o numerador.
- Permissão e custo: todos. Custo médio.
- Já existe em: Operacional, Tarefas concluídas por tipo (`src/views/dashboard/DashboardOperacionalView.jsx:116-129`).
- Conferência no código: ajustado. O que mudou:
  - A data da Renovação estava errada. A categoria entrou na main com a PR #123, em 30/06/2026 (merge `b2b0c9d`), e não em 23/06/2026, que é a data do commit `89df3e9` no branch.
  - A conclusão pela Agenda do dia e pelo atalho grava `daily_goal_done` sem `actorAuthUid` (`src/lib/appointmentOutcome.js:112-122`) e credita o dono do lead. Antes de 13/07/2026, isso vale para todas as conclusões.
  - Venda ou Perda no dia fecha a tarefa sem `daily_goal_done` (`src/lib/dailyGoal.js:309-316`). O relatório conta menos que a Meta, e isso precisa estar escrito na tela.
  - O adiamento ("Contato adiado para amanhã") é uma nota sem `dailyGoalCategory` (`src/views/DailyGoalView.jsx:1175-1176`). Tira a tarefa do dia sem contar como concluída.
  - A média por dia usa dias de meta, igual ao resto do Operacional. Duas pessoas no mesmo lead contam duas vezes (`src/lib/operacional/routine.js:164-171`).

#### R104. Cumprimento da carteira do dia

No dia X, quantas tarefas cada pessoa tinha, de que categoria, quantas fez e quais ficaram?

- Para quem: gestor e dono.
- Recortes: pessoa, dia, categoria.
- Números: tarefas devidas, feitas, pendentes no fim do dia, % cumprido.
- Filtros: período, pessoa.
- Formato: tabela por dia.
- De onde vem: uma foto diária da carteira por pessoa, numa coleção nova com id `pessoa_dia`, gravada no molde do dia batido ou por um job no servidor; `stronix_interactions.dailyGoalCategory` para as feitas.
- Desde quando: a partir da gravação. O passado não se recupera.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. É o pedido adiado da visão do gestor (PR 2).
- Permissão e custo: gestor na tela; pelas rules, qualquer membro leria. A coleção nova precisa de regra. Depois de gravado, a leitura é baixa (um documento por pessoa por dia). Um job no servidor leria uma vez por dia os leads ativos e as interações do dia da academia inteira.
- Já existe em: Meta Diária → Equipe, só o dia corrente.
- Conferência no código: ajustado. O que mudou:
  - O dado não existe, e o adiamento está confirmado: a spec da visão do gestor põe "Guardar tarefas de dias passados" fora do escopo, para a PR 2 (`docs/superpowers/specs/2026-07-28-visao-gestor-profundidade-design.md:320-322`).
  - Faltava dizer quem grava a foto. O cálculo das tarefas (`computeDailyGoalSlots`) mora em `src/lib/dailyGoal.js`, que importa `lucide-react` (linha 1) e não roda em `api/`. Um job de fim de dia no servidor exige tirar essa lógica para um módulo puro, mais uma vaga de função (11 de 12 em uso) ou uma action numa função que já existe, e cron na Vercel. Hoje o `vercel.json:1-5` só tem rewrites.
  - Se a foto for gravada pelo navegador de cada pessoa, no molde do dia batido (`src/App.jsx:1426-1439`), ela só pega o estado da última vez em que a pessoa estava com o app aberto. Não é o fim do dia, e sem sessão no dia não há foto.
  - Coleção nova precisa de `match` nas `firestore.rules`, publicado à mão. A regra do histórico de meta só deixa gravar o documento da própria pessoa (`firestore.rules:208-210`).

#### R105. Atrasados agora por consultor

Quem tem contato vencido agora, há quantos dias, e quantos já passaram do prazo de atraso da academia?

- Para quem: gestor e consultor.
- Recortes: dono, faixa de dias, funil, etapa, tipo de contato.
- Números: atrasados, críticos (atraso ≥ `slaOverdueDays`), atraso médio e máximo.
- Filtros: pessoa, funil.
- Formato: tabela nominal exportável.
- De onde vem: `stronix_leads.nextFollowUp`, `nextFollowUpType`, `consultantId`, `status` e `funnelId`; `stronix_config.general.slaOverdueDays` (valor de hoje).
- Desde quando: retrato de agora.
- Viabilidade e prioridade: pronto, prioridade alta. O `overdueNow` faz a conta; falta a lista exportável.
- Permissão e custo: todos; o consultor vê a própria por padrão de tela. Custo zero: vem da assinatura dos leads ativos (`src/App.jsx:822`).
- Já existe em: Operacional, Atrasados agora (`src/views/dashboard/DashboardOperacionalView.jsx:179-195`); Leads, filtro Em atraso, com outro corte de horário (ver abaixo).
- Conferência no código: ajustado. O que mudou:
  - O critério não é o mesmo do filtro Em atraso da tela de Leads. O `overdueNow` corta no início de hoje (`src/lib/operacional/routine.js:180-186`), igual à Meta. A tela de Leads corta em agora (`src/views/LeadsView.jsx:92`). Os dois números divergem para quem tem contato marcado para hoje mais cedo.
  - A lista inclui visita ou aula que já passou, porque agendar também grava `nextFollowUp` (`src/lib/schedulePatch.js:34`). O tipo sai de `nextFollowUpType` e pode ser visita ou aula, não só mensagem ou ligação.
  - Contato delegado (`nextFollowUpOwnerId`) que atrasa fica com o dono do lead (`src/lib/dailyGoal.js:298-303`). Está coerente com a Meta, mas precisa estar escrito.
  - A lista exportável leva nome e telefone. O CSV neutraliza fórmula, como já faz a tela de Leads (`src/views/LeadsView.jsx:127-146`), e nada disso vai para o endereço.

#### R106. Evolução dos atrasados

A fila de atrasados está crescendo ou diminuindo semana a semana?

- Para quem: gestor e dono.
- Recortes: pessoa, dia.
- Números: atrasados no fim do dia, críticos, resolvidos no dia.
- Filtros: período, pessoa.
- Formato: evolução diária.
- De onde vem: a mesma foto diária do R104; `stronix_interactions.dailyGoalCategory` igual a `atrasado`; `stronix_interactions.text` para o adiamento, que não tem categoria.
- Desde quando: resolvidos desde 14/05/2026, com autor real desde 13/07/2026. O estoque de atrasados só a partir da foto.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. Atraso só existe como estado atual.
- Permissão e custo: gestor. Custo baixo depois de gravado.
- Já existe em: nada parecido hoje. O Operacional só mostra os atrasados de agora (R105).
- Conferência no código: ajustado. O que mudou:
  - O estoque não tem como ser reconstruído, porque `nextFollowUp` é sobrescrito. A foto deve ser a mesma gravação do R104, não uma segunda, e herda os mesmos problemas de quem grava e quando.
  - "Resolvidos no dia" pela categoria atrasado conta menos. O adiamento é uma nota sem categoria (`src/views/DailyGoalView.jsx:1175-1176`), e Venda ou Perda fecham a tarefa sem `daily_goal_done` (`src/lib/dailyGoal.js:309-316`). O autor da conclusão só existe desde 13/07/2026.
  - Desde 24/07/2026 (PR #159, merge `a5d5f9b`) o atrasado passa pelo `ContactOutcomeModal`, que grava "contato feito" ou "reagendado" no texto (`src/modals/ContactOutcomeModal.jsx:87-114`). Antes o fluxo era outro, então o texto não se compara entre os dois períodos.

#### R107. Tempo até o primeiro contato

Quanto tempo o lead novo espera pelo primeiro contato, quantos passam de 30 minutos, 1 hora e 24 horas, por consultor, origem e hora de chegada?

- Para quem: dono, gestor e consultor.
- Recortes: safra, dono, origem, dia da semana e hora do cadastro, funil.
- Números: mediana, até 30 minutos, até 1 hora, até 24 horas, sem contato, e conversa de verdade contra primeira ação qualquer.
- Filtros: período, pessoa, origem, funil.
- Formato: faixas empilhadas, mais a mediana com comparativo.
- De onde vem: `stronix_leads.createdAt`, `consultantId`, `source` e `funnelId`; `stronix_interactions.createdAt`, `type` e `text`. O texto serve para tirar a observação do cadastro e a troca de responsável, e para achar a conversa pelos prefixos "Mensagem WhatsApp enviada:" e "Ligação:" do composer da ficha.
- Desde quando: interações desde 29/04/2026, e a tela vai até 12 meses para trás. Conversa marcada só desde 14/05/2026 (commit `c6c2eda`) e só pelo composer da ficha.
- Viabilidade e prioridade: pronto, prioridade alta, com um ajuste pequeno na faixa de 30 minutos. O playbook pede 30 minutos, e hoje contato é qualquer interação, até troca de etapa.
- Permissão e custo: todos. Custo médio: interações do mês e do mês seguinte.
- Já existe em: Visão geral → CRM, Tempo até o primeiro contato (`src/views/dashboard/SpeedCards.jsx:31-40`).
- Conferência no código: ajustado. O que mudou:
  - O `firstContactOf` só tem as faixas até 1 hora, até 24 horas, mais de 24 horas e sem contato (`src/lib/crm/contact.js:54-61`). A faixa de 30 minutos precisa ser acrescentada. O valor em minutos já existe.
  - A conversa de verdade só se reconhece pelo prefixo do composer (`src/views/LeadProfileView.jsx:610` e `628`; `src/lib/timeline.js:77`), desde 14/05/2026. O "Contato feito" da Meta não grava canal (`src/modals/ContactOutcomeModal.jsx:91-95`), e o WhatsApp do Stronizap não chega ao CRM até a Parte B. A medida sai parcial e conta a menos.
  - O primeiro contato vale de qualquer autor e inclui troca de etapa, conclusão de tarefa e adiamento (`src/lib/crm/contact.js:17-21`). Pessoa e funil são os de hoje (`src/lib/crm/scope.js:50-69`).
  - A tela navega só 12 meses para trás (`src/lib/screenParams.js`). Antes de 13/07/2026 não dá para separar quem fez o contato. Lead excluído leva as interações junto.
  - A origem é o texto atual do lead. Renomear uma origem no catálogo reescreve os leads.

#### R108. Tempo de resposta no WhatsApp

Quando o lead manda mensagem, quanto a academia demora para responder, e quem está esperando agora?

- Para quem: dono, gestor e consultor.
- Recortes: pessoa, hora, dia da semana, número conhecido ou não.
- Números: mediana de resposta, % respondido em 15 minutos, 1 hora e 24 horas, esperando agora, mensagens enviadas e recebidas.
- Filtros: período, pessoa.
- Formato: mediana com comparativo, mais a fila de quem espera.
- De onde vem: os eventos de mensagem do Stronizap, que só chegam com a Parte B (`direction`, `actor`, `createdAt`, `leadId`); `stronix_leads.awaitingReplySince`, só para o retrato de agora; a fila de leads a confirmar, para número desconhecido.
- Desde quando: a partir da Parte B. O passado não se recupera.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. Resolve a Meta autodeclarada; a Parte B está desenhada e ainda sem plano.
- Permissão e custo: gestor na tela; pelas rules, qualquer membro lê (`firestore.rules:90-91`). Custo alto se as mensagens entrarem em `stronix_interactions`, porque inflam a carga mensal dos painéis. Baixo com coleção ou contador à parte. Pela spec, o POST entra no mesmo `api/zap.js`, sem gastar vaga de função.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O custo não é baixo. Pela spec da Parte B, cada mensagem, de entrada ou de saída, vira uma interação (`docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md:124-148`). O Operacional e o CRM carregam todas as interações do mês (`interactionsInMonthSpec`, `src/lib/operacional/queries.js:20`), então o volume de WhatsApp multiplica a leitura desses painéis. É preciso guardar as mensagens à parte ou tirá-las da carga dos painéis.
  - Mensagem de número desconhecido vira uma entrada na fila de leads a confirmar, e não interação. Os eventos só chegam depois que o lead é criado, com teto de 50 (spec, linhas 158-172). O tempo de resposta a desconhecido depende da fila.
  - "Esperando agora" sai de `awaitingReplySince`, que é estado e é sobrescrito (spec, linhas 148 e 213). Para série histórica, só os eventos com data servem.

#### R109. Conversas registradas por canal

Quantas mensagens e ligações cada pessoa registrou por dia, e em quantos leads?

- Para quem: gestor e consultor.
- Recortes: pessoa, dia, canal.
- Números: mensagens, ligações, leads diferentes tocados.
- Filtros: período, pessoa.
- Formato: barras diárias.
- De onde vem: `stronix_interactions.text` com os prefixos "Mensagem WhatsApp enviada:" e "Ligação:" em notas (`type` igual a `note`); `actorAuthUid` (na falta, `leadConsultantAuthUid`); `leadId`; `createdAt`.
- Desde quando: 14/05/2026, com o composer da ficha (commit `c6c2eda`). Autor real desde 13/07/2026.
- Viabilidade e prioridade: com ajuste, prioridade média. Só o composer marca o canal; Instagram e presencial precisam de um campo de canal.
- Permissão e custo: todos. Custo médio.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Só o composer da ficha deixa o canal no texto (`src/views/LeadProfileView.jsx:610` e `628`). O "Contato feito" da Meta, o botão de WhatsApp rápido da ficha (`src/views/LeadProfileView.jsx:208-212`) e o Stronizap não deixam. O relatório mede o registro pelo composer, não a conversa.
  - A "mensagem" do composer quer dizer que o link do WhatsApp foi aberto e a nota gravada (`src/views/LeadProfileView.jsx:605-612`). Não há confirmação de envio.
  - Não confundir com `volumeKind` igual a `'mensagem'` ou `'ligacao'`. Esse campo marca o próximo contato agendado (`src/lib/contactGoal.js:18-21`, `src/views/DailyGoalView.jsx:1352`), não uma conversa feita.
  - Antes de 13/07/2026 o autor é o dono do lead. Lead excluído leva as interações junto.

#### R110. Desfecho dos contatos da Meta

Quando chega o contato do dia, a pessoa resolve, reagenda ou adia, por qual motivo, e quem mais adia?

- Para quem: gestor e consultor.
- Recortes: pessoa, categoria, mês, motivo do reagendamento.
- Números: contato feito, reagendado, adiado para amanhã, não vai renovar, % resolvido na primeira vez.
- Filtros: período, pessoa.
- Formato: barras empilhadas.
- De onde vem: `stronix_interactions.type` (`daily_goal_done` e `note`); `dailyGoalCategory`; `text` ("contato feito", "contato reagendado para", "Contato adiado para amanhã", "Motivo do reagendamento"); `rescheduledFor`, só no reagendamento de contato e de atrasado; `renewalOutcome` e `renewalDeclineReason`, desde 14/09/2026.
- Desde quando: contato e renovação desde 23/07/2026 (PR #157). Atrasado no fluxo novo desde 24/07/2026 (PR #159). Motivo de não renovar em campo desde 14/09/2026. Adiamento desde 29/04/2026 (commit `3318b3c`), sem categoria.
- Viabilidade e prioridade: com ajuste, prioridade média. Adiar tira a tarefa do denominador, e o motivo é texto livre.
- Permissão e custo: gestor na tela; pelas rules, qualquer membro lê tudo. Custo médio.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Quase tudo sai do texto, não de campo. "Contato feito" e "reagendado", no contato e no atrasado, estão só no texto do `daily_goal_done` (`src/modals/ContactOutcomeModal.jsx:91-114`). Só o reagendamento de contato leva `rescheduledFor`. O reagendamento de renovação não leva nem `rescheduledFor` nem `volumeKind` (`src/modals/RenewalOutcomeModal.jsx:173-177`).
  - O `renewalOutcome` igual a `'declined'` e o `renewalDeclineReason` só existem desde 14/09/2026 (commit `0f3237d`, merge da PR #206; `src/modals/RenewalOutcomeModal.jsx:152-157`). Entre 23/07/2026 e essa data, só o texto "Motivo da perda de renovação". A recusa pelo board não grava interação nenhuma (`src/views/KanbanView.jsx:922-935`).
  - O adiamento é uma nota sem `dailyGoalCategory` (`src/views/DailyGoalView.jsx:1175-1176`). Dá para contar por pessoa, não por categoria. O motivo do reagendamento é texto livre, numa nota separada do `daily_goal_done`, e precisa ser pareado por lead e instante.
  - O atrasado só passou a usar o `ContactOutcomeModal` em 24/07/2026. Antes, o fluxo antigo gravava outro texto, que começava por "concluída" e trazia o próximo contato (`src/views/DailyGoalView.jsx:1368-1372`).
  - O "% resolvido na primeira vez" pede montar a cadeia de reagendamentos de cada lead nas interações. Não existe função pronta.

#### R111. Leads empurrados

Quais leads só são reagendados, sem avançar de etapa?

- Para quem: gestor e consultor.
- Recortes: lead, dono, etapa atual.
- Números: reagendamentos, dias desde o primeiro, se houve troca de etapa depois.
- Filtros: pessoa, mínimo de reagendamentos.
- Formato: tabela nominal.
- De onde vem:
  - `stronix_interactions.rescheduledFor`, na Meta Diária e no popup de contato.
  - `stronix_interactions.volumeKind`, no agendamento pela ficha, desde 19/06/2026.
  - `stronix_interactions.appointmentOutcome` igual a `'rescheduled'`, na remarcação de visita ou aula de um dia para outro.
  - `stronix_interactions.text`, para separar "contato reagendado" do próximo contato marcado depois de um contato feito, e para achar o "Contato adiado para amanhã".
  - `stronix_interactions.toStatus` com `type` igual a `status_change`, desde 14/09/2026. Antes, o texto "Fase alterada para".
  - `stronix_leads.status`, `consultantId` e `lifecycleBucket` igual a `'ativo'`.
- Desde quando: Meta Diária desde 14/05/2026 (commit `4e223da`); ficha desde 19/06/2026 (`volumeKind`). Separar reagendamento sem conversa de próximo contato depois de contato feito, só pelo texto. Etapa estruturada desde 14/09/2026, 18h10 (commit `69bc22c`).
- Viabilidade e prioridade: com ajuste, prioridade média. Mostra quem está enrolando a carteira.
- Permissão e custo: gestor e consultor. Custo médio: leads ativos e interações do mês já estão na memória (`src/App.jsx:679`); meses anteriores pedem `getDocs` por `createdAt`, campo único, sem índice composto.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `rescheduledFor` não é gravado em todo caminho que remarca. Grava na Meta Diária (próximo contato em `src/views/DailyGoalView.jsx:1379`, remarcar visita ou aula em `:1511`) e no `ContactOutcomeModal` (`src/modals/ContactOutcomeModal.jsx:112`). Não grava no agendamento pela ficha (`src/views/LeadProfileView.jsx:575-584`, só nota com `volumeKind` e a data no texto), no reagendamento de renovação (`src/modals/RenewalOutcomeModal.jsx:165-177`) e no adiar para amanhã (`src/views/DailyGoalView.jsx:1170-1187`).
  - O `rescheduledFor` mistura avanço com enrolação. O `commitNextContact` (`src/views/DailyGoalView.jsx:1341-1380`) grava o campo quando o contato foi feito e o próximo foi marcado. O `handleReschedule` grava também o ajuste de horário no mesmo dia e a nova tentativa depois do "Não veio" (`:1432-1436` e `:1498-1520`). Só a remarcação de visita ou aula para outro dia leva `appointmentOutcome: 'rescheduled'` (`:1519`). O "Reagendar" do contato sem conversa só se separa pelo texto "contato reagendado para" (`src/modals/ContactOutcomeModal.jsx:108`).
  - O `volumeKind` não marca reagendamento: todo primeiro agendamento pela ficha também leva o campo (`src/views/LeadProfileView.jsx:582`), desde 19/06/2026 (commit `8c13cdb`).
  - A troca de etapa estruturada (`toStatus`) só existe desde 14/09/2026 (`stageChangeFields`, `src/lib/stageMove.js:51`). Antes, só o texto "Fase alterada para [X]" do `status_change`. A etapa atual (`lead.status`) é estado e não diz quando mudou.

#### R112. Pontualidade do follow-up

Os contatos marcados acontecem no dia previsto, ou com quantos dias de atraso?

- Para quem: gestor e consultor.
- Recortes: pessoa, canal, categoria.
- Números: % feito no dia, atraso médio, contatos nunca feitos.
- Filtros: período, pessoa.
- Formato: tabela.
- De onde vem: `stronix_interactions.rescheduledFor`; `text` (a data do agendamento pela ficha); `type` igual a `daily_goal_done` com `dailyGoalCategory` (`contato_hoje` contra `atrasado`); `actorAuthUid`, com recuo para `leadConsultantAuthUid`; `createdAt`.
- Desde quando: Meta desde 14/05/2026. Ficha com o ano no texto desde 30/06/2026 (commit `3bb30d5`, PR #123). Autor da ação desde 13/07/2026.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Parear o previsto com o feito depende de ler texto.
- Permissão e custo: gestor. Custo médio: interações do período por `createdAt`, sem índice composto.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O previsto estruturado (`rescheduledFor`) só existe nos caminhos da Meta (`src/views/DailyGoalView.jsx:1379` e `1511`, `src/modals/ContactOutcomeModal.jsx:112`). O agendamento pela ficha põe a data só no texto (`src/views/LeadProfileView.jsx:520-526`). O reagendamento de renovação e o adiar para amanhã também só têm texto.
  - O feito é o `daily_goal_done` com `dailyGoalCategory`, não qualquer interação. Dá para separar feito no dia (`contato_hoje`) de feito atrasado (`atrasado`) sem ler texto. Mas os dias de atraso dependem da data prevista, e o lead só guarda o `nextFollowUp` atual, que é sobrescrito.
  - Contato nunca feito não é evento. Dá para inferir como "a data prevista passou sem `daily_goal_done` do lead antes do agendamento seguinte", com as lacunas acima.
  - Na tarefa delegada, o contato de hoje vai para quem recebeu, mas o atrasado volta para o dono do lead (`src/lib/dailyGoal.js:298-303` e `337-350`). Quem responde pelo atraso não é quem recebeu a tarefa.

#### R113. Carteira sem toque

Quantos leads e clientes de cada pessoa estão sem contato há 7, 15 ou 30 dias, e quantos já passaram dos 15 dias da regra de atribuição?

- Para quem: gestor e consultor.
- Recortes: dono, lead ou cliente, etapa, faixa de dias.
- Números: quantidade, % da carteira, média de dias sem toque.
- Filtros: pessoa, faixa, funil.
- Formato: tabela nominal exportável.
- De onde vem: `stronix_leads.lastInteractionAt` (nulo quer dizer nunca tocado, e aí o recuo é `createdAt`); `appointmentOutcomeAt`, para a presença que não sobe o `lastInteractionAt`; `consultantId`; `lifecycleBucket`. Opcional: `stronix_interactions`, para tirar troca de responsável, indicação e importação do que conta como toque.
- Desde quando: retrato. O campo é gravado desde 13/07/2026 (commit `9824a66`) e foi preenchido para trás pelo backfill (`scripts/backfill-scale-fields.js:215`), então vale para a base toda.
- Viabilidade e prioridade: com ajuste, prioridade alta. É a regra 3 de atribuição, e a presença na Agenda não sobe o `lastInteractionAt`.
- Permissão e custo: todos. Custo zero para leads ativos, que já estão na memória (`src/App.jsx:679`). Alto para clientes: é preciso ler o balde cliente inteiro, porque quem tem o campo nulo fica fora de uma consulta por faixa e não existe índice composto (`lifecycleBucket`, `lastInteractionAt`) em `firestore.indexes.json`.
- Já existe em: Pipeline, temperatura do lead.
- Conferência no código: ajustado. O que mudou:
  - A regra dos 15 dias do playbook não existe no código. Nenhum lead volta a ficar livre no sistema (a busca por "posse" e "15 dias" em `src` e `api` não acha regra de posse). O relatório só lista quem está há 15 dias ou mais sem interação, e o rótulo precisa dizer isso.
  - `lastInteractionAt` não é toque. Ele sobe em qualquer `logInteraction` (`src/lib/interactions.js:44-52`), inclusive na troca de responsável (`src/modals/ClientRegistrationModal.jsx:75-85`), na troca de etapa no Kanban, na vinculação de indicação (`src/lib/referralsWrites.js:39` e `77`) e no contrato (`src/lib/contractsWrites.js:40` e `105`). A presença marcada pela Agenda do dia não sobe o campo (`src/lib/appointmentOutcome.js:105`). A marcada pela Meta sobe, porque passa por `logInteraction`. Para toque de verdade, ler as interações com o filtro de `isContactInteraction` (`src/lib/crm/contact.js:15-20`) ou usar o maior entre `lastInteractionAt` e `appointmentOutcomeAt`.
  - Lead novo nasce com `lastInteractionAt` nulo (`src/modals/AddLeadModal.jsx:474`), e o cliente importado também (`src/lib/clientImport.js:627`). Uma consulta por faixa deixa de fora quem nunca foi tocado, justamente o caso mais grave.
  - Igualdade mais faixa em campos diferentes pede índice composto publicado à mão, ou a leitura do balde cliente inteiro.
  - A viabilidade "pronto" do rascunho era otimista: antes é preciso decidir o que conta como toque e tratar o nulo.

#### R114. Leads sem próximo passo

Quais leads ativos não têm contato nem compromisso marcado?

- Para quem: gestor e consultor.
- Recortes: dono, etapa, funil.
- Números: sem próximo contato, com próximo contato atrasado, em dia.
- Filtros: pessoa, funil.
- Formato: tabela nominal.
- De onde vem: `stronix_leads.nextFollowUp`; `nextFollowUpType` (eco de visita e aula); `appointmentScheduledFor`, só quando é futuro; `nextFollowUpOwnerId`; `createdAt` (a janela de 24 horas que a Meta já cobre); `lifecycleBucket` igual a `'ativo'`; `status`. A regra: sem `nextFollowUp` e sem `appointmentScheduledFor` no futuro.
- Desde quando: retrato de agora.
- Viabilidade e prioridade: pronto, prioridade alta, depois de escolher uma regra só para o relatório e para o card do CRM. Na rotina, todo lead ativo tem próximo passo.
- Permissão e custo: todos. Custo zero: os leads ativos já estão na memória (`src/App.jsx:679`).
- Já existe em: Visão geral → CRM, card Sem próximo contato (`src/views/dashboard/PipelineNowCards.jsx:55`, `src/views/dashboard/CrmDashboard.jsx:18`).
- Conferência no código: ajustado. O que mudou:
  - Agendar visita ou aula também grava `nextFollowUp` com a mesma data (`src/lib/schedulePatch.js:32-36` e `53-60`). O "Contato feito" limpa só o `nextFollowUp` e deixa a visita futura (`src/lib/contactGoal.js:27-29`). O comparecimento limpa o `nextFollowUp` e deixa o `appointmentScheduledFor` no passado (`src/lib/appointmentOutcome.js:94-104`). Por isso a regra certa é sem `nextFollowUp` e sem `appointmentScheduledFor` futuro. Um compromisso no passado não conta como próximo passo.
  - O card Sem próximo contato (`src/lib/crm/stages.js:190-196`) usa só a ausência de `nextFollowUp` e deixa fora o lead com menos de 24 horas. Com o `appointmentScheduledFor` futuro, o relatório daria um número diferente do card. Pela regra do número num lugar só, escolher uma regra e aplicar nos dois, ou o relatório reusar o `pipelineNowOf`.
  - O dono da tarefa de contato é o `contactOwnerId` (`nextFollowUpOwnerId` ou `consultantId`, `src/lib/leads.js:244`), não só o `consultantId`.

#### R115. Agenda futura e carga por pessoa

Quantos contatos, visitas e aulas cada pessoa tem amanhã e nos próximos 7 e 30 dias?

- Para quem: gestor e consultor.
- Recortes: pessoa (dono da tarefa), dia, tipo.
- Números: contatos, visitas, aulas.
- Filtros: período à frente, pessoa.
- Formato: calendário.
- De onde vem: contatos por `stronix_leads.nextFollowUp` com `nextFollowUpType` que não seja visita nem aula, e dono em `nextFollowUpOwnerId` (na falta, `consultantId`). Visitas e aulas por `stronix_aulas.scheduledFor`, `type` e `consultantId`, um registro por compromisso, separadas com `isAulaRecord` no navegador. O dono de visita e aula é o `stronix_leads.consultantId`.
- Desde quando: retrato. Delegação de contato desde 18/08/2026 (commit `bd63bc5`). Visitas em `stronix_aulas` desde 18/08/2026.
- Viabilidade e prioridade: com ajuste, prioridade média. Serve para distribuir a carga antes do dia.
- Permissão e custo: todos. Custo baixo: leads ativos na memória; clientes pelo índice 11 (`lifecycleBucket`, `nextFollowUp`); `stronix_aulas` por `scheduledFor`, campo único.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Somar `nextFollowUp` e `appointmentScheduledFor` conta duas vezes cada visita e aula, porque o agendamento grava a data nos dois campos (`src/lib/schedulePatch.js:32-36` e `58`). Contato é o `nextFollowUp` com tipo que não seja visita nem aula, o mesmo filtro que a Meta já aplica (`src/lib/dailyGoal.js:347-348`).
  - O lead guarda um só `nextFollowUp`: agendar uma visita sobrescreve o contato que estava marcado. A agenda tirada do lead fica abaixo do real. Para visitas e aulas, a fonte completa é `stronix_aulas.scheduledFor` (`src/lib/aulas.js:7-16`).
  - Só o contato tem dono de tarefa (`nextFollowUpOwnerId`). Visita e aula seguem o `consultantId` (`src/lib/leads.js:238-244`; `src/lib/schedulePatch.js:41-48`).
  - As tarefas futuras de renovação e de vencidos não vêm do `nextFollowUp`. Saem de `currentContractEndsAt` e dos marcos, e ficam fora do calendário a menos que sejam projetadas dessas datas.
  - O índice 11 cobre o contato de clientes (`src/lib/leadQueries.js:161-169`).

#### R116. Tarefas de contato delegadas

Quantos contatos estão delegados a quem não é dono do lead, quem delega para quem, e se são feitos no dia?

- Para quem: gestor.
- Recortes: dono do lead, dono da tarefa, tipo, dia.
- Números: delegadas em aberto, atrasadas, feitas no dia.
- Filtros: pessoa.
- Formato: tabela.
- De onde vem: `stronix_leads.nextFollowUpOwnerId`, `consultantId`, `nextFollowUp` e `nextFollowUpType`; `stronix_interactions` com `type` igual a `daily_goal_done`, `dailyGoalCategory` e `actorAuthUid`; `stronix_interactions.text` para o histórico, que só tem o nome. Para ter histórico de verdade, um campo novo: `contactOwnerId` na interação do agendamento.
- Desde quando: retrato desde 18/08/2026. Histórico estruturado só a partir da gravação do campo novo.
- Viabilidade e prioridade: com ajuste, prioridade baixa. A delegação passada só existe no texto.
- Permissão e custo: gestor. Custo zero para leads ativos; baixo para clientes, pelo índice 11.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `nextFollowUpOwnerId` só é gravado pelo wizard da ficha (`src/lib/schedulePatch.js:41-48`, `src/components/profile/ScheduleWizard.jsx:469`). O "Contato feito" (`src/lib/contactGoal.js:27-29`), o "Reagendar" (`src/lib/contactGoal.js:41-49`), o próximo contato da Meta (`src/views/DailyGoalView.jsx:1360-1363`) e o adiar não mexem no campo. Assim, a delegação continua depois do contato feito, com `nextFollowUp` nulo, e passa para o próximo contato remarcado pela Meta. "Delegada em aberto" precisa exigir `nextFollowUpOwnerId` diferente de `consultantId`, `nextFollowUp` preenchido e tipo que não seja visita nem aula.
  - Atrasada delegada não é do delegado. Só a categoria Contato hoje vai para quem recebeu; o atraso cai na Meta do dono do lead (`src/lib/dailyGoal.js:298-303` e `337-350`).
  - "Feita no dia" é o `daily_goal_done` com `dailyGoalCategory` igual a `contato_hoje` no dia, com o `actorAuthUid` do delegado. A Meta credita pelo lead e pela categoria, sem olhar o autor.
  - O histórico da delegação é só o texto "· tarefa de <nome>" na nota do wizard (`src/views/LeadProfileView.jsx:524-526`), por nome e sem id.

#### R117. Trocas de responsável

Quem passou leads para quem, quem fez a troca, em quanto tempo o novo dono agiu e o que aconteceu depois?

- Para quem: gestor e dono.
- Recortes: de, para, quem trocou, mês, lead ou cliente.
- Números: trocas, leads diferentes, matrículas depois da troca, mediana até a primeira ação do novo dono.
- Filtros: período, pessoa.
- Formato: matriz de/para, mais lista.
- De onde vem:
  - `stronix_interactions` com `type` igual a `status_change`, sem `toStatus`, e texto "Responsável alterado".
  - `stronix_interactions.leadConsultantId`: o dono anterior, se não houve migração em massa depois.
  - `stronix_interactions.actorAuthUid` e `actorId`: quem trocou.
  - `stronix_leads.consultantId`: o dono atual.
  - `stronix_interactions.text` com "MIGRAÇÃO:": a troca em massa, sem `leadId`.
  - `stronix_leads.convertedAt` e `clienteSince`, ou `stronix_contratos.leadId`: a matrícula depois da troca.
- Desde quando: 26/08/2026 para a troca individual (commit `00c21ec`). A migração em massa só aparece como nota agregada, sem lead.
- Viabilidade e prioridade: com ajuste, prioridade média. O de/para só existe como nome no texto, e a migração em massa não deixa evento por lead.
- Permissão e custo: gestor e dono. Custo médio: interações do período por `createdAt`, com o filtro de tipo feito na memória, porque não há índice (`type`, `createdAt`).
- Já existe em: sino, aviso Passaram para você (`src/hooks/useHandoffs.js:32-33`).
- Conferência no código: ajustado. O que mudou:
  - O "de" tem id: a interação da troca é gravada com o lead de antes da troca, então `leadConsultantId` é o dono anterior (`src/lib/clientRegistration.js:95-109`; `src/lib/leads.js:266-269`; `src/modals/ClientRegistrationModal.jsx:75-85`). Mas a migração em massa reescreve o `leadConsultantId` de todas as interações dos leads movidos (`src/views/settings/TransferLeadsTab.jsx:150-163`), e depois disso o "de" só fica no texto.
  - O "para" só existe como nome no texto "Responsável alterado de [X] para [Y]." e no dono atual do lead. Achar o id pelo nome falha com nome trocado ou homônimo.
  - `consultantChangedAt`, `consultantChangedByName` e `consultantChangedByAuthUid` ficam só no lead e guardam a última troca. Servem ao sino, não ao histórico.
  - A migração em massa grava uma nota só, sem `leadId`, com nomes no texto, sem `consultantChangedAt` e sem subir `lastInteractionAt` (`src/views/settings/TransferLeadsTab.jsx:166-173`).
  - Antes de 26/08/2026 a troca individual pelo cadastro não deixava evento (era um `updateDoc` puro), então a série começa ali.
  - "Primeira ação do novo dono" é a primeira interação com o `actorAuthUid` dele, sem contar a própria troca. A presença pela Agenda não tem `actorAuthUid` (`src/lib/appointmentOutcome.js:113-135`).

#### R118. Carteira por pessoa e carteira órfã

Quantos leads, clientes e perdas cada pessoa carrega hoje, e quanto está com ex-consultor ou sem dono?

- Para quem: dono e gestor.
- Recortes: dono, situação, funil.
- Números: leads, clientes com contrato vigente, % da base, órfãos.
- Filtros: funil.
- Formato: tabela.
- De onde vem: `stronix_leads.consultantId` e `lifecycleBucket`, com contagem por pessoa; `stronix_contratos` vigentes, pelo `leadId`, para separar cliente ativo de vencido; `stronix_users.id`, para achar o órfão.
- Desde quando: retrato.
- Viabilidade e prioridade: com ajuste, prioridade média. Hoje a tela lê a base inteira.
- Permissão e custo: gestor. Custo baixo com `count()` por `consultantId` e balde. Médio para separar vigente de vencido: ler os documentos dos clientes, ou juntar os contratos vigentes pelo `leadId` em lotes de 30.
- Já existe em: Configurações → Migrar leads.
- Conferência no código: ajustado. O que mudou:
  - "Clientes ativos" não sai de `lifecycleBucket`. O balde cliente inclui o vencido, porque cliente nunca volta a lead. A tela Migrar leads chama de "Clientes ativos" todo `isClientLead` (`src/views/settings/TransferLeadsTab.jsx:17-19`). Cliente com contrato vigente vem dos contratos, que já chegam pela assinatura do login, cruzados com o dono atual do lead.
  - Os leads de clientes não estão na memória, só o balde ativo (`src/App.jsx:679`). `count()` por `consultantId` mais `lifecycleBucket` dá o total por pessoa sem índice composto, porque são só igualdades, no molde de `src/hooks/useFunnelCounts.js:38`.
  - Órfão é o `consultantId` ausente ou fora da lista de usuários, como a tela já faz (`src/views/settings/TransferLeadsTab.jsx:69-80`). O rascunho dizia que a lista completa só vem para o gestor. Não é assim: o gestor assina a lista ao vivo e o consultor recebe a equipe inteira numa leitura por sessão (`src/App.jsx:839-852`).
  - A tela de Configurações recebe a base inteira de leads (`src/views/settings/SettingsView.jsx:164`). A justificativa confere.

#### R119. Carteira do consultor numa data passada

Quantos leads e clientes cada pessoa tinha no fim de cada mês?

- Para quem: gestor.
- Recortes: mês, pessoa.
- Números: leads ativos, clientes com contrato vigente.
- Filtros: período.
- Formato: evolução mensal.
- De onde vem: um evento novo de troca de dono, com `fromId` e `toId` por lead (inclusive na migração em massa), ou uma foto mensal nova da carteira; `stronix_leads.createdAt` e `clienteSince`, para a entrada na base; `stronix_contratos`, para saber se o contrato estava vigente na data.
- Desde quando: a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. O `consultantId` é sobrescrito.
- Permissão e custo: gestor. Custo baixo depois de gravado. Coleção nova pede regra publicada à mão.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - `stronix_contratos.consultantId` é o vendedor na hora da venda (`src/lib/contracts.js:175-181`), não quem cuida da carteira. Pela regra, a carteira é do responsável atual do lead (`src/lib/operacional/renewal.js:13-15`). Usar o contrato mede "vendeu", não "carregava".
  - Não há histórico de posse. A troca individual deixa evento só desde 26/08/2026, com o "para" só no texto (`src/modals/ClientRegistrationModal.jsx:75-85`). A migração em massa não deixa evento por lead e reescreve o `leadConsultantId` das interações (`src/views/settings/TransferLeadsTab.jsx:139-173`). Reconstruir o passado não é confiável.
  - Gravar é viável dentro do escopo: um de/para estruturado na interação de troca (na troca individual e uma por lead na migração em massa) ou uma foto mensal por pessoa.

#### R120. Quem cobre quem

Quanto do trabalho na carteira de cada consultor foi feito por colegas?

- Para quem: gestor.
- Recortes: autor, dono na hora da ação, tipo.
- Números: ações em carteira alheia, % da atividade na carteira do dono feita por outras pessoas.
- Filtros: período.
- Formato: matriz.
- De onde vem: `stronix_interactions.actorId` e `actorAuthUid`; `consultantName`, o nome de quem clicou, como recuo para a presença; `leadConsultantId`; `type`.
- Desde quando: 13/07/2026. Leads que passaram por migração em massa perdem o dono da época.
- Viabilidade e prioridade: com ajuste, prioridade baixa. A migração em massa reescreve o `leadConsultantId`.
- Permissão e custo: gestor. Custo médio: interações do período por `createdAt`.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `leadConsultantId` é o dono na hora da ação (`getInteractionSecurityFields`, `src/lib/leads.js:266-269`), mas a migração em massa reescreve o campo de todas as interações dos leads movidos (`src/views/settings/TransferLeadsTab.jsx:150-163`).
  - A ação mais típica de cobertura, a presença marcada pela Agenda ou pelo plantão, é gravada sem `actorId` e sem `actorAuthUid` (`src/lib/appointmentOutcome.js:113-135`). O autor só aparece no `consultantName`. Sem esse recuo, a cobertura fica abaixo do real.
  - Quando o lead não tem dono, o `leadConsultantId` cai no próprio autor (`src/lib/leads.js:267`), e a ação parece do dono.
  - Os caminhos do servidor gravam `actorAuthUid` nulo (`api/tenant-resolve.js:236`, `309` e `324`).

#### R121. Horário de trabalho e aderência ao turno

Em que horas e dias cada pessoa registra ações, quando começa e termina, e quanto cai dentro do turno?

- Para quem: dono e gestor.
- Recortes: pessoa, hora, dia da semana.
- Números: ações por hora, % dentro do turno, primeira e última ação do dia, registros depois do expediente.
- Filtros: período, pessoa.
- Formato: mapa de calor.
- De onde vem: `stronix_interactions.createdAt` e `actorAuthUid`, com recuo para `consultantName`; `stronix_leads.createdAt` com `consultantId`, para o cadastro; `stronix_users.shiftStart` e `shiftEnd`, só o turno atual.
- Desde quando: 13/07/2026. Turno, só o de hoje.
- Viabilidade e prioridade: com ajuste, prioridade média. A rotina proíbe preencher tudo no fim do expediente, e o relatório mede a hora do registro, não o expediente.
- Permissão e custo: dono e gestor. Custo médio: interações do período por `createdAt`.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `createdAt` é o `serverTimestamp` da gravação (`src/lib/interactions.js:40-42`), ou seja, a hora do registro, não a do contato.
  - A presença pela Agenda do dia não tem `actorAuthUid` (`src/lib/appointmentOutcome.js:113-135`), e o mapa cairia no dono do lead, pondo ação de uma pessoa no mapa de outra. Usar o `consultantName` como recuo.
  - `shiftStart` e `shiftEnd` existem em `stronix_users` (`src/views/settings/TeamAccessSection.jsx:255-256`), gravados pelo gestor e sem versão: só o turno atual.
  - O cadastro de lead (`lead.createdAt` com o `consultantId` de quem cadastrou) e o contrato (`src/lib/contractsWrites.js:51`, `129` e `149`, com `actorAuthUid`) também são ações e entram no mapa.
  - Dia fora de `metaWeekdays` aparece à parte, e não como fora do turno.

#### R122. Uso do sistema por pessoa

Quem entrou no CRM esta semana, quem registrou ações e quem está parado?

- Para quem: dono e gestor.
- Recortes: pessoa, dia.
- Números: dias com acesso, dias com ação, último acesso.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_interactions.actorAuthUid` (recuo para `consultantName`) e `createdAt`; `stronix_daily_goal_history.consultantId` e `date`; um campo novo, `stronix_users.lastSeenAt`, gravado pela própria pessoa.
- Desde quando: ação desde 13/07/2026; acesso a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. Enquanto o acesso não é gravado, dias com ação servem de aproximação.
- Permissão e custo: dono e gestor. Custo médio para as ações. O acesso custa uma gravação por pessoa por dia e a leitura da lista de usuários, que já chega.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - Não achei quem grave último login ou último acesso, nem em `stronix_users` nem em outra coleção. A única marca de uso fora das ações é o "já li" do sino (`src/hooks/useNotificationsSeen.js:18-53`), que só é gravado quando a pessoa clica.
  - As rules já deixam a pessoa gravar no próprio documento de `stronix_users`, sem mudar papel nem academia (`firestore.rules:123-133`). Um `lastSeenAt` diário cabe sem regra nova, amarrado ao portão de atividade.
  - "Dias com ação" fica abaixo do real por causa da presença pela Agenda, que não grava `actorAuthUid`. Usar o `consultantName` como recuo.
  - O `stronix_daily_goal_history` (dia batido por `consultantId`) é mais um sinal de uso, legível por todos.

#### R123. Quadro da equipe e vagas do plano

Quem está na equipe, com qual papel, turno e alvo, desde quando, e quantas vagas do plano estão em uso?

- Para quem: dono e gestor.
- Recortes: pessoa, papel.
- Números: membros por papel, tempo de casa no sistema, alvo, vagas usadas e extras, custo extra.
- Filtros: nenhum.
- Formato: tabela.
- De onde vem:
  - `stronix_users.role`, `name`, `createdAt` (data do cadastro no sistema), `shiftStart`, `shiftEnd` e `dailyVolumeTarget`.
  - `GET /api/asaas`, na ação self-service, que é só de admin: `seatLimits.maxManagers`, `maxConsultants`, `extraUserPrice`, `maxExtraUsers` e `planName`.
  - `tenants.monthlyPrice`, porque preço negociado anula a conta de extras. Hoje ele não chega ao gestor pela API self-service.
- Desde quando: retrato.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Quase tudo já está nas Configurações.
- Permissão e custo: gestor. O dono é o gestor principal, sem permissão diferente. Vagas e preço vêm de função de servidor só de admin. Custo zero: o gestor já assina `stronix_users` (`src/App.jsx:839-842`), e a tela já faz o fetch a `/api/asaas`.
- Já existe em: Configurações → Equipe & acessos.
- Conferência no código: ajustado. O que mudou:
  - A tela não mostra tudo o que o relatório promete. A tabela de membros tem Membro, Papel, Turno, Prospecção e Acesso (`src/views/settings/TeamAccessSection.jsx:27-34`), sem tempo de casa. A faixa de vagas mostra só os consultores inclusos, os extras e o preço de um extra (`src/views/settings/TeamAccessSection.jsx:75-95`). Vaga de gestor e custo extra total não aparecem, e a faixa some quando o plano é ilimitado (linha 76).
  - `stronix_users.createdAt` é a data do cadastro no sistema, não a de admissão. Quem já trabalhava na academia antes da implantação fica com a data da implantação. O campo é gravado em todos os caminhos: `api/admin-users.js:111`, `api/invite-accept.js:119`, `api/provision-tenant.js:315` e o legado do cliente (commit `e07e9f4`).
  - O custo extra não é só extras vezes `extraUserPrice`. A conta respeita `maxExtraUsers` (`api/_plans.js:55-65`) e é ignorada quando a academia tem preço negociado, porque `monthlyPrice` maior que zero ganha do catálogo (`api/_plans.js:39-50`).
  - `plans.maxConsultants` fica na coleção raiz `plans/`, que as rules não liberam para o navegador. O gestor só recebe o dado pelo `GET /api/asaas`, na ação self-service, só de admin (`api/asaas.js:283-285` e `336-341`).
  - A tela conta consultores com `role` diferente de `'admin'` (`src/views/settings/TeamAccessSection.jsx:173`), e o servidor trata documento sem papel como consultor (`api/_plans.js:174-189`). As duas contas batem, e isso fica escrito.

#### R124. Rampa do consultor novo

Quanto tempo um consultor novo leva para chegar na média de vendas e de meta da equipe?

- Para quem: dono e gestor.
- Recortes: pessoa, mês de casa.
- Números: vendas por mês de casa, % de meta, conversão da safra.
- Filtros: nenhum.
- Formato: curvas.
- De onde vem: `stronix_users.createdAt` (cadastro no sistema); `stronix_contratos.consultantId`, `createdAt` (fechamento), `value` e `durationMonths`, sem os importados (`isImportedContract`); `stronix_daily_goal_history.consultantId` e `date`; `metricsOf` do CRM por `userId` (dono atual), para a conversão da safra.
- Desde quando: contratos desde junho de 2026. Meta gravada de qualquer tela só desde 14/09/2026 (PR #206, commit `75400c9`).
- Viabilidade e prioridade: com ajuste, prioridade baixa. Ex-consultor apagado perde o `createdAt`.
- Permissão e custo: dono e gestor. Custo baixo: os contratos já chegam inteiros pela assinatura do login, o % de meta lê o histórico por período e a safra de cada mês custa uma carga de `src/hooks/monthSources.js`.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O `createdAt` é a data do cadastro no sistema (`api/admin-users.js:103-112`). A equipe que já existia na implantação nasce com a data da implantação, então a curva só vale para quem entrou depois.
  - Contratos existem só desde junho de 2026. Hoje, 24/09/2026, ninguém tem mais de uns 3 meses de casa observáveis, e a curva nasce quase vazia.
  - O histórico de meta existe desde 03/06/2026 (commit `237257d`). Até 14/09/2026 o dia só era gravado com a Meta Diária aberta, então o % de meta de antes sai menor que o real. Dia sem tarefa também não é gravado (`src/lib/dailyGoalHistory.js:29-34`).
  - A conversão da safra do CRM usa o dono de hoje (`src/lib/crm/scope.js:49-69`). Depois de uma transferência, a safra do consultor novo herda o passado de outra pessoa. A venda pelo contrato é estável (`src/lib/contracts.js:175-181`).
  - Ex-consultor apagado perde `role` e `createdAt` (`api/admin-users.js:246`). O contrato guarda `consultantName` e continua legível como "Outros".
  - As vendas usam o mesmo filtro dos painéis: fora os importados, e fora de qualquer soma em dinheiro o contrato com `value` menor ou igual a zero.

#### R125. Entradas e saídas da equipe

Quantas pessoas entraram e saíram por mês, e quanto tempo ficaram?

- Para quem: dono.
- Recortes: mês, papel, forma de entrada.
- Números: entradas, saídas, permanência média, rotatividade.
- Filtros: período.
- Formato: evolução mensal.
- De onde vem: `stronix_users.createdAt` (entrada); `tenants/{id}/invites.acceptedUid` e `acceptedAt` (entrada por convite); um registro novo de saída, gravado no `handleDelete` de `api/admin-users.js`, fora de `stronix_users`, com data, papel e quem excluiu.
- Desde quando: a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. A saída hoje é exclusão física.
- Permissão e custo: dono e gestor (admin). O registro de saída precisa de regra de leitura nova para admin. Custo zero.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - A saída não deixa rastro: o `handleDelete` apaga a conta do login e o documento, sem auditoria (`api/admin-users.js:186-255`). A justificativa confere.
  - A saída não pode virar uma marca dentro de `stronix_users`, porque todo documento ali ocupa vaga: o `getSeatUsage` conta a coleção inteira com `count()` (`api/_plans.js:178-189`). O registro vai para outro lugar e é gravado pelo Admin SDK dentro do próprio `handleDelete`, sem função nova (11 de 12 em uso).
  - A forma de entrada não é gravada no usuário. Dá para inferir: convite aceito tem `invites.acceptedUid` (`api/invite-accept.js:123-125`), e cadastro direto não tem convite. O primeiro gestor provisionado em modo senha também não tem convite (`api/provision-tenant.js:307-317`).
  - `invites` só é legível por admin e super-admin (`firestore.rules:266-269`). Serve ao dono, que é admin.

#### R126. Convites da equipe

Quantos convites foram enviados, aceitos ou vencidos, e quanto tempo levaram até o aceite?

- Para quem: gestor e super-admin.
- Recortes: papel, quem convidou, mês.
- Números: criados, aceitos, vencidos, horas até o aceite.
- Filtros: período.
- Formato: tabela.
- De onde vem: `tenants/{id}/invites`: `role`, `status` (`pending`, `accepted`, `expired`, `cancelled`), `createdAt`, `createdBy`, `expiresAt`, `acceptedAt`, `acceptedUid` e `extraApproved`. O token nunca aparece.
- Desde quando: 02/06/2026.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Convite vencido continua como `pending`.
- Permissão e custo: gestor (pelas rules, admin da academia) e super-admin. Custo baixo: a subcoleção inteira da academia numa leitura, sem índice.
- Já existe em: nada parecido hoje. Nenhuma tela lê os convites.
- Conferência no código: ajustado. O que mudou:
  - "Vencido" não é status confiável. O convite só vira `expired` quando alguém tenta aceitar depois do prazo (`api/invite-accept.js:74-77`). Fora disso fica `pending`. Vencido é `pending` com `expiresAt` antes de agora, e o prazo é de 7 dias (`api/invite-create.js:15`).
  - Existe também o status `cancelled`: o reenvio do convite de ativação pelo super-admin cancela os pendentes (`api/provision-tenant.js:147-151`).
  - O convite de ativação da academia tem `createdBy` igual ao uid do super-admin, que não é membro (`api/provision-tenant.js:156-160` e `336-341`). "Quem convidou" só se resolve pela lista da equipe nos convites feitos pelo gestor (`api/invite-create.js:65-74`).
  - Nenhuma tela lê `invites` hoje, então o relatório abre uma leitura nova, que as rules já permitem ao admin (`firestore.rules:266-269`).
  - O documento do convite guarda o token do link. O relatório não pode mostrar nem exportar esse campo.

#### R127. Gestor contra consultores

Quanto das vendas, da meta e da atividade vem do gestor, e quanto da equipe comercial?

- Para quem: dono.
- Recortes: papel, mês.
- Números: valor vendido, % de meta, ações.
- Filtros: período.
- Formato: comparativo.
- De onde vem: `stronix_users.role` (papel de hoje, cruzado pelo id); `stronix_contratos.consultantId`, `value` e `createdAt`, sem importados; `stronix_interactions.actorAuthUid` (desde 13/07/2026), com `leadConsultantAuthUid` na falta e `consultantName` como nome de quem clicou; `stronix_daily_goal_history`.
- Desde quando: junho de 2026 para contratos; 13/07/2026 para o autor.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Os painéis misturam os dois papéis.
- Permissão e custo: dono. Custo zero para as vendas, porque os contratos já chegam pela assinatura. Médio para as ações: interações do período por `createdAt`, campo único.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O papel é o de hoje, lido do documento em `stronix_users`. Membro apagado não tem papel e cai em "Outros".
  - A venda vai para o dono do lead na hora do fechamento, não para quem clicou (`src/lib/contracts.js:175-181`). Quando o gestor fecha a venda de um lead de consultor, a venda conta para o consultor. O relatório mede "vendas da carteira do gestor", não "vendas feitas pelo gestor".
  - No "Acessar como", o super-admin age com o uid do gestor principal (`api/impersonate.js:61-64`). As ações dele e a importação de clientes, feita só no super console, ficam creditadas ao gestor. Os importados saem por `isImportedContract` e `isImportCreatedLead`.
  - O desfecho de presença pela Agenda do dia grava sem `actorAuthUid` (`src/lib/appointmentOutcome.js:113-133`) e cai no dono do lead. O nome de quem clicou fica em `consultantName`.
  - O % de meta sai do histórico, que ficou subcontado até 14/09/2026. O gestor também grava dia batido (`src/App.jsx:1426-1440`).
  - O valor vendido é valor de contrato, não caixa. Contrato com `value` menor ou igual a zero fica fora do dinheiro.

#### R128. Cobrança do gestor e resultado

Dos itens que o gestor cobrou, quantos o consultor resolveu, e em quanto tempo?

- Para quem: gestor.
- Recortes: consultor, categoria, dia.
- Números: cobrados, resolvidos, tempo até resolver.
- Filtros: período.
- Formato: tabela.
- De onde vem: a cobrança, que é nova: uma interação de tipo próprio com `dailyGoalCategory`, o `actorAuthUid` do gestor e `createdAt`. A resolução: o `daily_goal_done` da mesma categoria e do mesmo lead depois da cobrança, ou Venda ou Perda no dia.
- Desde quando: a partir da gravação.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. É a PR 2 adiada da visão do gestor.
- Permissão e custo: gestor na tela; pelas rules, qualquer membro grava lead e interação (`firestore.rules:79-95`), então "só o gestor cobra" é trava de tela. Custo baixo: interações do período, que os painéis já leem.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O esboço da PR 2 põe a marca de cobrança no lead e apaga quando a tarefa é concluída (`docs/superpowers/specs/2026-07-28-visao-gestor-profundidade-design.md:303-315`). Isso é estado sobrescrito e não permite contar cobrados e resolvidos por período, nem o tempo até resolver. A cobrança precisa virar evento com data.
  - O tipo novo de interação precisa ficar fora do primeiro contato do CRM, que conta qualquer interação fora de uma lista de exceções (`src/lib/crm/contact.js:8-21`). E fora da prospecção, sem `volumeKind`.

#### R129. Cobertura da tarefa Novo 24h

Dos leads que geraram a tarefa Novo 24h, quantos tiveram a tarefa concluída?

- Para quem: gestor.
- Recortes: dono, origem, safra.
- Números: leads com a tarefa, concluídas, % coberto.
- Filtros: período, pessoa.
- Formato: número com comparativo.
- De onde vem: `stronix_leads.createdAt`, `status`, `consultantId`, `source` e `funnelId`, sem importados; `stronix_interactions` com `type` igual a `daily_goal_done`, `dailyGoalCategory` igual a `'novo_24h'` (ou `metadata.category` no registro antigo) e `createdAt`.
- Desde quando: 14/05/2026.
- Viabilidade e prioridade: com ajuste, prioridade baixa. Concluir a tarefa não exige contato, e o R107 responde melhor.
- Permissão e custo: gestor. Custo médio: leads e interações do período por `createdAt`, consultas de campo único, sem índice novo.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O denominador "leads novos" estava errado. A tarefa Novo 24h só existe para lead cadastrado antes de hoje e há menos de 24 horas, fora de Venda e Perda (`src/lib/dailyGoal.js:355-364`). Ela aparece da meia-noite seguinte ao cadastro até completar 24 horas do cadastro. Lead cadastrado cedo quase não gera tarefa, e lead cadastrado tarde gera quase um dia inteiro. A base certa são os leads cuja janela de tarefa existiu, no dono do dia.
  - Concluída é o `daily_goal_done` com `dailyGoalCategory` igual a `'novo_24h'`. O registro antigo pode trazer `metadata.category` (`src/lib/leads.js:122`). Venda ou Perda no dia também fecham a tarefa.
  - Valem as exclusões de sempre: lead importado (`isImportCreatedLead`) e funis de cliente (`src/lib/crm/scope.js:26-35`).
  - O recorte por dono usa o dono de hoje, mas a tarefa foi do dono do dia, e a troca em massa reescreve o passado (`src/views/settings/TransferLeadsTab.jsx:142-163`).

#### R130. Extrato de atendimento de um lead

O que aconteceu com esta pessoa, quem fez e quando?

- Para quem: dono, gestor e consultor.
- Recortes: lead, tipo, autor.
- Números: eventos em ordem.
- Filtros: tipo, autor.
- Formato: linha do tempo para imprimir.
- De onde vem: `stronix_interactions.leadId`, `createdAt`, `type`, `text`, `actorId` e `actorAuthUid` (desde 13/07/2026) e `consultantName` (nome de quem clicou); `stronix_contratos` por `leadId`; `stronix_aulas` por `leadId`.
- Desde quando: 29/04/2026.
- Viabilidade e prioridade: pronto, prioridade baixa. Já existe na ficha; falta imprimir e juntar contratos e aulas.
- Permissão e custo: todos. Custo baixo: o índice 10 (`leadId` crescente, `createdAt` decrescente) para as interações e consulta de campo único por `leadId` em contratos e aulas.
- Já existe em: Ficha → Linha do tempo.
- Conferência no código: ajustado. O que mudou:
  - A interação não cobre tudo o que aconteceu com a pessoa. A migração em massa grava uma nota só, sem `leadId` (`src/views/settings/TransferLeadsTab.jsx:166-173`), e ela some do extrato do lead. O detalhe do contrato fica em `stronix_contratos` e o da aula ou visita em `stronix_aulas`. Um extrato completo junta as três coleções pelo `leadId`.
  - `actorId` e `actorAuthUid` só existem desde 13/07/2026 (`src/lib/interactions.js:37-38`). O desfecho de presença pela Agenda do dia não grava `actorAuthUid` (`src/lib/appointmentOutcome.js:113-133`). O nome de quem clicou vem em `consultantName`, e ele serve de autor antes dessa data.
  - A linha do tempo da ficha usa `onSnapshot` (`src/hooks/useLeadTimeline.js:26-27`). A versão para imprimir deve usar `getDocs`. O título da aba e o nome do arquivo não podem levar o nome da pessoa.
  - Excluir o lead apaga as interações (`src/views/LeadProfileView.jsx:215-236`).

#### R131. Plantão do digital

Os leads digitais e de tráfego pago de cada dia foram cadastrados, atendidos e agendados pelo plantonista do dia, ou alguém trabalhou fora do plantão?

- Para quem: gestor.
- Recortes: dia, plantonista, quem cadastrou, quem agendou, origem digital ou paga.
- Números: leads digitais do dia, % atendidos pelo plantonista, agendados por quem não era plantonista, leads fora de qualquer plantão.
- Filtros: origens digitais e pagas (canal da origem), período.
- Formato: tabela por dia com o plantonista e as exceções. Cada exceção abre a ficha.
- De onde vem:
  - A escala de plantão por dia, que é nova.
  - Um autor imutável do cadastro do lead, também novo. Hoje só dá para inferir pelo dono inicial, enquanto não houve troca.
  - `stronix_leads.createdAt` e `source`; `stronix_sources.channel`.
  - `stronix_interactions` com `volumeKind`: `actorId` e `actorAuthUid` dizem quem agendou, desde 13/07/2026.
- Desde quando: a partir da gravação da escala e do autor do cadastro.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. A regra do plantão decide comissão, e sem a escala gravada a gestão resolve a disputa de memória.
- Permissão e custo: gestor. Custo pequeno: leads e interações do dia.
- Já existe em: nada que confira o plantão. No catálogo, o R057 aplica a regra de ouro a cada venda e o R002 cruza chegada com turno. Nenhum dos dois confere o plantão, porque a escala por dia não existe no sistema.
- Conferência no código: ajustado. O que mudou:
  - "Não achei quem grava o autor do cadastro" estava incompleto. No cadastro manual o lead nasce com o dono igual a quem cadastrou (`src/modals/AddLeadModal.jsx:469`, `getLeadOwnershipFields(appUser)` em `src/lib/leads.js:261-265`). Só que é o mesmo campo do dono atual, sobrescrito na troca. A troca individual deixa nota e `consultantChangedAt` (`src/modals/ClientRegistrationModal.jsx:81`), e a troca em massa não deixa rastro por lead (`src/views/settings/TransferLeadsTab.jsx:142-150`). No link público o dono vem do indicador, não de quem cadastrou. Falta um campo imutável de autor do cadastro.
  - `stronix_aulas.consultantId` não diz quem agendou: é o dono do lead copiado no registro (`src/lib/aulasWrites.js:33-39`). Quem agendou vem da interação com `volumeKind`.
  - "Origem digital ou paga" depende do campo livre `channel` do catálogo de origens (`src/views/settings/CatalogsSection.jsx:55`), que cada academia preenche do seu jeito.
  - A escala por dia não existe. `shiftStart` e `shiftEnd` são um turno fixo por pessoa (`src/views/settings/TeamAccessSection.jsx:255-256`). Isso confere, e continua sendo o dado que falta gravar. A regra do plantão está no playbook comercial, fora deste repositório (`02-playbooks/TIME COMERCIAL/REGRAS_ATRIBUICAO_VENDAS_STRONIX.md:48-53`, no STRONIX-FIRMA).

#### R132. Resultado das ligações e mensagens

De cada 10 ligações e mensagens registradas, quantas foram atendidas ou respondidas, por pessoa, dia da semana e horário?

- Para quem: gestor e consultor.
- Recortes: pessoa, canal (ligação ou mensagem), dia da semana, faixa de hora, etapa do lead.
- Números: tentativas, atendidas ou respondidas, % de contato efetivo, tentativas até o primeiro contato efetivo.
- Filtros: período, funil.
- Formato: tabela por pessoa e mapa de calor por hora.
- De onde vem: o resultado da tentativa, que é novo (canal e se atendeu ou respondeu, gravado na interação); as notas "Ligação:" e "Mensagem WhatsApp enviada:" (`type` igual a `note`), que marcam a tentativa sem o resultado; o `daily_goal_done` da categoria Contato hoje, com `volumeKind` e `rescheduledFor` no reagendamento, como sinal parcial desde 23/07/2026.
- Desde quando: a partir da gravação do resultado.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. Mostra o melhor horário para ligar e separa tentativa de contato de verdade.
- Permissão e custo: todos. Custo: interações do período, que os painéis já leem.
- Já existe em: nada parecido hoje. O R109 conta mensagens e ligações registradas e o R108 mede resposta no WhatsApp pelo Stronizap. Nenhum sabe se a ligação foi atendida.
- Conferência no código: ajustado. O que mudou:
  - A fonte confere: ligação e mensagem da ficha são notas de texto livre, sem resultado (`src/views/LeadProfileView.jsx:609-612` e `627-630`). O registro de mensagem só marca que o link do WhatsApp foi aberto, não que a mensagem saiu. O `createdAt` é a hora do registro, então o mapa de calor mede a hora de anotar, não a da ligação.
  - Há um sinal parcial que o rascunho não citava. Desde 23/07/2026 a tarefa Contato hoje da Meta grava "Contato feito" ou "Reagendar", com motivo livre (`src/modals/ContactOutcomeModal.jsx:86-116`). É o desfecho da tarefa, não de cada tentativa, e o motivo não se agrupa.
  - As interações com `volumeKind` igual a `'ligacao'` ou `'mensagem'` são agendamentos do próximo contato (`src/lib/contactGoal.js:16-21`; `src/views/DailyGoalView.jsx:1352` e `1378`), não tentativas feitas.

#### R133. Evolução do consultor mês a mês

Cada consultor está melhorando ou piorando nos últimos 6 a 12 meses em conversão, comparecimento, matrículas, valor vendido, renovação e meta, e como fica contra a média da equipe?

- Para quem: gestor, consultor e dono.
- Recortes: pessoa, mês (até 12 para trás), indicador.
- Números: leads recebidos, conversão da safra, comparecimento, matrículas, valor vendido e ticket do mês, taxa de renovação da carteira, % de meta batida, média da equipe no mesmo mês.
- Filtros: pessoa, período, indicador.
- Formato: série curta por indicador, uma linha por mês, exportável.
- De onde vem: `metricsOf` do CRM e do Operacional com `userId` (dono atual); `sellersOf` do Gerencial (`consultantId` do contrato), sem importados e com `value` menor ou igual a zero fora do dinheiro; `stronix_daily_goal_history`, completo desde 14/09/2026.
- Desde quando: leads desde 29/04/2026; meta batida desde 03/06/2026; contratos desde 30/06/2026; comparecimento completo desde setembro de 2026.
- Viabilidade e prioridade: com ajuste, prioridade média. A conversa de desempenho pede tendência, e os painéis só mostram um mês com um comparativo.
- Permissão e custo: hoje todos veem todos nos painéis. Falta decidir se o consultor vê a série dos colegas. Custo: uma carga de mês por mês pedido (`src/hooks/monthSources.js`), sob demanda. Os contratos não pedem leitura nova, porque vêm da assinatura do login.
- Já existe em: nada como série. O R099 é o placar de um mês ou de uma semana, e o R124 é a rampa só do consultor novo.
- Conferência no código: ajustado. O que mudou:
  - O Gerencial não tem recorte por pessoa no `metricsOf` (`src/lib/gerencial/metrics.js:52`). A venda por consultor sai do `sellersOf` (`src/lib/gerencial/people.js:34`), pelo `consultantId` do contrato. CRM e Operacional aceitam `userId` (`src/lib/crm/metrics.js:93`, `src/lib/operacional/metrics.js:92`).
  - A série mistura atribuições. No CRM a pessoa é o dono de hoje (`src/lib/crm/scope.js:49-69`), e na carteira de renovação também (`src/lib/operacional/renewal.js:13-15`). A venda é do dono na hora do fechamento (`src/lib/contracts.js:175-181`). A série muda depois de uma transferência de carteira, a venda não. Isso precisa aparecer escrito em cada indicador.
  - O % de meta batida vem de um histórico que existe desde 03/06/2026, mas só grava de qualquer tela desde 14/09/2026. Antes disso, subconta.
  - A passagem entre etapas só existe desde 14/09/2026, 18h10 (`STAGE_TRACKING_SINCE`, `src/lib/crm/scope.js:11-24`). O `convertedAt` foi zerado por mudança de fase entre 30/06/2026 e 08/09/2026, então a matrícula do CRM nesses meses depende de `clienteSince`.
  - O parâmetro de mês aceita só os 12 meses até o corrente (`src/lib/screenParams.js:58-65`). A série cabe nessa janela, mas precisa de um parâmetro próprio para o intervalo.


### 5.10 Indicações

Este domínio mostra quem indica, quantos indicados matriculam, por onde eles chegaram e quem ainda não indicou ninguém, e dá a base para a academia decidir uma recompensa. O limite é que o vínculo é estado do lead, não histórico: `referredAt` é regravado a cada troca de indicador e zerado quando o vínculo é removido, e o canal só fica gravado quando a pessoa entra pelo link (`referralVia: 'link'`). Tudo começa em 10/08/2026, quando a PR #171 entrou na main, e o link só passou a exigir indicador válido em 03/09/2026. Nenhuma regra de recompensa está gravada no sistema.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R134 | Ranking de indicadores | Média | Com ajuste | Ajustado |
| R135 | Indicação contra as outras origens | Média | Com ajuste | Ajustado |
| R136 | Indicados matriculados no mês | Média | Com ajuste | Ajustado |
| R137 | Canal da indicação | Baixa | Com ajuste | Ajustado |
| R138 | Indicações por consultor | Baixa | Com ajuste | Ajustado |
| R139 | Fila de indicações sem indicador | Baixa | Com ajuste | Ajustado |
| R140 | Clientes que ainda não indicaram | Média | Com ajuste | Ajustado |

#### R134. Ranking de indicadores

Quais alunos mais indicam, quantos indicados matriculam e quanto de contrato eles trouxeram?

- Para quem: dono, gestor e consultor.
- Recortes: indicador, mês do vínculo, via (link ou manual) e consultor do indicador.
- Números: indicados, matriculados, em andamento, perdidos, conversão e valor vendido aos indicados.
- Filtros: período.
- Formato: ranking sem medalha.
- De onde vem: `stronix_leads.referredById` (o vínculo de hoje; consulta por `referredById != null`, ou por `referredAt` na janela com `createdAt` de reserva), `referredAt` (data do último vínculo, regravada; reserva em `createdAt`), `referralVia` (só existe com o valor `'link'`; ausente quer dizer manual ou retroativo), `createdAt` (para separar manual de retroativo), `lifecycleBucket` e `isClientLead` para matriculado, `status` `'Perda'` para perdido, `convertedAt` e `clienteSince` (a primeira matrícula é a mais antiga das duas), `consultantId` e `consultantName` do indicador (dono de hoje). Do contrato, `stronix_contratos.value`, `leadId` e `createdAt`, sem `isImportedContract` e com `value > 0`, que já chegam pela assinatura do `useGeneralConfig`.
- Desde quando: 10/08/2026 para vínculo e via, data do merge da PR #171. O cadastro pelo link só exige indicador válido desde 03/09/2026.
- Viabilidade e prioridade: com ajuste, média. Ficou fora do dashboard CRM, e a conta por indicador já está pronta em `summarizeReferrals`.
- Permissão e custo: gestor na tela. Dono e gestor são o mesmo papel, e esconder do consultor é só trava de tela, porque as regras do Firestore deixam qualquer membro ler leads e contratos (`firestore.rules:79-86`). Custo baixo: uma consulta de campo único em `referredAt`, ou em `referredById != null`, com índice automático, mais os docs dos indicadores lidos em lotes de 30 para saber o consultor. Contratos sem leitura nova.
- Já existe em: ficha → aba Indicações, cliente por cliente, com Indicados, Viraram alunos, Em andamento e Perdidos, sem valor (`src/components/profile/ReferralsSection.jsx:34` e `63-66`). O CSV de Todos os leads traz a coluna "Indicado por" (`src/views/LeadsView.jsx:138-140`).
- Conferência no código: ajustado. O que mudou:
  - Data de início. Os commits do vínculo são de 07/08/2026, mas a PR #171 só entrou na main em 10/08/2026 (merge `28ad875`). Em produção, vínculo e via existem desde 10/08.
  - Não existe "via manual" gravada. `referralVia` só é escrito pelo link público (`api/tenant-resolve.js:282`). No cadastro manual, no vínculo retroativo da ficha e em Configurações o campo fica ausente. Manual se deduz pela falta do campo, e retroativo pela distância entre `referredAt` e `createdAt`.
  - `referredAt` é estado, não evento. `commitReferralLink` regrava o campo a cada troca de indicador (`src/lib/referralsWrites.js:37`) e `removeReferralLink` zera o campo (`src/lib/referralsWrites.js:76`). No vínculo retroativo a data é a do vínculo, não a da chegada do lead. O mês do vínculo muda depois de uma edição.
  - No cadastro manual, `referredAt` só é gravado pelo `commitReferralLink`, que roda depois de criar o lead e, se falhar, não trava o cadastro (`src/modals/AddLeadModal.jsx:469-470` e `487-498`). Nesse caso o lead fica com `referredById` e sem `referredAt`, e some de uma consulta por `referredAt` na janela. Por isso a reserva em `createdAt`, como já faz `sortReferrals` (`src/lib/referrals.js:131-139`), ou a consulta por `referredById != null`.
  - Matriculado não pode depender só de `clienteSince`. Etapa com nome de matrícula carimba `convertedAt` sem `clienteSince` (`src/lib/stageMove.js:94-96`; `src/views/LeadProfileView.jsx:393-397`), e `clienteSince` só é gravado pelo contrato e pela importação (`src/lib/contractsWrites.js:116`; `src/lib/clientImport.js:626` e `647`). Use `isClientLead`, como `summarizeReferrals` (`src/lib/referrals.js:120-129`), e para a data a mais antiga entre `convertedAt` e `clienteSince` (`src/lib/crm/cohort.js:18-27`).
  - O valor vendido deixa fora contrato importado (`isImportedContract`) e `value <= 0`, e avisa que é valor de contrato, não caixa. Falta decidir se entra só a primeira matrícula ou também as renovações do indicado. A importação pode pôr contrato num lead que já existe (`src/lib/clientImport.js:640-650`).
  - O público citava o consultor, e a permissão falava em gestor e dono. Não existe papel de dono: só `admin` e `consultant`. Restringir é trava de tela.
  - O consultor do indicador é o dono de hoje do lead indicador. Para saber quem é, leia os docs dos indicadores por id, em lotes de 30, ou cruze com a lista de clientes. O nome sai da lista da equipe, que também chega ao consultor numa leitura por sessão (`src/App.jsx:843-852`), ou do `consultantName` do lead.
  - Entre 10/08 e 03/09/2026 o link aceitava cadastro sem indicador válido: o lead entrava com `referralVia: 'link'` e sem `referredById`. Só depois do `ca67691` (PR #194) o link passou a exigir indicador (`api/tenant-resolve.js:205-215`).
  - Evidências: `api/tenant-resolve.js:277-285` (o link grava `referredById`, `referredAt`, `referralVia: 'link'` e herda o consultor do indicador) e `src/lib/referrals.js:120-129` (aluno por `isClientLead`, perda por `status`).

#### R135. Indicação contra as outras origens

O indicado converte mais, mais rápido e com ticket maior que os outros canais?

- Para quem: dono.
- Recortes: tipo (com vínculo, origem Indicação sem vínculo, outra origem) e mês.
- Números: leads, conversão, dias até a matrícula e ticket, com o número de leads de cada grupo ao lado.
- Filtros: período.
- Formato: comparativo.
- De onde vem: `stronix_leads.referredById` (tipo com vínculo), `source` normalizado contendo "indica" (origem Indicação sem vínculo), `createdAt` (safra e início da contagem de dias), `convertedAt` e `clienteSince` (a primeira matrícula é a mais antiga das duas), `funnelId` e `lifecycleBucket` (recorte de funil e estado). Do primeiro contrato, `stronix_contratos.value` e `durationMonths`, sem importado e com `value > 0`.
- Desde quando: 10/08/2026 para o vínculo. A origem "Indicação" é anterior e vale desde o cadastro de cada lead. Os contratos existem desde junho de 2026.
- Viabilidade e prioridade: com ajuste, média. Precisa definir o que conta como indicação, e o vínculo retroativo distorce o tempo.
- Permissão e custo: gestor na tela. Dono e gestor são o mesmo papel, e a trava é só de tela, porque as regras deixam todo membro ler (`firestore.rules:79-86`). Custo baixo a médio: os leads por `createdAt` na janela, a mesma consulta de safra do CRM, e os contratos que já estão em memória.
- Já existe em: em parte. O card de canais do CRM agrupa os leads novos pela origem e conta quantos matricularam (`channelsOf`, `src/lib/crm/cohort.js:104-116`), mas não separa quem tem vínculo, não mede os dias por canal e não tem ticket.
- Conferência no código: ajustado. O que mudou:
  - Origem e vínculo discordam. O modo indicação do cadastro e o link fixam a origem "Indicação" (`src/modals/AddLeadModal.jsx:392`; `api/tenant-resolve.js:267`). O vínculo retroativo e a mudança para o funil de Indicações não trocam a origem (`src/views/LeadProfileView.jsx:389-390`). Então existe lead com vínculo e outra origem. A classificação segue uma ordem fixa: primeiro o vínculo, depois a origem que contém "indica" (a mesma normalização de `pendingReferralOwners`, `src/lib/referrals.js:155`), por último as demais.
  - A origem é texto do catálogo, e renomear faz cascata só nos leads. O comparativo agrupa pelo nome de hoje.
  - A safra e os dias até a matrícula saem de `createdAt` e da mais antiga entre `convertedAt` e `clienteSince` (`src/lib/crm/cohort.js:18-27`), nunca de `referredAt`, que no vínculo retroativo é a data do vínculo (`src/lib/referralsWrites.js:37`). A justificativa já apontava o problema; faltava dizer qual campo usar.
  - Ficam fora o lead importado (`isImportCreatedLead`) e a matrícula importada, como o CRM faz (`src/lib/crm/cohort.js:29-53`), e os funis de cliente pela `systemKind` (`src/lib/crm/scope.js:25-37`). O funil de Indicações entra.
  - O ticket segue o Gerencial: `value ÷ durationMonths`, sem contrato importado e sem `value <= 0` (`src/lib/gerencial/scope.js:11-21`). O relatório avisa que é valor de contrato, não caixa, e usa só o primeiro contrato do indicado, senão as renovações misturam os canais.
  - Não existe papel de dono separado do gestor, e as regras deixam todo membro ler.
  - O vínculo existe em produção desde 10/08/2026, não 07/08. A base é pequena, cerca de um mês e meio, por isso o número de leads de cada grupo aparece na tela.
  - Evidências: `src/views/LeadProfileView.jsx:380-390` (o vínculo retroativo não mexe em `source`) e `src/lib/crm/cohort.js:18-54`.

#### R136. Indicados matriculados no mês

Quem ganha recompensa este mês por indicado que fechou a primeira matrícula?

- Para quem: dono e gestor.
- Recortes: indicador e mês da primeira matrícula do indicado.
- Números: indicados matriculados e valor dos contratos.
- Filtros: mês.
- Formato: tabela nominal exportável.
- De onde vem: `stronix_leads.convertedAt` e `clienteSince` (a primeira matrícula é a mais antiga das duas; uma consulta de campo único por mês para cada campo), `referredById`, `referredByName` e `referredAt` filtrados na memória, e `stronix_contratos.value`, `createdAt` e `leadId`, sem `isImportedContract` e com `value > 0`. Para conferência, e só se quiser, `stronix_interactions` do tipo `'referral'` com o texto de matrícula do indicado, que só o fluxo de contrato grava.
- Desde quando: 10/08/2026.
- Viabilidade e prioridade: com ajuste, média. Não existe regra de recompensa no sistema, então a conta sai do estado do indicado.
- Permissão e custo: gestor na tela, porque as regras liberam a leitura para todos. Custo baixo: reaproveita as consultas de `convertedAt` e `clienteSince` do mês que o CRM já faz, e os contratos estão em memória.
- Já existe em: nada parecido hoje. O indicador recebe um aviso na linha do tempo da ficha quando o indicado fecha contrato, um de cada vez (`src/lib/contractsWrites.js:139-153`).
- Conferência no código: ajustado. O que mudou:
  - A interação não serve para contar. O aviso de matrícula (tipo `'referral'`, texto "<nome> que você indicou fechou matrícula") só é gravado pelo fluxo de contrato (`src/lib/contractsWrites.js:139-153`). A matrícula feita por etapa com nome de matrícula, no Kanban ou na ficha, não gera o aviso (`src/lib/stageMove.js:94-96`). E o `notifyReferrerId` dispara em toda matrícula que não é renovação, inclusive no retorno de ex-cliente (`src/lib/contracts.js:221-226`), então não marca só a primeira.
  - O mês da primeira matrícula não pode ser só `clienteSince`, porque a matrícula por etapa carimba `convertedAt` sem `clienteSince`. Vale a mais antiga das duas, como em `src/lib/crm/cohort.js:18-27`, com as duas consultas de campo único que o CRM já faz (`src/hooks/useCrmSources.js:146-154`), e `referredById` filtrado na memória.
  - Fica fora a matrícula importada, porque a importação carimba `clienteSince` com a data da planilha num lead que já existe (`src/lib/clientImport.js:647`). Vale a mesma regra de `src/lib/crm/cohort.js:29-53`.
  - Vínculo retroativo depois da matrícula: um cliente dentro do funil de Indicações pode ganhar indicador depois de matriculado (`src/views/LeadProfileView.jsx:1245-1248` e `440-444`). A regra de recompensa decide se isso conta, e o relatório mostra `referredAt` ao lado.
  - Valor dos contratos: sem importado e com `value > 0`, avisando que é valor de contrato, não caixa. Contrato cancelado depois continua na venda do mês.
  - Na exportação, o CSV neutraliza os valores como no `LeadsView` (`src/views/LeadsView.jsx:127-146`), e nome não vai no endereço nem no nome do arquivo.
  - Em produção desde 10/08/2026.
  - Evidências: `src/lib/contracts.js:221-226` (`notifyReferrerId` em toda matrícula que não é renovação) e `src/lib/stageMove.js:94-96` (matrícula por etapa só carimba `convertedAt`).

#### R137. Canal da indicação

O link de indicação está sendo usado, e quantos tentam se cadastrar de novo?

- Para quem: dono e gestor.
- Recortes: canal (link, manual, retroativo), mês e indicador.
- Números: indicados, matrículas e tentativas duplicadas.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_leads.referralVia` (`'link'` ou ausente), `referredAt` e `createdAt` (para separar manual de retroativo), `referredById` (nulo com `referralVia: 'link'` é cadastro sem indicador, entre 10/08 e 03/09/2026), `stronix_interactions` com `type == 'referral'` e texto começando com "Tentou se cadastrar" (com `createdAt` filtrado na memória), e `lifecycleBucket`, `convertedAt` e `clienteSince` para a matrícula.
- Desde quando: 10/08/2026 para o link e a tentativa duplicada. Cadastro com indicador obrigatório só desde 03/09/2026.
- Viabilidade e prioridade: com ajuste, baixa. A tentativa duplicada só se reconhece pelo texto.
- Permissão e custo: gestor. Custo baixo: as interações do tipo `'referral'` por igualdade (índice automático), filtradas por data na memória, mais os leads com `referredAt` ou `referralVia`.
- Já existe em: em parte. O sino do cabeçalho avisa quem entrou pelo link nos últimos 30 dias, com o consultor vendo só a própria carteira (`src/lib/notifications.js:21` e `52-61`). Não há contagem por canal.
- Conferência no código: ajustado. O que mudou:
  - Os canais manual e retroativo não estão gravados. `referralVia` só existe com o valor `'link'` (`api/tenant-resolve.js:282`). Manual e retroativo se separam pela distância entre `referredAt` e `createdAt`, e essa leitura se perde quando alguém troca o indicador (`src/lib/referralsWrites.js:37`).
  - A tentativa duplicada é uma interação do tipo `'referral'` que só se distingue pelo texto "Tentou se cadastrar pelo link de indicação" (`api/_referral.js:82-85`; `api/tenant-resolve.js:229-240`). O filtro é pelo começo do texto, e mudar esse texto quebra o relatório. A consulta viável é `where('type','==','referral')`, de igualdade em campo único, com a data filtrada na memória. `type` junto com `createdAt` pediria um índice composto que não está em `firestore.indexes.json`.
  - Não fica gravado o cadastro recusado por link sem indicador válido (resposta 403, `api/tenant-resolve.js:213-215`, desde 03/09/2026), nem o envio ou a cópia do link (`src/views/LeadProfileView.jsx:421-437` só copia para a área de transferência). "O link está sendo usado" mede só cadastros que deram certo e tentativas duplicadas, nunca aberturas nem compartilhamentos.
  - Entre 10/08 e 03/09/2026 o link aceitava cadastro sem indicador. Esses leads caíam no funil padrão com `referralVia: 'link'`, sem `referredById` e com o texto genérico (`api/tenant-resolve.js:310`). A série separa esses leads.
  - Matrículas por canal: `isClientLead` e a mais antiga entre `convertedAt` e `clienteSince`, nunca só `clienteSince`.
  - Excluir o lead apaga as interações dele (`src/views/LeadProfileView.jsx:215-236`), então a tentativa duplicada some junto com o lead que já existia.
  - Evidências: `api/tenant-resolve.js:219-241` (checagem de cadastro repetido e interação de tentativa) e `api/tenant-resolve.js:205-215` (403 sem indicador, commit `ca67691` de 03/09/2026). O campo `referralVia` entrou nos commits `904e4ea` e `5246619`, de 10/08/2026, dentro da PR #171.

#### R138. Indicações por consultor

Que consultor mais recebe e mais converte indicações?

- Para quem: gestor e consultor.
- Recortes: dono do indicado e mês.
- Números: indicados, matrículas e conversão.
- Filtros: período.
- Formato: tabela.
- De onde vem: `stronix_leads.consultantId` e `consultantName` (dono de hoje do indicado), `referredById`, `referredAt` e `createdAt`, `referralVia` (para separar o consultor herdado pelo link), e `lifecycleBucket`, `convertedAt` e `clienteSince`.
- Desde quando: 10/08/2026.
- Viabilidade e prioridade: com ajuste, baixa. O envio do link não é gravado.
- Permissão e custo: todos, porque as regras deixam qualquer membro ler leads (`firestore.rules:79-86`). Custo baixo: os mesmos leads com vínculo do R134.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - O dono do indicado é o `consultantId` de hoje. Ele muda com a troca de responsável e com a migração em massa (`src/views/settings/TransferLeadsTab.jsx:129-165`). Não é quem recebeu a indicação na época.
  - Quem nasce dono depende do caminho. No link, o indicado herda o consultor do cliente indicador (`api/tenant-resolve.js:283-285`). No cadastro manual, o dono é quem cadastrou (`src/modals/AddLeadModal.jsx:471`, `getLeadOwnershipFields` do usuário). No vínculo retroativo, o dono não muda. O relatório mistura quem recebeu com quem herdou, e `referralVia` ajuda a separar.
  - Matrículas: `isClientLead` e a mais antiga entre `convertedAt` e `clienteSince`, não só `clienteSince`, porque a matrícula por etapa não carimba `clienteSince`.
  - Nomes: a lista da equipe chega a todos os papéis, e ao consultor numa leitura por sessão (`src/App.jsx:843-852`). Quem saiu da equipe vai para Outros, como no CRM (`src/lib/crm/scope.js:50-63`).
  - A justificativa confere: copiar o link ou abrir no WhatsApp não grava nada (`src/views/LeadProfileView.jsx:421-437`).
  - Em produção desde 10/08/2026.
  - Evidências: `api/tenant-resolve.js:283-285` (o indicado pelo link herda o consultor) e `src/views/settings/TransferLeadsTab.jsx:129-165` (a migração em massa troca o dono).

#### R139. Fila de indicações sem indicador

Quantas indicações ainda não têm indicador, e quantas foram marcadas "não sei"?

- Para quem: gestor.
- Recortes: estado do lead e mês de cadastro.
- Números: pendentes, marcadas "não sei" e vinculadas.
- Filtros: nenhum.
- Formato: número e lista.
- De onde vem: `stronix_leads.source` (normalizado, contendo "indica"), `funnelId` (funil de Indicações pela `systemKind`), `referredById`, `referrerUnknown` (marca sem data) e `createdAt` (mês de cadastro).
- Desde quando: 10/08/2026 para `referrerUnknown` e a fila (commit `6d3bcfd`, dentro do merge `28ad875` da PR #171). A origem "Indicação" é anterior.
- Viabilidade e prioridade: com ajuste, baixa. Já existe em parte nas Configurações.
- Permissão e custo: gestor, pela trava da rota (`src/lib/routes.js:62`), que é só de tela. Custo médio: a tela lê os leads de todos os baldes (`src/views/settings/SettingsView.jsx:57-64`).
- Já existe em: Configurações → Indicações sem dono, só com a fila de pendentes (`src/views/settings/ReferralOwnersSection.jsx:218-222`) e o número no trilho (`src/views/settings/SettingsView.jsx:93`).
- Conferência no código: ajustado. O que mudou:
  - Não está pronto como a proposta dizia. A seção mostra só a fila de pendentes. Não conta os marcados "não sei" nem os já vinculados, e não quebra por mês.
  - `referrerUnknown` é uma marca sem data, sem autor e sem evento na linha do tempo (`src/views/settings/ReferralOwnersSection.jsx:58-63`). Dá para contar quantos estão marcados hoje, mas não quando nem por quem. Se o lead ganhar vínculo depois, a marca continua gravada junto com `referredById`.
  - O número do trilho conta sem o funil de Indicações (`pendingReferralOwners(leads)`, `src/views/settings/SettingsView.jsx:93`), e a seção conta com ele (`src/views/settings/ReferralOwnersSection.jsx:218-221`). Os dois números podem divergir. O relatório usa a regra com o funil.
  - "Vinculadas" precisa de definição: origem que contém "indica" ou lead no funil de Indicações, com `referredById`.
  - Custo médio confirmado, e a trava de gestor é só de tela.
  - Evidências: `src/lib/referrals.js:151-159` (`pendingReferralOwners`: origem com "indica" ou funil de Indicações, sem vínculo e sem `referrerUnknown`) e `src/views/settings/SettingsView.jsx:93`.

#### R140. Clientes que ainda não indicaram

Quantos clientes ativos nunca indicaram ninguém, quem são, e quanto tempo depois da matrícula quem indica faz a primeira indicação?

- Para quem: dono, gestor e consultor.
- Recortes: tempo de casa, dono de hoje, plano e se já indicou ou não.
- Números: clientes ativos, % que já indicou, mediana de dias da matrícula até a primeira indicação e lista nominal de quem nunca indicou.
- Filtros: contrato vigente e faixa de tempo de casa.
- Formato: contagem com a taxa sobre a base e lista nominal exportável.
- De onde vem: `stronix_leads.referredById != null` (todos os indicados, para montar o conjunto de quem já indicou; índice automático), `referredAt` e `createdAt` do indicado (a primeira indicação é a mais antiga das duas datas), leads com `lifecycleBucket == 'cliente'` (`clienteSince`, `convertedAt` e `consultantId`) e `stronix_contratos` (vigente, trancado e plano, já em memória pela assinatura do `useGeneralConfig`).
- Desde quando: 10/08/2026, quando o vínculo entrou em produção. Indicações anteriores só entram depois de resolvidas em Configurações → Indicações sem dono.
- Viabilidade e prioridade: com ajuste, média. Vira lista de campanha de indicação, a origem que o playbook comercial trata como a mais barata.
- Permissão e custo: todos pelas regras. O recorte do consultor na própria carteira é só de tela. Custo médio: os leads do balde cliente (centenas por academia) mais os indicados por `referredById != null`; contratos sem leitura nova.
- Já existe em: nada parecido hoje. A aba Indicações da ficha mostra só quem já indicou, cliente por cliente. O ranking de quem já indica é o R134.
- Conferência no código: ajustado. O que mudou:
  - "Nunca indicou" só vale para vínculos gravados desde 10/08/2026. Quem indicou antes, e cujo indicado ainda está na fila sem dono ou marcado `referrerUnknown`, aparece como quem nunca indicou. O relatório avisa e aponta para o R139.
  - A data da primeira indicação não pode ser só `referredAt`. No vínculo retroativo, `referredAt` é a data do vínculo, e ele é regravado a cada troca (`src/lib/referralsWrites.js:37`). Use a mais antiga entre o `createdAt` do indicado e o `referredAt`.
  - Remover o vínculo não mexe no indicador (`src/lib/referralsWrites.js:64-92`), mas o evento "Indicou <nome>" continua na linha do tempo dele. A fonte de "já indicou" é o `referredById` de hoje nos indicados, não as interações.
  - O tempo de casa começa no `clienteSince` do indicador. A importação carimba `clienteSince` com a data da planilha (`src/lib/clientImport.js:626`). Cliente antigo sem `clienteSince` cai no `convertedAt`.
  - Cliente ativo sai do contrato vigente (contratos já em memória), porque `isClientLead` inclui o cliente inativo com contrato vencido. Trancado continua cliente. Contrato paralelo conta a pessoa uma vez.
  - O consultor ver só a própria carteira é decisão de tela. As regras deixam qualquer membro ler todos os leads (`firestore.rules:79-80`), e nas listas de hoje o consultor não recorta por responsável e vê a academia inteira. Recortar aqui é escolha nova, no molde do Kanban.
  - A lista nominal exportável segue a regra do CSV (`src/views/LeadsView.jsx:127-146`). Nada de nome no endereço, e cada nome abre a ficha por `LeadLink`.
  - Nenhuma tela atual mostra quem ainda não indicou.
  - Só cliente pode indicar: o link aceita como indicador apenas lead com `lifecycleBucket` `'cliente'` (`api/tenant-resolve.js:113-125`).
  - Evidências: `src/lib/referralsWrites.js:37` e `64-92` (o vínculo é regravado e removido sem tocar no indicador) e `api/tenant-resolve.js:113-125`.


### 5.11 Perfil da base

Este domínio diz quem é o lead que chega e quem é o aluno que fica: idade, sexo, bairro, dor, modalidade de interesse e etiqueta. Também mostra qual desses perfis matricula mais e qual se perde mais. O limite está no próprio dado. Cada campo guarda só o valor de hoje, sem histórico, e fora da dor quase nada é obrigatório: o link público não pergunta dor, sexo nem nascimento, e profissão e estado civil só entram pelo Editar cadastro. Por isso todo número precisa vir junto com o % de quem não tem o dado.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R141 | Perfil e conversão por perfil | Média | Com ajuste | Ajustado |

#### R141. Perfil e conversão por perfil

Quem é o lead que chega e o aluno que fica, e qual perfil converte ou se perde mais?

- Para quem: dono, gestor e consultor. No sistema, dono e gestor são o mesmo papel (admin).
- Recortes: faixa etária, sexo, bairro e cidade, dor, modalidade de interesse, etiqueta, profissão, estado civil e balde (lead ativo, cliente ou perda).
- Números: pessoas, % do total, % sem o dado, conversão, perdas por motivo e ticket do contrato vigente (valor por mês).
- Filtros: período de cadastro, balde e origem.
- Formato: barras por faixa e tabela ou barras por bairro e cidade. O mapa por bairro saiu, porque hoje não tem como ser feito (ver a conferência).
- De onde vem: `stronix_leads.birthDate`, `sexo`, `address.neighborhood`, `address.city`, `dor`, `modalidade`, `tags`, `profession`, `maritalStatus`, `lifecycleBucket`, `createdAt`, `clienteSince`, `convertedAt`, `lossReason`, `lostAt`, `source`, `importBatchId` e `importSource`, mais `stronix_contratos.value`, `durationMonths`, `status`, a pausa e `cancelledAt`. O `modalidade` do lead é só o interesse marcado no cadastro. Não é a modalidade do plano que o aluno comprou.
- Desde quando:
  - Dor obrigatória no cadastro manual desde 30/06/2026 (PR #123).
  - Nascimento e sexo, opcionais, desde 30/06/2026 (PR #123).
  - Endereço, profissão e estado civil desde 21/07/2026 (PR #154), e só pelo Editar cadastro.
  - Dor, modalidade e sexo editáveis na ficha desde 21/07/2026 (PR #155).
  - A importação traz nascimento, sexo, dor e endereço desde 04/09/2026 (PR #195).
  - O link público grava dor, sexo e nascimento vazios desde 10/08/2026 (PR #171, que criou a página `/i/`).
  - É retrato do estado atual. Não existe série histórica do perfil.
- Viabilidade e prioridade: com ajuste, média. Nenhuma tela lê esses campos hoje, a cobertura é baixa fora da dor e a tela precisa mostrar o % sem o dado.
- Permissão e custo: as regras do Firestore deixam qualquer membro da academia ler todos os leads (`firestore.rules:79-80`), então qualquer restrição é trava só de tela. O agregado pode abrir para gestor e consultor, como os painéis. A lista nominal e a exportação por bairro ou profissão ficam com o gestor, e essa escolha ainda pede decisão sua, porque bairro, profissão e estado civil são dado pessoal. Filtro de bairro, cidade e profissão nunca vai para o endereço nem para o título da aba. Custo: a base inteira é um `getDocs` da coleção de leads, cerca de 2 a 3 mil leituras por abertura, mais 1 leitura do `tenantActive`, guardado na memória da sessão e sem assinatura ao vivo. O recorte por safra é uma consulta de campo único por `createdAt`, sem índice novo. O ticket não custa leitura extra, porque os contratos já chegam pela assinatura do `useGeneralConfig`.
- Já existe em: em parte. Configurações → Catálogos já conta quantos leads usam hoje cada dor, etiqueta, origem e motivo de perda (`countOf`, `src/views/settings/CatalogsSection.jsx:46,57,79,90`). A aba CRM da Visão geral já mostra perdas por motivo no mês (`LossCard`). Nada lê idade, sexo, bairro, profissão nem estado civil.
- Conferência no código: ajustado. O que mudou:
  - Datas. A dor passou a ser obrigatória em produção em 30/06/2026, e não em 25/06/2026, que é a data do commit `913258f`. O `canSubmit` do merge da PR #123 (`b2b0c9d`) já exigia a dor, e a PR #126 (`aafb25c`), no mesmo dia, refez o formulário e manteve a regra. Sexo e nascimento estavam certos (30/06/2026, PR #123, `b2b0c9d`). Endereço, profissão e estado civil entraram juntos em 21/07/2026 (PR #154, `9e134f5`), e a edição de dor, modalidade e sexo no mesmo dia (PR #155, `f7accb5`). A importação só grava sexo, nascimento, dor e endereço a partir de 04/09/2026 (PR #195, `eff0193`).
  - Fontes. Faltavam profissão, estado civil, bairro e cidade, que os recortes usam, e também `createdAt` (período de cadastro), `clienteSince` e `convertedAt` (conversão), `lossReason` e `lostAt` (perdas), `source` (filtro de origem), `importBatchId` e `importSource` (para tirar os importados) e os campos do contrato (ticket).
  - Cobertura muda com o caminho de entrada. O cadastro manual grava nascimento, sexo, dor e modalidade, com nascimento e sexo num bloco recolhido e opcional (`src/modals/AddLeadModal.jsx:461-466` e `:723`). Ele nunca grava endereço, profissão nem estado civil. O link público grava nascimento, sexo e dor como vazio e só leva a modalidade (`api/tenant-resolve.js:271-276`). A importação grava nascimento, sexo, dor e endereço quando a planilha tem a coluna, sempre com modalidade vazia, e nunca profissão nem estado civil (`src/lib/clientImport.js:205-210` e `:604-611`); em lead que já existe, só preenche o que está em branco (`src/lib/clientImport.js:372-380`). Profissão e estado civil só entram pelo lápis Editar cadastro da ficha, que vale para lead e para cliente (`src/lib/clientRegistration.js:48-73`). Ali o salvar exige só o nome, então a dor pode ser apagada (`src/modals/ClientRegistrationModal.jsx:66-67`).
  - Só o valor de hoje. Todos esses campos são sobrescritos e nenhum evento registra a troca. Serve para retrato, não para mostrar como o perfil mudou com o tempo. A idade sai do `birthDate` contada até hoje. Na visão por safra, a faixa etária tem que ser calculada na data do cadastro, e a tela precisa dizer isso.
  - Texto sem padrão. Bairro e cidade vêm do ViaCEP ou são digitados, e profissão é digitada. O sexo da importação passa do jeito que veio quando não é masculino, feminino ou outro (`src/lib/clientImport.js:98-105`). Sem acertar acento e maiúscula, o mesmo bairro vira duas linhas. Dor e etiqueta ficam gravadas pelo nome, e renomear no catálogo corrige só os leads. Renomear uma modalidade corrige só o `appointmentModality`, e só nos leads da lista carregada, nunca o `lead.modalidade` (`src/views/settings/SchedulingSection.jsx:132-141`). Depois de uma renomeação, a modalidade de interesse aparece partida em duas linhas.
  - O mapa por bairro saiu. O ViaCEP não devolve coordenada, nada guarda latitude e longitude, e o `package.json` não tem biblioteca de mapa (busca por leaflet, mapbox, maplibre, d3-geo e topojson sem resultado). O formato passou a ser tabela ou barras por bairro e cidade.
  - Conversão pelas regras do CRM. A matrícula conta pela primeira conversão, a menor data entre `convertedAt` e `clienteSince` (`src/lib/crm/cohort.js:18-27`). Lead e matrícula criados pela importação ficam fora (`isImportCreatedLead`, `src/lib/operacional/routine.js:98`). O filtro de balde usa o `lifecycleBucket`, em que cliente vem antes de perda (`src/lib/leadDerived.js:12-19`). Perdas por motivo contam só quem está em Perda hoje, porque desfazer a perda apaga o `lossReason` (`src/lib/crm/cohort.js:80-91`). O relatório tem que dizer isso, e deve usar a mesma conta do CRM em vez de refazer por fora.
  - Ticket pelas regras do Gerencial. É valor por mês (`value ÷ durationMonths`). Contrato com valor zero ou sem valor fica fora, o que inclui os 494 importados da STRONIX (`src/lib/gerencial/scope.js:11-21`). Trancado entra, e contrato paralelo conta duas vezes. Nunca é dinheiro que entrou no caixa.
  - Público e permissão não batiam. O público incluía o consultor e a permissão falava em "gestor e dono". Não existe papel de dono com acesso diferente: os papéis são só admin e consultant. Ficou o agregado aberto para todos, como nos painéis, e a lista nominal e a exportação pendentes de decisão.
  - Sobreposição. O campo vinha vazio, mas o Catálogos e o card de perdas do CRM já cobrem parte do relatório (ver Já existe em).
  - Custo. Ficou explícito que a base inteira é a coleção de leads toda, lida uma vez por sessão, sem índice composto quando o recorte é feito no navegador.
  - Evidências principais: `src/modals/AddLeadModal.jsx:410-411` (a dor entra no `canSubmit`, então é obrigatória no cadastro manual) e `src/lib/clientRegistration.js:48-73` (o Editar cadastro grava sexo, nascimento, dor, modalidade, estado civil, profissão, bairro e cidade por cima do que havia).


### 5.12 Qualidade da base

Este domínio mostra o que falta ou está torto na base e por isso deixa os outros relatórios cegos: agendamento sem desfecho, perda sem motivo, contrato sem valor, a mesma pessoa em dois cadastros, venda que ninguém lançou. Também cobre o rastro de quem mexeu na régua, apagou lead ou baixou lista. O limite está no próprio dado. Quase tudo aqui é retrato de hoje, sem histórico, e três relatórios (R146, R147 e R152) só existem depois que o sistema passar a gravar dado que hoje não guarda.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R142 | Pendências que cegam os relatórios | Alta | Com ajuste | Ajustado |
| R143 | Completude do cadastro | Média | Com ajuste | Ajustado |
| R144 | Importações por lote | Baixa | Com ajuste | Ajustado |
| R145 | Uso dos catálogos | Baixa | Pronto | Ajustado |
| R146 | Auditoria de configuração | Baixa | Precisa gravar dado novo | Ajustado |
| R147 | Trilha de exclusões e exportações | Média | Precisa gravar dado novo | Ajustado |
| R148 | Registro tardio | Média | Com ajuste | Ajustado |
| R149 | Mesma pessoa em dois cadastros | Alta | Com ajuste | Ajustado |
| R150 | Valores suspeitos em planos e contratos | Alta | Com ajuste | Ajustado |
| R151 | Conferência com o sistema de gestão | Média | Com ajuste | Ajustado |
| R152 | Autorização e pedidos do titular (LGPD) | Baixa | Precisa gravar dado novo | Ajustado |

No sistema, dono e gestor são o mesmo papel (admin). Onde este domínio fala em "dono", é trava de tela pelo `primaryAdminUid`, e não regra de permissão.

#### R142. Pendências que cegam os relatórios

O que está faltando registrar e deixa os números errados?

- Para quem: gestor, dono e super-admin.
- Recortes: tipo de pendência, dono do lead e lote de importação.
- Números: agendamentos passados sem desfecho, agendamentos órfãos, perdas sem motivo, origem ou etiqueta fora do catálogo, clientes sem contrato, contratos sem valor ou sem plano, contratos órfãos, pessoas com dois contratos vigentes (como informação, não como erro) e telefone repetido (que na prática é o R149).
- Filtros: pessoa e tipo.
- Formato: lista de pendências com a contagem de cada tipo e link para a ficha.
- De onde vem:
  - Aula: `stronix_aulas.status` e `outcomeAt`.
  - Visita: o espelho no lead (`stronix_leads.appointmentOutcome`, `appointmentScheduledFor` e `appointmentType`) e as interações `daily_goal_done` de `visita_hoje`.
  - Órfãos: `stronix_aulas.leadId` e `stronix_contratos.leadId` sem lead correspondente.
  - Perdas: `stronix_leads.lossReason`, `lostAt` e `lifecycleBucket`.
  - Catálogo: `stronix_leads.source` e `tags` contra `stronix_sources` e `stronix_tags`, com uma lista de origens de sistema permitidas.
  - Contratos: `stronix_leads.currentContractId` e `stronix_contratos` (`value`, `planId`, `importBatchId`).
  - Telefone: `stronix_leads.whatsappDigits` e `zapMatchKey`.
- Desde quando: retrato de hoje. Os agendamentos só têm base completa a partir de setembro de 2026 (`APPTS_COMPLETE_MONTH`, `src/lib/crm/scope.js:24`), os contratos existem desde junho de 2026 e o `lostAt` é gravado desde 29/04/2026, mas perda antiga sem o campo continua sem ele, porque nenhum backfill o preencheu.
- Viabilidade e prioridade: com ajuste, alta. O próprio sistema já avisa que, sem motivo cadastrado, "o relatório de perdas fica cego" (`src/lib/settingsSetup.js:163`), e este relatório vem antes de confiar em carteira e LTV.
- Permissão e custo: gestor, por trava de tela. As rules deixam qualquer membro ler tudo. O custo é alto e cresce com a base: todos os leads em todos os baldes (a mesma leitura do Configurações) mais as `stronix_aulas` passadas por `scheduledFor` (campo único, sem índice novo). Os contratos não custam leitura nova, porque já chegam pela assinatura do login. Roda sob demanda, nunca ao abrir a tela. `count()` não serve para a maioria dos itens.
- Já existe em: só em parte, em Configurações → Visão geral. Ali aparecem as pendências de configuração (catálogo vazio, funil raso), não as de registro. Os dois se completam.
- Conferência no código: ajustado. O que mudou:
  - Visita não recebe desfecho no registro. `applyOutcomeToAula` só age pelo `lead.currentAulaId`, que só a aula grava (`src/lib/aulasWrites.js:87-100`), e a visita é achada por `leadId`, sem ponteiro no lead (`src/lib/aulasWrites.js:57-65`). Toda visita fica "agendada" em `stronix_aulas` para sempre. Ler a pendência só pelo `status` acusaria toda visita que já teve desfecho. Para visita vale a inferência do CRM: o espelho do lead mais o `daily_goal_done` de `visita_hoje` (`src/lib/crm/appointments.js:81-104`).
  - Dois contratos vigentes não é pendência. Contrato paralelo é permitido desde a decisão de 14/09/2026, então entra como informação.
  - Origem fora do catálogo precisa de lista de exceções. A importação grava "Importação NextFit" ou "Importação por planilha" (`src/lib/clientImport.js:564` e `:613`) e o cadastro por indicação grava "Indicação" fixo (`src/modals/AddLeadModal.jsx:359`, `api/tenant-resolve.js:267`). Nada disso precisa estar no catálogo.
  - Cliente sem contrato mistura dois casos. O cliente de antes de junho de 2026 não tem contrato e isso é esperado. A pendência de verdade é a matrícula feita por etapa ("Matriculado" ou "Convertido") sem contrato. O relatório tem que separar os dois.
  - Perda sem motivo pega o legado. O backfill não gravou `lostAt` (`src/views/KanbanView.jsx:614-615`), e o modal de perda aceita "Sem motivo configurado" quando o catálogo está vazio (`src/modals/LossReasonModal.jsx:8`).
  - Órfãos saem de outra fonte. O `currentContractId` só é gravado na matrícula e na importação (`src/lib/contractsWrites.js:104`, `src/lib/clientImportWrites.js:114`). Contrato órfão é `stronix_contratos.leadId` sem lead, e agendamento órfão é `stronix_aulas.leadId` sem lead. As duas coleções não aceitam exclusão (`firestore.rules:242` e `:253`), e excluir a ficha apaga só o lead e as interações (`src/views/LeadProfileView.jsx:216-236`). Já existe `scripts/cleanup-orphan-aulas.js`.
  - `count()` não resolve. Ele roda no navegador com as rules de hoje, mas não sabe dizer "fora do catálogo", "órfão" nem "dois vigentes". Isso pede a base inteira na memória, que o Configurações já lê (`src/views/settings/SettingsView.jsx:57-64`).
  - A sobreposição com a Visão geral é parcial: ela lista pendências de configuração (`src/lib/settingsSetup.js:143-196`), não de dado registrado.
  - Telefone repetido idêntico já é bloqueado no cadastro manual, no link e na importação. O que passa é o mesmo número em outro formato, e isso é o R149.

#### R143. Completude do cadastro

Quanto da base tem CPF, e-mail, nascimento, endereço, contato de emergência, foto e dor?

- Para quem: gestor e dono.
- Recortes: campo, balde (lead ativo, cliente, perda) e dono.
- Números: % preenchido e pessoas sem o dado.
- Filtros: balde e pessoa.
- Formato: barras por campo e lista de quem falta.
- De onde vem: `stronix_leads.cpf`, `rg`, `email`, `birthDate`, `sexo`, `maritalStatus` e `profession`; `address` (mapa com `street`, `number` e `city`); `emergencyContact` (mapa com `name` e `phone`); `photoUrl`; `dor`; `importBatchId` e `referralVia` para a via de entrada; `lifecycleBucket` e `consultantId`.
- Desde quando: retrato de hoje, mas cada campo tem a sua data. CPF, e-mail e nascimento vêm de antes. Endereço, contato de emergência, RG, estado civil e profissão desde 21/07/2026 (PR #154, merge `9e134f5`; o commit `d24e8cb` é de 20/07). Foto desde 20/08/2026 (commit `b0af9c8`, PR #186).
- Viabilidade e prioridade: com ajuste, média. O medidor `COMPLETENESS_CHECKS` já existe, mas não mede foto nem dor.
- Permissão e custo: gestor, por trava de tela. Custo alto: a base de clientes (`lifecycleBucket == 'cliente'`, índice que já existe) ou a base inteira para cruzar por balde. Sem índice novo.
- Já existe em: o medidor de completude do Cadastro completo, uma pessoa por vez, dentro do modal. Nada soma a base.
- Conferência no código: ajustado. O que mudou:
  - O medidor não está pronto para o relatório. `COMPLETENESS_CHECKS` mede nome, WhatsApp, CPF, RG, nascimento, sexo, e-mail, endereço (rua, número e cidade), emergência (nome e telefone), estado civil e profissão (`src/lib/clientRegistration.js:113-125`). Não mede foto nem dor. Ele roda sobre o formulário do modal, então cada lead precisa passar antes por `readClientRegistration`, porque `address` e `emergencyContact` são mapas no documento (`src/lib/clientRegistration.js:20-44`).
  - Cada campo tem a sua data. O `photoUrl` só é gravado pela ficha (`src/views/LeadProfileView.jsx:163`) desde 20/08/2026. Endereço, emergência, RG, estado civil e profissão desde 21/07/2026. Como é retrato, uma data única para tudo não serve.
  - A via de entrada explica boa parte do buraco. O link público grava dor, e-mail, nascimento e sexo vazios (`api/tenant-resolve.js:271-275`), e a importação só grava o que a planilha traz (`src/lib/clientImport.js:600-611`). No cadastro manual a dor é obrigatória (`src/modals/AddLeadModal.jsx:410-411`). O relatório precisa mostrar a via para não culpar o consultor.
  - O recorte por balde pede a base inteira. A assinatura global do login só traz o balde ativo.
  - Achado desta conferência: `importBatchId` sozinho não marca a via importação. O lead que já existia e casou com a planilha também ganha a marca e mantém a origem de quando foi cadastrado. Quem foi criado pela importação é o que o `isImportCreatedLead` reconhece, com a marca do lote e a origem começando com "Importação" (`src/lib/operacional/routine.js:98-99`).

#### R144. Importações por lote

O que entrou em cada importação e o que ficou sem valor ou com data inferida?

- Para quem: dono, gestor e super-admin.
- Recortes: lote, origem (NextFit ou planilha) e data.
- Números: cadastros novos, promovidos a cliente, contratos, contratos sem valor e datas inferidas.
- Filtros: lote.
- Formato: tabela por lote.
- De onde vem: `stronix_interactions` com `type` 'import' (`importBatchId`, `importedAt`, `leadId`); `stronix_contratos.importBatchId`, `importedAt`, `startsAtInferred`, `value` e `planId`; `stronix_leads.importBatchId`, que guarda só o último lote.
- Desde quando: 04/09/2026 (PR #195).
- Viabilidade e prioridade: com ajuste, baixa. Uso pontual.
- Permissão e custo: gestor e super-admin, por trava de tela. A tela de importação só aparece na sessão assumida (`src/views/settings/SettingsView.jsx:100`). Custo baixo: interações e contratos por igualdade em `importBatchId` (campo único, índice automático). Os contratos já estão em memória.
- Já existe em: Configurações → Importação, com o relatório CSV. Só que esse CSV fica no navegador de quem importou, na hora, e não é gravado.
- Conferência no código: ajustado. O que mudou:
  - Não existe documento do lote. O `importBatchId` é um UUID sem data e sem rótulo (`src/views/settings/ImportClientsSection.jsx:37-39` e `:255-261`). A data sai de `importedAt`.
  - O lead guarda só o último lote. Os carimbos (`importBatchId`, `importSource`, `importedBy`) são regravados a cada reimportação (`src/lib/clientImport.js:595`, `:632` e `:646`). Para saber o que cada lote tocou, é preciso ler as interações `type` 'import' e os contratos, que levam o `importBatchId` cada um (`src/lib/clientImportWrites.js:105-133`).
  - Cadastro novo e promovido a cliente ganham os mesmos carimbos, e o texto da interação é o mesmo nos dois casos (`src/lib/clientImport.js:567-570`). Para o último lote, o que separa é a origem: o criado pela importação leva "Importação ..." e o que já existia mantém a sua (`src/lib/operacional/routine.js:93-99`). Para lotes anteriores, a pista é o lead ter interação antes da importação. Não achei campo que grave essa distinção por lote.
  - Data inferida só existe no contrato (`startsAtInferred`, `src/lib/clientImport.js:494-529`). O aviso "Sem data histórica: conta como venda de hoje" do lead fica só no relatório local (`src/lib/clientImport.js:593`).
  - Linhas ignoradas, inválidas ou repetidas no arquivo não chegam ao Firestore.
  - Correção desta conferência: o efeito colateral apontado antes não acontece. Um lead manual que casou com a planilha ganha `importBatchId`, mas continua na prospecção do Operacional, porque o `isImportCreatedLead` exige também a origem "Importação ..." e esse lead mantém a origem de quando foi cadastrado (`src/lib/operacional/routine.js:93-99`, corrigido no commit `28b59e7`, em produção desde 14/09/2026 com a PR #206).

#### R145. Uso dos catálogos

Que itens de catálogo ninguém usa e quais concentram a base?

- Para quem: gestor.
- Recortes: catálogo e item.
- Números: leads que usam o item e % da base.
- Filtros: nenhum.
- Formato: tabela.
- De onde vem: `stronix_sources`, `stronix_tags`, `stronix_loss_reasons`, `stronix_dores` e `stronix_planos`, contra `stronix_leads.source`, `tags`, `lossReason`, `dor` e `currentPlanName`.
- Desde quando: retrato de hoje.
- Viabilidade e prioridade: pronto, baixa. Já existe quase inteiro.
- Permissão e custo: gestor (Configurações é tela de gestor). As rules deixam qualquer membro ler os catálogos e só o admin escrever (`firestore.rules:136-185`). Dentro de Configurações não há leitura nova, porque a tela já carrega a base inteira. Fora dali o custo é alto: a base inteira.
- Já existe em: Configurações → Catálogos, na coluna de uso de cada item.
- Conferência no código: ajustado. O que mudou:
  - Já existe quase tudo. A tela mostra, para cada etiqueta, origem, plano, motivo de perda e dor, quantos leads usam o item, contados sobre todos os leads que o Configurações lê (`src/views/settings/CatalogsSection.jsx:40-95` e `:377-400`). A exclusão de item em uso já é bloqueada (`:177-196`). Pela regra de cada número num lugar só, o relatório se justifica pelo que falta: o % da base e o caminho inverso, o valor gravado no lead que não está no catálogo (que é o item "fora do catálogo" do R142).
  - A contagem é do valor de hoje no lead. Interações, aulas e contratos antigos guardam o nome antigo, e o plano conta pelo `currentPlanName`.
  - Faltam dois catálogos: modalidades (`stronix_modalities`) e unidades (`stronix_units`) não entram no Catálogos.

#### R146. Auditoria de configuração

Quem mudou metas, marcos, etapas e catálogos, e quando?

- Para quem: dono.
- Recortes: tipo de mudança, autor e data.
- Números: alterações, com o valor antes e depois.
- Filtros: período.
- Formato: tabela.
- De onde vem: coleção nova de histórico de configuração, gravada no mesmo batch de cada escrita de configuração, catálogo, funil, etapa e meta individual.
- Desde quando: a partir do dia em que começar a gravar.
- Viabilidade e prioridade: precisa gravar dado novo, baixa. Hoje mudar a régua muda meses fechados sem deixar rastro.
- Permissão e custo: gestor na regra do Firestore. "Só o dono" (`primaryAdminUid`) é trava de tela. Custo baixo.
- Já existe em: nada parecido hoje dentro da academia. O `superadmin_audit` registra só as ações de plataforma do super-admin.
- Conferência no código: ajustado. O que mudou:
  - A coleção nova precisa de match próprio nas `firestore.rules` (criação pelo admin, sem update e sem delete), publicado à mão no console. Coleção sem match é negada.
  - Não existe papel de dono nas rules. O dono é o `primaryAdminUid`, então "só o dono" é trava de tela e qualquer gestor consegue ler pelo SDK.
  - As escritas acontecem no navegador e em muitos lugares: `stronix_config/general` (`PaceSection` e `src/views/settings/SchedulingSection.jsx:106-127`), `stronix_users.dailyVolumeTarget` (`src/views/settings/PaceSection.jsx:84-86` e `:125-126`), funis e etapas (`src/views/settings/FunnelsSection.jsx:71`, `:149`, `:175` e `:234`) e catálogos com a cascata de renomear nos leads (`src/views/settings/CatalogsSection.jsx:82`). Cada caminho precisa gravar o registro junto, senão a trilha fica com furo.
  - Hoje só existe o `superadmin_audit`, gravado pelo servidor (`firestore.rules:282-284`, `api/_audit.js` chamado por `api/impersonate.js:3`). A escrita em `stronix_config` já é só do admin (`firestore.rules:186-190`).

#### R147. Trilha de exclusões e exportações

Quem excluiu leads, quem baixou listas com telefone, quantas linhas e quando?

- Para quem: gestor e dono.
- Recortes: ação (exclusão ou exportação), autor, tela ou relatório de origem e mês.
- Números: exclusões, exportações, linhas exportadas e interações apagadas junto.
- Filtros: período e autor.
- Formato: lista por data e autor, sem nenhum dado pessoal do que foi exportado.
- De onde vem: trilha nova de exclusão e exportação (autor, ação, tela, linhas, quantidade de interações apagadas), sem dado pessoal. Pontos que precisam gravar: exclusão na ficha (`LeadProfileView`, `handleDelete`), exportação de leads (`LeadsView`, `exportToCSV`), exportação de agendamentos em CSV e impressão (`AppointmentExportModal`), CSV da importação (`ImportClientsSection`), exclusões em `CatalogsSection`, `FunnelsSection` e `SchedulingSection` (`deleteDoc`) e exclusão de membro da equipe (`api/admin-users`).
- Desde quando: a partir do dia em que começar a gravar.
- Viabilidade e prioridade: precisa gravar dado novo, média. É LGPD e é confiança nos números: um lead apagado some de todos os meses passados sem rastro.
- Permissão e custo: gestor, com regra nova de leitura só para admin. "Dono" só como trava de tela. Custo pequeno.
- Já existe em: nada parecido hoje. O R146 audita configuração e o `superadmin_audit` audita a plataforma. Nada registra exclusão nem exportação dentro da academia, e o consultor hoje baixa a lista de leads com telefone.
- Conferência no código: ajustado. O que mudou:
  - Faltavam pontos de exportação: o CSV da importação (`src/views/settings/ImportClientsSection.jsx:298`) e a versão para impressão ou PDF dos agendamentos (`src/modals/AppointmentExportModal.jsx:174-181`, `src/lib/appointmentReport.js:128`). Faltavam também as outras exclusões: membro da equipe, item de catálogo, funil e etapa.
  - A trilha gravada pelo navegador é de boa-fé. Qualquer membro lê a base inteira pelo SDK sem passar pelo botão. O registro mostra o uso da tela e não prova que não houve vazamento.
  - Pelas rules, o dono do lead também pode excluir o lead (`firestore.rules:85`, `ownsLead`). Mas o botão só aparece para o gestor (`src/views/LeadProfileView.jsx:1319-1321`), e as interações só podem ser apagadas pelo admin (a regra também aceita quem tiver `consultantAuthUid` igual ao login, campo que nenhuma interação grava, `firestore.rules:93-94`). Na prática, só o gestor exclui. A exclusão hoje não deixa registro (`src/views/LeadProfileView.jsx:216-236`), e a exportação de leads leva nome e WhatsApp (`src/views/LeadsView.jsx:123-155`).
  - O registro precisa sobreviver ao lead: coleção própria, sem dado pessoal, com rules só de acréscimo publicadas à mão.
  - Excluir o lead deixa contratos e aulas órfãos com `leadName`, porque as duas coleções não aceitam exclusão (`firestore.rules:242` e `:253`). O relatório pode contar esses órfãos.

#### R148. Registro tardio

Quanto do que acontece é lançado depois do fato (agendamento criado depois da data marcada, desfecho marcado dias depois, contrato lançado depois do início da vigência, cancelamento com data retroativa), e por quem?

- Para quem: gestor.
- Recortes: tipo de registro, pessoa, faixa de atraso (mesmo dia, 1 a 2 dias, 3 a 7, mais de 7) e mês.
- Números: registros, % lançado no mesmo dia, atraso mediano e lista dos maiores atrasos.
- Filtros: sem importados e sem registros de backfill.
- Formato: tabela por pessoa e tipo, com a lista dos maiores atrasos.
- De onde vem: `stronix_aulas.createdAt`, `scheduledFor`, `outcomeAt` (só aula) e `type`; `stronix_interactions` `daily_goal_done` de `visita_hoje` (desfecho de visita) e `status_change` (autor e hora do lançamento da matrícula e do cancelamento); `stronix_contratos.createdAt`, `startsAt`, `cancelledAt`, `updatedAt`, `renewedFromId` e `importBatchId`.
- Desde quando: aulas desde 16/07/2026. Visitas desde 18/08/2026, com a data do desfecho vinda só da linha do tempo. Contratos desde junho de 2026. Os registros de backfill saem por corte de data.
- Viabilidade e prioridade: com ajuste, média. Mostra quanto dá para confiar nos números de cada pessoa e protege a regra de ouro.
- Permissão e custo: gestor, por trava de tela. Os contratos não pedem leitura nova. As aulas vêm por `scheduledFor` na janela (campo único). As interações vêm por `createdAt` na janela, ou por `leadId`, com o filtro de tipo feito na memória.
- Já existe em: nada parecido hoje. O R112 mede se o follow-up acontece no dia marcado, e o R142 lista as pendências sem desfecho. Nenhum mede quanto se lança atrasado. Pela regra de ouro, sem registro na hora não há direito à venda, então o atraso vira disputa de comissão.
- Conferência no código: ajustado. O que mudou:
  - Visita não tem `outcomeAt` em `stronix_aulas`, porque só a aula recebe desfecho no registro (`src/lib/aulasWrites.js:87-100`). Para visita, o atraso do desfecho sai do `createdAt` da interação `daily_goal_done` de `visita_hoje`, ou do `lead.appointmentOutcomeAt`, que só guarda o último compromisso.
  - "Por quem" não sai do registro. O `consultantId` da aula e o do contrato são do dono do lead, não de quem lançou (`src/lib/aulasWrites.js:33-44`, `src/lib/contracts.js:175-181`). O autor está em `actorId` e `actorAuthUid` da interação que acompanha a escrita (`status_change` na matrícula e no cancelamento, `src/lib/contractsWrites.js:20-57`).
  - Os registros de backfill não têm marca. O `createdAt` é a hora em que o script rodou (`scripts/backfill-aulas.js:157`, `scripts/backfill-appointments.js:238`), e o dia de cada execução não está no repositório. Para tirar esses registros é preciso saber essas datas por fora ou usar um corte de data.
  - Cancelamento: o `cancelledAt` é a data escolhida no modal (`src/lib/contracts.js:238-252`, `src/modals/ContractOutcomeModal.jsx:98-118`). A hora do lançamento está no `updatedAt` do contrato (regravado a cada alteração) e no `createdAt` da interação `status_change` cujo texto começa com "Contrato cancelado". Essa interação não tem `contractId`, então o casamento é por lead e texto.
  - Início da vigência antes do lançamento nem sempre é atraso, porque a matrícula pode ter data de início escolhida. Os importados saem pelo `isImportedContract` (`src/lib/contracts.js:271`).
  - Remarcar aula muda o `scheduledFor` no mesmo registro aberto sem mexer no `createdAt`. Uma remarcação para a frente pode parecer adiantada e nunca parece atrasada. Fica como nota.

#### R149. Mesma pessoa em dois cadastros

Quem está cadastrado duas vezes (número em outro formato, com ou sem o nono dígito ou o 55, mesmo CPF, ou mesmo nome e nascimento), e quantas "matrículas novas" eram na verdade retorno de ex-cliente?

- Para quem: gestor e dono.
- Recortes: tipo de coincidência (mesma chave DDD mais 8 dígitos, mesmo CPF, mesmo nome e nascimento), balde de cada cadastro, dono, origem e via de entrada (manual, link, importação).
- Números: pares suspeitos, pares com contrato nos dois cadastros, vendas contadas como matrícula nova que seriam retorno e contatos em que o cartão do Stronizap pode mostrar a pessoa errada.
- Filtros: tipo de coincidência, balde, dono e período de cadastro.
- Formato: lista de pares com link para as duas fichas e contagem por tipo.
- De onde vem: `stronix_leads` (`zapMatchKey`, `whatsappDigits`, `cpfDigits`, `nameLower`, `birthDate`, `lifecycleBucket`, `createdAt`, `importBatchId`, `referralVia`, `consultantId`, `source`) e `stronix_contratos` (`leadId`, `createdAt`, `renewedFromId`, `importBatchId`).
- Desde quando: `cpfDigits` desde 13/07/2026, com backfill. `zapMatchKey` desde 09/09/2026 (PR #200), com backfill cuja execução não dá para confirmar pelo repositório. Contratos desde junho de 2026.
- Viabilidade e prioridade: com ajuste, alta. Nenhum dos caminhos de cadastro pega o mesmo número em outro formato, o cartão do Zap escolhe um dos cadastros sem critério e o ex-cliente que volta num cadastro novo vira matrícula nova no Gerencial.
- Permissão e custo: gestor, por trava de tela. Telefone, CPF e nome nunca vão para o endereço nem para o nome do arquivo. Custo: todos os leads em todos os baldes, que cresce com a base, sob demanda. No navegador é a mesma leitura do Configurações. No servidor, entra como action de uma função que já existe (11 das 12 vagas em uso).
- Já existe em: nada parecido hoje. O R142 cita "telefone repetido", mas o número idêntico já é bloqueado no cadastro. O que passa é o mesmo número em outro formato ou outro número com o mesmo CPF.
- Conferência no código: ajustado. O que mudou:
  - Os três caminhos deixam passar. O cadastro manual compara só os dígitos exatos (`src/hooks/useDuplicateLead.js:19-24`) e não olha CPF (`src/modals/AddLeadModal.jsx:435-441`). O link público deduplica pelo `whatsappDigits` exato e pelo `cpfDigits` (`api/tenant-resolve.js:219-241`). A importação casa por CPF, depois pelo telefone exato, depois pelo nome, com risco de homônimo (`src/lib/clientImport.js:343-351`). Nenhum usa o `zapMatchKey`. A edição do cadastro na ficha não confere duplicata nenhuma.
  - Datas. O `cpfDigits` começou a ser gravado em 13/07/2026 (commit `9824a66`) e foi completado pelo `scripts/backfill-scale-fields.js` (`:83-93` e `:186`), e não em 30/06/2026. O `zapMatchKey` está em produção desde 09/09/2026 (commit `29ee52b`, de 08/09, merge `115a602` da PR #200).
  - O efeito no Gerencial está confirmado. A pessoa é o lead (`personKey` é o `leadId`, `src/lib/operacional/base.js:71`), então o cadastro duplicado vira "nova" em vez de "retorno" (`src/lib/gerencial/scope.js:23-34`). O CRM sofre o mesmo, porque a matrícula conta pela primeira conversão de cada lead. E a pessoa some do relatório de reconquista de ex-clientes.
  - O cartão do Zap usa `limit(1)` sem ordem (`api/zap.js:82`), então qual cadastro aparece fica indeterminado.
  - O `nameLower` sai normalizado do `buildLeadSearchFields` (`src/lib/leadDerived.js:25-38`). A coincidência por nome e nascimento depende do `birthDate`, que é opcional e fica vazio no link.

#### R150. Valores suspeitos em planos e contratos

Que planos e contratos têm valor com cara de errado (mensalidade gravada no lugar do total, valor abaixo de R$ 10, valor acima da tabela, ticket mensal muito fora do resto do mesmo plano), e quanto isso distorce venda, ticket e carteira?

- Para quem: dono, gestor e super-admin.
- Recortes: plano, duração, tipo de suspeita, consultor do contrato, mês da venda e academia (para o super-admin).
- Números: planos suspeitos, contratos suspeitos, valor afetado e ticket mensal com e sem os suspeitos.
- Filtros: tipo de suspeita, plano e mês.
- Formato: lista de planos e contratos com o motivo da suspeita e link para a ficha.
- De onde vem: `stronix_planos` (`value`, `durationMonths`, `active`) e `stronix_contratos` (`value`, `listValue`, `durationMonths`, `planId`, `createdAt`, `importBatchId`, `consultantId`).
- Desde quando: planos e contratos desde 30/06/2026. O bug do ponto de milhar valeu de 16/07/2026 (commit `2497364`, PR #149) a 17/09/2026 (commit `33db5ee`, em produção com a PR #213).
- Viabilidade e prioridade: com ajuste, alta. A auditoria de 16/09/2026 achou a Shape One gravando preço mensal em planos de vários meses, e ticket e carteira saem errados por causa disso.
- Permissão e custo: gestor na academia, super-admin entre academias pelo servidor. Na academia não há leitura nova: os contratos chegam pela assinatura do login e os planos pelo catálogo. Para o super-admin é leitura nova de contratos e planos de todas as academias pelo Admin SDK, como action do `super-overview`, e ela cresce com o número de academias e de contratos.
- Já existe em: nada parecido hoje. O R142 cobre contrato sem valor ou sem plano, não valor errado. O R053 compara preço praticado com a tabela, sem acusar erro de lançamento.
- Conferência no código: ajustado. O que mudou:
  - A justificativa se confirma. A auditoria registrou o preço mensal da Shape One (`docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:71`), e o valor por mês é `value ÷ durationMonths` (`src/lib/gerencial/scope.js:15-21`). Entre 16/07 e 17/09/2026 o `parseValorBRL` lia "2.988" como 2,988 (hoje corrigido em `src/lib/format.js:5-22`). A mesma auditoria não achou contrato abaixo de R$ 10 naquela data (linha 73), mas nada impede outra academia ou outra digitação de repetir o problema.
  - "Nenhuma leitura nova" só vale dentro da academia. O `super-overview` hoje só lê contagens e o documento da academia (`api/super-overview.js:7-12` e `:40-84`).
  - "Acima da tabela" compara com o `contract.listValue`, o preço do plano gravado na venda (`src/lib/contracts.js:150-165`), e não com o plano de hoje, porque mudar o plano não mexe em contrato fechado (`src/views/settings/CatalogsSection.jsx:66`). Na importação, o `listValue` é o preço do plano no dia da importação (`src/lib/clientImport.js:500-509`).
  - "Abaixo de R$ 10" precisa separar o valor zero, que é regra (os 494 importados e a cortesia contam como contrato e ficam fora do dinheiro, `src/lib/gerencial/scope.js:11-13`), do valor baixo com cara de digitação errada.
  - O bug do ponto de milhar só pegou valor digitado (plano, desconto, contrato) naquela janela, e a auditoria de 16/09 não achou valor estragado.

#### R151. Conferência com o sistema de gestão

Quem está ativo no sistema de gestão (NextFit, Stronix Suite) e não tem contrato vigente aqui, e quem tem contrato vigente aqui e não aparece lá?

- Para quem: dono e gestor.
- Recortes: situação no sistema de gestão, situação aqui (cliente vigente, vencido, lead, perda, não achado), plano e dono atual.
- Números: ativos lá sem contrato vigente aqui, vigentes aqui que não estão lá e contratos com plano ou datas diferentes.
- Filtros: situação, plano e dono.
- Formato: lista de divergências com exportação CSV.
- De onde vem: a planilha do sistema de gestão (lida no navegador, sem gravar nada); `stronix_leads` de todos os baldes (`cpfDigits`, `whatsappDigits`, `zapMatchKey`, `nameLower`, `lifecycleBucket`, `consultantId`); `stronix_contratos` (`leadId`, `planId`, `planName`, `startsAt`, `endsAt`, `status`).
- Desde quando: contratos desde 30/06/2026. A regra de casamento da importação existe desde 04/09/2026.
- Viabilidade e prioridade: com ajuste, média. Venda, carteira e renovação dependem de o consultor lançar o contrato no CRM, e o Stronilead não é o financeiro. Sem conferência, a venda esquecida some do Gerencial e da base da comissão sem ninguém perceber.
- Permissão e custo: gestor, em tela nova. As rules já permitem a leitura. Custo: todos os leads, uma leitura sob demanda. Os contratos já estão em memória. Sem escrita e sem índice novo.
- Já existe em: nada parecido hoje. O R144 descreve o que entrou em cada importação. Este confere sem importar, quando o gestor quiser.
- Conferência no código: ajustado. O que mudou:
  - A base de clientes não chega inteira no login. Desde o flip, a assinatura global só traz o balde ativo, e só os contratos chegam inteiros. Como a "situação aqui" inclui lead, perda e não achado, é preciso ler a base inteira, como o Configurações faz (`src/views/settings/SettingsView.jsx:57-64`, `src/lib/leadQueries.js:44`).
  - A regra de casamento é pura e testada (`resolveMatch` em `src/lib/clientImport.js:343-351`, `classifyCandidate` em `:434-440`, situações do contrato em `:113-119`), então roda só lendo. Mas ela casa pelo `whatsappDigits` exato, e número em outro formato vira falso "não achado". Vale acrescentar o `zapMatchKey` como segunda chave (`src/lib/leadDerived.js:36`).
  - A leitura da planilha carrega o xlsx do CDN da SheetJS e roda no navegador sem gravar nada. Dá para reusar só lendo, mas a tela de importação só aparece na sessão assumida ou em dev (`src/views/settings/SettingsView.jsx:100`), então a conferência do gestor é tela nova.
  - Comparar o plano depende de o nome na planilha casar com o catálogo. Na importação, plano fora do catálogo vira `planName` sem `planId` (`src/lib/clientImport.js:664-666`).

#### R152. Autorização e pedidos do titular (LGPD)

De quem guardamos dado pessoal, com que autorização, quem pediu para não receber contato, quem pediu para apagar os dados, e esses pedidos foram atendidos?

- Para quem: dono e gestor.
- Recortes: via de entrada (manual, link público, importação), tipo de pedido, situação do pedido e mês.
- Números: pessoas com e sem registro de autorização, pedidos de não contato, pedidos de exclusão e dias até atender.
- Filtros: via, tipo de pedido e situação.
- Formato: contagem e lista nominal restrita.
- De onde vem: dado novo de autorização por lead (data, via, texto aceito); dado novo de pedidos do titular, numa coleção própria que sobreviva à exclusão do lead; `stronix_leads.importBatchId` e `referralVia`; `stronix_contratos.leadName` e `stronix_aulas.leadName` (a anonimizar no pedido de exclusão).
- Desde quando: só depois de começar a gravar.
- Viabilidade e prioridade: precisa gravar dado novo, baixa. O link público grava nome, WhatsApp e CPF sem registro de autorização, a importação traz a base de outro sistema, e excluir o lead não deixa prova de que o pedido foi atendido.
- Permissão e custo: gestor, com regra nova só para admin na coleção de pedidos. Custo baixo para os pedidos. A contagem de autorização pede a base inteira, então roda sob demanda.
- Já existe em: nada parecido hoje. O R147 registra exclusões e exportações feitas pela equipe, não o pedido do titular nem a autorização.
- Conferência no código: ajustado. O que mudou:
  - Confirmado que nenhuma autorização é gravada. Não achei texto de consentimento em `src/views/public/ReferralLandingScreen.jsx` (busca por consent, lgpd, privacidade, autoriz e termo sem resultado) nem campo de autorização em `src/` ou `api/`. O cadastro manual e a importação também não gravam nada disso. O link grava nome, WhatsApp, CPF e `referralVia` 'link' (`api/tenant-resolve.js:186-196` e `:264-286`).
  - Excluir o lead não apaga todo o dado pessoal. Contratos e aulas guardam `leadName` (`src/lib/clientImportWrites.js:108-114`, `src/lib/aulasWrites.js:33-39`) e não aceitam exclusão (`firestore.rules:236-242` e `:249-253`). O pedido de exclusão só se cumpre anonimizando contratos e aulas (alteração pelo admin ou função de servidor) e guardando o pedido numa coleção que sobreviva ao lead. A exclusão de hoje apaga o lead e as interações sem rastro (`src/views/LeadProfileView.jsx:216-236`).
  - A coleção de pedidos precisa de match nas rules (leitura e escrita do admin, sem delete), publicado à mão.
  - A via de entrada não sai de um campo só. O `referralVia` só existe no lead do link. A via manual é a ausência de `referralVia` e de marca de importação, mas o lead manual que casou com uma planilha ganha `importBatchId` (ver R144). Para a via importação, o critério certo é o do `isImportCreatedLead`: marca do lote e origem começando com "Importação" (`src/lib/operacional/routine.js:98-99`).


### 5.13 Listas exportáveis

Este domínio entrega a lista com nome de quem cai num recorte da base, para o consultor trabalhar no dia ou para o gestor levar à planilha. Serve para perguntas como "quem venceu em agosto no plano X e recusou a renovação" ou "quem faz aniversário nesta semana". O limite é que quase tudo é retrato de hoje: vencimento, recusa, etapa do Vencidos e datas de perda e de matrícula são regravados, e o nascimento e a primeira matrícula faltam em boa parte da base. Toda lista nominal leva telefone, e as regras do Firestore deixam qualquer membro ler tudo, então quem pode baixar é decisão de produto.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R153 | Explorador da base | Alta | Com ajuste | Ajustado |
| R154 | Aniversariantes | Média | Com ajuste | Ajustado |
| R155 | Aniversário de casa | Baixa | Com ajuste | Ajustado |

#### R153. Explorador da base

Quem são, pelo nome, as pessoas de um recorte qualquer da base, por exemplo os vencidos no mês X do plano Y que recusaram a renovação e estão sem contato há 30 dias?

- Para quem: dono e gestor. No sistema os dois são o mesmo papel (admin).
- Recortes: balde (lead ativo, cliente ou perda), funil e etapa, plano, situação do contrato, mês de vencimento, dono do lead, origem, dor, modalidade, etiqueta, recusou a renovação, etapa do Vencidos e datas de cadastro, matrícula e perda.
- Números: contagem do recorte e lista nominal com as colunas que a pessoa escolher.
- Filtros: todos os recortes acima. No endereço vão só ids ou códigos, pela tabela do `screenParams`.
- Formato: tabela nominal exportável em CSV, planilha ou impressão.
- De onde vem: `stronix_leads`, lidos com `allLeadsQuerySpec`: `lifecycleBucket`, `funnelId`, `status`, `consultantId`, `source`, `dor`, `modalidade`, `tags`, `renewalDeclined`, `renewalDeclineReason`, `reactivationStageId` (a etapa do board sai de `expiredFunnel.js`), `createdAt`, `clienteSince`, `convertedAt`, `lostAt` e `lastInteractionAt`. De `stronix_contratos`, que chega pela assinatura do login: `planId`, `planName`, `startsAt`, `endsAt`, `status`, `pausedAt`, `cancelledAt` e `isImported`. A situação do contrato sai de `deriveLeadContractStatus` aplicado ao próprio contrato. O resumo `current*` do lead fica só como atalho.
- Desde quando: retrato de hoje. As colunas de contrato valem desde junho de 2026, e o cliente legado aparece como "Sem contrato". O `clienteSince` vale desde 30/06/2026 (merge da PR #123), mais os importados desde 04/09/2026. As datas de perda e de matrícula mostram só o estado atual.
- Viabilidade e prioridade: com ajuste, alta. Substitui o CSV de leads e cria o de clientes, que não existe. O material de origem diz que o pedido foi adiado em 17/08/2026, mas não achei esse registro.
- Permissão e custo: pelas regras, qualquer membro da academia lê tudo. Deixar a exportação só com o gestor (admin) é decisão de produto, e seria trava só de tela. Não existe papel de dono separado do gestor. O nome do arquivo e o endereço não podem levar nome, telefone nem CPF. Custo: uma leitura por lead da academia a cada abertura (2 a 3 mil numa academia de 2 a 3 mil leads), a mesma carga de Todos os leads, com `getDocs` e memória da sessão. Os contratos não custam leitura nova. Não precisa de índice composto, porque todo filtro roda no navegador.
- Já existe em: Leads → Todos os leads → exportar CSV, com 9 colunas e a Observação quase sempre vazia. Clientes não tem exportação.
- Conferência no código: ajustado. O que mudou:
  - O resumo `current*` do lead não é fonte segura da situação do contrato. O `commitContractPatch` grava no lead o patch de cancelado ou trancado seja qual for o contrato mexido (`src/lib/contractsWrites.js:20-42`, `src/modals/ContractOutcomeModal.jsx:110-118`). Como contrato paralelo é permitido, cancelar um contrato antigo pode marcar como cancelado um cliente que tem outro contrato valendo. Situação, plano e mês de vencimento saem de `stronix_contratos`, que já chega inteiro pela assinatura do login (`src/App.jsx:794-802`).
  - O mês de vencimento não é fixo. A reativação de um trancado empurra o `endsAt` (`src/lib/contracts.js:326-372`). "Vencidos no mês X" é retrato de hoje, não o histórico de quem venceu naquele mês.
  - A etapa do Vencidos não é campo cru. Lead sem `reactivationStageId` cai numa etapa calculada (`src/lib/expiredFunnel.js:121-123`), e contrato novo zera o campo (`src/lib/contracts.js:202`). O filtro precisa usar a mesma função do board.
  - A recusa (`renewalDeclined`) só vale para o ciclo atual. Contrato novo zera a marca (`src/lib/contracts.js:196-198`), e arrastar o card para uma etapa do Vencidos desfaz a recusa (`src/views/KanbanView.jsx:913`). O motivo gravado pelo board é sempre "Outro".
  - "Sem contato há 30 dias" não tem campo próprio. O `lastInteractionAt` também é carimbado por mudança de contrato (`src/lib/contractsWrites.js:40` e `:105`) e por troca de etapa, e não é carimbado pelo desfecho de aula ou visita marcado na Agenda do dia. Na lista, a coluna tem que se chamar "última movimentação". "Último contato" seria nome errado.
  - A data de perda (`lostAt`) some quando o lead sai da Perda (`src/lib/stageMove.js:89-92`). A data de matrícula (`convertedAt`) é regravada no retorno de ex-cliente. A primeira matrícula está no `clienteSince`, que só o fluxo de contrato e a importação gravam (`src/lib/contractsWrites.js:116`, `src/lib/clientImport.js:626` e `:647`). Quem virou cliente só pela etapa Venda não tem `clienteSince`.
  - Permissão. Os papéis são só admin e consultant. As regras deixam qualquer membro ler todos os leads (`firestore.rules:79-86`), e as telas Leads e Clientes não têm trava de gestor (`src/lib/routes.js:57` e `:59`). Hoje o consultor já baixa o CSV da base inteira, com telefone.
  - O CSV de Todos os leads tem mesmo 9 colunas (`src/views/LeadsView.jsx:138-143`). A Observação vem vazia para lead criado pelo cadastro, que manda a observação para a linha do tempo (`src/modals/AddLeadModal.jsx:501-507`). Ela só vem preenchida quando alguém edita o cadastro na ficha (`src/lib/clientRegistration.js:65`). Fora dele, só o `AppointmentExportModal` (aulas e visitas) gera CSV. O CSV de leads já usa `;`, BOM e neutralização de fórmula, e dá para reaproveitar (`src/views/LeadsView.jsx:127-150`).
  - A base inteira é lida por `allLeadsQuerySpec`, sem `where` (`src/lib/leadQueries.js:44`), por isso a mesma carga de Todos os leads e nenhum índice composto.
  - Não achei no repositório nem na memória o registro do pedido adiado em 17/08/2026. Fica como não confirmado.

#### R154. Aniversariantes

Quais clientes e leads fazem aniversário nesta semana ou neste mês?

- Para quem: consultor e gestor.
- Recortes: dia do aniversário, dono do lead e balde (lead ou cliente).
- Números: lista nominal. A tela também precisa dizer quantos leads e clientes não têm a data preenchida.
- Filtros: semana ou mês, pessoa e balde. A pessoa vai no endereço só como id do consultor.
- Formato: tabela nominal.
- De onde vem: `stronix_leads.birthDate` (Timestamp, opcional), `consultantId` e `lifecycleBucket`. Falta criar o campo derivado `birthMonthDay`, gravado no `AddLeadModal`, no `buildClientRegistrationPatch` e no `clientImport`, com um backfill em `scripts/`.
- Desde quando: vale para todo lead que tiver a data, porque aniversário não tem data de corte. O campo existe no cadastro manual e na ficha desde 30/06/2026 (merge da PR #123, `b2b0c9d`) e nos importados desde 04/09/2026. Quem entra pelo link público nunca tem a data.
- Viabilidade e prioridade: com ajuste, média. Relacionamento simples, que pede um campo derivado para ficar barato.
- Permissão e custo: todos os papéis, e as regras já permitem a leitura. O nome aparece só na tela, nunca no endereço, no título da aba ou no nome do arquivo. Custo: sem o campo derivado, uma leitura por lead da academia (2 a 3 mil) a cada abertura, com filtro no navegador. Com `birthMonthDay` e o backfill, só os aniversariantes da janela, algumas dezenas de leituras.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado. O que mudou:
  - A data de nascimento é opcional e fica escondida no cadastro manual, atrás de "Adicionar nascimento, CPF, sexo e e-mail" (`src/modals/AddLeadModal.jsx:722-729`). O link público grava `null` (`api/tenant-resolve.js:271`). A cobertura tende a ser baixa, por isso a contagem de quem não tem a data.
  - Quem grava: o cadastro manual (`src/modals/AddLeadModal.jsx:461`), a edição do cadastro na ficha, para lead e para cliente (`src/lib/clientRegistration.js:54`, `src/views/LeadProfileView.jsx:1202` e `:2001`), e a importação, na criação e no preenchimento de campo vazio (`src/lib/clientImport.js:205`, `:372` e `:607`). O Kanban e a Meta Diária não gravam.
  - O `birthDate` é gravado como Timestamp da meia-noite local (`src/lib/dates.js:53-59`). Consulta por dia e mês não roda no servidor, então hoje a lista exige ler a base inteira. Para ficar barato, falta o campo derivado (por exemplo `birthMonthDay` no formato "MM-DD") nos três caminhos, mais o backfill. Consultado sozinho, esse campo não pede índice composto. Combinado com `lifecycleBucket`, pede.
  - O "desde" não é corte do dado. O nascimento vale para sempre, então a lista cobre todo lead com o campo preenchido. O campo entrou no cadastro com a PR #123 (commit `89df3e9` em 23/06/2026, merge `b2b0c9d` em 30/06/2026), e a importação traz o campo desde 04/09/2026.
  - O filtro de pessoa vai no endereço só como id do consultor. O nome do aniversariante nunca vai no link nem no nome do arquivo exportado.

#### R155. Aniversário de casa

Quais clientes completam 6 meses, 1, 2 ou 3 anos de casa nesta semana ou neste mês?

- Para quem: gestor e consultor.
- Recortes: marco de casa, dia, dono atual e plano.
- Números: lista nominal e quantidade por marco.
- Filtros: contrato vigente, semana ou mês.
- Formato: lista nominal exportável, no molde dos aniversariantes (R154).
- De onde vem: `stronix_leads.clienteSince` (primeira matrícula feita no app ou data da planilha), `convertedAt` só como reserva e marcado como aproximação, `lifecycleBucket` e `consultantId`. De `stronix_contratos`, pela assinatura do login: o `startsAt` do contrato mais antigo não importado, e os importados com `isImported` e status vigente.
- Desde quando: confiável para quem virou cliente pelo fluxo de contrato desde 30/06/2026, e o primeiro marco de 6 meses cai em 30/12/2026. Aproximado para os importados desde 04/09/2026, que usam a data da planilha. Não confiável para o cliente legado de antes dos contratos, cujo `clienteSince` é a data do primeiro contrato feito no app, nem para quem só tem `convertedAt`.
- Viabilidade e prioridade: com ajuste, baixa. Ritual de relacionamento barato, que puxa indicação e renovação.
- Permissão e custo: todos os papéis, e as regras já permitem a leitura. Recortar pela carteira do consultor seria só trava de tela, e hoje a tela de Clientes mostra a academia inteira. Nome nunca no endereço nem no nome do arquivo. Custo: uma leitura por cliente a cada abertura (`clientsAllQuerySpec`, a mesma carga da tela de Clientes). Os contratos não custam leitura nova. Não precisa de índice composto.
- Já existe em: nada parecido hoje. Nenhuma tela mostra tempo de casa como lista. No catálogo, o aniversário de nascimento é o R154 e o tempo de casa em histograma é o R074.
- Conferência no código: ajustado. O que mudou:
  - O `clienteSince` não mede tempo de casa de quem já era cliente antes dos contratos. Ele é carimbado no primeiro contrato gravado pelo sistema, seja matrícula ou renovação (`stampClienteSince: !lead?.clienteSince` em `src/lib/contracts.js:221`, gravado em `src/lib/contractsWrites.js:116`). O cliente legado, que virou cliente pela etapa Venda antes de junho de 2026, ganha como `clienteSince` a data do primeiro contrato feito no app, e o tempo de casa dele recomeça ali.
  - Virar cliente só pela etapa (Venda, "matricul" ou "convertid") não grava `clienteSince`. A troca de etapa só carimba `convertedAt` (`src/lib/stageMove.js:94-96`).
  - A reserva no `convertedAt` é frágil. Ele é regravado em toda matrícula de retorno (`src/lib/contracts.js:219`), e entre 30/06/2026 e 08/09/2026 a troca de etapa zerou o `convertedAt` de clientes (regra corrigida pela PR #197).
  - Na importação, o `clienteSince` é a menor data entre o cadastro na planilha, o início do contrato e o início do contrato importado, ou o instante da importação quando nada disso vem preenchido (`src/lib/clientImport.js:626` e `:647`). É aproximação: a data de cadastro do sistema antigo pode ser de lead e não de matrícula, e sem data na planilha o marco vira o dia da importação.
  - Na prática, um cliente com `clienteSince` gravado pelo fluxo de contrato só completa 6 meses a partir de 30/12/2026. Hoje os marcos de 1, 2 ou 3 anos só aparecem para importados com data na planilha e para legados com `convertedAt` antigo e intacto.
  - Falta decidir se trancamento e intervalo sem contrato contam como casa contínua. Do jeito que está, o relatório soma desde a primeira matrícula, sem descontar a saída. A primeira matrícula é a menor data entre `convertedAt` e `clienteSince`, como no CRM (`src/lib/crm/cohort.js:18-27`).
  - Permissão. "O consultor vê a própria carteira" não é o comportamento de hoje. Em Clientes o consultor vê a academia inteira, porque o filtro de responsável é só do gestor, e as regras deixam ler tudo (`firestore.rules:79-86`). Recortar pela carteira é escolha de tela.
  - A leitura dos clientes é `clientsAllQuerySpec`, só com `where` em `lifecycleBucket` (`src/lib/leadQueries.js:31-33`), por isso nenhum índice composto. Quem está vigente sai dos contratos da assinatura (`src/App.jsx:794-802`).


### 5.14 Resumos

Este domínio dá ao dono e ao gestor a leitura curta de um período (o dia, a semana, o mês ou o ano) com o número e a diferença contra o período de antes. Quase tudo sai das contas que o CRM, o Operacional e o Gerencial já fazem, só que essas contas hoje aceitam apenas o mês. O limite está na base: contratos existem desde junho de 2026, agendamentos completos desde setembro de 2026, e um mês fechado recalculado hoje não é o número que se viu no fechamento, porque o passado muda com correção de contrato, lead excluído e renome de catálogo.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R156 | Resumo da semana e do mês | Média | Com ajuste | Ajustado |
| R157 | Boletim do dia | Média | Com ajuste | Ajustado |
| R158 | Acumulado do ano e mesmo mês do ano anterior | Baixa | Com ajuste | Ajustado |
| R159 | Fechamento congelado do mês | Média | Precisa gravar dado novo | Ajustado |

#### R156. Resumo da semana e do mês

Como foi a semana ou o mês em leads, agendamentos, comparecimento, matrículas, vendas e cancelamentos, e o que mais mudou?

- Para quem: dono e gestor. No sistema os dois são o mesmo papel (admin).
- Recortes: semana ou mês, e a métrica.
- Números: os números principais do período, a diferença contra o período anterior e os destaques em frase curta.
- Filtros: período e pessoa. O filtro de pessoa não chega à venda, à carteira nem ao risco do Gerencial (ver a conferência).
- Formato: número com comparativo, mais frases curtas.
- De onde vem: `metricsOf` do CRM (`src/lib/crm/metrics.js:93`) e do Operacional (`src/lib/operacional/metrics.js:92`), por mês. Para a semana, uma entrada nova que chame os módulos de dentro com `start` e `end`: `salesOf` (`src/lib/gerencial/sales.js:13`), `computeBaseMovement` e `computeChurn` (`src/lib/operacional/base.js:206` e `:256`), e a safra e os agendamentos do CRM. Os destaques vêm de `buildHighlights` (`src/lib/operacional/metrics.js:216`) e `buildCrmHighlights` (`src/lib/crm/metrics.js:265`). Venda por pessoa em `stronix_contratos.consultantId`. Leads e agendamentos por pessoa em `lead.consultantId`, o dono de hoje.
- Desde quando: leads e interações por mês desde o começo da base. Venda, cancelamento e renovação desde junho de 2026 (contratos). Autor da ação desde 13/07/2026. Agendamentos e comparecimento completos desde setembro de 2026. Passagem entre etapas desde 14/09/2026, 18h10. Semanas anteriores a essas datas ficam parciais.
- Viabilidade e prioridade: com ajuste, média. As contas de dentro já aceitam janela, falta a semana na carga, e o envio por e-mail precisa de job e de função.
- Permissão e custo: trava de tela para gestor (admin). As rules deixam qualquer membro ler, não existe papel de dono separado, e hoje os três painéis abrem para todos os papéis. No mês, o custo é a soma das telas. O CRM e o Operacional dividem a mesma carga e a mesma memória de sessão (`src/hooks/monthSources.js`). O Gerencial não abre consulta de contrato, porque os contratos chegam pela assinatura do login, e só lê os docs de lead das vendas, em lotes de 30. Na semana, basta carregar o mês ou os dois meses que a contêm. Não precisa de índice composto: todas as consultas são de campo único.
- Já existe em: os destaques do Operacional e do CRM, na Visão geral, que aparecem com o Comparar ligado.
- Conferência no código: ajustado. O que mudou:
  - Semana pede entrada nova. Os três `metricsOf` recebem `monthKey`, não uma janela livre. O CRM monta o período com `monthRange(monthKey)`, o Operacional com `windowOf(ctx, monthKey, cutEnd)` e o Gerencial com `monthRange(monthKey)`. Os módulos de dentro já recebem `start` e `end` (`salesOf`, `exitsInWindow`, `computeBaseMovement`), então a conta existe. "As contas aceitam janela" só vale abaixo do `metricsOf`.
  - O filtro de pessoa mistura duas atribuições. O `metricsOf` do Gerencial não tem `userId`, e o filtro não alcança a venda, a carteira nem o risco. Só o ranking de vendedores recorta por pessoa, e ele usa `contract.consultantId`, que é o dono do lead na hora da venda (`src/lib/contracts.js:175-181`). O CRM e o Operacional usam o dono de hoje (`lead.consultantId`). O resumo com filtro de pessoa precisa dizer isso na tela.
  - Destaques só existem em duas telas. O Operacional tem `buildHighlights`, com até 3 itens entre tarefas, marcos, upgrades, cancelamentos por motivo e renovações. O CRM tem `buildCrmHighlights`, com só dois tipos: leads que passaram de 24 horas sem primeiro contato e o melhor canal. O Gerencial não tem destaque de venda. Os dois só aparecem com o Comparar ligado (`src/views/dashboard/DashboardCrmView.jsx:116`).
  - O "desde quando" estava incompleto. Foram acrescentadas as datas de contratos (junho de 2026), da passagem entre etapas (14/09/2026, 18h10), do autor da ação, `actorAuthUid` (13/07/2026, commit `9824a66`), e dos agendamentos completos (setembro de 2026).
  - Permissão. Não existe papel de dono separado do gestor, só `admin` e `consultant`, e as rules deixam qualquer membro ler leads, interações, contratos e aulas (`firestore.rules:79-95` e `:235-254`). "Gestor e dono" é trava de tela, como nos três painéis, que hoje abrem para todos.
  - O envio por e-mail fica fora desta entrega. O `vercel.json` só tem rewrites, sem crons, o `package.json` não tem provedor de e-mail, e `api/` já usa 11 das 12 funções. O resumo dentro do app sai sem nada disso.
  - Evidências principais: `src/lib/gerencial/metrics.js:52-60` (o `metricsOf` do Gerencial recebe só `monthKey` e `cutEnd`, sem pessoa) e `src/views/dashboard/DashboardOperacionalView.jsx:392` (destaques só com `compareOn`).

#### R157. Boletim do dia

Como foi o dia, hoje ou num dia escolhido: leads novos, contatos registrados, agendamentos feitos, visitas e aulas do dia com desfecho, matrículas, renovações, cancelamentos, perdas e quem bateu a meta?

- Para quem: gestor, dono e consultor.
- Recortes: dia e pessoa.
- Números: leads novos, contatos registrados, agendamentos criados, visitas e aulas do dia (vieram, faltaram, sem desfecho), matrículas e renovações, valor vendido, cancelamentos, perdas e meta batida por pessoa.
- Filtros: dia, e sem importados.
- Formato: uma página curta com os números do dia, a comparação com a média dos mesmos dias da semana e uma linha por pessoa.
- De onde vem:
  - Leads: `stronix_leads.createdAt`, sem os de `isImportCreatedLead`, e `lostAt`, que só pega quem está em Perda hoje.
  - Contatos e agendamentos: `stronix_interactions.createdAt`, `type`, `volumeKind`, `dailyGoalCategory`, `actorAuthUid` e `leadConsultantId`.
  - Aulas: `stronix_aulas.scheduledFor`, `status` e `outcomeAt`. Visitas: o desfecho é inferido como em `src/lib/crm/appointments.js`, pelo `appointmentOutcome` do lead e pela interação `daily_goal_done` de `visita_hoje`.
  - Vendas: `stronix_contratos.createdAt` (venda, e renovação por `renewedFromId`, sem `isImportedContract`), `value` e `cancelledAt`. Os contratos já chegam pela assinatura do login.
  - Meta: `stronix_daily_goal_history.date` e `consultantId`.
- Desde quando: autor da ação desde 13/07/2026. Registro de aula desde 16/07/2026, completo desde a segunda quinzena de julho. Registro de visita desde 18/08/2026, mas o desfecho de visita nunca vai para o registro. Contratos desde junho de 2026. O dia cheio e comparável começa em setembro de 2026.
- Viabilidade e prioridade: com ajuste, média. É o fechamento que o gestor faz no fim do expediente, e hoje ele monta isso abrindo quatro telas.
- Permissão e custo: qualquer membro já lê todas as fontes pelas rules. A linha por pessoa segue o Operacional, que mostra todos para todos. Não precisa de regra nova. O custo é pequeno: cinco consultas de campo único no dia (leads por `createdAt`, leads por `lostAt`, interações por `createdAt`, aulas por `scheduledFor`, histórico da meta por `date`), mais 1 leitura do doc da academia por consulta, por causa do `tenantActive`. Contratos não custam leitura nova. A média dos mesmos dias da semana multiplica por 4 ou 5 as consultas de leads, interações e aulas, ou reaproveita a carga do mês em `monthSources` quando os dias caem no mesmo mês.
- Já existe em: nada fecha o dia da academia inteira numa página. O que existe é a Meta Diária de cada pessoa no dia e os painéis mensais da Visão geral.
- Conferência no código: ajustado. O que mudou:
  - Desfecho de visita. Ele não é gravado no registro de `stronix_aulas`. Só o desfecho de aula vai para o registro (`status` e `outcomeAt`). Para ter "vieram, faltaram, sem desfecho" na visita é preciso a mesma inferência do CRM: o espelho do lead no mesmo instante, senão a última interação `daily_goal_done` de `visita_hoje` no dia marcado ou no seguinte. O cancelamento de visita pela Meta apaga o compromisso do espelho.
  - Perdas. Lidas por `lostAt`, só contam quem está em Perda hoje. A perda desfeita no mesmo dia some, e um cliente nunca aparece como perda.
  - Matrículas têm três definições no sistema. O CRM conta a primeira conversão (`clienteSince` ou `convertedAt`) e aceita etapa com nome de matrícula sem contrato. O Operacional e o Gerencial contam contrato por `createdAt`, sem importados e com o tipo em ordem exclusiva: renovação, upgrade, retorno, nova. O boletim precisa escolher uma e dizer qual.
  - Quem bateu a meta. Vem de `stronix_daily_goal_history`, que só é gravado quando a pessoa abre o app com a base carregada, tem pelo menos uma tarefa e zero pendências (`src/lib/dailyGoalHistory.js:9-41`). No dia em curso o número muda ao longo do dia, e quem não abriu o app fica como "não bateu".
  - Linha por pessoa. Lead novo e perda vão pelo dono de hoje (`consultantId`). Contato e agendamento vão pelo autor (`actorAuthUid`, desde 13/07/2026, com o dono do lead como reserva). A presença confirmada credita o dono do lead, não quem confirmou. A migração em massa reescreve o `leadConsultantId` das interações antigas (`src/views/settings/TransferLeadsTab.jsx:142-164`).
  - Agendamentos criados têm duas fontes possíveis, e os números diferem. As interações com `volumeKind` contam também o reagendamento. O `stronix_aulas.createdAt` não: `upsertScheduledAppointment` só cria registro quando não há um em aberto, e remarcar atualiza o mesmo registro (`src/lib/aulasWrites.js:13-44`).
  - A comparação com a média dos mesmos dias da semana não existe em função nenhuma. É conta nova e precisa carregar as 4 semanas anteriores.
  - Evidências principais: `src/lib/aulasWrites.js:84-106` (`applyOutcomeToAula` grava `status` e `outcomeAt` só na aula ligada em `lead.currentAulaId`) e `src/lib/crm/scope.js:19-24` (visitas com registro só desde 18/08/2026, agendamentos completos em 2026-09).

#### R158. Acumulado do ano e mesmo mês do ano anterior

Como o ano está indo até agora, e como este mês se compara com o mesmo mês do ano passado, para separar sazonalidade de tendência?

- Para quem: dono. No sistema é o gestor (admin).
- Recortes: ano, mês do ano e métrica (leads, matrículas, venda, carteira, cancelamentos, renovação).
- Números: acumulado do ano, média mensal, mesmo mês do ano anterior e variação em %.
- Filtros: ano e métrica.
- Formato: tabela de meses por ano, com uma linha de acumulado.
- De onde vem: `metricsOf` do CRM e do Operacional, por mês. No Gerencial, `salesOf` e `exitsInWindow` por mês pelo `metricsOf`, mais `walletAt(contracts, fim de cada mês)` para a carteira. Como opção, o fechamento congelado do R159, para o mesmo mês do ano anterior não mudar com o estado de hoje.
- Desde quando: contratos desde junho de 2026, então venda, carteira, cancelamento e renovação do mesmo mês do ano anterior só existem a partir de junho/julho de 2027. Para leads, o código não diz de quando é o lead mais antigo da base. Agendamentos só ficam comparáveis a partir de setembro de 2027.
- Viabilidade e prioridade: com ajuste, baixa. Janeiro e julho de academia não se comparam com o mês anterior, e a função fica pronta para quando existir um ano de base.
- Permissão e custo: trava de tela para gestor (admin). Não existe papel de dono, e as rules deixam qualquer membro ler. Recalcular carrega um mês por vez com `monthSources`. O mês fechado vem do cache conferido por uma contagem no servidor e só vai ao servidor se a contagem divergir. Doze meses custam doze contagens e, na primeira vez em cada aparelho, a leitura inteira de leads, interações e aulas de cada mês. Com o fechamento congelado, cai para uma leitura por mês.
- Já existe em: em parte. O "Comparar com" do Operacional e do CRM oferece os 12 meses anteriores, e o 12º é o mesmo mês do ano anterior. O Gerencial tira da lista os meses sem venda. Falta o acumulado do ano e a visão de mais de 12 meses de uma vez.
- Conferência no código: ajustado. O que mudou:
  - O "já existe" estava errado. O material dizia que os painéis comparam só com o mês anterior. Não é assim: `compareOptions` devolve os 12 anteriores, e o 12º é o mesmo mês do ano anterior.
  - A data dos leads saiu. "Leads desde 29/04/2026" era a data do primeiro commit do repositório (`e07e9f4`, "Initial commit with dark mode fixes"), não a do primeiro lead gravado.
  - A carteira de cada mês não sai do `metricsOf` do Gerencial. Carteira e risco são sempre retrato de hoje (`ctx.now`), seja qual for o mês escolhido (`src/lib/gerencial/metrics.js:1-4` e `:30-45`). Para a carteira no fim de cada mês é preciso chamar `walletAt(contracts, fimDoMês)` (`src/lib/gerencial/wallet.js:7`). E o `endsAt` do contrato trancado anda na reativação (`src/lib/contracts.js:326-372`), então a carteira de um mês passado, recalculada depois, muda.
  - Recalcular 12 a 24 meses passados usa o estado de hoje: dono e funil de hoje (`src/lib/crm/scope.js:49-69`), perda só de quem está em Perda hoje (`src/lib/crm/cohort.js:80-91`), nomes de catálogo depois de renomear (`src/views/settings/CatalogsSection.jsx:57-60`) e safra de mês fechado que continua subindo (`src/lib/crm/metrics.js:114-120`). O mesmo mês do ano anterior recalculado não é o número que se viu na época.
  - O parâmetro `mes` do endereço aceita só os 12 meses até o corrente, 11 para trás (`src/lib/screenParams.js:58-65`). O acumulado do ano no calendário cabe nessa janela. A comparação com os meses do ano anterior pede de 12 a 23 meses para trás e um parâmetro novo, com teto.
  - Não existe papel de dono. É o gestor (admin), e as rules deixam qualquer membro ler.
  - Evidências principais: `src/lib/operacional/month.js:59-66` (`compareOptions`: os 12 anteriores, o 12º é o mesmo mês do ano anterior) e `src/lib/gerencial/metrics.js:1-4` (carteira e risco sempre em `ctx.now`).

#### R159. Fechamento congelado do mês

Os números de um mês já fechado mudaram depois do fechamento, quanto e por quê (correção de contrato, lead excluído, renome de catálogo, transferência de carteira, desfecho lançado tarde)?

- Para quem: dono e gestor, o mesmo papel (admin).
- Recortes: mês, métrica, causa da diferença e pessoa.
- Números: o número no fechamento, o número recalculado hoje, a diferença e os itens que explicam a diferença.
- Filtros: mês e métrica.
- Formato: tabela do fechamento contra hoje, com a lista das mudanças.
- De onde vem:
  - A foto do mês: coleção nova, com os totais e os ids de cada métrica, gravada só com dado lido do servidor.
  - O recálculo pelos `metricsOf` que já existem (CRM, Operacional, Gerencial), com `walletAt` no fim do mês para a carteira.
  - `stronix_interactions` com `type` `status_change` e texto "Contrato corrigido", que guarda só os valores novos.
  - `stronix_contratos.updatedAt`, gravado em qualquer desfecho, não só na correção.
  - `stronix_aulas.outcomeAt`, só para aula.
- Desde quando: a partir do primeiro fechamento gravado. Julho e agosto de 2026 não voltam como foram fechados, porque o estado de antes não foi guardado em lugar nenhum.
- Viabilidade e prioridade: precisa gravar dado novo, média. O passado muda por construção, e quem fecha comissão ou apresenta resultado precisa saber que o agosto de hoje não é o agosto que foi fechado.
- Permissão e custo: trava de tela para gestor (admin). A regra nova deve deixar só o admin gravar a foto e ninguém alterar nem apagar, no molde do histórico da meta (`delete: false`). Qualquer membro pode ler, como o resto da academia. O custo é uma leitura por foto de mês fechado, mais o recálculo do mês, com o custo da tela do mês. A gravação é uma escrita por mês e por grupo de métrica, e o doc cresce com os ids guardados.
- Já existe em: nada parecido hoje. No catálogo, o R061 (correções de contrato), o R147 (exclusões), o R146 (mudanças de configuração) e o R056 (insumo da comissão, que depende deste relatório) registram as causas, mas nenhum mostra o efeito no número fechado.
- Conferência no código: ajustado. O que mudou:
  - Por que o número muda. A correção reescreve o contrato no mês original (`src/lib/contracts.js:371-400`). Excluir lead apaga as interações (`src/views/LeadProfileView.jsx:215-236`). Renomear catálogo reescreve os leads (`src/views/settings/CatalogsSection.jsx:57-60`). A safra de mês fechado continua subindo (`src/lib/crm/metrics.js:114-120`).
  - A foto do mês é dado novo. Pede coleção nova, com `match` novo em `firestore.rules` publicado à mão no console, senão toda leitura e escrita é negada, porque as rules não têm regra genérica (`firestore.rules:79-254`). Faltava dizer quem grava e quando. O `vercel.json` não tem cron, e `api/` já usa 11 das 12 funções. O caminho que sobra é o navegador gravar na primeira abertura depois da virada do mês, no molde de `stronix_daily_goal_history`, e só com dado lido do servidor. O cache conferido por contagem não enxerga campo alterado.
  - Para explicar a diferença item a item, a foto precisa guardar os ids de cada número (leads, contratos, aulas), não só o total. É preciso conferir contra o limite de 1 MiB por doc, ou dividir a foto por grupo de métrica.
  - A interação "Contrato corrigido" guarda só os valores novos (plano, valor, vigência), não os antigos, e é `type` `status_change`. O `updatedAt` do contrato é gravado em todo desfecho (cancelar, trancar, reativar, corrigir), não só na correção (`src/lib/contractsWrites.js:21-50`). Sem a foto, o valor de antes se perde.
  - Excluir lead não deixa evento nenhum. As interações do lead são apagadas, e contratos e aulas ficam órfãos. A causa "lead excluído" só aparece comparando os ids da foto com os de hoje.
  - Renomear item de catálogo reescreve `source` e `currentPlanName` nos leads e não grava evento. A migração em massa grava uma nota de texto sem `leadId` e sem a lista de ids (`src/views/settings/TransferLeadsTab.jsx:142-173`). Só a troca individual de responsável deixa evento por lead. Para essas causas, a foto é a única prova.
  - O desfecho lançado tarde tem data (`outcomeAt`) só para aula (`src/lib/aulasWrites.js:84-106`). O desfecho de visita não vai para o registro de `stronix_aulas`.
  - Evidências principais: `firestore.rules:206-217` (molde de coleção gravada pelo navegador e nunca apagada) e `src/lib/crm/queries.js:27-40` (o cache conferido por contagem não enxerga campo alterado).


### 5.15 Super-admin

Este domínio não responde à academia, e sim à STRONIX como dona da plataforma: quantas academias usam o Stronilead, quanto pagam, quanto usam, quem atrasou e quem foi embora. O limite é que o documento da academia (`tenants`) guarda só o estado de hoje, o histórico de pagamento só existe para quem é cobrado pelo Asaas (desde 08/06/2026) e a auditoria grava o nome do campo alterado, sem o valor antigo nem o novo. Tudo aqui é só do super-admin, lido pelo servidor ou em coleções que as rules deixam só ele ler.

| Id | Relatório | Prioridade | Viabilidade | Conferência |
|---|---|---|---|---|
| R160 | Carteira de academias | Média | Pronto | Ajustado |
| R161 | Saúde de uso por academia | Média | Com ajuste | Ajustado |
| R162 | Receita recebida do SaaS | Média | Com ajuste | Ajustado |
| R163 | MRR real mês a mês | Média | Precisa gravar dado novo | Ajustado |
| R164 | Inadimplência e cobrança das academias | Média | Com ajuste | Ajustado |
| R165 | Funil de trial e ativação | Baixa | Com ajuste | Ajustado |
| R166 | Uso de vagas e chance de upgrade | Baixa | Com ajuste | Ajustado |
| R167 | Suporte por academia | Baixa | Com ajuste | Ajustado |
| R168 | Trilha de auditoria da plataforma | Baixa | Com ajuste | Ajustado |
| R169 | Comparativo anônimo entre academias | Baixa | Precisa gravar dado novo | Ajustado |
| R170 | Custo de leitura por academia | Baixa | Fora do escopo | Confirmado |
| R171 | Implantação e uso de recursos por academia | Baixa | Com ajuste | Ajustado |
| R172 | Retenção de academias por safra | Baixa | Precisa gravar dado novo | Ajustado |

#### R160. Carteira de academias

Como estão todas as academias hoje: plano, preço, pagamento, uso, última atividade, MRR e trials vencendo?

- Para quem: super-admin.
- Recortes: academia, status, plano, cidade e UF, conta interna.
- Números: preço efetivo, usuários por papel, leads, interações, dias sem atividade, MRR, ARR.
- Filtros: status, plano, com ou sem as internas.
- Formato: tabela exportável.
- De onde vem: `tenants.status`, `tenants.archived`, `tenants.internal`, `tenants.plan`, `tenants.monthlyPrice`, `tenants.paymentStatus`, `tenants.trialEndsAt`, `tenants.settings.city` e `tenants.settings.state`, mais o que o `api/super-overview.js` já devolve por academia: `userCount`, `managerCount`, `consultantCount`, `leadCount`, `interactionCount`, `lastActivityAt` e `price`.
- Desde quando: não é uma data só. Plano e trial desde 02/06/2026 (commit `3779dd3`). Preço negociado (`monthlyPrice`) e o próprio super-overview desde 03/06/2026 (`2ce5272`). Cobrança (`paymentStatus`, `nextBillingAt` e `statusChangedAt`) desde 08/06/2026 (`1c0fac0`). A marca de conta interna desde 11/06/2026 (`1cf9ebe`). Academia mais antiga sem `internal` conta como cliente.
- Viabilidade e prioridade: pronto, prioridade média. A API já entrega tudo, falta ligar o CSV.
- Permissão e custo: só super-admin (`api/super-overview.js:101`). A resposta traz `profile` (CNPJ ou CPF do responsável), `responsiblePhone` e `internalNotes` (`api/super-overview.js:70-74`), e o CSV tem de deixar os três de fora. No servidor, cada abertura do Console custa por academia 4 contagens, 1 leitura da última interação e 1 leitura do documento privado. O CSV sai da resposta já carregada, sem leitura nova.
- Já existe em: Console → Visão geral, onde os botões Exportar e Relatório mensal existem e não fazem nada.
- Conferência no código: ajustado.
  - Os botões Exportar e Relatório mensal não têm `onClick` (`src/views/console/SuperConsole.jsx:106-107`). O Exportar do Faturamento também não (`src/views/console/SuperConsole.jsx:861`). A sobreposição está certa.
  - O "desde" foi separado por campo, como está acima.
  - O MRR soma só academia ativa, não arquivada e não interna (`api/super-overview.js:135-147`). O ARR é o MRR vezes 12 (`api/super-overview.js:184`). O MRR usa o preço mensal efetivo de hoje mesmo quando a academia paga plano anual (`priceAnnual`, `api/asaas.js:206-212`), então o ARR não é o valor contratado.
  - "Trials vencendo" pega só os próximos 7 dias (`api/super-overview.js:175`). "Vencimentos" pega 30 dias (`api/super-overview.js:156`).
  - O preço efetivo: preço negociado maior que zero ganha e não soma consultor extra (`api/_plans.js:39-51`).
  - A UF gravada pelo super-admin não vira 2 letras, só é cortada em 60 caracteres (`api/tenant-status.js:193`). No provisionamento e no cadastro feito pela própria academia ela é normalizada (`api/provision-tenant.js:272`; `api/asaas.js:359`). Agrupar por UF pede normalizar antes.
  - `paymentStatus` é o estado de hoje e o super-admin pode editar à mão (`api/tenant-status.js:207-220`).

#### R161. Saúde de uso por academia

Quais academias usam o sistema de verdade no dia a dia?

- Para quem: super-admin.
- Recortes: academia, plano.
- Números: interações em 7 e em 30 dias, leads novos no mês, matrículas, clientes, aulas, pessoas ativas na semana, integração com o Stronizap ligada ou não.
- Filtros: plano.
- Formato: tabela com sinal de risco.
- De onde vem: `stronix_interactions.createdAt` (contagem por janela), `stronix_interactions.actorAuthUid` (pessoas distintas, lendo os documentos), `stronix_leads.createdAt`, `stronix_leads.convertedAt` e `clienteSince`, contagem de `stronix_leads` com `lifecycleBucket` igual a `'cliente'`, `stronix_aulas.scheduledFor` e `tenants.integrations.zap` (`keyHash` e `revokedAt`) reduzido a sim ou não.
- Desde quando: interações e leads desde o início de cada academia. Autor da interação (`actorAuthUid`) desde 13/07/2026. `lifecycleBucket` desde 13/07/2026 (PR #137, com backfill na PR #140). Aulas desde 16/07/2026, com visitas só a partir de 18/08/2026 (`src/lib/crm/scope.js:19-24`). Chave do Zap desde 09/09/2026 (PR #200).
- Viabilidade e prioridade: com ajuste, prioridade média. Entra no super-overview, sem gastar a última das 12 funções da Vercel.
- Permissão e custo: só super-admin, pelo servidor, porque as rules não deixam o super-admin ler `artifacts/`. Contagem de campo único custa 1 leitura a cada mil entradas (`api/super-overview.js:21-25`). Pessoas distintas pede ler as interações da semana, de centenas a poucos milhares de leituras por academia a cada abertura. Por isso o cálculo deve rodar sob demanda, numa action do super-overview, e não no GET que roda toda vez.
- Já existe em: Console, card Em risco, que conta academia ativa ou em trial sem interação há 14 dias ou mais (`api/super-overview.js:168-172`).
- Conferência no código: ajustado.
  - O super-overview conta leads e interações totais, sem janela de tempo (`api/super-overview.js:43-47`). A contagem de 7 e 30 dias pede action nova ou campo novo na resposta. Não precisa de função nova.
  - "Pessoas ativas na semana" não sai de contagem. Não existe carimbo de login nem de última atividade no usuário: não achei quem grave `lastLogin` ou `lastSeen`. Ou se leem todas as interações da semana (1 leitura por documento), ou se faz uma contagem por usuário em `actorAuthUid` mais `createdAt`, que pede índice composto que não está no `firestore.indexes.json`. O índice que existe é `leadConsultantAuthUid` mais `createdAt`, e esse campo é o dono do lead, não quem fez a interação.
  - "Matrículas" contadas por `convertedAt` no mês não batem com o CRM, porque entram retorno de ex-cliente e matrícula importada (`src/lib/crm/cohort.js:18-54`; `isImportCreatedLead` em `src/lib/operacional/routine.js:98-99`). Para bater com o CRM, só lendo os documentos. A outra saída é dar o nome de "conversões no mês (inclui retorno)".
  - "Leads novos" por `createdAt` inclui os que a importação criou. A importação também grava interações em massa, que incham as "interações em 7 dias" no dia do import. Filtrar por `type` na contagem pede índice composto.
  - "Integração Zap ligada" só diz que existe chave gerada e não revogada (`api/zap.js:133-156`). Nada grava o último uso da chave (não achei `lastUsedAt`), então não dá para afirmar que o Stronizap está consultando. O super-overview não devolve `integrations` hoje. Se passar a devolver, só o sim ou não, nunca o `keyHash`.

#### R162. Receita recebida do SaaS

Quanto entrou de fato por mês e por academia, bruto e líquido?

- Para quem: super-admin.
- Recortes: mês, academia, forma de pagamento.
- Números: bruto, líquido, quantidade de pagamentos.
- Filtros: período.
- Formato: evolução mensal.
- De onde vem: `tenant_payments.event` (só os eventos de pagamento confirmado, com estorno abatendo), `tenant_payments.paymentId` (para não contar o mesmo pagamento duas vezes), `value`, `netValue`, `paidAt` (texto `AAAA-MM-DD`), `billingType` e `tenantId`, mais `tenants.internal` para tirar as internas.
- Desde quando: 08/06/2026 (commit `337b3c5`), só para academias cobradas pelo Asaas.
- Viabilidade e prioridade: com ajuste, prioridade média. O dado existe, mas o mesmo pagamento aparece várias vezes e precisa ser agrupado por `paymentId`.
- Permissão e custo: só super-admin, que lê a coleção direto pelas rules (`firestore.rules:295-298`). Roda no navegador do super-admin, com 1 leitura por evento de pagamento no período. A coleção é pequena, alguns eventos por academia por mês. Nenhuma função nova.
- Já existe em: Console → Faturamento, card Recebido, que soma os 25 últimos eventos.
- Conferência no código: ajustado.
  - Cada evento do webhook vira um documento em `tenant_payments`, com o id do evento (`api/asaas.js:76` e `124`). O mesmo pagamento aparece como CREATED, CONFIRMED, RECEIVED, OVERDUE e assim por diante. A receita soma só PAYMENT_CONFIRMED, PAYMENT_RECEIVED e PAYMENT_RECEIVED_IN_CASH (`api/asaas.js:43`) e agrupa por `paymentId`, porque o cartão gera CONFIRMED e depois RECEIVED do mesmo pagamento.
  - PAYMENT_REFUNDED, PAYMENT_DELETED e PAYMENT_RECEIVED_IN_CASH_UNDONE (`api/asaas.js:44`) abatem do mês.
  - `paidAt` é texto `AAAA-MM-DD` (`paymentDate` ou `confirmedDate` do Asaas, `api/asaas.js:120`), não data do Firestore. O agrupamento por mês é pelo texto.
  - Academia interna fica de fora. Pagamento de sandbox anterior à ida para produção pode estar na coleção, e não achei marca de ambiente no registro.
  - Academia cobrada à mão (`api/tenant-status.js:206-228`) não tem registro em `tenant_payments`. A receita recebida cobre só quem paga pelo Asaas.
  - Não precisa de servidor. Hoje o Console lê só os 25 últimos (`api/super-overview.js:234`) e o card Recebido soma sem agrupar por pagamento (`src/views/console/SuperConsole.jsx:853`).

#### R163. MRR real mês a mês

Como a receita recorrente mudou a cada mês: quanto veio de academia nova, de aumento, de redução e de saída?

- Para quem: super-admin.
- Recortes: mês, plano, academia.
- Números: MRR, novo, expansão, contração, saída (churn), academias ativas.
- Filtros: período.
- Formato: cascata mensal.
- De onde vem: uma foto mensal por academia, que ainda não existe, com `status`, `archived`, `internal`, `plan`, `monthlyPrice`, `consultantCount` e o preço efetivo. Como aproximação, `tenant_payments` com os eventos PAYMENT_CREATED agrupados por `dueDate` dá o valor faturado.
- Desde quando: a partir da primeira foto gravada. O faturado pelo Asaas existe desde 08/06/2026, como aproximação.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade média. A série de hoje é estimativa com os preços de hoje.
- Permissão e custo: só super-admin. No servidor, gravar a foto custa 1 escrita por academia por mês e ler a série custa 1 leitura por academia-mês.
- Já existe em: Console, gráfico de MRR dos últimos 6 meses, que é estimado (`src/views/console/SuperConsole.jsx:113` e `118-126`).
- Conferência no código: ajustado.
  - O diagnóstico está certo. A série de hoje recalcula cada mês com o conjunto de ativas e o preço de hoje e ignora saída e mudança de preço (`api/super-overview.js:204-217`, com o comentário "Evolução ESTIMADA").
  - Não dá para reconstruir o passado pela auditoria. `tenant.update` grava só os nomes dos campos alterados, sem valor antigo e novo (`api/tenant-status.js:244-247`). A passagem de trial para active feita pelo webhook não grava `statusChangedAt` nem auditoria (`api/asaas.js:94-95`). A edição de preço dos planos em `plans/` também não é auditada (não achei `logAudit` em `api/plans.js`).
  - O `vercel.json` só tem rewrites, sem cron. A foto precisa de gatilho: gravar sob demanda na primeira abertura do Console no mês, numa action do super-overview. Sem função nova (11 de 12 em uso).
  - Existe um caminho parcial sem dado novo: o faturado por mês sai de `tenant_payments` pelo `dueDate` dos eventos PAYMENT_CREATED, desde 08/06/2026. Só vale para quem é cobrado pelo Asaas e mostra o faturado, não o MRR contratado.

#### R164. Inadimplência e cobrança das academias

Quem está em atraso, há quanto tempo, quanto vale e quem vence nos próximos 30 dias?

- Para quem: super-admin.
- Recortes: academia, faixa de atraso.
- Números: valor em atraso, dias de atraso, vencimentos em 30 dias.
- Filtros: nenhum.
- Formato: tabela.
- De onde vem: `tenants.paymentStatus`, `tenants.paymentOverdueSince` e `tenants.nextBillingAt`, mais `tenant_payments` (`event`, `paymentId`, `value`, `dueDate`) para o valor em atraso de verdade.
- Desde quando: `paymentStatus`, `nextBillingAt` e os eventos desde 08/06/2026. `paymentOverdueSince` desde 09/06/2026.
- Viabilidade e prioridade: com ajuste, prioridade média. O dado já está gravado. O ajuste é tirar o valor em atraso dos eventos, e não do preço.
- Permissão e custo: só super-admin, que lê `tenants` e `tenant_payments` pelas rules (`firestore.rules:261` e `296`). Pode rodar no servidor ou no navegador do super-admin: os documentos das academias já estão carregados, e a leitura nova é só a dos eventos de pagamento em aberto, poucos por academia.
- Já existe em: Console → Faturamento, nos cards Inadimplência, Inadimplentes e Próximos vencimentos (`api/super-overview.js:155-161`; `src/views/console/SuperConsole.jsx:849-851` e `874-880`).
- Conferência no código: ajustado.
  - O valor em atraso não está gravado na academia. O Console usa o preço efetivo de hoje como aproximação (`src/views/console/SuperConsole.jsx:851`). O valor real sai de `tenant_payments`: eventos PAYMENT_OVERDUE sem evento pago depois, para o mesmo `paymentId`.
  - Os dias de atraso saem de `paymentOverdueSince`, que é regravado a cada novo PAYMENT_OVERDUE (`api/asaas.js:96-98`). Com duas faturas vencidas, a conta recomeça na segunda e o atraso aparece menor. O super-admin também regrava o campo ao marcar inadimplente à mão (`api/tenant-status.js:214-218`).
  - `nextBillingAt` só muda no PAYMENT_CREATED, na criação da assinatura ou à mão (`api/asaas.js:101-103` e `258-267`; `api/tenant-status.js:225-228`). O vencimento pode ficar velho.
  - `paymentStatus` é o estado de hoje. A faixa de atraso de meses passados só sai dos eventos em `tenant_payments`.
  - As rules bloqueiam a academia com mais de 3 dias de atraso (`firestore.rules:31-35`). O relatório deve mostrar essa faixa.

#### R165. Funil de trial e ativação

Das academias criadas, quantas ativaram o gestor, saíram do trial e pagaram a primeira fatura?

- Para quem: super-admin.
- Recortes: mês de criação, plano.
- Números: criadas, ativadas, primeira fatura paga, dias até pagar.
- Filtros: período.
- Formato: funil.
- De onde vem: `tenants.createdAt`; `superadmin_audit` com `action` igual a `'tenant.provision'` (`details.status`, `details.plan`, `details.mode`); `tenants/{id}/invites.acceptedAt` do convite com `role` admin; `stronix_users/{primaryAdminUid}.createdAt`, pelo servidor; e o menor `tenant_payments.paidAt` entre os eventos pagos.
- Desde quando: criação desde 02/06/2026. Auditoria de provisionamento desde 03/06/2026. Pagamentos desde 08/06/2026. Ativação por convite desde 11/06/2026. Academia criada antes de 03/06/2026 não tem `tenant.provision`.
- Viabilidade e prioridade: com ajuste, prioridade baixa. O rascunho dizia que a data de ativação do gestor não é gravada, mas ela é. O que não tem registro é a saída do trial.
- Permissão e custo: só super-admin. Academias, auditoria, convites e pagamentos são poucos e podem ser lidos no navegador do super-admin (os convites ele lê pelas rules, `firestore.rules:266-269`). O documento do gestor em `stronix_users` exige servidor.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado.
  - A ativação do gestor é gravada. O aceite do convite grava `acceptedAt` e `acceptedUid` em `tenants/{id}/invites` (`api/invite-accept.js:122-125`), e o documento do gestor em `stronix_users` nasce com `createdAt` no aceite (`api/invite-accept.js:112-119`). No modo senha, a conta nasce no provisionamento (`api/provision-tenant.js:238-252`), e aí o que falta é o primeiro login, que ninguém grava.
  - A saída do trial não tem evento. O webhook troca trial por active sem `statusChangedAt` e sem auditoria (`api/asaas.js:94-95`). `trialEndsAt` é regravado quando o super-admin muda `trialDays`, e a auditoria só diz que o campo mudou (`api/tenant-status.js:141-154` e `244-247`). O status e o plano iniciais estão em `tenant.provision` (`api/provision-tenant.js:350-353`), mas o prazo do trial não.
  - A primeira fatura paga é o menor `paidAt` entre os eventos pagos da academia em `tenant_payments`, desde 08/06/2026.

#### R166. Uso de vagas e chance de upgrade

Quem está no limite do plano ou pagando consultor extra?

- Para quem: super-admin.
- Recortes: academia, plano.
- Números: gestores usados e limite, consultores usados e limite, consultores extras, valor dos extras.
- Filtros: nenhum.
- Formato: tabela.
- De onde vem: contagem de `stronix_users` por `role` (servidor), `plans.maxManagers`, `plans.maxConsultants`, `plans.extraUserPrice` e `plans.maxExtraUsers`, mais `tenants.monthlyPrice`, que anula os extras.
- Desde quando: vagas por papel desde 10/06/2026. Preço do consultor extra desde 08/06/2026.
- Viabilidade e prioridade: com ajuste, prioridade baixa. `getSeatUsage` já faz a conta, mas uma academia por vez.
- Permissão e custo: só super-admin, pelo servidor. Se entrar no super-overview, nenhuma leitura nova, porque ele já conta usuários por papel.
- Já existe em: nada parecido hoje para todas as academias juntas. A conta existe para uma academia por vez, no GET de `api/tenant-status.js:75-97`.
- Conferência no código: ajustado.
  - Não é só ligar a tela. `getSeatUsage` roda uma academia por vez (`api/tenant-status.js:75-97`). A tabela de todas pede que o super-overview devolva `planSeatLimits` e `billableExtraConsultants` (`api/_plans.js:55-70` e `109-120`). Ele já tem `managerCount`, `consultantCount` e `plansMap` (`api/super-overview.js:43-52` e `109`), então são poucas linhas e nenhuma leitura nova.
  - Academia com preço negociado (`monthlyPrice` maior que zero) não paga extra, porque o preço negociado é final (`api/_plans.js:40-44`; `api/asaas.js:203-204`). O valor dos extras tem de sair zero para ela, senão o relatório promete receita que não é cobrada.
  - Vaga é todo documento em `stronix_users`. Documento sem `role` conta como consultor, e convite pendente não conta (`api/_plans.js:175-191`).

#### R167. Suporte por academia

Quem mais abre chamado, quanto demoramos para responder e o que está aberto?

- Para quem: super-admin.
- Recortes: academia, prioridade, status, mês.
- Números: chamados, tempo até a primeira resposta, abertos há N dias.
- Filtros: período.
- Formato: tabela.
- De onde vem: `tickets.tenantId`, `tickets.createdAt`, `tickets.prioridade`, `tickets.status` e `tickets.mensagens`, com `de` e `emMs`. A primeira resposta é a primeira mensagem com `de` igual a `'suporte'`. O chamado do cliente nasce com `mensagens`, `createdAt` e `prioridade` (`src/modals/SupportCenterModal.jsx:78-92`).
- Desde quando: chamados desde 09/06/2026. Tempo até a primeira resposta desde 07/07/2026.
- Viabilidade e prioridade: com ajuste, prioridade baixa. A resolução não tem data.
- Permissão e custo: só super-admin. A academia lê só os próprios chamados. Não há leitura nova, porque o Console já assina a coleção inteira no navegador do super-admin.
- Já existe em: Console → Suporte, com a contagem de abertos e de prioridade alta (`src/views/console/SuperConsole.jsx:1362-1363`).
- Conferência no código: ajustado.
  - O custo não é de servidor. O super-admin lê `tickets` direto pelas rules (`firestore.rules:308-321`), e o Console já assina a coleção inteira com `onSnapshot` (`src/views/console/SuperConsole.jsx:1355-1358`).
  - O tempo até a primeira resposta só existe para chamado com conversa. `mensagens` com `emMs` existe desde 07/07/2026. Chamado antigo vira uma mensagem só, sem resposta com data (`src/lib/ticketThread.js:9-18`).
  - Chamado aberto pelo próprio suporte no Console nasce sem `mensagens` e sem `createdBy` (`src/views/console/SuperConsole.jsx:1368`). Esses ficam fora da medida de resposta.
  - A resolução não tem data, como dizia o rascunho. Trocar o status só grava `updatedAt`, que é sobrescrito, e o cliente reabre o chamado voltando para `'aberto'` (`src/views/console/SuperConsole.jsx:1364`; `src/lib/ticketThread.js:31-32`).

#### R168. Trilha de auditoria da plataforma

Quem mexeu em qual academia, quando, e o que mudou de status e de plano?

- Para quem: super-admin.
- Recortes: ação, academia, quem fez, mês.
- Números: ações, entradas pelo "Acessar como", mudanças de status e de plano.
- Filtros: período, academia.
- Formato: tabela.
- De onde vem: `superadmin_audit.action`, `superadmin_audit.tenantId`, `superadmin_audit.actorUid`, `superadmin_audit.at` e `superadmin_audit.details`. Em `details` vem a lista `changed` na edição, `from` e `to` só na troca de plano feita pela própria academia, e `plan` e `status` na criação.
- Desde quando: 03/06/2026 (commit `7480250`).
- Viabilidade e prioridade: com ajuste, prioridade baixa. O que o super-admin faz dentro da academia fica no nome do gestor.
- Permissão e custo: só super-admin, que lê a coleção direto pelas rules. No navegador do super-admin, 1 leitura por registro no período.
- Já existe em: Console, lista das 30 últimas ações (`api/super-overview.js:223`).
- Conferência no código: ajustado.
  - "O que mudou de status e de plano" não sai completo. `tenant.update` grava só a lista de campos alterados (`details.changed`), sem valor antigo e novo (`api/tenant-status.js:244-247`; `api/_audit.js:9-20`). O de-para só existe em `plan.migrate.self` (`api/asaas.js:396`) e, como estado inicial, em `tenant.provision` (`api/provision-tenant.js:350-353`).
  - Mudança automática não entra na auditoria. O webhook muda `paymentStatus` e passa trial para active sem gravar nada ali (`api/asaas.js:85-105`). O cadastro de planos também não grava (não achei `logAudit` em `api/plans.js`).
  - A coleção mistura dois tipos de autor: o super-admin e o gestor da academia. São do gestor `tenant.profile.self`, `plan.migrate.self` e `asaas.subscription.activate.self` (`api/asaas.js:368`, `396` e `447`), e também `asaas.subscription.sync` (`api/_asaas.js:150-151`). O filtro por autor precisa separar os dois.
  - A justificativa confere. Dentro do "Acessar como", a sessão é do uid do gestor (`api/impersonate.js:61-65`). Só dá para atribuir a ação ao super-admin pela janela entre `impersonate.start` e `impersonate.stop`, e o `stop` só é gravado quando ele usa o botão de voltar (`api/impersonate.js:35-42`). Fechar a aba deixa a janela aberta.
  - Não precisa de servidor: as rules deixam o super-admin ler `superadmin_audit` direto (`firestore.rules:284-287`), com `orderBy('at')` de campo único (`src/lib/superadmin.js:50-61`).

#### R169. Comparativo anônimo entre academias

A conversão, a meta, a renovação e a venda por consultor da academia estão acima ou abaixo das academias parecidas?

- Para quem: super-admin, e o dono da academia na versão anônima.
- Recortes: academia (anônima para o dono), mês, tamanho da equipe.
- Números: conversão da safra, comparecimento, % da meta, renovação, venda por consultor.
- Filtros: mês.
- Formato: posição da academia dentro da faixa.
- De onde vem: uma foto mensal por academia, que ainda não existe, com esses cinco números. As contas saem do `metricsOf` de `src/lib/gerencial` e, depois de refatorar, de `src/lib/crm` e `src/lib/operacional`.
- Desde quando: a partir da primeira foto mensal. Cada número herda o começo da própria base: troca de etapa desde 14/09/2026, agendamentos desde setembro de 2026, contratos desde junho de 2026.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. As contas do CRM e do Operacional não rodam em `api/` sem refatorar.
- Permissão e custo: o super-admin vê com nome. O gestor da academia só vê a faixa anônima, e só quando houver um mínimo de academias comparáveis. No servidor, gravar a foto custa uma leitura completa da academia por mês, e consultar custa 1 leitura por academia-mês.
- Já existe em: nada parecido hoje.
- Conferência no código: ajustado.
  - Calcular na hora a conversão, a meta e a renovação de todas as academias pede ler leads, interações, contratos e aulas de cada uma a cada abertura: algo como centenas de milhares de leituras, mesmo com poucas academias. Só é viável com a foto mensal gravada por academia.
  - As contas do CRM e do Operacional importam `routine.js`, que importa `dailyGoal.js`, que puxa `lucide-react` (`src/lib/operacional/routine.js:5`; `src/lib/dailyGoal.js:1`). `src/lib/crm/cohort.js:7` e `src/lib/crm/scope.js:7` dependem de `routine.js`. Rodar em `api/` pede refatorar antes. As do Gerencial já rodam, porque `src/lib/gerencial/` não importa `dailyGoal.js`.
  - Para o dono ver a faixa anônima, é preciso uma action nova de admin da academia, no molde de `handleTenantSelf` (`api/asaas.js:283-287`). "Dono" não é papel com permissão própria, é o `primaryAdminUid`, então qualquer gestor da academia veria.
  - Com poucas academias fora das internas, a faixa entrega quem é quem. É preciso um mínimo de academias por faixa e tirar as internas (`api/super-overview.js:136-138`).
  - A comparação depende da configuração de cada academia: nomes de etapa que contam como matrícula, dias de meta, `renewalGraceDays` e alvo de prospecção individual. A página precisa dizer isso.

#### R170. Custo de leitura por academia

Quanto cada academia custa em leitura do Firestore?

- Para quem: super-admin.
- Recortes: academia, tela.
- Números: leituras por dia.
- Filtros: nenhum.
- Formato: não se aplica.
- De onde vem: não existe.
- Desde quando: não se aplica.
- Viabilidade e prioridade: fora do escopo, prioridade baixa. O Firestore cobra por projeto e o app não conta a própria leitura.
- Permissão e custo: não se aplica.
- Já existe em: nada parecido hoje.
- Conferência no código: confirmado. O super-overview só faz contagens e lê a última interação, sem medir leitura (`api/super-overview.js:7-12`). Não achei contador de leitura no app: nenhum campo nem coleção grava documentos lidos por academia ou por tela.

#### R171. Implantação e uso de recursos por academia

Cada academia já configurou o básico (planos com valor, professores, unidades, alvos de prospecção, marcos de renovação) e usa contratos, agenda, indicações, upgrade e a integração com o Stronizap?

- Para quem: super-admin.
- Recortes: academia, recurso, dias desde a criação.
- Números: recursos configurados, recursos em uso nos últimos 30 dias, data do primeiro lead, do primeiro contrato e da primeira aula, integração com o Zap ativa.
- Filtros: sem as academias internas, status da academia.
- Formato: matriz de academia por recurso, com marca de feito e a data.
- De onde vem:
  - `buildSetupState` (`src/lib/settingsSetup.js`) sobre `stronix_funnels`, `stronix_statuses`, `stronix_sources`, `stronix_modalities`, `stronix_planos`, `stronix_loss_reasons`, `stronix_config/general` (`metaWeekdays`, `slaOverdueDays`, `renewalCheckpoints`) e `stronix_users` (`authUid`, `dailyVolumeTarget`).
  - Contagem por coleção em `stronix_professores`, `stronix_units`, `stronix_contratos` e `stronix_aulas`, com janela de 30 dias.
  - `tenants/{id}.integrations.zap` como sim ou não: `keyHash` presente e `revokedAt` nulo.
- Desde quando: catálogos, equipe e configuração desde a criação de cada academia. Planos e contratos desde 30/06/2026 (PR #123). Professores desde 09/07/2026. Aulas desde 16/07/2026. Marcos de renovação desde 23/07/2026. Upgrade desde 11/09/2026 (PR #199). Chave do Zap desde 09/09/2026 (PR #200).
- Viabilidade e prioridade: com ajuste, prioridade baixa. Mostra ao suporte onde agir antes que a academia cancele sem ter usado metade do produto.
- Permissão e custo: só super-admin, pelo servidor. Os catálogos são pequenos e lidos inteiros (dezenas de documentos por academia), mais uma contagem por coleção. Entra como action no super-overview, calculada sob demanda.
- Já existe em: Configurações → Visão geral mostra esse progresso, mas de uma academia por vez, a que está aberta. No catálogo, os mais próximos são o R161 (uso do dia a dia) e o R165 (trial até a primeira fatura), e nenhum deles mostra o que cada academia ainda não implantou.
- Conferência no código: ajustado.
  - As marcas `*SetupDoneAt` não medem implantação. São carimbos automáticos da configuração de funis no primeiro login de gestor (`src/App.jsx:1011-1019`, `1079-1081`, `1183-1185` e `1235-1237`; `src/lib/setupRun.js:53-59`) e só dizem que um gestor abriu o app depois de cada entrega.
  - A régua certa já existe e é pura: `buildSetupState`, em `src/lib/settingsSetup.js:42-67` (funil, origens, modalidades, planos, motivos de perda, dias de meta, SLA, acessos, alvo de prospecção). Não importa nada, então roda em `api/`. É a mesma conta da Visão geral de Configurações (`SettingsView.jsx`).
  - Origens, motivos de perda e modalidades nascem prontos no provisionamento (`api/provision-tenant.js:45-56`). Esses passos aparecem feitos sem a academia ter mexido.
  - Marcos de renovação sem campo usam o padrão 90/60/30. Ausência não quer dizer "não configurado".
  - "Integração Zap ativa" é chave gerada e não revogada (`api/zap.js:133-156`). Nada grava o uso, então não prova que o Stronizap está consultando.
  - Primeiro lead e primeiro contrato por `orderBy(createdAt)` com limite 1 podem ser importados. Tirar os importados (`isImportedContract`, `isImportCreatedLead`) obriga a ler alguns documentos.

#### R172. Retenção de academias por safra

Das academias que entraram em cada mês, quantas seguem pagando depois de 1, 3, 6 e 12 meses, e por que as que saíram foram embora?

- Para quem: super-admin.
- Recortes: mês de criação, plano, meses desde a criação, motivo de saída.
- Números: academias da safra, % pagando em cada marco, MRR da safra, saídas por motivo.
- Filtros: plano, sem as internas.
- Formato: tabela de safras.
- De onde vem:
  - `tenants`: `createdAt`, `internal`, `archived`, e `status` e `plan` de hoje. `statusChangedAt` guarda só a última troca feita pelo `tenant-status`.
  - `tenant_payments`: `tenantId`, `paymentId`, `event` (PAYMENT_CONFIRMED, PAYMENT_RECEIVED e PAYMENT_RECEIVED_IN_CASH, menos REFUNDED, DELETED e UNDONE), `value`, `paidAt` em texto e `at`, agrupado por `paymentId`.
  - `tenants.billingCycle` (`monthly` ou `annual`), para saber quantos meses cada pagamento cobre.
  - Campo novo a gravar: motivo de saída, de lista fixa, e um registro de mudança de status com valor anterior e novo, no `tenant-status` e no webhook do Asaas.
- Desde quando: safras por `createdAt` desde o provisionamento (02/06/2026). Academia antiga sem `createdAt` fica fora. Pagamentos só das academias cobradas pelo Asaas, desde 08/06/2026, com possíveis duplicatas antes de 13/07/2026, que se resolvem agrupando por `paymentId`. Cobrança manual não tem histórico. Motivo de saída e histórico de plano e status só a partir de quando começarem a ser gravados, porque hoje não existem.
- Viabilidade e prioridade: precisa gravar dado novo, prioridade baixa. Falta olhar o SaaS por safra. A curva sai dos pagamentos de cada mês, mas a academia guarda só o último status e o último `statusChangedAt`, e a auditoria da mudança feita pelo super-admin grava só o nome do campo. Por isso o motivo de saída precisa começar a ser gravado já.
- Permissão e custo: só super-admin, pelo servidor. As rules já liberam `superadmin_audit` e `tenant_payments` só para ele (`firestore.rules:284-298`), com escrita só pelo servidor. Custo pequeno: uma leitura de `tenants` mais a leitura inteira de `tenant_payments` (alguns eventos por academia por mês) e, se for usar, de `superadmin_audit`. Sem índice composto. Entra no GET do `api/super-overview.js`, sem função nova (11 de 12 em uso). Hoje o super-overview lê auditoria e pagamentos com teto de 30 e 25 (`api/super-overview.js:223` e `234`), então precisa de uma leitura sem teto ou de um parâmetro opcional, para não pesar o GET de todo dia. Gravar o motivo pede mudança no `api/tenant-status.js` e no formulário do Console, sem regra nova.
- Já existe em: nada que seja safra. O Console tem o MRR mês a mês estimado, com o conjunto de ativas e o preço de hoje, que ignora saída (`api/super-overview.js:204-217`), o churn de 30 dias por `statusChangedAt` (`api/super-overview.js:163-166`) e as academias novas por mês (`api/super-overview.js:187-202`). No catálogo, os mais próximos são o R163 (MRR e saída mês a mês) e o R165 (trial até a primeira fatura).
- Conferência no código: ajustado.
  - Nenhum documento guarda o motivo de saída. O `tenant-status` aceita `status`, `archived`, `internal`, `internalNotes` e mais alguns campos, nenhum de motivo (`api/tenant-status.js:109-113`). A auditoria grava só os nomes dos campos alterados, sem valor anterior nem novo, em `details.changed` (`api/tenant-status.js:244-247`; `api/_audit.js:9-17`), e o Console mostra assim (`src/views/console/SuperConsole.jsx:263`). "Saídas por motivo" só existe depois de começar a gravar, por exemplo um `exitReason` de lista fixa no `tenant-status` ao arquivar ou suspender. Cabe na mesma função.
  - A academia guarda só o estado de hoje. `status`, `plan`, `archived` e `paymentStatus` são sobrescritos, e `statusChangedAt` guarda só a última troca (`api/tenant-status.js:233-235`). Os marcos de 1, 3, 6 e 12 meses não saem de `tenants`. Saem de `tenant_payments`, ou de um registro de mudança de status com valor anterior e novo, que hoje ninguém grava.
  - `statusChangedAt` não é gravado em todo caminho que muda o status. O webhook do Asaas passa trial para active no pagamento sem carimbar a data (`api/asaas.js:94-95`), e o provisionamento não grava `statusChangedAt` (`api/provision-tenant.js:260-280`). Só o `tenant-status` carimba (`api/tenant-status.js:157-160` ao arquivar, `233-235` no geral). O próprio código avisa que academia antiga sem o campo não conta (`api/tenant-status.js:230-232`). Pelo `tenant-status` só existem os status `active` e `suspended`; `trial` vem do provisionamento (`api/tenant-status.js:26`).
  - "Pagando" por `tenant_payments` só vale para quem é cobrado pelo Asaas. A cobrança manual (`paymentStatus` e `lastPaymentAt` pelo `tenant-status`, `api/tenant-status.js:207-224`) não cria registro de pagamento: sobrescreve `lastPaymentAt` e deixa na auditoria só o nome do campo. Academia cobrada fora do Asaas, ou antes de 08/06/2026, aparece como "não pagando".
  - Plano anual gera um pagamento por ano (ciclo YEARLY, `api/asaas.js:206-212` e `262`). Se o marco for "pagou no mês N", a academia anual some nos marcos de 1, 3 e 6 meses. O marco tem de ser "coberta por pagamento" (`paidAt` mais o ciclo), e não "pagou naquele mês".
  - `tenant_payments` grava todo evento do Asaas, com `event` e `status` (`api/asaas.js:107-125`). Para contar como pago, filtrar os três eventos pagos, descontar REFUNDED, DELETED e UNDONE (`api/asaas.js:43-44`) e agrupar por `paymentId`, senão CONFIRMED mais RECEIVED contam dobrado. `paidAt` é texto vindo do Asaas (`api/asaas.js:120`), não data do Firestore.
  - O plano da safra é o plano de hoje. A troca de plano sobrescreve `tenant.plan` (`api/tenant-status.js:133-139`) e a auditoria diz só `plan`, sem de nem para.
  - "MRR da safra" com `effectivePrice` é o preço de hoje: o negociado, ou o do catálogo mais os consultores extras de hoje (`api/super-overview.js:84`; `api/_plans.js:39-51`). Para o MRR de cada mês, somar o `value` dos pagamentos confirmados de `tenant_payments` e dividir o anual por 12.
  - Academia sem `createdAt` fica fora de toda safra, e o super-overview já pula esses casos (`api/super-overview.js:197` e `213`). Isso atinge academias anteriores ao provisionamento de 02/06/2026 (commit `498c9db`), como a `stronix-crm-app`, se não tiverem o campo. Não conferi em produção.
  - Pelo `git log -S tenant_payments`, a coleção nasce em `337b3c5` (08/06/2026, Asaas) e ganha idempotência em `7263d08` (13/07/2026). Antes disso havia duplicata de reentrega sem `body.id`. O `firestore.indexes.json` não tem índice de `tenant_payments` nem de `superadmin_audit`, e ler a coleção inteira ou com `where` de campo único não precisa de índice.
  - A assinatura cancelada vai para a auditoria sem motivo (`api/asaas.js:22-29` e `191`).


## 6. Lacunas e dados a gravar

Esta seção junta o que o sistema não guarda, o que guarda torto e o que precisa começar a gravar para a tela de Relatórios responder mais perguntas. Uma regra vale para tudo aqui: o histórico só começa no dia em que o sistema passa a gravar. O que não foi gravado não volta. Em alguns casos o texto das interações permite uma reconstrução aproximada, e a spec do CRM decidiu não usar texto.

Base: o código da worktree em 24/09/2026 (commit `d0c3128`, igual à main depois da PR #220). Caminhos relativos à raiz do repositório do Stronilead. Os ids R### são os relatórios do catálogo da seção 5. As datas de "desde quando" são as de produção, pelo merge da PR, e não a do commit.

### 6.1 Dado que se perde hoje

Há dois tipos de perda. No estado sobrescrito, o documento guarda só o valor de agora e a mudança não deixa evento com data. No dado nunca gravado, a pergunta existe e o campo não. As tabelas estão por assunto. No fim vem uma lista curta de campos que já são gravados e que nenhuma tela lê, o atalho mais barato.

#### Leads, funil e perda

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| Sair da Perda apaga `lostAt` e `lossReason`, e a matrícula também apaga. O motivo sobrevive só no texto "Lead perdido. Motivo: X" da interação. | `src/lib/stageMove.js:89-92`; `src/lib/contractsWrites.js:108-113`; `src/views/KanbanView.jsx:1179-1195` | As perdas de um mês fechado diminuem quando alguém reabre o lead. Reativação e repescagem de perdidos dependem de ler texto (R021, R022, R023, R026). | Gravar `lossReason` como campo na interação `status_change` para Perda, que já leva `toStatus` desde 14/09/2026 18h10, e contar a perda pelo evento. |
| Não existe campo de quem cadastrou o lead. O cadastro manual põe o autor em `consultantId`, o mesmo campo que a troca de responsável sobrescreve. No link público o dono é herdado do indicador. | `src/lib/leads.js:261-265`; `src/modals/AddLeadModal.jsx:471`; `api/tenant-resolve.js:283-285` | Leads novos e prospecção por pessoa seguem o dono de hoje. Transferir um lead muda o mês passado de duas pessoas (R001, R101, R131). | `createdById`, `createdByAuthUid` e `createdByName` gravados uma vez no cadastro manual, no link e na importação. |
| A troca individual de responsável grava só texto com nomes e o `consultantChangedAt` da última troca. A migração em massa não grava evento por lead, não carimba `consultantChangedAt` e reescreve `leadConsultantId` de todas as interações dos leads movidos. | `src/lib/clientRegistration.js:108-109`; `src/modals/ClientRegistrationModal.jsx:72-86`; `src/views/settings/TransferLeadsTab.jsx:141-173` | De quem era a carteira num mês passado, quem passou para quem, e o crédito de tarefas antigas sem autor, que muda de pessoa a cada migração (R069, R117, R119, R120). | Interação por lead com `fromConsultantId`, `toConsultantId` e motivo, também na migração. Parar de reescrever `leadConsultantId` das interações antigas. |
| A troca de etapa só tem origem e destino estruturados desde 14/09/2026 18h10, e pelo nome. Antes disso existe só o texto "[etapa]" com o destino. | `src/lib/crm/scope.js:11-17`; `src/lib/stageMove.js:51-60` | Passagem entre etapas, etapa da perda e tempo na etapa antes de setembro. Etapa renomeada vira duas linhas (R010, R012, R018). | Gravar `fromStatusId` e `toStatusId` junto do nome. O passado anterior a 14/09 não volta. |
| Mudam a etapa sem `status_change` nem `statusEnteredAt`: a migração de um funil inteiro para Indicações, o cadastro pelo link público e a importação. | `src/views/settings/ReferralOwnersSection.jsx:131-137`; `api/tenant-resolve.js:263-296`; `src/lib/clientImport.js:597-651` | Tempo na etapa e passagem ficam errados para esses leads, e safras antigas mudam de funil sem rastro (R010, R011, R013, R014). | `status_change` por lead no movimento em massa e `statusEnteredAt` em todo cadastro. |
| Excluir o lead apaga o documento e as interações dele. Contratos e aulas ficam, com o nome da pessoa, porque as rules não deixam apagar. | `src/views/LeadProfileView.jsx:215-243`; `firestore.rules:242`, `:253` | Meses fechados mudam sem rastro, a venda aparece como "Sem origem" e o pedido de exclusão do titular não fica registrado (R016, R022, R152, R159). | Arquivar em vez de apagar, ou manter um documento mínimo sem dado pessoal e um evento de exclusão fora do lead. |
| Editar origem, dor, etiquetas, professor e modalidade de interesse sobrescreve o lead sem evento. | `src/modals/ClientRegistrationModal.jsx:87-88`; `src/lib/clientRegistration.js:48-90` | Trocar a origem reclassifica a captação de meses passados, e ninguém sabe quem trocou (R001, R006, R141). | Interação quando `source` mudar, ou travar a origem depois da matrícula. |
| O cadastro manual acha o telefone repetido, avisa e não grava nada. | `src/modals/AddLeadModal.jsx:435-441`; `src/hooks/useDuplicateLead.js:19` | Quantos leads antigos voltaram a procurar e por qual canal (R005). | Interação no lead existente, com a origem escolhida na nova tentativa, quando a pessoa confirma que é a mesma. |
| O `createdAt` do lead manual é a hora em que o consultor salvou, não a hora em que a pessoa procurou. Só o link público tem a hora real. | `src/modals/AddLeadModal.jsx:476`; `api/tenant-resolve.js:291` | Horário de chegada, cobertura de turno e rapidez do primeiro contato medem a disciplina de registro (R002, R020). | Campo de hora do primeiro contato no cadastro, ou o dado vindo do Stronizap pela Parte B da ponte. |
| Não existem campanha, UTM nem investimento por origem e mês. | Busca por `utm`, `campaign`, `campanha`, `gclid` e `fbclid` em `src/` e `api/` sem resultado | Custo por lead, custo por matrícula e retorno por canal (R004, R065). | Campanha no lead e investimento por origem e mês numa coleção nova, com leitura só do gestor. |
| O lead não tem valor esperado nem plano de interesse, e a etapa não tem probabilidade. | Valor só existe no contrato (`src/lib/contracts.js:162`) | Previsão de valor do funil (R019). | Plano de interesse no lead, ou aceitar a estimativa por taxa histórica vezes ticket. |

#### Agenda, aulas e visitas

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| O desfecho da visita fica no espelho do lead e na interação `daily_goal_done`. O registro em `stronix_aulas` fica "agendada" para sempre. | `src/lib/appointmentOutcome.js:106-110`; `src/lib/crm/appointments.js:80-104` | O comparecimento de visita é deduzido, e o cancelamento lançado noutro dia não aparece (R027, R028, R033, R038, R142, R157). | Gravar `status` e `outcomeAt` no registro da visita, com a mesma trava de data da aula. A PR já está prevista na decisão 13 do plano do CRM (`docs/superpowers/plans/2026-09-15-dashboard-crm-tela.md:47`). |
| A remarcação pela Meta Diária só mexe no registro quando é aula. | `src/views/DailyGoalView.jsx:1463-1480` | A visita remarcada não existe na data nova, e a antiga fica aberta (R015, R027, R033, R039). | Chamar `upsertScheduledAppointment` com tipo visita no `handleReschedule`. |
| Remarcar troca o `scheduledFor` do mesmo registro em aberto. A data original e o número de remarcações se perdem, e o `createdAt` antigo fica. | `src/lib/aulasWrites.js:25-31` | Quantas vezes remarcou, antecedência real e falta seguida de remarcação (R035, R036, R037). | `bookedAt` a cada marcação, `rescheduleCount` e `originalScheduledFor` no registro. |
| Adiar para amanhã, perder o lead e trocar aula por visita tiram o compromisso do lead e deixam o registro "agendada". | `src/views/DailyGoalView.jsx:1170-1187`; `src/views/LeadProfileView.jsx:303-318`; `src/views/KanbanView.jsx:1179-1195` | "Sem desfecho" inflado e escala do professor com aula que não vai acontecer (R027, R038, R042). | Fechar o registro como `cancelled`, com o motivo, nesses três caminhos. |
| O registro guarda o dono do lead, não quem agendou. A presença pela Agenda do dia grava a interação sem `actorId` nem `actorAuthUid`, só o nome em `consultantName`, e não sobe `lastInteractionAt`. | `src/lib/aulasWrites.js:33-42`; `src/lib/appointmentOutcome.js:85-134` | Quem agenda, quem confirma presença, produção da recepção e carteira sem toque (R045, R057, R100, R113, R120). | Passar o desfecho por `logInteraction`. Gravar `bookedById` e `outcomeById` no registro. |
| O desfecho tem quatro valores e nenhum motivo. | `src/lib/leads.js:181` | Por que as pessoas faltam ou cancelam (R038). | Motivo opcional, de lista fixa, no desfecho. |
| O pacote do passe (`trialClassesPlanned`) fica só no lead e é sobrescrito no agendamento seguinte. | `src/lib/aulas.js:92-120`; `src/lib/schedulePatch.js:59` | Conversão por tamanho do passe e passes vencidos num período (R041, R043). | Gravar o pacote no registro da aula. |
| Desmarcar presença zera o lead e deixa a marca `daily_goal_done` do dia. | `src/lib/appointmentOutcome.js:37-53` | O comparecimento conta presenças desfeitas (R028, R045). | Evento de desfazer que o relatório desconta. |
| Não existe confirmação na véspera. | `src/lib/appointmentReport.js:12-32` (quatro desfechos, nenhum de confirmação) | Confirmação contra comparecimento (R048). | `confirmedAt` e `confirmedBy` no registro. |

#### Contratos, renovação, Vencidos e Upgrade

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| A correção de contrato sobrescreve plano, valor, preço de tabela, duração e vigência. A interação traz só os valores novos, sem o id do contrato. | `src/lib/contracts.js:374-400`; `src/lib/contractsWrites.js:44-56` | A venda de um mês fechado muda sem aviso, e não dá para auditar o antes (R049, R061, R159). | Gravar os valores anteriores e o `contractId` na interação da correção. |
| Matrícula, renovação, cancelamento, trancamento e reativação gravam `status_change` sem `contractId` e sem o tipo da ação. | `src/lib/contractsWrites.js:44-56`, `:123-134` | Ligar evento a contrato exige casar lead, horário e texto (R054, R057, R148). | `contractId` e `contractAction` em toda interação de contrato. |
| O contrato não guarda quem cancelou ou trancou. A data do cancelamento é escolhida à mão, sem limite, e o instante do registro fica só no `createdAt` da interação. | `src/lib/contracts.js:238-266`; `src/modals/ContractOutcomeModal.jsx:67-108`, `:176-188` | Cancelamento retroativo muda churn e ponte de meses fechados, e cancelamento por atendente depende de texto (R054, R070, R148). | `cancelledBy`, `cancelRegisteredAt`, `pausedBy` e `pauseRegisteredAt` no contrato. |
| `pauseHistory` guarda só início e fim. O `pauseReason` é do contrato, e a pausa seguinte sobrescreve. | `src/lib/contracts.js:255-266`, `:353-360` | Trancamentos por motivo valem só para a última pausa (R072, R084). | Motivo em cada item de `pauseHistory`. |
| O contrato guarda plano e valor. A modalidade vem do plano de hoje, e professor e origem vêm do lead de hoje. | `src/lib/contracts.js:157-182`; `src/lib/aulasWrites.js:117-125`; `src/lib/gerencial/people.js:67-72` | Venda, carteira e renovação por modalidade, professor e origem reescrevem o passado quando alguém edita (R052, R065, R076, R081). | Gravar `modalityIds`, `professorId` e `source` no fechamento, em `buildMatriculaWrites`. |
| Editar o plano sobrescreve preço, duração e modalidades. | `src/views/settings/CatalogsSection.jsx:221-236` | Evolução da tabela de preço, inclusive de plano sem venda (R053, R063). | Versão do plano ou log de alteração. |
| A recusa de renovação e de Vencidos pelo board grava só no lead, com motivo "Outro", e desfazer apaga data e motivo. O `renewalOutcome` que a Meta grava desde 14/09/2026 não tem leitor. | `src/views/KanbanView.jsx:922-936`, `:987-1022`; `src/lib/renewalGoal.js:139-145`; `src/modals/RenewalOutcomeModal.jsx:155` | Motivos de não renovar, recusas por mês e recusas revertidas (R086, R091, R096). | Passar pelo mesmo caminho da Meta (`logInteraction` com `renewalOutcome`) e pedir o motivo. |
| `renewalDeclined`, `renewalDeclinedAt` e `renewalDeclineReason` são zerados em todo contrato novo. | `src/lib/contracts.js:192-198` | Quem recusou e voltou depois vira "venceu sem renovar" na coorte antiga (R086, R090). | Ler a recusa do evento, que é permanente desde 14/09/2026. |
| Arrastar no funil Vencidos grava só `reactivationStageId`, sem data nem evento, e o contrato novo zera o campo. | `src/views/KanbanView.jsx:902-920`; `src/lib/contracts.js:202` | Tempo e passagem por etapa do Vencidos (R089, R094). | Interação com etapa de origem e destino, por id e nome, como o Upgrade já faz. |
| Entrada, troca e recusa do Upgrade existem só no texto "Upgrade: ...". `upgradeEnteredAt` é zerado no fechamento e na recusa. | `src/lib/stageMove.js:120-142`; `src/lib/contracts.js:206-207` | Tempo no funil, passagem e motivos de recusa do Upgrade (R097). | Campos `upgradeEvent`, `upgradeStageId`, `fromUpgradeStageId` e motivo na interação. |
| O pedido de cancelamento, a oferta de reversão e o resultado não existem. O pedido revertido não deixa rastro nenhum. | `src/lib/contracts.js:238-251` | Pedidos de cancelamento e taxa de reversão (R083). | Campos do pedido no contrato e interação estruturada no lead. |
| O plano não diz se permite trancar, qual o teto de dias nem se permite transferência. Não achei quem grava transferência de titularidade. | `src/views/settings/CatalogsSection.jsx:222-226` | Trancamento e transferência fora da regra (R084). | Campos de regra no plano, configuráveis por academia, e evento de transferência. |
| Não existem forma de pagamento, parcela, pagamento nem inadimplência do aluno. | Chip fixo do Gerencial; `CLAUDE.md`, seção Dashboard Gerencial | Recebido, inadimplência e comissão por forma de pagamento (R056, R062). | Decisão de produto. O caixa é papel do Stronix Suite. |

#### Meta Diária e rotina do consultor

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| O histórico grava só o dia batido. Tarefas devidas, feitas e pendentes por categoria não existem, e o dia não batido não tem documento. | `src/lib/dailyGoalHistory.js:9-34`; `docs/superpowers/specs/2026-07-28-visao-gestor-profundidade-design.md:320-322` | Cumprimento por categoria, carga por pessoa e a diferença entre "não bateu" e "não tinha tarefa" (R102, R104). | Foto diária por pessoa (6.3). |
| `hitAt` é regravado a cada gravação do dia. `volumeCount` e `volumeTarget` só entram quando a Meta Diária está aberta e o alvo é maior que zero. | `src/lib/dailyGoalHistory.js:9-19`, `:36-46`; `src/App.jsx:1439`; `src/views/DailyGoalView.jsx:1152-1168` | A hora em que a meta foi batida e o alvo daquele dia (R101, R102). | `firstHitAt` gravado uma vez e o alvo do dia em todo dia de meta. |
| Atrasado existe só como retrato de agora. A conclusão de atrasado não leva a data prevista nem os dias de atraso. | `src/lib/operacional/routine.js:177-192`; `src/lib/operacional/metrics.js:152` | Evolução dos atrasados e atraso médio no fechamento (R106, R112). | `dueAt` e `overdueDays` na conclusão, e contagem de atrasados na foto diária. |
| O agendamento pela ficha põe a data só no texto. `rescheduledFor` existe só nos caminhos da Meta. | `src/views/LeadProfileView.jsx:520-586`; `src/views/DailyGoalView.jsx:1379`, `:1511`; `src/modals/ContactOutcomeModal.jsx:112` | Previsto contra feito depende de ler texto (R111, R112). | `scheduledFor`, `followUpType` e `contactOwnerId` em toda interação de agendamento. |
| Quem recebeu a tarefa de contato fica só no estado do lead e no texto "tarefa de <nome>". | `src/lib/schedulePatch.js:42-48`; `src/views/LeadProfileView.jsx:524-526` | Quem delegou, para quem, e se foi feito (R116). | `contactOwnerId` na interação do agendamento. |
| O adiamento é uma nota sem categoria e tira a tarefa do denominador do dia. | `src/views/DailyGoalView.jsx:1170-1187`; `src/lib/dailyGoal.js:346`, `:368` | Dá para bater a meta adiando, e o relatório de disciplina precisa ler texto (R103, R110). | Nota com `dailyGoalCategory` e `snoozed: true`, e decidir se adiado conta no denominador. |
| "Contato feito" não grava canal. O botão de WhatsApp da ficha não vira evento. Ligação e mensagem do composer são texto livre, sem resultado. | `src/modals/ContactOutcomeModal.jsx:88-96`; `src/views/LeadProfileView.jsx:207-212`, `:609-630` | Contatos por canal e contato efetivo (R107, R109, R132). | `channel` na conclusão e `contactResult` na nota de ligação e de mensagem. |
| Nada registra mensagem recebida do lead. A Parte B da ponte com o Stronizap está desenhada e sem plano. | `docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md`; busca por `awaitingReplySince` sem resultado | Tempo de resposta e lead esperando resposta (R108). | Parte B no mesmo `api/zap.js`, com as mensagens fora da carga de interações do mês. |
| Não existe registro da cobrança do gestor. | Nenhuma escrita em `src/` | Cobrança e resultado (R128). | Interação de tipo próprio, fora da conta de primeiro contato. |
| `actorId` e `actorAuthUid` existem desde a PR #137, mergeada em 13/07/2026. Antes disso o autor é o dono do lead. | `src/lib/interactions.js:37-40` | Produção por autor antes dessa data (R100, R109, R121). | Não volta. Marcar "autor estimado" em toda interação sem `actorAuthUid`, o que cobre tudo antes de 13/07/2026 às 20h18. |

#### Equipe

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| Remover um membro apaga o documento e a conta, sem registro. | `api/admin-users.js:239-247` | Entradas e saídas, tempo de casa e desempenho de ex-consultor (R124, R125, R133). | Registro de saída fora de `stronix_users`, gravado no mesmo `handleDelete`, porque todo documento em `stronix_users` ocupa vaga (`api/_plans.js:178-189`). |
| `stronix_users.createdAt` é gravado e nenhuma conta usa. Folga, férias e feriado não existem, e dia sem tarefa conta como não batido. | `api/admin-users.js:111`; `src/lib/operacional/routine.js:34-46`; `src/lib/dailyGoalHistory.js:29-34` | Meta e prospecção cobram o mês inteiro de quem entrou no meio ou estava de férias (R101, R102, R124). | Ausências por pessoa, feriados da academia e recorte dos dias devidos pela entrada. |
| Não achei quem grave último acesso ou login. | Busca por `lastLogin` e `lastSeen` sem resultado | Uso do sistema por pessoa (R122). | `lastSeenAt` uma vez por dia no próprio documento. As rules de hoje já permitem. |
| Alvo de prospecção, turno, nome e papel são sobrescritos, e não há tela para trocar o papel. | `src/views/settings/PaceSection.jsx:124-128`; `src/views/settings/TeamAccessSection.jsx:249-263` | Prospecção de mês fechado usa o alvo de hoje. Promoção a gestor exige conta nova e quebra a série da pessoa (R101, R121, R127). | Alvo e turno com vigência. Troca de papel pela API, com data. |
| Só existe um turno fixo por pessoa, sem escala por dia. | `src/views/settings/TeamAccessSection.jsx:255-256` | Plantão do digital e venda coberta (R057, R131). | Escala por dia numa coleção nova, gravada pelo gestor. |
| O suporte no "Acessar como" age com o uid do gestor. | `api/impersonate.js:61-65`; `src/lib/interactions.js:39-40` | Atividade do suporte, inclusive a importação de clientes, sai no nome do gestor (R127, R168). | `impersonatedBy` na interação feita em sessão assumida. |

#### Configuração, catálogos e indicação

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| Dias de meta, SLA, marcos, tolerância e período de vencidos têm um `updatedAt` só, sem histórico. | `src/views/settings/PaceSection.jsx:84-149`; `src/lib/operacional/metrics.js:77`, `:98` | Mês fechado é recalculado com a régua de hoje, e não se sabe quem mudou (R069, R086, R087, R102, R146). | Histórico com vigência, ou a régua congelada no documento do dia. |
| `referredAt` é sobrescrito a cada troca de indicador e zerado na remoção. "Não sei quem indicou" é uma flag sem data nem autor. | `src/lib/referralsWrites.js:37`, `:76`; `src/views/settings/ReferralOwnersSection.jsx:58-64` | Mês do vínculo e evolução da fila sem indicador (R134, R139, R140). | `referrerUnknownAt`, `referrerUnknownBy` e interação na troca de indicador. |
| Não achei registro de autorização do titular no cadastro, no link nem na importação. | `src/views/public/ReferralLandingScreen.jsx`; `src/modals/AddLeadModal.jsx:452-483` | Autorização e pedidos do titular (R152). | `consentAt` e `consentVia` no lead, e o pedido atendido guardado fora do lead. |
| O CSV sai sem registro, e a exclusão não deixa evento. | `src/views/LeadsView.jsx:123-155`; `src/views/LeadProfileView.jsx:215-243` | Quem exportou ou apagou o quê (R147). | Coleção só de criação, sem dado pessoal, com rules publicadas à mão. |
| Nenhum número de mês é congelado. | Nenhuma foto gravada em `src/` ou `api/` | Explicar por que o número de um mês fechado mudou (R158, R159). | Foto do mês na virada (6.3). |

#### Super-admin

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| A auditoria de `tenant.update` grava só os nomes dos campos alterados, e não existe motivo de saída. | `api/tenant-status.js:241-247`; `api/_audit.js:9-17` | MRR real, saídas por motivo e o que mudou em cada academia (R163, R168, R172). | Valor antigo e novo na auditoria e `exitReason` de lista fixa. |
| O pagamento troca trial por active sem `statusChangedAt` nem auditoria, e `paymentOverdueSince` é regravado a cada atraso. | `api/asaas.js:94-98` | Quando o trial virou cliente e há quanto tempo a academia está em atraso (R164, R165, R172). | Carimbar a data e gravar o evento na auditoria. |
| O chamado guarda só `status` e `updatedAt`. | `src/views/console/SuperConsole.jsx:1360-1368` | Tempo de resolução e de primeira resposta (R167). | `resolvidoEm` e `primeiraRespostaEm`. |
| Não existe registro do uso da chave do Zap nem da leitura por academia. | `api/zap.js:133-156`; `api/super-overview.js:7-12` | Se o Stronizap consulta de fato, e quanto cada academia custa (R161, R170, R171). | `lastUsedAt` na integração. A leitura por academia fica fora do escopo (R170). |

#### Gravado e nenhuma tela lê

| Campo | Onde é gravado | Relatório que aproveita |
|---|---|---|
| `stronix_leads.statusEnteredAt` | `src/lib/stageMove.js:62-66`; `src/modals/AddLeadModal.jsx:477`; `src/lib/appointmentOutcome.js:92` | R011, leads parados na etapa. Vale para quem trocou de etapa desde 14/09/2026. |
| `stronix_sources.channel` | `src/views/settings/CatalogsSection.jsx:55` | R001 e R004. O CRM agrupa por `source`, não pelo canal (`src/lib/crm/cohort.js:105`). |
| `renewalOutcome` e `renewalDeclineReason` na interação | `src/modals/RenewalOutcomeModal.jsx:150-162` | R086, R091 e R096. É o único registro de recusa que não some. |
| `stronix_users.createdAt` | `api/admin-users.js:111`; `api/invite-accept.js:119` | R123 e R124. |
| `shiftStart` e `shiftEnd` | `src/views/settings/TeamAccessSection.jsx:255-256` | R121. |
| Convites (`status`, `acceptedAt`, `acceptedUid`) | `api/invite-accept.js:122-125` | R125, R126 e R165. |
| `discountMode`, `discountValue` e `discountReason` (a ficha lê, os painéis não) | `src/modals/ContractModal.jsx:197-201` | R051. |

O contrário também existe. `satisfactionAt`, `hasAttended` e `attendedAt` (`src/lib/leads.js:72-74`, `:211-226`), `pinned` (`src/lib/timeline.js:120`), `metadata.category` (`src/lib/leads.js:122`) e o `active` do usuário (`src/views/LeadProfileView.jsx:496`) são lidos, e não achei quem grava. `config.dailyVolumeTarget` é lido em `src/App.jsx:823` e ignorado pela conta (`src/lib/dailyGoal.js:251-255`). Nenhum relatório pode contar com esses campos.

### 6.2 Dado distorcido

Aqui o dado existe, mas conta errado se o relatório não souber de onde ele veio. As origens são a importação, os backfills e defeitos que já passaram, os valores de plano e contrato, o catálogo renomeado ou apagado e algumas regras de hoje que gravam torto. A correção quase sempre é marcar o dado ou tratar na leitura. Reescrever o passado exige script com credencial, que só o Johnny roda.

#### Importação

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| Contrato importado sem valor na planilha recebe o preço do plano casado. Sem plano casado, fica com zero e sem `planId`. Os 494 contratos importados da STRONIX estão no segundo caso, e 114 deles vencem em 90 dias (auditoria de 16/09/2026). | `src/lib/clientImport.js:501-507`; `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:72` | Carteira, permanência e valor por cliente em R$ da STRONIX (R067, R075, R079, R088). O importado com preço de tabela parece pagar a tabela (R063). | Planilha de valores, a entrega 1 do Gerencial, ainda não feita. Marcar de onde veio o valor (planilha, tabela ou ausente). |
| A importação traz só o contrato mais recente de cada pessoa, e só ativos, trancados e vencidos dentro da janela. | `src/lib/clientImport.js:245-252`, `:314-333` | Os meses anteriores à importação mostram só quem sobreviveu até ela. Churn, ponte e coorte de julho e agosto saem baixos (R067, R068, R069, R073, R080, R086). | Marcar como parcial todo mês anterior à importação de cada academia, pelo `importedAt` dos contratos. |
| As datas de negócio vêm da planilha ou da hora da importação. `createdAt` é o cadastro no sistema antigo, `clienteSince` é o mais cedo entre cadastro e inícios, o cancelado recebe `cancelledAt` igual ao fim e o trancado recebe a pausa na hora da importação. Sem data nenhuma, vira venda do dia. | `src/lib/clientImport.js:514`, `:518`, `:590-593`, `:624-626`, `:647` | Safra, tempo de casa e aniversário de casa ficam com a data do sistema antigo, que pode ser de quando a pessoa era só contato (R071, R073, R074, R155). | Marcar a origem do `clienteSince` e do `convertedAt`. |
| O lead que já existia e casou com a planilha ganha `clienteSince` da planilha e os carimbos do lote, e mantém a origem dele. | `src/lib/clientImport.js:639-648`; `src/lib/operacional/routine.js:98-99` | Pode contar como matrícula na safra e como indicado matriculado (R006, R136). A regra `isImportedEnrollment` do CRM pega parte, mas a data da planilha posterior ao cadastro no CRM continua contando (`src/lib/crm/cohort.js:28-53`). | Todo relatório novo usa `isImportedEnrollment`. A marca de origem do `clienteSince` fecha o furo. |
| Os carimbos do lote no lead são sobrescritos na reimportação, e não existe documento do lote. | `src/lib/clientImport.js:595`, `:648` | O que cada lote tocou só sai das interações `import` e dos contratos (R144). | Documento por lote com data, fonte, autor e contagens. |
| Sexo fora dos três valores passa como veio, a etiqueta "VIP" entra sem catálogo e a origem vira "Importação ...". | `src/lib/clientImport.js:98-105`, `:386`, `:565`, `:612-613` | Perfil por sexo e relatório por etiqueta com itens soltos (R141, R145). | Normalizar na importação ou na leitura. |

#### Backfill e defeitos que já passaram

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| O alvo `converted` do backfill grava `convertedAt` igual ao `createdAt` em cliente sem data. A memória do projeto registra 19 clientes na STRONIX em 14/07/2026. O código não permite confirmar. | `scripts/backfill-scale-fields.js:218-229` | Essas matrículas caem no mês do cadastro, com zero dias até a matrícula (R006, R007, R009). | Marcar o dado inferido, ou começar as séries de matrícula em julho de 2026. |
| Nenhum backfill preencheu `lostAt` nem o autor das interações. | `scripts/backfill-scale-fields.js` (sem alvo de perda nem de `actorId`) | Perda antiga sem data some de toda conta por período (R021, R024, R142). | Mostrar "perda sem data" à parte. |
| O backfill de aulas criou uma aula por lead, com o estado daquele dia e `createdAt` do dia do script. As visitas anteriores a 18/08/2026 são só as que estavam no espelho. Nenhum registro tem marca de backfill. | `scripts/backfill-aulas.js:106-125`, `:157`; `scripts/backfill-appointments.js:137-160`, `:238` | Antecedência e velocidade até o agendamento (R035, R039). Agenda e comparecimento antes de setembro são parciais (R027, R028, R046). | `source: 'backfill'` nos registros. O CRM já contorna usando o menor entre `createdAt` e `scheduledFor`. |
| Entre 30/06 e 08/09/2026, mudar a fase de um cliente zerava `convertedAt` e desfazia a venda. Não achei registro de que o reparo rodou com `--apply`, e o script pode dar ao cliente a data da renovação. | `scripts/fix-clients-unsold-by-stage-move.js:1-31`, `:95-104` | Clientes desses meses podem estar sem data de conversão (R006, R066, R133). | Rodar o script em modo de conferência nas academias, revisar a regra da data e só então aplicar. |
| Até 14/09/2026 (merge da PR #206) o dia batido só era gravado com a Meta Diária aberta. | `src/lib/dailyGoalHistory.js:1-3`; commit `75400c9` | Constância e % de meta de junho a setembro saem abaixo do real (R102, R124, R127, R133). | Marcar como parcial antes de 14/09/2026. |
| Entre 16/07 e 17/09/2026 (merge da PR #213), um valor digitado como "2.988" virava 2,988 no plano, no desconto e no contrato. A auditoria de 16/09 não achou contrato abaixo de R$ 10, e essa linha da spec fala só de contrato. | `src/lib/renewal.js:96`; `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:73` | Preço de tabela e desconto digitados no período (R049, R051, R053, R150). | Conferir planos e descontos do período, que é o próprio R150. |

#### Valores e planos

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| A Shape One grava preço mensal no campo de total dos planos de vários meses, e o rótulo continua "Valor (R$)". | `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:71`; `src/views/settings/CatalogsSection.jsx:438` | Ticket, valor por mês e carteira da Shape One, inclusive nos contratos já fechados com o valor do plano (R049, R052, R053, R063, R092). | Rótulo que diga "total do contrato", correção dos planos e dos contratos já gravados. |
| A correção de contrato regrava `listValue` com o preço do plano no dia da correção e não mexe no desconto. | `src/lib/contracts.js:383-390` | Preço contra tabela e desconto de contrato corrigido (R051, R053). | Preservar o `listValue` da venda e recalcular ou limpar o desconto. |
| Plano sem preço grava `listValue` zero. | `src/lib/contracts.js:155` | Desconto e preço contra tabela desses contratos (R051, R053). | Tirar da média na leitura. |
| A renovação com início antes do fim não encerra o contrato antigo, apesar do aviso do modal. Em 16/09 havia 4 e 6 pessoas com contratos sobrepostos nas duas academias. | `src/lib/renewal.js:67-72`; `src/lib/contractsWrites.js:94-96`; `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:74` | Carteira em dobro no período sobreposto (R077, R079). | Decidir a regra. Se for encerrar, gravar o fim efetivo no contrato anterior. |

#### Catálogo renomeado ou apagado

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| Renomear origem, dor, etiqueta ou motivo de perda reescreve só os leads. Interações e aulas ficam com o nome velho. | `src/views/settings/CatalogsSection.jsx:57-60`, `:82` | Série por origem e por motivo quebra em duas linhas quando o relatório lê evento (R001, R021, R022, R141). | Gravar o id junto do nome. |
| Renomear etapa reescreve o `status` dos leads, não o `fromStatus` e o `toStatus` das interações, e não recalcula o balde. Nada impede criar etapa com nome de matrícula, que vira cliente na leitura com o documento ainda "ativo". | `src/views/settings/FunnelsSection.jsx:181-199`; `src/lib/leads.js:42-46` | Passagem entre etapas parte em duas (R010, R012, R018), e conversão e carteira divergem (R013). | `statusId` e bloqueio dos nomes reservados. |
| Renomear modalidade ou unidade reescreve só `appointmentModality` e `appointmentUnit` dos leads carregados na tela. Não chega a `lead.modalidade` nem a `stronix_aulas`. Renomear professor não chega ao `professorName` dos registros. | `src/views/settings/SchedulingSection.jsx:133-142`, `:195-204`; `src/views/settings/TeamAccessSection.jsx:397-407` | Aulas por modalidade, visitas por unidade e conversão por professor (R029, R032, R033, R060). | Gravar e agrupar por id. |
| Renomear um membro deixa o nome antigo em contratos, aulas e interações. | `src/views/settings/TeamAccessSection.jsx:268-279` | Relatório que agrupe por nome duplica a pessoa (R050, R124). | Agrupar por id. |
| Excluir uma etapa do funil Vencidos com cliente nela: a checagem conta só lead com funil e `status` iguais, e o vencido está em "Venda". O card aponta para uma etapa que não existe e some do board. | `src/views/settings/FunnelsSection.jsx:213`; `src/lib/expiredFunnel.js:122-150` | Contagem por etapa do Vencidos (R089, R094). | Cair na entrada, como o Upgrade faz (`src/lib/upgradeFunnel.js:91-95`), e contar `reactivationStageId` antes de excluir. |
| Origem fora do catálogo. O cadastro completo usa uma lista fixa de oito ("Outro", enquanto a semente cria "Outros"), a importação grava "Importação ...", e o link e o modo indicação fixam "Indicação" mesmo quando a academia renomeou. | `src/modals/ClientRegistrationModal.jsx:22`, `:204`; `api/provision-tenant.js:24`; `src/lib/clientImport.js:565`; `api/tenant-resolve.js:267`; `src/modals/AddLeadModal.jsx:392-393` | Canal dividido por grafia e faixa "Sem canal" (R001, R135, R142). | Cadastro completo com o catálogo da academia. Indicação pelo id da origem. |
| O cadastro completo aceita etiqueta com qualquer texto. | `src/modals/ClientRegistrationModal.jsx:229`; `src/components/ui/TagsInput.jsx:23` | Relatório por etiqueta com itens que o gestor não reconhece (R145). | Restringir ao catálogo ou criar o item junto. |

#### Regras que gravam torto hoje

| Lacuna | Evidência | O que impede de responder | Correção |
|---|---|---|---|
| Origem e motivo de perda já abrem com o primeiro item marcado. Com o catálogo vazio, grava "Sem motivo configurado". | `src/modals/AddLeadModal.jsx:359`; `src/modals/LossReasonModal.jsx:8-9` | A primeira origem e o primeiro motivo ficam inflados (R001, R004, R021). | Começar sem seleção e exigir escolha. |
| O assistente de agendamento sugere 18h para hoje e 9h para os outros dias, e aceita data passada. | `src/components/profile/ScheduleWizard.jsx:94`, `:292-293` | Mapa por horário puxado para 9h e 18h, e agendamento retroativo infla o mês (R034, R035). | Marcar se a hora foi editada, ou exigir hora, e limitar a data. |
| As datas de cancelamento, trancamento e reativação são escolhidas à mão, sem limite para trás nem para a frente. | `src/modals/ContractOutcomeModal.jsx:67-108`, `:176-188` | Churn, ponte e cancelamentos de mês fechado mudam, e "dias até cancelar" pode dar negativo (R054, R068, R069, R070, R080). | Gravar também o instante do registro (6.1) e limitar a data. |
| A marca da aula que converteu roda em toda matrícula que não é renovação, inclusive retorno de ex-cliente e Upgrade sem contrato vivo. Ela pega a última aula atendida, sem janela, e regrava o professor do cliente. | `src/lib/contractsWrites.js:157-161`; `src/lib/aulasWrites.js:110-126`; `src/lib/aulas.js:29-41` | Conversão por professor e dias entre aula e matrícula ganham crédito de aula antiga ou de upgrade (R029, R030, R040, R044, R076). | Marcar só na primeira matrícula e só aula anterior a ela. |
| `closedFromUpgrade` marca qualquer contrato novo de quem está parado no funil Upgrade, inclusive renovação do mesmo plano. | `src/lib/contracts.js:174` | Fechados pelo Upgrade (R049, R097). | Marcar só o fechamento feito pelo funil. |
| A mesma volta de cliente vencido é renovação pela Meta e matrícula pelo board e pela ficha. | `src/views/DailyGoalView.jsx:1543-1549`, `:1870-1878`; `src/views/KanbanView.jsx:1578-1582`; `src/views/LeadProfileView.jsx:1678` | O mix do Gerencial muda conforme a tela, e o `convertedAt` é regravado só num dos caminhos (R049, R086, R090). | Uma regra só, depois da decisão do Johnny. |
| Etapa com nome de matrícula carimba `convertedAt` sem contrato e sem `clienteSince`. | `src/lib/stageMove.js:94-96` | Três números de matrícula: o CRM conta por lead, Operacional e Gerencial por contrato (R008, R066, R136, R157). | O relatório diz qual conta. |
| `clienteSince` é carimbado no primeiro contrato gravado pelo app, inclusive renovação, e `convertedAt` é regravado em toda matrícula de retorno. | `src/lib/contracts.js:219-221` | O cliente legado ganha "primeira matrícula" na data da renovação, e o tempo de casa recomeça (R073, R074, R155). | Não carimbar `clienteSince` em renovação, ou usar o menor entre `convertedAt` e o início do primeiro contrato. |
| Cancelar ou trancar grava a situação no resumo do lead mesmo quando a pessoa tem outro contrato vigente. | `src/lib/contractsWrites.js:19-42` | A situação pelo resumo do lead diz "cancelado" de quem segue ativo (R066, R153). | Situação sempre pelos contratos. |
| O desfecho da Agenda do dia grava o lead e as interações em escritas separadas, sem subir `lastInteractionAt` nem `interactionsCount`. | `src/lib/appointmentOutcome.js:85-134` | O lead parece mais frio do que está, e a promoção a Negociação pode ficar sem evento se a segunda escrita falhar (R016, R017, R113). | Um lote só, por `logInteraction`. |
| `appointmentOutcomeBy` guarda às vezes o `authUid`, às vezes o `id`. | `src/lib/appointmentOutcome.js:88`; `src/views/DailyGoalView.jsx:1216` | Quem marcou presença precisa resolver os dois (R045). | Sempre o id do usuário. |
| O mesmo número em outro formato (com 55, com ou sem o nono dígito) passa como pessoa nova no cadastro, no link e na importação. | `src/hooks/useDuplicateLead.js:19` | O retorno de ex-cliente vira matrícula nova, e a volta espontânea não aparece (R005, R049, R149). | Conferir também pelo `zapMatchKey` (`api/_zapPhone.js`). |
| `stronix_aulas.consultantId` é o dono do lead quando o registro nasceu, ou no dia do backfill, e não muda. | `src/lib/aulasWrites.js:33-42` | Dono e autor se confundem (R027, R028, R030, R040). | `bookedById` (6.3), e o relatório diz qual atribuição usa. |
| Cadastro legado de usuário com id do documento diferente do `authUid`. | `firestore.rules:50-58`; `src/hooks/useNotificationsSeen.js:6-9` | Leads e contratos se juntam por `users.id`, interações por `users.authUid`, e um gestor legado pode ser tratado como consultor pelas rules (R099, R100). | Migrar para id igual ao uid. |
| Lead sem `createdAt` recebe "agora" na leitura. | `src/lib/leads.js:21` | Ele cai no mês corrente (R001, R024). | Tirar `createdAtMissing` de toda conta, como o CRM faz. |
| As rules não validam formato: telefone com e sem máscara, sexo livre, `createdAt` sem conferência. | `firestore.rules:79-95` | Agrupamentos partidos por grafia (R141, R149). | Normalizar na leitura do relatório. |

### 6.3 Dados a começar a gravar já

A ordem segue quantos relatórios cada dado destrava. No empate, vem primeiro o de menor esforço. Cada dia sem gravar é um dia a menos de histórico, então a ordem também é a de urgência.

Três avisos valem para a tabela inteira. Coleção nova precisa de match em `firestore.rules`, publicado à mão no console antes do deploy, senão toda leitura e escrita é negada. `src/lib/dailyGoal.js` importa `lucide-react` e não roda em `api/`. A Vercel tem 11 das 12 funções em uso e o `vercel.json` não tem cron, então rotina de servidor entra como ação numa função existente.

As linhas de esforço baixo que não pedem coleção nova (autor na agenda, troca de responsável, perda como evento, contrato com rastro, ids junto do nome, marca de dado inferido, eventos nos funis de cliente, agendamento de contato e quem cadastrou) são campos a mais em escritas que já existem. Não pedem coleção nem regra nova, então podem sair antes das outras.

| Dado | Onde gravar | Relatórios que destrava | Esforço |
|---|---|---|---|
| Autor em toda escrita de agenda: o desfecho da Agenda do dia passa por `logInteraction` (com `actorId`, `actorAuthUid`, `leadName` e `lastInteractionAt`), e o registro ganha `bookedById` e `outcomeById`. | `stronix_interactions` e `stronix_aulas`, em `src/lib/appointmentOutcome.js` e `src/lib/aulasWrites.js` | 14: R016, R030, R045, R057, R100, R103, R112, R113, R120, R121, R122, R127, R130, R131 | Baixo. Troca de dois `addDoc` por `logInteraction` e dois campos no registro. |
| Desfecho, remarcação e fechamento do registro de visita: `status` e `outcomeAt` no desfecho, `upsertScheduledAppointment` com tipo visita na remarcação da Meta, e `cancelled` com motivo no adiar, na perda e na troca de tipo. | `stronix_aulas`, a partir de `src/lib/appointmentOutcome.js`, `src/views/DailyGoalView.jsx` (`handleReschedule` e `handleSnooze`), `src/views/LeadProfileView.jsx` e `src/views/KanbanView.jsx` | 14: R006, R015, R025, R027, R028, R033, R034, R037, R038, R039, R042, R048, R142, R157 | Médio. Quatro caminhos de escrita, sem coleção nem regra nova. As visitas passadas podem ser acertadas pelas interações `daily_goal_done` de `visita_hoje`, marcando o que foi inferido. |
| Troca de responsável estruturada: interação por lead com `fromConsultantId`, `toConsultantId` e motivo, também na migração em massa, que passa a carimbar `consultantChangedAt` e para de reescrever `leadConsultantId` das interações antigas. | `stronix_interactions` e `stronix_leads`, em `src/modals/ClientRegistrationModal.jsx`, `src/lib/clientRegistration.js` e `src/views/settings/TransferLeadsTab.jsx` | 13: R006, R021, R022, R069, R099, R100, R101, R117, R119, R120, R133, R138, R157 | Baixo na troca individual. Médio na migração, que hoje lê todas as interações da academia (`src/views/settings/TransferLeadsTab.jsx:154`). |
| Perda como evento: `lossReason` como campo na interação `status_change` para Perda. | `stronix_interactions`, em `src/views/KanbanView.jsx:1179-1195` e `src/views/LeadProfileView.jsx:302-315` | 11: R006, R007, R021, R022, R023, R024, R025, R026, R099, R141, R157 | Baixo. Um campo em dois caminhos. A etapa da perda já vai em `fromStatus` desde 14/09/2026 18h10. |
| Foto diária por pessoa: tarefas devidas, feitas e pendentes por categoria, atrasados, críticos, adiados e alvo do dia, mais a contagem de leads por etapa e por dono. | Coleção nova, gravada pelo navegador como o dia batido (`src/App.jsx:1426-1440`). A seção 7.6 (arquitetura C) propõe um documento por mês com um campo por dia (`stronix_fotos/{AAAA-MM}`). A parte de cada pessoa cabe nesse documento ou num documento por pessoa e dia, no molde de `stronix_daily_goal_history` (`src/lib/dailyGoalHistory.js`) | 11: R012, R099, R101, R102, R104, R106, R119, R124, R127, R133, R157 | Alto. Coleção e regra novas. Gravada pelo navegador, a foto é do último momento em que a pessoa estava com o app aberto, e não do fim do dia. No servidor, pede tirar o cálculo das tarefas de `src/lib/dailyGoal.js`. |
| Contrato com rastro: valores anteriores na correção, `contractId` e `contractAction` em toda interação de contrato, `cancelledBy`, `cancelRegisteredAt`, `pausedBy`, `pauseRegisteredAt` e o motivo em cada item de `pauseHistory`. | `stronix_contratos` e `stronix_interactions`, em `src/lib/contracts.js` (`buildContractEdit`, `buildContractPause` e a reativação) e `src/lib/contractsWrites.js` | 10: R049, R054, R056, R057, R061, R070, R072, R084, R148, R159 | Baixo. Campos a mais em escritas que já existem. |
| Ids junto do nome: `statusId` no lead, `fromStatusId` e `toStatusId` na troca, `modalityId`, `unitId` e `professorId` no registro da agenda, e `planId` no resumo do lead. | `src/lib/stageMove.js` (`stageChangeFields`), `src/lib/aulas.js` (`aulaRecordFields`) e `src/lib/contracts.js` (`leadPatch`) | 9: R010, R012, R013, R029, R032, R033, R034, R060, R066 | Baixo. O passado continua pelo nome. |
| Marca de dado inferido: origem do `clienteSince` e do `convertedAt` (planilha, contrato, etapa, backfill), origem do valor importado (planilha, tabela do plano, ausente) e `source: 'backfill'` nos registros de agenda. | `src/lib/clientImport.js`, `src/lib/contracts.js` e os scripts de backfill, com acerto dos documentos já gravados | 9: R006, R035, R039, R063, R071, R073, R074, R144, R155 | Baixo no código. O acerto do passado é script com credencial, rodado pelo Johnny. |
| Configuração com vigência: dias de meta, SLA, marcos, tolerância de renovação, período de vencidos, alvo de prospecção por pessoa e turno, cada mudança com valor antigo, novo, autor e data. | Coleção nova de histórico, gravada junto em `src/views/settings/PaceSection.jsx` e `src/views/settings/TeamAccessSection.jsx` | 9: R065, R069, R086, R087, R089, R101, R102, R121, R146 | Médio. Coleção e regra novas, e as contas passam a ler a régua vigente em cada dia. |
| Contrato congelado no fechamento: `modalityIds`, `professorId` e `source`, com o canal. | `stronix_contratos`, em `buildMatriculaWrites` (`src/lib/contracts.js:157-182`) | 9: R004, R052, R055, R065, R067, R069, R076, R079, R081 | Médio. Pede a decisão da carteira de professor por modalidade (spec do commit `af08b67`, em revisão). |
| Eventos nos funis de cliente: recusa pelo board com `renewalOutcome` e motivo, movimento no Vencidos com etapa de origem e destino, e entrada, troca e recusa do Upgrade com campos. | `stronix_interactions`, em `src/views/KanbanView.jsx` (`moveExpiredToStage`, `declineExpired`, recusa de renovação e Upgrade) e `src/lib/stageMove.js` | 8: R086, R089, R090, R091, R094, R096, R097, R110 | Baixo. O Upgrade já grava `logInteraction`, falta o campo. |
| Histórico no registro de agenda: `bookedAt` a cada marcação, `rescheduleCount`, `originalScheduledFor`, pacote do passe (`trialClassesPlanned`), motivo de falta e de cancelamento, `confirmedAt` e `confirmedBy`. | `stronix_aulas`, em `src/lib/aulasWrites.js` e `src/lib/aulas.js` | 7: R035, R036, R037, R038, R041, R043, R048 | Baixo nos campos. Médio na confirmação, que pede botão novo. |
| Equipe com entrada, saída, ausência e acesso: registro de saída fora de `stronix_users`, `lastSeenAt` diário, ausências por pessoa, feriados da academia e troca de papel com data. | `api/admin-users.js` (`handleDelete`), o documento do próprio usuário, `stronix_config/general` e subcoleção de ausências | 7: R101, R102, R122, R124, R125, R127, R133 | Médio. Regra de leitura nova para o registro de saída. `lastSeenAt` cabe nas rules de hoje. |
| Agendamento de contato estruturado: `scheduledFor`, `followUpType` e `contactOwnerId` em toda interação de agendamento, `dueAt` e `overdueDays` na conclusão de atrasado, e adiamento com categoria. | `src/views/LeadProfileView.jsx`, `src/views/DailyGoalView.jsx`, `src/modals/ContactOutcomeModal.jsx` e `src/modals/RenewalOutcomeModal.jsx` | 6: R103, R106, R110, R111, R112, R116 | Baixo. |
| Quem cadastrou o lead: `createdById`, `createdByAuthUid` e `createdByName`, imutáveis. | `stronix_leads`, em `src/modals/AddLeadModal.jsx`, `api/tenant-resolve.js` e `src/lib/clientImport.js` | 6: R001, R099, R101, R131, R133, R157 | Baixo. Lead antigo pode herdar o dono atual quando não houve troca registrada. |
| Canal e resultado do contato: `channel` na conclusão da tarefa de contato, `contactResult` nas notas de ligação e de mensagem, e um evento leve no clique de WhatsApp e Ligar da ficha. | `stronix_interactions`, em `src/modals/ContactOutcomeModal.jsx` e `src/views/LeadProfileView.jsx` | 5: R082, R107, R109, R110, R132 | Baixo. O evento do clique soma leitura na carga do mês, que já traz todas as interações. |
| Parte B da ponte com o Stronizap: mensagem enviada e recebida, e `awaitingReplySince` no lead. | `api/zap.js`, com as mensagens numa coleção à parte | 5: R020, R082, R107, R108, R113 | Alto. A spec não tem plano. Se as mensagens entrarem em `stronix_interactions`, o Operacional e o CRM passam a ler todas elas a cada mês. |
| Indicação com histórico: primeira data do vínculo, interação na troca de indicador, `referrerUnknownAt`, `referrerUnknownBy`, e `referralVia` também no cadastro manual e no vínculo pela ficha. | `src/lib/referralsWrites.js`, `src/views/settings/ReferralOwnersSection.jsx` e `src/modals/AddLeadModal.jsx` | 4: R134, R137, R139, R140 | Baixo. |
| Super-admin: valor antigo e novo na auditoria, motivo de saída de lista fixa, data da troca de trial para active no webhook e foto mensal de status, plano e preço. | `api/tenant-status.js`, `api/_audit.js`, `api/asaas.js` e uma ação no `api/super-overview.js` na primeira abertura do mês | 4: R163, R165, R168, R172 | Médio. Sem função nova e sem cron. |
| Unidade por id no lead, no contrato e no usuário. | `stronix_leads`, `stronix_contratos` e `stronix_users` | 3: R033, R034, R060 | Médio. Depende de o Johnny querer multiunidade. |
| `impersonatedBy` na interação feita em sessão assumida. | `src/lib/interactions.js` | 2: R127, R168 | Baixo. |
| Último uso da chave do Zap. | `tenants/{id}.integrations.zap`, em `api/zap.js` | 2: R161, R171 | Baixo, com no máximo uma gravação por dia. |
| Meta mensal de venda por pessoa, com histórico por mês. | `stronix_users` ou `stronix_config` | 2: R058, R099 | Baixo no dado. Antes, decidir se vale a meta do Comissão STRONIX. |
| Investimento por origem e mês, e campanha no lead. | Coleção nova com leitura só do gestor, e campo no lead | 2: R004, R065 | Médio. |
| Escala de plantão por dia. | Coleção nova gravada pelo gestor | 2: R057, R131 | Médio. |
| Trilha de exclusões e exportações, e autorização do titular. | Coleção só de criação e sem dado pessoal, e campos de autorização no lead | 2: R147, R152 | Médio. Regra só de criação, publicada à mão. |
| Foto do mês fechado, com os ids por trás de cada número. | Coleção nova por academia e mês, gravada na primeira abertura depois da virada | 2: R158, R159 | Alto. Regra nova, limite de 1 MiB por documento, e só com dado lido do servidor. |
| Tentativa de cadastro repetido. | `stronix_interactions`, no aviso de duplicata do `src/modals/AddLeadModal.jsx` | 1: R005 | Baixo. |
| Cobrança do gestor. | `stronix_interactions`, com tipo próprio | 1: R128 | Baixo. |
| Resolução e primeira resposta do chamado. | `tickets` | 1: R167 | Baixo. |
| Mês e dia de nascimento indexável (`birthMonthDay`). | `stronix_leads`, nos três caminhos que gravam `birthDate` | 1: R154 | Baixo, com acerto da base. |
| Plano de interesse ou valor esperado no lead. | `stronix_leads` | 1: R019 | Baixo no dado, alto na adoção pela equipe. |
| Pedido de cancelamento e reversão. | `stronix_contratos` e interação no lead | 1: R083 | Médio. Fluxo novo na ficha. |
| Regras da linha do plano e transferência de titularidade. | `stronix_planos` e contrato de origem | 1: R084 | Médio. |
| Nota de satisfação. | Documento por resposta, em coleção nova | 1: R078 | Médio. |

### 6.4 O que a conferência no código corrigiu

O catálogo tem 172 relatórios. Na conferência, 168 foram ajustados, 2 foram confirmados sem mudança (R094 e R170) e 2 saíram inviáveis (R047 e R062). A viabilidade final ficou assim: 11 prontos, 123 com ajuste, 35 precisam gravar dado novo e 3 fora do escopo. Fonte: as tabelas de cada domínio da seção 5.

#### Ajustes por tema

| Tema | O que a conferência mudou | Relatórios |
|---|---|---|
| Data de início | A data certa é a do merge, não a do commit. Vínculo de indicação em 10/08, não 07/08. Motivo estruturado de não renovar, histórico de pausas e dia batido de qualquer tela em 14/09, não 11 e 12/09. Categoria Renovação da Meta em 30/06, não 23/06. Dor obrigatória em 30/06, não 25/06. Troca de etapa em 14/09 às 18h10. O DDD vale desde o primeiro lead, `cpfDigits` desde 13/07 e contrato agendado desde 30/06. | R003, R013, R018, R021, R032, R046, R055, R059, R076, R091, R096, R103, R134, R135, R136, R138, R141, R143, R149 |
| Estado lido como se fosse evento | Perda, recusa, dono, origem, `referredAt`, `upgradeEnteredAt`, `upgradeDeclinedAt`, pacote do passe, `interactionsCount` e `lastInteractionAt` guardam o valor de agora. O relatório de período tem de ler o evento ou avisar. | R006, R007, R016, R021, R022, R023, R024, R026, R041, R086, R091, R097, R113, R134, R140, R153 |
| Atribuição de pessoa | Há quatro "donos" diferentes: o de hoje (`consultantId`), o da venda (`contract.consultantId`), o autor (`actorId`) e o do nascimento do registro (`stronix_aulas.consultantId`). Cada coluna diz qual usa. | R027, R028, R030, R033, R040, R050, R057, R063, R082, R091, R097, R099, R100, R117, R120, R124, R127, R133, R138, R148, R156, R157 |
| Visita e remarcação | O desfecho da visita é deduzido, a remarcação pela Meta não cria registro, o registro reaproveitado apaga a falta anterior e o registro abandonado fica "agendada". | R006, R015, R025, R027, R028, R033, R034, R035, R037, R038, R039, R042, R048, R142, R148, R157 |
| Importação e valores | Importado sai da venda e da safra, os 494 sem valor entram na contagem e nunca no dinheiro, a Shape One tem preço mensal no total, e os meses antes da importação têm viés de sobrevivente. | R001, R004, R049, R051, R053, R063, R064, R067, R068, R069, R071, R073, R075, R079, R080, R081, R086, R092, R144, R150 |
| Regra de negócio contrariada | Matrícula é a primeira conversão, retorno e upgrade não são matrícula nova, contrato paralelo é permitido, trancado continua cliente, renovação ganha de upgrade no mix e vencido é cliente inativo. | R008, R029, R031, R044, R049, R066, R077, R085, R088, R089, R090, R097, R098, R136, R142, R157 |
| Permissão | Não existe papel "dono": os papéis são admin e consultant, e o dono é só o `primaryAdminUid`. As rules deixam qualquer membro ler leads, interações, contratos e aulas, então toda restrição de relatório é trava de tela. | R005, R007, R014, R018, R019, R027, R033, R055, R058, R061, R067, R075, R077, R078, R083, R086, R099, R108, R110, R128, R134, R135, R140, R141, R146, R147, R153, R155, R156, R158, R169 |
| Custo e índice | O custo estava subestimado onde o relatório lê leads por id em lotes de 30, a base inteira ou todas as interações do período. Alguns pediam índice composto sem precisar, porque a consulta de campo único já existe. Outros precisam de índice que não está publicado: clientes por `lastInteractionAt` e `actorAuthUid` com data. | R006, R010, R022, R026, R046, R055, R063, R074, R086, R089, R097, R098, R108, R113, R117, R137, R141, R150, R151, R161, R169 |
| Período | Os três `metricsOf` recebem só `monthKey`, e o parâmetro de mês vai 12 meses para trás. Semana, trimestre e ano pedem entrada nova. | R049, R099, R133, R156, R158 |
| O que já existe | O CRM tem seção Origem e não Canais, o card de Matrículas já separa safra e anteriores, a tela de professores é Equipe & acessos, Clientes já lista "A vencer", a Ponte já tem "Voltaram", o atraso do Operacional e o filtro da lista de Leads usam cortes diferentes (início de hoje e agora), Catálogos já conta o uso de cada item e o Comparar já vai 12 meses para trás. | R001, R008, R029, R050, R088, R090, R105, R123, R139, R145, R158 |
| Referência ao rascunho | O campo de sobreposição citava números do rascunho do catálogo, que não correspondem a nenhuma tela. Na revisão final, os que a descrição permitia identificar viraram o id R### equivalente, e os demais saíram. | R005, R020, R026, R048, R063, R064, R065, R095, R096, R098, R131, R140, R155, R157, R158, R159, R171, R172 |

#### Viabilidade que mudou de nível

| Relatório | Mudança |
|---|---|
| R008 | Subiu para pronto. O CRM já mostra matrículas do período e da safra lado a lado. |
| R045 | Deixou de depender só de dado novo. A Meta já grava o autor, e a Agenda do dia grava o nome em `consultantName`. |
| R026, R029, R085, R113, R139, R143 | Saíram de pronto. Faltam filtro, definição ou dado que o texto dava como existentes. |
| R061 | Continua precisando de dado novo, mas a correção já grava autor, data e valor novo desde 28/07/2026. Falta o valor anterior. |
| R047, R062 | Confirmados fora do escopo, detalhados abaixo. |

#### Contradições entre leitores, resolvidas no código

| Ponto | O que o código mostra |
|---|---|
| Lead manual casado pela importação passa a contar como criado pela importação? | Não. `isImportCreatedLead` exige origem começando com "Importação" (`src/lib/operacional/routine.js:98-99`), e o lead casado mantém a origem dele (`src/lib/clientImport.js:635-648`). Ele continua na prospecção. A leitura de R144 estava errada. |
| Contrato importado sem valor tem zero ou o preço de tabela? | Os dois. Sem valor na planilha, grava o preço do plano casado. Sem plano casado, zero e sem `planId` (`src/lib/clientImport.js:501-507`). Os 494 da STRONIX são do segundo caso. |
| Histórico de pausas desde 11/09 ou 14/09? | O commit `43fd457` é de 11/09. Em produção desde o merge da PR #206, em 14/09/2026 às 09h48. |
| Motivo estruturado de não renovar e dia batido de qualquer tela, desde 12/09? | Os commits `0f3237d` e `75400c9` são de 12/09. Em produção desde o merge da PR #206, em 14/09/2026. |
| Troca de etapa desde quando? | A PR #208 foi mergeada em 14/09/2026 às 18h08. `STAGE_TRACKING_SINCE` usa 18h10 (`src/lib/crm/scope.js:17`). |
| O bug do ponto de milhar deixou valor estragado? | A auditoria de 16/09 não achou contrato abaixo de R$ 10 (`docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:73`). A linha trata só de contrato. Plano e desconto digitados no período ficam para o R150. |

#### Defeitos que a conferência achou no caminho

Não são relatórios, mas mudam números que os relatórios vão mostrar.

| Defeito | Evidência | Onde apareceu |
|---|---|---|
| A renovação emendada começa um dia depois do fim, e o Operacional considera o contrato vencido às 00h do próprio fim. Sobra um dia sem contrato vigente, e quando esse dia é o 1º a renovação vira vencido num mês e retorno no seguinte. A conferir com teste. | `src/lib/renewal.js:39`; `src/lib/contracts.js:56-59`; `src/lib/operacional/base.js:122-130` | R079, R080 |
| O modal avisa que o contrato atual será encerrado na renovação sobreposta, e nenhuma escrita encerra. | `src/lib/renewal.js:67-72`; `src/lib/contractsWrites.js:94-96` | R077 |
| A marca da aula que converteu roda em retorno e em Upgrade sem contrato vivo. | `src/lib/contractsWrites.js:157-161`; `src/lib/aulas.js:29-41` | R029, R040, R044 |
| `closedFromUpgrade` marca qualquer contrato novo de quem está no funil Upgrade. | `src/lib/contracts.js:174` | R097 |
| O board de Vencidos consulta só balde cliente com fim do contrato no passado, então mostra cancelado e trancado. | `src/lib/leadQueries.js:102-108` | R089 |
| Excluir etapa do Vencidos em uso deixa o card órfão. | `src/views/settings/FunnelsSection.jsx:213`; `src/lib/expiredFunnel.js:122-150` | R089, R094 |
| Academia nova não recebe dores no provisionamento, e a dor é obrigatória no cadastro manual. O cadastro trava até alguém criar uma. | `api/provision-tenant.js:24-35`; `src/modals/AddLeadModal.jsx:411` | R141, R143 |
| O CSV de agendamentos não neutraliza fórmula, ao contrário do CSV de leads. | `src/lib/appointmentReport.js:110-118`; `src/views/LeadsView.jsx:130-134` | R027, R037 |
| A coluna Observação do CSV de leads vem vazia em lead novo, porque a observação do cadastro vai para a linha do tempo. | `src/views/LeadsView.jsx:139-142`; `src/modals/AddLeadModal.jsx:499-510` | R153 |
| Os botões Exportar e Relatório mensal do console não têm ação. | `src/views/console/SuperConsole.jsx:106-107`, `:861` | R160 |
| O detalhe da academia no console vê só os pagamentos e a auditoria que caíram nas 25 e 30 linhas mais recentes de todas as academias. | `api/super-overview.js:223`, `:234` | R162, R168 |

#### Inviáveis, um a um

| Relatório | Por que fica fora | O que chega perto |
|---|---|---|
| R047. Uso diário do passe e capacidade da turma | O CRM não guarda check-in, catraca, grade de horário nem capacidade de turma. O registro da aula tem uma data, um professor e um desfecho. Passar a gravar isso no CRM duplicaria a operação da recepção, que é do Stronix Suite. | R041 (validade do passe) e R042 (escala de aulas experimentais por professor). |
| R062. Recebimento, forma de pagamento e inadimplência da academia | O CRM não guarda pagamento, parcela, forma de pagamento nem inadimplência do aluno, e o Gerencial avisa isso num chip fixo. `tenant_payments` e a inadimplência do `src/App.jsx` são a cobrança do Stronilead à academia, não o caixa da academia com o aluno. | O valor de contrato vendido do Gerencial (R049) e o insumo da Comissão (R056). |
| R170. Custo de leitura por academia | Já estava fora do escopo e a conferência confirmou. O Firestore cobra por projeto, e o app não conta a própria leitura: o super-overview só faz contagens (`api/super-overview.js:7-12`). | R161 (saúde de uso por academia). |


## 7. Regras, permissões, custo e arquitetura

Esta seção junta o que limita a tela de Relatórios: as regras que os painéis já seguem, quem lê o quê pelas regras do Firestore, quanto custa ler, onde a tela entra no endereço e três jeitos de montar tudo. Base: o código da worktree em 24/09/2026, igual à main depois da PR #220. Caminhos relativos à raiz do repositório do Stronilead.

### 7.1 Regras de negócio que todo relatório precisa respeitar

Cada linha já vale em alguma tela. Relatório que fugir dela mostra um número diferente do painel, e o Johnny já pediu que o mesmo número não apareça em dois lugares com regra diferente (`docs/superpowers/specs/handoff-crm/README.md:389-398`). O jeito seguro é chamar os `metricsOf` que já existem, não recalcular por fora.

#### Lead e cliente

| Regra | Fonte | No relatório |
|---|---|---|
| Quem virou cliente nunca volta a ser lead nem vai para Perda. Contrato vencido é cliente inativo. | `src/lib/stageMove.js:7-24`, `:80-112` | Perda é só de lead. Saída de cliente vem do contrato. |
| O balde do lead (`lifecycleBucket`) é cliente, perda ou ativo, e cliente ganha de perda. | `src/lib/leadDerived.js:12-19` | Recorta o estado de hoje. Não conta o passado. |
| A primeira matrícula é `clienteSince`, gravado uma vez. `convertedAt` é regravado quando um ex-cliente volta. A renovação não mexe em nenhum dos dois. | `src/lib/contracts.js:132-138`, `:212-221`; `src/lib/crm/cohort.js:18-27` | Matrícula de mês fechado sai da primeira matrícula (`firstEnrolledAtOf`, a menor data entre `convertedAt` e `clienteSince`). |
| Etapa com "Venda", "convertid" ou "matricul" no nome conta como matrícula e carimba `convertedAt`, mesmo sem contrato. | `src/lib/leads.js:42-46`; `src/lib/stageMove.js:94-96` | O CRM conta essa matrícula. Operacional e Gerencial contam contrato e não contam. O relatório diz qual das duas mostra. |
| Perda no CRM é o lead em Perda hoje com `lostAt` na janela. Reativar ou matricular apaga `lostAt` e `lossReason`. | `src/lib/crm/cohort.js:80-91`; `src/lib/stageMove.js:89-92`; `src/lib/contractsWrites.js:111-112` | A perda de um mês fechado encolhe. Desde 14/09/2026 ela sobrevive na interação `status_change` para Perda. |
| Excluir o lead apaga as interações dele. Contrato e aula ficam sem o lead. | `src/views/LeadProfileView.jsx:215-236`; `firestore.rules:242`, `:253` | Leads criados e volume de meses fechados podem cair depois. |
| Origem, etapa, motivo de perda, dor e etiqueta são gravados no lead pelo nome. Renomear no catálogo reescreve só os leads. | `src/views/settings/CatalogsSection.jsx:57-60`, `:82`; `src/views/settings/FunnelsSection.jsx:180-189` | Agrupar pelo nome atual do lead. Interação e aula guardam o nome velho, e a série se parte em duas linhas. |
| O cadastro já abre com a primeira origem do catálogo marcada. | `src/modals/AddLeadModal.jsx:359` | Relatório por origem puxa para essa primeira origem. |
| Primeiro contato é a primeira interação que não seja observação do cadastro, indicação, importação ou troca de responsável. | `src/lib/crm/contact.js:8-21` | Troca de etapa sem conversa conta como contato. |
| Atraso, lead quente e lead frio são calculados na hora e nunca gravados. | `src/lib/kanban.js:33-39`; `src/lib/leadStatus.js:116-148` | Não existe atraso de um dia passado. |
| Só cliente indica, e o indicado pelo link herda o consultor de quem indicou. Origem "Indicação", funil de Indicações e `referredById` podem discordar. | `api/tenant-resolve.js:205-215`, `:267`, `:283-285`; `src/views/LeadProfileView.jsx:378-390` | Relatório de indicação conta por `referredById`. |

#### Funis

| Regra | Fonte | No relatório |
|---|---|---|
| Funil de sistema se reconhece pela flag `systemKind`, nunca pelo nome: Indicações, Upgrade, Renovações e Vencidos. | `src/lib/funnels.js:21-26` | Separar funil de lead de funil de cliente pela flag. |
| "Todos os funis" deixa fora Renovações, Vencidos e Upgrade. Indicações entra. | `src/lib/crm/scope.js:25-37` | Mesmo recorte no relatório de lead. |
| O recorte de funil e de pessoa usa o funil e o dono de hoje. | `src/lib/crm/scope.js:49-66` | Mover o lead de funil leva o passado dele junto. |
| Lead sem `funnelId` cai no funil padrão. | `src/lib/funnels.js:34-39` | Trocar o padrão muda o funil dos leads antigos. |
| Funil de cliente não recebe lead novo pelo cadastro. | `src/modals/AddLeadModal.jsx:330-338` | Lead novo em Renovações, Vencidos ou Upgrade é sinal de dado estranho. |
| A troca de etapa só é gravada desde 14/09/2026 às 18h10, com o nome da etapa na hora. O "avançou" usa a ordem de hoje (`stronix_statuses.order`). | `src/lib/crm/scope.js:10-17`; `src/lib/crm/stages.js:40-140` | Sem número de passagem antes de setembro de 2026. Reordenar etapas muda meses passados. |
| Comparecer em aula ou visita promove o lead para Negociação sozinho. | `src/lib/appointmentOutcome.js:73-93` | Parte da passagem para Negociação é automática. |
| Upgrade: entrada manual, só cliente, venda marcada por `closedFromUpgrade`. Fechar com contrato vivo liga ao contrato atual. | `src/lib/upgradeFunnel.js:1-13`; `src/views/KanbanView.jsx:1578-1582` | A mesma venda é Upgrade no Operacional e Renovação no mix do Gerencial (`src/lib/operacional/base.js:307`; `src/lib/gerencial/scope.js:26-27`). |
| Recusa de renovação é marca (`renewalDeclined`), não etapa. Pelo board o motivo gravado é sempre "Outro". | `src/lib/renewalGoal.js:108-145`; `src/views/KanbanView.jsx:925-930` | Motivo de não renovar só vale quando a recusa veio da Meta. |

#### Contratos e dinheiro

| Regra | Fonte | No relatório |
|---|---|---|
| Não é financeiro. Todo número é valor de contrato vendido, e o sistema não guarda pagamento, parcela nem inadimplência. | `CLAUDE.md`, seção Dashboard Gerencial | Repetir o aviso. Nunca chamar de receita. |
| A venda conta no fechamento (`createdAt`), com `startsAt` de reserva. | `src/lib/gerencial/scope.js:7-9` | Renovação assinada antes conta no mês do esforço. |
| Cada contrato entra num tipo só: renovação (`renewedFromId`), depois upgrade (`closedFromUpgrade`), depois retorno ou matrícula nova, conforme a pessoa já ter contrato antes. | `src/lib/gerencial/scope.js:23-34` | Mix de vendas sem contar duas vezes. |
| Duas moedas que nunca se somam. Venda é o valor total. Carteira e risco são `value ÷ durationMonths`, e sem duração vale o valor inteiro. | `src/lib/gerencial/scope.js:15-21` | O sufixo `/mês` anda colado ao número. |
| Contrato com valor zero entra na contagem e no risco, nunca no dinheiro. | `src/lib/gerencial/scope.js:11-13`; `src/lib/gerencial/wallet.js:13-22` | Os 494 importados da STRONIX estão aqui. |
| Cancelado depois continua na venda do mês em que foi fechado. A correção reescreve valor, plano e início no próprio contrato, sem guardar o anterior. | `src/lib/gerencial/sales.js:28`; `src/lib/contracts.js:374-400` | Cancelamento não muda mês fechado. Correção muda. |
| Trancado fica na carteira e não vence. O fim anda pelos dias parados na reativação. | `src/lib/contracts.js:74-76`, `:332-369`; `src/lib/operacional/base.js:120-131` | `endsAt` de trancado não é vencimento. |
| A carteira soma contrato, e contrato paralelo é permitido. A base de ativos soma pessoa. | `src/lib/gerencial/wallet.js:1-2`; `src/lib/operacional/base.js:133-146` | Clientes e contratos dão números diferentes. |
| Só ativo, trancado e cancelado são gravados. Agendado, a vencer (30 dias fixos) e vencido saem do relógio. | `src/lib/contracts.js:15-25`, `:62-92` | Situação num dia passado se recalcula pelas datas. |
| A vigência termina às 00:00 do dia de `endsAt`. | `src/lib/expiredGoal.js:31-35`; `src/lib/contracts.js:80` | Dia exato de vencimento para coorte e churn. |
| Churn é cancelamento sem outro contrato valendo, ou fim da tolerância sem retorno. Trancado não conta. | `src/lib/operacional/base.js:252-280` | Usa o `renewalGraceDays` de hoje. |
| Sucessor é a renovação ligada ou outro contrato da pessoa criado até o fim mais a tolerância. | `src/lib/operacional/renewal.js:35-52` | Renovação de mês fechado ainda sobe até a tolerância acabar. |
| Valor gravado em reais com casas decimais, não em centavos. | `src/lib/format.js:1-22` | Arredondar na soma. |
| Motivos de cancelamento, trancamento, não renovar e desconto são listas fixas no código. | `src/lib/contracts.js:36-47`; `src/lib/renewal.js:89` | Agrupam sem limpeza. |
| Datas de cancelar, trancar e reativar são escolhidas no modal e podem ser retroativas. | `src/modals/ContractOutcomeModal.jsx:67-72`, `:104-108` | A hora real do registro está só na interação. |
| Base e carteira só existem a partir dos contratos, desde junho de 2026. Cliente antigo sem contrato fica em "Sem contrato". | `src/lib/operacional/base.js:1-7` | Série de clientes antes de julho de 2026 não é confiável. |

#### Agenda

| Regra | Fonte | No relatório |
|---|---|---|
| O histórico de agendamento é `stronix_aulas`, um registro por agendamento, sem exclusão. O lead guarda um compromisso só, e vence o último escrito. | `src/lib/aulasWrites.js:13-44`; `firestore.rules:253`; `src/lib/schedulePatch.js:9-70` | Relatório de agenda lê `stronix_aulas`, nunca o espelho do lead. |
| Aula e visita se separam no navegador (`isAulaRecord`). Registro sem `type` é aula. | `src/lib/aulas.js:7-16`; `src/lib/crm/queries.js:19-21` | Nunca filtrar `type` na consulta. |
| Só o desfecho de aula vai para o registro. O da visita é deduzido: espelho do mesmo instante, senão a linha do tempo do dia marcado ou do seguinte. | `src/lib/leads.js:228-233`; `src/lib/crm/appointments.js:52-104` | Cancelamento de visita registrado em outro dia fica como pendente. |
| O crédito da matrícula vai para a última aula atendida, sem limite de tempo. Visita nunca leva. | `src/lib/aulas.js:27-41`; `src/lib/aulasWrites.js:109-126` | Conversão por professor é atribuição de última aula. |
| No CRM o agendamento conta no mês do `scheduledFor`, sem cancelados e sem quem já tinha matriculado. | `src/lib/crm/appointments.js:106-136` | Aula de upgrade fica fora do funil de lead. |
| Comparecimento é compareceu ÷ (compareceu + faltou). Sem desfecho fica à parte. | `src/lib/crm/appointments.js:130-135` | Desfecho não registrado infla a taxa. |
| Presença confirmada credita a Meta do dono do lead, não de quem confirmou. | `src/lib/dayAgenda.js:10-11`; `src/lib/appointmentOutcome.js:1-22` | Plantão não aparece como produção de quem fez. |
| Desfecho e conversão mudam o registro sem mudar a data. | `src/lib/crm/queries.js:27-40` | Os dois meses antes do corrente precisam vir do servidor. |
| Passe livre: `trialClassesPlanned` é validade em dias, apesar do rótulo "aulas". | `src/lib/freePass.js:1-31` | Contar dias, não aulas. |
| Nome do professor, modalidade e unidade ficam congelados no registro. | `src/views/settings/TeamAccessSection.jsx:397-406`; `src/views/settings/SchedulingSection.jsx:196-203` | Agrupar professor por `professorId`. Unidade só existe pelo nome. |
| Aulas completas desde a segunda quinzena de julho de 2026. Visitas com registro desde 18/08/2026. Base completa a partir de setembro de 2026. | `src/lib/crm/scope.js:18-24` | Meses anteriores marcados como parciais. |

#### Equipe e dono do lead

| Regra | Fonte | No relatório |
|---|---|---|
| Dois papéis: `admin` (Gestor) e `consultant` (Consultor). O dono é só o `primaryAdminUid`, sem permissão própria. Professor não tem login. | `src/lib/leads.js:237`; `api/invite-accept.js:131-140` | Não dá para separar dono de gestor. |
| Pessoa no CRM é o dono do lead hoje (`consultantId`). Quem saiu da equipe vira "Outros". | `src/lib/crm/scope.js:49-69` | Transferir carteira muda o passado por pessoa. |
| A venda é do consultor gravado no contrato, que é o dono do lead na hora da venda, e ninguém muda depois pela tela. | `src/lib/contracts.js:175-181`; `firestore.rules:238-241` | Venda por pessoa é histórica e estável. |
| A carteira de renovação é do responsável atual. | `src/lib/operacional/renewal.js:13-15` | Venda e renovação da mesma pessoa usam donos diferentes. O relatório diz qual usa. |
| O autor da ação é `actorAuthUid`, gravado desde 13/07/2026. Antes disso vale o dono do lead. | `src/lib/dailyGoal.js:88-98` | Atividade por pessoa antes de 13/07/2026 é aproximada. |
| A migração em massa troca o dono e reescreve `leadConsultantId` das interações, sem gravar `consultantChangedAt`. | `src/views/settings/TransferLeadsTab.jsx:141-164` | Não dá para saber de quem era a carteira antes. |
| A troca individual guarda só a última troca (`consultantChangedAt`). | `src/modals/ClientRegistrationModal.jsx:81-83` | Sem histórico de trocas. |
| Excluir o membro apaga o cadastro e a conta. Não existe "desligado": `active` é lido e não achei quem grava. | `api/admin-users.js:247`; `src/modals/ClientRegistrationModal.jsx:49` | Ex-funcionário vira "Outros". |
| O alvo de prospecção é individual (0 desliga, teto 500) e o de hoje vale para meses passados. | `src/lib/dailyGoal.js:243-255`; `src/lib/operacional/routine.js:108` | Mês fechado de prospecção muda quando o gestor mexe no alvo. |
| Renomear um membro só atualiza `consultantName` dos leads. | `src/views/settings/TeamAccessSection.jsx:268-279` | Agrupar por id, nunca por nome. |
| Só existe doc de dia batido, gravado pela própria pessoa e sem exclusão. | `src/lib/dailyGoalHistory.js:22-44`; `firestore.rules:206-216` | Ausência de doc quer dizer dia não batido. |
| A regra comercial assinada pelo time dá a venda a quem agendou o passe livre. O sistema dá ao dono do lead. | `02-playbooks/TIME COMERCIAL/REGRAS_ATRIBUICAO_VENDAS_STRONIX.md:21-26` (fora do repositório, em `STRONIX-FIRMA`); `src/lib/contracts.js:175-181` | Relatório de comissão não resolve disputa de atribuição. |

#### Importação

| Regra | Fonte | No relatório |
|---|---|---|
| Contrato importado (`importBatchId`, `importSource` ou `importedBy`) entra na base, na carteira e na renovação. Nunca conta como venda, matrícula, retorno, cancelamento ou trancamento feito no app. | `src/lib/contracts.js:269-271`; `src/lib/operacional/base.js:1-7` | Filtrar com `isImportedContract` em todo relatório de evento. |
| Cancelamento ou trancamento feito no app num importado conta. | `src/lib/contracts.js:280-310` | Só o que veio da planilha fica de fora. |
| Lead criado pela importação não é lead novo, prospecção nem matrícula. A matrícula importada também não conta. | `src/lib/crm/cohort.js:29-53`; `src/lib/operacional/routine.js:98-99` | Filtrar com `isImportCreatedLead`. |
| O importado leva no `createdAt` a data da planilha, ou a da importação quando ela falta. | `src/lib/clientImport.js:624` | Sem o filtro, 494 contratos viram vendas do dia da importação. |
| Importado sem valor, com plano casado, recebe o preço de tabela do plano. | `src/lib/clientImport.js:500-502` | Parte da carteira pode ser preço de tabela, não valor negociado. |
| A origem do importado é "Importação X". | `src/lib/clientImport.js:563` | Tirar do relatório por origem de captação. |

#### Datas e meses

| Regra | Fonte | No relatório |
|---|---|---|
| O mês vai do dia 1 ao dia 1 seguinte, na hora local do navegador. O mês corrente vai até agora, e o comparado anda o mesmo tempo (pró-rata). | `src/lib/operacional/month.js:18-43` | Período livre precisa de regra de corte própria. |
| A academia não tem fuso gravado. A busca por `timeZone` e `America/Sao_Paulo` em `src/` e `api/` não acha nada. | busca no código | Conta feita em `api/` roda em UTC e desloca o que acontece entre 21h e meia-noite. |
| O filtro de mês aceita só os 12 meses até o corrente. | `src/lib/screenParams.js:58-65` | Série maior pede parâmetro novo. |
| Nenhuma taxa é gravada. A equipe é a soma das pessoas mais "Outros". | `src/lib/operacional/metrics.js:1-3`, `:116-120` | Toda taxa sai das contagens na hora. |
| Bases que começam tarde: meta desde 03/06/2026, contratos desde junho de 2026, autor da ação desde 13/07/2026, `stronix_aulas` desde 16/07/2026, visitas desde 18/08/2026, `pauseHistory` desde 14/09/2026, troca de etapa desde 14/09/2026 às 18h10. | leitores da auditoria; `src/lib/crm/scope.js:10-24` | Cada relatório mostra desde quando o número vale. |

### 7.2 Quem pode ver o quê

Dentro da academia, qualquer membro logado lê tudo pelas regras do Firestore. "Só do gestor" hoje é trava de tela (`gestor: true` em `src/lib/routes.js:62-64`), não segredo. As três Visões gerais, inclusive o Gerencial com o dinheiro vendido por colega, já abrem para o consultor (`src/lib/routes.js:52-55`).

| Dado | Consultor lê no navegador | Gestor lê no navegador | Super-admin | Para esconder do consultor de verdade |
|---|---|---|---|---|
| Leads com nome, WhatsApp, CPF, endereço, origem e etapa | Sim, a base inteira (`firestore.rules:79-80`) | Sim | Não pelas regras. Só contagem por `api/super-overview.js:21-25` | Fechar a coleção quebra Pipeline, Meta e ficha. Não recomendo. |
| Interações e linha do tempo | Sim (`firestore.rules:90-91`) | Sim | Contagem e última atividade | Mesmo problema dos leads. |
| Contratos com valor | Sim, inclusive o valor de cada colega (`firestore.rules:235-236`) | Sim | Não | Ficha, renovação e Meta leem contratos. Fechar exige outra forma de servir essas telas. |
| Aulas e visitas (`stronix_aulas`, com `leadName`) | Sim (`firestore.rules:248-250`) | Sim | Não | Idem. |
| Histórico de meta de todos | Sim (`firestore.rules:206-207`) | Sim | Não | Decisão da PR #206, em produção desde 14/09/2026: todos veem todos. |
| Equipe: nome, e-mail, turno, alvo | Sim, mesmo com a academia bloqueada (`firestore.rules:120-121`) | Sim | Não | Não se aplica. |
| Catálogos e configuração | Sim (`firestore.rules:136-192`) | Sim, e só ele grava | Não | Não se aplica. |
| Convites da academia | Não | Sim (`firestore.rules:266-269`) | Sim | Já é só de gestor. |
| Dados privados da academia (`tenants/{id}/private`) | Não | Sim (`firestore.rules:276-279`) | Sim | É o molde de dado só de gestor. |
| Doc raiz da academia, com `internalNotes`, `monthlyPrice`, `primaryAdminEmail` e `lastInvoiceUrl` | Sim (`firestore.rules:260-262`; `api/tenant-status.js:166-173`; `api/asaas.js:103`) | Sim | Sim | Mover esses campos para `private`. Relatório nenhum deve ler daqui. |
| Pagamentos da plataforma, auditoria e eventos do Asaas | Não | Não | Sim (`firestore.rules:284-297`) | Já é só do super-admin. |
| Dados de outra academia | Não | Não | Só por função em `api/` com o Admin SDK | Relatório entre academias exige servidor. |
| Coleção nova de relatório (resumo ou foto) | Negada até existir regra: não há regra genérica no arquivo | Idem | Idem | Regra nova, publicada à mão no console. |

Três níveis de proteção possíveis para um relatório:

| Nível | Como | Custo | O que protege |
|---|---|---|---|
| 1. Trava de tela | `gestor: true` na tela, no molde de Configurações | Nenhum | Quem usa a tela. Não protege de quem abre o console do navegador. |
| 2. Resumo só de gestor | Função grava o número pronto numa coleção com leitura `isAdmin`, no molde de `private` | Função, regra nova e 1 leitura a mais por consulta, porque `isAdmin` lê o doc do usuário (`firestore.rules:50-58`) | O número pronto. O dado cru continua legível. |
| 3. Fechar a coleção | Mudar a regra de leads, contratos ou interações | Reescrever as telas que dependem da base compartilhada | Tudo, ao preço de desfazer a decisão da base compartilhada. |

Duas decisões ficam com o Johnny. O consultor vê Relatórios, e se vê, vê só o que é dele? E o consultor pode exportar lista com nome e WhatsApp? Hoje ele exporta a base inteira em Todos os leads, sem trava (`src/views/LeadsView.jsx:177-185`), e Aulas e Visitas com telefone (`src/lib/appointmentReport.js:38-41`). Separar dono de gestor não existe no sistema. Daria para travar pela tela comparando com `tenants/{id}.primaryAdminUid`, que todo membro lê, mas continua trava de tela.

### 7.3 Custo de leitura e índices

Como o app lê hoje: tudo no navegador, com cache persistente no aparelho (`src/lib/firebase.js:120`) e sem servidor de relatório, cron ou documento de resumo (`vercel.json` só tem a regra de reescrita). O projeto Firebase é um só para todas as academias, então a cota grátis de 50 mil leituras por dia também é uma só (`docs/auditoria-leitura-2026-07-28.md:155`). Passar dela não derruba o app, o excedente é cobrado, e em julho já passava (`docs/auditoria-leitura-2026-07-28.md:154-156`). Toda consulta paga ainda 1 leitura pelo `tenantActive`, que consulta `tenants/{id}` (`firestore.rules:45-48`).

Premissas para uma academia de 2 a 3 mil leads. São hipóteses, ancoradas no mês da STRONIX medido na spec do CRM (`docs/superpowers/specs/2026-09-14-dashboard-crm-design.md:148-152`: 89 a 119 leads novos, 26 a 64 matrículas, 11 a 14 perdas, 17 a 58 agendamentos e cerca de 500 interações por mês).

| Item por mês | Hipótese |
|---|---|
| Leads novos | 250 a 500 |
| Matrículas e perdas | 60 a 150 cada |
| Registros em `stronix_aulas` | 100 a 250 |
| Dias de meta batidos (5 pessoas) | cerca de 110 |
| Interações | 3 a 5 mil |
| Contratos na coleção depois de um ano | 1 a 2 mil (a STRONIX tem cerca de 641 hoje) |

Custo por padrão de leitura:

| Padrão | Leituras | De onde sai |
|---|---|---|
| Mês fechado, aparelho novo, sem interações (leads criados, matrículas por `convertedAt` e `clienteSince`, perdas, aulas, metas) | 650 a 1.300 | Consultas de campo único, índice automático (`src/lib/operacional/queries.js:12-35`; `src/lib/crm/queries.js:17-25`) |
| O mesmo mês com as interações | mais 3 a 5 mil | `interactionsInMonthSpec` |
| Mês fechado com o cache do aparelho conferido | cerca de 12 (uma contagem por consulta, até mil documentos cada, mais o `tenantActive`) | `loadWithCountCheck`, `src/lib/operacional/queries.js:46-55` |
| 12 meses na primeira abertura do aparelho, sem interações | cerca de 8 a 16 mil | soma das linhas acima |
| 12 meses na primeira abertura do aparelho, com interações | cerca de 44 a 76 mil | Passa sozinho da cota grátis do projeto inteiro |
| Mês corrente | Leads, matrículas, perdas e aulas do mês vêm do servidor. As interações do mês já estão na memória do login. | `src/App.jsx:687-689` |
| Vendas, carteira, risco e vencimento | Nenhuma leitura nova | Contratos já assinados inteiros no login (`src/App.jsx:794-802`) |
| Origem das vendas do mês | 60 a 150 (um por lead vendido, em lotes de 30) | `src/hooks/useGerencialLeads.js:5-9` |
| Lista nominal de toda a base, no molde de Todos os leads | 2 a 3 mil por abertura | `src/lib/leadQueries.js:31-44`. Evitar. |
| Assinatura de contratos do login | 1 a 2 mil por reassinatura, que acontece de novo depois de 30 minutos parado | Custo que já existe e cresce todo mês |
| Interações do mês corrente assinadas no login | Até 3 a 5 mil por reassinatura no fim do mês, antes de qualquer relatório | `src/App.jsx:687-689`. Nessa academia, a base do login sozinha passa de 5 mil leituras a cada volta de ociosidade longa. |
| Série de contagem pura (leads, matrículas ou interações por mês) | 1 leitura por mês a cada mil entradas, mais a da regra: cerca de 24 para 12 meses | `getCountFromServer`, já usado em `src/hooks/useFunnelCounts.js:38`. O SDK 12 (`package.json:21`) também soma no servidor (`getAggregateFromServer`), ainda sem uso no app. |
| Histórico de metas inteiro, como no painel da equipe | Cresce para sempre | `src/views/DailyGoalTeamView.jsx:47-55`. O relatório usa `goalHistoryInMonthSpec` (`src/lib/operacional/queries.js:29-35`). |

Regras de custo para a tela nova, tiradas do que os painéis já fazem:

- `getDocs` pontual com a memória de sessão de `src/hooks/monthSources.js`, nunca assinatura ao vivo nova.
- Carga desligada quando o portão de atividade desliga (`src/lib/activityGate.js:23`).
- Mês fechado do cache conferido por contagem. Os dois meses antes do corrente relidos do servidor para aulas, como o CRM faz (`src/lib/crm/queries.js:27-40`).
- Sem rede o Firestore responde do cache sem erro, e um mês incompleto não entra na memória como completo (`src/lib/operacional/queries.js:187-198`).
- Busca de lead por id sempre em lotes de 30, o teto do operador `in`.
- O cache do aparelho tem o tamanho padrão do SDK (40 MB, sem `cacheSizeBytes` em `src/lib/firebase.js:120`). Série longa pode expulsar os dados da Meta e dos painéis.

Índices compostos que existem (`firestore.indexes.json`, 14 no total, sem `fieldOverrides`):

| # | Coleção e campos | Uso hoje | Serve ao relatório |
|---|---|---|---|
| 1 | leads: `lifecycleBucket`, `funnelId`, `lostAt` desc | Coluna Perda por funil | Lista de perdas por funil, paginada |
| 2 | leads: `lifecycleBucket`, `funnelId`, `createdAt` desc | Paginação e contagem por funil | Contagem de clientes e perdas por funil |
| 3 | leads: `lifecycleBucket`, `convertedAt` desc | Clientes e coluna Venda | Matrículas de quem é cliente hoje |
| 4 e 13 | leads: `lifecycleBucket`, `currentContractEndsAt` asc e desc | A vencer, Renovações, Vencidos | Lista nominal por faixa de vencimento |
| 5 | leads: `appointmentType`, `appointmentScheduledFor` | Aulas e Visitas | Não. Relatório de agenda lê `stronix_aulas`. |
| 6, 7, 8 | leads: `consultantId` com `createdAt` desc, `convertedAt` desc, `appointmentScheduledFor` | Sem uso (`src/lib/leadQueries.js:173-182`) | Relatório de uma pessoa num período, na mesma direção do índice. É o dono de hoje. |
| 9 | interações: `leadConsultantAuthUid`, `createdAt` | Sem uso | Fraco: o campo é reescrito na migração em massa |
| 10 | interações: `leadId`, `createdAt` desc | Linha do tempo da ficha | Histórico de um lead |
| 11 | leads: `lifecycleBucket`, `nextFollowUp` | Clientes com contato hoje | Agenda de contatos de clientes |
| 12 | leads: `consultantId`, `consultantChangedAt` desc | Sino de leads recebidos | Leads recebidos por pessoa, só a última troca |
| 14 | leads: `zapMatchKey` | Stronizap | Nenhum. Um campo só declarado como composto. |

Nenhum relatório da primeira versão precisa de índice novo, se ler por mês num campo só e filtrar na memória. Os que apareceriam para ler série longa filtrando no servidor:

| Índice | Para quê | Cuidado |
|---|---|---|
| interações: `type`, `createdAt` | Passagem entre etapas e perda por `status_change` sem ler todas as interações do mês | Só vale para dado desde 14/09/2026 |
| interações: `actorAuthUid`, `createdAt` | Atividade de uma pessoa em 6 ou 12 meses | Interação antes de 13/07/2026 não tem o campo e some da consulta |
| aulas: `professorId`, `scheduledFor` | Série longa de um professor | Nunca combinar com `type` |
| leads: `source`, `createdAt` | Série longa por origem | A origem é gravada pelo nome e o renome reescreve os leads |

Índice e regra são publicados à mão no console do Firebase, não pela CLI (`CLAUDE.md`). A ordem certa: publicar, esperar o índice sair de Building para Enabled (`docs/scale-migration.md:63-69`) e só então fazer o deploy. Consulta sem índice falha com FAILED_PRECONDITION, e coleção sem regra dá permission-denied. Depois de publicar a regra, conferir o ruleset ativo contra a main, como foi feito na PR #194.

### 7.4 Exportação e impressão

O que existe hoje:

| Exportação | Onde | Formato | Protege fórmula | Quem usa | Observação |
|---|---|---|---|---|---|
| Todos os leads | `src/views/LeadsView.jsx:123-155` | CSV com `;` e BOM UTF-8 | Sim, `csvCell` (`:131-135`) | Qualquer papel, o botão não olha o papel (`:177-185`) | Base inteira com WhatsApp. Arquivo `leads_stronix_<data>.csv`, sem nome de pessoa, mas com "stronix" fixo no nome para qualquer academia (`:150`). |
| Aulas e Visitas | `src/modals/AppointmentExportModal.jsx:117-189`; `src/lib/appointmentReport.js` | CSV e PDF por janela nova | Não (`src/lib/appointmentReport.js:110-118`) | Qualquer papel | Lê o espelho do lead, um compromisso por pessoa, e não tem teto de período |
| Planilha de importação | `src/lib/spreadsheetRead.js:11-14` | Leitura de xlsx | Não se aplica | Super console | Prova que a biblioteca carrega só quando alguém usa |

A biblioteca é o `xlsx` 0.20.3, Community Edition, instalada de um arquivo no CDN da SheetJS (`package.json:29`). Ela escreve várias abas, datas e formato de número. Não faz estilo de célula. O PDF de hoje abre outra janela e chama `print()`. Com bloqueador de pop-up nada sai, e a tela só mostra um aviso (`src/modals/AppointmentExportModal.jsx:153-161`). O app não tem regra de impressão própria: o único `@media print` está dentro do HTML montado para a janela (`src/lib/appointmentReport.js:150`).

Proposta para Relatórios:

- Planilha xlsx, carregada por `import()` como na leitura da importação. Uma aba de resumo com os mesmos números da tela, uma por recorte (pessoa, origem, professor) e, quando o papel permitir, uma aba de lista. Número como número, data como data, texto como texto. Texto em célula de texto não vira fórmula.
- CSV só onde fizer falta, sempre com o `csvCell` de `src/views/LeadsView.jsx:131-135`, tirado da tela para um módulo comum. O CSV de Aulas e Visitas precisa ganhar a mesma proteção: o nome de um lead vindo do link público de indicação, sem login, chega direto na planilha do gestor (`api/tenant-resolve.js:188`, `:265`).
- PDF pela impressão da própria tela, com `@media print` novo: tema claro forçado, menu e barra escondidos, tabela sem quebrar linha no meio. Os gráficos do app são SVG puro, sem biblioteca, e imprimem bem (`src/components/charts/AreaChart.jsx:3-5`). Sem janela nova, sem bloqueio de pop-up.
- Todo arquivo leva no topo: academia, período, filtros, data e hora da geração, o aviso "valor de contrato, não caixa" quando houver dinheiro, e a marca de base parcial quando o período começa antes da base existir.
- O número exportado sai do mesmo cálculo da tela. Planilha montada por outra conta vai divergir do painel.
- Nome do arquivo sem nome de pessoa: `relatorio-<tipo>-<academia>-<AAAA-MM>.xlsx`.
- PDF gerado no servidor e envio agendado por e-mail ficam fora da primeira versão. Não há cron, não há biblioteca de e-mail, e sobra uma vaga de função na Vercel.

### 7.5 Onde a tela de Relatórios entra

Endereço. Hoje uma tela de dois segmentos, como `/visao-geral/crm`, aceita exatamente dois segmentos: um terceiro vira endereço desconhecido (`src/lib/routes.js:166-174`). Só a tela de um segmento aceita sub-tela no caminho, como `/configuracoes/<secao>` (`src/lib/routes.js:175-180`, `:83-89`). Duas saídas:

| Opção | Endereço | Exige | Prós | Contras |
|---|---|---|---|---|
| A | `/<academia>/relatorios/<relatorio>` | `relatorios` em `RESERVED_TENANT_SLUGS` (`src/lib/tenantSlug.js:24-29`) e `subs` com `subPadrao` em `SCREENS` | Igual a Configurações. Cada relatório tem link próprio, e sub-tela desconhecida cai na padrão sem aviso. | Antes de reservar, conferir na lista de academias do super-admin que nenhuma usa o id `relatorios`. |
| B | `/<academia>/visao-geral/relatorios` | Relatório escolhido na query, ou o leitor de endereço passar a aceitar sub-tela em grupo, com teste | `visao-geral` já é reservado | Relatório na query mistura sub-tela com filtro. Mexer no leitor de endereço mexe em todas as telas de grupo. |

Recomendo a opção A.

Trava por papel. A trava é por tela (`src/lib/routes.js:263-268`). Se alguns relatórios forem só do gestor e outros abertos, não existe trava por sub-tela: seria regra nova na decisão de rota, com teste. A saída mais simples é a tela inteira aberta, como os painéis, com a exportação de lista nominal travada para o gestor. Quem abre tela de gestor sem ser gestor recebe "Essa tela é só do gestor." e volta ao Operacional.

Filtros no endereço. Entram numa linha nova da `TABELA` (`src/lib/screenParams.js:255-265`), lidos pelo `useScreenParams`. Nada de `useState` para filtro e nada de ler o endereço num effect. Ausente é o padrão e não é escrito. Valor inválido cai no padrão sem aviso. Trocar filtro é `navigate` com replace e `state` explícito.

| Nome | Valor | Molde |
|---|---|---|
| `mes`, `comparar`, `comparar-com` | Mês e comparação | Já existem |
| `de`, `ate` | Início e fim em mês (AAAA-MM), com teto | Novo. A janela de 12 meses do `mes` não serve para série longa. |
| `pessoa`, `funil`, `prof`, `resp` | Ids | Já existem |
| `origem`, `plano`, `modalidade` | Id do catálogo, convertido para nome na leitura, como a fase já faz (`src/lib/screenParams.js:176-199`) | Novo |
| `leitura` | `safra` ou `periodo` | Novo. Diz se a conversão é da safra cadastrada no mês ou das matrículas do mês. |

Nome novo nunca pode ser `invite`, `t` ou `ref`. No endereço só vão ids. Nome, telefone, CPF e texto de busca nunca.

Chave e título. `screenKey` olha só a tela (`src/lib/routes.js:397-402`), então trocar relatório ou filtro não remonta a tela nem relê as coleções. O `src/lib/__tests__/filtrosNoEndereco.sweep.test.js` cobra isso. O título sai de `documentTitle` como "Relatórios · <Academia> · STRONILEAD" (`src/lib/routes.js:405-411`). Se o nome do relatório entrar no título, entra o nome do relatório, nunca o de uma pessoa.

Sentry. A transação leva o molde da rota, e o `rest` fica de fora (`src/lib/routes.js:414-420`). A query sai de `request.url`, das migalhas e das spans (`src/lib/sentryScrub.js:55-78`, `:215-217`). Nada novo a fazer enquanto o caminho não levar id de lead. Se levar, entra no `LEAD_PATH_RE` (`src/lib/sentryScrub.js:100`) com teste. Um cuidado de código: erro de exportação não passa linha do relatório para `console.error`. A limpeza mascara chave do Zap, CPF, e-mail e telefone (`src/lib/sentryScrub.js:11-30`), mas não reconhece nome de pessoa num texto.

Listas dentro do relatório. Abrir ficha é sempre `LeadLink` (`src/lib/__tests__/leadLinkSweep.test.js`), e rolador horizontal leva `overscroll-x-contain` (`src/lib/__tests__/overscrollGuard.test.js`). Os painéis de hoje não abrem a lista de onde o número saiu. O relatório pode ser esse caminho.

Menu. O item entra no `App.jsx` montado com `hrefFor` e a academia do claim, como os outros (`src/App.jsx:1530-1540`).

### 7.6 Arquiteturas possíveis

| | A. Só no navegador | B. Resumo mensal congelado | C. Foto diária |
|---|---|---|---|
| Como funciona | A tela lê por mês com `monthSources.js` e `useCrmSources.js`, usa a mesma memória de sessão dos painéis e calcula com os `metricsOf` de `src/lib/crm/`, `src/lib/operacional/` e `src/lib/gerencial/` | Uma ação nova numa função existente (molde `switch (action)` de `api/admin-users.js:29-35`) ou a 12ª função lê o mês fechado uma vez com o Admin SDK e grava `stronix_relatorios/{AAAA-MM}` com versão da regra, `computedAt` e contagens de conferência. Dispara quando o primeiro gestor abre um mês sem resumo. | O app grava um retrato pequeno do estado (leads ativos por funil, etapa e consultor, atrasados, clientes por situação, carteira) com o que já tem na memória, no primeiro acesso do dia. Um doc por mês com um campo por dia (`stronix_fotos/{AAAA-MM}`), gravado com merge. |
| Função, regra, índice novos | Nenhum | Função ou ação, regra nova | Regra nova |
| Leitura para 12 meses | 8 a 16 mil sem interações e 44 a 76 mil com, na primeira vez de cada aparelho. Depois cerca de 150. | 12 leituras por abertura. O cálculo lê de 3,6 a 6,3 mil por mês fechado, uma vez por academia, mais os recálculos. | 12 leituras por ano de série. Cerca de 30 escritas por mês. |
| Número do mês fechado | Muda com a base de hoje | Congela | Congela o estado do dia |
| O que resolve | Quase todos os relatórios de evento e de dinheiro | Série longa de interação e número igual em todo aparelho | Evolução do pipeline, atraso e carteira por consultor, que hoje se perdem |

A. Prós: sai mais rápido e mostra o mesmo número do painel por construção. O que o painel já leu na sessão sai de graça. Contras: cada aparelho paga a primeira carga. Série longa de interação fica cara. O filtro de mês só volta 12 meses. Mês fechado muda quando uma perda é reativada, um lead é excluído ou uma origem é renomeada. Estado passado não existe.

B. Prós: série de 24 ou 36 meses barata, o mesmo número em todo aparelho, mês fechado que não muda, e o resumo pode ter leitura só de gestor (nível 2 da seção 7.2). Contras: gasta a última vaga de função ou mistura assunto numa função existente. As contas do CRM e do Operacional não rodam em `api/` hoje, porque `src/lib/operacional/routine.js:5` importa `dailyGoal.js`, que importa `lucide-react` (`src/lib/dailyGoal.js:1`), e o CRM puxa `OTHERS_ID` de lá (`src/lib/crm/scope.js:7`). As do Gerencial rodam limpas. O servidor roda em UTC e a academia não tem fuso gravado. A versão da regra no resumo precisa bater com a da tela. Desfecho de aula dado tarde pede recálculo dos dois meses anteriores. O estado do último dia do mês fica como estava no primeiro acesso, não na virada. E o resumo guarda só contagens, com as taxas calculadas na leitura, porque a regra herdada do Operacional proíbe agregado gravado ao lado do detalhe que o gera (`docs/superpowers/specs/handoff-gerencial/README.md:305-315`).

C. Prós: sem função nova, uma escrita por dia e nenhuma leitura extra para gravar. Guarda o que hoje ninguém guarda. Contras: dia sem ninguém logado fica sem foto. A foto é escrita pelo navegador, então é dado de confiança, como a meta batida. Só vale dali para frente. O doc do mês tem teto de 1 MB, que cabe 30 retratos pequenos. Como o consultor também tem todos os leads ativos e todos os contratos na memória (`src/App.jsx:679`, `:794-802`), qualquer membro pode gravar, o que diminui os buracos.

Recomendação: começar pela A e ligar a C na mesma entrega. A A cobre captação, perdas, agenda, vendas, carteira, renovação e rotina com as contas que já têm teste, sem nada publicado à mão além da regra da C. A C entra junto porque dia sem foto não se recupera depois, e ela é barata. A B fica para quando acontecer uma destas três coisas: alguma academia passar de uns 2 mil registros de interação por mês, alguém pedir série de mais de 12 meses de atividade, ou o Johnny decidir que mês fechado congela. Antes da B, tirar `OTHERS_ID` e `isImportCreatedLead` de `routine.js` para um módulo sem `lucide-react` e decidir o fuso da academia.

### 7.7 Riscos

| Risco | Evidência | Como tratar |
|---|---|---|
| A primeira carga de 12 meses de interações num aparelho novo estoura sozinha a cota grátis de todas as academias juntas | Cerca de 500 interações por mês na STRONIX (`docs/superpowers/specs/2026-09-14-dashboard-crm-design.md:152`); cota de 50 mil (`docs/auditoria-leitura-2026-07-28.md:155`) | Série de interação limitada a poucos meses na A, ou resumo da B |
| O número de um mês fechado muda depois, e o arquivo exportado diverge do recalculado | `src/lib/stageMove.js:89-92`; `src/views/LeadProfileView.jsx:215-236`; `src/views/settings/CatalogsSection.jsx:57-60`; `src/lib/contracts.js:374-400`; `src/lib/operacional/routine.js:108` | Data e hora da geração em todo arquivo. Decisão do Johnny sobre congelar. |
| Relatório calculado fora dos `metricsOf` diverge do painel | Três definições de matrícula: Kanban por `convertedAt` (`src/lib/leadQueries.js:238-245`), CRM pela primeira matrícula (`src/lib/crm/cohort.js:77-78`), Operacional e Gerencial por contrato (`src/lib/operacional/base.js:291-306`) | Chamar as funções existentes e dizer na tela qual definição está valendo |
| Lista nominal amplia a exposição de dado pessoal | Consultor exporta a base inteira com WhatsApp (`src/views/LeadsView.jsx:177-185`); regras deixam ler tudo (`firestore.rules:80`) | Exportação de lista só para o gestor, na tela |
| CSV sem proteção de fórmula | `src/lib/appointmentReport.js:110-118`; nome vindo do link público (`api/tenant-resolve.js:188`, `:265`) | Reusar `csvCell` e preferir xlsx |
| Índice esquecido derruba a tela com FAILED_PRECONDITION. Coleção sem regra dá permission-denied. | `docs/scale-migration.md:63-69`; `src/lib/crm/queries.js:19-21` | Primeira versão sem índice novo. Regra publicada e conferida antes do deploy. |
| Reservar `relatorios` quebra o link de uma academia que já tenha esse id | `src/lib/tenantSlug.js:22-29` | Conferir a lista de academias antes |
| O doc raiz da academia, lido por todo membro, carrega notas internas e preço do super-admin | `firestore.rules:260-262`; `api/tenant-status.js:166-173` | Nenhum relatório de plataforma mora ali. Mover os campos para `private`. |
| A assinatura de contratos cresce todo mês e o relatório de dinheiro depende dela | `src/App.jsx:794-802`; de 50 contratos em 28/07 para cerca de 641 na STRONIX | Item 5 da auditoria de leitura: filtrar por vigência e ler vendas por mês |
| Relatório longo expulsa do cache os dados da Meta e dos painéis | `src/lib/firebase.js:120` sem `cacheSizeBytes` | Série longa lida do servidor sem guardar, ou resumo |
| Conta no servidor sai deslocada no fuso | Nenhum fuso gravado; `src/lib/operacional/month.js:18-21` usa hora local | Campo de fuso na academia antes da B |
| Resumo gravado com uma versão da regra e tela com outra | As contas mudam a cada PR | Versão da regra no resumo e recálculo quando mudar |
| PDF por janela nova falha com bloqueador de pop-up | `src/modals/AppointmentExportModal.jsx:152-156` | Imprimir a própria tela |
| O `xlsx` vem do CDN da SheetJS, não do npm. Se o CDN cair, o `npm ci` do CI quebra. | `package.json:29` | Aceitar, ou guardar o arquivo no repositório |
| Série curta e valor errado com cara de histórico | Contratos desde junho de 2026; Shape One com preço mensal no lugar do total e 494 importados com zero (`docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md:70-73`) | Marca de base parcial e aviso de valor em revisão |
| Atividade e prospecção são autodeclaradas: a regra não confere `actorAuthUid` nem `createdAt` da interação | `firestore.rules:90-92` | Não usar volume de interação em comissão sem trava no servidor |
| O resumo no servidor disputa a última vaga de função com qualquer outra ideia | 11 de 12 funções em `api/` | Ação dentro de função existente |
| A atribuição comercial assinada pelo time difere da do sistema | `02-playbooks/TIME COMERCIAL/REGRAS_ATRIBUICAO_VENDAS_STRONIX.md:21-26` (fora do repositório); `src/lib/contracts.js:175-181` | Relatório de venda diz "dono do lead na venda" e não se apresenta como comissão |


