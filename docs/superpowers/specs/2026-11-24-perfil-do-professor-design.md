---
status: revisão
data: 2026-11-24
---

# Perfil do professor e NPS dos alunos

## Por que existe

A STRONIX está montando um plano de carreira para o time técnico (Júnior, Pleno e Sênior), começando pelo funcional. O professor sobe de nível por tempo, competência e resultado, com avaliação uma vez por ano, em dezembro. O resultado tem critérios que hoje não existem em lugar nenhum do sistema: a renovação da carteira do professor, o NPS dos alunos dele, a conversão das aulas experimentais e, ainda em definição, a aderência dos alunos às aulas.

Esta spec cria o perfil do professor no Stronilead, com esses critérios no topo, e a pesquisa de NPS que o aluno responde pelo celular. A primeira pesquisa é em junho de 2027, então tudo precisa estar pronto e testado até maio de 2027. Até lá, a renovação continua sendo medida na planilha RENOVAÇÕES, que serve de ponte.

O plano de carreira em si (níveis, competências, salários) é outro documento, feito em outra frente. Aqui entra só o que o sistema mede e mostra.

## Decisões tomadas

Decididas pelo Johnny em 24/11/2026, na conversa que gerou esta spec.

1. **Fica no Stronilead, atrás do módulo da STRONIX.** O módulo que o super-admin liga por academia (`faltosos`, em `src/lib/modules.js`) passa a se chamar "Stronix 2.0" no cartão Módulos do super console. Perfil, pesquisa e página pública só existem com ele ligado. Não é criado um segundo módulo: o papel de professor, a Meta do professor e o perfil nascem sob a mesma chave.
2. **O perfil é do cadastro do professor** (`stronix_professores`), e não do login. Professor sem acesso ao app também tem perfil.
3. **A carteira** são os clientes com o professor no cadastro (`professorId`), contando só os contratos cujo plano tem uma modalidade que o professor dá (`planModalityIds` do plano contra `modalidadeIds` do professor). Na STRONIX, hoje, é o Clube+ Move e os similares do funcional.
4. **Renovação:** renovados ÷ contratos que venceram na carteira, nos 12 meses de dezembro a novembro. É a conta do período inteiro, e não a média das 12 taxas mensais. A carteira vale na data do vencimento, e o contrato com troca de professor nos 90 dias antes do vencimento sai da conta.
5. **NPS:** a nota do professor é a média das notas de 0 a 10 que os alunos dão a ele na pergunta principal, e a meta é nota de promotor, 9 ou mais (correção do Johnny, 24/11/2026, no texto oficial do plano de carreira). Promotor continua sendo quem dá 9 ou 10. A meta fica como parâmetro. A porcentagem de promotores e o NPS clássico (promotores menos detratores) aparecem só como informação, fora da meta. A nota só vale com pelo menos 50% da turma respondendo e pelo menos 10 respostas. São duas pesquisas por ano, e a nota do ano é a média das duas. A meta vale igual para os três níveis, e as respostas ficam salvas sempre, sem prazo para apagar.
6. **A turma** é a carteira ativa de funcional do professor no dia em que a pesquisa abre.
7. **As perguntas são do gestor**, todas de 0 a 10, com a mesma regra de promotor, neutro e detrator. Uma delas é a principal, e só ela conta no plano de carreira.
8. **O CPF é a única porta.** O aluno digita o CPF, o sistema confere que ele é cliente com contrato de funcional na carteira do professor do link e mostra "Oi, Ana!" e as perguntas. Não há link individual por aluno.
9. **O gestor vê quem respondeu**, com as notas e o comentário. O professor vê só os totais. O link é divulgado só entre os alunos ativos, na sala e no WhatsApp.
10. **Aderência:** a conta é por aluno-semana (de segunda a sexta), sem os trancados, pelo relatório de Presenças da Next Fit. A semana é aderente com 2 ou mais presenças na aula de funcional. A barra fica configurável, com o valor 2 decidido. A meta é a faixa de 60% a 70%, igual para os três níveis. A aderência é medida por semestre, e a nota do ano é a média dos dois semestres (decisões do Johnny, 24/11/2026). Os semestres são de janeiro a junho e de julho a dezembro (decisão do Johnny, 25/11/2026). Como a avaliação é em dezembro, antes de o segundo semestre fechar, a proposta é que nela o segundo semestre conte até 30 de novembro, o fim do ciclo, ainda a confirmar.
11. **Conversão:** freepass e aula experimental contam juntos. A taxa é matrículas ÷ pessoas que vieram (decisão do Johnny, 24/11/2026). Só contrato pago conta como matrícula. O padrão é a conversão do professor ficar acima da conversão geral da academia, calculada pelo total da academia, sem folga: a tolerância fica na configuração com valor 0, para o Johnny abrir uma folga depois. Vale igual para os três níveis, e não há mínimo de pessoas no ano.
12. **Só a renovação tem meta por nível** (45, 55 e 65%). A nota dos alunos, a conversão e a aderência valem igual para Júnior, Pleno e Sênior. O plano de reciclagem, para o professor voltar à performance desejada, ainda vai ser desenhado e não entra neste trabalho. A ocupação da turma fica fora do perfil.

