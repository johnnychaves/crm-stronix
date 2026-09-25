---
status: revisão
---

# Responsável do lead menor de idade

Spec aprovada em conversa com o Johnny em 24/09/2026. Vale para o Stronilead e para o Stronizap.

## O problema

A academia cadastra criança como lead. Quem responde, decide e paga é o responsável, mas o cadastro só tem um telefone, o do próprio lead, e esse telefone é a identidade da pessoa no sistema. É por ele que o cadastro barra duplicado (`useDuplicateLead`), que o Stronizap acha a pessoa (`zapMatchKey`) e que o formulário público de indicação junta cadastros repetidos.

Se o lead da criança levar o telefone da mãe:
- o irmão fica barrado como duplicado;
- a mãe também fica barrada, se um dia quiser treinar;
- o Stronizap mostra a criança quando a mãe escreve e troca o nome do contato da mãe pelo nome do filho;
- a mensagem pronta do WhatsApp cumprimenta a criança.

## Decisões do Johnny

1. O responsável vira o contato. O WhatsApp da criança passa a ser opcional.
2. Uma chave manual, "Menor de idade", liga o bloco do responsável. A data de nascimento não liga a chave.
3. A data de nascimento desliga: no dia em que a pessoa faz 18 anos, o sistema passa a tratá-la como adulta, sozinho.
4. O Stronizap reconhece o telefone do responsável já nesta entrega, do jeito certo: cartão do tipo "responsável", sem trocar o nome do contato pelo do filho.
5. O responsável fica dentro do cadastro da criança. Irmãos têm cada um a sua cópia. Não há coleção nova, cadastro à parte nem responsável virando lead.

## A regra do menor

Um módulo puro, `src/lib/guardian.js`, sem React e sem Firebase, que a `api/` também importa. Ele nunca pode importar `src/lib/dailyGoal.js` (ver o `CLAUDE.md` do projeto).

- **`adultSince(birthDate)`**: a data em que a pessoa faz 18 anos. Quem nasceu em 29 de fevereiro vira adulto em 1º de março nos anos que não são bissextos.
- **`isMinorNow(lead, now)`**: verdadeiro quando `lead.isMinor` é `true`, o lead tem responsável e a data de nascimento está ausente ou ainda não chegou aos 18 anos.
- **`turnedAdult(lead, now)`**: a chave está ligada, mas a data de nascimento já passou dos 18 anos.
- **`contactOf(lead, now)`**: quem o consultor chama. Devolve telefone, nome, parentesco, se é o responsável (`viaGuardian`) e se falta o WhatsApp próprio (`missingOwnPhone`).
  - Menor agora: o responsável.
  - Fez 18 anos sem WhatsApp próprio (menos de 10 dígitos): continua o responsável, com `missingOwnPhone`.
  - Qualquer outro caso: o próprio lead, como hoje.
- **`whatsappHref(phone, text)`**: o link do `wa.me`, com o 55 na frente quando o número tem até 11 dígitos. Hoje a ficha põe o 55 e a Meta Diária não. As duas passam a usar esta função.

Nada é gravado no aniversário. A regra roda toda vez que o lead é mostrado ou consultado, então não precisa de rotina agendada. O "hoje" do servidor segue a mesma noção que a faixa do cartão do Zap já usa em `api/_zapStrip.js`.

## Dados

No documento do lead, em `stronix_leads`:

| Campo | Conteúdo |
|---|---|
| `isMinor` | `true` quando a chave está ligada. Ausente ou `false` no resto |
| `guardian` | `{ name, phone, relationship }` ou `null`. O `phone` vai com a máscara, igual ao `whatsapp` |
| `guardianPhoneDigits` | só os dígitos do telefone do responsável |
| `guardianPhoneDigitsRev` | os mesmos dígitos invertidos, para a busca pelo final do número |
| `guardianZapMatchKey` | DDD mais os 8 últimos dígitos, pela regra de `api/_zapPhone.js` |

O parentesco sai de uma lista fixa: Mãe, Pai, Avó, Avô, Tia, Tio, Outro. Ele é opcional. Sem parentesco, a tela mostra só o nome.

Os três campos derivados saem de uma função nova, `buildGuardianSearchFields(guardian)`, em `src/lib/leadDerived.js`. Ela fica separada de `buildLeadSearchFields` de propósito. `buildLeadSearchFields` é chamada em vários pontos só com nome, WhatsApp e CPF. Se passasse a devolver os campos do responsável, toda escrita que não repassasse o responsável apagaria esses campos. `buildGuardianSearchFields` só é chamada onde o responsável muda: o cadastro e a edição.

O formulário público de indicação não grava nada do responsável, então o espelho de `buildLeadSearchFields` em `api/_referral.js` fica como está e o `referralApiMirror.test.js` continua valendo sem mudança.

As regras do Firestore não mudam, porque a coleção de leads não tem lista fechada de campos. As consultas novas são de campo único (igualdade e intervalo), então usam o índice automático. O plano confere se `firestore.indexes.json` precisa de entrada, como a que o `zapMatchKey` tem.

