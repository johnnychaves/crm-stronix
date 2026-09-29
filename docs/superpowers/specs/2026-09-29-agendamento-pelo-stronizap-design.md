---
status: revisão
---

# Agendamento pelo Stronizap

Spec aprovada em conversa com o Johnny em 29/09/2026. Vale para o Stronilead e para o Stronizap.

É o segundo projeto da sequência que começou com o cadastro de lead pelo Stronizap (`2026-09-29-cadastro-de-lead-pelo-stronizap-design.md`, em produção desde 29/09). O levantamento do código está em `2026-09-29-agendamento-pelo-stronizap-levantamento.md`, e os mockups aprovados, em `2026-09-29-agendamento-pelo-stronizap-mockup.html`, nesta mesma pasta.

## O problema

Quando o lead pede para conhecer a academia pelo WhatsApp, o atendente sai da conversa, abre a ficha no Stronilead, passa pelo assistente de agendamento, volta ao Stronizap e escreve a confirmação à mão. Na véspera, alguém precisa se lembrar de mandar o lembrete, e muitas vezes ninguém lembra.

O cadastro pelo Stronizap resolveu a primeira metade: quem escreve e não está no Stronilead vira lead sem sair da conversa. Este projeto resolve a segunda: marcar a visita ou a aula experimental, confirmar e lembrar, tudo de dentro da conversa.

## Decisões

| Assunto | Decisão |
|---|---|
| Onde começa | Só o "Agendar" do cabeçalho da conversa, depois da situação do lead. Nada no painel do contato nem no menu da caixa de digitar. |
| O balão | Passo a passo, como o assistente de agendamento do Stronilead. |
| O que agenda | Visita e aula experimental. Retorno por mensagem ou por ligação fica de fora. |
| Depois de agendar | O cartão troca na hora, e a confirmação para o lead fica escrita na caixa de mensagem, sem enviar. |
| Lembrete | O Stronizap envia sozinho, com o texto que a academia configurou. A academia escolhe entre "na véspera, a uma hora fixa" e "algumas horas antes". Nunca sai entre 21h e 8h. |
| Como grava | Exatamente o que o assistente do Stronilead grava. Por isso a Meta Diária, a ficha, as listas e os painéis tratam o agendamento como qualquer outro. |
| Ficha | O mesmo cartão de agendamento de hoje, com a marca do Stronizap ao lado de quem agendou (modelo A dos mockups). |
| Comparecimento, falta e cancelamento | Continuam sendo registrados no Stronilead. O cartão do Stronizap passa a mostrar o desfecho. |
| Remarcação | Pelo Stronizap, o próprio "Agendar" remarca. Pelo Stronilead, o cartão e o lembrete acompanham. |
| Aviso ao dono do lead | Nenhum. O dono fica sabendo pela ficha e, no dia, pela Meta Diária, como quando um colega agenda pelo Stronilead. |
| Quem pode agendar | As mesmas pessoas que podem cadastrar pelo Stronizap. |
| Para quem | O número pode casar mais de um cadastro: o próprio e os menores de quem ele é responsável. Nesse caso, o primeiro passo pergunta. |
| Horário que já passou | O Stronizap não aceita. |
| Listas | Unidades, modalidades, professores e quantidade de aulas vêm do Stronilead a cada abertura do balão. |
| Divisão | Três PRs, nesta ordem: o do Stronilead, o do agendamento no Stronizap e o do lembrete no Stronizap. |

## Na tela do Stronizap

### Quando aparece o "Agendar"

O link "Agendar" fica no cabeçalho da conversa, depois da situação do cadastro: "Lead · Primeiro contato · Ana Souza · Agendar". Aparece quando o cartão do Stronilead achou o número, seja lead, cliente ou responsável por um menor.

Não aparece:
- sem cadastro, porque ali fica o "Cadastrar", e depois do cadastro o "Agendar" já aparece;
- em contato sem número (Instagram e LID), pelo mesmo motivo do cadastro;
- com a integração desligada ou o Stronilead fora do ar, quando o cartão não carrega;
- na sessão do superadmin entrando como admin.

Podem agendar o admin, o gestor e o atendente com acesso ao canal. Quem não está na equipe do Stronilead com o mesmo e-mail do Stronizap vê, dentro do balão, o mesmo aviso de fora da equipe do cadastro.

