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

Só o "Encerrar freepass" grava o fim. O fim natural (o último dia passou, ou a última aula passou), a perda e a matrícula saem da conta na hora da leitura, como a regra dos 18 anos do menor:

- lead em Perda não é Visitante;
- o resumo do freepass guarda o contrato atual da pessoa no lançamento (`freepassContractAtStart`, null no lead). Se o contrato atual mudou depois, houve matrícula ou renovação, e a pessoa não é mais Visitante.

Assim todo caminho que grava matrícula (Marcar venda, Nova matrícula, arrastar o card para Venda, Mudar fase para Venda) e todo caminho que marca perda encerram o freepass sem precisar mexer em nenhum deles. Limite aceito: o lead reativado da Perda dentro do prazo do freepass volta a aparecer como Visitante.

### Etiquetas e cor

Com o freepass correndo, a ficha mostra duas etiquetas lado a lado: "Lead" e "Visitante", ou, no ex-aluno, "Inativo" (ou "Cancelado") e "Visitante". Quando o freepass termina sem matrícula, a etiqueta Visitante some sozinha e a pessoa volta a ser só Lead (ou só Inativo).

A cor proposta é o verde-água (`teal` de `TONES`, em `src/lib/leadState.js`), que hoje não é cor de nenhum estado. Ela é confirmada nos mockups da entrega 1.

O Visitante não é um estado novo do `deriveLeadState`: é uma etiqueta a mais, por cima do estado de sempre. O Pipeline, os funis, o `lifecycleBucket` e as contas de cliente não mudam.

### Virar cliente

Só pelo "Marcar venda" do cabeçalho da ficha, que encerra o freepass como "virou matrícula". O ex-aluno não tem "Marcar venda" (já é cliente), então a matrícula dele continua pelo "Nova matrícula" da aba Contratos, que abre a mesma janela.

O fim pela matrícula sai da leitura (ver "Quando termina"), então nenhum freepass fica correndo num cliente novo, qualquer que seja o caminho da matrícula.

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
| `status` | `'correndo'` ou `'encerrado'` (só o "Encerrar freepass" grava) |
| `endedAt`, `endedBy*` | só no "Encerrar freepass" |
| `contractAtStart` | o contrato atual da pessoa no lançamento, null no lead |
| `consultantId`, `consultantName` | o dono do lead no lançamento |
| `createdBy*`, `createdAt` | quem lançou e quando |
| `via` | `'contratos'`, `'agendar'` ou `'stronizap'` |

O lead ganha um resumo do freepass que está correndo (`freepassId`, `freepassKind`, `freepassTotal`, `freepassTypeName`, `freepassModalidadeName`, `freepassStartsAt`, `freepassEndsAt`, `freepassAulas` (as aulas agendadas que já contam), `freepassStatus`, `freepassContractAtStart`), no molde do `currentContract*`. Com mais de um freepass correndo, o resumo é o que termina primeiro, e o por aulas ainda sem fim definido fica por último. A ficha lê os documentos, e as listas leem o resumo.

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

A entrega 1 vai ao ar atrás do módulo Stronix 2.0 (faltosos), para ser testada na STRONIX antes de valer para as outras academias (pedido do Johnny, 26/11/2026).

Cada entrega com tela nova começa por 2 ou 3 mockups para o Johnny escolher.

1. **A base.** Tipos de freepass em Configurações → Agendamento, com o padrão de cada modalidade (o painel de quantidades antigo fica até a entrega 2, porque o Agendar ainda o usa). "Lançar freepass" na aba Contratos e a janela de lançamento. A etiqueta Visitante e a cor na ficha, e o cartão do freepass na aba Contratos com o andamento e o "Encerrar freepass". O fim pela matrícula e pela perda, lido na hora. Linha do tempo com o lançamento e o encerramento. Regras do Firestore da coleção nova. Mockups da cor, da aba Contratos e da janela.
2. **O Agendar.** O passo "Freepass" no Agendar da ficha e no Remarcar da Meta, a contagem das aulas e a trava de N aulas. A ponte do Stronizap e da IA com o tipo padrão, e a faixa do cartão do Stronizap lendo o freepass.
3. **A tela Visitantes e o selo.** A lista nova e o selo no Pipeline, em Todos os leads, em Clientes e na busca. A aba "Em andamento" de Aulas sai.
4. **A Meta Diária.** A categoria "Fim do freepass" e a entrada em Atrasados no dia seguinte.
5. **Painel e relatório.** A faixa Freepass na aba CRM e o submenu Freepass nos Relatórios.
6. **O balão do Stronizap.** "Quantas aulas" vira "Freepass", com o tipo escolhido pelo atendente. Fica no repositório `whatsapp-stronix` e depende da entrega 2 no ar.

A entrega 1 já serve sozinha: a equipe lança o freepass e enxerga o Visitante na ficha. As entregas 3, 4 e 5 não dependem uma da outra e andam em qualquer ordem depois da 2.

## Entrega 2 em detalhe (decidida com o Johnny em 26/11/2026)

### O Agendar da ficha

