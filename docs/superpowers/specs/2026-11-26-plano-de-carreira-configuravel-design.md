---
status: revisão
data: 2026-11-26
responsável: Johnny
mockups: `docs/superpowers/specs/mockups/2026-11-26-carreira-editor-a.html` (escolhido) e `2026-11-26-carreira-lista-e-perfil.html`. O `2026-11-26-carreira-editor-b.html` (escada) foi descartado.
---

# Plano de carreira configurável

## O pedido

Nas palavras do Johnny, em 26/11/2026: "montar a feature de plano de carreira completo para que outros gestores possam usar no futuro e eles configurem da maneira que acharem melhor podendo ter configurações diferentes para cada perfil de acesso. Consultor; Professor; Estagiário".

Hoje o perfil do professor (spec `2026-11-24-perfil-do-professor-design.md`) tem três níveis fixos no código (Júnior, Pleno e Sênior, em `src/lib/professor/metas.js`) e quatro números fixos (renovação, nota dos alunos, conversão e aderência). Só a renovação tem meta por nível, e as metas ficam em `stronix_config/carreira`. O consultor não tem plano de carreira no sistema. O estagiário tem um plano escrito (`07-rh/plano-de-carreira/funcional/plano-de-carreira-estagiario-funcional.md`), com níveis I, II e III e avaliação duas vezes por ano, que o sistema não conhece.

## Decisões

Todas do Johnny, em 26/11/2026, no brainstorming desta spec.

1. **O sistema guarda trilhas, níveis e metas.** A avaliação continua fora: competências, horas de formação, reciclagem e a decisão de subir ficam no documento do plano de carreira, e o gestor só troca o nível.
2. **O gestor cria as trilhas.** Consultor, Professor e Estagiário já vêm prontas, e o gestor pode criar outras, como "Professor de pilates".
3. **Uma trilha por pessoa.** O gestor escolhe, e o sistema sugere a que combina com a função, o vínculo e a modalidade.
4. **O consultor tem quatro números:** conversão em matrícula, vendas, renovação da carteira e meta diária batida.
5. **A trilha escolhe a frequência:** uma vez por ano ou duas vezes por ano.
6. **O placar mostra as duas metas:** se o número bateu a meta do nível atual e, embaixo, a meta do próximo nível.
7. **O sistema não diz se a pessoa está pronta para subir.** Mostra o tempo no nível contra o mínimo e o placar, e a conta fica com o gestor.
8. **Fica atrás do módulo Stronix 2.0 por enquanto**, como o perfil do professor. Nada da STRONIX fica fixo no código, então abrir para outras academias depois é uma questão de módulo.
9. **O menu Professores vira Carreira**, com professores, estagiários e consultores. O consultor ganha perfil próprio e o item "Minha carreira".
10. **Vendas contam em reais ou em quantidade**, e quem escolhe é a trilha.
11. **A configuração mora em Configurações → Plano de carreira.** A sub-tela `/professores/metas` sai.
12. **O mês da avaliação e a janela da renovação no semestral também são da trilha** (pedido do Johnny no meio do desenho dos períodos).
13. **Editor no mockup A refinado**: a trilha tem duas abas, "Níveis e metas" (uma grade com os níveis no topo, desenhados como degraus, e os números nas linhas) e "Regras da trilha". O tempo mínimo é a primeira linha da grade, com o mesmo campo das metas.

Decisão técnica, informada ao Johnny: as trilhas moram no documento das metas de hoje, e a trilha e o nível de cada pessoa moram no cadastro dela. Não há coleção nova nem leitura nova, e os níveis Júnior, Pleno e Sênior já gravados continuam valendo sem script.

## O que já existe no código

