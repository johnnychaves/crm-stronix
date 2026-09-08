---
status: ativo
data: 2026-09-08
autor: Johnny — Fundador / CEO
sistemas: stronilead, stronizap
---

# Ponte Stronilead ↔ Stronizap

## Problema

O motor do Stronilead é a Meta Diária, e ela é meta-only: a tarefa só conta como feita quando o lead vira Venda ou Perda, ou quando alguém cria uma interação `daily_goal_done` na mão.

O contato em si acontece fora do sistema. O botão de WhatsApp abre `wa.me` em cinco lugares do app. O consultor sai do CRM, conversa, volta e marca que fez.

Disso saem três buracos:

1. O CRM não sabe o que foi dito. A timeline tem `note` digitado à mão.
2. A Meta Diária é autodeclarada. O gestor confia na palavra do consultor.
3. Lead que responde e ninguém responde de volta é invisível, porque o dado não existe.

E há um custo direto na regra de atribuição de vendas, que diz: "Se não estiver registrado no Stronilead, não há direito à venda." A regra é justa, mas hoje pune quem trabalhou e esqueceu de anotar.

Do outro lado, o atendente do Stronizap vê um telefone e um nome do WhatsApp. Ele não sabe se está falando com um lead em negociação, um aluno ativo ou alguém cujo contrato vence em duas semanas.

## Decisões já tomadas

| Assunto | Decisão |
|---|---|
| Público | Interno na STRONIX primeiro. O Stronizap já é SaaS multi-tenant, então a versão vendável não exige trabalho extra. |
| Canal de atendimento | A academia atende pelo número compartilhado, já conectado no Stronizap. A ponte captura 100% das conversas. |
| Dono do lead | O Stronilead manda e o Stronizap espelha. Exceção: lead que nasce do WhatsApp nasce com o dono da conversa, e daí em diante o Stronilead manda. |
| Independência comercial | Os dois continuam vendáveis separados. A ponte é um interruptor por cliente, não uma versão diferente do software. |
| Dados do CRM no Zap | Consulta na hora, com cache curto. Nada de espelhar em banco. |
| Situação de pagamento no cartão | Não exibir. |
| Faseamento | Parte A entrega a consulta e a interface. Parte B entrega os eventos e a Meta Diária automática. |
| Tratamento visual do cartão | Variante B: seção plana, com faixa de destaque abaixo do nome quando há prazo curto. |
| Gatilho da faixa | As categorias da Meta Diária mais o freepass. Sem regra nova. |
| Anel do avatar | Neutro na Parte A. Colorido por status fica para a Parte B, quando a conversa já tiver `crmLeadId` e o último cartão em cache. |
| Cadastro a partir do Zap | Não existe. A classificação acontece sempre no Stronilead. |

## Princípio de independência

Nenhum dos dois escreve o nome do outro no código.

O Stronizap tem uma "integração CRM", com endereço e chave. O Stronilead tem um "provedor de mensagem" conectado. Sem a chave configurada, os dois voltam ao comportamento atual: o Stronilead abre `wa.me` e o Stronizap não avisa ninguém.

Isso protege três coisas. O cliente pode cancelar um dos dois sem quebrar o outro. Uma academia que já usa outra ferramenta de WhatsApp pluga no Stronilead sem mudança de código. E o Stronizap pode servir o Stronix Suite ou o Gestão 360 depois, pelo mesmo contrato.

Consequência aceita: o terceiro nível, de virar produto único com um login só, sai da mesa. Ele daria o melhor produto e acabaria com o catálogo.

## Arquitetura

Dois sentidos de tráfego, uma credencial só.

```
Stronilead                                  Stronizap
  |                                              |
  |  GET /api/zap?phone=...                      |
  |<-------- quem é essa pessoa? ----------------|
  |--------- cartão + leadId ------------------->|
  |                                              |
  |  POST /api/zap                               |
  |<-------- mensagem aconteceu -----------------|
  |--------- 200 ------------------------------->|
  |                                              |
  |  navegador do consultor                      |
  |--------- abre /c?lead=...&phone=... -------->|
```

A chave é gerada no Stronilead e guardada cifrada no Stronizap. Ela serve para os dois sentidos de servidor. O terceiro caminho, o consultor clicando no lead, é só uma URL aberta no navegador de quem já está logado nos dois, e não usa credencial.

