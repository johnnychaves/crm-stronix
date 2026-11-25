# PR 4: a pesquisa de NPS por dentro. Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`).

**Objetivo:** o gestor cria, abre e encerra as pesquisas de NPS na sub-tela Pesquisas (desenho B, escolhido pelo Johnny em 25/11/2026), o perfil ganha o link do NPS com o QR code e a aba NPS, e a lista e o placar passam a mostrar a nota dos alunos de verdade. A resposta do aluno (página pública) é o PR 5.

**Arquitetura:** três coleções novas, com regras: `stronix_nps_pesquisas` (o gestor grava), `stronix_nps_respostas` e `stronix_nps_totais` (só o servidor grava, a partir do PR 5). As contas são puras, em `src/lib/professor/pesquisas.js` e `nps.js`, inclusive a soma de uma resposta nos totais, que o servidor do PR 5 vai usar. A tela lê as pesquisas e os totais ao vivo (as duas coleções são pequenas), e as respostas só na aba NPS do gestor.

**Stack:** React 19, Vite, Tailwind v4, shadcn, Firebase (Firestore), Vitest com jsdom e o pacote `uqr` para o QR code.

**Spec:** `docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md`. Plano mestre: `2026-11-24-perfil-do-professor-00-visao-geral.md`, seção "PR 4". Mockups: pesquisas `docs/superpowers/specs/mockups/2026-11-25-professores-pesquisas-b.html` (opção B); link e aba NPS do perfil em `2026-11-24-perfil-professor-b.html` e `-b-professor.html`.

**Sobre o código deste plano:** como no PR 3, o que decide a exatidão (contas, regras, gravações) vem com as assinaturas e os casos de teste; as telas vêm com a estrutura e os textos, porque o desenho está nos mockups.

---

## Decisões deste plano

