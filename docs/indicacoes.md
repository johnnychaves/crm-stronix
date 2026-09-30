status: ativo

# Sistema de Indicações (v1 — rastreamento)

Cliente indica aluno novo; o lead indicado entra num funil próprio do sistema e a
ficha do cliente mostra quem ele indicou e o que aconteceu com cada um.

## Modelo de dados

**Lead indicado** (campos em `stronix_leads`):

| Campo | Exemplo | Quando |
|---|---|---|
| `referredById` | `"aB3xY9..."` (id do doc do cliente indicador) | no cadastro com o switch ligado, ou no vínculo retroativo |
| `referredByName` | `"Maria Silva"` (denormalizado, padrão `consultantName`) | idem |
| `referredAt` | `Timestamp` do vínculo | gravado pelo `commitReferralLink` (o `createdAt` mentiria no vínculo retroativo) |

Remover o vínculo zera os três (`null`). Não há contador denormalizado no
indicador: o badge da aba usa `getCountFromServer` e a lista um `getDocs`
(`where('referredById','==',id)` — índice automático, nada publicado no console).

**Funil do sistema** (`stronix_funnels`): `{ name: 'Indicações', systemKind:
'referral', isDefault: false, order: <fim da lista> }`. O discriminador é
`systemKind` — nunca o nome (o usuário pode ter funil homônimo próprio; os dois
convivem e o selo "Sistema" diferencia). **Nunca pode ser o default**: o
fallback legado de `isItemInFunnel` despejaria leads sem `funnelId` nele.

**Etapas** (`stronix_statuses`): entrada fixa `{ name: 'Aguardando ação',
color: 'teal', order: 0, isSystem: true, isEntry: true }` + `Negociação`
(`isSystem`). Venda/Perda já são colunas fixas de todo funil. O usuário
configura só o meio; `pinEntryFirst` mantém a entrada em `order: 0` no reorder.

**Timeline** — `type: 'referral'` (bucket próprio, filtro "Marcos", rótulo
"Indicação"), 3 eventos com texto em `src/lib/referrals.js`:

- no indicado, ao vincular: `🤝 Indicado por {Nome}`
- no indicador, ao vincular: `🤝 Indicou {Nome}`
- no indicador, na 1ª matrícula do indicado: `🎉 {Nome} que você indicou fechou matrícula`

**Config** (`stronix_config/general`): `referralSetupDoneAt` — flag da migração
one-shot (App.jsx) que cria funil/etapas/origem no primeiro login de um admin.
Flag própria porque `funnelsSetupDoneAt` já estava carimbada nos tenants antigos.

## Decisões registradas

- **O indicador não recebe bump de atividade.** Os eventos 🤝/🎉 no doc do
  indicador NÃO gravam `lastInteractionAt`/`interactionsCount` (não é contato
  real) — por isso `referralsWrites.js` monta batch manual em vez de
  `logInteraction`, e `hasActiveInteractionToday` ignora `type: 'referral'`
  (senão o 🎉 acenderia "Já interagido hoje" na Meta de renovação).
- **Estado do indicado é derivado, nunca gravado.** A aba Indicações lê os docs
  na hora (`isClientLead`/`deriveLeadState`), então desfazer uma Venda reflete
  sozinho. Conversões por etapa customizada "matricul*" (fora do
  `commitMatricula`) não disparam o 🎉, mas as contagens nunca mentem.
- **Indicador excluído → vínculo órfão aceito.** Histórico vale mais que
  consistência referencial: o chip continua exibindo o `referredByName`
  denormalizado e a navegação degrada sem quebrar.
- **Cadastro best-effort.** O `referredBy*` vai no próprio `addDoc` do lead; se
  o batch de eventos falhar depois, só a timeline se perde — o vínculo fica.
- **Só cliente indica.** O `ReferrerPicker` filtra `isClientLead` client-side e
  exclui o próprio lead (anti auto-indicação).
- **Mover um lead PRO funil de Indicações exige vincular o indicador**
  (PhaseChanger) — é também o caminho retroativo para leads antigos com origem
  "Indicação".

