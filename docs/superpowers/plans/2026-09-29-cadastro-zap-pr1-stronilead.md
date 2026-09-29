# Cadastro de lead pelo Stronizap · PR 1 (Stronilead) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Stronizap passa a pedir as listas do cadastro e a cadastrar o lead de dentro da conversa, pelo `POST /api/zap` do Stronilead, com as regras do Stronilead, e a ficha mostra o marco de início desse cadastro.

**Architecture:** Um montador puro (`src/lib/newLead.js`) passa a montar o documento do lead novo para o Novo lead e para a ponte. As regras da ponte ficam puras em `api/_zapLead.js` (academia ativa, equipe, catálogos, menor, dono, textos das recusas), e `api/zap.js` ganha duas ações pela chave, `lead-options` e `create-lead`, desviadas no começo do `handlePost`: a segunda confere duplicado e grava o lead e a interação `zap_signup` numa transação só. A linha do tempo classifica o `zap_signup` como `'origin'` e desenha o marco (modelo C dos mockups), que fica fora das contas de contato.

**Tech Stack:** React 19, Vite, Tailwind v4, Firebase (Firestore no navegador, firebase-admin na `api/`), Vercel serverless, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md`. **Mockups:** `docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-mockup.html` (a seção 3 é o marco de início).

**Ordem:** este PR entra antes do PR do Stronizap (plano `docs/superpowers/plans/2026-09-29-cadastro-zap-pr2-stronizap.md`). As ações novas ficam paradas até alguém chamar, e a Vercel publica no merge.

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronilead`, no worktree `.claude/worktrees/cadastro-lead-pelo-zap`, branch `claude/cadastro-lead-pelo-zap` (a main `68c4f4c` mais o commit da spec). Caminhos relativos à raiz do worktree. As linhas citadas são as de `68c4f4c`.

**PRs abertos que mexem perto:**
- **#227** (`claude/fuso-cartao-zap`: faixa do cartão no horário de Brasília, `api/_horarioDeBrasilia.js` e `api/__tests__/zapFuso.test.js`) pode entrar antes. Por isso o Task 0 faz rebase na main. Nada aqui depende dele, e os testes novos da `api/` põem o processo em UTC do mesmo jeito que o `zapFuso.test.js` dele (`vi.hoisted` trocando `process.env.TZ` antes dos imports, e `afterAll` devolvendo o fuso).
- **#228 a #231** (esqueci a senha, e-mail de login da equipe, proteção das telas de entrada) mexem no `CLAUDE.md`, no `api/_sentry.js` e no `api/admin-users.js`. Se entrarem antes, o conflito provável é só no `CLAUDE.md`: mantenha os dois textos.

**Regras do projeto que valem aqui** (do `CLAUDE.md`):
- limite de 12 funções na Vercel, hoje 11: nada de função nova, tudo cabe em `api/zap.js`; arquivo de `api/` que começa com `_` não é função;
- em `api/`, `snap.exists` é propriedade; em `src/`, `snap.exists()` é função;
- nenhum arquivo de `api/` importa `src/lib/dailyGoal.js` (lucide-react), `src/lib/firebase.js` (SDK do navegador) nem `src/lib/funnels.js` (`writeBatch`);
- `src/lib/guardian.js` só importa `./dates.js`;
- o Sentry e o log nunca recebem o telefone nem a chave;
- código novo de tela usa `cn()`, tokens semânticos (`bg-card`, `border-border`, `text-muted-foreground`), `flex gap-*` e `size-N`;
- textos em português, diretos, sem travessão no meio da frase;
- trabalho por PR, nunca commit na main; o merge é do Johnny;
- regras e índices do Firestore não mudam neste PR (o `firebase-admin` não passa por regra, e as consultas novas são de campo único).

---

## Notas de abertura: onde o código difere da spec, e a decisão

1. **O feed de atividade do dashboard não existe mais.** A primeira versão da spec pedia "Cadastro pelo Stronizap" no feed de atividade do dashboard, e a spec de 29/09 já registra que ele saiu. Esse feed, que rotulava a observação do cadastro como "cadastrou" usando `isRegistrationNote`, saiu em 12/09/2026 com a tela Operacional nova (commit `7de8114`). Hoje nenhuma tela rotula a observação do cadastro. A lista mais parecida é o extrato de prospecção da visão Equipe (`listVolumeActionsInRange`, em `src/lib/dailyGoal.js`), que chama todo lead novo de "Lead cadastrado" olhando o documento do lead, não a interação. O plano não mexe nele (decisão do Johnny, 29/09). O rótulo do tipo novo que existe é o da coluna da linha do tempo (`timelineTypeLabel` devolve "Início"). Todos os leitores de `type` de interação foram conferidos: `timeline.js`, `leads.js` (`hasGoalDoneToday`, `hasActiveInteractionToday`), `crm/contact.js`, `crm/stages.js` e `crm/queries.js` (só `status_change`), `crm/appointments.js`, `operacional/routine.js` e `operacional/renewal.js` (só `daily_goal_done`), o volume da Meta Diária (só `volumeKind`) e o `buildInteractionIndex` (conta tudo para a última interação, como já conta a observação do cadastro, e a spec aceita).
2. **Academia ativa segue as regras, não a tela de login.** A spec manda fazer "a mesma conferência de `tenantActive` das regras", e a primeira versão dela a descrevia como "teste vencido sem pagamento". As regras (`tenantNotBlocked`, em `firestore.rules`) bloqueiam teste vencido mesmo pago; só o login (`src/App.jsx`, linha ~491) tem a exceção do pago. O plano segue as regras, que são a trava que o `firebase-admin` pula (decisão do Johnny, 29/09). Na prática o webhook do Asaas passa para `active` quem paga no teste.
3. **Sem espelho do montador na `api/`.** O comentário do `api/_referral.js` diz que a `api/` não importa `src/`, mas isso ficou para trás: `api/_zapCard.js`, `api/_zapStrip.js` e `api/zap.js` importam `src/lib/` em produção. O `newLead.js` e tudo que ele alcança são puros, então a `api/` usa o arquivo direto. No lugar do espelho, `src/lib/__tests__/newLeadImports.test.js` segue os imports de verdade e trava que nada no caminho chegue a pacote, a `firebase.js`, a `dailyGoal.js` ou a `funnels.js`. O funil padrão sai do `pickDefaultFunnel` do `_referral.js`, que já é espelho testado do `getDefaultFunnel`.
4. **Funil sem etapa fica fora das opções.** O Novo lead aceita funil sem etapa (o lead nasce com a etapa vazia). No Stronizap a etapa é obrigatória, então esse funil não aparece, e o funil padrão é escolhido entre os que têm etapa.
5. **O banco falso ganha transação, `create` e `update`, e não `add`.** A spec fala em `add`, mas dentro de transação o SDK de servidor não tem `add`: o documento novo sai de `collection.doc()` e é gravado com `tx.create`. É isso que a rota faz e o fake imita.
6. **Onde moram os componentes.** A marca vai para `src/components/brand/StronizapMark.jsx`, ao lado do `SurgeMark.jsx`, e não para `src/components/`. O marco vai para `src/components/profile/ZapSignupMarker.jsx`.
7. **A linha "Início da jornada" sai quando há o marco (decisão do Johnny, 29/09).** A ficha já fecha a linha do tempo com "Início da jornada · dd/mm/aaaa" (`LeadProfileView.jsx`, linhas 1596 a 1601). Com o marco do Stronizap, o começo apareceria duas vezes.
8. **Recusas que a spec não detalha.** Consultora que manda outra pessoa como dono recebe `responsavel_invalido` com "Só o gestor escolhe outra pessoa como consultor responsável." (o texto da tabela da spec serve para quem saiu da equipe). WhatsApp do aluno que já é de outro cadastro recebe `menor_invalido` no campo `studentWhatsapp`, com "Esse WhatsApp já está em outro cadastro do Stronilead.". No menor repetido, o texto do 409 fala do aluno em forma neutra: "O cadastro de Pedro Souza com esse responsável foi feito há pouco. Quem cuida é Bruno Lima." ou "Pedro Souza já tem cadastro no Stronilead com esse responsável.".
9. **O nome de quem cadastrou vem do Stronilead (decisão do Johnny, 29/09).** O autor gravado é o `name` do `stronix_users`, como em toda interação do app. O `actor.name` que o Stronizap manda só entra se o cadastro da equipe não tiver nome.
10. **No menor, o número da conversa não barra**, mesmo que seja o `zapMatchKey` de outro lead (a mãe que já é aluna): é a regra do Novo lead, em que o telefone do responsável nunca barra. Adulto num número que só é de responsável também entra (a própria mãe).
11. **O limite conta tentativas.** O `checkRateLimit` soma a cada chamada. Ele roda depois da conferência de formato e da academia, então pedido malformado ou de academia bloqueada não gasta, mas recusa por equipe, catálogo, menor ou duplicado gasta.
12. **Celular antigo, sem o nono dígito, ganha o 9 (decisão do Johnny, 29/09).** O WhatsApp guarda com 10 dígitos o número cadastrado antes do nono dígito. Depois de tirar o 55 pela regra do `zapMatchKey`, número com 10 dígitos cujo primeiro dígito depois do DDD é 6, 7, 8 ou 9 é celular e ganha o 9 logo depois do DDD: "555181244710" vira "(51) 9 8124-4710". Fixo (2 a 5) fica com 10. A regra mora em `nationalPhoneDigits`, ao lado do `zapMatchKey` em `api/_zapPhone.js`, e vale para o número da conversa (o `whatsapp` do lead adulto ou o telefone do responsável do menor) e para o WhatsApp do aluno. O `zapMatchKey` não muda (DDD e últimos 8 são iguais com e sem o 9), e o duplicado sai sempre do número já normalizado. O Novo lead do Stronilead não muda.
13. **Erro inesperado sobe sem dado pessoal.** As duas ações relançam o erro com a mensagem trocada por `zap <ação> falhou (<código>)`, mantendo a pilha, porque a mensagem do Firestore pode trazer o telefone. O `withSentry` manda esse erro para o Sentry, e o Stronizap trata o 5xx como Stronilead fora do ar.
14. **Rótulos (decisão do Johnny, 29/09).** Quem responde pelo menor é "Nome do responsável", como no Novo lead, e o dono do lead é "Consultor responsável". Por isso: "Só o gestor escolhe outra pessoa como consultor responsável.", a linha de baixo do marco "Consultor responsável Ana Souza · canal Recepção" e o `text` "Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.". Os códigos de erro (`responsavel_invalido` e os outros) não mudam.
15. **"Abrir no Stronilead" não pede mudança aqui.** O link da spec é `<endereço do CRM>/<identificador da academia>/ficha/<id do lead>`. O identificador que o Stronizap guarda é o id da academia (`zapConnectionFields`, em `src/lib/zapIntegration.js`), que é o mesmo do endereço do Stronilead, e a ficha já abre por `/<academia>/ficha/<id>` desde o PR #218. O cartão também não muda de forma: `api/_zapCard.js` fica como está.
16. **Contrato com o PR do Stronizap.** O plano do Stronizap assume os nomes de `field` iguais às chaves do pedido (`name`, `source`, `dor`, `modalidade`, `funnelId`, `stage`, `ownerId`, `guardianName`, `relationship`, `studentWhatsapp`) e mostra `field` desconhecido na área geral do formulário. Este plano usa exatamente esses nomes, mais `phone`, `actor`, `channelName`, `lead` e `minor` para erros de formato que a tela não provoca.

## Decisões do Johnny (29/09)

1. **Nono dígito:** o celular antigo ganha o 9 no cadastro pelo Stronizap (nota 12).
2. **Rótulos:** "Nome do responsável" para quem responde pelo menor e "Consultor responsável" para o dono do lead (nota 14). Os códigos de erro ficam.
3. **Sem trava de liberação:** no Stronizap, o botão depende só da integração ligada. O teste de verdade vem depois do deploy deste PR, com o Stronizap do PR 2 rodando local contra o Stronilead de produção, na `academia-teste` (Task 15).
4. **Ficam como o plano propôs:** o item do feed de atividade sai (o extrato da visão Equipe continua dizendo "Lead cadastrado"), o `tenantBlocked` segue `firestore.rules` (teste vencido bloqueia mesmo pago), a linha "Início da jornada" some quando há o marco, e o nome do autor vem do `stronix_users`.

## O contrato das duas ações

| Situação | HTTP | Corpo |
|---|---|---|
| opções | 200 | `{ actor: { id, name, role }, sources, dores, modalities, funnels, relationships, defaults }`, mais `team` só para gestor |
| cadastro feito | 201 | `{ card }` (o mesmo cartão do `GET` para o número) |
| sem chave ou sem academia | 401 | `{ error: 'Credencial ausente' }` |
| chave errada, academia fora do formato ou inexistente | 401 | `{ error: 'Credencial inválida' }` |
| formato do pedido | 400 | `{ error: 'dados_invalidos', field, message }` |
| academia bloqueada | 403 | `{ error: 'academia_bloqueada', message }` |
| fora da equipe | 403 | `{ error: 'fora_da_equipe', message }` (o texto cita o e-mail de quem pediu) |
| número ou aluno já cadastrado | 409 | `{ error: 'ja_cadastrado', card, createdAt, message }` |
| item de catálogo que sumiu | 422 | `{ error: 'catalogo_mudou', field, message }` |
| academia sem dor | 422 | `{ error: 'sem_dor_cadastrada', message }` |
| dono inválido | 422 | `{ error: 'responsavel_invalido', message }` |
| regra do menor | 422 | `{ error: 'menor_invalido', field, message }` |
| limite por hora | 429 | `{ error: 'limite', message }` |
| erro inesperado | 5xx | a Vercel responde; o erro vai ao Sentry sem dado pessoal |

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/newLead.js` (novo) | `buildNewLeadDoc` (o documento do lead novo) e `leadEntryFunnels` (funis em que o lead pode nascer) |
| `src/modals/AddLeadModal.jsx` | grava pelo montador; o seletor de funil usa `leadEntryFunnels` |
| `src/lib/leads.js` | `ZAP_SIGNUP_TYPE`, `isRegistrationInteraction`; o "já interagiu hoje" ignora o marco |
| `src/lib/crm/contact.js` | o marco não é contato no Dashboard CRM |
| `src/lib/timeline.js` | tipo `'origin'`, filtro Marcos, rótulo e textos do marco |
| `src/components/brand/StronizapMark.jsx` (novo) | a marca do Stronizap, clara e escura |
| `src/components/profile/ZapSignupMarker.jsx` (novo) | o marco de início (modelo C) |
| `src/views/LeadProfileView.jsx` | desenha o marco e tira a linha "Início da jornada" quando ele existe |
| `api/_zapPhone.js` | `nationalPhoneDigits`: o número sem o 55 e com o nono dígito do celular antigo, ao lado do `zapMatchKey` |
| `api/_zapLead.js` (novo) | regras puras e textos das duas ações |
| `api/zap.js` | `cardFor`, `loadZapTenant`, `openByKey`, `lead-options`, `create-lead` e o desvio |
| `api/__tests__/zapPhone.test.js` | a regra do nono dígito |
| `api/__tests__/zapLead.test.js` (novo) | regras puras, em UTC |
| `api/__tests__/zapRoute.test.js` | banco falso com transação, equipe e catálogos, em UTC; testes das ações e do desvio |
| `src/lib/__tests__/newLead.test.js`, `newLeadSweep.test.js`, `newLeadImports.test.js`, `profileOriginMarker.test.js` (novos) | montador, varredura dos dois cadastros, grafo de imports e marco na ficha |
| `src/lib/__tests__/leads.test.js`, `crm.contact.test.js`, `timeline.test.js` | casos do `zap_signup` |
| `CLAUDE.md` | a seção da ponte |

---

### Task 0: Preparação

**Files:** nenhum arquivo de código

- [ ] **Step 1: Commit dos planos e rebase na main**

```bash
cd /Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.claude/worktrees/cadastro-lead-pelo-zap
git branch --show-current
git status --short
```

Expected: `claude/cadastro-lead-pelo-zap`, e o status só com documentos deste projeto: os planos novos em `docs/superpowers/plans/` (este e o `2026-09-29-cadastro-zap-pr2-stronizap.md`) e, se ainda não estiverem commitadas, a spec e o mockup com as decisões de 29/09. Se o status vier limpo, pule o `git add` e o `git commit` abaixo e siga do `git fetch`.

```bash
git add docs/superpowers/plans/2026-09-29-cadastro-zap-pr*.md docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-*
git commit -m "docs: planos do cadastro de lead pelo Stronizap e decisões de 29/09

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git fetch origin
git rebase origin/main
```

Expected: rebase sem conflito. A branch só tem a spec, o mockup e os planos em cima da main.

- [ ] **Step 2: Dependências e suíte de partida**

```bash
npm ci
npm test
```

Expected: suíte verde. Anote os números: em `68c4f4c` eram `Test Files  120 passed (120)` e `Tests  2412 passed (2412)`; com o PR #227 na main, são mais. Este plano soma 5 arquivos e 170 testes. Se a suíte falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: Montador do lead novo (`src/lib/newLead.js`)

**Files:**
- Create: `src/lib/newLead.js`
- Test: `src/lib/__tests__/newLead.test.js`

Os valores esperados abaixo foram tirados rodando a montagem que o `AddLeadModal.jsx` faz hoje (linhas 491 a 525): é o teste que trava o comportamento do Novo lead.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/newLead.test.js`:

```js
// O montador do lead novo (src/lib/newLead.js) nasceu do handleSubmit do Novo
// lead (AddLeadModal.jsx). Estes testes travam os campos que o Novo lead
// gravava antes da extração, valor por valor: o cadastro pelo Stronizap usa o
// mesmo montador, então um campo que mudar aqui muda nos dois cadastros.
import { describe, it, expect } from 'vitest';
import { buildNewLeadDoc, leadEntryFunnels } from '../newLead.js';

const ANA = { id: 'u-ana', name: 'Ana Souza', authUid: 'auth-ana', role: 'consultant', email: 'ana@stronix.com.br' };

// O formulário do Novo lead, como o AddLeadModal guarda no estado.
const ADULTO = {
  name: '  Ana Lima  ',
  whatsapp: '(51) 9 9812-4471',
  isMinor: false,
  guardianName: '',
  guardianPhone: '',
  guardianRelation: '',
  source: 'WhatsApp',
  funnelId: 'f-com',
  status: 'Novo lead',
  tags: ['Quente'],
  dor: ' Postura ',
  modalidade: 'Pilates',
  birthDate: '1990-05-10',
  cpf: ' 123.456.789-01 ',
  sexo: 'Feminino',
  email: ' ana@exemplo.com ',
  observation: 'não vai para o documento do lead',
};

describe('buildNewLeadDoc: os campos que o Novo lead grava', () => {
  it('adulto: cada campo, com o mesmo valor que o AddLeadModal gravava', () => {
    expect(buildNewLeadDoc(ADULTO, { owner: ANA })).toEqual({
      name: 'Ana Lima',
      whatsapp: '(51) 9 9812-4471',
      source: 'WhatsApp',
      funnelId: 'f-com',
      status: 'Novo lead',
      tags: ['Quente'],
      birthDate: new Date(1990, 4, 10),
      cpf: '123.456.789-01',
      email: 'ana@exemplo.com',
      sexo: 'Feminino',
      dor: 'Postura',
      modalidade: 'Pilates',
      referredById: null,
      referredByName: null,
      consultantId: 'u-ana',
      consultantName: 'Ana Souza',
      consultantAuthUid: 'auth-ana',
      // Os campos de busca recebem o nome sem aparar, como antes.
      nameLower: '  ana lima  ',
      nameTokens: ['ana', 'lima'],
      whatsappDigits: '51998124471',
      whatsappDigitsRev: '17442189915',
      cpfDigits: '12345678901',
      zapMatchKey: '5198124471',
      isMinor: false,
      guardian: null,
      guardianPhoneDigits: null,
      guardianPhoneDigitsRev: null,
      guardianZapMatchKey: null,
      lifecycleBucket: 'ativo',
      lastInteractionAt: null,
      interactionsCount: 0,
      nextFollowUp: null,
      nextFollowUpType: null,
      appointmentType: null,
      appointmentScheduledFor: null,
    });
  });

  it('menor: o bloco do responsável e o WhatsApp do aluno em branco', () => {
    const menor = {
      ...ADULTO,
      name: 'Pedro Souza',
      whatsapp: '',
      isMinor: true,
      guardianName: ' Maria Souza ',
      guardianPhone: '(51) 9 9812-4471',
      guardianRelation: 'Mãe',
      tags: [],
      dor: 'Postura',
      modalidade: '',
      birthDate: '',
      cpf: '',
      sexo: '',
      email: '',
    };
    expect(buildNewLeadDoc(menor, { owner: ANA })).toMatchObject({
      name: 'Pedro Souza',
      whatsapp: '',
      birthDate: null,
      cpf: null,
      email: null,
      sexo: null,
      modalidade: null,
      nameLower: 'pedro souza',
      whatsappDigits: '',
      whatsappDigitsRev: '',
      cpfDigits: '',
      zapMatchKey: null,
      isMinor: true,
      guardian: { name: 'Maria Souza', phone: '(51) 9 9812-4471', relationship: 'Mãe' },
      guardianPhoneDigits: '51998124471',
      guardianPhoneDigitsRev: '17442189915',
      guardianZapMatchKey: '5198124471',
    });
  });

  it('indicação: o vínculo vai no próprio documento; indicador sem nome fica com o nome null', () => {
    const doc = buildNewLeadDoc({ ...ADULTO, source: 'Indicação' }, { owner: ANA, referrer: { id: 'c9', name: 'Carla' } });
    expect(doc).toMatchObject({ referredById: 'c9', referredByName: 'Carla' });
    expect(buildNewLeadDoc(ADULTO, { owner: ANA, referrer: { id: 'c9', name: '' } }).referredByName).toBeNull();
  });

  it('as datas do servidor ficam com quem grava', () => {
    const doc = buildNewLeadDoc(ADULTO, { owner: ANA });
    expect('createdAt' in doc).toBe(false);
    expect('statusEnteredAt' in doc).toBe(false);
  });

  it('campo que não veio ganha o valor vazio que o Novo lead grava', () => {
    const doc = buildNewLeadDoc(
      { name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', source: 'WhatsApp', funnelId: 'f-com', status: 'Novo lead', dor: 'Postura' },
      { owner: ANA }
    );
    expect(doc).toMatchObject({
      tags: [], birthDate: null, cpf: null, email: null, sexo: null, modalidade: null,
      referredById: null, referredByName: null, isMinor: false, guardian: null,
    });
    expect(Object.values(doc)).not.toContain(undefined);
  });

  it('etapa de venda nasce no balde cliente, como no Novo lead', () => {
    expect(buildNewLeadDoc({ ...ADULTO, status: 'Venda' }, { owner: ANA }).lifecycleBucket).toBe('cliente');
  });
});

describe('leadEntryFunnels: onde um lead novo pode nascer pela escolha de funil', () => {
  it('tira Indicações, Renovações, Vencidos e Upgrade pelo systemKind, nunca pelo nome', () => {
    const funis = [
      { id: 'a', name: 'Comercial' },
      { id: 'b', name: 'Indicações', systemKind: 'referral' },
      { id: 'c', name: 'Renovações', systemKind: 'renewal' },
      { id: 'd', name: 'Vencidos', systemKind: 'expired' },
      { id: 'e', name: 'Upgrade', systemKind: 'upgrade' },
      // Funil da própria academia com o nome de um funil de sistema.
      { id: 'f', name: 'Renovações' },
    ];
    expect(leadEntryFunnels(funis).map((f) => f.id)).toEqual(['a', 'f']);
  });

  it('lista ausente vira lista vazia', () => {
    expect(leadEntryFunnels(null)).toEqual([]);
    expect(leadEntryFunnels(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/newLead.test.js`