### Limite de funções na Vercel

O `api/` do Stronilead está com exatamente 12 funções, que é o teto do plano Hobby. A ponte cabe consolidando `admin-create-user`, `admin-set-password` e `admin-delete-user` num único `api/admin-users.js` com sub-rota, o que libera dois slots. A ponte usa um: `api/zap.js`, com `GET` e `POST`.

## Contrato

### GET /api/zap — quem é essa pessoa

```
GET /api/zap?phone=5551999998888
x-stronizap-key: <chave>

200 {
  found: true,
  leadId: "abc123",
  kind: "cliente" | "lead",
  name: "Maria Silva",
  consultantName: "Ana",
  // quando kind = lead
  stage: "Negociação",
  source: "Instagram",
  appointment: { type: "visita", at: "2026-09-10T18:00:00Z" } | null,
  // quando kind = cliente
  planName: "Musculação Anual",
  contractStatus: "ativo" | "a_vencer" | "trancado" | "vencido" | "cancelado" | "agendado",
  contractEndsAt: "2026-11-12T00:00:00Z",
  daysLeft: 65,
  lastInteractionAt: "2026-09-07T14:22:00Z"
}

200 { found: false }
```

Tudo isso já está denormalizado no documento do lead (`lifecycleStage`, `currentPlanName`, `currentContractStatus`, `currentContractEndsAt`, `consultantName`, `lastInteractionAt`), então a consulta é uma leitura só. O `contractStatus` é calculado por `deriveLeadContractStatus`, que já existe.

Fora do cartão de propósito: CPF, endereço, valor do contrato, histórico de pagamento, situação de pagamento e anamnese. O atendente não precisa disso para responder no WhatsApp, e informação sensível em tela de chat sai em print.

Professor fica de fora do PR1 porque vive na coleção de aulas e exigiria uma segunda consulta.

### POST /api/zap — aconteceu uma mensagem

```
POST /api/zap
x-stronizap-key: <chave>

{
  event: "message",
  tenantSlug: "stronix",
  leadId: "abc123" | null,
  conversationId: "...",
  messageId: "<waMessageId>",        ← chave de idempotência
  direction: "inbound" | "outbound",
  occurredAt: "2026-09-08T13:40:00Z", ← horário original do WhatsApp
  actor: { email, name } | null,      ← nulo em inbound
  contact: { phone, name },
  preview: "primeiros ~120 caracteres"
}
```

O `preview` são os primeiros 120 caracteres do texto. Em mídia vai o rótulo do tipo (`[áudio]`, `[imagem]`, `[documento]`), nunca o conteúdo do arquivo. Nota interna (`INTERNAL`) não gera evento, porque não é contato com o lead.

Respostas: `200` significa entregue. `4xx` é erro de contrato, o Stronizap descarta e loga sem reenviar. `5xx` ou timeout entra em backoff no outbox.

## Fluxos

### 1. Consultor fala com o lead

1. Clica no lead dentro do Stronilead.
2. Abre `{urlDoZap}/c?tenant=<slug>&lead=<id>&phone=<digitos>&name=<nome>`.
3. O Stronizap reaproveita `startConversation`, que pergunta o JID canônico ao WhatsApp via `sock.onWhatsApp`, cria ou reusa o contato e grava `crmLeadId` na conversa.
4. Consultor manda a mensagem.
5. Evento sai pelo outbox, chega no Stronilead, vira interação `mensagem` e bate a meta.

### 2. Lead responde

Evento com `direction: inbound`. O Stronilead grava a interação e marca `awaitingReplySince` no lead. Mensagem de saída depois disso limpa a marca. Essa marca alimenta a categoria nova da Meta Diária.

### 3. Conversa abre e o atendente precisa de contexto

O Stronizap chama `GET /api/zap` com o telefone, recebe o cartão e mostra no painel do contato. Cache de dois minutos para não consultar a cada mensagem.

### 4. Número desconhecido

A mesma consulta do fluxo 3 resolve a maior parte. Se o Stronilead encontrar a pessoa, devolve o `leadId` e o vínculo se estabelece sozinho, sem ninguém fazer nada.

Se não encontrar, entra na fila de leads a confirmar. Uma entrada por conversa, não por mensagem. O consultor vê telefone, nome do WhatsApp, primeiras mensagens e quando chegou, com três ações:

| Ação | Efeito |
|---|---|
| É lead novo | Cria o lead com fonte WhatsApp, vincula a conversa, entra na Meta Diária como lead novo |
| Já está na base | Busca e liga a um lead ou cliente existente. Cobre telefone diferente |
| Não é lead | Sai da fila e o número vai para a lista de ignorados |

A lista de ignorados impede o mesmo fornecedor de reaparecer toda semana. É reversível e fica numa aba própria, porque o entregador de hoje pode querer treinar amanhã.

O Stronilead nunca cria lead sozinho. O número da academia recebe aluno atual, ex-aluno, fornecedor, banco, entregador, spam, número errado e gente da própria equipe. Funil sujo derruba comissão, meta e a regra de atribuição.

### 5. Mensagens anteriores ao cadastro

O consultor responde no Stronizap na hora e classifica depois, às vezes no fim do dia. Quando o lead é criado, o Stronizap reenvia os eventos daquela conversa desde que ela abriu, com teto de 50. São eventos normais, com a mesma chave de idempotência, então a timeline nasce completa sem contrato novo.

## Regra de casamento de telefone

O Stronilead guarda `lead.whatsapp` com até 11 dígitos, sem DDI. O Stronizap guarda `Contact.phone` como identificador do JID, com o 55 na frente, e o nono dígito existe em número novo e não existe em número antigo.

**Para abrir conversa a partir do CRM:** não normalizar nada. O `startConversation` do Stronizap pergunta ao próprio WhatsApp qual é o JID canônico e grava o que voltou. Já tem comentário no código explicando por que não se tenta o número sem DDI: o WhatsApp interpreta como outro país e encontra a pessoa errada.

**Para achar o lead a partir de um telefone:** comparar **DDD mais os últimos 8 dígitos**. Os últimos 8 são idênticos com ou sem o nono dígito (`5551 9 9999 8888` e `5551 9999 8888` terminam os dois em `99998888`), então é a única parte estável. O DDD entra para não colidir número igual de estados diferentes.

## Modelo de dados novo

### Stronizap

```prisma
Conversation.crmLeadId        String?   @@index([crmLeadId])
Organization.crmEnabled       Boolean   @default(false)
Organization.crmBaseUrl       String?
Organization.crmApiKey        String?   // cifrado com lib/crypto.ts
Organization.crmTenantSlug    String?

model CrmOutboxEvent {
  id             String    @id @default(uuid())
  organizationId String
  payload        Json
  attempts       Int       @default(0)
  nextAttemptAt  DateTime?
  deliveredAt    DateTime?
  lastError      String?
  createdAt      DateTime  @default(now())
  @@index([deliveredAt, nextAttemptAt])
  @@index([organizationId])
}
```

A chave usa o mesmo tratamento do token do Instagram: AES-256-GCM por `lib/crypto.ts` com a `ENCRYPTION_KEY`. Sem padrão novo.

### Stronilead

```
tenants/{id}.integrations.zap = { keyHash, keyPrefix, createdAt, createdBy, revokedAt }
lead.awaitingReplySince       = timestamp | null
interação type 'mensagem'     = { direction, zapConversationId, preview, actorEmail }
coleção de leads a confirmar  = { phone, waName, firstMessageAt, messageCount, preview, conversationId }
lista de números ignorados    = por tenant, reversível
```

## Segurança

A chave é gerada em Configurações do Stronilead. Aparece uma vez na tela, com aviso de copiar. O que fica gravado é o hash e um prefixo curto para identificação visual. Revogar e gerar outra é um botão, não um chamado de suporte.

A validação segue o mesmo padrão do webhook do Asaas que já existe no código: token no header, comparação em tempo constante. HMAC daria proteção contra reenvio, mas a interação é idempotente por `waMessageId`, então reenvio não causa dano e não vale a complexidade.

A chave nunca aparece no navegador. Ela vive só no servidor do Stronizap, cifrada.

O vínculo conversa-lead nasce de um parâmetro na URL, sem assinatura. Isso não abre buraco porque o Stronilead só aceita evento apontando para um lead que existe naquele tenant, e quem monta a URL precisa estar logado no Stronizap da organização.