1. **Abrir não depende da data de início** (como no mockup B, em que o rascunho de dezembro tem o "Abrir pesquisa"). Abrir grava a turma de cada professor naquele dia e trava as perguntas. O aluno só responde de `inicio` a `fim` (o servidor confere, no PR 5). Aberta antes do início, a pesquisa diz "Recebe respostas a partir de 01/12".
2. **Datas em texto.** `inicio` e `fim` são `'AAAA-MM-DD'`, o dia inteiro, sem fuso: o servidor compara com o dia de Brasília, e o navegador com o dia local (`dayKeyOf`).
3. **Encerra sozinha.** A situação gravada fica `aberta`, e a conta (`estadoDaPesquisa`) diz `encerrada` quando o dia passou do `fim`. Só uma pesquisa fica aberta por vez, contando pela conta, então a vencida não trava a próxima.
4. **A turma** é a carteira ativa (estado `vigente`, sem o trancado) de cada professor ativo no instante de abrir, pela `carteiraAt`. Só entra no mapa `turmas` o professor com turma maior que zero.
5. **Perguntas com id pela posição.** Ao salvar, as perguntas ganham `p1`, `p2`... na ordem. Como só mudam em rascunho, antes de qualquer resposta, o id fica estável depois de aberta.
6. **O ciclo da pesquisa** começa no ano do início e pode ir para o ciclo em que o início cai (`ciclosDaPesquisa`): a de 01/12/2027 oferece 2027 (o padrão) e 2028; a de junho, só 2027.
7. **Os totais guardam a contagem por nota** (`porNota`, 11 números por pergunta), além da soma e dos promotores, neutros e detratores da spec. É o que deixa o professor ver o histograma do mockup sem ler as respostas. A soma de uma resposta nos totais (`somarResposta`) mora em `nps.js`, pura, para o servidor do PR 5 usar.
8. **As regras travam o que importa.** Rascunho só nasce como rascunho. Depois de aberta, as perguntas e as turmas não mudam, e a única troca de situação é para `encerrada`. Só o rascunho se apaga. Respostas e totais: ninguém grava pelo navegador.
9. **O link usa o endereço de onde o app está aberto** (`window.location.origin`), para funcionar no preview. A página `/avaliar` é do PR 5; até lá o link não abre nada, e ninguém o divulga.
10. **O código do link** tem 10 letras e números de um alfabeto de 32 símbolos sem os que se confundem (0, o, 1, l), sorteados com `crypto.getRandomValues`. "Gerar novo link" pede confirmação, porque o antigo para de funcionar.
11. **Nota do ano na lista e no placar:** a média das notas válidas das pesquisas do ciclo que já abriram (aberta ou encerrada), pelo `npsDoAno`. A porcentagem de promotores do placar soma as pesquisas válidas.
12. **Rascunho se apaga** pelo formulário ("Excluir rascunho", com confirmação), para o teste do gestor não ficar para sempre na lista.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/professor/pesquisas.js` | Novo. Pergunta padrão, ciclos, validação, estado, turma do dia, progresso. |
| `src/lib/professor/nps.js` | Ganha `somarResposta`, `npsDoCiclo` e o `porNota`. |
| `src/lib/npsLink.js` | Novo. Código e endereço do link. |
| `src/lib/npsWrites.js` | Novo. Salvar, abrir, encerrar e excluir pesquisa; gerar o link. |
| `src/lib/firebase.js` | Os três caminhos novos. |
| `firestore.rules` | As três coleções. |
| `src/hooks/useNpsDados.js` | Novo. Pesquisas e totais ao vivo; respostas de uma pesquisa. |
| `src/lib/routes.js` | `pesquisas` em `PROFESSORES_SUBS` e `nps` em `PERFIL_TABS`. |
| `src/views/professores/*` | Aba Pesquisas, formulário, cartão na lista, link no cabeçalho, aba NPS, NPS no placar e na lista. |
| `package.json` | `uqr`. |
| Testes | Ver cada tarefa. |
| `CLAUDE.md` | O item do PR 4 na seção "Perfil do professor". |

---

### Tarefa 1: as contas da pesquisa

**Arquivos:** `src/lib/professor/pesquisas.js`, `src/lib/__tests__/professor.pesquisas.test.js`, `src/lib/__tests__/professorContasImports.test.js` (o arquivo novo entra na lista).

- [ ] `PERGUNTA_PRINCIPAL_PADRAO` ("De 0 a 10, quanto você recomendaria o professor a um amigo?"), `MAX_PERGUNTAS = 5`.
- [ ] `ciclosDaPesquisa(inicio)`: `[ano do início, cicloDe(início)]` sem repetir.
- [ ] `novaPesquisa()`: nome vazio, início e fim vazios, ciclo null, a principal sugerida.
- [ ] `problemaDaPesquisa(form)` → `{ campo, texto }` ou null: nome, datas, fim antes do início, ciclo fora dos ciclos do início, de 1 a 5 perguntas, pergunta vazia, exatamente uma principal.
- [ ] `paraGravar(form)`: perguntas com `p1`, `p2`..., textos aparados.
- [ ] `estadoDaPesquisa(p, hoje)`: `rascunho`, `aberta` ou `encerrada` (aberta com o dia depois do fim é encerrada). `recebeRespostas(p, hoje)`: aberta e o dia entre início e fim.
- [ ] `pesquisaEmCurso(pesquisas, hoje)`: a aberta pela conta, ou null.
- [ ] `turmasDoDia({ clientes, contratos, planos, professores, agora })`: `{ [id]: n }` só com os ativos e turma > 0.
- [ ] `progressoDaTurma(turma, respostas)`: `{ pct, vale, faltam, nuncaVale }` (turma abaixo de 10 nunca vale).
- [ ] Casos: ciclo de junho e de dezembro, fim antes do início, duas principais, seis perguntas, pergunta vazia, aberta vencida, aberta antes do início, turma com trancado e professor inativo, 9 e 10 respostas, 49% e 50%.

### Tarefa 2: os totais

**Arquivos:** `src/lib/professor/nps.js`, `src/lib/__tests__/professor.nps.test.js`.

- [ ] `somarResposta(totais, notas)`: devolve os totais novos, com `respostas + 1` e, por pergunta, `soma`, `promotores` (9 e 10), `neutros` (7 e 8), `detratores` (0 a 6) e `porNota` (11 números). Totais vazios começam do zero.
- [ ] `npsDoCiclo({ pesquisas, totais, professorId, ciclo, meta })`: as pesquisas do ciclo que já abriram e têm turma do professor, cada uma com o `npsDe` (a turma vem da pesquisa), mais a nota do ano (`npsDoAno`) e a porcentagem de promotores somada das válidas.
- [ ] Casos: promotor, neutro e detrator na borda (9, 7, 6), pesquisa sem totais (zero respostas), rascunho fora, outro ciclo fora, promotores somados de duas pesquisas.

### Tarefa 3: o link

**Arquivos:** `src/lib/npsLink.js`, `src/lib/__tests__/npsLink.test.js`.

- [ ] `gerarNpsCode(random)`: 10 símbolos do alfabeto `abcdefghijkmnpqrstuvwxyz23456789`.
- [ ] `npsLinkDe(origin, tenantId, code)`: `<origin>/avaliar/<academia>/<código>`, null sem código.

### Tarefa 4: as regras

**Arquivos:** `firestore.rules`, `src/lib/firebase.js`, `src/lib/__tests__/npsRules.test.js`.

- [ ] `stronix_nps_pesquisas`: lê o membro com o módulo; cria o gestor só como rascunho; altera o gestor quando é rascunho, ou quando as perguntas e as turmas ficam iguais e a situação vai para `encerrada`; apaga só rascunho.
- [ ] `stronix_nps_respostas`: só o gestor lê; ninguém grava.
- [ ] `stronix_nps_totais`: o gestor lê todos, o professor só os do próprio `professorId`; ninguém grava.
- [ ] O teste lê o texto da regra, como o `professorRules.test.js`: `hasModule(appId, 'faltosos')` nos três blocos, escrita `false` nas duas do servidor, a trava do professor nos totais e as trocas permitidas da pesquisa.

### Tarefa 5: dados e gravações

**Arquivos:** `src/hooks/useNpsDados.js`, `src/lib/npsWrites.js`, `src/lib/__tests__/npsWrites.test.js`.

- [ ] `useNpsDados({ db, professorId, listenersActive })`: pesquisas e totais ao vivo; com `professorId`, os totais vêm só dele (`where('professorId', '==', id)`), que é o que a regra do professor aceita.
- [ ] `useNpsRespostas({ db, pesquisaId, enabled })`: as respostas da pesquisa (`where('pesquisaId', '==', id)`), só para o gestor.
- [ ] `salvarRascunho`, `abrirPesquisa` (transação: o rascunho ainda é rascunho e nenhuma das pesquisas que a tela conhece está aberta pela conta; grava situação, `abertaEm`, `turmas`), `encerrarPesquisa`, `excluirRascunho`, `gerarNovoLink`.

### Tarefa 6: rotas

- [ ] `PROFESSORES_SUBS`: lista, pesquisas, metas (na ordem das abas). `PERFIL_TABS`: carteira, aulas, nps.
- [ ] Testes de rota atualizados (`routes.professores`, `routes.test`).

### Tarefa 7: a aba Pesquisas (desenho B)

**Arquivos:** `src/views/professores/PesquisasTab.jsx`, `PesquisaForm.jsx`, `Confirmacao.jsx`, `src/lib/__tests__/pesquisasTab.behavior.test.js`.

- [ ] O destaque escuro da pesquisa aberta: nome com o selo, período e "faltam N dias", "Encerrar agora" com a confirmação no lugar, o total "40 de 78 alunos já responderam" e uma linha por professor (foto, nome, "14 de 20 alunos responderam (70%)", barra com a marca da metade, "Já vale" ou "Faltam 3 respostas"). Sem pesquisa aberta, o destaque diz "Nenhuma pesquisa aberta" e o que fazer.
- [ ] O cartão "Próxima" com o rascunho mais recente, as perguntas, "Editar" e "Abrir pesquisa" (desligado, com o motivo, enquanto outra está aberta).
- [ ] O histórico: pesquisa, período, ciclo, situação, respostas ("40 de 78", "ainda não abriu").
- [ ] "Nova pesquisa" abre o formulário em três passos (Nome e datas, Perguntas, Revisar e abrir), com "Salvar rascunho", "Continuar" e, no fim, "Abrir pesquisa" com confirmação. Editar abre o mesmo formulário. O rascunho se exclui no formulário.

### Tarefa 8: lista de professores

- [ ] A aba Pesquisas entre Professores e Metas.
- [ ] O cartão da pesquisa em cima da tabela: "Junho de 2027, aberta até 20/06. 40 de 78 alunos responderam." ou "Nenhuma pesquisa aberta.", com o botão "Ver pesquisas".
- [ ] A coluna NPS com a nota do ano (`criterioNps`).

### Tarefa 9: o perfil

- [ ] Cabeçalho: "Link do NPS" com o endereço, "Copiar link", "Baixar QR code" (PNG pelo `uqr` e um canvas) e, só para o gestor, "Gerar novo link" (com confirmação) ou "Gerar link" quando não há código. Sem código, o professor lê "O gestor ainda não gerou o link."
- [ ] Placar: a nota dos alunos com a nota do ano, a meta e a porcentagem de promotores.
- [ ] Aba NPS: a nota do ano com cada pesquisa, a escolha da pesquisa, a pergunta principal (nota, selo, histograma, promotores e NPS clássico), as respostas contra a turma, as outras perguntas e, só para o gestor, quem respondeu (notas e comentário) e quem ainda não respondeu (a carteira ativa no dia em que abriu, sem quem respondeu, com o aviso de quem não tem CPF).

### Tarefa 10: documentação e conferência

- [ ] `CLAUDE.md`, plano mestre, nota da sessão.
- [ ] `npm run lint && npm test && npm run verificar:sentry && npm run build`.
- [ ] Ver no harness local, gestor e professor, a 1280 e a 375 px.

## Pontos para o Johnny

- Publicar no console as regras das três coleções antes do merge.
- O link ainda não abre nada até o PR 5.
- A pesquisa aberta antes do dia de início grava a turma no dia em que foi aberta (decisão 1).