Expected: FAIL, com `Cannot find module '../newLead.js'`.

- [ ] **Step 3: Implementar `src/lib/newLead.js`**

```js
// Montador do lead novo. É o documento que o Novo lead (AddLeadModal.jsx)
// grava e o mesmo que o cadastro pelo Stronizap grava (api/_zapLead.js): um
// campo novo entra aqui e chega aos dois cadastros de uma vez.
//
// Puro: sem React e sem Firebase, porque roda também na api/ (SDK de
// servidor). Nada no caminho deste arquivo pode importar firebase.js,
// dailyGoal.js ou funnels.js; newLeadImports.test.js trava isso. As datas do
// servidor (createdAt, statusEnteredAt) ficam com quem grava, porque cada lado
// usa um SDK diferente.
//
// Spec: docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md
import { getLeadOwnershipFields } from './leads.js';
import { buildLeadSearchFields, buildGuardianPatch, deriveLeadBucket } from './leadDerived.js';
import { fromDateInputValue } from './dates.js';
import { isReferralFunnel } from './referrals.js';
import { isRenewalFunnel } from './renewalFunnel.js';
import { isExpiredFunnel } from './expiredFunnel.js';
import { isUpgradeFunnel } from './upgradeFunnel.js';

// `form` tem o formato do estado do Novo lead: nascimento como o texto do
// <input type="date">, e o responsável em guardianName, guardianPhone e
// guardianRelation. Campo que não veio ganha o valor vazio do Novo lead.
// `owner` é quem fica dono do lead ({ id, name, authUid }, como o appUser), e
// `referrer`, o cliente que indicou, ou null.
export function buildNewLeadDoc(form = {}, { owner = null, referrer = null } = {}) {
  const {
    name = '', whatsapp = '', source = '', funnelId = null, status = '', tags = [],
    birthDate = '', cpf = '', email = '', sexo = '', dor = '', modalidade = '',
    isMinor = false, guardianName = '', guardianPhone = '', guardianRelation = '',
  } = form;
  return {
    name: String(name).trim(),
    whatsapp,
    source,
    funnelId,
    status,
    tags,
    birthDate: fromDateInputValue(birthDate),
    cpf: (cpf || '').trim() || null,
    email: (email || '').trim() || null,
    sexo: sexo || null,
    dor: (dor || '').trim() || null,
    modalidade: modalidade || null,
    // Vínculo de indicação no PRÓPRIO doc: a feature funciona mesmo se o
    // batch de eventos (commitReferralLink) falhar depois.
    referredById: referrer ? referrer.id : null,
    referredByName: referrer ? (referrer.name || null) : null,
    ...getLeadOwnershipFields(owner),
    ...buildLeadSearchFields({ name, whatsapp, cpf }),
    ...buildGuardianPatch({ isMinor, name: guardianName, phone: guardianPhone, relationship: guardianRelation }),
    lifecycleBucket: deriveLeadBucket({ status }),
    lastInteractionAt: null,
    interactionsCount: 0,
    nextFollowUp: null,
    nextFollowUpType: null,
    appointmentType: null,
    appointmentScheduledFor: null,
  };
}

// Funis em que um lead novo pode nascer pela escolha de funil. Ficam de fora o
// de Indicações (no Novo lead ele tem o interruptor próprio) e os três que
// projetam clientes (Renovações, Vencidos e Upgrade), onde o lead nasceria sem
// etapa ou sumiria de todo board. O discriminador é o systemKind, nunca o nome.
export const leadEntryFunnels = (funnels) =>
  (Array.isArray(funnels) ? funnels : []).filter(
    (f) => !isReferralFunnel(f) && !isRenewalFunnel(f) && !isExpiredFunnel(f) && !isUpgradeFunnel(f)
  );
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/newLead.test.js && npx eslint src/lib/newLead.js src/lib/__tests__/newLead.test.js`
Expected: `Tests  8 passed (8)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/newLead.js src/lib/__tests__/newLead.test.js
git commit -m "feat: montador único do lead novo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: O Novo lead grava pelo montador

**Files:**
- Modify: `src/modals/AddLeadModal.jsx:9`, `:12`, `:19`, `:359`, `:489-526`
- Test: `src/lib/__tests__/newLeadSweep.test.js` (novo), `src/lib/__tests__/newLeadImports.test.js` (novo)

- [ ] **Step 1: Escrever a varredura que falha**

Criar `src/lib/__tests__/newLeadSweep.test.js`:

```js
// O Novo lead e o cadastro pelo Stronizap gravam o lead pelo mesmo montador
// (src/lib/newLead.js). Esta varredura lê o código dos dois e reprova quem
// voltar a montar o documento na mão: um campo novo só chega aos dois
// cadastros se os dois passarem pelo montador.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('os dois cadastros de lead usam o mesmo montador', () => {
  it('o Novo lead grava só o montador e as duas datas do servidor', () => {
    const modal = ler('../../modals/AddLeadModal.jsx');
    // Do "await addDoc(" até a linha que só fecha a chamada.
    const chamada = /await addDoc\(([\s\S]*?)\n\s*\);/.exec(modal);
    expect(chamada).not.toBeNull();
    const corpo = chamada[1];
    const espalhados = [...corpo.matchAll(/\.\.\.(\w+)\(/g)].map((m) => m[1]);
    const chaves = [...corpo.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    expect(espalhados).toEqual(['buildNewLeadDoc']);
    expect(chaves).toEqual(['createdAt', 'statusEnteredAt']);
  });
});
```

Criar `src/lib/__tests__/newLeadImports.test.js`:

```js
// src/lib/newLead.js roda também na api/ (cadastro pelo Stronizap), com o SDK
// de servidor. Nada no caminho dele pode chegar a pacote nenhum: firebase.js
// inicializa o SDK do navegador, dailyGoal.js puxa lucide-react e funnels.js
// importa writeBatch, e qualquer um deles derruba a função da Vercel. Esta
// varredura segue os imports de verdade, arquivo por arquivo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo leitor de imports de guardianImports.test.js, que tem os autotestes
// do regex e a explicação de por que os comentários saem antes.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const doRepo = (rel) => path.join(REPO, rel);
const relativo = (arquivo) => path.relative(REPO, arquivo).split(path.sep).join('/');

// Todos os arquivos alcançados a partir da entrada e os pacotes importados
// no caminho (specifier que não começa com ponto).
function grafoDe(entrada) {
  const arquivos = new Set();
  const pacotes = new Set();
  const visitar = (arquivo) => {
    if (arquivos.has(arquivo)) return;
    arquivos.add(arquivo);
    for (const spec of specifiersOf(readFileSync(arquivo, 'utf8'))) {
      if (spec.startsWith('.')) visitar(path.resolve(path.dirname(arquivo), spec));
      else pacotes.add(spec);
    }
  };
  visitar(entrada);
  return { arquivos: [...arquivos].map(relativo), pacotes: [...pacotes] };
}

const PROIBIDOS = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js'];