O risco que sobra é vazamento da chave, que permitiria injetar interação falsa e inflar a Meta Diária. Mitigação é rotação fácil e a chave nunca sair do servidor.

## Interface

Mockup revisado e aprovado: as decisões abaixo saíram dele.

### Onde o contexto aparece

Dois lugares, alimentados pela mesma consulta:

**Header da conversa (faixa Mata).** Uma pílula a mais na linha que já tem canal e etiqueta. É a superfície que fica sempre à vista, com o painel fechado.

**Painel do contato.** Uma seção nova logo depois da identidade, antes das tags.

### Marca da origem

O cabeçalho da seção não é a palavra "Stronilead" em Geist Mono como os outros. É o símbolo The Surge com o wordmark em Space Grotesk, reproduzindo `SurgeMark.jsx`: STRONI em peso 500, LEAD em 700, chevrons em brand-600 e o do topo em accent-500. No tema escuro troca para brand-300 e accent-400.

Azul dentro de um painel verde é cor estranha ao Stronizap de propósito. Ela diz que aquele bloco veio de fora.

### Cores de status

As pílulas copiam o `CONTRACT_TONE` do `LeadProfileView.jsx`, incluindo o fundo translúcido em 10% a 12% e o texto no tom 700. Contrato a vencer precisa ter a mesma cara nos dois sistemas.

| Estado | Tom |
|---|---|
| Agendado | violeta |
| Ativo | emerald |
| A vencer | âmbar |
| Trancado | azul da marca |
| Vencido | cinza |
| Cancelado | rosa |

Vencido é cinza e o vermelho fica em cancelado. É decisão que já estava tomada no CRM e a ponte só herda.

**Exceção do header:** a faixa Mata é escura, e os tons 700 não se leem sobre ela. A pílula do header usa sempre as variantes de fundo escuro (emerald-400, amber-400, slate-300), mesmo com o app no tema claro. É a mesma lógica que o `ChatWindow.tsx` já aplica ao redefinir `--ink` para os filhos.

### A faixa de destaque

Aparece abaixo do nome, dentro do bloco de identidade, e **só quando existe prazo curto**. Destaque permanente vira paisagem e a pessoa para de enxergar.

O gatilho é a categoria da Meta Diária em que a pessoa está hoje, mais o freepass:

| Gatilho | Origem | Tom |
|---|---|---|
| Visita hoje | `DAILY_GOAL_CATEGORIES.VISITA_HOJE` | agendado |
| Aula experimental hoje | `DAILY_GOAL_CATEGORIES.AULA_HOJE` | agendado |
| Marco de renovação | `DEFAULT_RENEWAL_CHECKPOINTS` (90, 60, 30) | a vencer |
| Contrato vencido | `DAILY_GOAL_CATEGORIES.VENCIDO` | vencido |
| Freepass ativo | `freePass.js` | segue `getTrialPassNote` |

Ficam de fora `NOVO_24H`, `ATRASADO` e `CONTATO_HOJE`. São tarefa do consultor, não contexto de quem está atendendo.

Nenhuma regra é recalculada no Stronizap. O `GET` devolve a categoria e a interface renderiza. Se a academia mudar os marcos nas configurações, o Zap acompanha sozinho.

### Avatar

Do Stronilead vem só o anel de 1px em preto 4%. A paleta sorteada por nome não se aplica porque o Stronizap carrega a foto de perfil do WhatsApp e a foto cobre o fundo. O fundo menta continua no fallback sem foto.

### Estado sem cadastro

O painel diz que o número não está na base e que entrou na fila de contatos a classificar. Sem botão de cadastrar: na Parte A o Stronizap só lê, e a classificação acontece no Stronilead, onde a regra de atribuição mora.

---

## Escopo

### Parte A — quem é essa pessoa

Um sentido de tráfego, só leitura. Entrega valor no primeiro dia para quem atende e valida a conexão em produção antes de mexer na Meta Diária.

**Stronizap:** campos de integração na `Organization` com a chave cifrada, consulta do cartão com cache de dois minutos, pílula no header do chat, seção no painel do contato, faixa de destaque, anel no avatar, e tela de integração nas configurações da organização.

**Stronilead:** consolidar as três funções de admin em `api/admin-users.js` para liberar slot no teto de 12 da Vercel, criar `api/zap.js` com o `GET`, e a tela de gerar e revogar a chave em Configurações.