## O que já existe no código

- `stronix_professores`: nome, modalidades (`modalidadeIds`) e ativo. Só o gestor grava.
- O lead do cliente guarda `professorId` e `professorName`, gravados pelo Contexto comercial (`src/lib/contextPatch.js`) e pela importação de clientes (`src/lib/clientImport.js`). Quando o professor troca, o valor antigo se perde.
- `stronix_aulas` guarda o professor e a conversão de cada aula experimental, e a aba Por professor do relatório de Visitas e aulas já faz a conta (`professorRowsOf`, em `src/lib/relatorios/leads/visitas.js`).
- O freepass não tem registro próprio: é o mesmo agendamento de aula experimental, com passe de vários dias (`trialClassesPlanned`, gravado no lead; `src/lib/freePass.js`). Cada agendamento gera um registro em `stronix_aulas`, então contar esses registros já soma freepass e aula experimental.
- O `professorRowsOf` conta registros, e não pessoas: quem veio em dois agendamentos com o mesmo professor entra duas vezes. A conversão do perfil conta pessoas, então não reaproveita essa conta como está.
- A matrícula marca `converted` e `convertedAt` só no último registro com "Compareceu" do lead (`markConvertingAula`), e por isso a matrícula vai para o professor dessa última aula.
- `liveRenewalOf` (`src/lib/contracts.js`) diz se um contrato tem renovação ligada e não cancelada.
- A página pública de indicação (`/i/<slug>`) mora na `api/tenant-resolve.js`, com limite por IP e por academia. As funções da Vercel estão em 11 de 12.

## Dados novos

### Histórico de troca de professor, no lead

`professorHistory`: lista de `{ professorId, since }`, na ordem, com `since` null na primeira entrada (o professor de antes do histórico). Todo caminho que grava `professorId` no lead acrescenta uma entrada quando o valor muda, na mesma gravação. O primeiro professor de um lead que não tinha nenhum não grava histórico, para a matrícula e a importação não parecerem troca. Um teste de varredura reprova quem gravar `professorId` sem passar pelo montador do histórico (no molde do `donoDaEpoca.sweep.test.js`). O `professorId` da aula, em `stronix_aulas`, é outra coisa e não entra.

`professorAt(lead, data)` diz quem era o professor numa data. Lead sem histórico vale o professor atual para qualquer data. Por isso a regra dos 90 dias só pega trocas feitas depois do deploy, e o ciclo de dezembro de 2025 a novembro de 2026 usa o professor atual para todos os contratos. A tela avisa isso no ciclo em que o histórico começa.

O histórico fica no próprio lead porque as contas rodam sobre os leads que o app já carrega, sem coleção nova e sem leitura a mais.

### Nível e metas

