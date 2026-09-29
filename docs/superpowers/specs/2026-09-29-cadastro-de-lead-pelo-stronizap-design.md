---
status: revisão
---

# Cadastro de lead pelo Stronizap

Spec aprovada em conversa com o Johnny em 29/09/2026. Vale para o Stronilead e para o Stronizap.

É o primeiro de dois projetos. Este cadastra o lead de dentro da conversa. O segundo, agendar visita e aula experimental pelo Stronizap, parte daqui, e o levantamento do código dele já está em `2026-09-29-agendamento-pelo-stronizap-levantamento.md`.

Os mockups aprovados estão em `2026-09-29-cadastro-de-lead-pelo-stronizap-mockup.html`, nesta mesma pasta.

## O problema

Quando alguém que não está no Stronilead escreve no WhatsApp da academia, o cartão do Stronizap mostra "Sem cadastro" e para ali. Para cadastrar, o consultor sai da conversa, abre o Stronilead, digita nome e telefone no Novo lead e volta.

A rotina comercial pede o registro no momento do contato, não no fim do dia. A regra de atribuição diz que o que não está no Stronilead não dá direito à venda. Hoje, cumprir as duas custa uma troca de sistema a cada lead novo.

O próximo passo, agendar visita e aula experimental pelo Stronizap, depende deste: sem cadastro, o agendamento não tem em quem gravar.

## O que muda na spec da ponte

A spec da ponte (`2026-09-08-ponte-stronizap-design.md`) decidiu "Cadastro a partir do Zap: não existe" e deixou a classificação sempre no Stronilead. O motivo era não sujar o funil, porque funil sujo derruba comissão, meta e atribuição.

Esta spec troca essa decisão, a pedido do Johnny, com três limites que protegem aquele motivo:

- Nada é cadastrado sozinho. Uma pessoa da equipe preenche e confirma.
- Só cadastra quem está na equipe do Stronilead, com as regras do Stronilead.
- O Stronizap não inventa nenhuma lista. Origem, dor, funil, etapa, modalidade e parentesco vêm do Stronilead.

A fila de contatos a classificar e o vínculo da conversa com lead de outro telefone continuam na Parte B da ponte.

## Decisões

| Assunto | Decisão |
|---|---|
| Ordem | Primeiro o cadastro, depois o agendamento (projeto 2). |
| Onde fica o formulário | No painel do contato, na seção do Stronilead (modelo B dos mockups). A conversa fica à vista enquanto a pessoa preenche. |
| Quem vira dono | Quem cadastrou, como no Stronilead. O gestor pode escolher o responsável. |
| Quem é gestor | Quem tem o papel de gestor no Stronilead. O Stronilead acha a pessoa pelo e-mail que ela usa no Stronizap. |
| Escolha do responsável no Stronilead | Não muda. O Novo lead do Stronilead continua sem essa escolha. |
| Campos | Nome, origem, funil e etapa, dor (obrigatória), modalidade de interesse (opcional) e menor de idade. Indicação e observação ficam de fora. |
| Linha do tempo | Um registro próprio, o marco de início (modelo C dos mockups), no lugar de uma nota de texto. |
| Listas | Todas vêm do Stronilead a cada abertura do formulário. Item novo nasce no Stronilead. |
| Canais | Só WhatsApp com número. Instagram e contato sem número (LID) ficam de fora. |
| Liberação | O botão aparece em toda academia com a integração ligada, e essa é a única condição. Sem a integração, o Stronizap funciona sozinho, como hoje. |
| Nomes dos campos | "Nome do responsável" para quem responde pelo menor, como no Novo lead, e "Consultor responsável" para o dono do lead, como na ficha. |
| Número sem o nono dígito | O celular antigo ganha o 9 que falta ao ser gravado. |

## Na tela do Stronizap

### Quando aparece

A seção do Stronilead no painel do contato ganha o botão "Cadastrar lead" quando tudo isto vale:

1. a integração com o Stronilead está ligada;
2. o contato é de WhatsApp e tem número (`jidSuffix` nulo);
3. o cartão respondeu "Sem cadastro" (`found: false`);
4. a sessão não é a do superadmin entrando como admin da academia.

