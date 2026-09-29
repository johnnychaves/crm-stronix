---
status: revisão
---

# Marcar desfecho na Meta Diária e indicação cadastrada à mão

Duas mudanças no mesmo PR, pedidas pelo Johnny em 29/09/2026. As duas foram desenhadas na mesma conversa, com mockup aprovado.

1. Na Meta Diária, o switch de presença da visita e da aula experimental dá lugar ao botão "Marcar desfecho", que abre um balão com Compareceu e Não compareceu. Com o balão também se corrige o desfecho, e a correção desfaz o que o desfecho errado fez.
2. Na ficha do cliente, as indicações ganham uma terceira forma de entrar: o cadastro à mão, um indicado depois do outro, num pop-up.

---

## Parte 1. Marcar desfecho

### O problema

O switch da Agenda de hoje (`src/components/ui/PresenceSwitch.jsx`, dentro de `src/components/dailygoal/DayAgendaCard.jsx`) até troca de verde para vermelho num clique. Na prática, o time não consegue passar de "compareceu" para "não compareceu" por quatro motivos:

- **Segurar desmarca.** Com o botão apertado por meio segundo, a marca volta para o cinza em vez de trocar. O gesto é escondido de propósito e ninguém sabe dele.
- **O vermelho some.** O "não veio" abre na hora a janela de remarcar, que já vem com amanhã escolhido. Quem confirma leva o agendamento para a data nova, e a linha sai da agenda de hoje.
- **A troca não desfaz o "compareceu".** O lead fica em Negociação, e o `nextFollowUp` continua limpo. Como já existe marca da Meta no dia (`hasGoalDoneToday`), a linha do tempo não ganha o "não veio". O relatório de visitas do CRM (`src/lib/crm/appointments.js`) continua contando comparecimento quando o espelho do lead muda de agendamento.
- **O card "A fazer" não tem volta.** Depois do Compareceu, o card vai para "Feitos hoje" (`DoneCard`), que só mostra o desfecho e um botão de remarcar.

A bolinha ao lado da hora na agenda também fica verde para quem faltou (`row.outcome ? 'bg-emerald-500'`).

### O que muda na tela

O botão "Marcar desfecho" abre um balão preso a ele (Popover do shadcn, `src/components/ui/popover.jsx`, que já existe e ainda não é usado). O balão fica ao lado da linha e não escurece a tela. O switch sai e o `PresenceSwitch.jsx` é apagado, porque a agenda era o único lugar que o usava.

| Lugar | Hoje | Depois |
|---|---|---|
| Agenda de hoje (`DayAgendaCard`) | Switch verde/vermelho/cinza | "Marcar desfecho" com Compareceu e Não compareceu |
| Card "A fazer" (`TaskCard`) | Compareceu, Não veio, Remarcou, Cancelou | "Marcar desfecho" com Compareceu e Não compareceu em destaque e, embaixo, Remarcou e Cancelou |
| Próximo compromisso (`NextUp`) | Compareceu | "Marcar desfecho" com as mesmas quatro opções do card "A fazer" |
| Feitos hoje (`DoneCard`) | Texto do desfecho | O desfecho vira o botão que abre o balão de correção |

Depois de marcado, o botão mostra o desfecho: "Compareceu" em verde ou "Não compareceu" em vermelho, com a setinha. Clicar reabre o balão, que passa a oferecer:

- **Trocar para Não compareceu** ou **Trocar para Compareceu**;
- **Desfazer marcação**, só na Agenda de hoje. No "Feitos hoje" essa opção não aparece, porque a marca da Meta do dia fica gravada e o card continuaria em "Feitos hoje" sem desfecho, o que confunde.

O balão de correção só aparece quando o desfecho é Compareceu ou Não compareceu e o agendamento do lead ainda é o de hoje. Depois de Cancelou, ou depois de remarcar, não há o que corrigir. O card mostra o texto como hoje.

A bolinha da agenda fica verde no Compareceu, vermelha no Não compareceu e laranja no próximo, como já era.

