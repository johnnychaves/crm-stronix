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

## Fase 2 — link compartilhável (NÃO construída)

Cada cliente ganha um link/código para divulgar (ex.:
`stronilead.app/i/{slug}?ref={leadId}`); o lead entra sozinho já vinculado e
caindo na etapa de entrada do funil. Requisitos quando for construir:

1. **API**: a Vercel está em 12/12 funções (plano Hobby) — consolidar como
   `action` numa função existente (padrão `api/impersonate.js`/`api/asaas.js`),
   usando Admin SDK para criar o lead com `referredById` + funil/etapa de
   entrada + `source: 'Indicação'` (mesmo shape do AddLeadModal, com
   `buildLeadSearchFields`/`lifecycleBucket`).
2. **Página pública** com marca da academia (padrão `api/tenant-resolve.js`).
3. **Código do cliente**: o próprio id do doc serve; um slug curto denormalizado
   fica melhor pra URL.
4. **Anti-abuso**: rate limit (`api/_rateLimit.js`) + honeypot + dedupe por
   WhatsApp (`findDuplicateLeadRemote`).
5. **Cadastro já existente (decidido 2026-08-07)**: a API nunca cria duplicata,
   e o visitante vê SEMPRE a mesma tela de sucesso — responder "esse número já
   existe" num endpoint público vaza quem é aluno. Por dentro: grava um evento
   na timeline do cadastro existente ("tentou se cadastrar pelo link de
   indicação de {Nome}") e NÃO auto-vincula nem move de funil — o time decide
   (contenção contra farmar indicação com telefone alheio quando houver
   recompensa). No fluxo manual isso já é resolvido pelo dup-check do modal:
   bloqueia, mostra quem é, e o vínculo retroativo sai pelo PhaseChanger.