Vale para qualquer papel do Stronizap que já vê o cartão: admin, gestor e atendente com acesso ao canal. Quem decide se a pessoa pode cadastrar é o Stronilead, pela equipe dele.

No cabeçalho da conversa, o item "Sem cadastro" ganha ao lado o link "Cadastrar". Ele abre o painel com o formulário já aberto.

O formulário começa fechado, com o texto de hoje ("Esse número não está na base.") e o botão. Fornecedor, banco e entregador também aparecem como "Sem cadastro" e não precisam de formulário aberto no painel.

Com o Stronilead indisponível (`reason: 'indisponivel'`) ou a integração desligada, nada muda: a seção continua sumindo como hoje.

### O formulário

Ao abrir, o Stronizap pede as opções ao Stronilead e mostra "Carregando…" no lugar dos campos. Os campos, na ordem:

| Campo | Vem preenchido com | Regra |
|---|---|---|
| Nome | O nome do contato no Stronizap | Obrigatório, 2 letras ou mais |
| Quem escreve é responsável por um menor | Desligado | Ver "Menor de idade" |
| Origem | A origem do catálogo com "WhatsApp" no nome. Sem ela, a primeira em ordem alfabética | Obrigatória |
| Dor ou necessidade | Vazio | Obrigatória |
| Modalidade de interesse | Vazio | Opcional |
| Funil e etapa | O funil padrão da academia e a primeira etapa dele, como no Novo lead | Obrigatório. Renovações, Vencidos, Upgrade e Indicações não aparecem |
| Consultor responsável (só gestor) | Você | A equipe do Stronilead |

A consultora não vê o campo Consultor responsável. No lugar dele aparece "Fica com você (Ana Souza) e soma na sua Meta diária." Quando o gestor escolhe outra pessoa, aparece "Ana recebe o aviso no sino do Stronilead."

Sem dor cadastrada na academia, o campo diz "Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores." e o botão não cadastra. É a mesma trava do Novo lead.

Nenhuma lista do formulário mora no código do Stronizap, nenhum campo aceita texto livre para elas e não existe botão de criar item. Os únicos campos de texto são nomes de pessoa e o WhatsApp do aluno.

### Menor de idade

Com a chave ligada, o campo Nome vira:

- Nome do aluno (obrigatório);
- Nome do responsável (obrigatório, começa com o nome do contato);
- Parentesco (opcional, com a lista que vem do Stronilead);
- WhatsApp do aluno, se tiver (opcional).

Embaixo, o aviso: "O número desta conversa fica como telefone do responsável." O WhatsApp do aluno não pode ser o mesmo número da conversa.

### Depois de cadastrar

- O formulário vira o cartão do lead no mesmo lugar, com a linha "Cadastrado agora por você". Essa linha só aparece na tela de quem cadastrou e some ao trocar de conversa.
- O nome do contato passa a ser o do cadastro, com a trava de nome que já existe.
- O cabeçalho troca "Sem cadastro" pelo estado do lead ("Lead · Novo lead · Ana Souza"). No menor, vira "Responsável por Pedro".
- Quem está com o mesmo contato aberto em outro computador vê a troca sem recarregar.
- O cursor volta para a caixa de digitar, como depois de Agendar ou Transferir. O mesmo vale para Cancelar.

Trocar de conversa com o formulário aberto descarta o que foi digitado. Abrir e fechar o formulário anima nos dois sentidos, como toda janela do Stronizap.

### Abrir no Stronilead

Todo cartão com lead ganha o link "Abrir no Stronilead", que abre a ficha em outra aba. Vale para cartão de lead e de cliente, e para cada menor no cartão do responsável. O endereço é:

```
<endereço do CRM>/<identificador da academia>/ficha/<id do lead>
```

O identificador da academia que o Stronizap guarda é o mesmo que aparece no endereço do Stronilead. O endereço leva só o id, sem nome nem telefone, como pede a regra do Stronilead.