O balão abre logo abaixo do link, com 380px, e segue as regras do balão do cadastro. Clicar fora fecha e deixa o foco onde a pessoa clicou. Cancelar, Esc e o agendamento feito fecham e devolvem o cursor à caixa de digitar. Só um balão fica aberto por vez, seja o do cadastro ou o do agendamento.

### O balão, passo a passo

Como no assistente do Stronilead, cada passo respondido vira uma linha com a escolha, que dá para clicar e trocar. O passo atual fica aberto, e os seguintes aparecem apagados.

- **Para quem?** Só quando o número casa mais de um cadastro. Lista o cadastro do próprio número, quando existe, e cada menor de quem ele é responsável, com o parentesco ("Filho", "Filha").
- **O que vai ser?** Visita ("Conhecer a unidade") ou aula experimental ("Treino de experiência").
- **Visita:** Unidade, com o endereço embaixo do nome, e depois Dia e horário. Academia com uma unidade só já vem com a unidade respondida. Academia sem unidade cadastrada não tem esse passo.
- **Aula experimental:** Modalidade, Professor, Quantas aulas e Dia e horário. O professor lista só quem dá a modalidade escolhida, mais "Treina sozinho". Sem professor para a modalidade, o passo mostra o aviso do Stronilead e oferece só "Treina sozinho". Quantas aulas mostra as opções da academia, que são 1, 2 e 3 quando ela não configurou outras.
- **Dia e horário:** os cinco dias do assistente, "Hoje", "Amanhã" e os dias da semana, só nos dias da meta da academia. Depois das 18h, os dias começam amanhã. O horário começa em 18:00 para hoje e 09:00 para os outros dias, e dá para trocar. "Outro dia" abre o calendário, em português. Horário que já passou não é aceito.

Os cinco dias, o horário padrão e todas as listas vêm prontos do Stronilead (ver "A ponte"). O Stronizap só desenha.

### Remarcar

Quando a pessoa escolhida já tem um agendamento do tipo escolhido, o balão avisa no topo: "A Mariana já tem visita marcada para quarta, 30/09, às 18:00. Agendar de novo troca o dia e o horário." O título e o botão viram "Remarcar visita" (ou "Remarcar aula"). A gravação segue o que o assistente do Stronilead faz ao agendar de novo: o agendamento que estava marcado troca de data, e a linha do tempo ganha um registro novo.

### O resumo e a confirmação

Com todos os passos respondidos, o balão mostra, embaixo do resumo:
- o bloco do lembrete (ver "O lembrete"), quando a academia ligou o lembrete;
- "Anotação (opcional)", com o mesmo texto de ajuda do Stronilead ("O que precisa ser tratado nesse contato?"), até 1.000 caracteres;
- a chave "Deixar a confirmação escrita na caixa de mensagem", ligada;
- o botão "Confirmar agendamento", ou "Remarcar visita" e "Remarcar aula" na remarcação.

Embaixo, à esquerda, o balão diz "Conta na sua Meta diária." quando o Stronilead diz que conta, isto é, para consultor em dia de meta. Para gestor e em dia fora da meta, a frase não aparece.

As falhas seguem o cadastro:
- com o Stronilead fora do ar, o que foi escolhido fica, e o botão vira "Tentar de novo";
- a recusa aparece com o texto do Stronilead, no passo do campo quando ele diz qual;
- quando uma lista mudou no Stronilead (unidade apagada, professor desligado), as opções voltam de lá com o que ainda vale do que foi escolhido.

### Depois de agendar

- O balão fecha, e o cartão do painel troca na hora para todos com a conversa aberta, como no cadastro. A linha "Agendamento" mostra o compromisso novo, e embaixo aparece "Agendado agora por você", com o "Abrir no Stronilead".
- Com a chave da confirmação ligada e a caixa de digitar da conversa vazia, o texto da confirmação entra na caixa, com o cursor no fim. Uma faixa acima da caixa diz "Visita agendada. A confirmação está na caixa." ("Aula agendada." na aula), com o botão "Apagar". A faixa some quando a pessoa mexe no texto, apaga ou envia.
- Com a caixa ocupada, o texto não entra, para não apagar o que a pessoa estava escrevendo, e um aviso diz "Visita agendada no Stronilead."
- Nada é enviado sozinho. A pessoa revisa, pode passar pela reescrita com IA e envia.

### O texto da confirmação