Um componente só serve os quatro lugares: `src/components/dailygoal/OutcomePopover.jsx`. Ele recebe o desfecho atual, se oferece Remarcou e Cancelou, se oferece Desfazer, o estado de gravação e um `onPick`. Não grava nada: quem grava é a tela.

### O que a primeira marcação grava

Continua igual. A agenda usa `markAgendaPresence` (que chama `writeAppointmentOutcome`), e o card "A fazer" usa `handleOutcome`. Cada um mantém o passo seguinte de hoje: o Não compareceu abre a remarcação, e o Compareceu e o Cancelou do card "A fazer" abrem o "Próximo contato?".

Muda uma coisa: quando o Compareceu leva o lead para Negociação, o lead passa a guardar de onde ele saiu, no campo novo `appointmentPromotedFrom`:

```js
appointmentPromotedFrom: {
  status,          // etapa antes do Compareceu
  statusEnteredAt, // quando ele tinha entrado nela
  funnelId,        // funil do lead naquele momento
  toStatus         // a etapa para onde foi (Negociação)
}
```

Toda gravação de desfecho escreve esse campo. Se não houve promoção, ele fica `null`, e o reagendamento (`handleReschedule`) também o zera. Assim o campo sempre fala do desfecho atual e nunca de um agendamento antigo. O bloco sai de uma função pura, usada por `writeAppointmentOutcome` e por `handleOutcome`, para os dois caminhos não divergirem.

### O que a correção faz

A correção mora em `correctAppointmentOutcome`, em `src/lib/appointmentOutcome.js`. O plano do que gravar sai de uma função pura em `src/lib/outcomeCorrection.js`, testada em node. As regras:

**A etapa só volta quando dá para confiar.** O lead volta para `appointmentPromotedFrom.status`, com o `statusEnteredAt` antigo, quando três coisas valem juntas:

- o campo existe;
- o lead ainda está em `toStatus`;
- o lead ainda está no mesmo `funnelId`.

Se alguém já moveu o lead depois do Compareceu, a etapa fica onde está. A volta grava uma interação `status_change` com `stageChangeFields`, com o texto "Fase voltou para [X] após correção do desfecho.". Cliente nunca é promovido, então nunca volta.

**De Compareceu para Não compareceu:**

- no lead: `appointmentOutcome: 'no_show'`, com `appointmentOutcomeAt` e `appointmentOutcomeBy`;
- a etapa volta, pela regra acima, e `appointmentPromotedFrom` vira `null`;
- o `nextFollowUp` volta a ser o horário do agendamento (`appointmentScheduledFor`), porque o Compareceu o tinha limpado. Isso não vale para cliente, cujo Compareceu não limpa esse campo. Com isso o lead fica igual a quem foi marcado Não compareceu desde o começo: amanhã ele aparece em Atrasado se ninguém remarcar;
- uma interação `daily_goal_done` com `appointmentOutcome: 'no_show'`, `outcomeCorrection: true` e o texto "↩️ Desfecho corrigido: ❌ Não veio · Agenda do dia (Visita hoje)". O relatório de visitas já lê o último desfecho do dia na linha do tempo (`visitOutcomesByLead`), então a correção ganha;
- na aula experimental, `applyOutcomeToAula` marca o registro da aula como falta;
- abre a remarcação (`flow: 'after_no_show'`), como no Não compareceu normal. Fechar a janela quer dizer "remarco depois".

**De Não compareceu para Compareceu:**

- faz o que o Compareceu normal faz, pelo `writeAppointmentOutcome`, inclusive levar o lead para Negociação e gravar `appointmentPromotedFrom`;
- a interação `daily_goal_done` é sempre gravada, com `outcomeCorrection: true` e o texto de correção, mesmo que o dia já tenha marca;
- o passo seguinte é o do lugar: no "Feitos hoje" abre o "Próximo contato?", como no card "A fazer"; na agenda não abre nada, como hoje.

**Desfazer marcação** (só na agenda):

- `clearAppointmentOutcome` limpa o desfecho, como hoje;
- a etapa volta, pela regra acima;
- se o desfecho desfeito era Compareceu de um lead que não é cliente, o `nextFollowUp` volta a ser o horário do agendamento;
- a marca da Meta do dia fica, como já acontece hoje.