- `stronix_config/carreira`: as metas de hoje, lidas por `metasDe` (`src/lib/professor/metas.js`), com `renovacao.{junior,pleno,senior}`, `nps.meta`, `conversao.{tolerancia,janelaDias}` e `aderencia.{barra,faixaMin,faixaMax}`. Quem assina é o `useProfessoresDados`.
- `stronix_professores/{id}`: `nivel` (`junior`, `pleno` ou `senior`) e `nivelDesde`, trocados pelo `NivelPopover` do perfil.
- As contas do professor em `src/lib/professor/` recebem o ciclo como um ano (`renovacaoDoCiclo`, `conversaoDoCiclo`, `aderenciaResumo`, `npsDoAno`), e `ciclo.js` fixa o ciclo de 1º de dezembro a 30 de novembro. A pesquisa de NPS guarda o `ciclo` a que pertence (`ciclosDaPesquisa`, em `pesquisas.js`).
- As contas que o consultor vai usar já existem nos painéis: a safra por pessoa no CRM (`src/lib/crm/`), as vendas por quem vendeu no Gerencial (`soldContracts` e `sellersOf`), a coorte de renovação por dono no Operacional (`renewalCohort` e `summarizeCohort`, em `src/lib/operacional/renewal.js`) e os dias batidos da Meta em `stronix_daily_goal_history` (um documento por pessoa e dia, `consultantId` e `date`).
- Rotas: `professores` (lista, pesquisas e metas) e `professorPerfil` (`/professores/perfil/<id>/<aba>`), as duas com o módulo `faltosos`. O professor com login abre o próprio perfil pelo "Meu perfil".

## As trilhas

### Onde moram

No mesmo documento `stronix_config/carreira`, no campo `trilhas`, um mapa por id:

| Campo | O que é |
|---|---|
| `nome` | o nome que aparece em todo lugar |
| `base` | `professor` ou `consultor`. Diz quais números dá para ligar. Não muda com gente na trilha |
| `sugestao` | `{ vinculo, modalidadeIds }`. `vinculo` é `qualquer`, `formado` ou `estagio`. Serve só para sugerir a trilha |
| `frequencia` | `anual` ou `semestral` |
| `mes` | o mês da avaliação, de 1 a 12. No semestral é o primeiro mês, de 1 a 6, e o segundo vem 6 meses depois |
| `janelaRenovacao` | `periodo` ou `12meses`, só no semestral |
| `niveis` | lista na ordem, de 1 a 6 itens: `{ id, nome, mesesMinimos }`. O último tem `mesesMinimos: null` |
| `numeros` | `{ [numeroId]: { ligado, metas: { [nivelId]: número ou null } } }` |
| `ajustes` | `{ janelaDias, barra, faixaMax, vendasEm }`, cada um só onde o número existe |
| `arquivada` | `true` esconde a trilha das listas |
| `ordem`, `updatedAt`, `updatedBy` | ordem na lista e carimbos |

O id do nível nasce na criação e nunca muda: renomear o nível não tira ninguém dele.

A gravação de uma trilha troca o campo `trilhas.<id>` inteiro (`updateDoc` pelo caminho do campo), sem mesclar. Assim um nível apagado não deixa meta sobrando, e duas abas mexendo em trilhas diferentes não se apagam. O documento que ainda não existe é criado antes, com `setDoc` e `merge`.

### As três que já vêm prontas

Moram no código, com ids fixos (`professor`, `estagiario` e `consultor`), e a trilha gravada com o mesmo id vence a do código. Trilha padrão também se arquiva: ela fica gravada com `arquivada: true`.

| Trilha | Base | Níveis (meses mínimos) | Frequência | Metas |
|---|---|---|---|---|
| Professor | professor, vínculo formado | Júnior (12), Pleno (24), Sênior | anual, dezembro | as que a STRONIX já gravou |
| Estagiário | professor, vínculo estágio | Estagiário I (6), Estagiário II (6), Estagiário III | semestral, junho e dezembro, renovação em 12 meses | renovação 45% nos três, nota 9, conversão 0 pontos, aderência 60% |
| Consultor | consultor | Júnior (12), Pleno (24), Sênior | anual, dezembro | em branco |

Os níveis da trilha Professor têm os ids `junior`, `pleno` e `senior`, os mesmos que o `nivel` dos professores já guarda.

Enquanto `trilhas.professor` não existe, a trilha Professor lê as metas de hoje, no topo do documento, pela conta do `metasDe`: renovação por nível, nota, `-tolerancia` como pontos da conversão, `faixaMin` como meta da aderência, e `janelaDias`, `barra` e `faixaMax` como ajustes. Na primeira gravação, a trilha passa a valer sozinha, e o topo fica parado como histórico.

### O que o sistema recusa

A regra mora numa função pura (`problemaDaTrilha`), que a tela usa para dizer o que falta e que roda de novo antes de gravar:

- nome vazio, ou igual ao de outra trilha não arquivada;
- menos de 1 ou mais de 6 níveis, nome de nível vazio ou repetido na trilha;
- tempo mínimo que não é número inteiro de 1 a 120 meses;
- meta fora do limite do número (abaixo);
- mudar a `base` com gente na trilha;
- apagar um nível que tem gente;
- arquivar a trilha que tem gente.

"Tem gente" se confere na hora do clique, com a lista de professores e de usuários que o app já tem. Meta em branco não é recusa: a trilha salva, e o placar mostra o número sem dizer se bateu.

## Os números e as metas

A lista dos números mora no código (`src/lib/carreira/numeros.js`). Cada número sabe a base, o formato da meta, o limite e a conta. A meta de cada nível é um número só, e o placar diz que bateu quando o resultado chega nela.

### Trilhas de professor

| Número | Meta por nível | Bate quando | Ajuste da trilha |
|---|---|---|---|
| Renovação da carteira | porcentagem, de 0 a 100 | taxa ≥ meta | |
| Nota dos alunos | nota, de 0 a 10 | nota do período ≥ meta | |
| Conversão em matrícula | pontos em relação à academia, de −50 a +50 | taxa > academia + pontos | `janelaDias` (30): aulas recentes que ainda não contam |
| Aderência às aulas | porcentagem, de 0 a 100 | taxa ≥ meta | `barra` (2 aulas na semana) e `faixaMax` (70%), o fim da faixa que o placar desenha |

As contas são as de hoje, do perfil do professor. A conversão com 0 pontos é a regra de hoje: passa quem fica acima da academia, e empate não passa. A regra da pesquisa válida (10 respostas e metade da turma) continua fixa.

### Trilhas de consultor

| Número | O que mede | Meta por nível |
|---|---|---|
| Conversão em matrícula | dos leads de que o consultor é dono, cadastrados no período, quantos se matricularam até agora, contra a mesma conta na academia inteira. É a safra por pessoa do painel CRM, somada nos meses do período | pontos em relação à academia, como no professor |
| Vendas | matrículas e renovações que o consultor fechou no período, pela data do fechamento, como no Gerencial. Em reais (valor dos contratos, não o caixa) ou em quantidade, como a trilha escolher, divididas pelos meses do período. O mês em andamento conta pelos dias corridos | valor por mês (o campo é em mil reais e a gravação, em reais) ou quantidade por mês |
| Renovação da carteira | dos clientes de que o consultor é dono hoje, cujo contrato venceu no período, quantos renovaram. É a coorte de renovação do Operacional, filtrada pelo dono | porcentagem |
| Meta diária batida | dos dias de meta do período (os dias da semana da Meta, em `metaWeekdays`, até ontem), em quantos há documento em `stronix_daily_goal_history` | porcentagem dos dias |

Na renovação do consultor vale o dono de hoje, porque o sistema não guarda o dono de cada data: quem recebe uma carteira migrada leva junto os vencimentos dela, como no Operacional. Na conversão e nas vendas vale o dono do lead e o vendedor do contrato, que já são as regras dos painéis. Importado não conta como lead novo, matrícula nem venda, também como nos painéis.

## Os períodos

A conta mora em `src/lib/carreira/periodo.js` e substitui o `ciclo.js` nas contas do professor.

- **Período:** os 12 meses (anual) ou os 6 meses (semestral) que terminam no fim do mês anterior ao mês da avaliação. Avaliação em dezembro dá de 1º de dezembro a 30 de novembro, como hoje. Em março, de 1º de março a 28 ou 29 de fevereiro.
- **Semestral:** dois períodos por ano. Com junho e dezembro, de 1º de dezembro a 31 de maio e de 1º de junho a 30 de novembro.
- **Chave do período:** o ano da avaliação no anual (`2027`) e o ano com o número da avaliação no semestral (`2027-1`, `2027-2`). Vai no endereço do perfil, no parâmetro `ciclo`, como hoje.
- **Renovação:** no anual, o período. No semestral, o período ou os 12 meses que terminam no fim dele, pela `janelaRenovacao`.
- **Aderência, anual:** a média das taxas dos semestres do calendário (janeiro a junho e julho a dezembro) que caem dentro do período, cada um cortado nas pontas do período, sem as semanas de dezembro. Com a avaliação em dezembro isso dá a regra de hoje: janeiro a junho e julho a novembro. A semana pertence ao dia da segunda-feira, como hoje.
- **Aderência, semestral:** as semanas do período, sem as de dezembro.
- **Nota dos alunos:** a pesquisa conta na primeira avaliação da trilha que cai no mês em que ela abre ou depois. A de junho conta em junho no semestral e em dezembro no anual, e a de dezembro conta em dezembro. Com uma pesquisa válida, vale ela, e com duas, a média, como hoje. O campo `ciclo` da pesquisa deixa de ser lido e sai do formulário, porque com trilhas de calendários diferentes ele não diz mais nada.
- **Conversão, vendas e meta diária:** só o período.
- **Mudar o mês ou a frequência** muda os períodos de todos na trilha, inclusive os passados. É só leitura, então voltar o mês devolve tudo como era.