- `stronix_professores/{id}`: ganha `nivel` (`junior`, `pleno` ou `senior`), `nivelDesde` (data) e `npsCode` (o código do link público, 10 caracteres aleatórios de letras e números).
- `stronix_config/carreira`: as médias esperadas por nível da renovação, editadas pelo gestor, a barra e a faixa da aderência e a janela da conversão. Começa com renovação em 45, 55 e 65% (a confirmar), a barra em 2 aulas por semana, a faixa da aderência em 60% a 70% e a janela da conversão em 30 dias (proposta). A conversão tem mais um parâmetro: a tolerância abaixo da academia, em pontos, com valor 0. A meta do NPS também fica ali, com valor 9. O NPS, a conversão e a aderência não têm meta por nível.

### Pesquisa de NPS

- `stronix_nps_pesquisas/{id}`: nome ("Junho de 2027"), início, fim, o ciclo a que pertence (`ciclo`, ver "As contas"), situação (`rascunho`, `aberta` ou `encerrada`), as perguntas (`{ id, texto, principal }`, de 1 a 5, com exatamente uma principal) e a turma de cada professor (`turmas: { [professorId]: número }`), gravada quando a pesquisa abre. As perguntas só mudam em rascunho. Só uma pesquisa fica aberta por vez. O gestor grava.
- `stronix_nps_respostas/{pesquisaId}_{leadId}`: pesquisa, professor, `leadId`, nome do aluno, as notas (`{ [perguntaId]: 0 a 10 }`), o comentário (até 500 caracteres) e a data. O id faz o próprio banco recusar a segunda resposta. O CPF não é guardado. As respostas, com o nome e o comentário, ficam guardadas sem prazo: não há política de retenção nem expiração (decisão do Johnny, que já guarda dados de clientes na Next Fit). Só o servidor grava, e só o gestor lê.
- `stronix_nps_totais/{pesquisaId}_{professorId}`: a turma, o número de respostas e, por pergunta, a soma das notas (para a média), promotores, neutros e detratores. O servidor soma na mesma transação que grava a resposta. O gestor lê todos, e o professor lê só o dele.

### Aderência

`stronix_presencas/{leadId}_{segunda-feira}`: `leadId`, a semana (segunda-feira, em data ISO), o número de presenças na aula de funcional, a fonte e a data da importação. Grava só o script de importação.

## As contas

Funções puras em `src/lib/professor/`, sem import de tela nem de pacote, com teste. A tela só desenha.