**Conta das tarefas.** O Operacional conta uma tarefa por lead, categoria, dia e autor (`tasksByType`, em `src/lib/operacional/routine.js`). A correção feita pela mesma pessoa no mesmo dia não conta de novo. Se outra pessoa corrige, conta uma tarefa para ela, que é a regra de hoje para a agenda compartilhada.

**Permissão.** Nenhuma regra do Firestore muda. Qualquer pessoa da academia pode atualizar o lead sem trocar o dono e pode criar interação.

### Limites aceitos

- **Só no dia.** A correção vale no mesmo dia, porque a agenda e o "Feitos hoje" só mostram hoje. Corrigir um desfecho de ontem continua sendo pela ficha.
- **A ida e a volta ficam no Dashboard CRM.** A passagem entre etapas (`src/lib/crm/stages.js`) vai mostrar a ida para Negociação e a volta, porque as duas mudanças aconteceram na base. Apagar a ida exigiria editar interação de outra pessoa, o que a regra só deixa para o autor ou o gestor.
- **Lead promovido antes deste PR.** Um lead que foi para Negociação antes do deploy não tem `appointmentPromotedFrom`. A correção troca o desfecho, mas não volta a etapa. Isso só vale para marcações feitas no dia do deploy.

---

## Parte 2. Cadastrar indicação à mão

### Onde aparece

- **Menu do topo da ficha do cliente.** O botão "Link de indicação" passa a se chamar **"Indicar"**, com o ícone de aperto de mãos. O menu fica com:
  1. Cadastrar indicação (nova, primeira da lista);
  2. Copiar link;
  3. Enviar pro cliente (ou "Enviar pro responsável", como hoje).
- **Aba Indicações** (`src/components/profile/ReferralsSection.jsx`). O botão "Cadastrar indicação" aparece em cima da lista e no aviso de quando ainda não há nenhuma. O texto desse aviso passa a citar as três formas. A seção ganha a prop `onAdd`. Sem ela, o botão não aparece.

As duas entradas só existem na ficha de cliente, como a aba e o menu já são. Também só aparecem quando a academia tem o funil Indicações com a etapa de entrada (`getReferralFunnel` mais `getReferralEntryStage`), a mesma trava do "É uma indicação?" do Novo lead.

### O pop-up

`src/modals/QuickReferralModal.jsx`, com o Dialog do shadcn. O título é "Indicações de <cliente>" e o subtítulo, "Entram no funil Indicações, com você de responsável".

| Campo | Obrigatório | De onde vem |
|---|---|---|
| Nome | sim | texto |
| WhatsApp | sim | a mesma máscara do Novo lead (celular e fixo) |
| Modalidade de interesse | não | `modalities` do `useGeneralConfig` |
| Dor | não | `dores` do `useGeneralConfig` |

- **Cadastrar** (ou o Enter) grava o indicado, limpa os campos e põe o cursor de volta no Nome. O pop-up fica aberto.
- Cada gravado entra na lista "Cadastradas agora", com o nome, o telefone e o link para a ficha (`LeadLink`).
- **Concluir** fecha o pop-up. A lista da aba e o número na aba são recarregados a cada cadastro (`reloadReferrals`).
- Sem modalidade ou dor cadastradas na academia, o campo some. O cadastro não trava por isso.

### Conferências antes de gravar

- **Nome** com pelo menos um caractere que não seja espaço.
- **WhatsApp** com 10 ou 11 dígitos, a mesma conta do Novo lead.
- **WhatsApp repetido barra o cadastro.** O aviso "Já existe: Fulano", com link para a ficha, aparece enquanto se digita (`useDuplicateLead`), e a conferência é refeita na hora de gravar (`findDuplicateLeadRemote`), como no Novo lead. Isso também pega o número do próprio cliente que indica.
- **O telefone de responsável de outro lead não barra**, igual ao Novo lead. A mãe de um aluno menor pode ser indicada.

### O que é gravado