## Cadastro (Novo lead)

`src/modals/AddLeadModal.jsx`, bloco "Quem é":

- Logo abaixo do nome entra a chave **Menor de idade**, desligada por padrão.
- Ligada, aparecem os campos do responsável:
  - **Nome do responsável**, obrigatório, com mais de 1 caractere;
  - **Telefone do responsável**, obrigatório, com a mesma máscara do WhatsApp e no mínimo 10 dígitos;
  - **Parentesco**, pela lista, opcional.
- Com a chave ligada, o campo do lead passa a se chamar "WhatsApp do aluno (opcional)". Preenchido, ele precisa de 10 dígitos e continua barrando duplicado, como hoje.
- Com a chave ligada e uma data de nascimento de quem já tem 18 anos, o formulário não salva. O aviso aparece junto da chave: "Pela data, já tem 18 anos. Confira a data ou desligue a chave." A data continua no bloco "Detalhes", onde está hoje.
- No painel da esquerda, o cartão que hoje se chama "Responsável" mostra o consultor. Ele passa a se chamar **Consultor**.
- O cartão de prévia do painel da esquerda mostra o telefone de contato, que é o do responsável quando a chave está ligada.

### Avisos de telefone

O telefone do responsável nunca barra o cadastro. Ele só avisa, e o aviso aparece embaixo do campo:
- quando é o WhatsApp de outro lead: "Esse é o telefone de Maria Silva, cliente." O texto usa as mesmas palavras do aviso de duplicado de hoje (nome, e cliente ou etapa);
- quando já é responsável de outro menor: "Maria já é responsável de Ana."

O WhatsApp do próprio lead continua barrando quando é de outro lead. Quando é o telefone de um responsável, ele só avisa: "Esse telefone é de Maria, responsável de Ana."

As consultas são de igualdade em `whatsappDigits` e em `guardianPhoneDigits`, com a mesma espera de 300 ms que a checagem de duplicado já tem.

## Edição

O lápis da ficha abre `src/modals/ClientRegistrationModal.jsx`. Na aba **Identidade** entram a mesma chave e os mesmos campos, com as mesmas regras do cadastro.

- Desligar a chave apaga o responsável ao salvar (`isMinor: false`, `guardian: null` e os três derivados zerados). Se a chave estava ligada e é desligada, o WhatsApp do lead passa a ser exigido. Fora desse caso, a edição continua sem exigir o WhatsApp, como hoje, para não travar lead importado sem telefone.
- Quem já fez 18 anos abre com a chave desligada e a nota "Fez 18 anos em 12/03/2027."
  - Com WhatsApp próprio, salvar tira o responsável, igual a desligar à mão.
  - Sem WhatsApp próprio, salvar mantém o responsável guardado, porque ele segue como contato até alguém cadastrar o número.
- `buildClientRegistrationPatch` (`src/lib/clientRegistration.js`) monta a parte do responsável e chama `buildGuardianSearchFields`.
- O contato de emergência continua separado e não muda.

## Contato e onde o responsável aparece

Todo botão de WhatsApp e de Ligar passa por `contactOf` e `whatsappHref`. Toda mensagem pronta cumprimenta o primeiro nome do contato, e não mais o nome do lead.

**Ficha** (`src/views/LeadProfileView.jsx`)
- Ao lado do nome, a etiqueta **Menor de idade**, só quando `isMinorNow`.
- A célula "Contato" mostra "Maria (mãe)", o telefone e o botão de copiar. Se a criança tiver número próprio, ele aparece numa segunda linha, também com botão de copiar.
- Os botões WhatsApp e Ligar do topo, o "Enviar WhatsApp" da composição e a mensagem do link de indicação chamam o contato.
- Quando `missingOwnPhone`, a ficha mostra o aviso "Fez 18 anos. Cadastre o WhatsApp próprio."

**Meta Diária** (`src/views/DailyGoalView.jsx`)
- Os cards mostram "Maria (mãe)" e o telefone dela, e os botões chamam esse número.

**Listas**
- Leads, Clientes e Aulas e Visitas mostram o telefone de contato, com a marca "resp." quando é do responsável.
- A exportação de Leads (`LeadsView.jsx`) e o relatório de agendamentos (`src/lib/appointmentReport.js`) ganham as colunas "Responsável do aluno" (nome e parentesco) e "Telefone do responsável". O nome não é só "Responsável" porque o relatório já tem uma coluna "Responsável", que é o consultor. A coluna de telefone de hoje continua com o WhatsApp do próprio lead.

**Busca global**
- A busca remota (`src/lib/globalSearch.js`) ganha duas consultas de intervalo: `guardianPhoneDigits` pelo começo e `guardianPhoneDigitsRev` pelo final. A busca em memória (`searchPeople`) também confere os dígitos do responsável.
- Só acha pelo telefone do responsável quem ainda tem o responsável como contato (`contactOf(...).viaGuardian`).
- O resultado mostra "resp.: Maria (mãe)".

## Ponte com o Stronizap