## A pessoa

### O que se grava

`trilhaId`, `nivel` (o id do nível na trilha) e `nivelDesde` (data):

- no professor e no estagiário, em `stronix_professores/{id}`, onde `nivel` e `nivelDesde` já existem;
- no consultor, em `stronix_users/{id}`.

Professor sem `trilhaId` é lido como trilha `professor`. `nivel` que não existe na trilha é lido como "sem nível". A troca vale da data em diante e não reescreve nada do passado, como o "Trocar nível" de hoje.

### A sugestão

Função pura (`trilhaSugerida`): entre as trilhas não arquivadas da base da pessoa (consultor ou professor), a primeira, na ordem da lista, cujo vínculo combina e cujas modalidades cruzam com as do professor. Enquanto o cadastro da equipe (spec `2026-11-26-cadastro-da-equipe-design.md`) não estiver no ar, o vínculo da pessoa não é conhecido: a sugestão fica entre as trilhas de vínculo `qualquer` ou `formado`, e o gestor marca o estagiário à mão. Quando o cadastro chegar, o vínculo `estagio` da ficha passa a sugerir a trilha de estágio.

### Quem aparece

Professores ativos (`stronix_professores` com `ativo` diferente de `false`) e consultores (o papel consultor, pelo `roleOf` de `src/lib/acesso.js`). O gestor fica fora, mesmo quando também vende.

## As telas

### Configurações → Plano de carreira (mockup A)

Seção nova do trilho das Configurações, no grupo Equipe, depois de Equipe & acessos, só para o gestor e só com o módulo.

- **Lista das trilhas** em `/configuracoes/carreira`: um cartão por trilha com o ícone da base, o nome, para quem e quantas pessoas, uma mini escada com os níveis, quando avalia e quantos números contam. "Nova trilha" no cabeçalho e as arquivadas recolhidas no fim, com "Desarquivar".
- **A trilha** em `/configuracoes/carreira/<id>`: cabeçalho com o nome, as etiquetas "Para professores formados", "7 pessoas nesta trilha" e "Avaliação em dezembro", e "Arquivar trilha", desligado com o motivo quando há gente. Embaixo, duas abas, no endereço: `/configuracoes/carreira/<id>` e `/configuracoes/carreira/<id>/regras`.
- **Aba Níveis e metas:** uma grade só.
  - O topo tem uma coluna por nível, com um degrau que cresce da esquerda para a direita, o número do nível, o nome (editável no lugar) e quantas pessoas estão nele. A última coluna tem "+ Nível".
  - A primeira linha é "Tempo mínimo no nível", com o campo de meses e "último nível" no último.
  - As outras linhas são os números da base da trilha, cada uma com o liga e desliga, o ícone, o nome e uma legenda curta, e um campo por nível com a unidade dentro ("45 % ou mais", "9 ou mais", "0 pts", "R$ 12 mil"). O campo em branco fica tracejado, com "sem meta". O número desligado ocupa a linha inteira com "Não conta nesta trilha".
  - No pé da grade, o aviso das metas em branco e o link para as regras.
- **Aba Regras da trilha**, em três blocos:
  - Quem segue: para quem, travado com gente na trilha, e a sugestão (vínculo e modalidades);
  - Quando avalia: frequência, mês ou meses e, no semestral, a janela da renovação;
  - Como cada número conta: o texto de cada número ligado e o ajuste dele.
- **Barra de salvar** presa embaixo, com o que falta ("12 metas em branco. A trilha salva assim.") e os botões Descartar e Salvar trilha. Trocar de aba não perde o que foi digitado: o rascunho é da trilha, e não da aba.

### Menu Carreira

Substitui o item Professores, com as mesmas travas (gestor e módulo).

