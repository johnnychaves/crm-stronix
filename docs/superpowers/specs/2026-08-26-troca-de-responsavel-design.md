# Troca de responsável liberada para a equipe

status: ativo
data: 2026-08-26

## O problema

Trocar o consultor responsável de um lead ou de um aluno era exclusivo do administrador. Pela interface, o consultor via o nome do dono num campo desabilitado (`src/modals/ClientRegistrationModal.jsx`) e a migração em massa morava dentro de Configurações, que só abre para admin.

Fora da interface a história era outra. A regra do Firestore só protegia `consultantAuthUid`. Como `consultantId` ficava livre e é ele quem manda na carteira, na Meta Diária e nos relatórios, qualquer membro autenticado do tenant podia reescrever a atribuição de qualquer lead por uma chamada direta ao SDK, sem ganhar permissão sobre ele. O resultado era um documento torto: aparecia na carteira de uma pessoa e continuava editável por outra.

## A decisão

Qualquer consultor pode trocar o responsável de qualquer lead ou aluno. Sem trava de dono, sem pedir o gestor. Em troca, a operação passa a deixar rastro e o furo de integridade é fechado.

## O desenho

### Regras do Firestore

O update de lead deixa de exigir dono preservado e passa a exigir integridade do par:

```
function ownerFieldsMoveTogether() {
  return (request.resource.data.get('consultantId', null) == resource.data.get('consultantId', null))
    == (request.resource.data.get('consultantAuthUid', null) == resource.data.get('consultantAuthUid', null));
}
```

Ou os dois campos mudam, ou nenhum muda. Sem leitura extra e sem quebrar documento legado que não tenha os campos, graças ao `.get(campo, null)`.

### Onde se troca

O campo "Consultor responsável" que já existia na aba Relacionamento do lápis do cadastro. Some a condição de admin, todo mundo vê o select da equipe. Nenhuma tela nova.

### O que é gravado

`buildClientRegistrationPatch` perde o parâmetro `isAdmin` e grava sempre os três campos de dono juntos. Quando o dono muda, o salvamento acrescenta o carimbo `consultantChangedAt`, `consultantChangedByName` e `consultantChangedByAuthUid`.

### O rastro

Troca de dono sai por `logInteraction`, num batch atômico com o patch do lead. A nota é `type: 'status_change'` com o texto "Responsável alterado de [X] para [Y]." O texto evita de propósito as palavras que a timeline usa para reconhecer evento de contrato (matrícula, renovação, plano), senão a troca apareceria como matrícula fechada.

### O aviso

Grupo "Passaram para você" no sino, ao lado de Novidades e Indicações. Duas fontes somadas e deduplicadas por id:

- `useHandoffs`, um `getDocs` por sessão (`consultantId == eu`, `consultantChangedAt >= 30 dias`, limite 15). É o que alcança aluno e perda, que não estão na assinatura ao vivo.
- Os leads ativos já em memória, que pegam a troca acontecendo com o app aberto.

A leitura reaproveita o carimbo das indicações: o "marcar tudo como lido" é um clique só, então um carimbo basta. Quem entregou o lead não é avisado. O gestor não recebe aviso das trocas dos outros, porque o teste de dono aqui é estrito, sem o atalho de admin.

## O que fica de fora

As interações antigas continuam atribuídas a quem as fez. Quem recebe o lead herda o histórico na ficha, que lê por `leadId`, mas não os números passados no dashboard. Mudar isso exigiria afrouxar a regra das interações, que hoje só deixa cada um editar o que escreveu. Só a migração em massa do admin reescreve o histórico.

## Publicação manual

1. Regras do Firestore no console (o repositório não publica por CLI).
2. Índice composto novo em `stronix_leads`: `consultantId` ASC + `consultantChangedAt` DESC.