O lead sai de `buildNewLeadDoc` (`src/lib/newLead.js`), o mesmo montador do Novo lead e do cadastro pelo Stronizap. Os campos:

| Campo | Valor |
|---|---|
| `funnelId` | o funil Indicações |
| `status` | a etapa de entrada dele |
| `source` | `'Indicação'` |
| `dor` e `modalidade` | o que foi escolhido, ou vazio |
| referência (`referrer`) | o cliente da ficha |
| dono (`owner`) | quem está cadastrando |
| `createdAt` e `statusEnteredAt` | `serverTimestamp()` |

O formulário que vai para o montador sai de uma função pura nova em `src/lib/referrals.js`, testada em node. Ela recebe os quatro campos, o funil e a etapa.

Depois vem `commitReferralLink` (`src/lib/referralsWrites.js`), na mesma ordem do Novo lead. Ele grava `referredAt` e o 🤝 nas duas linhas do tempo: "Indicou Juliana" no cliente e "Indicado por Carla" no indicado. Se essa segunda gravação falhar, o lead já existe com `referredById` e `referredByName`, como hoje no Novo lead, e o erro vai para o console.

O dono é sempre quem cadastra. As regras do Firestore só deixam o consultor criar lead em nome dele mesmo, e o gestor passa o lead adiante depois, como já faz.

O 🎉 da matrícula (`buildMatriculaWrites`) funciona sozinho, porque depende só do `referredById`.

Não entra `referralVia`. O sino só avisa o indicado que chega pelo link (`referralVia: 'link'`), porque ali o dono não viu o cadastro acontecer. Aqui quem cadastra é o dono.

### Fora do escopo

- **Menor de idade:** o pop-up não tem a chave do menor. Se o indicado for criança, o consultor completa pelo lápis da ficha.
- **Observação:** não entra no pop-up, por decisão do Johnny. A nota vai pela ficha.
- **Função nova na Vercel:** nenhuma. Tudo roda no navegador, pelas regras que já existem.

---

## Textos de ajuda e novidade

- **Central de ajuda** (`src/lib/wiki.js` e as demos de `src/components/help/WikiDemo.jsx`):
  - o artigo do desfecho passa a falar do "Marcar desfecho" e da correção;
  - o artigo de indicações troca "Link de indicação" por "Indicar" e ganha o cadastro à mão.
- **`docs/indicacoes.md`** ganha a terceira forma de entrada.
- **Novidade no sino** (`src/lib/announcements.js`): uma entrada para toda a equipe, sem pop-up (`major` ausente). Ela avisa o "Marcar desfecho", o fim do gesto de segurar e o cadastro de indicação pela ficha.

## Testes

- **`src/lib/__tests__/outcomeCorrection.test.js`** (novo), cobrindo o plano de cada troca:
  - Compareceu para Não compareceu, Não compareceu para Compareceu e Desfazer;
  - etapa que volta e etapa que fica (lead movido depois, funil trocado, campo ausente, cliente);
  - `nextFollowUp` restaurado ou não;
  - o bloco `appointmentPromotedFrom` preenchido na promoção e `null` sem ela.
- **`src/lib/__tests__/crm.appointments.test.js`:** a marca de correção vale como último desfecho do dia.
- **`src/lib/__tests__/referrals.test.js`:** o formulário da indicação rápida (funil, etapa, origem, dor e modalidade vazias ou preenchidas, nome aparado).
- **Teste em jsdom do `OutcomePopover`:** as opções certas para cada estado (sem marca, marcado na agenda, marcado no "Feitos hoje", com e sem Remarcou e Cancelou), e o botão mostrando o desfecho.
- **Testes que já existem** passam como estão, ou são ajustados só onde citavam os quatro botões do card: `metaLinks.test.js`, `dayAgenda.test.js`, `newLead.test.js`, as varreduras de link e de proteção de erro.
- **Na mão, com `npm run dev`:**
  - marcar, trocar e desfazer na agenda;
  - marcar pelo card "A fazer" e corrigir no "Feitos hoje";
  - conferir a etapa e a linha do tempo do lead;
  - cadastrar três indicações seguidas, uma delas com WhatsApp repetido.