Na tela de Contatos, onde não há conversa aberta, o cartão mostra o link, mas não o botão de cadastrar.

## No Stronilead

### Um montador só para o lead novo

Hoje o Novo lead (`src/modals/AddLeadModal.jsx`) monta o documento do lead dentro da tela. Essa montagem sai para uma função pura em `src/lib/`, usada pelo Novo lead e pela ponte. Assim os dois gravam os mesmos campos, e um campo novo no Novo lead chega sozinho no cadastro pelo Stronizap.

As datas de servidor (`createdAt`, `statusEnteredAt`) ficam com quem grava, porque cada lado usa um SDK diferente.

O comportamento do Novo lead não muda. O teste da função trava os campos que ele grava hoje.

### O que é gravado

Tudo numa transação só:

1. **Conferência de duplicado.**
   - Qualquer lead ou cliente com o `zapMatchKey` do número da conversa barra o cadastro, e a resposta traz o cartão dele.
   - No menor, o telefone do responsável não barra, porque irmãos dividem o número. Barra um lead com o mesmo `guardianZapMatchKey` e o mesmo nome de aluno.
   - O WhatsApp do aluno, quando preenchido, também é conferido.
2. **O lead**, pelo montador, com:
   - `whatsapp` no formato do Novo lead, sem o 55, pela mesma regra do `zapMatchKey`, e com o nono dígito quando o celular antigo vier sem ele: com 10 dígitos e o primeiro número depois do DDD entre 6 e 9, entra um 9 logo depois do DDD. Telefone fixo continua com 10 dígitos, e o `zapMatchKey` não muda. A mesma regra vale para o telefone do responsável e para o WhatsApp do aluno;
   - os campos de busca (`buildLeadSearchFields`) e, no menor, o bloco do responsável (`buildGuardianPatch`), com o número da conversa como telefone do responsável;
   - o dono: quem cadastrou, ou quem o gestor escolheu;
   - quando o dono não é quem cadastrou, `consultantChangedAt`, `consultantChangedByName` e `consultantChangedByAuthUid`, que acendem o aviso "passado para você" no sino sem mudança no sino;
   - `lastInteractionAt` e `interactionsCount: 1`, como fazem o cadastro com observação e o link de indicação.
3. **O marco de início**, a interação descrita abaixo.

### O marco de início

Interação em `stronix_interactions`:

| Campo | Valor |
|---|---|
| `type` | `'zap_signup'` |
| `leadId`, `leadName` | o lead novo |
| `consultantName` | quem cadastrou (é o autor na linha do tempo) |
| `actorId`, `actorAuthUid` | quem cadastrou |
| `leadConsultantId`, `leadConsultantAuthUid` | o dono |
| `ownerName` | o dono, só quando não é quem cadastrou |
| `zapChannelName` | o canal do Stronizap onde a conversa aconteceu |
| `text` | "Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção." |
| `createdAt` | hora do servidor |

O `text` serve para qualquer tela que ainda não conheça o tipo mostrar algo que faz sentido.

Na ficha, o registro aparece no fim da linha do tempo, que é onde a história do lead começa (modelo C dos mockups): uma linha fina com a pílula "Início · cadastrado pelo Stronizap por Johnny em 28/09 às 14:32" e, embaixo, "Consultor responsável Ana Souza · canal Recepção". O consultor responsável só aparece quando não é quem cadastrou. Quando é a mesma pessoa, a linha de baixo fica só com o canal, e o `text` sai sem essa parte.

A linha "Início da jornada", que a ficha já mostra, some quando o marco de início existe, para o começo da história não aparecer duas vezes.

A pílula leva a marca do Stronizap, um balão escuro com raio verde. No tema escuro entra a versão clara da marca. Ela vira um componente do Stronilead, do mesmo jeito que o Stronizap tem o `StronileadMark`.

Regras do registro:

- `classifyInteraction` devolve um tipo novo, `'origin'`. Ele entra no filtro "Marcos" e aparece com o interruptor "Sistema" desligado.
- Não conta como contato feito. Fica fora do "já interagiu hoje" (`src/lib/leads.js`) e do primeiro contato do Dashboard CRM do Stronilead (`src/lib/crm/contact.js`), igual à observação do cadastro. Todo lugar que hoje reconhece a observação do cadastro por `isRegistrationNote` passa a reconhecer também este tipo.
- Não tem `volumeKind`. O lead cadastrado entra na prospecção do dono pelo próprio lead, como no Novo lead.
- O feed de atividade do dashboard, onde a observação do cadastro ganhava rótulo, saiu em 12/09 (commit `7de8114`). Não há rótulo novo a criar. O extrato de prospecção da visão Equipe continua mostrando "Lead cadastrado", sem marca nova no lead.

### Conferências do servidor

O `firebase-admin` passa por cima das regras do Firestore. Por isso a ação faz sozinha o que as regras e a tela do Novo lead fazem:

- **Academia ativa.** A mesma conferência de `tenantActive` das regras do Firestore, que é a trava que a academia encontra ao gravar no próprio Stronilead: suspensa, teste vencido e atraso de mais de 3 dias ficam de fora. A tela de login do Stronilead deixa entrar quem tem o teste vencido e já pagou, mas as regras não deixam gravar, e o cadastro pelo Stronizap segue as regras. Vale também para as opções, para o formulário nem abrir.
- **Equipe.** A pessoa é achada em `stronix_users` pelo e-mail em minúsculas, e precisa ter `authUid`. Sem isso, a resposta é "fora da equipe".
- **Papel.** Escolher o dono só vale para quem é gestor (`role: 'admin'`). Se uma consultora mandar outra pessoa como dono, o cadastro é recusado. O dono escolhido precisa estar na equipe.
- **Catálogos.** Origem, dor, modalidade, funil e etapa são conferidos contra o que existe no momento do cadastro. Item que sumiu é recusado, e a resposta diz qual campo mudou.
- **Menor.** As regras do `src/lib/guardian.js` e o `sameContactPhone`.
- **Limite.** No máximo 60 cadastros por hora por academia, pelo `api/_rateLimit.js`.

## A ponte

Duas ações novas no `POST /api/zap`, com a chave no header `x-stronizap-key`. Elas são desviadas na primeira linha do `handlePost`, como o `match`, e não criam função nova na Vercel.

### Opções do cadastro

```
POST /api/zap
{ action: 'lead-options', tenant, actor: { email } }

200 {
  actor: { id, name, role: 'consultor' | 'gestor' },
  sources: [{ name }],
  dores: [{ name }],
  modalities: [{ name }],
  funnels: [{ id, name, stages: [{ name }] }],
  relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
  defaults: { source, funnelId, stage },
  team: [{ id, name }]            // só para gestor, sem e-mail
}
```

### Cadastrar

```
POST /api/zap
{
  action: 'create-lead',
  tenant,
  phone,                          // o número do contato como o WhatsApp guarda
  actor: { email, name },
  channelName,
  lead: {
    name,                         // no menor, o nome do aluno
    source, dor, modalidade,      // modalidade pode ser null
    funnelId, stage,
    ownerId,                      // só gestor; consultora manda null
    minor: null | { guardianName, relationship, studentWhatsapp }
  }
}

201 { card }                      // o mesmo cartão que o GET devolve para esse número
```

### Recusas

Toda recusa de regra traz `message`, um texto pronto para a tela, escrito pelo Stronilead. O Stronizap mostra o texto como veio, porque nenhuma regra de negócio é recalculada do lado de lá.

