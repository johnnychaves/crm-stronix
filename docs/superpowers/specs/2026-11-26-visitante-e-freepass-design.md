---
status: revisão
---

# Visitante e freepass

Desenho aprovado com o Johnny em 26/11/2026, em quatro partes. Plano da entrega 1 a seguir.

## O problema

Hoje o freepass não existe como coisa própria. Ele é a quantidade do passo "Quantas aulas" do Agendar aula experimental, gravada em `lead.trialClassesPlanned` e contada como dias de passe a partir do dia da aula (`src/lib/freePass.js`). As opções são uma lista solta da academia (`trialClassOptions`, em Configurações → Agendamento), sem nome, sem modalidade e sem regra. A pessoa continua "Lead" o tempo todo, e o único lugar que mostra quem está com passe ativo é a aba "Em andamento" de Aulas, só no mês corrente.

O playbook comercial trata o freepass como etapa formal do funil, a ferramenta mais forte de conversão, e diz que o freepass que não converte é o que não tem conversa de fechamento logo depois. Sem saber quem está rodando freepass, essa conversa não acontece.

## A ideia

Assim como quem tem contrato é Cliente e quem tem interesse é Lead, quem aceita um freepass é **Visitante**. O Visitante tem cor própria, aparece em todas as telas em que a pessoa aparece, tem lista própria e uma tarefa de fechamento na Meta Diária.

## Parte 1: as regras

### Tipos de freepass

Em Configurações → Agendamento, a lista de quantidades dá lugar aos tipos de freepass. Cada tipo tem:

- nome ("Musculação 7 dias", "Pilates 2 aulas");
- modalidade (uma do catálogo);
- se vale por **dias** ou por **aulas**;
- a quantidade;
- se é o **padrão** da modalidade (um por modalidade, usado pelo Stronizap e pela IA, ver parte 3);
- se está ativo.

Os tipos ficam no campo `freepassTypes` de `stronix_config/general`, que o app já lê junto com o resto da configuração. Só o gestor grava.

### Dois caminhos para lançar

- **Aba Contratos.** O lead sem contrato tem "Lançar freepass" no lugar do "Matricular agora". O ex-aluno (contrato vencido ou cancelado) tem "Lançar freepass" ao lado do "Nova matrícula".
- **Agendar aula experimental.** O passo "Quantas aulas" vira "Freepass". Se a pessoa já tem freepass correndo na modalidade escolhida, a aula entra nele. Se não tem, o consultor escolhe o tipo e o freepass nasce junto com a aula.

Lead em Perda não recebe freepass: primeiro o "Reativar lead".

### Quando termina

- **Por dias:** vale N dias a partir do início e termina no fim do último dia. Pela aba Contratos, o consultor escolhe o início. Pelo Agendar, o início é o dia da aula.
- **Por aulas:** o consultor agenda as N aulas, e cada aula agendada conta, com ou sem comparecimento. Aula cancelada não conta. O sistema não deixa agendar uma aula a mais que o freepass permite. Termina no fim do dia da última aula. Não há prazo em dias.
- **À mão:** "Encerrar freepass", quando a pessoa desiste.
- **Marcar perda** encerra o freepass.
- **Matrícula** encerra o freepass como "virou matrícula".

O fim natural (o último dia passou, ou a última aula passou) não é gravado por ninguém. Ele sai da conta na hora da leitura, como a regra dos 18 anos do menor.

### Etiquetas e cor

Com o freepass correndo, a ficha mostra duas etiquetas lado a lado: "Lead" e "Visitante", ou, no ex-aluno, "Inativo" (ou "Cancelado") e "Visitante". Quando o freepass termina sem matrícula, a etiqueta Visitante some sozinha e a pessoa volta a ser só Lead (ou só Inativo).

A cor proposta é o verde-água (`teal` de `TONES`, em `src/lib/leadState.js`), que hoje não é cor de nenhum estado. Ela é confirmada nos mockups da entrega 1.

O Visitante não é um estado novo do `deriveLeadState`: é uma etiqueta a mais, por cima do estado de sempre. O Pipeline, os funis, o `lifecycleBucket` e as contas de cliente não mudam.

### Virar cliente

Só pelo "Marcar venda" do cabeçalho da ficha, que encerra o freepass como "virou matrícula". O ex-aluno não tem "Marcar venda" (já é cliente), então a matrícula dele continua pelo "Nova matrícula" da aba Contratos, que abre a mesma janela.

