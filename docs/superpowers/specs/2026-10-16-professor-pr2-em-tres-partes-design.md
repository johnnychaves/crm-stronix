---
status: revisão
---

# Professor e faltosos: o PR 2 em três partes

Como o PR 2 do projeto professor e faltosos passa a ser entregue. Combinado com o Johnny em 16/10/2026.

O comportamento continua o da spec original, `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md`. Esta spec só registra a divisão em três PRs e o que muda no plano por causa dela. O plano antigo, de 05/10/2026, está no commit `da9d7e3` da branch `claude/professor-pr2-importacoes` (`docs/superpowers/plans/2026-10-05-professor-pr2.md`) e é a base dos planos novos.

Tudo continua só para a academia com o módulo `faltosos` ligado, que hoje é só a STRONIX. Sem o módulo, nenhuma academia vê diferença, e as regras do Firestore recusam ler e gravar as coleções novas.

## Por que dividir

- A main andou 261 commits entre a base do plano (`0778e87`, 05/10) e 16/10.
- A tela de Clientes foi refeita no desenho A (PR #274), e 581 linhas do `ClientsView.jsx` mudaram. As Tasks 8 e 9 do plano antigo montavam a aba Faltosos em cima da tela antiga, então as telas delas precisam ser refeitas. A conta por trás da aba continua valendo.
- A regra do Johnny de 16/10/2026 manda todo filtro de tela nova ou redesenhada seguir as pílulas do cabeçalho dos painéis, como o Pipeline e os Relatórios. O plano antigo tinha um filtro de professor e uma barra próprios.
- O resto do plano continua valendo: a leitura das planilhas, a gravação, as regras e a janela de importação são quase só arquivos novos.
- Com a importação primeiro, a STRONIX começa a importar toda segunda antes das telas, e o histórico de presenças já existe quando a ficha ganhar a aba Presenças.

## As três partes

### 2A: a importação

Entra do plano antigo:
- as Tasks 1 a 4, que leem as planilhas, ligam professores e alunos, contam marcos e urgente e montam o plano da importação;
- a Task 5, a gravação em lotes, com os caminhos novos em `src/lib/firebase.js` e o `PRESENCE_RETURN_TYPE`;
- a Task 6, a linha "Voltou a treinar" na linha do tempo da ficha;
- a Task 7, as regras das quatro coleções novas;
- a Task 10, a janela de importação em quatro passos;
- do Task 8, só a leitura de `stronix_config/faltosos` pelo App e o `faltosos` do `GeneralConfigContext`;
- do Task 13, só o bloco Faltosos em Configurações → Metas & ritmo e as regras de edição dele.

O botão "Importar planilhas" mora no bloco Faltosos, que só o gestor da academia com o módulo vê. O bloco mostra a última importação (quem fez, quando, a data do Faltantes e o período do Presenças), o lembrete de como exportar, os marcos, a janela do urgente, os professores da Next Fit e o botão.

O que muda em relação ao plano antigo:
- a janela abre do bloco de Configurações, e não da aba Faltosos, e continua carregando à parte, só quando o gestor a abre;
- o teste no Preview confere pela prévia, pelo bloco e pela linha "Voltou a treinar" na ficha, porque a aba ainda não existe.

Para quem não importa, a única coisa nova visível é a linha "Voltou a treinar" na ficha de quem voltou. A Meta do professor continua com o aviso de hoje.

Todas as regras do Firestore do PR 2 entram aqui e são publicadas antes do merge. Elas já cobrem o que o 2B e o 2C leem, então os dois não mexem em regra.

### 2B: a aba Faltosos em Clientes

Antes do plano, 2 ou 3 mockups da aba no desenho A de Clientes, com o filtro de professor em pílula, mostrados no painel de preview. O Johnny escolhe um, e a escolha entra como adendo nesta spec.

Entra:
- o endereço `/clientes/faltosos` e o filtro `prof` no endereço (o resto do Task 8);
- a aba, com as telas refeitas no desenho escolhido. A conta dos grupos, do andamento por professor e do lembrete (`src/lib/faltosos/abaFaltosos.js`, do Task 9) é aproveitada;
- o botão "Importar planilhas" também no topo da aba, abrindo a mesma janela;
- a Meta do professor levando à aba quando já existe importação (o resto do Task 13).

Sem o módulo, a tela de Clientes fica igual à de hoje.

### 2C: a ficha

As Tasks 11 e 12 do plano antigo, com os trechos acertados na ficha do momento:
- a aba Presenças (`/ficha/<id>/presencas`), só para cliente;
- o selo "Sem vir há X dias" no topo da ficha, vermelho no urgente.

## Ordem

2A, depois 2B, depois 2C, por escolha do Johnny: o professor ganha a lista dos alunos dele antes da ficha.

O 2B e o 2C dependem do 2A, que grava os dados e lê a configuração. O 2C não depende do 2B.

O PR 3 (a Meta do professor com as tarefas, o "Registrar contato", o "Já voltou" e o aviso de "Quer cancelar" no sino) continua como estava, depois do 2C.

## Como cada parte é feita

- Cada plano sai do plano antigo, reaplicado sobre a main do momento com o mesmo replay que conferiu os 110 comandos em 05/10, para os trechos que mudaram saírem acertados e testados.
- Cada parte tem branch própria a partir da main, revisão de código antes do PR, teste no Preview com a academia de teste e merge do Johnny.
- O Preview usa o Firebase de produção, então os testes são só na academia de teste, com as planilhas inventadas do plano antigo.

## Os testes de cada parte

- **2A.** No Preview, com a academia de teste: as duas semanas de planilhas inventadas, o arquivo com buraco no Presenças, a repetição da semana 2 sem mudar nada e o Faltantes antigo recusado, conferidos pela prévia, pelo bloco e pela ficha. Depois, a primeira importação da STRONIX no Preview, parando na prévia para o Johnny conferir os números e os não ligados. Depois do merge, a importação em produção, toda segunda.
- **2B.** A aba como gestor (grupos, Sem professor, Não achados e andamento), como professor (filtrada nos alunos dele e sem Sem professor, Não achados, andamento e botão de importar), como consultor (sem a aba) e numa academia sem o módulo (Clientes igual à de hoje).
- **2C.** O selo âmbar e o vermelho, a aba Presenças com o dia de catraca e agenda numa linha só, o "Ver meses anteriores" e a ficha de lead caindo na Linha do tempo.

## Pontos conhecidos

- Entre o 2A e o 2B, a Meta do professor diz que a lista de faltosos aparece depois da primeira importação, e ela ainda não aparece. O professor não perde nada, porque a lista também não existia antes.
- Entre o 2A e o 2B, os alunos não ligados aparecem só na prévia e no registro da importação. A lista Não achados é da aba.
- A importação grava as tarefas de cada marco desde o 2A, e ninguém age sobre elas até o PR 3, como já estava no plano antigo.
- Os pontos C1 a C7 do plano antigo continuam abertos para o Johnny e valem para o 2A.
- A correção do professor na importação de clientes (branch `claude/importacao-professor-nome`) fica fora deste trabalho.

## Adendo de 26/11/2026: o 2A alimenta a aderência do perfil do professor

Entre 16/10 e 26/11 entrou o perfil do professor (PRs #309 a #319 do `crm-stronix`). A aderência dele lê `stronix_presencas`, a mesma coleção que o 2A grava, mas num formato diferente: um documento por aluno e semana (`{leadId}_{segunda}`), gravado pelo `scripts/import-presencas.js` a partir do relatório "Presenças por contrato" da Next Fit, só com as aulas de funcional. O 2A grava um documento por aluno e mês (`{leadId}_{AAAA-MM}`), com os dias do relatório Presenças (catraca e agenda, todas as modalidades).

Decisão do Johnny em 26/11/2026: a importação do 2A alimenta a aderência, e o script sai.

- A coleção continua `stronix_presencas`, no formato do 2A. A regra dela passa a deixar o gestor gravar, como as outras coleções do 2A.
- A aderência soma, por semana, os dias de segunda a sexta com presença, pela catraca ou pela agenda, em qualquer modalidade (`presencasPorSemana`, em `src/lib/professor/aderencia.js`). O `aderenciaPorSemana` não muda.
- O `useProfessoresDados` lê os documentos por mês, pelo campo `mes`. Os documentos semanais que o script gravou em novembro não têm esse campo, ficam fora da leitura e continuam no banco.
- Saem o `scripts/import-presencas.js`, o `src/lib/professor/presencas.js` e o teste dele.
- A aderência passa a contar a ida à academia, e não só a aula marcada de funcional. Os números de novembro mudam na primeira importação, e os professores de musculação e de pilates passam a ter número. Por isso o primeiro Presenças importado começa em 02/11/2026.

O plano do 2A foi refeito sobre a main de 26/11 (`e8423e2`), com essa mudança na Task 7 (regras) e numa Task 7A nova: `docs/superpowers/plans/2026-11-26-professor-pr2a-importacao.md`, na branch `claude/professor-pr2a-v2`. A versão de 16/10 continua no commit `4e95e8b` da branch `claude/professor-pr2a-importacao`.

## Adendo de 27/11/2026: o 2B vira a Meta diária do professor

Decisões do Johnny em 27/11/2026, depois de ver os mockups da aba Faltosos e da Meta do professor.

- A aba Faltosos em Clientes sai do projeto. A lista completa dos faltosos vira um relatório no grupo Clientes dos Relatórios, quando esse grupo ganhar os relatórios dele. Esse relatório fica fora deste trabalho.
- O 2B passa a ser a Meta diária do professor, que até aqui era o PR 3. O 2C (a ficha) continua igual e vem depois.
- O desenho segue a Meta do consultor ("Foco agora"). O mockup aprovado é `mockups/2026-11-27-meta-professor-a-foco.html`. Os outros mockups de 27/11 (`2026-11-27-faltosos-*` e `2026-11-27-meta-professor-b-*` e `-c-*`) ficam só como registro.

### A tela do professor

A Meta diária do professor deixa de ser o aviso provisório (`ProfessorGoalPlaceholder`) e passa a ser esta tela. O professor sem professor do cadastro ligado continua vendo "Seu acesso ainda não está ligado a um professor. Fale com o gestor."

- **Faixa do topo**, como a da Meta do consultor: a saudação, "Faltosos da semana, da importação de segunda, 23/11", o "Ao vivo" e "1 de 5 contatos feitos" com a barra. A semana vai de um Faltantes importado até o seguinte (`ultimaImportacao.dataFaltantes`).
- **Barra "Foco em"**, a mesma da Meta do consultor, só com Faltosos e o número. Treinos a vencer e Treinos vencidos entram depois, cada um como uma aba a mais. O mockup mostra as duas desligadas só para mostrar onde ficam; a tela de verdade não mostra o que ainda não existe.
- **Bloco Agora**, na versão 2 do mockup:
  - borda esquerda âmbar, vermelha no urgente, sem o contorno azul;
  - o motivo no canto ("Urgente: o contrato termina em 10/12" ou "Marco dos 30 dias sem vir");
  - no canto esquerdo, a foto do aluno no círculo, com o anel âmbar, vermelho no urgente (pedido do Johnny, 27/11/2026; sem foto, as iniciais);
  - o nome, com o link "Abrir ficha";
  - a frase "Não vem há 44 dias, desde 14/10.", que no urgente ganha "O contrato termina em 10/12.";
  - o contato pelo `contactOf` ("Falar com Carla Teles, mãe (responsável)" no menor) e o último contato de falta registrado;
  - os botões WhatsApp (`whatsappHref`), Registrar contato e Já voltou, e o "Pular por agora".
  - Fica de fora o histórico de presença em quadradinhos, que o Johnny achou que não ajuda o professor.
  - O Agora fica parado como na Meta do consultor: só muda pela ação de quem usa a tela.
  - Quando o aluno do Agora troca (linha da fila, Pular, contato registrado), o conteúdo do bloco entra com um esmaecer e uma subida curta (cerca de 0,2 s) e a borda pisca em azul uma vez, e a linha de quem saiu acende em azul claro na fila e apaga em cerca de 1 s (pedido do Johnny, 27/11/2026). Com movimento reduzido, nenhum dos dois roda (bloco do fim do `index.css`).
- **Ordem**: os urgentes primeiro e, dentro de cada grupo, quem está há mais dias sem vir.
- **Fila "Depois"**: uma linha por aluno, só com a foto, o nome e "Não vem há 37 dias" (no urgente, "Não vem há 25 dias, contrato termina em 18/12", em vermelho). Sem o marco nem a situação da tarefa, que repetiam os dias e são sempre "pendente" na fila (pedido do Johnny, 27/11/2026). A linha traz o aluno para o Agora.
- **Lateral**:
  - **Agenda de hoje**, só com as aulas experimentais de hoje em que o professor é o professor da aula. Só para ver: o professor não marca Compareceu nem Não veio (decisão do Johnny, 27/11/2026). Cada aula mostra a hora, o nome (link para a ficha), a modalidade, a aula da vez ("Aula 1 de 2") e a situação: Compareceu, Não veio, Sem desfecho ou Próxima. No pé, "Quem marca se o aluno veio é o consultor, na Meta dele.";
  - **Faltosos na semana**, com quantos estão em cada grupo (Urgentes, 60, 30, 14 e 7 dias);
  - **Feitos nesta semana**, com o resultado de cada contato.
- **Registrar contato** abre um balão na casca dos pop-ups da Meta (`PopupShell`): como foi o contato (WhatsApp, Ligação ou Pessoalmente), o que aconteceu, em cartões (Vai voltar, Respondeu, Não respondeu ou Quer cancelar), e a observação opcional. A gravação, o "Quer cancelar" no sino do gestor e o "Já voltou" seguem a spec original (`2026-10-02-professor-e-faltosos-design.md`, "A Meta do professor" e "O sino do gestor").

### O gestor

- Na Meta diária, o gestor da academia com o módulo ganha o seletor "Ver a Meta de", com a meta dele e a de cada professor ativo. Escolhido um professor, a tela é a do professor, com o título "Meta diária de Heloísa" e o aviso "Você está vendo a Meta de Heloísa. O que você registrar aqui fica no seu nome." A Agenda de hoje passa a ser a desse professor. A escolha mora no endereço da tela.
- O gestor pode registrar o contato e marcar "Já voltou" pela Meta do professor, no nome dele.
- O que é só do gestor fica no bloco Faltosos de Configurações → Metas & ritmo, ao lado da importação: os alunos Sem professor e os Não achados da última importação.
- O consultor não tem o seletor.

### Regras do Firestore

Este PR muda regra, ao contrário do que esta spec dizia do 2B:
- o professor passa a criar a interação do contato de falta (`absence_contact`), no próprio nome;
- o professor passa a marcar a tarefa dos alunos dele em `stronix_faltosos`, só nos campos da tarefa e no `querCancelarEm`, como uma condição a mais na linha de update.

O sino do gestor lê o "Quer cancelar" no `querCancelarEm` do estado do aluno, e `stronix_faltosos` já é lido por todo membro da academia com o módulo, então a leitura do sino não muda regra.

As regras são publicadas antes do merge, a partir da regra que estiver no ar, como no 2A. A Agenda de hoje só lê `stronix_aulas`, que todo membro já lê.
