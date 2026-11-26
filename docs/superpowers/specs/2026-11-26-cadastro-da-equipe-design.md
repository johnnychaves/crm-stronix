# Cadastro da equipe

status: revisão
data: 2026-11-26
responsável: Johnny
mockup escolhido: A, `docs/superpowers/specs/mockups/2026-11-26-equipe-a-lista-e-pagina.html` (os outros dois, B e C, ficam na mesma pasta)

## O pedido

Nas palavras do Johnny, em 26/11/2026: "Ainda não consigo diferenciar quem é professor formado e quem é estagiário. Seria interessante implementarmos um cadastro mais completo para usuários colocando por exemplo: Admissão, demissão, e-mail, cref, cpf, foto de perfil, data de nascimento, endereço etc. Isso pode ser feito dentro da tela de configurações na sessão de equipe. Podemos melhorar aquelas telas tanto a tela de equipe, quanto a forma de configurar um novo usuário."

Hoje Configurações → Equipe & acessos tem duas listas que não se falam: quem tem login (`stronix_users`) e o card Professores (`stronix_professores`), onde 6 dos 7 professores da STRONIX estão sem login. Nenhuma das duas guarda CPF, nascimento, endereço, admissão ou vínculo, e não há como dizer quem é estagiário.

## Decisões

Todas do Johnny, em 26/11/2026, no brainstorming desta spec.

1. **O Gestão 360 é o molde, e o cadastro mora no Stronilead.** Os campos e a organização vêm do cadastro do colaborador do Gestão 360 (`06-sistemas/gestao-360`), mas a ficha é do Stronilead e vale para qualquer academia que assina. Os dois sistemas não se ligam.
2. **Só Dados e Movimentações.** Do perfil do colaborador do Gestão 360 entram a ficha e a linha de admissão, desligamento e readmissão. Anotações, documentos, processos, holerites e avaliações ficam fora.
3. **Uma lista só**, com o professor sem login na mesma lista, e **a mesma tela para toda academia**, com ou sem o módulo Stronix 2.0. O módulo só acrescenta o que já é dele: login de professor, nível e perfil do professor.
4. **Entra quem atua no Stronilead:** consultor, gestor e professor, com ou sem login. Quem não tem papel no CRM fica de fora.
5. **O desligamento desliga junto:** o login sai na hora, o professor sai da agenda, e a ficha e o histórico ficam guardados. O consultor passa a carteira antes. Readmitir deixa dar acesso de novo.
6. **Ficha nova, só do gestor** (caminho A): uma coleção nova que só o gestor lê, apontando para o login e para o cadastro de professor.
7. **O professor desligado passa os alunos no próprio desligamento**, para outro professor da mesma modalidade, com a troca no histórico de cada aluno.
8. **Sem campos próprios do estagiário.** Instituição de ensino, previsão de formatura e o aviso dos 24 meses ficaram de fora. O estagiário é o vínculo Estágio.
9. **O plano de carreira configurável é outra spec, logo depois desta.** O Johnny quer que cada gestor monte o próprio plano de carreira, com trilhas para Consultor, Professor e Estagiário, níveis, critérios e metas. Esta spec não mexe nos níveis: o perfil do professor continua com Júnior, Pleno e Sênior. Os níveis de estagiário (I, II e III) e a trilha do consultor chegam com a próxima spec, que pode tirar a trilha da função e do vínculo da ficha.
10. **Mockup A:** lista em tabela, ficha em página própria com abas, cadastro numa gaveta passo a passo.

## Fora deste projeto

- Plano de carreira configurável, níveis de estagiário e a avaliação semestral do estagiário (próxima spec).
- Salário, setor, holerite, documentos, anotações, processos e avaliações (ficam no Gestão 360).
- Instituição de ensino, previsão de formatura e prazo do estágio.
- A pessoa ver ou editar a própria ficha ("Meu cadastro").
- Número novo no trilho das Configurações para fichas incompletas. O "9" do mockup não entra.
- Criar gestor com senha temporária. Gestor continua entrando só por convite, como hoje.
- A cópia do nome do professor em `professorName` do lead (o professor do cadastro do aluno) não acompanha a troca de nome do professor. É um defeito de antes desta spec, e continua como está.

## A ficha

### Onde mora

Coleção nova `artifacts/{academia}/public/data/stronix_equipe/{id}`, uma ficha por pessoa. Só o gestor da academia lê e grava, pela regra do Firestore (abaixo). Nenhuma outra tela lê a ficha: Configurações já é só do gestor.