A aula experimental passa a ser Modalidade → Freepass → Professor e dia → confirmação. O passo "Quantas aulas" sai, e com ele o painel "Aulas experimentais" de Configurações. O `trialClassOptions` continua gravado só para a ponte do Stronizap, até a entrega 6.

O passo Freepass mostra uma de quatro situações:

1. **Freepass correndo na modalidade:** a aula entra nele ("Usar o freepass Pilates 2 aulas, 1 de 2 agendadas").
2. **Nunca teve freepass na modalidade e ela tem tipo cadastrado:** o consultor escolhe o tipo e o freepass nasce com a aula. No por dias, o início é o dia da aula.
3. **Já teve freepass na modalidade, ou o freepass por aulas já tem todas as aulas agendadas:** aula avulsa, com o aviso "Já teve freepass de Pilates em 10/11" ou "O freepass já tem as 2 aulas". O gestor ainda pode lançar um freepass novo pela aba Contratos.
4. **Modalidade sem tipo cadastrado:** aula avulsa, como hoje.

### Todas as aulas no lançamento

No freepass por aulas, o lançamento (pela aba Contratos ou pelo Agendar) marca as N aulas de uma vez, cada uma com dia, horário e professor. No por dias, que é acesso livre, marca uma aula só.

- Cada aula é um registro em `stronix_aulas`, com o `freepassId`. A coleção já guarda várias aulas por pessoa.
- O lead continua com uma **aula da vez**, a próxima que ainda não teve desfecho, no agendamento de sempre (`appointment*` e `currentAulaId`). É ela que a Meta, a Agenda de hoje, o "A seguir", o cartão do Stronizap e Aulas mostram.
- A aula da vez passa para a seguinte do freepass **no dia da aula seguinte**, e não no desfecho: a Agenda de hoje lê o agendamento gravado no lead, e trocá-lo no Compareceu tiraria a aula de hoje da Agenda e impediria corrigir o desfecho no mesmo dia. Quem troca é o app de quem vende, ao abrir no dia (uma conferência das aulas de freepass do dia em `stronix_aulas`, que só grava quando o lead ainda está numa aula anterior). A aula anterior sem desfecho fica "sem desfecho" no registro, como qualquer aula que ninguém marcou.
- O cartão do freepass na aba Contratos lista as aulas, com o dia, a hora, o desfecho e um "Remarcar" em cada uma.
- **Cancelou** cancela só a aula da vez e passa para a seguinte. A vaga volta ao freepass como "1 aula a agendar", que o cartão mostra e deixa agendar.
- **Limite aceito:** a troca acontece quando alguém que vende abre o app no dia. Até lá, a Agenda de hoje, a Meta e o lembrete do Stronizap ainda não veem a aula do dia.

### Como as aulas contam

Cada aula agendada dentro do freepass conta, venha a pessoa ou não. Remarcar a mesma aula não conta de novo, e a aula cancelada devolve a vaga. O fim do freepass por aulas é o dia da última aula agendada, e ele só existe com as N aulas agendadas.

### Remarcar da Meta, Stronizap e IA

Sem escolha na tela:
- mover a mesma aula para outro dia não muda o freepass;
- aula nova entra no freepass que corre na modalidade;
- sem freepass correndo, nasce o freepass do tipo padrão da modalidade;
- quem já teve freepass na modalidade fica com aula avulsa.

O Remarcar troca o campo "Aulas previstas" por uma linha que diz o que vai acontecer ("Entra no freepass Pilates 2 aulas", "Aula avulsa"). O Stronizap e a IA marcam uma data só: nasce a 1ª aula, e as outras ficam "a agendar" no cartão do freepass, até a entrega 6 ensinar o balão a marcar várias. A ponte deixa de comparar a quantidade no pedido repetido (`hasSameAppointment`), porque ela não é mais gravada no lead.

### Aluno ativo e professor

- **Aluno com contrato valendo** pode ter freepass de outra modalidade. Ele aparece como "Upgrade · Pilates, faltam 3 dias", em violeta, como o funil Upgrade, e não como Visitante nem na lista de Visitantes. Quando fecha, conta como upgrade. O ex-aluno (vencido ou cancelado) continua "Inativo + Visitante".
- **Professor:** no Agendar dele, a aula só entra num freepass que já corre. Ele não lança freepass, e sem freepass correndo a aula fica avulsa. As regras ganham o que o Agendar dele grava no lead e, no `stronix_freepass`, só as aulas e o fim.

### Leituras que passam a usar o freepass

A faixa do cartão do Stronizap, a coluna "Passe livre" de Aulas, o "A seguir" e o fato "Aula" da Meta leem o freepass. As aulas marcadas antes da mudança continuam com o passe antigo (`trialClassesPlanned`) até acabarem.

## Fora do escopo

- Prazo em dias para o freepass por aulas.
- Limite de freepass por semana ou por modalidade na academia (o playbook de ligações fala nisso para o passe livre do inativo, e a gestão ainda não definiu o número).
- Apagar os freepass junto com o lead excluído (o mesmo limite que os registros de aula já têm).