describe('o montador do lead novo cabe na api/', () => {
  it('newLead.js não chega a pacote nenhum nem a módulo do navegador', () => {
    const { arquivos, pacotes } = grafoDe(doRepo('src/lib/newLead.js'));
    expect(arquivos).toContain('src/lib/leadDerived.js');
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js`
Expected: a varredura FALHA com `expected [ 'getLeadOwnershipFields', …(2) ] to deeply equal [ 'buildNewLeadDoc' ]`; a de imports passa (o montador já existe).

- [ ] **Step 3: Trocar os imports do `AddLeadModal.jsx`**

Trocar as linhas 8 a 12:

```js
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { getLeadOwnershipFields } from '../lib/leads.js';
import { useDuplicateLead, findDuplicateLeadRemote } from '../hooks/useDuplicateLead.js';
import { logInteraction } from '../lib/interactions.js';
import { buildLeadSearchFields, buildGuardianPatch, deriveLeadBucket, sameContactPhone } from '../lib/leadDerived.js';
```

por:

```js
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { useDuplicateLead, findDuplicateLeadRemote } from '../hooks/useDuplicateLead.js';
import { logInteraction } from '../lib/interactions.js';
import { sameContactPhone } from '../lib/leadDerived.js';
import { buildNewLeadDoc, leadEntryFunnels } from '../lib/newLead.js';
```

E a linha 19:

```js
import { getReferralFunnel, getReferralEntryStage, isReferralFunnel, REFERRAL_FUNNEL_NAME } from '../lib/referrals.js';
```

por:

```js
import { getReferralFunnel, getReferralEntryStage, REFERRAL_FUNNEL_NAME } from '../lib/referrals.js';
```

Os imports de `isRenewalFunnel`, `isExpiredFunnel` e `isUpgradeFunnel` (linhas 20 a 22) ficam: a linha 341 ainda usa os três. O `fromDateInputValue` (linha 17) também fica: as linhas 436, 441 e 678 usam.

- [ ] **Step 4: Seletor de funil pelo `leadEntryFunnels`**

Trocar a linha 359:

```js
  const pickerFunnels = safeFunnels.filter((f) => !isReferralFunnel(f) && !isRenewalFunnel(f) && !isExpiredFunnel(f) && !isUpgradeFunnel(f));
```

por:

```js
  const pickerFunnels = leadEntryFunnels(safeFunnels);
```

- [ ] **Step 5: Gravar pelo montador**

No `handleSubmit`, trocar o objeto do `addDoc` (linhas 491 a 526), de:

```js
        {
          name: form.name.trim(),
          whatsapp: form.whatsapp,
          source: form.source,
          funnelId: form.funnelId,
          status: form.status,
          tags: form.tags,
          birthDate: fromDateInputValue(form.birthDate),
          cpf: (form.cpf || '').trim() || null,
          email: (form.email || '').trim() || null,
          sexo: form.sexo || null,
          dor: (form.dor || '').trim() || null,
          modalidade: form.modalidade || null,
          // Vínculo de indicação no PRÓPRIO doc: a feature funciona mesmo se o
          // batch de eventos (commitReferralLink) falhar depois.
          referredById: isReferral && referrer ? referrer.id : null,
          referredByName: isReferral && referrer ? (referrer.name || null) : null,
          ...getLeadOwnershipFields(appUser),
          ...buildLeadSearchFields({ name: form.name, whatsapp: form.whatsapp, cpf: form.cpf }),
          ...buildGuardianPatch({
            isMinor: form.isMinor,
            name: form.guardianName,
            phone: form.guardianPhone,
            relationship: form.guardianRelation,
          }),
          lifecycleBucket: deriveLeadBucket({ status: form.status }),
          lastInteractionAt: null,
          interactionsCount: 0,
          createdAt: serverTimestamp(),
          statusEnteredAt: serverTimestamp(),
          nextFollowUp: null,
          nextFollowUpType: null,
          appointmentType: null,
          appointmentScheduledFor: null,
        }
      );
```

para:

```js
        {
          // O mesmo montador do cadastro pelo Stronizap (src/lib/newLead.js):
          // campo novo do lead entra lá e os dois cadastros gravam igual. As
          // datas do servidor ficam aqui, porque cada lado usa um SDK.
          ...buildNewLeadDoc(form, { owner: appUser, referrer: isReferral ? referrer : null }),
          createdAt: serverTimestamp(),
          statusEnteredAt: serverTimestamp(),
        }
      );
```

O `referrer: isReferral ? referrer : null` dá o mesmo resultado do `isReferral && referrer ? ... : null` de antes, e o resto do `handleSubmit` não muda.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js src/lib/__tests__/newLead.test.js && npx eslint src/modals/AddLeadModal.jsx src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js`
Expected: `Tests  10 passed (10)` e lint sem erro (import sobrando vira `no-unused-vars`).

- [ ] **Step 7: Commit**

```bash
git add src/modals/AddLeadModal.jsx src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js
git commit -m "refactor: Novo lead grava pelo montador único

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: O marco do Stronizap não conta como contato

**Files:**
- Modify: `src/lib/leads.js:144-169`
- Modify: `src/lib/crm/contact.js:5`, `:14-21`
- Test: `src/lib/__tests__/leads.test.js`, `src/lib/__tests__/crm.contact.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/leads.test.js`, no import do topo, trocar:

```js
  isRegistrationNote,
  hasActiveInteractionToday,
```

por:

```js
  isRegistrationNote,
  isRegistrationInteraction,
  ZAP_SIGNUP_TYPE,
  hasActiveInteractionToday,
```

E acrescentar no fim do arquivo:

```js
describe('marco do cadastro pelo Stronizap (type zap_signup)', () => {
  const MARCO = { leadId: 'l1', type: 'zap_signup', text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.', createdAt: TODAY_10H };

  it('o tipo tem nome fixo: é o que fica gravado na interação', () => {
    expect(ZAP_SIGNUP_TYPE).toBe('zap_signup');
  });

  it('isRegistrationInteraction: o marco e a observação do cadastro são registro, o resto não', () => {
    expect(isRegistrationInteraction(MARCO)).toBe(true);
    expect(isRegistrationInteraction({ type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: veio do site' })).toBe(true);
    expect(isRegistrationInteraction({ type: 'note', text: 'Ligou pedindo horário' })).toBe(false);
    expect(isRegistrationInteraction({ type: 'status_change', text: 'Fase alterada para [Contato].' })).toBe(false);
    expect(isRegistrationInteraction(null)).toBe(false);
  });

  it('não acende o "Já interagido hoje"', () => {
    expect(hasActiveInteractionToday({ id: 'l1' }, [MARCO], TODAY_START)).toBe(false);
  });
});
```

Em `src/lib/__tests__/crm.contact.test.js`, acrescentar no fim:

```js
describe('marco do cadastro pelo Stronizap', () => {
  const MARCO = { id: 'z1', leadId: 'a', type: 'zap_signup', text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.', createdAt: T(1, 10, 1) };

  it('não conta como contato', () => {
    expect(isContactInteraction(MARCO)).toBe(false);
  });

  it('não vira o primeiro contato do lead: sem outra interação, o lead fica sem contato', () => {
    const contactTimes = contactTimesByLead([MARCO]);
    expect(contactTimes.has('a')).toBe(false);
    expect(firstContactOf([{ id: 'a', createdAt: T(1, 10) }], { contactTimes, limit: T(15).getTime() }))
      .toMatchObject({ total: 1, none: 1, h1: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leads.test.js src/lib/__tests__/crm.contact.test.js`
Expected: FAIL nos testes novos (`isRegistrationInteraction is not a function`, `expected undefined to be 'zap_signup'` e `expected true to be false`).

- [ ] **Step 3: Implementar em `src/lib/leads.js`**

Trocar as linhas 144 a 155:

```js
// True se o texto da interaction é a observação automática gerada no
// cadastro do lead (prefixo literal "OBSERVAÇÃO DO CADASTRO:"). Usado
// pra (i) ignorar essas observações no contador de atividade ativa e
// (ii) rotular o evento corretamente no feed da Dashboard.
export const isRegistrationNote = (text) =>
  typeof text === 'string' && text.startsWith('OBSERVAÇÃO DO CADASTRO:');

// True se houve qualquer interaction "ativa" hoje (mudança de fase,
// nota, follow-up agendado, etc.) que NÃO seja 'daily_goal_done' nem
// observação automática do cadastro. Usado para o badge "Já
// interagido hoje" — informa o consultor que ele já tocou no lead
// mas ainda precisa fechar a tarefa via Meta Diária.
```

por:

```js
// True se o texto da interaction é a observação automática gerada no
// cadastro do lead (prefixo literal "OBSERVAÇÃO DO CADASTRO:"). Fica fora do
// contador de atividade ativa (abaixo) e do primeiro contato do Dashboard CRM
// (src/lib/crm/contact.js).
export const isRegistrationNote = (text) =>
  typeof text === 'string' && text.startsWith('OBSERVAÇÃO DO CADASTRO:');

// Tipo da interação que o cadastro pelo Stronizap grava (api/zap.js, ação
// create-lead): o marco de início na linha do tempo da ficha.
export const ZAP_SIGNUP_TYPE = 'zap_signup';

// A interação é o registro do próprio cadastro, não um contato com a pessoa:
// a observação do Novo lead ou o marco do cadastro pelo Stronizap.
export const isRegistrationInteraction = (i) =>
  i?.type === ZAP_SIGNUP_TYPE || isRegistrationNote(i?.text);

// True se houve qualquer interaction "ativa" hoje (mudança de fase,
// nota, follow-up agendado, etc.) que NÃO seja 'daily_goal_done' nem
// registro do cadastro (a observação automática ou o marco do Stronizap).
// Usado para o badge "Já interagido hoje", que avisa o consultor que ele já
// tocou no lead mas ainda precisa fechar a tarefa via Meta Diária.
```

E, dentro de `hasActiveInteractionToday`, trocar a linha 166:

```js
    if (isRegistrationNote(i.text)) return false;
```

por:

```js
    if (isRegistrationInteraction(i)) return false;
```

- [ ] **Step 4: Implementar em `src/lib/crm/contact.js`**

Trocar a linha 5:

```js
import { isRegistrationNote } from '../leads.js';
```

por:

```js
import { isRegistrationNote, ZAP_SIGNUP_TYPE } from '../leads.js';
```

E as linhas 14 a 20:

```js
// Não contam como contato: a observação do cadastro, a indicação, a
// importação e a troca de responsável. Qualquer outra interação registrada
// conta, inclusive a de quem já saiu da equipe, porque o contato aconteceu.
export const isContactInteraction = (i) => Boolean(i)
  && i.type !== 'referral'
  && i.type !== 'import'
  && !(i.type === 'note' && isRegistrationNote(i.text))
```

por:

```js
// Não contam como contato: a observação do cadastro, o marco do cadastro pelo
// Stronizap, a indicação, a importação e a troca de responsável. Qualquer
// outra interação registrada conta, inclusive a de quem já saiu da equipe,
// porque o contato aconteceu.
export const isContactInteraction = (i) => Boolean(i)
  && i.type !== 'referral'
  && i.type !== 'import'
  && i.type !== ZAP_SIGNUP_TYPE
  && !(i.type === 'note' && isRegistrationNote(i.text))
```

A linha seguinte (`&& !isOwnerChange(i);`) fica como está.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leads.test.js src/lib/__tests__/crm.contact.test.js src/lib/__tests__/dailyGoal.test.js src/lib/__tests__/crm.metrics.test.js && npx eslint src/lib/leads.js src/lib/crm/contact.js`
Expected: PASS em todos (`leads.test.js` com 65, `crm.contact.test.js` com 9) e lint sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leads.js src/lib/crm/contact.js src/lib/__tests__/leads.test.js src/lib/__tests__/crm.contact.test.js
git commit -m "feat: marco do cadastro pelo Stronizap fica fora das contas de contato

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: O marco na classificação e nos textos da linha do tempo

**Files:**
- Modify: `src/lib/timeline.js:5`, `:34-39`, `:56-61`, `:96-102`, `:117-127`
- Test: `src/lib/__tests__/timeline.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/timeline.test.js`, trocar o import do topo:

```js
  classifyInteraction,
  TIMELINE_FILTERS
} from '../timeline.js';
```

por:

```js
  classifyInteraction,
  zapSignupPillText,
  zapSignupDetailText,
  TIMELINE_FILTERS
} from '../timeline.js';
```

E acrescentar no fim do arquivo:

```js
describe('marco de início do cadastro pelo Stronizap (type zap_signup)', () => {
  const MARCO = {
    type: 'zap_signup',
    text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.',
    consultantName: 'Johnny',
    ownerName: 'Ana Souza',
    zapChannelName: 'Recepção',
    createdAt: new Date(2026, 8, 28, 14, 32)
  };

  it('tem bucket próprio, decidido pelo type', () => {
    expect(classifyInteraction(MARCO)).toBe('origin');
    // Nem o texto de conversa leva o marco para outro bucket.
    expect(classifyInteraction({ ...MARCO, text: '📲 Mensagem WhatsApp enviada: oi' })).toBe('origin');
  });

  it('entra em Marcos e em Tudo, e não em Anotações', () => {
    expect(matchesTimelineFilter('origin', 'milestone')).toBe(true);
    expect(matchesTimelineFilter('origin', 'all')).toBe(true);
    expect(matchesTimelineFilter('origin', 'note')).toBe(false);
  });

  it("rótulo da coluna: 'Início'", () => {
    expect(timelineTypeLabel({ _kind: 'origin' })).toBe('Início');
  });

  it('pílula: quem cadastrou, o dia e a hora', () => {
    expect(zapSignupPillText(MARCO)).toBe('cadastrado pelo Stronizap por Johnny em 28/09 às 14:32');
    expect(zapSignupPillText({ ...MARCO, consultantName: '' })).toBe('cadastrado pelo Stronizap em 28/09 às 14:32');
    expect(zapSignupPillText({ ...MARCO, createdAt: null })).toBe('cadastrado pelo Stronizap por Johnny');
  });

  it('linha de baixo: o consultor responsável só quando é outra pessoa, e o canal', () => {
    expect(zapSignupDetailText(MARCO)).toBe('Consultor responsável Ana Souza · canal Recepção');
    expect(zapSignupDetailText({ ...MARCO, ownerName: undefined })).toBe('Canal Recepção');
    expect(zapSignupDetailText({ ...MARCO, zapChannelName: null })).toBe('Consultor responsável Ana Souza');
    expect(zapSignupDetailText({ ...MARCO, ownerName: null, zapChannelName: '' })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js`
Expected: FAIL nos testes novos (`expected 'system' to be 'origin'`, `zapSignupPillText is not a function`).

- [ ] **Step 3: Implementar em `src/lib/timeline.js`**

Logo abaixo da linha 5 (`import { monthKeyOf, monthLabel } from './operacional/month.js';`), acrescentar:

```js
import { ZAP_SIGNUP_TYPE } from './leads.js';
```

`leads.js` não importa `timeline.js`, então não há ciclo.

Logo depois de `timelineStamp` (fim da linha 39), acrescentar:

```js

// Textos do marco de início do lead cadastrado pelo Stronizap (modelo C da
// spec). A pílula: "cadastrado pelo Stronizap por Johnny em 28/09 às 14:32".
// O "Início" em negrito fica com o componente (ZapSignupMarker).
export const zapSignupPillText = (i) => {
  const d = validDate(i?.createdAt);
  const autor = String(i?.consultantName || '').trim();
  return [
    'cadastrado pelo Stronizap',
    autor ? `por ${autor}` : null,
    d ? `em ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} às ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : null
  ].filter(Boolean).join(' ');
};

// A linha de baixo do marco: o consultor responsável, só quando não é quem
// cadastrou (o ownerName só é gravado nesse caso), e o canal da conversa. Sem
// nenhum dos dois, null.
export const zapSignupDetailText = (i) => {
  const dono = String(i?.ownerName || '').trim();
  const canal = String(i?.zapChannelName || '').trim();
  const texto = [dono ? `Consultor responsável ${dono}` : null, canal ? `canal ${canal}` : null].filter(Boolean).join(' · ');
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : null;
};
```

Em `classifyInteraction`, logo depois da linha 61 (`if (i.type === 'referral') return 'referral';`), acrescentar:

```js
  // Marco de início do lead cadastrado pelo Stronizap: bucket próprio, também
  // decidido pelo type. Entra em Marcos e aparece com o interruptor de
  // Sistema desligado.
  if (i.type === ZAP_SIGNUP_TYPE) return 'origin';
```

No `TIMELINE_FILTERS`, trocar a linha 101:

```js
  { id: 'milestone',    label: 'Marcos',       kinds: ['status', 'contract', 'referral'] }
```

por:

```js
  { id: 'milestone',    label: 'Marcos',       kinds: ['status', 'contract', 'referral', 'origin'] }
```

Em `timelineTypeLabel`, logo depois de `case 'referral': return 'Indicação';` (linha 122), acrescentar:

```js
    case 'origin': return 'Início';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js && npx eslint src/lib/timeline.js`
Expected: `Tests  46 passed (46)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.js src/lib/__tests__/timeline.test.js
git commit -m "feat: marco de início do cadastro pelo Stronizap na classificação da linha do tempo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Marca do Stronizap e marco de início na ficha

**Files:**
- Create: `src/components/brand/StronizapMark.jsx`
- Create: `src/components/profile/ZapSignupMarker.jsx`
- Modify: `src/views/LeadProfileView.jsx:41`, `:758`, `:963-965`, `:1597`
- Test: `src/lib/__tests__/profileOriginMarker.test.js` (novo)

A UI segue o modelo C da seção 3 dos mockups. Invoque a skill `frontend-design` do Stronilead ao mexer aqui, como pede o `CLAUDE.md`, mas não mude o desenho aprovado.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/__tests__/profileOriginMarker.test.js`:

```js
// O lead cadastrado pelo Stronizap ganha um marco de início na ficha (modelo
// C da spec): uma régua com a pílula "Início · cadastrado pelo Stronizap por
// ..." e, embaixo, o consultor responsável e o canal. Mesma montagem de
// profileTimeline.test.js: o LeadProfileView lê window.location.origin no
// render, por isso o window falso.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { StronizapMark } from '../../components/brand/StronizapMark.jsx';

// A linha do tempo de cada teste, mais recente primeiro, como o useLeadTimeline
// entrega.
const linha = vi.hoisted(() => ({ registros: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => linha.registros }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', status: 'Primeiro contato',
  createdAt: new Date(2026, 8, 28, 14, 32),
};

const NOTA = {
  id: 'n1', type: 'note', text: 'Pediu horário de pilates à noite, depois das 19h.',
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 28, 15, 10),
};
const FASE = {
  id: 's1', type: 'status_change', text: 'Fase alterada para [Primeiro contato].',
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 28, 14, 40),
};
// Johnny (gestor) cadastrou e passou para a Ana.
const MARCO = {
  id: 'z1', type: 'zap_signup',
  text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.',
  consultantName: 'Johnny', ownerName: 'Ana Souza', zapChannelName: 'Recepção',
  createdAt: new Date(2026, 8, 28, 14, 32),
};

const ficha = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead: LEAD, onTab: () => {}, onBack: () => {},
        appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
        statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
      }))));

describe('marco de início do cadastro pelo Stronizap na ficha', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 28, 16, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('fecha a linha do tempo por baixo, com a pílula e o consultor responsável', () => {
    linha.registros = [NOTA, FASE, MARCO];
    const html = ficha();
    expect(html).toContain('cadastrado pelo Stronizap por Johnny em 28/09 às 14:32');
    expect(html).toContain('Consultor responsável Ana Souza · canal Recepção');
    expect(html.indexOf('cadastrado pelo Stronizap')).toBeGreaterThan(html.indexOf('Pediu horário de pilates'));
    expect(html.indexOf('cadastrado pelo Stronizap')).toBeGreaterThan(html.indexOf('>28/09 14:40<'));
  });

  it('não vira linha de nota: o texto gravado não aparece como corpo', () => {
    linha.registros = [NOTA, FASE, MARCO];
    expect(ficha()).not.toContain('Cadastrado pelo Stronizap por Johnny. Consultor responsável');
  });

  it('quem cadastrou ficou com o lead: a linha de baixo fica só com o canal', () => {
    linha.registros = [NOTA, {
      ...MARCO, consultantName: 'Ana Souza', ownerName: undefined,
      text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.',
    }];
    const html = ficha();
    expect(html).toContain('cadastrado pelo Stronizap por Ana Souza em 28/09 às 14:32');
    expect(html).toContain('>Canal Recepção<');
    expect(html).not.toContain('Consultor responsável Ana Souza');
  });

  it('com o marco, a linha genérica "Início da jornada" sai; sem ele, continua', () => {
    linha.registros = [NOTA, FASE, MARCO];
    expect(ficha()).not.toContain('Início da jornada');
    linha.registros = [NOTA, FASE];
    expect(ficha()).toContain('Início da jornada');
  });

  it('conta em Marcos junto com a troca de fase', () => {
    linha.registros = [NOTA, FASE, MARCO];
    expect(ficha()).toMatch(/Marcos<span class="num opacity-65">2<\/span>/);
  });

  it('a pílula leva a marca do Stronizap, com as cores dos dois temas', () => {
    linha.registros = [MARCO];
    const html = ficha();
    expect(html).toContain('viewBox="0 0 240 240"');
    expect(html).toContain('fill-[#1A1D20] dark:fill-white');
  });
});

describe('StronizapMark', () => {
  it('balão e raio do logo, com a versão clara no tema escuro', () => {
    const svg = renderToString(createElement(StronizapMark, { size: 13 }));
    expect(svg).toContain('width="13"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('d="M 120 30 C 70 30, 30 70, 30 120');
    expect(svg).toContain('d="M 138 56 L 84 132 L 116 132 L 102 184 L 156 108 L 124 108 Z"');
    expect(svg).toContain('stroke-width="8"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('fill-[#25D366] stroke-[#25D366] dark:fill-[#128C7E] dark:stroke-[#128C7E]');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/profileOriginMarker.test.js`
Expected: FAIL, com `Cannot find module '/src/components/brand/StronizapMark.jsx'`.

- [ ] **Step 3: Criar `src/components/brand/StronizapMark.jsx`**

```jsx
// Marca do Stronizap: o balão de conversa com o raio, no traçado do logo dele
// (viewBox 240). Vai no marco de início do lead cadastrado pelo Stronizap, do
// mesmo jeito que o Stronizap mostra a marca do Stronilead (StronileadMark).
// As cores são as do outro produto, sem token semântico que as represente, e
// por isso o dark: explícito: no tema claro, balão escuro com raio verde; no
// escuro, a versão clara da marca, balão branco com raio verde-escuro.
import { cn } from '@/lib/utils';

const BALAO = 'M 120 30 C 70 30, 30 70, 30 120 C 30 148, 43.5 173.5, 64 190.5 C 61 201, 56.5 213, 50.5 222 C 49 224, 51 226, 53 225 C 64 222, 79 217, 92 211 C 101 213, 110 214, 120 214 C 170 214, 210 173, 210 122 C 210 71, 170 30, 120 30 Z';
const RAIO = 'M 138 56 L 84 132 L 116 132 L 102 184 L 156 108 L 124 108 Z';

export function StronizapMark({ size = 13, className }) {
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} aria-hidden="true" className={cn('shrink-0', className)}>
      <path d={BALAO} className="fill-[#1A1D20] dark:fill-white" />
      <path
        d={RAIO}
        strokeWidth={8}
        strokeLinejoin="round"
        className="fill-[#25D366] stroke-[#25D366] dark:fill-[#128C7E] dark:stroke-[#128C7E]"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Criar `src/components/profile/ZapSignupMarker.jsx`**

```jsx
// Marco de início do lead cadastrado pelo Stronizap (modelo C da spec): uma
// régua fina com a pílula no meio e, embaixo, o consultor responsável (só
// quando não é quem cadastrou) e o canal da conversa. Fica no fim da linha do tempo, que é
// onde a história do lead começa. Os textos saem de lib/timeline.js.
import { StronizapMark } from '../brand/StronizapMark.jsx';
import { zapSignupDetailText, zapSignupPillText } from '../../lib/timeline.js';

export function ZapSignupMarker({ interaction }) {
  const pilula = zapSignupPillText(interaction);
  const detalhe = zapSignupDetailText(interaction);
  return (
    <div className="pt-2.5 pb-1">
      <div className="flex items-center gap-2.5">
        <div className="h-px flex-1 bg-border" />
        {/* A pílula encolhe e corta o texto antes de estourar a largura; o
            title guarda a frase inteira. */}
        <div
          className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card py-[5px] pl-1.5 pr-3"
          title={`Início · ${pilula}`}
        >
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-muted">
            <StronizapMark size={13} />
          </span>
          <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">Início</span> · {pilula}
          </span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
      {detalhe && <p className="mt-[5px] text-center text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Desenhar o marco na ficha (`src/views/LeadProfileView.jsx`)**

Logo depois da linha 41 (`import { ScheduleWizard } from '../components/profile/ScheduleWizard.jsx';`), acrescentar:

```js
import { ZapSignupMarker } from '../components/profile/ZapSignupMarker.jsx';
```

Logo depois da linha 758 (`const groupedEvents = groupTimeline(filteredInteractions);`), acrescentar:

```js

  // Lead cadastrado pelo Stronizap já fecha a linha do tempo com o marco de
  // início (ZapSignupMarker). Com ele, a linha genérica "Início da jornada" sai,
  // senão o começo aparece duas vezes.
  const hasOriginMarker = interactionsWithClass.some(i => i._kind === 'origin');
```

No começo de `renderTimelineEvent` (linhas 963 a 965), trocar:

```js
  const renderTimelineEvent = (i) => {
    // "28/09 14:32". O ano fica no bloco do mês.
```

por:

```js
  const renderTimelineEvent = (i) => {
    // ---- Variante 5: marco de início do cadastro pelo Stronizap -----------
    // Régua com a pílula, fora do padrão tabular (modelo C da spec). É o
    // registro mais antigo do lead, então fecha a linha do tempo por baixo.
    if (i._kind === 'origin') return <ZapSignupMarker key={i.id} interaction={i} />;

    // "28/09 14:32". O ano fica no bloco do mês.
```

E, no fim da aba Linha do tempo, trocar a linha 1597:

```jsx
              {timelineFilter === 'all' && !timelineQuery && (
```

por:

```jsx
              {timelineFilter === 'all' && !timelineQuery && !hasOriginMarker && (
```

A linha do tempo chega ordenada do mais novo para o mais antigo (`useLeadTimeline`), e o marco é gravado junto com o lead, então ele cai sozinho no fim do último bloco de mês.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/profileOriginMarker.test.js src/lib/__tests__/profileTimeline.test.js src/lib/__tests__/profileLinks.test.js && npx eslint src/views/LeadProfileView.jsx src/components/profile/ZapSignupMarker.jsx src/components/brand/StronizapMark.jsx src/lib/__tests__/profileOriginMarker.test.js`
Expected: PASS em todos (`profileOriginMarker.test.js` com 7) e lint sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/components/brand/StronizapMark.jsx src/components/profile/ZapSignupMarker.jsx src/views/LeadProfileView.jsx src/lib/__tests__/profileOriginMarker.test.js
git commit -m "feat: marco de início do cadastro pelo Stronizap na ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Regras da ponte, parte 1: telefone, academia, equipe e opções (`api/_zapPhone.js`, `api/_zapLead.js`)

**Files:**
- Modify: `api/_zapPhone.js`
- Create: `api/_zapLead.js`
- Test: `api/__tests__/zapPhone.test.js`, `api/__tests__/zapLead.test.js`

O arquivo começa com `_`, então a Vercel não o publica como função.

Os quatro primeiros passos põem a regra do nono dígito ao lado do `zapMatchKey`, porque as regras da ponte normalizam o telefone por ela.

- [ ] **Step 1: Escrever os testes da regra do nono dígito**

Em `api/__tests__/zapPhone.test.js`, trocar o import do topo:

```js
import { zapMatchKey } from '../_zapPhone.js';
```

por:

```js
import { zapMatchKey, nationalPhoneDigits } from '../_zapPhone.js';
```

E acrescentar no fim do arquivo:

```js
describe('nationalPhoneDigits: o número no formato do Stronilead', () => {
  it('celular antigo, sem o nono dígito, ganha o 9 logo depois do DDD', () => {
    expect(nationalPhoneDigits('555181244710')).toBe('51981244710');
    expect(nationalPhoneDigits('5181244710')).toBe('51981244710');
    expect(nationalPhoneDigits('(51) 6123-4567')).toBe('51961234567');
  });

  it('celular com o nono dígito fica como está, sem o 55', () => {
    expect(nationalPhoneDigits('5551998124471')).toBe('51998124471');
    expect(nationalPhoneDigits('51998124471')).toBe('51998124471');
  });

  it('fixo (2 a 5 depois do DDD) fica com 10 dígitos', () => {
    expect(nationalPhoneDigits('555133334444')).toBe('5133334444');
    expect(nationalPhoneDigits('5152223333')).toBe('5152223333');
  });

  it('DDD 55 não é confundido com o país', () => {
    expect(nationalPhoneDigits('555599998888')).toBe('55999998888');
    expect(nationalPhoneDigits('5555999998888')).toBe('55999998888');
  });

  it('o que não vira 10 ou 11 dígitos volta null', () => {
    expect(nationalPhoneDigits('123')).toBeNull();
    expect(nationalPhoneDigits('')).toBeNull();
    expect(nationalPhoneDigits(null)).toBeNull();
    expect(nationalPhoneDigits('14155552671999')).toBeNull();
  });

  it('a chave de casamento é a mesma antes e depois', () => {
    ['555181244710', '5551998124471', '555133334444', '555599998888', '5181244710'].forEach((raw) => {
      expect(zapMatchKey(nationalPhoneDigits(raw))).toBe(zapMatchKey(raw));
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapPhone.test.js`
Expected: `Tests  6 failed | 6 passed (12)`, com `TypeError: nationalPhoneDigits is not a function`.

- [ ] **Step 3: Implementar em `api/_zapPhone.js`**

Acrescentar no fim do arquivo, depois do `zapMatchKey`:

```js
// Dígitos nacionais do número que o WhatsApp guarda, no formato que o
// Stronilead grava: sem o 55 (pela mesma regra da chave acima) e com o nono
// dígito do celular. Número cadastrado no WhatsApp antes do nono dígito chega
// com 10; quando o primeiro depois do DDD é 6, 7, 8 ou 9, é celular e ganha o
// 9 logo depois do DDD. Fixo (2 a 5) fica com 10. null quando não sobram 10
// ou 11 dígitos. A chave de casamento não muda: DDD e últimos 8 são os mesmos
// com e sem o 9.
export function nationalPhoneDigits(raw) {
  let d = onlyDigits(raw);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 10 && '6789'.includes(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  return d.length === 10 || d.length === 11 ? d : null;
}
```

- [ ] **Step 4: Rodar, ver passar e commitar**

Run: `npx vitest run api/__tests__/zapPhone.test.js && npx eslint api/_zapPhone.js api/__tests__/zapPhone.test.js`
Expected: `Tests  12 passed (12)` e lint sem erro.

```bash
git add api/_zapPhone.js api/__tests__/zapPhone.test.js
git commit -m "feat: celular antigo ganha o nono dígito no número do Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Escrever os testes que falham**

Criar `api/__tests__/zapLead.test.js`:

```js
import { describe, it, expect, vi, afterAll } from 'vitest';

// O cadastro pelo Stronizap roda numa função da Vercel, com o processo em UTC
// (lá o TZ é variável reservada). Como em zapFuso.test.js (PR #227), o
// processo vai para UTC antes de importar as regras, e o primeiro teste
// confere que a troca pegou.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  ZAP_LEAD_MESSAGES, LEAD_CREATE_LIMIT, refusal, invalidData, tenantBlocked, nationalDigits, whatsappFromZap,
  emailFromActor, findTeamMember, teamRole, catalogView, buildLeadOptions
} from '../_zapLead.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

const HOJE = new Date('2026-09-29T13:00:00Z');
const DIA = 86400000;
const ts = (d) => ({ toDate: () => d });
const antes = (dias) => new Date(HOJE.getTime() - dias * DIA);

// Equipe como mora em stronix_users. O id é o do documento.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', email: 'bruno@stronix.com.br', authUid: 'auth-bruno', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };
// Convidada que nunca entrou: está na equipe, mas sem authUid.
const BIA = { id: 'u-bia', name: 'Bia Rocha', email: 'bia@stronix.com.br', role: 'consultant' };

const CATALOGOS = {
  sources: [{ id: 's1', name: 'WhatsApp' }, { id: 's2', name: 'Instagram' }, { id: 's3', name: '' }, { id: 's4', name: 'Instagram' }],
  dores: [{ id: 'd1', name: 'Postura' }, { id: 'd2', name: 'Emagrecimento' }],
  modalities: [{ id: 'm2', name: 'Pilates', order: 2 }, { id: 'm1', name: 'Musculação', order: 1 }],
  funnels: [
    { id: 'f-kids', name: 'Kids', order: 2 },
    { id: 'f-com', name: 'Comercial', order: 1, isDefault: true },
    { id: 'f-ind', name: 'Indicações', order: 97, systemKind: 'referral' },
    { id: 'f-vazio', name: 'Sem etapas', order: 3 }
  ],
  statuses: [
    { id: 'a', funnelId: 'f-com', name: 'Primeiro contato', order: 2 },
    { id: 'b', funnelId: 'f-com', name: 'Novo lead', order: 1 },
    { id: 'c', funnelId: 'f-kids', name: 'Interesse', order: 1 },
    { id: 'd', funnelId: 'f-ind', name: 'Aguardando ação', order: 1 }
  ]
};

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

describe('recusas', () => {
  it('toda recusa leva error e message; a de campo leva field', () => {
    expect(refusal(403, 'academia_bloqueada', 'x')).toEqual({ status: 403, body: { error: 'academia_bloqueada', message: 'x' } });
    expect(invalidData('name', 'y')).toEqual({ status: 400, body: { error: 'dados_invalidos', field: 'name', message: 'y' } });
  });

  it('o limite é de 60 cadastros por hora', () => {
    expect(LEAD_CREATE_LIMIT).toEqual({ limit: 60, windowMs: 3600000 });
  });
});

describe('tenantBlocked: a mesma conta do tenantActive de firestore.rules', () => {
  it('academia sem documento, sem status ou ativa: libera', () => {
    expect(tenantBlocked(null, HOJE)).toBe(false);
    expect(tenantBlocked({}, HOJE)).toBe(false);
    expect(tenantBlocked({ status: 'active' }, HOJE)).toBe(false);
  });

  it('suspensa: bloqueia', () => {
    expect(tenantBlocked({ status: 'suspended' }, HOJE)).toBe(true);
  });

  it('teste vencido: bloqueia, mesmo com pagamento marcado (as regras não têm essa exceção)', () => {
    const vencido = { status: 'trial', trialEndsAt: ts(antes(1)) };
    expect(tenantBlocked(vencido, HOJE)).toBe(true);
    expect(tenantBlocked({ ...vencido, paymentStatus: 'paid' }, HOJE)).toBe(true);
  });

  it('teste vigente, ou com data que não é timestamp: libera', () => {
    expect(tenantBlocked({ status: 'trial', trialEndsAt: ts(antes(-1)) }, HOJE)).toBe(false);
    expect(tenantBlocked({ status: 'trial', trialEndsAt: '2026-01-01' }, HOJE)).toBe(false);
  });

  it('mensalidade atrasada: bloqueia só depois de 3 dias', () => {
    const atraso = (dias) => ({ paymentStatus: 'overdue', paymentOverdueSince: ts(antes(dias)) });
    expect(tenantBlocked(atraso(3), HOJE)).toBe(false);
    expect(tenantBlocked(atraso(3.01), HOJE)).toBe(true);
    expect(tenantBlocked({ paymentStatus: 'overdue' }, HOJE)).toBe(false);
  });

  it('aceita o Timestamp do firebase-admin (toMillis) e Date', () => {
    expect(tenantBlocked({ status: 'trial', trialEndsAt: { toMillis: () => HOJE.getTime() - 1 } }, HOJE)).toBe(true);
    expect(tenantBlocked({ status: 'trial', trialEndsAt: new Date(HOJE.getTime() - 1) }, HOJE)).toBe(true);
  });
});

describe('telefone da conversa no formato do Novo lead', () => {
  it('tira o 55 pela regra do zapMatchKey e formata como o Novo lead', () => {
    expect(whatsappFromZap('5551998124471')).toBe('(51) 9 9812-4471');
    expect(whatsappFromZap('51998124471')).toBe('(51) 9 9812-4471');
    expect(whatsappFromZap('5555999998888')).toBe('(55) 9 9999-8888');
  });

  it('celular antigo, sem o nono dígito, ganha o 9 antes da máscara', () => {
    expect(nationalDigits('555181244710')).toBe('51981244710');
    expect(whatsappFromZap('555181244710')).toBe('(51) 9 8124-4710');
  });

  it('fixo fica com 10 dígitos, na máscara do Novo lead', () => {
    expect(nationalDigits('555133334444')).toBe('5133334444');
    expect(whatsappFromZap('555133334444')).toBe('(51) 3 3334-444');
  });

  it('o que não é número brasileiro com DDD volta null', () => {
    expect(nationalDigits('123')).toBeNull();
    expect(nationalDigits('')).toBeNull();
    expect(nationalDigits('14155552671999')).toBeNull();
    expect(nationalDigits(5551998124471)).toBeNull();
    expect(whatsappFromZap(null)).toBeNull();
  });
});

describe('quem cadastra é achado pelo e-mail', () => {
  const EQUIPE = [
    { id: 'legado', name: 'Ana (antiga)', email: 'ana@stronix.com.br', role: 'consultant' },
    ANA,
    BIA
  ];

  it('e-mail em minúsculas e sem espaço; o que não parece e-mail volta null', () => {
    expect(emailFromActor({ email: '  ANA@Stronix.com.br ' })).toBe('ana@stronix.com.br');
    expect(emailFromActor({ email: 'ana' })).toBeNull();
    expect(emailFromActor({ email: 42 })).toBeNull();
    expect(emailFromActor(null)).toBeNull();
  });

  it('só vale quem tem authUid; com dois cadastros do mesmo e-mail, fica o que tem', () => {
    expect(findTeamMember(EQUIPE, 'ana@stronix.com.br')).toBe(ANA);
    expect(findTeamMember(EQUIPE, 'bia@stronix.com.br')).toBeNull();
    expect(findTeamMember(EQUIPE, 'carla@stronix.com.br')).toBeNull();
    expect(findTeamMember(EQUIPE, null)).toBeNull();
  });

  it('gestor é o role admin', () => {
    expect(teamRole(JOHNNY)).toBe('gestor');
    expect(teamRole(ANA)).toBe('consultor');
  });
});

describe('catalogView e buildLeadOptions', () => {
  it('nomes vazios e repetidos saem; origem e dor em ordem alfabética; o resto pela ordem configurada', () => {
    expect(catalogView(CATALOGOS)).toEqual({
      sources: ['Instagram', 'WhatsApp'],
      dores: ['Emagrecimento', 'Postura'],
      modalities: ['Musculação', 'Pilates'],
      funnels: [
        { id: 'f-com', name: 'Comercial', stages: ['Novo lead', 'Primeiro contato'], isDefault: true },
        { id: 'f-kids', name: 'Kids', stages: ['Interesse'], isDefault: false }
      ]
    });
  });

  it('catálogo ausente vira lista vazia', () => {
    expect(catalogView({})).toEqual({ sources: [], dores: [], modalities: [], funnels: [] });
  });

  it('consultor: quem é, as listas e o padrão do Novo lead, sem a equipe', () => {
    const opcoes = buildLeadOptions({ actor: ANA, team: [ANA, JOHNNY], catalogs: CATALOGOS });
    expect(opcoes).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
      sources: [{ name: 'Instagram' }, { name: 'WhatsApp' }],
      dores: [{ name: 'Emagrecimento' }, { name: 'Postura' }],
      modalities: [{ name: 'Musculação' }, { name: 'Pilates' }],
      funnels: [
        { id: 'f-com', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] },
        { id: 'f-kids', name: 'Kids', stages: [{ name: 'Interesse' }] }
      ],
      relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
      defaults: { source: 'WhatsApp', funnelId: 'f-com', stage: 'Novo lead' }
    });
    expect('team' in opcoes).toBe(false);
  });

  it('gestor: a equipe com login, só id e nome, em ordem alfabética', () => {
    const opcoes = buildLeadOptions({ actor: JOHNNY, team: [JOHNNY, BRUNO, BIA, ANA], catalogs: CATALOGOS });
    expect(opcoes.actor.role).toBe('gestor');
    expect(opcoes.team).toEqual([
      { id: 'u-ana', name: 'Ana Souza' },
      { id: 'u-bruno', name: 'Bruno Lima' },
      { id: 'u-johnny', name: 'Johnny' }
    ]);
    expect(JSON.stringify(opcoes)).not.toContain('@');
  });

  it('sem origem com "whats", o padrão é a primeira em ordem alfabética; sem nada, null', () => {
    const semWhats = { ...CATALOGOS, sources: [{ id: 'x', name: 'Site' }, { id: 'y', name: 'Instagram' }] };
    expect(buildLeadOptions({ actor: ANA, catalogs: semWhats }).defaults.source).toBe('Instagram');
    expect(buildLeadOptions({ actor: ANA, catalogs: {} }).defaults).toEqual({ source: null, funnelId: null, stage: null });
  });

  it('sem funil marcado como padrão, vale o primeiro pela ordem', () => {
    const semPadrao = { ...CATALOGOS, funnels: CATALOGOS.funnels.map((f) => ({ ...f, isDefault: false })) };
    expect(buildLeadOptions({ actor: ANA, catalogs: semPadrao }).defaults).toMatchObject({ funnelId: 'f-com', stage: 'Novo lead' });
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapLead.test.js`
Expected: FAIL, com `Cannot find module '/api/_zapLead.js'`.

- [ ] **Step 7: Criar `api/_zapLead.js`**

```js
// Regras puras do cadastro de lead pelo Stronizap (ações lead-options e
// create-lead de api/zap.js). Sem Firestore: a rota lê, chama estas funções e
// grava. O firebase-admin passa por cima das regras do Firestore, então o que
// as regras e a tela do Novo lead garantem é refeito aqui.
//
// Toda recusa de regra leva `message`, um texto pronto para a tela: o
// Stronizap mostra como veio, sem recalcular regra nenhuma. Nada daqui vai
// para o log.
//
// Spec: docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md
import { GUARDIAN_RELATIONSHIPS } from '../src/lib/guardian.js';
import { formatPhone } from '../src/lib/masks.js';
import { leadEntryFunnels } from '../src/lib/newLead.js';
import { pickDefaultFunnel } from './_referral.js';
import { nationalPhoneDigits } from './_zapPhone.js';

const MINUTE_MS = 60000;
const DAY_MS = 86400000;
const NAME_MAX = 120;

// No máximo 60 cadastros por hora por academia (api/_rateLimit.js).
export const LEAD_CREATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60 * MINUTE_MS });

export const ZAP_LEAD_MESSAGES = Object.freeze({
  blocked: 'O Stronilead desta academia está bloqueado. Fale com o gestor.',
  notInTeam: (email) => `Seu e-mail do Stronizap, ${email}, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.`,
  rateLimited: 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.',
  phone: 'O número desta conversa não é um WhatsApp com DDD.',
  actor: 'Não deu para saber quem está cadastrando.',
  channelName: 'O nome do canal veio num formato que o Stronilead não aceita.',
  lead: 'Faltaram os dados do cadastro.',
  nameShort: 'Informe o nome, com 2 letras ou mais.',
  nameLong: `Nome longo demais. Use até ${NAME_MAX} letras.`,
  wrongType: 'Esse campo veio num formato que o Stronilead não aceita.',
  minor: 'Os dados do menor vieram num formato que o Stronilead não aceita.',
  pick: Object.freeze({
    source: 'Escolha a origem.',
    dor: 'Escolha a dor ou necessidade.',
    funnelId: 'Escolha o funil.',
    stage: 'Escolha a etapa.'
  }),
  gone: Object.freeze({
    source: 'Essa origem não existe mais no Stronilead. Escolha de novo.',
    dor: 'Essa dor não existe mais no Stronilead. Escolha de novo.',
    modalidade: 'Essa modalidade não existe mais no Stronilead. Escolha de novo.',
    funnelId: 'Esse funil não existe mais no Stronilead. Escolha de novo.',
    stage: 'Essa etapa não existe mais no Stronilead. Escolha de novo.'
  }),
  noDor: 'Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores.',
  onlyManagerPicks: 'Só o gestor escolhe outra pessoa como consultor responsável.',
  ownerGone: 'Essa pessoa não está mais na equipe do Stronilead.',
  relationship: 'Escolha o parentesco da lista.',
  studentIncomplete: 'Número incompleto. Inclua DDD + 9 dígitos.',
  studentIsGuardian: 'Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.',
  studentTaken: 'Esse WhatsApp já está em outro cadastro do Stronilead.'
});

// Recusa pronta para responder: { status, body }. A de campo leva `field`.
export const refusal = (status, error, message, extra = {}) => ({ status, body: { error, ...extra, message } });
export const invalidData = (field, message) => refusal(400, 'dados_invalidos', message, { field });

// ---------------------------------------------------------------------------
// Academia ativa
// ---------------------------------------------------------------------------

// Instante de um Timestamp do firebase-admin (toMillis/toDate) ou de um Date.
// Qualquer outra coisa não é timestamp e volta null, como o `is timestamp` das
// regras.
const millisOf = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  return null;
};

// A mesma conta do tenantActive de firestore.rules: academia suspensa, teste
// vencido e mensalidade atrasada há mais de 3 dias ficam de fora. Documento
// ausente libera, como nas regras. As regras não têm a exceção de "teste
// vencido, mas pago" da tela de login: quem paga no teste vira 'active' pelo
// webhook do Asaas.
export function tenantBlocked(tenant, now = new Date()) {
  if (!tenant) return false;
  const nowMs = now.getTime();
  if (tenant.status === 'suspended') return true;
  const trialEnd = millisOf(tenant.trialEndsAt);
  if (tenant.status === 'trial' && trialEnd != null && trialEnd < nowMs) return true;
  const overdueSince = millisOf(tenant.paymentOverdueSince);
  return tenant.paymentStatus === 'overdue' && overdueSince != null && nowMs - overdueSince > 3 * DAY_MS;
}

// ---------------------------------------------------------------------------
// Telefone e equipe
// ---------------------------------------------------------------------------

// Dígitos nacionais do número, sem o 55 e com o nono dígito do celular antigo
// (nationalPhoneDigits, em api/_zapPhone.js). Só aceita texto: número no lugar
// de texto é pedido malformado.
export function nationalDigits(raw) {
  return typeof raw === 'string' ? nationalPhoneDigits(raw) : null;
}

// O número no formato que o Novo lead grava em `whatsapp`: "(51) 9 9812-4471".
// Celular antigo já sai com o 9: "555181244710" vira "(51) 9 8124-4710".
export function whatsappFromZap(raw) {
  const d = nationalDigits(raw);
  return d ? formatPhone(d) : null;
}

// E-mail de quem cadastra, como o Stronilead guarda: minúsculas e sem espaço.
// Sai da sessão do Stronizap, nunca do navegador.
export function emailFromActor(actor) {
  const email = typeof actor?.email === 'string' ? actor.email.trim().toLowerCase() : '';
  return email.includes('@') && email.length <= 254 ? email : null;
}

// A pessoa da equipe com esse e-mail e com login (authUid). Cadastro legado
// repetido, um com e outro sem authUid, fica com o que tem.
export function findTeamMember(team, email) {
  if (!email) return null;
  return (team || []).find((u) => u.authUid && String(u.email ?? '').trim().toLowerCase() === email) ?? null;
}

// Gestor no Stronilead é o role 'admin'.
export const teamRole = (member) => (member?.role === 'admin' ? 'gestor' : 'consultor');

// ---------------------------------------------------------------------------
// Catálogos e opções do formulário
// ---------------------------------------------------------------------------

const byName = (a, b) => a.localeCompare(b, 'pt-BR');
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const hasName = (d) => typeof d?.name === 'string' && d.name.trim() !== '';
const uniqueNames = (docs) => [...new Set(docs.filter(hasName).map((d) => d.name))];

// Os catálogos no formato do formulário, na ordem das telas do Stronilead:
// origens e dores em ordem alfabética, modalidades, funis e etapas pela ordem
// configurada. Os nomes vão como estão gravados, porque é o nome que o lead
// guarda. Funil sem etapa fica de fora: no Stronizap a etapa é obrigatória.
export function catalogView({ sources = [], dores = [], modalities = [], funnels = [], statuses = [] } = {}) {
  const stagesOf = (funnelId) => uniqueNames(statuses.filter((s) => s.funnelId === funnelId).sort(byOrder));
  return {
    sources: uniqueNames(sources).sort(byName),
    dores: uniqueNames(dores).sort(byName),
    modalities: uniqueNames([...modalities].sort(byOrder)),
    funnels: leadEntryFunnels([...funnels].sort(byOrder))
      .filter(hasName)
      .map((f) => ({ id: f.id, name: f.name, stages: stagesOf(f.id), isDefault: f.isDefault === true }))
      .filter((f) => f.stages.length > 0)
  };
}

// Resposta do lead-options. O padrão é o do Novo lead: a origem com "whats"
// no nome (senão a primeira em ordem alfabética), o funil padrão da academia
// e a primeira etapa dele. A equipe só vai para o gestor, com id e nome.
export function buildLeadOptions({ actor, team, catalogs }) {
  const view = catalogView(catalogs);
  const funil = pickDefaultFunnel(view.funnels);
  const options = {
    actor: { id: actor.id, name: actor.name ?? null, role: teamRole(actor) },
    sources: view.sources.map((name) => ({ name })),
    dores: view.dores.map((name) => ({ name })),
    modalities: view.modalities.map((name) => ({ name })),
    funnels: view.funnels.map((f) => ({ id: f.id, name: f.name, stages: f.stages.map((name) => ({ name })) })),
    relationships: [...GUARDIAN_RELATIONSHIPS],
    defaults: {
      source: view.sources.find((n) => /whats/i.test(n)) ?? view.sources[0] ?? null,
      funnelId: funil?.id ?? null,
      stage: funil?.stages[0] ?? null
    }
  };
  if (teamRole(actor) === 'gestor') {
    options.team = (team || [])
      .filter((u) => u.authUid && hasName(u))
      .map((u) => ({ id: u.id, name: u.name }))
      .sort((a, b) => byName(a.name, b.name));
  }
  return options;
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapLead.test.js && npx eslint api/_zapLead.js api/__tests__/zapLead.test.js`
Expected: `Tests  22 passed (22)` e lint sem erro.

- [ ] **Step 9: Commit**

```bash
git add api/_zapLead.js api/__tests__/zapLead.test.js
git commit -m "feat: regras da ponte para o cadastro pelo Stronizap (academia, equipe e opções)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Regras da ponte, parte 2: pedido e conferências

**Files:**
- Modify: `api/_zapLead.js`
- Test: `api/__tests__/zapLead.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapLead.test.js`, trocar o import de `../_zapLead.js` por:

```js
import {
  ZAP_LEAD_MESSAGES, LEAD_CREATE_LIMIT, refusal, invalidData, tenantBlocked, nationalDigits, whatsappFromZap,
  emailFromActor, findTeamMember, teamRole, catalogView, buildLeadOptions,
  readCreateLeadBody, checkMinor, checkCatalog, resolveOwner, sameStudentName, studentKey
} from '../_zapLead.js';
```

E acrescentar no fim do arquivo:

```js
describe('readCreateLeadBody: só o formato do pedido', () => {
  const corpo = (lead = {}, extra = {}) => ({
    phone: '5551998124471',
    actor: { email: ' Ana@Stronix.com.br ', name: ' Ana ' },
    channelName: ' Recepção ',
    lead: {
      name: '  Mariana Souza ', source: 'WhatsApp', dor: 'Postura', modalidade: null,
      funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null, ...lead
    },
    ...extra
  });

  it('pedido certo: telefone com a chave, e-mail em minúsculas, nome aparado e catálogo como veio', () => {
    expect(readCreateLeadBody(corpo())).toEqual({
      value: {
        phone: '51998124471',
        matchKey: '5198124471',
        email: 'ana@stronix.com.br',
        actorName: 'Ana',
        channelName: 'Recepção',
        lead: {
          name: 'Mariana Souza', source: 'WhatsApp', dor: 'Postura', modalidade: null,
          funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null
        }
      }
    });
  });

  it('número antigo: o telefone sai com o nono dígito, e a chave é a mesma', () => {
    const { value } = readCreateLeadBody(corpo({}, { phone: '555181244710' }));
    expect(value.phone).toBe('51981244710');
    expect(value.matchKey).toBe('5181244710');
  });

  it('menor: o bloco aparado, com parentesco e WhatsApp do aluno opcionais', () => {
    const { value } = readCreateLeadBody(corpo({ minor: { guardianName: ' Maria ', relationship: '', studentWhatsapp: ' ' } }));
    expect(value.lead.minor).toEqual({ guardianName: 'Maria', relationship: null, studentWhatsapp: null });
  });

  it('modalidade em branco vira null, e minor falso é adulto', () => {
    const { value } = readCreateLeadBody(corpo({ modalidade: '  ', minor: false }));
    expect(value.lead.modalidade).toBeNull();
    expect(value.lead.minor).toBeNull();
  });

  it.each([
    ['phone', { phone: '123' }],
    ['phone', { phone: 5551998124471 }],
    ['actor', { actor: { name: 'Ana' } }],
    ['actor', { actor: null }],
    ['channelName', { channelName: 42 }],
    ['lead', { lead: 'Mariana' }],
    ['lead', { lead: null }]
  ])('formato errado em %s é dados_invalidos no campo', (field, extra) => {
    expect(readCreateLeadBody(corpo({}, extra)).refusal).toEqual(invalidData(field, expect.any(String)));
  });

  it.each([
    ['name', { name: ' A ' }, ZAP_LEAD_MESSAGES.nameShort],
    ['name', { name: 'x'.repeat(121) }, ZAP_LEAD_MESSAGES.nameLong],
    ['source', { source: 1 }, ZAP_LEAD_MESSAGES.wrongType],
    ['ownerId', { ownerId: {} }, ZAP_LEAD_MESSAGES.wrongType],
    ['minor', { minor: 'sim' }, ZAP_LEAD_MESSAGES.minor],
    ['studentWhatsapp', { minor: { guardianName: 'Maria', studentWhatsapp: 51999 } }, ZAP_LEAD_MESSAGES.wrongType]
  ])('campo do lead errado (%s) é recusado com a mensagem certa', (field, lead, message) => {
    expect(readCreateLeadBody(corpo(lead)).refusal).toEqual(invalidData(field, message));
  });
});

describe('checkMinor: as regras do guardian.js e do sameContactPhone', () => {
  const FONE = '5511912345678';
  const menor = (extra = {}) => ({ guardianName: 'Maria Souza', relationship: 'Mãe', studentWhatsapp: null, ...extra });

  it('adulto não tem o que conferir; menor certo passa', () => {
    expect(checkMinor({ minor: null, phone: FONE })).toBeNull();
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 9 5555-4444' }), phone: FONE })).toBeNull();
  });

  it('responsável sem nome', () => {
    expect(checkMinor({ minor: menor({ guardianName: 'M' }), phone: FONE }))
      .toEqual(refusal(422, 'menor_invalido', 'Informe o nome do responsável.', { field: 'guardianName' }));
  });

  it('parentesco fora da lista do Stronilead', () => {
    expect(checkMinor({ minor: menor({ relationship: 'Madrasta' }), phone: FONE }))
      .toEqual(refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.relationship, { field: 'relationship' }));
  });

  it('WhatsApp do aluno incompleto', () => {
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 9 123' }), phone: FONE }))
      .toEqual(refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIncomplete, { field: 'studentWhatsapp' }));
  });

  it('WhatsApp do aluno igual ao da conversa, com ou sem o nono dígito', () => {
    const recusa = refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIsGuardian, { field: 'studentWhatsapp' });
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 9 1234-5678' }), phone: FONE })).toEqual(recusa);
    expect(checkMinor({ minor: menor({ studentWhatsapp: '(11) 1234-5678' }), phone: FONE })).toEqual(recusa);
  });
});

describe('checkCatalog: o que existe no Stronilead na hora do cadastro', () => {
  const lead = (extra = {}) => ({
    name: 'Mariana', source: 'WhatsApp', dor: 'Postura', modalidade: 'Pilates', funnelId: 'f-com', stage: 'Novo lead', ...extra
  });

  it('tudo no catálogo: null; modalidade é opcional', () => {
    expect(checkCatalog(lead(), CATALOGOS)).toBeNull();
    expect(checkCatalog(lead({ modalidade: null }), CATALOGOS)).toBeNull();
  });

  it('academia sem dor: sem_dor_cadastrada antes de qualquer campo', () => {
    expect(checkCatalog(lead({ source: '' }), { ...CATALOGOS, dores: [] }))
      .toEqual(refusal(422, 'sem_dor_cadastrada', ZAP_LEAD_MESSAGES.noDor));
  });

  it.each([
    ['source', 'Escolha a origem.'],
    ['dor', 'Escolha a dor ou necessidade.'],
    ['funnelId', 'Escolha o funil.'],
    ['stage', 'Escolha a etapa.']
  ])('%s em branco é campo a preencher', (field, message) => {
    expect(checkCatalog(lead({ [field]: ' ' }), CATALOGOS)).toEqual(invalidData(field, message));
  });

  it.each([
    ['source', { source: 'Facebook' }],
    ['dor', { dor: 'Ansiedade' }],
    ['modalidade', { modalidade: 'Crossfit' }],
    ['funnelId', { funnelId: 'f-ind' }],
    ['funnelId', { funnelId: 'f-vazio' }],
    ['stage', { stage: 'Interesse' }]
  ])('%s que sumiu, ou que não serve para lead novo, é catalogo_mudou', (field, extra) => {
    expect(checkCatalog(lead(extra), CATALOGOS))
      .toEqual(refusal(422, 'catalogo_mudou', ZAP_LEAD_MESSAGES.gone[field], { field }));
  });

  it('o nome vale como está gravado: com espaço a mais é outro item', () => {
    expect(checkCatalog(lead({ source: 'WhatsApp ' }), CATALOGOS))
      .toEqual(refusal(422, 'catalogo_mudou', ZAP_LEAD_MESSAGES.gone.source, { field: 'source' }));
  });
});

describe('resolveOwner: o dono do lead', () => {
  const EQUIPE = [ANA, BRUNO, JOHNNY, BIA];

  it('sem escolha, ou escolhendo a si mesmo: quem cadastra', () => {
    expect(resolveOwner({ actor: ANA, ownerId: null, team: EQUIPE })).toEqual({ owner: ANA });
    expect(resolveOwner({ actor: ANA, ownerId: 'u-ana', team: EQUIPE })).toEqual({ owner: ANA });
  });

  it('consultor não passa o lead para outra pessoa', () => {
    expect(resolveOwner({ actor: ANA, ownerId: 'u-bruno', team: EQUIPE }))
      .toEqual({ refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.onlyManagerPicks) });
  });

  it('gestor escolhe alguém da equipe com login', () => {
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-bruno', team: EQUIPE })).toEqual({ owner: BRUNO });
  });

  it('quem saiu da equipe, ou nunca entrou, não pode ser dono', () => {
    const recusa = { refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.ownerGone) };
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-saiu', team: EQUIPE })).toEqual(recusa);
    expect(resolveOwner({ actor: JOHNNY, ownerId: 'u-bia', team: EQUIPE })).toEqual(recusa);
  });
});

describe('mesmo aluno e chave do WhatsApp do aluno', () => {
  it('mesmo nome sem acento, sem caixa e sem espaço a mais', () => {
    expect(sameStudentName('Pedro Souza', '  pedro   SOUZA ')).toBe(true);
    expect(sameStudentName('Pédro Souza', 'Pedro Souza')).toBe(true);
    expect(sameStudentName('Pedro Souza', 'Ana Souza')).toBe(false);
    expect(sameStudentName('', '')).toBe(false);
  });

  it('studentKey: a chave do Zap do WhatsApp do aluno, ou null', () => {
    expect(studentKey({ studentWhatsapp: '(11) 9 5555-4444' })).toBe('1155554444');
    expect(studentKey({ studentWhatsapp: '(11) 8555-4444' })).toBe('1185554444');
    expect(studentKey({ studentWhatsapp: null })).toBeNull();
    expect(studentKey(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapLead.test.js`
Expected: `Tests  41 failed | 22 passed (63)`: os testes novos falham (`TypeError: readCreateLeadBody is not a function`, `checkMinor is not a function` e parecidos), e os 22 do Task 6 passam.

- [ ] **Step 3: Implementar em `api/_zapLead.js`**

Trocar o bloco de imports do topo por:

```js
import { GUARDIAN_RELATIONSHIPS, guardianIssue } from '../src/lib/guardian.js';
import { sameContactPhone } from '../src/lib/leadDerived.js';
import { formatPhone } from '../src/lib/masks.js';
import { normalize } from '../src/lib/globalSearch.js';
import { leadEntryFunnels } from '../src/lib/newLead.js';
import { pickDefaultFunnel } from './_referral.js';
import { nationalPhoneDigits, zapMatchKey } from './_zapPhone.js';
```

Logo abaixo de `const NAME_MAX = 120;`, acrescentar:

```js
const CHANNEL_MAX = 80;
```

E acrescentar no fim do arquivo:

```js

// ---------------------------------------------------------------------------
// Pedido de cadastro e conferências
// ---------------------------------------------------------------------------

const textOrEmpty = (v) => (typeof v === 'string' ? v : '');
const isBlank = (v) => !v || !v.trim();

// Lê o corpo do create-lead. Só o formato: o que depende da academia (equipe,
// catálogos, duplicado) é conferido depois. Devolve { value } ou { refusal }.
// O telefone sai normalizado (sem o 55 e com o nono dígito), e é dele que sai
// a chave do duplicado. Os nomes de catálogo vão como vieram, porque são
// comparados com o gravado.
export function readCreateLeadBody(body) {
  const phone = nationalDigits(body?.phone);
  if (!phone) return { refusal: invalidData('phone', ZAP_LEAD_MESSAGES.phone) };
  const email = emailFromActor(body?.actor);
  if (!email) return { refusal: invalidData('actor', ZAP_LEAD_MESSAGES.actor) };
  const channel = body.channelName;
  if (channel != null && typeof channel !== 'string') {
    return { refusal: invalidData('channelName', ZAP_LEAD_MESSAGES.channelName) };
  }
  const lead = body.lead;
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) {
    return { refusal: invalidData('lead', ZAP_LEAD_MESSAGES.lead) };
  }
  const name = textOrEmpty(lead.name).trim();
  if (name.length < 2) return { refusal: invalidData('name', ZAP_LEAD_MESSAGES.nameShort) };
  if (name.length > NAME_MAX) return { refusal: invalidData('name', ZAP_LEAD_MESSAGES.nameLong) };
  for (const field of ['source', 'dor', 'modalidade', 'funnelId', 'stage', 'ownerId']) {
    if (lead[field] != null && typeof lead[field] !== 'string') {
      return { refusal: invalidData(field, ZAP_LEAD_MESSAGES.wrongType) };
    }
  }
  let minor = null;
  if (lead.minor) {
    const m = lead.minor;
    if (typeof m !== 'object' || Array.isArray(m)) return { refusal: invalidData('minor', ZAP_LEAD_MESSAGES.minor) };
    for (const field of ['guardianName', 'relationship', 'studentWhatsapp']) {
      if (m[field] != null && typeof m[field] !== 'string') {
        return { refusal: invalidData(field, ZAP_LEAD_MESSAGES.wrongType) };
      }
    }
    minor = {
      guardianName: textOrEmpty(m.guardianName).trim(),
      relationship: textOrEmpty(m.relationship).trim() || null,
      studentWhatsapp: textOrEmpty(m.studentWhatsapp).trim() || null
    };
  }
  const actorName = textOrEmpty(body.actor.name).trim().slice(0, NAME_MAX);
  return {
    value: {
      phone,
      matchKey: zapMatchKey(phone),
      email,
      actorName: actorName || null,
      channelName: textOrEmpty(channel).trim().slice(0, CHANNEL_MAX) || null,
      lead: {
        name,
        source: textOrEmpty(lead.source),
        dor: textOrEmpty(lead.dor),
        modalidade: isBlank(lead.modalidade) ? null : lead.modalidade,
        funnelId: textOrEmpty(lead.funnelId),
        stage: textOrEmpty(lead.stage),
        ownerId: textOrEmpty(lead.ownerId).trim() || null,
        minor
      }
    }
  };
}

// Regras do menor: as do guardian.js, com o número da conversa como telefone
// do responsável, mais o sameContactPhone no WhatsApp do aluno.
export function checkMinor({ minor, phone }) {
  if (!minor) return null;
  const problem = guardianIssue({ isMinor: true, name: minor.guardianName, phone, birthDate: null });
  if (problem) return refusal(422, 'menor_invalido', problem, { field: 'guardianName' });
  if (minor.relationship && !GUARDIAN_RELATIONSHIPS.includes(minor.relationship)) {
    return refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.relationship, { field: 'relationship' });
  }
  if (minor.studentWhatsapp) {
    if (!nationalDigits(minor.studentWhatsapp)) {
      return refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIncomplete, { field: 'studentWhatsapp' });
    }
    if (sameContactPhone(minor.studentWhatsapp, phone)) {
      return refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentIsGuardian, { field: 'studentWhatsapp' });
    }
  }
  return null;
}

// Origem, dor, modalidade, funil e etapa conferidos contra o que existe agora.
// Academia sem dor não cadastra, a mesma trava do Novo lead.
export function checkCatalog(lead, catalogs) {
  const view = catalogView(catalogs);
  if (view.dores.length === 0) return refusal(422, 'sem_dor_cadastrada', ZAP_LEAD_MESSAGES.noDor);
  const gone = (field) => refusal(422, 'catalogo_mudou', ZAP_LEAD_MESSAGES.gone[field], { field });
  if (isBlank(lead.source)) return invalidData('source', ZAP_LEAD_MESSAGES.pick.source);
  if (!view.sources.includes(lead.source)) return gone('source');
  if (isBlank(lead.dor)) return invalidData('dor', ZAP_LEAD_MESSAGES.pick.dor);
  if (!view.dores.includes(lead.dor)) return gone('dor');
  if (lead.modalidade && !view.modalities.includes(lead.modalidade)) return gone('modalidade');
  if (isBlank(lead.funnelId)) return invalidData('funnelId', ZAP_LEAD_MESSAGES.pick.funnelId);
  const funnel = view.funnels.find((f) => f.id === lead.funnelId);
  if (!funnel) return gone('funnelId');
  if (isBlank(lead.stage)) return invalidData('stage', ZAP_LEAD_MESSAGES.pick.stage);
  if (!funnel.stages.includes(lead.stage)) return gone('stage');
  return null;
}

// Dono do lead: quem cadastra, ou quem o gestor escolheu. Consultor não passa
// o lead para outra pessoa, e o escolhido precisa estar na equipe com login.
export function resolveOwner({ actor, ownerId, team }) {
  if (!ownerId || ownerId === actor.id) return { owner: actor };
  if (teamRole(actor) !== 'gestor') {
    return { refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.onlyManagerPicks) };
  }
  const owner = (team || []).find((u) => u.id === ownerId && u.authUid);
  return owner ? { owner } : { refusal: refusal(422, 'responsavel_invalido', ZAP_LEAD_MESSAGES.ownerGone) };
}

// O mesmo aluno: nome sem acento, sem caixa e sem espaço a mais.
const nameKey = (name) => normalize(name).trim().replace(/\s+/g, ' ');
export const sameStudentName = (a, b) => nameKey(a) !== '' && nameKey(a) === nameKey(b);

// Chave do Zap do WhatsApp do aluno, quando ele tem um, tirada do número já
// normalizado, como a do número da conversa.
export const studentKey = (minor) => (minor?.studentWhatsapp ? zapMatchKey(nationalDigits(minor.studentWhatsapp)) : null);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapLead.test.js && npx eslint api/_zapLead.js api/__tests__/zapLead.test.js`
Expected: `Tests  63 passed (63)` e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/_zapLead.js api/__tests__/zapLead.test.js
git commit -m "feat: conferências do cadastro pelo Stronizap (formato, menor, catálogos e dono)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Regras da ponte, parte 3: o que é gravado e o que é respondido

**Files:**
- Modify: `api/_zapLead.js`
- Modify: `src/lib/__tests__/newLeadSweep.test.js`, `src/lib/__tests__/newLeadImports.test.js`
- Test: `api/__tests__/zapLead.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `api/__tests__/zapLead.test.js`, trocar o import de `../_zapLead.js` por:

```js
import {
  ZAP_LEAD_MESSAGES, LEAD_CREATE_LIMIT, refusal, invalidData, tenantBlocked, nationalDigits, whatsappFromZap,
  emailFromActor, findTeamMember, teamRole, catalogView, buildLeadOptions,
  readCreateLeadBody, checkMinor, checkCatalog, resolveOwner, sameStudentName, studentKey,
  zapSignupText, buildZapLead, buildZapSignupInteraction, alreadyRegisteredBody, scrubbedError
} from '../_zapLead.js';
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
```

E acrescentar no fim do arquivo:

```js
describe('zapSignupText: o texto que qualquer tela entende', () => {
  it('com consultor responsável e canal', () => {
    expect(zapSignupText({ actorName: 'Johnny', ownerName: 'Ana Souza', channelName: 'Recepção' }))
      .toBe('Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.');
  });

  it('quem cadastrou ficou com o lead: sem a parte do consultor responsável', () => {
    expect(zapSignupText({ actorName: 'Ana Souza', channelName: 'Recepção' }))
      .toBe('Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.');
  });

  it('sem canal e sem nome', () => {
    expect(zapSignupText({ actorName: null })).toBe('Cadastrado pelo Stronizap.');
  });
});

describe('buildZapLead: o montador do Novo lead mais as diferenças da ponte', () => {
  const HORA = { horaDoServidor: true };
  const LEAD = {
    name: 'Mariana Souza', source: 'WhatsApp', dor: 'Postura', modalidade: 'Pilates',
    funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null
  };

  it('adulto: o número da conversa no formato do Novo lead e o marco já contado', () => {
    expect(buildZapLead({ lead: LEAD, phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA })).toEqual({
      ...buildNewLeadDoc(
        { name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', source: 'WhatsApp', funnelId: 'f-com', status: 'Novo lead', dor: 'Postura', modalidade: 'Pilates' },
        { owner: ANA }
      ),
      createdAt: HORA,
      statusEnteredAt: HORA,
      lastInteractionAt: HORA,
      interactionsCount: 1
    });
  });

  it('dono escolhido pelo gestor: o aviso de troca que acende o sino', () => {
    expect(buildZapLead({ lead: LEAD, phone: '5551998124471', actor: JOHNNY, owner: BRUNO, serverTime: HORA })).toMatchObject({
      consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno',
      consultantChangedAt: HORA, consultantChangedByName: 'Johnny', consultantChangedByAuthUid: 'auth-johnny'
    });
  });

  it('quem cadastrou ficou com o lead: sem aviso de troca', () => {
    const doc = buildZapLead({ lead: LEAD, phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA });
    expect('consultantChangedAt' in doc).toBe(false);
  });

  it('menor: o número da conversa vira o telefone do responsável', () => {
    const doc = buildZapLead({
      lead: { ...LEAD, name: 'Pedro Souza', minor: { guardianName: 'Mariana Souza', relationship: 'Mãe', studentWhatsapp: null } },
      phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA
    });
    expect(doc).toMatchObject({
      name: 'Pedro Souza', whatsapp: '', zapMatchKey: null, isMinor: true,
      guardian: { name: 'Mariana Souza', phone: '(51) 9 9812-4471', relationship: 'Mãe' },
      guardianZapMatchKey: '5198124471'
    });
  });

  it('número antigo, sem o nono dígito: o lead e o responsável ganham o 9', () => {
    expect(buildZapLead({ lead: LEAD, phone: '555181244710', actor: ANA, owner: ANA, serverTime: HORA }))
      .toMatchObject({ whatsapp: '(51) 9 8124-4710', whatsappDigits: '51981244710', zapMatchKey: '5181244710' });
    const menor = buildZapLead({
      lead: { ...LEAD, name: 'Pedro Souza', minor: { guardianName: 'Mariana Souza', relationship: null, studentWhatsapp: '(51) 8555-4444' } },
      phone: '555181244710', actor: ANA, owner: ANA, serverTime: HORA
    });
    expect(menor.guardian.phone).toBe('(51) 9 8124-4710');
    expect(menor.guardianZapMatchKey).toBe('5181244710');
    expect(menor.whatsapp).toBe('(51) 9 8555-4444');
  });

  it('menor com WhatsApp próprio: o número do aluno vai para o lead', () => {
    const doc = buildZapLead({
      lead: { ...LEAD, name: 'Pedro Souza', minor: { guardianName: 'Mariana Souza', relationship: null, studentWhatsapp: '11955554444' } },
      phone: '5551998124471', actor: ANA, owner: ANA, serverTime: HORA
    });
    expect(doc).toMatchObject({ whatsapp: '(11) 9 5555-4444', zapMatchKey: '1155554444', guardian: { relationship: null } });
  });
});

describe('buildZapSignupInteraction: o marco de início', () => {
  const HORA = { horaDoServidor: true };

  it('quem cadastrou ficou com o lead', () => {
    expect(buildZapSignupInteraction({ leadId: 'L1', leadName: 'Mariana Souza', actor: ANA, owner: ANA, channelName: 'Recepção', serverTime: HORA })).toEqual({
      leadId: 'L1',
      leadName: 'Mariana Souza',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      type: 'zap_signup',
      text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.',
      zapChannelName: 'Recepção',
      createdAt: HORA
    });
  });

  it('gestor passou para outra pessoa: o dono nos campos de segurança e no ownerName', () => {
    const marco = buildZapSignupInteraction({ leadId: 'L1', leadName: 'Mariana Souza', actor: JOHNNY, owner: BRUNO, channelName: null, serverTime: HORA });
    expect(marco).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny',
      leadConsultantId: 'u-bruno', leadConsultantAuthUid: 'auth-bruno', ownerName: 'Bruno Lima',
      zapChannelName: null, text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Bruno Lima.'
    });
    expect('volumeKind' in marco).toBe(false);
  });
});

describe('alreadyRegisteredBody: a resposta 409', () => {
  const CARD = { found: true, leadId: 'x' };
  const cincoMinutos = new Date(HOJE.getTime() - 5 * 60000);

  it('cadastro antigo', () => {
    expect(alreadyRegisteredBody({ repeated: { name: 'Mariana', consultantName: 'Bruno Lima', createdAt: antes(2) }, card: CARD, now: HOJE })).toEqual({
      error: 'ja_cadastrado', card: CARD, createdAt: antes(2).toISOString(), message: 'Esse número já estava no Stronilead.'
    });
  });

  it('menos de 10 minutos: diz quem cuida, quando tem dono', () => {
    expect(alreadyRegisteredBody({ repeated: { consultantName: 'Bruno Lima', createdAt: ts(cincoMinutos) }, card: CARD, now: HOJE }).message)
      .toBe('Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.');
    expect(alreadyRegisteredBody({ repeated: { createdAt: cincoMinutos }, card: CARD, now: HOJE }).message)
      .toBe('Esse número foi cadastrado há pouco.');
  });

  it('menor: fala do aluno com esse responsável', () => {
    expect(alreadyRegisteredBody({ repeated: { name: 'Pedro Souza', consultantName: 'Bruno Lima', createdAt: cincoMinutos }, card: CARD, minor: true, now: HOJE }).message)
      .toBe('O cadastro de Pedro Souza com esse responsável foi feito há pouco. Quem cuida é Bruno Lima.');
    expect(alreadyRegisteredBody({ repeated: { name: 'Pedro Souza', createdAt: antes(30) }, card: CARD, minor: true, now: HOJE }).message)
      .toBe('Pedro Souza já tem cadastro no Stronilead com esse responsável.');
  });

  it('sem data de cadastro: createdAt null e o texto de cadastro antigo', () => {
    expect(alreadyRegisteredBody({ repeated: {}, card: CARD, now: HOJE }))
      .toMatchObject({ createdAt: null, message: 'Esse número já estava no Stronilead.' });
  });
});

describe('scrubbedError: erro inesperado sem dado pessoal', () => {
  it('troca a mensagem pelo código e guarda a pilha', () => {
    const original = Object.assign(new Error('9 FAILED_PRECONDITION: zapMatchKey == 5198124471'), { code: 9 });
    const limpo = scrubbedError('create-lead', original);
    expect(limpo.message).toBe('zap create-lead falhou (9)');
    expect(limpo.stack).not.toContain('5198124471');
    expect(limpo.stack).toMatch(/\n\s+at /);
  });

  it('erro sem código leva o nome do erro', () => {
    expect(scrubbedError('lead-options', new TypeError('x is not a function')).message)
      .toBe('zap lead-options falhou (TypeError)');
  });
});

describe('textos da tela', () => {
  it('nenhum texto tem travessão', () => {
    const textos = [];
    const coletar = (v) => {
      if (typeof v === 'string') textos.push(v);
      else if (typeof v === 'function') textos.push(v('pessoa@exemplo.com'));
      else if (v && typeof v === 'object') Object.values(v).forEach(coletar);
    };
    coletar(ZAP_LEAD_MESSAGES);
    expect(textos.length).toBeGreaterThan(20);
    expect(textos.filter((t) => t.includes('\u2014'))).toEqual([]);
  });
});
```

Em `src/lib/__tests__/newLeadSweep.test.js`, dentro do `describe`, logo depois do teste do Novo lead, acrescentar:

```js

  it('a ponte monta o lead novo pelo mesmo montador', () => {
    const ponte = ler('../../../api/_zapLead.js');
    expect(ponte).toMatch(/\.\.\.buildNewLeadDoc\(/);
    expect(ponte).not.toMatch(/buildLeadSearchFields|buildGuardianPatch|getLeadOwnershipFields|deriveLeadBucket/);
  });
```

Em `src/lib/__tests__/newLeadImports.test.js`, dentro do `describe`, logo depois do primeiro teste, acrescentar:

```js

  it('as regras do cadastro pelo Stronizap (api/_zapLead.js) também não', () => {
    const { arquivos, pacotes } = grafoDe(doRepo('api/_zapLead.js'));
    expect(arquivos).toContain('src/lib/newLead.js');
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx'))).toEqual([]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapLead.test.js src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js`
Expected: FAIL nos testes novos (`zapSignupText is not a function`, `buildZapLead is not a function` e parecidos; a varredura da ponte não acha `...buildNewLeadDoc(`; o grafo de `api/_zapLead.js` ainda não chega a `newLead.js` pelo montador, mas já chega pelo `leadEntryFunnels`, então esse teste pode passar desde já).

- [ ] **Step 3: Implementar em `api/_zapLead.js`**

Trocar o bloco de imports do topo por:

```js
import { GUARDIAN_RELATIONSHIPS, guardianIssue } from '../src/lib/guardian.js';
import { sameContactPhone } from '../src/lib/leadDerived.js';
import { getInteractionSecurityFields, ZAP_SIGNUP_TYPE } from '../src/lib/leads.js';
import { formatPhone } from '../src/lib/masks.js';
import { normalize } from '../src/lib/globalSearch.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { buildNewLeadDoc, leadEntryFunnels } from '../src/lib/newLead.js';
import { pickDefaultFunnel } from './_referral.js';
import { nationalPhoneDigits, zapMatchKey } from './_zapPhone.js';
```

Logo abaixo de `const CHANNEL_MAX = 80;`, acrescentar:

```js
// Cadastro mais novo que isto aparece como "cadastrado há pouco".
const RECENT_MS = 10 * MINUTE_MS;
```

E acrescentar no fim do arquivo:

```js

// ---------------------------------------------------------------------------
// O que é gravado e o que é respondido
// ---------------------------------------------------------------------------

// O `text` do marco, para qualquer tela que ainda não conheça o tipo.
export function zapSignupText({ actorName, ownerName = null, channelName = null }) {
  return [
    actorName ? `Cadastrado pelo Stronizap por ${actorName}.` : 'Cadastrado pelo Stronizap.',
    ownerName ? `Consultor responsável: ${ownerName}.` : null,
    channelName ? `Canal ${channelName}.` : null
  ].filter(Boolean).join(' ');
}

// O lead novo do Stronizap. O corpo sai do mesmo montador do Novo lead; aqui
// entram só as diferenças da ponte: as datas do servidor, o marco de início
// já contado (lastInteractionAt e interactionsCount: 1, como no cadastro com
// observação e no link de indicação) e o aviso de troca de dono quando o
// gestor escolheu outra pessoa, que acende o "passado para você" no sino.
export function buildZapLead({ lead, phone, actor, owner, serverTime }) {
  const conversa = whatsappFromZap(phone);
  const form = {
    name: lead.name,
    source: lead.source,
    funnelId: lead.funnelId,
    status: lead.stage,
    dor: lead.dor,
    modalidade: lead.modalidade || '',
    ...(lead.minor
      ? {
          whatsapp: lead.minor.studentWhatsapp ? whatsappFromZap(lead.minor.studentWhatsapp) : '',
          isMinor: true,
          guardianName: lead.minor.guardianName,
          guardianPhone: conversa,
          guardianRelation: lead.minor.relationship || ''
        }
      : { whatsapp: conversa })
  };
  const doc = {
    ...buildNewLeadDoc(form, { owner }),
    createdAt: serverTime,
    statusEnteredAt: serverTime,
    lastInteractionAt: serverTime,
    interactionsCount: 1
  };
  if (owner.id !== actor.id) {
    doc.consultantChangedAt = serverTime;
    doc.consultantChangedByName = actor.name ?? null;
    doc.consultantChangedByAuthUid = actor.authUid ?? null;
  }
  return doc;
}

// O marco de início (type zap_signup). O autor na linha do tempo é quem
// cadastrou (consultantName); o dono do lead vai nos campos de segurança de
// sempre, e o ownerName só quando é outra pessoa. Sem volumeKind: o lead conta
// na prospecção do dono pelo próprio lead, como no Novo lead.
export function buildZapSignupInteraction({ leadId, leadName, actor, owner, channelName = null, serverTime }) {
  const otherOwner = owner.id !== actor.id;
  return {
    leadId,
    leadName: leadName || null,
    consultantName: actor.name ?? null,
    ...getInteractionSecurityFields({ consultantId: owner.id, consultantAuthUid: owner.authUid }, actor),
    actorId: actor.id,
    actorAuthUid: actor.authUid ?? null,
    type: ZAP_SIGNUP_TYPE,
    text: zapSignupText({ actorName: actor.name, ownerName: otherOwner ? owner.name : null, channelName }),
    ...(otherOwner ? { ownerName: owner.name ?? null } : {}),
    zapChannelName: channelName || null,
    createdAt: serverTime
  };
}

// Resposta 409: o cartão do número, a data do cadastro que já existia e o
// texto da tela. "Há pouco" é menos de 10 minutos: foi outra pessoa, ou o
// mesmo cadastro que teve a resposta perdida.
export function alreadyRegisteredBody({ repeated, card, minor = false, now = new Date() }) {
  const created = getSafeDateOrNull(repeated?.createdAt);
  const recent = Boolean(created) && now.getTime() - created.getTime() < RECENT_MS;
  const who = repeated?.consultantName ? ` Quem cuida é ${repeated.consultantName}.` : '';
  const student = repeated?.name || 'Esse aluno';
  let message;
  if (minor) {
    message = recent
      ? `O cadastro de ${student} com esse responsável foi feito há pouco.${who}`
      : `${student} já tem cadastro no Stronilead com esse responsável.`;
  } else {
    message = recent ? `Esse número foi cadastrado há pouco.${who}` : 'Esse número já estava no Stronilead.';
  }
  return { error: 'ja_cadastrado', card, createdAt: created ? created.toISOString() : null, message };
}

// Erro inesperado sem dado pessoal. A mensagem do Firestore pode trazer o
// valor da consulta (o telefone), então ela não sobe: vai o código, ou o nome
// do erro. A pilha fica, porque aponta arquivo e linha sem carregar dado.
export function scrubbedError(action, err) {
  const code = err?.code ?? err?.name ?? 'sem código';
  const clean = new Error(`zap ${action} falhou (${code})`);
  const frames = String(err?.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line));
  if (frames.length > 0) clean.stack = [`Error: ${clean.message}`, ...frames].join('\n');
  return clean;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapLead.test.js src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js && npx eslint api/_zapLead.js api/__tests__/zapLead.test.js src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js`
Expected: `zapLead.test.js` com 81, a varredura e o grafo com 2 cada, e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/_zapLead.js api/__tests__/zapLead.test.js src/lib/__tests__/newLeadSweep.test.js src/lib/__tests__/newLeadImports.test.js
git commit -m "feat: lead, marco de início e respostas do cadastro pelo Stronizap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Banco falso da rota com transação, equipe e catálogos, em UTC

**Files:**
- Modify: `api/__tests__/zapRoute.test.js:1-84`, `:123-133`, `:161`

Só a infraestrutura de teste: os 45 testes que existem têm de continuar verdes, e entra um que confere o UTC.

- [ ] **Step 1: Trocar o topo do arquivo**

Trocar das linhas 1 a 84 (do `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';` até o fim do `vi.mock('../_auth.js', ...)`) por:

```js
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

// A rota roda numa função da Vercel, com o processo em UTC (lá o TZ é variável
// reservada). A máquina de desenvolvimento fica em Brasília, e teste no fuso
// dela esconde defeito de fuso. Por isso o processo vai para UTC antes de
// importar a rota, como em zapFuso.test.js (PR #227).
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { generateZapKey } from '../_zapAuth.js';
import { zapMatchKey } from '../_zapPhone.js';
import handler from '../zap.js';

// A rota inteira, com o Firestore trocado por um banco em memória.
//
// O banco falso imita o SDK de SERVIDOR (firebase-admin), não o do navegador:
// aqui `snap.exists` é propriedade booleana, e chamar `snap.exists()` estoura
// TypeError, igual em produção. Em src/ é o contrário (`exists()` é função),
// e foi essa troca que derrubou o cartão do Zap em 2026-09-10 para todo
// contato cadastrado. Um fake com `exists` como função teria aprovado o erro.
//
// Ele também recusa o que o Firestore real recusa: id de documento que não é
// texto, vazio ou com barra, consulta `in` com 0 ou mais de 30 valores,
// leitura depois de escrita dentro da transação, create de documento que já
// existe e update de documento que não existe. O `select` devolve só os
// campos pedidos. Um fake mais tolerante que produção deixa passar
// exatamente o erro que importa. E tudo fica guardado por academia, para dar
// para provar que a chave de uma não lê a outra.
const banco = vi.hoisted(() => ({
  tenants: {}, leads: {}, config: {}, users: {}, catalogos: {}, interacoes: {},
  gravacoes: [], falhaEm: null, ultimoId: 0
}));
// Quem está logado no CRM (verifyRequest), se é admin (isTenantAdmin) e
// quantas vezes o caminho do login foi consultado.
const sessao = vi.hoisted(() => ({ auth: null, admin: false, consultasDoLogin: 0 }));
// O limitador por academia (api/_rateLimit.js): o que ele responde e com que
// chave foi chamado.
const limitador = vi.hoisted(() => ({ ok: true, chamadas: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  // Hora do servidor. Na gravação vira um Timestamp falso, com toDate(), como
  // o documento volta do Firestore depois do commit.
  const HORA_DO_SERVIDOR = Object.freeze({ horaDoServidor: true });
  const gravado = (dados) => {
    const instante = new Date();
    return Object.fromEntries(Object.entries(dados).map(([k, v]) =>
      [k, v === HORA_DO_SERVIDOR ? { toDate: () => instante } : v]));
  };

  const snapshot = (dados) => ({ exists: dados != null, data: () => dados ?? undefined });

  const idValido = (id) => typeof id === 'string' && id.length > 0 && !id.includes('/');

  // A lista em memória de cada coleção da academia
  // (artifacts/{academia}/public/data/{coleção}).
  const LISTAS = { stronix_leads: 'leads', stronix_users: 'users', stronix_interactions: 'interacoes' };
  const CATALOGOS = ['stronix_sources', 'stronix_dores', 'stronix_modalities', 'stronix_funnels', 'stronix_statuses'];
  const listaDe = (caminho, criar = false) => {
    const [raiz, academia, , , nome] = caminho;
    if (raiz === 'artifacts' && caminho.length === 5) {
      if (LISTAS[nome]) {
        const porAcademia = banco[LISTAS[nome]];
        if (criar && !porAcademia[academia]) porAcademia[academia] = [];
        return porAcademia[academia] ?? [];
      }
      if (CATALOGOS.includes(nome)) return banco.catalogos[academia]?.[nome] ?? [];
    }
    throw new Error(`coleção sem fixture no teste: ${caminho.join('/')}`);
  };

  // `campos` imita o select(): o documento volta só com os campos pedidos.
  const consulta = (linhas, campos = null) => {
    const docs = linhas.map(({ id, ...dados }) => {
      const visiveis = campos ? Object.fromEntries(campos.map((c) => [c, dados[c]])) : dados;
      return { id, data: () => visiveis };
    });
    return { empty: docs.length === 0, docs };
  };

  const documento = (caminho) => {
    if (caminho[0] === 'tenants') return snapshot(banco.tenants[caminho[1]]);
    if (caminho.at(-2) === 'stronix_config') return snapshot(banco.config[caminho[1]]);
    throw new Error(`caminho sem fixture no teste: ${caminho.join('/')}`);
  };

  // Escritas da transação. create recusa documento que já existe e update
  // recusa documento que não existe, como o Firestore.
  const existe = (caminho) => listaDe(caminho.slice(0, -1)).some((l) => l.id === caminho.at(-1));
  const conferir = ({ tipo, caminho }) => {
    if (tipo === 'create' && existe(caminho)) throw Object.assign(new Error('6 ALREADY_EXISTS'), { code: 6 });
    if (tipo === 'update' && !existe(caminho)) throw Object.assign(new Error('5 NOT_FOUND'), { code: 5 });
  };
  const aplicar = ({ tipo, caminho, dados }) => {
    const lista = listaDe(caminho.slice(0, -1), true);
    const id = caminho.at(-1);
    const i = lista.findIndex((l) => l.id === id);
    if (tipo === 'update') lista[i] = { ...lista[i], ...gravado(dados) };
    else if (i >= 0) lista[i] = { id, ...gravado(dados) };
    else lista.push({ id, ...gravado(dados) });
    banco.gravacoes.push({ caminho: caminho.join('/'), dados, tipo });
  };

  const ref = (caminho) => ({
    id: caminho.at(-1),
    caminho,
    collection: (nome) => ref([...caminho, nome]),
    // Sem argumento, o id é gerado, como o doc() do SDK.
    doc: (...args) => {
      if (args.length === 0) {
        banco.ultimoId += 1;
        return ref([...caminho, `auto-${banco.ultimoId}`]);
      }
      const [id] = args;
      if (!idValido(id)) throw new Error(`id de documento inválido: ${String(id)}`);
      return ref([...caminho, id]);
    },
    where: (campo, op, valor) => {
      const linhas = () => {
        // Simula a consulta recusada pelo Firestore (índice desligado no
        // console, por exemplo) só no campo que o teste pediu. Igual ao SDK de
        // servidor: código gRPC numérico (9 é FAILED_PRECONDITION) e o valor
        // da consulta dentro da mensagem.
        if (banco.falhaEm === campo) {
          throw Object.assign(new Error(`9 FAILED_PRECONDITION: consulta em ${campo} == ${valor} recusada`), { code: 9 });
        }
        if (op === 'in' && (!Array.isArray(valor) || valor.length === 0 || valor.length > 30)) {
          throw new Error(`consulta in com ${Array.isArray(valor) ? valor.length : 0} valores`);
        }
        return listaDe(caminho).filter((l) => (op === 'in' ? valor.includes(l[campo]) : l[campo] === valor));
      };
      return {
        limit: (n) => ({ get: async () => consulta(linhas().slice(0, n)) }),
        select: (...campos) => ({ get: async () => consulta(linhas(), campos) }),
        get: async () => consulta(linhas())
      };
    },
    // Coleção (caminho de tamanho ímpar) devolve a lista; documento, o snapshot.
    get: async () => (caminho.length % 2 === 1 ? consulta(listaDe(caminho)) : documento(caminho)),
    set: async (dados, opcoes) => {
      banco.gravacoes.push({ caminho: caminho.join('/'), dados, opcoes });
    }
  });

  // Uma transação de cada vez, em fila: é o efeito do isolamento serializável
  // do Firestore. As escritas só valem juntas, no fim, e só se nenhuma for
  // recusada. Não existe `add` numa transação: o documento novo sai de
  // collection.doc() e é gravado com create.
  let fila = Promise.resolve();
  const runTransaction = (fn) => {
    const vez = fila.then(async () => {
      const escritas = [];
      const tx = {};
      const escrever = (tipo) => (alvo, dados) => { escritas.push({ tipo, caminho: alvo.caminho, dados }); return tx; };
      Object.assign(tx, {
        get: async (alvo) => {
          if (escritas.length > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return alvo.get();
        },
        create: escrever('create'),
        set: escrever('set'),
        update: escrever('update')
      });
      const resultado = await fn(tx);
      escritas.forEach(conferir);
      escritas.forEach(aplicar);
      return resultado;
    });
    fila = vez.catch(() => {});
    return vez;
  };

  const adminDb = ref([]);
  adminDb.runTransaction = runTransaction;

  return {
    adminDb,
    adminAuth: {},
    admin: { firestore: { FieldValue: { serverTimestamp: () => HORA_DO_SERVIDOR } } },
    verifyRequest: async () => {
      sessao.consultasDoLogin += 1;
      return sessao.auth;
    }
  };
});

vi.mock('../_auth.js', () => ({
  isTenantAdmin: async () => sessao.admin
}));

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async (chave, opcoes) => {
    limitador.chamadas.push({ chave, opcoes });
    return limitador.ok ? { ok: true } : { ok: false, retryAfterMs: 60000 };
  },
  clientIp: () => '127.0.0.1'
}));

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});
```

- [ ] **Step 2: `zerarBanco` limpa o que é novo**

Trocar a função `zerarBanco` (linhas 125 a 133):

```js
function zerarBanco() {
  banco.tenants = {};
  banco.leads = {};
  banco.config = {};
  banco.gravacoes = [];
  banco.falhaEm = null;
  sessao.auth = null;
  sessao.admin = false;
}
```

por:

```js
function zerarBanco() {
  banco.tenants = {};
  banco.leads = {};
  banco.config = {};
  banco.users = {};
  banco.catalogos = {};
  banco.interacoes = {};
  banco.gravacoes = [];
  banco.falhaEm = null;
  banco.ultimoId = 0;
  sessao.auth = null;
  sessao.admin = false;
  sessao.consultasDoLogin = 0;
  limitador.ok = true;
  limitador.chamadas = [];
}
```

- [ ] **Step 3: Teste que confere o UTC**

Logo antes de `describe('GET /api/zap', () => {` (linha 161), acrescentar:

```js
describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/__tests__/zapRoute.test.js`
Expected: `Tests  46 passed (46)` (os 45 de antes mais o do UTC) e lint sem erro.

- [ ] **Step 5: Commit**

```bash
git add api/__tests__/zapRoute.test.js
git commit -m "test: banco falso da rota do Zap com transação, equipe e catálogos, em UTC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rota: cartão reaproveitável e academia inteira na autenticação

**Files:**
- Modify: `api/zap.js:58-69`, `:107-153`

Refatoração sem mudança de comportamento: o cadastro vai responder com o mesmo cartão do `GET` (`cardFor`) e precisa do documento da academia inteiro para conferir se ela está ativa (`loadZapTenant`).

- [ ] **Step 1: Coleção da academia, `loadZapTenant` e `cardFor`**

Trocar as linhas 58 a 69:

```js
const leadsCollection = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(LEADS_PATH);

// Integração do tenant, ou null quando o tenant não existe, nunca gerou chave
// (sem keyHash) ou teve a chave revogada.
async function loadZapIntegration(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  const zap = tenantSnap.exists ? tenantSnap.data()?.integrations?.zap : null;
  if (!zap?.keyHash || zap.revokedAt) return null;
  return zap;
}
```

por:

```js
// Coleção da academia em artifacts/{academia}/public/data/{nome}.
const academyCollection = (tenantId, nome) =>
  adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(nome);

const leadsCollection = (tenantId) => academyCollection(tenantId, LEADS_PATH);

// A academia e a integração dela, ou null quando a academia não existe, nunca
// gerou chave (sem keyHash) ou teve a chave revogada. O cadastro pelo Stronizap
// precisa do documento inteiro para conferir se a academia está ativa.
async function loadZapTenant(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  const tenant = tenantSnap.exists ? tenantSnap.data() : null;
  const zap = tenant?.integrations?.zap;
  if (!zap?.keyHash || zap.revokedAt) return null;
  return { tenant, zap };
}

// Integração do tenant, ou null quando o tenant não existe, nunca gerou chave
// (sem keyHash) ou teve a chave revogada.
async function loadZapIntegration(tenantId) {
  return (await loadZapTenant(tenantId))?.zap ?? null;
}

// O cartão que o GET devolve para esta chave de telefone: o dono do número e
// os menores que o têm como responsável, ou { found: false } quando ninguém
// casa. O cadastro pelo Stronizap responde com este mesmo cartão.
async function cardFor(tenantId, matchKey) {
  // O dono do número e os menores que o têm como responsável, juntos. A busca
  // dos menores não pode derrubar o cartão do dono: se ela falhar (índice
  // desligado no console, por exemplo), o cartão sai sem os menores. O log
  // leva só o código do erro: a mensagem do Firestore pode trazer o valor da
  // consulta, que é o telefone.
  const [achados, menoresSnap] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get(),
    leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(WARDS_MAX).get()
      .catch((e) => {
        console.error('zap: busca dos menores falhou', e?.code ?? 'sem código');
        return null;
      })
  ]);
  const menoresDocs = menoresSnap ? menoresSnap.docs : [];

  const agora = new Date();
  const dono = achados.empty ? null : leadDoDoc(achados.docs[0]);
  // Só quem ainda tem o responsável como contato (menor, ou que fez 18 sem
  // WhatsApp próprio), e nunca o próprio dono do número.
  const menores = menoresDocs
    .map(leadDoDoc)
    .filter((m) => m.id !== dono?.id && contactOf(m, agora).viaGuardian);

  if (!dono && menores.length === 0) return { found: false };

  // Marcos de renovação da academia. Só lê depois de achar alguém: em
  // 'found: false' não há faixa pra montar, então não vale o custo da
  // consulta. Doc inexistente (academia nunca abriu Configurações → Metas &
  // ritmo) ou campo ausente/malformado: buildZapCard/buildZapStrip caem no
  // padrão 90/60/30 sozinhos, não precisa validar aqui.
  const configSnap = await academyCollection(tenantId, CONFIG_PATH).doc(CONFIG_GENERAL_ID).get();
  const renewalCheckpoints = configSnap.exists ? configSnap.data()?.renewalCheckpoints : undefined;

  if (!dono) return buildGuardianCard(menores, agora, renewalCheckpoints);
  const card = buildZapCard(dono, agora, renewalCheckpoints);
  if (menores.length > 0) card.wards = buildZapWards(menores, agora, renewalCheckpoints);
  return card;
}
```

- [ ] **Step 2: O `GET` usa o `cardFor`**

No `handler`, trocar tudo desde o comentário `// O dono do número e os menores que o têm como responsável, juntos. A busca` (linha 107) até o fim do handler (`res.status(200).json(card);` e `});`, linhas 152 a 154) por:

```js
  const card = await cardFor(tenantId, matchKey);
  if (!card.found) {
    res.status(200).json({ found: false });
    return;
  }

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(card);
});
```

O que vinha antes (chave, identificador, telefone e `loadZapIntegration`) não muda.

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/zap.js`
Expected: `Tests  46 passed (46)` e lint sem erro.

- [ ] **Step 4: Commit**

```bash
git add api/zap.js
git commit -m "refactor: cartão do Zap reaproveitável e academia inteira na autenticação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Ação `lead-options`

**Files:**
- Modify: `api/zap.js:1-21`, `:28-29`, `:156-162`, `:175`, fim do arquivo
- Test: `api/__tests__/zapRoute.test.js`

- [ ] **Step 1: Fixtures da equipe e dos catálogos**

Em `api/__tests__/zapRoute.test.js`, logo antes de `let chave;`, acrescentar:

```js
// Equipe da academia, como mora em stronix_users. O id é o do documento.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', email: 'bruno@stronix.com.br', authUid: 'auth-bruno', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };
// Convidada que nunca entrou no Stronilead: está na equipe, mas sem authUid.
const BIA = { id: 'u-bia', name: 'Bia Rocha', email: 'bia@stronix.com.br', role: 'consultant' };

// Catálogos da academia, no formato dos documentos. Função, porque os testes
// mexem neles.
const catalogosDaAcademia = () => ({
  stronix_sources: [{ id: 's1', name: 'Instagram' }, { id: 's2', name: 'WhatsApp' }, { id: 's3', name: 'Indicação' }],
  stronix_dores: [{ id: 'd1', name: 'Postura' }, { id: 'd2', name: 'Emagrecimento' }],
  stronix_modalities: [{ id: 'm2', name: 'Pilates', order: 2 }, { id: 'm1', name: 'Musculação', order: 1 }],
  stronix_funnels: [
    { id: 'f-com', name: 'Comercial', order: 1, isDefault: true },
    { id: 'f-kids', name: 'Kids', order: 2 },
    { id: 'f-vazio', name: 'Sem etapas', order: 3 },
    { id: 'f-ind', name: 'Indicações', order: 97, systemKind: 'referral' },
    { id: 'f-ren', name: 'Renovações', order: 98, systemKind: 'renewal' },
    { id: 'f-venc', name: 'Vencidos', order: 99, systemKind: 'expired' },
    { id: 'f-up', name: 'Upgrade', order: 100, systemKind: 'upgrade' }
  ],
  stronix_statuses: [
    { id: 'st2', funnelId: 'f-com', name: 'Primeiro contato', order: 2 },
    { id: 'st1', funnelId: 'f-com', name: 'Novo lead', order: 1 },
    { id: 'st3', funnelId: 'f-kids', name: 'Interesse', order: 1 },
    { id: 'st4', funnelId: 'f-ind', name: 'Aguardando ação', order: 1, isEntry: true },
    { id: 'st5', funnelId: 'f-venc', name: 'Aguardando contato', order: 1 }
  ]
});

```

E logo antes de `const pedido = () => ({`, acrescentar:

```js
// Academia com chave, equipe e catálogos: o cenário do cadastro pelo Stronizap.
function academiaComEquipe() {
  chave = academia(TENANT);
  banco.users[TENANT] = [ANA, BRUNO, JOHNNY, BIA];
  banco.catalogos[TENANT] = catalogosDaAcademia();
}

const pedidoOpcoes = (email = ANA.email) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: { action: 'lead-options', tenant: TENANT, actor: { email } }
});

```

- [ ] **Step 2: Escrever os testes que falham**

No fim de `api/__tests__/zapRoute.test.js`, acrescentar:

```js
describe('POST /api/zap com action lead-options', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consultora: quem ela é, as listas da academia e o padrão do Novo lead, sem a equipe', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
      sources: [{ name: 'Indicação' }, { name: 'Instagram' }, { name: 'WhatsApp' }],
      dores: [{ name: 'Emagrecimento' }, { name: 'Postura' }],
      modalities: [{ name: 'Musculação' }, { name: 'Pilates' }],
      funnels: [
        { id: 'f-com', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] },
        { id: 'f-kids', name: 'Kids', stages: [{ name: 'Interesse' }] }
      ],
      relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
      defaults: { source: 'WhatsApp', funnelId: 'f-com', stage: 'Novo lead' }
    });
    expect('team' in res.body).toBe(false);
    // Opções só leem: não gastam o limite de cadastros nem gravam nada.
    expect(limitador.chamadas).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('gestor: recebe a equipe com id e nome, sem e-mail e sem quem nunca entrou', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(JOHNNY.email), res);

    expect(res.body.actor).toEqual({ id: 'u-johnny', name: 'Johnny', role: 'gestor' });
    expect(res.body.team).toEqual([
      { id: 'u-ana', name: 'Ana Souza' },
      { id: 'u-bruno', name: 'Bruno Lima' },
      { id: 'u-johnny', name: 'Johnny' }
    ]);
    expect(JSON.stringify(res.body)).not.toContain('@');
  });

  it('e-mail com maiúsculas e espaços acha a pessoa', async () => {
    const res = resposta();

    await handler(pedidoOpcoes('  ANA@Stronix.com.br '), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.actor.id).toBe('u-ana');
  });

  it('item novo no catálogo aparece no pedido seguinte', async () => {
    banco.catalogos[TENANT].stronix_dores.push({ id: 'd3', name: 'Ansiedade' });
    const res = resposta();

    await handler(pedidoOpcoes(), res);

    expect(res.body.dores).toEqual([{ name: 'Ansiedade' }, { name: 'Emagrecimento' }, { name: 'Postura' }]);
  });

  it('pessoa fora da equipe recebe o aviso com o e-mail dela', async () => {
    const res = resposta();

    await handler(pedidoOpcoes('carla@stronix.com.br'), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'fora_da_equipe',
      message: 'Seu e-mail do Stronizap, carla@stronix.com.br, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.'
    });
  });

  it('quem está na equipe mas nunca entrou no Stronilead também fica de fora', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(BIA.email), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('fora_da_equipe');
  });

  it('academia suspensa não abre o formulário', async () => {
    banco.tenants[TENANT].status = 'suspended';
    const res = resposta();

    await handler(pedidoOpcoes(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'academia_bloqueada',
      message: 'O Stronilead desta academia está bloqueado. Fale com o gestor.'
    });
  });

  it('sem o e-mail de quem pede, 400 no campo actor', async () => {
    const res = resposta();
    const p = pedidoOpcoes();
    delete p.body.actor;

    await handler(p, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'actor', message: 'Não deu para saber quem está cadastrando.' });
  });

  it('chave de outra academia não abre as opções', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoOpcoes();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador com barra responde 401 sem chegar ao banco', async () => {
    const res = resposta();
    const p = pedidoOpcoes();
    p.body.tenant = 'academia/teste';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });
});

describe('POST /api/zap: o desvio no começo do handlePost', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Os pedidos de cada ação que autentica pela chave.
  const pedidoPelaChave = (action) => ({
    match: { method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action, tenant: TENANT, phones: [TELEFONE] } },
    'lead-options': pedidoOpcoes()
  })[action];

  it.each(['lead-options'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
    sessao.auth = { uid: 'auth-johnny', tenantId: TENANT };
    sessao.admin = true;
    const p = pedidoPelaChave(action);
    delete p.headers['x-stronizap-key'];
    p.headers.authorization = 'Bearer token-de-admin';
    const res = resposta();

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial ausente' });
    expect(banco.gravacoes).toEqual([]);
    expect(sessao.consultasDoLogin).toBe(0);
  });

  it.each(['match', 'lead-options'])('%s com a chave nunca consulta o login do CRM', async (action) => {
    const res = resposta();

    await handler(pedidoPelaChave(action), res);

    expect(res.statusCode).toBeLessThan(300);
    expect(sessao.consultasDoLogin).toBe(0);
  });

  it('ação desconhecida com a chave cai no caminho do login e é recusada', async () => {
    const res = resposta();

    await handler({ method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action: 'lead-option', tenant: TENANT } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Não autenticado.' });
    expect(sessao.consultasDoLogin).toBe(1);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: `Tests  12 failed | 48 passed (60)`. Sem o desvio, `lead-options` cai no caminho do login e responde `{ error: 'Não autenticado.' }`.

- [ ] **Step 4: Cabeçalho e imports de `api/zap.js`**

Trocar as linhas 1 a 21 (o comentário do topo e os imports) por:

```js
// Ponte com o Stronizap. O Zap pergunta quem é a pessoa por trás de um
// telefone e recebe o cartão de contexto. Desde o cadastro pelo Stronizap, ele
// também pede as listas do formulário (lead-options) e cadastra o lead de
// dentro da conversa (create-lead).
//
// O GET procura também os menores que têm aquele telefone como responsável
// (`guardianZapMatchKey`), e o `match` conta o número do responsável como
// cadastro enquanto ele é o contato do menor.
//
// Autenticação por chave emitida no Stronilead (Configurações → Integrações),
// guardada aqui só como hash em tenants/{id}.integrations.zap.keyHash.
//
// O POST tem dois donos. `generate` e `revoke` são do admin da academia, logado
// no CRM, e autenticam por verifyRequest (ID token). `match`, `lead-options` e
// `create-lead` são do próprio Stronizap e autenticam pela chave, igual ao GET.
// O desvio fica no começo de handlePost, e os dois caminhos nunca se misturam.
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { withSentry } from './_sentry.js';
import { isTenantAdmin } from './_auth.js';
import { generateZapKey, verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard, buildGuardianCard, buildZapWards } from './_zapCard.js';
import {
  ZAP_LEAD_MESSAGES, refusal, invalidData, tenantBlocked, emailFromActor, findTeamMember,
  buildLeadOptions, scrubbedError
} from './_zapLead.js';
import { contactOf } from '../src/lib/guardian.js';
```

Logo abaixo de `const CONFIG_GENERAL_ID = 'general';`, acrescentar:

```js
const USERS_PATH = 'stronix_users';
// Catálogos do formulário do cadastro, na ordem em que readCatalogs devolve.
const CATALOG_PATHS = ['stronix_sources', 'stronix_dores', 'stronix_modalities', 'stronix_funnels', 'stronix_statuses'];
```

- [ ] **Step 5: O desvio no começo do `handlePost`**

Trocar o comentário e a primeira linha do `handlePost`:

```js
// Gera e revoga a chave de conexão do Stronizap (ação do admin da academia, pela
// tela de Configurações → Integrações) e responde o match em lote (ação do
// próprio Stronizap, autenticada pela chave). Ver o desvio logo abaixo.
async function handlePost(req, res) {
  // A ação match é a única do POST que autentica pela chave do Zap. As outras
  // duas (generate e revoke) são do admin logado e seguem exigindo ID token.
  if (req.body?.action === 'match') return handleMatch(req, res);
```

por:

```js
// Gera e revoga a chave de conexão do Stronizap (ação do admin da academia, pela
// tela de Configurações → Integrações) e atende as ações do próprio Stronizap,
// autenticadas pela chave: o match em lote, as opções e o cadastro de lead.
// Ver o desvio logo abaixo.
async function handlePost(req, res) {
  // match, lead-options e create-lead são do próprio Stronizap e autenticam
  // pela chave do Zap. generate e revoke são do admin logado e seguem exigindo
  // ID token. Ação desconhecida cai no caminho do login e é recusada lá.
  const action = req.body?.action;
  if (action === 'match') return handleMatch(req, res);
  if (action === 'lead-options') return handleLeadOptions(req, res);
```

E, dentro do `try` do mesmo `handlePost`, apagar a linha que agora repete a leitura:

```js
    const { action } = req.body || {};
```

O `action` de cima tem o mesmo valor, e o resto do `try` (generate, revoke e o 400 de ação inválida) não muda.

- [ ] **Step 6: Autenticação pela chave, leituras e a ação**

No fim de `api/zap.js`, depois do `handleMatch`, acrescentar:

```js

// ---------------------------------------------------------------------------
// Cadastro de lead pelo Stronizap. As regras moram em api/_zapLead.js; aqui
// ficam a leitura e a gravação. Spec em
// docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md
// ---------------------------------------------------------------------------

const responder = (res, { status, body }) => res.status(status).json(body);

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Autenticação das ações do Stronizap no POST: identificador no formato da
// casa, chave da academia e academia ativa. Devolve { tenantId } ou
// { refusal }. Academia inexistente responde igual a chave errada, como no GET.
async function openByKey(req) {
  const chave = req.headers['x-stronizap-key'];
  const tenantId = req.body?.tenant;
  if (!chave || !tenantId) return { refusal: { status: 401, body: { error: 'Credencial ausente' } } };
  if (typeof tenantId !== 'string' || !TENANT_RE.test(tenantId)) {
    return { refusal: { status: 401, body: { error: 'Credencial inválida' } } };
  }
  const loaded = await loadZapTenant(tenantId);
  if (!loaded || !verifyZapKey(chave, loaded.zap.keyHash)) {
    return { refusal: { status: 401, body: { error: 'Credencial inválida' } } };
  }
  // O firebase-admin passa por cima das regras do Firestore, então a conta do
  // tenantActive (firestore.rules) é refeita aqui. Vale também para as
  // opções: o formulário nem abre.
  if (tenantBlocked(loaded.tenant, new Date())) {
    return { refusal: refusal(403, 'academia_bloqueada', ZAP_LEAD_MESSAGES.blocked) };
  }
  return { tenantId };
}

// A equipe inteira da academia: quem cadastra (pelo e-mail), o dono que o
// gestor escolhe e a lista de Consultor responsável. Equipe cabe numa leitura.
async function readTeam(tenantId) {
  return docsOf(await academyCollection(tenantId, USERS_PATH).get());
}

// Os catálogos do formulário, lidos a cada pedido: item novo no Stronilead
// aparece na próxima abertura, e item apagado é recusado no cadastro.
async function readCatalogs(tenantId) {
  const [sources, dores, modalities, funnels, statuses] = await Promise.all(
    CATALOG_PATHS.map((nome) => academyCollection(tenantId, nome).get())
  );
  return {
    sources: docsOf(sources),
    dores: docsOf(dores),
    modalities: docsOf(modalities),
    funnels: docsOf(funnels),
    statuses: docsOf(statuses)
  };
}

// Opções do formulário: quem pede (achado pelo e-mail da sessão do Stronizap)
// e as listas da academia. Só lê.
async function handleLeadOptions(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);

    const email = emailFromActor(req.body?.actor);
    if (!email) return responder(res, invalidData('actor', ZAP_LEAD_MESSAGES.actor));

    const [team, catalogs] = await Promise.all([readTeam(access.tenantId), readCatalogs(access.tenantId)]);
    const actor = findTeamMember(team, email);
    if (!actor) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));

    return res.status(200).json(buildLeadOptions({ actor, team, catalogs }));
  } catch (e) {
    throw scrubbedError('lead-options', e);
  }
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js && npx eslint api/zap.js api/__tests__/zapRoute.test.js`
Expected: `Tests  60 passed (60)` e lint sem erro.

- [ ] **Step 8: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: ponte do Zap entrega as opções do cadastro de lead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Ação `create-lead`

**Files:**
- Modify: `api/zap.js`
- Test: `api/__tests__/zapRoute.test.js`

- [ ] **Step 1: Imports e fixtures do cadastro no teste**

Em `api/__tests__/zapRoute.test.js`, logo depois de `import handler from '../zap.js';`, acrescentar:

```js
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
import { buildNotificationFeed } from '../../src/lib/notifications.js';
```

E logo antes de `const pedido = () => ({` (depois do `pedidoOpcoes`), acrescentar:

```js
// Mariana escreveu do WhatsApp e ainda não tem cadastro. Como o Zap manda.
const MARIANA = '5551998124471';
// Timestamp que o banco falso grava no lugar da hora do servidor.
const HORA = expect.objectContaining({ toDate: expect.any(Function) });

// Pedido de cadastro da Ana. `lead` mexe nos campos do lead; o resto troca
// campos do corpo (phone, actor, channelName).
const pedidoCadastro = ({ lead = {}, ...extra } = {}) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: {
    action: 'create-lead',
    tenant: TENANT,
    phone: MARIANA,
    actor: { email: ANA.email, name: 'Ana' },
    channelName: 'Recepção',
    lead: {
      name: 'Mariana Souza', source: 'WhatsApp', dor: 'Postura', modalidade: 'Pilates',
      funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null, ...lead
    },
    ...extra
  }
});

const leadsDaAcademia = () => banco.leads[TENANT] ?? [];
const marcosDaAcademia = () => banco.interacoes[TENANT] ?? [];

```

- [ ] **Step 2: O desvio cobre o cadastro**

No `describe('POST /api/zap: o desvio no começo do handlePost', ...)`, trocar:

```js
    'lead-options': pedidoOpcoes()
  })[action];

  it.each(['lead-options'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
```

por:

```js
    'lead-options': pedidoOpcoes(),
    'create-lead': pedidoCadastro()
  })[action];

  it.each(['lead-options', 'create-lead'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
```

E:

```js
  it.each(['match', 'lead-options'])('%s com a chave nunca consulta o login do CRM', async (action) => {
```

por:

```js
  it.each(['match', 'lead-options', 'create-lead'])('%s com a chave nunca consulta o login do CRM', async (action) => {
```

- [ ] **Step 3: Escrever os testes que falham**

No fim de `api/__tests__/zapRoute.test.js`, acrescentar:

```js
describe('POST /api/zap com action create-lead', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consultora cadastra: o lead nasce com ela de dona e o marco de início na linha do tempo', async () => {
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(201);
    const [lead] = leadsDaAcademia();
    expect(res.body).toEqual({ card: expect.objectContaining({
      found: true, leadId: lead.id, kind: 'lead', name: 'Mariana Souza',
      stage: 'Novo lead', source: 'WhatsApp', consultantName: 'Ana Souza'
    }) });
    expect(lead).toMatchObject({
      whatsapp: '(51) 9 9812-4471', zapMatchKey: '5198124471', funnelId: 'f-com', status: 'Novo lead',
      consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
      lifecycleBucket: 'ativo', interactionsCount: 1, lastInteractionAt: HORA, createdAt: HORA, statusEnteredAt: HORA
    });
    expect('consultantChangedAt' in lead).toBe(false);
    expect(marcosDaAcademia()).toEqual([{
      id: expect.any(String),
      leadId: lead.id,
      leadName: 'Mariana Souza',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      type: 'zap_signup',
      text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.',
      zapChannelName: 'Recepção',
      createdAt: HORA
    }]);
    expect(limitador.chamadas).toEqual([{ chave: 'zap-create-lead:academia-teste', opcoes: { limit: 60, windowMs: 3600000 } }]);
  });

  it('o lead tem os mesmos campos que o Novo lead grava, mais o que é da ponte', async () => {
    await handler(pedidoCadastro(), resposta());

    const [lead] = leadsDaAcademia();
    expect(lead).toEqual({
      ...buildNewLeadDoc(
        { name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', source: 'WhatsApp', funnelId: 'f-com', status: 'Novo lead', dor: 'Postura', modalidade: 'Pilates' },
        { owner: ANA }
      ),
      id: lead.id,
      createdAt: HORA,
      statusEnteredAt: HORA,
      lastInteractionAt: HORA,
      interactionsCount: 1
    });
  });

  it('gestor escolhe outra pessoa: ela vira a dona e recebe o aviso no sino', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: JOHNNY.email, name: 'Johnny' }, lead: { ownerId: 'u-bruno' } }), res);

    expect(res.statusCode).toBe(201);
    const [lead] = leadsDaAcademia();
    expect(lead).toMatchObject({
      consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno',
      consultantChangedAt: HORA, consultantChangedByName: 'Johnny', consultantChangedByAuthUid: 'auth-johnny'
    });
    expect(marcosDaAcademia()[0]).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny',
      leadConsultantId: 'u-bruno', leadConsultantAuthUid: 'auth-bruno', ownerName: 'Bruno Lima',
      text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Bruno Lima. Canal Recepção.'
    });
    // O sino do Bruno acende com "passado para você", sem mudança no sino.
    const { handoffs } = buildNotificationFeed({
      appUser: { id: 'u-bruno', authUid: 'auth-bruno', role: 'consultant' },
      handoffLeads: [lead],
      now: HOJE
    });
    expect(handoffs).toEqual([expect.objectContaining({ id: lead.id, name: 'Mariana Souza', byName: 'Johnny', unread: true })]);
  });

  it('gestor que escolhe a si mesmo não gera aviso de troca', async () => {
    await handler(pedidoCadastro({ actor: { email: JOHNNY.email }, lead: { ownerId: 'u-johnny' } }), resposta());

    const [lead] = leadsDaAcademia();
    expect(lead.consultantId).toBe('u-johnny');
    expect('consultantChangedAt' in lead).toBe(false);
    expect('ownerName' in marcosDaAcademia()[0]).toBe(false);
  });

  it('consultora não escolhe outra pessoa como dona', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { ownerId: 'u-bruno' } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'responsavel_invalido', message: 'Só o gestor escolhe outra pessoa como consultor responsável.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it.each(['u-saiu', 'u-bia'])('o dono escolhido precisa estar na equipe com login (%s)', async (ownerId) => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: JOHNNY.email }, lead: { ownerId } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'responsavel_invalido', message: 'Essa pessoa não está mais na equipe do Stronilead.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('pessoa fora da equipe não cadastra', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: 'carla@stronix.com.br' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('fora_da_equipe');
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia com teste vencido não cadastra nem gasta o limite', async () => {
    Object.assign(banco.tenants[TENANT], { status: 'trial', trialEndsAt: ts(new Date(2026, 8, 1)) });
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('academia_bloqueada');
    expect(limitador.chamadas).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('mensalidade atrasada há mais de 3 dias bloqueia; há 2 dias, não', async () => {
    const atrasada = (dias) => ({ paymentStatus: 'overdue', paymentOverdueSince: ts(new Date(HOJE.getTime() - dias * 86400000)) });
    Object.assign(banco.tenants[TENANT], atrasada(4));
    const bloqueada = resposta();
    await handler(pedidoCadastro(), bloqueada);
    expect(bloqueada.statusCode).toBe(403);

    Object.assign(banco.tenants[TENANT], atrasada(2));
    const liberada = resposta();
    await handler(pedidoCadastro(), liberada);
    expect(liberada.statusCode).toBe(201);
  });

  it('número já cadastrado: devolve o cartão de quem já existe, sem gravar nada', async () => {
    banco.leads[TENANT] = [{ ...clienteAVencer, zapMatchKey: zapMatchKey(MARIANA), createdAt: ts(new Date(2026, 7, 1)), consultantName: 'Bruno Lima' }];
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'ja_cadastrado',
      card: expect.objectContaining({ found: true, kind: 'cliente', leadId: 'c1' }),
      createdAt: '2026-08-01T00:00:00.000Z',
      message: 'Esse número já estava no Stronilead.'
    });
    expect(banco.gravacoes).toEqual([]);
  });

  it('cadastrado há menos de 10 minutos: diz quem cuida', async () => {
    banco.leads[TENANT] = [{
      id: 'n1', name: 'Mariana', lifecycleStage: 'lead', status: 'Novo lead', consultantName: 'Bruno Lima',
      zapMatchKey: zapMatchKey(MARIANA), createdAt: ts(new Date(HOJE.getTime() - 5 * 60000))
    }];
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.');
  });

  it('dois pedidos ao mesmo tempo no mesmo número resultam num lead só', async () => {
    const [a, b] = [resposta(), resposta()];

    await Promise.all([
      handler(pedidoCadastro(), a),
      handler(pedidoCadastro({ actor: { email: BRUNO.email } }), b)
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(leadsDaAcademia()).toHaveLength(1);
    expect(marcosDaAcademia()).toHaveLength(1);
    const recusado = a.statusCode === 409 ? a : b;
    expect(recusado.body.card.leadId).toBe(leadsDaAcademia()[0].id);
    expect(recusado.body.message).toMatch(/^Esse número foi cadastrado há pouco\. Quem cuida é (Ana Souza|Bruno Lima)\.$/);
  });

  it('número antigo, sem o nono dígito: o lead ganha o 9, e o número com ou sem o 9 cai no duplicado', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: '555181244710' }), res);

    expect(res.statusCode).toBe(201);
    // O cartão devolvido é o do GET para o número antigo: ele continua achando a pessoa.
    expect(res.body.card).toMatchObject({ found: true, name: 'Mariana Souza' });
    expect(leadsDaAcademia()[0]).toMatchObject({ whatsapp: '(51) 9 8124-4710', whatsappDigits: '51981244710', zapMatchKey: '5181244710' });
    for (const phone of ['555181244710', '5551981244710']) {
      const repetido = resposta();
      await handler(pedidoCadastro({ phone }), repetido);
      expect(repetido.statusCode).toBe(409);
    }
    expect(leadsDaAcademia()).toHaveLength(1);
  });

  it('fixo continua com 10 dígitos', async () => {
    await handler(pedidoCadastro({ phone: '555133334444' }), resposta());

    expect(leadsDaAcademia()[0]).toMatchObject({ whatsappDigits: '5133334444', zapMatchKey: '5133334444' });
  });

  it('"Tentar de novo" depois de um cadastro feito não duplica: recebe o cartão', async () => {
    await handler(pedidoCadastro(), resposta());
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.card).toMatchObject({ found: true, kind: 'lead', name: 'Mariana Souza' });
    expect(leadsDaAcademia()).toHaveLength(1);
  });

  const menorDaConversa = (extra = {}) => ({ guardianName: 'Maria Souza', relationship: 'Mãe', studentWhatsapp: null, ...extra });

  it('menor: o número da conversa vira o telefone do responsável e o cartão vira o do responsável', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa() } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(res.body.card.wards.map((w) => w.name)).toEqual(['Pedro Souza']);
    expect(leadsDaAcademia()[0]).toMatchObject({
      name: 'Pedro Souza', whatsapp: '', zapMatchKey: null, isMinor: true,
      guardian: { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' },
      guardianZapMatchKey: zapMatchKey(MAE)
    });
  });

  it('irmão com o mesmo responsável entra', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Ana Souza', minor: menorDaConversa() } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card.wards.map((w) => w.name)).toEqual(['Ana Souza', 'Pedro Souza']);
  });

  it('o mesmo aluno com o mesmo responsável não duplica', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { consultantName: 'Bruno Lima' })];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: ' pedro  SOUZA ', minor: menorDaConversa() } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      error: 'ja_cadastrado',
      card: { found: true, kind: 'responsavel' },
      createdAt: '2026-08-01T00:00:00.000Z',
      message: 'Pedro Souza já tem cadastro no Stronilead com esse responsável.'
    });
    expect(banco.gravacoes).toEqual([]);
  });

  it('WhatsApp do aluno igual ao do responsável é recusado no campo', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ studentWhatsapp: '(11) 9 1234-5678' }) } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: 'menor_invalido', field: 'studentWhatsapp',
      message: 'Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.'
    });
    expect(banco.gravacoes).toEqual([]);
  });

  it('WhatsApp do aluno que já é de outro cadastro é recusado no campo', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ studentWhatsapp: '(11) 9 8765-4321' }) } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'menor_invalido', field: 'studentWhatsapp', message: 'Esse WhatsApp já está em outro cadastro do Stronilead.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('WhatsApp próprio do aluno vai para o lead do aluno', async () => {
    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ studentWhatsapp: '11955554444' }) } }), resposta());

    expect(leadsDaAcademia()[0]).toMatchObject({ whatsapp: '(11) 9 5555-4444', zapMatchKey: '1155554444', guardianZapMatchKey: zapMatchKey(MAE) });
  });

  it('menor num número antigo: o telefone do responsável também ganha o 9', async () => {
    await handler(pedidoCadastro({ phone: '555181244710', lead: { name: 'Pedro Souza', minor: menorDaConversa() } }), resposta());

    expect(leadsDaAcademia()[0]).toMatchObject({
      guardian: { name: 'Maria Souza', phone: '(51) 9 8124-4710', relationship: 'Mãe' },
      guardianZapMatchKey: '5181244710'
    });
  });

  it('responsável sem nome é recusado no campo', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ guardianName: 'M' }) } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'menor_invalido', field: 'guardianName', message: 'Informe o nome do responsável.' });
  });

  it('adulto num número que só é de responsável entra: o telefone do responsável não barra', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Maria Souza' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card).toMatchObject({ found: true, kind: 'lead', name: 'Maria Souza' });
    expect(res.body.card.wards.map((w) => w.leadId)).toEqual(['k1']);
  });

  it.each([
    ['source', { source: 'Facebook' }, 'Essa origem não existe mais no Stronilead. Escolha de novo.'],
    ['dor', { dor: 'Ansiedade' }, 'Essa dor não existe mais no Stronilead. Escolha de novo.'],
    ['modalidade', { modalidade: 'Crossfit' }, 'Essa modalidade não existe mais no Stronilead. Escolha de novo.'],
    ['funnelId', { funnelId: 'f-ren' }, 'Esse funil não existe mais no Stronilead. Escolha de novo.'],
    ['stage', { stage: 'Interesse' }, 'Essa etapa não existe mais no Stronilead. Escolha de novo.']
  ])('item de catálogo que sumiu (%s) é recusado e diz o campo', async (field, lead, message) => {
    const res = resposta();

    await handler(pedidoCadastro({ lead }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'catalogo_mudou', field, message });
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia sem dor cadastrada não cadastra', async () => {
    banco.catalogos[TENANT].stronix_dores = [];
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: 'sem_dor_cadastrada',
      message: 'Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores.'
    });
  });

  it('dor em branco com dores cadastradas é campo a preencher', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { dor: '' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'dor', message: 'Escolha a dor ou necessidade.' });
  });

  it('passou de 60 cadastros na hora: recusa sem gravar', async () => {
    limitador.ok = false;
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'limite', message: 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('pedido com formato errado responde 400 sem gastar o limite', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: '123' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'phone', message: 'O número desta conversa não é um WhatsApp com DDD.' });
    expect(limitador.chamadas).toEqual([]);
  });

  it('nome com menos de 2 letras é recusado no campo', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { name: ' A ' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'name', message: 'Informe o nome, com 2 letras ou mais.' });
  });

  it('erro do banco no meio do cadastro sobe sem o telefone e sem gravar nada', async () => {
    banco.falhaEm = 'zapMatchKey';

    const erro = await handler(pedidoCadastro(), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap create-lead falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MARIANA));
    expect(String(erro.stack)).not.toContain(MARIANA);
    expect(banco.gravacoes).toEqual([]);
  });

  it('chave de outra academia não cadastra', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoCadastro();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(banco.leads[OUTRA]).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: `Tests  38 failed | 61 passed (99)`. O único teste novo que já passa é "chave de outra academia não cadastra", porque sem o desvio o pedido cai no login e também responde 401.

- [ ] **Step 5: Imports e constantes do cadastro em `api/zap.js`**

Trocar:

```js
import { generateZapKey, verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard, buildGuardianCard, buildZapWards } from './_zapCard.js';
import {
  ZAP_LEAD_MESSAGES, refusal, invalidData, tenantBlocked, emailFromActor, findTeamMember,
  buildLeadOptions, scrubbedError
} from './_zapLead.js';
```

por:

```js
import { checkRateLimit } from './_rateLimit.js';
import { generateZapKey, verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard, buildGuardianCard, buildZapWards } from './_zapCard.js';
import {
  LEAD_CREATE_LIMIT, ZAP_LEAD_MESSAGES, refusal, invalidData, tenantBlocked, emailFromActor, findTeamMember,
  buildLeadOptions, readCreateLeadBody, checkMinor, checkCatalog, resolveOwner, sameStudentName, studentKey,
  buildZapLead, buildZapSignupInteraction, alreadyRegisteredBody, scrubbedError
} from './_zapLead.js';
```

Logo abaixo de `const USERS_PATH = 'stronix_users';`, acrescentar:

```js
const INTERACTIONS_PATH = 'stronix_interactions';
```

E logo abaixo de `const WARDS_MAX = 10;`, acrescentar:

```js

// Menores lidos por responsável na conferência de duplicado do cadastro. Só
// um teto contra número compartilhado demais: irmãos passam longe disso.
const MINORS_SCAN_MAX = 100;
```

- [ ] **Step 6: O desvio passa o cadastro**

No `handlePost`, logo depois de `if (action === 'lead-options') return handleLeadOptions(req, res);`, acrescentar:

```js
  if (action === 'create-lead') return handleCreateLead(req, res);
```

- [ ] **Step 7: A ação**

No fim de `api/zap.js`, depois do `handleLeadOptions`, acrescentar:

```js

// Cadastro do lead de dentro da conversa. Só cadastra quem está na equipe, com
// as regras do Stronilead, e responde 201 com o mesmo cartão que o GET devolve
// para o número.
async function handleCreateLead(req, res) {
  try {
    const access = await openByKey(req);
    if (access.refusal) return responder(res, access.refusal);
    const { tenantId } = access;

    const read = readCreateLeadBody(req.body);
    if (read.refusal) return responder(res, read.refusal);
    const { phone, matchKey, email, actorName, channelName, lead } = read.value;

    const limit = await checkRateLimit(`zap-create-lead:${tenantId}`, LEAD_CREATE_LIMIT);
    if (!limit.ok) return responder(res, refusal(429, 'limite', ZAP_LEAD_MESSAGES.rateLimited));

    const [team, catalogs] = await Promise.all([readTeam(tenantId), readCatalogs(tenantId)]);
    const member = findTeamMember(team, email);
    if (!member) return responder(res, refusal(403, 'fora_da_equipe', ZAP_LEAD_MESSAGES.notInTeam(email)));
    // O nome do autor é o do Stronilead, como em toda interação do app. O que
    // o Stronizap manda só entra se o cadastro da equipe não tiver nome.
    const actor = { ...member, name: member.name || actorName };

    const problem = checkMinor({ minor: lead.minor, phone }) || checkCatalog(lead, catalogs);
    if (problem) return responder(res, problem);
    const ownership = resolveOwner({ actor, ownerId: lead.ownerId, team });
    if (ownership.refusal) return responder(res, ownership.refusal);

    const serverTime = admin.firestore.FieldValue.serverTimestamp();
    const leadRef = leadsCollection(tenantId).doc();
    const markRef = academyCollection(tenantId, INTERACTIONS_PATH).doc();
    const newLead = buildZapLead({ lead, phone, actor, owner: ownership.owner, serverTime });
    const mark = buildZapSignupInteraction({
      leadId: leadRef.id, leadName: newLead.name, actor, owner: ownership.owner, channelName, serverTime
    });
    const studentMatch = studentKey(lead.minor);

    // Conferência de duplicado e gravação na MESMA transação: dois cliques,
    // duas pessoas ou o "Tentar de novo" depois de uma resposta perdida caem
    // num lead só.
    const outcome = await adminDb.runTransaction(async (tx) => {
      if (!lead.minor) {
        const owners = await tx.get(leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1));
        if (!owners.empty) return { repeated: leadDoDoc(owners.docs[0]) };
      } else {
        // O telefone do responsável não barra: irmãos dividem o número. Barra
        // o mesmo aluno com o mesmo responsável.
        const wards = await tx.get(
          leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(MINORS_SCAN_MAX)
        );
        const same = wards.docs.map(leadDoDoc).find((m) => sameStudentName(m.name, lead.name));
        if (same) return { repeated: same };
        if (studentMatch) {
          const student = await tx.get(leadsCollection(tenantId).where('zapMatchKey', '==', studentMatch).limit(1));
          if (!student.empty) return { studentTaken: true };
        }
      }
      tx.create(leadRef, newLead);
      tx.create(markRef, mark);
      return { created: true };
    });

    if (outcome.studentTaken) {
      return responder(res, refusal(422, 'menor_invalido', ZAP_LEAD_MESSAGES.studentTaken, { field: 'studentWhatsapp' }));
    }
    const card = await cardFor(tenantId, matchKey);
    if (outcome.repeated) {
      return res.status(409).json(alreadyRegisteredBody({ repeated: outcome.repeated, card, minor: Boolean(lead.minor) }));
    }
    return res.status(201).json({ card });
  } catch (e) {
    throw scrubbedError('create-lead', e);
  }
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapRoute.test.js api/__tests__/zapLead.test.js api/__tests__/zapCard.test.js && npx eslint api/zap.js api/__tests__/zapRoute.test.js`
Expected: `zapRoute.test.js` com 99, e os outros dois verdes; lint sem erro.

- [ ] **Step 9: Nenhuma função nova e nenhum import proibido**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
grep -n "dailyGoal\|lucide-react\|firebase/firestore\|lib/funnels.js" api/_zapLead.js src/lib/newLead.js
```

Expected: `11`, e o `grep` só acha o comentário do topo do `src/lib/newLead.js` (nenhum `import`).

- [ ] **Step 10: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: Stronizap cadastra o lead pela ponte, numa transação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Documentação (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md` (do Stronilead, na raiz do worktree), seção "Ponte com o Stronizap"

Não mexer no `06-sistemas/CLAUDE.md` nem no `CLAUDE.md` da raiz: eles mudam só depois do recurso em produção.

- [ ] **Step 1: A lista de "Tudo cabe numa função só"**

Logo depois do item do `generate`/`revoke` (a linha que começa com ``- `POST /api/zap` com `{ action: 'generate' | 'revoke' }` ``), acrescentar:

```markdown
- `POST /api/zap` com `{ action: 'match' | 'lead-options' | 'create-lead' }` é do próprio Stronizap e autentica pela chave, igual ao `GET`. O `match` está descrito logo abaixo; as outras duas, em "Cadastro de lead pelo Stronizap".
```

- [ ] **Step 2: O parágrafo "O `POST` tem dois donos"**

Trocar o parágrafo inteiro que começa com `**O \`POST\` tem dois donos.**` por:

```markdown
**O `POST` tem dois donos.** `generate` e `revoke` são do admin da academia, logado no CRM, e autenticam por ID token (`verifyRequest` mais `isTenantAdmin`). `match`, `lead-options` e `create-lead` são do próprio Stronizap e autenticam pela chave, igual ao `GET`. O `match` recebe até 30 telefones e responde só quais existem, sem nome, id ou plano. O teto de 30 é do operador `in` do Firestore. Os telefones precisam vir como texto e voltam na forma em que chegaram, então número no lugar de texto volta como não encontrado. O desvio fica no começo de `handlePost` e os dois caminhos nunca se misturam: ação desconhecida cai no caminho do login e é recusada lá. Apagar o desvio derruba os testes do `match`, das opções e do cadastro em `api/__tests__/zapRoute.test.js`, e o bloco "o desvio no começo do handlePost" confere também que o caminho da chave nunca consulta o login. O identificador da academia é validado nos dois caminhos antes de qualquer acesso ao Firestore.

**Cadastro de lead pelo Stronizap** (spec em `docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md`). O atendente cadastra o lead de dentro da conversa. As regras moram em `api/_zapLead.js`, puro e testado em `api/__tests__/zapLead.test.js`; a leitura e a gravação ficam em `api/zap.js`.

- **`lead-options`** recebe `{ tenant, actor: { email } }` e devolve quem pede (`actor` com id, nome e papel `consultor` ou `gestor`), as origens, as dores, as modalidades, os funis com as etapas, os parentescos (`GUARDIAN_RELATIONSHIPS`), o padrão do Novo lead (a origem com "whats" no nome, senão a primeira em ordem alfabética; o funil padrão e a primeira etapa dele) e, só para gestor, a equipe com id e nome, sem e-mail. Só lê, e lê os catálogos a cada pedido: item novo aparece na próxima abertura do formulário. Funil sem etapa fica de fora, porque no Stronizap a etapa é obrigatória.
- **`create-lead`** recebe `{ tenant, phone, actor: { email, name }, channelName, lead }` e responde `201 { card }`, o mesmo cartão que o `GET` devolve para o número. Toda recusa de regra traz `error`, um `message` pronto para a tela (o Stronizap mostra como veio) e `field` quando é de um campo: `dados_invalidos` (400), `academia_bloqueada` e `fora_da_equipe` (403), `ja_cadastrado` (409, com `card` e `createdAt`), `catalogo_mudou`, `sem_dor_cadastrada`, `responsavel_invalido` e `menor_invalido` (422) e `limite` (429). Os valores de `field` são os nomes do pedido: `phone`, `actor`, `channelName`, `lead`, `name`, `source`, `dor`, `modalidade`, `funnelId`, `stage`, `ownerId`, `minor`, `guardianName`, `relationship` e `studentWhatsapp`. Os textos moram em `ZAP_LEAD_MESSAGES`.
- **Um montador só.** O documento do lead novo sai de `buildNewLeadDoc` (`src/lib/newLead.js`), que o Novo lead (`AddLeadModal.jsx`) e a ponte usam. As datas do servidor (`createdAt` e `statusEnteredAt`) ficam com quem grava, porque cada lado usa um SDK. Campo novo do lead entra no montador e chega aos dois cadastros; o `newLeadSweep.test.js` reprova quem voltar a montar o documento na mão. Os funis em que um lead novo pode nascer também moram ali (`leadEntryFunnels`). A `api/` importa esse arquivo direto, sem espelho, e o `newLeadImports.test.js` segue os imports dele e de `api/_zapLead.js` para travar que nenhum chegue a pacote, a `firebase.js`, a `dailyGoal.js` ou a `funnels.js`.
- **O servidor faz o que as regras e a tela fariam**, porque o `firebase-admin` passa por cima das regras: academia ativa (`tenantBlocked`, a mesma conta do `tenantActive` de `firestore.rules`: suspensa, teste vencido e mensalidade atrasada há mais de 3 dias, sem a exceção de "pago" da tela de login, que as regras não têm), pessoa da equipe achada em `stronix_users` pelo e-mail em minúsculas e com `authUid`, dono escolhido só por gestor (`role: 'admin'`) e só entre quem está na equipe com login, catálogos conferidos na hora do cadastro, regras do menor (`guardianIssue` e `sameContactPhone`) e no máximo 60 cadastros por hora por academia (`checkRateLimit`, chave `zap-create-lead:<academia>`). O limite conta toda tentativa que passa do formato, inclusive as recusadas depois.
- **Duplicado na mesma transação da gravação.** A chave sai do número já normalizado. Adulto: qualquer lead ou cliente com o `zapMatchKey` do número barra. Menor: o número da conversa vira o telefone do responsável e não barra, porque irmãos dividem o número; barra o mesmo aluno (nome sem acento, sem caixa e sem espaço a mais) com o mesmo `guardianZapMatchKey`, e o WhatsApp do aluno, quando vem, não pode ser o `zapMatchKey` de outro cadastro. Dois cliques, duas pessoas ou o "Tentar de novo" depois de uma resposta perdida caem num lead só e recebem `ja_cadastrado` com o cartão.
- **O que é gravado.** O lead pelo montador, com `whatsapp` no formato do Novo lead: sem o 55, pela regra do `zapMatchKey`, e com o nono dígito do celular antigo (`nationalPhoneDigits`, em `api/_zapPhone.js`: 10 dígitos com 6, 7, 8 ou 9 depois do DDD ganham o 9, e fixo fica com 10). A mesma regra vale para o telefone do responsável e para o WhatsApp do aluno. Junto vai o dono (quem cadastrou, ou quem o gestor escolheu), `lastInteractionAt` e `interactionsCount: 1` e, quando o dono não é quem cadastrou, `consultantChangedAt`, `consultantChangedByName` e `consultantChangedByAuthUid`, que acendem o "passado para você" no sino. Junto, a interação `zap_signup` (`ZAP_SIGNUP_TYPE`, em `src/lib/leads.js`): autor em `consultantName` e `actorId`, dono em `leadConsultantId`, `ownerName` só quando o dono é outra pessoa, o canal em `zapChannelName` e um `text` legível para tela que não conheça o tipo. Sem `volumeKind`: o lead conta na prospecção do dono pelo próprio lead.
- **O marco de início na ficha.** `classifyInteraction` devolve `'origin'` para o `zap_signup`, que entra em Marcos e aparece com o interruptor de Sistema desligado. A ficha desenha o `ZapSignupMarker` (`src/components/profile/`): uma régua com a pílula "Início · cadastrado pelo Stronizap por…" e a marca do Stronizap (`src/components/brand/StronizapMark.jsx`, com a versão clara no tema escuro), no fim da linha do tempo, e embaixo o consultor responsável (só quando não é quem cadastrou) e o canal. Na tela, quem responde pelo menor é "Nome do responsável" e o dono do lead é "Consultor responsável". Com o marco, a linha genérica "Início da jornada" sai.
- **Não é contato.** `isRegistrationInteraction` (`src/lib/leads.js`) tira o marco do "já interagiu hoje", e `isContactInteraction` (`src/lib/crm/contact.js`) o tira do primeiro contato do Dashboard CRM, como a observação do cadastro.
- **Erro inesperado sobe sem dado pessoal.** As duas ações trocam a mensagem do erro por `zap <ação> falhou (<código>)` (`scrubbedError`), mantendo a pilha, porque a mensagem do Firestore pode trazer o telefone. O `withSentry` captura esse erro, e o Stronizap trata a resposta 5xx como Stronilead fora do ar.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: cadastro de lead pelo Stronizap no CLAUDE.md do Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Verificação completa

**Files:** nenhum

- [ ] **Step 1: Suíte, lint, build e Sentry**

```bash
npm test
npm run lint
npm run build
npm run verificar:sentry
```

Expected:
- `npm test`: tudo verde, com 5 arquivos e 170 testes a mais que no Task 0 (em cima de `68c4f4c`: `Test Files  125 passed (125)` e `Tests  2582 passed (2582)`);
- `npm run lint`: 0 erros. O aviso de `react-hooks/exhaustive-deps` em `src/views/superadmin/SuperAdminView.jsx` já existe na main;
- `npm run build`: `✓ built`, com o aviso de pedaço maior que 500 kB que a main já tem;
- `npm run verificar:sentry`: `rodada normal: OK` e `rodada sabotagem: OK`.

- [ ] **Step 2: Travas da casa**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
git diff origin/main --stat -- firestore.rules firestore.indexes.json vercel.json package.json package-lock.json
```

Expected: `11` funções, e nenhuma mudança em regras, índices, Vercel ou dependências.

- [ ] **Step 3: Reler o diff contra a spec**

Run: `git diff origin/main --stat`
Expected: só os arquivos do "Mapa de arquivos", mais a spec e os planos em `docs/`.

---

### Task 15: PR e roteiro à mão na academia-teste

**Files:** nenhum

- [ ] **Step 1: Abrir o PR (sem merge; o merge é do Johnny)**

```bash
git push -u origin claude/cadastro-lead-pelo-zap
gh pr create --base main --title "feat: cadastro de lead pelo Stronizap (Stronilead)" --body "$(cat <<'EOF'
O Stronizap passa a cadastrar o lead de dentro da conversa. Este PR é a metade do Stronilead: as duas ações novas do `POST /api/zap`, o montador único do lead novo e o marco de início na ficha.

- `lead-options`: quem pede (achado pelo e-mail da sessão do Stronizap), as listas da academia e o padrão do Novo lead; a equipe só para gestor, sem e-mail
- `create-lead`: confere academia ativa, equipe, papel, catálogos, regras do menor e o limite de 60 por hora; confere duplicado e grava o lead e o marco numa transação só; responde com o mesmo cartão do `GET`
- `src/lib/newLead.js`: o Novo lead e a ponte gravam pelo mesmo montador, e um teste trava os campos que o Novo lead grava
- ficha: marco de início (`zap_signup`) no fim da linha do tempo, com a marca do Stronizap nos dois temas, fora das contas de contato
- número de WhatsApp antigo, sem o nono dígito: o lead nasce com o 9 (fixo fica com 10), e o duplicado sai do número normalizado
- nenhuma função nova na Vercel (continuam 11) e nada a publicar no Firestore (regras iguais, consultas de campo único)

**Pode entrar antes do PR do Stronizap:** as ações ficam paradas até alguém chamar.

Antes de ligar numa academia: cada pessoa da equipe usa o mesmo e-mail nos dois sistemas, existe uma origem com "WhatsApp" no nome e existem dores cadastradas.

Decisões do Johnny de 29/09, no plano: o celular antigo ganha o nono dígito, o dono do lead aparece como "Consultor responsável" e não há trava de liberação no Stronizap.

Spec: `docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md`
Plano: `docs/superpowers/plans/2026-09-29-cadastro-zap-pr1-stronilead.md`

Verificação: `npm test`, `npm run lint`, `npm run build` e `npm run verificar:sentry` verdes. O teste de verdade vem depois do merge: o Stronizap do PR 2 rodando local contra este Stronilead em produção, na `academia-teste` (Task 15 do plano).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: o link do PR. Não fazer merge.

- [ ] **Step 2: Teste de verdade, depois do merge (Johnny)**

Este PR vai para produção com as ações paradas: nada chama `lead-options` nem `create-lead` até existir o Stronizap novo. Não há trava de liberação: no Stronizap, o botão depende só da integração ligada. Por isso o teste, antes de qualquer cliente ver o botão, é o Stronizap do PR 2 (plano `2026-09-29-cadastro-zap-pr2-stronizap.md`) rodando local na máquina do Johnny, ligado a este Stronilead em produção, na academia `academia-teste`. A chave nunca vai para arquivo nem para chat.

1. Depois do merge, confira na Vercel que o deploy da main terminou (Ready).
2. No Stronilead de produção, entre no super console, abra a `academia-teste` com "Acessar como" e vá em Configurações → Integrações → Stronizap. Gere uma chave (a anterior, se houver, para de valer) e deixe à vista os três dados da tela: endereço do CRM (`https://stronilead.com.br`), identificador (`academia-teste`) e a chave.
3. Confira na `academia-teste`: as pessoas do teste usam no Stronilead o mesmo e-mail do Stronizap, existe uma origem com "WhatsApp" no nome e existem dores cadastradas.
4. Rode o Stronizap do PR 2 local e, na organização de teste, em Configurações → Stronilead, cole os três dados na mesma ordem, salve e clique em Testar conexão.
5. Com um número de WhatsApp de teste, sem cadastro, escrevendo para o canal de teste:
   - consultora cadastra: o lead nasce com ela de dona; um segundo clique, ou a mesma conversa noutra aba, cai no "Esse número foi cadastrado há pouco" e não cria outro lead;
   - gestor escolhe outra pessoa em "Consultor responsável": o lead fica com ela, e o sino dela no Stronilead mostra o lead em "Passaram para você";
   - menor: o número da conversa vira o telefone do responsável e o cabeçalho vira "Responsável por …"; o mesmo aluno de novo não duplica, e um irmão entra;
   - pessoa do Stronizap com e-mail fora da equipe da `academia-teste`: vê o aviso e não cadastra;
   - se houver à mão um número antigo, sem o nono dígito: o lead aparece no Stronilead com o 9.
6. No Stronilead de produção, na `academia-teste`:
   - a ficha termina com a pílula "Início · cadastrado pelo Stronizap por … em dd/mm às hh:mm" e a linha "Canal …" (ou "Consultor responsável … · canal …" quando o gestor escolheu outra pessoa), sem "Início da jornada";
   - o filtro Marcos mostra o marco; no tema escuro a marca troca para o balão branco com raio verde-escuro; a 390 px de largura (modo de dispositivo do DevTools) a pílula encurta sem estourar;
   - o Pipeline mostra os leads no funil e na etapa escolhidos, e a Meta Diária do dono mostra cada um no dia seguinte, em Novo Lead 24h.
7. Limpeza: como gestor, exclua os leads de teste pela ficha.

- [ ] **Step 3: Anotar o resultado**

Anote no PR do Stronizap o que foi conferido no Step 2: ele só vai para o servidor depois desse teste. Defeito do lado do Stronilead vira PR novo aqui, no mesmo formato deste plano.

---

## Depois do merge (fora deste plano)

Com o PR do Stronizap também em produção e o teste de ponta a ponta feito na `academia-teste`: atualizar a seção "Ponte Stronilead ↔ Stronizap" do `~/STRONIX-FIRMA/06-sistemas/CLAUDE.md` e a tabela "Últimas Atualizações" do `~/STRONIX-FIRMA/CLAUDE.md`, como pede a spec.