Quem encerra o freepass é a gravação da matrícula (`commitMatricula`), e não o botão. Assim os outros caminhos que já gravam matrícula (arrastar o card para Venda no Pipeline, Mudar fase para Venda) também encerram, e nenhum freepass fica correndo num cliente novo.

### Um por modalidade

O consultor não consegue lançar um segundo freepass da mesma modalidade para a mesma pessoa, correndo ou já terminado. O gestor consegue, com uma confirmação. Freepass de modalidades diferentes podem correr juntos.

## Parte 2: onde o Visitante aparece

### Tela Visitantes

Item novo no grupo Leads do menu, em `/<academia>/leads/visitantes`, com o cabeçalho e as pílulas de filtro das outras listas (regra do Johnny: filtros iguais em toda tela). Cada linha mostra:

- a pessoa (link para a ficha);
- o tipo de freepass e a modalidade;
- o andamento: "faltam 3 dias, até 28/11" ou "1 de 2 aulas, próxima qui às 18:00";
- o professor da aula e o consultor.

Filtros: Consultor, Modalidade e Situação. A Situação abre em "Correndo" e tem também "Terminaram sem matrícula", com os últimos 30 dias, que é a lista de repescagem. O filtro mora no endereço (`screenParams.js`).

Freepass por aulas sem próxima aula agendada mostra "sem próxima aula há N dias", para o consultor reagendar ou encerrar.

### Selo Visitante

Na cor do Visitante, com o andamento, no card do Pipeline, em Todos os leads, em Clientes (ex-aluno) e na busca do topo. A faixa de freepass que o cartão do Stronizap já mostra (`api/_zapStrip.js`) passa a ler o freepass novo.

### Tarefa na Meta Diária

Categoria nova, "Fim do freepass", para o dono do lead:

- por dias, no último dia do freepass;
- por aulas, no dia da última aula, depois do horário dela.

É a conversa de fechamento, com WhatsApp, Ligar, Concluir e Reagendar, e o Concluir usa o pop-up de desfecho do contato que já existe (`ContactOutcomeModal`). Ela conta no dia batido como as outras. Se ninguém concluir, a pessoa entra em Atrasados no dia seguinte, até alguém concluir ou marcar o próximo passo, no molde do lead novo que passou das 24 horas (`newLeadHandledAt`).

### Painel e relatório

- **Visão geral → CRM:** uma faixa Freepass com quantos foram lançados no mês, por tipo e por modalidade, quantos viraram matrícula e a taxa, por consultor e por professor.
- **Relatórios:** um submenu Freepass no grupo Leads, com a lista de nomes, os recortes (tipo, modalidade, consultor, professor, situação) e o Exportar e o Imprimir de sempre.

**Quando conta como "virou matrícula":** venda (contrato pago, não importado e que chegou a valer) feita durante o freepass ou até 7 dias depois do fim. Quem fecha depois disso não conta para o freepass.

## Parte 3: dados, travas e o que já existe

### Os dados

Cada freepass é um documento em `stronix_freepass` (constante `FREEPASS_PATH` em `src/lib/firebase.js`):

| Campo | O quê |
|---|---|
| `leadId` | a pessoa |
| `typeId`, `typeName` | o tipo, com o nome do dia do lançamento |
| `modalidadeId`, `modalidadeName` | a modalidade |
| `kind` | `'dias'` ou `'aulas'` |
| `total` | a quantidade de dias ou de aulas |
| `startsAt` | o início |
| `endsAt` | por dias, o fim; por aulas, o dia da última aula quando as N estão agendadas, senão `null` |
| `status` | `'correndo'`, `'encerrado'` ou `'matricula'` |
| `endedAt`, `endReason` | só no encerramento gravado (à mão, perda ou matrícula) |
| `contractId` | o contrato da matrícula, quando virou matrícula |
| `consultantId`, `consultantName` | o dono do lead no lançamento |
| `createdBy*`, `createdAt` | quem lançou e quando |
| `via` | `'contratos'`, `'agendar'` ou `'stronizap'` |