A ficha aponta para o resto e não repete o que já mora lá:

| Campo | O que é |
|---|---|
| `userId` | o cadastro de login em `stronix_users`, quando a pessoa tem acesso |
| `professorId` | o cadastro em `stronix_professores`, quando a pessoa é professor |
| `funcao` | `consultor`, `gestor` ou `professor`. Só vale enquanto a pessoa não tem login: com login, a função é o papel do login |
| `nome` | nome completo |
| `foto` | `{ url, path }`, só de quem não é professor (abaixo) |
| `cpf` | só os 11 dígitos, conferidos pelo `isValidCpf` de `src/lib/brazilLookups.js` |
| `rg` | texto |
| `nascimento` | `AAAA-MM-DD` |
| `celular` | só os dígitos, mostrado com a máscara de telefone do app |
| `emailPessoal` | texto, separado do e-mail de login |
| `endereco` | `{ cep, street, number, complement, neighborhood, city, state }`, as mesmas chaves do endereço do cliente (`src/lib/clientRegistration.js`), com a busca pelo CEP |
| `vinculo` | `clt`, `estagio`, `pj`, `socio`, `temporario` ou `outro`, a lista do Gestão 360 mais Sócio, que a planilha FINANCEIRO_STRONIX já usa |
| `cref` | texto, só de professor com vínculo diferente de Estágio |
| `status` | `ativo` ou `desligado` |
| `movimentacoes` | a lista abaixo |
| `convite` | `{ email, papel, expiraEm }` do convite pendente, gravado pelo servidor |
| `createdAt`, `updatedAt`, `updatedBy` | carimbos, como nos outros catálogos |

### Movimentações

Lista na própria ficha, na ordem: `{ tipo, data, vinculo, tipoDesligamento, motivo, registradoPor: { id, nome }, registradoEm }`.

- `tipo`: `admissao`, `desligamento` ou `readmissao`.
- `vinculo`: o vínculo na admissão ou na readmissão.
- `tipoDesligamento`: pedido de demissão, sem justa causa, justa causa, acordo, fim de contrato ou outro (a lista do Gestão 360, sem aposentadoria).
- `motivo`: texto livre, opcional.

Ninguém apaga uma movimentação. A data da admissão que aparece na ficha é a da última admissão ou readmissão. Corrigir essa data, no bloco Trabalho, troca a data dessa movimentação, para o gestor consertar um erro de digitação. Quem já está na equipe e não tem ficha ganha a admissão quando o gestor preenche a data pela primeira vez.

### Quem é quem na lista

A lista junta as fichas, os logins (`usersList`, que o app já tem) e os professores (`professores`, do `GeneralConfigContext`). A junção é uma função pura, em `src/lib/equipe/`:

- Uma ficha pega o login pelo `userId` ou, sem ele, pelo login de professor com o mesmo `professorId`. Pega o professor pelo `professorId` dela ou pelo do login.
- Login que nenhuma ficha pegou vira uma pessoa sem ficha, com o professor dele, se for professor.
- Professor que ninguém pegou vira uma pessoa sem ficha e sem login.
- O id da pessoa é o da ficha, quando existe. Sem ficha, é o id do login ou, sem login, o do professor. A ficha nasce com esse mesmo id na primeira gravação (`setDoc` com `merge`), então duas abas abertas caem na mesma ficha e o endereço não muda.
- A função mostrada é o papel do login, quando há login, e senão a `funcao` da ficha, e senão Professor, quando há professor.
- Desligado é quem tem a ficha com `status: 'desligado'`, ou o professor sem ficha e sem login com `ativo: false`.

### O que conta no anel

Foto, CPF, RG, nascimento, celular, e-mail pessoal, endereço (rua, número e cidade, como no cliente), vínculo, admissão e, para professor formado, CREF. O anel mostra quantos estão preenchidos, e a linha "Falta:" lista o resto, cada item levando ao campo.

### Cópias

O nome, a foto e o "ativo" continuam também onde o resto do app lê:

- **Nome:** mudar o nome na ficha grava também o `name` do login (com a cópia em `consultantName` dos leads que já existe) e o `nome` do professor (com a cópia em `appointmentProfessorName`). A lógica sai do `TeamAccessSection.jsx` para um módulo de `src/lib/equipe/`.
- **Foto:** a do professor continua no cadastro do professor (`photoUrl` e `photoPath`), porque o perfil e a página do NPS leem de lá, e a ficha troca essa foto pelo mesmo caminho do perfil (`uploadProfessorPhoto`). A de quem não é professor fica na ficha, em `tenants/<academia>/equipe/<id>/avatar.jpg`, com o mesmo processamento da foto do lead.
- **Ativo:** o desligamento grava `ativo: false` no professor e a readmissão grava `ativo: true`.

## A tela (mockup A)

### Lista, em `/configuracoes/equipe`

- Cabeçalho "Equipe & acessos", com o botão **Cadastrar pessoa**. O "Convidar por e-mail" sai do cabeçalho e vira uma opção do passo de acesso.
- A faixa de vagas continua como está.
- Filtros: Ativos e Desligados, em botões com o número, e as pílulas Função, Vínculo e Acesso, no padrão das outras telas. A busca pelo nome fica à direita. A linha de apoio diz quantas pessoas e quantas com a ficha completa.
- Tabela: Pessoa (foto ou iniciais, nome e e-mail), Função (com a modalidade do professor ou os leads do consultor embaixo), Vínculo (Estágio aparece como "Estagiário", em âmbar), Acesso ao app (com acesso, convite enviado, sem acesso, desligado em), Na equipe (tempo de casa e o mês da admissão) e o anel da ficha. A linha inteira é um link para a ficha (`AppLink`), então Ctrl+clique abre em outra aba.
- O card Professores sai, com as colunas Aulas, Participação e Matrícula: a conversão por professor já está no painel CRM.

### Ficha, em `/configuracoes/equipe/<id>`

- "Equipe & acessos" para voltar.
- Cabeçalho: foto com o botão de trocar, nome, função, vínculo, modalidades, acesso, "Na equipe desde 12/03/2024, há 2 anos e 8 meses" (ou "Esteve na equipe de… a…", quando desligada), o anel e o botão **Desligar** (ou **Readmitir**).
- Abas, no caminho: Dados (`/configuracoes/equipe/<id>`), Movimentações (`/movimentacoes`) e Acesso ao app (`/acesso`).
- **Dados:** a linha "Falta:" e três blocos que editam no lugar, um por vez, como o Cadastro da ficha do lead: Identidade (nome, CPF, RG, nascimento), Contato (celular, e-mail pessoal, endereço) e Trabalho (função, vínculo, admissão e, para professor, modalidades, CREF, nível no Stronix 2.0 com o link "Ver perfil" e alunos na carteira; para consultor, leads na carteira). O nível só aparece com o módulo e continua sendo trocado no perfil do professor.
- **Movimentações:** a linha do tempo, da mais nova para a mais antiga, com o botão Desligar ou Readmitir.
- **Acesso ao app:** o que hoje está no diálogo de editar membro. Com acesso: papel, e-mail de login, turno, meta de prospecção (só consultor), Trocar senha e Tirar acesso (menos para o gestor). Com convite pendente: o e-mail e a validade, e "Gerar outro convite". Sem acesso: "Dar acesso". As travas de hoje continuam: troca de papel pelo `set-role`, troca de e-mail pelo `set-email`, senha pelo `set-password`, extra pago com confirmação.
- **Excluir cadastro:** só no menu da ficha, só para quem não tem login, não tem alunos nem aulas registradas como professor (as conferências de hoje do "Excluir professor") e não tem mais de uma movimentação. Apaga a ficha e o professor. É para cadastro feito por engano.

### Cadastrar pessoa, na gaveta

Passo a passo, no desenho do Novo lead: o passo aberto mostra as opções, o feito vira um resumo com Editar e o rodapé diz o que falta.

1. **Função:** Consultor (atende os leads e tem Meta diária, ocupa uma vaga do plano), Professor (dá aula e tem carteira de alunos, não ocupa vaga) ou Gestor (entra por convite).
2. **Quem é:** nome completo, celular e e-mail.
3. **Modalidades**, só para professor.
4. **Vínculo e admissão**, com a data de hoje já preenchida.
5. **Acesso ao app:** Mandar convite (a pessoa cria a senha pelo link, que vale 7 dias), Criar com senha temporária (não para gestor) ou Sem acesso por enquanto (só para professor). Sem o módulo Stronix 2.0, o professor só tem a opção Sem acesso, como hoje. Quando os consultores do plano já estão em uso, o passo mostra o custo do extra antes, e o botão diz "Cadastrar como extra".

