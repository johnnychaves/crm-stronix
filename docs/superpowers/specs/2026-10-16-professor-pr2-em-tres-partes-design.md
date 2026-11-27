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
