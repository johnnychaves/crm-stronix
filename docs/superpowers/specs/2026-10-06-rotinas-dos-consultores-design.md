---
status: revisão
---

# Rotinas dos consultores

O gestor monta a rotina de trabalho de cada consultor, e o consultor vai dando check ao longo do dia, dentro da Meta diária. A rotina é o trabalho que não tem lead: conferir a agenda da recepção, postar o story da aula, mandar o resumo do dia no grupo. O trabalho com lead continua todo na Meta diária, como hoje.

Desenhado com o Johnny em 06/10/2026, com dois mockups aprovados:

- `docs/superpowers/specs/mockups/2026-10-06-rotina-na-meta-diaria.html`: o cartão "Rotina de hoje" na Meta do consultor (a opção aprovada é a **A · Cartão na lateral**).
- `docs/superpowers/specs/mockups/2026-10-06-tela-rotinas-gestor.html`: a tela Rotinas do gestor, com as abas Modelos e Hoje (a visão aprovada do Hoje é **por pessoa**).

Os mockups têm hora simulada, check que funciona e tema escuro. Os textos de tela desta spec são os deles.

Vale para todas as academias do Stronilead. Não depende de módulo ligado pelo super-admin.

---

## Decisões do Johnny

1. A rotina é feita de tarefas recorrentes sem lead. O consultor só dá check.
2. A rotina é organizada em modelos, como uma ficha de treino. Cada modelo tem nome, tarefas e quem segue.
3. Cada consultor segue um modelo só. Um modelo pode ter várias pessoas. Para uma pessoa ter uma diferença, o gestor duplica o modelo, ajusta a cópia e passa a pessoa para ela.
4. A tarefa tem frequência (todos os dias de trabalho ou dias da semana escolhidos) e horário opcional.
5. O check tem uma observação opcional. Não existe "não deu para fazer".
6. A rotina não conta para o dia batido da Meta. Ela tem a contagem própria, e o dia batido, o ritmo e o histórico da Meta continuam medindo só o trabalho com lead.
7. Na Meta diária, a rotina fica num cartão na lateral, logo abaixo do Próximo compromisso.
8. O gestor tem um menu novo, Rotinas, com as abas Modelos (abre primeiro) e Hoje.
9. O histórico do mês vai para o Operacional do Dashboard, ao lado do resto do trabalho de cada pessoa.
10. Mudar um modelo vale a partir de hoje. Os dias anteriores continuam como estavam.
11. A tarefa com horário fica "agora" do horário até 30 minutos depois, e atrasada a partir daí.