A gravação, na ordem:

1. O professor em `stronix_professores`, quando é professor (como o "Cadastrar professor" de hoje).
2. A ficha, com id novo, a função, o nome, o celular, o e-mail pessoal, o vínculo, a admissão e o `professorId`.
3. O acesso: o `create` do `/api/admin-users` ou o `/api/invite-create`, os dois com o `fichaId`.

Se o passo 3 falhar, a pessoa já está na lista, sem acesso, e a gaveta diz isso e oferece tentar de novo. O fim mostra um comprovante ("Paula Martins entrou na equipe"), com o que falta na ficha e os botões "Completar a ficha" e "Cadastrar outra pessoa".

### Desligar

O diálogo do mockup, aberto pelo botão da ficha:

- Data (hoje ou antes, nunca depois, porque o acesso sai na hora), tipo e motivo opcional, que só o gestor vê.
- Consultor que ainda é dono de algum lead (contando clientes e perdas, a mesma conta do `set-role`) não é desligado: o diálogo diz quantos leads e leva a Migrar leads, com o texto do `ownsLeads` de `src/lib/teamRoles.js`.
- Professor com alunos: o diálogo diz quantos alunos estão na carteira e pede o professor que fica com eles, entre os ativos da mesma modalidade. Professor de duas modalidades escolhe um substituto por modalidade.
- O aviso do que acontece: o acesso sai agora e as sessões caem, o professor sai da agenda, o perfil e o NPS continuam guardados, e a ficha vai para Desligados.
- O gestor não é desligado por aqui, e ninguém desliga a si mesmo.

### Readmitir

Na ficha desligada: data, vínculo e o botão. Grava a readmissão, volta o status para ativo e reativa o professor. O acesso volta pelo "Dar acesso", com um login novo.

## O servidor

Nenhuma função nova na Vercel (continuam 11 de 12).

### `api/admin-users.js`

- **`create`** aceita `fichaId`. Antes de criar a conta, confere que a ficha existe na academia (sem ela, 422 e nada é criado). Depois de criar a conta e o cadastro, grava o `userId` na ficha. Sem `fichaId`, nada muda.
- **`desligar`** (ação nova), com `{ fichaId, data, tipoDesligamento, motivo, substitutos }`. Confere que quem pede é gestor e que a ficha é da academia, e faz, na ordem:
  1. Recusa o desligamento do gestor e o de quem pede.
  2. Recusa, com 409 e o texto do `ownsLeads`, se o login ligado à ficha ainda é dono de algum lead.
  3. Passa os alunos: todo lead com o `professorId` da pessoa ganha o substituto pelo `professorChangePatch`, com a data do desligamento, em lotes de até 400. A modalidade de cada aluno sai do plano do contrato atual, pela regra do perfil do professor. Quem não tem contrato de nenhuma das modalidades vai para o substituto da primeira. O substituto precisa estar ativo e dar a modalidade.
  4. Grava `ativo: false` no professor.
  5. Apaga a conta e o cadastro de login pelo mesmo caminho do `delete` (com o `resolveTargetVerdict`, as tarefas delegadas devolvidas, a saída das rotinas e a cobrança sincronizada quando era consultor extra). O caminho vira uma função que as duas ações chamam.
  6. Grava na ficha o `status: 'desligado'` e a movimentação, e limpa o `userId`.

  Cada passo pode rodar de novo sem estrago: o aluno que já está com o substituto não muda, o professor já inativo continua inativo, e a conta que já sumiu não é erro. Se algo cair no meio, o gestor desliga de novo. O `userId` da ficha nunca é aceito sem conferência: a conta precisa ser desta academia, como no `delete`.

### Convite

- `api/invite-create.js` aceita `fichaId`, confere que a ficha existe na academia, guarda o `fichaId` no convite e grava `convite: { email, papel, expiraEm }` na ficha.
- `api/invite-accept.js`, quando o convite tem `fichaId` e a ficha existe na academia, grava o `userId` nela e apaga o `convite`.
- O link continua aparecendo só na hora de gerar.

## Regras

### Firestore

```
match /artifacts/{appId}/public/data/stronix_equipe/{id} {
  allow read, write: if isAdmin(appId) && inTenant(appId) && tenantActive(appId);
}
```

Publicada à mão no console, antes do merge, com o OK do Johnny. O servidor grava pelo Admin SDK.

### Storage