| HTTP | `error` | Na tela |
|---|---|---|
| 400 | `dados_invalidos`, com `field` | A mensagem, no campo |
| 401 | | Chave inválida: o mesmo tratamento do cartão, a seção some |
| 403 | `academia_bloqueada` | "O Stronilead desta academia está bloqueado. Fale com o gestor." |
| 403 | `fora_da_equipe` | O aviso de quem não está na equipe (quadro 5) |
| 409 | `ja_cadastrado`, com `card` e `createdAt` | O cartão, com "Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima." quando o cadastro tem menos de 10 minutos, ou "Esse número já estava no Stronilead." |
| 422 | `catalogo_mudou`, com `field` | "Essa modalidade não existe mais no Stronilead. Escolha de novo.", e as opções recarregam |
| 422 | `sem_dor_cadastrada` | O aviso do campo Dor |
| 422 | `responsavel_invalido` | "Essa pessoa não está mais na equipe do Stronilead." |
| 422 | `menor_invalido`, com `field` | A mensagem, no campo |
| 429 | `limite` | "Muitos cadastros em pouco tempo. Tente de novo em alguns minutos." |
| 5xx ou sem resposta | | Quadro 6, com "Tentar de novo" |

"Tentar de novo" depois de um erro sem resposta não duplica. Se o lead chegou a ser criado, a nova tentativa recebe `ja_cadastrado` e mostra o cartão.

## No Stronizap

- **Duas rotas, sob a conversa**, porque a conversa diz o canal, que vai no marco e decide a permissão:
  - `GET /api/conversations/:id/crm-lead-options`
  - `POST /api/conversations/:id/crm-lead`

  As duas passam por `authenticate`, recusam o superadmin e a sessão de impersonação, conferem a organização e o acesso ao canal, e exigem contato de WhatsApp com número e integração ligada.
- **`services/crm.service.ts` ganha as duas chamadas**, no padrão de dependências injetadas da casa. A chave continua só ali. O e-mail sai da sessão (`req.user.email`) e o nome sai do cadastro do colaborador. Nada disso vem do navegador.
- **Tempo máximo:** 4 segundos nas opções e 8 no cadastro, que roda uma transação.
- **Depois de um cadastro bem-sucedido:**
  1. o `CrmCache` ganha a troca de um número só e guarda o cartão novo;
  2. `registrarCoberturaDoCartao` marca `crmFound`;
  3. `syncCrmName` grava o nome do cadastro no contato e avisa pelo `contact_updated`;
  4. um evento novo do socket, `crm_card_updated { contactId, card }`, vai para a sala do canal, e o `crm.store` troca o cartão de quem está com o contato aberto.
- **Resposta `ja_cadastrado`:** o Stronizap faz os mesmos quatro passos com o cartão que veio.
- **O link "Abrir no Stronilead"** é montado com o endereço do CRM e o identificador da academia, que já estão na configuração da organização.

## O contrato da ponte

Os quatro arquivos de sempre mais o smoke:

| Repositório | Arquivo |
|---|---|
| crm-stronix | `api/_zapCard.js` |
| crm-stronix | `api/zap.js` |
| whatsapp-stronix | `backend/src/services/crm.service.ts` |
| whatsapp-stronix | `frontend/src/types/crm.ts` |
| whatsapp-stronix | `backend/src/scripts/smoke-crm-card.ts` |

O cartão não muda de forma. O smoke passa a conferir também a resposta de `lead-options`, que só lê. Ele nunca chama `create-lead` em produção.

## Testes

