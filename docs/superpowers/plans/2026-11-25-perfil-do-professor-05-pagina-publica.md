# PR 5: a página pública da pesquisa de NPS. Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`).

**Objetivo:** o aluno abre `/avaliar/<academia>/<código>` no celular, digita o CPF, dá as notas uma pergunta por vez e deixa um comentário opcional. A resposta entra em `stronix_nps_respostas` e soma nos totais do professor.

**Arquitetura:** três ações públicas na `api/tenant-resolve.js` (`nps-info`, `nps-check`, `nps-answer`), sem função nova (continuam 11 de 12), com o trabalho em `api/_npsPublico.js`. As contas são as do PR 4, importadas direto de `src/lib/professor/` (puras, cobradas pelo `professorContasImports.test.js`). A página é decidida no `App()`, fora do roteador, como a indicação pública, dentro de uma `ScreenErrorBoundary`.

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`, seções "Página pública" e "Servidor". Mockup aprovado: `docs/superpowers/specs/mockups/2026-11-24-nps-pagina-publica-b.html`.

---

## Decisões deste plano

1. **Link inválido é uma resposta só.** Academia que não existe, suspensa ou arquivada, sem o módulo, código fora do formato, código desconhecido, professor inativo ou dois professores com o mesmo código: `{ found: false }` no `nps-info` e `{ ok: false, motivo: 'link' }` nas outras duas. A página mostra "Link fora do ar", sem marca e sem nome.
2. **Pesquisa que recebe resposta:** situação `aberta`, o dia de Brasília entre `inicio` e `fim` (`recebeRespostas`) e turma do professor maior que zero. Sem ela, a página mostra a foto e "Nenhuma pesquisa aberta agora.".
3. **Quem pode responder:** cliente com o CPF (`cpfDigits`), na carteira em vigor do professor agora (`carteiraAt`, estado `vigente`, sem o trancado), a mesma conta da turma. Com mais de um lead com o CPF, vale o que está na carteira. A recusa é uma frase só para CPF que não existe, de outra carteira ou sem contrato.
4. **Resposta repetida:** o id `{pesquisaId}_{leadId}` e o `create` da transação recusam a segunda. O `nps-check` já avisa antes das perguntas.
5. **As notas** cobrem exatamente as perguntas da pesquisa, inteiras de 0 a 10. O comentário vai até 500 caracteres. O campo invisível `website` preenchido responde sucesso sem gravar.
6. **Totais na mesma transação** da resposta, pelo `somarResposta`, com a turma da pesquisa, `pesquisaId` e `professorId`. O CPF não é gravado em lugar nenhum.
7. **Limites:** `nps-info` 60 por IP a cada 5 minutos; `nps-check` e `nps-answer`, 60 por IP a cada 10 minutos (a turma responde no mesmo Wi-Fi) e 150 por link a cada hora. Conferência e resposta levam no mínimo 1,2 s (`NPS_MIN_MS`), para o tempo não dizer se o CPF existe.
8. **Erro sem CPF.** O erro inesperado sobe ao Sentry com a mensagem trocada por `nps <ação> falhou (<código>)`, como o `scrubbedError` da ponte. O `verificar:sentry` passa a plantar um CPF no corpo.
9. **Visual do mockup B:** fundo carvão, destaque laranja, uma pergunta por tela com a régua de 0 a 10, o rosto que muda com a nota e o resumo das notas antes do comentário. A logo é a da academia (`settings.logoUrl`), e não a da STRONIX, porque a página atende qualquer academia com o módulo. As fontes do mockup (Saira e Barlow) são carregadas só nesta página, pelo Google Fonts.

## Tarefas

- [ ] **1. Servidor** (`api/_npsPublico.js`, `api/tenant-resolve.js`, `api/__tests__/npsPublico.test.js`): as três ações com os casos da spec (CPF que não existe, de outra carteira, sem contrato de funcional, resposta repetida, pesquisa fechada, módulo desligado, código desconhecido, nota fora de 0 a 10, pergunta faltando, campo invisível, limite estourado), com o banco falso que imita o SDK de servidor.
- [ ] **2. Rota** (`src/lib/tenantSlug.js`, `src/App.jsx`): `avaliar` reservado e a página decidida antes do roteador.
- [ ] **3. Página** (`src/views/public/AvaliarScreen.jsx`, teste em jsdom): CPF com máscara e conferência dos dígitos, recusas, perguntas uma por vez, comentário com o resumo, obrigado, sem pesquisa, link inválido.
- [ ] **4. Sentry** (`scripts/verificar-vazamento-sentry.js`): o CPF entre os valores plantados.
- [ ] **5. Documentação e conferência**: `CLAUDE.md`, plano mestre, `npm run lint && npm test && npm run verificar:sentry && npm run build`, a página no navegador a 375 px.

## Pontos para o Johnny

- A contagem de quantos clientes do funcional têm CPF no cadastro, só leitura e sem listar CPF, espera o OK dele (plano mestre, PR 5).
- As regras do Firestore do PR 4 precisam estar publicadas para a pesquisa existir; a página em si lê pelo servidor e não depende de regra.
