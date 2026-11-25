# PR 6: aderência às aulas. Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`).

**Objetivo:** o script `scripts/import-presencas.js` lê o relatório de Presenças da Next Fit (aula de funcional), soma por aluno e semana, casa pelo CPF e grava `stronix_presencas`. O perfil ganha a aba Aderência, e a lista e o placar passam a mostrar o número.

**Arquitetura:** a leitura do relatório é pura (`src/lib/professor/presencas.js`), com testes. O script só junta o arquivo, o banco e a leitura, e sem `--apply` não grava nada. A conta é a do PR 2 (`aderencia.js`), que passa a devolver também quem veio uma vez e quem não veio, para o "Ver quem chamar" do mockup B. A tela lê as presenças do ano do ciclo uma vez, sem ser ao vivo.

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`, seções "Aderência", "As contas" e "Importação da aderência". Mockup: aba Aderência de `2026-11-24-perfil-professor-b.html`.

## Decisões deste plano

1. **O relatório real ainda não chegou.** Os nomes das colunas são procurados por apelido (CPF, data, situação, modalidade), e o script para e lista o cabeçalho quando não acha a coluna. Com o primeiro relatório de verdade, os apelidos são conferidos e a simulação roda (é o que fecha o PR).
2. **Período explícito.** O script pede `--de` e `--ate`, o período do relatório, e só grava as semanas inteiras dentro dele, para um relatório que corta a semana no meio não gravar uma contagem pela metade. Regravar a mesma semana troca o número (o id é `{leadId}_{segunda}`).
3. **Só de segunda a sexta, só funcional, só presença.** Linha de sábado ou domingo, de outra modalidade ou com a situação de falta fica fora e entra no resumo.
4. **Casamento pelo CPF.** O CPF da linha procura `cpfDigits` nos leads da academia. Com mais de um lead, vale o cliente; se ainda sobrar mais de um, a linha vai para as pendências. Linha sem CPF ou sem lead também. Nada é casado pelo nome.
5. **A saída não mostra dado pessoal.** O script imprime só contagens. A lista de pendências, com nome e CPF para a recepção acertar, só sai num arquivo, com `--pendencias=<caminho>`.
6. **Regra:** `stronix_presencas` lê quem é da academia com o módulo; ninguém grava pelo navegador.
7. **Quem chamar:** a semana mostra os nomes de quem veio uma vez e de quem não veio, para o gestor e para o próprio professor (são os alunos dele).

## Tarefas

- [ ] **1. Leitura do relatório** (`src/lib/professor/presencas.js` e teste): colunas por apelido, data em texto ou em data do Excel, segunda-feira da semana, filtros, soma por CPF e semana, semanas inteiras no período, casamento com os leads.
- [ ] **2. Script** (`scripts/import-presencas.js`): arquivo `.xlsx` ou `.csv`, `--tenant`, `--de`, `--ate`, `--apply`, `--pendencias`.
- [ ] **3. Regra** (`firestore.rules`, teste das regras) e o caminho `PRESENCAS_PATH`.
- [ ] **4. Conta** (`aderencia.js`): as linhas da semana com os ids de quem veio uma vez e de quem não veio; o resumo para a lista (nota do ano, ou o semestre em andamento).
- [ ] **5. Tela:** leitura das presenças do ano no `useProfessoresDados`, a aba `aderencia` no perfil, o critério no placar e na lista.
- [ ] **6. Documentação e conferência:** `CLAUDE.md`, plano mestre, `npm run lint && npm test && npm run verificar:sentry && npm run build`, a tela no harness.

## Pontos para o Johnny

- O relatório de Presenças de verdade (Tipo Agenda, modalidade Treinamento Funcional, um mês inteiro) para conferir as colunas e rodar a simulação.
- Publicar a regra de `stronix_presencas` antes do merge.
- A importação toda semana fica com a sessão do plano de carreira, como diz a spec.