**Stronilead**, com o relógio do processo em UTC, que foi a lição da correção do fuso (PR #227):

- O montador gera os mesmos campos que o Novo lead grava hoje.
- `lead-options` e `create-lead` com o banco falso da rota (`api/__tests__/zapRoute.test.js`), cobrindo:
  - consultora cadastrando;
  - gestora escolhendo outra pessoa;
  - pessoa fora da equipe;
  - academia bloqueada;
  - número já cadastrado;
  - dois pedidos ao mesmo tempo;
  - menor, irmão com o mesmo responsável e aluno repetido;
  - WhatsApp do aluno igual ao do responsável;
  - item de catálogo apagado e academia sem dor cadastrada;
  - limite por hora;
  - o desvio da primeira linha do `handlePost`, que não pode misturar os caminhos da chave e do login.
- O banco falso ganha transação, `add` e `update`, lendo `exists` como propriedade, igual ao SDK de servidor.
- O marco de início: classificação, filtro Marcos, a ficha nos dois temas, e as contas que não podem contá-lo como contato.

**Stronizap:**

- O serviço da ponte com dependências injetadas (`node:test`).
- As rotas: papel, impersonação, contato sem número, Instagram, integração desligada e organização alheia.
- A troca de um número só no `CrmCache`.
- O formulário e os estados dos mockups (vitest).
- A suíte de isolamento entre organizações cobrindo as rotas novas.

**De ponta a ponta, antes de publicar o Stronizap:** o Stronizap deste branch rodando na máquina, ligado ao Stronilead de produção na academia de teste (`academia-teste`), com uma chave gerada nas Integrações dela, e um número de WhatsApp de teste. Nenhuma academia de cliente vê o botão antes disso.

## Publicação

1. **Stronilead primeiro.** As ações novas ficam paradas até alguém chamar. A Vercel publica no merge.
2. **O teste de ponta a ponta**, descrito acima.
3. **Stronizap depois**, à mão no servidor, com o smoke antes. Não há mudança no banco do Stronizap. A partir daí, o botão aparece em toda academia com a integração ligada. Não existe outra chave.

Antes de ligar numa academia, conferir no Stronilead dela:

- cada pessoa da equipe usa o mesmo e-mail nos dois sistemas;
- existe uma origem com "WhatsApp" no nome;
- existem dores cadastradas.

Com o recurso em produção, atualizar o `CLAUDE.md` dos dois sistemas, a seção da ponte em `06-sistemas/CLAUDE.md` e a tabela de últimas atualizações do `CLAUDE.md` da raiz.

## Fora deste projeto

- Instagram e contato sem número.
- Indicação e observação no formulário.
- CPF, nascimento, e-mail, sexo e etiquetas. Completam-se na ficha.
- Cadastrar mais um menor para quem já é responsável.
- Ligar a conversa a um lead que usa outro telefone (Parte B da ponte).
- Achar duplicado pelo nome.
- A escolha do responsável no Novo lead do Stronilead.
- O agendamento de visita e aula experimental (projeto 2).

## Critérios de aceitação

- [ ] Contato de WhatsApp com número e sem cadastro mostra "Cadastrar lead" no painel e "Cadastrar" no cabeçalho. Instagram, contato sem número e a aba do superadmin entrando como admin não mostram.
- [ ] Consultora cadastra e vira dona. Gestor escolhe o responsável, e o responsável recebe o aviso no sino.
- [ ] Pessoa fora da equipe do Stronilead vê o aviso e não cadastra.
- [ ] O lead nasce com os mesmos campos do Novo lead, no funil e na etapa escolhidos, e aparece no Pipeline e na Meta Diária do dono.
- [ ] A ficha mostra o marco de início nos temas claro e escuro, e ele não conta como contato.
- [ ] Nenhuma lista do formulário está no código do Stronizap. Item novo no Stronilead aparece na próxima abertura, e item apagado é recusado com aviso.
- [ ] Dois cliques ou duas pessoas no mesmo número resultam num lead só.
- [ ] No menor, o número da conversa vira o telefone do responsável, irmão entra, o mesmo aluno com o mesmo responsável não duplica, e o cartão vira "Responsável por Pedro".
- [ ] Academia bloqueada não cadastra, e o limite de 60 por hora vale.
- [ ] Depois do cadastro, o cartão aparece no lugar do formulário, o nome do contato vira o do cadastro, e outro computador com o contato aberto vê a troca sem recarregar.
- [ ] Com o Stronilead fora do ar, o formulário fica preenchido. Se o lead foi criado apesar do erro, a nova tentativa mostra o cartão sem duplicar.
- [ ] A chave nunca chega ao navegador, e quem cadastrou sai da sessão, nunca do que o navegador manda.
- [ ] "Abrir no Stronilead" abre a ficha certa em todo cartão de lead ou cliente e em cada menor.
- [ ] Nenhum dado vaza entre academias nem entre organizações.
- [ ] Número antigo, sem o nono dígito, é gravado com o 9, e o cartão continua achando a pessoa.
- [ ] Sem a integração ligada, o Stronizap não mostra nada do cadastro e funciona como hoje.
