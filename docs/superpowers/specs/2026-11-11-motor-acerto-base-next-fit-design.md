status: ativo

# Motor de acerto da base de clientes com a Next Fit

Spec de 11/11/2026. Primeira peça do link universal de indicação: o link só acha quem tem CPF e data de nascimento no cadastro, e só entre clientes com contrato ativo. Hoje a base da STRONIX não garante nenhuma das duas coisas. O link universal terá spec própria, depois deste motor.

## O que se quer

Deixar a base de clientes da STRONIX no Stronilead igual à da Next Fit, sem tela nova e sem função na Vercel. Quem roda o motor é quem tem a credencial de administrador, na própria máquina, no molde dos `scripts/backfill-*`.

## Dados de partida (medidos em 11/11/2026, só leitura)

Fontes, exportadas da Next Fit e guardadas fora do repositório:

- **Lista de clientes** (3.710 linhas): nome, e-mail, contrato, telefone, situação do contrato e do cliente, CPF, RG, nascimento, cadastro, objetivo, sexo, endereço, consultor e professor. Tem 561 ativos e 16 suspensos, e os 577 têm CPF válido, nascimento e telefone.
- **Relatório de contratos a vencer** (585 linhas): cliente, descrição do contrato, início, encerramento, professor, consultor e telefone. Datas no formato `dd/mm/aaaa`. Só traz contratos vigentes, com encerramento entre 13/11/2026 e 10/11/2027. Não traz CPF nem valor.

Casamento entre as duas fontes: 545 dos 585 contratos casam por nome e por telefone, sem ambiguidade. Os 40 restantes são clientes "Bloqueado" na lista, com contrato ainda vigente no relatório.

Situação da STRONIX no Stronilead (1.137 fichas), para as 577 pessoas ativas ou suspensas na Next Fit:

| Situação no Stronilead | Pessoas |
|---|---|
| Cliente com contrato ativo | 522 |
| Cliente com contrato vencido, cancelado ou sem contrato | 20 |
| Só lead (matrícula não registrada) | 8 |
| Sem cadastro | 20 |
| Ambíguas (mais de um cadastro possível) | 7 |

Entre as 550 achadas, 71 estão sem CPF e sem nascimento, e 3 têm CPF diferente do da Next Fit. No sentido contrário, o Stronilead tem 582 clientes ativos e 63 não casam com nenhum ativo da Next Fit.

## Regras

### Casamento

Uma pessoa da Next Fit casa com um cadastro do Stronilead, nesta ordem:

1. Pelo CPF.
2. Pela chave de telefone do Stronizap (`zapMatchKey`, DDD mais os 8 últimos dígitos), quando o telefone é único entre os ativos da Next Fit e o primeiro nome é o mesmo.
3. Pelo nome completo, sem acento nem caixa, quando só um cadastro tem esse nome.

Fora disso, ou com mais de um candidato, a pessoa vai para a lista de ambíguas e nada é gravado nela. Se houver mais de um candidato e só um for cliente, vale o cliente. Telefone de família repartido entre duas pessoas nunca casa sozinho.

### Etapa 1: CPF e nascimento

- Alvo: cliente achado que tem CPF ou nascimento vazio.
- Grava só o campo vazio, no formato que o cadastro grava, com os derivados de busca pelas funções do app. Nunca sobrescreve o que já está preenchido.
- CPF diferente do da Next Fit: não grava, vai para o relatório.
- Ambígua: não grava, vai para o relatório.

### Etapa 2: matrículas que faltam

Três grupos, cada um com a própria chave de gravação:

- Cliente com contrato vencido, cancelado ou sem contrato, que está ativo na Next Fit com contrato no relatório.
- Lead que é aluno ativo na Next Fit.
- Pessoa sem cadastro no Stronilead.

Para cada um, o motor cria o contrato com plano e datas do relatório, e cria o cadastro de cliente quando falta. O valor sai da tabela do plano, porque nenhuma planilha traz o valor.

Decisões que valem para a etapa 2:

- **O contrato nasce marcado como importado** (`importSource` e `importBatchId`, como na importação de clientes). Os painéis então não contam essas pessoas como lead novo, matrícula ou venda. Sem isso, os cerca de 48 contratos criados hoje (20, 8 e 20 pessoas, fora os ambíguos) entrariam como vendas de novembro e distorceriam o Gerencial e a comissão. A data real da venda não está nas planilhas.
- **Tabela de planos**: o motor lista cada descrição de contrato do relatório (14 hoje, entre elas Freepass, Experience, bolsa e dois contratos marcados "não usar") e só grava quando cada uma está ligada a um plano do Stronilead ou marcada para pular. A tabela fica num arquivo local, passado por parâmetro.
- Quem tem contrato no relatório mas está "Bloqueado" na lista não entra na etapa 2.

### Fora do motor

- Os 63 clientes ativos a mais no Stronilead e os 40 bloqueados com contrato vigente viram lista para decisão manual. Cancelar contrato por engano afeta Gerencial e comissão.
- Endereço, e-mail, sexo e demais dados cadastrais de quem já tem ficha. O motor só completa CPF e nascimento nelas. O cadastro novo, criado na etapa 2, nasce com os dados que a Next Fit tem.
- O link universal. Fica para o spec seguinte, que parte deste motor.

## Como roda

Script `scripts/sync-clientes-next-fit.js`, com as regras puras em `src/lib/nextFitSync.js` e testes em `src/lib/__tests__/`. Segue o molde do `backfill-contract-seamless.js` e do `src/lib/seamlessBackfill.js`.

- Parâmetros: academia (obrigatória, sem padrão), caminho das duas planilhas, caminho da tabela de planos e a etapa.
- Sem `--apply`, só lê e gera o relatório. A credencial é a de administrador do `.env.local`, lida pelo processo e nunca impressa.
- Com `--apply --etapa=1` ou `--apply --etapa=2`, grava só aquela etapa, e só depois do OK do Johnny sobre o relatório.
- Antes de gravar, guarda uma cópia do estado anterior dos documentos que vai mudar, num arquivo fora do repositório.
- Grava em lotes, relendo cada documento antes, como o `fillZapMatchKeys`. Rodar duas vezes não muda nada na segunda.
- O relatório sai em planilha fora do repositório, com as listas: gravadas, ambíguas, CPF divergente, bloqueados com contrato, clientes a mais no Stronilead e ativos sem contrato no relatório. Nome, CPF e telefone ficam só nesse arquivo.
- Nada no repositório leva dado pessoal: nem planilha, nem relatório, nem fixture. Os testes usam pessoas inventadas.

## Testes

- Casamento: CPF, telefone único com o mesmo primeiro nome, nome completo, telefone repartido entre duas pessoas, homônimos, um cliente e um lead com o mesmo nome.
- Etapa 1: preenche vazio, não sobrescreve preenchido, não grava com CPF divergente.
- Etapa 2: contrato importado fora dos painéis, descrição sem plano ligado barra a gravação, rodar duas vezes não duplica.
- Ensaio final: rodar o relatório na STRONIX e conferir os números da tabela de partida.

## Critério de pronto

- Etapa 1 aplicada: todo cliente ativo achado na Next Fit tem CPF e nascimento no Stronilead, salvo os de CPF divergente e os ambíguos, que ficam listados.
- Etapa 2 aplicada: os ativos da Next Fit aparecem como clientes ativos no Stronilead, e o que sobrou de cada lado está numa lista.
- Nenhum painel muda de número por causa dos contratos criados na etapa 2.

## Limites

- É um acerto pontual. Matrícula nova que um consultor deixar de registrar volta a abrir a diferença. O mesmo motor roda de novo com uma exportação nova.
- O vínculo entre contrato novo e contrato vencido (renovação encadeada) fica para o plano. O spec só exige que as datas do relatório sejam respeitadas.
- O casamento por nome só vale para nome completo único. Nomes escritos de forma diferente nas duas bases caem em ambíguas e dependem de leitura humana.