O texto é fixo neste projeto e sai do que foi escolhido no balão:
- Visita: "Combinado, Mariana! Sua visita ficou para quinta-feira (01/10), às 18h, na unidade Centro (Rua Garibaldi, 1200)."
- Aula: "Combinado, Mariana! Sua aula experimental de Pilates ficou para sexta-feira (02/10), às 19h, com Carla."
- Mais de uma aula: "Combinado, Mariana! Suas 2 aulas experimentais de Pilates começam sexta-feira (02/10), às 19h, com Carla."
- Menor: "Combinado, Mariana! A visita de Pedro ficou para …" e "A aula experimental de Pilates de Pedro ficou para …".

Regras:
- O nome é o primeiro nome do contato. Sem nome, a frase começa em "Combinado!".
- O dia é "hoje (29/09)", "amanhã, quarta-feira (30/09)" ou "quinta-feira (01/10)".
- A hora é "18h" em hora cheia e "18h30" nos outros casos.
- Unidade sem endereço sai sem os parênteses, e academia sem unidade sai sem "na unidade".
- "Treina sozinho" sai sem o "com …". O professor vai pelo primeiro nome, sem artigo, para não adivinhar o gênero.

### O desfecho no cartão

A linha "Agendamento" do cartão, no de lead, no de cliente e no de cada menor, passa a mostrar o desfecho quando o Stronilead o registra: "Visita · 01/10 às 18:00 · Compareceu" ou "· Faltou". Quando o Stronilead registra cancelamento, ele zera o agendamento, e a linha some. Depois de uma remarcação, a linha mostra a data nova.

## No Stronilead

### O que é gravado

A ação de agendar grava exatamente o que `handleWizardConfirm` (`src/views/LeadProfileView.jsx`) grava hoje, e numa transação só:

1. **O registro em `stronix_aulas`**, com os campos de `aulaRecordFields` (`src/lib/aulas.js`). A aula reaproveita o `currentAulaId` do lead quando ele ainda está `agendada`, e a visita reaproveita a visita `agendada` do lead, como `upsertScheduledAppointment` (`src/lib/aulasWrites.js`). Os campos de consultor do registro vêm do dono do lead.
2. **A interação**, como `logInteraction` (`src/lib/interactions.js`) grava: `type: 'note'`, `volumeKind` (`visita` ou `aula_experimental`), o nome de quem agendou em `consultantName`, `actorId` e `actorAuthUid` de quem agendou, os campos de segurança do dono (`getInteractionSecurityFields`) e o texto que `parseAppointment` (`src/lib/timeline.js`) lê:
   - "🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho."
   - "🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00."

   A data do texto sai no horário de Brasília, porque a Vercel roda em UTC. Dois campos novos marcam a origem: `via: 'stronizap'` e `zapChannelName`, o nome do canal da conversa.
3. **O lead**, com `buildSchedulePatch` (`src/lib/schedulePatch.js`), `lastInteractionAt` e `interactionsCount` mais um. O patch já zera o desfecho anterior (`appointmentOutcome`, `appointmentOutcomeAt` e `appointmentOutcomeBy`).

No assistente do Stronilead, o registro de aulas é gravado separado e pode falhar sozinho. Pela ponte, os três vão juntos, e uma falha não deixa pedaço gravado.

Agendar não muda a etapa do lead, igual ao assistente.

### A ficha

- O agendamento continua sendo o cartão de agendamento de hoje, a variante 3 da linha do tempo.
- Quando a interação tem `via: 'stronizap'`, a coluna do autor mostra a marca do Stronizap (`StronizapMark`, a mesma do marco de início) antes do nome. Ao passar o mouse, aparece "Agendado pelo Stronizap, canal Recepção".
- No desfecho, o rodapé que aponta para o agendamento de origem ganha a marca e o complemento: "Agendada em 29/09 por Ana Souza, pelo Stronizap".
- O resto não muda: o selo, a data, o texto e a classificação são os de sempre.

### A Meta Diária

Nada muda na Meta, porque ela lê o que o assistente grava:
- o ponto de agendamento vai para quem agendou (`actorAuthUid`), inclusive na remarcação. O gestor continua fora da contagem, e agendamento feito em dia fora da meta não conta;
- no dia, o lead aparece em "Visitas" ou "Aulas exp." para o dono do lead. Cliente e lead perdido não entram nessas tarefas, que é a regra de hoje;
- o lead sai dos Atrasados, porque o próximo contato passa a ser o dia do agendamento, e acende o "Já interagido hoje";
- comparecimento, falta e cancelamento continuam sendo registrados pela Meta ou pela tela de Aulas e Visitas.

