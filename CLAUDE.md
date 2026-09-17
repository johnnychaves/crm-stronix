# STRONILEAD — CRM para academias

React 19 + Vite + Tailwind v4 (tokens em `src/index.css` via `@theme`) + Firebase (Firestore/Auth) + Vercel serverless (`api/`, **limite 12 funções** no plano Hobby — consolidar antes de criar função nova). Multi-tenant por claim `tenantId`. Sem TypeScript (JS/JSX).

## Padrão de UI — shadcn/ui (adotado 2026-06-12)

A fundação shadcn está instalada: `components.json`, alias `@/` → `src/`, `cn()` em `@/lib/utils`, tokens semânticos mapeados na paleta STRONILEAD (`src/index.css`) e componentes base em `src/components/ui/` (minúsculos: `button.jsx`, `dialog.jsx`, ...).

**Regras para código novo:**

1. **Primitivo complexo novo (modal, menu, tooltip, tabs, combobox...) → use/adicione componente shadcn** (`npx shadcn@latest add <comp>`), não construa na mão. Invoque a skill `shadcn` ao trabalhar nisso.
2. **`cn()` para classes condicionais** — nada de template literals com ternários.
3. **Tokens semânticos** (`bg-background`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`) em componentes novos — eles resolvem dark mode sozinhos (evite `dark:` manual em código novo).
4. **`flex gap-*`** no lugar de `space-x/y-*`; **`size-N`** no lugar de `w-N h-N`.
5. O ramp laranja do app continua em `accent-50..600` (sempre com sufixo numérico); `bg-accent` puro é o token semântico shadcn (hover suave).

**Exceções conhecidas (APFS case-insensitive — NÃO adicionar via shadcn):** `avatar` e `skeleton` colidem com `Avatar.jsx`/`Skeleton.jsx` próprios do app — continue usando os do app.

**Legado:** os componentes próprios (`Btn`, `SettingsCard`, `Field`, ...) e telas existentes seguem como estão; migram para shadcn **oportunisticamente** quando a tela passar por redesign (e redesigns sempre apresentam 2-3 mockups antes — ver memória).

**Radius:** os utilitários `rounded-*` padrão do Tailwind NÃO foram redefinidos (sem `--radius-*` shadcn) para não alterar o visual atual.

## Convenções gerais

- Trabalho sempre via PR (nunca commit direto na main); merge só com aprovação do Johnny.
- UI nova invoca a skill `frontend-design`; identidade: Space Grotesk (display), azul `#2B59FF`, laranja `#FF6A2B`.
- Firestore rules são publicadas MANUALMENTE no console Firebase (não via CLI).
- Lógica da Meta Diária é regra única em `src/lib/dailyGoal.js` — alterações de categoria/critério acontecem lá. Esse arquivo importa `lucide-react`, então nenhuma função de `api/` pode importá-lo (ver a ponte com o Stronizap, abaixo).

## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09

O atendente do Stronizap enxerga um telefone e um nome do WhatsApp. Quem diz se aquilo é lead em negociação, aluno ativo ou contrato vencendo é **este sistema**. O CRM é dono da identidade; o Zap só renderiza o que recebe.

Tudo cabe numa função só, `api/zap.js`:

- `GET /api/zap?tenant=<id>&phone=<dígitos>` com header `x-stronizap-key` devolve o cartão de contexto, ou `{ found: false }` quando ninguém casa. A lista de campos é FECHADA em `api/_zapCard.js` de propósito: nada de CPF, endereço, valor de contrato ou situação de pagamento numa tela de chat.
- `POST /api/zap` com `{ action: 'generate' | 'revoke' }` gera e revoga a chave. Autentica por ID token do admin da academia, nunca pela chave do próprio Zap.

**A chave é emitida aqui.** Fica gravada só como hash em `tenants/{id}.integrations.zap` (`keyHash`, `keyPrefix`, `createdAt`, `createdBy`, `revokedAt`). O valor em claro sai do servidor uma única vez, na tela Configurações → Integrações → Stronizap (`src/views/settings/ZapIntegrationSection.jsx`), e não fica salvo no navegador. Quem perder gera outra. A mesma tela mostra os outros dois dados que o Stronizap pede em Configurações → Stronilead, com os mesmos nomes e na ordem do formulário de lá: endereço do CRM e identificador da academia (`zapConnectionFields`, em `src/lib/zapIntegration.js`). O endereço vai sem `/api/zap`, porque o Stronizap acrescenta o caminho sozinho. Com isso a academia conecta sem pedir nada a ninguém.

**Casamento de telefone.** O campo indexado `lead.zapMatchKey` é o DDD mais os últimos 8 dígitos. É a única parte estável entre o formato daqui (até 11 dígitos, sem DDI) e o do WhatsApp (com 55 na frente, e o nono dígito que existe em número novo e não existe em número antigo). A regra mora em `api/_zapPhone.js` e quem grava é `buildLeadSearchFields`, em `src/lib/leadDerived.js`. Esse builder tem espelho em `api/_referral.js`: mexeu num, mexa no outro, senão `src/lib/__tests__/referralApiMirror.test.js` quebra. Base antiga se acerta com `scripts/backfill-zap-match-key.js`.

**Faixa de destaque** (`api/_zapStrip.js`), por ordem de precedência: visita ou aula de hoje, contrato vencido, freepass válido, marco de renovação. Os gatilhos saem de `src/lib/contracts.js`, de `src/lib/renewalGoal.js` e da conta do freepass. Nenhuma regra é recalculada do outro lado.

**`src/lib/dailyGoal.js` não pode ser importado por função serverless.** Ele importa `lucide-react` e quebra em runtime de servidor. É por isso que a faixa deriva dos módulos puros em vez de reusar as categorias da Meta Diária direto.

**Em `api/`, `snap.exists` é propriedade. Em `src/`, `snap.exists()` é função.** `api/` roda o SDK de servidor (firebase-admin) e `src/` o do navegador, e os dois divergem justamente aqui. Copiar leitura de documento de um lado pro outro sem trocar isso derruba a rota: em 2026-09-10 o cartão do Zap ficou fora do ar para todo contato cadastrado por causa de um `configSnap.exists()` em `api/zap.js`. O `api/__tests__/zapRoute.test.js` testa a rota com um banco falso que imita o SDK de servidor, e é ele que pega esse erro.

**Os marcos de renovação são os da academia.** `api/zap.js` lê `renewalCheckpoints` em `stronix_config/general` depois de achar o lead, e nunca quando ninguém casa, e repassa a `buildZapCard` → `buildZapStrip`. Doc inexistente, campo ausente ou lista malformada caem em `DEFAULT_RENEWAL_CHECKPOINTS` (90/60/30). Mudar os marcos em Configurações → Metas & ritmo muda a Meta Diária e o cartão do Zap juntos.

**Próximo passo.** A Parte B (mensagem enviada virando interação na timeline, Meta Diária deixando de ser autodeclarada, `awaitingReplySince`, fila de contatos a classificar e a rota que abre a conversa a partir do lead) está desenhada em `docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md` e ainda sem plano escrito. Pelo desenho, o `POST` de eventos entra no MESMO `api/zap.js`, não numa função nova. Hoje são 11 das 12 funções da Vercel, e a vaga que sobra continua livre.

## Dashboard CRM (Visão geral → CRM)

O CRM mede o funil de leads por mês de competência, do cadastro até a matrícula: de onde vêm os leads, onde se perdem, quem converte e com que velocidade. O Operacional mede o trabalho e a base de clientes. Spec em `docs/superpowers/specs/2026-09-14-dashboard-crm-design.md`, handoff visual em `docs/superpowers/specs/handoff-crm/` e plano em `docs/superpowers/plans/2026-09-15-dashboard-crm-tela.md`.

- **Contas:** `src/lib/crm/`, puras e testadas. Uma função calcula tudo, `metricsOf(ctx, { monthKey, userId, funnelId, cutEnd })`. A equipe é a soma das pessoas e de Outros, e nenhuma taxa nem mediana é guardada.
- **Recortes:** pessoa é o dono do lead hoje (`consultantId`). Funil é o do lead, e "Todos os funis" deixa de fora Renovações, Vencidos e Upgrade. Importado não conta como lead novo nem como matrícula. Professores são sempre da academia inteira.
- **Matrícula de quem volta:** o retorno de ex-cliente regrava `convertedAt`, mas a matrícula conta pela primeira conversão (`clienteSince`). Por isso os meses fechados também consultam os leads por `clienteSince`.
- **Carga:** `src/hooks/useCrmSources.js`. Ele divide com o Operacional a carga e a memória de sessão dos meses (`src/hooks/monthSources.js`): mexeu num, confira o outro. As consultas do CRM (leads por `convertedAt`, por `clienteSince` e por `lostAt`, e `stronix_aulas` por `scheduledFor`) são de campo único, sem índice para publicar. Aula e visita se separam no navegador (`isAulaRecord`), nunca por `where` no `type`. As aulas do mês corrente e as do mês anterior são relidas do servidor a cada abertura da tela e a cada matrícula ou perda feita com ela aberta (é no mês anterior que a matrícula costuma marcar a conversão do professor). As do mês antes desse vêm do servidor uma vez por sessão, porque o desfecho muda o registro sem mudar a data.
- **Bases que começam tarde:** a passagem entre etapas e a etapa da perda só existem a partir de setembro de 2026 (`STAGE_TRACKING_MONTH`), e os agendamentos antes de setembro de 2026 são incompletos (`APPTS_COMPLETE_MONTH`), porque as visitas só têm registro desde 18/08/2026. As duas datas moram em `src/lib/crm/scope.js`.
- **Desfecho da visita:** ainda não é gravado no registro de `stronix_aulas`. O CRM usa o desfecho do espelho do lead (`appointmentOutcome`) quando ele é da mesma visita e, senão, a última interação `daily_goal_done` de `visita_hoje` do dia marcado ou do seguinte. Gravar o desfecho no próprio registro fica para uma PR separada.
- **Troca de etapa:** a passagem lê a interação `status_change` com `fromStatus`, `toStatus` e `funnelId` (`stageChangeFields`, em `src/lib/stageMove.js`). Um caminho novo que mude a etapa de um lead precisa gravar esses campos, senão o movimento some da passagem.

## Dashboard Gerencial (Visão geral → Gerencial)

A tela do dinheiro vendido: quanto a academia vendeu no mês, quanto a carteira vale por mês, o que está para sair e quem vende. Spec em `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md`, handoff visual em `docs/superpowers/specs/handoff-gerencial/` e plano em `docs/superpowers/plans/2026-09-17-dashboard-gerencial-tela.md`.

- **Não é financeiro.** Todo número é valor de contrato vendido. O sistema não guarda pagamento, parcela nem inadimplência, e a barra da tela diz isso em um chip fixo. Quem confere o que entrou na conta é o financeiro, fora do CRM.
- **Contas:** `src/lib/gerencial/`, puras e testadas, com uma função de entrada, `metricsOf(ctx, { monthKey, cutEnd })`. Nenhum percentual é gravado: ticket médio, fatia da carteira em risco e participação de cada consultor saem da conta a cada leitura.
- **Duas moedas que nunca se somam:** a venda é o valor do contrato inteiro; a carteira e o risco são valor por mês (`value ÷ durationMonths`). O sufixo `/mês` anda colado ao número por isso.
- **A venda conta pela data do fechamento** (`createdAt`, com `startsAt` de reserva), nunca pelo início da vigência. Renovação assinada antes conta no mês do esforço, igual ao Operacional e à comissão. Cada contrato entra em um tipo só, nesta ordem: renovação, upgrade, matrícula nova, retorno de ex-cliente.
- **Cancelado depois continua na venda do mês,** com a marca de quanto foi cancelado. O número de um mês fechado não muda quando alguém cancela hoje.
- **Trancado fica dentro da carteira,** porque volta a valer quando o cliente destranca, e aparece com a contagem à parte. Trancado não vence: o fim da vigência anda na reativação.
- **A carteira soma contrato, não pessoa.** Contrato paralelo é permitido, então quem tem dois vigentes conta duas vezes, e a tela diz quantas pessoas estão nessa situação.
- **Contrato sem valor** (os 494 importados da STRONIX) entra na contagem de contratos e no risco de vencimento, e nunca no dinheiro. Ele também fica fora do denominador do ticket médio. Na tela se distingue por forma, com hachura e borda tracejada, nunca por cor.
- **Carga:** a tela não abre consulta de contrato nenhuma, porque a coleção inteira já chega assinada pelo `useGeneralConfig` (`src/App.jsx`). A única leitura é a dos docs de lead das vendas do mês (`src/hooks/useGerencialLeads.js`), que serve só à origem, em lotes de 30 e uma vez por id na sessão.
- **Histórico curto:** contrato só existe no sistema desde junho de 2026. Mês sem venda não entra na lista de comparação, e sem nenhum mês anterior com venda o controle Comparar sai da barra.