## Fase 2 — link compartilhável (CONSTRUÍDA 2026-08-09)

Cada cliente tem um link público — `{origin}/i/{slug}?ref={idDoCliente}` — no
menu "Indicar" do cabeçalho da ficha (copiar, ou mandar direto
no WhatsApp do cliente com mensagem pronta). A página pública
(`src/views/public/ReferralLandingScreen.jsx`, gate de rota por pathname no
`App()` — o segmento `/i/` é reservado) mostra a marca da academia e o 1º nome
de quem indicou, e cadastra em dois toques: nome + WhatsApp, com CPF e
modalidade opcionais.

1. **API consolidada em `api/tenant-resolve.js`** (único endpoint 100% público;
   Vercel segue 12/12): actions POST `referral-info` e `referral-signup` via
   Admin SDK — lead no mesmo shape do AddLeadModal, com o espelho puro
   `api/_referral.js` e o teste de paridade (`referralApiMirror.test.js`)
   travando a deriva com o front.
2. **Dono do lead (decidido 2026-08-09)**: o indicado HERDA o consultor
   responsável pelo cliente dono do link. Ref inválido/apagado degrada: página
   sem personalização e lead SEM vínculo no funil default (origem 'Indicação')
   — o coorte do funil de Indicações segue 100% vinculado.
3. **Branding**: `displayName` + `tenants/{slug}.settings.logoUrl` (primeiro
   consumidor real do campo).
4. **Anti-abuso e dedupe (decidido 2026-08-07)**: rate limit
   (`api/_rateLimit.js`) + honeypot + dedupe em DUAS chaves — telefone sempre
   (`findDuplicateLeadRemote`) e CPF quando preenchido (igualdade em
   `cpfDigits`, já materializado em todo lead — índice automático). O CPF no
   formulário é **opcional** com incentivo ("agiliza sua matrícula"):
   obrigatório derrubaria a conversão e não se sustenta na LGPD nesse estágio
   (coleta mínima pra finalidade de agendar visita). O match por CPF é mais
   forte justamente contra CLIENTES/ex-alunos — os que têm CPF via cadastro
   completo/matrícula — que é o caso mais importante de pegar.
5. **Cadastro já existente (decidido 2026-08-07)**: a API nunca cria duplicata,
   e o visitante vê SEMPRE a mesma tela de sucesso — responder "esse número já
   existe" num endpoint público vaza quem é aluno. Por dentro: grava um evento
   na timeline do cadastro existente ("tentou se cadastrar pelo link de
   indicação de {Nome}") e NÃO auto-vincula nem move de funil — o time decide
   (contenção contra farmar indicação com telefone alheio quando houver
   recompensa). No fluxo manual isso já é resolvido pelo dup-check do modal:
   bloqueia, mostra quem é, e o vínculo retroativo sai pelo PhaseChanger.

## Fase 3 — cadastro à mão pela ficha (2026-09-29)

Terceira forma de entrada, ao lado do "É uma indicação?" do Novo lead e do link.
Na ficha do cliente, o menu "Indicar" (antes "Link de indicação") e a aba
Indicações têm "Cadastrar indicação", que abre `src/modals/QuickReferralModal.jsx`.
O pop-up pede nome e WhatsApp (obrigatórios), modalidade e dor (opcionais), e
fica aberto para o próximo indicado depois de cada cadastro.

- O formulário sai de `quickReferralForm` (`src/lib/referrals.js`) e o doc, de
  `buildNewLeadDoc`: funil Indicações, etapa de entrada, origem "Indicação".
- O dono é quem cadastra, como no Novo lead. As rules só deixam o consultor
  criar lead em nome dele mesmo.
- WhatsApp repetido barra, como no Novo lead (`useDuplicateLead` ao vivo e
  `findDuplicateLeadRemote` na hora de gravar).
- `commitReferralLink` grava `referredAt` e o 🤝 nos dois lados. Não há
  `referralVia`: o sino só avisa o que chega pelo link.
- Só aparece com o funil Indicações e a etapa de entrada, e para quem pode
  editar a ficha.
