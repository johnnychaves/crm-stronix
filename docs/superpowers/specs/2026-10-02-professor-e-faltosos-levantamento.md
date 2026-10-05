---
status: ativo
---

# Professor e faltosos: levantamento

O que a pesquisa e as planilhas da Next Fit mostraram antes da spec `2026-10-02-professor-e-faltosos-design.md`. Feito em 02/10/2026. Nenhum dado de aluno entra aqui: só cabeçalhos, formatos e contagens.

## A catraca

A catraca da STRONIX é Topdata, e quem manda nela é o Controle de Acesso da Next Fit, que roda no computador da recepção.

- A catraca Topdata guarda um único "IP do servidor" e é ela quem abre a conexão com esse computador, pela porta 3570. Não existe um segundo destino para onde ela mande as passagens.
- A Next Fit usa a catraca no modo online: cada passagem é perguntada ao computador, que libera ou barra na hora. A planilha de acessos confirma isso, com "Offline: Não" em todas as linhas.
- Apontar a catraca para um programa nosso tiraria a Next Fit do controle. A catraca mostraria "CATRACA OFFLINE", e as regras do contrato (bloqueio de quem não paga, musculação só para quem contratou) deixariam de valer na porta.
- Ler a memória da catraca também não serve. Só o servidor da catraca coleta os registros, e eles cobrem só os períodos em que ela ficou offline.
- Copiar o tráfego da rede ou pôr uma máquina no meio do caminho exigiria decifrar um protocolo fechado, que a Topdata só documenta com contrato de sigilo.

Conclusão: a presença sai da Next Fit, nunca da catraca.

Fontes principais: `suporte.topdata.com.br/suporte/configuracao-das-catracas/`, `integrador.topdata.com.br/suporte/qual-a-diferenca-entre-o-modo-online-e-offline/`, `integrador.topdata.com.br/suporte/funcionamento-sdk-easyinner/`, `antirion.com.br/perguntas-frequentes/top-acesso-faq/`, e os artigos da ajuda da Next Fit `69000854021` e `69000854456` (catraca offline).

## A API da Next Fit

A documentação pública (`integracao.nextfit.com.br/swagger/v1/swagger.json`) tem 10 rotas, todas de leitura: Agenda, ContaReceber, ContratoBase, ContratoCliente, MovimentoFinanceiro, Oportunidade, Pessoa/GetClientes, Pessoa/GetLeads, Pessoa/GetUsuarios e Venda.

- Nenhuma rota entrega acesso pela catraca, frequência ou último acesso, e não há webhook.
- A única presença que ela expõe é a da agenda: cada participante de um horário marcado tem um status (Reservado, Presente, Falta, FaltaJustificada, Bloqueado, Suspenso, Cancelado ou Desistente).
- A rota de clientes traz `cliente.codigoUsuarioProfessor`, o professor responsável de cada aluno na Next Fit, além de CPF e telefone.
- A API é paga, e o preço só aparece na contratação.

Fica para depois, se a Next Fit abrir os acessos na API.

## Os relatórios da Next Fit

Os três ficam em Relatórios → Clientes → Acessos/Presenças e exportam para Excel.

### Faltantes

Cabeçalho: `Nome`, `Contrato`, `Qtde de ausências`, `Última presença`, `Telefone`, `Professor`, `Consultor`.

Na planilha de 02/10/2026 (filtro de 7 dias):

- 196 alunos, uma linha por aluno.
- `Última presença` sempre no formato 25/09/2026. `Telefone` no formato (51) 9 9999-9999, com um fixo (51) 9999-9999.
- `Qtde de ausências` é exatamente o número de dias entre a última presença e o dia da exportação, nas 196 linhas. Então a data da exportação sai do conteúdo: última presença mais a quantidade.
- O menor valor de `Qtde de ausências` era 7, que é o filtro escolhido na exportação.
- O nome do professor sai cortado em 29 caracteres: um sobrenome de 30 letras perde a última letra.
- 7 professores de verdade, um usuário "Controle (não alterar)" com 10 alunos e 5 alunos sem professor.
- Não tem CPF.

Distribuição por dias sem vir: 38 de 7 a 13, 40 de 14 a 29, 45 de 30 a 59 e 73 com 60 ou mais. O caso mais antigo passava de um ano.

### Presenças

Cabeçalho: `Cliente`, `Modalidade`, `Contrato`, `Tipo`, `Data`.

Na planilha de 01/10 às 6h03 até 02/10 às 12h51:

- 284 linhas de 203 alunos.
- `Tipo` é `Acesso` (220 linhas, passagem na catraca) ou `Agenda` (64 linhas: 32 de funcional e 29 de pilates).
- `Data` sempre no formato 02/10/2026 07:00.
- Não traz passagem negada nem liberação manual sem aluno.
- 6 alunos tiveram presença na agenda sem passar na catraca no mesmo dia.
- Em 169 linhas a `Modalidade` vem como "offf" ou "off", que parece um nome provisório cadastrado na Next Fit para os planos Clube+.
- **Não tem telefone**, embora a ajuda da Next Fit diga que tem. O aluno só é identificado pelo nome.

### Acessos

Cabeçalho: `AcessoLiberado`, `Cliente`, `Contrato`, `Acesso`, `ModoReconhecimento`, `Offline`, `Motivo`.

Comparado linha a linha com o Presenças, no mesmo período, as passagens liberadas batem com o `Tipo` `Acesso` em 219 de 220 linhas. O Acessos traz a mais 19 passagens negadas, sem motivo preenchido, e 6 liberações sem nome. Não traz a presença da agenda nem telefone. Por isso o Presenças substitui o Acessos no projeto.

## A primeira importação, simulada

Com a planilha Faltantes de 02/10 e os marcos 7, 14, 30 e 60, pela regra "atravessou um marco nos últimos 7 dias":

- 73 alunos entram na Meta dos professores: 38 no marco de 7 dias, 22 no de 14, 9 no de 30 e 4 no de 60. O professor com mais alunos fica com 21, os dois seguintes com 18 e 12, e os outros com 6 ou menos.
- 123 ficam só na lista de acompanhamento.

## O que a Next Fit já faz

O relatório Faltantes lista quem está há N dias sem vir. A Next Fit também tem os relatórios Risco de abandono e Frequência, um painel do professor com a frequência semanal dos alunos dele e, no CRM Automações (pago à parte), o gatilho "Clientes faltantes". Nenhum desses separa os faltosos por professor, e a mensagem da automação sai por fora do Stronizap.

## O Stronix Suite

O Suite não prevê controlar a catraca. O check-in planejado é presença em aula de turma (o modelo `Presenca` exige uma aula ligada), e o último commit do Suite é de 20/06/2026.