A Meta da equipe (aba Equipe da Meta diária) foi descontinuada e sai numa PR à parte (#247 do `crm-stronix`). Esta função não se apoia nela.

---

## Os modelos

### O modelo

- **Nome**, até 40 caracteres, sem repetir na academia (a comparação ignora maiúsculas e espaços nas pontas).
- **Tarefas**, até 30 por modelo.
- **Quem segue**: os consultores que fazem essa rotina.

### A tarefa

| Campo | Regra |
|---|---|
| Nome | Obrigatório, até 80 caracteres. |
| Como fazer | Opcional, até 240 caracteres. Aparece para o gestor no modelo e para o consultor no cartão. |
| Em que dias | "Todos os dias de trabalho" (os dias da Meta da academia, em Configurações → Metas & ritmo) ou dias da semana escolhidos, pelo menos um. |
| Horário | "Com horário" (HH:MM) ou "Sem horário" (vale até o fim do dia). |
| Situação | Ativa ou pausada. Tarefa pausada não aparece na Meta nem conta no histórico. |

"Todos os dias de trabalho" segue os dias da Meta da academia. Quando o gestor muda esses dias em Configurações, a tarefa diária acompanha.

### Quem segue

- Só consultores ativos entram (`isMetaParticipant`, de `src/lib/acesso.js`). Gestor e professor não seguem modelo.
- Cada consultor segue um modelo só. Pôr uma pessoa num modelo tira ela do modelo anterior, na mesma gravação. A tela avisa antes: "(sai do Consultor da tarde)".
- Consultor sem modelo não tem rotina. A Meta dele não mostra o cartão, e a tela do gestor avisa: "Bruno ainda está sem rotina."
- Quem entra na equipe começa sem modelo. O gestor escolhe.

### Mudanças valem a partir de hoje

Toda vez que o gestor salva um modelo (nome, tarefas, quem segue, pausar, excluir tarefa), o sistema grava também a **versão do dia** daquele modelo: uma cópia com a data. Se ele salva duas vezes no mesmo dia, a versão do dia é trocada pela última.

O histórico de um dia passado usa a versão que valia naquele dia, que é a de data mais recente até ele. Por isso:

- tirar a segunda de uma tarefa não apaga as segundas em que ela ficou sem fazer;
- trocar a Carla de modelo não muda o que ela tinha de fazer antes da troca;
- apagar ou renomear uma tarefa não tira do histórico o que já foi feito.

Quem segue faz parte da versão. A troca de modelo de uma pessoa grava a versão do dia dos dois modelos, o que ela deixou e o que ela entrou.

Excluir um modelo apaga o modelo e grava a versão do dia marcada como excluída e sem ninguém. Quem seguia fica sem modelo.

---

## A regra do dia

Uma regra só, pura e testada, usada pelo cartão da Meta, pela aba Hoje e pelo histórico. Mora em `src/lib/rotinas.js`, no molde do `src/lib/dailyGoal.js`, e não importa nada de tela (sem `lucide-react`), para poder ser usada também pela `api/` se um dia precisar.

**A tarefa é do dia** quando está ativa e o dia é um dos dela: um dia de trabalho da academia, para "Todos os dias de trabalho", ou um dos dias escolhidos.

**O estado da tarefa** num instante:

| Estado | Quando | Texto no cartão |
|---|---|---|
| Feita | Tem check, e ele foi dado até 30 minutos depois do horário (ou a tarefa não tem horário) | "Feita às 08:06" |
| Feita depois do horário | Tem check, dado mais de 30 minutos depois do horário | "Feita às 10:12, depois do horário" |
| Agora | Sem check, do horário até 30 minutos depois | "É agora" |
| Atrasada | Sem check, mais de 30 minutos depois do horário | "Era às 10:30, atrasada há 35 min" |
| Mais tarde | Sem check, antes do horário | "Em 6h 55min" |
| Sem horário | Sem check e sem horário | "Até o fim do dia" |

Os 30 minutos de folga ficam numa constante só (`ROUTINE_ON_TIME_MINUTES`).

O dia é o do calendário local, com a mesma chave da Meta (`dgDateKey`). A tarefa sem check no fim do dia fica como não feita no histórico. Não passa para o dia seguinte.

---

## Na Meta diária do consultor

Cartão **"Rotina de hoje"** na lateral da `DailyGoalView`, logo abaixo do Próximo compromisso (`NextUp`) e acima da Agenda de hoje. Mockup: opção A do `2026-10-06-rotina-na-meta-diaria.html`.

- **Cabeçalho:** "Rotina de hoje", com a linha "Montada pelo gestor. Não conta na sua meta." e a contagem "2 de 6", mais uma barrinha por tarefa na cor do estado.
- **As tarefas com horário**, em ordem, com o horário à esquerda, o círculo no trilho e o nome. A tarefa "agora" ganha o fundo azul claro. A atrasada fica com o círculo e o texto em vermelho.
- **A linha do agora:** uma linha azul com a hora atual atravessa a lista e separa o que já passou do que vem pela frente. Ela anda sozinha com o relógio, no mesmo ritmo do resto da Meta.
- **Sem horário:** as tarefas sem horário ficam num grupo embaixo, com o ícone de repetição e a frequência ("Segundas e terças · até o fim do dia").
- **O check:** um toque no círculo marca a tarefa como feita, com a hora do servidor. Logo abaixo abre o campo "Observação (opcional)", com Salvar e Desfazer. O campo não trava nada: a pessoa pode ignorar e seguir. Enter salva e Esc fecha.
- **Desfazer:** tocar no círculo de uma tarefa feita desfaz o check, só no mesmo dia. A observação vai junto.
- **A observação salva** aparece embaixo da tarefa, num balãozinho.

O cartão só aparece para quem segue um modelo e tem pelo menos uma tarefa no dia. Ele não entra no `ProgressHero`, nos 63%, nos filtros da lista nem no dia batido.

As leituras do cartão obedecem ao portão de ociosidade da Meta (`listenersActive`), como as outras assinaturas da tela.

---

## A tela Rotinas do gestor

### Menu e endereço

- Item **Rotinas** no menu lateral, na seção Administração, logo acima de Configurações, só para o gestor. Até 08/10/2026 ficava logo depois de Meta diária; o Johnny pediu a troca no teste do preview. Ele leva a etiqueta "Novo" enquanto for novidade: um balão vermelho na ponta do item, cujo clique abre a explicação da tela, até 07/11/2026. Com o menu recolhido, o balão vira um ponto vermelho no ícone. O desenho segue o mockup `2026-10-08-balao-novo-rotinas.html` (opção C, escolhida pelo Johnny em 08/10/2026, com o pedido de deixar o balão em vermelho).
- Tela nova em `SCREENS` (`src/lib/routes.js`) com a trava `gestor`, e a palavra `rotinas` em `RESERVED_TENANT_SLUGS`.
- Endereços: `/<academia>/rotinas` (Modelos), `/<academia>/rotinas/hoje` e `/<academia>/rotinas/modelos/<id>` (dentro de um modelo). O id do modelo é aleatório e não leva dado pessoal.
- O item do menu entra pelo `sidebarNav` (`src/lib/sidebarNav.js`), que pergunta ao mesmo `canAccess` da rota.

### Aba Modelos

Mockup: `2026-10-06-tela-rotinas-gestor.html`, aba Modelos.

- **Título:** "5 de 6 consultores seguem um modelo. Bruno ainda está sem rotina." Com todos num modelo: "… Todos têm rotina."
- **Botão "Novo modelo"**, no topo à direita. É o único botão de criar modelo da tela.
- **Um cartão por modelo:** nome, "6 tarefas · 07:30 às 12:30 · 1 sem horário", a faixa do dia (de 07h a 21h, com um ponto por tarefa com horário) e quem segue ("Carla e Diego"). Modelo sem ninguém mostra "Ninguém segue este modelo". O cartão inteiro abre o modelo.
- **Lista "Consultores":** cada consultor com o modelo que segue, num seletor que troca ali mesmo ("Sem modelo" é uma das opções), e o link "Abrir modelo". A linha mostra "6 tarefas hoje · 07:30 às 12:30". Quem está sem modelo fica destacado, com "Sem rotina na Meta diária". A dica da seção diz: "Cada um segue um modelo. Trocar aqui muda a rotina da pessoa a partir de hoje."

### Novo modelo

Painel lateral com:

- **Nome do modelo**, com o exemplo "Ex.: Consultor do fim de semana".
- **Começar:** "Em branco" ou "Cópia de um modelo", com a escolha do modelo. "As tarefas são copiadas. Mudar a cópia não mexe no original."
- **Quem segue**, opcional. Cada pessoa mostra de qual modelo sai ("sai do Consultor da tarde") ou "sem modelo".
- Botão **Criar modelo**. Depois de criar, a tela abre o modelo novo.

### Dentro de um modelo

- Caminho "Modelos / Consultor da manhã" e o nome, com **Renomear**.
- **Duplicar modelo:** cria "Cópia de Consultor da manhã" com as mesmas tarefas e ninguém seguindo, e abre a cópia com o nome em edição.
- **Excluir modelo:** pede confirmação na própria tela: "Carla e Diego ficam sem rotina até você escolher outro modelo. O histórico dos dias anteriores continua."
- **Tarefas**, em ordem de horário, as sem horário num grupo embaixo. Cada uma com o nome, o "como fazer", a frequência, o selo "Pausada" quando for o caso e o botão **Editar**. Botão **Nova tarefa** no topo da lista.
- **Quem segue**, ao lado: as pessoas, com **Tirar**, e o seletor "Pôr um consultor neste modelo", que mostra de onde a pessoa sai.
- O aviso fixo: "O que você muda aqui vale a partir de hoje para quem segue o modelo. Os dias anteriores continuam como estavam no histórico."

### Nova tarefa e Editar tarefa

Painel lateral com nome, como fazer, em que dias, horário e, ao editar, **Pausar tarefa** (ou **Reativar tarefa**) e **Excluir tarefa**. O subtítulo diz onde a tarefa está e quem vê: "No modelo Consultor da manhã. Carla e Diego veem a mudança na Meta diária a partir de hoje."

Erros, embaixo do campo: "Escreva o nome da tarefa.", "Escolha pelo menos um dia.", "Escolha o horário." e, no modelo, "Escreva o nome do modelo." e "Já existe um modelo com esse nome."

Confirmações (toast): "Modelo criado.", "Modelo duplicado. Dê um nome e escolha quem segue.", "Modelo excluído. O histórico continua com ele.", "Nome salvo.", "Tarefa criada.", "Alterações salvas.", "Tarefa pausada.", "Tarefa reativada.", "Tarefa excluída. O histórico continua com ela.", "Carla agora segue o modelo Consultor da tarde." e "Carla ficou sem modelo."

### Aba Hoje

Mockup: `2026-10-06-tela-rotinas-gestor.html`, aba Hoje, **por pessoa**. A opção em quadro fica de fora.

- **Título:** "A equipe fez 7 de 26 tarefas da rotina até agora, e 4 estão atrasadas." Sem atrasadas: "… Nenhuma está atrasada."
- **A aba avisa quem está sem modelo** com o selo "1 sem modelo".
- **Um cartão por consultor**, com o nome, o modelo que segue (link para o modelo), a contagem "3 de 6", as barrinhas e as tarefas do dia no mesmo desenho do cartão da Meta, com a linha do agora. Tocar numa tarefa mostra o detalhe ao lado. O gestor não marca nem desmarca o check de ninguém.
- **Consultor sem modelo:** "Sem modelo. A Meta diária não mostra rotina para essa pessoa.", com o botão "Escolher modelo", que leva à aba Modelos.
- **Ao lado:** "Atrasadas agora", com quem, qual tarefa e "Era às 10:30, há 35 min", e "Observações de hoje", com quem, qual tarefa, a hora e o texto. Sem nada: "Ninguém com tarefa atrasada." e "Nenhuma observação até agora."

---

## Histórico no Operacional

Terceira parte da entrega. No Operacional (Visão geral → Operacional), com o mês, o filtro de pessoa e a comparação que a tela já tem:

- **Cartão "Rotina do mês":** quanto da rotina foi cumprido (feitas sobre devidas), quantas foram feitas depois do horário e as três tarefas que mais ficaram sem fazer.
- **Coluna "Rotina"** na tabela de pessoas do mês (`TeamMonthTable`), com o cumprimento de cada um.

A conta do mês usa os dias fechados, até ontem. O dia de hoje entra quando vira. Para cada dia e cada consultor, a tarefa devida sai da versão do modelo que valia naquele dia e da regra do dia. A feita sai dos checks.

As contas moram em `src/lib/operacional/`, puras e testadas, como o resto do Operacional. A carga entra no `src/hooks/monthSources.js`, junto das outras fontes do mês.

O detalhe desta parte (o desenho do cartão e as perguntas de comparação) é decidido no plano dela, com mockup, quando chegar a vez.

---

## Dados

Três coleções novas, dentro da academia, no caminho das outras (`artifacts/{appId}/public/data/`).

### `stronix_rotina_modelos/{modeloId}`

O modelo como está agora.

| Campo | Conteúdo |
|---|---|
| `name` | Nome do modelo. |
| `tasks` | Lista de tarefas: `id` (aleatório, fixo para sempre), `title`, `how`, `days` (`'all'` ou lista de 0 a 6, domingo é 0), `time` (`'HH:MM'` ou `null`) e `active`. |
| `followerIds` | Ids de `stronix_users` de quem segue. |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | Data do servidor e id de quem gravou. |

### `stronix_rotina_versoes/{modeloId}_{AAAA-MM-DD}`

A versão do dia, com `modelId`, `date`, `name`, `tasks`, `followerIds`, `deleted` (true quando o modelo foi excluído), `savedAt` e `savedBy`. Gravada no mesmo lote do modelo, sempre. Nunca é apagada.

### `stronix_rotina_marcas/{consultorId}_{AAAA-MM-DD}_{tarefaId}`

O check.

| Campo | Conteúdo |
|---|---|
| `consultantId`, `consultantAuthUid` | Quem fez. |
| `date` | O dia, na chave da Meta. |
| `modelId`, `taskId` | De onde veio a tarefa. |
| `taskTitle`, `taskTime` | O nome e o horário da tarefa na hora do check, para o histórico não depender do modelo. |
| `doneAt` | Hora do servidor no check. |
| `note` | Observação, até 140 caracteres, ou vazio. |

O id fixo faz o segundo toque no mesmo círculo cair no mesmo documento, então não existe check duplicado.

### Quem segue: um modelo só

A gravação que põe alguém num modelo lê os modelos dentro de uma transação, tira a pessoa do modelo anterior e grava os dois modelos e as duas versões do dia juntos. Duas abas do gestor gravando ao mesmo tempo não deixam ninguém em dois modelos.

---

## Regras do Firestore

- **Modelos e versões:** qualquer membro da academia lê, e só o gestor grava (`isAdmin`, `inTenant`, `tenantActive`), como os catálogos. Versão não se apaga.
- **Checks:** qualquer membro da academia lê, como o histórico da Meta.
  - **Criar:** só o próprio consultor, com `consultantAuthUid` igual ao uid, o cadastro de `consultantId` ligado ao mesmo uid (lido em `stronix_users`), o id no formato `{consultantId}_{date}_{taskId}`, o `doneAt` igual à hora do servidor e sem ser professor. Conferir o cadastro custa uma leitura por check, e isso impede alguém de criar o check de um colega com o próprio uid, o furo que o comentário do `stronix_daily_goal_history` descreve.
  - **Alterar:** só o dono, e só o campo `note`.
  - **Apagar (desfazer):** só o dono, até 24 horas depois do check. A tela só oferece desfazer no mesmo dia.
- As regras são publicadas antes do merge da primeira parte. Neste projeto elas vêm sendo publicadas no console ou pelo Firebase CLI, sempre com o ok do Johnny.

---

## Quando a equipe muda

- **Consultor novo:** começa sem modelo.
- **Consultor que vira professor ou é excluído:** sai do modelo que seguia. Isso é feito no servidor, nas ações `set-role` e `delete` do `api/admin-users.js`, que já devolvem as tarefas delegadas (`returnDelegatedTasks`), e grava a versão do dia do modelo. Não precisa de função nova na Vercel.
- **Professor que volta a consultor:** começa sem modelo, como o consultor novo.

---

## Leituras

- **Meta do consultor:** o modelo dele (`followerIds` contendo o id dele) e os checks dele de hoje (`consultantId` e `date`, duas igualdades que o Firestore resolve sem índice composto), as duas por assinatura.
- **Aba Modelos:** os modelos da academia, por assinatura. Costumam ser poucos.
- **Aba Hoje:** os modelos e os checks de hoje da academia (`date` igual a hoje).
- **Histórico:** as versões até o fim do mês escolhido e os checks do mês (`date` no intervalo, campo único).

Nenhuma consulta precisa de índice para publicar. A Vercel continua com 11 de 12 funções.

---

## Entrega em três partes

1. **Modelos, cartão na Meta e checks.** Coleções e regras, `src/lib/rotinas.js`, a tela Rotinas com a aba Modelos, Novo modelo, dentro do modelo, os painéis de tarefa, o cartão "Rotina de hoje" na Meta e a saída do modelo no `set-role` e no `delete`. Junto vai uma novidade no sino para os gestores. Com essa parte, a rotina já funciona.
2. **Aba Hoje.** A visão por pessoa, as atrasadas e as observações do dia.
3. **Histórico no Operacional.** O cartão "Rotina do mês" e a coluna na tabela de pessoas, com o plano e o mockup dessa parte.

---

## Fora do escopo

- Lembrete no sino ou notificação na hora da tarefa.
- "Não deu para fazer" com motivo.
- Frequência mensal ou por data.
- Rotina para professor e para gestor.
- O gestor marcar ou desmarcar o check de alguém.
- Folga, férias e falta do consultor. Num dia em que ele não trabalhou, as tarefas contam como não feitas. Fica para quando o sistema souber quem trabalhou em cada dia.
- A visão em quadro da aba Hoje.

### Limites aceitos

- Cada consultor segue um modelo só, e a gravação confere isso contra os modelos que a tela já tem. Um modelo criado em outra aba um instante antes, que a tela ainda não recebeu, fica fora da conta. Escolher o modelo de novo corrige.
- Tarefa que sai do modelo no mesmo dia em que foi marcada não conta no histórico daquele dia, porque o histórico usa a última versão do dia.
- A tarefa com horário fica atrasada 30 minutos depois do horário mesmo que o consultor esteja em atendimento. É o mesmo para todos, e a observação existe para explicar.

---

## Testes

- **`src/lib/__tests__/rotinas.test.js`:** a tarefa do dia (todos os dias de trabalho, dias escolhidos, pausada), os seis estados com a borda dos 30 minutos, a versão que vale num dia (antes da primeira versão, no dia da troca, depois da exclusão), a troca de modelo de uma pessoa e a conta do mês.
- **Cartão da Meta,** em jsdom: o check grava o documento no id certo, o Desfazer apaga, a observação salva só o `note`, e o cartão some para quem não segue modelo.
- **Gravação do modelo:** salvar escreve o modelo e a versão do dia juntos, a segunda gravação do dia troca a versão, e pôr a pessoa num modelo tira ela do outro.
- **Endereço:** `rotinas` reservado no `tenantSlug.test.js`, a tela nos testes de `routes.js` e do `sidebarNav`, e o consultor que abre `/rotinas` recebe o aviso de tela só do gestor.
- **`api/admin-users.js`:** virar professor e ser excluído tiram a pessoa do modelo, com a versão do dia.
