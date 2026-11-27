# Professor e faltosos, PR 2A: a importação · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O gestor da STRONIX importa toda segunda os relatórios Faltantes e Presenças da Next Fit pelo bloco Faltosos de Configurações → Metas & ritmo, e o Stronilead passa a guardar quem está faltando, desde quando, com qual professor, quem é urgente e as presenças de cada aluno. A aderência do perfil do professor passa a ler essas presenças, e o script `scripts/import-presencas.js` sai. Para quem não importa, a única coisa nova visível é a linha "Voltou a treinar" na ficha de quem voltou.

**Architecture:** As regras da importação moram em módulos puros em `src/lib/faltosos/`, sem Firebase e testados em node: a leitura das planilhas, a ligação de professores e alunos, os marcos, o urgente, a configuração e o plano da importação, que recebe tudo o que foi lido e devolve tudo o que será gravado. A gravação (`gravarImportacao.js`, SDK do navegador) relê os estados, refaz o plano e grava em lotes de até 500, com ids fixos, deixando o registro e a `ultimaImportacao` por último. O App assina `stronix_config/faltosos` só com o módulo `faltosos` ligado e entrega a configuração pelo `GeneralConfigContext`. O bloco Faltosos de Configurações mostra a última importação, edita as regras e abre a janela de importação, que carrega à parte. As regras do Firestore deixam só o gestor gravar nas três coleções novas e em `stronix_presencas`, que já existia, e já cobrem o que o 2B e o 2C vão ler. A aderência do perfil do professor (`useProfessoresDados`) lê os documentos por mês de `stronix_presencas` e soma os dias por semana (`presencasPorSemana`), no lugar dos documentos semanais do script.

**Tech Stack:** React 19, Vite, Firebase (Firestore no navegador), SheetJS (`readSpreadsheetFile`), shadcn/ui, Vitest (node e jsdom).

**Spec:** `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md` (o comportamento, aprovada pelo Johnny em 02/10/2026) e `docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md`, seção "2A: a importação" (a divisão do PR 2 em três partes, combinada com o Johnny em 16/10/2026). Este plano sai do plano antigo do PR 2, de 05/10/2026 (`git show da9d7e3:docs/superpowers/plans/2026-10-05-professor-pr2.md`): as Tasks 1 a 7 e 10 dele, a assinatura da configuração da Task 8 e o bloco de Configurações da Task 13, reaplicados sobre a main de 16/10 e de novo sobre a de 26/11/2026, quando entrou também a Task 7A (a aderência, decisão D7, combinada com o Johnny em 26/11). A versão de 16/10 está no commit `4e95e8b` da branch `claude/professor-pr2a-importacao`. A aba Faltosos (2B) e as peças da ficha (2C) terão planos próprios. Os cabeçalhos e os formatos das planilhas estão em `docs/superpowers/specs/2026-10-02-professor-e-faltosos-levantamento.md`.

**Repositório, branch e base:** `~/STRONIX-FIRMA/06-sistemas/stronilead`, worktree `.claude/worktrees/daily-goal-teacher-feature-144c62`, branch `claude/professor-pr2a-v2`, criada da main em `e8423e2`. O commit a mais na branch traz a spec das três partes, com o adendo de 26/11, e este plano. As linhas citadas são as de `e8423e2`, e os caminhos são relativos à raiz do worktree. Quando uma task mexe num arquivo que uma task anterior já mudou, procure pelo trecho citado e não pelo número da linha.

**Como o plano foi conferido:** em 26/11/2026 o plano foi aplicado numa cópia limpa de `e8423e2` (`git worktree add --detach`), na ordem das tasks, por um script que tira do próprio plano cada bloco "Criar", cada par "trocar" e "por" (conferindo que o trecho a trocar aparece uma vez só no arquivo) e cada "acrescentar no fim do arquivo". Depois de cada task rodou a suíte inteira e os blocos de commit da task, e cada commit deixou a árvore limpa. Os totais do fim de cada task estão em "Como as tasks se encaixam". No fim, 384 arquivos e 7345 testes passando (a base tem 366 e 6992), o lint igual ao da base, o build sem erro e o `verificar:sentry` passando. Os testes de `src/lib/faltosos/` passam também em UTC e no fuso de Tóquio. Os "Run:" que leem testes que já existiam foram rodados de novo, e o "Expected:" deles foi acertado para a main de 26/11. Os seis `grep` da Task 11 (Step 1) acharam uma linha cada. Os passos que dependem de dado ou de tela (o roteiro do Preview da Task 14 e o Rules Playground da Task 7) foram conferidos na versão de 16/10 e não rodaram de novo. Ninguém abriu o bloco nem a janela num navegador.

**Git:** o git desta máquina está sem `user.name`. Todo commit usa `git -c user.name="Johnny Bittencourt" commit -m "<tipo>: <descrição>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Não mude a configuração do git.

**Regras do projeto que valem aqui** (do `CLAUDE.md` e da spec):
- Os módulos de `src/lib/faltosos/` são puros, sem pacote, sem Firebase e sem tela, e têm teste em node. Só dois falam com o Firestore: `lerImportacao.js` (a leitura da base, na janela de importação, Task 10) e `gravarImportacao.js` (a gravação, Task 5). O `faltosos.imports.test.js` (Task 4) segue os imports do motor e barra pacote, Firebase e tela.
- Ninguém lê dado de aluno de produção para escrever código ou teste. As planilhas de verdade, com nome e telefone de aluno, nunca entram no repositório nem no rascunho da sessão: os testes usam planilhas falsas com o mesmo cabeçalho.
- A importação roda no navegador. Nada de função nova na Vercel: continuam 11 de 12.
- As regras do Firestore são publicadas à mão pelo Johnny no console, depois dos cenários do Playground da Task 7 e antes do merge.
- Toda chamada nova de `hasModule` no `firestore.rules` passa `'faltosos'` por extenso, porque o `modules.test.js` confere.
- Em `src/`, `snap.exists()` é função.
- UI nova usa shadcn ou as peças da casa (`SettingsPanel`, `SettingsBtn`, `FormDialog` em Configurações), `cn()`, tokens semânticos, `flex gap-*` e `size-N`. O foco pelo teclado é `focus-visible:anel-foco`: o anel antigo, `focus-visible:ring-brand-500/40`, é reprovado pelo `anelDeFoco.test.js`. Borda de primitivo shadcn leva `border-border`.
- Textos em português, diretos, sem travessão no meio da frase e sem aspas curvas.
- Trabalho por PR, nunca commit na main. O merge é do Johnny.

---

## Decisões tomadas neste plano

A spec não cobria estes casos, ou deixava mais de um caminho. As tasks citam cada decisão pelo código da primeira coluna. Os códigos M, D, F e T vêm do plano antigo, com o mesmo texto, menos os que só valem para a aba e para a ficha (F1, F2, F4, T1, T2 e T3), que ficam com os planos do 2B e do 2C. Os códigos A são da divisão em três partes. As decisões que mudam o que a academia vê (C1 a C7) estão em "Pontos que dependem do Johnny", logo abaixo, com o que muda se ele decidir diferente.

| | Caso | Decisão |
|---|---|---|
| M1 | Que horas são para o urgente | `urgenteDe` e `planejarImportacao` recebem `agora` (uma `Date`), e não o dia, porque `deriveLeadContractStatus` compara instantes. |
| M2 | O que o plano da importação recebe e devolve | Além do que a spec lista, ele recebe as presenças já gravadas, os professores e as ligações feitas à mão, e devolve a recusa, se está pronto para gravar, os nomes novos de professor, as voltas desfeitas, os nomes dos alunos, a configuração e o registro. |
| M3 | Importação com um arquivo só | A `ultimaImportacao` repete a data do Faltantes ou o período do Presenças da importação anterior, para o lembrete e a recusa do Faltantes velho continuarem certos. Ela ganha `dataFaltantesAnterior` e `ultimoDiaPresencas`. |
| M4 | De que período é a tarefa | A tarefa guarda o `inicioFalta` do período em que nasceu. |
| M5 | O bloco "em uso" no urgente | Não entra. Com C1, o urgente nunca lê o bloco, e o `src/lib/contracts.js` não muda. |
| M6 | A última presença de quem aparece nas duas planilhas | Vale a maior entre a do Faltantes, a de qualquer dia do Presenças até a data do Faltantes e a guardada. |
| M7 | Onde fica o cabeçalho | Na primeira linha do arquivo, sem título em cima, como nas planilhas de 02/10. |
| D1 | Onde mora a gravação | Os lotes saem de um módulo puro (`lotesImportacao.js`), e só o `gravarImportacao.js` fala com o Firestore, no molde de `funnelSetup.js` e `funnelSetupWrites.js`. |
| D2 | Ids | A linha "Voltou a treinar" é `stronix_interactions/volta_{leadId}_{inicioFalta}`. O registro da importação é `f{data do Faltantes}_p{de}_{ate}`, ou só a parte do arquivo que veio. Os quatro caminhos novos e o `CONFIG_FALTOSOS_ID` ficam em `src/lib/firebase.js`. |
| D3 | O lead | A importação nunca grava em `stronix_leads` e congela a academia ao abrir a janela. |
| D4 | Ordem da gravação | Primeiro as ligações. Cada aluno é uma unidade que não se divide entre lotes (estado, linha de volta ou volta desfeita, meses de presença). O registro e o `stronix_config/faltosos` vão por último, num lote só. Cada lote tem até 500 gravações. Antes de gravar, a gravação relê os estados e refaz o plano, para não sobrescrever uma tarefa que mudou depois da prévia, e o registro guarda os números da prévia confirmada. |
| D5 | A linha "Voltou a treinar" | Tipo `presence_return`, no filtro Marcos com o rótulo "Presença", visível sem o interruptor Sistema. Não conta como "Já interagido hoje" nem como primeiro contato do Dashboard CRM, não soma `interactionsCount` e não toca o lead. A hora da linha é a da importação, e o dia da volta vai no texto. |
| D6 | Regras | Três blocos novos depois de `stronix_aulas` e o de `stronix_presencas` trocado (D7), uma linha `allow` por operação, sem `delete`. `stronix_config` e `stronix_interactions` ficam como estão, e o professor continua sem criar `presence_return`. |
| D7 | `stronix_presencas` e a aderência | A coleção já existia, da aderência do perfil do professor, com um documento por aluno e semana gravado pelo `scripts/import-presencas.js` a partir do relatório "Presenças por contrato" (só funcional). Decisão do Johnny em 26/11/2026: a importação do 2A alimenta a aderência e o script sai. A coleção passa a ter um documento por aluno e mês, com os dias, e o gestor grava pela tela. A aderência soma os dias de segunda a sexta com presença, pela catraca ou pela agenda, em qualquer modalidade (`presencasPorSemana`, Task 7A). Os documentos semanais antigos não têm `mes`, ficam fora da leitura e continuam no banco. |
| F3 | O bloco Faltosos | Painel próprio (`FaltososPanel`), só para o gestor com o módulo, que grava `stronix_config/faltosos` campo a campo, com merge. A janela do urgente aceita número ou texto com número. |
| T4 | Leitura da configuração | O App assina `stronix_config/faltosos` só com o módulo e entrega como `faltosos` no `GeneralConfigContext`, com a academia junto do que foi lido. A leitura de `stronix_faltosos` pela aba é do 2B. |
| T5 | A janela de importação | Quatro passos: Arquivos, Professores (só com nome novo), Prévia (com ligação à mão) e Gravação (com "Tentar de novo"). A base é lida do servidor, com a academia congelada na abertura, e a janela carrega à parte, só quando é aberta. |
| A1 | Onde a importação começa | No bloco Faltosos de Configurações → Metas & ritmo, que só o gestor com o módulo vê. O botão "Importar planilhas" fica no cabeçalho do bloco, e o bloco mostra também a última importação (quem fez, quando, a data do Faltantes e o período do Presenças) e o lembrete de como exportar. O 2B põe o mesmo botão no topo da aba, abrindo a mesma janela. |
| A2 | Pasta da janela | `src/views/faltosos/importacao/`, e não `src/views/clientes/importacao/` como no plano antigo, porque ela abre de Configurações e o 2B vai abrir a mesma janela de Clientes. A pasta tem a mesma profundidade, então os imports de dentro dos arquivos não mudam. |
| A3 | `abaFaltosos.js` no 2A | Nasce só com `importaFaltosos`, `resumoDaUltimaImportacao` e `lembreteExportacao`, com os nomes e os testes do plano antigo, porque o bloco e a janela usam essas três. O 2B acrescenta o resto no mesmo arquivo e no mesmo teste. |
| A4 | Configuração que não deu para ler | O bloco mostra só "Não deu para ler a configuração dos faltosos. Recarregue a página.", sem o botão e sem os campos, para ninguém importar nem editar em cima do padrão. No plano antigo, quem dizia isso era a aba. |
| A5 | Textos da janela sem a aba | A prévia diz que a ligação à mão fica guardada para as próximas importações e que quem fica sem ligação continua de fora, e o fim da gravação aponta para o bloco e para a ficha de quem voltou. O plano antigo mandava para a aba Faltosos. |

## Pontos que dependem do Johnny

O plano segue o caminho descrito em cada ponto. Qualquer um pode mudar antes do merge, e cada um diz o que muda.

### Decisões que mudam o que a academia vê

**C1. Renovação já marcada tira o aluno do urgente.** O urgente olha o fim do último contrato, que, com a renovação marcada, é o fim da renovação. Quem já renovou não fica urgente: na prévia ele não conta como urgente e, quando a aba (2B) e o selo (2C) chegarem, ele fica na faixa dos dias, com "Até" a data da renovação, e o selo da ficha fica âmbar. O `src/lib/contracts.js` não muda (decisão M5). Lead com renovação marcada antes de 30/09/2026 não tem o bloco "em uso", aparece como agendado em Clientes, e a importação o trata como sem contrato ativo. Se você quiser o urgente pelo fim do contrato em uso, mesmo com a renovação assinada, o `urgente.js` volta a ler o bloco "em uso", o `contracts.js` passa a exportar a regra que diz quando esse bloco decide (o `inUseBlockDecides`, que a decisão M5 deixou de fora) e os testes do urgente e do selo mudam.

**C2. Volta desfeita.** Se um aluno marcado como "voltou" (sem dia) reaparece no Faltantes com a mesma última presença, a linha "Voltou a treinar" é apagada e o período de falta reabre, sem deixar rastro na ficha. Se você quiser guardar o histórico do engano, a importação passa a gravar uma linha nova de correção em vez de apagar, o que pede um tipo ou um texto novo na linha do tempo.

**C3. Telefone trocado no Stronilead.** O aluno que seria marcado "voltou" sem dia, mas cujo nome aparece numa linha do Faltantes que não ligou, continua faltando e vai para a prévia como "provável mesma pessoa", até alguém ligar a linha à mão. O preço: se um homônimo que não é o aluno estiver no Faltantes sem ligar, o aluno que voltou de verdade continua faltando enquanto essa linha aparecer. Se você preferir, o plano volta a marcar "voltou" nesse caso (e a falta real de quem trocou de telefone some da lista), ou liga sozinho pelo nome (e corre o risco do homônimo).

**C4. Telefone que acha outra pessoa (a mãe, por exemplo).** A ligação pelo telefone só vale com o primeiro nome igual ou com duas palavras do nome em comum; senão a linha vai para os ambíguos, para ligar à mão. O preço: o filho que não é cliente e usa o telefone da mãe cliente aparece nos ambíguos toda semana até ser ligado à mão (ou para sempre, se ele não é cliente no Stronilead). Em troca, ele nunca vira faltoso no lugar da mãe. Se você quiser ligar só pelo telefone, a lista fica mais curta, mas a mãe pode receber a falta do filho.

**C5. Trocar a ligação de um professor da Next Fit em Configurações vale a partir da próxima importação.** Os alunos já importados ficam com o professor que tinham até lá, e a nota do bloco e o aviso dizem isso. Importar de novo as mesmas planilhas aplica a troca na hora, porque a importação é idempotente. Se você quiser que a troca valha no mesmo clique, o bloco passa a atualizar os `stronix_faltosos` daquele nome, o que mexe no dono da tarefa pendente, assunto do PR 3.

**C6. A aba Faltosos mostra o urgente gravado na importação; só a ficha recalcula ao abrir.** Assim os grupos da aba batem com a prévia e com a Meta do professor. O preço: quem renovou depois da importação, ou uma janela trocada em Configurações, aparece urgente na aba e não urgente na ficha até a importação seguinte. Se você preferir que a aba recalcule com os clientes que ela já lê, a aba e a ficha concordam, mas a aba deixa de bater com a prévia e com a tarefa gravada. No 2A, o urgente gravado só aparece na prévia, e esta escolha passa a valer com o 2B e o 2C.

**C7. Uma linha de volta por aluno em cada importação.** O plano grava no máximo uma linha "Voltou a treinar" por aluno em cada importação, a do período mais recente. O aluno que voltou entre duas importações, sumiu de novo e voltou outra vez depois do Faltantes fica só com a última volta na linha do tempo, e a gravação recusa um plano com duas. Se você quiser as duas linhas (uma por período), a gravação passa a aceitar mais de uma por aluno, cada uma com o id do seu período, e a lista "Quem voltou" da prévia precisa de outra chave.

### Antes do merge

1. **Regras sem validador.** Ninguém rodou as regras novas num validador do Firebase. A Task 7 traz a conferência no editor do console e os cenários do Rules Playground (gestor, consultor e professor, com o módulo ligado e desligado), que precisam passar antes de publicar e antes do merge.
2. **Leituras das regras por lote.** Cada gravação de um lote de até 500 confere nas regras os mesmos dois documentos (a academia e o cadastro do gestor). O Firestore limita a 20 leituras por pedido e não conta de novo a leitura repetida do mesmo documento, e a importação de clientes já grava lotes de 450 assim (`src/lib/clientImportWrites.js:17`). O teste no Preview (Task 14, Step 4) confirma isso: a importação da semana 1 de lá grava mais de 40 documentos no primeiro lote (43 ou 44, conforme os meses que o Presenças cruza).
3. **Conferência visual.** Falta ver num navegador, no claro e no escuro, o bloco Faltosos (com e sem importação) e a janela nos quatro passos, também em 375 px (o celular está em segundo plano desde 28/09).

### A linha "Voltou a treinar"

4. **Hora da linha.** Ela nasce com a hora da importação, e o dia da volta vai no texto. A volta de 03/10 importada em 06/10 aparece no dia 06/10, acima de um contato registrado em 04/10.
5. **Autor da linha.** Sai no nome de quem importou, como na importação de clientes. A outra opção é "Sistema", para o professor não achar que o gestor registrou a volta à mão.
6. **Silêncio do card do cliente.** A linha entra no índice que os cards usam para contar os dias sem contato (`buildInteractionIndex`). Nos quadros de Renovações, Vencidos e Upgrade, o cliente que voltou passa a mostrar o silêncio contado a partir da importação, como já acontece com a importação de clientes. Tirar a volta desse índice é uma linha, fora deste PR.
7. **O consultor consegue criar uma linha `presence_return` pelo SDK**, como já consegue criar `import` e `zap_signup`, e ela apareceria na ficha como "Voltou a treinar". O plano não trava isso, porque mudaria o bloco de interações do PR 1.
8. **A linha fica com o módulo desligado.** Ela é uma interação, e as regras de `stronix_interactions` não olham o módulo. Desligar o módulo esconde o bloco e fecha as coleções novas, mas a linha "Voltou a treinar" que já foi gravada continua na ficha.

### A importação

9. **Outra importação com a janela aberta.** A gravação para e pede para importar de novo quando a última importação gravada mudou desde que a janela abriu. É uma trava a mais que o contrato não pedia, e custa uma leitura a mais por importação.
10. **Importação refeita depois de uma falha, com a janela fechada.** A prévia nova é calculada sobre o que a tentativa anterior já gravou, então os números da prévia e do registro saem menores que os da primeira tentativa. O que vai para cada aluno fica certo. Com a janela aberta, o "Tentar de novo" guarda os números da primeira prévia.
11. **Dois Faltantes soltos juntos na janela:** o último vence, sem aviso. Dá para recusar o segundo com uma frase, se preferir.
12. **Custo da leitura.** A janela lê os cerca de 600 clientes, todos os estados de falta, todos os nomes guardados e as presenças dos meses do arquivo, uma vez por importação, e a gravação relê os estados no Confirmar. Se crescer muito, dá para ler só os estados "faltando" mais os dos alunos do arquivo, em lotes de 30.
13. **Linha do Faltantes com a última presença depois da data do arquivo** fica fora do estado. Só acontece em arquivo editado à mão, e o aviso de datas divergentes já aparece.
14. **Perguntas que continuam abertas.**
    - O Faltantes conta a presença da agenda? Se não contar, o aluno só de pilates ou funcional aparece toda semana, e só o Presenças importado junto o tira da lista. Conferir na primeira importação do Preview com um aluno assim.
    - Professor da Next Fit ligado a um professor que ficou inativo não gera aviso.
    - O `tarefa.criadaEm` é texto `AAAA-MM-DD`; o PR 3 decide se quer instante.
    - A "semana" da Meta do professor (PR 3) deve sair do `ultimaImportacao.dataFaltantes`, e não do `id`, porque uma importação só do Presenças troca o id.
    - Aluno no Faltantes com menos dias que o menor marco ganha estado "faltando" sem tarefa.

### Configurações e regras

15. **Quem lê o quê.** As regras deste PR já valem para o 2B e o 2C. Todo membro lê o estado e as presenças do aluno, porque o selo da ficha e a aba Presenças serão de todos: o consultor também vai ver "Sem vir há X dias". Só o gestor lê o registro das importações (que traz nome e telefone de quem não foi achado) e os nomes da Next Fit. Com o módulo desligado, ninguém lê nada disso, e os dados ficam onde estão.
16. **Duas gravações da lista de professores.** A importação grava o `professorLinks` com os nomes novos, e o bloco de Configurações grava a lista inteira com um nome trocado. Se as duas acontecerem juntas, a última vence e pode desfazer a outra ligação. É raro (só o gestor faz as duas) e não perde aluno.
17. **Escolhas de tela.** A escolha do professor no bloco é um `<select>` nativo, como no PR 1, e o botão "Importar planilhas" é o `SettingsBtn` principal das Configurações. O documento `stronix_config/faltosos` usa `updatedAt`, como o `general`, enquanto as coleções novas usam nomes em português (`atualizadoEm`). O id do mês de presença (`{leadId}_{AAAA-MM}`) é montado na importação, e a aba Presenças do 2C vai montar o mesmo.

### Pontos conhecidos da divisão em três partes

18. Entre o 2A e o 2B, a Meta do professor diz "Sua lista de faltosos aparece aqui depois da primeira importação.", e a lista ainda não aparece. O professor não perde nada, porque a lista também não existia antes.
19. Entre o 2A e o 2B, os alunos não ligados aparecem só na prévia e no registro da importação. A lista Não achados é da aba.
20. A importação grava as tarefas de cada marco desde o 2A, e ninguém age sobre elas até o PR 3, como já estava no plano antigo.
21. Os pontos C1 a C7 continuam abertos para o Johnny e valem para o 2A. Ele preferiu refazer o plano antes de decidir sobre eles (26/11/2026).
22. A correção do professor na importação de clientes (branch `claude/importacao-professor-nome`) fica fora deste trabalho.

### A aderência (D7)

23. **O que conta como presença na aderência.** Um dia de segunda a sexta com qualquer presença no relatório Presenças, pela catraca ou pela agenda, em qualquer modalidade. O aluno do Flow que vem só à musculação conta para o professor de pilates, porque a catraca não diz para que aula a pessoa veio. Contar só a agenda da modalidade do professor exigiria ligar o nome da modalidade da Next Fit ao catálogo do Stronilead, e a musculação, que não tem agenda, ficaria sem aderência. Se você quiser assim, é uma mudança no `presencasPorSemana` e uma tabela de nomes nova em Configurações.
24. **Os números de novembro mudam.** Hoje a aderência de novembro vem do "Presenças por contrato", só funcional. Depois da primeira importação ela vem do Presenças, com a catraca. Os professores de musculação e de pilates passam a ter número.
25. **Os documentos semanais do script ficam no banco** (154 de 63 alunos, gravados em 25/11/2026). Eles não têm o campo `mes` e ficam fora da leitura. Apagar pede um script com o Admin SDK, e o plano não faz isso.
26. **A primeira semana da importação.** A aderência usa toda semana que tem alguma presença importada, como antes. Se o primeiro Presenças começar no meio da semana, essa semana sai com menos dias. O Step 5 da Task 14 pede o primeiro Presenças desde a segunda-feira 02/11/2026.

## Mapa de arquivos

| Task | Cria | Muda |
|---|---|---|
| 1 | `src/lib/faltosos/dias.js`, `src/lib/faltosos/nextfitArquivos.js` | |
| 2 | `src/lib/faltosos/ligacaoAlunos.js`, `src/lib/faltosos/ligacaoProfessores.js` | `src/lib/__tests__/historicoDoProfessor.sweep.test.js` (a lista de revisados, também nas Tasks 4, 5, 10 e 11) |
| 3 | `src/lib/faltosos/marcos.js`, `src/lib/faltosos/urgente.js`, `src/lib/faltosos/configFaltosos.js` | |
| 4 | `src/lib/faltosos/planoImportacao.js` | |
| 5 | `src/lib/faltosos/lotesImportacao.js`, `src/lib/faltosos/gravarImportacao.js` | `src/lib/firebase.js` (quatro caminhos e `CONFIG_FALTOSOS_ID`), `src/lib/leads.js` (`PRESENCE_RETURN_TYPE`) |
| 6 | | `src/lib/leads.js`, `src/lib/timeline.js`, `src/lib/crm/contact.js` |
| 7 | | `firestore.rules`, `src/lib/__tests__/npsRules.test.js` |
| 7A | | `src/lib/professor/aderencia.js`, `src/hooks/useProfessoresDados.js`, `src/lib/__tests__/professorContasImports.test.js`; apaga `scripts/import-presencas.js`, `src/lib/professor/presencas.js` e `src/lib/__tests__/professor.presencas.test.js` |
| 8 | | `src/contexts/GeneralConfigContext.jsx`, `src/App.jsx` |
| 9 | `src/lib/faltosos/abaFaltosos.js` (só os textos da importação e quem importa) | |
| 10 | `src/lib/faltosos/passosImportacao.js`, `src/lib/faltosos/lerImportacao.js`, `src/views/faltosos/importacao/` (`ImportarPlanilhasDialog.jsx`, `PassoArquivos.jsx`, `PassoProfessores.jsx`, `PassoPrevia.jsx` e `PassoGravacao.jsx`) | |
| 11 | `src/lib/faltosos/configuracoes.js`, `src/views/settings/FaltososPanel.jsx` | `src/views/settings/PaceSection.jsx`, `src/views/settings/SettingsView.jsx` (uma linha) |
| 12 | | `CLAUDE.md` |

Testes novos, em `src/lib/__tests__/`: `faltosos.dias.test.js`, `faltosos.nextfitArquivos.test.js`, `faltosos.ligacaoAlunos.test.js`, `faltosos.ligacaoProfessores.test.js`, `faltosos.marcos.test.js`, `faltosos.urgente.test.js`, `faltosos.configFaltosos.test.js`, `faltosos.planoImportacao.test.js`, `faltosos.imports.test.js`, `faltosos.lotesImportacao.test.js`, `faltosos.gravarImportacao.test.js`, `faltososRules.test.js`, `faltososApp.test.js`, `faltosos.abaFaltosos.test.js`, `faltosos.passosImportacao.test.js`, `faltosos.lerImportacao.test.js`, `importarPlanilhasDialog.test.js`, `faltosos.configuracoes.test.js` e `faltososPanel.test.js`. Testes que mudam: `crm.contact.test.js`, `leads.test.js`, `timeline.test.js`, `npsRules.test.js`, `historicoDoProfessor.sweep.test.js`, `professor.aderencia.test.js` e `professorContasImports.test.js`. Teste que sai: `professor.presencas.test.js`.

O que fica para depois, nos mesmos arquivos ou ao lado:
- **2B:** o endereço `/clientes/faltosos` e o filtro `prof` (`src/lib/routes.js`, `src/lib/screenParams.js`), o `canSeeFaltosos` (`src/lib/acesso.js`), a aba (`src/views/clientes/`, `src/hooks/useFaltosos.js`, `src/hooks/useRegistroDaImportacao.js`), o resto do `abaFaltosos.js`, o mesmo botão no topo da aba e a Meta do professor levando à aba (`src/views/ProfessorGoalPlaceholder.jsx`).
- **2C:** a aba Presenças e o selo da ficha (`src/lib/faltosos/presencasFicha.js`, `src/lib/faltosos/seloSemVir.js`, os hooks e componentes deles, `src/lib/fichaState.js`, `FICHA_TABS` e `src/views/LeadProfileView.jsx`).

### Como as tasks se encaixam

A ordem das tasks importa, e nenhuma usa código de uma task posterior.

- As Tasks 1 a 4 são o motor: só criam arquivos novos em `src/lib/faltosos/` e testes. A 4 junta as funções das Tasks 1 a 3 no `planejarImportacao` e exporta também os ajudantes dos ids, `idDaImportacao` e `idDaVolta`.
- A 5 grava o que a 4 planeja. Ela põe em `src/lib/firebase.js` os caminhos `FALTOSOS_PATH`, `PRESENCAS_PATH`, `IMPORTACOES_NEXTFIT_PATH` e `NEXTFIT_ALUNOS_PATH` e o `CONFIG_FALTOSOS_ID`, e em `src/lib/leads.js` o `PRESENCE_RETURN_TYPE`, que a 6 usa na linha do tempo e nas exclusões.
- A 7 muda só o `firestore.rules`. A validação no console e o Rules Playground do fim dela são do Johnny, antes do merge (Task 14).
- A 8 entrega a configuração do módulo como `faltosos` no `GeneralConfigContext`, normalizada pelo `normalizarConfigFaltosos` da Task 3, com `pronta` e `erro`. A 10 e a 11 leem dali, pelo `configDasTelas`.
- A 9 cria o `abaFaltosos.js` com os textos da última importação, o lembrete de exportação e o `importaFaltosos`. A janela (Task 10) usa o lembrete, e o bloco (Task 11) usa os três.
- A janela (Task 10) chama `gravarImportacao({ db, tenant, plano, replanejar, ultimaImportacaoLida, quem, onProgress })`, da Task 5, e mostra a mensagem do erro `outra-importacao`.
- A 11 monta o bloco Faltosos em Metas & ritmo e põe nele o botão "Importar planilhas", que carrega a janela da Task 10 com `React.lazy`.
- O `registro.naoLigados` é a lista `[{ nome, telefone | null, relatorio: 'faltantes' | 'presencas' }]`: a 4 monta e a 5 grava. Quem lê é a aba do 2B, nos Não achados.

- A 7A troca a leitura da aderência do perfil do professor: o `useProfessoresDados` lê os documentos por mês que a 5 grava, e o `presencasPorSemana` os entrega ao `aderenciaPorSemana`, que não muda. Ela apaga o `scripts/import-presencas.js` e o leitor dele.

Totais da suíte inteira depois de cada task, conferidos em 26/11/2026 sobre `e8423e2` (366 arquivos e 6992 testes): Task 1, 368 arquivos e 7028 testes; Task 2, 370 e 7069; Task 3, 373 e 7107; Task 4, 375 e 7180; Task 5, 377 e 7234; Task 6, 377 e 7242; Task 7, 378 e 7261; Task 7A, 377 e 7255; Task 8, 378 e 7259; Task 9, 379 e 7263; Task 10, 382 e 7308; Task 11, 384 e 7345.

### Task 0: Preparação

**Files:** nenhum.

- [ ] **Step 1: Conferir o worktree e a branch**

Run: `git branch --show-current && git status --short`
Expected: `claude/professor-pr2a-v2` e nenhuma linha de arquivo mudado.

- [ ] **Step 2: Conferir se a main andou**

Run: `git fetch origin && git rev-list --count HEAD..origin/main`
Expected: `0`.

Se vier mais que zero, confira se a main mexeu em algum arquivo que este plano muda:

Run: `git diff --stat HEAD...origin/main -- firestore.rules src/App.jsx src/contexts/GeneralConfigContext.jsx src/lib/crm/contact.js src/lib/firebase.js src/lib/leads.js src/lib/timeline.js src/lib/professor/ src/hooks/useProfessoresDados.js scripts/import-presencas.js src/views/settings/PaceSection.jsx src/views/settings/SettingsView.jsx src/views/settings/settingsBits.jsx src/components/ui/SettingsCard.jsx src/lib/__tests__/ CLAUDE.md`

Faça o merge com `git -c user.name="Johnny Bittencourt" merge origin/main`. Se algum desses arquivos mudou, releia os trechos citados nas tasks antes de aplicar cada uma.

- [ ] **Step 3: Dependências**

Run: `npm install && git status --short package-lock.json`
Expected: o `npm install` termina sem erro (o resumo do `npm audit` no fim é o de sempre) e o `git status` não mostra o `package-lock.json`. O `node_modules` do worktree já ficou para trás da main antes, e é isso que este passo pega.

- [ ] **Step 4: Linha de base dos testes**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files  366 passed (366)` e `Tests  6992 passed (6992)`, os números de `e8423e2`. Se a main andou no Step 2, os números mudam: anote os que aparecerem. Se algum teste já falhar antes de qualquer mudança, anote qual é, para não confundir com quebra nova.

- [ ] **Step 5: Linha de base do lint**

Run: `npx eslint . 2>&1 | tail -3`
Expected: `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `src/views/superadmin/SuperAdminView.jsx`. A Task 13 confere que o total não aumentou.

Não há commit nesta task.

---

### Task 1: Dias e leitura das planilhas (`src/lib/faltosos/dias.js`, `src/lib/faltosos/nextfitArquivos.js`)

**Files:**
- Create: `src/lib/faltosos/dias.js`
- Create: `src/lib/faltosos/nextfitArquivos.js`
- Test: `src/lib/__tests__/faltosos.dias.test.js` (novo)
- Test: `src/lib/__tests__/faltosos.nextfitArquivos.test.js` (novo)

Notas:
- Os dois arquivos são puros e sem pacote, porque o motor roda em node nos testes e no navegador na importação. O `dias.js` importa `api/_horarioDeBrasilia.js` (puro e sem import, como o `api/_zapPhone.js` que `src/lib/leadDerived.js:10` já importa) e `src/lib/dates.js`. O `nextfitArquivos.js` importa `normalize` de `src/lib/globalSearch.js` (que só puxa `guardian.js` e `dates.js`) e o `dias.js`. Quem cobra isso é a varredura da Task 4 (`faltosos.imports.test.js`).
- Dia é texto `AAAA-MM-DD`. A conta entre dois dias é feita sobre o texto, com `Date.UTC`, e não depende do fuso. Só "hoje" (`hojeEmBrasilia`) e o fim do contrato (`diaEmBrasilia`, que recebe `Date`, Timestamp ou texto pelo `getSafeDateOrNull`) passam pelo calendário de Brasília (`diaDeBrasilia` e `isoDoDia`, `api/_horarioDeBrasilia.js:46-69`).
- `dataCurta(dia, hojeDia)` serve à ficha (o PR 2C): "02/10", com o ano quando ele é outro. Os casos dela estão no `faltosos.dias.test.js`.
- `nomeChave` é a chave de texto do cabeçalho e dos nomes: a mesma conta do `normalizeHeader` (`src/lib/importTemplate.js:16-17`), que não dá para importar porque `importTemplate.js` puxa o `clientImport.js` inteiro. Ela mora aqui, e não em `ligacaoAlunos.js`, porque esta task não pode usar código da Task 2. A Task 2 reexporta, e `import { nomeChave } from './ligacaoAlunos.js'` vale como o contrato escreve.
- O leitor recebe o que `readSpreadsheetFile` (`src/lib/spreadsheetRead.js:50-75`) devolve: `headers` (sem vazios) para o `detectReport` e `rows` (objetos pelo cabeçalho, com `__row`) para os dois `parse`. O `XLSX.read` usa `cellDates: true, raw: true` (`:55-56`): no `.xlsx`, a célula de data chega como `Date` com o relógio da célula nos getters locais (o mesmo que o `parseImportDate` de `clientImport.js:76-77` já lê); no CSV, chega texto. O número de série do Excel também é aceito.
- M7: o cabeçalho vem na primeira linha do arquivo, sem título em cima (conferido nas planilhas de 02/10). O `readSpreadsheetFile` toma a primeira linha preenchida como cabeçalho, então nada muda no leitor.
- `detectReport` pede todas as colunas do relatório e ignora caixa, acento, espaço, ordem e coluna a mais. O relatório Acessos e o arquivo com as colunas dos dois relatórios dão null, e a tela mostra `NAO_E_DA_NEXTFIT`.
- Linha que não dá para ler vai para `erros` (`{ numero, nome, motivo }`), que a prévia mostra e que não barram a importação. O `numero` é o da linha na planilha.
- Os testes usam linhas inventadas no formato do `readSpreadsheetFile`, com o cabeçalho das planilhas de verdade. Planilha de verdade nunca entra no repositório.

- [ ] **Step 1: Escrever o teste dos dias**

Criar `src/lib/__tests__/faltosos.dias.test.js`:

```js
// Dias dos faltosos como texto AAAA-MM-DD (src/lib/faltosos/dias.js): a conta
// entre dias não depende do fuso, e "hoje" e o fim do contrato saem do
// calendário de Brasília.
import { describe, it, expect } from 'vitest';
import {
  numeroDoDia, diaValido, somarDias, diasEntre, maiorDia, mesDoDia, ddmm, ddmmaaaa, dataCurta,
  hojeEmBrasilia, diaEmBrasilia,
} from '../faltosos/dias.js';

describe('dias como texto', () => {
  it('reconhece só AAAA-MM-DD de um dia que existe', () => {
    expect(diaValido('2026-10-06')).toBe(true);
    expect(diaValido('2028-02-29')).toBe(true);
    expect(diaValido('2026-02-29')).toBe(false);
    expect(diaValido('2026-02-31')).toBe(false);
    expect(diaValido('06/10/2026')).toBe(false);
    expect(diaValido('2026-10-6')).toBe(false);
    expect(diaValido(null)).toBe(false);
    expect(Number.isNaN(numeroDoDia('2026-13-01'))).toBe(true);
  });

  it('o número do dia conta dias desde 01/01/1970', () => {
    expect(numeroDoDia('1970-01-02')).toBe(1);
    expect(numeroDoDia('2026-09-25')).toBe(20721);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-09-29', 7)).toBe('2026-10-06');
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(somarDias('2026-10-06', -7)).toBe('2026-09-29');
    expect(somarDias('2026-10-06', 1.5)).toBeNull();
    expect(somarDias('lixo', 1)).toBeNull();
  });

  it('conta os dias entre dois dias, e null com dia inválido', () => {
    expect(diasEntre('2026-09-25', '2026-10-06')).toBe(11);
    expect(diasEntre('2026-10-06', '2026-09-25')).toBe(-11);
    expect(diasEntre('2026-10-06', '2026-10-06')).toBe(0);
    expect(diasEntre('2026-10-06', null)).toBeNull();
  });

  it('o maior dia ignora o que não é dia', () => {
    expect(maiorDia('2026-09-25', null, '2026-10-02', 'x')).toBe('2026-10-02');
    expect(maiorDia(null, undefined)).toBeNull();
    expect(maiorDia()).toBeNull();
  });

  it('mês e textos curtos', () => {
    expect(mesDoDia('2026-10-06')).toBe('2026-10');
    expect(mesDoDia('x')).toBeNull();
    expect(ddmm('2026-10-03')).toBe('03/10');
    expect(ddmmaaaa('2026-10-03')).toBe('03/10/2026');
    expect(ddmm(null)).toBe('');
    expect(ddmmaaaa('2026-02-30')).toBe('');
  });
});

describe('dataCurta', () => {
  it('põe o ano só quando ele é outro', () => {
    expect(dataCurta('2026-10-02', '2026-10-05')).toBe('02/10');
    expect(dataCurta('2025-12-15', '2026-01-10')).toBe('15/12/2025');
    expect(dataCurta('2027-01-02', '2026-10-05')).toBe('02/01/2027');
  });

  it('sem o dia de hoje, fica sem o ano', () => {
    expect(dataCurta('2026-10-02')).toBe('02/10');
    expect(dataCurta('2026-10-02', 'x')).toBe('02/10');
  });

  it('o que não é dia vira texto vazio', () => {
    expect(dataCurta('2026-02-30', '2026-10-05')).toBe('');
    expect(dataCurta(null)).toBe('');
  });
});

describe('calendário de Brasília', () => {
  it('hoje é o dia de Brasília, mesmo quando o UTC já virou', () => {
    expect(hojeEmBrasilia(new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05');
    expect(hojeEmBrasilia(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-06');
    expect(hojeEmBrasilia(new Date('x'))).toBeNull();
  });

  it('o fim do contrato, gravado à meia-noite de Brasília, cai no próprio dia', () => {
    expect(diaEmBrasilia(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01');
    expect(diaEmBrasilia({ toDate: () => new Date('2026-12-01T03:00:00Z') })).toBe('2026-12-01');
    expect(diaEmBrasilia({ seconds: Date.parse('2026-12-01T03:00:00Z') / 1000 })).toBe('2026-12-01');
    expect(diaEmBrasilia(null)).toBeNull();
    expect(diaEmBrasilia('lixo')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.dias.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/dias.js' imported from .../src/lib/__tests__/faltosos.dias.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Implementar os dias**

Criar `src/lib/faltosos/dias.js`:

```js
// Dias dos faltosos como texto AAAA-MM-DD, no calendário de Brasília. As
// planilhas da Next Fit trazem dia e hora escritos, e o que importa é o dia,
// não o instante: a conta entre dois dias é feita sobre o texto, com
// Date.UTC, e não depende do fuso de quem roda. Só "hoje" e o fim do contrato
// (que chegam como instante) passam pelo horário de Brasília, pelo mesmo
// leitor do cartão do Stronizap (api/_horarioDeBrasilia.js).
//
// Puro e sem pacote: os módulos de src/lib/faltosos rodam em node nos testes
// e no navegador, e o faltosos.imports.test.js confere.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Os dados").
import { diaDeBrasilia, isoDoDia } from '../../../api/_horarioDeBrasilia.js';
import { getSafeDateOrNull } from '../dates.js';

const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

// Número do dia (dias desde 01/01/1970), o mesmo que diaDeBrasilia devolve.
// NaN para texto fora do formato ou dia que não existe (31/02).
export function numeroDoDia(dia) {
  const m = DIA_RE.exec(typeof dia === 'string' ? dia : '');
  if (!m) return NaN;
  const [ano, mes, diaDoMes] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(ano, mes - 1, diaDoMes);
  const d = new Date(t);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== diaDoMes) return NaN;
  return t / DAY_MS;
}

export const diaValido = (dia) => Number.isFinite(numeroDoDia(dia));

// O dia `n` dias depois (ou antes, com n negativo). null para dia inválido ou
// n que não é inteiro.
export function somarDias(dia, n) {
  const x = numeroDoDia(dia);
  return Number.isFinite(x) && Number.isInteger(n) ? isoDoDia(x + n) : null;
}

// Dias do calendário de `a` até `b` (b menos a). null se um dos dois é inválido.
export function diasEntre(a, b) {
  const x = numeroDoDia(a);
  const y = numeroDoDia(b);
  return Number.isFinite(x) && Number.isFinite(y) ? y - x : null;
}

// O mais novo dos dias válidos, ou null. Texto AAAA-MM-DD compara como dia.
export function maiorDia(...dias) {
  return dias.filter(diaValido).reduce((max, d) => (max === null || d > max ? d : max), null);
}

// 'AAAA-MM' do dia (o mês do documento stronix_presencas/{leadId}_{AAAA-MM}), ou null.
export const mesDoDia = (dia) => (diaValido(dia) ? dia.slice(0, 7) : null);

// "03/10" e "03/10/2026", para a prévia e a linha do tempo. Texto vazio para o
// que não é dia.
export const ddmm = (dia) => (diaValido(dia) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : '');
export const ddmmaaaa = (dia) => (diaValido(dia) ? `${ddmm(dia)}/${dia.slice(0, 4)}` : '');

// "02/10", ou "15/12/2025" quando o ano não é o de `hojeDia`. Sem o ano, a
// data de dezembro lida em janeiro pareceria do fim do ano seguinte. É a data
// da aba Presenças e do selo da ficha. Texto vazio para o que não é dia.
export function dataCurta(dia, hojeDia = null) {
  if (!diaValido(dia)) return '';
  return diaValido(hojeDia) && hojeDia.slice(0, 4) !== dia.slice(0, 4) ? ddmmaaaa(dia) : ddmm(dia);
}

// Hoje no calendário de Brasília, seja qual for o fuso do navegador. null
// para instante inválido.
export function hojeEmBrasilia(agora = new Date()) {
  const n = diaDeBrasilia(agora);
  return Number.isFinite(n) ? isoDoDia(n) : null;
}

// O dia de Brasília de um instante gravado (Date, Timestamp do Firestore ou
// texto), como o fim do contrato, que é gravado à meia-noite de Brasília.
export function diaEmBrasilia(valor) {
  const d = getSafeDateOrNull(valor);
  if (!d) return null;
  const n = diaDeBrasilia(d);
  return Number.isFinite(n) ? isoDoDia(n) : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.dias.test.js`
Expected: PASS, `Tests  11 passed (11)`.

- [ ] **Step 5: Escrever o teste do leitor das planilhas**

Criar `src/lib/__tests__/faltosos.nextfitArquivos.test.js`:

```js
// Os relatórios Faltantes e Presenças da Next Fit
// (src/lib/faltosos/nextfitArquivos.js): reconhecer pelo cabeçalho e ler as
// linhas. As linhas aqui têm o formato que readSpreadsheetFile devolve
// (objetos chaveados pelo cabeçalho, com __row), com o cabeçalho das planilhas
// de verdade e nomes e telefones inventados. Planilha de verdade nunca entra
// no repositório.
import { describe, it, expect } from 'vitest';
import {
  FALTANTES_HEADER, PRESENCAS_HEADER, NAO_E_DA_NEXTFIT, nomeChave, detectReport, lerDiaEHora,
  parseFaltantes, dataDoFaltantes, parsePresencas, periodoDasPresencas, modalidadeDeVerdade,
} from '../faltosos/nextfitArquivos.js';

const faltante = (__row, nome, ultima, ausencias, extra = {}) => ({
  __row,
  Nome: nome,
  Contrato: 'Plano Anual',
  'Qtde de ausências': ausencias,
  'Última presença': ultima,
  Telefone: '(51) 9 9000-0001',
  Professor: 'Ana Paula Ribeiro',
  Consultor: 'Carla Mendes',
  ...extra,
});

const presenca = (__row, nome, data, tipo = 'Acesso', modalidade = 'offf') => ({
  __row, Cliente: nome, Modalidade: modalidade, Contrato: 'Plano Anual', Tipo: tipo, Data: data,
});

describe('nomeChave', () => {
  it('sem acento, minúsculo, só letras e números, espaço único', () => {
    expect(nomeChave('  JOÃO   da Silva-Neto ')).toBe('joao da silva neto');
    expect(nomeChave("D'Ávila")).toBe('d avila');
    expect(nomeChave('Última  presença')).toBe('ultima presenca');
    expect(nomeChave(null)).toBe('');
    expect(nomeChave(0)).toBe('0');
  });
});

describe('detectReport', () => {
  it('reconhece os dois relatórios pelo cabeçalho de verdade', () => {
    expect(detectReport(['Nome', 'Contrato', 'Qtde de ausências', 'Última presença', 'Telefone', 'Professor', 'Consultor'])).toBe('faltantes');
    expect(detectReport(['Cliente', 'Modalidade', 'Contrato', 'Tipo', 'Data'])).toBe('presencas');
    expect(detectReport([...FALTANTES_HEADER])).toBe('faltantes');
    expect(detectReport([...PRESENCAS_HEADER])).toBe('presencas');
  });

  it('ordem, caixa, acento e espaço não importam', () => {
    expect(detectReport(['DATA', 'tipo', ' Cliente ', 'Contrato', 'Modalidade'])).toBe('presencas');
    expect(detectReport(['Nome', 'Contrato', 'Qtde de Ausencias', 'Ultima  presenca', 'Telefone', 'Professor', 'Consultor'])).toBe('faltantes');
  });

  it('coluna a mais não atrapalha', () => {
    expect(detectReport([...PRESENCAS_HEADER, 'Unidade'])).toBe('presencas');
  });

  it('recusa o relatório Acessos, arquivo incompleto e arquivo vazio', () => {
    expect(detectReport(['AcessoLiberado', 'Cliente', 'Contrato', 'Acesso', 'ModoReconhecimento', 'Offline', 'Motivo'])).toBeNull();
    expect(detectReport(['Nome', 'Contrato', 'Telefone'])).toBeNull();
    expect(detectReport([])).toBeNull();
    expect(detectReport(null)).toBeNull();
  });

  it('um arquivo com as colunas dos dois não é nenhum', () => {
    expect(detectReport([...FALTANTES_HEADER, ...PRESENCAS_HEADER])).toBeNull();
  });

  it('a recusa tem a frase da spec', () => {
    expect(NAO_E_DA_NEXTFIT).toBe('Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.');
  });
});

describe('lerDiaEHora', () => {
  it('texto do jeito que a Next Fit exporta', () => {
    expect(lerDiaEHora('25/09/2026')).toEqual({ dia: '2026-09-25', hora: null });
    expect(lerDiaEHora('02/10/2026 07:00')).toEqual({ dia: '2026-10-02', hora: '07:00' });
    expect(lerDiaEHora('2/10/2026 7:05:59')).toEqual({ dia: '2026-10-02', hora: '07:05' });
    expect(lerDiaEHora('2026-10-02T18:30:00')).toEqual({ dia: '2026-10-02', hora: '18:30' });
  });

  it('Date do SheetJS: o relógio da célula nos getters locais', () => {
    expect(lerDiaEHora(new Date(2026, 8, 25))).toEqual({ dia: '2026-09-25', hora: '00:00' });
    expect(lerDiaEHora(new Date(2026, 9, 2, 18, 30))).toEqual({ dia: '2026-10-02', hora: '18:30' });
  });

  it('número de série do Excel, com e sem hora', () => {
    expect(lerDiaEHora(46290)).toEqual({ dia: '2026-09-25', hora: null });
    expect(lerDiaEHora(46297 + 7 / 24)).toEqual({ dia: '2026-10-02', hora: '07:00' });
  });

  it('o que não é data dá null', () => {
    expect(lerDiaEHora('31/02/2026')).toBeNull();
    expect(lerDiaEHora('02/10/2026 25:00')).toEqual({ dia: '2026-10-02', hora: null });
    expect(lerDiaEHora('ontem')).toBeNull();
    expect(lerDiaEHora('')).toBeNull();
    expect(lerDiaEHora(new Date('x'))).toBeNull();
    expect(lerDiaEHora('25/09/26')).toBeNull();
    expect(lerDiaEHora(-1)).toBeNull();
  });
});

describe('parseFaltantes', () => {
  it('lê cada coluna, com a data em texto AAAA-MM-DD', () => {
    const { linhas, erros } = parseFaltantes([faltante(2, '  Fulano  de Teste ', '29/09/2026', 7)]);
    expect(erros).toEqual([]);
    expect(linhas).toEqual([{
      numero: 2,
      nome: 'Fulano de Teste',
      contrato: 'Plano Anual',
      ausencias: 7,
      ultimaPresenca: '2026-09-29',
      telefone: '(51) 9 9000-0001',
      professorNextFit: 'Ana Paula Ribeiro',
      consultorNextFit: 'Carla Mendes',
    }]);
  });

  it('aceita a quantidade em texto e a data como célula de data', () => {
    const { linhas } = parseFaltantes([faltante(2, 'Beltrana Teste', new Date(2026, 8, 25), '11')]);
    expect(linhas[0]).toMatchObject({ ausencias: 11, ultimaPresenca: '2026-09-25' });
  });

  it('campos vazios viram null', () => {
    const { linhas } = parseFaltantes([faltante(2, 'Sicrano Teste', '29/09/2026', 7, { Telefone: '', Professor: '  ', Consultor: null, Contrato: '' })]);
    expect(linhas[0]).toMatchObject({ telefone: null, professorNextFit: null, consultorNextFit: null, contrato: null });
  });

  it('lê pelo cabeçalho de verdade, mesmo com outra caixa', () => {
    const row = { __row: 3, NOME: 'Fulano Teste', contrato: 'Mensal', 'Qtde de Ausencias': 8, 'ULTIMA PRESENCA': '28/09/2026', telefone: '(51) 3333-0000', professor: '', consultor: '' };
    expect(parseFaltantes([row]).linhas[0]).toMatchObject({ nome: 'Fulano Teste', ausencias: 8, ultimaPresenca: '2026-09-28', telefone: '(51) 3333-0000' });
  });

  it('linha sem nome, sem data ou sem quantidade vai para os erros, com o número da linha', () => {
    const { linhas, erros } = parseFaltantes([
      faltante(2, '', '29/09/2026', 7),
      faltante(3, 'Fulano Teste', 'sem data', 7),
      faltante(4, 'Beltrana Teste', '29/09/2026', '7 dias'),
      faltante(5, 'Sicrano Teste', '29/09/2026', -1),
      faltante(6, 'Total: 3', '', ''),
    ]);
    expect(linhas).toEqual([]);
    expect(erros.map((e) => e.numero)).toEqual([2, 3, 4, 5, 6]);
    expect(erros[0]).toEqual({ numero: 2, nome: null, motivo: 'Linha sem nome.' });
    expect(erros[1]).toEqual({ numero: 3, nome: 'Fulano Teste', motivo: 'A última presença não é uma data.' });
    expect(erros[2]).toEqual({ numero: 4, nome: 'Beltrana Teste', motivo: 'A quantidade de ausências não é um número.' });
  });

  it('sem __row, o número é o da linha na planilha, contando o cabeçalho', () => {
    const { __row, ...semNumero } = faltante(0, 'Fulano Teste', '29/09/2026', 7);
    expect(__row).toBe(0);
    expect(parseFaltantes([semNumero]).linhas[0].numero).toBe(2);
  });
});

describe('dataDoFaltantes', () => {
  it('é a última presença mais as ausências, igual em todas as linhas', () => {
    const { linhas } = parseFaltantes([
      faltante(2, 'A Teste', '29/09/2026', 7),
      faltante(3, 'B Teste', '22/09/2026', 14),
      faltante(4, 'C Teste', '06/08/2026', 61),
    ]);
    expect(dataDoFaltantes(linhas)).toEqual({ dia: '2026-10-06', divergentes: 0 });
  });

  it('com linhas que não batem, vale o dia mais comum e as outras são contadas', () => {
    const { linhas } = parseFaltantes([
      faltante(2, 'A Teste', '29/09/2026', 7),
      faltante(3, 'B Teste', '22/09/2026', 14),
      faltante(4, 'C Teste', '22/09/2026', 13),
    ]);
    expect(dataDoFaltantes(linhas)).toEqual({ dia: '2026-10-06', divergentes: 1 });
  });

  it('no empate, o dia mais novo', () => {
    const { linhas } = parseFaltantes([faltante(2, 'A Teste', '29/09/2026', 7), faltante(3, 'B Teste', '29/09/2026', 6)]);
    expect(dataDoFaltantes(linhas)).toEqual({ dia: '2026-10-06', divergentes: 1 });
  });

  it('sem linha, sem dia', () => {
    expect(dataDoFaltantes([])).toEqual({ dia: null, divergentes: 0 });
    expect(dataDoFaltantes(null)).toEqual({ dia: null, divergentes: 0 });
  });
});

describe('parsePresencas', () => {
  it('Acesso é catraca, Agenda é agenda, e a hora vem da célula', () => {
    const { linhas, erros } = parsePresencas([
      presenca(2, 'Fulano Teste', '02/10/2026 07:00', 'Acesso', 'Musculação'),
      presenca(3, 'Beltrana Teste', '02/10/2026 18:30', 'Agenda', 'Pilates'),
    ]);
    expect(erros).toEqual([]);
    expect(linhas).toEqual([
      { numero: 2, nome: 'Fulano Teste', contrato: 'Plano Anual', modalidade: 'Musculação', origem: 'catraca', dia: '2026-10-02', hora: '07:00' },
      { numero: 3, nome: 'Beltrana Teste', contrato: 'Plano Anual', modalidade: 'Pilates', origem: 'agenda', dia: '2026-10-02', hora: '18:30' },
    ]);
  });

  it('"offf", "off" e vazio não são modalidade', () => {
    expect(modalidadeDeVerdade('offf')).toBeNull();
    expect(modalidadeDeVerdade(' OFF ')).toBeNull();
    expect(modalidadeDeVerdade('')).toBeNull();
    expect(modalidadeDeVerdade('Funcional')).toBe('Funcional');
    const { linhas } = parsePresencas([presenca(2, 'Fulano Teste', '02/10/2026 07:00', 'Acesso', 'offf')]);
    expect(linhas[0].modalidade).toBeNull();
  });

  it('tipo desconhecido, data ilegível e linha sem nome vão para os erros', () => {
    const { linhas, erros } = parsePresencas([
      presenca(2, 'Fulano Teste', '02/10/2026 07:00', 'Liberação manual'),
      presenca(3, 'Beltrana Teste', 'amanhã', 'Acesso'),
      presenca(4, '', '02/10/2026 07:00', 'Acesso'),
      presenca(5, 'Sicrano Teste', '02/10/2026 07:00', ''),
    ]);
    expect(linhas).toEqual([]);
    expect(erros.map((e) => e.motivo)).toEqual([
      'O tipo "Liberação manual" não é Acesso nem Agenda.', 'A data não dá para ler.', 'Linha sem nome do cliente.', 'Linha sem tipo.',
    ]);
  });

  it('o período vai do primeiro ao último dia do arquivo', () => {
    const { linhas } = parsePresencas([
      presenca(2, 'A Teste', '02/10/2026 12:51'),
      presenca(3, 'B Teste', '01/10/2026 06:03'),
      presenca(4, 'C Teste', '01/10/2026 19:00', 'Agenda', 'Pilates'),
    ]);
    expect(periodoDasPresencas(linhas)).toEqual({ de: '2026-10-01', ate: '2026-10-02' });
    expect(periodoDasPresencas([])).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.nextfitArquivos.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/nextfitArquivos.js' imported from .../src/lib/__tests__/faltosos.nextfitArquivos.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 7: Implementar o leitor das planilhas**

Criar `src/lib/faltosos/nextfitArquivos.js`:

```js
// Os relatórios Faltantes e Presenças da Next Fit (Relatórios → Clientes →
// Acessos/Presenças, exportados para Excel): reconhecer o arquivo pelo
// cabeçalho e ler as linhas. Puro: recebe o que readSpreadsheetFile
// (src/lib/spreadsheetRead.js) devolve, os cabeçalhos e as linhas como
// objetos chaveados pelo cabeçalho, com `__row`. O cabeçalho vem na primeira
// linha do arquivo, sem título em cima (conferido nas planilhas de
// 02/10/2026), e é a primeira linha preenchida que o leitor toma como
// cabeçalho.
//
// As células de data chegam de três jeitos. Texto ("25/09/2026" e
// "02/10/2026 07:00"), que é como o levantamento viu as planilhas. Date, quando
// a célula é de data no Excel: o SheetJS (cellDates) monta a Date com o relógio
// da célula nos getters locais, em qualquer fuso, e é deles que o dia e a hora
// saem (conferido com a versão 0.20.3, como o parseImportDate de
// clientImport.js já fazia). E o número de série do Excel, por garantia.
//
// Cabeçalhos e formatos: docs/superpowers/specs/2026-10-02-professor-e-faltosos-levantamento.md
import { normalize } from '../globalSearch.js';
import { maiorDia, somarDias } from './dias.js';

export const FALTANTES_HEADER = Object.freeze(['Nome', 'Contrato', 'Qtde de ausências', 'Última presença', 'Telefone', 'Professor', 'Consultor']);
export const PRESENCAS_HEADER = Object.freeze(['Cliente', 'Modalidade', 'Contrato', 'Tipo', 'Data']);

export const NAO_E_DA_NEXTFIT = 'Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.';

// Chave de texto: sem acento, minúsculo, só letras e números, um espaço entre
// as palavras. "  JOÃO  da Silva " e "Joao da silva" dão a mesma chave, e
// "Última presença" e "ULTIMA  PRESENCA" também. Serve para reconhecer o
// cabeçalho e para comparar nomes de aluno e de professor, e é o id do
// documento em stronix_nextfit_alunos. É a mesma conta do normalizeHeader de
// importTemplate.js, que não dá para importar daqui porque ele puxa o
// clientImport.js inteiro. A ligação dos alunos (ligacaoAlunos.js) exporta
// esta mesma função.
export const nomeChave = (texto) => normalize(String(texto ?? '')).replace(/[^a-z0-9]+/g, ' ').trim();

// O relatório pelo cabeçalho: todas as colunas dele precisam estar lá. Caixa,
// acento e espaço não importam, e coluna a mais não atrapalha (a Next Fit pode
// acrescentar uma). Nenhum dos dois, ou os dois ao mesmo tempo, dá null.
export function detectReport(headerRow) {
  const presentes = new Set((Array.isArray(headerRow) ? headerRow : []).map(nomeChave).filter(Boolean));
  const tem = (esperado) => esperado.every((h) => presentes.has(nomeChave(h)));
  const faltantes = tem(FALTANTES_HEADER);
  const presencas = tem(PRESENCAS_HEADER);
  if (faltantes === presencas) return null;
  return faltantes ? 'faltantes' : 'presencas';
}

// Lê a coluna pelo nome esperado, achando o cabeçalho de verdade da planilha
// pela mesma chave da detecção.
function leitorDeColunas(rows) {
  const porChave = new Map();
  for (const row of rows || []) {
    for (const k of Object.keys(row || {})) {
      if (k === '__row') continue;
      const chave = nomeChave(k);
      if (chave && !porChave.has(chave)) porChave.set(chave, k);
    }
  }
  return (row, coluna) => {
    const k = porChave.get(nomeChave(coluna));
    return k === undefined ? undefined : row?.[k];
  };
}

const texto = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const pad = (n) => String(n).padStart(2, '0');

const diaDe = (ano, mes, dia) => {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
    ? `${ano}-${pad(mes)}-${pad(dia)}`
    : null;
};
const horaDe = (h, m) => (h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${pad(h)}:${pad(m)}` : null);

const TEXTO_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT,]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/;
const TEXTO_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[\sT](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;
// 25569: dias de 30/12/1899 (o zero do Excel) a 01/01/1970.
const EXCEL_ZERO = 25569;

// { dia: 'AAAA-MM-DD', hora: 'HH:MM' | null } de uma célula, ou null quando
// ela não é data. Ano com dois dígitos é recusado (a Next Fit escreve quatro),
// e dia que não existe (31/02) também. Hora fora do relógio fica null, com o
// dia valendo.
export function lerDiaEHora(valor) {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return {
      dia: diaDe(valor.getFullYear(), valor.getMonth() + 1, valor.getDate()),
      hora: horaDe(valor.getHours(), valor.getMinutes()),
    };
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor <= 0) return null;
    const minutos = Math.round(valor * 1440);
    const d = new Date((Math.floor(minutos / 1440) - EXCEL_ZERO) * 86400000);
    const resto = minutos % 1440;
    return {
      dia: diaDe(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      hora: Number.isInteger(valor) ? null : horaDe(Math.floor(resto / 60), resto % 60),
    };
  }
  const s = texto(valor);
  const br = TEXTO_BR.exec(s);
  const iso = br ? null : TEXTO_ISO.exec(s);
  const m = br || iso;
  if (!m) return null;
  const [ano, mes, dia] = br ? [m[3], m[2], m[1]].map(Number) : [m[1], m[2], m[3]].map(Number);
  const d = diaDe(ano, mes, dia);
  if (!d) return null;
  return { dia: d, hora: m[4] === undefined ? null : horaDe(Number(m[4]), Number(m[5])) };
}

const lerDia = (valor) => lerDiaEHora(valor)?.dia || null;

// Inteiro de 0 para cima, de número ou de texto só com dígitos.
const lerInteiro = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor >= 0 ? valor : null;
  const s = texto(valor);
  return /^\d+$/.test(s) ? Number(s) : null;
};

// O número da linha na planilha: o `__row` do leitor ou, sem ele, a posição
// mais 2 (o cabeçalho é a linha 1).
const numeroDaLinha = (row, i) => (Number.isInteger(row?.__row) && row.__row > 0 ? row.__row : i + 2);

// { linhas, erros }. Cada linha: { numero, nome, contrato, ausencias,
// ultimaPresenca, telefone, professorNextFit, consultorNextFit }, em que
// `numero` é o da linha na planilha, para a prévia apontar a linha certa. A
// linha sem nome, sem última presença ou sem quantidade legível vai para
// `erros` ({ numero, nome, motivo }), que a prévia mostra e que não barram a
// importação. Um rodapé como "Total: 196" cai em `erros`.
export function parseFaltantes(rows) {
  const ler = leitorDeColunas(rows);
  const linhas = [];
  const erros = [];
  (rows || []).forEach((row, i) => {
    const numero = numeroDaLinha(row, i);
    const nome = texto(ler(row, 'Nome'));
    const ultimaPresenca = lerDia(ler(row, 'Última presença'));
    const ausencias = lerInteiro(ler(row, 'Qtde de ausências'));
    if (!nome) { erros.push({ numero, nome: null, motivo: 'Linha sem nome.' }); return; }
    if (!ultimaPresenca) { erros.push({ numero, nome, motivo: 'A última presença não é uma data.' }); return; }
    if (ausencias === null) { erros.push({ numero, nome, motivo: 'A quantidade de ausências não é um número.' }); return; }
    linhas.push({
      numero,
      nome,
      contrato: texto(ler(row, 'Contrato')) || null,
      ausencias,
      ultimaPresenca,
      telefone: texto(ler(row, 'Telefone')) || null,
      professorNextFit: texto(ler(row, 'Professor')) || null,
      consultorNextFit: texto(ler(row, 'Consultor')) || null,
    });
  });
  return { linhas, erros };
}

// A data da exportação: a última presença mais a quantidade de ausências, que
// dá o mesmo dia em todas as linhas. Se não der, vale o dia mais comum (no
// empate, o mais novo), e `divergentes` conta as linhas que deram outro dia.
export function dataDoFaltantes(linhas) {
  const contagem = new Map();
  for (const l of linhas || []) {
    const d = somarDias(l?.ultimaPresenca, l?.ausencias);
    if (d) contagem.set(d, (contagem.get(d) || 0) + 1);
  }
  let dia = null;
  let maior = 0;
  let total = 0;
  for (const [d, n] of contagem) {
    total += n;
    if (n > maior || (n === maior && d > dia)) { dia = d; maior = n; }
  }
  return { dia, divergentes: total - maior };
}

const ORIGEM_POR_TIPO = Object.freeze({ acesso: 'catraca', agenda: 'agenda' });
// "offf" e "off" parecem nome provisório de plano na Next Fit (levantamento).
const MODALIDADES_FALSAS = new Set(['off', 'offf']);

// Nome de modalidade de verdade, ou null.
export function modalidadeDeVerdade(valor) {
  const t = texto(valor);
  return t && !MODALIDADES_FALSAS.has(nomeChave(t)) ? t : null;
}

// { linhas, erros }. Cada linha: { numero, nome, contrato, modalidade, origem,
// dia, hora }. `Acesso` vira catraca e `Agenda` vira agenda; outro tipo vai
// para `erros`. Sem hora na célula, hora é null.
export function parsePresencas(rows) {
  const ler = leitorDeColunas(rows);
  const linhas = [];
  const erros = [];
  (rows || []).forEach((row, i) => {
    const numero = numeroDaLinha(row, i);
    const nome = texto(ler(row, 'Cliente'));
    const quando = lerDiaEHora(ler(row, 'Data'));
    const tipo = texto(ler(row, 'Tipo'));
    const origem = ORIGEM_POR_TIPO[nomeChave(tipo)] || null;
    if (!nome) { erros.push({ numero, nome: null, motivo: 'Linha sem nome do cliente.' }); return; }
    if (!quando) { erros.push({ numero, nome, motivo: 'A data não dá para ler.' }); return; }
    if (!origem) { erros.push({ numero, nome, motivo: tipo ? `O tipo "${tipo}" não é Acesso nem Agenda.` : 'Linha sem tipo.' }); return; }
    linhas.push({
      numero,
      nome,
      contrato: texto(ler(row, 'Contrato')) || null,
      modalidade: modalidadeDeVerdade(ler(row, 'Modalidade')),
      origem,
      dia: quando.dia,
      hora: quando.hora,
    });
  });
  return { linhas, erros };
}

// Do primeiro ao último dia que aparece no arquivo, ou null sem linha.
export function periodoDasPresencas(linhas) {
  let de = null;
  for (const l of linhas || []) if (l?.dia && (de === null || l.dia < de)) de = l.dia;
  const ate = maiorDia(...(linhas || []).map((l) => l?.dia));
  return de && ate ? { de, ate } : null;
}
```

- [ ] **Step 8: Rodar os dois, também em UTC, e o lint**

Run: `npx vitest run src/lib/__tests__/faltosos.dias.test.js src/lib/__tests__/faltosos.nextfitArquivos.test.js`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  36 passed (36)` (11 dos dias e 25 do leitor).

Run: `TZ=UTC npx vitest run src/lib/__tests__/faltosos.dias.test.js src/lib/__tests__/faltosos.nextfitArquivos.test.js`
Expected: PASS, `Tests  36 passed (36)`. A célula `Date` é lida pelos getters locais, e o teste monta a `Date` no fuso do processo, então passa em qualquer fuso.

Run: `npx eslint src/lib/faltosos/dias.js src/lib/faltosos/nextfitArquivos.js src/lib/__tests__/faltosos.dias.test.js src/lib/__tests__/faltosos.nextfitArquivos.test.js`
Expected: nenhuma saída.

- [ ] **Step 9: Commit**

```bash
git add src/lib/faltosos/dias.js src/lib/faltosos/nextfitArquivos.js src/lib/__tests__/faltosos.dias.test.js src/lib/__tests__/faltosos.nextfitArquivos.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: dias e leitura das planilhas da Next Fit nos faltosos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Ligação de professores e alunos (`src/lib/faltosos/ligacaoAlunos.js`, `src/lib/faltosos/ligacaoProfessores.js`)

**Files:**
- Create: `src/lib/faltosos/ligacaoAlunos.js`
- Create: `src/lib/faltosos/ligacaoProfessores.js`
- Test: `src/lib/__tests__/faltosos.ligacaoAlunos.test.js` (novo)
- Test: `src/lib/__tests__/faltosos.ligacaoProfessores.test.js` (novo)

Depende da Task 1 (`nomeChave`, em `nextfitArquivos.js`).

Notas:
- Só cliente entra (`lifecycleBucket === 'cliente'`). As chaves de telefone do cliente são o `zapMatchKey` (`api/_zapPhone.js:6-13`) do WhatsApp dele e do `guardian.phone`, caindo no `zapMatchKey` e no `guardianZapMatchKey` gravados quando o número falta (dado antigo pode estar sem o derivado; `src/lib/leadDerived.js:25-56`).
- **C4.** O telefone só liga quando o nome confere (`nomeConfere`: o primeiro nome igual, ou duas palavras em comum, sem "de", "da", "do", "das", "dos" e "e"). Entre vários clientes do mesmo telefone, o nome igual decide e, sem ele, o único nome que confere ("Pedro Henrique Teste" na Next Fit acha "Pedro Teste" entre os irmãos). O telefone que acha clientes sem nome que decida deixa a linha nos ambíguos, com esses clientes de candidatos: a mãe que é cliente nunca recebe o filho por engano. Quando o telefone não decide, vale a ligação feita à mão (`origem: 'manual'` em `stronix_nextfit_alunos`).
- O nome guardado pelo telefone não liga no Faltantes, só no Presenças, como a spec diz ("A ligação dos alunos").
- **C3, a parte da ligação.** `clienteProvavel(linha, clientes, nomesGuardados)` devolve o cliente do nome guardado (de qualquer origem) que aponta para um cliente só ou, sem nome guardado, o único cliente com o mesmo nome. Não liga nada: a Task 4 usa para não marcar "voltou" quem só trocou de telefone no Stronilead, e a prévia, para a sugestão de ligação.
- `nomesParaGuardar` devolve só os nomes que mudam. A ligação à mão nunca é trocada por uma ligação pelo telefone, homônimos com telefones diferentes deixam o nome com dois `leadIds` (o Presenças trata como ambíguo) e id que deixou de ser cliente sai. `nomesManuais` transforma as ligações à mão da prévia (`[{ nomeNextFit, leadId }]`) em documentos do mesmo formato.
- A sugestão de professor segue a spec (o ativo cujo nome começa com o texto, ignorando acento e maiúscula; senão o de mais palavras em comum, pelo menos duas; senão null), com três detalhes: nome igual vem antes; o começo precisa fechar uma palavra ("Anab" não acha "Anabela"), menos quando o texto tem os 29 caracteres do corte da Next Fit; empate dá null. Professor ativo é o do `isActiveProfessor` do PR 1 (`src/lib/teamRoles.js:42`: inativo é só `ativo === false`), e o cadastro usa o campo `nome`.
- `normalizarProfessorLinks` é a única leitura de `professorLinks` (o `configFaltosos.js` da Task 3 reexporta): um item por chave de nome, a última escolha vale e a lista sai em ordem de nome. O `professorDaLinha` devolve `undefined` para nome sem ligação, que é o que segura o passo curto.
- `professoresNovos(linhas, ligacoes, professores)` já traz a sugestão. A janela da Task 10 pode mostrar o `plano.pendencias.professoresNovos` da Task 4 em vez de fazer outra conta.

- [ ] **Step 1: Escrever o teste da ligação dos alunos**

Criar `src/lib/__tests__/faltosos.ligacaoAlunos.test.js`:

```js
// A ligação dos alunos da Next Fit com os clientes
// (src/lib/faltosos/ligacaoAlunos.js): o Faltantes pelo telefone (do aluno e
// do responsável), com o nome conferindo e desempatando, e o Presenças pelo
// nome. Clientes, nomes e telefones inventados.
import { describe, it, expect } from 'vitest';
import {
  nomeChave, nomeConfere, ligarFaltantes, ligarPresencas, clienteProvavel, nomesParaGuardar, nomesManuais,
  indiceDeClientes,
} from '../faltosos/ligacaoAlunos.js';
import { nomeChave as nomeChaveDoArquivo } from '../faltosos/nextfitArquivos.js';

const cliente = (id, name, whatsapp, extra = {}) => ({ id, name, whatsapp, lifecycleBucket: 'cliente', ...extra });
const MAE = { name: 'Rita Teste', phone: '(51) 9 9000-0099', relationship: 'Mãe' };

const CLIENTES = [
  cliente('ana', 'Ana Teste Souza', '(51) 9 9000-0001'),
  cliente('bia', 'Bia Teste', '51 99000-0002'),
  // irmãos com o telefone da mãe como responsável
  cliente('pedro', 'Pedro Teste', '', { isMinor: true, guardian: MAE }),
  cliente('lia', 'Lia Teste', '', { isMinor: true, guardian: MAE }),
  // homônimos
  cliente('joao1', 'João Teste', '(51) 9 9000-0011'),
  cliente('joao2', 'Joao  Teste', '(51) 9 9000-0012'),
  // a mãe que é cliente, com o número que o filho também usa na Next Fit
  cliente('rita', 'Rita Souza', '(51) 9 9000-0020'),
  // lead que não é cliente não entra
  { id: 'lead', name: 'Caio Lead', whatsapp: '(51) 9 9000-0003', lifecycleBucket: 'ativo' },
];

const lf = (nome, telefone) => ({ nome, telefone });
const lp = (nome) => ({ nome, dia: '2026-10-02', hora: '07:00', origem: 'catraca', modalidade: null });

describe('nomeChave e nomeConfere', () => {
  it('a chave de nome é a mesma do leitor das planilhas', () => {
    expect(nomeChave).toBe(nomeChaveDoArquivo);
    expect(nomeChave('  JOÃO   da Silva-Neto ')).toBe('joao da silva neto');
  });

  it('confere com o primeiro nome igual', () => {
    expect(nomeConfere('Ana T. Souza', 'Ana Teste Souza')).toBe(true);
    expect(nomeConfere('PEDRO Henrique', 'Pedro Teste')).toBe(true);
  });

  it('confere com duas palavras em comum', () => {
    expect(nomeConfere('Maria Rita Souza', 'Rita Souza')).toBe(true);
  });

  it('uma palavra só não basta, e "de", "da" e "do" não contam', () => {
    expect(nomeConfere('João Souza', 'Rita Souza')).toBe(false);
    expect(nomeConfere('Joana da Silva', 'Maria da Silva')).toBe(false);
    expect(nomeConfere('', 'Ana Teste')).toBe(false);
  });
});

describe('ligarFaltantes', () => {
  it('pelo telefone do aluno, com ou sem o nono dígito e o 55', () => {
    const r = ligarFaltantes([lf('Ana T. Souza', '(51) 9 9000-0001'), lf('Bia', '+55 51 9000-0002')], CLIENTES);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['ana', 'telefone'], ['bia', 'telefone']]);
    expect(r.naoLigados).toEqual([]);
    expect(r.ambiguos).toEqual([]);
  });

  it('pelo telefone do responsável, e o nome desempata os irmãos', () => {
    const r = ligarFaltantes([lf('Pedro Teste', '(51) 9 9000-0099'), lf('LIA TESTE', '(51) 99000-0099')], CLIENTES);
    expect(r.ligados.map((x) => x.leadId)).toEqual(['pedro', 'lia']);
  });

  it('sem nome igual, o nome que confere desempata', () => {
    const r = ligarFaltantes([lf('Pedro Henrique Teste', '(51) 9 9000-0099')], CLIENTES);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['pedro', 'telefone']]);
  });

  it('telefone de mais de um cliente, sem nome que decida, fica ambíguo', () => {
    const r = ligarFaltantes([lf('Teste Junior', '(51) 9 9000-0099')], CLIENTES);
    expect(r.ambiguos).toEqual([{ linha: lf('Teste Junior', '(51) 9 9000-0099'), candidatos: ['pedro', 'lia'] }]);
    const gemeas = [
      cliente('clara', 'Ana Clara Teste', '', { isMinor: true, guardian: MAE }),
      cliente('luiza', 'Ana Luiza Teste', '', { isMinor: true, guardian: MAE }),
    ];
    expect(ligarFaltantes([lf('Ana Teste', '(51) 9 9000-0099')], gemeas).ambiguos[0].candidatos).toEqual(['clara', 'luiza']);
  });

  it('telefone de um cliente só, mas de outra pessoa (a mãe): vai para os ambíguos', () => {
    const r = ligarFaltantes([lf('João Souza', '(51) 9 9000-0020')], CLIENTES);
    expect(r.ligados).toEqual([]);
    expect(r.ambiguos).toEqual([{ linha: lf('João Souza', '(51) 9 9000-0020'), candidatos: ['rita'] }]);
  });

  it('com duas palavras do nome em comum, o telefone liga', () => {
    expect(ligarFaltantes([lf('Maria Rita Souza', '(51) 9 9000-0020')], CLIENTES).ligados[0]).toMatchObject({ leadId: 'rita', origem: 'telefone' });
  });

  it('a ligação feita à mão vale quando o telefone não decide', () => {
    const guardados = { 'teste junior': { nomeNextFit: 'Teste Junior', leadIds: ['pedro'], origem: 'manual' } };
    const r = ligarFaltantes([lf('Teste Junior', '(51) 9 9000-0099'), lf('Teste Junior', '')], CLIENTES, guardados);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['pedro', 'manual'], ['pedro', 'manual']]);
    const filho = { 'joao souza': { nomeNextFit: 'João Souza', leadIds: ['ana'], origem: 'manual' } };
    expect(ligarFaltantes([lf('João Souza', '(51) 9 9000-0020')], CLIENTES, filho).ligados[0]).toMatchObject({ leadId: 'ana', origem: 'manual' });
  });

  it('o telefone que acha um cliente só, com o nome conferindo, ganha da ligação feita à mão', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['bia'], origem: 'manual' } };
    expect(ligarFaltantes([lf('Ana Teste Souza', '(51) 9 9000-0001')], CLIENTES, guardados).ligados[0].leadId).toBe('ana');
  });

  it('nome guardado pelo telefone não liga no Faltantes', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana'], origem: 'telefone' } };
    const r = ligarFaltantes([lf('Ana Teste Souza', '(51) 9 1111-2222')], CLIENTES, guardados);
    expect(r.naoLigados).toHaveLength(1);
  });

  it('sem telefone, telefone curto ou de quem não é cliente: não ligado', () => {
    const r = ligarFaltantes([lf('Sem Fone', null), lf('Curto', '9000-0001'), lf('Caio Lead', '(51) 9 9000-0003')], CLIENTES);
    expect(r.ligados).toEqual([]);
    expect(r.naoLigados.map((x) => x.nome)).toEqual(['Sem Fone', 'Curto', 'Caio Lead']);
  });

  it('aceita o índice pronto no lugar da lista', () => {
    expect(ligarFaltantes([lf('Ana', '(51) 9 9000-0001')], indiceDeClientes(CLIENTES)).ligados[0].leadId).toBe('ana');
  });
});

describe('ligarPresencas', () => {
  it('nome igual entre os clientes, sem acento e sem espaço a mais', () => {
    const r = ligarPresencas([lp('ANA  TESTE souza'), lp('Bia Teste')], CLIENTES);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['ana', 'nome'], ['bia', 'nome']]);
  });

  it('o nome guardado vale primeiro, e diz de onde veio', () => {
    const guardados = {
      'ana t souza': { nomeNextFit: 'Ana T Souza', leadIds: ['ana'], origem: 'telefone' },
      bia: { nomeNextFit: 'Bia', leadIds: ['bia'], origem: 'manual' },
    };
    const r = ligarPresencas([lp('Ana T. Souza'), lp('Bia')], CLIENTES, guardados);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['ana', 'guardado'], ['bia', 'manual']]);
  });

  it('homônimos e nome guardado com dois clientes ficam ambíguos', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana', 'bia'], origem: 'telefone' } };
    const r = ligarPresencas([lp('João Teste'), lp('Ana Teste Souza')], CLIENTES, guardados);
    expect(r.ambiguos.map((x) => x.candidatos)).toEqual([['joao1', 'joao2'], ['ana', 'bia']]);
  });

  it('nome guardado de quem deixou de ser cliente cai no nome igual', () => {
    const guardados = { 'bia teste': { nomeNextFit: 'Bia Teste', leadIds: ['apagado'], origem: 'telefone' } };
    expect(ligarPresencas([lp('Bia Teste')], CLIENTES, guardados).ligados[0]).toMatchObject({ leadId: 'bia', origem: 'nome' });
  });

  it('nome que ninguém tem não liga', () => {
    expect(ligarPresencas([lp('Ninguém Teste')], CLIENTES).naoLigados).toHaveLength(1);
  });
});

describe('clienteProvavel', () => {
  it('o cliente do nome guardado, de qualquer origem', () => {
    const guardados = { 'ana t souza': { nomeNextFit: 'Ana T. Souza', leadIds: ['ana'], origem: 'telefone' } };
    expect(clienteProvavel(lf('Ana T. Souza', '(51) 9 1111-2222'), CLIENTES, guardados)).toBe('ana');
  });

  it('sem nome guardado, o único cliente com o mesmo nome', () => {
    expect(clienteProvavel(lf('BIA  TESTE', null), CLIENTES)).toBe('bia');
  });

  it('homônimos, nome guardado com dois clientes, quem não é cliente e nome que ninguém tem: null', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana', 'bia'], origem: 'telefone' } };
    expect(clienteProvavel(lf('João Teste', null), CLIENTES)).toBeNull();
    expect(clienteProvavel(lf('Ana Teste Souza', null), CLIENTES, guardados)).toBeNull();
    expect(clienteProvavel(lf('Caio Lead', null), CLIENTES)).toBeNull();
    expect(clienteProvavel(lf('Ninguém Teste', null), CLIENTES)).toBeNull();
    expect(clienteProvavel(lf('', null), CLIENTES)).toBeNull();
  });
});

describe('nomes guardados', () => {
  it('cada ligação pelo telefone guarda o nome da Next Fit', () => {
    const r = ligarFaltantes([lf('Ana T. Souza', '(51) 9 9000-0001')], CLIENTES);
    expect(nomesParaGuardar(r.ligados, {}, CLIENTES)).toEqual({
      'ana t souza': { nomeNextFit: 'Ana T. Souza', leadIds: ['ana'], origem: 'telefone' },
    });
  });

  it('o que já está guardado igual não é gravado de novo', () => {
    const guardados = { 'ana t souza': { nomeNextFit: 'Ana T. Souza', leadIds: ['ana'], origem: 'telefone' } };
    const r = ligarFaltantes([lf('Ana T. Souza', '(51) 9 9000-0001')], CLIENTES);
    expect(nomesParaGuardar(r.ligados, guardados, CLIENTES)).toEqual({});
  });

  it('homônimos com telefones diferentes deixam o nome com os dois', () => {
    const r = ligarFaltantes([lf('João Teste', '(51) 9 9000-0011'), lf('João Teste', '(51) 9 9000-0012')], CLIENTES);
    expect(nomesParaGuardar(r.ligados, {}, CLIENTES)['joao teste'].leadIds).toEqual(['joao1', 'joao2']);
  });

  it('id que deixou de ser cliente sai, e a ligação feita à mão não é trocada', () => {
    const guardados = {
      'bia teste': { nomeNextFit: 'Bia Teste', leadIds: ['apagado'], origem: 'telefone' },
      'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana'], origem: 'manual' },
    };
    const r = ligarFaltantes([lf('Bia Teste', '51 99000-0002'), lf('Ana Teste Souza', '(51) 9 9000-0001')], CLIENTES, guardados);
    expect(nomesParaGuardar(r.ligados, guardados, CLIENTES)).toEqual({
      'bia teste': { nomeNextFit: 'Bia Teste', leadIds: ['bia'], origem: 'telefone' },
    });
  });

  it('ligação à mão da prévia vira o documento do nome', () => {
    expect(nomesManuais([{ nomeNextFit: ' Pedro H. Teste ', leadId: 'pedro' }, { nomeNextFit: '', leadId: 'x' }, { nomeNextFit: 'Sem Id' }])).toEqual({
      'pedro h teste': { nomeNextFit: 'Pedro H. Teste', leadIds: ['pedro'], origem: 'manual' },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.ligacaoAlunos.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/ligacaoAlunos.js' imported from .../src/lib/__tests__/faltosos.ligacaoAlunos.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Implementar a ligação dos alunos**

Criar `src/lib/faltosos/ligacaoAlunos.js`:

```js
// Ligação dos alunos da Next Fit com os clientes do Stronilead. Puro: recebe
// as linhas lidas, os clientes e os nomes guardados em stronix_nextfit_alunos,
// e devolve quem ligou, quem não ligou e quem ficou ambíguo.
//
// - Faltantes: pelo telefone, com a chave do Stronizap (DDD e os últimos 8
//   dígitos, api/_zapPhone.js), que acha o telefone do próprio aluno e o do
//   responsável pelo menor. O telefone só liga quando o nome confere (o
//   primeiro nome igual ou duas palavras em comum): o número da mãe que é
//   cliente não liga o filho a ela. Entre vários clientes do mesmo telefone,
//   o nome igual decide e, sem ele, o único nome que confere. Quando o
//   telefone não decide, vale a ligação feita à mão.
// - Presenças: pelo nome, porque o relatório não traz telefone. Primeiro o
//   nome guardado (pelo Faltantes ou à mão), depois o nome igual entre os
//   clientes. Nome que bate com mais de um cliente, ou com nenhum, não liga.
//
// Só cliente entra (lifecycleBucket 'cliente').
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("A ligação dos alunos").
import { zapMatchKey } from '../../../api/_zapPhone.js';
import { nomeChave } from './nextfitArquivos.js';

// A chave de nome mora no leitor das planilhas, que a usa no cabeçalho, e sai
// daqui também: é a mesma chave dos documentos de stronix_nextfit_alunos.
export { nomeChave };

// Palavras que não contam como "em comum": duas pessoas da mesma família de
// nomes não podem casar só por "da Silva".
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

// As palavras do nome, pela chave, sem os conectivos.
export const palavrasDoNome = (nome) => new Set(nomeChave(nome).split(' ').filter((p) => p && !CONECTIVOS.has(p)));

// Dois nomes que podem ser da mesma pessoa: o primeiro nome igual, ou pelo
// menos duas palavras em comum. "Ana T. Souza" confere com "Ana Teste Souza";
// "João Souza" não confere com "Rita Souza".
export function nomeConfere(a, b) {
  const primeiroA = nomeChave(a).split(' ')[0];
  const primeiroB = nomeChave(b).split(' ')[0];
  if (primeiroA && primeiroA === primeiroB) return true;
  const deB = palavrasDoNome(b);
  return [...palavrasDoNome(a)].filter((p) => deB.has(p)).length >= 2;
}

export const ehCliente = (lead) => lead?.lifecycleBucket === 'cliente';

// As chaves de telefone do cliente: a do WhatsApp dele e a do responsável,
// quando há. Lê o número gravado e, sem ele, o campo derivado (dado antigo
// pode estar sem o derivado, e o número é o que vale).
const chavesDoCliente = (lead) => [...new Set([
  zapMatchKey(lead?.whatsapp) || lead?.zapMatchKey || null,
  zapMatchKey(lead?.guardian?.phone) || lead?.guardianZapMatchKey || null,
].filter(Boolean))];

const juntar = (map, chave, valor) => {
  const lista = map.get(chave);
  if (lista) lista.push(valor);
  else map.set(chave, [valor]);
};

// Índices dos clientes por id, por chave de telefone e por chave de nome.
export function indiceDeClientes(clientes) {
  const porId = new Map();
  const porTelefone = new Map();
  const porNome = new Map();
  for (const lead of clientes || []) {
    if (!lead?.id || !ehCliente(lead) || porId.has(lead.id)) continue;
    porId.set(lead.id, lead);
    for (const chave of chavesDoCliente(lead)) juntar(porTelefone, chave, lead);
    const nome = nomeChave(lead.name);
    if (nome) juntar(porNome, nome, lead);
  }
  return { porId, porTelefone, porNome };
}

// Os leadIds de um nome guardado que ainda são clientes.
const vivos = (guardado, indice) => (Array.isArray(guardado?.leadIds) ? guardado.leadIds : [])
  .filter((id, i, lista) => typeof id === 'string' && indice.porId.has(id) && lista.indexOf(id) === i);

const indiceDe = (clientes) => (clientes && clientes.porId instanceof Map ? clientes : indiceDeClientes(clientes));

// Entre os clientes do telefone, o que o nome aponta: o único de nome igual
// e, sem nome igual, o único cujo nome confere. null quando o nome não decide.
function escolherPeloNome(candidatos, nome) {
  const chave = nomeChave(nome);
  const iguais = candidatos.filter((l) => nomeChave(l.name) === chave);
  if (iguais.length) return iguais.length === 1 ? iguais[0] : null;
  const conferem = candidatos.filter((l) => nomeConfere(nome, l.name));
  return conferem.length === 1 ? conferem[0] : null;
}

// { ligados: [{ linha, leadId, origem }], naoLigados: [linha], ambiguos: [{ linha, candidatos }] }.
// origem: 'telefone' (do aluno ou do responsável) ou 'manual'. `clientes`
// pode ser a lista ou o índice de indiceDeClientes. O telefone que acha
// clientes sem nome que decida deixa a linha nos ambíguos, com esses clientes
// como candidatos, para a prévia ligar à mão.
export function ligarFaltantes(linhas, clientes, nomesGuardados = {}) {
  const indice = indiceDe(clientes);
  const ligados = [];
  const naoLigados = [];
  const ambiguos = [];
  for (const linha of linhas || []) {
    const chaveNome = nomeChave(linha?.nome);
    const tel = zapMatchKey(linha?.telefone);
    const peloTelefone = tel ? [...new Set(indice.porTelefone.get(tel) || [])] : [];
    const escolhido = escolherPeloNome(peloTelefone, linha?.nome);
    if (escolhido) {
      ligados.push({ linha, leadId: escolhido.id, origem: 'telefone' });
      continue;
    }
    // O telefone não decidiu: vale a ligação feita à mão para esse nome.
    const guardado = chaveNome ? nomesGuardados?.[chaveNome] : null;
    const manual = guardado?.origem === 'manual' ? vivos(guardado, indice) : [];
    if (manual.length === 1) ligados.push({ linha, leadId: manual[0], origem: 'manual' });
    else if (peloTelefone.length) ambiguos.push({ linha, candidatos: peloTelefone.map((l) => l.id) });
    else if (manual.length > 1) ambiguos.push({ linha, candidatos: manual });
    else naoLigados.push(linha);
  }
  return { ligados, naoLigados, ambiguos };
}

// Mesmo formato de ligarFaltantes. origem: 'manual', 'guardado' (nome
// guardado por uma ligação pelo telefone) ou 'nome' (nome igual).
export function ligarPresencas(linhas, clientes, nomesGuardados = {}) {
  const indice = indiceDe(clientes);
  const cache = new Map();
  const resolver = (chaveNome) => {
    if (cache.has(chaveNome)) return cache.get(chaveNome);
    let r = null;
    const guardado = chaveNome ? nomesGuardados?.[chaveNome] : null;
    const doGuardado = guardado ? vivos(guardado, indice) : [];
    if (doGuardado.length === 1) r = { leadId: doGuardado[0], origem: guardado.origem === 'manual' ? 'manual' : 'guardado' };
    else if (doGuardado.length > 1) r = { candidatos: doGuardado };
    else {
      const iguais = chaveNome ? indice.porNome.get(chaveNome) || [] : [];
      if (iguais.length === 1) r = { leadId: iguais[0].id, origem: 'nome' };
      else if (iguais.length > 1) r = { candidatos: iguais.map((l) => l.id) };
    }
    cache.set(chaveNome, r);
    return r;
  };
  const ligados = [];
  const naoLigados = [];
  const ambiguos = [];
  for (const linha of linhas || []) {
    const r = resolver(nomeChave(linha?.nome));
    if (r?.leadId) ligados.push({ linha, leadId: r.leadId, origem: r.origem });
    else if (r?.candidatos) ambiguos.push({ linha, candidatos: r.candidatos });
    else naoLigados.push(linha);
  }
  return { ligados, naoLigados, ambiguos };
}

// O cliente provável de uma linha do Faltantes que não ligou: o do nome
// guardado (de qualquer origem) que aponta para um cliente só ou, sem nome
// guardado, o único cliente com o mesmo nome. null quando não há um só. Não
// liga nada. Serve para a prévia sugerir a ligação à mão e para o plano não
// marcar como "voltou" o aluno cujo telefone mudou no Stronilead: ele sai do
// conjunto ligado, mas o nome dele continua no Faltantes.
export function clienteProvavel(linha, clientes, nomesGuardados = {}) {
  const indice = indiceDe(clientes);
  const chave = nomeChave(linha?.nome);
  if (!chave) return null;
  const guardado = nomesGuardados?.[chave];
  if (guardado) {
    const ids = vivos(guardado, indice);
    if (ids.length) return ids.length === 1 ? ids[0] : null;
  }
  const iguais = indice.porNome.get(chave) || [];
  return iguais.length === 1 ? iguais[0].id : null;
}

const mesmaLista = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Os nomes que a importação guarda em stronix_nextfit_alunos: cada linha do
// Faltantes ligada pelo telefone guarda o nome com que o aluno aparece na Next
// Fit. Devolve só o que muda, como { [nomeChave]: { nomeNextFit, leadIds,
// origem: 'telefone' } }. A ligação feita à mão nunca é trocada aqui. Dois
// alunos da Next Fit com o mesmo nome e telefones diferentes deixam a chave
// com dois leadIds, e o Presenças passa a tratar esse nome como ambíguo. Id
// que deixou de ser cliente sai da lista.
export function nomesParaGuardar(ligados, nomesGuardados = {}, clientes = []) {
  const indice = indiceDe(clientes);
  const atual = {};
  const mudou = {};
  for (const { linha, leadId, origem } of ligados || []) {
    if (origem !== 'telefone') continue;
    const chave = nomeChave(linha?.nome);
    if (!chave) continue;
    const base = atual[chave] || nomesGuardados?.[chave] || null;
    if (base?.origem === 'manual') continue;
    const antes = base ? vivos(base, indice) : [];
    const leadIds = antes.includes(leadId) ? antes : [...antes, leadId];
    const doc = { nomeNextFit: String(linha.nome).trim(), leadIds, origem: 'telefone' };
    atual[chave] = doc;
    const gravado = nomesGuardados?.[chave];
    if (!gravado || !mesmaLista(leadIds, Array.isArray(gravado.leadIds) ? gravado.leadIds : [])
      || gravado.origem !== 'telefone' || gravado.nomeNextFit !== doc.nomeNextFit) mudou[chave] = doc;
  }
  return mudou;
}

// As ligações feitas à mão na prévia, no formato de stronix_nextfit_alunos.
// `manuais` é a lista [{ nomeNextFit, leadId }] que a tela junta; o mesmo
// nome escolhido duas vezes fica com a última escolha.
export function nomesManuais(manuais) {
  const out = {};
  for (const m of manuais || []) {
    const chave = nomeChave(m?.nomeNextFit);
    if (!chave || typeof m.leadId !== 'string' || !m.leadId) continue;
    out[chave] = { nomeNextFit: String(m.nomeNextFit).trim(), leadIds: [m.leadId], origem: 'manual' };
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.ligacaoAlunos.test.js`
Expected: PASS, `Tests  28 passed (28)`.

- [ ] **Step 5: Escrever o teste da ligação dos professores**

Criar `src/lib/__tests__/faltosos.ligacaoProfessores.test.js`:

```js
// A ligação dos professores da Next Fit com o cadastro de professores
// (src/lib/faltosos/ligacaoProfessores.js), e a sugestão para o nome que a
// Next Fit corta em 29 caracteres. Professores inventados, no formato de
// stronix_professores (nome e ativo).
import { describe, it, expect } from 'vitest';
import {
  CORTE_DO_NOME, sugerirProfessor, normalizarProfessorLinks, juntarProfessorLinks, professorDaLinha, professoresNovos,
} from '../faltosos/ligacaoProfessores.js';

const PROFESSORES = [
  { id: 'p-ana', nome: 'Ana Paula Ribeiro', ativo: true },
  { id: 'p-anabela', nome: 'Anabela Costa', ativo: true },
  { id: 'p-longo', nome: 'Fulano de Tal Sobrenomecomprido', ativo: true },
  { id: 'p-bruno', nome: 'Bruno Tavares' },
  { id: 'p-velho', nome: 'Carlos Inativo Souza', ativo: false },
  { id: 'p-maria', nome: 'Maria da Silva Prado', ativo: true },
];

describe('sugerirProfessor', () => {
  it('nome igual, sem acento e sem caixa', () => {
    expect(sugerirProfessor('ANA PAULA RIBEIRO', PROFESSORES)).toBe('p-ana');
    expect(sugerirProfessor('Bruno Távares', PROFESSORES)).toBe('p-bruno');
  });

  it('o começo do nome, inteiro até um espaço', () => {
    expect(sugerirProfessor('Ana Paula', PROFESSORES)).toBe('p-ana');
  });

  it('"Anab" não vira "Anabela": o começo precisa fechar uma palavra', () => {
    expect(sugerirProfessor('Anab', PROFESSORES)).toBeNull();
  });

  it('o nome cortado no meio da palavra, com o tamanho do corte', () => {
    const cortado = 'Fulano de Tal Sobrenomecompri';
    expect(cortado).toHaveLength(CORTE_DO_NOME);
    expect(sugerirProfessor(cortado, PROFESSORES)).toBe('p-longo');
  });

  it('professor inativo não é sugerido', () => {
    expect(sugerirProfessor('Carlos Inativo Souza', PROFESSORES)).toBeNull();
  });

  it('sem começo igual, o de mais palavras em comum, pelo menos duas', () => {
    expect(sugerirProfessor('Paula Ribeiro', PROFESSORES)).toBe('p-ana');
    expect(sugerirProfessor('Ribeiro', PROFESSORES)).toBeNull();
  });

  it('"da" não conta como palavra em comum', () => {
    expect(sugerirProfessor('Joana da Silva', PROFESSORES)).toBeNull();
  });

  it('empate, nome vazio e nome sem parecido dão null', () => {
    const dois = [{ id: 'a', nome: 'Pedro Lima Souza' }, { id: 'b', nome: 'Pedro Lima Rocha' }];
    expect(sugerirProfessor('Pedro Lima', dois)).toBeNull();
    expect(sugerirProfessor('Lima Pedro', dois)).toBeNull();
    expect(sugerirProfessor('', PROFESSORES)).toBeNull();
    expect(sugerirProfessor('Controle (não alterar)', PROFESSORES)).toBeNull();
    expect(sugerirProfessor('Ana Paula', null)).toBeNull();
  });
});

describe('ligações guardadas', () => {
  it('normaliza a lista: nome com texto, um item por nome, a última escolha vale, em ordem de nome', () => {
    expect(normalizarProfessorLinks([
      { nome: '  Bruno   Tavares ', professorId: 'p-bruno' },
      { nome: 'Controle (não alterar)', professorId: '' },
      { nome: '', professorId: 'x' },
      { nome: 'bruno tavares', professorId: 'p-outro' },
      'lixo',
    ])).toEqual([
      { nome: 'bruno tavares', professorId: 'p-outro' },
      { nome: 'Controle (não alterar)', professorId: null },
    ]);
    expect(normalizarProfessorLinks(null)).toEqual([]);
    expect(normalizarProfessorLinks({ 'Bruno Tavares': 'p-bruno' })).toEqual([]);
  });

  it('as escolhas do passo curto ganham das guardadas', () => {
    const guardadas = [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }];
    expect(juntarProfessorLinks(guardadas, [{ nome: 'Ana Paula Ribeiro', professorId: null }, { nome: 'Bruno Tavares', professorId: 'p-bruno' }]))
      .toEqual([{ nome: 'Ana Paula Ribeiro', professorId: null }, { nome: 'Bruno Tavares', professorId: 'p-bruno' }]);
  });

  it('professorDaLinha: ligado, Sem professor, vazio e nome novo', () => {
    const links = [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }, { nome: 'Controle (não alterar)', professorId: null }];
    expect(professorDaLinha('ana paula ribeiro', links)).toBe('p-ana');
    expect(professorDaLinha('Controle (nao alterar)', links)).toBeNull();
    expect(professorDaLinha('', links)).toBeNull();
    expect(professorDaLinha(null, links)).toBeNull();
    expect(professorDaLinha('Bruno Tavares', links)).toBeUndefined();
  });
});

describe('professoresNovos', () => {
  it('os nomes sem ligação, com quantos alunos e a sugestão, de quem tem mais alunos para quem tem menos', () => {
    const linhas = [
      { professorNextFit: 'Ana Paula Ribeiro' },
      { professorNextFit: 'Bruno Tavares' },
      { professorNextFit: 'Bruno Tavares' },
      { professorNextFit: 'Controle (não alterar)' },
      { professorNextFit: null },
    ];
    expect(professoresNovos(linhas, [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }], PROFESSORES)).toEqual([
      { nome: 'Bruno Tavares', alunos: 2, sugestao: 'p-bruno' },
      { nome: 'Controle (não alterar)', alunos: 1, sugestao: null },
    ]);
  });

  it('com tudo ligado, nada a perguntar', () => {
    expect(professoresNovos([{ professorNextFit: 'Ana Paula Ribeiro' }], [{ nome: 'Ana Paula Ribeiro', professorId: null }], PROFESSORES)).toEqual([]);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.ligacaoProfessores.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/ligacaoProfessores.js' imported from .../src/lib/__tests__/faltosos.ligacaoProfessores.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 7: Implementar a ligação dos professores**

Criar `src/lib/faltosos/ligacaoProfessores.js`:

```js
// Ligação dos professores da Next Fit com o cadastro de professores
// (stronix_professores, campos `nome` e `ativo`). A ligação fica em
// stronix_config/faltosos, no campo professorLinks, como lista
// [{ nome, professorId | null }]: lista, e não mapa, porque o nome tem espaço e
// acento. professorId null quer dizer "Sem professor": o aluno fica com o
// gestor e não entra na Meta de ninguém.
//
// Puro. A Next Fit corta o nome do professor em 29 caracteres
// (levantamento), por isso a sugestão aceita o começo do nome.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("A ligação dos professores").
import { nomeChave, palavrasDoNome } from './ligacaoAlunos.js';
import { isActiveProfessor } from '../teamRoles.js';

// Tamanho em que a Next Fit corta o nome do professor.
export const CORTE_DO_NOME = 29;

// A sugestão para um nome novo, entre os professores ativos: o de nome igual;
// senão o único cujo nome começa com o texto da Next Fit (inteiro até um
// espaço, ou cortado no meio da palavra quando o texto tem o tamanho do
// corte); senão o único com mais palavras em comum, desde que sejam pelo menos
// duas, sem contar "de", "da", "do", "das", "dos" e "e". Empate ou nada
// parecido: null, e o gestor escolhe.
export function sugerirProfessor(nomeNextFit, professores) {
  const alvo = nomeChave(nomeNextFit);
  if (!alvo) return null;
  const cortado = String(nomeNextFit ?? '').trim().length >= CORTE_DO_NOME;
  const ativos = (professores || [])
    .filter((p) => p?.id && isActiveProfessor(p))
    .map((p) => ({ id: p.id, chave: nomeChave(p.nome) }))
    .filter((p) => p.chave);

  const iguais = ativos.filter((p) => p.chave === alvo);
  if (iguais.length) return iguais.length === 1 ? iguais[0].id : null;

  const comecam = ativos.filter((p) => p.chave.startsWith(`${alvo} `) || (cortado && p.chave.startsWith(alvo)));
  if (comecam.length) return comecam.length === 1 ? comecam[0].id : null;

  const doAlvo = palavrasDoNome(alvo);
  const pontos = ativos
    .map((p) => ({ id: p.id, n: [...palavrasDoNome(p.chave)].filter((w) => doAlvo.has(w)).length }))
    .filter((p) => p.n >= 2);
  if (!pontos.length) return null;
  const max = Math.max(...pontos.map((p) => p.n));
  const melhores = pontos.filter((p) => p.n === max);
  return melhores.length === 1 ? melhores[0].id : null;
}

// A lista que vale: nome com texto (espaços juntados), professorId texto ou
// null, um item por nome (pela chave; a última escolha ganha), em ordem de
// nome. O que não é lista vira lista vazia. É a leitura de professorLinks em
// todo lugar: a importação, a configuração (configFaltosos.js) e o bloco de
// Configurações.
export function normalizarProfessorLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const porChave = new Map();
  for (const item of raw) {
    const nome = typeof item?.nome === 'string' ? item.nome.replace(/\s+/g, ' ').trim() : '';
    const chave = nomeChave(nome);
    if (!chave) continue;
    const professorId = typeof item.professorId === 'string' && item.professorId ? item.professorId : null;
    porChave.set(chave, { nome, professorId });
  }
  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// As ligações guardadas mais as escolhas do passo curto (as escolhas ganham).
export const juntarProfessorLinks = (atuais, escolhas) => normalizarProfessorLinks([...(atuais || []), ...(escolhas || [])]);

// O professor da linha: o professorId ligado, null para "Sem professor" (ou
// professor vazio na Next Fit) e undefined para nome que ainda não foi ligado.
export function professorDaLinha(nomeNextFit, ligacoes) {
  const chave = nomeChave(nomeNextFit);
  if (!chave) return null;
  const link = (ligacoes || []).find((l) => nomeChave(l?.nome) === chave);
  if (!link) return undefined;
  return typeof link.professorId === 'string' && link.professorId ? link.professorId : null;
}

// Os nomes de professor do arquivo que ainda não têm ligação, para o passo
// curto: [{ nome, alunos, sugestao }], de quem tem mais alunos para quem tem
// menos.
export function professoresNovos(linhas, ligacoes, professores) {
  const porChave = new Map();
  for (const l of linhas || []) {
    const nome = String(l?.professorNextFit ?? '').replace(/\s+/g, ' ').trim();
    if (!nome || professorDaLinha(nome, ligacoes) !== undefined) continue;
    const chave = nomeChave(nome);
    const item = porChave.get(chave);
    if (item) item.alunos += 1;
    else porChave.set(chave, { nome, alunos: 1 });
  }
  return [...porChave.values()]
    .map((x) => ({ ...x, sugestao: sugerirProfessor(x.nome, professores) }))
    .sort((a, b) => b.alunos - a.alunos || a.nome.localeCompare(b.nome, 'pt-BR'));
}
```

Esse arquivo tem `professorId` como chave, e a varredura do histórico do professor reprova arquivo novo assim até ele ser revisado. Ele não grava o professor do lead. Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, trocar:

```js
  'api/invite-create.js': 'convite de professor',
};
```

por:

```js
  'api/invite-create.js': 'convite de professor',
  // Faltosos (Professor e faltosos, PR 2A): o professor do aluno no estado
  // dos faltosos e nas ligações da Next Fit. Nenhum deles grava o lead.
  'src/lib/faltosos/ligacaoProfessores.js': 'ligação dos professores da Next Fit, guardada em stronix_config/faltosos',
};
```

- [ ] **Step 8: Rodar os dois e o lint**

Run: `npx vitest run src/lib/__tests__/faltosos.ligacaoAlunos.test.js src/lib/__tests__/faltosos.ligacaoProfessores.test.js`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  41 passed (41)` (28 dos alunos e 13 dos professores).

Run: `npx eslint src/lib/faltosos/ligacaoAlunos.js src/lib/faltosos/ligacaoProfessores.js src/lib/__tests__/faltosos.ligacaoAlunos.test.js src/lib/__tests__/faltosos.ligacaoProfessores.test.js`
Expected: nenhuma saída.

- [ ] **Step 9: Commit**

```bash
git add src/lib/faltosos/ligacaoAlunos.js src/lib/faltosos/ligacaoProfessores.js src/lib/__tests__/faltosos.ligacaoAlunos.test.js src/lib/__tests__/faltosos.ligacaoProfessores.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: ligação dos alunos e dos professores da Next Fit nos faltosos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Marcos, urgente e configuração (`src/lib/faltosos/marcos.js`, `src/lib/faltosos/urgente.js`, `src/lib/faltosos/configFaltosos.js`)

**Files:**
- Create: `src/lib/faltosos/marcos.js`
- Create: `src/lib/faltosos/urgente.js`
- Create: `src/lib/faltosos/configFaltosos.js`
- Test: `src/lib/__tests__/faltosos.marcos.test.js` (novo)
- Test: `src/lib/__tests__/faltosos.urgente.test.js` (novo)
- Test: `src/lib/__tests__/faltosos.configFaltosos.test.js` (novo)

`src/lib/contracts.js` não muda (ver a nota de M5 e C1).

Depende das Tasks 1 e 2 (`dias.js` e `normalizarProfessorLinks`).

Notas:
- Marcos: de 1 a 6 inteiros de 1 a 365, sem repetir, em ordem; fora disso, `[7, 14, 30, 60]` numa lista nova. `marcoAtravessado` dá o maior marco M com `E0 - x < M <= E - x` (x é a última presença que abriu o período), e bate com a simulação do levantamento (38, 22, 9 e 4 na primeira importação). `marcoAlcancado` é o marco da tarefa que nasce só pelo urgente.
- **F3.** `normalizarJanelaUrgente` aceita o número ou o texto do campo ("60" vale 60, "1.5" e `true` não). É a mesma regra para a importação, para o bloco de Configurações (Task 11) e para a ficha (o PR 2C), que mora no `marcos.js` e sai também pelo `configFaltosos.js`.
- **M1.** `urgenteDe(lead, agora, janelaDias)` recebe o instante: a situação do contrato sai do `deriveLeadContractStatus` (`src/lib/contracts.js:260-270`), que compara instantes, e com o fim gravado à meia-noite o contrato já está vencido durante o último dia, como em Clientes. Os dias até o fim contam do hoje de Brasília. A ficha chama com `new Date()`. O teste põe o processo em UTC antes dos imports, como o `api/__tests__/zapFuso.test.js:9-13`, e leva o `/* global process */` do lint do navegador, como o `src/lib/__tests__/zapScheduleTimeline.test.js:18`.
- **C1.** O fim que vale para o urgente é o do último contrato (`currentContractEndsAt`, em `fimDoContrato`). Com a renovação marcada, o último contrato é a renovação, que é o contrato que vale depois do contrato em uso: quem renovou só fica urgente se a renovação também termina dentro da janela. O `contratoTerminaEm` que a importação grava e a ficha mostra é esse dia, o fim da cobertura.
- **M5 não entra, por causa de C1.** O M5 exportava o `inUseBlockDecides` para o urgente ler o `inUseContractEndsAt` só enquanto o bloco "em uso" decide, porque o bloco não é limpo quando a renovação começa (`contracts.js:212-218`). Com C1, o urgente não lê o bloco em caso nenhum: quando o bloco decide, o último contrato é a renovação, e quando não decide, é o contrato que vale. O export ficaria sem uso, e `src/lib/contracts.js` fica como está. O teste "o bloco que ficou no lead depois de a renovação começar não muda nada" trava o risco que o M5 cobria. Se o Johnny preferir o urgente pelo fim do contrato em uso (C1, em "Pontos que dependem do Johnny"), o `contracts.js` passa a exportar a regra de quando o bloco decide, e o `urgente.js` volta a ler o bloco.
- O `configFaltosos.js` é a leitura única de `stronix_config/faltosos`, para a importação (Tasks 4 e 10), a assinatura do App (Task 8) e o bloco de Configurações (Task 11), e depois para a aba (o 2B) e a ficha (o 2C). Três pontos dele: (1) `CONFIG_FALTOSOS_ID` mora em `src/lib/firebase.js` (D2), e não aqui; (2) `normalizarUltimaImportacao` devolve também `dataFaltantesAnterior` e `ultimoDiaPresencas` (M3), e sem `id` dá null, que quer dizer "nunca houve importação" (o bloco de Configurações lê isso, e depois a aba e a Meta do professor); (3) as regras de cada campo vêm do motor e saem reexportadas (`normalizarMarcos`, `normalizarJanelaUrgente`, `normalizarProfessorLinks`).
- `periodoOuNull` sai daqui para o plano usar a mesma regra do período do Presenças.
- `CONFIG_FALTOSOS_PADRAO` é congelado, mas a lista de marcos dele não: quem lê do contexto não ordena a lista no lugar.

- [ ] **Step 1: Escrever o teste dos marcos**

Criar `src/lib/__tests__/faltosos.marcos.test.js`:

```js
// Marcos de falta (src/lib/faltosos/marcos.js): a configuração e o marco
// atravessado entre o Faltantes anterior (E0) e o de agora (E).
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MARCOS, DEFAULT_JANELA_URGENTE, JANELA_DA_PRIMEIRA_IMPORTACAO, normalizarMarcos, normalizarJanelaUrgente,
  marcoAtravessado, marcoAlcancado,
} from '../faltosos/marcos.js';
import { somarDias } from '../faltosos/dias.js';

const E = '2026-10-06';
// Última presença de quem está há `dias` dias sem vir em E.
const ha = (dias, e = E) => somarDias(e, -dias);

describe('configuração', () => {
  it('o padrão é 7, 14, 30 e 60, a janela do urgente é 90 e a primeira importação olha 7 dias para trás', () => {
    expect(DEFAULT_MARCOS).toEqual([7, 14, 30, 60]);
    expect(Object.isFrozen(DEFAULT_MARCOS)).toBe(true);
    expect(DEFAULT_JANELA_URGENTE).toBe(90);
    expect(JANELA_DA_PRIMEIRA_IMPORTACAO).toBe(7);
  });

  it('de 1 a 6 números de 1 a 365, sem repetir, em ordem', () => {
    expect(normalizarMarcos([30, 7, 14])).toEqual([7, 14, 30]);
    expect(normalizarMarcos([1, 2, 3, 4, 5, 365])).toEqual([1, 2, 3, 4, 5, 365]);
  });

  it('qualquer coisa fora disso cai no padrão, numa lista nova', () => {
    for (const ruim of [[], [7, 7], [0, 7], [7, 366], [7.5], ['7'], [1, 2, 3, 4, 5, 6, 7], null, 'x']) {
      expect(normalizarMarcos(ruim), JSON.stringify(ruim)).toEqual([7, 14, 30, 60]);
    }
    expect(normalizarMarcos(null)).not.toBe(DEFAULT_MARCOS);
  });

  it('janela do urgente: inteiro de 1 a 365, em número ou em texto, senão 90', () => {
    expect(normalizarJanelaUrgente(60)).toBe(60);
    expect(normalizarJanelaUrgente('60')).toBe(60);
    expect(normalizarJanelaUrgente(' 45 ')).toBe(45);
    for (const ruim of [0, 366, 1.5, '1.5', '', '  ', 'x', null, undefined, true]) {
      expect(normalizarJanelaUrgente(ruim), String(ruim)).toBe(90);
    }
  });
});

describe('marcoAtravessado', () => {
  const primeira = (dias) => marcoAtravessado({ ultimaPresenca: ha(dias), e0: somarDias(E, -7), e: E, marcos: DEFAULT_MARCOS });

  it('primeira importação: E0 é E menos 7, como na simulação do levantamento', () => {
    // 38 alunos de 7 a 13 dias, 22 de 14 a 20, 9 de 30 a 36 e 4 de 60 a 66.
    expect([7, 13].map(primeira)).toEqual([7, 7]);
    expect([14, 20].map(primeira)).toEqual([14, 14]);
    expect([30, 36].map(primeira)).toEqual([30, 30]);
    expect([60, 66].map(primeira)).toEqual([60, 60]);
  });

  it('quem não atravessou nenhum marco na janela fica só na lista', () => {
    expect([6, 21, 29, 37, 59, 67, 400].map(primeira)).toEqual([null, null, null, null, null, null, null]);
  });

  it('de semana em semana, o marco que caiu na semana', () => {
    const e0 = '2026-09-29';
    expect(marcoAtravessado({ ultimaPresenca: ha(14), e0, e: E, marcos: DEFAULT_MARCOS })).toBe(14);
    expect(marcoAtravessado({ ultimaPresenca: ha(16), e0, e: E, marcos: DEFAULT_MARCOS })).toBe(14);
    expect(marcoAtravessado({ ultimaPresenca: ha(22), e0, e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });

  it('intervalo longo entre importações: o maior marco atravessado', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(30), e0: somarDias(E, -21), e: E, marcos: DEFAULT_MARCOS })).toBe(30);
  });

  it('o aluno que voltou e sumiu de novo depois de E0 atravessa a partir do zero', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(8), e0: somarDias(E, -21), e: E, marcos: DEFAULT_MARCOS })).toBe(7);
  });

  it('depois do último marco, nada', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(90), e0: somarDias(E, -7), e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });

  it('E0 igual a E, ou data inválida: nada', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(7), e0: E, e: E, marcos: DEFAULT_MARCOS })).toBeNull();
    expect(marcoAtravessado({ ultimaPresenca: null, e0: somarDias(E, -7), e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });

  it('com os marcos da academia', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(10), e0: somarDias(E, -7), e: E, marcos: [5, 10] })).toBe(10);
  });
});

describe('marcoAlcancado', () => {
  it('o maior marco já alcançado, ou null antes do primeiro', () => {
    expect(marcoAlcancado({ ultimaPresenca: ha(6), e: E, marcos: DEFAULT_MARCOS })).toBeNull();
    expect(marcoAlcancado({ ultimaPresenca: ha(29), e: E, marcos: DEFAULT_MARCOS })).toBe(14);
    expect(marcoAlcancado({ ultimaPresenca: ha(400), e: E, marcos: DEFAULT_MARCOS })).toBe(60);
    expect(marcoAlcancado({ ultimaPresenca: 'x', e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.marcos.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/marcos.js' imported from .../src/lib/__tests__/faltosos.marcos.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Implementar os marcos**

Criar `src/lib/faltosos/marcos.js`:

```js
// Marcos de falta: os dias sem vir em que o professor procura o aluno. Cada
// marco vale um contato. Configuráveis em Configurações → Metas & ritmo
// (stronix_config/faltosos), começando em 7, 14, 30 e 60. Mudar os marcos vale
// a partir da próxima importação. Puro.
//
// Chamando de E a data do Faltantes e de E0 a do Faltantes anterior (na
// primeira importação, E menos 7 dias), o aluno atravessou o marco de M dias
// quando a última presença mais M dias cai depois de E0 e até E.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Marcos e tarefas").
import { diasEntre } from './dias.js';

export const DEFAULT_MARCOS = Object.freeze([7, 14, 30, 60]);
export const DEFAULT_JANELA_URGENTE = 90;

// Dias que a primeira importação olha para trás, por não ter E0.
export const JANELA_DA_PRIMEIRA_IMPORTACAO = 7;

const MAX_MARCOS = 6;
const MAX_DIAS = 365;
const diasValidos = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_DIAS;

// De 1 a 6 números inteiros de 1 a 365, sem repetir, devolvidos em ordem numa
// lista nova. Qualquer coisa fora disso cai no padrão.
export function normalizarMarcos(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_MARCOS) return [...DEFAULT_MARCOS];
  if (!raw.every(diasValidos) || new Set(raw).size !== raw.length) return [...DEFAULT_MARCOS];
  return [...raw].sort((a, b) => a - b);
}

// Janela do urgente, em dias inteiros de 1 a 365. Aceita o número ou o texto
// do campo ("60"); fora disso, 90.
export function normalizarJanelaUrgente(raw) {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
  return diasValidos(n) ? n : DEFAULT_JANELA_URGENTE;
}

// O maior marco atravessado entre E0 (exclusive) e E (inclusive), ou null.
export function marcoAtravessado({ ultimaPresenca, e0, e, marcos }) {
  const antes = diasEntre(ultimaPresenca, e0);
  const agora = diasEntre(ultimaPresenca, e);
  if (antes === null || agora === null) return null;
  let maior = null;
  for (const m of normalizarMarcos(marcos)) if (m > antes && m <= agora) maior = m;
  return maior;
}

// O maior marco já alcançado em E (dias sem vir maiores ou iguais a ele), ou
// null antes do primeiro. É o marco da tarefa que nasce só pelo urgente.
export function marcoAlcancado({ ultimaPresenca, e, marcos }) {
  const dias = diasEntre(ultimaPresenca, e);
  if (dias === null) return null;
  let maior = null;
  for (const m of normalizarMarcos(marcos)) if (m <= dias) maior = m;
  return maior;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.marcos.test.js`
Expected: PASS, `Tests  13 passed (13)`.

- [ ] **Step 5: Escrever o teste do urgente**

Criar `src/lib/__tests__/faltosos.urgente.test.js`:

```js
// O urgente e o contrato ativo do aluno faltando (src/lib/faltosos/urgente.js).
// O urgente conta dias no calendário de Brasília. Na máquina de
// desenvolvimento, que fica em Brasília, um erro de fuso não aparece, então
// este arquivo põe o processo em UTC antes de importar, como o zapFuso.test.js,
// e o primeiro teste confere que a troca pegou.

/* global process -- o lint de src/ é o do navegador, e este teste troca o fuso do processo do Node */
import { describe, it, expect, vi, afterAll } from 'vitest';

const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { situacaoDoContrato, fimDoContrato, urgenteDe } from '../faltosos/urgente.js';
import { deriveLeadContractStatus } from '../contracts.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Instante escrito no horário de Brasília: brt('2026-10-06T10:00').
const brt = (s) => new Date(`${s}:00-03:00`);
// Fim de contrato como o app grava: meia-noite de Brasília do dia.
const fim = (dia) => brt(`${dia}T00:00`);

const AGORA = brt('2026-10-06T10:00');
const cliente = (extra = {}) => ({
  lifecycleBucket: 'cliente',
  currentContractId: 'c1',
  currentContractStatus: 'ativo',
  currentContractStartsAt: fim('2026-01-01'),
  currentContractEndsAt: fim('2027-01-01'),
  ...extra,
});

// Renovação marcada para 21/10, com o contrato em uso até 20/10: o resumo do
// lead já aponta a renovação, e o bloco "em uso" guarda o contrato de hoje.
const renovou = (extra = {}) => cliente({
  currentContractId: 'c2',
  currentContractStartsAt: fim('2026-10-21'),
  currentContractEndsAt: fim('2027-10-21'),
  inUseContractId: 'c1',
  inUseContractStatus: 'ativo',
  inUseContractEndsAt: fim('2026-10-20'),
  ...extra,
});

describe('processo em UTC', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

describe('situacaoDoContrato', () => {
  it('ativo e a vencer contam como contrato ativo', () => {
    expect(situacaoDoContrato(cliente(), AGORA)).toBe('ativo');
    expect(situacaoDoContrato(cliente({ currentContractEndsAt: fim('2026-10-20') }), AGORA)).toBe('ativo');
  });

  it('trancado é trancado; vencido, cancelado, agendado e sem contrato não são ativos', () => {
    expect(situacaoDoContrato(cliente({ currentContractStatus: 'trancado' }), AGORA)).toBe('trancado');
    expect(situacaoDoContrato(cliente({ currentContractEndsAt: fim('2026-10-01') }), AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato(cliente({ currentContractStatus: 'cancelado' }), AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato(cliente({ currentContractStartsAt: fim('2026-11-01') }), AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato({ lifecycleBucket: 'cliente' }, AGORA)).toBe('sem_contrato_ativo');
    expect(situacaoDoContrato(null, AGORA)).toBe('sem_contrato_ativo');
  });

  it('no último dia, com o fim gravado à meia-noite, já está vencido, como em Clientes', () => {
    const lead = cliente({ currentContractEndsAt: fim('2026-10-06') });
    expect(deriveLeadContractStatus(lead, AGORA)).toBe('vencido');
    expect(situacaoDoContrato(lead, AGORA)).toBe('sem_contrato_ativo');
  });

  it('com a renovação marcada, vale o contrato em uso: ativo, ou trancado quando ele está trancado', () => {
    expect(situacaoDoContrato(renovou(), AGORA)).toBe('ativo');
    expect(situacaoDoContrato(renovou({ inUseContractStatus: 'trancado' }), AGORA)).toBe('trancado');
  });
});

describe('o fim que vale para o urgente', () => {
  it('é o do último contrato', () => {
    expect(fimDoContrato(cliente())).toEqual(fim('2027-01-01'));
    expect(fimDoContrato({ lifecycleBucket: 'cliente' })).toBeNull();
    expect(fimDoContrato(null)).toBeNull();
  });

  it('com a renovação marcada, é o fim da renovação: quem já renovou não fica urgente', () => {
    expect(fimDoContrato(renovou())).toEqual(fim('2027-10-21'));
    expect(urgenteDe(renovou(), AGORA, 90)).toEqual({ urgente: false, contratoTerminaEm: '2027-10-21' });
  });

  it('a renovação curta, que também termina dentro da janela, deixa o aluno urgente', () => {
    const curta = renovou({ currentContractEndsAt: fim('2026-11-21') });
    expect(urgenteDe(curta, AGORA, 90)).toEqual({ urgente: true, contratoTerminaEm: '2026-11-21' });
  });

  it('o bloco "em uso" que ficou no lead depois de a renovação começar não muda nada', () => {
    const depois = brt('2026-10-22T10:00');
    const semBloco = renovou({ inUseContractId: null, inUseContractStatus: null, inUseContractEndsAt: null });
    expect(urgenteDe(renovou(), depois, 90)).toEqual({ urgente: false, contratoTerminaEm: '2027-10-21' });
    expect(urgenteDe(renovou(), depois, 90)).toEqual(urgenteDe(semBloco, depois, 90));
  });

  it('contrato em uso trancado, com a renovação marcada: não é urgente', () => {
    expect(urgenteDe(renovou({ inUseContractStatus: 'trancado' }), AGORA, 90).urgente).toBe(false);
  });
});

describe('urgenteDe', () => {
  it('contrato que termina em até 90 dias é urgente', () => {
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-12-01') }), AGORA, 90)).toEqual({ urgente: true, contratoTerminaEm: '2026-12-01' });
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-04') }), AGORA, 90)).toEqual({ urgente: true, contratoTerminaEm: '2027-01-04' });
  });

  it('91 dias não é urgente, e a janela é da academia', () => {
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-05') }), AGORA, 90).urgente).toBe(false);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-12-01') }), AGORA, 30).urgente).toBe(false);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-12-01') }), AGORA, '60').urgente).toBe(true);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-04') }), AGORA, 'x').urgente).toBe(true);
  });

  it('o dia conta pelo calendário de Brasília, não pelo UTC', () => {
    // 23h30 de 05/10 em Brasília já é 06/10 em UTC.
    const noite = brt('2026-10-05T23:30');
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-03') }), noite, 90).urgente).toBe(true);
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2027-01-04') }), noite, 90).urgente).toBe(false);
  });

  it('trancado e vencido não são urgentes, mas dizem quando o contrato termina', () => {
    expect(urgenteDe(cliente({ currentContractStatus: 'trancado', currentContractEndsAt: fim('2026-11-01') }), AGORA, 90))
      .toEqual({ urgente: false, contratoTerminaEm: '2026-11-01' });
    expect(urgenteDe(cliente({ currentContractEndsAt: fim('2026-10-01') }), AGORA, 90))
      .toEqual({ urgente: false, contratoTerminaEm: '2026-10-01' });
  });

  it('sem contrato, nada', () => {
    expect(urgenteDe({ lifecycleBucket: 'cliente' }, AGORA, 90)).toEqual({ urgente: false, contratoTerminaEm: null });
    expect(urgenteDe(null, AGORA, 90)).toEqual({ urgente: false, contratoTerminaEm: null });
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.urgente.test.js`
Expected: FAIL, `Error: Cannot find module '/src/lib/faltosos/urgente.js' imported from .../src/lib/__tests__/faltosos.urgente.test.js` (com o `vi.hoisted`, o vitest escreve o caminho a partir da raiz), com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 7: Implementar o urgente**

Criar `src/lib/faltosos/urgente.js`:

```js
// Urgente e contrato ativo do aluno faltando, pelo resumo do lead. Puro.
//
// Contrato ativo é o que deriveLeadContractStatus dá como ativo ou a vencer,
// no mesmo instante que as listas usam: com o fim gravado à meia-noite, o
// contrato fica vencido durante o último dia, e a importação precisa dizer o
// mesmo que Clientes. Por isso as funções recebem o instante (`agora`), e o
// dia de hoje sai dele, no calendário de Brasília.
//
// O fim que vale para o urgente é o do último contrato (currentContractEndsAt).
// Com a renovação já marcada, o último contrato é a renovação, que é o que
// vale depois do contrato em uso: quem já renovou só fica urgente se a
// renovação também termina dentro da janela. O fim do contrato em uso
// (inUseContractEndsAt) não é lido. Ele diria que o contrato termina antes de
// a renovação começar, e o bloco "em uso" continua no lead depois que a
// renovação começa, porque nada o limpa nessa hora.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Urgente").
import { CONTRACT_STATUS, deriveLeadContractStatus } from '../contracts.js';
import { diaEmBrasilia, diasEntre, hojeEmBrasilia } from './dias.js';
import { normalizarJanelaUrgente } from './marcos.js';

// 'ativo' (ativo ou a vencer), 'trancado' ou 'sem_contrato_ativo' (vencido,
// cancelado, agendado ou sem contrato). Com a renovação marcada, vale o
// contrato em uso, pelas regras de deriveLeadContractStatus.
export function situacaoDoContrato(lead, agora) {
  const status = deriveLeadContractStatus(lead, agora);
  if (status === CONTRACT_STATUS.ATIVO || status === CONTRACT_STATUS.A_VENCER) return 'ativo';
  if (status === CONTRACT_STATUS.TRANCADO) return 'trancado';
  return 'sem_contrato_ativo';
}

// O fim do último contrato, como foi gravado (Date ou Timestamp), ou null.
export const fimDoContrato = (lead) => lead?.currentContractEndsAt ?? null;

// { urgente, contratoTerminaEm: 'AAAA-MM-DD' | null }. Urgente: contrato
// ativo que termina em até `janelaDias` dias (padrão 90), contados no
// calendário de Brasília a partir de hoje. contratoTerminaEm vem mesmo sem o
// urgente, para a tela dizer até quando o contrato vai.
export function urgenteDe(lead, agora, janelaDias) {
  const contratoTerminaEm = diaEmBrasilia(fimDoContrato(lead));
  if (!contratoTerminaEm || situacaoDoContrato(lead, agora) !== 'ativo') return { urgente: false, contratoTerminaEm };
  const faltam = diasEntre(hojeEmBrasilia(agora), contratoTerminaEm);
  return {
    urgente: faltam !== null && faltam >= 0 && faltam <= normalizarJanelaUrgente(janelaDias),
    contratoTerminaEm,
  };
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.urgente.test.js`
Expected: PASS, `Tests  15 passed (15)`. O primeiro teste confere que o processo está mesmo em UTC.

- [ ] **Step 9: Escrever o teste da configuração**

Criar `src/lib/__tests__/faltosos.configFaltosos.test.js`:

```js
// A configuração dos faltosos (stronix_config/faltosos), lida por
// src/lib/faltosos/configFaltosos.js do jeito que a importação e as telas a
// recebem: o que vier fora do formato cai no padrão, sem quebrar nada.
import { describe, it, expect } from 'vitest';
import {
  CONFIG_FALTOSOS_PADRAO, configDasTelas, normalizarConfigFaltosos, normalizarUltimaImportacao, periodoOuNull,
  normalizarMarcos, normalizarJanelaUrgente, normalizarProfessorLinks,
} from '../faltosos/configFaltosos.js';
import * as marcos from '../faltosos/marcos.js';
import * as ligacaoProfessores from '../faltosos/ligacaoProfessores.js';

describe('o padrão', () => {
  it('doc ausente: marcos 7, 14, 30 e 60, urgente em 90 dias, sem ligação e sem importação', () => {
    expect(CONFIG_FALTOSOS_PADRAO).toEqual({
      marcos: [7, 14, 30, 60], janelaUrgenteDias: 90, professorLinks: [], ultimaImportacao: null,
    });
    expect(Object.isFrozen(CONFIG_FALTOSOS_PADRAO)).toBe(true);
    expect(normalizarConfigFaltosos(undefined)).toEqual(CONFIG_FALTOSOS_PADRAO);
    expect(normalizarConfigFaltosos('lixo')).toEqual(CONFIG_FALTOSOS_PADRAO);
  });

  it('as regras de cada campo são as dos módulos do motor, sem segunda cópia', () => {
    expect(normalizarMarcos).toBe(marcos.normalizarMarcos);
    expect(normalizarJanelaUrgente).toBe(marcos.normalizarJanelaUrgente);
    expect(normalizarProfessorLinks).toBe(ligacaoProfessores.normalizarProfessorLinks);
  });
});

describe('normalizarConfigFaltosos', () => {
  it('lê cada campo pela regra dele', () => {
    expect(normalizarConfigFaltosos({
      marcos: [30, 7],
      janelaUrgenteDias: '45',
      professorLinks: [{ nome: ' Bruno  Tavares ', professorId: 'p-bruno' }, { nome: 'Controle (não alterar)', professorId: '' }],
      ultimaImportacao: { id: 'f2026-10-06', dataFaltantes: '2026-10-06' },
      outroCampo: 1,
    })).toEqual({
      marcos: [7, 30],
      janelaUrgenteDias: 45,
      professorLinks: [{ nome: 'Bruno Tavares', professorId: 'p-bruno' }, { nome: 'Controle (não alterar)', professorId: null }],
      ultimaImportacao: {
        id: 'f2026-10-06', dataFaltantes: '2026-10-06', dataFaltantesAnterior: null, periodoPresencas: null,
        ultimoDiaPresencas: null, importadoEm: null, importadoPorNome: '',
      },
    });
  });

  it('ler de novo o que já foi lido dá o mesmo', () => {
    const em = new Date('2026-10-06T12:12:00Z');
    const lida = normalizarConfigFaltosos({
      marcos: [7, 14], ultimaImportacao: { id: 'x', dataFaltantes: '2026-10-06', importadoEm: { toDate: () => em }, importadoPorNome: 'Johnny' },
    });
    expect(normalizarConfigFaltosos(lida)).toEqual(lida);
  });
});

describe('normalizarUltimaImportacao', () => {
  it('sem id, nunca houve importação', () => {
    expect(normalizarUltimaImportacao(null)).toBeNull();
    expect(normalizarUltimaImportacao({ dataFaltantes: '2026-10-06' })).toBeNull();
    expect(normalizarUltimaImportacao({ id: '' })).toBeNull();
  });

  it('guarda o último Faltantes, o E0 que ele usou, o último Presenças, quem importou e quando', () => {
    const em = new Date('2026-10-06T12:12:00Z');
    expect(normalizarUltimaImportacao({
      id: 'f2026-10-06_p2026-09-29_2026-10-05',
      dataFaltantes: '2026-10-06',
      dataFaltantesAnterior: '2026-09-29',
      periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' },
      ultimoDiaPresencas: '2026-10-05',
      importadoEm: { toDate: () => em },
      importadoPorNome: ' Johnny ',
    })).toEqual({
      id: 'f2026-10-06_p2026-09-29_2026-10-05',
      dataFaltantes: '2026-10-06',
      dataFaltantesAnterior: '2026-09-29',
      periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' },
      ultimoDiaPresencas: '2026-10-05',
      importadoEm: em,
      importadoPorNome: 'Johnny',
    });
  });

  it('sem ultimoDiaPresencas gravado, vale o fim do período; e fica o maior dos dois', () => {
    expect(normalizarUltimaImportacao({ id: 'a', periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' } }).ultimoDiaPresencas).toBe('2026-10-05');
    expect(normalizarUltimaImportacao({ id: 'a', periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' }, ultimoDiaPresencas: '2026-10-08' }).ultimoDiaPresencas).toBe('2026-10-08');
  });

  it('as datas fora do formato saem', () => {
    expect(normalizarUltimaImportacao({
      id: 'b', dataFaltantes: '06/10/2026', dataFaltantesAnterior: 7, periodoPresencas: { de: '2026-10-05', ate: '2026-10-01' }, importadoEm: 'x',
    })).toEqual({
      id: 'b', dataFaltantes: null, dataFaltantesAnterior: null, periodoPresencas: null, ultimoDiaPresencas: null, importadoEm: null, importadoPorNome: '',
    });
  });

  it('o período do Presenças precisa de dois dias, o primeiro antes do último', () => {
    expect(periodoOuNull({ de: '2026-10-01', ate: '2026-10-01' })).toEqual({ de: '2026-10-01', ate: '2026-10-01' });
    expect(periodoOuNull({ de: '2026-10-02', ate: '2026-10-01' })).toBeNull();
    expect(periodoOuNull({ de: '2026-10-01' })).toBeNull();
    expect(periodoOuNull(null)).toBeNull();
  });
});

describe('configDasTelas', () => {
  it('a tela sem configuração no contexto usa o padrão, marcado como ainda não lido', () => {
    expect(configDasTelas(null)).toEqual({ ...CONFIG_FALTOSOS_PADRAO, pronta: false });
    expect(configDasTelas(undefined)).toEqual({ ...CONFIG_FALTOSOS_PADRAO, pronta: false });
    const lida = { ...CONFIG_FALTOSOS_PADRAO, pronta: true };
    expect(configDasTelas(lida)).toBe(lida);
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.configFaltosos.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/configFaltosos.js' imported from .../src/lib/__tests__/faltosos.configFaltosos.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 11: Implementar a configuração**

Criar `src/lib/faltosos/configFaltosos.js`:

```js
// A configuração dos faltosos, doc único em stronix_config/faltosos: os
// marcos, a janela do urgente, a ligação dos professores da Next Fit e o
// resumo da última importação. A importação grava professorLinks e
// ultimaImportacao; o bloco Faltosos de Metas & ritmo grava marcos, janela e
// professorLinks. O App assina o doc com o módulo ligado e entrega o que sai
// daqui pelo GeneralConfigContext (`faltosos`), e a importação lê o doc pelo
// mesmo caminho. Puro, testado em node. O id do doc (CONFIG_FALTOSOS_ID) mora
// em src/lib/firebase.js, com os caminhos das coleções do módulo.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Os dados" e "Configurações").
import { normalizarJanelaUrgente, normalizarMarcos } from './marcos.js';
import { normalizarProfessorLinks } from './ligacaoProfessores.js';
import { diaValido, maiorDia } from './dias.js';
import { getSafeDateOrNull } from '../dates.js';

// As regras de cada campo moram nos módulos do motor e saem daqui também,
// para quem lê a configuração ter um lugar só para importar.
export { normalizarJanelaUrgente, normalizarMarcos, normalizarProfessorLinks };

const diaOuNull = (v) => (diaValido(v) ? v : null);

// { de, ate } com dois dias válidos, o primeiro até o último; senão null.
export const periodoOuNull = (p) => (
  p && typeof p === 'object' && diaValido(p.de) && diaValido(p.ate) && p.de <= p.ate ? { de: p.de, ate: p.ate } : null
);

// O resumo da última importação, ou null quando nunca houve uma (sem id). É
// por ele que o professor, que não lê stronix_importacoes_nextfit, sabe quando
// foi, e que a importação seguinte tira o E0 dos marcos, a recusa do
// Faltantes mais antigo e o aviso de buraco no Presenças.
// - dataFaltantes: o último Faltantes importado, mesmo que a última
//   importação tenha trazido só o Presenças;
// - dataFaltantesAnterior: o E0 que esse Faltantes usou, para a mesma data
//   importada de novo chegar ao mesmo resultado;
// - periodoPresencas: o último Presenças (entre dois, o que termina depois);
// - ultimoDiaPresencas: o maior dia de Presenças já importado;
// - importadoEm e importadoPorNome: gravados pela importação.
export function normalizarUltimaImportacao(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const periodoPresencas = periodoOuNull(raw.periodoPresencas);
  return {
    id: raw.id,
    dataFaltantes: diaOuNull(raw.dataFaltantes),
    dataFaltantesAnterior: diaOuNull(raw.dataFaltantesAnterior),
    periodoPresencas,
    ultimoDiaPresencas: maiorDia(raw.ultimoDiaPresencas, periodoPresencas?.ate),
    importadoEm: getSafeDateOrNull(raw.importadoEm),
    importadoPorNome: typeof raw.importadoPorNome === 'string' ? raw.importadoPorNome.trim() : '',
  };
}

export function normalizarConfigFaltosos(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    marcos: normalizarMarcos(d.marcos),
    janelaUrgenteDias: normalizarJanelaUrgente(d.janelaUrgenteDias),
    professorLinks: normalizarProfessorLinks(d.professorLinks),
    ultimaImportacao: normalizarUltimaImportacao(d.ultimaImportacao),
  };
}

// Doc ausente: academia que ainda não importou nem configurou nada. O objeto
// é congelado; a lista de marcos dele não, então quem lê não ordena no lugar.
export const CONFIG_FALTOSOS_PADRAO = Object.freeze(normalizarConfigFaltosos(null));

// O que as telas usam quando o contexto ainda não tem a configuração (fora do
// App, nos testes, ou antes da primeira leitura).
export const configDasTelas = (faltosos) => faltosos ?? { ...CONFIG_FALTOSOS_PADRAO, pronta: false };
```

- [ ] **Step 12: Rodar os três, os testes de contrato e o lint**

Run: `npx vitest run src/lib/__tests__/faltosos.marcos.test.js src/lib/__tests__/faltosos.urgente.test.js src/lib/__tests__/faltosos.configFaltosos.test.js`
Expected: PASS, `Test Files  3 passed (3)` e `Tests  38 passed (38)` (13, 15 e 10).

Run: `npx vitest run src/lib/__tests__/contracts.test.js src/lib/__tests__/contractsTab.test.js src/lib/__tests__/contractHistory.test.js`
Expected: PASS, `Test Files  3 passed (3)` e `Tests  305 passed (305)` em `e8423e2`. O `contracts.js` não mudou; o passo só confirma que o `urgente.js` não precisou mexer nele.

Run: `npx eslint src/lib/faltosos src/lib/__tests__/faltosos.marcos.test.js src/lib/__tests__/faltosos.urgente.test.js src/lib/__tests__/faltosos.configFaltosos.test.js`
Expected: nenhuma saída.

- [ ] **Step 13: Commit**

```bash
git add src/lib/faltosos/marcos.js src/lib/faltosos/urgente.js src/lib/faltosos/configFaltosos.js src/lib/__tests__/faltosos.marcos.test.js src/lib/__tests__/faltosos.urgente.test.js src/lib/__tests__/faltosos.configFaltosos.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: marcos, urgente e configuração dos faltosos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Plano da importação (`src/lib/faltosos/planoImportacao.js`)

**Files:**
- Create: `src/lib/faltosos/planoImportacao.js`
- Test: `src/lib/__tests__/faltosos.planoImportacao.test.js` (novo)
- Test: `src/lib/__tests__/faltosos.imports.test.js` (novo, a varredura dos imports do motor)

Depende das Tasks 1, 2 e 3.

Notas:
- O plano é puro: recebe tudo o que foi lido e devolve tudo o que será gravado, a prévia e os avisos. A janela (Task 10) roda de novo a cada escolha do passo curto e a cada ligação à mão, e a gravação (Task 5) relê os estados e roda mais uma vez logo antes de gravar (D4). Só o documento que muda é devolvido, então a mesma importação duas vezes não grava nada.
- **M1, M2, M3, M4 e M6** estão no código: `agora` no lugar de `hojeDia`; as entradas `presencasAtuais`, `professores` e `ligacoes.manuais`; as saídas `recusa`, `prontoParaGravar`, `pendencias.professoresNovos`, `voltasDesfeitas`, `nomesAlunos`, `config` e `registro`; a última importação com `dataFaltantesAnterior` e `ultimoDiaPresencas`, repetindo os valores de antes quando a importação traz um arquivo só; a `tarefa.inicioFalta`; e a última presença conhecida como a maior entre a do Faltantes, a de qualquer dia do Presenças até a data do Faltantes e a guardada.
- **D2.** `idDaImportacao` (`f{E}`, `p{de}_{ate}` ou `f{E}_p{de}_{ate}`, null sem arquivo) e `idDaVolta` (`volta_{leadId}_{inicioFalta}`) moram aqui, porque a Task 5 vem depois: o `lotesImportacao.js` importa daqui e não define outros. O `textoDaVolta` também.
- **C2.** Quem saiu como "voltou" (sem dia; a volta com dia move a última presença) e aparece no Faltantes com a mesma última presença reabre o período, e o id da linha da volta vai para `voltasDesfeitas`, que a gravação apaga. "Encerrado" reabre sem linha a desfazer.
- **C3.** O aluno faltando que não ligou, sem presença no Presenças e com contrato ativo, cujo cliente provável (`clienteProvavel`) é ele numa linha do Faltantes que não ligou (sem par ou ambígua), continua faltando como estava, sem gravação, e vai para `previa.listas.provaveis` e `numeros.provaveis`. Ele fica fora de `sumiram`, a conta do aviso de filtro maior. A linha aparece em `naoLigados.faltantes` com `sugestao` igual a ele, e a ligação à mão resolve. Sem contrato ativo, fecha como "encerrado" do mesmo jeito.
- **C5.** O `professorId` sai da ligação de agora a cada importação. Trocar a ligação em Configurações vale na importação seguinte (ou na mesma, refeita), e a tarefa pendente vai junto, porque ela mora no estado do aluno. O plano não mexe em estado de quem não está no arquivo para trocar professor.
- **D5.** A linha da volta sai sem `type` e sem `hora`. O tipo é da gravação, com o `PRESENCE_RETURN_TYPE` que a Task 5 cria em `src/lib/leads.js` (o plano não importa `leads.js`), e o `createdAt` é o momento da importação, com o dia no `text`.
- **Uma linha de volta por aluno em cada importação, a do período mais recente.** O aluno que voltou entre duas importações, sumiu de novo (período novo) e voltou outra vez depois da data do Faltantes fica só com a última volta; a do período de antes não é gravada. O teste "voltou, sumiu de novo e voltou depois do Faltantes" mostra o caso. A gravação (Task 5) recusa o plano com duas voltas do mesmo aluno, e a volta desfeita (C2) segue em `voltasDesfeitas` do mesmo jeito.
- **`registro.naoLigados`** é a lista `[{ nome, telefone | null, relatorio: 'faltantes' | 'presencas' }]` do contrato: uma linha do Faltantes não ligada ou ambígua leva o telefone, e cada nome do Presenças vai sem telefone. É o que a aba Faltosos do 2B vai mostrar em "Não achados"; no 2A a lista fica no registro e na prévia.
- A linha do Faltantes com a última presença depois da data do arquivo não bate com ele (já está no aviso das datas divergentes) e fica fora do estado. Só acontece em arquivo editado à mão.
- Entre dois Presenças, a última importação fica com o período que termina depois; o `ultimoDiaPresencas` é sempre o maior dia já importado.
- Recusas: `sem_arquivo`, `faltantes_sem_data`, `presencas_sem_data` (Presenças sozinho sem linha legível) e `faltantes_antigo`. Faltantes com a mesma data do último não é recusado.

O que o plano recebe e devolve (o contrato com a gravação, Task 5, e com a janela, Task 10), em forma de esquema:

```text
planejarImportacao({
  faltantes,        // parseFaltantes(rows) ou null
  presencas,        // parsePresencas(rows) ou null
  estadosAtuais,    // { [leadId]: doc } de TODOS os docs de stronix_faltosos
  presencasAtuais,  // { ['<leadId>_<AAAA-MM>']: doc } de stronix_presencas dos meses do arquivo
  clientes,         // leads com lifecycleBucket 'cliente': id, name, whatsapp, guardian, zapMatchKey,
                    //   guardianZapMatchKey, consultantId, consultantAuthUid e o resumo do contrato
  professores,      // stronix_professores (id, nome, ativo)
  ligacoes: { professores, alunos, manuais },
                    // professorLinks com as escolhas do passo curto (juntarProfessorLinks);
                    // { [nomeChave]: doc } de stronix_nextfit_alunos; [{ nomeNextFit, leadId }] da prévia
  config,           // stronix_config/faltosos, cru ou já lido por normalizarConfigFaltosos
  ultimaImportacao, // opcional; sem ele, config.ultimaImportacao
  agora,            // Date: o instante da importação
}) => ({
  recusa,           // null ou { codigo, mensagem }
  prontoParaGravar, // false enquanto houver professor novo sem ligação
  pendencias: { professoresNovos: [{ nome, alunos, sugestao }] },
  importacao: { id, dataFaltantes, dataFaltantesAnterior, periodoPresencas },
  estados: [{ leadId, doc }],                  // stronix_faltosos/{leadId}: doc inteiro, para set sem merge
  voltas: [{ id, leadId, inicioFalta, voltouEm, voltouEntre, text, importacaoId,
             lead: { id, name, consultantId, consultantAuthUid } }],  // no máximo uma por aluno, a mais recente
  voltasDesfeitas: [id],                       // ids das linhas a apagar: 'volta_{leadId}_{inicioFalta}'
  presencasPorDoc: [{ id, doc: { leadId, mes, dias } }],  // o mês inteiro, já juntado com o guardado
  nomesAlunos: [{ id: nomeChave, doc: { nomeNextFit, leadIds, origem } }],  // a gravação põe atualizadoEm
  config: {         // stronix_config/faltosos, com merge; a gravação põe importadoEm e importadoPorNome
    ultimaImportacao: { id, dataFaltantes, dataFaltantesAnterior, periodoPresencas, ultimoDiaPresencas },
    professorLinks, // só quando mudou
  },
  registro: {       // stronix_importacoes_nextfit/{importacao.id}; a gravação põe importadoPor, importadoPorNome e importadoEm
    dataFaltantes, dataFaltantesAnterior, periodoPresencas, numeros, avisos: [{ codigo, mensagem }],
    naoLigados: [{ nome, telefone, relatorio }],  // telefone null no Presenças; relatorio 'faltantes' ou 'presencas'
  },
  previa: {
    dataFaltantes, dataFaltantesAnterior, periodoPresencas, numeros, porProfessor,
    listas: { professoresNovos, naoLigados, ambiguos, foraSemContrato, voltaram, encerrados, provaveis, erros },
  },
  avisos: [{ codigo: 'datas_divergentes' | 'filtro_maior' | 'buraco_presencas', mensagem, e os números de cada aviso }],
})
```

O documento de `stronix_faltosos/{leadId}` que o plano monta: `leadId`, `professorId`, `professorNextFit`, `contratoNextFit`, `ultimaPresenca`, `inicioFalta`, `status`, `voltouEm`, `voltouEntre`, `diasNaImportacao`, `urgente`, `contratoTerminaEm`, `querCancelarEm` (preservado), `atualizadoNaImportacao` e `tarefa` (`marco`, `urgente`, `status`, `inicioFalta`, `criadaEm` como `AAAA-MM-DD` do dia da importação, `importacaoId`, `feitaEm`, `feitaPor`, `feitaPorNome`, `canal`, `resultado`), ou `tarefa: null`. Nenhum campo sai `undefined`. Campo que o PR 3 gravar no estado é preservado, porque o plano parte do documento lido.

- [ ] **Step 1: Escrever o teste do plano**

Criar `src/lib/__tests__/faltosos.planoImportacao.test.js`:

```js
// O plano da importação (src/lib/faltosos/planoImportacao.js): comparação com
// a importação anterior, marcos, tarefas, urgente, presenças por dia, avisos,
// recusas e o que é gravado. As planilhas são falsas, com o cabeçalho das de
// verdade e nomes e telefones inventados. `aplicar` faz o papel da gravação,
// para conferir que a mesma importação duas vezes não muda nada.
import { describe, it, expect } from 'vitest';
import {
  planejarImportacao, e0Da, idDaImportacao, idDaVolta, textoDaVolta, STATUS, TAREFA,
} from '../faltosos/planoImportacao.js';
import { parseFaltantes, parsePresencas } from '../faltosos/nextfitArquivos.js';
import { somarDias } from '../faltosos/dias.js';

const brt = (s) => new Date(`${s}:00-03:00`);
const fimContrato = (dia) => brt(`${dia}T00:00`);
const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

const E1 = '2026-10-06';
const AGORA1 = brt('2026-10-06T10:00');
const E2 = '2026-10-13';
const AGORA2 = brt('2026-10-13T10:00');
const E3 = '2026-10-20';
const AGORA3 = brt('2026-10-20T10:00');

const fone = (n) => `(51) 9 9100-${String(n).padStart(4, '0')}`;
const cliente = (id, name, n, extra = {}) => ({
  id,
  name,
  whatsapp: fone(n),
  lifecycleBucket: 'cliente',
  consultantId: 'cons-1',
  consultantAuthUid: 'uid-cons-1',
  currentContractId: `c-${id}`,
  currentContractStatus: 'ativo',
  currentContractStartsAt: fimContrato('2026-01-10'),
  currentContractEndsAt: fimContrato('2027-06-10'),
  ...extra,
});

// Linha do Faltantes de quem está há `dias` dias sem vir na data `e`.
const linhaF = (nome, n, e, dias, professor = 'Ana Paula Ribeiro') => ({
  Nome: nome,
  Contrato: 'Plano Anual',
  'Qtde de ausências': dias,
  'Última presença': br(somarDias(e, -dias)),
  Telefone: n == null ? '' : fone(n),
  Professor: professor,
  Consultor: 'Carla Mendes',
});
const arquivoF = (linhas) => parseFaltantes(linhas.map((l, i) => ({ __row: i + 2, ...l })));
const linhaP = (nome, dia, hora, tipo = 'Acesso', modalidade = 'offf') => ({
  Cliente: nome, Modalidade: modalidade, Contrato: 'Plano Anual', Tipo: tipo, Data: `${br(dia)} ${hora}`,
});
const arquivoP = (linhas) => parsePresencas(linhas.map((l, i) => ({ __row: i + 2, ...l })));

const PROFESSORES = [
  { id: 'p-ana', nome: 'Ana Paula Ribeiro', ativo: true },
  { id: 'p-bruno', nome: 'Bruno Tavares', ativo: true },
];
const LINKS = [
  { nome: 'Ana Paula Ribeiro', professorId: 'p-ana' },
  { nome: 'Bruno Tavares', professorId: 'p-bruno' },
  { nome: 'Controle (não alterar)', professorId: null },
];
const CONFIG = { marcos: [7, 14, 30, 60], janelaUrgenteDias: 90, professorLinks: LINKS };

const CLIENTES = [
  cliente('ana', 'Ana Teste', 1),
  cliente('bia', 'Bia Teste', 2),
  cliente('caio', 'Caio Teste', 3),
  cliente('duda', 'Duda Teste', 4),
  cliente('edu', 'Edu Teste', 5),
  cliente('fabi', 'Fabi Teste', 6, { currentContractStatus: 'trancado' }),
  cliente('gui', 'Gui Teste', 7, { currentContractEndsAt: fimContrato('2026-10-01') }),
  cliente('helo', 'Helo Teste', 8),
  cliente('ivo', 'Ivo Teste', 9),
];

const SEMANA1 = arquivoF([
  linhaF('Ana Teste', 1, E1, 7),
  linhaF('Bia Teste', 2, E1, 13, 'Bruno Tavares'),
  linhaF('Caio Teste', 3, E1, 20),
  linhaF('Duda Teste', 4, E1, 25, 'Bruno Tavares'),
  linhaF('Edu Teste', 5, E1, 400),
  linhaF('Fabi Teste', 6, E1, 10),
  linhaF('Gui Teste', 7, E1, 8),
  linhaF('Helo Teste', 8, E1, 9, 'Controle (não alterar)'),
  linhaF('Ninguém Teste', 99, E1, 12),
]);

const MUNDO_VAZIO = { estados: {}, presencas: {}, nomes: {}, interacoes: {}, config: CONFIG };

const planejar = (mundo, { faltantes = null, presencas = null, agora, clientes = CLIENTES, manuais = [], links } = {}) => planejarImportacao({
  faltantes,
  presencas,
  estadosAtuais: mundo.estados,
  presencasAtuais: mundo.presencas,
  clientes,
  professores: PROFESSORES,
  ligacoes: { professores: links ?? mundo.config.professorLinks, alunos: mundo.nomes, manuais },
  config: mundo.config,
  agora,
});

// O que a gravação faria com o plano.
const aplicar = (mundo, plano) => {
  expect(plano.recusa).toBeNull();
  const estados = { ...mundo.estados };
  for (const { leadId, doc } of plano.estados) estados[leadId] = doc;
  const presencas = { ...mundo.presencas };
  for (const { id, doc } of plano.presencasPorDoc) presencas[id] = doc;
  const nomes = { ...mundo.nomes };
  for (const { id, doc } of plano.nomesAlunos) nomes[id] = doc;
  const interacoes = { ...mundo.interacoes };
  for (const id of plano.voltasDesfeitas) delete interacoes[id];
  for (const v of plano.voltas) interacoes[v.id] = v;
  return { estados, presencas, nomes, interacoes, config: { ...mundo.config, ...plano.config } };
};

const nadaMuda = (plano) => {
  expect(plano.estados).toEqual([]);
  expect(plano.voltas).toEqual([]);
  expect(plano.voltasDesfeitas).toEqual([]);
  expect(plano.presencasPorDoc).toEqual([]);
  expect(plano.nomesAlunos).toEqual([]);
};

const estadoDe = (plano, leadId) => plano.estados.find((e) => e.leadId === leadId)?.doc;

const ID1 = 'f2026-10-06';

describe('recusas', () => {
  it('sem arquivo nenhum', () => {
    expect(planejar(MUNDO_VAZIO, { agora: AGORA1 }).recusa).toEqual({ codigo: 'sem_arquivo', mensagem: 'Escolha o relatório Faltantes, o Presenças ou os dois.' });
  });

  it('Faltantes sem nenhuma linha legível', () => {
    const plano = planejar(MUNDO_VAZIO, { faltantes: parseFaltantes([{ __row: 2, Nome: 'X', 'Última presença': 'ontem' }]), agora: AGORA1 });
    expect(plano.recusa.codigo).toBe('faltantes_sem_data');
    expect(plano.estados).toEqual([]);
    expect(plano.prontoParaGravar).toBe(false);
  });

  it('Presenças sozinho sem nenhuma linha legível', () => {
    const plano = planejar(MUNDO_VAZIO, { presencas: parsePresencas([{ __row: 2, Cliente: 'X', Tipo: 'Acesso', Data: 'ontem' }]), agora: AGORA1 });
    expect(plano.recusa).toEqual({
      codigo: 'presencas_sem_data',
      mensagem: 'Nenhuma linha do Presenças tem o cliente, o tipo e a data legíveis. Confira se é o relatório Presenças da Next Fit.',
    });
  });

  it('Faltantes mais antigo que o último importado', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: 'f2026-10-13', dataFaltantes: E2 } } };
    const plano = planejar(mundo, { faltantes: SEMANA1, agora: AGORA2 });
    expect(plano.recusa).toEqual({
      codigo: 'faltantes_antigo',
      mensagem: 'Este Faltantes é de 06/10/2026, mais antigo que o último importado, de 13/10/2026. Exporte o relatório de hoje.',
    });
  });

  it('com a mesma data do último, não é recusado', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1 } } };
    expect(planejar(mundo, { faltantes: SEMANA1, agora: AGORA1 }).recusa).toBeNull();
  });
});

describe('primeira importação', () => {
  const plano = planejar(MUNDO_VAZIO, { faltantes: SEMANA1, agora: AGORA1 });

  it('a data sai do conteúdo, e E0 é E menos 7 dias', () => {
    expect(plano.importacao).toEqual({ id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29', periodoPresencas: null });
    expect(plano.prontoParaGravar).toBe(true);
  });

  it('cada aluno ativo ganha o estado, com a tarefa do marco atravessado', () => {
    expect(estadoDe(plano, 'ana')).toEqual({
      leadId: 'ana',
      professorId: 'p-ana',
      professorNextFit: 'Ana Paula Ribeiro',
      contratoNextFit: 'Plano Anual',
      urgente: false,
      contratoTerminaEm: '2027-06-10',
      atualizadoNaImportacao: ID1,
      ultimaPresenca: '2026-09-29',
      inicioFalta: '2026-09-29',
      status: STATUS.FALTANDO,
      voltouEm: null,
      voltouEntre: null,
      diasNaImportacao: 7,
      querCancelarEm: null,
      tarefa: {
        marco: 7, urgente: false, status: TAREFA.PENDENTE, inicioFalta: '2026-09-29', criadaEm: E1, importacaoId: ID1,
        feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null,
      },
    });
    expect(estadoDe(plano, 'caio').tarefa.marco).toBe(14);
    expect(estadoDe(plano, 'duda').tarefa).toBeNull();
    expect(estadoDe(plano, 'edu').tarefa).toBeNull();
    expect(estadoDe(plano, 'helo')).toMatchObject({ professorId: null, tarefa: { marco: 7 } });
  });

  it('quem está sem contrato ativo ou trancado não ganha estado e aparece na prévia', () => {
    expect(estadoDe(plano, 'fabi')).toBeUndefined();
    expect(estadoDe(plano, 'gui')).toBeUndefined();
    expect(plano.previa.listas.foraSemContrato).toEqual([
      { leadId: 'fabi', nome: 'Fabi Teste', motivo: 'trancado' },
      { leadId: 'gui', nome: 'Gui Teste', motivo: 'sem_contrato_ativo' },
    ]);
  });

  it('os números da prévia', () => {
    expect(plano.previa.numeros).toEqual({
      linhasFaltantes: 9,
      linhasPresencas: 0,
      errosFaltantes: 0,
      errosPresencas: 0,
      ligadosFaltantes: 8,
      naoLigadosFaltantes: 1,
      alunosNoPresencas: 0,
      naoLigadosPresencas: 0,
      duplicados: 0,
      faltando: 6,
      entramNoMarco: { 7: 3, 14: 1, 30: 0, 60: 0 },
      urgentes: 0,
      urgentesNovos: 0,
      tarefasPendentes: 4,
      acompanhamento: 2,
      semProfessor: 1,
      voltaram: 0,
      encerrados: 0,
      foraSemContrato: 2,
      provaveis: 0,
      diasDePresenca: 0,
    });
    expect(plano.previa.porProfessor).toEqual([
      { professorId: 'p-ana', nome: 'Ana Paula Ribeiro', alunos: 3, pendentes: 2, urgentes: 0 },
      { professorId: 'p-bruno', nome: 'Bruno Tavares', alunos: 2, pendentes: 1, urgentes: 0 },
      { professorId: null, nome: null, alunos: 1, pendentes: 1, urgentes: 0 },
    ]);
  });

  it('o não ligado vai para a prévia e para o registro, com o telefone', () => {
    expect(plano.previa.listas.naoLigados.faltantes).toEqual([{
      numero: 10, nome: 'Ninguém Teste', telefone: fone(99), professorNextFit: 'Ana Paula Ribeiro',
      ultimaPresenca: '2026-09-24', ausencias: 12, sugestao: null,
    }]);
    expect(plano.registro.naoLigados).toEqual([{ nome: 'Ninguém Teste', telefone: fone(99), relatorio: 'faltantes' }]);
  });

  it('guarda o nome da Next Fit de quem ligou pelo telefone', () => {
    expect(plano.nomesAlunos).toHaveLength(8);
    expect(plano.nomesAlunos[0]).toEqual({ id: 'ana teste', doc: { nomeNextFit: 'Ana Teste', leadIds: ['ana'], origem: 'telefone' } });
  });

  it('a configuração guarda a última importação, sem Presenças ainda, e o registro leva os números', () => {
    expect(plano.config).toEqual({
      ultimaImportacao: { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29', periodoPresencas: null, ultimoDiaPresencas: null },
    });
    expect(plano.registro).toMatchObject({ dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29', periodoPresencas: null, avisos: [] });
    expect(plano.registro.numeros).toEqual(plano.previa.numeros);
    expect(plano.avisos).toEqual([]);
  });

  it('importar de novo os mesmos arquivos não muda nada', () => {
    const mundo = aplicar(MUNDO_VAZIO, plano);
    const deNovo = planejar(mundo, { faltantes: SEMANA1, agora: AGORA1 });
    nadaMuda(deNovo);
    expect(deNovo.importacao.dataFaltantesAnterior).toBe('2026-09-29');
  });

  it('refazer a mesma data com um aluno ligado à mão dá a ele a tarefa que a primeira teria dado', () => {
    const mundo = aplicar(MUNDO_VAZIO, plano);
    const clientes = [...CLIENTES, cliente('nina', 'Nina Teste', 50)];
    const deNovo = planejar(mundo, { faltantes: SEMANA1, agora: AGORA1, clientes, manuais: [{ nomeNextFit: 'Ninguém Teste', leadId: 'nina' }] });
    expect(deNovo.estados.map((e) => e.leadId)).toEqual(['nina']);
    expect(estadoDe(deNovo, 'nina').tarefa).toMatchObject({ marco: 7, status: TAREFA.PENDENTE });
    expect(deNovo.nomesAlunos).toEqual([{ id: 'ninguem teste', doc: { nomeNextFit: 'Ninguém Teste', leadIds: ['nina'], origem: 'manual' } }]);
  });
});

describe('professor novo', () => {
  it('para no passo curto, com a sugestão, e não deixa gravar', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7, 'Carla Nova Souza'), linhaF('Bia Teste', 2, E1, 8, 'Bruno Tav')]);
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1 });
    expect(plano.prontoParaGravar).toBe(false);
    expect(plano.pendencias.professoresNovos).toEqual([
      { nome: 'Bruno Tav', alunos: 1, sugestao: null },
      { nome: 'Carla Nova Souza', alunos: 1, sugestao: null },
    ]);
    expect(estadoDe(plano, 'ana').professorId).toBeNull();
  });

  it('com as escolhas do passo curto, segue e guarda as ligações novas', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7, 'Carla Nova Souza')]);
    const links = [...LINKS, { nome: 'Carla Nova Souza', professorId: 'p-ana' }];
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1, links });
    expect(plano.prontoParaGravar).toBe(true);
    expect(estadoDe(plano, 'ana').professorId).toBe('p-ana');
    expect(plano.config.professorLinks).toEqual([
      { nome: 'Ana Paula Ribeiro', professorId: 'p-ana' },
      { nome: 'Bruno Tavares', professorId: 'p-bruno' },
      { nome: 'Carla Nova Souza', professorId: 'p-ana' },
      { nome: 'Controle (não alterar)', professorId: null },
    ]);
  });

  it('a ligação trocada em Configurações vale na importação seguinte, e a tarefa pendente vai junto', () => {
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7)]), agora: AGORA1 }));
    expect(mundo.estados.ana.professorId).toBe('p-ana');
    const trocado = { ...mundo, config: { ...mundo.config, professorLinks: LINKS.map((l) => (l.nome === 'Ana Paula Ribeiro' ? { ...l, professorId: 'p-bruno' } : l)) } };
    const plano = planejar(trocado, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14)]), agora: AGORA2 });
    expect(estadoDe(plano, 'ana')).toMatchObject({ professorId: 'p-bruno', professorNextFit: 'Ana Paula Ribeiro', tarefa: { marco: 14, status: TAREFA.PENDENTE } });
    expect(plano.config.professorLinks).toBeUndefined();
  });
});

describe('a semana seguinte', () => {
  // A primeira importação gravada, a tarefa da Bia feita pelo professor e o
  // contrato da Helo cancelado depois.
  const depoisDaPrimeira = (() => {
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: SEMANA1, agora: AGORA1 }));
    const bia = mundo.estados.bia;
    return {
      ...mundo,
      estados: { ...mundo.estados, bia: { ...bia, tarefa: { ...bia.tarefa, status: TAREFA.FEITA, feitaPor: 'u-prof', resultado: 'respondeu' } } },
    };
  })();
  const clientes = CLIENTES.map((c) => (c.id === 'helo' ? { ...c, currentContractStatus: 'cancelado' } : c));
  const faltantes = arquivoF([
    linhaF('Ana Teste', 1, E2, 14),
    linhaF('Bia Teste', 2, E2, 20, 'Bruno Tavares'),
    linhaF('Caio Teste', 3, E2, 27),
    linhaF('Ivo Teste', 9, E2, 8),
  ]);
  const presencas = arquivoP([
    linhaP('Duda Teste', '2026-10-09', '07:15'),
    linhaP('Duda Teste', '2026-10-09', '18:00', 'Agenda', 'Pilates'),
    linhaP('Duda Teste', '2026-10-11', '08:00', 'Acesso', ''),
    linhaP('Desconhecido Teste', '2026-10-10', '09:00'),
  ]);
  const plano = planejar(depoisDaPrimeira, { faltantes, presencas, agora: AGORA2, clientes });
  const ID2 = 'f2026-10-13_p2026-10-09_2026-10-11';

  it('E0 é a data do Faltantes anterior', () => {
    expect(plano.importacao).toEqual({ id: ID2, dataFaltantes: E2, dataFaltantesAnterior: E1, periodoPresencas: { de: '2026-10-09', ate: '2026-10-11' } });
  });

  it('a tarefa pendente troca de marco no mesmo card', () => {
    expect(estadoDe(plano, 'ana').tarefa).toEqual({ ...depoisDaPrimeira.estados.ana.tarefa, marco: 14, importacaoId: ID2 });
    expect(estadoDe(plano, 'ana').tarefa.criadaEm).toBe(E1);
  });

  it('com a tarefa do marco anterior feita, nasce a do marco novo', () => {
    expect(estadoDe(plano, 'bia').tarefa).toMatchObject({ marco: 14, status: TAREFA.PENDENTE, criadaEm: E2, importacaoId: ID2 });
  });

  it('sem marco atravessado, a tarefa não muda', () => {
    expect(estadoDe(plano, 'caio').tarefa).toBe(depoisDaPrimeira.estados.caio.tarefa);
    expect(estadoDe(plano, 'caio').diasNaImportacao).toBe(27);
  });

  it('quem sumiu do Faltantes e passou na catraca voltou nesse dia', () => {
    expect(estadoDe(plano, 'duda')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-09', voltouEntre: null, ultimaPresenca: '2026-10-11', urgente: false });
    expect(plano.voltas.find((v) => v.leadId === 'duda')).toEqual({
      id: 'volta_duda_2026-09-11',
      leadId: 'duda',
      inicioFalta: '2026-09-11',
      voltouEm: '2026-10-09',
      voltouEntre: null,
      text: 'Voltou a treinar em 09/10',
      importacaoId: ID2,
      lead: { id: 'duda', name: 'Duda Teste', consultantId: 'cons-1', consultantAuthUid: 'uid-cons-1' },
    });
  });

  it('quem sumiu sem presença e com contrato ativo voltou entre a última presença e o Faltantes', () => {
    expect(estadoDe(plano, 'edu')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: null, voltouEntre: { de: '2025-09-02', ate: E2 } });
    expect(plano.voltas.find((v) => v.leadId === 'edu').text).toBe('Voltou a treinar entre 02/09 e 13/10');
  });

  it('quem sumiu sem contrato ativo fecha como encerrado, sem linha na linha do tempo', () => {
    expect(estadoDe(plano, 'helo')).toMatchObject({ status: STATUS.ENCERRADO, tarefa: { status: TAREFA.ENCERRADA, marco: 7 } });
    expect(plano.voltas.some((v) => v.leadId === 'helo')).toBe(false);
  });

  it('aluno novo no arquivo começa o período e atravessa o primeiro marco', () => {
    expect(estadoDe(plano, 'ivo')).toMatchObject({ inicioFalta: '2026-10-05', tarefa: { marco: 7 } });
  });

  it('presenças por dia: hora menor, catraca e agenda juntas, sem "offf" nem vazio', () => {
    expect(plano.presencasPorDoc).toEqual([{
      id: 'duda_2026-10',
      doc: {
        leadId: 'duda',
        mes: '2026-10',
        dias: {
          '2026-10-09': { hora: '07:15', origens: ['agenda', 'catraca'], modalidades: ['Pilates'] },
          '2026-10-11': { hora: '08:00', origens: ['catraca'], modalidades: [] },
        },
      },
    }]);
    expect(plano.previa.listas.naoLigados.presencas).toEqual([{ nome: 'Desconhecido Teste', linhas: 1 }]);
    // No registro, o nome do Presenças vai sem telefone.
    expect(plano.registro.naoLigados).toEqual([{ nome: 'Desconhecido Teste', telefone: null, relatorio: 'presencas' }]);
  });

  it('os números da semana', () => {
    expect(plano.previa.numeros).toMatchObject({
      entramNoMarco: { 7: 1, 14: 2, 30: 0, 60: 0 },
      voltaram: 2,
      encerrados: 1,
      faltando: 4,
      tarefasPendentes: 4,
      acompanhamento: 0,
      diasDePresenca: 2,
    });
    expect(plano.avisos).toEqual([]);
  });

  it('a configuração passa a lembrar o último dia do Presenças', () => {
    expect(plano.config.ultimaImportacao).toEqual({
      id: ID2, dataFaltantes: E2, dataFaltantesAnterior: E1, periodoPresencas: { de: '2026-10-09', ate: '2026-10-11' }, ultimoDiaPresencas: '2026-10-11',
    });
  });

  it('importar de novo os mesmos arquivos não muda nada', () => {
    const mundo = aplicar(depoisDaPrimeira, plano);
    nadaMuda(planejar(mundo, { faltantes, presencas, agora: AGORA2, clientes }));
  });
});

describe('período novo, mesmo período e reabertura', () => {
  const base = (estados, ultimaImportacao) => ({ ...MUNDO_VAZIO, estados, config: { ...CONFIG, ultimaImportacao } });
  const tarefa = (marco, inicioFalta, extra = {}) => ({
    marco, urgente: false, status: TAREFA.PENDENTE, inicioFalta, criadaEm: '2026-09-29', importacaoId: 'f-antiga',
    feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null, ...extra,
  });
  const faltando = (inicioFalta, t) => ({
    leadId: 'ana', professorId: 'p-ana', professorNextFit: 'Ana Paula Ribeiro', contratoNextFit: 'Plano Anual',
    urgente: false, contratoTerminaEm: '2027-06-10', atualizadoNaImportacao: 'f-antiga', ultimaPresenca: inicioFalta,
    inicioFalta, status: STATUS.FALTANDO, voltouEm: null, voltouEntre: null, diasNaImportacao: 10, querCancelarEm: null, tarefa: t,
  });

  it('última presença mais nova: o período de antes fecha como voltou e a tarefa pendente também', () => {
    const mundo = base({ ana: faltando('2026-09-10', tarefa(14, '2026-09-10')) }, { id: 'f2026-10-13', dataFaltantes: E2 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E3, 25)]), agora: AGORA3 });
    expect(plano.voltas).toEqual([expect.objectContaining({
      id: idDaVolta('ana', '2026-09-10'), voltouEm: null, voltouEntre: { de: '2026-09-11', ate: '2026-09-25' }, text: 'Voltou a treinar entre 11/09 e 25/09',
    })]);
    const ana = estadoDe(plano, 'ana');
    expect(ana).toMatchObject({ status: STATUS.FALTANDO, inicioFalta: '2026-09-25', diasNaImportacao: 25 });
    // Sem marco atravessado no período novo: fica a tarefa de antes, fechada.
    expect(ana.tarefa).toMatchObject({ status: TAREFA.VOLTOU, marco: 14, inicioFalta: '2026-09-10' });
    expect(plano.previa.numeros.acompanhamento).toBe(1);
  });

  it('com o Presenças da época, a volta do período de antes tem dia', () => {
    const mundo = base({ ana: faltando('2026-09-10', tarefa(14, '2026-09-10')) }, { id: 'f2026-10-13', dataFaltantes: E2 });
    const plano = planejar(mundo, {
      faltantes: arquivoF([linhaF('Ana Teste', 1, E3, 25)]),
      presencas: arquivoP([linhaP('Ana Teste', '2026-09-15', '06:50'), linhaP('Ana Teste', '2026-09-25', '07:00')]),
      agora: AGORA3,
    });
    expect(plano.voltas).toEqual([expect.objectContaining({ voltouEm: '2026-09-15', voltouEntre: null, text: 'Voltou a treinar em 15/09' })]);
  });

  it('voltou, sumiu de novo e voltou depois do Faltantes: fica só a volta mais recente', () => {
    const mundo = base({ ana: faltando('2026-09-10', tarefa(14, '2026-09-10')) }, { id: 'f2026-10-13', dataFaltantes: E2 });
    const plano = planejar(mundo, {
      faltantes: arquivoF([linhaF('Ana Teste', 1, E3, 25)]),
      presencas: arquivoP([linhaP('Ana Teste', '2026-10-22', '07:00')]),
      agora: brt('2026-10-23T10:00'),
    });
    // Uma linha de volta por aluno em cada importação: a do período que
    // começou em 25/09. A do período de antes não é gravada.
    expect(plano.voltas.map((v) => [v.id, v.voltouEm, v.voltouEntre])).toEqual([
      ['volta_ana_2026-09-25', '2026-10-22', null],
    ]);
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, inicioFalta: '2026-09-25', voltouEm: '2026-10-22', ultimaPresenca: '2026-10-22' });
    expect(plano.previa.listas.voltaram).toEqual([{ leadId: 'ana', nome: 'Ana Teste', voltouEm: '2026-10-22', voltouEntre: null }]);
    expect(plano.previa.numeros.voltaram).toBe(1);
  });

  it('a mesma última presença de quem saiu como "voltou" sem dia reabre o período e desfaz a linha', () => {
    const voltou = {
      ...faltando('2026-09-29', null), status: STATUS.VOLTOU, voltouEntre: { de: '2026-09-30', ate: E1 }, tarefa: tarefa(7, '2026-09-29', { status: TAREFA.VOLTOU }),
    };
    const mundo = base({ ana: voltou }, { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29' });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14)]), agora: AGORA2 });
    expect(plano.voltasDesfeitas).toEqual(['volta_ana_2026-09-29']);
    expect(estadoDe(plano, 'ana')).toMatchObject({
      status: STATUS.FALTANDO, voltouEntre: null, inicioFalta: '2026-09-29', tarefa: { marco: 14, status: TAREFA.PENDENTE },
    });
  });

  it('a mesma última presença de quem fechou como encerrado reabre o período, sem linha a desfazer', () => {
    const encerrado = { ...faltando('2026-09-29', tarefa(7, '2026-09-29', { status: TAREFA.ENCERRADA })), status: STATUS.ENCERRADO };
    const mundo = base({ ana: encerrado }, { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29' });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14)]), agora: AGORA2 });
    expect(plano.voltasDesfeitas).toEqual([]);
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.FALTANDO, inicioFalta: '2026-09-29', tarefa: { marco: 14, status: TAREFA.PENDENTE } });
  });

  it('quem já se sabe que veio depois da data do Faltantes não muda', () => {
    const voltou = { ...faltando('2026-09-29', null), status: STATUS.VOLTOU, voltouEm: '2026-10-08', ultimaPresenca: '2026-10-08' };
    const mundo = base({ ana: voltou }, { id: ID1, dataFaltantes: E1 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7)]), agora: AGORA2 });
    expect(plano.estados).toEqual([]);
    expect(plano.voltas).toEqual([]);
    expect(plano.voltasDesfeitas).toEqual([]);
  });

  it('no arquivo, mas com o contrato trancado: o período aberto fecha como encerrado', () => {
    const mundo = base({ ana: faltando('2026-09-29', tarefa(7, '2026-09-29')) }, { id: ID1, dataFaltantes: E1 });
    const clientes = CLIENTES.map((c) => (c.id === 'ana' ? { ...c, currentContractStatus: 'trancado' } : c));
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14), linhaF('Ivo Teste', 9, E2, 8)]), agora: AGORA2, clientes });
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.ENCERRADO, tarefa: { status: TAREFA.ENCERRADA } });
    expect(plano.previa.listas.foraSemContrato).toEqual([{ leadId: 'ana', nome: 'Ana Teste', motivo: 'trancado' }]);
    expect(plano.voltas).toEqual([]);
  });

  it('o lead que sumiu do Stronilead fecha como encerrado', () => {
    const zeca = { ...faltando('2026-09-29', null), leadId: 'zeca' };
    const mundo = base({ zeca }, { id: ID1, dataFaltantes: E1 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ivo Teste', 9, E2, 8)]), agora: AGORA2 });
    expect(estadoDe(plano, 'zeca')).toMatchObject({ status: STATUS.ENCERRADO });
  });

  it('troca de professor na Next Fit: a tarefa pendente vai junto', () => {
    const mundo = base({ ana: faltando('2026-09-29', tarefa(7, '2026-09-29')) }, { id: ID1, dataFaltantes: E1 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14, 'Bruno Tavares')]), agora: AGORA2 });
    expect(estadoDe(plano, 'ana')).toMatchObject({ professorId: 'p-bruno', professorNextFit: 'Bruno Tavares', tarefa: { marco: 14, status: TAREFA.PENDENTE } });
  });

  it('a mesma pessoa duas vezes no arquivo vale uma, com a presença mais nova', () => {
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 10), linhaF('Ana Teste', 1, E1, 7)]), agora: AGORA1 });
    expect(plano.previa.numeros.duplicados).toBe(1);
    expect(estadoDe(plano, 'ana').inicioFalta).toBe('2026-09-29');
  });
});

describe('telefone trocado no Stronilead', () => {
  // A primeira importação gravada. Depois, o WhatsApp da Ana muda no
  // Stronilead, e o Faltantes seguinte ainda traz o número antigo, que não
  // acha mais ninguém.
  const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, {
    faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8)]), agora: AGORA1,
  }));
  const clientes = CLIENTES.map((c) => (c.id === 'ana' ? { ...c, whatsapp: fone(77) } : c));
  const faltantes = arquivoF([linhaF('Ana Teste', 1, E2, 14), linhaF('Bia Teste', 2, E2, 15)]);
  const plano = planejar(mundo, { faltantes, agora: AGORA2, clientes });

  it('o aluno continua faltando como estava, sem linha de volta', () => {
    expect(estadoDe(plano, 'ana')).toBeUndefined();
    expect(plano.voltas.some((v) => v.leadId === 'ana')).toBe(false);
    expect(plano.previa.numeros).toMatchObject({ faltando: 2, voltaram: 0, provaveis: 1 });
  });

  it('vai para a prévia como provável mesma pessoa, e a linha sugere a ligação', () => {
    expect(plano.previa.listas.provaveis).toEqual([{
      leadId: 'ana',
      nome: 'Ana Teste',
      linha: { numero: 2, nome: 'Ana Teste', telefone: fone(1), professorNextFit: 'Ana Paula Ribeiro', ultimaPresenca: '2026-09-29', ausencias: 14 },
    }]);
    expect(plano.previa.listas.naoLigados.faltantes[0]).toMatchObject({ nome: 'Ana Teste', sugestao: 'ana' });
  });

  it('ligado à mão na prévia, segue o período, no marco seguinte', () => {
    const deNovo = planejar(mundo, { faltantes, agora: AGORA2, clientes, manuais: [{ nomeNextFit: 'Ana Teste', leadId: 'ana' }] });
    expect(deNovo.previa.listas.provaveis).toEqual([]);
    expect(estadoDe(deNovo, 'ana').tarefa).toMatchObject({ marco: 14, status: TAREFA.PENDENTE });
  });

  it('sem contrato ativo, fecha como encerrado mesmo com o nome no Faltantes', () => {
    const vencido = clientes.map((c) => (c.id === 'ana' ? { ...c, currentContractEndsAt: fimContrato('2026-10-10') } : c));
    const plano2 = planejar(mundo, { faltantes, agora: AGORA2, clientes: vencido });
    expect(estadoDe(plano2, 'ana')).toMatchObject({ status: STATUS.ENCERRADO });
    expect(plano2.previa.listas.provaveis).toEqual([]);
  });
});

describe('telefone de outra pessoa', () => {
  it('a linha que o telefone acha só na mãe vai para os ambíguos, com o nome dela', () => {
    const clientes = [...CLIENTES, cliente('rita', 'Rita Souza', 30)];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Joao Souza', 30, E1, 9)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'rita')).toBeUndefined();
    expect(plano.previa.listas.ambiguos.faltantes).toEqual([{
      numero: 3, nome: 'Joao Souza', telefone: fone(30), professorNextFit: 'Ana Paula Ribeiro', ultimaPresenca: '2026-09-27', ausencias: 9,
      candidatos: [{ leadId: 'rita', nome: 'Rita Souza' }],
    }]);
    expect(plano.previa.numeros.naoLigadosFaltantes).toBe(1);
    expect(plano.registro.naoLigados).toEqual([{ nome: 'Joao Souza', telefone: fone(30), relatorio: 'faltantes' }]);
  });
});

describe('o Presenças', () => {
  const depoisDaPrimeira = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: SEMANA1, agora: AGORA1 }));

  it('sozinho, devolve quem passou na catraca e guarda o Faltantes de antes', () => {
    const plano = planejar(depoisDaPrimeira, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-08', '07:30', 'Acesso', 'Musculação')]), agora: brt('2026-10-08T12:00') });
    expect(plano.estados.map((e) => e.leadId)).toEqual(['ana']);
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-08', ultimaPresenca: '2026-10-08' });
    expect(estadoDe(plano, 'ana').tarefa.status).toBe(TAREFA.VOLTOU);
    expect(plano.voltas.map((v) => v.text)).toEqual(['Voltou a treinar em 08/10']);
    expect(plano.config.ultimaImportacao).toEqual({
      id: 'p2026-10-08_2026-10-08', dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29',
      periodoPresencas: { de: '2026-10-08', ate: '2026-10-08' }, ultimoDiaPresencas: '2026-10-08',
    });
  });

  it('junta com o mês já guardado: o mesmo dia conta uma vez e fica a hora menor', () => {
    const mundo = { ...depoisDaPrimeira, presencas: { 'ana_2026-10': { leadId: 'ana', mes: '2026-10', dias: { '2026-10-02': { hora: '06:40', origens: ['catraca'], modalidades: [] } } } } };
    const presencas = arquivoP([
      linhaP('Ana Teste', '2026-10-02', '07:10'),
      linhaP('Ana Teste', '2026-10-02', '18:30', 'Agenda', 'Pilates'),
      linhaP('Ana Teste', '2026-09-30', '07:00'),
    ]);
    const plano = planejar(mundo, { presencas, agora: AGORA1 });
    expect(plano.presencasPorDoc).toEqual([
      { id: 'ana_2026-09', doc: { leadId: 'ana', mes: '2026-09', dias: { '2026-09-30': { hora: '07:00', origens: ['catraca'], modalidades: [] } } } },
      { id: 'ana_2026-10', doc: { leadId: 'ana', mes: '2026-10', dias: { '2026-10-02': { hora: '06:40', origens: ['agenda', 'catraca'], modalidades: ['Pilates'] } } } },
    ]);
  });

  it('o mês já guardado igual não é gravado de novo', () => {
    const mundo = { ...depoisDaPrimeira, presencas: { 'ana_2026-10': { leadId: 'ana', mes: '2026-10', dias: { '2026-10-02': { hora: '07:10', origens: ['catraca'], modalidades: [] } } } } };
    const plano = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-02', '07:10')]), agora: AGORA1 });
    expect(plano.presencasPorDoc).toEqual([]);
  });

  it('entre dois Presenças, a configuração fica com o que termina depois', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: 'p2026-10-01_2026-10-12', periodoPresencas: { de: '2026-10-01', ate: '2026-10-12' } } } };
    const plano = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-09-20', '07:00')]), agora: AGORA2 });
    expect(plano.config.ultimaImportacao).toEqual({
      id: 'p2026-09-20_2026-09-20', dataFaltantes: null, dataFaltantesAnterior: null,
      periodoPresencas: { de: '2026-10-01', ate: '2026-10-12' }, ultimoDiaPresencas: '2026-10-12',
    });
    expect(plano.registro.periodoPresencas).toEqual({ de: '2026-09-20', ate: '2026-09-20' });
  });

  it('presença depois da data do Faltantes, de quem está no arquivo: voltou, sem tarefa', () => {
    const plano = planejar(MUNDO_VAZIO, {
      faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7)]),
      presencas: arquivoP([linhaP('Ana Teste', '2026-10-07', '07:00')]),
      agora: brt('2026-10-07T12:00'),
    });
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-07', tarefa: null });
    expect(plano.previa.numeros.entramNoMarco[7]).toBe(0);
    expect(plano.voltas.map((v) => v.id)).toEqual(['volta_ana_2026-09-29']);
  });

  it('agenda que o Faltantes não viu: a presença vale e o período recomeça nela', () => {
    const tarefa14 = { marco: 14, urgente: false, status: TAREFA.PENDENTE, inicioFalta: '2026-09-20', criadaEm: E1, importacaoId: ID1, feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null };
    const mundo = {
      ...MUNDO_VAZIO,
      estados: { ana: { leadId: 'ana', status: STATUS.FALTANDO, inicioFalta: '2026-09-20', ultimaPresenca: '2026-09-20', professorId: 'p-ana', tarefa: tarefa14 } },
      config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1, ultimoDiaPresencas: E1 } },
    };
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E2, 23), linhaF('Ivo Teste', 9, E2, 8)]);
    const plano = planejar(mundo, { faltantes, presencas: arquivoP([linhaP('Ana Teste', '2026-10-02', '18:00', 'Agenda', 'Pilates')]), agora: AGORA2 });
    expect(plano.voltas.find((v) => v.leadId === 'ana')).toMatchObject({ voltouEm: '2026-10-02', inicioFalta: '2026-09-20' });
    expect(estadoDe(plano, 'ana')).toMatchObject({
      status: STATUS.FALTANDO, inicioFalta: '2026-10-02', diasNaImportacao: 11, tarefa: { marco: 7, status: TAREFA.PENDENTE, inicioFalta: '2026-10-02' },
    });
  });

  it('agenda recente que o Faltantes não viu: nenhum período abre', () => {
    const mundo = {
      ...MUNDO_VAZIO,
      estados: { ana: { leadId: 'ana', status: STATUS.FALTANDO, inicioFalta: '2026-09-20', ultimaPresenca: '2026-09-20', professorId: 'p-ana', tarefa: null } },
      config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1, ultimoDiaPresencas: E1 } },
    };
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E2, 23), linhaF('Ivo Teste', 9, E2, 8)]);
    const plano = planejar(mundo, { faltantes, presencas: arquivoP([linhaP('Ana Teste', '2026-10-09', '18:00', 'Agenda', 'Pilates')]), agora: AGORA2 });
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-09', ultimaPresenca: '2026-10-09' });
  });
});

describe('urgente', () => {
  const vence = (dia) => ({ currentContractEndsAt: fimContrato(dia) });

  it('aluno faltando com contrato terminando em até 90 dias: a tarefa nasce com o selo', () => {
    const clientes = [cliente('uri', 'Uri Teste', 21, vence('2026-11-05'))];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Uri Teste', 21, E1, 7)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'uri')).toMatchObject({ urgente: true, contratoTerminaEm: '2026-11-05', tarefa: { marco: 7, urgente: true } });
    expect(plano.previa.numeros).toMatchObject({ urgentes: 1, urgentesNovos: 1 });
    expect(plano.previa.porProfessor).toEqual([{ professorId: 'p-ana', nome: 'Ana Paula Ribeiro', alunos: 1, pendentes: 1, urgentes: 1 }]);
  });

  it('quem já renovou não fica urgente: vale o fim da renovação', () => {
    const renovou = {
      currentContractId: 'c-vic-2',
      currentContractStartsAt: fimContrato('2026-10-21'),
      currentContractEndsAt: fimContrato('2027-10-21'),
      inUseContractId: 'c-vic',
      inUseContractStatus: 'ativo',
      inUseContractEndsAt: fimContrato('2026-10-20'),
    };
    const clientes = [cliente('vic', 'Vic Teste', 25, renovou)];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Vic Teste', 25, E1, 7)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'vic')).toMatchObject({ urgente: false, contratoTerminaEm: '2027-10-21', tarefa: { marco: 7, urgente: false } });
  });

  it('depois do último marco, só o urgente cria tarefa', () => {
    const clientes = [cliente('vera', 'Vera Teste', 22, vence('2026-12-01'))];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Vera Teste', 22, E1, 100)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'vera').tarefa).toMatchObject({ marco: 60, urgente: true, status: TAREFA.PENDENTE });
  });

  it('a tarefa pendente de marco que vira urgente ganha o selo, sem tarefa nova; e uma vez por período', () => {
    const longe = [cliente('wil', 'Wil Teste', 23)];
    const perto = [cliente('wil', 'Wil Teste', 23, vence('2026-12-01'))];
    const semana1 = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Wil Teste', 23, E1, 15)]), agora: AGORA1, clientes: longe });
    expect(estadoDe(semana1, 'wil').tarefa).toMatchObject({ marco: 14, urgente: false });
    const mundo1 = aplicar(MUNDO_VAZIO, semana1);

    const semana2 = planejar(mundo1, { faltantes: arquivoF([linhaF('Wil Teste', 23, E2, 22)]), agora: AGORA2, clientes: perto });
    expect(estadoDe(semana2, 'wil').tarefa).toEqual({ ...mundo1.estados.wil.tarefa, urgente: true });
    expect(semana2.previa.numeros.urgentesNovos).toBe(1);
    const mundo2 = aplicar(mundo1, semana2);

    const semana3 = planejar(mundo2, { faltantes: arquivoF([linhaF('Wil Teste', 23, E3, 29)]), agora: AGORA3, clientes: perto });
    expect(estadoDe(semana3, 'wil').tarefa).toBe(mundo2.estados.wil.tarefa);
    expect(semana3.previa.numeros.urgentesNovos).toBe(0);
  });

  it('a tarefa urgente já feita não volta enquanto o período segue', () => {
    const perto = [cliente('xuxa', 'Xuxa Teste', 24, vence('2026-12-01'))];
    const mundo1 = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Xuxa Teste', 24, E1, 15)]), agora: AGORA1, clientes: perto }));
    const feita = { ...mundo1, estados: { xuxa: { ...mundo1.estados.xuxa, tarefa: { ...mundo1.estados.xuxa.tarefa, status: TAREFA.FEITA } } } };
    const semana2 = planejar(feita, { faltantes: arquivoF([linhaF('Xuxa Teste', 24, E2, 22)]), agora: AGORA2, clientes: perto });
    expect(estadoDe(semana2, 'xuxa').tarefa.status).toBe(TAREFA.FEITA);
  });
});

describe('avisos da prévia', () => {
  it('as datas do Faltantes que não batem', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8), { ...linhaF('Caio Teste', 3, E1, 20), 'Qtde de ausências': 19 }]);
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1 });
    expect(plano.avisos).toEqual([{
      codigo: 'datas_divergentes',
      mensagem: 'Em 1 linha do Faltantes, a última presença mais as ausências não dá 06/10. Valeu 06/10, o dia da maioria das linhas.',
      divergentes: 1,
    }]);
    expect(plano.registro.avisos).toEqual([{ codigo: 'datas_divergentes', mensagem: plano.avisos[0].mensagem }]);
  });

  it('a linha com a última presença depois da data do Faltantes fica fora do estado', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8), linhaF('Caio Teste', 3, '2026-10-08', 0)]);
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1 });
    expect(plano.importacao.dataFaltantes).toBe(E1);
    expect(estadoDe(plano, 'caio')).toBeUndefined();
    expect(plano.previa.numeros).toMatchObject({ ligadosFaltantes: 2, faltando: 2 });
    expect(plano.avisos.map((a) => a.codigo)).toEqual(['datas_divergentes']);
  });

  it('o Faltantes que parece ter saído com filtro maior', () => {
    const primeira = arquivoF([
      linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8), linhaF('Caio Teste', 3, E1, 9),
      linhaF('Duda Teste', 4, E1, 20), linhaF('Edu Teste', 5, E1, 30),
    ]);
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: primeira, agora: AGORA1 }));
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Duda Teste', 4, E2, 27), linhaF('Edu Teste', 5, E2, 37)]), agora: AGORA2 });
    expect(plano.avisos).toEqual([{
      codigo: 'filtro_maior',
      mensagem: 'O Faltantes parece ter saído com um filtro maior que 7 dias: ninguém aparece com até 10 dias sem vir, e 3 dos 5 faltosos da importação anterior sumiram dele. Se seguir, 3 vão ser marcados como "voltou". Exporte de novo com 7 dias.',
      sumiram: 3,
      anteriores: 5,
      viramVoltou: 3,
    }]);
  });

  it('com alguém perto do menor marco, não há aviso de filtro', () => {
    const primeira = arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8)]);
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: primeira, agora: AGORA1 }));
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ivo Teste', 9, E2, 10)]), agora: AGORA2 });
    expect(plano.avisos.map((a) => a.codigo)).toEqual([]);
  });

  it('o buraco no Presenças', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1, ultimoDiaPresencas: '2026-10-01' } } };
    const buraco = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-05', '07:00')]), agora: AGORA1 });
    expect(buraco.avisos).toEqual([{
      codigo: 'buraco_presencas',
      mensagem: 'O último Presenças importado vai até 01/10, e este começa em 05/10. Os dias entre eles podem ter ficado sem presença. Exporte o Presenças a partir de 02/10.',
      ultimoDia: '2026-10-01',
      primeiroDia: '2026-10-05',
    }]);
    const emenda = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-03', '07:00')]), agora: AGORA1 });
    expect(emenda.avisos).toEqual([]);
  });
});

describe('peças do plano', () => {
  it('E0: a data anterior, a mesma de antes quando a data se repete, ou E menos 7', () => {
    expect(e0Da(E2, { id: ID1, dataFaltantes: E1 })).toBe(E1);
    expect(e0Da(E1, { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29' })).toBe('2026-09-29');
    expect(e0Da(E1, { id: ID1, dataFaltantes: E1 })).toBe('2026-09-29');
    expect(e0Da(E1, null)).toBe('2026-09-29');
  });

  it('id da importação pelas datas dos arquivos, e id da volta por aluno e período', () => {
    expect(idDaImportacao({ dataFaltantes: E1, periodoPresencas: { de: '2026-09-30', ate: E1 } })).toBe('f2026-10-06_p2026-09-30_2026-10-06');
    expect(idDaImportacao({ dataFaltantes: E1, periodoPresencas: null })).toBe('f2026-10-06');
    expect(idDaImportacao({ dataFaltantes: null, periodoPresencas: { de: '2026-09-30', ate: E1 } })).toBe('p2026-09-30_2026-10-06');
    expect(idDaImportacao({ dataFaltantes: null, periodoPresencas: null })).toBeNull();
    expect(idDaVolta('ana', '2026-09-29')).toBe('volta_ana_2026-09-29');
  });

  it('texto da volta', () => {
    expect(textoDaVolta({ voltouEm: '2026-10-03' })).toBe('Voltou a treinar em 03/10');
    expect(textoDaVolta({ voltouEntre: { de: '2026-09-26', ate: E1 } })).toBe('Voltou a treinar entre 26/09 e 06/10');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.planoImportacao.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/planoImportacao.js' imported from .../src/lib/__tests__/faltosos.planoImportacao.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Implementar o plano**

Criar `src/lib/faltosos/planoImportacao.js`:

```js
// O plano da importação dos relatórios da Next Fit: recebe tudo o que foi
// lido (as linhas dos arquivos, o estado de cada aluno, as presenças guardadas
// dos meses do arquivo, os clientes, as ligações e a configuração) e devolve
// tudo o que será gravado, mais a prévia e os avisos. Puro: nada é gravado
// aqui, e a tela roda o plano de novo a cada escolha do passo curto e a cada
// ligação feita à mão. A gravação (gravarImportacao.js) relê os estados e roda
// o plano mais uma vez logo antes de gravar.
//
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md
// ("As importações", "Marcos e tarefas", "Urgente", "A prévia", "A gravação").
import { dataDoFaltantes, nomeChave, periodoDasPresencas } from './nextfitArquivos.js';
import {
  clienteProvavel, indiceDeClientes, ligarFaltantes, ligarPresencas, nomesManuais, nomesParaGuardar,
} from './ligacaoAlunos.js';
import { normalizarProfessorLinks, professorDaLinha, professoresNovos } from './ligacaoProfessores.js';
import {
  JANELA_DA_PRIMEIRA_IMPORTACAO, marcoAlcancado, marcoAtravessado, normalizarJanelaUrgente, normalizarMarcos,
} from './marcos.js';
import { situacaoDoContrato, urgenteDe } from './urgente.js';
import { normalizarUltimaImportacao, periodoOuNull } from './configFaltosos.js';
import { ddmm, ddmmaaaa, diaValido, diasEntre, hojeEmBrasilia, maiorDia, mesDoDia, somarDias } from './dias.js';

export const STATUS = Object.freeze({ FALTANDO: 'faltando', VOLTOU: 'voltou', ENCERRADO: 'encerrado' });
export const TAREFA = Object.freeze({ PENDENTE: 'pendente', FEITA: 'feita', VOLTOU: 'voltou', ENCERRADA: 'encerrada' });

// Buraco no Presenças: mais de 2 dias entre o último dia já importado e o
// primeiro dia do arquivo novo.
export const LIMITE_DO_BURACO = 2;
// Filtro maior: ninguém com até 3 dias além do menor marco, e mais de 20% dos
// faltosos da importação anterior fora do arquivo.
export const FOLGA_DO_FILTRO = 3;
export const PARCELA_QUE_SUMIU = 0.2;

export const MENSAGENS = Object.freeze({
  semArquivo: 'Escolha o relatório Faltantes, o Presenças ou os dois.',
  faltantesSemData: 'Nenhuma linha do Faltantes tem a última presença e a quantidade de ausências legíveis. Confira se é o relatório Faltantes da Next Fit.',
  presencasSemData: 'Nenhuma linha do Presenças tem o cliente, o tipo e a data legíveis. Confira se é o relatório Presenças da Next Fit.',
  faltantesAntigo: (e, ultimo) => `Este Faltantes é de ${ddmmaaaa(e)}, mais antigo que o último importado, de ${ddmmaaaa(ultimo)}. Exporte o relatório de hoje.`,
  datasDivergentes: (n, e) => `Em ${n} ${n === 1 ? 'linha' : 'linhas'} do Faltantes, a última presença mais as ausências não dá ${ddmm(e)}. Valeu ${ddmm(e)}, o dia da maioria das linhas.`,
  filtroMaior: ({ menor, sumiram, anteriores, viramVoltou }) => `O Faltantes parece ter saído com um filtro maior que ${menor} dias: ninguém aparece com até ${menor + FOLGA_DO_FILTRO} dias sem vir, e ${sumiram} dos ${anteriores} faltosos da importação anterior sumiram dele. Se seguir, ${viramVoltou} ${viramVoltou === 1 ? 'vai ser marcado' : 'vão ser marcados'} como "voltou". Exporte de novo com ${menor} dias.`,
  buracoPresencas: (ultimo, primeiro) => `O último Presenças importado vai até ${ddmm(ultimo)}, e este começa em ${ddmm(primeiro)}. Os dias entre eles podem ter ficado sem presença. Exporte o Presenças a partir de ${ddmm(somarDias(ultimo, 1))}.`,
});

const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const diaOuNull = (v) => (diaValido(v) ? v : null);

// E0: o Faltantes anterior. Na mesma data de novo, o E0 que ela usou, para a
// mesma data chegar ao mesmo resultado. Na primeira importação, E menos 7 dias.
export function e0Da(e, ultima) {
  const u = normalizarUltimaImportacao(ultima);
  if (u?.dataFaltantes && e > u.dataFaltantes) return u.dataFaltantes;
  if (u?.dataFaltantes && e === u.dataFaltantes && u.dataFaltantesAnterior && u.dataFaltantesAnterior < e) return u.dataFaltantesAnterior;
  return somarDias(e, -JANELA_DA_PRIMEIRA_IMPORTACAO);
}

// Id fixo da importação, tirado das datas dos arquivos: "f2026-10-06",
// "p2026-09-29_2026-10-05" ou os dois juntos. Os mesmos arquivos de novo caem
// no mesmo registro e deixam nos alunos o mesmo carimbo. null sem arquivo.
export function idDaImportacao({ dataFaltantes = null, periodoPresencas = null } = {}) {
  const partes = [];
  if (diaValido(dataFaltantes)) partes.push(`f${dataFaltantes}`);
  const p = periodoOuNull(periodoPresencas);
  if (p) partes.push(`p${p.de}_${p.ate}`);
  return partes.length ? partes.join('_') : null;
}

// Id fixo da linha "Voltou a treinar" em stronix_interactions: uma por aluno
// e período de falta, que se reconhece pela última presença que o abriu.
export const idDaVolta = (leadId, inicioFalta) => `volta_${leadId}_${inicioFalta}`;

// "Voltou a treinar em 03/10", com o dia, ou "Voltou a treinar entre 26/09 e
// 06/10", sem ele.
export function textoDaVolta({ voltouEm = null, voltouEntre = null } = {}) {
  if (diaValido(voltouEm)) return `Voltou a treinar em ${ddmm(voltouEm)}`;
  if (voltouEntre) return `Voltou a treinar entre ${ddmm(voltouEntre.de)} e ${ddmm(voltouEntre.ate)}`;
  return 'Voltou a treinar';
}

// Comparação de valores gravados: null e ausente contam igual, Timestamp e
// Date pelo instante.
function iguais(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a.toMillis === 'function' && typeof b.toMillis === 'function') return a.toMillis() === b.toMillis();
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => iguais(x, b[i]));
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of chaves) if (!iguais(a[k] ?? null, b[k] ?? null)) return false;
  return true;
}

const menorHora = (a, b) => (a && b ? (a < b ? a : b) : a || b || null);
const ordenar = (lista) => [...lista].sort((x, y) => String(x).localeCompare(String(y), 'pt-BR'));

// leadId → Map(dia → { hora, origens: Set, modalidades: Set }), das linhas
// do Presenças ligadas.
function presencasPorAluno(ligados) {
  const porLead = new Map();
  for (const { linha, leadId } of ligados) {
    if (!diaValido(linha?.dia)) continue;
    if (!porLead.has(leadId)) porLead.set(leadId, new Map());
    const dias = porLead.get(leadId);
    const dia = dias.get(linha.dia) || { hora: null, origens: new Set(), modalidades: new Set() };
    dia.hora = menorHora(dia.hora, linha.hora);
    if (linha.origem) dia.origens.add(linha.origem);
    if (linha.modalidade) dia.modalidades.add(linha.modalidade);
    dias.set(linha.dia, dia);
  }
  return porLead;
}

// O primeiro dia de presença depois de `dia` (e até `ate`, quando dado).
function primeiraPresencaDepois(dias, dia, ate = null) {
  let achou = null;
  for (const d of dias?.keys() || []) {
    if (d > dia && (ate === null || d <= ate) && (achou === null || d < achou)) achou = d;
  }
  return achou;
}

// O último dia de presença até `ate`, inclusive.
function ultimaPresencaAte(dias, ate) {
  let achou = null;
  for (const d of dias?.keys() || []) if (d <= ate && (achou === null || d > achou)) achou = d;
  return achou;
}

// Volta entre o dia seguinte à última presença e `ate`. Um dia só vira o dia
// exato.
function voltaEntre(inicioFalta, ate) {
  const de = somarDias(inicioFalta, 1);
  return de >= ate ? { voltouEm: ate, voltouEntre: null } : { voltouEm: null, voltouEntre: { de, ate } };
}

const fecharTarefa = (tarefa, status) => (tarefa?.status === TAREFA.PENDENTE ? { ...tarefa, status } : (tarefa ?? null));

function fecharComoVolta(atual, { voltouEm, voltouEntre }, ultimaPresenca, importacaoId) {
  return {
    ...atual,
    status: STATUS.VOLTOU,
    voltouEm: voltouEm ?? null,
    voltouEntre: voltouEntre ?? null,
    ultimaPresenca: maiorDia(atual.ultimaPresenca, ultimaPresenca) || atual.ultimaPresenca || null,
    urgente: false,
    atualizadoNaImportacao: importacaoId,
    tarefa: fecharTarefa(atual.tarefa, TAREFA.VOLTOU),
  };
}

function fecharComoEncerrado(atual, importacaoId) {
  return {
    ...atual,
    status: STATUS.ENCERRADO,
    urgente: false,
    atualizadoNaImportacao: importacaoId,
    tarefa: fecharTarefa(atual.tarefa, TAREFA.ENCERRADA),
  };
}

// A tarefa do período depois dos marcos e do urgente. Devolve a tarefa, o
// marco em que o aluno entrou nesta importação (tarefa criada ou que trocou
// de marco) e se o urgente criou a tarefa ou deu o selo a ela. A tarefa é do
// período quando o inicioFalta dela é o do estado: a de um período anterior,
// mesmo fechada, não segura a tarefa do período novo.
//
// - Atravessou um ou mais marcos: a tarefa passa a ser do maior. A pendente
//   troca de marco no mesmo card (fica o criadaEm, troca o importacaoId); a
//   já fechada dá lugar a uma nova.
// - Não atravessou nenhum: nada muda.
// - Urgente: uma tarefa por período, mesmo depois do último marco. A pendente
//   ganha o selo; se a do período já foi fechada sem ser urgente, nasce outra.
//   O selo nunca sai de uma tarefa: é ele que guarda o "uma vez por período".
function tarefaDoPeriodo({ tarefa, inicioFalta, marcoNovo, urgente, marcoDoUrgente, hojeDia, importacaoId }) {
  const nova = (marco, urg) => ({
    marco, urgente: urg, status: TAREFA.PENDENTE, inicioFalta, criadaEm: hojeDia, importacaoId,
    feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null,
  });
  const doPeriodo = (t) => (t && t.inicioFalta === inicioFalta ? t : null);
  let resultado = tarefa ?? null;
  let entrouNoMarco = null;
  let urgenteNovo = false;
  if (marcoNovo !== null) {
    const t = doPeriodo(resultado);
    if (!t || (t.status !== TAREFA.PENDENTE && (t.marco ?? 0) < marcoNovo)) {
      resultado = nova(marcoNovo, urgente);
      entrouNoMarco = marcoNovo;
      urgenteNovo = urgente;
    } else if (t.status === TAREFA.PENDENTE && (t.marco ?? 0) < marcoNovo) {
      resultado = { ...t, marco: marcoNovo, urgente: Boolean(t.urgente || urgente), importacaoId };
      entrouNoMarco = marcoNovo;
      urgenteNovo = urgente && !t.urgente;
    }
  }
  if (urgente) {
    const t = doPeriodo(resultado);
    if (!t) {
      resultado = nova(marcoDoUrgente, true);
      urgenteNovo = true;
    } else if (!t.urgente) {
      resultado = t.status === TAREFA.PENDENTE ? { ...t, urgente: true } : nova(marcoDoUrgente, true);
      urgenteNovo = true;
    }
  }
  return { tarefa: resultado, entrouNoMarco, urgenteNovo };
}

const tarefaPendente = (d) => d?.tarefa?.status === TAREFA.PENDENTE && d.tarefa.inicioFalta === d.inicioFalta;

// Presenças por dia, juntas com os meses já guardados: o mesmo dia conta uma
// vez, fica a hora menor e as origens e modalidades se somam, em ordem. O doc
// devolvido é o mês inteiro (os dias guardados mais os do arquivo), e só o mês
// que muda é devolvido.
function juntarPresencas(diasPorLead, presencasAtuais) {
  const presencasPorDoc = [];
  let diasDePresenca = 0;
  for (const [leadId, dias] of [...diasPorLead].sort(([a], [b]) => a.localeCompare(b))) {
    const porMes = new Map();
    for (const [dia, info] of dias) {
      const mes = mesDoDia(dia);
      if (!porMes.has(mes)) porMes.set(mes, []);
      porMes.get(mes).push([dia, info]);
      diasDePresenca += 1;
    }
    for (const [mes, lista] of [...porMes].sort(([a], [b]) => a.localeCompare(b))) {
      const id = `${leadId}_${mes}`;
      const guardado = objeto(presencasAtuais?.[id]);
      const diasGuardados = objeto(guardado?.dias) || {};
      const juntos = { ...diasGuardados };
      for (const [dia, info] of lista) {
        const antes = objeto(diasGuardados[dia]);
        juntos[dia] = {
          hora: menorHora(antes?.hora || null, info.hora),
          origens: ordenar(new Set([...(Array.isArray(antes?.origens) ? antes.origens : []), ...info.origens])),
          modalidades: ordenar(new Set([...(Array.isArray(antes?.modalidades) ? antes.modalidades : []), ...info.modalidades])),
        };
      }
      const doc = { leadId, mes, dias: juntos };
      if (!guardado || !iguais(doc, { leadId: guardado.leadId, mes: guardado.mes, dias: guardado.dias })) presencasPorDoc.push({ id, doc });
    }
  }
  return { presencasPorDoc, diasDePresenca };
}

// Nomes da Next Fit a gravar em stronix_nextfit_alunos: os que mudam.
function nomesAGravar(novos, guardados) {
  const out = [];
  for (const [id, doc] of Object.entries(novos).sort(([a], [b]) => a.localeCompare(b))) {
    const g = objeto(guardados[id]);
    if (!g || !iguais({ nomeNextFit: g.nomeNextFit, leadIds: g.leadIds, origem: g.origem }, doc)) out.push({ id, doc });
  }
  return out;
}

// Os avisos da prévia: datas do Faltantes que não batem, filtro maior e
// buraco no Presenças.
function avisosDaImportacao({ E, divergentes, marcos, linhasF, estadosLidos, sumiram, finais, periodo, ultima }) {
  const avisos = [];
  if (E && divergentes > 0) {
    avisos.push({ codigo: 'datas_divergentes', mensagem: MENSAGENS.datasDivergentes(divergentes, E), divergentes });
  }
  if (E) {
    const menor = marcos[0];
    const anteriores = Object.keys(estadosLidos).filter((id) => estadosLidos[id]?.status === STATUS.FALTANDO).length;
    const ninguemPerto = !linhasF.some((l) => l.ausencias <= menor + FOLGA_DO_FILTRO);
    if (ninguemPerto && anteriores > 0 && sumiram.length > anteriores * PARCELA_QUE_SUMIU) {
      const viramVoltou = sumiram.filter((id) => finais.get(id)?.status === STATUS.VOLTOU).length;
      avisos.push({
        codigo: 'filtro_maior',
        mensagem: MENSAGENS.filtroMaior({ menor, sumiram: sumiram.length, anteriores, viramVoltou }),
        sumiram: sumiram.length,
        anteriores,
        viramVoltou,
      });
    }
  }
  const ultimoDia = ultima?.ultimoDiaPresencas || null;
  if (periodo && ultimoDia && diasEntre(ultimoDia, periodo.de) > LIMITE_DO_BURACO) {
    avisos.push({
      codigo: 'buraco_presencas',
      mensagem: MENSAGENS.buracoPresencas(ultimoDia, periodo.de),
      ultimoDia,
      primeiroDia: periodo.de,
    });
  }
  return avisos;
}

// Quanto fica com cada professor depois da importação; "Sem professor" por
// último.
function porProfessorDe(faltando, professores) {
  const nomeDoProfessor = (id) => (professores || []).find((p) => p?.id === id)?.nome || null;
  const mapa = new Map();
  for (const d of faltando) {
    const k = d.professorId || null;
    const item = mapa.get(k) || { professorId: k, nome: k ? nomeDoProfessor(k) : null, alunos: 0, pendentes: 0, urgentes: 0 };
    item.alunos += 1;
    if (tarefaPendente(d)) item.pendentes += 1;
    if (d.urgente) item.urgentes += 1;
    mapa.set(k, item);
  }
  return [...mapa.values()].sort((a, b) => (a.professorId === null) - (b.professorId === null)
    || b.alunos - a.alunos || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

// A linha do Faltantes como a prévia mostra.
const daLinha = (l) => ({
  numero: l.numero, nome: l.nome, telefone: l.telefone, professorNextFit: l.professorNextFit,
  ultimaPresenca: l.ultimaPresenca, ausencias: l.ausencias,
});

// Os não ligados e os ambíguos, para a prévia ligar à mão. No Faltantes, uma
// linha por aluno, com o telefone e, no não ligado, a sugestão (o cliente
// provável, quando é um só). No Presenças, um item por nome, com quantas
// linhas ele tem no arquivo.
function listasDeLigacao({ lf, lp, indice, nomesBase }) {
  const candidatosDe = (lista) => lista.map((id) => ({ leadId: id, nome: indice.porId.get(id)?.name || null }));
  const porNome = (linhas, extra = () => ({})) => {
    const m = new Map();
    linhas.forEach((linha, i) => {
      const k = nomeChave(linha.nome);
      const item = m.get(k);
      if (item) item.linhas += 1;
      else m.set(k, { nome: linha.nome, linhas: 1, ...extra(i) });
    });
    return [...m.values()];
  };
  return {
    naoLigadosF: lf.naoLigados.map((l) => ({ ...daLinha(l), sugestao: clienteProvavel(l, indice, nomesBase) })),
    ambiguosF: lf.ambiguos.map(({ linha, candidatos }) => ({ ...daLinha(linha), candidatos: candidatosDe(candidatos) })),
    naoLigadosP: porNome(lp.naoLigados),
    ambiguosP: porNome(lp.ambiguos.map((a) => a.linha), (i) => ({ candidatos: candidatosDe(lp.ambiguos[i].candidatos) })),
  };
}

// O resumo da última importação depois desta, que a gravação junta com
// importadoEm e importadoPorNome. A importação de um arquivo só repete o valor
// do outro; entre dois Presenças, fica o que termina depois.
function ultimaImportacaoDepois({ ultima, importacaoId, E, e0, periodo }) {
  const anterior = ultima?.periodoPresencas || null;
  const periodoPresencas = periodo && (!anterior || periodo.ate >= anterior.ate) ? periodo : anterior;
  return {
    id: importacaoId,
    dataFaltantes: E || ultima?.dataFaltantes || null,
    dataFaltantesAnterior: E ? e0 : (ultima?.dataFaltantesAnterior || null),
    periodoPresencas,
    ultimoDiaPresencas: maiorDia(ultima?.ultimoDiaPresencas, periodo?.ate),
  };
}

// O plano. Entrada:
// - faltantes e presencas: o que parseFaltantes e parsePresencas devolvem, ou null;
// - estadosAtuais: { [leadId]: doc de stronix_faltosos }, todos os documentos;
// - presencasAtuais: { [leadId_AAAA-MM]: doc de stronix_presencas } dos meses do
//   arquivo (a tela lê por where('mes', 'in', meses));
// - clientes: os leads com lifecycleBucket 'cliente';
// - professores: o cadastro de professores (sugestão e nomes da prévia);
// - ligacoes: { professores: professorLinks já com as escolhas do passo curto,
//   alunos: { [nomeChave]: doc de stronix_nextfit_alunos }, manuais:
//   [{ nomeNextFit, leadId }] feitas na prévia };
// - config: stronix_config/faltosos, cru ou já lido por normalizarConfigFaltosos;
// - ultimaImportacao: opcional; sem ele, config.ultimaImportacao;
// - agora: o instante da importação.
export function planejarImportacao({
  faltantes = null,
  presencas = null,
  estadosAtuais = {},
  presencasAtuais = {},
  clientes = [],
  professores = [],
  ligacoes = {},
  config = {},
  ultimaImportacao,
  agora = new Date(),
} = {}) {
  const vazio = {
    recusa: null, prontoParaGravar: false, pendencias: { professoresNovos: [] }, importacao: null,
    estados: [], voltas: [], voltasDesfeitas: [], presencasPorDoc: [], nomesAlunos: [],
    config: null, registro: null, previa: null, avisos: [],
  };
  const recusar = (codigo, mensagem) => ({ ...vazio, recusa: { codigo, mensagem } });
  if (!faltantes && !presencas) return recusar('sem_arquivo', MENSAGENS.semArquivo);

  const marcos = normalizarMarcos(config?.marcos);
  const janela = normalizarJanelaUrgente(config?.janelaUrgenteDias);
  const ultima = normalizarUltimaImportacao(ultimaImportacao ?? config?.ultimaImportacao);
  const hojeDia = hojeEmBrasilia(agora);
  const linhasF = faltantes?.linhas || [];
  const linhasP = presencas?.linhas || [];
  const estadosLidos = objeto(estadosAtuais) || {};

  // A data do Faltantes, e a recusa do Faltantes mais antigo que o último.
  let E = null;
  let divergentes = 0;
  if (faltantes) {
    ({ dia: E, divergentes } = dataDoFaltantes(linhasF));
    if (!E) return recusar('faltantes_sem_data', MENSAGENS.faltantesSemData);
    if (ultima?.dataFaltantes && E < ultima.dataFaltantes) {
      return recusar('faltantes_antigo', MENSAGENS.faltantesAntigo(E, ultima.dataFaltantes));
    }
  }
  const periodo = periodoDasPresencas(linhasP);
  if (!E && !periodo) return recusar('presencas_sem_data', MENSAGENS.presencasSemData);
  const e0 = E ? e0Da(E, ultima) : null;
  const importacaoId = idDaImportacao({ dataFaltantes: E, periodoPresencas: periodo });

  // A ligação dos alunos: o Faltantes primeiro, porque os nomes que ele liga
  // pelo telefone já valem para o Presenças da mesma importação.
  const indice = indiceDeClientes(clientes);
  const guardados = objeto(ligacoes?.alunos) || {};
  const manuais = nomesManuais(ligacoes?.manuais);
  const nomesBase = { ...guardados, ...manuais };
  const lf = ligarFaltantes(linhasF, indice, nomesBase);
  const nomesTelefone = nomesParaGuardar(lf.ligados, nomesBase, indice);
  const lp = ligarPresencas(linhasP, indice, { ...nomesBase, ...nomesTelefone });

  // A ligação dos professores.
  const links = normalizarProfessorLinks(ligacoes?.professores ?? config?.professorLinks);
  const pendentesDeProfessor = professoresNovos(linhasF, links, professores);

  // Uma linha do Faltantes por aluno (a da presença mais nova, se repetir). A
  // linha com a última presença depois de E não bate com o arquivo (entra no
  // aviso das datas) e fica fora do estado.
  const faltantesPorLead = new Map();
  let duplicados = 0;
  for (const { linha, leadId } of lf.ligados) {
    if (linha.ultimaPresenca > E) continue;
    const antes = faltantesPorLead.get(leadId);
    if (antes) duplicados += 1;
    if (!antes || linha.ultimaPresenca > antes.ultimaPresenca) faltantesPorLead.set(leadId, linha);
  }
  const diasPorLead = presencasPorAluno(lp.ligados);

  // O cliente provável de cada linha do Faltantes que não ligou (sem par ou
  // ambígua). O aluno faltando cujo nome está numa dessas linhas não é marcado
  // como "voltou": o telefone dele pode ter mudado no Stronilead.
  const provavelPorLead = new Map();
  for (const linha of [...lf.naoLigados, ...lf.ambiguos.map((a) => a.linha)]) {
    const leadId = clienteProvavel(linha, indice, nomesBase);
    if (leadId && !provavelPorLead.has(leadId)) provavelPorLead.set(leadId, linha);
  }

  const estados = [];
  const voltas = [];
  const voltasDesfeitas = [];
  const finais = new Map();
  const voltaram = [];
  const encerrados = [];
  const foraSemContrato = [];
  const provaveis = [];
  const entramNoMarco = Object.fromEntries(marcos.map((m) => [String(m), 0]));
  let urgentesNovos = 0;
  const sumiram = [];

  const nomeDe = (leadId, linha) => indice.porId.get(leadId)?.name || linha?.nome || null;
  // Uma linha de volta por aluno em cada importação, a do período mais
  // recente. O aluno que voltou, sumiu de novo e voltou outra vez entre duas
  // importações passa aqui duas vezes, uma logo depois da outra (os alunos são
  // vistos um por vez), e a segunda volta troca a primeira. A gravação recusa
  // o plano com duas voltas do mesmo aluno.
  const registrarVolta = (leadId, inicioFalta, volta) => {
    const lead = indice.porId.get(leadId) || null;
    if (voltas.at(-1)?.leadId === leadId) {
      voltas.pop();
      voltaram.pop();
    }
    voltas.push({
      id: idDaVolta(leadId, inicioFalta),
      leadId,
      inicioFalta,
      voltouEm: volta.voltouEm ?? null,
      voltouEntre: volta.voltouEntre ?? null,
      text: textoDaVolta(volta),
      importacaoId,
      lead: {
        id: leadId,
        name: lead?.name || null,
        consultantId: lead?.consultantId || null,
        consultantAuthUid: lead?.consultantAuthUid || null,
      },
    });
    voltaram.push({ leadId, nome: nomeDe(leadId), voltouEm: volta.voltouEm ?? null, voltouEntre: volta.voltouEntre ?? null });
  };

  const ids = new Set([
    ...faltantesPorLead.keys(),
    ...Object.keys(estadosLidos).filter((id) => estadosLidos[id]?.status === STATUS.FALTANDO),
  ]);

  for (const leadId of [...ids].sort()) {
    const atual = objeto(estadosLidos[leadId]);
    const lead = indice.porId.get(leadId) || null;
    const linha = faltantesPorLead.get(leadId) || null;
    const dias = diasPorLead.get(leadId) || null;
    let novo = atual;

    if (linha) {
      // O aluno está no Faltantes.
      const situacao = lead ? situacaoDoContrato(lead, agora) : 'sem_contrato_ativo';
      if (situacao !== 'ativo') {
        foraSemContrato.push({ leadId, nome: nomeDe(leadId, linha), motivo: situacao });
        if (atual?.status === STATUS.FALTANDO) {
          novo = fecharComoEncerrado(atual, importacaoId);
          encerrados.push({ leadId, nome: nomeDe(leadId, linha) });
        }
      } else if (atual && atual.status !== STATUS.FALTANDO && diaValido(atual.ultimaPresenca) && atual.ultimaPresenca > E) {
        // Já se sabe de uma presença depois da data do Faltantes: ele ficou
        // para trás para esse aluno, e nada muda.
      } else {
        // A última presença conhecida até E: a do Faltantes, a do Presenças e a
        // guardada. Se o Presenças mostra presença depois da do Faltantes, ele
        // vale (a presença aconteceu, como a da agenda que o Faltantes não vê).
        const guardada = diaValido(atual?.ultimaPresenca) && atual.ultimaPresenca <= E ? atual.ultimaPresenca : null;
        const x = maiorDia(linha.ultimaPresenca, ultimaPresencaAte(dias, E), guardada);
        const inicioAtual = diaOuNull(atual?.inicioFalta);
        const professorId = professorDaLinha(linha.professorNextFit, links) ?? null;
        const { urgente, contratoTerminaEm } = urgenteDe(lead, agora, janela);
        const camposDaLinha = {
          leadId,
          professorId,
          professorNextFit: linha.professorNextFit || null,
          contratoNextFit: linha.contrato || null,
          urgente,
          contratoTerminaEm,
          atualizadoNaImportacao: importacaoId,
        };
        let periodoAberto = false;
        if (!atual || !inicioAtual || x > inicioAtual) {
          // Período novo. O de antes, se estava aberto, fechou: o aluno veio
          // em x ou antes.
          let base = atual;
          if (atual?.status === STATUS.FALTANDO && inicioAtual) {
            const dia = primeiraPresencaDepois(dias, inicioAtual, x);
            const volta = dia ? { voltouEm: dia, voltouEntre: null } : voltaEntre(inicioAtual, x);
            base = fecharComoVolta(atual, volta, x, importacaoId);
            registrarVolta(leadId, inicioAtual, volta);
          }
          const contradito = x > linha.ultimaPresenca;
          if (contradito && diasEntre(x, E) < marcos[0]) {
            // As presenças mostram que ele está vindo: nenhum período abre.
            novo = base ? { ...base, ultimaPresenca: maiorDia(base.ultimaPresenca, x) } : null;
          } else {
            novo = {
              ...(base || {}),
              ...camposDaLinha,
              ultimaPresenca: x,
              inicioFalta: x,
              status: STATUS.FALTANDO,
              voltouEm: null,
              voltouEntre: null,
              diasNaImportacao: diasEntre(x, E),
              querCancelarEm: base?.querCancelarEm ?? null,
              tarefa: base?.tarefa ?? null,
            };
            periodoAberto = true;
          }
        } else if (x === inicioAtual) {
          // Mesma última presença: o mesmo período continua. Se ele tinha
          // saído como "voltou" (só pode ter sido sem dia, porque a volta com
          // dia move a última presença), a volta não aconteceu e a linha sai.
          if (atual.status === STATUS.VOLTOU) {
            voltasDesfeitas.push(idDaVolta(leadId, inicioAtual));
          }
          novo = {
            ...atual,
            ...camposDaLinha,
            ultimaPresenca: x,
            status: STATUS.FALTANDO,
            voltouEm: null,
            voltouEntre: null,
            diasNaImportacao: diasEntre(x, E),
            querCancelarEm: atual.querCancelarEm ?? null,
            tarefa: atual.tarefa ?? null,
          };
          periodoAberto = true;
        }
        // x antes do início guardado não acontece: a guardada entra em x.

        if (periodoAberto) {
          const depois = primeiraPresencaDepois(dias, novo.inicioFalta);
          if (depois) {
            // Voltou depois da data do Faltantes, no Presenças desta importação.
            const volta = { voltouEm: depois, voltouEntre: null };
            registrarVolta(leadId, novo.inicioFalta, volta);
            novo = fecharComoVolta(novo, volta, maiorDia(...dias.keys()), importacaoId);
          } else {
            const r = tarefaDoPeriodo({
              tarefa: novo.tarefa,
              inicioFalta: novo.inicioFalta,
              marcoNovo: marcoAtravessado({ ultimaPresenca: novo.inicioFalta, e0, e: E, marcos }),
              urgente,
              marcoDoUrgente: marcoAlcancado({ ultimaPresenca: novo.inicioFalta, e: E, marcos }),
              hojeDia,
              importacaoId,
            });
            novo = { ...novo, tarefa: r.tarefa };
            if (r.entrouNoMarco !== null) entramNoMarco[String(r.entrouNoMarco)] += 1;
            if (r.urgenteNovo) urgentesNovos += 1;
          }
        }
      }
    } else if (atual?.status === STATUS.FALTANDO && diaValido(atual.inicioFalta)) {
      // O aluno estava faltando e não está no Faltantes (ou não veio Faltantes).
      const dia = primeiraPresencaDepois(dias, atual.inicioFalta);
      if (dia) {
        if (E) sumiram.push(leadId);
        const volta = { voltouEm: dia, voltouEntre: null };
        registrarVolta(leadId, atual.inicioFalta, volta);
        novo = fecharComoVolta(atual, volta, maiorDia(...dias.keys()), importacaoId);
      } else if (E) {
        const situacao = lead ? situacaoDoContrato(lead, agora) : 'sem_contrato_ativo';
        if (situacao !== 'ativo') {
          sumiram.push(leadId);
          novo = fecharComoEncerrado(atual, importacaoId);
          encerrados.push({ leadId, nome: nomeDe(leadId) });
        } else if (provavelPorLead.has(leadId)) {
          // O nome dele está no Faltantes, numa linha que não ligou: continua
          // faltando como estava, e a prévia mostra a provável mesma pessoa
          // para a ligação ser feita à mão.
          provaveis.push({ leadId, nome: nomeDe(leadId), linha: daLinha(provavelPorLead.get(leadId)) });
        } else {
          sumiram.push(leadId);
          const volta = voltaEntre(atual.inicioFalta, E);
          registrarVolta(leadId, atual.inicioFalta, volta);
          novo = fecharComoVolta(atual, volta, null, importacaoId);
        }
      }
    }

    if (novo) finais.set(leadId, novo);
    if (novo && !iguais(novo, atual)) estados.push({ leadId, doc: novo });
  }

  // Estados que não passaram pelo laço continuam como estão.
  for (const [leadId, doc] of Object.entries(estadosLidos)) if (!finais.has(leadId) && objeto(doc)) finais.set(leadId, doc);

  const { presencasPorDoc, diasDePresenca } = juntarPresencas(diasPorLead, presencasAtuais);
  const nomesAlunos = nomesAGravar({ ...nomesTelefone, ...manuais }, guardados);
  const avisos = avisosDaImportacao({ E, divergentes, marcos, linhasF, estadosLidos, sumiram, finais, periodo, ultima });

  // Números e listas da prévia.
  const faltandoAgora = [...finais.values()].filter((d) => d?.status === STATUS.FALTANDO);
  const porProfessor = porProfessorDe(faltandoAgora, professores);
  const { naoLigadosF, ambiguosF, naoLigadosP, ambiguosP } = listasDeLigacao({ lf, lp, indice, nomesBase });

  const numeros = {
    linhasFaltantes: linhasF.length,
    linhasPresencas: linhasP.length,
    errosFaltantes: faltantes?.erros?.length || 0,
    errosPresencas: presencas?.erros?.length || 0,
    ligadosFaltantes: faltantesPorLead.size,
    naoLigadosFaltantes: naoLigadosF.length + ambiguosF.length,
    alunosNoPresencas: diasPorLead.size,
    naoLigadosPresencas: naoLigadosP.length + ambiguosP.length,
    duplicados,
    faltando: faltandoAgora.length,
    entramNoMarco,
    urgentes: faltandoAgora.filter((d) => d.urgente).length,
    urgentesNovos,
    tarefasPendentes: faltandoAgora.filter(tarefaPendente).length,
    acompanhamento: faltandoAgora.filter((d) => !tarefaPendente(d)).length,
    semProfessor: faltandoAgora.filter((d) => !d.professorId).length,
    // Alunos: cada aluno tem no máximo uma volta por importação (registrarVolta).
    voltaram: new Set(voltaram.map((v) => v.leadId)).size,
    encerrados: encerrados.length,
    foraSemContrato: foraSemContrato.length,
    provaveis: provaveis.length,
    diasDePresenca,
  };

  const previa = {
    dataFaltantes: E,
    dataFaltantesAnterior: e0,
    periodoPresencas: periodo,
    numeros,
    porProfessor,
    listas: {
      professoresNovos: pendentesDeProfessor,
      naoLigados: { faltantes: naoLigadosF, presencas: naoLigadosP },
      ambiguos: { faltantes: ambiguosF, presencas: ambiguosP },
      foraSemContrato,
      voltaram,
      encerrados,
      provaveis,
      erros: { faltantes: faltantes?.erros || [], presencas: presencas?.erros || [] },
    },
  };

  const professorLinksMudou = !iguais(links, normalizarProfessorLinks(config?.professorLinks));
  return {
    recusa: null,
    prontoParaGravar: pendentesDeProfessor.length === 0,
    pendencias: { professoresNovos: pendentesDeProfessor },
    importacao: { id: importacaoId, dataFaltantes: E, dataFaltantesAnterior: e0, periodoPresencas: periodo },
    estados,
    voltas,
    voltasDesfeitas,
    presencasPorDoc,
    nomesAlunos,
    config: {
      ultimaImportacao: ultimaImportacaoDepois({ ultima, importacaoId, E, e0, periodo }),
      ...(professorLinksMudou ? { professorLinks: links } : {}),
    },
    registro: {
      dataFaltantes: E,
      dataFaltantesAnterior: e0,
      periodoPresencas: periodo,
      numeros,
      avisos: avisos.map(({ codigo, mensagem }) => ({ codigo, mensagem })),
      // Os "Não achados" da aba Faltosos, no formato do contrato: o nome, o
      // telefone (só o Faltantes tem) e de qual relatório veio. A prévia tem as
      // listas completas, para a ligação à mão.
      naoLigados: [
        ...[...naoLigadosF, ...ambiguosF].map(({ nome, telefone }) => ({ nome, telefone: telefone || null, relatorio: 'faltantes' })),
        ...[...naoLigadosP, ...ambiguosP].map(({ nome }) => ({ nome, telefone: null, relatorio: 'presencas' })),
      ],
    },
    previa,
    avisos,
  };
}
```

Esse arquivo tem `professorId` como chave, e a varredura do histórico do professor reprova arquivo novo assim até ele ser revisado. Ele não grava o professor do lead. Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, trocar:

```js
  // Faltosos (Professor e faltosos, PR 2A): o professor do aluno no estado
  // dos faltosos e nas ligações da Next Fit. Nenhum deles grava o lead.
  'src/lib/faltosos/ligacaoProfessores.js': 'ligação dos professores da Next Fit, guardada em stronix_config/faltosos',
};
```

por:

```js
  // Faltosos (Professor e faltosos, PR 2A): o professor do aluno no estado
  // dos faltosos e nas ligações da Next Fit. Nenhum deles grava o lead.
  'src/lib/faltosos/ligacaoProfessores.js': 'ligação dos professores da Next Fit, guardada em stronix_config/faltosos',
  'src/lib/faltosos/planoImportacao.js': 'estado de cada faltoso (stronix_faltosos), não o lead',
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.planoImportacao.test.js`
Expected: PASS, `Tests  64 passed (64)`.

- [ ] **Step 5: Escrever a varredura dos imports do motor**

Criar `src/lib/__tests__/faltosos.imports.test.js`:

```js
// O motor da importação dos faltosos (src/lib/faltosos, menos a leitura e a
// gravação) é puro: roda em node nos testes e no navegador, e não pode chegar
// ao SDK do Firebase, à Meta Diária (que puxa lucide-react), a componente de
// tela nem a pacote nenhum. A leitura da base da janela de importação
// (lerImportacao.js, da Task 10) e a gravação (gravarImportacao.js) são os
// únicos arquivos da pasta que tocam o Firestore. Esta varredura segue os
// imports de verdade, arquivo por arquivo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo leitor de imports de guardianImports.test.js e newLeadImports.test.js.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const doRepo = (rel) => path.join(REPO, rel);
const relativo = (arquivo) => path.relative(REPO, arquivo).split(path.sep).join('/');

function grafoDe(entrada) {
  const arquivos = new Set();
  const pacotes = new Set();
  const visitar = (arquivo) => {
    if (arquivos.has(arquivo)) return;
    arquivos.add(arquivo);
    for (const spec of specifiersOf(readFileSync(arquivo, 'utf8'))) {
      if (spec.startsWith('.')) visitar(path.resolve(path.dirname(arquivo), spec));
      else pacotes.add(spec);
    }
  };
  visitar(entrada);
  return { arquivos: [...arquivos].map(relativo), pacotes: [...pacotes] };
}

const PROIBIDOS = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js', 'src/lib/interactions.js'];

const MODULOS = [
  'src/lib/faltosos/dias.js',
  'src/lib/faltosos/nextfitArquivos.js',
  'src/lib/faltosos/ligacaoAlunos.js',
  'src/lib/faltosos/ligacaoProfessores.js',
  'src/lib/faltosos/marcos.js',
  'src/lib/faltosos/urgente.js',
  'src/lib/faltosos/configFaltosos.js',
  'src/lib/faltosos/planoImportacao.js',
];

describe('o motor dos faltosos é puro', () => {
  it.each(MODULOS)('%s não chega a pacote, ao Firebase nem a tela', (modulo) => {
    const { arquivos, pacotes } = grafoDe(doRepo(modulo));
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx') || f.endsWith('gravarImportacao.js'))).toEqual([]);
  });

  it('o plano alcança todos os módulos do motor', () => {
    const { arquivos } = grafoDe(doRepo('src/lib/faltosos/planoImportacao.js'));
    expect(arquivos).toEqual(expect.arrayContaining(MODULOS));
  });
});
```

- [ ] **Step 6: Rodar a varredura**

Run: `npx vitest run src/lib/__tests__/faltosos.imports.test.js`
Expected: PASS, `Tests  9 passed (9)`. Passa de primeira, porque o motor já nasceu puro; ela existe para barrar o import que vier depois. Conferido ao escrever o plano: um `import { appId } from '../firebase.js'` no `marcos.js` derruba 4 dos 9 casos (o próprio `marcos.js` e os três módulos que o importam).

- [ ] **Step 7: Rodar o motor inteiro em dois fusos, a suíte e o lint**

Run: `npx vitest run src/lib/__tests__/faltosos.`
Expected: PASS, `Test Files  9 passed (9)` e `Tests  188 passed (188)`.

Run: `TZ=UTC npx vitest run src/lib/__tests__/faltosos.`
Expected: PASS, `Tests  188 passed (188)`.

Run: `npx vitest run 2>&1 | tail -5`
Expected: a linha de base da Task 0 mais 9 arquivos e 188 testes, todos passando (em `e8423e2`: `Test Files  375 passed (375)` e `Tests  7180 passed (7180)`).

Run: `npx eslint src api 2>&1 | tail -3`
Expected: igual à linha de base da Task 0 (em `e8423e2`: `0 errors, 1 warning`, o aviso antigo do `SuperAdminView.jsx`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/faltosos/planoImportacao.js src/lib/__tests__/faltosos.planoImportacao.test.js src/lib/__tests__/faltosos.imports.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: plano da importação dos relatórios da Next Fit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gravação da importação (`src/lib/firebase.js`, `src/lib/faltosos/lotesImportacao.js`, `src/lib/faltosos/gravarImportacao.js`)

A gravação recebe o plano que o gestor confirmou na prévia e grava em lotes de até 500, com ids fixos, as ligações primeiro e o registro da importação por último. Decisões do contrato que esta task aplica:

- **D1.** `lotesImportacao.js` é puro: monta cada gravação, confere o plano e divide em lotes, testado em node. `gravarImportacao.js` só faz as leituras e os lotes pelo SDK, no molde de `funnelSetup.js` e `funnelSetupWrites.js`.
- **D2.** Os ids vêm do plano: `stronix_faltosos/{leadId}`, `stronix_presencas/{leadId}_{AAAA-MM}`, `stronix_interactions/volta_{leadId}_{inicioFalta}`, `stronix_nextfit_alunos/{nomeChave}` e o registro em `stronix_importacoes_nextfit/f{E}_p{de}_{ate}`. A montagem confere cada id contra `idDaImportacao` e `idDaVolta` do plano. Três constantes de caminho novas e o `CONFIG_FALTOSOS_ID` entram em `src/lib/firebase.js`, ao lado do `PRESENCAS_PATH`, que já existe.
- **D3.** Nenhuma gravação vai para `stronix_leads`. A academia vem congelada de quem chama (a janela guarda na abertura), e o `appId` vivo nunca é lido.
- **D4.** As ligações primeiro: a lista de professores da Next Fit (só quando o plano manda, porque mudou) e cada nome de aluno guardado. Depois, um aluno por unidade: o estado, a linha da volta, a volta desfeita e os meses de presença, que nunca se partem entre lotes. Por último, num lote só, o registro e `stronix_config/faltosos.ultimaImportacao`. Antes de gravar, a gravação lê do servidor o estado de todos os alunos e roda o plano de novo (`replanejar`), e grava esse plano refeito.
- **C2.** Cada id de `voltasDesfeitas` vira o `delete` da linha na unidade do aluno, junto com o estado que reabre o período. Se o mesmo plano grava de novo a linha com o mesmo id, ela não é apagada antes.
- **M3.** A `ultimaImportacao` vem pronta do plano (`plano.config.ultimaImportacao`, com `dataFaltantesAnterior` e `ultimoDiaPresencas`), e a gravação acrescenta `importadoEm` e `importadoPorNome`.

Decisões desta task, fora do texto do contrato:

- **O registro guarda os números da prévia confirmada** (`plano.registro`), e não os do plano refeito. A spec pede o registro "com os números da prévia", e no "Tentar de novo" depois de uma falha o plano refeito não vê de novo o que a primeira tentativa já gravou, então os números dele sairiam menores.
- **Registro que já existe** (a mesma importação feita de novo): os alunos são gravados de novo (o plano refeito só manda o que mudou), e do registro só mudam `naoLigados`, `refeitaEm` e `refeitaPorNome`. Os números, quem importou, quando, e a `ultimaImportacao` ficam com os da primeira vez.
- **Outra importação com a janela aberta.** A gravação lê `stronix_config/faltosos.ultimaImportacao` do servidor e só segue se ela é a que a janela leu na abertura (`ultimaImportacaoLida`) ou esta mesma importação (o fecho já entrou e só a resposta se perdeu). Senão, devolve o erro de código `outra-importacao`, sem gravar nada. Sem isso, um plano feito sobre a configuração velha gravaria a `ultimaImportacao` para trás e contaria os marcos com o E0 errado.
- **Mensagem de erro de plano com defeito** cita a posição na lista ou o id do lead, e nunca o nome de aluno ou de professor, porque o erro pode ir para o Sentry.
- **As presenças vão com merge.** O plano já manda o mês inteiro, juntado com o que a janela leu, e o merge guarda os dias que outra gravação tenha posto no mês depois dessa leitura.

**Dependências:**
- **Task 4.** `src/lib/faltosos/planoImportacao.js` com `idDaImportacao({ dataFaltantes, periodoPresencas })` e `idDaVolta(leadId, inicioFalta)` (D2) e o `planejarImportacao` devolvendo: `recusa`, `prontoParaGravar`, `importacao: { id, dataFaltantes, dataFaltantesAnterior, periodoPresencas }`, `estados: [{ leadId, doc }]` (com `doc.status` em `faltando`, `voltou` ou `encerrado`), `voltas: [{ id, leadId, inicioFalta, voltouEm, voltouEntre, text, importacaoId, lead: { id, name, consultantId, consultantAuthUid } }]` (sem `type` e sem `hora`, no máximo uma por aluno), `voltasDesfeitas: [id]`, `presencasPorDoc: [{ id, doc: { leadId, mes, dias } }]` (cada dia com `hora` `'HH:MM'` ou `null`, `origens` só `catraca` e `agenda`, e `modalidades`), `nomesAlunos: [{ id, doc: { nomeNextFit, leadIds, origem } }]`, `config: { ultimaImportacao, professorLinks? }` e `registro` (com `naoLigados` na lista `[{ nome, telefone, relatorio }]`).
- **Task 1.** `parseFaltantes` e `parsePresencas`, só no último bloco do teste da montagem.

**Files:**
- Modify: `src/lib/leads.js:221` (constante nova logo depois de `ZAP_VIA`)
- Modify: `src/lib/firebase.js:184-186` (o comentário do `PRESENCAS_PATH` e as constantes novas em volta dele)
- Create: `src/lib/faltosos/lotesImportacao.js`
- Create: `src/lib/faltosos/gravarImportacao.js`
- Test: `src/lib/__tests__/faltosos.lotesImportacao.test.js` (novo)
- Test: `src/lib/__tests__/faltosos.gravarImportacao.test.js` (novo)

- [ ] **Step 1: Escrever o teste da montagem das gravações**

Criar `src/lib/__tests__/faltosos.lotesImportacao.test.js`:

```js
// A forma das gravações da importação da Next Fit (src/lib/faltosos/lotesImportacao.js):
// os ids fixos, a linha "Voltou a treinar", a unidade de cada aluno, o fecho,
// os lotes e as conferências que barram plano com defeito. Puro, sem
// Firebase. Os dados são inventados. O último bloco passa o plano de verdade
// (planoImportacao.js), lido de planilhas falsas, pela montagem.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIMITE_POR_LOTE,
  ERRO_OUTRA_IMPORTACAO,
  idValido,
  voltaDoId,
  erroDaGravacao,
  caminhoIndefinido,
  semIndefinidos,
  outraImportacaoEntrou,
  conferirPlano,
  montarVolta,
  montarGravacoes,
  empacotarEmLotes,
} from '../faltosos/lotesImportacao.js';
import { planejarImportacao, idDaImportacao, idDaVolta } from '../faltosos/planoImportacao.js';
import { parseFaltantes, parsePresencas } from '../faltosos/nextfitArquivos.js';
import { PRESENCE_RETURN_TYPE } from '../leads.js';

const TS = 'TS';
const QUEM = { uid: 'uid-g1', id: 'g1', nome: 'Johnny' };
const ID = 'f2026-10-06_p2026-09-29_2026-10-05';
const PERIODO = { de: '2026-09-29', ate: '2026-10-05' };
const IMPORTACAO = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO };
const ULTIMA = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO, ultimoDiaPresencas: '2026-10-05' };
const REGISTRO = {
  dataFaltantes: '2026-10-06',
  dataFaltantesAnterior: '2026-09-29',
  periodoPresencas: PERIODO,
  numeros: { voltaram: 1, entramNoMarco: { 7: 2 } },
  avisos: [],
  naoLigados: [{ nome: 'Fulano de Tal', telefone: '(51) 9 9999-0000', relatorio: 'faltantes' }],
};
const ESTADO = (leadId, extra = {}) => ({
  leadId,
  professorId: 'p1',
  professorNextFit: 'Ana Prof',
  contratoNextFit: 'Clube+ Start',
  ultimaPresenca: '2026-09-25',
  inicioFalta: '2026-09-25',
  status: 'faltando',
  voltouEm: null,
  voltouEntre: null,
  diasNaImportacao: 11,
  urgente: false,
  contratoTerminaEm: '2027-03-01',
  querCancelarEm: null,
  atualizadoNaImportacao: ID,
  tarefa: null,
  ...extra,
});
const LEAD = (id) => ({ id, name: `Aluno ${id}`, consultantId: `c-${id}`, consultantAuthUid: `uid-c-${id}` });
// A volta como o plano manda: sem `type` e sem `hora` (D5). O tipo é da
// gravação.
const VOLTA = (leadId, inicioFalta, extra = {}) => ({
  id: `volta_${leadId}_${inicioFalta}`,
  leadId,
  inicioFalta,
  voltouEm: '2026-10-03',
  voltouEntre: null,
  text: 'Voltou a treinar em 03/10',
  importacaoId: ID,
  lead: LEAD(leadId),
  ...extra,
});
const DIA = (hora, origens = ['catraca'], modalidades = []) => ({ hora, origens, modalidades });
const PRESENCA = (leadId, mes, dias) => ({ id: `${leadId}_${mes}`, doc: { leadId, mes, dias } });
const PLANO = (extra = {}) => ({
  recusa: null,
  prontoParaGravar: true,
  pendencias: { professoresNovos: [] },
  importacao: IMPORTACAO,
  estados: [],
  voltas: [],
  voltasDesfeitas: [],
  presencasPorDoc: [],
  nomesAlunos: [],
  config: { ultimaImportacao: ULTIMA },
  registro: REGISTRO,
  ...extra,
});
const montar = (plano = PLANO(), extra = {}) => montarGravacoes({ plano, quem: QUEM, carimbo: TS, ...extra });
const caminhos = (unidade) => unidade.map((op) => (op.id ? `${op.colecao}/${op.id}` : op.colecao));

describe('ids fixos (decisão D2, do planoImportacao.js)', () => {
  it('a importação tem o id das datas dos arquivos', () => {
    expect(idDaImportacao({ dataFaltantes: '2026-10-06', periodoPresencas: PERIODO })).toBe(ID);
    expect(idDaImportacao({ dataFaltantes: '2026-10-06', periodoPresencas: null })).toBe('f2026-10-06');
    expect(idDaImportacao({ dataFaltantes: null, periodoPresencas: PERIODO })).toBe('p2026-09-29_2026-10-05');
  });

  it('a linha "Voltou a treinar" tem id por aluno e período de falta', () => {
    expect(idDaVolta('L1', '2026-09-25')).toBe('volta_L1_2026-09-25');
    expect(voltaDoId('volta_L1_2026-09-25')).toEqual({ leadId: 'L1', inicioFalta: '2026-09-25' });
    expect(voltaDoId('volta_um_id_com_traco_2026-09-25')).toEqual({ leadId: 'um_id_com_traco', inicioFalta: '2026-09-25' });
  });

  it('id que não é de volta não vira aluno', () => {
    for (const ruim of ['presence_return_L1_2026-09-25', 'volta_L1', 'volta__2026-09-25', 'volta_L1_25/09/2026', null, 7]) {
      expect(voltaDoId(ruim), String(ruim)).toBeNull();
    }
  });

  it('id válido no Firestore', () => {
    expect(idValido('ana souza')).toBe(true);
    for (const ruim of ['', '.', '..', 'a/b', '__x__', null, 7]) expect(idValido(ruim), String(ruim)).toBe(false);
  });
});

describe('a linha "Voltou a treinar"', () => {
  it('a interação: tipo, texto, id fixo, autor, dono do lead e hora do servidor', () => {
    expect(montarVolta({ volta: VOLTA('L1', '2026-09-25'), importacaoId: ID, quem: QUEM, carimbo: TS })).toEqual({
      colecao: 'interacoes',
      id: 'volta_L1_2026-09-25',
      dados: {
        leadId: 'L1',
        leadName: 'Aluno L1',
        type: 'presence_return',
        text: 'Voltou a treinar em 03/10',
        voltouEm: '2026-10-03',
        voltouEntre: null,
        inicioFalta: '2026-09-25',
        importacaoId: ID,
        consultantName: 'Johnny',
        leadConsultantId: 'c-L1',
        leadConsultantAuthUid: 'uid-c-L1',
        actorId: 'g1',
        actorAuthUid: 'uid-g1',
        createdAt: TS,
      },
    });
    expect(PRESENCE_RETURN_TYPE).toBe('presence_return');
  });

  it('não conta no volume de ninguém e não mexe no lead', () => {
    const { dados } = montarVolta({
      volta: VOLTA('L1', '2026-09-25', { voltouEm: null, voltouEntre: { de: '2026-09-26', ate: '2026-10-06' }, text: 'Voltou a treinar entre 26/09 e 06/10' }),
      importacaoId: ID, quem: QUEM, carimbo: TS,
    });
    expect(dados).not.toHaveProperty('volumeKind');
    expect(dados).not.toHaveProperty('lastInteractionAt');
    expect(dados).not.toHaveProperty('interactionsCount');
    expect(dados.voltouEm).toBeNull();
    expect(dados.voltouEntre).toEqual({ de: '2026-09-26', ate: '2026-10-06' });
  });

  it('lead sem dono: os campos de segurança ficam com quem importou, como no logInteraction', () => {
    const { dados } = montarVolta({
      volta: VOLTA('L1', '2026-09-25', { lead: { id: 'L1', name: 'Aluno L1', consultantId: null, consultantAuthUid: null } }),
      importacaoId: ID, quem: QUEM, carimbo: TS,
    });
    expect(dados).toMatchObject({ leadConsultantId: 'g1', leadConsultantAuthUid: 'uid-g1' });
  });
});

describe('montarGravacoes', () => {
  it('cada aluno numa unidade, em ordem de id: o estado, a volta desfeita, a volta e os meses de presença', () => {
    const { importacaoId, unidades } = montar(PLANO({
      estados: [
        { leadId: 'L2', doc: ESTADO('L2') },
        { leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }) },
      ],
      voltas: [VOLTA('L1', '2026-09-25')],
      voltasDesfeitas: ['volta_L2_2026-09-10'],
      presencasPorDoc: [
        PRESENCA('L1', '2026-09', { '2026-09-30': DIA('07:00') }),
        PRESENCA('L1', '2026-10', { '2026-10-03': DIA('07:10') }),
        PRESENCA('L3', '2026-10', { '2026-10-01': DIA('19:00') }),
      ],
    }));
    expect(importacaoId).toBe(ID);
    expect(unidades.map(caminhos)).toEqual([
      ['faltosos/L1', 'interacoes/volta_L1_2026-09-25', 'presencas/L1_2026-09', 'presencas/L1_2026-10'],
      ['faltosos/L2', 'interacoes/volta_L2_2026-09-10'],
      ['presencas/L3_2026-10'],
    ]);
  });

  it('o estado vai inteiro, sem merge; a presença vai com merge; a volta desfeita é apagada', () => {
    const { unidades } = montar(PLANO({
      estados: [{ leadId: 'L2', doc: ESTADO('L2') }],
      voltasDesfeitas: ['volta_L2_2026-09-25'],
      presencasPorDoc: [PRESENCA('L2', '2026-10', { '2026-10-01': DIA(null, ['agenda'], ['Pilates']) })],
    }));
    const [estado, desfeita, mes] = unidades[0];
    expect(estado).toEqual({ colecao: 'faltosos', id: 'L2', dados: ESTADO('L2') });
    expect(estado.merge).toBeUndefined();
    expect(desfeita).toEqual({ colecao: 'interacoes', id: 'volta_L2_2026-09-25', apagar: true });
    expect(mes).toEqual({
      colecao: 'presencas', id: 'L2_2026-10', merge: true,
      dados: { leadId: 'L2', mes: '2026-10', dias: { '2026-10-01': DIA(null, ['agenda'], ['Pilates']) } },
    });
  });

  it('a linha desfeita e gravada de novo no mesmo plano não é apagada antes', () => {
    const { unidades } = montar(PLANO({
      estados: [{ leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-08' }) }],
      voltas: [VOLTA('L1', '2026-09-25', { voltouEm: '2026-10-08', text: 'Voltou a treinar em 08/10' })],
      voltasDesfeitas: ['volta_L1_2026-09-25'],
    }));
    expect(unidades.map(caminhos)).toEqual([['faltosos/L1', 'interacoes/volta_L1_2026-09-25']]);
    expect(unidades[0][1].apagar).toBeUndefined();
  });

  it('duas linhas de volta do mesmo aluno, mesmo de períodos diferentes, não gravam: o plano manda só a mais recente', () => {
    expect(() => montar(PLANO({
      estados: [{ leadId: 'L1', doc: ESTADO('L1', { ultimaPresenca: '2026-10-08', inicioFalta: '2026-09-30', status: 'voltou', voltouEm: '2026-10-08' }) }],
      voltas: [
        VOLTA('L1', '2026-09-20', { voltouEm: null, voltouEntre: { de: '2026-09-21', ate: '2026-09-30' }, text: 'Voltou a treinar entre 21/09 e 30/09' }),
        VOLTA('L1', '2026-09-30', { voltouEm: '2026-10-08', text: 'Voltou a treinar em 08/10' }),
      ],
    }))).toThrow(/duas linhas de volta do aluno L1/);
  });

  it('as ligações vêm primeiro: a lista de professores, com merge, e cada nome da Next Fit', () => {
    const { unidades } = montar(PLANO({
      estados: [{ leadId: 'L2', doc: ESTADO('L2') }],
      nomesAlunos: [{ id: 'caio reis', doc: { nomeNextFit: 'Caio  Reis', leadIds: ['L2', 'L2'], origem: 'telefone' } }],
      config: {
        ultimaImportacao: ULTIMA,
        professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }, { nome: 'Controle (não alterar)', professorId: null }],
      },
    }));
    expect(unidades[0]).toEqual([{
      colecao: 'config',
      merge: true,
      dados: { professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }, { nome: 'Controle (não alterar)', professorId: null }] },
    }]);
    expect(unidades[1]).toEqual([{
      colecao: 'alunos', id: 'caio reis',
      dados: { nomeNextFit: 'Caio  Reis', leadIds: ['L2'], origem: 'telefone', atualizadoEm: TS },
    }]);
    expect(caminhos(unidades[2])).toEqual(['faltosos/L2']);
  });

  it('sem professorLinks na configuração do plano, a lista de professores não é gravada', () => {
    const { unidades } = montar(PLANO({ estados: [{ leadId: 'L2', doc: ESTADO('L2') }] }));
    expect(unidades.flat().some((op) => op.colecao === 'config')).toBe(false);
  });

  it('o fecho: o registro com quem importou e quando, e a última importação com merge', () => {
    expect(montar().fecho).toEqual([
      {
        colecao: 'importacoes',
        id: ID,
        dados: { ...REGISTRO, importadoPor: 'g1', importadoPorNome: 'Johnny', importadoEm: TS },
      },
      {
        colecao: 'config',
        merge: true,
        dados: { ultimaImportacao: { ...ULTIMA, importadoEm: TS, importadoPorNome: 'Johnny' } },
      },
    ]);
  });

  it('o registro guarda os números da prévia confirmada, e não os do plano refeito', () => {
    const refeito = PLANO({ registro: { ...REGISTRO, numeros: { voltaram: 0 } } });
    expect(montarGravacoes({ plano: refeito, registro: REGISTRO, quem: QUEM, carimbo: TS }).fecho[0].dados.numeros)
      .toEqual(REGISTRO.numeros);
  });

  it('aviso com campo sem valor sai limpo do registro, sem travar a importação', () => {
    const { fecho } = montar(PLANO({ registro: { ...REGISTRO, avisos: [{ codigo: 'buraco_presencas', mensagem: undefined }] } }));
    expect(fecho[0].dados.avisos).toEqual([{ codigo: 'buraco_presencas' }]);
  });

  it('registro que já existe: o fecho só troca os não ligados e diz quando foi refeita', () => {
    expect(montar(PLANO(), { registroJaExiste: true }).fecho).toEqual([{
      colecao: 'importacoes',
      id: ID,
      merge: true,
      dados: { naoLigados: REGISTRO.naoLigados, refeitaEm: TS, refeitaPorNome: 'Johnny' },
    }]);
  });

  it('nunca grava no lead', () => {
    const { unidades, fecho } = montar(PLANO({
      estados: [{ leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }) }],
      voltas: [VOLTA('L1', '2026-09-25')],
      presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-10-03': DIA('07:10') })],
      nomesAlunos: [{ id: 'aluno l1', doc: { nomeNextFit: 'Aluno L1', leadIds: ['L1'], origem: 'telefone' } }],
    }));
    const colecoes = new Set([...unidades.flat(), ...fecho].map((op) => op.colecao));
    expect([...colecoes].sort()).toEqual(['alunos', 'config', 'faltosos', 'importacoes', 'interacoes', 'presencas']);
  });
});

describe('plano com defeito não grava nada', () => {
  const recusa = (extra, opcoes) => expect(() => montar(PLANO(extra), opcoes));

  it('plano com recusa, com professor novo sem ligação ou com o id que não bate com as datas', () => {
    expect(() => conferirPlano(PLANO({ recusa: { codigo: 'faltantes_antigo', mensagem: 'x' } }))).toThrow(/recusa \(faltantes_antigo\)/);
    expect(() => conferirPlano(null)).toThrow(/sem plano/);
    recusa({ prontoParaGravar: false }).toThrow(/professor novo/);
    recusa({ importacao: { ...IMPORTACAO, id: 'outro' } }).toThrow(/não bate com as datas/);
  });

  it('estado sem leadId, repetido, com outro leadId dentro ou com status desconhecido', () => {
    recusa({ estados: [{ leadId: 'a/b', doc: ESTADO('a/b') }] }).toThrow(/estados\[0\] sem leadId/);
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L1') }, { leadId: 'L1', doc: ESTADO('L1') }] }).toThrow(/dois estados/);
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L2') }] }).toThrow(/outro leadId/);
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L1', { status: 'sumiu' }) }] }).toThrow(/status desconhecido/);
  });

  it('volta sem o estado do aluno no mesmo plano', () => {
    recusa({ voltas: [VOLTA('L1', '2026-09-25')] }).toThrow(/sem o estado dele/);
    recusa({ voltasDesfeitas: ['volta_L1_2026-09-25'] }).toThrow(/volta desfeita do aluno L1 sem o estado/);
  });

  it('volta com id fora do formato, sem dia, com dia e intervalo, sem texto ou repetida', () => {
    const estados = [{ leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }) }];
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { id: 'presence_return_L1_2026-09-25' })] }).toThrow(/fora do formato/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { voltouEm: null })] }).toThrow(/um só/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { voltouEntre: { de: '2026-09-26', ate: '2026-10-06' } })] }).toThrow(/um só/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { text: ' ' })] }).toThrow(/sem texto/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25'), VOLTA('L1', '2026-09-25')] }).toThrow(/duas linhas/);
    recusa({ estados, voltasDesfeitas: ['volta_L1'] }).toThrow(/voltasDesfeitas\[0\] com id fora do formato/);
  });

  it('presença com id trocado, dia de outro mês, hora fora do formato ou origem desconhecida', () => {
    recusa({ presencasPorDoc: [{ id: 'L1_2026_10', doc: { leadId: 'L1', mes: '2026-10', dias: { '2026-10-01': DIA('07:00') } } }] }).toThrow(/em vez de L1_2026-10/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-09-30': DIA('07:00') })] }).toThrow(/fora do mês/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-10-01': DIA('7h') })] }).toThrow(/hora do dia/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-10-01': DIA('07:00', ['portaria']) })] }).toThrow(/origem do dia/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', {})] }).toThrow(/sem dias/);
  });

  it('campo sem valor (undefined) em qualquer lugar do estado', () => {
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L1', { urgente: undefined }) }] }).toThrow(/undefined.*faltosos\/L1: urgente/);
  });

  it('professor da Next Fit repetido ou sem escolha; nome de aluno sem chave, sem aluno, com origem estranha ou repetido', () => {
    const comLinks = (professorLinks) => ({ config: { ultimaImportacao: ULTIMA, professorLinks } });
    recusa(comLinks([{ nome: 'Ana', professorId: 'p1' }, { nome: 'Ana', professorId: null }])).toThrow(/professorLinks\[1\] repetido/);
    recusa(comLinks([{ nome: 'Ana' }])).toThrow(/Sem professor/);
    recusa(comLinks('Ana')).toThrow(/precisa ser uma lista/);
    const nome = (id, doc) => ({ nomesAlunos: [{ id, doc }] });
    recusa(nome('', { nomeNextFit: 'X', leadIds: ['L1'], origem: 'manual' })).toThrow(/nomesAlunos\[0\] sem chave/);
    recusa(nome('x', { nomeNextFit: 'X', leadIds: [], origem: 'manual' })).toThrow(/sem aluno/);
    recusa(nome('x', { nomeNextFit: 'X', leadIds: ['L1'], origem: 'nome' })).toThrow(/origem/);
    const a = { id: 'x', doc: { nomeNextFit: 'X', leadIds: ['L1'], origem: 'manual' } };
    recusa({ nomesAlunos: [a, a] }).toThrow(/nomesAlunos\[1\] repetido/);
  });

  it('a última importação do plano sem o id desta importação', () => {
    recusa({ config: { ultimaImportacao: { ...ULTIMA, id: 'outra' } } }).toThrow(/última importação/);
  });

  // O erro pode ir para o Sentry: nome de aluno e de professor fica de fora.
  it('a mensagem de erro não leva nome de aluno nem de professor', () => {
    const maria = (doc) => ({ nomesAlunos: [{ id: 'maria souza', doc: { nomeNextFit: 'Maria Souza', leadIds: ['L1'], origem: 'manual', ...doc } }] });
    const casos = [
      [maria({ leadIds: [] })],
      [maria({ origem: 'x' })],
      [{ config: { ultimaImportacao: ULTIMA, professorLinks: [{ nome: 'Rafael Prof', professorId: 'p1' }, { nome: 'Rafael Prof', professorId: 'p2' }] } }],
      [maria({}), { carimbo: undefined }],
    ];
    for (const [extra, opcoes] of casos) {
      let mensagem = '';
      try { montar(PLANO(extra), opcoes); } catch (e) { mensagem = e.message; }
      expect(mensagem).not.toBe('');
      expect(mensagem).not.toMatch(/maria|rafael/i);
    }
  });
});

describe('empacotarEmLotes', () => {
  const unidade = (n, p = 'u') => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }));

  it('lotes de até 500 gravações, na ordem, sem partir unidade', () => {
    const unidades = Array.from({ length: 300 }, (_, i) => unidade(2, `a${i}-`));
    const lotes = empacotarEmLotes(unidades);
    expect(LIMITE_POR_LOTE).toBe(500);
    expect(lotes.map((l) => l.length)).toEqual([500, 100]);
    expect(lotes.flat()).toEqual(unidades.flat());
  });

  it('a unidade que não cabe no lote começa o seguinte', () => {
    const lotes = empacotarEmLotes([unidade(3, 'a'), unidade(3, 'b'), unidade(3, 'c')], 7);
    expect(lotes.map((l) => l.map((op) => op.id))).toEqual([['a0', 'a1', 'a2', 'b0', 'b1', 'b2'], ['c0', 'c1', 'c2']]);
  });

  it('unidade vazia some, e unidade maior que o lote recusa', () => {
    expect(empacotarEmLotes([[], unidade(1)], 5)).toEqual([[{ id: 'u0' }]]);
    expect(() => empacotarEmLotes([unidade(6)], 5)).toThrow(/acima de 5/);
  });
});

describe('outra importação entrou com a janela aberta', () => {
  it('a última importação no servidor tem de ser a que a janela leu, ou esta mesma', () => {
    expect(outraImportacaoEntrou({ noServidor: { id: 'a' }, lida: { id: 'a' }, importacaoId: ID })).toBe(false);
    expect(outraImportacaoEntrou({ noServidor: { id: ID }, lida: { id: 'a' }, importacaoId: ID })).toBe(false);
    expect(outraImportacaoEntrou({ noServidor: null, lida: null, importacaoId: ID })).toBe(false);
    expect(outraImportacaoEntrou({ noServidor: { id: 'b' }, lida: { id: 'a' }, importacaoId: ID })).toBe(true);
    expect(outraImportacaoEntrou({ noServidor: { id: 'b' }, lida: null, importacaoId: ID })).toBe(true);
  });

  it('o erro tem código, como os do Firestore, para a tela escolher a mensagem', () => {
    const erro = erroDaGravacao(ERRO_OUTRA_IMPORTACAO, 'texto');
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: 'outra-importacao', message: 'texto' });
  });
});

describe('caminhoIndefinido e semIndefinidos', () => {
  it('acha o undefined em objeto e lista, e trata o resto como folha', () => {
    expect(caminhoIndefinido({ a: 1, b: { c: [1, undefined] } })).toBe('b.c[1]');
    expect(caminhoIndefinido({ a: null, b: [] })).toBeNull();
    class Hora { constructor() { this.x = undefined; } }
    expect(caminhoIndefinido({ quando: new Hora() })).toBeNull();
  });

  it('tira o campo sem valor do objeto e troca o item sem valor da lista por null', () => {
    expect(semIndefinidos({ a: 1, b: undefined, c: [1, undefined, { d: undefined }] })).toEqual({ a: 1, c: [1, null, {}] });
  });
});

// O plano de verdade, das planilhas falsas até as gravações: é aqui que a
// saída do planejarImportacao e a entrada da gravação se encontram.
describe('o plano de verdade vira gravações', () => {
  const brt = (s) => new Date(`${s}:00-03:00`);
  const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
  const fone = (n) => `(51) 9 9100-${String(n).padStart(4, '0')}`;
  const cliente = (id, name, n) => ({
    id, name, whatsapp: fone(n), lifecycleBucket: 'cliente', consultantId: 'cons-1', consultantAuthUid: 'uid-cons-1',
    currentContractId: `c-${id}`, currentContractStatus: 'ativo',
    currentContractStartsAt: brt('2026-01-10T00:00'), currentContractEndsAt: brt('2027-06-10T00:00'),
  });
  const CLIENTES = [cliente('ana', 'Ana Teste', 1), cliente('bia', 'Bia Teste', 2)];
  const PROFESSORES = [{ id: 'p-ana', nome: 'Ana Paula Ribeiro', ativo: true }, { id: 'p-bruno', nome: 'Bruno Tavares', ativo: true }];
  const LINKS = [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }, { nome: 'Bruno Tavares', professorId: 'p-bruno' }];
  const CONFIG = { marcos: [7, 14, 30, 60], janelaUrgenteDias: 90, professorLinks: LINKS };
  // Linha do Faltantes de quem está há `dias` dias sem vir no dia `e`.
  const linhaF = (nome, n, ultimaPresenca, dias, professor) => ({
    Nome: nome, Contrato: 'Plano Anual', 'Qtde de ausências': dias, 'Última presença': br(ultimaPresenca),
    Telefone: fone(n), Professor: professor, Consultor: 'Carla Mendes',
  });
  const arquivoF = (linhas) => parseFaltantes(linhas.map((l, i) => ({ __row: i + 2, ...l })));
  const arquivoP = (linhas) => parsePresencas(linhas.map((l, i) => ({ __row: i + 2, ...l })));
  const planejar = ({ faltantes = null, presencas = null, estados = {}, nomes = {}, ultimaImportacao = null, agora }) => planejarImportacao({
    faltantes,
    presencas,
    estadosAtuais: estados,
    presencasAtuais: {},
    clientes: CLIENTES,
    professores: PROFESSORES,
    ligacoes: { professores: LINKS, alunos: nomes, manuais: [] },
    config: { ...CONFIG, ultimaImportacao },
    agora,
  });

  it('primeira semana e semana seguinte, com a volta e a presença do aluno na mesma unidade', () => {
    // Semana 1, Faltantes de 06/10: Ana sem vir desde 29/09 e Bia desde 23/09.
    const plano1 = planejar({
      faltantes: arquivoF([
        linhaF('Ana Teste', 1, '2026-09-29', 7, 'Ana Paula Ribeiro'),
        linhaF('Bia Teste', 2, '2026-09-23', 13, 'Bruno Tavares'),
      ]),
      agora: brt('2026-10-06T10:00'),
    });
    const g1 = montarGravacoes({ plano: plano1, quem: QUEM, carimbo: TS });
    expect(g1.importacaoId).toBe('f2026-10-06');
    expect(g1.unidades.flat().filter((op) => op.colecao === 'faltosos').map((op) => op.id)).toEqual(['ana', 'bia']);
    expect(g1.fecho.map((op) => (op.id ? `${op.colecao}/${op.id}` : op.colecao))).toEqual(['importacoes/f2026-10-06', 'config']);
    expect(g1.fecho[1].dados.ultimaImportacao).toMatchObject({ id: 'f2026-10-06', dataFaltantes: '2026-10-06', importadoPorNome: 'Johnny' });

    // O que a gravação deixaria no banco.
    const estados = Object.fromEntries(plano1.estados.map((e) => [e.leadId, e.doc]));
    const nomes = Object.fromEntries(plano1.nomesAlunos.map((n) => [n.id, n.doc]));

    // Semana 2: o Faltantes de 13/10 traz só a Bia, e o Presenças mostra a Ana
    // na catraca em 08/10.
    const plano2 = planejar({
      faltantes: arquivoF([linhaF('Bia Teste', 2, '2026-09-23', 20, 'Bruno Tavares')]),
      presencas: arquivoP([{ Cliente: 'Ana Teste', Modalidade: 'offf', Contrato: 'Plano Anual', Tipo: 'Acesso', Data: '08/10/2026 07:10' }]),
      estados,
      nomes,
      ultimaImportacao: plano1.config.ultimaImportacao,
      agora: brt('2026-10-13T10:00'),
    });
    const g2 = montarGravacoes({ plano: plano2, quem: QUEM, carimbo: TS });
    expect(g2.importacaoId).toBe('f2026-10-13_p2026-10-08_2026-10-08');
    const daAna = g2.unidades.find((u) => u.some((op) => op.colecao === 'faltosos' && op.id === 'ana'));
    expect(caminhos(daAna)).toEqual(['faltosos/ana', 'interacoes/volta_ana_2026-09-29', 'presencas/ana_2026-10']);
    expect(daAna[1].dados).toMatchObject({ type: 'presence_return', text: 'Voltou a treinar em 08/10', voltouEm: '2026-10-08', inicioFalta: '2026-09-29' });
    expect(daAna[0].dados).toMatchObject({ status: 'voltou', voltouEm: '2026-10-08' });
  });
});

// Mesmo leitor de imports de guardianImports.test.js e newLeadImports.test.js.
describe('lotesImportacao.js é puro', () => {
  const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
  const stripComments = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
  const REPO = fileURLToPath(new URL('../../../', import.meta.url));

  it('não chega a pacote, ao Firebase, à Meta Diária nem à gravação', () => {
    const arquivos = new Set();
    const pacotes = new Set();
    const visitar = (arquivo) => {
      if (arquivos.has(arquivo)) return;
      arquivos.add(arquivo);
      for (const m of stripComments(readFileSync(arquivo, 'utf8')).matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        if (spec.startsWith('.')) visitar(path.resolve(path.dirname(arquivo), spec));
        else pacotes.add(spec);
      }
    };
    visitar(path.join(REPO, 'src/lib/faltosos/lotesImportacao.js'));
    const relativos = [...arquivos].map((f) => path.relative(REPO, f).split(path.sep).join('/'));
    expect([...pacotes]).toEqual([]);
    const proibidos = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js', 'src/lib/interactions.js', 'src/lib/faltosos/gravarImportacao.js'];
    expect(relativos.filter((f) => proibidos.includes(f) || f.endsWith('.jsx'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.lotesImportacao.test.js`

Expected: FAIL antes de rodar teste, `Error: Cannot find module '../faltosos/lotesImportacao.js' imported from .../src/lib/__tests__/faltosos.lotesImportacao.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: O tipo da linha em `src/lib/leads.js`**

A constante nova entra logo depois de `ZAP_VIA`. Em `src/lib/leads.js`, trocar:

```js
export const ZAP_VIA = 'stronizap';

// Tipo da interação que a ponte grava quando o lead escreve ou a equipe envia
```

por:

```js
export const ZAP_VIA = 'stronizap';

// Tipo da interação que a importação das planilhas da Next Fit grava quando
// um aluno faltando volta a treinar (src/lib/faltosos/lotesImportacao.js): a
// linha "Voltou a treinar em 03/10" da linha do tempo, no filtro Marcos. É
// registro da presença, e não contato com a pessoa.
export const PRESENCE_RETURN_TYPE = 'presence_return';

// Tipo da interação que a ponte grava quando o lead escreve ou a equipe envia
```

`leads.js` não ganha import novo. A Task 6 faz a linha do tempo, a Meta e o Dashboard CRM reconhecerem o tipo.

- [ ] **Step 4: Criar `src/lib/faltosos/lotesImportacao.js`**

```js
// A forma das gravações da importação das planilhas da Next Fit: o documento
// de cada coleção, a linha "Voltou a treinar", a ordem e a divisão em lotes.
// O QUE muda em cada aluno vem do plano (planoImportacao.js); quem grava de
// verdade é o gravarImportacao.js. Spec em
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A
// gravação".
//
// Puro: nada de firebase.js aqui, para o teste rodar em node. A hora do
// servidor chega pronta em `carimbo` (o serverTimestamp() de quem grava), no
// molde do toSetupWrites (src/lib/funnelSetup.js). Cada gravação sai com o
// nome curto da coleção ('faltosos', 'presencas', 'interacoes', 'alunos',
// 'importacoes' e 'config', que é sempre o doc stronix_config/faltosos), e o
// gravarImportacao.js troca pelo caminho. Nenhuma gravação vai para o lead: a
// volta a treinar não é contato com a pessoa.

import { PRESENCE_RETURN_TYPE, getInteractionSecurityFields } from '../leads.js';
import { idDaImportacao, idDaVolta } from './planoImportacao.js';

// Gravações por lote, como a spec pede. A importação de clientes grava 450
// por lote (clientImportWrites.js) com as regras lendo os mesmos documentos
// em cada gravação, então o lote de 500 passa nas regras do mesmo jeito.
export const LIMITE_POR_LOTE = 500;

// Código do erro de quando outra importação foi gravada enquanto esta janela
// estava aberta. A tela mostra a mensagem do erro e pede para começar de novo.
export const ERRO_OUTRA_IMPORTACAO = 'outra-importacao';
export const MENSAGEM_OUTRA_IMPORTACAO = 'Outra importação foi gravada enquanto esta janela estava aberta. Nada foi gravado. Feche a janela e importe os arquivos de novo.';

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}$/;
// Id da linha "Voltou a treinar": volta_{leadId}_{inicioFalta}.
const VOLTA_RE = /^volta_(.+)_(\d{4}-\d{2}-\d{2})$/;
const STATUS_DO_ALUNO = ['faltando', 'voltou', 'encerrado'];
const ORIGENS_DO_NOME = ['telefone', 'manual'];
const ORIGENS_DA_PRESENCA = ['catraca', 'agenda'];

const ehDia = (v) => typeof v === 'string' && DIA_RE.test(v);
const ehTexto = (v) => typeof v === 'string' && v.trim() !== '';
const ehObjetoComum = (v) => v !== null && typeof v === 'object'
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// O que o Firestore aceita como id de documento: sem barra, sem ser só "." ou
// "..", sem o formato __x__ e com até 1.500 bytes.
export const idValido = (id) => typeof id === 'string'
  && id !== '' && id !== '.' && id !== '..'
  && !id.includes('/') && !/^__.*__$/.test(id)
  && new TextEncoder().encode(id).length <= 1500;

// As mensagens de erro citam a posição na lista ou o id do lead, e nunca o
// nome: o erro pode ir para o Sentry, e nome de aluno ou de professor não vai
// para lá.
const invalido = (motivo) => new Error(`plano da importação inválido: ${motivo}`);

// Erro com código, como os do Firestore, para a tela escolher a mensagem.
export const erroDaGravacao = (code, message) => Object.assign(new Error(message), { code });

// O aluno e o período de uma linha "Voltou a treinar", tirados do id, ou null
// para id fora do formato. É assim que a volta desfeita, que o plano manda só
// pelo id, entra na unidade do aluno.
export function voltaDoId(id) {
  const m = typeof id === 'string' ? VOLTA_RE.exec(id) : null;
  if (!m || idDaVolta(m[1], m[2]) !== id) return null;
  return { leadId: m[1], inicioFalta: m[2] };
}

// O Firestore do app recusa `undefined` em qualquer campo, e a recusa derruba
// o lote inteiro. Procura em objetos comuns e listas; o resto (Timestamp, a
// hora do servidor) é folha. Devolve o caminho do primeiro achado, ou null.
export function caminhoIndefinido(valor, caminho = '') {
  if (valor === undefined) return caminho || '(raiz)';
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i += 1) {
      const achado = caminhoIndefinido(valor[i], `${caminho}[${i}]`);
      if (achado) return achado;
    }
    return null;
  }
  if (ehObjetoComum(valor)) {
    for (const [k, v] of Object.entries(valor)) {
      const achado = caminhoIndefinido(v, caminho ? `${caminho}.${k}` : k);
      if (achado) return achado;
    }
  }
  return null;
}

// O registro da importação só informa: um campo sem valor nos números, nos
// avisos ou nos não ligados sai do registro em vez de travar a importação. No
// estado, nas presenças, nos nomes e na linha da volta, campo sem valor é
// defeito do plano e para tudo.
export function semIndefinidos(valor) {
  if (Array.isArray(valor)) return valor.map((v) => (v === undefined ? null : semIndefinidos(v)));
  if (ehObjetoComum(valor)) {
    return Object.fromEntries(
      Object.entries(valor).filter(([, v]) => v !== undefined).map(([k, v]) => [k, semIndefinidos(v)])
    );
  }
  return valor;
}

// Outra importação entrou depois que a janela leu a configuração? A última
// importação no servidor tem de ser a que a janela leu na abertura, ou esta
// mesma (o fecho dela já foi gravado e só a resposta se perdeu).
export function outraImportacaoEntrou({ noServidor, lida, importacaoId }) {
  const atual = noServidor?.id ?? null;
  return atual !== (lida?.id ?? null) && atual !== importacaoId;
}

// Confere o plano antes de qualquer leitura ou gravação e devolve o id da
// importação. Plano com recusa, com professor novo sem ligação ou com o id
// que não bate com as datas dos arquivos não grava nada.
export function conferirPlano(plano) {
  if (!plano) throw invalido('sem plano');
  if (plano.recusa) throw invalido(`plano com recusa (${plano.recusa.codigo ?? 'sem código'})`);
  if (plano.prontoParaGravar !== true) throw invalido('professor novo da Next Fit sem ligação');
  const id = plano.importacao?.id;
  if (!idValido(id) || id !== idDaImportacao(plano.importacao)) {
    throw invalido(`importação com id ${id}, que não bate com as datas dos arquivos`);
  }
  return id;
}

// A interação "Voltou a treinar". Sai no nome de quem importou (consultantName,
// actorId e actorAuthUid), com o dono do lead nos campos de segurança, como o
// logInteraction. Não leva volumeKind, então não conta no volume de ninguém. E
// não mexe no lead, sem lastInteractionAt e sem interactionsCount, como a
// importação de clientes. O createdAt é a hora da importação; o dia da volta
// vai no texto e em voltouEm ou voltouEntre.
export function montarVolta({ volta, importacaoId, quem = null, carimbo }) {
  return {
    colecao: 'interacoes',
    id: volta.id,
    dados: {
      leadId: volta.leadId,
      leadName: volta.lead?.name ?? null,
      type: PRESENCE_RETURN_TYPE,
      text: volta.text,
      voltouEm: ehDia(volta.voltouEm) ? volta.voltouEm : null,
      voltouEntre: ehDia(volta.voltouEm) ? null : { de: volta.voltouEntre.de, ate: volta.voltouEntre.ate },
      inicioFalta: volta.inicioFalta,
      importacaoId,
      consultantName: quem?.nome || null,
      ...getInteractionSecurityFields(volta.lead, { id: quem?.id, authUid: quem?.uid }),
      actorId: quem?.id ?? null,
      actorAuthUid: quem?.uid ?? null,
      createdAt: carimbo,
    },
  };
}

function conferirEstado(e, i) {
  if (!idValido(e?.leadId)) throw invalido(`estados[${i}] sem leadId`);
  if (!ehObjetoComum(e.doc)) throw invalido(`estado do aluno ${e.leadId}`);
  if (e.doc.leadId !== undefined && e.doc.leadId !== e.leadId) throw invalido(`estado do aluno ${e.leadId} com outro leadId dentro`);
  if (!STATUS_DO_ALUNO.includes(e.doc.status)) throw invalido(`estado do aluno ${e.leadId} com status desconhecido`);
}

function conferirVolta(v, i) {
  if (!idValido(v?.leadId)) throw invalido(`voltas[${i}] sem leadId`);
  if (!ehDia(v.inicioFalta)) throw invalido(`volta do aluno ${v.leadId} sem inicioFalta`);
  if (v.id !== idDaVolta(v.leadId, v.inicioFalta)) throw invalido(`volta do aluno ${v.leadId} com id fora do formato`);
  const temDia = ehDia(v.voltouEm);
  const temIntervalo = Boolean(v.voltouEntre && ehDia(v.voltouEntre.de) && ehDia(v.voltouEntre.ate)
    && v.voltouEntre.de <= v.voltouEntre.ate);
  if (temDia === temIntervalo) throw invalido(`volta do aluno ${v.leadId} precisa de voltouEm ou de voltouEntre, um só`);
  if (!ehTexto(v.text)) throw invalido(`volta do aluno ${v.leadId} sem texto`);
}

function conferirPresenca(p, i) {
  const d = p?.doc;
  if (!d || !idValido(d.leadId) || !MES_RE.test(d.mes ?? '')) throw invalido(`presencasPorDoc[${i}]`);
  if (p.id !== `${d.leadId}_${d.mes}`) throw invalido(`presencasPorDoc[${i}] com id ${p.id} em vez de ${d.leadId}_${d.mes}`);
  if (!ehObjetoComum(d.dias) || Object.keys(d.dias).length === 0) throw invalido(`presencas ${p.id} sem dias`);
  for (const [dia, v] of Object.entries(d.dias)) {
    if (!ehDia(dia) || dia.slice(0, 7) !== d.mes) throw invalido(`dia ${dia} fora do mês ${d.mes} em ${p.id}`);
    if (!(v?.hora === null || HORA_RE.test(v?.hora ?? ''))) throw invalido(`hora do dia ${dia} em ${p.id}`);
    if (!Array.isArray(v.origens) || !v.origens.every((o) => ORIGENS_DA_PRESENCA.includes(o))) {
      throw invalido(`origem do dia ${dia} em ${p.id}`);
    }
    if (!Array.isArray(v.modalidades) || !v.modalidades.every(ehTexto)) throw invalido(`modalidades do dia ${dia} em ${p.id}`);
  }
}

function conferirLinks(links) {
  if (!Array.isArray(links)) throw invalido('professorLinks precisa ser uma lista');
  const nomes = new Set();
  links.forEach((l, i) => {
    if (!ehTexto(l?.nome)) throw invalido(`professorLinks[${i}] sem nome`);
    if (!(l.professorId === null || ehTexto(l.professorId))) throw invalido(`professorLinks[${i}] sem professorId nem "Sem professor"`);
    if (nomes.has(l.nome)) throw invalido(`professorLinks[${i}] repetido`);
    nomes.add(l.nome);
  });
}

function montarNome(n, i, carimbo) {
  if (!idValido(n?.id)) throw invalido(`nomesAlunos[${i}] sem chave`);
  const d = n.doc;
  if (!ehTexto(d?.nomeNextFit)) throw invalido(`nomesAlunos[${i}] sem o nome da Next Fit`);
  if (!Array.isArray(d.leadIds) || d.leadIds.length === 0 || !d.leadIds.every(idValido)) throw invalido(`nomesAlunos[${i}] sem aluno`);
  if (!ORIGENS_DO_NOME.includes(d.origem)) throw invalido(`nomesAlunos[${i}] com origem da ligação desconhecida`);
  return {
    colecao: 'alunos',
    id: n.id,
    dados: { nomeNextFit: d.nomeNextFit, leadIds: [...new Set(d.leadIds)], origem: d.origem, atualizadoEm: carimbo },
  };
}

// Monta todas as gravações da importação, em unidades que não se partem:
// - as ligações primeiro: a lista de professores da Next Fit (só quando o
//   plano manda, porque mudou) e cada nome de aluno guardado. Assim a escolha
//   do gestor fica guardada mesmo que a gravação pare depois;
// - depois um aluno por unidade: o estado, a linha "Voltou a treinar" que
//   sai, a que é desfeita (apagada) e os meses de presença entram juntos ou
//   ficam de fora juntos. Se o estado virasse "voltou" num lote e a linha
//   ficasse num lote que falhou, a importação refeita não veria mais o aluno
//   faltando e a linha nunca seria gravada;
// - e, à parte, o fecho: o registro da importação e a última importação em
//   stronix_config/faltosos, que vão por último e num lote só.
//
// O registro guarda os números da prévia que o gestor confirmou (`registro`,
// que por padrão é o do próprio plano). Quando ele já existe (a mesma
// importação feita de novo), o fecho só troca os não ligados, que são os "Não
// achados" da aba Faltosos, e diz quando foi refeita. Os números, quem
// importou, quando, e a última importação ficam como estavam: a importação
// refeita não vê de novo o que a primeira já mudou, e os números dela sairiam
// menores.
//
// Confere tudo antes: plano com defeito não grava nada.
export function montarGravacoes({ plano, registro = plano?.registro, quem = null, registroJaExiste = false, carimbo }) {
  const importacaoId = conferirPlano(plano);
  if (!ehObjetoComum(registro)) throw invalido('importação sem o registro');
  if (registro.id !== undefined && registro.id !== importacaoId) throw invalido(`registro com id ${registro.id}, mas a importação é ${importacaoId}`);

  const porAluno = new Map();
  const doAluno = (leadId) => {
    if (!porAluno.has(leadId)) porAluno.set(leadId, { estado: [], desfeitas: [], voltas: [], presencas: [] });
    return porAluno.get(leadId);
  };

  (plano.estados || []).forEach((e, i) => {
    conferirEstado(e, i);
    const aluno = doAluno(e.leadId);
    if (aluno.estado.length) throw invalido(`dois estados do aluno ${e.leadId}`);
    aluno.estado.push({ colecao: 'faltosos', id: e.leadId, dados: e.doc });
  });

  // Uma linha de volta por aluno: o plano manda só a do período mais recente.
  const idsDasVoltas = new Set();
  (plano.voltas || []).forEach((v, i) => {
    conferirVolta(v, i);
    if (idsDasVoltas.has(v.id)) throw invalido(`duas linhas ${v.id}`);
    idsDasVoltas.add(v.id);
    const aluno = doAluno(v.leadId);
    if (!aluno.estado.length) throw invalido(`volta do aluno ${v.leadId} sem o estado dele`);
    if (aluno.voltas.length) throw invalido(`duas linhas de volta do aluno ${v.leadId}`);
    aluno.voltas.push(montarVolta({ volta: v, importacaoId, quem, carimbo }));
  });

  (plano.voltasDesfeitas || []).forEach((id, i) => {
    const volta = voltaDoId(id);
    if (!volta) throw invalido(`voltasDesfeitas[${i}] com id fora do formato`);
    const aluno = doAluno(volta.leadId);
    if (!aluno.estado.length) throw invalido(`volta desfeita do aluno ${volta.leadId} sem o estado dele`);
    // A mesma linha gravada de novo neste plano: o set troca o documento
    // inteiro, e apagar antes não muda nada.
    if (idsDasVoltas.has(id)) return;
    aluno.desfeitas.push({ colecao: 'interacoes', id, apagar: true });
  });

  const idsDasPresencas = new Set();
  (plano.presencasPorDoc || []).forEach((p, i) => {
    conferirPresenca(p, i);
    if (idsDasPresencas.has(p.id)) throw invalido(`presencas ${p.id} repetido`);
    idsDasPresencas.add(p.id);
    doAluno(p.doc.leadId).presencas.push({
      colecao: 'presencas',
      id: p.id,
      dados: { leadId: p.doc.leadId, mes: p.doc.mes, dias: p.doc.dias },
      merge: true,
    });
  });

  const unidades = [];
  const professorLinks = plano.config?.professorLinks;
  if (professorLinks != null) {
    conferirLinks(professorLinks);
    unidades.push([{
      colecao: 'config',
      dados: { professorLinks: professorLinks.map((l) => ({ nome: l.nome, professorId: l.professorId ?? null })) },
      merge: true,
    }]);
  }
  const chaves = new Set();
  (plano.nomesAlunos || []).forEach((n, i) => {
    const op = montarNome(n, i, carimbo);
    if (chaves.has(op.id)) throw invalido(`nomesAlunos[${i}] repetido`);
    chaves.add(op.id);
    unidades.push([op]);
  });
  for (const leadId of [...porAluno.keys()].sort()) {
    const a = porAluno.get(leadId);
    unidades.push([...a.estado, ...a.desfeitas, ...a.voltas, ...a.presencas]);
  }

  let fecho;
  if (registroJaExiste) {
    fecho = [{
      colecao: 'importacoes',
      id: importacaoId,
      dados: { naoLigados: semIndefinidos(registro.naoLigados ?? null), refeitaEm: carimbo, refeitaPorNome: quem?.nome || null },
      merge: true,
    }];
  } else {
    const ultima = plano.config?.ultimaImportacao;
    if (!ehObjetoComum(ultima) || ultima.id !== importacaoId) throw invalido('última importação sem o id desta importação');
    fecho = [
      {
        colecao: 'importacoes',
        id: importacaoId,
        dados: {
          ...semIndefinidos(registro),
          importadoPor: quem?.id ?? null,
          importadoPorNome: quem?.nome || null,
          importadoEm: carimbo,
        },
      },
      {
        colecao: 'config',
        dados: { ultimaImportacao: { ...ultima, importadoEm: carimbo, importadoPorNome: quem?.nome || null } },
        merge: true,
      },
    ];
  }

  for (const op of [...unidades.flat(), ...fecho]) {
    if (op.apagar) continue;
    const achado = caminhoIndefinido(op.dados);
    // O id de 'alunos' é o nome do aluno: fica fora da mensagem.
    const onde = op.colecao === 'alunos' || op.colecao === 'config' ? op.colecao : `${op.colecao}/${op.id}`;
    if (achado) throw invalido(`campo sem valor (undefined) em ${onde}: ${achado}`);
  }
  return { importacaoId, unidades, fecho };
}

// Junta as unidades em lotes de até `limite` gravações, na ordem, sem partir
// nenhuma unidade.
export function empacotarEmLotes(unidades, limite = LIMITE_POR_LOTE) {
  const lotes = [];
  let atual = [];
  for (const unidade of unidades) {
    if (unidade.length === 0) continue;
    if (unidade.length > limite) throw invalido(`uma unidade com ${unidade.length} gravações, acima de ${limite}`);
    if (atual.length + unidade.length > limite) {
      lotes.push(atual);
      atual = [];
    }
    atual.push(...unidade);
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}
```

Esse arquivo tem `professorId` como chave, e a varredura do histórico do professor reprova arquivo novo assim até ele ser revisado. Ele não grava o professor do lead. Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, trocar:

```js
  'src/lib/faltosos/planoImportacao.js': 'estado de cada faltoso (stronix_faltosos), não o lead',
};
```

por:

```js
  'src/lib/faltosos/planoImportacao.js': 'estado de cada faltoso (stronix_faltosos), não o lead',
  'src/lib/faltosos/lotesImportacao.js': 'gravação de stronix_faltosos, nunca de stronix_leads',
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.lotesImportacao.test.js`

Expected: PASS, `Tests  36 passed (36)`.

Se só o bloco "o plano de verdade vira gravações" falhar, a saída do `planejarImportacao` da Task 4 não é a da lista de dependências acima. Pare e confira a Task 4 contra essa lista antes de seguir, e corrija o lado que estiver errado. Não afrouxe as conferências da montagem.

Run: `npx eslint src/lib/leads.js src/lib/faltosos/lotesImportacao.js src/lib/__tests__/faltosos.lotesImportacao.test.js`

Expected: nenhuma saída.

- [ ] **Step 6: Escrever o teste da gravação**

Criar `src/lib/__tests__/faltosos.gravarImportacao.test.js`:

```js
// A gravação da importação da Next Fit (src/lib/faltosos/gravarImportacao.js).
// Sem Firebase de verdade: firebase/firestore e ../firebase.js são falsos, e os
// documentos vivem num Map em memória que imita o set com e sem merge e o
// delete. Assim o teste refaz a importação, derruba um lote no meio e confere
// o banco no fim. O plano refeito antes de gravar é um dublê que só devolve o
// que muda, como o planejarImportacao. Os dados são inventados.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const m = vi.hoisted(() => ({
  banco: new Map(),
  lotes: [],
  falharNoCommit: null,
  falharLeitura: false,
  ts: 'TS1',
}));

// O appId vivo é de outra academia de propósito: a gravação só pode usar a
// academia que recebe de quem chama.
vi.mock('../firebase.js', () => ({
  appId: 'outra',
  CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos',
  FALTOSOS_PATH: 'stronix_faltosos',
  PRESENCAS_PATH: 'stronix_presencas',
  IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit',
  NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
  INTERACTIONS_PATH: 'stronix_interactions',
}));

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const juntar = (velho, novo) => {
  const out = { ...(ehObjeto(velho) ? velho : {}) };
  for (const [k, v] of Object.entries(novo)) out[k] = ehObjeto(v) && ehObjeto(out[k]) ? juntar(out[k], v) : v;
  return out;
};

vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (_db, ...p) => ({ path: p.join('/'), id: p[p.length - 1] }),
  serverTimestamp: () => m.ts,
  getDocFromServer: async (ref) => {
    if (m.falharLeitura) throw Object.assign(new Error('offline'), { code: 'unavailable' });
    const d = m.banco.get(ref.path);
    return { id: ref.id, exists: () => d !== undefined, data: () => d };
  },
  getDocsFromServer: async (col) => {
    if (m.falharLeitura) throw Object.assign(new Error('offline'), { code: 'unavailable' });
    const prefixo = `${col.path}/`;
    const docs = [...m.banco.entries()]
      .filter(([p]) => p.startsWith(prefixo) && !p.slice(prefixo.length).includes('/'))
      .map(([p, d]) => ({ id: p.slice(prefixo.length), data: () => d }));
    return { docs };
  },
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, dados, opcoes) => { ops.push({ path: ref.path, dados, merge: Boolean(opcoes?.merge) }); },
      delete: (ref) => { ops.push({ path: ref.path, apagar: true }); },
      commit: async () => {
        const n = m.lotes.length + 1;
        if (m.falharNoCommit === n) throw Object.assign(new Error('falhou'), { code: 'permission-denied' });
        m.lotes.push(ops);
        for (const op of ops) {
          if (op.apagar) m.banco.delete(op.path);
          else m.banco.set(op.path, op.merge ? juntar(m.banco.get(op.path), op.dados) : op.dados);
        }
      },
    };
  },
}));

const { gravarImportacao, lerRegistroDaImportacao } = await import('../faltosos/gravarImportacao.js');

const BASE = 'artifacts/acad/public/data';
const QUEM = { uid: 'uid-g1', id: 'g1', nome: 'Johnny' };
const ID = 'f2026-10-06_p2026-09-29_2026-10-05';
const PERIODO = { de: '2026-09-29', ate: '2026-10-05' };
const IMPORTACAO = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO };
const ULTIMA = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO, ultimoDiaPresencas: '2026-10-05' };
const REGISTRO = {
  dataFaltantes: '2026-10-06',
  dataFaltantesAnterior: '2026-09-29',
  periodoPresencas: PERIODO,
  numeros: { voltaram: 1 },
  avisos: [],
  naoLigados: [],
};
const ESTADO = (leadId, extra = {}) => ({
  leadId, professorId: 'p1', professorNextFit: 'Ana Prof', contratoNextFit: 'Clube+ Start',
  ultimaPresenca: '2026-09-25', inicioFalta: '2026-09-25', status: 'faltando',
  voltouEm: null, voltouEntre: null, diasNaImportacao: 11, urgente: false,
  contratoTerminaEm: '2027-03-01', querCancelarEm: null, atualizadoNaImportacao: ID, tarefa: null,
  ...extra,
});
const DIA = (hora, origens = ['catraca'], modalidades = []) => ({ hora, origens, modalidades });
const VOLTA_L1 = {
  id: 'volta_L1_2026-09-25', leadId: 'L1', inicioFalta: '2026-09-25',
  voltouEm: '2026-10-03', voltouEntre: null, text: 'Voltou a treinar em 03/10', importacaoId: ID,
  lead: { id: 'L1', name: 'Bia Lima', consultantId: 'c1', consultantAuthUid: 'uid-c1' },
};

// O que a importação quer deixar no banco: L1 voltou em 03/10 (com presença no
// Presenças), L2 segue faltando, L3 só tem presença, e um nome da Next Fit.
const ALVO = {
  estados: {
    L1: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }),
    L2: ESTADO('L2', { ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20', diasNaImportacao: 16 }),
  },
  voltas: [VOLTA_L1],
  presencasPorDoc: [
    { id: 'L1_2026-10', doc: { leadId: 'L1', mes: '2026-10', dias: { '2026-10-03': DIA('07:10') } } },
    { id: 'L3_2026-09', doc: { leadId: 'L3', mes: '2026-09', dias: { '2026-09-30': DIA('19:00', ['agenda'], ['Pilates']) } } },
  ],
  nomesAlunos: [{ id: 'bia lima', doc: { nomeNextFit: 'Bia Lima', leadIds: ['L1'], origem: 'telefone' } }],
  professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }],
};

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Dublê do planejarImportacao: devolve só os estados que mudam em relação aos
// lidos, e só a linha da volta de quem ainda não voltou. É o que o plano de
// verdade faz, e é por isso que a importação refeita não duplica nada.
const planoPara = (alvo, estadosAtuais = {}) => ({
  recusa: null,
  prontoParaGravar: true,
  pendencias: { professoresNovos: [] },
  importacao: IMPORTACAO,
  estados: Object.entries(alvo.estados)
    .filter(([leadId, doc]) => !igual(estadosAtuais[leadId], doc))
    .map(([leadId, doc]) => ({ leadId, doc })),
  voltas: (alvo.voltas || []).filter((v) => estadosAtuais[v.leadId]?.status !== 'voltou'),
  voltasDesfeitas: alvo.voltasDesfeitas || [],
  presencasPorDoc: alvo.presencasPorDoc || [],
  nomesAlunos: alvo.nomesAlunos || [],
  config: { ultimaImportacao: ULTIMA, ...(alvo.professorLinks ? { professorLinks: alvo.professorLinks } : {}) },
  registro: REGISTRO,
});

const gravar = ({ alvo = ALVO, ...over } = {}) => gravarImportacao({
  db: {},
  tenant: 'acad',
  plano: planoPara(alvo),
  replanejar: (estadosAtuais) => planoPara(alvo, estadosAtuais),
  ultimaImportacaoLida: null,
  quem: QUEM,
  ...over,
});

const caminhos = (lote) => lote.map((op) => `${op.apagar ? 'apaga ' : ''}${op.path.replace(`${BASE}/`, '')}`);
const fotoDoBanco = () => Object.fromEntries([...m.banco.entries()].sort(([a], [b]) => a.localeCompare(b)));

beforeEach(() => {
  m.banco.clear();
  m.lotes.length = 0;
  m.falharNoCommit = null;
  m.falharLeitura = false;
  m.ts = 'TS1';
});

describe('gravarImportacao', () => {
  it('grava as ligações, os alunos e, por último e num lote só, o registro e a última importação', async () => {
    const progresso = [];
    const r = await gravar({ onProgress: (feitas, total) => progresso.push([feitas, total]) });

    expect(r).toEqual({ ok: true, importacaoId: ID, gravadas: 9, total: 9, lote: null, lotes: 2, jaExistia: false, erro: null });
    expect(m.lotes.map(caminhos)).toEqual([
      [
        'stronix_config/faltosos',
        'stronix_nextfit_alunos/bia lima',
        'stronix_faltosos/L1', 'stronix_interactions/volta_L1_2026-09-25', 'stronix_presencas/L1_2026-10',
        'stronix_faltosos/L2',
        'stronix_presencas/L3_2026-09',
      ],
      [`stronix_importacoes_nextfit/${ID}`, 'stronix_config/faltosos'],
    ]);
    expect(progresso).toEqual([[7, 9], [9, 9]]);
    expect(m.banco.get(`${BASE}/stronix_config/faltosos`)).toEqual({
      professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }],
      ultimaImportacao: { ...ULTIMA, importadoEm: 'TS1', importadoPorNome: 'Johnny' },
    });
    expect(m.banco.get(`${BASE}/stronix_importacoes_nextfit/${ID}`)).toEqual({
      ...REGISTRO, importadoPor: 'g1', importadoPorNome: 'Johnny', importadoEm: 'TS1',
    });
  });

  it('a linha "Voltou a treinar" tem id fixo e nada vai para stronix_leads', async () => {
    await gravar();
    expect(m.banco.get(`${BASE}/stronix_interactions/volta_L1_2026-09-25`)).toMatchObject({
      leadId: 'L1', type: 'presence_return', text: 'Voltou a treinar em 03/10',
      consultantName: 'Johnny', actorAuthUid: 'uid-g1', leadConsultantAuthUid: 'uid-c1', createdAt: 'TS1',
    });
    expect([...m.banco.keys()].some((p) => p.includes('/stronix_leads/'))).toBe(false);
  });

  it('a volta desfeita apaga a linha no mesmo lote do estado do aluno', async () => {
    m.banco.set(`${BASE}/stronix_interactions/volta_L2_2026-09-20`, { type: 'presence_return', leadId: 'L2' });
    m.banco.set(`${BASE}/stronix_faltosos/L2`, ESTADO('L2', { status: 'voltou', ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20', voltouEntre: { de: '2026-09-21', ate: '2026-09-29' } }));
    const alvo = { estados: { L2: ESTADO('L2', { ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20' }) }, voltasDesfeitas: ['volta_L2_2026-09-20'] };

    const r = await gravar({ alvo });

    expect(r.ok).toBe(true);
    expect(caminhos(m.lotes[0])).toEqual(['stronix_faltosos/L2', 'apaga stronix_interactions/volta_L2_2026-09-20']);
    expect(m.banco.has(`${BASE}/stronix_interactions/volta_L2_2026-09-20`)).toBe(false);
    expect(m.banco.get(`${BASE}/stronix_faltosos/L2`).status).toBe('faltando');
  });

  it('roda o plano de novo com os estados lidos do servidor e grava o plano refeito', async () => {
    // Entre a prévia e o Confirmar, a tarefa de L2 foi marcada como feita (o
    // professor, no PR 3). O plano refeito leva isso; o da prévia, não.
    const feita = { marco: 14, urgente: false, status: 'feita', inicioFalta: '2026-09-20', criadaEm: '2026-09-29', importacaoId: 'f2026-09-29', feitaEm: 'ontem', feitaPor: 'p1', feitaPorNome: 'Ana Prof', canal: 'whatsapp', resultado: 'respondeu' };
    m.banco.set(`${BASE}/stronix_faltosos/L2`, ESTADO('L2', { ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20', tarefa: feita }));
    const replanejar = vi.fn((estadosAtuais) => planoPara({
      estados: { L2: { ...estadosAtuais.L2, diasNaImportacao: 16 } },
    }, estadosAtuais));

    await gravarImportacao({
      db: {}, tenant: 'acad', plano: planoPara({ estados: { L2: ESTADO('L2', { diasNaImportacao: 16 }) } }),
      replanejar, ultimaImportacaoLida: null, quem: QUEM,
    });

    expect(replanejar).toHaveBeenCalledTimes(1);
    expect(Object.keys(replanejar.mock.calls[0][0])).toEqual(['L2']);
    expect(m.banco.get(`${BASE}/stronix_faltosos/L2`)).toMatchObject({ diasNaImportacao: 16, tarefa: feita });
  });

  it('o registro guarda os números da prévia confirmada', async () => {
    const replanejar = (estadosAtuais) => ({ ...planoPara(ALVO, estadosAtuais), registro: { ...REGISTRO, numeros: { voltaram: 0 } } });
    await gravar({ replanejar });
    expect(m.banco.get(`${BASE}/stronix_importacoes_nextfit/${ID}`).numeros).toEqual({ voltaram: 1 });
  });

  it('lotes de até 500 gravações, com cada aluno inteiro num lote só', async () => {
    const estados = {};
    const presencasPorDoc = [];
    for (let i = 0; i < 600; i += 1) {
      const leadId = `L${String(i).padStart(3, '0')}`;
      estados[leadId] = ESTADO(leadId);
      presencasPorDoc.push({ id: `${leadId}_2026-10`, doc: { leadId, mes: '2026-10', dias: { '2026-10-01': DIA('07:00') } } });
    }
    const r = await gravar({ alvo: { estados, presencasPorDoc } });

    expect(r.ok).toBe(true);
    expect(m.lotes.map((l) => l.length)).toEqual([500, 500, 200, 2]);
    for (const lote of m.lotes.slice(0, 3)) {
      const alunos = new Set(lote.map((op) => op.path.split('/').pop().split('_')[0]));
      for (const leadId of alunos) {
        expect(lote.some((op) => op.path.endsWith(`/stronix_faltosos/${leadId}`)), leadId).toBe(true);
        expect(lote.some((op) => op.path.endsWith(`/stronix_presencas/${leadId}_2026-10`)), leadId).toBe(true);
      }
    }
  });

  it('refazer a mesma importação não duplica nada e mantém os números e a hora da primeira vez', async () => {
    await gravar();
    const depoisDaPrimeira = fotoDoBanco();
    m.lotes.length = 0;
    m.ts = 'TS2';

    const naoLigados = [{ nome: 'Fulano de Tal', telefone: '(51) 9 9999-0000', relatorio: 'faltantes' }];
    const plano = { ...planoPara(ALVO), registro: { ...REGISTRO, numeros: { voltaram: 0 }, naoLigados } };
    const r = await gravar({ plano, ultimaImportacaoLida: { id: ID } });

    expect(r).toMatchObject({ ok: true, jaExistia: true, lotes: 2 });
    // Do plano refeito, só sobram as presenças, o nome e a lista de
    // professores, que voltam com o mesmo conteúdo.
    expect(caminhos(m.lotes[0])).not.toContain('stronix_faltosos/L1');
    expect(caminhos(m.lotes[0])).not.toContain('stronix_interactions/volta_L1_2026-09-25');
    expect(caminhos(m.lotes[1])).toEqual([`stronix_importacoes_nextfit/${ID}`]);
    const registro = `${BASE}/stronix_importacoes_nextfit/${ID}`;
    const nome = `${BASE}/stronix_nextfit_alunos/bia lima`;
    expect(fotoDoBanco()).toEqual({
      ...depoisDaPrimeira,
      [nome]: { ...depoisDaPrimeira[nome], atualizadoEm: 'TS2' },
      [registro]: { ...depoisDaPrimeira[registro], naoLigados, refeitaEm: 'TS2', refeitaPorNome: 'Johnny' },
    });
    expect(m.banco.get(registro)).toMatchObject({ importadoEm: 'TS1', numeros: { voltaram: 1 } });
    expect(m.banco.get(`${BASE}/stronix_config/faltosos`).ultimaImportacao.importadoEm).toBe('TS1');
  });

  it('falha no meio: devolve até onde foi, sem registro; tentar de novo completa sem duplicar', async () => {
    const estados = {};
    for (let i = 0; i < 700; i += 1) estados[`L${String(i).padStart(3, '0')}`] = ESTADO(`L${String(i).padStart(3, '0')}`);
    const alvo = { estados };
    m.falharNoCommit = 2;

    const falhou = await gravar({ alvo });

    expect(falhou).toMatchObject({ ok: false, gravadas: 500, total: 702, lote: 2, lotes: 3, jaExistia: false });
    expect(falhou.erro.code).toBe('permission-denied');
    expect(m.banco.has(`${BASE}/stronix_importacoes_nextfit/${ID}`)).toBe(false);
    expect(m.banco.has(`${BASE}/stronix_config/faltosos`)).toBe(false);
    expect(m.banco.size).toBe(500);

    // Tentar de novo, com o mesmo plano: o plano refeito só manda os 200 que
    // faltaram, e o fecho.
    m.falharNoCommit = null;
    m.lotes.length = 0;
    const refeita = await gravar({ alvo });
    expect(refeita).toMatchObject({ ok: true, jaExistia: false, total: 202 });
    const completo = fotoDoBanco();

    m.banco.clear();
    m.lotes.length = 0;
    await gravar({ alvo });
    expect(completo).toEqual(fotoDoBanco());
    expect(m.banco.size).toBe(702);
  });

  it('outra importação gravada com a janela aberta: para sem gravar nada', async () => {
    m.banco.set(`${BASE}/stronix_config/faltosos`, { ultimaImportacao: { id: 'f2026-10-13' } });
    const r = await gravar({ ultimaImportacaoLida: { id: 'f2026-09-29' } });
    expect(r).toMatchObject({ ok: false, gravadas: 0, lote: null });
    expect(r.erro).toMatchObject({ code: 'outra-importacao' });
    expect(r.erro.message).toMatch(/Nada foi gravado/);
    expect(m.lotes).toEqual([]);
  });

  it('a mesma importação já no servidor, com a resposta perdida: segue', async () => {
    m.banco.set(`${BASE}/stronix_config/faltosos`, { ultimaImportacao: { id: ID } });
    const r = await gravar({ ultimaImportacaoLida: { id: 'f2026-09-29' } });
    expect(r.ok).toBe(true);
  });

  it('sem internet na leitura, para antes de gravar qualquer coisa', async () => {
    m.falharLeitura = true;
    const replanejar = vi.fn();
    const r = await gravar({ replanejar });
    expect(r).toMatchObject({ ok: false, gravadas: 0, total: 0, lote: null });
    expect(r.erro.code).toBe('unavailable');
    expect(replanejar).not.toHaveBeenCalled();
    expect(m.lotes).toEqual([]);
  });

  it('plano refeito com defeito lança erro e não grava nada', async () => {
    const replanejar = (estadosAtuais) => ({ ...planoPara(ALVO, estadosAtuais), estados: [] });
    await expect(gravar({ replanejar })).rejects.toThrow(/sem o estado dele/);
    expect(m.lotes).toEqual([]);
  });

  it('plano refeito de outra importação lança erro e não grava nada', async () => {
    const outro = { ...IMPORTACAO, id: 'f2026-10-13', dataFaltantes: '2026-10-13', periodoPresencas: null };
    const replanejar = (estadosAtuais) => ({ ...planoPara(ALVO, estadosAtuais), importacao: outro, config: { ultimaImportacao: { ...ULTIMA, id: 'f2026-10-13' } } });
    await expect(gravar({ replanejar })).rejects.toThrow(/outra importação/);
    expect(m.lotes).toEqual([]);
  });

  it('plano confirmado com recusa ou com professor novo sem ligação não começa', async () => {
    await expect(gravar({ plano: { ...planoPara(ALVO), recusa: { codigo: 'faltantes_antigo' } } })).rejects.toThrow(/recusa/);
    await expect(gravar({ plano: { ...planoPara(ALVO), prontoParaGravar: false } })).rejects.toThrow(/professor novo/);
    expect(m.lotes).toEqual([]);
  });

  it('sem academia, sem quem importa, sem replanejar ou sem a última importação lida, não começa', async () => {
    await expect(gravar({ tenant: '' })).rejects.toThrow(/academia/);
    await expect(gravar({ quem: null })).rejects.toThrow(/quem importa/);
    await expect(gravar({ replanejar: null })).rejects.toThrow(/replanejar/);
    await expect(gravar({ ultimaImportacaoLida: undefined })).rejects.toThrow(/última importação lida/);
  });

  it('grava na academia que recebe, e não na do appId vivo', async () => {
    await gravar();
    expect(m.lotes.flat().every((op) => op.path.startsWith('artifacts/acad/'))).toBe(true);
  });
});

describe('lerRegistroDaImportacao', () => {
  it('devolve o registro com o id, ou null', async () => {
    expect(await lerRegistroDaImportacao({ db: {}, tenant: 'acad', id: ID })).toBeNull();
    m.banco.set(`${BASE}/stronix_importacoes_nextfit/${ID}`, { importadoPorNome: 'Johnny' });
    expect(await lerRegistroDaImportacao({ db: {}, tenant: 'acad', id: ID })).toEqual({ id: ID, importadoPorNome: 'Johnny' });
  });
});

describe('os caminhos do dublê são os de verdade', () => {
  it('firebase.js tem os mesmos nomes e valores que o teste usa', () => {
    const fonte = readFileSync(fileURLToPath(new URL('../firebase.js', import.meta.url)), 'utf8');
    const esperado = {
      CONFIG_PATH: 'stronix_config',
      CONFIG_FALTOSOS_ID: 'faltosos',
      FALTOSOS_PATH: 'stronix_faltosos',
      PRESENCAS_PATH: 'stronix_presencas',
      IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit',
      NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
      INTERACTIONS_PATH: 'stronix_interactions',
    };
    for (const [nome, valor] of Object.entries(esperado)) {
      expect(fonte, nome).toContain(`export const ${nome} = '${valor}';`);
    }
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.gravarImportacao.test.js`

Expected: FAIL antes de rodar teste, `Error: Cannot find module '/src/lib/faltosos/gravarImportacao.js' imported from .../src/lib/__tests__/faltosos.gravarImportacao.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 8: Os caminhos em `src/lib/firebase.js`**

O `PRESENCAS_PATH` já existe, da aderência do perfil do professor, e só o comentário muda (D7). Os outros três caminhos e o `CONFIG_FALTOSOS_ID` entram junto. Em `src/lib/firebase.js`, trocar:

```js
// Presenças na aula de funcional, por aluno e semana (aderência, PR 6). Só o
// script de importação grava.
export const PRESENCAS_PATH = 'stronix_presencas';
```

por:

```js
// Módulo Professor e faltosos (src/lib/modules.js e a spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "Os
// dados"). As regras só deixam ler e gravar estas coleções com o módulo
// `faltosos` ligado: sem ele, a leitura vem com permission-denied, então
// quem lê confere o hasModule antes.
// Estado de cada aluno faltando. 1 doc por aluno, id = leadId.
export const FALTOSOS_PATH = 'stronix_faltosos';
// Presenças vindas do relatório Presenças da Next Fit, gravadas pela
// importação. 1 doc por aluno e mês, id = `${leadId}_${AAAA-MM}`. A aderência
// do perfil do professor soma os dias por semana (presencasPorSemana, em
// src/lib/professor/aderencia.js).
export const PRESENCAS_PATH = 'stronix_presencas';
// Registro de cada importação das planilhas da Next Fit, com id tirado das
// datas dos arquivos (idDaImportacao, em src/lib/faltosos/planoImportacao.js).
// Só o gestor lê.
export const IMPORTACOES_NEXTFIT_PATH = 'stronix_importacoes_nextfit';
// O nome com que cada aluno aparece na Next Fit, ligado ao lead. id = nomeChave
// (src/lib/faltosos/ligacaoAlunos.js). Só o gestor lê e grava.
export const NEXTFIT_ALUNOS_PATH = 'stronix_nextfit_alunos';
// Configuração do módulo, um doc dentro de CONFIG_PATH: marcos, janela do
// urgente, professores da Next Fit e a última importação. Todo membro lê.
export const CONFIG_FALTOSOS_ID = 'faltosos';
```

- [ ] **Step 9: Criar `src/lib/faltosos/gravarImportacao.js`**

```js
// Gravação da importação das planilhas da Next Fit no Firestore. O QUE gravar
// vem do plano (planoImportacao.js) e a forma de cada gravação, de
// lotesImportacao.js (puro); aqui fica o COMO: as leituras que a gravação
// precisa, os lotes e a ordem. Spec em
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A
// gravação".
//
// Roda no navegador do gestor, sem função na Vercel. As regras deixam o gestor
// gravar as coleções do módulo com o módulo ligado (firestore.rules), e a
// linha "Voltou a treinar" entra como qualquer interação de membro.
//
// Recebe a academia CONGELADA por quem chama (a janela guarda a academia na
// abertura) e nunca lê o appId vivo: se a sessão trocar de academia no meio
// ("Acessar como" em outra aba), as regras recusam o lote seguinte em vez de a
// importação continuar na academia nova. Molde do funnelSetupWrites.js.
//
// A ordem:
//   1. confere o plano confirmado na prévia (com recusa ou com professor novo
//      sem ligação, nem começa);
//   2. lê do servidor se o registro desta importação já existe, a última
//      importação gravada e o estado de todos os alunos. Sem internet, para
//      aqui sem gravar nada. Se outra importação entrou depois que a janela
//      abriu, também para, sem gravar nada;
//   3. roda o plano de novo com os estados lidos agora (replanejar), para não
//      sobrescrever o que mudou entre a prévia e o Confirmar, e grava esse
//      plano refeito. O registro guarda os números da prévia confirmada;
//   4. grava as ligações e os alunos em lotes de até 500, cada aluno inteiro
//      num lote só;
//   5. por último, num lote só, o registro da importação e a última importação
//      em stronix_config/faltosos.
// Falhou um lote: devolve até onde foi. Os alunos dos lotes anteriores ficam
// gravados por inteiro, e o registro não, então a próxima importação continua
// contando os marcos a partir do Faltantes anterior. Tentar de novo com o
// mesmo plano completa o que faltou, sem duplicar: os ids são fixos, e o plano
// refeito vê o que já entrou.

import { collection, doc, getDocFromServer, getDocsFromServer, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  CONFIG_PATH,
  CONFIG_FALTOSOS_ID,
  FALTOSOS_PATH,
  PRESENCAS_PATH,
  IMPORTACOES_NEXTFIT_PATH,
  NEXTFIT_ALUNOS_PATH,
  INTERACTIONS_PATH,
} from '../firebase.js';
import {
  ERRO_OUTRA_IMPORTACAO,
  MENSAGEM_OUTRA_IMPORTACAO,
  conferirPlano,
  empacotarEmLotes,
  erroDaGravacao,
  montarGravacoes,
  outraImportacaoEntrou,
} from './lotesImportacao.js';

const CAMINHOS = {
  faltosos: FALTOSOS_PATH,
  presencas: PRESENCAS_PATH,
  alunos: NEXTFIT_ALUNOS_PATH,
  importacoes: IMPORTACOES_NEXTFIT_PATH,
  interacoes: INTERACTIONS_PATH,
};

const docDa = (db, tenant, path, id) => doc(db, 'artifacts', tenant, 'public', 'data', path, id);

// 'config' é sempre o doc único stronix_config/faltosos.
const refDa = (db, tenant, op) => (op.colecao === 'config'
  ? docDa(db, tenant, CONFIG_PATH, CONFIG_FALTOSOS_ID)
  : docDa(db, tenant, CAMINHOS[op.colecao], op.id));

// O registro desta importação, ou null. Do servidor, porque é ele que diz se
// a importação já foi gravada. A tela pode usar antes do Confirmar, para
// avisar que a importação já foi feita.
export async function lerRegistroDaImportacao({ db, tenant, id }) {
  const snap = await getDocFromServer(docDa(db, tenant, IMPORTACOES_NEXTFIT_PATH, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function lerUltimaImportacao({ db, tenant }) {
  const snap = await getDocFromServer(docDa(db, tenant, CONFIG_PATH, CONFIG_FALTOSOS_ID));
  return snap.exists() ? (snap.data()?.ultimaImportacao ?? null) : null;
}

// Todos os estados, de qualquer status: o plano precisa do estado de quem está
// no arquivo e de todo aluno faltando.
async function lerEstadosAtuais({ db, tenant }) {
  const snap = await getDocsFromServer(collection(db, 'artifacts', tenant, 'public', 'data', FALTOSOS_PATH));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}

const gravarLote = async (db, tenant, ops) => {
  const batch = writeBatch(db);
  for (const op of ops) {
    const ref = refDa(db, tenant, op);
    if (op.apagar) batch.delete(ref);
    else if (op.merge) batch.set(ref, op.dados, { merge: true });
    else batch.set(ref, op.dados);
  }
  await batch.commit();
};

// Grava a importação confirmada na prévia.
//
// Recebe:
// - db e tenant: o Firestore e a academia congelada na abertura da janela;
// - plano: o plano que a prévia mostrou e o gestor confirmou;
// - replanejar(estadosAtuais): roda o mesmo plano de novo, com os mesmos
//   arquivos, ligações e configuração da prévia, trocando só os estados pelos
//   lidos do servidor ({ [leadId]: doc }). Devolve o plano novo;
// - ultimaImportacaoLida: a stronix_config/faltosos.ultimaImportacao que a
//   janela leu na abertura, ou null na primeira importação;
// - quem: { uid, id, nome } de quem importa;
// - onProgress(gravadas, total): roda depois de cada lote.
//
// Devolve { ok, importacaoId, gravadas, total, lote, lotes, jaExistia, erro }:
// - ok: tudo gravado, inclusive o fecho;
// - lote: o lote que falhou (1 a `lotes`, contando o do fecho), ou null;
// - jaExistia: o registro desta importação já estava gravado. Os alunos são
//   gravados de novo, e do registro só mudam os não ligados e a hora em que
//   foi refeita;
// - erro: o erro do Firestore, ou o de código ERRO_OUTRA_IMPORTACAO, ou null.
// Plano com defeito lança erro antes de gravar qualquer coisa.
export async function gravarImportacao({
  db, tenant, plano, replanejar, ultimaImportacaoLida, quem, onProgress = null,
}) {
  if (!tenant) throw new Error('importação sem a academia');
  if (!quem?.uid) throw new Error('importação sem quem importa');
  if (typeof replanejar !== 'function') throw new Error('importação sem o replanejar');
  if (ultimaImportacaoLida === undefined) throw new Error('importação sem a última importação lida na abertura');
  const importacaoId = conferirPlano(plano);
  const falhou = (erro, extra = {}) => ({
    ok: false, importacaoId, gravadas: 0, total: 0, lote: null, lotes: 0, jaExistia: null, erro, ...extra,
  });

  let jaExistia;
  let ultimaNoServidor;
  let estadosAtuais;
  try {
    jaExistia = Boolean(await lerRegistroDaImportacao({ db, tenant, id: importacaoId }));
    ultimaNoServidor = await lerUltimaImportacao({ db, tenant });
    estadosAtuais = await lerEstadosAtuais({ db, tenant });
  } catch (erro) {
    return falhou(erro);
  }
  if (outraImportacaoEntrou({ noServidor: ultimaNoServidor, lida: ultimaImportacaoLida, importacaoId })) {
    return falhou(erroDaGravacao(ERRO_OUTRA_IMPORTACAO, MENSAGEM_OUTRA_IMPORTACAO), { jaExistia });
  }

  const refeito = await replanejar(estadosAtuais);
  if (conferirPlano(refeito) !== importacaoId) throw new Error('o plano refeito antes de gravar é de outra importação');
  const { unidades, fecho } = montarGravacoes({
    plano: refeito, registro: plano.registro, quem, registroJaExiste: jaExistia, carimbo: serverTimestamp(),
  });
  const lotes = [...empacotarEmLotes(unidades), fecho];
  const total = lotes.reduce((n, l) => n + l.length, 0);

  let gravadas = 0;
  for (let i = 0; i < lotes.length; i += 1) {
    try {
      await gravarLote(db, tenant, lotes[i]);
    } catch (erro) {
      return { ok: false, importacaoId, gravadas, total, lote: i + 1, lotes: lotes.length, jaExistia, erro };
    }
    gravadas += lotes[i].length;
    if (onProgress) onProgress(gravadas, total);
  }
  return { ok: true, importacaoId, gravadas, total, lote: null, lotes: lotes.length, jaExistia, erro: null };
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.gravarImportacao.test.js`

Expected: PASS, `Tests  18 passed (18)`.

Run: `npx eslint src/lib/firebase.js src/lib/faltosos/gravarImportacao.js src/lib/__tests__/faltosos.gravarImportacao.test.js`

Expected: nenhuma saída.

- [ ] **Step 11: Os testes da pasta, a suíte inteira e o lint**

Run: `npx vitest run src/lib/__tests__/faltosos.`

Expected: todos passando, os do motor (Tasks 1 a 4) e os dois arquivos novos.

Run: `npm test`

Expected: nenhuma falha.

Run: `npm run lint`

Expected: nenhum problema novo em relação à linha de base da Task 0.

- [ ] **Step 12: Commit**

```bash
git add src/lib/leads.js src/lib/firebase.js src/lib/faltosos/lotesImportacao.js src/lib/faltosos/gravarImportacao.js src/lib/__tests__/faltosos.lotesImportacao.test.js src/lib/__tests__/faltosos.gravarImportacao.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: gravação da importação da Next Fit em lotes, com ids fixos e o registro por último" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Linha "Voltou a treinar" na linha do tempo (`src/lib/leads.js`, `src/lib/timeline.js`, `src/lib/crm/contact.js`)

Aplica a D5. A linha que a Task 5 grava (`type: 'presence_return'`) vira o tipo `presence` da linha do tempo, com o rótulo "Presença", no filtro Marcos e visível com o interruptor de Sistema desligado, no molde do marco do Stronizap (`origin`). Ela não é contato com a pessoa: fica fora do "Já interagido hoje" (`hasActiveInteractionToday`, que a Meta Diária usa no `hasOtherActivityToday`, em `src/lib/dailyGoal.js:248`) e do primeiro contato do Dashboard CRM (`isContactInteraction`). Sem `volumeKind`, ela não conta no volume de ninguém (`src/lib/dailyGoal.js:104-118` e `prospectionSummary`, em `src/lib/operacional/routine.js`), e a Task 5 já garante que ela não soma `interactionsCount` nem toca o lead.

A ficha não muda. `src/views/LeadProfileView.jsx:982` desenha com componente próprio só o `origin`, e a `presence` sai pela linha simples (`:1162`): "PRESENÇA" na coluna de tipo, o texto gravado no corpo ("Voltou a treinar em 08/10") e quem importou no autor. Sem ícone e sem cor, pela regra da ficha (cor só em chip de fase, selo de aula e faixa de marco). A ficha lê a linha do tempo por `leadId` e `createdAt` desc (`src/hooks/useLeadTimeline.js:27`), com o índice que já existe.

**Files:**
- Modify: `src/lib/leads.js:275` (`hasActiveInteractionToday`, na linha 269 de `e8423e2`; a Task 5 pôs 6 linhas antes dele, então procure pelo trecho)
- Modify: `src/lib/timeline.js:7` (import), `:199` (`classifyInteraction`), `:239` (`TIMELINE_FILTERS`), `:261` (`timelineTypeLabel`)
- Modify: `src/lib/crm/contact.js:5` (import) e `:14-21` (`isContactInteraction`)
- Test: `src/lib/__tests__/leads.test.js:17` (import) e bloco novo no fim, depois da linha 633
- Test: `src/lib/__tests__/timeline.test.js` (bloco novo no fim, depois da linha 727)
- Test: `src/lib/__tests__/crm.contact.test.js` (bloco novo no fim, depois da linha 96)

- [ ] **Step 1: Escrever os testes**

Em `src/lib/__tests__/leads.test.js`, no import do topo, trocar:

```js
  ZAP_SIGNUP_TYPE,
  ZAP_SIGNAL_TYPE,
```

por:

```js
  ZAP_SIGNUP_TYPE,
  PRESENCE_RETURN_TYPE,
  ZAP_SIGNAL_TYPE,
```

E acrescentar no fim do arquivo:

```js

describe('volta a treinar da importação da Next Fit (type presence_return)', () => {
  const VOLTA = { leadId: 'l1', type: 'presence_return', text: 'Voltou a treinar em 03/10', createdAt: TODAY_10H };

  it('o tipo tem nome fixo: é o que fica gravado na interação', () => {
    expect(PRESENCE_RETURN_TYPE).toBe('presence_return');
  });

  it('não acende o "Já interagido hoje": a planilha não é contato com a pessoa', () => {
    expect(hasActiveInteractionToday({ id: 'l1' }, [VOLTA], TODAY_START)).toBe(false);
    // Um contato de verdade no mesmo dia continua contando.
    const nota = { leadId: 'l1', type: 'note', text: 'Ligou', createdAt: TODAY_10H };
    expect(hasActiveInteractionToday({ id: 'l1' }, [VOLTA, nota], TODAY_START)).toBe(true);
  });

  it('não é registro do cadastro', () => {
    expect(isRegistrationInteraction(VOLTA)).toBe(false);
  });
});
```

Em `src/lib/__tests__/timeline.test.js`, acrescentar no fim do arquivo (`classifyInteraction`, `matchesTimelineFilter`, `timelineTypeLabel` e `TIMELINE_FILTERS` já estão no import):

```js

describe('volta a treinar (type presence_return)', () => {
  // Gravada pela importação das planilhas da Next Fit
  // (src/lib/faltosos/lotesImportacao.js).
  const VOLTA = {
    type: 'presence_return',
    text: 'Voltou a treinar entre 26/09 e 06/10',
    consultantName: 'Johnny',
    createdAt: new Date(2026, 9, 6, 9, 12)
  };

  it('tem bucket próprio, decidido pelo type', () => {
    expect(classifyInteraction(VOLTA)).toBe('presence');
    // Nem um texto que lembra conversa ou contrato leva a linha para outro bucket.
    expect(classifyInteraction({ ...VOLTA, text: '📲 Mensagem WhatsApp enviada: voltou' })).toBe('presence');
    expect(classifyInteraction({ ...VOLTA, text: 'Voltou a treinar em 03/10, matrícula ativa' })).toBe('presence');
  });

  it('entra em Marcos e em Tudo, e não é sistema: aparece com o interruptor desligado', () => {
    expect(TIMELINE_FILTERS.find((f) => f.id === 'milestone').kinds).toContain('presence');
    expect(matchesTimelineFilter('presence', 'milestone')).toBe(true);
    expect(matchesTimelineFilter('presence', 'all')).toBe(true);
    expect(matchesTimelineFilter('presence', 'conversation')).toBe(false);
    expect(matchesTimelineFilter('presence', 'note')).toBe(false);
    expect(classifyInteraction(VOLTA)).not.toBe('system');
  });

  it("rótulo da coluna: 'Presença'", () => {
    expect(timelineTypeLabel({ ...VOLTA, _kind: 'presence' })).toBe('Presença');
  });
});
```

Em `src/lib/__tests__/crm.contact.test.js`, acrescentar no fim do arquivo:

```js

describe('volta a treinar da importação da Next Fit', () => {
  const VOLTA = { id: 'v1', leadId: 'a', type: 'presence_return', text: 'Voltou a treinar em 03/10', createdAt: T(3, 9) };

  it('não conta como contato', () => {
    expect(isContactInteraction(VOLTA)).toBe(false);
  });

  it('não vira o primeiro contato do lead', () => {
    expect(contactTimesByLead([VOLTA]).has('a')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leads.test.js src/lib/__tests__/timeline.test.js src/lib/__tests__/crm.contact.test.js`

Expected: FAIL, `Test Files  3 failed (3)` e `Tests  6 failed | 221 passed (227)`.

- **Falham:** em `crm.contact.test.js`, "não conta como contato" e "não vira o primeiro contato do lead"; em `leads.test.js`, "não acende o Já interagido hoje"; em `timeline.test.js`, os três do bloco novo (a linha cai em `system`).
- **Passam:** em `leads.test.js`, "o tipo tem nome fixo" (a constante veio na Task 5) e "não é registro do cadastro".

- [ ] **Step 3: `hasActiveInteractionToday` em `src/lib/leads.js`**

Trocar:

```js
    if (i.type === 'referral') return false;
    if (isRegistrationInteraction(i)) return false;
```

por:

```js
    if (i.type === 'referral') return false;
    // A volta a treinar vem da planilha da Next Fit, e ninguém falou com o
    // aluno: sem esta exclusão, a importação acenderia o "Já interagido hoje"
    // do cliente na Meta da renovação e dos vencidos.
    if (i.type === PRESENCE_RETURN_TYPE) return false;
    if (isRegistrationInteraction(i)) return false;
```

- [ ] **Step 4: Tipo, filtro e rótulo em `src/lib/timeline.js`**

Quatro trocas.

Linha 7, trocar:

```js
import { ZAP_SIGNUP_TYPE, ZAP_SIGNAL_TYPE, ZAP_VIA, isAiInteraction, isZapSignalInteraction } from './leads.js';
```

por:

```js
import { PRESENCE_RETURN_TYPE, ZAP_SIGNUP_TYPE, ZAP_SIGNAL_TYPE, ZAP_VIA, isAiInteraction, isZapSignalInteraction } from './leads.js';
```

Linha 199, em `classifyInteraction`, trocar:

```js
  if (i.type === ZAP_SIGNUP_TYPE) return 'origin';
```

por:

```js
  if (i.type === ZAP_SIGNUP_TYPE) return 'origin';
  // "Voltou a treinar", gravada pela importação das planilhas da Next Fit
  // (src/lib/faltosos/lotesImportacao.js): marco da presença do aluno,
  // decidido pelo type, e fora do 'origin', que a ficha desenha como o marco
  // de início. Entra em Marcos e aparece com o interruptor de Sistema
  // desligado.
  if (i.type === PRESENCE_RETURN_TYPE) return 'presence';
```

Linha 239, em `TIMELINE_FILTERS`, trocar:

```js
  { id: 'milestone',    label: 'Marcos',       kinds: ['status', 'contract', 'referral', 'origin'] }
```

por:

```js
  { id: 'milestone',    label: 'Marcos',       kinds: ['status', 'contract', 'referral', 'origin', 'presence'] }
```

Linha 261, em `timelineTypeLabel`, trocar:

```js
    case 'origin': return 'Início';
```

por:

```js
    case 'origin': return 'Início';
    case 'presence': return 'Presença';
```

- [ ] **Step 5: Fora do primeiro contato em `src/lib/crm/contact.js`**

Linha 5, trocar:

```js
import { isRegistrationNote, isZapSignalInteraction, ZAP_SIGNUP_TYPE } from '../leads.js';
```

por:

```js
import { isRegistrationNote, isZapSignalInteraction, PRESENCE_RETURN_TYPE, ZAP_SIGNUP_TYPE } from '../leads.js';
```

Linhas 14 a 21, trocar:

```js
// Não contam como contato: a observação do cadastro, o marco do cadastro pelo
// Stronizap, a linha de sinal da conversa (o lead escreveu, a equipe enviou), a
// indicação, a importação e a troca de responsável. Qualquer
// outra interação registrada conta, inclusive a de quem já saiu da equipe,
// porque o contato aconteceu.
export const isContactInteraction = (i) => Boolean(i)
  && i.type !== 'referral'
  && i.type !== 'import'
  && i.type !== ZAP_SIGNUP_TYPE
```

por:

```js
// Não contam como contato: a observação do cadastro, o marco do cadastro pelo
// Stronizap, a linha de sinal da conversa (o lead escreveu, a equipe enviou), a
// indicação, a importação, a volta a treinar que a importação da Next Fit grava
// e a troca de responsável. Qualquer outra interação registrada conta,
// inclusive a de quem já saiu da equipe, porque o contato aconteceu.
export const isContactInteraction = (i) => Boolean(i)
  && i.type !== 'referral'
  && i.type !== 'import'
  && i.type !== ZAP_SIGNUP_TYPE
  && i.type !== PRESENCE_RETURN_TYPE
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leads.test.js src/lib/__tests__/timeline.test.js src/lib/__tests__/crm.contact.test.js`

Expected: PASS, `Test Files  3 passed (3)` e `Tests  227 passed (227)`.

Run: `npx eslint src/lib/leads.js src/lib/timeline.js src/lib/crm/contact.js src/lib/__tests__/leads.test.js src/lib/__tests__/timeline.test.js src/lib/__tests__/crm.contact.test.js`

Expected: nenhuma saída.

- [ ] **Step 7: Suíte inteira**

Run: `npm test`

Expected: nenhuma falha. A contagem de filtros da ficha (`LeadProfileView.jsx:795`) sai de `TIMELINE_FILTERS`, então o "Marcos" passa a contar a linha nova sem mudança na tela.

- [ ] **Step 8: Commit**

```bash
git add src/lib/leads.js src/lib/timeline.js src/lib/crm/contact.js src/lib/__tests__/leads.test.js src/lib/__tests__/timeline.test.js src/lib/__tests__/crm.contact.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: linha Voltou a treinar na linha do tempo, fora do contato e do Já interagido hoje" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Regras do Firestore das coleções novas (`firestore.rules`, `src/lib/__tests__/faltososRules.test.js`)

Aplica a D6: quatro blocos novos logo depois do de `stronix_aulas`, com uma linha `allow` para cada operação, nenhum `allow write` e nenhuma exclusão liberada. A linha `allow delete: if false;` fica escrita, como em `stronix_aulas`, `stronix_contratos` e `stronix_daily_goal_history`. `stronix_config` e `stronix_interactions` não mudam.

| Coleção | Lê | Cria e altera | Apaga |
|---|---|---|---|
| `stronix_faltosos` | membro, com o módulo | gestor, com o módulo | ninguém |
| `stronix_presencas` | membro, com o módulo | gestor, com o módulo | ninguém |
| `stronix_importacoes_nextfit` | gestor, com o módulo | gestor, com o módulo | ninguém |
| `stronix_nextfit_alunos` | gestor, com o módulo | gestor, com o módulo | ninguém |
| `stronix_config/faltosos` (regra de hoje) | membro | gestor | gestor |
| `stronix_interactions`, linha `presence_return` (regra de hoje) | membro | membro cria, e o professor só cria `note`; o gestor altera | gestor |

O professor lê `stronix_faltosos`, `stronix_presencas` e `stronix_config/faltosos` e não grava nada no PR 2. A condição da tarefa dele entra no PR 3, na linha de update de `stronix_faltosos`. Ele também não cria `presence_return`, porque `professorInteractionTypes()` é `['note']` (`firestore.rules:180-184`).

**Dependências:**
- **Task 5:** `PRESENCE_RETURN_TYPE` em `src/lib/leads.js`.
- **PR 1:** `PROFESSOR_INTERACTION_TYPES` em `src/lib/professorWrites.js` e a função `hasModule` das regras.

**Files:**
- Create: `src/lib/__tests__/faltososRules.test.js`
- Modify: `firestore.rules:461` (os blocos novos entram logo depois do fecho do bloco de `stronix_aulas`, antes do comentário das rotinas que começa na linha 463)

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/__tests__/faltososRules.test.js`:

```js
// As regras das coleções do módulo Professor e faltosos (PR 2 da spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// regras do Firestore"). O Johnny publica o firestore.rules à mão no console,
// e este teste lê o texto da regra e cobra:
//   1. stronix_faltosos e stronix_presencas: todo membro lê, com o módulo
//      ligado; só o gestor grava, com o módulo ligado; ninguém apaga;
//   2. stronix_importacoes_nextfit e stronix_nextfit_alunos: só o gestor lê e
//      grava, com o módulo ligado; ninguém apaga;
//   3. stronix_config continua como era: todo membro lê (o professor acha ali
//      a última importação, em stronix_config/faltosos) e só o gestor grava;
//   4. a linha "Voltou a treinar" (presence_return): o gestor cria, regrava e
//      apaga como qualquer interação, e o professor não cria, porque o tipo não
//      está na lista dele.
// Os leitores do texto são os do professorRules.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROFESSOR_INTERACTION_TYPES } from '../professorWrites.js';
import { PRESENCE_RETURN_TYPE } from '../leads.js';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

// A lista que uma função da regra devolve: `function nome() { return [ ... ]; }`.
function listaDaRegra(nome) {
  const m = new RegExp(`function ${nome}\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\];\\s*\\}`).exec(RULES);
  expect(m, `function ${nome}() no firestore.rules`).not.toBeNull();
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// O bloco `match` de uma coleção da academia, até a chave que o fecha.
function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// Uma linha `allow` do bloco (com as linhas de continuação), até a próxima
// `allow` ou o fim do bloco. `allow create, update:` serve aos dois.
function regraDe(bloco, op) {
  const m = new RegExp(`allow [\\w, ]*\\b${op}\\b[\\w, ]*:([\\s\\S]*?)(?=\\n\\s*allow |$)`).exec(bloco);
  expect(m, `allow ${op}`).not.toBeNull();
  return m[1];
}

// Os termos do E de cima de uma condição, sem os comentários. Um `||` fora de
// parênteses quer dizer que não há E de cima, e a lista volta vazia.
function termosDoE(condicao) {
  const expr = condicao.replace(/\/\/.*$/gm, '').trim().replace(/^if\s+/, '').replace(/;\s*$/, '');
  const termos = [];
  let nivel = 0;
  let inicio = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '(' || c === '[') nivel += 1;
    else if (c === ')' || c === ']') nivel -= 1;
    else if (nivel === 0 && expr.startsWith('||', i)) return [];
    else if (nivel === 0 && expr.startsWith('&&', i)) {
      termos.push(expr.slice(inicio, i).trim());
      inicio = i + 2;
      i += 1;
    }
  }
  termos.push(expr.slice(inicio).trim());
  return termos;
}

const MODULO = "hasModule(appId, 'faltosos')";
const DE_TODOS = ['stronix_faltosos', 'stronix_presencas'];
const DO_GESTOR = ['stronix_importacoes_nextfit', 'stronix_nextfit_alunos'];

describe.each([...DE_TODOS, ...DO_GESTOR])('%s', (colecao) => {
  // As regras juntam os allow com OU: uma segunda linha de update, ou um
  // allow write, valeria por cima da trava. O PR 3 põe a tarefa do professor
  // como condição na linha de update de stronix_faltosos, nunca numa linha nova.
  it('uma linha allow por operação e nenhum allow write', () => {
    const bloco = blocoDe(colecao).replace(/\/\/.*$/gm, '');
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(bloco.match(new RegExp(`allow [\\w, ]*\\b${op}\\b`, 'g')), `${colecao}: ${op}`).toHaveLength(1);
    }
    expect(bloco).not.toMatch(/allow [\w, ]*\bwrite\b/);
  });

  it('gravar é só do gestor, na academia ativa e com o módulo ligado, no E de cima', () => {
    for (const op of ['create', 'update']) {
      expect(termosDoE(regraDe(blocoDe(colecao), op)), `${colecao}: ${op}`)
        .toEqual(['inTenant(appId)', 'tenantActive(appId)', MODULO, 'isAdmin(appId)']);
    }
  });

  it('o navegador não apaga', () => {
    expect(regraDe(blocoDe(colecao), 'delete').trim()).toBe('if false;');
  });
});

describe.each(DE_TODOS)('%s: leitura', (colecao) => {
  it('todo membro lê, na academia ativa e com o módulo ligado', () => {
    expect(termosDoE(regraDe(blocoDe(colecao), 'read')))
      .toEqual(['inTenant(appId)', 'tenantActive(appId)', MODULO]);
  });
});

describe.each(DO_GESTOR)('%s: leitura', (colecao) => {
  it('só o gestor lê, na academia ativa e com o módulo ligado', () => {
    expect(termosDoE(regraDe(blocoDe(colecao), 'read')))
      .toEqual(['inTenant(appId)', 'tenantActive(appId)', MODULO, 'isAdmin(appId)']);
  });
});

describe('stronix_config, onde mora stronix_config/faltosos', () => {
  it('todo membro lê e só o gestor grava, como antes do módulo', () => {
    const config = blocoDe('stronix_config');
    expect(regraDe(config, 'read').trim()).toBe('if inTenant(appId) && tenantActive(appId);');
    expect(termosDoE(regraDe(config, 'write'))).toEqual(['isAdmin(appId)', 'inTenant(appId)', 'tenantActive(appId)']);
  });
});

describe('a linha "Voltou a treinar" (presence_return)', () => {
  it('o professor não cria a linha: o tipo fica fora da lista dele, na regra e no professorWrites', () => {
    expect(PRESENCE_RETURN_TYPE).toBe('presence_return');
    expect(listaDaRegra('professorInteractionTypes')).not.toContain(PRESENCE_RETURN_TYPE);
    expect(PROFESSOR_INTERACTION_TYPES).not.toContain(PRESENCE_RETURN_TYPE);
  });

  it('o gestor cria como qualquer membro: a criação de interação só trava o professor', () => {
    const interacoes = blocoDe('stronix_interactions');
    expect(termosDoE(regraDe(interacoes, 'create')))
      .toEqual(['inTenant(appId)', 'tenantActive(appId)', '(!isProfessor(appId) || professorInteractionOk(appId))']);
  });

  // A importação refeita regrava a linha no mesmo id (update), e a volta que
  // não aconteceu tem a linha apagada (delete). As duas são do gestor.
  it('o gestor regrava e apaga a linha', () => {
    const interacoes = blocoDe('stronix_interactions');
    for (const op of ['update', 'delete']) {
      const termos = termosDoE(regraDe(interacoes, op));
      expect(termos, op).toContain('(isAdmin(appId) || resource.data.consultantAuthUid == request.auth.uid)');
      expect(termos, op).toContain('!isProfessor(appId)');
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltososRules.test.js`

Expected: FAIL, `Tests  15 failed | 5 passed (20)`.

- **Falham** os 12 testes das três coleções novas, com `AssertionError: stronix_faltosos: expected -1 to be greater than -1` (e o mesmo para `stronix_importacoes_nextfit` e `stronix_nextfit_alunos`), porque o bloco ainda não existe, e os 3 de gravação de `stronix_presencas` (uma linha por operação, gravar só do gestor e não apaga), porque o bloco de hoje tem `allow write: if false` e nenhuma linha de create, update e delete.
- **Passam** a leitura de `stronix_presencas`, o de `stronix_config` e os três da linha `presence_return`, que cobram regras que já existem.

- [ ] **Step 3: Os blocos novos no `firestore.rules`**

Três trocas no `firestore.rules`.

1. Os três blocos novos entram logo depois do fecho do bloco de `stronix_aulas`, antes do comentário do freepass. Em `firestore.rules`, trocar:

```
      allow update: if inTenant(appId) && tenantActive(appId)
        && request.resource.data.consultantAuthUid == resource.data.consultantAuthUid;
      allow delete: if false;
    }

    // Freepass das aulas experimentais (spec
```

por:

```
      allow update: if inTenant(appId) && tenantActive(appId)
        && request.resource.data.consultantAuthUid == resource.data.consultantAuthUid;
      allow delete: if false;
    }

    // Módulo Professor e faltosos, PR 2 (spec
    // docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
    // regras do Firestore"). As três coleções abaixo, e a de presenças, mais embaixo, só existem com o
    // módulo ligado: sem ele, ninguém lê nem grava, e o que já foi gravado
    // fica onde está até o módulo voltar. Quem grava é o gestor, pela
    // importação das planilhas da Next Fit, que roda no navegador
    // (src/lib/faltosos/gravarImportacao.js) em lotes de até 500 gravações.
    // Em cada gravação as regras leem sempre os mesmos dois documentos (o da
    // academia e o cadastro do gestor), e o Firestore não conta de novo a
    // leitura repetida do mesmo documento no mesmo pedido: é assim que a
    // importação de clientes já grava em lotes de 450. Ninguém apaga pelo
    // navegador.
    //
    // A configuração do módulo mora em stronix_config/faltosos e segue a
    // regra de stronix_config, acima: todo membro lê (o professor acha ali a
    // última importação) e só o gestor grava. A linha "Voltou a treinar"
    // (presence_return) é uma interação e segue o bloco de
    // stronix_interactions: o gestor cria, regrava e apaga a linha da volta
    // que não aconteceu, e o professor não cria, porque o tipo não está em
    // professorInteractionTypes().
    //
    // Estado de cada aluno faltando (stronix_faltosos/{leadId}). Todo membro
    // lê: a aba Faltosos e o selo da ficha leem daqui. No PR 2 só o gestor
    // grava. O professor marcar a tarefa como feita entra no PR 3, como uma
    // condição a mais na linha de update, nunca numa segunda linha allow,
    // porque as regras juntam as linhas com OU.
    match /artifacts/{appId}/public/data/stronix_faltosos/{leadId} {
      allow read: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos');
      allow create: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow update: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow delete: if false;
    }

    // Registro de cada importação (stronix_importacoes_nextfit/{id}, com o id
    // tirado das datas dos arquivos). Só o gestor lê e grava, porque o
    // registro traz o nome e o telefone dos alunos que a importação não achou.
    match /artifacts/{appId}/public/data/stronix_importacoes_nextfit/{id} {
      allow read: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow create, update: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow delete: if false;
    }

    // O nome com que cada aluno aparece na Next Fit, ligado ao lead
    // (stronix_nextfit_alunos/{nomeChave}). A importação guarda o nome para
    // ligar o Presenças, que não traz telefone. Só o gestor lê e grava.
    match /artifacts/{appId}/public/data/stronix_nextfit_alunos/{nomeChave} {
      allow read: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow create, update: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow delete: if false;
    }
    // Freepass das aulas experimentais (spec
```

2. O bloco de `stronix_presencas` deixa de ser só do script (D7). Em `firestore.rules`, trocar:

```
    // Presenças na aula de funcional, por aluno e semana, para a aderência do
    // perfil do professor (PR 6). Quem é da academia lê, com o módulo. Só o
    // script scripts/import-presencas.js grava, pelo Admin SDK.
    match /artifacts/{appId}/public/data/stronix_presencas/{id} {
      allow read: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos');
      allow write: if false;
    }
```

por:

```
    // Presenças da Next Fit, um documento por aluno e mês
    // (stronix_presencas/{leadId}_{AAAA-MM}), gravadas pela importação das
    // planilhas (src/lib/faltosos/gravarImportacao.js, Professor e faltosos,
    // PR 2A). Quem é da academia lê, com o módulo: a aderência do perfil do
    // professor soma os dias por semana (presencasPorSemana), e a aba
    // Presenças da ficha (2C) lê os dias. Só o gestor grava. Ninguém apaga
    // pelo navegador.
    match /artifacts/{appId}/public/data/stronix_presencas/{id} {
      allow read: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos');
      allow create, update: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && isAdmin(appId);
      allow delete: if false;
    }
```

3. O teste da regra de presenças sai do `npsRules.test.js`, porque o `faltososRules.test.js` passa a cobrar o bloco inteiro. Em `src/lib/__tests__/npsRules.test.js`, trocar:

```js
  it('presenças: quem é da academia lê com o módulo, ninguém grava pelo navegador', () => {
    const presencas = blocoDe('stronix_presencas');
    expect(allow(presencas, 'read')).toContain("hasModule(appId, 'faltosos')");
    expect(allow(presencas, 'read')).not.toContain('isAdmin');
    expect(allow(presencas, 'write')).toBe('if false');
  });
});
```

por:

```js
});
```

Os comentários não citam a chamada da função de módulo com outra coisa que não seja `'faltosos'` entre aspas, nem os nomes que o `professorRules.test.js` barra (`professorAllowed`, `professorRoleAllowed`, `professorCreateAllowed` e `'professor']`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltososRules.test.js src/lib/__tests__/professorRules.test.js src/lib/__tests__/modules.test.js`

Expected: PASS, `Test Files  3 passed (3)` e `Tests  73 passed (73)`: 20 do teste novo, 37 do `professorRules.test.js` e 16 do `modules.test.js`. O bloco "firestore.rules: as chamadas da hasModule" do `modules.test.js` passa a conferir 20 chamadas, as 12 que já existiam e as 8 novas, todas com `'faltosos'`.

Run: `npx eslint src/lib/__tests__/faltososRules.test.js`

Expected: nenhuma saída.

- [ ] **Step 5: Suíte inteira e lint**

Run: `npm test`

Expected: nenhuma falha.

Run: `npm run lint`

Expected: nenhum problema novo em relação à linha de base da Task 0.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules src/lib/__tests__/faltososRules.test.js src/lib/__tests__/npsRules.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: regras do Firestore das coleções dos faltosos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Validação e publicação das regras, à mão, pelo Johnny, antes do merge do PR 2A**

Ninguém validou estas regras num validador do Firebase. Em 05/10/2026, o MCP do Firebase estava sem projeto ativo e a máquina não tinha o emulador, e este plano não conferiu de novo. A primeira validação de verdade é o editor do console, e ela vem antes de publicar e antes do merge. Se o Johnny autorizar mudar a configuração local do MCP para o projeto de produção, dá para conferir antes, só a sintaxe e sem publicar, com `firebase_validate_security_rules` (`type: firestore`, `source_file: firestore.rules`).

Etapa A, antes de publicar:

1. No console do Firebase, Firestore, Regras, abrir as regras publicadas e comparar com `git show e8423e2:firestore.rules`. Se forem diferentes, parar e juntar a diferença no arquivo do PR antes de seguir.
2. Colar o `firestore.rules` do PR no editor, sem publicar. O editor aponta erro de sintaxe na hora.
3. No Rules Playground, usar a academia de teste com o módulo "Professor e faltosos" ligado, com a claim `tenantId` da academia no payload do token e o uid de verdade de cada pessoa: o gestor G, o consultor C e o professor P criado no teste do PR 1. O `get()` e o `exists()` do Playground leem os documentos de verdade, e `L1` pode ser um id inventado.

| Quem | Operação | Esperado |
|---|---|---|
| Gestor G | create e update em `stronix_faltosos/L1` | Permitido (a importação grava o estado) |
| Gestor G | create em `stronix_presencas/L1_2026-10` | Permitido |
| Gestor G | create e get em `stronix_importacoes_nextfit/f2026-10-06` | Permitido |
| Gestor G | create e get em `stronix_nextfit_alunos/ana souza` | Permitido |
| Gestor G | create em `stronix_interactions/volta_L1_2026-09-25`, com `type: 'presence_return'`, `leadId: 'L1'` e o `actorAuthUid` dele | Permitido |
| Gestor G | delete em `stronix_interactions/volta_L1_2026-09-25` | Permitido (a volta que não aconteceu) |
| Gestor G | update em `stronix_config/faltosos` | Permitido |
| Gestor G | delete em `stronix_faltosos/L1`, `stronix_presencas/L1_2026-10`, `stronix_importacoes_nextfit/f2026-10-06` e `stronix_nextfit_alunos/ana souza` | Negado |
| Professor P | get em `stronix_faltosos/L1`, `stronix_presencas/L1_2026-10` e `stronix_config/faltosos` | Permitido (a aba Faltosos e a aba Presenças) |
| Professor P | create e update em `stronix_faltosos/L1` | Negado (no PR 2 o professor não grava) |
| Professor P | create em `stronix_presencas/L1_2026-10` | Negado |
| Professor P | get em `stronix_importacoes_nextfit/f2026-10-06` e em `stronix_nextfit_alunos/ana souza` | Negado |
| Professor P | create em `stronix_interactions` com `type: 'presence_return'` e o `actorAuthUid` dele | Negado |
| Professor P | update em `stronix_config/faltosos` | Negado |
| Consultor C | get em `stronix_faltosos/L1`, `stronix_presencas/L1_2026-10` e `stronix_config/faltosos` | Permitido (o selo e a aba Presenças da ficha são de todos) |
| Consultor C | get em `stronix_importacoes_nextfit/f2026-10-06` e em `stronix_nextfit_alunos/ana souza` | Negado |
| Consultor C | create e update em `stronix_faltosos/L1`, e create em `stronix_presencas/L1_2026-10` | Negado |

4. Desligar "Professor e faltosos" da academia de teste no super console e repetir:

| Quem | Operação | Esperado |
|---|---|---|
| Gestor G | get, create e update em `stronix_faltosos/L1` | Negado |
| Gestor G | get e create em `stronix_importacoes_nextfit/f2026-10-06` | Negado |
| Professor P e Consultor C | get em `stronix_faltosos/L1` e em `stronix_presencas/L1_2026-10` | Negado |
| Gestor G | update em `stronix_config/faltosos` | Permitido (a configuração não tem trava de módulo, como o resto de `stronix_config`) |

Religar o módulo.

5. Publicar. Os blocos novos só abrem as coleções novas, e nada em produção grava nelas ainda, então publicar antes do merge não muda nada para quem já usa o sistema.

Etapa B, no Preview do PR 2A, depois de publicar (o Preview usa o Firebase de produção, então só a academia de teste):

6. Seguir o teste no Preview da Task 14 (Step 4). A importação da semana 1 de lá grava mais de 40 documentos no primeiro lote (43 ou 44, conforme os meses que o Presenças cruza), mais de 20, e é isso que confere o limite de leituras das regras por pedido. O mesmo roteiro confere a importação refeita, a linha "Voltou a treinar" e o módulo desligado.
7. Só então fazer o merge do PR 2A.

---

### Task 7A: A aderência lê as presenças da importação (`src/lib/professor/aderencia.js`, `src/hooks/useProfessoresDados.js`)

Aplica a D7. Até aqui a aderência do perfil do professor lia `stronix_presencas/{leadId}_{segunda}`, um documento por aluno e semana gravado pelo `scripts/import-presencas.js` a partir do relatório "Presenças por contrato" da Next Fit (só as aulas de funcional). Com o 2A, a mesma coleção passa a guardar um documento por aluno e mês, `stronix_presencas/{leadId}_{AAAA-MM}`, com os dias do relatório Presenças (catraca e agenda, todas as modalidades), gravado pela importação da tela. Esta task faz a aderência ler esse formato e tira o script e o leitor dele.

O `aderenciaPorSemana` não muda. Ele continua recebendo `[{ leadId, semana, presencas }]`, e quem monta essa lista passa a ser o `presencasPorSemana`, a partir dos documentos por mês: cada dia de segunda a sexta com presença conta uma vez, pela catraca ou pela agenda, em qualquer modalidade. Sábado e domingo ficam fora, como antes. A semana que atravessa o fim do mês junta os dois documentos.

O hook lê os meses de novembro do ano anterior a dezembro do ciclo, um a mais de cada lado, e corta as semanas de 1º de dezembro do ano anterior a 30 de novembro, a mesma janela de antes. Sem o mês a mais, a semana que começa em 30/11 teria só a segunda-feira. Os documentos semanais que o script gravou em novembro de 2026 não têm o campo `mes` e ficam fora da consulta, então não se misturam com os novos. Eles ficam no banco até alguém apagar, e nada lê mais esses documentos.

O que muda para quem usa: a aderência passa a contar a ida à academia, e não só a presença marcada na aula de funcional. Os professores de musculação e de pilates, que hoje aparecem com "sem dados", passam a ter número assim que a primeira importação gravar as presenças. Os números de novembro mudam na primeira importação, e por isso o roteiro da Task 14 pede o primeiro Presenças desde 02/11/2026.

**Dependências:**
- **Task 4:** o formato do documento de presença (`presencasPorDoc: [{ id, doc: { leadId, mes, dias } }]`).
- **Task 7:** a regra de `stronix_presencas` com gravação pelo gestor.

**Files:**
- Modify: `src/lib/professor/aderencia.js` (comentário do topo, import e o `presencasPorSemana` novo)
- Modify: `src/hooks/useProfessoresDados.js` (a leitura das presenças)
- Modify: `src/lib/__tests__/professorContasImports.test.js` (a lista de arquivos da pasta)
- Delete: `scripts/import-presencas.js`, `src/lib/professor/presencas.js`, `src/lib/__tests__/professor.presencas.test.js`
- Test: `src/lib/__tests__/professor.aderencia.test.js` (bloco novo no fim)

- [ ] **Step 1: Escrever o teste**

Em `src/lib/__tests__/professor.aderencia.test.js`, trocar:

```js
import { aderenciaDoAno, aderenciaDoSemestre, aderenciaPorSemana, aderenciaResumo } from '../professor/aderencia.js';
```

por:

```js
import { aderenciaDoAno, aderenciaDoSemestre, aderenciaPorSemana, aderenciaResumo, presencasPorSemana } from '../professor/aderencia.js';
```

E acrescentar no fim do arquivo:

```js

describe('presencasPorSemana (os documentos por mês da importação da Next Fit)', () => {
  const dia = (hora = '07:00', origens = ['catraca']) => ({ hora, origens, modalidades: [] });
  const ordenar = (lista) => [...lista].sort((a, b) => `${a.leadId}_${a.semana}`.localeCompare(`${b.leadId}_${b.semana}`));

  it('cada dia de segunda a sexta conta uma vez, pela catraca ou pela agenda', () => {
    const docs = [{ leadId: 'l1', mes: '2027-01', dias: {
      '2027-01-11': dia(), '2027-01-12': dia('18:00', ['agenda']), '2027-01-13': dia('07:00', ['catraca', 'agenda']),
      '2027-01-18': dia(),
    } }];
    expect(ordenar(presencasPorSemana(docs))).toEqual([
      { leadId: 'l1', semana: '2027-01-11', presencas: 3 },
      { leadId: 'l1', semana: '2027-01-18', presencas: 1 },
    ]);
  });

  it('sábado e domingo não contam, e a semana só com eles não aparece', () => {
    const docs = [{ leadId: 'l1', mes: '2027-01', dias: { '2027-01-16': dia(), '2027-01-17': dia(), '2027-01-22': dia() } }];
    expect(presencasPorSemana(docs)).toEqual([{ leadId: 'l1', semana: '2027-01-18', presencas: 1 }]);
  });

  it('a semana que atravessa o fim do mês junta os dois documentos', () => {
    const docs = [
      { leadId: 'l1', mes: '2026-11', dias: { '2026-11-30': dia() } },
      { leadId: 'l1', mes: '2026-12', dias: { '2026-12-01': dia(), '2026-12-03': dia() } },
    ];
    expect(presencasPorSemana(docs)).toEqual([{ leadId: 'l1', semana: '2026-11-30', presencas: 3 }]);
  });

  it('cada aluno tem a sua linha, e documento sem lead ou sem dias é ignorado', () => {
    const docs = [
      { leadId: 'l1', mes: '2027-01', dias: { '2027-01-11': dia() } },
      { leadId: 'l2', mes: '2027-01', dias: { '2027-01-11': dia(), '2027-01-14': dia() } },
      { mes: '2027-01', dias: { '2027-01-11': dia() } },
      { leadId: 'l3', mes: '2027-01' },
      null,
    ];
    expect(ordenar(presencasPorSemana(docs))).toEqual([
      { leadId: 'l1', semana: '2027-01-11', presencas: 1 },
      { leadId: 'l2', semana: '2027-01-11', presencas: 2 },
    ]);
  });

  it('a saída é a entrada do aderenciaPorSemana', () => {
    const docs = [{ leadId: 'l1', mes: '2027-01', dias: { '2027-01-18': dia(), '2027-01-19': dia() } }];
    const contratos = normalizeContracts([contrato('l1')]);
    const [linha] = aderenciaPorSemana({
      presencas: presencasPorSemana(docs), leads: [{ id: 'l1', professorId: 'p1' }], contratos, planos: PLANOS,
      professor: PROF, asOf: new Date('2027-02-01T12:00:00'),
    });
    expect(linha).toMatchObject({ semana: '2027-01-18', contam: 1, aderentes: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js`

Expected: FAIL, os cinco testes do bloco novo com `TypeError: presencasPorSemana is not a function`, e os de antes passando.

- [ ] **Step 3: O `presencasPorSemana` em `src/lib/professor/aderencia.js`**

Em `src/lib/professor/aderencia.js`, trocar:

```js
// Aderência da carteira: por aluno-semana, de segunda a sexta, pelas
// presenças na aula de funcional importadas da Next Fit
// (stronix_presencas/{leadId}_{segunda}: { leadId, semana: 'AAAA-MM-DD',
// presencas }). A semana é aderente com presenças iguais ou acima da barra (2).
```

por:

```js
// Aderência da carteira: por aluno-semana, de segunda a sexta, pelos dias com
// presença que a importação das planilhas da Next Fit grava
// (stronix_presencas/{leadId}_{AAAA-MM}: { leadId, mes, dias }, Professor e
// faltosos, PR 2A). O presencasPorSemana soma os dias de cada semana e entrega
// ao aderenciaPorSemana [{ leadId, semana: 'AAAA-MM-DD', presencas }]. A
// semana é aderente com presenças iguais ou acima da barra (2).
```

Ainda em `src/lib/professor/aderencia.js`, trocar:

```js
import { fromDateInputValue } from '../dates.js';
```

por:

```js
import { fromDateInputValue, toDateInputValue } from '../dates.js';
```

E trocar:

```js
export const BARRA_PADRAO = 2;
```

por:

```js
export const BARRA_PADRAO = 2;

// As presenças por aluno e semana, a partir dos documentos por mês da
// importação. Cada dia de segunda a sexta com presença conta uma vez, pela
// catraca ou pela agenda, em qualquer modalidade. Sábado e domingo não contam.
// A semana é a segunda-feira ('AAAA-MM-DD'), e a que atravessa o fim do mês
// junta os dois documentos.
export function presencasPorSemana(docs) {
  const porChave = new Map();
  (docs || []).forEach((d) => {
    if (!d?.leadId || !d.dias) return;
    Object.keys(d.dias).forEach((iso) => {
      const data = fromDateInputValue(iso);
      if (!data || data.getDay() === 0 || data.getDay() === 6) return;
      const semana = toDateInputValue(new Date(data.getFullYear(), data.getMonth(), data.getDate() - ((data.getDay() + 6) % 7)));
      const chave = `${d.leadId}_${semana}`;
      const linha = porChave.get(chave) || { leadId: d.leadId, semana, presencas: 0 };
      linha.presencas += 1;
      porChave.set(chave, linha);
    });
  });
  return [...porChave.values()];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js`

Expected: PASS, nenhuma falha.

- [ ] **Step 5: A leitura em `src/hooks/useProfessoresDados.js`**

Em `src/hooks/useProfessoresDados.js`, trocar:

```js
import { limitesDoCiclo } from '../lib/professor/ciclo.js';
```

por:

```js
import { presencasPorSemana } from '../lib/professor/aderencia.js';
import { limitesDoCiclo } from '../lib/professor/ciclo.js';
```

E trocar:

```js
  // As presenças do ciclo (aderência, PR 6): uma leitura só, pela segunda-feira
  // da semana ('AAAA-MM-DD'), de 1º de dezembro do ano anterior a 30 de
  // novembro, num campo só e sem índice novo. As semanas de janeiro a novembro
  // contam; as de dezembro, que abrem o ciclo, só aparecem na aba.
  const [presencas, setPresencas] = useState(null); // { ciclo, lista, erro }
  useEffect(() => {
    if (!ler) return undefined;
    let vivo = true;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', PRESENCAS_PATH),
      where('semana', '>=', `${ciclo - 1}-12-01`),
      where('semana', '<=', `${ciclo}-11-30`),
    );
    getDocs(q)
      .then((snap) => { if (vivo) setPresencas({ ciclo, lista: snap.docs.map((d) => d.data()), erro: null }); })
```

por:

```js
  // As presenças do ciclo (aderência, PR 6): uma leitura só dos documentos por
  // mês da importação da Next Fit, pelo campo `mes` ('AAAA-MM'), sem índice
  // novo. Lê de novembro do ano anterior a dezembro do ciclo, um mês a mais de
  // cada lado, para a semana que atravessa o mês vir inteira, e fica com as
  // semanas de 1º de dezembro do ano anterior a 30 de novembro. As semanas de
  // janeiro a novembro contam; as de dezembro, que abrem o ciclo, só aparecem
  // na aba. Os documentos semanais do script antigo não têm `mes` e ficam fora.
  const [presencas, setPresencas] = useState(null); // { ciclo, lista, erro }
  useEffect(() => {
    if (!ler) return undefined;
    let vivo = true;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', PRESENCAS_PATH),
      where('mes', '>=', `${ciclo - 1}-11`),
      where('mes', '<=', `${ciclo}-12`),
    );
    const naJanela = (p) => p.semana >= `${ciclo - 1}-12-01` && p.semana <= `${ciclo}-11-30`;
    getDocs(q)
      .then((snap) => {
        if (vivo) setPresencas({ ciclo, lista: presencasPorSemana(snap.docs.map((d) => d.data())).filter(naJanela), erro: null });
      })
```

- [ ] **Step 6: Tirar o script e o leitor do relatório antigo**

Run: `git rm -q scripts/import-presencas.js src/lib/professor/presencas.js src/lib/__tests__/professor.presencas.test.js && git status --short`

Expected: as três linhas `D ` dos arquivos apagados e as linhas ` M` de `src/lib/professor/aderencia.js`, `src/hooks/useProfessoresDados.js` e `src/lib/__tests__/professor.aderencia.test.js`.

Em `src/lib/__tests__/professorContasImports.test.js`, trocar:

```js
    expect(ARQUIVOS).toEqual(['aderencia.js', 'carteira.js', 'ciclo.js', 'conversao.js', 'metas.js', 'nps.js', 'pesquisas.js', 'presencas.js', 'renovacao.js']);
```

por:

```js
    expect(ARQUIVOS).toEqual(['aderencia.js', 'carteira.js', 'ciclo.js', 'conversao.js', 'metas.js', 'nps.js', 'pesquisas.js', 'renovacao.js']);
```

Run: `grep -rn "import-presencas\|professor/presencas" src api scripts`

Expected: nenhuma saída. O `CLAUDE.md` ainda cita o script, e a Task 12 troca esse trecho.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professor.aderencia.test.js src/lib/__tests__/professorContasImports.test.js src/lib/__tests__/professorPerfil.behavior.test.js src/lib/__tests__/professoresView.behavior.test.js`

Expected: PASS, nenhuma falha. As duas telas recebem as presenças pelo hook falso, já no formato por semana, então não mudam.

Run: `npx eslint src/lib/professor/aderencia.js src/hooks/useProfessoresDados.js src/lib/__tests__/professor.aderencia.test.js src/lib/__tests__/professorContasImports.test.js`

Expected: nenhuma saída.

- [ ] **Step 8: Suíte inteira**

Run: `npm test`

Expected: nenhuma falha.

- [ ] **Step 9: Commit**

```bash
git add src/lib/professor/aderencia.js src/hooks/useProfessoresDados.js src/lib/__tests__/professor.aderencia.test.js src/lib/__tests__/professorContasImports.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: a aderência do professor lê as presenças da importação da Next Fit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

O `git rm` do Step 6 já pôs os três arquivos apagados no commit.

---

### Task 8: Configuração dos faltosos no App (`src/contexts/GeneralConfigContext.jsx`, `src/App.jsx`)

> Esta task depende das Tasks 3 e 5:
> - Task 3: `src/lib/faltosos/configFaltosos.js`, com `CONFIG_FALTOSOS_PADRAO`, `normalizarConfigFaltosos` e `configDasTelas` (`ultimaImportacao` é `null` quando não houve importação, e `importadoEm` sai como `Date`).
> - Task 5: `CONFIG_FALTOSOS_ID` em `src/lib/firebase.js` (decisão D2).
>
> É a parte da Task 8 do plano antigo que o 2A usa: a assinatura de `stronix_config/faltosos` e o `faltosos` do contexto. O endereço `/clientes/faltosos`, o filtro `prof`, o `canSeeFaltosos` e as props novas do `ClientsView` ficam para o 2B, e o comentário do `sub` do `App.jsx` não muda aqui.

**Files:**
- Modify: `src/contexts/GeneralConfigContext.jsx:4-11`
- Modify: `src/App.jsx:49-50` (import do `firebase.js`), `:72` (import do `modules.js`), `:361-367` (estado e `generalConfigValue`), `:875-878` (assinatura na leitura de dados), `:909-910` (cleanup)
- Create: `src/lib/__tests__/faltososApp.test.js`

Notas:
- A assinatura de `stronix_config/faltosos` (decisão T4) entra no mesmo efeito de leitura de dados do `stronix_config/general`, só com o módulo ligado, e cai junto com o resto no portão de atividade e no "Acessar como". A academia vai junto com o que foi lido, no molde do `setupFlags`. A falha não acende o aviso "Falha ao carregar alguns dados": a configuração fica no padrão, com `erro: true`, e o bloco Faltosos de Configurações diz que não deu para ler (decisão A4).
- O efeito de leitura de dados já para logo depois da trava do professor com o módulo desligado (`if (professorAccessOff(appUser)) { setLoadingData(false); return; }`, linha 706), e a assinatura nova entra depois dela. O `professorShell.test.js` confere que a trava continua a primeira instrução depois da trava da academia bloqueada.

- [ ] **Step 1: Escrever o teste da configuração no App**

Criar `src/lib/__tests__/faltososApp.test.js`:

```js
// A configuração dos faltosos chega às telas pelo App (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações" e "A aba Faltosos"). O App.jsx não monta em teste, então
// esta varredura lê o código dele, no molde do professorShell.test.js: a
// assinatura de stronix_config/faltosos só com o módulo, a academia junto do
// que foi lido e o `faltosos` no contexto. O padrão do contexto, fora do
// Provider, é renderizado de verdade.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';

const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = semComentarios(readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8'));

describe('configuração dos faltosos no App', () => {
  it('importa o caminho, o módulo e a leitura da configuração', () => {
    const doFirebase = app.slice(app.indexOf('import {\n  auth,'), app.indexOf("} from './lib/firebase.js';"));
    expect(doFirebase).toContain('CONFIG_FALTOSOS_ID');
    expect(app).toContain("import { normalizeModules, hasModule, MODULES } from './lib/modules.js';");
    expect(app).toContain("import { CONFIG_FALTOSOS_PADRAO, normalizarConfigFaltosos } from './lib/faltosos/configFaltosos.js';");
  });

  it('assina stronix_config/faltosos só com o módulo, dentro da leitura de dados, e desliga junto com o resto', () => {
    const efeito = app.indexOf('if (professorAccessOff(appUser)) { setLoadingData(false); return; }');
    const guarda = app.indexOf('if (hasModule(appUser.tenantModules, MODULES.FALTOSOS)) {', efeito);
    const fim = app.indexOf('}, [firebaseUser, appUser, tenantBlock, listenersActive]);', efeito);
    expect(efeito).toBeGreaterThan(-1);
    expect(guarda).toBeGreaterThan(efeito);
    expect(fim).toBeGreaterThan(guarda);
    const bloco = app.slice(guarda, app.indexOf('let unsubUsers', guarda));
    expect(bloco).toContain("doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID)");
    expect(bloco).toContain('setFaltososLido({ tenant: configTenant, config: normalizarConfigFaltosos(snap.exists() ? snap.data() : null), erro: false })');
    expect(bloco).toContain('setFaltososLido({ tenant: configTenant, config: CONFIG_FALTOSOS_PADRAO, erro: true })');
    expect(app.slice(guarda, fim)).toContain('unsubFaltosos();');
  });

  it('a configuração só vale para a academia de onde veio, e vai no contexto', () => {
    expect(app).toContain('faltososLido.tenant !== null && faltososLido.tenant === faltososTenant');
    expect(app).toMatch(/const generalConfigValue = useMemo\(\s*\(\) => \(\{[^}]*\bfaltosos \}\),\s*\[[^\]]*\bfaltosos\]/);
  });
});

describe('GeneralConfigContext fora do Provider', () => {
  it('faltosos é null, e as telas caem no padrão pelo configDasTelas', () => {
    function Sonda() {
      const { faltosos } = useGeneralConfig();
      return createElement('output', null, faltosos === null ? 'faltosos:null' : 'faltosos:outro');
    }
    expect(renderToString(createElement(Sonda))).toContain('faltosos:null');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltososApp.test.js`
Expected: FAIL, `Test Files  1 failed (1)` e `Tests  4 failed (4)`: `expected 'import {\n  auth,…' to contain 'CONFIG_FALTOSOS_ID'`, `expected -1 to be greater than …` (a guarda do módulo ainda não existe), `expected 'import React, { useCallback, useEffec…' to contain 'faltososLido.tenant !== null && falto…'` e, no último, o `faltosos` do contexto vem `undefined` e a sonda escreve `faltosos:outro`.

- [ ] **Step 3: O padrão do contexto (`src/contexts/GeneralConfigContext.jsx`)**

Em `src/contexts/GeneralConfigContext.jsx`, trocar as linhas 4-11:

```jsx
// Config geral (modalidades + nº máx de aulas experimentais) exposta via
// Context para evitar threading por todos os componentes que renderizam o
// LeadDetailsModal / RescheduleModal. Funciona através de portais (createPortal
// mantém a posição na árvore React).
const GeneralConfigContext = createContext({ modalities: [], trialClassOptions: [1, 2, 3], freepassTypes: [], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [], dores: [] });
function useGeneralConfig() {
  return useContext(GeneralConfigContext) || { modalities: [], trialClassOptions: [1, 2, 3], freepassTypes: [], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [], dores: [] };
}
```

por:

```jsx
// Config geral (modalidades + nº máx de aulas experimentais) exposta via
// Context para evitar threading por todos os componentes que renderizam o
// LeadDetailsModal / RescheduleModal. Funciona através de portais (createPortal
// mantém a posição na árvore React).
// `faltosos` é a configuração de stronix_config/faltosos, que o App assina só
// com o módulo ligado. Fora do Provider ela é null, e as telas usam o
// configDasTelas (src/lib/faltosos/configFaltosos.js), que cai no padrão.
const GeneralConfigContext = createContext({ modalities: [], trialClassOptions: [1, 2, 3], freepassTypes: [], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [], dores: [], faltosos: null });
function useGeneralConfig() {
  return useContext(GeneralConfigContext) || { modalities: [], trialClassOptions: [1, 2, 3], freepassTypes: [], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [], dores: [], faltosos: null };
}
```

- [ ] **Step 4: A assinatura e o contexto no `src/App.jsx`**

1. Import do `firebase.js`. Em `src/App.jsx`, trocar as linhas 49-50:

```js
  CONFIG_GENERAL_ID,
  DAILY_GOAL_HISTORY_PATH
} from './lib/firebase.js';
```

por:

```js
  CONFIG_GENERAL_ID,
  CONFIG_FALTOSOS_ID,
  DAILY_GOAL_HISTORY_PATH
} from './lib/firebase.js';
```

2. Em `src/App.jsx`, trocar a linha 73:

```js
import { normalizeModules } from './lib/modules.js';
```

por:

```js
import { normalizeModules, hasModule, MODULES } from './lib/modules.js';
import { CONFIG_FALTOSOS_PADRAO, normalizarConfigFaltosos } from './lib/faltosos/configFaltosos.js';
```

3. Estado e contexto. Em `src/App.jsx`, trocar as linhas 379-385:

```js
  const [renewalGraceDays, setRenewalGraceDays] = useState(15);
  // Valor do GeneralConfigContext (declarado aqui, antes de qualquer early return,
  // para respeitar as regras dos hooks).
  const generalConfigValue = useMemo(
    () => ({ modalities, trialClassOptions, freepassTypes, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, renewalCheckpoints, renewalGraceDays, professores, dores }),
    [modalities, trialClassOptions, freepassTypes, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, renewalCheckpoints, renewalGraceDays, professores, dores]
  );
```

por:

```js
  const [renewalGraceDays, setRenewalGraceDays] = useState(15);
  // Configuração dos faltosos (stronix_config/faltosos), com a academia de
  // onde ela veio. Só é assinada com o módulo ligado. A academia vai junto
  // pelo mesmo motivo das marcas de configuração (setupFlags): o "Acessar
  // como" troca de academia sem recarregar, e a configuração da anterior não
  // pode valer na nova. Antes da primeira leitura vale o padrão, com
  // `pronta: false`. Leitura que falhou fica com o padrão e `erro: true`.
  const [faltososLido, setFaltososLido] = useState({ tenant: null, config: CONFIG_FALTOSOS_PADRAO, erro: false });
  const faltososTenant = appUser?.tenantId || null;
  const faltosos = useMemo(() => (
    faltososLido.tenant !== null && faltososLido.tenant === faltososTenant
      ? { ...faltososLido.config, pronta: true, erro: faltososLido.erro }
      : { ...CONFIG_FALTOSOS_PADRAO, pronta: false, erro: false }
  ), [faltososLido, faltososTenant]);
  // Valor do GeneralConfigContext (declarado aqui, antes de qualquer early return,
  // para respeitar as regras dos hooks).
  const generalConfigValue = useMemo(
    () => ({ modalities, trialClassOptions, freepassTypes, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, renewalCheckpoints, renewalGraceDays, professores, dores, faltosos }),
    [modalities, trialClassOptions, freepassTypes, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, renewalCheckpoints, renewalGraceDays, professores, dores, faltosos]
  );
```

4. Assinatura. No efeito de leitura de dados, logo depois do fim da assinatura de `stronix_config/general` e antes de `let unsubUsers = () => {};` (linhas 897-900), em `src/App.jsx`, trocar:

```js
    () => { setTrialClassOptions([1, 2, 3]); setFreepassTypes([]); setMetaWeekdays([1, 2, 3, 4, 5]); setSlaOverdueDays(3); setDailyVolumeTarget(0); setContractThresholdDays(30); setRenewalCheckpoints([90, 60, 30]); }
  );

  let unsubUsers = () => {};
```

por:

```js
    () => { setTrialClassOptions([1, 2, 3]); setFreepassTypes([]); setMetaWeekdays([1, 2, 3, 4, 5]); setSlaOverdueDays(3); setDailyVolumeTarget(0); setContractThresholdDays(30); setRenewalCheckpoints([90, 60, 30]); }
  );

  // Configuração dos faltosos: marcos, janela do urgente, professores da Next
  // Fit e a última importação. Só com o módulo ligado, porque sem ele nenhuma
  // tela a lê. Doc único e ao vivo: a importação e o bloco de Metas & ritmo
  // aparecem sem F5. Falha aqui não acende o aviso de carga: fica o padrão,
  // marcado com `erro`, e o bloco Faltosos de Configurações diz que não deu
  // para ler.
  let unsubFaltosos = () => {};
  if (hasModule(appUser.tenantModules, MODULES.FALTOSOS)) {
    unsubFaltosos = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID),
      (snap) => setFaltososLido({ tenant: configTenant, config: normalizarConfigFaltosos(snap.exists() ? snap.data() : null), erro: false }),
      (err) => {
        console.error('onSnapshot faltosos falhou', err);
        setFaltososLido({ tenant: configTenant, config: CONFIG_FALTOSOS_PADRAO, erro: true });
      }
    );
  }

  let unsubUsers = () => {};
```

5. Cleanup. Em `src/App.jsx`, trocar as linhas 931-932:

```js
    unsubConfig();
    unsubUsers();
```

por:

```js
    unsubConfig();
    unsubFaltosos();
    unsubUsers();
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltososApp.test.js src/lib/__tests__/professorShell.test.js`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  15 passed (15)` (4 e 11). O `professorShell.test.js` confere que a guarda do professor com o módulo desligado continua a primeira instrução depois da trava da academia bloqueada.

Run: `npx vitest run 2>&1 | tail -5`
Expected: todos passando, `Test Files  378 passed (378)` e `Tests  7259 passed (7259)`.

Run: `npx eslint src/App.jsx src/contexts/GeneralConfigContext.jsx src/lib/__tests__/faltososApp.test.js`
Expected: nenhuma saída.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/contexts/GeneralConfigContext.jsx src/lib/__tests__/faltososApp.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: configuração dos faltosos assinada no App e entregue pelo contexto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Textos da importação e quem importa (`src/lib/faltosos/abaFaltosos.js`)

> Esta task depende das Tasks 1 e 3: `dias.js` (`ddmm`, `ddmmaaaa`, `diaEmBrasilia`, `somarDias`) e `normalizarMarcos` (`marcos.js`).

São três funções da Task 9 do plano antigo, com os mesmos nomes e os mesmos testes (decisão A3): `importaFaltosos`, `resumoDaUltimaImportacao` e `lembreteExportacao`. O bloco de Configurações (Task 11) usa as três, e a janela (Task 10) usa o lembrete. O 2B acrescenta no mesmo arquivo os grupos, o andamento e o filtro da aba.

**Files:**
- Create: `src/lib/faltosos/abaFaltosos.js`
- Test: `src/lib/__tests__/faltosos.abaFaltosos.test.js` (novo)

Notas:
- `importaFaltosos` é o módulo mais o `isGestor`: só o gestor importa, e só com o módulo ligado. O bloco Faltosos aparece pela mesma regra.
- O dia e a hora da última importação são os de Brasília (`diaEmBrasilia` e `horaDeBrasilia`, de `api/_horarioDeBrasilia.js:54`), e o `importadoEm` aceita `Date` ou o Timestamp do Firestore, pelo `getSafeDateOrNull`.
- O lembrete do Presenças conta do dia seguinte ao último dia já importado (`ultimoDiaPresencas`, decisão M3) até hoje, e diz "já está importado até hoje" quando esse dia seguinte é depois de hoje.

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/__tests__/faltosos.abaFaltosos.test.js`:

```js
// Os textos da última importação e do lembrete de exportação, e quem importa
// (src/lib/faltosos/abaFaltosos.js). Puro, em node; o bloco de Configurações
// tem o teste dele em faltososPanel.test.js.
import { describe, it, expect } from 'vitest';
import { importaFaltosos, lembreteExportacao, resumoDaUltimaImportacao } from '../faltosos/abaFaltosos.js';
import { MODULES } from '../modules.js';

const COM = [MODULES.FALTOSOS];
const gestor = { id: 'g1', role: 'admin', tenantModules: COM };
const consultor = { id: 'c1', role: 'consultant', tenantModules: COM };
const professor = { id: 'u6', role: 'professor', professorId: 'p-rafa', tenantModules: COM };
const MARCOS = [7, 14, 30, 60];
const HOJE = '2026-10-06';
// Id da importação de 06/10 com o Presenças da semana (decisão D2 do plano).
const IMP = 'f2026-10-06_p2026-09-29_2026-10-05';

describe('quem importa', () => {
  it('só o gestor importa, e só com o módulo', () => {
    expect(importaFaltosos(gestor)).toBe(true);
    expect(importaFaltosos(professor)).toBe(false);
    expect(importaFaltosos(consultor)).toBe(false);
    expect(importaFaltosos({ ...gestor, tenantModules: [] })).toBe(false);
    expect(importaFaltosos(null)).toBe(false);
  });
});

describe('textos da importação', () => {
  it('a última importação com dia e hora de Brasília, quem fez e as datas dos arquivos', () => {
    expect(resumoDaUltimaImportacao(null)).toBeNull();
    expect(resumoDaUltimaImportacao({ dataFaltantes: '2026-10-06' })).toBeNull();
    expect(resumoDaUltimaImportacao({
      id: IMP, dataFaltantes: '2026-10-06', periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' },
      importadoEm: new Date('2026-10-06T12:12:00Z'), importadoPorNome: 'Johnny',
    })).toEqual({
      quando: '06/10 às 09:12, por Johnny',
      faltantes: 'Faltantes de 06/10/2026',
      presencas: 'Presenças de 29/09 a 05/10',
    });
    // O carimbo do Firestore (Timestamp) também vale.
    expect(resumoDaUltimaImportacao({ id: IMP, importadoEm: { toDate: () => new Date('2026-10-06T23:30:00Z') } }).quando)
      .toBe('06/10 às 20:30');
    expect(resumoDaUltimaImportacao({ id: 'p2026-10-01_2026-10-06', dataFaltantes: null, periodoPresencas: null, importadoEm: null, importadoPorNome: '' }))
      .toEqual({ quando: 'Data não registrada', faltantes: 'Nenhum Faltantes importado', presencas: 'Nenhum Presenças importado' });
  });

  it('como exportar: o Faltantes com o menor marco e o Presenças do dia seguinte ao último até hoje', () => {
    const ultima = { id: IMP, periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' } };
    expect(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: ultima, hojeDia: HOJE })).toEqual({
      faltantes: 'Faltantes: exporte com o filtro de 7 dias sem vir.',
      presencas: 'Presenças: exporte de 06/10 até hoje.',
    });
    expect(lembreteExportacao({ marcos: [10, 20], ultimaImportacao: { periodoPresencas: { de: '2026-10-01', ate: HOJE } }, hojeDia: HOJE }))
      .toEqual({ faltantes: 'Faltantes: exporte com o filtro de 10 dias sem vir.', presencas: 'Presenças: já está importado até hoje.' });
    expect(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: { ultimoDiaPresencas: '2026-10-02' }, hojeDia: HOJE }).presencas)
      .toBe('Presenças: exporte de 03/10 até hoje.');
    expect(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: null, hojeDia: HOJE }).presencas).toBe('Presenças: exporte a última semana, até hoje.');
  });

  it('nenhum texto tem travessão', () => {
    const textos = [
      ...Object.values(lembreteExportacao({ marcos: MARCOS, ultimaImportacao: null, hojeDia: HOJE })),
      ...Object.values(resumoDaUltimaImportacao({ id: IMP, dataFaltantes: HOJE, periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' } })),
    ];
    for (const t of textos) expect(String(t)).not.toMatch(/[—–]/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.abaFaltosos.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/abaFaltosos.js' imported from .../src/lib/__tests__/faltosos.abaFaltosos.test.js`, com `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Implementar**

Criar `src/lib/faltosos/abaFaltosos.js`:

```js
// Os textos e a regra de quem importa que o bloco Faltosos de Configurações
// mostra hoje e a aba Faltosos de Clientes vai mostrar (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A aba
// Faltosos", e docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md).
// Puro, testado em node. A aba (o PR 2B) acrescenta aqui os grupos, o
// andamento e o filtro.

import { isGestor } from '../acesso.js';
import { hasModule, MODULES } from '../modules.js';
import { getSafeDateOrNull } from '../dates.js';
import { horaDeBrasilia } from '../../../api/_horarioDeBrasilia.js';
import { ddmm, ddmmaaaa, diaEmBrasilia, somarDias } from './dias.js';
import { normalizarMarcos } from './marcos.js';

const comModulo = (appUser) => hasModule(appUser?.tenantModules, MODULES.FALTOSOS);

// Quem importa as planilhas: só o gestor, com o módulo ligado.
export const importaFaltosos = (appUser) => comModulo(appUser) && isGestor(appUser);

// Os textos sobre a última importação. O dia e a hora são os de Brasília, como
// o resto da importação.
export function resumoDaUltimaImportacao(ultima) {
  if (!ultima?.id) return null;
  const em = getSafeDateOrNull(ultima.importadoEm);
  const quando = em ? `${ddmm(diaEmBrasilia(em))} às ${horaDeBrasilia(em)}` : 'Data não registrada';
  const por = ultima.importadoPorNome ? `, por ${ultima.importadoPorNome}` : '';
  const p = ultima.periodoPresencas;
  return {
    quando: `${quando}${por}`,
    faltantes: ultima.dataFaltantes ? `Faltantes de ${ddmmaaaa(ultima.dataFaltantes)}` : 'Nenhum Faltantes importado',
    presencas: p?.de && p?.ate ? `Presenças de ${ddmm(p.de)} a ${ddmm(p.ate)}` : 'Nenhum Presenças importado',
  };
}

// Como exportar da Next Fit (spec, "Os arquivos"): o Faltantes com o menor
// marco, e o Presenças do dia seguinte ao último dia já importado até hoje.
export function lembreteExportacao({ marcos = [], ultimaImportacao = null, hojeDia = null } = {}) {
  const menor = normalizarMarcos(marcos)[0];
  const faltantes = `Faltantes: exporte com o filtro de ${menor} dias sem vir.`;
  const ate = ultimaImportacao?.ultimoDiaPresencas || ultimaImportacao?.periodoPresencas?.ate || null;
  const proximo = ate ? somarDias(ate, 1) : null;
  let presencas = 'Presenças: exporte a última semana, até hoje.';
  if (proximo && hojeDia && proximo > hojeDia) presencas = 'Presenças: já está importado até hoje.';
  else if (proximo) presencas = `Presenças: exporte de ${ddmm(proximo)} até hoje.`;
  return { faltantes, presencas };
}
```

- [ ] **Step 4: Rodar e ver passar, também em UTC**

Run: `npx vitest run src/lib/__tests__/faltosos.abaFaltosos.test.js`
Expected: PASS, `Tests  4 passed (4)`.

Run: `TZ=UTC npx vitest run src/lib/__tests__/faltosos.abaFaltosos.test.js`
Expected: PASS, `Tests  4 passed (4)`.

Run: `npx eslint src/lib/faltosos/abaFaltosos.js src/lib/__tests__/faltosos.abaFaltosos.test.js`
Expected: nenhuma saída.

- [ ] **Step 5: Commit**

```bash
git add src/lib/faltosos/abaFaltosos.js src/lib/__tests__/faltosos.abaFaltosos.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: textos da última importação e do lembrete de exportação dos faltosos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Janela de importação (`src/lib/faltosos/passosImportacao.js`, `src/lib/faltosos/lerImportacao.js`, `src/views/faltosos/importacao/`)

> Esta task depende das Tasks 1 a 5, 8 e 9:
> - Tasks 1 a 4: o leitor das planilhas (`detectReport`, `parseFaltantes`, `parsePresencas`, `dataDoFaltantes`, os cabeçalhos), `nomeChave`, `isActiveProfessor` (PR 1) e o `planejarImportacao`, com a entrada e a saída do esquema da Task 4.
> - Task 5: `gravarImportacao({ db, tenant, plano, replanejar, ultimaImportacaoLida, quem, onProgress })`, `ERRO_OUTRA_IMPORTACAO` (`lotesImportacao.js`) e os caminhos do `firebase.js`.
> - Task 8: o `faltosos` do contexto.
> - Task 9: o `lembreteExportacao` de `abaFaltosos.js`.
>
> É a Task 10 do plano antigo sem o passo que punha o botão na aba Faltosos: o botão entra no bloco de Configurações, na Task 11 (decisão A1). A janela mora em `src/views/faltosos/importacao/` (decisão A2), e dois textos dela mudaram porque a aba ainda não existe (decisão A5).

**Files:**
- Create: `src/lib/faltosos/passosImportacao.js`, `src/lib/faltosos/lerImportacao.js`
- Test: `src/lib/__tests__/faltosos.passosImportacao.test.js` (novo) e `src/lib/__tests__/faltosos.lerImportacao.test.js` (novo)
- Create: `src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx`, `PassoArquivos.jsx`, `PassoProfessores.jsx`, `PassoPrevia.jsx` e `PassoGravacao.jsx`
- Test: `src/lib/__tests__/importarPlanilhasDialog.test.js` (novo, jsdom)

Notas:
- **Quatro passos** (T5): Arquivos, Professores (só com nome novo), Prévia (com a ligação à mão) e Gravação (com "Tentar de novo"). Nada de `useEffect`: a leitura do arquivo, a leitura da base e a gravação rodam nos handlers, e a prévia sai de `useMemo`, refeita a cada escolha e a cada ligação à mão, sem ler nada.
- **A academia e o instante ficam presos na abertura** (`tenant` do `appUser.tenantId` e `agora`): a importação inteira é de uma academia e usa um "agora" só.
- **Os arquivos**: um ou os dois, em qualquer ordem, reconhecidos pelo cabeçalho; o arquivo novo de um tipo troca o anterior do mesmo tipo. A recusa do Faltantes mais antigo que o último aparece na hora, sem ler a base: a janela roda o próprio plano só com os arquivos e a configuração da tela (`recusaDosArquivos`), então a regra e o texto são os do plano. Depois da leitura, o plano confere de novo com a configuração do servidor.
- **A leitura da base** é toda do servidor (`getDocsFromServer`), da academia congelada: os clientes, todos os estados de `stronix_faltosos` (de qualquer status), todos os nomes de `stronix_nextfit_alunos`, `stronix_config/faltosos` como está gravada (o plano normaliza, inclusive o E0 da mesma data importada de novo) e as presenças dos meses do arquivo (`where('mes', 'in', meses)`). Nenhuma consulta pede índice composto.
- **Os professores**: os nomes novos vêm do plano (`pendencias.professoresNovos`), com a sugestão já escolhida; sem sugestão, o campo fica vazio e segura o Continuar. A escolha vai na entrada do plano (`ligacoes.professores`, depois das guardadas) e chega à gravação dentro do plano (`plano.config.professorLinks`): a janela não passa `professorLinks` à parte.
- **A ligação à mão** é pela chave do nome na Next Fit, e a busca roda nos clientes já lidos (`searchPeople`). O "provável mesma pessoa" (C3) é a `sugestao` da linha, com um clique para ligar. Os empates (C4) trazem os candidatos.
- **A gravação** recebe o plano da prévia confirmada, o `replanejar` com a mesma entrada da prévia, a `ultimaImportacaoLida` (a da leitura da base) e `quem`. A releitura do estado dos alunos antes de gravar (D4) é da gravação, e o registro guarda os números da prévia confirmada. Parada num lote, a janela mostra até onde foi e "Tentar de novo" grava o mesmo envio. O erro `outra-importacao` mostra a mensagem da gravação e só deixa fechar, como o plano com defeito. Durante a gravação a janela não fecha.
- **A janela carrega só quando o gestor abre**, pelo `React.lazy` do bloco de Configurações (Task 11). Nesta task ninguém a importa ainda, então o build não a traz; ela aparece no build na Task 11, num pedaço próprio.
- **Foco e bordas.** Os dois botões feitos à mão (a área de escolher arquivos e cada cliente da busca na ligação à mão) levam `outline-none` e `focus-visible:anel-foco`, e o da busca, que fica numa lista com borda, leva o anel por dentro (`focus-visible:ring-inset`). O resto usa o `Button` e o `Dialog` do shadcn, que já têm `border-border`.

- [ ] **Step 1: Escrever os testes dos passos e da leitura**

Criar `src/lib/__tests__/faltosos.passosImportacao.test.js`:

```js
// Os passos da importação das planilhas da Next Fit
// (src/lib/faltosos/passosImportacao.js), com o leitor e o plano de verdade e
// planilhas falsas com o mesmo cabeçalho das reais. Planilha de verdade, com
// dado de aluno, nunca entra no repositório.
import { describe, it, expect } from 'vitest';
import {
  MOTIVO_FORA, PASSOS, RECUSA_ARQUIVO, SEM_PROFESSOR, alunosParaLigar, cartoesDaPrevia, classificarArquivo,
  colocarArquivo, datasDaPrevia, desfazerLigacao, entradaDoPlano, escolhasIniciais, falhaDaGravacao,
  ligarAMao, linhaDasPresencas, linhasDeFora, linksDasEscolhas, mensagemDeErroDaLeitura, mesesDoPresencas,
  recusaDosArquivos, resumoDoArquivo, textoDoAviso, todosEscolhidos, voltasDaPrevia,
} from '../faltosos/passosImportacao.js';
import { FALTANTES_HEADER, PRESENCAS_HEADER } from '../faltosos/nextfitArquivos.js';
import { planejarImportacao } from '../faltosos/planoImportacao.js';

const AGORA = new Date('2026-10-06T13:00:00Z'); // 06/10/2026, 10h em Brasília
const fimContrato = (dia) => new Date(`${dia}T00:00:00-03:00`);

const faltante = (nome, ausencias, ultima, professor, telefone) => ({
  Nome: nome, Contrato: 'PLANO ANUAL', 'Qtde de ausências': ausencias, 'Última presença': ultima,
  Telefone: telefone, Professor: professor, Consultor: 'BIA',
});
const presenca = (nome, data, tipo = 'Acesso', modalidade = 'offf') => ({ Cliente: nome, Modalidade: modalidade, Contrato: 'PLANO ANUAL', Tipo: tipo, Data: data });

const FALTANTES = {
  nome: 'faltantes.xlsx',
  headers: [...FALTANTES_HEADER],
  rows: [
    faltante('ANA LIMA', 11, '25/09/2026', 'RAFAEL MENEZES DA SILVA SANTO', '(51) 9 9999-0001'),
    faltante('JOAO SEM CADASTRO', 8, '28/09/2026', 'CONTROLE (NAO ALTERAR)', '(51) 9 9999-0002'),
    faltante('CAIO TESTE', 30, '06/09/2026', 'LUANA PRADO', '(51) 9 9999-0003'),
    faltante('DORA SEM PROFESSOR', 9, '27/09/2026', '', '(51) 9 9999-0004'),
    faltante('', 9, '27/09/2026', 'LUANA PRADO', ''),
  ].map((r, i) => ({ __row: i + 2, ...r })),
};
const PRESENCAS = {
  nome: 'presencas.xlsx',
  headers: [...PRESENCAS_HEADER],
  rows: [
    presenca('BIA SOUZA', '30/09/2026 07:00'),
    presenca('BIA SOUZA', '06/10/2026 18:30', 'Agenda', 'Pilates'),
  ].map((r, i) => ({ __row: i + 2, ...r })),
};

const cliente = (id, name, whatsapp, extra = {}) => ({
  id, name, whatsapp, lifecycleBucket: 'cliente', lifecycleStage: 'cliente',
  currentContractId: `c-${id}`, currentContractStatus: 'ativo',
  currentContractStartsAt: fimContrato('2026-01-10'), currentContractEndsAt: fimContrato('2027-06-10'),
  ...extra,
});
const PROFESSORES = [
  { id: 'p-rafa', nome: 'Rafael Menezes da Silva Santos', ativo: true },
  { id: 'p-lu', nome: 'Luana Prado', ativo: true },
];
const BASE = {
  clientes: [
    cliente('l-ana', 'Ana Lima', '51999990001'),
    cliente('l-caio', 'Caio Teste', '51999990003', { currentContractEndsAt: fimContrato('2026-11-30') }),
    cliente('l-dora', 'Dora Sem Professor', '51999990004'),
    cliente('l-bia', 'Bia Souza', '51999990005'),
    cliente('l-joao', 'João Pedro', '51999990009'),
  ],
  estadosAtuais: {},
  nomesGuardados: {},
  presencasAtuais: {},
  configDoc: { professorLinks: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }] },
};

describe('os arquivos', () => {
  it('reconhece o Faltantes pelo cabeçalho e acha a data da exportação', () => {
    const f = classificarArquivo(FALTANTES);
    expect(f.tipo).toBe('faltantes');
    expect(f.linhas).toHaveLength(4);
    expect(f.erros).toHaveLength(1);
    expect(f.dia).toBe('2026-10-06');
    expect(f.divergentes).toBe(0);
    expect(resumoDoArquivo(f)).toBe('4 alunos · exportado em 06/10/2026');
  });

  it('reconhece o Presenças e acha o período, do primeiro ao último dia do arquivo', () => {
    const p = classificarArquivo(PRESENCAS);
    expect(p.tipo).toBe('presencas');
    expect(p.periodo).toEqual({ de: '2026-09-30', ate: '2026-10-06' });
    expect(resumoDoArquivo(p)).toBe('2 presenças · de 30/09 a 06/10');
    expect(mesesDoPresencas(p)).toEqual(['2026-09', '2026-10']);
    expect(mesesDoPresencas(null)).toEqual([]);
  });

  it('recusa o que não é Faltantes nem Presenças, com o texto da spec', () => {
    const acessos = { nome: 'acessos.xlsx', headers: ['AcessoLiberado', 'Cliente', 'Contrato', 'Acesso', 'ModoReconhecimento', 'Offline', 'Motivo'], rows: [] };
    expect(classificarArquivo(acessos)).toEqual({ nome: 'acessos.xlsx', recusa: RECUSA_ARQUIVO });
    expect(RECUSA_ARQUIVO).toBe('Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.');
  });

  it('recusa o relatório sem nenhuma linha que deu para ler', () => {
    expect(classificarArquivo({ ...FALTANTES, rows: [] }).recusa).toBe('Esse Faltantes não tem nenhum aluno que deu para ler.');
    expect(classificarArquivo({ ...PRESENCAS, rows: [] }).recusa).toBe('Esse Presenças não tem nenhuma presença que deu para ler.');
  });

  it('o arquivo novo de um tipo troca o anterior do mesmo tipo', () => {
    const f1 = classificarArquivo(FALTANTES);
    const f2 = { ...f1, nome: 'faltantes-2.xlsx' };
    const p = classificarArquivo(PRESENCAS);
    const juntos = colocarArquivo(colocarArquivo(colocarArquivo({ faltantes: null, presencas: null }, f1), p), f2);
    expect(juntos.faltantes.nome).toBe('faltantes-2.xlsx');
    expect(juntos.presencas.nome).toBe('presencas.xlsx');
  });
});

describe('a recusa antes de ler a base', () => {
  const f = classificarArquivo(FALTANTES);
  const p = classificarArquivo(PRESENCAS);
  const config = (dataFaltantes) => ({ marcos: [7, 14, 30, 60], professorLinks: [], ultimaImportacao: { id: 'x', dataFaltantes } });

  it('sem arquivo nenhum não há o que dizer', () => {
    expect(recusaDosArquivos({ arquivos: { faltantes: null, presencas: null }, config: config(null), agora: AGORA })).toBeNull();
  });

  it('Faltantes mais antigo que o último importado é recusado com o texto do plano; com a mesma data, passa', () => {
    const r = recusaDosArquivos({ arquivos: { faltantes: f, presencas: p }, config: config('2026-10-07'), agora: AGORA });
    expect(r.codigo).toBe('faltantes_antigo');
    expect(r.mensagem).toContain('06/10/2026');
    expect(r.mensagem).toContain('07/10/2026');
    expect(recusaDosArquivos({ arquivos: { faltantes: f, presencas: null }, config: config('2026-10-06'), agora: AGORA })).toBeNull();
  });

  it('o Presenças sozinho não depende da data do último Faltantes', () => {
    expect(recusaDosArquivos({ arquivos: { faltantes: null, presencas: p }, config: config('2026-12-01'), agora: AGORA })).toBeNull();
  });
});

describe('professores novos e ligação à mão', () => {
  const novos = [
    { nome: 'CONTROLE (NAO ALTERAR)', alunos: 1, sugestao: null },
    { nome: 'RAFAEL MENEZES DA SILVA SANTO', alunos: 1, sugestao: 'p-rafa' },
  ];

  it('a escolha começa pela sugestão; sem sugestão fica vazia e segura o Continuar', () => {
    const escolhas = escolhasIniciais(novos);
    expect(escolhas).toEqual({ 'CONTROLE (NAO ALTERAR)': '', 'RAFAEL MENEZES DA SILVA SANTO': 'p-rafa' });
    expect(todosEscolhidos(novos, escolhas)).toBe(false);
    expect(todosEscolhidos(novos, { ...escolhas, 'CONTROLE (NAO ALTERAR)': SEM_PROFESSOR })).toBe(true);
  });

  it('as escolhas viram a ligação guardada, com Sem professor como null', () => {
    expect(linksDasEscolhas(novos, { 'CONTROLE (NAO ALTERAR)': SEM_PROFESSOR, 'RAFAEL MENEZES DA SILVA SANTO': 'p-rafa' })).toEqual([
      { nome: 'CONTROLE (NAO ALTERAR)', professorId: null },
      { nome: 'RAFAEL MENEZES DA SILVA SANTO', professorId: 'p-rafa' },
    ]);
    expect(linksDasEscolhas(novos, { 'CONTROLE (NAO ALTERAR)': '' })).toEqual([]);
  });

  it('a ligação à mão é pela chave do nome, e desfazer tira só ela', () => {
    const item = { chave: 'joao sem cadastro', nome: 'JOAO SEM CADASTRO' };
    const m = ligarAMao({}, item, 'l-joao');
    expect(m).toEqual({ 'joao sem cadastro': { nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' } });
    expect(ligarAMao(m, item, 'l-outro')['joao sem cadastro'].leadId).toBe('l-outro');
    expect(desfazerLigacao(m, 'joao sem cadastro')).toEqual({});
    expect(m).toEqual({ 'joao sem cadastro': { nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' } });
  });
});

describe('a entrada do plano', () => {
  const arquivos = { faltantes: classificarArquivo(FALTANTES), presencas: classificarArquivo(PRESENCAS) };

  it('leva os arquivos, a base, as ligações e o instante', () => {
    const e = entradaDoPlano({
      arquivos, base: BASE, professores: PROFESSORES,
      novos: [{ nome: 'RAFAEL MENEZES DA SILVA SANTO', alunos: 1, sugestao: 'p-rafa' }],
      escolhas: { 'RAFAEL MENEZES DA SILVA SANTO': 'p-rafa' },
      manuais: { 'joao sem cadastro': { nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' } },
      agora: AGORA,
    });
    expect(e.faltantes.linhas).toHaveLength(4);
    expect(e.faltantes.erros).toHaveLength(1);
    expect(e.presencas.linhas).toHaveLength(2);
    expect(e.estadosAtuais).toBe(BASE.estadosAtuais);
    expect(e.presencasAtuais).toBe(BASE.presencasAtuais);
    expect(e.clientes).toBe(BASE.clientes);
    expect(e.professores).toBe(PROFESSORES);
    expect(e.config).toBe(BASE.configDoc);
    expect(e.ligacoes).toEqual({
      professores: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }, { nome: 'RAFAEL MENEZES DA SILVA SANTO', professorId: 'p-rafa' }],
      alunos: {},
      manuais: [{ nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' }],
    });
    expect(e.agora).toBe(AGORA);
  });

  it('sem base, vai a configuração da tela; sem um dos arquivos, ele vai como null', () => {
    const config = { professorLinks: [] };
    const e = entradaDoPlano({ arquivos: { faltantes: null, presencas: arquivos.presencas }, config, agora: AGORA });
    expect(e.faltantes).toBeNull();
    expect(e.config).toBe(config);
    expect(e.clientes).toEqual([]);
  });
});

describe('a prévia que o plano de verdade monta', () => {
  const arquivos = { faltantes: classificarArquivo(FALTANTES), presencas: classificarArquivo(PRESENCAS) };
  const planejar = (extra = {}) => planejarImportacao(entradaDoPlano({ arquivos, base: BASE, professores: PROFESSORES, agora: AGORA, ...extra }));

  it('pede só os professores novos, com a sugestão pelo nome cortado em 29 letras', () => {
    const p = planejar();
    expect(p.recusa).toBeNull();
    expect(p.prontoParaGravar).toBe(false);
    expect(p.pendencias.professoresNovos.map((n) => [n.nome, n.sugestao])).toEqual([
      ['CONTROLE (NAO ALTERAR)', null],
      ['RAFAEL MENEZES DA SILVA SANTO', 'p-rafa'],
    ]);
  });

  it('com as escolhas, fica pronto para gravar e mostra os números, os não ligados e as presenças', () => {
    const novos = planejar().pendencias.professoresNovos;
    const escolhas = { ...escolhasIniciais(novos), 'CONTROLE (NAO ALTERAR)': SEM_PROFESSOR };
    const p = planejar({ novos, escolhas });
    expect(p.prontoParaGravar).toBe(true);
    expect(datasDaPrevia(p.previa)).toBe('Faltantes de 06/10/2026 · Presenças de 30/09 a 06/10');
    const cartoes = cartoesDaPrevia(p.previa);
    expect(cartoes.map((c) => c.rotulo)).toEqual([
      'Entram no marco de 7 dias', 'Entram no marco de 14 dias', 'Entram no marco de 30 dias', 'Entram no marco de 60 dias',
      'Urgentes', 'Voltaram', 'Encerrados', 'Só acompanhamento',
    ]);
    expect(cartoes.find((c) => c.id === 'urgentes').valor).toBe(1);
    expect(linhaDasPresencas(p.previa)).toBe('2 dias de presença de 1 aluno entram na ficha.');
    expect(alunosParaLigar(p.previa)).toEqual([
      { chave: 'joao sem cadastro', nome: 'JOAO SEM CADASTRO', telefone: '(51) 9 9999-0002', origem: 'faltantes', linhas: 1, sugestao: null, candidatos: [] },
    ]);
    expect(linhasDeFora(p.previa)).toEqual([{ arquivo: 'Faltantes', numero: 6, nome: null, motivo: 'Linha sem nome.' }]);

    // Ligar o João à mão refaz o plano sem ler nada, e ele sai dos não ligados.
    const ligado = planejar({ novos, escolhas, manuais: ligarAMao({}, alunosParaLigar(p.previa)[0], 'l-joao') });
    expect(alunosParaLigar(ligado.previa)).toEqual([]);
  });
});

describe('textos da prévia', () => {
  it('as datas numa linha, e nada quando faltam', () => {
    expect(datasDaPrevia({ dataFaltantes: null, periodoPresencas: { de: '2026-10-01', ate: '2026-10-06' } })).toBe('Presenças de 01/10 a 06/10');
    expect(datasDaPrevia({})).toBe('');
    expect(linhaDasPresencas({ numeros: { diasDePresenca: 0 } })).toBe('');
  });

  it('o mesmo nome nos dois arquivos aparece uma vez, com os candidatos do empate', () => {
    const previa = {
      listas: {
        naoLigados: { faltantes: [{ nome: 'MARIA', telefone: '(51) 9 9999-0007', sugestao: 'l-maria' }], presencas: [{ nome: 'Maria', linhas: 3 }] },
        ambiguos: { faltantes: [], presencas: [{ nome: 'BETO', linhas: 2, candidatos: [{ leadId: 'l-b1', nome: 'Beto Um' }, { leadId: 'l-b2', nome: 'Beto Dois' }] }] },
      },
    };
    expect(alunosParaLigar(previa)).toEqual([
      { chave: 'maria', nome: 'MARIA', telefone: '(51) 9 9999-0007', origem: 'faltantes', linhas: 1, sugestao: 'l-maria', candidatos: [] },
      { chave: 'beto', nome: 'BETO', telefone: null, origem: 'presencas', linhas: 2, sugestao: null, candidatos: [{ leadId: 'l-b1', nome: 'Beto Um' }, { leadId: 'l-b2', nome: 'Beto Dois' }] },
    ]);
  });

  it('quem voltou diz o dia ou o intervalo', () => {
    expect(voltasDaPrevia({ listas: { voltaram: [
      { leadId: 'a', nome: 'Ana', voltouEm: '2026-10-03', voltouEntre: null },
      { leadId: 'b', nome: null, voltouEm: null, voltouEntre: { de: '2026-09-26', ate: '2026-10-06' } },
    ] } })).toEqual([
      { leadId: 'a', nome: 'Ana', quando: 'voltou em 03/10' },
      { leadId: 'b', nome: 'Cliente', quando: 'voltou entre 26/09 e 06/10' },
    ]);
  });

  it('o aviso usa o texto do plano e, sem ele, o texto do código; o motivo de fora tem nome', () => {
    expect(textoDoAviso({ codigo: 'buraco_presencas', mensagem: 'O último Presenças importado vai até 30/09.' })).toBe('O último Presenças importado vai até 30/09.');
    expect(textoDoAviso({ codigo: 'filtro_maior' })).toMatch(/filtro maior que o menor marco/);
    expect(textoDoAviso({ codigo: 'datas_divergentes' })).toMatch(/não batem entre si/);
    expect(textoDoAviso({ codigo: 'outro' })).toBe('Confira os números antes de confirmar.');
    expect(MOTIVO_FORA).toEqual({ sem_contrato_ativo: 'Sem contrato ativo', trancado: 'Contrato trancado' });
  });
});

describe('erros da leitura e da gravação', () => {
  it('a leitura diz o que fazer: permissão, conexão ou tentar de novo', () => {
    expect(mensagemDeErroDaLeitura({ code: 'permission-denied' })).toMatch(/regras novas/);
    expect(mensagemDeErroDaLeitura({ code: 'unavailable' })).toMatch(/Sem conexão/);
    expect(mensagemDeErroDaLeitura(new Error('x'))).toBe('Não deu para ler os dados da academia. Tente de novo.');
  });

  it('a gravação que parou num lote deixa tentar de novo; o plano com defeito, não', () => {
    expect(falhaDaGravacao({ resultado: { ok: false, lote: 3, lotes: 5, erro: new Error('rede') } })).toEqual({
      texto: 'A gravação parou no lote 3 de 5. O que entrou antes fica gravado. Tente de novo: nada se repete.',
      podeTentar: true,
    });
    expect(falhaDaGravacao({ resultado: { ok: false, lote: null, lotes: 0, erro: new Error('rede') } }).texto).toMatch(/nada foi gravado/);
    expect(falhaDaGravacao({ resultado: { ok: false, lote: 1, lotes: 2, erro: { code: 'permission-denied' } } })).toEqual({
      texto: 'O Firestore recusou a gravação. Confira se as regras novas foram publicadas.', podeTentar: true,
    });
    expect(falhaDaGravacao({ lancado: { code: 'unavailable' } }).podeTentar).toBe(true);
    const outra = Object.assign(new Error('Outra importação foi gravada enquanto esta janela estava aberta. Nada foi gravado. Feche a janela e importe os arquivos de novo.'), { code: 'outra-importacao' });
    expect(falhaDaGravacao({ resultado: { ok: false, lote: null, lotes: 0, erro: outra } })).toEqual({ texto: outra.message, podeTentar: false });
    expect(falhaDaGravacao({ lancado: new Error('plano da importação inválido: volta sem leadId') })).toEqual({
      texto: 'A importação não passou na conferência, e nada foi gravado. Feche a janela e importe de novo.', podeTentar: false,
    });
  });

  it('os passos têm nome e nenhum texto tem travessão', () => {
    expect(Object.values(PASSOS)).toEqual(['arquivos', 'lendo', 'professores', 'previa', 'gravando', 'pronto']);
    const textos = [
      RECUSA_ARQUIVO, textoDoAviso({ codigo: 'filtro_maior' }), textoDoAviso({ codigo: 'buraco_presencas' }),
      falhaDaGravacao({ lancado: new Error('x') }).texto, falhaDaGravacao({ resultado: { lote: 1, lotes: 2 } }).texto,
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–]/);
  });
});
```

Criar `src/lib/__tests__/faltosos.lerImportacao.test.js`:

```js
// A leitura da base antes da prévia da importação
// (src/lib/faltosos/lerImportacao.js): tudo do servidor, da academia que a
// janela congelou, e no formato que o plano recebe. O Firestore é um dublê que
// guarda o que foi pedido.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pedidos = vi.hoisted(() => []);
const banco = vi.hoisted(() => ({ colecoes: {}, docs: {} }));

vi.mock('../firebase.js', () => ({
  LEADS_PATH: 'stronix_leads',
  CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos',
  FALTOSOS_PATH: 'stronix_faltosos',
  PRESENCAS_PATH: 'stronix_presencas',
  NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
}));
vi.mock('firebase/firestore', () => {
  const snapDe = (lista) => ({ docs: lista.map(([id, data]) => ({ id, data: () => data })) });
  return {
    collection: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
    doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
    query: (ref, ...filtros) => ({ caminho: ref.caminho, filtros }),
    where: (campo, op, valor) => ({ campo, op, valor }),
    getDocsFromServer: async (q) => {
      pedidos.push(['lista', q.caminho, q.filtros || []]);
      const lista = banco.colecoes[q.caminho] || [];
      const filtro = (q.filtros || [])[0];
      if (!filtro) return snapDe(lista);
      if (filtro.op === 'in') return snapDe(lista.filter(([, d]) => filtro.valor.includes(d[filtro.campo])));
      return snapDe(lista.filter(([, d]) => d[filtro.campo] === filtro.valor));
    },
    getDocFromServer: async (ref) => {
      pedidos.push(['doc', ref.caminho]);
      const data = banco.docs[ref.caminho];
      return { exists: () => data !== undefined, data: () => data };
    },
  };
});

const { lerBaseDaImportacao } = await import('../faltosos/lerImportacao.js');

const T = 'academia-teste';
const P = (col) => `artifacts/${T}/public/data/${col}`;

beforeEach(() => {
  pedidos.length = 0;
  banco.colecoes = {
    [P('stronix_leads')]: [
      ['l-ana', { name: 'Ana Lima', lifecycleBucket: 'cliente', lifecycleStage: 'cliente', createdAt: new Date('2026-01-10') }],
      ['l-leo', { name: 'Léo Lead', lifecycleBucket: 'ativo', status: 'Novo', createdAt: new Date('2026-09-10') }],
      ['l-torto', { name: 'Balde torto', lifecycleBucket: 'cliente', status: 'Novo', createdAt: new Date('2026-09-10') }],
    ],
    [P('stronix_faltosos')]: [
      ['l-ana', { status: 'faltando', ultimaPresenca: '2026-09-25', professorId: 'p-rafa' }],
      ['l-ex', { status: 'voltou', ultimaPresenca: '2026-08-01' }],
    ],
    [P('stronix_nextfit_alunos')]: [
      ['ana lima', { nomeNextFit: 'ANA LIMA', leadIds: ['l-ana'], origem: 'telefone' }],
    ],
    [P('stronix_presencas')]: [
      ['l-ana_2026-09', { leadId: 'l-ana', mes: '2026-09', dias: { '2026-09-25': { hora: '07:00', origens: ['catraca'], modalidades: [] } } }],
      ['l-ana_2026-10', { leadId: 'l-ana', mes: '2026-10', dias: {} }],
      ['l-ana_2026-08', { leadId: 'l-ana', mes: '2026-08', dias: {} }],
    ],
  };
  banco.docs = {
    [P('stronix_config/faltosos')]: {
      marcos: [7, 14, 30, 60], janelaUrgenteDias: 60,
      professorLinks: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }],
      ultimaImportacao: { id: 'f2026-09-29', dataFaltantes: '2026-09-29', dataFaltantesAnterior: '2026-09-22' },
    },
  };
});

describe('lerBaseDaImportacao', () => {
  it('lê da academia congelada, só do servidor, e só os clientes', async () => {
    const base = await lerBaseDaImportacao({ db: {}, tenant: T, mesesPresencas: ['2026-09', '2026-10'] });
    for (const p of pedidos) expect(p[1].startsWith(`artifacts/${T}/`), p[1]).toBe(true);
    expect(pedidos.find((p) => p[1] === P('stronix_leads'))[2]).toEqual([{ campo: 'lifecycleBucket', op: '==', valor: 'cliente' }]);
    // O balde torto (cliente no balde, lead no estágio) sai pela rede de segurança da aba Clientes.
    expect(base.clientes.map((c) => c.id)).toEqual(['l-ana']);
  });

  it('traz os estados de todo status, os nomes guardados por chave e as presenças só dos meses do arquivo', async () => {
    const base = await lerBaseDaImportacao({ db: {}, tenant: T, mesesPresencas: ['2026-10', '2026-09', '2026-10'] });
    expect(Object.keys(base.estadosAtuais).sort()).toEqual(['l-ana', 'l-ex']);
    expect(base.nomesGuardados).toEqual({ 'ana lima': { nomeNextFit: 'ANA LIMA', leadIds: ['l-ana'], origem: 'telefone' } });
    expect(Object.keys(base.presencasAtuais).sort()).toEqual(['l-ana_2026-09', 'l-ana_2026-10']);
    const consulta = pedidos.find((p) => p[1] === P('stronix_presencas'));
    expect(consulta[2]).toEqual([{ campo: 'mes', op: 'in', valor: ['2026-10', '2026-09'] }]);
  });

  it('sem Presenças, não lê presença nenhuma', async () => {
    const base = await lerBaseDaImportacao({ db: {}, tenant: T });
    expect(pedidos.some((p) => p[1] === P('stronix_presencas'))).toBe(false);
    expect(base.presencasAtuais).toEqual({});
  });

  it('a configuração vem como está gravada, inclusive o E0 da última importação; sem o doc, vazia', async () => {
    let base = await lerBaseDaImportacao({ db: {}, tenant: T });
    expect(base.configDoc.ultimaImportacao).toEqual({ id: 'f2026-09-29', dataFaltantes: '2026-09-29', dataFaltantesAnterior: '2026-09-22' });
    expect(base.configDoc.janelaUrgenteDias).toBe(60);
    banco.docs = {};
    base = await lerBaseDaImportacao({ db: {}, tenant: T });
    expect(base.configDoc).toEqual({});
  });

  it('sem academia, nem começa', async () => {
    await expect(lerBaseDaImportacao({ db: {}, tenant: null })).rejects.toThrow('Academia da importação');
    expect(pedidos).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.passosImportacao.test.js src/lib/__tests__/faltosos.lerImportacao.test.js`

Expected: FAIL, `Test Files  2 failed (2)` e `Tests  no tests`, com `Error: Cannot find module '../faltosos/passosImportacao.js'` e `Error: Cannot find module` do `lerImportacao.js`.

- [ ] **Step 3: Criar `src/lib/faltosos/passosImportacao.js`**

Criar `src/lib/faltosos/passosImportacao.js`:

```js
// Os passos da importação das planilhas da Next Fit (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// importações" e "A prévia"). Puro, testado em node: o que cada arquivo é, a
// entrada do plano, os nomes novos de professor, a ligação feita à mão e os
// textos da prévia e dos erros. A janela
// (src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx) lê o arquivo, lê
// a base e grava, pelos módulos de leitura e de gravação.
//
// Toda regra da importação mora no plano (planoImportacao.js). `entradaDoPlano`
// é o único lugar que monta a entrada dele: se o formato mudar, muda aqui e no
// teste deste arquivo, e a janela não muda.

import { dataDoFaltantes, detectReport, parseFaltantes, parsePresencas } from './nextfitArquivos.js';
import { planejarImportacao } from './planoImportacao.js';
import { nomeChave } from './ligacaoAlunos.js';
import { ERRO_OUTRA_IMPORTACAO } from './lotesImportacao.js';
import { ddmm, ddmmaaaa, mesDoDia } from './dias.js';

export const PASSOS = Object.freeze({
  ARQUIVOS: 'arquivos',
  LENDO: 'lendo',
  PROFESSORES: 'professores',
  PREVIA: 'previa',
  GRAVANDO: 'gravando',
  PRONTO: 'pronto',
});

// Valor do "Sem professor" na escolha do professor da Next Fit. Vira
// professorId null na ligação guardada.
export const SEM_PROFESSOR = '__sem_professor__';

// O texto da spec para o arquivo que não é nenhum dos dois relatórios.
export const RECUSA_ARQUIVO = 'Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.';
export const RECUSA_ILEGIVEL = 'Não deu para ler esse arquivo. Exporte de novo da Next Fit, em Excel.';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// O que um arquivo lido é. Devolve o arquivo pronto para a tela, com as linhas
// e os erros do leitor, ou a recusa com o motivo.
// - Faltantes leva a data da exportação (última presença mais as ausências) e
//   quantas linhas não batem com ela.
// - Presenças leva o período: do primeiro ao último dia que aparece nele.
export function classificarArquivo({ nome, headers, rows }) {
  const tipo = detectReport(headers);
  if (!tipo) return { nome, recusa: RECUSA_ARQUIVO };
  if (tipo === 'faltantes') {
    const { linhas, erros } = parseFaltantes(rows);
    if (!linhas.length) return { nome, recusa: 'Esse Faltantes não tem nenhum aluno que deu para ler.' };
    const { dia, divergentes } = dataDoFaltantes(linhas);
    return { tipo, nome, linhas, erros: erros || [], dia: dia || null, divergentes: divergentes || 0 };
  }
  const { linhas, erros } = parsePresencas(rows);
  if (!linhas.length) return { nome, recusa: 'Esse Presenças não tem nenhuma presença que deu para ler.' };
  const dias = linhas.map((l) => l.dia).filter(Boolean).sort();
  return { tipo, nome, linhas, erros: erros || [], periodo: { de: dias[0], ate: dias[dias.length - 1] } };
}

// Cada tipo tem um lugar: o arquivo novo de um tipo troca o anterior do mesmo
// tipo, e a tela mostra qual ficou.
export const colocarArquivo = (arquivos, arquivo) => ({ ...arquivos, [arquivo.tipo]: arquivo });

// O resumo de cada arquivo na tela.
export function resumoDoArquivo(arquivo) {
  if (!arquivo) return '';
  if (arquivo.tipo === 'faltantes') {
    const data = arquivo.dia ? ` · exportado em ${ddmmaaaa(arquivo.dia)}` : '';
    return `${plural(arquivo.linhas.length, 'aluno', 'alunos')}${data}`;
  }
  const p = arquivo.periodo;
  return `${plural(arquivo.linhas.length, 'presença', 'presenças')} · de ${ddmm(p.de)} a ${ddmm(p.ate)}`;
}

// Os meses que o Presenças cobre, para ler as presenças já gravadas deles.
export function mesesDoPresencas(presencas) {
  if (!presencas) return [];
  return [...new Set((presencas.linhas || []).map((l) => mesDoDia(l.dia)).filter(Boolean))].sort();
}

// As escolhas do passo dos professores, a partir dos nomes novos do plano
// ({ nome, alunos, sugestao }): a sugestão já vem escolhida; sem ela, o campo
// fica vazio e segura o Continuar.
export const escolhasIniciais = (novos) => Object.fromEntries((novos || []).map((n) => [n.nome, n.sugestao || '']));

export const todosEscolhidos = (novos, escolhas) => (novos || []).every((n) => Boolean(escolhas?.[n.nome]));

// As escolhas no formato da ligação guardada ({ nome, professorId }), com
// "Sem professor" como null.
export function linksDasEscolhas(novos, escolhas) {
  return (novos || [])
    .filter((n) => escolhas?.[n.nome])
    .map((n) => ({ nome: n.nome, professorId: escolhas[n.nome] === SEM_PROFESSOR ? null : escolhas[n.nome] }));
}

// A ligação feita à mão na prévia, pela chave do nome na Next Fit (a mesma do
// documento em stronix_nextfit_alunos). Ligar de novo o mesmo nome troca a
// escolha.
export const ligarAMao = (manuais, item, leadId) => ({ ...manuais, [item.chave]: { nomeNextFit: item.nome, leadId } });

export function desfazerLigacao(manuais, chave) {
  const proximo = { ...manuais };
  delete proximo[chave];
  return proximo;
}

// A entrada do planejarImportacao (src/lib/faltosos/planoImportacao.js).
// - `base` é o que lerBaseDaImportacao leu; sem ela (antes da leitura), o
//   plano roda só com os arquivos e a configuração da tela, para dizer na hora
//   se o Faltantes é mais antigo que o último.
// - A configuração vai como está gravada (configDoc): o plano normaliza o que
//   usa, inclusive o E0 da mesma data importada de novo.
// - As ligações dos professores são as guardadas mais as escolhidas agora,
//   depois delas (a escolha de agora ganha).
export function entradaDoPlano({ arquivos, base = null, config = null, professores = [], novos = [], escolhas = {}, manuais = {}, agora }) {
  const f = arquivos?.faltantes;
  const p = arquivos?.presencas;
  const configDoc = base ? (base.configDoc || {}) : (config || {});
  const guardadas = Array.isArray(configDoc.professorLinks) ? configDoc.professorLinks : [];
  return {
    faltantes: f ? { linhas: f.linhas, erros: f.erros } : null,
    presencas: p ? { linhas: p.linhas, erros: p.erros } : null,
    estadosAtuais: base?.estadosAtuais || {},
    presencasAtuais: base?.presencasAtuais || {},
    clientes: base?.clientes || [],
    professores: professores || [],
    ligacoes: {
      professores: [...guardadas, ...linksDasEscolhas(novos, escolhas)],
      alunos: base?.nomesGuardados || {},
      manuais: Object.values(manuais || {}),
    },
    config: configDoc,
    agora,
  };
}

// A recusa que já dá para ver só com os arquivos e a configuração da tela, sem
// ler a base: o Faltantes mais antigo que o último importado. A regra e o
// texto são os do plano. Sem arquivo, nada a dizer.
export function recusaDosArquivos({ arquivos, config, agora }) {
  if (!arquivos?.faltantes && !arquivos?.presencas) return null;
  return planejarImportacao(entradaDoPlano({ arquivos, config, agora })).recusa || null;
}

// As datas da prévia numa linha: "Faltantes de 06/10/2026 · Presenças de 01/10
// a 06/10".
export function datasDaPrevia(previa) {
  const partes = [];
  if (previa?.dataFaltantes) partes.push(`Faltantes de ${ddmmaaaa(previa.dataFaltantes)}`);
  const p = previa?.periodoPresencas;
  if (p?.de && p?.ate) partes.push(`Presenças de ${ddmm(p.de)} a ${ddmm(p.ate)}`);
  return partes.join(' · ');
}

// Os números da prévia, na ordem da tela: quantos entram em cada marco,
// urgentes, voltaram, encerrados e quem segue só na lista de acompanhamento.
export function cartoesDaPrevia(previa) {
  const n = previa?.numeros || {};
  const porMarco = Object.entries(n.entramNoMarco || {})
    .map(([marco, alunos]) => ({ id: `marco-${marco}`, rotulo: `Entram no marco de ${marco} dias`, valor: alunos, tom: 'brand' }));
  return [
    ...porMarco,
    { id: 'urgentes', rotulo: 'Urgentes', valor: n.urgentes ?? 0, tom: 'rose', detalhe: n.urgentesNovos ? plural(n.urgentesNovos, 'novo', 'novos') : '' },
    { id: 'voltaram', rotulo: 'Voltaram', valor: n.voltaram ?? 0, tom: 'emerald' },
    { id: 'encerrados', rotulo: 'Encerrados', valor: n.encerrados ?? 0, tom: 'slate' },
    { id: 'acompanhamento', rotulo: 'Só acompanhamento', valor: n.acompanhamento ?? 0, tom: 'slate' },
  ];
}

// "12 dias de presença de 8 alunos entram na ficha." Sem Presenças, vazio.
export function linhaDasPresencas(previa) {
  const n = previa?.numeros || {};
  if (!n.diasDePresenca) return '';
  return `${plural(n.diasDePresenca, 'dia de presença', 'dias de presença')} de ${plural(n.alunosNoPresencas || 0, 'aluno', 'alunos')} entram na ficha.`;
}

// Os alunos que o plano não ligou, numa lista só, para a ligação à mão: os
// não ligados e os empates do Faltantes (com o telefone) e do Presenças (com
// quantas linhas). O mesmo nome nos dois arquivos aparece uma vez, com o
// telefone do Faltantes. `sugestao` é o cliente de um nome já guardado, o
// provável quando o telefone mudou no Stronilead.
export function alunosParaLigar(previa) {
  const l = previa?.listas || {};
  const porChave = new Map();
  const poe = (x, origem, candidatos = []) => {
    const nome = typeof x?.nome === 'string' ? x.nome.trim() : '';
    const chave = nomeChave(nome);
    if (!chave || porChave.has(chave)) return;
    porChave.set(chave, {
      chave,
      nome,
      telefone: origem === 'faltantes' ? (x.telefone || null) : null,
      origem,
      linhas: Number.isInteger(x.linhas) ? x.linhas : 1,
      sugestao: typeof x.sugestao === 'string' && x.sugestao ? x.sugestao : null,
      candidatos: (candidatos || []).filter((c) => c?.leadId),
    });
  };
  for (const x of l.naoLigados?.faltantes || []) poe(x, 'faltantes');
  for (const x of l.ambiguos?.faltantes || []) poe(x, 'faltantes', x.candidatos);
  for (const x of l.naoLigados?.presencas || []) poe(x, 'presencas');
  for (const x of l.ambiguos?.presencas || []) poe(x, 'presencas', x.candidatos);
  return [...porChave.values()];
}

// Quem voltou, com o dia ou o intervalo, como a linha do tempo vai dizer.
export function voltasDaPrevia(previa) {
  return (previa?.listas?.voltaram || []).map((v) => ({
    leadId: v.leadId,
    nome: v.nome || 'Cliente',
    quando: v.voltouEm
      ? `voltou em ${ddmm(v.voltouEm)}`
      : (v.voltouEntre ? `voltou entre ${ddmm(v.voltouEntre.de)} e ${ddmm(v.voltouEntre.ate)}` : 'voltou'),
  }));
}

// As linhas que os leitores deixaram de fora, com o arquivo e o número da
// linha na planilha.
export function linhasDeFora(previa) {
  const e = previa?.listas?.erros || {};
  return [
    ...(e.faltantes || []).map((x) => ({ arquivo: 'Faltantes', ...x })),
    ...(e.presencas || []).map((x) => ({ arquivo: 'Presenças', ...x })),
  ];
}

export const MOTIVO_FORA = Object.freeze({
  sem_contrato_ativo: 'Sem contrato ativo',
  trancado: 'Contrato trancado',
});

// O texto de cada aviso da prévia: o plano manda o texto pronto, com as datas;
// sem ele, vale o texto geral do código.
const TEXTO_DO_AVISO = Object.freeze({
  filtro_maior: 'O Faltantes parece ter saído com um filtro maior que o menor marco. Quem sumiu dele vai ser marcado como voltou.',
  datas_divergentes: 'As datas do Faltantes não batem entre si. Valeu o dia da maioria das linhas.',
  buraco_presencas: 'Entre o último Presenças importado e este passaram mais de 2 dias. Pode ter ficado um buraco.',
});
export const textoDoAviso = (aviso) => aviso?.mensagem || TEXTO_DO_AVISO[aviso?.codigo] || 'Confira os números antes de confirmar.';

export function mensagemDeErroDaLeitura(err) {
  if (err?.code === 'permission-denied') {
    return 'Sem permissão para ler os dados da importação. Confira se o módulo está ligado e se as regras novas foram publicadas.';
  }
  if (err?.code === 'unavailable') return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  return 'Não deu para ler os dados da academia. Tente de novo.';
}

// O que a janela diz quando a gravação não termina, e se dá para tentar de
// novo. `resultado` é o que gravarImportacao devolve; `lancado`, o erro que
// subiu (de um plano com defeito, ou da rede).
// - Outra importação gravada com a janela aberta: nada foi gravado, e tentar
//   de novo daria o mesmo erro. O texto é o da gravação.
// - Lote que falhou: os anteriores ficaram gravados, e tentar de novo com o
//   mesmo plano completa sem duplicar, porque os ids são fixos.
// - Leitura que falhou antes do primeiro lote: nada foi gravado.
// - Plano com defeito: nada foi gravado, e tentar de novo daria o mesmo erro.
export function falhaDaGravacao({ resultado = null, lancado = null } = {}) {
  const erro = lancado || resultado?.erro || null;
  if (erro?.code === ERRO_OUTRA_IMPORTACAO) {
    return { texto: erro.message, podeTentar: false };
  }
  if (erro?.code === 'permission-denied') {
    return { texto: 'O Firestore recusou a gravação. Confira se as regras novas foram publicadas.', podeTentar: true };
  }
  if (lancado) {
    if (lancado.code === 'unavailable') return { texto: 'Sem conexão com o servidor. Confira a internet e tente de novo.', podeTentar: true };
    return { texto: 'A importação não passou na conferência, e nada foi gravado. Feche a janela e importe de novo.', podeTentar: false };
  }
  if (Number.isInteger(resultado?.lote)) {
    return {
      texto: `A gravação parou no lote ${resultado.lote} de ${resultado.lotes}. O que entrou antes fica gravado. Tente de novo: nada se repete.`,
      podeTentar: true,
    };
  }
  return { texto: 'Não deu para ler o que já está gravado, e nada foi gravado. Confira a internet e tente de novo.', podeTentar: true };
}
```

Esse arquivo tem `professorId` como chave, e a varredura do histórico do professor reprova arquivo novo assim até ele ser revisado. Ele não grava o professor do lead. Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, trocar:

```js
  'src/lib/faltosos/lotesImportacao.js': 'gravação de stronix_faltosos, nunca de stronix_leads',
};
```

por:

```js
  'src/lib/faltosos/lotesImportacao.js': 'gravação de stronix_faltosos, nunca de stronix_leads',
  'src/lib/faltosos/passosImportacao.js': 'escolhas da ligação dos professores na janela',
};
```

- [ ] **Step 4: Criar `src/lib/faltosos/lerImportacao.js`**

Criar `src/lib/faltosos/lerImportacao.js`:

```js
// O que a importação da Next Fit lê antes da prévia e de novo antes de gravar
// (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// importações"). SDK do navegador; o par puro é o planoImportacao.js.
//
// Tudo vem do servidor (getDocsFromServer): o plano decide quem voltou, quem
// troca de marco e o que já está gravado pelo estado de agora, e um cache
// velho do aparelho planejaria em cima do que já mudou. Sem conexão, a leitura
// falha e a janela pede para tentar de novo.
//
// A academia vem congelada de quem chama e nunca do appId vivo: a importação
// inteira é de uma academia só.
//
// Custo, numa importação da STRONIX: os clientes (cerca de 600), todos os
// estados de falta (um por aluno que já faltou), todos os nomes guardados da
// Next Fit, a configuração e as presenças dos meses do arquivo. A janela lê
// uma vez para a prévia e outra no Confirmar, porque a gravação planeja de
// novo em cima do estado de agora. É uma vez por semana.

import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore';
import {
  LEADS_PATH, CONFIG_PATH, CONFIG_FALTOSOS_ID, FALTOSOS_PATH, PRESENCAS_PATH, NEXTFIT_ALUNOS_PATH,
} from '../firebase.js';
import { LIFECYCLE_BUCKETS } from '../leadQueries.js';
import { isClientLead, normalizeLeadDoc } from '../leads.js';
import { chunk } from '../operacional/queries.js';

const col = (db, tenant, path) => collection(db, 'artifacts', tenant, 'public', 'data', path);

// O `in` do Firestore aceita até 30 valores; o Presenças de uma semana cobre um
// ou dois meses.
const MESES_POR_CONSULTA = 30;

// Devolve:
// - clientes: os leads com lifecycleBucket 'cliente', normalizados como na
//   aba Clientes (só cliente entra na ligação dos alunos);
// - estadosAtuais: { [leadId]: estado } de stronix_faltosos, de todo status;
// - nomesGuardados: { [nomeChave]: { nomeNextFit, leadIds, origem } } de
//   stronix_nextfit_alunos;
// - presencasAtuais: { [`${leadId}_${mês}`]: doc } dos meses pedidos;
// - configDoc: stronix_config/faltosos como está gravado ({} quando não
//   existe). O plano normaliza o que usa dela.
export async function lerBaseDaImportacao({ db, tenant, mesesPresencas = [] }) {
  if (!tenant) throw new Error('Academia da importação não informada.');
  const meses = [...new Set((mesesPresencas || []).filter(Boolean))];
  const [clientesSnap, estadosSnap, alunosSnap, configSnap, ...presencasSnaps] = await Promise.all([
    getDocsFromServer(query(col(db, tenant, LEADS_PATH), where('lifecycleBucket', '==', LIFECYCLE_BUCKETS.CLIENTE))),
    getDocsFromServer(col(db, tenant, FALTOSOS_PATH)),
    getDocsFromServer(col(db, tenant, NEXTFIT_ALUNOS_PATH)),
    getDocFromServer(doc(db, 'artifacts', tenant, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID)),
    ...chunk(meses, MESES_POR_CONSULTA).map((parte) => getDocsFromServer(query(col(db, tenant, PRESENCAS_PATH), where('mes', 'in', parte)))),
  ]);

  const presencasAtuais = {};
  for (const snap of presencasSnaps) for (const d of snap.docs) presencasAtuais[d.id] = d.data();

  return {
    // A mesma rede de segurança da aba Clientes: o balde 'cliente' é, por
    // construção, isClientLead.
    clientes: clientesSnap.docs.map(normalizeLeadDoc).filter((l) => isClientLead(l)),
    estadosAtuais: Object.fromEntries(estadosSnap.docs.map((d) => [d.id, d.data()])),
    nomesGuardados: Object.fromEntries(alunosSnap.docs.map((d) => [d.id, d.data()])),
    presencasAtuais,
    configDoc: configSnap.exists() ? (configSnap.data() || {}) : {},
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.passosImportacao.test.js src/lib/__tests__/faltosos.lerImportacao.test.js`

Expected: PASS, `Test Files  2 passed (2)` e `Tests  27 passed (27)` (22 e 5). O teste dos passos roda o leitor e o plano de verdade (Tasks 1 a 4) com planilhas falsas: se a saída do plano mudar de formato, é ali que quebra.

Run: `TZ=UTC npx vitest run src/lib/__tests__/faltosos.passosImportacao.test.js`

Expected: PASS, `Tests  22 passed (22)`.

Run: `npx eslint src/lib/faltosos/passosImportacao.js src/lib/faltosos/lerImportacao.js src/lib/__tests__/faltosos.passosImportacao.test.js src/lib/__tests__/faltosos.lerImportacao.test.js`

Expected: nenhuma saída.

- [ ] **Step 6: Commit**

```bash
git add src/lib/faltosos/passosImportacao.js src/lib/faltosos/lerImportacao.js src/lib/__tests__/faltosos.passosImportacao.test.js src/lib/__tests__/faltosos.lerImportacao.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: passos e leitura da importação das planilhas da Next Fit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Escrever o teste da janela**

Criar `src/lib/__tests__/importarPlanilhasDialog.test.js`:

```js
// @vitest-environment jsdom
// A janela "Importar planilhas da Next Fit" (src/views/faltosos/importacao/),
// passo a passo: arquivos, professores novos, prévia com ligação à mão e
// gravação. O arquivo, a leitura da base e a gravação são dublês; o leitor das
// planilhas e o plano são os de verdade, com planilhas falsas do mesmo
// cabeçalho das reais. Nada é gravado antes do Confirmar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { CONFIG_FALTOSOS_PADRAO } from '../faltosos/configFaltosos.js';
import { FALTANTES_HEADER, PRESENCAS_HEADER } from '../faltosos/nextfitArquivos.js';

const toast = vi.hoisted(() => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }));
const mundo = vi.hoisted(() => ({ planilhas: {}, bases: [], erroDaBase: null, gravacoes: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', db: {}, auth: {}, storage: {},
  LEADS_PATH: 'stronix_leads', INTERACTIONS_PATH: 'stronix_interactions', CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos', FALTOSOS_PATH: 'stronix_faltosos', PRESENCAS_PATH: 'stronix_presencas',
  IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit', NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
vi.mock('../spreadsheetRead.js', () => ({
  readSpreadsheetFile: vi.fn(async (file) => {
    const p = mundo.planilhas[file.name];
    if (!p) throw new Error('arquivo ilegível');
    return p;
  }),
}));
vi.mock('../faltosos/lerImportacao.js', () => ({
  // Cada leitura devolve a próxima base da fila; a última se repete.
  lerBaseDaImportacao: vi.fn(async () => {
    if (mundo.erroDaBase) throw mundo.erroDaBase;
    return mundo.bases.length > 1 ? mundo.bases.shift() : mundo.bases[0];
  }),
}));
vi.mock('../faltosos/gravarImportacao.js', () => ({
  // Cada gravação usa a próxima resposta da fila; sem resposta, grava tudo.
  gravarImportacao: vi.fn(async ({ onProgress }) => {
    const resposta = mundo.gravacoes.shift();
    if (resposta instanceof Error) throw resposta;
    if (typeof resposta === 'function') return resposta({ onProgress });
    onProgress?.(2, 4);
    if (resposta) return resposta;
    onProgress?.(4, 4);
    return { ok: true, gravadas: 4, total: 4, lote: null, lotes: 2, jaExistia: false, erro: null };
  }),
}));

const { ImportarPlanilhasDialog } = await import('../../views/faltosos/importacao/ImportarPlanilhasDialog.jsx');
const { lerBaseDaImportacao } = await import('../faltosos/lerImportacao.js');
const { gravarImportacao } = await import('../faltosos/gravarImportacao.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fimContrato = (dia) => new Date(`${dia}T00:00:00-03:00`);
const faltante = (nome, ausencias, ultima, professor, telefone) => ({
  Nome: nome, Contrato: 'PLANO ANUAL', 'Qtde de ausências': ausencias, 'Última presença': ultima,
  Telefone: telefone, Professor: professor, Consultor: 'BIA',
});
const comLinha = (rows) => rows.map((r, i) => ({ __row: i + 2, ...r }));
const PLANILHAS = {
  'faltantes.xlsx': {
    headers: [...FALTANTES_HEADER],
    rows: comLinha([
      faltante('ANA LIMA', 11, '25/09/2026', 'RAFAEL MENEZES DA SILVA SANTO', '(51) 9 9999-0001'),
      faltante('JOAO SEM CADASTRO', 8, '28/09/2026', 'CONTROLE (NAO ALTERAR)', '(51) 9 9999-0002'),
      faltante('CAIO TESTE', 30, '06/09/2026', 'LUANA PRADO', '(51) 9 9999-0003'),
    ]),
  },
  'presencas.xlsx': {
    headers: [...PRESENCAS_HEADER],
    rows: comLinha([
      { Cliente: 'BIA SOUZA', Modalidade: 'offf', Contrato: 'PLANO ANUAL', Tipo: 'Acesso', Data: '01/10/2026 07:00' },
      { Cliente: 'BIA SOUZA', Modalidade: 'Pilates', Contrato: 'PLANO ANUAL', Tipo: 'Agenda', Data: '06/10/2026 18:30' },
    ]),
  },
  'acessos.xlsx': {
    headers: ['AcessoLiberado', 'Cliente', 'Contrato', 'Acesso', 'ModoReconhecimento', 'Offline', 'Motivo'],
    rows: comLinha([{ AcessoLiberado: 'Sim', Cliente: 'ANA LIMA', Contrato: 'PLANO ANUAL', Acesso: '01/10/2026 07:00' }]),
  },
};
const PROFESSORES = [
  { id: 'p-rafa', nome: 'Rafael Menezes da Silva Santos', ativo: true },
  { id: 'p-lu', nome: 'Luana Prado', ativo: true },
];
const cliente = (id, name, whatsapp, extra = {}) => ({
  id, name, whatsapp, lifecycleBucket: 'cliente', lifecycleStage: 'cliente',
  currentContractId: `c-${id}`, currentContractStatus: 'ativo',
  currentContractStartsAt: fimContrato('2026-01-10'), currentContractEndsAt: fimContrato('2027-06-10'),
  ...extra,
});
const ULTIMA = { id: 'f2026-09-29_p2026-09-22_2026-09-30', dataFaltantes: '2026-09-29', periodoPresencas: { de: '2026-09-22', ate: '2026-09-30' }, importadoEm: null, importadoPorNome: 'Johnny' };
const CONFIG_DOC = { professorLinks: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }], ultimaImportacao: ULTIMA };
const BASE = {
  clientes: [
    cliente('l-ana', 'Ana Lima', '51999990001'),
    cliente('l-caio', 'Caio Teste', '51999990003', { currentContractEndsAt: fimContrato('2026-11-30') }),
    cliente('l-bia', 'Bia Souza', '51999990004'),
    cliente('l-joao', 'João Pedro', '51999990009'),
  ],
  estadosAtuais: {},
  nomesGuardados: {},
  presencasAtuais: {},
  configDoc: CONFIG_DOC,
};
const CONFIG_DA_TELA = { ...CONFIG_FALTOSOS_PADRAO, professorLinks: CONFIG_DOC.professorLinks, ultimaImportacao: ULTIMA, pronta: true };
const GESTOR = { id: 'g1', name: 'Johnny', role: 'admin', authUid: 'auth-g1', tenantId: 'acad', tenantModules: ['faltosos'] };

let root = null;
let fechou = 0;
async function montar({ faltosos = CONFIG_DA_TELA } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: { professores: PROFESSORES, faltosos } },
      h(ImportarPlanilhasDialog, { appUser: GESTOR, db: {}, onClose: () => { fechou += 1; } })));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 06/10/2026, meio-dia em Brasília.
  vi.setSystemTime(new Date('2026-10-06T15:00:00Z'));
  mundo.planilhas = PLANILHAS;
  mundo.bases = [BASE];
  mundo.erroDaBase = null;
  mundo.gravacoes = [];
  fechou = 0;
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const texto = () => document.body.textContent;
async function clicar(el) {
  await act(async () => { el.click(); });
  await esperar();
}
async function soltar(...nomes) {
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { value: nomes.map((n) => new File(['x'], n)), configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await esperar();
}
async function escrever(el, valor) {
  const proto = el instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event(el instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
const escolha = (nome) => document.querySelector(`select[aria-label="Professor do cadastro para ${nome}"]`);
const alerta = () => document.querySelector('[role="alert"]')?.textContent ?? '';

async function irParaPrevia() {
  await montar();
  await soltar('faltantes.xlsx', 'presencas.xlsx');
  await clicar(botao('Continuar'));
  await escrever(escolha('CONTROLE (NAO ALTERAR)'), '__sem_professor__');
  await clicar(botao('Continuar'));
}

describe('passo dos arquivos', () => {
  it('reconhece os dois relatórios pelo cabeçalho, em qualquer ordem, e lembra como exportar', async () => {
    await montar();
    expect(texto()).toContain('Faltantes: exporte com o filtro de 7 dias sem vir.');
    expect(texto()).toContain('Presenças: exporte de 01/10 até hoje.');
    expect(botao('Continuar').disabled).toBe(true);
    await soltar('presencas.xlsx', 'faltantes.xlsx');
    expect(document.querySelector('[data-arquivo="faltantes"]').textContent).toContain('3 alunos · exportado em 06/10/2026');
    expect(document.querySelector('[data-arquivo="presencas"]').textContent).toContain('2 presenças · de 01/10 a 06/10');
    expect(botao('Continuar').disabled).toBe(false);
  });

  it('arquivo que não é da Next Fit é recusado com o texto da spec', async () => {
    await montar();
    await soltar('acessos.xlsx');
    expect(alerta()).toContain('acessos.xlsx: Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.');
    expect(botao('Continuar').disabled).toBe(true);
  });

  it('arquivo que não abre é recusado sem derrubar a janela', async () => {
    await montar();
    await soltar('quebrado.xlsx');
    expect(alerta()).toContain('Não deu para ler esse arquivo.');
  });

  it('Faltantes mais antigo que o último importado é recusado na hora, sem ler a base', async () => {
    await montar({ faltosos: { ...CONFIG_DA_TELA, ultimaImportacao: { ...ULTIMA, dataFaltantes: '2026-10-07' } } });
    await soltar('faltantes.xlsx');
    expect(alerta()).toContain('06/10/2026');
    expect(alerta()).toContain('07/10/2026');
    expect(botao('Continuar').disabled).toBe(true);
    expect(lerBaseDaImportacao).not.toHaveBeenCalled();
  });

  it('tirar o arquivo devolve o espaço vazio', async () => {
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(document.querySelector('button[aria-label="Tirar o Faltantes"]'));
    expect(document.querySelector('[data-arquivo="faltantes"]')).toBeNull();
    expect(botao('Continuar').disabled).toBe(true);
  });
});

describe('da leitura da base à prévia', () => {
  it('lê a base da academia da janela, com os meses do Presenças, e pede só os professores novos', async () => {
    await montar();
    await soltar('faltantes.xlsx', 'presencas.xlsx');
    await clicar(botao('Continuar'));
    expect(lerBaseDaImportacao).toHaveBeenCalledWith({ db: {}, tenant: 'acad', mesesPresencas: ['2026-10'] });
    // LUANA PRADO já tem ligação; os outros dois são novos.
    expect([...document.querySelectorAll('select[aria-label^="Professor do cadastro"]')].map((s) => s.getAttribute('aria-label')))
      .toEqual(['Professor do cadastro para CONTROLE (NAO ALTERAR)', 'Professor do cadastro para RAFAEL MENEZES DA SILVA SANTO']);
    // O nome cortado em 29 letras pela Next Fit já vem com a sugestão.
    expect(escolha('RAFAEL MENEZES DA SILVA SANTO').value).toBe('p-rafa');
    expect(texto()).toContain('sugerido pelo nome');
    expect(escolha('CONTROLE (NAO ALTERAR)').value).toBe('');
    expect(botao('Continuar').disabled).toBe(true);
    expect(gravarImportacao).not.toHaveBeenCalled();
  });

  it('com as escolhas feitas, a prévia mostra as datas, os números, cada professor e os não ligados', async () => {
    await irParaPrevia();
    expect(texto()).toContain('Faltantes de 06/10/2026 · Presenças de 01/10 a 06/10. Nada foi gravado ainda.');
    expect(texto()).toContain('Entram no marco de 7 dias');
    expect(texto()).toContain('Urgentes');
    expect(texto()).toContain('Rafael Menezes da Silva Santos');
    expect(document.querySelector('[data-nao-ligado="joao sem cadastro"]').textContent).toContain('(51) 9 9999-0002');
    expect(botao('Confirmar e gravar').disabled).toBe(false);
    expect(gravarImportacao).not.toHaveBeenCalled();
  });

  it('sem nome novo de professor, vai direto para a prévia', async () => {
    mundo.bases = [{
      ...BASE,
      configDoc: {
        ...CONFIG_DOC,
        professorLinks: [
          { nome: 'LUANA PRADO', professorId: 'p-lu' },
          { nome: 'CONTROLE (NAO ALTERAR)', professorId: null },
          { nome: 'RAFAEL MENEZES DA SILVA SANTO', professorId: 'p-rafa' },
        ],
      },
    }];
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(botao('Continuar'));
    expect(document.querySelector('select')).toBeNull();
    expect(botao('Confirmar e gravar')).toBeTruthy();
  });

  it('a leitura que falha volta aos arquivos e diz o motivo', async () => {
    mundo.erroDaBase = Object.assign(new Error('negado'), { code: 'permission-denied' });
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(botao('Continuar'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('regras novas foram publicadas'));
    expect(botao('Continuar')).toBeTruthy();
    expect(document.querySelector('[data-arquivo="faltantes"]')).toBeTruthy();
  });

  it('a data do Faltantes é conferida de novo com a configuração do servidor', async () => {
    mundo.bases = [{ ...BASE, configDoc: { ...CONFIG_DOC, ultimaImportacao: { ...ULTIMA, dataFaltantes: '2026-10-08' } } }];
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(botao('Continuar'));
    expect(alerta()).toContain('08/10/2026');
    expect(botao('Continuar').disabled).toBe(true);
  });
});

describe('ligação à mão na prévia', () => {
  it('busca o cliente, liga, refaz a prévia e deixa desfazer', async () => {
    await irParaPrevia();
    const busca = document.querySelector('input[aria-label="Buscar cliente para JOAO SEM CADASTRO"]');
    await escrever(busca, 'joão');
    await clicar([...document.querySelectorAll('ul[aria-label="Clientes para JOAO SEM CADASTRO"] button')].find((b) => b.textContent.includes('João Pedro')));
    expect(document.querySelector('[data-nao-ligado]')).toBeNull();
    expect(document.querySelector('ul[aria-label="Ligados à mão nesta importação"]').textContent).toContain('JOAO SEM CADASTRO ligado a João Pedro');
    await clicar(botao('Desfazer'));
    expect(document.querySelector('[data-nao-ligado="joao sem cadastro"]')).toBeTruthy();
  });
});

describe('gravação', () => {
  it('o Confirmar grava o plano da prévia, com o replanejar, a última importação lida e quem importou', async () => {
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    // A releitura do estado dos alunos é da gravação (replanejar), e não da janela.
    expect(lerBaseDaImportacao).toHaveBeenCalledTimes(1);
    expect(gravarImportacao).toHaveBeenCalledTimes(1);
    const pedido = gravarImportacao.mock.calls[0][0];
    expect(pedido.tenant).toBe('acad');
    expect(pedido.quem).toEqual({ uid: 'auth-g1', id: 'g1', nome: 'Johnny' });
    expect(pedido.ultimaImportacaoLida).toEqual(ULTIMA);
    expect(pedido.plano.prontoParaGravar).toBe(true);
    expect(pedido.plano.recusa).toBeNull();
    expect(pedido.plano.previa.dataFaltantes).toBe('2026-10-06');
    expect(pedido).not.toHaveProperty('professorLinks');
    // O replanejar roda o mesmo plano com os estados que a gravação ler.
    const refeito = pedido.replanejar({});
    expect(refeito.importacao.id).toBe(pedido.plano.importacao.id);
    expect(refeito.prontoParaGravar).toBe(true);
    expect(texto()).toContain('Importação gravada.');
    expect(toast.success).toHaveBeenCalledWith('Importação gravada.');
    await clicar(botao('Fechar'));
    expect(fechou).toBe(1);
  });

  it('a ligação feita à mão vai no plano gravado', async () => {
    await irParaPrevia();
    await escrever(document.querySelector('input[aria-label="Buscar cliente para JOAO SEM CADASTRO"]'), 'joão');
    await clicar([...document.querySelectorAll('ul[aria-label="Clientes para JOAO SEM CADASTRO"] button')].find((b) => b.textContent.includes('João Pedro')));
    await clicar(botao('Confirmar e gravar'));
    const { plano } = gravarImportacao.mock.calls[0][0];
    expect(plano.nomesAlunos).toEqual(expect.arrayContaining([
      expect.objectContaining({ doc: expect.objectContaining({ nomeNextFit: 'JOAO SEM CADASTRO', leadIds: ['l-joao'], origem: 'manual' }) }),
    ]));
  });

  it('se a gravação para no meio, diz o que fazer e tenta de novo com o mesmo plano', async () => {
    mundo.gravacoes = [{ ok: false, gravadas: 2, total: 4, lote: 2, lotes: 3, jaExistia: false, erro: new Error('rede caiu') }];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(alerta()).toContain('A gravação parou no lote 2 de 3.');
    expect(texto()).toContain('2 de 4 gravações');
    await clicar(botao('Tentar de novo'));
    expect(gravarImportacao).toHaveBeenCalledTimes(2);
    expect(gravarImportacao.mock.calls[1][0].plano).toBe(gravarImportacao.mock.calls[0][0].plano);
    expect(lerBaseDaImportacao).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Importação gravada.');
  });

  it('outra importação gravada com a janela aberta: diz o que houve e só deixa fechar', async () => {
    const texto1 = 'Outra importação foi gravada enquanto esta janela estava aberta. Nada foi gravado. Feche a janela e importe os arquivos de novo.';
    mundo.gravacoes = [{ ok: false, gravadas: 0, total: 0, lote: null, lotes: 0, jaExistia: false, erro: Object.assign(new Error(texto1), { code: 'outra-importacao' }) }];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(alerta()).toContain(texto1);
    expect(botao('Tentar de novo')).toBeUndefined();
    await clicar(botao('Fechar'));
    expect(fechou).toBe(1);
  });

  it('plano com defeito não grava nada e não oferece tentar de novo', async () => {
    mundo.gravacoes = [new Error('plano da importação inválido: volta sem leadId')];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(alerta()).toContain('nada foi gravado');
    expect(botao('Tentar de novo')).toBeUndefined();
    expect(botao('Fechar')).toBeTruthy();
  });

  it('durante a gravação a janela não fecha', async () => {
    let terminar;
    mundo.gravacoes = [() => new Promise((r) => { terminar = r; })];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(document.querySelector('button[aria-label="Fechar"]')).toBeNull();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(fechou).toBe(0);
    await act(async () => { terminar({ ok: true, gravadas: 4, total: 4, lote: null, lotes: 2, jaExistia: true, erro: null }); });
    await esperar();
    expect(texto()).toContain('Essa importação já tinha sido gravada.');
  });

  it('voltar da prévia leva aos professores, e de lá aos arquivos', async () => {
    await irParaPrevia();
    await clicar(botao('Voltar'));
    expect(escolha('RAFAEL MENEZES DA SILVA SANTO')).toBeTruthy();
    await clicar(botao('Voltar'));
    expect(document.querySelector('[data-arquivo="faltantes"]')).toBeTruthy();
    expect(gravarImportacao).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/importarPlanilhasDialog.test.js`

Expected: FAIL, `Test Files  1 failed (1)` e `Tests  no tests`, com `Error: Failed to resolve import "../../views/faltosos/importacao/ImportarPlanilhasDialog.jsx" from "src/lib/__tests__/importarPlanilhasDialog.test.js". Does the file exist?`.

- [ ] **Step 9: Criar os quatro passos**

Criar `src/views/faltosos/importacao/PassoArquivos.jsx`:

```jsx
import { useRef, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../../../components/ui/button.jsx';
import { ddmmaaaa } from '../../../lib/faltosos/dias.js';
import { resumoDoArquivo } from '../../../lib/faltosos/passosImportacao.js';

// Passo 1 da importação: um ou os dois relatórios da Next Fit, em qualquer
// ordem. Cada arquivo é reconhecido pelo cabeçalho (classificarArquivo), e o
// arquivo novo de um tipo troca o anterior do mesmo tipo.

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function CartaoDoArquivo({ titulo, arquivo, onTirar, travado }) {
  if (!arquivo) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] text-muted-foreground">
        <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0" />
        <span>{titulo}: nenhum arquivo</span>
      </div>
    );
  }
  return (
    <div data-arquivo={arquivo.tipo} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{titulo}</div>
          <div className="truncate text-[12px] text-muted-foreground">{arquivo.nome} · {resumoDoArquivo(arquivo)}</div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onTirar} disabled={travado} aria-label={`Tirar o ${titulo}`}>
          <X />
        </Button>
      </div>
      {arquivo.divergentes > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          Em {plural(arquivo.divergentes, 'linha', 'linhas')} a data não bate com as outras. Valeu {ddmmaaaa(arquivo.dia)}.
        </p>
      )}
      {arquivo.erros?.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          {plural(arquivo.erros.length, 'linha não deu', 'linhas não deram')} para ler e {arquivo.erros.length === 1 ? 'fica' : 'ficam'} de fora.
        </p>
      )}
    </div>
  );
}

export function PassoArquivos({ arquivos, recusas, problemas, lembrete, lendo, travado = false, onArquivos, onTirar }) {
  const inputRef = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const parado = lendo || travado;

  const receber = (lista) => {
    const files = [...(lista || [])];
    if (files.length) onArquivos(files);
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={parado}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!parado) receber(e.dataTransfer?.files); }}
        className={cn(
          'w-full rounded-2xl border border-dashed border-border p-7 text-center outline-none transition hover:border-primary hover:bg-primary/5 focus-visible:anel-foco disabled:opacity-50',
          arrastando && 'border-primary bg-primary/5',
        )}
      >
        {lendo
          ? <Loader2 aria-hidden="true" className="mx-auto size-[22px] animate-spin text-primary" />
          : <Upload aria-hidden="true" className="mx-auto size-[22px] text-primary" />}
        <span className="mt-2 block text-[13.5px] font-semibold">{lendo ? 'Lendo as planilhas…' : 'Escolher arquivos'}</span>
        <span className="mt-1 block text-[12px] text-muted-foreground">Solte aqui o Faltantes, o Presenças ou os dois, em qualquer ordem.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-label="Planilhas da Next Fit"
        onChange={(e) => {
          // Copia antes de limpar: limpar o campo deixa escolher o mesmo
          // arquivo de novo.
          const files = [...(e.target.files || [])];
          e.target.value = '';
          receber(files);
        }}
      />

      <div className="rounded-xl bg-muted px-4 py-3 text-[12px] text-muted-foreground">
        <p className="font-semibold text-foreground">Como exportar da Next Fit</p>
        <p>{lembrete.faltantes}</p>
        <p>{lembrete.presencas}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <CartaoDoArquivo titulo="Faltantes" arquivo={arquivos.faltantes} onTirar={() => onTirar('faltantes')} travado={parado} />
        <CartaoDoArquivo titulo="Presenças" arquivo={arquivos.presencas} onTirar={() => onTirar('presencas')} travado={parado} />
      </div>

      {(recusas.length > 0 || problemas.length > 0) && (
        <div role="alert">
          <ul className="flex flex-col gap-1.5">
            {recusas.map((r, i) => (
              <li key={`recusa-${i}`} className="flex items-start gap-2 text-[12.5px] text-destructive">
                <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span><span className="font-semibold">{r.nome}:</span> {r.motivo}</span>
              </li>
            ))}
            {problemas.map((p, i) => (
              <li key={`problema-${i}`} className="flex items-start gap-2 text-[12.5px] text-destructive">
                <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

Criar `src/views/faltosos/importacao/PassoProfessores.jsx`:

```jsx
import { isActiveProfessor } from '../../../lib/teamRoles.js';
import { SEM_PROFESSOR } from '../../../lib/faltosos/passosImportacao.js';

// Passo 2 da importação, só quando o Faltantes traz nome de professor que
// ainda não tem ligação. A sugestão do plano já vem escolhida; sem sugestão,
// o gestor escolhe, e o Continuar espera todos. A escolha só é gravada no
// Confirmar, junto com o resto, e vale nas próximas importações. Select
// nativo, como nos formulários em diálogo de Equipe & acessos.

const CAMPO = 'h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30';

export function PassoProfessores({ novos, escolhas, professores, onEscolher }) {
  const ativos = (professores || [])
    .filter((p) => p?.id && isActiveProfessor(p))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-muted-foreground">
        Esses nomes aparecem no Faltantes pela primeira vez. Diga quem é cada um no cadastro de professores. A escolha fica guardada para as próximas importações.
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {novos.map((n) => {
          const sugerido = Boolean(n.sugestao) && escolhas?.[n.nome] === n.sugestao;
          return (
            <li key={n.nome} className="grid gap-2 px-4 py-3 sm:grid-cols-2 sm:items-center">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{n.nome}</div>
                <div className="num text-[11.5px] text-muted-foreground">
                  {n.alunos === 1 ? '1 aluno' : `${n.alunos} alunos`} no Faltantes{sugerido ? ' · sugerido pelo nome' : ''}
                </div>
              </div>
              <select
                aria-label={`Professor do cadastro para ${n.nome}`}
                value={escolhas?.[n.nome] || ''}
                onChange={(e) => onEscolher(n.nome, e.target.value)}
                className={CAMPO}
              >
                <option value="" disabled>Escolha o professor</option>
                {ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                <option value={SEM_PROFESSOR}>Sem professor (fica com o gestor)</option>
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

Criar `src/views/faltosos/importacao/PassoPrevia.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../../../components/ui/button.jsx';
import { ContactPhone } from '../../../components/profile/ContactPhone.jsx';
import { getTone } from '../../../lib/leadState.js';
import { searchPeople } from '../../../lib/globalSearch.js';
import {
  MOTIVO_FORA, alunosParaLigar, cartoesDaPrevia, datasDaPrevia, linhaDasPresencas, linhasDeFora,
  textoDoAviso, voltasDaPrevia,
} from '../../../lib/faltosos/passosImportacao.js';

// Passo 3 da importação: a prévia do que o Confirmar vai gravar. Nada foi
// gravado ainda. Os números e as listas vêm prontos do plano (`previa` e
// `avisos`); a ligação à mão de um aluno refaz o plano na hora, sem ler nada,
// porque os clientes já estão na memória.

const CAMPO = 'h-9 w-full rounded-[10px] border border-border bg-card pl-8 pr-3 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30';

function Numero({ rotulo, valor, tom = 'slate', detalhe = '' }) {
  const n = Number.isFinite(valor) ? valor : 0;
  const t = getTone(tom);
  const realce = n > 0 && tom !== 'slate';
  return (
    <div className={cn('rounded-xl border border-border px-3 py-2.5', realce ? cn(t.soft, t.darkSoft) : 'bg-card')}>
      <div className={cn('num font-display text-[20px] font-bold leading-none', realce ? cn(t.text, t.darkText) : n > 0 ? 'text-foreground' : 'text-muted-foreground')}>{n}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{rotulo}</div>
      {detalhe && <div className="truncate text-[10.5px] text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

function Secao({ titulo, dica, children }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[13px] font-bold">{titulo}</h3>
        {dica && <p className="text-[11.5px] text-muted-foreground">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

// Um aluno que a importação não ligou: o nome (e o telefone, no Faltantes), o
// cliente provável de um nome já guardado, os clientes que empataram e a busca
// nos clientes da academia, que já estão na memória.
function LigarAluno({ item, clientes, porId, onLigar }) {
  const [busca, setBusca] = useState('');
  const resultados = useMemo(
    () => searchPeople(clientes, busca, { limit: 5 }).results.map((r) => r.lead),
    [clientes, busca],
  );
  const provavel = item.sugestao ? porId.get(item.sugestao) : null;
  return (
    <li data-nao-ligado={item.chave} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[13px] font-semibold">{item.nome}</span>
        {item.telefone && <span className="num text-[12px] text-muted-foreground">{item.telefone}</span>}
        <span className="text-[11px] text-muted-foreground">
          {item.origem === 'presencas' ? `Presenças, ${item.linhas === 1 ? '1 linha' : `${item.linhas} linhas`}` : 'Faltantes'}
        </span>
      </div>
      {(provavel || item.candidatos.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {provavel && <span className="text-[11.5px] text-muted-foreground">Provável mesma pessoa:</span>}
          {provavel && (
            <Button type="button" size="xs" variant="outline" onClick={() => onLigar(item, provavel.id)}>
              <Link2 />
              Ligar a {provavel.name}
            </Button>
          )}
          {item.candidatos.map((c) => (
            <Button key={c.leadId} type="button" size="xs" variant="outline" onClick={() => onLigar(item, c.leadId)}>
              <Link2 />
              Ligar a {c.nome || porId.get(c.leadId)?.name || 'cliente'}
            </Button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente por nome ou telefone"
          aria-label={`Buscar cliente para ${item.nome}`}
          className={CAMPO}
        />
      </div>
      {resultados.length > 0 && (
        <ul aria-label={`Clientes para ${item.nome}`} className="flex flex-col gap-0.5">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onLigar(item, c.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] outline-none transition-colors hover:bg-muted focus-visible:anel-foco focus-visible:ring-inset"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground"><ContactPhone lead={c} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function PassoPrevia({ plano, clientes, manuais, onLigar, onDesfazer }) {
  const previa = plano?.previa || {};
  const avisos = plano?.avisos || [];
  const porId = useMemo(() => new Map((clientes || []).map((c) => [c.id, c])), [clientes]);
  const paraLigar = alunosParaLigar(previa);
  const ligadosAMao = Object.entries(manuais || {}).map(([chave, m]) => ({ chave, nome: m.nomeNextFit, lead: porId.get(m.leadId) }));
  const porProfessor = previa.porProfessor || [];
  const fora = previa.listas?.foraSemContrato || [];
  const voltas = voltasDaPrevia(previa);
  const deFora = linhasDeFora(previa);
  const datas = datasDaPrevia(previa);
  const presencas = linhaDasPresencas(previa);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-muted-foreground">{datas ? `${datas}. ` : ''}Nada foi gravado ainda.</p>

      {avisos.length > 0 && (
        <ul aria-label="Avisos da prévia" className="flex flex-col gap-2">
          {avisos.map((a, i) => (
            <li key={`${a?.codigo ?? 'aviso'}-${i}`} className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-foreground">
              <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{textoDoAviso(a)}</span>
            </li>
          ))}
        </ul>
      )}

      <Secao titulo="Números" dica="Quantos alunos entram em cada marco, quantos são urgentes, quantos voltaram, quantos fecharam e quantos seguem só na lista.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cartoesDaPrevia(previa).map((c) => (
            <Numero key={c.id} rotulo={c.rotulo} valor={c.valor} tom={c.tom} detalhe={c.detalhe} />
          ))}
        </div>
        {presencas && <p className="num text-[12px] text-muted-foreground">{presencas}</p>}
      </Secao>

      {porProfessor.length > 0 && (
        <Secao titulo="Por professor" dica="Quanto fica com cada professor depois da importação.">
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {porProfessor.map((p) => (
              <li key={p.professorId ?? 'sem-professor'} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="truncate font-medium">{p.nome || (p.professorId ? 'Professor sem cadastro' : 'Sem professor')}</span>
                <span className="num shrink-0 text-muted-foreground">
                  {p.alunos === 1 ? '1 aluno' : `${p.alunos ?? 0} alunos`}
                  {` · ${p.pendentes === 1 ? '1 tarefa' : `${p.pendentes ?? 0} tarefas`}`}
                  {p.urgentes > 0 ? ` · ${p.urgentes === 1 ? '1 urgente' : `${p.urgentes} urgentes`}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {(paraLigar.length > 0 || ligadosAMao.length > 0) && (
        <Secao
          titulo="Alunos não ligados"
          dica="Ligue à mão quem você reconhece. A ligação fica guardada para as próximas importações, e quem ficar sem ligação continua de fora."
        >
          {paraLigar.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {paraLigar.map((item) => (
                <LigarAluno key={item.chave} item={item} clientes={clientes} porId={porId} onLigar={onLigar} />
              ))}
            </ul>
          )}
          {ligadosAMao.length > 0 && (
            <ul aria-label="Ligados à mão nesta importação" className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {ligadosAMao.map((l) => (
                <li key={l.chave} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{l.nome}</span>
                    <span className="text-muted-foreground"> ligado a </span>
                    <span className="font-semibold">{l.lead?.name || 'cliente'}</span>
                  </span>
                  <Button type="button" size="xs" variant="ghost" onClick={() => onDesfazer(l.chave)}>Desfazer</Button>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      {fora.length > 0 && (
        <Secao titulo="Fora por contrato" dica="Estão sem contrato ativo ou com o contrato trancado no Stronilead. Não entram na lista nem na Meta.">
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {fora.map((f) => (
              <li key={f.leadId} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="truncate font-medium">{f.nome || porId.get(f.leadId)?.name || 'Cliente'}</span>
                <span className="shrink-0 text-muted-foreground">{MOTIVO_FORA[f.motivo] || MOTIVO_FORA.sem_contrato_ativo}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {voltas.length > 0 && (
        <details className="rounded-xl border border-border px-4 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-semibold">Quem voltou ({voltas.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {voltas.map((v) => (
              <li key={v.leadId}><span className="font-medium">{v.nome}</span> <span className="text-muted-foreground">{v.quando}</span></li>
            ))}
          </ul>
        </details>
      )}

      {deFora.length > 0 && (
        <details className="rounded-xl border border-border px-4 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-semibold">Linhas que ficaram de fora ({deFora.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {deFora.map((e) => (
              <li key={`${e.arquivo}-${e.numero}`} className="text-muted-foreground">
                {e.arquivo}, linha {e.numero}{e.nome ? `, ${e.nome}` : ''}: {e.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```

Criar `src/views/faltosos/importacao/PassoGravacao.jsx`:

```jsx
import { AlertTriangle, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Passo 4 da importação: a gravação em lotes, com o andamento, e o fim. Antes
// do primeiro lote a janela relê o que está gravado e refaz o plano. Se a
// gravação parar no meio, os ids fixos deixam tentar de novo com o mesmo
// plano: o que já entrou não se repete.
export function PassoGravacao({ progresso, falha, pronto }) {
  const { gravadas = 0, total = 0 } = progresso || {};
  const pct = total ? Math.round((gravadas / total) * 100) : 0;
  if (pronto) {
    return (
      <div role="status" className="flex flex-col items-center gap-2 py-6 text-center">
        <CircleCheck aria-hidden="true" className="size-8 text-emerald-600 dark:text-emerald-400" />
        <p className="text-[14px] font-semibold">Importação gravada.</p>
        <p className="max-w-sm text-[12.5px] text-muted-foreground">
          {pronto.jaExistia
            ? 'Essa importação já tinha sido gravada. Os alunos foram gravados de novo, e os não ligados foram atualizados.'
            : 'O bloco Faltosos já mostra esta importação, e a ficha de quem voltou a treinar já tem a linha da volta.'}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full transition-all', falha ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
      <p className="num text-[12px] text-muted-foreground" aria-live="polite">
        {total ? `${gravadas} de ${total} gravações` : 'Conferindo o que mudou desde a prévia…'}
      </p>
      {falha && (
        <p role="alert" className="flex items-start gap-2 text-[12.5px] text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{falha.texto}</span>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Criar a janela**

Criar `src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx`:

```jsx
import { useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../../contexts/GeneralConfigContext.jsx';
import { readSpreadsheetFile } from '../../../lib/spreadsheetRead.js';
import { configDasTelas } from '../../../lib/faltosos/configFaltosos.js';
import { hojeEmBrasilia } from '../../../lib/faltosos/dias.js';
import { lembreteExportacao } from '../../../lib/faltosos/abaFaltosos.js';
import { lerBaseDaImportacao } from '../../../lib/faltosos/lerImportacao.js';
import { planejarImportacao } from '../../../lib/faltosos/planoImportacao.js';
import { gravarImportacao } from '../../../lib/faltosos/gravarImportacao.js';
import {
  PASSOS, RECUSA_ILEGIVEL, classificarArquivo, colocarArquivo, desfazerLigacao, entradaDoPlano,
  escolhasIniciais, falhaDaGravacao, ligarAMao, mensagemDeErroDaLeitura, mesesDoPresencas, recusaDosArquivos,
  todosEscolhidos,
} from '../../../lib/faltosos/passosImportacao.js';
import { PassoArquivos } from './PassoArquivos.jsx';
import { PassoProfessores } from './PassoProfessores.jsx';
import { PassoPrevia } from './PassoPrevia.jsx';
import { PassoGravacao } from './PassoGravacao.jsx';

// ==========================================
// IMPORTAR PLANILHAS DA NEXT FIT, só do gestor, aberta pelo bloco Faltosos de
// Configurações → Metas & ritmo (src/views/settings/FaltososPanel.jsx). Spec:
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// importações".
//
// Arquivos → (Professores, só com nome novo) → Prévia → Gravação. Nada é
// gravado antes do Confirmar: a ligação dos professores novos e a dos alunos
// ligados à mão vão junto com o resto, pelo gravarImportacao. Toda regra mora
// em src/lib/faltosos/; aqui é estado, handlers e tela. Nada de useEffect: a
// leitura do arquivo, a leitura da base e a gravação rodam nos handlers, e a
// prévia sai de useMemo, refeita a cada ligação à mão.
//
// A academia e o instante ficam presos na abertura da janela: tudo o que a
// importação lê e grava é dessa academia, e as contas usam um "agora" só. No
// Confirmar, a gravação relê o estado de cada aluno e refaz o plano com a
// mesma entrada da prévia (replanejar), para não gravar em cima do que mudou
// enquanto a prévia estava aberta, e recusa se outra importação entrou nesse
// meio tempo.
// ==========================================

const ETAPAS = [
  { id: PASSOS.ARQUIVOS, rotulo: 'Arquivos' },
  { id: PASSOS.PROFESSORES, rotulo: 'Professores' },
  { id: PASSOS.PREVIA, rotulo: 'Prévia' },
  { id: PASSOS.GRAVANDO, rotulo: 'Gravação' },
];
const ORDEM = { [PASSOS.ARQUIVOS]: 0, [PASSOS.LENDO]: 0, [PASSOS.PROFESSORES]: 1, [PASSOS.PREVIA]: 2, [PASSOS.GRAVANDO]: 3, [PASSOS.PRONTO]: 4 };

function Etapas({ passo, comProfessores }) {
  const atual = ORDEM[passo];
  const etapas = comProfessores ? ETAPAS : ETAPAS.filter((e) => e.id !== PASSOS.PROFESSORES);
  return (
    <ol aria-label="Etapas da importação" className="flex flex-wrap items-center gap-2 text-[12px]">
      {etapas.map((e, i) => {
        const n = ORDEM[e.id];
        const estado = n < atual ? 'feita' : n === atual ? 'atual' : 'depois';
        return (
          <li key={e.id} aria-current={estado === 'atual' ? 'step' : undefined} className="flex items-center gap-2">
            <span className={cn(
              'grid size-6 place-items-center rounded-full text-[11px] font-bold',
              estado === 'atual' && 'bg-primary text-primary-foreground',
              estado === 'feita' && 'bg-emerald-600 text-white',
              estado === 'depois' && 'bg-muted text-muted-foreground',
            )}>
              {estado === 'feita' ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('font-semibold', estado === 'depois' && 'text-muted-foreground')}>{e.rotulo}</span>
            {i < etapas.length - 1 && <span aria-hidden="true" className="h-px w-5 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

const DESCRICAO = {
  [PASSOS.ARQUIVOS]: 'Mande o Faltantes, o Presenças ou os dois. Nada é gravado antes do Confirmar.',
  [PASSOS.LENDO]: 'Lendo os clientes e as importações anteriores…',
  [PASSOS.PROFESSORES]: 'Ligue os professores novos da Next Fit ao cadastro de professores.',
  [PASSOS.PREVIA]: 'Confira o que vai ser gravado.',
  [PASSOS.GRAVANDO]: 'Gravando a importação.',
  [PASSOS.PRONTO]: 'Pronto.',
};

export function ImportarPlanilhasDialog({ appUser, db, onClose }) {
  const toast = useToast();
  const { professores, faltosos } = useGeneralConfig();
  const configDaTela = configDasTelas(faltosos);
  const [tenant] = useState(() => appUser?.tenantId || null);
  const [agora] = useState(() => new Date());
  const hojeDia = hojeEmBrasilia(agora);

  const [passo, setPasso] = useState(PASSOS.ARQUIVOS);
  const [arquivos, setArquivos] = useState({ faltantes: null, presencas: null });
  const [recusas, setRecusas] = useState([]);
  const [lendoArquivos, setLendoArquivos] = useState(false);
  const [problemaDaBase, setProblemaDaBase] = useState(null);
  const [base, setBase] = useState(null);              // lerBaseDaImportacao
  const [novos, setNovos] = useState([]);              // os professores novos do plano
  const [escolhas, setEscolhas] = useState({});        // nome da Next Fit → professorId | SEM_PROFESSOR
  const [manuais, setManuais] = useState({});          // chave do nome → { nomeNextFit, leadId }
  const [envio, setEnvio] = useState(null);            // { plano, entrada } da prévia confirmada
  const [progresso, setProgresso] = useState({ gravadas: 0, total: 0 });
  const [falha, setFalha] = useState(null);            // { texto, podeTentar }
  const [pronto, setPronto] = useState(null);          // { jaExistia }
  const ocupadoRef = useRef(false);

  // A recusa que já se vê só com os arquivos (Faltantes mais antigo que o
  // último importado), sem ler a base.
  const recusaAntes = useMemo(
    () => recusaDosArquivos({ arquivos, config: configDaTela, agora }),
    [arquivos, configDaTela, agora],
  );
  const problemas = [recusaAntes?.mensagem, problemaDaBase].filter(Boolean);
  const temArquivo = Boolean(arquivos.faltantes || arquivos.presencas);
  const lembrete = lembreteExportacao({ marcos: configDaTela.marcos, ultimaImportacao: configDaTela.ultimaImportacao, hojeDia });

  const naPrevia = passo === PASSOS.PREVIA;
  const plano = useMemo(() => {
    if (!base || !naPrevia) return null;
    const entrada = entradaDoPlano({ arquivos, base, professores, novos, escolhas, manuais, agora });
    try {
      return { ok: true, valor: planejarImportacao(entrada), entrada };
    } catch (erro) {
      console.error('planejarImportacao', erro);
      return { ok: false, erro };
    }
  }, [base, naPrevia, arquivos, professores, novos, escolhas, manuais, agora]);
  const podeConfirmar = Boolean(plano?.ok && plano.valor.prontoParaGravar && !plano.valor.recusa);

  // Durante a gravação a janela não fecha; parada com erro, fecha.
  const travada = passo === PASSOS.GRAVANDO && !falha;
  const fechar = () => { if (!travada) onClose?.(); };

  // Arquivo novo pede leitura nova da base e uma prévia do par de agora.
  const esquecerBase = () => {
    setBase(null);
    setNovos([]);
    setEscolhas({});
    setManuais({});
    setProblemaDaBase(null);
  };

  const receberArquivos = async (files) => {
    setLendoArquivos(true);
    let proximos = arquivos;
    const novasRecusas = [];
    try {
      for (const file of files) {
        try {
          const { headers, rows } = await readSpreadsheetFile(file);
          const lido = classificarArquivo({ nome: file.name, headers, rows });
          if (lido.recusa) novasRecusas.push({ nome: file.name, motivo: lido.recusa });
          else proximos = colocarArquivo(proximos, lido);
        } catch (err) {
          console.error('readSpreadsheetFile', err);
          novasRecusas.push({ nome: file.name, motivo: RECUSA_ILEGIVEL });
        }
      }
    } finally {
      setArquivos(proximos);
      setRecusas(novasRecusas);
      esquecerBase();
      setLendoArquivos(false);
    }
  };

  const tirarArquivo = (tipo) => {
    setArquivos((a) => ({ ...a, [tipo]: null }));
    setRecusas([]);
    esquecerBase();
  };

  // Lê a base e roda o plano uma vez para saber se há professor novo. O plano
  // recusa de novo, agora com a configuração do servidor, o Faltantes mais
  // antigo que o último: outra importação pode ter entrado depois que a aba
  // abriu.
  const lerBase = async () => {
    setPasso(PASSOS.LENDO);
    try {
      const lida = await lerBaseDaImportacao({ db, tenant, mesesPresencas: mesesDoPresencas(arquivos.presencas) });
      const primeiro = planejarImportacao(entradaDoPlano({ arquivos, base: lida, professores, agora }));
      if (primeiro.recusa) {
        setProblemaDaBase(primeiro.recusa.mensagem);
        setPasso(PASSOS.ARQUIVOS);
        return;
      }
      const pendentes = primeiro.pendencias.professoresNovos;
      setBase(lida);
      setNovos(pendentes);
      setEscolhas(escolhasIniciais(pendentes));
      setManuais({});
      setPasso(pendentes.length ? PASSOS.PROFESSORES : PASSOS.PREVIA);
    } catch (err) {
      console.error('lerBaseDaImportacao', err);
      toast.error(mensagemDeErroDaLeitura(err));
      setPasso(PASSOS.ARQUIVOS);
    }
  };

  // Grava o plano da prévia confirmada. A gravação relê o estado de cada aluno
  // e roda o plano de novo com a mesma entrada (replanejar), e o registro
  // guarda os números da prévia confirmada. Se ela parar no meio, "Tentar de
  // novo" grava o mesmo envio: os ids são fixos, nada se repete.
  const gravar = async (atual) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setEnvio(atual);
    setFalha(null);
    setProgresso({ gravadas: 0, total: 0 });
    setPasso(PASSOS.GRAVANDO);
    try {
      const res = await gravarImportacao({
        db,
        tenant,
        plano: atual.plano,
        replanejar: (estadosAtuais) => planejarImportacao({ ...atual.entrada, estadosAtuais }),
        ultimaImportacaoLida: base?.configDoc?.ultimaImportacao ?? null,
        quem: { uid: appUser?.authUid || null, id: appUser?.id || null, nome: appUser?.name || '' },
        onProgress: (gravadas, total) => setProgresso({ gravadas, total }),
      });
      if (!res?.ok) {
        setFalha(falhaDaGravacao({ resultado: res }));
        return;
      }
      setPronto({ jaExistia: Boolean(res.jaExistia) });
      setPasso(PASSOS.PRONTO);
      toast.success('Importação gravada.');
    } catch (err) {
      console.error('gravarImportacao', err);
      setFalha(falhaDaGravacao({ lancado: err }));
    } finally {
      ocupadoRef.current = false;
    }
  };

  const confirmar = () => {
    if (!podeConfirmar) return;
    gravar({ plano: plano.valor, entrada: plano.entrada });
  };

  const voltar = () => {
    if (passo === PASSOS.PREVIA && novos.length) setPasso(PASSOS.PROFESSORES);
    else {
      esquecerBase();
      setPasso(PASSOS.ARQUIVOS);
    }
  };

  let conteudo = null;
  let rodape = null;
  if (passo === PASSOS.ARQUIVOS || passo === PASSOS.LENDO) {
    conteudo = (
      <PassoArquivos
        arquivos={arquivos}
        recusas={recusas}
        problemas={problemas}
        lembrete={lembrete}
        lendo={lendoArquivos}
        travado={passo === PASSOS.LENDO}
        onArquivos={receberArquivos}
        onTirar={tirarArquivo}
      />
    );
    rodape = (
      <>
        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
        <Button type="button" onClick={lerBase} disabled={!temArquivo || problemas.length > 0 || lendoArquivos || passo === PASSOS.LENDO}>
          {passo === PASSOS.LENDO && <Loader2 className="animate-spin" />}
          {passo === PASSOS.LENDO ? 'Lendo…' : 'Continuar'}
        </Button>
      </>
    );
  } else if (passo === PASSOS.PROFESSORES) {
    conteudo = (
      <PassoProfessores
        novos={novos}
        escolhas={escolhas}
        professores={professores}
        onEscolher={(nome, valor) => setEscolhas((e) => ({ ...e, [nome]: valor }))}
      />
    );
    rodape = (
      <>
        <Button type="button" variant="ghost" onClick={voltar}>Voltar</Button>
        <Button type="button" onClick={() => setPasso(PASSOS.PREVIA)} disabled={!todosEscolhidos(novos, escolhas)}>Continuar</Button>
      </>
    );
  } else if (passo === PASSOS.PREVIA) {
    conteudo = plano?.ok
      ? (
        <PassoPrevia
          plano={plano.valor}
          clientes={base.clientes}
          manuais={manuais}
          onLigar={(item, leadId) => setManuais((m) => ligarAMao(m, item, leadId))}
          onDesfazer={(chave) => setManuais((m) => desfazerLigacao(m, chave))}
        />
      )
      : <p role="alert" className="text-[12.5px] text-destructive">Não deu para montar a prévia com esses arquivos. Confira se são os relatórios certos e tente de novo.</p>;
    rodape = (
      <>
        <Button type="button" variant="ghost" onClick={voltar}>Voltar</Button>
        <Button type="button" onClick={confirmar} disabled={!podeConfirmar}>Confirmar e gravar</Button>
      </>
    );
  } else {
    conteudo = <PassoGravacao progresso={progresso} falha={falha} pronto={passo === PASSOS.PRONTO ? pronto : null} />;
    if (passo === PASSOS.PRONTO) {
      rodape = <Button type="button" onClick={fechar}>Fechar</Button>;
    } else if (falha) {
      rodape = (
        <>
          <Button type="button" variant="ghost" onClick={fechar}>Fechar</Button>
          {falha.podeTentar && <Button type="button" onClick={() => gravar(envio)}>Tentar de novo</Button>}
        </>
      );
    }
  }

  return (
    <Dialog open onOpenChange={(aberta) => { if (!aberta) fechar(); }}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        overlayClassName="z-[210]"
        className="z-[210] flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 sm:max-w-[820px]"
      >
        <div className="flex flex-col gap-3 border-b border-border px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Importar planilhas da Next Fit</DialogTitle>
              <DialogDescription className="text-[12.5px]">{DESCRICAO[passo]}</DialogDescription>
            </div>
            {!travada && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={fechar} aria-label="Fechar">
                <X />
              </Button>
            )}
          </div>
          <Etapas passo={passo} comProfessores={novos.length > 0} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{conteudo}</div>
        {rodape && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">{rodape}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 11: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/importarPlanilhasDialog.test.js`

Expected: PASS, `Tests  18 passed (18)`. O teste usa o leitor e o plano de verdade; o arquivo, a leitura da base e a gravação são dublês.

Run: `npx vitest run src/lib/__tests__/anelDeFoco.test.js src/lib/__tests__/bordaDosPrimitivos.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/overscrollGuard.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`

Expected: PASS, `Test Files  6 passed (6)` e `Tests  32 passed (32)`. O `anelDeFoco.test.js` varre `src/` e reprova o anel antigo nos arquivos novos.

Run: `npx vitest run 2>&1 | tail -5`

Expected: todos passando, `Test Files  382 passed (382)` e `Tests  7308 passed (7308)`.

Run: `npx eslint src/lib/faltosos src/views/faltosos src/lib/__tests__/importarPlanilhasDialog.test.js`

Expected: nenhuma saída.

- [ ] **Step 12: Commit**

```bash
git add src/views/faltosos/importacao src/lib/__tests__/importarPlanilhasDialog.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: janela de importação das planilhas da Next Fit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Bloco Faltosos em Configurações, com a importação (`src/lib/faltosos/configuracoes.js`, `src/views/settings/FaltososPanel.jsx`, `src/views/settings/PaceSection.jsx`, `src/views/settings/SettingsView.jsx`)

> Esta task depende das Tasks 3, 5, 8, 9 e 10: `normalizarMarcos` (`marcos.js`) e `configDasTelas` (`configFaltosos.js`), `CONFIG_FALTOSOS_ID` (`firebase.js`), o `faltosos` do contexto com `pronta` e `erro`, os textos de `abaFaltosos.js` e a janela `src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx`.
>
> É o bloco da Task 13 do plano antigo, sem a Meta do professor, que fica para o 2B, e com a importação dentro dele (decisões A1 e A4).

**Files:**
- Create: `src/lib/faltosos/configuracoes.js`
- Create: `src/views/settings/FaltososPanel.jsx`
- Modify: `src/views/settings/PaceSection.jsx:13` (import), `:15-17` (comentário do topo), `:76` (a seção recebe o `appUser`) e `:361-364` (o bloco entra antes do `FormDialog` do marco de renovação, com o `appUser`). Só monta o bloco: nada do que a seção já faz muda.
- Modify: `src/views/settings/SettingsView.jsx:173`, só a linha que monta a `PaceSection`, para entregar o `appUser` ao bloco.
- Test: `src/lib/__tests__/faltosos.configuracoes.test.js` (novo)
- Test: `src/lib/__tests__/faltososPanel.test.js` (novo, jsdom)

Notas:
- Decisão F3: o bloco é um componente próprio, `FaltososPanel`, que a `PaceSection` desenha no fim. Ele grava `stronix_config/faltosos` campo a campo, com `setDoc(..., { merge: true })`, como o resto de Metas & ritmo grava o `general`, sem botão Salvar. As regras de editar moram em `src/lib/faltosos/configuracoes.js`, puro. A tela muda quando a assinatura do App (Task 8) traz o documento de volta.
- Marcos: de 1 a 6 inteiros de 1 a 365, sem repetir, em ordem crescente, num `FormDialog` no molde dos marcos de renovação. O campo tem `min`, `max` e `step`, então o navegador barra o valor fora do limite antes, e a função repete a regra. Com seis marcos, o "Novo marco" fica desligado, e o último marco não sai. Um teste confere que a lista que sai do bloco é a que o `normalizarMarcos` da importação aceita sem mexer.
- Janela do urgente: campo numérico que salva ao sair (Enter confirma), no molde da meta de prospecção, com `key` pelo valor salvo para acompanhar o documento. Aceita o número digitado como texto (`'120'`) e grava número; o inválido volta para o valor salvo, com aviso.
- Professores da Next Fit: uma linha por nome, em ordem alfabética, com `<select>` nativo, no molde do PR 1 em Equipe & acessos: "Sem professor" e os ativos (`isActiveProfessor`). O professor que a linha já tem aparece mesmo inativo ("(inativo)") ou fora do cadastro. A lista só cresce pela importação; aqui só se troca. `professorLinks` é lista, e o `set` com merge troca a lista inteira, então a troca grava a lista toda com só aquele nome mudado.
- Decisão C5: tudo no bloco vale a partir da próxima importação. Os estados já gravados não mudam na hora, e a nota do bloco e os avisos dizem isso.
- Quem vê o bloco: esta task é dona também da linha da `SettingsView` que monta a `PaceSection`, que passa a entregar o `appUser`, e a `PaceSection` o repassa ao `FaltososPanel`. O bloco confere sozinho o módulo e o papel pelo `importaFaltosos(appUser)` (Task 9), além do `pronta` da configuração já lida (no `faltosos` do contexto, Task 8): antes da leitura o bloco não aparece, para ninguém editar em cima do padrão e gravar por cima do que a academia tem. A trava `gestor` de `SCREENS.settings` e as regras de `stronix_config`, que só deixam o gestor gravar, continuam valendo por fora.
- **A importação no bloco** (A1). A primeira seção mostra a última importação ("Última importação: 06/10 às 09:12, por Johnny", e embaixo "Faltantes de 06/10/2026 · Presenças de 29/09 a 05/10"), ou "Nenhuma importação ainda", e o lembrete "Como exportar da Next Fit." com o Faltantes e o Presenças (`resumoDaUltimaImportacao` e `lembreteExportacao`, Task 9). O "hoje" do lembrete é o de Brasília, preso na montagem do bloco. O botão "Importar planilhas" é o `SettingsBtn` principal, no cabeçalho do bloco (`action` do `SettingsPanel`).
- **A janela carrega só no clique**, com `React.lazy` e `Suspense`, e sai da tela quando fecha. Ela traz o motor da importação e a gravação, que só servem ao gestor na hora de importar, e o `gravarImportacao.js` lê os caminhos do `firebase.js` ao carregar o arquivo (`const CAMINHOS = { faltosos: FALTOSOS_PATH, ... }`). Com import direto, o teste do bloco, que troca o `firebase.js` por um dublê só com `appId`, `CONFIG_PATH` e `CONFIG_FALTOSOS_ID`, quebra com `[vitest] No "FALTOSOS_PATH" export is defined on the "../firebase.js" mock` assim que a janela deixa de ser um marcador (conferido ao escrever o plano). Hoje nenhum outro teste monta Metas & ritmo com o `firebase.js` trocado, e os que montam o `ClientsView` assim (`clientsProfessor.test.js`, `listRowLinks.test.js`) vão abrir a mesma janela no 2B. No build, a janela sai num pedaço próprio, de uns 53 kB.
- **Leitura que falhou** (A4): com `erro` no `faltosos` do contexto, o bloco mostra só o aviso, num `role="alert"`, sem o botão e sem os campos.
- O botão de remover marco leva `focus-visible:anel-foco`, como o dos marcos de renovação da mesma tela. O campo da janela do urgente segue o campo da meta de prospecção, ao lado.

- [ ] **Step 1: Conferir os pré-requisitos**

```bash
grep -n "export function normalizarMarcos" src/lib/faltosos/marcos.js
grep -n "export const configDasTelas" src/lib/faltosos/configFaltosos.js
grep -n "export const CONFIG_FALTOSOS_ID" src/lib/firebase.js
grep -n "export const importaFaltosos" src/lib/faltosos/abaFaltosos.js
grep -n "export function ImportarPlanilhasDialog" src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx
grep -n "pronta: true" src/App.jsx
```

Expected: uma linha em cada um. Sem o `pronta: true` no App, o bloco nunca aparece: confira com a Task 8 como o App entrega a configuração lida antes de seguir.

- [ ] **Step 2: Escrever o teste das regras do bloco**

Criar `src/lib/__tests__/faltosos.configuracoes.test.js`:

```js
// As contas do bloco Faltosos de Configurações → Metas & ritmo
// (src/lib/faltosos/configuracoes.js): marcos de 1 a 6 números de 1 a 365 sem
// repetir, janela do urgente e a troca do professor de cada nome da Next Fit.
// A regra que a importação usa para os marcos é o normalizarMarcos, e o
// último bloco confere que as duas dizem o mesmo.
import { describe, it, expect } from 'vitest';
import {
  MARCOS_MAX, MENSAGENS_DO_BLOCO, SEM_PROFESSOR, adicionarMarco, removerMarco, validarJanelaUrgente,
  trocarLigacaoProfessor, ligacoesEmOrdem, opcoesDeProfessor,
} from '../faltosos/configuracoes.js';
import { normalizarMarcos } from '../faltosos/marcos.js';

describe('marcos de falta', () => {
  it('marco novo entra em ordem', () => {
    expect(adicionarMarco([7, 14, 30, 60], '21')).toEqual({ marcos: [7, 14, 21, 30, 60] });
    expect(adicionarMarco([7], 1)).toEqual({ marcos: [1, 7] });
    expect(adicionarMarco([7], ' 365 ')).toEqual({ marcos: [7, 365] });
  });

  it('recusa fora de 1 a 365, número quebrado e campo vazio', () => {
    for (const x of ['0', '366', '7.5', '', '  ', 'abc', null, undefined, -3]) {
      expect(adicionarMarco([7], x), String(x)).toEqual({ erro: MENSAGENS_DO_BLOCO.marcoForaDoLimite });
    }
  });

  it('recusa repetido e o sétimo marco', () => {
    expect(adicionarMarco([7, 14], '14')).toEqual({ erro: 'O marco de 14 dias já existe.' });
    expect(adicionarMarco([1, 7], '1')).toEqual({ erro: 'O marco de 1 dia já existe.' });
    const seis = [7, 14, 21, 30, 45, 60];
    expect(seis).toHaveLength(MARCOS_MAX);
    expect(adicionarMarco(seis, '90')).toEqual({ erro: 'São no máximo 6 marcos.' });
  });

  it('remove, mas nunca o último', () => {
    expect(removerMarco([7, 14, 30], 14)).toEqual({ marcos: [7, 30] });
    expect(removerMarco([7], 7)).toEqual({ erro: 'Mantenha ao menos um marco de falta.' });
  });

  it('a lista que sai do bloco é a mesma que a importação aceita (normalizarMarcos)', () => {
    let lista = [7];
    for (const n of [365, 1, 60, 30, 14]) {
      lista = adicionarMarco(lista, String(n)).marcos;
      expect(normalizarMarcos(lista), lista.join(',')).toEqual(lista);
    }
    expect(lista).toHaveLength(MARCOS_MAX);
    expect(normalizarMarcos(removerMarco(lista, 365).marcos)).toEqual([1, 7, 14, 30, 60]);
  });
});

describe('janela do urgente', () => {
  it('inteiro de 1 a 365', () => {
    expect(validarJanelaUrgente('120')).toEqual({ dias: 120 });
    expect(validarJanelaUrgente(1)).toEqual({ dias: 1 });
    expect(validarJanelaUrgente('365')).toEqual({ dias: 365 });
    for (const x of ['0', '366', '', '9.5', 'x', null]) {
      expect(validarJanelaUrgente(x), String(x)).toEqual({ erro: MENSAGENS_DO_BLOCO.janelaForaDoLimite });
    }
  });

  it('os textos não têm travessão nem aspas curvas', () => {
    const textos = [
      MENSAGENS_DO_BLOCO.marcoForaDoLimite, MENSAGENS_DO_BLOCO.marcoRepetido(7),
      MENSAGENS_DO_BLOCO.marcosDemais, MENSAGENS_DO_BLOCO.marcoUltimo, MENSAGENS_DO_BLOCO.janelaForaDoLimite,
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–“”‘’]/);
  });
});

describe('professores da Next Fit', () => {
  const LINKS = [
    { nome: 'RAFAEL MENEZES', professorId: 'prof-rafa' },
    { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
  ];

  it('troca o professor de um nome e deixa os outros como estão, na mesma ordem', () => {
    expect(trocarLigacaoProfessor(LINKS, 'RAFAEL MENEZES', 'prof-lu')).toEqual([
      { nome: 'RAFAEL MENEZES', professorId: 'prof-lu' }, { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
    ]);
  });

  it('texto vazio é "Sem professor", e nome que não está na lista não entra', () => {
    expect(trocarLigacaoProfessor(LINKS, 'RAFAEL MENEZES', '')[0]).toEqual({ nome: 'RAFAEL MENEZES', professorId: null });
    expect(trocarLigacaoProfessor(LINKS, 'OUTRO', 'prof-lu')).toEqual(LINKS);
  });

  it('item sem nome sai da lista gravada', () => {
    expect(trocarLigacaoProfessor([...LINKS, { nome: '  ' }, null], 'OUTRO', 'x')).toEqual(LINKS);
  });

  it('a tela mostra os nomes em ordem, sem ligar para acento e caixa', () => {
    expect(ligacoesEmOrdem([{ nome: 'Érica' }, { nome: 'bruno' }, { nome: 'Ana' }]).map((l) => l.nome)).toEqual(['Ana', 'bruno', 'Érica']);
    expect(ligacoesEmOrdem(null)).toEqual([]);
  });

  it('opções: "Sem professor" e os ativos em ordem de nome', () => {
    const professores = [
      { id: 'p2', nome: 'Rafael Menezes', ativo: true },
      { id: 'p1', nome: 'Ana Souza' },
      { id: 'p3', nome: 'Carlos Antigo', ativo: false },
    ];
    expect(opcoesDeProfessor(professores, null)).toEqual([
      { value: '', label: SEM_PROFESSOR },
      { value: 'p1', label: 'Ana Souza' },
      { value: 'p2', label: 'Rafael Menezes' },
    ]);
  });

  it('o professor da linha continua na lista, mesmo inativo ou fora do cadastro', () => {
    const professores = [{ id: 'p3', nome: 'Carlos Antigo', ativo: false }];
    expect(opcoesDeProfessor(professores, 'p3').at(-1)).toEqual({ value: 'p3', label: 'Carlos Antigo (inativo)' });
    expect(opcoesDeProfessor([], 'sumiu').at(-1)).toEqual({ value: 'sumiu', label: 'Professor fora do cadastro' });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.configuracoes.test.js`
Expected: FAIL, `Error: Cannot find module '../faltosos/configuracoes.js' imported from .../src/lib/__tests__/faltosos.configuracoes.test.js`, com `Tests  no tests`.

- [ ] **Step 4: Implementar as regras do bloco**

Criar `src/lib/faltosos/configuracoes.js`:

```js
// As contas do bloco Faltosos de Configurações → Metas & ritmo (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações"): os marcos de falta, a janela do urgente e a troca do
// professor ligado a cada nome da Next Fit. A leitura do documento
// stronix_config/faltosos mora em ./configFaltosos.js, e a regra dos marcos que
// vale na importação, em ./marcos.js (normalizarMarcos). Aqui ficam só as
// regras de editar, com o texto que a tela mostra. Puro: sem React e sem
// Firebase.

import { isActiveProfessor } from '../teamRoles.js';

export const MARCOS_MAX = 6;
export const DIAS_MIN = 1;
export const DIAS_MAX = 365;

export const MENSAGENS_DO_BLOCO = Object.freeze({
  marcoForaDoLimite: `Informe um número inteiro de dias entre ${DIAS_MIN} e ${DIAS_MAX}.`,
  marcoRepetido: (n) => `O marco de ${n} ${n === 1 ? 'dia' : 'dias'} já existe.`,
  marcosDemais: `São no máximo ${MARCOS_MAX} marcos.`,
  marcoUltimo: 'Mantenha ao menos um marco de falta.',
  janelaForaDoLimite: `Informe um número inteiro de dias entre ${DIAS_MIN} e ${DIAS_MAX}.`,
});

const inteiroNoLimite = (n) => Number.isInteger(n) && n >= DIAS_MIN && n <= DIAS_MAX;

// Texto de um campo numérico para número. Vazio, espaço e texto que não é
// número dão NaN, que nenhum limite aceita.
const numeroDoCampo = (valor) => {
  if (typeof valor === 'number') return valor;
  const texto = String(valor ?? '').trim();
  return texto === '' ? NaN : Number(texto);
};

// Marco novo, pela regra da spec: de 1 a 6 números de 1 a 365, sem repetir.
// Devolve { marcos } com a lista nova em ordem crescente, ou { erro } com o
// texto para a tela.
export function adicionarMarco(marcos, valor) {
  const atuais = Array.isArray(marcos) ? marcos : [];
  const n = numeroDoCampo(valor);
  if (!inteiroNoLimite(n)) return { erro: MENSAGENS_DO_BLOCO.marcoForaDoLimite };
  if (atuais.includes(n)) return { erro: MENSAGENS_DO_BLOCO.marcoRepetido(n) };
  if (atuais.length >= MARCOS_MAX) return { erro: MENSAGENS_DO_BLOCO.marcosDemais };
  return { marcos: [...atuais, n].sort((a, b) => a - b) };
}

// Tira um marco. O último fica, porque sem marco nenhum ninguém vira tarefa.
export function removerMarco(marcos, n) {
  const atuais = Array.isArray(marcos) ? marcos : [];
  const restantes = atuais.filter((m) => m !== n);
  if (restantes.length === 0) return { erro: MENSAGENS_DO_BLOCO.marcoUltimo };
  return { marcos: restantes };
}

// Janela do urgente: inteiro de 1 a 365 dias.
export function validarJanelaUrgente(valor) {
  const n = numeroDoCampo(valor);
  return inteiroNoLimite(n) ? { dias: n } : { erro: MENSAGENS_DO_BLOCO.janelaForaDoLimite };
}

const ligacaoValida = (l) => Boolean(l) && typeof l.nome === 'string' && l.nome.trim() !== '';
const idOuNull = (id) => (typeof id === 'string' && id.trim() ? id : null);

// Troca o professor ligado a um nome da Next Fit e devolve a lista inteira,
// na mesma ordem, para gravar (professorLinks é lista: o set com merge troca a
// lista toda). Texto vazio é "Sem professor" (null). Nome que não está na
// lista não entra: a lista só cresce pela importação.
export function trocarLigacaoProfessor(links, nome, professorId) {
  const id = idOuNull(professorId);
  return (Array.isArray(links) ? links : [])
    .filter(ligacaoValida)
    .map((l) => ({ nome: l.nome, professorId: l.nome === nome ? id : idOuNull(l.professorId) }));
}

const porNome = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });

// As ligações em ordem de nome, para a tela, sem ligar para acento e caixa.
export const ligacoesEmOrdem = (links) => (Array.isArray(links) ? links : [])
  .filter(ligacaoValida)
  .slice()
  .sort((a, b) => porNome(a.nome, b.nome));

// Opções da escolha de professor de uma linha: "Sem professor" primeiro e os
// ativos do cadastro em ordem de nome. O professor que a linha já tem continua
// na lista mesmo inativo ou fora do cadastro, para a escolha mostrar o valor
// de verdade.
export const SEM_PROFESSOR = 'Sem professor';
export function opcoesDeProfessor(professores, atualId = null) {
  const lista = (Array.isArray(professores) ? professores : []).filter((p) => p && typeof p.id === 'string' && p.id);
  const ativos = lista.filter(isActiveProfessor).sort((a, b) => porNome(a.nome, b.nome));
  const opcoes = [{ value: '', label: SEM_PROFESSOR }, ...ativos.map((p) => ({ value: p.id, label: p.nome || 'Professor sem nome' }))];
  if (atualId && !ativos.some((p) => p.id === atualId)) {
    const atual = lista.find((p) => p.id === atualId);
    opcoes.push({ value: atualId, label: atual ? `${atual.nome || 'Professor sem nome'} (inativo)` : 'Professor fora do cadastro' });
  }
  return opcoes;
}
```

Esse arquivo tem `professorId` como chave, e a varredura do histórico do professor reprova arquivo novo assim até ele ser revisado. Ele não grava o professor do lead. Em `src/lib/__tests__/historicoDoProfessor.sweep.test.js`, trocar:

```js
  'src/lib/faltosos/passosImportacao.js': 'escolhas da ligação dos professores na janela',
};
```

por:

```js
  'src/lib/faltosos/passosImportacao.js': 'escolhas da ligação dos professores na janela',
  'src/lib/faltosos/configuracoes.js': 'troca da ligação de um professor da Next Fit',
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.configuracoes.test.js`
Expected: PASS, `Tests  13 passed (13)`.

Run: `npx eslint src/lib/faltosos/configuracoes.js src/lib/__tests__/faltosos.configuracoes.test.js`
Expected: nenhuma saída.

- [ ] **Step 6: Commit das regras do bloco**

```bash
git add src/lib/faltosos/configuracoes.js src/lib/__tests__/faltosos.configuracoes.test.js src/lib/__tests__/historicoDoProfessor.sweep.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: regras de edição do bloco Faltosos de Metas e ritmo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Escrever o teste do bloco**

Criar `src/lib/__tests__/faltososPanel.test.js`:

```js
// @vitest-environment jsdom
// O bloco Faltosos de Configurações → Metas & ritmo (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações"): só para o gestor, com o módulo ligado e com a configuração
// do módulo já lida; a última importação, como exportar e o botão que abre a
// janela de importação; marcos de 1 a 6 números de 1 a 365 sem repetir, janela
// do urgente e a troca do professor de cada nome da Next Fit. Grava
// stronix_config/faltosos com merge. Sem Firebase de verdade, e a janela de
// importação vira um marcador.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDoc } from 'firebase/firestore';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'academia-teste',
  CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos',
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  setDoc: vi.fn(async () => {}),
  serverTimestamp: () => 'agora',
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
vi.mock('../../views/faltosos/importacao/ImportarPlanilhasDialog.jsx', async () => {
  const { createElement } = await import('react');
  return {
    ImportarPlanilhasDialog: ({ onClose }) => createElement('div', { 'data-janela-importacao': '' },
      createElement('button', { type: 'button', onClick: onClose }, 'Fechar a janela')),
  };
});

const { FaltososPanel } = await import('../../views/settings/FaltososPanel.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Lê o PaceSection.jsx pelo caminho relativo a este teste. No jsdom o new URL
// resolve contra a base http do jsdom, então o caminho sai do import.meta.url
// como texto, como no tenantModulesCard.test.js.
const AQUI = dirname(fileURLToPath(import.meta.url));

const PROFESSORES = [
  { id: 'prof-rafa', nome: 'Rafael Menezes', ativo: true },
  { id: 'prof-lu', nome: 'Luana Prado' },
  { id: 'prof-velho', nome: 'Carlos Antigo', ativo: false },
];
// A configuração como o App entrega no contexto, já lida e normalizada.
const CONFIG = {
  marcos: [7, 14, 30, 60],
  janelaUrgenteDias: 90,
  professorLinks: [
    { nome: 'RAFAEL MENEZES', professorId: 'prof-rafa' },
    { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
    { nome: 'CARLOS ANTIGO', professorId: 'prof-velho' },
  ],
  ultimaImportacao: null,
  pronta: true,
};
const CAMINHO = 'artifacts/academia-teste/public/data/stronix_config/faltosos';
// O login do gestor, com o módulo ligado na academia: é o que a SettingsView
// passa à PaceSection, que o entrega ao bloco.
const GESTOR = { id: 'g1', name: 'Bruno', role: 'admin', tenantId: 'academia-teste', tenantModules: ['faltosos'] };

let root = null;
async function montar({ valor = { professores: PROFESSORES, faltosos: CONFIG }, appUser = GESTOR } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: valor }, h(FaltososPanel, { db: {}, appUser })));
  });
}

beforeEach(() => {
  // 06/10/2026, meio-dia em Brasília: o lembrete de exportação conta até hoje.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T15:00:00Z'));
  setDoc.mockClear();
  for (const fn of Object.values(toast)) fn.mockClear();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function escrever(el, valor) {
  const ehSelect = el instanceof window.HTMLSelectElement;
  const proto = ehSelect ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event(ehSelect ? 'change' : 'input', { bubbles: true }));
  });
}
async function clicar(el) {
  await act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });
}
async function sair(el) {
  await act(async () => { el.focus(); el.blur(); await new Promise((r) => setTimeout(r, 0)); });
}
async function enviar(form) {
  await act(async () => { form.requestSubmit(); await new Promise((r) => setTimeout(r, 0)); });
}
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const marcos = () => [...document.querySelectorAll('[aria-labelledby="faltosos-marcos"] li')].map((li) => li.textContent.trim());
const gravado = () => setDoc.mock.calls.map(([ref, dados, opcoes]) => [ref.caminho, dados, opcoes]);
const campoDoMarco = () => document.querySelector('[role="dialog"] input[type="number"]');
const formDoMarco = () => document.querySelector('[role="dialog"] form');

describe('bloco Faltosos: quando aparece', () => {
  it('sem a configuração dos faltosos no contexto (sem o módulo), não desenha nada', async () => {
    await montar({ valor: { professores: PROFESSORES } });
    expect(document.body.textContent).toBe('');
  });

  it('antes de a configuração ser lida, não desenha nada', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, pronta: false } } });
    expect(document.body.textContent).toBe('');
  });

  it('sem o módulo no login, não desenha nada, mesmo com a configuração lida', async () => {
    await montar({ appUser: { ...GESTOR, tenantModules: [] } });
    expect(document.body.textContent).toBe('');
  });

  it('o bloco é só do gestor: o consultor, o professor e a sessão vazia não veem', async () => {
    for (const appUser of [{ ...GESTOR, role: 'consultant' }, { ...GESTOR, role: 'professor', professorId: 'prof-rafa' }, null]) {
      await montar({ appUser });
      expect(document.body.textContent, String(appUser?.role)).toBe('');
      await act(async () => { root.unmount(); });
      document.body.innerHTML = '';
    }
  });

  it('a leitura que falhou mostra só o aviso, sem o botão e sem os campos', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, erro: true } } });
    expect(document.querySelector('[role="alert"]').textContent).toBe('Não deu para ler a configuração dos faltosos. Recarregue a página.');
    expect(botao('Importar planilhas')).toBeUndefined();
    expect(marcos()).toEqual([]);
    expect(document.querySelector('input')).toBeNull();
  });

  it('com a configuração lida, mostra marcos, janela e professores', async () => {
    await montar();
    expect(document.querySelector('h3').textContent).toBe('Faltosos');
    expect(marcos()).toEqual(['7 dias', '14 dias', '30 dias', '60 dias']);
    expect(document.querySelector('input[aria-label="Janela do urgente, em dias"]').value).toBe('90');
    const nomes = [...document.querySelectorAll('select')].map((s) => s.getAttribute('aria-label'));
    expect(nomes).toEqual([
      'Professor ligado a CARLOS ANTIGO', 'Professor ligado a CONTROLE (NÃO ALTERAR)', 'Professor ligado a RAFAEL MENEZES',
    ]);
  });

  it('Metas & ritmo monta o bloco no fim da seção, com o login que a SettingsView passa', () => {
    const pace = readFileSync(join(AQUI, '../../views/settings/PaceSection.jsx'), 'utf8');
    expect(pace).toContain("import { FaltososPanel } from './FaltososPanel.jsx';");
    expect(pace).toContain('function PaceSection({ db, usersList, metaWeekdays, appUser }) {');
    expect(pace).toContain('<FaltososPanel db={db} appUser={appUser} />');
    const settings = readFileSync(join(AQUI, '../../views/settings/SettingsView.jsx'), 'utf8');
    expect(settings).toContain('<PaceSection db={db} usersList={usersList} metaWeekdays={metaWeekdays} appUser={appUser} />');
  });
});

describe('bloco Faltosos: importação', () => {
  const ULTIMA = {
    id: 'f2026-10-06_p2026-09-29_2026-10-05', dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29',
    periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' }, ultimoDiaPresencas: '2026-10-05',
    importadoEm: new Date('2026-10-06T12:12:00Z'), importadoPorNome: 'Johnny',
  };
  const textoDe = (id) => document.getElementById(id)?.closest('section')?.textContent ?? '';

  it('mostra a última importação: quando, quem, a data do Faltantes e o período do Presenças', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, ultimaImportacao: ULTIMA } } });
    expect(document.getElementById('faltosos-importacao').textContent).toBe('Última importação: 06/10 às 09:12, por Johnny');
    expect(textoDe('faltosos-importacao')).toContain('Faltantes de 06/10/2026 · Presenças de 29/09 a 05/10');
    expect(textoDe('faltosos-importacao')).toContain(
      'Como exportar da Next Fit. Faltantes: exporte com o filtro de 7 dias sem vir. Presenças: exporte de 06/10 até hoje.',
    );
  });

  it('antes da primeira importação, diz que não há nenhuma e como exportar', async () => {
    await montar();
    expect(document.getElementById('faltosos-importacao').textContent).toBe('Nenhuma importação ainda');
    expect(textoDe('faltosos-importacao')).toContain('Presenças: exporte a última semana, até hoje.');
  });

  it('o botão abre a janela, que só carrega nessa hora, e fechar a tira da tela', async () => {
    await montar();
    expect(document.querySelector('[data-janela-importacao]')).toBeNull();
    await act(async () => { botao('Importar planilhas').click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(document.querySelector('[data-janela-importacao]')).toBeTruthy();
    await act(async () => { botao('Fechar a janela').click(); });
    expect(document.querySelector('[data-janela-importacao]')).toBeNull();
  });
});

describe('bloco Faltosos: marcos', () => {
  it('Novo marco grava a lista em ordem, com merge', async () => {
    await montar();
    await clicar(botao('Novo marco'));
    await escrever(campoDoMarco(), '21');
    await enviar(formDoMarco());
    expect(gravado()).toEqual([[CAMINHO, { marcos: [7, 14, 21, 30, 60], updatedAt: 'agora' }, { merge: true }]]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('marco repetido ou vazio não grava e avisa', async () => {
    await montar();
    await clicar(botao('Novo marco'));
    await escrever(campoDoMarco(), '14');
    await enviar(formDoMarco());
    await escrever(campoDoMarco(), '');
    await enviar(formDoMarco());
    expect(setDoc).not.toHaveBeenCalled();
    expect(toast.warning.mock.calls.map(([t]) => t)).toEqual([
      'O marco de 14 dias já existe.', 'Informe um número inteiro de dias entre 1 e 365.',
    ]);
  });

  it('fora de 1 a 365 o próprio campo barra o envio, e nada é gravado', async () => {
    // min, max e step no campo: o navegador barra o envio antes, e o
    // adicionarMarco repete a regra para o valor que passar.
    await montar();
    await clicar(botao('Novo marco'));
    for (const valor of ['400', '0', '7.5']) {
      await escrever(campoDoMarco(), valor);
      await enviar(formDoMarco());
    }
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('com seis marcos, o Novo marco fica desligado', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, marcos: [7, 14, 21, 30, 45, 60] } } });
    expect(botao('Novo marco').disabled).toBe(true);
  });

  it('remover grava o resto, mas o último marco fica', async () => {
    await montar();
    await clicar(document.querySelector('button[aria-label="Remover o marco de 14 dias"]'));
    expect(gravado()).toEqual([[CAMINHO, { marcos: [7, 30, 60], updatedAt: 'agora' }, { merge: true }]]);
    await act(async () => { root.unmount(); });
    setDoc.mockClear();
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, marcos: [7] } } });
    await clicar(document.querySelector('button[aria-label="Remover o marco de 7 dias"]'));
    expect(setDoc).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Mantenha ao menos um marco de falta.');
  });

  it('a falha ao gravar os marcos avisa e deixa a janela aberta', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await clicar(botao('Novo marco'));
    await escrever(campoDoMarco(), '21');
    await enviar(formDoMarco());
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar os marcos de falta.');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

describe('bloco Faltosos: janela do urgente', () => {
  const campo = () => document.querySelector('input[aria-label="Janela do urgente, em dias"]');

  it('salva ao sair do campo e avisa que vale a partir da próxima importação', async () => {
    await montar();
    await escrever(campo(), '120');
    await sair(campo());
    expect(gravado()).toEqual([[CAMINHO, { janelaUrgenteDias: 120, updatedAt: 'agora' }, { merge: true }]]);
    expect(toast.success).toHaveBeenCalledWith('Urgente: contrato terminando em até 120 dias. Vale a partir da próxima importação.');
  });

  it('o mesmo valor não grava, e o inválido volta para o salvo', async () => {
    await montar();
    await sair(campo());
    expect(setDoc).not.toHaveBeenCalled();
    await escrever(campo(), '0');
    await sair(campo());
    expect(setDoc).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Informe um número inteiro de dias entre 1 e 365.');
    expect(campo().value).toBe('90');
  });
});

describe('bloco Faltosos: professores da Next Fit', () => {
  const escolha = (nome) => document.querySelector(`select[aria-label="Professor ligado a ${nome}"]`);
  const opcoes = (select) => [...select.options].map((o) => o.textContent);

  it('cada nome mostra o professor ligado, e as opções são Sem professor e os ativos', async () => {
    await montar();
    expect(escolha('RAFAEL MENEZES').value).toBe('prof-rafa');
    expect(escolha('CONTROLE (NÃO ALTERAR)').value).toBe('');
    expect(opcoes(escolha('RAFAEL MENEZES'))).toEqual(['Sem professor', 'Luana Prado', 'Rafael Menezes']);
    // O inativo continua aparecendo na linha que já está ligada a ele.
    expect(escolha('CARLOS ANTIGO').value).toBe('prof-velho');
    expect(opcoes(escolha('CARLOS ANTIGO')).at(-1)).toBe('Carlos Antigo (inativo)');
  });

  it('trocar grava a lista inteira com só aquele nome mudado, e vale na próxima importação', async () => {
    await montar();
    await escrever(escolha('RAFAEL MENEZES'), 'prof-lu');
    expect(gravado()).toEqual([[CAMINHO, {
      professorLinks: [
        { nome: 'RAFAEL MENEZES', professorId: 'prof-lu' },
        { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
        { nome: 'CARLOS ANTIGO', professorId: 'prof-velho' },
      ],
      updatedAt: 'agora',
    }, { merge: true }]]);
    expect(toast.success).toHaveBeenCalledWith('Ligação salva. Vale a partir da próxima importação.');
  });

  it('Sem professor grava null', async () => {
    await montar();
    await escrever(escolha('RAFAEL MENEZES'), '');
    expect(gravado()[0][1].professorLinks[0]).toEqual({ nome: 'RAFAEL MENEZES', professorId: null });
  });

  it('antes da primeira importação, diz de onde os nomes vêm', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, professorLinks: [] } } });
    expect(document.querySelector('select')).toBeNull();
    expect(document.body.textContent).toContain('Os nomes aparecem aqui depois da primeira importação do relatório Faltantes.');
  });

  it('a falha ao gravar avisa', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await escrever(escolha('RAFAEL MENEZES'), 'prof-lu');
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar a ligação do professor.');
  });

  it('os textos da tela não têm travessão nem aspas curvas', async () => {
    await montar();
    expect(document.body.textContent).not.toMatch(/[—–“”‘’]/);
  });
});
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltososPanel.test.js`
Expected: FAIL, `Error: Failed to resolve import "../../views/settings/FaltososPanel.jsx" from "src/lib/__tests__/faltososPanel.test.js". Does the file exist?`, com `Tests  no tests`.

- [ ] **Step 9: O bloco**

Criar `src/views/settings/FaltososPanel.jsx`:

```jsx
import { lazy, Suspense, useState } from 'react';
import { AlertTriangle, CalendarX, FileSpreadsheet, Plus, Upload, X } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appId, CONFIG_PATH, CONFIG_FALTOSOS_ID } from '../../lib/firebase.js';
import { configDasTelas } from '../../lib/faltosos/configFaltosos.js';
import { hojeEmBrasilia } from '../../lib/faltosos/dias.js';
import { importaFaltosos, lembreteExportacao, resumoDaUltimaImportacao } from '../../lib/faltosos/abaFaltosos.js';
import {
  MARCOS_MAX, adicionarMarco, removerMarco, validarJanelaUrgente, trocarLigacaoProfessor,
  ligacoesEmOrdem, opcoesDeProfessor,
} from '../../lib/faltosos/configuracoes.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsPanel } from '../../components/ui/SettingsCard.jsx';
import { DialogField, EmptyState, FIELD_INPUT, FormDialog, PanelNote, SettingsBtn } from './settingsBits.jsx';

// A janela de importação só carrega quando o gestor abre: ela traz o motor da
// importação e a gravação, e a gravação lê os caminhos do Firestore já ao
// carregar o arquivo. Com import direto, todo teste que troca o firebase.js por
// um dublê sem esses caminhos e monta este bloco quebraria, a começar pelo
// faltososPanel.test.js.
const ImportarPlanilhasDialog = lazy(() => import('../faltosos/importacao/ImportarPlanilhasDialog.jsx')
  .then((m) => ({ default: m.ImportarPlanilhasDialog })));

// Bloco "Faltosos" de Configurações → Metas & ritmo (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações", e docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md,
// "2A: a importação"). Grava stronix_config/faltosos com merge, um campo por
// vez, como o resto de Metas & ritmo grava o "general": a tela muda quando a
// assinatura do App.jsx traz o documento de volta.
//
// - Importação: a última (quando, quem, a data do Faltantes e o período do
//   Presenças), como exportar da Next Fit e o botão "Importar planilhas", que
//   abre a janela de importação.
// - Marcos de falta: de 1 a 6 números de dias, de 1 a 365, sem repetir.
// - Janela do urgente: em dias.
// - Professores da Next Fit: cada nome que já veio no Faltantes, com o
//   professor do cadastro ligado a ele, para trocar. A lista só cresce pela
//   importação.
//
// Tudo vale a partir da próxima importação. Os alunos já importados ficam com
// o professor, o marco e o urgente que tinham até lá.
//
// Quem vê: o gestor, com o módulo ligado (importaFaltosos, pelo appUser que a
// SettingsView passa à PaceSection), e só com a configuração já lida (o
// `pronta`, que o App liga quando a assinatura de stronix_config/faltosos
// traz o documento, no GeneralConfigContext). Antes da leitura o bloco não
// aparece, para ninguém editar em cima do padrão e gravar por cima do que a
// academia já tem. Leitura que falhou (`erro`) mostra só o aviso, sem botão:
// o bloco não sabe a última importação nem o que está salvo. Por fora,
// Configurações só abre para o gestor (trava `gestor` de SCREENS.settings), e
// as regras só deixam o gestor gravar em stronix_config.
export function FaltososPanel({ db, appUser }) {
  const toast = useToast();
  const { professores, faltosos } = useGeneralConfig();
  const { marcos, janelaUrgenteDias, professorLinks, ultimaImportacao, pronta, erro } = configDasTelas(faltosos);
  const [novoMarcoAberto, setNovoMarcoAberto] = useState(false);
  const [novoMarco, setNovoMarco] = useState('');
  const [gravando, setGravando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [hojeDia] = useState(() => hojeEmBrasilia());

  if (!importaFaltosos(appUser) || !pronta) return null;

  if (erro) {
    return (
      <SettingsPanel icon={<CalendarX size={16} />} iconTone="amber" title="Faltosos">
        <p role="alert" className="flex items-start gap-2 px-5 py-4 border-t border-border text-[12.5px] text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>Não deu para ler a configuração dos faltosos. Recarregue a página.</span>
        </p>
      </SettingsPanel>
    );
  }

  // A ref é montada na hora de gravar, não no render: render não toca no SDK.
  const salvar = (campos) => setDoc(
    doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID),
    { ...campos, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const gravarMarcos = async (lista) => {
    setGravando(true);
    try {
      await salvar({ marcos: lista });
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os marcos de falta.');
      return false;
    } finally {
      setGravando(false);
    }
  };

  const incluirMarco = async () => {
    const r = adicionarMarco(marcos, novoMarco);
    if (r.erro) { toast.warning(r.erro); return; }
    if (await gravarMarcos(r.marcos)) {
      setNovoMarco('');
      setNovoMarcoAberto(false);
    }
  };

  const tirarMarco = async (n) => {
    const r = removerMarco(marcos, n);
    if (r.erro) { toast.warning(r.erro); return; }
    await gravarMarcos(r.marcos);
  };

  // Salva ao sair do campo, como a meta de prospecção. Valor inválido volta
  // para o salvo.
  const salvarJanela = async (campo) => {
    const r = validarJanelaUrgente(campo.value);
    if (r.erro) {
      toast.warning(r.erro);
      campo.value = String(janelaUrgenteDias);
      return;
    }
    if (r.dias === janelaUrgenteDias) return;
    try {
      await salvar({ janelaUrgenteDias: r.dias });
      toast.success(`Urgente: contrato terminando em até ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}. Vale a partir da próxima importação.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a janela do urgente.');
      campo.value = String(janelaUrgenteDias);
    }
  };

  const trocarProfessor = async (nome, professorId) => {
    try {
      await salvar({ professorLinks: trocarLigacaoProfessor(professorLinks, nome, professorId) });
      toast.success('Ligação salva. Vale a partir da próxima importação.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a ligação do professor.');
    }
  };

  const ligacoes = ligacoesEmOrdem(professorLinks);
  const umDia = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
  const resumo = resumoDaUltimaImportacao(ultimaImportacao);
  const lembrete = lembreteExportacao({ marcos, ultimaImportacao, hojeDia });

  return (
    <>
      <SettingsPanel
        icon={<CalendarX size={16} />}
        iconTone="amber"
        title="Faltosos"
        hint="A importação das planilhas da Next Fit e as regras da lista de faltosos que ela monta para cada professor."
        action={(
          <SettingsBtn kind="primary" icon={<Upload size={13} />} onClick={() => setImportando(true)}>
            Importar planilhas
          </SettingsBtn>
        )}
      >
        <section aria-labelledby="faltosos-importacao" className="flex items-start gap-3 px-5 py-4 border-t border-border">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
            <FileSpreadsheet size={16} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h4 id="faltosos-importacao" className="text-[13px] font-semibold">
              {resumo ? `Última importação: ${resumo.quando}` : 'Nenhuma importação ainda'}
            </h4>
            {resumo && <p className="text-[11.5px] text-muted-foreground">{resumo.faltantes} · {resumo.presencas}</p>}
            <p className="text-[11.5px] text-muted-foreground max-w-[460px] text-pretty">
              Como exportar da Next Fit. {lembrete.faltantes} {lembrete.presencas}
            </p>
          </div>
        </section>

        <section aria-labelledby="faltosos-marcos" className="flex flex-col gap-3 px-5 py-4 border-t border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h4 id="faltosos-marcos" className="text-[13px] font-semibold">Marcos de falta</h4>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
                Dias sem vir em que o aluno vira tarefa de contato para o professor. Cada marco vale um contato. Depois do último, o aluno fica só na lista de acompanhamento.
              </p>
            </div>
            <SettingsBtn
              kind="dashed"
              size={34}
              icon={<Plus size={13} />}
              onClick={() => setNovoMarcoAberto(true)}
              disabled={marcos.length >= MARCOS_MAX}
              title={marcos.length >= MARCOS_MAX ? `São no máximo ${MARCOS_MAX} marcos.` : undefined}
            >
              Novo marco
            </SettingsBtn>
          </div>
          <ul className="flex flex-wrap gap-2">
            {marcos.map((n) => (
              <li key={n} className="inline-flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-[10px] bg-card border border-border text-[13px] font-semibold">
                <span className="num">{umDia(n)}</span>
                <button
                  type="button"
                  onClick={() => tirarMarco(n)}
                  disabled={gravando}
                  title={`Remover o marco de ${umDia(n)}`}
                  aria-label={`Remover o marco de ${umDia(n)}`}
                  className="size-5 grid place-items-center rounded-md text-muted-foreground transition hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-40 focus-visible:outline-none focus-visible:anel-foco"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faltosos-janela" className="flex items-center justify-between gap-4 flex-wrap px-5 py-4 border-t border-border">
          <div className="min-w-0">
            <h4 id="faltosos-janela" className="text-[13px] font-semibold">Janela do urgente</h4>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
              O aluno faltando vira urgente quando o contrato termina dentro desse prazo, e sobe para o topo da lista do professor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              key={janelaUrgenteDias}
              type="number" min="1" max="365" step="1"
              defaultValue={janelaUrgenteDias}
              aria-label="Janela do urgente, em dias"
              onBlur={(e) => salvarJanela(e.currentTarget)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-[88px] h-9 px-3 rounded-[10px] text-[12.5px] num text-center bg-muted/60 border border-border outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
            />
            <span className="text-[12.5px] text-muted-foreground">dias</span>
          </div>
        </section>

        <section aria-labelledby="faltosos-professores" className="border-t border-border">
          <div className="px-5 pt-4 pb-2">
            <h4 id="faltosos-professores" className="text-[13px] font-semibold">Professores da Next Fit</h4>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
              Cada nome que vem no relatório Faltantes aponta para um professor do cadastro. Com Sem professor, os alunos ficam com o gestor.
            </p>
          </div>
          {ligacoes.length === 0 ? (
            <EmptyState>Os nomes aparecem aqui depois da primeira importação do relatório Faltantes.</EmptyState>
          ) : (
            <ul className="flex flex-col">
              {ligacoes.map((l) => (
                <li key={l.nome} className="flex items-center gap-3 px-5 py-2.5 border-t border-border first:border-t-0">
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium" title={l.nome}>{l.nome}</span>
                  <select
                    value={l.professorId ?? ''}
                    onChange={(e) => trocarProfessor(l.nome, e.target.value)}
                    aria-label={`Professor ligado a ${l.nome}`}
                    className={cn(FIELD_INPUT, 'w-[220px] max-w-[55%] h-9')}
                  >
                    {opcoesDeProfessor(professores, l.professorId).map((o) => (
                      <option key={o.value || 'sem'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PanelNote>Tudo aqui vale a partir da próxima importação. Os alunos já importados ficam como estão até lá.</PanelNote>
      </SettingsPanel>

      <FormDialog
        open={novoMarcoAberto}
        onOpenChange={(v) => { setNovoMarcoAberto(v); if (!v) setNovoMarco(''); }}
        title="Novo marco de falta"
        description="Com quantos dias sem vir o aluno vira tarefa de contato."
        submitLabel="Adicionar marco"
        submitting={gravando}
        onSubmit={incluirMarco}
      >
        <DialogField label="Dias sem vir" hint="Entre 1 e 365.">
          <input
            className={cn(FIELD_INPUT, 'num')}
            type="number" min={1} max={365} step={1} autoFocus
            value={novoMarco}
            onChange={(e) => setNovoMarco(e.target.value)}
            placeholder="ex: 21"
          />
        </DialogField>
      </FormDialog>

      {importando && (
        <Suspense fallback={null}>
          <ImportarPlanilhasDialog appUser={appUser} db={db} onClose={() => setImportando(false)} />
        </Suspense>
      )}
    </>
  );
}
```

- [ ] **Step 10: Montar o bloco em Metas & ritmo (`src/views/settings/PaceSection.jsx` e `src/views/settings/SettingsView.jsx`)**

Em `src/views/settings/PaceSection.jsx`, trocar a linha 13:

```js
import { DG_WEEKDAY_NAMES } from '../DailyGoalView.jsx';
```

por:

```js
import { DG_WEEKDAY_NAMES } from '../DailyGoalView.jsx';
import { FaltososPanel } from './FaltososPanel.jsx';
```

Em `src/views/settings/PaceSection.jsx`, trocar as linhas 15 a 17:

```js
// Metas & ritmo — as regras que decidem o que aparece na Meta Diária e quando
// um lead vira urgente. Três blocos de configuração da academia (dias, SLA e
// marcos de renovação) mais o piso individual de prospecção.
```

por:

```js
// Metas & ritmo: as regras que decidem o que aparece na Meta Diária e quando
// um lead vira urgente. Três blocos de configuração da academia (dias, SLA e
// marcos de renovação) mais o piso individual de prospecção. Com o módulo
// Professor e faltosos, entra no fim o bloco Faltosos (FaltososPanel), que
// grava outro documento, o stronix_config/faltosos.
```

Em `src/views/settings/PaceSection.jsx`, trocar a linha 76:

```jsx
function PaceSection({ db, usersList, metaWeekdays }) {
```

por:

```jsx
function PaceSection({ db, usersList, metaWeekdays, appUser }) {
```

Em `src/views/settings/PaceSection.jsx`, trocar as linhas 361 a 364:

```jsx
      </SettingsPanel>

      <FormDialog
        open={checkpointOpen}
```

por:

```jsx
      </SettingsPanel>

      {/* Bloco Faltosos: só aparece para o gestor, com o módulo Professor e
          faltosos ligado e com a configuração dele já lida (FaltososPanel). */}
      <FaltososPanel db={db} appUser={appUser} />

      <FormDialog
        open={checkpointOpen}
```

Em `src/views/settings/SettingsView.jsx`, trocar a linha 173 (a única que monta a `PaceSection`):

```jsx
          <PaceSection db={db} usersList={usersList} metaWeekdays={metaWeekdays} />
```

por:

```jsx
          <PaceSection db={db} usersList={usersList} metaWeekdays={metaWeekdays} appUser={appUser} />
```

- [ ] **Step 11: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltososPanel.test.js`
Expected: PASS, `Tests  24 passed (24)`.

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/settingsRail.test.js src/lib/__tests__/anelDeFoco.test.js src/lib/__tests__/focusRing.test.js`
Expected: PASS, `Test Files  5 passed (5)` e `Tests  37 passed (37)`. A `PaceSection` continua na lista de quem passa pelo `isSeller`, e o bloco não lista pessoas da equipe.

Run: `npx vitest run 2>&1 | tail -5`
Expected: todos passando, `Test Files  384 passed (384)` e `Tests  7345 passed (7345)`.

Run: `npx eslint src/views/settings/FaltososPanel.jsx src/views/settings/PaceSection.jsx src/views/settings/SettingsView.jsx src/lib/__tests__/faltososPanel.test.js`
Expected: nenhuma saída.

Run: `npm run build 2>&1 | grep -E "ImportarPlanilhasDialog|built in"`
Expected: uma linha `dist/assets/ImportarPlanilhasDialog-<hash>.js` (uns 53 kB) e `✓ built in`.

- [ ] **Step 12: Commit do bloco**

```bash
git add src/views/settings/FaltososPanel.jsx src/views/settings/PaceSection.jsx src/views/settings/SettingsView.jsx src/lib/__tests__/faltososPanel.test.js
git -c user.name="Johnny Bittencourt" commit -m "feat: bloco Faltosos em Configurações, com a importação das planilhas da Next Fit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: CLAUDE.md do Stronilead (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md` (o do Stronilead, na raiz do worktree)

O `CLAUDE.md` é a memória do projeto: cada regra nova deste PR entra nele, no lugar indicado. Os textos abaixo vieram da Task 14 do plano antigo, reduzidos ao que o 2A entrega, e foram conferidos contra o código que a reaplicação deste plano gerou. Escreva no tom do arquivo, com frases diretas e sem travessão no meio da frase. O 2B e o 2C acrescentam o endereço da aba, a Meta do professor e as peças da ficha, cada um no seu PR.

- [ ] **Step 1: Conferir os travessões de hoje**

Run: `grep -c "—" CLAUDE.md`
Expected: `11` em `e8423e2`. Anote o número. O Step 4 confere que ele não mudou.

- [ ] **Step 2: Convenções gerais**

Em `CLAUDE.md`, em "## Convenções gerais", logo depois do item "As travas do professor no `firestore.rules`:" e das linhas de dentro dele, antes do item que começa com "`role` e `professorId` de `stronix_users`", acrescentar:

```markdown
- As coleções do módulo `faltosos` no `firestore.rules` (PR 2): `stronix_faltosos` e `stronix_presencas` todo membro lê, com o módulo ligado; `stronix_importacoes_nextfit` e `stronix_nextfit_alunos` só o gestor lê. Gravar, nas quatro, é só do gestor com o módulo ligado, e o navegador não apaga nada. O `stronix_presencas` já existia, da aderência do perfil do professor, e era gravado só pelo script, que saiu. `stronix_config/faltosos` segue a regra de `stronix_config`. A linha "Voltou a treinar" (`presence_return`) o gestor cria, regrava e apaga como qualquer interação, e o professor não cria, porque o tipo não está em `professorInteractionTypes()`. O `src/lib/__tests__/faltososRules.test.js` cobra isso. O professor marcar a tarefa (PR 3) entra como condição na linha de update de `stronix_faltosos`, nunca numa segunda linha `allow`.
```

- [ ] **Step 3: Seção nova "Faltosos e importação da Next Fit"**

Em `CLAUDE.md`, logo depois da seção `## Professor` e antes de `## Rotinas dos consultores`, acrescentar a seção abaixo, seguida de uma linha em branco:

```markdown
## Faltosos e importação da Next Fit

A importação semanal dos relatórios Faltantes e Presenças da Next Fit, do módulo `faltosos` (ver "Módulos da academia" e "Professor"). Spec em `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md`, divisão do PR 2 em três partes em `docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md` e plano do 2A em `docs/superpowers/plans/2026-11-26-professor-pr2a-importacao.md`. O 2A traz a importação, o bloco Faltosos de Configurações → Metas & ritmo e a linha "Voltou a treinar" da ficha. A aba Faltosos de Clientes é o 2B, e o selo e a aba Presenças da ficha são o 2C. Tudo só existe com o módulo ligado: sem ele, o bloco não aparece, nada é lido e as regras recusam. A linha "Voltou a treinar" já gravada é uma interação e continua na ficha.

### O motor (puro)

- **O motor é puro e mora em `src/lib/faltosos/`**: `dias.js`, `nextfitArquivos.js`, `ligacaoAlunos.js`, `ligacaoProfessores.js`, `marcos.js`, `urgente.js`, `configFaltosos.js` e `planoImportacao.js`. Nenhum chega a pacote, ao `firebase.js`, à Meta Diária (`dailyGoal.js`), ao `interactions.js` nem a componente, e o `src/lib/__tests__/faltosos.imports.test.js` segue os imports e cobra isso. Os únicos arquivos da pasta que tocam o Firestore são o `lerImportacao.js` (a leitura da base, na janela de importação) e o `gravarImportacao.js` (a gravação). Módulo novo da pasta que precise ser puro entra na lista da varredura.
- **Dia é texto `AAAA-MM-DD` do calendário de Brasília** (`dias.js`). A conta entre dias é feita sobre o texto, com `Date.UTC`; "hoje" e o fim do contrato passam por `api/_horarioDeBrasilia.js`. Fora da célula de data do SheetJS, que chega como `Date` e é lida pelos getters locais, nada nos faltosos lê `getDate()` nem meia-noite local. O `faltosos.urgente.test.js` põe o processo em UTC.
- **O arquivo é reconhecido pelo cabeçalho** (`detectReport`): precisa ter todas as colunas do Faltantes ou do Presenças, sem olhar caixa, acento, espaço, ordem nem coluna a mais. O cabeçalho vem na primeira linha (planilhas de 02/10/2026). A data chega como texto, como `Date` do SheetJS (lida pelos getters locais) ou como número de série do Excel. A data do Faltantes é a última presença mais a quantidade de ausências; vale o dia da maioria das linhas, e a prévia avisa das outras.
- **`nomeChave`** (sem acento, minúsculo, só `[a-z0-9 ]`, espaço único) mora em `nextfitArquivos.js` e sai também por `ligacaoAlunos.js`. Ela compara cabeçalho e nomes e é o id dos documentos de `stronix_nextfit_alunos`: mudar a regra muda o id dos nomes já guardados.
- **Ligação dos alunos.** Faltantes pelo telefone (`zapMatchKey` do aluno e do responsável), e o telefone só liga com o nome conferindo (`nomeConfere`: primeiro nome igual ou duas palavras em comum, sem "de", "da", "do", "das", "dos" e "e"). Assim o número da mãe que é cliente não liga o filho a ela. Sem nome que decida, a linha fica ambígua para a prévia ligar à mão, e a ligação à mão vale quando o telefone não decide. O nome guardado pelo telefone só liga no Presenças, que liga pelo nome: guardado primeiro, depois o nome igual entre os clientes.
- **`professorLinks` é lido só por `normalizarProfessorLinks`** (`ligacaoProfessores.js`, reexportada por `configFaltosos.js`): um item por chave de nome, a última escolha vale, em ordem de nome, e `professorId: null` é "Sem professor". A sugestão do passo curto aceita o começo do nome porque a Next Fit corta o nome do professor em 29 caracteres.
- **`stronix_config/faltosos` é lido só por `normalizarConfigFaltosos`** (`configFaltosos.js`). `ultimaImportacao` sem `id` quer dizer "nunca houve importação". Ela guarda o último Faltantes (`dataFaltantes`), o E0 que ele usou (`dataFaltantesAnterior`, para a mesma data importada de novo dar o mesmo resultado), o último Presenças (entre dois, o que termina depois) e o maior dia de Presenças já importado (`ultimoDiaPresencas`, de onde sai o "Exporte de 06/10 até hoje"). Importação de um arquivo só repete os valores do outro. O id do documento (`CONFIG_FALTOSOS_ID`) mora em `src/lib/firebase.js`, com os quatro caminhos das coleções novas.
- **O urgente olha o fim do último contrato** (`urgente.js`, decidido no plano do PR 2, em 05/10/2026, e o Johnny pode mudar). Com a renovação marcada, é o fim da renovação, e quem renovou só fica urgente se a renovação também termina dentro da janela. O `inUseContractEndsAt` não é lido, porque o bloco "em uso" continua no lead depois que a renovação começa, e o `contracts.js` não mudou. A situação do contrato é a do `deriveLeadContractStatus`, no instante da importação (`agora`), igual a Clientes.
- **O plano (`planejarImportacao`) é puro e roda de novo** a cada escolha do passo curto, a cada ligação à mão e logo antes de gravar. Ele devolve só o que muda, então a mesma importação duas vezes não grava nada.
- **A última presença conhecida** é a maior entre a do Faltantes, a de qualquer dia do Presenças até a data do Faltantes e a guardada. A presença da agenda que o Faltantes não viu fecha o período antigo e abre outro a partir dela, ou nenhum, quando é recente (menos dias que o menor marco).
- **A tarefa é do período** (`tarefa.inicioFalta`): a de um período anterior, mesmo fechada, não segura a do período novo. A pendente troca de marco no mesmo card; a fechada dá lugar a uma nova. O selo `tarefa.urgente` nunca sai, e é ele que faz o urgente criar tarefa uma vez só por período.
- **Uma linha de volta por aluno em cada importação**, a do período mais recente. O aluno que voltou, sumiu de novo e voltou outra vez entre duas importações fica só com a última volta, e a gravação recusa o plano com duas voltas do mesmo aluno.
- **A volta que não aconteceu é desfeita.** Quem saiu como "voltou" sem dia e aparece no Faltantes com a mesma última presença reabre o período, e o plano devolve o id da linha em `voltasDesfeitas` para a gravação apagar.
- **Telefone trocado no Stronilead.** O aluno faltando que deixou de ligar, sem presença e com contrato ativo, cujo nome está numa linha do Faltantes que não ligou (`clienteProvavel`), continua faltando e aparece na prévia como provável mesma pessoa, até a ligação à mão.
- **Trocar a ligação de um professor em Configurações vale na importação seguinte** (ou na mesma, refeita), e a tarefa pendente vai junto com o aluno. Os estados gravados não mudam na hora.
- **Os números da prévia que contam mudança** (entram no marco, voltaram, encerrados, urgentes novos) contam o que esta rodada muda. Os outros (faltando, urgentes, pendentes, acompanhamento, por professor) são o retrato depois da importação.

### A gravação

- **Plano, montagem e gravação.** O plano é puro (`src/lib/faltosos/planoImportacao.js`), a forma de cada gravação também (`src/lib/faltosos/lotesImportacao.js`), e quem grava é o `src/lib/faltosos/gravarImportacao.js`, no navegador do gestor, sem função na Vercel. A academia vem congelada de quem chama (a janela guarda na abertura), e o `appId` vivo nunca é lido.
- **Ids fixos.** Estado em `stronix_faltosos/{leadId}`, presença em `stronix_presencas/{leadId}_{AAAA-MM}`, linha da volta em `stronix_interactions/volta_{leadId}_{inicioFalta}` (`idDaVolta`), nome da Next Fit em `stronix_nextfit_alunos/{nomeChave}` e registro em `stronix_importacoes_nextfit/{id}`, com o id tirado das datas dos arquivos (`f2026-10-06`, `p2026-09-29_2026-10-05` ou os dois juntos, pelo `idDaImportacao`). Os dois ajudantes dos ids moram no `planoImportacao.js`. A mesma importação refeita cai nos mesmos documentos.
- **A ordem.** As ligações primeiro (a lista de professores, só quando muda, e os nomes da Next Fit), depois um aluno por unidade, que nunca se parte entre lotes (o estado, a linha "Voltou a treinar", a linha da volta desfeita, que é apagada, e os meses de presença), e por último, num lote só, o registro e a `ultimaImportacao`. Lotes de até 500. Se o estado virasse "voltou" e a linha ficasse num lote que falhou, a importação refeita não veria mais o aluno faltando e a linha se perderia.
- **Antes de gravar, o plano roda de novo.** A gravação lê do servidor o estado de todos os alunos e chama o `replanejar` da janela, que refaz o plano com os mesmos arquivos e ligações. É isso que o "Tentar de novo" usa para completar sem duplicar, e é o que vai guardar a tarefa que o professor fechar entre a prévia e o Confirmar (PR 3). O registro guarda os números da prévia confirmada.
- **Outra importação com a janela aberta.** Se a `ultimaImportacao` do servidor não é a que a janela leu na abertura, nem esta mesma importação, a gravação para sem gravar nada e devolve o erro `outra-importacao`, e a janela só deixa fechar.
- **Importação repetida.** Do registro só mudam os não ligados, `refeitaEm` e `refeitaPorNome`. Os números, quem importou e a `ultimaImportacao` ficam com os da primeira vez.
- **Os "Não achados" do registro** (`naoLigados`) são a lista `[{ nome, telefone, relatorio }]`, com o telefone só nas linhas do Faltantes, e é dela que a aba Faltosos do 2B vai ler. A prévia guarda as listas completas, para a ligação à mão.
- **A importação não grava no lead.** A volta a treinar não é contato: a linha não soma `lastInteractionAt` nem `interactionsCount`, não leva `volumeKind`, fica fora do "Já interagido hoje" (`hasActiveInteractionToday`) e do primeiro contato do Dashboard CRM (`isContactInteraction`). Na linha do tempo ela é o tipo `presence`, com o rótulo "Presença", no filtro Marcos e fora do interruptor de Sistema. O tipo mora em `src/lib/leads.js` (`PRESENCE_RETURN_TYPE`), e o `createdAt` é a hora da importação: o dia da volta vai no texto.
- **Presenças com merge.** O plano manda o mês inteiro, juntado com o que a janela leu, e o merge guarda os dias que outra gravação tenha posto no mês depois.
- **Erro do plano sem nome.** A montagem confere tudo antes do primeiro lote, e a mensagem cita a posição na lista ou o id do lead, nunca nome de aluno ou de professor, porque pode ir para o Sentry.

### A configuração, a janela e o bloco de Configurações

- **A configuração (`stronix_config/faltosos`)** é assinada pelo App no efeito de leitura de dados, só com o módulo, e chega pelo `GeneralConfigContext` como `faltosos`, normalizada pelo `normalizarConfigFaltosos`, com a academia junto (o "Acessar como" não herda a da anterior). `pronta` é false até a primeira leitura, e a leitura que falha deixa o padrão com `erro: true`, sem acender o aviso de carga. Fora do Provider, as telas usam o `configDasTelas`.
- **A importação roda no navegador**, na janela `src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx`, que o bloco Faltosos (`src/views/settings/FaltososPanel.jsx`) carrega com `React.lazy` só quando o gestor clica em "Importar planilhas". Não troque por import direto: o `gravarImportacao.js` lê os caminhos do `firebase.js` ao carregar, e o teste que troca o `firebase.js` por um dublê sem eles quebra (o `faltososPanel.test.js` hoje; no 2B, a aba vai abrir a mesma janela, e o `clientsProfessor.test.js` e o `listRowLinks.test.js` trocam o `firebase.js` assim). Os passos puros moram em `src/lib/faltosos/passosImportacao.js`, e `entradaDoPlano` é o único lugar que monta a entrada do `planejarImportacao`. A leitura (`lerImportacao.js`) é toda do servidor e da academia congelada na abertura. Nada é gravado antes do Confirmar, e a parada no meio tenta de novo com o mesmo envio.
- **Bloco Faltosos em Configurações → Metas & ritmo** (`src/views/settings/FaltososPanel.jsx`, montado no fim da `PaceSection`): a última importação (quando, quem, a data do Faltantes e o período do Presenças), como exportar da Next Fit e o botão "Importar planilhas", e depois os marcos de falta, a janela do urgente e o professor ligado a cada nome da Next Fit. Os textos da importação e o `importaFaltosos` moram em `src/lib/faltosos/abaFaltosos.js`, que o 2B completa com a aba. Grava `stronix_config/faltosos` um campo por vez, com merge, sem botão Salvar; `professorLinks` vai inteiro, porque é lista. As regras de editar moram em `src/lib/faltosos/configuracoes.js`, e o teste delas confere que a lista de marcos que sai do bloco é a que o `normalizarMarcos` da importação aceita. O bloco aparece pelo `importaFaltosos` (o módulo e o `isGestor`, pelo `appUser` que a `SettingsView` passa à `PaceSection`) e só com a configuração do módulo já lida (`pronta` no `faltosos` do contexto): antes da leitura ninguém edita em cima do padrão. A leitura que falhou (`erro`) mostra só "Não deu para ler a configuração dos faltosos. Recarregue a página.", sem o botão e sem os campos. Por fora, continuam a trava `gestor` de Configurações e as regras de `stronix_config`. A lista de nomes só cresce pela importação. Tudo vale a partir da próxima importação: os alunos já importados não mudam de professor, de marco nem de urgente na hora.
```

- [ ] **Step 3A: A aderência no "Perfil do professor"**

A Task 7A trocou de onde a aderência lê as presenças. Em `CLAUDE.md`, na seção "## Perfil do professor", trocar:

```markdown
  - **Aderência** (`aderencia.js`): o aluno conta na semana com contrato da modalidade vigente na segunda às 00:00, que já existia no fim da sexta anterior (assim a primeira semana fica fora e a renovação emendada não perde semana), sem nenhum dia trancado de segunda a sexta. Só entram semanas com registro importado e já acabadas, e aluno sem registro teve nenhuma presença. Sem nenhuma presença de aluno da turma em semana nenhuma, a aderência é "sem dados" (lista vazia), e não 0%: o relatório importado é só o das aulas de funcional, e os professores de musculação e de pilates apareciam com 0%. O `stronix_presencas` que o PR 6 grava precisa ter `leadId`, `semana` (`'AAAA-MM-DD'`, a segunda) e `presencas`.
```

por:

```markdown
  - **Aderência** (`aderencia.js`): o aluno conta na semana com contrato da modalidade vigente na segunda às 00:00, que já existia no fim da sexta anterior (assim a primeira semana fica fora e a renovação emendada não perde semana), sem nenhum dia trancado de segunda a sexta. Só entram semanas com registro importado e já acabadas, e aluno sem registro teve nenhuma presença. Sem nenhuma presença de aluno da turma em semana nenhuma, a aderência é "sem dados" (lista vazia), e não 0%. A presença da semana é o número de dias de segunda a sexta com presença, pela catraca ou pela agenda, em qualquer modalidade, que o `presencasPorSemana` tira dos documentos por mês da importação da Next Fit (ver "Faltosos e importação da Next Fit").
```

E, mais embaixo, no item "A aderência", trocar:

```markdown
  - **Importação:** `scripts/import-presencas.js` lê o relatório de Presenças da Next Fit (`.xlsx` ou `.csv`), soma as presenças de cada CPF por semana (segunda a sexta, só funcional, só presença) e grava `stronix_presencas/{leadId}_{segunda}` (`{ leadId, semana, presencas, fonte, arquivo, importadoEm }`). Sem `--apply` não grava nada. Pede `--de` e `--ate`, o período do relatório, e só grava as semanas inteiras dentro dele; regravar a semana troca o número, e o registro antigo de quem não tem mais presença numa semana que recebeu registro agora é apagado (`idsQueSobram`). As pendências levam o nome de cada CPF pelo relatório (`nomePorCpf`). O casamento é pelo `cpfDigits`: com mais de um lead, vale o cliente, e o que sobra (sem CPF, CPF sem lead, CPF em mais de um cadastro) vai para as pendências, que só saem num arquivo (`--pendencias=<caminho>`), nunca na tela. A leitura é pura, em `src/lib/professor/presencas.js`, e acha as colunas por apelido (`APELIDOS`), conferidos com o relatório "Presenças por contrato" de 25/11/2026 (Relatórios → Presenças, modalidade Treinamento Funcional, exportar para Excel). Esse relatório não traz CPF: o script recebe a lista de clientes da Next Fit (`--clientes=<exportação com Nome e CPF>`) e pega o CPF pelo nome exatamente como está cadastrado lá (`cpfPorNome`); nome repetido com dois CPFs vai para as pendências. Só "Presente" conta (Falta, Falta justificada, Desistente e Bloqueado, não). A simulação de 25/11/2026, com as semanas de 02/11 a 20/11, casou 154 registros de 63 alunos.
  - **Regra:** `stronix_presencas` lê quem é da academia com o módulo; ninguém grava pelo navegador.
  - **Tela:** o `useProfessoresDados` lê as presenças do ciclo uma vez (`semana` de 1º de dezembro do ano anterior a 30 de novembro); o dezembro que abre o ciclo só aparece na aba, fora da conta. A conta é a do PR 2 (`aderenciaPorSemana`), que devolve também quem veio uma vez e quem não veio (`umaIds` e `nenhumaIds`, o "Ver quem chamar" da aba). O número da lista e do placar é o `aderenciaResumo`: a nota do ano quando já há semestre fechado, ou o semestre em andamento. Bate a partir do começo da faixa da meta.
```

por:

```markdown
  - **Importação:** as presenças vêm da importação das planilhas da Next Fit, no bloco Faltosos de Configurações → Metas & ritmo (ver "Faltosos e importação da Next Fit"), que grava `stronix_presencas/{leadId}_{AAAA-MM}` com os dias do relatório Presenças (catraca e agenda, todas as modalidades). Até 26/11/2026 elas vinham do `scripts/import-presencas.js`, com o relatório "Presenças por contrato" (só as aulas de funcional) e um documento por aluno e semana. O script saiu no PR 2A do Professor e faltosos, por decisão do Johnny em 26/11/2026. Os documentos semanais que ele gravou em novembro não têm `mes`, ficam fora da leitura e continuam no banco.
  - **Regra:** `stronix_presencas` lê quem é da academia com o módulo, e só o gestor grava, pela importação.
  - **Tela:** o `useProfessoresDados` lê os documentos de presença uma vez, pelo `mes`, de novembro do ano anterior a dezembro do ciclo (um mês a mais de cada lado, para a semana que atravessa o mês vir inteira), soma os dias por semana (`presencasPorSemana`, em `aderencia.js`) e fica com as semanas de 1º de dezembro do ano anterior a 30 de novembro; o dezembro que abre o ciclo só aparece na aba, fora da conta. A conta é a do PR 2 (`aderenciaPorSemana`), que devolve também quem veio uma vez e quem não veio (`umaIds` e `nenhumaIds`, o "Ver quem chamar" da aba). O número da lista e do placar é o `aderenciaResumo`: a nota do ano quando já há semestre fechado, ou o semestre em andamento. Bate a partir do começo da faixa da meta.
```

- [ ] **Step 4: Conferir**

Run: `grep -c "—" CLAUDE.md`
Expected: o mesmo número do Step 1.

Run: `grep -nE "^## (Professor|Faltosos e importação da Next Fit|Rotinas dos consultores)$" CLAUDE.md`
Expected: três linhas, nessa ordem: `## Professor`, `## Faltosos e importação da Next Fit` e `## Rotinas dos consultores`.

Run: `grep -n "Decisão do Johnny, 05/10/2026" CLAUDE.md`
Expected: nenhuma linha. As decisões deste PR foram tomadas no plano.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git -c user.name="Johnny Bittencourt" commit -m "docs: CLAUDE.md com a importação da Next Fit e o bloco Faltosos de Configurações" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificação completa

**Files:** nenhum, a não ser que algo falhe.

- [ ] **Step 1: Todos os testes**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files  384 passed (384)` e `Tests  7345 passed (7345)`: os 366 arquivos e 6992 testes da Task 0, mais 19 arquivos novos e menos 1 apagado, e 353 testes a mais (352 nos arquivos novos, 8 em `leads.test.js`, `timeline.test.js` e `crm.contact.test.js` e 5 em `professor.aderencia.test.js`, menos os 10 do `professor.presencas.test.js` apagado, o de presenças do `npsRules.test.js` e o do `presencas.js` no `professorContasImports.test.js`). Nenhum teste que passava na Task 0 pode falhar agora.

- [ ] **Step 2: Os testes novos em outro fuso**

Os dias são do calendário de Brasília, e a máquina de dev fica em Brasília, onde um erro de fuso não aparece. O padrão `faltosos*` pega só arquivos deste PR.

Run: `TZ=UTC npx vitest run src/lib/__tests__/faltosos*.test.js src/lib/__tests__/importarPlanilhasDialog.test.js 2>&1 | tail -5`
Expected: `Test Files  19 passed (19)` e `Tests  352 passed (352)`.

Run: `TZ=Asia/Tokyo npx vitest run src/lib/__tests__/faltosos*.test.js src/lib/__tests__/importarPlanilhasDialog.test.js 2>&1 | tail -5`
Expected: `Test Files  19 passed (19)` e `Tests  352 passed (352)`.

- [ ] **Step 3: As travas que cuidam do PR inteiro**

Run: `npx vitest run src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/acessoImports.test.js src/lib/__tests__/acessoActionsRef.test.js src/lib/__tests__/modules.test.js src/lib/__tests__/professorRules.test.js src/lib/__tests__/faltososRules.test.js src/lib/__tests__/faltosos.imports.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/overscrollGuard.test.js src/lib/__tests__/settingsRail.test.js src/lib/__tests__/anelDeFoco.test.js src/lib/__tests__/bordaDosPrimitivos.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/newLeadImports.test.js src/lib/__tests__/guardianImports.test.js`
Expected: PASS, `Test Files  18 passed (18)` e `Tests  161 passed (161)`.

- [ ] **Step 4: A importação não grava no lead**

Run: `grep -n "LEADS_PATH\|stronix_leads" src/lib/faltosos/lotesImportacao.js src/lib/faltosos/gravarImportacao.js`
Expected: nenhuma linha (D3).

- [ ] **Step 5: Nenhuma planilha no repositório**

Run: `git ls-files | grep -iE '\.(xlsx|xls)$'`
Expected: nenhuma linha. Os testes montam as planilhas falsas em memória.

- [ ] **Step 6: Lint**

Run: `npx eslint . 2>&1 | tail -3`
Expected: `✖ 1 problem (0 errors, 1 warning)`, igual à Task 0 (Step 5). Se aumentou, rode `npx eslint` nos arquivos do mapa e corrija o que este PR trouxe.

- [ ] **Step 7: Build**

Run: `npm run build 2>&1 | grep -E "index-|ImportarPlanilhasDialog|xlsx|exceljs|built in"`
Expected: build sem erro. A janela de importação sai num pedaço próprio (`ImportarPlanilhasDialog-<hash>.js`, uns 53 kB), o `xlsx` e o `exceljs` continuam nos pedaços deles, e o pedaço principal (`index-<hash>.js`) cresce uns 23 kB, de 1.697 kB para uns 1.720 kB. O aviso de pedaço acima de 500 kB já aparecia antes deste PR.

- [ ] **Step 8: Vazamento no Sentry**

Run: `npm run verificar:sentry`
Expected: passa, como no CI.

- [ ] **Step 9: Funções da Vercel**

Run: `ls api/*.js | grep -v "/_" | wc -l`
Expected: `11`. Nenhuma função nova.

Se algum passo falhar, corrija na task dona do arquivo, rode de novo os testes dela e faça um commit `fix: ...` antes de seguir.

---

### Task 14: PR, regras e o teste de verdade

**Files:** nenhum.

- [ ] **Step 1: Subir a branch**

Run: `git push -u origin claude/professor-pr2a-v2`
Expected: a branch aparece no GitHub (`johnnychaves/crm-stronix`).

- [ ] **Step 2: Abrir o PR**

Escreva o corpo num arquivo do rascunho da sessão e abra o PR:

```bash
gh pr create --base main --title "feat: importação das planilhas da Next Fit nos faltosos (PR 2A)" --body-file <arquivo-do-corpo>
```

O corpo, em português e sem travessão, diz:
- o que muda: a importação dos relatórios Faltantes e Presenças da Next Fit pelo bloco Faltosos de Configurações → Metas & ritmo, a linha "Voltou a treinar" na ficha, as regras das três coleções novas e a de `stronix_presencas` com gravação pelo gestor, que já cobrem o 2B e o 2C, e a aderência do perfil do professor lendo as presenças da importação, com a saída do `scripts/import-presencas.js` (D7);
- o que não muda: sem o módulo, nenhuma academia vê diferença; a aba Faltosos é o 2B e as peças da ficha são o 2C;
- as decisões e os pontos que dependem do Johnny, copiados deste plano;
- **antes do merge**, o Johnny publica as regras no console, depois de rodar os cenários do Playground da Task 7;
- o roteiro do teste no Preview (Step 4) e a primeira importação da STRONIX parando na prévia (Step 5);
- a ordem depois do merge (Step 6);
- no fim, a linha `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Depois de abrir, ligue o PR à sessão pelas ferramentas do app (`get_status` e, se ele não aparecer, `bind_pr`) e leia o CI. Não agende nem fique consultando o CI por conta própria, e não ligue o auto-merge.

- [ ] **Step 3: Regras no console (Johnny)**

O Johnny cola o `firestore.rules` do PR no console do Firebase, roda os cenários do Playground da Task 7 e publica. O Preview usa o Firebase de produção, e sem as regras novas a importação para com permission-denied, porque as coleções novas não têm regra e a de `stronix_presencas` ainda recusa gravar pelo navegador.

- [ ] **Step 4: Teste no Preview, com a academia de teste**

O Preview usa o Firebase de produção: este passo é só na academia de teste, nunca na STRONIX. As planilhas são inventadas e saem de um script no rascunho da sessão. Os resultados abaixo saíram do motor deste PR, rodado com estas mesmas planilhas e com clientes iguais aos da tabela (vendidos no mesmo dia, antes da importação), numa cópia do repositório com o plano aplicado, para três datas de "hoje" diferentes.

1. Preparar a academia de teste, pelo "Acessar como":
   - o módulo "Professor e faltosos" ligado no super console (o do teste do PR 1 serve);
   - em Configurações → Equipe & acessos, no card Professores, os professores "Professor Teste A" e "Professora Teste Com Nome Comprido";
   - oito clientes, cada um criado pelo Novo lead e depois pela Venda, com o início do contrato hoje e o nome escrito exatamente assim:

   | Nome | Contato | Plano da venda |
   |---|---|---|
   | Aluno Teste Um | WhatsApp (51) 99100-0001 | 12 meses |
   | Aluno Teste Dois | WhatsApp (51) 99100-0002 | 12 meses |
   | Aluna Teste Três | "Menor de idade" ligado, responsável "Responsável Teste Três", telefone (51) 99100-0003 | 12 meses |
   | Aluno Teste Quatro | WhatsApp (51) 99100-0004 | 1 mês (se a academia não tiver, crie em Configurações → Catálogos → Planos) |
   | Aluno Teste Cinco | WhatsApp (51) 99100-0005 | 12 meses |
   | Aluno Teste Seis | WhatsApp (51) 99100-0006 | 12 meses |
   | Aluno Teste Sete | WhatsApp (51) 99100-0007 | 12 meses |
   | Aluno Teste Oito | WhatsApp (51) 99100-0008 | 12 meses |

2. Gerar as planilhas. Salve o script abaixo como `gerar-planilhas-teste.mjs` no rascunho da sessão e rode da raiz do worktree, com a pasta de saída também no rascunho:

```bash
node <rascunho>/gerar-planilhas-teste.mjs <rascunho>/planilhas-teste
```

```js
// Planilhas falsas para o teste do PR 2 no Preview, no formato dos relatórios
// Faltantes e Presenças da Next Fit. Só dados inventados: os nomes e os
// telefones são os dos clientes que o teste cria na academia de teste.
// Nunca grave o resultado dentro do repositório.
//
// Rodar da raiz do worktree (é de lá que ele pega o pacote xlsx):
//   node <este arquivo> <pasta de saída fora do repositório> [AAAA-MM-DD de hoje]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

const [saida, hojeArg] = process.argv.slice(2);
if (!saida) throw new Error('Informe a pasta de saída.');
const hoje = hojeArg || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(hoje)) throw new Error('A data de hoje vai no formato AAAA-MM-DD.');

const somar = (dia, n) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

// Semana 1: o Faltantes de 7 dias atrás. Semana 2: o de hoje.
const E1 = somar(hoje, -7);
const E2 = hoje;

const FALTANTES = ['Nome', 'Contrato', 'Qtde de ausências', 'Última presença', 'Telefone', 'Professor', 'Consultor'];
const PRESENCAS = ['Cliente', 'Modalidade', 'Contrato', 'Tipo', 'Data'];

// A Next Fit corta o nome do professor em 29 caracteres.
const PROF_A = 'Professor Teste A';
const PROF_LONGO = 'Professora Teste Com Nome Comprido'.slice(0, 29);
const CONTROLE = 'Controle (não alterar)';

// A última presença é a data do arquivo menos a quantidade de ausências, como
// na Next Fit.
const faltante = (E, nome, telefone, ausencias, professor) => [
  nome, 'Plano Teste', ausencias, br(somar(E, -ausencias)), telefone, professor, 'Consultor Teste',
];
const linhaDePresenca = (p) => [p.nome, p.modalidade, 'Plano Teste', p.tipo, `${br(p.dia)} ${p.hora}`];

const faltantesSemana1 = [
  faltante(E1, 'Aluno Teste Um', '(51) 9 9100-0001', 8, PROF_A),
  faltante(E1, 'Aluno Teste Dois', '(51) 9 9100-0002', 10, PROF_LONGO),
  // Menor de idade: o telefone é o do responsável.
  faltante(E1, 'Aluna Teste Três', '(51) 9 9100-0003', 20, PROF_LONGO),
  // Contrato de 1 mês: urgente.
  faltante(E1, 'Aluno Teste Quatro', '(51) 9 9100-0004', 35, PROF_A),
  faltante(E1, 'Aluno Teste Seis', '(51) 9 9100-0006', 9, PROF_A),
  faltante(E1, 'Aluno Teste Sete', '(51) 9 9100-0007', 7, CONTROLE),
  // Ninguém com esse telefone no CRM: vai para Não achados.
  faltante(E1, 'Pessoa Fora Do Crm', '(51) 9 9100-0009', 12, PROF_A),
];

// O Presenças da semana 1 cobre uns quatro meses e termina no dia do
// Faltantes, para o da semana 2 começar no dia seguinte sem buraco. Cada aluno
// tem acessos em três ou quatro meses, sempre até a última presença que o
// Faltantes mostra (o primeiro número de cada lista é a quantidade de
// ausências dele). Assim o primeiro lote da gravação passa de 20 documentos,
// que é o que confere o limite de leituras das regras por pedido.
const ACESSOS_SEMANA1 = [
  ['Aluno Teste Um', [8, 40, 70, 100]],
  ['Aluno Teste Dois', [10, 45, 75, 105]],
  ['Aluna Teste Três', [20, 50, 80, 110]],
  ['Aluno Teste Quatro', [35, 65, 95]],
  ['Aluno Teste Seis', [9, 39, 69, 99]],
  ['Aluno Teste Sete', [7, 37, 67, 97]],
  ['Aluno Teste Cinco', [5, 35, 65, 95]],
  // O Oito ainda vem: falta só a partir da semana 2.
  ['Aluno Teste Oito', [1, 30, 60, 90]],
];
const presencasSemana1 = [
  ...ACESSOS_SEMANA1.flatMap(([nome, recuos]) => recuos.map((r) => (
    { nome, modalidade: 'off', tipo: 'Acesso', dia: somar(E1, -r), hora: '07:15' }
  ))),
  // No dia do Faltantes, o Cinco passa na catraca e tem aula na agenda.
  { nome: 'Aluno Teste Cinco', modalidade: 'offf', tipo: 'Acesso', dia: E1, hora: '07:40' },
  { nome: 'Aluno Teste Cinco', modalidade: 'Pilates', tipo: 'Agenda', dia: E1, hora: '07:00' },
];

// Semana 2: o Um e o Seis somem do Faltantes. O Um tem presença no Presenças;
// o Seis, não. O Oito começa a faltar, como em todo relatório de verdade, que
// sempre traz alguém perto do menor marco.
const faltantesSemana2 = [
  faltante(E2, 'Aluno Teste Oito', '(51) 9 9100-0008', 8, PROF_A),
  faltante(E2, 'Aluno Teste Dois', '(51) 9 9100-0002', 17, PROF_LONGO),
  faltante(E2, 'Aluna Teste Três', '(51) 9 9100-0003', 27, PROF_LONGO),
  faltante(E2, 'Aluno Teste Quatro', '(51) 9 9100-0004', 42, PROF_A),
  faltante(E2, 'Aluno Teste Sete', '(51) 9 9100-0007', 14, CONTROLE),
  faltante(E2, 'Pessoa Fora Do Crm', '(51) 9 9100-0009', 19, PROF_A),
];

const presencasSemana2 = [
  { nome: 'Aluno Teste Cinco', modalidade: '', tipo: 'Acesso', dia: somar(E1, 1), hora: '06:50' },
  { nome: 'Aluno Teste Um', modalidade: 'Musculação', tipo: 'Acesso', dia: somar(E2, -3), hora: '18:30' },
  { nome: 'Aluno Teste Cinco', modalidade: 'off', tipo: 'Acesso', dia: somar(E2, -1), hora: '06:55' },
];

// O Presenças da semana 2 começando 4 dias depois do último dia da semana 1:
// a prévia avisa do buraco.
const presencasComBuraco = presencasSemana2.filter((p) => p.dia >= somar(E1, 4));

const escrever = (arquivo, cabecalho, linhas) => {
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
  fs.writeFileSync(path.join(saida, arquivo), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};

fs.mkdirSync(saida, { recursive: true });
escrever('faltantes-semana1.xlsx', FALTANTES, faltantesSemana1);
escrever('presencas-semana1.xlsx', PRESENCAS, presencasSemana1.map(linhaDePresenca));
escrever('faltantes-semana2.xlsx', FALTANTES, faltantesSemana2);
escrever('presencas-semana2.xlsx', PRESENCAS, presencasSemana2.map(linhaDePresenca));
escrever('presencas-com-buraco.xlsx', PRESENCAS, presencasComBuraco.map(linhaDePresenca));
console.log(JSON.stringify({ hoje, semana1: E1, semana2: E2, pasta: saida }));
```

Expected: uma linha com `semana1` (7 dias atrás) e `semana2` (hoje), e cinco arquivos na pasta.

3. Semana 1. Em Configurações → Metas & ritmo, no bloco Faltosos, conferir "Nenhuma importação ainda" e clicar em "Importar planilhas". Escolher juntos `faltantes-semana1.xlsx` e `presencas-semana1.xlsx`:
   - o passo Professores pede três nomes: "Professor Teste A", com a sugestão "Professor Teste A"; "Professora Teste Com Nome Com", cortado em 29 letras como a Next Fit faz, com a sugestão "Professora Teste Com Nome Comprido"; e "Controle (não alterar)", sem sugestão: escolher "Sem professor (fica com o gestor)";
   - a prévia mostra o Faltantes de 7 dias atrás e o Presenças de 117 a 7 dias atrás, com 4 alunos no marco de 7 dias, 1 no de 14 e 1 no de 30, 1 urgente novo (o Aluno Teste Quatro), nenhum aviso e a "Pessoa Fora Do Crm" entre os não ligados (deixe sem ligar);
   - Confirmar e esperar "Importação gravada.". O primeiro lote leva mais de 40 gravações (43 ou 44, conforme os meses que o Presenças cruza), mais de 20, e é isso que confere o limite de leituras das regras por pedido (Task 7, Etapa B).

   Depois, no bloco: "Última importação: DD/MM às HH:MM, por <seu nome>", com o dia e a hora de agora; embaixo, "Faltantes de <7 dias atrás> · Presenças de <117 dias atrás> a <7 dias atrás>"; o lembrete "Presenças: exporte de <6 dias atrás> até hoje."; e, em Professores da Next Fit, os três nomes: "Controle (não alterar)" com Sem professor, "Professor Teste A" com Professor Teste A e "Professora Teste Com Nome Com" com Professora Teste Com Nome Comprido.

4. O buraco. Abrir de novo "Importar planilhas" com `faltantes-semana2.xlsx` e `presencas-com-buraco.xlsx`: a prévia avisa só que pode ter ficado um buraco no Presenças ("O último Presenças importado vai até <7 dias atrás>, e este começa em <3 dias atrás>…"). Fechar sem confirmar.

5. Semana 2. "Importar planilhas" com `faltantes-semana2.xlsx` e `presencas-semana2.xlsx`:
   - não aparece nome novo de professor;
   - a prévia mostra 2 que voltaram (o Aluno Teste Um, "voltou em <3 dias atrás>", e o Aluno Teste Seis, "voltou entre <15 dias atrás> e <hoje>", sem o dia), 1 aluno no marco de 7 dias (o Aluno Teste Oito, que começou a faltar), 2 no de 14 (o Dois e o Sete), 1 urgente e nenhum aviso;
   - Confirmar.

   Depois: o bloco mostra "Faltantes de <hoje> · Presenças de <6 dias atrás> a <ontem>". A ficha do Aluno Teste Um tem a linha "Voltou a treinar em DD/MM" no filtro Marcos, com o tipo "Presença", visível com o interruptor de Sistema desligado e com quem importou como autor. A do Aluno Teste Seis tem "Voltou a treinar entre DD/MM e DD/MM".

6. Refazer a semana 2 com os mesmos dois arquivos: a prévia mostra zero em cada marco e ninguém voltando. Confirmar: a janela diz "Essa importação já tinha sido gravada. Os alunos foram gravados de novo, e os não ligados foram atualizados.", a ficha do Um continua com uma linha "Voltou a treinar" só, e o bloco continua com a hora da primeira importação da semana 2.

7. Importar `faltantes-semana1.xlsx` sozinho: a janela recusa na hora com "Este Faltantes é de DD/MM/AAAA, mais antigo que o último importado, de DD/MM/AAAA. Exporte o relatório de hoje.".

8. Bloco: os marcos 7, 14, 30 e 60 e a janela de 90 dias. Ligar o "Controle (não alterar)" a um professor: aparece "Ligação salva. Vale a partir da próxima importação.".

9. Como consultor e como professor (os logins do teste do PR 1): Configurações não abre, como antes. O consultor vê na ficha do Aluno Teste Um a mesma linha "Voltou a treinar". A Meta diária do professor continua com o aviso do PR 1.

10. A aderência. Ligar o Aluno Teste Um a um professor de teste (Contexto comercial da ficha) e abrir o perfil desse professor na aba Aderência: as semanas com presença do Um aparecem, e a de cada semana conta os dias de segunda a sexta do Presenças importado. Sem nenhuma presença dos alunos do professor, a aba continua dizendo "sem dados".

11. Desligar o módulo no super console e entrar de novo como gestor: o bloco Faltosos some de Metas & ritmo, sem erro de permissão no console do navegador, e a linha "Voltou a treinar" continua na ficha do Aluno Teste Um (ela é uma interação). Religar e ver o bloco de volta, com a última importação.

- [ ] **Step 5: A primeira importação da STRONIX, parando na prévia (Johnny)**

A spec pede que a primeira importação de verdade seja conferida no Preview antes de produção. Nada é gravado antes do Confirmar, então este passo não muda nada na STRONIX.

1. Exportar da Next Fit, em Excel, o Faltantes com o filtro de 7 dias e o Presenças de 02/11/2026 até hoje. O Presenças começa numa segunda-feira e cobre novembro inteiro para a aderência do perfil do professor não perder as semanas que o script tinha gravado (D7). Período que começa no meio da semana deixa a primeira semana com menos dias. As planilhas ficam no computador do Johnny e nunca vão para o repositório nem para o rascunho da sessão.
2. No Preview, entrar como gestor da STRONIX, abrir Configurações → Metas & ritmo e, no bloco Faltosos, "Importar planilhas" com os dois arquivos.
3. Conferir com o Johnny os nomes novos de professor e as sugestões, a data do Faltantes, os números de cada marco, os urgentes, os não ligados e os que ficam de fora por contrato. Na simulação do levantamento, com a planilha de 02/10, 73 alunos entraram nos marcos e 123 ficaram só na lista de acompanhamento. A ordem de grandeza deve ser parecida.
4. Fechar a janela sem confirmar.

- [ ] **Step 6: Depois do merge (Johnny)**

1. A Vercel publica o merge sozinha. Conferir o deploy de produção.
2. No mesmo dia do merge, fazer a primeira importação em produção, com o Faltantes da semana e o Presenças desde 02/11/2026, e confirmar. Até ela entrar, a aderência de todo professor aparece como "sem dados", porque a leitura nova ignora os documentos semanais do script (D7).
3. Conferir o bloco Faltosos (a última importação e os professores da Next Fit), a ficha de um aluno que voltou e a aba Aderência de um professor de funcional, que agora conta a ida à academia, e não só a aula marcada, e por isso pode mudar em relação ao número de antes.
4. Daí em diante, a importação é toda segunda. A lista dos professores chega com o 2B.
5. Atualizar, no repositório STRONIX-FIRMA (fora deste repositório), a tabela "Últimas Atualizações" do `CLAUDE.md` raiz e a linha do Stronilead no `06-sistemas/CLAUDE.md`, com o 2A.

## Fora deste plano

- O 2B: a aba Faltosos em Clientes, com o endereço `/clientes/faltosos`, o filtro de professor em pílula, os grupos, o andamento, os Não achados, o botão de importar no topo da aba e a Meta do professor levando à aba. Antes do plano dele, 2 ou 3 mockups da aba no desenho A de Clientes.
- O 2C: a aba Presenças e o selo "Sem vir há X dias" da ficha.
- O PR 3: a Meta do professor com as tarefas, o "Registrar contato" com a interação `absence_contact`, o "Já voltou", o aviso de "Quer cancelar" no sino do gestor e a trava das regras que deixa o professor gravar só a `tarefa` e o `querCancelarEm` dos alunos dele.
- O botão que abre a conversa no Stronizap, com spec própria.
- A tela para editar perfis de acesso.
- O professor da importação de clientes (branch `claude/importacao-professor-nome`).
- O layout de celular do bloco e da janela de importação, que segue a decisão de 28/09/2026 de deixar o celular para depois.
- Frequência mínima por semana, a API da Next Fit e ler a catraca, como diz a spec em "Fora deste projeto".
- Tirar a linha "Voltou a treinar" do índice que conta os dias sem contato nos quadros de Renovações, Vencidos e Upgrade (`buildInteractionIndex`). Hoje ela entra, como a linha da importação de clientes.
- Travar nas regras a criação de `presence_return` por quem não é gestor, o que mudaria o bloco de interações do PR 1.
- Ler na janela só os estados "faltando" e os dos alunos do arquivo, em lotes de 30, se a base crescer.
- Contar e acertar os clientes com renovação marcada antes de 30/09/2026, que não têm o bloco "em uso" e ficam de fora da importação como sem contrato ativo (C1).
- Artigos da Central de ajuda sobre a importação semanal.