- **Carteira na data:** os clientes cujo professor na data (`professorAt`) é o professor, com contrato de plano da modalidade dele.
- **Renovação do ciclo:** os contratos da carteira com fim previsto no ciclo (o `originalEndsAt`, ou o `endsAt` sem encurtamento, como no Operacional), que chegaram a valer (fora o `neverTookEffect`), sem troca de professor nos 90 dias antes do fim. Renovado é quem tem `liveRenewalOf`. O cancelado antes do fim segue a mesma regra da taxa de renovação do Operacional: o PR 2 reusa a função de lá se ela servir, e um teste compara as duas. A taxa é só a dos 12 meses do ciclo, renovados somados ÷ vencidos somados, sem amostra mínima e sem recuo para anos anteriores (ajuste do Johnny, 24/11/2026). A tela mostra sempre "9 de 15" junto da porcentagem.
- **Conversão:** pessoas que vieram (registros de aula do ciclo, com o professor e com "Compareceu", contando cada lead uma vez por professor) e quantas delas se matricularam (algum desses registros com `converted`). Freepass e aula experimental entram juntos, porque são o mesmo registro. Treino sozinho não entra. A matrícula só conta com contrato pago: o lead precisa ter um contrato com valor acima de zero, que não seja importado (`isImportedContract`) e que tenha chegado a valer (fora o `neverTookEffect`), porque a importação promove a cliente quem tinha só freepass de R$ 0. A aula dos últimos 30 dias fica fora da conta, porque ainda não teve tempo de virar matrícula; os 30 dias são proposta e ficam na configuração. Antes de setembro de 2026 os agendamentos estão incompletos (`APPTS_COMPLETE_MONTH`), e a tela avisa quando o ciclo pega esse trecho. A mesma conta, sobre a academia inteira (todas as pessoas que vieram, pelo total e não pela média dos professores), dá a conversão da academia no ciclo. O professor passa quando a conversão dele fica acima da conversão da academia menos a tolerância. Com tolerância 0, empatar com a academia não passa, porque o padrão pede ficar acima. Não há mínimo de pessoas: o professor com poucas aulas também tem veredito.
- **NPS:** a média de cada pergunta (soma das notas ÷ respostas, com duas casas), a porcentagem de promotores e o NPS clássico, a partir dos totais, e se a pesquisa vale (respostas ≥ 50% da turma e ≥ 10). A meta compara a média da pergunta principal com o parâmetro (9): 9,33 passa, 8,92 não. A nota do ano é a média das notas das pesquisas válidas do ciclo; com uma só válida, vale ela. Cada pesquisa guarda o ciclo a que pertence (`ciclo`, o ano em que o ciclo termina), e o padrão é o ano em que ela abre: a de junho de 2027 e a de dezembro de 2027 contam para o ciclo de dezembro de 2026 a novembro de 2027, avaliado em dezembro de 2027. Assim a primeira avaliação tem as duas pesquisas, como pede o plano de carreira, e a pesquisa de dezembro precisa encerrar antes da avaliação. O gestor pode trocar o ciclo da pesquisa enquanto ela está em rascunho. Esta regra está a confirmar com o Johnny. Sem validade, a tela diz "sem nota válida" e não mostra o número.
- **Aderência:** a taxa do semestre é aluno-semanas aderentes ÷ aluno-semanas que contam no semestre, e a nota do ano é a média das taxas dos dois semestres do ciclo (com um só semestre fechado, vale ele). Os semestres são de janeiro a junho e de julho a dezembro. Na avaliação de dezembro, a proposta (a confirmar) é o segundo semestre contar até 30 de novembro; depois de dezembro fechar, o perfil mostra o semestre inteiro para acompanhamento. A taxa de cada semana continua visível na aba, para o professor ver a tendência. Conta a semana de segunda a sexta de cada aluno da carteira na data (a mesma da renovação), com contrato de funcional em vigor. Ficam fora a semana em que o contrato estava trancado (o trancado paga mas não treina) e a primeira semana do contrato. A semana é aderente com presenças na aula de funcional iguais ou acima da barra (2). A tela mostra também quantos alunos-semana ficaram com 1 presença e com nenhuma, para o professor saber quem chamar. O relatório da Next Fit não traz o professor: quem diz de qual professor é o aluno é a carteira do Stronilead.

## Telas

Todas só com o módulo ligado. Sem ele, os endereços caem em "Não achamos essa tela". O desenho do perfil é a opção B, escolhida pelo Johnny em 24/11/2026: cabeçalho branco com o nome, o nível, a modalidade e o link do NPS numa linha, e embaixo um placar escuro com os quatro critérios em números grandes, cada um com a sua régua (renovação com as marcas dos três níveis, NPS de 8 a 10 com a faixa da meta, conversão com o traço da academia e aderência com a faixa de 60% a 70%). Os mockups estão em `docs/superpowers/specs/mockups/2026-11-24-perfil-professor-b.html` e `-b-professor.html` (a visão do professor logado), na branch `claude/mockup-perfil-professor-1d3637`. A lista de professores, as pesquisas, as metas e a página pública `/avaliar` ainda não têm mockup e seguem a skill `frontend-design`, com 2 ou 3 opções mostradas ao Johnny antes do PR de cada uma.

### Menu e endereços

- O gestor ganha o item "Professores". O professor com login ganha "Meu perfil", que abre o próprio perfil, só para leitura.
- `/<academia>/professores`: a lista.
- `/<academia>/professores/pesquisas` e `/<academia>/professores/metas`: sub-telas.
- `/<academia>/professores/perfil/<id>/<aba>`: o perfil, com as abas `carteira` (padrão), `aulas`, `nps` e `aderencia`. O `perfil/` no caminho segue o molde de `/rotinas/modelos/<id>` e evita que um id se confunda com uma sub-tela.
- `professores` entra em `SCREENS` e em `RESERVED_TENANT_SLUGS`. O id do professor sai do Sentry por uma expressão nova no `sentryScrub.js`, como o id do modelo de rotina.
- O professor só abre o perfil com o próprio `professorId`. Outro id cai em "Essa tela não está liberada para o seu acesso.".

