# Planos multi-modalidade, filtro de professor por modalidade e valores em R$ com centavos

status: ativo
data: 2026-07-16
branch: claude/multiple-modalities-teachers-plans-25829d

> Entrega 1 de 2. O histórico de aulas por professor foi separado num projeto próprio (ver "Próxima entrega" no fim). Aqui vão só plano multi-modalidade, filtro de professor e valores em centavos.

## Problema

Ao usar o gerencial, o Johnny notou dados inconsistentes na conversão por professor: criou uma aula experimental de "Musculação" com um professor de "Pilates", e no gerencial a aula não atribuiu o professor. Investigando, ficaram claros três pontos:

1. **Plano** aceita só uma modalidade (`modalityId`, um seletor de opção única). O Johnny precisa de mais de uma por plano.
2. **Agendamento de aula** já filtra professor por modalidade, mas o wizard da ficha tem um fallback que mostra **todos** os professores quando nenhum bate com a modalidade. Foi assim que um professor de Pilates entrou numa aula de Musculação. Quando a aula acaba salva sem o professor certo, o gerencial joga ela em "Treina sozinho" e o professor não é contabilizado.
3. **Valor do plano** só aceita número redondo (`type="number" step="1"`). Não dá pra cadastrar 197,90.

O **professor já é multi-modalidade** no código atual (`modalidadeIds`, array, com chips no cadastro). Confirmado com o Johnny: isso já funciona, não precisa mexer.

## Decisões (definidas com o Johnny)

- **Plano e aula continuam separados.** A modalidade da aula é escolhida no agendamento, não vem do plano. Plano multi-modalidade é organização do catálogo, não muda o fluxo de agendamento.
- **Filtro de professor estrito.** Ao escolher a modalidade no agendamento, aparecem só os professores daquela modalidade. Sem fallback de "mostrar todos". "Treina sozinho" aparece sempre, em qualquer modalidade.
- **Valores sempre com centavos.** Exibição padrão de moeda: `R$ 199,00`, `R$ 197,90`, em todo o app (cards de plano, matrícula, dashboard).
- **Corrigir os dois campos de valor:** cadastro de plano e ajuste de valor na matrícula.
- **Gerencial não muda.** A matemática está correta. Aula com data no futuro continua fora da "Conversão por professor" (só conta aula que já aconteceu), de propósito.

## Escopo

### A) Plano aceita várias modalidades

Arquivo: `src/views/settings/ManagePlansTab.jsx`. Coleção: `stronix_planos`.

- Campo do doc muda de `modalityId` (string ou null) para `modalityIds` (array de ids de modalidade).
- **Retro-compatibilidade sem migração:** ao ler um plano, resolver `plan.modalityIds || (plan.modalityId ? [plan.modalityId] : [])`. Planos antigos seguem funcionando e passam a gravar `modalityIds` quando editados. Mesma abordagem que o professor já usa. O campo legado `modalityId` fica no doc antigo sem atrapalhar (ninguém mais lê ele depois desta mudança).
- **Form:** trocar o `<StyledSelect>` de opção única por chips de liga/desliga, igual ao cadastro de professor (`ManageProfessorsCard.jsx`, estado `modIds` array + `toggleMod`). Rótulo "Modalidades (opcional)".
- **Card do plano:** mostrar as modalidades juntas (ex.: `Musculação · Pilates`) no lugar da única. Sem modalidade continua omitindo.
- **Helper puro** para resolver `modalityIds` para nomes (mesma ideia de `professorModalityNames` em `src/lib/professores.js`, que faz `prof.modalidadeIds` → nomes ignorando ids órfãos). Reaproveitar/generalizar em vez de duplicar.
- **Firestore:** nenhuma mudança de regras (as regras do `stronix_planos` não validam campos, só tenant/admin) e nenhum índice novo.

### B) Agendamento mostra só professor da modalidade

- **Wizard da ficha** (`src/components/profile/ScheduleWizard.jsx`, passo `professor`, hoje nas linhas 162-189): remover o fallback de "mostrar todos". A lista passa a ser só `professorsForModality(professores, modalities, values.modalidade)` mais "Treina sozinho" (sempre presente). Quando a lista vier vazia, mostrar só "Treina sozinho" e um aviso pra cadastrar um professor da modalidade em Configurações → Equipe. O wizard já limpa os passos seguintes ao editar a modalidade, então a seleção de professor não fica presa numa modalidade trocada.
- **Reagendamento da Meta Diária** (`src/views/DailyGoalView.jsx`, RescheduleModal): o filtro já é estrito e "Treina sozinho" já aparece sempre. Falta uma coisa: hoje trocar a modalidade **não limpa** o professor já selecionado, então dá pra gravar um professor de outra modalidade sem querer. Ao mudar a modalidade, limpar `professorSel`.
- Não adicionar validação rígida no write. O filtro do seletor mais a limpeza da seleção presa já impedem o caso inconsistente, sem travar edições legítimas (ex.: professor que teve a modalidade removida depois de já agendado).