- **Lista** em `/<academia>/carreira`:
  - no cabeçalho, o cartão da pesquisa aberta, com o botão Pesquisas;
  - a pílula **Trilha**, com a contagem de cada uma, no endereço (`trilha=<id>`, ausente é todas), e a busca pelo nome, que fica fora do endereço;
  - a tabela tem: pessoa (iniciais ou foto, nome e trilha), nível e desde quando, tempo no nível com uma barrinha contra o mínimo ("8 meses de 1 ano", "Faltam 4 meses para Pleno" ou "Tempo mínimo cumprido") e os números do período, com um quadradinho por número (verde na meta, vermelho abaixo, cinza sem dados, tracejado sem meta) e "3 de 4 na meta do Júnior";
  - quem não tem trilha aparece com "Sem trilha" e "Definir trilha e nível";
  - a linha inteira abre o perfil (`AppLink`).
- **Pesquisas** continua sub-tela, em `/carreira/pesquisas`, sem o campo do ciclo.
- **Perfil do professor e do estagiário** em `/carreira/professor/<id>/<aba>`: o de hoje, com as abas Carteira, Aulas experimentais, NPS e Aderência. O que muda:
  - o "Trocar nível" vira "Trilha e nível": um balão com a trilha (a sugerida marcada com "sugerida"), o nível dela e a data. Trocar a trilha pede o nível de novo;
  - o placar mostra só os números ligados na trilha. Cada régua ganha o traço laranja da meta do nível atual e o traço tracejado da meta do próximo nível, e embaixo vem a linha "Para Pleno: 55%". No último nível, só a meta atual;
  - o cabeçalho mostra o tempo no nível contra o mínimo.
- **Perfil do consultor**, novo, em `/carreira/consultor/<id>/<aba>`, no desenho do perfil do professor:
  - cabeçalho com as iniciais, a trilha, o nível e o "Trilha e nível", e o tempo no nível;
  - o mesmo placar escuro com os números da trilha;
  - quatro abas: Vendas (os contratos fechados no período, com data, cliente, tipo, plano e valor, e no topo o total de vendas e o valor, "valor dos contratos, não o que entrou no caixa"), Renovação (os clientes que venceram no período, renovou ou não), Conversão (os leads do período e quem se matriculou) e Meta diária (os dias de meta, bateu ou não);
  - cada nome abre a ficha (`LeadLink`).
- **Minha carreira:** o "Meu perfil" do professor passa a se chamar assim, e o consultor com o módulo ganha o mesmo item. Os dois abrem o próprio perfil só para leitura, com a faixa "Só leitura. Quem troca trilha, nível e metas é o gestor." e sem o "Trilha e nível". O professor continua vendo só os totais do NPS. Outro id no endereço cai em "Essa tela não está liberada para o seu acesso.".

### Endereços

- `carreira` entra em `SCREENS` e em `RESERVED_TENANT_SLUGS`. `professores` continua reservado.
- Os endereços antigos caem nos novos, com replace: `/professores` em `/carreira`, `/professores/pesquisas` em `/carreira/pesquisas`, `/professores/metas` em `/configuracoes/carreira` e `/professores/perfil/<id>/<aba>` em `/carreira/professor/<id>/<aba>`.
- Configurações ganha a seção `carreira` em `SETTINGS_SECTIONS`. A trilha aberta e a aba dela são lidas à parte no `readScreen`, no molde do modelo de rotina.
- O `sentryScrub.js` troca `/carreira/professor/<id>` e `/carreira/consultor/<id>` por `:pessoaId` e `/configuracoes/carreira/<id>` por `:trilhaId`, encadeado com as outras trocas, com teste.
- O título da aba no perfil não leva o nome da pessoa, como hoje.

## Regras do Firestore

Uma mudança só. No `stronix_users`, o ramo em que a própria pessoa grava o próprio cadastro ganha a trava `carreiraKept()`: `trilhaId`, `nivel` e `nivelDesde` não mudam. Sem ela, o consultor conseguiria se promover. O gestor continua gravando pelo ramo `isAdmin`. O `src/lib/__tests__/` ganha um teste no molde do `professorRules.test.js` que lê a regra.

`stronix_config` e `stronix_professores` não mudam: o gestor já grava os dois. O nível fica visível para a equipe, como o do professor já fica hoje.

A regra é publicada no console, com o OK do Johnny, antes do merge do PR que a usa.

## Custo de leitura