Mexe nos quatro arquivos do contrato (`api/_zapCard.js`, `api/zap.js`, `backend/src/services/crm.service.ts`, `frontend/src/types/crm.ts`) e em dois componentes do Stronizap. Não cria função nova na Vercel: continuam 11 de 12.

### Stronilead, `GET /api/zap`

1. Procura o dono do número por `zapMatchKey`, como hoje.
2. Procura os menores por `guardianZapMatchKey == chave`, com `limit(10)`. Ficam só os que têm o responsável como contato (`contactOf(...).viaGuardian`) e que não são o próprio dono do número achado no passo 1.
3. Monta a resposta:
   - **Achou o dono:** o cartão dele, como hoje. Se houver menores, ele ganha `wards`.
   - **Só achou menores:** `{ found: true, kind: 'responsavel', name, wards }`. O `name` é o nome do responsável gravado no menor cadastrado por último. Se os irmãos tiverem o nome escrito de jeitos diferentes, vale o mais recente.
   - **Nada:** `{ found: false }`, como hoje.
4. Cada item de `wards` é o cartão do menor montado por `buildZapCard`, sem `found` e sem `wards`, mais `relationship`. A lista de campos continua fechada. O único campo novo que sai do CRM é o nome do responsável, e isso fica escrito no comentário do `_zapCard.js`.
5. `wards` vem em ordem alfabética de nome.
6. A config da academia (`renewalCheckpoints`) continua sendo lida só quando alguém foi achado.

### Stronilead, `POST /api/zap` com `match`

- Além da consulta `in` por `zapMatchKey`, faz outra por `guardianZapMatchKey`, trazendo só os campos que `contactOf` precisa.
- Um telefone conta como encontrado quando é de um lead ou quando é responsável de um menor que ainda o tem como contato.
- O teto de 30 telefones continua valendo para as duas consultas.

### Stronizap (`whatsapp-stronix`)

- `CrmCard`, nos dois espelhos (`crm.service.ts` e `types/crm.ts`), ganha `kind: 'responsavel'` e `wards?: CrmWard[]`. `CrmWard` é o cartão sem `found` e sem `wards`, mais `relationship`.
- `crmStatus`: o tipo responsável vira a etiqueta "Responsável", no tom neutro, sem token de cor novo.
- `CrmHeaderMeta`: o responsável aparece como "Responsável por Pedro e Ana". Com mais de dois, aparecem os dois primeiros e "+N".
- `CrmCardSection`: qualquer cartão com `wards` ganha a seção "Responsável por". Cada menor aparece com nome, parentesco, etiqueta de status, fase ou plano, consultor e o texto da faixa, quando houver. No tipo responsável, só essa seção aparece.
- O nome do contato (`crm-name.service.ts`) não muda: ele já grava `card.name`, que agora é o nome da mãe.
- O painel de cobertura não muda: ele usa o `match`, que passa a contar o número da mãe.

### Ordem de entrega

1. PR no Stronizap: aceita o tipo novo e a lista `wards`. Sem o CRM novo, nada muda na tela.
2. PR no Stronilead: cadastro, ficha, listas, busca e a ponte.

Se o Stronilead subir antes, o Stronizap de hoje mostra a mãe com a etiqueta "Cliente", porque não conhece o tipo novo.

## Fora desta entrega

- Link do cartão do Stronizap para a ficha no Stronilead. O cartão não tem link hoje, para ninguém. Se entrar, vai num PR próprio, para todos os cartões.
- O formulário público de indicação continua pedindo o WhatsApp de quem foi indicado. Se for criança, o consultor liga a chave depois, pela edição.
- A importação por planilha (o modelo do Stronilead) não ganha colunas de responsável. Atenção para quem mexer nela: ela preenche o WhatsApp do lead que ainda não tem, então uma linha com o telefone da mãe daria ao menor o número do responsável sem passar pela trava `sameContactPhone`.
- O contrato não ganha titular nem pagador.
- A data de nascimento não liga a chave. Só desliga.
- Nenhum aviso no sino quando alguém faz 18 anos.

## Testes

- `guardian.test.js`: `adultSince` (29 de fevereiro, virada do dia), `isMinorNow`, `turnedAdult`, `contactOf` nos três casos e `whatsappHref` com e sem o 55.
- `leadDerived.test.js`: `buildGuardianSearchFields`, com responsável e com `null`.
- `clientRegistration.test.js`: ligar, desligar, fez 18 com e sem WhatsApp próprio.
- `globalSearch.test.js`: acha pelo telefone do responsável e deixa de achar quem fez 18 com número próprio.
- `zapCard.test.js` e `zapRoute.test.js`: dono sem menores (igual a hoje), dono com menores, só menores, menor que fez 18 fora da lista, o próprio dono fora da lista, `match` pelos dois campos.
- Stronizap: `crmStatus` do tipo novo, o texto do cabeçalho com um, dois e três menores, a seção do cartão, e o nome do contato vindo do cartão do responsável.
- Conferência na tela: cadastro com a chave, edição, ficha, Meta Diária, busca, e o Stronizap com um número de mãe de dois irmãos.