### C) Valores em R$ com centavos

- **Inputs de valor** em `src/views/settings/ManagePlansTab.jsx` (valor do plano) e `src/modals/MatriculaModal.jsx` (valor da matrícula): trocar `type="number" step="1"` por `type="text" inputMode="decimal"`, placeholder `197,90`. O ícone de R$ (DollarSign) continua.
- **Parse** via helper novo `parseValorBRL(str)` em `src/lib/format.js`, puro e testado:
  - Remove "R$", espaços.
  - Se tem vírgula: trata vírgula como separador decimal e remove pontos (milhar). Ex.: `1.997,90` → `1997.9`.
  - Se não tem vírgula: ponto é decimal. Ex.: `197.90` → `197.9`, `199` → `199`.
  - Vazio ou inválido → `null`.
  - A validação atual do save (`Number.isFinite && >= 0`) passa a usar esse helper.
- **Formatar no blur** (recomendado): ao sair do campo, mostrar 2 casas (`197,9` digitado vira `197,90`), pra ficar claro que é moeda.
- **Exibição** (`fmtBRL` em `src/lib/format.js`): passar a mostrar sempre 2 casas: `R$ ${Number(n||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`. Atualizar o comentário "preços são redondos", que fica desatualizado. Afeta as 6 telas que usam `fmtBRL` (plano, matrícula, contratos, ficha, clientes, superadmin), todas de dinheiro. Nenhum teste checa string "R$", então não quebra teste existente.

## Fora de escopo (de propósito)

- Não mexer na matemática do gerencial (`src/lib/dashboardMetrics.js`). Aula futura segue fora da conversão por professor. Se uma aula não apareceu num card, é período/funil selecionado, não bug de cálculo.
- Não amarrar plano à aula experimental.
- Não migrar planos antigos por script (a leitura com fallback resolve).
- Não mexer no cadastro de professor (já é multi-modalidade).

## Testes

- `parseValorBRL`: `199`, `197,90`, `197.90`, `1.997,90`, `R$ 197,90`, vazio, lixo.
- `fmtBRL`: inteiro vira `R$ 199,00`; com centavos vira `R$ 197,90`; zero/nulo vira `R$ 0,00`.
- Helper de nomes de modalidade do plano: resolve `modalityIds`, cai no fallback de `modalityId` legado, ignora id órfão (modalidade excluída).
- Os 102 testes do dashboard seguem verdes (matemática intacta).

## Riscos e observações

- Mudar `fmtBRL` para 2 casas é uma mudança visual em todo o app. Decisão do Johnny: é o que ele quer (padrão de moeda).
- Contratos passam a poder carregar centavos no valor. É só mais precisão, não muda cálculo.
- Publicação das regras do Firestore é manual, mas aqui não há mudança de regra.

## Próxima entrega (projeto separado): histórico de aulas por professor

Decisão do Johnny: o modelo ideal guarda o histórico de **todas** as aulas experimentais, não só a última. Hoje o lead guarda um único agendamento e a aula nova sobrescreve a anterior, então o professor da aula antiga some das estatísticas. O objetivo é que cada aula vire um registro próprio e o resultado de um professor não apague o do outro.

Exemplo: lead faz aula com B, comparece, não fecha → conta pro B (aula + compareceu, sem conversão). Depois faz aula com C, comparece, fecha → conta pro C (aula + compareceu + conversão), sem mexer no B.

**Regra de atribuição da conversão (definida com o Johnny):** quando o lead fecha o plano, o crédito da conversão vai pra **última aula em que ele compareceu antes de fechar**. As aulas anteriores atendidas ficam como "compareceu, sem conversão" para os respectivos professores.

Por que é um projeto à parte: é mudança de modelo de dados (coleção/subcoleção de aulas por lead), mexe no agendar (cria registro em vez de sobrescrever), no marcar presença, na conversão (precisa saber qual aula converteu), na agregação do dashboard (`computeProfessorConversion` passa a ler registros de aula), em regras/índices do Firestore, na retro-compatibilidade com leads existentes, e tem peso de escala (mais leituras) num sistema que acabou de reduzir leitura (ver trabalho de escala E1–G). Merece spec e PR próprios.