### Lista de professores

- Uma linha por professor ativo: nome, nível e os quatro critérios resumidos, cada um contra a média esperada do nível ("Renovação 60%, esperado 45%").
- No topo, o cartão da pesquisa: "Aberta até 20/06" ou "Nenhuma pesquisa aberta", com o botão que leva às pesquisas.

### Pesquisas

- A lista das pesquisas e o formulário: nome, início, fim, as perguntas e qual é a principal. A pesquisa nova já vem com a principal sugerida, que o gestor pode reescrever: "De 0 a 10, quanto você recomendaria o professor a um amigo?", a pergunta do texto oficial do plano de carreira.
- Abrir grava a turma de cada professor e trava as perguntas. Encerrar fecha a pesquisa antes do fim, e a pesquisa também se encerra sozinha quando o fim passa.

### Perfil

- **Cabeçalho:** nome, nível e desde quando, modalidades e o link do NPS, com "Copiar link", "Baixar QR code" e "Gerar novo link". O gestor troca o nível ali.
- **Faixa dos critérios:** renovação, NPS, conversão e aderência. A renovação mostra a média esperada do nível embaixo, a conversão mostra "8 de 15" com a conversão da academia ao lado ("academia 45%") e se ficou acima ou abaixo dela, e o NPS mostra a média (por exemplo 9,33) com "meta 9" e, menor, a porcentagem de promotores. A aderência mostra a nota do ano (a média dos semestres), a taxa do semestre em andamento, a barra ("2 ou mais aulas por semana") e a faixa de 60% a 70% ao lado. Nenhum critério além da renovação mostra meta por nível. O período é o ciclo de dezembro a novembro, com seta para o ciclo anterior. O ciclo vai no endereço (`ciclo=2026`), na tabela do `screenParams.js`.
- **Carteira:** os alunos com plano, vencimento e situação (a vencer, renovou, não renovou), com filtro em pílulas, no padrão das outras telas. O nome abre a ficha (`LeadLink`). Quem não tem CPF no cadastro leva um aviso, porque não consegue responder o NPS, e o topo da aba diz quantos são.
- **Aulas experimentais:** as pessoas que vieram no ciclo, por aula experimental ou freepass, com a data, se se matricularam e quais ainda estão nos 30 dias.
- **NPS:** escolha da pesquisa, a nota da principal, respostas, porcentagem da turma e se vale, e as outras perguntas embaixo. Só o gestor vê a lista de quem respondeu (nome, notas e comentário) e a de quem ainda não respondeu.
- **Aderência:** no topo, a taxa de cada semestre do ciclo e a nota do ano. Embaixo, as semanas agrupadas por semestre, da mais nova para a mais antiga, cada uma com a taxa e quantos alunos ficaram com 1 presença e quantos com nenhuma, para o professor saber quem chamar. Antes da primeira importação, "Sem dados ainda".
- O professor logado vê o mesmo perfil só para leitura, sem Trocar nível e sem Gerar novo link. O "Copiar link" e o "Baixar QR code" ficam, para ele divulgar a pesquisa (decisão do Johnny, 24/11/2026). A aba NPS mostra só os totais, sem a lista de quem respondeu e sem os comentários.

### Página pública

`/avaliar/<academia>/<código>`, pensada para o celular. `avaliar` entra em `RESERVED_TENANT_SLUGS`, e o `App()` decide a página antes do roteador, como a indicação pública.

1. A logo da academia e "Avalie as aulas do professor Bruno". Sem pesquisa aberta: "Nenhuma pesquisa aberta agora.".
2. O CPF, conferido no formato e nos dígitos verificadores antes de enviar. Embaixo, o texto: "Usamos o seu CPF só para confirmar que você é aluno e para que cada pessoa responda uma vez. A gestão da academia vê a sua resposta. O professor vê só o resultado da turma, sem nomes."
3. "Oi, Ana!", as perguntas com 11 botões de 0 a 10 e o comentário opcional.
4. "Obrigado! Sua resposta foi registrada."