- A lista e o perfil do consultor leem os leads cadastrados no período (até 12 meses) e os leads por `convertedAt` e `clienteSince` pelo `useCrmSources`, a mesma carga dos painéis, guardada na sessão.
- Vendas e renovação usam os contratos que o app já assina (`useGeneralConfig`).
- A Meta diária lê `stronix_daily_goal_history` pelo `date` dentro do período (campo único, sem índice) uma vez para a lista inteira, e pelo `consultantId` no perfil.
- As trilhas vêm na assinatura do `stronix_config/carreira` que já existe.

## Entrega em PRs

Cada PR com tela ou rota fica atrás do módulo.

1. **Trilhas e contas, sem tela nova.** `src/lib/carreira/` com as trilhas padrão, a leitura do documento (com a ponte das metas de hoje), `problemaDaTrilha`, a lista dos números e `periodo.js`. As contas do professor passam a receber o período no lugar do ano, a pesquisa conta pela data em que abre e o placar de hoje passa a ler a trilha Professor. Um teste de equivalência confere que, com a trilha Professor padrão e o mês de dezembro, os quatro números saem iguais aos de hoje para cada ciclo.
2. **Configurações → Plano de carreira.** A seção no trilho, a lista das trilhas e o editor do mockup A, e a gravação por caminho do campo. Sai a sub-tela `/professores/metas`, com o endereço levando à seção nova.
3. **Menu Carreira.** As rotas novas e as antigas apontando para elas, a lista com a pílula Trilha, o "Trilha e nível" com a sugestão, o placar com as duas metas e o tempo no nível, o "Minha carreira" e a regra `carreiraKept()`. A partir daqui o estagiário funciona.
4. **Perfil do consultor.** As quatro contas do consultor, reaproveitando as dos painéis, e a tela com as quatro abas. O consultor aparece na lista Carreira a partir deste PR.

## Testes

- **Períodos:** anual em dezembro e em março, semestral em junho e dezembro e em janeiro e julho, ano bissexto, chave do período e a semana pela segunda-feira.
- **Aderência:** a regra dos semestres do calendário com dezembro fora, no anual e no semestral, e o caso de dezembro igual ao de hoje.
- **Pesquisa:** a de junho no semestral e no anual, a de dezembro, a de janeiro e a aberta depois do mês da avaliação.
- **Equivalência:** a trilha Professor padrão contra as contas de hoje nos quatro números.
- **Trilhas:** a ponte das metas de hoje, a gravada vencendo a do código, `problemaDaTrilha` em cada recusa, a trilha arquivada e o nível com gente.
- **Sugestão:** professor de duas modalidades, consultor, sem vínculo conhecido e trilha arquivada.
- **Consultor:** cada conta contra a do painel de origem (CRM, Gerencial e Operacional) num mês fechado, vendas em reais e em quantidade com o mês em andamento proporcional, e a meta diária sem os dias de folga.
- **Placar:** meta do nível atual e do próximo, último nível e meta em branco.
- **Regra:** a própria pessoa não troca `trilhaId`, `nivel` nem `nivelDesde`, e o gestor troca.
- **Telas em jsdom:** a grade do editor (ligar e desligar, meta em branco, apagar nível com gente, trocar de aba sem perder o rascunho), a lista com a pílula, o "Trilha e nível" e o "Minha carreira" sem botões de gestor. As varreduras que já existem (link de ficha, filtros no endereço, papéis em `acesso.js`, anel de foco, fundo da página) cobrem as telas novas.

## Fora do escopo

- Avaliação no sistema: competências, horas de formação, reciclagem, decisão de subir e histórico de níveis.
- Salário e bolsa de cada nível.
- Veredito de "pronto para subir".
- Mais de uma trilha por pessoa.
- Escolher meses fora da regra (por exemplo, avaliação em março e outubro).
- Tirar outros meses além de dezembro da aderência.
- O gestor na lista Carreira.
- Abrir para academias sem o Stronix 2.0.

## Em aberto

- As metas da trilha Consultor nascem em branco e precisam ser preenchidas pelo Johnny em Configurações → Plano de carreira.
- Em que nível entram os estagiários que já estão na equipe (ponto em aberto do plano do estagiário), que o gestor marca à mão.
- Se a renovação do consultor deve contar o dono da época do vencimento, o que pede guardar o histórico de dono no lead, como o `professorHistory`.