A confirmação e o lembrete são mensagens de WhatsApp e não viram registro no Stronilead. Isso fica para a Parte B da ponte.

### Conferências do servidor

O `firebase-admin` passa por cima das regras do Firestore, então a ação confere, antes de gravar:
- academia ativa (`tenantBlocked`) e pessoa da equipe achada pelo e-mail, como no cadastro;
- o lead escolhido é o cadastro do próprio número ou um menor de quem o número é responsável. Qualquer outro id é recusado;
- a unidade, a modalidade e o professor existem, o professor está ativo e dá a modalidade (ou é "Treina sozinho"), e a quantidade está nas opções da academia;
- data e hora válidas, no horário de Brasília, e ainda no futuro;
- se o lead já tem o mesmo tipo de agendamento no mesmo dia e horário, nada é gravado, e a resposta é `ja_agendado`, com o cartão. Dois cliques, duas pessoas ou o "Tentar de novo" depois de uma resposta perdida gravam uma vez só e dão um ponto só;
- no máximo 60 agendamentos por hora por academia (`checkRateLimit`, chave `zap-schedule:<academia>`).

## A ponte

Três ações novas no `POST /api/zap`, ao lado do `match` e das duas ações do cadastro, com a mesma autenticação pela chave. Nenhuma função nova na Vercel. As regras moram num arquivo novo, `api/_zapSchedule.js`, puro e testado, como `api/_zapLead.js`.

### Opções do agendamento (`schedule-options`)

Recebe `{ tenant, phone, actor: { email } }` e só lê. Devolve:
- `actor`: id, nome e papel (`consultor` ou `gestor`), mais `countsForMeta`, que diz se agendar hoje conta na Meta dessa pessoa;
- `targets`: os cadastros do número, cada um com `leadId`, `name`, `relationship` (só para menor) e o agendamento atual (`type` e `at`), que alimenta o aviso de remarcação;
- `units` (nome e endereço, na ordem da academia), `modalities` (id e nome), `professors` (id, nome e ids das modalidades, só os ativos) e `trialClassOptions`;
- `days`: os cinco dias sugeridos, já calculados no horário de Brasília, cada um com `date` (AAAA-MM-DD), `label` ("Hoje", "Amanhã", "Quinta") e `defaultTime` ("18:00" ou "09:00").

### Agendar (`schedule`)

Recebe `{ tenant, phone, actor: { email, name }, channelName, schedule: { leadId, type, unit, modality, professorId, soloTraining, quantity, date, time, note } }`. O `type` é `visita` ou `aula_experimental`, `date` vem em AAAA-MM-DD e `time` em HH:MM, os dois no horário de Brasília. Responde `201 { card, appointment: { leadId, type, at } }`, com o cartão do número já atualizado.

### Estado dos agendamentos (`appointment-status`)

Quem usa é o lembrete (PR 3), mas a ação entra no PR do Stronilead para ele subir uma vez só. Recebe `{ tenant, leadIds }`, até 30. Para cada lead, devolve o agendamento que a ficha, o cartão e a Meta mostram hoje (`type`, `at`, `unit`, `modality`, `professorName` e `outcome`), com o nome do lead, ou `null` quando não há agendamento. Lead que não existe na academia também volta como `null`.

O lembrete segue esse agendamento, e não o registro de `stronix_aulas`, porque o "Remarcar" da Meta Diária troca a data da visita no lead sem mexer no registro de aulas.

### O desfecho no cartão

O `appointment` do cartão (`api/_zapCard.js`) ganha `outcome`: `attended` ou `no_show`, quando o lead tem esse desfecho registrado, ou `null`. Vale no cartão de lead, no de cliente e no de cada menor.

### Recusas

| Código | Status | Quando |
|---|---|---|
| `dados_invalidos` | 400 | Pedido malformado, com `field` |
| `academia_bloqueada` | 403 | Academia suspensa, em teste vencido ou com mensalidade atrasada |
| `fora_da_equipe` | 403 | O e-mail não está na equipe do Stronilead |
| `lead_nao_confere` | 422 | O lead não é deste número nem menor de quem ele é responsável |
| `catalogo_mudou` | 422 | Unidade, modalidade, professor ou quantidade que não existe mais, com `field` |
| `horario_passado` | 422 | Dia e hora que já passaram |
| `ja_agendado` | 409 | O mesmo agendamento já existe, com `card` |
| `limite` | 429 | Mais de 60 agendamentos na última hora |

