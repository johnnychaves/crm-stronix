# Modelo de planilha do Stronilead para a importação de clientes (design)

status: revisão
data: 2026-09-24

## Por que

Algumas academias cadastram à mão os clientes que já têm contrato: criam o lead, põem num funil e lançam a matrícula com data de início retroativa. A data retroativa só volta a vigência. O resto do lançamento fica com a data do clique:

- o Operacional ("entraram") e o Gerencial (venda do mês) contam o contrato pelo `createdAt`, a hora em que ele foi salvo;
- o CRM conta a matrícula pelo `convertedAt` e pelo `clienteSince`, que `commitMatricula` carimba com `serverTimestamp()`;
- o lead nasce hoje, então entra como lead novo do mês no CRM e como prospecção do consultor no Operacional;
- a troca de etapa para Venda também fica datada de hoje.

O mês atual ganha matrícula, venda e lead que não aconteceram nele.

A importação de clientes (spec `2026-09-03-importacao-clientes-design.md`, PR #195) já grava esse cliente do jeito certo: casa por CPF e WhatsApp, promove quem já é lead, usa as datas da planilha e carimba a importação, que os três painéis deixam de fora. O ponto fraco dela é a entrada. Cada sistema antigo exporta um arquivo diferente, e hoje isso é resolvido com o reconhecimento do NextFit, um mapeamento manual de colunas e duas rodadas (cadastro, depois contratos). Cada formato novo abre espaço para erro: coluna mapeada no campo errado, plano ou consultor com nome diferente do cadastro, CPF que o Excel transformou em número e perdeu o zero da frente, data em formato que ninguém lê.

Este documento troca a entrada da importação por um formato só: um modelo de planilha do Stronilead, gerado para cada academia, que toda academia preenche, inclusive a que vem do NextFit.

## Decisões (Johnny, 2026-09-24)

1. **O modelo é o único formato que a importação aceita.** Saem o reconhecimento do NextFit, o mapeamento manual de colunas e a rodada dupla.
2. **O modelo é baixado só no super console,** na sessão assumida, na seção Importar clientes. Ele sai com os planos, a equipe e os professores daquela academia.
3. **Início e fim da vigência são obrigatórios.** A regra de vigência da importação não muda.
4. **O modelo traz todas as colunas que a importação lê,** com as obrigatórias primeiro.
5. **O arquivo é gerado com ExcelJS,** carregado por `import()` dinâmico e num pedaço próprio do build. A versão gratuita do SheetJS, que o app já usa para ler, não grava lista suspensa nem estilo.
6. **A regra de contagem do importado não muda.** Ele continua fora de lead novo, matrícula e venda nos três painéis. A ideia de contar o cliente da base como matrícula no mês de início do contrato ficou em aberto e não entra aqui.

## O fluxo

1. O super console entra na academia ("Entrar como"). Os planos e a equipe já precisam estar cadastrados, porque as listas do modelo saem deles.
2. Em Configurações, Importar clientes, clica em **Baixar modelo**.
3. Manda o arquivo para a academia. Ela preenche e devolve.
4. O super console entra de novo na academia, sobe o arquivo, confere os ajustes e a revisão e importa.

Rodar o mesmo arquivo de novo dá "sem alteração", como já acontece hoje.

## O arquivo

Nome: `modelo-stronilead-<identificador da academia>-<aaaa-mm-dd>.xlsx`.

Três abas, nesta ordem. A ordem importa: `readSpreadsheetFile` lê a primeira aba.

### Aba "Clientes"

Uma linha por cliente, com o contrato atual. O cabeçalho fica congelado na linha 1. Cabeçalho de coluna obrigatória é laranja (`#FF6A2B`, com texto branco), o de opcional é cinza claro, e cada cabeçalho leva uma nota (comentário da célula) com a explicação da coluna.

| # | Cabeçalho | Campo da importação | Célula | Nota do cabeçalho |
|---|---|---|---|---|
| 1 | Nome * | `name` | texto | Nome completo do cliente. |
| 2 | CPF * | `cpf` | texto | Com ou sem pontos. Preencha o CPF ou o WhatsApp: pelo menos um dos dois é obrigatório. |
| 3 | WhatsApp * | `whatsapp` | texto | Com DDD. Preencha o CPF ou o WhatsApp: pelo menos um dos dois é obrigatório. |
| 4 | Plano * | `planName` | lista, com aviso | Escolha na lista. São os planos cadastrados no Stronilead. |
| 5 | Início da vigência * | `contractStartsAt` | data | Dia em que o contrato atual começou. |
| 6 | Fim da vigência * | `contractEndsAt` | data, igual ou depois do início | Dia em que o contrato atual termina. |
| 7 | Valor total do contrato | `contractValue` | número, R$ | Valor do contrato inteiro, não da mensalidade. Em branco, vale o valor do plano. |
| 8 | Situação do contrato | `contractSituation` | lista, travada: Ativo, Trancado | Em branco conta como Ativo. Contrato vencido não precisa de marca: a data de fim decide. |
| 9 | Consultor | `consultantName` | lista, com aviso | Dono do cliente no Stronilead. Em branco, vai para o consultor padrão escolhido na importação. |
| 10 | Professor | `professorName` | lista, com aviso | Professor responsável, se houver. |
| 11 | E-mail | `email` | texto | |
| 12 | Data de nascimento | `birthDate` | data | |
| 13 | Sexo | `sexo` | lista, travada: Masculino, Feminino, Outro | |
| 14 | Cliente desde | `registeredAt` | data | Quando a pessoa entrou na academia pela primeira vez. Pode ficar em branco. |
| 15 | Objetivo | `dor` | texto | |
| 16 | VIP | `vip` | lista, travada: Sim, Não | |
| 17 | RG | `rg` | texto | |
| 18 | CEP | `addrCep` | texto | |
| 19 | Endereço | `addrStreet` | texto | |
| 20 | Número | `addrNumber` | texto | |
| 21 | Complemento | `addrComplement` | texto | |
| 22 | Bairro | `addrNeighborhood` | texto | |
| 23 | Cidade | `addrCity` | texto | |

Notas sobre as células, válidas da linha 2 até a 5001:

- **Texto** é o formato `@`. CPF, WhatsApp, RG, CEP e Número nunca viram número, então o zero da frente e o telefone inteiro sobrevivem.
- **Data** usa o formato `dd/mm/yyyy` (código do Excel, que aparece como 15/03/2026) e uma validação de data entre 01/01/1900 e 31/12/2100, travada, com a mensagem "Digite uma data, como 15/03/2026." Na coluna Fim, a validação também exige que a data seja igual ou posterior ao Início da mesma linha quando ele estiver preenchido, com a mensagem "O fim precisa ser igual ou depois do início."
- **Número** usa o formato `"R$" #,##0.00` (código do Excel, que num Excel em português aparece como R$ 1.234,56) e aceita decimal maior ou igual a zero, travado.
- **Lista travada** recusa o que não está na lista.
- **Lista com aviso** mostra "Esse nome não está na lista. Se continuar, ele é acertado na importação." e deixa passar. Aluno antigo pode estar num plano que não se vende mais. O Consultor e o Professor seguem a mesma regra pelo mesmo motivo: o erro de digitação vira aviso na revisão, e a linha não se perde.
- A validação vale para o que é digitado. Colar por cima passa sem checagem no Excel, por isso a importação continua conferindo tudo na revisão.
- O asterisco do cabeçalho não atrapalha a leitura: `normalizeHeader` já tira tudo que não é letra ou número.

### Aba "Como preencher"

Texto curto, em frases diretas, com:

- "Modelo gerado para <identificador da academia> em <dd/mm/aaaa>.";
- quem entra na lista: clientes ativos, trancados e quem venceu há no máximo N dias, onde N é a janela de Vencidos da academia (`normalizeExpiredWindowDays(renewalGraceDays)`). Cancelados e vencidos antigos ficam de fora;
- uma linha por cliente. Quem tem dois contratos ao mesmo tempo entra com o que termina por último, e o outro é registrado depois na ficha. Isso segue o `dedupeInFile`, que já fica com a linha de fim mais recente;
- as colunas laranja são obrigatórias, com CPF ou WhatsApp, pelo menos um dos dois;
- o valor é o total do contrato, não a mensalidade;
- não mudar o nome das colunas;
- plano, consultor ou professor fora da lista podem ser digitados, o Excel avisa e o nome é acertado na importação;
- duas linhas de exemplo, com dados fictícios. O exemplo mora nesta aba de propósito, porque na aba Clientes ele seria importado como aluno.

### Aba "Listas" (oculta)

Três colunas: Planos, Equipe e Professores. As listas suspensas da aba Clientes apontam para os intervalos desta aba, e não para uma lista escrita dentro da validação, que no Excel tem limite de 255 caracteres. As listas fixas (Situação, Sexo, VIP) podem ficar escritas na própria validação.

Os nomes saem de:

| Lista | Fonte | Mesma lista que a importação usa para casar |
|---|---|---|
| Planos | `planos` (props da seção, do `useGeneralConfig`) | `enrichCandidate` casa por nome contra `planos` |
| Equipe | `usersList` | `enrichCandidate` casa por nome contra `usersList` |
| Professores | `useGeneralConfig().professores` | `enrichCandidate` casa por nome contra `professores` |

Nome repetido (pelo nome normalizado, `normalizeName`) entra uma vez só. A ordem é alfabética em pt-BR. Como as fontes são as mesmas do casamento, um nome escolhido na lista sempre casa.

## Onde o botão fica

No painel "1. Arquivo" da `ImportClientsSection`, ao lado da escolha de arquivo, com a frase "Sem exportação do sistema antigo? Baixe o modelo, mande para a academia e importe aqui quando ele voltar preenchido." A seção já só aparece na sessão assumida (`appUser.impersonating`), então o botão herda a trava sem mudança.

- Sem nenhum plano em `planos`, o botão fica desligado, com a frase "Cadastre os planos da academia antes de baixar o modelo."
- Enquanto o arquivo é gerado, o botão mostra "Gerando..." e fica desligado.
- Se a geração falhar (biblioteca que não carregou, sem internet), aparece o aviso "Não deu para gerar o modelo. Tente de novo." e o resto da tela fica como estava.

O modelo usa só o que a tela já tem carregado. Não entra nenhuma leitura nova no Firestore.

## O que muda na importação

### Ao subir o arquivo

`checkTemplateHeaders(headers)` confere o cabeçalho contra a tabela do modelo, ignorando ordem, maiúscula, acento e asterisco (`normalizeHeader`).

| Situação | Resultado |
|---|---|
| Nenhum cabeçalho do modelo (uma exportação do NextFit, por exemplo) | Recusa: "Esse arquivo não é o modelo do Stronilead. Baixe o modelo e peça para a academia preencher." |
| Tem cabeçalhos do modelo, mas falta alguma obrigatória | Recusa: "Falta a coluna Fim da vigência." Com mais de uma, lista todas. |
| Todas as obrigatórias presentes | Segue. Coluna opcional apagada não atrapalha. |

As obrigatórias do cabeçalho são Nome, CPF, WhatsApp, Plano, Início da vigência e Fim da vigência. CPF e WhatsApp precisam existir como coluna. O "pelo menos um dos dois" vale para o conteúdo de cada linha e já é a regra de `isCandidateValid`.

O mapeamento campo → cabeçalho sai direto da tabela do modelo (`templateMapping(headers)`), no formato que `parseRow` já recebe hoje. Nada é adivinhado.

### Passo 2 vira "Ajustes"

Saem a grade de mapeamento de colunas e o seletor de origem. Ficam:

- o consultor padrão (obrigatório, como hoje);
- a escolha de quem entra (ativos e vencidos recentes, ou todos);
- a tabela de planos, agora mostrando só os nomes da planilha que não casaram com o catálogo. Quando todos casam, ela diz "Todos os planos da planilha estão no catálogo." O mapeamento por plano e o "manter como texto" continuam iguais.

A lista de passos passa a ser Arquivo, Ajustes, Revisão, Importar.

### Origem gravada

`importSource: 'modelo'` e o rótulo "planilha modelo". O lead criado ganha `source: 'Importação por planilha modelo'`, que continua começando com "Importação", então `isImportCreatedLead` segue valendo. O evento da timeline diz "Cadastro importado da planilha modelo. Plano X, vigência até dd/mm/aaaa." Os dados já importados com `importSource: 'nextfit'` ou `'manual'` continuam válidos: os painéis leem só a presença das marcas (`importBatchId`, `importSource`, `importedBy`), nunca o valor.

### Avisos novos na revisão

Entram em `parseRow`, ao lado do "Data de fim ilegível" que já existe:

| Aviso | Quando | O que acontece com a linha |
|---|---|---|
| Fim antes do início | as duas datas legíveis e o fim anterior ao início | `parseRow` zera o fim e a linha segue como a de quem não tem data de fim: a pessoa entra sem contrato, e o relatório conta a linha em "sem vigência". Vigência invertida quebraria Renovações e Vencidos. |
| Sem data de início | célula de início vazia | o contrato nasce com o início calculado pelo plano (fim menos a duração), como `buildImportedContract` já faz, com `startsAtInferred: true`. Com plano fora do catálogo, sem duração conhecida, o contrato nasce sem início, também como hoje. |
| Data de início ilegível | célula de início com conteúdo que não vira data | o mesmo que "Sem data de início". |

### O que sai do código

- de `src/lib/importPresets.js`: `IMPORT_PRESETS`, `ALIASES`, `detectPreset`, `buildMapping`, `importSourceLabel` e `TARGET_GROUP_LABEL`. O `normalizeHeader` vai para o módulo do modelo, e o arquivo `importPresets.js` deixa de existir;
- a grade de mapeamento e o seletor de origem da `ImportClientsSection`;
- `src/lib/__tests__/importPresets.test.js`, substituído pelos testes do modelo;
- as planilhas de exemplo do NextFit em `docs/superpowers/fixtures/`, substituídas por uma planilha de exemplo do modelo.

Nada muda em casamento por CPF e WhatsApp, promoção de quem já é lead, conflitos, escopo, carimbos de tempo, marcas de importação, gravação em lote nem relatório.

## Arquitetura

| Arquivo | Papel |
|---|---|
| `src/lib/importTemplate.js` (novo, puro) | `TEMPLATE_COLUMNS` (cabeçalho, campo, tipo de célula, obrigatória, nota, lista); `normalizeHeader`; `checkTemplateHeaders`; `templateMapping`; `buildTemplateSpec({ planos, users, professores, windowDays, tenantId, now })`, que devolve a descrição do arquivo (abas, cabeçalhos, notas, listas, validações e o texto de "Como preencher") sem tocar em biblioteca nenhuma. Testado em node. |
| `src/lib/importTemplateWrite.js` (novo) | Único lugar que toca o ExcelJS, por `import('exceljs')`. Transforma a descrição em `.xlsx` e dispara o download. |
| `src/views/settings/ImportClientsSection.jsx` | Botão, recusa do arquivo, passo Ajustes. |
| `src/lib/clientImport.js` | Os três avisos em `parseRow`; rótulo da origem. |
| `vite.config.js` | `exceljs` num pedaço próprio (`if (id.includes('/exceljs/')) return 'exceljs';`), como o `xlsx`. No `vendor`, ele iria para todo mundo. |
| `package.json` | `exceljs` como dependência. |

A tabela `TEMPLATE_COLUMNS` é a fonte única do cabeçalho: o arquivo gerado, a conferência do cabeçalho e o mapeamento saem dela. Assim o modelo e a importação não se desencontram.

## Testes

Automáticos, em node:

- **tabela do modelo:** cada coluna aponta para um campo que `parseRow` lê, sem campo repetido; as obrigatórias são exatamente Nome, CPF, WhatsApp, Plano, Início e Fim;
- **conferência do cabeçalho:** aceita o modelo em qualquer ordem, com e sem asterisco, com maiúscula e acento trocados; recusa o cabeçalho do NextFit com a mensagem de "não é o modelo"; nomeia a coluna obrigatória que falta, uma ou várias; aceita o modelo sem as colunas opcionais;
- **descrição do arquivo:** listas sem nome repetido e em ordem alfabética; a janela de Vencidos entra no texto de "Como preencher"; a aba Clientes é a primeira; nenhuma linha de exemplo na aba Clientes;
- **avisos:** fim antes do início deixa a linha sem contrato; sem início e início ilegível dão início calculado com `startsAtInferred`;
- **volta completa:** o arquivo gerado pelo `importTemplateWrite` com ExcelJS, com duas linhas preenchidas (CPF começando com zero, datas, valor), lido pelo mesmo caminho da importação (SheetJS). O cabeçalho passa na conferência, o CPF volta com o zero e as datas voltam como as do arquivo.

De verdade, antes do merge:

1. Abrir o arquivo no Excel, no Google Planilhas e no LibreOffice: lista suspensa aparece, CPF digitado com zero na frente fica com o zero, a coluna de data recusa texto, o fim antes do início é recusado.
2. Numa academia de teste, na sessão assumida, importar cinco linhas: uma com plano fora da lista, uma sem consultor, uma trancada, uma vencida dentro da janela e uma pessoa que já é lead. Conferir Clientes, Renovações e Vencidos, e ver que CRM, Operacional e Gerencial não mudaram.
3. Importar o mesmo arquivo de novo: tudo "sem alteração".
4. Subir uma exportação do NextFit: recusada com a mensagem certa.

## Fora deste trabalho

- A pergunta no modal de contrato para quem cadastra cliente da base à mão, com a mesma marca da importação.
- A checagem no super console que acha os clientes que já entraram à mão com contrato retroativo e os marca como base.
- Contar o cliente da base como matrícula no mês de início do contrato (decisão 6).
- O modelo baixado pelo gestor da academia, fora do super console.
- Histórico de contratos anteriores, pagamentos, presenças e conversas do sistema antigo.