```
match /tenants/{tenant}/equipe/{fichaId}/{fileName} {
  allow read: if request.auth != null && request.auth.token.tenantId == tenant;
  allow write: if request.auth != null && request.auth.token.tenantId == tenant
               && request.resource.size < 2 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
```

É a mesma regra da foto do professor que está publicada. A versão que só deixa o gestor gravar pede uma permissão do IAM que ainda não foi dada, então a trava do gestor fica na tela, como na foto do professor.

## Endereço, Sentry e dados pessoais

- `SETTINGS_SECTIONS.team` continua `equipe`. A ficha é lida à parte no `readScreen`, como o modelo de rotina: `/configuracoes/equipe/<id>` e as abas `movimentacoes` e `acesso`. Id que não passa no `isValidLeadId` cai na lista.
- Filtros da lista no endereço, pela tabela de `src/lib/screenParams.js`: `sit=desligados` (ausente é Ativos), `funcao`, `vinculo` e `acesso`. A busca pelo nome fica no estado da tela, porque texto de busca nunca vai para o endereço.
- O `src/lib/sentryScrub.js` ganha a troca de `/configuracoes/equipe/<id>` por `/configuracoes/equipe/:pessoaId`, encadeada com as outras, com teste.
- O título da aba na ficha é "Equipe · <Academia> · STRONILEAD", sem o nome da pessoa.
- CPF, RG, nascimento, endereço, tipo e motivo do desligamento só existem na ficha, que só o gestor lê. Nada disso vai para o log, para a auditoria nem para o Sentry. A ação `desligar` registra no log a academia, a ficha e quem desligou, sem o motivo.

## Sem o módulo Stronix 2.0

A tela é a mesma. Sem o módulo:

- Professor só existe sem acesso (como hoje), e o "Dar acesso" não aparece para ele.
- O Trabalho não mostra o nível nem o link do perfil.
- O desligamento do professor passa os alunos do mesmo jeito.

## Casos de borda

- Duas abas: a ficha nasce com o id da pessoa, e cada bloco grava só as chaves dele, como o Cadastro do lead, então uma aba não apaga o que a outra gravou.
- Cadastro antigo de login com id diferente do uid (conta antiga): entra na lista como qualquer login. A ficha usa o id do cadastro.
- Professor com login cuja ficha foi criada antes do login: a junção pelo `professorId` liga os dois.
- Readmitir um consultor: a conta antiga foi apagada no desligamento, então o "Dar acesso" cria outra, com o mesmo e-mail se o gestor quiser.
- Ficha desligada cujo professor alguém reativou na mão: a ficha manda, e a pessoa continua em Desligados.

## Testes

- A junção da lista, com ficha, sem ficha, professor com e sem login, desligado e login antigo.
- O anel e a linha "Falta:", professor formado e estagiário.
- As movimentações: admissão nova, correção da data, desligamento e readmissão.
- A cópia do nome para o login e o professor.
- A ação `desligar`, com o banco falso da `api/`: recusa do gestor, de si mesmo e do consultor com leads; alunos para o substituto da modalidade, com o histórico; professor inativo; conta apagada pelo caminho do `delete`; ficha gravada por último; repetir não estraga; `userId` de outra academia recusado.
- O `create` e o convite com `fichaId`, inclusive a ficha que não existe.
- A regra do Firestore da coleção nova, no molde do `professorRules.test.js`.
- O endereço da ficha no `routes.test.js` e no `sentryScrub`.
- A tela em jsdom: lista com filtros, ficha com as três abas, a gaveta do cadastro do começo ao comprovante, o diálogo de desligar com e sem substituto.
- A varredura do `historicoDoProfessor.sweep.test.js` passa a ver o `api/admin-users.js`, que grava o professor do lead pelo `professorChangePatch`.

## Entrega

Proposta de três PRs, que o plano de implementação detalha:

1. **A lista e a ficha:** a coleção, a regra, a junção, a lista nova, a ficha com as três abas e os blocos que editam no lugar, e a saída do card Professores e do diálogo de editar membro.
2. **Cadastrar pessoa:** a gaveta, o `fichaId` no `create` e no convite.
3. **Desligar e readmitir:** a ação `desligar` e o readmitir.

## Pontos em aberto

1. Todo lead com o professor que sai passa ao substituto, ex-alunos inclusive. A outra saída é passar só a carteira ativa e deixar o ex-aluno com o professor inativo.
2. O RG conta no anel. Se for só opcional, o anel passa a ter um item a menos.