Mensagens de recusa: "Não encontramos esse CPF na turma deste professor. Confira com a recepção." (a mesma para CPF que não existe, para quem não é cliente e para quem é de outra carteira) e "Você já respondeu esta pesquisa.".

## Servidor

Três ações novas na `api/tenant-resolve.js`, sem função nova:

- `nps-info` `{ slug, code }`: marca da academia, primeiro nome do professor, se há pesquisa aberta e as perguntas.
- `nps-check` `{ slug, code, cpf }`: confere e devolve o primeiro nome do aluno, ou o motivo da recusa.
- `nps-answer` `{ slug, code, cpf, notas, comentario, website }`: confere tudo de novo e grava a resposta e os totais numa transação.

O que o servidor confere em cada uma: academia ativa (`loadPublicTenant`), módulo ligado (`hasModule`), professor ativo pelo `npsCode`, pesquisa aberta no horário de Brasília (`api/_horarioDeBrasilia.js`), CPF com 11 dígitos válidos, cliente com esse `cpfDigits`, com o professor no cadastro e com contrato em vigor de plano da modalidade dele. Com mais de um lead com o mesmo CPF, vale o que está na carteira. As notas precisam cobrir todas as perguntas, de 0 a 10, inteiras. O campo invisível `website` preenchido responde sucesso sem gravar.

Sem módulo ou com código desconhecido, a resposta é a do link inválido, igual para todos, para a página não revelar que o recurso existe.

Limites (`checkRateLimit`): os alunos respondem na sala, muitas vezes no mesmo Wi-Fi da academia, e por isso o limite por IP é largo, cerca de 60 conferências a cada 10 minutos. O limite por link é de cerca de 150 por hora. Os números finais ficam no PR 5.

Erros inesperados sobem ao Sentry sem CPF, com a mensagem trocada como no `scrubbedError` da ponte com o Stronizap, e o `verificar:sentry` ganha o CPF da página entre os valores plantados.

## Regras do Firestore

Todas as coleções novas exigem `hasModule(appId, 'faltosos')` além das regras de sempre da academia.

- `stronix_nps_pesquisas`: o membro lê, e o gestor grava.
- `stronix_nps_respostas`: só o gestor lê. Ninguém grava pelo navegador.
- `stronix_nps_totais`: o gestor lê todos, o professor lê os do próprio `professorId`. Ninguém grava pelo navegador.
- `stronix_presencas`: o membro lê. Ninguém grava pelo navegador.
- `stronix_config/carreira`: segue a regra de `stronix_config`.
- `professorHistory` no lead: não muda regra. O consultor e o gestor já gravam qualquer campo do lead, e o campo fica fora da `professorLeadFields()`, então o professor não troca o próprio aluno.

As regras são publicadas à mão no console, com o OK do Johnny, antes do merge do PR que as usa.

## Importação da aderência

Um script em `scripts/` lê o relatório da Next Fit (CSV), casa cada linha com o lead pelo CPF (`cpfDigits`) e grava uma entrada por aluno e semana. Sem `--apply`, só mostra o que gravaria. Linha sem CPF casado vai para a lista de pendências da saída, sem palpite pelo nome. Quem roda toda semana é a sessão do plano de carreira, com o relatório que o Johnny puxar.

A fonte é o relatório de Presenças da Next Fit, filtrado pela aula de funcional (Tipo Agenda, modalidade Treinamento Funcional). A catraca não serve, porque o plano Move também dá acesso à musculação. O script soma as presenças de cada aluno por semana antes de gravar. Base medida pela sessão do plano de carreira em outubro de 2026, nos contratos Clube+ Move: 54% dos 59 contratos (64% dos 50 que apareceram no mês) tiveram 2 ou mais aulas por semana. Os 59 incluem trancados, que a conta do perfil tira.

## Entrega em PRs

Cada PR com tela ou rota fica atrás do módulo. O histórico do PR 1 é a exceção: ele grava em toda academia, porque não tem tela, não muda nada que outro cliente veja e evita condição no caminho que grava o professor. Ordem:

1. **Histórico de troca de professor.** O `professorHistory`, o montador, a leitura (`professorAt`) e a varredura, sem mudar regra do Firestore. Vem primeiro porque o histórico só começa a contar no deploy.
2. **As contas.** As funções de `src/lib/professor/` e os testes, sem tela.
3. **Lista e perfil.** O rótulo "Stronix 2.0", o menu, as rotas, a lista, as metas, o nível, o perfil com Carteira e Aulas experimentais. Mockups antes.
4. **Pesquisa por dentro.** As coleções e as regras, a sub-tela de pesquisas, o link e o QR code no perfil e a aba NPS.
5. **Página pública.** As três ações, os limites e a página `/avaliar`. Antes dele, com o OK do Johnny, uma contagem só de leitura de quantos clientes do funcional têm CPF no cadastro, sem listar CPF.
6. **Aderência.** O script de importação, a conta por semestre e a aba. A conta e o relatório estão decididos. Os semestres são de janeiro a junho e de julho a dezembro, e falta confirmar o corte do segundo semestre na avaliação de dezembro.

Os PRs 1 a 5 cabem até março de 2027. Abril e maio ficam para testar com a Heloísa e acertar o CPF de quem não tem.

## Testes

- **Contas:** professor trocado 60 e 100 dias antes do vencimento, lead sem histórico, contrato que nunca valeu, renovação cancelada, ciclo com poucos contratos (a taxa sai igual, sem aviso), plano de outra modalidade, a mesma pessoa em dois agendamentos (conta uma vez), matrícula com freepass importado de R$ 0 (não conta), aula dos últimos 30 dias (fora), NPS com 49% e 50% da turma, com 9 e 10 respostas, a média dos dois exemplos do plano de carreira (9,33 passa, 8,92 não), a nota do ano com uma e com duas pesquisas válidas, a conta de promotores e detratores por pergunta, a taxa da aderência de um semestre (com semana trancada e primeira semana do contrato fora) e a nota do ano da aderência com um e com dois semestres, e o veredito da conversão de um professor com 3 pessoas (sem mínimo).
- **Histórico:** a varredura de quem grava `professorId` e o montador acrescentando só quando o valor muda.
- **Rota pública,** com o banco falso que imita o SDK de servidor (como `api/__tests__/zapRoute.test.js`): CPF que não existe, de outra carteira, de cliente sem contrato de funcional, resposta repetida, pesquisa fechada, módulo desligado, código desconhecido, nota fora de 0 a 10, pergunta faltando, campo invisível e limite estourado.
- **Regras:** o professor não lê respostas nem os totais de outro professor, ninguém grava resposta pelo navegador, e outra academia não lê nada.
- **Telas:** comportamento da página pública e do perfil em jsdom. As varreduras que já existem (link de ficha, filtros no endereço, papéis em `acesso.js`, anel de foco) cobrem as telas novas.

## Fora do escopo

- Link individual por aluno pelo Stronizap.
- Pesquisa diferente por modalidade ou por professor.
- Ranking entre professores na tela do professor.
- O professor ver nomes ou comentários.
- O documento do plano de carreira.
- O plano de reciclagem, que ainda vai ser desenhado.
- A ocupação da turma, que o Johnny tirou do plano (a confirmar com ele).

## Em aberto

- As médias de renovação por nível (45, 55 e 65%) estão a confirmar e ficam editáveis em `/professores/metas`.
- Na conversão: a janela de 30 dias.
- No NPS: a qual ciclo a pesquisa de dezembro pertence. A proposta é o ciclo que terminou em novembro daquele ano, o que vai ser avaliado naquele dezembro.
- Na aderência: na avaliação de dezembro, se o semestre de julho a dezembro conta até 30 de novembro (proposta) ou se a avaliação da aderência espera janeiro.
- Conferir se a cláusula de LGPD do contrato do aluno cobre pesquisa de satisfação. Se não cobrir, uma linha a mais no contrato resolve.
- Quantos clientes do funcional têm CPF no cadastro (contagem antes do PR 5).
