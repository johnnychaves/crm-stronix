# Filtros no endereço e a lista que volta igual, entrega 2

status: ativo
data: 2026-09-23

## Por que

A entrega 1 deu endereço a cada tela e a cada ficha (PRs #216 a #219, em produção). Falta o que o Johnny pediu junto: a tela não zerar.

Hoje, dentro de uma tela, tudo que a pessoa escolhe vive só na memória. Toda troca de tela desmonta o componente, então some:

- o mês, o comparativo e a pessoa nos três dashboards;
- o responsável, a fase, a situação e os atrasados nas listas;
- o dia ou o período em Aulas e Visitas;
- a categoria aberta na Meta diária;
- a seção das Configurações e a aba da ficha;
- o "carregar mais" e a rolagem.

Abrir uma ficha é o caso que mais dói, porque a ficha entra no lugar da tela: quem volta perde o recorte inteiro e a lista recomeça do topo.

## O que muda para quem usa

- O que você escolhe na tela fica no endereço, então F5 mantém, o link mandado para um colega abre igual, e cada aba pode estar num recorte diferente.
- Voltando da ficha, a lista aparece do jeito que você deixou: mesmo filtro, mesmo "carregar mais", mesma rolagem. A linha da pessoa que você acabou de mexer já aparece atualizada.
- As Configurações passam a ter endereço por seção, e a ficha por aba.
- Nada muda para quem só usa os padrões: link limpo abre a tela como sempre abriu.

## Decisões do Johnny (23/09/2026)

1. Ao voltar da ficha, a lista volta igual, e a linha de quem foi mexido na ficha é atualizada na hora.
2. Sair da lista para outra tela e voltar não precisa devolver o "carregar mais" nem a rolagem. Os filtros voltam pelo endereço e a lista começa do topo, com dado fresco.
3. Trocar filtro NÃO cria parada no voltar do navegador. O voltar continua levando à tela anterior.
4. O funil vai para o endereço, e o último funil usado continua valendo como padrão quando o link não traz nenhum.
5. Filtro de responsável só vale para quem enxerga o controle na tela. Para os demais, o parâmetro é ignorado.
6. A visão Equipe da Meta diária fica FORA desta entrega.
7. O filtro de fase (Todos os leads) entra no endereço pelo código da etapa. O filtro de plano (Clientes) fica fora desta entrega, porque o dado guarda o nome do plano.
8. Entrega dividida em dois PRs: primeiro os filtros e as sub-telas, depois a lista viva por trás da ficha.

## O que entra no endereço, tela por tela

Nome ausente sempre quer dizer o padrão de hoje. O endereço limpo abre a tela como ela sempre abriu.

| Tela | Caminho | Query |
|---|---|---|
| Operacional | `/<academia>` | `mes=AAAA-MM` · `comparar=0` · `comparar-com=AAAA-MM` · `pessoa=<id>` |
| CRM | `/<academia>/visao-geral/crm` | `mes` · `comparar` · `comparar-com` · `pessoa` · `funil=<id>` |
| Gerencial | `/<academia>/visao-geral/gerencial` | `mes` · `comparar` · `comparar-com` |
| Pipeline | `/<academia>/pipeline` | `funil=<id>` · `resp=id1,id2` · `atraso=1` |
| Clientes | `/<academia>/clientes` | `sit=ativo,a_vencer` · `resp=id1,id2` |
| Todos os leads | `/<academia>/leads` | `funil=<id>` · `fase=<id da etapa>` · `resp=` · `atraso=1` · `quente=1` |
| Aulas | `/<academia>/leads/aulas` | `dia=hoje\|ontem\|amanha\|andamento` OU `de=AAAA-MM-DD&ate=AAAA-MM-DD` · `resp=` · `prof=<id>` |
| Visitas | `/<academia>/leads/visitas` | `dia=...` OU `de=&ate=` · `resp=` |
| Meta diária | `/<academia>/meta-diaria` | `cat=<categoria>` |
| Configurações | `/<academia>/configuracoes/<secao>` | nenhuma |
| Ficha | `/<academia>/ficha/<id>/<aba>` | nenhuma |

Seções das Configurações: `visao-geral`, `equipe`, `transferencia`, `indicacoes`, `importacao`, `ritmo`, `agenda`, `funis`, `catalogos`, `stronizap`.

Abas da ficha: `linha-do-tempo`, `crm`, `contratos`, `indicacoes`. Sem aba no endereço, abre na primeira, como hoje.

O `funil` do CRM é o recorte daquele dashboard e não é o mesmo estado do funil do Pipeline. São telas diferentes, e cada uma lê o seu.

### Regras de leitura dos parâmetros

- **Ausente é o padrão.** Nunca se escreve no endereço um valor que já é o padrão, para o link ficar curto e o F5 não gravar escolha que ninguém fez.
- **Valor inválido ou que sumiu cai no padrão, sem aviso.** Consultor desligado, funil apagado, etapa que mudou de código, mês fora da janela de 12 meses, período maior que 30 dias em Aulas e Visitas, data invertida: a tela abre funcionando com o padrão. O endereço NÃO é reescrito na entrada: o valor ruim continua na barra até a primeira escolha de filtro, e some ali. Corrigir na entrada exigiria um effect lendo a URL para navegar, que é o padrão que esta entrega existe para tirar do app. O aviso de "não achamos essa tela" continua valendo só para tela desconhecida, não para filtro.
- **`resp` tem três estados:** ausente é o padrão do papel (o consultor abre na própria carteira, o gestor na equipe), `resp=` vazio é "todos", e com ids é a lista escolhida.
- **`dia` e o par `de`/`ate` são exclusivos.** Vindo os dois, vale o par de datas, que é o mais específico.
- **`comparar=0`** é a única forma escrita do comparativo, porque ligado é o padrão. `comparar-com` sem `comparar=0` escolhe o mês da comparação.
- **Nada de dado pessoal.** Texto de busca, nome, telefone e CPF nunca vão para o caminho nem para a query. Id de pessoa do time vai, como o id do lead já vai hoje.
- **`invite`, `t` e `ref` continuam reservados** para o convite e a indicação pública.

## Como funciona por dentro

### Um módulo puro para a tradução

`src/lib/screenParams.js` (novo, puro, testado em node) guarda, por tela, a tabela de parâmetros: nome curto, tipo (texto, lista, booleano, mês, data), valor padrão e a função que sanea. Ele expõe a leitura (query para valores da tela) e a montagem (valores para query, omitindo o que é padrão). As telas não leem a query direto, e `src/lib/routes.js` continua dono do caminho.

Saneamento depende de dado que só a tela tem (lista de usuários, funis, etapas, meses com venda). Por isso a função de saneamento recebe esse contexto e roda no render, como o CRM já faz hoje com pessoa e funil.

### Filtro é navegação, não estado

Cada tela deixa de guardar o filtro em `useState` e passa a recebê-lo pronto, derivado no render a partir de `useLocation()`. Trocar filtro chama `navigate(href, { replace: true })`, conforme a decisão 3.

Isso é obrigação técnica, não gosto: ler o endereço num effect e gravar em estado é o padrão que hoje prende a seção das Configurações (a seção é lida uma vez só, e por isso o "Configurar agora" não troca a seção com a tela aberta), e o lint react-hooks v7 do projeto reprova.

### Sub-telas no caminho

A seção das Configurações e a aba da ficha entram no caminho, no molde que as subabas do super-admin já usam. Elas NÃO entram na chave que identifica a tela (`screenKey`), senão trocar de seção ou de aba remonta a tela inteira e refaz as leituras. É a mesma armadilha que a entrega 1 já tratou na subaba do super-admin.

Sub-tela desconhecida (`/configuracoes/xyz`, `/ficha/<id>/xyz`) abre a tela-mãe na primeira seção, com replace e sem aviso. O aviso de tela não encontrada fica para endereço de tela, não para sub-tela.

### A lista viva por trás da ficha

Hoje a ficha entra no lugar da tela. Ela passa a entrar por cima: a tela de baixo continua montada e escondida enquanto a ficha está aberta. É isso que preserva filtro, "carregar mais" e rolagem sem guardar nada em memória extra e sem leitura nova ao voltar.

Consequência conhecida e aceita: a lista mostra o que foi lido quando a ficha abriu. Para o caso que mais incomoda, a linha da própria pessoa que acabou de ser mexida, a ficha avisa a lista e ela atualiza aquela linha (`patchItem` do `usePagedLeads`, que já existe e é subusado).

A rolagem restaurada passa a valer também para os containers que rolam por dentro (quadro do Pipeline, colunas da Meta), e não só para a página.

### Custo de leitura

- A maioria dos filtros é aplicada no navegador sobre dados já carregados, então trocar filtro não custa leitura.
- Mês e comparativo dos dashboards e o período de Aulas e Visitas são consulta de verdade. Vale a memória de sessão que o Operacional e o CRM já usam, e o período de Aulas e Visitas mantém o teto de 30 dias.
- **Nada da entrega 2 entra em `screenKey`, na key do `AppErrorBoundary` nem em key de lista.** Se entrar, cada clique de filtro recria a tela e relê a coleção inteira. Não quebra nada e não aparece no console, só na fatura.
- O que for guardado por academia (memória de sessão, rolagem) leva a academia na chave, porque o "Acessar como" troca de academia sem recarregar a página.

### Decidido na montagem do PR 1

- O endereço é montado com o caminho de agora, e não com `hrefFor`: o Operacional tem dois endereços válidos (`/<academia>` e `/<academia>/visao-geral/operacional`) e trocar entre eles no meio da sessão empilharia entrada nova com a mesma chave de tela.
- Sub-tela também usa replace. Com push, o Voltar da ficha andaria entre abas em vez de voltar para a lista. A exceção é quem chega de outra tela: aí o `goToSub` empilha, senão o "Configurar agora" de uma novidade apagaria do histórico a tela em que a pessoa estava.
- O funil das telas de lista é escrito sempre que vale, e é a única exceção à regra "o padrão nunca é escrito": o padrão dele é o último funil usado por cada pessoa, então omitir faria o mesmo link abrir em funis diferentes para duas pessoas.
- A fase de Todos os leads aceita lista de códigos separados por vírgula, e não um só, porque o filtro da tela sempre foi de múltipla escolha.
- O filtro que vem do endereço continua sobrevivendo só ao redirect que mantém a tela (a correção de academia). Os outros quatro vão para outra tela e descartam, que é o que já acontecia. Quando a correção perde a tela, a query que sobra é inofensiva, porque todo parâmetro é saneado contra os dados da academia da sessão e nome desconhecido é ignorado.
- Clicar no item do menu da tela em que já se está limpa os filtros e cria uma parada no voltar, porque o item do menu é um link e o link empilha. O item do menu é o estado zero da tela, e o voltar devolve a tela filtrada.
- O endereço não é reescrito na entrada. Valor inválido é ignorado na leitura e some na primeira escolha de filtro.
- A seção Importar clientes das Configurações só existe na sessão assumida do super console. Com a seção no caminho, quem abrir `/configuracoes/importacao` sem essa sessão cai na seção padrão, calado, em vez de ver o lado direito em branco.

### Dívida conhecida que este PR não criou e não consertou

`scrollActionFor` devolve `'none'` quando a chave da tela não muda, e nesse ramo o `useRouteScroll` grava a posição por cima, inclusive no voltar. Num push para a mesma tela isso apaga a posição guardada daquela entrada. Já é alcançável hoje pelo item Operacional do menu vindo de `/visao-geral/operacional`, e o filtro não piora nada porque usa replace, que nasce com chave nova. Fica para o PR 2, junto com a rolagem dos containers internos.

## Entrega em dois PRs

1. **Filtros e sub-telas no endereço.** `screenParams.js` com testes, as dez telas derivando filtro do endereço, Configurações por seção e ficha por aba, e saneamento silencioso, sem reescrever o endereço. O `backTarget` do Voltar da ficha fica como está, pelo motivo registrado no risco da ficha aberta em outra guia.
2. **A lista viva por trás da ficha.** A ficha passa a cobrir em vez de substituir, a linha mexida é atualizada, e a rolagem restaurada cobre os containers internos.

## Testes

- `screenParams.test.js`: por tela, leitura e montagem de cada parâmetro, ida e volta, ausente é padrão, valor inválido cai no padrão, `resp` nos três estados, exclusividade entre `dia` e `de`/`ate`, teto de 30 dias, e a garantia de que o padrão nunca é escrito no endereço.
- Testes de saneamento com contexto: pessoa que saiu, funil apagado, etapa que mudou de código, mês fora da janela, mês de comparação sem venda no Gerencial.
- `routes.test.js` ganha as sub-telas (seção das Configurações, aba da ficha) e a garantia de que elas ficam fora do `screenKey`.
- Teste de que o filtro de responsável é ignorado para quem não vê o controle.
- `filtrosNoEndereco.sweep.test.js`: a varredura que cobra o padrão de toda tela nova. Nenhuma view lê a query, nenhuma guarda em estado o que virou parâmetro, nenhum parâmetro entra em `key`, a troca de filtro é replace com o state repassado, e nenhum `navigate` de `src/` grava state próprio num replace que pode ser a primeira entrada, porque é disso que o Voltar da ficha depende.
- `sentryScrub.test.js` ganha a query de filtro: id de colega e id de funil saem da URL, da migalha de navegação e de `url.path` antes de o evento sair do navegador.
- No PR 2: teste puro da decisão de atualizar a linha, e o restante por conferência manual no preview, porque efeito de tela não roda em node sem jsdom.

## Conferência manual no preview

Sempre no preview da Vercel, nunca com o dev local apontado para a produção. O que cria ou apaga dado é feito na `academia-teste`.

- Escolher mês, comparativo e pessoa no Operacional, dar F5 e ver tudo igual. Mandar o link para outra aba e abrir igual.
- Trocar oito filtros seguidos e apertar voltar uma vez: sai da tela, não desfaz filtro.
- Pipeline: escolher funil, dar F5, e abrir o mesmo link em outra aba com outro funil escolhido.
- Todos os leads: filtrar por fase, renomear a etapa em Configurações e reabrir o link. A tela abre na fase certa.
- Link com `resp` de um gestor aberto por um consultor: a lista aparece inteira, sem recorte preso.
- Aulas: período de 40 dias no endereço abre com o período padrão, sem erro.
- Configurações: link direto para `/configuracoes/funis`, e "Configurar agora" de uma novidade trocando a seção com a tela já aberta.
- Ficha: link direto para a aba Contratos, e trocar de aba sem a ficha recarregar.
- Voltar da ficha (PR 2): lista igual, com o "carregar mais" e a rolagem, e a linha da pessoa mexida já atualizada.
- Celular: filtro, voltar e rolagem das listas que rolam por dentro.

## Riscos conhecidos

- Endereço com filtro entra no histórico do navegador do computador da recepção, inclusive id de colega. É o mesmo grau do id de lead que já existe desde a entrega 1.
- Preservar a lista tira a atualização de graça que a remontagem dava hoje. Fora da linha mexida, o resto da lista só se atualiza no F5 ou ao trocar de filtro.
- Ficha aberta em outra guia (a setinha do card) não tem tela de baixo e também não tem como saber o filtro da tela de onde veio. O Voltar dela continua montando Pipeline ou Clientes sem recorte, como hoje. O motivo foi medido em 23/09/2026 contra o react-router instalado: o state da navegação, que é onde a tela de origem viaja, e o `idx`, que diz se há tela do app antes, moram na mesma entrada do histórico. No app de hoje o state literal só nasce no caminho da ficha, sempre num push, que já sai com o `idx` acima de zero, onde o Voltar do navegador devolve a lista inteira sozinho (o único replace desse caminho, o da mesma ficha já aberta, grava state nulo); numa guia nova o documento é outro e não existe state nenhum. (A biblioteca aceitaria state numa entrada de `idx` 0, num replace. Quem não faz isso é o app, então essa é convenção nossa e precisa continuar sendo respeitada.) Levar o recorte para lá tem dois caminhos, e os dois cobram um preço:

  1. **Origem e filtro no endereço da própria ficha** (`/<academia>/ficha/<id>?de=leads&funil=f2`). Muda a linha `Ficha | nenhuma` da tabela, e o link compartilhado passa a carregar o recorte de quem mandou.
  2. **Memória por academia no navegador**, no mesmo lugar em que o app já guarda o funil escolhido do Pipeline (`savedFunnelKey` e `readSavedFunnel`, em `src/lib/appShell.js`): a lista grava a tela e o recorte de agora, e a guia nova lê de lá. O endereço da ficha continua limpo e o link compartilhado não leva filtro de ninguém, mas a memória é compartilhada entre as abas, então duas abas em recortes diferentes podem devolver o recorte da última que mexeu.

  **Decisão do Johnny, em aberto.** A medição está registrada no `routes.test.js` e explicada no comentário do `backTarget`.
- Filtro no endereço aumenta a chance de alguém colar um link com valor estranho. O saneamento cobre, mas é código novo em dez telas, e cada tela tem a sua regra.
- O saneamento de cada parâmetro depende de dado que chega depois do primeiro render (a equipe vem de uma leitura, funis e etapas de assinatura). Um link com `pessoa`, `funil` ou `fase` abre no padrão e acerta quando o dado chega, o que nos dashboards aparece como uma piscada. Quem clicar em outro filtro dentro dessa janela perde o parâmetro ainda não validado, que some do endereço. Corrigir isso exigiria segurar a tela até o dado chegar, o que é pior do que a piscada.
- A visão Equipe da Meta continua lendo o histórico inteiro, sem recorte de mês e sem o corte de ociosidade. Ficou fora desta entrega e continua valendo como dívida.
