# Cadastro de lead pelo Stronizap · PR 2 (Stronizap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem atende no Stronizap cadastra o lead no Stronilead de dentro da conversa, no painel do contato, sem trocar de sistema, e todo cartão com lead ganha o link "Abrir no Stronilead".

**Architecture:** O navegador fala só com o backend do Stronizap, por duas rotas novas sob a conversa (`GET /api/conversations/:id/crm-lead-options` e `POST /api/conversations/:id/crm-lead`). Um serviço novo, `crm-lead.service.ts`, confere quem pede e qual contato, chama as ações `lead-options` e `create-lead` do `POST /api/zap` do Stronilead pelo `crm.service.ts` (o único lugar que conhece a chave) e, quando o cartão novo chega, troca o cartão no cache, marca a cobertura, grava o nome do cadastro e avisa pelo socket (`crm_card_updated`). No front, o formulário (`CrmLeadForm`) mora dentro do `CrmCardSection`, abre pelo botão do painel ou pelo "Cadastrar" do header, e não guarda lista nenhuma: tudo vem de `lead-options` a cada abertura.

**Tech Stack:** Node 20+, TypeScript, Express 4, Prisma 5, Zod, Socket.IO (back, testes com `node:test` e tsx); React 18, Vite, Zustand, Radix/shadcn (`Combobox`, `Switch`), Vitest com jsdom (front).

**Spec:** `stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md` (fonte da verdade). Mockups aprovados: `stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-mockup.html`, seções 1 (modelo B) e 2 (os seis estados).

**Repositório:** `~/STRONIX-FIRMA/06-sistemas/stronizap` (remoto `johnnychaves/whatsapp-stronix`). Todos os caminhos abaixo são relativos à raiz desse repositório, dentro do worktree criado na Task 0. Levantado sobre `origin/main` em `8db5ddb` (29/09/2026): backend com 447 testes, frontend com 58 arquivos e 667 testes, tudo verde. A `main` andou para `a85de75` no mesmo dia (reescrita com IA e filtro de atendente por canal), sem tocar nos arquivos de código deste plano; o plano aplicado sobre ela também fica verde (backend 530 testes, frontend 66 arquivos e 771 testes). No `CLAUDE.md`, o item da seção 14 citado na Task 16 passou da linha 419 para a 420.

**Ordem de entrada:** este PR só vai para produção depois do PR 1 do Stronilead (as ações `lead-options` e `create-lead` no `api/zap.js`). Com o Stronilead antigo, o `POST /api/zap` sem `match` exige ID token e responde 401, e este lado trata 401 como chave recusada: a seção do Stronilead sumiria do painel de quem clicasse em Cadastrar. Desenvolver e testar não depende do PR 1 (os testes simulam o CRM). Com o PR 1 no ar, o teste de ponta a ponta roda na máquina, contra o Stronilead de produção, antes de qualquer deploy do Stronizap (Task 17).

**Números de linha:** os que o plano cita são os do arquivo em `8db5ddb`, antes de qualquer edição. Quando uma task mexe em vários pontos do mesmo arquivo, guie-se pelo trecho citado, que é único, e não pelo número, que anda depois da primeira edição.

---

## Notas antes de começar

O código de hoje decidiu alguns pontos que a spec deixou em aberto ou descreveu de outro jeito. Cada decisão abaixo é a menor solução fiel à spec.

1. **A "troca de um número só" no `CrmCache`.** O `set(key, card)` já troca uma chave, mas quem chama teria de montar o texto `${organizationId}:${phone}` à mão. O plano cria `crmCacheKey(organizationId, phone)`, usado também pelo `fetchCrmCard`, e dois métodos: `replaceCard(organizationId, phone, card)` (a troca da spec) e `forget(organizationId, phone)` (esquece o número quando o CRM recusa a chave, para a rota do cartão responder como sempre respondeu).
2. **401 do CRM nunca volta como 401 ao navegador.** O interceptor de `frontend/src/lib/api.ts` trata 401 como sessão vencida e renova o token, podendo deslogar a pessoa. As rotas novas respondem: 412 `desligado` (integração desligada), 502 `chave_invalida` (o CRM respondeu 401) e 503 `indisponivel` (rede, tempo esgotado, 5xx, resposta fora do combinado). O front faz a seção sumir nos dois primeiros, "o mesmo tratamento do cartão", e mostra o quadro 6 no terceiro.
3. **Corpo das recusas.** O `errorHandler` global só manda `{ error, code }`. O serviço devolve status e corpo prontos e a rota escreve. Formato único para o navegador: `error` é o texto para a tela (o `message` do Stronilead), `code` é o código (o `error` do Stronilead), mais `field`, `card` e `createdAt` quando vierem. As recusas do próprio Stronizap (superadmin, impersonação, contato sem número) saem por `HttpError` com `code`, no mesmo formato.
4. **`ja_cadastrado` sem cartão vira `indisponivel`.** O contrato diz que o 409 traz o cartão. Sem ele, a tela não teria o que mostrar no lugar do formulário, e a nova tentativa resolve.
5. **O texto do `ja_cadastrado` é do Stronilead.** A regra dos 10 minutos ("cadastrado há pouco" ou "já estava") mora lá, e o Stronizap mostra o `message` como veio. O `createdAt` é repassado ao navegador e não é usado para recalcular nada.
6. **Nomes do `field`.** A spec não lista os valores. O plano usa os nomes das chaves do pedido: `name`, `source`, `dor`, `modalidade`, `funnelId`, `stage`, `ownerId`, `guardianName`, `relationship`, `studentWhatsapp` (`fieldOfRefusal`, Task 11). `field` desconhecido mostra o texto na área geral do formulário. Conferido com o plano do PR 1 (`2026-09-29-cadastro-zap-pr1-stronilead.md`, nota 14 e tabela "O contrato das duas ações"): são exatamente esses nomes, mais `phone`, `actor`, `channelName`, `lead` e `minor` para erro de formato que a tela não provoca, e que aqui caem na área geral. Os status, os códigos e os corpos daquela tabela são os que este plano trata.
7. **Funis permitidos e padrões são do Stronilead.** Tirar Renovações, Vencidos, Upgrade e Indicações e escolher a origem padrão (a que tem "WhatsApp" no nome, senão a primeira em ordem alfabética) é regra dele: chega pronto em `funnels` e `defaults`. O Stronizap não filtra nem calcula.
8. **WhatsApp do aluno igual ao da conversa.** Quem recusa é o Stronilead (`menor_invalido` com `field: 'studentWhatsapp'`, pelo `sameContactPhone` dele), e o texto aparece no campo. O Stronizap só confere o formato: se preenchido, de 10 a 13 dígitos.
9. **Endereço do "Abrir no Stronilead".** `crmBaseUrl` e `crmTenantSlug` já saem no `GET /organization` (`crm.baseUrl` e `crm.tenantSlug`), rota que qualquer papel da organização lê e que nunca traz a chave (só `hasKey`). O `crm.store` pergunta uma vez por sessão. Linha gravada antes de 15/09 pode ter `/api/zap` no fim do endereço, e `crmFichaHref` tira.
10. **Tela de Contatos.** O `ContactPanel` de lá não tem conversa aberta, e as rotas moram sob a conversa: lá não aparece "Cadastrar lead". O "Abrir no Stronilead" aparece.
11. **Legendas dos dois campos de pessoa (decidido pelo Johnny em 29/09).** Os mockups chamavam os dois de "Responsável". No bloco do menor, o campo de quem responde por ele é "Nome do responsável", como no Novo lead do Stronilead. O campo do dono, só do gestor, é "Consultor responsável". "Fica com você (Ana Souza) e soma na sua Meta diária." e "Ana recebe o aviso no sino do Stronilead." ficam como estão.
12. **Teste das rotas.** O `tsx` dos testes do backend não carrega o Baileys, então nenhuma rota é importada em `node:test`. Papel, impersonação, contato sem número, Instagram, integração desligada e organização alheia são testados no `crm-lead.service.ts` com dependências injetadas (no molde do `rewrite.service.ts`), e as rotas de verdade entram na suíte de isolamento, que roda sobre o build.
13. **O aviso do socket vai para o contato da conversa.** O mesmo telefone em outro canal é outro contato e fica com o cartão antigo até ser reaberto; um segundo clique em Cadastrar lá recebe `ja_cadastrado` e mostra o cartão.
14. **Tempo máximo testado com `t.mock.timers`.** É o primeiro uso no repositório. Funciona no Node 22 e acima, que é onde os testes rápidos rodam (CI e máquina do Johnny); a suíte de isolamento, no Node 20, não usa.
15. **Smoke antes do reload.** O smoke novo só existe com o código novo no disco. A receita de publicação (Task 17) faz o pull, roda o smoke novo e só então builda e recarrega o PM2. O `deploy.sh` faz tudo de uma vez e não serve para isso.
16. **Sem migration.** Nada muda no `schema.prisma`: o cache é em memória, o evento do socket e as rotas são novos.
17. **Quem pede sem nome no Stronilead.** A spec mostra `actor: { id, name, role }`, mas o PR 1 manda `name: null` quando a pessoa da equipe não tem nome no cadastro dela. O plano aceita: `CrmLeadOptions.actor.name` é `string | null` nos dois espelhos, e a tela diz "Fica com você e soma na sua Meta diária." e "Você", sem o nome entre parênteses.
18. **Plano conferido de ponta a ponta.** Antes de entregar, o código deste plano foi aplicado sobre `8db5ddb` numa cópia fora do repositório: todo trecho "trocar isto" bateu com o arquivo, os dois typechecks e os dois builds passaram, e as três suítes ficaram verdes (números na Task 17).
19. **Sem chave de liga e desliga (decidido pelo Johnny em 29/09).** A única condição nova para o botão é a academia ter a integração com o Stronilead ligada, somada às que já valem para o cartão: contato de WhatsApp com número, cartão `found: false` e sessão que não é a do superadmin entrando como admin. Sem a integração, o Stronizap segue sozinho, exatamente como hoje. O teste de ponta a ponta acontece ANTES do deploy, com este branch rodando na máquina e ligado ao Stronilead de produção na `academia-teste` (Task 17, Step 4). Só depois dele o deploy no servidor.
20. **Nono dígito (PR 1).** O Stronilead passou a acrescentar o nono dígito que falta em celular antigo ao gravar o lead, sem mudar o `zapMatchKey`. Nada deste lado muda: o Stronizap manda o telefone como o contato tem (`Contact.phone`), não formata nem compara telefone em lugar nenhum deste plano, e cache, cobertura, nome e evento do socket seguem pelo número do contato e pelo id dele. O cartão continua casando pelo `zapMatchKey`, que é o mesmo. O WhatsApp do aluno vai só em dígitos, e quem o formata (e acrescenta o 9, se for o caso) é o Stronilead.

### Pontos para o Johnny decidir

1. **Tela de Contatos sem o botão** (nota 10).
2. **Quadro 5 sem botão.** O mockup do "fora da equipe" não tem Cancelar: o aviso fica até o painel fechar ou a conversa trocar. O plano segue o mockup.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `backend/src/services/crm.service.ts` | `crmCacheKey`, `CrmCache.replaceCard` e `forget`; tipos do cadastro; `fetchCrmLeadOptions` e `createCrmLead`, com `pedirAoCrm`, `interpretar` e a lista fechada das opções |
| `backend/src/services/crm.service.test.ts` | cache de um número, opções, cadastro, recusas e tempo máximo |
| `backend/src/services/crm-lead.service.ts` (novo) | portas (superadmin, impersonação, acesso, contato com número), chamadas ao CRM, os quatro passos depois do cartão e o schema do corpo |
| `backend/src/services/crm-lead.service.test.ts` (novo) | papel, impersonação, sem número, Instagram, integração desligada, organização alheia, cache, cobertura, nome e socket |
| `backend/src/routes/conversations.routes.ts` | as duas rotas |
| `backend/src/routes/tenant-isolation.spec.ts` | as duas rotas na suíte de isolamento |
| `backend/src/scripts/smoke-crm-card.ts` | bloco `[4]` com as opções do cadastro, só leitura |
| `backend/src/scripts/smoke-crm-card.guard.test.ts` (novo) | trava: o smoke nunca chama o cadastro |
| `frontend/src/types/crm.ts` | tipos do cadastro, `CrmFichaLink` e `crmFichaHref` |
| `frontend/src/types/crm.test.ts` | `crmFichaHref` |
| `frontend/src/lib/crmLead.ts` (novo) | chamadas às rotas novas, leitura das falhas, evento do socket |
| `frontend/src/lib/crmLead.test.ts` (novo) | |
| `frontend/src/stores/crm.store.ts` | `replaceCard`, `hideCard`, leitura antiga que não desfaz troca, `fichaLink` |
| `frontend/src/stores/crm.store.test.ts` (novo) | |
| `frontend/src/hooks/useSocket.ts` | `crm_card_updated` |
| `frontend/src/lib/crmLeadForm.ts` (novo) | regras puras do formulário |
| `frontend/src/lib/crmLeadForm.test.ts` (novo) | |
| `frontend/src/components/Combobox.tsx` | variante `compact`, `id`, `ariaLabel` e `invalid` |
| `frontend/src/index.css` | `.set-trigger--compact`, `.crm-field`, `.crm-cta` e `.sx-reveal` |
| `frontend/src/components/CrmLeadForm.tsx` (novo) | o formulário (modelo B) e seus estados |
| `frontend/src/components/CrmLeadForm.test.tsx` (novo) | |
| `frontend/src/components/CrmCardSection.tsx` | botão "Cadastrar lead", formulário com animação, "Cadastrado agora por você", "Abrir no Stronilead" |
| `frontend/src/components/CrmCardSection.test.tsx` | |
| `frontend/src/components/CrmHeaderMeta.tsx` | link "Cadastrar" |
| `frontend/src/components/CrmHeaderMeta.test.tsx` (novo) | |
| `frontend/src/components/ContactPanel.tsx` | props do cadastro e link da ficha |
| `frontend/src/components/ChatWindow.tsx` | prop `onOpenLeadForm` |
| `frontend/src/pages/ChatPage.tsx` | estado `leadFormFor` |
| `CLAUDE.md` | seções 10 e 14 |

---

### Task 0: Worktree e ponto de partida

**Files:** nenhum

O checkout principal é dividido com outras sessões. Nunca troque de branch nele: todo o trabalho acontece no worktree.

- [ ] **Step 1: Criar o worktree a partir da main atualizada**

```bash
cd ~/STRONIX-FIRMA/06-sistemas/stronizap
git fetch origin
git worktree add .claude/worktrees/cadastro-lead-pelo-zap -b claude/cadastro-lead-pelo-zap origin/main
cd .claude/worktrees/cadastro-lead-pelo-zap
```

Expected: `Preparing worktree (new branch 'claude/cadastro-lead-pelo-zap')`.

- [ ] **Step 2: Instalar, gerar o cliente do Prisma e conferir que a base está verde**

```bash
npm ci
npm run prisma:generate
npm test --workspace=backend
npm test --workspace=frontend
npm run typecheck --workspaces
```

Expected: tudo verde (em `8db5ddb`: 447 testes no backend, 58 arquivos e 667 testes no frontend). Se algo falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: `CrmCache` troca e esquece um número só

**Files:**
- Modify: `backend/src/services/crm.service.ts` (linhas 79-126 e 286)
- Test: `backend/src/services/crm.service.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm.service.test.ts`, trocar o import do topo (linhas 3-11) por:

```ts
import {
  buildCrmUrl,
  CrmCache,
  crmCacheKey,
  fetchCrmCard,
  fetchCrmMatches,
  normalizeCrmBaseUrl,
  type CrmDeps,
  type CrmOrgConfig,
} from './crm.service';
```

E, logo depois do teste `'cache: clearOrg de org sem nada guardado é inofensivo'` (termina na linha 268), acrescentar:

```ts
test('cache: a chave de um telefone é a organização e o número', () => {
  assert.equal(crmCacheKey('org1', '5551999998888'), 'org1:5551999998888');
});

test('cache: replaceCard troca o cartão de um número só', () => {
  const cache = new CrmCache();
  cache.set(crmCacheKey('org1', '555'), { found: false });
  cache.set(crmCacheKey('org1', '666'), { found: false });
  cache.set(crmCacheKey('org2', '555'), { found: false });

  cache.replaceCard('org1', '555', { found: true, kind: 'lead', name: 'Mariana' });

  assert.deepEqual(cache.get(crmCacheKey('org1', '555')), { found: true, kind: 'lead', name: 'Mariana' });
  assert.deepEqual(cache.get(crmCacheKey('org1', '666')), { found: false });
  assert.deepEqual(cache.get(crmCacheKey('org2', '555')), { found: false });
});

test('cache: replaceCard recomeça o prazo de dois minutos', () => {
  let agora = 0;
  const cache = new CrmCache(() => agora);
  cache.set(crmCacheKey('org1', '555'), { found: false });

  agora = 100_000;
  cache.replaceCard('org1', '555', { found: true, name: 'Mariana' });

  agora = 100_000 + 2 * 60 * 1000;
  assert.deepEqual(cache.get(crmCacheKey('org1', '555')), { found: true, name: 'Mariana' });
  agora += 1;
  assert.equal(cache.get(crmCacheKey('org1', '555')), undefined);
});

test('cache: forget esquece um número só', () => {
  const cache = new CrmCache();
  cache.set(crmCacheKey('org1', '555'), { found: false });
  cache.set(crmCacheKey('org1', '666'), { found: false });

  cache.forget('org1', '555');

  assert.equal(cache.get(crmCacheKey('org1', '555')), undefined);
  assert.deepEqual(cache.get(crmCacheKey('org1', '666')), { found: false });
});

test('cartão: depois do replaceCard, a rota do cartão lê o cartão novo sem ir ao CRM', async () => {
  const a = ambiente({ respostas: [respostaOk({ found: false })] });
  await fetchCrmCard('org1', TELEFONE, {}, a.deps);

  a.cache.replaceCard('org1', TELEFONE, { found: true, kind: 'lead', name: 'Mariana' });
  const r = await fetchCrmCard('org1', TELEFONE, {}, a.deps);

  assert.deepEqual(r, { card: { found: true, kind: 'lead', name: 'Mariana' }, reason: null });
  assert.equal(a.chamadasFetch.length, 1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL com erros de tipo: `crmCacheKey` não é exportado e `replaceCard`/`forget` não existem em `CrmCache`.

- [ ] **Step 3: Implementar em `backend/src/services/crm.service.ts`**

Logo depois de `interface Entry { value: CrmCard; expiresAt: number; }` (linha 79), acrescentar:

```ts
/**
 * Chave de um telefone no cache: a organização e o número, do jeito que a
 * rota do cartão guarda. Quem troca ou esquece o cartão de um número usa a
 * mesma chave, sem montar o texto à mão.
 */
export function crmCacheKey(organizationId: string, phone: string): string {
  return `${organizationId}:${phone}`;
}
```

Dentro da classe `CrmCache`, logo depois do método `clearOrg` (linhas 104-114) e antes de `gc()`, acrescentar:

```ts
  /**
   * Troca o cartão de um número só, com o prazo de dois minutos recomeçando.
   * Depois de um cadastro pelo Stronizap, o "Sem cadastro" guardado viraria
   * mentira até o TTL vencer, e quem abrisse a conversa veria o botão de
   * cadastrar alguém que já está no CRM.
   */
  replaceCard(organizationId: string, phone: string, card: CrmCard): void {
    this.set(crmCacheKey(organizationId, phone), card);
  }

  /** Esquece o cartão de um número só. A próxima leitura vai ao CRM. */
  forget(organizationId: string, phone: string): void {
    this.m.delete(crmCacheKey(organizationId, phone));
  }
```

Em `fetchCrmCard`, trocar a linha 286:

```ts
  const chaveCache = `${organizationId}:${phone}`;
```

por:

```ts
  const chaveCache = crmCacheKey(organizationId, phone);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os cinco testes novos e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm.service.test.ts
git commit -m "feat: cache do CRM troca e esquece o cartão de um número só

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Opções do cadastro no `crm.service.ts`

**Files:**
- Modify: `backend/src/services/crm.service.ts` (fim do arquivo, depois de `fetchCrmMatches`, linha 422)
- Test: `backend/src/services/crm.service.test.ts`

As duas ações novas usam o mesmo caminho do `match`: `POST /api/zap` com a chave no header. O pedaço comum (`pedirAoCrm` e `interpretar`) nasce aqui e serve à Task 3.

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm.service.test.ts`, trocar o import do topo por:

```ts
import {
  buildCrmUrl,
  CRM_LEAD_REFUSAL_FALLBACK,
  CrmCache,
  crmCacheKey,
  fetchCrmCard,
  fetchCrmLeadOptions,
  fetchCrmMatches,
  LEAD_OPTIONS_TIMEOUT_MS,
  normalizeCrmBaseUrl,
  type CrmDeps,
  type CrmLeadOptions,
  type CrmOrgConfig,
} from './crm.service';
```

E acrescentar no fim do arquivo:

```ts
// ── Cadastro de lead: opções ───────────────────────────────────────────────

function resposta(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as unknown as Response;
}

const OPCOES: CrmLeadOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
  sources: [{ name: 'Instagram' }, { name: 'WhatsApp' }],
  dores: [{ name: 'Postura' }, { name: 'Emagrecer' }],
  modalities: [{ name: 'Pilates' }],
  funnels: [
    { id: 'comercial', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] },
  ],
  relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
  defaults: { source: 'WhatsApp', funnelId: 'comercial', stage: 'Novo lead' },
};

test('opções: manda a ação, o tenant e o e-mail de quem pede, com a chave no header', async () => {
  const a = ambiente({ respostas: [resposta(200, OPCOES)] });

  await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps);

  const [url, init] = a.chamadasFetch[0] as unknown as [
    string,
    { method: string; headers: Record<string, string>; body: string },
  ];
  assert.equal(url, 'https://crm-stronix.vercel.app/api/zap');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-stronizap-key'], 'chave-em-claro');
  assert.deepEqual(JSON.parse(init.body), {
    action: 'lead-options',
    tenant: 'stronix',
    actor: { email: 'ana@academia.com' },
  });
});

test('opções: 200 vira as opções da consultora, sem equipe', async () => {
  const a = ambiente({ respostas: [resposta(200, OPCOES)] });

  assert.deepEqual(await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps), {
    ok: true,
    value: OPCOES,
  });
});

test('opções: lista fechada, campo a mais do Stronilead não passa, nem e-mail na equipe', async () => {
  const a = ambiente({
    respostas: [
      resposta(200, {
        ...OPCOES,
        actor: { id: 'u-jo', name: 'Johnny', role: 'gestor', email: 'jo@academia.com' },
        team: [{ id: 'u-ana', name: 'Ana Souza', email: 'ana@academia.com' }, { id: 'sem-nome' }],
        dores: [{ name: 'Postura' }, { name: '' }, null],
        segredo: 'x',
      }),
    ],
  });

  const r = await fetchCrmLeadOptions('org1', 'jo@academia.com', a.deps);

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value.actor, { id: 'u-jo', name: 'Johnny', role: 'gestor' });
  assert.deepEqual(r.value.team, [{ id: 'u-ana', name: 'Ana Souza' }]);
  assert.deepEqual(r.value.dores, [{ name: 'Postura' }]);
  assert.equal('segredo' in r.value, false);
  assert.equal(JSON.stringify(r.value).includes('@'), false);
});

test('opções: quem pede sem nome no Stronilead ainda abre o formulário', async () => {
  const a = ambiente({
    respostas: [resposta(200, { ...OPCOES, actor: { id: 'u-bia', name: null, role: 'consultor' } })],
  });

  const r = await fetchCrmLeadOptions('org1', 'bia@academia.com', a.deps);

  assert.deepEqual(r.ok ? r.value.actor : null, { id: 'u-bia', name: null, role: 'consultor' });
});