Toda recusa traz o `message` pronto para a tela, como no cadastro.

## No Stronizap: o agendamento (PR 2)

- Duas rotas novas, no molde das do cadastro: `GET /api/conversations/:id/crm-schedule-options` e `POST /api/conversations/:id/crm-schedule`. Elas passam pelas mesmas portas do cadastro (`crm-lead.service.ts`): superadmin e sessão assumida são recusados antes de olhar a conversa, depois vêm organização e canal, e o contato precisa ser de WhatsApp com número.
- Um serviço novo, `crm-schedule.service.ts`, chama as ações pela `crm.service.ts`, com 4 e 8 segundos de tempo máximo. Depois do agendamento, aplica o cartão como o cadastro aplica: troca no cache, cobertura, nome e o aviso `crm_card_updated` para a sala do canal. A parte comum sai do serviço do cadastro para um lugar só.
- Quem agendou sai da sessão (e-mail) e do colaborador (nome), nunca do corpo do pedido.
- O 401 do Stronilead vira 502 `chave_invalida`, integração desligada vira 412, e Stronilead fora do ar vira 503, como no cadastro.
- No front, entram o "Agendar" em `CrmHeaderMeta`, o balão com o assistente, a faixa da confirmação e o desfecho na linha de Agendamento do `CrmCardSection`. O estado de qual balão está aberto, que hoje no `ChatPage` é só do cadastro, passa a saber dos dois.
- A faixa da confirmação guarda num store o texto que entrou, porque a caixa de digitar remonta a cada conversa. Ela aparece enquanto o texto da caixa for igual a esse, no mesmo jeito do Desfazer da reescrita.
- O calendário compartilhado (`components/ui/calendar.tsx`) passa a usar o português. Hoje ele mostra os meses em inglês, também no "Agendar mensagem".

## O lembrete (PR 3)

### Configuração

Em Configurações → Stronilead, só para o admin, embaixo dos dados da conexão, entra o cartão "Lembrete de agendamento":
- uma chave para ligar e desligar. O lembrete nasce desligado, porque é mensagem que sai sozinha para o cliente, e quem liga é o admin;
- "Quando sai": "Na véspera, às [hora]" (padrão 18:00, entre 08:00 e 21:00) ou "[N] horas antes do horário marcado" (padrão 3, de 1 a 48);
- "Texto para visita" e "Texto para aula experimental", com as variáveis e a prévia.

A configuração fica em campos novos da `Organization`, o que pede uma migration.

Textos padrão:
- Visita: "Oi, [primeiro_nome]! Passando para lembrar da visita [do_aluno] [dia], às [hora], na unidade [unidade]. Até lá!"
- Aula: "Oi, [primeiro_nome]! Passando para lembrar da aula experimental de [modalidade] [do_aluno] [dia], às [hora]. Até lá!"

Variáveis:

| Variável | Vira |
|---|---|
| `[primeiro_nome]` | Primeiro nome de quem recebe a mensagem, o contato |
| `[do_aluno]` | "de Pedro" quando o agendamento é de um menor, e nada quando é da própria pessoa |
| `[dia]` | "hoje (01/10)", "amanhã, quinta-feira (01/10)" ou "quinta-feira (01/10)", em relação ao dia em que o lembrete sai |
| `[hora]` | "18h" ou "18h30" |
| `[unidade]` | Nome da unidade |
| `[endereco]` | Endereço da unidade |
| `[modalidade]` | Nome da modalidade |
| `[professor_da_aula]` | Primeiro nome do professor, ou nada em "Treina sozinho" |
| `[meu_primeiro_nome]` | Primeiro nome de quem agendou |

O `[professor]` não entra, porque nas mensagens prontas ele quer dizer "quem está logado". Variável vazia some, e o espaço que sobra é limpo.

### Quando sai

- "Na véspera, às 18:00": no dia anterior ao agendamento, a essa hora.
- "3 horas antes": três horas antes do horário marcado.
- O lembrete só sai das 8h às 21h. Se a conta cair fora dessa faixa, ele sai às 20h do dia anterior ao agendamento.
- Se a hora do lembrete já passou, ou se falta menos de 30 minutos para ela, não há lembrete. O balão mostra "Sem lembrete" e explica o motivo. A confirmação na caixa já avisa o lead.

