# Qualidade

O que o projeto cobra de uma mudança, como rodar e qual era a linha de base em 15/10/2026 (commit `98584f4`, branch `main`).

## Comandos

| Check | Comando | O que cobre |
|---|---|---|
| Lint | `npm run lint` | ESLint 9 em todo `.js` e `.jsx` fora de `dist/` e `docs/`, com `jsx-no-undef`, `jsx-uses-vars`, hooks e refresh |
| Testes | `npm test` | Vitest, 219 arquivos. jsdom nos que montam tela (`// @vitest-environment jsdom`) |
| Vazamento | `npm run verificar:sentry` | Sobe o Sentry da `api/` contra um receptor falso, com um handler no formato do `api/zap.js`, e procura a chave do Zap, a chave do Resend e telefones no envelope. Não cobre o SDK do navegador |
| Build | `npm run build` | `vite build` e remoção dos `.map` |
| Tipos | indisponível | JavaScript puro, sem TypeScript. `jsconfig.json` só ajuda o editor |
| Base inteira | `npm run lint && npm test && npm run verificar:sentry && npm run build` | O mesmo que o CI roda |

O CI (`.github/workflows/ci.yml`) roda esses quatro em todo PR para a `main` e em todo push nela, com Node 22.

## Linha de base antes do setup do toolkit

| Check | Resultado |
|---|---|
| Lint | 0 erros e 1 aviso (`react-hooks/exhaustive-deps`, efeito com `loadPlans` e `loadTenants` fora das dependências) |
| Testes | 219 arquivos, 4913 testes, todos passando, 15 s |
| Build | passa, com aviso de chunk acima de 500 kB |
| `npm audit` | 31 achados no total e 23 nas dependências de produção (1 baixo, 10 moderados, 10 altos, 2 críticos). Só 3 são diretos: `exceljs`, `firebase-admin` e `postcss`. O resto vem de pacotes do Google e do `websocket-driver` |

Nenhuma correção de auditoria foi aplicada neste setup. `npm audit fix --force` mexe em versão principal, e `exceljs` só fecha o achado trocando para a 3.4.0, que é um downgrade. Cada um vira decisão própria.

## Como o projeto testa

- Testes ao lado do código, em `src/lib/__tests__/` e `api/__tests__/`. Teste de tela usa jsdom.
- **Varreduras (sweeps)** reprovam o padrão proibido em todo o código, em vez de testar um caso: `acessoSweep`, `filtrosNoEndereco.sweep`, `leadLinkSweep`, `newLeadSweep`, `marcaDoDia.sweep`, `donoDaEpoca.sweep`, `protecaoDeErro.sweep` e `registroDoAgendamento.sweep`. Código novo que repita o padrão antigo quebra o teste.
- **Testes de importação** (`acessoImports`, `rotinasImports`, `newLeadImports`, `teamRolesImports`, `guardianImports`) travam, arquivo por arquivo, que o que a `api/` lê não importe pacote. Não há uma varredura geral de tudo que a `api/` importa de `src/lib/`.
- **Testes que leem o texto das regras do Firestore** conferem a lista de campos gravados pelo app contra `firestore.rules` (`professorRules`, `rotinaRules`) e as chamadas de módulo (`modules`). Mudou a gravação, o teste quebra até a regra acompanhar. As regras não são executadas em teste, e não há emulador.
- O banco falso de `api/__tests__/zapRoute.test.js` imita o SDK de servidor, e é ele que pega erro de `snap.exists`.

## Regras do toolkit medidas, sem endurecer

Medido em 15/10/2026 com as regras `max-lines` (350 linhas) e `no-direct-console` do toolkit, fora do ESLint do projeto, sobre `src/`, `api/` e `scripts/` (594 arquivos, testes excluídos pela própria regra). O lint do projeto não mudou.

| Regra | Violações | Distribuição |
|---|---|---|
| `max-lines` (350) | 46 arquivos | 38 em `src/`, 7 em `api/`, 1 em `scripts/`. 27 entre 351 e 500 linhas, 14 entre 501 e 1000, 5 acima de 1000 |
| `no-direct-console` | 413 ocorrências | 192 em `src/`, 58 em `api/`, 163 em `scripts/` |

Os cinco maiores: `src/views/DailyGoalView.jsx` (1974), `src/App.jsx` (1942), `src/views/LeadProfileView.jsx` (1851), `src/views/KanbanView.jsx` (1693) e `src/views/console/SuperConsole.jsx` (1638).

Por que não virou regra do lint agora:

- `no-direct-console` só faz sentido com um adaptador de log. O projeto não tem um, e `scripts/` são CLIs que imprimem de propósito. Na `api/`, o log segue política própria: sem dado pessoal e sem segredo.
- `max-lines` em `error` reprovaria 46 arquivos de uma vez. O caminho é `warn` com contagem, e reduzir arquivo por arquivo quando a tela passar por mudança, junto com os testes dela.
- O toolkit traz também `no-direct-data-access`, escrito para Drizzle. Não se aplica a Firestore.

## Regras de código que o projeto já cobra

Estão no `CLAUDE.md` e em testes. As que mais pegam:

- Papel de usuário só em `src/lib/acesso.js` (`acessoSweep`).
- Abrir ficha sempre por link (`leadLinkSweep`) e filtro de tela sempre no endereço (`filtrosNoEndereco.sweep`).
- Lead novo sempre pelo `buildNewLeadDoc` (`newLeadSweep`).
- Modal no fim do `App.jsx` sempre dentro de proteção de erro (`protecaoDeErro.sweep`).
- Rolador horizontal com `overscroll-x-contain` (`overscrollGuard`).
- `index.html` em português e fora da tradução automática (`indexHtml`).

## Segurança e dados

- Segredos só em variável de ambiente da Vercel. `.env.example` lista as chaves sem valor.
- O Sentry do app e da `api/` limpa dado pessoal na origem, e o `verificar:sentry` roda no CI para provar que o Sentry da `api/`, com o handler de teste, mascara a chave do Zap, a chave do Resend e o telefone. Ele não executa as funções reais nem o corte feito em `api/_mail.js`.
- Scripts de `scripts/` que gravam dado só rodam com autorização do Johnny, e o gatilho varia:
  - `--apply`: `backfill-contract-seamless`, `backfill-tenant-claims`, `fix-clients-unsold-by-stage-move`, `fix-consultant-ownership` e `migrate-tenant-private`;
  - `--commit`: `backfill-appointments`, `backfill-aulas` e `cleanup-orphan-aulas`;
  - `--dry-run` para simular, porque gravam por padrão: `backfill-scale-fields`;
  - nenhum gatilho, gravam direto: `backfill-zap-match-key`, `create-super-admin`, `set-super-admin` e `register-tenant`;
  - só leitura: `volume-audit-report`.

  Leia o cabeçalho do script antes de rodar.
- As regras do Firestore têm listas e cláusulas conferidas por teste de texto, e a publicação é manual.

## Quando uma mudança está pronta

1. A base inteira passa, sem aumentar o aviso de lint.
2. Há teste do comportamento novo e da falha que importa.
3. O documento dono da regra mudou junto (`CLAUDE.md`, `docs/`).
4. Se mexeu em `firestore.rules` ou `firestore.indexes.json`, estão publicados.
5. O Johnny aprovou o PR.
