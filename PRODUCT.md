# Produto: STRONILEAD

## O que é

CRM de leads para academias. Acompanha cada pessoa do primeiro contato até a matrícula e depois a renovação. Cada academia é uma organização separada (multi-tenant) dentro de uma instalação só. O produto está em produção e tem a STRONIX e a Shape One entre as academias ativas. Power Club e Petros estão suspensas desde julho de 2026.

Fatos observados em `README.md`, `CLAUDE.md` e no código. O que for hipótese vem marcado como tal.

## Quem usa

| Papel | O que faz no sistema |
|---|---|
| Super-admin (dono do STRONILEAD) | Cria, suspende e reativa academias, define plano e teste, liga módulos por academia e acompanha uso e cobrança pelo Console. |
| Gestor (admin da academia) | Configura funis, origens, planos, metas e rotinas, cadastra a equipe, vê todos os leads e os dashboards. |
| Consultor | Trabalha os próprios leads, cumpre a Meta Diária e a rotina do dia. |
| Professor | Só existe com o módulo `faltosos` ligado. Abre a Meta diária (hoje só um aviso, a Meta dos faltosos é o PR 3), Clientes e a ficha, e registra anotação, contato e agendamento. |

## Fluxos críticos

1. **Entrada do lead.** Cadastro no Novo lead, importação de clientes, página pública de indicação ou cadastro pelo Stronizap.
2. **Pipeline.** Kanban por funil e etapa, com ficha do lead e linha do tempo.
3. **Meta Diária.** Contatos, visitas e aulas experimentais do dia, atrasados e desfecho de cada agendamento.
4. **Matrícula e contratos.** Venda, renovação, trancamento, cancelamento e histórico de contratos do cliente.
5. **Acompanhamento.** Dashboards Operacional, CRM e Gerencial, mais as Rotinas dos consultores.
6. **Ponte com o Stronizap.** O atendente do WhatsApp vê quem é a pessoa, cadastra o lead e agenda visita ou aula pela conversa.

## O que o produto não é

- Não é financeiro. Todo valor do Gerencial é valor de contrato vendido, e o sistema não guarda pagamento, parcela nem inadimplência do aluno.
- Não é app de celular. A tela existe no celular, mas o layout mobile está em segundo plano por decisão do Johnny, registrada em `docs/design.md`.
- Não é o atendimento. Conversa e histórico de mensagens vivem no Stronizap. O CRM entrega o cartão de contexto de quem escreve e recebe o cadastro e o agendamento feitos por lá.

## Escopo atual e limites conhecidos

- A cobrança das academias passa pelo Asaas e fica desligada sem `ASAAS_API_KEY`.
- A Parte B da ponte com o Stronizap (mensagem enviada virando interação, Meta Diária deixando de ser autodeclarada) está desenhada e sem plano escrito.
- Folga, férias e falta ainda não entram nas Rotinas, e o histórico das Rotinas no Operacional é a parte 3, pendente.
- A importação de clientes só aceita o modelo de planilha do Stronilead.
- A Meta dos faltosos do professor (PR 3) ainda não existe.
- A tela de Relatórios está em implementação nas branches `claude/relatorios-entrega-a-spec` (auditoria e spec) e `claude/relatorios-de-leads` (relatório de Leads), ainda sem merge na `main`.

## Critério de pronto de uma entrega

Uma mudança está pronta quando passa lint, testes e build, tem spec ou plano em `docs/superpowers/` quando é maior que um ajuste, atualiza o `CLAUDE.md` ou os documentos em `docs/` que ela toca, e foi aprovada pelo Johnny no PR. Mudança em `firestore.rules` só vai para produção depois de publicada no console.