### No balão

No resumo, o bloco "Lembrete para a Mariana" mostra a chave (ligada), quando o lembrete sai ("Sai sozinho na véspera, quarta, 30/09, às 18:00") e o texto. "Editar texto" abre o texto para mudar só naquele agendamento, com "Voltar ao texto padrão".

A prévia e a hora vêm do backend do Stronizap (`POST /api/conversations/:id/crm-reminder-preview`), da mesma conta que agenda a mensagem, para o que aparece no balão ser o que vai sair.

### A mensagem agendada

- Ao confirmar o agendamento, o backend do Stronizap cria o lembrete como mensagem agendada da conversa (`status: SCHEDULED` e `scheduledFor`). O autor é quem agendou, com a mesma regra de nome no começo da mensagem ("Mostrar meu nome") que as mensagens agendadas já seguem.
- Um campo novo da mensagem, `crmReminder`, liga o lembrete ao agendamento. Ele guarda o lead, o primeiro nome de quem vai e se é menor (para o `[do_aluno]`), o tipo, o horário do agendamento, se o texto foi mudado à mão e quando o lembrete foi conferido pela última vez.
- A conversa mostra a bolha "Agendada para 30/09 às 18:00" com o cancelar de sempre: quem agendou cancela o seu, e admin e gestor cancelam qualquer um.
- Remarcar pelo Stronizap troca o lembrete: o anterior daquele lead e daquele tipo é apagado, e sai um novo.
- Se o agendamento der certo e o lembrete não, o agendamento vale, e o aviso diz "Agendado. O lembrete não foi criado."

### As duas proteções

**Conversa encerrada.** Hoje o agendador de mensagens marca como falha a mensagem de conversa encerrada. O lembrete é exceção: sai mesmo assim, e a conversa continua encerrada até o lead responder, quando ela volta para a fila, como sempre.

**Conferência com o Stronilead.** O lembrete segue o agendamento que o lead mostra no Stronilead (`appointment-status`):
- de 15 em 15 minutos, uma varredura confere os lembretes que ainda vão sair, em lotes de 30;
- na hora de enviar, o agendador confere de novo aquele lembrete.

Em cada conferência:
- mesmo tipo e mesmo horário: o lembrete fica e, na hora, sai. Com o texto padrão, a conferência remonta o texto com os dados de agora (unidade, modalidade, professor), para ele nunca citar algo que mudou no Stronilead;
- mesmo tipo e horário novo: com o texto padrão, o lembrete é refeito para a data nova, na hora nova. Com texto mudado à mão, ele é cancelado, porque o texto pode citar a data antiga;
- sem agendamento, outro tipo ou desfecho já registrado: o lembrete é cancelado;
- lembrete refeito para uma hora que já passou: cancelado.

Todo lembrete que muda ou é cancelado deixa uma nota interna na conversa, como "Lembrete da visita cancelado: o agendamento mudou no Stronilead." ou "Lembrete da visita remarcado para 02/10 às 18:00, junto com o agendamento."

Se o Stronilead não responder na hora de enviar, o agendador tenta de novo a cada minuto, por até 30 minutos. Depois disso, o lembrete não sai, e a nota diz "Lembrete da visita não enviado: o Stronilead não respondeu para confirmar o horário." Um lembrete com a data errada é pior que nenhum.

## O contrato da ponte

Mexeu num destes arquivos, confira os outros:

| Repositório | Arquivo |
|---|---|
| crm-stronix | `api/_zapCard.js` |
| crm-stronix | `api/zap.js` |
| crm-stronix | `api/_zapSchedule.js` (novo) |
| whatsapp-stronix | `backend/src/services/crm.service.ts` |
| whatsapp-stronix | `frontend/src/types/crm.ts` |
| whatsapp-stronix | `backend/src/scripts/smoke-crm-card.ts` |

O smoke passa a conferir também as opções do agendamento, que só leem, e o `outcome` do agendamento do cartão. Ele nunca agenda, porque `schedule` grava de verdade, e o teste de guarda do smoke passa a travar essa ação também.

## Testes

**Stronilead**
- `api/_zapSchedule.js`:
  - a leitura e a validação do pedido;
  - os cinco dias no horário de Brasília: antes e depois das 18h, dias fora da meta, virada de mês e de ano;
  - o texto da interação igual ao do assistente: visita com e sem unidade, aula com uma e com várias aulas, com professor e com "Treina sozinho", com e sem anotação;
  - a data do texto em Brasília, com o processo em UTC;
  - as conferências de catálogo, de horário passado e do lead do número.