### Parte B — o que aconteceu

O sentido de volta, com escrita no CRM. Só depois da Parte A rodando.

**Stronizap:** `crmLeadId` na `Conversation`, `crmLeadId` opcional no `startConversation`, tabela de outbox com reenvio, rota `/c` que resolve e abre a conversa a partir do CRM, e o anel colorido por status na lista usando o último cartão em cache.

**Stronilead:** o `POST` em `api/zap.js`, gravação automática da interação, `awaitingReplySince` com a categoria nova na Meta Diária, fila de leads a confirmar e lista de ignorados.

## Fora das duas partes, de propósito

- Painel de conversa embutido no Stronilead e envio de mensagem sem sair do CRM. Só depois de ver o time usando.
- Escala de plantão automatizada. Enquanto não existir, quem assumiu a conversa é o dono.
- Classificação automática do número desconhecido por conteúdo da mensagem. Primeiro é preciso saber o volume real da fila. Se forem cinco por dia, a triagem manual custa um minuto.
- Templates e disparo em massa.
- Professor no cartão de contexto.
- Login único entre os dois sistemas.
- Espelhar o dono do lead no `assignedToId` da conversa. O cartão de contexto já mostra o consultor dono, o que basta para o atendente não atropelar o processo de outra pessoa.

## Riscos

**Atendimento por fora.** Mensagem respondida no aparelho da recepção, driblando o Stronizap, chega sem `sentById` e não bate meta de ninguém. É regra de operação, não de código, e precisa ser combinada antes de ligar. No primeiro mês alguém vai reclamar que trabalhou e não contou.

**A regra dos 15 dias fica mais fácil de burlar.** A Regra 3 da atribuição diz que cada follow-up registrado renova a posse do lead por 15 dias.

Essa regra não está no código. Ela é aplicada por gente olhando a timeline, e o PR1 não muda isso. O que muda é o que essas pessoas vão ver ali, porque mensagem passa a se registrar sozinha. Dá para segurar um lead mandando "oi" a cada duas semanas, o que já acontece hoje com nota escrita à mão, só que fica mais fácil.

Decisão a tomar com o time comercial antes de ligar: ou só troca com resposta do lead renova o prazo, ou o prazo passa a olhar a última mensagem **do lead** em vez da última do consultor.

**Adoção.** No primeiro mês dá mais trabalho, não menos, porque o time precisa migrar o atendimento por completo.

**Baileys continua não-oficial.** Interno o risco é aceitável. Na hora de vender o pacote, essa conversa volta.

## Critérios de aceitação — Parte A

- [ ] Chave gerada no Stronilead e colada no Stronizap conecta os dois, e o botão de testar conexão devolve sucesso
- [ ] Revogar a chave no Stronilead derruba a integração, e os dois sistemas continuam funcionando sozinhos
- [ ] Painel e header mostram o cartão certo para lead e para cliente, e nunca a situação de pagamento
- [ ] A faixa aparece nos cinco gatilhos e some quando não há prazo curto
- [ ] As cores de status batem com o `CONTRACT_TONE` do Stronilead, e a pílula do header se lê sobre a faixa Mata
- [ ] Número que não está na base mostra "sem cadastro", sem botão de cadastrar
- [ ] Stronilead fora do ar não quebra o Stronizap: o bloco some e o atendimento segue
- [ ] Nenhum dado vaza entre tenants nem entre organizações

## Critérios de aceitação — Parte B

- [ ] Consultor clica no lead e cai na conversa certa, com o contato criado pelo JID canônico
- [ ] Mensagem enviada vira interação na timeline e marca a categoria da Meta Diária, sem clique extra
- [ ] Evento reentregue não duplica interação
- [ ] Stronilead fora do ar não perde evento: o outbox reenvia quando volta
- [ ] Mensagem de número já cadastrado vincula sozinha, sem passar pela fila
- [ ] Mensagem de número desconhecido cria uma entrada na fila, e a segunda mensagem não cria outra
- [ ] Classificar como lead traz as mensagens anteriores para a timeline
- [ ] Marcar como "não é lead" impede o mesmo número de voltar para a fila
- [ ] Lead que responde entra na categoria nova da Meta Diária, e responder tira ele de lá