O lead ganha um resumo do freepass que está correndo (`freepassId`, `freepassKind`, `freepassTotal`, `freepassTypeName`, `freepassModalidadeName`, `freepassStartsAt`, `freepassEndsAt`, `freepassAulas` (as aulas agendadas que já contam), `freepassStatus`), no molde do `currentContract*`. Com mais de um freepass correndo, o resumo é o que termina primeiro, e o por aulas ainda sem fim definido fica por último. A ficha lê os documentos, e as listas leem o resumo.

Cada aula experimental agendada dentro de um freepass grava `freepassId` no registro de `stronix_aulas`, e as aulas usadas saem desses registros (os que não foram cancelados).

A regra de quem é Visitante agora (`isVisitorNow`) e o andamento moram num módulo puro novo, `src/lib/visitante.js`, testado em node. O nome não pode ser `freepass.js`: no APFS, que não diferencia maiúscula, ele colide com o `freePass.js` que já existe.

### Quem pode o quê

- Consultor e gestor lançam, encerram e agendam. A ação entra em `ACTIONS` de `src/lib/acesso.js` (`FREEPASS_LANCAR`).
- O professor agenda aula dentro de um freepass que já está correndo, mas não lança freepass novo. Os campos do resumo que o Agendar dele grava entram em `professorLeadFields()`, e o `professorRules.test.js` acompanha.
- As regras do Firestore ganham a coleção nova e os campos do resumo. O Johnny publica no console antes do merge de cada entrega que mexe nelas.

### Stronizap e a IA

Hoje o balão de agendar do Stronizap e a IA mandam uma quantidade de aulas (`schedule.quantity`, conferida contra `trialClassOptions` em `api/_zapSchedule.js`). Para a ponte não quebrar, o contrato do `schedule` não muda na entrega 2, e o Stronilead passa a tratar o pedido assim:

- se a pessoa tem freepass correndo na modalidade, a aula entra nele;
- se não tem, nasce o freepass do tipo padrão da modalidade, com `via: 'stronizap'`;
- se a modalidade não tem tipo padrão, a aula fica sem freepass, como aula experimental comum.

O `trialClassOptions` continua gravado no `stronix_config/general` e só a ponte o lê, até a entrega 6.

### O que já está correndo

Nada é migrado. As aulas experimentais agendadas antes da mudança mostram o passe antigo na coluna "Passe livre" de Aulas até acabarem (15 dias no máximo) e não viram Visitante. A aba "Em andamento" de Aulas sai na entrega 3, e o link antigo passa a abrir a tela Visitantes.

## Parte 4: as entregas

Cada entrega com tela nova começa por 2 ou 3 mockups para o Johnny escolher.

1. **A base.** Tipos de freepass em Configurações → Agendamento, com o padrão de cada modalidade. "Lançar freepass" na aba Contratos e a janela de lançamento. A etiqueta Visitante e a cor na ficha, e o cartão do freepass na aba Contratos com o andamento e o "Encerrar freepass". Marcar venda, Nova matrícula e Marcar perda encerrando o freepass. Linha do tempo com o lançamento e o encerramento. Regras do Firestore da coleção nova. Mockups da cor, da aba Contratos e da janela.
2. **O Agendar.** O passo "Freepass" no Agendar da ficha e no Remarcar da Meta, a contagem das aulas e a trava de N aulas. A ponte do Stronizap e da IA com o tipo padrão, e a faixa do cartão do Stronizap lendo o freepass.
3. **A tela Visitantes e o selo.** A lista nova e o selo no Pipeline, em Todos os leads, em Clientes e na busca. A aba "Em andamento" de Aulas sai.
4. **A Meta Diária.** A categoria "Fim do freepass" e a entrada em Atrasados no dia seguinte.
5. **Painel e relatório.** A faixa Freepass na aba CRM e o submenu Freepass nos Relatórios.
6. **O balão do Stronizap.** "Quantas aulas" vira "Freepass", com o tipo escolhido pelo atendente. Fica no repositório `whatsapp-stronix` e depende da entrega 2 no ar.

A entrega 1 já serve sozinha: a equipe lança o freepass e enxerga o Visitante na ficha. As entregas 3, 4 e 5 não dependem uma da outra e andam em qualquer ordem depois da 2.

## Fora do escopo

- Prazo em dias para o freepass por aulas.
- Limite de freepass por semana ou por modalidade na academia (o playbook de ligações fala nisso para o passe livre do inativo, e a gestão ainda não definiu o número).
- Apagar os freepass junto com o lead excluído (o mesmo limite que os registros de aula já têm).