- `api/zap.js`, no banco falso de `zapRoute.test.js`: as três ações, a transação (registro de aulas reaproveitado e novo, visita e aula), o `ja_agendado`, o limite, as recusas e o cartão devolvido.
- Um teste que passa o texto gravado pela ponte no `parseAppointment`, para a ficha continuar reconhecendo o agendamento.
- O `newLeadImports.test.js` passa a seguir também os imports de `api/_zapSchedule.js`.
- A ficha: a marca e o nome do canal no autor quando `via === 'stronizap'`, e o rodapé do desfecho.
- O cartão: o `outcome` do agendamento.

**Stronizap, agendamento**
- Backend: o serviço (portas, recusas, aplicação do cartão, quem agendou tirado da sessão) e as leitoras da ponte. A suíte de isolamento cobre outra organização, canal sem acesso, superadmin, sessão assumida e contato sem número.
- Front: o "Agendar" (quando aparece e quando não), o assistente (passos de cada tipo, "Para quem?", remarcação, unidade respondida sozinha, dias e horário, recusa no passo certo e "Tentar de novo"), a confirmação (o texto de cada caso, caixa vazia e caixa ocupada, faixa e "Apagar") e o desfecho no cartão.

**Stronizap, lembrete**
- A conta de quando sai: as duas formas, o intervalo das 21h às 8h, hora que já passou e menos de 30 minutos, com o processo em UTC.
- O texto: cada variável, variável vazia e o `[dia]` para hoje, amanhã e outro dia.
- A criação, a troca na remarcação, a exceção da conversa encerrada, a varredura e a conferência na hora de enviar, com cada desfecho da conferência e com o Stronilead fora do ar, na suíte de isolamento.
- A tela de configuração, só para admin, e o bloco do balão.

## Publicação

1. **Stronilead.** Merge, e a Vercel publica. As ações novas ficam paradas até o Stronizap chamar, e a ficha já sabe mostrar a marca.
2. **Stronizap, agendamento.** Deploy manual (`deploy.sh`) e, depois, o smoke no servidor.
3. **Stronizap, lembrete.** Deploy manual, que roda a migration. O lembrete nasce desligado em toda academia, e o admin liga em Configurações → Stronilead.

## Fora deste projeto

- Marcar comparecimento, falta ou cancelamento pelo Stronizap. Continua no Stronilead.
- Aviso ao dono do lead quando outra pessoa agenda.
- Retorno por mensagem ou por ligação pelo Stronizap.
- A confirmação e o lembrete na linha do tempo da ficha. Ficam para a Parte B da ponte.
- Mais de um agendamento ao mesmo tempo para o mesmo lead. O Stronilead mostra um só, o último, e o lembrete segue esse. A spec de agendamentos separados muda isso.
- Capacidade da aula, conflito de horário e horário de funcionamento da academia, que o Stronilead também não confere.
- Academia fora do horário de Brasília.
- Texto da confirmação configurável.
- O "Remarcar" da Meta Diária não atualiza a data da visita em `stronix_aulas`. O defeito é do Stronilead e fica anotado aqui, porque o lembrete foi desenhado para não depender disso.

## Critérios de aceitação

- O "Agendar" aparece no cabeçalho de toda conversa de WhatsApp com cadastro no Stronilead, para quem pode agendar, e não aparece nos casos listados.
- A visita e a aula agendadas pelo Stronizap aparecem na ficha como o agendamento do assistente, com a marca do Stronizap ao lado de quem agendou.
- A Meta Diária conta o ponto para quem agendou e mostra a tarefa ao dono do lead no dia, igual a um agendamento feito no Stronilead.
- Dois cliques em "Confirmar agendamento" gravam uma vez só.
- A confirmação entra na caixa vazia e nunca é enviada sozinha.
- O cartão mostra "Compareceu" ou "Faltou" depois que o Stronilead registra o desfecho.
- O lembrete sai na hora configurada, também com a conversa encerrada, e só das 8h às 21h.
- Remarcado pelo Stronilead, o lembrete acompanha ou é cancelado com nota. Cancelado pelo Stronilead, o lembrete é cancelado com nota. Ele nunca sai com a data antiga.