test('opções: sem quem pede, com papel desconhecido ou sem as listas é indisponivel', async () => {
  for (const corpo of [
    { ...OPCOES, actor: null },
    { ...OPCOES, actor: { id: 'x', name: 'X', role: 'dono' } },
    { ...OPCOES, funnels: 'x' },
    null,
  ]) {
    const a = ambiente({ respostas: [resposta(200, corpo)] });
    assert.deepEqual(await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('opções: integração desligada não chama o CRM', async () => {
  const a = ambiente({ org: { ...ORG_CONFIGURADA, crmEnabled: false } });

  assert.deepEqual(await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps), {
    ok: false,
    kind: 'desligado',
  });
  assert.equal(a.chamadasFetch.length, 0);
});

test('opções: 401 do CRM é chave_invalida', async () => {
  const a = ambiente({ respostas: [resposta(401, { error: 'Credencial inválida' })] });

  assert.deepEqual(await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps), {
    ok: false,
    kind: 'chave_invalida',
  });
});

test('opções: fora da equipe vem com o texto do Stronilead', async () => {
  const message =
    'Seu e-mail do Stronizap, bia@stronix.com.br, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.';
  const a = ambiente({ respostas: [resposta(403, { error: 'fora_da_equipe', message })] });

  assert.deepEqual(await fetchCrmLeadOptions('org1', 'bia@stronix.com.br', a.deps), {
    ok: false,
    kind: 'recusa',
    status: 403,
    code: 'fora_da_equipe',
    message,
    field: null,
    card: null,
    createdAt: null,
  });
});

test('opções: recusa conhecida sem message usa o texto de reserva', async () => {
  const a = ambiente({ respostas: [resposta(403, { error: 'academia_bloqueada' })] });

  const r = await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps);

  assert.equal(
    r.ok === false && r.kind === 'recusa' ? r.message : null,
    CRM_LEAD_REFUSAL_FALLBACK.academia_bloqueada,
  );
});

test('opções: 4xx sem código, 5xx e rede fora são indisponivel', async () => {
  for (const r of [resposta(400, { error: '' }), resposta(500, { error: 'boom' }), new Error('ECONNRESET')]) {
    const a = ambiente({ respostas: [r] });
    assert.deepEqual(await fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('opções: desiste em 4 segundos, e não antes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = ambiente();
  a.deps.httpFetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    });

  let resultado: unknown = 'pendente';
  const pedido = fetchCrmLeadOptions('org1', 'ana@academia.com', a.deps).then((r) => {
    resultado = r;
  });
  await new Promise((r) => setImmediate(r));

  t.mock.timers.tick(LEAD_OPTIONS_TIMEOUT_MS - 1);
  await new Promise((r) => setImmediate(r));
  assert.equal(resultado, 'pendente');

  t.mock.timers.tick(1);
  await pedido;
  assert.deepEqual(resultado, { ok: false, kind: 'indisponivel' });
  assert.equal(LEAD_OPTIONS_TIMEOUT_MS, 4000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `CRM_LEAD_REFUSAL_FALLBACK`, `fetchCrmLeadOptions`, `LEAD_OPTIONS_TIMEOUT_MS` e `CrmLeadOptions` não existem em `./crm.service`.

- [ ] **Step 3: Implementar no fim de `backend/src/services/crm.service.ts`**

Acrescentar depois de `fetchCrmMatches` (fim do arquivo):

```ts
// ── Cadastro de lead pelo Stronizap ────────────────────────────────────────
// Spec: stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md,
// seções "A ponte" e "Recusas". Duas ações no mesmo POST /api/zap do `match`,
// com a mesma chave no header. Quem pede chega aqui já tirado da sessão e do
// cadastro do colaborador (ver crm-lead.service.ts): nada disso vem do
// navegador.

/** Tempo máximo das opções do cadastro. Só leitura, como o cartão. */
export const LEAD_OPTIONS_TIMEOUT_MS = TIMEOUT_MS;

/**
 * Opções do formulário de cadastro, do jeito que saem daqui para o navegador.
 * Espelho de `frontend/src/types/crm.ts`. Lista FECHADA: `lerOpcoes` monta o
 * objeto de novo, campo a campo, e o que o Stronilead mandar a mais (um
 * e-mail na equipe, por exemplo) morre aqui.
 */
export interface CrmLeadOptions {
  /** `name` null: a pessoa não tem nome no cadastro da equipe do Stronilead. */
  actor: { id: string; name: string | null; role: 'consultor' | 'gestor' };
  sources: Array<{ name: string }>;
  dores: Array<{ name: string }>;
  modalities: Array<{ name: string }>;
  funnels: Array<{ id: string; name: string; stages: Array<{ name: string }> }>;
  relationships: string[];
  defaults: { source: string | null; funnelId: string | null; stage: string | null };
  /** Só para gestor, sem e-mail. */
  team?: Array<{ id: string; name: string }>;
}

/** Recusas de regra do Stronilead: `error` com o código e `message` com o texto. */
export const CRM_LEAD_REFUSAL_CODES = [
  'dados_invalidos',
  'academia_bloqueada',
  'fora_da_equipe',
  'ja_cadastrado',
  'catalogo_mudou',
  'sem_dor_cadastrada',
  'responsavel_invalido',
  'menor_invalido',
  'limite',
] as const;
export type CrmLeadRefusalCode = (typeof CRM_LEAD_REFUSAL_CODES)[number];

/**
 * Texto de reserva, só para recusa que chegar sem `message`. O normal é o
 * Stronilead mandar o texto pronto, e aí ele vai para a tela como veio.
 */
export const CRM_LEAD_REFUSAL_FALLBACK: Record<CrmLeadRefusalCode, string> = {
  dados_invalidos: 'Confira os dados do cadastro.',
  academia_bloqueada: 'O Stronilead desta academia está bloqueado. Fale com o gestor.',
  fora_da_equipe:
    'Seu e-mail do Stronizap não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.',
  ja_cadastrado: 'Esse número já estava no Stronilead.',
  catalogo_mudou: 'Uma das opções não existe mais no Stronilead. Escolha de novo.',
  sem_dor_cadastrada:
    'Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores.',
  responsavel_invalido: 'Essa pessoa não está mais na equipe do Stronilead.',
  menor_invalido: 'Confira os dados do menor.',
  limite: 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.',
};

/**
 * Como terminou uma chamada do cadastro.
 * - `recusa`: regra do Stronilead, com o status, o código, o texto dele e,
 *   quando há, o campo, o cartão e a data do cadastro que já existia.
 * - `desligado`: integração desligada ou mal configurada. Definitivo.
 * - `chave_invalida`: o CRM respondeu 401.
 * - `indisponivel`: rede, tempo esgotado, 5xx ou resposta fora do combinado.
 */
export type CrmLeadFailure =
  | {
      ok: false;
      kind: 'recusa';
      status: number;
      code: string;
      message: string;
      field: string | null;
      card: CrmCard | null;
      createdAt: string | null;
    }
  | { ok: false; kind: 'desligado' }
  | { ok: false; kind: 'chave_invalida' }
  | { ok: false; kind: 'indisponivel' };

export type CrmLeadRefusal = Extract<CrmLeadFailure, { kind: 'recusa' }>;

export type CrmLeadCall<T> = { ok: true; value: T } | CrmLeadFailure;

/** Resposta do CRM antes de interpretar, ou o motivo de não ter perguntado. */
type Pedido =
  | { kind: 'resposta'; status: number; corpo: unknown }
  | { kind: 'desligado' }
  | { kind: 'indisponivel' };

function objeto(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const texto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Manda uma ação ao POST /api/zap, com a chave no header, e devolve o status
 * e o corpo como vieram. Mesmas conferências do `fetchCrmMatches`: integração
 * ligada e completa, endereço público e chave que decifra.
 */
async function pedirAoCrm(
  organizationId: string,
  action: 'lead-options' | 'create-lead',
  extra: Record<string, unknown>,
  timeoutMs: number,
  deps: CrmDeps,
): Promise<Pedido> {
  const { loadOrgConfig, decryptKey, httpFetch, log } = deps;

  const org = await loadOrgConfig(organizationId);
  if (!org?.crmEnabled || !org.crmBaseUrl || !org.crmApiKey || !org.crmTenantSlug) {
    return { kind: 'desligado' };
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeCrmBaseUrl(org.crmBaseUrl);
  } catch (err) {
    log.error({ err, organizationId }, 'Endereço do CRM gravado é inválido');
    return { kind: 'desligado' };
  }

  let chave: string;
  try {
    chave = decryptKey(org.crmApiKey);
  } catch (err) {
    log.error({ err, organizationId }, 'Falha ao decifrar a chave do CRM');
    return { kind: 'indisponivel' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await httpFetch(`${baseUrl}/api/zap`, {
      method: 'POST',
      headers: { 'x-stronizap-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, tenant: org.crmTenantSlug, ...extra }),
      signal: controller.signal,
    });
    let corpo: unknown = null;
    try {
      corpo = await res.json();
    } catch {
      // Corpo que não é JSON: quem interpreta decide pelo status.
    }
    return { kind: 'resposta', status: res.status, corpo };
  } catch (err) {
    log.warn({ err, organizationId, action }, 'Falha ao falar com o CRM');
    return { kind: 'indisponivel' };
  } finally {
    clearTimeout(timer);
  }
}

/** Recusa de regra: `error` com o código e, de preferência, `message` com o texto. */
function lerRecusa(status: number, corpo: unknown): CrmLeadRefusal | null {
  const c = objeto(corpo);
  const code = c?.error;
  if (!c || !texto(code)) return null;
  const conhecido = (CRM_LEAD_REFUSAL_CODES as readonly string[]).includes(code);
  const escrito = c.message;
  const message = texto(escrito)
    ? escrito.trim()
    : conhecido
      ? CRM_LEAD_REFUSAL_FALLBACK[code as CrmLeadRefusalCode]
      : null;
  if (!message) return null;
  const card = objeto(c.card);
  const field = c.field;
  const createdAt = c.createdAt;
  return {
    ok: false,
    kind: 'recusa',
    status,
    code,
    message,
    field: texto(field) ? field : null,
    card: card && typeof card.found === 'boolean' ? (card as unknown as CrmCard) : null,
    createdAt: texto(createdAt) ? createdAt : null,
  };
}

function interpretar<T>(
  pedido: Pedido,
  organizationId: string,
  action: 'lead-options' | 'create-lead',
  ler: (corpo: unknown) => T | null,
  log: CrmDeps['log'],
): CrmLeadCall<T> {
  if (pedido.kind === 'desligado') return { ok: false, kind: 'desligado' };
  if (pedido.kind === 'indisponivel') return { ok: false, kind: 'indisponivel' };
  const { status, corpo } = pedido;

  if (status >= 200 && status < 300) {
    const valor = ler(corpo);
    if (valor) return { ok: true, value: valor };
    log.warn({ organizationId, action, status }, 'CRM respondeu em formato inesperado');
    return { ok: false, kind: 'indisponivel' };
  }

  if (status === 401) {
    // NUNCA logar a chave. O status basta pra diagnosticar.
    log.warn({ organizationId, action, status }, 'CRM recusou a chave');
    return { ok: false, kind: 'chave_invalida' };
  }

  const recusa = status >= 400 && status < 500 ? lerRecusa(status, corpo) : null;
  // `ja_cadastrado` sem o cartão não serve: a tela não teria o que pôr no
  // lugar do formulário. Vira indisponível, e a nova tentativa resolve.
  if (recusa && !(recusa.code === 'ja_cadastrado' && recusa.card?.found !== true)) {
    log.warn({ organizationId, action, status, code: recusa.code }, 'CRM recusou o pedido');
    return recusa;
  }

  log.warn({ organizationId, action, status }, 'CRM respondeu erro');
  return { ok: false, kind: 'indisponivel' };
}

/** Lista de `{ name }`, sem item que não tenha nome. */
function nomes(v: unknown): Array<{ name: string }> {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    const nome = objeto(item)?.name;
    return texto(nome) ? [{ name: nome }] : [];
  });
}

/**
 * Opções como saem para a tela, montadas de novo campo a campo. Sem quem
 * pede ou sem as listas principais não há formulário. Quem pede sem nome no
 * Stronilead (o PR 1 manda `name: null`) abre o formulário do mesmo jeito.
 */
function lerOpcoes(corpo: unknown): CrmLeadOptions | null {
  const c = objeto(corpo);
  if (!c) return null;
  const actor = objeto(c.actor);
  const id = actor?.id;
  const name = actor?.name;
  const role = actor?.role === 'gestor' ? 'gestor' : actor?.role === 'consultor' ? 'consultor' : null;
  if (!texto(id) || !role) return null;

  const sources = c.sources;
  const dores = c.dores;
  const funnelsBrutos = c.funnels;
  if (!Array.isArray(sources) || !Array.isArray(dores) || !Array.isArray(funnelsBrutos)) return null;

  const funnels = funnelsBrutos.flatMap((f) => {
    const o = objeto(f);
    const fid = o?.id;
    const fnome = o?.name;
    return o && texto(fid) && texto(fnome) ? [{ id: fid, name: fnome, stages: nomes(o.stages) }] : [];
  });
  const defaults = objeto(c.defaults);
  const padrao = (v: unknown): string | null => (texto(v) ? v : null);
  const parentescos = c.relationships;

  const opcoes: CrmLeadOptions = {
    actor: { id, name: texto(name) ? name : null, role },
    sources: nomes(sources),
    dores: nomes(dores),
    modalities: nomes(c.modalities),
    funnels,
    relationships: Array.isArray(parentescos) ? parentescos.filter(texto) : [],
    defaults: {
      source: padrao(defaults?.source),
      funnelId: padrao(defaults?.funnelId),
      stage: padrao(defaults?.stage),
    },
  };

  if (role === 'gestor') {
    const equipe = c.team;
    opcoes.team = Array.isArray(equipe)
      ? equipe.flatMap((p) => {
          const o = objeto(p);
          const pid = o?.id;
          const pnome = o?.name;
          return texto(pid) && texto(pnome) ? [{ id: pid, name: pnome }] : [];
        })
      : [];
  }
  return opcoes;
}

/**
 * Opções do formulário de cadastro para quem está pedindo. O Stronilead acha
 * a pessoa pelo e-mail e diz se ela é consultora ou gestora.
 */
export async function fetchCrmLeadOptions(
  organizationId: string,
  actorEmail: string,
  deps: Partial<CrmDeps> = {},
): Promise<CrmLeadCall<CrmLeadOptions>> {
  const d = { ...depsReais, ...deps };
  const pedido = await pedirAoCrm(
    organizationId,
    'lead-options',
    { actor: { email: actorEmail } },
    LEAD_OPTIONS_TIMEOUT_MS,
    d,
  );
  return interpretar(pedido, organizationId, 'lead-options', lerOpcoes, d.log);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test`
Expected: PASS, com os onze testes novos de opções e a suíte inteira verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm.service.test.ts
git commit -m "feat: ponte pede ao Stronilead as opções do cadastro de lead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cadastro no `crm.service.ts`

**Files:**
- Modify: `backend/src/services/crm.service.ts` (fim do arquivo)
- Test: `backend/src/services/crm.service.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/services/crm.service.test.ts`, trocar o import do topo por:

```ts
import {
  buildCrmUrl,
  createCrmLead,
  CREATE_LEAD_TIMEOUT_MS,
  CRM_LEAD_REFUSAL_FALLBACK,
  CrmCache,
  crmCacheKey,
  fetchCrmCard,
  fetchCrmLeadOptions,
  fetchCrmMatches,
  LEAD_OPTIONS_TIMEOUT_MS,
  normalizeCrmBaseUrl,
  type CrmCard,
  type CrmCreateLeadRequest,
  type CrmDeps,
  type CrmLeadOptions,
  type CrmOrgConfig,
} from './crm.service';
```

E acrescentar no fim do arquivo:

```ts
// ── Cadastro de lead: create-lead ──────────────────────────────────────────

const PEDIDO_CADASTRO: CrmCreateLeadRequest = {
  phone: TELEFONE,
  actor: { email: 'ana@academia.com', name: 'Ana Souza' },
  channelName: 'Recepção',
  lead: {
    name: 'Mariana Souza',
    source: 'WhatsApp',
    dor: 'Postura',
    modalidade: 'Pilates',
    funnelId: 'comercial',
    stage: 'Novo lead',
    ownerId: null,
    minor: null,
  },
};

const CARTAO_NOVO: CrmCard = {
  found: true,
  leadId: 'lead-1',
  kind: 'lead',
  name: 'Mariana Souza',
  stage: 'Novo lead',
  source: 'WhatsApp',
  consultantName: 'Ana Souza',
  strip: null,
  appointment: null,
};

test('cadastro: manda telefone, quem cadastrou, canal e o lead, na ação create-lead', async () => {
  const a = ambiente({ respostas: [resposta(201, { card: CARTAO_NOVO })] });

  await createCrmLead('org1', PEDIDO_CADASTRO, a.deps);

  const [url, init] = a.chamadasFetch[0] as unknown as [
    string,
    { method: string; headers: Record<string, string>; body: string },
  ];
  assert.equal(url, 'https://crm-stronix.vercel.app/api/zap');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-stronizap-key'], 'chave-em-claro');
  assert.deepEqual(JSON.parse(init.body), { action: 'create-lead', tenant: 'stronix', ...PEDIDO_CADASTRO });
});

test('cadastro: 201 devolve o cartão', async () => {
  const a = ambiente({ respostas: [resposta(201, { card: CARTAO_NOVO })] });

  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, a.deps), {
    ok: true,
    value: { card: CARTAO_NOVO },
  });
});

test('cadastro: 201 sem cartão encontrado é indisponivel', async () => {
  for (const corpo of [{}, { card: { found: false } }, null]) {
    const a = ambiente({ respostas: [resposta(201, corpo)] });
    assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, a.deps), {
      ok: false,
      kind: 'indisponivel',
    });
  }
});

test('cadastro: número já cadastrado traz o cartão, a data e o texto do Stronilead', async () => {
  const message = 'Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.';
  const a = ambiente({
    respostas: [
      resposta(409, {
        error: 'ja_cadastrado',
        message,
        card: CARTAO_NOVO,
        createdAt: '2026-09-29T14:32:00.000Z',
      }),
    ],
  });

  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, a.deps), {
    ok: false,
    kind: 'recusa',
    status: 409,
    code: 'ja_cadastrado',
    message,
    field: null,
    card: CARTAO_NOVO,
    createdAt: '2026-09-29T14:32:00.000Z',
  });
});

test('cadastro: já cadastrado sem o cartão é indisponivel', async () => {
  const a = ambiente({ respostas: [resposta(409, { error: 'ja_cadastrado', message: 'Já estava.' })] });

  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, a.deps), {
    ok: false,
    kind: 'indisponivel',
  });
});

test('cadastro: recusa com campo leva o campo junto', async () => {
  const message = 'Essa modalidade não existe mais no Stronilead. Escolha de novo.';
  const a = ambiente({
    respostas: [resposta(422, { error: 'catalogo_mudou', field: 'modalidade', message })],
  });

  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, a.deps), {
    ok: false,
    kind: 'recusa',
    status: 422,
    code: 'catalogo_mudou',
    message,
    field: 'modalidade',
    card: null,
    createdAt: null,
  });
});

test('cadastro: limite por hora é recusa 429 com o texto', async () => {
  const message = 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.';
  const a = ambiente({ respostas: [resposta(429, { error: 'limite', message })] });

  const r = await createCrmLead('org1', PEDIDO_CADASTRO, a.deps);

  assert.equal(r.ok === false && r.kind === 'recusa' ? `${r.status} ${r.message}` : null, `429 ${message}`);
});

test('cadastro: 401 é chave_invalida, 5xx e rede fora são indisponivel', async () => {
  const semChave = ambiente({ respostas: [resposta(401, {})] });
  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, semChave.deps), {
    ok: false,
    kind: 'chave_invalida',
  });

  const foraDoAr = ambiente({ respostas: [resposta(503, {})] });
  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, foraDoAr.deps), {
    ok: false,
    kind: 'indisponivel',
  });

  const semRede = ambiente({ respostas: [new Error('ECONNRESET')] });
  assert.deepEqual(await createCrmLead('org1', PEDIDO_CADASTRO, semRede.deps), {
    ok: false,
    kind: 'indisponivel',
  });
});

test('cadastro: a chave não aparece no resultado nem no log', async () => {
  const logs: unknown[][] = [];
  const a = ambiente({ respostas: [resposta(422, { error: 'catalogo_mudou', field: 'dor' })] });
  a.deps.log = {
    warn: (...args: unknown[]) => {
      logs.push(args);
    },
    error: (...args: unknown[]) => {
      logs.push(args);
    },
  };

  const r = await createCrmLead('org1', PEDIDO_CADASTRO, a.deps);

  assert.equal(JSON.stringify(r).includes('chave-em-claro'), false);
  assert.equal(JSON.stringify(logs).includes('chave-em-claro'), false);
  assert.equal(logs.length, 1);
});

test('cadastro: desiste em 8 segundos, e não antes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = ambiente();
  a.deps.httpFetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    });

  let resultado: unknown = 'pendente';
  const pedido = createCrmLead('org1', PEDIDO_CADASTRO, a.deps).then((r) => {
    resultado = r;
  });
  await new Promise((r) => setImmediate(r));

  t.mock.timers.tick(CREATE_LEAD_TIMEOUT_MS - 1);
  await new Promise((r) => setImmediate(r));
  assert.equal(resultado, 'pendente');

  t.mock.timers.tick(1);
  await pedido;
  assert.deepEqual(resultado, { ok: false, kind: 'indisponivel' });
  assert.equal(CREATE_LEAD_TIMEOUT_MS, 8000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `createCrmLead`, `CREATE_LEAD_TIMEOUT_MS` e `CrmCreateLeadRequest` não existem em `./crm.service`.

- [ ] **Step 3: Implementar no fim de `backend/src/services/crm.service.ts`**

Logo depois de `export const LEAD_OPTIONS_TIMEOUT_MS = TIMEOUT_MS;`, acrescentar:

```ts
/** Tempo máximo do cadastro, que roda uma transação do lado do Stronilead. */
export const CREATE_LEAD_TIMEOUT_MS = 8000;
```

Logo depois da interface `CrmLeadOptions`, acrescentar:

```ts
/** O bloco `lead` do cadastro, o único pedaço que vem do navegador. */
export interface CrmLeadInput {
  /** No menor, o nome do aluno. */
  name: string;
  source: string;
  dor: string;
  modalidade: string | null;
  funnelId: string;
  stage: string;
  /** Só gestor escolhe outra pessoa. Consultora, e gestor que fica com o lead, mandam null. */
  ownerId: string | null;
  minor: null | {
    guardianName: string;
    relationship: string | null;
    studentWhatsapp: string | null;
  };
}

/** Pedido completo de cadastro. `phone`, `actor` e `channelName` o backend põe. */
export interface CrmCreateLeadRequest {
  /** O número do contato como o WhatsApp guarda (`Contact.phone`). */
  phone: string;
  actor: { email: string; name: string };
  channelName: string;
  lead: CrmLeadInput;
}
```

E, no fim do arquivo, depois de `fetchCrmLeadOptions`:

```ts
/** Cadastro que deu certo: `{ card }`, com o cartão de sempre, já encontrado. */
function lerCadastro(corpo: unknown): { card: CrmCard } | null {
  const card = objeto(objeto(corpo)?.card);
  return card && card.found === true ? { card: card as unknown as CrmCard } : null;
}

/**
 * Cadastra o lead no Stronilead. Não usa o cache: quem chama troca o cartão
 * guardado pelo que voltar (ver `CrmCache.replaceCard`).
 */
export async function createCrmLead(
  organizationId: string,
  request: CrmCreateLeadRequest,
  deps: Partial<CrmDeps> = {},
): Promise<CrmLeadCall<{ card: CrmCard }>> {
  const d = { ...depsReais, ...deps };
  const pedido = await pedirAoCrm(
    organizationId,
    'create-lead',
    {
      phone: request.phone,
      actor: request.actor,
      channelName: request.channelName,
      lead: request.lead,
    },
    CREATE_LEAD_TIMEOUT_MS,
    d,
  );
  return interpretar(pedido, organizationId, 'create-lead', lerCadastro, d.log);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test && npm run typecheck`
Expected: PASS, com os dez testes novos de cadastro, e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm.service.ts backend/src/services/crm.service.test.ts
git commit -m "feat: ponte cadastra lead no Stronilead e lê as recusas dele

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `crm-lead.service.ts`, as portas e os quatro passos

**Files:**
- Create: `backend/src/services/crm-lead.service.ts`
- Create: `backend/src/services/crm-lead.service.test.ts`

Este serviço é o que as duas rotas chamam. Ele fica fora do `conversation.service.ts` porque aquele arquivo carrega o Baileys, que o `tsx` dos testes não consegue carregar (mesmo motivo do import tardio no `rewrite.service.ts`).

Ordem das portas, igual nas duas rotas: superadmin (antes de tudo, porque `isSameTenant(null, X)` deixa passar), impersonação, acesso à conversa (404 para inexistente ou de outra organização, 403 para canal sem acesso), contato de WhatsApp com número (422), e só então o CRM (412 se a integração estiver desligada).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/crm-lead.service.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../middleware/errorHandler';
import {
  CrmCache,
  crmCacheKey,
  type CrmCard,
  type CrmCreateLeadRequest,
  type CrmLeadCall,
  type CrmLeadInput,
  type CrmLeadOptions,
} from './crm.service';
import type { ContatoParaSync } from './crm-name.service';
import {
  createCrmLeadFromConversation,
  crmLeadBodySchema,
  getCrmLeadOptions,
  IMPERSONATION_MESSAGE,
  LEAD_FAILURE_REPLY,
  NO_PHONE_MESSAGE,
  SUPERADMIN_MESSAGE,
  type CrmLeadDeps,
  type CrmLeadTarget,
  type CrmLeadViewer,
} from './crm-lead.service';

// Acesso, banco, CRM, cache, cobertura, nome e socket entram por parâmetro
// (ver `CrmLeadDeps`), no molde do rewrite.service.test.ts. Nada de mock de
// módulo, de banco ou de rede: o teste passa as versões dele e olha o que o
// serviço decidiu.

const CONTATO: ContatoParaSync = {
  id: 'contato-1',
  organizationId: 'org1',
  channelId: 'canal-1',
  phone: '5551998124471',
  jidSuffix: null,
  displayName: 'Mari',
};

const ALVO: CrmLeadTarget = {
  conversationId: 'conv-1',
  channelType: 'WHATSAPP',
  channelName: 'Recepção',
  contact: CONTATO,
};

const ATENDENTE: CrmLeadViewer = {
  sub: 'colab-ana',
  email: 'ana@academia.com',
  role: 'ATENDENTE',
  orgId: 'org1',
};

const LEAD: CrmLeadInput = {
  name: 'Mariana Souza',
  source: 'WhatsApp',
  dor: 'Postura',
  modalidade: 'Pilates',
  funnelId: 'comercial',
  stage: 'Novo lead',
  ownerId: null,
  minor: null,
};

const CARTAO: CrmCard = {
  found: true,
  leadId: 'lead-1',
  kind: 'lead',
  name: 'Mariana Souza',
  stage: 'Novo lead',
  source: 'WhatsApp',
  consultantName: 'Ana Souza',
  strip: null,
  appointment: null,
};

const OPCOES: CrmLeadOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
  sources: [{ name: 'WhatsApp' }],
  dores: [{ name: 'Postura' }],
  modalities: [{ name: 'Pilates' }],
  funnels: [{ id: 'comercial', name: 'Comercial', stages: [{ name: 'Novo lead' }] }],
  relationships: ['Mãe', 'Pai'],
  defaults: { source: 'WhatsApp', funnelId: 'comercial', stage: 'Novo lead' },
};

interface Ambiente {
  deps: CrmLeadDeps;
  acessos: unknown[][];
  pedidosDeOpcoes: Array<{ organizationId: string; actorEmail: string }>;
  cadastros: Array<{ organizationId: string; request: CrmCreateLeadRequest }>;
  coberturas: Array<{ contactId: string; card: CrmCard }>;
  nomes: Array<{ contato: ContatoParaSync; card: CrmCard }>;
  eventos: Array<{ channelId: string; event: string; payload: unknown }>;
  cache: CrmCache;
}

function ambiente(
  opts: {
    acesso?: HttpError;
    alvo?: CrmLeadTarget | null;
    nome?: string | null;
    opcoes?: CrmLeadCall<CrmLeadOptions>;
    cadastro?: CrmLeadCall<{ card: CrmCard }>;
  } = {},
): Ambiente {
  const acessos: unknown[][] = [];
  const pedidosDeOpcoes: Ambiente['pedidosDeOpcoes'] = [];
  const cadastros: Ambiente['cadastros'] = [];
  const coberturas: Ambiente['coberturas'] = [];
  const nomes: Ambiente['nomes'] = [];
  const eventos: Ambiente['eventos'] = [];
  const cache = new CrmCache();
  return {
    acessos,
    pedidosDeOpcoes,
    cadastros,
    coberturas,
    nomes,
    eventos,
    cache,
    deps: {
      assertAccess: async (...args) => {
        acessos.push(args);
        if (opts.acesso) throw opts.acesso;
      },
      loadTarget: async () => (opts.alvo === undefined ? ALVO : opts.alvo),
      loadActorName: async () => (opts.nome === undefined ? 'Ana Souza' : opts.nome),
      fetchOptions: async (organizationId, actorEmail) => {
        pedidosDeOpcoes.push({ organizationId, actorEmail });
        return opts.opcoes ?? { ok: true, value: OPCOES };
      },
      createLead: async (organizationId, request) => {
        cadastros.push({ organizationId, request });
        return opts.cadastro ?? { ok: true, value: { card: CARTAO } };
      },
      cache,
      registrarCobertura: async (contactId, card) => {
        coberturas.push({ contactId, card });
      },
      syncName: async (contato, card) => {
        nomes.push({ contato, card });
      },
      emit: (channelId, event, payload) => {
        eventos.push({ channelId, event, payload });
      },
      log: { info: () => {} },
    },
  };
}

// ── Portas ──────────────────────────────────────────────────────────────────

test('papel: superadmin é recusado antes de olhar a conversa, nas duas rotas', async () => {
  const amb = ambiente();
  const superadmin: CrmLeadViewer = { ...ATENDENTE, role: 'SUPERADMIN', orgId: null };

  await assert.rejects(getCrmLeadOptions('conv-1', superadmin, amb.deps), {
    statusCode: 403,
    code: 'superadmin',
    message: SUPERADMIN_MESSAGE,
  });
  await assert.rejects(createCrmLeadFromConversation('conv-1', superadmin, LEAD, amb.deps), {
    statusCode: 403,
    code: 'superadmin',
  });
  assert.equal(amb.acessos.length, 0);
  assert.equal(amb.pedidosDeOpcoes.length, 0);
  assert.equal(amb.cadastros.length, 0);
});

test('impersonação: a sessão do superadmin entrando como admin é recusada', async () => {
  const amb = ambiente();
  const emprestada: CrmLeadViewer = { ...ATENDENTE, role: 'ADMIN', imp: { byId: 'sa-1' } };

  await assert.rejects(getCrmLeadOptions('conv-1', emprestada, amb.deps), {
    statusCode: 403,
    code: 'impersonacao',
    message: IMPERSONATION_MESSAGE,
  });
  await assert.rejects(createCrmLeadFromConversation('conv-1', emprestada, LEAD, amb.deps), {
    statusCode: 403,
    code: 'impersonacao',
  });
  assert.equal(amb.acessos.length, 0);
  assert.equal(amb.cadastros.length, 0);
});

test('papel: admin, gestor e atendente com acesso ao canal chegam ao Stronilead', async () => {
  for (const role of ['ADMIN', 'GESTOR', 'ATENDENTE'] as const) {
    const amb = ambiente();
    const r = await getCrmLeadOptions('conv-1', { ...ATENDENTE, role }, amb.deps);
    assert.equal(r.status, 200, role);
    assert.deepEqual(amb.acessos, [['conv-1', 'colab-ana', role, 'org1']]);
  }
});

test('organização alheia e canal sem acesso: o erro do acesso sobe e nada vai ao CRM', async () => {
  const alheia = ambiente({ acesso: new HttpError(404, 'Conversa não encontrada') });
  await assert.rejects(getCrmLeadOptions('conv-b', ATENDENTE, alheia.deps), { statusCode: 404 });
  await assert.rejects(createCrmLeadFromConversation('conv-b', ATENDENTE, LEAD, alheia.deps), {
    statusCode: 404,
  });

  const semCanal = ambiente({ acesso: new HttpError(403, 'Você não tem acesso ao canal desta conversa') });
  await assert.rejects(getCrmLeadOptions('conv-1', ATENDENTE, semCanal.deps), { statusCode: 403 });

  assert.equal(alheia.pedidosDeOpcoes.length + alheia.cadastros.length + semCanal.pedidosDeOpcoes.length, 0);
});

test('conversa que some entre o acesso e a leitura é 404', async () => {
  const amb = ambiente({ alvo: null });
  await assert.rejects(getCrmLeadOptions('conv-1', ATENDENTE, amb.deps), { statusCode: 404 });
});

test('contato sem número (LID) e de Instagram são recusados com 422', async () => {
  const alvos: CrmLeadTarget[] = [
    { ...ALVO, contact: { ...CONTATO, jidSuffix: 'lid' } },
    { ...ALVO, channelType: 'INSTAGRAM', contact: { ...CONTATO, jidSuffix: 'ig' } },
    // Canal de Instagram com contato sem sufixo: o tipo do canal barra sozinho.
    { ...ALVO, channelType: 'INSTAGRAM' },
  ];
  for (const alvo of alvos) {
    const amb = ambiente({ alvo });
    await assert.rejects(getCrmLeadOptions('conv-1', ATENDENTE, amb.deps), {
      statusCode: 422,
      code: 'sem_numero',
      message: NO_PHONE_MESSAGE,
    });
    await assert.rejects(createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps), {
      statusCode: 422,
    });
    assert.equal(amb.pedidosDeOpcoes.length + amb.cadastros.length, 0);
  }
});

test('integração desligada vira 412 com o código desligado, nas duas rotas', async () => {
  const amb = ambiente({ opcoes: { ok: false, kind: 'desligado' }, cadastro: { ok: false, kind: 'desligado' } });
  const esperado = {
    status: 412,
    body: { error: LEAD_FAILURE_REPLY.desligado.error, code: 'desligado' },
  };

  assert.deepEqual(await getCrmLeadOptions('conv-1', ATENDENTE, amb.deps), esperado);
  assert.deepEqual(await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps), esperado);
});

// ── Opções ─────────────────────────────────────────────────────────────────

test('opções: 200 com as opções, pedidas com o e-mail da sessão', async () => {
  const amb = ambiente();

  assert.deepEqual(await getCrmLeadOptions('conv-1', ATENDENTE, amb.deps), { status: 200, body: OPCOES });
  assert.deepEqual(amb.pedidosDeOpcoes, [{ organizationId: 'org1', actorEmail: 'ana@academia.com' }]);
});

test('opções: chave recusada esquece o cartão guardado do número e responde 502', async () => {
  const amb = ambiente({ opcoes: { ok: false, kind: 'chave_invalida' } });
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), { found: false });

  const r = await getCrmLeadOptions('conv-1', ATENDENTE, amb.deps);

  assert.deepEqual(r, {
    status: 502,
    body: { error: LEAD_FAILURE_REPLY.chave_invalida.error, code: 'chave_invalida' },
  });
  assert.equal(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), undefined);
});

test('opções: recusa do Stronilead vai com o status, o código e o texto dela', async () => {
  const message = 'Seu e-mail do Stronizap, ana@academia.com, não está na equipe do Stronilead.';
  const amb = ambiente({
    opcoes: {
      ok: false,
      kind: 'recusa',
      status: 403,
      code: 'fora_da_equipe',
      message,
      field: null,
      card: null,
      createdAt: null,
    },
  });

  assert.deepEqual(await getCrmLeadOptions('conv-1', ATENDENTE, amb.deps), {
    status: 403,
    body: { error: message, code: 'fora_da_equipe' },
  });
});

test('opções: Stronilead fora do ar é 503', async () => {
  const amb = ambiente({ opcoes: { ok: false, kind: 'indisponivel' } });

  assert.deepEqual(await getCrmLeadOptions('conv-1', ATENDENTE, amb.deps), {
    status: 503,
    body: { error: LEAD_FAILURE_REPLY.indisponivel.error, code: 'indisponivel' },
  });
});

// ── Cadastro ───────────────────────────────────────────────────────────────

test('cadastro: quem cadastrou sai da sessão e do cadastro do colaborador; telefone e canal, da conversa', async () => {
  const amb = ambiente({ nome: 'Ana Souza' });

  await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps);

  assert.deepEqual(amb.cadastros, [
    {
      organizationId: 'org1',
      request: {
        phone: '5551998124471',
        actor: { email: 'ana@academia.com', name: 'Ana Souza' },
        channelName: 'Recepção',
        lead: LEAD,
      },
    },
  ]);
});

test('cadastro: deu certo, 201 com o cartão e os quatro passos', async () => {
  const amb = ambiente();
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), { found: false });

  const r = await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps);

  assert.deepEqual(r, { status: 201, body: { card: CARTAO } });
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), CARTAO);
  assert.deepEqual(amb.coberturas, [{ contactId: 'contato-1', card: CARTAO }]);
  assert.deepEqual(amb.nomes, [{ contato: CONTATO, card: CARTAO }]);
  // Sala do canal do contato, a mesma do contact_updated: quem não tem acesso
  // ao canal não recebe cartão de contato que não consegue abrir.
  assert.deepEqual(amb.eventos, [
    { channelId: 'canal-1', event: 'crm_card_updated', payload: { contactId: 'contato-1', card: CARTAO } },
  ]);
});

test('cadastro: número já cadastrado faz os mesmos quatro passos com o cartão que veio e responde 409', async () => {
  const message = 'Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.';
  const amb = ambiente({
    cadastro: {
      ok: false,
      kind: 'recusa',
      status: 409,
      code: 'ja_cadastrado',
      message,
      field: null,
      card: CARTAO,
      createdAt: '2026-09-29T14:32:00.000Z',
    },
  });

  const r = await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps);

  assert.deepEqual(r, {
    status: 409,
    body: { error: message, code: 'ja_cadastrado', card: CARTAO, createdAt: '2026-09-29T14:32:00.000Z' },
  });
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), CARTAO);
  assert.equal(amb.coberturas.length, 1);
  assert.equal(amb.nomes.length, 1);
  assert.equal(amb.eventos.length, 1);
});

test('cadastro: outra recusa não troca cartão, não grava nada e não avisa ninguém', async () => {
  const message = 'Essa modalidade não existe mais no Stronilead. Escolha de novo.';
  const amb = ambiente({
    cadastro: {
      ok: false,
      kind: 'recusa',
      status: 422,
      code: 'catalogo_mudou',
      message,
      field: 'modalidade',
      card: null,
      createdAt: null,
    },
  });
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), { found: false });

  const r = await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps);

  assert.deepEqual(r, { status: 422, body: { error: message, code: 'catalogo_mudou', field: 'modalidade' } });
  assert.deepEqual(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), { found: false });
  assert.equal(amb.coberturas.length + amb.nomes.length + amb.eventos.length, 0);
});

test('cadastro: Stronilead fora do ar é 503 e nada muda', async () => {
  const amb = ambiente({ cadastro: { ok: false, kind: 'indisponivel' } });

  const r = await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps);

  assert.deepEqual(r, {
    status: 503,
    body: { error: LEAD_FAILURE_REPLY.indisponivel.error, code: 'indisponivel' },
  });
  assert.equal(amb.eventos.length, 0);
});

test('cadastro: chave recusada esquece o cartão guardado e responde 502', async () => {
  const amb = ambiente({ cadastro: { ok: false, kind: 'chave_invalida' } });
  amb.cache.set(crmCacheKey('org1', CONTATO.phone), { found: false });

  const r = await createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps);

  assert.equal(r.status, 502);
  assert.equal(amb.cache.get(crmCacheKey('org1', CONTATO.phone)), undefined);
});

test('cadastro: colaborador que não existe mais é 404 e nada vai ao CRM', async () => {
  const amb = ambiente({ nome: null });

  await assert.rejects(createCrmLeadFromConversation('conv-1', ATENDENTE, LEAD, amb.deps), { statusCode: 404 });
  assert.equal(amb.cadastros.length, 0);
});

// ── Corpo do pedido ────────────────────────────────────────────────────────

test('schema: só o bloco lead passa; quem cadastrou, telefone e tenant vindos do navegador caem', () => {
  const corpo = crmLeadBodySchema.parse({
    lead: { ...LEAD, phone: '5511999999999', actor: { email: 'outra@academia.com' } },
    actor: { email: 'outra@academia.com', name: 'Outra' },
    phone: '5511999999999',
    tenant: 'outra-academia',
    channelName: 'Outro',
  });

  assert.deepEqual(corpo, { lead: LEAD });
});

test('schema: nome curto, WhatsApp do aluno com letra e item de lista vazio são recusados', () => {
  assert.equal(crmLeadBodySchema.safeParse({ lead: { ...LEAD, name: 'M' } }).success, false);
  assert.equal(crmLeadBodySchema.safeParse({ lead: { ...LEAD, dor: '  ' } }).success, false);
  assert.equal(
    crmLeadBodySchema.safeParse({
      lead: {
        ...LEAD,
        minor: { guardianName: 'Mariana', relationship: null, studentWhatsapp: '51abc99990000' },
      },
    }).success,
    false,
  );
  assert.equal(
    crmLeadBodySchema.safeParse({
      lead: { ...LEAD, minor: { guardianName: 'Mariana', relationship: 'Mãe', studentWhatsapp: '51999990000' } },
    }).success,
    true,
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsc -p tsconfig.test.json --noEmit`
Expected: FAIL: `Cannot find module './crm-lead.service'`.

- [ ] **Step 3: Criar `backend/src/services/crm-lead.service.ts`**

```ts
// Cadastro de lead no Stronilead a partir da conversa. Spec em
// stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md.
//
// As duas rotas da conversa (GET /:id/crm-lead-options e POST /:id/crm-lead)
// passam por aqui. Este arquivo confere quem pede e qual contato, fala com o
// CRM pelo crm.service.ts, o único que conhece a chave, e, quando o cartão
// novo chega, faz o que a rota do cartão faz: guarda no cache, marca a
// cobertura, grava o nome do cadastro e avisa quem está com o contato aberto.
//
// Quem cadastrou sai da sessão (e-mail) e do cadastro do colaborador (nome),
// nunca do corpo do pedido: o schema daqui só aceita o bloco `lead`.
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitToChannel } from '../lib/socket-emitter';
import type { RequestUser } from '../lib/jwt';
import { HttpError } from '../middleware/errorHandler';
import {
  createCrmLead,
  crmCache,
  fetchCrmLeadOptions,
  type CrmCache,
  type CrmCard,
  type CrmCreateLeadRequest,
  type CrmLeadCall,
  type CrmLeadFailure,
  type CrmLeadInput,
  type CrmLeadOptions,
} from './crm.service';
import { hasRealPhone, syncCrmName, type ContatoParaSync } from './crm-name.service';
import { registrarCoberturaDoCartao } from './crm-coverage.service';

export const SUPERADMIN_MESSAGE = 'O superadmin não cadastra lead no Stronilead.';
export const IMPERSONATION_MESSAGE =
  'Entrando como admin pelo painel do superadmin não dá para cadastrar lead no Stronilead.';
export const NO_PHONE_MESSAGE =
  'O cadastro pelo Stronizap vale só para contato de WhatsApp com número.';

/**
 * Status e texto das falhas que não são regra do Stronilead. Nunca 401: o
 * `api.ts` do front trata 401 como sessão vencida e renovaria o token.
 */
export const LEAD_FAILURE_REPLY = {
  desligado: { status: 412, error: 'A integração com o Stronilead está desligada nesta organização.' },
  chave_invalida: {
    status: 502,
    error: 'O Stronilead recusou a chave desta organização. O admin confere em Configurações → Stronilead.',
  },
  indisponivel: { status: 503, error: 'Não deu para falar com o Stronilead agora.' },
} as const;

/** Status e corpo prontos: a rota só escreve. */
export interface CrmLeadReply {
  status: number;
  body: unknown;
}

/** Quem pede: o `req.user` da sessão. */
export type CrmLeadViewer = Pick<RequestUser, 'sub' | 'email' | 'role' | 'orgId' | 'imp'>;

/** A conversa, o canal e o contato que o cadastro usa. */
export interface CrmLeadTarget {
  conversationId: string;
  channelType: string;
  channelName: string;
  contact: ContatoParaSync;
}

/**
 * Tudo que o serviço usa de fora. Entra por parâmetro com o valor real como
 * padrão, no molde do crm.service.ts e do rewrite.service.ts: o teste passa
 * as versões dele sem banco, sem rede e sem mock de módulo.
 */
export interface CrmLeadDeps {
  /** Lança 404 (conversa inexistente ou de outra organização) ou 403 (sem acesso ao canal). */
  assertAccess: (
    conversationId: string,
    viewerId: string,
    viewerRole: string,
    viewerOrgId: string | null,
  ) => Promise<unknown>;
  loadTarget: (conversationId: string, organizationId: string) => Promise<CrmLeadTarget | null>;
  /** Nome do colaborador no cadastro do Stronizap. */
  loadActorName: (collaboratorId: string, organizationId: string) => Promise<string | null>;
  fetchOptions: (organizationId: string, actorEmail: string) => Promise<CrmLeadCall<CrmLeadOptions>>;
  createLead: (
    organizationId: string,
    request: CrmCreateLeadRequest,
  ) => Promise<CrmLeadCall<{ card: CrmCard }>>;
  cache: CrmCache;
  /** Marca `crmFound` no contato. Nunca lança. */
  registrarCobertura: (contactId: string, card: CrmCard) => Promise<void>;
  /** Grava o nome do cadastro e avisa pelo `contact_updated`. Nunca lança. */
  syncName: (contato: ContatoParaSync, card: CrmCard) => Promise<unknown>;
  emit: (channelId: string, event: string, payload: unknown) => void;
  log: Pick<typeof logger, 'info'>;
}

const depsReais: CrmLeadDeps = {
  assertAccess: async (conversationId, viewerId, viewerRole, viewerOrgId) => {
    // Import tardio: o conversation.service carrega o Baileys, que o tsx dos
    // testes não consegue carregar. Mesmo motivo do rewrite.service.ts.
    const { assertCanAccessConversation } = await import('./conversation.service');
    return assertCanAccessConversation(conversationId, viewerId, viewerRole, viewerOrgId);
  },
  loadTarget: async (conversationId, organizationId) => {
    const conversa = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: {
        id: true,
        channel: { select: { type: true, name: true } },
        contact: {
          select: {
            id: true,
            organizationId: true,
            channelId: true,
            phone: true,
            jidSuffix: true,
            displayName: true,
          },
        },
      },
    });
    if (!conversa) return null;
    return {
      conversationId: conversa.id,
      channelType: conversa.channel.type,
      channelName: conversa.channel.name,
      contact: conversa.contact,
    };
  },
  loadActorName: async (collaboratorId, organizationId) => {
    const colaborador = await prisma.collaborator.findFirst({
      where: { id: collaboratorId, organizationId },
      select: { name: true },
    });
    return colaborador?.name.trim() || null;
  },
  fetchOptions: (organizationId, actorEmail) => fetchCrmLeadOptions(organizationId, actorEmail),
  createLead: (organizationId, request) => createCrmLead(organizationId, request),
  cache: crmCache,
  registrarCobertura: (contactId, card) => registrarCoberturaDoCartao(contactId, { card, reason: null }),
  syncName: (contato, card) => syncCrmName(contato, { card, reason: null }),
  emit: emitToChannel,
  log: logger,
};

const nomeDePessoa = z.string().trim().min(2).max(120);
const itemDeLista = z.string().trim().min(1).max(120);

/**
 * Corpo do POST /conversations/:id/crm-lead. Só o bloco `lead`: o que vier a
 * mais (quem cadastrou, telefone, tenant, canal) o zod descarta, e o serviço
 * monta com o que a sessão, o banco e a conversa dizem. As listas são
 * conferidas de verdade pelo Stronilead, contra o catálogo dele.
 */
export const crmLeadBodySchema = z.object({
  lead: z.object({
    name: nomeDePessoa,
    source: itemDeLista,
    dor: itemDeLista,
    modalidade: itemDeLista.nullable(),
    funnelId: itemDeLista,
    stage: itemDeLista,
    ownerId: z.string().trim().min(1).max(128).nullable(),
    minor: z
      .object({
        guardianName: nomeDePessoa,
        relationship: z.string().trim().min(1).max(40).nullable(),
        studentWhatsapp: z.string().regex(/^\d{10,13}$/).nullable(),
      })
      .nullable(),
  }),
});

/**
 * As portas das duas rotas, nesta ordem. Superadmin primeiro, porque
 * `isSameTenant(null, X)` deixaria ele passar em qualquer organização.
 * Sessão emprestada em seguida: o lead nasceria em nome do admin
 * impersonado. Depois o acesso à conversa, e por fim o contato: Instagram e
 * LID guardam um id no lugar do telefone, e o casamento do CRM aceitaria esse
 * id como número.
 */
async function alvoDoCadastro(
  conversationId: string,
  viewer: CrmLeadViewer,
  d: CrmLeadDeps,
): Promise<{ organizationId: string; target: CrmLeadTarget }> {
  const organizationId = viewer.orgId;
  if (organizationId === null) throw new HttpError(403, SUPERADMIN_MESSAGE, 'superadmin');
  if (viewer.imp) throw new HttpError(403, IMPERSONATION_MESSAGE, 'impersonacao');

  await d.assertAccess(conversationId, viewer.sub, viewer.role, organizationId);

  const target = await d.loadTarget(conversationId, organizationId);
  if (!target) throw new HttpError(404, 'Conversa não encontrada');
  if (target.channelType !== 'WHATSAPP' || !hasRealPhone(target.contact)) {
    throw new HttpError(422, NO_PHONE_MESSAGE, 'sem_numero');
  }
  return { organizationId, target };
}

/**
 * Corpo único para o navegador: `error` é o texto para a tela e `code`, o
 * código. Recusa do Stronilead leva o texto dela, e o campo, o cartão e a
 * data quando vierem.
 */
function respostaDeFalha(falha: CrmLeadFailure): CrmLeadReply {
  if (falha.kind === 'recusa') {
    const body: Record<string, unknown> = { error: falha.message, code: falha.code };
    if (falha.field) body.field = falha.field;
    if (falha.card) body.card = falha.card;
    if (falha.createdAt) body.createdAt = falha.createdAt;
    return { status: falha.status, body };
  }
  const { status, error } = LEAD_FAILURE_REPLY[falha.kind];
  return { status, body: { error, code: falha.kind } };
}

/**
 * O cartão novo vale para todo mundo na hora: cache (senão a rota do cartão
 * devolveria "Sem cadastro" por até dois minutos), cobertura do painel, nome
 * do contato e o aviso na sala do canal, a mesma do `contact_updated`, para
 * quem não tem acesso ao canal não receber cartão de contato que não abre.
 */
async function aplicarCartao(target: CrmLeadTarget, card: CrmCard, d: CrmLeadDeps): Promise<void> {
  const contato = target.contact;
  d.cache.replaceCard(contato.organizationId, contato.phone, card);
  await d.registrarCobertura(contato.id, card);
  await d.syncName(contato, card);
  d.emit(contato.channelId, 'crm_card_updated', { contactId: contato.id, card });
}

/** GET /conversations/:id/crm-lead-options. */
export async function getCrmLeadOptions(
  conversationId: string,
  viewer: CrmLeadViewer,
  deps: Partial<CrmLeadDeps> = {},
): Promise<CrmLeadReply> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await alvoDoCadastro(conversationId, viewer, d);
  const call = await d.fetchOptions(organizationId, viewer.email);
  if (call.ok) return { status: 200, body: call.value };
  // Chave recusada: o "Sem cadastro" guardado some, e a próxima leitura do
  // cartão vai ao CRM, que responde como a rota do cartão sempre respondeu.
  if (call.kind === 'chave_invalida') d.cache.forget(organizationId, target.contact.phone);
  return respostaDeFalha(call);
}

/** POST /conversations/:id/crm-lead. */
export async function createCrmLeadFromConversation(
  conversationId: string,
  viewer: CrmLeadViewer,
  lead: CrmLeadInput,
  deps: Partial<CrmLeadDeps> = {},
): Promise<CrmLeadReply> {
  const d = { ...depsReais, ...deps };
  const { organizationId, target } = await alvoDoCadastro(conversationId, viewer, d);

  const actorName = await d.loadActorName(viewer.sub, organizationId);
  if (!actorName) throw new HttpError(404, 'Colaborador não encontrado');

  const call = await d.createLead(organizationId, {
    phone: target.contact.phone,
    actor: { email: viewer.email, name: actorName },
    channelName: target.channelName,
    lead,
  });

  if (call.ok) {
    await aplicarCartao(target, call.value.card, d);
    // Só ids no log: nome e telefone da pessoa ficam fora.
    d.log.info(
      { organizationId, conversationId, contactId: target.contact.id },
      'Lead cadastrado no Stronilead pelo Stronizap',
    );
    return { status: 201, body: { card: call.value.card } };
  }

  // Número que já estava no CRM: o cartão que veio é o de verdade, e a tela
  // de todo mundo passa a mostrá-lo, igual a um cadastro novo.
  if (call.kind === 'recusa' && call.code === 'ja_cadastrado' && call.card) {
    await aplicarCartao(target, call.card, d);
  }
  if (call.kind === 'chave_invalida') d.cache.forget(organizationId, target.contact.phone);
  return respostaDeFalha(call);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npm test && npm run typecheck`
Expected: PASS, com os 20 testes novos do `crm-lead.service.test.ts`, e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-lead.service.ts backend/src/services/crm-lead.service.test.ts
git commit -m "feat: serviço do cadastro de lead confere quem pede e aplica o cartão novo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rotas da conversa e suíte de isolamento

**Files:**
- Modify: `backend/src/routes/conversations.routes.ts` (import na linha 12, rotas depois da linha 622)
- Modify: `backend/src/routes/tenant-isolation.spec.ts` (cabeçalho e bloco novo antes da linha 1063)

A suíte de isolamento sobe o roteador de verdade sobre o build, contra um PostgreSQL descartável. As duas organizações da suíte estão com a integração desligada, então nada sai para a rede: o que se prova é a ordem das portas.

- [ ] **Step 1: Banco descartável da suíte**

O PostgreSQL da máquina do Johnny é o do Homebrew, em `localhost:5432` (CLAUDE.md, seção 11). O script `test:isolation` usa `stronizap_isolation_test` quando `TEST_DATABASE_URL` não vem.

```bash
pg_isready -h localhost -p 5432
createdb stronizap_isolation_test 2>/dev/null || true
cd backend
DATABASE_URL="postgresql://$USER@localhost:5432/stronizap_isolation_test?schema=public" npx prisma migrate deploy
```

Expected: `accepting connections` e `All migrations have been successfully applied.` (ou `No pending migrations to apply.`).

- [ ] **Step 2: Escrever os testes que falham**

Em `backend/src/routes/tenant-isolation.spec.ts`, no comentário do topo, logo depois do parágrafo que começa com "E o "Esqueci a senha"" (linhas 26-29) e antes do ` */` da linha 30, acrescentar:

```ts
 *
 * E as duas rotas do cadastro de lead no Stronilead (spec 2026-09-29): a
 * ordem das portas (organização, canal, superadmin, sessão emprestada,
 * contato sem número) antes de qualquer conversa com o CRM.
```

E, logo antes do comentário `// ── Esqueci a senha (spec 2026-09-22) ──` (linha 1063), acrescentar:

```ts
  // ── Cadastro de lead no Stronilead (spec 2026-09-29) ───────────────────────
  // As duas organizações estão com a integração desligada, então nada sai
  // para a rede. Conversa de outra organização é 404, canal sem acesso é 403,
  // superadmin e sessão emprestada são 403 antes de olhar a conversa, contato
  // sem número é 422, e só quem passa por tudo chega na integração (412).

  const CORPO_DO_LEAD = {
    lead: {
      name: 'Mariana Souza',
      source: 'WhatsApp',
      dor: 'Postura',
      modalidade: null,
      funnelId: 'comercial',
      stage: 'Novo lead',
      ownerId: null,
      minor: null,
    },
  };

  function opcoesDoCadastro(token: string, conversationId: string) {
    return como(token, `/api/conversations/${conversationId}/crm-lead-options`);
  }

  function cadastrar(token: string, conversationId: string) {
    return como(token, `/api/conversations/${conversationId}/crm-lead`, {
      method: 'POST',
      body: JSON.stringify(CORPO_DO_LEAD),
    });
  }

  async function codigo(res: Response): Promise<string | undefined> {
    return ((await res.json()) as { code?: string }).code;
  }

  test('cadastro de lead: conversa de outra org é 404 nas duas rotas', async () => {
    assert.equal((await opcoesDoCadastro(tokenA, B.conversationId)).status, 404);
    assert.equal((await cadastrar(tokenA, B.conversationId)).status, 404);
  });

  test('cadastro de lead: canal que o atendente não atende é 403 nas duas rotas', async () => {
    assert.equal((await opcoesDoCadastro(tokenAtendenteA, A.filaRestritaId)).status, 403);
    assert.equal((await cadastrar(tokenAtendenteA, A.filaRestritaId)).status, 403);
  });

  test('cadastro de lead: superadmin é recusado, mesmo na conversa que existe', async () => {
    for (const res of [
      await opcoesDoCadastro(tokenSuperAdmin, A.conversationId),
      await cadastrar(tokenSuperAdmin, A.conversationId),
    ]) {
      assert.equal(res.status, 403);
      assert.equal(await codigo(res), 'superadmin');
    }
  });

  test('cadastro de lead: a sessão do superadmin entrando como admin é recusada', async () => {
    const tokenEmprestado = signAccessToken({
      sub: A.adminId,
      email: A.adminEmail,
      role: 'ADMIN',
      tv: 0,
      orgId: A.orgId,
      imp: { byId: 'superadmin-iso' },
    });
    for (const res of [
      await opcoesDoCadastro(tokenEmprestado, A.conversationId),
      await cadastrar(tokenEmprestado, A.conversationId),
    ]) {
      assert.equal(res.status, 403);
      assert.equal(await codigo(res), 'impersonacao');
    }
  });

  test('cadastro de lead: contato sem número (LID) e contato de Instagram são 422', async () => {
    const lid = await prisma.contact.create({
      data: {
        organizationId: A.orgId,
        channelId: A.channelId,
        phone: '208912345678901',
        jidSuffix: 'lid',
        name: 'Contato LID iso',
      },
    });
    const conversaLid = await prisma.conversation.create({
      data: { organizationId: A.orgId, channelId: A.channelId, contactId: lid.id, status: 'PENDING' },
    });
    const canalInstagram = await prisma.channel.create({
      data: { organizationId: A.orgId, name: 'Instagram iso', type: 'INSTAGRAM', sessionPath: '/tmp/iso-a-ig' },
    });
    const ig = await prisma.contact.create({
      data: {
        organizationId: A.orgId,
        channelId: canalInstagram.id,
        phone: '17841400000000001',
        jidSuffix: 'ig',
        name: 'Contato IG iso',
      },
    });
    const conversaIg = await prisma.conversation.create({
      data: { organizationId: A.orgId, channelId: canalInstagram.id, contactId: ig.id, status: 'PENDING' },
    });

    for (const conversationId of [conversaLid.id, conversaIg.id]) {
      for (const res of [await opcoesDoCadastro(tokenA, conversationId), await cadastrar(tokenA, conversationId)]) {
        assert.equal(res.status, 422, conversationId);
        assert.equal(await codigo(res), 'sem_numero');
      }
    }
  });

  test('cadastro de lead: quem passa por todas as portas chega na integração, que está desligada (controle positivo)', async () => {
    for (const res of [
      await opcoesDoCadastro(tokenA, A.conversationId),
      await cadastrar(tokenA, A.conversationId),
      await opcoesDoCadastro(tokenAtendenteA, A.filaLiberadaId),
    ]) {
      assert.equal(res.status, 412);
      assert.equal(await codigo(res), 'desligado');
    }
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npm run test:isolation`
Expected: FAIL nos testes de superadmin, sessão emprestada, 422 e 412: sem as rotas, o Express responde 404 para tudo. O teste da outra organização passa por acaso (404) e o do canal sem acesso falha (espera 403).

- [ ] **Step 4: Rotas em `backend/src/routes/conversations.routes.ts`**

Logo depois de `import * as rewriteService from '../services/rewrite.service';` (linha 12), acrescentar:

```ts
import * as crmLeadService from '../services/crm-lead.service';
```

Logo depois da rota `router.post('/:id/rewrite', ...)` (termina na linha 622) e antes do comentário `// Envio de cartão de contato (vCard)`, acrescentar:

```ts
// Cadastro de lead no Stronilead a partir da conversa (spec
// stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md).
// Mora sob a conversa porque é ela que diz o canal, que vai no registro do
// Stronilead e decide quem pode. O serviço devolve status e corpo prontos:
// recusa do Stronilead leva o texto dela e, às vezes, campo e cartão, que o
// errorHandler global não sabe mandar.
router.get('/:id/crm-lead-options', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    const reply = await crmLeadService.getCrmLeadOptions(req.params.id, req.user);
    res.status(reply.status).json(reply.body);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/crm-lead', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado');
    // Só o bloco `lead`: quem cadastrou, telefone e canal o serviço tira da
    // sessão e da conversa, nunca do corpo.
    const { lead } = crmLeadService.crmLeadBodySchema.parse(req.body);
    const reply = await crmLeadService.createCrmLeadFromConversation(req.params.id, req.user, lead);
    res.status(reply.status).json(reply.body);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npm run typecheck && npm test && npm run test:isolation`
Expected: typecheck limpo, suíte rápida verde e suíte de isolamento verde, com os seis testes novos de cadastro de lead.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/conversations.routes.ts backend/src/routes/tenant-isolation.spec.ts
git commit -m "feat: rotas de opções e cadastro de lead sob a conversa, cobertas no isolamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Smoke confere `lead-options` e nunca cadastra

**Files:**
- Modify: `backend/src/scripts/smoke-crm-card.ts`
- Create: `backend/src/scripts/smoke-crm-card.guard.test.ts`

O smoke roda no servidor contra o Stronilead de produção. As opções só leem; o cadastro gravaria um lead de verdade na academia e fica proibido no smoke, com uma trava no `npm test`.

- [ ] **Step 1: Escrever a trava**

Criar `backend/src/scripts/smoke-crm-card.guard.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// O smoke do cartão roda contra o Stronilead de produção. A ação de cadastro
// grava um lead de verdade na academia, então ela nunca pode aparecer nele.
// A conferência é de texto, de propósito: pega até um import esquecido.
test('smoke do cartão nunca chama o cadastro de lead', () => {
  const fonte = readFileSync(path.join(__dirname, 'smoke-crm-card.ts'), 'utf8');

  assert.equal(fonte.includes('createCrmLead'), false);
  assert.equal(fonte.includes("'create-lead'"), false);
  assert.equal(fonte.includes('"create-lead"'), false);
});
```

- [ ] **Step 2: Rodar a trava**

Run: `cd backend && npm test`
Expected: PASS. A trava nasce verde e existe para o futuro: quem acrescentar o cadastro ao smoke derruba o `npm test`.

- [ ] **Step 3: Cabeçalho e imports do smoke**

Em `backend/src/scripts/smoke-crm-card.ts`, trocar o trecho do comentário do topo que vai de ` * A chave de integração nunca é impressa.` até o fim do comentário (linhas 20-31) por:

```ts
 * A chave de integração nunca é impressa. O smoke inclusive confere que ela
 * não voltou dentro do cartão.
 *
 * Confere também as opções do cadastro de lead (a ação lead-options), que só
 * leem. O cadastro em si grava um lead de verdade e nunca roda aqui: o
 * `smoke-crm-card.guard.test.ts` trava isso no `npm test`.
 *
 * Uso:
 *   npx tsx src/scripts/smoke-crm-card.ts <telefone> [slug-da-org] [email-da-equipe]
 *
 * Exemplo:
 *   npx tsx src/scripts/smoke-crm-card.ts 5511987654321 stronix-crm-app pessoa@academia.com.br
 *
 * Sem o slug, o smoke usa a única organização com a integração ligada. Se
 * houver mais de uma, ele pede o slug em vez de escolher sozinho. Sem o
 * e-mail, as opções são pedidas como o admin mais antigo da organização no
 * Stronizap, que precisa estar na equipe do Stronilead com o mesmo e-mail.
 */
```

Trocar os imports (linhas 32-35) por:

```ts
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';
import { maskEmail } from '../lib/maskEmail';
import { fetchCrmCard, fetchCrmLeadOptions } from '../services/crm.service';
import type { CrmCard, CrmResult, CrmWard } from '../services/crm.service';
```

- [ ] **Step 4: A conferência das opções**

Logo depois da função `resumo` (termina na linha 444) e antes de `async function main()`, acrescentar:

```ts
/** E-mail do admin mais antigo e ativo da organização no Stronizap. */
async function emailDoAdmin(organizationId: string): Promise<string | null> {
  const admin = await prisma.collaborator.findFirst({
    where: { organizationId, role: 'ADMIN', active: true },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });
  return admin?.email ?? null;
}

/**
 * [4] Opções do cadastro de lead. Só lê. Confere o que a tela precisa para
 * abrir o formulário e avisa o que falta na academia antes de ligar o
 * cadastro (origem com "WhatsApp" no nome e dores cadastradas).
 */
async function conferirOpcoes(org: OrgDoSmoke, emailInformado: string | undefined): Promise<boolean> {
  console.log('\n[4] opções do cadastro de lead (lead-options, só leitura)');

  const email = emailInformado?.trim().toLowerCase() || (await emailDoAdmin(org.id));
  if (!email) {
    nota('a organização não tem admin ativo. Passe o e-mail de alguém da equipe como terceiro argumento.');
    return false;
  }
  if (!emailInformado) nota(`perguntando como o admin mais antigo da organização (${maskEmail(email)}).`);

  const r = await fetchCrmLeadOptions(org.id, email);

  if (!r.ok) {
    if (r.kind === 'recusa') {
      check('recusa traz o código e o texto pronto', r.code !== '' && r.message !== '', r);
      nota(`o Stronilead recusou (${r.status} ${r.code}): ${r.message}`);
      if (r.code === 'fora_da_equipe') {
        nota('passe como terceiro argumento o e-mail de alguém que está na equipe do Stronilead.');
      }
    } else {
      check(`opções responderam (veio ${r.kind})`, false);
    }
    return false;
  }

  const o = r.value;
  check("actor.role é 'consultor' ou 'gestor'", o.actor.role === 'consultor' || o.actor.role === 'gestor', o.actor.role);
  check('tem pelo menos uma origem', o.sources.length > 0, o.sources.length);
  check('tem pelo menos um funil com etapa', o.funnels.some((f) => f.stages.length > 0), o.funnels.length);
  check('parentescos vêm do Stronilead', o.relationships.length > 0, o.relationships);
  check(
    'origem padrão existe na lista',
    o.defaults.source === null || o.sources.some((s) => s.name === o.defaults.source),
    o.defaults.source,
  );
  const funilPadrao = o.funnels.find((f) => f.id === o.defaults.funnelId);
  check('funil padrão existe na lista', o.defaults.funnelId === null || Boolean(funilPadrao), o.defaults.funnelId);
  check(
    'etapa padrão existe no funil padrão',
    o.defaults.stage === null || Boolean(funilPadrao?.stages.some((s) => s.name === o.defaults.stage)),
    o.defaults.stage,
  );
  check(
    'equipe só vem para gestor',
    o.actor.role === 'gestor' ? Array.isArray(o.team) : o.team === undefined,
    o.team?.length,
  );
  check(
    'nenhum campo das opções tem cara de credencial ou de e-mail',
    !chavesAninhadas(o).some((k) => /key|token|secret|senha|email/i.test(k)),
  );

  if (o.dores.length === 0) {
    nota('a academia não tem dor cadastrada: o formulário trava no campo Dor até o gestor cadastrar.');
  }
  if (!o.sources.some((s) => /whatsapp/i.test(s.name))) {
    nota('nenhuma origem com "WhatsApp" no nome: o formulário abre com a origem que o Stronilead escolher.');
  }

  console.log(`  quem pede:  ${o.actor.name ?? '(sem nome no Stronilead)'} (${o.actor.role})`);
  console.log(
    `  listas:     ${o.sources.length} origens · ${o.dores.length} dores · ${o.modalities.length} modalidades · ${o.funnels.length} funis`,
  );
  console.log(`  padrão:     ${o.defaults.source ?? '-'} · ${o.defaults.funnelId ?? '-'} · ${o.defaults.stage ?? '-'}`);
  return true;
}
```

- [ ] **Step 5: `main` chama as opções e cobra o resultado**

Em `main`, trocar a mensagem de uso do telefone faltando (linhas 451-454):

```ts
    abortar(
      'Faltou o telefone.',
      'Uso: npx tsx src/scripts/smoke-crm-card.ts <telefone> [slug-da-org]',
    );
```

por:

```ts
    abortar(
      'Faltou o telefone.',
      'Uso: npx tsx src/scripts/smoke-crm-card.ts <telefone> [slug-da-org] [email-da-equipe]',
    );
```

Trocar a linha `if (res.card) resumo(res.card);` (linha 508) por:

```ts
  if (res.card) resumo(res.card);

  // Opções do cadastro de lead: só leitura. O cadastro em si nunca roda aqui.
  const conferiuOpcoes = await conferirOpcoes(org, process.argv[4]);
```

E trocar o fim de `main`, do `console.log('\n✅ SMOKE CRM CARD OK ...` até o `process.exit(0);` (linhas 530-532), por:

```ts
  if (!conferiuOpcoes) {
    console.error('\n❌ SMOKE INCOMPLETO: o cartão está certo, mas as opções do cadastro de lead não foram conferidas.');
    console.error('   Rode com o e-mail de alguém da equipe do Stronilead como terceiro argumento, com o CRM no ar.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão e opções do cadastro)');
  await prisma.$disconnect();
  process.exit(0);
```

- [ ] **Step 6: Conferir tipos e a trava**

Run: `cd backend && npm run typecheck && npm test`
Expected: typecheck limpo e a suíte verde, com a trava. O smoke de verdade roda contra o Stronilead de produção, com o PR 1 no ar: primeiro na máquina, no teste de ponta a ponta da Task 17 (Step 4), e depois no servidor, antes do reload (Step 5).

- [ ] **Step 7: Commit**

```bash
git add backend/src/scripts/smoke-crm-card.ts backend/src/scripts/smoke-crm-card.guard.test.ts
git commit -m "chore: smoke do cartão confere as opções do cadastro e nunca cadastra

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tipos do front e o endereço da ficha

**Files:**
- Modify: `frontend/src/types/crm.ts` (fim do arquivo, depois de `crmHeaderText`, linha 180)
- Test: `frontend/src/types/crm.test.ts`

`frontend/src/types/crm.ts` é um dos arquivos do contrato: os tipos novos espelham os de `backend/src/services/crm.service.ts` (Tasks 2 e 3).

- [ ] **Step 1: Escrever os testes que falham**

Em `frontend/src/types/crm.test.ts`, trocar a linha 3:

```ts
import { crmHeaderText, crmStatus, crmWardNames } from './crm';
```

por:

```ts
import { crmFichaHref, crmHeaderText, crmStatus, crmWardNames } from './crm';
```

E acrescentar no fim do arquivo:

```ts
describe('crmFichaHref', () => {
  const link = { baseUrl: 'https://stronilead.com.br', tenantSlug: 'stronix-crm-app' };

  test('monta endereço do CRM, academia e id do lead', () => {
    expect(crmFichaHref(link, 'abc123')).toBe('https://stronilead.com.br/stronix-crm-app/ficha/abc123');
  });

  test('endereço antigo com /api/zap ou barra no fim sai limpo', () => {
    expect(crmFichaHref({ ...link, baseUrl: 'https://crm-stronix.vercel.app/api/zap/' }, 'abc')).toBe(
      'https://crm-stronix.vercel.app/stronix-crm-app/ficha/abc',
    );
    expect(crmFichaHref({ ...link, baseUrl: 'https://stronilead.com.br//' }, 'abc')).toBe(
      'https://stronilead.com.br/stronix-crm-app/ficha/abc',
    );
  });

  test('sem link, sem id, com academia vazia ou endereço que não é http, não há link', () => {
    expect(crmFichaHref(null, 'abc')).toBeNull();
    expect(crmFichaHref(link, null)).toBeNull();
    expect(crmFichaHref(link, '   ')).toBeNull();
    expect(crmFichaHref(link, 42)).toBeNull();
    expect(crmFichaHref({ ...link, tenantSlug: ' ' }, 'abc')).toBeNull();
    expect(crmFichaHref({ ...link, baseUrl: 'javascript:alert(1)' }, 'abc')).toBeNull();
  });

  test('academia e id vão escapados', () => {
    expect(crmFichaHref({ ...link, tenantSlug: 'a b' }, 'x/y')).toBe('https://stronilead.com.br/a%20b/ficha/x%2Fy');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/types/crm.test.ts`
Expected: FAIL, porque `crmFichaHref` não existe.

- [ ] **Step 3: Implementar no fim de `frontend/src/types/crm.ts`**

```ts
// ── Cadastro de lead pelo Stronizap (spec 2026-09-29) ──────────────────────
// Espelho dos tipos de `backend/src/services/crm.service.ts`. Nenhuma lista
// mora aqui: origem, dor, modalidade, funil, etapa, parentesco e equipe
// chegam de `lead-options` a cada abertura do formulário.

/** Opções do formulário, em lista fechada: o backend monta o objeto de novo. */
export interface CrmLeadOptions {
  /** `name` null: a pessoa não tem nome no cadastro da equipe do Stronilead. */
  actor: { id: string; name: string | null; role: 'consultor' | 'gestor' };
  sources: Array<{ name: string }>;
  dores: Array<{ name: string }>;
  modalities: Array<{ name: string }>;
  funnels: Array<{ id: string; name: string; stages: Array<{ name: string }> }>;
  relationships: string[];
  defaults: { source: string | null; funnelId: string | null; stage: string | null };
  /** Só para gestor, sem e-mail. */
  team?: Array<{ id: string; name: string }>;
}

/**
 * O que o navegador manda em POST /conversations/:id/crm-lead, dentro de
 * `lead`. Quem cadastrou, telefone e canal o backend põe.
 */
export interface CrmLeadInput {
  /** No menor, o nome do aluno. */
  name: string;
  source: string;
  dor: string;
  modalidade: string | null;
  funnelId: string;
  stage: string;
  /** Só quando o gestor escolheu outra pessoa. */
  ownerId: string | null;
  minor: null | {
    guardianName: string;
    relationship: string | null;
    studentWhatsapp: string | null;
  };
}

/** Motivos de recusa do Stronilead. Chegam em `code`, com o texto pronto em `error`. */
export type CrmLeadRefusalCode =
  | 'dados_invalidos'
  | 'academia_bloqueada'
  | 'fora_da_equipe'
  | 'ja_cadastrado'
  | 'catalogo_mudou'
  | 'sem_dor_cadastrada'
  | 'responsavel_invalido'
  | 'menor_invalido'
  | 'limite';

/** Endereço do Stronilead e identificador da academia, da configuração da organização. */
export interface CrmFichaLink {
  baseUrl: string;
  tenantSlug: string;
}

/**
 * Endereço da ficha no Stronilead: `<endereço>/<academia>/ficha/<id>`. Só o
 * id vai na URL, nunca nome nem telefone, como pede o Stronilead. Endereço
 * gravado antes de 15/09/2026 pode ter `/api/zap` no fim, e ele sai aqui.
 * Sem link, sem id ou com endereço que não é http, não há link.
 */
export function crmFichaHref(link: CrmFichaLink | null | undefined, leadId: unknown): string | null {
  if (!link || typeof leadId !== 'string' || !leadId.trim()) return null;
  const base = link.baseUrl.trim().replace(/\/+$/, '').replace(/\/api\/zap$/i, '');
  const academia = link.tenantSlug.trim();
  if (!/^https?:\/\/[^/]/i.test(base) || !academia) return null;
  return `${base}/${encodeURIComponent(academia)}/ficha/${encodeURIComponent(leadId.trim())}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/types/crm.test.ts && npm run typecheck`
Expected: PASS e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/crm.ts frontend/src/types/crm.test.ts
git commit -m "feat: tipos do cadastro de lead e endereço da ficha no Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `lib/crmLead.ts`, as chamadas e a leitura das falhas

**Files:**
- Create: `frontend/src/lib/crmLead.ts`
- Create: `frontend/src/lib/crmLead.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmLead.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

import {
  classifyLeadFailure,
  createLead,
  fetchLeadOptions,
  parseCrmCardUpdate,
  RECUSA_SEM_TEXTO,
} from './crmLead';
import type { CrmCard, CrmLeadInput, CrmLeadOptions } from '../types/crm';

function erroHttp(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

const semResposta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const CARTAO: CrmCard = { found: true, leadId: 'lead-1', kind: 'lead', name: 'Mariana Souza', stage: 'Novo lead' };

const LEAD: CrmLeadInput = {
  name: 'Mariana Souza',
  source: 'WhatsApp',
  dor: 'Postura',
  modalidade: null,
  funnelId: 'comercial',
  stage: 'Novo lead',
  ownerId: null,
  minor: null,
};

const OPCOES: CrmLeadOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
  sources: [{ name: 'WhatsApp' }],
  dores: [{ name: 'Postura' }],
  modalities: [],
  funnels: [{ id: 'comercial', name: 'Comercial', stages: [{ name: 'Novo lead' }] }],
  relationships: ['Mãe'],
  defaults: { source: 'WhatsApp', funnelId: 'comercial', stage: 'Novo lead' },
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('classifyLeadFailure', () => {
  test('sem resposta, 5xx e o indisponível do backend: tentar de novo', () => {
    expect(classifyLeadFailure(semResposta())).toEqual({ kind: 'indisponivel' });
    expect(
      classifyLeadFailure(erroHttp(503, { error: 'Não deu para falar com o Stronilead agora.', code: 'indisponivel' })),
    ).toEqual({ kind: 'indisponivel' });
    expect(classifyLeadFailure(erroHttp(500, { error: 'Erro interno do servidor' }))).toEqual({ kind: 'indisponivel' });
  });

  test('integração desligada e chave recusada: a seção some, como no cartão', () => {
    expect(classifyLeadFailure(erroHttp(412, { error: 'x', code: 'desligado' }))).toEqual({
      kind: 'sumiu',
      reason: 'desligado',
    });
    expect(classifyLeadFailure(erroHttp(502, { error: 'x', code: 'chave_invalida' }))).toEqual({
      kind: 'sumiu',
      reason: 'indisponivel',
    });
  });

  test('recusa do Stronilead vem com o texto, o código e o campo', () => {
    const message = 'Essa modalidade não existe mais no Stronilead. Escolha de novo.';
    expect(classifyLeadFailure(erroHttp(422, { error: message, code: 'catalogo_mudou', field: 'modalidade' }))).toEqual({
      kind: 'recusa',
      code: 'catalogo_mudou',
      message,
      field: 'modalidade',
    });
  });

  test('recusa do próprio Stronizap usa o texto de lá, e sem texto usa a reserva', () => {
    expect(classifyLeadFailure(erroHttp(400, { error: 'Dados inválidos', details: {} }))).toEqual({
      kind: 'recusa',
      code: null,
      message: 'Dados inválidos',
      field: null,
    });
    expect(classifyLeadFailure(erroHttp(403, {}))).toEqual({
      kind: 'recusa',
      code: null,
      message: RECUSA_SEM_TEXTO,
      field: null,
    });
  });
});

describe('fetchLeadOptions', () => {
  test('pede as opções da conversa', async () => {
    get.mockResolvedValueOnce({ data: OPCOES });

    expect(await fetchLeadOptions('conv-1')).toEqual({ kind: 'ok', options: OPCOES });
    expect(get).toHaveBeenCalledWith('/conversations/conv-1/crm-lead-options');
  });

  test('fora da equipe é recusa com o texto do Stronilead', async () => {
    const message = 'Seu e-mail do Stronizap, bia@stronix.com.br, não está na equipe do Stronilead.';
    get.mockRejectedValueOnce(erroHttp(403, { error: message, code: 'fora_da_equipe' }));

    expect(await fetchLeadOptions('conv-1')).toEqual({ kind: 'recusa', code: 'fora_da_equipe', message, field: null });
  });
});

describe('createLead', () => {
  test('manda só o bloco lead e devolve o cartão criado', async () => {
    post.mockResolvedValueOnce({ data: { card: CARTAO } });

    expect(await createLead('conv-1', LEAD)).toEqual({ kind: 'criado', card: CARTAO });
    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-lead', { lead: LEAD });
  });

  test('resposta sem cartão encontrado é indisponível', async () => {
    post.mockResolvedValueOnce({ data: {} });
    expect(await createLead('conv-1', LEAD)).toEqual({ kind: 'indisponivel' });

    post.mockResolvedValueOnce({ data: { card: { found: false } } });
    expect(await createLead('conv-1', LEAD)).toEqual({ kind: 'indisponivel' });
  });

  test('número já cadastrado traz o cartão e o texto do Stronilead', async () => {
    const message = 'Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.';
    post.mockRejectedValueOnce(
      erroHttp(409, { error: message, code: 'ja_cadastrado', card: CARTAO, createdAt: '2026-09-29T14:32:00.000Z' }),
    );

    expect(await createLead('conv-1', LEAD)).toEqual({ kind: 'ja_cadastrado', card: CARTAO, message });
  });

  test('sem resposta é indisponível, para a tela oferecer Tentar de novo', async () => {
    post.mockRejectedValueOnce(semResposta());

    expect(await createLead('conv-1', LEAD)).toEqual({ kind: 'indisponivel' });
  });
});

describe('parseCrmCardUpdate', () => {
  test('aceita o contato e o cartão', () => {
    expect(parseCrmCardUpdate({ contactId: 'c1', card: CARTAO })).toEqual({ contactId: 'c1', card: CARTAO });
  });

  test('recusa o que não é o evento combinado', () => {
    expect(parseCrmCardUpdate(null)).toBeNull();
    expect(parseCrmCardUpdate({ card: CARTAO })).toBeNull();
    expect(parseCrmCardUpdate({ contactId: 'c1', card: 'x' })).toBeNull();
    expect(parseCrmCardUpdate({ contactId: 'c1', card: { name: 'sem found' } })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmLead.test.ts`
Expected: FAIL, porque `./crmLead` não existe.

- [ ] **Step 3: Criar `frontend/src/lib/crmLead.ts`**

```ts
// Cadastro de lead no Stronilead pela conversa: as duas chamadas ao backend
// do Stronizap e a leitura do que voltou. O backend é quem fala com o CRM, e
// a chave nunca chega aqui. Recusa chega com o texto pronto em `error`, e a
// tela mostra como veio: nenhuma regra do Stronilead é recalculada deste lado.
import { api } from './api';
import type { CrmCard, CrmLeadInput, CrmLeadOptions } from '../types/crm';

/** Falha comum às duas chamadas. */
export type LeadFailure =
  /** Recusa com o texto pronto, do Stronilead ou do Stronizap. `field` diz o campo, quando há. */
  | { kind: 'recusa'; code: string | null; message: string; field: string | null }
  /** Integração desligada ou chave recusada: a seção do Stronilead some, como no cartão. */
  | { kind: 'sumiu'; reason: 'desligado' | 'indisponivel' }
  /** Sem resposta, 5xx ou Stronilead fora do ar: o que foi preenchido fica, com "Tentar de novo". */
  | { kind: 'indisponivel' };

export type LeadOptionsOutcome = { kind: 'ok'; options: CrmLeadOptions } | LeadFailure;

export type CreateLeadOutcome =
  | { kind: 'criado'; card: CrmCard }
  | { kind: 'ja_cadastrado'; card: CrmCard; message: string }
  | LeadFailure;

/** Recusa que chegou sem texto (não deveria): ao menos diz o que fazer. */
export const RECUSA_SEM_TEXTO = 'Não deu para concluir. Confira os dados e tente de novo.';

/** Número que já estava no Stronilead, se o texto dele não vier. */
const JA_CADASTRADO_SEM_TEXTO = 'Esse número já estava no Stronilead.';

function objeto(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Cartão de contexto como o CRM manda: objeto com `found`. */
export function ehCartao(v: unknown): v is CrmCard {
  const o = objeto(v);
  return o !== null && typeof o.found === 'boolean';
}

/**
 * O que fazer com uma resposta de erro das duas rotas:
 * - `desligado` ou `chave_invalida`: a seção some, como no cartão;
 * - sem resposta ou 5xx: o Stronilead está fora, e vale tentar de novo;
 * - o resto é recusa, com o texto que veio.
 */
export function classifyLeadFailure(err: unknown): LeadFailure {
  const response = objeto(objeto(err)?.response);
  const status = response?.status;
  const data = objeto(response?.data);
  const code = data?.code;
  const codigo = typeof code === 'string' && code ? code : null;

  if (codigo === 'desligado') return { kind: 'sumiu', reason: 'desligado' };
  if (codigo === 'chave_invalida') return { kind: 'sumiu', reason: 'indisponivel' };
  if (typeof status !== 'number' || status >= 500 || status === 408) return { kind: 'indisponivel' };

  const erro = data?.error;
  const campo = data?.field;
  return {
    kind: 'recusa',
    code: codigo,
    message: typeof erro === 'string' && erro.trim() ? erro.trim() : RECUSA_SEM_TEXTO,
    field: typeof campo === 'string' && campo ? campo : null,
  };
}

/** Opções do formulário, pedidas a cada abertura. */
export async function fetchLeadOptions(conversationId: string): Promise<LeadOptionsOutcome> {
  try {
    const { data } = await api.get<CrmLeadOptions>(`/conversations/${conversationId}/crm-lead-options`);
    return { kind: 'ok', options: data };
  } catch (err) {
    return classifyLeadFailure(err);
  }
}

/**
 * Cadastra. `ja_cadastrado` com cartão não é erro para a tela: o cartão que
 * veio entra no lugar do formulário, com o texto do Stronilead.
 */
export async function createLead(conversationId: string, lead: CrmLeadInput): Promise<CreateLeadOutcome> {
  try {
    const { data } = await api.post<{ card?: unknown }>(`/conversations/${conversationId}/crm-lead`, { lead });
    const card = data?.card;
    return ehCartao(card) && card.found ? { kind: 'criado', card } : { kind: 'indisponivel' };
  } catch (err) {
    const response = objeto(objeto(err)?.response);
    const data = objeto(response?.data);
    const card = data?.card;
    if (data && response?.status === 409 && data.code === 'ja_cadastrado' && ehCartao(card) && card.found) {
      const erro = data.error;
      return {
        kind: 'ja_cadastrado',
        card,
        message: typeof erro === 'string' && erro.trim() ? erro.trim() : JA_CADASTRADO_SEM_TEXTO,
      };
    }
    return classifyLeadFailure(err);
  }
}

/** Evento `crm_card_updated` do socket, conferido antes de entrar no store. */
export function parseCrmCardUpdate(payload: unknown): { contactId: string; card: CrmCard } | null {
  const p = objeto(payload);
  const contactId = p?.contactId;
  const card = p?.card;
  if (typeof contactId !== 'string' || !contactId || !ehCartao(card)) return null;
  return { contactId, card };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/crmLead.test.ts && npm run typecheck`
Expected: PASS e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/crmLead.ts frontend/src/lib/crmLead.test.ts
git commit -m "feat: chamadas do cadastro de lead e leitura das recusas no front

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `crm.store` troca o cartão e guarda o link da ficha

**Files:**
- Modify: `frontend/src/stores/crm.store.ts` (arquivo inteiro, 86 linhas)
- Create: `frontend/src/stores/crm.store.test.ts`

Duas mudanças de comportamento além das ações novas: leitura do cartão que volta depois de uma troca (`replaceCard`, `hideCard`) não desfaz a troca, e leitura que volta depois de um `clear()` não entra na sessão nova. Sem a primeira, a pessoa que abre o contato enquanto outra cadastra veria o "Sem cadastro" voltar por cima do cartão novo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/stores/crm.store.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest';

const get = vi.fn();
vi.mock('../lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a), post: vi.fn() } }));

import { useCrmStore } from './crm.store';
import type { CrmCard } from '../types/crm';

const SEM_CADASTRO: CrmCard = { found: false };
const LEAD: CrmCard = { found: true, leadId: 'lead-1', kind: 'lead', name: 'Mariana Souza', stage: 'Novo lead' };

function adiado<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const entrada = (id: string) => useCrmStore.getState().cards[id];

beforeEach(() => {
  get.mockReset();
  useCrmStore.getState().clear();
});

describe('crm.store: cartão', () => {
  test('resposta da rota do cartão entra como sempre (controle)', async () => {
    get.mockResolvedValueOnce({ data: { card: SEM_CADASTRO, reason: null } });

    await useCrmStore.getState().loadCard('c1');

    expect(get).toHaveBeenCalledWith('/contacts/c1/crm-card');
    expect(entrada('c1')).toEqual({ card: SEM_CADASTRO, loading: false, reason: null });
  });

  test('replaceCard põe o cartão novo, sem motivo e sem carregando', () => {
    useCrmStore.getState().replaceCard('c1', LEAD);

    expect(entrada('c1')).toEqual({ card: LEAD, loading: false, reason: null });
  });

  test('leitura que volta depois do replaceCard não desfaz a troca', async () => {
    const resposta = adiado<{ data: unknown }>();
    get.mockReturnValueOnce(resposta.promise);

    const leitura = useCrmStore.getState().loadCard('c1');
    useCrmStore.getState().replaceCard('c1', LEAD);
    resposta.resolve({ data: { card: SEM_CADASTRO, reason: null } });
    await leitura;

    expect(entrada('c1')).toEqual({ card: LEAD, loading: false, reason: null });
  });

  test('erro que volta depois do replaceCard também não desfaz a troca', async () => {
    const resposta = adiado<{ data: unknown }>();
    get.mockReturnValueOnce(resposta.promise);

    const leitura = useCrmStore.getState().loadCard('c1');
    useCrmStore.getState().replaceCard('c1', LEAD);
    resposta.reject(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    await leitura;

    expect(entrada('c1')?.card).toEqual(LEAD);
  });

  test('leitura que volta depois do clear() não entra na sessão nova', async () => {
    const resposta = adiado<{ data: unknown }>();
    get.mockReturnValueOnce(resposta.promise);

    const leitura = useCrmStore.getState().loadCard('c1');
    useCrmStore.getState().clear();
    resposta.resolve({ data: { card: LEAD, reason: null } });
    await leitura;

    expect(entrada('c1')).toBeUndefined();
  });

  test('hideCard faz a seção sumir, com o motivo', () => {
    useCrmStore.getState().replaceCard('c1', SEM_CADASTRO);

    useCrmStore.getState().hideCard('c1', 'desligado');

    expect(entrada('c1')).toEqual({ card: null, loading: false, reason: 'desligado' });
  });
});

describe('crm.store: link da ficha', () => {
  test('pergunta ao /organization uma vez por sessão e guarda endereço e academia', async () => {
    get.mockResolvedValue({
      data: {
        id: 'org1',
        crm: { enabled: true, baseUrl: 'https://stronilead.com.br', tenantSlug: 'stronix-crm-app', hasKey: true },
      },
    });

    await Promise.all([useCrmStore.getState().loadFichaLink(), useCrmStore.getState().loadFichaLink()]);
    await useCrmStore.getState().loadFichaLink();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/organization');
    expect(useCrmStore.getState().fichaLink).toEqual({
      baseUrl: 'https://stronilead.com.br',
      tenantSlug: 'stronix-crm-app',
    });
  });

  test('sem endereço ou sem academia, fica sem link', async () => {
    get.mockResolvedValueOnce({ data: { crm: { baseUrl: null, tenantSlug: 'x' } } });

    await useCrmStore.getState().loadFichaLink();

    expect(useCrmStore.getState().fichaLink).toBeNull();
  });

  test('falha na consulta deixa sem link, e a próxima abertura pergunta de novo', async () => {
    get.mockRejectedValueOnce(new Error('Network Error'));
    await useCrmStore.getState().loadFichaLink();
    expect(useCrmStore.getState().fichaLink).toBeNull();

    get.mockResolvedValueOnce({ data: { crm: { baseUrl: 'https://stronilead.com.br', tenantSlug: 'a' } } });
    await useCrmStore.getState().loadFichaLink();

    expect(get).toHaveBeenCalledTimes(2);
    expect(useCrmStore.getState().fichaLink).toEqual({ baseUrl: 'https://stronilead.com.br', tenantSlug: 'a' });
  });

  test('clear() esquece o link, e a resposta de antes do clear() não volta', async () => {
    const resposta = adiado<{ data: unknown }>();
    get.mockReturnValueOnce(resposta.promise);

    const pedido = useCrmStore.getState().loadFichaLink();
    useCrmStore.getState().clear();
    resposta.resolve({ data: { crm: { baseUrl: 'https://outra.com.br', tenantSlug: 'outra' } } });
    await pedido;
    expect(useCrmStore.getState().fichaLink).toBeNull();

    get.mockResolvedValueOnce({ data: { crm: { baseUrl: 'https://stronilead.com.br', tenantSlug: 'b' } } });
    await useCrmStore.getState().loadFichaLink();

    expect(useCrmStore.getState().fichaLink).toEqual({ baseUrl: 'https://stronilead.com.br', tenantSlug: 'b' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/stores/crm.store.test.ts`
Expected: FAIL: `replaceCard`, `hideCard` e `loadFichaLink` não existem, e a leitura depois do `clear()` ainda entra.

- [ ] **Step 3: Reescrever `frontend/src/stores/crm.store.ts`**

Substituir o arquivo inteiro por:

```ts
import { create } from 'zustand';
import { api } from '../lib/api';
import type { CrmCard, CrmFichaLink, CrmReason } from '../types/crm';

/**
 * Cartão de contexto do CRM, indexado por contactId.
 *
 * Não ter entrada quer dizer "ainda não perguntei". Tendo entrada, quem decide
 * se vale perguntar de novo é o `reason`, não a ausência do cartão:
 *
 *   card presente    respondido, não pergunta mais
 *   'desligado'      integração desligada ou incompleta, não pergunta mais
 *   'indisponivel'   CRM fora do ar, timeout, erro HTTP ou chave que não
 *                    decifrou. Passageiro: pergunta de novo na próxima vez que
 *                    o contato for aberto
 *
 * Antes o front tratava qualquer 200 como definitivo, e uma piscada do CRM
 * deixava aquele contato sem contexto pelo resto da sessão da aba.
 */
export interface CrmEntry {
  card: CrmCard | null;
  loading: boolean;
  /** Por que não veio cartão. Sempre null quando `card` existe. */
  reason: CrmReason;
}

interface CrmState {
  cards: Record<string, CrmEntry>;
  /**
   * Endereço do Stronilead e identificador da academia, para o "Abrir no
   * Stronilead". Vem do GET /organization, que nunca traz a chave.
   */
  fichaLink: CrmFichaLink | null;
  loadCard: (contactId: string) => Promise<void>;
  /**
   * Troca o cartão de um contato: cadastro feito nesta tela ou aviso
   * `crm_card_updated` do socket. Leitura antiga que chegar depois não desfaz
   * a troca (ver `loadCard`).
   */
  replaceCard: (contactId: string, card: CrmCard) => void;
  /**
   * A integração caiu ou a chave foi recusada no meio do cadastro: a seção
   * some, do mesmo jeito que some quando o cartão não vem.
   */
  hideCard: (contactId: string, reason: 'desligado' | 'indisponivel') => void;
  /** Pergunta o link da ficha, uma vez por sessão. */
  loadFichaLink: () => Promise<void>;
  /** Contexto de cliente não deve sobreviver a uma troca de sessão na aba. */
  clear: () => void;
}

/** Só falha passageira libera nova chamada pro mesmo contato. */
function retentavel(entry: CrmEntry): boolean {
  return !entry.card && entry.reason === 'indisponivel';
}

/**
 * Sessão do store. Sobe a cada `clear()`, e resposta que saiu antes disso não
 * entra: o contexto de uma organização não pode cair na sessão de quem entrou
 * depois na mesma aba.
 */
let sessao = 0;
/** Pedido do link em andamento, para não repetir enquanto ele não volta. */
let linkEmAndamento: Promise<void> | null = null;
/** O link já foi respondido nesta sessão, com endereço ou sem. */
let linkRespondido = false;

export const useCrmStore = create<CrmState>((set, get) => ({
  cards: {},
  fichaLink: null,

  loadCard: async (contactId) => {
    const atual = get().cards[contactId];
    // Em voo, ou já respondido de forma definitiva: não repete. O cache de
    // verdade é o do servidor (2 min); este aqui só evita chamada ao trocar de
    // conversa e voltar.
    if (atual && (atual.loading || !retentavel(atual))) return;

    const minhaSessao = sessao;
    set((s) => ({
      cards: {
        ...s.cards,
        [contactId]: { card: atual?.card ?? null, loading: true, reason: null },
      },
    }));
    // A resposta só entra se a entrada ainda for a que esta leitura abriu. Um
    // cadastro (`replaceCard`), um `hideCard` ou um `clear()` no meio do
    // caminho ganham da resposta antiga.
    const aindaVale = () => sessao === minhaSessao && get().cards[contactId]?.loading === true;

    try {
      const { data } = await api.get<{ card: CrmCard | null; reason?: CrmReason }>(
        `/contacts/${contactId}/crm-card`,
      );
      if (!aindaVale()) return;
      const card = data.card ?? null;
      // Contrato: cartão e motivo se excluem. Resposta sem os dois é forma
      // antiga da rota, e vale como definitiva pra não virar uma chamada nova
      // a cada conversa aberta.
      const reason: CrmReason = card ? null : data.reason ?? 'desligado';
      set((s) => ({ cards: { ...s.cards, [contactId]: { card, loading: false, reason } } }));
    } catch (err) {
      if (!aindaVale()) return;
      // Sem toast de propósito: o contexto do CRM é um extra e falha dele não
      // pode atrapalhar quem está atendendo.
      //
      // 4xx do nosso próprio backend é recusa definitiva (403 de superadmin,
      // 404 de contato de outra org), não indisponibilidade. Marcar como
      // retentável faria refazer a chamada a cada abertura, para sempre.
      // 408 e 429 são as exceções: valem nova tentativa.
      const status = (err as { response?: { status?: number } })?.response?.status;
      const definitivo = !!status && status >= 400 && status < 500 && status !== 408 && status !== 429;
      set((s) => ({
        cards: {
          ...s.cards,
          [contactId]: { card: null, loading: false, reason: definitivo ? 'desligado' : 'indisponivel' },
        },
      }));
    }
  },

  replaceCard: (contactId, card) =>
    set((s) => ({ cards: { ...s.cards, [contactId]: { card, loading: false, reason: null } } })),

  hideCard: (contactId, reason) =>
    set((s) => ({ cards: { ...s.cards, [contactId]: { card: null, loading: false, reason } } })),

  loadFichaLink: () => {
    if (linkRespondido) return Promise.resolve();
    if (linkEmAndamento) return linkEmAndamento;
    const minhaSessao = sessao;
    const pedido = api
      .get<{ crm?: { baseUrl?: unknown; tenantSlug?: unknown } }>('/organization')
      .then(({ data }) => {
        if (sessao !== minhaSessao) return;
        linkRespondido = true;
        const baseUrl = data?.crm?.baseUrl;
        const tenantSlug = data?.crm?.tenantSlug;
        set({
          fichaLink:
            typeof baseUrl === 'string' && baseUrl && typeof tenantSlug === 'string' && tenantSlug
              ? { baseUrl, tenantSlug }
              : null,
        });
      })
      .catch(() => {
        // Sem o link, o "Abrir no Stronilead" só não aparece. A próxima
        // abertura de um cartão pergunta de novo.
      })
      .finally(() => {
        if (sessao === minhaSessao) linkEmAndamento = null;
      });
    linkEmAndamento = pedido;
    return pedido;
  },

  clear: () => {
    sessao += 1;
    linkEmAndamento = null;
    linkRespondido = false;
    set({ cards: {}, fichaLink: null });
  },
}));
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/stores/crm.store.test.ts && npm test && npm run typecheck`
Expected: PASS nos dez testes novos, suíte inteira verde e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/crm.store.ts frontend/src/stores/crm.store.test.ts
git commit -m "feat: crm.store troca o cartão sem leitura antiga desfazer e guarda o link da ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: O socket entrega `crm_card_updated`

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts`

O payload é conferido por `parseCrmCardUpdate` (testado na Task 8) e entra pelo `replaceCard` (testado na Task 9). O hook não tem teste próprio no projeto; a Task 17 confere o evento com dois navegadores.

- [ ] **Step 1: Imports**

Em `frontend/src/hooks/useSocket.ts`, logo depois de `import { refreshPixKeys } from '../stores/pix-keys.store';` (linha 15), acrescentar:

```ts
import { useCrmStore } from '../stores/crm.store';
import { parseCrmCardUpdate } from '../lib/crmLead';
```

- [ ] **Step 2: O ouvinte**

Logo depois da função `onContactUpdated` (termina na linha 231), acrescentar:

```ts
    // Cadastro de lead feito em outro computador, ou nesta tela por outra aba:
    // o cartão do contato troca sem recarregar. O payload é conferido antes
    // de entrar no store, porque vem de fora do React.
    function onCrmCardUpdated(payload: unknown) {
      const update = parseCrmCardUpdate(payload);
      if (update) useCrmStore.getState().replaceCard(update.contactId, update.card);
    }
```

Logo depois de `socket.on('contact_updated', onContactUpdated);` (linha 273), acrescentar:

```ts
    socket.on('crm_card_updated', onCrmCardUpdated);
```

E logo depois de `socket.off('contact_updated', onContactUpdated);` (linha 296), acrescentar:

```ts
      socket.off('crm_card_updated', onCrmCardUpdated);
```

- [ ] **Step 3: Conferir tipos e testes**

Run: `cd frontend && npm run typecheck && npm test`
Expected: typecheck limpo e suíte verde.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useSocket.ts
git commit -m "feat: cartão do CRM troca ao vivo pelo aviso crm_card_updated

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `lib/crmLeadForm.ts`, as regras do formulário

**Files:**
- Create: `frontend/src/lib/crmLeadForm.ts`
- Create: `frontend/src/lib/crmLeadForm.test.ts`

Puro e testado sem React. Nenhuma lista mora aqui: as listas saem das opções, e o padrão de origem, funil e etapa é o `defaults` que o Stronilead mandou. Este arquivo só confere o que o formulário precisa para mandar (campo obrigatório, nome com duas letras, formato do WhatsApp do aluno), e o Stronilead confere de novo com as regras dele.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/crmLeadForm.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import type { CrmLeadOptions } from '../types/crm';
import {
  buildLeadInput,
  fieldIsShown,
  fieldOfRefusal,
  fitToOptions,
  funnelStageKey,
  initialLeadForm,
  leadFormLists,
  nomeParaCadastro,
  ownerNote,
  parseFunnelStage,
  SEM_DOR_MESSAGE,
  validateLeadForm,
  type LeadFormValues,
} from './crmLeadForm';

const CONSULTORA: CrmLeadOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
  sources: [{ name: 'Instagram' }, { name: 'WhatsApp' }],
  dores: [{ name: 'Emagrecer' }, { name: 'Postura' }],
  modalities: [{ name: 'Musculação' }, { name: 'Pilates' }],
  funnels: [
    { id: 'comercial', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] },
    { id: 'kids', name: 'Kids', stages: [{ name: 'Novo lead' }] },
  ],
  relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
  defaults: { source: 'WhatsApp', funnelId: 'comercial', stage: 'Novo lead' },
};

const GESTOR: CrmLeadOptions = {
  ...CONSULTORA,
  actor: { id: 'u-jo', name: 'Johnny Bittencourt', role: 'gestor' },
  team: [
    { id: 'u-jo', name: 'Johnny Bittencourt' },
    { id: 'u-ana', name: 'Ana Souza' },
    { id: 'u-bruno', name: 'Bruno Lima' },
  ],
};

const valido = (over: Partial<LeadFormValues> = {}): LeadFormValues => ({
  ...initialLeadForm(CONSULTORA, 'Mariana'),
  dor: 'Postura',
  ...over,
});

describe('nomeParaCadastro', () => {
  test('nome do Zap, senão o do WhatsApp, nunca o telefone', () => {
    expect(nomeParaCadastro({ displayName: ' Mari ', name: 'Mariana' })).toBe('Mari');
    expect(nomeParaCadastro({ displayName: null, name: 'Mariana' })).toBe('Mariana');
    expect(nomeParaCadastro({ displayName: '', name: null })).toBe('');
  });
});

describe('funil e etapa numa chave só', () => {
  test('vai e volta', () => {
    expect(parseFunnelStage(funnelStageKey('comercial', 'Novo lead'))).toEqual({
      funnelId: 'comercial',
      stage: 'Novo lead',
    });
  });

  test('chave vazia ou quebrada não é funil', () => {
    expect(parseFunnelStage('')).toBeNull();
    expect(parseFunnelStage('["comercial"]')).toBeNull();
    expect(parseFunnelStage('{')).toBeNull();
  });
});

describe('leadFormLists', () => {
  test('as listas são as das opções, com funil e etapa juntos', () => {
    const listas = leadFormLists(CONSULTORA);

    expect(listas.sources.map((o) => o.label)).toEqual(['Instagram', 'WhatsApp']);
    expect(listas.dores.map((o) => o.label)).toEqual(['Emagrecer', 'Postura']);
    expect(listas.funnelStages).toEqual([
      { value: funnelStageKey('comercial', 'Novo lead'), label: 'Comercial · Novo lead' },
      { value: funnelStageKey('comercial', 'Primeiro contato'), label: 'Comercial · Primeiro contato' },
      { value: funnelStageKey('kids', 'Novo lead'), label: 'Kids · Novo lead' },
    ]);
  });

  test('campos opcionais ganham a opção vazia, e o parentesco vem do Stronilead', () => {
    const listas = leadFormLists(CONSULTORA);

    expect(listas.modalities[0]).toEqual({ value: '', label: 'Sem modalidade' });
    expect(listas.relationships).toEqual([
      { value: '', label: 'Não informado' },
      ...CONSULTORA.relationships.map((r) => ({ value: r, label: r })),
    ]);
  });

  test('consultor responsável: só para gestor, com "Você" primeiro e a equipe sem repetir quem pede', () => {
    expect(leadFormLists(CONSULTORA).owners).toEqual([]);
    expect(leadFormLists(GESTOR).owners).toEqual([
      { value: 'u-jo', label: 'Você (Johnny)' },
      { value: 'u-ana', label: 'Ana Souza' },
      { value: 'u-bruno', label: 'Bruno Lima' },
    ]);
    // Gestor sem nome no Stronilead: só "Você".
    expect(leadFormLists({ ...GESTOR, actor: { ...GESTOR.actor, name: null } }).owners[0]).toEqual({
      value: 'u-jo',
      label: 'Você',
    });
  });
});

describe('initialLeadForm', () => {
  test('nome do contato, origem, funil e etapa do padrão do Stronilead, dor vazia', () => {
    expect(initialLeadForm(CONSULTORA, 'Mariana')).toEqual({
      name: 'Mariana',
      isMinor: false,
      studentName: '',
      guardianName: 'Mariana',
      relationship: '',
      studentWhatsapp: '',
      source: 'WhatsApp',
      dor: '',
      modalidade: '',
      funnelStage: funnelStageKey('comercial', 'Novo lead'),
      ownerId: '',
    });
  });

  test('gestor começa como responsável', () => {
    expect(initialLeadForm(GESTOR, 'Mariana').ownerId).toBe('u-jo');
  });

  test('padrão que não está nas listas começa vazio', () => {
    const valores = initialLeadForm(
      { ...CONSULTORA, defaults: { source: 'Indicação', funnelId: 'sumiu', stage: 'Novo lead' } },
      'Mariana',
    );
    expect(valores.source).toBe('');
    expect(valores.funnelStage).toBe('');
  });
});

describe('validateLeadForm', () => {
  test('formulário completo passa', () => {
    expect(validateLeadForm(valido(), CONSULTORA)).toEqual({});
  });

  test('nome precisa de 2 letras', () => {
    expect(validateLeadForm(valido({ name: 'M' }), CONSULTORA)).toEqual({
      name: 'Escreva o nome, com 2 letras ou mais.',
    });
    expect(validateLeadForm(valido({ name: 'M1' }), CONSULTORA).name).toBeDefined();
    expect(validateLeadForm(valido({ name: 'Mé' }), CONSULTORA)).toEqual({});
  });

  test('origem, dor e funil são obrigatórios', () => {
    expect(validateLeadForm(valido({ source: '', dor: '', funnelStage: '' }), CONSULTORA)).toEqual({
      source: 'Escolha a origem.',
      dor: 'Escolha a dor ou necessidade.',
      funnelStage: 'Escolha o funil e a etapa.',
    });
  });

  test('sem dor cadastrada, o campo diz onde o gestor cadastra', () => {
    expect(validateLeadForm(valido({ dor: '' }), { ...CONSULTORA, dores: [] })).toEqual({ dor: SEM_DOR_MESSAGE });
  });

  test('menor: nome do aluno e do responsável obrigatórios, WhatsApp do aluno opcional com DDD', () => {
    expect(
      validateLeadForm(valido({ isMinor: true, studentName: 'P', guardianName: '', studentWhatsapp: '5199' }), CONSULTORA),
    ).toEqual({
      studentName: 'Escreva o nome do aluno, com 2 letras ou mais.',
      guardianName: 'Escreva o nome do responsável, com 2 letras ou mais.',
      studentWhatsapp: 'Escreva o WhatsApp do aluno com DDD, ou deixe em branco.',
    });
    expect(
      validateLeadForm(valido({ isMinor: true, studentName: 'Pedro', studentWhatsapp: '' }), CONSULTORA),
    ).toEqual({});
    expect(
      validateLeadForm(valido({ isMinor: true, studentName: 'Pedro', studentWhatsapp: '(51) 99999-0000' }), CONSULTORA),
    ).toEqual({});
  });
});

describe('buildLeadInput', () => {
  test('consultora: sem dono, modalidade vazia vira null, sem menor', () => {
    expect(buildLeadInput(valido({ name: '  Mariana   Souza ' }), CONSULTORA)).toEqual({
      name: 'Mariana Souza',
      source: 'WhatsApp',
      dor: 'Postura',
      modalidade: null,
      funnelId: 'comercial',
      stage: 'Novo lead',
      ownerId: null,
      minor: null,
    });
  });

  test('consultora nunca manda dono, mesmo com um valor esquecido', () => {
    expect(buildLeadInput(valido({ ownerId: 'u-bruno' }), CONSULTORA).ownerId).toBeNull();
  });

  test('gestor: ficar com o lead manda null, escolher outra pessoa manda o id', () => {
    const base = { ...initialLeadForm(GESTOR, 'Mariana'), dor: 'Postura' };
    expect(buildLeadInput(base, GESTOR).ownerId).toBeNull();
    expect(buildLeadInput({ ...base, ownerId: 'u-ana' }, GESTOR).ownerId).toBe('u-ana');
  });

  test('menor: o nome é o do aluno e o bloco minor vai com o WhatsApp só em dígitos', () => {
    const lead = buildLeadInput(
      valido({
        isMinor: true,
        studentName: 'Pedro  Souza',
        guardianName: 'Mariana Souza',
        relationship: 'Mãe',
        studentWhatsapp: '(51) 99999-0000',
        modalidade: 'Pilates',
      }),
      CONSULTORA,
    );

    expect(lead.name).toBe('Pedro Souza');
    expect(lead.modalidade).toBe('Pilates');
    expect(lead.minor).toEqual({ guardianName: 'Mariana Souza', relationship: 'Mãe', studentWhatsapp: '51999990000' });
  });

  test('menor sem parentesco e sem WhatsApp manda null nos dois', () => {
    const lead = buildLeadInput(valido({ isMinor: true, studentName: 'Pedro' }), CONSULTORA);
    expect(lead.minor).toEqual({ guardianName: 'Mariana', relationship: null, studentWhatsapp: null });
  });
});

describe('fieldOfRefusal', () => {
  test('o campo da recusa vira o campo do formulário', () => {
    expect(fieldOfRefusal('name', false)).toBe('name');
    expect(fieldOfRefusal('name', true)).toBe('studentName');
    expect(fieldOfRefusal('funnelId', false)).toBe('funnelStage');
    expect(fieldOfRefusal('stage', true)).toBe('funnelStage');
    expect(fieldOfRefusal('modalidade', false)).toBe('modalidade');
    expect(fieldOfRefusal('studentWhatsapp', true)).toBe('studentWhatsapp');
  });

  test('campo desconhecido ou ausente vai para a área geral', () => {
    expect(fieldOfRefusal('outro', false)).toBeNull();
    expect(fieldOfRefusal(null, false)).toBeNull();
  });
});

describe('fieldIsShown', () => {
  test('campos do menor só com a chave ligada, e o Nome só com ela desligada', () => {
    expect(fieldIsShown('studentWhatsapp', valido(), CONSULTORA)).toBe(false);
    expect(fieldIsShown('studentWhatsapp', valido({ isMinor: true }), CONSULTORA)).toBe(true);
    expect(fieldIsShown('name', valido({ isMinor: true }), CONSULTORA)).toBe(false);
    expect(fieldIsShown('name', valido(), CONSULTORA)).toBe(true);
  });

  test('o Consultor responsável só aparece para o gestor', () => {
    expect(fieldIsShown('ownerId', valido(), CONSULTORA)).toBe(false);
    expect(fieldIsShown('ownerId', initialLeadForm(GESTOR, 'Mariana'), GESTOR)).toBe(true);
    expect(fieldIsShown('dor', valido(), CONSULTORA)).toBe(true);
  });
});

describe('fitToOptions', () => {
  test('o que sumiu das listas sai, o resto fica', () => {
    const ajustado = fitToOptions(valido({ modalidade: 'Pilates', relationship: 'Tia' }), {
      ...CONSULTORA,
      modalities: [{ name: 'Musculação' }],
      relationships: ['Mãe'],
    });

    expect(ajustado.modalidade).toBe('');
    expect(ajustado.relationship).toBe('');
    expect(ajustado.dor).toBe('Postura');
    expect(ajustado.source).toBe('WhatsApp');
    expect(ajustado.name).toBe('Mariana');
  });

  test('gestor: dono que saiu da equipe volta para "Você"', () => {
    const ajustado = fitToOptions(
      { ...initialLeadForm(GESTOR, 'Mariana'), ownerId: 'u-bruno' },
      { ...GESTOR, team: [{ id: 'u-ana', name: 'Ana Souza' }] },
    );
    expect(ajustado.ownerId).toBe('u-jo');
  });
});

describe('ownerNote', () => {
  test('consultora fica com o lead', () => {
    expect(ownerNote(valido(), CONSULTORA)).toBe('Fica com você (Ana Souza) e soma na sua Meta diária.');
    // Sem nome no Stronilead, a frase fica sem os parênteses.
    expect(ownerNote(valido(), { ...CONSULTORA, actor: { ...CONSULTORA.actor, name: null } })).toBe(
      'Fica com você e soma na sua Meta diária.',
    );
  });

  test('gestor: nada quando fica com ele, o aviso do sino quando escolhe outra pessoa', () => {
    const base = initialLeadForm(GESTOR, 'Mariana');
    expect(ownerNote(base, GESTOR)).toBeNull();
    expect(ownerNote({ ...base, ownerId: 'u-ana' }, GESTOR)).toBe('Ana recebe o aviso no sino do Stronilead.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/lib/crmLeadForm.test.ts`
Expected: FAIL, porque `./crmLeadForm` não existe.

- [ ] **Step 3: Criar `frontend/src/lib/crmLeadForm.ts`**

```ts
// Regras do formulário de cadastro de lead no painel do contato (spec
// stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md,
// "O formulário" e "Menor de idade"). Puro e testado sem React.
//
// Nenhuma lista mora aqui: as listas saem das opções que o Stronilead mandou,
// e o padrão de origem, funil e etapa é o `defaults` dele. Este arquivo só
// confere o que o formulário precisa para mandar (campo obrigatório, nome com
// duas letras, formato do WhatsApp do aluno), e o Stronilead confere de novo
// com as regras dele.
import type { CrmLeadInput, CrmLeadOptions } from '../types/crm';

export interface LeadFormValues {
  name: string;
  isMinor: boolean;
  studentName: string;
  guardianName: string;
  relationship: string;
  studentWhatsapp: string;
  source: string;
  dor: string;
  modalidade: string;
  /** Funil e etapa numa chave só (`funnelStageKey`). Vazio: nada escolhido. */
  funnelStage: string;
  /** Dono escolhido pelo gestor. Vazio para a consultora. */
  ownerId: string;
}

export type LeadFormField = Exclude<keyof LeadFormValues, 'isMinor'>;
export type LeadFormErrors = Partial<Record<LeadFormField, string>>;

/** Opção de lista, no formato do `Combobox`. */
export interface LeadFormOption {
  value: string;
  label: string;
  hint?: string;
}

export const SEM_DOR_MESSAGE =
  'Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores.';

/** Nome que abre preenchido: o do contato no Stronizap, nunca o telefone. */
export function nomeParaCadastro(contact: { displayName?: string | null; name?: string | null }): string {
  return contact.displayName?.trim() || contact.name?.trim() || '';
}

/** Funil e etapa num valor só, para caber numa lista. */
export function funnelStageKey(funnelId: string, stage: string): string {
  return JSON.stringify([funnelId, stage]);
}

export function parseFunnelStage(key: string): { funnelId: string; stage: string } | null {
  try {
    const v: unknown = JSON.parse(key);
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string') {
      return { funnelId: v[0], stage: v[1] };
    }
  } catch {
    // Chave vazia ou quebrada: nada escolhido.
  }
  return null;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** As listas do formulário, montadas das opções do Stronilead. */
export function leadFormLists(options: CrmLeadOptions) {
  const porNome = (itens: Array<{ name: string }>): LeadFormOption[] =>
    itens.map((i) => ({ value: i.name, label: i.name }));
  const gestor = options.actor.role === 'gestor';
  return {
    sources: porNome(options.sources),
    dores: porNome(options.dores),
    modalities: [{ value: '', label: 'Sem modalidade' }, ...porNome(options.modalities)],
    funnelStages: options.funnels.flatMap((f) =>
      f.stages.map((s) => ({ value: funnelStageKey(f.id, s.name), label: `${f.name} · ${s.name}` })),
    ),
    relationships: [
      { value: '', label: 'Não informado' },
      ...options.relationships.map((r) => ({ value: r, label: r })),
    ],
    owners: gestor
      ? [
          {
            value: options.actor.id,
            label: options.actor.name ? `Você (${primeiroNome(options.actor.name)})` : 'Você',
          },
          ...(options.team ?? [])
            .filter((p) => p.id !== options.actor.id)
            .map((p) => ({ value: p.id, label: p.name })),
        ]
      : [],
  };
}

function temValor(lista: LeadFormOption[], valor: string): boolean {
  return lista.some((o) => o.value === valor);
}

/** Valores com que o formulário abre. Origem, funil e etapa vêm de `defaults`. */
export function initialLeadForm(options: CrmLeadOptions, contactName: string): LeadFormValues {
  const listas = leadFormLists(options);
  const origem = options.defaults.source ?? '';
  const funil =
    options.defaults.funnelId && options.defaults.stage
      ? funnelStageKey(options.defaults.funnelId, options.defaults.stage)
      : '';
  return {
    name: contactName,
    isMinor: false,
    studentName: '',
    guardianName: contactName,
    relationship: '',
    studentWhatsapp: '',
    source: temValor(listas.sources, origem) ? origem : '',
    dor: '',
    modalidade: '',
    funnelStage: temValor(listas.funnelStages, funil) ? funil : '',
    ownerId: options.actor.role === 'gestor' ? options.actor.id : '',
  };
}

/**
 * Depois de recarregar as opções (item apagado no Stronilead), o que não
 * existe mais sai do formulário. O resto fica como a pessoa deixou.
 */
export function fitToOptions(values: LeadFormValues, options: CrmLeadOptions): LeadFormValues {
  const listas = leadFormLists(options);
  const manter = (lista: LeadFormOption[], valor: string) => (temValor(lista, valor) ? valor : '');
  const gestor = options.actor.role === 'gestor';
  return {
    ...values,
    source: manter(listas.sources, values.source),
    dor: manter(listas.dores, values.dor),
    modalidade: manter(listas.modalities, values.modalidade),
    funnelStage: manter(listas.funnelStages, values.funnelStage),
    relationship: manter(listas.relationships, values.relationship),
    ownerId: gestor ? (temValor(listas.owners, values.ownerId) ? values.ownerId : options.actor.id) : '',
  };
}

function letras(texto: string): number {
  return (texto.match(/\p{L}/gu) ?? []).length;
}

/** O que falta para mandar. Vazio quando dá para cadastrar. */
export function validateLeadForm(values: LeadFormValues, options: CrmLeadOptions): LeadFormErrors {
  const erros: LeadFormErrors = {};
  if (values.isMinor) {
    if (letras(values.studentName) < 2) erros.studentName = 'Escreva o nome do aluno, com 2 letras ou mais.';
    if (letras(values.guardianName) < 2) {
      erros.guardianName = 'Escreva o nome do responsável, com 2 letras ou mais.';
    }
    const digitos = values.studentWhatsapp.replace(/\D/g, '');
    if (digitos && (digitos.length < 10 || digitos.length > 13)) {
      erros.studentWhatsapp = 'Escreva o WhatsApp do aluno com DDD, ou deixe em branco.';
    }
  } else if (letras(values.name) < 2) {
    erros.name = 'Escreva o nome, com 2 letras ou mais.';
  }
  if (!values.source) erros.source = 'Escolha a origem.';
  if (!values.dor) erros.dor = options.dores.length === 0 ? SEM_DOR_MESSAGE : 'Escolha a dor ou necessidade.';
  if (!parseFunnelStage(values.funnelStage)) erros.funnelStage = 'Escolha o funil e a etapa.';
  return erros;
}

const umEspaco = (texto: string) => texto.trim().replace(/\s+/g, ' ');

/** O bloco `lead` que vai para o Stronizap. Só chamar com o formulário válido. */
export function buildLeadInput(values: LeadFormValues, options: CrmLeadOptions): CrmLeadInput {
  const funil = parseFunnelStage(values.funnelStage);
  if (!funil) throw new Error('Funil e etapa inválidos: valide o formulário antes de montar o cadastro.');
  const outraPessoa =
    options.actor.role === 'gestor' && values.ownerId !== '' && values.ownerId !== options.actor.id;
  const whatsapp = values.studentWhatsapp.replace(/\D/g, '');
  return {
    name: umEspaco(values.isMinor ? values.studentName : values.name),
    source: values.source,
    dor: values.dor,
    modalidade: values.modalidade || null,
    funnelId: funil.funnelId,
    stage: funil.stage,
    // Quem fica com o lead é quem cadastrou, como no Novo lead do Stronilead.
    // Só vai id quando o gestor escolheu outra pessoa.
    ownerId: outraPessoa ? values.ownerId : null,
    minor: values.isMinor
      ? {
          guardianName: umEspaco(values.guardianName),
          relationship: values.relationship || null,
          studentWhatsapp: whatsapp || null,
        }
      : null,
  };
}

/** Campo do formulário que recebe a recusa do Stronilead, pelo `field` que ela traz. */
export function fieldOfRefusal(field: string | null, isMinor: boolean): LeadFormField | null {
  switch (field) {
    case 'name':
      return isMinor ? 'studentName' : 'name';
    case 'funnelId':
    case 'stage':
      return 'funnelStage';
    case 'source':
    case 'dor':
    case 'modalidade':
    case 'ownerId':
    case 'guardianName':
    case 'relationship':
    case 'studentWhatsapp':
      return field;
    default:
      return null;
  }
}

const SO_DO_MENOR: readonly LeadFormField[] = ['studentName', 'guardianName', 'relationship', 'studentWhatsapp'];

/**
 * O campo está na tela agora? Recusa com campo que não aparece (campo do
 * menor com a chave desligada, dono para a consultora) vai para a área geral,
 * senão o texto some junto com o campo.
 */
export function fieldIsShown(field: LeadFormField, values: LeadFormValues, options: CrmLeadOptions): boolean {
  if (SO_DO_MENOR.includes(field)) return values.isMinor;
  if (field === 'name') return !values.isMinor;
  if (field === 'ownerId') return options.actor.role === 'gestor';
  return true;
}

/** Linha embaixo do formulário sobre quem fica com o lead. */
export function ownerNote(values: LeadFormValues, options: CrmLeadOptions): string | null {
  if (options.actor.role !== 'gestor') {
    return options.actor.name
      ? `Fica com você (${options.actor.name}) e soma na sua Meta diária.`
      : 'Fica com você e soma na sua Meta diária.';
  }
  if (!values.ownerId || values.ownerId === options.actor.id) return null;
  const escolhido = options.team?.find((p) => p.id === values.ownerId);
  return escolhido ? `${primeiroNome(escolhido.name)} recebe o aviso no sino do Stronilead.` : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/lib/crmLeadForm.test.ts && npm run typecheck`
Expected: PASS e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/crmLeadForm.ts frontend/src/lib/crmLeadForm.test.ts
git commit -m "feat: regras puras do formulário de cadastro de lead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `Combobox` compacto e as classes do formulário

**Files:**
- Modify: `frontend/src/components/Combobox.tsx` (arquivo inteiro, 130 linhas)
- Modify: `frontend/src/index.css` (depois da linha 601 e depois da linha 1620)
- Create: `frontend/src/components/Combobox.test.tsx`

O painel tem 332px e os campos do mockup têm 30px; o `variant="field"` de hoje tem 42px. A variante nova reaproveita o gatilho `.set-trigger` com um modificador, e o `Combobox` ganha `id` (para o `<label htmlFor>`), `ariaLabel` e `invalid`, sem mudar quem já usa.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/components/Combobox.test.tsx`:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // A lista (cmdk) rola até o item ativo, e o jsdom não tem scrollIntoView.
  Element.prototype.scrollIntoView = () => {};
});

import { Combobox } from './Combobox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

describe('Combobox compacto', () => {
  test('gatilho baixo, com id, nome acessível, erro e o texto de escolher', () => {
    act(() =>
      root.render(
        <Combobox
          variant="compact"
          id="campo-dor"
          ariaLabel="Dor ou necessidade"
          invalid
          options={[{ value: 'Postura', label: 'Postura' }]}
          value=""
          onChange={() => {}}
          placeholder="Escolher"
        />,
      ),
    );

    const gatilho = container.querySelector<HTMLButtonElement>('#campo-dor')!;
    expect(gatilho.getAttribute('aria-label')).toBe('Dor ou necessidade');
    expect(gatilho.getAttribute('aria-invalid')).toBe('true');
    expect(gatilho.className).toContain('set-trigger--compact');
    expect(gatilho.className).toContain('is-empty');
    expect(gatilho.textContent).toContain('Escolher');
  });

  test('escolher uma opção chama onChange com o valor', () => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <Combobox
          variant="compact"
          ariaLabel="Origem"
          options={[
            { value: 'WhatsApp', label: 'WhatsApp' },
            { value: 'Instagram', label: 'Instagram' },
          ]}
          value="WhatsApp"
          onChange={onChange}
        />,
      ),
    );

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Origem"]')!.click());
    const item = [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].find(
      (el) => el.textContent?.trim() === 'Instagram',
    );
    act(() => item!.click());

    expect(onChange).toHaveBeenCalledWith('Instagram');
  });

  test('a variante field de sempre não muda', () => {
    act(() =>
      root.render(<Combobox variant="field" options={[{ value: 'a', label: 'Canal A' }]} value="a" onChange={() => {}} />),
    );

    const gatilho = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    expect(gatilho.className).toContain('set-trigger');
    expect(gatilho.className).not.toContain('set-trigger--compact');
    expect(gatilho.hasAttribute('aria-invalid')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/Combobox.test.tsx`
Expected: FAIL nos dois primeiros testes: sem `id` nem `ariaLabel` no gatilho, `#campo-dor` e `[aria-label="Origem"]` não são achados. O terceiro já passa. (O vitest não confere tipos; o `npm run typecheck` do Step 5 confere.)

- [ ] **Step 3: Reescrever `frontend/src/components/Combobox.tsx`**

Substituir o arquivo inteiro por:

```tsx
import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Linha secundária (ex: "desconectado", "(você)"). Também entra na busca. */
  hint?: string;
}

/**
 * Select com busca (Popover + Command/cmdk) — substitui <select> nativo onde
 * a lista pode ser longa (canais, atendentes). Digite pra filtrar, setas pra
 * navegar, Enter seleciona.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecionar…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado',
  disabled,
  variant = 'default',
  triggerHint = false,
  id,
  ariaLabel,
  invalid = false,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /**
   * `default` = botão outline do shadcn. `field` = gatilho no padrão
   * `.set-input` (42px, raio 10, borda fina), pra casar com os campos das
   * telas de Configurações e do pop-up de transferência. `compact` = o mesmo
   * gatilho em 30px, para o cadastro de lead no painel do contato.
   */
  variant?: 'default' | 'field' | 'compact';
  /** Mostra o hint da opção escolhida ao lado do nome, dentro do gatilho. */
  triggerHint?: boolean;
  /** Liga o gatilho a um `<label htmlFor>`. */
  id?: string;
  /** Nome acessível do gatilho, quando a legenda visível não basta. */
  ariaLabel?: string;
  /** Campo com erro: borda de erro e `aria-invalid`. */
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  // Peso e cor do gatilho só mudam em campo que tem opção vazia de verdade
  // (ex: "Sem atendente"). Campo sempre preenchido, como o canal, fica neutro.
  const hasEmptyOption = options.some((o) => !o.value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === 'default' ? (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            id={id}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        ) : (
          <button
            type="button"
            role="combobox"
            id={id}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              'set-trigger',
              variant === 'compact' && 'set-trigger--compact',
              hasEmptyOption && (value ? 'is-filled' : 'is-empty'),
              // No compacto, campo obrigatório ainda sem escolha também fica
              // apagado, para o "Escolher" não parecer um valor.
              variant === 'compact' && !selected && 'is-empty',
            )}
          >
            <span className="set-trigger-value">
              <span className="set-trigger-label">{selected ? selected.label : placeholder}</span>
              {triggerHint && selected?.hint && (
                <span className="set-trigger-hint">{selected.hint}</span>
              )}
            </span>
            <ChevronsUpDown size={15} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-[--radix-popover-trigger-width] p-0', variant === 'compact' && 'min-w-[14rem]')}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value || '__empty__'}
                  // value alimenta o filtro do cmdk — label + hint buscáveis
                  value={`${o.label} ${o.hint ?? ''}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{o.label}</p>
                    {o.hint && <p className="truncate text-xs text-muted-foreground">{o.hint}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Classes em `frontend/src/index.css`**

Logo depois do bloco `.sx-popover.is-open { ... }` (termina na linha 601), acrescentar:

```css
/* Bloco que abre dentro de um painel e empurra o que vem embaixo (o cadastro
   de lead no painel do contato). Mesma ideia do .sx-popover: fica montado
   durante a transição (usePopoverAnimation), `.is-open` liga, e anima na
   entrada e na saída. Sem scale, porque ocupa espaço no fluxo. */
.sx-reveal {
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 180ms ease-out,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.sx-reveal.is-open {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .sx-reveal {
    transition: none;
  }
}
```

E, dentro do `@layer components`, logo depois do bloco `.set-trigger-hint { ... }` (linha 1620 no arquivo original, que anda com a inserção acima) e antes do comentário `/* ───── pop-up de transferência ───── */`, acrescentar:

```css
  /* Gatilho baixo, para o cadastro de lead no painel do contato: o painel
     tem 332px e os campos do mockup têm 30px. */
  .set-trigger.set-trigger--compact {
    height: 30px;
    padding: 0 8px 0 9px;
    border-color: var(--border-strong);
    border-radius: 8px;
    font-size: 12px;
  }
  .set-trigger[aria-invalid='true'] {
    border-color: var(--danger);
  }

  /* Campo de texto do cadastro de lead, par do .set-trigger--compact. */
  .crm-field {
    height: 30px;
    width: 100%;
    padding: 0 9px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--bg-elev);
    color: var(--ink);
    font-size: 12px;
    outline: none;
    transition: border-color var(--t-fast), box-shadow var(--t-fast);
  }
  .crm-field::placeholder {
    color: var(--ink-4);
  }
  .crm-field:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .crm-field[aria-invalid='true'] {
    border-color: var(--danger);
  }

  /* "Cadastrar lead" no painel do contato: contorno verde, fundo só no hover. */
  .crm-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    height: 32px;
    border: 1px solid var(--accent);
    border-radius: 8px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 500;
    transition: background var(--t-fast);
  }
  .crm-cta:hover {
    background: var(--accent-soft);
  }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/Combobox.test.tsx && npm test && npm run typecheck`
Expected: PASS nos três testes, suíte inteira verde (o `TransferDialog` segue com `variant="field"`) e typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Combobox.tsx frontend/src/components/Combobox.test.tsx frontend/src/index.css
git commit -m "feat: Combobox compacto e as classes do formulário de cadastro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `CrmLeadForm`, o formulário e seus estados

**Files:**
- Create: `frontend/src/components/CrmLeadForm.tsx`
- Create: `frontend/src/components/CrmLeadForm.test.tsx`

Os estados dos mockups: carregando, visão da consultora (sem o campo Consultor responsável, com "Fica com você"), visão do gestor (campo Consultor responsável e o aviso do sino), menor de idade, sem dor cadastrada, fora da equipe (quadro 5), recusa no campo, recusa geral e Stronilead fora do ar (quadro 6, com o formulário preenchido e "Tentar de novo"). O cartão depois do cadastro (quadro 4) é da Task 14.

Todos os hooks ficam no topo do componente, antes de qualquer `return` (CLAUDE.md, seção 14).

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/components/CrmLeadForm.test.tsx`:

```tsx
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // A lista do Combobox (cmdk) rola até o item ativo, e o jsdom não tem scrollIntoView.
  Element.prototype.scrollIntoView = () => {};
});

const get = vi.fn();
const post = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { CrmLeadForm, FALHA_AO_ABRIR, FALHA_AO_CADASTRAR } from './CrmLeadForm';
import { SEM_DOR_MESSAGE } from '../lib/crmLeadForm';
import type { CrmCard, CrmLeadOptions } from '../types/crm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONSULTORA: CrmLeadOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
  sources: [{ name: 'Instagram' }, { name: 'WhatsApp' }],
  dores: [{ name: 'Emagrecer' }, { name: 'Postura' }],
  modalities: [{ name: 'Musculação' }, { name: 'Pilates' }],
  funnels: [{ id: 'comercial', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] }],
  relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
  defaults: { source: 'WhatsApp', funnelId: 'comercial', stage: 'Novo lead' },
};

const GESTOR: CrmLeadOptions = {
  ...CONSULTORA,
  actor: { id: 'u-jo', name: 'Johnny Bittencourt', role: 'gestor' },
  team: [
    { id: 'u-jo', name: 'Johnny Bittencourt' },
    { id: 'u-ana', name: 'Ana Souza' },
    { id: 'u-bruno', name: 'Bruno Lima' },
  ],
};

const CARTAO: CrmCard = {
  found: true,
  leadId: 'lead-1',
  kind: 'lead',
  name: 'Mariana Souza',
  stage: 'Novo lead',
  source: 'WhatsApp',
  consultantName: 'Ana Souza',
  strip: null,
  appointment: null,
};

const onCancel = vi.fn();
const onDone = vi.fn();
const onGone = vi.fn();

let container: HTMLDivElement;
let root: Root;

function montar(props: Partial<ComponentProps<typeof CrmLeadForm>> = {}) {
  act(() => {
    root.render(
      <CrmLeadForm
        conversationId="conv-1"
        contactName="Mariana"
        onCancel={onCancel}
        onDone={onDone}
        onGone={onGone}
        {...props}
      />,
    );
  });
}

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

function controle<T extends HTMLElement = HTMLElement>(nome: string): T {
  const el = document.querySelector<T>(`[aria-label="${nome}"]`);
  if (!el) throw new Error(`controle "${nome}" não achado`);
  return el;
}

const existe = (nome: string) => document.querySelector(`[aria-label="${nome}"]`) !== null;

function digitar(nome: string, valor: string) {
  const input = controle<HTMLInputElement>(nome);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function itensAbertos(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[cmdk-item]')];
}

function escolher(nome: string, opcao: string) {
  act(() => controle<HTMLButtonElement>(nome).click());
  const item = itensAbertos().find((el) => el.textContent?.trim() === opcao);
  if (!item) throw new Error(`opção "${opcao}" não achada em "${nome}"`);
  act(() => item.click());
}

function opcoesDe(nome: string): string[] {
  act(() => controle<HTMLButtonElement>(nome).click());
  const rotulos = itensAbertos().map((el) => el.textContent?.trim() ?? '');
  // Clicar no gatilho de novo fecha a lista.
  act(() => controle<HTMLButtonElement>(nome).click());
  return rotulos;
}

const botao = (rotulo: string) =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === rotulo);

const texto = () => container.textContent ?? '';

function erroHttp(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

async function enviar(rotulo = 'Cadastrar lead') {
  await act(async () => {
    botao(rotulo)!.click();
  });
  await flush();
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  onCancel.mockReset();
  onDone.mockReset();
  onGone.mockReset();
  get.mockResolvedValue({ data: CONSULTORA });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

describe('CrmLeadForm: abrir', () => {
  test('abre em Carregando… e pede as opções da conversa', () => {
    get.mockReturnValueOnce(new Promise(() => {}));

    montar();

    expect(texto()).toContain('Carregando…');
    expect(get).toHaveBeenCalledWith('/conversations/conv-1/crm-lead-options');
    expect(existe('Nome')).toBe(false);
  });

  test('consultora: nome do contato, origem e funil do Stronilead, sem Consultor responsável e com o aviso da Meta diária', async () => {
    montar();
    await flush();

    expect(controle<HTMLInputElement>('Nome').value).toBe('Mariana');
    expect(controle('Origem').textContent).toContain('WhatsApp');
    expect(controle('Funil e etapa').textContent).toContain('Comercial · Novo lead');
    expect(existe('Consultor responsável')).toBe(false);
    expect(texto()).toContain('Fica com você (Ana Souza) e soma na sua Meta diária.');
  });

  test('gestor: escolhe o consultor responsável e vê o aviso do sino', async () => {
    get.mockResolvedValue({ data: GESTOR });
    montar();
    await flush();

    expect(controle('Consultor responsável').textContent).toContain('Você (Johnny)');
    expect(texto()).not.toContain('Meta diária');

    escolher('Consultor responsável', 'Ana Souza');

    expect(texto()).toContain('Ana recebe o aviso no sino do Stronilead.');
  });

  test('nenhuma lista mora no Stronizap: as opções são as que vieram do Stronilead', async () => {
    get.mockResolvedValue({
      data: { ...CONSULTORA, dores: [{ name: 'Dor que só esta academia tem' }], relationships: ['Madrinha'] },
    });
    montar();
    await flush();

    expect(opcoesDe('Dor ou necessidade')).toEqual(['Dor que só esta academia tem']);
    act(() => controle('Quem escreve é responsável por um menor').click());
    expect(opcoesDe('Parentesco')).toEqual(['Não informado', 'Madrinha']);
  });

  test('sem dor cadastrada: o aviso no lugar do campo e o botão não cadastra', async () => {
    get.mockResolvedValue({ data: { ...CONSULTORA, dores: [] } });
    montar();
    await flush();

    expect(texto()).toContain(SEM_DOR_MESSAGE);
    expect(existe('Dor ou necessidade')).toBe(false);
    expect(botao('Cadastrar lead')?.disabled).toBe(true);
  });

  test('fora da equipe: o aviso do Stronilead no lugar do formulário', async () => {
    const message =
      'Seu e-mail do Stronizap, bia@stronix.com.br, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.';
    get.mockRejectedValueOnce(erroHttp(403, { error: message, code: 'fora_da_equipe' }));
    montar();
    await flush();

    expect(texto()).toContain(message);
    expect(existe('Nome')).toBe(false);
    expect(botao('Cadastrar lead')).toBeUndefined();
  });

  test('Stronilead fora do ar ao abrir: Tentar de novo pede as opções outra vez', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    montar();
    await flush();

    expect(texto()).toContain(FALHA_AO_ABRIR);
    await enviar('Tentar de novo');

    expect(get).toHaveBeenCalledTimes(2);
    expect(controle<HTMLInputElement>('Nome').value).toBe('Mariana');
  });

  test('integração desligada no meio do caminho: a seção some', async () => {
    get.mockRejectedValueOnce(
      erroHttp(412, { error: 'A integração com o Stronilead está desligada nesta organização.', code: 'desligado' }),
    );
    montar();
    await flush();

    expect(onGone).toHaveBeenCalledWith('desligado');
  });

  test('Cancelar chama quem fecha o formulário', async () => {
    montar();
    await flush();

    act(() => botao('Cancelar')!.click());

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('CrmLeadForm: cadastrar', () => {
  test('campos obrigatórios: não manda nada e diz o que falta', async () => {
    montar();
    await flush();

    digitar('Nome', 'M');
    await enviar();

    expect(texto()).toContain('Escreva o nome, com 2 letras ou mais.');
    expect(texto()).toContain('Escolha a dor ou necessidade.');
    expect(controle('Nome').getAttribute('aria-invalid')).toBe('true');
    expect(post).not.toHaveBeenCalled();
  });

  test('deu certo: manda o bloco lead e entrega o cartão com o aviso de criado', async () => {
    post.mockResolvedValueOnce({ data: { card: CARTAO } });
    montar();
    await flush();

    escolher('Dor ou necessidade', 'Postura');
    await enviar();

    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-lead', {
      lead: {
        name: 'Mariana',
        source: 'WhatsApp',
        dor: 'Postura',
        modalidade: null,
        funnelId: 'comercial',
        stage: 'Novo lead',
        ownerId: null,
        minor: null,
      },
    });
    expect(onDone).toHaveBeenCalledWith(CARTAO, { kind: 'criado' });
  });

  test('menor: os campos do responsável, o aviso do número e o bloco minor no pedido', async () => {
    post.mockResolvedValueOnce({ data: { card: CARTAO } });
    montar();
    await flush();

    act(() => controle('Quem escreve é responsável por um menor').click());

    expect(existe('Nome')).toBe(false);
    expect(controle<HTMLInputElement>('Nome do responsável').value).toBe('Mariana');
    expect(texto()).toContain('O número desta conversa fica como telefone do responsável.');

    digitar('Nome do aluno', 'Pedro Souza');
    escolher('Parentesco', 'Mãe');
    digitar('WhatsApp do aluno', '(51) 99999-0000');
    escolher('Dor ou necessidade', 'Postura');
    await enviar();

    expect(post).toHaveBeenCalledWith('/conversations/conv-1/crm-lead', {
      lead: {
        name: 'Pedro Souza',
        source: 'WhatsApp',
        dor: 'Postura',
        modalidade: null,
        funnelId: 'comercial',
        stage: 'Novo lead',
        ownerId: null,
        minor: { guardianName: 'Mariana', relationship: 'Mãe', studentWhatsapp: '51999990000' },
      },
    });
  });

  test('enquanto cadastra, o botão diz Cadastrando… e não manda duas vezes', async () => {
    post.mockReturnValueOnce(new Promise(() => {}));
    montar();
    await flush();

    escolher('Dor ou necessidade', 'Postura');
    await act(async () => {
      botao('Cadastrar lead')!.click();
    });

    const enviando = botao('Cadastrando…');
    expect(enviando?.disabled).toBe(true);
    act(() => enviando!.click());
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('número já cadastrado: entrega o cartão com o texto do Stronilead', async () => {
    const message = 'Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.';
    post.mockRejectedValueOnce(
      erroHttp(409, { error: message, code: 'ja_cadastrado', card: CARTAO, createdAt: '2026-09-29T14:32:00.000Z' }),
    );
    montar();
    await flush();

    escolher('Dor ou necessidade', 'Postura');
    await enviar();

    expect(onDone).toHaveBeenCalledWith(CARTAO, { kind: 'ja_cadastrado', message });
  });

  test('item que sumiu do catálogo: o texto no campo e as opções voltam do Stronilead', async () => {
    const message = 'Essa modalidade não existe mais no Stronilead. Escolha de novo.';
    post.mockRejectedValueOnce(erroHttp(422, { error: message, code: 'catalogo_mudou', field: 'modalidade' }));
    montar();
    await flush();

    escolher('Dor ou necessidade', 'Postura');
    escolher('Modalidade', 'Pilates');
    get.mockResolvedValueOnce({ data: { ...CONSULTORA, modalities: [{ name: 'Musculação' }] } });
    await enviar();

    expect(texto()).toContain(message);
    expect(get).toHaveBeenCalledTimes(2);
    expect(controle('Modalidade').textContent).toContain('Sem modalidade');
    expect(controle('Dor ou necessidade').textContent).toContain('Postura');
    expect(onDone).not.toHaveBeenCalled();
  });

  test('recusa sem campo (limite por hora) aparece na área geral e o formulário fica', async () => {
    const message = 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.';
    post.mockRejectedValueOnce(erroHttp(429, { error: message, code: 'limite' }));
    montar();
    await flush();

    escolher('Dor ou necessidade', 'Postura');
    await enviar();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(controle<HTMLInputElement>('Nome').value).toBe('Mariana');
  });

  test('Stronilead fora do ar ao cadastrar: o que foi preenchido fica, e Tentar de novo não duplica', async () => {
    post.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    montar();
    await flush();

    escolher('Dor ou necessidade', 'Postura');
    await enviar();

    expect(texto()).toContain(FALHA_AO_CADASTRAR);
    expect(controle<HTMLInputElement>('Nome').value).toBe('Mariana');
    expect(controle('Dor ou necessidade').textContent).toContain('Postura');

    // O lead chegou a ser criado apesar do erro: a nova tentativa recebe
    // ja_cadastrado e mostra o cartão, sem lead repetido.
    const message = 'Esse número foi cadastrado há pouco. Quem cuida é Ana Souza.';
    post.mockRejectedValueOnce(erroHttp(409, { error: message, code: 'ja_cadastrado', card: CARTAO }));
    await enviar('Tentar de novo');

    expect(post).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith(CARTAO, { kind: 'ja_cadastrado', message });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmLeadForm.test.tsx`
Expected: FAIL, porque `./CrmLeadForm` não existe.

- [ ] **Step 3: Criar `frontend/src/components/CrmLeadForm.tsx`**

```tsx
// Cadastro de lead no Stronilead, dentro da seção do Stronilead no painel do
// contato (modelo B dos mockups em
// stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-mockup.html).
//
// Cada abertura pede as opções ao Stronilead (`lead-options`): nenhuma lista
// mora no Stronizap e nenhum campo aceita texto livre para elas. Recusa do
// Stronilead aparece com o texto dele, no campo quando ela diz qual. Sem
// resposta, o que foi preenchido fica e o botão vira "Tentar de novo".
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from './Combobox';
import { Switch } from './ui/switch';
import { createLead, fetchLeadOptions, type LeadFailure } from '../lib/crmLead';
import {
  buildLeadInput,
  fieldIsShown,
  fieldOfRefusal,
  fitToOptions,
  initialLeadForm,
  leadFormLists,
  ownerNote,
  SEM_DOR_MESSAGE,
  validateLeadForm,
  type LeadFormErrors,
  type LeadFormField,
  type LeadFormOption,
  type LeadFormValues,
} from '../lib/crmLeadForm';
import type { CrmCard, CrmLeadOptions, CrmLeadRefusalCode } from '../types/crm';

/** O que aparece embaixo do cartão depois do cadastro, só para quem cadastrou. */
export type CadastroAviso = { kind: 'criado' } | { kind: 'ja_cadastrado'; message: string };

export const FALHA_AO_ABRIR = 'Não deu para falar com o Stronilead agora.';
export const FALHA_AO_CADASTRAR =
  'Não deu para falar com o Stronilead agora. O que você preencheu continua aqui.';

/** Recusas depois das quais as listas mudaram no Stronilead e voltam de lá. */
const RECARREGA_OPCOES: readonly CrmLeadRefusalCode[] = [
  'catalogo_mudou',
  'sem_dor_cadastrada',
  'responsavel_invalido',
];

const BOTAO_PRINCIPAL = 'sx-btn-primary h-[30px] rounded-lg px-3.5 text-xs';

type Fase =
  | { kind: 'carregando' }
  | { kind: 'falha_ao_abrir' }
  | { kind: 'recusado_ao_abrir'; message: string }
  | { kind: 'fora_da_equipe'; message: string }
  | { kind: 'pronto' }
  | { kind: 'enviando' };

type Recusa = Extract<LeadFailure, { kind: 'recusa' }>;

interface Props {
  conversationId: string;
  /** Nome do contato no Stronizap. Abre no Nome e no Nome do responsável, do menor. */
  contactName: string;
  onCancel: () => void;
  /** Lead criado, ou número que já estava lá: o cartão que veio entra no lugar do formulário. */
  onDone: (card: CrmCard, aviso: CadastroAviso) => void;
  /** Integração desligada ou chave recusada: a seção some, como no cartão. */
  onGone: (reason: 'desligado' | 'indisponivel') => void;
}

export function CrmLeadForm({ conversationId, contactName, onCancel, onDone, onGone }: Props) {
  const id = useId();
  // O nome da abertura. Se o contato for renomeado com o formulário aberto,
  // o que a pessoa está editando não muda sozinho.
  const [nomeInicial] = useState(contactName);
  const [fase, setFase] = useState<Fase>({ kind: 'carregando' });
  const [options, setOptions] = useState<CrmLeadOptions | null>(null);
  const [values, setValues] = useState<LeadFormValues | null>(null);
  const [erros, setErros] = useState<LeadFormErrors>({});
  const [avisoGeral, setAvisoGeral] = useState<string | null>(null);
  const [semResposta, setSemResposta] = useState(false);

  // Troca de conversa desmonta o formulário com um pedido no ar. A resposta
  // que chega depois não mexe em nada: o socket já leva o cartão novo a quem
  // está com o contato aberto.
  const vivo = useRef(false);
  const ultimoPedido = useRef(0);
  const saidas = useRef({ onDone, onGone });
  useEffect(() => {
    saidas.current = { onDone, onGone };
  });

  async function carregarOpcoes(manterValores: boolean) {
    const meu = ++ultimoPedido.current;
    if (!manterValores) setFase({ kind: 'carregando' });
    const r = await fetchLeadOptions(conversationId);
    if (!vivo.current || meu !== ultimoPedido.current) return;
    if (r.kind === 'ok') {
      setOptions(r.options);
      setValues((atual) =>
        manterValores && atual ? fitToOptions(atual, r.options) : initialLeadForm(r.options, nomeInicial),
      );
      if (!manterValores) setFase({ kind: 'pronto' });
      return;
    }
    // Recarga depois de uma recusa: o formulário segue como está.
    if (manterValores) return;
    if (r.kind === 'sumiu') saidas.current.onGone(r.reason);
    else if (r.kind === 'indisponivel') setFase({ kind: 'falha_ao_abrir' });
    else if (r.code === 'fora_da_equipe') setFase({ kind: 'fora_da_equipe', message: r.message });
    else setFase({ kind: 'recusado_ao_abrir', message: r.message });
  }

  useEffect(() => {
    vivo.current = true;
    void carregarOpcoes(false);
    return () => {
      vivo.current = false;
    };
    // Uma vez por abertura: o formulário remonta a cada abertura e a cada
    // conversa, e as opções voltam do Stronilead toda vez.
  }, []);

  function mudar<K extends keyof LeadFormValues>(campo: K, valor: LeadFormValues[K]) {
    setValues((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    // Mexeu no campo, o erro dele sai. A chave do menor não tem erro próprio.
    if (campo !== 'isMinor') {
      setErros((atual) => {
        const novo = { ...atual };
        delete novo[campo as LeadFormField];
        return novo;
      });
    }
    setAvisoGeral(null);
  }

  function aplicarRecusa(r: Recusa, valores: LeadFormValues, opcoes: CrmLeadOptions) {
    if (r.code === 'fora_da_equipe') {
      setFase({ kind: 'fora_da_equipe', message: r.message });
      return;
    }
    const campo: LeadFormField | null =
      fieldOfRefusal(r.field, valores.isMinor) ??
      (r.code === 'sem_dor_cadastrada' ? 'dor' : r.code === 'responsavel_invalido' ? 'ownerId' : null);
    if (campo && fieldIsShown(campo, valores, opcoes)) {
      const novos: LeadFormErrors = {};
      novos[campo] = r.message;
      setErros(novos);
    } else {
      setAvisoGeral(r.message);
    }
    // Item apagado do catálogo, dor que sumiu, pessoa que saiu da equipe: as
    // listas mudaram no Stronilead e voltam de lá, com o que foi preenchido.
    if (r.code && (RECARREGA_OPCOES as readonly string[]).includes(r.code)) void carregarOpcoes(true);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!options || !values || fase.kind !== 'pronto') return;
    const problemas = validateLeadForm(values, options);
    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return;
    }
    setErros({});
    setAvisoGeral(null);
    setFase({ kind: 'enviando' });
    const r = await createLead(conversationId, buildLeadInput(values, options));
    if (!vivo.current) return;
    switch (r.kind) {
      case 'criado':
        saidas.current.onDone(r.card, { kind: 'criado' });
        return;
      case 'ja_cadastrado':
        saidas.current.onDone(r.card, { kind: 'ja_cadastrado', message: r.message });
        return;
      case 'sumiu':
        saidas.current.onGone(r.reason);
        return;
      case 'indisponivel':
        setFase({ kind: 'pronto' });
        setSemResposta(true);
        return;
      case 'recusa':
        setFase({ kind: 'pronto' });
        setSemResposta(false);
        aplicarRecusa(r, values, options);
        return;
    }
  }

  if (fase.kind === 'carregando') {
    return (
      <p role="status" className="text-xs" style={{ color: 'var(--ink-3)' }}>
        Carregando…
      </p>
    );
  }

  if (fase.kind === 'fora_da_equipe') {
    return (
      <div
        data-crm-fora-da-equipe=""
        className="flex gap-2 rounded-[10px] p-2.5"
        style={{ background: 'var(--bg-soft)' }}
      >
        <UserX size={16} aria-hidden className="mt-px flex-none" style={{ color: 'var(--ink-3)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {fase.message}
        </p>
      </div>
    );
  }

  if (fase.kind === 'falha_ao_abrir' || fase.kind === 'recusado_ao_abrir') {
    return (
      <div className="flex flex-col gap-2.5">
        <CaixaDeErro>{fase.kind === 'falha_ao_abrir' ? FALHA_AO_ABRIR : fase.message}</CaixaDeErro>
        <Botoes onCancel={onCancel}>
          {fase.kind === 'falha_ao_abrir' && (
            <button type="button" className={BOTAO_PRINCIPAL} onClick={() => void carregarOpcoes(false)}>
              Tentar de novo
            </button>
          )}
        </Botoes>
      </div>
    );
  }

  if (!options || !values) return null;

  const listas = leadFormLists(options);
  const semDor = options.dores.length === 0;
  const enviando = fase.kind === 'enviando';
  const nota = ownerNote(values, options);
  const rotuloDoBotao = enviando ? 'Cadastrando…' : semResposta ? 'Tentar de novo' : 'Cadastrar lead';

  return (
    <form onSubmit={enviar} noValidate aria-label="Cadastro no Stronilead" className="flex flex-col gap-2.5">
      {!values.isMinor && (
        <CampoTexto
          id={`${id}nome`}
          rotulo="Nome"
          valor={values.name}
          erro={erros.name}
          onChange={(v) => mudar('name', v)}
        />
      )}

      <div className="flex items-center gap-2">
        <Switch
          id={`${id}menor`}
          checked={values.isMinor}
          onCheckedChange={(v) => mudar('isMinor', v)}
          aria-label="Quem escreve é responsável por um menor"
        />
        <label htmlFor={`${id}menor`} className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
          Quem escreve é responsável por um menor
        </label>
      </div>

      {values.isMinor && (
        <>
          <CampoTexto
            id={`${id}aluno`}
            rotulo="Nome do aluno"
            valor={values.studentName}
            erro={erros.studentName}
            onChange={(v) => mudar('studentName', v)}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <CampoTexto
              id={`${id}responsavel`}
              rotulo="Nome do responsável"
              valor={values.guardianName}
              erro={erros.guardianName}
              onChange={(v) => mudar('guardianName', v)}
            />
            <CampoLista
              id={`${id}parentesco`}
              rotulo="Parentesco"
              opcoes={listas.relationships}
              valor={values.relationship}
              erro={erros.relationship}
              onChange={(v) => mudar('relationship', v)}
            />
          </div>
          <CampoTexto
            id={`${id}whatsapp`}
            rotulo="WhatsApp do aluno, se tiver"
            acessivel="WhatsApp do aluno"
            valor={values.studentWhatsapp}
            erro={erros.studentWhatsapp}
            onChange={(v) => mudar('studentWhatsapp', v)}
            placeholder="(51) 9 0000-0000"
            inputMode="tel"
            mono
          />
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            O número desta conversa fica como telefone do responsável.
          </p>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <CampoLista
          id={`${id}origem`}
          rotulo="Origem"
          opcoes={listas.sources}
          valor={values.source}
          erro={erros.source}
          onChange={(v) => mudar('source', v)}
        />
        {!semDor && (
          <CampoLista
            id={`${id}dor`}
            rotulo="Dor ou necessidade"
            opcoes={listas.dores}
            valor={values.dor}
            erro={erros.dor}
            onChange={(v) => mudar('dor', v)}
          />
        )}
        {semDor && (
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
              Dor ou necessidade
            </span>
            <p data-crm-sem-dor="" className="text-[11px] leading-snug" style={{ color: 'var(--notice-danger)' }}>
              {SEM_DOR_MESSAGE}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CampoLista
          id={`${id}modalidade`}
          rotulo="Modalidade"
          opcoes={listas.modalities}
          valor={values.modalidade}
          erro={erros.modalidade}
          onChange={(v) => mudar('modalidade', v)}
        />
        <CampoLista
          id={`${id}funil`}
          rotulo="Funil e etapa"
          opcoes={listas.funnelStages}
          valor={values.funnelStage}
          erro={erros.funnelStage}
          onChange={(v) => mudar('funnelStage', v)}
        />
      </div>

      {options.actor.role === 'gestor' && (
        <CampoLista
          id={`${id}dono`}
          rotulo="Consultor responsável"
          opcoes={listas.owners}
          valor={values.ownerId}
          erro={erros.ownerId}
          onChange={(v) => mudar('ownerId', v)}
        />
      )}

      {nota && (
        <p data-crm-dono="" className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {nota}
        </p>
      )}
      {avisoGeral && <CaixaDeErro>{avisoGeral}</CaixaDeErro>}
      {semResposta && !enviando && <CaixaDeErro>{FALHA_AO_CADASTRAR}</CaixaDeErro>}

      <Botoes onCancel={onCancel}>
        <button type="submit" className={BOTAO_PRINCIPAL} disabled={enviando || semDor}>
          {rotuloDoBotao}
        </button>
      </Botoes>
    </form>
  );
}

function Botoes({ onCancel, children }: { onCancel: () => void; children?: ReactNode }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-[30px] items-center rounded-lg px-2.5 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
        style={{ color: 'var(--ink-2)' }}
      >
        Cancelar
      </button>
      {children}
    </div>
  );
}

function CaixaDeErro({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[10px] px-2.5 py-2 text-xs leading-snug"
      style={{
        background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
        color: 'var(--notice-danger)',
      }}
    >
      {children}
    </p>
  );
}

function ErroDoCampo({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p className="text-[11px] leading-snug" style={{ color: 'var(--notice-danger)' }}>
      {texto}
    </p>
  );
}

function CampoTexto({
  id,
  rotulo,
  acessivel,
  valor,
  erro,
  onChange,
  placeholder,
  inputMode,
  mono,
}: {
  id: string;
  rotulo: string;
  /** Nome acessível mais curto que a legenda visível ("WhatsApp do aluno, se tiver"). */
  acessivel?: string;
  valor: string;
  erro?: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'tel';
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
        {rotulo}
      </label>
      <input
        id={id}
        aria-label={acessivel ?? rotulo}
        aria-invalid={erro ? true : undefined}
        className={cn('crm-field', mono && 'mono')}
        value={valor}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
      />
      <ErroDoCampo texto={erro} />
    </div>
  );
}

function CampoLista({
  id,
  rotulo,
  opcoes,
  valor,
  erro,
  onChange,
}: {
  id: string;
  rotulo: string;
  opcoes: LeadFormOption[];
  valor: string;
  erro?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
        {rotulo}
      </label>
      <Combobox
        id={id}
        ariaLabel={rotulo}
        variant="compact"
        invalid={Boolean(erro)}
        options={opcoes}
        value={valor}
        onChange={onChange}
        placeholder="Escolher"
        searchPlaceholder="Buscar…"
        emptyText="Nada encontrado"
      />
      <ErroDoCampo texto={erro} />
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmLeadForm.test.tsx && npm run typecheck`
Expected: PASS nos 17 testes e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CrmLeadForm.tsx frontend/src/components/CrmLeadForm.test.tsx
git commit -m "feat: formulário de cadastro de lead no painel do contato

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: `CrmCardSection`: botão, formulário, aviso e "Abrir no Stronilead"

**Files:**
- Modify: `frontend/src/components/CrmCardSection.tsx` (arquivo inteiro, 206 linhas)
- Modify: `frontend/src/components/CrmCardSection.test.tsx` (cabeçalho, `beforeEach`/`afterEach` e blocos novos no fim)

O quadro 1 (antes de abrir) e o quadro 4 (depois de cadastrar) moram aqui. O formulário abre e fecha com `usePopoverAnimation` e a classe `.sx-reveal`, animando nos dois sentidos. Cadastrar e Cancelar devolvem o cursor para a caixa de digitar pelo `requestComposerFocus`, depois de tirar o foco do formulário: campo com foco segura o pedido (`decideComposerFocus` em `lib/composerFocus.ts` devolve `skip`).

- [ ] **Step 1: Escrever os testes que falham**

Em `frontend/src/components/CrmCardSection.test.tsx`, trocar as linhas 1-21 (imports, `IS_REACT_ACT_ENVIRONMENT`, `beforeEach` e `afterEach`) por:

```tsx
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // A lista do Combobox (cmdk) rola até o item ativo, e o jsdom não tem scrollIntoView.
  Element.prototype.scrollIntoView = () => {};
});

const get = vi.fn();
const post = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import type { CrmCard, CrmFichaLink, CrmLeadOptions, CrmStrip } from '../types/crm';
import { CrmCardSection, CrmStripBand, type CrmRegistration } from './CrmCardSection';
import { useCrmStore } from '../stores/crm.store';
import { useConversationsStore } from '../stores/conversations.store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  useCrmStore.getState().clear();
  useConversationsStore.setState({ composerFocus: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});
```

Os testes que já existem (`describe('CrmCardSection', ...)`) ficam como estão. No fim do arquivo, acrescentar:

```tsx
// ── Cadastro de lead e "Abrir no Stronilead" (spec 2026-09-29) ─────────────

const LINK: CrmFichaLink = { baseUrl: 'https://stronilead.com.br', tenantSlug: 'stronix-crm-app' };
const SEM_CADASTRO: CrmCard = { found: false };

const CARTAO_NOVO: CrmCard = {
  found: true,
  leadId: 'lead-1',
  kind: 'lead',
  name: 'Mariana Souza',
  stage: 'Novo lead',
  source: 'WhatsApp',
  consultantName: 'Ana Souza',
  strip: null,
  appointment: null,
};

const OPCOES: CrmLeadOptions = {
  actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
  sources: [{ name: 'WhatsApp' }],
  dores: [{ name: 'Postura' }],
  modalities: [{ name: 'Pilates' }],
  funnels: [{ id: 'comercial', name: 'Comercial', stages: [{ name: 'Novo lead' }] }],
  relationships: ['Mãe', 'Pai'],
  defaults: { source: 'WhatsApp', funnelId: 'comercial', stage: 'Novo lead' },
};

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const botao = (rotulo: string) =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === rotulo);

const existe = (nome: string) => document.querySelector(`[aria-label="${nome}"]`) !== null;

function escolher(nome: string, opcao: string) {
  act(() => document.querySelector<HTMLButtonElement>(`[aria-label="${nome}"]`)!.click());
  const item = [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].find(
    (el) => el.textContent?.trim() === opcao,
  );
  if (!item) throw new Error(`opção "${opcao}" não achada em "${nome}"`);
  act(() => item.click());
}

function registro(over: Partial<CrmRegistration> = {}): CrmRegistration {
  return {
    conversationId: 'conv-1',
    contactId: 'contato-1',
    contactName: 'Mariana',
    open: false,
    onOpenChange: () => {},
    ...over,
  };
}

/** Como o ContactPanel: o cartão vem do store, e o aberto ou fechado, de fora. */
function Harness() {
  const card = useCrmStore((s) => s.cards['contato-1']?.card) ?? SEM_CADASTRO;
  const [aberto, setAberto] = useState(false);
  return (
    <CrmCardSection
      card={card}
      fichaLink={LINK}
      registration={registro({ open: aberto, onOpenChange: setAberto })}
    />
  );
}

describe('CrmCardSection: cadastro de lead', () => {
  test('sem permissão para cadastrar, fica só o texto de hoje', () => {
    act(() => root.render(<CrmCardSection card={SEM_CADASTRO} />));

    expect(texto()).toContain('Esse número não está na base.');
    expect(botao('Cadastrar lead')).toBeUndefined();
  });

  test('com permissão, o botão Cadastrar lead pede para abrir o formulário', () => {
    const onOpenChange = vi.fn();
    act(() => root.render(<CrmCardSection card={SEM_CADASTRO} registration={registro({ onOpenChange })} />));

    expect(texto()).toContain('Esse número não está na base.');
    act(() => botao('Cadastrar lead')!.click());

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  test('aberto, o formulário entra no lugar do texto e pede as opções', () => {
    get.mockReturnValue(new Promise(() => {}));
    act(() => root.render(<CrmCardSection card={SEM_CADASTRO} registration={registro({ open: true })} />));

    expect(texto()).toContain('Carregando…');
    expect(texto()).not.toContain('Esse número não está na base.');
    expect(get).toHaveBeenCalledWith('/conversations/conv-1/crm-lead-options');
  });

  test('cadastrou: o cartão entra no lugar do formulário, com a linha de quem cadastrou, o link da ficha e o cursor de volta', async () => {
    useCrmStore.getState().replaceCard('contato-1', SEM_CADASTRO);
    get.mockResolvedValue({ data: OPCOES });
    post.mockResolvedValueOnce({ data: { card: CARTAO_NOVO } });
    act(() => root.render(<Harness />));

    act(() => botao('Cadastrar lead')!.click());
    await flush();
    escolher('Dor ou necessidade', 'Postura');
    await act(async () => {
      botao('Cadastrar lead')!.click();
    });
    await flush();

    expect(useCrmStore.getState().cards['contato-1']?.card).toEqual(CARTAO_NOVO);
    expect(texto()).toContain('Cadastrado agora por você');
    expect(texto()).toContain('Novo lead');
    expect(existe('Nome')).toBe(false);
    expect(
      container.querySelector('a[href="https://stronilead.com.br/stronix-crm-app/ficha/lead-1"]'),
    ).not.toBeNull();
    expect(useConversationsStore.getState().composerFocus?.conversationId).toBe('conv-1');
  });

  test('número já cadastrado: o cartão entra com o texto do Stronilead', async () => {
    const message = 'Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.';
    useCrmStore.getState().replaceCard('contato-1', SEM_CADASTRO);
    get.mockResolvedValue({ data: OPCOES });
    post.mockRejectedValueOnce(
      Object.assign(new Error('HTTP 409'), {
        response: { status: 409, data: { error: message, code: 'ja_cadastrado', card: CARTAO_NOVO } },
      }),
    );
    act(() => root.render(<Harness />));

    act(() => botao('Cadastrar lead')!.click());
    await flush();
    escolher('Dor ou necessidade', 'Postura');
    await act(async () => {
      botao('Cadastrar lead')!.click();
    });
    await flush();

    expect(texto()).toContain(message);
    expect(texto()).not.toContain('Cadastrado agora por você');
  });

  test('Cancelar fecha o formulário animando a saída e devolve o cursor para a caixa', async () => {
    useCrmStore.getState().replaceCard('contato-1', SEM_CADASTRO);
    get.mockResolvedValue({ data: OPCOES });
    act(() => root.render(<Harness />));

    act(() => botao('Cadastrar lead')!.click());
    await flush();
    act(() => botao('Cancelar')!.click());

    // Na saída o formulário ainda está montado, sem o `is-open`.
    expect(container.querySelector('.sx-reveal')?.classList.contains('is-open')).toBe(false);
    expect(useConversationsStore.getState().composerFocus?.conversationId).toBe('conv-1');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(botao('Cadastrar lead')).toBeDefined();
    expect(texto()).toContain('Esse número não está na base.');
  });

  test('integração desligada no meio do cadastro: a seção some do store', async () => {
    useCrmStore.getState().replaceCard('contato-1', SEM_CADASTRO);
    get.mockRejectedValue(
      Object.assign(new Error('HTTP 412'), {
        response: { status: 412, data: { error: 'Desligada.', code: 'desligado' } },
      }),
    );
    act(() => root.render(<Harness />));

    act(() => botao('Cadastrar lead')!.click());
    await flush();

    expect(useCrmStore.getState().cards['contato-1']).toEqual({ card: null, loading: false, reason: 'desligado' });
  });
});

describe('CrmCardSection: Abrir no Stronilead', () => {
  test('cartão de cliente e de lead abrem a ficha em outra aba', () => {
    act(() =>
      root.render(
        <CrmCardSection
          card={{ found: true, leadId: 'lead-9', kind: 'cliente', contractStatus: 'ativo', planName: 'Anual' }}
          fichaLink={LINK}
        />,
      ),
    );

    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="https://stronilead.com.br/stronix-crm-app/ficha/lead-9"]',
    );
    expect(link?.textContent).toContain('Abrir no Stronilead');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
  });

  test('cada menor ganha o link da própria ficha, e o responsável sem cadastro próprio não ganha', () => {
    const card: CrmCard = {
      found: true,
      kind: 'responsavel',
      name: 'Maria',
      wards: [
        { leadId: 'filho-a', kind: 'lead', name: 'Pedro', relationship: 'Mãe', strip: null, appointment: null },
        { leadId: 'filho-b', kind: 'cliente', name: 'Ana', relationship: 'Mãe', strip: null, appointment: null },
      ],
    };
    act(() => root.render(<CrmCardSection card={card} fichaLink={LINK} />));

    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      'https://stronilead.com.br/stronix-crm-app/ficha/filho-a',
      'https://stronilead.com.br/stronix-crm-app/ficha/filho-b',
    ]);
  });

  test('sem o link da organização, nenhum Abrir no Stronilead', () => {
    act(() =>
      root.render(<CrmCardSection card={{ found: true, leadId: 'lead-9', kind: 'lead', stage: 'Novo lead' }} />),
    );

    expect(container.querySelectorAll('a').length).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmCardSection.test.tsx`
Expected: FAIL nos blocos novos (`registration` e `fichaLink` não existem, e não há botão nem link). Os seis testes de antes continuam passando.

- [ ] **Step 3: Reescrever `frontend/src/components/CrmCardSection.tsx`**

Substituir o arquivo inteiro por:

```tsx
// Bloco de contexto do STRONILEAD no painel do contato.
//
// Nada é recalculado aqui: marco de renovação, situação do contrato e tom da
// faixa vêm prontos do CRM. Se a academia mudar as regras lá, este lado
// acompanha sozinho.
//
// Situação de pagamento, CPF, endereço e valor de contrato não aparecem. Não
// vêm no cartão hoje e, se um dia vierem, continuam fora da tela.
//
// Com "Sem cadastro", quem pode cadastrar vê o botão "Cadastrar lead", que
// abre o formulário no mesmo lugar (CrmLeadForm, modelo B dos mockups). Todo
// cartão com lead, e cada menor, ganha o "Abrir no Stronilead", que leva só o
// id na URL.
import { useRef, useState } from 'react';
import { Check, ExternalLink, Info, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CrmCard, CrmFichaLink, CrmStrip, CrmWard } from '../types/crm';
import { crmFichaHref, crmStatus, crmToneKey, crmToneStyle } from '../types/crm';
import { usePopoverAnimation } from '../lib/usePopoverAnimation';
import { useCrmStore } from '../stores/crm.store';
import { useConversationsStore } from '../stores/conversations.store';
import { StronileadLockup } from './StronileadMark';
import { CrmLeadForm, type CadastroAviso } from './CrmLeadForm';

/** O que o painel passa quando quem vê pode cadastrar este contato no Stronilead. */
export interface CrmRegistration {
  conversationId: string;
  contactId: string;
  /** Nome do contato no Stronizap, que abre preenchido. */
  contactName: string;
  /** Formulário aberto. Quem guarda é o ChatPage, para o "Cadastrar" do header abrir direto nele. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrmCardSection({
  card,
  registration = null,
  fichaLink = null,
}: {
  card: CrmCard;
  /** Sem ele, "Sem cadastro" fica só com o texto, como antes. */
  registration?: CrmRegistration | null;
  /** Endereço do Stronilead e identificador da academia. Sem ele, não há "Abrir no Stronilead". */
  fichaLink?: CrmFichaLink | null;
}) {
  const status = crmStatus(card);
  const cliente = card.found && card.kind === 'cliente';
  const lead = card.found && card.kind === 'lead';
  // "Cadastrado agora por você", ou o texto do número que já estava lá. Só na
  // tela de quem cadastrou: some quando o painel remonta, na troca de conversa.
  const [aviso, setAviso] = useState<CadastroAviso | null>(null);
  const href = card.found ? crmFichaHref(fichaLink, card.leadId) : null;

  return (
    <div className="px-5 py-4">
      {/* O lockup faz as vezes do `<h3 className="eyebrow">` das seções
          vizinhas: sinaliza que o bloco veio de fora e, dentro do h3, devolve
          o nó de título que o painel e o leitor de tela esperam. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="min-w-0">
          <StronileadLockup />
        </h3>
        <span
          data-crm-status=""
          className="inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={crmToneStyle(status.key)}
        >
          {status.label}
        </span>
      </div>

      {!card.found && <SemCadastro registration={registration} onAviso={setAviso} />}

      {cliente && (
        <div className="space-y-1.5 text-xs">
          <DataRow label="Plano" value={card.planName} />
          <DataRow label="Vence em" value={formatarData(card.contractEndsAt)} mono />
          <DataRow label="Dias restantes" value={formatarDias(card.daysLeft)} mono />
          <DataRow label="Consultor" value={card.consultantName} />
        </div>
      )}

      {lead && (
        <div className="space-y-1.5 text-xs">
          <DataRow label="Fase" value={card.stage} />
          <DataRow label="Origem" value={card.source} />
          <DataRow label="Consultor" value={card.consultantName} />
          <DataRow label="Agendamento" value={formatarAgendamento(card.appointment)} mono />
        </div>
      )}

      {card.found && (aviso || href) && <RodapeDoCartao aviso={aviso} href={href} />}

      {card.found && Array.isArray(card.wards) && card.wards.length > 0 && (
        <WardsSection wards={card.wards} fichaLink={fichaLink} />
      )}
    </div>
  );
}

/**
 * "Sem cadastro": o texto de sempre e, para quem pode cadastrar, o botão que
 * abre o formulário no mesmo lugar. Abrir e fechar animam nos dois sentidos
 * (usePopoverAnimation e .sx-reveal), como toda janela do Stronizap.
 */
function SemCadastro({
  registration,
  onAviso,
}: {
  registration: CrmRegistration | null;
  onAviso: (aviso: CadastroAviso) => void;
}) {
  const replaceCard = useCrmStore((s) => s.replaceCard);
  const hideCard = useCrmStore((s) => s.hideCard);
  const anim = usePopoverAnimation(Boolean(registration?.open));
  const areaRef = useRef<HTMLDivElement | null>(null);

  // Fecha o formulário e devolve o cursor para a caixa de digitar, como
  // Agendar e Transferir. O foco sai do formulário antes: campo com foco
  // segura o pedido de cursor (lib/composerFocus.ts).
  function fechar(reg: CrmRegistration) {
    const ativo = document.activeElement;
    if (ativo instanceof HTMLElement && areaRef.current?.contains(ativo)) ativo.blur();
    reg.onOpenChange(false);
    useConversationsStore.getState().requestComposerFocus(reg.conversationId);
  }

  if (registration && anim.mounted) {
    const reg = registration;
    return (
      <div ref={areaRef} className={cn('sx-reveal', anim.visible && 'is-open')}>
        <CrmLeadForm
          conversationId={reg.conversationId}
          contactName={reg.contactName}
          onCancel={() => fechar(reg)}
          onDone={(novo, aviso) => {
            onAviso(aviso);
            replaceCard(reg.contactId, novo);
            fechar(reg);
          }}
          onGone={(reason) => {
            hideCard(reg.contactId, reason);
            fechar(reg);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
        Esse número não está na base.
      </p>
      {registration && (
        <button type="button" className="crm-cta mt-2.5" onClick={() => registration.onOpenChange(true)}>
          <UserPlus size={15} aria-hidden />
          Cadastrar lead
        </button>
      )}
    </>
  );
}

/** "Cadastrado agora por você" (ou o texto do número que já estava lá) e o link da ficha. */
function RodapeDoCartao({ aviso, href }: { aviso: CadastroAviso | null; href: string | null }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
      {aviso && (
        <span data-crm-aviso="" className="inline-flex min-w-0 items-start gap-1" style={{ color: 'var(--ink-3)' }}>
          {aviso.kind === 'criado' ? (
            <Check size={12} aria-hidden className="mt-px flex-none" />
          ) : (
            <Info size={12} aria-hidden className="mt-px flex-none" />
          )}
          <span>{aviso.kind === 'criado' ? 'Cadastrado agora por você' : aviso.message}</span>
        </span>
      )}
      {href && <LinkDaFicha href={href} />}
    </div>
  );
}

/** Ficha no Stronilead, em outra aba. Só o id vai na URL. */
function LinkDaFicha({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-auto inline-flex flex-none items-center gap-1 font-medium hover:underline"
      style={{ color: 'var(--accent)', textUnderlineOffset: 2 }}
    >
      Abrir no Stronilead
      <ExternalLink size={11} aria-hidden />
    </a>
  );
}

/**
 * Faixa de prazo. Mora dentro do bloco de identidade, logo abaixo do nome,
 * porque é o que o atendente precisa ver antes de qualquer outra coisa.
 * Só existe quando o CRM manda `strip` — sem prazo, sem faixa.
 */
export function CrmStripBand({ strip }: { strip: CrmStrip }) {
  // O CRM não é validado antes de chegar aqui: `text` que não é texto (ex.:
  // objeto por engano) não pode virar filho do React, que quebraria a tela
  // inteira. Sem texto de verdade, a faixa simplesmente não existe.
  if (typeof strip.text !== 'string' || !strip.text) return null;
  return (
    <div
      className="mt-3 rounded-lg px-3 py-1.5 text-[12px] font-medium"
      style={crmToneStyle(crmToneKey(strip.tone))}
    >
      {strip.text}
    </div>
  );
}

/**
 * Menores que têm este telefone como responsável. Cada um vem pronto do CRM
 * e passa pela mesma regra de status do cartão principal. Item que não é
 * objeto é ignorado: o cartão chega do CRM sem validação.
 */
function WardsSection({ wards, fichaLink }: { wards: CrmWard[]; fichaLink: CrmFichaLink | null }) {
  const validos = wards.filter(
    (w): w is CrmWard => Boolean(w) && typeof w === 'object' && !Array.isArray(w),
  );
  if (validos.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>
        Responsável por
      </h4>
      {validos.map((ward, i) => (
        <WardItem key={`${ward.leadId ?? ''}:${i}`} ward={ward} href={crmFichaHref(fichaLink, ward.leadId)} />
      ))}
    </div>
  );
}

function WardItem({ ward, href }: { ward: CrmWard; href: string | null }) {
  const status = crmStatus({ ...ward, found: true });
  const cliente = ward.kind === 'cliente';
  const nome = typeof ward.name === 'string' && ward.name ? ward.name : 'Sem nome';
  return (
    <div
      data-crm-ward=""
      className="space-y-1.5 rounded-lg px-3 py-2 text-xs"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium" style={{ color: 'var(--ink)' }} title={nome}>
          {nome}
        </span>
        <span
          className="inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={crmToneStyle(status.key)}
        >
          {status.label}
        </span>
      </div>
      <DataRow label="Parentesco" value={ward.relationship} />
      {cliente ? (
        <>
          <DataRow label="Plano" value={ward.planName} />
          <DataRow label="Vence em" value={formatarData(ward.contractEndsAt)} mono />
        </>
      ) : (
        <DataRow label="Fase" value={ward.stage} />
      )}
      <DataRow label="Consultor" value={ward.consultantName} />
      <DataRow label="Agendamento" value={formatarAgendamento(ward.appointment)} mono />
      {ward.strip && typeof ward.strip.text === 'string' && (
        <p
          className="rounded-md px-2 py-1 text-[11.5px] font-medium"
          style={crmToneStyle(crmToneKey(ward.strip.tone))}
        >
          {ward.strip.text}
        </p>
      )}
      {href && (
        <div className="flex text-[11px]">
          <LinkDaFicha href={href} />
        </div>
      )}
    </div>
  );
}

// Rótulo à esquerda, valor à direita. Linha sem valor simplesmente não existe.
function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (typeof value !== 'string' || !value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex-none" style={{ color: 'var(--ink-3)' }}>
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right${mono ? ' mono tabular-nums' : ''}`}
        style={{ color: 'var(--ink)' }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatarData(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatarDias(dias?: number | null): string | null {
  if (dias === null || dias === undefined) return null;
  if (dias === 0) return 'vence hoje';
  if (dias < 0) {
    const n = Math.abs(dias);
    return `${n} ${n === 1 ? 'dia' : 'dias'} em atraso`;
  }
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

function formatarAgendamento(agendamento?: { type: string; at: string } | null): string | null {
  if (!agendamento) return null;
  const d = new Date(agendamento.at);
  if (Number.isNaN(d.getTime())) return agendamento.type;
  return `${agendamento.type} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmCardSection.test.tsx && npm test && npm run typecheck`
Expected: PASS nos 16 testes do arquivo (6 de antes e 10 novos), suíte inteira verde e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CrmCardSection.tsx frontend/src/components/CrmCardSection.test.tsx
git commit -m "feat: painel do contato cadastra lead e abre a ficha no Stronilead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Header, painel, chat e `ChatPage`

**Files:**
- Modify: `frontend/src/components/CrmHeaderMeta.tsx` (arquivo inteiro, 65 linhas)
- Create: `frontend/src/components/CrmHeaderMeta.test.tsx`
- Modify: `frontend/src/components/ContactPanel.tsx` (linhas 7, 9, 19, 21-33, 45, 58, 117 e 132)
- Modify: `frontend/src/components/ChatWindow.tsx` (linhas 36-43 e 471-474)
- Modify: `frontend/src/pages/ChatPage.tsx` (linhas 47, 76-79, 141-144, 183-188 e 199-216)

Aberto ou fechado mora no `ChatPage` (`leadFormFor`, o id da conversa com o cadastro aberto), para o "Cadastrar" do header abrir o painel já no formulário sem efeito nenhum para "consumir" pedido. Trocar de conversa zera o estado, e o painel remonta pela `key` do contato: o que foi digitado fica para trás. Fechar o painel também descarta o cadastro.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/components/CrmHeaderMeta.test.tsx`:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(() => new Promise(() => {})), post: vi.fn() } }));

import { CrmHeaderMeta } from './CrmHeaderMeta';
import { useCrmStore } from '../stores/crm.store';
import { useAuthStore, type AuthUser } from '../stores/auth.store';
import type { CrmCard } from '../types/crm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANA: AuthUser = {
  id: 'ana',
  name: 'Ana Souza',
  email: 'ana@academia.com',
  role: 'ATENDENTE',
  avatarUrl: null,
  showSenderName: true,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useCrmStore.getState().clear();
  useAuthStore.setState({ user: ANA });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function montar(card: CrmCard, props: { jidSuffix?: string | null; onCadastrar?: () => void } = {}) {
  // Com a entrada já no store, o loadCard do componente não pergunta nada.
  useCrmStore.getState().replaceCard('c1', card);
  act(() =>
    root.render(
      <CrmHeaderMeta contactId="c1" jidSuffix={props.jidSuffix ?? null} onCadastrar={props.onCadastrar} />,
    ),
  );
}

const cadastrar = () => container.querySelector<HTMLButtonElement>('button[aria-label="Cadastrar no Stronilead"]');

describe('CrmHeaderMeta: Cadastrar', () => {
  test('sem cadastro, contato de WhatsApp com número: Cadastrar aparece e abre o painel', () => {
    const onCadastrar = vi.fn();
    montar({ found: false }, { onCadastrar });

    expect(container.textContent).toContain('Sem cadastro');
    expect(cadastrar()?.textContent).toBe('Cadastrar');
    act(() => cadastrar()!.click());

    expect(onCadastrar).toHaveBeenCalledTimes(1);
  });

  test('lead já cadastrado: o estado do lead e nada de Cadastrar', () => {
    montar({ found: true, kind: 'lead', stage: 'Novo lead', consultantName: 'Ana Souza' }, { onCadastrar: vi.fn() });

    expect(container.textContent).toContain('Lead · Novo lead · Ana Souza');
    expect(cadastrar()).toBeNull();
  });

  test('contato sem número (LID) ou de Instagram: sem Cadastrar', () => {
    montar({ found: false }, { jidSuffix: 'lid', onCadastrar: vi.fn() });
    expect(cadastrar()).toBeNull();

    montar({ found: false }, { jidSuffix: 'ig', onCadastrar: vi.fn() });
    expect(cadastrar()).toBeNull();
  });

  test('superadmin entrando como admin: sem Cadastrar', () => {
    useAuthStore.setState({ user: { ...ANA, role: 'ADMIN', imp: { byId: 'sa-1' } } });
    montar({ found: false }, { onCadastrar: vi.fn() });

    expect(cadastrar()).toBeNull();
  });

  test('sem quem abra o painel, sem Cadastrar', () => {
    montar({ found: false });

    expect(cadastrar()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CrmHeaderMeta.test.tsx`
Expected: FAIL no primeiro teste (não há botão "Cadastrar"). Os outros quatro já passam, porque hoje o botão nunca aparece.

- [ ] **Step 3: Reescrever `frontend/src/components/CrmHeaderMeta.tsx`**

Substituir o arquivo inteiro por:

```tsx
// Situação do contato no CRM, na linha de meta do header da conversa.
//
// Segue o padrão que a repaginação 2a fixou nessa linha: marcador redondo
// colorido mais texto de 10,5px, sem fundo. Pílula aqui está fora de questão,
// as de fundo cinza saíram do header junto com a faixa Mata. A cor do estado
// vive no marcador e vem de `--t-{tom}-fg`, tom 700, que se lê no papel claro
// (o mais fraco da paleta, "a vencer", dá 5,05:1 sobre branco).
//
// O separador de antes do item mora aqui dentro de propósito: sem cartão o
// componente inteiro some, e a linha não pode ficar com um `·` sobrando entre
// o nome do canal e as etiquetas.
//
// Enquanto o cartão não chegou, ou quando a integração está desligada, o item
// simplesmente não existe: nada de esqueleto piscando no header.
//
// Com "Sem cadastro", o item ganha ao lado o link "Cadastrar", que abre o
// painel do contato já no cadastro de lead. Mesmo recorte do botão do painel:
// contato de WhatsApp com número e fora da sessão do superadmin entrando como
// admin.
import { useEffect } from 'react';
import { useCrmStore } from '../stores/crm.store';
import { isImpersonationSession, useAuthStore } from '../stores/auth.store';
import { hasRealPhone } from '../types/conversation';
import { crmHeaderText, crmStatus } from '../types/crm';
import { StronileadMark } from './StronileadMark';

export function CrmHeaderMeta({
  contactId,
  jidSuffix,
  onCadastrar,
}: {
  contactId: string;
  jidSuffix?: string | null;
  /** Abre o painel já no cadastro de lead. Sem ele, o "Cadastrar" não aparece. */
  onCadastrar?: () => void;
}) {
  const entry = useCrmStore((s) => s.cards[contactId] ?? null);
  const loadCard = useCrmStore((s) => s.loadCard);
  const user = useAuthStore((s) => s.user);

  // Contato LID ou de Instagram guarda um id interno no lugar do telefone. Não
  // há o que procurar no CRM.
  const consultavel = hasRealPhone({ jidSuffix });

  useEffect(() => {
    if (consultavel) loadCard(contactId);
  }, [contactId, consultavel, loadCard]);

  const card = entry?.card ?? null;
  if (!card) return null;

  const status = crmStatus(card);
  const texto = crmHeaderText(card, status.label);
  const podeCadastrar =
    !card.found && consultavel && Boolean(onCadastrar) && !isImpersonationSession(user);

  return (
    <>
      <span aria-hidden style={{ color: 'var(--border-strong)' }}>
        ·
      </span>
      <span
        className="inline-flex min-w-0 max-w-[240px] items-center gap-1.5 text-[10.5px] font-medium"
        style={{ color: 'var(--ink-2)' }}
        title={`Stronilead · ${texto}`}
      >
        {/* Marca de origem: diz que este pedaço da linha veio de fora. */}
        <StronileadMark size={11} />
        <span
          className="block h-1.5 w-1.5 flex-none rounded-full"
          style={{ background: `var(--t-${status.key}-fg)` }}
        />
        <span className="truncate">{texto}</span>
      </span>
      {podeCadastrar && (
        <>
          <span aria-hidden style={{ color: 'var(--border-strong)' }}>
            ·
          </span>
          <button
            type="button"
            onClick={onCadastrar}
            aria-label="Cadastrar no Stronilead"
            className="flex-none text-[10.5px] font-medium hover:underline"
            style={{ color: 'var(--accent)', textUnderlineOffset: 2 }}
          >
            Cadastrar
          </button>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: `ChatWindow` repassa o pedido**

Em `frontend/src/components/ChatWindow.tsx`, trocar a interface e a assinatura (linhas 36-43):

```tsx
interface Props {
  conversation: Conversation;
  onOpenContactPanel?: () => void;
  /** Painel do contato aberto — o avatar do header ganha anel e vira "fechar". */
  contactPanelOpen?: boolean;
}

export function ChatWindow({ conversation, onOpenContactPanel, contactPanelOpen = false }: Props) {
```

por:

```tsx
interface Props {
  conversation: Conversation;
  onOpenContactPanel?: () => void;
  /** Painel do contato aberto — o avatar do header ganha anel e vira "fechar". */
  contactPanelOpen?: boolean;
  /** "Cadastrar" do item do Stronilead no header: abre o painel já no cadastro de lead. */
  onOpenLeadForm?: () => void;
}

export function ChatWindow({
  conversation,
  onOpenContactPanel,
  contactPanelOpen = false,
  onOpenLeadForm,
}: Props) {
```

E trocar o uso do `CrmHeaderMeta` (linhas 471-474):

```tsx
              <CrmHeaderMeta
                contactId={conversation.contactId}
                jidSuffix={conversation.contact.jidSuffix}
              />
```

por:

```tsx
              <CrmHeaderMeta
                contactId={conversation.contactId}
                jidSuffix={conversation.contact.jidSuffix}
                onCadastrar={onOpenLeadForm}
              />
```

- [ ] **Step 5: `ContactPanel` monta o cadastro e o link da ficha**

Em `frontend/src/components/ContactPanel.tsx`:

Trocar a linha 7:

```tsx
import { useAuthStore } from '../stores/auth.store';
```

por:

```tsx
import { isImpersonationSession, useAuthStore } from '../stores/auth.store';
```

Logo depois da linha 9 (`import { crmNameLock, RECADO_TRAVA, type CrmNameLock } from '../lib/crmNameLock';`), acrescentar:

```tsx
import { nomeParaCadastro } from '../lib/crmLeadForm';
```

Trocar a linha 19:

```tsx
import { CrmCardSection, CrmStripBand } from './CrmCardSection';
```

por:

```tsx
import { CrmCardSection, CrmStripBand, type CrmRegistration } from './CrmCardSection';
```

Trocar a interface `Props` e a assinatura (linhas 21-33) por:

```tsx
interface Props {
  contactId: string;
  /**
   * Controla a classe `.is-open` que dispara a animação de entrada/saída
   * (ver `.contact-panel` em index.css). O ChatPage mantém o painel montado
   * durante a transição via `usePopoverAnimation` e alterna `open`.
   */
  open: boolean;
  onClose: () => void;
  onContactUpdated?: (contact: ContactDetail) => void;
  /**
   * Conversa aberta no chat. Com ela e com `onLeadFormOpenChange`, o painel
   * oferece o cadastro de lead no Stronilead. A tela de Contatos não passa:
   * lá não há conversa aberta, e as rotas do cadastro moram sob a conversa.
   */
  conversationId?: string;
  /** Cadastro de lead aberto. Mora no ChatPage, para o "Cadastrar" do header abrir direto nele. */
  leadFormOpen?: boolean;
  onLeadFormOpenChange?: (open: boolean) => void;
}

export function ContactPanel({
  contactId,
  open,
  onClose,
  onContactUpdated,
  conversationId,
  leadFormOpen = false,
  onLeadFormOpenChange,
}: Props) {
```

Logo depois de `const loadCrmCard = useCrmStore((s) => s.loadCard);` (linha 45), acrescentar:

```tsx
  const fichaLink = useCrmStore((s) => s.fichaLink);
  const loadFichaLink = useCrmStore((s) => s.loadFichaLink);
  const me = useAuthStore((s) => s.user);
```

Logo depois do efeito que chama `loadCrmCard` (linhas 56-58), acrescentar:

```tsx
  // "Abrir no Stronilead" precisa do endereço e da academia, que chegam uma
  // vez por sessão pelo GET /organization. Só pergunta com cartão de cadastro.
  const temCadastro = Boolean(crmEntry?.card?.found);
  useEffect(() => {
    if (temCadastro) void loadFichaLink();
  }, [temCadastro, loadFichaLink]);
```

Logo depois de `const crmCard = crmEntry?.card ?? null;` (linha 117), acrescentar:

```tsx
  // Cadastro no Stronilead: só no chat (a conversa diz o canal), só contato de
  // WhatsApp com número e nunca na sessão do superadmin entrando como admin.
  // Quem decide se a pessoa pode cadastrar é o Stronilead, pela equipe dele.
  const registration: CrmRegistration | null =
    conversationId && onLeadFormOpenChange && crmConsultavel && !isImpersonationSession(me)
      ? {
          conversationId,
          contactId: contact.id,
          contactName: nomeParaCadastro(contact),
          open: leadFormOpen,
          onOpenChange: onLeadFormOpenChange,
        }
      : null;
```

E trocar a linha 132:

```tsx
            <CrmCardSection card={crmCard} />
```

por:

```tsx
            <CrmCardSection card={crmCard} registration={registration} fichaLink={fichaLink} />
```

- [ ] **Step 6: `ChatPage` guarda o cadastro aberto**

Em `frontend/src/pages/ChatPage.tsx`, logo depois de `const [contactPanelOpen, setContactPanelOpen] = useState(false);` (linha 47), acrescentar:

```tsx
  // Conversa com o cadastro de lead aberto no painel do contato. Mora aqui, e
  // não no painel, para o "Cadastrar" do header abrir o painel já no
  // formulário.
  const [leadFormFor, setLeadFormFor] = useState<string | null>(null);
```

Trocar o efeito das linhas 76-79:

```tsx
  // Fecha o painel do contato sempre que troca a conversa selecionada
  useEffect(() => {
    setContactPanelOpen(false);
  }, [selectedConvId]);
```

por:

```tsx
  // Fecha o painel do contato sempre que troca a conversa selecionada. O
  // cadastro de lead fecha junto, e o que foi digitado fica para trás.
  useEffect(() => {
    setContactPanelOpen(false);
    setLeadFormFor(null);
  }, [selectedConvId]);
```

Logo depois de `const panelAnim = usePopoverAnimation(showPanel, 320);` (linha 144), acrescentar:

```tsx
  // Fechar o painel descarta o cadastro que estava aberto nele.
  function toggleContactPanel() {
    if (contactPanelOpen) setLeadFormFor(null);
    setContactPanelOpen(!contactPanelOpen);
  }

  function closeContactPanel() {
    setContactPanelOpen(false);
    setLeadFormFor(null);
  }
```

Trocar o `ChatWindow` (linhas 183-188):

```tsx
          <ChatWindow
            conversation={selectedConv}
            contactPanelOpen={contactPanelOpen}
            // Clicar no avatar/nome alterna: abre o painel e fecha de novo.
            onOpenContactPanel={() => setContactPanelOpen((v) => !v)}
          />
```

por:

```tsx
          <ChatWindow
            conversation={selectedConv}
            contactPanelOpen={contactPanelOpen}
            // Clicar no avatar/nome alterna: abre o painel e fecha de novo.
            onOpenContactPanel={toggleContactPanel}
            // "Cadastrar" do header: abre o painel já no cadastro de lead.
            onOpenLeadForm={() => {
              setLeadFormFor(selectedConv.id);
              setContactPanelOpen(true);
            }}
          />
```

E trocar a abertura do `ContactPanel` (linhas 200-204):

```tsx
        <ContactPanel
          key={selectedConv.contactId}
          contactId={selectedConv.contactId}
          open={panelAnim.visible}
          onClose={() => setContactPanelOpen(false)}
```

por:

```tsx
        <ContactPanel
          key={selectedConv.contactId}
          contactId={selectedConv.contactId}
          conversationId={selectedConv.id}
          open={panelAnim.visible}
          onClose={closeContactPanel}
          leadFormOpen={leadFormFor === selectedConv.id}
          onLeadFormOpenChange={(aberto) => setLeadFormFor(aberto ? selectedConv.id : null)}
```

O `onContactUpdated` que vem logo abaixo fica como está.

- [ ] **Step 7: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/components/CrmHeaderMeta.test.tsx && npm test && npm run typecheck`
Expected: PASS nos cinco testes, suíte inteira verde e typecheck limpo (a tela de Contatos continua montando o `ContactPanel` só com `contactId`, `open` e `onClose`).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CrmHeaderMeta.tsx frontend/src/components/CrmHeaderMeta.test.tsx frontend/src/components/ContactPanel.tsx frontend/src/components/ChatWindow.tsx frontend/src/pages/ChatPage.tsx
git commit -m "feat: Cadastrar no header abre o painel no cadastro de lead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: `CLAUDE.md` do Stronizap

**Files:**
- Modify: `CLAUDE.md` (seção 10, linhas 242-265, e seção 14, depois da linha 419)

- [ ] **Step 1: Parágrafo novo na seção 10**

Logo depois do parágrafo que começa com "**Responsável do menor.**" (linha 242) e antes de "**Onde o desenvolvimento está.**", acrescentar:

```markdown
**Cadastro de lead pelo Stronizap.** Contato de WhatsApp com número que aparece como "Sem cadastro" ganha o botão "Cadastrar lead" na seção do Stronilead do painel e o link "Cadastrar" no header, para admin, gestor e atendente com acesso ao canal, menos na sessão do superadmin entrando como admin. O formulário (`CrmLeadForm`, dentro do `CrmCardSection`) pede as opções a cada abertura em `GET /api/conversations/:id/crm-lead-options` e cadastra em `POST /api/conversations/:id/crm-lead`. As duas rotas passam por `services/crm-lead.service.ts`: superadmin e impersonação são recusados antes de olhar a conversa (403 com `code`), depois vêm organização e canal (404 e 403), contato de WhatsApp com número (422 `sem_numero`) e só então o CRM, pelas ações `lead-options` e `create-lead` do mesmo `POST /api/zap` do `match` (`fetchCrmLeadOptions` e `createCrmLead`, com 4 e 8 segundos de tempo máximo). Quem cadastrou sai da sessão (`req.user.email`) e do cadastro do colaborador (nome), nunca do corpo: o `crmLeadBodySchema` só aceita o bloco `lead`. Nenhuma lista mora no Stronizap: origem, dor, modalidade, funil e etapa, parentesco e equipe vêm do Stronilead, em lista fechada remontada por `lerOpcoes` (um e-mail que viesse na equipe não passa), e o padrão de origem, funil e etapa é o `defaults` dele. Recusa do Stronilead chega à tela com o texto dele em `error` e o código em `code`, às vezes com `field`, `card` e `createdAt`. Integração desligada é 412 `desligado`, CRM fora do ar é 503 `indisponivel`, e o 401 do CRM vira 502 `chave_invalida`, nunca 401, porque o `api.ts` do front renovaria a sessão. Depois do cadastro, e também quando a resposta é `ja_cadastrado`, o serviço troca o cartão daquele número no cache (`CrmCache.replaceCard`), marca a cobertura, grava o nome do cadastro e manda `crm_card_updated { contactId, card }` para a sala do canal, que o `crm.store` aplica sem recarregar. O "Abrir no Stronilead" sai de `crmFichaHref`, com o endereço e o identificador que o `GET /organization` já mostra, em todo cartão com `leadId` e em cada menor. A tela de Contatos mostra o link e não mostra o botão, porque lá não há conversa aberta. Spec em `stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md`.
```

- [ ] **Step 2: Smoke e contrato na seção 10**

Trocar o trecho das linhas 248-254:

````markdown
**Antes de qualquer deploy que encoste no contrato**, rodar no servidor (a partir da raiz do repositório, que é onde o deploy deixa a pessoa):

```bash
cd backend && npx tsx src/scripts/smoke-crm-card.ts <telefone> stronix-crm-app
```

Ele fala com o CRM de verdade, usando a chave que já está no banco, e confere o formato da resposta campo a campo. Os testes unitários dos dois lados usam fetch mockado e por isso não pegam deriva entre os sistemas.
````

por:

````markdown
**Antes de qualquer deploy que encoste no contrato**, rodar no servidor (a partir da raiz do repositório, que é onde o deploy deixa a pessoa):

```bash
cd backend && npx tsx src/scripts/smoke-crm-card.ts <telefone> stronix-crm-app [email-da-equipe]
```

Ele fala com o CRM de verdade, usando a chave que já está no banco, e confere o formato da resposta campo a campo: o cartão e as opções do cadastro de lead (`lead-options`, que só lê). Sem o e-mail, as opções são pedidas como o admin mais antigo da organização, que precisa estar na equipe do Stronilead com o mesmo e-mail. O cadastro (`create-lead`) grava lead de verdade e nunca roda no smoke: o `smoke-crm-card.guard.test.ts` trava isso no `npm test`. Os testes unitários dos dois lados usam fetch mockado e por isso não pegam deriva entre os sistemas.
````

Trocar o trecho das linhas 256-263:

```markdown
O contrato mora em quatro arquivos, dois de cada lado. Mexeu em um, confira os outros três:

| Repositório | Arquivo |
|---|---|
| crm-stronix | `api/_zapCard.js` |
| crm-stronix | `api/zap.js` |
| whatsapp-stronix | `backend/src/services/crm.service.ts` |
| whatsapp-stronix | `frontend/src/types/crm.ts` |
```

por:

```markdown
O contrato mora em quatro arquivos, dois de cada lado, e no smoke. Mexeu em um, confira os outros:

| Repositório | Arquivo |
|---|---|
| crm-stronix | `api/_zapCard.js` |
| crm-stronix | `api/zap.js` |
| whatsapp-stronix | `backend/src/services/crm.service.ts` |
| whatsapp-stronix | `frontend/src/types/crm.ts` |
| whatsapp-stronix | `backend/src/scripts/smoke-crm-card.ts` |
```

E, no fim do parágrafo da linha 265 (termina em "continua sendo conferência manual."), acrescentar a frase:

```markdown
 As opções do cadastro de lead não têm lista fechada no smoke: quem fecha é o `lerOpcoes` do `crm.service.ts`, que monta o objeto de novo antes de ele sair para o navegador, e o smoke confere o resultado dessa montagem.
```

- [ ] **Step 3: Regra do front na seção 14**

Logo depois do item que começa com "- Fechar Transferir, Encerrar, Agendar e Enviar contato" (linha 419), acrescentar:

```markdown
- O cadastro de lead no painel do contato (`CrmLeadForm`, dentro do `CrmCardSection`) não guarda lista nenhuma: tudo vem de `GET /conversations/:id/crm-lead-options` a cada abertura. Aberto ou fechado é estado do `ChatPage` (`leadFormFor`), para o "Cadastrar" do header abrir o painel já no formulário, e trocar de conversa ou fechar o painel descarta o que foi digitado. Cadastrar e Cancelar pedem o cursor de volta como os diálogos do item acima, mas tiram o foco do formulário antes, porque campo com foco segura o pedido (`lib/composerFocus.ts`). Leitura do cartão que volta depois de um `replaceCard` não desfaz a troca (`crm.store.ts`).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: cadastro de lead pelo Stronizap na seção da ponte

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Verificação final, PR e publicação

**Files:** nenhum novo

- [ ] **Step 1: Suítes, tipos e build**

```bash
npm test --workspace=backend
npm test --workspace=frontend
npm run typecheck --workspaces
npm run build
(cd backend && npm run test:isolation)
```

Expected: tudo verde. Sobre `8db5ddb`, os números conferidos com este plano aplicado: backend com 494 testes (447 de antes e 47 novos: 26 no `crm.service.test.ts`, 20 no `crm-lead.service.test.ts` e a trava do smoke); frontend com 64 arquivos e 755 testes (58 arquivos de antes e 6 novos: `crmLead`, `crm.store`, `crmLeadForm`, `Combobox`, `CrmLeadForm` e `CrmHeaderMeta`); isolamento com 68 testes, 6 deles de cadastro de lead. Se a `main` andou, os totais mudam; o que vale é nenhuma falha.

- [ ] **Step 2: Nada de migration e nada de chave no front**

```bash
git diff --stat origin/main -- backend/prisma
grep -rn "crmApiKey\|x-stronizap-key" frontend/src
```

Expected: as duas saídas vazias. O schema não mudou (a spec diz "não há mudança no banco do Stronizap") e a chave continua só no backend.

- [ ] **Step 3: Abrir o PR (sem merge)**

```bash
git push -u origin claude/cadastro-lead-pelo-zap
gh pr create --repo johnnychaves/whatsapp-stronix --base main --head claude/cadastro-lead-pelo-zap \
  --title "feat: cadastro de lead no Stronilead pela conversa" \
  --body "$(cat <<'EOF'
Cadastro de lead no Stronilead de dentro da conversa: a metade do Stronizap da spec `stronilead/docs/superpowers/specs/2026-09-29-cadastro-de-lead-pelo-stronizap-design.md` (PR 2 de 2).

**Só entra depois do PR 1 do Stronilead estar em produção.** Sem as ações `lead-options` e `create-lead` no `api/zap.js`, o Stronilead responde 401 e a seção do Stronilead some do painel de quem clicar em Cadastrar.

## O que muda
- Painel do contato: "Cadastrar lead" no "Sem cadastro" de contato de WhatsApp com número, e o formulário no mesmo lugar (modelo B), com as listas vindas do Stronilead a cada abertura
- Header: "Cadastrar" ao lado do "Sem cadastro", que abre o painel já no formulário
- Depois de cadastrar: o cartão entra no lugar do formulário com "Cadastrado agora por você", o nome do contato vira o do cadastro, e quem está com o contato aberto em outro computador vê a troca pelo `crm_card_updated`
- "Abrir no Stronilead" em todo cartão com lead e em cada menor
- Backend: `GET /api/conversations/:id/crm-lead-options` e `POST /api/conversations/:id/crm-lead`, que recusam superadmin e impersonação, conferem organização e canal e exigem contato de WhatsApp com número. Quem cadastrou sai da sessão e do cadastro do colaborador, nunca do corpo
- Smoke do cartão confere também `lead-options` (só leitura) e nunca cadastra
- Sem a integração com o Stronilead ligada, nada muda: o Stronizap segue sozinho, como hoje
- Sem migration

## Antes do merge e do deploy
Teste de ponta a ponta com este branch rodando na máquina, ligado ao Stronilead de produção na `academia-teste` (Task 17, Step 4, do plano `stronilead/docs/superpowers/plans/2026-09-29-cadastro-zap-pr2-stronizap.md`). Só com ele aprovado o PR vai para o merge e para o servidor, à mão, com o smoke novo rodando antes de recarregar o processo (Step 5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: a URL do PR. Não fazer merge: quem aprova e junta é o Johnny, depois do Step 4.

- [ ] **Step 4: Teste de ponta a ponta na máquina, antes de qualquer deploy (executor monta o ambiente, Johnny testa)**

Este branch roda na máquina do Johnny, com banco descartável, e fala com o Stronilead de produção na `academia-teste`, com o PR 1 já no ar (as ações dele ficam paradas até alguém chamar). O executor monta o ambiente (4a e 4b); o Johnny faz o que pede login no Stronilead e celular (4c a 4f): gerar a chave, parear o WhatsApp de teste e mandar as mensagens. Os cadastros deste teste são de verdade, na `academia-teste`.

**4a. Banco descartável e `.env` só deste teste** (na raiz do worktree; o `.env` está no `.gitignore` e nunca vai para o git):

```bash
pg_isready -h localhost -p 5432
createdb stronizap_cadastro_zap
EMAIL_EQUIPE='<e-mail com que o Johnny está na equipe da academia-teste>'
cat > backend/.env <<EOF
NODE_ENV=development
DATABASE_URL=postgresql://$USER@localhost:5432/stronizap_cadastro_zap?schema=public
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SEED_ADMIN_NAME=Johnny
SEED_ADMIN_EMAIL=$EMAIL_EQUIPE
EOF
```

O `SEED_ADMIN_EMAIL` precisa ser o e-mail de alguém da equipe da `academia-teste`: é por ele que o Stronilead acha quem está cadastrando. A senha do admin local é a de teste do `.env.example` (`SEED_ADMIN_PASSWORD`, padrão `ChangeMe123!`). A `ENCRYPTION_KEY` é o que cifra a chave do Stronilead no banco local.

Expected: o Postgres aceitando conexões em `localhost:5432` e o banco criado.

**4b. Migrations, seed, build e os dois servidores.** Nada de `npm run dev:backend`: o `tsx` não carrega o Baileys 7 (CLAUDE.md, seção 11).

```bash
(cd backend && npx prisma migrate deploy && npm run seed)
npm run build --workspace=backend
npm start --workspace=backend        # terminal 1: API em http://localhost:3001
npm run dev --workspace=frontend     # terminal 2: tela em http://localhost:5173
```

Expected: `All migrations have been successfully applied.`, o seed dizendo "Admin criado", a API no ar na 3001 e a tela abrindo em `http://localhost:5173`.

**4c. (Johnny) A chave da `academia-teste`.** No Stronilead de produção, como gestor da `academia-teste`: Configurações → Integrações → Stronizap → Gerar chave. Gerar chave nova revoga a anterior: se alguma organização do Stronizap de produção estiver ligada à `academia-teste`, ela perde o cartão até receber uma chave nova (4g).

**4d. (Johnny) O Stronizap local.** Entrar em `http://localhost:5173` com o `SEED_ADMIN_EMAIL` e a senha de teste.
- Configurações → Stronilead: endereço `https://stronilead.com.br`, identificador `academia-teste` e a chave do 4c. Salvar e clicar em Testar conexão: "O Stronilead respondeu".
- Configurações → Canais: criar um canal de WhatsApp e parear o celular de teste pelo QR Code.
- Configurações → Equipe: criar dois atendentes com o canal liberado, um com o e-mail de uma consultora da equipe da `academia-teste` e outro com um e-mail que não está na equipe. As senhas são locais, de teste.

**4e. Smoke na máquina, contra o Stronilead de produção** (o slug da organização local é `stronix`, criada pelo seed):

```bash
cd backend && npx tsx src/scripts/smoke-crm-card.ts <telefone-de-um-lead-da-academia-teste> stronix <e-mail-da-equipe>
```

Expected: `✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão e opções do cadastro)`.

**4f. (Johnny) O roteiro.** De outro celular, com um número que não está na `academia-teste`, mandar mensagem para o número de teste. A conversa aparece no Stronizap local.

- [ ] Contato de WhatsApp com número e sem cadastro mostra "Cadastrar lead" no painel e "Cadastrar" no header.
- [ ] Integração desligada em Configurações → Stronilead: o botão, o link e a seção do Stronilead somem, e o Stronizap segue como hoje. Ligar de novo.
- [ ] Consultora (entrar como a atendente com o e-mail da consultora): o formulário abre com o nome do contato, a origem com "WhatsApp" e o funil padrão, sem o campo Consultor responsável, e diz "Fica com você (nome) e soma na sua Meta diária.". Cadastrar põe o cartão no lugar do formulário com "Cadastrado agora por você", o nome do contato vira o do cadastro (com a trava de nome) e o header vira "Lead · Novo lead · nome".
- [ ] Gestor (o admin local, que é o Johnny na equipe): o campo "Consultor responsável" aparece; escolhendo outra pessoa, surge "Ana recebe o aviso no sino do Stronilead.", e o sino dela no Stronilead mostra o aviso.
- [ ] No Stronilead de produção, na `academia-teste`: o lead nasce com os campos do Novo lead, no funil e na etapa escolhidos, aparece no Pipeline e na Meta Diária do dono, e a ficha mostra o marco de início nos temas claro e escuro, sem contar como contato (PR 1).
- [ ] A atendente com e-mail fora da equipe vê o aviso do quadro 5 e não cadastra.
- [ ] Menor: com a chave ligada aparecem "Nome do aluno", "Nome do responsável" (já com o nome do contato), Parentesco e "WhatsApp do aluno, se tiver". O número da conversa vira o telefone do responsável e o header vira "Responsável por Pedro". Um irmão com o mesmo responsável entra; o mesmo aluno com o mesmo responsável não duplica.
- [ ] Duas janelas do navegador (o admin numa e a consultora numa janela anônima) com o mesmo contato aberto: a outra vê o header e o painel trocarem sem recarregar.
- [ ] Dois cliques rápidos, ou duas pessoas no mesmo número: um lead só, e a segunda vê o cartão com o texto do Stronilead.
- [ ] Item apagado no Stronilead com o formulário aberto: o cadastro é recusado com o texto no campo, e as opções voltam.
- [ ] "Abrir no Stronilead" abre a ficha certa em outra aba, no cartão de lead, no de cliente e em cada menor.
- [ ] Cadastrar e Cancelar devolvem o cursor para a caixa de digitar. Trocar de conversa com o formulário aberto descarta o que foi digitado. Abrir e fechar o formulário animam nos dois sentidos.
- [ ] Stronilead fora de alcance: com o formulário preenchido, desligar a internet do computador (a tela local segue no ar) e clicar em "Cadastrar lead". O formulário fica preenchido, com "Não deu para falar com o Stronilead agora." e "Tentar de novo". Com a internet de volta, "Tentar de novo" cadastra, ou mostra o cartão se o lead tiver sido criado.
- [ ] Contato de Instagram, contato sem número (LID) e a aba do superadmin entrando como admin: cobertos pelos testes automáticos (`crm-lead.service.test.ts` e a suíte de isolamento). O ambiente local não tem Instagram.

**4g. Limpeza, depois do OK do Johnny:**

```bash
# terminais 1 e 2: Ctrl+C
dropdb stronizap_cadastro_zap
rm backend/.env
rm -rf backend/src/sessions backend/src/uploads
```

`sessions` e `uploads` não têm arquivo versionado: guardam só a sessão do WhatsApp de teste e a mídia recebida. No celular de teste, WhatsApp → Aparelhos conectados: desconectar o aparelho do teste. Se alguma organização do Stronizap de produção usa a `academia-teste`, gerar outra chave no Stronilead e colar lá, em Configurações → Stronilead.

Só com este roteiro todo marcado o PR vai para o merge e para o Step 5.

- [ ] **Step 5: Publicação no servidor (Johnny, depois do Step 4 e do merge)**

O deploy do Stronizap é à mão no servidor. O `deploy.sh` faz pull, build e reload de uma vez; aqui o smoke novo precisa rodar entre o pull e o reload, com o processo antigo ainda no ar.

```bash
sudo -u whatsapp -i
cd /opt/whatsapp-crm
PREV_SHA=$(git rev-parse HEAD)

# 1. Código novo no disco. O processo no ar continua o antigo até o reload.
git fetch origin && git checkout main && git pull --ff-only origin main
npm install
(cd backend && npm run prisma:generate)

# 2. Smoke novo: cartão e opções do cadastro, contra o Stronilead de verdade.
#    <telefone> de um lead que existe; <email> de alguém da equipe do Stronilead.
(cd backend && npx tsx src/scripts/smoke-crm-card.ts <telefone> stronix-crm-app <email>)

# 3a. Smoke passou: build, migrations (nada a aplicar neste PR) e reload.
npm run build --workspace=backend && npm run build --workspace=frontend
(cd backend && npm run prisma:deploy)
pm2 reload whatsapp-stronix-api
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/auth/me   # 401 é o esperado

# 3b. Smoke reprovou: volta o disco, sem tocar no processo que está no ar.
git reset --hard "$PREV_SHA" && npm install && (cd backend && npm run prisma:generate)
```

Expected no passo 2: `✅ SMOKE CRM CARD OK: contrato da ponte de pé (cartão e opções do cadastro)`. `prisma:deploy` responde `No pending migrations to apply.`

O botão passa a valer em toda academia com a integração ligada. Para cada uma, conferir no Stronilead dela (o smoke avisa as duas últimas quando roda com a organização dela):
- cada pessoa da equipe usa o mesmo e-mail nos dois sistemas;
- existe uma origem com "WhatsApp" no nome;
- existem dores cadastradas.

- [ ] **Step 6: Conferência depois do deploy, sem cadastrar ninguém**

Numa conversa com "Sem cadastro" de uma organização com a integração ligada: o botão "Cadastrar lead" aparece no painel e o "Cadastrar" no header; abrir o formulário traz as listas da academia; Cancelar fecha e devolve o cursor. Não cadastrar ninguém de verdade só para conferir.

- [ ] **Step 7: Depois do recurso em produção (fora deste PR)**

A pasta `STRONIX-FIRMA` não é repositório git: estes arquivos se editam direto, sem commit.
- `06-sistemas/CLAUDE.md`, seção "Ponte Stronilead ↔ Stronizap": o cadastro de lead pelo Stronizap e o quinto arquivo do contrato (o smoke);
- `CLAUDE.md` da raiz: uma linha na tabela "Últimas Atualizações" com os PRs dos dois repositórios.
